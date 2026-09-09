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
      hour: null,
      history: {},
    },
    {
      id: "a2",
      name: "French Anki",
      emoji: "🇫🇷",
      xpPerDay: 10,
      hour: null,
      history: {},
    },
    {
      id: "a3",
      name: "Reading 20–30 min",
      emoji: "📚",
      xpPerDay: 10,
      hour: null,
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
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600;700&display=swap');

html,body,#root{margin:0!important;padding:0!important;width:100%!important;max-width:none!important;min-width:0!important;}
body{overflow-x:hidden;-webkit-text-size-adjust:100%;}
#root{text-align:initial!important;}

.qd-root{
  --bg:#07111f;
  --panel:rgba(7,18,33,.82);
  --panel-2:rgba(11,25,44,.74);
  --line:rgba(202,170,110,.28);
  --line-soft:rgba(126,145,178,.22);
  --gold:#cba66a;
  --gold-bright:#efd29a;
  --purple:#8b5cf6;
  --purple-2:#b99cff;
  --blue:#7596d6;
  --text:#f2eadc;
  --dim:#a6b0c7;
  --red:#d66f74;
  --green:#7ec5a0;
  min-height:100vh;
  color:var(--text);
  font-family:'Inter',sans-serif;
  background:
    linear-gradient(180deg, rgba(5,11,24,.34) 0%, rgba(5,11,24,.62) 34%, rgba(5,11,24,.86) 56%, #06101d 100%),
    url('/odyssey-sea.jpg') center top / cover no-repeat,
    #06101d;
  background-attachment:scroll;
  position:relative;
  overflow-x:hidden;
}
.qd-root::before{
  content:"";
  position:fixed;
  inset:0;
  z-index:0;
  pointer-events:none;
  background:
    linear-gradient(180deg,rgba(5,11,24,.16) 0%,rgba(5,11,24,.36) 22%,rgba(5,11,24,.70) 44%,rgba(5,11,24,.92) 70%,#06101d 100%),
    url('/odyssey-sea.jpg') center top / cover no-repeat;
  opacity:.9;
}
.qd-root::after{
  content:"";
  position:fixed;
  inset:0;
  z-index:0;
  pointer-events:none;
  background:
    radial-gradient(800px 500px at 58% 8%,rgba(138,92,246,.13),transparent 68%),
    radial-gradient(700px 600px at 90% 40%,rgba(69,102,172,.10),transparent 70%);
  mix-blend-mode:screen;
}
.qd-root *{box-sizing:border-box}
.qd-root button,.qd-root input,.qd-root select{font:inherit}
.qd-shell{
  position:relative;
  z-index:1;
  min-height:100vh;
  display:grid;
  grid-template-columns:240px minmax(0,1fr);
  max-width:1600px;
  margin:0 auto;
}
.qd-sidebar{
  position:sticky;top:0;height:100vh;padding:28px 20px 22px;
  background:linear-gradient(180deg,rgba(5,14,26,.88),rgba(7,17,30,.82));
  border-right:1px solid var(--line);backdrop-filter:blur(16px);display:flex;flex-direction:column;gap:24px;
}
.qd-brand{display:flex;gap:13px;align-items:center;padding:0 8px 18px;border-bottom:1px solid var(--line)}
.qd-laurel{width:48px;height:48px;border:1px solid var(--gold);border-radius:50%;display:grid;place-items:center;color:var(--gold-bright);font-size:24px;box-shadow:inset 0 0 18px rgba(203,166,106,.10)}
.qd-brand-title{font-family:'Cinzel',serif;letter-spacing:.08em;font-size:20px;color:var(--gold-bright)}
.qd-brand-sub{font-family:'Cormorant Garamond',serif;font-style:italic;color:var(--dim);font-size:13px;margin-top:3px}
.qd-nav{display:flex;flex-direction:column;gap:7px}
.qd-nav a{color:#cfd6e5;text-decoration:none;padding:11px 12px;border-radius:8px;display:flex;align-items:center;gap:11px;border:1px solid transparent;font-family:'Cormorant Garamond',serif;font-size:18px;transition:.2s ease}
.qd-nav a:hover,.qd-nav a.active{background:linear-gradient(90deg,rgba(98,68,177,.28),rgba(52,75,126,.12));border-color:rgba(139,92,246,.32);color:#fff;box-shadow:0 0 24px rgba(139,92,246,.08)}
.qd-nav-icon{width:24px;text-align:center;color:var(--gold)}
.qd-sidebar-quote{margin-top:auto;padding:18px 10px 6px;color:#9fa9bc;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:17px;line-height:1.45;border-top:1px solid var(--line)}
.qd-sidebar-quote span{display:block;color:var(--gold);margin-top:9px;font-style:normal;font-size:13px}
.qd-logout{margin-top:8px;background:transparent;border:1px solid var(--line);color:var(--dim);border-radius:8px;padding:9px 10px;cursor:pointer}
.qd-logout:hover{color:var(--text);border-color:var(--gold)}
.qd-main{min-width:0;padding:24px clamp(18px,2.6vw,38px) 70px}
.qd-topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:18px}
.qd-greeting-kicker{font-family:'Cinzel',serif;font-size:13px;letter-spacing:.16em;color:var(--gold);text-transform:uppercase}
.qd-greeting{font-family:'Cinzel',serif;font-size:clamp(26px,3vw,42px);line-height:1.08;letter-spacing:.04em;margin-top:5px;text-shadow:0 2px 16px rgba(0,0,0,.5)}
.qd-greeting-sub{font-family:'Cormorant Garamond',serif;font-style:italic;color:#d4d6e2;font-size:18px;margin-top:6px}
.qd-topmeta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.qd-meta-pill{background:rgba(9,19,35,.58);backdrop-filter:blur(10px);border:1px solid var(--line);border-radius:999px;padding:8px 12px;color:#d6dcea;font-size:12px}
.qd-meta-pill strong{color:var(--gold-bright);font-family:'Cinzel',serif;font-weight:600}

.qd-dashboard-grid{display:grid;grid-template-columns:minmax(320px,1.02fr) minmax(340px,.98fr);gap:18px;align-items:stretch}
.qd-panel{background:linear-gradient(180deg,rgba(7,18,34,.84),rgba(6,15,29,.90));border:1px solid var(--line);box-shadow:0 18px 50px rgba(0,0,0,.25),inset 0 0 0 1px rgba(255,255,255,.015);position:relative;overflow:hidden;min-width:0}
.qd-panel::before{content:"";position:absolute;inset:5px;border:1px solid rgba(203,166,106,.12);pointer-events:none}
.qd-panel-title{font-family:'Cinzel',serif;letter-spacing:.08em;font-size:18px;color:#f0dfbf}
.qd-panel-sub{font-family:'Cormorant Garamond',serif;font-style:italic;color:var(--dim);font-size:15px;margin-top:2px}
.qd-panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:18px 20px 0;position:relative;z-index:1}

.qd-clock{padding:14px 18px 18px;text-align:center;min-height:100%;background:radial-gradient(circle at 50% 44%,rgba(34,38,81,.48),rgba(6,15,29,.93) 67%)}
.qd-clock-nav{display:flex;align-items:center;justify-content:center;gap:14px;margin:6px 0 2px;color:#d8ddeb;font-size:clamp(12px,1.4vw,15px);flex-wrap:wrap}
.qd-clock-nav button{width:38px;height:38px;border-radius:50%;border:1px solid var(--line);background:rgba(10,20,36,.75);color:var(--gold-bright);cursor:pointer;flex:0 0 auto}
.qd-clock-svg{width:min(100%,440px);height:auto;display:block;margin:0 auto;filter:drop-shadow(0 14px 20px rgba(0,0,0,.28))}
.qd-clock-outer{fill:rgba(7,15,32,.75);stroke:var(--gold);stroke-width:2}
.qd-clock-ring{fill:none;stroke:rgba(203,166,106,.45);stroke-width:1}
.qd-clock-ring-purple{fill:none;stroke:rgba(139,92,246,.65);stroke-width:1.4;filter:drop-shadow(0 0 5px rgba(139,92,246,.6))}
.qd-clock-tick{stroke:rgba(203,166,106,.42);stroke-width:1}
.qd-clock-tick.major{stroke:var(--gold);stroke-width:1.8}
.qd-clock-ticklabel{fill:#d9c7a7;font-size:13px;font-family:'Cinzel',serif}
.qd-clock-hour-small{fill:#74809a;font-size:8px;font-family:'Inter',sans-serif}
.qd-clock-dot{cursor:pointer;stroke:#0a1323;stroke-width:3;filter:drop-shadow(0 0 6px currentColor)}
.qd-clock-hand{stroke:var(--gold-bright);stroke-width:2.2;stroke-linecap:round;filter:drop-shadow(0 0 6px rgba(239,210,154,.45))}
.qd-clock-center{fill:#d2a86c;stroke:#f1d6a3;stroke-width:1.2}
.qd-clock-time{fill:#f6ead7;font-family:'Cormorant Garamond',serif;font-size:34px;font-weight:600}
.qd-clock-date{fill:#9faac0;font-size:11px;font-family:'Inter',sans-serif}
.qd-clock-list{margin-top:12px;text-align:left;display:flex;flex-direction:column;gap:6px;max-height:180px;overflow:auto}
.qd-clock-item{display:flex;align-items:center;gap:8px;font-size:12px;padding:10px 11px;background:rgba(12,24,43,.72);border:1px solid rgba(126,145,178,.13);cursor:pointer}
.qd-clock-item.done{opacity:.48;text-decoration:line-through}.qd-clock-item-name{flex:1}.qd-clock-routine{color:var(--gold);font-size:9px;font-style:italic}.qd-clock-item-time,.qd-clock-item-xp{color:var(--dim);font-size:11px}

.qd-voyage{padding-bottom:16px}
.qd-voyage-stage{font-family:'Cinzel',serif;font-size:12px;color:var(--purple-2);border:1px solid rgba(139,92,246,.35);background:rgba(77,49,139,.18);padding:6px 9px;border-radius:999px}
.qd-voyage-list{padding:14px 20px 18px;display:flex;flex-direction:column;gap:9px}
.qd-voyage-row{display:grid;grid-template-columns:28px minmax(120px,1fr) minmax(100px,1.2fr) 42px;gap:9px;align-items:center;font-size:12px;color:#c4cbda}
.qd-voyage-num{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--line);font-family:'Cinzel',serif;color:var(--gold)}
.qd-voyage-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qd-voyage-bar{height:5px;background:rgba(97,113,144,.18);border:1px solid rgba(126,145,178,.18);overflow:hidden}
.qd-voyage-fill{height:100%;background:linear-gradient(90deg,#6e7fb9,#a06cff);box-shadow:0 0 9px rgba(139,92,246,.45)}
.qd-voyage-pct{text-align:right;color:#8f9bb0;font-size:11px}
.qd-voyage-note{margin:0 20px;padding:12px 14px;border:1px solid rgba(139,92,246,.26);background:linear-gradient(90deg,rgba(75,45,135,.22),rgba(34,51,93,.18));font-family:'Cormorant Garamond',serif;font-style:italic;color:#c7bfd9;text-align:center}

.qd-lower-grid{display:grid;grid-template-columns:minmax(260px,1fr) minmax(260px,1fr) minmax(320px,1.02fr);gap:18px;margin-top:18px;align-items:start}
.qd-today-panel,.qd-anchor-panel,.qd-xp-panel,.qd-reward-stack{min-width:0}
.qd-today-list{padding:12px 18px 18px;display:flex;flex-direction:column;gap:2px}
.qd-today-task{display:grid;grid-template-columns:28px 1fr auto;gap:9px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line-soft);cursor:pointer}
.qd-today-check{width:23px;height:23px;border-radius:50%;border:2px solid #8e86d7;display:grid;place-items:center;color:white;font-size:12px;box-shadow:0 0 10px rgba(139,92,246,.12)}
.qd-today-task.done .qd-today-check{background:#7658d5}.qd-today-task.done .qd-today-name{opacity:.48;text-decoration:line-through}
.qd-today-name{font-family:'Cormorant Garamond',serif;font-size:17px}.qd-today-sub{font-size:10px;color:var(--dim);margin-top:2px}.qd-today-xp{font-size:11px;color:var(--purple-2)}
.qd-empty{color:var(--dim);font-family:'Cormorant Garamond',serif;font-style:italic;padding:14px 0}

.qd-anchors{padding:12px 16px 16px;display:flex;flex-direction:column;gap:8px}.qd-anchor{background:rgba(11,24,43,.70);border:1px solid var(--line-soft);padding:10px 11px;position:relative}.qd-anchor-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}.qd-anchor-head>span:first-child{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--line);font-size:18px;background:rgba(6,15,29,.55)}.qd-anchor-title{flex:1;font-family:'Cinzel',serif;font-size:12px;letter-spacing:.05em}.qd-anchor-actions{display:flex;gap:4px}.qd-anchor-actions button,.qd-quest-actions button{background:none;border:1px solid rgba(126,145,178,.22);color:var(--dim);padding:4px 6px;cursor:pointer;font-size:10px}.qd-anchor-actions button:hover,.qd-quest-actions button:hover{border-color:var(--gold);color:var(--text)}.qd-anchor-week{display:flex;gap:5px;justify-content:flex-end;flex-wrap:wrap}.qd-dot{width:25px;height:25px;border-radius:50%;border:1px solid rgba(126,145,178,.28);background:rgba(7,15,29,.75);color:#7f8aa2;font-size:9px;cursor:pointer}.qd-dot.on{background:#7556d5;color:#fff;border-color:#b29cff;box-shadow:0 0 10px rgba(139,92,246,.45)}
.qd-anchor-edit,.qd-add-task{display:flex;gap:6px;flex-wrap:wrap;padding:8px 0}.qd-anchor-edit input,.qd-anchor-edit select,.qd-add-task input,.qd-add-task select,.qd-add-row input,.qd-threshold-row input,.qd-reset-card select{background:#0a1729;border:1px solid var(--line);color:var(--text);padding:7px 8px;border-radius:4px}.qd-anchor-edit input:nth-child(2),.qd-add-task input[type=text]{flex:1;min-width:130px}.qd-anchor-edit select{min-width:118px}.qd-anchor-edit button,.qd-add-task button,.qd-add-row button{background:linear-gradient(180deg,#ad8b52,#826735);border:1px solid #d7b877;color:#0b1322;padding:7px 11px;border-radius:4px;cursor:pointer;font-weight:700}.qd-cancel{background:transparent!important;color:var(--dim)!important;border-color:var(--line)!important}.qd-add-btn{margin:10px 16px 16px;background:transparent;border:1px dashed rgba(203,166,106,.34);color:#b9c2d4;padding:8px 11px;cursor:pointer;width:calc(100% - 32px)}.qd-add-btn:hover{border-color:var(--gold);color:#fff}

.qd-side-stack{display:flex;flex-direction:column;gap:18px;min-width:0}.qd-xp-card{padding:16px 18px}.qd-xp-top{display:flex;justify-content:space-between;gap:12px;align-items:center}.qd-xp-number{font-family:'Cinzel',serif;color:var(--gold-bright);font-size:20px}.qd-xp-bar{height:9px;background:rgba(82,99,128,.22);border:1px solid rgba(126,145,178,.24);margin-top:12px;overflow:hidden}.qd-xp-fill{height:100%;background:linear-gradient(90deg,#7556d5,#ad79ff);box-shadow:0 0 15px rgba(139,92,246,.55)}.qd-xp-caption{display:flex;justify-content:space-between;color:var(--dim);font-size:10px;margin-top:6px;gap:10px;flex-wrap:wrap}.qd-reset-mini{font-size:10px;color:#919db3;margin-top:10px}.qd-reset-mini strong{color:var(--gold-bright)}
.qd-machines{display:flex;flex-direction:column;gap:10px;padding:12px 16px 16px}.qd-machine{background:rgba(10,23,41,.72);border:1px solid var(--line-soft);padding:12px;min-width:0}.qd-machine-head{display:flex;gap:9px;align-items:center}.qd-machine-icon{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--line);font-size:18px}.qd-machine-title{font-family:'Cinzel',serif;font-size:12px;letter-spacing:.04em}.qd-machine-sub,.qd-machine-nums{font-size:10px;color:var(--dim);margin-top:2px}.qd-bar{height:6px;background:rgba(82,99,128,.20);border:1px solid rgba(126,145,178,.18);overflow:hidden;margin-top:10px}.qd-bar-fill{height:100%;background:linear-gradient(90deg,#6e7fb9,#a06cff)!important}.qd-reel{margin:10px 0;background:rgba(71,44,128,.16);border:1px solid rgba(139,92,246,.25);padding:10px;text-align:center;font-family:'Cormorant Garamond',serif;color:#e5daf7}.qd-reel.spinning{animation:qdshake .09s infinite}.qd-spin-btn{width:100%;background:linear-gradient(180deg,#7e5bd8,#5b3eaa);border:1px solid #a88cf1;color:#fff;padding:8px;cursor:pointer}.qd-spin-btn:disabled{opacity:.35;cursor:not-allowed}.qd-reward-list{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}.qd-chip{font-size:9px;border:1px solid var(--line-soft);background:#0a1729;padding:4px 6px;display:flex;gap:5px;align-items:center;max-width:100%}.qd-chip button{background:none;border:none;color:var(--dim);cursor:pointer}.qd-add-row{display:flex;gap:5px;margin-top:8px;min-width:0}.qd-add-row input{min-width:0;flex:1}.qd-threshold-row{display:flex;gap:5px;align-items:center;font-size:9px;color:var(--dim);margin-top:8px;flex-wrap:wrap}.qd-threshold-row input{width:48px;padding:4px}.qd-reset-box{font-size:9px;color:var(--dim);margin-top:8px}.qd-reset-time{color:var(--gold-bright)}

.qd-section{margin-top:22px}.qd-section-heading{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:10px}.qd-section h2{font-family:'Cinzel',serif;font-size:20px;letter-spacing:.08em;color:#efdfc3;margin:0}.qd-section-tag{font-family:'Cormorant Garamond',serif;font-style:italic;color:var(--dim)}.qd-quest-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.qd-quest{background:linear-gradient(180deg,rgba(8,19,35,.90),rgba(7,16,30,.94));border:1px solid var(--line);padding:16px;position:relative;overflow:hidden}.qd-quest::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--accent,var(--purple));box-shadow:0 0 14px var(--accent,var(--purple))}.qd-quest-head{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap}.qd-quest-emoji{font-size:23px}.qd-quest-titlewrap{flex:1;min-width:150px}.qd-quest-title{font-family:'Cinzel',serif;font-size:14px;color:#f0e1c9;letter-spacing:.04em}.qd-quest-narrative{font-family:'Cormorant Garamond',serif;font-style:italic;color:var(--dim);font-size:14px;margin-top:3px}.qd-quest-target{font-size:9px;color:var(--dim);display:flex;flex-direction:column;align-items:center}.qd-quest-target input{width:45px;background:#0a1729;border:1px solid var(--line);color:var(--text);text-align:center}.qd-quest-count{font-size:10px;color:var(--dim);margin-top:5px}.qd-tasklist{margin-top:10px;display:flex;flex-direction:column}.qd-task{display:flex;align-items:center;gap:7px;padding:7px 0;border-bottom:1px solid var(--line-soft);font-size:11px;flex-wrap:wrap}.qd-task.done .qd-task-name{opacity:.45;text-decoration:line-through}.qd-task-name{flex:1;min-width:120px}.qd-task-day{font-size:9px;color:#8fb0df}.qd-task-xp{font-size:10px;color:var(--purple-2)}.qd-task-del{background:none;border:none;color:#758197;font-size:16px;cursor:pointer}.qd-task-del:hover{color:var(--red)}

.qd-reset-card{margin-top:18px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.qd-reset-title{font-family:'Cinzel',serif;font-size:12px;color:#ead9bc}.qd-dim{color:var(--dim);font-size:11px}.qd-footer{text-align:center;margin-top:32px;font-family:'Cinzel',serif;letter-spacing:.16em;font-size:10px;color:#8f99ae}.qd-footer::before,.qd-footer::after{content:' ~~~ ';color:#8f77d4}
.qd-loading{min-height:100vh;display:grid;place-items:center;background:#06101d;color:#e9dfcd;font-family:'Cinzel',serif;letter-spacing:.08em}
.qd-celebration-backdrop{position:fixed;inset:0;z-index:99999;background:rgba(3,7,16,.88);backdrop-filter:blur(14px);display:grid;place-items:center;padding:20px}.qd-celebration{width:min(650px,94vw);text-align:center;padding:42px 24px;border:1px solid var(--gold);background:radial-gradient(circle,#28204c 0%,#0a1729 55%,#06101d 100%);box-shadow:0 0 90px rgba(139,92,246,.28)}.qd-celebration-icon{font-size:64px}.qd-celebration-title{font-family:'Cinzel',serif;font-size:clamp(32px,7vw,58px);color:var(--gold-bright)}.qd-celebration-subtitle{color:var(--dim)}.qd-big-reel{margin:28px auto 20px;border:1px solid rgba(139,92,246,.5);background:#091426;padding:20px;color:#d9c8ff;font-family:'Cormorant Garamond',serif;font-size:clamp(24px,5vw,38px)}.qd-big-reel.spinning{animation:qdshake .07s infinite}.qd-celebration-result{font-size:11px;color:var(--dim)}
@keyframes qdshake{0%{transform:translateY(0)}50%{transform:translateY(-2px)}100%{transform:translateY(0)}}

@media (max-width: 1360px){
  .qd-lower-grid{grid-template-columns:1fr 1fr}
  .qd-side-stack{grid-column:1 / -1;display:grid;grid-template-columns:1fr 1fr;align-items:start}
}
@media (max-width: 1160px){
  .qd-dashboard-grid{grid-template-columns:1fr}
  .qd-quest-grid{grid-template-columns:1fr}
}
@media (max-width: 900px){
  .qd-root{width:100%;min-width:0}
  .qd-shell{grid-template-columns:1fr;width:100%;max-width:none}
  .qd-sidebar{position:relative;height:auto;padding:14px 14px 10px;gap:12px}
  .qd-brand{padding-bottom:10px;padding-right:86px}
  .qd-nav{flex-direction:row;overflow-x:auto;overflow-y:hidden;padding-bottom:2px;-webkit-overflow-scrolling:touch}
  .qd-nav a{font-size:14px;white-space:nowrap;padding:8px 10px;flex:0 0 auto}
  .qd-sidebar-quote{display:none}
  .qd-logout{position:absolute;right:14px;top:14px;width:auto;margin:0}
  .qd-main{padding:18px 14px 50px;width:100%;min-width:0}
  .qd-topbar{padding-top:4px}
  .qd-topmeta{display:none}
  .qd-dashboard-grid,.qd-lower-grid{grid-template-columns:1fr}
  .qd-side-stack{grid-column:auto;display:flex}
  .qd-root::before{position:absolute;background-position:center top}
}
@media (max-width: 640px){
  .qd-root{background-position:center top}
  .qd-sidebar{padding:11px 12px 8px;gap:8px}
  .qd-brand{padding:0 78px 8px 0;border-bottom:0}
  .qd-brand-sub{display:none}
  .qd-brand-title{font-size:17px;letter-spacing:.06em}
  .qd-laurel{width:36px;height:36px;font-size:18px;flex:0 0 auto}
  .qd-nav{display:none}
  .qd-logout{top:12px;right:12px;padding:7px 9px;font-size:11px}
  .qd-main{padding:12px 10px 44px}
  .qd-topbar{display:block;margin-bottom:12px}
  .qd-greeting-kicker{font-size:10px;letter-spacing:.12em}
  .qd-greeting{font-size:24px;margin-top:3px}
  .qd-greeting-sub{font-size:15px;margin-top:3px}
  .qd-dashboard-grid,.qd-lower-grid,.qd-quest-grid{display:block}
  .qd-dashboard-grid>.qd-panel,.qd-lower-grid>.qd-panel,.qd-lower-grid>.qd-side-stack,.qd-quest-grid>.qd-quest{margin-bottom:12px}
  .qd-side-stack{display:block}
  .qd-side-stack>.qd-panel{margin-bottom:12px}
  .qd-panel{width:100%;max-width:100%;min-width:0;overflow:hidden}
  .qd-panel-head{padding:14px 14px 0;gap:8px;flex-wrap:wrap}
  .qd-panel-title{font-size:16px}
  .qd-panel-sub{font-size:14px}
  .qd-clock{padding:10px 6px 14px}
  .qd-clock-nav{display:grid;grid-template-columns:34px minmax(0,1fr) 34px;gap:8px;width:100%;margin:4px 0 4px;font-size:12px}
  .qd-clock-nav span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;min-width:0}
  .qd-clock-nav button{width:34px;height:34px}
  .qd-clock-svg{width:286px!important;max-width:calc(100vw - 44px)!important;height:auto!important}
  .qd-clock-list{max-height:none;margin-top:8px}
  .qd-clock-item{font-size:11px;padding:9px 8px;gap:6px}
  .qd-clock-item-time,.qd-clock-item-xp{font-size:10px}
  .qd-voyage-list{padding:12px 13px 14px;gap:8px}
  .qd-voyage-row{grid-template-columns:24px minmax(0,1fr) 38px;gap:8px;font-size:11px}
  .qd-voyage-bar{display:none}
  .qd-voyage-name{white-space:normal;overflow:visible;text-overflow:clip;line-height:1.25}
  .qd-voyage-pct{font-size:10px}
  .qd-voyage-num{width:22px;height:22px}
  .qd-voyage-note{margin:0 13px;padding:10px 11px;font-size:14px}
  .qd-voyage-stage{font-size:10px;padding:5px 7px}
  .qd-today-list{padding:10px 14px 14px}
  .qd-today-task{grid-template-columns:24px minmax(0,1fr) auto;gap:7px}
  .qd-today-check{width:22px;height:22px}
  .qd-today-name{font-size:16px}
  .qd-anchors{padding:10px 12px 12px}
  .qd-anchor{padding:10px}
  .qd-anchor-head{flex-wrap:wrap;align-items:center}
  .qd-anchor-title{min-width:120px}
  .qd-anchor-actions{width:100%;justify-content:flex-end}
  .qd-anchor-actions button{padding:5px 8px}
  .qd-anchor-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;width:100%;justify-content:stretch}
  .qd-dot{width:100%;max-width:34px;aspect-ratio:1/1;height:auto;justify-self:center}
  .qd-xp-card{padding:14px}
  .qd-xp-caption{font-size:9px}
  .qd-machines{padding:10px 12px 12px}
  .qd-machine{padding:11px}
  .qd-add-row{flex-direction:column}
  .qd-add-row button{width:100%}
  .qd-chip{overflow-wrap:anywhere}
  .qd-section{margin-top:16px}
  .qd-section-heading{display:block}
  .qd-section h2{font-size:18px}
  .qd-quest{padding:14px}
  .qd-quest-head{gap:8px}
  .qd-quest-titlewrap{min-width:0;flex:1 1 150px}
  .qd-quest-actions{width:100%;justify-content:flex-end}
  .qd-task{gap:6px}
  .qd-task-name{min-width:105px}
  .qd-add-task{flex-direction:column}
  .qd-add-task input,.qd-add-task select,.qd-add-task button,.qd-anchor-edit select{width:100%!important;min-width:0!important}
  .qd-add-btn{margin:10px 12px 12px;width:calc(100% - 24px)}
  .qd-reset-card{padding:12px;align-items:stretch}
  .qd-reset-card select{width:100%}
  .qd-footer{font-size:9px;letter-spacing:.10em}
}
@media (max-width: 390px){
  .qd-main{padding-left:8px;padding-right:8px}
  .qd-clock-svg{width:270px!important;max-width:calc(100vw - 36px)!important}
  .qd-greeting{font-size:22px}
  .qd-panel-title{font-size:15px}
  .qd-voyage-row{grid-template-columns:22px minmax(0,1fr) 34px}
  .qd-clock-time{font-size:28px}
}



/* TASK EDITING + WEEKLY XP */
.qd-task-edit-btn{background:transparent;border:1px solid rgba(126,145,178,.24);color:var(--dim);padding:4px 7px;font-size:10px;cursor:pointer}
.qd-task-edit-btn:hover{border-color:var(--gold);color:var(--text)}
.qd-task-unscheduled{font-size:9px;color:#a391c6;border:1px solid rgba(139,92,246,.22);padding:2px 5px;border-radius:999px}
.qd-task-edit-row{display:grid;grid-template-columns:minmax(0,1fr) 78px;gap:8px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line-soft);width:100%;min-width:0}
.qd-task-edit-row>input[type=text]{grid-column:1/2}.qd-task-edit-row>input[type=number]{grid-column:2/3}.qd-task-edit-row input,.qd-task-edit-row select{min-width:0;width:100%;background:#0a1729;border:1px solid var(--line);color:var(--text);padding:8px 9px;border-radius:4px}
.qd-task-date-edit{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px;align-items:center;min-width:0}.qd-task-date-edit input{min-width:0}.qd-task-edit-row>select{grid-column:1/2}.qd-task-edit-actions{grid-column:2/3;display:flex;gap:6px;justify-content:flex-end;min-width:max-content}
.qd-task-edit-actions button,.qd-today-btn,.qd-clear-date-btn{background:transparent;border:1px solid var(--line);color:var(--text);padding:8px 10px;border-radius:4px;cursor:pointer;white-space:nowrap}
.qd-today-btn{border-color:rgba(139,92,246,.46);color:#d9c8ff}.qd-clear-date-btn{color:var(--dim)}
.qd-task-edit-actions button:first-child{background:linear-gradient(180deg,#ad8b52,#826735);border-color:#d7b877;color:#0b1322;font-weight:700}
.qd-xp-progress-block{margin-top:14px}.qd-weekly-xp-block{padding-top:14px;border-top:1px solid var(--line-soft)}
.qd-xp-row-label{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:11px;color:var(--dim)}
.qd-xp-row-label span{font-family:'Cinzel',serif;color:#e5d6bb;letter-spacing:.05em}.qd-xp-row-label strong{color:var(--purple-2);font-weight:600}
.qd-weekly-xp-bar .qd-xp-fill{background:linear-gradient(90deg,#657fc4,#a96fff)!important}
@media(max-width:900px){.qd-task-edit-row{grid-template-columns:minmax(0,1fr) 74px}.qd-task-edit-actions{grid-column:1/-1;justify-content:flex-end}.qd-task-edit-row>select{grid-column:1/-1}}
@media(max-width:520px){.qd-task-edit-row{display:flex;flex-direction:column;align-items:stretch}.qd-task-date-edit{display:grid;grid-template-columns:1fr auto auto}.qd-task-edit-actions{width:100%;justify-content:stretch}.qd-task-edit-actions button{flex:1}.qd-task-edit-btn{padding:5px 7px}.qd-xp-caption{font-size:9px}}
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
  now,
}) {
  const size = 430;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 194;
  const taskR = 146;

  const pos = (hour, radius = taskR) => {
    const angle = (hour / 24) * 2 * Math.PI - Math.PI / 2;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  };

  const timed = tasks.filter(
    (t) => t.hour !== null && t.hour !== undefined
  );

  // If several items share the same hour, fan them around that hour
  // instead of drawing every marker on top of the first one.
  const positionedTimed = timed.map((item) => {
    const sameHour = timed.filter(
      (other) => Number(other.hour) === Number(item.hour)
    );
    const index = sameHour.findIndex(
      (other) => other.clockKey === item.clockKey
    );
    const count = sameHour.length;
    const angularStep = count > 1 ? Math.min(0.28, 0.72 / count) : 0;
    const hourOffset = (index - (count - 1) / 2) * angularStep;
    const radiusOffset = count > 3 && index % 2 ? -15 : 0;

    return {
      ...item,
      markerPos: pos(Number(item.hour) + hourOffset, taskR + radiusOffset),
    };
  });

  const current = now || new Date();
  const exactHour = current.getHours() + current.getMinutes() / 60;
  const hand = pos(exactHour, 104);
  const roman = ["XII", "III", "VI", "IX"];
  const romanHours = [0, 6, 12, 18];

  return (
    <div className="qd-clock">
      <div className="qd-clock-nav">
        <button type="button" onClick={onPrev}>‹</button>
        <span>{dateLabel}</span>
        <button type="button" onClick={onNext}>›</button>
      </div>

      <svg viewBox={`0 0 ${size} ${size}`} className="qd-clock-svg" aria-label="Ancient Greek astrolabe clock">
        <defs>
          <radialGradient id="qdClockGlow" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#1b2149" />
            <stop offset="65%" stopColor="#0a1529" />
            <stop offset="100%" stopColor="#07111f" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={outerR} fill="url(#qdClockGlow)" className="qd-clock-outer" />
        <circle cx={cx} cy={cy} r={174} className="qd-clock-ring" />
        <circle cx={cx} cy={cy} r={150} className="qd-clock-ring-purple" />
        <circle cx={cx} cy={cy} r={115} className="qd-clock-ring" />
        <circle cx={cx} cy={cy} r={70} className="qd-clock-ring" />

        {Array.from({ length: 24 }, (_, h) => {
          const p1 = pos(h, h % 3 === 0 ? 164 : 168);
          const p2 = pos(h, 178);
          const label = pos(h, 187);
          return (
            <g key={h}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className={`qd-clock-tick${h % 3 === 0 ? " major" : ""}`} />
              <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" className="qd-clock-hour-small">{h}</text>
            </g>
          );
        })}

        {romanHours.map((h, i) => {
          const p = pos(h, 128);
          return <text key={h} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className="qd-clock-ticklabel">{roman[i]}</text>;
        })}

        {positionedTimed.map((item) => {
          const p = item.markerPos;
          const isAnchor = item.sourceType === "anchor";
          return (
            <g
              key={item.clockKey}
              onClick={() => onToggle(item)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={isAnchor ? 9 : 10}
                fill={item.done ? "#7ec5a0" : isAnchor ? "#cba66a" : "#8b5cf6"}
                className="qd-clock-dot"
              />
              <text
                x={p.x}
                y={p.y - 16}
                textAnchor="middle"
                fill="#eee7f5"
                fontSize="10"
              >
                {item.domainEmoji}
              </text>
            </g>
          );
        })}

        <line x1={cx} y1={cy} x2={hand.x} y2={hand.y} className="qd-clock-hand" />
        <circle cx={cx} cy={cy} r={11} className="qd-clock-center" />
        <text x={cx} y={cy + 48} textAnchor="middle" className="qd-clock-time">
          {current.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </text>
        <text x={cx} y={cy + 67} textAnchor="middle" className="qd-clock-date">
          {current.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
        </text>
      </svg>

      <div className="qd-clock-list">
        {tasks.length === 0 && (
          <div className="qd-dim">Nothing scheduled for this date — add a time to a quest task or daily anchor.</div>
        )}
        {tasks.map((item) => (
          <div
            key={item.clockKey}
            className={"qd-clock-item" + (item.done ? " done" : "")}
            onClick={() => onToggle(item)}
          >
            <span>{item.domainEmoji}</span>
            <span className="qd-clock-item-name">
              {item.name}
              {item.sourceType === "anchor" && (
                <span className="qd-clock-routine"> · routine</span>
              )}
            </span>
            <span className="qd-clock-item-time">
              {item.hour !== null && item.hour !== undefined
                ? String(item.hour).padStart(2, "0") + ":00"
                : "—"}
            </span>
            <span className="qd-clock-item-xp">{item.xp} XP</span>
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
  const [hour, setHour] = useState(
    anchor.hour === null || anchor.hour === undefined ? "" : String(anchor.hour)
  );

  useEffect(() => {
    setEmoji(anchor.emoji);
    setName(anchor.name);
    setXp(anchor.xpPerDay);
    setHour(
      anchor.hour === null || anchor.hour === undefined ? "" : String(anchor.hour)
    );
  }, [anchor]);

  const save = () => {
    if (!name.trim()) return;

    onUpdate(anchor.id, {
      emoji: emoji || "⭐",
      name: name.trim(),
      xpPerDay: Math.max(1, Number(xp) || 1),
      hour:
        hour === "" || hour === null || hour === undefined
          ? null
          : Number(hour),
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
              {anchor.hour !== null && anchor.hour !== undefined
                ? ` · ${String(anchor.hour).padStart(2, "0")}:00`
                : ""}
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

          <select
            value={hour}
            onChange={(e) => setHour(e.target.value)}
            title="Routine time"
          >
            <option value="">No clock time</option>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>

          <button type="button" onClick={save}>
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
  const [hour, setHour] = useState("");

  const submit = () => {
    if (!name.trim()) return;

    onAdd({
      emoji: emoji || "⭐",
      name: name.trim(),
      xpPerDay: Math.max(1, Number(xp) || 1),
      hour:
        hour === "" || hour === null || hour === undefined
          ? null
          : Number(hour),
    });

    setEmoji("⭐");
    setName("");
    setXp(10);
    setHour("");
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

      <select
        value={hour}
        onChange={(e) => setHour(e.target.value)}
        title="Routine time"
      >
        <option value="">No clock time</option>
        {Array.from({ length: 24 }, (_, h) => (
          <option key={h} value={h}>
            {String(h).padStart(2, "0")}:00
          </option>
        ))}
      </select>

      <button type="button" onClick={submit}>
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
  todayStr,
  onToggleTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onTargetChange,
  onDeleteDomain,
}) {
  const [showAdd, setShowAdd] = useState(false);

  const [name, setName] = useState("");
  const [xp, setXp] = useState(20);
  const [day, setDay] = useState("");
  const [hour, setHour] = useState("");

  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editXp, setEditXp] = useState(20);
  const [editDay, setEditDay] = useState("");
  const [editHour, setEditHour] = useState("");

  const status = questStatus(domain, today);

  const submitTask = () => {
    if (!name.trim()) return;

    onAddTask({ name: name.trim(), xp, day, hour });
    setName("");
    setXp(20);
    setDay("");
    setHour("");
    setShowAdd(false);
  };

  const startTaskEdit = (task) => {
    playSFX("click");
    setEditingTaskId(task.id);
    setEditName(task.name || "");
    setEditXp(Number(task.xp) || 10);
    setEditDay(task.day || "");
    setEditHour(task.hour === null || task.hour === undefined ? "" : String(task.hour));
  };

  const cancelTaskEdit = () => {
    setEditingTaskId(null);
    setEditName("");
    setEditXp(20);
    setEditDay("");
    setEditHour("");
  };

  const saveTaskEdit = () => {
    if (!editingTaskId || !editName.trim()) return;

    onUpdateTask(editingTaskId, {
      name: editName.trim(),
      xp: Math.max(1, Number(editXp) || 1),
      day: editDay || null,
      hour: editHour === "" || editHour === null || editHour === undefined ? null : Number(editHour),
    });

    cancelTaskEdit();
  };

  return (
    <div className="qd-quest" style={{ "--accent": domain.color }}>
      <div className="qd-quest-head">
        <span className="qd-quest-emoji">{domain.emoji}</span>

        <div className="qd-quest-titlewrap">
          <div className="qd-quest-title">{domain.name}</div>
          <div className="qd-quest-narrative">{status.text}</div>
        </div>

        <div className="qd-quest-actions">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete the entire "${domain.name}" quest?`)) {
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
            onChange={(e) => onTargetChange(e.target.value)}
          />
          <span>this month</span>
        </div>
      </div>

      <div className="qd-bar">
        <div
          className="qd-bar-fill"
          style={{ width: `${status.pct * 100}%`, background: domain.color }}
        />
      </div>

      <div className="qd-quest-count">
        {status.doneThisMonth} / {status.target} quests done this month
      </div>

      <div className="qd-tasklist">
        {domain.tasks.map((t) =>
          editingTaskId === t.id ? (
            <div key={t.id} className="qd-task-edit-row">
              <input
                type="text"
                value={editName}
                placeholder="Task name"
                onChange={(e) => setEditName(e.target.value)}
              />

              <input
                type="number"
                min="1"
                value={editXp}
                aria-label="Task XP"
                onChange={(e) => setEditXp(e.target.value)}
              />

              <div className="qd-task-date-edit">
                <input
                  type="date"
                  value={editDay}
                  onChange={(e) => setEditDay(e.target.value)}
                />
                <button
                  type="button"
                  className="qd-today-btn"
                  onClick={() => setEditDay(todayStr)}
                >
                  Today
                </button>
                {editDay && (
                  <button
                    type="button"
                    className="qd-clear-date-btn"
                    onClick={() => {
                      setEditDay("");
                      setEditHour("");
                    }}
                  >
                    No date
                  </button>
                )}
              </div>

              <select
                value={editHour}
                onChange={(e) => setEditHour(e.target.value)}
                disabled={!editDay}
                title={!editDay ? "Choose a date first" : "Task time"}
              >
                <option value="">No time</option>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>

              <div className="qd-task-edit-actions">
                <button type="button" onClick={saveTaskEdit}>Save changes</button>
                <button type="button" className="qd-cancel" onClick={cancelTaskEdit}>Cancel</button>
              </div>
            </div>
          ) : (
            <div key={t.id} className={"qd-task" + (t.done ? " done" : "")}>
              <input
                type="checkbox"
                checked={!!t.done}
                onChange={() => onToggleTask(t.id)}
              />

              <span className="qd-task-name">{t.name}</span>

              {t.day ? (
                <span className="qd-task-day">
                  {t.day}
                  {t.hour !== null && t.hour !== undefined
                    ? " · " + String(t.hour).padStart(2, "0") + ":00"
                    : ""}
                </span>
              ) : (
                <span className="qd-task-unscheduled">Unscheduled</span>
              )}

              <span className="qd-task-xp">{t.xp} XP</span>

              <button
                type="button"
                className="qd-task-edit-btn"
                onClick={() => startTaskEdit(t)}
                title="Edit task"
              >
                Edit
              </button>

              <button
                type="button"
                className="qd-task-del"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (window.confirm(`Delete "${t.name}"?`)) onDeleteTask(t.id);
                }}
                title="Delete task"
              >
                ×
              </button>
            </div>
          )
        )}

        {domain.tasks.length === 0 && <div className="qd-dim">No tasks yet.</div>}
      </div>

      {showAdd ? (
        <div className="qd-add-task">
          <input
            type="text"
            placeholder="Task name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitTask(); }}
          />

          <input
            type="number"
            placeholder="XP"
            value={xp}
            min="1"
            onChange={(e) => setXp(e.target.value)}
            style={{ width: 60 }}
          />

          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />

          <select value={hour} onChange={(e) => setHour(e.target.value)} disabled={!day}>
            <option value="">No time</option>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
            ))}
          </select>

          <button type="button" className="qd-today-btn" onClick={() => setDay(todayStr)}>
            Today
          </button>
          <button type="button" onClick={submitTask}>Add</button>
          <button type="button" className="qd-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
        </div>
      ) : (
        <button
          type="button"
          className="qd-add-btn"
          onClick={() => { playSFX("click"); setShowAdd(true); }}
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
    allTasks().reduce((sum, task) => {
      const completedOn = task.doneAt?.slice(0, 10);
      const belongsToDay =
        task.day === ds ||
        (task.done && completedOn === ds);

      return sum + (belongsToDay ? Number(task.xp) || 0 : 0);
    }, 0);

  const dayXP = (ds) =>
    dayAnchorXP(ds) + dayTaskXP(ds);

  const dayMax = (ds) =>
    dayAnchorMax() + dayTaskMax(ds);

  // Weekly XP formula:
  // Earned = anchors completed this week + every task completed this week.
  // Available = 7 days of anchor XP + every unfinished task + tasks completed this week.
  // Assigned dates do not matter for the weekly task pool.
  const weekAnchorXP = () =>
    wDates.reduce((sum, d) => sum + dayAnchorXP(d), 0);

  const weekAnchorMax = () =>
    dayAnchorMax() * 7;

  const weekTaskXP = () =>
    allTasks().reduce((sum, task) => {
      const completedOn = task.doneAt?.slice(0, 10);
      const completedThisWeek =
        !!task.done && !!completedOn && wDates.includes(completedOn);

      return sum + (completedThisWeek ? Number(task.xp) || 0 : 0);
    }, 0);

  const weekTaskMax = () =>
    allTasks().reduce((sum, task) => {
      const completedOn = task.doneAt?.slice(0, 10);
      const completedThisWeek =
        !!task.done && !!completedOn && wDates.includes(completedOn);
      const activeThisWeek = !task.done || completedThisWeek;

      return sum + (activeThisWeek ? Number(task.xp) || 0 : 0);
    }, 0);

  const dToday = dayXP(todayStr);
  const dMaxToday = dayMax(todayStr);
  const wXP = weekAnchorXP() + weekTaskXP();
  const wMax = weekAnchorMax() + weekTaskMax();

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
    hour,
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

        hour:
          hour === "" || hour === null || hour === undefined
            ? null
            : Number(hour),

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
      anchor.hour =
        changes.hour === "" ||
        changes.hour === null ||
        changes.hour === undefined
          ? null
          : Number(changes.hour);
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

  const updateTask = (
    domainId,
    taskId,
    changes
  ) => {
    updateState((next) => {
      const domain = next.domains.find((d) => d.id === domainId);
      if (!domain) return;

      const task = domain.tasks.find((t) => t.id === taskId);
      if (!task) return;

      task.name = changes.name;
      task.xp = Math.max(1, Number(changes.xp) || 1);
      task.day = changes.day || null;
      task.hour =
        changes.hour === "" || changes.hour === null || changes.hour === undefined
          ? null
          : Number(changes.hour);
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

  const viewAnchorClockItems = state.anchors
    .filter(
      (anchor) =>
        anchor.hour !== null &&
        anchor.hour !== undefined
    )
    .map((anchor) => ({
      id: anchor.id,
      clockKey: `anchor-${anchor.id}-${viewDateStr}`,
      sourceType: "anchor",
      anchorId: anchor.id,
      name: anchor.name,
      hour: Number(anchor.hour),
      xp: Number(anchor.xpPerDay) || 0,
      done: !!anchor.history?.[viewDateStr],
      domainEmoji: anchor.emoji,
      domainName: "Daily Anchor",
    }));

  const clockItems = [
    ...viewTasks.map((task) => ({
      ...task,
      sourceType: "task",
      clockKey: `task-${task.domainId}-${task.id}`,
    })),
    ...viewAnchorClockItems,
  ].sort((a, b) => Number(a.hour ?? 99) - Number(b.hour ?? 99));

  // ====================================================
  // RENDER
  // ====================================================

  const voyageRows = state.domains.map((domain, index) => ({
    domain,
    status: questStatus(domain, today),
    index,
  }));

  const voyagePct = voyageRows.length
    ? voyageRows.reduce((sum, row) => sum + row.status.pct, 0) / voyageRows.length
    : 0;

  const voyageStage = Math.min(
    STAGES.length,
    Math.max(1, Math.floor(voyagePct * (STAGES.length - 1)) + 1)
  );

  const todayQuestTasks = viewTasks;
  const todayThreshold = Math.round(
    dMaxToday * (Number(state.settings.dayThresholdPct ?? 70) / 100)
  );
  const weekThreshold = Math.round(
    wMax * (Number(state.settings.weekThresholdPct ?? 70) / 100)
  );
  const greeting =
    today.getHours() < 12
      ? "GOOD MORNING"
      : today.getHours() < 18
      ? "GOOD AFTERNOON"
      : "GOOD EVENING";

  return (
    <div className="qd-root">
      <style>{CSS}</style>

      {celebration && (
        <CelebrationModal
          kind={celebration}
          items={celebration === "daily" ? state.rewards.daily : state.rewards.weekly}
          onComplete={finishCelebration}
        />
      )}

      <div className="qd-shell">
        <aside className="qd-sidebar">
          <div className="qd-brand">
            <div className="qd-laurel">⚔</div>
            <div>
              <div className="qd-brand-title">ODYSSEUS</div>
              <div className="qd-brand-sub">Discipline today, Ithaca tomorrow.</div>
            </div>
          </div>

          <nav className="qd-nav">
            <a className="active" href="#home"><span className="qd-nav-icon">⌂</span>Home</a>
            <a href="#quests"><span className="qd-nav-icon">⚔</span>Quests</a>
            <a href="#voyage"><span className="qd-nav-icon">⛵</span>The Voyage</a>
            <a href="#anchors"><span className="qd-nav-icon">⚓</span>Anchors</a>
            <a href="#rewards"><span className="qd-nav-icon">🏺</span>Rewards</a>
          </nav>

          <div className="qd-sidebar-quote">
            “The journey is the reward.”
            <span>— Odysseus</span>
          </div>

          <button
            type="button"
            className="qd-logout"
            onClick={async () => {
              playSFX("click");
              await supabase.auth.signOut();
            }}
          >
            Log out
          </button>
        </aside>

        <main className="qd-main" id="home">
          <div className="qd-topbar">
            <div>
              <div className="qd-greeting-kicker">{greeting},</div>
              <div className="qd-greeting">ODYSSEUS</div>
              <div className="qd-greeting-sub">The sea is calm, and so is your mind.</div>
            </div>
            <div className="qd-topmeta">
              <div className="qd-meta-pill">
                {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </div>
              <div className="qd-meta-pill">XP <strong>{wXP}</strong></div>
            </div>
          </div>

          <div className="qd-dashboard-grid">
            <section className="qd-panel" aria-label="Daily clock">
              <ClockDial
                tasks={clockItems}
                dateLabel={viewDateLabel}
                onPrev={() => setViewOffset(viewOffset - 1)}
                onNext={() => setViewOffset(viewOffset + 1)}
                onToggle={(item) => {
                  if (item.sourceType === "anchor") {
                    toggleAnchor(item.anchorId, viewDateStr);
                  } else {
                    toggleTask(item.domainId, item.id);
                  }
                }}
                now={clockNow}
              />
            </section>

            <section className="qd-panel qd-voyage" id="voyage">
              <div className="qd-panel-head">
                <div>
                  <div className="qd-panel-title">THE VOYAGE</div>
                  <div className="qd-panel-sub">Your journey toward Ithaca.</div>
                </div>
                <div className="qd-voyage-stage">Stage {voyageStage} of {STAGES.length}</div>
              </div>

              <div className="qd-voyage-list">
                {voyageRows.map(({ domain, status }, index) => (
                  <div className="qd-voyage-row" key={domain.id}>
                    <div className="qd-voyage-num">{index + 1}</div>
                    <div className="qd-voyage-name">{domain.emoji} {domain.name}</div>
                    <div className="qd-voyage-bar"><div className="qd-voyage-fill" style={{ width: `${status.pct * 100}%` }} /></div>
                    <div className="qd-voyage-pct">{Math.round(status.pct * 100)}%</div>
                  </div>
                ))}
              </div>

              <div className="qd-voyage-note">
                {voyagePct >= 1 ? "Ithaca. You are home." : STAGES[Math.min(STAGES.length - 1, voyageStage - 1)]}
              </div>
            </section>
          </div>

          <div className="qd-lower-grid">
            <section className="qd-panel qd-today-panel">
              <div className="qd-panel-head">
                <div>
                  <div className="qd-panel-title">TODAY'S QUESTS</div>
                  <div className="qd-panel-sub">Create. Endure. Return stronger.</div>
                </div>
                <span className="qd-dim">{todayQuestTasks.length} scheduled</span>
              </div>
              <div className="qd-today-list">
                {todayQuestTasks.length === 0 && <div className="qd-empty">No quests scheduled for this date.</div>}
                {todayQuestTasks.slice(0, 6).map((task) => (
                  <div key={task.id} className={"qd-today-task" + (task.done ? " done" : "")} onClick={() => toggleTask(task.domainId, task.id)}>
                    <div className="qd-today-check">{task.done ? "✓" : ""}</div>
                    <div>
                      <div className="qd-today-name">{task.name}</div>
                      <div className="qd-today-sub">{task.domainEmoji} {task.domainName}{task.hour !== null && task.hour !== undefined ? ` · ${String(task.hour).padStart(2, "0")}:00` : ""}</div>
                    </div>
                    <div className="qd-today-xp">+{task.xp} XP</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="qd-panel qd-anchor-panel" id="anchors">
              <div className="qd-panel-head">
                <div>
                  <div className="qd-panel-title">DAILY ANCHORS</div>
                  <div className="qd-panel-sub">The things that keep the voyager moving.</div>
                </div>
              </div>

              <div className="qd-anchors">
                {state.anchors.map((anchor) => (
                  <AnchorCard
                    key={anchor.id}
                    anchor={anchor}
                    weekDates={wDates}
                    onToggle={toggleAnchor}
                    onUpdate={updateAnchor}
                    onDelete={deleteAnchor}
                  />
                ))}
              </div>

              {showAddAnchor ? (
                <div style={{ padding: "0 16px 12px" }}>
                  <AnchorAddForm onAdd={addAnchor} onCancel={() => setShowAddAnchor(false)} />
                </div>
              ) : (
                <button type="button" className="qd-add-btn" onClick={() => { playSFX("click"); setShowAddAnchor(true); }}>
                  + New daily anchor
                </button>
              )}
            </section>

            <div className="qd-side-stack">
              <section className="qd-panel qd-xp-card">
                <div className="qd-xp-top">
                  <div>
                    <div className="qd-panel-title">XP PROGRESS</div>
                    <div className="qd-panel-sub">Daily discipline. Weekly momentum.</div>
                  </div>
                  <div className="qd-xp-number">{dToday}</div>
                </div>

                <div className="qd-xp-progress-block">
                  <div className="qd-xp-row-label">
                    <span>Today</span>
                    <strong>{dToday} / {todayThreshold || 0} XP</strong>
                  </div>
                  <div className="qd-xp-bar">
                    <div
                      className="qd-xp-fill"
                      style={{ width: `${Math.min(100, dMaxToday ? (dToday / dMaxToday) * 100 : 0)}%` }}
                    />
                  </div>
                  <div className="qd-xp-caption">
                    <span>Max available today: {dMaxToday} XP</span>
                    <span>Unlock at {todayThreshold || 0} XP</span>
                  </div>
                </div>

                <div className="qd-xp-progress-block qd-weekly-xp-block">
                  <div className="qd-xp-row-label">
                    <span>This week</span>
                    <strong>{wXP} / {weekThreshold || 0} XP</strong>
                  </div>
                  <div className="qd-xp-bar qd-weekly-xp-bar">
                    <div
                      className="qd-xp-fill"
                      style={{ width: `${Math.min(100, wMax ? (wXP / wMax) * 100 : 0)}%` }}
                    />
                  </div>
                  <div className="qd-xp-caption">
                    <span>Weekly pool: {wMax} XP</span>
                    <span>Includes unscheduled tasks</span>
                  </div>
                </div>

                <div className="qd-reset-mini">
                  Daily reset in <strong>{dailyCountdown}</strong> · Weekly reset in <strong>{weeklyCountdown}</strong>
                </div>
              </section>

              <section className="qd-panel qd-reward-stack" id="rewards">
                <div className="qd-panel-head">
                  <div>
                    <div className="qd-panel-title">REWARDS</div>
                    <div className="qd-panel-sub">Treasure earned through discipline.</div>
                  </div>
                </div>
                <div className="qd-machines">
                  <RewardMachine
                    title="Daily Treasure"
                    icon="🪙"
                    items={state.rewards.daily}
                    xpNow={dToday}
                    xpMax={dMaxToday}
                    thresholdPct={state.settings.dayThresholdPct}
                    onThresholdChange={(value) => setThresholdPct("dayThresholdPct", value)}
                    claimedValue={state.claimed.daily[todayStr]}
                    onClaim={(reward) => claimReward("daily", todayStr, reward)}
                    onAddItem={(text) => addReward("daily", text)}
                    onRemoveItem={(index) => removeReward("daily", index)}
                    periodLabel="Daily reward"
                    resetCountdown={dailyCountdown}
                  />
                  <RewardMachine
                    title="Weekly Treasure"
                    icon="🏺"
                    items={state.rewards.weekly}
                    xpNow={wXP}
                    xpMax={wMax}
                    thresholdPct={state.settings.weekThresholdPct}
                    onThresholdChange={(value) => setThresholdPct("weekThresholdPct", value)}
                    claimedValue={state.claimed.weekly[weekKeyStr]}
                    onClaim={(reward) => claimReward("weekly", weekKeyStr, reward)}
                    onAddItem={(text) => addReward("weekly", text)}
                    onRemoveItem={(index) => removeReward("weekly", index)}
                    periodLabel="Resets Monday"
                    resetCountdown={weeklyCountdown}
                  />
                </div>
              </section>
            </div>
          </div>

          <section className="qd-section" id="quests">
            <div className="qd-section-heading">
              <div>
                <h2>QUEST LOG</h2>
                <div className="qd-section-tag">Every task is another mile toward Ithaca.</div>
              </div>
            </div>

            <div className="qd-quest-grid">
              {state.domains.map((domain) => (
                <QuestCard
                  key={domain.id}
                  domain={domain}
                  today={today}
                  todayStr={todayStr}
                  onToggleTask={(taskId) => toggleTask(domain.id, taskId)}
                  onAddTask={(payload) => addTask(domain.id, payload)}
                  onUpdateTask={(taskId, changes) => updateTask(domain.id, taskId, changes)}
                  onDeleteTask={(taskId) => deleteTask(domain.id, taskId)}
                  onTargetChange={(value) => updateTarget(domain.id, value)}
                  onDeleteDomain={deleteDomain}
                />
              ))}
            </div>

            {showAddDomain ? (
              <div className="qd-add-task">
                <input type="text" placeholder="Quest name" value={newDomainName} onChange={(e) => setNewDomainName(e.target.value)} />
                <input type="text" placeholder="Emoji" value={newDomainEmoji} onChange={(e) => setNewDomainEmoji(e.target.value)} style={{ width: 55 }} />
                <input type="number" min="1" placeholder="Monthly target" value={newDomainTarget} onChange={(e) => setNewDomainTarget(e.target.value)} style={{ width: 90 }} />
                <button type="button" onClick={addDomain}>Add</button>
                <button type="button" className="qd-cancel" onClick={() => setShowAddDomain(false)}>Cancel</button>
              </div>
            ) : (
              <button type="button" className="qd-add-btn" style={{ marginLeft: 0, width: "auto" }} onClick={() => { playSFX("click"); setShowAddDomain(true); }}>
                + New quest
              </button>
            )}
          </section>

          <section className="qd-panel qd-reset-card">
            <div>
              <div className="qd-reset-title">☾ DAY RESET TIME</div>
              <div className="qd-dim">Your daily XP and reward reset at this hour.</div>
            </div>
            <select value={resetHour} onChange={(e) => setResetHour(e.target.value)}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {h === 0 ? "12:00 AM" : h < 12 ? `${h}:00 AM` : h === 12 ? "12:00 PM" : `${h - 12}:00 PM`}
                </option>
              ))}
            </select>
          </section>

          <div className="qd-footer">SMALL STEPS. GREAT JOURNEYS.</div>
        </main>
      </div>
    </div>
  );
}
