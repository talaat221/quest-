// Shared by the browser and the background worker. All times are timestamps,
// never timer ticks. No task or account data is changed by a reminder.
export const DEFAULT_REMINDERS = Object.freeze({ anchors: true, tasks: true, timers: true, friends: false, review: false, reviewHour: 21, reviewEveryHours: 0, leadMinutes: 0, study: false, studyAfterMinutes: 30, sound: false, bannerSeconds: 10, badgeAnchors: true });
export function normalizeReminders(value = {}) {
  return { anchors: value.anchors !== false, tasks: value.tasks !== false, timers: value.timers !== false,
    friends: value.friends === true, review: value.review === true, reviewEveryHours: [0,3,6].includes(Number(value.reviewEveryHours)) ? Number(value.reviewEveryHours) : 0,
    leadMinutes: [0,5,10].includes(Number(value.leadMinutes)) ? Number(value.leadMinutes) : 0,
    study: value.study === true, studyAfterMinutes: [15,30,60].includes(Number(value.studyAfterMinutes)) ? Number(value.studyAfterMinutes) : 30,
    sound: value.sound === true, bannerSeconds: [8,10,12].includes(Number(value.bannerSeconds)) ? Number(value.bannerSeconds) : 10, badgeAnchors: value.badgeAnchors !== false,
    reviewHour: Number.isInteger(Number(value.reviewHour)) ? Math.min(23, Math.max(0, Number(value.reviewHour))) : 21 };
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
  const add = (key, due, title, body, page, kind, ttl = 120, target = null) => {
    if (Number.isFinite(due) && due >= enabledAt && due <= now && now - due <= lookbackMs) events.push({ key, due, title, body, page: target?.taskId ? `#study/${encodeURIComponent(JSON.stringify([target.domainId,target.taskId]))}` : page, kind, ttl, target });
  };
  const relevantDays = [shift(questDay, -1), questDay, shift(questDay, 1)];
  const scheduledTime = (day, minute) => relevantDays.includes(day) ? zonedTime(minute < reset ? shift(day, 1) : day, minute, zone) : NaN;
  if (prefs.anchors) for (const day of relevantDays) for (const anchor of state.anchors || []) {
    const minute = minutes(anchor.hour);
    if (minute === null || anchor.history?.[day] || !scheduled(anchor, day) || !safeAnchor(anchor, state.voyageAdjustments?.[day])) continue;
    add(`anchor:${anchor.id}:${day}:${minute}${prefs.leadMinutes ? `:lead:${prefs.leadMinutes}` : ''}`, scheduledTime(day, minute) - prefs.leadMinutes * 60000, `${prefs.leadMinutes ? `In ${prefs.leadMinutes} minutes: ` : 'Time for '}${text(anchor.name, 'your anchor')}`, 'One small step. Your daily anchor is ready.', '#anchors', 'anchor', 120, { anchorId: anchor.id, day, minute });
  }
  for (const domain of state.domains || []) for (const task of domain.tasks || []) {
    if (task.done) continue;
    const adjustment = state.voyageAdjustments?.[task.day || questDay];
    if (!safeTask(task, domain.id, adjustment)) continue;
    const minute = minutes(task.hour);
    if (prefs.tasks && task.day && minute !== null && !timerActive(task)) add(`task:${domain.id}:${task.id}:${task.day}:${minute}${prefs.leadMinutes ? `:lead:${prefs.leadMinutes}` : ''}`, scheduledTime(task.day, minute) - prefs.leadMinutes * 60000, `${prefs.leadMinutes ? `In ${prefs.leadMinutes} minutes: ` : 'Time for '}${text(task.name, 'your task')}`, text(domain.name, 'Your quest is waiting.'), '#study', 'task', 120, { domainId: domain.id, taskId: task.id, day: task.day, minute });
    const pausedAt = Date.parse(task.workTimer?.pausedAt);
    if (prefs.study && Number.isFinite(pausedAt) && !timerActive(task) && task.day === questDay) {
      add(`study:${domain.id}:${task.id}:${pausedAt}`, pausedAt + prefs.studyAfterMinutes * 60000, 'Ready to settle back in?', text(task.name, 'Your study session is waiting.'), '#study', 'study', 120, { domainId: domain.id, taskId: task.id, day: task.day });
    }
    if (!prefs.timers) continue;
    const timer = task.workTimer || {}, pomo = timer.pomodoro;
    if (pomo && Number.isFinite(Date.parse(pomo.runningSince))) {
      const start = Date.parse(pomo.runningSince), remaining = Number(pomo.remainingMs);
      if (!Number.isFinite(remaining) || remaining <= 0 || remaining > 180 * 60000) continue;
      const focus = pomo.phase === 'focus';
      add(`pomo:${domain.id}:${task.id}:${pomo.phase}:${start}:${remaining}`, start + remaining, focus ? 'Focus complete — time to rest' : 'Break over — ready when you are', `${text(task.name, 'Your task')}. ${focus ? 'Start your break in Quest.' : 'Start your next focus session in Quest.'}`, '#study', 'pomodoro', 300, { domainId: domain.id, taskId: task.id, runningSince: pomo.runningSince });
    } else if (!pomo && Number.isFinite(Date.parse(timer.startedAt)) && Number(task.estimatedMinutes) > 0) {
      const start = Date.parse(timer.startedAt), budget = Number(task.estimatedMinutes) * 60000 - Math.max(0, Number(timer.elapsedMs) || 0);
      if (budget > 0) add(`timer:${domain.id}:${task.id}:${start}:${budget}`, start + budget, 'Your planned time is up', `${text(task.name, 'Your task')}. Keep going or finish when you’re ready.`, '#study', 'timer', 300, { domainId: domain.id, taskId: task.id, runningSince: timer.startedAt });
    }
  }
  if (prefs.review && state.voyageAdjustments?.[questDay]?.mode !== 'harbor') {
    const unfinished = (state.domains || []).flatMap(d => d.tasks || []).filter(t => !t.done && t.day === questDay).length
      + (state.anchors || []).filter(a => !a.history?.[questDay] && scheduled(a, questDay)).length;
    const studying = (state.domains || []).some(d => (d.tasks || []).some(t => !t.done && timerActive(t)));
    for (let hour = prefs.reviewHour; hour < 24; hour += prefs.reviewEveryHours || 24) {
      if (unfinished && !studying) add(`review:${calendarDay}:${hour}`, zonedTime(calendarDay, hour * 60, zone), 'A moment for your day', `${unfinished} ${unfinished === 1 ? 'task is' : 'tasks are'} still open. Review your day at your own pace.`, '#home', 'review');
    }
  }
  return events.sort((a, b) => a.due - b.due);
}

