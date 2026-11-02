import { fmtMins } from "./watch.js";

// Checks: what each evening asks about a target or a weekly focus, and how
// each answer scores (supabase/migrations/0103_evening_checks.sql).
//
// A check is one plain question in your words, answered one of eight ways.
// Each says what passes. Every answer comes out as one of three marks,
// passed, partly or not, the same Yes, Some and No the Mark has always
// counted, so the arrow still lands by the share of a bullseye you did:
// all passed is a bullseye, none is a miss. A reflection-only check is
// asked every evening and never scored, so it can't hold an arrow back.
//
// Everything here is pure. The evening loads the rows, these turn answers
// into marks and the marks into a ring.

export const KINDS = [
  { key: "yn", label: "Yes / No", about: "Did it or didn't." },
  { key: "ysn", label: "Yes / Some / No", about: "Room for a partial day." },
  { key: "scale", label: "1 to 10", about: "How well, not just whether." },
  { key: "number", label: "A number", about: "Pages, glasses, reps." },
  { key: "minutes", label: "Minutes", about: "How long. Your time log can fill it." },
  { key: "time", label: "A time", about: "When it happened. Up by, in bed by." },
  { key: "choice", label: "Pick one", about: "A few answers you name." },
  { key: "note", label: "A few words", about: "Written, not scored, unless you say." },
];

export const KIND_KEYS = KINDS.map((k) => k.key);

export function kindLabel(kind) {
  return KINDS.find((k) => k.key === kind)?.label ?? "Yes / No";
}

// Reflection tools that hold up, as starting points for a check. Each one
// fills in the editor; the words are yours to change.
export const TEMPLATES = [
  {
    key: "best",
    name: "Did I do my best to…",
    source: "Marshall Goldsmith, Triggers (2015)",
    about: "His daily active questions: score your own effort 1 to 10, not the outcome, so a hard day can still pass.",
    check: { text: "Did I do my best to ", kind: "scale", pass: { min: 7 }, counts: true },
  },
  {
    key: "virtue",
    name: "A virtue kept",
    source: "Benjamin Franklin's daily chart (1726)",
    about: "He kept one virtue in view each week and marked each day he fell short. A plain Yes or No, every night.",
    check: { text: "Kept ", kind: "yn", pass: { on: "yes" }, counts: true },
  },
  {
    key: "ifthen",
    name: "If-then plan",
    source: "Peter Gollwitzer, implementation intentions (1999)",
    about: "\"When X happens, I will do Y.\" Across 94 studies, plans worded this way roughly doubled follow-through (Gollwitzer and Sheeran, 2006).",
    check: { text: "When , I ", kind: "yn", pass: { on: "yes" }, counts: true },
  },
  {
    key: "upby",
    name: "Up by",
    source: "Answered from when you got up",
    about: "Filled from the time you tapped I'm up, or the watch, so there's nothing to answer.",
    check: { text: "Up by 4:35", kind: "time", pass: { by: "04:35" }, auto: "wake", counts: true },
  },
  {
    key: "minutes",
    name: "Time on it",
    source: "Answered from your time log",
    about: "Minutes logged in the focus's categories. Some time counts as partly, the full amount as passed.",
    check: { text: "Time drawing", kind: "minutes", pass: { min: 30 }, counts: true },
  },
  {
    key: "count",
    name: "A count",
    source: "Any number you track",
    about: "Pages, glasses of water, people served. Pass at or above a number, or at or below one.",
    check: { text: "Pages read", kind: "number", pass: { min: 10 }, unit: "pages", counts: true },
  },
  {
    key: "aar",
    name: "After-action review",
    source: "U.S. Army",
    about: "What was supposed to happen, what happened, and why they differed. Reflection only.",
    check: { text: "What was supposed to happen, what happened, and why?", kind: "note", pass: {}, counts: false },
  },
  {
    key: "examen",
    name: "The Examen",
    source: "Ignatius of Loyola, Spiritual Exercises (1548)",
    about: "Walk back through the day for where you were most yourself and where you drifted. Reflection only.",
    check: { text: "Where was I most myself today, and where did I drift?", kind: "note", pass: {}, counts: false },
  },
];

// --- A check, cleaned ----------------------------------------------------------

const DEFAULT_PASS = {
  yn: { on: "yes" },
  ysn: { on: "yes" },
  scale: { min: 7 },
  number: { min: 1 },
  minutes: {},
  time: {},
  choice: { on: [] },
  note: {},
};

