// The village (supabase/migrations/0081_quest_tasks_village_projects.sql):
// he chooses what to build from a catalog, and every task or camp step he
// finishes, from any quest or lesson, lays the next bricks on it until it
// stands. Then he chooses the next. Arrows loosed on The Mark train the
// soldiers, his bullseyes upgrade their bows, and everyone he has done
// temple work for lives there.
//
// Only the choice of build is kept. Which tasks went into which build is
// worked out here from the tasks in the order they were done, so the
// village and the lists can never disagree, and unticking a task takes its
// bricks back off.
//
// Everything here is pure. The drawing itself is src/village/engine.js.

import { addDays, parseDateStr } from "./planDates.js";
import { tierOf } from "./mark.js";

// What there is to build, smallest first. `need` is how many finished tasks
// it takes to stand (Aaron, 2026-10-23: build it over time from all the
// quests and lessons, not one task per brick).
export const SIZES = [
  { key: "small", label: "Small builds", line: "A few days of work" },
  { key: "middle", label: "Middle builds", line: "A week or two" },
  { key: "big", label: "Big builds", line: "A long campaign" },
];

export const CATALOG = [
  { kind: "well", name: "Well", size: "small", need: 12, line: "A stone well with a little roof." },
  { kind: "garden", name: "Kitchen garden", size: "small", need: 14, line: "Raised beds, a fence and a scarecrow." },
  { kind: "apiary", name: "Apiary", size: "small", need: 15, line: "Beehive skeps on benches, with flowers all round." },
  { kind: "watchtower", name: "Watchtower", size: "small", need: 18, line: "A timber lookout on a stone footing." },
  { kind: "cottage", name: "Cottage", size: "small", need: 20, line: "Whitewashed walls, a steep roof and a garden." },
  { kind: "forge", name: "Forge", size: "small", need: 22, line: "A stone smithy with a tall chimney and an anvil." },
  { kind: "outpost", name: "Outpost", size: "middle", need: 30, line: "A watchtower inside a palisade, with a signal fire." },
  { kind: "range", name: "Archery range", size: "middle", need: 32, line: "Straw targets, a shooting line and a shelter for the bows." },
  { kind: "storehouse", name: "Storehouse", size: "middle", need: 35, line: "Stone walls, a loading door, barrels and sacks." },
  { kind: "armory", name: "Sword armory", size: "middle", need: 40, line: "A stone armory, racks of swords and a crossed-sword banner." },
  { kind: "farm", name: "Farm", size: "middle", need: 40, line: "A barn, a fenced pasture, a small flock and hay." },
  { kind: "stable", name: "Stable", size: "middle", need: 42, line: "A timber stable, a paddock and horses." },
  { kind: "windmill", name: "Windmill", size: "middle", need: 45, line: "A stone mill. Its sails turn once it stands." },
  { kind: "chapel", name: "Chapel", size: "middle", need: 45, line: "Whitewashed walls, tall windows and a steeple." },
  { kind: "school", name: "Schoolhouse", size: "middle", need: 48, line: "A schoolroom with a bell tower and a reading bench." },
  { kind: "barracks", name: "Barracks", size: "middle", need: 50, line: "A long hall for the soldiers, with a drill yard." },
  { kind: "gate", name: "Town gate", size: "big", need: 80, line: "Twin stone towers, a gate and a stretch of wall." },
  { kind: "farmstead", name: "Frontier farmstead", size: "big", need: 100, line: "A barn, a stone silo, six fields and a flock." },
  { kind: "warcamp", name: "War camp", size: "big", need: 120, line: "A palisade, two watchtowers and a ring of tents." },
  { kind: "fortress", name: "Stone fortress", size: "big", need: 150, line: "Towers, curtain walls and a keep. Built to hold." },
];

const BY_KIND = new Map(CATALOG.map((c) => [c.kind, c]));

export function buildOf(kind) {
  return BY_KIND.get(kind) ?? { kind, name: "Build", size: "middle", need: 40, line: "" };
}

// A fresh variation of a build: the same three every time for the same
// roll, and new ones for each "Another look".
export function seedFor(kind, roll = 0) {
  return ((hash(kind) + roll * 7919) % 100000) + 1;
}

function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

// Every 5 arrows loosed trains a soldier. Their bows are the one he holds on
// The Mark (a bow of wood, then a longbow at 30 bullseyes, a recurve at 90
// and a bow of steel at 180).
export const ARROWS_PER_SOLDIER = 5;

export function soldiersFor(arrows) {
  return Math.floor(arrows / ARROWS_PER_SOLDIER);
}

export function bowFor(bullseyes) {
  return tierOf(bullseyes);
}

