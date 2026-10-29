// The village's rivers and waterfalls: the two rivers of ./coast.js as water
// that runs from their springs in the hills, down the beds cut for them, to
// the cliffs, where each pours over the lip into the sea.
//
// Drawn every frame in the stage's moving layer over the still picture of the
// land (Glade.shared). Each river seeps out of a round hollow at its spring,
// then runs in pools and drops: long glassy pools and pale riffles in the
// meadows, little steps of white water where it comes down the hills (a thin
// film over the stones where its bed is only a crack). Its edge is found on the
// ground as the terrain draws it, so the water fills its bed and no more,
// wandering in bays, and the bank is dark and wet for a metre past it. The river reads the picture's
// depth to know how deep it stands over its bed: clear over the stones at its
// edges, a fresh green in the pools. Ripples run downstream; the sky and its
// clouds show in it and the sun glints on it. At each cliff the glassy water
// curls over the lip into a sheet of white that falls clear of the face in
// streaks, lacy at its edges, into a boil of foam on the sea, rings spreading
// from it and a milky plume drifting out, with a veil of spray over it all.
//
//   const rivers = makeRivers(stage, { height })   ->  { group, update(t), dispose() }   (the group is in the moving layer)
//     height(x, z): the ground the terrain is drawn from (coast.js naturalAt unless given; pads never reach the rivers)
//   riverShapes(height)   ->  { ribbons, falls, H }   the shapes alone, no three.js objects (for checks; H is the ground they sit on)
//   meshGround(height)    ->  (x, z) => the ground as the terrain's mesh draws it
//
// Everything moves in its shaders on a clock that wraps every WRAP seconds (each
// motion makes whole cycles in it, so the wrap never shows and a page left open
// for days never loses precision), so update() has nothing to do. Four draw
// calls: the rivers, the falls, the foam pools, the spray.

import * as THREE from "three";
import { RIVERS, naturalAt, smooth } from "./coast.js";
import { noiseTexture } from "./glade.js";
import { tileStep } from "./terrain.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
const v3 = (hex) => {
  const c = lin(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
};

// Fresh water: greener and brighter than the sea (water.js SEA_LOOK), milky where the falls churn it.
export const RIVER_LOOK = {
  shallow: "#a6dcc2",
  deep: "#4ea897",
  glassy: "#5fae9f",
  foam: "#f7f8f3",
  milk: "#b9e6dc",
  skyLow: "#dfe9ee",
  skyHigh: "#8fb4dc",
};

// How far past its bed's edge the water may reach.
const MARGIN = 2.4;
// How far up the bank, past the water's edge, the ground is wet.
const WET = 1.4;
// How far the ribbon's banks stand over the ground (a polygon offset does the rest), so the ground never shows through.
const LIFT = 0.07;
// How thick the film of water is where a hill stream runs over stones rather than in a pool of its own.
const FILM = 0.12;
// How far the surface sinks as it speeds up toward the lip.
const DRAWDOWN = 0.3;
const GRAVITY = 9.8;
// Each pool-and-drop: this much of it is the pool, the rest the drop.
const FP = 0.68;
// The rows of the ribbon are never further apart than this (m); closer at the spring and the brink.
const ROW_GAP = 1.5;
// The step the banks are read at, across the river.
const SCAN = 0.15;
// The water's clock wraps after this many seconds: every motion below is a whole number of cycles in it.
const WRAP = 600;
// A speed in cycles a second, and one in radians a second, rounded to whole cycles in WRAP (as shader literals).
const cyc = (v) => (Math.round(v * WRAP) / WRAP).toFixed(6);
const ang = (w) => ((Math.round((w * WRAP) / (2 * Math.PI)) * 2 * Math.PI) / WRAP).toFixed(6);

// ------------------------------------------------------------------ the ground as drawn

// the grid terrain.js draws the land on at (x, z)
const gridAt = tileStep;

// The ground as the terrain's mesh draws it: heights on its grid (fine near the
// town, coarser in the hills), each square split along the diagonal terrain.js
// picks, so the water fits what is seen.
export function meshGround(height = naturalAt) {
  const cache = new Map();
  const at = (x, z) => {
    const k = x * 100003 + z;
    let h = cache.get(k);
    if (h === undefined) cache.set(k, (h = height(x, z)));
    return h;
  };
  return (x, z) => {
    const g = gridAt(x, z);
    const fx = x / g;
    const fz = z / g;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const a = at(i * g, j * g);
    const b = at((i + 1) * g, j * g);
    const c = at(i * g, (j + 1) * g);
    const d = at((i + 1) * g, (j + 1) * g);
    if (Math.abs(a - d) < Math.abs(b - c)) return u >= v ? a + (b - a) * u + (d - b) * v : a + (c - a) * v + (d - c) * u;
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  };
}

// ------------------------------------------------------------------ the shapes

// How fast the water runs (m/s) down a slope (metres down for each metre along).
const speedOf = (grade) => clamp(0.55 + grade * 9, 0.55, 4.5);

// Where a river's bed falls away at the cliff: how far along the fall's
// direction from its point (negative is upstream), found under the middle.
function lipOf(rv, H) {
  const f = rv.fall;
  for (let d = -16; d <= 4; d += 0.05) if (H(f.x + f.dx * d, f.z + f.dz * d) < f.top - 1.9) return d - 0.05;
  return 0;
}

// The river's line from a little way back past its spring to the lip: points
// { x, z, s, level, w, g (the grade over a couple of dozen metres) } and a
// reader for any s along it.
function lineOf(rv, H) {
  const f = rv.fall;
  const lipD = lipOf(rv, H);
  const pts = [];
  for (const p of rv.samples) {
    if ((p.x - f.x) * f.dx + (p.z - f.z) * f.dz > lipD - 0.4) break;
    pts.push({ x: p.x, z: p.z, s: p.s, level: p.level, w: p.w });
  }
  const last = pts[pts.length - 1];
  const lx = f.x + f.dx * lipD;
  const lz = f.z + f.dz * lipD;
  const lipS = last.s + Math.hypot(lx - last.x, lz - last.z);
  pts.push({ x: lx, z: lz, s: lipS, level: f.top, w: f.w });
  // past the spring: its bed ends there in a round hollow
  const p0 = pts[0];
  const p1 = pts[1];
  const L0 = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  const back = p0.w / 2 + 2.5;
  pts.unshift({ x: p0.x - ((p1.x - p0.x) / L0) * back, z: p0.z - ((p1.z - p0.z) / L0) * back, s: -back, level: p0.level, w: p0.w });
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    let a = i;
    let b = i;
    while (a > 0 && pts[i].s - pts[a - 1].s <= 12) a--;
    while (b < n - 1 && pts[b + 1].s - pts[i].s <= 12) b++;
    pts[i].g = b > a ? Math.max(0, (pts[a].level - pts[b].level) / (pts[b].s - pts[a].s)) : 0;
  }
  let k = 0;
  const seek = (s) => {
    while (k < n - 2 && pts[k + 1].s <= s) k++;
    while (k > 0 && pts[k].s > s) k--;
    const a = pts[k];
    const b = pts[k + 1];
    return clamp((s - a.s) / (b.s - a.s || 1), 0, 1);
  };
  const at = (s) => {
    const t = seek(s);
    const a = pts[k];
    const b = pts[k + 1];
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, level: a.level + (b.level - a.level) * t, w: a.w + (b.w - a.w) * t, g: a.g + (b.g - a.g) * t };
  };
  // just the grade, for the march along it
  const gradeAt = (s) => {
    const t = seek(s);
    return pts[k].g + (pts[k + 1].g - pts[k].g) * t;
  };
  return { pts, at, gradeAt, lipS, back, lip: { x: lx, z: lz, d: lipD } };
}

