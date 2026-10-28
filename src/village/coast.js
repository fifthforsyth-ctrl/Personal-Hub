// The village's coast: one fixed map the town grows into, in metres, the sea
// level at y = 0, the plaza at the origin and the sea to the south (+z).
//
// The town sits at the back of a cove: a sand beach and a pier in front of
// the plaza, rock sides rising to two headlands, and the land climbing
// inland to rolling hills and, far off, mountains. Two rivers come down from
// the hills and fall over the cliffs into the sea, one into the cove beside
// the town and one off the east headland. Sea stacks stand off the headlands
// and islands out on the horizon.
//
// Every plot is a levelled pad on rings round the plaza (sites()), on the
// town's side of the rivers, its front to the plaza; routeOf() is the lane
// from a pad's front to the plaza, found once for every pad so that a later
// lane joins the earlier ones as streets do. Pads that no build has taken
// yet are flat grass, so the land never changes as the town grows.
//
// Pure: no three.js, so scripts/test.mjs checks it.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------------ noise

const PERM = new Uint8Array(512);
{
  let s = 1337;
  const r = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
  const p = [];
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
const hv = (x, z) => PERM[(PERM[x & 255] + z) & 255] / 127.5 - 1;

// Value noise in [-1, 1], smooth, the same everywhere for the same point.
export function noise2(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  let u = x - xi;
  let v = z - zi;
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  const a = hv(xi, zi);
  const b = hv(xi + 1, zi);
  const c = hv(xi, zi + 1);
  const d = hv(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm2(x, z, oct = 3) {
  let s = 0;
  let a = 0.5;
  let f = 1;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    s += noise2(x * f + i * 17.3, z * f - i * 9.1) * a;
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

// ------------------------------------------------------------------ the shore

export const SEA = 0;
// How far the land is drawn, and the sea past it.
export const WORLD_R = 1600;
export const OCEAN_R = 7000;

function coastRaw(x) {
  const ax = Math.abs(x);
  let z = 36;
  // the cove's sides run out into two headlands, the east one the longer
  z += 52 * smooth(38, 96, ax);
  z += x > 0 ? 26 * smooth(90, 170, x) : 9 * smooth(110, 190, -x);
  // past the headlands the shore turns back north and wanders
  z -= 80 * smooth(230, 430, ax);
  z += 24 * noise2(x / 210 + 3.1, 0.7) * smooth(120, 300, ax);
  // a rocky edge everywhere but the beach
  z += 3.4 * noise2(x / 23 + 9.7, 2.3) * smooth(22, 60, ax);
  return z;
}

// The shore's z at x, from a table a metre apart (the sea is beyond it, z larger).
const CX0 = -2400;
const CN = 4801;
const COAST = new Float32Array(CN);
for (let i = 0; i < CN; i++) COAST[i] = coastRaw(CX0 + i);

export function coastZ(x) {
  const f = clamp(x - CX0, 0, CN - 1.001);
  const i = Math.floor(f);
  return COAST[i] + (COAST[i + 1] - COAST[i]) * (f - i);
}

function coastSlope(x) {
  return (coastZ(x + 1) - coastZ(x - 1)) / 2;
}

// How high the land stands where it meets the sea: 0 on the cove's beach,
// rock walls on the cove's sides, higher cliffs on the headlands.
export function cliffTop(x) {
  const ax = Math.abs(x);
  let h = 15 * smooth(30, 64, ax);
  h += x > 0 ? 11 * smooth(90, 160, x) : 5 * smooth(100, 170, -x);
  h += 6 * noise2(x / 60 + 1.3, 4.1) * smooth(60, 120, ax);
  return Math.max(0, h);
}

// The shore with its bays and points smoothed away (a box filter run three times), for distances far from it.
const COAST_FAR = (() => {
  let a = COAST;
  const R = 40;
  for (let pass = 0; pass < 3; pass++) {
    const out = new Float32Array(CN);
    let sum = 0;
    for (let i = -R; i <= R; i++) sum += a[clamp(i, 0, CN - 1)];
    for (let i = 0; i < CN; i++) {
      out[i] = sum / (2 * R + 1);
      sum += a[clamp(i + R + 1, 0, CN - 1)] - a[clamp(i - R, 0, CN - 1)];
    }
    a = out;
  }
  return a;
})();
function coastFarZ(x) {
  const f = clamp(x - CX0, 0, CN - 1.001);
  const i = Math.floor(f);
  return COAST_FAR[i] + (COAST_FAR[i + 1] - COAST_FAR[i]) * (f - i);
}

// How far (x, z) is inland from the shore, across it: negative out at sea.
// Near the shore it is measured square to it; far off, from the shore's
// smoothed line, so the land's shape never jumps where the shore turns.
export function shoreDist(x, z) {
  const raw = coastZ(x) - z;
  const far = smooth(30, 160, Math.abs(raw));
  const s = coastSlope(x);
  const near = raw / Math.sqrt(1 + s * s);
  if (far <= 0) return near;
  return lerp(near, coastFarZ(x) - z, far);
}

// ------------------------------------------------------------------ the land

// Behind the hills, a range of mountains: a high moor, and peaks on it in
// ridges (the noise folded, its creases rounded off so no ridge is a knife).
function mountains(x, z) {
  // ridged: sharp crests where the noise crosses zero, a finer set riding on the broad ones
  const r1 = 1 - Math.abs(fbm2(x / 300 + 4.4, z / 300 - 1.7, 2));
  const r2 = 1 - Math.abs(noise2(x / 110 + 1.1, z / 110 + 8.3));
  const crest = r1 * r1 * (0.72 + 0.28 * r2 * r2);
  // peaks and saddles, not one long wall: the crests rise and fall along their length
  const mass = smooth(-0.45, 0.35, fbm2(x / 420 - 2.1, z / 420 + 5.3, 2));
  const peaks = Math.pow(crest, 1.7) * 200 * (0.3 + 0.7 * mass);
  const moor = (fbm2(x / 170, z / 170, 3) * 0.5 + 0.5) * 40;
  return peaks + moor;
}

// Sea stacks off the headlands and islands on the horizon: { x, z, r, h }.
export const STACKS = [
  { x: 122, z: 150, r: 11, h: 26 },
  { x: 146, z: 168, r: 6.5, h: 17 },
  { x: 108, z: 176, r: 5, h: 9 },
  { x: -132, z: 108, r: 8, h: 19 },
  { x: -112, z: 124, r: 4.5, h: 8 },
];
export const ISLANDS = [
  { x: -1080, z: 760, r: 300, h: 80 },
  { x: 620, z: 1150, r: 360, h: 120 },
  { x: 1320, z: 380, r: 220, h: 55 },
  { x: -420, z: 1420, r: 180, h: 40 },
];

function stackH(x, z) {
  let h = -1e9;
  for (const s of STACKS) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d > s.r * 1.6) continue;
    const a = Math.atan2(z - s.z, x - s.x);
    const rr = s.r * (1 + 0.18 * noise2(Math.cos(a) * 2 + s.x, Math.sin(a) * 2 + s.z));
    const k = 1 - smooth(rr * 0.78, rr * 1.25, d);
    h = Math.max(h, lerp(-6, s.h * (0.92 + 0.08 * noise2(x / 4, z / 4)), Math.pow(k, 0.5)));
  }
  for (const s of ISLANDS) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d > s.r * 1.3) continue;
    const k = Math.max(0, 1 - (d / s.r) ** 2);
    h = Math.max(h, -8 + (s.h + 8) * Math.pow(k, 1.3) + fbm2(x / 70, z / 70, 3) * 14 * k);
  }
  return h;
}

