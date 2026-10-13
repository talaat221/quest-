import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import { normalizeLook } from './study-together.js';

const EMPTY = { lookId: 0, room: null, invites: [] };

export default function useStudyTogether(userId) {
  const [snapshot, setSnapshot] = useState({ userId: null, hub: EMPTY });
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const active = useRef(userId), version = useRef(0), queue = useRef(Promise.resolve()), pending = useRef(0), refreshing = useRef(null);
  useLayoutEffect(() => { active.current = userId; }, [userId]);
  const hub = snapshot.userId === userId ? snapshot.hub : EMPTY;
  const commit = useCallback((data, account) => {
    if (active.current !== account || !data || !Array.isArray(data.invites)) return;
    const serverTime = Date.parse(data.serverTime);
    setSnapshot({ userId: account, hub: { ...data, lookId: normalizeLook(data.lookId), clockOffset: Number.isFinite(serverTime) ? serverTime - Date.now() : 0 } });
    setError(''); setLoading(false);
  }, []);
  const refresh = useCallback(async () => {
    if (!userId || pending.current) return;
    if (refreshing.current?.account === userId) return refreshing.current.promise;
    const ticket = ++version.current;
    const promise = (async () => {
      try {
        const { data, error: problem } = await supabase.rpc('quest_study');
        if (problem) throw problem;
        if (ticket === version.current) commit(data, userId);
      } catch (e) { if (active.current === userId && ticket === version.current) { setError(e.message || 'The shared room could not connect. Try again.'); setLoading(false); } }
      finally { if (refreshing.current?.promise === promise) refreshing.current = null; }
    })();
    refreshing.current = { account: userId, promise }; return promise;
  }, [userId, commit]);
  useEffect(() => {
    version.current++; pending.current = 0; refreshing.current = null; queue.current = Promise.resolve();
    setError(''); setBusy(false); setLoading(!!userId);
    if (!userId) return;
    void refresh();
    let timeout;
    const schedule = () => { clearTimeout(timeout); timeout = setTimeout(refresh, 180); };
    const wake = () => { if (document.visibilityState !== 'hidden') schedule(); };
    const poll = setInterval(wake, 15000);
    document.addEventListener('visibilitychange', wake); window.addEventListener('online', wake);
    // Realtime carries revision numbers only, never a friend's task name.
    const channel = supabase.channel?.(`study-inbox:${userId}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'quest_study_updates', filter: `user_id=eq.${userId}`,
    }, schedule).subscribe();
    return () => {
      version.current++; clearTimeout(timeout); clearInterval(poll);
      document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const command = useCallback((action, { roomId = null, targetId = null, data = {} } = {}, quiet = false) => {
    const account = userId;
    if (!account) return Promise.reject(new Error('Sign in to study together.'));
    pending.current++; version.current++;
    if (!quiet) { setBusy(true); setError(''); }
    const job = queue.current.catch(() => {}).then(async () => {
      if (active.current !== account) return null;
      try {
        const { data: next, error: problem } = await supabase.rpc('quest_study', { p_action: action, p_room: roomId, p_target: targetId, p_data: data });
        if (problem) throw problem;
        if (active.current === account) { version.current++; commit(next, account); }
        return next;
      } catch (e) {
        // A room can already be gone when its view unmounts after leave/end.
        // That best-effort away heartbeat must not show a false reconnect error.
        if (active.current === account && quiet !== 'departing') { setError(e.message || 'Could not update your study room.'); setLoading(false); }
        throw e;
      } finally {
        if (active.current === account) { pending.current--; if (!quiet) setBusy(false); }
      }
    });
    queue.current = job; return job;
  }, [userId, commit]);
  return { ...hub, userId, error, busy, loading, refresh, command };
}
