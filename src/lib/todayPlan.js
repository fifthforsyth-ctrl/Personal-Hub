// Today's plan, block by block, with what you'll do inside each one (Aaron,
// 2026-11-02): "I want to see my plan for the day right under my minutes,
// all daily blocks visible, with just the blocks ahead of me expanded to see
// all the tasks." And where those tasks come from: "they come from when I
// plan; draw from any deadlines or tasks tied to that day."
//
// So every block you laid out for today is here, in the order you'll live
// it, each marked past, now or ahead, and each holding the things tied to
// it:
//
// - Tasks you planned into the block on the day page (tasks.time_chunk_id),
//   with their sub-tasks under them.
// - What you picked for today on Quests, in the block you tagged with that
//   quest or camp (0085). A camp step goes to a block tagged with its camp,
//   or failing that one tagged with its quest as a whole. A quest line goes
//   to a block tagged with its quest, best one with no camp named, since the
//   line belongs to the quest and not to any one camp.
// - When two blocks share a tag (a morning and an evening on the same
//   quest), the item goes where it can still be done: the block you're in
//   now, else the next one ahead, else the last one of the day. So the
//   evening block lists it while the morning one is behind you.
//
// What fits no block waits at the foot, so nothing on today is lost: the
// planned tasks with no time first, then one group per quest.
//
// Done things stay where they were, struck through, so a tick never makes a
// row jump out from under your thumb. Notes (a line you can't tick) are
// never shown as things to do.
//
// Adding another kind later (deadlines due today, say): turn its rows into
// items of the same shape, say which blocks could take each one, best first
// (`tiers`, a list of tests on a block), and which group at the foot holds
// it when none can (`loose`). Nothing else here needs to change.
//
// Everything in this file is pure, so it can be tested; the card is
// src/components/today/PlanBlocks.jsx and the loading is in api.js.

import { minutesOf } from "./planDates.js";

const DAY_MIN = 24 * 60;

const byPos = (a, b) =>
  (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) || String(a.id).localeCompare(String(b.id));

