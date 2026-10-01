-- Run with an administrative test connection after the minute-precision migration.
-- A temporary fixture account and every write are rolled back, including on failure.
begin;
do $test$
declare
  fixture_user_id uuid := gen_random_uuid();
  result jsonb;
  snapshot jsonb;
begin
  insert into auth.users(id) values (fixture_user_id);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', fixture_user_id, 'role', 'authenticated')::text, true);
  result := public.apply_my_quest_changes(null, '{
    "questUpserts":[{"id":"minute-quest","name":"Minute precision test","monthlyTarget":1}],
    "taskUpserts":[
      {"id":"minute-task","questId":"minute-quest","name":"10:20 task","day":"2026-09-26","hour":10.333333333333334,"xp":10},
      {"id":"whole-hour","questId":"minute-quest","name":"Old whole-hour task","hour":8,"xp":10},
      {"id":"anytime","questId":"minute-quest","name":"Anytime task","hour":null,"xp":10}
    ],
    "anchorUpserts":[{"id":"minute-anchor","name":"23:59 anchor","hour":23.983333333333334,"xpPerDay":10}]
  }'::jsonb, false);
  if (select round(scheduled_hour * 60) from public.tasks where user_id = fixture_user_id and id = 'minute-task') is distinct from 620 then
    raise exception 'Modern task save lost minutes';
  end if;
  if (select round(scheduled_hour * 60) from public.anchors where user_id = fixture_user_id and id = 'minute-anchor') is distinct from 1439 then
    raise exception 'Modern anchor save lost minutes';
  end if;

  -- Exercise the legacy full-state mirror too, then reload the canonical state.
  perform public.sync_quest_normalized(result->'data');
  snapshot := public.build_quest_state_for_user(fixture_user_id);
  if not exists (select 1 from jsonb_array_elements(snapshot->'domains'->0->'tasks') t
    where t->>'id' = 'minute-task' and round((t->>'hour')::numeric * 60) = 620) then
    raise exception 'Task minute precision failed legacy sync/reload';
  end if;
  if round((snapshot->'anchors'->0->>'hour')::numeric * 60) is distinct from 1439 then
    raise exception 'Anchor minute precision failed legacy sync/reload';
  end if;
  if not exists (select 1 from public.tasks where user_id = fixture_user_id and id = 'whole-hour' and scheduled_hour = 8)
    or not exists (select 1 from public.tasks where user_id = fixture_user_id and id = 'anytime' and scheduled_hour is null) then
    raise exception 'Existing whole-hour/anytime schedules changed';
  end if;

  result := public.apply_my_quest_changes(null, '{
    "taskUpserts":[{"id":"minute-task","questId":"minute-quest","name":"Edited task","hour":10.75,"xp":10}],
    "anchorUpserts":[{"id":"minute-anchor","name":"Edited anchor","hour":0,"xpPerDay":10}]
  }'::jsonb, false);
  if not exists (select 1 from public.tasks where user_id = fixture_user_id and id = 'minute-task' and scheduled_hour = 10.75)
    or not exists (select 1 from public.anchors where user_id = fixture_user_id and id = 'minute-anchor' and scheduled_hour = 0) then
    raise exception 'Editing minute times or midnight failed';
  end if;

  begin
    update public.tasks set scheduled_hour = 24 where user_id = fixture_user_id;
    raise exception 'Tasks accepted an out-of-range hour';
  exception when check_violation then null;
  end;
  begin
    update public.anchors set scheduled_hour = -1 where user_id = fixture_user_id;
    raise exception 'Anchors accepted an out-of-range hour';
  exception when check_violation then null;
  end;
end;
$test$;
rollback;
select 'PASS: modern save, legacy sync, canonical reload, edits, midnight, anytime, whole hours, range checks; fixture rolled back' as result;
