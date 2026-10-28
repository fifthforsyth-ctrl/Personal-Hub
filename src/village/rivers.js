// The village's rivers and waterfalls: the two rivers of ./coast.js as water
// that runs from their springs in the hills, down the beds cut for them, to
// the cliffs, where each pours over the lip into the sea.
//
// Drawn every frame in the stage's moving layer over the still picture of the
// land (Glade.shared). The river reads the picture's depth to know how deep
// it stands over its bed: clear and showing the bed at its edges, a fresh
// green in the middle. Ripples and streaks run downstream, quicker and white
// where it drops; the sky shows in it at a glancing angle and the sun glints
// on it. At each cliff a sheet of white water leaves the lip in a little arc,
// falls clear of the face in streaks, lacy at its edges, and churns into a
// pool of foam on the sea with rings spreading from it and mist drifting up.
//
//   const rivers = makeRivers(stage, { height })   ->  { group, update(t), dispose() }   (the group is in the moving layer)
//     height(x, z): the ground the terrain is drawn from (coast.js naturalAt unless given; pads never reach the rivers)
//   riverShapes(height)   ->  { ribbons, falls, H }   the shapes alone, no three.js objects (for checks; H is the ground they sit on)
//
// Everything moves in its shaders from stage.shared.uTime, so update() has
// nothing to do. Four draw calls: the rivers, the falls, the foam pools, the mist.

