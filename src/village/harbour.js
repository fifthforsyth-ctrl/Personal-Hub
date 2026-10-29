// The town's fixed heart and its waterfront: the plaza at the head of the cove
// and the pier running out from the beach below it, built with the painterly
// kit (public/kit) so they stand in the same light and the same hand as the
// builds round them.
//
// The plaza is paved with soft cushioned flagstones in warm greys and buffs,
// in rings round the flag's stepped base and at random beyond, the grass
// creeping into the joints toward a chunky kerb that breaks where the town's
// lanes come in (its north corners, the middle of its north, east and west
// sides); here and there near the kerb a stone has gone and turf has taken its
// place. The Hub's orange swallowtail flies over it from a tall timber pole;
// lamps stand by the lanes and on the south wall, benches face the drill
// ground and the sea, a birch grows in a round stone bed in the south-west
// corner, and a well, a notice post with its papers and two fires burning in
// stone bowls give it a Nordic hearth. Its south side is a low wall looking
// over the beach, broken by broad steps down to the sand and by the boardwalk
// that slopes down to the pier, a lamp on a pier either side of its head.
//
// The pier is a deck of planks on pile bents marching out into the cove: piles
// dark with weed where the tide wets them, braced crosswise under the deck,
// bollards where boats tie up, a small landing off its east side, and at its
// end a broad head on heavy log piles with a timber hoist, a lantern, a bench,
// stores and a ladder down to the water. On the sand: a boat drawn up on
// rollers and one turned over on logs, nets drying in swags between poles and
// a heap of net at their end, a rack of stockfish hung in pairs, a little net
// shed with a turf roof, crates.
//
//   makeHarbour(stage) -> { group, height(x, z), covers(x, z, margin), dispose() }
//   group: the still layer (layer 0), casting and receiving the sun's shadows (the grass and the smallest
//     things receive only). The flag's cloth and the two fires' flames are in the moving layer (stage.moving),
//     drawn every frame so they fly and flicker. group.userData: { ms (build time), tris (triangles laid by each
//     part), secMs (ms each part took) }, for the lab.
//   height(x, z): the top of what the harbour adds to stand on there (the paving, the flag's steps, the steps
//     down to the beach, the boardwalk, the pier's deck, its head and its side landing), or null where it adds
//     nothing.
//   covers(x, z, margin = 0): whether the harbour stands at (x, z) (the same as harbourCovers below).
//
//   harbourCovers(x, z, margin = 0) -> boolean, without building anything: true on the plaza, the steps, the
//     boardwalk and the pier, and round the things on the beach. The land's dressing (dressing.js) keeps its
//     grass, flowers, bushes and stones off these.
//
// Everything stands on coast.js heightAt, and only where that is the same
// whichever pads the town has levelled (|x| < 14 on the beach), so nothing
// floats or sinks as the town grows. Nothing stands in the drill ground in
// front of the flag (plots.js formationOf: 16 m wide from z 2 to z 9), and
// both sides of the pier's stem are clear below the deck where the boats moor.

import * as THREE from "three";
import { PIER, PLAZA, PLAZA_LEVEL, heightAt, noise2 } from "./coast.js";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

// the plaza: its level, its half-side, how far the paving's top stands above the level
const Y0 = PLAZA_LEVEL;
const HW = PLAZA.w / 2;
const PAVE = 0.09;
const TOP = Y0 + PAVE;
// the pier: its line, its half-width, its deck's top; the boardwalk slopes from the plaza's edge down to the pier's root
const PX = PIER.x;
const PH = PIER.w / 2;
const DECK = PIER.deck;
// the pier's head: a broad landing across its end on heavier piles. The boats moor along the stem short of it
// (life.js ties them at z 57 to 63 on the east side and 66 to 72 on the west).
const HEAD_Z0 = PIER.z1 - 5;
const HEAD_HW = 3.6;
// a small landing off the stem's east side, part way out
const SIDE = { z0: 42.2, z1: 45.6, w: 2.3 };
// the steps down to the beach, between their cheek walls
const STEP_X = 2.6;
const CHEEK = 0.6;
// the flag's stepped base: [outer radius, height] of each tier, from the bottom
const TIERS = [
  [1.75, 0.32],
  [1.2, 0.3],
  [0.68, 0.28],
];
// the paving's stones: warm greys and buffs a shade below the land's light, now and then a blue-grey or a brown one
const PAL_FLAG = ["#988f7e", "#9f9482", "#91897a", "#a29783", "#958d7e", "#8c867b", "#9b907b", "#969186", "#9f927b", "#918574", "#8f8f85", "#9c9487"];
// the warmer sandstone of the rings round the flag
const PAL_RING = ["#ad9a7b", "#a69276", "#b39f80", "#9e8a6f"];
// the kerb, the copings and the caps: warm mid buffs, never the near-white of fresh-cut sandstone
const PAL_KERB = ["#a3967f", "#a89a83", "#b0a28a", "#9d917c", "#ab9e87", "#a5977f"];
// the turf where a stone has gone, and the grass the harbour grows at its feet (the light yellow-green of the meadow)
const PAL_TURF = ["#8aa252", "#93a95a", "#839c4d", "#97ab5e"];
const PAL_TUFT = ["#9bb560", "#a2ba66", "#a9bf6c", "#94ae5c"];
const MOSS = "#7f8a58";
// the birch in the plaza's south-west corner, in its round bed of stones
const TREE = [-9.7, 8.9];
// the beach's things: the net shed, the nets' poles, the heap of net at their end, the stockfish rack, the boats drawn up,
// the stores at the boardwalk's foot
const SHED = [-11.9, 15.0];
const NET_Z = 17.6;
const NET_POLES = [-11.0, -8.3, -5.6];
const HEAP = [-5.0, 18.15];
const RACK = { z: 18.4, x0: 4.15, x1: 7.75 };
const BOATS = [
  { x: -8.6, z: 22.9, ry: -Math.PI / 2 + 0.32, over: false, hull: "#8a6a4a", band: "#3f6f86" },
  { x: -12.0, z: 21.2, ry: -Math.PI / 2 - 0.42, over: true, hull: "#4b3d32", band: "#a3482f" },
];
const STORES = [12.7, 21.8];
// where the town's lanes come into the plaza (coast.js routeOf: the north corners take nearly all of them)
const OPENINGS = {
  north: [
    [-HW, -8.6],
    [-0.6, 2.6],
    [8.6, HW],
  ],
  west: [
    [-HW, -8.6],
    [-2.6, 0.6],
  ],
  east: [
    [-HW, -8.6],
    [-2.6, 0.6],
  ],
};

// The level of the boardwalk and the pier's deck at z: down a gentle slope from the plaza's edge to the pier's root.
function deckY(z) {
  return z >= PIER.z0 ? DECK : lerp(TOP, DECK, clamp((z - HW) / (PIER.z0 - HW), 0, 1));
}

// The steps: each tread { z0, z1, y } from the plaza's edge down to the sand, every riser the same, each tread
// running on until the ground under the next is a riser lower (so the land never shows through a tread).
const RISE = 0.3;
function stepTreads() {
  const g = (z) => Math.max(heightAt(-STEP_X - CHEEK, z), heightAt(0, z), heightAt(STEP_X + CHEEK, z));
  const out = [];
  let y = TOP;
  let z = HW;
  for (let k = 0; k < 12; k++) {
    const next = y - RISE;
    let z1 = z + 0.55;
    while (g(z1) > next - 0.05 && z1 < z + 4) z1 += 0.05;
    // the last tread: the sand is close under the next one
    if (next < g(z1 + 0.6) + 0.1) {
      let zEnd = z1;
      while (g(zEnd) > y - 0.16 && zEnd < z1 + 3) zEnd += 0.05;
      out.push({ z0: z, z1: Math.max(z1, zEnd), y });
      break;
    }
    out.push({ z0: z, z1, y });
    z = z1;
    y = next;
  }
  return out;
}
let TREADS = null;
const treadsOf = () => TREADS || (TREADS = stepTreads());

// ------------------------------------------------------------------ what the harbour stands on

// The harbour's ground plan as rects ({ x, z, hw, hd }, square to the axes) and rounds ({ x, z, r }), for the things
// that grow over the land to keep off.
let FOOT = null;
function footprint() {
  if (FOOT) return FOOT;
  const treads = treadsOf();
  const zs = treads[treads.length - 1].z1 + 0.45;
  FOOT = {
    rects: [
      // the plaza, its kerb and its wall
      { x: 0, z: 0, hw: HW + 0.1, hd: HW + 0.1 },
      // the steps between their cheek walls
      { x: 0, z: (HW + zs) / 2, hw: STEP_X + CHEEK + 0.15, hd: (zs - HW) / 2 },
      // the boardwalk and the pier's stem, its head and its side landing
      { x: PX, z: (HW + PIER.z1) / 2, hw: PH + 0.35, hd: (PIER.z1 - HW) / 2 + 0.2 },
      { x: PX, z: (HEAD_Z0 + PIER.z1) / 2, hw: HEAD_HW + 0.35, hd: (PIER.z1 - HEAD_Z0) / 2 + 0.35 },
      { x: PX + PH + SIDE.w / 2, z: (SIDE.z0 + SIDE.z1) / 2, hw: SIDE.w / 2 + 0.35, hd: (SIDE.z1 - SIDE.z0) / 2 + 0.35 },
      // the net shed, its open door and the stores at its side
      { x: SHED[0] + 0.7, z: SHED[1] + 0.5, hw: 2.7, hd: 2.1 },
      // the nets on their poles, the stockfish rack, the stores at the boardwalk's foot
      { x: (NET_POLES[0] + NET_POLES[2]) / 2, z: NET_Z, hw: (NET_POLES[2] - NET_POLES[0]) / 2 + 0.5, hd: 1.0 },
      { x: (RACK.x0 + RACK.x1) / 2, z: RACK.z, hw: (RACK.x1 - RACK.x0) / 2 + 0.5, hd: 1.0 },
      { x: STORES[0], z: STORES[1], hw: 0.8, hd: 2.1 },
    ],
    rounds: [...BOATS.map((bt) => ({ x: bt.x, z: bt.z, r: 2.1 })), { x: HEAP[0], z: HEAP[1], r: 0.95 }, { x: 7.2, z: 23.2, r: 0.5 }],
  };
  return FOOT;
}

// Whether the harbour stands at (x, z), within margin metres: the plaza, the steps, the boardwalk, the pier, the beach's things.
export function harbourCovers(x, z, margin = 0) {
  const F = footprint();
  for (const r of F.rects) if (Math.abs(x - r.x) <= r.hw + margin && Math.abs(z - r.z) <= r.hd + margin) return true;
  for (const c of F.rounds) if (Math.hypot(x - c.x, z - c.z) <= c.r + margin) return true;
  return false;
}

// ------------------------------------------------------------------ paving

// The convex cell round seeds[i] (those near it in `near`), inside the box [x0, x1] x [z0, z1], pulled in by
// half a joint on every side.
function cellOf(seeds, i, near, box, gap) {
  const [px, pz] = seeds[i];
  let poly = [
    [box[0], box[2]],
    [box[1], box[2]],
    [box[1], box[3]],
    [box[0], box[3]],
  ];
  // the box's own edges keep half a joint too
  poly = clip(poly, 1, 0, box[1] - gap / 2);
  poly = clip(poly, -1, 0, -box[0] - gap / 2);
  poly = clip(poly, 0, 1, box[3] - gap / 2);
  poly = clip(poly, 0, -1, -box[2] - gap / 2);
  for (const j of near) {
    if (j === i || poly.length < 3) continue;
    const [qx, qz] = seeds[j];
    const dx = qx - px;
    const dz = qz - pz;
    const L = Math.hypot(dx, dz);
    if (L < 1e-6) continue;
    // keep the side nearer p: (q - p) . x <= (|q|^2 - |p|^2) / 2, less half the joint
    poly = clip(poly, dx / L, dz / L, (qx * qx + qz * qz - px * px - pz * pz) / (2 * L) - gap / 2);
  }
  return poly;
}

// A convex polygon cut to the half-plane nx * x + nz * z <= d.
function clip(poly, nx, nz, d) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = nx * a[0] + nz * a[1] - d;
    const db = nx * b[0] + nz * b[1] - d;
    if (da <= 0) out.push(a);
    if (da <= 0 !== db <= 0) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

function areaOf(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

// Flagstones over the box [x0, x1, z0, z1]: a jittered grid of seeds `step` apart (and any extra seeds given), each
// grown into its cell. -> [{ pts, cx, cz, area }]
function flagstones(box, step, rnd, { extra = [], skip = () => false, jitter = 0.78, gap = 0.07 } = {}) {
  const seeds = extra.slice();
  const nx = Math.max(1, Math.round((box[1] - box[0]) / step));
  const nz = Math.max(1, Math.round((box[3] - box[2]) / step));
  const sx = (box[1] - box[0]) / nx;
  const sz = (box[3] - box[2]) / nz;
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const x = box[0] + (i + 0.5 + (rnd() - 0.5) * jitter) * sx;
      const z = box[2] + (j + 0.5 + (rnd() - 0.5) * jitter) * sz;
      if (!skip(x, z)) seeds.push([x, z]);
    }
  // the seeds by cell of a grid, so each finds its neighbours quickly
  const C = step * 1.2;
  const grid = new Map();
  const key = (i, j) => i * 4099 + j;
  seeds.forEach(([x, z], k) => {
    const kk = key(Math.floor(x / C), Math.floor(z / C));
    if (!grid.has(kk)) grid.set(kk, []);
    grid.get(kk).push(k);
  });
  const out = [];
  seeds.forEach(([x, z], k) => {
    const gi = Math.floor(x / C);
    const gj = Math.floor(z / C);
    const near = [];
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (const n of grid.get(key(gi + a, gj + b)) || []) near.push(n);
    const pts = cellOf(seeds, k, near, box, gap);
    if (pts.length < 3) return;
    const area = Math.abs(areaOf(pts));
    if (area < 0.03) return;
    let cx = 0;
    let cz = 0;
    for (const p of pts) {
      cx += p[0];
      cz += p[1];
    }
    out.push({ pts, cx: cx / pts.length, cz: cz / pts.length, area, seed: k });
  });
  return out;
}

