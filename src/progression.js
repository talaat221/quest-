export const PROGRESSION_VERSION = 4;
export const ROUTINE_DAILY_XP_CAP = 20;

export const XP_TIERS = Object.freeze([
  Object.freeze({ key: 'routine', label: 'Routine', icon: '🌱', xp: 5, minMinutes: 1, maxMinutes: 14, description: 'Basic daily maintenance or a very quick action.' }),
  Object.freeze({ key: 'light', label: 'Light', icon: '🔹', xp: 10, minMinutes: 15, maxMinutes: 29, description: 'A short task that needs some attention.' }),
  Object.freeze({ key: 'standard', label: 'Standard', icon: '⚔️', xp: 20, minMinutes: 30, maxMinutes: 59, description: 'A meaningful block of focused work.' }),
  Object.freeze({ key: 'focused', label: 'Focused', icon: '🔥', xp: 35, minMinutes: 60, maxMinutes: 119, description: 'Serious sustained effort for around one to two hours.' }),
  Object.freeze({ key: 'deep', label: 'Deep', icon: '👑', xp: 50, minMinutes: 120, maxMinutes: Infinity, description: 'Deep work. Longer sessions keep earning XP at a gentler pace.' }),
]);

export const EFFORT_OPTIONS = Object.freeze([
  Object.freeze({ key: 'low', label: 'Low', shift: -1, description: 'Mostly routine, passive, or mentally light.' }),
  Object.freeze({ key: 'normal', label: 'Normal', shift: 0, description: 'A typical amount of attention for this time.' }),
  Object.freeze({ key: 'high', label: 'High', shift: 1, description: 'Mentally, physically, or creatively demanding.' }),
]);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const cleanMinutes = value => {
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? Math.min(1440, Math.max(1, Math.round(minutes))) : null;
};

export function tierIndexForMinutes(value) {
  const minutes = cleanMinutes(value);
  if (minutes === null) return 1;
  if (minutes < 15) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
}

export function getEffortOption(value = 'normal') {
  return EFFORT_OPTIONS.find(option => option.key === value) || EFFORT_OPTIONS[1];
}

// Keep familiar short-task rewards. Beyond two hours the marginal reward
// decreases: +10/hour to 4h, +6/hour to 8h, then +3/hour. No 50 XP ceiling.
export function longTaskXP(minutes) {
  const extra = Math.max(0, (cleanMinutes(minutes) || 120) - 120);
  return 50 + Math.round(Math.min(extra, 120) / 6
    + Math.min(Math.max(0, extra - 120), 240) / 10
    + Math.max(0, extra - 360) / 20);
}

export function recommendTaskXP({ estimatedMinutes, effort = 'normal' } = {}) {
  const minutes = cleanMinutes(estimatedMinutes);
  const baseIndex = tierIndexForMinutes(minutes);
  const effortOption = getEffortOption(effort);
  const tier = XP_TIERS[clamp(baseIndex + effortOption.shift, 0, XP_TIERS.length - 1)];
  const xp = minutes >= 120 ? longTaskXP(minutes) + effortOption.shift * 15 : tier.xp;
  return {
    ...tier, xp,
    ...(minutes !== null && minutes < 15 ? { key: 'routine', label: 'Routine' } : {}),
    effort: effortOption.key,
    estimatedMinutes: minutes,
    source: 'effort-duration-v2',
  };
}

export function closestTierForXP(value) {
  const xp = Math.max(0, Number(value) || 0);
  return XP_TIERS.reduce((best, tier) => {
    const distance = Math.abs(tier.xp - xp);
    const bestDistance = Math.abs(best.xp - xp);
    return distance < bestDistance || (distance === bestDistance && tier.xp < best.xp) ? tier : best;
  }, XP_TIERS[0]);
}

export function inferEffortForTask(task = {}) {
  if (EFFORT_OPTIONS.some(option => option.key === task.effort)) return task.effort;
  const baseIndex = tierIndexForMinutes(task.estimatedMinutes);
  const savedIndex = XP_TIERS.findIndex(tier => tier.xp === Number(task.xp));
  if (savedIndex < 0) return 'normal';
  const shift = clamp(savedIndex - baseIndex, -1, 1);
  return shift < 0 ? 'low' : shift > 0 ? 'high' : 'normal';
}

export function standardizeLegacyTaskXP(task = {}) {
  if (!task || task.done) return task;
  if (task.xpSource === 'effort-duration-v2') return task;
  const recommendation = cleanMinutes(task.estimatedMinutes) !== null
    ? recommendTaskXP({ estimatedMinutes: task.estimatedMinutes, effort: inferEffortForTask(task) })
    : { ...closestTierForXP(task.xp), effort: 'normal', source: 'legacy-rounded-v1' };
  task.xp = recommendation.xp;
  task.effort = recommendation.effort;
  task.effortTier = recommendation.key;
  task.xpSource = recommendation.source;
  return task;
}