// The land before the rivers cut it and the plots are levelled.
function landH(x, z, dc) {
  const r = Math.hypot(x, z);
  const top = cliffTop(x) * (1 - smooth(30, 170, dc));
  const rise = 0.085 * Math.min(dc, 260) + 0.03 * clamp(dc - 260, 0, 400);
  const hills = (fbm2(x / 150 + 7, z / 150 - 2, 3) * 0.5 + 0.5) * 34 * smooth(60, 260, r) * smooth(25, 120, dc);
  const bumps = fbm2(x / 38 + 2.2, z / 38 + 5.1, 2) * 1.3;
  const mtn = mountains(x, z) * smooth(380, 760, dc);
  return top + rise + hills + bumps + mtn;
}

// The sea bed, the beach and the cliffs where land and sea meet.
function shoreH(x, z) {
  const dc = shoreDist(x, z);
  const bed = Math.max(-26, -1.2 + Math.min(0, dc) * 0.3) + fbm2(x / 30, z / 30, 2) * 1.6 * smooth(0, -20, dc);
  if (dc <= -2) return bed;
  const top = cliffTop(x);
  const cliff = smooth(2, 6, top);
  const land = landH(x, z, Math.max(dc, 0));
  // a beach: sand sloping from the land down under the water
  const wb = 26;
  const beach = lerp(-0.7, landH(x, z, Math.max(dc, wb)), smooth(-2, wb, dc) ** 1.15);
  // a cliff: the land breaks off in a few metres of rock, a ragged foot of boulders below
  const w = 5 + 2.5 * noise2(x / 9 + 3.3, z / 9);
  const rock = lerp(bed, land, smooth(-1.5, w, dc));
  return lerp(beach, rock, cliff);
}

