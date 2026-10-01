export const GOAL_PERIODS = ['week', 'month', 'year'];
export const GOAL_PERIOD_NAMES = { week: 'Weekly', month: 'Monthly', year: 'Yearly' };
export const goalId = () => globalThis.crypto?.randomUUID?.() || `goal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const iso = date => date.toISOString().slice(0, 10);
const dateOf = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new Error('Choose a valid date.');
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || iso(date) !== value) throw new Error('Choose a valid date.');
  return date;
};
export function goalPeriodBounds(period, referenceDate) {
  const start = dateOf(referenceDate), end = dateOf(referenceDate);
  if (period === 'week') {
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
    end.setTime(start.getTime()); end.setUTCDate(end.getUTCDate() + 6);
  } else if (period === 'month') {
    start.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() + 1, 0);
  } else if (period === 'year') {
    start.setUTCMonth(0, 1); end.setUTCMonth(11, 31);
  } else throw new Error('Choose a weekly, monthly, or yearly goal.');
  return { startDate: iso(start), endDate: iso(end) };
}
export function makeGoal(draft, previous = null) {
  const title = String(draft.title || '').trim();
  if (!title) throw new Error('Give your goal a name.');
  const period = draft.period;
  const bounds = goalPeriodBounds(period, draft.referenceDate || draft.startDate);
  const tracking = ['manual', 'tasks', 'milestones'].includes(draft.tracking) ? draft.tracking : 'manual';
  const target = Number(draft.target);
  if (tracking !== 'milestones' && (!Number.isInteger(target) || target < 1 || target > 1000000)) throw new Error('Your target must be a whole number between 1 and 1,000,000.');
  const used = new Set();
  const milestones = tracking === 'milestones' ? String(draft.milestoneText || '').split('\n').map(s => s.trim()).filter(Boolean).map((text, index) => {
    const old = previous?.milestones?.find(m => m.title === text && !used.has(m.id)) || previous?.milestones?.[index];
    const retained = old && !used.has(old.id) && old.title === text;
    if (retained) used.add(old.id);
    return { id: retained ? old.id : goalId(), title: text.slice(0, 160), done: retained ? !!old.done : false };
  }) : [];
  if (tracking === 'milestones' && !milestones.length) throw new Error('Add at least one milestone, one per line.');
  if (milestones.length > 50) throw new Error('Use up to 50 milestones per goal.');
  const progress = Number(draft.progress || 0);
  if (!Number.isInteger(progress) || progress < 0 || progress > 1000000) throw new Error('Progress must be a whole number from 0 to 1,000,000.');
  return { id: previous?.id || goalId(), title: title.slice(0, 160), period, ...bounds, tracking,
    target: tracking === 'milestones' ? milestones.length : target,
    unit: tracking === 'tasks' ? 'tasks' : tracking === 'milestones' ? 'milestones' : String(draft.unit || 'steps').trim().slice(0, 30) || 'steps',
    progress, milestones, createdAt: previous?.createdAt || new Date().toISOString() };
}
export function goalProgress(goal, domain, resetHour = 0) {
  let current = Math.max(0, Number(goal.progress) || 0);
  let target = Math.max(1, Number(goal.target) || 1);
  if (goal.tracking === 'milestones') {
    const milestones = Array.isArray(goal.milestones) ? goal.milestones : [];
    current = milestones.filter(m => m.done).length; target = Math.max(1, milestones.length);
  } else if (goal.tracking === 'tasks') {
    current = (domain?.tasks || []).filter(task => {
      if (!task.done || !task.doneAt) return false;
      const date = new Date(task.doneAt);
      if (!Number.isFinite(date.getTime())) return false;
      if (date.getHours() < resetHour) date.setDate(date.getDate() - 1);
      const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return day >= goal.startDate && day <= goal.endDate;
    }).length;
  }
  return { current, target, ratio: Math.min(1, current / target), completed: current >= target };
}
export function allQuestGoals(domains = []) {
  return domains.flatMap(domain => (Array.isArray(domain.goals) ? domain.goals : []).filter(goal => goal?.id && GOAL_PERIODS.includes(goal.period)).map(goal => ({ domain, goal })))
    .sort((a, b) => String(a.goal.endDate).localeCompare(String(b.goal.endDate)) || String(a.goal.title).localeCompare(String(b.goal.title)));
}
export function goalDateLabel(goal) {
  try {
    const start = dateOf(goal.startDate), end = dateOf(goal.endDate);
    if (goal.period === 'year') return String(start.getUTCFullYear());
    if (goal.period === 'month') return start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
  } catch { return 'Choose a date'; }
}
