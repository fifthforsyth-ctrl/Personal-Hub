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
// Everything here is pure. The paintings are src/village/paint.js, shown on
// the village page (src/pages/Village.jsx); the old survey map, with the
// soldiers, villagers and the replay, is src/village/engine.js.

import { addDays, parseDateStr } from "./planDates.js";
import { tierOf } from "./mark.js";

// What there is to build, smallest first. `need` is how many finished tasks
// it takes to stand (Aaron, 2026-10-23: build it over time from all the
// quests and lessons, not one task per brick). These are the 29 of the
// approved village sketch (https://claude.ai/artifact/5Pw4e13GnTETFHkVthodS5),
// each painted by src/village/paint.js, and each line says what is in its
// painting (Aaron, 2026-10-25: the buildings stay, nothing else lives there).
export const SIZES = [
  { key: "small", label: "Small builds", line: "12 to 24 tasks" },
  { key: "middle", label: "Middle builds", line: "28 to 55 tasks" },
  { key: "big", label: "Big builds", line: "70 to 150 tasks" },
];

export const CATALOG = [
  { kind: "beacon", name: "Signal beacon", size: "small", need: 12, line: "A stone pillar with steps winding up to a lit iron fire basket, a carved hoist for the firewood, a woodstore, and a horn-blower sounding the call." },
  { kind: "liberty", name: "Title of Liberty", size: "small", need: 14, line: "Moroni raises his sword on a stepped stone plinth under his torn coat, written over with the cause of liberty, as the people gather with their shields." },
  { kind: "trainyard", name: "Training yard", size: "small", need: 16, line: "A raked sand ring with soldiers sparring, a tall timber gantry hung with straw bales to strike, straw dummies, an arms shed, and a boy learning to sit a saddle on a carved sawhorse." },
  { kind: "fishracks", name: "Fish racks", size: "small", need: 16, line: "A stone trough heaped with fish beside tall racks of split silver fish, a gutting shed, a net strung between poles and a boat drawn up on rollers." },
  { kind: "watchtower", name: "Watchtower", size: "small", need: 18, line: "A log tower on a stone base with ladders, a watch cabin, the great horn, a wide deck jutting out at the top, fish drying on a rack and a sheep fold at its foot." },
  { kind: "fletcher", name: "Fletcher's hut", size: "small", need: 20, line: "The arrow maker's log hut, with shafts in sheaves, feathers drying on lines, a goose pen and the fletcher at his bench." },
  { kind: "shrine", name: "Prayer shrine", size: "small", need: 20, line: "A small stone shrine under a carved lintel, candles on the altar, the stones of the fallen beside it, and soldiers kneeling for a blessing before they go to war." },
  { kind: "hatchery", name: "Fire ring", size: "small", need: 20, line: "A low ring of stone round a pit of glowing coals with an iron pot hung over the fire, log seats about it, braziers at the way in, a slate-roofed lean-to and a cart of firewood." },
  { kind: "forge", name: "Forge", size: "small", need: 22, line: "An open smithy with a glowing hearth, bellows on a rocking beam, the smith at his anvil, and a soldier proving a new sword on the post." },
  { kind: "archery", name: "Archery range", size: "small", need: 24, line: "Archers at full draw on a covered shooting line, a roped lane out to straw butts, and a tall mast hung with an iron hoop and a swinging target." },
  { kind: "tent", name: "Command tent", size: "middle", need: 28, line: "The striped command pavilion, with the map table under the raised flap, war banners, guards at the door, a signal post and a sand table of the coast with the fleets on it." },
  { kind: "stalls", name: "Quartermaster's stalls", size: "middle", need: 30, line: "Five awninged stalls of salt fish, rope, leather, lamp oil and grain, with shields and spears waiting to be issued and the quartermaster with his ledger." },
  { kind: "storehouse", name: "Storehouse", size: "middle", need: 32, line: "A dark-timbered granary on staddle stones, with sacks hoisted from a cart to its loft and a yard stocked for a siege: barrels, crates and a rack of drying fish." },
  { kind: "healer", name: "Healer's house", size: "middle", need: 36, line: "A stone and timber cottage ringed by raised herb beds and lines of clean linen, where the healer binds a soldier's arm while bearers carry another man in." },
  { kind: "armorer", name: "Armorer", size: "middle", need: 38, line: "The whole armor of God on six stands across a paved court: belt, breastplate, shoes, shield, helmet, and the sword with the Word open beside it." },
  { kind: "armory", name: "Sword armory", size: "middle", need: 40, line: "A stone hall with a turret, a timber upper floor, a slate roof and weapons racked under the awning." },
  { kind: "stables", name: "Stables", size: "middle", need: 42, line: "A long stone stable of four tall-doored stalls under slate cross gables, with a hay hoist, a louvred cupola, a stone water trough, a wagon of hay bales, and a stable hand bringing in the hay." },
  { kind: "flighttower", name: "Round tower", size: "middle", need: 44, line: "A tall round stone tower with three timber platforms jutting out at different heights on heavy brackets, a winch and ladders, a sentry on the long platform, and a lookout under a slate cone." },
  { kind: "windmill", name: "Windmill", size: "middle", need: 45, line: "A stone tower mill with canvas sails, a carved sack hoist on its stage, a bread oven, a field of stooks and the floury miller at his door." },
  { kind: "chapel", name: "Chapel", size: "middle", need: 45, line: "A grey stone chapel with tall arched windows and a bell tower whose bell calls the muster, a churchyard wall, and a lych-gate of carved timber." },
  { kind: "ballista", name: "Ballista tower", size: "middle", need: 48, line: "A square stone tower with a giant crossbow on a turntable on its roof, a hoist lifting bolts up from the yard, and a smith forging bolt heads below." },
  { kind: "barracks", name: "Barracks", size: "middle", need: 50, line: "The stripling warriors' hall, with a round shield hung for every bed. Young soldiers drill with sword and shield in the yard while a boy beats the drum." },
  { kind: "saddlery", name: "Saddlery", size: "middle", need: 55, line: "An open timber workshop with a forge corner and a tall chimney, saddles on their stands, hides laced on frames and drying over a rail, and the saddler at work while a customer waits." },
  { kind: "trebuchet", name: "Trebuchet", size: "big", need: 70, line: "A great oak trebuchet with carved posts, its counterweight raised high, with a windlass, a pile of round shot and a crew at work." },
  { kind: "ring", name: "Training ring", size: "big", need: 75, line: "A sunken stone ring under a dome of iron ribs and chains, with barred stalls and tiered benches, where soldiers spar and a trainer drills the recruits as the crowd looks on." },
  { kind: "gate", name: "Town gate", size: "big", need: 80, line: "A stone gatehouse between two round towers, its portcullis half raised over a drawbridge, with a little toll house where the guard stops a hay cart." },
  { kind: "rampart", name: "Moroni's rampart", size: "big", need: 90, line: "A ridge of heaped earth topped with sharpened pickets and a walkway of soldiers, with three timber towers and a staked ditch in front (Alma 50)." },
  { kind: "warcamp", name: "War camp", size: "big", need: 120, line: "Rows of tents round the striped command pavilion inside a palisade, with a gate between two log towers, cook fires and soldiers at work." },
  { kind: "citadel", name: "Citadel", size: "big", need: 150, line: "The last and greatest build: a stone keep inside battlemented curtain walls, a gate under a carved timber gallery, and four round corner towers crowned with open arcades, a fire basket under each and a sentry on its ledge." },
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
