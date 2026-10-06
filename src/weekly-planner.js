import { anchorDate, anchorDateKey, anchorDays, anchorWeek, shiftAnchorDate } from './anchors-page.js';
import { getTaskPlanningMinutes, getLearnedDailyCapacity } from './quest-intelligence.js';
import { getAnchorTime } from './daily-anchors.js';
import { getSafeHarborActiveAnchorIds } from './day-pause.js';

export const weekOf = day => anchorWeek(day)[0];
const bounded = (value, fallback, min, max) => Number.isFinite(Number(value)) && value !== '' && value != null
  ? Math.min(max, Math.max(min, Math.round(Number(value)))) : fallback;
const taskKey = (domainId, taskId) => `${domainId}:${taskId}`;
const started = task => Number.isFinite(Date.parse(task.workTimer?.startedAt)) || !!task.workTimer?.pomodoro?.runningSince;
export function questDay(now = new Date(), resetHour = 0) {
  const date = new Date(now);
  if (date.getHours() < resetHour) date.setDate(date.getDate() - 1);
  return anchorDateKey(date);
}

export function plannerPreferences(value = {}, domains = [], resetHour = 0) {
  const capacity = getLearnedDailyCapacity(domains, resetHour);
  return {
    dailyMinutes: Array.from({ length: 7 }, (_, i) => bounded(value.dailyMinutes?.[i], capacity.minutes, 0, 960)),
    startMinute: bounded(value.startMinute, 9 * 60, 0, 1439),
    endMinute: bounded(value.endMinute, 21 * 60, 1, 1440),
    bufferMinutes: bounded(value.bufferMinutes, 10, 0, 60),
    reservePercent: 15,
  };
}

export function plannerSignature(state) {
  return JSON.stringify({ domains: (state.domains || []).map(d => ({ id: d.id, tasks: d.tasks, timingProfiles: d.timingProfiles })),
    anchors: state.anchors || [], adjustments: state.voyageAdjustments || {}, reset: state.settings?.dayResetHour || 0 });
}

function overlaps(a, b) { return a.start < b.end && a.end > b.start; }
function findSlot(day, duration, buffer) {
  let start = Math.ceil(day.availableFrom / 5) * 5;
  for (const block of [...day.blocks].sort((a, b) => a.start - b.start)) {
    if (block.end + buffer <= start) continue;
    if (start + duration <= day.endMinute && start + duration + buffer <= block.start) return start;
    start = Math.ceil((block.end + buffer) / 5) * 5;
  }
  return start + duration <= day.endMinute ? start : null;
}

