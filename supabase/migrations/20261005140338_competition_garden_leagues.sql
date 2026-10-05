-- New rounds coexist with the original weekly challenges; personal XP is unchanged.
create table public.quest_contests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  mode text not null check (mode in ('league','duel')),
  duration text not null check (duration in ('week','month')),
  prize text not null default '' check (char_length(prize) <= 160),
  include_anchors boolean not null default false,
  status text not null default 'lobby' check (status in ('lobby','active','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check ((starts_at is null and ends_at is null) or ends_at > starts_at)
);
create table public.quest_contest_members (
  contest_id uuid not null references public.quest_contests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending','accepted','declined','left')),
  share_task_names boolean not null default false,
  joined_at timestamptz,
  primary key (contest_id,user_id)
);
create index quest_contest_members_user_idx on public.quest_contest_members(user_id,status);
create index quest_contests_creator_idx on public.quest_contests(creator_id);
create table public.quest_contest_entries (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.quest_contests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('task','anchor')),
  source_key text not null,
  task_name text not null default '',
  xp integer not null check (xp >= 0),
  active boolean not null default true,
  completed_at timestamptz not null,
  unique (contest_id,user_id,source,source_key)
);
create index quest_contest_entries_user_idx on public.quest_contest_entries(user_id,source);
create index quest_contest_entries_feed_idx on public.quest_contest_entries(contest_id,completed_at desc);
alter table public.quest_contests enable row level security;
alter table public.quest_contest_members enable row level security;
alter table public.quest_contest_entries enable row level security;
-- RPC-only access is intentional: raw task names never leave the database.
revoke all on public.quest_contests, public.quest_contest_members, public.quest_contest_entries from public,anon,authenticated;
grant all on public.quest_contests, public.quest_contest_members, public.quest_contest_entries to service_role;

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
    insert into public.quest_contest_members(contest_id,user_id,status)
      select cid,x,'pending' from unnest(case when p_mode='league' then ids else array[person] end) x;
    result := array_append(result,cid);
  end loop;
  return jsonb_build_object('ids',result);
end; $$;

create or replace function public.respond_quest_contest(p_contest_id uuid,p_accept boolean,p_share_task_names boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); c public.quest_contests;
begin
  if me is null then raise exception 'Sign in to answer an invitation.'; end if;
  select * into c from public.quest_contests where id=p_contest_id for update;
  if c.id is null or c.status<>'lobby' or c.created_at<=now()-interval '14 days' then raise exception 'This invitation has closed.'; end if;
  if p_accept and not exists(select 1 from public.quest_friendships f where f.status='accepted' and ((f.requester_id=me and f.addressee_id=c.creator_id) or (f.addressee_id=me and f.requester_id=c.creator_id))) then raise exception 'Add the host as a friend before joining.'; end if;
  update public.quest_contest_members set status=case when p_accept then 'accepted' else 'declined' end, share_task_names=coalesce(p_share_task_names,false), joined_at=case when p_accept then now() else null end
    where contest_id=c.id and user_id=me and status='pending';
  if not found then raise exception 'Invitation not found or already answered.'; end if;
end; $$;

create or replace function public.start_quest_contest(p_contest_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); c public.quest_contests; n integer;
begin
  if me is null then raise exception 'Sign in to start a competition.'; end if;
  select * into c from public.quest_contests where id=p_contest_id and creator_id=me for update;
  if c.id is null or c.status<>'lobby' or c.created_at<=now()-interval '14 days' then raise exception 'Only the host can start an open lobby.'; end if;
  if exists(select 1 from public.quest_contest_members where contest_id=c.id and status='pending') then raise exception 'Wait for everyone to accept or decline before starting.'; end if;
  select count(*) into n from public.quest_contest_members where contest_id=c.id and status='accepted';
  if n<2 or n>(case when c.mode='league' then 10 else 2 end) then raise exception 'At least two accepted participants are needed.'; end if;
  update public.quest_contests set status='active', starts_at=now(), ends_at=case when duration='week' then now()+interval '7 days' else ((now() at time zone 'UTC')+interval '1 month') at time zone 'UTC' end where id=c.id;
end; $$;

