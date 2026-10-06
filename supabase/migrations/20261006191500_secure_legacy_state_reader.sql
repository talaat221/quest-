create or replace function public.get_my_quest_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Authentication required'; end if;
  return public.build_quest_state_for_user(uid);
end;
$$;

revoke execute on function public.get_my_quest_state() from public, anon;
grant execute on function public.get_my_quest_state() to authenticated;
