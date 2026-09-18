console.log("🔥 NEW QUEST DASHBOARD CODE LOADED 🔥");

import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import GardenScene from "./GardenScene";
import DailyAnchors, { PixelAnchorSymbol } from "./DailyAnchors";
import TodayQuests from "./TodayQuests";
import { getTodayQuestItems } from "./today-quests.js";
import { FarmAndStreak, StopDay, BottomNavigation, HomePageHeading, StatsPage, MorePage } from "./HomeFinish";
import { getCurrentStreak, getHomePage } from "./home-finish.js";

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

// Task timing memory is stored inside each quest/domain so similarly named
// tasks in different quests (for example Reading > Anki vs French > Anki)
// never share timing history.
const normalizeTaskTimingKey = (name = "") =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F\u0600-\u06FF]+/g, " " )
    .replace(/\s+/g, " " )
    .trim();

const roundLearnedMinutes = (minutes) => {
  const value = Number(minutes) || 0;
  if (value <= 0) return null;
  return value < 10
    ? Math.max(1, Math.round(value))
    : Math.max(5, Math.round(value / 5) * 5);
};

const getTimingProfile = (domain, taskName) => {
  const key = normalizeTaskTimingKey(taskName);
  if (!key) return null;
  return domain?.timingProfiles?.[key] || null;
};

const getLearnedEstimate = (domain, taskName) => {
  const profile = getTimingProfile(domain, taskName);
  const samples = (profile?.samples || [])
    .filter((sample) => Number(sample?.actualMinutes) > 0)
    .slice(-5);

  if (!samples.length) return null;

  // Recent attempts matter more: for 3 samples, weights are 1, 2, 3.
  const weighted = samples.reduce(
    (sum, sample, index) =>
      sum + Number(sample.actualMinutes) * (index + 1),
    0
  );
  const weights = samples.reduce((sum, _sample, index) => sum + index + 1, 0);

  return roundLearnedMinutes(weighted / weights);
};

const getTimingSampleCount = (domain, taskName) =>
  (getTimingProfile(domain, taskName)?.samples || []).filter(
    (sample) => Number(sample?.actualMinutes) > 0
  ).length;

const formatMinutes = (minutes) => {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  if (!value) return "—";
  if (value < 60) return `${value}m`;
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
};

// ======================================================
// DAILY ANCHOR SCHEDULE HELPERS
// ======================================================

const ANCHOR_CATEGORY_COLORS = [
  "#7EC5A0",
  "#8B7CFF",
  "#E3A85B",
  "#67B9E8",
  "#E27888",
  "#B78BE8",
  "#79C7C0",
  "#D0B45F",
  "#7FB06D",
  "#D98A5F",
];

const normalizeAnchorCategory = (value) =>
  String(value || "").trim() || "General";

// Categories are intentionally user-written. Their color is derived from the
// category name, so the same label always keeps the same color across anchors
// and across sessions without forcing a preset category list.
const getAnchorCategoryColor = (category) => {
  const key = normalizeAnchorCategory(category).toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return ANCHOR_CATEGORY_COLORS[hash % ANCHOR_CATEGORY_COLORS.length];
};

const WEEKDAY_OPTIONS = [
  { value: 1, short: "M", label: "Monday" },
  { value: 2, short: "T", label: "Tuesday" },
  { value: 3, short: "W", label: "Wednesday" },
  { value: 4, short: "T", label: "Thursday" },
  { value: 5, short: "F", label: "Friday" },
  { value: 6, short: "S", label: "Saturday" },
  { value: 7, short: "S", label: "Sunday" },
];

const normalizeAnchorWeekdays = (days) => {
  const clean = Array.isArray(days)
    ? [...new Set(days.map(Number).filter((day) => day >= 1 && day <= 7))].sort((a, b) => a - b)
    : [];
  return clean.length ? clean : WEEKDAY_OPTIONS.map((day) => day.value);
};

const getAnchorWeekdays = (anchor) =>
  normalizeAnchorWeekdays(anchor?.activeWeekdays);

const getAnchorDaysPerWeek = (anchor) =>
  getAnchorWeekdays(anchor).length;

const getISOWeekday = (dateStr) => {
  const jsDay = parseISODateLocal(dateStr).getDay();
  return jsDay === 0 ? 7 : jsDay;
};

const isAnchorScheduledOn = (anchor, dateStr) =>
  getAnchorWeekdays(anchor).includes(getISOWeekday(dateStr));

// ======================================================
// VOYAGE ADJUSTMENT HELPERS
// ======================================================

const parseISODateLocal = (dateStr) => {
  const [year, month, day] = String(dateStr || "").split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
};

const getTaskFlexibility = (task) =>
  task?.flexibility === "fixed" ? "fixed" : "flexible";

const getTaskPlanningMinutes = (task) => {
  const value = Number(task?.estimatedMinutes);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 30;
};

const getVoyageAdjustment = (state, dateStr) =>
  state?.voyageAdjustments?.[dateStr] || null;

// Safe Harbor can keep all, some, or none of the daily anchors active.
// Older saves only knew about one protected anchor, so keep that behavior
// as a backward-compatible fallback.
const getSafeHarborActiveAnchorIds = (state, adjustment) => {
  if (adjustment?.mode !== "harbor") return [];

  if (Array.isArray(adjustment.activeAnchorIds)) {
    return adjustment.activeAnchorIds.filter((id) =>
      state?.anchors?.some((anchor) => anchor.id === id)
    );
  }

  const protectedKey = String(adjustment?.protectedKey || "");
  if (protectedKey.startsWith("anchor:")) {
    return [protectedKey.slice("anchor:".length)];
  }

  return [];
};

const buildVoyageAdjustmentPlan = (
  state,
  dateStr,
  mode,
  capacityPct,
  protectedKey = ""
) => {
  const all = (state?.domains || []).flatMap((domain) =>
    (domain.tasks || []).map((task) => ({
      ...task,
      domainId: domain.id,
      domainName: domain.name,
      domainEmoji: domain.emoji,
      planningMinutes: getTaskPlanningMinutes(task),
      flexibility: getTaskFlexibility(task),
      planKey: `task:${domain.id}:${task.id}`,
    }))
  );

  const scheduledToday = all.filter(
    (task) => !task.done && task.day === dateStr
  );

  const plannedMinutes = scheduledToday.reduce(
    (sum, task) => sum + task.planningMinutes,
    0
  );

  const normalizedCapacity =
    mode === "harbor"
      ? 0
      : Math.min(100, Math.max(0, Number(capacityPct) || 0));

  const targetMinutes = Math.round(plannedMinutes * (normalizedCapacity / 100));

  const forcedKeep = scheduledToday.filter(
    (task) => task.flexibility === "fixed" || task.planKey === protectedKey
  );
  const keepIds = new Set(forcedKeep.map((task) => task.planKey));
  let keptMinutes = forcedKeep.reduce(
    (sum, task) => sum + task.planningMinutes,
    0
  );

  const movable = scheduledToday.filter((task) => !keepIds.has(task.planKey));
  const moving = [];

  movable.forEach((task) => {
    if (mode !== "harbor" && keptMinutes + task.planningMinutes <= targetMinutes) {
      keepIds.add(task.planKey);
      keptMinutes += task.planningMinutes;
    } else {
      moving.push(task);
    }
  });

  const kept = scheduledToday.filter((task) => keepIds.has(task.planKey));

  const start = parseISODateLocal(dateStr);
  const futureDates = weekDates(start).filter((ds) => ds > dateStr);

  const candidateDates = futureDates.filter((ds) => {
    const adjustment = getVoyageAdjustment(state, ds);
    return adjustment?.mode !== "harbor";
  });

  const loads = Object.fromEntries(
    candidateDates.map((ds) => {
      const minutes = all
        .filter((task) => !task.done && task.day === ds)
        .reduce((sum, task) => sum + task.planningMinutes, 0);
      return [ds, minutes];
    })
  );

  const moves = moving.map((task) => {
    let toDay = null;

    if (candidateDates.length) {
      toDay = [...candidateDates].sort((a, b) => {
        const aAdjustment = getVoyageAdjustment(state, a);
        const bAdjustment = getVoyageAdjustment(state, b);
        const aCapacity =
          aAdjustment?.mode === "reduced"
            ? Math.max(0.25, Number(aAdjustment.capacityPct || 100) / 100)
            : 1;
        const bCapacity =
          bAdjustment?.mode === "reduced"
            ? Math.max(0.25, Number(bAdjustment.capacityPct || 100) / 100)
            : 1;
        const aScore = (loads[a] || 0) / aCapacity;
        const bScore = (loads[b] || 0) / bCapacity;
        if (aScore !== bScore) return aScore - bScore;
        return a.localeCompare(b);
      })[0];

      loads[toDay] = (loads[toDay] || 0) + task.planningMinutes;
    }

    return {
      domainId: task.domainId,
      taskId: task.id,
      name: task.name,
      minutes: task.planningMinutes,
      fromDay: dateStr,
      fromHour: task.hour ?? null,
      toDay,
    };
  });

  const fixedMinutes = scheduledToday
    .filter((task) => task.flexibility === "fixed")
    .reduce((sum, task) => sum + task.planningMinutes, 0);

  const warnings = [];
  if (forcedKeep.length && keptMinutes > targetMinutes) {
    warnings.push(
      "Fixed or protected work is already above the capacity you selected. Quest will keep it today rather than silently moving it."
    );
  }
  if (moves.some((move) => !move.toDay)) {
    warnings.push(
      "There is no later active day left in this week for some work, so those tasks will return to the unscheduled backlog instead of being deleted."
    );
  }
  if (scheduledToday.some((task) => !task.estimatedMinutes)) {
    warnings.push(
      "Some tasks do not have a time estimate yet. Quest uses 30 minutes only for this rebalance calculation."
    );
  }

  return {
    mode,
    capacityPct: normalizedCapacity,
    plannedMinutes,
    targetMinutes,
    keptMinutes,
    fixedMinutes,
    kept,
    moves,
    futureLoads: loads,
    warnings,
  };
};


const applyVoyageMovesToState = (
  next,
  dateStr,
  mode,
  protectedKey = "",
  plannedMoves = []
) => {
  const moveMap = new Map(
    (plannedMoves || []).map((move) => [
      `${move.domainId}:${move.taskId}`,
      move,
    ])
  );

  const appliedMoves = [];

  (next?.domains || []).forEach((domain) => {
    (domain.tasks || []).forEach((task) => {
      if (task.done || task.day !== dateStr) return;

      const taskKey = `task:${domain.id}:${task.id}`;
      const isProtected = taskKey === protectedKey;
      const isFixed = getTaskFlexibility(task) === "fixed";
      const plannedMove = moveMap.get(`${domain.id}:${task.id}`);

      if (isProtected || isFixed) return;

      const mustLeaveSafeHarbor = mode === "harbor";

      if (!plannedMove && !mustLeaveSafeHarbor) return;

      // Safe Harbor is strict: every unfinished flexible task must leave today.
      // If an older/stale plan somehow missed it, send it to the backlog
      // instead of leaving the day looking unchanged.
      const toDay = plannedMove?.toDay || null;
      const fromHour = task.hour ?? null;

      task.day = toDay;
      task.hour = null;

      appliedMoves.push({
        domainId: domain.id,
        taskId: task.id,
        name: task.name,
        minutes: getTaskPlanningMinutes(task),
        fromDay: dateStr,
        fromHour,
        toDay,
      });
    });
  });

  return appliedMoves;
};

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
      category: "Health",
      activeWeekdays: [1, 2, 3, 4, 5, 6, 7],
      hour: null,
      history: {},
    },
    {
      id: "a2",
      name: "French Anki",
      emoji: "🇫🇷",
      xpPerDay: 10,
      category: "Study",
      activeWeekdays: [1, 2, 3, 4, 5, 6, 7],
      hour: null,
      history: {},
    },
    {
      id: "a3",
      name: "Reading 20–30 min",
      emoji: "📚",
      xpPerDay: 10,
      category: "Lifestyle",
      activeWeekdays: [1, 2, 3, 4, 5, 6, 7],
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

  // Per-day voyage changes. Existing users simply start with an empty history.
  voyageAdjustments: {},

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
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=Inter:wght@400;500;600;700&display=swap');

html,body,#root{margin:0!important;padding:0!important;width:100%!important;max-width:none!important;min-width:0!important;}
html{scroll-behavior:smooth;}
body{overflow-x:clip;-webkit-text-size-adjust:100%;}
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
  overflow-x:clip;
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
  display:block;
  width:100%;
  max-width:1600px;
  margin:0 auto;
}
.qd-sidebar{
  position:fixed;
  z-index:80;
  left:max(12px,calc((100vw - 1600px)/2 + 12px));
  top:50%;
  width:58px;
  height:auto;
  max-height:none;
  padding:9px 7px;
  transform:translateY(-50%);
  background:linear-gradient(180deg,rgba(5,14,26,.90),rgba(7,17,30,.86));
  border:1px solid rgba(203,166,106,.28);
  border-radius:20px;
  backdrop-filter:blur(18px);
  box-shadow:0 16px 42px rgba(0,0,0,.34),0 0 0 1px rgba(255,255,255,.018) inset;
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:8px;
  overflow:visible;
  animation:qdSidebarFloat 4.8s ease-in-out infinite;
}
.qd-brand{display:flex;align-items:center;justify-content:center;padding:0 0 7px;border-bottom:1px solid var(--line);width:100%}
.qd-laurel{width:38px;height:38px;border:1px solid var(--gold);border-radius:50%;display:grid;place-items:center;color:var(--gold-bright);font-size:18px;box-shadow:inset 0 0 18px rgba(203,166,106,.10)}
.qd-brand>div:last-child{display:none}
.qd-brand-title,.qd-brand-sub{display:none}
.qd-nav{display:flex;flex-direction:column;gap:6px;align-items:center;width:100%}
.qd-nav a{
  position:relative;
  width:42px;height:42px;padding:0;border-radius:13px;display:grid;place-items:center;
  color:#cfd6e5;text-decoration:none;border:1px solid transparent;
  font-size:0;transition:transform .22s ease,background .22s ease,border-color .22s ease,box-shadow .22s ease;
}
.qd-nav a:hover{transform:translateX(3px);background:rgba(98,68,177,.22);border-color:rgba(139,92,246,.26)}
.qd-nav a.active{background:linear-gradient(145deg,rgba(126,91,216,.52),rgba(44,65,113,.30));border-color:rgba(185,156,255,.55);box-shadow:0 0 18px rgba(139,92,246,.22),inset 0 0 12px rgba(255,255,255,.025)}
.qd-nav a.active::before{content:"";position:absolute;left:-8px;width:3px;height:20px;border-radius:999px;background:var(--gold-bright);box-shadow:0 0 10px rgba(239,210,154,.6);animation:qdNavPulse 1.8s ease-in-out infinite}
.qd-nav-icon{width:22px;height:22px;display:flex;align-items:center;justify-content:center;flex:0 0 22px;text-align:center;color:var(--gold);font-size:18px;line-height:1;font-family:'Segoe UI Symbol','Apple Symbols','Noto Sans Symbols 2','Segoe UI Emoji','Apple Color Emoji',sans-serif;font-variant-emoji:text}
.qd-nav a[href="#voyage"] .qd-nav-icon,.qd-nav a[href="#anchors"] .qd-nav-icon{transform:translateY(1px)}
.qd-nav a[href="#rewards"] .qd-nav-icon{font-family:'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji','Segoe UI Symbol',sans-serif;font-variant-emoji:normal;transform:translateY(1px)}
/* SMALL ICON ALIGNMENT */
.qd-laurel,.qd-anchor-head>span:first-child,.qd-machine-icon,.qd-today-check{display:flex;align-items:center;justify-content:center;text-align:center;line-height:1}
.qd-laurel,.qd-anchor-head>span:first-child,.qd-machine-icon{font-family:'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji','Segoe UI Symbol',sans-serif}
.qd-quest-emoji{display:inline-flex;align-items:center;justify-content:center;min-width:28px;line-height:1;vertical-align:middle}
.qd-sidebar-quote{display:none}
.qd-logout{
  width:42px;height:36px;margin:0;padding:0;background:transparent;border:1px solid rgba(126,145,178,.2);
  color:var(--dim);border-radius:12px;cursor:pointer;font-size:0;display:grid;place-items:center;
}
.qd-logout::before{content:'↪';font-size:17px}
.qd-logout:hover{color:var(--text);border-color:var(--gold);transform:translateX(2px)}
.qd-main{min-width:0;margin-left:84px;padding:24px clamp(18px,2.6vw,38px) 70px}
.qd-sidebar{grid-column:auto!important;grid-row:auto!important;}
@keyframes qdSidebarFloat{0%,100%{transform:translateY(-50%)}50%{transform:translateY(calc(-50% - 6px))}}
@keyframes qdNavPulse{0%,100%{opacity:.55;transform:scaleY(.82)}50%{opacity:1;transform:scaleY(1)}}
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