// ------------------------------------------------------------------ rivers

// Each river from its spring in the hills to the lip it falls from: control
// points, the width it starts and ends at, how far (m) and how long (m) its
// bends swing, its own seed, and how much wider its tarn at the spring is.
const RIVER_DEFS = [
  {
    id: "west",
    pts: [[-360, -560], [-290, -420], [-226, -300], [-176, -196], [-142, -118], [-124, -58], [-112, -6], [-104, 34], [-100, 70], [-98, 110]],
    w: [4.5, 8],
    wander: 9,
    bend: 120,
    seed: 1.7,
    tarn: 9,
  },
  {
    id: "east",
    pts: [[360, -520], [286, -380], [236, -260], [204, -150], [190, -60], [186, 10], [184, 70], [184, 120], [186, 160]],
    w: [5, 9.5],
    wander: 10,
    bend: 104,
    seed: 4.2,
    tarn: 10,
  },
];

function catmull(pts, step) {
  const out = [];
  const P = (i) => pts[clamp(i, 0, pts.length - 1)];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

// A river: samples { x, z, s (metres from the spring), w, level }, cut at the
// lip, and the fall from the lip into the sea { x, z, top, bottom, dx, dz }.
function makeRiver(def) {
  const lipOf = (line) => {
    for (let i = 0; i < line.length; i++) if (shoreDist(line[i][0], line[i][1]) < 2.5) return i;
    return line.length - 1;
  };
  const along = (line) => line.reduce((a, p, i) => (a.push(i ? a[i - 1] + Math.hypot(p[0] - line[i - 1][0], p[1] - line[i - 1][1]) : 0), a), []);
  // where the smooth line first reaches the cliff's edge is the lip
  const raw = catmull(def.pts, 3).slice(0, lipOf(catmull(def.pts, 3)) + 1);
  const rawS = along(raw);
  const rawL = rawS[rawS.length - 1];
  // it wanders: bends either side of the smooth line, long and short ones together, none at the lip so the
  // fall stays where the cliff is
  const bent = raw.map((p, i) => {
    const s = rawS[i];
    const a = raw[Math.max(0, i - 1)];
    const b = raw[Math.min(raw.length - 1, i + 1)];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const side = Math.sin((s / def.bend) * 2 * Math.PI + def.seed) * 0.62 + Math.sin((s / (def.bend * 0.41)) * 2 * Math.PI + def.seed * 2.3) * 0.26 + noise2(s / 70, def.seed) * 0.3;
    const k = def.wander * side * smooth(0, 30, s) * smooth(0, 60, rawL - s);
    return [p[0] - ((b[1] - a[1]) / L) * k, p[1] + ((b[0] - a[0]) / L) * k];
  });
  const pts = bent.slice(0, lipOf(bent) + 1);
  const S = along(pts);
  const total = S[S.length - 1];
  let level = Infinity;
  const samples = pts.map((p, i) => {
    const s = S[i];
    const dc = Math.max(0, shoreDist(p[0], p[1]));
    const bank = landH(p[0], p[1], dc);
    // always downhill, a little under its banks
    level = Math.min(level - 0.012 * (i ? s - S[i - 1] : 0), bank - 0.9);
    // wider and narrower by turns, and a little round tarn at the spring
    const w = lerp(def.w[0], def.w[1], s / total) * (1 + 0.2 * noise2(s / 41, def.seed + 7)) + def.tarn * (1 - smooth(0, 16, s));
    return { x: p[0], z: p[1], s, w, level };
  });
  const a = samples[samples.length - 2];
  const b = samples[samples.length - 1];
  const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const fall = { x: b.x, z: b.z, top: b.level, bottom: SEA, dx: (b.x - a.x) / L, dz: (b.z - a.z) / L, w: b.w };
  return { id: def.id, samples, fall, length: total };
}

export const RIVERS = RIVER_DEFS.map(makeRiver);

// The rivers' segments in a grid, so a point finds the few near it.
const RCELL = 24;
const RREACH = 64;
const riverGrid = new Map();
RIVERS.forEach((rv, ri) => {
  for (let i = 0; i < rv.samples.length - 1; i++) {
    const a = rv.samples[i];
    const b = rv.samples[i + 1];
    const x0 = Math.floor((Math.min(a.x, b.x) - RREACH) / RCELL);
    const x1 = Math.floor((Math.max(a.x, b.x) + RREACH) / RCELL);
    const z0 = Math.floor((Math.min(a.z, b.z) - RREACH) / RCELL);
    const z1 = Math.floor((Math.max(a.z, b.z) + RREACH) / RCELL);
    for (let cx = x0; cx <= x1; cx++)
      for (let cz = z0; cz <= z1; cz++) {
        const k = cx * 100003 + cz;
        let list = riverGrid.get(k);
        if (!list) riverGrid.set(k, (list = []));
        list.push([ri, i]);
      }
  }
});

// The nearest river to (x, z) within reach: { d (from its middle), level, w,
// river, i (segment), u (along it), past (beyond the lip) } or null.
export function riverAt(x, z) {
  const list = riverGrid.get(Math.floor(x / RCELL) * 100003 + Math.floor(z / RCELL));
  if (!list) return null;
  let best = null;
  for (const [ri, i] of list) {
    const rv = RIVERS[ri];
    const a = rv.samples[i];
    const b = rv.samples[i + 1];
    const vx = b.x - a.x;
    const vz = b.z - a.z;
    const L2 = vx * vx + vz * vz || 1;
    const uRaw = ((x - a.x) * vx + (z - a.z) * vz) / L2;
    const u = clamp(uRaw, 0, 1);
    const d = Math.hypot(x - a.x - vx * u, z - a.z - vz * u);
    if (!best || d < best.d) {
      const last = i === rv.samples.length - 2;
      best = { d, level: lerp(a.level, b.level, u), w: lerp(a.w, b.w, u), river: rv.id, i, u, past: last && uRaw > 1 };
    }
  }
  return best;
}

// ------------------------------------------------------------------ the town's ground

// The plaza: paved, at the head of the cove, its front to the beach.
export const PLAZA = { x: 0, z: 0, w: 24, d: 24 };
// A plot's levelled pad, each side; builds fit inside it (plots.js scales the few that don't).
export const PAD = 33;
// The least room between two pads, for a lane.
export const GAP = 8;
// The pier from the beach into the cove: from (x, z0) to (x, z1), its deck this high.
export const PIER = { x: 10, z0: 24, z1: 78, w: 3.2, deck: 2.1 };

// The ground with nothing levelled: the shore, the land, the rivers' cuts, the sea stacks.
export function naturalAt(x, z) {
  let h = shoreH(x, z);
  if (shoreDist(x, z) < 0) h = Math.max(h, stackH(x, z));
  const rv = riverAt(x, z);
  if (rv && !rv.past) {
    const half = rv.w / 2;
    if (rv.d < half) {
      h = Math.min(h, rv.level - 0.25 - 1.1 * (1 - (rv.d / half) ** 2));
    } else {
      // banks a little above the water, the valley as wide as the cut is deep
      const cut = Math.max(0, h - rv.level);
      const vw = 3 + cut * 1.7;
      const k = smooth(half, half + vw, rv.d);
      if (k < 1) h = lerp(rv.level + 0.3 * smooth(half, half + 1.2, rv.d), h, k);
    }
  }
  return h;
}

// How far (x, z) is outside a pad's rectangle ({ x, z, hw, hd, ry }, turned as a build's group is).
export function rectOut(p, x, z) {
  const dx = x - p.x;
  const dz = z - p.z;
  const c = Math.cos(p.ry);
  const s = Math.sin(p.ry);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.hypot(Math.max(0, Math.abs(lx) - p.hw), Math.max(0, Math.abs(lz) - p.hd));
}

// A pad's corners in the world.
export function cornersOf(p) {
  const c = Math.cos(p.ry);
  const s = Math.sin(p.ry);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
    const lx = a * p.hw;
    const lz = b * p.hd;
    return [p.x + lx * c + lz * s, p.z - lx * s + lz * c];
  });
}

