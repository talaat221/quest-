import { useEffect, useId, useRef, useState } from 'react';
import { rewardHistory, rewardProgress } from './rewards.js';
import './rewards-page.css';

export function RewardChest({ open = false }) {
  return <svg className="rw-chest" viewBox="0 0 48 40" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
    <path fill="#031421" d="M4 35h40v3H4z" />
    {open ? <><path fill="#5a3826" d="M5 5h38v14H5z" /><path fill="#c49352" d="M7 3h34v3H7zM4 6h3v13H4zm37 0h3v13h-3z" /><path fill="#dcb668" d="M9 8h30v7H9z" /><path fill="#ffdf88" d="M12 12h24v9H12z" /><path fill="#fff1bd" d="M21 7h6v15h-6zM15 12h18v5H15z" /></> : <><path fill="#442a24" d="M6 9h36v3h3v12H3V12h3z" /><path fill="#92542d" d="M8 11h32v3h3v7H5v-7h3z" /><path fill="#c38643" d="M9 12h30v3H9z" /><path fill="#dda95a" d="M8 12h4v9H8zm28 0h4v9h-4z" /></>}
    <path fill="#412b26" d="M3 21h42v14H3z" /><path fill="#82492d" d="M6 24h36v9H6z" /><path fill="#b5773b" d="M6 24h36v3H6z" />
    <path fill="#d6a45c" d="M7 21h5v13H7zm29 0h5v13h-5zM3 20h42v3H3z" /><path fill="#f1ca74" d="M20 21h8v8h-8z" /><path fill="#6d452c" d="M23 23h2v4h-2z" />
    <path fill="#fff0bb" d="M2 5h2V3h2v2h2v2H6v2H4V7H2zm37-4h2V0h2v1h2v2h-2v2h-2V3h-2z" />
  </svg>;
}

function Frame({ warm = false }) { return <span className={`rw-frame${warm ? ' is-warm' : ''}`} aria-hidden="true" />; }

function RewardEditor({ kind, reward, onSave, onClose }) {
  const dialog = useRef(null), titleId = useId(), inputId = useId();
  const [text, setText] = useState(reward?.text || '');
  const [error, setError] = useState('');
  useEffect(() => {
    const opener = document.activeElement, overflow = document.body.style.overflow;
    dialog.current.showModal();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus(); };
  }, []);
  return <dialog ref={dialog} className="rw-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}>
    <form onSubmit={event => {
      event.preventDefault();
      if (!text.trim()) { setError('Give your reward a name first.'); return; }
      onSave(kind, text.trim(), reward?.index ?? null);
      onClose();
    }}><Frame warm />
      <header><h2 id={titleId}>{reward ? 'Edit reward' : 'A little reward'}</h2><button type="button" onClick={onClose} aria-label="Close reward editor">×</button></header>
      <p>{kind === 'daily' ? 'Something small to brighten your day.' : 'Something special to look forward to this week.'}</p>
      <label htmlFor={inputId}>Reward name</label>
      <input id={inputId} autoFocus required maxLength={140} value={text} onChange={event => { setText(event.target.value); setError(''); }} placeholder={kind === 'daily' ? 'A cozy episode and my favorite snack' : 'A movie night with friends'} />
      {error && <p role="alert" className="rw-error">{error}</p>}
      <div className="rw-form-actions"><button type="submit" className="rw-primary">Save reward</button><button type="button" onClick={onClose}>Cancel</button></div>
    </form>
  </dialog>;
}

