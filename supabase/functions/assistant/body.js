// What the Apple Watch saw, in a few words, for the prompts that write the
// Walk with God card, the evening questions and the day's synopsis. Pure,
// so scripts/test.mjs checks it on its own.
//
// It's context for understanding the day they had (a short night, an early
// workout), never a score: numbers are words here, each next to their own
// usual when there are enough days to know it.

const USUAL_NEEDS = 3; // days of history before "usual" means anything

export function fmtMins(m) {
  const n = Math.round(Number(m) || 0);
  const h = Math.floor(n / 60);
  const r = n % 60;
  return h ? `${h}h ${String(r).padStart(2, "0")}m` : `${r}m`;
}

const num = (v) => (v == null || !(Number(v) > 0) ? null : Number(v));
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

function clockIn(iso, tz) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

function localDate(iso, tz) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day}`;
}

// "Traditional Strength Training" → "Strength", as the evening shows it.
export function workoutName(name) {
  const n = String(name ?? "Workout").trim();
  const short = n
    .replace(/^(traditional|functional)\s+/i, "")
    .replace(/^(outdoor|indoor)\s+/i, "")
    .replace(/\s+training$/i, "")
    .replace(/^high intensity interval$/i, "HIIT");
  return short ? short[0].toUpperCase() + short.slice(1) : "Workout";
}

// Last night against their usual, in words: "6h 10m asleep, about 55m less
// than their usual 7h 05m". Within 30 minutes either way is just "usual".
function sleepWords(slept, usual) {
  const base = `${fmtMins(slept)} asleep`;
  if (usual == null) return base;
  const diff = slept - usual;
  if (Math.abs(diff) < 30) return `${base}, about their usual`;
  return `${base}, about ${fmtMins(Math.abs(diff))} ${diff < 0 ? "less" : "more"} than their usual ${fmtMins(usual)}`;
}

// `day` is the date's health_days row (its sleep is the night that ended
// that morning), `history` the rows of the days before it, `workouts` the
// health_workouts around it (only the ones that fell on `date` count).
// Null when the watch has nothing for the day.
export function watchForPrompt({ date, day, history, workouts, tz }) {
  const out = {};
  const up = day?.woke_at ?? day?.sleep_end;
  if (up) out.up_at = clockIn(up, tz);

  const before = (history ?? []).filter((h) => String(h.date).slice(0, 10) < date);
  const usualOf = (col) => {
    const xs = before.map((h) => num(h[col])).filter((v) => v != null);
    return xs.length >= USUAL_NEEDS ? mean(xs) : null;
  };

  const slept = num(day?.asleep_min);
  if (slept) {
    out.last_night = sleepWords(slept, usualOf("asleep_min"));
    const deep = num(day?.deep_min);
    const rem = num(day?.rem_min);
    if (deep && rem) out.sleep_stages = `${fmtMins(deep)} deep, ${fmtMins(rem)} REM`;
  }

  const today = (workouts ?? [])
    .filter((w) => w?.started_at && localDate(w.started_at, tz) === date)
    .sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at))
    .map((w) => `${workoutName(w.name)}, ${fmtMins(w.minutes)} at ${clockIn(w.started_at, tz)}`);
  if (today.length) out.workouts = today;

  const steps = num(day?.steps);
  if (steps) out.steps = Math.round(steps);

  const rhr = num(day?.resting_hr);
  if (rhr) {
    const usual = usualOf("resting_hr");
    out.resting_heart_rate = usual == null ? `${Math.round(rhr)} bpm` : `${Math.round(rhr)} bpm (their usual ${Math.round(usual)})`;
  }

  return Object.keys(out).length ? out : null;
}

// What the prompts are told about it, once, in the system text.
export const WATCH_NOTE = `The record may include apple_watch: what their Apple Watch measured (when they got up, last night's sleep against their own usual, workouts, steps, resting heart rate). It is context for understanding the day they actually had, such as a short night or an early workout. Use it only when it helps them see the day or God's hand in it (for example, where strength came from after a short night). Never comment on the numbers as numbers, never judge or score them, and never tell them to sleep more or exercise more.`;
