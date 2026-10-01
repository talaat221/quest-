import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFriendUsername,
  isValidFriendUsername,
  fallbackFriendUsername,
  splitFriendships,
  otherFriendId,
} from '../src/friends-core.js';

test('friend usernames normalize to a safe shared format', () => {
  assert.equal(normalizeFriendUsername(' @Talaat 22! '), 'talaat_22');
  assert.equal(isValidFriendUsername('talaat_22'), true);
  assert.equal(isValidFriendUsername('ab'), false);
  assert.match(fallbackFriendUsername('A1B2-C3D4-E5F6'), /^traveler_[a-z0-9]+$/);
});

test('friendships split into incoming outgoing and accepted', () => {
  const user = 'me';
  const rows = [
    { id: '1', requester_id: 'other-a', addressee_id: user, status: 'pending' },
    { id: '2', requester_id: user, addressee_id: 'other-b', status: 'pending' },
    { id: '3', requester_id: user, addressee_id: 'other-c', status: 'accepted' },
  ];
  const result = splitFriendships(rows, user);
  assert.deepEqual(result.incoming.map(row => row.id), ['1']);
  assert.deepEqual(result.outgoing.map(row => row.id), ['2']);
  assert.deepEqual(result.accepted.map(row => row.id), ['3']);
  assert.equal(otherFriendId(rows[2], user), 'other-c');
});
