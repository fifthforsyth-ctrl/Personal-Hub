import { addDays, startOfWeek, fmtShortDate } from "./planDates.js";
import { placement, levelAtSpot, clampSpot } from "./mark.js";
import { normCheck, checksLevel, answerEntry, answered, scores, markOf, legacyValue, checkRow } from "./checks.js";

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

// --- Landing tonight's arrow (0103) ------------------------------------------
//
// What the evening card and a focus's sheet need to land an arrow and keep
// it: the week as it reads once each day lands an arrow, a day's arrow put
// into the week the moment it's made, the answers a focus's checks start
// from, and the bigger target it counts toward, by name.

// "3 arrows this week". Every arrow counts, a miss as much as a bullseye:
// either way you looked at the day and said where it landed. `goal` is a
// goal as summarizeWeek gives it.
export function arrowsLabel(goal) {
  const n = goal?.answeredDays ?? 0;
  if (!n) return "No arrows yet";
  return `${n} ${n === 1 ? "arrow" : "arrows"} this week`;
}

// The week's check-ins with one day's arrow put in, in place of whatever
// that day held, or taken out when `arrow` is null. The row reads the way
// the database keeps it, `moved` and all, so everything that reads the week
// sees it at once, before the save has landed.
export function putArrow(checkins, goalId, date, arrow) {
  const rest = (checkins ?? []).filter((c) => !(c.goal_id === goalId && String(c.date).slice(0, 10) === date));
  if (arrow == null) return rest;
  return [...rest, { goal_id: goalId, date, moved: Number(arrow.level) < 5, ...arrow }];
}

// A fresh read of the week, with the arrows still on their way to the
// database laid over it. Place an arrow, then again a moment later, and the
// week can be read between the two saves; without this it would show the
// first spot until the second save landed, and the arrow would jump back
// and forth under your finger. `pending` is a list of { goalId, date,
// arrow }, the newest for each day.
export function withPending(checkins, pending) {
  let out = checkins ?? [];
  for (const p of pending ?? []) out = putArrow(out, p.goalId, p.date, p.arrow);
  return out;
}

// Whether a saved check-in is already this arrow, so nothing needs saving.
// The database hands the answers back with their keys in its own order, so
// they're compared field by field rather than as text.
export function sameArrow(row, arrow) {
  if (!row || !arrow) return !row && !arrow;
  return arrowKey(row) === arrowKey(arrow);
}

// An arrow as one string that's the same whenever the arrow is: where it
// is, its note, how it landed and each answer. A component can watch it to
// know when there's something new to save.
export function arrowKey(a) {
  if (!a) return null;
  const spot = (v) => (v == null || v === "" ? null : Math.round(Number(v) * 10) / 10);
  const level = a.level == null ? null : Number(a.level);
  return JSON.stringify([
    level,
    spot(a.spot_x),
    spot(a.spot_y),
    a.note ?? null,
    a.lands ?? null,
    (Array.isArray(a.answers) ? a.answers : []).map((e) => [e?.aim ?? null, e?.value ?? null, e?.v ?? null, e?.line ?? "", e?.day === true]),
  ]);
}

// The checks this week's arrows answered on a focus. A check you take off
// that has been answered is retired rather than deleted, so the arrows that
// answered it still read as they were.
export function answeredChecks(checkins, goalId) {
  const ids = new Set();
  for (const c of checkins ?? []) {
    if (c.goal_id !== goalId || !Array.isArray(c.answers)) continue;
    for (const a of c.answers) if (a?.aim) ids.add(a.aim);
  }
  return ids;
}

// Whether a focus's checks, as its settings sheet holds them, differ from
// what they were: one added, taken off, moved or changed. Nothing changed,
// nothing is saved, and the week isn't read again for no reason.
export function checksChanged(rows, before) {
  const key = (list) => JSON.stringify((list ?? []).map((c) => [c.id ?? null, checkRow(c)]));
  return key(rows) !== key(before);
}

// Tonight's answers to a focus's checks, one { value, line, day } per check,
// in order. What you answered yourself (`mine`, by check id) wins; then
// what tonight's arrow already holds; then what the day holds (`auto`, one
// per check: when you got up, the time log's minutes).
//
// An answer the day filled in is kept marked as the day's (`day`). Open a
// focus at noon and its "Time drawing" lands with the 20 minutes logged by
// then; by evening the log has 50, and the day's newer answer takes over,
// where one you gave yourself would have stayed put.
export function focusAnswers(checks, row, { auto = [], mine = {} } = {}) {
  const saved = new Map();
  for (const e of Array.isArray(row?.answers) ? row.answers : []) if (e?.aim) saved.set(e.aim, e);
  return (checks ?? []).map((c, i) => {
    const m = c.id != null ? mine?.[c.id] : undefined;
    const s = c.id != null ? saved.get(c.id) : undefined;
    const fresh = auto?.[i] ?? null;
    const line = m && "line" in m ? String(m.line ?? "") : String(s?.line ?? "");
    if (m && "value" in m) return { value: m.value ?? null, line, day: false };
    if (s?.day === true && fresh != null) return { value: fresh, line, day: true };
    const was = s ? legacyValue(s) : null;
    if (s && fits(c, was)) return { value: was, line, day: s.day === true };
    return { value: fresh, line, day: fresh != null };
  });
}