// The least distance between two pads (0 when they overlap).
function padGap(a, b) {
  const A = cornersOf(a);
  const B = cornersOf(b);
  // overlapping: no axis of either square separates them
  const axes = [a.ry, b.ry].flatMap((r) => [[Math.cos(r), -Math.sin(r)], [Math.sin(r), Math.cos(r)]]);
  const apart = axes.some(([ax, az]) => {
    const pa = A.map(([x, z]) => x * ax + z * az);
    const pb = B.map(([x, z]) => x * ax + z * az);
    return Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa);
  });
  if (!apart) return 0;
  const seg = (p, q, r) => {
    const vx = r[0] - q[0];
    const vz = r[1] - q[1];
    const t = clamp(((p[0] - q[0]) * vx + (p[1] - q[1]) * vz) / (vx * vx + vz * vz), 0, 1);
    return Math.hypot(p[0] - q[0] - vx * t, p[1] - q[1] - vz * t);
  };
  let d = Infinity;
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      d = Math.min(d, seg(A[i], B[j], B[(j + 1) % 4]), seg(B[i], A[j], A[(j + 1) % 4]));
    }
  return d;
}

// The level a pad is cut to: the ground under its middle and corners, averaged.
function padLevel(x, z, half) {
  let s = 0;
  for (const [ox, oz] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]]) s += naturalAt(x + ox * half, z + oz * half);
  return s / 5;
}

