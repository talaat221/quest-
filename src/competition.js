import { currentWeekProgress, normalizeProgression } from './progression.js';

const xp = value => Math.max(0, Math.round(Number(value) || 0));

function eligibleDailyTaskCount(awards = []) {
  const sorted = [...awards]
    .filter(award => xp(award?.creditedXp) > 0)
    .sort((a, b) => String(a?.completedAt || '').localeCompare(String(b?.completedAt || '')));

  let routineCounted = false;
  return sorted.reduce((count, award) => {
    if (award?.tier === 'routine') {
      if (routineCounted) return count;
      routineCounted = true;
    }
    return count + 1;
  }, 0);
}

export function competitionWeekStats({ progression, weekKey, todayKey } = {}) {
  const normalized = normalizeProgression(progression);
  const week = currentWeekProgress(normalized, weekKey);
  const todayAwards = Object.values(normalized.taskAwards || {}).filter(
    award => award?.dayKey === todayKey
  );

  return {
    completedTasks: Object.values(normalized.taskAwards || {}).filter(award => award?.weekKey === weekKey).length,
    scoreXP: xp(week.taskXP) + xp(week.bonusXP),
    taskXP: xp(week.taskXP),
    consistencyXP: xp(week.bonusXP),
    eligibleTasks: Math.max(0, Number(week.tasks) || 0),
    todayXP: todayAwards.reduce((sum, award) => sum + xp(award?.creditedXp), 0),
    todayTasks: eligibleDailyTaskCount(todayAwards),
  };
}

export function rankCompetition(entries = []) {
  return [...entries]
    .map(entry => ({ ...entry, scoreXP: xp(entry?.scoreXP) }))
    .sort((a, b) => b.scoreXP - a.scoreXP || String(a.name || '').localeCompare(String(b.name || '')))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
