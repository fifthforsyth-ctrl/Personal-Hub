// One way to count a day's minutes, so every screen says the same thing.
//
// "Tracked" is the wall clock: the lengths of the entries, added up. An entry
// can carry several categories (an hour that was Serve and Study), and each
// category is credited the whole hour, so category totals add up to more
// than the day. They're only ever shown as a breakdown, with a note saying so.

export const OVERLAP_NOTE = "Categories overlap, so these add up to more than the day.";

export function trackedMinutes(entries) {
  return (entries ?? []).reduce((sum, e) => sum + (Number(e.duration_minutes) || 0), 0);
}

// Minutes per category, largest first, crediting every tag on an entry.
export function minutesByCategory(entries) {
  const totals = new Map();
  for (const e of entries ?? []) {
    const mins = Number(e.duration_minutes) || 0;
    for (const t of e.tags?.length ? e.tags : [e.category]) totals.set(t, (totals.get(t) ?? 0) + mins);
  }
  return [...totals.entries()].map(([category, minutes]) => ({ category, minutes })).sort((a, b) => b.minutes - a.minutes);
}

// A running timer reads as a length of time, not a clock: "23 min",
// "1 hr 5 min".
export function fmtElapsed(startedAt, now = Date.now()) {
  const mins = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function timeOf(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
