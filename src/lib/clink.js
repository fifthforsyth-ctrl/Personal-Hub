import { isOn } from "./phoneFeel";

// Two swords fighting, played when you log a win.
//
// Made on the spot with the Web Audio API rather than from a recording, so
// there's nothing to download and it plays the instant you tap. Three beats,
// about a second in all:
//
//   the scrape   steel sliding along steel: a hiss pushed through narrow,
//                rising filters, with the blade's own tones ringing in it
//   the clash    the big hit: a crack of noise, a thump you feel more than
//                hear, and the blade ringing out
//   the parry    a second, quicker scrape and a lighter answering hit
//
// A blade rings like a struck steel bar: tones that aren't in tune with each
// other (that's what makes it metal and not a bell), each played twice a few
// hertz apart so it shimmers, the high ones dying first. A compressor at the
// end keeps it punchy on a phone speaker.
//
// On iPhone the ring/silent switch mutes it, like any other app's sounds;
// the haptic still lands. The "ambient" session lets it play over your
// music instead of stopping it.

// The ratios of a free steel bar's first modes.
const MODES = [1, 2.756, 5.404, 8.933, 13.34];
const DECAYS = [1.4, 0.9, 0.55, 0.32, 0.18];
const GAINS = [0.42, 0.3, 0.2, 0.12, 0.07];

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

function noiseBuffer(ac, seconds) {
  const len = Math.max(1, Math.floor(ac.sampleRate * seconds));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function envelope(param, at, peak, attack, hold, release) {
  param.setValueAtTime(0.0001, at);
  param.exponentialRampToValueAtTime(peak, at + attack);
  param.setValueAtTime(peak, at + attack + hold);
  param.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
}

// Steel on steel: noise through a band that slides upward, plus a few very
// narrow bands at the blade's tones so the hiss sings.
function scrape(ac, out, at, length, level, base) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, length + 0.1);

  const sweep = ac.createBiquadFilter();
  sweep.type = "bandpass";
  sweep.Q.value = 6;
  sweep.frequency.setValueAtTime(2200, at);
  sweep.frequency.exponentialRampToValueAtTime(7500, at + length);
  const g = ac.createGain();
  envelope(g.gain, at, 0.5 * level, length * 0.35, length * 0.3, length * 0.35);
  src.connect(sweep).connect(g).connect(out);

  for (const [ratio, q, amt] of [[2.756, 40, 0.9], [5.404, 50, 0.7], [8.933, 60, 0.5]]) {
    const ring = ac.createBiquadFilter();
    ring.type = "bandpass";
    ring.Q.value = q;
    ring.frequency.setValueAtTime(base * ratio, at);
    ring.frequency.linearRampToValueAtTime(base * ratio * 1.04, at + length);
    const rg = ac.createGain();
    envelope(rg.gain, at, 2.2 * amt * level, length * 0.4, length * 0.2, length * 0.4 + 0.05);
    src.connect(ring).connect(rg).connect(out);
  }
  src.start(at);
  src.stop(at + length + 0.1);
}

// The hit: a crack, a thump, and the ring.
function clash(ac, out, at, level, base) {
  const crack = ac.createBufferSource();
  crack.buffer = noiseBuffer(ac, 0.05);
  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1800;
  const cg = ac.createGain();
  envelope(cg.gain, at, 1.1 * level, 0.001, 0.004, 0.04);
  crack.connect(hp).connect(cg).connect(out);
  crack.start(at);

  const thump = ac.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(190, at);
  thump.frequency.exponentialRampToValueAtTime(80, at + 0.09);
  const tg = ac.createGain();
  envelope(tg.gain, at, 0.6 * level, 0.002, 0, 0.11);
  thump.connect(tg).connect(out);
  thump.start(at);
  thump.stop(at + 0.15);

  for (let i = 0; i < MODES.length; i++) {
    for (const detune of [-1, 1]) {
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.value = base * MODES[i] + detune * (2.5 + i) + (Math.random() - 0.5) * 4;
      const g = ac.createGain();
      envelope(g.gain, at, (GAINS[i] / 2) * level, 0.002, 0, DECAYS[i]);
      osc.connect(g).connect(out);
      osc.start(at);
      osc.stop(at + DECAYS[i] + 0.05);
    }
  }
}

// The whole exchange, starting at `at`. Takes any audio context, so the
// same sound can be rendered offline.
export function swordFight(ac, destination, at) {
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 6;
  comp.ratio.value = 6;
  comp.attack.value = 0.002;
  comp.release.value = 0.15;
  const out = ac.createGain();
  out.gain.value = 0.9;
  out.connect(comp).connect(destination);

  const base = 1050 * (1 + (Math.random() - 0.5) * 0.04);
  scrape(ac, out, at, 0.2, 1, base);
  clash(ac, out, at + 0.19, 1, base);
  scrape(ac, out, at + 0.42, 0.09, 0.7, base * 1.18);
  clash(ac, out, at + 0.5, 0.65, base * 1.18);
}

export function playClink() {
  if (!isOn("sounds")) return;
  const ac = audio();
  if (!ac) return;
  try {
    if (ac.state === "suspended") ac.resume();
    swordFight(ac, ac.destination, ac.currentTime + 0.01);
  } catch (err) {
    console.warn(err);
  }
}
