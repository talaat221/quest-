import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTodayQuestItems } from '../src/today-quests.js';

const todayStr = '2026-09-19';
const today = (hour) => new Date(2026, 8, 19, hour).toISOString();
const build = (input) => getTodayQuestItems({ todayStr, ...input });

test('combines anchors and scheduled tasks from every quest without losing collisions', () => {
  const items = build({
    anchors: [{ id: 'same', name: 'Gym', hour: 8, xpPerDay: 15, done: true }],
    tasks: [
      { id: 'same', domainId: 'uni', name: 'Study', day: todayStr, hour: 13, xp: 60, estimatedMinutes: 120 },
      { id: 'same', domainId: 'film', name: 'Edit', day: todayStr, hour: 17, xp: 50, estimatedMinutes: 90 },
      { id: 'other', domainId: 'film', day: '2026-09-20' },
      { id: 'backlog', domainId: 'read', day: null },
    ],
  });
  assert.deepEqual(items.map(item => item.key), ['anchor:same', 'task:uni:same', 'task:film:same']);
  assert.deepEqual(items.map(item => item.xp), [15, 60, 50]);
  assert.deepEqual(items.map(item => item.detail), ['1/1 today', '2 hours', '1h 30m']);
});

test('includes a task completed today from another date or backlog, exactly once', () => {
  const items = build({ tasks: [
    { id: 'scheduled', domainId: 'a', day: todayStr, done: true, doneAt: today(12) },
    { id: 'early', domainId: 'a', day: '2026-09-21', done: true, doneAt: today(12), actualMinutes: 45 },
    { id: 'backlog', domainId: 'a', day: null, done: true, doneAt: today(12) },
    { id: 'old', domainId: 'a', day: null, done: true, doneAt: new Date(2026, 8, 18, 12).toISOString() },
    { id: 'invalid', domainId: 'a', done: true, doneAt: 'invalid' },
  ] });
  assert.deepEqual(items.map(item => item.id), ['scheduled', 'early', 'backlog']);
  assert.equal(items[1].detail, '45 minutes');
});

test('completion dates and chronological order respect the local daily reset', () => {
  const items = getTodayQuestItems({
    todayStr: '2026-09-18', resetHour: 4,
    anchors: [{ id: 'midnight', hour: 1 }, { id: 'morning', hour: 8 }],
    tasks: [
      { id: 'late', domainId: 'a', done: true, doneAt: today(2), actualMinutes: 20 },
      { id: 'next-day', domainId: 'a', done: true, doneAt: today(4) },
    ],
  });
  assert.deepEqual(items.map(item => item.id), ['morning', 'midnight', 'late']);
});

test('paused anchors, zero XP and untimed tasks retain their real data', () => {
  const items = build({
    anchors: [{ id: 'a', name: 'Read', paused: true, xpPerDay: 0, hour: null }],
    tasks: [{ id: 'b', domainId: 'film', domainName: 'My film', day: todayStr, xp: 0 }],
  });
  assert.equal(items[0].detail, 'Paused today');
  assert.equal(items[0].paused, true);
  assert.equal(items[1].detail, 'My film');
  assert.ok(items.every(item => item.xp === 0));
});

test('no item limit and no mutation of saved data', () => {
  const input = {
    anchors: [{ id: 'a', hour: 20, xpPerDay: 10 }],
    tasks: Array.from({ length: 12 }, (_, id) => ({ id, domainId: 'a', day: todayStr, hour: id, xp: 20 })),
  };
  const saved = structuredClone(input);
  assert.equal(build(input).length, 13);
  assert.deepEqual(input, saved);
  assert.deepEqual(build({}), []);
});
