import { useId, useState, useEffect } from "react";
import { supabase, flushQuestSync, getQuestSyncSnapshot, subscribeQuestSync, resolveQuestConflict } from "./supabaseClient";
import "./home-finish.css";
import "./day-pause.css";
import AccountResetCard from "./AccountResetCard.jsx";

const farmPicture = <image href="/home-finish/farm-streak-v1.webp" width="959" height="1640" />;

export function FarmAndStreak({ streak }) {
  const farmId = useId();
  const streakId = useId();
  return (
    <div className="qd-farm-streak">
      <section className="qd-farm-status" aria-labelledby={farmId}>
        <svg className="qd-home-art" viewBox="14 100 931 1028" preserveAspectRatio="none" aria-hidden="true" focusable="false">{farmPicture}</svg>
        <h2 id={farmId} className="qd-anchor-sr-only">Farm Status</h2>
        <span className="qd-anchor-sr-only">A preview of your garden. Farm features are coming later.</span>
        <p className="qd-farm-caption">Your progress today<br />is growing something<br />real <span aria-hidden="true">🌱</span></p>
      </section>
      <a href="#stats" className="qd-streak-card" aria-labelledby={streakId}>
        <svg className="qd-home-art" viewBox="14 1140 931 470" preserveAspectRatio="none" aria-hidden="true" focusable="false">{farmPicture}</svg>
        <h2 id={streakId} className="qd-anchor-sr-only">Streak: {streak} {streak === 1 ? "day" : "days"}. View stats.</h2>
        <span className="qd-streak-value" aria-hidden="true">{streak} {streak === 1 ? "day" : "days"}</span>
        <span className="qd-streak-caption" aria-hidden="true">{streak ? "Keep going!" : "A fresh start."}</span>
        <svg className="qd-streak-chevron" viewBox="0 0 12 20" aria-hidden="true" focusable="false"><path d="M2 2L10 10L2 18" fill="none" stroke="currentColor" strokeWidth="3" /></svg>
      </a>
    </div>
  );
}

export function StopDay({ adjustment, onStop, onRestore }) {
  const paused = adjustment?.mode === "harbor";
  const title = adjustment ? (paused ? "RESUME DAY" : "RESTORE DAY") : "STOP DAY";
  const caption = adjustment ? "Return to your normal plan when you’re ready" : "Pause today and protect what matters";
  return (
    <div className="qd-stop-day-wrap">
      <button type="button" className="qd-stop-day" onClick={adjustment ? onRestore : onStop} aria-label={`${title}. ${caption}`}>
        <svg className="qd-home-art" viewBox="14 175 2096 396" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <image href="/home-finish/stop-day-v1.webp" width="2125" height="740" />
        </svg>
        <span className="qd-stop-day-title"><span className={adjustment ? "qd-resume-triangle" : "qd-stop-square"} aria-hidden="true" />{title}</span>
        <span className="qd-stop-day-caption">{caption}</span>
      </button>
    </div>
  );
}

export function DayPauseNotice({ adjustment, importantName }) {
  const [sync, setSync] = useState(getQuestSyncSnapshot);
  useEffect(() => subscribeQuestSync(setSync), []);
  const paused = adjustment.mode === "harbor";
  const moved = adjustment.movedTasks?.length || 0;
  return (
    <aside className="qd-day-pause-notice" aria-label={paused ? "Day paused" : "Lighter day"}>
      <div role="status">
        <strong>{paused ? "DAY PAUSED" : `LIGHTER DAY · ${adjustment.capacityPct}%`}</strong>
        <span>{adjustment.reason}{adjustment.note ? ` · ${adjustment.note}` : ""}</span>
        {importantName && <span>Important: {importantName}</span>}
        <span>{moved ? `${moved} flexible ${moved === 1 ? "task rescheduled" : "tasks rescheduled"}. ` : ""}Completed work and XP are kept.{paused ? " Daily treasure is paused." : ""}</span>
      </div>
      {sync.state !== "synced" && <a href="#more">{sync.state === "conflict" ? "Sync needs attention — open More" : sync.state === "offline" ? "Offline — cloud sync waiting" : "Saving changes… Check sync"}</a>}
    </aside>
  );
}

function NavIcon({ type }) {
  const paths = {
    home: <><path d="M3 14L16 3L29 14M7 12V29H25V12M13 29V20H19V29M22 4V9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="miter" /><path d="M9 14V27H11V18H21V27H23V14L16 8Z" fill="currentColor" opacity=".14" /></>,
    quests: <><path d="M10 6H5V29H27V6H22M12 4H14V2H18V4H21V9H11V4Z" fill="none" stroke="currentColor" strokeWidth="2.3" /><path d="M10 14H13M16 14H23M10 19H13M16 19H23M10 24H13M16 24H23" stroke="currentColor" strokeWidth="2" /></>,
    anchors: <><path d="M13 2H19V4H21V8H19V10H13V8H11V4H13Z" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M16 10V28M10 14H22M4 20V24L9 28L16 30L23 28L28 24V20M1 22L4 19L7 22M25 22L28 19L31 22" fill="none" stroke="currentColor" strokeWidth="2.5" /></>,
    stats: <><path d="M3 14H9V29H3ZM13 3H19V29H13ZM23 10H29V29H23Z" fill="currentColor" /><path d="M3 14H9M13 3H19M23 10H29" stroke="#a3c8df" strokeWidth="1" opacity=".45" /></>,
    more: <path d="M3 13H7V14H8V18H7V19H3V18H2V14H3ZM14 13H18V14H19V18H18V19H14V18H13V14H14ZM25 13H29V14H30V18H29V19H25V18H24V14H25Z" fill="currentColor" />,
  };
  return <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" shapeRendering="crispEdges">{paths[type]}</svg>;
}

