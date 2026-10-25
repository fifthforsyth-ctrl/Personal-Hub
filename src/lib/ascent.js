import { addDays, parseDateStr, startOfWeek, fmtShortDate } from "./planDates.js";

// Ascent: the goals page, top to bottom (supabase/migrations/0074_ascent.sql).
//
//   the mission       the summit
//   lifetime goals    the root goals of the tree: the range below the summit
//   focuses           what feeds each lifetime goal. A footprint is a day the
//                     time log has one of a focus's categories
//   quests            what God is calling him to now, climbed camp by camp
//   lessons           changes to his character, kept or slipped each day. A
//                     lesson can have a mountain of its own (0079): a quest
//                     row with its lesson_id, climbed the same way and shown
//                     with the lesson, not as a quest
//
// The mountain is only decoration. Nothing here is scored in minutes and
// nothing turns red: a quiet goal is at the trailhead, not failing.
//
// Everything in this file is pure: the page loads the rows (fetchAscent in
// api.js) and buildAscent turns them into what it shows.

// The footprints cover the last 30 days, ending today.
export const WINDOW_DAYS = 30;

// A lifetime goal's zone, from the share of the last 30 days with a step on
// any of its focuses.
export function zoneOf(pct) {
  return pct >= 70 ? "ridge" : pct >= 35 ? "switch" : pct > 0 ? "foot" : "trail";
}

// Categories are matched the way they read: "Draw" and "draw " are the same.
export function tagKey(tag) {
  return String(tag ?? "").trim().toLowerCase();
}