// The day's blocks in the order you'll live them, each with its minutes
// from midnight (`startMin`, `endMin`) and where it stands against `nowMin`:
// "past", "now" or "ahead". A block that ends at or before it starts (sleep
// from 9:30 PM to 4:30 AM) ends tomorrow, not before it began.
export function blocksOf(chunks, nowMin) {
  return (chunks ?? [])
    .filter((c) => c?.start_time && c?.end_time)
    .map((c) => {
      const startMin = minutesOf(c.start_time);
      let endMin = minutesOf(c.end_time);
      if (endMin <= startMin) endMin += DAY_MIN;
      const state = endMin <= nowMin ? "past" : startMin <= nowMin ? "now" : "ahead";
      return { ...c, startMin, endMin, state, items: [], done: 0, total: 0 };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin || String(a.id).localeCompare(String(b.id)));
}

// Of the blocks that could take something, the one it belongs in: the one
// running now, else the next one ahead, else the last of them. `blocks` are
// in day order, as blocksOf gives them.
export function pickBlock(blocks) {
  return blocks.find((b) => b.state === "now") ?? blocks.find((b) => b.state === "ahead") ?? blocks[blocks.length - 1] ?? null;
}

// The block for something, from its tiers (tests on a block, best first):
// the first tier any block passes decides, and pickBlock chooses among the
// blocks that pass it. Null when none do.
export function placeIn(blocks, tiers) {
  for (const test of tiers) {
    const fits = blocks.filter(test);
    if (fits.length) return pickBlock(fits);
  }
  return null;
}

// Rows as trees: what sits under each row (by `parentKey`), in order. A row
// whose parent isn't here stands on its own.
function forest(rows, parentKey) {
  const seen = new Set();
  const list = [];
  for (const r of rows ?? []) {
    if (!r?.id || seen.has(r.id)) continue;
    seen.add(r.id);
    list.push(r);
  }
  list.sort(byPos);
  const byId = new Map(list.map((r) => [r.id, r]));
  const kids = new Map();
  for (const r of list) {
    const p = r[parentKey];
    if (!p || p === r.id || !byId.has(p)) continue;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(r);
  }
  const tops = list.filter((r) => !(r[parentKey] && r[parentKey] !== r.id && byId.has(r[parentKey])));
  return { byId, kids, tops };
}

// One row as an item, with everything under it. `seen` keeps a loop in the
// data (which the app never makes) from going round forever.
function itemOf(row, kind, kids, seen = new Set()) {
  seen.add(row.id);
  const title = kind === "task" ? row.title : row.text;
  const done = kind === "task" ? Boolean(row.status) : row.done_on != null;
  const subs = (kids.get(row.id) ?? []).filter((k) => !seen.has(k.id)).map((k) => itemOf(k, kind, kids, seen));
  return { kind, id: row.id, title: String(title ?? "").trim() || "Untitled", done, subs };
}

// Every item and everything under it, for counting.
const flat = (items) => items.flatMap((i) => [i, ...flat(i.subs)]);

// How many of these (and everything under them) are done, of how many.
export function tallyItems(items) {
  const all = flat(items ?? []);
  return { done: all.filter((i) => i.done).length, total: all.length };
}

const isNote = (row) => row?.kind === "note";

// What's on today from your quests, as items, in the order Quests shows
// them: each quest in its order, its camps' steps in camp order, then its
// lines (the ones picked from elsewhere before the ones written today).
// Each item carries `from` (the camp's name for a step, the quest's for a
// line), `questId` and, for a step, `campId`.
//
// A step is on today when it was picked for today, or sits in a section
// picked for today (0091) and wasn't finished before today (with everything
// under it). One already shown under another step that's on today shows
// there and not again. A quest line is on today when it was picked for
// today, or written on today's own list (not the ongoing one); its sub-tasks
// come with it, and a sub-task never comes on its own.
//
// `work` is { sections, steps, lines, camps, quests }, as
// fetchTodayQuestWork gives it. Rows it holds that aren't on today (a
// section not picked, a line from another day) are left out here.
export function questItemsForToday(work, date) {
  const { sections = [], steps = [], lines = [], camps = [], quests = [] } = work ?? {};
  const quest = new Map((quests ?? []).map((q) => [q.id, q]));
  const camp = new Map((camps ?? []).map((c) => [c.id, c]));
  const section = new Map((sections ?? []).map((s) => [s.id, s]));
  const picked = new Set((sections ?? []).filter((s) => date && s.today_on === date).map((s) => s.id));
  const questPos = (id) => quest.get(id)?.position ?? Number.MAX_SAFE_INTEGER;
  const out = [];

  // --- camp steps
  const st = forest(
    (steps ?? []).filter((s) => !isNote(s)),
    "parent_id"
  );
  const stillOn = (row, seen = new Set()) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return !row.done_on || row.done_on >= date || (st.kids.get(row.id) ?? []).some((k) => stillOn(k, seen));
  };
  const onToday = (row) =>
    (date && row.today_on === date) || (picked.has(row.section_id) && !(row.parent_id && st.byId.has(row.parent_id)) && stillOn(row));
  const shownAbove = (row) => {
    const seen = new Set([row.id]);
    for (let p = st.byId.get(row.parent_id); p && !seen.has(p.id); p = st.byId.get(p.parent_id)) {
      if (onToday(p)) return true;
      seen.add(p.id);
    }
    return false;
  };
  const stepRows = [...st.byId.values()].filter((row) => onToday(row) && !shownAbove(row));
  // Loose steps first, then the clipboard's, then the sections', as a camp lists them.
  const sectionRank = (row) => {
    const s = section.get(row.section_id);
    if (!s) return [row.section_id ? 2 : 0, 0];
    return [s.clipboard ? 1 : 2, s.position ?? 0];
  };
  for (const row of stepRows) {
    const c = camp.get(row.camp_id);
    const questId = c?.quest_id ?? null;
    const [rank, secPos] = sectionRank(row);
    out.push({
      item: { ...itemOf(row, "step", st.kids), from: c?.title || quest.get(questId)?.title || null, questId, campId: row.camp_id ?? null },
      order: [questPos(questId), 0, c?.position ?? 0, rank, secPos, row.position ?? 0],
      tie: row,
    });
  }

  // --- quest lines
  const ln = forest(
    (lines ?? []).filter((l) => !isNote(l)),
    "parent_id"
  );
  for (const row of ln.tops) {
    if (row.parent_id) continue; // a sub-task whose task isn't on today stays with its task
    const mine = date && row.today_on === date;
    const own = date && row.day === date && !row.ongoing;
    if (!mine && !own) continue;
    const fromElsewhere = mine && (row.ongoing || row.day !== date);
    out.push({
      item: { ...itemOf(row, "line", ln.kids), from: quest.get(row.quest_id)?.title || null, questId: row.quest_id ?? null, campId: null },
      order: [questPos(row.quest_id), 1, fromElsewhere ? 0 : 1, 0, 0, row.position ?? 0],
      tie: row,
    });
  }

  out.sort((a, b) => {
    for (let i = 0; i < a.order.length; i++) if (a.order[i] !== b.order[i]) return a.order[i] - b.order[i];
    return byPos(a.tie, b.tie);
  });
  return out.map((x) => x.item);
}