// Any row (an aim, a focus check, or one being edited) as the rest of this
// file wants it. Unknown kinds read as Yes/No, the kind every existing aim
// became.
export function normCheck(row) {
  const kind = KIND_KEYS.includes(row?.kind) ? row.kind : "yn";
  const raw = row?.pass && typeof row.pass === "object" && !Array.isArray(row.pass) ? row.pass : {};
  const options = (Array.isArray(row?.options) ? row.options : []).map((o) => String(o ?? "").trim()).filter(Boolean).slice(0, 8);
  const pass = cleanPass(kind, raw, options);
  return {
    id: row?.id ?? null,
    text: String(row?.text ?? "").trim(),
    kind,
    options,
    pass,
    unit: String(row?.unit ?? "").trim().slice(0, 20) || null,
    auto: row?.auto === "wake" ? "wake" : null,
    counts: kind === "note" ? row?.counts === true : row?.counts !== false,
    focus_id: row?.focus_id || null,
  };
}

function cleanPass(kind, raw, options) {
  const base = DEFAULT_PASS[kind];
  if (kind === "yn" || kind === "ysn") return { on: raw.on === "no" ? "no" : "yes" };
  if (kind === "scale") return { min: clampInt(raw.min, 1, 10, base.min) };
  if (kind === "number") {
    if (isNum(raw.max) && !isNum(raw.min)) return { max: Number(raw.max) };
    return { min: isNum(raw.min) ? Number(raw.min) : base.min };
  }
  if (kind === "minutes") return isNum(raw.min) && Number(raw.min) > 0 ? { min: Math.round(Number(raw.min)) } : {};
  if (kind === "time") return isTime(raw.by) ? { by: padTime(raw.by) } : {};
  if (kind === "choice") return { on: (Array.isArray(raw.on) ? raw.on : []).map(String).filter((o) => options.includes(o)) };
  if (kind === "note") return raw.words ? { words: true } : {};
  return {};
}

// What goes to the database for a check: only its own columns.
export function checkRow(check) {
  const c = normCheck(check);
  return { text: c.text, kind: c.kind, options: c.options, pass: c.pass, unit: c.unit, auto: c.auto, counts: c.counts, focus_id: c.focus_id };
}

// Two checks the same, column by column (so a save skips the ones untouched).
export function sameCheck(a, b) {
  return JSON.stringify(checkRow(a)) === JSON.stringify(checkRow(b));
}

// Whether a check can ever be scored. A choice with no passing answer, a
// time with no "by", and a note that only asks are reflection only, however
// they're marked.
export function scores(check) {
  const c = normCheck(check);
  if (!c.counts) return false;
  if (c.kind === "choice") return c.pass.on.length > 0;
  if (c.kind === "time") return Boolean(c.pass.by);
  if (c.kind === "note") return Boolean(c.pass.words);
  return true;
}

// --- Answers -------------------------------------------------------------------

// Whether there's an answer at all.
export function answered(check, value) {
  const c = normCheck(check);
  if (value == null) return false;
  if (c.kind === "note" || c.kind === "choice" || c.kind === "yn" || c.kind === "ysn" || c.kind === "time") return String(value).trim() !== "";
  return isNum(value);
}

// How an answer marks: 2 passed, 1 partly, 0 not, or null when it isn't
// answered or the check doesn't score.
//
//   Yes / No         the passing answer is 2, the other 0
//   Yes / Some / No  Some is always 1
//   1 to 10          at or above the bar 2, up to two below 1
//   a number         at or above a minimum 2, anything above zero 1; at or
//                    under a maximum 2, up to half again over it 1
//   minutes          the full amount 2, any time at all 1 (no amount set:
//                    any time is 2)
//   a time           by the time 2, up to 15 minutes late 1. Times are read
//                    round the clock, so 12:20 am is late for "by 10:30 pm"
//   pick one         a passing choice 2, any other 0
//   a few words      written 2, when the words are what it asks for
export function markOf(check, value) {
  const c = normCheck(check);
  if (!scores(c) || !answered(c, value)) return null;
  switch (c.kind) {
    case "yn": {
      const v = String(value).toLowerCase();
      if (v !== "yes" && v !== "no") return null;
      return v === c.pass.on ? 2 : 0;
    }
    case "ysn": {
      const v = String(value).toLowerCase();
      if (v === "some") return 1;
      if (v !== "yes" && v !== "no") return null;
      return v === c.pass.on ? 2 : 0;
    }
    case "scale": {
      const n = Number(value);
      if (n >= c.pass.min) return 2;
      return n >= c.pass.min - 2 ? 1 : 0;
    }
    case "number": {
      const n = Number(value);
      if (isNum(c.pass.max)) {
        if (n <= c.pass.max) return 2;
        return n <= c.pass.max * 1.5 ? 1 : 0;
      }
      if (n >= c.pass.min) return 2;
      return n > 0 ? 1 : 0;
    }
    case "minutes": {
      const n = Number(value);
      if (!c.pass.min) return n > 0 ? 2 : 0;
      if (n >= c.pass.min) return 2;
      return n > 0 ? 1 : 0;
    }
    case "time": {
      if (!isTime(value)) return null;
      const late = clockDiff(padTime(value), c.pass.by);
      if (late <= 0) return 2;
      return late <= 15 ? 1 : 0;
    }
    case "choice":
      return c.pass.on.includes(String(value)) ? 2 : 0;
    case "note":
      return String(value).trim() ? 2 : 0;
    default:
      return null;
  }
}

