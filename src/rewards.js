export const REWARD_KINDS = ['daily', 'weekly'];

// Completed tasks store UTC timestamps; reward periods follow the user's
// local quest day, including their chosen reset hour.
export function rewardTaskDay(doneAt, resetHour = 0) {
  if (!doneAt) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(doneAt)) return doneAt;
  const date = new Date(doneAt);
  if (!Number.isFinite(date.getTime())) return null;
  if (date.getHours() < Math.min(23, Math.max(0, Number(resetHour) || 0))) date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function rewardThreshold(value = 70) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(1, Math.round(number))) : 70;
}

export function rewardProgress({ xp = 0, availableXP = 0, thresholdPct = 70, items = [], claimed = '', blockedReason = '' } = {}) {
  const earned = Math.max(0, Number(xp) || 0);
  const available = Math.max(0, Number(availableXP) || 0);
  const percent = rewardThreshold(thresholdPct);
  const target = available > 0 ? Math.max(1, Math.round(available * percent / 100)) : 0;
  const unlocked = target > 0 && earned >= target;
  const hasRewards = items.some(item => typeof item === 'string' && item.trim());
  const canClaim = unlocked && hasRewards && !claimed && !blockedReason;
  const remaining = Math.max(0, target - earned);
  const message = claimed ? 'Reward claimed. Enjoy your little victory.'
    : blockedReason || (!available ? 'Add tasks or anchors to begin earning XP.'
      : !hasRewards ? 'Add a reward below to fill your chest.'
        : unlocked ? 'Your reward is ready. Open the chest!'
          : `${remaining} more XP until your reward unlocks.`);
  return { earned, available, percent, target, unlocked, canClaim, remaining, message, ratio: target ? Math.min(1, earned / target) : 0 };
}

// Keep the existing string lists and claim snapshots compatible with cloud sync.
export function saveRewardItem(state, kind, text, index = null) {
  if (!REWARD_KINDS.includes(kind)) return false;
  const value = typeof text === 'string' ? text.trim() : '';
  if (!value || value.length > 140) return false;
  state.rewards ||= { daily: [], weekly: [] };
  state.rewards[kind] ||= [];
  if (index === null) state.rewards[kind].push(value);
  else if (Number.isInteger(index) && index >= 0 && index < state.rewards[kind].length) state.rewards[kind][index] = value;
  else return false;
  return true;
}

export function removeRewardItem(state, kind, index) {
  if (!REWARD_KINDS.includes(kind) || !Number.isInteger(index) || index < 0 || index >= (state.rewards?.[kind]?.length || 0)) return false;
  state.rewards[kind].splice(index, 1);
  return true;
}

export function recordRewardClaim(state, kind, periodKey, text, progress) {
  if (!REWARD_KINDS.includes(kind) || !/^\d{4}-\d{2}-\d{2}$/.test(periodKey)) return false;
  const items = state.rewards?.[kind] || [];
  const claimed = state.claimed?.[kind]?.[periodKey];
  const setting = kind === 'daily' ? 'dayThresholdPct' : 'weekThresholdPct';
  if (!items.includes(text) || !rewardProgress({ ...progress, items, claimed, thresholdPct: state.settings?.[setting] ?? 70 }).canClaim) return false;
  state.claimed ||= { daily: {}, weekly: {} };
  state.claimed[kind] ||= {};
  state.claimed[kind][periodKey] = text;
  return true;
}

export function rewardHistory(claimed = {}) {
  return REWARD_KINDS.flatMap(kind => Object.entries(claimed[kind] || {})
    .filter(([date, text]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && typeof text === 'string' && text.trim())
    .map(([date, text]) => ({ kind, date, text })))
    .sort((a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind));
}
