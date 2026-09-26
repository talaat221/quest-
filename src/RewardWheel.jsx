import { useEffect, useId, useRef, useState } from 'react';
import { RewardChest } from './RewardsPage.jsx';
import { formatElapsed, formatMinutes } from './task-timer.js';
import { REWARD_SPIN_MS } from './reward-wheel.js';
import './reward-wheel.css';

const COLORS = ['#497b61', '#48677f', '#9a6049', '#75628c', '#467b7a', '#927a42', '#885966', '#69804f'];
const point = (angle, radius) => [128 + Math.cos(angle * Math.PI / 180) * radius, 128 + Math.sin(angle * Math.PI / 180) * radius];
function pixelCircle(radius) {
  return Array.from({ length: 128 }, (_, index) => {
    const [x, y] = point(index * 360 / 128, radius);
    return `${index ? 'L' : 'M'}${Math.round(x / 3) * 3} ${Math.round(y / 3) * 3}`;
  }).join(' ') + 'Z';
}
function WheelArt({ spin }) {
  const textureId = useId();
  const count = spin.slots.length, step = 360 / count;
  return <div className="pw-wheel-art" aria-hidden="true">
    <svg viewBox="0 0 256 256" className="pw-wheel-rim" shapeRendering="crispEdges" focusable="false">
      <path d={pixelCircle(126)} fill="#03121c" /><path d={pixelCircle(122)} fill="#634432" />
      <path d={pixelCircle(117)} fill="#d29b56" /><path d={pixelCircle(111)} fill="#f1c17a" />
      <path d={pixelCircle(107)} fill="#775035" /><path d={pixelCircle(102)} fill="#192c31" />
      {Array.from({ length: 12 }, (_, index) => {
        const [x, y] = point(index * 30 - 90, 114);
        return <g key={index}><rect x={Math.round(x) - 3} y={Math.round(y) - 3} width="6" height="6" fill="#4c3b2d" /><rect x={Math.round(x) - 2} y={Math.round(y) - 2} width="3" height="3" fill="#ffe0a0" /></g>;
      })}
    </svg>
    <svg viewBox="0 0 256 256" className="pw-wheel-disc" shapeRendering="crispEdges" focusable="false">
      <defs><pattern id={textureId} width="8" height="8" patternUnits="userSpaceOnUse"><rect x="0" y="0" width="2" height="2" fill="#ffe7a2" opacity=".07" /></pattern></defs>
      {spin.slots.map((slot, index) => {
        const start = -90 + index * step, end = start + step;
        const a = point(start, 99), b = point(end, 99), label = point(start + step / 2, 73);
        return <g key={index}>
          <path d={`M128 128L${a[0]} ${a[1]}A99 99 0 ${step > 180 ? 1 : 0} 1 ${b[0]} ${b[1]}Z`} fill={COLORS[slot.index % COLORS.length]} stroke="#152c31" strokeWidth="2" />
          {count <= 16 && <text x={label[0]} y={label[1]} textAnchor="middle" dominantBaseline="central" transform={`rotate(${start + step / 2 + 90} ${label[0]} ${label[1]})`}>{String(slot.index + 1).padStart(2, '0')}</text>}
        </g>;
      })}
      <path d={pixelCircle(99)} fill={`url(#${textureId})`} />
      <path d={pixelCircle(35)} fill="#192c2d" /><path d={pixelCircle(30)} fill="#d5aa64" /><path d={pixelCircle(25)} fill="#473628" />
    </svg>
    <div className="pw-wheel-hub"><RewardChest open /></div>
    <svg className="pw-pointer" viewBox="0 0 24 30" shapeRendering="crispEdges" focusable="false"><path d="M0 0h24v12h-3v5h-3v5h-3v5H9v-5H6v-5H3v-5H0z" fill="#071822" /><path d="M3 2h18v9h-3v5h-3v5H9v-5H6v-5H3z" fill="#efba69" /><path d="M6 4h12v5H6z" fill="#ffe5a4" /></svg>
  </div>;
}

export default function RewardWheel({ spin, completion, moreRewards = false, onClose, onReveal, returnLabel = 'Back to my garden' }) {
  const dialog = useRef(null), titleId = useId(), statusId = useId();
  const [finished, setFinished] = useState(false);
  const [reducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false);
  const revealed = useRef(false), revealCallback = useRef(onReveal);
  useEffect(() => { revealCallback.current = onReveal; }, [onReveal]);
  const reveal = () => {
    if (revealed.current) return;
    revealed.current = true;
    setFinished(true);
    revealCallback.current?.();
  };
  useEffect(() => {
    const opener = document.activeElement, overflow = document.body.style.overflow;
    dialog.current.showModal();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus(); };
  }, []);
  useEffect(() => {
    const duration = reducedMotion ? 100 : REWARD_SPIN_MS;
    const endsAt = Date.now() + duration;
    const finish = () => {
      if (revealed.current) return;
      revealed.current = true;
      setFinished(true);
      revealCallback.current?.();
    };
    const timer = setTimeout(finish, duration);
    const resume = () => { if (Date.now() >= endsAt) finish(); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('focus', resume); };
  }, [reducedMotion]);
  const label = spin.kind === 'daily' ? 'DAILY TREASURE' : 'WEEKLY TREASURE';
  return <dialog ref={dialog} className={`pw-dialog${finished ? ' is-finished' : ' is-spinning'}${reducedMotion ? ' is-reduced' : ''}`} aria-labelledby={titleId} aria-describedby={statusId} onCancel={event => { event.preventDefault(); onClose(); }} style={{ '--pw-landing': `${spin.rotation}deg`, '--pw-duration': `${REWARD_SPIN_MS}ms` }}>
    <div className="pw-content"><span className="pw-frame" aria-hidden="true" />
      <button type="button" className="pw-close" onClick={onClose} aria-label="Close reward wheel">×</button>
      <header className="pw-heading"><p>✦ A LITTLE VICTORY ✦</p><h2 id={titleId}>{label}</h2><p>Your XP goal is complete.</p></header>
      <div className="pw-layout"><div className="pw-wheel-stage"><WheelArt spin={spin} /><p className="pw-wheel-caption">A little joy, well earned.</p></div>
        <div className="pw-outcome">
          <div className="pw-result" role="status" aria-live="polite" aria-atomic="true" id={statusId}>
            <span>{finished ? 'YOUR REWARD' : 'THE WHEEL IS SPINNING'}</span>
            <strong>{finished ? spin.reward : 'Something good is coming…'}</strong>
            <small>{finished ? 'Added to your rewards. Enjoy it!' : 'Your reward will be saved automatically.'}</small>
          </div>
          {completion && <p className="pw-completion"><span>COMPLETED · {completion.taskName}</span>{completion.elapsedMs > 0 && <><strong>{formatElapsed(completion.elapsedMs)} focused</strong>{completion.nextEstimate && <small>Next time: about {formatMinutes(completion.nextEstimate)}.</small>}</>}</p>}
          <button type="button" autoFocus className={finished ? 'pw-done' : 'pw-skip'} onClick={finished ? onClose : reveal}>{finished ? moreRewards ? 'Next reward ›' : returnLabel : 'Reveal now'}</button>
          <details className="pw-options"><summary>{spin.items.length} {spin.items.length === 1 ? 'reward' : 'rewards'} on this wheel</summary><ol>{spin.items.map((item, index) => <li key={index}><span style={{ backgroundColor: COLORS[index % COLORS.length] }}>{String(index + 1).padStart(2, '0')}</span>{item}</li>)}</ol></details>
        </div>
      </div>
    </div>
  </dialog>;
}
