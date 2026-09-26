import { useEffect, useId, useRef, useState } from 'react';
import { allQuestGoals, goalDateLabel, goalProgress, makeGoal, GOAL_PERIOD_NAMES } from './goals.js';
import './goals-page.css';

function GardenIcon({ kind = 'sprout' }) {
  return <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
    {kind === 'plus' ? <path fill="currentColor" d="M13 3h6v10h10v6H19v10h-6V19H3v-6h10z" /> : kind === 'check' ? <path fill="currentColor" d="M4 14h5v5h5V14h5V9h5V4h5v10h-5v5h-5v5h-5v5H9v-5H4z" /> : <><path fill="#6aac58" d="M14 29V15H8V12H4V5h8v3h4v8h2V8h4V4h8v8h-4v4h-6v13z" /><path fill="#b1e773" d="M6 6h6v3h3v3h-3V9H6zm16 0h6v3h-6v3h-3V9h3z" /><path fill="#d6a16b" d="M5 29h23v3H5z" /></>}
  </svg>;
}
function PanelArt({ warm = false }) { return <span className={`gg-panel-art${warm ? ' is-warm' : ''}`} aria-hidden="true" />; }
function GoalPlant({ goal, ratio }) {
  const variety = String(goal.id).split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % 3 + 1;
  const stage = ratio >= 1 ? 'mature' : ratio > 0 ? 'leafy' : 'sprouts';
  return <img className="gg-goal-plant" src={`/garden-scene/v1/12-crop-${variety}-${stage}.webp`} alt="" aria-hidden="true" />;
}
function Progress({ goal, domain, resetHour }) {
  const progress = goalProgress(goal, domain, resetHour);
  return <div className="gg-progress-line"><div className="gg-progress-track" role="progressbar" aria-label={`${goal.title} progress`} aria-valuenow={Math.min(progress.current, progress.target)} aria-valuemin={0} aria-valuemax={progress.target} aria-valuetext={`${progress.current} of ${progress.target} ${goal.unit}`}><span style={{ width: `${progress.ratio * 100}%` }} /></div><span>{progress.current} / {progress.target} {goal.unit}</span></div>;
}
export function QuestGoalsSummary({ domain, onAdd, onEdit, resetHour = 0 }) {
  const goals = Array.isArray(domain.goals) ? domain.goals : [];
  return <section className="gg-quest-goals" aria-label={`${domain.name} goals`}>
    <header><h3><GardenIcon /> Goals</h3><button type="button" onClick={onAdd}>+ Add goal</button></header>
    {goals.length ? <ul>{goals.map(goal => {
      const p = goalProgress(goal, domain, resetHour);
      return <li key={goal.id}><button type="button" onClick={() => onEdit(goal)} aria-label={`Edit goal: ${goal.title}`}><span><strong>{goal.title}</strong><small>{GOAL_PERIOD_NAMES[goal.period]} · {goalDateLabel(goal)}</small></span><span className={p.completed ? 'gg-complete-label' : ''}>{p.completed ? 'Achieved' : `${Math.round(p.ratio * 100)}%`} <span aria-hidden="true">›</span></span></button></li>;
    })}</ul> : <p>Plant a weekly, monthly, or yearly ambition for this quest.</p>}
  </section>;
}

