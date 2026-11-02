// The Apple Watch, in words: the one quiet line the evening shows, the
// row under Today's minutes, and the pieces the On your watch page uses.
// Pure, so it's tested on its own (scripts/test.mjs).
//
// Numbers stay in a supporting role (Aaron, 2026-10-19: words lead, daily
// numbers stay visible but second). Nothing here is compared to a target or
// turned into a win. The one comparison is resting heart rate on Today,
// set beside your own normal (the middle of your last four weeks): your
// own baseline to read it against, not a target, never a score, never red.

import { addDays } from "./planDates.js";

export function fmtMins(m) {
  const n = Math.round(Number(m) || 0);
  const h = Math.floor(n / 60);
  const r = n % 60;
  return h ? `${h}h ${String(r).padStart(2, "0")}m` : `${r}m`;
}

const clock = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase().replace(" ", " ");
const num = (v) => (v == null || !(Number(v) > 0) ? null : Number(v));

// "Strength Training" → "Strength", "Outdoor Run" → "Run": the watch's long
// names, shortened for one line.
export function workoutName(name) {
  const n = String(name ?? "Workout").trim();
  const short = n
    .replace(/^(traditional|functional)\s+/i, "")
    .replace(/^(outdoor|indoor)\s+/i, "")
    .replace(/\s+training$/i, "")
    .replace(/^high intensity interval$/i, "HIIT");
  return short ? short[0].toUpperCase() + short.slice(1) : "Workout";
}

// How long the watch saw you asleep last night ("6h 52m"), or null when it
// has no night for the day. Every place the Hub shows the watch's sleep
// takes its number from here, so one night never reads as two different
// numbers, and every line calls it "slept" the same way: "Slept 6h 52m"
// under Today's minutes and in the evening, "Your watch: slept 6h 52m" in
// the morning check-in's form, and "slept 6h 52m" in its line once it's
// done.
export function watchSlept(day) {
  const slept = num(day?.asleep_min);
  return slept ? fmtMins(slept) : null;
}

// The evening's watch line: [{ label, value }] in reading order, or [] when
// the watch has nothing for the day. `day` is that date's health_days row
// (its sleep is the night before), `workouts` the day's health_workouts.
export function eveningWatchParts(day, workouts) {
  const parts = [];
  // The wake-up automation's moment, or else when the watch saw you wake.
  const up = day?.woke_at ?? day?.sleep_end;
  if (up) parts.push({ label: "Up", value: clock(up), sub: null });
  const slept = watchSlept(day);
  if (slept) {
    const deep = num(day?.deep_min);
    const rem = num(day?.rem_min);
    parts.push({ label: "Slept", value: slept, sub: deep && rem ? `${fmtMins(deep)} deep, ${fmtMins(rem)} REM` : null });
  }
  for (const w of [...(workouts ?? [])].sort((a, b) => new Date(a.started_at) - new Date(b.started_at))) {
    parts.push({ label: workoutName(w.name), value: fmtMins(w.minutes), sub: `at ${clock(w.started_at)}${num(w.avg_hr) ? `, avg ${Math.round(w.avg_hr)} bpm` : ""}` });
  }
  const steps = num(day?.steps);
  if (steps) parts.push({ label: "Steps", value: Math.round(steps).toLocaleString("en-US"), sub: null });
  const rhr = num(day?.resting_hr);
  if (rhr) parts.push({ label: "Resting HR", value: String(Math.round(rhr)), sub: num(day?.hrv_ms) ? `HRV ${Math.round(day.hrv_ms)} ms` : null });
  else if (num(day?.hrv_ms)) parts.push({ label: "HRV", value: `${Math.round(day.hrv_ms)} ms`, sub: null });
  const mindful = num(day?.mindful_min);
  if (mindful) parts.push({ label: "Mindful", value: fmtMins(mindful), sub: null });
  const daylight = num(day?.daylight_min);
  if (daylight) parts.push({ label: "Daylight", value: fmtMins(daylight), sub: null });
  return parts;
}

