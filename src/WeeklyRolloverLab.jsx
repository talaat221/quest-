import { useMemo, useState } from "react";
import { QuestHistoryPanel, WeeklyCleanupModal } from "./TaskLifecycleUI.jsx";
import { getCompletedTasks, getPastUnfinishedTasks, sortQuestTasksForCurrentWeek } from "./task-lifecycle.js";
import { weekOf } from "./weekly-planner.js";
import "./weekly-rollover-lab.css";

const SUNDAY = "2026-10-11";
const MONDAY = "2026-10-12";

function fixture() {
  return {
    cleanupWeek: weekOf(SUNDAY),
    domains: [
      {
        id: "quest-marketing",
        name: "Quest Marketing",
        emoji: "⚔️",
        color: "#8B5CF6",
        tasks: [
          {
            id: "founder-reel",
            name: "Publish founder Reel",
            xp: 35,
            plannedWeek: weekOf(SUNDAY),
            day: "2026-10-08",
            hour: 18,
            estimatedMinutes: 75,
            actualMinutes: 68,
            done: true,
            doneAt: "2026-10-08T18:42:00+03:00",
          },
          {
            id: "creator-outreach",
            name: "Contact 10 micro-creators",
            xp: 25,
            plannedWeek: weekOf(SUNDAY),
            day: "2026-10-10",
            hour: 17,
            estimatedMinutes: 30,
            actualMinutes: null,
            done: false,
            doneAt: null,
          },
          {
            id: "challenge-launch",
            name: "Launch the 7-Day Quest",
            xp: 30,
            plannedWeek: weekOf(SUNDAY),
            day: null,
            hour: null,
            estimatedMinutes: 45,
            actualMinutes: null,
            done: false,
            doneAt: null,
          },
          {
            id: "next-week-plan",
            name: "Plan next week's content",
            xp: 20,
            plannedWeek: weekOf(MONDAY),
            day: "2026-10-12",
            hour: 11,
            estimatedMinutes: 30,
            actualMinutes: null,
            done: false,
            doneAt: null,
          },
        ],
      },
      {
        id: "university",
        name: "University",
        emoji: "🎓",
        color: "#67B9E8",
        tasks: [
          {
            id: "pharma-review",
            name: "Review pharmacology lecture",
            xp: 30,
            plannedWeek: weekOf(SUNDAY),
            day: "2026-10-09",
            hour: 20,
            estimatedMinutes: 60,
            actualMinutes: 53,
            done: true,
            doneAt: "2026-10-09T21:02:00+03:00",
          },
        ],
      },
    ],
  };
}

function TaskRow({ task }) {
  return (
    <article className={"wrl-task" + (task.done ? " is-done" : "")}>
      <button type="button" className="wrl-check" aria-label={task.done ? "Completed task" : "Unfinished task"}>
        {task.done ? "✓" : ""}
      </button>
      <div className="wrl-task-copy">
        <strong>{task.name}</strong>
        <small>
          {task.done
            ? "Completed this week"
            : task.day
              ? `${task.day} · scheduled`
              : `Week of ${task.plannedWeek}`}
        </small>
      </div>
      <span className="wrl-xp">{task.xp} XP</span>
    </article>
  );
}

