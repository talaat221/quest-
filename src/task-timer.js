// Timers use saved timestamps, never interval ticks, so phone sleep and reloads
// do not drop time. Intervals only repaint the display.
import { getPomodoro, normalizePomodoro, pomodoroDuration } from './pomodoro.js';
export const normalizeTaskTimingKey = (name = '') => name.trim().toLowerCase().replace(/[^a-z0-9\u00C0-\u024F\u0600-\u06FF]+/g, ' ').replace(/\s+/g, ' ').trim();
const profileFor = (domain, name) => domain?.timingProfiles?.[normalizeTaskTimingKey(name)];
export const getTimingSampleCount = (domain, name) => (profileFor(domain, name)?.samples || []).filter(s => Number(s?.actualMinutes) > 0).length;
export function getLearnedEstimate(domain, name) {
  const samples = (profileFor(domain, name)?.samples || []).filter(s => Number(s?.actualMinutes) > 0).slice(-5);
  if (!samples.length) return null;
  const weighted = samples.reduce((sum, s, i) => sum + Number(s.actualMinutes) * (i + 1), 0);
  const value = weighted / samples.reduce((sum, _, i) => sum + i + 1, 0);
  return value < 10 ? Math.max(1, Math.round(value)) : Math.max(5, Math.round(value / 5) * 5);
}
export function formatMinutes(minutes) {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  if (!value) return '—';
  if (value < 60) return `${value}m`;
  return `${Math.floor(value / 60)}h${value % 60 ? ` ${value % 60}m` : ''}`;
}
export const isTaskWorking = task => {
  if (task?.done || !Number.isFinite(Date.parse(task?.workTimer?.startedAt))) return false;
  const pomodoro = getPomodoro(task);
  return !pomodoro || (pomodoro.phase === 'focus' && pomodoro.remainingMs > 0);
};
export const isTaskTimerRunning = task => isTaskWorking(task) || !!getPomodoro(task)?.running;
export function elapsedTaskMs(task, now = Date.now()) {
  const elapsed = Math.max(0, Number(task?.workTimer?.elapsedMs) || 0);
  const started = Date.parse(task?.workTimer?.startedAt);
  if (task?.done || !Number.isFinite(started)) return elapsed;
  const pomodoro = getPomodoro(task, started);
  const delta = Math.max(0, now - started);
  return elapsed + (pomodoro ? pomodoro.phase === 'focus' ? Math.min(delta, pomodoro.remainingMs) : 0 : delta);
}
export function formatElapsed(ms) {
  const seconds = Math.floor(Math.max(0, Number(ms) || 0) / 1000);
  const h = Math.floor(seconds / 3600), m = Math.floor(seconds / 60) % 60, s = seconds % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
export function pauseTaskTimer(task, now = Date.now()) {
  const pomodoro = getPomodoro(task, now);
  task.workTimer = { ...task.workTimer, elapsedMs: elapsedTaskMs(task, now), startedAt: null };
  if (pomodoro) task.workTimer.pomodoro = { ...task.workTimer.pomodoro, remainingMs: pomodoro.remainingMs, runningSince: null };
}
export function configureTaskPomodoro(task, settings, now = Date.now()) {
  if (!task || task.done) return false;
  const previous = getPomodoro(task, now);
  pauseTaskTimer(task, now);
  if (!settings) { delete task.workTimer.pomodoro; return true; }
  const normalized = normalizePomodoro(settings);
  task.workTimer.pomodoro = { ...normalized, phase: 'focus', remainingMs: normalized.focusMinutes * 60000, runningSince: null, rounds: previous?.completedRounds || 0 };
  return true;
}
export function startTaskTimer(domains, domainId, taskId, now = Date.now()) {
  const task = domains.find(d => d.id === domainId)?.tasks.find(t => t.id === taskId);
  if (!task || task.done) return false;
  const current = getPomodoro(task, now);
  if (current ? current.running : Number.isFinite(Date.parse(task.workTimer?.startedAt))) return false;
  for (const domain of domains) for (const other of domain.tasks) {
    if (Number.isFinite(Date.parse(other.workTimer?.startedAt)) || Number.isFinite(Date.parse(other.workTimer?.pomodoro?.runningSince))) pauseTaskTimer(other, now);
  }
  pauseTaskTimer(task, now);
  const stamp = new Date(now).toISOString();
  const pomodoro = task.workTimer.pomodoro;
  if (pomodoro) {
    if (pomodoro.remainingMs === 0) {
      if (pomodoro.phase === 'focus') {
        pomodoro.rounds += 1;
        pomodoro.phase = pomodoro.rounds % 4 === 0 ? 'longBreak' : 'shortBreak';
      } else pomodoro.phase = 'focus';
      pomodoro.remainingMs = pomodoroDuration(normalizePomodoro(pomodoro), pomodoro.phase);
    }
    pomodoro.runningSince = stamp;
    task.workTimer.startedAt = pomodoro.phase === 'focus' ? stamp : null;
  } else task.workTimer.startedAt = stamp;
  return true;
}
export function completeTimedTask(domain, task, now = Date.now()) {
  if (!domain || !task || task.done) return null;
  const elapsedMs = elapsedTaskMs(task, now);
  pauseTaskTimer(task, now);
  task.done = true; task.doneAt = new Date(now).toISOString();
  task.actualMinutes = elapsedMs > 0 ? Math.max(1, Math.round(elapsedMs / 60000)) : null;
  const key = normalizeTaskTimingKey(task.name);
  task.timingProfileKey = elapsedMs > 0 && key ? key : null;
  if (task.timingProfileKey) {
    domain.timingProfiles ||= {};
    const samples = (domain.timingProfiles[key]?.samples || []).filter(s => s.taskId !== task.id);
    samples.push({ taskId: task.id, actualMinutes: task.actualMinutes, estimatedMinutes: Number(task.estimatedMinutes) || null, loggedAt: task.doneAt });
    domain.timingProfiles[key] = { samples: samples.slice(-20) };
  }
  return { taskName: task.name, domainName: domain.name, elapsedMs, estimatedMinutes: task.estimatedMinutes, nextEstimate: getLearnedEstimate(domain, task.name) };
}
export function undoTimedTask(domain, task) {
  if (!domain || !task) return;
  const key = task.timingProfileKey || normalizeTaskTimingKey(task.name);
  if (domain.timingProfiles?.[key]?.samples) domain.timingProfiles[key].samples = domain.timingProfiles[key].samples.filter(s => s.taskId !== task.id);
  task.done = false; task.doneAt = null; task.actualMinutes = null; task.timingProfileKey = null;
  task.workTimer = { elapsedMs: 0, startedAt: null };
}
