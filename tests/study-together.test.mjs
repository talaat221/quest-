import { test } from 'node:test';
import assert from 'node:assert/strict';
import { characterFrame, normalizeLook, studyPresence, memberActivity, memberElapsed, sharedTaskLabel, studyTime } from '../src/study-together.js';

test('private task names never leave the client, even on an away heartbeat', () => {
  assert.deepEqual(studyPresence({ activity:'studying', elapsedMs:90500, taskName:'Medical results' }), {activity:'studying',elapsedSeconds:90});
  assert.equal('taskName' in studyPresence({activity:'away',shareTask:true,taskName:'Secret'}), false);
  assert.equal(studyPresence({shareTask:true,taskName:'  Read notes  '}).taskName,'Read notes');
  assert.equal(studyPresence({shareTask:true,taskName:'x'.repeat(200)}).taskName.length,160);
  assert.equal(studyPresence({elapsedMs:-2}).elapsedSeconds,0);
  assert.equal(studyPresence({elapsedMs:1e15}).elapsedSeconds,604800);
});
test('peers tick while studying but stop extrapolating when paused, on break or disconnected', () => {
  const now=Date.parse('2026-10-13T09:00:30Z');
  const member={status:'joined',activity:'studying',lastSeenAt:'2026-10-13T09:00:00Z',elapsedSeconds:90,shareTask:true,taskName:'Read notes'};
  assert.equal(memberElapsed(member,now),120);
  assert.equal(memberElapsed({...member,activity:'break'},now),90);
  assert.equal(memberElapsed({...member,activity:'idle'},now),90);
  assert.equal(memberActivity(member,now+60000),'studying','one delayed background heartbeat is tolerated');
  assert.equal(memberActivity(member,now+181000),'away');
  assert.equal(memberElapsed(member,now+181000),90);
  assert.equal(sharedTaskLabel(member,now+181000),'Away from the room');
  assert.equal(sharedTaskLabel({...member,shareTask:false},now),'Task kept private');
  assert.equal(memberActivity({...member,lastSeenAt:null},now),'away');
  assert.equal(memberActivity({...member,status:'invited'},now),'invited');
  assert.equal(studyTime(3661),'1:01:01');
});
test('all character windows stay inside the actual transparent atlas', () => {
  assert.equal(normalizeLook('4'),4); assert.equal(normalizeLook(-1),0); assert.equal(normalizeLook(8),0);
  for(let id=0;id<6;id++) for(const pose of [false,true]) {
    const f=characterFrame(id,pose);
    assert.ok(f.x>=0 && f.y>=0 && f.x+f.width<=1086 && f.y+f.height<=1448);
  }
});
