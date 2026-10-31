// Reading what Health Auto Export sends, with no database in sight, so it
// can be tested on its own (scripts/test.mjs) and used by the `watch`
// function.
//
// Health Auto Export's REST automation posts
//   { data: { metrics: [...], workouts: [...], stateOfMind: [...], ... } }
// Each metric is { name, units, data: [{ date, qty }] }; heart rate rows
// carry Min/Avg/Max instead of qty; sleep comes either aggregated (one row
// per night: totalSleep, core, deep, rem, sleepStart, sleepEnd, inBed...,
// in `units`, usually hours) or unaggregated (one row per stage: startDate,
// endDate, value "Core" | "Deep" | "REM" | "Awake" | "In Bed" | "Asleep").
// Workouts come as v2 ({ id, name, start, end, duration in seconds,
// activeEnergyBurned, distance, heartRate: { avg, max } ... }) or v1 (no id,
// no duration, activeEnergy / avgHeartRate objects). Dates are
// "yyyy-MM-dd HH:mm:ss Z" ("2026-10-31 05:10:00 -0600") or "yyyy-MM-dd".
//
// Metric names aren't in the format's documentation, so they're matched
// loosely, and anything that doesn't match is kept by its own name in
// `extra` rather than dropped. The last few raw payloads are kept too
// (health_imports), so a metric that lands in the wrong place can be
// looked at and fixed.

