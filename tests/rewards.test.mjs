import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewardProgress, rewardThreshold, rewardTaskDay, saveRewardItem, removeRewardItem, recordRewardClaim, rewardHistory } from '../src/rewards.js';

const fresh = () => ({ rewards: { daily: ['Movie night', 'Favorite snack'], weekly: ['A day out'] }, claimed: { daily: {}, weekly: {} }, settings: { dayThresholdPct: 70, weekThresholdPct: 100 }, domains: [{ tasks: [{ done: true, xp: 100 }] }] });

test('completion XP follows local quest days across the reset and week boundary', () => {
  assert.equal(rewardTaskDay(new Date(2026, 8, 28, 3, 59).toISOString(), 4), '2026-09-27');
  assert.equal(rewardTaskDay(new Date(2026, 8, 28, 4, 0).toISOString(), 4), '2026-09-28');
  assert.equal(rewardTaskDay(new Date(2026, 8, 28, 0, 0).toISOString(), 0), '2026-09-28');
  assert.equal(rewardTaskDay('2026-09-28', 4), '2026-09-28');
  assert.equal(rewardTaskDay('invalid'), null);
  assert.equal(rewardTaskDay(null), null);
});

test('a chest unlocks at its target; empty plans, empty chests and stopped days cannot claim', () => {
  const input = { xp: 69, availableXP: 100, thresholdPct: 70, items: ['Movie night'] };
  assert.equal(rewardProgress(input).canClaim, false);
  assert.equal(rewardProgress(input).remaining, 1);
  assert.equal(rewardProgress({ ...input, xp: 70 }).canClaim, true);
  assert.equal(rewardProgress({ ...input, xp: 100, claimed: 'Movie night' }).canClaim, false);
  assert.equal(rewardProgress({ ...input, xp: 100, blockedReason: 'Day stopped' }).canClaim, false);
  assert.equal(rewardProgress({ ...input, xp: 100, availableXP: 0 }).canClaim, false);
  assert.equal(rewardProgress({ ...input, xp: 100, items: ['', ' '] }).canClaim, false);
  assert.equal(rewardProgress({ ...input, xp: 1000 }).ratio, 1);
});

test('small XP plans still require at least one earned XP and thresholds stay between 1 and 100', () => {
  assert.equal(rewardProgress({ xp: 0, availableXP: 1, thresholdPct: 1, items: ['Tea'] }).target, 1);
  assert.equal(rewardProgress({ xp: 1, availableXP: 1, thresholdPct: 1, items: ['Tea'] }).canClaim, true);
  assert.equal(rewardThreshold(-50), 1);
  assert.equal(rewardThreshold(200), 100);
  assert.equal(rewardThreshold('invalid'), 70);
});

test('rewards can be added, renamed and removed without rewriting claimed history', () => {
  const state = fresh();
  state.claimed.daily['2026-09-25'] = 'Movie night';
  assert.equal(saveRewardItem(state, 'daily', '  A long bath  '), true);
  assert.equal(saveRewardItem(state, 'daily', 'Cinema trip', 0), true);
  assert.equal(removeRewardItem(state, 'daily', 0), true);
  assert.deepEqual(state.rewards.daily, ['Favorite snack', 'A long bath']);
  assert.equal(state.claimed.daily['2026-09-25'], 'Movie night');
  assert.equal(saveRewardItem(state, 'daily', '   '), false);
  assert.equal(saveRewardItem(state, 'daily', 'x'.repeat(141)), false);
  assert.equal(saveRewardItem(state, 'daily', 'Stale item', 99), false);
  assert.equal(removeRewardItem(state, 'daily', -1), false);
  assert.equal(saveRewardItem(state, '__proto__', 'invalid'), false);
});

test('claiming is once per day/week, retains XP and uses each period’s saved threshold', () => {
  const state = fresh();
  const tasksBefore = structuredClone(state.domains);
  const progress = { xp: 70, availableXP: 100 };
  assert.equal(recordRewardClaim(state, 'daily', '2026-09-26', 'Movie night', progress), true);
  assert.equal(recordRewardClaim(state, 'daily', '2026-09-26', 'Favorite snack', progress), false);
  assert.equal(recordRewardClaim(state, 'daily', '2026-09-27', 'Favorite snack', { ...progress, xp: 0 }), false);
  assert.equal(recordRewardClaim(state, 'daily', '2026-09-27', 'Favorite snack', progress), true);
  assert.equal(recordRewardClaim(state, 'weekly', '2026-09-21', 'A day out', progress), false);
  assert.equal(recordRewardClaim(state, 'weekly', '2026-09-21', 'A day out', { ...progress, xp: 100 }), true);
  assert.equal(recordRewardClaim(state, 'weekly', '2026-09-28', 'Deleted reward', { ...progress, xp: 100 }), false);
  assert.deepEqual(state.domains, tasksBefore);
  assert.deepEqual(rewardHistory(state.claimed).map(item => item.text), ['Favorite snack', 'Movie night', 'A day out']);
});

test('claim validation honors paused/important-task restrictions and current settings', () => {
  const state = fresh();
  assert.equal(recordRewardClaim(state, 'daily', '2026-09-26', 'Movie night', { xp: 100, availableXP: 100, blockedReason: 'Complete your important task' }), false);
  state.settings.dayThresholdPct = 100;
  assert.equal(recordRewardClaim(state, 'daily', '2026-09-26', 'Movie night', { xp: 70, availableXP: 100, thresholdPct: 70 }), false);
  assert.deepEqual(state.claimed.daily, {});
});
