import test from 'node:test';
import assert from 'node:assert/strict';
import { rankedMembers, roundPhase, remainingTime, activityLabel } from '../src/competition-view.js';
import { normalizeReminders } from '../supabase/functions/_shared/reminders.js';
test('equal XP is a tie, without an incentive to split work into more tasks',()=>{
 const entries=[{id:'a',name:'A',status:'accepted',xp:20,tasks:1},{id:'b',name:'B',status:'accepted',xp:20,tasks:10},{id:'c',name:'C',status:'accepted',xp:10},{id:'d',status:'pending',xp:100}];
 assert.deepEqual(rankedMembers(entries).map(m=>[m.id,m.rank]),[['a',1],['b',1],['c',3]]);
});
test('end boundary closes rounds and expired lobbies cannot appear active',()=>{
 const now=Date.parse('2026-10-05T12:00:00Z');
 assert.equal(roundPhase({phase:'active',endsAt:'2026-10-05T12:00:00Z'},now),'finished');
 assert.equal(roundPhase({phase:'lobby',createdAt:'2026-09-20T12:00:00Z'},now),'expired');
 assert.equal(remainingTime('2026-10-06T12:00:00Z',now),'1d 0h left');
});
test('private feed fallback never invents or leaks a task name',()=>{
 assert.equal(activityLabel({source:'task',taskName:null}),'A quest task');
 assert.equal(activityLabel({source:'anchor',taskName:null}),'A daily anchor');
 assert.equal(activityLabel({source:'task',taskName:'Study'}),'Study');
});
test('friend alerts require explicit opt-in and survive preference normalization',()=>{
 assert.equal(normalizeReminders({}).friends,false);
 assert.equal(normalizeReminders({friends:false}).friends,false);
 assert.equal(normalizeReminders({friends:true}).friends,true);
 assert.equal(normalizeReminders({friends:'true'}).friends,false);
});