// Times are minutes on the user's quest day, not UTC. 01:00 belongs after
// midnight when resetHour is 04:00. Saved task.hour remains a wall-clock hour.
export function buildWeeklyPlan(state, weekStart, rawPreferences = {}, {
  now = new Date(), rebalance = false, keepAll = false,
} = {}) {
  const resetHour = Number(state.settings?.dayResetHour) || 0, reset = resetHour * 60;
  const preferences = plannerPreferences(rawPreferences, state.domains, resetHour);
  const today = questDay(now, resetHour), currentWeek = weekOf(today), dates = anchorWeek(weekStart);
  const clockMinute = date => date.getHours() * 60 + date.getMinutes();
  const relative = minute => (minute - reset + 1440) % 1440;
  const startMinute = relative(preferences.startMinute);
  let endMinute = relative(preferences.endMinute % 1440);
  if (endMinute <= startMinute) endMinute += 1440;
  const warnings = [];
  if (endMinute > 1440) warnings.push('Your work window crosses the daily reset. Only time before the reset can be planned.');
  const tasks = (state.domains || []).flatMap(domain => (domain.tasks || []).map(task => ({
    ...task, domainId: domain.id, domainName: domain.name, key: taskKey(domain.id, task.id),
    minutes: getTaskPlanningMinutes(domain, task),
    estimateMissing: !(Number(task.estimatedMinutes) > 0),
  })));
  const candidates = tasks.filter(task => !task.done && !started(task) && task.flexibility !== 'fixed'
    && (task.day ? rebalance && dates.includes(task.day) && task.day >= today
      : (task.plannedWeek || currentWeek) === dates[0]));
  const candidateKeys = new Set(candidates.map(task => task.key));
  const days = dates.map((date, index) => {
    const adjustment = state.voyageAdjustments?.[date];
    const factor = adjustment?.mode === 'harbor' ? 0 : adjustment?.mode === 'reduced'
      ? bounded(adjustment.capacityPct, 100, 0, 100) / 100 : 1;
    const past = date < today;
    const capacity = past ? 0 : Math.floor(preferences.dailyMinutes[index] * factor);
    return { date, past, capacity, target: Math.floor(capacity * .85), endMinute: Math.min(1440, endMinute),
      availableFrom: date === today ? Math.max(startMinute, relative(clockMinute(new Date(now))) + 1) : startMinute,
      anchorMinutes: 0, fixedMinutes: 0, proposedMinutes: 0, blocks: [], assignments: [], existing: [], anchorCount: 0 };
  });
  // Reserve anchors, including spills from the previous quest day.
  for (const day of days) {
    for (const sourceDate of [shiftAnchorDate(day.date, -1), day.date]) {
      const adjustment = state.voyageAdjustments?.[sourceDate];
      const allowed = getSafeHarborActiveAnchorIds(state, adjustment);
      for (const anchor of state.anchors || []) {
        if (!anchorDays(anchor).includes(anchorDate(sourceDate).getDay() || 7)) continue;
        if (adjustment?.mode === 'harbor' && !allowed.includes(anchor.id) && !anchor.history?.[sourceDate]) continue;
        const duration = bounded(anchor.estimatedMinutes, 15, 1, 1440), minute = getAnchorTime(anchor.hour);
        const offset = sourceDate === day.date ? 0 : -1440;
        if (!offset) { day.anchorMinutes += duration; day.anchorCount++; }
        if (minute !== null) {
          const start = relative(minute) + offset, end = start + duration;
          if (end > 0 && start < 1440) day.blocks.push({ start, end, name: anchor.name, source: 'anchor' });
        }
      }
    }
    for (const task of tasks) {
      if (candidateKeys.has(task.key)) continue;
      if (task.day === day.date) {
        day.fixedMinutes += task.minutes;
        day.existing.push(task);
      }
      const minute = getAnchorTime(task.hour);
      if (minute === null || !task.day) continue;
      const offset = task.day === day.date ? 0 : task.day === shiftAnchorDate(day.date, -1) ? -1440 : null;
      if (offset === null) continue;
      const start = relative(minute) + offset, end = start + task.minutes;
      if (end > 0 && start < 1440) day.blocks.push({ start, end, name: task.name, source: 'task' });
    }
    day.load = day.anchorMinutes + day.fixedMinutes;
    const inWindow = day.blocks.filter(b => b.end > startMinute && b.start < day.endMinute);
    if (!day.past && inWindow.some((a, i) => inWindow.slice(i + 1).some(b => overlaps(a, b)))) {
      warnings.push(`Some existing times overlap on ${day.date}. Check your fixed tasks and anchors.`);
    }
  }
  const overflow = [];
  // Largest first avoids filling all roomy days with tiny tasks. Deterministic
  // ties make preview/review stable. Fill the lightest feasible day.
  for (const task of [...candidates].sort((a, b) => b.minutes - a.minutes || a.key.localeCompare(b.key))) {
    const possible = days.filter(day => !day.past && day.capacity > 0
      && (keepAll || day.load + task.minutes <= day.target))
      .map(day => ({ day, start: findSlot(day, task.minutes, preferences.bufferMinutes) }))
      .filter(slot => slot.start !== null)
      .sort((a, b) => (a.day.load + task.minutes) / a.day.capacity - (b.day.load + task.minutes) / b.day.capacity || a.day.date.localeCompare(b.day.date));
    const slot = possible[0];
    if (!slot) { overflow.push(task); continue; }
    const assignment = { domainId: task.domainId, taskId: task.id, name: task.name, domainName: task.domainName,
      minutes: task.minutes, day: slot.day.date, hour: ((slot.start + reset) % 1440) / 60,
      fromDay: task.day || null, fromHour: task.hour ?? null, fromWeek: task.plannedWeek || null };
    slot.day.assignments.push(assignment);
    slot.day.blocks.push({ start: slot.start, end: slot.start + task.minutes, name: task.name, source: 'proposed' });
    slot.day.proposedMinutes += task.minutes;
    slot.day.load += task.minutes;
  }
  for (const day of days) day.assignments.sort((a, b) => relative(a.hour * 60) - relative(b.hour * 60));
  const future = days.filter(day => !day.past);
  const unassignedFixed = tasks.filter(task => !task.done && !task.day && task.flexibility === 'fixed' && (task.plannedWeek || currentWeek) === dates[0]);
  if (unassignedFixed.length) warnings.push(`${unassignedFixed.length} fixed task(s) need a date. Choose a date or make them flexible.`);
  const workingUnscheduled = tasks.filter(task => !task.done && !task.day && started(task));
  if (workingUnscheduled.length) warnings.push('A task is already running without a date. Pause it before including it in a plan.');
  if (candidates.some(task => task.estimateMissing)) warnings.push('Missing task estimates use your learned time, or 30 minutes. Add estimates for a better plan.');
  if ((state.anchors || []).some(a => !(Number(a.estimatedMinutes) > 0))) warnings.push('Anchors without a duration reserve 15 minutes each. You can edit this on the Anchors page.');
  if (overflow.some(task => task.minutes > Math.max(0, ...future.map(day => Math.min(day.target, day.endMinute - day.availableFrom))))) {
    warnings.push('A long task will not fit a single day. Break it into smaller sessions; moving it to next week alone may not solve this.');
  }
  const overloadedDays = future.filter(day => day.load > day.target);
  const totalMinutes = future.reduce((sum, day) => sum + day.load, 0) + overflow.reduce((sum, task) => sum + task.minutes, 0);
  const totalCapacity = future.reduce((sum, day) => sum + day.target, 0);
  return { weekStart: dates[0], nextWeek: shiftAnchorDate(dates[0], 7), preferences, days, candidates,
    assignments: days.flatMap(day => day.assignments), overflow, warnings, overloadedDays,
    totalMinutes, totalCapacity, tooHard: overflow.length > 0 || overloadedDays.length > 0 || totalMinutes > totalCapacity,
    signature: plannerSignature(state), createdAt: new Date(now).toISOString(), keepAll };
}

