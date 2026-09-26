import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import { DEFAULT_REMINDERS, normalizeReminders, dueReminders } from '../supabase/functions/_shared/reminders.js';

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing can disable storage. */ } };
const supported = () => typeof window !== 'undefined' && window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
const installed = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const iphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const bytes = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
async function api(action, fields = {}) {
  const { data, error } = await supabase.functions.invoke('quest-notifications', { body: { action, timezone: zone(), ...fields } });
  if (error || data?.error) {
    let message = data?.error;
    try { if (!message && error?.context) message = (await error.context.json()).error; } catch { /* Keep readable fallback. */ }
    throw new Error(message || 'Could not reach reminders. Check your connection and try again.');
  }
  return data;
}
const registration = async () => {
  await navigator.serviceWorker.register('/sw.js');
  return Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Quest is still updating. Reopen it and try again.')), 12000))]);
};
export async function disconnectNotifications() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const subscription = await reg?.pushManager?.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    // Revoke at the browser/provider even when our server is temporarily offline.
    await subscription.unsubscribe();
    try { await api('unsubscribe', { endpoint }); } catch { /* Expired endpoint is removed on the next delivery attempt. */ }
  }
  const open = await reg?.getNotifications?.(); open?.forEach(item => item.close());
  try { localStorage.removeItem('quest-push-owner'); } catch { /* No local storage. */ }
}
export function useQuestNotifications({ state, userId }) {
  const [preferences, setPreferences] = useState({ ...DEFAULT_REMINDERS, inApp: true });
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [key, setKey] = useState('');
  const [permission, setPermission] = useState(() => typeof Notification === 'undefined' ? 'default' : Notification.permission);
  const [toasts, setToasts] = useState([]);
  const stateRef = useRef(state);
  const prefsRef = useRef(preferences);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { prefsRef.current = preferences; }, [preferences]);
  const mountedAt = useRef(0);
  const seen = useRef({});
  const subRef = useRef(null);
  const canPush = supported();
  const needsInstall = iphone() && !installed();
  const refresh = useCallback(async () => {
    if (!userId || !canPush || needsInstall) return;
    setPermission(Notification.permission);
    const previous = read('quest-push-owner', null);
    if (previous && previous !== userId) await disconnectNotifications();
    const config = await api('config'); setKey(config.publicKey);
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription(); subRef.current = sub;
    if (sub && Notification.permission === 'granted') {
      const result = await api('status', { endpoint: sub.endpoint });
      setEnabled(!!result.enabled);
      if (result.enabled) setPreferences(old => ({ ...old, ...normalizeReminders(result.preferences) }));
    } else setEnabled(false);
  }, [userId, canPush, needsInstall]);
  useEffect(() => {
    if (!userId) { setEnabled(false); setToasts([]); return; }
    setPreferences({ ...DEFAULT_REMINDERS, inApp: true, ...read(`quest-reminders:${userId}`, {}) });
    seen.current = read(`quest-reminders-seen:${userId}`, {});
    mountedAt.current = Date.now();
    const onRefresh = () => { void refresh().catch(() => {}); };
    onRefresh(); window.addEventListener('focus', onRefresh); window.addEventListener('online', onRefresh);
    return () => { window.removeEventListener('focus', onRefresh); window.removeEventListener('online', onRefresh); };
  }, [userId, refresh]);
  useEffect(() => {
    if (!userId) return;
    const remember = event => {
      if (seen.current[event.key]) return;
      seen.current[event.key] = Date.now();
      seen.current = Object.fromEntries(Object.entries(seen.current).filter(([,stamp]) => Number(stamp) > Date.now() - 7*86400000));
      write(`quest-reminders-seen:${userId}`, seen.current);
      if (prefsRef.current.inApp) setToasts(list => [...list, event].slice(-4));
    };
    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      for (const event of dueReminders(stateRef.current, { timezone: zone(), preferences: prefsRef.current, enabledAt: mountedAt.current - 1000 })) remember(event);
    };
    const pushed = event => {
      if (event.data?.type !== 'QUEST_REMINDER' || event.data?.payload?.data?.userId !== userId) return;
      const payload = event.data.payload;
      remember({ key: payload.data.eventKey, title: payload.title, body: payload.body, page: new URL(payload.data.url).hash });
    };
    const id = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    navigator.serviceWorker?.addEventListener('message', pushed);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); navigator.serviceWorker?.removeEventListener('message', pushed); };
  }, [userId]);
  const run = async action => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (problem) { setError(problem.message || 'Please try again.'); }
    finally { setBusy(false); }
  };
  const enable = () => {
    if (busy || !canPush || needsInstall) return;
    // Permission must start directly inside the tap event, especially on iOS.
    const consent = Notification.requestPermission();
    void run(async () => {
      const granted = await consent; setPermission(granted);
      if (granted !== 'granted') throw new Error('Notifications were not allowed. You can change this in your device or browser notification settings.');
      const publicKey = key || (await api('config')).publicKey;
      const reg = await registration();
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(publicKey) });
      await api('subscribe', { subscription: subscription.toJSON(), preferences: prefsRef.current });
      subRef.current = subscription; setEnabled(true); write('quest-push-owner', userId);
      setMessage('Reminders are enabled on this device. Try a test notification.');
    });
  };
  const disable = () => void run(async () => { await disconnectNotifications(); subRef.current = null; setEnabled(false); setMessage('Phone notifications are off on this device.'); });
  const update = values => void run(async () => {
    const next = { ...prefsRef.current, ...values };
    if (enabled && subRef.current) await api('preferences', { endpoint: subRef.current.endpoint, preferences: next });
    setPreferences(next); write(`quest-reminders:${userId}`, next);
  });
  const test = () => void run(async () => {
    if (!subRef.current) throw new Error('Enable notifications on this device first.');
    await api('test', { endpoint: subRef.current.endpoint });
    setMessage('Test sent. Check your notification center.');
  });
  return { preferences, enabled, busy, message, error, permission, needsInstall, canPush, enable, disable, update, test, timezone: zone(), toasts, dismiss: id => setToasts(list => list.filter(item => item.key !== id)) };
}