// One geometry of cushioned stones: each { pts (its outline, [x, z]), y (its top), foot (its edge's level), dome,
// bevel, c (a linear colour) }. A stone stands proud of its bed, its edge rounded down to the joint and its middle
// a touch domed, the light rolling softly over it.
function cushionGeo(list) {
  const pos = [];
  const nor = [];
  const col = [];
  const idx = [];
  const push3 = (arr, x, y, z) => arr.push(x, y, z);
  for (const s of list) {
    const n = s.pts.length;
    let cx = 0;
    let cz = 0;
    for (const p of s.pts) {
      cx += p[0];
      cz += p[1];
    }
    cx /= n;
    cz /= n;
    // wound so the top faces up
    const pts = areaOf(s.pts) > 0 ? s.pts : s.pts.slice().reverse();
    const base = pos.length / 3;
    push3(pos, cx, s.y + s.dome, cz);
    push3(nor, 0, 1, 0);
    push3(col, s.c[0], s.c[1], s.c[2]);
    for (const [px, pz] of pts) {
      const dx = px - cx;
      const dz = pz - cz;
      const d = Math.hypot(dx, dz) || 1;
      const ux = dx / d;
      const uz = dz / d;
      const k = Math.min(s.bevel, d * 0.4);
      // the shoulder, where the top turns down, and the foot at the joint
      push3(pos, px - ux * k, s.y, pz - uz * k);
      let L = Math.hypot(ux * 0.45, 1, uz * 0.45);
      push3(nor, (ux * 0.45) / L, 1 / L, (uz * 0.45) / L);
      push3(pos, px, s.foot, pz);
      L = Math.hypot(ux, 0.55, uz);
      push3(nor, ux / L, 0.55 / L, uz / L);
      for (let r = 0; r < 2; r++) {
        // the foot a little darker, as if in the joint's shade
        const f = r ? 0.8 : 1;
        push3(col, s.c[0] * f, s.c[1] * f, s.c[2] * f);
      }
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const si = base + 1 + i * 2;
      const sj = base + 1 + j * 2;
      idx.push(base, sj, si, si, sj, sj + 1, si, sj + 1, si + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// Patches of turf where stones have gone: each flat and a little below the stones round it, its edge ragged and
// spilling out into the joints. list: [{ pts, y, c (linear) }]
function turfGeo(list, rnd) {
  const pos = [];
  const nor = [];
  const col = [];
  const idx = [];
  for (const s of list) {
    const pts = areaOf(s.pts) > 0 ? s.pts : s.pts.slice().reverse();
    let cx = 0;
    let cz = 0;
    for (const p of pts) {
      cx += p[0] / pts.length;
      cz += p[1] / pts.length;
    }
    const base = pos.length / 3;
    pos.push(cx, s.y + 0.012, cz);
    nor.push(0, 1, 0);
    col.push(s.c[0] * 1.05, s.c[1] * 1.05, s.c[2] * 1.05);
    let n = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      for (let k = 0; k < 3; k++) {
        const px = lerp(a[0], b[0], k / 3);
        const pz = lerp(a[1], b[1], k / 3);
        const dx = px - cx;
        const dz = pz - cz;
        const d = Math.hypot(dx, dz) || 1;
        // out over the joint, raggedly
        const out = 0.015 + rnd() * 0.08;
        pos.push(px + (dx / d) * out, s.y, pz + (dz / d) * out);
        nor.push(0, 1, 0);
        const f = 0.86 + rnd() * 0.16;
        col.push(s.c[0] * f, s.c[1] * f, s.c[2] * f);
        n++;
      }
    }
    for (let i = 0; i < n; i++) idx.push(base, base + 1 + ((i + 1) % n), base + 1 + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// A plank across the deck, 1 m long (scaled to its length), d deep and t thick, its top at 0, its two long top edges
// chamfered: 18 triangles where the kit's chamfered box takes 44, and there are a couple of hundred of them.
function plankGeo(d, t, c) {
  const prof = [
    [-d / 2, -t],
    [-d / 2, -c],
    [-d / 2 + c, 0],
    [d / 2 - c, 0],
    [d / 2, -c],
    [d / 2, -t],
  ];
  const pos = [];
  const v = (x, p) => pos.push(x, p[1], p[0]);
  for (let i = 0; i < prof.length - 1; i++) {
    const a = prof[i];
    const q = prof[i + 1];
    (v(-0.5, a), v(0.5, q), v(0.5, a));
    (v(-0.5, a), v(-0.5, q), v(0.5, q));
  }
  // the ends
  for (let i = 1; i < prof.length - 1; i++) {
    (v(0.5, prof[0]), v(0.5, prof[i]), v(0.5, prof[i + 1]));
    (v(-0.5, prof[0]), v(-0.5, prof[i + 1]), v(-0.5, prof[i]));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// A tuft of grass a metre high (scaled to its size): three cards of the kit's painted blades leaning out from a little
// root like a fountain. The cards' light is straight up, as the ground's is, so a tuft is a soft lighter fleck in the
// shade and never a dark thorn; each card is laid both ways round, for the harbour's grass draws front faces only (the
// kit's grass, drawn both sides, turns the far side's light to the ground and goes black).
function tuftGeo() {
  const pos = [];
  const uv = [];
  const turn = [0.1, -0.2, 0.25];
  for (let c = 0; c < 3; c++) {
    const a = (c / 3) * TAU + turn[c];
    const ox = Math.cos(a);
    const oz = Math.sin(a);
    const tx = -oz;
    const tz = ox;
    const r0 = 0.04;
    const lean = 0.3;
    const w0 = 0.36;
    const w1 = 0.56;
    const P = [
      [ox * r0 - tx * w0, 0, oz * r0 - tz * w0, 0, 0],
      [ox * r0 + tx * w0, 0, oz * r0 + tz * w0, 1, 0],
      [ox * (r0 + lean) + tx * w1, 1, oz * (r0 + lean) + tz * w1, 1, 1],
      [ox * (r0 + lean) - tx * w1, 1, oz * (r0 + lean) - tz * w1, 0, 1],
    ];
    for (const tri of [
      [0, 1, 2],
      [0, 2, 3],
      [0, 2, 1],
      [0, 3, 2],
    ])
      for (const k of tri) {
        pos.push(P[k][0], P[k][1], P[k][2]);
        uv.push(P[k][3], P[k][4]);
      }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
}

// A dried cod split and hung by its tail: a forked tail at the top, a slim wrist, the body widening to the belly and a
// head at the bottom, a little cupped. Its tail's tip at (0, 0, 0), hanging down -y, L long.
function fishGeo(L) {
  // [how far down (0 the tail's tip, 1 the head's end), half-width]
  const prof = [
    [0, 0.072],
    [0.08, 0.046],
    [0.16, 0.02],
    [0.3, 0.046],
    [0.48, 0.07],
    [0.66, 0.078],
    [0.8, 0.07],
    [0.9, 0.056],
    [1, 0.022],
  ];
  const pos = [];
  const idx = [];
  prof.forEach(([t, w], i) => {
    const y = -t * L;
    // the tail's fork: the middle of its end is cut back in a V
    const ym = i === 0 ? -0.05 * L : y;
    const cup = 0.025 * (w / 0.078);
    pos.push(-w, y, cup, 0, ym, -0.005, w, y, cup);
    if (i) {
      const a = (i - 1) * 3;
      const b = i * 3;
      idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A tree's crown of lumpy puffs, each lit by its own roundness bent toward the whole crown's: yellow-green and warm on
// top and where it faces out, blue-green underneath and dark in the hollows between the puffs (colours in linear).
// puffs: [[x, y, z, r], ...]
function crownGeo(puffs, rnd, noise3) {
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const lc = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  const TOPC = lc("#b3c35a");
  const MIDC = lc("#7c9f45");
  const LOWC = lc("#4a7247");
  const ball = new THREE.IcosahedronGeometry(1, 1).attributes.position;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let lo = Infinity;
  let hi = -Infinity;
  for (const [x, y, z, r] of puffs) {
    cx += x / puffs.length;
    cy += y / puffs.length;
    cz += z / puffs.length;
    lo = Math.min(lo, y - r);
    hi = Math.max(hi, y + r);
  }
  const pos = [];
  const nor = [];
  const col = [];
  const c = new THREE.Color();
  puffs.forEach(([px, py, pz, pr], pi) => {
    const tone = 0.93 + rnd() * 0.14;
    for (let i = 0; i < ball.count; i++) {
      const dx = ball.getX(i);
      const dy = ball.getY(i);
      const dz = ball.getZ(i);
      // lumpy: the noise at the point on the ball, so the faces that share a corner move it alike
      const k = 1 + noise3(dx * 1.6 + pi * 7.3, dy * 1.6, dz * 1.6) * 0.36;
      const x = px + dx * k * pr;
      const y = py + dy * k * pr * 0.88;
      const z = pz + dz * k * pr;
      pos.push(x, y, z);
      // the whole crown's roundness here
      let ex = x - cx;
      let ey = (y - cy) * 1.3;
      let ez = z - cz;
      const eL = Math.hypot(ex, ey, ez) || 1;
      ex /= eL;
      ey /= eL;
      ez /= eL;
      const nx = lerp(dx, ex, 0.45);
      const ny = lerp(dy, ey, 0.45);
      const nz = lerp(dz, ez, 0.45);
      const nL = Math.hypot(nx, ny, nz) || 1;
      nor.push(nx / nL, ny / nL, nz / nL);
      // facing into the crown (between the puffs) is dark, and so is low down; the tops yellow, the undersides blue
      const out = dx * ex + dy * ey + dz * ez;
      const up = clamp((y - lo) / (hi - lo), 0, 1);
      const ao = lerp(0.55, 1, smooth(0, 0.8, up)) * lerp(0.62, 1, smooth(-0.3, 0.6, out));
      const t = smooth(-0.55, 0.75, dy * 0.7 + (up - 0.5) * 0.9);
      c.copy(LOWC).lerp(MIDC, smooth(0, 0.5, t)).lerp(TOPC, smooth(0.5, 1, t));
      col.push(c.r * tone * ao, c.g * tone * ao, c.b * tone * ao);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// ------------------------------------------------------------------ the net's mesh

// A net's mesh drawn on a canvas: diamonds of fine twine, knotted where they cross (white; the vertex colour tints it).
let NET_TEX = null;
function netTexture() {
  if (NET_TEX) return NET_TEX;
  const N = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = N;
  const g = cv.getContext("2d");
  g.clearRect(0, 0, N, N);
  g.strokeStyle = "#fff";
  g.fillStyle = "#fff";
  g.lineWidth = 4.5;
  g.lineCap = "round";
  const n = 4;
  const s = N / n;
  for (let i = -n; i <= 2 * n; i++) {
    g.beginPath();
    g.moveTo(i * s, 0);
    g.lineTo(i * s + N, N);
    g.stroke();
    g.beginPath();
    g.moveTo(i * s, 0);
    g.lineTo(i * s - N, N);
    g.stroke();
  }
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++) {
      for (const [ox, oy] of [
        [0, 0],
        [s / 2, s / 2],
      ]) {
        g.beginPath();
        g.arc(i * s + ox, j * s + oy, 4, 0, TAU);
        g.fill();
      }
    }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  NET_TEX = t;
  return t;
}

// The net's cut: a screen-door test in place of the plain alpha test, so where the twine is too fine to draw (far
// off) the net thins to a veil of the right weight instead of vanishing or turning to a solid sheet.
const NET_CUT = [
  "float netD = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));",
  "if (diffuseColor.a < mix(0.12, 0.88, netD)) discard;",
].join("\n");
function cutLikeNet(mat, key) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.fragmentShader = sh.fragmentShader.replace("#include <alphatest_fragment>", NET_CUT);
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

// ------------------------------------------------------------------ the flag, flying

// The Hub's flag in the moving layer: a swallowtail of orange cloth with a darker hem and a pale ring painted on it,
// waving in the wind from the sea, lit as the kit lights cloth (a soft sun ramp, the still layer's shadows, sky and
// ground fill with the shade lifted toward the sky's blue, a warm rim, the haze), so it sits with the rest. The pole
// and its finial stay in the still layer.
const FLAG_VERT = [
  "uniform float uFlagTime; uniform float uFlagW; uniform float uFlagH;",
  "varying vec3 vPW; varying vec3 vNW; varying float vU; varying float vV;",
].join("\n");
const FLAG_WAVE = [
  // u: 0 at the pole, 1 at the fly; the wave runs out along it, growing toward the free end
  "float u = clamp(position.x / uFlagW, 0.0, 1.0);",
  "float ph = uFlagTime * 3.1 - u * 7.0;",
  "float amp = (0.06 + 0.4 * u * u) * uFlagW * 0.22;",
  "transformed.z += sin(ph) * amp + sin(uFlagTime * 1.7 - u * 4.0 + position.y * 1.3) * amp * 0.35;",
  "transformed.y -= u * u * uFlagW * 0.04 * (1.0 + 0.5 * sin(uFlagTime * 0.9));",
  "transformed.x -= (1.0 - cos(ph)) * amp * 0.12 * u;",
  // the normal from the wave's slope along u
  "float dz = cos(ph) * (-7.0 / uFlagW) * amp;",
  "objectNormal = normalize(vec3(-dz, 0.0, 1.0));",
  "vU = u;",
  "vV = clamp(-position.y / uFlagH, 0.0, 1.0);",
].join("\n");
const FLAG_FRAG = [
  "uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uGndCol; uniform vec3 uRimCol; uniform vec3 uFogCol; uniform vec3 uFog;",
  "uniform float uShadeLift; uniform sampler2D uStroke; uniform float uFlagW; uniform float uFlagH; uniform vec3 uMark;",
  "varying vec3 vPW; varying vec3 vNW; varying float vU; varying float vV;",
  // three r128 never gives a MeshLambertMaterial its cameraPosition (it stays at the origin, under the flag's own
  // pole), so the eye is found from the view matrix
  "vec3 eyeW() { vec3 t = viewMatrix[3].xyz; return -vec3(dot(viewMatrix[0].xyz, t), dot(viewMatrix[1].xyz, t), dot(viewMatrix[2].xyz, t)); }",
].join("\n");
const FLAG_MAIN = [
  // the swallowtail: a V cut back into the fly
  "if (abs(vV - 0.5) < (vU - 0.76) / 0.24 * 0.34) discard;",
  "vec3 N = normalize(vNW);",
  "vec3 V = normalize(eyeW() - vPW);",
  // the side of the cloth turned to the camera
  "if (dot(N, V) < 0.0) N = -N;",
  "vec4 st = texture2D(uStroke, vPW.xy * 0.32 + vPW.z * 0.21);",
  "vec3 alb = diffuseColor.rgb * (1.0 + (st.r - 0.5) * 0.12 + (st.b - 0.5) * 0.08);",
  // the ring painted on it, a little in from the pole (in metres on the cloth, softened by the pixel's footprint)
  "vec2 q = vec2((vU - 0.36) * uFlagW, (vV - 0.5) * uFlagH);",
  "float rd = abs(length(q) - uFlagH * 0.22);",
  "float aa = fwidth(rd) + 0.004;",
  "alb = mix(alb, uMark * (1.0 + (st.r - 0.5) * 0.15), 1.0 - smoothstep(uFlagH * 0.045 - aa, uFlagH * 0.045 + aa, rd));",
  // the hem along the top and the bottom, the sleeve at the pole: darker, as a sewn edge is
  "float hem = max(1.0 - smoothstep(0.04, 0.065, vV), smoothstep(0.935, 0.96, vV));",
  "hem = max(hem, 1.0 - smoothstep(0.03, 0.05, vU));",
  "alb *= mix(1.0, 0.68, hem);",
  "float ndl = dot(N, uSunDir);",
  // cloth lets the sun through: the far side glows a little
  "float lit = smoothstep(-0.25, 0.35, abs(ndl) * (ndl > 0.0 ? 1.0 : 0.55));",
  "float sh = smoothstep(0.15, 0.85, pShadow);",
  "lit *= sh;",
  "vec3 direct = uSunCol * lit * 0.95;",
  "float up = N.y * 0.5 + 0.5;",
  "vec3 amb = mix(uGndCol, uSkyCol, smoothstep(0.0, 1.0, up));",
  "vec3 c = alb * (direct + amb);",
  "c += alb * uSkyCol * (1.0 - lit) * uShadeLift * 0.35;",
  "float fr = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);",
  "c += uRimCol * alb * fr * (0.25 + 0.75 * lit);",
  "float dist = length(vPW - eyeW());",
  "c = mix(c, uFogCol, smoothstep(uFog.x, uFog.y, dist) * 0.92);",
  "gl_FragColor = vec4(c, clamp(lit, 0.0, 1.0));",
].join("\n");

function makeFlag(stage, at, w, h, ry) {
  const KIT = window.KIT;
  const G = KIT.G;
  const geo = new THREE.PlaneGeometry(w, h, 16, 8);
  geo.translate(w / 2, -h / 2, 0);
  const color = new THREE.Color("#f26a1b").convertSRGBToLinear();
  const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
  mat.extensions = { derivatives: true };
  const mark = new THREE.Color("#efe7d6").convertSRGBToLinear();
  const U = { uFlagTime: stage.shared.uTime, uFlagW: { value: w }, uFlagH: { value: h }, uMark: { value: new THREE.Vector3(mark.r, mark.g, mark.b) } };
  mat.onBeforeCompile = (sh) => {
    for (const k of ["uSunDir", "uSunCol", "uSkyCol", "uGndCol", "uRimCol", "uFogCol", "uFog", "uShadeLift", "uStroke"]) sh.uniforms[k] = G[k];
    Object.assign(sh.uniforms, U);
    sh.vertexShader =
      FLAG_VERT +
      "\n" +
      sh.vertexShader
        .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\n  vec3 transformed = vec3(position);\n" + FLAG_WAVE)
        .replace("#include <begin_vertex>", "")
        .replace(
          "#include <project_vertex>",
          "#include <project_vertex>\n  vPW = (modelMatrix * vec4(transformed, 1.0)).xyz; vNW = normalize(mat3(modelMatrix) * objectNormal);",
        );
    sh.fragmentShader =
      FLAG_FRAG +
      "\n" +
      sh.fragmentShader
        .replace("reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();", "float pShadow = getShadowMask();")
        .replace("gl_FragColor = vec4( outgoingLight, diffuseColor.a );", FLAG_MAIN);
  };
  mat.customProgramCacheKey = () => "harbour-flag";
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "harbour-flag";
  mesh.position.set(at[0], at[1], at[2]);
  mesh.rotation.y = ry;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  // it waves well beyond its plane: never culled by its flat bounds
  mesh.frustumCulled = false;
  stage.moving(mesh);
  return mesh;
}

// ------------------------------------------------------------------ the fires, flickering

// The two fires' flames in the moving layer: each three chunky lobes round a taller heart, dark red at the root where
// it rises from the coals and bright at the tips, swaying and leaping a little every frame (from stage.shared.uTime).
// aFlame per vertex: x its flame's own phase, y how far up its lobe (0 the root, 1 the tip), z the root's height.
const FLAME_VERT = "uniform float uFlameTime; attribute vec3 aFlame;";
const FLAME_MOVE = [
  "float fk = aFlame.y;",
  "float ft = uFlameTime + aFlame.x;",
  "transformed.y = aFlame.z + (transformed.y - aFlame.z) * (1.0 + (0.13 * sin(ft * 7.3) + 0.07 * sin(ft * 12.9 + 1.3)) * fk);",
  "transformed.x += (sin(ft * 5.1) * 0.6 + sin(ft * 9.7 + 2.0) * 0.4) * 0.07 * fk * fk;",
  // the sea wind leans it a little inland
  "transformed.z += (sin(ft * 4.3 + 1.1) * 0.6 + sin(ft * 11.1) * 0.4) * 0.07 * fk * fk - 0.06 * fk * fk;",
].join("\n");

function makeFlames(stage, spots) {
  const pos = [];
  const col = [];
  const fl = [];
  const idx = [];
  const lc = (hex, k) => {
    const c = new THREE.Color(hex).convertSRGBToLinear();
    return [c.r * k, c.g * k, c.b * k];
  };
  const ROOT = lc("#7a2410", 1.4);
  const BODY = lc("#e0602a", 2.3);
  const TIP = lc("#f6a63c", 3.0);
  const HEART = lc("#ffe2a0", 3.6);
  spots.forEach(([x, y, z], si) => {
    const ph = si * 2.7 + 0.4;
    const lobes = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 0.5 + si;
      lobes.push({ ox: Math.cos(a) * 0.15, oz: Math.sin(a) * 0.15, r: 0.17, h: 0.62 + 0.12 * ((i + si) % 2), lean: 0.08, heart: false, a });
    }
    lobes.push({ ox: 0, oz: 0, r: 0.19, h: 0.98, lean: 0.0, heart: true, a: 0 });
    for (const L of lobes) {
      const prof = [
        [0.02, 0],
        [L.r * 0.8, L.h * 0.12],
        [L.r, L.h * 0.3],
        [L.r * 0.78, L.h * 0.55],
        [L.r * 0.36, L.h * 0.8],
        [0.01, L.h],
      ].map(([px, py]) => new THREE.Vector2(px, py));
      const g = new THREE.LatheGeometry(prof, 7);
      const p = g.attributes.position;
      const base = pos.length / 3;
      for (let i = 0; i < p.count; i++) {
        const k = clamp(p.getY(i) / L.h, 0, 1);
        const lx = p.getX(i) + Math.cos(L.a) * L.lean * k * k + Math.sin(k * 5 + L.a) * 0.03 * k;
        const lz = p.getZ(i) + Math.sin(L.a) * L.lean * k * k;
        pos.push(x + L.ox + lx, y + p.getY(i), z + L.oz + lz);
        const from = k < 0.35 ? ROOT : L.heart ? TIP : BODY;
        const to = k < 0.35 ? (L.heart ? TIP : BODY) : L.heart ? HEART : TIP;
        const t = k < 0.35 ? k / 0.35 : (k - 0.35) / 0.65;
        for (let j = 0; j < 3; j++) col.push(lerp(from[j], to[j], t));
        fl.push(ph + (L.heart ? 0.7 : L.a), k, y);
      }
      for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
      g.dispose();
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute("aFlame", new THREE.Float32BufferAttribute(fl, 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uFlameTime = stage.shared.uTime;
    sh.vertexShader = FLAME_VERT + "\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n" + FLAME_MOVE);
  };
  mat.customProgramCacheKey = () => "harbour-flame";
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "harbour-flames";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // they leap above their bounds: never culled
  mesh.frustumCulled = false;
  stage.moving(mesh);
  return mesh;
}

// ------------------------------------------------------------------ the harbour

export function makeHarbour(stage) {
  const KIT = window.KIT;
  const T = THREE;
  const M = KIT.M;
  const U = KIT.util;
  const t0 = performance.now();
  const was = KIT.boxDetail;
  KIT.boxDetail = 1;
  KIT.dropGeoCache();
  let made;
  let flag;
  let flames;
  const treads = treadsOf();
  try {
    const b = new KIT.Builder(1871, {});
    // the layout's own stream, so a change to a prop never moves a stone
    const rnd = U.rng(5311);
    const r2 = U.rng(907);
    const lc = (hex) => {
      const c = new T.Color(hex).convertSRGBToLinear();
      return [c.r, c.g, c.b];
    };
    // the ground, a little in from a point (so a post never hangs over a dip beside it)
    const H = heightAt;
    const lowOf = (x, z, r) => Math.min(H(x, z), H(x - r, z), H(x + r, z), H(x, z - r), H(x, z + r));
    const highOf = (x, z, r) => Math.max(H(x, z), H(x - r, z), H(x + r, z), H(x, z - r), H(x, z + r));
    const stone = (pal, y) => b.stoneC(pal || "stone", y);
    const pick = (list) => list[Math.floor(r2() * list.length) % list.length];
    // a dressed stone of the kerb or a coping: a warm buff of its own, now and then touched with moss
    const mossC = new T.Color(MOSS);
    const kerbC = (moss = 0) => {
      const c = new T.Color(pick(PAL_KERB)).offsetHSL((r2() - 0.5) * 0.01, 0, (r2() - 0.5) * 0.1);
      if (r2() < moss) c.lerp(mossC, 0.16 + r2() * 0.12);
      return c;
    };
    // the triangles each part of the harbour lays (kept on group.userData.tris, for the lab)
    const tris = {};
    // spots on the plaza gone to turf, for a tuft each
    const TURFS = [];
    const count = () => Object.values(b.buckets).reduce((a, k) => a + k.idx.n, 0) / 3;
    const secMs = {};
    const sec = (name, fn) => {
      const n0 = count();
      const m0 = performance.now();
      b.base(fn);
      tris[name] = (tris[name] || 0) + Math.round(count() - n0);
      secMs[name] = Math.round(performance.now() - m0);
    };
    // the smallest things (flowers, papers, rope, floats, the birch's bark marks) go in a mesh of their own that
    // casts no shadow: they are too small for the sun's shadow map to show, and would only cost its pass
    const FINE = "fine";
    const flowers = (x, y, z, r, c, n = 6) => {
      for (let i = 0; i < n; i++) {
        const a = r2() * TAU;
        const d = r2() * r;
        const fy = y + 0.1 + r2() * 0.14;
        const fr = 0.05 + r2() * 0.03;
        b.ball(x + Math.cos(a) * d, fy, z + Math.sin(a) * d, fr, { c, m: M.paint, ao: 0, jit: 0.06, detail: 0, bucket: FINE });
      }
    };
    const ropeCoil = (x, y, z, r) => b.addGeo(new T.TorusGeometry(r, 0.05, 5, 12), { x, y: y + 0.05, z, rx: Math.PI / 2, c: "rope", m: M.rope, bucket: FINE });
    // a tuft of the harbour's grass, s high (about a fifth to a third of a metre)
    const TUFT = tuftGeo();
    const tuft = (x, y, z, s, c) =>
      b.addGeo(TUFT, {
        x, y: y - 0.03, z, ry: r2() * TAU, sx: s * 1.25, sy: s, sz: s * 1.25,
        c: c || pick(PAL_TUFT), m: M.grass, bucket: "grass", ao: 0.15, jit: 0.04, vary: 0.06,
      });

    // ================================================================ the plaza
    sec("paving", () => {
      // the bed the flagstones are set in: its joints a warm grey a little below the stones, greening toward the kerb
      const JOINT = new T.Color("#877d6b");
      const TURF = new T.Color("#7d9149");
      const greenAt = (x, z) => clamp(U.smooth(8.6, 11.7, Math.max(Math.abs(x), Math.abs(z))) * 0.9 + noise2(x * 0.45 + 7.1, z * 0.45) * 0.4, 0, 1);
      const bed = new T.PlaneGeometry(PLAZA.w - 0.4, PLAZA.d - 0.4, 24, 24);
      bed.rotateX(-Math.PI / 2);
      b.addGeo(bed, { y: Y0 + 0.035, m: M.stone, ao: 0, jit: 0, vary: 0.05, colors: (wx, wy, wz) => JOINT.clone().lerp(TURF, greenAt(wx, wz)) });
      // the flagstones: two rings of wedges round the flag's base, then big field stones at random to the kerb, some merged
      const rings = [];
      [
        [2.18, 12, 0],
        [2.98, 17, 0.5],
      ].forEach(([r, n, off]) => {
        for (let i = 0; i < n; i++) {
          const a = ((i + off) / n) * TAU + (rnd() - 0.5) * 0.05;
          rings.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
      });
      const IN = HW - 0.44;
      const skip = (x, z) => Math.hypot(x, z) < 3.7 || rnd() < 0.15;
      const stones = flagstones([-IN, IN, -IN, IN], 1.15, rnd, { extra: rings, jitter: 0.9, gap: 0.075, skip });
      const list = [];
      const turf = [];
      for (const s of stones) {
        // under the birch's bed: nothing
        if (Math.hypot(s.cx - TREE[0], s.cz - TREE[1]) < 1.0) continue;
        const ring = Math.hypot(s.cx, s.cz) < 3.4;
        const edge = Math.max(Math.abs(s.cx), Math.abs(s.cz));
        const toEdge = U.smooth(7.5, 11.8, edge);
        // near the kerb, out of the ways people walk, a stone now and then gone to turf
        const walked = (Math.abs(s.cx) < 4.2 && s.cz > 7) || (s.cx > 7 && s.cz > 7) || (s.cz < -7.5 && (Math.abs(s.cx) > 7.8 || Math.abs(s.cx - 1) < 2.6));
        if (!walked && s.area < 1.6 && r2() < 0.3 * U.smooth(9.4, 11.3, edge)) {
          turf.push({ pts: s.pts, y: Y0 + 0.05, c: lc(pick(PAL_TURF)), cx: s.cx, cz: s.cz });
          continue;
        }
        const c = new T.Color(pick(ring ? PAL_RING : PAL_FLAG));
        const q = r2();
        if (q < 0.1) c.offsetHSL(0.01, -0.03, -0.05);
        else if (q < 0.2) c.offsetHSL(-0.01, 0.03, 0.025);
        // a touch paler where feet go, darker and greener toward the kerb
        c.offsetHSL(0, 0, -0.035 * toEdge + 0.01 * (1 - toEdge));
        if (r2() < 0.4 * toEdge) c.lerp(mossC, 0.15 + r2() * 0.25);
        c.offsetHSL(0, 0, noise2(s.cx / 6 + 3.1, s.cz / 6 - 1.7) * 0.03);
        list.push({ pts: s.pts, y: TOP + (r2() - 0.5) * 0.02, foot: Y0 + 0.02, dome: 0.025 + r2() * 0.02, bevel: 0.12, c: lc("#" + c.getHexString()) });
      }
      // the landing at the head of the steps, paved the same
      const land = treads[0];
      const landStones = flagstones([-STEP_X, STEP_X, HW - 0.46, land.z1 - 0.3], 0.95, rnd);
      for (const s of landStones) {
        const c = new T.Color(pick(PAL_FLAG)).offsetHSL(0, 0, -0.02 + (r2() - 0.5) * 0.05);
        list.push({ pts: s.pts, y: TOP + (r2() - 0.5) * 0.02, foot: Y0 + 0.02, dome: 0.025, bevel: 0.12, c: lc("#" + c.getHexString()) });
      }
      b.addGeo(cushionGeo(list), { c: "#ffffff", m: M.stone, ao: 0.35, jit: 0, vary: 0.05 });
      // the turf sunk a little below the stones round it, its edge spilling into the joints
      b.addGeo(turfGeo(turf, r2), { c: "#ffffff", m: M.grass, ao: 0, jit: 0, vary: 0.1 });
      for (const t of turf) TURFS.push([t.cx, t.cz]);
      // the landing's bed
      b.box(0, Y0 - 0.6, (HW - 0.46 + land.z1) / 2, STEP_X * 2, 0.635, land.z1 - HW + 0.46, { c: JOINT, m: M.stone, bevel: 0, ao: 0, jit: 0 });
    });

    // the kerb: long dressed stones a hand above the paving, broken where the lanes come in, each sitting a little
    // its own way
    sec("kerb", () => {
      const kerbRun = (side, a0, a1) => {
        let t = a0;
        while (t < a1 - 0.2) {
          const len = Math.min(a1 - t, 0.95 + r2() * 0.75);
          const m = t + len / 2;
          const w = len - 0.05;
          const h = 0.55 + r2() * 0.05;
          const top = TOP + 0.12 + (r2() - 0.5) * 0.04;
          const tilt = (r2() - 0.5) * 0.035;
          const o = { c: kerbC(0.35), m: M.stone, bevel: 0.09, ao: 0.3, jit: 0.02, ry: (r2() - 0.5) * 0.03 };
          const inset = HW - 0.25;
          if (side === "north") b.box(m, top - h, -inset, w, h, 0.5, { ...o, rz: tilt });
          else if (side === "west") b.box(-inset, top - h, m, 0.5, h, w, { ...o, rx: tilt });
          else b.box(inset, top - h, m, 0.5, h, w, { ...o, rx: tilt });
          t += len;
        }
      };
      const runs = (side, open, from, to) => {
        let t = from;
        for (const [a, c] of open) {
          if (a > t) kerbRun(side, t, a);
          t = Math.max(t, c);
        }
        if (t < to) kerbRun(side, t, to);
      };
      runs("north", OPENINGS.north, -HW, HW);
      runs("west", OPENINGS.west, -HW + 0.44, HW - 0.5);
      runs("east", OPENINGS.east, -HW + 0.44, HW - 0.5);
      // where a lane comes in, a threshold of big setts across the opening, flush with the paving
      const sill = (x, z, w, d) =>
        b.box(x, TOP - 0.25, z, w, 0.265, d, { c: new T.Color(pick(PAL_FLAG)).offsetHSL(0, 0, -0.03), m: M.stone, bevel: 0.07, ao: 0.2, jit: 0.04 });
      for (const [a, c] of OPENINGS.north) for (let t = a + 0.05; t < c - 0.3; t += 0.75) sill(t + 0.35, -HW + 0.22, 0.7, 0.42);
      for (const sd of [-1, 1])
        for (const [a, c] of OPENINGS.west) {
          if (a <= -HW) continue;
          for (let t = a + 0.05; t < c - 0.3; t += 0.75) sill(sd * (HW - 0.22), t + 0.35, 0.42, 0.7);
        }
    });

    // the south wall: a low wall looking over the beach, broken by the steps and the boardwalk, its coping overhanging
    const wallTop = TOP + 0.55;
    const PIERS = [-HW + 0.35, PX - PH - 0.42, PX + PH + 0.42];
    sec("wall", () => {
      const run = (x0, x1) => {
        b.stoneWall(x0, HW - 0.25, x1, HW - 0.25, Y0 - 0.25, wallTop - 0.1 - (Y0 - 0.25), 0.5, { pal: "stone", course: 0.3, len: 0.72, mortar: "#857a6a" });
        let x = x0;
        while (x < x1 - 0.1) {
          const len = Math.min(x1 - x, 0.85 + r2() * 0.5);
          b.box(x + len / 2, wallTop - 0.12 + (r2() - 0.5) * 0.025, HW - 0.25, len - 0.03, 0.13, 0.62, {
            c: kerbC(0.3),
            m: M.stone,
            bevel: 0.08,
            ao: 0.15,
            jit: 0.02,
            ry: (r2() - 0.5) * 0.03,
            rz: (r2() - 0.5) * 0.025,
          });
          x += len;
        }
      };
      run(-HW, -STEP_X - CHEEK);
      run(STEP_X + CHEEK, PIERS[1] - 0.36);
      // square piers a little taller, a lamp on each: at the south-west corner and either side of the boardwalk
      for (const x of PIERS) {
        b.box(x, Y0 - 0.3, HW - 0.3, 0.72, wallTop + 0.2 - (Y0 - 0.3), 0.72, { c: stone("stone", 0.5), m: M.stone, bevel: 0.07, ao: 0.2 });
        b.box(x, wallTop + 0.17, HW - 0.3, 0.84, 0.12, 0.84, { c: kerbC(0.15), m: M.stone, bevel: 0.08, ao: 0.1, ry: (r2() - 0.5) * 0.05 });
      }
    });

    // the steps down to the beach, between cheek walls that step down with them
    sec("steps", () => {
      const SAND = new T.Color("#c9b48c");
      treads.forEach((t, k) => {
        const next = treads[k + 1];
        const f = k / treads.length;
        // two or three long stones across each tread (the landing's only along its front edge)
        const n = 2 + (r2() < 0.5 ? 1 : 0);
        let x = -STEP_X;
        for (let i = 0; i < n; i++) {
          const w = i === n - 1 ? STEP_X - x : (2 * STEP_X) / n + (r2() - 0.5) * 0.8;
          const z0 = k === 0 ? t.z1 - 0.34 : t.z0 - 0.05;
          const z1 = t.z1 + 0.07;
          const low = Math.min(lowOf(x + w / 2, (z0 + z1) / 2, w / 2), next ? next.y : t.y) - 0.3;
          // the paving's stones, a little darker and sandier toward the beach
          const c = new T.Color(pick(PAL_FLAG)).lerp(SAND, 0.22 * f).offsetHSL(0, 0, -0.03 * f);
          b.box(x + w / 2, low, (z0 + z1) / 2, w - 0.04, t.y - low, z1 - z0, { c, m: M.stone, bevel: 0.08, ao: 0.3, jit: 0.03 });
          x += w;
        }
        // the cheek walls: a block a tread, its top a step above the tread, mossier toward the beach
        for (const sd of [-1, 1]) {
          const cx = sd * (STEP_X + CHEEK / 2);
          const z0 = k === 0 ? HW - 0.3 : t.z0;
          const z1 = t.z1 + (next ? 0 : 0.3);
          const low = lowOf(cx + sd * 0.4, (z0 + z1) / 2, (z1 - z0) / 2) - 0.3;
          const top = k === 0 ? wallTop - 0.1 : t.y + 0.42;
          b.box(cx, low, (z0 + z1) / 2, CHEEK, top - low, z1 - z0 - 0.02, { c: stone("stone", 0.6), m: M.stone, bevel: 0.07, ao: 0.3, jit: 0.035 });
          b.box(cx, top + (r2() - 0.5) * 0.02, (z0 + z1) / 2, CHEEK + 0.1, 0.11, z1 - z0 + 0.04, {
            c: kerbC(0.25 + 0.6 * f),
            m: M.stone,
            bevel: 0.08,
            ao: 0.1,
            jit: 0.02,
            rx: (r2() - 0.5) * 0.03,
          });
        }
      });
    });

    // ================================================================ the flag, its base and the plaza's furniture
    const flagTop = Y0 + 0.03 + TIERS.reduce((a, t) => a + t[1], 0);
    const POLE = 10.5;
    const FLAG_W = 3.6;
    const FLAG_H = 2.2;
    const FLAG_RY = 0.72;
    sec("flagpole", () => {
      // the stepped base: three rounds of curved stones
      let y = Y0 + 0.03;
      for (const [R, h] of TIERS) {
        const thick = Math.min(0.62, R - 0.05);
        b.stoneRing(0, 0, R - thick / 2, y, h, thick, { pal: "stone", course: h, len: 0.85, mortar: "#8a7f6e" });
        y += h;
      }
      // the pole: a hewn pine trunk, iron bands, a collar of wedges at its foot
      b.cyl(0, flagTop - 0.05, 0, 0.17, POLE, { r2: 0.09, c: "#5a4c3e", m: M.wood, seg: 7, flat: true });
      for (const [yy, rr] of [
        [0.15, 0.185],
        [0.55, 0.178],
        [POLE * 0.5, 0.14],
        [POLE - 0.6, 0.105],
      ])
        b.cyl(0, flagTop + yy, 0, rr, 0.09, { c: "iron", m: M.metal, seg: 9 });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + 0.4;
        b.box(Math.cos(a) * 0.25, flagTop - 0.02, Math.sin(a) * 0.25, 0.14, 0.22, 0.2, { ry: -a, c: "woodDark", m: M.wood, bevel: 0.02, taper: 0.6 });
      }
      // the top: a short crossbar across the wind with carved ends, a collar, and a carved finial of dark wood
      const ty = flagTop + POLE;
      const cx = Math.sin(FLAG_RY) * 0.62;
      const cz = Math.cos(FLAG_RY) * 0.62;
      b.beam([-cx, ty - 0.3, -cz], [cx, ty - 0.3, cz], 0.06, { c: "#4f4236", m: M.wood });
      for (const s of [-1, 1]) b.ball(s * cx * 1.04, ty - 0.3, s * cz * 1.04, 0.07, { c: "#3e342b", m: M.wood, detail: 0 });
      b.cyl(0, ty - 0.12, 0, 0.11, 0.1, { c: "iron", m: M.metal, seg: 8 });
      b.ball(0, ty + 0.08, 0, 0.13, { c: "#3e342b", m: M.wood, detail: 1, sy: 1.25 });
      b.cone(0, ty + 0.18, 0, 0.08, 0.42, { c: "#3e342b", m: M.wood, seg: 5 });
      const hx = Math.cos(FLAG_RY) * 0.1;
      const hz = -Math.sin(FLAG_RY) * 0.1;
      b.beam([hx, flagTop + 1.1, hz], [hx, flagTop + POLE - 0.35, hz], 0.012, { round: true, seg: 3, c: "rope", m: M.rope, ao: 0 });
      b.box(hx, flagTop + 1.0, hz, 0.06, 0.18, 0.06, { c: "iron", m: M.metal, bevel: 0.01 });
    });
    flag = makeFlag(stage, [Math.cos(FLAG_RY) * 0.1, flagTop + POLE - 0.42, -Math.sin(FLAG_RY) * 0.1], FLAG_W, FLAG_H, FLAG_RY);

    // a lamp: a stout tarred post on a stone foot, a capped top, an arm out with a brace, an iron lantern hung from it
    // (its panes light at dusk)
    const LAMP = "#4a3e33";
    const lamp = (x, y, z, ry, foot = true) => {
      b.push(x, y, z, ry);
      if (foot) b.box(0, -0.3, 0, 0.66, 0.52, 0.66, { c: stone("stone", 0.4), m: M.stone, bevel: 0.08, ao: 0.25 });
      const p0 = foot ? 0.22 : 0;
      b.post(0, p0, 0, 0.13, 3.0, { c: LAMP });
      b.box(0, p0, 0, 0.34, 0.16, 0.34, { c: "iron", m: M.metal, bevel: 0.02 });
      b.box(0, p0 + 3.0, 0, 0.34, 0.09, 0.34, { c: "#3b322a", m: M.wood, bevel: 0.02 });
      b.cone(0, p0 + 3.09, 0, 0.22, 0.24, { c: "#3b322a", m: M.wood, seg: 4, ry: Math.PI / 4 });
      const ay = p0 + 2.8;
      b.beam([0, ay, 0.1], [0, ay, 0.92], 0.065, { c: LAMP });
      b.beam([0, ay - 0.55, 0.12], [0, ay - 0.04, 0.6], 0.04, { c: LAMP });
      b.beam([0, ay - 0.04, 0.8], [0, ay - 0.15, 0.8], 0.014, { round: true, seg: 4, c: "iron", m: M.metal, ao: 0, bucket: FINE });
      const ly = ay - 0.88;
      b.box(0, ly, 0.8, 0.36, 0.05, 0.36, { c: "iron", m: M.metal, bevel: 0.012 });
      b.box(0, ly + 0.05, 0.8, 0.27, 0.4, 0.27, { c: "#3a342d", m: M.window, bevel: 0, ao: 0, jit: 0 });
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ])
        b.box(sx * 0.14, ly + 0.05, 0.8 + sz * 0.14, 0.045, 0.4, 0.045, { c: "iron", m: M.metal, bevel: 0, ao: 0 });
      b.box(0, ly + 0.44, 0.8, 0.4, 0.05, 0.4, { c: "iron", m: M.metal, bevel: 0.012 });
      b.cone(0, ly + 0.49, 0.8, 0.28, 0.22, { c: "iron", m: M.metal, seg: 4, ry: Math.PI / 4 });
      b.addGeo(new T.TorusGeometry(0.045, 0.014, 4, 8), { x: 0, y: ly + 0.74, z: 0.8, c: "iron", m: M.metal, ao: 0, bucket: FINE });
      b.pop();
    };
    // a bench: a thick plank on two blocks of stone
    const bench = (x, z, L, ry, y = TOP, legs = "stone") => {
      b.push(x, y, z, ry);
      for (const s of [-1, 1])
        if (legs === "stone") b.box(s * (L / 2 - 0.3), -0.04, 0, 0.32, 0.42, 0.42, { c: stone("stone", 0.6), m: M.stone, bevel: 0.05, ao: 0.3 });
        else b.box(s * (L / 2 - 0.25), 0, 0, 0.14, 0.38, 0.4, { c: "#5b4d3f", m: M.wood, bevel: 0.02, ao: 0.3 });
      b.box(0, 0.38, 0, L, 0.1, 0.5, { c: "woodLight", m: M.wood, bevel: 0.03, ao: 0.1 });
      b.pop();
    };
    // a planter: a half-barrel tub of earth, a flowering bush in it
    const planter = (x, z, c, y = TOP) => {
      b.lathe(
        x,
        y,
        z,
        [
          [0.01, 0],
          [0.38, 0],
          [0.44, 0.42],
          [0.42, 0.46],
          [0.36, 0.42],
          [0.01, 0.4],
        ],
        { c: "wood", m: M.wood, seg: 12, flat: true, ao: 0.2 },
      );
      for (const f of [0.12, 0.34]) b.cyl(x, y + f, z, 0.4 + f * 0.11, 0.04, { c: "iron", m: M.metal, seg: 12, open: true, ao: 0 });
      b.bush(x, z, 0.42, { y: y + 0.38, n: 2 });
      flowers(x, y + 0.5, z, 0.36, c, 7);
    };

    sec("furniture", () => {
      // lamps by the two lanes' mouths in the north corners, and on the south wall's piers (its west corner, the boardwalk's head)
      lamp(-8.95, TOP, -HW + 0.4, 0);
      lamp(8.95, TOP, -HW + 0.4, 0);
      lamp(PIERS[0], wallTop + 0.29, HW - 0.3, Math.PI * 0.75, false);
      lamp(PIERS[1], wallTop + 0.29, HW - 0.3, 0.45, false);
      lamp(PIERS[2], wallTop + 0.29, HW - 0.3, -0.45, false);
      // benches along the west and east sides facing in, and along the wall facing the sea
      bench(-HW + 1.1, -5.2, 2.1, Math.PI / 2);
      bench(HW - 1.1, -5.2, 2.1, -Math.PI / 2);
      bench(-HW + 1.1, 5.6, 2.1, Math.PI / 2);
      bench(HW - 1.1, 5.6, 2.1, -Math.PI / 2);
      bench(-7.4, HW - 1.15, 2.3, 0);
      bench(5.55, HW - 1.15, 1.8, 0);
      planter(-5.25, HW - 1.15, "#e8b0a0");
      planter(7.0, HW - 1.15, "#f3f1ec");
      planter(HW - 1.05, 8.2, "#efe08a");
      planter(-6.5, -HW + 1.0, "#f3f1ec");
    });

    // the birch in the plaza's south-west corner: a round bed of stones to sit on, turfed, flowers in the grass; a slim
    // white trunk with a kink or two, boughs out to clusters of small lumpy puffs with gaps between them
    sec("birch", () => {
      const [tx, tz] = TREE;
      b.stoneRing(tx, tz, 0.95, Y0 + 0.03, 0.36, 0.3, { pal: "stone", course: 0.36, len: 0.7, core: false });
      b.stoneRing(tx, tz, 0.98, Y0 + 0.39, 0.1, 0.4, { pal: "stone", course: 0.1, len: 0.75, core: false });
      b.cyl(tx, Y0 + 0.03, tz, 0.84, 0.35, { c: "#7f9a4c", m: M.grass, seg: 12, ao: 0 });
      const h = 6.3;
      const y0 = Y0 + 0.36;
      const spine = [
        [tx, y0 - 0.1, tz, 0.12],
        [tx + 0.07, y0 + h * 0.28, tz + 0.04, 0.1],
        [tx - 0.05, y0 + h * 0.52, tz - 0.03, 0.075],
        [tx + 0.1, y0 + h * 0.74, tz - 0.07, 0.055],
        [tx + 0.06, y0 + h * 0.9, tz - 0.04, 0.03],
      ];
      const along = (f) => {
        const s = clamp(f, 0, 0.999) * (spine.length - 1);
        const i = Math.floor(s);
        const t = s - i;
        return [0, 1, 2].map((j) => lerp(spine[i][j], spine[i + 1][j], t));
      };
      for (let i = 0; i < spine.length - 1; i++) {
        const [ax, ay, az, ar] = spine[i];
        const [bx, by, bz, br] = spine[i + 1];
        b.beam([ax, ay, az], [bx, by, bz], ar, { round: true, r2: br, seg: 7, c: "#e4ded0", m: M.wood, ao: i ? 0 : 0.4 });
      }
      // the bark's dark marks
      for (let i = 0; i < 16; i++) {
        const f = 0.02 + r2() * 0.7;
        const a = r2() * TAU;
        const [px, py, pz] = along(f);
        const rr = lerp(0.12, 0.05, f / 0.8) + 0.005;
        b.box(px + Math.cos(a) * rr, py, pz + Math.sin(a) * rr, 0.09 + r2() * 0.06, 0.025 + r2() * 0.02, 0.02, {
          ry: -a + Math.PI / 2,
          c: "#3d3832",
          m: M.wood,
          bevel: 0,
          ao: 0,
          jit: 0.03,
          bucket: FINE,
        });
      }
      // the boughs, each out to a cluster of puffs; a cluster at the top
      const puffs = [];
      const boughs = 6;
      for (let i = 0; i < boughs; i++) {
        const f = 0.4 + (i / boughs) * 0.42 + (r2() - 0.5) * 0.04;
        const a = i * 2.4 + 0.3 + (r2() - 0.5) * 0.4;
        const len = lerp(1.55, 0.9, i / boughs) * (0.9 + r2() * 0.2);
        const from = along(f);
        const to = [from[0] + Math.cos(a) * len, from[1] + len * (0.55 + r2() * 0.25), from[2] + Math.sin(a) * len];
        const mid = [lerp(from[0], to[0], 0.5), lerp(from[1], to[1], 0.5) + 0.12, lerp(from[2], to[2], 0.5)];
        b.beam(from, mid, 0.045, { round: true, r2: 0.034, seg: 5, c: "#d9d2c2", m: M.wood, ao: 0 });
        b.beam(mid, to, 0.034, { round: true, r2: 0.02, seg: 5, c: "#7d736a", m: M.wood, ao: 0 });
        const n = 2 + (r2() < 0.5 ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const pr = h * (0.065 + r2() * 0.03);
          const pa = a + (r2() - 0.5) * 1.6;
          const pd = k ? 0.35 + r2() * 0.25 : 0.1;
          puffs.push([to[0] + Math.cos(pa) * pd, to[1] + (r2() - 0.3) * 0.35 - (k ? 0.12 : 0), to[2] + Math.sin(pa) * pd, pr]);
        }
      }
      const crown = along(0.96);
      for (let k = 0; k < 3; k++) {
        const a = k * 2.1 + 0.6;
        puffs.push([crown[0] + Math.cos(a) * 0.3, crown[1] - 0.15 + k * 0.12, crown[2] + Math.sin(a) * 0.3, h * (0.07 + r2() * 0.02)]);
      }
      b.addGeo(crownGeo(puffs, r2, U.noise3), { c: "#ffffff", m: M.leaf, ao: 0, jit: 0, vary: 0.06 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + r2() * 0.5;
        const d = 0.3 + r2() * 0.42;
        tuft(tx + Math.cos(a) * d, Y0 + 0.38, tz + Math.sin(a) * d, 0.2 + r2() * 0.1);
      }
      flowers(tx + 0.3, Y0 + 0.3, tz - 0.25, 0.4, "#f3f1ec", 6);
      flowers(tx - 0.35, Y0 + 0.3, tz + 0.3, 0.3, "#efe08a", 4);
    });

    // the well: a round of stones, a timber frame with a little roof, a windlass, a rope and a bucket
    sec("well", () => {
      // out in the corner, a couple of metres clear of where the villagers stand (plots.js spotsOf)
      const wx = -9.6;
      const wz = -7.0;
      b.stoneRing(wx, wz, 0.72, TOP - 0.05, 0.84, 0.3, { pal: "stoneCool", course: 0.28, len: 0.62, core: false });
      b.cyl(wx, TOP + 0.5, wz, 0.6, 0.02, { c: "#3b5054", m: M.water, seg: 12, ao: 0 });
      b.stoneRing(wx, wz, 0.74, TOP + 0.79, 0.12, 0.36, { pal: "stone", course: 0.12, len: 0.7, core: false });
      for (const s of [-1, 1]) {
        b.post(wx + s * 0.78, TOP + 0.3, wz, 0.07, 1.75, { c: "woodDark" });
        b.box(wx + s * 0.78, TOP + 0.5, wz, 0.3, 0.12, 0.2, { c: "iron", m: M.metal, bevel: 0.02 });
      }
      b.beam([wx - 0.95, TOP + 1.5, wz], [wx + 0.95, TOP + 1.5, wz], 0.07, { round: true, seg: 8, c: "wood" });
      b.addGeo(new T.TorusGeometry(0.07, 0.03, 4, 10), { x: wx + 0.95, y: TOP + 1.5, z: wz, ry: Math.PI / 2, c: "iron", m: M.metal, ao: 0 });
      b.beam([wx + 0.95, TOP + 1.5, wz], [wx + 0.95, TOP + 1.25, wz + 0.18], 0.025, { c: "iron", m: M.metal });
      b.beam([wx, TOP + 1.47, wz], [wx, TOP + 0.95, wz], 0.014, { round: true, seg: 4, c: "rope", m: M.rope, ao: 0, bucket: FINE });
      b.bucket(wx, TOP + 0.66, wz);
      // the roof: two boards of shingle on rafters, a ridge
      for (const s of [-1, 1]) {
        b.box(wx, TOP + 2.0, wz + s * 0.33, 1.95, 0.06, 0.78, { rx: s * 0.62, c: "#6e5c48", m: M.wood, bevel: 0.02, ao: 0.2 });
      }
      b.beam([wx - 1.0, TOP + 2.28, wz], [wx + 1.0, TOP + 2.28, wz], 0.06, { c: "woodDark" });
      b.bucket(wx - 0.3, TOP, wz - 1.05);
    });

    // the notice post by the north-east lane: a stout post, a board of papers under a little roof
    sec("notice", () => {
      const nx = 9.2;
      const nz = -8.0;
      b.push(nx, TOP, nz, Math.atan2(-nx, -nz));
      b.box(0, -0.2, 0, 0.5, 0.36, 0.5, { c: stone("stone", 0.4), m: M.stone, bevel: 0.06 });
      b.post(0, 0.14, 0, 0.1, 2.25, { c: "#4a3f35" });
      b.box(0, 1.05, 0.12, 1.25, 0.9, 0.07, { c: "wood", m: M.wood, bevel: 0.02 });
      b.box(0, 1.92, 0.12, 1.45, 0.08, 0.12, { c: "woodDark", m: M.wood, bevel: 0.02 });
      for (const s of [-1, 1]) b.box(s * 0.36, 2.04, 0.14, 0.78, 0.05, 0.5, { rz: s * -0.5, c: "#5d4c3c", m: M.wood, bevel: 0.015 });
      const papers = [
        [-0.36, 1.35, 0.32, 0.38, "#f3f1ec", 0.05],
        [0.05, 1.42, 0.3, 0.3, "#efe8d6", -0.04],
        [0.4, 1.3, 0.26, 0.36, "#f26a1b", 0.06],
        [-0.2, 1.12, 0.36, 0.24, "#ece6d8", -0.08],
        [0.24, 1.15, 0.24, 0.2, "#f6f4f0", 0.02],
      ];
      for (const [px, py, w, h, c, rz] of papers) b.box(px, py - h / 2, 0.16, w, h, 0.012, { rz, c, m: M.paint, bevel: 0, ao: 0, jit: 0.01, bucket: FINE });
      b.pop();
      // a cart's worth of stores beside it
      b.barrel(10.6, TOP, -6.5, { h: 0.9, r: 0.33 });
      b.barrel(10.2, TOP, -5.8, { h: 0.82, r: 0.3, ry: 0.8 });
      b.crate(10.75, TOP, -7.4, 0.7, { ry: 0.25 });
      b.crate(10.7, TOP + 0.7, -7.35, 0.55, { ry: -0.1 });
      b.barrel(9.85, TOP, -7.0, { lie: true, ry: 1.1, h: 0.8, r: 0.28 });
    });

    // a fire at the head of the steps, either side: a wide, shallow iron bowl of glowing coals set into the top of a
    // squat pillar of stones (the flames themselves flicker in the moving layer)
    const FIRES = [];
    sec("fires", () => {
      for (const s of [-1, 1]) {
        const x = s * (STEP_X + CHEEK + 0.75);
        const z = HW - 1.0;
        b.box(x, TOP - 0.12, z, 1.0, 0.46, 1.0, { c: stone("stone", 0.3), m: M.stone, bevel: 0.08, ao: 0.3 });
        b.box(x, TOP + 0.34, z, 0.8, 0.55, 0.8, { c: stone("stone", 0.9), m: M.stone, bevel: 0.07, ao: 0.15, ry: 0.06 * s });
        b.box(x, TOP + 0.89, z, 0.84, 0.36, 0.84, { c: stone("stone", 1.4), m: M.stone, bevel: 0.07, ao: 0.1, ry: -0.05 * s });
        const yb = TOP + 1.25;
        b.box(x, yb, z, 0.98, 0.12, 0.98, { c: kerbC(0.1), m: M.stone, bevel: 0.08, ao: 0.1 });
        // the bowl: broad and shallow, its rim rolled over, sitting in the cap
        b.lathe(
          x,
          yb + 0.06,
          z,
          [
            [0.01, 0],
            [0.3, 0.01],
            [0.44, 0.12],
            [0.52, 0.22],
            [0.55, 0.26],
            [0.5, 0.27],
            [0.4, 0.17],
            [0.01, 0.12],
          ],
          { c: "#36332f", m: M.metal, seg: 14, ao: 0.2 },
        );
        // the coals: dark lumps heaped in the bowl, the ones at the heart glowing
        for (let i = 0; i < 9; i++) {
          const a = r2() * TAU;
          const d = r2() * 0.34;
          const cr = 0.08 + r2() * 0.05;
          b.ball(x + Math.cos(a) * d, yb + 0.22 + (0.34 - d) * 0.2, z + Math.sin(a) * d, cr, { c: "#2c2622", m: M.dark, detail: 0, sy: 0.7, ao: 0 });
        }
        b.embers(x, yb + 0.27, z, 0.28, { light: false });
        b.light(x, yb + 0.7, z, "#ff8c3a", 1.4);
        FIRES.push([x, yb + 0.24, z]);
      }
    });
    flames = makeFlames(stage, FIRES);

    // ================================================================ the boardwalk and the pier
    const pileC = (wy) => (wy < -0.12 ? "#2b2f27" : wy < 0.3 ? "#34372d" : wy < 0.65 ? "#4b4a3c" : wy < 0.75 ? "#5e594b" : "#6c6152");
    // a deck of planks across x from x0 to x1 (in two or three lengths, their joints staggered), rows from z0 to z1
    const PAL_DECK = ["#958670", "#8a7c67", "#9e8f78", "#7f735f", "#a59780", "#8f8068"];
    const plank = plankGeo(0.26, 0.07, 0.022);
    const plankAt = (x, y, z, len, slope = 0, ry = 0) => {
      const c = new T.Color(r2() < 0.06 ? "#b39a78" : pick(PAL_DECK)).offsetHSL(0, 0, (r2() - 0.5) * 0.04);
      b.addGeo(plank, { x, y, z, sx: len, rx: -slope, ry: ry + (r2() - 0.5) * 0.012, c, m: M.wood, ao: 0.12, jit: 0.02 });
    };
    // a pile from the sea bed (or the sand) up to top; a bollard where it runs up through the deck, rope round it. It is
    // laid in lengths, each its own colour: dark with weed under the water, the band the tide wets, weathered wood above,
    // tarred where it stands up through the deck
    const pile = (x, z, top, r, bollard) => {
      const bed = lowOf(x, z, 0.3) - 0.6;
      const yd = deckY(z);
      const cuts = [
        [-0.2, "#2b2f27", "#2d3129"],
        [0.7, "#363b30", "#545140"],
        [bollard ? yd + 0.05 : top, "#655b4d", "#6c6152"],
        [top, "#4f463c", "#4f463c"],
      ];
      let y0 = bed;
      for (const [cut, c0, c1] of cuts) {
        const y1 = Math.min(cut, top);
        if (y1 - y0 > 0.02) {
          const last = y1 >= top - 1e-6;
          b.cyl(x, y0, z, r * lerp(1.04, 0.96, (y0 - bed) / (top - bed)), y1 - y0, {
            r2: r * lerp(1.04, 0.96, (y1 - bed) / (top - bed)),
            c: c0,
            m: M.wood,
            seg: 8,
            ao: 0.05,
            open: !(last && bollard),
            colors: (wx, wy) => (wy < (y0 + y1) / 2 ? c0 : c1),
          });
        }
        y0 = Math.max(y0, y1);
      }
      if (bollard) {
        b.cyl(x, top - 0.02, z, r * 0.9, 0.06, { c: "#3a332c", m: M.wood, seg: 8 });
        b.addGeo(new T.TorusGeometry(r + 0.025, 0.035, 5, 10), { x, y: yd + 0.3, z, rx: Math.PI / 2, c: "rope", m: M.rope, ao: 0, bucket: FINE });
        b.addGeo(new T.TorusGeometry(r + 0.025, 0.035, 5, 10), { x, y: yd + 0.38, z, rx: Math.PI / 2 + 0.15, c: "rope", m: M.rope, ao: 0, bucket: FINE });
      }
    };
    // the life module's gulls stand on the deck near the end, a little in from either edge: keep their spots clear
    const gullAt = (x, z, r = 0.9) =>
      [
        [PX + PH - 0.3, PIER.z1 - 0.8],
        [PX - PH + 0.3, PIER.z1 - 3.1],
        [PX + PH - 0.3, PIER.z1 - 5.4],
      ].some(([gx, gz]) => Math.hypot(gx - x, gz - z) < r);

    sec("pier", () => {
      // the bents the stem stands on: two piles each, a cap across them, spaced a little unevenly as a pier built a span
      // at a time is; the last is the head's first row
      const bents = [];
      for (let z = HW + 1.4; z < PIER.z0; z += 2.2) bents.push(z);
      for (let z = PIER.z0 + 0.4; z < HEAD_Z0 - 1.6; z += 3.3 + (r2() - 0.5) * 0.8) bents.push(z);
      bents.push(HEAD_Z0 + 0.3);
      // bollards where the boats tie up (their bows and sterns), and now and then between
      const tieAt = (z, s) => (s > 0 ? [57.6, 62.4] : [66.6, 71.4]).some((t) => Math.abs(z - t) < 1.75);
      const lastB = { "-1": -99, 1: -99 };
      bents.forEach((z, k) => {
        if (k === bents.length - 1) return;
        const yd = deckY(z);
        const cap = yd - 0.47;
        const sea = H(PX, z) < 0.2;
        for (const s of [-1, 1]) {
          const px = PX + s * (PH - 0.24);
          let bollard = sea && !gullAt(px, z) && (tieAt(z, s) || (z - lastB[s] > 7 && r2() < 0.35));
          if (bollard && z - lastB[s] < 2.5) bollard = false;
          if (bollard) lastB[s] = z;
          pile(px, z, bollard ? yd + 0.62 : cap + 0.2, sea ? 0.17 : 0.13, bollard);
        }
        // the cap across the bent
        b.box(PX, cap, z, PH * 2 - 0.05, 0.22, 0.26, { c: "#5d5245", m: M.wood, bevel: 0.03 });
        // crossed braces between the piles, above the water and below the deck
        const low = Math.max(H(PX, z) + 0.25, 0.15);
        if (cap - low > 1.0) {
          for (const s of [-1, 1])
            b.beam([PX - s * (PH - 0.3), cap - 0.05, z + 0.12 * s], [PX + s * (PH - 0.3), low, z + 0.12 * s], 0.06, {
              c: "#57493b",
              m: M.wood,
              bevel: 0,
              colors: (wx, wy) => pileC(wy + 0.2),
            });
        }
      });
      // three stringers along the length, a span at a time, under the planks
      for (let i = 0; i < bents.length - 1; i++) {
        const za = bents[i];
        const zb = bents[i + 1];
        for (const sx of [-1, 0, 1]) {
          const x = PX + sx * (PH - 0.35);
          const ya = deckY(za) - 0.07 - 0.1;
          const yb = deckY(zb) - 0.07 - 0.1;
          b.beam([x, ya, za - 0.15], [x, yb, zb + 0.15], 0.1, { r2: 0.08, c: "#5f5446", m: M.wood, bevel: 0, roll: 0 });
        }
      }
      // the planks across, weathered silver-brown, now and then a newer one, ends a little ragged
      const step = 0.29;
      for (let z = HW - 0.3; z < HEAD_Z0 - 0.1; z += step) {
        const slope = Math.atan2(deckY(z + 0.5) - deckY(z - 0.5), 1);
        plankAt(PX + (r2() - 0.5) * 0.08, deckY(z), z, PH * 2 + 0.08 + (r2() - 0.5) * 0.14, slope);
      }
      // a facing board along each side of the stem
      for (const s of [-1, 1]) {
        for (let i = 0; i < bents.length - 1; i++) {
          const za = bents[i];
          const zb = bents[i + 1];
          b.beam([PX + s * (PH + 0.03), deckY(za) - 0.18, za - 0.02], [PX + s * (PH + 0.03), deckY(zb) - 0.18, zb + 0.02], 0.035, {
            r2: 0.11,
            c: "#53483c",
            m: M.wood,
            bevel: 0,
            roll: 0,
          });
        }
      }
      // stores on the deck by the root, coils of rope along the stem
      b.crate(PX + PH - 0.45, DECK, PIER.z0 + 1.6, 0.7, { ry: 0.12 });
      b.crate(PX + PH - 0.45, DECK, PIER.z0 + 2.35, 0.62, { ry: -0.2 });
      b.crate(PX + PH - 0.42, DECK + 0.7, PIER.z0 + 1.7, 0.52, { ry: 0.35 });
      b.barrel(PX - PH + 0.42, DECK, PIER.z0 + 1.2, { h: 0.86, r: 0.31 });
      ropeCoil(PX + PH - 0.55, DECK, PIER.z0 + 9.1, 0.3);
      ropeCoil(PX - PH + 0.55, DECK, PIER.z0 + 26.2, 0.28);
      ropeCoil(PX + PH - 0.55, DECK, 61.0, 0.3);
    });

    // the pier's head: a broad landing across the end on three rows of heavy log piles, a hoist at its corner
    sec("head", () => {
      const zEnd = PIER.z1;
      const rows = [HEAD_Z0 + 0.3, (HEAD_Z0 + zEnd) / 2, zEnd - 0.3];
      const cols = [-HEAD_HW + 0.3, -1.25, 1.25, HEAD_HW - 0.3];
      const cap = DECK - 0.51;
      rows.forEach((z, ri) => {
        cols.forEach((cx, ci) => {
          const x = PX + cx;
          // the corners' piles run up through the deck as bollards
          const corner = (ci === 0 || ci === cols.length - 1) && ri !== 1;
          pile(x, z, corner ? DECK + 0.7 : cap + 0.22, 0.25, corner && !gullAt(x, z, 1.2));
        });
        b.box(PX, cap, z, HEAD_HW * 2 - 0.05, 0.26, 0.32, { c: "#5a4f42", m: M.wood, bevel: 0.03 });
        // crossed braces between each outer pair of piles
        const low = 0.2;
        for (const [ca, cb] of [
          [cols[0], cols[1]],
          [cols[2], cols[3]],
        ])
          for (const s of [-1, 1])
            b.beam([PX + (s > 0 ? ca : cb), cap - 0.05, z + 0.15 * s], [PX + (s > 0 ? cb : ca), low, z + 0.15 * s], 0.07, {
              c: "#57493b",
              m: M.wood,
              bevel: 0,
              colors: (wx, wy) => pileC(wy + 0.2),
            });
      });
      // stringers along under the planks
      for (let x = -HEAD_HW + 0.35; x < HEAD_HW; x += 1.08)
        b.beam([PX + x, DECK - 0.17, HEAD_Z0 + 0.05], [PX + x, DECK - 0.17, zEnd - 0.05], 0.1, { r2: 0.08, c: "#5f5446", m: M.wood, bevel: 0, roll: 0 });
      // the planks, each row in two lengths with the joint staggered
      for (let z = HEAD_Z0 + 0.14; z < zEnd; z += 0.29) {
        const j = (r2() - 0.5) * 3.2;
        const x0 = -HEAD_HW - 0.06 + (r2() - 0.5) * 0.08;
        const x1 = HEAD_HW + 0.06 + (r2() - 0.5) * 0.08;
        plankAt(PX + (x0 + j) / 2, DECK, Math.min(z, zEnd - 0.13), j - x0 - 0.02);
        plankAt(PX + (j + x1) / 2, DECK, Math.min(z, zEnd - 0.13), x1 - j - 0.02);
      }
      // facing boards round its edge
      const fb = (x, z, w, d) => b.box(x, DECK - 0.29, z, w, 0.22, d, { c: "#53483c", m: M.wood, bevel: 0.01 });
      fb(PX, zEnd + 0.035, HEAD_HW * 2 + 0.14, 0.07);
      for (const s of [-1, 1]) {
        fb(PX + s * (HEAD_HW + 0.035), (HEAD_Z0 + zEnd) / 2, 0.07, zEnd - HEAD_Z0 + 0.07);
        fb(PX + s * ((HEAD_HW + PH) / 2 + 0.03), HEAD_Z0 - 0.035, HEAD_HW - PH + 0.07, 0.07);
      }
      // the hoist: a stout mast braced at its foot, a jib out over the water to the east, a block and a load on its rope,
      // the rope back down the mast to a winch
      const mx = PX + 2.6;
      const mz = HEAD_Z0 + 1.15;
      const MH = 4.1;
      b.box(mx, DECK, mz, 0.34, MH, 0.34, { c: "#4a3f35", m: M.wood, bevel: 0.04, ao: 0.3 });
      b.cone(mx, DECK + MH, mz, 0.26, 0.3, { c: "#3b322a", m: M.wood, seg: 4, ry: Math.PI / 4 });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU;
        const ca = Math.cos(a), sa = Math.sin(a);
        b.beam([mx + ca * 0.95, DECK, mz + sa * 0.95], [mx + ca * 0.12, DECK + 1.0, mz + sa * 0.12], 0.06, { c: "#54473a", m: M.wood });
      }
      for (const yy of [0.25, MH - 0.6]) b.box(mx, DECK + yy, mz, 0.38, 0.07, 0.38, { c: "iron", m: M.metal, bevel: 0.01, ao: 0 });
      const jy = DECK + MH - 0.55;
      const jx = mx + 3.1;
      b.beam([mx - 0.25, jy, mz], [jx, jy + 0.45, mz], 0.1, { r2: 0.09, c: "#54473a", m: M.wood });
      b.beam([mx + 0.12, DECK + 2.0, mz], [mx + 1.9, jy + 0.22, mz], 0.07, { c: "#54473a", m: M.wood });
      b.box(jx - 0.05, jy + 0.08, mz, 0.16, 0.26, 0.13, { c: "#3a332c", m: M.wood, bevel: 0.02 });
      b.beam([jx - 0.05, jy + 0.08, mz], [jx - 0.05, DECK + 0.95, mz], 0.014, { round: true, seg: 4, c: "rope", m: M.rope, ao: 0, bucket: FINE });
      b.ball(jx - 0.05, DECK + 0.62, mz, 0.36, { c: "#6b604c", m: M.rope, detail: 1, sy: 1.1, ao: 0.2 });
      b.beam([jx - 0.1, jy + 0.36, mz + 0.05], [mx + 0.2, jy + 0.05, mz + 0.05], 0.012, { round: true, seg: 3, c: "rope", m: M.rope, ao: 0, bucket: FINE });
      b.beam([mx + 0.19, jy + 0.05, mz + 0.1], [mx + 0.19, DECK + 0.82, mz + 0.42], 0.012, { round: true, seg: 3, c: "rope", m: M.rope, ao: 0, bucket: FINE });
      // the winch: a drum on two cheeks, a crank
      for (const s of [-1, 1]) b.box(mx + s * 0.38, DECK, mz + 0.5, 0.1, 0.8, 0.36, { c: "#4a3f35", m: M.wood, bevel: 0.02 });
      b.addGeo(new T.CylinderGeometry(0.15, 0.15, 0.66, 9), { x: mx, y: DECK + 0.62, z: mz + 0.5, rz: Math.PI / 2, c: "#6a5a48", m: M.wood, ao: 0.1 });
      b.beam([mx + 0.45, DECK + 0.62, mz + 0.5], [mx + 0.52, DECK + 0.9, mz + 0.62], 0.025, { c: "iron", m: M.metal });
      // the lantern by the south-west corner, hung out over the water
      lamp(PX - HEAD_HW + 0.35, DECK, zEnd - 1.25, -Math.PI / 3, false);
      // a bench to sit and look out to sea, stores, a coil of rope, a ladder down the end
      bench(PX - 1.5, zEnd - 0.75, 1.9, 0, DECK, "wood");
      b.crate(PX + 2.75, DECK, zEnd - 0.95, 0.72, { ry: 0.15 });
      b.crate(PX + 2.6, DECK, zEnd - 1.75, 0.62, { ry: -0.25 });
      b.crate(PX + 2.72, DECK + 0.72, zEnd - 1.05, 0.55, { ry: 0.45 });
      b.barrel(PX - 2.75, DECK, HEAD_Z0 + 0.95, { h: 0.86, r: 0.31 });
      b.barrel(PX - 2.1, DECK, HEAD_Z0 + 0.75, { h: 0.82, r: 0.3, ry: 0.5 });
      b.barrel(PX - 2.6, DECK, HEAD_Z0 + 1.7, { lie: true, ry: 0.3, h: 0.8, r: 0.28 });
      ropeCoil(PX - HEAD_HW + 0.75, DECK, HEAD_Z0 + 2.6, 0.32);
      b.bucket(PX - 0.35, DECK, zEnd - 0.95);
      const lx = PX - 2.15;
      const lz = zEnd + 0.08;
      for (const s of [-1, 1]) b.beam([lx + s * 0.24, DECK + 0.5, lz], [lx + s * 0.24, -1.2, lz + 0.05], 0.04, { c: "#4a4036", colors: (wx, wy) => pileC(wy) });
      for (let y = DECK - 0.35; y > -1.0; y -= 0.34)
        b.beam([lx - 0.24, y, lz + 0.01], [lx + 0.24, y, lz + 0.01], 0.025, { round: true, seg: 5, c: "#5a4e40", colors: (wx, wy) => pileC(wy) });
    });

    // the side landing: a little deck off the stem's east side on two piles, its planks running out from the stem
    sec("landing", () => {
      const x0 = PX + PH;
      const x1 = x0 + SIDE.w;
      for (const z of [SIDE.z0 + 0.3, SIDE.z1 - 0.3]) {
        pile(x1 - 0.3, z, z > SIDE.z0 + 1 ? DECK + 0.62 : DECK - 0.3, 0.2, z > SIDE.z0 + 1);
        b.box((x0 + x1) / 2 - 0.1, DECK - 0.51, z, SIDE.w + 0.2, 0.26, 0.28, { c: "#5a4f42", m: M.wood, bevel: 0.03 });
        b.beam([x1 - 0.35, DECK - 0.55, z + 0.12], [x0 + 0.1, 0.4, z + 0.12], 0.06, { c: "#57493b", m: M.wood, bevel: 0, colors: (wx, wy) => pileC(wy + 0.2) });
      }
      const zm = (SIDE.z0 + SIDE.z1) / 2;
      for (let x = x0 + 0.25; x < x1; x += 0.29) plankAt(Math.min(x, x1 - 0.13), DECK, zm, SIDE.z1 - SIDE.z0 + (r2() - 0.5) * 0.1, 0, Math.PI / 2);
      b.box(x1 + 0.035, DECK - 0.29, (SIDE.z0 + SIDE.z1) / 2, 0.07, 0.22, SIDE.z1 - SIDE.z0 + 0.07, { c: "#53483c", m: M.wood, bevel: 0.01 });
      for (const z of [SIDE.z0 - 0.035, SIDE.z1 + 0.035]) b.box((x0 + x1) / 2, DECK - 0.29, z, SIDE.w, 0.22, 0.07, { c: "#53483c", m: M.wood, bevel: 0.01 });
      // a catch landed: a fish basket, a couple of barrels, a heap of rope
      const basket = [[0.01, 0], [0.26, 0], [0.33, 0.34], [0.35, 0.38], [0.01, 0.36]];
      b.lathe(x0 + 0.75, DECK, SIDE.z0 + 0.7, basket, { c: "#9a7b52", m: M.straw, seg: 10, flat: true, ao: 0.2 });
      for (let i = 0; i < 5; i++) {
        const fx = x0 + 0.75 + (r2() - 0.5) * 0.3;
        const fz = SIDE.z0 + 0.7 + (r2() - 0.5) * 0.3;
        b.ball(fx, DECK + 0.38, fz, 0.08, { c: "#8e9aa0", m: M.scale, detail: 0, sx: 1.8, ao: 0, bucket: FINE });
      }
      b.barrel(x1 - 0.55, DECK, SIDE.z0 + 0.65, { h: 0.84, r: 0.3 });
      b.barrel(x1 - 0.5, DECK, SIDE.z0 + 1.35, { h: 0.8, r: 0.29, ry: 0.6 });
      ropeCoil(x0 + 0.85, DECK, SIDE.z1 - 0.75, 0.3);
    });

    // ================================================================ the beach
    // A clinker boat, its bow to local +x, its keel's middle at (x, y, z): strakes of oiled wood (or tarred) and a
    // painted top strake, thwarts, stems, oars; upside down when `over`, propped on two logs.
    const boat = ({ x, z, ry, over, hull, band }) => {
      const HL = 1.65;
      const N = 14;
      const wAt = (u) => 0.62 * Math.pow(Math.max(0, 1 - u * u), 0.55);
      const yk = (u) => 0.12 * Math.pow(u, 4);
      const ys = (u) => 0.6 + 0.32 * Math.pow(u, 4);
      const pt = (u, s, sd, out = 0) => {
        const a = (s * Math.PI) / 2;
        return [u * HL, yk(u) + (ys(u) - yk(u)) * (1 - Math.cos(a)), sd * (wAt(u) + out) * Math.pow(Math.sin(a), 0.75)];
      };
      // the boat rests on two rollers (or upside down, on its gunwales), so it sits as the sand slopes under it
      const fx = Math.cos(ry);
      const fz = -Math.sin(ry);
      const hb = H(x + fx * HL * 0.55, z + fz * HL * 0.55);
      const hs = H(x - fx * HL * 0.55, z - fz * HL * 0.55);
      const pitch = Math.atan2(hb - hs, HL * 1.1);
      const y = (hb + hs) / 2 + (over ? 0.86 : 0.2);
      b.push(x, y, z, ry);
      b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(pitch));
      if (over) {
        b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(Math.PI));
        // turned over, it rests on its stems' ends; two logs under its gunwales take its weight (local y is down now)
        for (const u of [-0.42, 0.38])
          b.beam([u * HL, ys(u) + 0.12, -0.8], [u * HL + 0.05, ys(u) + 0.12, 0.8], 0.13, { round: true, seg: 7, c: "#6e6152", m: M.wood });
      } else for (const rx of [-0.8, 0.8]) b.beam([rx, -0.08, -0.62], [rx, -0.08, 0.62], 0.1, { round: true, seg: 7, c: "#7a6d5c", m: M.wood });
      for (let k = 0; k < 3; k++) {
        for (const sd of [-1, 1]) {
          const pos = [];
          const s0 = Math.max(0, k / 3 - 0.02);
          const s1 = (k + 1) / 3 + 0.03;
          const out = k * 0.014;
          for (let i = 0; i < N; i++) {
            const u0 = -1 + (i / N) * 2;
            const u1 = u0 + 2 / N;
            const a0 = pt(u0, s0, sd, out);
            const a1 = pt(u1, s0, sd, out);
            const c0 = pt(u0, s1, sd, out);
            const c1 = pt(u1, s1, sd, out);
            pos.push(...a0, ...a1, ...c1, ...a0, ...c1, ...c0);
          }
          const g = new T.BufferGeometry();
          g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
          g.computeVertexNormals();
          b.addGeo(g, {
            c: k === 2 ? band : new T.Color(hull).offsetHSL(0, 0, (k - 1) * 0.025),
            m: k === 2 ? M.paint : M.wood,
            bucket: "cloth",
            ao: 0.25,
            jit: 0,
            vary: 0.05,
          });
        }
      }
      // the keel, the gunwales, the stems
      for (let i = 0; i < 8; i++) {
        const u0 = -0.96 + (i / 8) * 1.92;
        const u1 = u0 + 1.92 / 8;
        b.beam([u0 * HL, yk(u0) - 0.02, 0], [u1 * HL, yk(u1) - 0.02, 0], 0.035, { c: "#3a2e24", m: M.wood });
      }
      for (const sd of [-1, 1])
        for (let i = 0; i < 8; i++) {
          const u0 = -0.95 + (i / 8) * 1.9;
          const u1 = u0 + 1.9 / 8;
          b.beam(pt(u0, 1, sd, 0.025), pt(u1, 1, sd, 0.025), 0.03, { round: true, seg: 5, c: "#4a3b2e", m: M.wood, ao: 0 });
        }
      for (const e of [-1, 1]) {
        const pts = [
          [e * 0.97 * HL, yk(0.97), 0],
          [e * (HL + 0.05), 0.42, 0],
          [e * (HL + 0.09), 0.78, 0],
          [e * (HL + 0.04), 1.02, 0],
        ];
        for (let q = 0; q < pts.length - 1; q++) b.beam(pts[q], pts[q + 1], 0.04, { c: "#3a2e24", m: M.wood });
      }
      if (!over) {
        for (const u of [-0.4, 0.22]) b.box(u * HL, ys(u) - 0.16, 0, 0.22, 0.05, (wAt(u) - 0.05) * 2, { c: "woodLight", m: M.wood, bevel: 0.012 });
        for (const oz of [-0.13, 0.13]) b.beam([-1.2, 0.5, oz], [1.1, 0.55, oz * 1.5], 0.024, { round: true, seg: 6, c: "woodLight", m: M.wood });
        for (let n = 0; n < 6; n++)
          b.ball(-0.75 + (r2() - 0.5) * 0.4, 0.2 + r2() * 0.06, (r2() - 0.5) * 0.3, 0.15 + r2() * 0.05, {
            c: pick(["#4c443c", "#544b42", "#463f38"]),
            m: M.rope,
            detail: 1,
            sy: 0.55,
            ao: 0.3,
          });
      }
      b.pop();
    };

    sec("boats", () => {
      for (const bt of BOATS) boat(bt);
      // a pair of oars and a bucket by the upturned one
      b.beam([-10.3, H(-10.3, 20.2) + 0.05, 20.2], [-10.0, H(-10, 22.6) + 0.05, 22.6], 0.03, { round: true, seg: 6, c: "woodLight", m: M.wood });
      b.bucket(-9.9, H(-9.9, 19.7) - 0.03, 19.7);
    });

    // the nets drying: three grey poles, a rope sagging between their tops, the net hung over it in deep swags, bunched
    // where it is tied at each pole, its hem falling unevenly to the sand; a heap of net at the end
    const netMat = KIT.makeMaterials(KIT.buildUniforms()).cloth;
    sec("nets", () => {
      const zN = NET_Z;
      const poles = NET_POLES;
      const rail = 2.3;
      for (const x of poles) {
        const g = H(x, zN);
        b.cyl(x, g - 0.3, zN, 0.08, rail + 0.6, { r2: 0.06, c: "#7a7066", m: M.wood, seg: 7, flat: true });
        b.box(x, g - 0.06, zN, 0.42, 0.14, 0.42, { c: stone("stoneCool", 0.2), m: M.stone, bevel: 0.05 });
        b.ball(x, g + rail + 0.32, zN, 0.07, { c: "#6a6157", m: M.wood, detail: 0 });
      }
      // the rope's (and the net's top's) height along x: tied at each pole's top, sagging between
      const dips = [0.5, 0.42];
      const topAt = (x) => {
        const i = x < poles[1] ? 0 : 1;
        const t = clamp((x - poles[i]) / (poles[i + 1] - poles[i]), 0, 1);
        return lerp(H(poles[i], zN), H(poles[i + 1], zN), t) + rail + 0.22 - dips[i] * 4 * t * (1 - t);
      };
      for (let i = 0; i < 2; i++)
        for (let k = 0; k < 6; k++) {
          const xa = lerp(poles[i], poles[i + 1], k / 6);
          const xb = lerp(poles[i], poles[i + 1], (k + 1) / 6);
          b.beam([xa, topAt(xa) + 0.02, zN], [xb, topAt(xb) + 0.02, zN], 0.018, { round: true, seg: 4, c: "#6f6452", m: M.rope, ao: 0, bucket: FINE });
        }
      // the net: two layers over the rope (the sea side the longer), folds that bunch up toward the poles
      const x0 = poles[0] - 0.05;
      const x1 = poles[2] + 0.05;
      const NU = 44;
      const NV = 8;
      const gather = (x) => {
        // 1 at a pole, falling to 0 a metre out
        let g = 0;
        for (const p of poles) g = Math.max(g, 1 - Math.abs(x - p) / 1.0);
        return clamp(g, 0, 1);
      };
      // a point of the net: u along it, v down from the rope, on the sea side (side 1) or the land side (-1)
      const netPt = (u, v, side) => {
        const x = lerp(x0, x1, u);
        const ga = gather(x);
        // folds: tight and deep where it is bunched at the poles, long and shallow in the swags
        const fold = Math.sin(u * lerp(36, 70, ga) + side) * lerp(0.05, 0.13, ga) * (0.3 + v) + Math.sin(u * 13.0 + 1.7) * 0.05 * v;
        const drop = ((side > 0 ? 1.55 : 1.05) + Math.sin(x * 2.3 + side) * 0.16 + noise2(x * 0.9 + 3.3, side * 5.1) * 0.35) * (1 - 0.3 * ga);
        const z = NET_Z + side * (0.04 + v * 0.16 + Math.abs(fold)) * (1 - 0.25 * v) + fold * 0.6;
        return [x, Math.max(topAt(x) - v * drop, H(x, z) + 0.04), z, drop];
      };
      const pos = [];
      const uv = [];
      const idx = [];
      for (const side of [1, -1]) {
        const base = pos.length / 3;
        for (let j = 0; j <= NV; j++)
          for (let i = 0; i <= NU; i++) {
            const [x, y, z, drop] = netPt(i / NU, j / NV, side);
            pos.push(x, y, z);
            uv.push(((i / NU) * (x1 - x0)) / 0.45, ((j / NV) * drop) / 0.45);
          }
        for (let j = 0; j < NV; j++)
          for (let i = 0; i < NU; i++) {
            const a = base + j * (NU + 1) + i;
            idx.push(a, a + 1, a + NU + 2, a, a + NU + 2, a + NU + 1);
          }
      }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      b.addGeo(g, { c: "#5a5242", m: M.rope, bucket: "netTri", ao: 0.15, jit: 0, vary: 0.14 });
      // cork floats, barrel-shaped, threaded along the sea side's hem
      const float = (x, y, z, ry, rz) =>
        b.lathe(
          x,
          y - 0.07,
          z,
          [
            [0.01, 0],
            [0.045, 0.005],
            [0.06, 0.07],
            [0.045, 0.135],
            [0.01, 0.14],
          ],
          { c: pick(["#a88e64", "#9c8459", "#b09670"]), m: M.wood, seg: 8, ry, rz: Math.PI / 2 + rz, ao: 0.1, bucket: FINE },
        );
      for (let i = 0; i < 11; i++) {
        const [x, y, z] = netPt((i + 0.5) / 11 + (r2() - 0.5) * 0.02, 1, 1);
        float(x, y + 0.03, z + 0.03, (r2() - 0.5) * 0.4, (r2() - 0.5) * 0.3);
      }
      // the heap: two lumpy mounds of tarred net on the sand by the last pole, a dark core under a shell of the mesh,
      // floats caught in it
      const [hx, hz] = HEAP;
      const hy = H(hx, hz) - 0.04;
      for (const [ox, oz, sx, sy, sz, seed] of [
        [0, 0, 0.75, 0.38, 0.62, 4.1],
        [0.5, 0.32, 0.46, 0.26, 0.42, 9.7],
      ]) {
        const core = new T.IcosahedronGeometry(1, 2);
        const p = core.attributes.position;
        const n = core.attributes.normal;
        const uvs = [];
        for (let i = 0; i < p.count; i++) {
          const vx = p.getX(i);
          const vy = p.getY(i);
          const vz = p.getZ(i);
          const k = 1 + U.noise3(vx * 1.8 + seed, vy * 1.8, vz * 1.8) * 0.3 + U.noise3(vx * 4.2, vy * 4.2 + seed, vz * 4.2) * 0.12;
          p.setXYZ(i, vx * k * sx, Math.max(-0.05, vy) * k * sy, vz * k * sz);
          // a soft mound's light: the ellipsoid's own roundness, a little broken by the lumps
          const nx = vx / sx + (k - 1) * vx * 2;
          const ny = Math.max(0, vy) / sy + 0.3;
          const nz = vz / sz + (k - 1) * vz * 2;
          const L = Math.hypot(nx, ny, nz) || 1;
          n.setXYZ(i, nx / L, ny / L, nz / L);
          uvs.push((vx * sx + vy * sy * 0.5) / 0.32, (vz * sz + vy * sy * 0.7) / 0.32);
        }
        b.addGeo(core, { x: hx + ox, y: hy, z: hz + oz, c: "#3b362c", m: M.rope, ao: 0.3, vary: 0.12 });
        const shell = core.clone();
        shell.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
        b.addGeo(shell, { x: hx + ox, y: hy + 0.01, z: hz + oz, s: 1.05, c: "#5f5645", m: M.rope, bucket: "netTri", ao: 0.2, jit: 0, vary: 0.12 });
      }
      for (let i = 0; i < 6; i++) {
        const a = r2() * TAU;
        const d = 0.15 + r2() * 0.45;
        float(hx + Math.cos(a) * d, hy + 0.36 - d * 0.4, hz + Math.sin(a) * d * 0.8, r2() * TAU, (r2() - 0.5) * 1.2);
      }
    });

    // the stockfish rack on the sand between the steps and the boardwalk, running east and west so the fish face the
    // town: A-frames of grey poles, rails, cod hung in pairs tied at the tail over the rails
    sec("fishrack", () => {
      const rz = RACK.z;
      const { x0, x1 } = RACK;
      const bays = 2;
      const RH = 2.6;
      const RS = 0.75;
      const rails = [1.12, 1.7, 2.24];
      const frames = [];
      for (let i = 0; i <= bays; i++) frames.push(lerp(x0, x1, i / bays));
      const g = (x) => H(x, rz);
      for (const x of frames) {
        const y = g(x);
        for (const s of [-1, 1])
          b.beam([x, H(x, rz + s * RS) - 0.1, rz + s * RS], [x, y + RH, rz - s * 0.16], 0.055, {
            round: true,
            seg: 6,
            c: pick(["#6d655b", "#625b52", "#776e63"]),
            m: M.wood,
          });
        b.beam([x, y + RH - 0.3, rz - 0.08], [x, y + RH - 0.3, rz + 0.08], 0.07, { round: true, seg: 5, c: "rope", m: M.rope, ao: 0 });
      }
      b.beam([x0 - 0.3, g(x0) + RH - 0.22, rz], [x1 + 0.3, g(x1) + RH - 0.22, rz], 0.05, { round: true, seg: 6, c: "#6d655b", m: M.wood });
      for (const yr of rails) b.beam([x0 - 0.15, g(x0) + yr, rz], [x1 + 0.15, g(x1) + yr, rz], 0.033, { round: true, seg: 5, c: "#625b52", m: M.wood });
      // the fish: pairs tied at the tail over a rail, their bodies splayed apart either side of it in an upturned V, each
      // turned and tipped its own way, spaced as they were hung, a gap here and there
      const FISH = fishGeo(0.44);
      const PAL_FISH = ["#8a7356", "#75695a", "#9a8a6c", "#806a50", "#8d8170"];
      for (const yr of rails)
        for (let bay = 0; bay < bays; bay++) {
          const xa = frames[bay] + 0.2;
          const xb = frames[bay + 1] - 0.2;
          let x = xa + r2() * 0.1;
          while (x < xb) {
            if (r2() < 0.18) {
              x += 0.25 + r2() * 0.2;
              continue;
            }
            const y = lerp(g(x0), g(x1), (x - x0) / (x1 - x0)) + yr + 0.035;
            for (const s of [-1, 1]) {
              b.addGeo(FISH, {
                x: x + (r2() - 0.5) * 0.04,
                y,
                z: rz + s * 0.04,
                ry: (s > 0 ? 0 : Math.PI) + (r2() - 0.5) * 0.8,
                rx: s * (0.28 + r2() * 0.12) + (r2() - 0.5) * 0.15,
                sy: 0.88 + r2() * 0.24,
                c: new T.Color(pick(PAL_FISH)).offsetHSL(0, (r2() - 0.5) * 0.04, (r2() - 0.5) * 0.06),
                m: M.wood,
                bucket: "cloth",
                ao: 0.3,
                jit: 0,
                vary: 0.08,
              });
            }
            // the twine that ties the pair
            b.box(x, y - 0.02, rz, 0.04, 0.05, 0.1, { c: "rope", m: M.rope, bevel: 0, ao: 0, bucket: FINE });
            x += 0.24 + r2() * 0.14;
          }
        }
    });

    // the net shed at the back of the beach: red-brown boards on a stone footing, a turf roof, its door to the sea
    sec("shed", () => {
      const [sx, sz] = SHED;
      const W = 3.0;
      const D = 2.6;
      const floor = highOf(sx, sz, 1.4) + 0.12;
      b.push(sx, 0, sz, 0);
      // the footing: stones down to the falling ground
      const low = lowOf(sx, sz + D / 2, 1.4) - 0.3;
      b.stoneBox(0, 0, W + 0.2, D + 0.2, low, floor - low, 0.32, { pal: "stoneDark", course: 0.38, len: 0.78 });
      b.box(0, floor - 0.06, 0, W + 0.1, 0.08, D + 0.1, { c: "#6a5c4c", m: M.wood, bevel: 0.02 });
      // the walls: vertical boards, a darker post at each corner
      const wallH = 1.75;
      const boards = (ax, az, bx, bz, h, door) => {
        const L = Math.hypot(bx - ax, bz - az);
        const n = Math.max(2, Math.round(L / 0.24));
        const ry = -Math.atan2(bz - az, bx - ax);
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          if (door && Math.abs(t - 0.5) * L < 0.45) continue;
          const c = new T.Color(pick(["#8c4a3b", "#834436", "#94523f", "#7c4033"])).offsetHSL(0, 0, (r2() - 0.5) * 0.04);
          b.box(lerp(ax, bx, t), floor, lerp(az, bz, t), L / n - 0.02, h + (r2() - 0.5) * 0.04, 0.07, { ry, c, m: M.paint, bevel: 0, ao: 0.25 });
        }
      };
      boards(-W / 2, D / 2, W / 2, D / 2, wallH, true);
      boards(-W / 2, -D / 2, W / 2, -D / 2, wallH, false);
      boards(-W / 2, -D / 2, -W / 2, D / 2, wallH, false);
      boards(W / 2, -D / 2, W / 2, D / 2, wallH, false);
      // the gables, boarded up to the ridge
      for (const s of [-1, 1])
        b.extrude(
          (s * W) / 2,
          floor + wallH,
          0,
          [
            [-D / 2 - 0.02, 0],
            [D / 2 + 0.02, 0],
            [0, 1.05],
          ],
          0.07,
          { c: "#7f4234", m: M.paint, ry: Math.PI / 2 },
        );
      for (const [px, pz] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ])
        b.post((px * W) / 2, floor, (pz * D) / 2, 0.08, wallH + 0.05, { c: "#3a332d" });
      // the door: a dark opening, a plank door standing half open, pale trim
      b.box(0, floor, D / 2 - 0.02, 0.86, 1.55, 0.05, { c: "#231f1c", m: M.dark, bevel: 0, ao: 0 });
      b.box(-0.5, floor, D / 2 + 0.3, 0.06, 1.5, 0.8, { ry: 0.5, c: "#6b5846", m: M.wood, bevel: 0.015 });
      for (const s of [-1, 1]) b.box(s * 0.48, floor, D / 2 + 0.04, 0.08, 1.62, 0.06, { c: "#d8d0bf", m: M.paint, bevel: 0.01 });
      b.box(0, floor + 1.6, D / 2 + 0.04, 1.04, 0.08, 0.06, { c: "#d8d0bf", m: M.paint, bevel: 0.01 });
      // the roof: birch-bark boards, then a thick mat of turf with grass and a few flowers on it
      const pitch = Math.atan2(1.05, D / 2);
      const run = Math.hypot(1.05, D / 2) + 0.35;
      for (const s of [-1, 1]) {
        const cz = s * (D / 4 + 0.06);
        const cy = floor + wallH + 0.55;
        b.box(0, cy - 0.05, cz, W + 0.5, 0.06, run, { rx: s * pitch, c: "#4b3f34", m: M.wood, bevel: 0.01 });
        b.box(0, cy + 0.0, cz, W + 0.4, 0.2, run - 0.08, { rx: s * pitch, c: "#7f9a4e", m: M.grass, bevel: 0.08, ao: 0.1 });
        for (let i = 0; i < 12; i++) {
          const u = (r2() - 0.5) * (W + 0.2);
          const v = (r2() - 0.5) * (run - 0.3);
          // a point on the turf's top, tipped with the roof
          const yy = cy + 0.19 * Math.cos(pitch) - v * Math.sin(s * pitch);
          const zz = cz + 0.19 * Math.sin(s * pitch) + v * Math.cos(pitch);
          tuft(u, yy, zz, 0.22 + r2() * 0.12);
        }
      }
      flowers(0.6, floor + wallH + 0.6, 0.62, 0.2, "#f3f1ec", 5);
      // the turf held at the eaves by a log
      for (const s of [-1, 1])
        b.beam([-W / 2 - 0.25, floor + wallH + 0.03, s * (D / 2 + 0.3)], [W / 2 + 0.25, floor + wallH + 0.03, s * (D / 2 + 0.3)], 0.06, {
          round: true,
          seg: 6,
          c: "#5b4d3f",
          m: M.wood,
        });
      b.pop();
      // stores at its side: a barrel, a crate, lobster pots
      b.barrel(sx + 1.95, H(sx + 1.95, sz + 0.6), sz + 0.6, { h: 0.85, r: 0.31 });
      b.crate(sx + 1.9, H(sx + 1.9, sz - 0.5) - 0.05, sz - 0.5, 0.62, { ry: 0.3 });
      for (const [px, pz, ry] of [
        [sx + 2.9, sz + 1.5, 0.3],
        [sx + 2.6, sz + 2.2, -0.5],
      ]) {
        const y = H(px, pz) + 0.27;
        b.push(px, y, pz, ry);
        b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(Math.PI / 2));
        b.lathe(
          0,
          -0.4,
          0,
          [
            [0.05, 0],
            [0.24, 0.08],
            [0.27, 0.4],
            [0.24, 0.72],
            [0.05, 0.8],
          ],
          { c: "#8a6a45", m: M.straw, seg: 9, flat: true, ao: 0.2 },
        );
        for (let i = 1; i < 4; i++)
          b.cyl(0, -0.4 + i * 0.2, 0, 0.27 * Math.sin(Math.PI * (0.1 + i * 0.25)) + 0.01, 0.025, { c: "#6b5134", m: M.wood, seg: 9, open: true, ao: 0 });
        b.pop();
      }
    });

    // stores by the boardwalk's foot
    sec("stores", () => {
      const at = (x, z) => H(x, z) - 0.04;
      const [ox, oz] = STORES;
      b.crate(ox - 0.1, at(ox - 0.1, oz - 0.4), oz - 0.4, 0.7, { ry: 0.2 });
      b.crate(ox + 0.2, at(ox + 0.2, oz + 0.5), oz + 0.5, 0.6, { ry: -0.35 });
      b.barrel(ox - 0.2, at(ox - 0.2, oz - 1.5), oz - 1.5, { h: 0.86, r: 0.31 });
      b.barrel(ox, at(ox, oz + 1.5), oz + 1.5, { lie: true, ry: 0.2 });
      ropeCoil(7.2, at(7.2, 23.2), 23.2, 0.3);
    });

    // grass at the foot of the kerb, the wall, the steps' cheeks, the boardwalk's posts and the shed, so nothing stands on
    // the land as if set down on it: small light tufts, a few to the metre
    sec("grass", () => {
      const at = (x, z, s) => tuft(x, H(x, z) + 0.02, z, s);
      // round the kerb, outside it
      for (let i = 0; i < 75; i++) {
        const side = Math.floor(r2() * 3);
        const t = (r2() * 2 - 1) * (HW + 0.4);
        const o = HW + 0.12 + r2() * 0.4;
        const [x, z] = side === 0 ? [t, -o] : side === 1 ? [-o, t] : [o, t];
        if (side === 0 && OPENINGS.north.some(([a, c]) => t > a - 0.2 && t < c + 0.2)) continue;
        if (side > 0 && OPENINGS.west.some(([a, c]) => t > a - 0.2 && t < c + 0.2)) continue;
        at(x, z, 0.2 + r2() * 0.12);
      }
      // along the south wall's foot and the steps' cheeks
      for (let i = 0; i < 45; i++) {
        const x = (r2() * 2 - 1) * (HW + 0.3);
        const z = HW + 0.15 + r2() * 0.8;
        if (Math.abs(x) < STEP_X + CHEEK + 0.05 && z < treads[treads.length - 1].z1) continue;
        if (Math.abs(x - PX) < PH + 0.1) continue;
        at(x, z, 0.2 + r2() * 0.12);
      }
      for (const t of treads)
        for (const sd of [-1, 1])
          for (let i = 0; i < 2; i++) {
            const z = lerp(t.z0, t.z1, r2());
            at(sd * (STEP_X + CHEEK + 0.1 + r2() * 0.35), z, 0.2 + r2() * 0.1);
          }
      // round the boardwalk's posts and the shed
      for (let i = 0; i < 14; i++) {
        const z = lerp(HW + 0.8, 18.5, r2());
        at(PX + (r2() < 0.5 ? -1 : 1) * (PH + 0.1 + r2() * 0.45), z, 0.2 + r2() * 0.1);
      }
      for (let i = 0; i < 10; i++) at(SHED[0] + (r2() - 0.5) * 3.8, SHED[1] - 1.6 + r2() * 0.6, 0.2 + r2() * 0.1);
      // on the turf where a stone has gone: a tuft always, flowers on some
      for (const [x, z] of TURFS) {
        tuft(x + (r2() - 0.5) * 0.25, Y0 + 0.06, z + (r2() - 0.5) * 0.25, 0.2 + r2() * 0.1);
        if (r2() < 0.45) flowers(x + (r2() - 0.5) * 0.2, Y0 - 0.02, z + (r2() - 0.5) * 0.2, 0.25, pick(["#f3f1ec", "#efe08a", "#e8b0a0"]), 3);
      }
    });

    const U2 = KIT.buildUniforms();
    const mats = KIT.makeMaterials(U2);
    // the harbour's grass draws front faces only, its cards laid both ways round (see tuftGeo)
    mats.grass.side = T.FrontSide;
    // the nets: the kit's cloth with the mesh cut out of it, a veil where the twine is too fine to draw
    netMat.map = netTexture();
    netMat.alphaTest = 0.5;
    cutLikeNet(netMat, "harbour-net");
    netMat.needsUpdate = true;
    mats.netTri = netMat;
    const names = Object.keys(b.buckets).filter((k) => b.buckets[k].n);
    made = b.finish(mats, { ghost: false, cull: true });
    made.mats = mats;
    made.tris = tris;
    made.secMs = secMs;
    made.group.children.forEach((o, i) => {
      if (!o.isMesh) return;
      o.name = "harbour-" + names[i];
      // the grass and the smallest things cast no shadow
      if (names[i] === "grass" || names[i] === FINE) o.castShadow = false;
      if (o.material === netMat) {
        const dm = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map: netMat.map, alphaTest: 0.5 });
        o.customDepthMaterial = cutLikeNet(dm, "harbour-net-depth");
      }
    });
    TUFT.dispose();
  } finally {
    KIT.dropGeoCache();
    KIT.boxDetail = was;
  }
  const group = made.group;
  group.name = "harbour";
  group.add(flag);
  group.add(flames);
  group.userData.ms = Math.round(performance.now() - t0);
  group.userData.tris = made.tris;
  group.userData.secMs = made.secMs;

  const plinthR = TIERS.map((t) => t[0]);
  const lastTread = treads[treads.length - 1];
  return {
    group,
    // The top of what the harbour adds to stand on at (x, z), or null.
    height(x, z) {
      // the pier's head and its side landing
      if (Math.abs(x - PX) <= HEAD_HW + 0.02 && z >= HEAD_Z0 - 0.02 && z <= PIER.z1 + 0.05) return DECK;
      if (x >= PX && x <= PX + PH + SIDE.w + 0.02 && z >= SIDE.z0 - 0.02 && z <= SIDE.z1 + 0.02) return DECK;
      // the boardwalk and the pier's stem
      if (Math.abs(x - PX) <= PH + 0.02 && z >= HW - 0.02 && z <= PIER.z1 + 0.05) return deckY(z);
      // the plaza: its paving, and the flag's steps
      if (Math.abs(x) <= HW && Math.abs(z) <= HW) {
        const r = Math.hypot(x, z);
        if (r < plinthR[0]) {
          let y = Y0 + 0.03;
          for (let i = 0; i < TIERS.length; i++) {
            y += TIERS[i][1];
            if (i === TIERS.length - 1 || r >= plinthR[i + 1]) return y;
          }
        }
        return TOP;
      }
      // the steps down to the beach
      if (Math.abs(x) <= STEP_X && z > HW && z <= lastTread.z1) {
        for (const t of treads) if (z <= t.z1) return t.y;
      }
      return null;
    },
    covers: harbourCovers,
    dispose() {
      const seen = new Set();
      group.traverse((o) => {
        if (o.isMesh && !seen.has(o.geometry)) {
          seen.add(o.geometry);
          o.geometry.dispose();
        }
        if (o.isMesh && o.customDepthMaterial && o.material === made.mats.netTri) o.customDepthMaterial.dispose();
      });
      for (const k in made.mats) made.mats[k].dispose();
      flag.material.dispose();
      flames.material.dispose();
    },
  };
}
