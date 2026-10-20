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
