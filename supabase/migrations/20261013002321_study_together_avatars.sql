-- Private task details never enter Realtime. Only an owner-readable revision
-- signal is published; clients fetch a newly authorized, shaped snapshot.
create table public.quest_study_avatars (
  user_id uuid primary key references auth.users(id) on delete cascade,
  look_id smallint not null default 0 check (look_id between 0 and 5),
  updated_at timestamptz not null default now()
);
create table public.quest_study_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '24 hours',
  ended_at timestamptz
);
create index quest_study_rooms_host_idx on public.quest_study_rooms(host_id);
create table public.quest_study_members (
  room_id uuid not null references public.quest_study_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('invited','joined','left','declined','removed')),
  seat smallint not null check (seat between 1 and 6),
  joined_at timestamptz,
  last_seen_at timestamptz,
  activity text not null default 'idle' check (activity in ('idle','studying','break','away')),
  share_task boolean not null default false,
  task_name text check (char_length(task_name)<=160),
  elapsed_seconds integer not null default 0 check (elapsed_seconds between 0 and 604800),
  primary key(room_id,user_id),
  check (share_task or task_name is null)
);
create unique index quest_study_reserved_seat on public.quest_study_members(room_id,seat) where status in ('invited','joined');
create unique index quest_study_one_joined_room on public.quest_study_members(user_id) where status='joined';
create index quest_study_members_user_idx on public.quest_study_members(user_id,status);
create table public.quest_study_updates (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1
);
alter table public.quest_study_avatars enable row level security;
alter table public.quest_study_rooms enable row level security;
alter table public.quest_study_members enable row level security;
alter table public.quest_study_updates enable row level security;
revoke all on public.quest_study_avatars, public.quest_study_rooms, public.quest_study_members, public.quest_study_updates from anon,authenticated;
create policy "Own avatar" on public.quest_study_avatars for select to authenticated using (user_id=(select auth.uid()));
create policy "Own hosted rooms" on public.quest_study_rooms for select to authenticated using (host_id=(select auth.uid()));
create policy "Own membership" on public.quest_study_members for select to authenticated using (user_id=(select auth.uid()));
create policy "Own study signal" on public.quest_study_updates for select to authenticated using (user_id=(select auth.uid()));
grant select on public.quest_study_updates to authenticated;

create function quest_private.study_blocked(a uuid,b uuid) returns boolean
language sql stable set search_path='' as $$
  select exists(select 1 from public.quest_user_blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a))
$$;
create function quest_private.study_signal(p_room uuid,p_user uuid default null) returns void
language sql set search_path='' as $$
  insert into public.quest_study_updates(user_id)
    select user_id from public.quest_study_members where room_id=p_room
    union select p_user where p_user is not null
  on conflict(user_id) do update set revision=public.quest_study_updates.revision+1
$$;

create function quest_private.study_snapshot() returns jsonb
language plpgsql stable set search_path='' as $$
declare me uuid:=auth.uid(); r public.quest_study_rooms; room_json jsonb; invitations jsonb; members jsonb;
begin
  select rooms.* into r from public.quest_study_rooms rooms
    join public.quest_study_members m on m.room_id=rooms.id
    where m.user_id=me and m.status='joined' and rooms.ended_at is null and rooms.expires_at>now();
  if found then
    select coalesce(jsonb_agg(jsonb_build_object(
      'userId',m.user_id,'name',coalesce(nullif(p.display_name,''),p.username,'Traveler'),
      'lookId',coalesce(a.look_id,0),'seat',m.seat,'status',m.status,
      'activity',case when m.last_seen_at>now()-interval '65 seconds' then m.activity else 'away' end,
      'lastSeenAt',m.last_seen_at,'elapsedSeconds',m.elapsed_seconds,'shareTask',m.share_task,
      'taskName',case when m.share_task and m.status='joined' and m.last_seen_at>now()-interval '65 seconds' then m.task_name else null end
    ) order by m.seat),'[]') into members
    from public.quest_study_members m
      left join public.quest_profiles p on p.user_id=m.user_id
      left join public.quest_study_avatars a on a.user_id=m.user_id
    where m.room_id=r.id and m.status in ('joined','invited') and not quest_private.study_blocked(me,m.user_id);
    room_json:=jsonb_build_object('id',r.id,'hostId',r.host_id,'expiresAt',r.expires_at,'members',members);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',rooms.id,'hostName',coalesce(nullif(p.display_name,''),p.username,'A friend'),'lookId',coalesce(a.look_id,0),'expiresAt',rooms.expires_at) order by rooms.created_at),'[]') into invitations
  from public.quest_study_members m join public.quest_study_rooms rooms on rooms.id=m.room_id
    left join public.quest_profiles p on p.user_id=rooms.host_id
    left join public.quest_study_avatars a on a.user_id=rooms.host_id
  where m.user_id=me and m.status='invited' and rooms.ended_at is null and rooms.expires_at>now()
    and not quest_private.study_blocked(me,rooms.host_id);
  return jsonb_build_object('lookId',coalesce((select look_id from public.quest_study_avatars where user_id=me),0),
    'room',room_json,'invites',invitations,'serverTime',now());
