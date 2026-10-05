// Shared by the browser and the background worker. All times are timestamps,
// never timer ticks. No task or account data is changed by a reminder.
export const DEFAULT_REMINDERS = Object.freeze({ anchors: true, tasks: true, timers: true, friends: false, review: false, reviewHour: 21 });
export function normalizeReminders(value = {}) {
  return { anchors: value.anchors !== false, tasks: value.tasks !== false, timers: value.timers !== false,
    friends: value.friends === true, review: value.review === true, reviewHour: Number.isInteger(Number(value.reviewHour)) ? Math.min(23, Math.max(0, Number(value.reviewHour))) : 21 };
}
const formatters = new Map();
const zonedTimes = new Map();
export function validTimezone(zone) {
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); return zone || 'UTC'; } catch { return 'UTC'; }
}
function parts(at, zone) {
  if (!formatters.has(zone)) formatters.set(zone, new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }));
  return Object.fromEntries(formatters.get(zone).formatToParts(at).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
}
const dateKey = p => `${p.year}-${p.month}-${p.day}`;
const shift = (day, offset) => new Date(Date.parse(`${day}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
const minutes = hour => hour === null || hour === undefined || hour === '' || !Number.isFinite(Number(hour)) || Number(hour) < 0 || Number(hour) >= 24 ? null : Math.min(1439, Math.round(Number(hour) * 60));
export function zonedTime(day, minute, zone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '') || minute === null) return NaN;
  const cacheKey = `${day}:${minute}:${zone}`;
  if (zonedTimes.has(cacheKey)) return zonedTimes.get(cacheKey);
  const wall = Date.parse(`${day}T00:00:00Z`) + minute * 60000;
  if (!Number.isFinite(wall)) return NaN;
  let result = wall;
  for (let i = 0; i < 4; i++) {
    const p = parts(result, zone);
    const represented = Date.parse(`${dateKey(p)}T${p.hour}:${p.minute}:${p.second}Z`);
    result += wall - represented;
  }
  // Pick the first occurrence on a fall-back day; skip nonexistent spring hours.
  const matches = [result - 3600000, result, result + 3600000].filter(at => {
    const p = parts(at, zone); return dateKey(p) === day && Number(p.hour) * 60 + Number(p.minute) === minute;
  });
  const timestamp = matches.length ? Math.min(...matches) : NaN;
  if (zonedTimes.size >= 512) zonedTimes.delete(zonedTimes.keys().next().value);
  zonedTimes.set(cacheKey, timestamp);
  return timestamp;
}
const text = (value, fallback) => String(value || fallback).slice(0, 100);
const timerActive = task => Number.isFinite(Date.parse(task?.workTimer?.startedAt)) || Number.isFinite(Date.parse(task?.workTimer?.pomodoro?.runningSince));
const safeTask = (task, domainId, adjustment) => adjustment?.mode !== 'harbor' || task.flexibility === 'fixed' || adjustment.protectedKey === `task:${domainId}:${task.id}`;
const safeAnchor = (anchor, adjustment) => adjustment?.mode !== 'harbor' || adjustment.activeAnchorIds?.includes(anchor.id) || adjustment.protectedKey === `anchor:${anchor.id}`;
const scheduled = (anchor, day) => {
  const days = Array.isArray(anchor.activeWeekdays) ? anchor.activeWeekdays.map(Number).filter(n => n >= 1 && n <= 7) : [];
  return !days.length || days.includes(new Date(`${day}T12:00:00Z`).getUTCDay() || 7);
};
export function dueReminders(state, { now = Date.now(), timezone = 'UTC', preferences = DEFAULT_REMINDERS, enabledAt = 0, lookbackMs = 120000 } = {}) {
  if (!state) return [];
  const prefs = normalizeReminders(preferences), zone = validTimezone(timezone);
  const local = parts(now, zone), calendarDay = dateKey(local);
  const reset = Math.min(23, Math.max(0, Number(state.settings?.dayResetHour) || 0)) * 60;
  const questDay = Number(local.hour) * 60 + Number(local.minute) < reset ? shift(calendarDay, -1) : calendarDay;
  const events = [];
  const add = (key, due, title, body, page, kind, ttl = 120) => {
    if (Number.isFinite(due) && due >= enabledAt && due <= now && now - due <= lookbackMs) events.push({ key, due, title, body, page, kind, ttl });
  };
  const relevantDays = [shift(questDay, -1), questDay];
  const scheduledTime = (day, minute) => relevantDays.includes(day) ? zonedTime(minute < reset ? shift(day, 1) : day, minute, zone) : NaN;
  if (prefs.anchors) for (const day of relevantDays) for (const anchor of state.anchors || []) {
    const minute = minutes(anchor.hour);
    if (minute === null || anchor.history?.[day] || !scheduled(anchor, day) || !safeAnchor(anchor, state.voyageAdjustments?.[day])) continue;
    add(`anchor:${anchor.id}:${day}:${minute}`, scheduledTime(day, minute), `Time for ${text(anchor.name, 'your anchor')}`, 'One small step. Your daily anchor is ready.', '#anchors', 'anchor');
  }
  for (const domain of state.domains || []) for (const task of domain.tasks || []) {
    if (task.done) continue;
    const adjustment = state.voyageAdjustments?.[task.day || questDay];
    if (!safeTask(task, domain.id, adjustment)) continue;
    const minute = minutes(task.hour);
    if (prefs.tasks && task.day && minute !== null && !timerActive(task)) add(`task:${domain.id}:${task.id}:${task.day}:${minute}`, scheduledTime(task.day, minute), `Time for ${text(task.name, 'your task')}`, text(domain.name, 'Your quest is waiting.'), '#quests', 'task');
    if (!prefs.timers) continue;
    const timer = task.workTimer || {}, pomo = timer.pomodoro;
    if (pomo && Number.isFinite(Date.parse(pomo.runningSince))) {
      const start = Date.parse(pomo.runningSince), remaining = Number(pomo.remainingMs);
      if (!Number.isFinite(remaining) || remaining <= 0 || remaining > 180 * 60000) continue;
      const focus = pomo.phase === 'focus';
      add(`pomo:${domain.id}:${task.id}:${pomo.phase}:${start}:${remaining}`, start + remaining, focus ? 'Focus complete — time to rest' : 'Break over — ready when you are', `${text(task.name, 'Your task')}. ${focus ? 'Start your break in Quest.' : 'Start your next focus session in Quest.'}`, '#study', 'pomodoro', 300);
    } else if (!pomo && Number.isFinite(Date.parse(timer.startedAt)) && Number(task.estimatedMinutes) > 0) {
      const start = Date.parse(timer.startedAt), budget = Number(task.estimatedMinutes) * 60000 - Math.max(0, Number(timer.elapsedMs) || 0);
      if (budget > 0) add(`timer:${domain.id}:${task.id}:${start}:${budget}`, start + budget, 'Your planned time is up', `${text(task.name, 'Your task')}. Keep going or finish when you’re ready.`, '#study', 'timer', 300);
    }
  }
  if (prefs.review && state.voyageAdjustments?.[questDay]?.mode !== 'harbor') {
    const unfinished = (state.domains || []).flatMap(d => d.tasks || []).filter(t => !t.done && t.day === questDay).length
      + (state.anchors || []).filter(a => !a.history?.[questDay] && scheduled(a, questDay)).length;
    if (unfinished) add(`review:${calendarDay}:${prefs.reviewHour}`, zonedTime(calendarDay, prefs.reviewHour * 60, zone), 'A moment for your day', `${unfinished} ${unfinished === 1 ? 'task is' : 'tasks are'} still open. Review your day at your own pace.`, '#home', 'review');
  }
  return events.sort((a, b) => a.due - b.due);
}