export function applyTaskRecommendation(task, { estimatedMinutes = task?.estimatedMinutes, effort = inferEffortForTask(task) } = {}) {
  const recommendation = recommendTaskXP({ estimatedMinutes, effort });
  return {
    ...task,
    estimatedMinutes: recommendation.estimatedMinutes,
    effort: recommendation.effort,
    effortTier: recommendation.key,
    xp: recommendation.xp,
    xpSource: recommendation.source,
  };
}

export function xpNeededForNextLevel(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  const raw = 100 + 20 * safeLevel + 0.8 * safeLevel * safeLevel;
  return Math.max(125, Math.round(raw / 25) * 25);
}

export function levelProgress(totalProgressionXP) {
  const total = Math.max(0, Math.floor(Number(totalProgressionXP) || 0));
  let level = 1;
  let spent = 0;
  let required = xpNeededForNextLevel(level);

  while (total - spent >= required) {
    spent += required;
    level += 1;
    required = xpNeededForNextLevel(level);
    if (level > 10000) break;
  }

  const current = total - spent;
  return {
    level,
    currentXP: current,
    requiredXP: required,
    remainingXP: Math.max(0, required - current),
    pct: required > 0 ? Math.min(1, current / required) : 0,
    totalXP: total,
    lifetimeThresholdXP: spent,
  };
}

export function weeklyConsistencyBonus(eligibleTaskCount) {
  const count = Math.max(0, Math.floor(Number(eligibleTaskCount) || 0));
  if (count >= 20) return 100;
  if (count >= 15) return 75;
  if (count >= 10) return 50;
  if (count >= 5) return 25;
  return 0;
}

function localDateKey(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function progressionDayKey(doneAt, resetHour = 0) {
  const date = new Date(doneAt);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getHours() < Number(resetHour || 0)) date.setDate(date.getDate() - 1);
  return localDateKey(date);
}

export function progressionWeekKey(doneAt, resetHour = 0) {
  const day = progressionDayKey(doneAt, resetHour);
  if (!day) return null;
  const [year, month, date] = day.split('-').map(Number);
  const local = new Date(year, month - 1, date, 12, 0, 0, 0);
  const jsDay = local.getDay();
  const diff = jsDay === 0 ? -6 : 1 - jsDay;
  local.setDate(local.getDate() + diff);
  return localDateKey(local);
}

export function emptyProgression() {
  return {
    version: PROGRESSION_VERSION,
    legacyXP: 0,
    legacyTaskKeys: {},
    taskAwards: {},
    anchorAwards: {},
    legacyAnchorKeys: {},
    anchorTrackingInitializedAt: null,
    weeklyBonuses: {},
    initializedAt: null,
  };
}

export function normalizeProgression(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    version: PROGRESSION_VERSION,
    legacyXP: Math.max(0, Math.round(Number(source.legacyXP) || 0)),
    legacyTaskKeys: source.legacyTaskKeys && typeof source.legacyTaskKeys === 'object' ? { ...source.legacyTaskKeys } : {},
    taskAwards: source.taskAwards && typeof source.taskAwards === 'object' ? { ...source.taskAwards } : {},
    anchorAwards: source.anchorAwards && typeof source.anchorAwards === 'object' ? { ...source.anchorAwards } : {},
    legacyAnchorKeys: source.legacyAnchorKeys && typeof source.legacyAnchorKeys === 'object' ? { ...source.legacyAnchorKeys } : {},
    anchorTrackingInitializedAt: source.anchorTrackingInitializedAt || null,
    weeklyBonuses: source.weeklyBonuses && typeof source.weeklyBonuses === 'object' ? { ...source.weeklyBonuses } : {},
    initializedAt: source.initializedAt || null,
  };
}

export function currentLegacyXP(domains = [], anchors = []) {
  const taskXP = (domains || []).reduce((total, domain) => total + (domain.tasks || []).reduce(
    (sum, task) => sum + (task.done ? Math.max(0, Number(task.xp) || 0) : 0), 0
  ), 0);
  const anchorXP = (anchors || []).reduce((total, anchor) => total +
    Object.values(anchor.history || {}).filter(Boolean).length * Math.max(0, Number(anchor.xpPerDay) || 0), 0);
  return Math.round(taskXP + anchorXP);
}

const taskAwardKey = (domainId, taskId) => `${domainId}:${taskId}`;