// One river's surface, as rows across it from past the spring to the lip.
// A river runs in pools and drops: a calm pool, the water nearly level, then
// a drop where it falls the height its bed fell under the pool. In the meadows
// a pool is a long glassy reach and its drop a pale riffle; in the hills, where
// the bed is steep, they shorten into little steps of white water. Each row
// finds its waterline on the ground as drawn, so the water fills the bed and
// never stands over a bank.
// Returns { rows: [{ x, z, y, s, tau, tx, tz, nx, ny, nz, g, fast, churn, glassy, riff, fade, wetK, steep, wl: [left, right], verts }],
//   lip: { x, z, y, w, hw, d, tau, v } }, verts: [{ a (across, m), y, edge (m past the waterline), hold }] from one side to the other.
function ribbonOf(rv, H, seed) {
  const line = lineOf(rv, H);
  const { at, gradeAt, lipS, back } = line;
  let seedR = 977 + seed * 7919;
  const rnd = () => {
    seedR ^= seedR << 13;
    seedR >>>= 0;
    seedR ^= seedR >>> 17;
    seedR ^= seedR << 5;
    seedR >>>= 0;
    return seedR / 4294967296;
  };
  // how much a pool holds the water back, none at the spring and toward the brink
  const taperAt = (s) => smooth(0, 14, s) * (1 - smooth(lipS - 22, lipS - 9, s));
  const level = (s) => at(clamp(s, -back, lipS)).level;
  // how the water stands against its bed's level: a touch over in the meadows, lower in the hills where it drops in steps
  const offsetAt = (s) => 0.04 - 0.3 * smooth(0.06, 0.3, gradeAt(clamp(s, -back, lipS)));
  // the pools and drops, each its own length, about long enough to bring the water down half a metre (from a couple
  // of metres in the hills to the best part of a hundred on the flat): its start, length, and how far its pool starts
  // under the line its bed falls along (A / 2), the pool then near level and the drop taking the rest
  const periods = [];
  for (let s = -back - rnd() * 3; s < lipS; ) {
    // (as steep as the bed gets over its length, so a long pool never runs on into the hills)
    const f = 0.5 + rnd() * 1.1;
    let g = gradeAt(clamp(s, -back, lipS));
    let P = 0;
    for (let k = 0; k < 3; k++) {
      P = clamp((0.5 / (0.6 * Math.max(g, 0.004))) * f, 1.6, 110);
      for (let x = s; x <= s + P; x += 2) g = Math.max(g, gradeAt(clamp(x, -back, lipS)));
    }
    // (steps only where the bed is steep, long pools only where it is flat: between, a run of rapids barely held back)
    const A = 0.6 * g * P * (1 - 0.72 * smooth(0.05, 0.12, g) * (1 - smooth(0.28, 0.42, g)));
    periods.push({ s, P, A, y0: level(s) + offsetAt(s) - A / 2 });
    s += P;
  }
  // the banks wander in and out, each its own way, so the river is never one width for long
  const ph = [rnd(), rnd(), rnd(), rnd()].map((v) => v * 6.283);
  const wander = (s, k) => Math.max(0, 0.55 * Math.sin(s / 8.3 + ph[2 * k]) + 0.45 * Math.sin(s / 3.7 + ph[2 * k + 1]));
  // and each pool its own: some lie glassy, some barely show
  for (const p of periods) p.calm = 0.35 + 0.65 * rnd();
  // the surface at s in pool-and-drop i: the pool falling an eighth as fast as its bed, then the drop down to the next
  // pool's start; blended back to the line of the bed where the pools fade out
  const surfaceAt = (i, s) => {
    const p = periods[i];
    const u = (s - p.s) / p.P;
    // (the pool falls by what its bed falls less what it holds back, A, over its length)
    const hold = clamp(p.A / Math.max(1e-3, level(p.s) - level(p.s + FP * p.P)), 0, 0.88);
    const pool = (x) => p.y0 - (1 - hold) * (level(p.s) - level(x));
    const next = periods[i + 1];
    const y1 = next ? next.y0 : level(p.s + p.P) + offsetAt(p.s + p.P);
    const y = u < FP ? pool(s) : pool(p.s + FP * p.P) + (y1 - pool(p.s + FP * p.P)) * smooth(FP, 1, u);
    const base = level(s) + offsetAt(s);
    return base + (y - base) * taperAt(s);
  };
  // where the rows go: at the marks of each pool and drop, and never far apart
  const marks = [0, 0.34 * FP, 0.68 * FP, FP, FP + 0.33 * (1 - FP), FP + 0.67 * (1 - FP), 1];
  const stations = [];
  periods.forEach((p, i) => {
    for (let m = 0; m < marks.length - 1; m++) {
      const s0 = p.s + marks[m] * p.P;
      const s1 = p.s + marks[m + 1] * p.P;
      const k = Math.max(1, Math.ceil((s1 - s0) / (s0 < 8 || s1 > lipS - 14 ? 0.5 : ROW_GAP)));
      for (let j = 0; j < k; j++) {
        const s = s0 + ((s1 - s0) * j) / k;
        if (s >= -back && s < lipS - 0.05) stations.push({ s, u: (s - p.s) / p.P, i });
      }
    }
  });
  stations.push({ s: lipS, u: 0.5, i: periods.length - 1 });
  for (let i = stations.length - 2; i > 0; i--) if (stations[i + 1].s - stations[i].s < 0.12) stations.splice(i, 1);
  for (const st of stations) st.L = at(st.s);
  const n = stations.length;

  // across each row: the ground as drawn, every SCAN metres from one side to the other (index c is the middle);
  // the lowest point near the middle (on the terrain's grid the bed's deepest line wanders a little off it), and
  // how high the water may stand before it would spill over the lower bank
  const rows = stations.map((st) => {
    const { s, L } = st;
    const A = at(Math.min(lipS, s + 1.5));
    const B = at(Math.max(-back, s - 1.5));
    const TL = Math.hypot(A.x - B.x, A.z - B.z) || 1;
    const tx = (A.x - B.x) / TL;
    const tz = (A.z - B.z) / TL;
    const hw = L.w / 2;
    const reach = hw + MARGIN;
    const c = Math.ceil((reach + WET + 0.3) / SCAN);
    const prof = new Float32Array(2 * c + 1);
    for (let i = 0; i <= 2 * c; i++) prof[i] = H(L.x - tz * (i - c) * SCAN, L.z + tx * (i - c) * SCAN);
    let low = c;
    const inner = Math.floor((hw * 0.6) / SCAN);
    for (let i = c - inner; i <= c + inner; i++) if (prof[i] < prof[low]) low = i;
    const rim = Math.floor(reach / SCAN);
    let left = -Infinity;
    let right = -Infinity;
    for (let i = c - rim; i <= low; i++) left = Math.max(left, prof[i]);
    for (let i = low; i <= c + rim; i++) right = Math.max(right, prof[i]);
    const pd = periods[st.i];
    const at0 = { s, u: st.u, P: pd.P, amp: pd.A, calm: pd.calm, period: st.i, x: L.x, z: L.z, level: L.level, w: L.w, g: L.g };
    return { ...at0, tx, tz, hw, reach, prof, c, low, cont: Math.min(left, right), bed: prof[low] };
  });

  // the surface: the pools and drops over the bed's level, never over the lower bank (but for the last metres, where it
  // spills over the cliff), always some water over the bed
  const ys = rows.map((r) => {
    const y = surfaceAt(r.period, r.s) - DRAWDOWN * smooth(lipS - 9, lipS, r.s) ** 2;
    return r.s > lipS - 6 ? y : Math.min(y, r.cont - 0.06);
  });
  for (let i = 1; i < n; i++) ys[i] = Math.min(ys[i], ys[i - 1]);
  for (let i = 0; i < n; i++) rows[i].y = Math.max(ys[i], rows[i].bed + (rows[i].s > lipS - 6 ? 0.3 : 0.15));

  // each side's waterline, out from the lowest point, and the vertices across: the water flat out to it, then the wet
  // bank laid on the ground
  for (const r of rows) {
    const { prof, c, low } = r;
    const ground = (a) => {
      const f = clamp(a / SCAN + c, 0, prof.length - 1.001);
      const i = Math.floor(f);
      return prof[i] + (prof[i + 1] - prof[i]) * (f - i);
    };
    const shore = (dir) => {
      for (let i = low + dir; Math.abs(i - c) * SCAN <= r.reach; i += dir)
        if (prof[i] >= r.y) return { a: (i - c - dir + (dir * (r.y - prof[i - dir])) / (prof[i] - prof[i - dir])) * SCAN, open: false };
      return { a: (low - c) * SCAN + dir * Math.min(r.reach, r.hw + 0.4), open: true };
    };
    const L = shore(-1);
    const R = shore(1);
    // (where the water finds only a crack between the terrain's coarse slopes, it still runs the bed's width: a thin
    // film laid over the stones, so a hill stream never breaks into puddles)
    const half = Math.min(r.reach, 0.3 * r.w);
    r.wl0 = [L.a, R.a];
    r.wl = [Math.min(L.a, -half), Math.max(R.a, half)];
    r.open = [L.open && r.wl[0] === L.a, R.open && r.wl[1] === R.a];
    r.ground = ground;
  }
  // the edge the water is seen to end at: each waterline taken in to where the terrain's grid notches it, then
  // smoothed along the river, so the grid's teeth are wet bed and the edge runs smooth (the shader adds its bays)
  const soft = [0, 1].map((k) => {
    const dir = k ? -1 : 1;
    const tight = rows.map((r, i) => {
      let v = r.wl[k];
      for (let j = i - 1; j >= 0 && r.s - rows[j].s <= 0.7; j--) v = dir > 0 ? Math.max(v, rows[j].wl[k]) : Math.min(v, rows[j].wl[k]);
      for (let j = i + 1; j < n && rows[j].s - r.s <= 0.7; j++) v = dir > 0 ? Math.max(v, rows[j].wl[k]) : Math.min(v, rows[j].wl[k]);
      return v;
    });
    return rows.map((r, i) => {
      let sum = 0;
      let cnt = 0;
      for (let j = i; j >= 0 && r.s - rows[j].s <= 2; j--) (sum += tight[j]), cnt++;
      for (let j = i + 1; j < n && rows[j].s - r.s <= 2; j++) (sum += tight[j]), cnt++;
      return sum / cnt;
    });
  });
  rows.forEach((r, i) => {
    const ground = r.ground;
    const L = { a: r.wl[0], open: r.open[0] };
    const R = { a: r.wl[1], open: r.open[1] };
    const W = R.a - L.a;
    const bay = Math.min(1.1, 0.12 * W) * (1 - smooth(lipS - 12, lipS - 4, r.s));
    const sl = Math.min(soft[0][i] + bay * wander(r.s, 0), L.a + 0.3 * W);
    const sr = Math.max(soft[1][i] - bay * wander(r.s, 1), R.a - 0.3 * W);
    const e = Math.min(0.3, W / 8);
    // (each vertex carries the height of the water over it: the pool's level, or the film's over a stone)
    const film = [L.a < r.wl0[0] - 0.01, R.a > r.wl0[1] + 0.01];
    const bank = (a, open) => {
      const h = ground(a);
      const surf = film[a < 0 ? 0 : 1] ? Math.max(r.y, h - 0.06) : r.y;
      return { a, y: h + LIFT, surf, edge: a < 0 ? sl - a : a - sr, hold: open ? 0 : smooth(r.y - 1.4, r.y - 0.8, h) };
    };
    const wetv = (a) => {
      const y = a > r.wl0[0] && a < r.wl0[1] ? r.y : Math.max(r.y, ground(a) + FILM);
      return { a, y, surf: y, edge: Math.max(sl - a, a - sr), hold: 1 };
    };
    r.verts = [
      bank(L.a - WET, L.open),
      bank(L.a - 0.35, L.open),
      wetv(L.a + e),
      wetv(L.a + W * 0.25),
      wetv(L.a + W * 0.5),
      wetv(L.a + W * 0.75),
      wetv(R.a - e),
      bank(R.a + 0.35, R.open),
      bank(R.a + WET, R.open),
    ];
    delete r.prof;
    delete r.ground;
    delete r.wl0;
  });

  // how steep the surface is: right here (for its white water), and over a few metres (for its speed and its tilt)
  const slopeOver = (i, half) => {
    let a = i;
    let b = i;
    while (a > 0 && rows[i].s - rows[a - 1].s <= half) a--;
    while (b < n - 1 && rows[b + 1].s - rows[i].s <= half) b++;
    if (a === b) return 0;
    return Math.max(0, (rows[a].y - rows[b].y) / (rows[b].s - rows[a].s));
  };
  let tau = 0;
  let vPrev = 0;
  for (let i = 0; i < n; i++) {
    const r = rows[i];
    const here = slopeOver(i, 0.35);
    const near = slopeOver(i, 1.2);
    const broad = slopeOver(i, 2.5);
    const brink = smooth(lipS - 12, lipS, r.s);
    const v = speedOf(broad) + brink * 1.8;
    if (i) tau += ((r.s - rows[i - 1].s) * 2) / (v + vPrev);
    vPrev = v;
    r.tau = tau;
    r.v = v;
    // the surface tilts down its slope: its normal leans downstream
    const NL = Math.hypot(near, 1);
    r.nx = (r.tx * near) / NL;
    r.ny = 1 / NL;
    r.nz = (r.tz * near) / NL;
    r.slope = here;
    // (no white water where the spring first gathers)
    const calm = smooth(2, 14, r.s);
    r.fast = smooth(0.2, 0.85, here) * (1 - brink) * calm;
    // glassy: the calm run of a pool toward its drop, and the smooth tongue at the brink of the fall
    const inPool = r.u < FP && r.amp > 0.04;
    // (only a pool that holds the water well back lies glassy: on a gentle run of little drops the stream stays rippled)
    const pool = inPool ? smooth(0.25, 0.95, r.u / FP) * smooth(0.08, 0.4, r.amp) * r.calm : 0;
    r.glassy = Math.max(pool, smooth(lipS - 14, lipS - 3, r.s));
    r.riff = r.u >= FP && r.amp > 0.04 ? smooth(FP, FP + 0.06, r.u) * smooth(0.04, 0.15, r.amp) * calm : 0;
    r.fade = 1 - smooth(lipS - 1.0, lipS - 0.05, r.s);
    r.wetK = 1 - smooth(lipS - 2.5, lipS, r.s);
    // the spring's head is round: the water comes in down the middle first, over six or seven metres, and so does the wet
    // ground round it
    const hw = Math.max(1.5, (r.wl[1] - r.wl[0]) / 2);
    for (const vt of r.verts) {
      const sh = r.s - (1.2 * vt.a * vt.a) / hw;
      vt.show = smooth(-1.2, 7, sh) * vt.hold;
      vt.wet = smooth(-back, -back + 3, sh) * vt.hold;
    }
    r.steep = smooth(0.1, 0.3, r.g);
  }
  // white water and riffles are carried on a little way below each drop before the pool calms them
  for (let i = 1; i < n; i++) {
    const r = rows[i];
    const p = rows[i - 1];
    const ds = r.s - p.s;
    r.churn = Math.max(r.fast, (p.churn ?? p.fast) * Math.exp(-ds / 2.4));
    r.riff = Math.max(r.riff, p.riff * Math.exp(-ds / 3));
  }
  rows[0].churn = rows[0].fast;
  const end = rows[n - 1];
  const f = rv.fall;
  const hwLip = clamp((end.wl[1] - end.wl[0]) / 2, f.w * 0.3, f.w * 0.48);
  return { rows, lip: { x: line.lip.x, z: line.lip.z, y: end.y, w: f.w, hw: hwLip, d: line.lip.d, tau: end.tau, v: end.v, s: lipS } };
}