function RewardPeriod({ kind, data, items, onClaim, onAdd, onEdit, onDelete, onThresholdChange }) {
  const [editGoal, setEditGoal] = useState(false);
  const [percent, setPercent] = useState(data.thresholdPct);
  const id = useId();
  const progress = rewardProgress({ ...data, items });
  const label = kind === 'daily' ? 'Daily' : 'Weekly';
  return <>
    <section className={`rw-progress-card${progress.canClaim ? ' is-ready' : ''}`} aria-labelledby={`${id}-heading`}><Frame warm={!!data.claimed || progress.canClaim} />
      <div className="rw-card-top"><RewardChest open={!!data.claimed || progress.canClaim} /><div><p className="rw-eyebrow">{label} treasure</p><h2 id={`${id}-heading`}>{data.claimed ? 'Well earned!' : progress.canClaim ? 'Ready to open' : 'Small steps, sweet rewards'}</h2></div></div>
      <div className="rw-xp-line"><span>XP earned</span><strong>{progress.earned} <span>/ {progress.target} XP</span></strong></div>
      <div className="rw-xp-track" role="progressbar" aria-label={`${label} reward XP`} aria-valuemin={0} aria-valuemax={Math.max(1, progress.target)} aria-valuenow={Math.min(progress.earned, progress.target)} aria-valuetext={`${progress.earned} XP earned; ${progress.target ? `${progress.target} XP needed` : 'no tasks planned yet'}`}><span style={{ width: `${progress.ratio * 100}%` }} /></div>
      <p className="rw-progress-message">{progress.message}</p>
      {data.claimed ? <div className="rw-claimed" role="status"><span>YOUR {label.toUpperCase()} REWARD</span><strong>{data.claimed}</strong></div> : <button type="button" className="rw-primary rw-claim" disabled={!progress.canClaim} onClick={() => onClaim(kind)}>Claim {kind} reward</button>}
      <p className="rw-reset">{label} chest resets in {data.resetCountdown}</p>
      <div className="rw-goal-settings"><button type="button" aria-expanded={editGoal} aria-controls={`${id}-goal`} onClick={() => { setPercent(progress.percent); setEditGoal(value => !value); }}>XP goal · {progress.percent}% <span>{editGoal ? 'Close' : 'Change'}</span></button>
        {editGoal && <form id={`${id}-goal`} onSubmit={event => { event.preventDefault(); onThresholdChange(kind, Number(percent)); setEditGoal(false); }}>
          <label htmlFor={`${id}-percent`}>Percentage of available XP to earn</label>
          <div className="rw-goal-input"><input id={`${id}-percent`} type="number" inputMode="numeric" min="1" max="100" step="1" value={percent} onChange={event => setPercent(event.target.value)} required /><span>%</span><button type="submit">Save goal</button></div>
          <p>100% means finishing all available XP. Your target adjusts when tasks or anchors change.</p>
          <p>{kind === 'daily' ? 'Daily XP includes today’s anchors and tasks.' : 'Weekly XP includes this week’s anchors, completed tasks, and all unfinished quest tasks.'} Currently {progress.available} XP available.</p>
        </form>}
      </div>
    </section>
    <section className="rw-list-card" aria-labelledby={`${id}-list`}><Frame />
      <header><h2 id={`${id}-list`}>Your {kind} rewards</h2><span>{items.length}</span></header>
      <p>Finish tasks to reach your XP goal and the reward wheel opens automatically. Win one treat from this list. Your XP stays yours.</p>
      {items.length ? <ul>{items.map((text, index) => <li key={index}>
        <span className="rw-reward-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span className="rw-reward-name">{text}</span>
        <button type="button" aria-label={`Edit reward: ${text}`} onClick={() => onEdit(kind, { index, text })}>Edit <span aria-hidden="true">›</span></button>
        <button className="rw-remove" type="button" aria-label={`Remove reward: ${text}`} onClick={() => { if (window.confirm(`Remove “${text}” from your ${kind} rewards? Rewards already claimed will stay in your history.`)) onDelete(kind, index); }}>×</button>
      </li>)}</ul> : <div className="rw-empty"><RewardChest /><p>A quiet chest, waiting for something good.</p><small>Add a treat, a break, or an experience you’ll enjoy.</small></div>}
      <button type="button" className="rw-add" onClick={() => onAdd(kind)}>+ Add {kind} reward</button>
    </section>
  </>;
}

export default function RewardsPage({ rewards = {}, claimed = {}, periods, onSave, onDelete, onClaim, onThresholdChange }) {
  const [kind, setKind] = useState('daily'), [editor, setEditor] = useState(null), [announcement, setAnnouncement] = useState('');
  const history = rewardHistory(claimed);
  const announceSave = (scope, text, index) => { onSave(scope, text, index); setAnnouncement(index === null ? 'Reward added.' : 'Reward updated.'); };
  return <div className="rw-page">
    <header className="rw-page-header"><a href="#more">‹ More</a><div className="rw-title"><RewardChest /><div><p className="rw-eyebrow">THE REWARD NOOK</p><h1>Rewards</h1></div></div><p>A little joy for the effort you put in.</p></header>
    <div className="rw-periods" role="group" aria-label="Reward period">{['daily', 'weekly'].map(scope => <button type="button" key={scope} aria-pressed={scope === kind} onClick={() => { setKind(scope); setAnnouncement(''); }}>{scope === 'daily' ? 'Daily chest' : 'Weekly chest'}{rewardProgress({ ...periods[scope], items: rewards[scope] || [] }).canClaim && <span className="rw-ready-dot" aria-label="ready to claim" />}</button>)}</div>
    <RewardPeriod key={kind} kind={kind} data={periods[kind]} items={rewards[kind] || []} onClaim={onClaim} onAdd={scope => setEditor({ kind: scope })} onEdit={(scope, reward) => setEditor({ kind: scope, reward })} onDelete={(scope, index) => { onDelete(scope, index); setAnnouncement('Reward removed.'); }} onThresholdChange={onThresholdChange} />
    <p className="rw-announcement" role="status">{announcement}</p>
    <details className="rw-history"><summary>Past treasures <span>{history.length} claimed</span></summary>{history.length ? <ul>{history.slice(0, 10).map(item => <li key={`${item.kind}:${item.date}`}><span>{item.kind === 'weekly' ? 'Week of ' : ''}{new Date(`${item.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}<small>{item.kind}</small></span><strong>{item.text}</strong></li>)}</ul> : <p>Your claimed rewards will appear here.</p>}{history.length > 10 && <p>Showing your 10 most recent rewards.</p>}</details>
    <p className="rw-footer">One daily reward. One weekly reward.<br />You choose what feels rewarding.</p>
    {editor && <RewardEditor {...editor} onSave={announceSave} onClose={() => setEditor(null)} />}
  </div>;
}
