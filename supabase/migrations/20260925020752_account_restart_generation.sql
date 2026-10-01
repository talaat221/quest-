-- Add account restart support to the existing authenticated sync transaction.
-- Installing this migration does not reset any account or remove user data.
-- Authentication, ownership checks and the legacy mirror remain in the existing
-- RPC. Both account RPCs are callable only by signed-in users and service roles.
ALTER TABLE public.quest_sync_meta
  ADD COLUMN IF NOT EXISTS last_reset_revision bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.apply_my_quest_changes(p_expected_revision bigint, p_changes jsonb, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  current_revision bigint;
  new_revision bigint;
  changed_at timestamptz := now();
  item jsonb;
  profile record;
  sample jsonb;
  key_text text;
  canonical jsonb;
  is_account_reset boolean := coalesce(p_changes->'resetAccount' = 'true'::jsonb, false);
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'Changes payload must be a JSON object';
  end if;

  if is_account_reset and (p_changes->>'resetUserId') is distinct from uid::text then
    raise exception 'Account confirmation does not match the signed-in user';
  end if;
  if is_account_reset and p_expected_revision is null then
    raise exception 'A saved revision is required to restart an account';
  end if;

  insert into public.quest_sync_meta(user_id, revision, updated_at)
  values(uid, 0, changed_at)
  on conflict (user_id) do nothing;

  select revision into current_revision
  from public.quest_sync_meta
  where user_id = uid
  for update;

  if (not p_force or is_account_reset) and p_expected_revision is not null and current_revision <> p_expected_revision then
    raise exception using
      errcode = '40001',
      message = 'QUEST_SYNC_CONFLICT:' || current_revision::text;
  end if;

  -- The caller confirms this account; the row lock and revision check above
  -- keep the entire restart atomic with ordinary saves on other devices.
  if is_account_reset then
    delete from public.quests where user_id = uid;
    -- Owned tasks and timing samples cascade with their quest.
    delete from public.anchors where user_id = uid;
    -- Owned completion history cascades with its anchor.
    delete from public.voyage_adjustments where user_id = uid;
    p_changes := jsonb_build_object(
      'settings', jsonb_build_object('dayThresholdPct',70,'weekThresholdPct',70,'dayResetHour',0),
      'rewards', jsonb_build_object('daily','[]'::jsonb,'weekly','[]'::jsonb),
      'claims', '[]'::jsonb
    );
  end if;

  if p_changes ? 'settings' then
    item := coalesce(p_changes->'settings', '{}'::jsonb);
    insert into public.quest_settings(user_id, day_threshold_pct, week_threshold_pct, day_reset_hour, updated_at)
    values(
      uid,
      coalesce((item->>'dayThresholdPct')::integer, 70),
      coalesce((item->>'weekThresholdPct')::integer, 70),
      coalesce((item->>'dayResetHour')::integer, 0),
      changed_at
    )
    on conflict(user_id) do update set
      day_threshold_pct = excluded.day_threshold_pct,
      week_threshold_pct = excluded.week_threshold_pct,
      day_reset_hour = excluded.day_reset_hour,
      updated_at = excluded.updated_at;
  end if;

  for key_text in
    select value from jsonb_array_elements_text(coalesce(p_changes->'questDeletes','[]'::jsonb))
  loop
    delete from public.quests where user_id = uid and id = key_text;
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(p_changes->'questUpserts','[]'::jsonb))
  loop
    insert into public.quests(user_id,id,name,emoji,color,monthly_target,sort_order,timing_profiles,updated_at)
    values(
      uid,
      item->>'id',
      coalesce(item->>'name','Untitled Quest'),
      item->>'emoji',
      item->>'color',
      greatest(1,coalesce((item->>'monthlyTarget')::integer,1)),
      coalesce((item->>'sortOrder')::integer,0),
      coalesce(item->'timingProfiles','{}'::jsonb),
      changed_at
    )
    on conflict(user_id,id) do update set
      name=excluded.name, emoji=excluded.emoji, color=excluded.color,
      monthly_target=excluded.monthly_target, sort_order=excluded.sort_order,
      timing_profiles=excluded.timing_profiles, updated_at=excluded.updated_at;

    delete from public.timing_samples where user_id=uid and quest_id=item->>'id';

    for profile in
      select key, value from jsonb_each(coalesce(item->'timingProfiles','{}'::jsonb))
    loop
      for sample in
        select value from jsonb_array_elements(coalesce(profile.value->'samples','[]'::jsonb))
      loop
        if nullif(sample->>'actualMinutes','') is not null then
          insert into public.timing_samples(user_id,quest_id,profile_key,task_id,actual_minutes,estimated_minutes,logged_at)
          values(
            uid,
            item->>'id',
            profile.key,
            nullif(sample->>'taskId',''),
            greatest(1,(sample->>'actualMinutes')::integer),
            nullif(sample->>'estimatedMinutes','')::integer,
            coalesce(nullif(sample->>'loggedAt','')::timestamptz, changed_at)
          );
        end if;
      end loop;
    end loop;
  end loop;

  for key_text in
    select value from jsonb_array_elements_text(coalesce(p_changes->'taskDeletes','[]'::jsonb))
  loop
    delete from public.tasks where user_id=uid and id=key_text;
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(p_changes->'taskUpserts','[]'::jsonb))
  loop
    insert into public.tasks(user_id,quest_id,id,name,xp,scheduled_day,scheduled_hour,estimated_minutes,actual_minutes,timing_profile_key,flexibility,done,done_at,sort_order,updated_at)
    values(
      uid,
      item->>'questId',
      item->>'id',
      coalesce(item->>'name','Untitled Task'),
      greatest(1,coalesce((item->>'xp')::integer,10)),
      nullif(item->>'day','')::date,
      nullif(item->>'hour','')::integer,
      nullif(item->>'estimatedMinutes','')::integer,
      nullif(item->>'actualMinutes','')::integer,
      nullif(item->>'timingProfileKey',''),
      case when item->>'flexibility'='fixed' then 'fixed' else 'flexible' end,
      coalesce((item->>'done')::boolean,false),
      nullif(item->>'doneAt','')::timestamptz,
      coalesce((item->>'sortOrder')::integer,0),
      changed_at
    )
    on conflict(user_id,id) do update set
      quest_id=excluded.quest_id, name=excluded.name, xp=excluded.xp,
      scheduled_day=excluded.scheduled_day, scheduled_hour=excluded.scheduled_hour,
      estimated_minutes=excluded.estimated_minutes, actual_minutes=excluded.actual_minutes,
      timing_profile_key=excluded.timing_profile_key, flexibility=excluded.flexibility,
      done=excluded.done, done_at=excluded.done_at, sort_order=excluded.sort_order,
      updated_at=excluded.updated_at;
  end loop;

  for key_text in
    select value from jsonb_array_elements_text(coalesce(p_changes->'anchorDeletes','[]'::jsonb))
  loop
    delete from public.anchors where user_id=uid and id=key_text;
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(p_changes->'anchorUpserts','[]'::jsonb))
  loop
    insert into public.anchors(user_id,id,name,emoji,xp_per_day,category,active_weekdays,scheduled_hour,sort_order,updated_at)
    values(
      uid,
      item->>'id',
      coalesce(item->>'name','Untitled Anchor'),
      item->>'emoji',
      greatest(1,coalesce((item->>'xpPerDay')::integer,1)),
      coalesce(nullif(item->>'category',''),'General'),
      case when jsonb_typeof(item->'activeWeekdays')='array' and jsonb_array_length(item->'activeWeekdays')>0
        then array(select value::smallint from jsonb_array_elements_text(item->'activeWeekdays'))
        else array[1,2,3,4,5,6,7]::smallint[] end,
      nullif(item->>'hour','')::integer,
      coalesce((item->>'sortOrder')::integer,0),
      changed_at
    )
    on conflict(user_id,id) do update set
      name=excluded.name, emoji=excluded.emoji, xp_per_day=excluded.xp_per_day,
      category=excluded.category, active_weekdays=excluded.active_weekdays,
      scheduled_hour=excluded.scheduled_hour, sort_order=excluded.sort_order,
      updated_at=excluded.updated_at;
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(p_changes->'anchorHistoryDeletes','[]'::jsonb))
  loop
    delete from public.anchor_history
    where user_id=uid and anchor_id=item->>'anchorId' and day=(item->>'day')::date;
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(p_changes->'anchorHistoryUpserts','[]'::jsonb))
  loop
    insert into public.anchor_history(user_id,anchor_id,day,completed_at)
    values(uid,item->>'anchorId',(item->>'day')::date,coalesce(nullif(item->>'completedAt','')::timestamptz,changed_at))
    on conflict(user_id,anchor_id,day) do update set completed_at=excluded.completed_at;
  end loop;

  if p_changes ? 'rewards' then
    delete from public.rewards where user_id=uid;
    for item in select value from jsonb_array_elements(coalesce(p_changes->'rewards'->'daily','[]'::jsonb)) loop
      insert into public.rewards(user_id,kind,position,reward_text,updated_at)
      values(uid,'daily',coalesce((item->>'position')::integer,0),coalesce(item->>'text',''),changed_at);
    end loop;
    for item in select value from jsonb_array_elements(coalesce(p_changes->'rewards'->'weekly','[]'::jsonb)) loop
      insert into public.rewards(user_id,kind,position,reward_text,updated_at)
      values(uid,'weekly',coalesce((item->>'position')::integer,0),coalesce(item->>'text',''),changed_at);
    end loop;
  end if;

  if p_changes ? 'claims' then
    delete from public.reward_claims where user_id=uid;
    for item in select value from jsonb_array_elements(coalesce(p_changes->'claims','[]'::jsonb)) loop
      insert into public.reward_claims(user_id,kind,period_key,reward_text,claimed_at)
      values(uid,item->>'kind',item->>'periodKey',coalesce(item->>'rewardText',''),coalesce(nullif(item->>'claimedAt','')::timestamptz,changed_at));
    end loop;
  end if;

  for key_text in
    select value from jsonb_array_elements_text(coalesce(p_changes->'voyageDeletes','[]'::jsonb))
  loop
    delete from public.voyage_adjustments where user_id=uid and day=key_text::date;
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(p_changes->'voyageUpserts','[]'::jsonb))
  loop
    insert into public.voyage_adjustments(user_id,day,mode,capacity_pct,reason,note,protected_key,anchor_plan,active_anchor_ids,planned_minutes,target_minutes,kept_minutes,moved_tasks,kept_tasks,created_at,repaired_at,updated_at)
    values(
      uid,
      (item->>'day')::date,
      case when item->>'mode'='harbor' then 'harbor' else 'reduced' end,
      greatest(0,least(100,coalesce((item->>'capacityPct')::integer,0))),
      item->>'reason', item->>'note', item->>'protectedKey', item->>'anchorPlan',
      case when jsonb_typeof(item->'activeAnchorIds')='array' then array(select jsonb_array_elements_text(item->'activeAnchorIds')) else '{}'::text[] end,
      coalesce((item->>'plannedMinutes')::integer,0),
      coalesce((item->>'targetMinutes')::integer,0),
      coalesce((item->>'keptMinutes')::integer,0),
      coalesce(item->'movedTasks','[]'::jsonb),
      coalesce(item->'keptTasks','[]'::jsonb),
      coalesce(nullif(item->>'createdAt','')::timestamptz,changed_at),
      nullif(item->>'repairedAt','')::timestamptz,
      changed_at
    )
    on conflict(user_id,day) do update set
      mode=excluded.mode, capacity_pct=excluded.capacity_pct, reason=excluded.reason,
      note=excluded.note, protected_key=excluded.protected_key, anchor_plan=excluded.anchor_plan,
      active_anchor_ids=excluded.active_anchor_ids, planned_minutes=excluded.planned_minutes,
      target_minutes=excluded.target_minutes, kept_minutes=excluded.kept_minutes,
      moved_tasks=excluded.moved_tasks, kept_tasks=excluded.kept_tasks,
      created_at=excluded.created_at, repaired_at=excluded.repaired_at,
      updated_at=excluded.updated_at;
  end loop;

  new_revision := current_revision + 1;
  update public.quest_sync_meta
  set revision=new_revision, updated_at=changed_at,
      last_reset_revision=case when is_account_reset then new_revision else last_reset_revision end
  where user_id=uid;

  canonical := public.build_quest_state_for_user(uid);

  perform set_config('quest.skip_normalized_mirror','on',true);
  insert into public.quest_data(user_id,data,updated_at)
  values(uid,canonical,changed_at)
  on conflict(user_id) do update set data=excluded.data, updated_at=excluded.updated_at;

  return jsonb_build_object(
    'data', canonical,
    'revision', new_revision,
    'resetRevision', (select last_reset_revision from public.quest_sync_meta where user_id=uid),
    'updatedAt', to_jsonb(changed_at)
  );
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.apply_my_quest_changes(bigint, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_my_quest_changes(bigint, jsonb, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_quest_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  meta public.quest_sync_meta%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select * into meta from public.quest_sync_meta where user_id = uid;

  return jsonb_build_object(
    'data', public.build_quest_state_for_user(uid),
    'revision', coalesce(meta.revision, 0),
    'resetRevision', coalesce(meta.last_reset_revision, 0),
    'updatedAt', case when meta.updated_at is null then null else to_jsonb(meta.updated_at) end
  );
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_my_quest_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_quest_snapshot() TO authenticated;
