import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import webpush from 'npm:web-push@3.6.7';
import { dueReminders, normalizeReminders, validTimezone } from '../_shared/reminders.js';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const allowedOrigin = (value: string) => value === 'https://quest-alpha-fawn.vercel.app' || /^https:\/\/quest(?:-[a-z0-9-]+)?-quest18\.vercel\.app$/.test(value) || value === 'http://localhost:5173';
const cors = (origin: string) => ({ 'Access-Control-Allow-Origin': allowedOrigin(origin) ? origin : 'https://quest-alpha-fawn.vercel.app', 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' });
const reply = (origin: string, data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
async function checked(result: any) { const {data, error} = await result; if (error) throw new Error('Notification storage is temporarily unavailable.'); return data; }
async function secrets() {
  let result = await checked(admin.rpc('get_quest_push_secrets'));
  if (!result.vapid) result = await checked(admin.rpc('get_quest_push_secrets', { p_keys: webpush.generateVAPIDKeys() }));
  return result;
}
function validSubscription(subscription: any) {
  try {
    const url = new URL(subscription.endpoint);
    const provider = url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com' || url.hostname.endsWith('.push.apple.com') || url.hostname === 'web.push.apple.com' || url.hostname.endsWith('.notify.windows.com');
    if (!provider || url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password || url.hash || subscription.endpoint.length > 2048) return false;
    const decode = (str: string) => atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const key = decode(subscription.keys.p256dh), auth = decode(subscription.keys.auth);
    return key.length === 65 && key.charCodeAt(0) === 4 && auth.length === 16;
  } catch { return false; }
}
async function hash(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(bytes).map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
async function send(sub: any, event: any, keys: any) {
  const tag = `quest-${await hash(event.key)}`;
  const payload = JSON.stringify({ title: event.title, body: event.body, tag,
    data: { url: `${sub.origin}/${event.page}`, eventKey: event.key, userId: sub.user_id, due: event.due }, icon: '/icon-192.png?v=quest-cottage-v1' });
  const request = webpush.generateRequestDetails(sub.subscription, payload, {
    TTL: event.ttl || 120, urgency: 'high', topic: tag.slice(0, 32),
    vapidDetails: { subject: 'https://quest-alpha-fawn.vercel.app', ...keys },
  });
  const response = await fetch(request.endpoint, { method: request.method, headers: request.headers, body: request.body, redirect: 'error', signal: AbortSignal.timeout(8000) });
  await response.body?.cancel();
  if (response.status === 404 || response.status === 410) {
    await checked(admin.from('quest_push_subscriptions').delete().eq('id', sub.id)); return false;
  }
  if (!response.ok) throw new Error(`Push provider returned ${response.status}`);
  return true;
}
async function deliver(sub: any, event: any, keys: any) {
  const claimed = await checked(admin.rpc('claim_quest_push', { p_subscription: sub.id, p_key: event.key }));
  if (!claimed) return false;
  try {
    const sent = await send(sub, event, keys);
    if (sent) await checked(admin.from('quest_push_deliveries').update({ state: 'sent', touched_at: new Date().toISOString() }).eq('subscription_id', sub.id).eq('event_key', event.key));
    return sent;
  } catch {
    await checked(admin.from('quest_push_deliveries').update({ state: 'failed', touched_at: new Date().toISOString() }).eq('subscription_id', sub.id).eq('event_key', event.key));
    return false;
  }
}
function challengeNotification(item: any) {
  const xp = Math.max(0, Math.round(Number(item?.xp) || 0));
  const actor = String(item?.actor_display_name || 'Your challenger').slice(0, 40);
  return {
    key: `competition:${item?.event_id}`,
    title: 'Challenge update',
    body: `${actor} just completed a task for ${xp} XP.`,
    page: '#competition',
    due: Date.parse(item?.created_at) || Date.now(),
    ttl: 3600,
  };
}
async function dispatch(keys: any) {
  let inspected = 0, sent = 0, failed = 0;
  const states = new Map();
  const challengeEvents = new Map();
  const oneDayAgo = new Date(Date.now()-86400000).toISOString();
  for (let offset = 0; ; offset += 100) {
    const rows = await checked(admin.from('quest_push_subscriptions').select('*').gt('last_seen_at', new Date(Date.now()-30*86400000).toISOString()).order('id').range(offset,offset+99));
    for (const sub of rows) {
      inspected++;
      if (!states.has(sub.user_id)) states.set(sub.user_id, await checked(admin.rpc('get_quest_push_state', { p_user_id: sub.user_id })));
      if (!challengeEvents.has(sub.user_id)) {
        challengeEvents.set(sub.user_id, await checked(admin.rpc('get_quest_competition_push_events', { p_user_id: sub.user_id, p_since: oneDayAgo })));
      }
      const events = dueReminders(states.get(sub.user_id), { timezone: sub.timezone, preferences: sub.preferences, enabledAt: Date.parse(sub.enabled_at) });
      const enabledAt = Date.parse(sub.enabled_at) || 0;
      const competition = (challengeEvents.get(sub.user_id) || [])
        .filter((item: any) => (Date.parse(item?.created_at) || 0) >= enabledAt)
        .map(challengeNotification);
      // Separate devices are intentional. The per-device ledger suppresses retries.
      for (const event of [...events, ...competition]) { if (await deliver(sub, event, keys)) sent++; else failed++; }
    }
    if (rows.length < 100) break;
  }
  return { inspected, sent, skippedOrFailed: failed };
}
Deno.serve(async req => {
  const origin = req.headers.get('Origin') || '';
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return reply(origin, { error: 'Use POST' }, 405);
  try {
    const text = await req.text();
    if (text.length > 16384) return reply(origin, { error: 'Request too large' }, 413);
    const body = JSON.parse(text || '{}');
    if (body.action === 'dispatch' || body.action === 'health') {
      const config = await secrets();
      if (!config.scheduler || req.headers.get('x-quest-scheduler') !== config.scheduler) return reply(origin, { error: 'Not authorized' }, 401);
      if (body.action === 'health') {
        // Exercises the same encryption path without contacting any push endpoint.
        const ecdh = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
        const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
        const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/quest-self-test', keys: { p256dh: b64(new Uint8Array(await crypto.subtle.exportKey('raw',ecdh.publicKey))), auth: b64(crypto.getRandomValues(new Uint8Array(16))) } };
        const encrypted = webpush.generateRequestDetails(subscription,'Quest encryption test',{ vapidDetails: {subject:'https://quest-alpha-fawn.vercel.app',...config.vapid} });
        const snapshot = await checked(admin.from('quest_push_subscriptions').select('id', { count: 'exact', head: false }).limit(1));
        return reply(origin, { healthy: true, encryptedPayload: encrypted.body.length > 0, databaseReady: Array.isArray(snapshot) });
      }
      return reply(origin, await dispatch(config.vapid));
    }
    if (!allowedOrigin(origin)) return reply(origin, { error: 'Open this from Quest' }, 403);
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i,'');
    const {data: {user}, error} = await admin.auth.getUser(token);
    if (error || !user) return reply(origin, { error: 'Sign in to enable reminders.' }, 401);
    if (body.action === 'config') { const config = await secrets(); return reply(origin, { publicKey: config.vapid.publicKey }); }
    const endpoint = String(body.endpoint || body.subscription?.endpoint || '');
    if (!endpoint || endpoint.length > 2048) return reply(origin, {error:'Missing device subscription'},400);
    const sub = await checked(admin.from('quest_push_subscriptions').select('*').eq('user_id', user.id).eq('endpoint', endpoint).maybeSingle());
    if (body.action === 'unsubscribe') {
      await checked(admin.from('quest_push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint));
      return reply(origin, { enabled: false });
    }
    if (body.action === 'subscribe') {
      if (!validSubscription(body.subscription)) return reply(origin,{error:'This browser returned an unsupported push subscription.'},400);
      const devices = await checked(admin.from('quest_push_subscriptions').select('id').eq('user_id',user.id));
      if (!sub && devices.length >= 10) return reply(origin,{error:'Please disable reminders on an unused device first.'},409);
      const saved = await checked(admin.from('quest_push_subscriptions').upsert({ ...(sub ? { id: sub.id, enabled_at: sub.enabled_at } : { enabled_at: new Date().toISOString() }), user_id: user.id, endpoint, subscription: { endpoint, keys: body.subscription.keys }, origin, timezone: validTimezone(body.timezone), preferences: normalizeReminders(body.preferences), last_seen_at: new Date().toISOString() }, {onConflict:'endpoint'}).select('preferences').single());
      return reply(origin, { enabled: true, preferences: saved.preferences });
    }
    if (!sub) return reply(origin,{enabled:false});
    if (body.action === 'status' || body.action === 'preferences') {
      const preferences = body.action === 'preferences' ? normalizeReminders(body.preferences) : sub.preferences;
      await checked(admin.from('quest_push_subscriptions').update({ preferences, timezone: validTimezone(body.timezone || sub.timezone), last_seen_at: new Date().toISOString() }).eq('id',sub.id).eq('user_id',user.id));
      return reply(origin,{enabled:true,preferences});
    }
    if (body.action === 'test') {
      const config = await secrets();
      const sent = await deliver(sub, { key: `test:${Math.floor(Date.now()/60000)}`, title:'Quest reminders are ready', body:'Your cozy little reminder system is working.', page:'#more', due:Date.now(), ttl:60 }, config.vapid);
      return reply(origin, sent ? { sent:true } : {error:'No test was sent. Wait a minute before retrying; you may need to enable this device again.'}, sent ? 200 : 409);
    }
    return reply(origin,{error:'Unknown action'},400);
  } catch {
    // Never log endpoints, subscription keys, task titles, JWTs, or Vault values.
    return reply(origin,{error:'Reminders could not connect. Please try again.'},500);
  }
});