// Used for badge payloads when push wakes an otherwise closed app.
export function remainingToday(state, { now = Date.now(), timezone = 'UTC', includeAnchors = true } = {}) {
  if (!state) return 0;
  const local = parts(now, validTimezone(timezone));
  const reset = Math.min(23, Math.max(0, Number(state.settings?.dayResetHour) || 0));
  const day = Number(local.hour) < reset ? shift(dateKey(local), -1) : dateKey(local);
  const adjustment = state.voyageAdjustments?.[day];
  return (state.domains || []).reduce((n,d) => n + (d.tasks || []).filter(t => t.day === day && !t.done).length, 0)
    + (includeAnchors ? (state.anchors || []).filter(a => !a.history?.[day] && scheduled(a,day) && safeAnchor(a,adjustment)).length : 0);
}
export function reminderStillRelevant(state, event, options = {}) {
  const target = event?.target;
  if (!target) return event?.kind === 'review' ? remainingToday(state, options) > 0 : true;
  if (target.anchorId) {
    const anchor = state?.anchors?.find(a => a.id === target.anchorId);
    return !!anchor && !anchor.history?.[target.day] && scheduled(anchor,target.day) && safeAnchor(anchor,state.voyageAdjustments?.[target.day]) && minutes(anchor.hour) === target.minute;
  }
  const task = state?.domains?.find(d => d.id === target.domainId)?.tasks?.find(t => t.id === target.taskId);
  if (!task || task.done || !safeTask(task,target.domainId,state.voyageAdjustments?.[task.day])) return false;
  if (target.runningSince) return (task.workTimer?.pomodoro?.runningSince || task.workTimer?.startedAt) === target.runningSince;
  return task.day === target.day && !timerActive(task) && (target.minute == null || minutes(task.hour) === target.minute);
}
