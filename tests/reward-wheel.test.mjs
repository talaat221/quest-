import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareRewardSpin, prepareRewardSpins, rewardWheelSlots, wheelLandingRotation } from '../src/reward-wheel.js';
import { recordRewardClaim } from '../src/rewards.js';

const period = { periodKey: '2026-09-26', xp: 70, availableXP: 100, thresholdPct: 70 };

test('every reward can win and the pointer lands in the selected segment for all list sizes', () => {
  for (const count of [1, 2, 3, 4, 5, 6, 8, 12, 17, 50]) {
    const items = Array.from({ length: count }, (_, index) => `Treat ${index + 1}`);
    for (let winner = 0; winner < count; winner += 1) {
      let draws = 0;
      const spin = prepareRewardSpin('daily', period, items, () => draws++ === 0 ? (winner + 0.5) / count : 0.9);
      assert.equal(spin.reward, items[winner]);
      assert.equal(spin.slots[spin.winnerSlot].text, items[winner]);
      const atPointer = Math.floor(((360 - spin.rotation % 360) % 360) / (360 / spin.slots.length));
      assert.equal(atPointer, spin.winnerSlot);
    }
  }
});

test('small lists repeat evenly and long reward names remain intact', () => {
  for (const count of [1, 2, 3, 4, 5]) {
    const items = Array.from({ length: count }, (_, index) => `Full name ${index}`);
    const slots = rewardWheelSlots(items);
    assert.ok(slots.length >= 6);
    for (const item of items) assert.equal(slots.filter(slot => slot.text === item).length, slots.length / items.length);
  }
  const longName = 'A relaxing evening with friends and a movie after a busy week';
  assert.equal(prepareRewardSpin('daily', period, [longName], () => 0).reward, longName);
  assert.deepEqual(rewardWheelSlots([]), []);
  assert.equal(wheelLandingRotation(0, 6), 2490);
});

test('no wheel below the target, with an empty chest, after claiming or while paused', () => {
  assert.equal(prepareRewardSpin('daily', { ...period, xp: 69 }, ['Tea']), null);
  assert.equal(prepareRewardSpin('daily', period, ['', ' ']), null);
  assert.equal(prepareRewardSpin('daily', { ...period, claimed: 'Tea' }, ['Tea']), null);
  assert.equal(prepareRewardSpin('daily', { ...period, blockedReason: 'Day stopped' }, ['Tea']), null);
  assert.equal(prepareRewardSpin('daily', { ...period, availableXP: 0 }, ['Tea']), null);
});

test('daily and weekly rewards are queued once, with their original period and list snapshots', () => {
  const periods = { daily: period, weekly: { ...period, periodKey: '2026-09-21' } };
  const rewards = { daily: ['Tea', 'A movie'], weekly: ['A day out'] };
  const spins = prepareRewardSpins(['daily', 'weekly', 'daily'], periods, rewards, new Set(), () => 0);
  assert.deepEqual(spins.map(spin => spin.id), ['daily:2026-09-26', 'weekly:2026-09-21']);
  rewards.daily[0] = 'Edited after the draw';
  assert.equal(spins[0].items[0], 'Tea');
  assert.deepEqual(prepareRewardSpins(['daily', 'weekly'], periods, rewards, new Set(spins.map(spin => spin.id))), []);
  assert.equal(prepareRewardSpins(['daily'], { daily: { ...period, periodKey: '2026-09-27' } }, rewards, new Set(spins.map(spin => spin.id))).length, 1);
});

test('saving a draw prevents rerolls after reload and keeps the original period across midnight', () => {
  const state = { rewards: { daily: ['Tea', 'A movie'] }, claimed: {}, settings: { dayThresholdPct: 70 } };
  const spin = prepareRewardSpin('daily', period, state.rewards.daily, () => 0);
  assert.equal(recordRewardClaim(state, spin.kind, spin.periodKey, spin.reward, period), true);
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(prepareRewardSpin('daily', { ...period, claimed: restored.claimed.daily[period.periodKey] }, restored.rewards.daily), null);
  assert.equal(restored.claimed.daily['2026-09-26'], 'Tea');
  assert.equal(restored.claimed.daily['2026-09-27'], undefined);
});