// Minutes from `by` to `at`, read round the clock: from 12 hours early to
// 12 hours late. Negative is early.
export function clockDiff(at, by) {
  let d = toMin(at) - toMin(by);
  while (d > 720) d -= 1440;
  while (d <= -720) d += 1440;
  return d;
}

// Every check that scores has an answer. Reflection-only checks never hold
// the arrow back.
export function allAnswered(checks, values) {
  return (checks ?? []).every((c, i) => !scores(c) || answered(c, values?.[i]));
}

// The share of a bullseye the answers make, 0..1, with any `extra` shares
// (a weekly focus that counts toward this target) averaged in as one more
// check each. Null until every scoring check is answered, or when nothing
// scores at all.
export function shareOf(checks, values, extra = []) {
  if (!allAnswered(checks, values)) return null;
  const parts = [];
  (checks ?? []).forEach((c, i) => {
    const m = markOf(c, values?.[i]);
    if (m != null) parts.push(m / 2);
  });
  for (const s of extra ?? []) if (isNum(s)) parts.push(Math.max(0, Math.min(1, Number(s))));
  if (!parts.length) return null;
  return parts.reduce((a, s) => a + s, 0) / parts.length;
}

// The ring a share lands in, the Mark's thresholds: all of it a bullseye,
// three quarters inner, half middle, a quarter outer, anything at all the
// edge, none a miss.
export function levelOfShare(share) {
  if (share == null || !isNum(share)) return null;
  if (share >= 1) return 0;
  if (share >= 0.75) return 1;
  if (share >= 0.5) return 2;
  if (share >= 0.25) return 3;
  return share > 0 ? 4 : 5;
}

export function checksLevel(checks, values, extra = []) {
  return levelOfShare(shareOf(checks, values, extra));
}

// What an arrow at a ring is worth when it counts toward a bigger target:
// the middle of the share that would have put it there.
export const LEVEL_SHARE = [1, 0.875, 0.625, 0.375, 0.125, 0];

export function shareOfLevel(level) {
  return LEVEL_SHARE[level] ?? null;
}

// --- What an answer reads as -------------------------------------------------

export function valueText(check, value) {
  const c = normCheck(check);
  if (!answered(c, value)) return "";
  switch (c.kind) {
    case "yn":
    case "ysn":
      return cap(String(value));
    case "scale":
      return `${Number(value)}/10`;
    case "number":
      return `${trimNum(value)}${c.unit ? ` ${c.unit}` : ""}`;
    case "minutes":
      return fmtMins(Number(value)) || "0m";
    case "time":
      return clockText(value);
    default:
      return String(value);
  }
}

// What passes, in a few words: "Yes passes", "7 or more", "By 4:35 am".
export function passText(check) {
  const c = normCheck(check);
  if (!scores(c)) return "Reflection only";
  switch (c.kind) {
    case "yn":
      return c.pass.on === "no" ? "No passes" : "Yes passes";
    case "ysn":
      return c.pass.on === "no" ? "No passes, Some is partly" : "Yes passes, Some is partly";
    case "scale":
      return `${c.pass.min} or more`;
    case "number":
      return isNum(c.pass.max) ? `${trimNum(c.pass.max)}${c.unit ? ` ${c.unit}` : ""} or fewer` : `${trimNum(c.pass.min)}${c.unit ? ` ${c.unit}` : ""} or more`;
    case "minutes":
      return c.pass.min ? `${fmtMins(c.pass.min)} or more` : "Any time at all";
    case "time":
      return `By ${clockText(c.pass.by)}`;
    case "choice":
      return c.pass.on.join(" or ");
    case "note":
      return "Written passes";
    default:
      return "";
  }
}

