// Run with: node --experimental-vm-modules --test tests/account-reset.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { isEmptyQuestAccount } from '../src/account-reset.js';

const userId = 'account-a';
const key = `quest-offline-v3:${userId}`;
const copy = (data) => JSON.parse(JSON.stringify(data));
const empty = () => ({ domains: [], anchors: [], rewards: { daily: [], weekly: [] }, claimed: { daily: {}, weekly: {} }, voyageAdjustments: {}, settings: { dayThresholdPct: 70, weekThresholdPct: 70, dayResetHour: 0 } });
const populated = () => ({ ...empty(), domains: [{ id: 'q1', name: 'Study', monthlyTarget: 5, tasks: [{ id: 't1', name: 'Read', xp: 30, done: true, doneAt: '2026-09-25T10:00:00Z' }] }], anchors: [{ id: 'a1', name: 'Gym', xpPerDay: 15, history: { '2026-09-25': true } }], rewards: { daily: ['Break'], weekly: ['Film'] }, claimed: { daily: { '2026-09-25': 'Break' }, weekly: {} }, voyageAdjustments: { '2026-09-25': { mode: 'harbor' } }, settings: { dayResetHour: 4, dayThresholdPct: 80, weekThresholdPct: 75 } });
const record = (data = populated(), extra = {}) => ({ data: copy(data), baseData: copy(data), baseHash: JSON.stringify(data), baseRevision: 1, baseUpdatedAt: null, dirty: false, cachedAt: '2026-09-25T12:00:00Z', localRevision: 1, pendingEdits: 0, conflict: null, resetRevision: 0, ...extra });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

async function harness({ online = true, cache = record(), uid = userId } = {}) {
  const values = new Map([[key, JSON.stringify(cache)], ['sb-auth-token', 'keep-login'], ['quest-offline-v3:account-b', 'other-account'], [`quest-offline-v2:${userId}`, 'old-data']]);
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k), key: i => [...values.keys()][i], get length() { return values.size; } };
  const window = new EventTarget(); window.location = { reload() {} };
  const cloud = { data: populated(), revision: 1, resetRevision: 0, supportsReset: true, uid, fail: null, writes: [], beforeCommit: null };
  const snapshot = () => ({ data: copy(cloud.data), revision: cloud.revision, ...(cloud.supportsReset ? { resetRevision: cloud.resetRevision } : {}), updatedAt: '2026-09-25T12:00:00Z' });
  const raw = {
    auth: { getSession: async () => ({ data: { session: cloud.uid ? { user: { id: cloud.uid } } : null }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { data: copy(cloud.data), updated_at: snapshot().updatedAt }, error: null }) }) }) }),
    rpc: async (name, args) => {
      if (name === 'get_my_quest_snapshot') return { data: snapshot(), error: null };
      assert.equal(name, 'apply_my_quest_changes');
      await cloud.beforeCommit?.(args);
      if (cloud.fail) return { data: null, error: cloud.fail };
      if (args.p_expected_revision !== cloud.revision && !args.p_force) return { data: null, error: { code: '40001' } };
      cloud.writes.push(copy(args));
      if (args.p_changes.resetAccount) {
        assert.equal(args.p_changes.resetUserId, cloud.uid);
        cloud.data = empty(); cloud.resetRevision = cloud.revision + 1;
      } else {
        for (const quest of args.p_changes.questUpserts || []) {
          const old = cloud.data.domains.find(q => q.id === quest.id);
          if (old) Object.assign(old, quest); else cloud.data.domains.push({ ...quest, tasks: [] });
        }
      }
      cloud.revision += 1;
      return { data: snapshot(), error: null };
    },
  };
  const context = vm.createContext({ console, JSON, Map, Set, Date, Promise, Number, String, Object, Array, Error, CustomEvent, Event, window, localStorage: storage, navigator: { onLine: online }, setTimeout, clearTimeout });
  const module = new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(new URL('../src/supabaseClient.ts', import.meta.url), 'utf8')), { context });
  await module.link(async (name) => {
    if (name === '@supabase/supabase-js') return new vm.SyntheticModule(['createClient'], function () { this.setExport('createClient', () => raw); }, { context });
    if (name === './account-reset.js') return new vm.SyntheticModule(['isEmptyQuestAccount'], function () { this.setExport('isEmptyQuestAccount', isEmptyQuestAccount); }, { context });
    throw new Error(`Unexpected import: ${name}`);
  });
  await module.evaluate();
  return { client: module.namespace, cloud, values, window, cached: () => JSON.parse(values.get(key)) };
}

test('confirmed restart clears cloud and this device, keeps login and other accounts', async () => {
  const h = await harness(); let notified;
  h.client.subscribeQuestAccountReset(value => { notified = value; });
  const result = await h.client.resetQuestAccount(userId);
  assert.ok(isEmptyQuestAccount(result)); assert.ok(isEmptyQuestAccount(h.cloud.data));
  assert.ok(isEmptyQuestAccount(h.cached().data)); assert.equal(h.cached().dirty, false);
  assert.equal(h.cached().pendingEdits, 0); assert.equal(h.cached().resetRevision, 2);
  assert.equal(h.cached().baseRevision, 2); assert.equal(notified.userId, userId);
  assert.equal(h.values.get('sb-auth-token'), 'keep-login');
  assert.equal(h.values.get('quest-offline-v3:account-b'), 'other-account');
  assert.equal(h.values.has(`quest-offline-v2:${userId}`), false);
  assert.equal(h.cloud.writes[0].p_force, false);
});