const tabs = [["home", "Home"], ["quests", "Quests"], ["anchors", "Anchors"], ["stats", "Stats"], ["more", "More"]];

export function BottomNavigation({ page }) {
  const active = page === "today-quests" ? "quests" : page;
  return (
    <div className="qd-bottom-dock">
      <nav className="qd-bottom-navigation" aria-label="Main navigation">
        <svg className="qd-home-art" viewBox="10 263 1963 262" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <image href="/home-finish/navigation-v1.webp" width="1983" height="793" />
        </svg>
        {tabs.map(([key, label]) => (
          <a key={key} href={`#${key}`} aria-current={active === key ? "page" : undefined} className={active === key ? "is-active" : ""}>
            <NavIcon type={key} /><span>{label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

export function HomePageHeading({ title, children }) {
  return <header className="qd-home-page-heading"><a href="#home">‹ Back to Home</a><h1>{title}</h1>{children}</header>;
}

export function StatsPage({ streak, completed, total, todayXP, weekXP, lifetimeXP, level }) {
  return (
    <>
      <HomePageHeading title="Your progress"><p>Small steps add up.</p></HomePageHeading>
      <dl className="qd-stats-summary">
        {[["Current streak", `${streak} ${streak === 1 ? "day" : "days"}`], ["Today’s tasks", `${completed} / ${total}`], ["Today’s XP", todayXP], ["This week’s XP", weekXP], ["Total XP", lifetimeXP], ["Level", level]].map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}
      </dl>
      <p className="qd-streak-explanation">Your streak counts consecutive days with at least one completed task or anchor. You have until your daily reset to keep it going.</p>
      <a className="qd-home-page-link" href="#today-quests">See today’s tasks ›</a>
    </>
  );
}

export function MorePage({ resetHour, onResetHour, onResetAccount }) {
  const [sync, setSync] = useState(getQuestSyncSnapshot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resetting, setResetting] = useState(false);
  const locked = busy || resetting;
  useEffect(() => subscribeQuestSync(setSync), []);
  const run = async (action) => {
    if (locked) return;
    setBusy(true); setError("");
    try { await action(); } catch { setError("That didn’t finish. Please try again."); }
    finally { setBusy(false); }
  };
  const resolve = (strategy) => {
    const question = strategy === "cloud" ? "Use the cloud copy and discard unsynced changes from this device?" : "Keep this device and replace the cloud copy with it?";
    if (window.confirm(question)) void run(() => resolveQuestConflict(strategy));
  };
  return (
    <>
      <HomePageHeading title="More"><p>Make room for your own rhythm.</p></HomePageHeading>
      <section className="qd-home-settings-card" aria-labelledby="qd-more-day-reset">
        <h2 id="qd-more-day-reset">Day reset time</h2>
        <p>Your next day starts at this hour.</p>
        <label htmlFor="qd-more-reset-time" className="qd-anchor-sr-only">Day reset time</label>
        <select id="qd-more-reset-time" value={resetHour} disabled={locked} onChange={(event) => onResetHour(event.target.value)}>
          {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{`${hour % 12 || 12}:00 ${hour < 12 ? "AM" : "PM"}`}</option>)}
        </select>
      </section>
      <section className="qd-home-settings-card" aria-labelledby="qd-more-sync">
        <h2 id="qd-more-sync">Your progress</h2>
        <p role="status">{sync.message}</p>
        {sync.state === "conflict" ? <>
          <p>This device and the cloud have different saved changes. Choose the copy you want to keep.</p>
          <button type="button" disabled={locked} onClick={() => resolve("cloud")}>Use cloud copy</button>
          <button type="button" disabled={locked} onClick={() => resolve("local")}>Keep this device</button>
        </> : <button type="button" disabled={locked || sync.state === "syncing"} onClick={() => void run(flushQuestSync)}>{busy ? "Checking…" : "Sync now"}</button>}
        {error && <p role="alert">{error}</p>}
      </section>
      <AccountResetCard onReset={onResetAccount} disabled={busy} onBusyChange={setResetting} />
      <button className="qd-more-sign-out" type="button" disabled={locked} onClick={() => void run(async () => { const { error: signOutError } = await supabase.auth.signOut(); if (signOutError) throw signOutError; })}>Log out</button>
    </>
  );
}
