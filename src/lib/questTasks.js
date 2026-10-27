// A quest's running list (0081): each day he puts in what he'll do for it,
// ticks things off and writes notes on what he did, then does it again the
// next day. Tasks can have sub-tasks under them, a line can be a note
// instead of a task, and every line can carry a note. Lists stay on their
// day (nothing is carried forward, Aaron 2026-10-14), so an earlier day's
// open task is still there to tick where it was written.
//
// Beside the days each quest keeps one ongoing list (0089, Aaron
// 2026-10-27): lines marked ongoing belong to no day. A sub-task goes where
// its task is, whatever its own mark says.
//
// Everything here is pure; the page is src/pages/Quests.jsx.

import { addDays, parseDateStr } from "./planDates.js";

export const byPos = (a, b) =>
  (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) || String(a.id).localeCompare(String(b.id));

// Each top line with its sub-tasks under it, in order.
function treeOf(tasks) {
  const subs = new Map();
  const tops = [];
  for (const t of tasks) {
    if (t.parent_id) {
      if (!subs.has(t.parent_id)) subs.set(t.parent_id, []);
      subs.get(t.parent_id).push(t);
    } else tops.push(t);
  }
  return tops.sort(byPos).map((t) => ({ ...t, subs: (subs.get(t.id) ?? []).sort(byPos) }));
}

// How many tasks and sub-tasks are done of how many (note lines don't count).
function tallyOf(items) {
  const all = items.flatMap((i) => [i, ...i.subs]).filter((x) => x.kind !== "note");
  return { done: all.filter((x) => x.done_on).length, total: all.length };
}

