create or replace function public.get_my_quest_competition_events(p_since timestamptz default (now() - interval '1 day'))
returns table(event_id uuid, actor_display_name text, xp integer, created_at timestamptz)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select e.id,
         coalesce(nullif(p.username, ''), nullif(p.display_name, ''), 'Traveler') as actor_display_name,
         e.xp,
         e.created_at
  from public.quest_competition_events e
  join public.quest_challenge_members me
    on me.challenge_id = e.challenge_id
   and me.user_id = auth.uid()
   and me.status = 'accepted'
  left join public.quest_profiles p on p.user_id = e.actor_user_id
  where e.actor_user_id <> auth.uid()
    and e.created_at >= coalesce(p_since, now() - interval '1 day')
  order by e.created_at asc;
$$;

revoke all on function public.get_my_quest_competition_events(timestamptz) from public, anon;
grant execute on function public.get_my_quest_competition_events(timestamptz) to authenticated;

create or replace function public.get_quest_competition_push_events(p_user_id uuid, p_since timestamptz default (now() - interval '1 day'))
returns table(event_id uuid, actor_display_name text, xp integer, created_at timestamptz)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select e.id,
         coalesce(nullif(p.username, ''), nullif(p.display_name, ''), 'Traveler') as actor_display_name,
         e.xp,
         e.created_at
  from public.quest_competition_events e
  join public.quest_challenge_members me
    on me.challenge_id = e.challenge_id
   and me.user_id = p_user_id
   and me.status = 'accepted'
  left join public.quest_profiles p on p.user_id = e.actor_user_id
  where e.actor_user_id <> p_user_id
    and e.created_at >= coalesce(p_since, now() - interval '1 day')
  order by e.created_at asc;
$$;

revoke all on function public.get_quest_competition_push_events(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.get_quest_competition_push_events(uuid, timestamptz) to service_role;
