-- Keep all existing rounds and earned XP. New invitations can arrive mid-round.
alter table public.quest_contest_members add column invited_by uuid references auth.users(id) on delete set null;
create index quest_contest_members_inviter_idx on public.quest_contest_members(invited_by);
update public.quest_contest_members m set invited_by=c.creator_id from public.quest_contests c where c.id=m.contest_id and m.user_id<>c.creator_id;

create or replace function public.create_quest_contests(
  p_name text, p_mode text, p_duration text, p_friend_ids uuid[],
  p_prize text default '', p_include_anchors boolean default false, p_share_task_names boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); ids uuid[]; person uuid; cid uuid; result uuid[] := '{}'; amount integer;
begin
  if me is null then raise exception 'Sign in to create a competition.'; end if;
  if p_mode is null or p_mode not in ('league','duel') or p_duration is null or p_duration not in ('week','month') then raise exception 'Choose a league or individual challenge, and a week or month.'; end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 60 or length(coalesce(p_prize,'')) > 160 then raise exception 'Use a short name and a prize of at most 160 characters.'; end if;
  select array_agg(distinct x) into ids from unnest(p_friend_ids) x where x is not null and x <> me;
  amount := coalesce(cardinality(ids),0);
  if amount < 1 or amount > (case when p_mode='league' then 9 else 10 end) then raise exception 'Choose up to 9 friends for a league, or 10 individual opponents.'; end if;
  -- Lock all participants in a stable order to prevent concurrent limit bypasses.
  for person in select x from unnest(array_append(ids,me)) x order by x loop
    perform pg_advisory_xact_lock(hashtextextended('quest-contest:'||person::text,0));
  end loop;
  if exists(select 1 from unnest(ids) x where not exists(select 1 from public.quest_friendships f where f.status='accepted' and ((f.requester_id=me and f.addressee_id=x) or (f.addressee_id=me and f.requester_id=x)))) then raise exception 'Choose friends who have accepted your friend request.'; end if;
  if p_mode='duel' then
    for person in select x from unnest(array_append(ids,me)) x loop
      select count(*) into amount from public.quest_contest_members m join public.quest_contests c on c.id=m.contest_id
        where m.user_id=person and m.status in ('accepted','pending') and c.mode='duel'
        and ((c.status='lobby' and c.created_at>now()-interval '14 days') or (c.status='active' and c.ends_at>now()));
      if amount + (case when person=me then cardinality(ids) else 1 end) > 10 then raise exception 'Each person can have up to 10 open individual challenges.'; end if;
    end loop;
    if exists(select 1 from public.quest_contests c join public.quest_contest_members a on a.contest_id=c.id join public.quest_contest_members b on b.contest_id=c.id
      where c.mode='duel' and a.user_id=me and b.user_id=any(ids) and a.status in ('accepted','pending') and b.status in ('accepted','pending')
      and ((c.status='lobby' and c.created_at>now()-interval '14 days') or (c.status='active' and c.ends_at>now()))) then raise exception 'An individual challenge with one of these friends is already open.'; end if;
  end if;
  for person in select x from unnest(case when p_mode='league' then array[me] else ids end) x loop
    insert into public.quest_contests(creator_id,name,mode,duration,prize,include_anchors)
      values(me,trim(p_name),p_mode,p_duration,trim(coalesce(p_prize,'')),coalesce(p_include_anchors,false)) returning id into cid;
    insert into public.quest_contest_members(contest_id,user_id,status,share_task_names,joined_at) values(cid,me,'accepted',coalesce(p_share_task_names,false),now());
    insert into public.quest_contest_members(contest_id,user_id,status,invited_by)
      select cid,x,'pending',me from unnest(case when p_mode='league' then ids else array[person] end) x;
    result := array_append(result,cid);
  end loop;
  return jsonb_build_object('ids',result);
end; $$;


create or replace function public.invite_quest_contest_members(p_contest_id uuid,p_friend_ids uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); c public.quest_contests; ids uuid[]; occupied integer;
begin
  if me is null then raise exception 'Sign in to invite friends.'; end if;
  select * into c from public.quest_contests where id=p_contest_id for update;
  if c.id is null or c.mode<>'league' or not ((c.status='lobby' and c.created_at>now()-interval '14 days') or (c.status='active' and c.ends_at>now())) then raise exception 'This league is closed to invitations.'; end if;
  if not exists(select 1 from public.quest_contest_members where contest_id=c.id and user_id=me and status='accepted') then raise exception 'Join this league before inviting friends.'; end if;
  select array_agg(distinct x) into ids from unnest(p_friend_ids) x where x is not null and x<>me and not exists(select 1 from public.quest_contest_members m where m.contest_id=c.id and m.user_id=x and m.status in ('accepted','pending'));
  if coalesce(cardinality(ids),0)=0 then raise exception 'Choose a friend who is not already in this league.'; end if;
  select count(*) into occupied from public.quest_contest_members where contest_id=c.id and status in ('accepted','pending');
  if occupied+cardinality(ids)>10 then raise exception 'A league has room for 10 people, including pending invitations.'; end if;
  if exists(select 1 from unnest(ids) x where not exists(select 1 from public.quest_friendships f where f.status='accepted' and ((f.requester_id=me and f.addressee_id=x) or (f.addressee_id=me and f.requester_id=x)))) then raise exception 'Invite friends who have accepted your friend request.'; end if;
  insert into public.quest_contest_members(contest_id,user_id,status,invited_by)
    select c.id,x,'pending',me from unnest(ids) x
    on conflict(contest_id,user_id) do update set status='pending',invited_by=me,share_task_names=false,joined_at=null;
end; $$;