end $$;

-- This is the sole privileged write boundary. Every branch derives the caller
-- from auth.uid(), locks the room, and validates membership / host ownership.
create function quest_private.study_command(p_action text,p_room uuid,p_target uuid,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); r public.quest_study_rooms; mine public.quest_study_members; free_seat smallint; look smallint; active_room uuid;
begin
  if me is null then raise exception 'Sign in to study together' using errcode='42501'; end if;
  if p_action='read' then return quest_private.study_snapshot(); end if;
  if p_action not in ('avatar','create','invite','accept','decline','remove','leave','end','presence','privacy') then raise exception 'Unknown study action'; end if;
  -- Prevent the same account joining two rooms concurrently, even across tabs.
  perform pg_advisory_xact_lock(hashtextextended(me::text,71531));
  update public.quest_study_members m set status='left',task_name=null,share_task=false,activity='away'
    from public.quest_study_rooms rooms where m.room_id=rooms.id and m.user_id=me and m.status in ('joined','invited')
    and (rooms.ended_at is not null or rooms.expires_at<=now());
  if p_action='avatar' then
    look:=(p_data->>'lookId')::smallint;
    if look is null or look not between 0 and 5 then raise exception 'Choose one of the six characters'; end if;
    insert into public.quest_study_avatars(user_id,look_id) values(me,look)
      on conflict(user_id) do update set look_id=excluded.look_id,updated_at=now();
    select room_id into active_room from public.quest_study_members where user_id=me and status='joined';
    perform quest_private.study_signal(active_room,me);
    return quest_private.study_snapshot();
  end if;
  if p_action='create' then
    if exists(select 1 from public.quest_study_members where user_id=me and status='joined') then raise exception 'Leave your current room before starting another'; end if;
    insert into public.quest_study_rooms(host_id) values(me) returning * into r;
    insert into public.quest_study_members(room_id,user_id,status,seat,joined_at,last_seen_at) values(r.id,me,'joined',1,now(),now());
    perform quest_private.study_signal(r.id,me);
    return quest_private.study_snapshot();
  end if;
  select * into r from public.quest_study_rooms where id=p_room for update;
  if not found or r.ended_at is not null or r.expires_at<=now() then raise exception 'This study session has ended'; end if;
  select * into mine from public.quest_study_members where room_id=p_room and user_id=me;
  if not found or mine.status not in ('invited','joined') then raise exception 'You are not part of this study room' using errcode='42501'; end if;
  if p_action in ('accept','decline') then
    if mine.status<>'invited' then raise exception 'This invitation is no longer available'; end if;
    if p_action='accept' then
      if exists(select 1 from public.quest_study_members where user_id=me and status='joined') then raise exception 'Leave your current room before joining another'; end if;
      if not exists(select 1 from public.quest_friendships f where f.status='accepted' and ((f.requester_id=me and f.addressee_id=r.host_id) or (f.addressee_id=me and f.requester_id=r.host_id))) then raise exception 'You must still be friends with the host'; end if;
      if exists(select 1 from public.quest_study_members m where m.room_id=p_room and m.status='joined' and quest_private.study_blocked(me,m.user_id)) then raise exception 'A blocked account is in this room' using errcode='42501'; end if;
    end if;
    update public.quest_study_members set status=case when p_action='accept' then 'joined' else 'declined' end,
      joined_at=case when p_action='accept' then now() else null end,last_seen_at=now(),share_task=false,task_name=null,activity='idle',elapsed_seconds=0
      where room_id=p_room and user_id=me;
  else
    if mine.status<>'joined' then raise exception 'Accept the invitation first' using errcode='42501'; end if;
    if p_action in ('invite','remove','end') and r.host_id<>me then raise exception 'Only the host can manage invitations or end the room' using errcode='42501'; end if;
    if p_action='invite' then
      if p_target is null or p_target=me then raise exception 'Choose a friend to invite'; end if;
      if not exists(select 1 from public.quest_friendships f where f.status='accepted' and ((f.requester_id=me and f.addressee_id=p_target) or (f.addressee_id=me and f.requester_id=p_target))) then raise exception 'You can invite your accepted Quest friends'; end if;
      if exists(select 1 from public.quest_study_members m where m.room_id=p_room and m.status in ('joined','invited') and quest_private.study_blocked(p_target,m.user_id)) then raise exception 'This friend cannot join this room' using errcode='42501'; end if;
      if exists(select 1 from public.quest_study_members where room_id=p_room and user_id=p_target and status in ('invited','joined')) then raise exception 'This friend already has a seat'; end if;
      select s::smallint into free_seat from generate_series(2,6) s where not exists(select 1 from public.quest_study_members m where m.room_id=p_room and m.seat=s and m.status in ('joined','invited')) order by s limit 1;
      if free_seat is null then raise exception 'Your room is full: you and five friends'; end if;
      insert into public.quest_study_members(room_id,user_id,status,seat) values(p_room,p_target,'invited',free_seat)
        on conflict(room_id,user_id) do update set status='invited',seat=excluded.seat,task_name=null,share_task=false,activity='idle',elapsed_seconds=0,last_seen_at=null;
    elsif p_action='remove' then
      if p_target=me then raise exception 'End the session to leave as host'; end if;
      update public.quest_study_members set status='removed',task_name=null,share_task=false,activity='away' where room_id=p_room and user_id=p_target;
    elsif p_action='end' or (p_action='leave' and r.host_id=me) then
      update public.quest_study_rooms set ended_at=now() where id=p_room;
      update public.quest_study_members set status='left',task_name=null,share_task=false,activity='away' where room_id=p_room;
    elsif p_action='leave' then
      update public.quest_study_members set status='left',task_name=null,share_task=false,activity='away' where room_id=p_room and user_id=me;
    elsif p_action='privacy' then
      update public.quest_study_members set share_task=coalesce((p_data->>'shareTask')::boolean,false),
        task_name=case when coalesce((p_data->>'shareTask')::boolean,false) then nullif(left(trim(p_data->>'taskName'),160),'') else null end
        where room_id=p_room and user_id=me;
    elsif p_action='presence' then
      if coalesce(p_data->>'activity','') not in ('idle','studying','break','away') then raise exception 'Invalid study activity'; end if;
      update public.quest_study_members set activity=p_data->>'activity',last_seen_at=now(),
        elapsed_seconds=least(604800,greatest(0,coalesce((p_data->>'elapsedSeconds')::integer,0))),
        -- A late heartbeat cannot switch privacy back on or resurrect a name.
        task_name=case when share_task and p_data->>'activity'<>'away' then nullif(left(trim(p_data->>'taskName'),160),'') else null end
        where room_id=p_room and user_id=me;
    end if;
  end if;
  perform quest_private.study_signal(p_room,me);
  return quest_private.study_snapshot();