// The day as the card shows it:
//   { blocks: [{ ...chunk, startMin, endMin, state, items, done, total }],
//     loose: { planned: [items], quests: [{ questId, title, items }] },
//     done, total }
// Each item is { kind: "task" | "line" | "step", id, title, done, subs,
// from?, questId?, campId? }, with `subs` in the same shape.
//
// `chunks` are today's blocks, `tasks` today's planned tasks (fetchTasks),
// `questWork` what fetchTodayQuestWork gives, `nowMin` minutes since
// midnight, `date` today ("YYYY-MM-DD").
export function planForToday({ chunks = [], tasks = [], questWork = null, nowMin = 0, date } = {}) {
  const blocks = blocksOf(chunks, nowMin);

  // Each kind of thing: its items, the blocks that could take each (best
  // first), and the group at the foot that holds it when none can.
  const routed = [];

  // A task tied to a block that isn't on today (the block went, or moved to
  // another day) is still today's, so it waits at the foot rather than
  // vanishing.
  const tk = forest(tasks, "parent_task_id");
  for (const row of tk.tops) {
    const chunkId = row.time_chunk_id ?? null;
    routed.push({ item: itemOf(row, "task", tk.kids), tiers: chunkId ? [(b) => b.id === chunkId] : [], loose: "planned" });
  }

  for (const item of questItemsForToday(questWork, date)) {
    const { questId, campId } = item;
    const tiers =
      item.kind === "step"
        ? [(b) => Boolean(campId) && b.camp_id === campId, (b) => Boolean(questId) && !b.camp_id && b.quest_id === questId]
        : [(b) => Boolean(questId) && !b.camp_id && b.quest_id === questId, (b) => Boolean(questId) && b.quest_id === questId];
    routed.push({ item, tiers, loose: "quest" });
  }

  const planned = [];
  const groups = new Map();
  const questTitle = new Map((questWork?.quests ?? []).map((q) => [q.id, q.title]));
  for (const { item, tiers, loose } of routed) {
    const block = placeIn(blocks, tiers);
    if (block) block.items.push(item);
    else if (loose === "planned") planned.push(item);
    else {
      const key = item.questId ?? null;
      if (!groups.has(key)) groups.set(key, { questId: key, title: (key && questTitle.get(key)) || item.from || "Quest", items: [] });
      groups.get(key).items.push(item);
    }
  }

  for (const b of blocks) Object.assign(b, tallyItems(b.items));
  const quests = [...groups.values()];
  const all = [...blocks.flatMap((b) => b.items), ...planned, ...quests.flatMap((g) => g.items)];
  return { blocks, loose: { planned, quests }, ...tallyItems(all) };
}

// The fields that mark something done or not, as the day page and Quests
// write them: a task's status, or the day a line or step was done (a line
// also keeps the moment). Finishing something means you're no longer
// working on it.
export function doneFields(kind, done, date, nowISO) {
  if (kind === "task") return { status: done, completed_at: done ? nowISO : null };
  if (kind === "line") return done ? { done_on: date, done_at: nowISO, working_since: null } : { done_on: null, done_at: null };
  return done ? { done_on: date, working_since: null } : { done_on: null };
}

// What the card loaded ({ tasks, work }) with one row changed in place, so
// a tick shows before it's saved.
export function withFields(data, kind, id, fields) {
  if (!data) return data;
  const patch = (rows) => (rows ?? []).map((r) => (r.id === id ? { ...r, ...fields } : r));
  if (kind === "task") return { ...data, tasks: patch(data.tasks) };
  const key = kind === "line" ? "lines" : "steps";
  return { ...data, work: data.work ? { ...data.work, [key]: patch(data.work[key]) } : data.work };
}
