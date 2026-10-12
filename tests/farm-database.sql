-- Run after the farm migration inside BEGIN / ROLLBACK. All users are fixtures.
do $$
declare u uuid:=gen_random_uuid(); friend uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid(); r jsonb; d date:=current_date;
begin
  insert into auth.users(id,email,role,aud) values
    (u,'farm-'||u||'@example.invalid','authenticated','authenticated'),
    (friend,'farm-'||friend||'@example.invalid','authenticated','authenticated'),
    (stranger,'farm-'||stranger||'@example.invalid','authenticated','authenticated');
  perform set_config('quest_test.owner',u::text,true);
  perform set_config('quest_test.friend',friend::text,true);
  perform set_config('quest_test.stranger',stranger::text,true);
  perform set_config('request.jwt.claim.sub',u::text,true);
  r:=public.apply_my_quest_changes(null,jsonb_build_object('settings',jsonb_build_object('progression',jsonb_build_object('legacyXP',1000))),false);
  r:=public.quest_farm('read',null,null,null,'UTC');
  assert jsonb_array_length(r->'plants')=1,'Start with one plant';
  assert r->>'readyChests'='0','Earlier XP cannot fill the farm';
  assert r->>'earnedXP'='0','Farm starts at zero new XP';
  assert (r#>>'{care,welcome}')::boolean,'Welcome day protected';
  begin perform public.quest_farm('open',null,null,1,'UTC'); raise exception 'Unearned chest opened';
    exception when raise_exception then if sqlerrm<>'Earn more XP to open this chest' then raise; end if; end;
  update public.quest_settings set progression=progression||'{"legacyXP":2000}'::jsonb where user_id=u;
  for i in 1..10 loop
    r:=public.quest_farm('open',null,null,i,'UTC');
    if i=5 then assert r#>>'{lastChest,rarity}' in ('rare','legendary'),'Fifth chest rare guarantee';end if;
    if i=10 then assert r#>>'{lastChest,rarity}'='legendary','Tenth chest legendary guarantee';end if;
  end loop;
  assert jsonb_array_length(r->'plants')=11,'Automatic planting';
  assert r->>'level'='2','Ten plants unlock the next field';
  r:=public.quest_farm('open',null,null,10,'UTC');
  assert jsonb_array_length(r->'plants')=11,'Idempotent chest retry';
  assert r->>'openedChests'='10','No double-open';
  r:=public.quest_farm('rename',null,'The moon garden',null,'UTC');
  assert r->>'name'='The moon garden','Name retained';
  -- Undo and redo never award another chest at the same XP milestone.
  update public.quest_settings set progression=progression||'{"legacyXP":1950}'::jsonb where user_id=u;
  assert (public.quest_farm('read')->>'readyChests')::int=0,'Undo cannot create a chest';
  update public.quest_settings set progression=progression||'{"legacyXP":2000}'::jsonb where user_id=u;
  assert (public.quest_farm('read')->>'readyChests')::int=0,'Redo cannot create a chest';
  -- Evaluate three closed days: a task, three anchors, then one missed day.
  update public.quest_farms set started_day=d-4,last_care_day=d-4 where user_id=u;
  update public.quest_settings set progression=jsonb_set(progression,'{taskAwards}',jsonb_build_object('q:t',jsonb_build_object('creditedXp',0,'dayKey',d-3))) where user_id=u;
  for i in 1..3 loop
    insert into public.anchors(user_id,id,name) values(u,'a'||i,'Fixture anchor');
    insert into public.anchor_history(user_id,anchor_id,day) values(u,'a'||i,d-2);
  end loop;
  r:=public.quest_farm('read');
  assert jsonb_array_length(r->'plants')=10,'One missed day loses exactly one plant';
  assert jsonb_array_length(r->'careLog')=1,'Task and three anchors protect their days';
  assert jsonb_array_length(public.quest_farm('read')->'plants')=10,'Care penalty not repeated on reload';
  update public.quest_farms set last_care_day=d-2 where user_id=u;
  insert into public.voyage_adjustments(user_id,day,mode) values(u,d-1,'harbor');
  assert jsonb_array_length(public.quest_farm('read')->'plants')=10,'Stop Day protects plants';
  -- Verify saved timezone and daily reset: unfinished local day is never penalized.
  r:=public.quest_farm('read');
  assert r->>'today'=d::text,'Server timezone day';
  update public.quest_farms set timezone='Pacific/Kiritimati' where user_id=u;
  update public.quest_settings set day_reset_hour=4 where user_id=u;
  r:=public.quest_farm('read');
  assert r->>'today'=((now() at time zone 'Pacific/Kiritimati')-interval '4 hours')::date::text,'Local timezone and reset hour';
  update public.quest_farms set timezone='UTC' where user_id=u;
  update public.quest_settings set day_reset_hour=0 where user_id=u;
  assert not has_function_privilege('anon','public.quest_farm(text,uuid,text,integer,text)','execute'),'Anonymous access blocked';
  assert not has_function_privilege('authenticated','quest_private.farm_snapshot(uuid,boolean)','execute'),'Private farm snapshots cannot bypass access checks';
  insert into public.quest_friendships(requester_id,addressee_id,status) values(u,friend,'accepted');
end $$;

set local role authenticated;
do $$
declare u uuid:=current_setting('quest_test.owner')::uuid; r jsonb;
begin
  perform set_config('request.jwt.claim.sub',current_setting('quest_test.friend'),true);
  r:=public.quest_farm('read',u);
  assert r->>'name'='The moon garden','Friend can visit farm';
  assert not (r ?| array['care','careLog','earnedXP','readyChests','timezone','baseline_xp','taskAwards']),'Friend response is display-only';
  assert jsonb_array_length(public.get_quest_farms(array[u]))=1,'Friend summaries load';
  begin perform public.quest_farm('rename',u,'Stolen'); raise exception 'Friend write allowed'; exception when insufficient_privilege then null;end;
  begin perform public.quest_farm('open',u,null,11); raise exception 'Friend chest write allowed'; exception when insufficient_privilege then null;end;
  begin update public.quest_farms set opened_chests=100 where user_id=u;raise exception 'Direct table write allowed';exception when insufficient_privilege then null;end;
  perform set_config('request.jwt.claim.sub',current_setting('quest_test.stranger'),true);
  begin perform public.quest_farm('read',u);raise exception 'Stranger read allowed';exception when insufficient_privilege then null;end;
  assert public.get_quest_farms(array[u])='[]'::jsonb,'Stranger summary excluded';
end $$;
reset role;
do $$
declare u uuid:=current_setting('quest_test.owner')::uuid; member uuid:=current_setting('quest_test.stranger')::uuid; league uuid;
begin
 insert into public.quest_contests(creator_id,name,mode,duration) values(u,'Fixture farm league','league','week') returning id into league;
 insert into public.quest_contest_members(contest_id,user_id,status) values(league,u,'accepted'),(league,member,'pending');
 perform set_config('request.jwt.claim.sub',member::text,true);
 begin perform public.quest_farm('read',u);raise exception 'Pending member read allowed';exception when insufficient_privilege then null;end;
 update public.quest_contest_members set status='accepted' where contest_id=league and user_id=member;
 assert public.quest_farm('read',u)->>'name'='The moon garden','Accepted league members can visit without friendship';
 -- Shared leagues must not bypass either direction of an account block.
 insert into public.quest_user_blocks(blocker_id,blocked_id) values(u,member);
 begin perform public.quest_farm('read',u);raise exception 'Blocked league member read allowed';exception when insufficient_privilege then null;end;
 assert public.get_quest_farms(array[u])='[]'::jsonb,'Blocked farm omitted from summaries';
 delete from public.quest_user_blocks where blocker_id=u and blocked_id=member;
 insert into public.quest_user_blocks(blocker_id,blocked_id) values(member,u);
 begin perform public.quest_farm('read',u);raise exception 'Reverse block read allowed';exception when insufficient_privilege then null;end;
 delete from public.quest_user_blocks where blocker_id=member and blocked_id=u;
 update public.quest_contests set status='cancelled' where id=league;
 begin perform public.quest_farm('read',u);raise exception 'Cancelled league read allowed';exception when insufficient_privilege then null;end;
 update public.quest_contests set status='active' where id=league;
 update public.quest_contest_members set status='left' where contest_id=league and user_id=member;
 begin perform public.quest_farm('read',u);raise exception 'Former member read allowed';exception when insufficient_privilege then null;end;
end $$;
do $$
declare u uuid:=current_setting('quest_test.owner')::uuid;r jsonb;
begin
  perform set_config('request.jwt.claim.sub',u::text,true);
  r:=public.apply_my_quest_changes((select revision from public.quest_sync_meta where user_id=u),jsonb_build_object('resetAccount',true,'resetUserId',u),false);
  assert not exists(select 1 from public.quest_farms where user_id=u),'Account restart clears farm';
  r:=public.quest_farm('read',null,null,null,'UTC');
  assert jsonb_array_length(r->'plants')=1 and r->>'openedChests'='0','Fresh account gets one new seedling';
end $$;
select 'PASS: starting seed, XP chests, idempotency, rarity guarantees, fields, daily care, missed days, rest protection, friend privacy, write security, account reset' as result;