// The days in the window, oldest first, ending today.
export function windowDays(today, n = WINDOW_DAYS) {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

// ascent_steps rows ({ tag, days, last_day }) by category.
export function stepIndex(rows) {
  const byTag = new Map();
  for (const r of rows ?? []) {
    const key = tagKey(r?.tag);
    if (!key) continue;
    const had = byTag.get(key);
    const days = new Set([...(had?.days ?? []), ...(r.days ?? [])]);
    const last = [had?.last, r.last_day].filter(Boolean).sort().pop() ?? null;
    byTag.set(key, { days, last });
  }
  return byTag;
}

// The days a focus was walked (any of its categories), and the last day it
// ever was.
export function focusSteps(focus, index) {
  const days = new Set();
  let last = null;
  for (const c of focus?.categories ?? []) {
    const hit = index.get(tagKey(c));
    if (!hit) continue;
    for (const d of hit.days) days.add(d);
    if (hit.last && (!last || hit.last > last)) last = hit.last;
  }
  return { days, last };
}

// One footprint per day of the window: true where there's a step.
export function footprints(days, window) {
  return window.map((d) => days.has(d));
}

// "Highly in tune with God" reads "In tune with God" on a small tag.
export function shortGoal(title) {
  const t = String(title ?? "").trim().replace(/^(be\s+)?highly\s+/i, "");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Goal";
}

// The climber's gear that stands for each lifetime goal, by what it's called.
export function gearFor(title) {
  const t = String(title ?? "").toLowerCase();
  if (/selfless|charit|serv|love|kind/.test(t)) return "rope";
  if (/disciplin|control|master/.test(t)) return "boot";
  if (/god|tune|spirit|faith|christ/.test(t)) return "compass";
  if (/educat|learn|wis|know|stud/.test(t)) return "map";
  if (/skill|craft|creat|work|art/.test(t)) return "axe";
  return "tent";
}

// Goals made together (the tree's five were made in one go) keep the order
// Aaron names them in: skilled, in tune with God, educated, selfless,
// disciplined.
const GEAR_ORDER = ["axe", "compass", "map", "rope", "boot"];
function gearRank(title) {
  const i = GEAR_ORDER.indexOf(gearFor(title));
  return i < 0 ? GEAR_ORDER.length : i;
}

// "Drawing and Painting"
export function andList(names) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// The line under a lifetime goal: what feeds it and how often lately.
export function fedLine({ focuses, count, last }) {
  if (!focuses.length) return "No focus yet";
  const names = andList(focuses.map((f) => f.name));
  if (count > 0) return `${names} · ${count} of ${WINDOW_DAYS} days`;
  return last ? `${names} · none logged since ${fmtShortDate(last)}` : `${names} · none logged yet`;
}

// Where a quest's climber is. Camps are reached in order, so the climb is
// the run of reached camps from the bottom; `next` is the first one still
// ahead (null when only the summit is left).
export function questState(quest, camps) {
  const list = [...(camps ?? [])].sort(byPosition);
  let reached = 0;
  while (reached < list.length && list[reached].reached_on) reached++;
  const done = quest?.status === "done";
  return {
    camps: list,
    reached,
    next: done || reached >= list.length ? null : list[reached],
    atSummit: !done && reached >= list.length,
    done,
  };
}

// The quest's trail on its little mountain: base, one turn per camp,
// switching back and forth, then the summit. Taller when there are many
// camps, so their labels never sit on top of each other.
export function questLayout(campCount) {
  const n = Math.max(0, campCount | 0);
  const W = 300;
  const H = Math.max(126, 24 + 17 * (n + 1));
  const ground = H - 5;
  const baseY = ground - 2;
  const tipY = 14;
  const summitY = 17;
  const span = baseY - summitY;
  // The approach to the summit is the longest leg, as on a real mountain.
  const camps = Array.from({ length: n }, (_, i) => [i % 2 === 0 ? 196 : 104, round1(baseY - (span * 0.82 * (i + 1)) / (n + 1))]);
  const turns = [[96, baseY], ...camps, [150, summitY]];
  // The mountain behind the trail, drawn for a 126-high box and stretched.
  const k = (ground - tipY) / (121 - tipY);
  const y = (v) => round1(ground - (121 - v) * k);
  const ridge = [[14, 121], [44, 104], [58, 107], [100, 66], [114, 70], [150, 14], [184, 52], [198, 48], [244, 94], [264, 104], [288, 121]].map(([x, v]) => [x, y(v)]);
  const spine = [[150, 14], [158, 42], [163, 74], [174, 121]].map(([x, v]) => [x, y(v)]);
  return { W, H, ground, turns, ridge, spine };
}

// How far up the trail (0..1, by turn) the climber stands: a little past the
// last camp reached, or at the top once the quest is done. `turnAt` gives
// each turn's fraction of the trail's length.
export function climberAt(state, turnAt) {
  if (state.done) return 1;
  const i = state.reached; // the turn just behind: 0 is the base
  const from = turnAt[i] ?? 0;
  const to = turnAt[i + 1] ?? 1;
  return from + (to - from) * 0.28;
}

// This week, Sunday to Saturday, as one lesson's strip.
const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export function lessonWeek(lesson, answers, today) {
  const start = startOfWeek(today);
  return LETTERS.map((letter, i) => {
    const date = addDays(start, i);
    const kept = answers.has(date) ? answers.get(date) : null;
    return {
      date,
      letter,
      before: date < lesson.started_on,
      isToday: date === today,
      ahead: date > today,
      kept,
    };
  });
}

export function daysBetween(from, to) {
  return Math.round((parseDateStr(to) - parseDateStr(from)) / 86400000);
}

// "Day 3 · kept today"
export function lessonNote(lesson, todayAnswer, today) {
  const day = Math.max(1, daysBetween(lesson.started_on, today) + 1);
  if (todayAnswer === true) return `Day ${day} · kept today`;
  if (todayAnswer === false) return `Day ${day} · slipped today, and that's noted`;
  return `Day ${day} · check in tonight`;
}

function byPosition(a, b) {
  return (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

// What a quest or lesson serves, for its tag: a lifetime goal, or (no goal)
// the mission itself.
export function servesOf(goalId, goalsById) {
  const g = goalId ? goalsById.get(goalId) : null;
  return g ? { kind: "goal", id: g.id, label: g.short, gear: g.gear } : { kind: "mission", id: null, label: "My mission", gear: "summit" };
}

// Everything the page shows, from what fetchAscent loaded.
export function buildAscent(data, today) {
  const window = windowDays(today);
  const index = stepIndex(data?.steps);
  const roots = [...(data?.goals ?? [])].sort(
    (a, b) =>
      String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) ||
      gearRank(a.title) - gearRank(b.title) ||
      String(a.title).localeCompare(String(b.title))
  );
  const focuses = [...(data?.focuses ?? [])].sort(byPosition);
  const allQuests = [...(data?.quests ?? [])].sort(byPosition);
  const quests = allQuests.filter((q) => !q.lesson_id);
  const climbs = allQuests.filter((q) => q.lesson_id);
  const lessons = [...(data?.lessons ?? [])].sort(byPosition);

  const goals = roots.map((g) => {
    const own = focuses
      .filter((f) => f.goal_id === g.id)
      .map((f) => {
        const s = focusSteps(f, index);
        return { ...f, days: s.days, last: s.last, count: s.days.size };
      });
    const days = new Set(own.flatMap((f) => [...f.days]));
    const last = own.map((f) => f.last).filter(Boolean).sort().pop() ?? null;
    const count = days.size;
    const pct = Math.round((count / WINDOW_DAYS) * 100);
    return {
      id: g.id,
      title: g.title,
      description: g.description ?? "",
      short: shortGoal(g.title),
      gear: gearFor(g.title),
      focuses: own,
      count,
      pct,
      zone: zoneOf(pct),
      prints: footprints(days, window),
      fed: fedLine({ focuses: own, count, last }),
    };
  });
  const goalsById = new Map(goals.map((g) => [g.id, g]));

  // Quests and lessons that serve each goal, for its "what feeds it" list.
  for (const g of goals) {
    g.quests = quests.filter((q) => q.status === "on" && q.goal_id === g.id);
    g.lessons = lessons.filter((l) => l.status === "learning" && l.goal_id === g.id);
  }

  const campsByQuest = new Map();
  for (const c of data?.camps ?? []) {
    if (!campsByQuest.has(c.quest_id)) campsByQuest.set(c.quest_id, []);
    campsByQuest.get(c.quest_id).push(c);
  }
  const questViews = quests.map((q) => ({
    ...q,
    serves: servesOf(q.goal_id, goalsById),
    state: questState(q, campsByQuest.get(q.id) ?? []),
  }));
  const lessonsById = new Map(lessons.map((l) => [l.id, l]));
  // A lesson's mountain goes by the lesson's name and serves what it serves.
  const climbViews = climbs
    .filter((q) => lessonsById.has(q.lesson_id))
    .map((q) => {
      const l = lessonsById.get(q.lesson_id);
      return { ...q, title: l.title, lesson: l, serves: servesOf(l.goal_id, goalsById), state: questState(q, campsByQuest.get(q.id) ?? []) };
    });
  const climbByLesson = new Map(climbViews.map((q) => [q.lesson_id, q]));

  const answersByLesson = new Map();
  for (const c of data?.checkins ?? []) {
    if (!answersByLesson.has(c.lesson_id)) answersByLesson.set(c.lesson_id, new Map());
    answersByLesson.get(c.lesson_id).set(c.date, c.kept);
  }
  const lessonViews = lessons.map((l) => {
    const answers = answersByLesson.get(l.id) ?? new Map();
    const todayAnswer = answers.has(today) ? answers.get(today) : null;
    return {
      ...l,
      serves: servesOf(l.goal_id, goalsById),
      week: lessonWeek(l, answers, today),
      today: todayAnswer,
      note: lessonNote(l, todayAnswer, today),
      mountain: climbByLesson.get(l.id) ?? null,
    };
  });

  return {
    mission: data?.mission ?? null,
    goals,
    // The climber on the big mountain stands as high as the lifetime goals
    // are strong on average, so it climbs as they're walked.
    climb: goals.length ? goals.reduce((a, g) => a + g.pct, 0) / goals.length / 100 : 0,
    quests: questViews.filter((q) => q.status === "on"),
    // The mountains of lessons still being learned, climbed beside the quest.
    climbs: climbViews.filter((q) => q.status === "on" && q.lesson.status === "learning"),
    patches: [...questViews, ...climbViews]
      .filter((q) => q.status === "done")
      .sort((a, b) => String(a.finished_on ?? "").localeCompare(String(b.finished_on ?? ""))),
    setAside: questViews.filter((q) => q.status === "set_aside"),
    lessons: lessonViews.filter((l) => l.status === "learning"),
    learned: lessonViews.filter((l) => l.status === "learned"),
  };
}
