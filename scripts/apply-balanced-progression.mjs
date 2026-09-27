import fs from 'node:fs';

const file = new URL('../src/quest-dashboard.jsx', import.meta.url);
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Balanced progression patch failed: ${label} marker was not found.`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Balanced progression patch failed: ${label} marker is ambiguous.`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

if (source.includes('from "./progression.js"')) {
  console.log('Balanced progression is already wired into quest-dashboard.jsx.');
  process.exit(0);
}

replaceOnce(
  'imports',
  'import { getSafeHarborActiveAnchorIds, isSafeHarborTask } from "./day-pause.js";',
  `import { getSafeHarborActiveAnchorIds, isSafeHarborTask } from "./day-pause.js";\nimport EffortXP from "./EffortXP.jsx";\nimport { recommendTaskXP, inferEffortForTask, initializeProgression, recordTaskAward, removeTaskAward, progressionTotals, currentWeekProgress } from "./progression.js";`
);

replaceOnce(
  'task editor state',
  `  const [name, setName] = useState("");\n  const [xp, setXp] = useState(20);\n  const [day, setDay] = useState("");\n  const [hour, setHour] = useState("");\n  const [estimatedMinutes, setEstimatedMinutes] = useState("");\n  const [estimateTouched, setEstimateTouched] = useState(false);\n  const [flexibility, setFlexibility] = useState("flexible");\n\n  const [editingTaskId, setEditingTaskId] = useState(null);\n  const [editName, setEditName] = useState("");\n  const [editXp, setEditXp] = useState(20);\n  const [editDay, setEditDay] = useState("");\n  const [editHour, setEditHour] = useState("");\n  const [editEstimatedMinutes, setEditEstimatedMinutes] = useState("");\n  const [editEstimateTouched, setEditEstimateTouched] = useState(false);\n  const [editFlexibility, setEditFlexibility] = useState("flexible");`,
  `  const [name, setName] = useState("");\n  const [effort, setEffort] = useState("normal");\n  const [day, setDay] = useState("");\n  const [hour, setHour] = useState("");\n  const [estimatedMinutes, setEstimatedMinutes] = useState("");\n  const [estimateTouched, setEstimateTouched] = useState(false);\n  const [flexibility, setFlexibility] = useState("flexible");\n\n  const [editingTaskId, setEditingTaskId] = useState(null);\n  const [editName, setEditName] = useState("");\n  const [editEffort, setEditEffort] = useState("normal");\n  const [editDay, setEditDay] = useState("");\n  const [editHour, setEditHour] = useState("");\n  const [editEstimatedMinutes, setEditEstimatedMinutes] = useState("");\n  const [editEstimateTouched, setEditEstimateTouched] = useState(false);\n  const [editFlexibility, setEditFlexibility] = useState("flexible");`
);

replaceOnce(
  'submit task',
  `  const submitTask = () => {\n    if (!name.trim() || (day && !isTimeInputValid(hour))) return;\n\n    const learned = getLearnedEstimate(domain, name);\n    const finalEstimate =\n      estimatedMinutes === "" || estimatedMinutes === null\n        ? learned\n        : Math.max(1, Number(estimatedMinutes) || 1);\n\n    onAddTask({\n      name: name.trim(),\n      xp,\n      day,\n      hour: day ? parseTimeInput(hour) : null,\n      estimatedMinutes: finalEstimate,\n      flexibility,\n    });\n    setName("");\n    setXp(20);\n    setDay("");\n    setHour("");\n    setEstimatedMinutes("");\n    setEstimateTouched(false);\n    setFlexibility("flexible");\n    setShowAdd(false);\n  };`,
  `  const submitTask = () => {\n    if (!name.trim() || (day && !isTimeInputValid(hour))) return;\n\n    const learned = getLearnedEstimate(domain, name);\n    const finalEstimate =\n      estimatedMinutes === "" || estimatedMinutes === null\n        ? learned\n        : Math.max(1, Number(estimatedMinutes) || 1);\n    if (!Number(finalEstimate)) return;\n\n    onAddTask({\n      name: name.trim(),\n      effort,\n      day,\n      hour: day ? parseTimeInput(hour) : null,\n      estimatedMinutes: finalEstimate,\n      flexibility,\n    });\n    setName("");\n    setEffort("normal");\n    setDay("");\n    setHour("");\n    setEstimatedMinutes("");\n    setEstimateTouched(false);\n    setFlexibility("flexible");\n    setShowAdd(false);\n  };`
);

