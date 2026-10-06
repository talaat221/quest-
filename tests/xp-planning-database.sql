-- Isolated fixtures; caller wraps this file in a transaction and rolls back.
do $$
declare u uuid:=gen_random_uuid(); r jsonb; old_style jsonb; initial jsonb; snapshot jsonb;
begin
  insert into auth.users(id,email,role,aud) values(u,'planner-'||u||'@example.invalid','authenticated','authenticated');
  perform set_config('request.jwt.claim.sub',u::text,true);
  initial:=jsonb_build_object(
    'settings',jsonb_build_object('planning',jsonb_build_object('dailyMinutes',jsonb_build_array(240,0,240,240,240,0,0),'startMinute',540,'endMinute',1260),
      'progression',jsonb_build_object('version',4,'anchorAwards',jsonb_build_object('walk:2026-10-05',jsonb_build_object('creditedXp',35,'dayKey','2026-10-05')))),
    'questUpserts',jsonb_build_array(jsonb_build_object('id','q','name','Fixture')),
    'taskUpserts',jsonb_build_array(jsonb_build_object('questId','q','id','long','name','Long task','xp',85,'effort','high','effortTier','deep','xpSource','effort-duration-v2','estimatedMinutes',240,'plannedWeek','2026-10-05','day','2026-10-06','hour',10.3333333333)),
    'anchorUpserts',jsonb_build_array(jsonb_build_object('id','walk','name','Walk','xpPerDay',35,'estimatedMinutes',60,'effort','normal','xpSource','effort-duration-v2','hour',8.3333333333)),
    'anchorHistoryUpserts',jsonb_build_array(jsonb_build_object('anchorId','walk','day','2026-10-05')));
  r:=public.apply_my_quest_changes(null,initial,false);
  assert r->'data'->'domains'->0->'tasks'->0->>'xp'='85','Long XP retained';
  assert r->'data'->'domains'->0->'tasks'->0->>'effort'='high','Difficulty retained';
  assert r->'data'->'domains'->0->'tasks'->0->>'plannedWeek'='2026-10-05','Weekly task membership retained';
  assert r->'data'->'anchors'->0->>'estimatedMinutes'='60','Anchor duration retained';
  assert r->'data'->'settings'->'planning'->'dailyMinutes'->>1='0','Days off retained';
  assert r->'data'->'settings'->'progression'->'anchorAwards'->'walk:2026-10-05'->>'creditedXp'='35','Level ledger retained';
  -- Older clients omitting the new fields must not erase them.
  old_style:=jsonb_build_object('settings','{}'::jsonb,'taskUpserts',jsonb_build_array(jsonb_build_object('questId','q','id','long','name','Long task','xp',85,'estimatedMinutes',240)),
    'anchorUpserts',jsonb_build_array(jsonb_build_object('id','walk','name','Walk','xpPerDay',35)));
  r:=public.apply_my_quest_changes((r->>'revision')::bigint,old_style,false);
  assert r->'data'->'domains'->0->'tasks'->0->>'effort'='high','Old client preserves effort';
  assert r->'data'->'domains'->0->'tasks'->0->>'plannedWeek'='2026-10-05','Old client preserves planned week';
  assert r->'data'->'anchors'->0->>'estimatedMinutes'='60','Old client preserves anchor duration';
  assert r->'data'->'anchors'->0->>'xpSource'='effort-duration-v2','Old client preserves anchor XP source';
  assert r->'data'->'settings'->'planning'->'dailyMinutes'->>1='0','Old client preserves capacity';
  snapshot:=r->'data';
  snapshot:=jsonb_set(snapshot,'{domains,0,tasks,0}',(snapshot#>'{domains,0,tasks,0}')-'effort'-'effortTier'-'xpSource'-'plannedWeek');
  snapshot:=jsonb_set(snapshot,'{anchors,0}',(snapshot#>'{anchors,0}')-'effort'-'xpSource'-'estimatedMinutes');
  snapshot:=jsonb_set(snapshot,'{settings}',(snapshot->'settings')-'planning');
  perform public.sync_quest_normalized(snapshot);
  r:=public.build_quest_state_for_user(u);
  assert r->'domains'->0->'tasks'->0->>'effort'='high','Full-state mirror preserves effort';
  assert r->'anchors'->0->>'estimatedMinutes'='60','Full-state mirror preserves anchor duration';
  assert r->'settings'->'planning'->'dailyMinutes'->>1='0','Full-state mirror preserves capacity';
  r:=public.apply_my_quest_changes((select revision from public.quest_sync_meta where user_id=u),jsonb_build_object('resetAccount',true,'resetUserId',u),false);
  assert r->'data'->'settings'->'planning'='{}'::jsonb,'Account reset removes planning preferences';
  assert r->'data'->'settings'->'progression'='{}'::jsonb,'Account reset removes award ledger';
end; $$;
select 'PASS: XP, difficulty, weekly scheduling, anchor duration, planning preferences, old-client preservation, account reset' as result;
