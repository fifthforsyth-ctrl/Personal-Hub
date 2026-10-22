// The village (supabase/migrations/0080_village_builds.sql): every quest
// builds something, each camp builds one of its parts, and each step ticked
// lays a few bricks. Only the build he picked is kept; how far along it is
// comes from the steps themselves, so the village and the camps can never
// disagree.
//
// Everything here is pure. The drawing itself is src/village/engine.js.

import { addDays, parseDateStr } from "./planDates.js";

// What a quest's size offers when he taps Generate project, smallest first.
// Aaron, 2026-10-22: under 20 steps is a small build, 20 to 79 a middle
// one, 80 or more a big one.
export const BANDS = [
  { under: 20, kinds: ["cottage", "forge", "well", "watchtower"], size: "small" },
  { under: 80, kinds: ["windmill", "farm", "outpost"], size: "middle-sized" },
  { under: Infinity, kinds: ["fortress", "warcamp", "farmstead"], size: "big" },
];

export const KINDS = BANDS.flatMap((b) => b.kinds);

export function bandFor(steps) {
  return BANDS.findIndex((b) => steps < b.under);
}

// "48 steps is a middle-sized quest, so these three fit it."
export function bandLine(steps) {
  const b = BANDS[bandFor(steps)];
  const n = `${steps} ${steps === 1 ? "step" : "steps"}`;
  return b.size === "middle-sized" ? `${n} is a middle-sized quest. These three fit it.` : `${n} is a ${b.size} quest, so it gets a ${b.size} build.`;
}

// Three builds for a quest, the same three every time for the same roll, and
// a different three (or the same kinds in other variations) for each roll of
// Generate again. A band with only three kinds offers all three every time.
export function buildOptions(questId, steps, roll = 0) {
  const band = bandFor(steps);
  const kinds = BANDS[band].kinds;
  const base = hash(questId);
  return [0, 1, 2].map((i) => ({
    kind: kinds[(roll + i) % kinds.length],
    seed: ((base + roll * 17 + i * 5 + band * 3) % 100000) + 1,
  }));
}

function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
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

// Which camps build which part. With as many camps as parts it's one each,
// in order (the plugin's five tabs are the fortress's five parts, left tower
// to right tower). With fewer camps than parts, a camp builds several parts
// next to each other and its steps are shared out among them by size. With
// more camps than parts, neighbouring camps share a part.
//
// `parts` is [{ units }] in build order; `camps` is [{ id, title, steps }]
// in camp order with each camp's steps in order. Returns, for each part,
// { camps: [...ids], title, steps: [...] }.
export function assignCamps(camps, parts) {
  const P = parts.length;
  const C = camps.length;
  const out = parts.map(() => ({ camps: [], title: null, steps: [] }));
  if (!P || !C) return out;
  if (C >= P) {
    for (let j = 0; j < P; j++) {
      const mine = camps.slice(Math.floor((j * C) / P), Math.floor(((j + 1) * C) / P));
      out[j].camps = mine.map((c) => c.id);
      out[j].title = mine.map((c) => c.title).join(" + ");
      out[j].steps = mine.flatMap((c) => c.steps);
    }
    return out;
  }
  for (let i = 0; i < C; i++) {
    const from = Math.floor((i * P) / C);
    const to = Math.floor(((i + 1) * P) / C);
    const span = parts.slice(from, to);
    const units = span.reduce((s, p) => s + p.units, 0) || 1;
    const steps = camps[i].steps;
    let at = 0;
    let acc = 0;
    span.forEach((p, k) => {
      acc += p.units;
      const end = k === span.length - 1 ? steps.length : Math.round((steps.length * acc) / units);
      const o = out[from + k];
      o.camps = [camps[i].id];
      o.title = camps[i].title;
      o.steps = steps.slice(at, end);
      at = end;
    });
  }
  return out;
}

// Days from the village's first day: 0 is `day0`.
export function dayIndex(dateStr, day0) {
  return Math.round((parseDateStr(dateStr) - parseDateStr(day0)) / 86400000);
}

