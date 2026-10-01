import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getStudyTasks, getStudySelection, studyTaskKey } from '../src/study-room.js';
import { startTaskTimer, pauseTaskTimer, completeTimedTask, elapsedTaskMs } from '../src/task-timer.js';

const makeDomains = () => [{id:'film',name:'Film',tasks:[{id:'later',name:'Later',day:'2026-09-27'},{id:'today',name:'Edit',day:'2026-09-26'},{id:'done',name:'Finished',done:true}]},{id:'uni',name:'University',tasks:[{id:'study',name:'Study',workTimer:{elapsedMs:65000,startedAt:null}}]}];

test('room includes unfinished tasks across quests, puts today first, and does not modify data', () => {
  const domains=makeDomains(), snapshot=structuredClone(domains);
  const items=getStudyTasks(domains,'2026-09-26');
  assert.deepEqual(items.map(item=>item.task.id),['today','later','study']);
  assert.deepEqual(domains,snapshot);
  assert.equal(items[2].domain.id,'uni');
  assert.notEqual(studyTaskKey('a:b','c'),studyTaskKey('a','b:c'));
});

test('room follows the shared timer after reload and respects an explicit idle choice', () => {
  const domains=makeDomains();
  startTaskTimer(domains,'film','today',100000);
  const restored=structuredClone(domains), items=getStudyTasks(restored,'2026-09-26');
  assert.equal(getStudySelection(items,studyTaskKey('uni','study')).task.id,'today');
  assert.equal(elapsedTaskMs(getStudySelection(items,'').task,400000),300000);
  pauseTaskTimer(restored[0].tasks[1],400000);
  assert.equal(getStudySelection(getStudyTasks(restored),studyTaskKey('uni','study')).task.id,'study');
});

test('finishing in the room completes the same quest task, keeps exact time and updates estimates', () => {
  const domains=makeDomains(), now=Date.UTC(2026,8,26,14);
  startTaskTimer(domains,'film','today',now);
  const selected=getStudySelection(getStudyTasks(domains),'');
  const result=completeTimedTask(selected.domain,selected.task,now+155000);
  assert.equal(result.elapsedMs,155000);
  assert.equal(domains[0].tasks[1].actualMinutes,3);
  assert.equal(domains[0].timingProfiles.edit.samples.length,1);
  assert.equal(getStudyTasks(domains).some(item=>item.task.id==='today'),false);
});

test('room recovers from deleted selections and handles an empty or completed-only account', () => {
  assert.equal(getStudySelection([], 'missing'),null);
  assert.deepEqual(getStudyTasks([{id:'x',tasks:[{id:'a',done:true}]}]),[]);
  const items=getStudyTasks(makeDomains());
  assert.equal(getStudySelection(items,'deleted-task').task.id,'study');
  assert.equal(getStudySelection([{key:'first',task:{id:'first'},domain:{id:'d'}}],'deleted').task.id,'first');
});
