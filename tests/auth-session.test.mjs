import { test } from 'node:test';
import assert from 'node:assert/strict';
import { observeQuestSession, questGreeting } from '../src/auth-session.js';

test('auth listener releases its lock before loading data and ignores same-user refreshes', async () => {
  let callback, locked = false, loads = 0;
  const user = { id: 'one' };
  const client = { auth: {
    onAuthStateChange(fn) { callback = fn; return { data: { subscription: { unsubscribe() {} } } }; },
    async getSession() { return { data: { session: { user } } }; },
  } };
  const stop = observeQuestSession(client, { onSession() {}, onUser() { assert.equal(locked, false); loads++; } });
  locked = true;
  assert.equal(callback('SIGNED_IN', { user }), undefined);
  locked = false;
  await new Promise(r => setTimeout(r, 5));
  callback('TOKEN_REFRESHED', { user });
  callback('SIGNED_IN', { user });
  await new Promise(r => setTimeout(r, 5));
  assert.equal(loads, 1);
  callback('SIGNED_IN', { user: { id: 'two' } });
  stop();
  await new Promise(r => setTimeout(r, 5));
  assert.equal(loads, 1, 'Unmount cancels a pending account load');
});

test('home greeting uses the current username, with account-specific fallbacks', () => {
  assert.equal(questGreeting({ username: 'nour', display_name: 'Old name' }, {}), 'nour');
  assert.equal(questGreeting(null, { user_metadata: { username: 'omar' } }), 'omar');
  assert.equal(questGreeting(null, { email: 'sara@example.test' }), 'sara');
  assert.equal(questGreeting(null, null), 'Traveler');
});
