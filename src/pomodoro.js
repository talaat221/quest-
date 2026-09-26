// Persisted inside the existing task workTimer. Countdown displays are derived
// from timestamps; no interval ticks or background tabs can add break time.
export const DEFAULT_POMODORO = Object.freeze({ focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 });
const limits = { focusMinutes: 180, shortBreakMinutes: 60, longBreakMinutes: 120 };
export function normalizePomodoro(settings = {}) {
  return Object.fromEntries(Object.entries(DEFAULT_POMODORO).map(([key, fallback]) => {
    const value = Number(settings[key]);
    return [key, Number.isFinite(value) ? Math.min(limits[key], Math.max(1, Math.round(value))) : fallback];
  }));
}
export const pomodoroDuration = (settings, phase) => settings[phase === 'shortBreak' ? 'shortBreakMinutes' : phase === 'longBreak' ? 'longBreakMinutes' : 'focusMinutes'] * 60000;
export function getPomodoro(task, now = Date.now()) {
  const saved = task?.workTimer?.pomodoro;
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null;
  const settings = normalizePomodoro(saved);
  const phase = ['shortBreak', 'longBreak'].includes(saved.phase) ? saved.phase : 'focus';
  const durationMs = pomodoroDuration(settings, phase);
  const budget = Number.isFinite(saved.remainingMs) ? Math.min(durationMs, Math.max(0, saved.remainingMs)) : durationMs;
  const started = Date.parse(saved.runningSince);
  const remainingMs = Math.max(0, budget - (Number.isFinite(started) ? Math.max(0, now - started) : 0));
  const rounds = Math.min(1000000, Math.max(0, Math.floor(Number(saved.rounds) || 0)));
  return { ...settings, phase, durationMs, remainingMs, rounds, completedRounds: rounds + (phase === 'focus' && remainingMs === 0 ? 1 : 0), running: !task.done && Number.isFinite(started) && remainingMs > 0 };
}
export function pomodoroActionLabel(pomodoro) {
  if (pomodoro.running) return pomodoro.phase === 'focus' ? 'Pause focus' : 'Pause break';
  if (pomodoro.remainingMs === 0) return pomodoro.phase === 'focus' ? 'Start break' : 'Start focus';
  if (pomodoro.remainingMs < pomodoro.durationMs) return pomodoro.phase === 'focus' ? 'Resume focus' : 'Resume break';
  return pomodoro.phase === 'focus' ? 'Start focus' : 'Start break';
}
export function pomodoroStatus(pomodoro) {
  if (pomodoro.remainingMs === 0) return pomodoro.phase === 'focus' ? 'FOCUS COMPLETE' : 'BREAK OVER';
  const label = pomodoro.phase === 'focus' ? 'FOCUS' : pomodoro.phase === 'longBreak' ? 'LONG BREAK' : 'SHORT BREAK';
  return `${label}${!pomodoro.running && pomodoro.remainingMs < pomodoro.durationMs ? ' PAUSED' : ''}`;
}
export const formatCountdown = ms => {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};
