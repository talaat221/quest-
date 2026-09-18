import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDailyAnchorTimeline } from '../src/daily-anchors.js';

const at = (hour, minute = 0, second = 0) => new Date(2026, 8, 19, hour, minute, second);
const statuses = (anchors, hour, minute = 0, reset = 0) => Object.fromEntries(
  getDailyAnchorTimeline(anchors, reset, at(hour, minute)).map(anchor => [anchor.id, anchor.status]),
);

test('an anchor at 1:00 stays unfilled until 1:00, then stays due', () => {
  const anchors = [{ id: 'one', hour: 1 }];
  assert.equal(getDailyAnchorTimeline(anchors, 0, at(0, 59, 59))[0].status, 'pending');
  assert.equal(statuses(anchors, 1).one, 'due');
  assert.equal(statuses(anchors, 1, 30).one, 'due');
});

test('half-hour schedules do not turn orange early', () => {
  const anchors = [{ id: 'study', hour: 13.5 }];
  assert.equal(statuses(anchors, 13, 29).study, 'pending');
  assert.equal(statuses(anchors, 13, 30).study, 'due');
});

test('finishing an earlier anchor never highlights a future anchor early', () => {
  const anchors = [
    { id: 'gym', hour: 8, done: true },
    { id: 'study', hour: 13 },
    { id: 'read', hour: 20 },
  ];
  assert.deepEqual(statuses(anchors, 10), { gym: 'done', study: 'pending', read: 'pending' });
  assert.deepEqual(statuses(anchors, 20), { gym: 'done', study: 'due', read: 'due' });
});

test('completed anchors are green even when completed early or paused', () => {
  const anchors = [
    { id: 'early', hour: 23, done: true },
    { id: 'paused-done', hour: 20, paused: true, done: true },
    { id: 'paused', hour: 8, paused: true },
  ];
  assert.deepEqual(statuses(anchors, 10), { paused: 'paused', 'paused-done': 'done', early: 'done' });
});

test('untimed and invalid times stay unfilled until completed', () => {
  const anchors = [null, undefined, '', 'invalid', -1, 24].map((hour, id) => ({ id, hour }));
  assert.ok(getDailyAnchorTimeline(anchors, 0, at(23, 59)).every(anchor => anchor.status === 'pending'));
  assert.equal(getDailyAnchorTimeline([{ hour: null, done: true }], 0, at(1))[0].status, 'done');
});

test('due times follow the quest day through midnight and its configured reset', () => {
  const anchors = [
    { id: 'morning', hour: 8 },
    { id: 'night', hour: 23 },
    { id: 'one', hour: 1 },
    { id: 'two', hour: 2 },
  ];
  assert.deepEqual(statuses(anchors, 0, 59, 4), { morning: 'due', night: 'due', one: 'pending', two: 'pending' });
  assert.deepEqual(statuses(anchors, 1, 0, 4), { morning: 'due', night: 'due', one: 'due', two: 'pending' });
  assert.deepEqual(statuses(anchors, 4, 0, 4), { morning: 'pending', night: 'pending', one: 'pending', two: 'pending' });
});

test('reading timeline status does not change stored anchors or their order', () => {
  const anchors = [{ id: 'late', hour: 22 }, { id: 'early', hour: 1 }, { id: 'untimed', hour: null }];
  const saved = structuredClone(anchors);
  assert.deepEqual(getDailyAnchorTimeline(anchors, 0, at(2)).map(anchor => anchor.id), ['early', 'late', 'untimed']);
  assert.deepEqual(anchors, saved);
  assert.deepEqual(getDailyAnchorTimeline([], 0, at(2)), []);
});