export const PLAZA_LEVEL = padLevel(PLAZA.x, PLAZA.z, PLAZA.w / 2);
const PLAZA_PAD = { x: PLAZA.x, z: PLAZA.z, hw: PLAZA.w / 2, hd: PLAZA.d / 2, ry: 0, y: PLAZA_LEVEL, plaza: true };

// ------------------------------------------------------------------ the plots

const MAX_TURN = (116 * Math.PI) / 180;
const MAX_SITES = 64;
let SITES = null;

// Whether a pad at (x, z) would sit well: clear of the shore and the rivers,
// and on the town's side of both (the lanes have no bridges).
// (siteNear: the quick part, its middle only: off the shore and between the rivers)
function siteNear(x, z) {
  return shoreDist(x, z) >= 18 && x > riverX(0, z) && x < riverX(1, z);
}
function siteOk(s) {
  if (!siteNear(s.x, s.z)) return false;
  const c = Math.cos(s.ry);
  const n = Math.sin(s.ry);
  // the pad's middle, corners and edges, turned as it is
  for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1], [0, 1], [1, 0], [0, -1], [-1, 0]]) {
    const px = s.x + a * s.hw * c + b * s.hd * n;
    const pz = s.z - a * s.hw * n + b * s.hd * c;
    if (shoreDist(px, pz) < 18) return false;
    const rv = riverAt(px, pz);
    if (rv && !rv.past && rv.d < rv.w / 2 + 12) return false;
  }
  return true;
}

// Where a river is across from z: the x of its sample nearest z (kept per 2 m of z).
const RIVER_X = [new Map(), new Map()];
function riverX(i, z) {
  const key = Math.round(z / 2);
  let x = RIVER_X[i].get(key);
  if (x === undefined) {
    let best = null;
    for (const s of RIVERS[i].samples) if (!best || Math.abs(s.z - key * 2) < Math.abs(best.z - key * 2)) best = s;
    RIVER_X[i].set(key, (x = best.x));
  }
  return x;
}

