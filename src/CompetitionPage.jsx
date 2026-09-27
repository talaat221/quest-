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

function initials(value = '') {
  return String(value || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0] || '')
    .join('')
    .toUpperCase() || '?';
}

function friendXP(friend) {
  return Math.max(0, Math.round(Number(friend?.scoreXP ?? friend?.xp) || 0));
}

export default function CompetitionPage({
  progression,
  weekKey,
  todayKey,
  displayName = 'You',
  focusMinutes = 0,
  level = 1,
  friends = [],
}) {
  const stats = competitionWeekStats({ progression, weekKey, todayKey });
  const focusLabel = formatFocus(focusMinutes);
  const daysLeft = daysLeftInWeek(weekKey, todayKey);
  const weeklyMeterTarget = Math.max(300, Math.ceil(Math.max(1, stats.scoreXP) / 100) * 100);
  const weeklyPct = clamp((stats.scoreXP / weeklyMeterTarget) * 100, 0, 100);
  const todayXPPct = clamp((stats.todayXP / 100) * 100, 0, 100);
  const todayTaskPct = clamp((stats.todayTasks / 5) * 100, 0, 100);
  const focusPct = clamp((focusMinutes / 120) * 100, 0, 100);

  // Group competition layout: you + up to three friends.
  const challengeFriends = Array.from({ length: 3 }, (_, index) => friends[index] || null);
  const leagueRows = [
    { name: displayName, xp: stats.scoreXP, self: true },
    ...challengeFriends.map(friend => friend
      ? { name: friend.displayName || friend.name || 'Friend', xp: friendXP(friend), self: false }
      : { name: 'Invite a friend', xp: null, self: false }),
  ];

  const openFriends = () => {
    window.location.hash = 'more';
  };

  return (
    <section className="cp2-page" aria-labelledby="cp2-title">
      <h1 id="cp2-title" className="cp2-sr-only">Competition</h1>

      <section className="cp2-art cp2-hero" aria-label="Competition. Sail together.">
        <img src="/competition-v2/hero-v2.svg" alt="" aria-hidden="true" />
      </section>

      <section className="cp2-art cp2-challenge" aria-label="Weekly group challenge">
        <img src="/competition-v2/challenge-v4.svg" alt="" aria-hidden="true" />

        <span className="cp2-week-left">{daysLeft === 0 ? 'LAST DAY' : `${daysLeft} DAYS LEFT`}</span>

        <div className="cp2-nameplate">
          <strong>{displayName}</strong>
          <span>LV {level}</span>
        </div>

        <strong className="cp2-stat-value cp2-stat-xp">{stats.scoreXP} XP</strong>
        <strong className="cp2-stat-value cp2-stat-tasks">{stats.eligibleTasks}</strong>
        <strong className="cp2-stat-value cp2-stat-focus">{focusLabel}</strong>

        <div className="cp2-week-progress-label">{stats.scoreXP} / {weeklyMeterTarget}</div>
        <div className="cp2-week-progress-fill" style={{ width: `${weeklyPct * 0.291}%` }} />

        <div className="cp2-rivals" aria-label="Challenge friends">
          {challengeFriends.map((friend, index) => (
            <button
              type="button"
              key={friend?.id || `empty-${index}`}
              className={`cp2-rival-row${friend ? '' : ' is-empty'}`}
              onClick={friend ? undefined : openFriends}
              aria-label={friend ? `${friend.displayName || friend.name || 'Friend'}, ${friendXP(friend)} XP` : `Add friend ${index + 1} to this challenge`}
            >
              {friend ? (
                <>
                  <span className="cp2-rival-avatar">{initials(friend.displayName || friend.name)}</span>
                  <span className="cp2-rival-main">
                    <strong>{friend.displayName || friend.name || 'Friend'}</strong>
                    <small>LV {Math.max(1, Number(friend.level) || 1)} · {Math.max(0, Number(friend.tasks) || 0)} tasks</small>
                  </span>
                  <strong className="cp2-rival-score">{friendXP(friend)} XP</strong>
                </>
              ) : null}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="cp2-add-friend"
          onClick={openFriends}
          aria-label="Add another friend to this challenge. Up to three friends can join."
        />
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
        <img src="/competition-v2/league-v3.svg" alt="" aria-hidden="true" />
        <div className="cp2-league-live">
          {leagueRows.map((row, index) => (
            <div className={`cp2-league-row${row.self ? ' is-self' : row.xp == null ? ' is-empty' : ''}`} key={`${row.name}-${index}`}>
              <span>{row.name}</span>
              <strong>{row.xp == null ? '—' : `${row.xp} XP`}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="cp2-art cp2-actions" aria-label="Competition actions">
        <img src="/competition-v2/actions-v2.svg" alt="" aria-hidden="true" />
        <button type="button" className="cp2-action cp2-find" onClick={openFriends} aria-label="Find friends" />
        <button type="button" className="cp2-action cp2-start" onClick={() => { window.alert('Friend accounts are the next build step. Weekly challenges already support up to three friends.'); }} aria-label="Start a challenge" />
      </section>

      <p className="cp2-note">Weekly challenges support you plus up to three friends. Friend accounts and invitations are the next layer.</p>
    </section>
  );
}