create or replace function public.set_quest_contest_privacy(p_contest_id uuid,p_share_task_names boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.quest_contest_members set share_task_names=coalesce(p_share_task_names,false)
    where contest_id=p_contest_id and user_id=auth.uid() and status='accepted';
  if not found then raise exception 'Competition membership not found.'; end if;
end; $$;

create or replace function public.leave_quest_contest(p_contest_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); c public.quest_contests;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  select * into c from public.quest_contests where id=p_contest_id for update;
  if c.id is null or c.status='cancelled' or c.ends_at<=now() then raise exception 'This competition has already closed.'; end if;
  update public.quest_contest_members set status='left',share_task_names=false where contest_id=c.id and user_id=me and status in ('accepted','pending');
  if not found then raise exception 'You are not in this competition.'; end if;
  if c.creator_id=me or c.mode='duel' then update public.quest_contests set status='cancelled' where id=c.id; end if;
end; $$;

-- Capture completions from the existing XP ledger. No new client-controlled scoring.
create or replace function public.capture_quest_contest_tasks()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a record; old_awards jsonb := case when tg_op='UPDATE' then coalesce(old.progression->'taskAwards','{}'::jsonb) else '{}'::jsonb end; awards jsonb := coalesce(new.progression->'taskAwards','{}'::jsonb); stamp timestamptz;
begin
  update public.quest_contest_entries e set active=false from public.quest_contests c
    where e.contest_id=c.id and c.status='active' and c.ends_at>now() and e.user_id=new.user_id and e.source='task' and e.active
    and (not (awards ? e.source_key) or coalesce((awards->e.source_key->>'creditedXp')::integer,0)<=0);
  for a in select key,value from jsonb_each(awards) where not (old_awards ? key) and coalesce((value->>'creditedXp')::integer,0)>0 loop
    stamp := nullif(a.value->>'completedAt','')::timestamptz;
    if stamp is null or stamp>now()+interval '1 minute' then continue; end if;
    insert into public.quest_contest_entries(contest_id,user_id,source,source_key,task_name,xp,completed_at)
      select c.id,new.user_id,'task',a.key,left(coalesce(a.value->>'taskName','Task'),200),greatest(0,(a.value->>'creditedXp')::integer),stamp
      from public.quest_contests c join public.quest_contest_members m on m.contest_id=c.id
      where m.user_id=new.user_id and m.status='accepted' and c.status='active' and c.ends_at>now()
        and stamp>=c.starts_at and stamp<c.ends_at and stamp>=m.joined_at
      on conflict (contest_id,user_id,source,source_key) do update set active=true;
  end loop;
  return new;
end; $$;
create trigger capture_quest_contest_tasks after insert or update of progression on public.quest_settings for each row execute function public.capture_quest_contest_tasks();

create or replace function public.capture_quest_contest_anchors()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a public.anchors; k text;
begin
  if tg_op='DELETE' then
    update public.quest_contest_entries e set active=false from public.quest_contests c
      where e.contest_id=c.id and c.status='active' and c.ends_at>now() and e.user_id=old.user_id and e.source='anchor' and e.source_key=old.anchor_id||':'||old.day::text;
    return old;
  end if;
  select * into a from public.anchors where user_id=new.user_id and id=new.anchor_id;
  k := new.anchor_id||':'||new.day::text;
  insert into public.quest_contest_entries(contest_id,user_id,source,source_key,task_name,xp,completed_at)
    select c.id,new.user_id,'anchor',k,left(coalesce(a.name,'Daily anchor'),200),greatest(0,coalesce(a.xp_per_day,0)),new.completed_at
    from public.quest_contests c join public.quest_contest_members m on m.contest_id=c.id
    where m.user_id=new.user_id and m.status='accepted' and c.status='active' and c.include_anchors and c.ends_at>now()
      and new.completed_at>=c.starts_at and new.completed_at<c.ends_at and new.completed_at>=m.joined_at and new.completed_at<=now()+interval '1 minute'
      and new.day>=(c.starts_at at time zone 'UTC')::date-1 and new.day<=(c.ends_at at time zone 'UTC')::date
    on conflict (contest_id,user_id,source,source_key) do update set active=true;
  return new;
end; $$;
create trigger capture_quest_contest_anchors after insert or delete on public.anchor_history for each row execute function public.capture_quest_contest_anchors();

create or replace function public.get_my_quest_contests()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); result jsonb;
begin
  if me is null then raise exception 'Sign in to view competitions.'; end if;
  select coalesce(jsonb_agg(item order by item->>'createdAt' desc),'[]'::jsonb) into result from (
    select jsonb_build_object(
      'id',c.id,'name',c.name,'mode',c.mode,'duration',c.duration,'prize',c.prize,'includeAnchors',c.include_anchors,
      'creatorId',c.creator_id,'myStatus',mine.status,'shareTaskNames',mine.share_task_names,'startsAt',c.starts_at,'endsAt',c.ends_at,'createdAt',c.created_at,
      'phase',case when c.status='cancelled' then 'cancelled' when c.status='active' and c.ends_at<=now() then 'finished' when c.status='lobby' and c.created_at<=now()-interval '14 days' then 'expired' else c.status end,
      'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(nullif(p.display_name,''),p.username,'Traveler'),'username',p.username,'status',m.status,
        'xp',case when mine.status='accepted' and m.status='accepted' then coalesce(s.xp,0) else null end,'tasks',case when mine.status='accepted' and m.status='accepted' then coalesce(s.tasks,0) else null end
      ) order by m.joined_at nulls last,m.user_id),'[]'::jsonb) from public.quest_contest_members m left join public.quest_profiles p on p.user_id=m.user_id
        left join lateral(select sum(e.xp)::integer xp,count(*)::integer tasks from public.quest_contest_entries e where e.contest_id=c.id and e.user_id=m.user_id and e.active) s on true where m.contest_id=c.id),
      'activity',case when mine.status='accepted' then (select coalesce(jsonb_agg(row order by row->>'completedAt' desc),'[]'::jsonb) from (
        select jsonb_build_object('id',e.id,'userId',e.user_id,'name',coalesce(nullif(p.display_name,''),p.username,'Traveler'),'source',e.source,'xp',e.xp,'completedAt',e.completed_at,
          'taskName',case when m.share_task_names or e.user_id=me then nullif(e.task_name,'') else null end) row
        from public.quest_contest_entries e join public.quest_contest_members m on m.contest_id=e.contest_id and m.user_id=e.user_id and m.status='accepted'
          left join public.quest_profiles p on p.user_id=e.user_id where e.contest_id=c.id and e.active order by e.completed_at desc,e.id limit 30
      ) feed) else '[]'::jsonb end
    ) item from public.quest_contests c join public.quest_contest_members mine on mine.contest_id=c.id
    where mine.user_id=me and mine.status in ('accepted','pending') and (c.created_at>now()-interval '100 days' or c.ends_at>now())
  ) rounds;
  return jsonb_build_object('contests',result,'serverTime',now());
