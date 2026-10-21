import {useCallback, useEffect, useRef, useState} from 'react';
import {supabase} from './supabaseClient';
import {desktopBridge as bridge} from './desktop-bridge.js';
import {DEFAULT_REMINDERS, normalizeReminders, dueReminders, reminderStillRelevant} from '../supabase/functions/_shared/reminders.js';
import {categoryEnabled, safePage} from '../desktop/contract.mjs';

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const read = (key,fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key,value) => localStorage.setItem(key,JSON.stringify(value));
const defaults = {...DEFAULT_REMINDERS,inApp:true,desktopPopups:true,desktopEnabled:true};
export function useDesktopReminders({state,userId,onStartReminder}) {
  const [preferences,setPreferences] = useState(defaults), [error,setError] = useState(''), [feedError,setFeedError] = useState(''), [message,setMessage] = useState('');
  const [desktopSettings,setDesktopSettings] = useState(null);
  const stateRef = useRef(state), prefs = useRef(preferences), startRef = useRef(onStartReminder), owner = useRef(null), ready = useRef(false);
  const events = useRef(new Map()), seen = useRef({}), snoozes = useRef([]), enabledAt = useRef(0), cursor = useRef(0);
  stateRef.current = state; startRef.current = onStartReminder;
  const configure = (id,values) => bridge.configure({userId:id,enabled:values.desktopEnabled,popups:values.inApp && values.desktopPopups,sound:values.sound});
  useEffect(() => {
    let cancelled = false;
    owner.current = userId; ready.current = false; events.current.clear();
    const saved = {...defaults,...read(`quest-reminders:${userId}`,{})};
    prefs.current = saved; setPreferences(saved); setError(''); setFeedError(''); setMessage('');
    seen.current = read(`quest-reminders-seen:${userId}`,{});
    snoozes.current = read(`quest-reminder-snoozes:${userId}`,[]);
    enabledAt.current = Date.now()-120000;
    cursor.current = Math.max(Date.now()-120000,Number(read(`quest-friend-cursor:${userId}`,Date.now()-1000)));
    void configure(userId,saved).then(() => { if (!cancelled) ready.current = !!userId; }).catch(() => { if (!cancelled) setError('Desktop reminders could not start. Reopen Quest and try again.'); });
    void bridge.getSettings().then(value => { if (!cancelled) setDesktopSettings(value); });
    return () => { cancelled = true; owner.current = null; ready.current = false; events.current.clear(); void bridge.configure({userId:null,enabled:false}); };
  },[userId]);

  useEffect(() => {
    if (!userId) return;
    let stopped = false, ticking = false, polling = false;
    const canDeliver = () => !stopped && owner.current === userId && ready.current && prefs.current.desktopEnabled && !!stateRef.current;
    const remember = async event => {
      if (!canDeliver() || seen.current[event.key] || !categoryEnabled(event,prefs.current)) return;
      const payload = {...event,createdAt:Date.now(),durationMs:prefs.current.bannerSeconds*1000};
      events.current.set(event.key,payload);
      const result = await bridge.notify({userId,event:payload});
      if (stopped || owner.current !== userId) return;
      if (!result.accepted) { events.current.delete(event.key); if (result.error) setError(result.error); return; }
      if (result.muted) events.current.delete(event.key);
      seen.current[event.key] = Date.now();
      seen.current = Object.fromEntries(Object.entries(seen.current).filter(([,at])=>Number(at)>Date.now()-7*86400000));
      write(`quest-reminders-seen:${userId}`,seen.current);
    };
    const tick = async () => {
      if (ticking || !canDeliver()) return;
      ticking = true;
      try {
        for (const event of dueReminders(stateRef.current,{timezone:zone(),preferences:prefs.current,enabledAt:enabledAt.current})) await remember(event);
        const due = snoozes.current.filter(event=>event.due<=Date.now());
        for (const event of due) {
          if (Date.now()-event.due<120000 && categoryEnabled(event,prefs.current) && reminderStillRelevant(stateRef.current,event,{timezone:zone()})) await remember(event);
          if (seen.current[event.key] || Date.now()-event.due>=120000 || !reminderStillRelevant(stateRef.current,event,{timezone:zone()})) snoozes.current = snoozes.current.filter(item=>item.key!==event.key);
        }
        if (due.length) write(`quest-reminder-snoozes:${userId}`,snoozes.current);
      } catch { if (!stopped) setError('A reminder could not be delivered. Quest will retry.'); }
      finally { ticking = false; }
    };
    const competition = async () => {
      if (polling || !canDeliver() || !prefs.current.friends || navigator.onLine === false) return;
      polling = true;
      try {
        const {data,error:problem} = await supabase.rpc('get_my_quest_competition_events',{p_since:new Date(cursor.current-1000).toISOString()});
        if (stopped || owner.current !== userId || !prefs.current.friends) return;
        if (problem) throw problem;
        setFeedError('');
        for (const item of data || []) {
          const created = Date.parse(item.created_at);
          if (!Number.isFinite(created)) continue;
          if (Date.now()-created<120000) await remember({key:`competition:${item.event_id}`,kind:'competition',due:created,title:'Challenge update',body:`${item.actor_display_name || 'Your challenger'} just completed a task for ${Math.max(0,Math.round(Number(item.xp)||0))} XP.`,page:'#competition'});
          cursor.current = Math.max(cursor.current,created+1);
        }
        write(`quest-friend-cursor:${userId}`,cursor.current);
      } catch { if (!stopped) setFeedError('Friend updates will reconnect when you are online.'); }
      finally { polling = false; }
    };
    const interval = setInterval(()=>{void tick();},1000), friendInterval = setInterval(()=>{void competition();},10000);
    const wake = () => { void tick(); void competition(); };
    const unsubscribe = bridge.onWake(wake);
    window.addEventListener('online',wake); wake();
    return () => { stopped = true; clearInterval(interval); clearInterval(friendInterval); unsubscribe(); window.removeEventListener('online',wake); };
  },[userId]);

  // Cancel already visible/queued reminders when a task changes on any device.
  useEffect(() => {
    if (!userId || !state) return;
    const keys = [];
    for (const [key,event] of events.current) if (!categoryEnabled(event,preferences) || !reminderStillRelevant(state,event,{timezone:zone()})) keys.push(key);
    if (keys.length) void bridge.cancel({userId,keys});
  },[state,preferences,userId]);
  useEffect(() => bridge.onRemoved(value => {
    if (value.userId !== owner.current) return;
    events.current.delete(value.key); if (value.error) setError(value.error);
  }),[]);
  useEffect(() => bridge.onAction(async value => {
    if (value.userId !== owner.current || !ready.current) return;
    const event = events.current.get(value.key);
    if (!event) return;
    try {
      if (!prefs.current.desktopEnabled || !categoryEnabled(event,prefs.current) || !reminderStillRelevant(stateRef.current,event,{timezone:zone()})) throw new Error('This task has changed. Open Quest to check it.');
      let text = 'Opened in Quest.';
      if (value.action === 'snooze') {
        const due = Date.now()+300000, base = event.key.split(':snooze:')[0];
        snoozes.current = [...snoozes.current.filter(item=>item.key.split(':snooze:')[0]!==base),{...event,key:`${base}:snooze:${due}`,due}];
        write(`quest-reminder-snoozes:${owner.current}`,snoozes.current); text = 'We’ll remind you in 5 minutes.';
      } else if (value.action === 'start') {
        if (!event.target?.taskId || !startRef.current || !['task','study','pomodoro'].includes(event.kind)) throw new Error('Open this reminder in Quest.');
        const result = await startRef.current(event);
        if (result === false) throw new Error('This session is already running or finished.');
        text = event.kind === 'pomodoro' && event.title.startsWith('Focus complete') ? 'Break started. Enjoy a little rest.' : 'Session started. You’ve got this.';
      } else if (value.action === 'open') window.location.hash = safePage(event.page);
      else return;
      await bridge.actionResult({...value,ok:true,message:text});
    } catch (problem) { await bridge.actionResult({...value,ok:false,message:problem.message || 'Open Quest and try again.'}); }
  }),[]);
  const update = useCallback(async values => {
    try {
      const next = {...prefs.current,...values,...normalizeReminders({...prefs.current,...values})};
      if (Object.hasOwn(values,'friends')) { cursor.current = Date.now(); write(`quest-friend-cursor:${owner.current}`,cursor.current); }
      write(`quest-reminders:${owner.current}`,next);
      await configure(owner.current,next);
      prefs.current = next; setPreferences(next); setError('');
      if (values.desktopEnabled === false) events.current.clear();
    } catch { setError('Could not save notification settings. Please try again.'); }
  },[]);
  const preview = async () => {
    if (!owner.current || !prefs.current.desktopEnabled) return;
    const event = {key:`preview:${Date.now()}`,kind:'preview',title:'Your next small step',body:'Reminders appear here, then quietly disappear.',page:'#settings/notifications',createdAt:Date.now(),durationMs:prefs.current.bannerSeconds*1000};
    events.current.set(event.key,event);
    try { const result = await bridge.notify({userId:owner.current,event}); if (!result.accepted) throw new Error(result.error || 'Enable desktop reminders first.'); setMessage(result.muted ? 'Reminders are paused in the tray menu.' : 'Test reminder sent to your desktop.'); } catch (problem) { setError(problem.message); }
  };
  const updateDesktopSettings = async values => {
    try { setDesktopSettings(await bridge.updateSettings(values)); setError(''); } catch (problem) { setError(problem.message); }
  };
  return {isDesktop:true,preferences,enabled:!!userId && preferences.desktopEnabled,busy:false,checking:false,setupStage:'',popupSupported:true,popupActive:false,message,error,feedError,permission:'granted',needsInstall:false,canPush:true,
    timezone:zone(),toasts:[],desktopSettings,updateDesktopSettings,update,enable:()=>update({desktopEnabled:true}),disable:()=>update({desktopEnabled:false}),test:preview,preview,reconnect:()=>configure(owner.current,prefs.current),dismiss:()=>{}};
}
