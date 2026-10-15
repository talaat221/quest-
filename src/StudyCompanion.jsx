import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StudyCharacter } from './StudyCharacter.jsx';
import { memberActivity, memberConnection, memberElapsed, studyTime } from './study-together.js';
import { companionTimer, clampCompanionPosition } from './study-companion.js';
import useStudyPresence from './useStudyPresence.js';
import companionCSS from './study-companion.css?inline';
import './study-companion.css';

export default function StudyCompanion({ ref, controller, task, domain, name, onStart, onPause }) {
  const [now, setNow] = useState(Date.now), [mode, setMode] = useState('closed'), [compact, setCompact] = useState(false);
  const [pipTarget, setPipTarget] = useState(null);
  const [position, setPosition] = useState(null), [notice, setNotice] = useState('');
  const panel = useRef(null), pip = useRef(null), opening = useRef(false), alive = useRef(true), drag = useRef(null);
  const timer = companionTimer(task, now);
  useStudyPresence(controller, task, timer.activity);
  useEffect(() => {
    if (mode === 'closed' && !controller.room?.id) return;
    const clock = mode === 'pip' && pip.current ? pip.current : window;
    const id = clock.setInterval(() => setNow(Date.now()), 1000);
    const wake = () => setNow(Date.now()); window.addEventListener('focus', wake);
    return () => { clock.clearInterval(id); window.removeEventListener('focus', wake); };
  }, [mode, controller.room?.id]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; pip.current?.close(); pip.current = null; }; }, []);
  const close = () => { pip.current?.close(); pip.current = null; setPipTarget(null); setMode('closed'); };
  const open = async () => {
    if (opening.current) return;
    if (pip.current && !pip.current.closed) { pip.current.focus(); return; }
    setNow(Date.now()); setNotice('');
    if (!window.documentPictureInPicture?.requestWindow) { setMode('inline'); return; }
    opening.current = true;
    try {
      const win = await window.documentPictureInPicture.requestWindow({ width: 360, height: 295 });
      if (!alive.current) { win.close(); return; }
      pip.current = win;
      win.document.title = 'Quest · Study companion';
      const base = win.document.createElement('base'); base.href = window.location.origin + '/'; win.document.head.append(base);
      const style = win.document.createElement('style'); style.textContent = companionCSS; win.document.head.append(style);
      win.document.body.className = 'qc-pip-document';
      win.addEventListener('pagehide', () => { if (pip.current === win) { pip.current = null; if (alive.current) { setPipTarget(null); setMode('closed'); } } }, { once: true });
      setPipTarget(win.document.body); setMode('pip');
    } catch { setNotice('Floating window unavailable. Your companion is open inside Quest.'); setMode('inline'); }
    finally { opening.current = false; }
  };
  useImperativeHandle(ref, () => ({ open }));
  useEffect(() => {
    if (mode !== 'inline') return;
    const clamp = () => setPosition(old => old && panel.current ? clampCompanionPosition(old, { width: innerWidth, height: innerHeight }, panel.current.getBoundingClientRect()) : old);
    const observer = new ResizeObserver(clamp); if (panel.current) observer.observe(panel.current);
    window.addEventListener('resize', clamp); return () => { observer.disconnect(); window.removeEventListener('resize', clamp); };
  }, [mode]);
  if (mode === 'closed') return null;
  const sharedNow = now + (controller.clockOffset || 0);
  const members = controller.room?.members.filter(member => member.status === 'joined') || [];
  const people = members.length ? members : [{ userId: controller.userId, name: name || 'You', lookId: controller.lookId, status: 'joined' }];
  const startDrag = event => {
    if (mode !== 'inline' || event.target.closest('button')) return;
    const rect = panel.current.getBoundingClientRect(); drag.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = event => {
    if (!drag.current) return;
    setPosition(clampCompanionPosition({ x: event.clientX - drag.current.x, y: event.clientY - drag.current.y }, { width: innerWidth, height: innerHeight }, panel.current.getBoundingClientRect()));
  };
  const returnToQuest = () => { window.focus(); window.location.hash = '#study'; };
  const content = <aside ref={panel} className={`qc-companion ${mode === 'inline' ? 'qc-inline' : ''}${compact ? ' is-compact' : ''}`} aria-label="Study companion" style={mode === 'inline' && position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}>
    <header className="qc-handle" onPointerDown={startDrag} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <span><i className={timer.running ? 'is-running' : ''}/> QUEST <small>{controller.room ? 'TOGETHER' : 'YOUR QUIET CORNER'}</small></span>
      <div><button type="button" onClick={() => { setCompact(v => !v); if (pip.current) { try { pip.current.resizeTo(360, compact ? 295 : 140); } catch { /* Window size is browser-controlled. */ } } }} aria-label={compact ? 'Expand companion' : 'Collapse companion'} aria-expanded={!compact}>{compact ? '+' : '−'}</button><button type="button" onClick={close} aria-label="Close companion">×</button></div>
    </header>
    <div className="qc-session"><div><p>{timer.status}</p><time aria-label={`Study timer ${timer.text}`}>{timer.text}</time></div><button type="button" className="qc-toggle" disabled={!task || task.done} onClick={() => timer.running ? onPause(domain.id, task.id) : onStart(domain.id, task.id)}>{timer.running ? 'Ⅱ' : '▶'} <span>{timer.action}</span></button></div>
    {!compact && <><p className="qc-task" title={task?.name}>{task?.name || 'A little progress, a little peace.'}</p><div className="qc-people">{people.map(member => {
      const self = member.userId === controller.userId, studying = self ? timer.activity === 'studying' : memberActivity(member, sharedNow) === 'studying';
      const state = self ? timer.status : memberConnection(member, sharedNow) === 'reconnecting' ? 'Reconnecting' : memberActivity(member, sharedNow);
      return <div className={studying ? 'is-studying' : ''} key={member.userId} title={`${member.name} · ${state}`}><StudyCharacter lookId={self ? controller.lookId : member.lookId} studying={studying}/><strong>{self ? 'You' : member.name}</strong><small>{self ? state : memberActivity(member, sharedNow) === 'away' ? 'Offline' : studyTime(memberElapsed(member, sharedNow))}</small></div>;
    })}</div><footer><button type="button" onClick={returnToQuest}>Back to Quest ↗</button><span>{controller.error ? 'Reconnecting…' : mode === 'inline' ? 'Inside Quest · drag to move' : 'Keep Quest open'}</span></footer></>}
    {notice && <p className="qc-notice" role="status">{notice}</p>}
  </aside>;
  return mode === 'pip' && pipTarget ? createPortal(content, pipTarget) : content;
}
