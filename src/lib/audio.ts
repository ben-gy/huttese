/**
 * Pronunciation uses the browser's built-in speech synthesis, fed the English respelling
 * (e.g. "BOH SHOO-dah" -> "boh shoo dah"), pitched down for a suitably Hutt-like rumble.
 * Feedback chimes are synthesised with WebAudio – no audio files to ship.
 */

let voice: SpeechSynthesisVoice | null = null;

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  voice =
    voices.find((v) => /en[-_](GB|AU|US)/i.test(v.lang) && /male|daniel|fred|alex|google uk english male/i.test(v.name)) ??
    voices.find((v) => v.lang.startsWith('en')) ??
    voices[0] ??
    null;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(respelling: string, opts: { slow?: boolean } = {}) {
  if (!canSpeak()) return;
  const text = respelling.toLowerCase().replace(/-/g, ' ').replace(/[“”"()]/g, '');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? 'en-GB';
  u.pitch = 0.35;
  u.rate = opts.slow ? 0.55 : 0.85;
  speechSynthesis.speak(u);
}

let ctx: AudioContext | null = null;

function tone(freqs: number[], dur = 0.12, type: OscillatorType = 'sine', gain = 0.08) {
  try {
    ctx ??= new AudioContext();
    let t = ctx.currentTime;
    for (const f of freqs) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur);
      t += dur * 0.8;
    }
  } catch {
    /* audio unavailable */
  }
}

export const sfx = {
  right: () => tone([660, 880], 0.12, 'triangle'),
  wrong: () => tone([220, 165], 0.18, 'sawtooth', 0.04),
  done: () => tone([523, 659, 784, 1046], 0.14, 'triangle'),
  tap: () => tone([440], 0.04, 'sine', 0.03),
};