import * as THREE from "three";
import { RIVERS, naturalAt, smooth } from "./coast.js";
import { noiseTexture } from "./glade.js";
import { STEP } from "./terrain.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
const v3 = (hex) => {
  const c = lin(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
};

// Fresh water: greener and brighter than the sea (water.js SEA_LOOK), milky where the falls churn it.
export const RIVER_LOOK = {
  shallow: "#a4dcc0",
  deep: "#3a9c8c",
  glassy: "#5fae9f",
  foam: "#f7f8f3",
  milk: "#b9e6dc",
  skyLow: "#dfe9ee",
  skyHigh: "#8fb4dc",
};

// How far the water reaches past its bed's edge each side: the banks hide what is over them, and where a bank
// lies low the water spills a little way onto it, fading out before the ribbon's edge.
const MARGIN = 2.4;
// Across each river: this many vertices.
const ACROSS = 7;
// How far the surface sinks as it speeds up toward the lip, and how far over the level of its bed's brim it stands elsewhere.
const DRAWDOWN = 0.55;
const RAISE = 0.12;
const GRAVITY = 9.8;

// ------------------------------------------------------------------ the ground as drawn

// The ground as the terrain's mesh draws it: heights on its STEP grid, each
// square split along the diagonal terrain.js picks, so the water fits what is seen.
export function meshGround(height = naturalAt) {
  const cache = new Map();
  const at = (i, j) => {
    const k = i * 100003 + j;
    let h = cache.get(k);
    if (h === undefined) cache.set(k, (h = height(i * STEP, j * STEP)));
    return h;
  };
  return (x, z) => {
    const fx = x / STEP;
    const fz = z / STEP;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const a = at(i, j);
    const b = at(i + 1, j);
    const c = at(i, j + 1);
    const d = at(i + 1, j + 1);
    if (Math.abs(a - d) < Math.abs(b - c)) return u >= v ? a + (b - a) * u + (d - b) * v : a + (c - a) * v + (d - c) * u;
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  };
}

// ------------------------------------------------------------------ the shapes

// How fast the water runs (m/s) down a grade (metres down for each metre along).
const speedOf = (grade) => clamp(0.55 + grade * 9, 0.55, 4.5);

// Where a river's bed falls away at the cliff: how far along the fall's
// direction from its point (negative is upstream), found under the middle.
function lipOf(rv, H) {
  const f = rv.fall;
  for (let d = -16; d <= 4; d += 0.05) if (H(f.x + f.dx * d, f.z + f.dz * d) < f.top - 1.9) return d - 0.05;
  return 0;
}

// One river's surface: rows across it from the spring to the lip.
// Returns { rows: [{ x, z, y, s, tau, w, tx, tz, nx, ny, nz, fast, grade }], lip: { x, z, y, w, d, tau, v } }.
function ribbonOf(rv, H) {
  const f = rv.fall;
  const lipD = lipOf(rv, H);
  const S = rv.samples;
  // the middle line: the samples short of the lip, then the lip itself
  const pts = [];
  for (const s of S) {
    if ((s.x - f.x) * f.dx + (s.z - f.z) * f.dz > lipD - 0.4) break;
    pts.push({ x: s.x, z: s.z, s: s.s, level: s.level, w: s.w });
  }
  const last = pts[pts.length - 1];
  const lx = f.x + f.dx * lipD;
  const lz = f.z + f.dz * lipD;
  const lipS = last.s + Math.hypot(lx - last.x, lz - last.z);
  pts.push({ x: lx, z: lz, s: lipS, level: f.top, w: f.w });
  // finer toward the lip, where the water bends down and the bank breaks off
  const fine = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = b.s > lipS - 12 ? Math.max(1, Math.ceil((b.s - a.s) / 0.75)) : 1;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const at = (k) => a[k] + (b[k] - a[k]) * t;
      fine.push({ x: at("x"), z: at("z"), s: at("s"), level: at("level"), w: at("w") });
    }
  }
  // the spring: the water a little past the first sample, where the bed's round end holds it
  const p0 = fine[0];
  const p1 = fine[1];
  const L0 = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  const back = p0.w / 2 + 1;
  fine.unshift({ x: p0.x - ((p1.x - p0.x) / L0) * back, z: p0.z - ((p1.z - p0.z) / L0) * back, s: -back, level: p0.level, w: p0.w });
  const n = fine.length;
  // the grade, over a couple of dozen metres so the speed changes gently
  const grade = fine.map((p, i) => {
    let a = i;
    let b = i;
    while (a > 0 && p.s - fine[a - 1].s <= 12) a--;
    while (b < n - 1 && fine[b + 1].s - p.s <= 12) b++;
    return b > a ? Math.max(0, (fine[a].level - fine[b].level) / (fine[b].s - fine[a].s)) : 0;
  });
  // the surface: a little over the bed's brim, more where it runs steep (so it meets the bank on its smooth rise, past
  // the terrain's coarse steps), sinking as it speeds to the lip
  const raise = grade.map((g, i) => (RAISE + Math.min(0.22, g * 0.6)) * (1 - smooth(lipS - 16, lipS - 5, fine[i].s)));
  const surf = (i) => fine[i].level + raise[i] - DRAWDOWN * smooth(lipS - 9, lipS, fine[i].s) ** 2;
  const rows = [];
  let tau = 0;
  let vPrev = 0;
  for (let i = 0; i < n; i++) {
    const p = fine[i];
    const a = fine[Math.max(0, i - 1)];
    const b = fine[Math.min(n - 1, i + 1)];
    const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const tx = (b.x - a.x) / L;
    const tz = (b.z - a.z) / L;
    const brink = smooth(lipS - 12, lipS, p.s);
    const v = speedOf(grade[i]) + brink * 1.8;
    if (i) tau += ((p.s - fine[i - 1].s) * 2) / (v + vPrev);
    vPrev = v;
    const y = surf(i);
    // the surface tilts down the grade: its normal leans downstream
    let ia = i;
    let ib = i;
    while (ia > 0 && p.s - fine[ia - 1].s <= 5) ia--;
    while (ib < n - 1 && fine[ib + 1].s - p.s <= 5) ib++;
    const gy = (surf(ib) - surf(ia)) / (fine[ib].s - fine[ia].s || 1);
    const NL = Math.hypot(gy, 1);
    const fast = clamp(smooth(0.03, 0.24, grade[i]) * 0.85 + brink * 0.75, 0, 1);
    rows.push({ x: p.x, z: p.z, y, s: p.s, tau, w: p.w, tx, tz, nx: (-tx * gy) / NL, ny: 1 / NL, nz: (-tz * gy) / NL, fast, grade: grade[i] });
  }
  // white water is carried on a little way below a rapid before it clears
  for (let i = 1; i < rows.length; i++) rows[i].fast = Math.max(rows[i].fast, rows[i - 1].fast * Math.exp(-(rows[i].s - rows[i - 1].s) / 14));
  const end = rows[rows.length - 1];
  return { rows, lip: { x: lx, z: lz, y: end.y, w: f.w, d: lipD, tau: end.tau, v: speedOf(grade[n - 1]) + 1.8 } };
}

// One waterfall: a sheet from the lip down past the sea's face, columns across and rows down.
// Returns { cols, rows, pos: Float32Array (cols * rows * 3, row by row), sheet: per vertex [u, flight time, drop 0..1, half width],
// impact: { x, z } where its middle meets the sea, hwBottom, drop, dir: [dx, dz] }.
function sheetOf(rv, lip, H) {
  const f = rv.fall;
  const dx = f.dx;
  const dz = f.dz;
  const sx = -dz;
  const sz = dx;
  const y0 = lip.y;
  const yb = -0.7;
  const drop = y0;
  const hw = (lip.w / 2) * 0.86;
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
  const pos = new Float32Array(NU * NV * 3);
  const sheet = new Float32Array(NU * NV * 4);
  for (let k = 0; k < NV; k++)
    for (let j = 0; j < NU; j++) {
      const u = (j / (NU - 1)) * 2 - 1;
      const v = k * NU + j;
      const lat = u * W[k];
      pos[v * 3] = lip.x + sx * lat + dx * X[j][k];
      pos[v * 3 + 1] = Y[k];
      pos[v * 3 + 2] = lip.z + sz * lat + dz * X[j][k];
      sheet.set([u, tf[k], (y0 - Y[k]) / (y0 - yb), W[k]], v * 4);
    }
  // where the middle column meets the sea
  const mid = (NU - 1) / 2;
  let xi = X[mid][NV - 1];
  for (let k = 1; k < NV; k++)
    if (Y[k] <= 0) {
      const t = Y[k - 1] / (Y[k - 1] - Y[k]);
      xi = X[mid][k - 1] + (X[mid][k] - X[mid][k - 1]) * t;
      break;
    }
  return { cols: NU, rows: NV, pos, sheet, impact: { x: lip.x + dx * xi, z: lip.z + dz * xi }, lip, hw, hwBottom: W[NV - 1], drop, dir: [dx, dz] };
}

