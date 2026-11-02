import { addDays } from "./planDates.js";
import { gearFor, shortGoal } from "./ascent.js";
import { workoutName, fmtMins } from "./watch.js";
import { normCheck, answered, markOf, scores, autoValue, answerEntry, focusEntry, checksLevel, shareOfLevel, legacyValue, valueText } from "./checks.js";

// The Mark: every goal is a target (supabase/migrations/0075_the_mark.sql).
//
// Sin, chata in Hebrew and hamartia in Greek, means to miss the mark. Each
// lifetime goal, the quest and each lesson is a target, and each evening
// takes one shot at each. He never aims: he answers what a bullseye takes,
// its checks (checks.js: Yes or No, 1 to 10, minutes, a time and the rest),
// and the share of them he passed puts the arrow in its ring.
// A miss lands in the section of what got in the way, so over the weeks the
// misses gather where the reason is. A miss is a mark, not a mark against
// you: nothing here turns red.
//
// Everything in this file is pure: the page loads the rows (fetchRange in
// api.js) and buildRange turns them into targets.

// From a perfect day to a miss. Radii are in target units: the face is 80
// from the center, and the miss band runs out to 96.
export const LEVELS = [
  { name: "Bullseye", pts: 10, r0: 1, r1: 12 },
  { name: "Inner", pts: 8, r0: 20, r1: 28 },
  { name: "Middle", pts: 6, r0: 36, r1: 44 },
  { name: "Outer", pts: 4, r0: 52, r1: 60 },
  { name: "Edge", pts: 2, r0: 68, r1: 76 },
  { name: "Missed", pts: 0, r0: 85, r1: 93 },
];
export const FACE = 80;
export const MISS_BAND = 96;
// The ring lines between landings, innermost (the bullseye's edge) first.
export const RINGS = [16, 32, 48, 64, 80];

// An answer's worth: No 0, Some 1, Yes 2.
export const ANSWERS = ["No", "Some", "Yes"];

// Where the answers put the arrow: the share of a bullseye you did. All Yes
// is a bullseye, all No is a miss, and anything done at all stays on the
// face. Null until every one is answered.
export function levelFrom(values) {
  const list = values ?? [];
  if (!list.length || list.some((v) => v !== 0 && v !== 1 && v !== 2)) return null;
  const share = list.reduce((a, v) => a + v, 0) / (2 * list.length);
  if (share >= 1) return 0;
  if (share >= 0.75) return 1;
  if (share >= 0.5) return 2;
  if (share >= 0.25) return 3;
  return share > 0 ? 4 : 5;
}

// Which marks a target shows.
export const RANGES = [
  ["7", "Week"],
  ["30", "30 days"],
  ["all", "All"],
];
export const DEFAULT_RANGE = "30";

export function inRange(shots, today, range) {
  if (range === "all") return shots;
  const from = addDays(today, -(Number(range) - 1));
  return shots.filter((s) => s.date >= from && s.date <= today);
}

export function average(shots) {
  if (!shots.length) return 0;
  return shots.reduce((a, s) => a + LEVELS[s.level].pts, 0) / shots.length;
}

// Misses in each of the four sections. Bullseyes have no section.
export function missCounts(shots) {
  const c = [0, 0, 0, 0];
  for (const s of shots) if (s.level > 0 && s.reason != null && s.reason >= 0 && s.reason < 4) c[s.reason] += 1;
  return c;
}

// The fullest section, or -1 when there are no misses yet. A tie goes to
// the first, clockwise from the top right.
export function fullest(counts) {
  let best = -1;
  let n = 0;
  counts.forEach((v, k) => {
    if (v > n) {
      n = v;
      best = k;
    }
  });
  return best;
}