replaceOnce(
  'start edit',
  `    setEditingTaskId(task.id);\n    setEditName(task.name || "");\n    setEditXp(Number(task.xp) || 10);\n    setEditDay(task.day || "");`,
  `    setEditingTaskId(task.id);\n    setEditName(task.name || "");\n    setEditEffort(inferEffortForTask(task));\n    setEditDay(task.day || "");`
);

replaceOnce(
  'cancel edit',
  `    setEditingTaskId(null);\n    setEditName("");\n    setEditXp(20);\n    setEditDay("");`,
  `    setEditingTaskId(null);\n    setEditName("");\n    setEditEffort("normal");\n    setEditDay("");`
);

replaceOnce(
  'save edit',
  `  const saveTaskEdit = () => {\n    if (!editingTaskId || !editName.trim() || (editDay && !isTimeInputValid(editHour))) return;\n\n    const learned = getLearnedEstimate(domain, editName);\n\n    onUpdateTask(editingTaskId, {\n      name: editName.trim(),\n      xp: Math.max(1, Number(editXp) || 1),\n      day: editDay || null,\n      hour: editDay ? parseTimeInput(editHour) : null,\n      estimatedMinutes:\n        editEstimatedMinutes === "" || editEstimatedMinutes === null\n          ? learned\n          : Math.max(1, Number(editEstimatedMinutes) || 1),\n      flexibility: editFlexibility,\n    });\n\n    cancelTaskEdit();\n  };`,
  `  const saveTaskEdit = () => {\n    if (!editingTaskId || !editName.trim() || (editDay && !isTimeInputValid(editHour))) return;\n\n    const learned = getLearnedEstimate(domain, editName);\n    const finalEstimate =\n      editEstimatedMinutes === "" || editEstimatedMinutes === null\n        ? learned\n        : Math.max(1, Number(editEstimatedMinutes) || 1);\n    if (!Number(finalEstimate)) return;\n\n    onUpdateTask(editingTaskId, {\n      name: editName.trim(),\n      effort: editEffort,\n      day: editDay || null,\n      hour: editDay ? parseTimeInput(editHour) : null,\n      estimatedMinutes: finalEstimate,\n      flexibility: editFlexibility,\n    });\n\n    cancelTaskEdit();\n  };`
);

replaceOnce(
  'edit XP controls',
  `              <input\n                type="number"\n                min="1"\n                value={editXp}\n                aria-label="Task XP"\n                onChange={(e) => setEditXp(e.target.value)}\n              />\n\n              <div className="qd-estimate-field" style={{ gridColumn: "1 / -1" }}>\n                <input\n                  type="number"\n                  min="1"\n                  step="5"\n                  value={editEstimatedMinutes}\n                  placeholder="Estimate"\n                  aria-label="Estimated minutes"\n                  onChange={(e) => {\n                    setEditEstimatedMinutes(e.target.value);\n                    setEditEstimateTouched(true);\n                  }}\n                />\n                <span className="qd-estimate-unit">estimated minutes</span>\n              </div>\n\n              {getLearnedEstimate(domain, editName) && (\n                <div className="qd-time-hint">\n                  Learned estimate: about {formatMinutes(getLearnedEstimate(domain, editName))} from {getTimingSampleCount(domain, editName)} previous {getTimingSampleCount(domain, editName) === 1 ? "run" : "runs"}. You can override it.\n                </div>\n              )}`,
  `              <EffortXP\n                estimatedMinutes={editEstimatedMinutes}\n                onEstimatedMinutesChange={(value) => { setEditEstimatedMinutes(value); setEditEstimateTouched(true); }}\n                effort={editEffort}\n                onEffortChange={setEditEffort}\n                learnedEstimate={getLearnedEstimate(domain, editName)}\n                learnedSamples={getTimingSampleCount(domain, editName)}\n              />`
);

