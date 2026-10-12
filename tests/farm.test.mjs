import { test } from 'node:test';
import assert from 'node:assert/strict';
import { farmChestProgress, farmGrowth, farmTitle, farmCareCopy } from '../src/farm.js';
import { buildWeeklyPlan, plannerPreferences } from '../src/weekly-planner.js';

test('chest progress stays at the next unclaimed milestone after undo/redo',()=>{
  assert.deepEqual(farmChestProgress({earnedXP:99,openedChests:0}),{next:1,ready:0,remaining:1,percent:99});
  assert.equal(farmChestProgress({earnedXP:100,openedChests:0}).ready,1);
  assert.equal(farmChestProgress({earnedXP:350,openedChests:1}).ready,2);
  for(const xp of [70,100])assert.equal(farmChestProgress({earnedXP:xp,openedChests:1}).ready,0);
});
test('each seed grows only from XP earned since it was planted',()=>{
  const plant={species:'moon-lily',plantedXP:100};
  assert.equal(farmGrowth({growthXP:120},plant).stage,'Seedling');
  assert.equal(farmGrowth({growthXP:130},plant).stage,'Growing');
  assert.equal(farmGrowth({growthXP:170},plant).stage,'Blooming');
  assert.equal(farmGrowth({growthXP:170},plant).sprite,6);
});
test('rare titles persist through plant loss and legendary titles take priority',()=>{
  assert.equal(farmTitle({discovered:{carrot:5}}),null);
  assert.equal(farmTitle({plants:[],discovered:{'moon-lily':1}}).title,'Moon Lily Keeper');
  assert.equal(farmTitle({discovered:{'moon-lily':1,starflower:1}}).title,'Starlight Garden Keeper');
  assert.match(farmCareCopy({care:{protected:true,tasks:0,anchors:0}}),/protected/);
});
test('weekly capacity uses minutes: twenty tiny tasks weigh less than one long task',()=>{
  const week='2026-10-05',now=new Date(`${week}T08:00:00`);
  const make=tasks=>({settings:{},domains:[{id:'q',tasks}],anchors:[]});
  const short=Array.from({length:20},(_,i)=>({id:String(i),estimatedMinutes:5,plannedWeek:week}));
  const long=[{id:'long',estimatedMinutes:300,plannedWeek:week}];
  const a=buildWeeklyPlan(make(short),week,{}, {now});
  const b=buildWeeklyPlan(make(long),week,{}, {now});
  assert.equal(a.totalMinutes,100); assert.equal(a.tooHard,false);
  assert.equal(b.totalMinutes,300); assert.equal(b.tooHard,true);
  assert.ok(b.warnings.some(w=>w.includes('smaller sessions')));
});
test('starter budget is adjustable and anchors consume real estimated minutes',()=>{
  assert.equal(plannerPreferences().dailyMinutes.reduce((a,b)=>a+b),1200);
  assert.deepEqual(plannerPreferences({dailyMinutes:[0,60,90,120,150,180,210]}).dailyMinutes,[0,60,90,120,150,180,210]);
  const s={settings:{},domains:[],anchors:[{id:'a',estimatedMinutes:40,hour:9,activeWeekdays:[1]}]};
  const p=buildWeeklyPlan(s,'2026-10-05',{}, {now:new Date('2026-10-05T08:00:00')});
  assert.equal(p.days[0].anchorMinutes,40);assert.equal(p.totalMinutes,40);
});
