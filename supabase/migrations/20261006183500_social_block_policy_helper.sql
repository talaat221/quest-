create or replace function public.quest_social_interaction_allowed(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_other_user_id is not null
    and p_other_user_id <> auth.uid()
    and not exists (
      select 1
      from public.quest_user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p_other_user_id)
         or (b.blocker_id = p_other_user_id and b.blocked_id = auth.uid())
    );
$$;

revoke all on function public.quest_social_interaction_allowed(uuid) from public;
grant execute on function public.quest_social_interaction_allowed(uuid) to authenticated;

drop policy if exists "Send own friend requests" on public.quest_friendships;
create policy "Send own friend requests"
on public.quest_friendships
for insert
to authenticated
with check (
  requester_id = auth.uid()
  and addressee_id <> auth.uid()
  and status = 'pending'
  and public.quest_social_interaction_allowed(addressee_id)
);