// Plots go out around the plaza in this order: the four beside it first,
// then the ring around those. The diagonals of the first ring are woods, an
// orchard, a pond and a meadow from the start. Past the second ring, each
// new ring is handed out a side at a time, with every third plot left to
// nature so the village keeps some green as it grows.
const FIRST = [
  [0, -1], [-1, 0], [1, 0], [0, 1],
  [-2, 0], [2, 0], [0, 2], [0, -2], [-2, -1], [2, 1], [-1, 2], [2, -1], [1, -2], [2, 2], [-2, -2], [-2, 2],
];
export const NATURE_START = [
  { tile: [-1, -1], kind: "forest" },
  { tile: [1, -1], kind: "orchard" },
  { tile: [-1, 1], kind: "pond" },
  { tile: [1, 1], kind: "meadow" },
];
// The second ring's green, each arriving with the build on the plot named.
const NATURE_RING2 = [
  { tile: [-2, 1], kind: "forest", withPlot: 4 },
  { tile: [1, 2], kind: "pond", withPlot: 6 },
  { tile: [-1, -2], kind: "forest", withPlot: 9 },
  { tile: [2, -2], kind: "meadow", withPlot: 12 },
];
const NATURE_KINDS = ["forest", "meadow", "orchard", "pond"];

function ring(r) {
  const out = [];
  for (let x = -r; x < r; x++) out.push([x, -r]);
  for (let z = -r; z < r; z++) out.push([r, z]);
  for (let x = r; x > -r; x--) out.push([x, r]);
  for (let z = r; z > -r; z--) out.push([-r, z]);
  return out;
}

// Every plot from the plaza out, far enough to hold `count` builds: each is
// { tile, plot } for a build's plot or { tile, nature, withPlot } for green.
export function layout(count) {
  const plots = FIRST.slice(0, count).map((tile, plot) => ({ tile, plot }));
  const nature = NATURE_RING2.filter((n) => n.withPlot < count).map((n) => ({ tile: n.tile, nature: n.kind, withPlot: n.withPlot }));
  let next = FIRST.length;
  for (let r = 3; next < count; r++) {
    ring(r).forEach((tile, i) => {
      if (i % 3 === 2) {
        if (next - 1 < count) nature.push({ tile, nature: NATURE_KINDS[(r + i) % NATURE_KINDS.length], withPlot: next - 1 });
      } else if (next < count) plots.push({ tile, plot: next++ });
    });
  }
  return { plots, nature };
}

export function tileOf(plot) {
  return layout(plot + 1).plots[plot].tile;
}

// The first plot nobody has built on.
export function freePlot(builds) {
  const used = new Set(builds.map((b) => b.plot));
  let p = 0;
  while (used.has(p)) p++;
  return p;
}

// Days from the village's first day: 0 is `day0`.
export function dayIndex(dateStr, day0) {
  return Math.round((parseDateStr(dateStr) - parseDateStr(day0)) / 86400000);
}

// The village's first day: the first thing that happened, or a week before
// today when nothing has yet, so the replay has somewhere to start from.
export function firstDay(dates, today) {
  const real = dates.filter((d) => d && d <= today).sort();
  return real.length ? real[0] : addDays(today, -7);
}

const later = (a, b) => (a > b ? a : b);

// Everything finished that lays bricks, in the order it was finished: quest
// tasks and sub-tasks (not note lines) and camp steps, each
//   { id, src, text, note, questId, day, at }
// `quests` names each task's quest, `camps` each step's.
export function finishedUnits({ tasks = [], steps = [], camps = [] }) {
  const campQuest = new Map(camps.map((c) => [c.id, c.quest_id]));
  const out = [];
  for (const t of tasks) {
    if (!t.done_on || (t.kind && t.kind !== "task")) continue;
    out.push({ id: t.id, src: "task", text: t.text, note: t.note ?? null, questId: t.quest_id, day: t.done_on, at: t.done_at ?? t.updated_at ?? "" });
  }
  for (const s of steps) {
    if (!s.done_on) continue;
    out.push({ id: s.id, src: "step", text: s.text, note: s.note ?? null, questId: campQuest.get(s.camp_id) ?? null, day: s.done_on, at: s.updated_at ?? "" });
  }
  return out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0) || String(a.at).localeCompare(String(b.at)) || String(a.id).localeCompare(String(b.id)));
}

const byStart = (a, b) =>
  (a.started_on < b.started_on ? -1 : a.started_on > b.started_on ? 1 : 0) ||
  String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) ||
  String(a.id).localeCompare(String(b.id));

// Hands the finished units to the builds in the order he chose them: the
// first build takes the first `need`, the next build the next, and so on.
// A unit finished while nothing was being built waits, and lands on the day
// the next build is chosen. Each build gets
//   { ...project, items: [{ ...unit, laid }], done, complete, finishedOn }
// where `laid` is the day that unit's bricks went down. `current` is the
// build still going up (or -1), `waiting` the units nothing has taken yet.
export function allocate(projects, units) {
  let at = 0;
  const out = [...projects].sort(byStart).map((p) => {
    const mine = units.slice(at, at + p.need).map((u) => ({ ...u, laid: later(u.day, p.started_on) }));
    at += mine.length;
    const complete = mine.length >= p.need;
    return { ...p, items: mine, done: mine.length, complete, finishedOn: complete ? mine[mine.length - 1].laid : null };
  });
  return { projects: out, current: out.findIndex((p) => !p.complete), waiting: units.slice(at) };
}

