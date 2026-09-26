import { useEffect, useId, useRef, useState } from 'react';
import { elapsedTaskMs, formatElapsed, formatMinutes, isTaskWorking } from './task-timer.js';
import './task-timer.css';

export function TaskClock({ task }) {
  const [now, setNow] = useState(Date.now);
  const active = isTaskWorking(task);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick); };
  }, [active, task.workTimer?.startedAt]);
  return <time className="qt-elapsed" aria-label={`Time spent ${formatElapsed(elapsedTaskMs(task, now))}`}>{formatElapsed(elapsedTaskMs(task, now))}</time>;
}
export function TaskTimerControls({ task, onStart, onPause, onFinish }) {
  if (task.done) return null;
  const active = isTaskWorking(task), started = elapsedTaskMs(task) > 0;
  return <div className={`qt-controls${active ? ' is-working' : ''}`}>
    {(active || started) && <span className="qt-status"><i aria-hidden="true" />{active ? 'Working' : 'Paused'} <TaskClock task={task} /></span>}
    <button type="button" className="qt-start" onClick={active ? onPause : onStart} aria-label={`${active ? 'Pause' : started ? 'Resume' : 'Start working on'} ${task.name}`}><span aria-hidden="true">{active ? 'Ⅱ' : '▶'}</span> {active ? 'Pause' : started ? 'Resume' : 'Start working'}</button>
    {(active || started) && <button type="button" className="qt-finish" onClick={onFinish}>Finish task</button>}
  </div>;
}
export function FocusTimerBar({ task, domain, onPause, onFinish, safeActive = false }) {
  return <aside className={`qt-focus-bar${safeActive ? ' is-safe-active' : ''}`} aria-label="Current task timer"><div className="qt-focus-copy"><a href="#quests"><span className="qt-focus-label">WORKING ON · {domain.name}</span><strong>{task.name}</strong></a><TaskClock task={task} /></div><div className="qt-focus-actions"><button type="button" onClick={onPause} aria-label={`Pause ${task.name}`}>Pause</button><button type="button" onClick={onFinish}>Finish</button></div></aside>;
}
export function TaskFinishedDialog({ result, onClose, returnLabel = 'Back to my garden' }) {
  const dialog = useRef(null), title = useId();
  useEffect(() => {
    const opener = document.activeElement;
    dialog.current.showModal();
    return () => { if (opener?.isConnected) opener.focus(); };
  }, []);
  return <dialog className="qt-finished-dialog" ref={dialog} aria-labelledby={title} onCancel={event => { event.preventDefault(); onClose(); }}><div className="qt-finished-content"><h2 id={title}>TASK COMPLETE</h2><p>{result.taskName}</p>{result.elapsedMs > 0 ? <><strong className="qt-finished-time">{formatElapsed(result.elapsedMs)}</strong><p>Time spent working</p>{result.estimatedMinutes > 0 && <small>Your estimate was {formatMinutes(result.estimatedMinutes)}.</small>}<p className="qt-learned">{result.nextEstimate ? `Next time: about ${formatMinutes(result.nextEstimate)} for a similar task in ${result.domainName}.` : 'Your recorded time has been saved.'}</p></> : <p>No timer was started for this task. It is complete; no timing estimate was learned.</p>}<button autoFocus type="button" onClick={onClose}>{returnLabel}</button></div></dialog>;
}
