-- Real database/RPC verification in one rolled-back transaction. No notifications sent.
begin;
do $$
declare u uuid[]; person uuid; cid uuid; j jsonb; award jsonb; payload jsonb; n integer; blocked boolean; event uuid;
begin
  select array_agg(gen_random_uuid()) into u from generate_series(1,12);
  foreach person in array u loop
    insert into auth.users(id,email,role,aud) values(person,'fixture-'||person||'@example.invalid','authenticated','authenticated');
    insert into public.quest_profiles(user_id,username,display_name) values(person,'f_'||left(replace(person::text,'-',''),12),'Test traveler') on conflict do nothing;
    insert into public.quest_settings(user_id) values(person) on conflict do nothing;
  end loop;
  for n in 2..11 loop insert into public.quest_friendships(requester_id,addressee_id,status) values(u[1],u[n],'accepted'); end loop;
  insert into public.quest_friendships(requester_id,addressee_id,status) values(u[2],u[12],'accepted');
  perform set_config('request.jwt.claim.sub',u[1]::text,true);
  cid:=(public.create_quest_contests('Live league','league','week',u[2:3],'',false,false)->'ids'->>0)::uuid;
  perform set_config('request.jwt.claim.sub',u[2]::text,true);
  perform public.respond_quest_contest(cid,true,false);
  perform set_config('request.jwt.claim.sub',u[1]::text,true);
  perform public.start_quest_contest(cid); -- Third friend is still pending.
  assert (select status='active' from public.quest_contests where id=cid),'Pending invitations must not block a ready league';
  perform set_config('request.jwt.claim.sub',u[2]::text,true);
  perform public.invite_quest_contest_members(cid,array[u[12]]); -- Nonhost invites own friend, not host's friend.
  perform set_config('request.jwt.claim.sub',u[12]::text,true);
  j:=public.get_my_quest_contests();
  assert j->'contests'->0->'activity'='[]'::jsonb,'Pending members cannot read the feed';
  perform public.respond_quest_contest(cid,true,false);
  assert (select status='accepted' from public.quest_contest_members where contest_id=cid and user_id=u[12]),'Mid-round acceptance must work';
  -- now() is constant in this fixture transaction; give joins a stable order.
  update public.quest_contest_members set joined_at=now()-interval '1 second' where contest_id=cid and user_id=u[2];
  perform set_config('request.jwt.claim.sub',u[3]::text,true);
  blocked:=false;
  begin perform public.invite_quest_contest_members(cid,array[u[4]]); exception when raise_exception then blocked:=true; end;
  assert blocked,'Pending member cannot invite';
  perform set_config('request.jwt.claim.sub',u[1]::text,true);
  perform public.invite_quest_contest_members(cid,u[4:9]);
  blocked:=false;
  begin perform public.invite_quest_contest_members(cid,array[u[10]]); exception when raise_exception then blocked:=true; end;
  assert blocked,'Ten-person cap includes pending places';
  perform set_config('request.jwt.claim.sub',u[2]::text,true);
  award:=jsonb_build_object('taskId','first','taskName','PRIVATE TITLE','creditedXp',20,'completedAt',now());
  payload:=jsonb_build_object(
    'settings',jsonb_build_object('progression',jsonb_build_object('taskAwards',jsonb_build_object('q:first',award,'q:capped',jsonb_set(award,'{creditedXp}','0'::jsonb)))),
    'questUpserts',jsonb_build_array(jsonb_build_object('id','q','name','Fixture quest')),
    'taskUpserts',jsonb_build_array(jsonb_build_object('questId','q','id','first','name','PRIVATE TITLE','xp',20,'done',true,'doneAt',now()))
  );
  j:=public.apply_my_quest_changes(null,payload,false);
  assert (select sum(xp)=20 and count(*)=2 from public.quest_contest_entries where user_id=u[2] and contest_id=cid and active),'Saved completion must reach the scoreboard; zero XP still counts';
  assert j->'data'->'settings'->'progression'->'taskAwards'->'q:first'->>'creditedXp'='20','Competition does not inflate personal XP';
  blocked:=false;
  begin perform public.apply_my_quest_changes(9999,payload,false); exception when sqlstate 'PT409' then blocked:=true; end;
  assert blocked,'Business conflicts return PT409 without serialization retry storms';
  perform set_config('request.jwt.claim.sub',u[1]::text,true);
  j:=public.get_my_quest_contests();
  assert j::text not like '%PRIVATE TITLE%','Private task names stay hidden';
  assert (select count(*)=2 from public.get_quest_competition_push_events(u[1],now()-interval '1 minute')),'The background dispatcher can see both new completions';
  assert (select count(*)=2 from public.get_my_quest_competition_events(now()-interval '1 minute')),'The in-app notification RPC sees those completions';
  select id into event from public.quest_contest_entries where contest_id=cid and user_id=u[2] and source_key='q:first';
  update public.quest_settings set progression='{}'::jsonb where user_id=u[2];
  assert (select count(*)=0 from public.quest_contest_entries where contest_id=cid and user_id=u[2] and active),'Undo removes scores and task counts';
  update public.quest_settings set progression=payload->'settings'->'progression' where user_id=u[2];
  assert (select id=event from public.quest_contest_entries where contest_id=cid and user_id=u[2] and source_key='q:first'),'Redo keeps notification identity';
  perform public.leave_quest_contest(cid);
  assert (select status='active' and creator_id=u[2] from public.quest_contests where id=cid),'Host departure transfers the league';
  assert not exists(select 1 from public.get_my_quest_competition_events(now()-interval '1 minute')),'Former member receives no more alerts';
  blocked:=false;
  begin perform public.invite_quest_contest_members(cid,array[u[10]]); exception when raise_exception then blocked:=true; end;
  assert blocked,'Former member cannot invite';
  perform set_config('request.jwt.claim.sub',u[2]::text,true);
  perform public.leave_quest_contest(cid);
  assert (select creator_id=u[12] and status='active' from public.quest_contests where id=cid),'The remaining member can continue and invite others';
  assert not has_function_privilege('anon','public.invite_quest_contest_members(uuid,uuid[])','execute'),'Anonymous invitations denied';
end; $$;
select 'PASS: actual save RPC -> XP + counts -> feed + push events; live invitations, privacy, cap, leaving, conflict status' as result;
rollback;
