import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  XP_TIERS, recommendTaskXP, xpNeededForNextLevel, levelProgress,
  weeklyConsistencyBonus, initializeProgression, recordTaskAward,
  removeTaskAward, progressionTotals, currentWeekProgress, ROUTINE_DAILY_XP_CAP,
} from '../src/progression.js';

test('effort tiers assign deterministic XP from time and effort', () => {
  assert.equal(recommendTaskXP({ estimatedMinutes: 5, effort: 'normal' }).xp, 5);
  assert.equal(recommendTaskXP({ estimatedMinutes: 20, effort: 'normal' }).xp, 10);
  assert.equal(recommendTaskXP({ estimatedMinutes: 45, effort: 'normal' }).xp, 20);
  assert.equal(recommendTaskXP({ estimatedMinutes: 90, effort: 'normal' }).xp, 35);
  assert.equal(recommendTaskXP({ estimatedMinutes: 180, effort: 'normal' }).xp, 60);
  assert.equal(recommendTaskXP({ estimatedMinutes: 45, effort: 'low' }).xp, 10);
  assert.equal(recommendTaskXP({ estimatedMinutes: 45, effort: 'high' }).xp, 35);
  assert.equal(recommendTaskXP({ estimatedMinutes: 5, effort: 'low' }).xp, 5);
  assert.equal(recommendTaskXP({ estimatedMinutes: 240, effort: 'high' }).xp, 85);
  assert.deepEqual(XP_TIERS.map(tier => tier.xp), [5, 10, 20, 35, 50]);
});

test('level curve becomes meaningfully harder over time', () => {
  assert.equal(xpNeededForNextLevel(1), 125);
  assert.equal(xpNeededForNextLevel(5), 225);
  assert.equal(xpNeededForNextLevel(10), 375);
  assert.equal(xpNeededForNextLevel(20), 825);
  assert.equal(xpNeededForNextLevel(30), 1425);
  assert.ok(xpNeededForNextLevel(30) > xpNeededForNextLevel(20));
});

test('level progress carries forward instead of resetting weekly', () => {
  assert.deepEqual(levelProgress(0), { level: 1, currentXP: 0, requiredXP: 125, remainingXP: 125, pct: 0, totalXP: 0, lifetimeThresholdXP: 0 });
  assert.equal(levelProgress(125).level, 2);
  assert.equal(levelProgress(125).currentXP, 0);
  assert.equal(levelProgress(350).level, 3);
});

test('weekly task consistency bonus rewards meaningful completion volume', () => {
  assert.equal(weeklyConsistencyBonus(4), 0);
  assert.equal(weeklyConsistencyBonus(5), 25);
  assert.equal(weeklyConsistencyBonus(10), 50);
  assert.equal(weeklyConsistencyBonus(15), 75);
  assert.equal(weeklyConsistencyBonus(20), 100);
  assert.equal(weeklyConsistencyBonus(99), 100);
});

test('initialization preserves all XP already earned before the new system', () => {
  const domains = [{ tasks: [{ done: true, xp: 40 }, { done: false, xp: 50 }] }];
  const anchors = [{ xpPerDay: 10, history: { '2026-09-20': true, '2026-09-21': true } }];
  const progression = initializeProgression(null, domains, anchors, Date.parse('2026-09-27T12:00:00Z'));
  assert.equal(progression.legacyXP, 60);
  assert.ok(progression.initializedAt);
  assert.equal(initializeProgression(progression, [], []).legacyXP, 60);
});

test('new task awards survive task deletion and undo removes only the matching award', () => {
  let progression = initializeProgression(null, [], [], Date.parse('2026-09-01T12:00:00Z'));
  const task = { id: 'edit', name: 'Edit reel', estimatedMinutes: 45, effort: 'normal', effortTier: 'standard', xp: 20, xpSource: 'effort-tier-v1' };
  ({ progression } = recordTaskAward(progression, { domainId: 'film', task, completedAt: '2026-09-23T12:00:00Z' }));
  assert.equal(progressionTotals(progression).earnedXP, 20);
  assert.equal(progressionTotals(progression).earnedXP, 20);
  progression = removeTaskAward(progression, 'film', 'edit');
  assert.equal(progressionTotals(progression).earnedXP, 0);
});

test('routine XP is capped daily and only one routine task per day counts toward weekly task bonus', () => {
  let progression = initializeProgression(null, [], [], Date.parse('2026-09-01T12:00:00Z'));
  for (let i = 0; i < 6; i += 1) {
    const task = { id: `r${i}`, name: `Routine ${i}`, estimatedMinutes: 5, effort: 'normal', effortTier: 'routine', xp: 5, xpSource: 'effort-tier-v1' };
    ({ progression } = recordTaskAward(progression, { domainId: 'life', task, completedAt: `2026-09-22T1${i}:00:00Z` }));
  }
  const totals = progressionTotals(progression);
  assert.equal(totals.taskXP, ROUTINE_DAILY_XP_CAP);
  const week = currentWeekProgress(progression, '2026-09-21');
  assert.equal(week.tasks, 1);
  assert.equal(week.bonusXP, 0);
});

test('five eligible tasks in a week add a 25 XP level-only consistency bonus', () => {
  let progression = initializeProgression(null, [], [], Date.parse('2026-09-01T12:00:00Z'));
  for (let i = 0; i < 5; i += 1) {
    const task = { id: `s${i}`, name: `Standard ${i}`, estimatedMinutes: 45, effort: 'normal', effortTier: 'standard', xp: 20, xpSource: 'effort-tier-v1' };
    ({ progression } = recordTaskAward(progression, { domainId: 'uni', task, completedAt: `2026-09-${21 + i}T12:00:00Z` }));
  }
  const week = currentWeekProgress(progression, '2026-09-21');
  assert.equal(week.tasks, 5);
  assert.equal(week.taskXP, 100);
  assert.equal(week.bonusXP, 25);
  assert.equal(progressionTotals(progression).earnedXP, 100);
  assert.equal(progressionTotals(progression).levelXP, 125);
  assert.equal(progressionTotals(progression).level, 2);
});
