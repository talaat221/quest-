import { useEffect, useId, useRef, useState } from 'react';
import { TaskClock } from './TaskTimer.jsx';
import { elapsedTaskMs, isTaskWorking } from './task-timer.js';
import { getStudySelection, getStudyTasks, studyTaskKey } from './study-room.js';
import './study-room.css';

const ART = '/study-room/';

function RoomArtwork({ working, motion }) {
  return <div className={`sr-art${working ? ' is-studying' : ' is-resting'}${motion ? ' has-motion' : ''}`} aria-hidden="true">
    <img className="sr-background" src={`${ART}room-v1.webp`} alt="" fetchPriority="high" draggable="false" />
    <span className="sr-lantern-light sr-lantern-window" />
    <span className="sr-lantern-light sr-lantern-shelf" />
    <span className="sr-window-firefly sr-firefly-one" /><span className="sr-window-firefly sr-firefly-two" /><span className="sr-window-firefly sr-firefly-three" />
    <div className="sr-character sr-idle-character"><img src={`${ART}boy-idle-v1.webp`} alt="" draggable="false" /></div>
    <div className="sr-character sr-working-character"><img src={`${ART}boy-studying-v1.webp`} alt="" draggable="false" /></div>
    <img className="sr-desk" src={`${ART}desk-v1.webp`} alt="" draggable="false" />
    <div className="sr-character sr-front-hands sr-resting-hand"><img src={`${ART}boy-studying-v1.webp`} alt="" draggable="false" /></div>
    <div className="sr-character sr-front-hands sr-writing-hand"><img src={`${ART}boy-studying-v1.webp`} alt="" draggable="false" /></div>
    <img className="sr-tea-steam" src={`${ART}steam-v1.webp`} alt="" draggable="false" />
  </div>;
}