// The people he has done temple work for, each arriving on the day of the
// first ordinance done for them: { pid, name, gender, lifespan, first, temple }.
export function villagersOf(done = []) {
  return done
    .map((p) => {
      const ords = (Array.isArray(p.ordinances) ? p.ordinances : []).filter((o) => o && o.date).sort((a, b) => (a.date < b.date ? -1 : 1));
      return { pid: p.pid, name: p.name, gender: p.gender ?? null, lifespan: p.lifespan ?? null, first: ords[0]?.date ?? null, temple: ords[0]?.temple ?? null };
    })
    .sort((a, b) => String(a.first ?? "9999").localeCompare(String(b.first ?? "9999")) || String(a.name).localeCompare(String(b.name)));
}

// Everything the drawing needs, from the rows as loaded:
//   projects  [{ id, kind, seed, plot, need, started_on, created_at }]
//   tasks     finished quest tasks [{ id, quest_id, kind, text, note, done_on, done_at }]
//   steps     finished camp steps [{ id, camp_id, text, note, done_on, updated_at }]
//   camps     [{ id, quest_id }]
//   quests    [{ id, title, lesson_id }]  lessons [{ id, title }]
//   shots     arrows loosed on The Mark [{ date, level }] (level 0 is a bullseye)
//   temple    temple_done rows
export function villageOf({ projects = [], tasks = [], steps = [], camps = [], quests = [], lessons = [], shots = [], temple = [] }, today) {
  const lessonName = new Map(lessons.map((l) => [l.id, l.title]));
  const questName = new Map(quests.map((q) => [q.id, q.lesson_id && lessonName.has(q.lesson_id) ? lessonName.get(q.lesson_id) : q.title]));
  const units = finishedUnits({ tasks, steps, camps }).filter((u) => u.day <= today);
  const { projects: built, current, waiting } = allocate(
    projects.filter((p) => p.started_on <= today),
    units
  );
  const arrows = shots.filter((s) => s.date && s.date <= today).map((s) => s.date).sort();
  const bullseyes = shots.filter((s) => s.date && s.date <= today && s.level === 0).map((s) => s.date).sort();
  const dates = [...built.map((p) => p.started_on), ...built.flatMap((p) => p.items.map((i) => i.laid)), ...arrows];
  const day0 = firstDay(dates, today);
  const villagers = villagersOf(temple).map((v) => ({ ...v, arrive: v.first && v.first > day0 ? v.first : day0 }));
  return {
    today,
    day0,
    days: Math.max(1, dayIndex(today, day0)),
    projects: built.map((p) => {
      const b = buildOf(p.kind);
      return {
        id: p.id,
        kind: p.kind,
        name: b.name,
        line: b.line,
        seed: p.seed,
        plot: p.plot,
        need: p.need,
        start: p.started_on,
        done: p.done,
        complete: p.complete,
        finishedOn: p.finishedOn,
        items: p.items.map((i) => ({ ...i, quest: questName.get(i.questId) ?? null })),
      };
    }),
    current,
    waiting: waiting.length,
    nextPlot: freePlot(built),
    arrows,
    bullseyes,
    villagers,
  };
}

// Where the build going up stands, for the top of every quest's list:
// { project, done, need, left, today, waiting } or null when nothing is
// being built (then `waiting` is how many finished tasks wait for one).
export function standingOf(projects, units, today) {
  const { projects: built, current, waiting } = allocate(
    projects.filter((p) => p.started_on <= today),
    units.filter((u) => u.day <= today)
  );
  if (current < 0) return { project: null, waiting: waiting.length, standing: built.filter((p) => p.complete).length, last: built[built.length - 1] ?? null };
  const p = built[current];
  return {
    project: p,
    done: p.done,
    need: p.need,
    left: p.need - p.done,
    today: p.items.filter((i) => i.laid === today).length,
    waiting: 0,
    standing: built.filter((x) => x.complete).length,
  };
}

// The label over a building or a quest's tab: a short name whole, or a long
// one's last word ("Build the best Premiere Pro plugin" → "Plugin"), unless
// that word is too small to name anything, when it's the first two words.
export function shortName(name) {
  const words = String(name).trim().split(/\s+/);
  if (words.length <= 2) return words.join(" ");
  const last = words[words.length - 1];
  if (last.length <= 3 || /\d/.test(last)) return words.slice(0, 2).join(" ");
  return last.charAt(0).toUpperCase() + last.slice(1);
}
