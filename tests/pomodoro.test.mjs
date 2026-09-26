import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configureTaskPomodoro, startTaskTimer, pauseTaskTimer, elapsedTaskMs, completeTimedTask } from '../src/task-timer.js';
import { DEFAULT_POMODORO, getPomodoro, normalizePomodoro, formatCountdown } from '../src/pomodoro.js';
const start = Date.parse('2026-09-26T19:00:00Z');
const create = settings => {
  const domain = { id: 'uni', name: 'University', tasks: [{ id: 'study', name: 'Histology' }, { id: 'other', name: 'Anki' }] };
  configureTaskPomodoro(domain.tasks[0], settings || DEFAULT_POMODORO, start);
  return { domains: [domain], domain, task: domain.tasks[0] };
};

test('focus countdown caps recorded work at the deadline after a long absence or reload', () => {
  const { domains, task } = create();
  startTaskTimer(domains, 'uni', 'study', start);
  const restored = JSON.parse(JSON.stringify(task));
  assert.equal(getPomodoro(restored, start + 10000).remainingMs, 1490000);
  assert.equal(elapsedTaskMs(restored, start + 7200000), 1500000);
  assert.equal(getPomodoro(restored, start + 7200000).remainingMs, 0);
  assert.equal(getPomodoro(restored, start + 7200000).running, false);
  assert.equal(getPomodoro(restored, start + 7200000).completedRounds, 1);
  assert.ok(!restored.done);
});
test('pause/resume preserves the countdown and excludes paused time', () => {
  const { domains, task } = create();
  startTaskTimer(domains, 'uni', 'study', start);
  pauseTaskTimer(task, start + 600000);
  assert.equal(getPomodoro(task, start + 3600000).remainingMs, 900000);
  startTaskTimer(domains, 'uni', 'study', start + 3600000);
  assert.equal(elapsedTaskMs(task, start + 3660000), 660000);
  assert.equal(getPomodoro(task, start + 3660000).remainingMs, 840000);
  assert.equal(startTaskTimer(domains, 'uni', 'study', start + 3660000), false);
});
test('short and long breaks never count as work, and the next phase waits for a click', () => {
  const { domains, task } = create({ focusMinutes: 1, shortBreakMinutes: 1, longBreakMinutes: 2 });
  let now = start;
  for (let round = 1; round <= 4; round++) {
    startTaskTimer(domains, 'uni', 'study', now);
    now += 90000;
    assert.equal(elapsedTaskMs(task, now), round * 60000);
    assert.equal(getPomodoro(task, now).phase, 'focus');
    startTaskTimer(domains, 'uni', 'study', now);
    assert.equal(getPomodoro(task, now).phase, round === 4 ? 'longBreak' : 'shortBreak');
    assert.equal(getPomodoro(task, now).remainingMs, round === 4 ? 120000 : 60000);
    assert.equal(task.workTimer.startedAt, null);
    now += 3600000;
    assert.equal(elapsedTaskMs(task, now), round * 60000);
    assert.equal(getPomodoro(task, now).running, false);
  }
  assert.equal(getPomodoro(task, now).completedRounds, 4);
});
test('starting another task pauses an ongoing break or focus without losing either', () => {
  const { domains, task } = create({ focusMinutes: 1, shortBreakMinutes: 5, longBreakMinutes: 15 });
  startTaskTimer(domains, 'uni', 'study', start);
  startTaskTimer(domains, 'uni', 'other', start + 15000);
  assert.equal(getPomodoro(task, start + 3600000).remainingMs, 45000);
  startTaskTimer(domains, 'uni', 'study', start + 20000);
  startTaskTimer(domains, 'uni', 'study', start + 65000);
  startTaskTimer(domains, 'uni', 'other', start + 95000);
  assert.equal(getPomodoro(task, start + 7200000).remainingMs, 270000);
  assert.equal(getPomodoro(task, start + 7200000).phase, 'shortBreak');
  assert.equal(elapsedTaskMs(task, start + 7200000), 60000);
});
test('finishing during a break saves focus time once and teaches the correct estimate', () => {
  const { domains, domain, task } = create();
  startTaskTimer(domains, 'uni', 'study', start);
  startTaskTimer(domains, 'uni', 'study', start + 1500000);
  const result = completeTimedTask(domain, task, start + 1560000);
  assert.equal(result.elapsedMs, 1500000);
  assert.equal(task.actualMinutes, 25);
  assert.equal(domain.timingProfiles.histology.samples.length, 1);
  assert.equal(getPomodoro(task, start + 1800000).running, false);
  assert.equal(completeTimedTask(domain, task, start + 1800000), null);
});
test('switching modes or changing lengths retains previously recorded work', () => {
  const { domains, task } = create();
  startTaskTimer(domains, 'uni', 'study', start);
  configureTaskPomodoro(task, { focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 20 }, start + 120000);
  assert.equal(elapsedTaskMs(task, start + 9999999), 120000);
  assert.equal(getPomodoro(task, start + 9999999).remainingMs, 3000000);
  configureTaskPomodoro(task, null, start + 200000);
  assert.equal(getPomodoro(task), null);
  startTaskTimer(domains, 'uni', 'study', start + 300000);
  assert.equal(elapsedTaskMs(task, start + 360000), 180000);
});
test('malformed settings and future timestamps cannot create negative durations', () => {
  assert.deepEqual(normalizePomodoro({ focusMinutes: 0, shortBreakMinutes: 999, longBreakMinutes: NaN }), { focusMinutes: 1, shortBreakMinutes: 60, longBreakMinutes: 15 });
  const { domains, task } = create(); startTaskTimer(domains, 'uni', 'study', start);
  assert.equal(elapsedTaskMs(task, start - 1000), 0);
  assert.equal(getPomodoro(task, start - 1000).remainingMs, 1500000);
  assert.equal(formatCountdown(59999), '01:00');
});