// The days of a quest's list, today first, then the rest newest first:
//   [{ day, items: [{ ...line, subs: [...] }], done, total }]
// `done` and `total` count tasks and sub-tasks (note lines don't count).
// Today is always there, even empty, so there's somewhere to write. Lines
// on the ongoing list aren't on any day.
export function listDays(tasks, today) {
  const days = new Map([[today, []]]);
  for (const t of treeOf(tasks)) {
    if (t.ongoing) continue;
    if (!days.has(t.day)) days.set(t.day, []);
    days.get(t.day).push(t);
  }
  return [...days.entries()]
    .sort((a, b) => (a[0] === today ? -1 : b[0] === today ? 1 : a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([day, items]) => ({ day, items, ...tallyOf(items) }));
}

// The quest's ongoing list: { items, earlier, done, total }. `items` are the
// lines still open and the ones ticked today (so a tick doesn't make a line
// vanish under his finger); `earlier` are the ones done before today, sub-tasks
// and all, kept out of the way. `done` and `total` count the whole list.
export function ongoingList(tasks, today) {
  const all = treeOf(tasks).filter((t) => t.ongoing);
  const before = (x) => Boolean(x.done_on) && x.done_on < today;
  const gone = (t) => t.kind !== "note" && before(t) && t.subs.every((x) => x.kind === "note" || before(x));
  return { items: all.filter((t) => !gone(t)), earlier: all.filter(gone), ...tallyOf(all) };
}

// The lines picked for today (0090) from the ongoing list and earlier
// days, which show again in today's list as the same lines: { items, done,
// total }. Only top lines are picked (their sub-tasks come with them), and
// a line already on today's own list isn't shown twice. The ongoing list's
// come first, then the earlier days', newest first. Each item carries
// `from`: "ongoing" or its day.
export function pickedLines(tasks, today) {
  const items = treeOf(tasks)
    .filter((t) => today && t.today_on === today && (t.ongoing || t.day !== today))
    .map((t) => ({ ...t, from: t.ongoing ? "ongoing" : t.day }))
    .sort((a, b) => (Boolean(a.ongoing) !== Boolean(b.ongoing) ? (a.ongoing ? -1 : 1) : a.ongoing || a.day === b.day ? byPos(a, b) : a.day < b.day ? 1 : -1));
  return { items, ...tallyOf(items) };
}

// "Today", "Yesterday", or "Tue, Oct 21" (with the year when it isn't this one).
export function dayLabel(day, today) {
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  const d = parseDateStr(day);
  const opts = { weekday: "short", month: "short", day: "numeric" };
  if (d.getFullYear() !== parseDateStr(today).getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-US", opts);
}

// Where a new line goes: after the last one on that day (or under that
// task). A `day` of null means the ongoing list.
export function nextPosition(tasks, day, parentId = null) {
  return tasks
    .filter((t) => (parentId ? t.parent_id === parentId : !t.parent_id && (day === null ? t.ongoing : !t.ongoing && t.day === day)))
    .reduce((m, t) => Math.max(m, (t.position ?? 0) + 1), 0);
}

// The lists along the top: quests still on, then lessons still being
// learned, each { key, questId, lessonId, name, type, goalId }. A lesson's
// list lives on its own mountain (quests.lesson_id), made the first time he
// writes on it, so until then it has no questId.
export function boardOf({ quests = [], lessons = [] }) {
  const mountain = new Map(quests.filter((q) => q.lesson_id).map((q) => [q.lesson_id, q]));
  const out = quests
    .filter((q) => !q.lesson_id && q.status === "on")
    .sort(byPos)
    .map((q) => ({ key: q.id, questId: q.id, lessonId: null, name: q.title, type: "Quest", goalId: q.goal_id ?? null, note: q.note ?? null }));
  for (const l of [...lessons].filter((x) => x.status === "learning").sort(byPos)) {
    const m = mountain.get(l.id);
    out.push({ key: m ? m.id : `lesson-${l.id}`, questId: m?.id ?? null, lessonId: l.id, name: l.title, type: "Lesson", goalId: l.goal_id ?? null, note: m?.note ?? null });
  }
  return out;
}

// "1 task", "3 tasks".
export function countLine(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

// What he typed or pasted into the box, as lines to add: one per line, any
// bullet or checkbox mark taken off, and a line indented under another
// (two spaces, a tab, or a deeper bullet) becomes a sub-task of the line
// above it. Each is { text, sub }.
const MARK = /^(?:[-*•▪◦·+]|\d{1,3}[.)]|\[[ xX✓]?\]|☐|☑|✓)\s+/;
export function parseLines(value) {
  const out = [];
  let base = null; // how far in the last top line sat
  for (const raw of String(value ?? "").split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const indent = raw.match(/^[ \t]*/)[0].replace(/\t/g, "  ").length;
    let text = raw.trim();
    for (let i = 0; i < 2 && MARK.test(text); i++) text = text.replace(MARK, "").trim();
    if (!text) continue;
    const sub = base !== null && indent >= base + 2;
    if (!sub) base = indent;
    out.push({ text: text.slice(0, 2000), sub });
  }
  return out;
}

// The finished tasks the village counts, kept in step as he ticks: the
// list with this line in it as it now is, or out of it while it's open (pass
// it with done_on null once it's taken off). Only ticked task lines lay bricks.
export function withFinished(finished, line) {
  const rest = finished.filter((t) => t.id !== line.id);
  if (!line.done_on || line.kind !== "task") return rest;
  return [...rest, { id: line.id, quest_id: line.quest_id, kind: line.kind, text: line.text, note: line.note ?? null, done_on: line.done_on, done_at: line.done_at ?? null, updated_at: line.updated_at ?? null }];
}

// The finished camp steps the village counts, kept in step the same way
// as he ticks a step in a quest's Today.
export function withFinishedStep(finished, step) {
  const rest = finished.filter((s) => s.id !== step.id);
  if (!step.done_on) return rest;
  return [...rest, { id: step.id, camp_id: step.camp_id, text: step.text, note: step.note ?? null, done_on: step.done_on, updated_at: step.updated_at ?? null }];
}

// Each camp's steps, for the camps under each quest on Quests: camp id →
// { done, total, working, today }, where `working` means an open step there
// is being worked on now and `today` counts what's on today there: the
// steps picked for `today`, and in a section picked for it (0091, from
// `sections`) its steps that show in Today, the ones not done before today.
export function campTally(steps, today = null, sections = null) {
  const whole = new Set(today ? (sections ?? []).filter((x) => x.today_on === today).map((x) => x.id) : []);
  const m = new Map();
  for (const s of steps ?? []) {
    const t = m.get(s.camp_id) ?? { done: 0, total: 0, working: false, today: 0 };
    t.total += 1;
    if (s.done_on) t.done += 1;
    else if (s.working_since) t.working = true;
    if (s.section_id && whole.has(s.section_id)) {
      if (!s.parent_id && (!s.done_on || s.done_on >= today)) t.today += 1;
    } else if (today && s.today_on === today) t.today += 1;
    m.set(s.camp_id, t);
  }
  return m;
}
