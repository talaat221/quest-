console.log("🔥 NEW QUEST DASHBOARD CODE LOADED 🔥");
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import Login from "./Login";


const pad = (n) => String(n).padStart(2, "0");
const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const nd = new Date(d); nd.setDate(nd.getDate() + n); return nd; };
const startOfWeek = (d) => { const nd = new Date(d); const day = nd.getDay(); const diff = day === 0 ? -6 : 1 - day; nd.setDate(nd.getDate() + diff); nd.setHours(0, 0, 0, 0); return nd; };
const weekDates = (d) => { const mon = startOfWeek(d); return Array.from({ length: 7 }, (_, i) => toISODate(addDays(mon, i))); };
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const isSameMonth = (dateStr, ref) => !!dateStr && dateStr.slice(0, 7) === monthKey(ref);
const clone = (x) => JSON.parse(JSON.stringify(x));

const STAGES = [
  "Still docked in Athens — the fleet hasn't sailed.",
  "Setting sail — Troy's shores fall behind.",
  "Raiding the Cicones at Ismarus.",
  "Lost in the Lotus-Eaters' honeyed daze.",
  "Trapped in the Cyclops' cave, working out a way past him.",
  "Aeolus hands you the winds home — don't look back now.",
  "Outrunning the Laestrygonian giants.",
  "A long detour through Circe's island, then the Underworld.",
  "Past the Sirens' song, through Scylla and Charybdis.",
  "Calypso's island — you can almost see Ithaca.",
  "Ithaca. You're home.",
];

function questStatus(domain, todayDate) {
  const doneThisMonth = domain.tasks.filter((t) => t.done && t.doneAt && isSameMonth(t.doneAt.slice(0, 10), todayDate)).length;
  const target = domain.monthlyTarget || 1;
  const totalAdded = domain.tasks.length;
  let idx;
  if (totalAdded === 0) idx = 0;
  else if (doneThisMonth >= target) idx = STAGES.length - 1;
  else {
    const pct = doneThisMonth / target;
    idx = 1 + Math.floor(pct * (STAGES.length - 2));
    if (idx >= STAGES.length - 1) idx = STAGES.length - 2;
  }
  return { text: STAGES[idx], pct: Math.min(1, doneThisMonth / target), doneThisMonth, target };
}

