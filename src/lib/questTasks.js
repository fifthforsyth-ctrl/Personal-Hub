// A quest's running list (0081): each day he puts in what he'll do for it,
// ticks things off and writes notes on what he did, then does it again the
// next day. Tasks can have sub-tasks under them, a line can be a note
// instead of a task, and every line can carry a note. Lists stay on their
// day (nothing is carried forward, Aaron 2026-10-14), so an earlier day's
// open task is still there to tick where it was written.
//
// Everything here is pure; the page is src/pages/Quests.jsx.

import { addDays, parseDateStr } from "./planDates.js";

const byPos = (a, b) =>
  (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) || String(a.id).localeCompare(String(b.id));

// The days of a quest's list, today first, then the rest newest first:
//   [{ day, items: [{ ...line, subs: [...] }], done, total }]
// `done` and `total` count tasks and sub-tasks (note lines don't count).
// Today is always there, even empty, so there's somewhere to write.
export function listDays(tasks, today) {
  const subs = new Map();
  const tops = [];
  for (const t of tasks) {
    if (t.parent_id) {
      if (!subs.has(t.parent_id)) subs.set(t.parent_id, []);
      subs.get(t.parent_id).push(t);
    } else tops.push(t);
  }
  const days = new Map([[today, []]]);
  for (const t of tops) {
    if (!days.has(t.day)) days.set(t.day, []);
    days.get(t.day).push({ ...t, subs: (subs.get(t.id) ?? []).sort(byPos) });
  }
  return [...days.entries()]
    .sort((a, b) => (a[0] === today ? -1 : b[0] === today ? 1 : a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([day, items]) => {
      items.sort(byPos);
      const all = items.flatMap((i) => [i, ...i.subs]).filter((x) => x.kind !== "note");
      return { day, items, done: all.filter((x) => x.done_on).length, total: all.length };
    });
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

// Where a new line goes: after the last one on that day (or under that task).
export function nextPosition(tasks, day, parentId = null) {
  return tasks
    .filter((t) => (parentId ? t.parent_id === parentId : !t.parent_id && t.day === day))
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

// Each camp's steps, for the camps under each quest on Quests: camp id →
// { done, total, working }, where `working` means an open step there is
// being worked on now.
export function campTally(steps) {
  const m = new Map();
  for (const s of steps ?? []) {
    const t = m.get(s.camp_id) ?? { done: 0, total: 0, working: false };
    t.total += 1;
    if (s.done_on) t.done += 1;
    else if (s.working_since) t.working = true;
    m.set(s.camp_id, t);
  }
  return m;
}
