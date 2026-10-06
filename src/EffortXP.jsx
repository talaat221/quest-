import { useEffect, useId, useRef } from 'react';
import { EFFORT_OPTIONS, recommendTaskXP } from './progression.js';
import './effort-xp.css';

function formatEstimate(minutes) {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  if (!value) return '—';
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return `${hours}h${rest ? ` ${rest}m` : ''}`;
}

export default function EffortXP({
  estimatedMinutes,
  onEstimatedMinutesChange,
  effort = 'normal',
  onEffortChange,
  learnedEstimate = null,
  learnedSamples = 0,
  learnedPattern = '',
  learnedConfidence = '',
  compact = false,
  anchor = false,
}) {
  const recommendation = recommendTaskXP({ estimatedMinutes, effort });
  const confidence = learnedConfidence || (learnedSamples >= 5 ? 'high' : learnedSamples >= 2 ? 'medium' : learnedSamples ? 'early' : 'none');
  const confidenceText = confidence === 'high'
    ? 'high confidence'
    : confidence === 'medium'
      ? 'getting confident'
      : 'early estimate';

  return <section className={`ex-effort-xp${compact ? ' is-compact' : ''}`} aria-label="Task effort and XP">
    <div className="ex-estimate-row">
      <label>
        <span>Estimated time</span>
        <span className="ex-minute-input"><input
          type="number"
          min="1"
          max="1440"
          step="1"
          inputMode="numeric"
          value={estimatedMinutes ?? ''}
          onChange={event => onEstimatedMinutesChange?.(event.target.value)}
          placeholder="30"
          aria-label="Estimated minutes"
        /><small>min</small></span>
      </label>
      {anchor ? <p>Time reserved for this routine on each scheduled day.</p> : learnedEstimate ? <p>
        <strong>Quest predicts ~{formatEstimate(learnedEstimate)}</strong>
        {learnedPattern ? ` for “${learnedPattern}”` : ''} · {confidenceText} from {learnedSamples} timed {learnedSamples === 1 ? 'task' : 'tasks'}.
      </p> : <p>Quest will learn this task type after you time and finish it.</p>}
    </div>

    <fieldset className="ex-effort-fieldset">
      <legend>How demanding is it?</legend>
      <div className="ex-effort-options">
        {EFFORT_OPTIONS.map(option => <button
          type="button"
          key={option.key}
          className={effort === option.key ? 'is-active' : ''}
          aria-pressed={effort === option.key}
          onClick={() => onEffortChange?.(option.key)}
          title={option.description}
        >{option.label}</button>)}
      </div>
    </fieldset>

    <div className={`ex-xp-result is-${recommendation.key}`} aria-live="polite">
      <span className="ex-xp-icon" aria-hidden="true">{recommendation.icon}</span>
      <span className="ex-xp-copy"><strong>{recommendation.label}</strong><small>{recommendation.description}</small></span>
      <b>{recommendation.xp} XP</b>
    </div>
    <p className="ex-rule-note">Rewards use your estimate and effort. Beyond 2 hours, XP keeps growing at a gentler pace. Quick routine tasks and anchors share a 20 XP daily limit.</p>
    {Number(estimatedMinutes) > 240 && <p className="ex-rule-note">A long task may fit better as a few focused sessions with breaks.</p>}
  </section>;
}

export function LevelDetails({ progression, week, onClose }) {
  const dialog = useRef(null), title = useId();
  useEffect(() => {
    const opener = document.activeElement;
    dialog.current.showModal();
    return () => { if (opener?.isConnected) opener.focus(); };
  }, []);
  return <dialog className="ex-level-dialog" ref={dialog} aria-labelledby={title} onCancel={event => { event.preventDefault(); onClose(); }}>
    <h2 id={title}>LEVEL {progression.level}</h2>
    <p className="ex-level-total">{progression.currentXP} / {progression.requiredXP} XP</p>
    <progress max={progression.requiredXP} value={progression.currentXP} aria-label="Level progress" />
    <p>{progression.remainingXP} XP until level {progression.level + 1}.</p>
    <dl><div><dt>Quest tasks</dt><dd>{progression.taskXP} XP</dd></div><div><dt>Daily anchors</dt><dd>{progression.anchorXP} XP</dd></div>
      <div><dt>Earlier progress kept</dt><dd>{progression.legacyXP} XP</dd></div><div><dt>Weekly consistency</dt><dd>{progression.weeklyBonusXP} XP</dd></div>
      <div><dt>Total level XP</dt><dd>{progression.levelXP} XP</dd></div></dl>
    <p>This week: +{week.taskXP + week.anchorXP + week.bonusXP} XP. Your level carries forward every week.</p>
    <details><summary>How rewards work</summary>
      <p>At normal effort: 30 min earns 20 XP, 1 hour earns 35, 2 hours earns 50, 3 hours earns 60, and 4 hours earns 70. Longer work continues at a slower rate. High effort adds more.</p>
      <p>Only completing work earns XP. Changing a finished task never rewrites its reward. Undo removes that completion’s XP. Timers teach Quest better estimates for next time.</p>
      <p>Quick routine tasks and anchors share a 20 XP daily limit. Weekly task bonuses add 25 XP at 5, 10, 15 and 20 eligible tasks, up to 100 XP. At most one routine task per day counts toward that bonus.</p>
    </details>
    <button type="button" className="wp-button" onClick={onClose}>Back to my garden</button>
  </dialog>;
}
