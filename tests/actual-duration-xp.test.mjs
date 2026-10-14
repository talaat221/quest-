import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeProgression, recordTaskAward, removeTaskAward,
  progressionTotals, taskCompletionRecommendation, recommendTaskXP,
} from '../src/progression.js';
import { completeTimedTask, undoTimedTask, elapsedTaskMs } from '../src/task-timer.js';

const stamp = Date.parse('2026-10-14T12:00:00Z');
const makeTask = overrides => ({
  id: 'study-one', name: 'Study lecture', estimatedMinutes: 120,
  effort: 'normal', xp: 50, xpSource: 'effort-duration-v2',
  done: false, workTimer: { elapsedMs: 0, startedAt: null },
  ...overrides,
});
const newProgression = () => initializeProgression(null, [], [], stamp - 100000);

test('a 2-hour estimate earns 70 XP when the timer actually records 4 hours', () => {
  const task = makeTask({ workTimer: { elapsedMs: 0, startedAt: new Date(stamp - 240 * 60000).toISOString() } });
  const domain = { id: 'uni', name: 'University', tasks: [task] };
  assert.equal(elapsedTaskMs(task, stamp), 14400000);
  const receipt = completeTimedTask(domain, task, stamp);
  assert.equal(receipt.actualMinutes, 240);
  assert.equal(receipt.timeSource, 'timer');
  assert.equal(task.estimatedMinutes, 120);
  assert.equal(taskCompletionRecommendation(task).xp, 70);
  const { progression, award } = recordTaskAward(newProgression(), { domainId: 'uni', task, completedAt: stamp });
  assert.equal(award.nominalXp, 70);
  assert.equal(award.creditedXp, 70);
  assert.equal(award.timeSource, 'actual');
  assert.equal(progressionTotals(progression).earnedXP, 70);
});

test('manual duration is required for an untimed task, and changes the reward', () => {
  const task = makeTask();
  const domain = { id: 'uni', name: 'University', tasks: [task] };
  assert.equal(completeTimedTask(domain, task, stamp), null);
  assert.equal(task.done, false);
  for (const invalid of [0, -2, 1441, 5.25, NaN]) {
    assert.equal(completeTimedTask(domain, task, stamp, invalid), null);
    assert.equal(task.done, false);
  }
  const receipt = completeTimedTask(domain, task, stamp, 240);
  assert.equal(receipt.timeSource, 'manual');
  assert.equal(receipt.actualMinutes, 240);
  assert.equal(receipt.elapsedMs, 0);
  assert.equal(task.actualMinutes, 240);
  assert.equal(domain.timingProfiles['study lecture'].samples[0].actualMinutes, 240);
  assert.equal(domain.taskIntelligence.patterns.lecture.samples[0].actualMinutes, 240);
  const { award } = recordTaskAward(newProgression(), { domainId: 'uni', task, completedAt: stamp });
  assert.equal(award.creditedXp, 70);
});

test('spending less than estimated grants XP for actual time, not the original guess', () => {
  const task = makeTask();
  const domain = { id: 'uni', name: 'University', tasks: [task] };
  completeTimedTask(domain, task, stamp, 60);
  assert.equal(taskCompletionRecommendation(task).xp, 35);
  assert.equal(recordTaskAward(newProgression(), { domainId: 'uni', task, completedAt: stamp }).award.creditedXp, 35);
});

test('paused sessions count cumulative timer time, and undo removes XP and training samples', () => {
  const task = makeTask({ workTimer: { elapsedMs: 180 * 60000, startedAt: new Date(stamp - 60 * 60000).toISOString() } });
  const domain = { id: 'uni', name: 'University', tasks: [task] };
  completeTimedTask(domain, task, stamp);
  assert.equal(task.actualMinutes, 240);
  let { progression, award } = recordTaskAward(newProgression(), { domainId: 'uni', task, completedAt: stamp });
  assert.equal(award.creditedXp, 70);
  ({ progression, award } = recordTaskAward(progression, { domainId: 'uni', task, completedAt: stamp }));
  assert.equal(award.creditedXp, 70);
  assert.equal(progressionTotals(progression).taskXP, 70);
  progression = removeTaskAward(progression, 'uni', task.id, task);
  undoTimedTask(domain, task);
  assert.equal(progressionTotals(progression).taskXP, 0);
  assert.equal(task.actualMinutes, null);
  assert.equal(task.done, false);
  assert.equal(domain.timingProfiles['study lecture'].samples.length, 0);
  assert.equal(recommendTaskXP({ estimatedMinutes: task.estimatedMinutes, effort: task.effort }).xp, 50);
});

test('existing estimates and XP are unchanged until completion; old awards remain fixed', () => {
  const task = makeTask({ actualMinutes: null });
  assert.equal(taskCompletionRecommendation(task).xp, 50);
  assert.equal(task.xp, 50);
  const original = makeTask({ done: true, actualMinutes: null });
  const first = recordTaskAward(newProgression(), { domainId: 'uni', task: original, completedAt: stamp });
  assert.equal(first.award.creditedXp, 50);
  original.actualMinutes = 240;
  const next = recordTaskAward(first.progression, { domainId: 'uni', task: original, completedAt: stamp });
  assert.equal(next.award.creditedXp, 50);
});
