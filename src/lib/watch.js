// The Apple Watch, in words: the one quiet line the evening shows, and the
// pieces the On your watch page uses. Pure, so it's tested on its own
// (scripts/test.mjs).
//
// Numbers stay in a supporting role (Aaron, 2026-10-19: words lead, daily
// numbers stay visible but second). Nothing here is compared to a target or
// turned into a win.

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

// The evening's watch line: [{ label, value }] in reading order, or [] when
// the watch has nothing for the day. `day` is that date's health_days row
// (its sleep is the night before), `workouts` the day's health_workouts.
export function eveningWatchParts(day, workouts) {
  const parts = [];
  // The wake-up automation's moment, or else when the watch saw you wake.
  const up = day?.woke_at ?? day?.sleep_end;
  if (up) parts.push({ label: "Up", value: clock(up), sub: null });
  const slept = num(day?.asleep_min);
  if (slept) {
    const deep = num(day?.deep_min);
    const rem = num(day?.rem_min);
    parts.push({ label: "Slept", value: fmtMins(slept), sub: deep && rem ? `${fmtMins(deep)} deep, ${fmtMins(rem)} REM` : null });
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
  const slept = num(day?.asleep_min);
  if (!slept) return null;
  const parts = [`${fmtMins(slept)} asleep`];
  const deep = num(day?.deep_min);
  const rem = num(day?.rem_min);
  if (deep && rem) parts.push(`${fmtMins(deep)} deep, ${fmtMins(rem)} REM`);
  if (day?.sleep_end) parts.push(`awake at ${clock(day.sleep_end)}`);
  return `Your watch: ${parts.join(" · ")}`;
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
