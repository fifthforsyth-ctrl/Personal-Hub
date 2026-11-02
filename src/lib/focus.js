import { addDays, startOfWeek, fmtShortDate } from "./planDates.js";
import { placement, levelAtSpot, clampSpot } from "./mark.js";
import { normCheck, checksLevel, answerEntry } from "./checks.js";

// Weekly focus goals: the few things a week is for, set on Sunday.
//
// The pure parts live here so they can be tested without a database: which
// week a day belongs to, how a goal's week went, which of last week's goals
// are still waiting to be looked at, how the week's answers land on a small
// target, and which earlier weeks a focus's notes come from.

export function focusWeekOf(date) {
  return startOfWeek(date);
}

export function previousWeek(weekStart) {
  return addDays(weekStart, -7);
}

// Goals in the order they were set, so the list doesn't reshuffle when one
// is renamed.
export function orderGoals(goals) {
  return [...(goals ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))
  );
}

// How each goal's week went: the seven days in order, each yes, no or
// unanswered, and how many of them moved it.
export function summarizeWeek(goals, checkins, weekStart) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byGoal = new Map();
  for (const c of checkins ?? []) {
    const date = String(c.date).slice(0, 10);
    if (!byGoal.has(c.goal_id)) byGoal.set(c.goal_id, new Map());
    byGoal.get(c.goal_id).set(date, Boolean(c.moved));
  }
  return orderGoals(goals).map((g) => {
    const answers = byGoal.get(g.id) ?? new Map();
    const marks = days.map((date) => ({ date, moved: answers.has(date) ? answers.get(date) : null }));
    return {
      ...g,
      days: marks,
      movedDays: marks.filter((m) => m.moved === true).length,
      answeredDays: marks.filter((m) => m.moved !== null).length,
    };
  });
}

// Today's answer for one goal: true, false, or null when not asked yet.
export function answerOn(checkins, goalId, date) {
  const hit = (checkins ?? []).find((c) => c.goal_id === goalId && String(c.date).slice(0, 10) === date);
  return hit ? Boolean(hit.moved) : null;
}

// Last week's goals nobody has kept, adjusted or let go of yet.
export function awaitingReview(lastWeekGoals) {
  return orderGoals(lastWeekGoals).filter((g) => !g.review);
}

// The review belongs to the week it opens onto: this week, or next week when
// you plan ahead on a Saturday. Paging back through old weeks shouldn't keep
// asking about weeks long gone.
export function showsReview(weekStart, today) {
  const thisWeek = focusWeekOf(today);
  return weekStart >= thisWeek && weekStart <= addDays(thisWeek, 7);
}

// "3 of 7 days", or how it reads before anything was answered.
export function movedLabel(goal) {
  if (!goal.answeredDays) return "No check-ins";
  return `Moved it ${goal.movedDays} of ${goal.answeredDays} ${goal.answeredDays === 1 ? "day" : "days"}`;
}

// The next position at the end of the list.
export function nextPosition(goals) {
  return (goals ?? []).reduce((max, g) => Math.max(max, (g.position ?? 0) + 1), 0);
}

export function cleanTitle(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
}

// --- The week's focus as small targets on Today ------------------------------
//
// Each focus is drawn as one of the Mark's small targets, and each day's
// arrow is a mark on it. Since 0103 an arrow lands one of two ways, chosen
// per focus (lands_by): you place it yourself where the day landed, or the
// focus's own checks put it in its ring, the way a target's do. A day from
// before then only said whether it moved the focus: moved reads as the
// inner ring, not today as a miss. A day with no answer leaves no mark.

export const MOVED_LEVEL = 1; // Inner
export const NOT_TODAY_LEVEL = 5; // Missed

export function landsBy(goal) {
  return goal?.lands_by === "checks" ? "checks" : "placed";
}

// The ring a day's arrow is in. `c` is a check-in row, or (from before
// 0103) just whether it moved.
export function checkinLevel(c) {
  if (c && typeof c === "object") {
    if (Number.isInteger(c.level) && c.level >= 0 && c.level <= 5) return c.level;
    return c.moved ? MOVED_LEVEL : NOT_TODAY_LEVEL;
  }
  return c ? MOVED_LEVEL : NOT_TODAY_LEVEL;
}

export function checkinShot(goalId, date, c) {
  const level = checkinLevel(c);
  const id = `${goalId}:${date}`;
  // Where you put it, when you did; otherwise its spot comes from the goal
  // and the day, so a mark never jumps about.
  const placed = c && typeof c === "object" && c.spot_x != null && c.spot_y != null;
  const spot = placed ? { x: Number(c.spot_x), y: Number(c.spot_y) } : placement(id, level, null);
  return { id, date, level, ...spot, note: c && typeof c === "object" ? c.note ?? null : null };
}

