create table if not exists public.quest_user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint quest_user_blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists quest_user_blocks_blocked_idx
  on public.quest_user_blocks (blocked_id, blocker_id);

alter table public.quest_user_blocks enable row level security;
revoke all on table public.quest_user_blocks from public, anon, authenticated;

create table if not exists public.quest_user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  reported_user_id uuid references auth.users(id) on delete set null,
  reported_username text,
  reported_display_name text,
  reason_code text not null check (
    reason_code in (
      'harassment',
      'impersonation',
      'cheating',
      'spam',
      'inappropriate_content',
      'privacy_safety',
      'other'
    )
  ),
  details text check (char_length(details) <= 1000),
  context_type text not null default 'friends' check (
    context_type in ('friends', 'competition', 'profile', 'other')
  ),
  context_id uuid,
  status text not null default 'open' check (
    status in ('open', 'reviewing', 'actioned', 'dismissed')
  ),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  moderator_notes text
);

create index if not exists quest_user_reports_moderation_idx
  on public.quest_user_reports (status, created_at desc);
create index if not exists quest_user_reports_target_idx
  on public.quest_user_reports (reported_user_id, created_at desc);
create index if not exists quest_user_reports_reporter_rate_idx
  on public.quest_user_reports (reporter_id, created_at desc);

alter table public.quest_user_reports enable row level security;
revoke all on table public.quest_user_reports from public, anon, authenticated;

