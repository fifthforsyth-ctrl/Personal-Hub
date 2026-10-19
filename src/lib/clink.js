import { isOn } from "./phoneFeel";

// The clink of two swords meeting, played when you log a win.
//
// Made on the spot with the Web Audio API rather than from a recording, so
// there's nothing to download and it plays the instant you tap. A blade
// rings like a struck steel bar: a handful of tones that aren't in tune
// with each other (that's what makes it sound like metal and not a bell),
// the high ones dying first, over a very short burst of noise for the hit.
// Two strikes a breath apart, the second softer, is the clash and the
// answer.
//
// On iPhone the ring/silent switch mutes it, like any other app's sounds;
// the haptic still lands. The "ambient" session lets it play over your
// music instead of stopping it.

// The ratios of a free steel bar's first four modes.
const MODES = [1, 2.756, 5.404, 8.933];
const DECAYS = [0.9, 0.55, 0.32, 0.18];
const GAINS = [0.5, 0.32, 0.2, 0.12];

let ctx = null;

function audio() {
  if (ctx) return ctx;
  const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    if (navigator.audioSession) navigator.audioSession.type = "ambient";
  } catch {
    /* older Safari */
  }
  ctx = new AC();
  return ctx;
}

function strike(ac, out, at, base, level) {
  for (let i = 0; i < MODES.length; i++) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    // A hair of detune per strike so two clinks are never identical.
    osc.frequency.value = base * MODES[i] * (1 + (Math.random() - 0.5) * 0.01);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(GAINS[i] * level, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + DECAYS[i]);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + DECAYS[i] + 0.05);
  }

  // The hit itself: 20 ms of bright noise.
  const len = Math.floor(ac.sampleRate * 0.02);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3500;
  const ng = ac.createGain();
  ng.gain.value = 0.35 * level;
  noise.connect(hp).connect(ng).connect(out);
  noise.start(at);
}

export function playClink() {
  if (!isOn("sounds")) return;
  const ac = audio();
  if (!ac) return;
  try {
    if (ac.state === "suspended") ac.resume();
    const out = ac.createGain();
    out.gain.value = 0.55;
    out.connect(ac.destination);
    const t = ac.currentTime + 0.01;
    strike(ac, out, t, 1600, 1);
    strike(ac, out, t + 0.085, 1820, 0.6);
  } catch (err) {
    console.warn(err);
  }
}
