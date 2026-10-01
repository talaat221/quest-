import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goalPeriodBounds, makeGoal, goalProgress, allQuestGoals } from '../src/goals.js';
import { startTaskTimer, pauseTaskTimer, elapsedTaskMs, completeTimedTask, undoTimedTask, getLearnedEstimate, isTaskWorking, formatElapsed } from '../src/task-timer.js';
const makeDomain = () => ({ id:'film', name:'Film', tasks:[{id:'edit',name:'Edit a reel',done:false},{id:'shoot',name:'Shoot',done:false}], timingProfiles:{} });
const start = Date.parse('2026-09-26T10:00:00Z');

test('goal periods cover full weeks, leap months and years without UTC date drift', () => {
  assert.deepEqual(goalPeriodBounds('week','2026-01-01'), {startDate:'2025-12-29',endDate:'2026-01-04'});
  assert.deepEqual(goalPeriodBounds('month','2028-02-24'), {startDate:'2028-02-01',endDate:'2028-02-29'});
  assert.deepEqual(goalPeriodBounds('year','2026-09-26'), {startDate:'2026-01-01',endDate:'2026-12-31'});
  assert.throws(() => goalPeriodBounds('month','2026-02-30'));
});
test('editing a goal preserves its identity and unchanged checked milestones', () => {
  const first=makeGoal({title:'Finish film',period:'month',referenceDate:'2026-09-26',tracking:'milestones',milestoneText:'Script\nShoot\nEdit'});
  first.milestones[0].done=true;
  const edited=makeGoal({...first,title:'Finish my film',referenceDate:'2026-09-26',milestoneText:'Shoot\nScript\nPublish'},first);
  assert.equal(edited.id,first.id); assert.equal(edited.createdAt,first.createdAt);
  assert.equal(edited.milestones[1].done,true); assert.equal(edited.milestones[1].id,first.milestones[0].id);
  assert.equal(edited.milestones[2].done,false); assert.equal(goalProgress(edited).ratio,1/3);
});
test('goal validation rejects empty names, invalid dates, targets and empty checklists', () => {
  const valid={title:'Read',period:'week',referenceDate:'2026-09-26',tracking:'manual',target:2,unit:'books'};
  for(const changes of [{title:'  '},{target:0},{target:1.5},{progress:-1},{referenceDate:'bad'},{tracking:'milestones',milestoneText:''}]) assert.throws(()=>makeGoal({...valid,...changes}));
  assert.equal(goalProgress(makeGoal({...valid,progress:3})).ratio,1);
});
test('automatic goal counts are owned by the quest, respect its dates and undo', () => {
  const goal=makeGoal({title:'Practice',period:'month',referenceDate:'2026-09-26',tracking:'tasks',target:2});
  const domain={tasks:[{done:true,doneAt:'2026-09-01T12:00:00Z'},{done:true,doneAt:'2026-09-25T12:00:00Z'},{done:true,doneAt:'2026-08-20T12:00:00Z'},{done:false,doneAt:'2026-09-23T12:00:00Z'},{done:true,doneAt:'invalid'}]};
  assert.equal(goalProgress(goal,domain).current,2); domain.tasks[0].done=false;
  assert.equal(goalProgress(goal,domain).current,1); assert.equal(goalProgress(goal,{tasks:[]}).current,0);
});
test('old quests with no goal field remain usable and are not seeded with sample goals', () => {
  assert.deepEqual(allQuestGoals([{id:'old',tasks:[]}]),[]);
});
test('timer survives reload and phone sleep using timestamps, with accurate pause/resume', () => {
  const domains=[makeDomain()]; startTaskTimer(domains,'film','edit',start);
  const restored=JSON.parse(JSON.stringify(domains)), task=restored[0].tasks[0];
  assert.equal(elapsedTaskMs(task,start+125000),125000);
  pauseTaskTimer(task,start+125000); assert.equal(elapsedTaskMs(task,start+500000),125000);
  startTaskTimer(restored,'film','edit',start+600000);
  assert.equal(elapsedTaskMs(task,start+635000),160000); assert.equal(formatElapsed(160000),'02:40');
});
test('starting another task pauses the first; repeated starts do not reset elapsed time', () => {
  const domains=[makeDomain()]; startTaskTimer(domains,'film','edit',start);
  assert.equal(startTaskTimer(domains,'film','edit',start+10000),false);
  startTaskTimer(domains,'film','shoot',start+60000);
  assert.equal(isTaskWorking(domains[0].tasks[0]),false); assert.equal(elapsedTaskMs(domains[0].tasks[0],start+100000),60000);
  assert.equal(isTaskWorking(domains[0].tasks[1]),true);
  assert.equal(startTaskTimer(domains,'missing','none',start+90000),false);
  assert.equal(isTaskWorking(domains[0].tasks[1]),true);
});
test('finishing saves exact time, learns once in the correct quest and undo removes the sample', () => {
  const domain=makeDomain(); startTaskTimer([domain],'film','edit',start);
  const result=completeTimedTask(domain,domain.tasks[0],start+125000);
  assert.equal(result.elapsedMs,125000); assert.equal(domain.tasks[0].actualMinutes,2);
  assert.equal(isTaskWorking(domain.tasks[0]),false); assert.equal(getLearnedEstimate(domain,'Edit a reel'),2);
  assert.equal(getLearnedEstimate(makeDomain(),'Edit a reel'),null);
  assert.equal(completeTimedTask(domain,domain.tasks[0],start+250000),null);
  assert.equal(domain.timingProfiles['edit a reel'].samples.length,1);
  undoTimedTask(domain,domain.tasks[0]); assert.equal(getLearnedEstimate(domain,'Edit a reel'),null);
  assert.equal(elapsedTaskMs(domain.tasks[0],start+500000),0); assert.equal(domain.tasks[0].done,false);
});
test('completing without a timer records completion without inventing a learning sample', () => {
  const domain=makeDomain(), result=completeTimedTask(domain,domain.tasks[0],start);
  assert.equal(result.elapsedMs,0); assert.equal(domain.tasks[0].done,true);
  assert.equal(domain.tasks[0].actualMinutes,null); assert.equal(getLearnedEstimate(domain,'Edit a reel'),null);
});
test('timer cannot produce negative time and preserves long sessions', () => {
  const domains=[makeDomain()]; startTaskTimer(domains,'film','edit',start);
  assert.equal(elapsedTaskMs(domains[0].tasks[0],start-5000),0);
  assert.equal(formatElapsed(elapsedTaskMs(domains[0].tasks[0],start+3723000)),'1:02:03');
});