// "4:35 am" from "04:35".
export function clockText(hhmm) {
  if (!isTime(hhmm)) return "";
  const [h, m] = padTime(hhmm).split(":").map(Number);
  const ap = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

// --- Answered for you ----------------------------------------------------------

// The answer the day already holds for a check, or null. Your own answer
// always wins over this; it's only where an evening starts.
//
//   a check with a focus   the time log's minutes in that focus's categories
//                          (a Yes/No reads Yes when there were any)
//   "Up by" (auto wake)    when you got up: the time you tapped I'm up,
//                          else the end of the night's sleep the time log has
export function autoValue(check, { focusesById, entries, dayPlan, focusMinutes } = {}) {
  const c = normCheck(check);
  if (c.kind === "time" && c.auto === "wake") return wokeAt(dayPlan, entries);
  if (!c.focus_id || !focusMinutes) return null;
  const focus = focusesById?.get?.(c.focus_id);
  if (!focus) return null;
  const mins = focusMinutes(focus, entries);
  if (c.kind === "minutes") return mins > 0 ? mins : null;
  if (c.kind === "yn" || c.kind === "ysn") return mins > 0 ? (c.pass.on === "no" ? "no" : "yes") : null;
  return null;
}

// When you got up that morning, as "HH:MM" on this device's clock: the
// morning's I'm up, else the last Sleep entry that ended before noon.
export function wokeAt(dayPlan, entries) {
  if (dayPlan?.woke_at) return localHHMM(dayPlan.woke_at);
  let best = null;
  for (const e of entries ?? []) {
    if (e?.is_example || e?.is_nap || !e?.ended_at) continue;
    const tags = Array.isArray(e.tags) && e.tags.length ? e.tags : [e.category];
    if (!tags.some((t) => String(t ?? "").trim().toLowerCase() === "sleep")) continue;
    const end = new Date(e.ended_at);
    if (Number.isNaN(end.getTime()) || end.getHours() >= 12) continue;
    if (!best || end > best) best = end;
  }
  return best ? localHHMM(best) : null;
}

function localHHMM(at) {
  const d = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// --- Saved answers ------------------------------------------------------------

const NUMERIC = new Set(["scale", "number", "minutes"]);

// One check's answer as it's kept on a shot or a focus's arrow. The text and
// kind are kept so a reworded or removed check still reads as it was; `v` is
// the mark (2, 1, 0) for everything that has always read v.
export function answerEntry(check, value, line = "") {
  const c = normCheck(check);
  const v = markOf(c, value);
  const l = String(line ?? "").trim().slice(0, 500);
  return {
    aim: c.id,
    text: c.text,
    kind: c.kind,
    value: !answered(c, value) ? null : NUMERIC.has(c.kind) ? Number(value) : String(value),
    v,
    counts: scores(c),
    ...(c.unit ? { unit: c.unit } : {}),
    ...(l ? { line: l } : {}),
  };
}

// A weekly focus's arrow, counted in a bigger target's shot.
export function focusEntry(goal, level) {
  const s = shareOfLevel(level);
  return { focus_goal: goal.id, text: String(goal.title ?? ""), level, v: s == null ? null : s >= 1 ? 2 : s > 0 ? 1 : 0, s, counts: true };
}

// An old answer, from before checks had kinds ({ aim, text, v }), reads as
// the Yes/Some/No it was.
export function legacyValue(entry) {
  if (entry?.value !== undefined && entry?.value !== null) return entry.value;
  if (entry?.v === 2) return "yes";
  if (entry?.v === 1) return "some";
  if (entry?.v === 0) return "no";
  return null;
}

// --- Mood and stress ----------------------------------------------------------

// The 1–5 every older reader charts, from a 1–10: half, rounded up.
export function toFive(ten) {
  const n = Number(ten);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(5, Math.ceil(Math.min(10, Math.round(n)) / 2));
}

// A day saved before the 1–10 shows where its 1–5 sat on the new scale.
export function tenOf(plan, key) {
  const ten = plan?.[`${key}_10`];
  if (ten != null) return Number(ten);
  const five = plan?.[key];
  return five != null ? Number(five) * 2 : null;
}

// --- Bits ---------------------------------------------------------------------

function isNum(v) {
  return v !== null && v !== "" && v !== undefined && Number.isFinite(Number(v));
}

function clampInt(v, lo, hi, dflt) {
  if (!isNum(v)) return dflt;
  return Math.max(lo, Math.min(hi, Math.round(Number(v))));
}

function isTime(v) {
  return /^\d{1,2}:\d{2}$/.test(String(v ?? "").trim()) && toMin(v) < 1440 && Number(String(v).split(":")[1]) < 60;
}

function padTime(v) {
  const [h, m] = String(v).trim().split(":");
  return `${String(Number(h)).padStart(2, "0")}:${m}`;
}

function toMin(hhmm) {
  const [h, m] = String(hhmm).trim().split(":").map(Number);
  return h * 60 + m;
}

function trimNum(v) {
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