// A saved answer still answers its check: a Some on what is now a Yes/No
// doesn't, and starts blank. Nor does a choice that's been taken off the
// check's list (Calm, renamed Peaceful): it would read as answered and not
// passed with no chip lit, and the arrow would land as a miss you never
// gave it.
function fits(check, value) {
  if (!answered(check, value)) return false;
  const c = normCheck(check);
  if (c.kind === "choice" && !c.options.includes(String(value))) return false;
  return !scores(check) || markOf(check, value) != null;
}

// The arrow a focus's checks land, as checksArrow makes it, with each answer
// the day filled in marked as the day's (see focusAnswers). Null until every
// check that scores is answered.
export function landedArrow(checks, answers, note = "") {
  const arrow = checksArrow(checks, answers, note);
  if (!arrow) return null;
  return { ...arrow, answers: arrow.answers.map((a, i) => (answers?.[i]?.day && a.value != null ? { ...a, day: true } : a)) };
}

// An arrow's note as it's kept: no blank space round it, no longer than the
// 1000 characters the table allows, and null when there's nothing.
export function arrowNote(text) {
  return String(text ?? "").trim().slice(0, 1000) || null;
}

// The arrow already saved for the day, just as it is, with a new note. A
// focus that lands by its checks keeps its arrow where it last landed while
// a check is left unanswered, and a note you type meanwhile goes onto that
// arrow rather than waiting for the checks. An old yes-or-no day keeps the
// ring it reads as.
export function arrowWithNote(row, note) {
  return {
    level: checkinLevel(row),
    spot_x: row?.spot_x ?? null,
    spot_y: row?.spot_y ?? null,
    note: arrowNote(note),
    answers: Array.isArray(row?.answers) ? row.answers : [],
    lands: row?.lands ?? null,
  };
}

// What a focus that lands by its checks should save tonight, or null when
// nothing needs saving: the arrow its checks landed, when it isn't what's
// saved or its last save failed (`failed`, that arrow's arrowKey); with a
// check still unanswered, the arrow already there with the note you typed
// since.
export function arrowToSave(row, ready, note, failed = null) {
  if (ready) return !sameArrow(row, ready) || failed === arrowKey(ready) ? ready : null;
  if (row && arrowNote(note) !== (row.note ?? null)) return arrowWithNote(row, note);
  return null;
}

// Whether the card should say tonight's arrow isn't saved, instead of its
// ring: one its checks landed, with nothing waiting or on its way to save
// it (`pending`), that the week doesn't hold. When its save failed, the week
// can still show it as saved for a moment (the row put in before the save,
// which has no updated_at), so only a row read back from the database
// clears it.
export function arrowNotSaved(ready, row, { failed = null, pending = false } = {}) {
  if (!ready || pending) return false;
  if (failed != null && failed === arrowKey(ready)) return !(row?.updated_at && sameArrow(row, ready));
  return !sameArrow(row, ready);
}

// --- What's typed on a focus tonight, kept on this phone ----------------------
//
// An arrow can only be saved once there is one: placed on the face, or
// landed by its checks once every check that scores is answered. Until
// then, what you've typed (two answers of three, a line on one of them, the
// note) has nowhere in the database to go, so it's kept on this phone, one
// draft per focus for the day: `hub.focus.draft.<date>` holds { [goal id]:
// { mine, note, at } }, `mine` being the answers you gave yourself by check
// id ({ value, line }, as GoalArrow holds them), and `at` when you last
// changed any of it. Switch Short and Full, leave the evening, close the
// sheet on Today or reload, and it comes back.
//
// The draft gives way to a saved arrow that's newer than it (one landed on
// another phone after you typed here), and it's cleared once an arrow that
// holds all of it has saved. These take `store` only so the tests can hand
// in a stand-in.

export function arrowDraftKey(date) {
  return `hub.focus.draft.${date}`;
}

