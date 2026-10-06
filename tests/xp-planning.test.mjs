import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommendTaskXP, recordTaskAward, recordAnchorAward, removeTaskAward, removeAnchorAward, upgradeProgression,
  progressionTotals, standardizeLegacyTaskXP, initializeProgression, currentWeekProgress } from '../src/progression.js';
import { buildWeeklyPlan, applyWeeklyPlan, plannerPreferences, weekOf } from '../src/weekly-planner.js';
const now = new Date('2026-10-05T08:00:00'), week = '2026-10-05';
const task = (id, minutes = 60, extra = {}) => ({ id, name: `Task ${id}`, estimatedMinutes: minutes, flexibility: 'flexible', plannedWeek: week, ...extra });
const state = (tasks = [], anchors = [], extra = {}) => ({ domains: [{ id: 'q', name: 'Study', tasks }], anchors, settings: {}, ...extra });
const prefs = extra => ({ dailyMinutes: Array(7).fill(240), startMinute: 540, endMinute: 1260, ...extra });

test('long normal/high work keeps growing with diminishing marginal rewards', () => {
  const reward = (m, effort = 'normal') => recommendTaskXP({ estimatedMinutes: m, effort }).xp;
  assert.deepEqual([120,180,240,360,480,600].map(m => reward(m)), [50,60,70,82,94,100]);
  assert.equal(reward(120, 'high'),65); assert.equal(reward(120,'low'),35);
  for (const effort of ['low','normal','high']) for(let m=2;m<=1440;m++) assert.ok(reward(m,effort)>=reward(m-1,effort));
  assert.ok(reward(240)-reward(120)>reward(360)-reward(240));
});
test('award credits the long-duration amount, survives reload and deletion, and undo reverses the level', () => {
  let p=initializeProgression(null,[],[]);
  const t=task('deep',240,{effort:'high',effortTier:'deep',xp:85,xpSource:'effort-duration-v2'});
  let r=recordTaskAward(p,{domainId:'q',task:t,completedAt:now}); p=r.progression;
  assert.equal(r.award.creditedXp,85);
  p=JSON.parse(JSON.stringify(p));
  p=recordTaskAward(p,{domainId:'q',task:t,completedAt:now}).progression;
  assert.equal(progressionTotals(p).totalXP,85);
  for(let i=0;i<2;i++)p=recordTaskAward(p,{domainId:'q',task:{...t,id:String(i)},completedAt:now}).progression;
  assert.equal(progressionTotals(p).level,2);
  p=removeTaskAward(removeTaskAward(p,'q','0'),'q','1');
  assert.equal(progressionTotals(p).level,1);assert.equal(progressionTotals(p).totalXP,85);
});
test('migration reprices unfinished long tasks only and does not discard saved high effort',()=>{
  const t=task('long',240,{xp:50,effort:'high'});standardizeLegacyTaskXP(t);assert.equal(t.xp,85);
  const earned={...t,xp:50,done:true};standardizeLegacyTaskXP(earned);assert.equal(earned.xp,50);
  assert.equal(recommendTaskXP({estimatedMinutes:1,effort:'high'}).xp,10);
});
test('anchor history recovery is once-only and never double counts the original legacy snapshot',()=>{
  const p={version:3,initializedAt:'2026-10-01T12:00:00',legacyXP:25,taskAwards:{},weeklyBonuses:{}};
  const a={id:'a',name:'Walk',xpPerDay:10,history:{'2026-10-01':true,'2026-10-02':true}};
  const upgraded=upgradeProgression(p,[],[a],now);
  assert.equal(progressionTotals(upgraded).totalXP,35);
  assert.equal(progressionTotals(upgradeProgression(upgraded,[],[a],now)).totalXP,35);
  assert.equal(progressionTotals(upgradeProgression(upgraded,[],[],now)).totalXP,35);
});
test('tasks and anchors share the routine cap; anchor completion feeds the home level and undo is idempotent',()=>{
  let p=initializeProgression(null,[],[]);
  const a={id:'a',name:'Brush',estimatedMinutes:5,effort:'normal',xpPerDay:5,xpSource:'effort-duration-v2'};
  for(let i=0;i<3;i++)p=recordTaskAward(p,{domainId:'q',task:task(String(i),5),completedAt:now}).progression;
  p=recordAnchorAward(p,{anchor:a,dayKey:week,completedAt:now}).progression;
  p=recordAnchorAward(p,{anchor:a,dayKey:week,completedAt:now}).progression;
  assert.equal(progressionTotals(p).totalXP,20);
  assert.equal(currentWeekProgress(p,week).anchorXP,5);
  assert.equal(recordTaskAward(p,{domainId:'q',task:task('capped',5),completedAt:now}).award.creditedXp,0);
  p=removeAnchorAward(p,'a',week);p=removeAnchorAward(p,'a',week);
  assert.equal(progressionTotals(p).totalXP,15);
});
test('weekly plan balances flexible tasks; protects fixed work and anchor times; applying is atomic',()=>{
  const s=state([task('a',120),task('b',120),task('c',30),task('fixed',60,{day:week,hour:9,flexibility:'fixed'})],
    [{id:'anchor',name:'Workout',hour:10,estimatedMinutes:60,activeWeekdays:[1,2,3,4,5,6,7]}]);
  const before=JSON.stringify(s),plan=buildWeeklyPlan(s,week,prefs(),{now});
  assert.equal(plan.assignments.length,3);assert.equal(JSON.stringify(s),before);
  for(const assignment of plan.assignments){assert.ok(assignment.hour*60+assignment.minutes<=590 || assignment.hour>=11+10/60);assert.ok(assignment.hour*60+assignment.minutes<=1260);}
  const next=applyWeeklyPlan(s,plan,now);
  assert.equal(next.domains[0].tasks[3].hour,9);assert.equal(next.anchors[0].hour,10);
  assert.ok(next.domains[0].tasks[0].day);assert.deepEqual(next.settings.planning.dailyMinutes,Array(7).fill(240));
  next.domains[0].tasks[0].done=true;assert.throws(()=>applyWeeklyPlan(next,plan,now),/changed/);
});
test('planner offers next-week overflow and heavier-week choice, without moving completed or running tasks',()=>{
  const s=state(Array.from({length:3},(_,i)=>task(String(i),120)).concat([task('done',60,{done:true}),task('running',60,{workTimer:{startedAt:now.toISOString()}})]));
  const p=prefs({dailyMinutes:[180,0,0,0,0,0,0]});
  const plan=buildWeeklyPlan(s,week,p,{now});
  assert.equal(plan.assignments.length,1);assert.equal(plan.overflow.length,2);assert.equal(plan.tooHard,true);
  const next=applyWeeklyPlan(s,plan,now);assert.equal(next.domains[0].tasks.filter(t=>t.plannedWeek==='2026-10-12').length,2);
  const heavy=buildWeeklyPlan(s,week,p,{now,keepAll:true});assert.equal(heavy.assignments.length,3);assert.equal(heavy.tooHard,true);
});
test('future-week tasks are excluded; unscheduled legacy work belongs to current week',()=>{
  const s=state([task('future',60,{plannedWeek:'2026-10-12'}),task('legacy',60,{plannedWeek:null})]);
  assert.equal(buildWeeklyPlan(s,week,prefs(),{now}).candidates[0].id,'legacy');
  const p=buildWeeklyPlan(s,'2026-10-12',prefs(),{now});assert.equal(p.candidates.length,1);assert.equal(p.candidates[0].id,'future');
});
test('planner respects past days, exact-minute appointments, time-window ends, and paused days',()=>{
  const s=state([task('new',70),task('appointment',120,{day:'2026-10-07',hour:9+20/60,flexibility:'fixed'})],[],{voyageAdjustments:{'2026-10-08':{mode:'harbor'}}});
  const p=buildWeeklyPlan(s,week,prefs({startMinute:540,endMinute:600}),{now:new Date('2026-10-07T08:00:00')});
  assert.equal(p.assignments.length,0);assert.equal(p.overflow.length,1);
  assert.equal(p.days[0].past,true);assert.equal(p.days[3].capacity,0);
});
test('reset-hour planning never schedules earlier on the quest-day timeline',()=>{
  const s=state([task('night',30)],[],{settings:{dayResetHour:4}});
  const p=buildWeeklyPlan(s,week,prefs({startMinute:22*60,endMinute:3*60}),{now:new Date('2026-10-06T01:00:00')});
  assert.ok(p.assignments[0].day>=week);
  if(p.assignments[0].day===week)assert.ok(p.assignments[0].hour>1&&p.assignments[0].hour<3);
  assert.equal(weekOf('2026-10-11'),week);
  assert.equal(plannerPreferences({dailyMinutes:[0]}).dailyMinutes[0],0);
});

test('a preview cannot schedule a start time that passed while it was open',()=>{
  const s=state([task('late',30)]),plan=buildWeeklyPlan(s,week,prefs(),{now});
  assert.throws(()=>applyWeeklyPlan(s,plan,new Date('2026-10-05T12:00:00')),/start time has passed/);
});
