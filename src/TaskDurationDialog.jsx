import { useEffect, useId, useRef, useState } from 'react';
import { inferEffortForTask, recommendTaskXP } from './progression.js';
import { formatMinutes } from './task-timer.js';
import './task-duration-dialog.css';

// Only shown when finishing without recorded work time. Do not award any XP
// until the person provides a valid actual duration or cancels the dialog.
export default function TaskDurationDialog({ task, onConfirm, onCancel }) {
  const dialog = useRef(null);
  const heading = useId();
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const hourValue = Number(hours || 0);
  const minuteValue = Number(minutes || 0);
  const actualMinutes = hourValue * 60 + minuteValue;
  const valid = Number.isInteger(hourValue) && Number.isInteger(minuteValue)
    && hourValue >= 0 && minuteValue >= 0 && minuteValue < 60
    && actualMinutes >= 1 && actualMinutes <= 1440;
  const xp = valid
    ? recommendTaskXP({ estimatedMinutes: actualMinutes, effort: inferEffortForTask(task) }).xp
    : null;

  useEffect(() => {
    const opener = document.activeElement;
    dialog.current?.showModal();
    return () => {
      if (dialog.current?.open) dialog.current.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const submit = event => {
    event.preventDefault();
    if (valid) onConfirm(actualMinutes);
  };

  return <dialog className="qt-duration-dialog" ref={dialog} aria-labelledby={heading}
    onCancel={event => { event.preventDefault(); onCancel(); }}>
    <form onSubmit={submit}>
      <span className="qt-duration-eyebrow">ONE LAST THING</span>
      <h2 id={heading}>How long did it actually take?</h2>
      <strong className="qt-duration-task">{task.name}</strong>
      <p>There wasn't a running task timer. Enter the time you really spent so Quest can give you the right XP.</p>
      {Number(task.estimatedMinutes) > 0 && <p className="qt-duration-estimate">Original estimate: {formatMinutes(task.estimatedMinutes)} · {task.xp} XP</p>}
      <div className="qt-duration-inputs">
        <label>Hours<input type="number" min="0" max="24" step="1" inputMode="numeric"
          autoFocus value={hours} onChange={event => setHours(event.target.value)} placeholder="0" /></label>
        <label>Minutes<input type="number" min="0" max="59" step="1" inputMode="numeric"
          value={minutes} onChange={event => setMinutes(event.target.value)} placeholder="0" /></label>
      </div>
      <p className="qt-duration-preview" role="status">
        {valid ? <><strong>+{xp} XP</strong> for {formatMinutes(actualMinutes)} of actual work</> : 'Enter at least one minute (up to 24 hours).'}
      </p>
      <div className="qt-duration-actions">
        <button type="button" className="qt-duration-cancel" onClick={onCancel}>Not finished</button>
        <button type="submit" disabled={!valid}>Finish & earn XP</button>
      </div>
    </form>
  </dialog>;
}
