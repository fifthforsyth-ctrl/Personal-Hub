// The small, pure rules behind honest tracking: when a timer has run away,
// what a morning's sleep looks like, who a stretch of time was spent with,
// and which habit the morning should ask about. Kept apart from the screens
// so each rule can be tested on its own (scripts/test.mjs).

import { toDateStr } from "./planDates.js";

// --- Time helpers -------------------------------------------------------------

export function hhmm(d) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// "04:30:00" or "04:30" → minutes after midnight.
export function clockMinutes(t) {
  if (!t) return null;
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + (m || 0);
}

// "04:30:00" → "4:30"; with { ampm: true } → "4:30 am".
export function fmtClock(t, { ampm = false } = {}) {
  const mins = clockMinutes(t);
  if (mins == null) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const s = `${h12}:${String(m).padStart(2, "0")}`;
  return ampm ? `${s} ${h >= 12 ? "pm" : "am"}` : s;
}

// The first moment after `afterISO` whose clock reads "HH:MM". A runaway
// timer that started at 9:46 pm and an answer of "10:10" means that night;
// an answer of "1:30" means the early hours after it.
export function resolveTimeAfter(afterISO, clock) {
  const after = new Date(afterISO);
  const [h, m] = clock.split(":").map(Number);
  const d = new Date(after);
  d.setHours(h, m, 0, 0);
  if (d <= after) d.setDate(d.getDate() + 1);
  return d;
}

// The latest moment at or before `beforeISO` whose clock reads "HH:MM".
// Morning answers are about the night before: lights out at "22:10" when
// you woke at 4:31 means yesterday.
export function resolveTimeBefore(beforeISO, clock) {
  const before = new Date(beforeISO);
  const [h, m] = clock.split(":").map(Number);
  const d = new Date(before);
  d.setHours(h, m, 0, 0);
  if (d > before) d.setDate(d.getDate() - 1);
  return d;
}

export function fmtDuration(minutes) {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  // Non-breaking spaces, so "7 h 02 m" never splits across lines.
  if (h === 0) return `${r}\u00a0m`;
  return r === 0 ? `${h}\u00a0h` : `${h}\u00a0h\u00a0${String(r).padStart(2, "0")}\u00a0m`;
}

// --- Categories -------------------------------------------------------------

export const SLEEP = "Sleep";

export function tagsOf(entry) {
  return entry?.tags?.length ? entry.tags : entry?.category ? [entry.category] : [];
}

export function isSleep(entry) {
  return tagsOf(entry).includes(SLEEP);
}

// Which follow-up a stopped timer gets, from its categories' families.
export function followUpKinds(entry, familyOf) {
  const families = new Set(tagsOf(entry).map((t) => familyOf(t)));
  const kinds = [];
  if (families.has("Work")) kinds.push("work");
  if (families.has("People")) kinds.push("people");
  return kinds;
}

// --- Runaway timers -------------------------------------------------------------

export const RUNAWAY_HOURS = 3;
export const RUNAWAY_WORK_HOURS = 5;

// A timer other than Sleep that has crossed midnight, or run past 3 hours
// (5 for work), has probably been forgotten. Returns null when it hasn't,
// or { overnight, minutes } when it has.
export function runawayOf(entry, { now = new Date(), isWork = false } = {}) {
  if (!entry || entry.ended_at || isSleep(entry)) return null;
  const start = new Date(entry.started_at);
  const minutes = (now - start) / 60000;
  const overnight = toDateStr(start) !== toDateStr(now);
  const limit = (isWork ? RUNAWAY_WORK_HOURS : RUNAWAY_HOURS) * 60;
  if (!overnight && minutes < limit) return null;
  return { overnight, minutes };
}

// The clock time you usually go to sleep, from recent Sleep entries that
// started in the evening or the small hours: the median, so one late night
// doesn't move it. Times after midnight count as late, not early.
export function usualLightsOut(sleepEntries) {
  const mins = (sleepEntries ?? [])
    .map((e) => new Date(e.started_at))
    .map((d) => d.getHours() * 60 + d.getMinutes())
    .filter((m) => m >= 18 * 60 || m < 4 * 60)
    .map((m) => (m < 12 * 60 ? m + 24 * 60 : m))
    .sort((a, b) => a - b);
  if (mins.length === 0) return null;
  const mid = mins[Math.floor(mins.length / 2)] % (24 * 60);
  return `${String(Math.floor(mid / 60)).padStart(2, "0")}:${String(mid % 60).padStart(2, "0")}`;
}

// Where to suggest the runaway ended: your usual lights-out when that falls
// after the timer started (the "Prep for bed" case), otherwise half an hour
// after it started. Never later than now.
export function suggestedSleepStart(entry, usual, now = new Date()) {
  const start = new Date(entry.started_at);
  let at = usual ? resolveTimeAfter(entry.started_at, usual) : null;
  if (!at || at - start > 6 * 3600000) at = new Date(start.getTime() + 30 * 60000);
  if (at > now) at = new Date(now);
  return at;
}

