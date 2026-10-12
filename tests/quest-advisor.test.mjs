import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuestAdvice, remainingTaskWork } from '../src/quest-advisor.js';
import { buildWeeklyPlan } from '../src/weekly-planner.js';
const day='2026-10-05',now=new Date(`${day}T09:00:00`);
const task=(id,estimatedMinutes,extra={})=>({id,name:id,estimatedMinutes,day,...extra});
const state=(tasks=[],anchors=[])=>({domains:[{id:'q',tasks}],anchors,settings:{planning:{dailyMinutes:Array(7).fill(180)}}});
const advice=s=>buildQuestAdvice(s,{now,todayStr:day});
test('twenty short tasks are less work than one long task, and anchors count by duration',()=>{
  const small=advice(state(Array.from({length:20},(_,i)=>task(String(i),2))));
  const big=advice(state([task('Long',240)]));
  assert.equal(small.today.remainingMinutes,40);assert.equal(small.today.level,'comfortable');
  assert.equal(big.today.remainingMinutes,240);assert.equal(big.today.level,'overloaded');
  const anchors=advice(state([],[{id:'a',estimatedMinutes:75,hour:10,activeWeekdays:[1]}]));
  assert.equal(anchors.today.anchorMinutes,75);
});
test('completed work and timer progress reduce remaining work without disappearing unfinished overruns',()=>{
  const a=advice(state([task('Done',60,{done:true}),task('Halfway',60,{workTimer:{elapsedMs:30*60000}}),task('Late',10,{workTimer:{elapsedMs:20*60000}})]));
  assert.equal(a.today.completedMinutes,60);assert.equal(a.today.remainingMinutes,35);assert.equal(a.today.overrun,true);
  assert.equal(a.notes.filter(n=>n.kind==='estimate').length,1);
  assert.equal(remainingTaskWork({},task('Tiny',2),now).remaining,2);
});
test('unscheduled work is separate from today but included once in this week; later weeks stay separate',()=>{
  const a=advice(state([task('Today',30),task('Flexible',120,{day:null,plannedWeek:day}),task('Future',300,{day:null,plannedWeek:'2026-10-12'})]));
  assert.equal(a.today.remainingMinutes,30);assert.equal(a.flexibleMinutes,120);assert.equal(a.totalRemaining,150);
});
test('remaining wall-clock time limits today even if budget is still available',()=>{
  const a=buildQuestAdvice(state([task('Evening',120)]),{now:new Date(`${day}T20:30:00`),todayStr:day});
  assert.ok(a.today.remainingCapacity<=30);assert.ok(a.today.overByMinutes>=90);
});
test('completed anchors, day-off capacity, overdue work and missing estimates stay explicit',()=>{
  const s=state([task('No estimate',null),task('Overdue',45,{day:'2026-10-04'})],[{id:'a',estimatedMinutes:20,activeWeekdays:[1],history:{[day]:true}}]);
  s.settings.planning.dailyMinutes[0]=0;
  const a=advice(s);
  assert.equal(a.today.remainingCapacity,0);assert.equal(a.today.remainingMinutes,30);assert.equal(a.today.completedMinutes,20);
  assert.ok(a.notes.some(n=>n.kind==='overdue'));assert.ok(a.notes.some(n=>n.kind==='unknown'));
});
test('paused flexible tasks are planned by their remaining duration',()=>{
  const s=state([task('Session',120,{day:null,plannedWeek:day,workTimer:{elapsedMs:90*60000,startedAt:null}})]);
  const p=buildWeeklyPlan(s,day,s.settings.planning,{now});
  assert.equal(p.assignments[0].minutes,30);assert.equal(advice(s).flexibleMinutes,30);
});
test('advice never mutates tasks and respects the midnight reset',()=>{
  const s=state([task('Night',20)]);s.settings.dayResetHour=4;
  const before=JSON.stringify(s),a=buildQuestAdvice(s,{now:new Date('2026-10-06T01:00:00')});
  assert.equal(a.today.dateKey,day);assert.equal(JSON.stringify(s),before);
});
