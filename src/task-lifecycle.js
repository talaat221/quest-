import { rewardTaskDay } from "./rewards.js";
import { weekOf } from "./weekly-planner.js";

function safeWeekOf(day) {
  const value = String(day || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  try {
    return weekOf(value);
  } catch {
    return null;
  }
}

export function getTaskWeek(task) {
  if (!task) return null;
  return safeWeekOf(task.day) || safeWeekOf(task.plannedWeek);
}

export function getTaskCompletionWeek(task, resetHour = 0) {
  if (!task?.done || !task.doneAt) return null;
  try {
    const completedDay = rewardTaskDay(task.doneAt, resetHour);
    return safeWeekOf(completedDay);
  } catch {
    return null;
  }
}

export function sortQuestTasksForCurrentWeek(tasks = [], currentWeek, resetHour = 0) {
  return [...tasks]
    .filter((task) => {
      if (!task.done) return true;
      const completedWeek = getTaskCompletionWeek(task, resetHour);
      return !completedWeek || completedWeek === currentWeek;
    })
    .sort((a, b) => {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;

      if (a.done && b.done) {
        return String(b.doneAt || "").localeCompare(String(a.doneAt || ""));
      }

      const aKey = [a.day || "", a.hour ?? "", a.plannedWeek || "", a.name || ""].join("|");
      const bKey = [b.day || "", b.hour ?? "", b.plannedWeek || "", b.name || ""].join("|");
      return aKey.localeCompare(bKey);
    });
}

export function getPastUnfinishedTasks(domains = [], currentWeek) {
  const result = [];

  for (const domain of domains || []) {
    for (const task of domain.tasks || []) {
      if (task.done) continue;
      const taskWeek = getTaskWeek(task);
      if (!taskWeek || taskWeek >= currentWeek) continue;

      result.push({
        ...task,
        domainId: domain.id,
        domainName: domain.name,
        domainEmoji: domain.emoji,
        domainColor: domain.color,
        taskWeek,
      });
    }
  }

  return result.sort((a, b) => {
    const byWeek = String(a.taskWeek || "").localeCompare(String(b.taskWeek || ""));
    if (byWeek) return byWeek;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

export function getCompletedTasks(domains = []) {
  const result = [];

  for (const domain of domains || []) {
    for (const task of domain.tasks || []) {
      if (!task.done) continue;
      result.push({
        ...task,
        domainId: domain.id,
        domainName: domain.name,
        domainEmoji: domain.emoji,
        domainColor: domain.color,
      });
    }
  }

  return result.sort((a, b) =>
    String(b.doneAt || "").localeCompare(String(a.doneAt || ""))
  );
}