// The surface along a ribbon at s: { x, z, y } of its middle.
function ribbonAt(rows, s) {
  let i = rows.length - 1;
  while (i > 0 && rows[i - 1].s > s) i--;
  const a = rows[Math.max(0, i - 1)];
  const b = rows[i];
  const t = clamp((s - a.s) / (b.s - a.s || 1), 0, 1);
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t, tau: a.tau + (b.tau - a.tau) * t };
}

// One waterfall: a sheet from a little way upstream of the lip (lying on the
// river, where it takes over from it) down past the sea's face, columns across
// and rows down.
// Returns { cols, rows, pos: Float32Array (cols * rows * 3, row by row), sheet: per vertex [u, flight time, drop 0..1, half width],
// lead: per vertex [the river's flow time at the lip, how far in from where the sheet starts 0..1],
// impact: { x, z } where its middle meets the sea, hw, hwBottom, drop, dir: [dx, dz] }.
const PRE = [1.3, 0.85, 0.4];
function sheetOf(rv, rb, H) {
  const lip = rb.lip;
  const f = rv.fall;
  const dx = f.dx;
  const dz = f.dz;
  const sx = -dz;
  const sz = dx;
  const y0 = lip.y;
  const yb = -0.7;
  const drop = y0;
  const hw = lip.hw;
  const spread = hw * 0.18 + drop * 0.05;
  const vx0 = clamp(lip.v, 2, 4.2);
  const vy0 = -0.5;
  const T = (vy0 + Math.sqrt(vy0 * vy0 + 2 * GRAVITY * (y0 - yb))) / GRAVITY;
  const NU = 13;
  const NV = 26;
  const X = [];
  const Y = [];
  const W = [];
  const tf = [];
  for (let k = 0; k < NV; k++) {
    const t = (T * k) / (NV - 1);
    tf.push(t);
    Y.push(y0 + vy0 * t - 0.5 * GRAVITY * t * t);
    W.push(hw + spread * smooth(0, 1, (y0 - Y[k]) / (y0 - yb)));
  }
  // each column: the arc it would fly, pushed out wherever the face is in the way
  const need = (j, k) => {
    const u = (j / (NU - 1)) * 2 - 1;
    const lat = u * W[k];
    const bx = lip.x + sx * lat;
    const bz = lip.z + sz * lat;
    const y = Y[k];
    let out = -Infinity;
    for (let d = 0; d <= 40; d += 0.15) if (H(bx + dx * d, bz + dz * d) > y) out = d;
    return out + 0.35 + 0.045 * (y0 - y);
  };
  const minX = [];
  for (let j = 0; j < NU; j++) {
    const u = (j / (NU - 1)) * 2 - 1;
    X.push([]);
    minX.push([]);
    for (let k = 0; k < NV; k++) {
      const m = need(j, k);
      minX[j].push(m);
      // a little fuller in the middle, as falling water bows
      X[j].push(Math.max(vx0 * tf[k] + 0.35 * (1 - u * u) * (k / (NV - 1)), m));
    }
  }
  const settle = () => {
    for (let j = 0; j < NU; j++) for (let k = 1; k < NV; k++) X[j][k] = Math.max(X[j][k], X[j][k - 1], minX[j][k]);
  };
  settle();
  for (let pass = 0; pass < 3; pass++) {
    for (let j = 0; j < NU; j++) {
      const c = X[j].slice();
      for (let k = 1; k < NV - 1; k++) X[j][k] = (c[k - 1] + 2 * c[k] + c[k + 1]) / 4;
    }
    for (let k = 1; k < NV; k++) {
      const c = X.map((col) => col[k]);
      for (let j = 0; j < NU; j++) X[j][k] = (c[Math.max(0, j - 1)] + 2 * c[j] + c[Math.min(NU - 1, j + 1)]) / 4;
    }
    settle();
  }
  const NR = PRE.length + NV;
  const pos = new Float32Array(NU * NR * 3);
  const sheet = new Float32Array(NU * NR * 4);
  const lead = new Float32Array(NU * NR * 2);
  // the rows lying on the river above the lip, a hair over its surface
  PRE.forEach((back, k) => {
    const c = ribbonAt(rb.rows, lip.s - back);
    for (let j = 0; j < NU; j++) {
      const u = (j / (NU - 1)) * 2 - 1;
      const v = k * NU + j;
      pos.set([c.x + sx * u * hw, c.y + 0.03, c.z + sz * u * hw], v * 3);
      sheet.set([u, -back / lip.v, 0, hw], v * 4);
      lead.set([lip.tau, k / PRE.length], v * 2);
    }
  });
  for (let k = 0; k < NV; k++)
    for (let j = 0; j < NU; j++) {
      const u = (j / (NU - 1)) * 2 - 1;
      const v = (PRE.length + k) * NU + j;
      const lat = u * W[k];
      pos[v * 3] = lip.x + sx * lat + dx * X[j][k];
      pos[v * 3 + 1] = Y[k];
      pos[v * 3 + 2] = lip.z + sz * lat + dz * X[j][k];
      sheet.set([u, tf[k], (y0 - Y[k]) / (y0 - yb), W[k]], v * 4);
      lead.set([lip.tau, 1], v * 2);
    }
  // where the middle meets the sea
  const mid = (NU - 1) / 2;
  let xi = X[mid][NV - 1];
  for (let k = 1; k < NV; k++)
    if (Y[k] <= 0) {
      const t = Y[k - 1] / (Y[k - 1] - Y[k]);
      xi = X[mid][k - 1] + (X[mid][k] - X[mid][k - 1]) * t;
      break;
    }
  return { cols: NU, rows: NR, pos, sheet, lead, impact: { x: lip.x + dx * xi, z: lip.z + dz * xi }, lip, hw, hwBottom: W[NV - 1], drop, dir: [dx, dz] };
}

