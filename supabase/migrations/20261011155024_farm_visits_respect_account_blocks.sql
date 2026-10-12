-- Apply on both older installs and the newer social-blocking schema.
-- Owners can always access their own farm. A block in either direction denies
-- visits and summaries, even through an old or cancelled competition.
create or replace function quest_private.farm_allowed(p_target uuid) returns boolean
language plpgsql stable set search_path='' as $$
declare me uuid:=auth.uid();
begin
  if me is null then return false; end if;
  if p_target=me then return true; end if;
  if to_regclass('public.quest_user_blocks') is not null then
    if exists(select 1 from public.quest_user_blocks b
      where (b.blocker_id=me and b.blocked_id=p_target)
         or (b.blocker_id=p_target and b.blocked_id=me)) then return false; end if;
  end if;
  return exists(select 1 from public.quest_friendships f where f.status='accepted'
      and ((f.requester_id=me and f.addressee_id=p_target) or (f.addressee_id=me and f.requester_id=p_target)))
    or exists(select 1 from public.quest_contest_members mine
      join public.quest_contest_members theirs on theirs.contest_id=mine.contest_id
      join public.quest_contests c on c.id=mine.contest_id
      where mine.user_id=me and theirs.user_id=p_target
        and mine.status='accepted' and theirs.status='accepted' and c.status<>'cancelled');
end $$;
revoke all on function quest_private.farm_allowed(uuid) from public,anon,authenticated;
