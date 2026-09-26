import { useEffect, useId, useRef, useState } from 'react';
import { DEFAULT_POMODORO, normalizePomodoro } from './pomodoro.js';

function PomodoroSettings({ settings, onSave, onClose }) {
  const dialog = useRef(null), id = useId();
  const [draft, setDraft] = useState(() => normalizePomodoro(settings));
  useEffect(() => {
    const opener = document.activeElement;
    dialog.current.showModal();
    return () => { if (opener?.isConnected) opener.focus(); };
  }, []);
  return <dialog ref={dialog} className="sr-new-task-dialog sr-pomodoro-dialog" aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); onClose(); }}>
    <form className="sr-new-task" onSubmit={event => { event.preventDefault(); onSave(normalizePomodoro(draft)); onClose(); }}>
      <h2 id={`${id}-title`}>Your Pomodoro rhythm</h2>
      {[["focusMinutes", "Focus minutes", 180], ["shortBreakMinutes", "Short break minutes", 60], ["longBreakMinutes", "Long break minutes", 120]].map(([key, label, max]) => <div key={key}><label htmlFor={`${id}-${key}`}>{label}</label><input id={`${id}-${key}`} type="number" inputMode="numeric" min="1" max={max} step="1" required value={draft[key]} onChange={event => setDraft(value => ({ ...value, [key]: event.target.value }))} /></div>)}
      <p>Take a long break after four focus rounds. Start each next phase when you’re ready.</p>
      <p className="sr-pomodoro-note">Changing lengths resets this round. Your recorded task time is kept.</p>
      <div className="sr-new-task-actions"><button type="submit" className="sr-start">Save rhythm</button><button type="button" onClick={onClose}>Cancel</button></div>
    </form>
  </dialog>;
}

export default function PomodoroOptions({ pomodoro, disabled, hasTask, onConfigure }) {
  const [editing, setEditing] = useState(false);
  return <>
    <div className="sr-timer-mode" role="group" aria-label="Timer mode">
      <button type="button" disabled={disabled || !hasTask} aria-pressed={!pomodoro} onClick={() => onConfigure(null)}>Timer</button>
      <button type="button" disabled={disabled || !hasTask} aria-pressed={!!pomodoro} onClick={() => { if (!pomodoro) onConfigure(DEFAULT_POMODORO); }}>Pomodoro</button>
      {pomodoro && <button type="button" className="sr-pomo-settings" aria-label="Pomodoro settings" title={`${pomodoro.focusMinutes}m focus · ${pomodoro.shortBreakMinutes}m break · ${pomodoro.longBreakMinutes}m long break`} disabled={disabled} onClick={() => setEditing(true)}>⋯</button>}
    </div>
    {editing && <PomodoroSettings settings={pomodoro} onSave={onConfigure} onClose={() => setEditing(false)} />}
  </>;
}