end $$;

create function public.quest_study(p_action text default 'read',p_room uuid default null,p_target uuid default null,p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$
  select quest_private.study_command(p_action,p_room,p_target,p_data)
$$;
revoke all on function quest_private.study_blocked(uuid,uuid),quest_private.study_signal(uuid,uuid),quest_private.study_snapshot(),quest_private.study_command(text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function quest_private.study_command(text,uuid,uuid,jsonb) to authenticated;
revoke all on function public.quest_study(text,uuid,uuid,jsonb) from public,anon;
grant execute on function public.quest_study(text,uuid,uuid,jsonb) to authenticated;

-- Blocking someone also separates any shared room immediately. If the host
-- blocks a guest, the guest leaves; otherwise the blocker leaves the room.
create function quest_private.study_after_block() returns trigger
language plpgsql security definer set search_path='' as $$
declare r record; departing uuid;
begin
  for r in select rooms.id,rooms.host_id from public.quest_study_rooms rooms
    join public.quest_study_members a on a.room_id=rooms.id and a.user_id=new.blocker_id and a.status in ('invited','joined')
    join public.quest_study_members b on b.room_id=rooms.id and b.user_id=new.blocked_id and b.status in ('invited','joined')
    where rooms.ended_at is null and rooms.expires_at>now() for update of rooms
  loop
    departing:=case when r.host_id=new.blocker_id then new.blocked_id else new.blocker_id end;
    update public.quest_study_members set status='removed',share_task=false,task_name=null,activity='away' where room_id=r.id and user_id=departing;
    perform quest_private.study_signal(r.id);
  end loop;
  return new;
end $$;
revoke all on function quest_private.study_after_block() from public,anon,authenticated;
create trigger quest_study_on_block after insert on public.quest_user_blocks for each row execute function quest_private.study_after_block();

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='quest_study_updates') then
    alter publication supabase_realtime add table public.quest_study_updates;
  end if;
end $$;