// Every plot's pad, in the order the town takes them: packed close round the
// plaza, ring by ring outward (each ring from the middle out, one side then
// the other), each pad its front to the plaza and a lane's width from its
// neighbours. Each is { plot, x, z, y (its level), ry, hw, hd }.
export function sites() {
  if (SITES) return SITES;
  const out = [];
  // closer than a lane's width: sure by the pads' inner circles, never by their outer ones, else measured
  const near = (o, p) => {
    const d = Math.hypot(o.x - p.x, o.z - p.z);
    return d < PAD + GAP || (d < PAD * Math.SQRT2 + GAP && padGap(o, p) < GAP);
  };
  for (let r = 36; r <= 700 && out.length < MAX_SITES; r += 2.5) {
    // along a ring: from straight behind the plaza outward, the sides in turn
    const n = Math.ceil((MAX_TURN * r) / 2.5);
    for (let k = 0; k <= 2 * n && out.length < MAX_SITES; k++) {
      const a = (k % 2 ? 1 : -1) * MAX_TURN * (Math.ceil(k / 2) / n);
      const x = r * Math.sin(a);
      const z = -r * Math.cos(a);
      const s = { plot: out.length, x, z, ry: Math.atan2(-x, -z), hw: PAD / 2, hd: PAD / 2 };
      if (!siteNear(x, z)) continue;
      if (out.some((o) => near(o, s))) continue;
      if (r < 80 && padGap(s, PLAZA_PAD) < GAP + 4) continue;
      if (!siteOk(s)) continue;
      out.push(s);
    }
  }
  for (const s of out) s.y = padLevel(s.x, s.z, PAD / 2);
  SITES = out;
  return out;
}

// The pad for a plot (more builds than pads, never expected, share the last ones).
export function siteOf(plot) {
  const list = sites();
  return plot < list.length ? list[plot] : { ...list[list.length - 1 - (plot % 8)], plot };
}

// ------------------------------------------------------------------ the ground the town stands on

// The ground with the plaza and the pads in `active` levelled, a grassy bank
// round each: { height(x, z), padAt(x, z, margin), pads }. Pads not built on
// are left as the land lies, so the ground only changes round a new plot.
export function groundOf(active = []) {
  const pads = [PLAZA_PAD, ...active.map((p) => ({ x: p.x, z: p.z, hw: p.hw, hd: p.hd, ry: p.ry, y: p.y, plot: p.plot }))];
  const CELL = 40;
  const grid = new Map();
  for (const p of pads) {
    const reach = Math.hypot(p.hw, p.hd) + 26;
    for (let cx = Math.floor((p.x - reach) / CELL); cx <= Math.floor((p.x + reach) / CELL); cx++)
      for (let cz = Math.floor((p.z - reach) / CELL); cz <= Math.floor((p.z + reach) / CELL); cz++) {
        const k = cx * 100003 + cz;
        let list = grid.get(k);
        if (!list) grid.set(k, (list = []));
        list.push(p);
      }
  }
  const near = (x, z) => grid.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL)) || [];
  return {
    pads,
    height(x, z) {
      let h = naturalAt(x, z);
      for (const p of near(x, z)) {
        const d = rectOut(p, x, z);
        const bank = 5 + Math.abs(h - p.y) * 0.9;
        if (d < bank) h = lerp(h, p.y, 1 - smooth(0, bank, d));
      }
      return h;
    },
    padAt(x, z, margin = 0) {
      for (const p of near(x, z)) if (rectOut(p, x, z) <= margin) return p;
      return null;
    },
  };
}

// The ground with every pad levelled (all a town could ever take).
export function heightAt(x, z) {
  return (FULL ??= groundOf(sites())).height(x, z);
}
let FULL = null;

// ------------------------------------------------------------------ the lanes

const GC = 2;
let LANES = null;

