console.log("🔥 NEW QUEST DASHBOARD CODE LOADED 🔥");

import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import Login from "./Login";

// ======================================================
// HELPERS
// ======================================================

const pad = (n) => String(n).padStart(2, "0");

const toISODate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const addDays = (d, n) => {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
};

const startOfWeek = (d) => {
  const nd = new Date(d);
  const day = nd.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  nd.setDate(nd.getDate() + diff);
  nd.setHours(0, 0, 0, 0);

  return nd;
};

const weekDates = (d) => {
  const mon = startOfWeek(d);
  return Array.from(
    { length: 7 },
    (_, i) => toISODate(addDays(mon, i))
  );
};

const monthKey = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

const isSameMonth = (dateStr, ref) =>
  !!dateStr && dateStr.slice(0, 7) === monthKey(ref);

const clone = (x) =>
  JSON.parse(JSON.stringify(x));

// ======================================================
// SOUND EFFECTS
// ======================================================

let audioCtx = null;

const getAudioContext = () => {
  if (typeof window === "undefined") return null;

  const AudioContext =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContext) return null;

  if (!audioCtx) {
    audioCtx = new AudioContext();
  }

  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
};

const playTone = (
  frequency,
  duration = 0.08,
  type = "sine",
  volume = 0.06,
  delay = 0
) => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    const start = ctx.currentTime + delay;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      volume,
      start + 0.01
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + duration
    );

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  } catch (error) {
    console.log("SFX unavailable:", error);
  }
};

const playSFX = (type) => {
  switch (type) {
    case "click":
      playTone(420, 0.05, "sine", 0.025);
      break;

    case "complete":
      playTone(523.25, 0.08, "sine", 0.05);
      playTone(659.25, 0.1, "sine", 0.05, 0.07);
      break;

    case "undo":
      playTone(440, 0.08, "sine", 0.035);
      playTone(330, 0.1, "sine", 0.035, 0.07);
      break;

    case "add":
      playTone(523.25, 0.06, "triangle", 0.04);
      playTone(783.99, 0.09, "triangle", 0.04, 0.06);
      break;

    case "delete":
      playTone(330, 0.08, "sawtooth", 0.025);
      playTone(220, 0.12, "sawtooth", 0.025, 0.07);
      break;

    case "spin":
      playTone(300, 0.04, "square", 0.018);
      break;

    case "reward":
      playTone(523.25, 0.1, "sine", 0.05);
      playTone(659.25, 0.1, "sine", 0.05, 0.1);
      playTone(783.99, 0.12, "sine", 0.05, 0.2);
      playTone(1046.5, 0.2, "sine", 0.06, 0.3);
      break;

    default:
      break;
  }
};

// ======================================================
// RESET HELPERS
// ======================================================

const getQuestDate = (date, resetHour = 0) => {
  const d = new Date(date);

  if (d.getHours() < resetHour) {
    d.setDate(d.getDate() - 1);
  }

  return toISODate(d);
};

const getNextDailyReset = (date, resetHour = 0) => {
  const next = new Date(date);

  next.setHours(resetHour, 0, 0, 0);

  if (next <= date) {
    next.setDate(next.getDate() + 1);
  }

  return next;
};

const getNextWeeklyReset = (date, resetHour = 0) => {
  const next = new Date(date);
  const day = next.getDay();

  if (day === 1) {
    const todayReset = new Date(date);
    todayReset.setHours(resetHour, 0, 0, 0);

    if (date < todayReset) {
      return todayReset;
    }
  }

  const daysUntilMonday = day === 0 ? 1 : 8 - day;

  next.setDate(next.getDate() + daysUntilMonday);
  next.setHours(resetHour, 0, 0, 0);

  return next;
};