export function initializeProgression(existing, domains = [], anchors = [], now = Date.now()) {
  const progression = normalizeProgression(existing);
  if (progression.initializedAt) return progression;
  progression.legacyXP = currentLegacyXP(domains, anchors);
  for (const domain of domains || []) {
    for (const task of domain.tasks || []) {
      if (task.done && task.id) progression.legacyTaskKeys[taskAwardKey(domain.id, task.id)] = true;
    }
  }
  for (const anchor of anchors || []) {
    for (const [day, done] of Object.entries(anchor.history || {})) {
      if (done) progression.legacyAnchorKeys[`${anchor.id}:${day}`] = Math.max(0, Number(anchor.xpPerDay) || 0);
    }
  }
  progression.anchorTrackingInitializedAt = new Date(now).toISOString();
  progression.initializedAt = new Date(now).toISOString();
  return progression;
}

export function taskAwardXP(progression, domainId, taskId) {
  const award = normalizeProgression(progression).taskAwards[taskAwardKey(domainId, taskId)];
  return Math.max(0, Number(award?.creditedXp) || 0);
}

function creditedRoutineXPForDay(progression, dayKey, excludingKey = '') {
  return [...Object.entries(progression.taskAwards), ...Object.entries(progression.anchorAwards)].reduce((sum, [key, award]) => {
    if (key === excludingKey || award?.dayKey !== dayKey || award?.tier !== 'routine') return sum;
    return sum + Math.max(0, Number(award.creditedXp) || 0);
  }, 0);
}

function eligibleAwardsForWeek(progression, weekKey) {
  const awards = Object.values(progression.taskAwards).filter(award => award?.weekKey === weekKey && Number(award.creditedXp) > 0);
  const routineDays = new Set();
  let count = 0;
  for (const award of awards.sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)))) {
    if (award.tier === 'routine') {
      if (routineDays.has(award.dayKey)) continue;
      routineDays.add(award.dayKey);
    }
    count += 1;
  }
  return count;
}

function refreshWeekBonus(progression, weekKey) {
  if (!weekKey) return;
  progression.weeklyBonuses[weekKey] = weeklyConsistencyBonus(eligibleAwardsForWeek(progression, weekKey));
}

export function recordTaskAward(existing, { domainId, task, completedAt = Date.now(), resetHour = 0 } = {}) {
  const progression = normalizeProgression(existing);
  if (!domainId || !task?.id) return { progression, award: null };
  const key = taskAwardKey(domainId, task.id);
  if (progression.legacyTaskKeys[key]) return { progression, award: null };
  if (progression.taskAwards[key]) return { progression, award: progression.taskAwards[key] };

  const estimate = cleanMinutes(task.estimatedMinutes);
  const recommendation = estimate !== null
    ? recommendTaskXP({ estimatedMinutes: estimate, effort: inferEffortForTask(task) })
    : { ...closestTierForXP(task.xp), effort: 'normal', source: 'legacy-rounded-v1' };
  const tier = recommendation.key;
  const nominalXp = recommendation.xp;
  const completedDate = completedAt instanceof Date ? completedAt : new Date(completedAt);
  if (Number.isNaN(completedDate.getTime())) return { progression, award: null };
  const completedIso = completedDate.toISOString();
  const dayKey = progressionDayKey(completedIso, resetHour);
  const weekKey = progressionWeekKey(completedIso, resetHour);
  const routineUsed = tier === 'routine' ? creditedRoutineXPForDay(progression, dayKey, key) : 0;
  const creditedXp = tier === 'routine'
    ? Math.max(0, Math.min(nominalXp, ROUTINE_DAILY_XP_CAP - routineUsed))
    : nominalXp;

  const award = {
    domainId,
    taskId: task.id,
    taskName: task.name || '',
    nominalXp,
    creditedXp,
    tier,
    effort: task.effort || recommendation.effort || inferEffortForTask(task),
    completedAt: completedIso,
    dayKey,
    weekKey,
    source: recommendation.source,
  };
  progression.taskAwards[key] = award;
  refreshWeekBonus(progression, weekKey);
  return { progression, award };
}

export function removeTaskAward(existing, domainId, taskId, task = null) {
  const progression = normalizeProgression(existing);
  const key = taskAwardKey(domainId, taskId);
  const previous = progression.taskAwards[key];
  if (!previous) {
    if (progression.legacyTaskKeys[key] && task) {
      progression.legacyXP = Math.max(0, progression.legacyXP - (Number(task.xp) || 0));
      delete progression.legacyTaskKeys[key];
    }
    return progression;
  }
  delete progression.taskAwards[key];
  refreshWeekBonus(progression, previous.weekKey);
  return progression;
}

