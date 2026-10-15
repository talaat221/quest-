-- Generated fixtures only. This transaction never sends a notification and rolls back.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); room uuid; sub uuid; result jsonb; peer jsonb; denied boolean;
begin
  insert into auth.users(id,email,role,aud) values
    (a,'companion-'||a||'@example.invalid','authenticated','authenticated'),
    (b,'companion-'||b||'@example.invalid','authenticated','authenticated');
  insert into public.quest_friendships(requester_id,addressee_id,status) values(a,b,'accepted');
  perform set_config('request.jwt.claim.sub',a::text,true);
  execute 'set local role authenticated';
  result:=public.quest_study('create'); room:=(result->'room'->>'id')::uuid;
  perform public.quest_study('invite',room,b);
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform public.quest_study('accept',room);
  perform public.quest_study('presence',room,null,'{"activity":"studying","elapsedSeconds":100}');
  execute 'reset role';
  update public.quest_study_members set last_seen_at=now()-interval '90 seconds' where room_id=room and user_id=b;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',a::text,true);
  result:=public.quest_study();
  select value into peer from jsonb_array_elements(result->'room'->'members') where value->>'userId'=b::text;
  assert peer->>'activity'='studying','Background batching preserves active studying';
  assert peer->'taskName'='null'::jsonb,'Private task stays hidden';
  execute 'reset role';
  update public.quest_study_members set last_seen_at=now()-interval '181 seconds' where room_id=room and user_id=b;
  execute 'set local role authenticated';
  result:=public.quest_study();
  select value into peer from jsonb_array_elements(result->'room'->'members') where value->>'userId'=b::text;
  assert peer->>'activity'='away','A disconnected peer eventually expires';
  assert not has_table_privilege('authenticated','public.quest_reminder_snoozes','select'),'Snoozes cannot be enumerated by clients';
  assert not has_table_privilege('anon','public.quest_reminder_snoozes','insert'),'Anonymous snoozes denied';
  assert not has_function_privilege('authenticated','public.claim_quest_push(uuid,text)','execute'),'Clients cannot forge delivery claims';
  assert not has_column_privilege('authenticated','public.quest_push_subscriptions','popup_active_until','update'),'Clients cannot suppress native delivery with a forged popup lease';
  assert not has_column_privilege('anon','public.quest_push_subscriptions','popup_owner','update'),'Anonymous clients cannot release another popup window';
  execute 'reset role';
  insert into public.quest_push_subscriptions(user_id,endpoint,subscription,origin) values(a,'https://example.invalid/test-'||a,'{}','https://myquests.me') returning id into sub;
  execute 'set local role service_role';
  update public.quest_push_subscriptions set popup_owner=a,popup_active_until=now()+interval '30 seconds' where id=sub;
  assert (select popup_owner=a and popup_active_until>now() from public.quest_push_subscriptions where id=sub),'Server can renew a short popup lease';
  update public.quest_push_subscriptions set popup_owner=null,popup_active_until=null where id=sub and popup_owner=b;
  assert (select popup_owner=a from public.quest_push_subscriptions where id=sub),'Stale window cannot release newer lease';
  update public.quest_push_subscriptions set popup_owner=null,popup_active_until=null where id=sub and popup_owner=a;
  assert (select popup_active_until is null from public.quest_push_subscriptions where id=sub),'Closing the owning popup releases native delivery';
  assert public.claim_quest_push(sub,'task:test'),'First delivery claims the event';
  assert not public.claim_quest_push(sub,'task:test'),'Concurrent foreground/native duplicate is rejected';
  update public.quest_push_deliveries set state='sent',event_payload='{"kind":"task","title":"Fixture"}' where subscription_id=sub and event_key='task:test';
  assert not public.claim_quest_push(sub,'task:test'),'Delivered event cannot send twice';
  insert into public.quest_reminder_snoozes(subscription_id,original_key,due_at,event_payload) values(sub,'task:test',now()+interval '5 minutes','{"kind":"task"}');
  assert (select count(*)=1 from public.quest_reminder_snoozes where subscription_id=sub),'Server can persist snooze';
  delete from public.quest_push_subscriptions where id=sub;
  assert (select count(*)=0 from public.quest_reminder_snoozes where subscription_id=sub),'Unsubscribe removes pending snoozes';
  execute 'reset role';
end $$;
select 'PASS: presence, privacy, server-only snoozes, popup lease permissions and release, atomic claims, unsubscribe cleanup' as result;
rollback;
