import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { buildScheduleIntelligence } from './quest-intelligence.js';
import { buildQuestAdvice, workloadTime } from './quest-advisor.js';
import { formatMinutes } from './task-timer.js';
import './quest-intelligence.css';

const pad = value => String(value).padStart(2, '0');
const dateKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function currentQuestDay(resetHour = 0) {
  const date = new Date();
  if (date.getHours() < Number(resetHour || 0)) date.setDate(date.getDate() - 1);
  return date;
}

function weekKeys(date) {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return dateKey(next);
  });
}

function dayLabel(value, todayStr) {
  if (value === todayStr) return 'Today';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function statusCopy(day) {
  if (!day) return { title: 'Learning your workload', detail: 'Add scheduled tasks and Quest will watch the load.' };
  if (day.level === 'impossible') return {
    title: 'This day looks unrealistic',
    detail: `About ${formatMinutes(day.overByMinutes)} above your current working capacity.`,
  };
  if (day.level === 'overloaded') return {
    title: 'This day is overloaded',
    detail: `About ${formatMinutes(day.overByMinutes)} above your current working capacity.`,
  };
  if (day.level === 'full') return {
    title: 'This day is nearly full',
    detail: 'There is not much room left for another large task.',
  };
  return {
    title: 'This day looks manageable',
    detail: 'There is still room in the plan based on what Quest knows about you.',
  };
}

export default function QuestIntelligence({ state, domains = [], weekDates = [], todayStr, resetHour = 0, compact = false }) {
  const [clock,setClock]=useState(()=>new Date());
  useEffect(()=>{const tick=()=>setClock(new Date());const id=setInterval(tick,60000);window.addEventListener('focus',tick);return()=>{clearInterval(id);window.removeEventListener('focus',tick);};},[]);
  if(state) return <QuestAdvicePanel advice={buildQuestAdvice(state,{todayStr,now:clock})} todayStr={todayStr} compact={compact}/>;
  const insight = buildScheduleIntelligence(domains, weekDates, todayStr, resetHour);
  const todayCopy = statusCopy(insight.today);
  const weekRatio = insight.totalCapacity ? insight.totalMinutes / insight.totalCapacity : 0;
  const weekLevel = insight.overloadedDays.length
    ? insight.overloadedDays.some(day => day.level === 'impossible') ? 'is-danger' : 'is-warning'
    : weekRatio > 0.82 ? 'is-warning' : 'is-good';

  if (compact) {
    return <div className={`qi-mini ${weekLevel}`} aria-label={`Quest Intelligence: ${todayCopy.title}`}>
      <span className="qi-mini-star" aria-hidden="true">✦</span>
      <span><b>TODAY’S WORKLOAD</b><small>{todayCopy.title}</small></span>
      <strong>{formatMinutes(insight.today?.minutes || 0)} / {formatMinutes(insight.capacity.minutes)} planned</strong>
    </div>;
  }

  return <section className={`qi-card ${weekLevel}`} aria-label="Quest Intelligence workload forecast">
    <div className="qi-head">
      <div>
        <small>QUEST INTELLIGENCE</small>
        <h2>{todayCopy.title}</h2>
      </div>
      <span className="qi-brain" aria-hidden="true">✦</span>
    </div>

    <div className="qi-load-grid">
      <div className="qi-load-block">
        <span>Today</span>
        <strong>{formatMinutes(insight.today?.minutes || 0)}</strong>
        <small>tasks + anchors · {formatMinutes(insight.capacity.minutes)} capacity</small>
      </div>
      <div className="qi-load-block">
        <span>Rest of week</span>
        <strong>{formatMinutes(insight.totalMinutes)}</strong>
        <small>{insight.overloadedDays.length ? `${insight.overloadedDays.length} overloaded ${insight.overloadedDays.length === 1 ? 'day' : 'days'}` : 'no overloaded days detected'}</small>
      </div>
    </div>

    <p className="qi-explanation">{todayCopy.detail}</p>

    {insight.overloadedDays.length > 0 && <div className="qi-alerts">
      {insight.overloadedDays.slice(0, 3).map(day => <div className={`qi-alert is-${day.level}`} key={day.dateKey}>
        <b>{dayLabel(day.dateKey, todayStr)}</b>
        <span>{formatMinutes(day.minutes)} planned / ~{formatMinutes(day.capacityMinutes)} realistic</span>
      </div>)}
      {insight.overloadedDays.length > 3 && <small>+{insight.overloadedDays.length - 3} more overloaded days</small>}
    </div>}

    <div className="qi-memory">
      {insight.capacity.learned
        ? <>Quest learned a working capacity of about <strong>{formatMinutes(insight.capacity.minutes)}/day</strong> from {insight.capacity.sampleDays} timed days.</>
        : <>Quest is still learning your daily capacity. It is temporarily using <strong>{formatMinutes(insight.capacity.minutes)}/day</strong> until it has at least 3 timed days.</>}
      {(insight.learnedPatterns > 0 || insight.timedSamples > 0) && <span> · {insight.learnedPatterns} task {insight.learnedPatterns === 1 ? 'pattern' : 'patterns'} learned</span>}
    </div>
  </section>;
}

function QuestAdvicePanel({advice:a,todayStr,compact}) {
  const status=a.today.overByMinutes?'is-danger':a.today.level==='full'?'is-warning':'is-good';
  if(compact)return <a href="#today-quests" className={`qi-mini qi-mini-link ${status}`} aria-label={`Quest AI: ${a.title}. ${workloadTime(a.today.remainingMinutes)} remaining. Open advice.`}>
    <span className="qi-mini-star" aria-hidden="true">✦</span><span><b>QUEST AI · TIME LEFT</b><small>{a.title}</small></span>
    <strong>{workloadTime(a.today.remainingMinutes)}{a.today.overrun?'+':''} left · {workloadTime(a.today.completedMinutes)} done</strong>
  </a>;
  return <section className={`qi-card qi-advisor ${status}`} aria-label="Quest AI workload advice">
    <div className="qi-head"><div><small>QUEST AI · YOUR WEEK, WITH ROOM TO BREATHE</small><h2>{a.title}</h2></div><span className="qi-brain" aria-hidden="true">✦</span></div>
    <div className="qi-load-grid">
      <div className="qi-load-block"><span>Still to do today</span><strong>{workloadTime(a.today.remainingMinutes)}{a.today.overrun?'+':''}</strong><small>{workloadTime(a.today.taskMinutes)} tasks + {workloadTime(a.today.anchorMinutes)} anchors</small></div>
      <div className="qi-load-block"><span>Completed today’s plan</span><strong>{workloadTime(a.today.completedMinutes)}</strong><small>planned task time, separate from work left</small></div>
      <div className="qi-load-block"><span>Remaining this week</span><strong>{workloadTime(a.totalRemaining)}</strong><small>{workloadTime(a.totalCapacity)} remaining capacity</small></div>
      <div className="qi-load-block"><span>Still flexible</span><strong>{workloadTime(a.flexibleMinutes)}</strong><small>included above · waiting for a day</small></div>
    </div>
    <p className="qi-explanation">Today has {workloadTime(a.today.remainingCapacity)} of room left in your saved budget and work window. Timer progress reduces the work left; unfinished tasks never disappear just because their timer reaches the estimate.</p>
    {a.notes.length>0?<ul className="qi-advice-list">{a.notes.map(n=><li key={n.kind}><strong>{n.title}</strong><p>{n.detail}</p></li>)}</ul>:<p className="qi-explanation">There is room in your current plan. Keep a little of it free for breaks and surprises.</p>}
    {a.overloadedDays.length>0&&<details className="qi-day-details"><summary>Days that need more room</summary>{a.overloadedDays.map(d=><div className="qi-alert" key={d.dateKey}><b>{dayLabel(d.dateKey,todayStr)}</b><span>{workloadTime(d.remainingMinutes)} left / {workloadTime(d.remainingCapacity)} room</span></div>)}</details>}
    <a className="qi-plan-link" href="#quests/planner">Review my week ›</a>
    <div className="qi-memory">{a.confidence}. {a.learnedPatterns} learned task patterns from {a.timedSamples} timed samples. Weekly hours are adjustable; no single weekly total fits everyone. Suggestions never move tasks automatically.</div>
  </section>;
}

export function QuestIntelligenceLive({ compact = false }) {
  const [questState, setQuestState] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data: userResult } = await supabase.auth.getUser();
        const userId = userResult?.user?.id;
        if (!userId) return;
        const { data, error } = await supabase
          .from('quest_data')
          .select('data')
          .eq('user_id', userId)
          .maybeSingle();
        if (!error && !cancelled && data?.data) setQuestState(data.data);
      } catch {
        // Intelligence is advisory. A temporary fetch failure should never block Quest.
      }
    };
    void load();
    const timer = window.setInterval(load, 8000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (!questState) return null;
  const resetHour = Number(questState?.settings?.dayResetHour || 0);
  const day = currentQuestDay(resetHour);
  const todayStr = dateKey(day);
  return <QuestIntelligence
    state={questState}
    domains={questState.domains || []}
    weekDates={weekKeys(day)}
    todayStr={todayStr}
    resetHour={resetHour}
    compact={compact}
  />;
}