// v3 counted only the anchor history present at its first initialization.
// Recover subsequent recorded days once; that first day stays in the legacy
// snapshot because its history has no reliable per-completion timestamp.
export function upgradeProgression(existing, domains = [], anchors = [], now = Date.now(), resetHour = 0) {
  const progression = initializeProgression(existing, domains, anchors, now);
  if (!progression.anchorTrackingInitializedAt) {
    const initialDay = progressionDayKey(progression.initializedAt, resetHour);
    for (const anchor of anchors || []) {
      for (const [day, done] of Object.entries(anchor.history || {})) {
        if (!done) continue;
        const key = `${anchor.id}:${day}`, xp = Math.max(0, Number(anchor.xpPerDay) || 0);
        if (initialDay && day <= initialDay) progression.legacyAnchorKeys[key] = xp;
        else if (!progression.anchorAwards[key]) progression.anchorAwards[key] = {
          anchorId: anchor.id, taskName: anchor.name, dayKey: day,
          nominalXp: xp, creditedXp: xp, source: 'anchor-history-recovery', tier: 'legacy',
        };
      }
    }
    progression.anchorTrackingInitializedAt = new Date(now).toISOString();
  }
  return progression;
}

export function anchorAwardXP(existing, anchor, day) {
  const key = `${anchor.id}:${day}`;
  const award = existing?.anchorAwards?.[key];
  if (award) return Math.max(0, Number(award.creditedXp) || 0);
  if (Object.hasOwn(existing?.legacyAnchorKeys || {}, key)) return existing.legacyAnchorKeys[key];
  return Math.max(0, Number(anchor.xpPerDay) || 0);
}

export function recordAnchorAward(existing, { anchor, dayKey, completedAt = Date.now() } = {}) {
  const progression = normalizeProgression(existing), key = `${anchor?.id}:${dayKey}`;
  if (!anchor?.id || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey || '')) return { progression, award: null };
  if (Object.hasOwn(progression.legacyAnchorKeys, key)) return { progression, award: null };
  if (progression.anchorAwards[key]) return { progression, award: progression.anchorAwards[key] };
  // Existing anchors keep their saved reward until their duration/effort is edited.
  const recommendation = recommendTaskXP(anchor);
  const nominalXp = anchor.xpSource === 'effort-duration-v2' ? recommendation.xp : Math.max(0, Number(anchor.xpPerDay) || 0);
  const tier = anchor.xpSource === 'effort-duration-v2' ? recommendation.key : 'legacy';
  const creditedXp = tier === 'routine'
    ? Math.max(0, Math.min(nominalXp, ROUTINE_DAILY_XP_CAP - creditedRoutineXPForDay(progression, dayKey))) : nominalXp;
  const award = { anchorId: anchor.id, taskName: anchor.name, nominalXp, creditedXp, tier,
    dayKey, completedAt: new Date(completedAt).toISOString(), source: anchor.xpSource || 'anchor-saved-reward' };
  progression.anchorAwards[key] = award;
  return { progression, award };
}

export function removeAnchorAward(existing, anchorId, dayKey) {
  const progression = normalizeProgression(existing), key = `${anchorId}:${dayKey}`;
  delete progression.anchorAwards[key];
  if (Object.hasOwn(progression.legacyAnchorKeys, key)) {
    progression.legacyXP = Math.max(0, progression.legacyXP - progression.legacyAnchorKeys[key]);
    delete progression.legacyAnchorKeys[key];
  }
  return progression;
}

export function progressionTotals(existing) {
  const progression = normalizeProgression(existing);
  const taskXP = Object.values(progression.taskAwards).reduce((sum, award) => sum + Math.max(0, Number(award?.creditedXp) || 0), 0);
  const weeklyBonusXP = Object.values(progression.weeklyBonuses).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  const anchorXP = Object.values(progression.anchorAwards).reduce((sum, award) => sum + Math.max(0, Number(award?.creditedXp) || 0), 0);
  const earnedXP = progression.legacyXP + taskXP + anchorXP;
  const levelXP = earnedXP + weeklyBonusXP;
  return {
    legacyXP: progression.legacyXP,
    taskXP,
    anchorXP,
    weeklyBonusXP,
    earnedXP,
    levelXP,
    ...levelProgress(levelXP),
  };
}

export function currentWeekProgress(existing, weekKey) {
  const progression = normalizeProgression(existing);
  const end = new Date(`${weekKey}T12:00:00`); end.setDate(end.getDate() + 7);
  const endKey = localDateKey(end);
  const awards = Object.values(progression.taskAwards).filter(award => award?.weekKey === weekKey);
  return {
    taskXP: awards.reduce((sum, award) => sum + Math.max(0, Number(award?.creditedXp) || 0), 0),
    anchorXP: Object.values(progression.anchorAwards).filter(award => award.dayKey >= weekKey && award.dayKey < endKey).reduce((sum, award) => sum + Math.max(0, Number(award.creditedXp) || 0), 0),
    tasks: eligibleAwardsForWeek(progression, weekKey),
    bonusXP: Math.max(0, Number(progression.weeklyBonuses[weekKey]) || 0),
  };
}