replaceOnce(
  'add XP controls',
  `          <input\n            type="number"\n            placeholder="XP"\n            aria-label="Task XP"\n            value={xp}\n            min="1"\n            onChange={(e) => setXp(e.target.value)}\n            style={{ width: 60 }}\n          />\n\n          <div className="qd-estimate-field">\n            <input\n              type="number"\n              min="1"\n              step="5"\n              placeholder="Estimate"\n              value={estimatedMinutes}\n              aria-label="Estimated minutes"\n              onChange={(e) => {\n                setEstimatedMinutes(e.target.value);\n                setEstimateTouched(true);\n              }}\n            />\n            <span className="qd-estimate-unit">min estimate</span>\n          </div>\n\n          {learnedEstimate && (\n            <div className="qd-time-hint" style={{ width: "100%" }}>\n              Odyssey learned ~{formatMinutes(learnedEstimate)} for “{name.trim()}” in {domain.name} from {learnedSamples} previous {learnedSamples === 1 ? "run" : "runs"}.\n            </div>\n          )}`,
  `          <EffortXP\n            estimatedMinutes={estimatedMinutes}\n            onEstimatedMinutesChange={(value) => { setEstimatedMinutes(value); setEstimateTouched(true); }}\n            effort={effort}\n            onEffortChange={setEffort}\n            learnedEstimate={learnedEstimate}\n            learnedSamples={learnedSamples}\n          />`
);

replaceOnce(
  'add button requirement',
  '<button type="button" onClick={submitTask} disabled={!!day && !isTimeInputValid(hour)}>Add</button>',
  '<button type="button" onClick={submitTask} disabled={!Number(estimatedMinutes || learnedEstimate) || (!!day && !isTimeInputValid(hour))}>Add</button>'
);

replaceOnce(
  'progression initialization',
  `  // ====================================================\n  // AUTO SAVE\n  // ====================================================`,
  `  // Freeze all XP earned before this system as legacy progress exactly once.\n  // From that point onward new task completions are recorded in a separate\n  // immutable award ledger, so renaming/deleting tasks cannot rewrite history.\n  useEffect(() => {\n    if (!loaded || !state || state.settings?.progression?.initializedAt) return;\n    setState(previous => {\n      if (!previous || previous.settings?.progression?.initializedAt) return previous;\n      const next = clone(previous);\n      next.settings ||= {};\n      next.settings.progression = initializeProgression(\n        next.settings.progression,\n        next.domains,\n        next.anchors\n      );\n      return next;\n    });\n  }, [loaded, state?.settings?.progression?.initializedAt]);\n\n  // ====================================================\n  // AUTO SAVE\n  // ====================================================`
);

replaceOnce(
  'task completion ledger',
  `  const toggleTask = (domainId, taskId) => {\n    const domain = state.domains.find(d => d.id === domainId);\n    const task = domain?.tasks.find(t => t.id === taskId);\n    if (!task) return;\n    if (task.done) {\n      updateState(next => {\n        const d = next.domains.find(item => item.id === domainId);\n        undoTimedTask(d, d?.tasks.find(item => item.id === taskId));\n      });\n      playSFX("undo");\n      return;\n    }\n    const now = Date.now(), previewDomain = clone(domain);\n    const summary = completeTimedTask(previewDomain, previewDomain.tasks.find(t => t.id === taskId), now);\n    updateState(next => {\n      const d = next.domains.find(item => item.id === domainId);\n      completeTimedTask(d, d?.tasks.find(item => item.id === taskId), now);\n    });\n    setCompletionSummary(summary);\n    setClockNow(new Date(now));\n    setRewardCompletionEvent(event => event + 1);\n    playSFX("complete");\n  };`,
  `  const toggleTask = (domainId, taskId) => {\n    const domain = state.domains.find(d => d.id === domainId);\n    const task = domain?.tasks.find(t => t.id === taskId);\n    if (!task) return;\n    if (task.done) {\n      updateState(next => {\n        next.settings ||= {};\n        if (next.settings.progression?.initializedAt) {\n          next.settings.progression = removeTaskAward(next.settings.progression, domainId, taskId);\n        }\n        const d = next.domains.find(item => item.id === domainId);\n        undoTimedTask(d, d?.tasks.find(item => item.id === taskId));\n      });\n      playSFX("undo");\n      return;\n    }\n    const now = Date.now(), previewDomain = clone(domain);\n    const summary = completeTimedTask(previewDomain, previewDomain.tasks.find(t => t.id === taskId), now);\n    updateState(next => {\n      next.settings ||= {};\n      next.settings.progression = initializeProgression(\n        next.settings.progression, next.domains, next.anchors, now\n      );\n      const d = next.domains.find(item => item.id === domainId);\n      const completedTask = d?.tasks.find(item => item.id === taskId);\n      completeTimedTask(d, completedTask, now);\n      const recorded = recordTaskAward(next.settings.progression, {\n        domainId, task: completedTask, completedAt: completedTask?.doneAt || now, resetHour\n      });\n      next.settings.progression = recorded.progression;\n    });\n    setCompletionSummary(summary);\n    setClockNow(new Date(now));\n    setRewardCompletionEvent(event => event + 1);\n    playSFX("complete");\n  };`
);

