import test from 'node:test';
import assert from 'node:assert/strict';
import { competitionWeekStats, rankCompetition } from '../src/competition.js';

test('competition score uses credited weekly XP plus consistency bonus', () => {
  const progression = {
    initializedAt: '2026-09-21T00:00:00.000Z',
    legacyXP: 900,
    weeklyBonuses: { '2026-09-21': 25 },
    taskAwards: {
      a: { creditedXp: 20, tier: 'standard', weekKey: '2026-09-21', dayKey: '2026-09-27', completedAt: '2026-09-27T10:00:00.000Z' },
      b: { creditedXp: 35, tier: 'focused', weekKey: '2026-09-21', dayKey: '2026-09-27', completedAt: '2026-09-27T11:00:00.000Z' },
    },
  };
  const stats = competitionWeekStats({ progression, weekKey: '2026-09-21', todayKey: '2026-09-27' });
  assert.equal(stats.taskXP, 55);
  assert.equal(stats.consistencyXP, 25);
  assert.equal(stats.scoreXP, 80);
  assert.equal(stats.todayXP, 55);
  assert.equal(stats.todayTasks, 2);
});

test('only one routine task counts toward daily competitive task count', () => {
  const progression = {
    initializedAt: '2026-09-21T00:00:00.000Z', legacyXP: 0, weeklyBonuses: {},
    taskAwards: {
      a: { creditedXp: 5, tier: 'routine', weekKey: '2026-09-21', dayKey: '2026-09-27', completedAt: '2026-09-27T08:00:00.000Z' },
      b: { creditedXp: 5, tier: 'routine', weekKey: '2026-09-21', dayKey: '2026-09-27', completedAt: '2026-09-27T09:00:00.000Z' },
      c: { creditedXp: 20, tier: 'standard', weekKey: '2026-09-21', dayKey: '2026-09-27', completedAt: '2026-09-27T10:00:00.000Z' },
    },
  };
  const stats = competitionWeekStats({ progression, weekKey: '2026-09-21', todayKey: '2026-09-27' });
  assert.equal(stats.todayTasks, 2);
  assert.equal(stats.todayXP, 30);
});

test('ranking is descending and stable by name on ties', () => {
  const rows = rankCompetition([{ name: 'Zed', scoreXP: 20 }, { name: 'Amy', scoreXP: 40 }, { name: 'Ben', scoreXP: 20 }]);
  assert.deepEqual(rows.map(row => [row.rank, row.name]), [[1, 'Amy'], [2, 'Ben'], [3, 'Zed']]);
});

test('displayed weekly completion total includes capped zero-XP tasks', () => {
  const stats=competitionWeekStats({weekKey:'2026-10-05',progression:{taskAwards:{
    a:{weekKey:'2026-10-05',creditedXp:20},
    b:{weekKey:'2026-10-05',creditedXp:0},
    c:{weekKey:'2026-09-28',creditedXp:50}
  }}});
  assert.equal(stats.completedTasks,2);
  assert.equal(stats.taskXP,20);
});
