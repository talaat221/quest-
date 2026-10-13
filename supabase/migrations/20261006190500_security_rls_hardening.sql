-- Quest security hardening: remove browser privileges that are not needed.
revoke all privileges on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Legacy/state RPCs require an authenticated session even if their bodies
-- already reject a missing auth.uid(). Remove the anonymous/public route too.
revoke execute on function public.commit_my_quest_state(jsonb,timestamptz,boolean) from public, anon;
grant execute on function public.commit_my_quest_state(jsonb,timestamptz,boolean) to authenticated;

revoke execute on function public.get_my_quest_state() from public, anon;
grant execute on function public.get_my_quest_state() to authenticated;

revoke execute on function public.sync_quest_normalized(jsonb) from public, anon;
grant execute on function public.sync_quest_normalized(jsonb) to authenticated;

-- Social safety RPCs are signed-in actions only.
revoke execute on function public.block_quest_user(uuid) from anon;
revoke execute on function public.unblock_quest_user(uuid) from anon;
revoke execute on function public.get_my_quest_blocks() from anon;
revoke execute on function public.report_quest_user(uuid,text,text,text,uuid) from anon;
revoke execute on function public.quest_social_interaction_allowed(uuid) from anon;

-- Trigger functions should never be callable as client RPCs.
revoke execute on function public.create_quest_profile_for_new_user() from public, anon, authenticated;
revoke execute on function public.mirror_quest_data_to_normalized_tables() from public, anon, authenticated;
revoke execute on function public.enforce_quest_friendship_blocks() from public, anon, authenticated;
revoke execute on function public.enforce_quest_competition_blocks() from public, anon, authenticated;
revoke execute on function public.capture_quest_contest_tasks() from public, anon, authenticated;
revoke execute on function public.capture_quest_contest_anchors() from public, anon, authenticated;
revoke execute on function public.sync_quest_competition_from_progression() from public, anon, authenticated;

-- Defense in depth: a stale friendship row must never override an active block.
drop policy if exists "Read own or connected profiles" on public.quest_profiles;
create policy "Read own or connected profiles"
on public.quest_profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or (
    public.quest_social_interaction_allowed(user_id)
    and exists (
      select 1
      from public.quest_friendships f
      where f.status in ('pending','accepted')
        and (
          (f.requester_id = auth.uid() and f.addressee_id = quest_profiles.user_id)
          or
          (f.addressee_id = auth.uid() and f.requester_id = quest_profiles.user_id)
        )
    )
  )
);

drop policy if exists "Read friend competition stats" on public.quest_competition_stats;
create policy "Read friend competition stats"
on public.quest_competition_stats
for select
to authenticated
using (
  user_id = auth.uid()
  or (
    public.quest_social_interaction_allowed(user_id)
    and exists (
      select 1
      from public.quest_friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = quest_competition_stats.user_id)
          or
          (f.addressee_id = auth.uid() and f.requester_id = quest_competition_stats.user_id)
        )
    )
  )
);