function readDrafts(date, store) {
  const s = store ?? localStorage;
  const raw = JSON.parse(s.getItem(arrowDraftKey(date)) ?? "null");
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

// One focus's draft for the day, or null.
export function readArrowDraft(date, goalId, store) {
  try {
    const e = readDrafts(date, store)[goalId];
    return e && typeof e === "object" && !Array.isArray(e) ? e : null;
  } catch {
    return null;
  }
}

// Keeps one focus's draft for the day, or clears it when `entry` is null.
// The day's key goes once it holds nothing.
export function keepArrowDraft(date, goalId, entry, store) {
  try {
    const s = store ?? localStorage;
    const all = readDrafts(date, s);
    if (entry) all[goalId] = entry;
    else delete all[goalId];
    if (Object.keys(all).length) s.setItem(arrowDraftKey(date), JSON.stringify(all));
    else s.removeItem(arrowDraftKey(date));
  } catch {
    // Private mode or storage off: the draft just isn't kept.
  }
}

// The answers in a draft that still fit their checks as they are now, by
// check id. A draft is only ever a convenience, so a check that's gone, an
// answer of the wrong kind or a choice taken off the list is passed over,
// and a broken draft gives nothing. An answer you cleared stays cleared.
export function restoreMine(checks, mine) {
  const out = {};
  if (!mine || typeof mine !== "object" || Array.isArray(mine)) return out;
  for (const c of checks ?? []) {
    const m = c?.id != null ? mine[c.id] : null;
    if (!m || typeof m !== "object" || Array.isArray(m)) continue;
    const e = {};
    const v = m.value;
    if ("value" in m && (v === null || v === "" || ((typeof v === "string" || typeof v === "number") && fits(c, v)))) e.value = v;
    if (typeof m.line === "string") e.line = m.line.slice(0, 500);
    if (Object.keys(e).length) out[c.id] = e;
  }
  return out;
}

// Whether an arrow holds everything in a draft: its note, and each answer
// and line you gave. A draft with nothing in it is held by anything.
export function draftHeld(checks, entry, arrow) {
  if (!entry) return true;
  const mine = restoreMine(checks, entry.mine);
  const note = arrowNote(entry.note);
  if (!note && !Object.keys(mine).length) return true;
  if (!arrow) return false;
  if (note !== (arrow.note ?? null)) return false;
  const saved = new Map();
  for (const e of Array.isArray(arrow.answers) ? arrow.answers : []) if (e?.aim) saved.set(e.aim, e);
  for (const c of checks ?? []) {
    const m = mine[c.id];
    if (!m) continue;
    const s = saved.get(c.id);
    if ("value" in m && answerEntry(c, m.value).value !== (s?.value ?? null)) return false;
    if ("line" in m && String(m.line).trim().slice(0, 500) !== String(s?.line ?? "")) return false;
  }
  return true;
}

// Where a focus's arrow starts tonight: { mine, note, drop }. A draft this
// phone kept wins, unless the saved arrow is newer than it or already holds
// all of it; then the saved arrow's note and answers are where it starts,
// and `drop` says the draft can go.
export function arrowStart(checks, row, entry) {
  const saved = { mine: {}, note: String(row?.note ?? "") };
  if (!entry || typeof entry !== "object") return { ...saved, drop: false };
  const savedAt = Date.parse(row?.updated_at ?? "");
  const at = Number(entry.at);
  if (row && Number.isFinite(savedAt) && !(at > savedAt)) return { ...saved, drop: true };
  if (row && Number.isFinite(savedAt) && draftHeld(checks, entry, row)) return { ...saved, drop: true };
  return {
    mine: restoreMine(checks, entry.mine),
    note: typeof entry.note === "string" ? entry.note.slice(0, 1000) : saved.note,
    drop: false,
  };
}

// Once an arrow has saved: the draft goes if the arrow holds all of it.
// Anything it doesn't hold (two answers of three, or a line typed while it
// saved) is still yours, so the draft is stamped again, newer than the
// arrow that just saved, and it's what the focus starts from next time.
export function settleArrowDraft(date, goalId, checks, arrow, store, now = Date.now()) {
  const entry = readArrowDraft(date, goalId, store);
  if (!entry) return;
  if (draftHeld(checks, entry, arrow)) keepArrowDraft(date, goalId, null, store);
  else keepArrowDraft(date, goalId, { ...entry, at: now }, store);
}

// The bigger targets a focus can count toward, the Mark's own: each lifetime
// goal, each quest you're on, each lesson you're learning, from the Ascent
// view (buildAscent), as { key, kind, id, title }.
export function towardChoices(view) {
  const of = (kind, list) => (list ?? []).map((x) => ({ key: `${kind}:${x.id}`, kind, id: x.id, title: String(x.title ?? "") }));
  return [...of("goal", view?.goals), ...of("quest", view?.quests), ...of("lesson", view?.lessons)];
}

// What a focus counts toward as one string, "quest:<id>", or "" for nothing,
// so a select can hold it; parseToward turns it back.
export function towardKey(goal) {
  const to = countsToward(goal);
  return to ? `${to.kind}:${to.id}` : "";
}

export function parseToward(key) {
  const m = /^(goal|quest|lesson):(.+)$/.exec(String(key ?? ""));
  return m ? { kind: m[1], id: m[2] } : null;
}

// The name of what a focus counts toward, or null when it stands alone or
// the name can't be found. Each of `sources` holds goals, quests and
// lessons by id (the Ascent view first, then fetchAscent's own rows, which
// still have a quest you've finished).
export function towardTitle(goal, ...sources) {
  const to = countsToward(goal);
  if (!to) return null;
  const listOf = (src) => (to.kind === "goal" ? src?.goals : to.kind === "quest" ? src?.quests : src?.lessons) ?? [];
  for (const src of sources) {
    const hit = listOf(src).find((x) => x?.id === to.id);
    if (hit?.title) return String(hit.title);
  }
  return null;
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
