function dayNumber(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return Math.floor(date.getTime() / 86400000);
}

// A streak is consecutive quest days with at least one completed anchor/task.
// Today remains open: yesterday's streak is kept until today's reset finishes.
export function getCurrentStreak({ anchors = [], tasks = [], todayStr, resetHour = 0 }) {
  const today = dayNumber(todayStr);
  if (today === null) return 0;
  const activeDays = new Set();
  for (const anchor of anchors) {
    for (const [day, completed] of Object.entries(anchor.history || {})) {
      const number = dayNumber(day);
      if (completed && number !== null && number <= today) activeDays.add(number);
    }
  }
  const reset = Math.min(23, Math.max(0, Number(resetHour) || 0));
  for (const task of tasks) {
    if (!task.done || !task.doneAt) continue;
    const date = new Date(task.doneAt);
    if (!Number.isFinite(date.getTime())) continue;
    if (date.getHours() < reset) date.setDate(date.getDate() - 1);
    const number = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
    if (number <= today) activeDays.add(number);
  }
  let day = activeDays.has(today) ? today : today - 1;
  let streak = 0;
  while (activeDays.has(day)) { streak += 1; day -= 1; }
  return streak;
}

export function getHomePage(hash = "") {
  const page = hash.replace(/^#/, "");
  if (page === "voyage") return "stats";
  if (page === "rewards") return "more";
  return ["home", "quests", "today-quests", "anchors", "stats", "more", "goals"].includes(page) ? page : "home";
}

export function getDaySaveStatus(sync) {
  if (sync.state === "conflict") return "conflict";
  if (sync.state === "synced" && sync.pending === 0) return "saved";
  return "pending";
}
