const bridge = window.questNotice;
const el = id => document.getElementById(id);
let current = null, deadline = 0, remaining = 0, held = false, busy = false, hover = false, focus = false;
bridge.onShow(event => {
  // A reused native window retains its last focused button after hide(). Do
  // not let that stale focus hold the next, untouched reminder on screen.
  document.activeElement?.blur();
  current = event; busy = false; held = false; hover = false; focus = false; remaining = event.remainingMs; deadline = Date.now() + remaining;
  el('title').textContent = event.title; el('body').textContent = event.body;
  el('category').textContent = {pomodoro:'A MOMENT TO RESET',timer:'TIME CHECK',competition:'FROM YOUR FRIENDS',review:'YOUR DAILY CHECK-IN'}[event.kind] || 'YOUR NEXT SMALL STEP';
  el('primary').textContent = event.primary.label;
  el('snooze').hidden = !event.snoozable; el('feedback').textContent = '';
  el('primary').disabled = false; el('snooze').disabled = false;
  // Reuse one small native window without leaving an empty bubble behind.
  el('notice').getAnimations().forEach(animation => animation.cancel());
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) el('notice').animate([{opacity:0,transform:'translateY(-8px)'},{opacity:1,transform:'none'}],{duration:220});
  if (event.sound) {
    try {
      const audio = new AudioContext(), gain = audio.createGain(), oscillator = audio.createOscillator();
      gain.gain.setValueAtTime(.025,audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.22);
      oscillator.frequency.value = 660; oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime+.23); oscillator.onended = () => void audio.close();
    } catch { /* Reminders remain usable without audio. */ }
  }
});
bridge.onHidden(() => { current = null; busy = false; held = false; hover = false; focus = false; document.activeElement?.blur(); });
bridge.onResult(result => {
  if (current?.key !== result.key) return;
  busy = false; el('feedback').textContent = result.message;
  el('primary').disabled = result.ok; el('snooze').disabled = result.ok;
  remaining = result.ok ? 2400 : 12000; deadline = Date.now() + remaining;
});
function act(action) { if (!current || busy) return; busy = action !== 'dismiss'; el('primary').disabled = busy; el('snooze').disabled = busy; if (busy) el('feedback').textContent = 'One moment…'; bridge.action(current.key, action); }
el('primary').addEventListener('click', () => act(current.primary.id));
el('snooze').addEventListener('click', () => act('snooze'));
el('dismiss').addEventListener('click', () => act('dismiss'));
document.addEventListener('keydown', event => { if (event.key === 'Escape') act('dismiss'); });
function hold() {
  const value = hover || focus; if (!current || held === value || busy) return;
  if (value) remaining = Math.max(0, deadline - Date.now()); else deadline = Date.now() + remaining;
  held = value; bridge.hold(current.key, value);
}
el('notice').addEventListener('mouseenter', () => { hover = true; hold(); });
el('notice').addEventListener('mouseleave', () => { hover = false; hold(); });
document.addEventListener('focusin', () => { focus = true; hold(); });
document.addEventListener('focusout', event => { if (!el('notice').contains(event.relatedTarget)) { focus = false; hold(); } });
window.addEventListener('blur', () => { focus = false; hold(); });
setInterval(() => { if (!current) return; const left = held || busy ? remaining : Math.max(0, deadline - Date.now()); el('progress').style.transform = `scaleX(${Math.min(1,left/current.durationMs)})`; },100);
bridge.ready();
