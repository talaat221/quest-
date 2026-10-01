import test from 'node:test';
import assert from 'node:assert/strict';
import { formatScheduleTime, isTimeInputValid, parseTimeInput } from '../src/schedule-time.js';
import { getAnchorTime, getDailyAnchorTimeline } from '../src/daily-anchors.js';
import { anchorTimeLabel } from '../src/anchors-page.js';
import { dueReminders } from '../supabase/functions/_shared/reminders.js';

test('typed times and phone-keyboard shorthand accept exact minutes', () => {
  for (const [input, expected] of [['10:20',620], ['1020',620], ['620',380], ['6:20',380], [' 08:05 ',485], ['0',0], ['0000',0], ['23',1380], ['2359',1439]]) {
    assert.equal(getAnchorTime(parseTimeInput(input)), expected, input);
  }
});

test('every minute survives saving, loading, editing and clock formatting', () => {
  for (let minute = 0; minute < 1440; minute++) {
    const text = `${String(Math.floor(minute / 60)).padStart(2,'0')}:${String(minute % 60).padStart(2,'0')}`;
    const stored = JSON.parse(JSON.stringify({hour:parseTimeInput(text)}));
    assert.equal(formatScheduleTime(stored.hour), text);
    assert.equal(anchorTimeLabel(stored.hour), text);
    assert.equal(getAnchorTime(stored.hour), minute);
  }
});

test('blank stays anytime; invalid inputs never silently become midnight', () => {
  for (const value of ['', '  ', null, undefined]) {
    assert.equal(parseTimeInput(value), null);
    assert.equal(isTimeInputValid(value), true);
    assert.equal(isTimeInputValid(value, true), false);
    assert.equal(formatScheduleTime(value), '');
  }
  for (const value of ['24:00','24','23:60','1260','10:2','12:345','-1','1.5','10:20 PM','abc','12::00']) {
    assert.equal(isTimeInputValid(value),false,value);
    assert.ok(Number.isNaN(parseTimeInput(value)),value);
  }
  assert.equal(isTimeInputValid('00:00', true), true);
  assert.equal(formatScheduleTime(8),'08:00');
  for (const value of [-1, 24, NaN, Infinity]) assert.equal(formatScheduleTime(value),'');
});

test('10:20 anchor stays neutral until 10:20; completion stays green', () => {
  const anchor = {id:'study',hour:parseTimeInput('10:20')};
  assert.equal(getDailyAnchorTimeline([anchor],0,new Date(2026,8,26,10,19,59))[0].status,'pending');
  assert.equal(getDailyAnchorTimeline([anchor],0,new Date(2026,8,26,10,20,0))[0].status,'due');
  assert.equal(getDailyAnchorTimeline([{...anchor,done:true}],0,new Date(2026,8,26,10,19,59))[0].status,'done');
});

test('task and anchor reminders use the typed minute, including 23:59', () => {
  for (const [time, before, due] of [
    ['10:20','2026-09-26T07:19:59Z','2026-09-26T07:20:00Z'],
    ['23:59','2026-09-26T20:58:59Z','2026-09-26T20:59:00Z'],
  ]) {
    const state = {settings:{dayResetHour:0},anchors:[{id:'study',name:'Study',hour:parseTimeInput(time),activeWeekdays:[6],history:{}}],domains:[{id:'q',tasks:[{id:'t',name:'Read',hour:parseTimeInput(time),day:'2026-09-26',done:false}]}]};
    assert.equal(dueReminders(state,{now:Date.parse(before),timezone:'Africa/Cairo'}).length,0);
    assert.deepEqual(dueReminders(state,{now:Date.parse(due),timezone:'Africa/Cairo'}).map(x=>x.kind),['anchor','task']);
  }
});
