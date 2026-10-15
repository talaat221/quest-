import { useCallback, useEffect, useRef, useState } from 'react';
import './notifications.css';

function Bell() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" shapeRendering="crispEdges"><path d="M10 2h4v3h3v3h2v8h2v3H3v-3h2V8h2V5h3ZM9 21h6v2H9Z" fill="currentColor"/><path d="M8 8h3v7H8Z" fill="#fff4c4" opacity=".6"/></svg>;
}
export default function NotificationSettings({ notifications: n }) {
  if (!n) return null;
  return <section className="qd-home-settings-card qn-settings" aria-labelledby="qn-heading">
    <h2 id="qn-heading"><Bell /> Notifications</h2>
    <p>Little nudges for your next step.</p>
    <span className={`qn-status ${n.enabled ? 'is-on' : ''}`}>{n.checking ? 'Checking this device…' : n.enabled ? 'Enabled on this device' : 'Device notifications off'}</span>
    {n.needsInstall ? <p>Add Quest to your iPhone Home Screen, open it from its icon, then enable notifications here.</p> : !n.canPush ? <p>This browser cannot receive background notifications. In-app reminders are still available while Quest is open.</p> : n.permission === 'denied' ? <p>Notifications are blocked. Allow Quest in your device or browser notification settings, then reopen it.</p> : <p>Get alerts even when Quest is closed. Each device needs to be enabled separately.</p>}
    <div className="qn-actions">
      <button type="button" disabled={n.busy || (!n.enabled && (!n.canPush || n.needsInstall || n.permission === 'denied'))} onClick={n.enabled ? n.disable : n.enable}>{n.busy ? 'One moment…' : n.enabled ? 'Disable on this device' : 'Enable notifications'}</button>
      {n.enabled && <button type="button" disabled={n.busy} onClick={n.test}>Send test</button>}
      {n.canPush && !n.needsInstall && <button type="button" disabled={n.busy || n.checking} onClick={n.reconnect}>Check connection</button>}
    </div>
    {n.canPush && !n.needsInstall && <details className="qn-diagnostics"><summary>Not seeing alerts?</summary><p>Enable them separately on your phone and laptop, from the same Quest address you normally use.</p><ol><li>Browser permission: <strong>{n.permission === 'granted' ? 'Allowed' : n.permission === 'denied' ? 'Blocked' : 'Not requested yet'}</strong>.</li><li>Background delivery: <strong>{n.enabled ? 'This device is registered' : 'Enable this device above'}</strong>.</li><li>Allow Quest (or your browser) in system Notifications. Check Focus / Do Not Disturb.</li></ol>{n.permission === 'granted' && <button type="button" disabled={n.busy} onClick={n.testBrowser}>Test browser display</button>}{n.lastDelivery && <p>Last push-service result: {n.lastDelivery.state === 'sent' ? 'accepted' : 'retry needed'} · {new Date(n.lastDelivery.at).toLocaleString()}. This is not a device-read receipt.</p>}</details>}
    <fieldset disabled={n.busy}><legend>Remind me about</legend>
      {[
        ['anchors','Daily anchors','At their scheduled time, on their active days.'],
        ['tasks','Quest tasks','When a scheduled task is due to start.'],
        ['timers','Pomodoro & task timers','Focus ends, breaks end, or planned work time is up.'],
        ['friends','Friends’ task completions','When a competitor completes a task. Task names stay off your lock screen.'],
        ['study','Return to studying','A gentle nudge after a paused session.'],
        ['review','Daily check-in','A gentle review if there are unfinished tasks.'],
      ].map(([key,title,description]) => <label className="qn-option" key={key}><input type="checkbox" checked={n.preferences[key]} onChange={event => n.update({[key]:event.target.checked})}/><span><strong>{title}</strong><small>{description}</small></span></label>)}
      {n.preferences.review && <label className="qn-review">Check-in time<select aria-label="Daily check-in time" value={n.preferences.reviewHour} onChange={e => n.update({reviewHour:Number(e.target.value)})}>{Array.from({length:24},(_,hour) => <option key={hour} value={hour}>{String(hour).padStart(2,'0')}:00</option>)}</select></label>}
      <label className="qn-review">Task & anchor timing<select aria-label="Reminder lead time" value={n.preferences.leadMinutes} onChange={e => n.update({leadMinutes:Number(e.target.value)})}><option value={0}>At start time</option><option value={5}>5 minutes before</option><option value={10}>10 minutes before</option></select></label>
      {n.preferences.review && <label className="qn-review">Check-in frequency<select aria-label="Check-in frequency" value={n.preferences.reviewEveryHours} onChange={e => n.update({reviewEveryHours:Number(e.target.value)})}><option value={0}>Once daily</option><option value={3}>Every 3 hours after that</option><option value={6}>Every 6 hours after that</option></select></label>}
      {n.preferences.study && <label className="qn-review">After pausing<select aria-label="Study reminder delay" value={n.preferences.studyAfterMinutes} onChange={e => n.update({studyAfterMinutes:Number(e.target.value)})}>{[15,30,60].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label>}
      <label className="qn-review">Banner duration<select aria-label="Banner duration" value={n.preferences.bannerSeconds} onChange={e => n.update({bannerSeconds:Number(e.target.value)})}>{[8,10,12].map(n => <option key={n} value={n}>{n} seconds</option>)}</select></label>
      <label className="qn-option"><input type="checkbox" checked={n.preferences.sound} onChange={event => n.update({sound:event.target.checked})}/><span><strong>Reminder sounds</strong><small>A soft chime in Quest. System sounds follow your device settings.</small></span></label>
      <label className="qn-option"><input type="checkbox" checked={n.preferences.badgeAnchors} onChange={event => n.update({badgeAnchors:event.target.checked})}/><span><strong>Count Daily Anchors in the app badge</strong><small>Include today’s active anchors with unfinished quest tasks.</small></span></label>
      <label className="qn-option"><input type="checkbox" checked={n.preferences.inApp} onChange={event => n.update({inApp:event.target.checked})}/><span><strong>Show reminders inside Quest</strong><small>A small banner while you’re using the app.</small></span></label>
    </fieldset>
    <button type="button" onClick={n.preview}>Preview countdown reminder</button>
    <p className="qc-badge-help">For a Windows taskbar badge, install Quest from Chrome or Edge. A browser tab shows the count in its title. Badges clear while offline or sync needs attention, and refresh when Quest reconnects. Phone badge support varies.</p>
    <p className="qn-footnote">Times follow {n.timezone.replaceAll('_',' ')}. Keep changes synced for reminders while the app is closed. Phone alerts may arrive a little after the timer, depending on your connection and Focus settings.</p>
    {n.message && <p role="status" className="qn-message">{n.message}</p>}
    {n.error && <p role="alert" className="qn-error">{n.error}</p>}
    {n.feedError && <p role="alert" className="qn-error">{n.feedError}</p>}
  </section>;
}
function CountdownReminder({ event, notifications: n }) {
  const duration = event.durationMs || 10000;
  const [remaining,setRemaining] = useState(duration), [paused,setPaused] = useState(false), [busy,setBusy] = useState(false);
  const [initialDeadline] = useState(() => (event.createdAt || Date.now()) + duration);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);
  const dismiss = n.dismiss;
  const close = useCallback(() => {
    if (closeTimer.current) return;
    setClosing(true);
    closeTimer.current = setTimeout(() => dismiss(event.key), 180);
  }, [dismiss, event.key]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  const deadline = useRef(initialDeadline), left = useRef(duration), hover = useRef(false), focus = useRef(false);
  const hold = () => { const value = hover.current || focus.current; if (!value && paused) deadline.current = Date.now() + left.current; setPaused(value); };
  useEffect(() => {
    if (paused || busy || closing || event.actionError) return;
    const tick = () => { const value = Math.max(0,deadline.current-Date.now()); left.current = value; setRemaining(value); if (!value) close(); };
    tick(); const interval = setInterval(tick,100); return () => clearInterval(interval);
  }, [paused,busy,closing,event.actionError,close]);
  return <div className={`qn-toast qn-countdown${closing ? ' is-closing' : ''}`} onMouseEnter={() => {hover.current=true;hold();}} onMouseLeave={() => {hover.current=false;hold();}} onFocus={() => {focus.current=true;hold();}} onBlur={e => {if (!e.currentTarget.contains(e.relatedTarget)) {focus.current=false;hold();}}}>
    <img className="qn-reminder-art" src="/apple-touch-icon.png" alt=""/>
    <div className="qn-toast-copy"><div role="status"><span className="qn-kicker">{event.kind === 'pomodoro' ? 'A LITTLE REST' : event.kind === 'review' ? 'YOUR DAILY CHECK-IN' : 'YOUR NEXT SMALL STEP'}</span><strong>{event.title}</strong><p>{event.body}</p></div>
      <div className="qn-toast-actions"><a href={event.page} onClick={close}>{event.target?.taskId ? 'Open task' : 'Open Quest'} ↗</a>{['task','anchor','study','review','pomodoro','timer'].includes(event.kind) && <button type="button" disabled={busy || closing} onClick={async()=>{setBusy(true);await n.snooze(event);setBusy(false);}}>In 5 min</button>}<span aria-hidden="true">{paused ? 'Paused' : `${Math.ceil(remaining/1000)}s`}</span></div>
      {event.actionError && <p className="qn-error" role="alert">{event.actionError}</p>}
    </div><button type="button" onClick={close} aria-label={`Dismiss ${event.title}`}>×</button>
    <div className="qn-countdown-track" aria-hidden="true"><span style={{transform:`scaleX(${remaining/duration})`}}/></div>
  </div>;
}
export function NotificationToasts({ notifications: n }) {
  if (!n?.toasts.length) return null;
  return <aside className="qn-toasts" aria-label="Reminders">{n.toasts.map(event => <CountdownReminder key={event.key} event={event} notifications={n}/>)}</aside>;
}
