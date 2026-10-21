// Shared validation; no renderer gets filesystem, shell, or raw IPC access.
export const APP_URL = 'quest://app/';
export const NOTICE_URL = 'quest://notice/';
export const KINDS = new Set(['task', 'anchor', 'pomodoro', 'timer', 'study', 'review', 'competition', 'preview']);
const short = (value, max) => typeof value === 'string' && value.length <= max && !/[\u0000-\u001f]/.test(value);
export function isQuestURL(value, host = 'app') {
  try { const url = new URL(value); return url.protocol === 'quest:' && url.hostname === host && !url.port && !url.username && !url.password; } catch { return false; }
}
export function safePage(value) {
  return typeof value === 'string' && value.length <= 1800 && /^#(?:home|anchors|competition|today-quests|study(?:\/[A-Za-z0-9%_.!~*'()-]+)?|settings\/notifications)$/.test(value) ? value : '#home';
}
export function primaryAction(event) {
  if (event.target?.taskId && ['task', 'study'].includes(event.kind)) return { id: 'start', label: 'Start session' };
  if (event.target?.taskId && event.kind === 'pomodoro') return { id: 'start', label: event.title.startsWith('Focus complete') ? 'Start break' : 'Start focus' };
  return { id: 'open', label: event.kind === 'timer' ? 'Review session' : event.kind === 'anchor' ? 'Open anchor' : 'Open Quest' };
}
export function validateReminder(input, now = Date.now()) {
  if (!input || !short(input.key, 1000) || !input.key || !KINDS.has(input.kind) || !short(input.title, 180) || !short(input.body, 500)) return null;
  const createdAt = Number(input.createdAt), due = Number(input.due || createdAt);
  if (!Number.isFinite(createdAt) || !Number.isFinite(due) || createdAt > now + 10000 || now - createdAt > 120000 || now - due > 120000 || due > now + 10000) return null;
  const target = {};
  for (const key of ['domainId', 'taskId', 'anchorId', 'day', 'runningSince']) {
    if (input.target?.[key] != null) { if (!short(input.target[key], 180)) return null; target[key] = input.target[key]; }
  }
  if (input.target?.minute != null) { const n = input.target.minute; if (!Number.isInteger(n) || n < 0 || n > 1439) return null; target.minute = n; }
  if (target.taskId && !target.domainId) return null;
  return { key: input.key, kind: input.kind, title: input.title, body: input.body, page: safePage(input.page), target, createdAt, due,
    durationMs: [8000, 10000, 12000].includes(input.durationMs) ? input.durationMs : 10000 };
}
export function validUser(value) { return short(value, 100) && !!value; }
export function categoryEnabled(event, preferences) {
  const key = {task:'tasks', anchor:'anchors', timer:'timers', pomodoro:'timers', study:'study', review:'review', competition:'friends'}[event.kind];
  return !key || preferences[key] !== false;
}
export function noticeBounds(area, width = 540, height = 158) {
  const w = Math.min(width, Math.max(280, area.width - 24));
  return { x: Math.round(area.x + (area.width - w) / 2), y: area.y + 24, width: w, height };
}
