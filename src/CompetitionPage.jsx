import { competitionWeekStats } from './competition.js';
import './competition.css';

function Avatar({ label, muted = false }) {
  const initials = String(label || '?').trim().slice(0, 2).toUpperCase();
  return <span className={`cp-avatar${muted ? ' is-muted' : ''}`} aria-hidden="true">{initials}</span>;
}

function StatLine({ icon, children }) {
  return <div className="cp-stat-line"><span aria-hidden="true">{icon}</span><strong>{children}</strong></div>;
}

export default function CompetitionPage({ progression, weekKey, todayKey, displayName = 'You', focusMinutes = 0, level = 1 }) {
  const stats = competitionWeekStats({ progression, weekKey, todayKey });
  const leagueRows = [
    { name: displayName, xp: stats.scoreXP, self: true },
    { name: 'Invite a friend', xp: null },
    { name: 'Invite a friend', xp: null },
    { name: 'Invite a friend', xp: null },
    { name: 'Invite a friend', xp: null },
  ];

  return (
    <section className="cp-page" aria-labelledby="cp-title">
      <header className="cp-art cp-hero">
        <img src="/competition/hero-v1.svg" alt="" aria-hidden="true" />
        <div className="cp-hero-copy">
          <p>SAIL TOGETHER</p>
          <h1 id="cp-title">Competition</h1>
          <span>Push each other a little further.</span>
        </div>
      </header>

      <section className="cp-art cp-challenge" aria-labelledby="cp-challenge-title">
        <img src="/competition/challenge-shell-v1.svg" alt="" aria-hidden="true" />
        <div className="cp-challenge-heading">
          <div><span aria-hidden="true">⚔</span><strong id="cp-challenge-title">Weekly 1v1 Challenge</strong></div>
          <small>MON → SUN</small>
        </div>

        <div className="cp-player cp-player-left">
          <Avatar label={displayName} />
          <h2>{displayName}</h2>
          <span className="cp-level">LV {level}</span>
          <StatLine icon="★">{stats.scoreXP} XP this week</StatLine>
          <StatLine icon="✓">{stats.eligibleTasks} eligible tasks</StatLine>
          <StatLine icon="◷">{focusMinutes} focused min today</StatLine>
        </div>

        <div className="cp-versus" aria-hidden="true">VS</div>

        <div className="cp-player cp-player-right is-empty">
          <Avatar label="?" muted />
          <h2>No rival yet</h2>
          <span className="cp-level">FRIEND SLOT</span>
          <p>Add a friend, then challenge them for the week.</p>
        </div>

        <div className="cp-challenge-footer">
          <strong>{stats.scoreXP} XP ready</strong>
          <span>Your score already uses the balanced XP rules.</span>
        </div>
      </section>

      <section className="cp-art cp-today" aria-labelledby="cp-today-title">
        <img src="/competition/today-shell-v1.svg" alt="" aria-hidden="true" />
        <div className="cp-section-heading"><strong id="cp-today-title">▣ Today</strong><span>A small day still counts.</span></div>
        <div className="cp-today-card cp-today-left">
          <h3>★ XP earned today</h3>
          <div className="cp-today-row"><Avatar label={displayName} /><span>{displayName}</span><strong>{stats.todayXP} XP</strong></div>
          <div className="cp-mini-bar"><span style={{ width: `${Math.min(100, stats.todayXP ? 72 : 0)}%` }} /></div>
        </div>
        <div className="cp-today-card cp-today-right">
          <h3>✓ Tasks done today</h3>
          <div className="cp-today-row"><Avatar label={displayName} /><span>{displayName}</span><strong>{stats.todayTasks} tasks</strong></div>
          <div className="cp-task-pips" aria-label={`${stats.todayTasks} eligible tasks today`}>
            {Array.from({ length: 8 }, (_, index) => <i key={index} className={index < Math.min(8, stats.todayTasks) ? 'on' : ''} />)}
          </div>
        </div>
      </section>

      <section className="cp-art cp-league" aria-labelledby="cp-league-title">
        <img src="/competition/league-shell-v1.svg" alt="" aria-hidden="true" />
        <div className="cp-section-heading"><strong id="cp-league-title">♟ Friends League</strong><span>This week's XP</span></div>
        <div className="cp-league-rows">
          {leagueRows.map((row, index) => (
            <div className={`cp-league-row${row.self ? ' is-self' : ' is-empty'}`} key={`${row.name}-${index}`}>
              <b>{index + 1}</b><Avatar label={row.name} muted={!row.self} /><span>{row.name}</span><strong>{row.xp == null ? '—' : `${row.xp} XP`}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="cp-art cp-actions" aria-label="Competition actions">
        <img src="/competition/actions-shell-v1.svg" alt="" aria-hidden="true" />
        <button type="button" disabled title="Friend challenges are the next build step">⚔ Start New Challenge</button>
        <button type="button" disabled title="Friends are the next build step">♟ Friends ›</button>
      </section>

      <p className="cp-build-note">Friend requests and live rivals are the next layer. This page already reads your real balanced XP.</p>
    </section>
  );
}
