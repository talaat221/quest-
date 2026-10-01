import test from 'node:test';
import assert from 'node:assert/strict';
import { dueReminders, zonedTime } from '../supabase/functions/_shared/reminders.js';
import { startTaskTimer, pauseTaskTimer, configureTaskPomodoro, completeTimedTask } from '../src/task-timer.js';
const at = text => Date.parse(text);
const fixture = () => ({settings:{dayResetHour:0}, anchors:[{id:'gym',name:'Gym',hour:13,activeWeekdays:[6],history:{}}], domains:[{id:'film',name:'Film',tasks:[{id:'edit',name:'Edit',hour:13,day:'2026-09-26',estimatedMinutes:10,done:false}]}], voyageAdjustments:{}});
const events = (state, stamp, extras={}) => dueReminders(state,{now:at(stamp),timezone:'Africa/Cairo',...extras});
test('no early reminders; exactly due uses Cairo daylight-saving time', () => {
  const state=fixture();
  assert.equal(events(state,'2026-09-26T09:59:59Z').length,0);
  assert.deepEqual(events(state,'2026-09-26T10:00:00Z').map(x=>x.kind),['anchor','task']);
  assert.equal(events(state,'2026-09-26T10:03:00Z').length,0);
});
test('completion, missing time, wrong weekday and active timer suppress start reminders', () => {
  const state=fixture(); state.anchors[0].history['2026-09-26']=true; state.domains[0].tasks[0].done=true;
  assert.equal(events(state,'2026-09-26T10:00:00Z').length,0);
  state.anchors[0].history={}; state.anchors[0].activeWeekdays=[1]; state.domains[0].tasks[0].done=false; state.domains[0].tasks[0].hour=null;
  assert.equal(events(state,'2026-09-26T10:00:00Z').length,0);
  state.domains[0].tasks[0].hour=13; startTaskTimer(state.domains,'film','edit',at('2026-09-26T09:59:00Z'));
  assert.equal(events(state,'2026-09-26T10:00:00Z').length,0);
});
test('after-midnight work belongs to the previous Quest day until reset', () => {
  const state=fixture(); state.settings.dayResetHour=4; state.anchors[0].hour=1; state.domains[0].tasks[0].hour=1;
  const result=events(state,'2026-09-26T22:00:00Z');
  assert.equal(result.length,2); assert.ok(result.every(x=>x.key.includes('2026-09-26')));
  state.anchors[0].history['2026-09-26']=true;
  assert.equal(events(state,'2026-09-26T22:00:00Z').length,1);
});
test('Stop Day preserves only protected/fixed tasks and chosen anchors', () => {
  const state=fixture();state.voyageAdjustments['2026-09-26']={mode:'harbor',activeAnchorIds:[]};
  assert.equal(events(state,'2026-09-26T10:00:00Z').length,0);
  state.voyageAdjustments['2026-09-26'].protectedKey='task:film:edit';
  assert.equal(events(state,'2026-09-26T10:00:00Z')[0].kind,'task');
  state.voyageAdjustments['2026-09-26'].protectedKey='anchor:gym';
  assert.equal(events(state,'2026-09-26T10:00:00Z')[0].kind,'anchor');
});
test('focus and break endings; pause/resume/complete cancel obsolete deadlines', () => {
  const state=fixture(), task=state.domains[0].tasks[0], start=at('2026-09-26T11:00:00Z');
  configureTaskPomodoro(task,{focusMinutes:1,shortBreakMinutes:1,longBreakMinutes:2},start); startTaskTimer(state.domains,'film','edit',start);
  assert.equal(events(state,'2026-09-26T11:00:59Z').length,0);
  assert.equal(events(state,'2026-09-26T11:01:00Z')[0].kind,'pomodoro');
  startTaskTimer(state.domains,'film','edit',start+60000);
  assert.equal(events(state,'2026-09-26T11:01:30Z').length,0);
  assert.match(events(state,'2026-09-26T11:02:00Z')[0].title,/Break over/);
  startTaskTimer(state.domains,'film','edit',start+120000); pauseTaskTimer(task,start+130000);
  assert.equal(events(state,'2026-09-26T11:03:00Z').length,0);
  startTaskTimer(state.domains,'film','edit',start+180000);
  assert.equal(events(state,'2026-09-26T11:03:49Z').length,0);
  assert.equal(events(state,'2026-09-26T11:03:50Z').length,1);
  completeTimedTask(state.domains[0],task,start+230000);
  assert.equal(events(state,'2026-09-26T11:03:51Z').length,0);
});
test('planned work reminder subtracts banked focus time and does not finish the task', () => {
  const state=fixture(),task=state.domains[0].tasks[0];task.workTimer={elapsedMs:120000,startedAt:'2026-09-26T11:00:00Z'};
  const result=events(state,'2026-09-26T11:08:00Z'); assert.equal(result[0].kind,'timer'); assert.equal(task.done,false);
  pauseTaskTimer(task,at('2026-09-26T11:08:00Z'));assert.equal(events(state,'2026-09-26T11:08:01Z').length,0);
});
test('enable time and type preferences stop stale/unwanted reminders', () => {
  const state=fixture();
  assert.equal(events(state,'2026-09-26T10:00:01Z',{enabledAt:at('2026-09-26T10:00:01Z')}).length,0);
  assert.equal(events(state,'2026-09-26T10:00:00Z',{preferences:{anchors:false,tasks:false}}).length,0);
});
test('optional review is skipped for cleared or stopped days', () => {
  const state=fixture(),options={preferences:{review:true,reviewHour:21}};
  assert.equal(events(state,'2026-09-26T18:00:00Z',options)[0].kind,'review');
  state.voyageAdjustments['2026-09-26']={mode:'harbor'};assert.equal(events(state,'2026-09-26T18:00:00Z',options).length,0);
  state.voyageAdjustments={};state.anchors=[];state.domains=[];assert.equal(events(state,'2026-09-26T18:00:00Z',options).length,0);
});
test('DST gaps are skipped and repeated hours resolve to one occurrence', () => {
  assert.ok(Number.isNaN(zonedTime('2026-03-08',150,'America/New_York')));
  assert.equal(zonedTime('2026-11-01',90,'America/New_York'),at('2026-11-01T05:30:00Z'));
});
