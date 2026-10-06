import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { anchorDate, shiftAnchorDate } from './anchors-page.js';
import { buildWeeklyPlan, plannerPreferences, weekOf } from './weekly-planner.js';
import { formatMinutes } from './task-timer.js';
import { formatScheduleTime, parseTimeInput, isTimeInputValid } from './schedule-time.js';
import TimeInput from './TimeInput.jsx';
import './weekly-planner.css';

const dateLabel = day => anchorDate(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const dayLabel = day => anchorDate(day).toLocaleDateString(undefined, { weekday: 'short' });
const minutesLabel = value => value ? formatMinutes(value) : '0m';

export function TaskWeekField({ value, onChange, todayStr }) {
  return <label className="wp-task-week">Week for this task
    <input type="date" aria-label="Task week" value={value || weekOf(todayStr)}
      onChange={event => { if (event.target.value) onChange(weekOf(event.target.value)); }} />
    <small>Week of {dateLabel(value || weekOf(todayStr))}. Leave the task date empty to let Quest plan it.</small>
  </label>;
}

function PlannerDialog({ state, week, onClose, onApply }) {
  const dialog = useRef(null), title = useId();
  const [preferences, setPreferences] = useState(() => plannerPreferences(state.settings?.planning, state.domains, state.settings?.dayResetHour));
  const [start, setStart] = useState(formatScheduleTime(preferences.startMinute / 60));
  const [end, setEnd] = useState(formatScheduleTime(preferences.endMinute / 60));
  const [rebalance, setRebalance] = useState(false), [keepAll, setKeepAll] = useState(false);
  const [plan, setPlan] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    const opener = document.activeElement;
    dialog.current.showModal();
    return () => { if (opener?.isConnected) opener.focus(); };
  }, []);
  const changePreferences = patch => { setPreferences(current => ({ ...current, ...patch })); setPlan(null); setError(''); };
  const preview = () => {
    if (!isTimeInputValid(start, true) || !isTimeInputValid(end, true) || start === end) {
      setError('Choose a valid work window with a different start and end time.'); return;
    }
    const next = { ...preferences, startMinute: Math.round(parseTimeInput(start) * 60), endMinute: Math.round(parseTimeInput(end) * 60) };
    setPreferences(next);
    setPlan(buildWeeklyPlan(state, week, next, { rebalance, keepAll })); setError('');
  };
  return <dialog className="wp-dialog" ref={dialog} aria-labelledby={title} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="wp-heading"><div><small>MAKE ROOM FOR WHAT MATTERS</small><h2 id={title}>Plan your week</h2><p>{dateLabel(week)} – {dateLabel(shiftAnchorDate(week, 6))}</p></div>
      <button type="button" className="wp-close" aria-label="Close weekly planner" onClick={onClose}>×</button></header>
    <p className="wp-intro">Quest places your flexible tasks around timed anchors and existing appointments. Review the plan, then apply it.</p>
    <fieldset className="wp-capacity"><legend>Available hours each day</legend>
      <p>Includes your tasks and anchors. Set 0 for a day off. Quest leaves 15% free for breathing room.</p>
      <div className="wp-capacity-grid">{preferences.dailyMinutes.map((minutes, index) => <label key={index}>
        <span>{dayLabel(shiftAnchorDate(week, index))}</span><input type="number" min="0" max="16" step="0.25" inputMode="decimal"
          aria-label={`${dayLabel(shiftAnchorDate(week, index))} available hours`} value={minutes / 60}
          onChange={event => changePreferences({ dailyMinutes: preferences.dailyMinutes.map((v, i) => i === index ? Math.max(0, Math.min(960, Math.round(Number(event.target.value) * 60))) : v) })} />
      </label>)}</div>
    </fieldset>
    <div className="wp-time-window">
      <TimeInput label="Start of work window" value={start} required onChange={value => { setStart(value); setPlan(null); }} />
      <TimeInput label="End of work window" value={end} required onChange={value => { setEnd(value); setPlan(null); }} />
    </div>
    <label className="wp-check"><input type="checkbox" checked={rebalance} onChange={event => { setRebalance(event.target.checked); setPlan(null); }} />Also rebalance flexible tasks already dated in this week</label>
    <label className="wp-check"><input type="checkbox" checked={keepAll} onChange={event => { setKeepAll(event.target.checked); setPlan(null); }} />I need everything this week, even if the workload is heavy</label>
    <p className="wp-note">Fixed tasks, running timers and completed work stay in place. A 10-minute gap is left between timed activities. An anytime anchor reserves workload without choosing an hour for you.</p>
    <button className="wp-button" type="button" onClick={preview}>{plan ? 'Refresh preview' : 'Preview my plan'}</button>
    {plan && <section className="wp-preview" aria-label="Weekly plan preview">
      <div className={`wp-advice${plan.tooHard ? ' is-heavy' : ''}`} role="status"><strong>{plan.tooHard ? 'This week needs more room' : 'A week with room to breathe'}</strong>
        <p>{minutesLabel(plan.totalMinutes)} of work · {minutesLabel(plan.totalCapacity)} suggested capacity.</p>
        <p>{plan.assignments.length} flexible task{plan.assignments.length === 1 ? '' : 's'} placed{plan.overflow.length ? ` · ${plan.overflow.length} ${keepAll ? 'will stay flexible this week' : 'suggested for next week'}` : ''}.</p>
      </div>
      <div className="wp-plan-days">{plan.days.map(day => <article key={day.date} className={`wp-day${day.past ? ' is-past' : ''}${!day.past && day.load > day.target ? ' is-heavy' : ''}`}>
        <header><b>{dayLabel(day.date)} <small>{dateLabel(day.date)}</small></b><span>{day.past ? 'Past day' : `${minutesLabel(day.load)} / ${minutesLabel(day.target)}`}</span></header>
        {!day.past && <><meter min="0" max={Math.max(1, day.target)} value={day.load} aria-label={`${dayLabel(day.date)} workload`} />
          <small>{minutesLabel(day.anchorMinutes)} anchors · {minutesLabel(day.fixedMinutes)} existing tasks</small></>}
        {day.assignments.map(task => <div className="wp-assignment" key={`${task.domainId}:${task.taskId}`}>
          <time>{formatScheduleTime(task.hour)}</time><span>{task.name}<small>{task.domainName} · {formatMinutes(task.minutes)}</small></span>
        </div>)}
        {!day.past && !day.assignments.length && <p className="wp-note">{day.capacity ? 'No new tasks placed here.' : 'Day off / stopped.'}</p>}
      </article>)}</div>
      {plan.overflow.length > 0 && <div className="wp-overflow"><h3>{keepAll ? 'Still flexible this week' : `Move to the week of ${dateLabel(plan.nextWeek)}`}</h3>
        <p>{keepAll ? 'These need a longer free slot. Split a long task or choose a date yourself.' : 'These stay in your quests, ready for next week’s plan.'}</p>
        {plan.overflow.map(task => <div key={task.key}><span>{task.name}</span><b>{formatMinutes(task.minutes)}</b></div>)}
      </div>}
      {plan.warnings.length > 0 && <ul className="wp-warnings">{plan.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
      <button className="wp-button" type="button" disabled={!plan.assignments.length && !plan.overflow.length}
        onClick={() => { try { onApply(plan); } catch (failure) { setError(failure.message); setPlan(null); } }}>
        {plan.overflow.length && !keepAll ? 'Apply plan & move overflow to next week' : 'Apply this plan'}
      </button>
    </section>}
    {error && <p className="wp-error" role="alert">{error}</p>}
    <button type="button" className="wp-cancel" onClick={onClose}>Close</button>
  </dialog>;
}

export default function WeeklyPlanner({ state, todayStr, onApply }) {
  const [selectedWeek, setSelectedWeek] = useState(null), [open, setOpen] = useState(false), [message, setMessage] = useState('');
  const week = selectedWeek || weekOf(todayStr);
  const overview = useMemo(() => buildWeeklyPlan(state, week, state.settings?.planning), [state, week]);
  return <section className="wp-panel" aria-label="Weekly planning">
    <div className="wp-heading"><div><small>ONE WEEK AT A TIME</small><h2>Your weekly plan</h2></div><span className="wp-seed" aria-hidden="true">✦</span></div>
    <div className="wp-week-picker"><button type="button" aria-label="Previous planning week" disabled={week <= weekOf(todayStr)} onClick={() => { setSelectedWeek(shiftAnchorDate(week, -7)); setMessage(''); }}>‹</button>
      <span>{dateLabel(week)} – {dateLabel(shiftAnchorDate(week, 6))}</span><button type="button" aria-label="Next planning week" onClick={() => { setSelectedWeek(shiftAnchorDate(week, 7)); setMessage(''); }}>›</button></div>
    <p><strong>{overview.candidates.length} flexible tasks</strong> · {minutesLabel(overview.totalMinutes)} including anchors</p>
    <p className="wp-note">{overview.tooHard ? 'The week may be too full. Preview a gentler plan and choose what can wait.' : 'Add your tasks, then let Quest find space for them.'}</p>
    <button className="wp-button" type="button" onClick={() => setOpen(true)}>I’m done adding — plan my week</button>
    {message && <p className="wp-success" role="status">{message}</p>}
    {open && <PlannerDialog state={state} week={week} onClose={() => setOpen(false)} onApply={plan => {
      onApply(plan); setOpen(false); setMessage(`${plan.assignments.length} tasks scheduled.${plan.overflow.length && !plan.keepAll ? ` ${plan.overflow.length} moved to next week.` : ''} Your plan will sync with your account.`);
    }} />}
  </section>;
}