replaceOnce(
  'add task signature',
  `    {\n      name,\n      xp,\n      day,\n      hour,\n      estimatedMinutes,\n      flexibility,\n    },`,
  `    {\n      name,\n      effort = "normal",\n      day,\n      hour,\n      estimatedMinutes,\n      flexibility,\n    },`
);

replaceOnce(
  'task creation XP',
  `      domain.tasks.push({\n        id: taskId,\n\n        name,\n\n        xp:\n          Number(xp) || 10,`,
  `      const xpRecommendation = recommendTaskXP({ estimatedMinutes, effort });\n\n      domain.tasks.push({\n        id: taskId,\n\n        name,\n\n        xp: xpRecommendation.xp,\n        effort: xpRecommendation.effort,\n        effortTier: xpRecommendation.key,\n        xpSource: xpRecommendation.source,`
);

replaceOnce(
  'task edit XP',
  `      task.name = changes.name;\n      task.xp = Math.max(1, Number(changes.xp) || 1);\n      task.day = changes.day || null;`,
  `      task.name = changes.name;\n      task.day = changes.day || null;`
);

replaceOnce(
  'task edit recommendation',
  `      task.flexibility = changes.flexibility === "fixed" ? "fixed" : "flexible";`,
  `      task.flexibility = changes.flexibility === "fixed" ? "fixed" : "flexible";\n      // Earned XP is historical. Only unfinished work can be repriced.\n      if (!task.done) {\n        const xpRecommendation = recommendTaskXP({\n          estimatedMinutes: task.estimatedMinutes,\n          effort: changes.effort || inferEffortForTask(task),\n        });\n        task.xp = xpRecommendation.xp;\n        task.effort = xpRecommendation.effort;\n        task.effortTier = xpRecommendation.key;\n        task.xpSource = xpRecommendation.source;\n      }`
);

replaceOnce(
  'credited daily XP',
  `  const dayTaskXP = (ds) =>\n    allTasks().reduce(\n      (sum, task) =>\n        sum +\n        (\n          task.done &&\n          task.doneAt &&\n          rewardTaskDay(task.doneAt, resetHour) === ds\n            ? Number(task.xp) || 0\n            : 0\n        ),\n      0\n    );`,
  `  const creditedTaskXP = (task) => {\n    const award = state?.settings?.progression?.taskAwards?.[\`${'${task.domainId}:${task.id}'}\`];\n    return award ? Math.max(0, Number(award.creditedXp) || 0) : Math.max(0, Number(task.xp) || 0);\n  };\n\n  const dayTaskXP = (ds) =>\n    allTasks().reduce(\n      (sum, task) =>\n        sum +\n        (\n          task.done &&\n          task.doneAt &&\n          rewardTaskDay(task.doneAt, resetHour) === ds\n            ? creditedTaskXP(task)\n            : 0\n        ),\n      0\n    );`
);

replaceOnce(
  'credited weekly XP',
  `      return sum + (completedThisWeek ? Number(task.xp) || 0 : 0);`,
  `      return sum + (completedThisWeek ? creditedTaskXP(task) : 0);`
);