.qd-anchors{padding:12px 16px 16px;display:flex;flex-direction:column;gap:8px}.qd-anchor{background:rgba(11,24,43,.70);border:1px solid var(--line-soft);padding:10px 11px;position:relative}.qd-anchor-head{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}.qd-anchor-head>span:first-child{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--line);font-size:18px;background:rgba(6,15,29,.55)}.qd-anchor-title{flex:1;font-family:'Cinzel',serif;font-size:12px;letter-spacing:.05em;min-width:100px}.qd-anchor-meta{display:flex;gap:5px;align-items:center;flex-wrap:wrap}.qd-anchor-category,.qd-anchor-frequency{font-size:9px;border-radius:999px;padding:3px 7px;white-space:nowrap}.qd-anchor-category{font-weight:700;letter-spacing:.02em}.qd-anchor-frequency{border:1px solid rgba(139,92,246,.28);color:#cdbdff;background:rgba(139,92,246,.08)}.qd-anchor-actions{display:flex;gap:4px}.qd-anchor-actions button,.qd-quest-actions button{background:none;border:1px solid rgba(126,145,178,.22);color:var(--dim);padding:4px 6px;cursor:pointer;font-size:10px}.qd-anchor-actions button:hover,.qd-quest-actions button:hover{border-color:var(--gold);color:var(--text)}.qd-anchor-week{display:flex;gap:5px;justify-content:flex-end;flex-wrap:wrap}.qd-dot{width:25px;height:25px;border-radius:50%;border:1px solid rgba(126,145,178,.28);background:rgba(7,15,29,.75);color:#7f8aa2;font-size:9px;cursor:pointer}.qd-dot.on{background:#7556d5;color:#fff;border-color:#b29cff;box-shadow:0 0 10px rgba(139,92,246,.45)}.qd-dot.off{opacity:.28;border-style:dashed;cursor:not-allowed}.qd-dot.paused{opacity:.4;cursor:not-allowed}.qd-anchor-schedule-editor{width:100%;border:1px solid var(--line-soft);background:rgba(8,18,33,.56);padding:9px;margin-top:2px}.qd-anchor-schedule-title{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:10px;color:var(--dim);margin-bottom:7px}.qd-anchor-schedule-title strong{color:var(--gold-bright);font-family:'Cinzel',serif;font-weight:600}.qd-anchor-day-picks{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}.qd-anchor-day-pick{background:#081526!important;border:1px solid rgba(126,145,178,.25)!important;color:#8895ab!important;padding:7px 2px!important;border-radius:999px!important;min-width:0!important}.qd-anchor-day-pick.active{background:linear-gradient(180deg,#7658d5,#573caa)!important;border-color:#b29cff!important;color:#fff!important;box-shadow:0 0 10px rgba(139,92,246,.2)}.qd-anchor-edit,.qd-add-task{display:flex;gap:6px;flex-wrap:wrap;padding:8px 0}.qd-anchor-edit input,.qd-anchor-edit select,.qd-add-task input,.qd-add-task select,.qd-add-row input,.qd-threshold-row input,.qd-reset-card select{background:#0a1729;border:1px solid var(--line);color:var(--text);padding:7px 8px;border-radius:4px}.qd-anchor-edit input:nth-child(2),.qd-add-task input[type=text]{flex:1;min-width:130px}.qd-anchor-edit select{min-width:118px}.qd-anchor-edit button,.qd-add-task button,.qd-add-row button{background:linear-gradient(180deg,#ad8b52,#826735);border:1px solid #d7b877;color:#0b1322;padding:7px 11px;border-radius:4px;cursor:pointer;font-weight:700}.qd-cancel{background:transparent!important;color:var(--dim)!important;border-color:var(--line)!important}.qd-add-btn{margin:10px 16px 16px;background:transparent;border:1px dashed rgba(203,166,106,.34);color:#b9c2d4;padding:8px 11px;cursor:pointer;width:calc(100% - 32px)}.qd-add-btn:hover{border-color:var(--gold);color:#fff}

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
  .qd-sidebar{position:relative;left:auto;top:auto;transform:none;animation:none;width:auto;height:auto;max-height:none;overflow:visible;padding:14px 14px 10px;gap:12px;border-radius:0;border-left:0;border-right:0;display:flex;align-items:stretch}
  .qd-brand>div:last-child{display:block}
  .qd-brand-title{display:block}.qd-brand-sub{display:block}
  .qd-brand{justify-content:flex-start}
  .qd-nav{align-items:stretch}
  .qd-nav a{width:auto;height:auto;padding:8px 10px;font-size:14px;display:flex;gap:8px}
  .qd-nav a.active::before{display:none}
  .qd-nav-icon{width:24px;font-size:14px}
  .qd-logout{font-size:11px;display:block;width:auto;height:auto;padding:7px 9px}
  .qd-logout::before{display:none}
  .qd-brand{padding-bottom:10px;padding-right:86px}
  .qd-nav{flex-direction:row;overflow-x:auto;overflow-y:hidden;padding-bottom:2px;-webkit-overflow-scrolling:touch}
  .qd-nav a{font-size:14px;white-space:nowrap;padding:8px 10px;flex:0 0 auto}
  .qd-sidebar-quote{display:none}
  .qd-logout{position:absolute;right:14px;top:14px;width:auto;margin:0}
  .qd-main{margin-left:0;padding:18px 14px 50px;width:100%;min-width:0}
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
  .qd-anchor-meta{width:100%;padding-left:42px}
  .qd-anchor-schedule-editor{padding:8px 7px}
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

/* TASK TIME LEARNING */
.qd-task-timing{display:flex;align-items:center;gap:5px;flex-wrap:wrap;font-size:9px}
.qd-time-chip{border:1px solid rgba(203,166,106,.25);background:rgba(203,166,106,.07);color:#d8c6a6;padding:3px 6px;border-radius:999px;white-space:nowrap}
.qd-time-chip.actual{border-color:rgba(126,197,160,.28);background:rgba(126,197,160,.08);color:#a8d9bc}
.qd-time-hint{grid-column:1/-1;color:#a391c6;font-size:10px;font-family:'Cormorant Garamond',serif;font-style:italic;margin-top:-2px}
.qd-estimate-field{display:flex;align-items:center;gap:6px;min-width:0}
.qd-estimate-field input{width:78px!important;flex:0 0 78px!important}
.qd-estimate-unit{font-size:10px;color:var(--dim);white-space:nowrap}
.qd-completion-backdrop{position:fixed;inset:0;z-index:100000;background:rgba(3,7,16,.82);backdrop-filter:blur(10px);display:grid;place-items:center;padding:18px}
.qd-completion-card{width:min(430px,94vw);background:linear-gradient(180deg,#0c1930,#07111f);border:1px solid var(--gold);box-shadow:0 24px 80px rgba(0,0,0,.55),0 0 50px rgba(139,92,246,.14);padding:24px;position:relative}
.qd-completion-card::before{content:"";position:absolute;inset:6px;border:1px solid rgba(203,166,106,.12);pointer-events:none}
.qd-completion-kicker{font-family:'Cinzel',serif;color:var(--gold);font-size:10px;letter-spacing:.15em;text-transform:uppercase;position:relative;z-index:1}
.qd-completion-title{font-family:'Cinzel',serif;color:#f2e4ca;font-size:20px;margin-top:7px;position:relative;z-index:1}
.qd-completion-quest{color:var(--dim);font-size:11px;margin-top:4px;position:relative;z-index:1}
.qd-completion-estimate{margin-top:18px;border:1px solid var(--line-soft);background:rgba(11,25,44,.68);padding:10px 12px;color:#d6c7aa;font-size:11px;position:relative;z-index:1}
.qd-completion-label{display:block;color:#d9dfea;font-size:11px;margin:16px 0 6px;position:relative;z-index:1}
.qd-completion-input-wrap{display:flex;align-items:center;gap:8px;position:relative;z-index:1}
.qd-completion-input{width:120px;background:#0a1729;border:1px solid var(--line);color:var(--text);padding:10px 11px;border-radius:4px;font-size:18px}
.qd-completion-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:20px;position:relative;z-index:1}
.qd-completion-actions button{border:1px solid var(--line);background:transparent;color:var(--text);padding:9px 12px;cursor:pointer}
.qd-completion-actions .primary{background:linear-gradient(180deg,#7e5bd8,#5b3eaa);border-color:#a88cf1;color:#fff;font-weight:700}
.qd-completion-actions .primary:disabled{opacity:.4;cursor:not-allowed}

/* VOYAGE ADJUSTMENT */
.qd-voyage-adjust-bar{margin:0 0 18px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:linear-gradient(90deg,rgba(64,47,116,.34),rgba(8,21,39,.82));border:1px solid rgba(167,133,226,.30);box-shadow:0 12px 28px rgba(0,0,0,.16)}
.qd-voyage-adjust-copy{min-width:0}.qd-voyage-adjust-title{font-family:'Cinzel',serif;font-size:12px;color:#eee1c7;letter-spacing:.06em}.qd-voyage-adjust-sub{font-family:'Cormorant Garamond',serif;font-style:italic;color:var(--dim);font-size:15px;margin-top:3px}
.qd-voyage-adjust-actions{display:flex;gap:7px;flex-wrap:wrap}.qd-voyage-adjust-btn,.qd-voyage-restore-btn{border:1px solid rgba(203,166,106,.38);background:rgba(10,22,40,.78);color:#f0dfbf;padding:9px 12px;cursor:pointer}.qd-voyage-adjust-btn{background:linear-gradient(180deg,rgba(126,91,216,.82),rgba(80,55,151,.88));border-color:#a88cf1;color:#fff;font-weight:700}.qd-voyage-restore-btn{color:var(--dim)}
.qd-voyage-status{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(139,92,246,.35);background:rgba(91,62,170,.17);color:#d8caff;padding:4px 7px;border-radius:999px;font-size:9px;margin-left:7px}
.qd-flex-chip{font-size:9px;border:1px solid rgba(126,145,178,.24);padding:3px 6px;border-radius:999px;color:#9fb0ca;white-space:nowrap}.qd-flex-chip.fixed{border-color:rgba(203,166,106,.34);color:#d7bd90;background:rgba(203,166,106,.07)}
.qd-voyage-modal-backdrop{position:fixed;inset:0;z-index:100001;background:rgba(3,7,16,.88);backdrop-filter:blur(13px);display:grid;place-items:center;padding:16px;overflow:auto}
.qd-voyage-modal{width:min(720px,96vw);max-height:94vh;overflow:auto;background:linear-gradient(180deg,#0b1930,#06101d);border:1px solid var(--gold);box-shadow:0 28px 90px rgba(0,0,0,.62),0 0 55px rgba(139,92,246,.14);padding:24px;position:relative}.qd-voyage-modal::before{content:'';position:absolute;inset:6px;border:1px solid rgba(203,166,106,.12);pointer-events:none}
.qd-voyage-modal-head{position:relative;z-index:1}.qd-voyage-modal-kicker{font-family:'Cinzel',serif;color:var(--gold);font-size:10px;letter-spacing:.15em;text-transform:uppercase}.qd-voyage-modal-title{font-family:'Cinzel',serif;color:#f2e4ca;font-size:24px;margin-top:6px}.qd-voyage-modal-sub{font-family:'Cormorant Garamond',serif;font-style:italic;color:var(--dim);font-size:16px;margin-top:5px;line-height:1.35}
.qd-voyage-memory{margin-top:12px;padding:9px 11px;border-left:2px solid rgba(139,92,246,.5);background:rgba(79,53,143,.12);color:#bcb3cf;font-size:10px}
.qd-voyage-section{position:relative;z-index:1;margin-top:18px}.qd-voyage-label{display:block;font-size:10px;color:#cfd6e4;margin-bottom:7px;font-weight:700;letter-spacing:.03em}.qd-voyage-mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.qd-voyage-mode{border:1px solid var(--line-soft);background:rgba(10,23,41,.72);padding:13px;text-align:left;color:var(--text);cursor:pointer}.qd-voyage-mode.active{border-color:#9f83ed;background:linear-gradient(180deg,rgba(95,65,172,.30),rgba(13,26,47,.82));box-shadow:inset 0 0 20px rgba(139,92,246,.08)}.qd-voyage-mode strong{font-family:'Cinzel',serif;font-size:12px;color:#eadcc1;display:block}.qd-voyage-mode span{font-size:10px;color:var(--dim);display:block;margin-top:4px;line-height:1.35}
.qd-voyage-field{width:100%;background:#0a1729;border:1px solid var(--line);color:var(--text);padding:10px;border-radius:4px}.qd-voyage-capacity{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.qd-capacity-btn{border:1px solid var(--line-soft);background:#091729;color:#bec7d8;padding:10px 6px;cursor:pointer}.qd-capacity-btn.active{border-color:#a88cf1;background:#513b91;color:#fff}.qd-voyage-note-input{min-height:70px;resize:vertical}
.qd-voyage-preview{border:1px solid rgba(139,92,246,.28);background:rgba(65,45,118,.12);padding:13px}.qd-voyage-preview-top{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;text-align:center}.qd-voyage-preview-num{font-family:'Cinzel',serif;font-size:20px;color:#efdfbf}.qd-voyage-preview-label{font-size:9px;color:var(--dim);margin-top:2px}.qd-voyage-arrow{color:var(--gold);font-size:18px}.qd-voyage-moves{margin-top:12px;display:flex;flex-direction:column;gap:6px}.qd-voyage-move{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:8px 9px;background:rgba(8,20,37,.72);border:1px solid var(--line-soft);font-size:10px}.qd-voyage-move strong{color:#e8dcc6}.qd-voyage-move span{color:var(--dim);white-space:nowrap}.qd-voyage-warning{margin-top:8px;padding:8px 10px;border:1px solid rgba(214,111,116,.28);background:rgba(128,54,61,.10);color:#dfb6b9;font-size:10px;line-height:1.4}
.qd-voyage-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px;position:relative;z-index:1}.qd-voyage-modal-actions button{border:1px solid var(--line);background:transparent;color:var(--text);padding:10px 13px;cursor:pointer}.qd-voyage-modal-actions .primary{background:linear-gradient(180deg,#7e5bd8,#5b3eaa);border-color:#a88cf1;color:#fff;font-weight:700}.qd-voyage-modal-actions .primary:disabled{opacity:.38;cursor:not-allowed}
.qd-reward-paused{margin-top:8px;padding:7px 8px;border:1px solid rgba(203,166,106,.22);background:rgba(203,166,106,.06);color:#cdb892;font-size:9px;text-align:center}

.qd-root.qd-safe-harbor::before{filter:grayscale(1) saturate(0) brightness(.58);opacity:1}
.qd-root.qd-safe-harbor::after{background:rgba(0,0,0,.42);mix-blend-mode:multiply}
/* Keep the astrolabe clock alive in color while the rest of the paused voyage fades.
   Do NOT grayscale an ancestor of the clock or fixed task rows, because a child cannot
   undo an ancestor CSS filter. */
.qd-root.qd-safe-harbor .qd-sidebar,
.qd-root.qd-safe-harbor .qd-topbar,
.qd-root.qd-safe-harbor .qd-voyage-adjust-bar,
.qd-root.qd-safe-harbor .qd-safe-harbor-banner,
.qd-root.qd-safe-harbor .qd-dashboard-grid>.qd-voyage,
.qd-root.qd-safe-harbor .qd-anchor-panel,
.qd-root.qd-safe-harbor .qd-side-stack,
.qd-root.qd-safe-harbor .qd-section,
.qd-root.qd-safe-harbor .qd-reset-card,
.qd-root.qd-safe-harbor .qd-footer{filter:grayscale(1) saturate(0);transition:filter .35s ease}
.qd-root.qd-safe-harbor .qd-voyage-adjust-bar{background:linear-gradient(90deg,rgba(50,50,50,.78),rgba(9,13,18,.92));border-color:rgba(220,220,220,.28)}
.qd-root.qd-safe-harbor .qd-today-panel{background:linear-gradient(180deg,rgba(18,18,18,.90),rgba(8,10,13,.94));border-color:rgba(210,210,210,.20)}
.qd-root.qd-safe-harbor .qd-today-panel .qd-panel-head,
.qd-root.qd-safe-harbor .qd-today-harbor-note,
.qd-root.qd-safe-harbor .qd-today-task:not(.qd-safe-fixed-task),
.qd-root.qd-safe-harbor .qd-today-panel .qd-empty{filter:grayscale(1) saturate(0);opacity:.72}
.qd-root.qd-safe-harbor .qd-today-task.qd-safe-fixed-task{position:relative;margin:3px 0;padding:10px 9px;border:1px solid color-mix(in srgb,var(--safe-accent,#cba66a) 42%,transparent);border-left:3px solid var(--safe-accent,#cba66a);background:linear-gradient(90deg,color-mix(in srgb,var(--safe-accent,#8b5cf6) 18%,transparent),rgba(10,20,36,.54));box-shadow:0 0 20px color-mix(in srgb,var(--safe-accent,#8b5cf6) 14%,transparent)}
.qd-root.qd-safe-harbor .qd-today-task.qd-safe-fixed-task .qd-today-name{color:#f5ecdf}
.qd-root.qd-safe-harbor .qd-today-task.qd-safe-fixed-task .qd-today-check{border-color:var(--safe-accent,#cba66a);box-shadow:0 0 12px color-mix(in srgb,var(--safe-accent,#8b5cf6) 28%,transparent)}
.qd-root.qd-safe-harbor .qd-today-task.qd-safe-fixed-task .qd-today-xp{color:#d9c8ff}
.qd-clock-item.qd-safe-muted{filter:grayscale(1) saturate(0);opacity:.46}
.qd-clock-item.qd-safe-active{border-color:rgba(203,166,106,.34);background:linear-gradient(90deg,rgba(79,53,143,.18),rgba(12,24,43,.76));box-shadow:inset 3px 0 0 rgba(203,166,106,.48)}
.qd-anchor-choice-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.qd-anchor-choice-btn{border:1px solid var(--line-soft);background:#091729;color:#bec7d8;padding:10px 7px;cursor:pointer;text-align:center}
.qd-anchor-choice-btn.active{border-color:#a88cf1;background:#513b91;color:#fff}
.qd-anchor-picks{margin-top:9px;display:flex;flex-direction:column;gap:6px}
.qd-anchor-pick{display:flex;align-items:center;gap:9px;padding:9px 10px;border:1px solid var(--line-soft);background:rgba(10,23,41,.66);cursor:pointer;color:#d7deeb;font-size:11px}
.qd-anchor-pick input{accent-color:#8b5cf6}.qd-anchor-pick span{flex:1}.qd-anchor-pick-time{flex:0 0 auto!important;color:var(--gold);font-size:9px}
.qd-anchor-choice-note{margin-top:7px;color:#9fa9bc;font-size:9px;line-height:1.35}
.qd-safe-harbor-banner{margin:-6px 0 18px;padding:16px;border:1px solid rgba(230,230,230,.28);background:linear-gradient(180deg,rgba(18,18,18,.88),rgba(5,8,12,.94));box-shadow:0 18px 36px rgba(0,0,0,.28);display:flex;align-items:flex-start;gap:12px}
.qd-safe-harbor-icon{font-size:28px;line-height:1}
.qd-safe-harbor-copy{min-width:0;flex:1}.qd-safe-harbor-title{font-family:'Cinzel',serif;letter-spacing:.12em;font-size:13px;color:#f0f0f0}.qd-safe-harbor-text{font-family:'Cormorant Garamond',serif;font-size:16px;color:#bcbcbc;margin-top:4px;line-height:1.35}.qd-safe-harbor-text strong{color:#f1f1f1}
.qd-today-harbor-note{margin:10px 14px 0;padding:9px 10px;border:1px dashed rgba(210,210,210,.24);background:rgba(255,255,255,.025);color:#bdbdbd;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:14px}
.qd-task-harbor-tag{display:inline-flex;margin-left:6px;padding:2px 5px;border:1px solid rgba(220,220,220,.24);border-radius:999px;font-size:8px;color:#c8c8c8;text-transform:uppercase;letter-spacing:.04em}
.qd-dot.paused{opacity:.26;border-style:dashed;cursor:not-allowed;box-shadow:none}.qd-dot.paused:hover{border-color:rgba(126,145,178,.28)}
.qd-anchor-paused-note{font-size:9px;color:#8f8f8f;font-style:italic;margin-left:5px}

@media(max-width:900px){.qd-task-edit-row{grid-template-columns:minmax(0,1fr) 74px}.qd-task-edit-actions{grid-column:1/-1;justify-content:flex-end}.qd-task-edit-row>select{grid-column:1/-1}}
@media(max-width:520px){.qd-task-edit-row{display:flex;flex-direction:column;align-items:stretch}.qd-task-date-edit{display:grid;grid-template-columns:1fr auto auto}.qd-task-edit-actions{width:100%;justify-content:stretch}.qd-task-edit-actions button{flex:1}.qd-task-edit-btn{padding:5px 7px}.qd-xp-caption{font-size:9px}.qd-estimate-field{width:100%}.qd-estimate-field input{width:100%!important;flex:1!important}.qd-completion-card{padding:20px 16px}.qd-completion-actions{flex-direction:column-reverse}.qd-completion-actions button{width:100%}}
@media(max-width:640px){.qd-voyage-adjust-bar{margin-bottom:12px;padding:10px}.qd-voyage-adjust-actions{width:100%}.qd-voyage-adjust-actions button{flex:1}.qd-safe-harbor-banner{margin:-2px 0 12px;padding:12px;gap:9px}.qd-safe-harbor-icon{font-size:23px}.qd-safe-harbor-title{font-size:11px}.qd-safe-harbor-text{font-size:14px}.qd-voyage-modal{padding:20px 14px}.qd-voyage-modal-title{font-size:20px}.qd-voyage-mode-grid{grid-template-columns:1fr}.qd-voyage-preview-top{grid-template-columns:1fr}.qd-voyage-arrow{transform:rotate(90deg)}.qd-voyage-capacity{grid-template-columns:repeat(3,1fr)}.qd-anchor-choice-grid{grid-template-columns:1fr}.qd-voyage-modal-actions{flex-direction:column-reverse}.qd-voyage-modal-actions button{width:100%}.qd-voyage-move{grid-template-columns:1fr}.qd-voyage-move span{white-space:normal}}
`;

const PIXEL_CSS = `
.qd-root{
  --bg:#061b25;--panel:#082237;--panel-2:#0b2b43;--line:#40627b;
  --line-soft:rgba(91,139,169,.28);--gold:#ffb552;--gold-bright:#ffd17c;
  --purple:#75bde8;--purple-2:#a9daf5;--blue:#79b9dd;--text:#f5f1df;
  --dim:#a9c4d5;--red:#e87a66;--green:#8be36f;
  font-family:'VT323',monospace;font-size:20px;letter-spacing:.02em;
  background:radial-gradient(circle at 15% 10%,rgba(17,86,83,.34),transparent 34%),linear-gradient(180deg,#061a2c 0%,#073038 56%,#082d2e 100%);
  padding-bottom:96px;
}
.qd-root::before{position:fixed;background:linear-gradient(90deg,rgba(255,255,255,.012) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.012) 1px,transparent 1px),radial-gradient(circle at 50% 0,rgba(14,82,99,.24),transparent 60%);background-size:4px 4px,4px 4px,auto;opacity:1}
.qd-root::after{background:linear-gradient(180deg,transparent 0%,rgba(1,15,23,.2) 62%,rgba(1,15,23,.55) 100%);mix-blend-mode:normal}
.qd-root button,.qd-root input,.qd-root select,.qd-root textarea{font-family:'VT323',monospace;font-size:18px}
.qd-shell{max-width:1240px;padding:0 18px 42px}
.qd-main{margin-left:0;padding:24px 0 74px;display:flex;flex-direction:column;gap:18px}

.qd-scene{min-height:420px;position:relative;overflow:hidden;border:4px solid #132a38;outline:2px solid #55788d;box-shadow:0 0 0 5px #071927,0 20px 45px rgba(0,0,0,.38);background-image:linear-gradient(180deg,rgba(2,18,36,.12) 0%,rgba(2,20,30,.05) 53%,rgba(4,24,30,.62) 100%),url('/pixel-garden-hero.webp');background-position:center;background-size:cover;image-rendering:pixelated}
.qd-garden-scene{display:none}
.qd-scene::after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 70px rgba(1,9,18,.42)}
.qd-topbar{position:relative;z-index:2;margin:0;padding:34px 38px;align-items:flex-start}
.qd-scene-copy{padding:16px 18px;background:linear-gradient(90deg,rgba(3,20,36,.84),rgba(3,20,36,.25),transparent);text-shadow:3px 3px 0 #061522}
.qd-greeting-kicker{font-family:'Press Start 2P',monospace;font-size:12px;line-height:1.7;color:#f6f2e5;letter-spacing:.04em}
.qd-greeting{font-family:'Press Start 2P',monospace;font-size:clamp(25px,4vw,44px);line-height:1.3;letter-spacing:.03em;margin-top:6px;color:#fff}
.qd-greeting span{font-size:.65em;text-shadow:none}
.qd-greeting-sub{font-family:'VT323',monospace;font-style:normal;font-size:24px;line-height:1.05;color:#edf5f4;max-width:270px;margin-top:7px}
.qd-topmeta{max-width:310px}
.qd-meta-pill{border-radius:0;padding:14px 16px;border:3px solid #6d3f2a;outline:2px solid #25191a;background:linear-gradient(180deg,#75432c,#4c2d24);box-shadow:inset 0 0 0 2px rgba(255,184,95,.16),4px 5px 0 rgba(3,13,21,.6);color:#ffd586;font-family:'Press Start 2P',monospace;font-size:11px;line-height:1.6;text-transform:uppercase}
.qd-date-card span{margin-right:8px;color:#ffb45c}
.qd-level-card{position:absolute;z-index:3;left:8%;right:8%;bottom:20px;display:grid;grid-template-columns:auto minmax(120px,1fr) auto;gap:16px;align-items:center;padding:15px 20px;border:4px solid #422c24;outline:3px solid #071927;background:linear-gradient(180deg,#6c412c,#3b2925);box-shadow:inset 0 0 0 2px #a35f38,0 8px 0 rgba(2,15,22,.7);font-family:'Press Start 2P',monospace}
.qd-level-badge{padding:8px 12px;background:#1e2430;color:#fff;border:2px solid #18141a;font-size:13px;white-space:nowrap}
.qd-level-track{height:24px;padding:3px;background:#122738;border:3px solid #201d22;box-shadow:inset 0 3px 0 rgba(0,0,0,.4)}
.qd-level-fill{height:100%;min-width:3px;background:linear-gradient(180deg,#99ed73,#4ba94d);border-top:3px solid #c0ff91;box-shadow:0 0 12px rgba(111,224,92,.35)}
.qd-level-value{font-size:12px;color:#fff0cf;white-space:nowrap}

.qd-panel,.qd-quest,.qd-voyage-adjust-bar,.qd-safe-harbor-banner,.qd-reset-card{border:3px solid #142b3b;outline:2px solid #4e7188;background:linear-gradient(180deg,rgba(8,37,59,.97),rgba(5,27,45,.98));box-shadow:inset 0 0 0 2px rgba(112,168,198,.08),5px 7px 0 rgba(2,15,23,.62);border-radius:0}
.qd-panel::before{inset:5px;border:1px solid rgba(124,177,207,.14)}
.qd-panel-head{padding:18px 20px 10px;border-bottom:2px solid rgba(76,115,139,.28)}
.qd-panel-title,.qd-section h2,.qd-reset-title{font-family:'Press Start 2P',monospace;font-size:14px;line-height:1.55;letter-spacing:0;color:#fff8e6;text-shadow:2px 2px 0 #06141f}
.qd-panel-sub,.qd-section-tag{font-family:'VT323',monospace;font-style:normal;font-size:19px;line-height:1.1;color:#9fc1d4}
.qd-dim{color:#9fc1d4}
.qd-dashboard-grid{grid-template-columns:minmax(380px,1.08fr) minmax(320px,.92fr);gap:20px}
.qd-lower-grid{grid-template-columns:minmax(300px,1.08fr) minmax(300px,1fr) minmax(320px,.92fr);gap:20px;margin-top:2px}
.qd-side-stack{gap:20px}

.qd-voyage-adjust-bar{margin:0;padding:16px 18px;background:linear-gradient(180deg,#9b513c,#6d3d31);outline-color:#d07b4d;border-color:#3e2926;box-shadow:inset 0 0 0 2px rgba(255,189,124,.17),5px 7px 0 rgba(2,15,23,.62)}
.qd-voyage-adjust-title{font-family:'Press Start 2P',monospace;font-size:12px;color:#fff3dd}
.qd-voyage-adjust-sub{font-family:'VT323',monospace;font-size:19px;color:#f5d8c4}
.qd-voyage-adjust-btn,.qd-voyage-restore-btn{border:2px solid #4c3028!important;border-radius:0!important;background:#fff1df!important;color:#603829!important;padding:10px 14px!important;font-family:'Press Start 2P',monospace!important;font-size:9px!important;line-height:1.5!important;box-shadow:3px 3px 0 rgba(53,30,26,.55)}
.qd-voyage-status{font-family:'VT323',monospace;font-size:18px}

.qd-clock{background:radial-gradient(circle at 50% 40%,rgba(28,85,104,.55),rgba(5,27,45,.98) 70%);padding:14px 18px 18px}
.qd-clock-nav{font-family:'Press Start 2P',monospace;font-size:10px;color:#eef8f5}
.qd-clock-nav button{border-radius:0;border:2px solid #476c85;background:#0a2a43;color:#ffd071;box-shadow:2px 2px 0 #04151f}
.qd-clock-outer{stroke:#79aac5;stroke-width:3}.qd-clock-ring{stroke:rgba(101,166,199,.48)}
.qd-clock-ring-purple{stroke:#f0b85d;filter:drop-shadow(0 0 4px rgba(240,184,93,.45))}
.qd-clock-tick.major,.qd-clock-hand{stroke:#ffd071}.qd-clock-center{fill:#82d66c;stroke:#c1fa97}
.qd-clock-time{font-family:'Press Start 2P',monospace;font-size:25px}
.qd-clock-date,.qd-clock-hour-small{font-family:'VT323',monospace;font-size:12px}
.qd-clock-item,.qd-machine,.qd-anchor{border:2px solid rgba(67,105,130,.45);background:#0b2b43}
.qd-clock-item{font-size:17px;padding:9px 11px}.qd-clock-item-time,.qd-clock-item-xp{font-size:15px}
.qd-voyage-stage,.qd-anchor-category,.qd-anchor-frequency,.qd-task-harbor-tag{border-radius:0}
.qd-voyage-stage{font-family:'VT323',monospace;font-size:17px;color:#9fe384;border-color:#4c7d68;background:#0c3a3b}
.qd-voyage-list{gap:13px}.qd-voyage-row{font-size:18px;grid-template-columns:28px minmax(120px,1fr) minmax(90px,1.2fr) 46px}
.qd-voyage-num{border-radius:0;color:#ffd071;border:2px solid #5d7890;background:#0b2a41}
.qd-voyage-bar,.qd-bar,.qd-xp-bar{height:12px;border:2px solid #13202a;background:#102838}
.qd-voyage-fill,.qd-bar-fill,.qd-xp-fill{background:linear-gradient(180deg,#9be779,#4aa94e)!important;box-shadow:none}
.qd-voyage-pct{font-size:16px;color:#a8c5d5}
.qd-voyage-note{font-family:'VT323',monospace;font-style:normal;font-size:19px;color:#c6e0e9;background:#0b3046;border:2px solid #355d74}

.qd-today-list{gap:7px;padding:12px 16px 18px}
.qd-today-task{grid-template-columns:34px 1fr auto;padding:11px 10px;border:2px solid rgba(64,99,123,.35);background:linear-gradient(90deg,#0d304a,#0a2941)}
.qd-today-check{width:28px;height:28px;border-radius:2px;border:3px solid #71a9c8;color:#fff;font-family:'Press Start 2P',monospace;font-size:11px}
.qd-today-task.done .qd-today-check{background:#55b85c;border-color:#a7ed7d;box-shadow:inset 0 0 0 2px #2a7b43}
.qd-today-name{font-family:'VT323',monospace;font-size:22px;line-height:1}.qd-today-sub,.qd-today-xp{font-size:17px}.qd-today-xp{color:#8be36f}
.qd-anchors{gap:9px}.qd-anchor{padding:12px}
.qd-anchor-head>span:first-child,.qd-machine-icon{border-radius:2px;background:#102e43;border:2px solid #4a6c82}
.qd-anchor-title,.qd-machine-title{font-family:'Press Start 2P',monospace;font-size:10px;line-height:1.45;color:#fff4df}
.qd-anchor-head .qd-dim,.qd-anchor-category,.qd-anchor-frequency{font-size:15px}
.qd-dot{width:31px;height:31px;border-radius:2px;border:2px solid #45677e;background:#071f34;color:#9ab9cb;font-size:15px}
.qd-dot.on{background:#59b85e;border-color:#a9eb82;box-shadow:inset 0 0 0 2px #2e7b47;color:white}
.qd-anchor-actions button,.qd-quest-actions button{font-size:15px;border:2px solid #45677e;background:#0a2941;color:#b9d0dc}

.qd-xp-card{padding:18px}.qd-xp-number{font-family:'Press Start 2P',monospace;font-size:16px;color:#9be779}
.qd-xp-row-label{font-size:18px}.qd-xp-caption,.qd-reset-mini,.qd-machine-sub,.qd-machine-nums,.qd-reset-box{font-size:15px}
.qd-machine{padding:13px}.qd-machine-title{font-size:9px}
.qd-reel{font-family:'VT323',monospace;font-size:20px;background:#12364b;border:2px solid #45677e;color:#fff0d0}
.qd-spin-btn{border:3px solid #274b35;background:linear-gradient(180deg,#8bdc66,#45964b);color:#071b22;font-family:'Press Start 2P',monospace;font-size:9px;padding:10px;box-shadow:3px 3px 0 #071923}
.qd-chip{font-size:15px;border:2px solid #355b73;background:#0b2940}

.qd-section{margin-top:5px}.qd-section-heading{margin-bottom:12px}.qd-quest-grid{gap:18px}.qd-quest{padding:18px}.qd-quest::before{width:6px;box-shadow:none}
.qd-quest-title{font-family:'Press Start 2P',monospace;font-size:11px;line-height:1.5;color:#fff4df}
.qd-quest-narrative{font-family:'VT323',monospace;font-size:19px;font-style:normal}
.qd-quest-count,.qd-task-day,.qd-task-xp,.qd-flex-chip,.qd-time-chip{font-size:15px}.qd-task{font-size:18px;padding:9px 0}.qd-task button{font-size:16px}
.qd-add-btn{font-size:18px;border:2px dashed #61849a;color:#b9d4df;background:rgba(9,39,59,.7)}
.qd-anchor-edit input,.qd-anchor-edit select,.qd-add-task input,.qd-add-task select,.qd-add-row input,.qd-threshold-row input,.qd-reset-card select,.qd-voyage-field{border-radius:0;border:2px solid #45677e;background:#071f34;color:#f3f2e8}
.qd-anchor-edit button,.qd-add-task button,.qd-add-row button{border-radius:0;background:#79cf61;border:2px solid #356f3e;color:#071b22;box-shadow:2px 2px 0 #061720}
.qd-footer{font-family:'Press Start 2P',monospace;font-size:9px;color:#7fa7b8;letter-spacing:.08em}

.qd-sidebar{position:fixed;z-index:100;left:50%;right:auto;top:auto;bottom:14px;transform:translateX(-50%);width:min(760px,calc(100vw - 28px));height:76px;padding:0;background:linear-gradient(180deg,rgba(8,38,60,.98),rgba(4,25,42,.99));border:3px solid #122a3b;outline:2px solid #52758b;border-radius:0;box-shadow:inset 0 0 0 2px rgba(108,161,190,.09),0 8px 24px rgba(0,0,0,.55);animation:none;display:grid;grid-template-columns:1fr auto;gap:0}
.qd-brand,.qd-sidebar-quote{display:none}.qd-nav{display:grid;grid-template-columns:repeat(5,1fr);gap:0;height:100%;width:100%}
.qd-nav a{width:auto;height:100%;border-radius:0;border-right:2px solid rgba(66,103,128,.24);display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:center;font-family:'VT323',monospace;font-size:17px;color:#b4cddd;padding:6px}
.qd-nav a:hover{transform:none;background:#0e3b54}.qd-nav a.active{border-color:rgba(115,224,103,.42);background:linear-gradient(180deg,rgba(65,139,81,.26),rgba(7,31,48,.95));box-shadow:inset 0 4px 0 #83dd6d;color:#9bea79}
.qd-nav a.active::before{display:none}.qd-nav-icon{font-family:'Press Start 2P','Segoe UI Emoji',sans-serif;font-size:19px;color:#8eb3cb;line-height:1}
.qd-nav a.active .qd-nav-icon{color:#91e57b;text-shadow:0 0 8px rgba(117,224,100,.35)}
.qd-logout{width:46px;height:100%;border-radius:0;border:0;border-left:2px solid rgba(66,103,128,.3);font-size:0;color:#91aabc}.qd-logout::before{font-size:20px}

.qd-completion-card,.qd-voyage-modal,.qd-celebration{border-radius:0!important;border:3px solid #4e7188!important;background:linear-gradient(180deg,#0b2d47,#061d31)!important;box-shadow:0 0 0 4px #061723,12px 14px 0 rgba(0,0,0,.5)!important}
.qd-completion-title,.qd-voyage-modal-title,.qd-celebration-title{font-family:'Press Start 2P',monospace!important;font-size:15px!important;line-height:1.6!important}

@media(max-width:900px){
  .qd-shell{padding:0 14px 28px}.qd-main{padding-top:14px}.qd-scene{min-height:390px}
  .qd-dashboard-grid{grid-template-columns:1fr}.qd-lower-grid{grid-template-columns:1fr 1fr}
  .qd-side-stack{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr}.qd-quest-grid{grid-template-columns:1fr}
}
@media(max-width:640px){
  .qd-root{font-size:19px;padding-bottom:82px}.qd-shell{padding:0 13px 18px}.qd-main{gap:14px;padding:9px 0 62px}
  .qd-scene{min-height:430px;border-width:3px;outline-width:1px;background-position:45% center}
  .qd-topbar{padding:20px 16px;gap:10px;flex-direction:column}.qd-scene-copy{padding:11px 12px;max-width:86%}
  .qd-greeting-kicker{font-size:9px}.qd-greeting{font-size:25px}.qd-greeting-sub{font-size:21px;max-width:220px}
  .qd-topmeta{position:absolute;right:14px;top:18px;max-width:170px}.qd-meta-pill{padding:9px 10px;font-size:8px}
  .qd-level-card{left:10px;right:10px;bottom:13px;grid-template-columns:auto 1fr;gap:9px;padding:10px 11px}
  .qd-level-badge{font-size:9px;padding:7px 8px}.qd-level-track{height:19px}.qd-level-value{grid-column:1/-1;text-align:right;font-size:8px;margin-top:-3px}
  .qd-panel,.qd-quest,.qd-voyage-adjust-bar,.qd-safe-harbor-banner,.qd-reset-card{border-width:2px;outline-width:1px;box-shadow:3px 5px 0 rgba(2,15,23,.62)}
  .qd-dashboard-grid,.qd-lower-grid{display:flex;flex-direction:column;gap:14px;margin-top:0}
  .qd-lower-grid .qd-anchor-panel{order:1}.qd-lower-grid .qd-today-panel{order:2}.qd-lower-grid .qd-side-stack{order:3;display:flex}
  .qd-panel-head{padding:14px 14px 9px}.qd-panel-title,.qd-section h2,.qd-reset-title{font-size:11px}.qd-panel-sub{font-size:17px}
  .qd-clock{padding:10px 8px 14px}.qd-clock-svg{width:min(100%,390px)}.qd-clock-list{max-height:240px}
  .qd-voyage-list{padding:12px 12px 16px}.qd-voyage-row{grid-template-columns:24px minmax(90px,1fr) 80px 38px;font-size:16px;gap:6px}.qd-voyage-note{margin:0 12px}
  .qd-today-list,.qd-anchors,.qd-machines{padding-left:10px;padding-right:10px}.qd-today-name{font-size:20px}.qd-today-sub,.qd-today-xp{font-size:15px}
  .qd-anchor-week{justify-content:flex-start}.qd-dot{width:29px;height:29px}.qd-quest{padding:14px}
  .qd-sidebar{bottom:7px;width:calc(100vw - 12px);height:68px;grid-template-columns:1fr}.qd-nav a{font-size:14px;gap:4px;padding:4px 1px}.qd-nav-icon{font-size:17px}.qd-logout{display:none}
  .qd-voyage-adjust-bar{padding:13px;gap:10px}.qd-voyage-adjust-title{font-size:9px}.qd-voyage-adjust-sub{font-size:17px}.qd-voyage-adjust-actions{width:100%}.qd-voyage-adjust-actions button{width:100%}
}

/* iPhone top scene — composed to mirror the supplied reference. */
.qd-date-card{display:flex;flex-direction:column;align-items:center;gap:5px}
.qd-date-main{display:flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap}
.qd-journey-day{display:flex;align-items:center;justify-content:center;gap:5px;font-family:'VT323',monospace;font-size:17px;line-height:1;color:#ffd17c;text-transform:none;white-space:nowrap}
.qd-journey-day span{margin:0;font-size:14px}

@media(max-width:640px){
  .qd-main{padding-top:0}
  .qd-scene{
    width:calc(100% + 26px);
    height:auto;
    aspect-ratio:960 / 804;
    min-height:318px;
    margin:0 -13px -1px;
    border:0;
    outline:0;
    box-shadow:none;
    background:#041e40;
  }
  .qd-scene::after{
    z-index:1;
    background:
      linear-gradient(180deg,transparent 88%,rgba(10,40,51,.52) 96%,#0a2833 100%),
      linear-gradient(180deg,rgba(1,16,34,.16) 0%,transparent 42%,rgba(2,21,27,.08) 76%,rgba(4,24,29,.24) 100%);
    box-shadow:none;
  }
  .qd-garden-scene{
    display:block;
    position:absolute;
    z-index:0;
    inset:0;
    width:100%;
    height:100%;
    overflow:hidden;
    pointer-events:none;
    image-rendering:pixelated;
  }
  .qd-topbar{position:absolute;inset:0;display:block;margin:0;padding:0}
  .qd-scene-copy{
    position:absolute;
    z-index:3;
    left:clamp(22px,7vw,32px);
    top:max(35px,calc(env(safe-area-inset-top) + 10px));
    width:155px;
    max-width:43%;
    padding:0;
    background:none;
    text-shadow:2px 2px 0 #061522;
  }
  .qd-greeting-kicker{font-size:8px;line-height:1.55;letter-spacing:.015em;white-space:nowrap}
  .qd-greeting{font-size:20px;line-height:1.35;letter-spacing:.01em;margin-top:1px;white-space:nowrap}
  .qd-greeting span{font-size:14px;vertical-align:2px}
  .qd-greeting-sub{font-size:16px;line-height:.92;max-width:130px;margin-top:3px;color:#f1f5f2}
  .qd-topmeta{
    position:absolute;
    z-index:3;
    right:clamp(8px,2.6vw,12px);
    top:max(34px,calc(env(safe-area-inset-top) + 9px));
    width:108px;
    max-width:34%;
  }
  .qd-scene .qd-meta-pill{
    width:100%;
    padding:7px 6px 6px;
    border:3px solid #6f422c;
    outline:2px solid #261a19;
    background:linear-gradient(180deg,#74432d,#4e2d24);
    box-shadow:inset 0 0 0 2px rgba(255,185,95,.14),3px 4px 0 rgba(2,13,21,.64);
    font-size:6px;
    line-height:1.25;
  }
  .qd-date-main{gap:4px}
  .qd-date-main span{margin:0;color:#ffb45c;font-size:8px}
  .qd-journey-day{gap:3px;font-size:13px}
  .qd-journey-day span{font-size:10px}
  .qd-level-card{
    left:8.5%;
    right:8.5%;
    bottom:5px;
    height:auto;
    aspect-ratio:1043 / 126;
    grid-template-columns:43px minmax(0,1fr) 84px;
    gap:8px;
    padding:9px 15px;
    border:0;
    outline:0;
    background:url('/xp-frame-mobile.png') center / 100% 100% no-repeat;
    box-shadow:none;
    image-rendering:pixelated;
  }
  .qd-level-card::before{display:none}
  .qd-level-card>*{position:relative;z-index:1}
  .qd-level-badge{
    display:flex;
    align-items:center;
    justify-content:center;
    height:22px;
    padding:1px 2px 0;
    border:2px solid #171519;
    background:#24232b;
    box-shadow:inset 0 2px 0 rgba(255,255,255,.035);
    overflow:hidden;
    font-size:7px;
    line-height:1;
    text-align:center;
  }
  .qd-level-track{
    height:13px;
    padding:1px;
    border:2px solid #17191d;
    background:#112733;
    box-shadow:inset 0 2px 0 rgba(0,0,0,.42);
  }
  .qd-level-fill{
    border-top:2px solid #c4ff9d;
    background:linear-gradient(180deg,#9aee73 0 42%,#58bd55 43% 100%);
    box-shadow:inset -2px 0 0 #3c9446,0 0 7px rgba(111,224,92,.42);
  }
  .qd-level-value{
    grid-column:auto;
    margin:0;
    padding:0 4px 0 0;
    text-align:right;
    max-width:100%;
    overflow:hidden;
    font-size:6px;
    letter-spacing:-.03em;
    line-height:1.2;
    white-space:nowrap;
  }
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
  now,
  safeHarbor = false,
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
          const keepColor = !safeHarbor || !!item.safeHarborHighlight;
          const markerFill = keepColor
            ? item.done
              ? "#7ec5a0"
              : isAnchor
              ? "#cba66a"
              : item.domainColor || "#8b5cf6"
            : "#666a70";
          return (
            <g
              key={item.clockKey}
              onClick={() => onToggle(item)}
              style={{ cursor: "pointer", opacity: keepColor ? 1 : 0.38 }}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={isAnchor ? 9 : 10}
                fill={markerFill}
                className="qd-clock-dot"
              />
              <text
                x={p.x}
                y={p.y - 16}
                textAnchor="middle"
                fill={keepColor ? "#eee7f5" : "#8a8a8a"}
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
            className={
              "qd-clock-item" +
              (item.done ? " done" : "") +
              (safeHarbor
                ? item.safeHarborHighlight
                  ? " qd-safe-active"
                  : " qd-safe-muted"
                : "")
            }
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
            {item.sourceType === "task" && item.estimatedMinutes && (
              <span className="qd-time-chip">~{formatMinutes(item.estimatedMinutes)}</span>
            )}
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
  voyageAdjustments = {},
}) {
  const [editing, setEditing] = useState(false);

  const [emoji, setEmoji] = useState(anchor.emoji);
  const [name, setName] = useState(anchor.name);
  const [xp, setXp] = useState(anchor.xpPerDay);
  const [category, setCategory] = useState(anchor.category || "");
  const [activeWeekdays, setActiveWeekdays] = useState(() => getAnchorWeekdays(anchor));
  const [hour, setHour] = useState(
    anchor.hour === null || anchor.hour === undefined ? "" : String(anchor.hour)
  );

  useEffect(() => {
    setEmoji(anchor.emoji);
    setName(anchor.name);
    setXp(anchor.xpPerDay);
    setCategory(anchor.category || "");
    setActiveWeekdays(getAnchorWeekdays(anchor));
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
      category: normalizeAnchorCategory(category),
      activeWeekdays: normalizeAnchorWeekdays(activeWeekdays),
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

            <div className="qd-anchor-meta">
              <span
                className="qd-anchor-category"
                style={{
                  color: getAnchorCategoryColor(anchor.category),
                  border: `1px solid ${getAnchorCategoryColor(anchor.category)}77`,
                  background: `${getAnchorCategoryColor(anchor.category)}14`,
                  boxShadow: `0 0 10px ${getAnchorCategoryColor(anchor.category)}14`,
                }}
              >
                {normalizeAnchorCategory(anchor.category)}
              </span>
              <span className="qd-anchor-frequency">{getAnchorDaysPerWeek(anchor)} days/week</span>
            </div>

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

          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category — e.g. Sport, Lifestyle"
            title="Write your own category"
            style={{ borderColor: `${getAnchorCategoryColor(category)}88`, boxShadow: `inset 3px 0 0 ${getAnchorCategoryColor(category)}` }}
          />

          <div className="qd-anchor-schedule-editor">
            <div className="qd-anchor-schedule-title">
              <span>Repeat on</span>
              <strong>{activeWeekdays.length} {activeWeekdays.length === 1 ? "day" : "days"}/week</strong>
            </div>
            <div className="qd-anchor-day-picks">
              {WEEKDAY_OPTIONS.map((dayOption) => {
                const active = activeWeekdays.includes(dayOption.value);
                return (
                  <button
                    key={dayOption.value}
                    type="button"
                    className={"qd-anchor-day-pick" + (active ? " active" : "")}
                    title={dayOption.label}
                    onClick={() =>
                      setActiveWeekdays((current) => {
                        if (current.includes(dayOption.value)) {
                          return current.length === 1
                            ? current
                            : current.filter((day) => day !== dayOption.value);
                        }
                        return [...current, dayOption.value].sort((a, b) => a - b);
                      })
                    }
                  >
                    {dayOption.short}
                  </button>
                );
              })}
            </div>
          </div>

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
        {weekDates.map((date, i) => {
          const adjustment = voyageAdjustments?.[date];
          const activeAnchorIds = getSafeHarborActiveAnchorIds(
            { anchors: [anchor] },
            adjustment
          );
          const isProtected =
            adjustment?.protectedKey === `anchor:${anchor.id}`;
          const keptInHarbor =
            activeAnchorIds.includes(anchor.id) || isProtected;
          const completed = !!anchor.history?.[date];
          const scheduled = isAnchorScheduledOn(anchor, date);
          const paused =
            scheduled &&
            adjustment?.mode === "harbor" &&
            !keptInHarbor &&
            !completed;
          const offSchedule = !scheduled && !completed;

          return (
            <button
              key={date}
              type="button"
              className={
                "qd-dot" +
                (completed ? " on" : "") +
                (paused ? " paused" : "") +
                (offSchedule ? " off" : "")
              }
              onClick={() => {
                if (!paused && !offSchedule) onToggle(anchor.id, date);
                if (completed && offSchedule) onToggle(anchor.id, date);
              }}
              disabled={paused || offSchedule}
              title={
                paused
                  ? `${date} · Safe Harbor — routine paused`
                  : offSchedule
                  ? `${date} · not scheduled for ${anchor.name}`
                  : `${date} · ${anchor.category || "General"}`
              }
            >
              {paused ? "—" : WEEKDAY_OPTIONS[i]?.short || "·"}
            </button>
          );
        })}
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
  const [category, setCategory] = useState("");
  const [activeWeekdays, setActiveWeekdays] = useState(() => WEEKDAY_OPTIONS.map((day) => day.value));
  const [hour, setHour] = useState("");

  const submit = () => {
    if (!name.trim()) return;

    onAdd({
      emoji: emoji || "⭐",
      name: name.trim(),
      xpPerDay: Math.max(1, Number(xp) || 1),
      category: normalizeAnchorCategory(category),
      activeWeekdays: normalizeAnchorWeekdays(activeWeekdays),
      hour:
        hour === "" || hour === null || hour === undefined
          ? null
          : Number(hour),
    });

    setEmoji("⭐");
    setName("");
    setXp(10);
    setCategory("");
    setActiveWeekdays(WEEKDAY_OPTIONS.map((day) => day.value));
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
        title="XP per completed day"
      />

      <input
        type="text"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Category — write your own"
        title="Write your own category"
        style={{ borderColor: `${getAnchorCategoryColor(category)}88`, boxShadow: `inset 3px 0 0 ${getAnchorCategoryColor(category)}` }}
      />

      <div className="qd-anchor-schedule-editor">
        <div className="qd-anchor-schedule-title">
          <span>Repeat on</span>
          <strong>{activeWeekdays.length} {activeWeekdays.length === 1 ? "day" : "days"}/week</strong>
        </div>
        <div className="qd-anchor-day-picks">
          {WEEKDAY_OPTIONS.map((dayOption) => {
            const active = activeWeekdays.includes(dayOption.value);
            return (
              <button
                key={dayOption.value}
                type="button"
                className={"qd-anchor-day-pick" + (active ? " active" : "")}
                title={dayOption.label}
                onClick={() =>
                  setActiveWeekdays((current) => {
                    if (current.includes(dayOption.value)) {
                      return current.length === 1
                        ? current
                        : current.filter((day) => day !== dayOption.value);
                    }
                    return [...current, dayOption.value].sort((a, b) => a - b);
                  })
                }
              >
                {dayOption.short}
              </button>
            );
          })}
        </div>
      </div>

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
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [estimateTouched, setEstimateTouched] = useState(false);
  const [flexibility, setFlexibility] = useState("flexible");

  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editXp, setEditXp] = useState(20);
  const [editDay, setEditDay] = useState("");
  const [editHour, setEditHour] = useState("");
  const [editEstimatedMinutes, setEditEstimatedMinutes] = useState("");
  const [editEstimateTouched, setEditEstimateTouched] = useState(false);
  const [editFlexibility, setEditFlexibility] = useState("flexible");

  const status = questStatus(domain, today);
  const learnedEstimate = getLearnedEstimate(domain, name);
  const learnedSamples = getTimingSampleCount(domain, name);

  const submitTask = () => {
    if (!name.trim()) return;

    const learned = getLearnedEstimate(domain, name);
    const finalEstimate =
      estimatedMinutes === "" || estimatedMinutes === null
        ? learned
        : Math.max(1, Number(estimatedMinutes) || 1);

    onAddTask({
      name: name.trim(),
      xp,
      day,
      hour,
      estimatedMinutes: finalEstimate,
      flexibility,
    });
    setName("");
    setXp(20);
    setDay("");
    setHour("");
    setEstimatedMinutes("");
    setEstimateTouched(false);
    setFlexibility("flexible");
    setShowAdd(false);
  };

  const startTaskEdit = (task) => {
    playSFX("click");
    setEditingTaskId(task.id);
    setEditName(task.name || "");
    setEditXp(Number(task.xp) || 10);
    setEditDay(task.day || "");
    setEditHour(task.hour === null || task.hour === undefined ? "" : String(task.hour));
    setEditEstimatedMinutes(
      task.estimatedMinutes ?? getLearnedEstimate(domain, task.name) ?? ""
    );
    setEditFlexibility(getTaskFlexibility(task));
    setEditEstimateTouched(false);
  };

  const cancelTaskEdit = () => {
    setEditingTaskId(null);
    setEditName("");
    setEditXp(20);
    setEditDay("");
    setEditHour("");
    setEditEstimatedMinutes("");
    setEditFlexibility("flexible");
    setEditEstimateTouched(false);
  };

  const saveTaskEdit = () => {
    if (!editingTaskId || !editName.trim()) return;

    const learned = getLearnedEstimate(domain, editName);

    onUpdateTask(editingTaskId, {
      name: editName.trim(),
      xp: Math.max(1, Number(editXp) || 1),
      day: editDay || null,
      hour: editHour === "" || editHour === null || editHour === undefined ? null : Number(editHour),
      estimatedMinutes:
        editEstimatedMinutes === "" || editEstimatedMinutes === null
          ? learned
          : Math.max(1, Number(editEstimatedMinutes) || 1),
      flexibility: editFlexibility,
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
                onChange={(e) => {
                  const nextName = e.target.value;
                  setEditName(nextName);
                  if (!editEstimateTouched) {
                    setEditEstimatedMinutes(
                      getLearnedEstimate(domain, nextName) ?? ""
                    );
                  }
                }}
              />

              <input
                type="number"
                min="1"
                value={editXp}
                aria-label="Task XP"
                onChange={(e) => setEditXp(e.target.value)}
              />

              <div className="qd-estimate-field" style={{ gridColumn: "1 / -1" }}>
                <input
                  type="number"
                  min="1"
                  step="5"
                  value={editEstimatedMinutes}
                  placeholder="Estimate"
                  aria-label="Estimated minutes"
                  onChange={(e) => {
                    setEditEstimatedMinutes(e.target.value);
                    setEditEstimateTouched(true);
                  }}
                />
                <span className="qd-estimate-unit">estimated minutes</span>
              </div>

              {getLearnedEstimate(domain, editName) && (
                <div className="qd-time-hint">
                  Learned estimate: about {formatMinutes(getLearnedEstimate(domain, editName))} from {getTimingSampleCount(domain, editName)} previous {getTimingSampleCount(domain, editName) === 1 ? "run" : "runs"}. You can override it.
                </div>
              )}

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

              <select
                value={editFlexibility}
                onChange={(e) => setEditFlexibility(e.target.value)}
                title="Can Quest move this task when your day changes?"
              >
                <option value="flexible">Flexible · can be rebalanced</option>
                <option value="fixed">Fixed · keep this date</option>
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
              <span className={"qd-flex-chip" + (getTaskFlexibility(t) === "fixed" ? " fixed" : "")}>
                {getTaskFlexibility(t) === "fixed" ? "Fixed" : "Flexible"}
              </span>

              {(t.estimatedMinutes || t.actualMinutes) && (
                <span className="qd-task-timing">
                  {t.estimatedMinutes && (
                    <span className="qd-time-chip">~{formatMinutes(t.estimatedMinutes)} est.</span>
                  )}
                  {t.actualMinutes && (
                    <span className="qd-time-chip actual">{formatMinutes(t.actualMinutes)} actual</span>
                  )}
                </span>
              )}

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
            onChange={(e) => {
              const nextName = e.target.value;
              setName(nextName);
              if (!estimateTouched) {
                setEstimatedMinutes(
                  getLearnedEstimate(domain, nextName) ?? ""
                );
              }
            }}
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

          <div className="qd-estimate-field">
            <input
              type="number"
              min="1"
              step="5"
              placeholder="Estimate"
              value={estimatedMinutes}
              aria-label="Estimated minutes"
              onChange={(e) => {
                setEstimatedMinutes(e.target.value);
                setEstimateTouched(true);
              }}
            />
            <span className="qd-estimate-unit">min estimate</span>
          </div>

          {learnedEstimate && (
            <div className="qd-time-hint" style={{ width: "100%" }}>
              Odyssey learned ~{formatMinutes(learnedEstimate)} for “{name.trim()}” in {domain.name} from {learnedSamples} previous {learnedSamples === 1 ? "run" : "runs"}.
            </div>
          )}

          <select
            value={flexibility}
            onChange={(e) => setFlexibility(e.target.value)}
            title="Can Quest move this task when your day changes?"
          >
            <option value="flexible">Flexible · Quest may rebalance it</option>
            <option value="fixed">Fixed · must stay on its date</option>
          </select>

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
// COMPLETION TIME MODAL
// ======================================================

function CompletionTimeModal({ task, domainName, onSave, onCancel }) {
  const [actualMinutes, setActualMinutes] = useState("");

  useEffect(() => {
    setActualMinutes("");
  }, [task?.id]);

  if (!task) return null;

  const numericActual = Number(actualMinutes);
  const canSave = Number.isFinite(numericActual) && numericActual > 0;

  return (
    <div className="qd-completion-backdrop" role="dialog" aria-modal="true" aria-labelledby="qd-completion-title">
      <div className="qd-completion-card">
        <div className="qd-completion-kicker">Voyage log</div>
        <div className="qd-completion-title" id="qd-completion-title">How long did it actually take?</div>
        <div className="qd-completion-quest">
          {domainName} · {task.name}
        </div>

        {task.estimatedMinutes && (
          <div className="qd-completion-estimate">
            Your estimate was <strong>{formatMinutes(task.estimatedMinutes)}</strong>.
          </div>
        )}

        <label className="qd-completion-label" htmlFor="qd-actual-minutes">
          Actual time
        </label>
        <div className="qd-completion-input-wrap">
          <input
            id="qd-actual-minutes"
            className="qd-completion-input"
            type="number"
            min="1"
            step="1"
            value={actualMinutes}
            autoFocus
            placeholder={task.estimatedMinutes ? String(task.estimatedMinutes) : "30"}
            onChange={(e) => setActualMinutes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) onSave(numericActual);
              if (e.key === "Escape") onCancel();
            }}
          />
          <span className="qd-estimate-unit">minutes</span>
        </div>

        <div className="qd-time-hint" style={{ marginTop: 10 }}>
          This actual time teaches Odyssey how long this exact task usually takes inside this quest.
        </div>

        <div className="qd-completion-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="primary"
            disabled={!canSave}
            onClick={() => onSave(numericActual)}
          >
            Save & complete
          </button>
        </div>
      </div>
    </div>
  );
}

// ======================================================
// VOYAGE ADJUSTMENT MODAL
// ======================================================

function VoyageAdjustmentModal({
  state,
  dateStr,
  onApply,
  onCancel,
}) {
  const [mode, setMode] = useState("reduced");
  const [capacityPct, setCapacityPct] = useState(50);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [protectedKey, setProtectedKey] = useState("");
  const scheduledAnchors = (state?.anchors || []).filter((anchor) =>
    isAnchorScheduledOn(anchor, dateStr)
  );
  const [anchorPlan, setAnchorPlan] = useState("all");
  const [selectedAnchorIds, setSelectedAnchorIds] = useState(() =>
    scheduledAnchors.map((anchor) => anchor.id)
  );

  const incompleteTasks = (state?.domains || []).flatMap((domain) =>
    (domain.tasks || [])
      .filter((task) => !task.done && task.day === dateStr)
      .map((task) => ({
        key: `task:${domain.id}:${task.id}`,
        label: `${domain.emoji || "⚔"} ${domain.name} · ${task.name}`,
      }))
  );

  const anchorOptions = scheduledAnchors.map((anchor) => ({
    key: `anchor:${anchor.id}`,
    label: `${anchor.emoji || "⚓"} ${anchor.name} · ${anchor.category || "General"} · anchor`,
  }));

  const plan = buildVoyageAdjustmentPlan(
    state,
    dateStr,
    mode,
    mode === "harbor" ? 0 : capacityPct,
    protectedKey
  );

  const monthPrefix = dateStr.slice(0, 7);
  const monthAdjustments = Object.entries(state?.voyageAdjustments || {}).filter(
    ([ds]) => ds.slice(0, 7) === monthPrefix
  ).length;

  const reasons = [
    "University",
    "Freelance work",
    "Social / friends",
    "Event",
    "Travel",
    "Low energy",
    "Unexpected change",
    "Other",
  ];

  const formatMoveDay = (ds) =>
    ds
      ? parseISODateLocal(ds).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
      : "Unscheduled backlog";

  const activeAnchorIds =
    mode !== "harbor"
      ? []
      : anchorPlan === "all"
      ? scheduledAnchors.map((anchor) => anchor.id)
      : anchorPlan === "some"
      ? selectedAnchorIds
      : [];

  const canApply =
    !!reason &&
    (mode !== "harbor" || anchorPlan !== "some" || activeAnchorIds.length > 0);

  return (
    <div className="qd-voyage-modal-backdrop" role="dialog" aria-modal="true">
      <div className="qd-voyage-modal">
        <div className="qd-voyage-modal-head">
          <div className="qd-voyage-modal-kicker">Voyage adjustment</div>
          <div className="qd-voyage-modal-title">The plan changed. The voyage did not.</div>
          <div className="qd-voyage-modal-sub">
            Quest will move flexible work rather than pretending today still has the same capacity. Fixed work stays put, and daily anchors never multiply into tomorrow.
          </div>
          <div className="qd-voyage-memory">
            Voyage memory: {monthAdjustments} adjusted {monthAdjustments === 1 ? "day" : "days"} recorded this month. This is awareness, not a limit.
          </div>
        </div>

        <div className="qd-voyage-section">
          <span className="qd-voyage-label">1. What kind of day is this?</span>
          <div className="qd-voyage-mode-grid">
            <button type="button" className={"qd-voyage-mode" + (mode === "reduced" ? " active" : "")} onClick={() => setMode("reduced")}>
              <strong>⛵ Reduced Sail</strong>
              <span>You still have some capacity. Quest keeps what fits and redistributes the rest.</span>
            </button>
            <button type="button" className={"qd-voyage-mode" + (mode === "harbor" ? " active" : "")} onClick={() => setMode("harbor")}>
              <strong>⚓ Safe Harbor</strong>
              <span>The planned workday is gone. Flexible work moves; fixed or protected work remains visible.</span>
            </button>
          </div>
        </div>

        {mode === "reduced" && (
          <div className="qd-voyage-section">
            <span className="qd-voyage-label">2. How much capacity do you realistically have?</span>
            <div className="qd-voyage-capacity">
              {[75, 50, 25].map((pct) => (
                <button key={pct} type="button" className={"qd-capacity-btn" + (capacityPct === pct ? " active" : "")} onClick={() => setCapacityPct(pct)}>
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="qd-voyage-section">
          <label className="qd-voyage-label" htmlFor="qd-voyage-reason">{mode === "reduced" ? "3" : "2"}. What changed?</label>
          <select id="qd-voyage-reason" className="qd-voyage-field" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Choose a reason…</option>
            {reasons.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>

        {mode === "harbor" && (
          <div className="qd-voyage-section">
            <span className="qd-voyage-label">3. Will you still be able to do your daily anchors?</span>
            {scheduledAnchors.length === 0 && (
              <div className="qd-time-hint" style={{ marginBottom: 8 }}>No daily anchors are scheduled for this day, so Safe Harbor will not create any routine debt.</div>
            )}
            <div className="qd-anchor-choice-grid">
              <button
                type="button"
                className={"qd-anchor-choice-btn" + (anchorPlan === "all" ? " active" : "")}
                onClick={() => {
                  setAnchorPlan("all");
                  setSelectedAnchorIds(scheduledAnchors.map((anchor) => anchor.id));
                }}
              >
                Yes · all anchors
              </button>
              <button
                type="button"
                className={"qd-anchor-choice-btn" + (anchorPlan === "some" ? " active" : "")}
                onClick={() => {
                  setAnchorPlan("some");
                  if (!selectedAnchorIds.length && scheduledAnchors[0]) {
                    setSelectedAnchorIds([scheduledAnchors[0].id]);
                  }
                }}
              >
                Only a few
              </button>
              <button
                type="button"
                className={"qd-anchor-choice-btn" + (anchorPlan === "none" ? " active" : "")}
                onClick={() => {
                  setAnchorPlan("none");
                  setSelectedAnchorIds([]);
                }}
              >
                None today
              </button>
            </div>

            {anchorPlan === "some" && (
              <div className="qd-anchor-picks">
                {scheduledAnchors.map((anchor) => {
                  const checked = selectedAnchorIds.includes(anchor.id);
                  return (
                    <label className="qd-anchor-pick" key={anchor.id}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedAnchorIds((current) =>
                            current.includes(anchor.id)
                              ? current.filter((id) => id !== anchor.id)
                              : [...current, anchor.id]
                          )
                        }
                      />
                      <span>{anchor.emoji || "⚓"} {anchor.name}</span>
                      <span className="qd-anchor-pick-time">
                        {anchor.hour !== null && anchor.hour !== undefined
                          ? `${String(anchor.hour).padStart(2, "0")}:00`
                          : "no clock time"}
                      </span>
                    </label>
                  );
                })}
                {!activeAnchorIds.length && (
                  <div className="qd-voyage-warning">Choose at least one anchor, or select “None today.”</div>
                )}
              </div>
            )}

            <div className="qd-anchor-choice-note">
              Anchors you keep are real commitments for this Safe Harbor day. Timed anchors stay colored on the clock; paused anchors do not become extra work tomorrow.
            </div>
          </div>
        )}

        <div className="qd-voyage-section">
          <label className="qd-voyage-label" htmlFor="qd-voyage-protect">{mode === "reduced" ? "4" : "4"}. Protect one task (optional)</label>
          <select id="qd-voyage-protect" className="qd-voyage-field" value={protectedKey} onChange={(e) => setProtectedKey(e.target.value)}>
            <option value="">Nothing · let Quest rebalance flexible work</option>
            {incompleteTasks.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            {mode === "reduced" && anchorOptions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </div>

        <div className="qd-voyage-section">
          <label className="qd-voyage-label" htmlFor="qd-voyage-note">Optional note</label>
          <textarea id="qd-voyage-note" className="qd-voyage-field qd-voyage-note-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Example: class moved, client shoot ran late, friend's birthday…" />
        </div>

        <div className="qd-voyage-section">
          <span className="qd-voyage-label">Before you confirm</span>
          <div className="qd-voyage-preview">
            <div className="qd-voyage-preview-top">
              <div>
                <div className="qd-voyage-preview-num">{formatMinutes(plan.plannedMinutes)}</div>
                <div className="qd-voyage-preview-label">planned work today</div>
              </div>
              <div className="qd-voyage-arrow">→</div>
              <div>
                <div className="qd-voyage-preview-num">{formatMinutes(plan.keptMinutes)}</div>
                <div className="qd-voyage-preview-label">kept today · target {formatMinutes(plan.targetMinutes)}</div>
              </div>
            </div>

            {plan.moves.length ? (
              <div className="qd-voyage-moves">
                {plan.moves.map((move) => (
                  <div className="qd-voyage-move" key={`${move.domainId}-${move.taskId}`}>
                    <strong>{move.name} · ~{formatMinutes(move.minutes)}</strong>
                    <span>moves to {formatMoveDay(move.toDay)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="qd-time-hint" style={{ marginTop: 12 }}>Nothing needs to move with this capacity.</div>
            )}

            {plan.warnings.map((warning, index) => (
              <div className="qd-voyage-warning" key={index}>{warning}</div>
            ))}
          </div>
        </div>

        <div className="qd-voyage-modal-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="primary"
            disabled={!canApply}
            onClick={() => onApply({
              mode,
              capacityPct: mode === "harbor" ? 0 : capacityPct,
              reason,
              note: note.trim(),
              protectedKey,
              anchorPlan: mode === "harbor" ? anchorPlan : null,
              activeAnchorIds: mode === "harbor" ? activeAnchorIds : [],
              plan,
            })}
          >
            {mode === "harbor" ? "Take Safe Harbor & rebalance" : "Reduce sail & rebalance"}
          </button>
        </div>
      </div>
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
  disabledReason = "",
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
    !disabledReason &&
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
        {disabledReason
          ? "Paused"
          : claimedValue
          ? "Claimed ✓"
          : unlocked
          ? "Claim reward"
          : "Locked"}
      </button>

      {disabledReason && (
        <div className="qd-reward-paused">{disabledReason}</div>
      )}

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

export default function QuestDashboard({ designPreview = false } = {}) {
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
  const [pendingTimeLog, setPendingTimeLog] = useState(null);
  const [showVoyageAdjustment, setShowVoyageAdjustment] = useState(false);
  const [activeNav, setActiveNav] = useState("home");
  const [page, setPage] = useState(
    () => getHomePage(typeof window === "undefined" ? "" : window.location.hash)
  );
  const showAnchorPage = page === "anchors";
  const showTodayQuestsPage = page === "today-quests";
  const anchorPageVisible = showAnchorPage;
  const previewSubPage = designPreview && ["quests", "stats", "more"].includes(page);

  const rewardDetectionReady = useRef(false);

  // The anchor manager handles editing; the home timeline supports completion.
  // Listen to the URL so bottom tabs, View All, reloads and browser Back agree.
  useEffect(() => {
    const syncAnchorPage = () => {
      setPage(getHomePage(window.location.hash));
    };
    syncAnchorPage();
    window.addEventListener("hashchange", syncAnchorPage);
    return () => window.removeEventListener("hashchange", syncAnchorPage);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (designPreview) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    const target = showAnchorPage ? "anchors" : showTodayQuestsPage ? "today-quests" : window.location.hash.slice(1) || "home";
    document.getElementById(target)?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [page, showAnchorPage, showTodayQuestsPage, loaded, designPreview]);

  // Keep the compact voyage navigator aware of the section currently nearest
  // the top of the viewport. The bar itself is fixed, so it follows the user
  // without ever becoming a second scrollable panel.
  useEffect(() => {
    if (showAnchorPage || showTodayQuestsPage || designPreview) return;
    const ids = ["home", "voyage", "anchors", "rewards", "quests"];
    const updateActiveNav = () => {
      const marker = 150;
      let current = "home";
      let bestTop = -Infinity;

      ids.forEach((id) => {
        const element = document.getElementById(id);
        if (!element) return;
        const top = element.getBoundingClientRect().top;
        if (top <= marker && top > bestTop) {
          bestTop = top;
          current = id;
        }
      });

      setActiveNav(current);
    };

    updateActiveNav();
    window.addEventListener("scroll", updateActiveNav, { passive: true });
    window.addEventListener("resize", updateActiveNav);
    return () => {
      window.removeEventListener("scroll", updateActiveNav);
      window.removeEventListener("resize", updateActiveNav);
    };
  }, [state, showAnchorPage, showTodayQuestsPage, designPreview]);

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

  const dayAnchorMax = (ds) => {
    if (!state) return 0;

    const full = state.anchors.reduce(
      (sum, anchor) =>
        sum +
        (isAnchorScheduledOn(anchor, ds)
          ? Number(anchor.xpPerDay) || 0
          : 0),
      0
    );
    const adjustment = getVoyageAdjustment(state, ds);
    const completed = dayAnchorXP(ds);
    if (!adjustment) return Math.max(full, completed);

    if (adjustment.mode === "harbor") {
      const activeAnchorIds = getSafeHarborActiveAnchorIds(state, adjustment);
      const committedXP = state.anchors.reduce(
        (sum, anchor) =>
          sum +
          (activeAnchorIds.includes(anchor.id) && isAnchorScheduledOn(anchor, ds)
            ? Number(anchor.xpPerDay) || 0
            : 0),
        0
      );
      return Math.max(completed, committedXP);
    }

    const protectedAnchorId = String(adjustment.protectedKey || "").startsWith("anchor:")
      ? String(adjustment.protectedKey).slice("anchor:".length)
      : null;
    const protectedAnchor = protectedAnchorId
      ? state.anchors.find((anchor) => anchor.id === protectedAnchorId)
      : null;
    const protectedXP = protectedAnchor && isAnchorScheduledOn(protectedAnchor, ds)
      ? Number(protectedAnchor.xpPerDay) || 0
      : 0;
    const scaled = Math.round(full * (Math.max(0, Number(adjustment.capacityPct) || 0) / 100));
    return Math.max(completed, protectedXP, scaled);
  };

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
    dayAnchorMax(ds) + dayTaskMax(ds);

  // Weekly XP formula:
  // Earned = anchors completed this week + every task completed this week.
  // Available = only the anchor days actually scheduled this week + every unfinished task + tasks completed this week.
  // Assigned dates do not matter for the weekly task pool.
  const weekAnchorXP = () =>
    wDates.reduce((sum, d) => sum + dayAnchorXP(d), 0);

  const weekAnchorMax = () =>
    wDates.reduce((sum, d) => sum + dayAnchorMax(d), 0);

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

  const todayAdjustment = getVoyageAdjustment(state, todayStr);
  const dailyRewardPaused = todayAdjustment?.mode === "harbor";
  const protectedRequirementMet = (() => {
    const key = String(todayAdjustment?.protectedKey || "");
    if (!key) return true;

    if (key.startsWith("anchor:")) {
      const anchorId = key.slice("anchor:".length);
      return !!state.anchors.find((anchor) => anchor.id === anchorId)?.history?.[todayStr];
    }

    if (key.startsWith("task:")) {
      const [, domainId, taskId] = key.split(":");
      return !!state.domains.find((domain) => domain.id === domainId)?.tasks.find((task) => task.id === taskId)?.done;
    }

    return true;
  })();

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
      !dailyRewardPaused &&
      protectedRequirementMet &&
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
    dailyRewardPaused,
    protectedRequirementMet,
  ]);

  // ====================================================
  // SAFE HARBOR RECONCILIATION
  // ====================================================

  useEffect(() => {
    if (
      !loaded ||
      !state ||
      !session?.user?.id
    ) {
      return;
    }

    const adjustment = getVoyageAdjustment(state, todayStr);
    if (adjustment?.mode !== "harbor") return;

    const stuckFlexibleTasks = state.domains.flatMap((domain) =>
      domain.tasks.filter((task) => {
        if (task.done || task.day !== todayStr) return false;
        if (getTaskFlexibility(task) === "fixed") return false;
        return adjustment.protectedKey !== `task:${domain.id}:${task.id}`;
      })
    );

    if (!stuckFlexibleTasks.length) return;

    // Repairs older Safe Harbor saves and also prevents a newly-added
    // flexible task from silently remaining on a paused day.
    setState((previous) => {
      const next = clone(previous);
      const currentAdjustment = getVoyageAdjustment(next, todayStr);
      if (currentAdjustment?.mode !== "harbor") return previous;

      const repairPlan = buildVoyageAdjustmentPlan(
        next,
        todayStr,
        "harbor",
        0,
        currentAdjustment.protectedKey || ""
      );

      const repairedMoves = applyVoyageMovesToState(
        next,
        todayStr,
        "harbor",
        currentAdjustment.protectedKey || "",
        repairPlan.moves || []
      );

      if (!repairedMoves.length) return previous;

      const existing = Array.isArray(currentAdjustment.movedTasks)
        ? currentAdjustment.movedTasks
        : [];
      const seen = new Set(
        existing.map((move) => `${move.domainId}:${move.taskId}`)
      );

      currentAdjustment.movedTasks = [
        ...existing,
        ...repairedMoves.filter(
          (move) => !seen.has(`${move.domainId}:${move.taskId}`)
        ),
      ];
      currentAdjustment.repairedAt = new Date().toISOString();

      return next;
    });
  }, [loaded, state, session, todayStr]);

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

      if (!anchor.history[ds] && !isAnchorScheduledOn(anchor, ds)) {
        return;
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
    category,
    activeWeekdays,
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

        category: normalizeAnchorCategory(category),
        activeWeekdays: normalizeAnchorWeekdays(activeWeekdays),

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
      anchor.category = normalizeAnchorCategory(changes.category || anchor.category);
      anchor.activeWeekdays = normalizeAnchorWeekdays(changes.activeWeekdays);
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

    // Completing a task opens the actual-time log first.
    if (!task.done) {
      setPendingTimeLog({
        domainId,
        taskId,
        domainName: domain.name,
        task: { ...task },
      });
      playSFX("click");
      return;
    }

    // Undoing a completion also removes that task's timing sample so an
    // accidental completion does not teach the estimator bad data.
    updateState((next) => {
      const d = next.domains.find((x) => x.id === domainId);
      const t = d?.tasks.find((x) => x.id === taskId);
      if (!d || !t) return;

      const profileKey =
        t.timingProfileKey || normalizeTaskTimingKey(t.name);

      if (profileKey && d.timingProfiles?.[profileKey]?.samples) {
        d.timingProfiles[profileKey].samples =
          d.timingProfiles[profileKey].samples.filter(
            (sample) => sample.taskId !== taskId
          );
      }

      t.done = false;
      t.doneAt = null;
      t.actualMinutes = null;
      t.timingProfileKey = null;
    });

    playSFX("undo");
  };

  const completeTaskWithTime = (actualMinutes) => {
    if (!pendingTimeLog) return;

    const parsedActual = Number(actualMinutes);
    if (!Number.isFinite(parsedActual) || parsedActual <= 0) return;
    const actual = Math.max(1, Math.round(parsedActual));

    const { domainId, taskId } = pendingTimeLog;

    updateState((next) => {
      const domain = next.domains.find((d) => d.id === domainId);
      const task = domain?.tasks.find((t) => t.id === taskId);
      if (!domain || !task) return;

      const profileKey = normalizeTaskTimingKey(task.name);

      if (!domain.timingProfiles) domain.timingProfiles = {};
      if (!domain.timingProfiles[profileKey]) {
        domain.timingProfiles[profileKey] = { samples: [] };
      }

      const profile = domain.timingProfiles[profileKey];
      if (!Array.isArray(profile.samples)) profile.samples = [];

      // One task completion contributes one sample.
      profile.samples = profile.samples.filter(
        (sample) => sample.taskId !== taskId
      );
      profile.samples.push({
        taskId,
        actualMinutes: actual,
        estimatedMinutes: Number(task.estimatedMinutes) || null,
        loggedAt: new Date().toISOString(),
      });

      // Keep enough recent history to learn while avoiding endlessly growing JSON.
      profile.samples = profile.samples.slice(-20);

      task.done = true;
      task.doneAt = new Date().toISOString();
      task.actualMinutes = actual;
      task.timingProfileKey = profileKey;
    });

    setPendingTimeLog(null);
    playSFX("complete");
  };

  const addTask = (
    domainId,
    {
      name,
      xp,
      day,
      hour,
      estimatedMinutes,
      flexibility,
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

        estimatedMinutes:
          estimatedMinutes === "" || estimatedMinutes === null || estimatedMinutes === undefined
            ? null
            : Math.max(1, Math.round(Number(estimatedMinutes) || 1)),
        actualMinutes: null,
        timingProfileKey: null,
        flexibility: flexibility === "fixed" ? "fixed" : "flexible",
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

      const oldProfileKey =
        task.timingProfileKey || normalizeTaskTimingKey(task.name);
      const newProfileKey = normalizeTaskTimingKey(changes.name);

      // If a completed task is renamed, move its timing sample to the new
      // task identity inside the same quest.
      if (
        task.done &&
        Number(task.actualMinutes) > 0 &&
        oldProfileKey &&
        newProfileKey &&
        oldProfileKey !== newProfileKey
      ) {
        if (!domain.timingProfiles) domain.timingProfiles = {};
        if (domain.timingProfiles[oldProfileKey]?.samples) {
          domain.timingProfiles[oldProfileKey].samples =
            domain.timingProfiles[oldProfileKey].samples.filter(
              (sample) => sample.taskId !== taskId
            );
        }
        if (!domain.timingProfiles[newProfileKey]) {
          domain.timingProfiles[newProfileKey] = { samples: [] };
        }
        const newProfile = domain.timingProfiles[newProfileKey];
        if (!Array.isArray(newProfile.samples)) newProfile.samples = [];
        newProfile.samples = newProfile.samples.filter(
          (sample) => sample.taskId !== taskId
        );
        newProfile.samples.push({
          taskId,
          actualMinutes: Number(task.actualMinutes),
          estimatedMinutes: Number(changes.estimatedMinutes) || Number(task.estimatedMinutes) || null,
          loggedAt: task.doneAt || new Date().toISOString(),
        });
        newProfile.samples = newProfile.samples.slice(-20);
        task.timingProfileKey = newProfileKey;
      }

      task.name = changes.name;
      task.xp = Math.max(1, Number(changes.xp) || 1);
      task.day = changes.day || null;
      task.hour =
        changes.hour === "" || changes.hour === null || changes.hour === undefined
          ? null
          : Number(changes.hour);
      task.estimatedMinutes =
        changes.estimatedMinutes === "" ||
        changes.estimatedMinutes === null ||
        changes.estimatedMinutes === undefined
          ? null
          : Math.max(1, Math.round(Number(changes.estimatedMinutes) || 1));
      task.flexibility = changes.flexibility === "fixed" ? "fixed" : "flexible";
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
  // VOYAGE ADJUSTMENT
  // ====================================================

  const applyVoyageAdjustment = ({
    mode,
    capacityPct,
    reason,
    note,
    protectedKey,
    anchorPlan,
    activeAnchorIds,
    plan,
  }) => {
    updateState((next) => {
      if (!next.voyageAdjustments) next.voyageAdjustments = {};

      const appliedMoves = applyVoyageMovesToState(
        next,
        todayStr,
        mode,
        protectedKey,
        plan.moves || []
      );

      next.voyageAdjustments[todayStr] = {
        mode,
        capacityPct: mode === "harbor" ? 0 : Number(capacityPct) || 0,
        reason,
        note: note || "",
        protectedKey: protectedKey || "",
        anchorPlan: mode === "harbor" ? anchorPlan || "none" : null,
        activeAnchorIds:
          mode === "harbor"
            ? (activeAnchorIds || []).filter((id) =>
                next.anchors.some((anchor) => anchor.id === id)
              )
            : [],
        plannedMinutes: Number(plan.plannedMinutes) || 0,
        targetMinutes: Number(plan.targetMinutes) || 0,
        keptMinutes: Number(plan.keptMinutes) || 0,
        movedTasks: clone(appliedMoves),
        keptTasks: clone(
          (plan.kept || []).map((task) => ({
            domainId: task.domainId,
            taskId: task.id,
            name: task.name,
            flexibility: task.flexibility,
          }))
        ),
        createdAt: new Date().toISOString(),
      };
    });

    setShowVoyageAdjustment(false);
    playSFX("add");
  };

  const restoreNormalVoyage = (dateStr) => {
    const adjustment = getVoyageAdjustment(state, dateStr);
    if (!adjustment) return;

    updateState((next) => {
      (adjustment.movedTasks || []).forEach((move) => {
        const domain = next.domains.find((d) => d.id === move.domainId);
        const task = domain?.tasks.find((t) => t.id === move.taskId);
        if (!task || task.done) return;

        // Do not overwrite a manual edit made after the rebalance.
        const currentDay = task.day || null;
        const expectedDay = move.toDay || null;
        if (currentDay === expectedDay) {
          task.day = move.fromDay || null;
          task.hour = move.fromHour ?? null;
        }
      });

      if (next.voyageAdjustments) {
        delete next.voyageAdjustments[dateStr];
      }
    });

    playSFX("undo");
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

  const viewAdjustment = getVoyageAdjustment(state, viewDateStr);

  const viewSafeHarborAnchorIds =
    viewAdjustment?.mode === "harbor"
      ? getSafeHarborActiveAnchorIds(state, viewAdjustment)
      : [];

  const viewAnchorClockItems = state.anchors
    .filter((anchor) => {
      if (anchor.hour === null || anchor.hour === undefined) return false;
      const completed = !!anchor.history?.[viewDateStr];
      if (!isAnchorScheduledOn(anchor, viewDateStr) && !completed) return false;
      if (viewAdjustment?.mode !== "harbor") return true;

      const keptToday = viewSafeHarborAnchorIds.includes(anchor.id);

      return completed || keptToday;
    })
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
      domainName: anchor.category || "Daily Anchor",
      safeHarborHighlight:
        viewAdjustment?.mode === "harbor" &&
        viewSafeHarborAnchorIds.includes(anchor.id),
    }));

  const clockItems = [
    ...viewTasks.map((task) => ({
      ...task,
      sourceType: "task",
      clockKey: `task-${task.domainId}-${task.id}`,
      safeHarborHighlight:
        viewAdjustment?.mode === "harbor" &&
        getTaskFlexibility(task) === "fixed",
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

  const todayActiveAnchorIds = getSafeHarborActiveAnchorIds(state, todayAdjustment);
  const todayTimelineAnchors = state.anchors
    .filter((anchor) => isAnchorScheduledOn(anchor, todayStr) || anchor.history?.[todayStr])
    .map((anchor) => ({
      id: anchor.id,
      name: anchor.name,
      emoji: anchor.emoji,
      hour: anchor.hour,
      xpPerDay: anchor.xpPerDay,
      done: !!anchor.history?.[todayStr],
      paused: todayAdjustment?.mode === "harbor" && !todayActiveAnchorIds.includes(anchor.id),
    }));

  const todayQuestTasks = viewTasks;
  const homeQuestItems = getTodayQuestItems({
    anchors: todayTimelineAnchors,
    tasks: allTasks(),
    todayStr,
    resetHour,
  });
  const toggleHomeQuest = (item) => {
    if (item.source === "anchor") toggleAnchor(item.id, todayStr);
    else toggleTask(item.domainId, item.id);
  };
  const todayRemainingIncompleteTasks = allTasks().filter(
    (task) => !task.done && task.day === todayStr
  );
  const todayHarborRemainingCount =
    todayAdjustment?.mode === "harbor"
      ? todayRemainingIncompleteTasks.length
      : 0;
  const todayHarborMovedCount =
    todayAdjustment?.mode === "harbor"
      ? (todayAdjustment.movedTasks || []).length
      : 0;

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
  const lifetimeXP =
    state.domains.reduce(
      (total, domain) =>
        total +
        domain.tasks.reduce(
          (taskTotal, task) => taskTotal + (task.done ? Number(task.xp) || 0 : 0),
          0
        ),
      0
    ) +
    state.anchors.reduce(
      (total, anchor) =>
        total +
        Object.values(anchor.history || {}).filter(Boolean).length *
          (Number(anchor.xpPerDay) || 0),
      0
    );
  const level = Math.max(1, Math.floor(lifetimeXP / 500) + 1);
  const levelXP = lifetimeXP % 500;
  const recordedJourneyDates = [
    ...state.anchors.flatMap((anchor) =>
      Object.entries(anchor.history || {})
        .filter(([, completed]) => completed)
        .map(([date]) => date)
    ),
    ...state.domains.flatMap((domain) =>
      domain.tasks
        .filter((task) => task.done && task.doneAt)
        .map((task) => String(task.doneAt).slice(0, 10))
    ),
  ].filter(Boolean);
  const journeyStart = recordedJourneyDates.sort()[0] || todayStr;
  const journeyDay = Math.max(
    1,
    Math.floor(
      (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
        Date.UTC(
          Number(journeyStart.slice(0, 4)),
          Number(journeyStart.slice(5, 7)) - 1,
          Number(journeyStart.slice(8, 10))
        )) /
        86400000
    ) + 1
  );

  const streak = getCurrentStreak({ anchors: state.anchors, tasks: allTasks(), todayStr, resetHour });
  const questLogSection = (
    <section className="qd-section" id={designPreview ? "quest-log" : "quests"}>
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
  );
  const currentNav = designPreview ? (showTodayQuestsPage ? "quests" : page) : anchorPageVisible ? "anchors" : showTodayQuestsPage ? "quests" : activeNav;

  return (
    <div
      className={
        "qd-root" +
        (todayAdjustment?.mode === "harbor" ? " qd-safe-harbor" : "")
      }
    >
      <style>{CSS}</style>
      <style>{PIXEL_CSS}</style>

      <div className="qd-legacy-overlays">
      {celebration && (
        <CelebrationModal
          kind={celebration}
          items={celebration === "daily" ? state.rewards.daily : state.rewards.weekly}
          onComplete={finishCelebration}
        />
      )}

      {showVoyageAdjustment && !todayAdjustment && (
        <VoyageAdjustmentModal
          state={state}
          dateStr={todayStr}
          onApply={applyVoyageAdjustment}
          onCancel={() => setShowVoyageAdjustment(false)}
        />
      )}
      </div>

      {pendingTimeLog && (
        <CompletionTimeModal
          task={pendingTimeLog.task}
          domainName={pendingTimeLog.domainName}
          onSave={completeTaskWithTime}
          onCancel={() => setPendingTimeLog(null)}
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

          <nav className="qd-nav" aria-label="Quick navigation">
            <a className={currentNav === "home" ? "active" : ""} href="#home" title="Home" aria-label="Home" onClick={() => setActiveNav("home")}><span className="qd-nav-icon">⌂</span><span>Home</span></a>
            <a className={currentNav === "quests" ? "active" : ""} href="#quests" title="Quests" aria-label="Quests" onClick={() => setActiveNav("quests")}><span className="qd-nav-icon">▣</span><span>Quests</span></a>
            <a className={currentNav === "anchors" ? "active" : ""} href="#anchors" title="Anchors" aria-label="Anchors" onClick={() => setActiveNav("anchors")}><span className="qd-nav-icon">⚓</span><span>Anchors</span></a>
            <a className={currentNav === "voyage" ? "active" : ""} href="#voyage" title="Stats" aria-label="Stats" onClick={() => setActiveNav("voyage")}><span className="qd-nav-icon">▥</span><span>Stats</span></a>
            <a className={currentNav === "rewards" ? "active" : ""} href="#rewards" title="More" aria-label="More" onClick={() => setActiveNav("rewards")}><span className="qd-nav-icon">•••</span><span>More</span></a>
          </nav>

          <div className="qd-sidebar-quote">
            “The journey is the reward.”
            <span>— Odysseus</span>
          </div>

          <button
            type="button"
            className="qd-logout"
            title="Log out"
            aria-label="Log out"
            onClick={async () => {
              playSFX("click");
              await supabase.auth.signOut();
            }}
          >
            Log out
          </button>
        </aside>

        <main className={"qd-main" + (anchorPageVisible ? " qd-main-anchors" : showTodayQuestsPage ? " qd-main-today-quests" : previewSubPage ? ` qd-main-page qd-main-${page}` : " qd-main-home")} id={anchorPageVisible ? "anchors" : showTodayQuestsPage ? "today-quests" : previewSubPage ? page : "home"}>
          {anchorPageVisible ? (
            <>
              <header className="qd-anchor-page-heading">
                <a href="#home">‹ Back to Home</a>
                <h1><PixelAnchorSymbol /> Daily Anchors</h1>
                <p>Your routines, your rhythm. Make a little progress each day.</p>
              </header>
              <section className="qd-panel qd-anchor-panel" aria-label="Manage daily anchors">
                <div className="qd-panel-head">
                  <div>
                    <div className="qd-panel-title">YOUR WEEK</div>
                    <div className="qd-panel-sub">Check off your anchors, set their times, and choose their days.</div>
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
                      voyageAdjustments={state.voyageAdjustments || {}}
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
            </>
          ) : showTodayQuestsPage ? (
            <>
              <header className="qd-today-quests-page-heading">
                <a href="#home">‹ Back to Home</a>
                <h1>Today’s Quests</h1>
                <p>{homeQuestItems.filter((item) => item.done).length} / {homeQuestItems.length} completed today</p>
              </header>
              <TodayQuests items={homeQuestItems} onToggle={toggleHomeQuest} expanded />
            </>
          ) : previewSubPage && page === "quests" ? (
            <><HomePageHeading title="Quests"><p>Plan your tasks and keep making progress.</p></HomePageHeading>{questLogSection}</>
          ) : previewSubPage && page === "stats" ? (
            <StatsPage streak={streak} completed={homeQuestItems.filter((item) => item.done).length} total={homeQuestItems.length} todayXP={dToday} weekXP={wXP} lifetimeXP={lifetimeXP} level={level} />
          ) : previewSubPage && page === "more" ? (
            <MorePage resetHour={resetHour} onResetHour={setResetHour} />
          ) : (
          <>
          <header className="qd-scene">
            <GardenScene />
            <div className="qd-topbar">
              <div className="qd-scene-copy">
                <div className="qd-greeting-kicker">{greeting},</div>
                <div className="qd-greeting">TALAAT <span aria-hidden="true">🌱</span></div>
                <div className="qd-greeting-sub">
                  {todayAdjustment?.mode === "harbor"
                    ? "Rest is part of the journey."
                    : todayAdjustment?.mode === "reduced"
                    ? "Small steps still move you forward."
                    : "Small steps, a brighter tomorrow."}
                </div>
              </div>
              <div className="qd-topmeta">
                <div className="qd-meta-pill qd-date-card">
                  <div className="qd-date-main">
                    <span aria-hidden="true">▣</span>
                    {today.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </div>
                  <div className="qd-journey-day"><span aria-hidden="true">🌱</span> Day {journeyDay}</div>
                </div>
              </div>
            </div>

            <div className="qd-level-card" aria-label={`Level ${level}, ${levelXP} of 500 experience points`}>
              <div className="qd-level-badge">LV {level}</div>
              <div className="qd-level-track">
                <div className="qd-level-fill" style={{ width: `${Math.min(100, (levelXP / 500) * 100)}%` }} />
              </div>
              <div className="qd-level-value">{levelXP} / 500 XP</div>
            </div>
          </header>

          {designPreview ? (
            <div className="qd-design-canvas">
              <DailyAnchors anchors={todayTimelineAnchors} resetHour={resetHour} now={clockNow} onToggle={(id) => toggleAnchor(id, todayStr)} />
              <div className="qd-home-quests-row">
                <TodayQuests items={homeQuestItems} onToggle={toggleHomeQuest} />
                <FarmAndStreak streak={streak} />
              </div>
              <StopDay state={state} userId={session.user.id} day={todayStr} />
            </div>
          ) : (
            <DailyAnchors anchors={todayTimelineAnchors} resetHour={resetHour} now={clockNow} onToggle={(id) => toggleAnchor(id, todayStr)} />
          )}

          <div className="qd-voyage-adjust-bar">
            <div className="qd-voyage-adjust-copy">
              <div className="qd-voyage-adjust-title">
                TODAY'S VOYAGE
                {todayAdjustment && (
                  <span className="qd-voyage-status">
                    {todayAdjustment.mode === "harbor" ? "⚓ Safe Harbor" : `⛵ Reduced Sail · ${todayAdjustment.capacityPct}%`}
                  </span>
                )}
              </div>
              <div className="qd-voyage-adjust-sub">
                {todayAdjustment
                  ? todayAdjustment.mode === "harbor"
                    ? `${todayAdjustment.reason} · ${todayHarborMovedCount} flexible ${todayHarborMovedCount === 1 ? "task" : "tasks"} moved away from today${todayHarborRemainingCount ? ` · ${todayHarborRemainingCount} fixed/protected ${todayHarborRemainingCount === 1 ? "task remains" : "tasks remain"}` : ""}`
                    : `${todayAdjustment.reason}${todayAdjustment.movedTasks?.length ? ` · ${todayAdjustment.movedTasks.length} flexible ${todayAdjustment.movedTasks.length === 1 ? "task" : "tasks"} rebalanced` : " · nothing needed to move"}`
                  : "Plans change. Adjust the day without abandoning the week."}
              </div>
            </div>
            <div className="qd-voyage-adjust-actions">
              {todayAdjustment ? (
                <button
                  type="button"
                  className="qd-voyage-restore-btn"
                  onClick={() => {
                    if (window.confirm("Restore today's normal voyage and move automatically rebalanced tasks back?")) {
                      restoreNormalVoyage(todayStr);
                    }
                  }}
                >
                  Restore normal day
                </button>
              ) : (
                <button type="button" className="qd-voyage-adjust-btn" onClick={() => { playSFX("click"); setShowVoyageAdjustment(true); }}>
                  Change today's voyage
                </button>
              )}
            </div>
          </div>

          {todayAdjustment?.mode === "harbor" && (
            <div className="qd-safe-harbor-banner">
              <div className="qd-safe-harbor-icon">⚓</div>
              <div className="qd-safe-harbor-copy">
                <div className="qd-safe-harbor-title">SAFE HARBOR · VOYAGE PAUSED</div>
                <div className="qd-safe-harbor-text">
                  {todayHarborMovedCount
                    ? <><strong>{todayHarborMovedCount}</strong> flexible {todayHarborMovedCount === 1 ? "task has" : "tasks have"} been moved away from today. </>
                    : <>No flexible quest work needed moving. </>}
                  {todayHarborRemainingCount
                    ? <><strong>{todayHarborRemainingCount}</strong> fixed or protected {todayHarborRemainingCount === 1 ? "task is" : "tasks are"} intentionally still due today.</>
                    : <>No unfinished quest work remains scheduled today. </>}
                  {(() => {
                    const activeIds = getSafeHarborActiveAnchorIds(state, todayAdjustment);
                    if (!activeIds.length) return <> All daily anchors are paused.</>;
                    const scheduledCount = state.anchors.filter((anchor) => isAnchorScheduledOn(anchor, todayStr)).length;
                    if (activeIds.length === scheduledCount && scheduledCount > 0) return <> All <strong>{activeIds.length}</strong> scheduled daily anchors stay active.</>;
                    return <> <strong>{activeIds.length}</strong> selected daily {activeIds.length === 1 ? "anchor stays" : "anchors stay"} active.</>;
                  })()}
                </div>
              </div>
            </div>
          )}

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
                safeHarbor={viewAdjustment?.mode === "harbor"}
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
              {todayAdjustment?.mode === "harbor" && viewDateStr === todayStr && (
                <div className="qd-today-harbor-note">
                  Safe Harbor is active. Flexible unfinished work is removed from today automatically. Anything still shown here is completed, fixed, or explicitly protected.
                </div>
              )}
              <div className="qd-today-list">
                {todayQuestTasks.length === 0 && (
                  <div className="qd-empty">
                    {todayAdjustment?.mode === "harbor" && viewDateStr === todayStr
                      ? "The deck is clear — no quest work is scheduled for Safe Harbor."
                      : "No quests scheduled for this date."}
                  </div>
                )}
                {todayQuestTasks.slice(0, 6).map((task) => {
                  const safeHarborFixed =
                    todayAdjustment?.mode === "harbor" &&
                    viewDateStr === todayStr &&
                    getTaskFlexibility(task) === "fixed";
                  return (
                  <div
                    key={`${task.domainId}:${task.id}`}
                    className={
                      "qd-today-task" +
                      (task.done ? " done" : "") +
                      (safeHarborFixed ? " qd-safe-fixed-task" : "")
                    }
                    style={safeHarborFixed ? { "--safe-accent": task.domainColor || "#cba66a" } : undefined}
                    onClick={() => toggleTask(task.domainId, task.id)}
                  >
                    <div className="qd-today-check">{task.done ? "✓" : ""}</div>
                    <div>
                      <div className="qd-today-name">{task.name}</div>
                      <div className="qd-today-sub">
                        {task.domainEmoji} {task.domainName}
                        {task.hour !== null && task.hour !== undefined ? ` · ${String(task.hour).padStart(2, "0")}:00` : ""}
                        {task.estimatedMinutes ? ` · ~${formatMinutes(task.estimatedMinutes)} est.` : ""}
                        {todayAdjustment?.mode === "harbor" &&
                          viewDateStr === todayStr &&
                          !task.done && (
                            <span className="qd-task-harbor-tag">
                              {todayAdjustment.protectedKey === `task:${task.domainId}:${task.id}`
                                ? "protected"
                                : getTaskFlexibility(task) === "fixed"
                                ? "fixed · stays today"
                                : "rebalancing…"}
                            </span>
                          )}
                      </div>
                    </div>
                    <div className="qd-today-xp">+{task.xp} XP</div>
                  </div>
                  );
                })}
              </div>
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
                    <span>{dailyRewardPaused ? "Daily treasure paused in Safe Harbor" : !protectedRequirementMet ? "Complete your protected item first" : `Unlock at ${todayThreshold || 0} XP`}</span>
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
                    <span>Flexible tasks stay in the pool · rested anchor capacity is adjusted</span>
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
                    disabledReason={dailyRewardPaused ? "Safe Harbor records the day without awarding a daily treasure. Completed work still earns XP." : ""}
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

          {questLogSection}

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
          </>
          )}
        </main>
      </div>
      {designPreview && <BottomNavigation page={page} />}
    </div>
  );
}