test('offline and signed-out attempts never write or clear cached progress', async () => {
  for (const options of [{ online: false }, { uid: null }, { uid: 'account-b' }]) {
    const h = await harness(options), before = h.values.get(key);
    await assert.rejects(h.client.resetQuestAccount(userId));
    assert.equal(h.values.get(key), before); assert.equal(h.cloud.writes.length, 0);
  }
});

test('cloud failures and concurrent edits leave progress intact and surface an error', async () => {
  for (const error of [{ message: 'network failed' }, { code: '40001' }]) {
    const h = await harness(), before = h.values.get(key); h.cloud.fail = error;
    await assert.rejects(h.client.resetQuestAccount(userId), error.code ? /another device/ : /could not be confirmed/);
    assert.equal(h.values.get(key), before); assert.equal(h.cloud.writes.length, 0);
    h.cloud.fail = null;
    await h.client.resetQuestAccount(userId); // The failure must release its lock.
    assert.ok(isEmptyQuestAccount(h.cloud.data));
  }
});

test('an old server cannot report a successful reset', async () => {
  const h = await harness(); h.cloud.supportsReset = false;
  await assert.rejects(h.client.resetQuestAccount(userId), /Could not verify/);
  assert.equal(h.cloud.writes.length, 0);
});

test('reset waits for an in-flight save, rejects stale autosaves and duplicate clicks', async () => {
  const local = populated(); local.domains[0].name = 'New study name';
  const h = await harness({ cache: record(populated(), { data: local, dirty: true, pendingEdits: 1 }) });
  const entered = deferred(), gate = deferred();
  h.cloud.beforeCommit = async args => { if (!args.p_changes.resetAccount) { entered.resolve(); await gate.promise; } };
  const saving = h.client.flushQuestSync(); await entered.promise;
  const resetting = h.client.resetQuestAccount(userId);
  await assert.rejects(h.client.resetQuestAccount(userId), /already restarting/);
  const rejected = await h.client.supabase.from('quest_data').upsert({ user_id: userId, data: populated() });
  assert.match(rejected.error.message, /in progress/);
  gate.resolve(); await saving; await resetting;
  assert.equal(h.cloud.writes.length, 2);
  assert.equal(h.cloud.writes[1].p_changes.resetAccount, true);
  assert.ok(isEmptyQuestAccount(h.cached().data));
});

test('an older offline device adopts a reset instead of uploading its old tasks', async () => {
  const h = await harness({ cache: record(populated(), { dirty: true, pendingEdits: 3 }) });
  h.cloud.data = empty(); h.cloud.revision = 5; h.cloud.resetRevision = 5;
  await h.client.flushQuestSync();
  assert.equal(h.cloud.writes.length, 0); assert.ok(isEmptyQuestAccount(h.cached().data));
  assert.equal(h.cached().conflict, null); assert.equal(h.cached().dirty, false);
});

test('reset replaces a pre-existing conflict, even if Keep this device is pressed', async () => {
  const h = await harness({ cache: record(populated(), { dirty: true, conflict: { remoteData: populated(), remoteRevision: 2 } }) });
  h.cloud.data = empty(); h.cloud.revision = 5; h.cloud.resetRevision = 5;
  await h.client.resolveQuestConflict('local');
  assert.equal(h.cloud.writes.length, 0); assert.ok(isEmptyQuestAccount(h.cached().data));
});

test('a clean device discovers the reset when it returns to the app', async () => {
  const h = await harness(); h.cloud.data = empty(); h.cloud.revision = 5; h.cloud.resetRevision = 5;
  h.window.dispatchEvent(new Event('focus'));
  for (let i = 0; i < 8; i += 1) await tick();
  assert.ok(isEmptyQuestAccount(h.cached().data)); assert.equal(h.cloud.writes.length, 0);
});

test('a stale tab cannot overwrite a reset saved into shared browser storage', async () => {
  const h = await harness();
  h.values.set(key, JSON.stringify(record(empty(), { baseRevision: 5, resetRevision: 5 })));
  const result = await h.client.supabase.from('quest_data').upsert({ user_id: userId, data: populated() });
  assert.match(result.error.message, /another tab/);
  assert.ok(isEmptyQuestAccount(h.cached().data)); assert.equal(h.cloud.writes.length, 0);
});

test('new quests can be saved normally after restarting', async () => {
  const h = await harness(); await h.client.resetQuestAccount(userId);
  const next = empty(); next.domains.push({ id: 'new', name: 'My fresh quest', tasks: [] });
  await h.client.supabase.from('quest_data').upsert({ user_id: userId, data: next });
  assert.equal(h.cloud.data.domains[0].id, 'new');
  assert.equal(h.cached().resetRevision, 2); assert.equal(h.cached().dirty, false);
});
