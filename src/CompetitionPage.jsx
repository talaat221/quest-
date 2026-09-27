import { competitionWeekStats } from './competition.js';
import './competition.css';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function formatFocus(minutes = 0) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function daysLeftInWeek(weekKey, todayKey) {
  const parse = value => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : NaN;
  };
  const start = parse(weekKey);
  const today = parse(todayKey);
  if (!Number.isFinite(start) || !Number.isFinite(today)) return 0;
  const dayIndex = Math.floor((today - start) / 86400000);
  return clamp(6 - dayIndex, 0, 6);
}

export default function CompetitionPage({
  progression,
  weekKey,
  todayKey,
  displayName = 'You',
  focusMinutes = 0,
  level = 1,
}) {
  const stats = competitionWeekStats({ progression, weekKey, todayKey });
  const focusLabel = formatFocus(focusMinutes);
  const daysLeft = daysLeftInWeek(weekKey, todayKey);
  const weeklyMeterTarget = Math.max(300, Math.ceil(Math.max(1, stats.scoreXP) / 100) * 100);
  const weeklyPct = clamp((stats.scoreXP / weeklyMeterTarget) * 100, 0, 100);
  const todayXPPct = clamp((stats.todayXP / 100) * 100, 0, 100);
  const todayTaskPct = clamp((stats.todayTasks / 5) * 100, 0, 100);
  const focusPct = clamp((focusMinutes / 120) * 100, 0, 100);

  const leagueRows = [
    { name: displayName, xp: stats.scoreXP, self: true },
    { name: 'Invite a friend', xp: null },
    { name: 'Invite a friend', xp: null },
    { name: 'Invite a friend', xp: null },
  ];

  return (
    <section className="cp2-page" aria-labelledby="cp2-title">
      <h1 id="cp2-title" className="cp2-sr-only">Competition</h1>

      <section className="cp2-art cp2-hero" aria-label="Competition. Sail together.">
        <img src="/competition-v2/hero-v2.svg" alt="" aria-hidden="true" />
      </section>

      <section className="cp2-art cp2-challenge" aria-label="Weekly one versus one challenge">
        <img src="/competition-v2/challenge-v2.svg" alt="" aria-hidden="true" />

        <span className="cp2-week-left">{daysLeft === 0 ? 'LAST DAY' : `${daysLeft}d left`}</span>

        <div className="cp2-nameplate">
          <strong>{displayName}</strong>
          <span>LV {level}</span>
        </div>

        <div className="cp2-stat cp2-stat-xp"><strong>{stats.scoreXP} XP</strong><span>this week</span></div>
        <div className="cp2-stat cp2-stat-tasks"><strong>{stats.eligibleTasks}</strong><span>eligible tasks</span></div>
        <div className="cp2-stat cp2-stat-focus"><strong>{focusLabel}</strong><span>focus today</span></div>

        <div className="cp2-week-progress-label">{stats.scoreXP} / {weeklyMeterTarget} XP</div>
        <div className="cp2-week-progress-fill" style={{ width: `${weeklyPct * 0.307}%` }} />

        <div className="cp2-rival-copy">
          <strong>No rival yet</strong>
          <span>Add a friend, then challenge them for the week.</span>
        </div>
        <button type="button" className="cp2-add-friend" onClick={() => { window.location.hash = 'more'; }} aria-label="Add a friend. Friends setup is the next step.">
          Add a Friend
        </button>
      </section>

      <section className="cp2-art cp2-today" aria-label="Today's competition progress">
        <img src="/competition-v2/today-v2.svg" alt="" aria-hidden="true" />
        <strong className="cp2-today-value cp2-today-xp">{stats.todayXP} XP</strong>
        <strong className="cp2-today-value cp2-today-tasks">{stats.todayTasks} {stats.todayTasks === 1 ? 'task' : 'tasks'}</strong>
        <strong className="cp2-today-value cp2-today-focus">{focusLabel}</strong>
        <i className="cp2-today-fill cp2-fill-xp" style={{ width: `${todayXPPct * 0.223}%` }} />
        <i className="cp2-today-fill cp2-fill-tasks" style={{ width: `${todayTaskPct * 0.223}%` }} />
        <i className="cp2-today-fill cp2-fill-focus" style={{ width: `${focusPct * 0.223}%` }} />
      </section>

      <section className="cp2-art cp2-league" aria-label="Friends League">
        <img src="/competition-v2/league-v2.svg" alt="" aria-hidden="true" />
        <div className="cp2-league-live">
          {leagueRows.map((row, index) => (
            <div className={`cp2-league-row${row.self ? ' is-self' : ' is-empty'}`} key={`${row.name}-${index}`}>
              <span>{row.name}</span>
              <strong>{row.xp == null ? '—' : `${row.xp} XP`}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="cp2-art cp2-actions" aria-label="Competition actions">
        <img src="/competition-v2/actions-v2.svg" alt="" aria-hidden="true" />
        <button type="button" className="cp2-action cp2-find" onClick={() => { window.location.hash = 'more'; }} aria-label="Find friends. Friend profiles are the next build step." />
        <button type="button" className="cp2-action cp2-start" onClick={() => { window.alert('Add a friend first. Friend challenges are the next build step.'); }} aria-label="Start a challenge" />
      </section>

      <p className="cp2-note">Your leaderboard score already uses Quest's balanced credited XP. Friend accounts come next.</p>
    </section>
  );
}
