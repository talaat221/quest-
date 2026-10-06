create or replace function public.rate_limit_quest_block_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  actor uuid := case when tg_op = 'DELETE' then old.blocker_id else new.blocker_id end;
begin
  -- Skip backend cascades/admin cleanup; rate-limit only the signed-in user
  -- actively changing their own block list.
  if me is null or actor is null or me <> actor then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  perform quest_private.consume_api_rate_limit(
    'user:' || me::text, 'block_change_hour', 30, 3600, 1
  );
  perform quest_private.consume_api_rate_limit(
    'user:' || me::text, 'block_change_day', 100, 86400, 1
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke execute on function public.rate_limit_quest_block_change()
from public, anon, authenticated;

drop trigger if exists rate_limit_quest_block_change on public.quest_user_blocks;
create trigger rate_limit_quest_block_change
before insert or delete on public.quest_user_blocks
for each row execute function public.rate_limit_quest_block_change();