replaceOnce(
  'level calculation',
  `  const lifetimeXP =\n    state.domains.reduce(\n      (total, domain) =>\n        total +\n        domain.tasks.reduce(\n          (taskTotal, task) => taskTotal + (task.done ? Number(task.xp) || 0 : 0),\n          0\n        ),\n      0\n    ) +\n    state.anchors.reduce(\n      (total, anchor) =>\n        total +\n        Object.values(anchor.history || {}).filter(Boolean).length *\n          (Number(anchor.xpPerDay) || 0),\n      0\n    );\n  const questSummaryStats = {\n    activeQuests: state.domains.length,\n    doneThisMonth: allTasks().filter(\n      (task) =>\n        task.done &&\n        task.doneAt &&\n        isSameMonth(String(task.doneAt).slice(0, 10), today)\n    ).length,\n    remaining: allTasks().filter((task) => !task.done).length,\n    totalXP: lifetimeXP,\n  };\n\n  const level = Math.max(1, Math.floor(lifetimeXP / 500) + 1);\n  const levelXP = lifetimeXP % 500;`,
  `  const progressionState = state.settings?.progression?.initializedAt\n    ? state.settings.progression\n    : initializeProgression(state.settings?.progression, state.domains, state.anchors);\n  const progression = progressionTotals(progressionState);\n  const lifetimeXP = progression.earnedXP;\n  const level = progression.level;\n  const levelXP = progression.currentXP;\n  const levelXPNeeded = progression.requiredXP;\n  const thisWeekLevel = currentWeekProgress(progressionState, weekKeyStr);\n  const thisWeekLevelXP = thisWeekLevel.taskXP + thisWeekLevel.bonusXP;\n\n  const questSummaryStats = {\n    activeQuests: state.domains.length,\n    doneThisMonth: allTasks().filter(\n      (task) =>\n        task.done &&\n        task.doneAt &&\n        isSameMonth(String(task.doneAt).slice(0, 10), today)\n    ).length,\n    remaining: allTasks().filter((task) => !task.done).length,\n    totalXP: lifetimeXP,\n  };`
);

replaceOnce(
  'level bar',
  `            <div className="qd-level-card" aria-label={\`Level ${'${level}'}, ${'${levelXP}'} of 500 experience points\`}>\n              <div className="qd-level-badge">LV {level}</div>\n              <div className="qd-level-track">\n                <div className="qd-level-fill" style={{ width: \`${'${Math.min(100, (levelXP / 500) * 100)}'}%\` }} />\n              </div>\n              <div className="qd-level-value">{levelXP} / 500 XP</div>\n            </div>`,
  `            <div className="qd-level-card" aria-label={\`Level ${'${level}'}, ${'${levelXP}'} of ${'${levelXPNeeded}'} experience points\`}>\n              <div className="qd-level-badge">LV {level}</div>\n              <div className="qd-level-track">\n                <div className="qd-level-fill" style={{ width: \`${'${Math.min(100, levelXPNeeded ? (levelXP / levelXPNeeded) * 100 : 0)}'}%\` }} />\n              </div>\n              <div className="qd-level-value">{levelXP} / {levelXPNeeded} XP</div>\n              <div className="qd-level-week-note">\n                This week +{thisWeekLevelXP} XP · {thisWeekLevel.tasks} eligible tasks\n                {thisWeekLevel.bonusXP > 0 ? \` · +${'${thisWeekLevel.bonusXP}'} consistency\` : ""}\n              </div>\n            </div>`
);

replaceOnce(
  'study room default task',
  `              onCreate={({ domainId, name, startNow, pomodoro }) => addTask(domainId, {\n                name, xp: 10, day: todayStr, hour: null,\n                estimatedMinutes: getLearnedEstimate(state.domains.find(domain => domain.id === domainId), name), flexibility: "flexible",\n              }, startNow, pomodoro)} />`,
  `              onCreate={({ domainId, name, startNow, pomodoro }) => addTask(domainId, {\n                name, effort: "normal", day: todayStr, hour: null,\n                estimatedMinutes: getLearnedEstimate(state.domains.find(domain => domain.id === domainId), name) || 20, flexibility: "flexible",\n              }, startNow, pomodoro)} />`
);

fs.writeFileSync(file, source);
console.log('Balanced progression wired into src/quest-dashboard.jsx.');
