import { supabase } from "./supabaseClient";
import { addDays, parseDateStr, startOfWeek } from "./planDates";

// Scripture study, a week at a time (Aaron, 2026-11-28).
//
// Each week he gives at least this much to four kinds of study, and more is
// welcome. The weeks run Sunday to Saturday, like the rest of the Hub (he
// plans on Sundays), and start over empty every Sunday.
//
// The time comes from the timer, the same minutes Today already tracks: a
// Study timer started from the study card carries its kind in
// `time_log_entries.subcategory` (a column nothing else uses), so an hour
// of reading counts toward both the day's Study minutes and the week's
// reading. A Study timer started anywhere else (the tracker, the watch, the
// widget) has no kind yet; the card lists those as "not sorted" until he
// taps which kind it was.
//
// A kind whose minimum is met for the week earns its token. Tokens aren't
// stored: they're read from the minutes, so fixing a timer fixes the token.

export const STUDY_TAG = "Study";

export const STUDY_KINDS = [
  { key: "Sequential reading", short: "Reading", min: 240, icon: "book" },
  { key: "Doctrinal investigation", short: "Investigation", min: 120, icon: "search" },
  { key: "Review and retrieval", short: "Review", min: 30, icon: "review" },
  { key: "Teaching practice", short: "Teaching", min: 30, icon: "teach" },
];

const KIND_KEYS = new Set(STUDY_KINDS.map((k) => k.key));
export const isStudyKind = (v) => KIND_KEYS.has(v);

// How many past weeks the card can show tokens for.
export const PAST_WEEKS = 8;

// Every Study entry from `PAST_WEEKS` weeks before this one through now,
// running or not.
export async function fetchStudyEntries(userId, date) {
  const since = parseDateStr(addDays(startOfWeek(date), -7 * PAST_WEEKS)).toISOString();
  const { data, error } = await supabase
    .from("time_log_entries")
    .select("id, category, tags, subcategory, description, started_at, ended_at, duration_minutes")
    .eq("user_id", userId)
    .eq("is_example", false)
    .gte("started_at", since)
    .or(`tags.cs.{${STUDY_TAG}},category.eq.${STUDY_TAG}`)
    .order("started_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data ?? [];
}

// An entry's minutes; a running one counts up to `now`.
export function entryMinutes(e, now = Date.now()) {
  if (e.ended_at) return Number(e.duration_minutes) || (new Date(e.ended_at) - new Date(e.started_at)) / 60000;
  return Math.max(0, (now - new Date(e.started_at).getTime()) / 60000);
}

// The local date (YYYY-MM-DD) an entry started on.
function dayOf(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// One week's study: minutes per kind (and today's share of them), the
// minutes not sorted into a kind yet, and those entries.
export function tallyWeek(entries, weekStart, today, now = Date.now()) {
  const end = addDays(weekStart, 7);
  const byKind = Object.fromEntries(STUDY_KINDS.map((k) => [k.key, { minutes: 0, today: 0 }]));
  const unsorted = [];
  let unsortedMinutes = 0;
  for (const e of entries ?? []) {
    const day = dayOf(e.started_at);
    if (day < weekStart || day >= end) continue;
    const mins = entryMinutes(e, now);
    if (isStudyKind(e.subcategory)) {
      byKind[e.subcategory].minutes += mins;
      if (day === today) byKind[e.subcategory].today += mins;
    } else {
      unsorted.push(e);
      unsortedMinutes += mins;
    }
  }
  const kinds = STUDY_KINDS.map((k) => ({ ...k, ...byKind[k.key], met: byKind[k.key].minutes >= k.min }));
  return { weekStart, kinds, unsorted, unsortedMinutes, earned: kinds.filter((k) => k.met).length };
}

// The weeks before this one, newest first, each with the kinds it earned.
export function pastWeeks(entries, date, now = Date.now()) {
  const thisWeek = startOfWeek(date);
  return Array.from({ length: PAST_WEEKS }, (_, i) => tallyWeek(entries, addDays(thisWeek, -7 * (i + 1)), null, now));
}

// Tokens already celebrated, so a token is shown being earned once (on this
// device), not every time Today opens.
const SEEN_KEY = "hub.study-tokens-seen";

export function seenTokens() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
  } catch (err) {
    console.warn(err);
    return new Set();
  }
}

export function markTokensSeen(ids) {
  try {
    const seen = seenTokens();
    ids.forEach((id) => seen.add(id));
    // Only this week's and last week's matter; keep the list short.
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-40)));
  } catch (err) {
    console.warn(err);
  }
}

export const tokenId = (weekStart, kindKey) => `${weekStart}:${kindKey}`;

// "4h", "2h 10m", "35m".
export function fmtStudy(mins) {
  const m = Math.floor(mins);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}
