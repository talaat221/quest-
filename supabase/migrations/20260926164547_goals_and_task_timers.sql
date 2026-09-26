-- Additive storage only: existing quests, tasks, history and settings stay intact.
-- New data uses the existing owner policies, sync revision lock and reset path.
ALTER TABLE public.quests ADD COLUMN IF NOT EXISTS goals jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(goals) = 'array');
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS work_timer jsonb NOT NULL DEFAULT '{"elapsedMs":0,"startedAt":null}'::jsonb
  CHECK (jsonb_typeof(work_timer) = 'object');

CREATE OR REPLACE FUNCTION public.build_quest_state_for_user(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with settings_json as (
    select jsonb_build_object(
      'dayThresholdPct', qs.day_threshold_pct,
      'weekThresholdPct', qs.week_threshold_pct,
      'dayResetHour', qs.day_reset_hour
    ) as value
    from public.quest_settings qs
    where qs.user_id = p_user_id
  ),
  domains_json as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'name', q.name,
        'emoji', q.emoji,
        'color', q.color,
        'monthlyTarget', q.monthly_target,
        'timingProfiles', q.timing_profiles,
        'goals', q.goals,
        'tasks', coalesce((
          select jsonb_agg(
            jsonb_strip_nulls(jsonb_build_object(
              'id', t.id,
              'name', t.name,
              'xp', t.xp,
              'day', to_jsonb(t.scheduled_day),
              'hour', t.scheduled_hour,
              'estimatedMinutes', t.estimated_minutes,
              'actualMinutes', t.actual_minutes,
              'timingProfileKey', t.timing_profile_key,
              'workTimer', t.work_timer,
              'flexibility', t.flexibility,
              'done', t.done,
              'doneAt', case when t.done_at is null then null else to_jsonb(to_char(t.done_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) end
            )) order by t.sort_order, t.id
          )
          from public.tasks t
          where t.user_id = p_user_id and t.quest_id = q.id
        ), '[]'::jsonb)
      ) order by q.sort_order, q.id
    ), '[]'::jsonb) as value
    from public.quests q
    where q.user_id = p_user_id
  ),
  anchors_json as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'emoji', a.emoji,
        'xpPerDay', a.xp_per_day,
        'category', a.category,
        'activeWeekdays', to_jsonb(a.active_weekdays),
        'hour', a.scheduled_hour,
        'history', coalesce((
          select jsonb_object_agg(ah.day::text, true order by ah.day)
          from public.anchor_history ah
          where ah.user_id = p_user_id and ah.anchor_id = a.id
        ), '{}'::jsonb)
      ) order by a.sort_order, a.id
    ), '[]'::jsonb) as value
    from public.anchors a
    where a.user_id = p_user_id
  ),
  rewards_json as (
    select jsonb_build_object(
      'daily', coalesce((select jsonb_agg(r.reward_text order by r.position) from public.rewards r where r.user_id=p_user_id and r.kind='daily'),'[]'::jsonb),
      'weekly', coalesce((select jsonb_agg(r.reward_text order by r.position) from public.rewards r where r.user_id=p_user_id and r.kind='weekly'),'[]'::jsonb)
    ) as value
  ),
  claimed_json as (
    select jsonb_build_object(
      'daily', coalesce((select jsonb_object_agg(rc.period_key, rc.reward_text order by rc.period_key) from public.reward_claims rc where rc.user_id=p_user_id and rc.kind='daily'),'{}'::jsonb),
      'weekly', coalesce((select jsonb_object_agg(rc.period_key, rc.reward_text order by rc.period_key) from public.reward_claims rc where rc.user_id=p_user_id and rc.kind='weekly'),'{}'::jsonb)
    ) as value
  ),
  voyage_json as (
    select coalesce(jsonb_object_agg(
      va.day::text,
      jsonb_strip_nulls(jsonb_build_object(
        'mode', va.mode,
        'capacityPct', va.capacity_pct,
        'reason', va.reason,
        'note', va.note,
        'protectedKey', va.protected_key,
        'anchorPlan', va.anchor_plan,
        'activeAnchorIds', to_jsonb(va.active_anchor_ids),
        'plannedMinutes', va.planned_minutes,
        'targetMinutes', va.target_minutes,
        'keptMinutes', va.kept_minutes,
        'movedTasks', va.moved_tasks,
        'keptTasks', va.kept_tasks,
        'createdAt', to_jsonb(to_char(va.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
        'repairedAt', case when va.repaired_at is null then null else to_jsonb(to_char(va.repaired_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) end
      )) order by va.day
    ), '{}'::jsonb) as value
    from public.voyage_adjustments va
    where va.user_id = p_user_id
  )
  select jsonb_build_object(
    'domains', (select value from domains_json),
    'anchors', (select value from anchors_json),
    'rewards', (select value from rewards_json),
    'claimed', (select value from claimed_json),
    'voyageAdjustments', (select value from voyage_json),
    'settings', coalesce((select value from settings_json), jsonb_build_object('dayThresholdPct',70,'weekThresholdPct',70,'dayResetHour',0))
  );
$function$;

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
    insert into public.quests(user_id,id,name,emoji,color,monthly_target,sort_order,timing_profiles,goals,updated_at)
    values(
      uid,
      item->>'id',
      coalesce(item->>'name','Untitled Quest'),
      item->>'emoji',
      item->>'color',
      greatest(1,coalesce((item->>'monthlyTarget')::integer,1)),
      coalesce((item->>'sortOrder')::integer,0),
      coalesce(item->'timingProfiles','{}'::jsonb),
      coalesce(item->'goals','[]'::jsonb),
      changed_at
    )
    on conflict(user_id,id) do update set
      name=excluded.name, emoji=excluded.emoji, color=excluded.color,
      monthly_target=excluded.monthly_target, sort_order=excluded.sort_order,
      timing_profiles=excluded.timing_profiles,
      goals=case when item ? 'goals' then excluded.goals else quests.goals end,
      updated_at=excluded.updated_at;

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
    insert into public.tasks(user_id,quest_id,id,name,xp,scheduled_day,scheduled_hour,estimated_minutes,actual_minutes,timing_profile_key,flexibility,done,done_at,sort_order,work_timer,updated_at)
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
      coalesce(item->'workTimer','{"elapsedMs":0,"startedAt":null}'::jsonb),
      changed_at
    )
    on conflict(user_id,id) do update set
      quest_id=excluded.quest_id, name=excluded.name, xp=excluded.xp,
      scheduled_day=excluded.scheduled_day, scheduled_hour=excluded.scheduled_hour,
      estimated_minutes=excluded.estimated_minutes, actual_minutes=excluded.actual_minutes,
      timing_profile_key=excluded.timing_profile_key, flexibility=excluded.flexibility,
      done=excluded.done, done_at=excluded.done_at, sort_order=excluded.sort_order,
      work_timer=case when item ? 'workTimer' then excluded.work_timer else tasks.work_timer end,
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

CREATE OR REPLACE FUNCTION public.sync_quest_normalized(p_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  enriched_domains jsonb;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  -- Old clients omit these new fields. Preserve them by owned quest/task ID
  -- before the legacy full-state mirror replaces rows.
  select coalesce(jsonb_agg(d.domain || jsonb_build_object(
    'goals', coalesce(d.domain->'goals', (select q.goals from public.quests q where q.user_id=uid and q.id=d.domain->>'id'), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(t.task || jsonb_build_object(
      'workTimer', coalesce(t.task->'workTimer', (select old.work_timer from public.tasks old where old.user_id=uid and old.id=t.task->>'id'), '{"elapsedMs":0,"startedAt":null}'::jsonb)
    ) order by t.ord) from jsonb_array_elements(coalesce(d.domain->'tasks','[]'::jsonb)) with ordinality as t(task,ord)), '[]'::jsonb)
  ) order by d.ord), '[]'::jsonb) into enriched_domains
  from jsonb_array_elements(coalesce(p_data->'domains','[]'::jsonb)) with ordinality as d(domain,ord);
  p_data := jsonb_set(p_data, '{domains}', enriched_domains);

  delete from public.voyage_adjustments where user_id = uid;
  delete from public.reward_claims where user_id = uid;
  delete from public.rewards where user_id = uid;
  delete from public.anchor_history where user_id = uid;
  delete from public.anchors where user_id = uid;
  delete from public.tasks where user_id = uid;
  delete from public.timing_samples where user_id = uid;
  delete from public.quests where user_id = uid;
  delete from public.quest_settings where user_id = uid;

  insert into public.quest_settings (user_id, day_threshold_pct, week_threshold_pct, day_reset_hour, updated_at)
  values (
    uid,
    coalesce((p_data->'settings'->>'dayThresholdPct')::integer, 70),
    coalesce((p_data->'settings'->>'weekThresholdPct')::integer, 70),
    coalesce((p_data->'settings'->>'dayResetHour')::integer, 0),
    now()
  );

  insert into public.quests (user_id, id, name, emoji, color, monthly_target, sort_order, timing_profiles, goals, updated_at)
  select
    uid,
    d.domain->>'id',
    coalesce(d.domain->>'name','Untitled Quest'),
    d.domain->>'emoji',
    d.domain->>'color',
    greatest(1, coalesce((d.domain->>'monthlyTarget')::integer,1)),
    d.ord::integer - 1,
    coalesce(d.domain->'timingProfiles','{}'::jsonb),
    coalesce(d.domain->'goals','[]'::jsonb),
    now()
  from jsonb_array_elements(coalesce(p_data->'domains','[]'::jsonb)) with ordinality as d(domain, ord)
  where nullif(d.domain->>'id','') is not null;

  insert into public.tasks (user_id, quest_id, id, name, xp, scheduled_day, scheduled_hour, estimated_minutes, actual_minutes, timing_profile_key, flexibility, done, done_at, sort_order, work_timer, updated_at)
  select
    uid,
    d.domain->>'id',
    t.task->>'id',
    coalesce(t.task->>'name','Untitled Task'),
    greatest(1, coalesce((t.task->>'xp')::integer,10)),
    nullif(t.task->>'day','')::date,
    nullif(t.task->>'hour','')::integer,
    nullif(t.task->>'estimatedMinutes','')::integer,
    nullif(t.task->>'actualMinutes','')::integer,
    nullif(t.task->>'timingProfileKey',''),
    case when t.task->>'flexibility'='fixed' then 'fixed' else 'flexible' end,
    coalesce((t.task->>'done')::boolean,false),
    nullif(t.task->>'doneAt','')::timestamptz,
    t.ord::integer - 1,
    coalesce(t.task->'workTimer','{"elapsedMs":0,"startedAt":null}'::jsonb),
    now()
  from jsonb_array_elements(coalesce(p_data->'domains','[]'::jsonb)) as d(domain)
  cross join lateral jsonb_array_elements(coalesce(d.domain->'tasks','[]'::jsonb)) with ordinality as t(task, ord)
  where nullif(d.domain->>'id','') is not null and nullif(t.task->>'id','') is not null;

  insert into public.anchors (user_id, id, name, emoji, xp_per_day, category, active_weekdays, scheduled_hour, sort_order, updated_at)
  select
    uid,
    a.anchor->>'id',
    coalesce(a.anchor->>'name','Untitled Anchor'),
    a.anchor->>'emoji',
    greatest(1, coalesce((a.anchor->>'xpPerDay')::integer,1)),
    coalesce(nullif(a.anchor->>'category',''),'General'),
    case
      when jsonb_typeof(a.anchor->'activeWeekdays')='array' and jsonb_array_length(a.anchor->'activeWeekdays')>0
        then array(select value::smallint from jsonb_array_elements_text(a.anchor->'activeWeekdays'))
      else array[1,2,3,4,5,6,7]::smallint[]
    end,
    nullif(a.anchor->>'hour','')::integer,
    a.ord::integer - 1,
    now()
  from jsonb_array_elements(coalesce(p_data->'anchors','[]'::jsonb)) with ordinality as a(anchor, ord)
  where nullif(a.anchor->>'id','') is not null;

  insert into public.anchor_history (user_id, anchor_id, day, completed_at)
  select uid, a.anchor->>'id', h.key::date, now()
  from jsonb_array_elements(coalesce(p_data->'anchors','[]'::jsonb)) as a(anchor)
  cross join lateral jsonb_each_text(coalesce(a.anchor->'history','{}'::jsonb)) as h(key,value)
  where h.value='true' and nullif(a.anchor->>'id','') is not null;

  insert into public.timing_samples (user_id, quest_id, profile_key, task_id, actual_minutes, estimated_minutes, logged_at)
  select
    uid,
    d.domain->>'id',
    p.key,
    nullif(s.sample->>'taskId',''),
    greatest(1,(s.sample->>'actualMinutes')::integer),
    nullif(s.sample->>'estimatedMinutes','')::integer,
    coalesce(nullif(s.sample->>'loggedAt','')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_data->'domains','[]'::jsonb)) as d(domain)
  cross join lateral jsonb_each(coalesce(d.domain->'timingProfiles','{}'::jsonb)) as p(key, profile)
  cross join lateral jsonb_array_elements(coalesce(p.profile->'samples','[]'::jsonb)) as s(sample)
  where nullif(d.domain->>'id','') is not null
    and nullif(p.key,'') is not null
    and nullif(s.sample->>'actualMinutes','') is not null;

  insert into public.voyage_adjustments (user_id, day, mode, capacity_pct, reason, note, protected_key, anchor_plan, active_anchor_ids, planned_minutes, target_minutes, kept_minutes, moved_tasks, kept_tasks, created_at, repaired_at, updated_at)
  select
    uid,
    v.key::date,
    case when v.value->>'mode'='harbor' then 'harbor' else 'reduced' end,
    greatest(0,least(100,coalesce((v.value->>'capacityPct')::integer,0))),
    v.value->>'reason',
    v.value->>'note',
    v.value->>'protectedKey',
    v.value->>'anchorPlan',
    case when jsonb_typeof(v.value->'activeAnchorIds')='array'
      then array(select jsonb_array_elements_text(v.value->'activeAnchorIds'))
      else '{}'::text[] end,
    coalesce((v.value->>'plannedMinutes')::integer,0),
    coalesce((v.value->>'targetMinutes')::integer,0),
    coalesce((v.value->>'keptMinutes')::integer,0),
    coalesce(v.value->'movedTasks','[]'::jsonb),
    coalesce(v.value->'keptTasks','[]'::jsonb),
    coalesce(nullif(v.value->>'createdAt','')::timestamptz,now()),
    nullif(v.value->>'repairedAt','')::timestamptz,
    now()
  from jsonb_each(coalesce(p_data->'voyageAdjustments','{}'::jsonb)) as v(key,value);

  insert into public.rewards (user_id, kind, position, reward_text, updated_at)
  select uid, r.kind, x.ord::integer - 1, x.reward_text, now()
  from (values ('daily', p_data->'rewards'->'daily'), ('weekly', p_data->'rewards'->'weekly')) as r(kind, arr)
  cross join lateral jsonb_array_elements_text(coalesce(r.arr,'[]'::jsonb)) with ordinality as x(reward_text, ord);

  insert into public.reward_claims (user_id, kind, period_key, reward_text, claimed_at)
  select uid, c.kind, x.key, x.value, now()
  from (values ('daily', p_data->'claimed'->'daily'), ('weekly', p_data->'claimed'->'weekly')) as c(kind, obj)
  cross join lateral jsonb_each_text(coalesce(c.obj,'{}'::jsonb)) as x(key,value);
end;
$function$;