const formatCountdown = (ms) => {
  if (ms <= 0) return "00:00:00";

  const totalSeconds = Math.floor(ms / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

// ======================================================
// QUEST STAGES
// ======================================================

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
  const doneThisMonth = domain.tasks.filter(
    (t) =>
      t.done &&
      t.doneAt &&
      isSameMonth(t.doneAt.slice(0, 10), todayDate)
  ).length;

  const target = Number(domain.monthlyTarget) || 1;

  let idx = 0;

  if (doneThisMonth >= target) {
    idx = STAGES.length - 1;
  } else if (domain.tasks.length > 0) {
    const pct = doneThisMonth / target;

    idx =
      1 +
      Math.floor(pct * (STAGES.length - 2));

    if (idx >= STAGES.length - 1) {
      idx = STAGES.length - 2;
    }
  }

  return {
    text: STAGES[idx],
    pct: Math.min(1, doneThisMonth / target),
    doneThisMonth,
    target,
  };
}

// ======================================================
// DEFAULT STATE
// ======================================================

const DEFAULT_STATE = {
  domains: [
    {
      id: "vid",
      name: "Video Editing",
      emoji: "🎬",
      color: "#4FA8A0",
      monthlyTarget: 10,
      tasks: [
        {
          id: "t1",
          name: "Message 5 potential clients",
          xp: 30,
          day: null,
          hour: null,
          done: false,
          doneAt: null,
        },
        {
          id: "t2",
          name: "Learn one new skill/software",
          xp: 25,
          day: null,
          hour: null,
          done: false,
          doneAt: null,
        },
        {
          id: "t3",
          name: "Grand Shahin — edit session",
          xp: 40,
          day: null,
          hour: null,
          done: false,
          doneAt: null,
        },
        {
          id: "t4",
          name: "Short film — scene edit",
          xp: 40,
          day: null,
          hour: null,
          done: false,
          doneAt: null,
        },
      ],
    },

    {
      id: "brand",
      name: "Brand",
      emoji: "🏷️",
      color: "#C9A24B",
      monthlyTarget: 4,
      tasks: [
        {
          id: "t5",
          name: "Post or update one piece of content",
          xp: 25,
          day: null,
          hour: null,
          done: false,
          doneAt: null,
        },
      ],
    },

    {
      id: "uni",
      name: "Uni — GPA 4",
      emoji: "🎓",
      color: "#6FA86F",
      monthlyTarget: 8,
      tasks: [
        {
          id: "t6",
          name: "Study block toward GPA 4",
          xp: 40,
          day: null,
          hour: null,
          done: false,
          doneAt: null,
        },
      ],
    },

    {
      id: "read",
      name: "Reading",
      emoji: "📚",
      color: "#E7C878",
      monthlyTarget: 4,
      tasks: [
        {
          id: "t7",
          name: "Finish this week's book",
          xp: 30,
          day: null,
          hour: null,
          done: false,
          doneAt: null,
        },
      ],
    },

    {
      id: "fr",
      name: "French",
      emoji: "🇫🇷",
      color: "#C1543B",
      monthlyTarget: 4,
      tasks: [],
    },
  ],

  anchors: [
    {
      id: "a1",
      name: "Gym",
      emoji: "💪",
      xpPerDay: 15,
      history: {},
    },
    {
      id: "a2",
      name: "French Anki",
      emoji: "🇫🇷",
      xpPerDay: 10,
      history: {},
    },
    {
      id: "a3",
      name: "Reading 20–30 min",
      emoji: "📚",
      xpPerDay: 10,
      history: {},
    },
  ],

  rewards: {
    daily: [
      "30 min guilt-free gaming",
      "Watch one episode",
      "Favorite snack run",
    ],

    weekly: [
      "Night out with friends",
      "New camera/gear accessory",
      "A full lazy day off",
    ],
  },

  claimed: {
    daily: {},
    weekly: {},
  },

  settings: {
    dayThresholdPct: 70,
    weekThresholdPct: 70,
    dayResetHour: 0,
  },
};

// ======================================================
// CSS
// ======================================================

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');

.qd-root{
  --bg:#0B1826;
  --panel:#12253A;
  --panel-2:#0E1D2C;
  --line:#22384f;
  --gold:#C9A24B;
  --gold-bright:#E7C878;
  --teal:#4FA8A0;
  --text:#EAE3D2;
  --dim:#8FA3B5;
  --red:#C1543B;
  --green:#6FA86F;

  background:
    radial-gradient(1200px 600px at 50% -10%,#14314a 0%,var(--bg) 55%);

  color:var(--text);
  font-family:'Inter',sans-serif;
  min-height:100vh;
  padding:32px 20px 80px;
  box-sizing:border-box;
}

.qd-root *{
  box-sizing:border-box;
}

.qd-root h2{
  font-family:'Cormorant Garamond',serif;
}

.qd-hero{
  max-width:760px;
  margin:0 auto 8px;
  text-align:center;
}

.qd-hero-title{
  font-family:'Cormorant Garamond',serif;
  font-size:clamp(28px,5vw,40px);
  font-weight:600;
  letter-spacing:.02em;
}

.qd-hero-sub{
  font-size:14px;
  color:var(--dim);
  display:block;
  margin-top:4px;
}

.qd-hero-hint{
  font-size:12px;
  color:var(--dim);
  margin-top:14px;
}

.qd-rings{
  display:flex;
  gap:36px;
  justify-content:center;
  margin-top:20px;
  flex-wrap:wrap;
}

.ring-wrap{
  position:relative;
  width:150px;
  height:150px;
}

.ring-track{
  stroke:#1c3549;
}

.ring-progress{
  transition:stroke-dashoffset .6s ease;
}

.ring-center{
  position:absolute;
  inset:0;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
}

.ring-value{
  font-family:'Cormorant Garamond',serif;
  font-size:30px;
  font-weight:700;
  color:var(--gold-bright);
}

.ring-sub{
  font-size:11px;
  color:var(--dim);
  margin-top:2px;
  text-align:center;
  max-width:110px;
}

.qd-section{
  max-width:760px;
  margin:44px auto 0;
}

.qd-section h2{
  font-size:22px;
  font-weight:600;
  margin:0 0 16px;
  border-bottom:1px solid var(--line);
  padding-bottom:8px;
}

.qd-dim{
  color:var(--dim);
  font-size:13px;
}

.qd-clock{
  background:var(--panel);
  border:1px solid var(--line);
  border-radius:16px;
  padding:20px;
  text-align:center;
}

.qd-clock-nav{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:16px;
  margin-bottom:12px;
  font-size:14px;
}

.qd-clock-nav button{
  background:none;
  border:1px solid var(--line);
  color:var(--text);
  border-radius:8px;
  width:28px;
  height:28px;
  cursor:pointer;
}

.qd-clock-svg{
  margin:0 auto;
  display:block;
}

.qd-clock-face{
  stroke:var(--line);
  stroke-width:1.5;
}

.qd-clock-ticklabel{
  fill:var(--dim);
  font-size:11px;
  font-family:'Inter',sans-serif;
}

.qd-clock-dot{
  cursor:pointer;
  stroke:var(--bg);
  stroke-width:2;
}

.qd-clock-list{
  margin-top:16px;
  text-align:left;
  display:flex;
  flex-direction:column;
  gap:6px;
}

.qd-clock-item{
  display:flex;
  align-items:center;
  gap:8px;
  font-size:13px;
  padding:6px 8px;
  border-radius:8px;
  background:var(--panel-2);
  cursor:pointer;
}

.qd-clock-item.done{
  opacity:.5;
  text-decoration:line-through;
}

.qd-clock-item-name{
  flex:1;
}

.qd-clock-item-time,
.qd-clock-item-xp{
  color:var(--dim);
  font-size:12px;
}

.qd-anchors{
  display:flex;
  flex-direction:column;
  gap:14px;
}

.qd-anchor{
  background:var(--panel);
  border:1px solid var(--line);
  border-radius:14px;
  padding:14px 16px;
}

.qd-anchor-head{
  display:flex;
  align-items:center;
  gap:8px;
  margin-bottom:10px;
}

.qd-anchor-title{
  flex:1;
  font-size:15px;
}

.qd-anchor-actions{
  display:flex;
  gap:5px;
}

.qd-anchor-actions button,
.qd-quest-actions button{
  background:none;
  border:1px solid var(--line);
  color:var(--dim);
  border-radius:6px;
  padding:4px 7px;
  cursor:pointer;
  font-size:11px;
}

.qd-anchor-actions button:hover,
.qd-quest-actions button:hover{
  color:var(--text);
  border-color:var(--gold);
}

.qd-anchor-edit{
  display:flex;
  flex-wrap:wrap;
  gap:6px;
  margin-bottom:10px;
}

.qd-anchor-edit input{
  background:var(--panel-2);
  border:1px solid var(--line);
  color:var(--text);
  border-radius:6px;
  padding:6px 8px;
  font-size:12px;
}

.qd-anchor-edit input:first-child{
  width:48px;
}

.qd-anchor-edit input:nth-child(2){
  flex:1;
  min-width:130px;
}

.qd-anchor-edit input:nth-child(3){
  width:70px;
}

.qd-anchor-edit button{
  background:var(--gold);
  border:none;
  color:#241905;
  border-radius:6px;
  padding:6px 10px;
  cursor:pointer;
  font-size:12px;
}

.qd-anchor-edit .qd-cancel{
  background:none;
  color:var(--dim);
  border:1px solid var(--line);
}

.qd-anchor-week{
  display:flex;
  gap:6px;
}

.qd-dot{
  width:32px;
  height:32px;
  border-radius:50%;
  border:1px solid var(--line);
  background:var(--panel-2);
  color:var(--dim);
  font-size:11px;
  cursor:pointer;
}

.qd-dot.on{
  background:var(--teal);
  color:#06231f;
  border-color:var(--teal);
  font-weight:700;
}

.qd-quest{
  background:var(--panel);
  border:1px solid var(--line);
  border-left:4px solid var(--accent,var(--gold));
  border-radius:14px;
  padding:18px 20px;
  margin-bottom:16px;
}

.qd-quest-head{
  display:flex;
  align-items:flex-start;
  gap:12px;
  flex-wrap:wrap;
}

.qd-quest-emoji{
  font-size:26px;
}

.qd-quest-titlewrap{
  flex:1;
  min-width:160px;
}

.qd-quest-title{
  font-family:'Cormorant Garamond',serif;
  font-size:19px;
  font-weight:600;
}

.qd-quest-narrative{
  font-family:'Cormorant Garamond',serif;
  font-style:italic;
  color:var(--dim);
  font-size:15px;
  margin-top:2px;
}

.qd-quest-actions{
  display:flex;
  gap:5px;
}

.qd-quest-target{
  display:flex;
  flex-direction:column;
  align-items:center;
  font-size:11px;
  color:var(--dim);
}

.qd-quest-target input{
  width:46px;
  background:var(--panel-2);
  border:1px solid var(--line);
  color:var(--text);
  border-radius:6px;
  text-align:center;
  padding:3px;
}

.qd-bar{
  height:7px;
  border-radius:4px;
  background:#1c3549;
  overflow:hidden;
  margin-top:12px;
}

.qd-bar-fill{
  height:100%;
  background:var(--gold);
  transition:width .5s ease;
}

.qd-quest-count{
  font-size:12px;
  color:var(--dim);
  margin-top:6px;
}

.qd-tasklist{
  margin-top:14px;
  display:flex;
  flex-direction:column;
  gap:6px;
}

.qd-task{
  display:flex;
  align-items:center;
  gap:8px;
  font-size:13.5px;
  padding:6px 4px;
  border-bottom:1px solid var(--line);
  flex-wrap:wrap;
}

.qd-task.done .qd-task-name{
  opacity:.5;
  text-decoration:line-through;
}

.qd-task-name{
  flex:1;
  min-width:120px;
}

.qd-task-day{
  color:var(--teal);
  font-size:11px;
}

.qd-task-xp{
  color:var(--gold-bright);
  font-size:12px;
  font-weight:600;
}

.qd-task-del{
  background:none;
  border:none;
  color:var(--dim);
  cursor:pointer;
  font-size:17px;
  line-height:1;
  padding:4px 7px;
}

.qd-task-del:hover{
  color:var(--red);
}

.qd-add-btn{
  margin-top:10px;
  background:none;
  border:1px dashed var(--line);
  color:var(--dim);
  border-radius:8px;
  padding:8px 12px;
  cursor:pointer;
  font-size:13px;
}

.qd-add-btn:hover{
  color:var(--text);
  border-color:var(--gold);
}

.qd-add-task{
  margin-top:10px;
  display:flex;
  flex-wrap:wrap;
  gap:6px;
}

.qd-add-task input,
.qd-add-task select{
  background:var(--panel-2);
  border:1px solid var(--line);
  color:var(--text);
  border-radius:6px;
  padding:6px 8px;
  font-size:12px;
}

.qd-add-task input[type=text]{
  flex:1;
  min-width:140px;
}

.qd-add-task button{
  background:var(--gold);
  border:none;
  color:#241905;
  border-radius:6px;
  padding:6px 12px;
  font-size:12px;
  cursor:pointer;
  font-weight:600;
}

.qd-add-task .qd-cancel{
  background:none;
  color:var(--dim);
  border:1px solid var(--line);
}

.qd-machines{
  display:flex;
  gap:20px;
  flex-wrap:wrap;
}

.qd-machine{
  flex:1;
  min-width:260px;
  background:var(--panel);
  border:1px solid var(--line);
  border-radius:16px;
  padding:18px 20px;
}

.qd-machine-head{
  display:flex;
  align-items:center;
  gap:10px;
  margin-bottom:12px;
}

.qd-machine-icon{
  font-size:24px;
}

.qd-machine-title{
  font-family:'Cormorant Garamond',serif;
  font-size:17px;
  font-weight:600;
}

.qd-machine-sub{
  font-size:11px;
  color:var(--dim);
}

.qd-machine-nums{
  font-size:11px;
  color:var(--dim);
  margin-top:4px;
}

.qd-reel{
  margin:14px 0;
  background:var(--panel-2);
  border:1px solid var(--line);
  border-radius:10px;
  padding:16px;
  text-align:center;
  font-family:'Cormorant Garamond',serif;
  font-size:17px;
  min-height:26px;
}

.qd-reel.spinning{
  color:var(--gold-bright);
  animation:qdshake .09s infinite;
}

@keyframes qdshake{
  0%{transform:translateY(0)}
  50%{transform:translateY(-2px)}
  100%{transform:translateY(0)}
}

.qd-spin-btn{
  width:100%;
  background:var(--gold);
  border:none;
  color:#241905;
  font-weight:700;
  padding:10px;
  border-radius:8px;
  cursor:pointer;
  font-size:14px;
}

.qd-spin-btn:disabled{
  background:#26374a;
  color:var(--dim);
  cursor:not-allowed;
}

.qd-reward-list{
  display:flex;
  flex-wrap:wrap;
  gap:6px;
  margin-top:14px;
}

.qd-chip{
  background:var(--panel-2);
  border:1px solid var(--line);
  border-radius:20px;
  padding:4px 10px;
  font-size:11.5px;
  display:flex;
  align-items:center;
  gap:6px;
}

.qd-chip button{
  background:none;
  border:none;
  color:var(--dim);
  cursor:pointer;
}

.qd-add-row{
  display:flex;
  gap:6px;
  margin-top:10px;
}

.qd-add-row input{
  flex:1;
  background:var(--panel-2);
  border:1px solid var(--line);
  color:var(--text);
  border-radius:6px;
  padding:6px 8px;
  font-size:12px;
}

.qd-add-row button{
  background:var(--teal);
  border:none;
  color:#06231f;
  border-radius:6px;
  padding:6px 12px;
  font-size:12px;
  cursor:pointer;
  font-weight:600;
}

.qd-threshold-row{
  display:flex;
  align-items:center;
  gap:6px;
  margin-top:12px;
  font-size:11px;
  color:var(--dim);
}

.qd-threshold-row input{
  width:48px;
  background:var(--panel-2);
  border:1px solid var(--line);
  color:var(--text);
  border-radius:6px;
  padding:3px;
  text-align:center;
}

.qd-loading{
  color:#EAE3D2;
  background:#0B1826;
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  font-family:'Cormorant Garamond',serif;
  font-size:20px;
}

.qd-footer{
  text-align:center;
  margin-top:50px;
}

.qd-celebration-backdrop{
  position:fixed;
  inset:0;
  z-index:99999;
  background:rgba(3,9,17,.90);
  backdrop-filter:blur(14px);
  display:flex;
  align-items:center;
  justify-content:center;
  padding:20px;
  animation:qdFadeIn .25s ease;
}

.qd-celebration{
  width:min(650px,94vw);
  text-align:center;
  position:relative;
  padding:45px 25px;
  border:1px solid rgba(201,162,75,.45);
  border-radius:28px;
  background:radial-gradient(circle at center,#19354b 0%,#0e1d2c 55%,#08131f 100%);
  box-shadow:0 0 80px rgba(201,162,75,.18),0 30px 100px rgba(0,0,0,.6);
  animation:qdCelebrationPop .45s cubic-bezier(.17,.89,.32,1.28);
}

.qd-celebration-icon{
  font-size:70px;
  animation:qdTrophyBounce .8s infinite alternate ease-in-out;
}

.qd-celebration-title{
  font-family:'Cormorant Garamond',serif;
  font-size:clamp(36px,8vw,64px);
  font-weight:700;
  color:var(--gold-bright);
  margin-top:8px;
}

.qd-celebration-subtitle{
  color:var(--dim);
  font-size:14px;
  margin-top:4px;
}

.qd-big-reel{
  margin:35px auto 25px;
  min-height:120px;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:20px;
  border-radius:18px;
  border:1px solid var(--gold);
  background:rgba(5,15,25,.8);
  font-family:'Cormorant Garamond',serif;
  font-size:clamp(25px,5vw,42px);
  font-weight:700;
  color:var(--gold-bright);
  box-shadow:0 0 35px rgba(201,162,75,.15);
}

.qd-big-reel.spinning{
  animation:qdBigShake .07s infinite;
}

.qd-celebration-result{
  font-size:13px;
  color:var(--dim);
  margin-top:8px;
}

@keyframes qdFadeIn{
  from{opacity:0}
  to{opacity:1}
}

@keyframes qdCelebrationPop{
  from{transform:scale(.75);opacity:0}
  to{transform:scale(1);opacity:1}
}

@keyframes qdTrophyBounce{
  from{transform:translateY(0) rotate(-4deg)}
  to{transform:translateY(-12px) rotate(4deg)}
}

@keyframes qdBigShake{
  0%{transform:translateX(-3px) rotate(-1deg)}
  50%{transform:translateX(3px) rotate(1deg)}
  100%{transform:translateX(-3px) rotate(-1deg)}
}

.qd-reset-box{
  margin-top:12px;
  padding:9px 12px;
  border-radius:8px;
  background:var(--panel-2);
  color:var(--dim);
  font-size:11px;
  text-align:center;
}

.qd-reset-time{
  color:var(--gold-bright);
  font-weight:600;
  font-variant-numeric:tabular-nums;
}

@media(max-width:480px){
  .qd-rings{gap:20px}
  .ring-wrap{width:120px;height:120px}
}
`;

// ======================================================
// RING
// ======================================================

function Ring({
  pct,
  size,
  stroke,
  color,
  label,
  sublabel,
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(pct, 1));

  return (
    <div className="ring-wrap">
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring-track"
          strokeWidth={stroke}
          fill="none"
        />

        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-progress"
        />
      </svg>

      <div className="ring-center">
        <div className="ring-value">{label}</div>
        <div className="ring-sub">{sublabel}</div>
      </div>
    </div>
  );
}

// ======================================================
// CLOCK
// ======================================================

function ClockDial({
  tasks,
  dateLabel,
  onPrev,
  onNext,
  onToggle,
}) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 34;

  const pos = (hour) => {
    const angle =
      (hour / 24) * 2 * Math.PI - Math.PI / 2;

    return {
      x: cx + R * Math.cos(angle),
      y: cy + R * Math.sin(angle),
    };
  };

  const ticks = [0, 3, 6, 9, 12, 15, 18, 21];

  const timed = tasks.filter(
    (t) => t.hour !== null && t.hour !== undefined
  );

  return (
    <div className="qd-clock">
      <div className="qd-clock-nav">
        <button type="button" onClick={onPrev}>‹</button>
        <span>{dateLabel}</span>
        <button type="button" onClick={onNext}>›</button>
      </div>

      <svg
        width={size}
        height={size}
        className="qd-clock-svg"
      >
        <circle
          cx={cx}
          cy={cy}
          r={R}
          className="qd-clock-face"
          fill="none"
        />

        {ticks.map((h) => {
          const p = pos(h);

          return (
            <text
              key={h}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="qd-clock-ticklabel"
            >
              {h}
            </text>
          );
        })}

        {timed.map((t) => {
          const p = pos(t.hour);

          return (
            <circle
              key={t.id}
              cx={p.x}
              cy={p.y}
              r={7}
              fill={t.done ? "#6FA86F" : t.domainColor}
              className="qd-clock-dot"
              onClick={() => onToggle(t.domainId, t.id)}
            />
          );
        })}
      </svg>

      <div className="qd-clock-list">
        {tasks.length === 0 && (
          <div className="qd-dim">
            Nothing scheduled — add a task in a quest below and
            pick this date.
          </div>
        )}

        {tasks.map((t) => (
          <div
            key={t.id}
            className={
              "qd-clock-item" + (t.done ? " done" : "")
            }
            onClick={() => onToggle(t.domainId, t.id)}
          >
            <span>{t.domainEmoji}</span>

            <span className="qd-clock-item-name">
              {t.name}
            </span>

            <span className="qd-clock-item-time">
              {t.hour !== null && t.hour !== undefined
                ? String(t.hour).padStart(2, "0") + ":00"
                : "—"}
            </span>

            <span className="qd-clock-item-xp">
              {t.xp} XP
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ======================================================
// ANCHOR CARD
// ======================================================

function AnchorCard({
  anchor,
  weekDates,
  onToggle,
  onUpdate,
  onDelete,
}) {
  const [editing, setEditing] = useState(false);

  const [emoji, setEmoji] = useState(anchor.emoji);
  const [name, setName] = useState(anchor.name);
  const [xp, setXp] = useState(anchor.xpPerDay);

  useEffect(() => {
    setEmoji(anchor.emoji);
    setName(anchor.name);
    setXp(anchor.xpPerDay);
  }, [anchor]);

  const save = () => {
    if (!name.trim()) return;

    onUpdate(anchor.id, {
      emoji: emoji || "⭐",
      name: name.trim(),
      xpPerDay: Math.max(1, Number(xp) || 1),
    });

    setEditing(false);
  };

  return (
    <div className="qd-anchor">
      {!editing ? (
        <>
          <div className="qd-anchor-head">
            <span>{anchor.emoji}</span>

            <span className="qd-anchor-title">
              {anchor.name}
            </span>

            <span className="qd-dim">
              · {anchor.xpPerDay} XP
            </span>

            <div className="qd-anchor-actions">
              <button
                type="button"
                onClick={() => {
                  playSFX("click");
                  setEditing(true);
                }}
              >
                Edit
              </button>

              <button
                type="button"
                onClick={() => onDelete(anchor.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="qd-anchor-edit">
          <input
            value={emoji}
            maxLength={4}
            onChange={(e) => setEmoji(e.target.value)}
          />

          <input
            value={name}
            placeholder="Anchor name"
            onChange={(e) => setName(e.target.value)}
          />

          <input
            type="number"
            min="1"
            value={xp}
            onChange={(e) => setXp(e.target.value)}
          />

          <button
            type="button"
            onClick={save}
          >
            Save
          </button>

          <button
            type="button"
            className="qd-cancel"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="qd-anchor-week">
        {weekDates.map((date, i) => (
          <button
            key={date}
            type="button"
            className={
              "qd-dot" +
              (anchor.history?.[date] ? " on" : "")
            }
            onClick={() => onToggle(anchor.id, date)}
            title={date}
          >
            {["M", "T", "W", "T", "F", "S", "S"][i]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ======================================================
// ANCHOR ADD FORM
// ======================================================

function AnchorAddForm({ onAdd, onCancel }) {
  const [emoji, setEmoji] = useState("⭐");
  const [name, setName] = useState("");
  const [xp, setXp] = useState(10);

  const submit = () => {
    if (!name.trim()) return;

    onAdd({
      emoji: emoji || "⭐",
      name: name.trim(),
      xpPerDay: Math.max(1, Number(xp) || 1),
    });

    setEmoji("⭐");
    setName("");
    setXp(10);
  };

  return (
    <div className="qd-anchor-edit">
      <input
        value={emoji}
        maxLength={4}
        onChange={(e) => setEmoji(e.target.value)}
        placeholder="⭐"
      />

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Anchor name"
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />

      <input
        type="number"
        min="1"
        value={xp}
        onChange={(e) => setXp(e.target.value)}
      />

      <button
        type="button"
        onClick={submit}
      >
        Add
      </button>

      <button
        type="button"
        className="qd-cancel"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
}

// ======================================================
// QUEST CARD
// ======================================================

function QuestCard({
  domain,
  today,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onTargetChange,
  onDeleteDomain,
}) {
  const [showAdd, setShowAdd] = useState(false);

  const [name, setName] = useState("");
  const [xp, setXp] = useState(20);
  const [day, setDay] = useState("");
  const [hour, setHour] = useState("");

  const status = questStatus(domain, today);

  const submitTask = () => {
    if (!name.trim()) return;

    onAddTask({
      name: name.trim(),
      xp,
      day,
      hour,
    });

    setName("");
    setXp(20);
    setDay("");
    setHour("");
    setShowAdd(false);
  };

  return (
    <div
      className="qd-quest"
      style={{ "--accent": domain.color }}
    >
      <div className="qd-quest-head">
        <span className="qd-quest-emoji">
          {domain.emoji}
        </span>

        <div className="qd-quest-titlewrap">
          <div className="qd-quest-title">
            {domain.name}
          </div>

          <div className="qd-quest-narrative">
            {status.text}
          </div>
        </div>

        <div className="qd-quest-actions">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `Delete the entire "${domain.name}" quest?`
                )
              ) {
                onDeleteDomain(domain.id);
              }
            }}
          >
            Delete quest
          </button>
        </div>

        <div className="qd-quest-target">
          <input
            type="number"
            min="1"
            value={domain.monthlyTarget}
            onChange={(e) =>
              onTargetChange(e.target.value)
            }
          />

          <span>this month</span>
        </div>
      </div>

      <div className="qd-bar">
        <div
          className="qd-bar-fill"
          style={{
            width: `${status.pct * 100}%`,
            background: domain.color,
          }}
        />
      </div>

      <div className="qd-quest-count">
        {status.doneThisMonth} / {status.target} quests done this month
      </div>

      <div className="qd-tasklist">
        {domain.tasks.map((t) => (
          <div
            key={t.id}
            className={
              "qd-task" + (t.done ? " done" : "")
            }
          >
            <input
              type="checkbox"
              checked={!!t.done}
              onChange={() => onToggleTask(t.id)}
            />

            <span className="qd-task-name">
              {t.name}
            </span>

            {t.day && (
              <span className="qd-task-day">
                {t.day}

                {t.hour !== null &&
                t.hour !== undefined
                  ? " · " +
                    String(t.hour).padStart(2, "0") +
                    ":00"
                  : ""}
              </span>
            )}

            <span className="qd-task-xp">
              {t.xp} XP
            </span>

            <button
              type="button"
              className="qd-task-del"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                if (
                  window.confirm(
                    `Delete "${t.name}"?`
                  )
                ) {
                  onDeleteTask(t.id);
                }
              }}
              title="Delete task"
            >
              ×
            </button>
          </div>
        ))}

        {domain.tasks.length === 0 && (
          <div className="qd-dim">
            No tasks yet.
          </div>
        )}
      </div>

      {showAdd ? (
        <div className="qd-add-task">
          <input
            type="text"
            placeholder="Task name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitTask();
            }}
          />

          <input
            type="number"
            placeholder="XP"
            value={xp}
            min="1"
            onChange={(e) => setXp(e.target.value)}
            style={{ width: 60 }}
          />

          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />

          <select
            value={hour}
            onChange={(e) => setHour(e.target.value)}
          >
            <option value="">No time</option>

            {Array.from(
              { length: 24 },
              (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              )
            )}
          </select>

          <button
            type="button"
            onClick={submitTask}
          >
            Add
          </button>

          <button
            type="button"
            className="qd-cancel"
            onClick={() => setShowAdd(false)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="qd-add-btn"
          onClick={() => {
            playSFX("click");
            setShowAdd(true);
          }}
        >
          + Add task
        </button>
      )}
    </div>
  );
}

// ======================================================
// CELEBRATION MODAL
// ======================================================

function CelebrationModal({
  kind,
  items,
  onComplete,
}) {
  const [display, setDisplay] = useState("");
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!items.length) {
      onComplete(null);
      return;
    }

    playSFX("reward");

    let count = 0;

    const interval = setInterval(() => {
      const random =
        items[
          Math.floor(Math.random() * items.length)
        ];

      setDisplay(random);

      count++;

      if (count >= 22) {
        clearInterval(interval);

        const finalReward =
          items[
            Math.floor(Math.random() * items.length)
          ];

        setDisplay(finalReward);
        setFinished(true);

        playSFX("reward");

        setTimeout(() => {
          onComplete(finalReward);
        }, 1200);
      }
    }, 90);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="qd-celebration-backdrop">
      <div className="qd-celebration">
        <div className="qd-celebration-icon">
          {kind === "daily" ? "🪙" : "🏺"}
        </div>

        <div className="qd-celebration-title">
          {kind === "daily"
            ? "Daily Treasure!"
            : "Weekly Treasure!"}
        </div>

        <div className="qd-celebration-subtitle">
          You reached your {kind} XP goal.
        </div>

        <div
          className={
            "qd-big-reel" +
            (!finished ? " spinning" : "")
          }
        >
          {display || "Spinning…"}
        </div>

        {finished && (
          <div className="qd-celebration-result">
            Reward claimed automatically ✓
          </div>
        )}
      </div>
    </div>
  );
}

// ======================================================
// REWARD MACHINE
// ======================================================

function RewardMachine({
  title,
  icon,
  items,
  xpNow,
  xpMax,
  thresholdPct,
  onThresholdChange,
  claimedValue,
  onClaim,
  onAddItem,
  onRemoveItem,
  periodLabel,
  resetCountdown,
}) {
  const [spinning, setSpinning] = useState(false);
  const [display, setDisplay] = useState(claimedValue || "");
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    setDisplay(claimedValue || "");
  }, [claimedValue]);

  const threshold = Math.round(
    xpMax * (thresholdPct / 100)
  );

  const unlocked =
    xpMax > 0 &&
    threshold > 0 &&
    xpNow >= threshold;

  const canSpin =
    unlocked &&
    !claimedValue &&
    items.length > 0 &&
    !spinning;

  const spin = () => {
    if (!canSpin) return;

    setSpinning(true);
    playSFX("spin");

    let count = 0;

    const iv = setInterval(() => {
      setDisplay(
        items[
          Math.floor(Math.random() * items.length)
        ]
      );

      playSFX("spin");

      count++;

      if (count > 16) {
        clearInterval(iv);

        const final =
          items[
            Math.floor(Math.random() * items.length)
          ];

        setDisplay(final);
        setSpinning(false);

        playSFX("reward");

        onClaim(final);
      }
    }, 90);
  };

  const addItem = () => {
    if (!newItem.trim()) return;

    onAddItem(newItem.trim());
    setNewItem("");
    playSFX("add");
  };

  return (
    <div className="qd-machine">
      <div className="qd-machine-head">
        <span className="qd-machine-icon">
          {icon}
        </span>

        <div>
          <div className="qd-machine-title">
            {title}
          </div>

          <div className="qd-machine-sub">
            {periodLabel}
          </div>
        </div>
      </div>

      <div className="qd-bar">
        <div
          className="qd-bar-fill"
          style={{
            width:
              Math.min(
                100,
                xpMax ? (xpNow / xpMax) * 100 : 0
              ) + "%",
          }}
        />
      </div>

      <div className="qd-machine-nums">
        {xpNow} / {threshold} XP to unlock
        <span className="qd-dim">
          {" "}
          (max possible: {xpMax})
        </span>
      </div>

      <div
        className={
          "qd-reel" +
          (spinning ? " spinning" : "")
        }
      >
        {display || "— add rewards below —"}
      </div>

      <button
        type="button"
        className="qd-spin-btn"
        disabled={!canSpin}
        onClick={spin}
      >
        {claimedValue
          ? "Claimed ✓"
          : unlocked
          ? "Claim reward"
          : "Locked"}
      </button>

      {claimedValue && (
        <div className="qd-reset-box">
          Resets in{" "}
          <span className="qd-reset-time">
            {resetCountdown}
          </span>
        </div>
      )}

      <div className="qd-reward-list">
        {items.map((it, i) => (
          <span
            key={i}
            className="qd-chip"
          >
            {it}

            <button
              type="button"
              onClick={() => {
                onRemoveItem(i);
                playSFX("delete");
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="qd-add-row">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add a reward…"
          onKeyDown={(e) => {
            if (e.key === "Enter") addItem();
          }}
        />

        <button
          type="button"
          onClick={addItem}
        >
          Add
        </button>
      </div>

      <div className="qd-threshold-row">
        <label>Unlock at</label>

        <input
          type="number"
          min="1"
          max="100"
          value={thresholdPct}
          onChange={(e) =>
            onThresholdChange(e.target.value)
          }
        />

        <span>% of max possible</span>
      </div>
    </div>
  );
}

// ======================================================
// MAIN DASHBOARD
// ======================================================

export default function QuestDashboard() {
  const [state, setState] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState(null);

  const [viewOffset, setViewOffset] = useState(0);

  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newDomainName, setNewDomainName] = useState("");
  const [newDomainEmoji, setNewDomainEmoji] = useState("⭐");
  const [newDomainTarget, setNewDomainTarget] = useState(5);

  const [showAddAnchor, setShowAddAnchor] = useState(false);

  const [clockNow, setClockNow] = useState(new Date());

  const [celebrationQueue, setCelebrationQueue] = useState([]);
  const [celebration, setCelebration] = useState(null);

  const rewardDetectionReady = useRef(false);

  // ====================================================
  // CLOCK
  // ====================================================

  useEffect(() => {
    const timer = setInterval(() => {
      setClockNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // ====================================================
  // LOAD SESSION + DATA
  // ====================================================

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(currentSession);

      if (currentSession) {
        await loadUserData(currentSession.user.id);
      } else {
        setLoaded(true);
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;

        setSession(newSession);

        if (newSession) {
          await loadUserData(newSession.user.id);
        } else {
          setState(null);
          setLoaded(true);
        }
      }
    );

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
        console.error(
          "Failed to load user data:",
          error
        );

        setState(clone(DEFAULT_STATE));
      } else if (data) {
        setState(data.data);
      } else {
        const initialState = clone(DEFAULT_STATE);

        setState(initialState);

        const { error: insertError } =
          await supabase
            .from("quest_data")
            .insert({
              user_id: userId,
              data: initialState,
            });

        if (insertError) {
          console.error(
            "Failed to create user data:",
            insertError
          );
        }
      }
    } catch (error) {
      console.error(error);
      setState(clone(DEFAULT_STATE));
    }

    setLoaded(true);
  }

  // ====================================================
  // AUTO SAVE
  // ====================================================

  useEffect(() => {
    if (
      !loaded ||
      !state ||
      !session?.user?.id
    ) {
      return;
    }

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
        console.error(
          "Failed to save data:",
          error
        );
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [state, loaded, session]);

  // ====================================================
  // CALCULATIONS
  // ====================================================

  const today = clockNow;

  const resetHour = Number(
    state?.settings?.dayResetHour ?? 0
  );

  const todayStr = getQuestDate(
    today,
    resetHour
  );

  const questDateObject = new Date(today);

  if (today.getHours() < resetHour) {
    questDateObject.setDate(
      questDateObject.getDate() - 1
    );
  }

  const wDates = weekDates(questDateObject);
  const weekKeyStr = wDates[0];

  const viewDate = addDays(
    today,
    viewOffset
  );

  const viewDateStr = toISODate(viewDate);

  const viewDateLabel =
    viewDate.toLocaleDateString(
      undefined,
      {
        weekday: "long",
        month: "short",
        day: "numeric",
      }
    ) +
    (viewOffset === 0 ? " · Today" : "");

  const allTasks = () =>
    state
      ? state.domains.flatMap((d) =>
          d.tasks.map((t) => ({
            ...t,
            domainId: d.id,
            domainEmoji: d.emoji,
            domainColor: d.color,
            domainName: d.name,
          }))
        )
      : [];

  const dayAnchorXP = (ds) =>
    state
      ? state.anchors.reduce(
          (sum, anchor) =>
            sum +
            (anchor.history?.[ds]
              ? Number(anchor.xpPerDay) || 0
              : 0),
          0
        )
      : 0;

  const dayAnchorMax = () =>
    state
      ? state.anchors.reduce(
          (sum, anchor) =>
            sum + (Number(anchor.xpPerDay) || 0),
          0
        )
      : 0;

  const dayTaskXP = (ds) =>
    allTasks().reduce(
      (sum, task) =>
        sum +
        (
          task.done &&
          task.doneAt &&
          task.doneAt.slice(0, 10) === ds
            ? Number(task.xp) || 0
            : 0
        ),
      0
    );

  const dayTaskMax = (ds) =>
    allTasks().reduce(
      (sum, task) =>
        sum +
        (
          task.day === ds
            ? Number(task.xp) || 0
            : 0
        ),
      0
    );

  const dayXP = (ds) =>
    dayAnchorXP(ds) + dayTaskXP(ds);

  const dayMax = (ds) =>
    dayAnchorMax() + dayTaskMax(ds);

  const weekXP = () =>
    wDates.reduce(
      (sum, d) => sum + dayXP(d),
      0
    );

  const weekMax = () =>
    wDates.reduce(
      (sum, d) => sum + dayMax(d),
      0
    );

  const dToday = dayXP(todayStr);
  const dMaxToday = dayMax(todayStr);
  const wXP = weekXP();
  const wMax = weekMax();

  const nextDailyReset =
    getNextDailyReset(
      today,
      resetHour
    );

  const nextWeeklyReset =
    getNextWeeklyReset(
      today,
      resetHour
    );

  const dailyCountdown =
    formatCountdown(
      nextDailyReset.getTime() -
        today.getTime()
    );

  const weeklyCountdown =
    formatCountdown(
      nextWeeklyReset.getTime() -
        today.getTime()
    );

  // ====================================================
  // REWARD DETECTION
  // ====================================================

  useEffect(() => {
    if (
      !loaded ||
      !state ||
      !session?.user?.id
    ) {
      return;
    }

    const dailyThreshold =
      Math.round(
        dMaxToday *
        (
          Number(
            state.settings?.dayThresholdPct ?? 70
          ) / 100
        )
      );

    const weeklyThreshold =
      Math.round(
        wMax *
        (
          Number(
            state.settings?.weekThresholdPct ?? 70
          ) / 100
        )
      );

    const dailyUnlocked =
      dMaxToday > 0 &&
      dailyThreshold > 0 &&
      dToday >= dailyThreshold;

    const weeklyUnlocked =
      wMax > 0 &&
      weeklyThreshold > 0 &&
      wXP >= weeklyThreshold;

    const dailyClaimed =
      !!state.claimed?.daily?.[todayStr];

    const weeklyClaimed =
      !!state.claimed?.weekly?.[weekKeyStr];

    if (!rewardDetectionReady.current) {
      rewardDetectionReady.current = true;
      return;
    }

    if (
      dailyUnlocked &&
      !dailyClaimed &&
      !celebrationQueue.includes("daily") &&
      celebration !== "daily"
    ) {
      setCelebrationQueue((queue) => [
        ...queue,
        "daily",
      ]);
    }

    if (
      weeklyUnlocked &&
      !weeklyClaimed &&
      !celebrationQueue.includes("weekly") &&
      celebration !== "weekly"
    ) {
      setCelebrationQueue((queue) => [
        ...queue,
        "weekly",
      ]);
    }
  }, [
    loaded,
    state,
    session,
    dToday,
    dMaxToday,
    wXP,
    wMax,
    todayStr,
    weekKeyStr,
    celebration,
    celebrationQueue,
  ]);

  // ====================================================
  // START CELEBRATION
  // ====================================================

  useEffect(() => {
    if (
      !loaded ||
      !state ||
      !session?.user?.id ||
      celebration ||
      celebrationQueue.length === 0
    ) {
      return;
    }

    const next = celebrationQueue[0];

    setCelebration(next);
    setCelebrationQueue((queue) =>
      queue.slice(1)
    );
  }, [
    loaded,
    state,
    session,
    celebration,
    celebrationQueue,
  ]);

  // ====================================================
  // SAFE RETURNS
  // ====================================================

  if (!session) {
    return (
      <Login
        onLogin={(newSession) =>
          setSession(newSession)
        }
      />
    );
  }

  if (!state) {
    return (
      <div className="qd-loading">
        <style>{CSS}</style>
        Charting the voyage…
      </div>
    );
  }

  // ====================================================
  // STATE MUTATION
  // ====================================================

  function updateState(mutator) {
    setState((previous) => {
      const next = clone(previous);
      mutator(next);
      return next;
    });
  }

  // ====================================================
  // ANCHORS
  // ====================================================

  const toggleAnchor = (id, ds) => {
    updateState((next) => {
      const anchor = next.anchors.find(
        (x) => x.id === id
      );

      if (!anchor) return;

      if (!anchor.history) {
        anchor.history = {};
      }

      if (anchor.history[ds]) {
        delete anchor.history[ds];
      } else {
        anchor.history[ds] = true;
      }
    });

    playSFX("click");
  };

  const addAnchor = ({
    name,
    emoji,
    xpPerDay,
  }) => {
    updateState((next) => {
      next.anchors.push({
        id:
          "anchor-" +
          Date.now() +
          "-" +
          Math.random()
            .toString(36)
            .slice(2, 7),

        name,
        emoji: emoji || "⭐",

        xpPerDay:
          Math.max(
            1,
            Number(xpPerDay) || 1
          ),

        history: {},
      });
    });

    playSFX("add");
  };

  const updateAnchor = (
    id,
    changes
  ) => {
    updateState((next) => {
      const anchor = next.anchors.find(
        (x) => x.id === id
      );

      if (!anchor) return;

      anchor.name = changes.name;
      anchor.emoji = changes.emoji || "⭐";
      anchor.xpPerDay =
        Math.max(
          1,
          Number(changes.xpPerDay) || 1
        );
    });

    playSFX("add");
  };

  const deleteAnchor = (id) => {
    const anchor = state.anchors.find(
      (x) => x.id === id
    );

    if (!anchor) return;

    if (
      !window.confirm(
        `Delete the "${anchor.name}" daily anchor?`
      )
    ) {
      return;
    }

    updateState((next) => {
      next.anchors =
        next.anchors.filter(
          (x) => x.id !== id
        );
    });

    playSFX("delete");
  };

  // ====================================================
  // TASKS
  // ====================================================

  const toggleTask = (
    domainId,
    taskId
  ) => {
    const domain = state.domains.find(
      (d) => d.id === domainId
    );

    const task = domain?.tasks.find(
      (x) => x.id === taskId
    );

    if (!task) return;

    const newDone = !task.done;

    updateState((next) => {
      const d = next.domains.find(
        (x) => x.id === domainId
      );

      if (!d) return;

      const t = d.tasks.find(
        (x) => x.id === taskId
      );

      if (!t) return;

      t.done = newDone;
      t.doneAt = newDone
        ? new Date().toISOString()
        : null;
    });

    playSFX(
      newDone
        ? "complete"
        : "undo"
    );
  };

  const addTask = (
    domainId,
    {
      name,
      xp,
      day,
      hour,
    }
  ) => {
    updateState((next) => {
      const domain = next.domains.find(
        (d) => d.id === domainId
      );

      if (!domain) return;

      domain.tasks.push({
        id:
          "task-" +
          Date.now() +
          "-" +
          Math.random()
            .toString(36)
            .slice(2, 7),

        name,

        xp:
          Number(xp) || 10,

        day:
          day || null,

        hour:
          hour === "" ||
          hour === null ||
          hour === undefined
            ? null
            : Number(hour),

        done: false,
        doneAt: null,
      });
    });

    playSFX("add");
  };

  const deleteTask = (
    domainId,
    taskId
  ) => {
    const domain = state.domains.find(
      (d) => d.id === domainId
    );

    if (!domain) return;

    const task = domain.tasks.find(
      (t) => t.id === taskId
    );

    if (!task) return;

    updateState((next) => {
      const d = next.domains.find(
        (x) => x.id === domainId
      );

      if (!d) return;

      d.tasks =
        d.tasks.filter(
          (t) => t.id !== taskId
        );
    });

    playSFX("delete");
  };

  // ====================================================
  // QUEST TARGET
  // ====================================================

  const updateTarget = (
    domainId,
    value
  ) => {
    updateState((next) => {
      const domain = next.domains.find(
        (d) => d.id === domainId
      );

      if (!domain) return;

      domain.monthlyTarget =
        Math.max(
          1,
          Number(value) || 1
        );
    });
  };

  // ====================================================
  // DOMAINS / QUESTS
  // ====================================================

  const addDomain = () => {
    if (!newDomainName.trim()) return;

    updateState((next) => {
      next.domains.push({
        id:
          "domain-" +
          Date.now() +
          "-" +
          Math.random()
            .toString(36)
            .slice(2, 7),

        name:
          newDomainName.trim(),

        emoji:
          newDomainEmoji || "⭐",

        color:
          "#4FA8A0",

        monthlyTarget:
          Math.max(
            1,
            Number(newDomainTarget) || 5
          ),

        tasks: [],
      });
    });

    setNewDomainName("");
    setNewDomainEmoji("⭐");
    setNewDomainTarget(5);
    setShowAddDomain(false);

    playSFX("add");
  };

  const deleteDomain = (domainId) => {
    const domain = state.domains.find(
      (d) => d.id === domainId
    );

    if (!domain) return;

    updateState((next) => {
      next.domains =
        next.domains.filter(
          (d) => d.id !== domainId
        );
    });

    playSFX("delete");
  };

  // ====================================================
  // REWARDS
  // ====================================================

  const addReward = (
    kind,
    text
  ) => {
    updateState((next) => {
      if (!next.rewards[kind]) {
        next.rewards[kind] = [];
      }

      next.rewards[kind].push(text);
    });
  };

  const removeReward = (
    kind,
    index
  ) => {
    updateState((next) => {
      next.rewards[kind].splice(index, 1);
    });
  };

  const claimReward = (
    kind,
    key,
    reward
  ) => {
    updateState((next) => {
      if (!next.claimed[kind]) {
        next.claimed[kind] = {};
      }

      next.claimed[kind][key] = reward;
    });
  };

  const finishCelebration = (
    reward
  ) => {
    if (
      celebration === "daily" &&
      reward
    ) {
      claimReward(
        "daily",
        todayStr,
        reward
      );
    }

    if (
      celebration === "weekly" &&
      reward
    ) {
      claimReward(
        "weekly",
        weekKeyStr,
        reward
      );
    }

    setCelebration(null);
  };

  // ====================================================
  // SETTINGS
  // ====================================================

  const setThresholdPct = (
    key,
    value
  ) => {
    updateState((next) => {
      next.settings[key] =
        Math.min(
          100,
          Math.max(
            1,
            Number(value) || 70
          )
        );
    });
  };

  const setResetHour = (
    value
  ) => {
    updateState((next) => {
      next.settings.dayResetHour =
        Math.min(
          23,
          Math.max(
            0,
            Number(value)
          )
        );
    });
  };

  // ====================================================
  // VIEW TASKS
  // ====================================================

  const viewTasks =
    allTasks().filter(
      (task) =>
        task.day === viewDateStr
    );

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <div className="qd-root">

      {celebration && (
        <CelebrationModal
          kind={celebration}
          items={
            celebration === "daily"
              ? state.rewards.daily
              : state.rewards.weekly
          }
          onComplete={finishCelebration}
        />
      )}

      {/* LOGOUT */}

      <button
        type="button"
        onClick={async () => {
          playSFX("click");
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
          zIndex: 1000,
        }}
      >
        Log out
      </button>

      <style>{CSS}</style>

      {/* HERO */}

      <header className="qd-hero">
        <div className="qd-hero-title">
          Your Odyssey
        </div>

        <span className="qd-hero-sub">
          {today.toLocaleDateString(
            undefined,
            {
              weekday: "long",
              month: "long",
              day: "numeric",
            }
          )}
        </span>

        <div className="qd-rings">
          <Ring
            pct={
              dMaxToday
                ? dToday / dMaxToday
                : 0
            }
            size={150}
            stroke={12}
            color="#C9A24B"
            label={String(dToday)}
            sublabel={
              `/ ${Math.round(
                dMaxToday *
                state.settings.dayThresholdPct /
                100
              )} XP today`
            }
          />

          <Ring
            pct={
              wMax
                ? wXP / wMax
                : 0
            }
            size={150}
            stroke={12}
            color="#4FA8A0"
            label={String(wXP)}
            sublabel={
              `/ ${Math.round(
                wMax *
                state.settings.weekThresholdPct /
                100
              )} XP this week`
            }
          />
        </div>

        <div className="qd-hero-hint">
          Tap anchors to check them off.
          Tag a quest task with a date to
          pin it to the clock below.
        </div>
      </header>

      {/* DAY RESET */}

      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "12px 14px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 13 }}>
            🌙 Day Reset Time
          </div>

          <div className="qd-dim">
            Your daily XP and reward reset at
            this time.
          </div>
        </div>

        <select
          value={resetHour}
          onChange={(e) =>
            setResetHour(e.target.value)
          }
          style={{
            background: "var(--panel-2)",
            border: "1px solid var(--line)",
            color: "var(--text)",
            borderRadius: 6,
            padding: "6px 10px",
          }}
        >
          {Array.from(
            { length: 24 },
            (_, h) => (
              <option
                key={h}
                value={h}
              >
                {h === 0
                  ? "12:00 AM"
                  : h < 12
                  ? `${h}:00 AM`
                  : h === 12
                  ? "12:00 PM"
                  : `${h - 12}:00 PM`}
              </option>
            )
          )}
        </select>
      </div>

      {/* DAILY CLOCK */}

      <section className="qd-section">
        <h2>Daily Clock</h2>

        <ClockDial
          tasks={viewTasks}
          dateLabel={viewDateLabel}
          onPrev={() =>
            setViewOffset(
              viewOffset - 1
            )
          }
          onNext={() =>
            setViewOffset(
              viewOffset + 1
            )
          }
          onToggle={toggleTask}
        />
      </section>

      {/* DAILY ANCHORS */}

      <section className="qd-section">
        <h2>Daily Anchors</h2>

        <div className="qd-anchors">
          {state.anchors.map(
            (anchor) => (
              <AnchorCard
                key={anchor.id}
                anchor={anchor}
                weekDates={wDates}
                onToggle={toggleAnchor}
                onUpdate={updateAnchor}
                onDelete={deleteAnchor}
              />
            )
          )}
        </div>

        {showAddAnchor ? (
          <AnchorAddForm
            onAdd={addAnchor}
            onCancel={() =>
              setShowAddAnchor(false)
            }
          />
        ) : (
          <button
            type="button"
            className="qd-add-btn"
            onClick={() => {
              playSFX("click");
              setShowAddAnchor(true);
            }}
          >
            + New daily anchor
          </button>
        )}
      </section>

      {/* QUEST LOG */}

      <section className="qd-section">
        <h2>Quest Log</h2>

        {state.domains.map(
          (domain) => (
            <QuestCard
              key={domain.id}
              domain={domain}
              today={today}

              onToggleTask={(taskId) =>
                toggleTask(
                  domain.id,
                  taskId
                )
              }

              onAddTask={(payload) =>
                addTask(
                  domain.id,
                  payload
                )
              }

              onDeleteTask={(taskId) =>
                deleteTask(
                  domain.id,
                  taskId
                )
              }

              onTargetChange={(value) =>
                updateTarget(
                  domain.id,
                  value
                )
              }

              onDeleteDomain={
                deleteDomain
              }
            />
          )
        )}

        {showAddDomain ? (
          <div className="qd-add-task">
            <input
              type="text"
              placeholder="Quest name"
              value={newDomainName}
              onChange={(e) =>
                setNewDomainName(
                  e.target.value
                )
              }
            />

            <input
              type="text"
              placeholder="Emoji"
              value={newDomainEmoji}
              onChange={(e) =>
                setNewDomainEmoji(
                  e.target.value
                )
              }
              style={{ width: 50 }}
            />

            <input
              type="number"
              min="1"
              placeholder="Monthly target"
              value={newDomainTarget}
              onChange={(e) =>
                setNewDomainTarget(
                  e.target.value
                )
              }
              style={{ width: 70 }}
            />

            <button
              type="button"
              onClick={addDomain}
            >
              Add
            </button>

            <button
              type="button"
              className="qd-cancel"
              onClick={() =>
                setShowAddDomain(false)
              }
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="qd-add-btn"
            onClick={() => {
              playSFX("click");
              setShowAddDomain(true);
            }}
          >
            + New quest
          </button>
        )}
      </section>

      {/* REWARDS */}

      <section className="qd-section">
        <h2>Rewards</h2>

        <div className="qd-machines">

          <RewardMachine
            title="Daily Treasure"
            icon="🪙"
            items={state.rewards.daily}
            xpNow={dToday}
            xpMax={dMaxToday}
            thresholdPct={
              state.settings.dayThresholdPct
            }
            onThresholdChange={(value) =>
              setThresholdPct(
                "dayThresholdPct",
                value
              )
            }
            claimedValue={
              state.claimed.daily[todayStr]
            }
            onClaim={(reward) =>
              claimReward(
                "daily",
                todayStr,
                reward
              )
            }
            onAddItem={(text) =>
              addReward(
                "daily",
                text
              )
            }
            onRemoveItem={(index) =>
              removeReward(
                "daily",
                index
              )
            }
            periodLabel="Daily reward"
            resetCountdown={dailyCountdown}
          />

          <RewardMachine
            title="Weekly Treasure"
            icon="🏺"
            items={state.rewards.weekly}
            xpNow={wXP}
            xpMax={wMax}
            thresholdPct={
              state.settings.weekThresholdPct
            }
            onThresholdChange={(value) =>
              setThresholdPct(
                "weekThresholdPct",
                value
              )
            }
            claimedValue={
              state.claimed.weekly[weekKeyStr]
            }
            onClaim={(reward) =>
              claimReward(
                "weekly",
                weekKeyStr,
                reward
              )
            }
            onAddItem={(text) =>
              addReward(
                "weekly",
                text
              )
            }
            onRemoveItem={(index) =>
              removeReward(
                "weekly",
                index
              )
            }
            periodLabel="Resets Monday"
            resetCountdown={weeklyCountdown}
          />

        </div>
      </section>

      {/* FOOTER */}

      <div className="qd-footer qd-dim">
        Your voyage, your rules — edit
        anything above.
      </div>
    </div>
  );
}