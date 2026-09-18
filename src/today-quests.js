import { getAnchorTime } from "./daily-anchors.js";

function completionDate(doneAt, resetHour) {
  if (!doneAt) return null;
  const date = new Date(doneAt);
  if (!Number.isFinite(date.getTime())) return null;
  if (date.getHours() < resetHour) date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function durationLabel(minutes) {
  const value = Math.round(Number(minutes));
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value < 60) return `${value} minute${value === 1 ? "" : "s"}`;
  const hours = Math.floor(value / 60);
  const remainder = value % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours} hour${hours === 1 ? "" : "s"}`;
}

// These are views of the existing records, never a second copy of task state.
// Anchors have already been filtered to this quest day by the dashboard.
export function getTodayQuestItems({ anchors = [], tasks = [], todayStr, resetHour = 0 }) {
  const items = anchors.map((anchor) => ({
    ...anchor,
    key: `anchor:${anchor.id}`,
    source: "anchor",
    xp: Number(anchor.xpPerDay) || 0,
    detail: anchor.paused && !anchor.done ? "Paused today" : `${anchor.done ? 1 : 0}/1 today`,
  }));

  for (const task of tasks) {
    const completedToday = task.done && completionDate(task.doneAt, resetHour) === todayStr;
    if (task.day !== todayStr && !completedToday) continue;
    const duration = durationLabel(task.done ? task.actualMinutes : task.estimatedMinutes);
    items.push({
      ...task,
      key: `task:${task.domainId}:${task.id}`,
      source: "task",
      emoji: task.emoji || task.domainEmoji,
      xp: Number(task.xp) || 0,
      detail: duration || (task.done ? "Completed" : task.domainName || "Quest task"),
    });
  }

  const resetMinutes = Math.min(23, Math.max(0, Number(resetHour) || 0)) * 60;
  const order = (item) => {
    // A task completed early from another date belongs in today's list, but
    // its future appointment time should not reorder today's scheduled work.
    const time = item.source === "task" && item.day !== todayStr ? null : getAnchorTime(item.hour);
    return time === null ? Infinity : (time - resetMinutes + 1440) % 1440;
  };
  return items.sort((a, b) => order(a) - order(b));
}
