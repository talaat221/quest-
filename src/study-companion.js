import { elapsedTaskMs, formatElapsed } from './task-timer.js';
import { formatCountdown, getPomodoro, pomodoroActionLabel } from './pomodoro.js';
export function companionTimer(task, now = Date.now()) {
  const pomo = getPomodoro(task, now);
  const running = !task?.done && (pomo ? pomo.running : Number.isFinite(Date.parse(task?.workTimer?.startedAt)));
  const activity = running ? pomo && pomo.phase !== 'focus' ? 'break' : 'studying' : 'idle';
  return { running, activity, text: pomo ? formatCountdown(pomo.remainingMs) : formatElapsed(elapsedTaskMs(task, now)),
    status: pomo ? pomo.remainingMs === 0 ? 'Round complete' : pomo.phase === 'focus' ? running ? 'Focusing' : 'Focus paused' : running ? 'Taking a break' : 'Break paused' : running ? 'Studying' : task ? 'Ready when you are' : 'Choose a task in Quest',
    action: running ? 'Pause' : pomo ? pomodoroActionLabel(pomo) : elapsedTaskMs(task, now) > 0 ? 'Resume' : 'Start' };
}
export function clampCompanionPosition(position, viewport, size) {
  return { x: Math.min(Math.max(8, position.x), Math.max(8, viewport.width - size.width - 8)),
    y: Math.min(Math.max(8, position.y), Math.max(8, viewport.height - size.height - 8)) };
}
