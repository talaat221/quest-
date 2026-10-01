import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { buildScheduleIntelligence } from './quest-intelligence.js';
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

export default function QuestIntelligence({ domains = [], weekDates = [], todayStr, resetHour = 0, compact = false }) {
  const insight = buildScheduleIntelligence(domains, weekDates, todayStr, resetHour);
  const todayCopy = statusCopy(insight.today);
  const weekRatio = insight.totalCapacity ? insight.totalMinutes / insight.totalCapacity : 0;
  const weekLevel = insight.overloadedDays.length
    ? insight.overloadedDays.some(day => day.level === 'impossible') ? 'is-danger' : 'is-warning'
    : weekRatio > 0.82 ? 'is-warning' : 'is-good';

  return <section className={`qi-card ${weekLevel}${compact ? ' is-compact' : ''}`} aria-label="Quest Intelligence workload forecast">
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
        <small>planned · ~{formatMinutes(insight.capacity.minutes)} capacity</small>
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
    const timer = window.setInterval(load, 10000);
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
    domains={questState.domains || []}
    weekDates={weekKeys(day)}
    todayStr={todayStr}
    resetHour={resetHour}
    compact={compact}
  />;
}
