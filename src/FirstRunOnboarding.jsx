import { useMemo, useState } from "react";
import "./FirstRunOnboarding.css";

const QUEST_PRESETS = [
  { key: "university", emoji: "🎓", label: "University", color: "#6FA86F" },
  { key: "fitness", emoji: "💪", label: "Fitness", color: "#7EC5A0" },
  { key: "work", emoji: "💼", label: "Work", color: "#7596D6" },
  { key: "creative", emoji: "🎬", label: "Creative Work", color: "#8B5CF6" },
  { key: "learning", emoji: "📚", label: "Learning", color: "#E7C878" },
  { key: "business", emoji: "📈", label: "Business", color: "#CBA66A" },
];

const FEATURE_CARDS = [
  ["🌱", "Farm", "Your real progress grows a world you can see."],
  ["🎯", "Goals", "Keep weekly and monthly ambitions above the daily noise."],
  ["📊", "Stats", "Notice patterns in completion, XP, focus, and consistency."],
  ["🧠", "Quest intelligence", "Quest learns how long your work really takes."],
  ["📚", "Study With Me", "A focused room and timer when starting feels hard."],
  ["⚔️", "Friends & competitions", "Turn consistency into friendly challenges."],
  ["🛟", "Stop Day", "Protect rest without making a hard day feel like failure."],
  ["🎁", "Rewards", "Turn progress into small things worth looking forward to."],
];

function Progress({ step, total }) {
  return (
    <div className="fro-progress" aria-label={"Step " + (step + 1) + " of " + total}>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={index <= step ? "is-active" : ""} />
      ))}
    </div>
  );
}

function LoopDiagram() {
  return (
    <div className="fro-loop" aria-label="Plan, do, earn XP, grow your world, repeat">
      {[
        ["01", "PLAN", "Choose what matters today."],
        ["02", "DO", "Work on it in the real world."],
        ["03", "EARN XP", "Quest records the progress."],
        ["04", "GROW", "Your level and farm move with you."],
      ].map(([n, title, text], index) => (
        <div className="fro-loop-item" key={title}>
          <span className="fro-loop-number">{n}</span>
          <strong>{title}</strong>
          <small>{text}</small>
          {index < 3 && <span className="fro-loop-arrow" aria-hidden="true">↓</span>}
        </div>
      ))}
    </div>
  );
}