export function GoalEditor({ domains, questId, goal, todayStr, onSave, onDelete, onClose }) {
  const dialog = useRef(null), titleId = useId(), id = useId();
  const [selectedQuest, setSelectedQuest] = useState(questId || domains[0]?.id || '');
  const [title, setTitle] = useState(goal?.title || '');
  const [period, setPeriod] = useState(goal?.period || 'month');
  const [referenceDate, setReferenceDate] = useState(goal?.startDate || todayStr);
  const [tracking, setTracking] = useState(goal?.tracking || 'manual');
  const [target, setTarget] = useState(goal?.target || 1);
  const [unit, setUnit] = useState(goal?.unit || 'steps');
  const [progress, setProgress] = useState(goal?.progress || 0);
  const [milestoneText, setMilestoneText] = useState((goal?.milestones || []).map(m => m.title).join('\n'));
  const [error, setError] = useState('');
  useEffect(() => {
    const opener = document.activeElement, overflow = document.body.style.overflow;
    dialog.current.showModal(); document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus(); };
  }, []);
  const submit = event => {
    event.preventDefault();
    if (!domains.some(domain => domain.id === selectedQuest)) { setError('Choose a quest for this goal.'); return; }
    try { onSave(selectedQuest, makeGoal({ title, period, referenceDate, tracking, target, unit, progress, milestoneText }, goal)); onClose(); }
    catch (failure) { setError(failure.message); }
  };
  return <dialog ref={dialog} className="gg-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}>
    <form className="gg-goal-form" onSubmit={submit}><PanelArt warm />
      <header><h2 id={titleId}>{goal ? 'TEND YOUR GOAL' : 'PLANT A NEW GOAL'}</h2><button type="button" className="gg-close" onClick={onClose} aria-label="Close goal editor">×</button></header>
      <p>A big ambition, one small step at a time.</p>
      <label htmlFor={`${id}-title`}>Goal name</label><input autoFocus id={`${id}-title`} value={title} onChange={e => setTitle(e.target.value)} maxLength={160} placeholder="Finish my short film" required />
      <label htmlFor={`${id}-quest`}>Quest</label><select id={`${id}-quest`} value={selectedQuest} onChange={e => setSelectedQuest(e.target.value)} disabled={!!goal || domains.length === 1} required>{domains.map(domain => <option key={domain.id} value={domain.id}>{domain.name}</option>)}</select>
      <div className="gg-form-columns"><div><label htmlFor={`${id}-period`}>Time frame</label><select id={`${id}-period`} value={period} onChange={e => setPeriod(e.target.value)}><option value="week">Weekly goal</option><option value="month">Monthly goal</option><option value="year">Yearly goal</option></select></div><div>
        <label htmlFor={`${id}-date`}>{period === 'week' ? 'Week containing' : period === 'month' ? 'Month' : 'Year'}</label>
        {period === 'year' ? <input id={`${id}-date`} type="number" min="2000" max="9999" value={referenceDate.slice(0, 4)} onChange={e => setReferenceDate(`${e.target.value}-01-01`)} required /> : period === 'month' ? <input id={`${id}-date`} type="month" value={referenceDate.slice(0, 7)} onChange={e => setReferenceDate(`${e.target.value}-01`)} required /> : <input id={`${id}-date`} type="date" value={referenceDate} onChange={e => setReferenceDate(e.target.value)} required />}
      </div></div>
      <label htmlFor={`${id}-tracking`}>How to measure it</label><select id={`${id}-tracking`} value={tracking} onChange={e => setTracking(e.target.value)}><option value="manual">A target I update myself</option><option value="milestones">A milestone checklist</option><option value="tasks">Completed tasks in this quest</option></select>
      {tracking === 'milestones' ? <><label htmlFor={`${id}-milestones`}>Milestones · one per line</label><textarea id={`${id}-milestones`} value={milestoneText} onChange={e => setMilestoneText(e.target.value)} rows={5} placeholder={'Write the script\nShoot the film\nEdit and publish'} required /><small>Existing checks are kept for milestones whose names stay the same.</small></> : <>
        <div className="gg-form-columns"><div><label htmlFor={`${id}-target`}>Target</label><input id={`${id}-target`} type="number" min="1" max="1000000" step="1" value={target} onChange={e => setTarget(e.target.value)} required /></div><div><label htmlFor={`${id}-unit`}>Unit</label><input id={`${id}-unit`} value={tracking === 'tasks' ? 'tasks' : unit} onChange={e => setUnit(e.target.value)} disabled={tracking === 'tasks'} maxLength={30} placeholder="films, books, lessons…" /></div></div>
        {tracking === 'manual' ? <><label htmlFor={`${id}-progress`}>Progress so far</label><input id={`${id}-progress`} type="number" min="0" max="1000000" step="1" value={progress} onChange={e => setProgress(e.target.value)} required /></> : <p className="gg-form-hint">Tasks completed during this goal’s week, month, or year count automatically. Undoing a task updates the goal too.</p>}
      </>}
      {error && <p className="gg-error" role="alert">{error}</p>}
      <div className="gg-form-actions"><button className="gg-primary" type="submit">{goal ? 'Save changes' : 'Plant goal'}</button><button type="button" onClick={onClose}>Cancel</button></div>
      {goal && <button type="button" className="gg-delete" onClick={() => { if (window.confirm(`Delete the goal "${goal.title}"? Its quest and tasks will stay.`)) { onDelete(selectedQuest, goal.id); onClose(); } }}>Delete this goal</button>}
    </form>
  </dialog>;
}