end; $$;

-- New notification events use generic wording; private task names cannot leak onto a lock screen.
create or replace function public.quest_contest_notification_events(p_user_id uuid,p_since timestamptz)
returns table(event_id uuid,actor_display_name text,xp integer,created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select distinct on (e.user_id,e.source,e.source_key) e.id,coalesce(nullif(p.username,''),p.display_name,'Traveler'),e.xp,e.completed_at
  from public.quest_contest_entries e join public.quest_contests c on c.id=e.contest_id and c.status='active'
    join public.quest_contest_members me on me.contest_id=e.contest_id and me.user_id=p_user_id and me.status='accepted'
    join public.quest_contest_members actor on actor.contest_id=e.contest_id and actor.user_id=e.user_id and actor.status='accepted'
    left join public.quest_profiles p on p.user_id=e.user_id
  where e.user_id<>p_user_id and e.active and e.completed_at>=greatest(coalesce(p_since,now()-interval '1 day'),now()-interval '1 day')
  order by e.user_id,e.source,e.source_key,e.completed_at,e.id;
$$;
create or replace function public.get_my_quest_competition_events(p_since timestamptz default (now()-interval '1 day'))
returns table(event_id uuid,actor_display_name text,xp integer,created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from public.quest_contest_notification_events(auth.uid(),p_since)
  union all
  select e.id,coalesce(nullif(p.username,''),p.display_name,'Traveler'),e.xp,e.created_at
  from public.quest_competition_events e join public.quest_challenge_members me on me.challenge_id=e.challenge_id and me.user_id=auth.uid() and me.status='accepted'
    join public.quest_challenges c on c.id=e.challenge_id and c.status='active'
    left join public.quest_profiles p on p.user_id=e.actor_user_id
  where e.actor_user_id<>auth.uid() and e.created_at>=greatest(coalesce(p_since,now()-interval '1 day'),now()-interval '1 day') order by created_at;
$$;
create or replace function public.get_quest_competition_push_events(p_user_id uuid,p_since timestamptz default (now()-interval '1 day'))
returns table(event_id uuid,actor_display_name text,xp integer,created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from public.quest_contest_notification_events(p_user_id,p_since)
  union all
  select e.id,coalesce(nullif(p.username,''),p.display_name,'Traveler'),e.xp,e.created_at
  from public.quest_competition_events e join public.quest_challenge_members me on me.challenge_id=e.challenge_id and me.user_id=p_user_id and me.status='accepted'
    join public.quest_challenges c on c.id=e.challenge_id and c.status='active'
    left join public.quest_profiles p on p.user_id=e.actor_user_id
  where e.actor_user_id<>p_user_id and e.created_at>=greatest(coalesce(p_since,now()-interval '1 day'),now()-interval '1 day') order by created_at;
$$;
revoke all on function public.capture_quest_contest_tasks(), public.capture_quest_contest_anchors(), public.quest_contest_notification_events(uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.create_quest_contests(text,text,text,uuid[],text,boolean,boolean),public.respond_quest_contest(uuid,boolean,boolean),public.start_quest_contest(uuid),public.set_quest_contest_privacy(uuid,boolean),public.leave_quest_contest(uuid),public.get_my_quest_contests(),public.get_my_quest_competition_events(timestamptz) from public,anon;
grant execute on function public.create_quest_contests(text,text,text,uuid[],text,boolean,boolean),public.respond_quest_contest(uuid,boolean,boolean),public.start_quest_contest(uuid),public.set_quest_contest_privacy(uuid,boolean),public.leave_quest_contest(uuid),public.get_my_quest_contests(),public.get_my_quest_competition_events(timestamptz) to authenticated;
revoke all on function public.get_quest_competition_push_events(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.get_quest_competition_push_events(uuid,timestamptz) to service_role;
