export const STUDY_CAPACITY = 6;
export const PRESENCE_TTL_MS = 65000;
export const CHARACTER_LOOKS = [
  { id: 0, name: 'Moss', detail: 'Wavy hair · sage sweater', color: '#a5b782' },
  { id: 1, name: 'Maple', detail: 'Soft bob · terracotta cardigan', color: '#d39778' },
  { id: 2, name: 'Cedar', detail: 'Short curls · golden sweater', color: '#dcc16d' },
  { id: 3, name: 'Willow', detail: 'Long braid · blue sweater', color: '#94b7c6' },
  { id: 4, name: 'Olive', detail: 'Olive hijab · cream sweater', color: '#bcc797' },
  { id: 5, name: 'Ash', detail: 'Silver hair · plum sweater', color: '#c6a7c4' },
];
export function normalizeLook(value) {
  const id = Number(value);
  return Number.isInteger(id) && id >= 0 && id < CHARACTER_LOOKS.length ? id : 0;
}

// The atlas remains a single original raster asset. SVG windows isolate its
// frames without recoloring skin or stretching different characters to fit.
export function characterFrame(lookId, studying = false) {
  const id = normalizeLook(lookId), column = id % 3;
  const row = (id < 3 ? 0 : 2) + Number(studying);
  return { x: [111, 427, 745][column], y: [0, 365, 724, 1087][row], width: 230, height: [365, 360, 363, 361][row] };
}
export function studyPresence({ activity = 'idle', elapsedMs = 0, taskName = '', shareTask = false } = {}) {
  const state = ['idle', 'studying', 'break', 'away'].includes(activity) ? activity : 'idle';
  const data = { activity: state, elapsedSeconds: Math.min(604800, Math.max(0, Math.floor((Number(elapsedMs) || 0) / 1000))) };
  // Hidden names never leave the browser, including during reconnects.
  if (shareTask && state !== 'away') data.taskName = String(taskName || '').trim().slice(0, 160);
  return data;
}
export function memberActivity(member, now = Date.now()) {
  if (member.status !== 'joined') return 'invited';
  const last = Date.parse(member.lastSeenAt);
  if (!Number.isFinite(last) || now - last > PRESENCE_TTL_MS) return 'away';
  return ['idle','studying','break','away'].includes(member.activity) ? member.activity : 'idle';
}
export function memberElapsed(member, now = Date.now()) {
  const base = Math.max(0, Number(member.elapsedSeconds) || 0);
  return Math.floor(base + (memberActivity(member, now) === 'studying' ? Math.max(0, now - Date.parse(member.lastSeenAt)) / 1000 : 0));
}
export function studyTime(seconds) {
  const n = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(n / 3600) ? `${Math.floor(n / 3600)}:` : ''}${String(Math.floor(n / 60) % 60).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}
export function sharedTaskLabel(member, now) {
  if (memberActivity(member, now) === 'away') return 'Away from the room';
  return member.shareTask && member.taskName ? member.taskName : 'Task kept private';
}