// A grid over the town for finding lanes: what each 2 m cell costs to cross.
function laneGrid() {
  const list = sites();
  let x0 = -60;
  let x1 = 60;
  let z0 = -60;
  for (const s of list) {
    x0 = Math.min(x0, s.x - 60);
    x1 = Math.max(x1, s.x + 60);
    z0 = Math.min(z0, s.z - 60);
  }
  const GX0 = Math.floor(x0 / GC) * GC;
  const GZ0 = Math.floor(z0 / GC) * GC;
  const GW = Math.ceil((x1 - GX0) / GC);
  const GH = Math.ceil((60 - GZ0) / GC);
  const n = GW * GH;
  // (each cell's cost found the first time a lane looks at it)
  const cost = new Float32Array(n).fill(NaN);
  const H = new Float32Array(n).fill(NaN);
  const centre = (i, j) => [GX0 + (i + 0.5) * GC, GZ0 + (j + 0.5) * GC];
  const height = (i, j) => {
    const k = clamp(j, 0, GH - 1) * GW + clamp(i, 0, GW - 1);
    if (Number.isNaN(H[k])) H[k] = naturalAt(...centre(clamp(i, 0, GW - 1), clamp(j, 0, GH - 1)));
    return H[k];
  };
  const costAt = (k) => {
    if (!Number.isNaN(cost[k])) return cost[k];
    const i = k % GW;
    const j = (k - i) / GW;
    const [x, z] = centre(i, j);
    let c = 1;
    if (shoreDist(x, z) < 6) c = Infinity;
    const rv = riverAt(x, z);
    if (rv && !rv.past && rv.d < rv.w / 2 + 3) c = Infinity;
    // never across a pad, built on or not: its lane runs round it
    if (c < Infinity)
      for (const s of list) {
        if (Math.abs(x - s.x) > 26 || Math.abs(z - s.z) > 26) continue;
        if (rectOut(s, x, z) < 2) c = Infinity;
      }
    // steep ground costs more
    if (c < Infinity) c += Math.hypot((height(i + 1, j) - height(i - 1, j)) / (2 * GC), (height(i, j + 1) - height(i, j - 1)) / (2 * GC)) * 9;
    return (cost[k] = c);
  };
  return { costAt, used: new Uint8Array(n), GX0, GZ0, GW, GH, centre, pads: list };
}

class Heap {
  constructor() {
    this.k = [];
    this.v = [];
  }
  push(key, val) {
    const { k, v } = this;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop() {
    const { k, v } = this;
    const top = v[0];
    const lk = k.pop();
    const lv = v.pop();
    if (k.length) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= k.length) break;
        if (c + 1 < k.length && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c];
        v[i] = v[c];
        i = c;
      }
      k[i] = lk;
      v[i] = lv;
    }
    return top;
  }
  get size() {
    return this.k.length;
  }
}

const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

// The cheapest way from a door to the plaza's edge, round every pad, along the lanes already found where it can.
function findLane(grid, door, own) {
  const { costAt, used, GX0, GZ0, GW, GH, centre } = grid;
  const atPlaza = (x, z) => Math.abs(x - PLAZA.x) <= PLAZA.w / 2 + 0.5 && Math.abs(z - PLAZA.z) <= PLAZA.d / 2 + 0.5;
  const si = clamp(Math.floor((door[0] - GX0) / GC), 0, GW - 1);
  const sj = clamp(Math.floor((door[1] - GZ0) / GC), 0, GH - 1);
  const start = sj * GW + si;
  const g = new Float32Array(GW * GH).fill(Infinity);
  const from = new Int32Array(GW * GH).fill(-1);
  const closed = new Uint8Array(GW * GH);
  const heap = new Heap();
  const est = (i, j) => {
    const [x, z] = centre(i, j);
    return Math.max(0, Math.hypot(x - PLAZA.x, z - PLAZA.z) - PLAZA.w * 0.71) * 0.35 * GC;
  };
  g[start] = 0;
  heap.push(est(si, sj), start);
  let end = -1;
  while (heap.size) {
    const k = heap.pop();
    if (closed[k]) continue;
    closed[k] = 1;
    const i = k % GW;
    const j = (k - i) / GW;
    const [x, z] = centre(i, j);
    if (atPlaza(x, z)) {
      end = k;
      break;
    }
    for (const [di, dj, len] of STEPS) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
      const nk = nj * GW + ni;
      // (the door's own cell is outside every pad, but its first steps may graze its own pad's bank)
      if (closed[nk]) continue;
      const cn = costAt(nk);
      if (!isFinite(cn) && k !== start) continue;
      const c = (used[nk] ? 0.35 : isFinite(cn) ? cn : 4) * len * GC;
      if (g[k] + c < g[nk]) {
        g[nk] = g[k] + c;
        from[nk] = k;
        heap.push(g[nk] + est(ni, nj), nk);
      }
    }
  }
  if (end < 0) return [door, [PLAZA.x, PLAZA.z + PLAZA.d / 2]];
  const cells = [];
  for (let k = end; k >= 0; k = from[k]) cells.push(k);
  cells.reverse();
  for (const k of cells) used[k] = 1;
  const pts = cells.map((k) => centre(k % GW, Math.floor(k / GW)));
  pts[0] = door.slice();
  // rounding a corner can cut across a pad's corner: then the lane keeps its corners
  const simple = simplify(pts, 0.9);
  return [rounded(simple), simple].find((p) => clearOf(p, grid.pads, own)) ?? pts;
}