const DEFAULT_STATE = {
  domains: [
    { id: "vid", name: "Video Editing", emoji: "🎬", color: "#4FA8A0", monthlyTarget: 10, tasks: [
      { id: "t1", name: "Message 5 potential clients", xp: 30, day: null, hour: null, done: false, doneAt: null },
      { id: "t2", name: "Learn one new skill/software", xp: 25, day: null, hour: null, done: false, doneAt: null },
      { id: "t3", name: "Grand Shahin — edit session", xp: 40, day: null, hour: null, done: false, doneAt: null },
      { id: "t4", name: "Short film — scene edit", xp: 40, day: null, hour: null, done: false, doneAt: null },
    ]},
    { id: "brand", name: "Brand", emoji: "🏷️", color: "#C9A24B", monthlyTarget: 4, tasks: [
      { id: "t5", name: "Post or update one piece of content", xp: 25, day: null, hour: null, done: false, doneAt: null },
    ]},
    { id: "uni", name: "Uni — GPA 4", emoji: "🎓", color: "#6FA86F", monthlyTarget: 8, tasks: [
      { id: "t6", name: "Study block toward GPA 4", xp: 40, day: null, hour: null, done: false, doneAt: null },
    ]},
    { id: "read", name: "Reading", emoji: "📚", color: "#E7C878", monthlyTarget: 4, tasks: [
      { id: "t7", name: "Finish this week's book", xp: 30, day: null, hour: null, done: false, doneAt: null },
    ]},
    { id: "fr", name: "French", emoji: "🇫🇷", color: "#C1543B", monthlyTarget: 4, tasks: [] },
  ],
  anchors: [
    { id: "a1", name: "Gym", emoji: "💪", xpPerDay: 15, history: {} },
    { id: "a2", name: "French Anki", emoji: "🇫🇷", xpPerDay: 10, history: {} },
    { id: "a3", name: "Reading 20–30 min", emoji: "📚", xpPerDay: 10, history: {} },
  ],
  rewards: {
    daily: ["30 min guilt-free gaming", "Watch one episode", "Favorite snack run"],
    weekly: ["Night out with friends", "New camera/gear accessory", "A full lazy day off"],
  },
  claimed: { daily: {}, weekly: {} },
  settings: { dayThresholdPct: 70, weekThresholdPct: 70 },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
.qd-root{--bg:#0B1826;--panel:#12253A;--panel-2:#0E1D2C;--line:#22384f;--gold:#C9A24B;--gold-bright:#E7C878;--teal:#4FA8A0;--text:#EAE3D2;--dim:#8FA3B5;--red:#C1543B;--green:#6FA86F;background:radial-gradient(1200px 600px at 50% -10%,#14314a 0%,var(--bg) 55%);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh;padding:32px 20px 80px;box-sizing:border-box;}
.qd-root *{box-sizing:border-box;}
.qd-root h2{font-family:'Cormorant Garamond',serif;}
.qd-hero{max-width:760px;margin:0 auto 8px;text-align:center;}
.qd-hero-title{font-family:'Cormorant Garamond',serif;font-size:clamp(28px,5vw,40px);font-weight:600;letter-spacing:.02em;}
.qd-hero-sub{font-family:'Inter',sans-serif;font-size:14px;color:var(--dim);font-weight:400;display:block;margin-top:4px;}
.qd-hero-hint{font-size:12px;color:var(--dim);margin-top:14px;}
.qd-rings{display:flex;gap:36px;justify-content:center;margin-top:20px;flex-wrap:wrap;}
.ring-wrap{position:relative;width:150px;height:150px;}
.ring-track{stroke:#1c3549;}
.ring-progress{transition:stroke-dashoffset .6s ease;}
.ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}
.ring-value{font-family:'Cormorant Garamond',serif;font-size:30px;font-weight:700;color:var(--gold-bright);}
.ring-sub{font-size:11px;color:var(--dim);margin-top:2px;text-align:center;max-width:110px;}
.qd-section{max-width:760px;margin:44px auto 0;}
.qd-section h2{font-size:22px;font-weight:600;margin:0 0 16px;border-bottom:1px solid var(--line);padding-bottom:8px;}
.qd-dim{color:var(--dim);font-size:13px;}
.qd-clock{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:20px;text-align:center;}
.qd-clock-nav{display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:12px;font-size:14px;}
.qd-clock-nav button{background:none;border:1px solid var(--line);color:var(--text);border-radius:8px;width:28px;height:28px;cursor:pointer;}
.qd-clock-svg{margin:0 auto;display:block;}
.qd-clock-face{stroke:var(--line);stroke-width:1.5;}
.qd-clock-ticklabel{fill:var(--dim);font-size:11px;font-family:'Inter',sans-serif;}
.qd-clock-dot{cursor:pointer;stroke:var(--bg);stroke-width:2;}
.qd-clock-list{margin-top:16px;text-align:left;display:flex;flex-direction:column;gap:6px;}
.qd-clock-item{display:flex;align-items:center;gap:8px;font-size:13px;padding:6px 8px;border-radius:8px;background:var(--panel-2);cursor:pointer;}
.qd-clock-item.done{opacity:.5;text-decoration:line-through;}
.qd-clock-item-name{flex:1;}
.qd-clock-item-time,.qd-clock-item-xp{color:var(--dim);font-size:12px;}
.qd-anchors{display:flex;flex-direction:column;gap:14px;}
.qd-anchor{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;}
.qd-anchor-head{font-size:15px;margin-bottom:10px;display:flex;align-items:center;gap:8px;}
.qd-anchor-week{display:flex;gap:6px;}
.qd-dot{width:32px;height:32px;border-radius:50%;border:1px solid var(--line);background:var(--panel-2);color:var(--dim);font-size:11px;cursor:pointer;}
.qd-dot.on{background:var(--teal);color:#06231f;border-color:var(--teal);font-weight:700;}
.qd-quest{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--accent,var(--gold));border-radius:14px;padding:18px 20px;margin-bottom:16px;}
.qd-quest-head{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;}
.qd-quest-emoji{font-size:26px;}
.qd-quest-titlewrap{flex:1;min-width:160px;}
.qd-quest-title{font-family:'Cormorant Garamond',serif;font-size:19px;font-weight:600;}
.qd-quest-narrative{font-family:'Cormorant Garamond',serif;font-style:italic;color:var(--dim);font-size:15px;margin-top:2px;}
.qd-quest-target{display:flex;flex-direction:column;align-items:center;font-size:11px;color:var(--dim);}
.qd-quest-target input{width:46px;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;text-align:center;padding:3px;}
.qd-bar{height:7px;border-radius:4px;background:#1c3549;overflow:hidden;margin-top:12px;}
.qd-bar-fill{height:100%;background:var(--gold);transition:width .5s ease;}
.qd-quest-count{font-size:12px;color:var(--dim);margin-top:6px;}
.qd-tasklist{margin-top:14px;display:flex;flex-direction:column;gap:6px;}
.qd-task{display:flex;align-items:center;gap:8px;font-size:13.5px;padding:6px 4px;border-bottom:1px solid var(--line);flex-wrap:wrap;}
.qd-task.done .qd-task-name{opacity:.5;text-decoration:line-through;}
.qd-task-name{flex:1;min-width:120px;}
.qd-task-day{color:var(--teal);font-size:11px;}
.qd-task-xp{color:var(--gold-bright);font-size:12px;font-weight:600;}
.qd-task-del{background:none;border:none;color:var(--dim);cursor:pointer;font-size:14px;}
.qd-add-btn{margin-top:10px;background:none;border:1px dashed var(--line);color:var(--dim);border-radius:8px;padding:8px 12px;cursor:pointer;font-size:13px;}
.qd-add-task{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;}
.qd-add-task input,.qd-add-task select{background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:6px 8px;font-size:12px;}
.qd-add-task input[type=text]{flex:1;min-width:140px;}
.qd-add-task button{background:var(--gold);border:none;color:#241905;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;font-weight:600;}
.qd-add-task .qd-cancel{background:none;color:var(--dim);border:1px solid var(--line);}
.qd-machines{display:flex;gap:20px;flex-wrap:wrap;}
.qd-machine{flex:1;min-width:260px;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px 20px;}
.qd-machine-head{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
.qd-machine-icon{font-size:24px;}
.qd-machine-title{font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:600;}
.qd-machine-sub{font-size:11px;color:var(--dim);}
.qd-machine-nums{font-size:11px;color:var(--dim);margin-top:4px;}
.qd-reel{margin:14px 0;background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:16px;text-align:center;font-family:'Cormorant Garamond',serif;font-size:17px;min-height:26px;}
.qd-reel.spinning{color:var(--gold-bright);animation:qdshake .09s infinite;}
@keyframes qdshake{0%{transform:translateY(0);}50%{transform:translateY(-2px);}100%{transform:translateY(0);}}
.qd-spin-btn{width:100%;background:var(--gold);border:none;color:#241905;font-weight:700;padding:10px;border-radius:8px;cursor:pointer;font-size:14px;}
.qd-spin-btn:disabled{background:#26374a;color:var(--dim);cursor:not-allowed;}
.qd-reward-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px;}
.qd-chip{background:var(--panel-2);border:1px solid var(--line);border-radius:20px;padding:4px 10px;font-size:11.5px;display:flex;align-items:center;gap:6px;}
.qd-chip button{background:none;border:none;color:var(--dim);cursor:pointer;}
.qd-add-row{display:flex;gap:6px;margin-top:10px;}
.qd-add-row input{flex:1;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:6px 8px;font-size:12px;}
.qd-add-row button{background:var(--teal);border:none;color:#06231f;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;font-weight:600;}
.qd-threshold-row{display:flex;align-items:center;gap:6px;margin-top:12px;font-size:11px;color:var(--dim);}
.qd-threshold-row input{width:48px;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:3px;text-align:center;}
.qd-loading{color:#EAE3D2;background:#0B1826;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:20px;}
.qd-footer{text-align:center;margin-top:50px;}
@media (max-width:480px){.qd-rings{gap:20px;} .ring-wrap{width:120px;height:120px;} }
`;

function Ring({ pct, size, stroke, color, label, sublabel }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(pct, 1));
  return (
    <div className="ring-wrap">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} className="ring-progress" />
      </svg>
      <div className="ring-center">
        <div className="ring-value">{label}</div>
        <div className="ring-sub">{sublabel}</div>
      </div>
    </div>
  );
}

function ClockDial({ tasks, dateLabel, onPrev, onNext, onToggle }) {
  const size = 260, cx = size / 2, cy = size / 2, R = size / 2 - 34;
  const pos = (hour) => { const angle = (hour / 24) * 2 * Math.PI - Math.PI / 2; return { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) }; };
  const ticks = [0, 3, 6, 9, 12, 15, 18, 21];
  const timed = tasks.filter((t) => t.hour !== null && t.hour !== undefined);
  return (
    <div className="qd-clock">
      <div className="qd-clock-nav">
        <button onClick={onPrev}>‹</button>
        <span>{dateLabel}</span>
        <button onClick={onNext}>›</button>
      </div>
      <svg width={size} height={size} className="qd-clock-svg">
        <circle cx={cx} cy={cy} r={R} className="qd-clock-face" fill="none" />
        {ticks.map((h) => { const p = pos(h); return (
          <text key={h} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className="qd-clock-ticklabel">{h}</text>
        ); })}
        {timed.map((t) => { const p = pos(t.hour); return (
          <circle key={t.id} cx={p.x} cy={p.y} r={7} fill={t.done ? "#6FA86F" : t.domainColor} className="qd-clock-dot" onClick={() => onToggle(t.domainId, t.id)} />
        ); })}
      </svg>
      <div className="qd-clock-list">
        {tasks.length === 0 && <div className="qd-dim">Nothing scheduled — add a task in a quest below and pick this date.</div>}
        {tasks.map((t) => (
          <div key={t.id} className={"qd-clock-item" + (t.done ? " done" : "")} onClick={() => onToggle(t.domainId, t.id)}>
            <span>{t.domainEmoji}</span>
            <span className="qd-clock-item-name">{t.name}</span>
            <span className="qd-clock-item-time">{t.hour !== null && t.hour !== undefined ? String(t.hour).padStart(2, "0") + ":00" : "—"}</span>
            <span className="qd-clock-item-xp">{t.xp} XP</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestCard({ domain, today, onToggleTask, onAddTask, onDeleteTask, onTargetChange }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [xp, setXp] = useState(20);
  const [day, setDay] = useState("");
  const [hour, setHour] = useState("");
  const status = questStatus(domain, today);
  return (
    <div className="qd-quest" style={{ "--accent": domain.color }}>
      <div className="qd-quest-head">
        <span className="qd-quest-emoji">{domain.emoji}</span>
        <div className="qd-quest-titlewrap">
          <div className="qd-quest-title">{domain.name}</div>
          <div className="qd-quest-narrative">{status.text}</div>
        </div>
        <div className="qd-quest-target">
          <input type="number" min="1" value={domain.monthlyTarget} onChange={(e) => onTargetChange(e.target.value)} />
          <span>this month</span>
        </div>
      </div>
      <div className="qd-bar"><div className="qd-bar-fill" style={{ width: status.pct * 100 + "%", background: domain.color }} /></div>
      <div className="qd-quest-count">{status.doneThisMonth} / {status.target} quests done this month</div>
      <div className="qd-tasklist">
        {domain.tasks.map((t) => (
          <div key={t.id} className={"qd-task" + (t.done ? " done" : "")}>
            <input type="checkbox" checked={t.done} onChange={() => onToggleTask(t.id)} />
            <span className="qd-task-name">{t.name}</span>
            {t.day && <span className="qd-task-day">{t.day}{t.hour !== null && t.hour !== undefined ? " · " + String(t.hour).padStart(2, "0") + ":00" : ""}</span>}
            <span className="qd-task-xp">{t.xp} XP</span>
            <button className="qd-task-del" onClick={() => onDeleteTask(t.id)}>×</button>
          </div>
        ))}
      </div>
      {showAdd ? (
        <div className="qd-add-task">
          <input type="text" placeholder="Task name" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="number" placeholder="XP" value={xp} onChange={(e) => setXp(e.target.value)} style={{ width: 60 }} />
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          <select value={hour} onChange={(e) => setHour(e.target.value)}>
            <option value="">No time</option>
            {Array.from({ length: 24 }, (_, h) => (<option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>))}
          </select>
          <button onClick={() => { if (name.trim()) { onAddTask({ name: name.trim(), xp, day, hour }); setName(""); setXp(20); setDay(""); setHour(""); setShowAdd(false); } }}>Add</button>
          <button className="qd-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
        </div>
      ) : (
        <button className="qd-add-btn" onClick={() => setShowAdd(true)}>+ Add task</button>
      )}
    </div>
  );
}

function RewardMachine({ title, icon, items, xpNow, xpMax, thresholdPct, onThresholdChange, claimedValue, onClaim, onAddItem, onRemoveItem, periodLabel }) {
  const [spinning, setSpinning] = useState(false);
  const [display, setDisplay] = useState(claimedValue || "");
  const [newItem, setNewItem] = useState("");
  useEffect(() => { setDisplay(claimedValue || ""); }, [claimedValue]);
  const threshold = Math.round(xpMax * (thresholdPct / 100));
  const unlocked = xpMax > 0 && threshold > 0 && xpNow >= threshold;
  const canSpin = unlocked && !claimedValue && items.length > 0 && !spinning;

  function spin() {
    if (!canSpin) return;
    setSpinning(true);
    let count = 0;
    const iv = setInterval(() => {
      setDisplay(items[Math.floor(Math.random() * items.length)]);
      count++;
      if (count > 16) {
        clearInterval(iv);
        const final = items[Math.floor(Math.random() * items.length)];
        setDisplay(final);
        setSpinning(false);
        onClaim(final);
      }
    }, 90);
  }

  return (
    <div className="qd-machine">
      <div className="qd-machine-head">
        <span className="qd-machine-icon">{icon}</span>
        <div>
          <div className="qd-machine-title">{title}</div>
          <div className="qd-machine-sub">{periodLabel}</div>
        </div>
      </div>
      <div className="qd-bar"><div className="qd-bar-fill" style={{ width: Math.min(100, xpMax ? (xpNow / xpMax) * 100 : 0) + "%" }} /></div>
      <div className="qd-machine-nums">{xpNow} / {threshold} XP to unlock <span className="qd-dim">(max possible: {xpMax})</span></div>
      <div className={"qd-reel" + (spinning ? " spinning" : "")}>{display || "— add rewards below —"}</div>
      <button className="qd-spin-btn" disabled={!canSpin} onClick={spin}>
        {claimedValue ? "Claimed ✓" : unlocked ? "Spin ✦" : "Locked"}
      </button>
      <div className="qd-reward-list">
        {items.map((it, i) => (<span key={i} className="qd-chip">{it} <button onClick={() => onRemoveItem(i)}>×</button></span>))}
      </div>
      <div className="qd-add-row">
        <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add a reward…" />
        <button onClick={() => { if (newItem.trim()) { onAddItem(newItem.trim()); setNewItem(""); } }}>Add</button>
      </div>
      <div className="qd-threshold-row">
        <label>Unlock at</label>
        <input type="number" min="1" max="100" value={thresholdPct} onChange={(e) => onThresholdChange(e.target.value)} />
        <span>% of max possible</span>
      </div>
    </div>
  );
}

export default function QuestDashboard() {
  const [state, setState] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState(null);
  const [viewOffset, setViewOffset] = useState(0);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newDomainName, setNewDomainName] = useState("");
  const [newDomainEmoji, setNewDomainEmoji] = useState("⭐");
  const [newDomainTarget, setNewDomainTarget] = useState(5);

  useEffect(() => {
  if (!loaded || !state || !session?.user?.id) return;

  const timeout = setTimeout(async () => {
    const { error } = await supabase
      .from("quest_data")
      .upsert(
        {
          user_id: session.user.id,
          data: state,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

    if (error) {
      console.error("Failed to save data:", error);
    }
  }, 500);

  return () => clearTimeout(timeout);
}, [state, loaded, session]);

useEffect(() => {
  let mounted = true;

  async function loadSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!mounted) return;

    setSession(session);

    if (session) {
      await loadUserData(session.user.id);
    } else {
      setLoaded(true);
    }
  }

  loadSession();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(async (_event, session) => {
    setSession(session);

    if (session) {
      await loadUserData(session.user.id);
    } else {
      setState(null);
      setLoaded(true);
    }
  });

  return () => {
    mounted = false;
    subscription.unsubscribe();
  };
}, []);
async function loadUserData(userId) {
  try {
    const { data, error } = await supabase
      .from("quest_data")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to load user data:", error);
      setState(DEFAULT_STATE);
    } else if (data) {
      setState(data.data);
    } else {
      setState(DEFAULT_STATE);

      const { error: insertError } = await supabase
        .from("quest_data")
        .insert({
          user_id: userId,
          data: DEFAULT_STATE,
        });

      if (insertError) {
        console.error("Failed to create user data:", insertError);
      }
    }
  } catch (error) {
    console.error(error);
    setState(DEFAULT_STATE);
  }

  setLoaded(true);
}
  if (!session) {
  return <Login onLogin={(newSession) => setSession(newSession)} />;
}

if (!state) {
  return (
    <div className="qd-loading">
      <style>{CSS}</style>
      Charting the voyage…
    </div>
  );
}

  const today = new Date();
  const todayStr = toISODate(today);
  const wDates = weekDates(today);
  const weekKeyStr = wDates[0];
  const viewDate = addDays(today, viewOffset);
  const viewDateStr = toISODate(viewDate);
  const viewDateLabel = viewDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) + (viewOffset === 0 ? " · Today" : "");

  const allTasks = () => state.domains.flatMap((d) => d.tasks.map((t) => ({ ...t, domainId: d.id, domainEmoji: d.emoji, domainColor: d.color, domainName: d.name })));
  const dayAnchorXP = (ds) => state.anchors.reduce((s, a) => s + (a.history[ds] ? a.xpPerDay : 0), 0);
  const dayAnchorMax = () => state.anchors.reduce((s, a) => s + a.xpPerDay, 0);
  const dayTaskXP = (ds) => allTasks().reduce((s, t) => s + (t.done && t.doneAt && t.doneAt.slice(0, 10) === ds ? t.xp : 0), 0);
  const dayTaskMax = (ds) => allTasks().reduce((s, t) => s + (t.day === ds ? t.xp : 0), 0);
  const dayXP = (ds) => dayAnchorXP(ds) + dayTaskXP(ds);
  const dayMax = (ds) => dayAnchorMax() + dayTaskMax(ds);
  const weekXP = () => wDates.reduce((s, d) => s + dayXP(d), 0);
  const weekMax = () => wDates.reduce((s, d) => s + dayMax(d), 0);

  const dToday = dayXP(todayStr), dMaxToday = dayMax(todayStr);
  const wXP = weekXP(), wMax = weekMax();
  const viewTasks = allTasks().filter((t) => t.day === viewDateStr);

  function updateState(mut) { setState((prev) => { const next = clone(prev); mut(next); return next; }); }
  const toggleAnchor = (id, ds) => updateState((n) => { const a = n.anchors.find((x) => x.id === id); if (a.history[ds]) delete a.history[ds]; else a.history[ds] = true; });
  const toggleTask = (domainId, taskId) => updateState((n) => { const t = n.domains.find((d) => d.id === domainId).tasks.find((x) => x.id === taskId); t.done = !t.done; t.doneAt = t.done ? new Date().toISOString() : null; });
  const addTask = (domainId, { name, xp, day, hour }) => updateState((n) => { n.domains.find((d) => d.id === domainId).tasks.push({ id: "t" + Date.now() + Math.random().toString(36).slice(2, 6), name, xp: Number(xp) || 10, day: day || null, hour: hour === "" || hour === null || hour === undefined ? null : Number(hour), done: false, doneAt: null }); });
  const deleteTask = (domainId, taskId) => updateState((n) => { const dom = n.domains.find((d) => d.id === domainId); dom.tasks = dom.tasks.filter((t) => t.id !== taskId); });
  const updateTarget = (domainId, val) => updateState((n) => { n.domains.find((d) => d.id === domainId).monthlyTarget = Math.max(1, Number(val) || 1); });
  const addDomain = () => { if (!newDomainName.trim()) return; updateState((n) => { n.domains.push({ id: "dom" + Date.now(), name: newDomainName.trim(), emoji: newDomainEmoji || "⭐", color: "#4FA8A0", monthlyTarget: Number(newDomainTarget) || 5, tasks: [] }); }); setNewDomainName(""); setNewDomainEmoji("⭐"); setNewDomainTarget(5); setShowAddDomain(false); };
  const addReward = (kind, text) => updateState((n) => { n.rewards[kind].push(text); });
  const removeReward = (kind, idx) => updateState((n) => { n.rewards[kind].splice(idx, 1); });
  const claimReward = (kind, key, reward) => updateState((n) => { n.claimed[kind][key] = reward; });
  const setThresholdPct = (key, val) => updateState((n) => { n.settings[key] = Math.min(100, Math.max(1, Number(val) || 70)); });

  return (
    <div className="qd-root">
      <button
  onClick={async () => {
    await supabase.auth.signOut();
  }}
  style={{
    position: "fixed",
    top: 15,
    right: 15,
    background: "none",
    border: "1px solid #22384f",
    color: "#8FA3B5",
    borderRadius: 8,
    padding: "6px 10px",
    cursor: "pointer",
  }}
>
  Log out
</button>
      <style>{CSS}</style>
      <header className="qd-hero">
        <div className="qd-hero-title">Your Odyssey</div>
        <span className="qd-hero-sub">{today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span>
        <div className="qd-rings">
          <Ring pct={dMaxToday ? dToday / dMaxToday : 0} size={150} stroke={12} color="#C9A24B" label={String(dToday)} sublabel={`/ ${Math.round(dMaxToday * state.settings.dayThresholdPct / 100)} XP today`} />
          <Ring pct={wMax ? wXP / wMax : 0} size={150} stroke={12} color="#4FA8A0" label={String(wXP)} sublabel={`/ ${Math.round(wMax * state.settings.weekThresholdPct / 100)} XP this week`} />
        </div>
        <div className="qd-hero-hint">Tap anchors to check them off. Tag a quest task with a date to pin it to the clock below.</div>
      </header>

      <section className="qd-section">
        <h2>Daily Clock</h2>
        <ClockDial tasks={viewTasks} dateLabel={viewDateLabel} onPrev={() => setViewOffset(viewOffset - 1)} onNext={() => setViewOffset(viewOffset + 1)} onToggle={toggleTask} />
      </section>

      <section className="qd-section">
        <h2>Daily Anchors</h2>
        <div className="qd-anchors">
          {state.anchors.map((a) => (
            <div key={a.id} className="qd-anchor">
              <div className="qd-anchor-head"><span>{a.emoji}</span> {a.name} <span className="qd-dim">· {a.xpPerDay} XP</span></div>
              <div className="qd-anchor-week">
                {wDates.map((d, i) => (
                  <button key={d} className={"qd-dot" + (a.history[d] ? " on" : "")} onClick={() => toggleAnchor(a.id, d)} title={d}>{["M", "T", "W", "T", "F", "S", "S"][i]}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="qd-section">
        <h2>Quest Log</h2>
        {state.domains.map((dom) => (
          <QuestCard key={dom.id} domain={dom} today={today}
            onToggleTask={(tid) => toggleTask(dom.id, tid)}
            onAddTask={(payload) => addTask(dom.id, payload)}
            onDeleteTask={(tid) => deleteTask(dom.id, tid)}
            onTargetChange={(v) => updateTarget(dom.id, v)} />
        ))}
        {showAddDomain ? (
          <div className="qd-add-task">
            <input type="text" placeholder="Quest name" value={newDomainName} onChange={(e) => setNewDomainName(e.target.value)} />
            <input type="text" placeholder="Emoji" value={newDomainEmoji} onChange={(e) => setNewDomainEmoji(e.target.value)} style={{ width: 50 }} />
            <input type="number" placeholder="Monthly target" value={newDomainTarget} onChange={(e) => setNewDomainTarget(e.target.value)} style={{ width: 70 }} />
            <button onClick={addDomain}>Add</button>
            <button className="qd-cancel" onClick={() => setShowAddDomain(false)}>Cancel</button>
          </div>
        ) : (
          <button className="qd-add-btn" onClick={() => setShowAddDomain(true)}>+ New quest</button>
        )}
      </section>

      <section className="qd-section">
        <h2>Rewards</h2>
        <div className="qd-machines">
          <RewardMachine title="Daily Treasure" icon="🪙" items={state.rewards.daily} xpNow={dToday} xpMax={dMaxToday}
            thresholdPct={state.settings.dayThresholdPct} onThresholdChange={(v) => setThresholdPct("dayThresholdPct", v)}
            claimedValue={state.claimed.daily[todayStr]} onClaim={(r) => claimReward("daily", todayStr, r)}
            onAddItem={(t) => addReward("daily", t)} onRemoveItem={(i) => removeReward("daily", i)} periodLabel="Resets tomorrow" />
          <RewardMachine title="Weekly Treasure" icon="🏺" items={state.rewards.weekly} xpNow={wXP} xpMax={wMax}
            thresholdPct={state.settings.weekThresholdPct} onThresholdChange={(v) => setThresholdPct("weekThresholdPct", v)}
            claimedValue={state.claimed.weekly[weekKeyStr]} onClaim={(r) => claimReward("weekly", weekKeyStr, r)}
            onAddItem={(t) => addReward("weekly", t)} onRemoveItem={(i) => removeReward("weekly", i)} periodLabel="Resets Monday" />
        </div>
      </section>

      <div className="qd-footer qd-dim">Your voyage, your rules — edit anything above.</div>
    </div>
  );
}
