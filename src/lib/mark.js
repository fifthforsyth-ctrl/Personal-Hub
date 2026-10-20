import { addDays } from "./planDates.js";
import { gearFor, shortGoal } from "./ascent.js";

// The Mark: every goal is a target (supabase/migrations/0075_the_mark.sql).
//
// Sin, chata in Hebrew and hamartia in Greek, means to miss the mark. Each
// lifetime goal, the quest and each lesson is a target, and each evening
// takes one shot at each. He never aims: he answers what a bullseye takes,
// Yes, Some or No, and the share of it he did puts the arrow in its ring.
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

// It upgrades as bullseyes add up across every target.
export const TIERS = [
  { name: "A bow of wood", short: "Bow of wood", at: 0 },
  { name: "A longbow", short: "Longbow", at: 30 },
  { name: "A recurve", short: "Recurve", at: 90 },
  { name: "A bow of steel", short: "Bow of steel", at: 180 },
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
  const shotsByTarget = new Map();
  for (const s of marks?.shots ?? []) {
    if (s.date > today) continue;
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
// called that day.
export function answersOf(shot) {
  return (Array.isArray(shot?.answers) ? shot.answers : []).map((a) => ({
    aim: a?.aim ?? null,
    text: String(a?.text ?? ""),
    v: a?.v === 0 || a?.v === 1 || a?.v === 2 ? a.v : null,
  }));
}