export default function StudyRoom({ domains, todayStr, onStart, onPause, onFinish, onCreate }) {
  const id = useId(), pageRef = useRef(null), taskInput = useRef(null), immersiveButton = useRef(null);
  const [selectedKey, setSelectedKey] = useState('');
  const [showNewTask, setShowNewTask] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQuestId, setNewQuestId] = useState('');
  const [error, setError] = useState('');
  const [immersive, setImmersive] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  const items = getStudyTasks(domains, todayStr);
  const selection = getStudySelection(items, selectedKey);
  const task = selection?.task, domain = selection?.domain;
  const working = !!task && isTaskWorking(task);
  const hasTime = !!task && elapsedTaskMs(task) > 0;
  const selectedQuestId = domains.some(item => item.id === newQuestId) ? newQuestId : domain?.id || domains[0]?.id || '';

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => setMotionEnabled(!query.matches);
    const visibility = () => setVisible(document.visibilityState !== 'hidden');
    query.addEventListener('change', preference);
    document.addEventListener('visibilitychange', visibility);
    return () => { query.removeEventListener('change', preference); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  useEffect(() => {
    if (!immersive) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('quest-study-immersive');
    const close = event => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
        setImmersive(false); immersiveButton.current?.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => { document.body.style.overflow = overflow; document.documentElement.classList.remove('quest-study-immersive'); window.removeEventListener('keydown', close); };
  }, [immersive]);

  useEffect(() => { if (showNewTask) taskInput.current?.focus(); }, [showNewTask]);

  const createTask = event => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) { setError('Give your task a name.'); return; }
    if (!domains.some(item => item.id === selectedQuestId)) { setError('Choose a quest for this task.'); return; }
    const taskId = onCreate({ domainId: selectedQuestId, name, startNow: event.nativeEvent.submitter?.value === 'start' });
    if (!taskId) { setError('This quest is no longer available. Choose another one.'); return; }
    setSelectedKey(studyTaskKey(selectedQuestId, taskId));
    setNewName(''); setError(''); setShowNewTask(false);
  };

  return <section ref={pageRef} className={`sr-page${immersive ? ' is-immersive' : ''}`} aria-labelledby={`${id}-title`}>
    <header className="sr-page-header"><a href="#quests" className="sr-back">‹ Quests</a><div><span className="sr-eyebrow">INSIDE THE COTTAGE</span><h1 id={`${id}-title`}>Study with me</h1></div><button type="button" className="sr-room-mode" ref={immersiveButton} onClick={() => setImmersive(value => !value)} aria-pressed={immersive}>{immersive ? 'Exit room view' : 'Room view'}</button></header>
    <div className="sr-stage-wrap"><div className="sr-stage">
      <RoomArtwork working={working} motion={motionEnabled && visible} />
      <div className="sr-room-clock">
        <p className="sr-room-status" role="status">{working ? 'STUDYING TOGETHER' : hasTime ? 'TAKE A BREATH' : 'READY WHEN YOU ARE'}</p>
        {task ? <TaskClock task={task} /> : <time className="qt-elapsed" aria-label="Time spent 00:00">00:00</time>}
        <p className="sr-room-task" title={task?.name || ''}>{working || hasTime ? task.name : 'A little progress, a little peace.'}</p>
      </div>
      <div className="sr-scene-caption">{working ? 'One thing at a time.' : 'Your place is waiting.'}</div>
    </div></div>
    <div className="sr-work-panel">
      <div className="sr-task-controls"><div className="sr-task-picker"><label htmlFor={`${id}-task`}>Your task</label><select id={`${id}-task`} value={selection?.key || ''} disabled={working || !items.length} onChange={event => { setSelectedKey(event.target.value); setShowNewTask(false); }}>
        {!items.length && <option value="">No unfinished tasks yet</option>}
        {domains.map(item => <optgroup key={item.id} label={item.name}>{items.filter(entry => entry.domain.id === item.id).map(entry => <option key={entry.key} value={entry.key}>{entry.task.name}{entry.task.day === todayStr ? ' · Today' : ''}</option>)}</optgroup>)}
      </select></div>
      <div className="sr-timer-buttons"><button type="button" className="sr-start" disabled={!task} onClick={() => working ? onPause(domain.id, task.id) : onStart(domain.id, task.id)}>{working ? 'Ⅱ Pause' : hasTime ? '▶ Resume' : '▶ Start studying'}</button><button type="button" className="sr-finish" disabled={!hasTime && !working} onClick={() => onFinish(domain.id, task.id)}>✓ Finish</button></div></div>
      <div className="sr-panel-footer"><button type="button" className="sr-add-task" aria-expanded={showNewTask} aria-controls={`${id}-new-task`} disabled={!domains.length || working} onClick={() => { setShowNewTask(value => !value); setError(''); }}>+ New task</button><p>{working ? 'Pause to choose another task.' : hasTime ? 'Paused. Your time is kept.' : 'Pick a task, then settle in.'}</p><label className="sr-motion"><input type="checkbox" checked={motionEnabled} onChange={event => setMotionEnabled(event.target.checked)} />Gentle motion</label></div>
      {!domains.length && <p className="sr-no-quests"><a href="#quests">Create your first quest</a> to add a study task.</p>}
      {showNewTask && <form id={`${id}-new-task`} className="sr-new-task" onSubmit={createTask}>
        <div><label htmlFor={`${id}-new-quest`}>Quest</label><select id={`${id}-new-quest`} value={selectedQuestId} onChange={event => setNewQuestId(event.target.value)}>{domains.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
        <div className="sr-new-task-name"><label htmlFor={`${id}-new-name`}>What will you work on?</label><input ref={taskInput} id={`${id}-new-name`} value={newName} onChange={event => setNewName(event.target.value)} placeholder="Review histology for 20 minutes" maxLength={160} required /></div>
        <div className="sr-new-task-actions"><button type="submit" value="add">Add task</button><button type="submit" className="sr-start" value="start">Add & start</button><button type="button" onClick={() => setShowNewTask(false)}>Cancel</button></div>
        {error && <p role="alert" className="sr-error">{error}</p>}
      </form>}
    </div>
    <p className="sr-landscape-hint">Turn your phone sideways for a wider view.</p>
  </section>;
}
