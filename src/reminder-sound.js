let audio;
export function unlockReminderSound() {
  try { const Audio = window.AudioContext || window.webkitAudioContext; if (Audio) { audio ||= new Audio(); void audio.resume().catch(() => {}); } } catch { /* Sound is optional. */ }
}
export function reminderChime() {
  if (!audio || audio.state !== 'running') return;
  for (const [offset, frequency] of [[0,523.25],[.12,659.25]]) {
    const tone = audio.createOscillator(), volume = audio.createGain(), start = audio.currentTime + offset;
    tone.type = 'sine'; tone.frequency.value = frequency; volume.gain.setValueAtTime(.0001,start); volume.gain.exponentialRampToValueAtTime(.06,start+.015); volume.gain.exponentialRampToValueAtTime(.0001,start+.22);
    tone.connect(volume); volume.connect(audio.destination); tone.start(start); tone.stop(start+.25); tone.onended = () => { tone.disconnect(); volume.disconnect(); };
  }
}
