create table if not exists public.quest_competition_events (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.quest_challenges(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  task_key text not null,
  xp integer not null check (xp >= 0),
  created_at timestamptz not null default now(),
  unique (challenge_id, actor_user_id, task_key)
);

create index if not exists quest_competition_events_challenge_created_idx
  on public.quest_competition_events(challenge_id, created_at desc);

alter table public.quest_competition_events enable row level security;
revoke all on public.quest_competition_events from public, anon, authenticated;
grant all on public.quest_competition_events to service_role;

create or replace function public.sync_quest_competition_from_progression()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old jsonb := case when tg_op = 'UPDATE' then coalesce(old.progression, '{}'::jsonb) else '{}'::jsonb end;
  v_new jsonb := coalesce(new.progression, '{}'::jsonb);
  v_week date;
  v_task_xp integer;
  v_tasks integer;
  v_bonus integer;
  v_latest_day date;
  v_today_xp integer;
  v_today_tasks integer;
  v_event record;
  v_challenge uuid;
begin
  for v_week in
    select distinct week_key
    from (
      select nullif(a.value->>'weekKey', '')::date as week_key
      from jsonb_each(coalesce(v_new->'taskAwards', '{}'::jsonb)) a
      union
      select nullif(a.value->>'weekKey', '')::date as week_key
      from jsonb_each(coalesce(v_old->'taskAwards', '{}'::jsonb)) a
    ) weeks
    where week_key is not null
  loop
    select
      coalesce(sum(greatest(0, coalesce((a.value->>'creditedXp')::integer, 0))), 0)::integer,
      (
        count(*) filter (
          where greatest(0, coalesce((a.value->>'creditedXp')::integer, 0)) > 0
            and coalesce(a.value->>'tier', '') <> 'routine'
        )
        + count(distinct (a.value->>'dayKey')) filter (
          where greatest(0, coalesce((a.value->>'creditedXp')::integer, 0)) > 0
            and a.value->>'tier' = 'routine'
        )
      )::integer,
      max(nullif(a.value->>'dayKey', '')::date)
    into v_task_xp, v_tasks, v_latest_day
    from jsonb_each(coalesce(v_new->'taskAwards', '{}'::jsonb)) a
    where nullif(a.value->>'weekKey', '')::date = v_week;

    v_task_xp := coalesce(v_task_xp, 0);
    v_tasks := coalesce(v_tasks, 0);
    v_bonus := greatest(0, coalesce((v_new->'weeklyBonuses'->>v_week::text)::integer, 0));
    v_latest_day := coalesce(v_latest_day, v_week);

    select
      coalesce(sum(greatest(0, coalesce((a.value->>'creditedXp')::integer, 0))), 0)::integer,
      (
        count(*) filter (
          where greatest(0, coalesce((a.value->>'creditedXp')::integer, 0)) > 0
            and coalesce(a.value->>'tier', '') <> 'routine'
        )
        + count(distinct (a.value->>'dayKey')) filter (
          where greatest(0, coalesce((a.value->>'creditedXp')::integer, 0)) > 0
            and a.value->>'tier' = 'routine'
        )
      )::integer
    into v_today_xp, v_today_tasks
    from jsonb_each(coalesce(v_new->'taskAwards', '{}'::jsonb)) a
    where nullif(a.value->>'weekKey', '')::date = v_week
      and nullif(a.value->>'dayKey', '')::date = v_latest_day;

    insert into public.quest_competition_stats(
      user_id, week_key, score_xp, task_xp, consistency_xp, eligible_tasks,
      today_key, today_xp, today_tasks, focus_minutes, level, updated_at
    )
    values (
      new.user_id, v_week, v_task_xp + v_bonus, v_task_xp, v_bonus, v_tasks,
      v_latest_day, coalesce(v_today_xp, 0), coalesce(v_today_tasks, 0),
      coalesce((select s.focus_minutes from public.quest_competition_stats s where s.user_id = new.user_id and s.week_key = v_week), 0),
      coalesce((select s.level from public.quest_competition_stats s where s.user_id = new.user_id and s.week_key = v_week), 1),
      now()
    )
    on conflict (user_id, week_key) do update set
      score_xp = excluded.score_xp,
      task_xp = excluded.task_xp,
      consistency_xp = excluded.consistency_xp,
      eligible_tasks = excluded.eligible_tasks,
      today_key = excluded.today_key,
      today_xp = excluded.today_xp,
      today_tasks = excluded.today_tasks,
      updated_at = now();
  end loop;

  for v_event in
    select a.key as task_key, a.value as award
    from jsonb_each(coalesce(v_new->'taskAwards', '{}'::jsonb)) a
    where not (coalesce(v_old->'taskAwards', '{}'::jsonb) ? a.key)
      and greatest(0, coalesce((a.value->>'creditedXp')::integer, 0)) > 0
      and nullif(a.value->>'weekKey', '') is not null
  loop
    select c.id into v_challenge
    from public.quest_challenges c
    join public.quest_challenge_members m on m.challenge_id = c.id
    where c.status = 'active'
      and c.week_key = (v_event.award->>'weekKey')::date
      and m.user_id = new.user_id
      and m.status = 'accepted'
    order by c.created_at desc
    limit 1;

    if v_challenge is not null then
      insert into public.quest_competition_events(challenge_id, actor_user_id, task_key, xp, created_at)
      values (
        v_challenge,
        new.user_id,
        v_event.task_key,
        greatest(0, coalesce((v_event.award->>'creditedXp')::integer, 0)),
        coalesce(nullif(v_event.award->>'completedAt', '')::timestamptz, now())
      )
      on conflict (challenge_id, actor_user_id, task_key) do nothing;
    end if;
    v_challenge := null;
  end loop;

  return new;
end;
$$;

revoke all on function public.sync_quest_competition_from_progression() from public, anon, authenticated;

drop trigger if exists sync_quest_competition_from_progression on public.quest_settings;
create trigger sync_quest_competition_from_progression
after insert or update of progression on public.quest_settings
for each row execute function public.sync_quest_competition_from_progression();

create or replace function public.get_my_quest_competition_events(p_since timestamptz default (now() - interval '1 day'))
returns table(event_id uuid, actor_display_name text, xp integer, created_at timestamptz)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select e.id,
         coalesce(p.display_name, p.username, 'Traveler') as actor_display_name,
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
         coalesce(p.display_name, p.username, 'Traveler') as actor_display_name,
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

create or replace function public.respond_quest_weekly_challenge(p_challenge_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_week date;
  v_changed integer;
begin
  if v_me is null then raise exception 'You must be signed in.'; end if;

  select c.week_key into v_week
  from public.quest_challenges c
  join public.quest_challenge_members m on m.challenge_id = c.id
  where c.id = p_challenge_id and c.status = 'active'
    and m.user_id = v_me and m.status = 'pending';

  if v_week is null then raise exception 'Challenge invitation not found or already answered.'; end if;

  if p_accept and exists (
    select 1 from public.quest_challenge_members m
    join public.quest_challenges c on c.id = m.challenge_id
    where m.user_id = v_me and m.status = 'accepted'
      and c.week_key = v_week and c.status = 'active' and c.id <> p_challenge_id
  ) then raise exception 'You are already in another challenge this week.'; end if;

  update public.quest_challenge_members
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where challenge_id = p_challenge_id and user_id = v_me and status = 'pending';

  get diagnostics v_changed = row_count;
  if v_changed <> 1 then raise exception 'Challenge response could not be saved. Please refresh and try again.'; end if;

  update public.quest_challenges set updated_at = now() where id = p_challenge_id;
end;
$$;

revoke all on function public.respond_quest_weekly_challenge(uuid, boolean) from public, anon;
grant execute on function public.respond_quest_weekly_challenge(uuid, boolean) to authenticated;

create or replace function public.invite_quest_weekly_challenge_member(p_challenge_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_week date;
  v_member_count integer;
begin
  if v_me is null then raise exception 'You must be signed in.'; end if;
  if p_user_id is null or p_user_id = v_me then raise exception 'Choose a friend.'; end if;

  select week_key into v_week from public.quest_challenges
  where id = p_challenge_id and creator_id = v_me and status = 'active';
  if v_week is null then raise exception 'Only the challenge creator can add rivals.'; end if;

  select count(*) into v_member_count from public.quest_challenge_members
  where challenge_id = p_challenge_id and status in ('accepted','pending');
  if v_member_count >= 4 then raise exception 'This challenge already has four travelers.'; end if;

  if not exists (
    select 1 from public.quest_friendships f
    where f.status = 'accepted'
      and ((f.requester_id = v_me and f.addressee_id = p_user_id)
        or (f.addressee_id = v_me and f.requester_id = p_user_id))
  ) then raise exception 'You can only challenge accepted friends.'; end if;

  if exists (
    select 1 from public.quest_challenge_members
    where challenge_id = p_challenge_id and user_id = p_user_id and status in ('accepted','pending')
  ) then raise exception 'That friend is already in this challenge.'; end if;

  if exists (
    select 1 from public.quest_challenge_members m
    join public.quest_challenges c on c.id = m.challenge_id
    where m.user_id = p_user_id and m.status in ('pending','accepted')
      and c.week_key = v_week and c.status = 'active'
      and c.id <> p_challenge_id
  ) then raise exception 'That friend is already in a challenge this week.'; end if;

  insert into public.quest_challenge_members(challenge_id, user_id, status, invited_by, created_at, responded_at)
  values (p_challenge_id, p_user_id, 'pending', v_me, now(), null)
  on conflict (challenge_id, user_id) do update
    set status = 'pending', invited_by = excluded.invited_by, created_at = now(), responded_at = null
    where public.quest_challenge_members.status = 'declined';

  if not found then raise exception 'That friend could not be invited.'; end if;
  update public.quest_challenges set updated_at = now() where id = p_challenge_id;
end;
$$;

revoke all on function public.invite_quest_weekly_challenge_member(uuid, uuid) from public, anon;
grant execute on function public.invite_quest_weekly_challenge_member(uuid, uuid) to authenticated;

update public.quest_settings set progression = progression;