// --- Where a mark sits -----------------------------------------------------
//
// Somewhere in its ring and section, never on a line, and always in the same
// spot: the place comes from the shot's own id, so the target doesn't
// reshuffle every time it's drawn.

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sections run clockwise from twelve o'clock: top right, bottom right,
// bottom left, top left. A bullseye, or a miss with no section, can sit at
// any angle.
export function placement(key, level, reason) {
  const rnd = seeded(hash(String(key)));
  const L = LEVELS[level] ?? LEVELS[5];
  const r = L.r0 + rnd() * (L.r1 - L.r0);
  const sectioned = level > 0 && reason != null && reason >= 0 && reason < 4;
  const deg = sectioned ? -90 + 90 * reason + 12 + rnd() * 66 : rnd() * 360;
  const a = (deg * Math.PI) / 180;
  return { x: round1(r * Math.cos(a)), y: round1(r * Math.sin(a)) };
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

// --- The bow ------------------------------------------------------------------

// It upgrades as bullseyes add up across every target. Each bow after the
// first comes with a verse, shown the moment it's earned.
export const TIERS = [
  { name: "A bow of wood", short: "Bow of wood", at: 0, verse: null },
  {
    name: "A longbow",
    short: "Longbow",
    at: 30,
    verse: {
      text: "But his bow abode in strength, and the arms of his hands were made strong by the hands of the mighty God of Jacob.",
      cite: "Genesis 49:24",
    },
  },
  {
    name: "A recurve",
    short: "Recurve",
    at: 90,
    verse: {
      text: "In the shadow of his hand hath he hid me, and made me a polished shaft; in his quiver hath he hid me.",
      cite: "Isaiah 49:2",
    },
  },
  {
    name: "A bow of steel",
    short: "Bow of steel",
    at: 180,
    verse: { text: "He teacheth my hands to war, so that a bow of steel is broken by mine arms.", cite: "Psalm 18:34" },
  },
];

export function tierOf(bullseyes) {
  let k = 0;
  TIERS.forEach((t, i) => {
    if (bullseyes >= t.at) k = i;
  });
  return k;
}

// "27 bullseyes · 3 more to a longbow"
export function bowLine(bullseyes) {
  const next = TIERS[tierOf(bullseyes) + 1];
  const n = `${bullseyes} ${bullseyes === 1 ? "bullseye" : "bullseyes"}`;
  return next ? `${n} · ${next.at - bullseyes} more to ${next.name.toLowerCase()}` : `${n} · every bow earned`;
}

// The bow earned by going from `before` bullseyes to `after`, or -1 when the
// bow is the same. Crossing two at once (a long day reopened) earns the top one.
export function bowEarned(before, after) {
  const k = tierOf(after);
  return k > tierOf(before) ? k : -1;
}

// How far along to the next bow, 0..1.
export function bowProgress(bullseyes) {
  const k = tierOf(bullseyes);
  const next = TIERS[k + 1];
  if (!next) return 1;
  return (bullseyes - TIERS[k].at) / (next.at - TIERS[k].at);
}

// --- The targets --------------------------------------------------------------

// The four sections a new target starts with, until you name your own.
export const DEFAULT_REASONS = ["No time", "Distracted", "Tired", "Didn't think of it"];

// Four names, always: blanks fall back to the defaults.
export function fourReasons(reasons) {
  return DEFAULT_REASONS.map((d, i) => {
    const r = String(reasons?.[i] ?? "").trim();
    return r || d;
  });
}

export function iconFor(kind, title) {
  if (kind === "quest") return "tent";
  if (kind === "lesson") return /caffeine|coffee|soda|energy drink|tea\b/i.test(String(title ?? "")) ? "cup" : "sign";
  return gearFor(title);
}

const KIND_LABEL = { goal: "Lifetime goal", quest: "Quest", lesson: "Lesson from God" };

// A tab's short name: "In tune with God", "Plugin", "Caffeine".
export function shortTarget(kind, title) {
  const t = String(title ?? "").trim();
  if (kind === "goal") return shortGoal(t).replace(/ with God$/i, "");
  const words = t.replace(/^(build|stop|start|more|less|be)\s+(the\s+best\s+|drinking\s+|a\s+|an\s+|the\s+)?/i, "").split(/\s+/);
  const pick = kind === "quest" ? words.slice(-1)[0] ?? t : words[0] ?? t;
  const s = pick || t;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function byPosition(a, b) {
  return (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
}

// Every target, in the order of the page: the lifetime goals (as the Ascent
// view orders them), then each quest you're on, then each lesson you're
// learning. One with no row yet still shows, empty, with the default
// sections; its row is made the first time it's set up or shot at.
export function buildRange(ascentView, marks, today) {
  const rows = marks?.targets ?? [];
  const aimsByTarget = new Map();
  for (const a of marks?.aims ?? []) {
    if (!aimsByTarget.has(a.target_id)) aimsByTarget.set(a.target_id, []);
    aimsByTarget.get(a.target_id).push(a);
  }
  // Only a loosed arrow is on the target. Tonight's, still in hand until the
  // day is banked, rides along as `tonight` for the evening to answer.
  const shotsByTarget = new Map();
  const tonightByTarget = new Map();
  for (const s of marks?.shots ?? []) {
    if (s.date > today) continue;
    if (s.date === today) tonightByTarget.set(s.target_id, s);
    if (!isLoosed(s)) continue;
    if (!shotsByTarget.has(s.target_id)) shotsByTarget.set(s.target_id, []);
    shotsByTarget.get(s.target_id).push(s);
  }

  const make = (kind, ref, title, extra) => {
    const row = rows.find((r) => (kind === "goal" ? r.goal_id : kind === "quest" ? r.quest_id : r.lesson_id) === ref.id) ?? null;
    const aims = row ? [...(aimsByTarget.get(row.id) ?? [])].sort(byPosition) : [];
    const shots = row
      ? [...(shotsByTarget.get(row.id) ?? [])]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((s) => ({ ...s, ...placement(s.id, s.level, s.level > 0 ? s.reason : null) }))
      : [];
    return {
      key: ref.id,
      kind,
      ref,
      title,
      short: shortTarget(kind, title),
      kindLabel: KIND_LABEL[kind],
      icon: iconFor(kind, title),
      targetId: row?.id ?? null,
      reasons: fourReasons(row?.reasons),
      named: Boolean(row?.reasons?.length),
      aims: aims.filter((a) => !a.retired_on),
      retired: aims.filter((a) => a.retired_on),
      shots,
      today: shots.find((s) => s.date === today) ?? null,
      tonight: row ? tonightByTarget.get(row.id) ?? null : null,
      ...extra,
    };
  };

  const goals = (ascentView?.goals ?? []).map((g) => make("goal", g, g.title, { goal: g }));
  const quests = (ascentView?.quests ?? []).map((q) => make("quest", q, q.title, { quest: q }));
  const lessons = (ascentView?.lessons ?? []).map((l) => make("lesson", l, l.title, { lesson: l }));
  const all = [...goals, ...quests, ...lessons];
  const bullseyes = all.reduce((a, t) => a + t.shots.filter((s) => s.level === 0).length, 0);
  return { goals, quests, lessons, all, bullseyes };
}

// The answers on a shot, in the order they were asked, with what each was
// called that day. A check's answer keeps its kind and value (0103); an
// older shot's answers were all Yes, Some or No and read that way. A weekly
// focus that counted toward the target (`focus_goal`) carries the ring its
// own arrow landed in.
export function answersOf(shot) {
  return (Array.isArray(shot?.answers) ? shot.answers : []).map((a) => {
    const focusGoal = a?.focus_goal ?? null;
    const kind = focusGoal ? "focus" : a?.kind ?? "ysn";
    const level = Number.isInteger(a?.level) && a.level >= 0 && a.level <= 5 ? a.level : null;
    return {
      aim: a?.aim ?? null,
      focus_goal: focusGoal,
      text: String(a?.text ?? ""),
      kind,
      value: focusGoal ? null : legacyValue(a),
      unit: a?.unit ?? null,
      v: a?.v === 0 || a?.v === 1 || a?.v === 2 ? a.v : null,
      level,
      line: String(a?.line ?? ""),
      counts: a?.counts !== false,
    };
  });
}

// What one saved answer reads as: "Yes", "7/10", "4:32 am", or the ring a
// focus's arrow landed in.
export function answerText(entry) {
  if (entry?.kind === "focus") return entry.level != null ? LEVELS[entry.level].name : "";
  return valueText({ kind: entry?.kind, unit: entry?.unit }, entry?.value);
}

// An arrow is on the target once the day it's for has been banked.
export function isLoosed(shot) {
  return shot?.loosed_at != null;
}

// --- Tonight ------------------------------------------------------------------
//
// In the evening reflection each target asks what a bullseye takes. The time
// log answers the ones tied to a focus it saw today; the rest are his. His
// line, if he writes one, is read for what got in the way.

// The minutes the time log has for a focus on this day: any entry with one of
// its categories (tags first, the entry's category when it has none), the
// way the goals page counts a step.
export function focusMinutes(focus, entries) {
  const want = new Set((focus?.categories ?? []).map(tagKey).filter(Boolean));
  if (!want.size) return 0;
  let minutes = 0;
  let hit = false;
  for (const e of entries ?? []) {
    if (e?.is_example) continue;
    const tags = Array.isArray(e?.tags) && e.tags.length ? e.tags : [e?.category];
    if (!tags.some((t) => want.has(tagKey(t)))) continue;
    hit = true;
    minutes += Number(e.duration_minutes) || 0;
  }
  // A timer still running counts as logged, with whatever it has so far.
  return hit ? Math.max(1, Math.round(minutes)) : 0;
}

function tagKey(t) {
  return String(t ?? "").trim().toLowerCase();
}

// What the watch recorded toward a focus today, in a few words ("Strength
// 42m"), shown beside the time log's minutes so the evening's Yes comes
// with what actually happened. Only finished entries whose times are the
// watch's: a workout it recorded, a timer run from the wrist, or one you
// logged by hand that the watch has since set (watch_fixed_at; the
// entries come from day_archive, whole rows). "" when none.
export function watchSaw(focus, entries) {
  const want = new Set((focus?.categories ?? []).map(tagKey).filter(Boolean));
  if (!want.size) return "";
  const bits = [];
  for (const e of entries ?? []) {
    if (e?.is_example || !(e?.source === "watch" || e?.watch_fixed_at) || !e.ended_at) continue;
    const tags = Array.isArray(e?.tags) && e.tags.length ? e.tags : [e?.category];
    if (!tags.some((t) => want.has(tagKey(t)))) continue;
    bits.push(`${workoutName(e.description || e.category)} ${fmtMins(e.duration_minutes)}`);
  }
  return bits.join(", ");
}

// Tonight's answers for a target, one { value, line } per check in the
// order they're asked: what's already saved, else what the day holds (the
// time log's minutes for a check with a focus, when you got up for "Up by"),
// else blank. A saved answer that no longer fits its check (a Some on what
// is now a Yes/No) starts blank.
export function startingAnswers(target, { focusesById, entries, dayPlan } = {}) {
  const saved = new Map(answersOf(target?.tonight).filter((a) => a.aim).map((a) => [a.aim, a]));
  return (target?.aims ?? []).map((a) => {
    const s = saved.get(a.id);
    if (s && fits(a, s.value)) return { value: s.value, line: s.line };
    return { value: autoValue(a, { focusesById, entries, dayPlan, focusMinutes }), line: s?.line ?? "" };
  });
}

function fits(check, value) {
  if (!answered(check, value)) return false;
  return !scores(check) || markOf(check, value) != null;
}

// What a line says got in the way, when the reader can't be reached: the
// section whose name, or a few words like it, the line uses most. -1 when
// nothing in it points anywhere.
const CUES = {
  tired: ["tired", "exhausted", "sleepy", "worn out", "no energy", "drained"],
  "late night": ["late", "stayed up", "bed late", "midnight"],
  phone: ["phone", "scroll", "youtube", "instagram", "social media", "screen"],
  overbooked: ["busy", "overbooked", "too much", "packed", "behind"],
  "no time": ["no time", "busy", "ran out of time", "behind"],
  "avoided the hard part": ["avoid", "put off", "procrastinat", "hard part"],
  "unclear next step": ["unclear", "didn't know", "unsure", "stuck", "not focused", "wasn't focused"],
  rushed: ["rushed", "hurried", "quick", "rush"],
  "second-guessed": ["second-guess", "second guess", "doubted", "hesitat"],
  "didn't make time": ["didn't make time", "no time", "wish i had taken", "should have taken"],
  distracted: ["distract", "not focused", "wasn't focused", "wander", "phone"],
  "no plan": ["no plan", "didn't plan", "unplanned"],
  "other priorities": ["other priorit", "other things", "instead"],
  "didn't look": ["didn't look", "didn't notice", "seek", "look for", "should have seeked", "should have sought"],
  impatient: ["impatient", "short with", "snapped", "frustrat", "annoyed"],
  busy: ["busy", "no time", "full day", "busier"],
  "held back": ["held back", "shy", "afraid", "nervous", "intentional"],
  "low energy": ["low energy", "tired", "drained", "slow"],
  "other work": ["other work", "other project", "meetings", "emails"],
  "went along": ["went along", "didn't speak up", "crowd", "peer"],
  "easier path": ["easier", "easy way", "shortcut", "cut corners"],
  pride: ["pride", "proud", "ego", "defensive"],
  "didn't think": ["didn't think", "without thinking", "autopilot", "forgot"],
  "didn't think of it": ["didn't think", "forgot", "slipped my mind"],
  social: ["friends", "offered", "party", "social", "with people"],
  habit: ["habit", "automatic", "usual", "routine"],
  craving: ["crav", "urge", "really wanted"],
};

export function readLine(reasons, line) {
  const low = String(line ?? "").toLowerCase();
  if (!low.trim()) return -1;
  let best = -1;
  let most = 0;
  (reasons ?? []).forEach((r, k) => {
    const name = tagKey(r);
    const cues = [name, ...(CUES[name] ?? [])].filter(Boolean);
    const n = cues.filter((q) => low.includes(q)).length;
    if (n > most) {
      most = n;
      best = k;
    }
  });
  return best;
}

// With nothing to read, the likeliest reason is where the last 30 days of
// misses gather; with no misses yet, the first section.
export function guessReason(target, today) {
  const k = fullest(missCounts(inRange(target?.shots ?? [], today, "30")));
  return k >= 0 ? k : 0;
}

// The ring tonight's answers put a target's arrow in, or null until every
// check that scores is answered. `linked` is the week's focuses that count
// toward this target and landed an arrow tonight ({ goal, level }): each
// counts as one more check, and none ever holds the arrow back.
export function tonightLevel(target, answers, linked = []) {
  const aims = target?.aims ?? [];
  const values = aims.map((_, i) => answers?.[i]?.value ?? null);
  return checksLevel(aims, values, (linked ?? []).map((l) => shareOfLevel(l.level)));
}

// The shot tonight's answers make, ready to save: null until every check
// that scores is answered. A bullseye has no section.
export function shotFrom(target, answers, { line = "", reason = null, how = null, linked = [] } = {}) {
  const level = tonightLevel(target, answers, linked);
  if (level == null) return null;
  const note = String(line ?? "").trim();
  return {
    answers: [
      ...(target?.aims ?? []).map((a, i) => answerEntry(a, answers?.[i]?.value ?? null, answers?.[i]?.line)),
      ...(linked ?? []).map((l) => focusEntry(l.goal, l.level)),
    ],
    level,
    reason: level === 0 ? null : reason,
    reason_how: level === 0 ? null : how,
    note: note ? note.slice(0, 2000) : null,
  };
}

// The checks on a target, cleaned, as the sheet edits them and the evening
// asks them.
export function checksOf(target) {
  return (target?.aims ?? []).map((a) => ({ ...a, ...normCheck(a) }));
}

// --- Placing an arrow yourself ------------------------------------------------

// The ring a spot on the face is in, from where you tapped (target units,
// the center at 0,0). Past the face is a miss.
export function levelAtSpot(x, y) {
  const r = Math.hypot(Number(x) || 0, Number(y) || 0);
  for (let k = 0; k < RINGS.length; k++) if (r <= RINGS[k]) return k;
  return 5;
}

// A tap, kept on the target: anything past the miss band comes back inside
// it, so an arrow is always somewhere you can see it.
export function clampSpot(x, y) {
  const nx = Number(x) || 0;
  const ny = Number(y) || 0;
  const r = Math.hypot(nx, ny);
  const max = MISS_BAND - 4;
  if (r <= max) return { x: round1(nx), y: round1(ny) };
  return { x: round1((nx / r) * max), y: round1((ny / r) * max) };
}

// The middle of a ring, straight up: where the ring buttons (for a keyboard
// or a screen reader) put an arrow.
export function ringSpot(level) {
  if (level === 0) return { x: 0, y: 0 };
  const inner = RINGS[level - 1] ?? FACE;
  const outer = RINGS[level] ?? MISS_BAND;
  return { x: 0, y: round1(-(inner + outer) / 2) };
}

// --- The short evening ------------------------------------------------------

// One tap for a whole target: Yes (2), Some (1) or No (0) for the day as a
// whole, the way the short evening has always asked, landing a bullseye,
// the middle or a miss. Checks the day already answered (the time log,
// when you got up) are kept with it for the record, but the tap is what
// sets the ring: the short evening never makes up an answer for a check.
export const WHOLE = "The day as a whole";

export function quickShot(target, v, answers = [], { reason = null, how = null } = {}) {
  if (v !== 0 && v !== 1 && v !== 2) return null;
  const level = levelFrom([v]);
  const known = (target?.aims ?? [])
    .map((a, i) => ({ a, value: answers?.[i]?.value ?? null, line: answers?.[i]?.line }))
    .filter((x) => answered(x.a, x.value))
    .map((x) => ({ ...answerEntry(x.a, x.value, x.line), counts: false }));
  return {
    answers: [{ aim: null, text: WHOLE, kind: "ysn", value: ANSWER_VALUES[v], v, counts: true, whole: true }, ...known],
    level,
    reason: level === 0 ? null : reason,
    reason_how: level === 0 ? null : how,
    note: null,
  };
}

const ANSWER_VALUES = ["no", "some", "yes"];

// The one tap a saved shot was, when it was a short evening's: 2, 1, 0, or
// null when it was answered check by check.
export function quickOf(shot) {
  const w = (Array.isArray(shot?.answers) ? shot.answers : []).find((a) => a?.whole);
  return w && (w.v === 0 || w.v === 1 || w.v === 2) ? w.v : null;
}

// --- Tonight's checks, as the evening shows them ----------------------------

// Where an answer the day filled in came from, said under the check: the
// time log's minutes for a check with a focus (and what the watch saw, so
// the answer comes with what actually happened), or when you got up for an
// "Up by". Null for a check only you answer.
export function checkHint(check, { focusesById, entries, dayPlan } = {}) {
  const c = normCheck(check);
  if (c.kind === "time" && c.auto === "wake") return autoValue(c, { dayPlan, entries }) ? "From when you got up" : "No wake time in your log";
  const focus = c.focus_id ? focusesById?.get?.(c.focus_id) : null;
  if (!focus) return null;
  const mins = focusMinutes(focus, entries);
  if (!mins) return "Not in your time log today";
  const saw = watchSaw(focus, entries);
  return `Time log · ${fmtMins(mins)}${saw ? ` · watch: ${saw}` : ""}`;
}

// Tonight's answers with what a draft on this device was in the middle of,
// laid over where the evening starts. `mine` is { [check id]: { value,
// line } }. A draft is only ever a convenience, so anything in it that
// doesn't fit its check as it is now (a Some on what's become a Yes/No, a
// word where a number goes, a choice that's been taken out) is passed over,
// and a broken or old-shaped draft changes nothing.
export function restoreAnswers(target, starting, mine) {
  const ok = mine && typeof mine === "object" && !Array.isArray(mine);
  return (target?.aims ?? []).map((a, i) => {
    const base = starting?.[i] ?? { value: null, line: "" };
    const m = ok && a?.id ? mine[a.id] : null;
    if (!m || typeof m !== "object" || Array.isArray(m)) return base;
    return {
      value: fitsKind(a, m.value) ? m.value : base.value,
      line: typeof m.line === "string" ? m.line.slice(0, 500) : base.line,
    };
  });
}

// Where one target's evening starts: { answers, line, quick, pick, readFor,
// reading }. Tonight's saved shot wins (its answers through
// startingAnswers, its line, its tap if it was a short evening's, and the
// section it was filed under); with nothing saved, a draft this device kept
// (`mine`, { answers: { [check id]: { value, line } }, line }) is laid over
// what the day knows. A draft of any other shape, an old one from before
// checks had kinds included, is simply not used.
export function tonightDraft(target, { focusesById, entries, dayPlan, mine } = {}) {
  const shot = target?.tonight ?? null;
  let answers = startingAnswers(target, { focusesById, entries, dayPlan });
  let line = String(shot?.note ?? "");
  if (!shot && mine && typeof mine === "object" && !Array.isArray(mine)) {
    answers = restoreAnswers(target, answers, mine.answers);
    if (typeof mine.line === "string") line = mine.line.slice(0, 2000);
  }
  const filed = Boolean(shot && shot.level > 0 && shot.reason != null);
  return {
    answers,
    line,
    quick: quickOf(shot),
    pick: filed ? { k: shot.reason, how: shot.reason_how ?? "guess" } : null,
    // A line already read (or read and found to say nothing) isn't sent to
    // the reader again.
    readFor: filed && shot.reason_how !== "yours" && line.trim() ? line.trim() : null,
    reading: false,
  };
}

// Whether a value is the kind of answer a check takes at all.
function fitsKind(check, value) {
  if (value == null || (typeof value !== "string" && typeof value !== "number")) return false;
  const c = normCheck(check);
  switch (c.kind) {
    case "yn":
      return value === "yes" || value === "no";
    case "ysn":
      return value === "yes" || value === "some" || value === "no";
    case "scale":
      return Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 10;
    case "number":
    case "minutes":
      return answered(c, value) && Number(value) >= 0;
    case "time":
      return /^\d{1,2}:\d{2}$/.test(String(value));
    case "choice":
      return c.options.includes(String(value));
    default:
      return typeof value === "string";
  }
}

// What the line's reader is told about tonight. The reader (the `mark`
// function) takes up to eight { text, v } and reads each v as Yes, Some or
// No, so a check whose answer isn't a plain Yes or No carries it in its
// text ("Did I do my best to listen (6/10)", "Drank caffeine (No)") with its
// mark as v. A reflection-only check, or one not answered, isn't sent: the
// reader would drop it anyway. A weekly focus that counts toward the target
// goes as one more, with the ring its arrow landed in.
export function readAnswers(target, answers, linked = []) {
  const out = [];
  (target?.aims ?? []).forEach((a, i) => {
    const value = answers?.[i]?.value ?? null;
    const v = markOf(a, value);
    if (v == null) return;
    const c = normCheck(a);
    const plain = (c.kind === "yn" || c.kind === "ysn") && c.pass.on === "yes";
    out.push({ text: withSaid(c.text, plain ? "" : valueText(c, value)), v });
  });
  for (const l of linked ?? []) {
    const e = focusEntry(l.goal, l.level);
    if (e.v == null) continue;
    out.push({ text: withSaid(`This week's focus, ${e.text}`, LEVELS[l.level]?.name.toLowerCase() ?? ""), v: e.v });
  }
  return out.slice(0, 8);
}

// "Text (what was said)" inside the reader's 120 characters, cutting the
// text rather than the answer.
function withSaid(text, said) {
  const tail = said ? ` (${said})` : "";
  const room = 120 - tail.length;
  const t = String(text ?? "");
  return (t.length > room ? `${t.slice(0, Math.max(0, room - 1))}…` : t) + tail;
}

// Whether two shots land the same: ring, section, line and every answer.
// One read back from the database has its answers' keys in another order
// (jsonb keeps its own), so answers are compared key by key, not as text.
// The evening saves only when this says something changed, which is what
// keeps a re-save from ever looping.
export function sameShot(a, b) {
  if (!a || !b) return false;
  if (a.level !== b.level) return false;
  if ((a.reason ?? null) !== (b.reason ?? null) || (a.reason_how ?? null) !== (b.reason_how ?? null)) return false;
  if ((a.note ?? null) !== (b.note ?? null)) return false;
  return canon(a.answers ?? []) === canon(b.answers ?? []);
}

function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") {
    const keys = Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

// Where tonight's answers put the arrow, in a few words under the checks.
const LANDS = ["All passed: a bullseye.", "Lands in the inner ring.", "Lands in the middle ring.", "Lands in the outer ring.", "Lands on the edge.", "A miss this time."];

export function landsText(level) {
  return LANDS[level] ?? "";
}

// Tonight's ring for a target as it stands: the short evening's one tap
// when there's been one (it sets the ring until the checks are answered in
// the full evening), else the ring the checks and any weekly focus that
// counts toward it make. `label` says where a ring with no tap came from,
// for the short evening's row: "Inner, from your checks", or "Inner, from
// Win by win" when a focus is all it has. Nothing is made up: no tap and
// not every check answered is no ring.
export function tonightRing(target, { answers, quick } = {}, linked = []) {
  if (quick === 0 || quick === 1 || quick === 2) return { level: levelFrom([quick]), tap: quick, label: null };
  const level = tonightLevel(target, answers, linked);
  if (level == null) return { level: null, tap: null, label: null };
  const name = LEVELS[level].name;
  if ((target?.aims ?? []).some((a) => scores(a))) return { level, tap: null, label: `${name}, from your checks` };
  const titles = (linked ?? []).map((l) => String(l.goal?.title ?? "").trim()).filter(Boolean);
  return { level, tap: null, label: titles.length ? `${name}, from ${titles.join(" and ")}` : name };
}

// The shot one target's evening makes, ready to save, or null while it has
// no ring. `draft` is the evening's { answers, line, quick, pick }. A miss
// is filed where you put it or where your line was read to point, else
// where recent misses gather (guessReason). A short evening's tap keeps a
// line written in the full one, so switching to Short never loses it.
export function tonightShot(target, draft, { linked = [], today } = {}) {
  const d = draft ?? {};
  const level = tonightRing(target, d, linked).level;
  if (level == null) return null;
  const pick = level > 0 ? d.pick ?? { k: guessReason(target, today), how: "guess" } : null;
  const opts = { reason: pick?.k ?? null, how: pick?.how ?? null };
  if (d.quick != null) {
    const s = quickShot(target, d.quick, d.answers, opts);
    const note = String(d.line ?? "").trim();
    return s && { ...s, note: note ? note.slice(0, 2000) : null };
  }
  return shotFrom(target, d.answers, { ...opts, line: d.line, linked });
}
