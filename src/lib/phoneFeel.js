import { useSyncExternalStore } from "react";

// Two switches for how the Hub feels in the hand: haptics (a small tap you
// feel on every button) and sounds (the clink of the swords when you log a
// win). Both start on, and both are kept on this device only, since a
// laptop has no use for either.

const KEYS = { haptics: "hub.haptics", sounds: "hub.sounds" };
const listeners = new Set();

function read(name) {
  try {
    return localStorage.getItem(KEYS[name]) !== "off";
  } catch {
    return true;
  }
}

export function isOn(name) {
  return read(name);
}

export function setOn(name, on) {
  try {
    localStorage.setItem(KEYS[name], on ? "on" : "off");
  } catch (err) {
    console.warn(err);
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function usePhoneFeel(name) {
  return useSyncExternalStore(subscribe, () => read(name), () => true);
}
