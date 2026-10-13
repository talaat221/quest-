import { useId, useState, useEffect } from "react";
import { getQuestSyncSnapshot, subscribeQuestSync } from "./supabaseClient";
import "./home-finish.css";
import "./day-pause.css";
import { FarmMini } from "./FarmPage.jsx";

const farmPicture = <image href="/home-finish/farm-streak-v1.webp" width="959" height="1640" />;

export function FarmAndStreak({ streak, farmController }) {
  const streakId = useId();
  return (
    <div className="qd-farm-streak">
      <FarmMini controller={farmController} />
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
      {sync.state !== "synced" && <a href="#settings/sync">{sync.state === "conflict" ? "Sync needs attention — open Settings" : sync.state === "offline" ? "Offline — cloud sync waiting" : "Saving changes… Check sync"}</a>}
    </aside>
  );
}

export { NavigationDock as BottomNavigation } from "./AppNavigation.jsx";

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
