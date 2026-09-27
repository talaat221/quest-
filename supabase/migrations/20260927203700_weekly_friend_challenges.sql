create table if not exists public.quest_challenges (
  id uuid primary key default gen_random_uuid(),
  week_key date not null,
  creator_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quest_challenge_members (
  challenge_id uuid not null references public.quest_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (challenge_id, user_id)
);

create index if not exists quest_challenges_week_idx on public.quest_challenges(week_key, status);
create index if not exists quest_challenge_members_user_idx on public.quest_challenge_members(user_id, status);

alter table public.quest_challenges enable row level security;
alter table public.quest_challenge_members enable row level security;

revoke all on public.quest_challenges from anon;
revoke all on public.quest_challenge_members from anon;
revoke all on public.quest_challenges from authenticated;
revoke all on public.quest_challenge_members from authenticated;

create or replace function public.create_quest_weekly_challenge(p_week_key date, p_invited_user_ids uuid[])
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := auth.uid();
  v_challenge_id uuid;
  v_invites uuid[];
  v_count integer;
begin
  if v_me is null then raise exception 'You must be signed in.'; end if;
  if p_week_key is null then raise exception 'A challenge week is required.'; end if;

  select coalesce(array_agg(distinct invited_id), '{}'::uuid[]) into v_invites
  from unnest(coalesce(p_invited_user_ids, '{}'::uuid[])) as invited_id
  where invited_id is not null and invited_id <> v_me;

  v_count := coalesce(array_length(v_invites, 1), 0);
  if v_count < 1 or v_count > 3 then raise exception 'Choose between 1 and 3 friends.'; end if;

  if exists (
    select 1 from public.quest_challenge_members m
    join public.quest_challenges c on c.id = m.challenge_id
    where m.user_id = v_me and m.status in ('pending','accepted')
      and c.week_key = p_week_key and c.status = 'active'
  ) then raise exception 'You already have a challenge for this week.'; end if;

  if exists (
    select 1 from unnest(v_invites) as candidate_id
    where not exists (
      select 1 from public.quest_friendships f
      where f.status = 'accepted'
        and ((f.requester_id = v_me and f.addressee_id = candidate_id)
          or (f.addressee_id = v_me and f.requester_id = candidate_id))
    )
  ) then raise exception 'You can only challenge accepted friends.'; end if;

  if exists (
    select 1 from public.quest_challenge_members m
    join public.quest_challenges c on c.id = m.challenge_id
    where m.user_id = any(v_invites) and m.status in ('pending','accepted')
      and c.week_key = p_week_key and c.status = 'active'
  ) then raise exception 'One of those friends is already in a challenge this week.'; end if;

  insert into public.quest_challenges(week_key, creator_id)
  values (p_week_key, v_me) returning id into v_challenge_id;

  insert into public.quest_challenge_members(challenge_id, user_id, status, invited_by, responded_at)
  values (v_challenge_id, v_me, 'accepted', v_me, now());

  insert into public.quest_challenge_members(challenge_id, user_id, status, invited_by)
  select v_challenge_id, invited_id, 'pending', v_me from unnest(v_invites) as invited_id;

  return v_challenge_id;
end;
$$;

create or replace function public.respond_quest_weekly_challenge(p_challenge_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := auth.uid();
  v_week date;
begin
  if v_me is null then raise exception 'You must be signed in.'; end if;

  select c.week_key into v_week
  from public.quest_challenges c
  join public.quest_challenge_members m on m.challenge_id = c.id
  where c.id = p_challenge_id and c.status = 'active'
    and m.user_id = v_me and m.status = 'pending';

  if v_week is null then raise exception 'Challenge invitation not found.'; end if;

  if p_accept and exists (
    select 1 from public.quest_challenge_members m
    join public.quest_challenges c on c.id = m.challenge_id
    where m.user_id = v_me and m.status = 'accepted'
      and c.week_key = v_week and c.status = 'active' and c.id <> p_challenge_id
  ) then raise exception 'You are already in another challenge this week.'; end if;

  update public.quest_challenge_members
  set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where challenge_id = p_challenge_id and user_id = v_me and status = 'pending';
end;
$$;

create or replace function public.cancel_quest_weekly_challenge(p_challenge_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'You must be signed in.'; end if;
  update public.quest_challenges set status = 'cancelled', updated_at = now()
  where id = p_challenge_id and creator_id = v_me and status = 'active';
  if not found then raise exception 'Only the challenge creator can cancel it.'; end if;
end;
$$;

create or replace function public.invite_quest_weekly_challenge_member(p_challenge_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
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
  ) then raise exception 'That friend is already in a challenge this week.'; end if;

  insert into public.quest_challenge_members(challenge_id, user_id, status, invited_by)
  values (p_challenge_id, p_user_id, 'pending', v_me);
end;
$$;

create or replace function public.get_my_quest_weekly_challenge(p_week_key date)
returns jsonb language plpgsql security definer stable set search_path = public, pg_temp as $$
declare
  v_me uuid := auth.uid();
  v_current_id uuid;
  v_current jsonb;
  v_invites jsonb;
begin
  if v_me is null then raise exception 'You must be signed in.'; end if;

  select c.id into v_current_id
  from public.quest_challenges c
  join public.quest_challenge_members m on m.challenge_id = c.id
  where c.week_key = p_week_key and c.status = 'active'
    and m.user_id = v_me and m.status = 'accepted'
  order by c.created_at desc limit 1;

  if v_current_id is not null then
    select jsonb_build_object(
      'id', c.id,
      'weekKey', c.week_key,
      'creatorId', c.creator_id,
      'createdAt', c.created_at,
      'members', coalesce((
        select jsonb_agg(jsonb_build_object(
          'userId', m.user_id,
          'status', m.status,
          'isCreator', m.user_id = c.creator_id,
          'displayName', coalesce(p.display_name, p.username, 'Traveler'),
          'username', coalesce(p.username, ''),
          'scoreXP', s.score_xp,
          'eligibleTasks', s.eligible_tasks,
          'todayXP', s.today_xp,
          'todayTasks', s.today_tasks,
          'focusMinutes', s.focus_minutes,
          'level', coalesce(s.level, 1),
          'statsUpdatedAt', s.updated_at
        ) order by (m.user_id = c.creator_id) desc, m.created_at asc)
        from public.quest_challenge_members m
        left join public.quest_profiles p on p.user_id = m.user_id
        left join public.quest_competition_stats s on s.user_id = m.user_id and s.week_key = c.week_key
        where m.challenge_id = c.id and m.status in ('accepted','pending')
      ), '[]'::jsonb)
    ) into v_current
    from public.quest_challenges c where c.id = v_current_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'weekKey', c.week_key,
    'creatorId', c.creator_id,
    'creatorDisplayName', coalesce(p.display_name, p.username, 'Traveler'),
    'creatorUsername', coalesce(p.username, ''),
    'createdAt', c.created_at,
    'memberCount', (select count(*) from public.quest_challenge_members cm where cm.challenge_id = c.id and cm.status in ('accepted','pending'))
  ) order by c.created_at desc), '[]'::jsonb)
  into v_invites
  from public.quest_challenge_members me
  join public.quest_challenges c on c.id = me.challenge_id and c.status = 'active' and c.week_key = p_week_key
  left join public.quest_profiles p on p.user_id = c.creator_id
  where me.user_id = v_me and me.status = 'pending';

  return jsonb_build_object('current', v_current, 'invites', v_invites);
end;
$$;

revoke all on function public.create_quest_weekly_challenge(date, uuid[]) from public, anon;
revoke all on function public.respond_quest_weekly_challenge(uuid, boolean) from public, anon;
revoke all on function public.cancel_quest_weekly_challenge(uuid) from public, anon;
revoke all on function public.invite_quest_weekly_challenge_member(uuid, uuid) from public, anon;
revoke all on function public.get_my_quest_weekly_challenge(date) from public, anon;
grant execute on function public.create_quest_weekly_challenge(date, uuid[]) to authenticated;
grant execute on function public.respond_quest_weekly_challenge(uuid, boolean) to authenticated;
grant execute on function public.cancel_quest_weekly_challenge(uuid) to authenticated;
grant execute on function public.invite_quest_weekly_challenge_member(uuid, uuid) to authenticated;
grant execute on function public.get_my_quest_weekly_challenge(date) to authenticated;
