import fs from 'node:fs';

function replaceOnce(text, from, to, label) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return text.replace(from, to);
}

const dashboardPath = 'src/quest-dashboard.jsx';
let dashboard = fs.readFileSync(dashboardPath, 'utf8');

dashboard = replaceOnce(
  dashboard,
  'import EffortXP from "./EffortXP.jsx";\nimport { recommendTaskXP, inferEffortForTask, standardizeLegacyTaskXP, initializeProgression, recordTaskAward, removeTaskAward, progressionTotals, currentWeekProgress } from "./progression.js";',
  'import EffortXP from "./EffortXP.jsx";\nimport CompetitionPage from "./CompetitionPage.jsx";\nimport { recommendTaskXP, inferEffortForTask, standardizeLegacyTaskXP, initializeProgression, recordTaskAward, removeTaskAward, progressionTotals, currentWeekProgress } from "./progression.js";',
  'dashboard import'
);

dashboard = replaceOnce(
  dashboard,
  '  const showStudyPage = page === "study";\n  const showTodayQuestsPage = page === "today-quests";\n  const anchorPageVisible = showAnchorPage;\n  const previewSubPage = designPreview && ["quests", "stats", "more", "goals", "study", "rewards"].includes(page);',
  '  const showStudyPage = page === "study";\n  const showCompetitionPage = page === "competition";\n  const showTodayQuestsPage = page === "today-quests";\n  const anchorPageVisible = showAnchorPage;\n  const previewSubPage = designPreview && ["quests", "stats", "more", "goals", "study", "rewards", "competition"].includes(page);',
  'dashboard page state'
);

dashboard = replaceOnce(
  dashboard,
  '  const thisWeekLevel = currentWeekProgress(progressionState, weekKeyStr);\n  const thisWeekLevelXP = thisWeekLevel.taskXP + thisWeekLevel.bonusXP;\n\n  const questSummaryStats = {',
  '  const thisWeekLevel = currentWeekProgress(progressionState, weekKeyStr);\n  const thisWeekLevelXP = thisWeekLevel.taskXP + thisWeekLevel.bonusXP;\n  const competitionFocusMinutes = allTasks().reduce((sum, task) => {\n    if (!task.doneAt || rewardTaskDay(task.doneAt, resetHour) !== todayStr) return sum;\n    return sum + Math.max(0, Number(task.actualMinutes) || 0);\n  }, 0);\n  const competitionName =\n    session?.user?.user_metadata?.display_name ||\n    session?.user?.user_metadata?.full_name ||\n    session?.user?.email?.split("@")[0] ||\n    "You";\n\n  const questSummaryStats = {',
  'dashboard competition stats'
);

dashboard = replaceOnce(
  dashboard,
  '          ) : showGoalsPage ? (\n            <GoalsPage domains={state.domains} todayStr={todayStr} resetHour={resetHour}\n              onAdd={questId => setGoalEditor({ questId })} onEdit={(questId, goal) => setGoalEditor({ questId, goal })}\n              onMilestone={toggleGoalMilestone} onProgress={changeGoalProgress} />\n          ) : showStatsPage ? (',
  '          ) : showGoalsPage ? (\n            <GoalsPage domains={state.domains} todayStr={todayStr} resetHour={resetHour}\n              onAdd={questId => setGoalEditor({ questId })} onEdit={(questId, goal) => setGoalEditor({ questId, goal })}\n              onMilestone={toggleGoalMilestone} onProgress={changeGoalProgress} />\n          ) : showCompetitionPage ? (\n            <CompetitionPage progression={progressionState} weekKey={weekKeyStr} todayKey={todayStr}\n              displayName={competitionName} focusMinutes={competitionFocusMinutes} level={level} />\n          ) : showStatsPage ? (',
  'dashboard competition render'
);

fs.writeFileSync(dashboardPath, dashboard);

const homeLogicPath = 'src/home-finish.js';
let homeLogic = fs.readFileSync(homeLogicPath, 'utf8');
homeLogic = replaceOnce(
  homeLogic,
  '  return ["home", "quests", "today-quests", "anchors", "stats", "more", "goals", "study", "rewards"].includes(page) ? page : "home";',
  '  return ["home", "quests", "today-quests", "anchors", "stats", "more", "goals", "study", "rewards", "competition"].includes(page) ? page : "home";',
  'home route'
);
fs.writeFileSync(homeLogicPath, homeLogic);

const homeViewPath = 'src/HomeFinish.jsx';
let homeView = fs.readFileSync(homeViewPath, 'utf8');
homeView = replaceOnce(
  homeView,
  '  const active = page === "today-quests" || page === "study" ? "quests" : page === "goals" || page === "rewards" ? "more" : page;',
  '  const active = page === "today-quests" || page === "study" ? "quests" : page === "goals" || page === "rewards" || page === "competition" ? "more" : page;',
  'bottom navigation active state'
);
homeView = replaceOnce(
  homeView,
  '      <a className="qd-home-page-link gg-more-link sr-more-link" href="#study"><img src="/study-room/boy-idle-v2.webp" alt="" /><span><strong>Study with me</strong><small>A cozy room, a quiet companion, and time for your tasks.</small></span><span aria-hidden="true">›</span></a>\n      <NotificationSettings notifications={notifications} />',
  '      <a className="qd-home-page-link gg-more-link sr-more-link" href="#study"><img src="/study-room/boy-idle-v2.webp" alt="" /><span><strong>Study with me</strong><small>A cozy room, a quiet companion, and time for your tasks.</small></span><span aria-hidden="true">›</span></a>\n      <a className="qd-home-page-link gg-more-link cp-more-link" href="#competition"><img src="/competition/competition-icon-v1.svg" alt="" /><span><strong>Competition</strong><small>Compare balanced XP and challenge friends week by week.</small></span><span aria-hidden="true">›</span></a>\n      <NotificationSettings notifications={notifications} />',
  'more competition link'
);
fs.writeFileSync(homeViewPath, homeView);

console.log('Competition page integration applied.');
