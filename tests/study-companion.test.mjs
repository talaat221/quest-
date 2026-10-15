import test from 'node:test';
import assert from 'node:assert/strict';
import { companionTimer, clampCompanionPosition } from '../src/study-companion.js';
import { memberActivity, memberConnection } from '../src/study-together.js';
import { remainingToday, dueReminders, reminderStillRelevant, normalizeReminders } from '../supabase/functions/_shared/reminders.js';
const stamp=Date.parse('2026-10-15T12:00:00Z');
const fixture=()=>({settings:{dayResetHour:4},anchors:[{id:'a',name:'Walk',hour:16,history:{},activeWeekdays:[4]}],domains:[{id:'q',name:'Study',tasks:[{id:'one',name:'Read',day:'2026-10-15',hour:12,done:false},{id:'two',day:'2026-10-16',done:false}]}]});
test('companion uses elapsed timestamps through suspension, pause and resume',()=>{
 const task={workTimer:{startedAt:new Date(stamp).toISOString(),elapsedMs:30000}};
 assert.equal(companionTimer(task,stamp+123000).text,'02:33');
 task.workTimer={startedAt:null,elapsedMs:153000};assert.equal(companionTimer(task,stamp+999000).text,'02:33');assert.equal(companionTimer(task).action,'Resume');
 task.workTimer.startedAt=new Date(stamp+200000).toISOString();assert.equal(companionTimer(task,stamp+202000).text,'02:35');
 task.done=true;assert.equal(companionTimer(task,stamp+300000).running,false);
});
test('companion focus countdown stops at zero, without automatically completing',()=>{
 const task={workTimer:{startedAt:new Date(stamp).toISOString(),elapsedMs:0,pomodoro:{phase:'focus',focusMinutes:25,remainingMs:1500000,runningSince:new Date(stamp).toISOString()}}};
 assert.equal(companionTimer(task,stamp+60000).text,'24:00');assert.equal(companionTimer(task,stamp+1600000).text,'00:00');assert.equal(companionTimer(task,stamp+1600000).running,false);assert.equal(task.done,undefined);
});
test('presence tolerates background batching and distinguishes a stalled connection',()=>{
 const member={status:'joined',activity:'studying',lastSeenAt:new Date(stamp).toISOString()};
 assert.equal(memberActivity(member,stamp+61000),'studying');assert.equal(memberConnection(member,stamp+90000),'reconnecting');assert.equal(memberActivity(member,stamp+181000),'away');
});
test('drag position remains inside a resized mobile viewport',()=>{
 assert.deepEqual(clampCompanionPosition({x:500,y:-50},{width:320,height:600},{width:290,height:250}),{x:22,y:8});
});
test('badge counts only this quest day, updates after completion/reschedule and resets at 4am',()=>{
 const state=fixture();assert.equal(remainingToday(state,{now:stamp}),2);assert.equal(remainingToday(state,{now:stamp,includeAnchors:false}),1);
 state.domains[0].tasks[0].done=true;assert.equal(remainingToday(state,{now:stamp}),1);
 state.anchors[0].history['2026-10-15']=true;assert.equal(remainingToday(state,{now:stamp}),0);
 state.domains[0].tasks[0].done=false;assert.equal(remainingToday(state,{now:stamp}),1);
 assert.equal(remainingToday(state,{now:Date.parse('2026-10-16T03:59:59Z')}),1);
 assert.equal(remainingToday(state,{now:Date.parse('2026-10-16T04:00:00Z')}),1);
 state.domains[0].tasks[1].day='2026-10-17';assert.equal(remainingToday(state,{now:Date.parse('2026-10-16T04:00:00Z')}),0);
});
test('approaching reminders fire once at chosen lead time and link to exact task',()=>{
 const state=fixture(), options={timezone:'UTC',preferences:{leadMinutes:5}};
 assert.equal(dueReminders(state,{...options,now:stamp-301000}).length,0);
 const event=dueReminders(state,{...options,now:stamp-300000})[0];assert.equal(event.kind,'task');assert.match(event.page,/#study\//);assert.equal(event.target.taskId,'one');
 state.domains[0].tasks[0].done=true;assert.equal(reminderStillRelevant(state,event),false);
 state.domains[0].tasks[0].done=false;state.domains[0].tasks[0].hour=13;assert.equal(reminderStillRelevant(state,event),false);
});
test('paused study nudge is optional, timestamp based and cancels when resumed',()=>{
 const state=fixture(),task=state.domains[0].tasks[0];task.hour=null;task.workTimer={pausedAt:new Date(stamp).toISOString(),elapsedMs:60000};
 assert.equal(dueReminders(state,{now:stamp+1800000}).length,0);
 assert.equal(dueReminders(state,{now:stamp+1800000,preferences:{study:true}})[0].kind,'study');
 task.workTimer.startedAt=new Date(stamp+1750000).toISOString();assert.equal(dueReminders(state,{now:stamp+1800000,preferences:{study:true}}).length,0);
 assert.equal(normalizeReminders({bannerSeconds:500}).bannerSeconds,10);
});
