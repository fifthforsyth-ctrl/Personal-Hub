// Everything finished today (Aaron, 2026-10-27: "click on the number of
// tasks done today in the quest tab and see all that was done"). Tapping
// the count on a quest's Today, or the build's "N today", opens it.
//
// Pure, so it can be tested; the sheet is src/components/quests/DoneToday.jsx.

import { buildCamp, fromLabel } from "./camp.js";
import { byPos, dayLabel } from "./questTasks.js";

const isTask = (t) => (t.kind ?? "task") === "task";
const node = (x, from = null, subs = []) => ({ id: x.id, text: x.text ?? "", note: x.note ?? null, from, subs });

// How many items, counting everything under them.
export function countDone(items) {
  return (items ?? []).reduce((n, i) => n + 1 + countDone(i.subs), 0);
}

// One quest's day, in the shape of its Today: each camp's steps finished
// today (camps in order, steps as they sit in the camp), then the lines
// finished today on its own list:
//   { groups: [{ key, camp, number, items } | { key: "list", items }], count }
// Each item is { id, text, note, from, subs }. What's under it that was
// also finished today sits in `subs`. A step or line that isn't finished
// today isn't shown, but what's under it that is shows in its place, with
// "under “…”" in `from`. `from` also names the section a step is in, and the
// list a line is on when that isn't today's ("Ongoing", "Mon, Oct 20").
export function questDoneToday({ camps = [], sections = [], steps = [], lines = [] } = {}, today) {
  const groups = [];
  [...(camps ?? [])].sort(byPos).forEach((camp, i) => {
    const view = buildCamp(
      (sections ?? []).filter((s) => s.camp_id === camp.id),
      (steps ?? []).filter((st) => st.camp_id === camp.id)
    );
    const items = [...stepsDone(view.loose, today, null), ...view.sections.flatMap((s) => stepsDone(s.steps, today, s))];
    if (items.length) groups.push({ key: `camp-${camp.id}`, camp, number: i + 1, items });
  });
  const list = linesDone(lines ?? [], today);
  if (list.length) groups.push({ key: "list", items: list });
  return { groups, count: groups.reduce((n, g) => n + countDone(g.items), 0) };
}

// A camp's steps (buildCamp's trees) finished today. `section` names where
// the top ones sit; under a step that's shown, only "under “…”" is needed.
function stepsDone(list, today, section, parent = null) {
  return list.flatMap((st) =>
    st.done_on === today
      ? [node(st, fromLabel(section, parent), stepsDone(st.subs, today, null))]
      : stepsDone(st.subs, today, section, st)
  );
}

// A quest's lines finished today: today's own list first, then the ongoing
// list, then earlier days, newest first, each in its order. A sub-task goes
// where its task is (as listDays and ongoingList show it); one whose task
// is gone isn't shown on the list, so it isn't here either.
function linesDone(lines, today) {
  const subs = new Map();
  const tops = [];
  for (const t of lines) {
    if (t.parent_id) {
      if (!subs.has(t.parent_id)) subs.set(t.parent_id, []);
      subs.get(t.parent_id).push(t);
    } else tops.push(t);
  }
  const rank = (t) => (t.ongoing ? 1 : t.day === today ? 0 : 2);
  tops.sort((a, b) => rank(a) - rank(b) || (rank(a) === 2 && a.day !== b.day ? (a.day < b.day ? 1 : -1) : 0) || byPos(a, b));
  const done = (t) => isTask(t) && t.done_on === today;
  const out = [];
  for (const top of tops) {
    const list = top.ongoing ? "Ongoing" : top.day === today ? null : dayLabel(top.day, today);
    const kids = (subs.get(top.id) ?? []).filter(done).sort(byPos);
    if (done(top)) out.push(node(top, list, kids.map((k) => node(k))));
    else {
      const from = [list, fromLabel(null, top)].filter(Boolean).join(" · ");
      out.push(...kids.map((k) => node(k, from)));
    }
  }
  return out;
}

// Every quest's day, for "All quests":
//   [{ key, questId, name, count, groups }]
// in the order of the lists along the top (`items`, from boardOf), then any
// other quest by name. Only what the village loads is known here (finished
// tasks and steps, with no sub-tasks or sections), so under each quest come
// its camps in order, each with its steps in the order they were finished,
// then its list's lines, the same way. Groups are shaped as questDoneToday's.
export function allDoneToday({ items = [], quests = [], lessons = [], camps = [], tasks = [], steps = [] } = {}, today) {
  const campOf = new Map((camps ?? []).map((c) => [c.id, c]));
  const byQuest = new Map();
  const add = (questId, kind, row) => {
    if (!questId) return;
    if (!byQuest.has(questId)) byQuest.set(questId, { camps: new Map(), list: [] });
    const q = byQuest.get(questId);
    if (kind === "list") q.list.push(row);
    else {
      if (!q.camps.has(kind)) q.camps.set(kind, []);
      q.camps.get(kind).push(row);
    }
  };
  for (const t of tasks ?? []) if (t.done_on === today && isTask(t)) add(t.quest_id, "list", t);
  for (const s of steps ?? []) {
    const c = s.done_on === today ? campOf.get(s.camp_id) : null;
    if (c) add(c.quest_id, c.id, s);
  }

  const lessonName = new Map((lessons ?? []).map((l) => [l.id, l.title]));
  const questRow = new Map((quests ?? []).map((q) => [q.id, q]));
  const nameOf = (id) => {
    const q = questRow.get(id);
    return (q?.lesson_id && lessonName.get(q.lesson_id)) || q?.title || "Quest";
  };
  const shown = (items ?? []).filter((i) => i.questId && byQuest.has(i.questId));
  const order = [
    ...shown.map((i) => ({ key: i.key, questId: i.questId, name: i.name })),
    ...[...byQuest.keys()]
      .filter((id) => !shown.some((i) => i.questId === id))
      .map((id) => ({ key: id, questId: id, name: nameOf(id) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ];
  const when = (at) => (a, b) => String(at(a) ?? "").localeCompare(String(at(b) ?? "")) || String(a.id).localeCompare(String(b.id));

  return order.map((q) => {
    const mine = byQuest.get(q.questId);
    const groups = (camps ?? [])
      .filter((c) => c.quest_id === q.questId)
      .sort(byPos)
      .map((camp, i) => ({ camp, number: i + 1, rows: mine.camps.get(camp.id) ?? [] }))
      .filter((g) => g.rows.length)
      .map(({ camp, number, rows }) => ({ key: `camp-${camp.id}`, camp, number, items: rows.sort(when((s) => s.updated_at)).map((s) => node(s)) }));
    if (mine.list.length) groups.push({ key: "list", items: mine.list.sort(when((t) => t.done_at ?? t.updated_at)).map((t) => node(t)) });
    return { ...q, count: groups.reduce((n, g) => n + g.items.length, 0), groups };
  });
}