create or replace function public.block_quest_user(p_blocked_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  rec record;
begin
  if me is null then raise exception 'Sign in to block a user.'; end if;
  if p_blocked_id is null or p_blocked_id = me then raise exception 'Choose another Quest user.'; end if;
  if not exists (select 1 from auth.users u where u.id = p_blocked_id) then
    raise exception 'That Quest user no longer exists.';
  end if;

  insert into public.quest_user_blocks(blocker_id, blocked_id)
  values (me, p_blocked_id)
  on conflict do nothing;

  delete from public.quest_friendships f
  where (f.requester_id = me and f.addressee_id = p_blocked_id)
     or (f.requester_id = p_blocked_id and f.addressee_id = me);

  update public.quest_contest_members m
  set status = 'declined', share_task_names = false, joined_at = null
  where m.status = 'pending'
    and ((m.user_id = me and m.invited_by = p_blocked_id)
      or (m.user_id = p_blocked_id and m.invited_by = me));

  update public.quest_challenge_members m
  set status = 'declined', responded_at = now()
  where m.status = 'pending'
    and ((m.user_id = me and m.invited_by = p_blocked_id)
      or (m.user_id = p_blocked_id and m.invited_by = me));

  for rec in
    select distinct c.id, c.mode, c.creator_id
    from public.quest_contests c
    join public.quest_contest_members mine
      on mine.contest_id = c.id and mine.user_id = me and mine.status = 'accepted'
    join public.quest_contest_members theirs
      on theirs.contest_id = c.id and theirs.user_id = p_blocked_id and theirs.status = 'accepted'
    where (c.status = 'lobby' and c.created_at > now() - interval '14 days')
       or (c.status = 'active' and c.ends_at > now())
  loop
    if rec.mode = 'duel' then
      update public.quest_contests set status = 'cancelled' where id = rec.id;
    elsif rec.creator_id = me then
      update public.quest_contest_members
      set status = 'left', share_task_names = false
      where contest_id = rec.id and user_id = p_blocked_id and status = 'accepted';
    else
      update public.quest_contest_members
      set status = 'left', share_task_names = false
      where contest_id = rec.id and user_id = me and status = 'accepted';
    end if;
  end loop;

  for rec in
    select distinct c.id, c.creator_id
    from public.quest_challenges c
    join public.quest_challenge_members mine
      on mine.challenge_id = c.id and mine.user_id = me and mine.status = 'accepted'
    join public.quest_challenge_members theirs
      on theirs.challenge_id = c.id and theirs.user_id = p_blocked_id and theirs.status = 'accepted'
    where c.status = 'active'
  loop
    if rec.creator_id = me then
      update public.quest_challenge_members
      set status = 'left', responded_at = now()
      where challenge_id = rec.id and user_id = p_blocked_id and status = 'accepted';
    else
      update public.quest_challenge_members
      set status = 'left', responded_at = now()
      where challenge_id = rec.id and user_id = me and status = 'accepted';
    end if;
    update public.quest_challenges set updated_at = now() where id = rec.id;
  end loop;
end;
$$;

create or replace function public.unblock_quest_user(p_blocked_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in to unblock a user.'; end if;
  delete from public.quest_user_blocks where blocker_id = me and blocked_id = p_blocked_id;
end;
$$;

create or replace function public.get_my_quest_blocks()
returns table (blocked_id uuid, username text, display_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.blocked_id, p.username, p.display_name, b.created_at
  from public.quest_user_blocks b
  left join public.quest_profiles p on p.user_id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

create or replace function public.report_quest_user(
  p_reported_user_id uuid,
  p_reason_code text,
  p_details text default null,
  p_context_type text default 'friends',
  p_context_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  report_id uuid;
  snap_username text;
  snap_display_name text;
  clean_details text := nullif(trim(coalesce(p_details, '')), '');
begin
  if me is null then raise exception 'Sign in to report a user.'; end if;
  if p_reported_user_id is null or p_reported_user_id = me then raise exception 'Choose another Quest user.'; end if;
  if p_reason_code not in ('harassment','impersonation','cheating','spam','inappropriate_content','privacy_safety','other') then
    raise exception 'Choose a valid report reason.';
  end if;
  if p_context_type not in ('friends','competition','profile','other') then
    raise exception 'Choose a valid report context.';
  end if;
  if char_length(coalesce(clean_details, '')) > 1000 then raise exception 'Keep report details under 1000 characters.'; end if;
  if not exists (select 1 from auth.users u where u.id = p_reported_user_id) then
    raise exception 'That Quest user no longer exists.';
  end if;

  if (select count(*) from public.quest_user_reports r where r.reporter_id = me and r.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'You have sent several reports today. Please contact support if something urgent is happening.';
  end if;

  if exists (
    select 1 from public.quest_user_reports r
    where r.reporter_id = me
      and r.reported_user_id = p_reported_user_id
      and r.reason_code = p_reason_code
      and r.created_at > now() - interval '1 hour'
  ) then
    raise exception 'You already sent a similar report recently.';
  end if;

  select p.username, p.display_name into snap_username, snap_display_name
  from public.quest_profiles p where p.user_id = p_reported_user_id;

  insert into public.quest_user_reports(
    reporter_id, reported_user_id, reported_username, reported_display_name,
    reason_code, details, context_type, context_id
  )
  values (
    me, p_reported_user_id, snap_username, snap_display_name,
    p_reason_code, clean_details, p_context_type, p_context_id
  )
  returning id into report_id;

  return report_id;
end;
$$;

create or replace function public.enforce_quest_friendship_blocks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('pending', 'accepted') and exists (
    select 1 from public.quest_user_blocks b
    where (b.blocker_id = new.requester_id and b.blocked_id = new.addressee_id)
       or (b.blocker_id = new.addressee_id and b.blocked_id = new.requester_id)
  ) then
    raise exception 'This friendship is unavailable.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_quest_friendship_blocks on public.quest_friendships;
create trigger enforce_quest_friendship_blocks
before insert or update on public.quest_friendships
for each row execute function public.enforce_quest_friendship_blocks();

create or replace function public.enforce_quest_competition_blocks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status not in ('pending', 'accepted') then return new; end if;

  if tg_table_name = 'quest_contest_members' then
    if exists (
      select 1
      from public.quest_contest_members m
      join public.quest_user_blocks b
        on ((b.blocker_id = new.user_id and b.blocked_id = m.user_id)
         or (b.blocker_id = m.user_id and b.blocked_id = new.user_id))
      where m.contest_id = new.contest_id
        and m.user_id <> new.user_id
        and m.status in ('pending', 'accepted')
    ) then
      raise exception 'A blocked user cannot join the same competition.';
    end if;
  elsif tg_table_name = 'quest_challenge_members' then
    if exists (
      select 1
      from public.quest_challenge_members m
      join public.quest_user_blocks b
        on ((b.blocker_id = new.user_id and b.blocked_id = m.user_id)
         or (b.blocker_id = m.user_id and b.blocked_id = new.user_id))
      where m.challenge_id = new.challenge_id
        and m.user_id <> new.user_id
        and m.status in ('pending', 'accepted')
    ) then
      raise exception 'A blocked user cannot join the same challenge.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_quest_contest_blocks on public.quest_contest_members;
create trigger enforce_quest_contest_blocks
before insert or update on public.quest_contest_members
for each row execute function public.enforce_quest_competition_blocks();

drop trigger if exists enforce_quest_challenge_blocks on public.quest_challenge_members;
create trigger enforce_quest_challenge_blocks
before insert or update on public.quest_challenge_members
for each row execute function public.enforce_quest_competition_blocks();

create or replace function public.search_quest_profiles(query_text text)
returns table(user_id uuid, username text, display_name text)
language sql
stable
security definer
set search_path = 'public'
as $$
  select p.user_id, p.username, p.display_name
  from public.quest_profiles p
  where auth.uid() is not null
    and p.user_id <> auth.uid()
    and length(trim(coalesce(query_text,''))) >= 2
    and not exists (
      select 1 from public.quest_user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.user_id)
         or (b.blocker_id = p.user_id and b.blocked_id = auth.uid())
    )
    and (p.username ilike '%' || trim(query_text) || '%' or p.display_name ilike '%' || trim(query_text) || '%')
  order by case when p.username = lower(trim(query_text)) then 0 else 1 end, p.username
  limit 20;
$$;

drop policy if exists "Send own friend requests" on public.quest_friendships;
create policy "Send own friend requests"
on public.quest_friendships
for insert
to authenticated
with check (
  requester_id = auth.uid()
  and addressee_id <> auth.uid()
  and status = 'pending'
  and not exists (
    select 1 from public.quest_user_blocks b
    where (b.blocker_id = requester_id and b.blocked_id = addressee_id)
       or (b.blocker_id = addressee_id and b.blocked_id = requester_id)
  )
);

revoke all on function public.block_quest_user(uuid) from public;
revoke all on function public.unblock_quest_user(uuid) from public;
revoke all on function public.get_my_quest_blocks() from public;
revoke all on function public.report_quest_user(uuid,text,text,text,uuid) from public;

grant execute on function public.block_quest_user(uuid) to authenticated;
grant execute on function public.unblock_quest_user(uuid) to authenticated;
grant execute on function public.get_my_quest_blocks() to authenticated;
grant execute on function public.report_quest_user(uuid,text,text,text,uuid) to authenticated;