// --- The morning ---------------------------------------------------------------------

export const MORNING_FROM_HOUR = 3;
export const MORNING_UNTIL_HOUR = 12;

export function isMorning(now = new Date()) {
  const h = now.getHours();
  return h >= MORNING_FROM_HOUR && h < MORNING_UNTIL_HOUR;
}

// Last night's sleep: the latest Sleep entry that started between noon
// yesterday and noon today (running or not).
export function lastNightSleep(sleepEntries, date) {
  const [y, m, d] = date.split("-").map(Number);
  const from = new Date(y, m - 1, d - 1, 12);
  const to = new Date(y, m - 1, d, 12);
  return (
    [...(sleepEntries ?? [])]
      .filter((e) => {
        const s = new Date(e.started_at);
        return s >= from && s < to && isSleep(e);
      })
      .sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null
  );
}

export const DEFAULT_ALARM = "04:30";

// The alarm to offer: today's if it was set last night, otherwise the last
// one you used.
export function rememberedAlarm(todayAlarm, lastAlarm) {
  return (todayAlarm || lastAlarm || DEFAULT_ALARM).slice(0, 5);
}

export function wakeLabel(alarm) {
  return `Up at ${fmtClock(alarm)}`;
}

// The habits the morning asks about: the wake-up habit for this alarm (from
// your watched habits, or "Up at <alarm>" due fifteen minutes after it when
// none is set for that alarm), then any other habit due before noon. A habit
// already logged as a win today by hand isn't asked about.
export function habitsToAsk(watched, { alarm, handWins = [] }) {
  const active = (watched ?? []).filter((h) => h.active !== false);
  const alarmMin = clockMinutes(alarm);
  const forAlarm = active.filter((h) => h.on_alarm && clockMinutes(h.on_alarm) === alarmMin);
  const wake = forAlarm[0] ?? {
    id: `wake-${alarm}`,
    label: wakeLabel(alarm),
    due_by: fmtHHMM(alarmMin + 15),
    on_alarm: alarm,
  };
  const others = active.filter((h) => !h.on_alarm && clockMinutes(h.due_by) < MORNING_UNTIL_HOUR * 60);
  const done = (label, isWake) =>
    handWins.some((w) => {
      const l = (w.habit_label ?? "").trim().toLowerCase();
      return l === label.trim().toLowerCase() || (isWake && /^up\b/.test(l));
    });
  return [{ ...wake, wake: true }, ...others].filter((h) => !done(h.label, h.wake));
}

