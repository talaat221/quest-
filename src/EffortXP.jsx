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
  learnedConfidence = 'none',
  compact = false,
}) {
  const recommendation = recommendTaskXP({ estimatedMinutes, effort });
  const confidenceText = learnedConfidence === 'high'
    ? 'high confidence'
    : learnedConfidence === 'medium'
      ? 'getting confident'
      : 'early estimate';

  return <section className={`ex-effort-xp${compact ? ' is-compact' : ''}`} aria-label="Task effort and XP">
    <div className="ex-estimate-row">
      <label>
        <span>Estimated time</span>
        <span className="ex-minute-input"><input
          type="number"
          min="1"
          step="5"
          inputMode="numeric"
          value={estimatedMinutes ?? ''}
          onChange={event => onEstimatedMinutesChange?.(event.target.value)}
          placeholder="30"
          aria-label="Estimated minutes"
        /><small>min</small></span>
      </label>
      {learnedEstimate ? <p>
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
  </section>;
}
