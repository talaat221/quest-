import { isTaskWorking } from './task-timer.js';

export const studyTaskKey = (domainId, taskId) => JSON.stringify([domainId, taskId]);

export function getStudyTasks(domains = [], todayStr = '') {
  return domains.flatMap(domain => (domain.tasks || []).filter(task => !task.done).map(task => ({
    key: studyTaskKey(domain.id, task.id), domain, task,
  }))).sort((a, b) => Number(b.task.day === todayStr) - Number(a.task.day === todayStr));
}

// The shared active timer always wins, including after reload or entry from Quests.
export function getStudySelection(items, selectedKey) {
  return items.find(item => isTaskWorking(item.task))
    || items.find(item => item.key === selectedKey)
    || items.find(item => Number(item.task.workTimer?.elapsedMs) > 0)
    || items[0]
    || null;
}
