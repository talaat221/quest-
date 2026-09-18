import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCurrentStreak, getDaySaveStatus, getHomePage } from '../src/home-finish.js';

const todayStr = '2026-09-19';
const completedAt = (day, hour = 12) => new Date(2026, 8, day, hour).toISOString();
const streak = (input) => getCurrentStreak({ todayStr, ...input });

test('combines distinct days across anchors and quests, not the number of tasks', () => {
  const input = {
    anchors: [
      { history: { '2026-09-19': true, '2026-09-18': true } },
      { history: { '2026-09-19': true, '2026-09-17': true } },
    ],
    tasks: [
      { done: true, doneAt: completedAt(16) },
      { done: true, doneAt: completedAt(18) },
      { done: true, doneAt: completedAt(14) },
    ],
  };
  const saved = structuredClone(input);
  assert.equal(streak(input), 4);
  assert.deepEqual(input, saved);
});

test('keeps yesterday’s streak during the open day, and breaks at a missed day', () => {
  const anchors = [{ history: { '2026-09-18': true, '2026-09-17': true, '2026-09-15': true } }];
  assert.equal(streak({ anchors }), 2);
  assert.equal(getCurrentStreak({ anchors, todayStr: '2026-09-20' }), 0);
  assert.equal(streak({ anchors: [{ history: { '2026-09-19': true, '2026-09-17': true } }] }), 1);
  assert.equal(streak({}), 0);
});

test('task completions respect the local quest-day reset', () => {
  const tasks = [
    { done: true, doneAt: completedAt(19, 2) },
    { done: true, doneAt: completedAt(18, 2) },
  ];
  assert.equal(getCurrentStreak({ tasks, todayStr: '2026-09-18', resetHour: 4 }), 2);
  tasks.push({ done: true, doneAt: completedAt(19, 4) });
  assert.equal(streak({ tasks, resetHour: 4 }), 3);
});

test('ignores future, invalid and undone completions and handles year boundaries', () => {
  assert.equal(streak({
    anchors: [{ history: { '2026-09-20': true, '2026-09-19': false, 'invalid': true, '2026-02-30': true } }],
    tasks: [{ done: true, doneAt: 'invalid' }, { done: false, doneAt: completedAt(19) }, { done: true }],
  }), 0);
  assert.equal(getCurrentStreak({ todayStr: '2027-01-01', anchors: [{ history: { '2027-01-01': true, '2026-12-31': true } }] }), 2);
  assert.equal(getCurrentStreak({ todayStr: 'invalid' }), 0);
});

test('never calls a pending, offline or conflicting save synced', () => {
  assert.equal(getDaySaveStatus({ state: 'synced', pending: 0 }), 'saved');
  assert.equal(getDaySaveStatus({ state: 'synced', pending: 1 }), 'pending');
  for (const state of ['offline', 'pending', 'syncing']) assert.equal(getDaySaveStatus({ state, pending: 1 }), 'pending');
  assert.equal(getDaySaveStatus({ state: 'conflict', pending: 1 }), 'conflict');
});

test('navigation supports reload/back, old URLs and unknown hashes', () => {
  for (const page of ['home', 'quests', 'today-quests', 'anchors', 'stats', 'more']) assert.equal(getHomePage(`#${page}`), page);
  assert.equal(getHomePage('#voyage'), 'stats');
  assert.equal(getHomePage('#rewards'), 'more');
  assert.equal(getHomePage('#missing'), 'home');
  assert.equal(getHomePage(), 'home');
});
