-- Hosts may leave without interrupting friends. Invites from a departing host
-- are cancelled; the new host invites their own friends under existing rules.
create function quest_private.study_depart(p_room uuid,p_user uuid) returns void
language plpgsql set search_path='' as $$
declare r public.quest_study_rooms; successor uuid;
begin
  select * into r from public.quest_study_rooms where id=p_room for update;
  if not found then return; end if;
  update public.quest_study_members set status='left',task_name=null,share_task=false,activity='away'
    where room_id=p_room and user_id=p_user and status='joined';
  if r.host_id=p_user then
    select user_id into successor from public.quest_study_members
      where room_id=p_room and status='joined' order by joined_at,seat limit 1;
    if successor is not null then
      update public.quest_study_rooms set host_id=successor where id=p_room;
      update public.quest_study_members set status='removed',task_name=null,share_task=false,activity='away'
        where room_id=p_room and status='invited';
    else
      update public.quest_study_rooms set ended_at=now() where id=p_room;
      update public.quest_study_members set status='left',task_name=null,share_task=false,activity='away' where room_id=p_room;
    end if;
  end if;
  perform quest_private.study_signal(p_room,p_user);
end $$;
revoke all on function quest_private.study_depart(uuid,uuid) from public,anon,authenticated;

create or replace function quest_private.study_command(p_action text,p_room uuid,p_target uuid,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); r public.quest_study_rooms; mine public.quest_study_members; free_seat smallint; look smallint; active_room uuid;
begin
  if me is null then raise exception 'Sign in to study together' using errcode='42501'; end if;
  if p_action='read' then return quest_private.study_snapshot(); end if;
  if p_action not in ('avatar','create','new_room','invite','accept','decline','remove','leave','end','presence','privacy') then raise exception 'Unknown study action'; end if;
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
  if p_action='new_room' then
    select room_id into active_room from public.quest_study_members where user_id=me and status='joined';
    -- A stale tab must not replace a different room opened on another device.
    if active_room is not null and active_room is distinct from p_room then
      raise exception 'Your room changed. Refresh before starting another.';
    end if;
    if active_room is not null then perform quest_private.study_depart(active_room,me); end if;
  end if;
  if p_action in ('create','new_room') then
    if exists(select 1 from public.quest_study_members where user_id=me and status='joined') then raise exception 'Leave your current room before starting another'; end if;
    insert into public.quest_study_rooms(host_id) values(me) returning * into r;
    insert into public.quest_study_members(room_id,user_id,status,seat,joined_at,last_seen_at) values(r.id,me,'joined',1,now(),now());
    perform quest_private.study_signal(r.id,me);
    return quest_private.study_snapshot();
  end if;
  select * into r from public.quest_study_rooms where id=p_room for update;
  if not found or r.ended_at is not null or r.expires_at<=now() then
    if p_action='leave' then return quest_private.study_snapshot(); end if;
    raise exception 'This study session has ended';
  end if;
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
      select s::smallint into free_seat from generate_series(1,6) s where not exists(select 1 from public.quest_study_members m where m.room_id=p_room and m.seat=s and m.status in ('joined','invited')) order by s limit 1;
      if free_seat is null then raise exception 'Your room is full: you and five friends'; end if;
      insert into public.quest_study_members(room_id,user_id,status,seat) values(p_room,p_target,'invited',free_seat)
        on conflict(room_id,user_id) do update set status='invited',seat=excluded.seat,task_name=null,share_task=false,activity='idle',elapsed_seconds=0,last_seen_at=null;
    elsif p_action='remove' then
      if p_target=me then raise exception 'End the session to leave as host'; end if;
      update public.quest_study_members set status='removed',task_name=null,share_task=false,activity='away' where room_id=p_room and user_id=p_target;
    elsif p_action='end' then
      update public.quest_study_rooms set ended_at=now() where id=p_room;
      update public.quest_study_members set status='left',task_name=null,share_task=false,activity='away' where room_id=p_room;
    elsif p_action='leave' then
      perform quest_private.study_depart(p_room,me);
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
