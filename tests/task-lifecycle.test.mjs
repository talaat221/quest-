import test from 'node:test';
import assert from 'node:assert/strict';
import {sortQuestTasksForCurrentWeek,getTaskCompletionWeek,getCompletedTasks,getPastUnfinishedTasks} from '../src/task-lifecycle.js';
test('unfinished tasks stay first; this week completions stay below; earlier completions remain in history',()=>{
 const tasks=[{id:'old',done:true,doneAt:'2026-10-03T12:00:00'}, {id:'today',done:true,doneAt:'2026-10-05T12:00:00'}, {id:'new',name:'New step',done:false}, {id:'late',day:'2026-09-30',done:false}];
 const original=JSON.stringify(tasks),visible=sortQuestTasksForCurrentWeek(tasks,'2026-10-05');
 assert.deepEqual(visible.map(x=>x.id),['new','late','today']);assert.equal(JSON.stringify(tasks),original);
 assert.equal(getCompletedTasks([{id:'q',tasks}]).length,2);
 assert.deepEqual(getPastUnfinishedTasks([{id:'q',tasks}],'2026-10-05').map(x=>x.id),['late']);
 assert.deepEqual(sortQuestTasksForCurrentWeek(tasks,'2026-10-12').map(x=>x.id),['new','late']);
});
test('undoing completion returns work to the active list; reset hour preserves late-Sunday completion',()=>{
 const task={id:'late',done:true,doneAt:'2026-10-05T01:00:00'};
 assert.equal(getTaskCompletionWeek(task,4),'2026-09-28');
 assert.equal(sortQuestTasksForCurrentWeek([task],'2026-10-05',4).length,0);
 assert.equal(sortQuestTasksForCurrentWeek([{...task,done:false,doneAt:null}],'2026-10-05',4).length,1);
});
