import './notifications.css';

function Bell() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" shapeRendering="crispEdges"><path d="M10 2h4v3h3v3h2v8h2v3H3v-3h2V8h2V5h3ZM9 21h6v2H9Z" fill="currentColor"/><path d="M8 8h3v7H8Z" fill="#fff4c4" opacity=".6"/></svg>;
}
export default function NotificationSettings({ notifications: n }) {
  if (!n) return null;
  return <section className="qd-home-settings-card qn-settings" aria-labelledby="qn-heading">
    <h2 id="qn-heading"><Bell /> Notifications</h2>
    <p>Little nudges for your next step.</p>
    <span className={`qn-status ${n.enabled ? 'is-on' : ''}`}>{n.enabled ? 'Enabled on this device' : 'Phone notifications off'}</span>
    {n.needsInstall ? <p>Add Quest to your iPhone Home Screen, open it from its icon, then enable notifications here.</p> : !n.canPush ? <p>This browser cannot receive background notifications. In-app reminders are still available while Quest is open.</p> : n.permission === 'denied' ? <p>Notifications are blocked. Allow Quest in your device or browser notification settings, then reopen it.</p> : <p>Get alerts even when Quest is closed. Each device needs to be enabled separately.</p>}
    <div className="qn-actions">
      <button type="button" disabled={n.busy || (!n.enabled && (!n.canPush || n.needsInstall || n.permission === 'denied'))} onClick={n.enabled ? n.disable : n.enable}>{n.busy ? 'One moment…' : n.enabled ? 'Disable on this device' : 'Enable notifications'}</button>
      {n.enabled && <button type="button" disabled={n.busy} onClick={n.test}>Send test</button>}
    </div>
    <fieldset disabled={n.busy}><legend>Remind me about</legend>
      {[
        ['anchors','Daily anchors','At their scheduled time, on their active days.'],
        ['tasks','Quest tasks','When a scheduled task is due to start.'],
        ['timers','Pomodoro & task timers','Focus ends, breaks end, or planned work time is up.'],
        ['review','Daily check-in','A gentle review if there are unfinished tasks.'],
      ].map(([key,title,description]) => <label className="qn-option" key={key}><input type="checkbox" checked={n.preferences[key]} onChange={event => n.update({[key]:event.target.checked})}/><span><strong>{title}</strong><small>{description}</small></span></label>)}
      {n.preferences.review && <label className="qn-review">Check-in time<select aria-label="Daily check-in time" value={n.preferences.reviewHour} onChange={e => n.update({reviewHour:Number(e.target.value)})}>{Array.from({length:24},(_,hour) => <option key={hour} value={hour}>{String(hour).padStart(2,'0')}:00</option>)}</select></label>}
      <label className="qn-option"><input type="checkbox" checked={n.preferences.inApp} onChange={event => n.update({inApp:event.target.checked})}/><span><strong>Show reminders inside Quest</strong><small>A small banner while you’re using the app.</small></span></label>
    </fieldset>
    <p className="qn-footnote">Times follow {n.timezone.replaceAll('_',' ')}. Keep changes synced for reminders while the app is closed. Phone alerts may arrive a little after the timer, depending on your connection and Focus settings.</p>
    {n.message && <p role="status" className="qn-message">{n.message}</p>}
    {n.error && <p role="alert" className="qn-error">{n.error}</p>}
  </section>;
}
export function NotificationToasts({ notifications: n }) {
  if (!n?.toasts.length) return null;
  return <aside className="qn-toasts" aria-label="Reminders">{n.toasts.map(event => <div className="qn-toast" key={event.key}>
    <Bell/><div><div role="status"><strong>{event.title}</strong><p>{event.body}</p></div><a href={event.page} onClick={() => n.dismiss(event.key)}>Open in Quest ›</a></div>
    <button type="button" onClick={() => n.dismiss(event.key)} aria-label={`Dismiss ${event.title}`}>×</button>
  </div>)}</aside>;
}