// Whether a lane keeps off every pad but its own.
function clearOf(pts, pads, own) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5));
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n;
      const z = az + ((bz - az) * k) / n;
      for (const s of pads) if (s !== own && Math.abs(x - s.x) < 26 && Math.abs(z - s.z) < 26 && rectOut(s, x, z) < 0.8) return false;
    }
  }
  return true;
}

// Fewer points, none more than tol from the line it was.
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, az] = pts[a];
    const [bx, bz] = pts[b];
    const L = Math.hypot(bx - ax, bz - az) || 1;
    let best = -1;
    let bd = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (az - pts[i][1]) - (ax - pts[i][0]) * (bz - az)) / L;
      if (d > bd) {
        bd = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

// Corners rounded off (twice over), the ends where they were.
function rounded(pts) {
  let p = pts;
  for (let it = 0; it < 2 && p.length >= 3; it++) {
    const out = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = p[i];
      const [bx, bz] = p[i + 1];
      if (i > 0) out.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25]);
      if (i < p.length - 2) out.push([ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    out.push(p[p.length - 1]);
    p = out;
  }
  return p;
}

// Where a plot's lane leaves its pad: a step out from the middle of its front.
export function doorOf(site, out = 1) {
  const f = site.hd + out;
  return [site.x + Math.sin(site.ry) * f, site.z + Math.cos(site.ry) * f];
}

// The lane from a plot's door to the plaza's edge, [[x, z], ...]. Lanes are
// found in plot order, each joining those before it where it can, once.
export function routeOf(plot) {
  const list = sites();
  if (plot >= list.length) return routeOf(siteOf(plot).plot);
  LANES ??= { grid: laneGrid(), list: [] };
  while (LANES.list.length <= plot) LANES.list.push(findLane(LANES.grid, doorOf(list[LANES.list.length]), list[LANES.list.length]));
  return LANES.list[plot];
}

// Every lane there will ever be.
export function allRoutes() {
  return sites().map((s) => routeOf(s.plot));
}

// ------------------------------------------------------------------ the woods

// How thick the woods stand at (x, z), 0 open to 1 deep: clumps over the
// hills, thicker on the mountains' lower slopes, pines along the headlands,
// thinning near the town (its meadows stay open) and never on the beach, in
// a river or above the tree line. Trees and the forest floor both read it.
// (h, the ground's height there, and rv, riverAt's answer there, when known already)
export function forestAt(x, z, h = null, rv = undefined) {
  const dc = shoreDist(x, z);
  if (dc < 9) return 0;
  const r = Math.hypot(x, z);
  const n = fbm2(x / 120 + 11.3, z / 120 - 6.1, 3);
  let f = smooth(-0.04, 0.3, n + 0.12 * smooth(380, 640, dc));
  // the headlands' pines, close to the edge
  const head = smooth(70, 120, Math.abs(x)) * (1 - smooth(40, 110, dc));
  f = Math.max(f, head * smooth(-0.2, 0.25, fbm2(x / 40 - 3.7, z / 40 + 2.2, 2)));
  f *= smooth(12, 30, dc) * smooth(120, 210, r);
  if (f <= 0) return 0;
  if (rv === undefined) rv = riverAt(x, z);
  if (rv && !rv.past) f *= smooth(rv.w / 2 + 2, rv.w / 2 + 9, rv.d);
  f *= 1 - smooth(92, 128, h ?? naturalAt(x, z));
  return clamp(f, 0, 1);
}
