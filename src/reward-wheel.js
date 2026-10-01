import { rewardProgress } from './rewards.js';

export const REWARD_SPIN_MS = 4400;

export function rewardWheelSlots(items) {
  if (!items.length) return [];
  // Small lists repeat evenly, so a chest with one or two treats still has
  // a full wheel. The draw itself gives every saved entry an equal chance.
  const repeats = Math.max(1, Math.ceil(6 / items.length));
  return Array.from({ length: items.length * repeats }, (_, slot) => ({
    text: items[slot % items.length], index: slot % items.length,
  }));
}

export function wheelLandingRotation(slot, count) {
  return 360 * 6 + (360 - ((slot + 0.5) * 360 / count) % 360) % 360;
}

const randomIndex = (random, length) => Math.min(length - 1, Math.max(0, Math.floor((Number(random()) || 0) * length)));

export function prepareRewardSpin(kind, period, rewards, random = Math.random) {
  if (!['daily', 'weekly'].includes(kind) || !period?.periodKey) return null;
  const items = (rewards || []).filter(item => typeof item === 'string' && item.trim());
  if (!rewardProgress({ ...period, items }).canClaim) return null;
  const winnerIndex = randomIndex(random, items.length);
  const slots = rewardWheelSlots(items);
  const winnerSlot = winnerIndex + randomIndex(random, slots.length / items.length) * items.length;
  return {
    id: `${kind}:${period.periodKey}`, kind, periodKey: period.periodKey,
    items, slots, winnerIndex, winnerSlot, reward: items[winnerIndex],
    rotation: wheelLandingRotation(winnerSlot, slots.length),
  };
}

export function prepareRewardSpins(kinds, periods, rewards, seen = new Set(), random = Math.random) {
  return [...new Set(kinds)].flatMap(kind => {
    const period = periods[kind];
    if (!period || seen.has(`${kind}:${period.periodKey}`)) return [];
    const spin = prepareRewardSpin(kind, period, rewards?.[kind], random);
    return spin ? [spin] : [];
  });
}
