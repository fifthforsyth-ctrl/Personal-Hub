// Pure helpers for the Hub app on the watch (the `api` calls in index.ts).
// Kept apart from the database so scripts/test.mjs can check them.

// Epoch milliseconds, which the watch reads straight into a Date.
export function ms(iso) {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
}

// "04:30:00" -> "04:30".
export function hhmm(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t ?? ""));
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

// Today's planned blocks, in order, the way the Plan page lays them out.
export function planOf(chunks) {
  return (chunks ?? [])
    .map((c) => ({ title: String(c.title ?? "").trim() || "Block", category: c.category ?? null, start: hhmm(c.start_time), end: hhmm(c.end_time) }))
    .filter((b) => b.start)
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

// The block you're in at `now` ("HH:MM"), or else the next one today.
export function blockAt(plan, now) {
  const cur = (plan ?? []).find((b) => b.start <= now && (b.end ? now < b.end : false));
  if (cur) return { ...cur, now: true };
  const next = (plan ?? []).find((b) => b.start > now);
  return next ? { ...next, now: false } : null;
}

// This week's focus goals: the newest week that has started and is under
// a week old (weeks begin on Sunday, when they're planned).
export function focusWeek(rows, date) {
  const day = (d) => Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`);
  const today = day(date);
  const weeks = [...new Set((rows ?? []).map((r) => String(r.week_start).slice(0, 10)))]
    .filter((w) => day(w) <= today && today - day(w) < 7 * 86400000)
    .sort();
  const week = weeks[weeks.length - 1];
  if (!week) return [];
  return (rows ?? [])
    .filter((r) => String(r.week_start).slice(0, 10) === week)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((r) => String(r.title ?? "").trim())
    .filter(Boolean);
}

// What an entry counts toward: its tags, or its category when it has none
// (the same rule as the weekly_targets function in the database).
const countsAs = (e) => (Array.isArray(e.tags) && e.tags.length ? e.tags : [e.category]).filter(Boolean);

// Daily targets with what's been logged toward them today. Sleep is left
// out: last night's sleep started yesterday, so today's count would read 0.
export function targetsToday(targets, entries) {
  return (targets ?? [])
    .filter((t) => t.active !== false && t.period === "day")
    .filter((t) => !(t.categories ?? []).some((c) => /sleep/i.test(c)))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((t) => {
      const cats = new Set(t.categories ?? []);
      const done = (entries ?? [])
        .filter((e) => e.ended_at && countsAs(e).some((c) => cats.has(c)))
        .reduce((s, e) => s + (Number(e.duration_minutes) || 0), 0);
      return { label: t.label, done: Math.round(done), goal: Number(t.minutes) || 0 };
    });
}

// Last night's sleep: the newest Sleep entry that ended today.
export function sleptLast(entries, startISO) {
  const start = Date.parse(startISO);
  const nights = (entries ?? []).filter(
    (e) => e.ended_at && Date.parse(e.ended_at) >= start && ((e.tags ?? []).includes("Sleep") || e.category === "Sleep")
  );
  if (!nights.length) return null;
  const last = nights.sort((a, b) => Date.parse(b.ended_at) - Date.parse(a.ended_at))[0];
  return Math.round((Date.parse(last.ended_at) - Date.parse(last.started_at)) / 60000);
}