// The morning check-in's quiet line: what the watch saw of last night,
// beside the times you give, so a late "I'm up" tap can be set right.
// Null when the watch has no night for the day.
export function morningWatchLine(day) {
  const slept = watchSlept(day);
  if (!slept) return null;
  const parts = [`slept ${slept}`];
  const deep = num(day?.deep_min);
  const rem = num(day?.rem_min);
  if (deep && rem) parts.push(`${fmtMins(deep)} deep, ${fmtMins(rem)} REM`);
  if (day?.sleep_end) parts.push(`awake at ${clock(day.sleep_end)}`);
  return `Your watch: ${parts.join(" · ")}`;
}

// Your normal resting heart rate as of a day: the middle reading of the 28
// days before it (so one odd day doesn't move it), once there are at least
// 7 of them to go on. Null until then. `days` are health_days rows.
export function restingNormal(days, date) {
  const from = addDays(date, -28);
  const vals = (days ?? [])
    .filter((d) => {
      const k = String(d?.date ?? "").slice(0, 10);
      return k >= from && k < date;
    })
    .map((d) => num(d.resting_hr))
    .filter((v) => v != null)
    .sort((a, b) => a - b);
  if (vals.length < 7) return null;
  const mid = Math.floor(vals.length / 2);
  return Math.round(vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2);
}

// The little row under Today's minutes: [{ label, value, sub }] in reading
// order, or [] when the watch has nothing, so a day you logged by hand
// looks the same as ever. `today` is today's health_days row (its sleep is
// last night, since a night belongs to the day you woke up on) and
// `yesterday` the day before's, for a resting heart rate the watch hasn't
// worked out for today yet. `normal` is restingNormal's answer.
//
// `night: false` leaves out Slept and Up. Today passes that while the
// morning check-in is on the page, since its one line already says when
// you were up and how long you slept; after that they're back here.
export function minutesWatchParts(today, yesterday, normal, { night = true } = {}) {
  const parts = [];
  const slept = night ? watchSlept(today) : null;
  if (slept) parts.push({ label: "Slept", value: slept, sub: null });
  // The wake-up automation's moment, or else when the watch saw you wake.
  const up = night ? today?.woke_at ?? today?.sleep_end : null;
  if (up) parts.push({ label: "Up", value: clock(up), sub: null });
  const own = num(today?.resting_hr);
  const hr = own ?? num(yesterday?.resting_hr);
  if (hr) {
    const sub = [own ? null : "yesterday", normal ? `your normal ${Math.round(normal)}` : null].filter(Boolean).join(", ");
    parts.push({ label: "Resting HR", value: String(Math.round(hr)), sub: sub || null });
  }
  return parts;
}

// minutesWatchParts for a date, from the health_days rows around it (the
// month before, for the normal). The normal is taken as of the day whose
// reading is shown, so yesterday's reading isn't set beside itself.
export function minutesWatch(days, date, opts) {
  const byDate = new Map((days ?? []).map((d) => [String(d?.date ?? "").slice(0, 10), d]));
  const today = byDate.get(date) ?? null;
  const yesterday = byDate.get(addDays(date, -1)) ?? null;
  const shown = num(today?.resting_hr) ? date : addDays(date, -1);
  return minutesWatchParts(today, yesterday, restingNormal(days, shown), opts);
}

// "Shortcut, 5 min ago" style status for the key: what last used it.
export function lastUsedLine(key, now = Date.now()) {
  if (!key) return "Off";
  if (!key.last_used_at) return "On · waiting for the watch";
  const who = { shortcut: "the watch", wake: "the wake-up", health: "Health Auto Export", app: "the watch app" }[key.last_used_by] ?? "the watch";
  const mins = Math.round((now - new Date(key.last_used_at).getTime()) / 60000);
  const when = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} hr ago` : `${Math.round(mins / 1440)} d ago`;
  return `On · ${who}, ${when}`;
}

// The watch address: the function's URL with the key in it, so a Shortcut
// or Health Auto Export only needs the one thing pasted.
export function watchAddress(apiUrl, key) {
  return `${apiUrl}?key=${encodeURIComponent(key)}`;
}