export default function WeeklyRolloverLab() {
  const [scenario, setScenario] = useState(() => fixture());
  const [dateKey, setDateKey] = useState(SUNDAY);
  const [tab, setTab] = useState("active");
  const [snoozedWeek, setSnoozedWeek] = useState(null);

  const currentWeek = weekOf(dateKey);
  const oldTasks = useMemo(
    () => getPastUnfinishedTasks(scenario.domains, currentWeek),
    [scenario.domains, currentWeek]
  );
  const history = useMemo(
    () => getCompletedTasks(scenario.domains),
    [scenario.domains]
  );

  const cleanupOpen =
    scenario.cleanupWeek !== currentWeek &&
    oldTasks.length > 0 &&
    snoozedWeek !== currentWeek;

  const mutateTask = (domainId, taskId, action) => {
    setScenario((previous) => ({
      ...previous,
      domains: previous.domains.map((domain) => {
        if (domain.id !== domainId) return domain;
        return {
          ...domain,
          tasks: action(domain.tasks, domain),
        };
      }),
    }));
  };

  const carry = (domainId, taskId) => {
    mutateTask(domainId, taskId, (tasks) =>
      tasks.map((task) =>
        task.id === taskId && !task.done
          ? { ...task, plannedWeek: currentWeek, day: null, hour: null }
          : task
      )
    );
  };

  const remove = (domainId, taskId) => {
    mutateTask(domainId, taskId, (tasks) =>
      tasks.filter((task) => task.done || task.id !== taskId)
    );
  };

  const carryAll = () => {
    const keys = new Set(oldTasks.map((task) => `${task.domainId}:${task.id}`));
    setScenario((previous) => ({
      ...previous,
      domains: previous.domains.map((domain) => ({
        ...domain,
        tasks: domain.tasks.map((task) =>
          keys.has(`${domain.id}:${task.id}`) && !task.done
            ? { ...task, plannedWeek: currentWeek, day: null, hour: null }
            : task
        ),
      })),
    }));
  };

  const removeAll = () => {
    const keys = new Set(oldTasks.map((task) => `${task.domainId}:${task.id}`));
    setScenario((previous) => ({
      ...previous,
      domains: previous.domains.map((domain) => ({
        ...domain,
        tasks: domain.tasks.filter(
          (task) => task.done || !keys.has(`${domain.id}:${task.id}`)
        ),
      })),
    }));
  };

  const markWeekResolved = () => {
    setScenario((previous) => ({ ...previous, cleanupWeek: currentWeek }));
    setSnoozedWeek(null);
  };

  const reset = () => {
    setScenario(fixture());
    setDateKey(SUNDAY);
    setTab("active");
    setSnoozedWeek(null);
  };

  const openMonday = () => {
    setDateKey(MONDAY);
    setTab("active");
    setSnoozedWeek(null);
  };

  return (
    <main className="wrl-root">
      <section className="wrl-shell">
        <header className="wrl-hero">
          <div>
            <span className="wrl-eyebrow">PREVIEW-ONLY TEST LAB</span>
            <h1>Quest Weekly Rollover</h1>
            <p>
              Fake data only. Nothing here touches Supabase, your real Quest account,
              or production.
            </p>
          </div>
          <div className="wrl-date-card">
            <span>SIMULATED DATE</span>
            <strong>{dateKey === SUNDAY ? "SUN · OCT 11" : "MON · OCT 12"}</strong>
            <small>Week of {currentWeek}</small>
          </div>
        </header>

        <section className="wrl-controls">
          <button
            type="button"
            className={dateKey === SUNDAY ? "is-active" : ""}
            onClick={() => { setDateKey(SUNDAY); setSnoozedWeek(null); }}
          >
            1. Sunday · Before rollover
          </button>
          <button
            type="button"
            className={dateKey === MONDAY ? "is-active is-next" : "is-next"}
            onClick={openMonday}
          >
            2. Advance to Monday →
          </button>
          <button type="button" className="is-reset" onClick={reset}>
            Reset scenario
          </button>
        </section>

        <div className="wrl-explainer">
          {dateKey === SUNDAY ? (
            <>
              <b>Sunday:</b> completed tasks are still visible at the bottom of each Quest.
              Two unfinished marketing tasks are still part of this week.
            </>
          ) : (
            <>
              <b>Monday:</b> last week’s completed tasks leave the active lists and stay in
              Quest History. Unfinished old tasks must be reviewed.
            </>
          )}
        </div>

        <nav className="wrl-tabs" aria-label="Test views">
          <button type="button" className={tab === "active" ? "is-active" : ""} onClick={() => setTab("active")}>
            Active Quests
          </button>
          <button type="button" className={tab === "history" ? "is-active" : ""} onClick={() => setTab("history")}>
            Quest History <span>{history.length}</span>
          </button>
        </nav>

        {tab === "history" ? (
          <QuestHistoryPanel tasks={history} resetHour={0} />
        ) : (
          <section className="wrl-quests">
            {scenario.domains.map((domain) => {
              const visible = sortQuestTasksForCurrentWeek(domain.tasks, currentWeek, 0);
              return (
                <article className="wrl-quest-card" key={domain.id}>
                  <header>
                    <span className="wrl-quest-icon" aria-hidden="true">{domain.emoji}</span>
                    <div>
                      <h2>{domain.name}</h2>
                      <p>{visible.filter((task) => !task.done).length} active · {visible.filter((task) => task.done).length} completed shown</p>
                    </div>
                  </header>
                  <div className="wrl-task-list">
                    {visible.map((task) => <TaskRow key={task.id} task={task} />)}
                    {visible.length === 0 && <div className="wrl-empty">No active tasks this week.</div>}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {dateKey === MONDAY && !cleanupOpen && oldTasks.length === 0 && (
          <section className="wrl-result">
            <strong>✓ Weekly cleanup resolved</strong>
            <span>The active Quest is clean. History still keeps completed work.</span>
            <button type="button" onClick={markWeekResolved}>Mark this week reviewed</button>
          </section>
        )}

        {dateKey === MONDAY && snoozedWeek === currentWeek && oldTasks.length > 0 && (
          <section className="wrl-result is-warning">
            <strong>Decided later</strong>
            <span>{oldTasks.length} old unfinished task{oldTasks.length === 1 ? "" : "s"} remain untouched for this session.</span>
            <button type="button" onClick={() => setSnoozedWeek(null)}>Open cleanup again</button>
          </section>
        )}
      </section>

      {cleanupOpen && (
        <WeeklyCleanupModal
          tasks={oldTasks}
          onCarry={carry}
          onRemove={remove}
          onCarryAll={carryAll}
          onRemoveAll={removeAll}
          onLater={() => setSnoozedWeek(currentWeek)}
        />
      )}
    </main>
  );
}
