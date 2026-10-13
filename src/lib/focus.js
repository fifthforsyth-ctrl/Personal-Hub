import { addDays, startOfWeek } from "./planDates.js";

// Weekly focus goals: the few things a week is for, set on Sunday.
//
// The pure parts live here so they can be tested without a database: which
// week a day belongs to, how a goal's week went, and which of last week's
// goals are still waiting to be looked at.

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