create or replace function public.respond_quest_contest(p_contest_id uuid,p_accept boolean,p_share_task_names boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); c public.quest_contests; inviter uuid;
begin
  if me is null then raise exception 'Sign in to answer an invitation.'; end if;
  select * into c from public.quest_contests where id=p_contest_id for update;
  if c.id is null or not ((c.status='lobby' and c.created_at>now()-interval '14 days') or (c.status='active' and c.ends_at>now())) then raise exception 'This invitation has closed.'; end if;
  select coalesce(invited_by,c.creator_id) into inviter from public.quest_contest_members where contest_id=c.id and user_id=me and status='pending';
  if inviter is null then raise exception 'Invitation not found or already answered.'; end if;
  if p_accept and not exists(select 1 from public.quest_friendships f where f.status='accepted' and ((f.requester_id=me and f.addressee_id=inviter) or (f.addressee_id=me and f.requester_id=inviter))) then raise exception 'Add the person who invited you as a friend before joining.'; end if;
  update public.quest_contest_members set status=case when p_accept then 'accepted' else 'declined' end,share_task_names=coalesce(p_share_task_names,false),joined_at=case when p_accept then now() else null end where contest_id=c.id and user_id=me and status='pending';
end; $$;

create or replace function public.start_quest_contest(p_contest_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); c public.quest_contests; n integer;
begin
  if me is null then raise exception 'Sign in to start a competition.'; end if;
  select * into c from public.quest_contests where id=p_contest_id and creator_id=me for update;
  if c.id is null or c.status<>'lobby' or c.created_at<=now()-interval '14 days' or not exists(select 1 from public.quest_contest_members where contest_id=c.id and user_id=me and status='accepted') then raise exception 'Only the current host can start an open lobby.'; end if;
  select count(*) into n from public.quest_contest_members where contest_id=c.id and status='accepted';
  if n<2 or n>(case when c.mode='league' then 10 else 2 end) then raise exception 'At least two accepted participants are needed.'; end if;
  update public.quest_contests set status='active',starts_at=now(),ends_at=case when duration='week' then now()+interval '7 days' else ((now() at time zone 'UTC')+interval '1 month') at time zone 'UTC' end where id=c.id;
end; $$;

create or replace function public.leave_quest_contest(p_contest_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); c public.quest_contests; next_host uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  select * into c from public.quest_contests where id=p_contest_id for update;
  if c.id is null or c.status='cancelled' or c.ends_at<=now() then raise exception 'This competition has already closed.'; end if;
  update public.quest_contest_members set status='left',share_task_names=false where contest_id=c.id and user_id=me and status in ('accepted','pending');
  if not found then raise exception 'You are not in this competition.'; end if;
  select user_id into next_host from public.quest_contest_members where contest_id=c.id and status='accepted' order by joined_at,user_id limit 1;
  if c.mode='duel' or next_host is null then
    update public.quest_contests set status='cancelled' where id=c.id;
  elsif c.creator_id=me then
    update public.quest_contests set creator_id=next_host where id=c.id;
  end if;
end; $$;

-- Capped routine tasks still count as completed, even when they earn zero XP.
-- Reconciliation is idempotent, so undo/recomplete never awards duplicate points.
create or replace function public.capture_quest_contest_tasks()
returns trigger language plpgsql security definer set search_path='' as $$
declare a record; awards jsonb:=coalesce(new.progression->'taskAwards','{}'::jsonb); stamp timestamptz; points integer;
begin
  if jsonb_typeof(awards)<>'object' then return new; end if;
  update public.quest_contest_entries e set active=false from public.quest_contests c
    where e.contest_id=c.id and c.status='active' and c.ends_at>now() and e.user_id=new.user_id and e.source='task' and e.active and not (awards ? e.source_key);
  for a in select key,value from jsonb_each(awards) loop
    begin
      stamp:=nullif(a.value->>'completedAt','')::timestamptz;
      points:=greatest(0,coalesce((a.value->>'creditedXp')::integer,0));
    exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then continue;
    end;
    if stamp is null or stamp>now()+interval '1 minute' then continue; end if;
    insert into public.quest_contest_entries(contest_id,user_id,source,source_key,task_name,xp,completed_at)
      select c.id,new.user_id,'task',a.key,left(coalesce(a.value->>'taskName','Task'),200),points,stamp
      from public.quest_contests c join public.quest_contest_members m on m.contest_id=c.id
      where m.user_id=new.user_id and m.status='accepted' and c.status='active' and c.ends_at>now()
        and stamp>=c.starts_at and stamp<c.ends_at and stamp>=m.joined_at
      on conflict(contest_id,user_id,source,source_key) do update set active=true,xp=excluded.xp
      where not quest_contest_entries.active or quest_contest_entries.xp<>excluded.xp;
  end loop;
  return new;
end; $$;

revoke all on function public.invite_quest_contest_members(uuid,uuid[]) from public,anon;
grant execute on function public.invite_quest_contest_members(uuid,uuid[]) to authenticated;

-- Business conflicts are HTTP 409, not PostgreSQL serialization failures.
-- SQLSTATE 40001 triggers gateway transaction retries; those can loop instead
-- of returning the actionable conflict to the client.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.apply_my_quest_changes(bigint,jsonb,boolean)'::regprocedure) into definition;
  if position('errcode = ''40001''' in definition)=0 then raise exception 'Unexpected sync function: inspect the conflict branch before applying.'; end if;
  execute replace(definition,'errcode = ''40001''','errcode = ''PT409''');
end; $$;

-- Repair only qualifying saved completions for active rounds. No personal XP,
-- dates, task data, or completed rounds are changed.
update public.quest_settings s set progression=s.progression where exists(
  select 1 from public.quest_contest_members m join public.quest_contests c on c.id=m.contest_id
  where m.user_id=s.user_id and m.status='accepted' and c.status='active' and c.ends_at>now()
);
