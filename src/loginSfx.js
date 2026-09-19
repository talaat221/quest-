let audioContext = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioContext) audioContext = new AudioCtx();
  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }
  return audioContext;
}

function tone({ frequency, duration = 0.08, gain = 0.035, type = "square", delay = 0 }) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const start = ctx.currentTime + delay;
  const end = start + duration;

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

export function playLoginTap() {
  tone({ frequency: 520, duration: 0.045, gain: 0.022 });
}

export function playLoginSuccess() {
  tone({ frequency: 523.25, duration: 0.09, gain: 0.028, delay: 0 });
  tone({ frequency: 659.25, duration: 0.09, gain: 0.028, delay: 0.08 });
  tone({ frequency: 783.99, duration: 0.16, gain: 0.03, delay: 0.16 });
  tone({ frequency: 1046.5, duration: 0.22, gain: 0.025, delay: 0.28, type: "triangle" });
}

export function playLoginError() {
  tone({ frequency: 220, duration: 0.08, gain: 0.022, delay: 0 });
  tone({ frequency: 175, duration: 0.12, gain: 0.019, delay: 0.08 });
}
