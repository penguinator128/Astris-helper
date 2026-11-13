let ctx: AudioContext | null = null;

export function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Short confirmation beep, synthesised. */
export function beep(freq = 880, durationMs = 120, gain = 0.15) {
  const ac = audioContext();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, ac.currentTime);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + durationMs / 1000);
  osc.connect(g).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + durationMs / 1000 + 0.02);
}

/** Clapperboard "clap": a burst of filtered noise with a sharp transient and short decay. */
export function clapSound() {
  const ac = audioContext();
  if (!ac) return;
  const dur = 0.18;
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 14);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 0.7;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 300;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.9, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  // Wood "knock" body
  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(420, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(160, ac.currentTime + 0.06);
  const og = ac.createGain();
  og.gain.setValueAtTime(0.5, ac.currentTime);
  og.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08);
  src.connect(hp).connect(bp).connect(g).connect(ac.destination);
  osc.connect(og).connect(ac.destination);
  src.start();
  osc.start();
  osc.stop(ac.currentTime + 0.1);
}