// The village's first day: the first step done or build made, or a week
// before today when nothing's happened yet, so the replay has somewhere to
// start from.
export function firstDay(dates, today) {
  const real = dates.filter((d) => d && d <= today).sort();
  return real.length ? real[0] : addDays(today, -7);
}

const BYPOS = (a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) || String(a.id).localeCompare(String(b.id));

// Everything the drawing needs, from the rows as loaded:
//   quests  [{ id, title, note, goal_id, lesson_id, status }]
//   camps   [{ id, quest_id, title, position }]
//   steps   [{ id, camp_id, section_id, text, done_on, position }]
//   sections [{ id, camp_id, position }] (steps are read in section order)
//   builds  [{ quest_id, kind, seed, plot, created_at }]
//   lessons [{ id, title }]
//   goals   [{ id, title }]
//   bullseyes  the days of every bullseye loosed on The Mark
// `createdDay` turns a build's created_at into the phone's day.
export function villageOf({ quests, camps, steps, sections = [], builds, lessons = [], goals = [], bullseyes = [] }, today, createdDay) {
  const secPos = new Map(sections.map((s) => [s.id, s.position ?? 0]));
  const stepsByCamp = new Map();
  for (const st of steps) {
    if (!stepsByCamp.has(st.camp_id)) stepsByCamp.set(st.camp_id, []);
    stepsByCamp.get(st.camp_id).push(st);
  }
  // Loose steps sit at a camp's top, then each section's in order, as the camp page reads.
  const ordered = (list) =>
    [...list].sort((a, b) => (a.section_id ? 1 : 0) - (b.section_id ? 1 : 0) || (secPos.get(a.section_id) ?? 0) - (secPos.get(b.section_id) ?? 0) || BYPOS(a, b));
  const lessonById = new Map(lessons.map((l) => [l.id, l]));
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const buildByQuest = new Map(builds.map((b) => [b.quest_id, b]));

  const mountains = quests.map((q) => {
    const lesson = q.lesson_id ? lessonById.get(q.lesson_id) : null;
    const own = camps
      .filter((c) => c.quest_id === q.id)
      .sort(BYPOS)
      .map((c) => ({
        id: c.id,
        title: c.title,
        steps: ordered(stepsByCamp.get(c.id) ?? []).map((st) => ({ id: st.id, text: st.text, done_on: st.done_on ?? null })),
      }));
    const total = own.reduce((s, c) => s + c.steps.length, 0);
    return {
      id: q.id,
      name: lesson ? lesson.title : q.title,
      type: lesson ? "Lesson" : "Quest",
      status: q.status,
      note: q.note || null,
      goal: goalById.get(q.goal_id)?.title ?? null,
      camps: own,
      steps: total,
      build: buildByQuest.get(q.id) ?? null,
    };
  });

  const built = mountains
    .filter((m) => m.build)
    .map((m) => ({ ...m, kind: m.build.kind, seed: m.build.seed, plot: m.build.plot, made: createdDay(m.build.created_at) }));
  // Waiting for a build: quests still on, with camps. The ones with steps
  // come first, since only they can be generated yet.
  const waiting = mountains
    .filter((m) => !m.build && m.status === "on" && m.camps.length)
    .sort((a, b) => (b.steps > 0) - (a.steps > 0));

  const dates = [...built.map((b) => b.made), ...built.flatMap((b) => b.camps.flatMap((c) => c.steps.map((s) => s.done_on))), ...bullseyes];
  const day0 = firstDay(dates, today);
  return { today, day0, days: Math.max(1, dayIndex(today, day0)), builds: built, waiting, bullseyes: bullseyes.filter((d) => d <= today).sort(), nextPlot: freePlot(built) };
}

// The label over a building: a short name whole, or a long one's last word
// ("Build the best Premiere Pro plugin" → "Plugin"), unless that word is too
// small to name anything, when it's the first two words instead.
export function shortName(name) {
  const words = String(name).trim().split(/\s+/);
  if (words.length <= 2) return words.join(" ");
  const last = words[words.length - 1];
  if (last.length <= 3 || /\d/.test(last)) return words.slice(0, 2).join(" ");
  return last.charAt(0).toUpperCase() + last.slice(1);
}
