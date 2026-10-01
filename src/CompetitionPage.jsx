import { useEffect, useMemo, useState } from 'react';
import { competitionWeekStats } from './competition.js';
import {
  ensureQuestProfile,
  loadAcceptedFriendsWithStats,
  publishCompetitionStats,
} from './friends.js';
import {
  MAX_CHALLENGE_MEMBERS,
  MAX_CHALLENGE_RIVALS,
  cancelWeeklyChallenge,
  challengeMemberToFriend,
  createWeeklyChallenge,
  inviteWeeklyChallengeMembers,
  leaveWeeklyChallenge,
  loadWeeklyChallenge,
  respondWeeklyChallenge,
} from './challenges.js';
import './competition.css';

const WEEKLY_METER_TARGET = 300;
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

function friendTasks(friend) {
  const raw = friend?.tasks ?? friend?.eligibleTasks;
  if (raw == null) return null;
  return Math.max(0, Math.round(Number(raw) || 0));
}

function sortCompetitors(entries = []) {
  return [...entries].sort((a, b) => {
    const xpDiff = (friendXP(b) ?? -1) - (friendXP(a) ?? -1);
    if (xpDiff) return xpDiff;
    const taskDiff = (friendTasks(b) ?? -1) - (friendTasks(a) ?? -1);
    if (taskDiff) return taskDiff;
    return String(a?.displayName || a?.name || '').localeCompare(String(b?.displayName || b?.name || ''));
  });
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
  const [challengeHub, setChallengeHub] = useState({ current: null, invites: [] });
  const [showPicker, setShowPicker] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [challengeError, setChallengeError] = useState('');
  const [challengeMessage, setChallengeMessage] = useState('');

  const focusLabel = formatFocus(focusMinutes);
  const daysLeft = daysLeftInWeek(weekKey, todayKey);
  const weeklyPct = clamp((stats.scoreXP / WEEKLY_METER_TARGET) * 100, 0, 100);
  const todayXPPct = clamp((stats.todayXP / 100) * 100, 0, 100);
  const todayTaskPct = clamp((stats.todayTasks / 5) * 100, 0, 100);
  const focusPct = clamp((focusMinutes / 120) * 100, 0, 100);

  const syncCompetition = async () => {
    if (!userId) return;
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
    const [nextFriends, nextChallenge] = await Promise.all([
      loadAcceptedFriendsWithStats(userId, weekKey),
      loadWeeklyChallenge(weekKey),
    ]);
    setLiveFriends(nextFriends);
    setChallengeHub(nextChallenge);
  };

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    const sync = async () => {
      try {
        await syncCompetition();
      } catch (error) {
        if (!cancelled) console.warn('Competition could not sync:', error);
      }
    };
    void sync();
    const timer = window.setInterval(sync, 20000);
    const onFocus = () => void sync();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
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

  const currentChallenge = challengeHub.current;
  const currentMembers = Array.isArray(currentChallenge?.members) ? currentChallenge.members : [];
  const isCreator = !!currentChallenge && currentChallenge.creatorId === userId;
  const activeMemberCount = currentMembers.filter(member => ['accepted', 'pending'].includes(member.status)).length;
  const acceptedCount = currentMembers.filter(member => member.status === 'accepted').length;
  const pendingCount = currentMembers.filter(member => member.status === 'pending').length;
  const remainingSlots = Math.max(0, MAX_CHALLENGE_MEMBERS - activeMemberCount);
  const existingMemberIds = new Set(currentMembers.map(member => member.userId));
  const availableFriends = liveFriends.filter(friend => !existingMemberIds.has(friend.id));

  const acceptedRivals = sortCompetitors(currentMembers
    .filter(member => member.userId !== userId && member.status === 'accepted')
    .map(challengeMemberToFriend)
    .filter(Boolean));
  const pendingRivals = currentMembers
    .filter(member => member.userId !== userId && member.status === 'pending')
    .map(challengeMemberToFriend)
    .filter(Boolean);
  const featuredRivals = [...acceptedRivals, ...pendingRivals].slice(0, 3);
  const challengeFriends = Array.from({ length: 3 }, (_, index) => featuredRivals[index] || null);

  const challengeLeaderboard = useMemo(() => sortCompetitors(
    currentMembers
      .filter(member => member.status === 'accepted')
      .map(member => ({
        ...challengeMemberToFriend(member),
        self: member.userId === userId,
      }))
      .filter(Boolean)
  ).map((member, index) => ({ ...member, rank: index + 1 })), [currentMembers, userId]);

  const leagueRows = useMemo(() => {
    const ranked = sortCompetitors([
      { id: userId, displayName, scoreXP: stats.scoreXP, tasks: stats.eligibleTasks, self: true },
      ...liveFriends.map(friend => ({ ...friend, self: false })),
    ]).map((entry, index) => ({
      ...entry,
      rank: index + 1,
      name: entry.displayName || entry.name || 'Friend',
      xp: friendXP(entry),
      tasks: friendTasks(entry),
    }));

    const self = ranked.find(row => row.self);
    let visible = ranked.slice(0, 4);
    if (self && !visible.some(row => row.self)) visible = [...ranked.slice(0, 3), self];

    return Array.from({ length: 4 }, (_, index) => visible[index] || {
      rank: null,
      name: 'Invite a friend',
      xp: null,
      tasks: null,
      self: false,
    });
  }, [liveFriends, displayName, stats.scoreXP, stats.eligibleTasks, userId]);

  const openFriends = () => {
    window.location.hash = 'friends';
  };

  const runChallenge = async (action, success = '') => {
    if (challengeBusy) return;
    setChallengeBusy(true);
    setChallengeError('');
    setChallengeMessage('');
    try {
      await action();
      await syncCompetition();
      setShowPicker(false);
      setSelectedIds([]);
      if (success) setChallengeMessage(success);
    } catch (error) {
      setChallengeError(error?.message || 'That challenge action did not work.');
    } finally {
      setChallengeBusy(false);
    }
  };

  const selectionLimit = currentChallenge ? remainingSlots : MAX_CHALLENGE_RIVALS;
  const toggleSelected = friendId => {
    setSelectedIds(current => {
      if (current.includes(friendId)) return current.filter(id => id !== friendId);
      if (current.length >= selectionLimit) return current;
      return [...current, friendId];
    });
  };

  const openStartPicker = () => {
    if (!liveFriends.length) return openFriends();
    setSelectedIds([]);
    setChallengeError('');
    setShowPicker(true);
  };

  const openAddPicker = () => {
    if (!remainingSlots) {
      setChallengeMessage('This competition already has 20 travelers.');
      return;
    }
    if (!availableFriends.length) return openFriends();
    setSelectedIds([]);
    setChallengeError('');
    setShowPicker(true);
  };

  const createChallenge = () => runChallenge(
    () => createWeeklyChallenge(weekKey, selectedIds),
    'Challenge invitations sent.'
  );

  const inviteSelected = () => runChallenge(
    () => inviteWeeklyChallengeMembers(currentChallenge.id, selectedIds),
    `${selectedIds.length} challenge ${selectedIds.length === 1 ? 'invitation' : 'invitations'} sent.`
  );

  const leaveChallenge = () => {
    if (!currentChallenge) return;
    const message = isCreator
      ? 'Leave this competition? If another traveler has joined, leadership will pass to them. If you are the only accepted traveler, the challenge will end.'
      : 'Leave this competition? Your score will be removed from this challenge, but your Quest XP will stay untouched.';
    if (!window.confirm(message)) return;
    void runChallenge(() => leaveWeeklyChallenge(currentChallenge.id), 'You left the competition.');
  };

  return (
    <section className="cp2-page" aria-labelledby="cp2-title">
      <h1 id="cp2-title" className="cp2-sr-only">Competition</h1>

      <section className="cp2-art cp2-hero" aria-label="Competition. Sail together.">
        <img src="/competition-v2/hero-v2.svg" alt="" aria-hidden="true" />
      </section>

      {!!challengeHub.invites?.length && (
        <section className="cp2-invites" aria-label="Challenge invitations">
          {challengeHub.invites.map(invite => (
            <div className="cp2-invite" key={invite.id}>
              <span>
                <strong>{invite.creatorDisplayName}</strong>
                <small>@{invite.creatorUsername} invited you to this week's challenge · {invite.memberCount || 1}/{invite.maxMembers || MAX_CHALLENGE_MEMBERS} travelers</small>
              </span>
              <div>
                <button type="button" disabled={challengeBusy} onClick={() => runChallenge(() => respondWeeklyChallenge(invite.id, true), 'Challenge joined.')}>Accept</button>
                <button type="button" disabled={challengeBusy} onClick={() => runChallenge(() => respondWeeklyChallenge(invite.id, false), 'Challenge declined.')}>Decline</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {challengeError && <p className="cp2-challenge-status is-error" role="alert">{challengeError}</p>}
      {challengeMessage && <p className="cp2-challenge-status" role="status">{challengeMessage}</p>}

      <section className="cp2-art cp2-challenge" aria-label="Weekly group challenge">
        <img src="/competition-v2/challenge-v5.svg" alt="" aria-hidden="true" />

        <span className="cp2-week-left">{daysLeft === 0 ? 'LAST DAY' : `${daysLeft} DAYS LEFT`}</span>

        <div className="cp2-nameplate">
          <strong>{displayName}</strong>
          <span>LV {level}</span>
        </div>

        <strong className="cp2-stat-value cp2-stat-xp">{stats.scoreXP} XP</strong>
        <strong className="cp2-stat-value cp2-stat-tasks">{stats.eligibleTasks}</strong>
        <strong className="cp2-stat-value cp2-stat-focus">{focusLabel}</strong>

        <div className="cp2-week-progress-label">{stats.scoreXP} / {WEEKLY_METER_TARGET}</div>
        <div className="cp2-week-progress-fill" style={{ width: `${weeklyPct * 0.291}%` }} />

        <div className="cp2-rivals" aria-label="Leading challenge rivals">
          {challengeFriends.map((friend, index) => {
            const score = friendXP(friend);
            const tasks = friendTasks(friend);
            const pending = friend?.status === 'pending';
            return (
              <button
                type="button"
                key={friend?.id || `empty-${index}`}
                className={`cp2-rival-row${friend ? '' : ' is-empty'}${pending ? ' is-pending' : ''}`}
                onClick={!friend && isCreator && remainingSlots ? openAddPicker : undefined}
                aria-label={friend
                  ? `${friend.displayName || friend.name || 'Friend'}, ${pending ? 'invited' : `${score ?? 0} XP and ${tasks ?? 0} tasks finished`}`
                  : isCreator && remainingSlots ? 'Add travelers to this challenge' : 'Empty challenge slot'}
              >
                {friend ? (
                  <>
                    <span className="cp2-rival-avatar">{initials(friend.displayName || friend.name)}</span>
                    <span className="cp2-rival-main">
                      <strong>{friend.displayName || friend.name || 'Friend'}</strong>
                      <small>{pending ? 'Invitation pending' : `LV ${Math.max(1, Number(friend.level) || 1)}`}</small>
                    </span>
                    <strong className="cp2-rival-score">{pending ? 'INVITED' : score == null ? '— XP' : `${score} XP`}</strong>
                    {!pending && <strong className="cp2-rival-tasks">{tasks == null ? '— TASKS' : `${tasks} ${tasks === 1 ? 'TASK' : 'TASKS'}`}</strong>}
                  </>
                ) : isCreator && remainingSlots ? (
                  <img className="cp2-rival-empty-art" src="/competition-v2/rival-empty-v1.svg" alt="" aria-hidden="true" />
                ) : (
                  <span className="cp2-rival-open">Open slot</span>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="cp2-add-friend"
          onClick={currentChallenge && isCreator && remainingSlots ? openAddPicker : currentChallenge ? undefined : openFriends}
          aria-label={currentChallenge ? (isCreator && remainingSlots ? 'Add travelers to this challenge' : 'Challenge is active') : 'Find friends'}
        />
      </section>

      {currentChallenge && (
        <section className="cp2-roster" aria-labelledby="cp2-roster-title">
          <div className="cp2-roster-head">
            <div>
              <small>WEEKLY CREW</small>
              <h2 id="cp2-roster-title">Challenge leaderboard</h2>
            </div>
            <span>{acceptedCount} joined{pendingCount ? ` · ${pendingCount} invited` : ''} · {MAX_CHALLENGE_MEMBERS} max</span>
          </div>

          <div className="cp2-roster-list">
            {challengeLeaderboard.map(member => {
              const xp = friendXP(member) ?? 0;
              const tasks = friendTasks(member) ?? 0;
              return (
                <div className={`cp2-roster-row${member.self ? ' is-self' : ''}`} key={member.id}>
                  <strong className="cp2-roster-rank">#{member.rank}</strong>
                  <span className="cp2-roster-avatar">{initials(member.displayName)}</span>
                  <span className="cp2-roster-person">
                    <b>{member.displayName}{member.self ? ' · YOU' : ''}{member.isCreator ? ' · CAPTAIN' : ''}</b>
                    <small>{tasks} {tasks === 1 ? 'task' : 'tasks'} completed</small>
                  </span>
                  <strong className="cp2-roster-xp">{xp} XP</strong>
                </div>
              );
            })}
            {pendingRivals.map(member => (
              <div className="cp2-roster-row is-pending" key={`pending-${member.id}`}>
                <strong className="cp2-roster-rank">—</strong>
                <span className="cp2-roster-avatar">{initials(member.displayName)}</span>
                <span className="cp2-roster-person"><b>{member.displayName}</b><small>Invitation pending</small></span>
                <strong className="cp2-roster-xp">INVITED</strong>
              </div>
            ))}
          </div>

          {isCreator && remainingSlots > 0 && (
            <button type="button" className="cp2-roster-add" onClick={openAddPicker}>+ Add travelers ({remainingSlots} slots left)</button>
          )}
        </section>
      )}

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
            <div className={`cp2-league-row${row.self ? ' is-self' : row.xp == null ? ' is-empty' : ''}`} key={`${row.id || row.name}-${index}`}>
              <span>
                <b>{row.name}</b>
                <small>{row.rank ? `#${row.rank} · ` : ''}{row.tasks == null ? 'waiting for stats' : `${row.tasks} ${row.tasks === 1 ? 'task' : 'tasks'}`}</small>
              </span>
              <strong>{row.xp == null ? '—' : `${row.xp} XP`}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="cp2-art cp2-actions" aria-label="Competition actions">
        <img src="/competition-v2/actions-v2.svg" alt="" aria-hidden="true" />
        <button type="button" className="cp2-action cp2-find" onClick={openFriends} aria-label="Find friends" />
        <button
          type="button"
          className={`cp2-action cp2-start${currentChallenge ? ' is-active' : ''}`}
          onClick={currentChallenge ? undefined : openStartPicker}
          aria-label={currentChallenge ? 'Weekly challenge active' : 'Start a weekly challenge'}
        />
      </section>

      <div className="cp2-note">
        <span>{currentChallenge
          ? `Weekly challenge active with ${acceptedCount} traveler${acceptedCount === 1 ? '' : 's'}. Scores update from balanced Quest XP and finished tasks.`
          : `Choose up to ${MAX_CHALLENGE_RIVALS} friends and start this week’s challenge.`}</span>
        {currentChallenge && (
          <div className="cp2-note-actions">
            <button type="button" className="cp2-leave" disabled={challengeBusy} onClick={leaveChallenge}>Leave competition</button>
            {isCreator && (
              <button type="button" className="cp2-end" disabled={challengeBusy} onClick={() => {
                if (window.confirm('End this weekly challenge for everyone?')) {
                  void runChallenge(() => cancelWeeklyChallenge(currentChallenge.id), 'Challenge ended.');
                }
              }}>End for everyone</button>
            )}
          </div>
        )}
      </div>

      {showPicker && (
        <div className="cp2-picker-backdrop" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) setShowPicker(false);
        }}>
          <section className="cp2-picker" role="dialog" aria-modal="true" aria-labelledby="cp2-picker-title">
            <button type="button" className="cp2-picker-close" aria-label="Close" onClick={() => setShowPicker(false)}>×</button>
            <p>SAIL TOGETHER</p>
            <h2 id="cp2-picker-title">{currentChallenge ? 'Add travelers' : 'Start Weekly Challenge'}</h2>
            <span>{currentChallenge
              ? `Choose up to ${remainingSlots} more ${remainingSlots === 1 ? 'traveler' : 'travelers'} for this week.`
              : `Choose 1–${MAX_CHALLENGE_RIVALS} friends. The challenge runs through Sunday.`}</span>

            <div className="cp2-picker-list">
              {(currentChallenge ? availableFriends : liveFriends).map(friend => {
                const selected = selectedIds.includes(friend.id);
                return (
                  <button
                    type="button"
                    className={`cp2-picker-friend${selected ? ' is-selected' : ''}`}
                    key={friend.id}
                    disabled={challengeBusy}
                    onClick={() => toggleSelected(friend.id)}
                  >
                    <b>{initials(friend.displayName)}</b>
                    <span><strong>{friend.displayName}</strong><small>@{friend.username || 'traveler'}</small></span>
                    <em>{selected ? 'Selected' : 'Choose'}</em>
                  </button>
                );
              })}
              {!(currentChallenge ? availableFriends : liveFriends).length && (
                <p className="cp2-picker-empty">No other friends are available for this challenge.</p>
              )}
            </div>

            <button
              type="button"
              className="cp2-picker-start"
              disabled={challengeBusy || !selectedIds.length}
              onClick={currentChallenge ? inviteSelected : createChallenge}
            >
              {challengeBusy
                ? (currentChallenge ? 'Inviting…' : 'Starting…')
                : currentChallenge
                  ? `Invite ${selectedIds.length || 0} ${selectedIds.length === 1 ? 'traveler' : 'travelers'}`
                  : `Start with ${selectedIds.length || 0} ${selectedIds.length === 1 ? 'friend' : 'friends'}`}
            </button>
            <button type="button" className="cp2-picker-find" onClick={openFriends}>Find more friends</button>
          </section>
        </div>
      )}
    </section>
  );
}