function fmtHHMM(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// Kept or missed, judged from when you woke: up by the habit's due time
// counts as kept. The answer is only a starting point; one tap changes it.
export function keptByWake(habit, wokeAt) {
  if (!wokeAt) return null;
  const w = new Date(wokeAt);
  return w.getHours() * 60 + w.getMinutes() <= clockMinutes(habit.due_by);
}

// --- Reasons for a miss ------------------------------------------------------------

export const DEFAULT_REASONS = ["Late night", "Date ran late", "Snoozed", "Sick", "Chose rest"];

// The defaults, then reasons you've typed yourself (most recent first),
// once each regardless of case.
export function reasonChips(pastReasons, limit = 8, defaults = DEFAULT_REASONS) {
  const seen = new Set();
  const out = [];
  for (const r of [...defaults, ...(pastReasons ?? [])]) {
    const t = (r ?? "").trim();
    const k = t.toLowerCase();
    if (!t || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.slice(0, limit);
}

// --- People ---------------------------------------------------------------------------

const NOT_NAMES = new Set(["a", "an", "the", "my", "his", "her", "our", "some", "it", "them", "him", "me", "work", "everyone"]);

export function tidyName(raw) {
  const t = (raw ?? "").trim().replace(/[.,!?;:]+$/, "");
  if (!t) return "";
  // Short all-caps names stay as written ("AJ"); everything else gets a capital.
  if (t.length <= 3 && t === t.toUpperCase()) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Names in a description: whoever follows "with" ("Date with Zimi",
// "Gym with my brother"), and any name you've used before that appears as a
// word ("Minister to Mom").
export function namesInText(text, known = []) {
  const found = [];
  const add = (n) => {
    const t = tidyName(n);
    if (t && !NOT_NAMES.has(t.toLowerCase()) && !found.some((f) => f.toLowerCase() === t.toLowerCase())) found.push(t);
  };
  const s = text ?? "";
  for (const m of s.matchAll(/\bwith\s+(?:my\s+|the\s+)?([A-Za-z][A-Za-z'’-]*)/gi)) add(m[1]);
  for (const k of known) {
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${esc}\\b`, "i").test(s)) add(k);
  }
  return found;
}

// Chips for the people picker: names you've picked before, most recent
// first; then names found in past descriptions; then "Family".
export function peopleChips(recentEntries, limit = 8) {
  const out = [];
  const add = (n) => {
    const t = tidyName(n);
    if (t && !NOT_NAMES.has(t.toLowerCase()) && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  };
  const rows = [...(recentEntries ?? [])].sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""));
  for (const r of rows) for (const p of r.people ?? []) add(p);
  for (const r of rows) for (const p of namesInText(r.description)) add(p);
  add("Family");
  return out.slice(0, limit);
}

export const FEELS = [
  { value: "draining", label: "Draining" },
  { value: "neutral", label: "Neutral" },
  { value: "life_giving", label: "Life-giving" },
];

// --- The evening ------------------------------------------------------------

export const STRESS_SOURCES = ["Work", "Money", "Family", "Health", "Too much at once", "Short on sleep"];
export const OFF_PLAN_REASONS = ["Ran long", "Interrupted", "Low energy", "Plans changed", "Chose something better"];

// Lights out this long before the alarm.
export const SLEEP_HOURS = 8.5;

// A planned block as two moments. One whose end is earlier than its start
// crosses midnight, the way sleep is written.
export function chunkSpan(chunk, date) {
  const start = clockMinutes(chunk.start_time);
  const end = clockMinutes(chunk.end_time);
  if (start == null || end == null) return null;
  const day = new Date(`${date}T00:00:00`);
  const from = new Date(day.getTime() + start * 60000);
  const to = new Date(day.getTime() + (end > start ? end : end + 1440) * 60000);
  return { from, to };
}

// The planned categories that didn't happen: for each category with
// planned blocks that have ended by now, how much was planned and how much
// was tracked under it that day. A category is off plan when less than half
// of it happened and at least half an hour is missing; tracked time counts
// wherever in the day it fell, so a block that moved isn't called missed.
// Sleep and blocks with no category are left out.
export function offPlan(chunks, entries, { date, now = new Date() } = {}) {
  const planned = new Map();
  for (const c of chunks ?? []) {
    if (c.is_example) continue;
    const cat = (c.category ?? "").trim();
    if (!cat || cat.toLowerCase() === SLEEP.toLowerCase()) continue;
    const span = chunkSpan(c, date);
    if (!span || span.to > now) continue;
    const key = cat.toLowerCase();
    const p = planned.get(key) ?? { category: cat, planned: 0, tracked: 0 };
    p.planned += (span.to - span.from) / 60000;
    planned.set(key, p);
  }
  if (!planned.size) return [];
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(Math.min(dayStart.getTime() + 86400000, now.getTime()));
  for (const e of entries ?? []) {
    if (e.is_example) continue;
    const from = Math.max(new Date(e.started_at).getTime(), dayStart.getTime());
    const to = Math.min(new Date(e.ended_at ?? now).getTime(), dayEnd.getTime());
    if (to <= from) continue;
    const seen = new Set();
    for (const t of tagsOf(e)) {
      const key = String(t).toLowerCase();
      if (seen.has(key) || !planned.has(key)) continue;
      seen.add(key);
      planned.get(key).tracked += (to - from) / 60000;
    }
  }
  return [...planned.values()]
    .filter((p) => p.tracked < p.planned / 2 && p.planned - p.tracked >= 30)
    .sort((a, b) => b.planned - b.tracked - (a.planned - a.tracked));
}

// When the lights should go out for an alarm on `date` ("HH:MM"): the
// evening before, SLEEP_HOURS ahead of it.
export function lightsOutFor(date, alarm) {
  const mins = clockMinutes(alarm);
  if (mins == null) return null;
  const at = new Date(new Date(`${date}T00:00:00`).getTime() + mins * 60000);
  return new Date(at.getTime() - SLEEP_HOURS * 3600000);
}

// The quiet line on Today about tomorrow's start: shown from forty-five
// minutes before lights out until the alarm, while Sleep isn't running.
export const WIND_DOWN_MINUTES = 45;
export function windDown({ tomorrow, alarm, now = new Date(), sleeping = false }) {
  if (!alarm || sleeping) return null;
  const lightsOut = lightsOutFor(tomorrow, alarm);
  if (!lightsOut) return null;
  const wake = new Date(lightsOut.getTime() + SLEEP_HOURS * 3600000);
  if (now < new Date(lightsOut.getTime() - WIND_DOWN_MINUTES * 60000) || now >= wake) return null;
  return { lightsOut, alarm: alarm.slice(0, 5), past: now >= lightsOut };
}

// The moment to stamp on something logged in the evening about `date`: now,
// or the last minute of that day when the evening runs past midnight, so a
// prayer written at 12:20 still belongs to the day it was about.
export function eveningStamp(date, now = new Date()) {
  if (toDateStr(now) === date) return now;
  const end = new Date(`${date}T23:59:00`);
  return now > end ? end : now;
}
