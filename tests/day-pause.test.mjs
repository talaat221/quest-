import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSafeHarborActiveAnchorIds, isSafeHarborTask } from '../src/day-pause.js';
import { getTodayQuestItems } from '../src/today-quests.js';

const anchors = [{ id: 'gym' }, { id: 'read' }];
const todayStr = '2026-09-19';

test('a protected anchor stays active even when the other anchors are paused', () => {
  const adjustment = { mode: 'harbor', anchorPlan: 'none', activeAnchorIds: [], protectedKey: 'anchor:read' };
  assert.deepEqual(getSafeHarborActiveAnchorIds({ anchors }, adjustment), ['read']);
  assert.deepEqual(adjustment.activeAnchorIds, []);
});

test('active-anchor choices are deduplicated, validate existing IDs and support old saves', () => {
  assert.deepEqual(getSafeHarborActiveAnchorIds({ anchors }, { mode: 'harbor', activeAnchorIds: ['gym', 'gym', 'deleted'], protectedKey: 'anchor:read' }), ['gym', 'read']);
  assert.deepEqual(getSafeHarborActiveAnchorIds({ anchors }, { mode: 'harbor', protectedKey: 'anchor:read' }), ['read']);
  assert.deepEqual(getSafeHarborActiveAnchorIds({ anchors }, { mode: 'reduced', activeAnchorIds: ['gym'] }), []);
  assert.deepEqual(getSafeHarborActiveAnchorIds({ anchors }, null), []);
});

test('only today’s fixed or protected tasks are active, including after completion', () => {
  const adjustment = { mode: 'harbor', protectedKey: 'task:uni:same' };
  const task = { id: 'same', day: todayStr };
  assert.equal(isSafeHarborTask(task, 'uni', adjustment, todayStr), true);
  assert.equal(isSafeHarborTask(task, 'film', adjustment, todayStr), false);
  assert.equal(isSafeHarborTask({ ...task, done: true }, 'uni', adjustment, todayStr), true);
  assert.equal(isSafeHarborTask({ ...task, flexibility: 'fixed' }, 'film', adjustment, todayStr), true);
  assert.equal(isSafeHarborTask({ ...task, day: '2026-09-20', flexibility: 'fixed' }, 'uni', adjustment, todayStr), false);
  assert.equal(isSafeHarborTask(task, 'uni', { ...adjustment, mode: 'reduced' }, todayStr), false);
});

test('important work is visible first in the paused-day card without leaking moved tasks', () => {
  const items = getTodayQuestItems({
    todayStr,
    adjustment: { mode: 'harbor', protectedKey: 'task:uni:important' },
    anchors: [
      { id: 'paused', hour: 8, paused: true },
      { id: 'kept', hour: 10, safeActive: true },
    ],
    tasks: [
      { id: 'important', domainId: 'uni', day: todayStr, hour: 22, xp: 60 },
      { id: 'fixed', domainId: 'work', day: todayStr, hour: 9, flexibility: 'fixed' },
      { id: 'moved', domainId: 'uni', day: '2026-09-20', hour: null },
    ],
  });
  assert.deepEqual(items.map(item => item.id), ['important', 'fixed', 'kept', 'paused']);
  assert.equal(items[0].protected, true);
  assert.equal(items[0].safeActive, true);
  assert.equal(items.at(-1).detail, 'Paused today');
});

test('a new quest day naturally exits yesterday’s stopped state', () => {
  const state = { anchors, voyageAdjustments: { [todayStr]: { mode: 'harbor', activeAnchorIds: ['gym'] } } };
  assert.deepEqual(getSafeHarborActiveAnchorIds(state, state.voyageAdjustments[todayStr]), ['gym']);
  assert.deepEqual(getSafeHarborActiveAnchorIds(state, state.voyageAdjustments['2026-09-20']), []);
});
