import { useEffect, useRef } from "react";
import { formatMinutes } from "./task-timer.js";
import { rewardTaskDay } from "./rewards.js";
import "./task-lifecycle.css";

export function QuestHistoryPanel({
  tasks = [],
  resetHour = 0,
  kicker = "COMPLETED TASKS",
  title = "Quest History",
  description = "Finished work leaves the active list, but the progress stays.",
  emptyTitle = "No completed tasks yet.",
  emptyDescription = "Your finished quests will be remembered here.",
}) {
  return (
    <section className="tl-history" aria-labelledby="tl-history-title">
      <header className="tl-history-head">
        <div>
          <span>{kicker}</span>
          <h2 id="tl-history-title">{title}</h2>
          <p>{description}</p>
        </div>
        <b>{tasks.length}<small>finished</small></b>
      </header>

      {tasks.length ? (
        <div className="tl-history-list">
          {tasks.map((task) => {
            const completedDay = task.doneAt ? rewardTaskDay(task.doneAt, resetHour) : null;
            const label = completedDay
              ? new Date(`${completedDay}T12:00:00`).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Completed";
            const duration = Number(task.actualMinutes) > 0
              ? `${formatMinutes(task.actualMinutes)} actual`
              : Number(task.estimatedMinutes) > 0
                ? `~${formatMinutes(task.estimatedMinutes)} est.`
                : "";

            return (
              <article className="tl-history-row" key={`${task.domainId}:${task.id}`}>
                <span className="tl-history-check" aria-hidden="true">✓</span>
                <div className="tl-history-copy">
                  <strong>{task.name}</strong>
                  <small>
                    {task.domainEmoji} {task.domainName} · {label}
                    {duration ? ` · ${duration}` : ""}
                  </small>
                </div>
                <b className="tl-history-xp">+{task.creditedXP ?? task.xp ?? 0} XP</b>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="tl-history-empty">
          <span aria-hidden="true">📜</span>
          <strong>{emptyTitle}</strong>
          <small>{emptyDescription}</small>
        </div>
      )}
    </section>
  );
}

export function WeeklyCleanupModal({
  tasks = [],
  onCarry,
  onRemove,
  onCarryAll,
  onRemoveAll,
  onLater,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onLater?.();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [onLater]);

  return (
    <div className="tl-cleanup-backdrop">
      <section
        className="tl-cleanup"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tl-cleanup-title"
        tabIndex={-1}
      >
        <span className="tl-cleanup-kicker">NEW WEEK</span>
        <h2 id="tl-cleanup-title">What still deserves a place in your Quest?</h2>
        <p>
          {tasks.length} unfinished {tasks.length === 1 ? "task was" : "tasks were"} left behind.
          Carry forward what still matters and clear what does not.
        </p>

        <div className="tl-cleanup-list">
          {tasks.map((task) => (
            <article className="tl-cleanup-row" key={`${task.domainId}:${task.id}`}>
              <div className="tl-cleanup-task">
                <span aria-hidden="true">{task.domainEmoji}</span>
                <div>
                  <strong>{task.name}</strong>
                  <small>{task.domainName}</small>
                </div>
              </div>
              <div className="tl-cleanup-row-actions">
                <button type="button" className="is-carry" onClick={() => onCarry(task.domainId, task.id)}>
                  Keep this week
                </button>
                <button
                  type="button"
                  className="is-remove"
                  onClick={() => {
                    if (window.confirm(`Remove “${task.name}”? This cannot be undone.`)) {
                      onRemove(task.domainId, task.id);
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="tl-cleanup-actions">
          <button type="button" className="is-primary" onClick={onCarryAll}>Keep all this week</button>
          <button
            type="button"
            className="is-danger"
            onClick={() => {
              if (window.confirm(`Remove all ${tasks.length} unfinished old tasks? This cannot be undone.`)) {
                onRemoveAll();
              }
            }}
          >
            Remove all
          </button>
          <button type="button" className="is-later" onClick={onLater}>Decide later</button>
        </div>

        <small className="tl-cleanup-note">
          Carrying a task forward clears its old date and time so it can be planned cleanly this week.
        </small>
      </section>
    </div>
  );
}