export function applyWeeklyPlan(state, plan, now = new Date()) {
  if (plannerSignature(state) !== plan.signature) throw new Error('Your tasks changed. Make a fresh preview before applying the plan.');
  const today = questDay(now, Number(state.settings?.dayResetHour) || 0);
  const reset = (Number(state.settings?.dayResetHour) || 0) * 60;
  const minute = (new Date(now).getHours() * 60 + new Date(now).getMinutes() - reset + 1440) % 1440;
  if (plan.assignments.some(task => task.day < today || (task.day === today && (Math.round(task.hour * 60) - reset + 1440) % 1440 <= minute))) {
    throw new Error('A proposed start time has passed. Refresh the preview to find a new time.');
  }
  const next = structuredClone(state), moves = [];
  for (const assignment of plan.assignments) moves.push({ ...assignment, plannedWeek: plan.weekStart });
  for (const task of plan.overflow) moves.push({ domainId: task.domainId, taskId: task.id,
    day: null, hour: null, plannedWeek: plan.keepAll ? plan.weekStart : plan.nextWeek });
  for (const move of moves) {
    const task = next.domains.find(d => d.id === move.domainId)?.tasks.find(t => t.id === move.taskId);
    if (!task || task.done || started(task) || task.flexibility === 'fixed') throw new Error('A task is no longer available to move. Please preview again.');
    Object.assign(task, { day: move.day, hour: move.hour, plannedWeek: move.plannedWeek });
  }
  next.settings ||= {};
  next.settings.planning = plan.preferences;
  return next;
}