// Both rivers' shapes: their surfaces and their falls.
export function riverShapes(height = naturalAt) {
  const H = meshGround(height);
  const ribbons = [];
  const falls = [];
  RIVERS.forEach((rv, i) => {
    const rb = ribbonOf(rv, H, i + 1);
    ribbons.push(rb);
    falls.push(sheetOf(rv, rb, H));
  });
  return { ribbons, falls, H };
}

// ------------------------------------------------------------------ the geometry

function ribbonGeometry(ribbons) {
  const across = ribbons[0].rows[0].verts.length;
  let nv = 0;
  let ni = 0;
  for (const r of ribbons) {
    nv += r.rows.length * across;
    ni += (r.rows.length - 1) * (across - 1) * 6;
  }
  const pos = new Float32Array(nv * 3);
  const nor = new Float32Array(nv * 3);
  const flow = new Float32Array(nv * 4);
  const frame = new Float32Array(nv * 4);
  const look = new Float32Array(nv * 4);
  const look2 = new Float32Array(nv * 2);
  const idx = new Uint32Array(ni);
  let v = 0;
  let q = 0;
  for (const r of ribbons) {
    const base = v;
    for (const row of r.rows) {
      for (const vt of row.verts) {
        pos.set([row.x - row.tz * vt.a, vt.y, row.z + row.tx * vt.a], v * 3);
        nor.set([row.nx, row.ny, row.nz], v * 3);
        flow.set([row.tau, vt.a, vt.edge, row.fast], v * 4);
        frame.set([row.tx, row.tz, row.s, vt.surf], v * 4);
        look.set([row.glassy, row.churn, row.riff, row.fade * vt.show], v * 4);
        look2.set([row.steep, row.wetK * vt.wet], v * 2);
        v++;
      }
    }
    for (let i = 0; i < r.rows.length - 1; i++)
      for (let j = 0; j < across - 1; j++) {
        const a = base + i * across + j;
        const b = a + 1;
        const c = a + across;
        const d = c + 1;
        idx.set([a, b, c, b, d, c], q);
        q += 6;
      }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("aFlow", new THREE.BufferAttribute(flow, 4));
  g.setAttribute("aFrame", new THREE.BufferAttribute(frame, 4));
  g.setAttribute("aLook", new THREE.BufferAttribute(look, 4));
  g.setAttribute("aLook2", new THREE.BufferAttribute(look2, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

function sheetGeometry(falls) {
  let nv = 0;
  let ni = 0;
  for (const f of falls) {
    nv += f.cols * f.rows;
    ni += (f.cols - 1) * (f.rows - 1) * 6;
  }
  const pos = new Float32Array(nv * 3);
  const nor = new Float32Array(nv * 3);
  const sheet = new Float32Array(nv * 4);
  const lead = new Float32Array(nv * 2);
  const idx = new Uint32Array(ni);
  let v0 = 0;
  let q = 0;
  for (const f of falls) {
    const { cols, rows } = f;
    pos.set(f.pos, v0 * 3);
    sheet.set(f.sheet, v0 * 4);
    lead.set(f.lead, v0 * 2);
    const P = (j, k) => {
      const i = (clamp(k, 0, rows - 1) * cols + clamp(j, 0, cols - 1)) * 3;
      return [f.pos[i], f.pos[i + 1], f.pos[i + 2]];
    };
    for (let k = 0; k < rows; k++)
      for (let j = 0; j < cols; j++) {
        const a = P(j + 1, k);
        const b = P(j - 1, k);
        const c = P(j, k + 1);
        const d = P(j, k - 1);
        const ax = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
        const dn = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
        let n = [ax[1] * dn[2] - ax[2] * dn[1], ax[2] * dn[0] - ax[0] * dn[2], ax[0] * dn[1] - ax[1] * dn[0]];
        // facing out to sea (and up, where it still lies on the river)
        if (n[0] * f.dir[0] + n[1] * 0.5 + n[2] * f.dir[1] < 0) n = n.map((e) => -e);
        const L = Math.hypot(...n) || 1;
        nor.set([n[0] / L, n[1] / L, n[2] / L], (v0 + k * cols + j) * 3);
      }
    for (let k = 0; k < rows - 1; k++)
      for (let j = 0; j < cols - 1; j++) {
        const a = v0 + k * cols + j;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        idx.set([a, b, c, b, d, c], q);
        q += 6;
      }
    v0 += cols * rows;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("aSheet", new THREE.BufferAttribute(sheet, 4));
  g.setAttribute("aLead", new THREE.BufferAttribute(lead, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

// The foam pool at each fall's foot, on the sea: a boil of white round where it lands, and a plume
// of milky water drifting out to sea. R is the boil's radius; the disc reaches further out to sea than back.
const POOL_RINGS = 10;
const POOL_SEGS = 48;
function poolOf(f) {
  const R = f.hwBottom * 1.3 + f.drop * 0.16;
  const [dx, dz] = f.dir;
  return { R, cx: f.impact.x, cz: f.impact.z, dx, dz };
}
function poolGeometry(falls) {
  const per = (POOL_RINGS + 1) * (POOL_SEGS + 1);
  const pos = new Float32Array(falls.length * per * 3);
  const nor = new Float32Array(falls.length * per * 3);
  const pool = new Float32Array(falls.length * per * 4);
  const dir = new Float32Array(falls.length * per * 2);
  const idx = [];
  falls.forEach((f, fi) => {
    const p = poolOf(f);
    const base = fi * per;
    for (let i = 0; i <= POOL_RINGS; i++)
      for (let k = 0; k <= POOL_SEGS; k++) {
        const r = (i / POOL_RINGS) ** 1.25;
        const a = (k / POOL_SEGS) * Math.PI * 2;
        // out to sea (a = 0) the plume reaches three and a half radii, back toward the cliff and to the sides less than two
        const reach = p.R * (1.8 + 2.2 * Math.max(0, Math.cos(a)) ** 2);
        const ca = Math.cos(a) * r * reach;
        const sa = Math.sin(a) * r * reach;
        const v = base + i * (POOL_SEGS + 1) + k;
        pos.set([p.cx + p.dx * ca - p.dz * sa, 0.06, p.cz + p.dz * ca + p.dx * sa], v * 3);
        nor.set([0, 1, 0], v * 3);
        pool.set([p.cx, p.cz, p.R, r], v * 4);
        dir.set([p.dx, p.dz], v * 2);
      }
    for (let i = 0; i < POOL_RINGS; i++)
      for (let k = 0; k < POOL_SEGS; k++) {
        const a = base + i * (POOL_SEGS + 1) + k;
        const b = a + 1;
        const c = a + POOL_SEGS + 1;
        const d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("aPool", new THREE.BufferAttribute(pool, 4));
  g.setAttribute("aPoolDir", new THREE.BufferAttribute(dir, 2));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(idx), 1));
  g.computeBoundingSphere();
  return g;
}

// The spray: soft billboards of three kinds. MIST drifts up from each fall's foot (some climbing the face)
// and over the steepest steps of each river; FOAM churns in a white mound where each fall meets the sea;
// a VEIL hangs low and wide over each foot.
const MIST = 0;
const FOAM = 1;
const VEIL = 2;
function sprayOf(ribbons, falls) {
  const list = [];
  for (const f of falls) {
    const [dx, dz] = f.dir;
    const w = f.hwBottom;
    const { x: ix, z: iz } = f.impact;
    // foam heaving where it lands, and more rolling out from it
    const foam = [1.6 + f.drop * 0.05, 2.6 + f.drop * 0.06];
    list.push({ kind: FOAM, x: ix, y: 0.35, z: iz, n: 11, across: w * 0.95, out: [-0.4, 1.4], dx, dz, size: foam });
    list.push({ kind: FOAM, x: ix + dx * 2.2, y: 0.2, z: iz + dz * 2.2, n: 6, across: w * 1.1, out: [0, 2.5], dx, dz, size: [1.2, 2.0] });
    // mist in front of the sheet's foot, a little out from where it lands
    const rise = (a, b) => [f.drop * a, f.drop * b];
    const mist = { kind: MIST, dx, dz };
    list.push({ ...mist, x: ix + dx * 1.2, y: 0.6, z: iz + dz * 1.2, n: 34, across: w * 1.1, out: [0, 2], size: [2, 4.8], rise: rise(0.06, 0.16), drift: 2.2 });
    // some climb the face, up to about a third of the way
    list.push({ ...mist, x: ix - dx * 0.3, y: 0.8, z: iz - dz * 0.3, n: 20, across: w, out: [0, 0.8], size: [1.8, 4.2], rise: rise(0.2, 0.36), drift: 0.6 });
    // and one broad soft veil over it all
    const veil = w * 3.2 + f.drop * 0.35;
    list.push({ kind: VEIL, x: ix + dx * 2.5, y: 1.0 + f.drop * 0.08, z: iz + dz * 2.5, n: 1, across: 0, out: [0, 0], dx, dz, size: [veil, veil] });
  }
  for (const r of ribbons) {
    // the steepest steps a good way apart, short of the brink (the falls have their own)
    const rows = r.rows;
    const lipS = rows[rows.length - 1].s;
    const picks = [];
    const order = rows
      .map((row, i) => i)
      .filter((i) => rows[i].slope > 0.9 && rows[i].s < lipS - 30)
      .sort((a, b) => rows[b].slope - rows[a].slope);
    for (const i of order) {
      if (picks.length >= 4) break;
      if (picks.some((j) => Math.abs(rows[j].s - rows[i].s) < 30)) continue;
      picks.push(i);
    }
    for (const i of picks) {
      const row = rows[i];
      const hw = (row.wl[1] - row.wl[0]) / 2;
      const spot = { x: row.x, y: row.y - 0.3, z: row.z, dx: row.tx, dz: row.tz };
      list.push({ kind: MIST, ...spot, n: 6, across: hw * 0.7, out: [0, 2], size: [1.2, 2.4], rise: [0.6, 1.4], drift: 1.2 });
    }
  }
  return list;
}

function mistGeometry(emitters) {
  let seed = 4127;
  const rnd = () => {
    seed ^= seed << 13;
    seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed / 4294967296;
  };
  const lerp = ([a, b], t) => a + (b - a) * t;
  const n = emitters.reduce((a, e) => a + e.n, 0);
  const p0 = new Float32Array(n * 4);
  const vel = new Float32Array(n * 4);
  const rr = new Float32Array(n * 4);
  const kind = new Float32Array(n * 2);
  let i = 0;
  for (const e of emitters) {
    const sx = -e.dz;
    const sz = e.dx;
    for (let k = 0; k < e.n; k++, i++) {
      // spread evenly across, each a little off its place
      const across = e.n > 1 ? ((k + 0.2 + rnd() * 0.6) / e.n) * 2 - 1 : 0;
      const lat = across * e.across;
      const out = lerp(e.out, rnd());
      const size = lerp(e.size, rnd());
      p0.set([e.x + sx * lat + e.dx * out, e.y + (e.kind === MIST ? rnd() * 1.2 : rnd() * 0.4), e.z + sz * lat + e.dz * out, size], i * 4);
      // each lives a few seconds (a whole number of lives in the clock's wrap)
      const life = e.kind === FOAM ? 0.36 + rnd() * 0.22 : e.kind === MIST ? 0.12 + rnd() * 0.08 : 0;
      if (e.kind === MIST) {
        // drifting out (over the sea, or downstream) and a little east on the breeze, rising
        const drift = e.drift * (0.6 + rnd() * 0.9);
        vel.set([e.dx * drift + 0.9 + sx * lat * 0.2, lerp(e.rise, rnd()), e.dz * drift + sz * lat * 0.2, Math.round(life * WRAP) / WRAP], i * 4);
      } else if (e.kind === FOAM) {
        // heaving up and rolling out a little
        vel.set([e.dx * 0.8, 0.5 + rnd() * 0.4, e.dz * 0.8, Math.round(life * WRAP) / WRAP], i * 4);
      } else vel.set([0, 0, 0, 0], i * 4);
      rr.set([rnd(), rnd(), rnd(), rnd()], i * 4);
      // a slow turn, a whole number of turns in the wrap
      const spin = (rnd() - 0.5) * (e.kind === FOAM ? 0.5 : 0.2);
      kind.set([e.kind, (Math.round((spin * WRAP) / (2 * Math.PI)) * 2 * Math.PI) / WRAP], i * 2);
    }
  }
  const quad = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex(quad.getIndex());
  g.setAttribute("position", quad.getAttribute("position"));
  g.setAttribute("aP0", new THREE.InstancedBufferAttribute(p0, 4));
  g.setAttribute("aVel", new THREE.InstancedBufferAttribute(vel, 4));
  g.setAttribute("aRnd", new THREE.InstancedBufferAttribute(rr, 4));
  g.setAttribute("aKind", new THREE.InstancedBufferAttribute(kind, 2));
  g.instanceCount = n;
  quad.dispose();
  return g;
}

// ------------------------------------------------------------------ the paint

const LIN_FN = "float rvLin(float d) { float z = d * 2.0 - 1.0; return 2.0 * uCam.x * uCam.y / (uCam.y + uCam.x - z * (uCam.y - uCam.x)); }";
const COMMON_FRAG = [
  "uniform sampler2D tStill; uniform sampler2D tStillDepth; uniform vec2 uCam; uniform vec2 uRes; uniform float uFlowT; uniform sampler2D uNoise;",
  "uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uGndCol; uniform vec3 uFogCol; uniform vec3 uFog;",
  "uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uGlassy; uniform vec3 uFoam; uniform vec3 uMilk; uniform vec3 uSkyLow; uniform vec3 uSkyHigh;",
  "varying vec3 vPW; varying vec3 vNW; varying vec4 vA; varying vec4 vB; varying vec4 vC; varying vec4 vD;",
  LIN_FN,
  // three r128 never gives a MeshLambertMaterial its cameraPosition, so the eye is found from the view matrix
  "vec3 rvEye() { vec3 t = viewMatrix[3].xyz; return -vec3(dot(viewMatrix[0].xyz, t), dot(viewMatrix[1].xyz, t), dot(viewMatrix[2].xyz, t)); }",
].join("\n");
// where the eye is, and how far behind this point the still picture is
const VIEW = [
  "vec2 uv = gl_FragCoord.xy / uRes;",
  "vec3 eye = rvEye();",
  "vec3 toCam = eye - vPW;",
  "float camD = length(toCam);",
  "vec3 V = toCam / camD;",
  "vec3 fwd = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);",
  "float viewZ = dot(-toCam, fwd);",
  "float dS = rvLin(texture2D(tStillDepth, uv).r);",
  "float sh = smoothstep(0.1, 0.9, pShadow);",
  "float fogK = smoothstep(uFog.x, uFog.y, camD) * 0.94;",
  "float near = 1.0 - smoothstep(140.0, 700.0, camD);",
  "float T = uFlowT;",
].join("\n");
// how foam is lit: the sun on it, the sky in its shade
const FOAM_LIT = "vec3 foamLit = uFoam * (uSunCol * 0.42 * sh + uSkyCol * 0.6 + 0.12);";

// The river. vA: flow time (s, larger downstream), across (m from the middle), past its waterline (m, negative in the water),
// how fast it falls 0..1. vB: its way (x, z), s (m along), the surface's height. vC: glassy, churned white, riffle, shown 0..1.
// vD: how steep the reach, how wet its bank 0..1.
const RIVER_MAIN = [
  VIEW,
  "float surfY = vB.w;",
  // the ground seen here (the bed under the water, or the bank): back along the ray to the still picture's depth
  "vec3 bed = eye - V * (dS / max(dot(-V, fwd), 1e-3));",
  "float depth = surfY - bed.y;",
  "float tau = vA.x; float ac = vA.y; float edge = vA.z; float fast = vA.w;",
  "float glassy = vC.x; float churn = vC.y; float riff = vC.z; float shown = vC.w; float steep = vD.x;",
  // (far off a pool and a riffle differ less, so the reaches don't stripe)
  "float evenK = 1.0 - 0.6 * smoothstep(160.0, 500.0, camD); glassy *= evenK; riff *= evenK;",
  // (and a pool is glassy in patches, the breeze ruffling the rest)
  "glassy *= mix(0.45, 1.0, smoothstep(0.3, 0.7, texture2D(uNoise, vPW.xz / 17.0 + vec2(0.71, 0.09)).b));",
  // the water's edge wanders in little bays and spits, and between it and the true edge the wet bed shows
  "vec4 nw = texture2D(uNoise, vPW.xz / 11.0 + vec2(0.37, 0.71));",
  "vec4 nw2 = texture2D(uNoise, vPW.xz / 3.3 + vec2(0.13, 0.52));",
  "float eN = -0.06 - 0.95 * smoothstep(0.42, 0.85, nw.r * 0.75 + nw2.g * 0.35) * (1.0 - 0.6 * glassy);",
  "float e1 = edge - eN;",
  // the spring: the water seeps out of its hollow in a broken film before it gathers
  "float seep = smoothstep(0.0, 0.55, shown - (nw2.a - 0.5) * 0.6 * (1.0 - shown));",
  "float wa = smoothstep(0.0, 0.06, depth) * (1.0 - smoothstep(-0.35, 0.0, e1)) * seep;",
  // the bank: wet and dark at the water's edge, drying over a metre or so and only a little way up
  "float rise = bed.y - surfY;",
  "float wet = (1.0 - smoothstep(0.15, 0.85 + nw2.a * 0.7, e1)) * (1.0 - smoothstep(0.12, 0.5, rise)) * vD.y * (1.0 - fogK);",
  "float wetA = wet * 0.62;",
  "float A = 1.0 - (1.0 - wa) * (1.0 - wetA);",
  "if (A < 0.02) discard;",
  "vec3 still = texture2D(tStill, uv).rgb;",
  "float contact = 1.0 - smoothstep(0.0, 0.3, abs(e1 - 0.05));",
  "vec3 wetC = mix(still, vec3(dot(still, vec3(0.3, 0.55, 0.15))), 0.3) * mix(0.62, 0.48, contact) * vec3(0.97, 1.0, 1.03);",
  "vec3 cw = vec3(0.0);",
  "if (wa > 0.003) {",
  "  vec3 D = normalize(vec3(vB.x, 0.0, vB.y)); vec3 Sd = vec3(-D.z, 0.0, D.x);",
  // ripples: three sizes carried downstream (along the water's own time, so fast water draws them out); a pool is glassy
  `  vec4 r1 = texture2D(uNoise, vec2(ac / 13.0 + 0.13, tau / 20.0 - T * ${cyc(1 / 20)}));`,
  `  vec4 r2 = texture2D(uNoise, vec2(ac / 4.5 + 0.61, tau / 5.0 - T * ${cyc(0.9 / 5)}));`,
  `  vec4 r3 = texture2D(uNoise, vec2(ac / 1.7 + 0.29, tau / 2.0 - T * ${cyc(1.1 / 2)}));`,
  // the finer sizes only near enough to see them, else they shimmer into fine bands across the stream
  "  float n2 = 1.0 - smoothstep(70.0, 280.0, camD); float n3 = 1.0 - smoothstep(25.0, 120.0, camD);",
  "  vec2 sl = (r1.rg - 0.5) * 0.3 + (r2.ga - 0.5) * 0.32 * n2 + (r3.ag - 0.5) * 0.24 * n3;",
  "  sl *= (0.7 + max(fast, churn) * 1.1) * (1.0 - 0.6 * glassy);",
  "  sl.y *= 1.0 - 0.7 * smoothstep(110.0, 380.0, camD);",
  "  vec3 N = normalize(normalize(vNW) + Sd * sl.x + D * sl.y);",
  // what shows through: the bed, bent a little; wet stones in the shallows, the sun's light dancing on them
  "  vec2 ruv = uv + sl * 0.008 * smoothstep(0.0, 0.5, depth) * near;",
  "  if (rvLin(texture2D(tStillDepth, ruv).r) < viewZ) ruv = uv;",
  "  vec3 under = texture2D(tStill, ruv).rgb;",
  // in the hills the stream runs cloudier over pebbles, so no straight band of the land's rock shows through it
  "  float pb = texture2D(uNoise, bed.xz / 0.8 + 0.27).a * 0.6 + texture2D(uNoise, bed.xz / 2.1 + 0.61).g * 0.4;",
  "  under *= mix(1.0, 0.62 + 0.7 * pb, (0.35 + 0.65 * steep) * (1.0 - smoothstep(25.0, 140.0, camD)));",
  // and everything under water is wet: darker, a little green
  "  under *= vec3(0.6, 0.68, 0.64);",
  // (how deep it looks: true in the shallows, but past a metre it hardly deepens, so the bed falling away under each pool
  // never darkens it pool after pool down the river)
  "  float dT = max(depth, 0.0); dT = min(dT, 0.9) + max(dT - 0.9, 0.0) * 0.25;",
  "  float clear = exp(-dT * mix(1.4, 2.9, steep));",
  `  vec2 cp = bed.xz * 0.11;`,
  `  float k1 = texture2D(uNoise, cp + vec2(T * ${cyc(0.021)}, T * ${cyc(0.013)})).a;`,
  `  float k2 = texture2D(uNoise, cp * 1.37 + vec2(0.53 - T * ${cyc(0.017)}, 0.29 + T * ${cyc(0.024)})).a;`,
  "  float caus = pow(clamp(1.0 - abs(k1 - k2) * 1.7, 0.0, 1.0), 5.0) * (1.0 - smoothstep(30.0, 110.0, camD)) * sh * (1.0 - smoothstep(0.15, 0.7, depth));",
  "  under += uSunCol * uShallow * caus * 0.2 * smoothstep(0.02, 0.2, depth);",
  // its own colour: a fresh green, deeper only where it is deep; warm where the sun is on it, cool in shade
  "  vec3 tint = mix(uShallow, uDeep, smoothstep(0.2, 1.5, dT));",
  "  tint = mix(tint, uDeep * vec3(0.8, 0.9, 0.96), glassy * smoothstep(0.5, 1.4, dT) * 0.3);",
  "  tint = mix(tint, uShallow * 1.04, riff * (1.0 - glassy) * 0.35);",
  "  tint *= mix(vec3(0.74, 0.82, 0.93), vec3(1.03, 1.0, 0.95), sh);",
  "  vec3 water = mix(tint, under, clear);",
  // the sky in it: its gradient and slow soft clouds, more at a glancing angle and in the glassy runs; the sun's glints
  "  float fres = 0.05 + 0.95 * pow(1.0 - max(dot(N, V), 0.0), 5.0);",
  "  vec3 R = reflect(-V, N);",
  "  vec3 sky = mix(uSkyLow, uSkyHigh, smoothstep(0.0, 0.55, R.y));",
  `  float cl = texture2D(uNoise, vPW.xz / 230.0 + R.xz * 0.06 + vec2(T * ${cyc(0.0017)}, 0.0)).b;`,
  "  sky = mix(sky, uSkyLow * 1.06, smoothstep(0.45, 0.8, cl) * 0.75);",
  "  vec3 c = mix(water, sky, clamp(fres + glassy * 0.1, 0.0, 0.85));",
  "  float rs = max(dot(R, uSunDir), 0.0);",
  "  c += uSunCol * (pow(rs, 160.0) * 1.6 + pow(rs, 14.0) * (0.06 + glassy * 0.05)) * sh;",
  // white water where it drops, in streaks drawn out along the flow
  `  float fa = texture2D(uNoise, vec2(ac / 2.6 + 0.71, tau / 9.0 - T * ${cyc(1.15 / 9)})).g;`,
  `  float fb = texture2D(uNoise, vec2(ac / 3.2 + 0.17, tau / 4.0 - T * ${cyc(1.15 / 4)})).a;`,
  "  float fz = fa * 0.8 + fb * 0.25 + (r1.b - 0.5) * 0.3;",
  // (where a drop's white begins wanders across the stream, so no lip is a ruled line)
  "  float rag = (texture2D(uNoise, vec2(ac / 2.2 + 0.31, vB.z / 1.7 + 0.47)).r - 0.5) * 0.55;",
  "  fast = clamp(fast + rag * smoothstep(0.0, 0.25, fast), 0.0, 1.0); churn = clamp(churn + rag * 0.8 * smoothstep(0.0, 0.25, churn), 0.0, 1.0);",
  "  float white = smoothstep(0.86 - fast * 0.62, 1.02 - fast * 0.45, fz) * smoothstep(0.05, 0.3, fast);",
  // and below each drop the churn: foam boiling up in patches, carried off and thinning across the pool
  `  float cz = texture2D(uNoise, vec2(ac / 1.9 + 0.43, tau / 1.6 - T * ${cyc(1.2 / 1.6)})).g * 0.7 + fb * 0.4;`,
  "  white = max(white, smoothstep(1.02 - churn * 0.62, 1.16 - churn * 0.55, cz) * churn);",
  // far off, where streaks would be smaller than a pixel, each drop a soft broken pale band across the stream
  // (only some of them, here and there, so a run of drops never reads as the rungs of a ladder)
  "  float farK = smoothstep(140.0, 420.0, camD);",
  "  float few = mix(1.0, 0.15 + 0.85 * smoothstep(0.45, 0.75, texture2D(uNoise, vec2(vB.z / 53.0 + 0.19, ac / 40.0 + 0.83)).g), farK);",
  "  white = mix(white, max(fast, churn * 0.75) * (0.4 + 0.6 * r1.b) * smoothstep(0.1, 0.5, max(fast, churn)) * few, farK);",
  "  c = mix(c, uMilk * (0.72 + 0.3 * sh), smoothstep(0.15, 0.8, max(fast, churn * 0.8)) * 0.45 * few);",
  // riffles: standing waves, pale lines across the stream and a V of them running off each bank, still while the water runs through
  "  float s = vB.z;",
  "  float sw = smoothstep(0.62, 0.97, sin((s - abs(ac) * 0.3) * 2.3 + (r1.b - 0.5) * 5.0) * 0.5 + 0.5);",
  // (each wave only a short crest here and there across the stream, not a rule drawn bank to bank)
  "  sw *= smoothstep(0.4, 0.75, texture2D(uNoise, vec2(ac / 1.4 + 0.23, s / 2.6 + 0.61)).r);",
  "  float vl = smoothstep(0.7, 0.98, sin((s + abs(ac) * 0.95) * 1.7 + (r2.r - 0.5) * 4.0) * 0.5 + 0.5) * smoothstep(-2.4, -0.5, edge);",
  "  float bands = max(sw * 0.7, vl) * riff * (1.0 - fast) * (1.0 - smoothstep(30.0, 100.0, camD)) * smoothstep(0.45, 0.75, fb * 0.7 + r2.b * 0.5);",
  "  float foam = clamp(white + bands * 0.32, 0.0, 1.0);",
  FOAM_LIT,
  "  c = mix(c, foamLit, foam * 0.92);",
  "  cw = mix(c, uFogCol, fogK);",
  "}",
  // the water over the wet bank over the ground, as one layer
  "vec3 C = (wetC * wetA * (1.0 - wa) + cw * wa) / A;",
  "gl_FragColor = vec4(C, A);",
].join("\n");

// The falling sheet. vA: across (-1..1), flight time (s, negative while it still lies on the river), how far down (0 the lip,
// 1 under the sea), half width (m). vB: the river's flow time at the lip, how far in from where the sheet starts (0..1).
const SHEET_MAIN = [
  VIEW,
  "float u = vA.x; float tf = vA.y; float k = vA.z; float ac = u * vA.w; float lipTau = vB.x;",
  // streaks falling: long down the sheet, narrow across it, longer as the water gathers speed
  `vec4 s1 = texture2D(uNoise, vec2(ac / 3.4 + 0.21, tf * 0.45 - T * ${cyc(0.225)}));`,
  `vec4 s2 = texture2D(uNoise, vec2(ac / 1.2 + 0.53, tf * 1.1 - T * ${cyc(0.55)}));`,
  `vec4 s3 = texture2D(uNoise, vec2(ac / 0.5 + 0.87, tf * 2.4 - T * ${cyc(1.2)}));`,
  "float streak = clamp((s1.g - 0.5) * 1.3 + (s2.a - 0.5) * 0.9 + (s3.a - 0.5) * 0.5 * near + 0.55, 0.0, 1.0);",
  // at the brink the river's own ripples carry on over the edge (the same noise at the same flow time), glassy green
  `vec4 r1 = texture2D(uNoise, vec2(ac / 13.0 + 0.13, (lipTau + tf) / 20.0 - T * ${cyc(1 / 20)}));`,
  "float aer = smoothstep(0.0, 0.14, k);",
  "vec3 alb = mix(uGlassy * (0.86 + 0.3 * r1.g), uFoam, aer * clamp(0.3 + streak * 0.85, 0.0, 1.0));",
  "alb *= mix(1.0, mix(0.64, 1.08, streak) * mix(0.86, 1.08, smoothstep(0.15, 0.9, k)), aer);",
  "alb = mix(alb * vec3(0.84, 0.92, 1.0), alb, smoothstep(0.2, 0.7, streak));",
  "vec3 N = normalize(vNW);",
  "#ifdef DOUBLE_SIDED",
  "  N *= gl_FrontFacing ? 1.0 : -1.0;",
  "#endif",
  // water scatters the light: the sun wraps round it, and it stays bright in shade
  "float wrap = clamp(dot(N, uSunDir) * 0.55 + 0.45, 0.0, 1.0);",
  "vec3 light = uSunCol * wrap * mix(0.35, 1.0, sh) * 0.8 + mix(uGndCol, uSkyCol, 0.5 + 0.5 * N.y) * 0.9 + uSkyCol * 0.15;",
  "vec3 c = alb * light;",
  // the glassy brink is clear water over what lies behind it (the river's bed, then the rock), as the river shows its bed
  "vec3 glass = mix(uGlassy * (uSkyCol * 0.55 + uSunCol * 0.3 * sh + 0.08), texture2D(tStill, uv).rgb * vec3(0.6, 0.68, 0.64), 0.55);",
  "c = mix(glass * (0.9 + 0.2 * r1.g), c, aer);",
  // the sky in it, and a bright curve where it bends over the edge
  "vec3 R = reflect(-V, N);",
  "float fres = 0.05 + 0.95 * pow(1.0 - max(dot(N, V), 0.0), 5.0);",
  "c = mix(c, mix(uSkyLow, uSkyHigh, smoothstep(0.0, 0.55, R.y)), clamp(fres, 0.0, 0.6) * (1.0 - aer));",
  "float bend = smoothstep(0.004, 0.025, k) * (1.0 - smoothstep(0.05, 0.1, k));",
  "c += (uSunCol * 0.32 * sh + uSkyCol * 0.22) * bend * (0.6 + 0.4 * r1.b);",
  "c += uSunCol * pow(max(dot(R, uSunDir), 0.0), 40.0) * 0.3 * (1.0 - aer) * sh;",
  "c = mix(c, uFogCol, fogK);",
  // thick in the middle, lacy at the edges once it has broken up, streaky gaps; soft where it touches the rock and the sea
  "float lace = smoothstep(0.08, 0.2, k);",
  "float edge = 1.0 - abs(u);",
  "float a = smoothstep(0.0, 0.2, edge * 1.7 + (streak - 0.5) * 0.9 * lace - 0.14 * lace + 0.06 * (1.0 - lace));",
  "a *= mix(1.0, mix(0.62, 1.0, smoothstep(0.15, 0.6, streak)) * mix(0.82, 0.97, aer), lace);",
  "a *= smoothstep(0.0, 0.9, dS - viewZ);",
  "a *= smoothstep(-0.2, 0.6, vPW.y);",
  // where it starts on the river it comes in over a metre, as the river goes
  "a *= smoothstep(0.0, 0.9, vB.y);",
  "if (a < 0.02) discard;",
  "gl_FragColor = vec4(c, a);",
].join("\n");

// The foam pool. vA: the middle (x, z) where the fall lands, the boil's radius R, how far out the disc (0..1). vB: out to sea (x, z).
const POOL_MAIN = [
  VIEW,
  "vec3 bed = eye - V * (dS / max(dot(-V, fwd), 1e-3));",
  "float depth = vPW.y - bed.y;",
  "vec2 p = vPW.xz - vA.xy; float R = vA.z; vec2 dir = vB.xy; vec2 side = vec2(-dir.y, dir.x);",
  "float d = length(p); vec2 n = p / max(d, 1e-3); float rr = d / R;",
  "float fw = dot(p, dir) / R; float sw = dot(p, side) / R;",
  // the churn, in the world's own coordinates: foam boiling up where it lands and pushed outward, two looks at the noise
  // half a cycle apart cross-faded, so it streams out for ever and never stretches
  `float ph = T * ${cyc(0.3)}; float f1 = fract(ph); float f2 = fract(ph + 0.5); float w1 = 1.0 - abs(f1 * 2.0 - 1.0);`,
  "vec2 o1 = n * f1 * R * 0.45; vec2 o2 = n * f2 * R * 0.45;",
  "float ch = mix(texture2D(uNoise, (p - o2) / 3.2 + 0.61).g, texture2D(uNoise, (p - o1) / 3.2 + 0.17).g, w1);",
  "float cf = mix(texture2D(uNoise, (p - o2) / 1.25 + 0.33).a, texture2D(uNoise, (p - o1) / 1.25 + 0.91).a, w1);",
  "float boil = ch * 0.65 + (cf - 0.5) * 0.5 * near;",
  // the white mass where it lands, ragged at its edge
  "float core = 1.0 - smoothstep(0.3, 0.95, rr + (ch - 0.5) * 0.7 + (cf - 0.5) * 0.25);",
  // rings spreading from it, three at once, each wobbling, widening and fading as it goes, broken into lace
  "float wob = (texture2D(uNoise, vPW.xz / 9.0 + 0.4).r - 0.5) * 0.5 + (ch - 0.5) * 0.15;",
  "float ring = 0.0;",
  "for (int i = 0; i < 3; i++) {",
  `  float t = fract(T * ${cyc(0.2)} + float(i) / 3.0);`,
  "  float rad = 0.55 + 1.5 * t;",
  "  float wid = 0.05 + 0.14 * t;",
  "  ring = max(ring, (1.0 - smoothstep(wid * 0.4, wid, abs(rr + wob - rad))) * pow(1.0 - t, 1.4) * smoothstep(0.0, 0.1, t));",
  "}",
  "ring *= smoothstep(0.32, 0.62, cf * 0.8 + ch * 0.4);",
  // out to sea: a plume of milky water drifting off, scummed with foam, melting into the sea
  "float pl = length(vec2((fw - 0.9) / 2.5, sw / (1.1 + 0.25 * max(fw, 0.0))));",
  "float plume = 1.0 - smoothstep(0.35, 1.0, pl + (ch - 0.5) * 0.35);",
  "float scum = smoothstep(0.6, 0.85, cf * 0.55 + ch * 0.6) * plume * (1.0 - smoothstep(0.2, 0.9, pl)) * (1.0 - core);",
  "float foam = clamp(smoothstep(0.3, 0.62, core * (0.75 + boil * 0.5)) + ring * 0.85 + scum * 0.5, 0.0, 1.0);",
  FOAM_LIT,
  "vec3 c = mix(uMilk * mix(0.78, 1.04, sh), foamLit * (0.85 + 0.28 * boil), foam);",
  "c = mix(c, uFogCol, fogK);",
  "float milk = max(plume * 0.5, (1.0 - smoothstep(0.3, 1.4, rr)) * 0.6);",
  "float a = max(foam * 0.95, milk) * smoothstep(0.0, 0.25, depth) * (1.0 - smoothstep(0.75, 1.0, vA.w));",
  "if (a < 0.02) discard;",
  "gl_FragColor = vec4(c, a);",
].join("\n");

// A material lit as the land is (the stage's sun, sky, haze and the sun's shadow map), its look in `main`;
// attrs: [[name, size], ...] handed on as vA, vB, vC, vD.
function waterMaterial(key, attrs, main, uniforms, opts = {}) {
  const G = window.KIT.G;
  const m = new THREE.MeshLambertMaterial({ transparent: true, depthWrite: !!opts.depthWrite, side: opts.side || THREE.FrontSide });
  if (opts.offset) {
    m.polygonOffset = true;
    m.polygonOffsetFactor = -1;
    m.polygonOffsetUnits = -4;
  }
  const pad = ["", "", ", 0.0, 0.0", ", 0.0", ""];
  const vary = attrs.map(([a, n], i) => `v${"ABCD"[i]} = vec4(${a}${pad[n]});`).join(" ");
  m.onBeforeCompile = (sh) => {
    for (const k of ["uSunDir", "uSunCol", "uSkyCol", "uGndCol", "uFogCol", "uFog"]) sh.uniforms[k] = G[k];
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader =
      attrs.map(([a, n]) => `attribute ${n === 4 ? "vec4" : `vec${n}`} ${a};`).join(" ") +
      "\nvarying vec3 vPW; varying vec3 vNW; varying vec4 vA; varying vec4 vB; varying vec4 vC; varying vec4 vD;\n" +
      sh.vertexShader.replace(
        "#include <project_vertex>",
        "#include <project_vertex>\n  vPW = (modelMatrix * vec4(transformed, 1.0)).xyz; vNW = normalize(mat3(modelMatrix) * objectNormal);" +
          `\n  vA = vB = vC = vD = vec4(0.0); ${vary}`,
      );
    sh.fragmentShader =
      COMMON_FRAG +
      "\n" +
      sh.fragmentShader
        .replace("reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();", "float pShadow = getShadowMask();")
        .replace("gl_FragColor = vec4( outgoingLight, diffuseColor.a );", main);
  };
  m.customProgramCacheKey = () => key;
  return m;
}

const MIST_VS = [
  "attribute vec4 aP0; attribute vec4 aVel; attribute vec4 aRnd; attribute vec2 aKind;",
  "uniform float uFlowT;",
  "varying vec2 vUv; varying float vLife; varying float vSeed; varying vec3 vPW; varying float vKind;",
  "void main() {",
  "  float T = uFlowT;",
  // each puff lives a few seconds: born low and small, it rises, swells and fades; the foam heaves up, rolls and sinks
  "  float life = fract(T * aVel.w + aRnd.x);",
  "  vec3 c = aP0.xyz + aVel.xyz * life * (0.6 + 0.8 * aRnd.y);",
  `  c.x += sin(T * ${ang(0.37)} + aRnd.z * 6.28) * 0.5;`,
  `  c.z += cos(T * ${ang(0.29)} + aRnd.w * 6.28) * 0.5;`,
  "  float size = aP0.w;",
  "  vLife = 1.0;",
  "  if (aKind.x < 0.5) {",
  "    size *= mix(0.45, 1.3, sqrt(life));",
  "    vLife = smoothstep(0.0, 0.2, life) * (1.0 - smoothstep(0.4, 1.0, life));",
  "  } else if (aKind.x < 1.5) {",
  "    size *= mix(0.55, 1.15, smoothstep(0.0, 0.45, life));",
  "    vLife = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.55, 1.0, life));",
  "    c.y -= life * life * aP0.w * 0.45;",
  "  } else {",
  "    c = aP0.xyz;",
  `    size *= 1.0 + 0.06 * sin(T * ${ang(0.5)} + aRnd.z * 6.28);`,
  "  }",
  "  float rot = aRnd.w * 6.2832 + T * aKind.y;",
  "  vec2 q = mat2(cos(rot), sin(rot), -sin(rot), cos(rot)) * position.xy;",
  "  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);",
  "  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);",
  "  vPW = c + (right * q.x + up * q.y) * size;",
  "  vUv = position.xy;",
  "  vSeed = aRnd.z;",
  "  vKind = aKind.x;",
  "  gl_Position = projectionMatrix * viewMatrix * vec4(vPW, 1.0);",
  "}",
].join("\n");
const MIST_FS = [
  "uniform sampler2D tStillDepth; uniform sampler2D uNoise; uniform vec2 uCam; uniform vec2 uRes;",
  "uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uFogCol; uniform vec3 uFog; uniform vec3 uFoam;",
  "varying vec2 vUv; varying float vLife; varying float vSeed; varying vec3 vPW; varying float vKind;",
  LIN_FN,
  "void main() {",
  "  float n = texture2D(uNoise, vUv * 0.3 + vSeed * 7.3).g;",
  "  float n2 = texture2D(uNoise, vUv * 0.85 + vSeed * 3.1).a;",
  "  float r = length(vUv) * 2.0;",
  "  vec3 fwd = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);",
  "  float viewZ = dot(vPW - cameraPosition, fwd);",
  "  float dS = rvLin(texture2D(tStillDepth, gl_FragCoord.xy / uRes).r);",
  "  vec3 Vd = normalize(vPW - cameraPosition);",
  // spray is bright: lit through by the sun behind it, and never darker than foam
  "  float fs = pow(max(dot(Vd, uSunDir), 0.0), 3.0);",
  "  vec3 foamLit = uFoam * (uSunCol * 0.45 + uSkyCol * 0.62 + 0.1);",
  "  vec3 c = max(uFoam * (uSunCol * 0.8 * (0.45 + 1.1 * fs) + uSkyCol), foamLit);",
  "  float a;",
  "  float soft = 2.5;",
  "  if (vKind < 0.5) {",
  "    a = (1.0 - smoothstep(0.05, 1.0, r + (n - 0.5) * 0.7)) * vLife * 0.18;",
  "  } else if (vKind < 1.5) {",
  // churning foam: lumpy, nearly solid, lit from above
  "    a = (1.0 - smoothstep(0.38, 0.95, r + (n - 0.5) * 0.55 + (n2 - 0.5) * 0.4)) * vLife * 0.78;",
  "    c = foamLit * (0.84 + 0.26 * n2) * mix(0.9, 1.06, vUv.y + 0.5);",
  "    soft = 0.6;",
  "  } else {",
  "    a = (1.0 - smoothstep(0.0, 1.0, r + (n - 0.5) * 0.45)) * 0.13;",
  "  }",
  // soft where it meets the rock and the sea
  "  a *= smoothstep(0.0, soft, dS - viewZ) * smoothstep(-0.25, 0.8, vPW.y);",
  "  if (a < 0.008) discard;",
  "  c = mix(c, uFogCol, smoothstep(uFog.x, uFog.y, length(vPW - cameraPosition)) * 0.94);",
  "  gl_FragColor = vec4(c, a);",
  "}",
].join("\n");

// ------------------------------------------------------------------ the rivers

export function makeRivers(stage, opts = {}) {
  const G = window.KIT.G;
  const S = stage.shared;
  const { ribbons, falls } = riverShapes(opts.height || naturalAt);
  const U = {
    tStill: S.tStill,
    tStillDepth: S.tStillDepth,
    uCam: S.uCam,
    uRes: S.uRes,
    // the stage's clock, wrapped (see WRAP)
    uFlowT: { value: 0 },
    uNoise: { value: noiseTexture() },
    uShallow: { value: v3(RIVER_LOOK.shallow) },
    uDeep: { value: v3(RIVER_LOOK.deep) },
    uGlassy: { value: v3(RIVER_LOOK.glassy) },
    uFoam: { value: v3(RIVER_LOOK.foam) },
    uMilk: { value: v3(RIVER_LOOK.milk) },
    uSkyLow: { value: v3(RIVER_LOOK.skyLow) },
    uSkyHigh: { value: v3(RIVER_LOOK.skyHigh) },
  };
  const clock = () => {
    U.uFlowT.value = S.uTime.value % WRAP;
  };
  const group = new THREE.Group();
  group.name = "rivers";
  const parts = [];
  const add = (name, geo, mat, order, shadows = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.renderOrder = order;
    m.receiveShadow = shadows;
    m.onBeforeRender = clock;
    group.add(m);
    parts.push(m);
    return m;
  };
  const RIVER_ATTRS = [
    ["aFlow", 4],
    ["aFrame", 4],
    ["aLook", 4],
    ["aLook2", 2],
  ];
  add("river", ribbonGeometry(ribbons), waterMaterial("glade-river", RIVER_ATTRS, RIVER_MAIN, U, { depthWrite: true, offset: true }), 1);
  const SHEET_ATTRS = [
    ["aSheet", 4],
    ["aLead", 2],
  ];
  add("falls", sheetGeometry(falls), waterMaterial("glade-falls", SHEET_ATTRS, SHEET_MAIN, U, { side: THREE.DoubleSide }), 3);
  const POOL_ATTRS = [
    ["aPool", 4],
    ["aPoolDir", 2],
  ];
  add("foam", poolGeometry(falls), waterMaterial("glade-foam", POOL_ATTRS, POOL_MAIN, U), 2);
  const mistMat = new THREE.ShaderMaterial({
    vertexShader: MIST_VS,
    fragmentShader: MIST_FS,
    uniforms: {
      tStillDepth: S.tStillDepth,
      uCam: S.uCam,
      uRes: S.uRes,
      uFlowT: U.uFlowT,
      uNoise: U.uNoise,
      uSunDir: G.uSunDir,
      uSunCol: G.uSunCol,
      uSkyCol: G.uSkyCol,
      uFogCol: G.uFogCol,
      uFog: G.uFog,
      uFoam: U.uFoam,
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mist = add("mist", mistGeometry(sprayOf(ribbons, falls)), mistMat, 4, false);
  mist.frustumCulled = false;
  stage.moving(group);
  return {
    group,
    update() {},
    dispose() {
      for (const m of parts) {
        m.geometry.dispose();
        m.material.dispose();
      }
    },
  };
}