function GoalCard({ domain, goal, resetHour, todayStr, onEdit, onMilestone, onProgress }) {
  const [open, setOpen] = useState(false), detailsId = useId();
  const progress = goalProgress(goal, domain, resetHour);
  const ended = goal.endDate < todayStr;
  return <article className={`gg-goal-card${open ? ' is-open' : ''}${progress.completed ? ' is-achieved' : ''}`}><PanelArt warm={open} />
    <button type="button" className="gg-goal-summary" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls={detailsId}>
      <GoalPlant goal={goal} ratio={progress.ratio} />
      <span className="gg-goal-copy"><span className="gg-goal-quest">{domain.name}</span><strong>{goal.title}</strong><span className="gg-goal-date">{goalDateLabel(goal)}</span><span className="gg-goal-state">{progress.completed ? 'Harvested · goal achieved' : ended ? 'Period ended · keep tending' : 'Growing one step at a time'}</span></span>
      <span className="gg-goal-corner"><span className="gg-period-tag">{goal.period}</span><span className="gg-chevron" aria-hidden="true">{open ? '⌃' : '›'}</span></span>
    </button>
    <Progress goal={goal} domain={domain} resetHour={resetHour} />
    <div id={detailsId} hidden={!open} className="gg-goal-details">
      {goal.tracking === 'milestones' ? <ul className="gg-milestones">{(goal.milestones || []).map(milestone => <li key={milestone.id}><label><input type="checkbox" checked={!!milestone.done} onChange={() => onMilestone(domain.id, goal.id, milestone.id)} /><span>{milestone.title}</span></label></li>)}</ul> : goal.tracking === 'tasks' ? <p>Progress comes from tasks completed in {domain.name} between {goal.startDate} and {goal.endDate}.</p> : <div className="gg-manual-progress"><button type="button" aria-label={`Decrease progress for ${goal.title}`} disabled={!progress.current} onClick={() => onProgress(domain.id, goal.id, progress.current - 1)}>−</button><span>{progress.current} / {progress.target} {goal.unit}</span><button type="button" aria-label={`Increase progress for ${goal.title}`} disabled={progress.current >= 1000000} onClick={() => onProgress(domain.id, goal.id, progress.current + 1)}>+</button></div>}
      <button type="button" className="gg-edit-goal" onClick={() => onEdit(domain.id, goal)}>Edit goal</button>
    </div>
  </article>;
}
export default function GoalsPage({ domains, todayStr, resetHour = 0, onAdd, onEdit, onMilestone, onProgress }) {
  const [period, setPeriod] = useState('all'), [quest, setQuest] = useState('all'), [year, setYear] = useState('all');
  const all = allQuestGoals(domains);
  const years = [...new Set([todayStr.slice(0, 4), String(Number(todayStr.slice(0, 4)) + 1), ...all.flatMap(({ goal }) => [goal.startDate?.slice(0, 4), goal.endDate?.slice(0, 4)])].filter(Boolean))].sort().reverse();
  const visible = all.filter(({ domain, goal }) => (period === 'all' || goal.period === period) && (quest === 'all' || domain.id === quest) && (year === 'all' || goal.startDate?.slice(0, 4) === year || goal.endDate?.slice(0, 4) === year));
  const achieved = all.filter(({ domain, goal }) => goalProgress(goal, domain, resetHour).completed).length;
  return <div className="gg-page">
    <header className="gg-hero"><img src="/goals/garden-hero.webp" alt="A lantern-lit greenhouse, growing garden beds and a cat beside a moonlit lake" fetchPriority="high" /><a className="gg-back" href="#more">‹ More</a><div className="gg-title"><h1>GOALS GARDEN</h1><p>Big dreams. Small steps.</p></div></header>
    <div className="gg-body"><div className="gg-harvest-bar"><GardenIcon /><span><b>{all.length - achieved}</b> growing</span><i /><GardenIcon kind="check" /><span><b>{achieved}</b> achieved</span></div>
      <section className="gg-filters" aria-label="Filter goals"><div className="gg-segments" role="group" aria-label="Goal time frame">{[['all', 'All goals'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']].map(([key, label]) => <button type="button" key={key} aria-pressed={period === key} onClick={() => setPeriod(key)}>{label}</button>)}</div><div className="gg-filter-row"><label><span className="gg-sr-only">Quest</span><select value={quest} onChange={e => setQuest(e.target.value)}><option value="all">All quests</option>{domains.map(domain => <option key={domain.id} value={domain.id}>{domain.name}</option>)}</select></label><label><span className="gg-sr-only">Goal year</span><select value={year} onChange={e => setYear(e.target.value)}><option value="all">All years</option>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label></div></section>
      {['year', 'month', 'week'].map(scope => {
        const entries = visible.filter(({ goal }) => goal.period === scope);
        return entries.length ? <section className="gg-goal-section" key={scope} aria-label={`${GOAL_PERIOD_NAMES[scope]} goals`}><h2><GardenIcon />{GOAL_PERIOD_NAMES[scope]} goals<span /></h2><div className="gg-goal-list">{entries.map(({ domain, goal }) => <GoalCard key={`${domain.id}:${goal.id}`} {...{ domain, goal, resetHour, todayStr, onEdit, onMilestone, onProgress }} />)}</div></section> : null;
      })}
      {!visible.length && <section className="gg-empty"><PanelArt /><GardenIcon /><h2>{all.length ? 'A quiet garden bed' : 'What do you want to grow?'}</h2><p>{all.length ? 'No goals match these filters. Try another quest or time frame.' : domains.length ? 'Plant your first big ambition. Give it a week, a month, or a year to grow.' : 'Create a quest first, then plant the goals you want to reach.'}</p>{!domains.length && <a href="#quests">Create your first quest ›</a>}</section>}
      <button type="button" className="gg-add-goal gg-primary" onClick={() => onAdd(quest === 'all' ? null : quest)} disabled={!domains.length}><GardenIcon kind="plus" /> Add goal</button><p className="gg-footer-copy">Choose a quest, a target, and a date.</p>
    </div>
  </div>;
}