// Both rivers' shapes: their surfaces and their falls.
export function riverShapes(height = naturalAt) {
  const H = meshGround(height);
  const ribbons = [];
  const falls = [];
  for (const rv of RIVERS) {
    const rb = ribbonOf(rv, H);
    ribbons.push(rb);
    falls.push(sheetOf(rv, rb.lip, H));
  }
  return { ribbons, falls, H };
}

// ------------------------------------------------------------------ the geometry

function ribbonGeometry(ribbons, H) {
  let nv = 0;
  let ni = 0;
  for (const r of ribbons) {
    nv += r.rows.length * ACROSS;
    ni += (r.rows.length - 1) * (ACROSS - 1) * 6;
  }
  const pos = new Float32Array(nv * 3);
  const nor = new Float32Array(nv * 3);
  const flow = new Float32Array(nv * 4);
  const frame = new Float32Array(nv * 4);
  const idx = new Uint32Array(ni);
  let v = 0;
  let q = 0;
  for (const r of ribbons) {
    const base = v;
    for (const row of r.rows) {
      const hw = row.w / 2;
      const reach = hw + MARGIN;
      for (let j = 0; j < ACROSS; j++) {
        const a = ((j / (ACROSS - 1)) * 2 - 1) * reach;
        const x = row.x - row.tz * a;
        const z = row.z + row.tx * a;
        pos.set([x, row.y, z], v * 3);
        nor.set([row.nx, row.ny, row.nz], v * 3);
        flow.set([row.tau, a, hw, row.fast], v * 4);
        // whether there is bed under it (none past the cliff's edge)
        const hold = smooth(row.y - 2.7, row.y - 2.0, H(x, z));
        frame.set([row.tx, row.tz, row.s, hold], v * 4);
        v++;
      }
    }
    for (let i = 0; i < r.rows.length - 1; i++)
      for (let j = 0; j < ACROSS - 1; j++) {
        const a = base + i * ACROSS + j;
        const b = a + 1;
        const c = a + ACROSS;
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
  const idx = new Uint32Array(ni);
  let v0 = 0;
  let q = 0;
  for (const f of falls) {
    const { cols, rows } = f;
    pos.set(f.pos, v0 * 3);
    sheet.set(f.sheet, v0 * 4);
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
        // facing the sea
        if (n[0] * f.dir[0] + n[2] * f.dir[1] < 0) n = n.map((e) => -e);
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
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

// The foam pool at each fall's foot: a disc on the sea, longer out from the cliff than across.
const POOL_RINGS = 9;
const POOL_SEGS = 40;
function poolOf(f) {
  const R = f.hwBottom * 1.5 + f.drop * 0.2;
  const [dx, dz] = f.dir;
  return { R, cx: f.impact.x + dx * R * 0.18, cz: f.impact.z + dz * R * 0.18, ra: R * 1.15, rs: R * 0.95, dx, dz };
}
function poolGeometry(falls) {
  const per = (POOL_RINGS + 1) * (POOL_SEGS + 1);
  const pos = new Float32Array(falls.length * per * 3);
  const nor = new Float32Array(falls.length * per * 3);
  const pool = new Float32Array(falls.length * per * 4);
  const idx = [];
  falls.forEach((f, fi) => {
    const p = poolOf(f);
    const base = fi * per;
    for (let i = 0; i <= POOL_RINGS; i++)
      for (let k = 0; k <= POOL_SEGS; k++) {
        const r = (i / POOL_RINGS) ** 1.3;
        const a = (k / POOL_SEGS) * Math.PI * 2;
        const ca = Math.cos(a) * r * p.ra;
        const sa = Math.sin(a) * r * p.rs;
        const v = base + i * (POOL_SEGS + 1) + k;
        pos.set([p.cx + p.dx * ca - p.dz * sa, 0.06, p.cz + p.dz * ca + p.dx * sa], v * 3);
        nor.set([0, 1, 0], v * 3);
        pool.set([r, k / POOL_SEGS, p.R, fi * 0.37 + 0.11], v * 4);
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
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(idx), 1));
  g.computeBoundingSphere();
  return g;
}

// Where spray rises: each fall's foot, and the steepest rapids of each river.
// Each is { x, y, z, n (puffs), across, out (how far they spread each way), dx, dz (out from the fall, or downstream), size, rise, drift }.
function sprayOf(ribbons, falls) {
  const list = [];
  for (const f of falls) {
    const [dx, dz] = f.dir;
    const foot = { x: f.impact.x, y: 0.3, z: f.impact.z, n: 30, across: f.hwBottom * 1.25, out: f.hwBottom * 0.9, dx, dz };
    list.push({ ...foot, size: 2.2 + f.drop * 0.12, rise: f.drop * 0.45, drift: 2.5 });
    // the splash itself: small, low, quick
    list.push({ x: f.impact.x, y: 0.2, z: f.impact.z, n: 14, across: f.hwBottom * 0.9, out: f.hwBottom * 0.5, dx, dz, size: 1.4, rise: 3.5, drift: 1.5 });
  }
  for (const r of ribbons) {
    // the steepest places a good way apart, short of the brink (the falls have their own)
    const rows = r.rows;
    const lipS = rows[rows.length - 1].s;
    const picks = [];
    const order = rows
      .map((row, i) => i)
      .filter((i) => rows[i].grade > 0.16 && rows[i].s < lipS - 30)
      .sort((a, b) => rows[b].grade - rows[a].grade);
    for (const i of order) {
      if (picks.length >= 4) break;
      if (picks.some((j) => Math.abs(rows[j].s - rows[i].s) < 30)) continue;
      picks.push(i);
    }
    for (const i of picks) {
      const row = rows[i];
      list.push({ x: row.x, y: row.y + 0.2, z: row.z, n: 6, across: row.w * 0.35, out: 2.5, dx: row.tx, dz: row.tz, size: 1.5, rise: 1.4, drift: 1.6 });
    }
  }
  return list;
}

// The mist: soft puffs rising from each place of spray, each a quad turned to the eye.
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
  const n = emitters.reduce((a, e) => a + e.n, 0);
  const p0 = new Float32Array(n * 4);
  const vel = new Float32Array(n * 4);
  const rr = new Float32Array(n * 4);
  let i = 0;
  for (const e of emitters) {
    const sx = -e.dz;
    const sz = e.dx;
    for (let k = 0; k < e.n; k++, i++) {
      const across = (rnd() * 2 - 1) * e.across;
      const out = (rnd() - 0.25) * e.out;
      p0.set([e.x + sx * across + e.dx * out, e.y + rnd() * 1.0, e.z + sz * across + e.dz * out, e.size * (0.7 + rnd() * 0.6)], i * 4);
      // drifting out (over the sea, or downstream) and a little east on the breeze, rising
      const drift = e.drift * (0.6 + rnd() * 0.9);
      vel.set([e.dx * drift + 1.0 + sx * across * 0.25, e.rise * (0.6 + rnd() * 0.6), e.dz * drift + sz * across * 0.25, 0.09 + rnd() * 0.07], i * 4);
      rr.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    }
  }
  const quad = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex(quad.getIndex());
  g.setAttribute("position", quad.getAttribute("position"));
  g.setAttribute("aP0", new THREE.InstancedBufferAttribute(p0, 4));
  g.setAttribute("aVel", new THREE.InstancedBufferAttribute(vel, 4));
  g.setAttribute("aRnd", new THREE.InstancedBufferAttribute(rr, 4));
  g.instanceCount = n;
  quad.dispose();
  return g;
}

// ------------------------------------------------------------------ the paint

const LIN_FN = "float rvLin(float d) { float z = d * 2.0 - 1.0; return 2.0 * uCam.x * uCam.y / (uCam.y + uCam.x - z * (uCam.y - uCam.x)); }";
const COMMON_FRAG = [
  `#define RV_MARGIN ${MARGIN.toFixed(2)}`,
  "uniform sampler2D tStill; uniform sampler2D tStillDepth; uniform vec2 uCam; uniform vec2 uRes; uniform float uFlowT; uniform sampler2D uNoise;",
  "uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uGndCol; uniform vec3 uFogCol; uniform vec3 uFog;",
  "uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uGlassy; uniform vec3 uFoam; uniform vec3 uMilk; uniform vec3 uSkyLow; uniform vec3 uSkyHigh;",
  "varying vec3 vPW; varying vec3 vNW; varying vec4 vA;",
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
].join("\n");

// The river's surface. vA: flow time (s, larger downstream), across (m from the middle), half width (m), how fast 0..1.
const RIVER_MAIN = [
  VIEW,
  // the bed under this point: back along the ray to the still picture's depth
  "vec3 bed = eye - V * (dS / max(dot(-V, fwd), 1e-3));",
  "float depth = clamp(vPW.y - bed.y, 0.0, 4.0);",
  "float hold = vB.w;",
  "if (depth < 0.004 || hold < 0.004) discard;",
  "float tau = vA.x; float ac = vA.y; float fast = vA.w; float T = uFlowT;",
  "vec3 D = normalize(vec3(vB.x, 0.0, vB.y)); vec3 Sd = vec3(-D.z, 0.0, D.x);",
  // ripples: three sizes carried downstream (the along coordinate is the water's own time, so fast water draws them out)
  "vec4 r1 = texture2D(uNoise, vec2(ac / 13.0 + 0.13, (tau - T) / 20.0));",
  "vec4 r2 = texture2D(uNoise, vec2(ac / 4.5 + 0.61, (tau - T * 0.9) / 5.0));",
  "vec4 r3 = texture2D(uNoise, vec2(ac / 1.7 + 0.29, (tau - T * 1.1) / 2.0));",
  // the finer sizes only near enough to see them, else they shimmer into fine bands across the stream
  "float n2 = 1.0 - smoothstep(70.0, 280.0, camD); float n3 = 1.0 - smoothstep(25.0, 120.0, camD);",
  "vec2 sl = (r1.rg - 0.5) * 0.3 + (r2.ga - 0.5) * 0.32 * n2 + (r3.ag - 0.5) * 0.24 * n3;",
  "sl *= 0.7 + fast * 1.1;",
  // far off, seen at a glancing angle, a tilt along the stream would show as fine bands of sky across it
  "sl.y *= 1.0 - 0.7 * smoothstep(110.0, 380.0, camD);",
  "vec3 N = normalize(normalize(vNW) + Sd * sl.x + D * sl.y);",
  // what shows through: the bed, bent a little, with the sun's light dancing on it in the shallows
  "vec2 ruv = uv + sl * 0.008 * smoothstep(0.0, 0.5, depth) * near;",
  "if (rvLin(texture2D(tStillDepth, ruv).r) < viewZ) ruv = uv;",
  "vec3 under = texture2D(tStill, ruv).rgb;",
  "float clear = exp(-depth * 2.1);",
  "vec2 cp = bed.xz * 0.11;",
  "float k1 = texture2D(uNoise, cp + vec2(T * 0.021, T * 0.013)).a;",
  "float k2 = texture2D(uNoise, cp * 1.37 + vec2(0.53 - T * 0.017, 0.29 + T * 0.024)).a;",
  "float caus = pow(clamp(1.0 - abs(k1 - k2) * 1.7, 0.0, 1.0), 5.0) * (1.0 - smoothstep(30.0, 110.0, camD)) * sh * (1.0 - smoothstep(0.15, 0.7, depth));",
  "under *= mix(vec3(1.0), uShallow * 1.5, 0.5);",
  "under += uSunCol * uShallow * caus * 0.22 * smoothstep(0.02, 0.2, depth);",
  // the water's own colour: a fresh green over the shallows, deeper in the pools
  "float pool = texture2D(uNoise, vec2(0.37, vB.z / 80.0)).b;",
  "vec3 tint = mix(uShallow, uDeep, smoothstep(0.05, 1.1, depth));",
  "tint = mix(tint, uDeep * vec3(0.78, 0.9, 0.97), clamp((pool - 0.45) * 1.6, 0.0, 1.0) * smoothstep(0.4, 1.2, depth) * 0.6);",
  "tint *= mix(0.7, 1.0, sh);",
  "vec3 water = mix(tint, under, clear);",
  // the sky in it at a glancing angle, the sun's glints
  "float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);",
  "vec3 R = reflect(-V, N);",
  "vec3 sky = mix(uSkyLow, uSkyHigh, smoothstep(0.0, 0.5, R.y));",
  "vec3 c = mix(water, sky, clamp(fres, 0.0, 0.8));",
  "float rs = max(dot(R, uSunDir), 0.0);",
  "c += uSunCol * (pow(rs, 160.0) * 1.6 + pow(rs, 14.0) * 0.06) * sh;",
  // white water where it runs fast, in streaks drawn out along the flow; a broken lace of foam where it thins on the banks
  // (thickest down the middle, where it runs fastest), over water turned milky with the air churned into it
  "float fa = texture2D(uNoise, vec2(ac / 2.6 + 0.71, (tau - T * 1.15) / 9.0)).g;",
  "float fb = texture2D(uNoise, vec2(ac / 3.2 + 0.17, (tau - T * 1.15) / 4.0)).a;",
  "float mid = 1.0 - 0.45 * pow(clamp(abs(ac) / max(vA.z, 0.5), 0.0, 1.0), 2.0);",
  "float fz = fa * 0.8 + fb * 0.25 + (r1.b - 0.5) * 0.3;",
  "float fm = fast * mid;",
  "float white = smoothstep(0.8 - fm * 0.45, 1.02 - fm * 0.38, fz) * smoothstep(0.0, 0.25, fast);",
  "c = mix(c, uMilk * (0.72 + 0.3 * sh), smoothstep(0.2, 0.9, fm) * (0.3 + 0.35 * r1.b));",
  // far off, where the streaks would be smaller than a pixel and flicker, a veil of white in broad drifting patches instead
  "white = mix(white, smoothstep(0.1, 0.8, fast) * (0.35 + 0.65 * r1.b), smoothstep(140.0, 420.0, camD));",
  "float lb = texture2D(uNoise, vec2(ac / 7.0 + 0.9, (tau - T * 0.4) / 9.0)).g;",
  "float lace = (1.0 - smoothstep(0.02, 0.06 + fb * 0.1 + camD * 0.0003, depth)) * smoothstep(0.45, 0.65, lb * 0.8 + fb * 0.35);",
  "float foam = clamp(white + lace * 0.55, 0.0, 1.0);",
  "c = mix(c, uFoam * (uSunCol * 0.42 * sh + uSkyCol * 0.6 + 0.12), foam * 0.92);",
  "c = mix(c, uFogCol, fogK);",
  // the spring: water welling up in a round pool, small rings spreading from it
  "float sr = length(vec2(ac, min(vB.z, 0.0)));",
  "float sp = length(vec2(ac, vB.z)) / max(vA.z, 1.0);",
  "float well = (1.0 - smoothstep(0.0, 1.0, sp)) * smoothstep(0.55, 0.9, sin(sp * 9.0 - T * 2.4) * 0.5 + 0.5) * smoothstep(0.35, 0.6, fb + 0.2);",
  "c = mix(c, uFoam * (uSunCol * 0.42 * sh + uSkyCol * 0.6 + 0.12), well * 0.5 * smoothstep(-1.0, 0.0, -vB.z + 6.0));",
  // soft where it thins on the bed, before the ribbon's own edge where it spills onto a low bank, and round the spring
  "float spill = 1.0 - smoothstep(vA.z + RV_MARGIN - 1.5, vA.z + RV_MARGIN, abs(ac));",
  "spill *= 1.0 - smoothstep(vA.z - 0.3, vA.z + 0.7, sr);",
  "gl_FragColor = vec4(c, smoothstep(0.0, 0.14, depth) * hold * spill);",
].join("\n");

// The falling sheet. vA: across (-1..1), flight time (s), how far down (0 the lip, 1 under the sea), half width (m).
const SHEET_MAIN = [
  VIEW,
  "float u = vA.x; float tf = vA.y; float k = vA.z; float ac = u * vA.w;",
  "float T = uFlowT * 0.5;",
  // streaks falling: long down the sheet, narrow across it, longer as the water gathers speed
  "vec4 s1 = texture2D(uNoise, vec2(ac / 3.4 + 0.21, (tf - T) * 0.45));",
  "vec4 s2 = texture2D(uNoise, vec2(ac / 1.2 + 0.53, (tf - T) * 1.1));",
  "vec4 s3 = texture2D(uNoise, vec2(ac / 0.5 + 0.87, (tf - T) * 2.4));",
  "float streak = clamp((s1.g - 0.5) * 1.3 + (s2.a - 0.5) * 0.9 + (s3.a - 0.5) * 0.5 * near + 0.55, 0.0, 1.0);",
  // glassy green at the lip, white as it breaks up, brightest low down; the thin parts cool and grey
  "float aer = smoothstep(0.02, 0.2, k);",
  "vec3 alb = mix(uGlassy, uFoam, aer * clamp(0.3 + streak * 0.85, 0.0, 1.0));",
  "alb *= mix(0.62, 1.08, streak) * mix(0.86, 1.08, smoothstep(0.15, 0.9, k));",
  "alb = mix(alb * vec3(0.84, 0.92, 1.0), alb, smoothstep(0.2, 0.7, streak));",
  "vec3 N = normalize(vNW);",
  "#ifdef DOUBLE_SIDED",
  "  N *= gl_FrontFacing ? 1.0 : -1.0;",
  "#endif",
  // water scatters the light: the sun wraps round it, and it stays bright in shade
  "float wrap = clamp(dot(N, uSunDir) * 0.55 + 0.45, 0.0, 1.0);",
  "vec3 light = uSunCol * wrap * mix(0.35, 1.0, sh) * 0.8 + mix(uGndCol, uSkyCol, 0.5 + 0.5 * N.y) * 0.9 + uSkyCol * 0.15;",
  "vec3 c = alb * light;",
  "vec3 R = reflect(-V, N);",
  "c += uSunCol * pow(max(dot(R, uSunDir), 0.0), 40.0) * 0.3 * (1.0 - aer) * sh;",
  "c = mix(c, uFogCol, fogK);",
  // thick in the middle, lacy at the edges, streaky gaps; soft where it touches the rock and where it meets the sea
  "float edge = 1.0 - abs(u);",
  "float a = smoothstep(0.0, 0.2, edge * 1.7 + (streak - 0.5) * 0.9 - 0.14);",
  "a *= mix(0.62, 1.0, smoothstep(0.15, 0.6, streak)) * mix(0.82, 0.97, aer);",
  "a *= smoothstep(0.0, 0.9, dS - viewZ);",
  "a *= smoothstep(-0.2, 0.6, vPW.y);",
  "gl_FragColor = vec4(c, a);",
].join("\n");

// The foam pool. vA: how far out (0 the middle, 1 the rim), round (0..1), radius (m), a seed.
const POOL_MAIN = [
  VIEW,
  "vec3 bed = eye - V * (dS / max(dot(-V, fwd), 1e-3));",
  "float depth = vPW.y - bed.y;",
  "float r = vA.x; float ang = vA.y; float rr = r * vA.z; float T = uFlowT;",
  // churning: foam boiling up in the middle and pushed outward, rings of it spreading and breaking into lace
  "vec4 c1 = texture2D(uNoise, vec2(ang * 3.0 + vA.w, rr / 11.0 - T * 0.08));",
  "vec4 c2 = texture2D(uNoise, vec2(ang * 9.0 + vA.w * 1.7, rr / 4.0 - T * 0.22));",
  "vec4 c3 = texture2D(uNoise, vec2(ang * 17.0 + vA.w * 2.3, rr / 1.8 - T * 0.4));",
  "float boil = c1.g * 0.5 + c2.a * 0.4 + (c3.a - 0.5) * 0.35 * near;",
  // the white mass where it lands, ragged at its edge
  "float core = 1.0 - smoothstep(0.05, 0.5, r + (c2.g - 0.5) * 0.25);",
  // rings running out from it, broken into lace, fading as they go
  "float crest = pow(0.5 + 0.5 * sin(rr * 1.6 - T * 2.1 + c1.r * 3.0), 3.0) * (1.0 - smoothstep(0.3, 0.95, r)) * smoothstep(0.12, 0.35, r);",
  "crest *= smoothstep(0.3, 0.6, c2.a + c3.g * 0.3);",
  "float cover = core * 0.9 + crest * 0.75 + (boil - 0.45) * 0.7 * (1.0 - r * 0.6);",
  "float foam = smoothstep(0.3, 0.62, cover);",
  "float milk = (1.0 - smoothstep(0.1, 1.0, r)) * 0.6;",
  "vec3 lightF = uSunCol * 0.45 * sh + uSkyCol * 0.65 + 0.12;",
  "vec3 c = mix(uMilk * mix(0.8, 1.05, sh), uFoam * lightF * (0.8 + 0.28 * boil), foam);",
  "c = mix(c, uFogCol, fogK);",
  "float a = max(foam * 0.95, milk) * smoothstep(0.0, 0.25, depth);",
  "gl_FragColor = vec4(c, a);",
].join("\n");

// A material lit as the land is (the stage's sun, sky, haze and the sun's shadow map), its look in `main`.
function waterMaterial(key, attrs, main, uniforms, opts = {}) {
  const G = window.KIT.G;
  const m = new THREE.MeshLambertMaterial({ transparent: true, depthWrite: !!opts.depthWrite, side: opts.side || THREE.FrontSide });
  const vary = attrs.map((a, i) => `v${"AB"[i]} = ${a};`).join(" ");
  m.onBeforeCompile = (sh) => {
    for (const k of ["uSunDir", "uSunCol", "uSkyCol", "uGndCol", "uFogCol", "uFog"]) sh.uniforms[k] = G[k];
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader =
      attrs.map((a) => `attribute vec4 ${a};`).join(" ") +
      "\nvarying vec3 vPW; varying vec3 vNW; varying vec4 vA; varying vec4 vB;\n" +
      sh.vertexShader.replace(
        "#include <project_vertex>",
        `#include <project_vertex>\n  vPW = (modelMatrix * vec4(transformed, 1.0)).xyz; vNW = normalize(mat3(modelMatrix) * objectNormal); ${vary}`,
      );
    sh.fragmentShader =
      COMMON_FRAG +
      "\nvarying vec4 vB;\n" +
      sh.fragmentShader
        .replace("reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();", "float pShadow = getShadowMask();")
        .replace("gl_FragColor = vec4( outgoingLight, diffuseColor.a );", main);
  };
  m.customProgramCacheKey = () => key;
  return m;
}

const MIST_VS = [
  "attribute vec4 aP0; attribute vec4 aVel; attribute vec4 aRnd;",
  "uniform float uFlowT;",
  "varying vec2 vUv; varying float vLife; varying float vSeed; varying vec3 vPW;",
  "void main() {",
  // each puff lives a few seconds: born low and small, it rises, swells and fades
  "  float life = fract(uFlowT * aVel.w + aRnd.x);",
  "  vec3 c = aP0.xyz + aVel.xyz * life * (0.6 + 0.8 * aRnd.y);",
  "  c.x += sin(uFlowT * 0.37 + aRnd.z * 6.28) * 0.6;",
  "  c.z += cos(uFlowT * 0.29 + aRnd.w * 6.28) * 0.6;",
  "  float size = aP0.w * mix(0.45, 1.25, sqrt(life));",
  "  vLife = smoothstep(0.0, 0.2, life) * (1.0 - smoothstep(0.4, 1.0, life));",
  "  float rot = aRnd.w * 6.2832 + uFlowT * 0.15 * (aRnd.y - 0.5);",
  "  vec2 q = mat2(cos(rot), sin(rot), -sin(rot), cos(rot)) * position.xy;",
  "  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);",
  "  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);",
  "  vPW = c + (right * q.x + up * q.y) * size;",
  "  vUv = position.xy;",
  "  vSeed = aRnd.z;",
  "  gl_Position = projectionMatrix * viewMatrix * vec4(vPW, 1.0);",
  "}",
].join("\n");
const MIST_FS = [
  "uniform sampler2D tStillDepth; uniform sampler2D uNoise; uniform vec2 uCam; uniform vec2 uRes;",
  "uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uFogCol; uniform vec3 uFog; uniform vec3 uFoam;",
  "varying vec2 vUv; varying float vLife; varying float vSeed; varying vec3 vPW;",
  LIN_FN,
  "void main() {",
  "  float n = texture2D(uNoise, vUv * 0.3 + vSeed * 7.3).g;",
  "  float r = length(vUv) * 2.0 + (n - 0.5) * 0.7;",
  "  float puff = 1.0 - smoothstep(0.15, 1.0, r);",
  "  vec3 fwd = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);",
  "  float viewZ = dot(vPW - cameraPosition, fwd);",
  "  float dS = rvLin(texture2D(tStillDepth, gl_FragCoord.xy / uRes).r);",
  // soft where it meets the rock and the sea
  "  float a = puff * vLife * 0.3 * smoothstep(0.0, 3.0, dS - viewZ) * smoothstep(0.0, 1.6, vPW.y);",
  "  if (a < 0.003) discard;",
  "  vec3 c = uFoam * (uSunCol * 0.5 + uSkyCol * 0.95);",
  "  c = mix(c, uFogCol, smoothstep(uFog.x, uFog.y, length(vPW - cameraPosition)) * 0.94);",
  "  gl_FragColor = vec4(c, a);",
  "}",
].join("\n");

// ------------------------------------------------------------------ the rivers

export function makeRivers(stage, opts = {}) {
  const G = window.KIT.G;
  const S = stage.shared;
  const { ribbons, falls, H } = riverShapes(opts.height || naturalAt);
  const U = {
    tStill: S.tStill,
    tStillDepth: S.tStillDepth,
    uCam: S.uCam,
    uRes: S.uRes,
    uFlowT: S.uTime,
    uNoise: { value: noiseTexture() },
    uShallow: { value: v3(RIVER_LOOK.shallow) },
    uDeep: { value: v3(RIVER_LOOK.deep) },
    uGlassy: { value: v3(RIVER_LOOK.glassy) },
    uFoam: { value: v3(RIVER_LOOK.foam) },
    uMilk: { value: v3(RIVER_LOOK.milk) },
    uSkyLow: { value: v3(RIVER_LOOK.skyLow) },
    uSkyHigh: { value: v3(RIVER_LOOK.skyHigh) },
  };
  const group = new THREE.Group();
  group.name = "rivers";
  const parts = [];
  const add = (name, geo, mat, order, shadows = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.renderOrder = order;
    m.receiveShadow = shadows;
    group.add(m);
    parts.push(m);
    return m;
  };
  add("river", ribbonGeometry(ribbons, H), waterMaterial("glade-river", ["aFlow", "aFrame"], RIVER_MAIN, U, { depthWrite: true }), 1);
  add("falls", sheetGeometry(falls), waterMaterial("glade-falls", ["aSheet"], SHEET_MAIN, U, { side: THREE.DoubleSide }), 3);
  add("foam", poolGeometry(falls), waterMaterial("glade-foam", ["aPool"], POOL_MAIN, U), 2);
  const mistMat = new THREE.ShaderMaterial({
    vertexShader: MIST_VS,
    fragmentShader: MIST_FS,
    uniforms: {
      tStillDepth: S.tStillDepth,
      uCam: S.uCam,
      uRes: S.uRes,
      uFlowT: S.uTime,
      uNoise: U.uNoise,
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
