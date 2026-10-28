// The 3D village's plan and its arithmetic, kept pure so it can be tested
// (scripts/test.mjs): where every plot sits on the coast and which way its
// build faces, the lanes from each plot to the plaza, how far the town
// reaches; how far along each build stands on any day of the replay; where
// the soldiers drill and the villagers stand; which labels fit on the
// screen; and what a /village link asks for.
//
// The plots are the coast's pads (src/village/coast.js sites()), in the
// order the town takes them: nearest the plaza first, spiralling out over
// the valley between the two rivers, each pad's front to the plaza.

import { bowFor, dayIndex, soldiersFor } from "../lib/village.js";
import { PAD, PLAZA as PLAZA_RECT, PLAZA_LEVEL, doorOf, routeOf, siteOf } from "./coast.js";

// A plot's side, in metres: its levelled pad.
export const TILE = PAD;
// The plaza's side, in metres: paved, with the flag in the middle.
export const PLAZA = PLAZA_RECT.w;
// The least room between a build and its pad's edge.
export const MARGIN = 1.6;
// How many soldiers and villagers are drawn at most (the sheets give the full counts).
export const MAX_SOLDIERS = 40;
export const MAX_VILLAGERS = 40;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ------------------------------------------------------------------ the plan

// The way a build's front (its +z) looks for a turn about +y: [x, z].
export function frontOf(ry) {
  return [Math.sin(ry), Math.cos(ry)];
}

// How much smaller a build has to stand so it keeps MARGIN to its pad's
// edge: 1 for every build that fits. `reach` is the farthest the build goes
// from its own centre along x or z, in metres.
export function scaleFor(reach, tile = TILE) {
  const room = tile / 2 - MARGIN;
  return reach > room ? room / reach : 1;
}

const at = (plot) => {
  const s = siteOf(plot);
  return { x: s.x, z: s.z, y: s.y, ry: s.ry, site: s };
};

// Everything that stands on the ground: a plot for every build (by its
// stored plot) and the next plot staked out. `village` is villageOf()'s.
export function planOf(village) {
  const projects = village?.projects ?? [];
  const next = village?.nextPlot ?? 0;
  const plots = projects.map((p) => ({ id: p.id, kind: p.kind, plot: p.plot, ...at(p.plot) }));
  const stake = { plot: next, ...at(next) };
  return { plots, stake, radius: townRadius([...plots, stake]), tile: TILE, plaza: { ...PLAZA_RECT, y: PLAZA_LEVEL } };
}

// How far the town reaches from the plaza: every plot in use and the next one, with room round them.
export function townRadius(plots) {
  let r = PLAZA * 0.71;
  for (const p of plots) r = Math.max(r, Math.hypot(p.x, p.z));
  return r + TILE * 0.62;
}

// The lane from each plot's front to the plaza, in metres: out of the
// build's door (`front(p)` metres from its centre, along its front), across
// its pad, then the town's lane for that plot (coast.js routeOf), which
// runs round every other pad and joins the lanes before it.
export function pathsOf(plan, front = () => TILE * 0.3) {
  const out = [];
  for (const p of [...plan.plots, plan.stake]) {
    const [fx, fz] = frontOf(p.ry);
    const f = Math.min(front(p), TILE / 2);
    const pts = [[p.x + fx * f, p.z + fz * f], doorOf(p.site, 0), ...routeOf(p.plot)];
    const metres = [];
    for (const m of pts) {
      const last = metres[metres.length - 1];
      if (!last || Math.hypot(last[0] - m[0], last[1] - m[1]) > 0.01) metres.push(m);
    }
    out.push({ plot: p.plot, points: metres });
  }
  return out;
}

// ------------------------------------------------------------------ progress

// The kit's step count for `done` of `need` tasks, as the painted stills show
// it (src/village/paint.js): everything once it stands (its people too), and
// the steps laid today counted back from there. `frac` is what the kit's
// show() takes.
export function stageOf(units, done, need, laid) {
  const shown = done >= need ? units + 1 : Math.floor((units * done) / need);
  const today = laid > 0 ? shown - Math.floor((units * Math.max(0, done - laid)) / need) : 0;
  const frac = shown > units ? 1 : (shown + 0.5) / units;
  return { shown, today, frac };
}

// The replay's last day: today, counted from the village's first day.
export function spanOf(village) {
  return village ? Math.max(0, dayIndex(village.today, village.day0)) : 0;
}

// A date's day in the replay (null, or anything after today, is today).
export function dayOf(date, village) {
  const span = spanOf(village);
  return date ? clamp(dayIndex(date, village.day0), 0, span) : span;
}

// The village as it stood at the end of day `d` (spanOf() is today): every
// build's tasks laid by then and on that day, the one going up, the soldiers,
// their bows and the villagers.
export function stateOn(village, d) {
  const builds = village.projects.map((p) => {
    const exists = dayOf(p.start, village) <= d;
    let done = 0;
    let laid = 0;
    for (const it of p.items) {
      const k = dayOf(it.laid, village);
      if (k <= d) done++;
      if (k === d) laid++;
    }
    done = exists ? Math.min(done, p.need) : 0;
    laid = exists ? Math.min(laid, done) : 0;
    return { id: p.id, exists, done, laid, need: p.need, complete: exists && done >= p.need };
  });
  const going = builds.find((b) => b.exists && !b.complete) ?? null;
  const upTo = (dates) => dates.filter((x) => dayOf(x, village) <= d).length;
  return {
    day: d,
    builds,
    going: going ? going.id : null,
    soldiers: soldiersFor(upTo(village.arrows)),
    tier: bowFor(upTo(village.bullseyes)),
    villagers: village.villagers.filter((v) => dayOf(v.arrive, village) <= d).length,
  };
}