// This week's arrows as each goal's marks, oldest first, the order the
// target face wants (it lights the last one). Every goal gets a list, empty
// until something's been answered; check-ins from other weeks, or for goals
// not in this week, are left out.
export function weekShots(goals, checkins, weekStart) {
  const end = addDays(weekStart, 6);
  const byGoal = new Map((goals ?? []).map((g) => [g.id, new Map()]));
  for (const c of checkins ?? []) {
    const days = byGoal.get(c.goal_id);
    const date = String(c.date).slice(0, 10);
    if (!days || date < weekStart || date > end) continue;
    days.set(date, c);
  }
  const out = {};
  for (const [id, days] of byGoal) {
    out[id] = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, c]) => checkinShot(id, date, c));
  }
  return out;
}

// One day's check-in for a goal, or null.
export function checkinOn(checkins, goalId, date) {
  return (checkins ?? []).find((c) => c.goal_id === goalId && String(c.date).slice(0, 10) === date) ?? null;
}

// A focus's checks still being asked, in order.
export function checksFor(goalId, checks) {
  return (checks ?? [])
    .filter((c) => c.goal_id === goalId && !c.retired_on)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))
    .map((c) => ({ ...c, ...normCheck(c) }));
}

// The arrow you placed, ready to save: the ring comes from the spot.
export function placedArrow(spot, note = "") {
  const at = clampSpot(spot?.x, spot?.y);
  const n = String(note ?? "").trim().slice(0, 1000);
  return { level: levelAtSpot(at.x, at.y), spot_x: at.x, spot_y: at.y, note: n || null, answers: [], lands: "placed" };
}

// The arrow a focus's checks land, ready to save, or null until every check
// that scores is answered. `answers` is one { value, line } per check.
export function checksArrow(checks, answers, note = "") {
  const values = (checks ?? []).map((_, i) => answers?.[i]?.value ?? null);
  const level = checksLevel(checks, values);
  if (level == null) return null;
  const n = String(note ?? "").trim().slice(0, 1000);
  return {
    level,
    spot_x: null,
    spot_y: null,
    note: n || null,
    answers: (checks ?? []).map((c, i) => answerEntry(c, values[i], answers?.[i]?.line)),
    lands: "checks",
  };
}

// What a focus counts toward, as the Mark names its targets: a lifetime
// goal (node_id), a quest or a lesson. Null when it stands alone.
export function countsToward(goal) {
  if (goal?.quest_id) return { kind: "quest", id: goal.quest_id };
  if (goal?.lesson_id) return { kind: "lesson", id: goal.lesson_id };
  if (goal?.node_id) return { kind: "goal", id: goal.node_id };
  return null;
}

// The week's focuses that count toward a target and landed an arrow on
// `date`, as { goal, level }: what the target's own shot averages in.
export function linkedArrows(target, goals, checkins, date) {
  if (!target?.ref?.id) return [];
  const out = [];
  for (const g of orderGoals(goals)) {
    const to = countsToward(g);
    if (!to || to.kind !== target.kind || to.id !== target.ref.id) continue;
    const c = checkinOn(checkins, g.id, date);
    if (!c) continue;
    out.push({ goal: g, level: checkinLevel(c) });
  }
  return out;
}

// --- Notes on a focus (0101) -------------------------------------------------

// How far back a focus's notes reach: a year of Sundays.
export const LINEAGE_WEEKS = 52;

// A focus and the earlier weeks it was carried from, newest first, as ids.
// Keeping a goal on Sunday writes a new row that points back at last week's
// (carried_from), so following those pointers walks the same focus back
// through the weeks. It stops at a goal that isn't there any more, at a loop
// (there shouldn't be one, but one bad row mustn't hang the page), and after
// a year. `goal` is a goal row or just its id.
export function lineageIds(goal, allGoals) {
  const byId = new Map((allGoals ?? []).filter((g) => g?.id).map((g) => [g.id, g]));
  const given = typeof goal === "string" ? { id: goal } : goal;
  let cur = given?.id ? byId.get(given.id) ?? given : null;
  const ids = [];
  const seen = new Set();
  while (cur?.id && !seen.has(cur.id) && ids.length < LINEAGE_WEEKS) {
    ids.push(cur.id);
    seen.add(cur.id);
    cur = cur.carried_from ? byId.get(cur.carried_from) : null;
  }
  return ids;
}

// Newest first, the way the notes read under a focus.
export function newestFirst(notes) {
  return [...(notes ?? [])].sort(
    (a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")) || String(b.id ?? "").localeCompare(String(a.id ?? ""))
  );
}

// A note as it's kept: no blank space round it, its own line breaks kept,
// and no longer than the 2000 characters the table allows.
export function cleanNote(text) {
  const trimmed = String(text ?? "").replace(/\r\n?/g, "\n").trim();
  return Array.from(trimmed).slice(0, 2000).join("").trim();
}

// The day over a note: "Today", "Yesterday", or the date.
export function noteDay(date, today) {
  const d = String(date ?? "").slice(0, 10);
  if (!d) return "";
  if (d === today) return "Today";
  if (d === addDays(today, -1)) return "Yesterday";
  return fmtShortDate(d);
}
