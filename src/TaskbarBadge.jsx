import { useEffect, useState } from 'react';
import { getQuestSyncSnapshot, subscribeQuestSync } from './supabaseClient';
import { countBadgeItems } from './taskbar-badge.js';
export default function TaskbarBadge({ items, userId, includeAnchors = true }) {
  const [sync, setSync] = useState(getQuestSyncSnapshot);
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => subscribeQuestSync(setSync), []);
  useEffect(() => {
    const change = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', change); window.addEventListener('offline', change);
    return () => { window.removeEventListener('online', change); window.removeEventListener('offline', change); };
  }, []);
  const count = countBadgeItems(items, includeAnchors);
  useEffect(() => {
    // Clear uncertain counts rather than claiming an old cloud copy is current.
    const value = userId && online && !['conflict','pending','error'].includes(sync.state) ? count : 0;
    if (navigator.setAppBadge) Promise.resolve(value ? navigator.setAppBadge(value) : navigator.clearAppBadge?.()).catch(() => {});
    const previous = document.title;
    if (userId) document.title = value ? `(${value}) Quest` : 'Quest';
    return () => { document.title = previous; };
  }, [count, includeAnchors, userId, online, sync.state]);
  useEffect(() => () => { Promise.resolve(navigator.clearAppBadge?.()).catch(() => {}); }, [userId]);
  return null;
}
