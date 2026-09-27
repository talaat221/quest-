import { useEffect, useState } from 'react';
import { competitionWeekStats } from './competition.js';
import {
  ensureQuestProfile,
  loadAcceptedFriendsWithStats,
  publishCompetitionStats,
} from './friends.js';
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
  const raw = friend?.scoreXP ?? friend?.xp;
  if (raw == null) return null;
  return Math.max(0, Math.round(Number(raw) || 0));
}

export default function CompetitionPage({
  progression,
  weekKey,
  todayKey,
  displayName = 'You',
  focusMinutes = 0,
  level = 1,
  userId = null,
  friends = [],
}) {
  const stats = competitionWeekStats({ progression, weekKey, todayKey });
  const [liveFriends, setLiveFriends] = useState(friends);
  const focusLabel = formatFocus(focusMinutes);
  const daysLeft = daysLeftInWeek(weekKey, todayKey);
  const weeklyMeterTarget = Math.max(300, Math.ceil(Math.max(1, stats.scoreXP) / 100) * 100);
  const weeklyPct = clamp((stats.scoreXP / weeklyMeterTarget) * 100, 0, 100);
  const todayXPPct = clamp((stats.todayXP / 100) * 100, 0, 100);
  const todayTaskPct = clamp((stats.todayTasks / 5) * 100, 0, 100);
  const focusPct = clamp((focusMinutes / 120) * 100, 0, 100);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;

    const syncFriends = async () => {
      try {
        await ensureQuestProfile({ id: userId, user_metadata: { display_name: displayName } });
        await publishCompetitionStats(userId, {
          weekKey,
          todayKey,
          scoreXP: stats.scoreXP,
          taskXP: stats.taskXP,
          consistencyXP: stats.consistencyXP,
          eligibleTasks: stats.eligibleTasks,
          todayXP: stats.todayXP,
          todayTasks: stats.todayTasks,
          focusMinutes,
          level,
        });
        const nextFriends = await loadAcceptedFriendsWithStats(userId, weekKey);
        if (!cancelled) setLiveFriends(nextFriends);
      } catch (error) {
        console.warn('Competition friends could not sync:', error);
      }
    };

    void syncFriends();
    const onFocus = () => void syncFriends();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [
    userId,
    displayName,
    weekKey,
    todayKey,
    stats.scoreXP,
    stats.taskXP,
    stats.consistencyXP,
    stats.eligibleTasks,
    stats.todayXP,
    stats.todayTasks,
    focusMinutes,
    level,
  ]);

  const challengeFriends = Array.from({ length: 3 }, (_, index) => liveFriends[index] || null);
  const leagueRows = [
    { name: displayName, xp: stats.scoreXP, self: true },
    ...challengeFriends.map(friend => friend
      ? { name: friend.displayName || friend.name || 'Friend', xp: friendXP(friend), self: false }
      : { name: 'Invite a friend', xp: null, self: false }),
  ];

  const openFriends = () => {
    window.location.hash = 'friends';
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
          {challengeFriends.map((friend, index) => {
            const score = friendXP(friend);
            return (
              <button
                type="button"
                key={friend?.id || `empty-${index}`}
                className={`cp2-rival-row${friend ? '' : ' is-empty'}`}
                onClick={friend ? undefined : openFriends}
                aria-label={friend ? `${friend.displayName || friend.name || 'Friend'}, ${score == null ? 'stats not synced yet' : `${score} XP`}` : `Add friend ${index + 1} to this challenge`}
              >
                {friend ? (
                  <>
                    <span className="cp2-rival-avatar">{initials(friend.displayName || friend.name)}</span>
                    <span className="cp2-rival-main">
                      <strong>{friend.displayName || friend.name || 'Friend'}</strong>
                      <small>{friend.tasks == null ? `LV ${Math.max(1, Number(friend.level) || 1)} · waiting for stats` : `LV ${Math.max(1, Number(friend.level) || 1)} · ${friend.tasks} tasks`}</small>
                    </span>
                    <strong className="cp2-rival-score">{score == null ? '— XP' : `${score} XP`}</strong>
                  </>
                ) : null}
              </button>
            );
          })}
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
        <button type="button" className="cp2-action cp2-start" onClick={liveFriends.length ? undefined : openFriends} aria-label="Start a challenge" />
      </section>

      <p className="cp2-note">Accepted friends appear here automatically. Up to three are shown in the weekly challenge; all friend stats stay private to accepted friends.</p>
    </section>
  );
}
