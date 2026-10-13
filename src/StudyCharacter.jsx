import { useEffect, useId, useRef, useState } from 'react';
import { CHARACTER_LOOKS, characterFrame, normalizeLook } from './study-together.js';
import './study-together.css';

export function StudyCharacter({ lookId = 0, studying = false, className = '' }) {
  const frame = characterFrame(lookId, studying);
  return <svg className={`st-character ${className}`} viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`} aria-hidden="true" focusable="false">
    <image href="/study-together/characters-v1.png" width="1086" height="1448" />
  </svg>;
}
export function StudyDialog({ title, eyebrow, children, onClose, className = '' }) {
  const ref = useRef(null), titleId = useId();
  useEffect(() => {
    const opener = document.activeElement;
    ref.current?.showModal();
    return () => { if (opener?.isConnected) opener.focus(); };
  }, []);
  return <dialog ref={ref} className={`st-dialog ${className}`} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }}>
    <header><div>{eyebrow && <p className="st-eyebrow">{eyebrow}</p>}<h2 id={titleId}>{title}</h2></div><button type="button" className="st-close" onClick={onClose} aria-label="Close dialog">×</button></header>
    {children}
  </dialog>;
}
export function CharacterPicker({ controller, onClose }) {
  const [look, setLook] = useState(() => normalizeLook(controller.lookId));
  const [studying, setStudying] = useState(false);
  const save = async () => { try { await controller.command('avatar', { data: { lookId: look } }); onClose(); } catch { /* Accessible error below. */ } };
  return <StudyDialog title="Your little character" eyebrow="MAKE YOURSELF AT HOME" onClose={onClose} className="st-wardrobe">
    <p className="st-description">Choose a look for your study room. You can change it whenever you like.</p>
    <div className="st-character-preview"><StudyCharacter lookId={look} studying={studying}/><span>{CHARACTER_LOOKS[look].name}</span><div><button type="button" aria-pressed={!studying} onClick={() => setStudying(false)}>Resting</button><button type="button" aria-pressed={studying} onClick={() => setStudying(true)}>Studying</button></div></div>
    <div className="st-looks" role="group" aria-label="Character looks">{CHARACTER_LOOKS.map(item => <button type="button" key={item.id} aria-pressed={look === item.id} aria-label={`${item.name}: ${item.detail}`} onClick={() => setLook(item.id)} style={{ '--st-accent': item.color }}><StudyCharacter lookId={item.id}/><span>{item.name}</span>{look === item.id && <b aria-hidden="true">✓</b>}</button>)}</div>
    <p className="st-look-detail">{CHARACTER_LOOKS[look].detail}</p>
    {controller.error && <p role="alert" className="st-error">{controller.error}</p>}
    <footer><button type="button" onClick={onClose}>Cancel</button><button type="button" className="st-primary" disabled={controller.busy} onClick={save}>{controller.busy ? 'Saving…' : 'This is me'}</button></footer>
  </StudyDialog>;
}
