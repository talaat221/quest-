import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReminder, isQuestURL, safePage, primaryAction, noticeBounds, categoryEnabled} from '../desktop/contract.mjs';
import {dueReminders, reminderStillRelevant} from '../supabase/functions/_shared/reminders.js';
import {startTaskTimer, elapsedTaskMs} from '../src/task-timer.js';
const now = Date.parse('2026-10-21T12:00:00Z');
const event = {key:'task:q:t',title:'Read a chapter',body:'History',kind:'task',target:{domainId:'q',taskId:'t'},page:'#study/%5B%22q%22%2C%22t%22%5D',createdAt:now};
test('desktop bridge rejects stale, malformed and oversized notifications',()=>{
  assert.ok(validateReminder(event,now));
  for (const patch of [{createdAt:now-120001},{createdAt:now+10001},{due:now-120001},{key:''},{title:'a'.repeat(181)},{body:'a'.repeat(501)},{kind:'shell'},{target:{taskId:'t'}},{target:{anchorId:'a',minute:1440}},{title:'bad\0title'}]) assert.equal(validateReminder({...event,...patch},now),null);
  assert.equal(validateReminder({...event,page:'javascript:alert(1)'},now).page,'#home');
  assert.equal(validateReminder({...event,durationMs:Infinity},now).durationMs,10000);
});
test('packaged origin and action routing cannot escape to files or shell URLs',()=>{
  assert.ok(isQuestURL('quest://app/#home'));
  for(const url of ['https://myquests.me','file:///etc/passwd','quest://app.evil/','quest://notice/','quest://x@app/','quest://app:1234/','javascript:alert(1)']) assert.equal(isQuestURL(url),false);
  assert.equal(safePage('#settings/notifications'),'#settings/notifications');
  for(const page of ['https://example.com','#study/../../evil','#study/<script>','#settings/delete-account','file:///etc/passwd']) assert.equal(safePage(page),'#home');
});
test('all reminder categories have appropriate actions and respect their switches',()=>{
  assert.equal(primaryAction(event).label,'Start session');
  assert.equal(primaryAction({...event,kind:'pomodoro',title:'Focus complete — time to rest'}).label,'Start break');
  assert.equal(primaryAction({...event,kind:'pomodoro',title:'Break over — ready when you are'}).label,'Start focus');
  for(const [kind,setting] of [['task','tasks'],['anchor','anchors'],['pomodoro','timers'],['timer','timers'],['study','study'],['review','review'],['competition','friends']]) assert.equal(categoryEnabled({kind},{[setting]:false}),false);
  assert.equal(primaryAction({...event,kind:'timer'}).id,'open');
  assert.equal(primaryAction({kind:'anchor'}).id,'open');
});
test('desktop Start uses the real clock, pauses the previous task and never awards XP itself',()=>{
  const state={settings:{},domains:[{id:'q',tasks:[{id:'t',name:'Read',day:'2026-10-21',hour:12,xp:30,done:false},{id:'old',xp:40,workTimer:{elapsedMs:60000,startedAt:new Date(now-120000).toISOString()}}]}],anchors:[]};
  const reminder=dueReminders(state,{now,timezone:'UTC'}).find(e=>e.target?.taskId==='t');
  assert.ok(reminderStillRelevant(state,reminder));
  assert.equal(startTaskTimer(state.domains,'q','t',now),true);
  assert.equal(startTaskTimer(state.domains,'q','t',now+100),false);
  assert.equal(elapsedTaskMs(state.domains[0].tasks[0],now+90000),90000);
  assert.equal(state.domains[0].tasks[1].workTimer.startedAt,null);
  assert.equal(state.domains[0].tasks[1].workTimer.elapsedMs,180000);
  assert.equal(state.domains[0].tasks[0].xp,30);
  assert.equal(state.domains[0].tasks[0].done,false);
  assert.equal(reminderStillRelevant(state,reminder),false);
});
test('reminder positioning respects another display and usable screen width',()=>{
  assert.deepEqual(noticeBounds({x:1920,y:0,width:1920,height:1080}),{x:2610,y:24,width:540,height:158});
  const small=noticeBounds({x:-320,y:100,width:320,height:720});
  assert.equal(small.width,296); assert.equal(small.x,-308); assert.equal(small.y,124);
});