// How long playing the replay takes, first day to today, as the old map did.
export function playSecs(span) {
  return clamp(span / 3, 4, 30);
}

// ------------------------------------------------------------------ people

// A seeded random number, the same every time for the same seed.
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The soldiers the arrows train, drawn up in the plaza in front of the flag,
// facing the way the village is first seen from: archers drawing in the front
// rank, archers and swordsmen standing guard behind.
export function formationOf(n, tier = 0) {
  const shown = Math.min(n, MAX_SOLDIERS);
  const cols = 10;
  const out = [];
  for (let i = 0; i < shown; i++) {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, shown - row * cols);
    const col = i % cols;
    const x = (col - (inRow - 1) / 2) * 1.55;
    const z = 3 + row * 1.85;
    const sword = row > 0 && col % 4 === 1;
    out.push({ x, z, ry: 0, role: sword ? "soldier" : "archer", pose: row === 0 ? "draw" : sword ? "guard" : "spear", tier });
  }
  return out;
}

const POSES = ["talk", "walk", "carry", "point", "walk", "talk"];

// Where the villagers stand: along the paths (a step to the side, walking
// their way or talking in twos) and in the plaza behind the flag. Each has a
// pose and a turn; a child now and then. Only the first MAX_VILLAGERS.
export function spotsOf(paths, villagers, seed = 5) {
  const r = rng(seed);
  const n = Math.min(villagers.length, MAX_VILLAGERS);
  const segs = [];
  for (const p of paths)
    for (let i = 0; i < p.points.length - 1; i++) {
      const [ax, az] = p.points[i];
      const [bx, bz] = p.points[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len > 4) segs.push({ ax, az, bx, bz, len });
    }
  const total = segs.reduce((a, s) => a + s.len, 0);
  const out = [];
  for (let i = 0; i < n; i++) {
    const v = villagers[i];
    const child = i % 9 === 8;
    const inPlaza = !segs.length || i % 4 === 3;
    let x;
    let z;
    let ry;
    if (inPlaza) {
      // in the plaza's back half, clear of the flag and the soldiers in front
      const a = r() * Math.PI - Math.PI;
      const d = 4 + r() * 6;
      x = Math.cos(a) * d;
      z = Math.sin(a) * d * 0.8 - 1;
      ry = Math.atan2(-x, -z) + (r() - 0.5) * 1.2;
    } else {
      let k = r() * total;
      let s = segs[0];
      for (const sg of segs) {
        s = sg;
        if (k <= sg.len) break;
        k -= sg.len;
      }
      const t = clamp(k / s.len, 0.08, 0.92);
      const dx = (s.bx - s.ax) / s.len;
      const dz = (s.bz - s.az) / s.len;
      const side = r() < 0.5 ? -1 : 1;
      x = s.ax + (s.bx - s.ax) * t - dz * side * 1.25;
      z = s.az + (s.bz - s.az) * t + dx * side * 1.25;
      const along = Math.atan2(dx, dz) + (r() < 0.5 ? 0 : Math.PI);
      ry = along + (r() - 0.5) * 0.5;
    }
    const pose = child ? "run" : POSES[Math.floor(r() * POSES.length)];
    out.push({ x, z, ry, role: child ? "child" : "villager", pose, gender: v?.gender ?? null, seed: Math.floor(r() * 1e6) });
  }
  return out;
}

// ------------------------------------------------------------------ labels

// Which labels show: each { id, x, y (its anchor, bottom centre, CSS px),
// w, h, prio (lower first), on (false: behind the camera) }. A label shows when
// it is all inside `rect` ({ left, top, right, bottom }) and clear of every
// label placed before it and of every one of `blocks` ({ l, r, t, b }: what
// must stay in sight, the soldiers say).
export function placeLabels(list, rect, gap = 4, blocks = []) {
  const shown = new Set();
  const placed = [...blocks];
  for (const l of [...list].sort((a, b) => a.prio - b.prio)) {
    if (l.on === false) continue;
    const box = { l: l.x - l.w / 2, r: l.x + l.w / 2, t: l.y - l.h, b: l.y };
    if (box.l < rect.left || box.r > rect.right || box.t < rect.top || box.b > rect.bottom) continue;
    if (placed.some((p) => box.l < p.r + gap && box.r > p.l - gap && box.t < p.b + gap && box.b > p.t - gap)) continue;
    placed.push(box);
    shown.add(l.id);
  }
  return shown;
}

// ------------------------------------------------------------------ links

// What /village?... asks for: a build to fly to and open (?build=<id>), or
// Choose (?choose), pointed at one build (?choose=<kind>).
export function linkOf(search) {
  const q = new URLSearchParams(search ?? "");
  const build = q.get("build") || null;
  const choose = q.has("choose") ? q.get("choose") || true : null;
  return { build, choose };
}
