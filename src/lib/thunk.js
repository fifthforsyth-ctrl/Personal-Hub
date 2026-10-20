import { isOn } from "./phoneFeel";
import { audio, noiseBuffer, envelope } from "./clink";

// An arrow landing, played as each of the evening's arrows hits its target.
//
// Made on the spot with the Web Audio API, like the swords. Two beats, about
// half a second:
//
//   the flight   air rushing past the fletching: noise through a band that
//                climbs as the arrow comes in
//   the hit      a dull thud into the straw, a short rustle, and the shaft
//                humming for a moment after
//
// A bullseye adds a small, high ring over the hit.
//
// playTwang is the other end of the shot: a new bow's string let go. A snap
// of air off the string, the string itself thrumming low and fading, and the
// arrow hissing away.
//
// The arrows land a second or more after the tap that banked the day, which
// is too late for iPhone to allow a sound to start. So the tap itself calls
// primeAudio, which wakes the audio while the tap still counts.

export function primeAudio() {
  if (!isOn("sounds")) return;
  const ac = audio();
  try {
    if (ac && ac.state === "suspended") ac.resume();
  } catch (err) {
    console.warn(err);
  }
}

export function playThunk(bullseye = false) {
  if (!isOn("sounds")) return;
  const ac = audio();
  if (!ac) return;
  try {
    if (ac.state === "suspended") ac.resume();
    const t0 = ac.currentTime + 0.01;
    const hit = t0 + 0.28;

    const air = ac.createBufferSource();
    air.buffer = noiseBuffer(ac, 0.32);
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 1.4;
    band.frequency.setValueAtTime(700, t0);
    band.frequency.exponentialRampToValueAtTime(2600, t0 + 0.26);
    const ag = ac.createGain();
    envelope(ag.gain, t0, 0.2, 0.13, 0.04, 0.11);
    air.connect(band).connect(ag).connect(ac.destination);
    air.start(t0);
    air.stop(t0 + 0.32);

    const thud = ac.createOscillator();
    thud.type = "sine";
    thud.frequency.setValueAtTime(160, hit);
    thud.frequency.exponentialRampToValueAtTime(52, hit + 0.13);
    const tg = ac.createGain();
    envelope(tg.gain, hit, 0.9, 0.002, 0.01, 0.17);
    thud.connect(tg).connect(ac.destination);
    thud.start(hit);
    thud.stop(hit + 0.24);

    const straw = ac.createBufferSource();
    straw.buffer = noiseBuffer(ac, 0.09);
    const low = ac.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 1700;
    const sg = ac.createGain();
    envelope(sg.gain, hit, 0.6, 0.001, 0.006, 0.07);
    straw.connect(low).connect(sg).connect(ac.destination);
    straw.start(hit);

    const hum = ac.createOscillator();
    hum.type = "triangle";
    hum.frequency.value = 92;
    const hg = ac.createGain();
    envelope(hg.gain, hit + 0.01, 0.12, 0.004, 0, 0.38);
    hum.connect(hg).connect(ac.destination);
    hum.start(hit);
    hum.stop(hit + 0.42);

    if (bullseye) {
      [1318, 1976].forEach((f, k) => {
        const ping = ac.createOscillator();
        ping.type = "sine";
        ping.frequency.value = f;
        const pg = ac.createGain();
        envelope(pg.gain, hit + 0.06, k ? 0.05 : 0.11, 0.004, 0, 0.9);
        ping.connect(pg).connect(ac.destination);
        ping.start(hit + 0.06);
        ping.stop(hit + 1);
      });
    }
  } catch (err) {
    console.warn(err);
  }
}

export function playTwang() {
  if (!isOn("sounds")) return;
  const ac = audio();
  if (!ac) return;
  try {
    if (ac.state === "suspended") ac.resume();
    const t0 = ac.currentTime + 0.01;

    const snap = ac.createBufferSource();
    snap.buffer = noiseBuffer(ac, 0.06);
    const high = ac.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 2200;
    const ng = ac.createGain();
    envelope(ng.gain, t0, 0.5, 0.001, 0.004, 0.05);
    snap.connect(high).connect(ng).connect(ac.destination);
    snap.start(t0);

    // The string: a low note with its octave, dulled, bending a touch flat
    // as it settles.
    [
      [98, 0.5, 0.62],
      [196, 0.22, 0.34],
    ].forEach(([f, peak, len]) => {
      const str = ac.createOscillator();
      str.type = "sawtooth";
      str.frequency.setValueAtTime(f * 1.04, t0);
      str.frequency.exponentialRampToValueAtTime(f, t0 + 0.08);
      const dull = ac.createBiquadFilter();
      dull.type = "lowpass";
      dull.frequency.setValueAtTime(1600, t0);
      dull.frequency.exponentialRampToValueAtTime(420, t0 + len);
      const sg = ac.createGain();
      envelope(sg.gain, t0, peak * 0.3, 0.002, 0.01, len);
      str.connect(dull).connect(sg).connect(ac.destination);
      str.start(t0);
      str.stop(t0 + len + 0.05);
    });

    const away = ac.createBufferSource();
    away.buffer = noiseBuffer(ac, 0.36);
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 1.6;
    band.frequency.setValueAtTime(2800, t0 + 0.03);
    band.frequency.exponentialRampToValueAtTime(800, t0 + 0.36);
    const ag = ac.createGain();
    envelope(ag.gain, t0 + 0.03, 0.12, 0.02, 0.03, 0.28);
    away.connect(band).connect(ag).connect(ac.destination);
    away.start(t0 + 0.03);
  } catch (err) {
    console.warn(err);
  }
}
