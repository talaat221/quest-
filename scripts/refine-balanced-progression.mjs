import fs from 'node:fs';

const file = new URL('../src/quest-dashboard.jsx', import.meta.url);
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Balanced progression refinement failed: ${label} marker was not found.`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Balanced progression refinement failed: ${label} marker is ambiguous.`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

if (!source.includes('standardizeLegacyTaskXP')) {
  replaceOnce(
    'progression import',
    'import { recommendTaskXP, inferEffortForTask, initializeProgression, recordTaskAward, removeTaskAward, progressionTotals, currentWeekProgress } from "./progression.js";',
    'import { recommendTaskXP, inferEffortForTask, standardizeLegacyTaskXP, initializeProgression, recordTaskAward, removeTaskAward, progressionTotals, currentWeekProgress } from "./progression.js";'
  );

  replaceOnce(
    'legacy progression initialization',
    `      next.settings.progression = initializeProgression(\n        next.settings.progression,\n        next.domains,\n        next.anchors\n      );\n      return next;`,
    `      next.settings.progression = initializeProgression(\n        next.settings.progression,\n        next.domains,\n        next.anchors\n      );\n      // Completed work keeps every XP already earned. Only unfinished legacy\n      // tasks are rounded onto the new 5/10/20/35/50 XP scale.\n      for (const domain of next.domains || []) {\n        for (const task of domain.tasks || []) standardizeLegacyTaskXP(task);\n      }\n      return next;`
  );
}

const oldSave = '<button type="button" onClick={saveTaskEdit} disabled={!!editDay && !isTimeInputValid(editHour)}>Save changes</button>';
if (source.includes(oldSave)) {
  source = source.replace(
    oldSave,
    '<button type="button" onClick={saveTaskEdit} disabled={!Number(editEstimatedMinutes || getLearnedEstimate(domain, editName)) || (!!editDay && !isTimeInputValid(editHour))}>Save changes</button>'
  );
}

fs.writeFileSync(file, source);
console.log('Balanced progression refinements applied.');
