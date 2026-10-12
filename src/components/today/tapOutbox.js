import { useSyncExternalStore } from "react";
import { logWinLoss, updateWinLoss, deleteWinLoss } from "../../lib/api";
import { isOffline } from "../../lib/errors";
import { announceChange as announce } from "./announce";
import { KEEP_MS } from "./tapRows";

// Win and loss taps, kept on the phone until the Hub has them.
//
// The tap is the habit, so it counts the moment it's made, signal or not.
// Each tap gets its id here and waits in this list (in localStorage, so
// closing the app doesn't lose it) until the database has it. One that
// couldn't be sent goes when the app opens, when the signal comes back, when
// the app comes back to the front, and every half minute while anything is
// waiting. The id is made here, so a tap sent twice is still one win.
//
// Pages show these taps next to what they loaded, matched by id: the count
// never counts one twice, and never drops one while a reload is landing.

const KEY = "hub.tap-outbox.v1";
const RETRY_MS = 30000;

let state = { taps: readStored(), removing: new Set(), renamed: new Map() };
const inflight = new Map();
const listeners = new Set();
let flushing = null;

function readStored() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(stored) ? stored.map((t) => ({ ...t, status: "waiting" })) : [];
  } catch (err) {
    console.warn(err);
    return [];
  }
}

function commit(next) {
  const now = Date.now();
  const taps = (next.taps ?? state.taps).filter((t) => t.status !== "sent" || now - t.sentAt < KEEP_MS);
  state = { ...state, ...next, taps };
  try {
    const unsent = taps.filter((t) => t.status !== "sent").map(({ id, user_id, kind, habit_label, occurred_at }) => ({ id, user_id, kind, habit_label, occurred_at }));
    localStorage.setItem(KEY, JSON.stringify(unsent));
  } catch (err) {
    console.warn(err);
  }
  listeners.forEach((fn) => fn());
}

function patch(id, fields) {
  commit({ taps: state.taps.map((t) => (t.id === id ? { ...t, ...fields } : t)) });
}

function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function send(id) {
  if (inflight.has(id)) return inflight.get(id);
  const tap = state.taps.find((t) => t.id === id);
  if (!tap || tap.status === "sent") return Promise.resolve(true);
  patch(id, { status: "sending" });
  const promise = logWinLoss(tap.user_id, { id: tap.id, kind: tap.kind, habitLabel: tap.habit_label, occurredAt: tap.occurred_at })
    .then(
      () => true,
      // 23505 is the same id arriving twice: an earlier try got through and
      // only its answer was lost.
      (err) => {
        if (err?.code === "23505") return true;
        console.warn(err);
        patch(id, { status: "waiting", offline: isOffline(err) });
        return false;
      }
    )
    .then((ok) => {
      if (ok) {
        patch(id, { status: "sent", sentAt: Date.now() });
        announce();
      }
      return ok;
    })
    .finally(() => inflight.delete(id));
  inflight.set(id, promise);
  return promise;
}

// --- What pages call ---------------------------------------------------------

export function logTap(userId, kind, label) {
  const tap = {
    id: newId(),
    user_id: userId,
    kind,
    habit_label: label?.trim() || (kind === "win" ? "Win" : "Loss"),
    occurred_at: new Date().toISOString(),
    status: "sending",
  };
  commit({ taps: [...state.taps, tap] });
  send(tap.id);
  return tap;
}

function setRenamed(id, entry) {
  const renamed = new Map(state.renamed);
  if (entry) renamed.set(id, entry);
  else renamed.delete(id);
  commit({ renamed });
}

// Wait out any send of this tap that's under way (a flush can start a new
// one while we wait for the last).
async function settled(id) {
  while (inflight.has(id)) await inflight.get(id);
}

// The new name shows everywhere at once. Still on the phone: the tap simply
// goes with the new name. Already in the Hub: the row is updated, and if
// that fails the old name comes back and the error is thrown for the caller.
export async function renameTap(id, label) {
  const before = state.renamed.get(id);
  setRenamed(id, { label, at: Date.now() });
  try {
    await settled(id);
    const tap = state.taps.find((t) => t.id === id);
    if (tap && tap.status !== "sent") {
      patch(id, { habit_label: label });
      return;
    }
    await updateWinLoss(id, { habit_label: label });
    setRenamed(id, { label, at: Date.now() });
    if (tap) patch(id, { habit_label: label });
    announce();
  } catch (err) {
    setRenamed(id, before);
    throw err;
  }
}

// Off every screen at once, while an Undo is still on offer.
export function hideTap(id) {
  commit({ removing: new Set(state.removing).add(id) });
}

export function unhideTap(id) {
  const removing = new Set(state.removing);
  removing.delete(id);
  commit({ removing });
}

// Hidden everywhere at once; put back if the delete fails.
export async function removeTap(id) {
  hideTap(id);
  try {
    await settled(id);
    const tap = state.taps.find((t) => t.id === id);
    if (!tap || tap.status === "sent") await deleteWinLoss(id);
    commit({ taps: state.taps.filter((t) => t.id !== id) });
    announce();
  } catch (err) {
    unhideTap(id);
    throw err;
  }
}

export function flushTaps(userId) {
  if (flushing) return flushing;
  flushing = (async () => {
    for (const tap of state.taps.filter((t) => t.status === "waiting" && t.user_id === userId)) {
      const ok = await send(tap.id);
      // No signal: the rest would fail the same way, so they wait together.
      if (!ok && state.taps.find((t) => t.id === tap.id)?.offline) break;
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

// Mounted once for the signed-in app (the capture provider does it).
export function startOutbox(userId) {
  if (!userId) return () => {};
  const flush = () => flushTaps(userId);
  const onVisible = () => document.visibilityState === "visible" && flush();
  flush();
  window.addEventListener("online", flush);
  document.addEventListener("visibilitychange", onVisible);
  const timer = setInterval(() => {
    if (document.visibilityState === "visible" && state.taps.some((t) => t.status === "waiting" && t.user_id === userId)) flush();
  }, RETRY_MS);
  return () => {
    window.removeEventListener("online", flush);
    document.removeEventListener("visibilitychange", onVisible);
    clearInterval(timer);
  };
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useOutbox() {
  return useSyncExternalStore(subscribe, () => state);
}

// --- Reading -----------------------------------------------------------------

// The pure parts live in tapRows.js, where the tests can reach them.
export { withTaps, waitingTaps, isUnnamed } from "./tapRows";
