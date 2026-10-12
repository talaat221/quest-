import { buildWeeklyPlan, questDay, weekOf } from './weekly-planner.js';
import { buildScheduleIntelligence, getTaskPlanningMinutes, getTaskPrediction } from './quest-intelligence.js';
import { elapsedTaskMs, formatMinutes } from './task-timer.js';
import { anchorDate, anchorDays } from './anchors-page.js';
import { getSafeHarborActiveAnchorIds } from './day-pause.js';

export const workloadTime = value => Number(value) > 0 ? formatMinutes(value) : '0m';
export function remainingTaskWork(domain, task, now = new Date()) {
  const estimate = getTaskPlanningMinutes(domain, task);
  const elapsed = Math.max(0, elapsedTaskMs(task, new Date(now).getTime()) / 60000);
  return { estimate, elapsed: Math.round(elapsed),
    remaining: task.done ? 0 : elapsed >= estimate ? 5 : Math.ceil(estimate - elapsed),
    overrun: !task.done && elapsed >= estimate,
    source: Number(task.estimatedMinutes) > 0 ? 'estimate' : getTaskPrediction(domain, task.name) ? 'learned' : 'fallback' };
}

// Advisory only: this never changes a task, starts a timer, or applies a plan.
export function buildQuestAdvice(state, { now = new Date(), todayStr } = {}) {
  const resetHour = Number(state.settings?.dayResetHour) || 0;
  const today = todayStr || questDay(now, resetHour), week = weekOf(today);
  const forecast = buildWeeklyPlan(state, week, state.settings?.planning, { now });
  const tasks = (state.domains || []).flatMap(domain => (domain.tasks || []).map(task => ({
    ...task, domainId: domain.id, ...remainingTaskWork(domain, task, now),
  })));
  const days = forecast.days.map(day => {
    const scheduled = tasks.filter(task => task.day === day.date);
    const adjustment = state.voyageAdjustments?.[day.date];
    const protectedAnchors = getSafeHarborActiveAnchorIds(state, adjustment);
    const anchors = (state.anchors || []).filter(a => anchorDays(a).includes(anchorDate(day.date).getDay() || 7)
      && (adjustment?.mode !== 'harbor' || protectedAnchors.includes(a.id) || a.history?.[day.date]));
    const anchorDuration = a => Math.max(1, Math.min(1440, Number(a.estimatedMinutes) || 15));
    const anchorRemaining = anchors.filter(a => !a.history?.[day.date]).reduce((n,a) => n + anchorDuration(a), 0);
    const completedMinutes = scheduled.filter(t => t.done).reduce((n,t) => n + t.estimate, 0)
      + anchors.filter(a => a.history?.[day.date]).reduce((n,a) => n + anchorDuration(a), 0);
    const progressMinutes = scheduled.filter(t => !t.done).reduce((n,t) => n + Math.min(t.estimate,t.elapsed), 0);
    const remainingMinutes = scheduled.reduce((n,t) => n + t.remaining, 0) + anchorRemaining;
    // Respect both the saved daily budget and the wall-clock time left in its
    // work window. Completed work no longer appears in the remaining workload.
    const remainingCapacity = Math.max(0, Math.min(day.target-completedMinutes-progressMinutes, day.endMinute-day.availableFrom));
    const overByMinutes = Math.max(0,remainingMinutes-remainingCapacity);
    const ratio = remainingCapacity ? remainingMinutes/remainingCapacity : remainingMinutes ? Infinity : 0;
    return { dateKey:day.date, remainingMinutes, completedMinutes, progressMinutes, remainingCapacity,
      plannedMinutes:scheduled.reduce((n,t)=>n+t.estimate,0)+anchors.reduce((n,a)=>n+anchorDuration(a),0),
      anchorMinutes:anchorRemaining, taskMinutes:remainingMinutes-anchorRemaining,
      level:ratio>1?'overloaded':ratio>.85?'full':'comfortable',
      overByMinutes, overrun:scheduled.some(t=>t.overrun), stopped:adjustment?.mode==='harbor', past:day.past };
  });
  const day = days.find(d=>d.dateKey===today);
  const future = days.filter(d=>!d.past);
  const flexible = tasks.filter(t=>!t.done&&!t.day&&(t.plannedWeek||week)===week);
  const overdue = tasks.filter(t=>!t.done&&t.day&&t.day<today);
  const relevant = tasks.filter(t=>!t.done&&(future.some(d=>d.dateKey===t.day)||flexible.includes(t)));
  const flexibleMinutes = flexible.reduce((n,t)=>n+t.remaining,0);
  const totalRemaining = future.reduce((n,d)=>n+d.remainingMinutes,0)+flexibleMinutes;
  const totalCapacity = future.reduce((n,d)=>n+d.remainingCapacity,0);
  const unknown = relevant.filter(t=>t.source==='fallback');
  const overrun = relevant.filter(t=>t.overrun);
  const overloadedDays = future.filter(d=>d.overByMinutes>0);
  const maxSlot = Math.max(0,...forecast.days.filter(d=>!d.past).map(d=>Math.min(d.target,d.endMinute-d.availableFrom)));
  const longTask = flexible.find(t=>t.remaining>maxSlot);
  const notes=[];
  if(day.stopped)notes.push({kind:'rest',title:'Your day is protected',detail:'Stop Day is active. Only the important work you chose needs attention.'});
  else if(day.overByMinutes)notes.push({kind:'today',title:`Make room for ${workloadTime(day.overByMinutes)}`,detail:'Move some unfinished work, reduce its scope, or adjust your available hours. Tasks stay where they are until you apply a plan.'});
  if(overrun.length)notes.push({kind:'estimate',title:'A timer has passed its estimate',detail:`“${overrun[0].name}” is still unfinished. At least 5 minutes is reserved; update the estimate if it needs longer.`});
  if(longTask)notes.push({kind:'split',title:'Split a long session',detail:`“${longTask.name}” needs about ${workloadTime(longTask.remaining)} and cannot fit within any remaining daily budget and work window. Try smaller sessions.`});
  else if(flexibleMinutes)notes.push({kind:'flexible',title:`Give ${workloadTime(flexibleMinutes)} a place`,detail:`Your flexible work is included in the weekly total, but has no assigned day. Preview a plan when you finish adding tasks.`});
  if(totalRemaining>totalCapacity)notes.push({kind:'week',title:`This week is ${workloadTime(totalRemaining-totalCapacity)} over budget`,detail:'The weekly planner can suggest work for next week. You can choose a heavier week if you need to.'});
  if(overdue.length)notes.push({kind:'overdue',title:`${workloadTime(overdue.reduce((n,t)=>n+t.remaining,0))} is overdue`,detail:'Work on earlier dates is separate from this week’s remaining total. Choose a new date for it in Quests.'});
  if(unknown.length)notes.push({kind:'unknown',title:'Some durations are still guesses',detail:`${unknown.length} task${unknown.length===1?' uses':'s use'} a 30-minute fallback. Add estimates or use the timer to improve predictions.`});
  if(forecast.warnings.some(w=>w.includes('overlap')))notes.push({kind:'conflict',title:'Some scheduled times overlap',detail:'Check timed anchors and fixed tasks before applying a weekly plan.'});
  const learning=buildScheduleIntelligence(state.domains||[],[],today,resetHour);
  const title=day.stopped?'Rest day · take it gently':day.overByMinutes?'Today needs more room':!day.remainingMinutes?'Today’s scheduled work is clear':day.level==='full'?'Leave a little breathing room':'A manageable day ahead';
  return {today:day,title,days,flexibleMinutes,totalRemaining,totalCapacity,overloadedDays,notes,
    learnedPatterns:learning.learnedPatterns,timedSamples:learning.timedSamples,capacity:learning.capacity,
    confidence:unknown.length?'Some estimates missing':relevant.some(t=>t.source==='learned')?'Includes learned durations':'Based on your estimates'};
}
