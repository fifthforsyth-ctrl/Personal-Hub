import { toDateStr } from "../../lib/planDates.js";

// Reading the tap outbox (tapOutbox.js) alongside rows the page loaded.
// Nothing here touches the network or storage, so the tests can run it.

// A sent tap (and a fresh rename) stays in memory until the page's own
// reload has certainly caught up with it.
export const KEEP_MS = 120000;

// Loaded rows plus this phone's taps for the same day, each once, oldest
// first. `kind` narrows to wins or losses.
export function withTaps(rows, outbox, { userId, date, kind } = {}) {
  const now = Date.now();
  const seen = new Set();
  const out = [];
  const named = (r) => {
    const rename = outbox.renamed.get(r.id);
    return rename && now - rename.at < KEEP_MS ? { ...r, habit_label: rename.label } : r;
  };
  for (const r of rows ?? []) {
    if (outbox.removing.has(r.id) || (kind && r.kind !== kind)) continue;
    out.push(named(r));
    seen.add(r.id);
  }
  for (const t of outbox.taps) {
    if (seen.has(t.id) || outbox.removing.has(t.id) || t.user_id !== userId) continue;
    if ((kind && t.kind !== kind) || (date && toDateStr(new Date(t.occurred_at)) !== date)) continue;
    out.push(named(t));
  }
  return out.sort((a, b) => String(a.occurred_at).localeCompare(String(b.occurred_at)));
}

// Taps that couldn't be sent yet, and whether that's for want of a signal.
export function waitingTaps(outbox, userId) {
  const waiting = outbox.taps.filter((t) => t.status === "waiting" && t.user_id === userId);
  return { count: waiting.length, offline: waiting.some((t) => t.offline !== false) };
}

export function isUnnamed(row) {
  const label = (row?.habit_label ?? "").trim();
  return !label || label === "Win" || label === "Loss";
}