export default function FirstRunOnboarding({ onFinish, onClose, replay = false }) {
  const [step, setStep] = useState(0);
  const [presetKey, setPresetKey] = useState("university");
  const preset = useMemo(
    () => QUEST_PRESETS.find((item) => item.key === presetKey) || QUEST_PRESETS[0],
    [presetKey]
  );
  const [questName, setQuestName] = useState("University");
  const [taskName, setTaskName] = useState("");
  const [taskDay, setTaskDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [taskMinutes, setTaskMinutes] = useState("45");
  const [error, setError] = useState("");

  const total = replay ? 6 : 8;
  const maxStep = total - 1;
  const displayQuestName = questName.trim() || preset.label;

  const next = () => {
    setError("");
    setStep((value) => Math.min(maxStep, value + 1));
  };
  const back = () => {
    setError("");
    setStep((value) => Math.max(0, value - 1));
  };

  const finishReplay = () => onClose?.();

  const submitQuest = () => {
    if (!displayQuestName) {
      setError("Give this Quest a name first.");
      return;
    }
    next();
  };

  const submitTask = () => {
    const cleanTask = taskName.trim();
    if (!cleanTask) {
      setError("Start with one real action you can actually finish.");
      return;
    }
    const minutes = Math.min(1440, Math.max(5, Number(taskMinutes) || 45));
    onFinish?.({
      quest: { name: displayQuestName, emoji: preset.emoji, color: preset.color },
      task: {
        name: cleanTask,
        day: taskDay || new Date().toISOString().slice(0, 10),
        estimatedMinutes: minutes,
      },
    });
  };

  const skip = () => onFinish?.({ skipped: true });

  return (
    <div className="fro-backdrop" role="dialog" aria-modal="true" aria-label="Quest first-time guide">
      <main className="fro-shell">
        <div className="fro-sky" aria-hidden="true">
          <span className="fro-star fro-star-a">✦</span>
          <span className="fro-star fro-star-b">·</span>
          <span className="fro-star fro-star-c">✧</span>
        </div>

        <header className="fro-topbar">
          <span className="fro-brand">QUEST</span>
          <Progress step={step} total={total} />
          {replay ? (
            <button type="button" className="fro-skip" onClick={finishReplay}>Close</button>
          ) : (
            <button type="button" className="fro-skip" onClick={skip}>Skip for now</button>
          )}
        </header>

        <section className="fro-content">
          {step === 0 && (
            <div className="fro-slide fro-hero">
              <span className="fro-kicker">WELCOME, TRAVELER</span>
              <h1>Your life is the quest.</h1>
              <p>
                Quest is a productivity game built around your real life. Plan what matters,
                finish it outside the app, and turn that progress into XP, levels, rewards,
                and a world that grows with you.
              </p>
              <div className="fro-mantra">The goal is not a perfect schedule.<br /><strong>It is to keep moving forward.</strong></div>
            </div>
          )}

          {step === 1 && (
            <div className="fro-slide">
              <span className="fro-kicker">THE WHOLE APP IN 10 SECONDS</span>
              <h2>One loop. Everything else supports it.</h2>
              <LoopDiagram />
            </div>
          )}

          {step === 2 && (
            <div className="fro-slide">
              <span className="fro-kicker">YOUR MAP</span>
              <h2>Quests are journeys. Tasks are actions.</h2>
              <div className="fro-compare">
                <article>
                  <span>🎬</span>
                  <strong>QUEST</strong>
                  <h3>Filmmaking</h3>
                  <p>A meaningful area of life you want to move forward.</p>
                </article>
                <article>
                  <span>✓</span>
                  <strong>TASK</strong>
                  <h3>Edit scene 4</h3>
                  <p>One concrete thing you can actually finish.</p>
                </article>
              </div>
              <div className="fro-anchor-note">
                <span>⚓</span>
                <div><strong>Daily Anchors</strong><p>Repeating habits like Gym, Reading, or French. Tasks move projects forward; Anchors keep you steady.</p></div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="fro-slide">
              <span className="fro-kicker">QUEST LEARNS WITH YOU</span>
              <h2>Plan with reality, not optimism.</h2>
              <div className="fro-timing-demo">
                <div><small>YOU ESTIMATED</small><strong>45 min</strong></div>
                <span aria-hidden="true">→</span>
                <div><small>ACTUAL TIME</small><strong>1h 18m</strong></div>
                <span aria-hidden="true">→</span>
                <div className="is-highlight"><small>NEXT ESTIMATE</small><strong>≈ 1h 10m</strong></div>
              </div>
              <p>
                Start a task when you begin working. Quest learns from your real timing so future plans can become more realistic.
              </p>
              <blockquote>You do not adapt to Quest. <strong>Quest gradually adapts to you.</strong></blockquote>
            </div>
          )}

          {step === 4 && (
            <div className="fro-slide">
              <span className="fro-kicker">YOUR WORLD</span>
              <h2>There is more here — but you do not need it all today.</h2>
              <div className="fro-feature-grid">
                {FEATURE_CARDS.map(([icon, title, text]) => (
                  <article key={title}>
                    <span>{icon}</span>
                    <div><strong>{title}</strong><p>{text}</p></div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="fro-slide fro-start-small">
              <span className="fro-kicker">THE IMPORTANT PART</span>
              <h2>You do not need to use everything.</h2>
              <p>Start with the smallest useful version of Quest:</p>
              <div className="fro-three">
                <div><strong>1</strong><span>Quest</span></div>
                <div><strong>1</strong><span>real task</span></div>
                <div><strong>0–2</strong><span>Anchors later</span></div>
              </div>
              <p className="fro-muted">
                Goals, Stats, Rewards, Friends, Study With Me, competitions and deeper planning can wait until they become useful.
              </p>
            </div>
          )}

          {!replay && step === 6 && (
            <div className="fro-slide">
              <span className="fro-kicker">CREATE YOUR FIRST QUEST</span>
              <h2>What is one area of your life you want to move forward?</h2>
              <div className="fro-preset-grid">
                {QUEST_PRESETS.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    className={presetKey === item.key ? "is-selected" : ""}
                    onClick={() => {
                      setPresetKey(item.key);
                      if (!questName.trim() || QUEST_PRESETS.some((p) => p.label === questName.trim())) {
                        setQuestName(item.label);
                      }
                    }}
                  >
                    <span>{item.emoji}</span>
                    <strong>{item.label}</strong>
                  </button>
                ))}
              </div>
              <label className="fro-field">
                <span>Quest name</span>
                <input
                  value={questName}
                  maxLength={48}
                  placeholder={preset.label}
                  onChange={(event) => setQuestName(event.target.value)}
                  autoFocus
                />
              </label>
              {error && <p className="fro-error" role="alert">{error}</p>}
            </div>
          )}

          {!replay && step === 7 && (
            <div className="fro-slide">
              <span className="fro-kicker">ONE ACTION</span>
              <h2>Every Quest starts with something you can actually do.</h2>
              <div className="fro-task-preview">
                <span>{preset.emoji}</span>
                <div><small>{displayQuestName.toUpperCase()}</small><strong>{taskName.trim() || "Your first task"}</strong></div>
              </div>
              <label className="fro-field">
                <span>Task</span>
                <input
                  value={taskName}
                  maxLength={100}
                  placeholder={presetKey === "university" ? "Study one pharmacology lecture" : "What will you do first?"}
                  onChange={(event) => setTaskName(event.target.value)}
                  autoFocus
                />
              </label>
              <div className="fro-field-row">
                <label className="fro-field">
                  <span>When?</span>
                  <input type="date" value={taskDay} onChange={(event) => setTaskDay(event.target.value)} />
                </label>
                <label className="fro-field">
                  <span>Estimate</span>
                  <select value={taskMinutes} onChange={(event) => setTaskMinutes(event.target.value)}>
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">1 hour</option>
                    <option value="90">1h 30m</option>
                    <option value="120">2 hours</option>
                  </select>
                </label>
              </div>
              {error && <p className="fro-error" role="alert">{error}</p>}
              <p className="fro-muted">You can change the time, effort, schedule and everything else later.</p>
            </div>
          )}
        </section>

        <footer className="fro-footer">
          {step > 0 && <button type="button" className="fro-secondary" onClick={back}>← Back</button>}
          <div className="fro-footer-spacer" />
          {replay && step === maxStep ? (
            <button type="button" className="fro-primary" onClick={finishReplay}>Back to Quest</button>
          ) : !replay && step === 6 ? (
            <button type="button" className="fro-primary" onClick={submitQuest}>Create this Quest →</button>
          ) : !replay && step === 7 ? (
            <button type="button" className="fro-primary" onClick={submitTask}>Add my first task →</button>
          ) : (
            <button type="button" className="fro-primary" onClick={next}>
              {step === 0 ? "Begin my Quest →" : "Continue →"}
            </button>
          )}
        </footer>
      </main>
    </div>
  );
}