// A date as Health Auto Export writes it, or an ISO string. Date-only
// strings are noon UTC, so their calendar day survives any time zone.
export function parseHaeDate(s) {
  if (s == null || s === "") return null;
  if (s instanceof Date) return Number.isNaN(s.getTime()) ? null : s;
  const str = String(s).trim();
  let m = str.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)\s*(Z|[+-]\d{2}:?\d{2})?$/);
  if (m) {
    let zone = m[3] ?? "Z";
    if (/^[+-]\d{4}$/.test(zone)) zone = `${zone.slice(0, 3)}:${zone.slice(3)}`;
    const time = m[2].length === 5 ? `${m[2]}:00` : m[2];
    const d = new Date(`${m[1]}T${time}${zone}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  m = str.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (m) return new Date(`${m[1]}T12:00:00Z`);
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

// The calendar day of a moment in a time zone, "YYYY-MM-DD".
export function localDate(d, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(d)
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// The day a row belongs to: a date-only string is that day as written;
// a moment is the day it fell on where you live.
function dayOf(s, tz) {
  const str = String(s ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = parseHaeDate(str);
  return d ? localDate(d, tz) : null;
}

const norm = (name) => String(name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// Column, how a day's rows combine ("sum" for counts over the day, "avg"
// for rates, "last" for a reading), and a unit converter.
const kcal = (v, u) => (/kj/i.test(u ?? "") ? v / 4.184 : v);
const miles = (v, u) => (/^km/i.test(u ?? "") ? v * 0.621371 : /^m$/i.test(u ?? "") ? v / 1609.344 : v);
const minutes = (v, u) => (/^(hr|h|hours?)$/i.test(u ?? "") ? v * 60 : /^(s|sec|seconds?)$/i.test(u ?? "") ? v / 60 : v);
const celsius = (v, u) => (/degf|°f|^f$/i.test(u ?? "") ? (v - 32) * (5 / 9) : v);
const pounds = (v, u) => (/^kg/i.test(u ?? "") ? v * 2.20462 : v);
const mg = (v, u) => (/^g$/i.test(u ?? "") ? v * 1000 : v);
const pct = (v) => (v > 0 && v <= 1 ? v * 100 : v);
const same = (v) => v;

const METRICS = [
  { col: "steps", how: "sum", conv: same, names: ["step_count", "steps"] },
  { col: "active_kcal", how: "sum", conv: kcal, names: ["active_energy", "active_energy_burned"] },
  { col: "exercise_min", how: "sum", conv: minutes, names: ["apple_exercise_time", "exercise_time"] },
  { col: "stand_hours", how: "sum", conv: same, names: ["apple_stand_hour", "stand_hour", "stand_hours"] },
  { col: "daylight_min", how: "sum", conv: minutes, names: ["time_in_daylight"] },
  { col: "mindful_min", how: "sum", conv: minutes, names: ["mindful_minutes", "mindfulness", "mindful_session", "mindfulness_session"] },
  { col: "distance_mi", how: "sum", conv: miles, names: ["walking_running_distance", "walking_and_running_distance", "distance_walking_running"] },
  { col: "flights", how: "sum", conv: same, names: ["flights_climbed"] },
  { col: "caffeine_mg", how: "sum", conv: mg, names: ["dietary_caffeine", "caffeine"] },
  { col: "resting_hr", how: "avg", conv: same, names: ["resting_heart_rate"] },
  { col: "hrv_ms", how: "avg", conv: same, names: ["heart_rate_variability", "heart_rate_variability_sdnn", "hrv"] },
  { col: "avg_hr", how: "avg", conv: same, names: ["heart_rate"] },
  { col: "respiratory_rate", how: "avg", conv: same, names: ["respiratory_rate"] },
  { col: "wrist_temp_c", how: "avg", conv: celsius, names: ["apple_sleeping_wrist_temperature", "sleeping_wrist_temperature", "wrist_temperature"] },
  { col: "spo2_pct", how: "avg", conv: pct, names: ["blood_oxygen_saturation", "oxygen_saturation", "blood_oxygen"] },
  { col: "vo2max", how: "avg", conv: same, names: ["vo2_max", "vo2max"] },
  { col: "weight_lb", how: "last", conv: pounds, names: ["weight_body_mass", "body_mass", "weight"] },
];
const BY_NAME = new Map(METRICS.flatMap((m) => m.names.map((n) => [n, m])));
export const HEALTH_COLUMNS = METRICS.map((m) => m.col);
const SUMMED = new Set(METRICS.filter((m) => m.how === "sum").map((m) => m.col));

export function metricFor(name) {
  return BY_NAME.get(norm(name)) ?? null;
}

const isSleep = (name) => /^sleep(_analysis)?$/.test(norm(name));

// The number a row carries: qty, or the average of a Min/Avg/Max row.
function valueOf(row) {
  for (const k of ["qty", "Avg", "avg", "value"]) {
    const v = Number(row?.[k]);
    if (row?.[k] != null && row[k] !== "" && Number.isFinite(v)) return v;
  }
  return null;
}

const round = (v, places = 1) => {
  const f = 10 ** places;
  return Math.round(v * f) / f;
};

// --- Sleep -------------------------------------------------------------------------------------

// One night: { date, start, end, asleep, deep, rem, core, awake, inBed }
// (minutes; start and end are Dates). `date` is the day you woke up on.
function nightFromAggregated(row, units, tz) {
  const m = (k) => {
    const v = Number(row?.[k]);
    return row?.[k] == null || !Number.isFinite(v) ? null : minutes(v, units || "hr");
  };
  const start = parseHaeDate(row.sleepStart ?? row.inBedStart);
  const end = parseHaeDate(row.sleepEnd ?? row.inBedEnd);
  const staged = [m("core"), m("deep"), m("rem")].some((v) => v != null);
  const asleep = m("totalSleep") ?? (staged || m("asleep") != null ? (m("core") ?? 0) + (m("deep") ?? 0) + (m("rem") ?? 0) + (m("asleep") ?? 0) : null);
  return {
    date: end ? localDate(end, tz) : dayOf(row.date, tz),
    start,
    end,
    asleep,
    deep: m("deep"),
    rem: m("rem"),
    core: m("core"),
    awake: m("awake"),
    inBed: m("inBed"),
  };
}

// Stage rows grouped into nights: a gap of three hours or more between
// one stage and the next starts a new night.
function nightsFromStages(rows, tz) {
  const stages = rows
    .map((r) => ({ start: parseHaeDate(r.startDate ?? r.start), end: parseHaeDate(r.endDate ?? r.end), value: String(r.value ?? "").toLowerCase() }))
    .filter((s) => s.start && s.end && s.end > s.start)
    .sort((a, b) => a.start - b.start);
  const groups = [];
  for (const s of stages) {
    const last = groups[groups.length - 1];
    const lastEnd = last ? Math.max(...last.map((x) => x.end.getTime())) : 0;
    if (last && s.start.getTime() - lastEnd < 3 * 3600000) last.push(s);
    else groups.push([s]);
  }
  return groups.map((g) => {
    const mins = (pred) => g.filter(pred).reduce((n, s) => n + (s.end - s.start) / 60000, 0);
    const sleeping = g.filter((s) => /core|deep|rem|asleep|unspecified/.test(s.value));
    const span = sleeping.length ? sleeping : g;
    const start = new Date(Math.min(...span.map((s) => s.start.getTime())));
    const end = new Date(Math.max(...span.map((s) => s.end.getTime())));
    const has = (re) => g.some((s) => re.test(s.value));
    return {
      date: localDate(end, tz),
      start,
      end,
      asleep: round(mins((s) => /core|deep|rem|asleep|unspecified/.test(s.value)), 0),
      deep: has(/deep/) ? round(mins((s) => /deep/.test(s.value)), 0) : null,
      rem: has(/rem/) ? round(mins((s) => /rem/.test(s.value)), 0) : null,
      core: has(/core/) ? round(mins((s) => /core/.test(s.value)), 0) : null,
      awake: has(/awake/) ? round(mins((s) => /awake/.test(s.value)), 0) : null,
      inBed: has(/in ?bed/) ? round(mins((s) => /in ?bed/.test(s.value)), 0) : null,
    };
  });
}

// The main sleep of each day (the night with the most sleep), so a nap
// doesn't stand in for the night.
function mainNights(nights) {
  const best = new Map();
  for (const n of nights) {
    if (!n.date) continue;
    const had = best.get(n.date);
    if (!had || (n.asleep ?? 0) > (had.asleep ?? 0)) best.set(n.date, n);
  }
  return [...best.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

// --- Workouts ----------------------------------------------------------------------------------

const qtyOf = (x) => {
  if (x == null) return null;
  if (Array.isArray(x)) {
    const vals = x.map((r) => Number(r?.qty)).filter(Number.isFinite);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  }
  if (typeof x === "object") {
    const v = Number(x.qty);
    return Number.isFinite(v) ? v : null;
  }
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
};
const unitsOf = (x) => (Array.isArray(x) ? x[0]?.units : x?.units) ?? null;

export function exerciseKindOf(name) {
  const n = String(name ?? "").toLowerCase();
  if (/run|jog/.test(n)) return "run";
  if (/strength|functional|hiit|high intensity|core training|cross ?training|weight|lifting|kettlebell|crossfit/.test(n)) return "gym";
  return "other";
}

export function workoutFrom(w) {
  const start = parseHaeDate(w?.start);
  const end = parseHaeDate(w?.end);
  if (!start || !end || end <= start) return null;
  const secs = Number(w.duration);
  // v2 says seconds; anything implausible for seconds falls back to the clock.
  const span = (end - start) / 60000;
  const mins = Number.isFinite(secs) && secs > 0 && Math.abs(secs / 60 - span) < Math.max(5, span * 0.5) ? secs / 60 : span;
  const energy = w.activeEnergyBurned ?? w.activeEnergy;
  const kc = qtyOf(energy);
  const avg = qtyOf(w.avgHeartRate) ?? qtyOf(w.heartRate?.avg);
  const max = qtyOf(w.maxHeartRate) ?? qtyOf(w.heartRate?.max);
  const dist = qtyOf(w.distance);
  const name = String(w.name ?? "Workout").trim() || "Workout";
  return {
    external_id: String(w.id ?? `${name}@${start.toISOString()}`),
    name,
    started_at: start.toISOString(),
    ended_at: end.toISOString(),
    minutes: round(mins, 1),
    active_kcal: kc == null ? null : round(kcal(kc, unitsOf(energy)), 0),
    avg_hr: avg == null ? null : round(avg, 0),
    max_hr: max == null ? null : round(max, 0),
    distance: dist == null || dist <= 0 ? null : round(dist, 2),
    distance_unit: dist == null || dist <= 0 ? null : unitsOf(w.distance) ?? "mi",
    kind: exerciseKindOf(name),
  };
}

// --- The whole payload -------------------------------------------------------------------------

// { days: { "YYYY-MM-DD": { col: value, extra: {...} } }, nights: [...],
//   workouts: [...], unknown: [names], counts }
export function readHealthPayload(payload, tz) {
  const data = payload?.data ?? payload ?? {};
  const metrics = Array.isArray(data.metrics) ? data.metrics : [];
  const days = {};
  const dayRow = (date) => (days[date] ??= { extra: {} });
  const acc = {}; // date -> col -> { sum, n, last, lastAt }
  const nights = [];
  const unknown = new Set();
  let rows = 0;

  for (const metric of metrics) {
    const list = Array.isArray(metric?.data) ? metric.data : [];
    rows += list.length;
    if (isSleep(metric?.name)) {
      const stages = list.filter((r) => r && r.value != null && (r.startDate || r.start) && r.totalSleep == null);
      const agg = list.filter((r) => !stages.includes(r));
      for (const r of agg) nights.push(nightFromAggregated(r, metric.units, tz));
      nights.push(...nightsFromStages(stages, tz));
      continue;
    }
    const spec = metricFor(metric?.name);
    for (const r of list) {
      const date = dayOf(r?.date ?? r?.startDate, tz);
      const v = valueOf(r);
      if (!date || v == null) continue;
      if (!spec) {
        unknown.add(String(metric?.name ?? "?"));
        const key = norm(metric?.name) || "unknown";
        const ex = dayRow(date).extra;
        const prev = ex[key];
        ex[key] = { qty: round((prev?.qty ?? 0) + v, 2), units: metric?.units ?? null };
        continue;
      }
      const val = spec.conv(v, metric?.units ?? r?.units);
      const a = ((acc[date] ??= {})[spec.col] ??= { sum: 0, n: 0, last: null, lastAt: -Infinity });
      a.sum += val;
      a.n += 1;
      const at = parseHaeDate(r?.date)?.getTime() ?? 0;
      if (at >= a.lastAt) {
        a.last = val;
        a.lastAt = at;
      }
    }
  }

  for (const [date, cols] of Object.entries(acc)) {
    const row = dayRow(date);
    for (const [col, a] of Object.entries(cols)) {
      const spec = METRICS.find((m) => m.col === col);
      const v = spec.how === "sum" ? a.sum : spec.how === "avg" ? a.sum / a.n : a.last;
      row[col] = col === "steps" || col === "flights" ? Math.round(v) : round(v, col === "wrist_temp_c" ? 2 : 1);
    }
  }

  const main = mainNights(nights);
  for (const n of main) {
    const row = dayRow(n.date);
    row.sleep_start = n.start ? n.start.toISOString() : null;
    row.sleep_end = n.end ? n.end.toISOString() : null;
    for (const [k, col] of [["asleep", "asleep_min"], ["deep", "deep_min"], ["rem", "rem_min"], ["core", "core_min"], ["awake", "awake_min"], ["inBed", "in_bed_min"]]) {
      if (n[k] != null) row[col] = round(n[k], 0);
    }
  }

  const workouts = (Array.isArray(data.workouts) ? data.workouts : []).map(workoutFrom).filter(Boolean);
  const mindState = Array.isArray(data.stateOfMind) ? data.stateOfMind.length : 0;

  return {
    days,
    nights: main.filter((n) => n.start && n.end && n.end > n.start),
    workouts,
    unknown: [...unknown].sort(),
    counts: { metrics: metrics.length, rows, nights: main.length, workouts: workouts.length, days: Object.keys(days).length, stateOfMind: mindState },
  };
}

// One day's new numbers over what's already stored for it. A day's
// totals (steps, minutes...) only grow as the day goes on, and a resend
// of part of a day must not shrink a full day's count, so those keep the
// larger; readings and averages take the newest; extra merges by name.
export function mergeDay(old, fresh) {
  const out = { ...(old ?? {}) };
  for (const [k, v] of Object.entries(fresh ?? {})) {
    if (k === "extra") continue;
    if (v == null) continue;
    if (SUMMED.has(k) && out[k] != null) out[k] = Math.max(Number(out[k]), Number(v));
    else out[k] = v;
  }
  out.extra = { ...(old?.extra ?? {}), ...(fresh?.extra ?? {}) };
  return out;
}

// --- Into the minutes log ----------------------------------------------------------------------

const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
const sleepy = (e) => (e?.tags ?? []).includes("Sleep") || e?.category === "Sleep";
const exercisey = (e) => (e?.tags ?? []).includes("Exercise") || e?.category === "Exercise";

// What one night of watch sleep does to the minutes log, given the Sleep
// entries around it (started within a day of it) and now:
//   { kind: "skip" }                   a Sleep entry already covers it
//   { kind: "end", id, at }            a Sleep timer still running from
//                                       that night ends when you woke
//   { kind: "add", start, end }        nothing logged: the night goes in
// A running Sleep timer is only ended when the night is fresh (woke up in
// the last 18 hours) and the timer began no more than 3 hours before you
// fell asleep, so an old forgotten timer is left to the fix list.
export function sleepAction(night, entries, now = new Date()) {
  const start = new Date(night.start).getTime();
  const end = new Date(night.end).getTime();
  if (!(end > start) || end > now.getTime() + 5 * 60000) return { kind: "skip", why: "not over yet" };
  const sleeps = (entries ?? []).filter(sleepy);
  const running = sleeps.find((e) => !e.ended_at && new Date(e.started_at).getTime() < end);
  if (running) {
    const began = new Date(running.started_at).getTime();
    const fresh = now.getTime() - end < 18 * 3600000;
    if (fresh && began >= start - 3 * 3600000) return { kind: "end", id: running.id, at: new Date(end).toISOString() };
    return { kind: "skip", why: "a Sleep timer is running" };
  }
  const covered = sleeps.some((e) => e.ended_at && overlaps(start, end, new Date(e.started_at).getTime(), new Date(e.ended_at).getTime()));
  if (covered) return { kind: "skip", why: "already logged" };
  return { kind: "add", start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

// A workout's Exercise entry: the one you already logged over it, or a
// new one.
export function workoutAction(workout, entries) {
  const start = new Date(workout.started_at).getTime();
  const end = new Date(workout.ended_at).getTime();
  const mine = (entries ?? []).find((e) => {
    if (!exercisey(e)) return false;
    const s = new Date(e.started_at).getTime();
    const f = e.ended_at ? new Date(e.ended_at).getTime() : Date.now();
    return overlaps(start, end, s, f);
  });
  if (mine) return { kind: "link", id: mine.id };
  return { kind: "add" };
}

// The Exercise row for a workout the minutes log doesn't have yet.
export function exerciseEntry(userId, w) {
  const run = w.kind === "run" && w.distance && /^(mi|km)$/i.test(w.distance_unit ?? "");
  return {
    user_id: userId,
    category: "Exercise",
    tags: ["Exercise"],
    description: w.name,
    started_at: w.started_at,
    ended_at: w.ended_at,
    exercise_kind: w.kind,
    exercise_metric: run ? w.distance : null,
    exercise_unit: run ? w.distance_unit.toLowerCase() : null,
    source: "watch",
  };
}

// --- Words for the evening ---------------------------------------------------------------------

export function fmtMins(m) {
  const n = Math.round(Number(m) || 0);
  const h = Math.floor(n / 60);
  const r = n % 60;
  return h ? `${h}h ${String(r).padStart(2, "0")}m` : `${r}m`;
}
