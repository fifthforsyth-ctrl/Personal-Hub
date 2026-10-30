// A quest's Today on Quests as a board (Aaron, 2026-10-28): "organize based
// on camp" into columns, drag Today into his own order like any other list,
// filter it by urgency or colour, and hand things to his computers ("I have
// multiple computers and chats working on the same project"): a column per
// computer, where the top one is what it's working on and the next is on
// deck.
//
// Everything on Today is a card: a step picked on its own (with what's under
// it), a section picked whole (0091), or a line, picked from the ongoing
// list or an earlier day or written on today's own list. Cards keep the
// order he gave them that day (quest_today, 0092); what he hasn't placed
// comes after, in the order Today has always shown it: each camp's picks in
// camp order, then the lines picked from the list, then today's own lines.
//
// Pure, so it can be tested; the board is src/components/quests/TodayBoard.jsx.

import { buildCamp, todayPicks } from "./camp.js";
import { byPos } from "./questTasks.js";

// The two computers a quest starts with.
export const DEFAULT_COMPUTERS = [
  { n: 1, name: "Computer 1" },
  { n: 2, name: "Computer 2" },
];
export const MAX_COMPUTERS = 12;

// A quest's computers (quests.computers), in order, each { n, name }: the
// two it starts with when it has none saved. Anything malformed is skipped.
export function computersOf(raw) {
  if (!Array.isArray(raw)) return DEFAULT_COMPUTERS;
  const seen = new Set();
  const out = [];
  for (const c of raw) {
    const n = Number(c?.n);
    if (!Number.isInteger(n) || n < 1 || n > 99 || seen.has(n)) continue;
    seen.add(n);
    out.push({ n, name: String(c?.name ?? "").trim().slice(0, 40) || `Computer ${n}` });
  }
  return out.slice(0, MAX_COMPUTERS);
}

// The next computer to add: the lowest number not taken, by a computer on
// the list or by anything still handed to a number (`used`: a removal whose
// clearing didn't land, or another device's), so nothing turns up on it.
export function nextComputer(computers, used = []) {
  const taken = new Set([...computers.map((c) => c.n), ...used]);
  let n = 1;
  while (taken.has(n)) n++;
  return { n, name: `Computer ${n}` };
}

const flat = (list) => (list ?? []).flatMap((x) => [x, ...flat(x.subs)]);
const isTask = (x) => (x.kind ?? "task") === "task";

// Everything on a quest's Today as cards, in the order Today has always
// shown it. `own` are today's own lines and `picked` the lines picked from
// elsewhere (both as trees, with `subs`; `picked` with `from`, as
// pickedLines gives them). Each card is
//   { key, kind: "step" | "section" | "line", id, camp, number, computer,
//     finished, actionable, done, total, rows, ... }
// with the step (`item`, its `from` saying where it sits), the section's
// block (`block`, as todayPicks gives it), or the line (`item`, and `own`).
// `rows` is everything on the card, for the filters; `finished` says it's
// done (a section when every step on it is), and `actionable` that it can be
// (a note line can't).
export function todayCards({ camps = [], sections = [], steps = [], own = [], picked = [] } = {}, today) {
  const cards = [];
  [...(camps ?? [])].sort(byPos).forEach((camp, i) => {
    const number = i + 1;
    const view = buildCamp(
      (sections ?? []).filter((s) => s.camp_id === camp.id),
      (steps ?? []).filter((st) => st.camp_id === camp.id)
    );
    for (const b of todayPicks(view, today).blocks) {
      if (b.section) cards.push(sectionCard(b, camp, number));
      else for (const st of b.items) cards.push(stepCard(st, camp, number));
    }
  });
  for (const l of picked ?? []) cards.push(lineCard(l, false));
  for (const l of own ?? []) cards.push(lineCard(l, true));
  return cards;
}

function stepCard(st, camp, number) {
  const rows = flat([st]);
  return {
    key: `step:${st.id}`,
    kind: "step",
    id: st.id,
    camp,
    number,
    item: st,
    computer: st.computer ?? null,
    finished: Boolean(st.done_on),
    actionable: true,
    done: rows.filter((x) => x.done_on).length,
    total: rows.length,
    rows,
  };
}

function sectionCard(b, camp, number) {
  const rows = [b.section, ...flat(b.items)];
  return {
    key: `sec:${b.section.id}`,
    kind: "section",
    id: b.section.id,
    camp,
    number,
    block: b,
    computer: b.section.computer ?? null,
    // every step on it done, today or (none left to show) before
    finished: b.total > 0 ? b.done === b.total : b.earlier > 0,
    actionable: true,
    done: b.done,
    total: b.total,
    rows,
  };
}

