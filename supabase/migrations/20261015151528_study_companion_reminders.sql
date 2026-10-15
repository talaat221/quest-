-- A three-minute lease tolerates background timer batching without treating
-- switching tabs as leaving. Membership, blocked users and task privacy stay intact.
create or replace function quest_private.study_snapshot() returns jsonb
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
      'activity',case when m.last_seen_at>now()-interval '180 seconds' then m.activity else 'away' end,
      'lastSeenAt',m.last_seen_at,'elapsedSeconds',m.elapsed_seconds,'shareTask',m.share_task,
      'taskName',case when m.share_task and m.status='joined' and m.last_seen_at>now()-interval '180 seconds' then m.task_name else null end
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

-- Per-device snoozes and the canonical event needed by native reminder actions.
alter table public.quest_push_deliveries add column if not exists event_payload jsonb;
create table if not exists public.quest_reminder_snoozes (
  subscription_id uuid not null references public.quest_push_subscriptions(id) on delete cascade,
  original_key text not null,
  due_at timestamptz not null,
  event_payload jsonb not null,
  primary key (subscription_id, original_key)
);
alter table public.quest_reminder_snoozes enable row level security;
revoke all on public.quest_reminder_snoozes from public, anon, authenticated;
grant all on public.quest_reminder_snoozes to service_role;
create index if not exists quest_reminder_snoozes_due_idx on public.quest_reminder_snoozes(due_at);
