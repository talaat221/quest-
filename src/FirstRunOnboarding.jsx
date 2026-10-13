import { useEffect, useState } from 'react';
import { StudyCharacter } from './StudyCharacter.jsx';
import './FirstRunOnboarding.css';

const STEPS = ['welcome', 'quest', 'task', 'anchor', 'ready'];
const COPY = {
  welcome: ['A small adventure starts here', 'Let’s plant one quest, one small task and one habit. Follow me through the app.'],
  quest: ['Plant your first quest', 'Choose an area of life, like Learning or Fitness. Name your quest and tap Add.'],
  task: ['Give it one small step', 'Add one small task and its estimated minutes. Dates can wait.'],
  anchor: ['Find your daily rhythm', 'Add one habit, like 10 minutes of reading. Choose the days you want to repeat it.'],
  ready: ['Your adventure is planted', 'You’re ready! Start a task when you begin working. Finish it to earn XP and grow your farm.'],
};
export default function FirstRunOnboarding({ state, lookId, replay, onFinish, onAdvance, onNewQuest }) {
  const [step, setStep] = useState(() => replay ? 'welcome' : STEPS.includes(state.settings?.onboarding?.step) ? state.settings.onboarding.step : 'welcome');
  const [minimized, setMinimized] = useState(false);
  const go = next => { setStep(next); onAdvance(next); setMinimized(false); };
  const hasQuest = state.domains.length > 0;
  const hasTask = state.domains.some(d => d.tasks.length > 0);
  const hasAnchor = state.anchors.length > 0;
  useEffect(() => {
    const next = step === 'quest' && hasQuest ? 'task' : step === 'task' && hasTask ? 'anchor' : step === 'anchor' && hasAnchor ? 'ready' : null;
    if (next) { setStep(next); onAdvance(next); setMinimized(false); }
  }, [step, hasQuest, hasTask, hasAnchor, onAdvance]);
  useEffect(() => {
    document.documentElement.classList.add('quest-guide-active');
    return () => document.documentElement.classList.remove('quest-guide-active');
  }, []);
  useEffect(() => {
    const selector = step === 'quest' ? '.qd-quest-new-form' : step === 'task' ? '.qd-rpg-quest-card' : step === 'anchor' ? '.dap-list-heading' : null;
    const highlight = () => {
      document.querySelectorAll('[data-guide-highlight]').forEach(node => node.removeAttribute('data-guide-highlight'));
      const target = selector && document.querySelector(selector);
      target?.setAttribute('data-guide-highlight', 'true');
    };
    const timer = setTimeout(highlight, 160);
    window.addEventListener('hashchange', highlight);
    return () => { clearTimeout(timer); window.removeEventListener('hashchange', highlight); document.querySelectorAll('[data-guide-highlight]').forEach(node => node.removeAttribute('data-guide-highlight')); };
  }, [step]);
  const begin = () => { go(hasQuest ? hasTask ? hasAnchor ? 'ready' : 'anchor' : 'task' : 'quest'); if (!hasQuest) onNewQuest(); else window.location.hash = hasTask ? hasAnchor ? 'home' : 'anchors' : 'quests'; };
  useEffect(() => {
    const typing = event => { if (event.target.matches('input,select,textarea') && !event.target.closest('.fro-coach')) setMinimized(true); };
    document.addEventListener('focusin', typing);
    return () => document.removeEventListener('focusin', typing);
  }, []);
  const [title, copy] = COPY[step];
  return <aside className={`fro-coach${minimized ? ' is-minimized' : ''}`} aria-label="Your Quest companion">
    <div className="fro-avatar"><StudyCharacter lookId={lookId}/></div>
    <div className="fro-speech">
      <div className="fro-caption"><span>YOUR FIRST ADVENTURE · {STEPS.indexOf(step) + 1}/5</span><button type="button" aria-label={minimized ? 'Expand guide' : 'Minimize guide'} onClick={() => setMinimized(!minimized)}>{minimized ? '+' : '−'}</button></div>
      <div aria-live="polite"><strong>{title}</strong>{!minimized && <p>{copy}</p>}</div>
      {!minimized && <div className="fro-actions">
        {step === 'welcome' && <button type="button" onClick={begin}>Let’s begin ›</button>}
        {step === 'quest' && <button type="button" onClick={onNewQuest}>Show me where ›</button>}
        {step === 'task' && <a href="#quests">Open my quest ›</a>}
        {step === 'anchor' && <><a href="#anchors">Go to Anchors ›</a><button type="button" className="fro-text-button" onClick={() => go('ready')}>Maybe later</button></>}
        {step === 'ready' && <a href="#home" onClick={() => onFinish()}>See my day ›</a>}
        {step !== 'ready' && <button type="button" className="fro-text-button" onClick={() => onFinish({ skipped: true })}>Skip guide</button>}
      </div>}
    </div>
  </aside>;
}