function lineCard(l, own) {
  const rows = [l, ...(l.subs ?? [])];
  const tasks = rows.filter(isTask);
  return {
    key: `line:${l.id}`,
    kind: "line",
    id: l.id,
    camp: null,
    number: null,
    own,
    item: l,
    computer: l.computer ?? null,
    finished: isTask(l) && Boolean(l.done_on),
    actionable: isTask(l),
    done: tasks.filter((x) => x.done_on).length,
    total: tasks.length,
    rows,
  };
}

// The cards in the order he gave them (`keys`, from quest_today): the ones
// he placed first, then the rest as they came.
export function orderCards(cards, keys) {
  const at = new Map();
  (keys ?? []).forEach((k, i) => at.has(k) || at.set(k, i));
  const placed = cards.filter((c) => at.has(c.key)).sort((a, b) => at.get(a.key) - at.get(b.key));
  return [...placed, ...cards.filter((c) => !at.has(c.key))];
}

// --- Filters -------------------------------------------------------------------

// { urgency: ["red", ...], color: ["blue", ...] }: a card shows when one row
// on it has one of the urgencies and one of the colours asked for (either
// left empty asks nothing of it). A line of notes is never urgent. With
// `shade` (lib/camp shades().of), a camp's step goes by the colour it shows,
// its section's when it has none of its own; a quest line by its own.
export const NO_FILTER = { urgency: [], color: [] };

export function filterOn(filter) {
  return Boolean(filter?.urgency?.length || filter?.color?.length);
}

export function matchesFilter(card, filter, shade = null) {
  const u = filter?.urgency ?? [];
  const c = filter?.color ?? [];
  if (!u.length && !c.length) return true;
  const colorOf = shade && card.kind !== "line" ? shade : (r) => r.color;
  return card.rows.some((r) => (!u.length || (r.urgency && r.kind !== "note" && u.includes(r.urgency))) && (!c.length || c.includes(colorOf(r))));
}

// --- Columns -------------------------------------------------------------------

// By camp: a column per camp with something on Today, in camp order, then
// one for the quest's own list. Each { key, camp, number, cards, done, total }.
export function campColumns(cards) {
  const cols = new Map();
  for (const c of cards) {
    const key = c.camp ? `camp:${c.camp.id}` : "list";
    if (!cols.has(key)) cols.set(key, { key, camp: c.camp ?? null, number: c.number ?? null, cards: [], done: 0, total: 0 });
    const col = cols.get(key);
    col.cards.push(c);
    col.done += c.done;
    col.total += c.total;
  }
  return [...cols.values()].sort((a, b) => (a.camp ? a.number : 1e9) - (b.camp ? b.number : 1e9));
}

// By computer: what's no one's yet, then a column per computer. In each,
// `open` are the cards still to do, in order, and `finished` the ones done,
// which sink to the foot. In a computer's column the first card that can be
// done is what it's working on (`working`, its key) and the next is on deck
// (`deck`). A card handed to a computer that's gone is no one's.
export function computerColumns(cards, computers) {
  const known = new Set((computers ?? []).map((c) => c.n));
  const cols = [{ key: "none", n: null, name: "Not assigned", cards: [] }, ...(computers ?? []).map((c) => ({ key: `pc:${c.n}`, n: c.n, name: c.name, cards: [] }))];
  const byN = new Map(cols.map((col) => [col.n, col]));
  for (const card of cards) byN.get(known.has(card.computer) ? card.computer : null).cards.push(card);
  for (const col of cols) {
    col.open = col.cards.filter((c) => !c.finished);
    col.finished = col.cards.filter((c) => c.finished);
    const live = col.n == null ? [] : col.open.filter((c) => c.actionable);
    col.working = live[0]?.key ?? null;
    col.deck = live[1]?.key ?? null;
  }
  return cols;
}

// --- Moving --------------------------------------------------------------------

// `order` (every card's key, in order) after the cards in `shown` were
// dragged into the order `next`: they take the same places between them,
// so anything filtered out of sight, or in another column, stays put.
export function reorderShown(order, shown, next) {
  const on = new Set(shown);
  const queue = [...next];
  return order.map((k) => (on.has(k) ? queue.shift() : k));
}

// `order` with `key` moved into another column: just before `beforeKey`, or
// (none) just after the last of `column` (that column's keys); into an empty
// column it keeps its place.
export function moveKey(order, key, beforeKey, column = []) {
  const rest = order.filter((k) => k !== key);
  if (beforeKey && rest.includes(beforeKey)) {
    rest.splice(rest.indexOf(beforeKey), 0, key);
    return rest;
  }
  const last = column.filter((k) => k !== key && rest.includes(k)).at(-1);
  if (!last) return order.includes(key) ? order : [...order, key];
  rest.splice(rest.indexOf(last) + 1, 0, key);
  return rest;
}

// Where a card's rows are kept, for writing its computer: { table, id }.
export function rowOf(card) {
  return { table: card.kind === "section" ? "camp_sections" : card.kind === "step" ? "camp_steps" : "quest_tasks", id: card.id };
}
