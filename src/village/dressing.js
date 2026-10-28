// The coast's growing things and stones, laid over the land of ./terrain.js:
// woods of spruce and pine (Berk's), broadleaf trees and birches by the town
// and the rivers, little clusters of trees in the meadows, bushes at the
// woods' edges and along the lanes, grass tufts and wildflowers in the
// meadows round the town, boulders on the cliff tops, heaped in the surf at
// the cliffs' feet, on the river banks and up the mountainsides, and on the
// two headlands a patchwork of fields walled with dry stone or fenced with
// rails, wheat standing at their edges, a hay stack or two in them.
//
// The town's own pads (coast.js sites()) are kept clear only as far as the
// town will soon reach: the next FRONTIER_GAP pads past the highest one
// levelled. The pads beyond that frontier are the countryside until the town
// comes: hedged meadows, groves, orchards, copses of birch, hay meadows, or
// the woods where the woods are. Each update() clears the pads the frontier
// has reached, so a build never finds a tree in its way.
//
//   makeDressing(stage, ground, { lanes, detail })
//     -> { group, update(ground, { lanes }, rects), dispose(), stats, ready }
//   ground: coast.js groundOf(active pads); lanes: [[[x, z], ...], ...] (routeOf of each built plot),
//     or lane objects with their points ({ points: [[x, z], ...] }).
//   detail (optional, 0.25 to 1, default 1): less of the small things (tufts, flowers, bushes, the far
//     hills' trees and stones) for a weaker device; the trees and stones near the town stay as they are.
//   The chunks round the town grow at once (the first picture); the rest grow in short slices after
//   it, between the page's other work, and show when the last has grown. ready: a promise of that.
//   update() works out again only the chunks a rect ({ x0, z0, x1, z1 }), a new lane or a pad the
//   frontier reached touches.
//   stats: { ms (to the first picture), msAll, msWork, chunks, counts: { kind: instances }, triangles,
//            trianglesBy, drawCalls, shadowCalls, frontier, updateMs, updated }
//   Nothing grows where harbour.js harbourCovers() says the harbour stands.
//
//   farmland() -> { fields, walls, hay }: the walled fields on the two headlands (worked out once), so
//   life.js can graze its herds and flocks inside them: fields [{ poly: [[x, z] x4], kind, ... }].
//
// The land is cut into chunks CHUNK metres square aligned with terrain.js
// CORE (and past CORE, out to the far hills, chunks FAR_CHUNK square that
// only grow trees and stones). Each chunk grows from a seed of its own, so it
// always grows the same. Each kind of thing is an InstancedMesh, its
// instances gathered from every chunk; the heavier kinds are split by region
// (the two headlands and the valley, north and south, and the far hills), so
// what is out of sight, or outside the sun's shadow, is not drawn. All of it
// stands in the still layer. The tufts and flowers shrink away far from the
// eye, and a region of them is drawn thinner the farther it is (an even share
// of them), so the whole town in view costs little more than a close look.
// Every instance stands on the ground as it is drawn (the terrain's own
// triangles), so nothing floats. The light is the land's: the kit's sun (soft
// and wrapped round the leaves), its shadows, the sky and ground fill with the
// shade lifted toward the sky's blue, and the same haze.

import * as THREE from "three";
import { CORE, PALETTE, groundLook } from "./terrain.js";
import { noiseTexture } from "./glade.js";
import { harbourCovers } from "./harbour.js";
import { PIER, RIVERS, STACKS, WORLD_R, cliffTop, coastZ, fbm2, forestAt, naturalAt, noise2, rectOut, riverAt, shoreDist, sites, smooth } from "./coast.js";

export const CHUNK = 64;
export const FAR_CHUNK = 128;
// how far the far chunks reach from the plaza
const FAR_R = 1450;
// tufts and flowers grow within this of the plaza
const MEADOW_R = 360;
// the chunks within this of the plaza grow before the first picture
const FIRST_R = 340;
// how many pads past the highest one levelled are kept clear for the town to come
const FRONTIER_GAP = 6;
// the ground's grid: the tiles' (terrain.js STEP) in CORE, the far grid's outside
const STEP = 2;
const FAR_STEP = 16;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const lin = (hex) => {
  const c = new THREE.Color(hex).convertSRGBToLinear();
  return [c.r, c.g, c.b];
};
const lins = (list) => list.map(lin);

// ------------------------------------------------------------------ seeds

// A number from three integers, well mixed.
function hash3(a, b, c) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

// A stream of numbers in [0, 1) from a seed (xorshift).
function rngOf(seed) {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

// ------------------------------------------------------------------ colours (linear)

const TONE = {
  spruce: lins(["#2e5440", "#36593e", "#2c4f45", "#3d5f3b", "#335648", "#44653c"]),
  spruceWarm: lins(["#4c6640", "#506a42", "#486240"]),
  pine: lins(["#466a3a", "#4f723c", "#41633a", "#56763f"]),
  broad: lins(["#64903d", "#729a45", "#5a873b", "#80a449", "#6a9246", "#87a142"]),
  orchard: lins(["#6f9a45", "#7aa24a", "#679343", "#83a64c"]),
  autumn: lins(["#c98d3e", "#b9773a", "#cfa548", "#b0603a", "#c49a45"]),
  birch: lins(["#88a64e", "#93ab55", "#7f9f4c", "#9aae5a"]),
  birchGold: lins(["#d8b443", "#cfa338"]),
  bush: lins(["#557f3a", "#618a3e", "#4b7442", "#6c9044", "#527845", "#76923f"]),
  hedge: lins(["#4f7a3a", "#5a823c", "#4a7140", "#62893f"]),
  rock: lins([PALETTE.rockA, PALETTE.rockB, "#9d978b", "#a8a193", "#8a857c"]),
  wall: lins(["#aca493", "#a39b8b", "#b3aa98", "#9d9586"]),
  wood: lins(["#7a6a58", "#6f604f", "#857461"]),
  hay: lins(["#cfae5c", "#c7a453", "#d6b766"]),
  wheat: lins(["#d9b45a", "#d2a94f", "#e0bd66", "#c9a04a"]),
  flower: {
    white: lin("#f5f2e6"),
    cream: lin("#f1e7c4"),
    yellow: lin("#f4cd38"),
    purple: lin("#9b6fd0"),
    red: lin("#d8442f"),
    pink: lin("#ea9cbc"),
    blue: lin("#7c9de6"),
  },
};
const BARK = {
  spruce: lin("#4f3e31"),
  pineLow: lin("#5a4838"),
  pineHigh: lin("#a9643c"),
  broad: lin("#5f5143"),
  birch: lin("#d8d2c4"),
  birchBase: lin("#6d6860"),
};
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

// A tint jittered a little in brightness and warmth (warm: how much of the warmth's share).
function jitter(c, r, k = 1, warm = 1) {
  const l = 1 + (r() - 0.5) * 0.22 * k;
  const w = (r() - 0.5) * 0.12 * k * warm;
  return [c[0] * l * (1 + w), c[1] * l, c[2] * l * (1 - w)];
}

// ------------------------------------------------------------------ geometry

// A mesh under construction: position, normal, colour (a multiplier on the
// instance's tint, or a true colour where aPart is 0), aAO (how much sky a
// point sees), aPart (what it is: 0 bark or wood, 1 leaves, else per kind).
class Geo {
  constructor() {
    this.p = [];
    this.n = [];
    this.c = [];
    this.a = [];
    this.k = [];
    this.i = [];
    this.uv = [];
  }
  get count() {
    return this.p.length / 3;
  }
  v(x, y, z, nx, ny, nz, col, ao, part) {
    const L = Math.hypot(nx, ny, nz) || 1;
    this.p.push(x, y, z);
    this.n.push(nx / L, ny / L, nz / L);
    this.c.push(col[0], col[1], col[2]);
    this.a.push(ao);
    this.k.push(part);
    return this.count - 1;
  }
  t(a, b, c) {
    this.i.push(a, b, c);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute("aAO", new THREE.Float32BufferAttribute(this.a, 1));
    g.setAttribute("aPart", new THREE.Float32BufferAttribute(this.k, 1));
    if (this.uv.length) g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}

// A low sphere of segs round and rings down: unit directions and faces wound outward.
function uvSphere(segs, rings) {
  const verts = [[0, 1, 0]];
  for (let k = 1; k < rings; k++) {
    const t = (k / rings) * Math.PI;
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2 + (k % 2) * (Math.PI / segs);
      verts.push([Math.sin(t) * Math.cos(a), Math.cos(t), Math.sin(t) * Math.sin(a)]);
    }
  }
  verts.push([0, -1, 0]);
  const faces = [];
  const ring = (k, s) => 1 + (k - 1) * segs + (((s % segs) + segs) % segs);
  for (let s = 0; s < segs; s++) faces.push([0, ring(1, s + 1), ring(1, s)]);
  for (let k = 1; k < rings - 1; k++)
    for (let s = 0; s < segs; s++) {
      // the rings are staggered by half a step, so each band is a strip of triangles
      const odd = k % 2 === 1;
      const a = ring(k, s);
      const b = ring(k, s + 1);
      const c = ring(k + 1, odd ? s : s - 1);
      const d = ring(k + 1, odd ? s + 1 : s);
      faces.push([a, b, d], [a, d, c]);
    }
  const last = verts.length - 1;
  for (let s = 0; s < segs; s++) faces.push([last, ring(rings - 1, s), ring(rings - 1, s + 1)]);
  // each face turned to look outward
  return {
    verts,
    faces: faces.map(([a, b, c]) => {
      const A = verts[a];
      const B = verts[b];
      const C = verts[c];
      const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
      const v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      return n[0] * (A[0] + B[0] + C[0]) + n[1] * (A[1] + B[1] + C[1]) + n[2] * (A[2] + B[2] + C[2]) < 0 ? [a, c, b] : [a, b, c];
    }),
  };
}
// the shapes a blob or a puff can start from
const SHAPES = {
  tiny: uvSphere(4, 3),
  small: uvSphere(5, 3),
  pad: uvSphere(6, 3),
  bush: uvSphere(6, 4),
  low: uvSphere(7, 4),
  rock: uvSphere(6, 5),
  mid: uvSphere(8, 5),
};

// Smooth normals of an indexed mesh (area weighted).
function smoothNormals(pos, faces, count) {
  const n = new Float32Array(count * 3);
  for (const [a, b, c] of faces) {
    const ux = pos[b * 3] - pos[a * 3];
    const uy = pos[b * 3 + 1] - pos[a * 3 + 1];
    const uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3];
    const vy = pos[c * 3 + 1] - pos[a * 3 + 1];
    const vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) {
      n[k * 3] += nx;
      n[k * 3 + 1] += ny;
      n[k * 3 + 2] += nz;
    }
  }
  for (let k = 0; k < count; k++) {
    const L = Math.hypot(n[k * 3], n[k * 3 + 1], n[k * 3 + 2]) || 1;
    n[k * 3] /= L;
    n[k * 3 + 1] /= L;
    n[k * 3 + 2] /= L;
  }
  return n;
}

// A soft lumpy blob (a boulder) into geo: a low sphere pushed out into
// lumps, its light the lumps' own blended with the whole blob's, its
// underside and the hollows between lumps darker.
//   o: { c: [x, y, z], r: [rx, ry, rz], shape (a SHAPES name), lumps, lumpK, seed, flat (cut the bottom at this fraction of ry),
//        part, mix (how much of the blob's own roundness the light follows), top/bottom colours, aoLow, rough }
function blob(geo, o) {
  const r = rngOf(o.seed);
  const { verts, faces } = SHAPES[o.shape ?? "low"];
  const lumps = [];
  for (let k = 0; k < (o.lumps ?? 6); k++) {
    const u = r() * 2 - 1;
    const a = r() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    lumps.push([Math.cos(a) * s, u * 0.8 + 0.15, Math.sin(a) * s, 0.5 + r() * 0.6]);
  }
  const base = geo.count;
  const pos = [];
  const rad = [];
  for (const [dx, dy, dz] of verts) {
    let k = 1;
    for (const [lx, ly, lz, w] of lumps) {
      const d2 = (dx - lx) ** 2 + (dy - ly) ** 2 + (dz - lz) ** 2;
      k += (o.lumpK ?? 0.22) * w * Math.exp(-d2 * 4.5);
    }
    k += (o.rough ?? 0.05) * noise2(dx * 3.1 + dz * 1.7 + o.seed * 0.01, dy * 3.3 - dz * 0.7);
    let x = dx * k * o.r[0];
    let y = dy * k * o.r[1];
    let z = dz * k * o.r[2];
    if (o.flat !== undefined && y < -o.flat * o.r[1]) y = -o.flat * o.r[1] + (y + o.flat * o.r[1]) * 0.15;
    pos.push(x, y, z);
    rad.push(k);
  }
  const own = smoothNormals(pos, faces, verts.length);
  const mixK = o.mix ?? 0.5;
  verts.forEach(([dx, dy, dz], i) => {
    // the whole blob's normal (its ellipsoid's), blended with the clumps'
    const ex = dx / o.r[0];
    const ey = dy / o.r[1];
    const ez = dz / o.r[2];
    const eL = Math.hypot(ex, ey, ez);
    const nx = lerp(own[i * 3], ex / eL, mixK);
    const ny = lerp(own[i * 3 + 1], ey / eL, mixK);
    const nz = lerp(own[i * 3 + 2], ez / eL, mixK);
    const up = smooth(-0.9, 0.85, dy);
    const hollow = smooth(0.92, 1.12, rad[i]);
    const ao = lerp(o.aoLow ?? 0.5, 1, up) * lerp(0.82, 1, hollow);
    const ct = o.top ?? [1.08, 1.06, 0.94];
    const cb = o.bottom ?? [0.86, 0.92, 1.0];
    const col = [lerp(cb[0], ct[0], up), lerp(cb[1], ct[1], up), lerp(cb[2], ct[2], up)];
    geo.v(o.c[0] + pos[i * 3], o.c[1] + pos[i * 3 + 1], o.c[2] + pos[i * 3 + 2], nx, ny, nz, col, ao, o.part ?? 1);
  });
  for (const [a, b, c] of faces) geo.t(base + a, base + b, base + c);
}

// A crown of leafy puffs into geo, Tiny Glade's way: each puff a small lumpy
// ball with its own light and shade, its light bent a little toward the whole
// crown's roundness, the hollows between puffs and the crown's underside dark,
// its top lighter and warmer. puffs: [[x, y, z, r], ...]; o: { shape, seed, squash, aoLow, flat }
function crown(geo, puffs, o) {
  const r = rngOf(o.seed);
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let lo = Infinity;
  let hi = -Infinity;
  for (const [x, y, z, rr] of puffs) {
    cx += x / puffs.length;
    cy += y / puffs.length;
    cz += z / puffs.length;
    lo = Math.min(lo, y - rr);
    hi = Math.max(hi, y + rr);
  }
  const squash = o.squash ?? 0.85;
  // (a puff may name its own shape, fifth: a small one needs fewer faces)
  for (const [px, py, pz, pr, shp] of puffs) {
    const { verts, faces } = SHAPES[shp ?? o.shape ?? "low"];
    const lumps = [];
    for (let k = 0; k < 4; k++) {
      const u = r() * 2 - 1;
      const a = r() * Math.PI * 2;
      const sq = Math.sqrt(1 - u * u);
      lumps.push([Math.cos(a) * sq, u, Math.sin(a) * sq, 0.5 + r() * 0.5]);
    }
    const tone = 0.94 + r() * 0.12;
    const base = geo.count;
    const pos = [];
    for (const [dx, dy, dz] of verts) {
      let k = 1;
      for (const [lx, ly, lz, w] of lumps) k += 0.16 * w * Math.exp(-((dx - lx) ** 2 + (dy - ly) ** 2 + (dz - lz) ** 2) * 5);
      let y = dy * k * pr * squash;
      if (o.flat !== undefined && y < -o.flat * pr) y = -o.flat * pr + (y + o.flat * pr) * 0.2;
      pos.push(px + dx * k * pr, py + y, pz + dz * k * pr);
    }
    const own = smoothNormals(pos, faces, verts.length);
    verts.forEach((d, i) => {
      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      const z = pos[i * 3 + 2];
      // the crown's own roundness at this point
      let ex = x - cx;
      let ey = (y - cy) * 1.3;
      let ez = z - cz;
      const eL = Math.hypot(ex, ey, ez) || 1;
      ex /= eL;
      ey /= eL;
      ez /= eL;
      const nx = lerp(own[i * 3], ex, 0.35);
      const ny = lerp(own[i * 3 + 1], ey, 0.35);
      const nz = lerp(own[i * 3 + 2], ez, 0.35);
      // facing into the crown (between puffs) is dark; so is low down
      const out = own[i * 3] * ex + own[i * 3 + 1] * ey + own[i * 3 + 2] * ez;
      const up = clamp((y - lo) / (hi - lo), 0, 1);
      const ao = lerp(o.aoLow ?? 0.38, 1, smooth(0.0, 0.85, up)) * lerp(0.55, 1, smooth(-0.3, 0.6, out));
      const t = smooth(0.15, 1, up);
      const col = [tone * lerp(0.72, 1.14, t), tone * lerp(0.8, 1.1, t), tone * lerp(0.95, 0.88, t)];
      geo.v(x, y, z, nx, ny, nz, col, ao, 1);
    });
    for (const [a, b, c] of faces) geo.t(base + a, base + b, base + c);
  }
}

// A pole of `sides` through rings [{ x, y, z, r, c, ao }] (bottom to top): a trunk or a branch. part: its aPart.
function pole(geo, sides, rings, part = 0) {
  const base = geo.count;
  for (const g of rings)
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      geo.v(g.x + Math.cos(a) * g.r, g.y, g.z + Math.sin(a) * g.r, Math.cos(a), 0.15, Math.sin(a), g.c, g.ao, part);
    }
  for (let k = 0; k < rings.length - 1; k++)
    for (let s = 0; s < sides; s++) {
      const a = base + k * sides + s;
      const b = base + k * sides + ((s + 1) % sides);
      geo.t(a, a + sides, b);
      geo.t(b, a + sides, b + sides);
    }
}

// A short branch of three sides from a point on the trunk out to (x1, y1, z1).
function branch(geo, [x0, y0, z0], [x1, y1, z1], r, c, part = 0) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;
  const L = Math.hypot(dx, dy, dz) || 1;
  // two directions square to the branch
  let ax = -dz;
  let az = dx;
  const aL = Math.hypot(ax, az) || 1;
  ax /= aL;
  az /= aL;
  const bx = (dy * az) / L;
  const by = (dz * ax - dx * az) / L;
  const bz = (-dy * ax) / L;
  const base = geo.count;
  for (let ring = 0; ring < 2; ring++) {
    const [px, py, pz] = ring ? [x1, y1, z1] : [x0, y0, z0];
    const rr = ring ? r * 0.45 : r;
    for (let s = 0; s < 3; s++) {
      const a = (s / 3) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const nx = ax * ca + bx * sa;
      const ny = by * sa;
      const nz = az * ca + bz * sa;
      geo.v(px + nx * rr, py + ny * rr, pz + nz * rr, nx, ny + 0.2, nz, c, ring ? 0.8 : 0.6, part);
    }
  }
  for (let s = 0; s < 3; s++) {
    const a = base + s;
    const b = base + ((s + 1) % 3);
    // (its ring turns the other way round its length from a pole's, so its faces are wound the other way)
    geo.t(a, b, a + 3);
    geo.t(b, b + 3, a + 3);
  }
}

// A tapering trunk of `sides` from (0, y0, 0) to (x1, h, z1), its colour from c0 at the foot to c1 at the top.
function trunk(geo, { sides = 5, r0, r1, h, x1 = 0, z1 = 0, c0, c1, y0 = -0.4, aoFoot = 0.45 }) {
  pole(geo, sides, [
    { x: 0, y: y0, z: 0, r: r0, c: c0, ao: aoFoot },
    { x: x1, y: h, z: z1, r: r1, c: c1, ao: 0.85 },
  ]);
}

// A Norway spruce a metre tall (the instance scales it): tiers of drooping
// boughs, each a skirt from the trunk out to a ragged rim of tips, narrowing
// to a spike; its light follows a rounded tier, not the flat skirt. lod 0 is
// the near one; 1 is for farther off (fewer tiers and sides); 2 for the far hills.
function spruceGeo(lod) {
  const geo = new Geo();
  const r = rngOf(lod ? 404 : 303);
  const tiers = [6, 4, 3][lod];
  const R0 = 0.3;
  if (!lod) trunk(geo, { sides: 5, r0: 0.03, r1: 0.016, h: 0.24, c0: BARK.spruce, c1: BARK.spruce, y0: -0.05 });
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1);
    const yr = 0.09 + f * 0.7 + (r() - 0.5) * 0.02;
    const ya = t === tiers - 1 ? 1.0 : yr + 0.22 - f * 0.04;
    const R = R0 * (1 - (yr - 0.06) / 0.96) * (1 + (r() - 0.5) * 0.08) + 0.012;
    // the tips round a tier: fewer up the tree and on the farther ones (the middle one keeps six low down, so it never reads as a paper arrow)
    const k = lod === 2 ? 4 : lod === 1 ? (t < 2 ? 6 : 5) : t < 2 ? 7 : t < 5 ? 6 : 5;
    const rot = r() * Math.PI * 2;
    const shade = lerp(0.66, 1.0, f);
    const base = geo.count;
    // the apex, inside the tier above (dark) unless it is the top
    const top = t === tiers - 1;
    geo.v(0, ya, 0, 0, 1, 0, top ? [1.06, 1.05, 0.94] : [0.8, 0.86, 0.98], top ? 1 : 0.4 * shade, 1);
    const rim = [];
    for (let s = 0; s < k * 2; s++) {
      const tip = s % 2 === 0;
      const a = rot + (s / (k * 2)) * Math.PI * 2 + (r() - 0.5) * 0.25;
      const rr = R * (tip ? 1 + (r() - 0.5) * 0.2 : 0.76);
      const y = yr + (tip ? -0.03 - r() * 0.02 : 0.025);
      const col = tip ? [1.18, 1.14, 0.88] : [0.8, 0.88, 1.0];
      // a tip's light is a drooping bough's (out and a little up); a notch's is the tier's top (mostly up)
      const out = tip ? 0.95 : 0.5;
      rim.push(geo.v(Math.cos(a) * rr, y, Math.sin(a) * rr, Math.cos(a) * out, tip ? 0.38 : 0.9, Math.sin(a) * out, col, (tip ? 1 : 0.55) * shade, 1));
    }
    for (let s = 0; s < k * 2; s++) geo.t(base, rim[(s + 1) % (k * 2)], rim[s]);
  }
  return geo.build();
}

// A Scots pine a metre tall: a long trunk, grey-brown below and the orange of its bark only in its top
// part, a crown of small flattish clumps stepped down the top third, two short limbs reaching into them.
function pineGeo() {
  const geo = new Geo();
  const mid = lerp(BARK.pineLow[0], BARK.pineHigh[0], 0.25);
  pole(geo, 5, [
    { x: 0, y: -0.05, z: 0, r: 0.027, c: BARK.pineLow, ao: 0.45 },
    { x: 0.012, y: 0.5, z: -0.004, r: 0.02, c: [mid, lerp(BARK.pineLow[1], BARK.pineHigh[1], 0.25), lerp(BARK.pineLow[2], BARK.pineHigh[2], 0.25)], ao: 0.8 },
    { x: 0.03, y: 0.9, z: -0.01, r: 0.011, c: BARK.pineHigh, ao: 0.9 },
  ]);
  const clumps = [
    [0.03, 0.93, -0.01, 0.13],
    [-0.11, 0.86, 0.06, 0.11],
    [0.14, 0.84, -0.05, 0.115],
    [0.02, 0.8, 0.13, 0.1],
    [-0.08, 0.74, -0.1, 0.1],
    [0.12, 0.7, 0.08, 0.085],
  ];
  branch(geo, [0.02, 0.72, 0], [-0.07, 0.75, -0.09], 0.01, BARK.pineHigh);
  branch(geo, [0.025, 0.78, 0], [0.13, 0.83, -0.05], 0.01, BARK.pineHigh);
  crown(geo, clumps, { shape: "small", seed: 71, squash: 0.6, flat: 0.45, aoLow: 0.42 });
  return geo.build();
}

// A round broadleaf tree a metre tall: a short trunk and one soft crown of clumps.
function broadGeo() {
  const geo = new Geo();
  trunk(geo, { sides: 5, r0: 0.05, r1: 0.03, h: 0.52, c0: BARK.broad, c1: BARK.broad, y0: -0.05 });
  const puffs = [
    [0.0, 0.74, 0.0, 0.25],
    [-0.2, 0.6, 0.08, 0.2],
    [0.19, 0.62, -0.06, 0.21],
    [0.04, 0.58, 0.21, 0.19, "pad"],
    [-0.02, 0.6, -0.2, 0.19, "pad"],
    [0.1, 0.86, 0.08, 0.15, "pad"],
  ];
  crown(geo, puffs, { shape: "bush", seed: 5, flat: 0.55, aoLow: 0.35 });
  return geo.build();
}

// A birch a metre tall: a slim trunk, dark grey at its foot and pale above (its dark marks are painted by
// the shader: aPart 0.25), two thin limbs, and a light, narrow crown.
function birchGeo() {
  const geo = new Geo();
  pole(geo, 5, [
    { x: 0, y: -0.05, z: 0, r: 0.024, c: BARK.birchBase, ao: 0.6 },
    { x: 0.005, y: 0.12, z: 0, r: 0.019, c: BARK.birch, ao: 0.8 },
    { x: 0.02, y: 0.86, z: 0, r: 0.011, c: BARK.birch, ao: 0.9 },
  ], 0.25);
  branch(geo, [0.012, 0.5, 0], [-0.07, 0.6, 0.05], 0.008, BARK.birch, 0.25);
  branch(geo, [0.015, 0.58, 0], [0.09, 0.66, -0.04], 0.007, BARK.birch, 0.25);
  const puffs = [[0.0, 0.76, 0.0, 0.17], [-0.09, 0.6, 0.06, 0.14], [0.1, 0.62, -0.05, 0.13], [0.03, 0.9, -0.03, 0.1]];
  crown(geo, puffs, { shape: "pad", seed: 31, squash: 1.05, aoLow: 0.45 });
  return geo.build();
}

// A bush a metre across: a low soft mound of clumps (52 triangles: the middle one rounder, the two beside it plainer).
function bushGeo() {
  const geo = new Geo();
  const clumps = [[0.0, 0.36, 0.0, 0.34, "small"], [-0.26, 0.24, 0.1, 0.27], [0.24, 0.22, -0.1, 0.27]];
  crown(geo, clumps, { shape: "tiny", seed: 11, squash: 0.85, flat: 0.6, aoLow: 0.4 });
  return geo.build();
}

// A boulder a metre across, its foot under the ground: rounded (kind 0) or a blocky chunk (kind 1).
function rockGeo(kind) {
  const geo = new Geo();
  if (kind === 0) {
    blob(geo, {
      c: [0, 0.18, 0],
      r: [0.55, 0.42, 0.5],
      shape: "low",
      lumps: 6,
      lumpK: 0.22,
      rough: 0.13,
      seed: 201,
      flat: 0.6,
      mix: 0.2,
      aoLow: 0.45,
      top: [1.1, 1.09, 1.04],
      bottom: [0.78, 0.78, 0.84],
      part: 2,
    });
  } else {
    // a block: the sphere pushed toward a rounded cube, its top a little tilted
    const { verts, faces } = SHAPES.rock;
    const base = geo.count;
    const pos = [];
    for (const [dx, dy, dz] of verts) {
      const m = Math.max(Math.abs(dx), Math.abs(dy) * 1.15, Math.abs(dz));
      const k = lerp(1, 1 / m, 0.62) * (1 + 0.07 * noise2(dx * 4 + 9, dz * 4 + dy * 3));
      pos.push(dx * k * 0.55, dy * k * 0.4 + 0.12 + dx * 0.06, dz * k * 0.45);
    }
    const own = smoothNormals(pos, faces, verts.length);
    verts.forEach(([, dy], i) => {
      const up = smooth(-0.9, 0.8, dy);
      const col = [lerp(0.86, 1.04, up), lerp(0.86, 1.04, up), lerp(0.9, 1.02, up)];
      geo.v(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], own[i * 3], own[i * 3 + 1], own[i * 3 + 2], col, lerp(0.55, 1, up), 2);
    });
    for (const [a, b, c] of faces) geo.t(base + a, base + b, base + c);
  }
  return geo.build();
}

// A tuft of meadow grass about a metre across: three cards of painted blades (grassTexture()) round a
// small root, each leaning outward like a fountain, so it is a rosette seen from above and a bush from
// the side. aPart is how far up a card a point is.
function tuftGeo() {
  const geo = new Geo();
  const r = rngOf(808);
  const n = 3;
  for (let c = 0; c < n; c++) {
    const a = (c / n) * Math.PI * 2 + (r() - 0.5) * 0.4;
    // the card's own across (tx, tz) and out (ox, oz)
    const ox = Math.cos(a);
    const oz = Math.sin(a);
    const tx = -oz;
    const tz = ox;
    const w = 0.42 + r() * 0.08;
    const h = 0.56 + r() * 0.18;
    const r0 = 0.05;
    const lean = 0.22 + r() * 0.1;
    const base = geo.count;
    // the light of the cards is the ground's (straight up), so a tuft sits in the meadow's own light
    geo.v(ox * r0 - tx * w, -0.04, oz * r0 - tz * w, 0, 1, 0, [1, 1, 1], 1, 0);
    geo.v(ox * r0 + tx * w, -0.04, oz * r0 + tz * w, 0, 1, 0, [1, 1, 1], 1, 0);
    geo.v(ox * (r0 + lean) + tx * w * 1.25, h, oz * (r0 + lean) + tz * w * 1.25, 0, 1, 0, [1, 1, 1], 1, 1);
    geo.v(ox * (r0 + lean) - tx * w * 1.25, h, oz * (r0 + lean) - tz * w * 1.25, 0, 1, 0, [1, 1, 1], 1, 1);
    geo.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    geo.t(base, base + 1, base + 2);
    geo.t(base, base + 2, base + 3);
  }
  return geo.build();
}

// Painted grass blades for the tufts' cards: grey from dark roots to light tips (the tint is the ground's), alpha the blades.
let GRASS_TEX = null;
function grassTexture() {
  if (GRASS_TEX) return GRASS_TEX;
  const N = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = N;
  const g = cv.getContext("2d");
  const r = rngOf(4242);
  const blades = [];
  for (let i = 0; i < 64; i++) {
    // thicker toward the card's middle, so its edges never show
    const u = (r() + r() + r()) / 3;
    blades.push({
      x: N * (0.06 + u * 0.88),
      h: N * (0.34 + r() * 0.6) * (1 - Math.abs(u - 0.5) * 0.8),
      lean: (r() - 0.5) * N * 0.3 + (u - 0.5) * N * 0.34,
      w: 5 + r() * 6,
      v: 0.8 + r() * 0.2,
    });
  }
  // the short dark ones behind, the tall bright ones in front
  blades.sort((a, b) => a.h * a.v - b.h * b.v);
  for (const b of blades) {
    const grd = g.createLinearGradient(0, N, 0, N - b.h);
    const lo = Math.round(255 * 0.55 * b.v);
    const hi = Math.round(255 * b.v);
    grd.addColorStop(0, `rgb(${lo},${lo},${lo})`);
    grd.addColorStop(1, `rgb(${hi},${hi},${hi})`);
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(b.x - b.w, N);
    g.quadraticCurveTo(b.x + b.lean * 0.25 - b.w * 0.3, N - b.h * 0.55, b.x + b.lean, N - b.h);
    g.quadraticCurveTo(b.x + b.lean * 0.25 + b.w * 0.6, N - b.h * 0.5, b.x + b.w, N);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  GRASS_TEX = t;
  return t;
}

// A patch of wildflowers a metre and a bit across: blossoms held up among the grass on thin stems, each a
// small four-petalled cross facing the sky. aPart: 1 a petal's tip, 0.5 its heart, 0.1 the stem.
function flowerGeo() {
  const geo = new Geo();
  const r = rngOf(91);
  const n = 7;
  for (let b = 0; b < n; b++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 0.6;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const y = 0.34 + r() * 0.3;
    const s = 0.075 + r() * 0.04;
    const tx = (r() - 0.5) * 0.5;
    const tz = (r() - 0.5) * 0.5;
    // the stem: one thin blade from the ground to the blossom, leaning a little
    const sa = r() * Math.PI;
    const sx = Math.cos(sa) * 0.012;
    const sz = Math.sin(sa) * 0.012;
    const lx = (r() - 0.5) * 0.08;
    const lz = (r() - 0.5) * 0.08;
    const s0 = geo.v(x - lx - sx, -0.02, z - lz - sz, -sz, 0.3, sx, [1, 1, 1], 0.7, 0.1);
    const s1 = geo.v(x - lx + sx, -0.02, z - lz + sz, -sz, 0.3, sx, [1, 1, 1], 0.7, 0.1);
    const s2 = geo.v(x, y, z, -sz, 0.3, sx, [1, 1, 1], 1, 0.1);
    geo.t(s0, s1, s2);
    const c = geo.v(x, y + 0.012, z, tx, 1, tz, [1, 1, 1], 1, 0.5);
    const petals = 4;
    const rim = [];
    const turn = r() * Math.PI;
    for (let p = 0; p < petals; p++) {
      const pa = (p / petals) * Math.PI * 2 + turn;
      const px = Math.cos(pa) * s;
      const pz = Math.sin(pa) * s;
      rim.push(geo.v(x + px, y + px * tx + pz * tz, z + pz, tx, 1, tz, [1, 1, 1], 1, 1));
    }
    for (let p = 0; p < petals; p++) geo.t(c, rim[(p + 1) % petals], rim[p]);
  }
  return geo.build();
}

// A length of dry-stone wall two metres long (along x), its top lumpy. aPart 3: stone.
function wallGeo() {
  const geo = new Geo();
  const prof = [[-0.38, -0.3], [-0.37, 0.25], [-0.31, 0.62], [-0.18, 0.8], [0.0, 0.84], [0.18, 0.8], [0.31, 0.62], [0.37, 0.25], [0.38, -0.3]];
  const rings = 3;
  const r = rngOf(55);
  const base = geo.count;
  for (let k = 0; k < rings; k++) {
    const x = -1 + (2 * k) / (rings - 1);
    // the top a little lumpy between the ends, the ends level so the overlapping pieces join without a notch
    const lump = k === 0 || k === rings - 1 ? 0 : (r() - 0.5) * 0.08;
    prof.forEach(([z, y]) => {
      const yy = y > 0.5 ? y + lump : y;
      const ny = y > 0.7 ? 1 : y > 0.5 ? 0.6 : 0.1;
      geo.v(x, yy, z, 0, ny, Math.sign(z) || 0, [1, 1, 1], y > 0.5 ? 1 : lerp(0.55, 0.9, (y + 0.3) / 0.8), 3);
    });
  }
  const P = prof.length;
  // (wound to face outward: along the wall is +x, up the profile from the -z foot over the top to the +z foot)
  for (let k = 0; k < rings - 1; k++)
    for (let j = 0; j < P - 1; j++) {
      const a = base + k * P + j;
      const b = a + P;
      geo.t(a, a + 1, b);
      geo.t(a + 1, b + 1, b);
    }
  // the ends
  for (const k of [0, rings - 1]) {
    const c = geo.v(k ? 1 : -1, 0.3, 0, k ? 1 : -1, 0, 0, [1, 1, 1], 0.8, 3);
    for (let j = 0; j < P - 1; j++) {
      const a = base + k * P + j;
      if (k) geo.t(c, a, a + 1);
      else geo.t(c, a + 1, a);
    }
  }
  return geo.build();
}

// A length of post-and-rail fence 2.6 m long (along x): a post at its start and two rails. aPart 5: wood.
function fenceGeo() {
  const geo = new Geo();
  const box = (x0, x1, y0, y1, z0, z1, ao0, ao1) => {
    const c = [1, 1, 1];
    const faces = [
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
      [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]],
      [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]],
      [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]],
      [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]],
    ];
    for (const [a, b, cc, d, n] of faces) {
      const ia = geo.v(...a, ...n, c, a[1] <= y0 ? ao0 : ao1, 5);
      const ib = geo.v(...b, ...n, c, b[1] <= y0 ? ao0 : ao1, 5);
      const ic = geo.v(...cc, ...n, c, ao1, 5);
      const id = geo.v(...d, ...n, c, ao1, 5);
      geo.t(ia, ib, ic);
      geo.t(ia, ic, id);
    }
  };
  box(-1.36, -1.2, -0.3, 1.15, -0.08, 0.08, 0.45, 1);
  box(-1.3, 1.3, 0.52, 0.64, -0.035, 0.035, 0.85, 0.95);
  box(-1.3, 1.3, 0.92, 1.03, -0.035, 0.035, 0.9, 1);
  return geo.build();
}

// A round hay stack about three metres across with a pole through its top. aPart 4: straw, 0: the pole.
function hayGeo() {
  const geo = new Geo();
  const prof = [[1.45, -0.2], [1.5, 0.4], [1.38, 1.1], [1.1, 1.75], [0.68, 2.25], [0.25, 2.55], [0.0, 2.62]];
  const sides = 11;
  const base = geo.count;
  prof.forEach(([rr, y], j) => {
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const ny = j === 0 ? 0.1 : (prof[Math.max(0, j - 1)][0] - prof[Math.min(prof.length - 1, j + 1)][0]) * 0.8;
      geo.v(Math.cos(a) * rr, y, Math.sin(a) * rr, Math.cos(a), ny + 0.1, Math.sin(a), [1, 1, 1], lerp(0.55, 1, smooth(-0.2, 1.4, y)), 4);
    }
  });
  for (let j = 0; j < prof.length - 1; j++)
    for (let s = 0; s < sides; s++) {
      const a = base + j * sides + s;
      const b = base + j * sides + ((s + 1) % sides);
      geo.t(a, a + sides, b);
      geo.t(b, a + sides, b + sides);
    }
  trunk(geo, { sides: 4, r0: 0.05, r1: 0.04, h: 3.3, c0: lin("#5d4c3c"), c1: lin("#6d5a47"), y0: 2.2, aoFoot: 0.8 });
  return geo.build();
}

// A soft dark disc on the ground under a thing (contact shade), a metre across.
function decalGeo() {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  return g;
}

// ------------------------------------------------------------------ materials

const VERT_PARS = [
  "attribute vec4 aTint; attribute float aAO; attribute float aPart;",
  "uniform vec2 uFade; uniform sampler2D uNoise; uniform sampler2D uStroke;",
  "varying vec3 vPW; varying vec3 vNW; varying vec4 vTint; varying float vAO; varying float vPart; varying vec3 vLoc; varying vec3 vRoot; varying vec3 vGround;",
].join("\n");

// before the vertex is placed: tufts and flowers shrink away into the ground far from the eye
const VERT_BEGIN = [
  "#include <begin_vertex>",
  "mat4 im = mat4(1.0);",
  "#ifdef USE_INSTANCING",
  "  im = instanceMatrix;",
  "#endif",
  "vec3 rootW = (modelMatrix * im * vec4(0.0, 0.0, 0.0, 1.0)).xyz;",
  // a wall's height and breadth wander along it by where along it a point is, so the overlapping pieces
  // agree wherever they meet (no piece's end standing proud of the next)
  "#ifdef WALL",
  "  vec4 wn = texture2D(uNoise, (modelMatrix * im * vec4(transformed.x, 0.0, 0.0, 1.0)).xz / 60.0 + 0.23);",
  "  transformed.y *= 0.9 + 0.2 * wn.r;",
  "  transformed.z *= 0.94 + 0.12 * wn.g;",
  "#endif",
  "#ifdef FADE_FAR",
  "  float fadeK = 1.0 - smoothstep(uFade.x, uFade.y, length(rootW - cameraPosition));",
  "  transformed *= fadeK;",
  "#endif",
].join("\n");

// after: where the point is in the world, its normal (with the instance's turn and stretch), and for the
// tufts the ground's own colour under their root, as terrain.js paints it
const VERT_PROJECT = [
  "#include <project_vertex>",
  "vPW = (modelMatrix * im * vec4(transformed, 1.0)).xyz;",
  "mat3 m3 = mat3(im);",
  "vec3 nI = m3 * (objectNormal / vec3(dot(m3[0], m3[0]), dot(m3[1], m3[1]), dot(m3[2], m3[2])));",
  "vNW = normalize(mat3(modelMatrix) * nI);",
  "vTint = aTint; vAO = aAO; vPart = aPart; vLoc = position; vRoot = rootW;",
  "vGround = aTint.rgb;",
  "#ifdef GRASS",
  "  if (aTint.w < 1.5) {",
  "    vec2 gp = rootW.xz;",
  "    float camR = length(rootW - cameraPosition);",
  "    vec4 gA = texture2D(uNoise, gp / 310.0);",
  "    vec4 gB = texture2D(uNoise, gp / 73.0 + 0.31);",
  "    vec4 gC = texture2D(uNoise, gp / 15.0 + 0.57);",
  "    vec4 gD = texture2D(uNoise, gp / 3.3 + 0.19);",
  "    float brush = texture2D(uStroke, gp * 0.31).r - 0.5;",
  // the finer layers fade with distance, as the ground's own mipmaps fade them
  "    float fC = 1.0 - smoothstep(500.0, 1400.0, camR);",
  "    float fD = 1.0 - smoothstep(90.0, 320.0, camR);",
  "    float fS = 1.0 - smoothstep(40.0, 160.0, camR);",
  "    float vary = (gB.r - 0.5) * 0.7 + (gC.g - 0.5) * 0.55 * fC + (gD.a - 0.5) * 0.5 * fD + brush * 0.5 * fS;",
  "    vec3 g = aTint.rgb * (1.0 + vary * 0.3);",
  "    float dry = clamp((gA.r - 0.5) * 2.4 + (gC.b - 0.5) * 0.9 * fC, -1.0, 1.0);",
  "    g = mix(g, g * vec3(1.12, 1.05, 0.72), max(dry, 0.0) * 0.5);",
  "    g = mix(g, g * vec3(0.84, 0.97, 1.02), max(-dry, 0.0) * 0.45);",
  "    vGround = g;",
  "  }",
  "#endif",
].join("\n");

const FRAG_PARS = [
  "uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uGndCol; uniform vec3 uRimCol;",
  "uniform vec3 uFogCol; uniform vec3 uFog; uniform float uShadeLift;",
  "uniform sampler2D uStroke; uniform sampler2D uNoise; uniform vec3 uMoss; uniform vec3 uWet;",
  "varying vec3 vPW; varying vec3 vNW; varying vec4 vTint; varying float vAO; varying float vPart; varying vec3 vLoc; varying vec3 vRoot; varying vec3 vGround;",
  // the kit's brush, laid on from the three sides a surface faces
  "vec4 paintTri(vec3 p, vec3 n) { vec3 b = abs(n); b = b * b; b = b * b; b /= (b.x + b.y + b.z + 1e-5);",
  "  return texture2D(uStroke, p.zy) * b.x + texture2D(uStroke, p.xz + 0.37) * b.y + texture2D(uStroke, p.xy + 0.71) * b.z; }",
  "vec4 noiseTri(vec3 p, vec3 n) { vec3 b = abs(n); b = b * b; b /= (b.x + b.y + b.z + 1e-5);",
  "  return texture2D(uNoise, p.zy) * b.x + texture2D(uNoise, p.xz + 0.37) * b.y + texture2D(uNoise, p.xy + 0.71) * b.z; }",
].join("\n");

const FRAG_MAIN = [
  "vec3 N = normalize(vNW);",
  "vec3 toCam = cameraPosition - vPW;",
  "float camD = length(toCam);",
  "vec3 V = toCam / camD;",
  "vec3 alb = diffuseColor.rgb;",
  "float ao = vAO;",
  "float wrap = 0.0;",
  "float thin = 0.0;",
  "float shK = 1.0;",
  "float lift = 0.5;",
  "float bounce = 0.0;",
  // ------------------------------------------------ leaves and bark
  "#ifdef FOLIAGE",
  "  float leaf = step(0.5, vPart);",
  "  alb *= mix(vec3(1.0), vTint.rgb, leaf);",
  "  vec4 st = paintTri(vPW * 0.16 + vTint.w * 7.0, N);",
  "  vec4 st2 = texture2D(uStroke, vPW.xz * 0.05 + vTint.w * 3.0);",
  "  vec4 cl = noiseTri(vPW / 5.5 + vTint.w * 9.0, N);",
  "  float sS = st.r - 0.5, sB = st.b - 0.5, sM = st2.g - 0.5;",
  // leaf clumps: lit tops and dark gaps a metre or so across
  "  alb *= 1.0 + ((cl.g - 0.5) * 0.55 + (cl.a - 0.5) * 0.3) * leaf;",
  "  alb *= 1.0 + (sS * 0.3 + sB * 0.15) * leaf + (sS * 0.25 + sB * 0.3) * (1.0 - leaf);",
  "  alb = mix(alb, alb * vec3(1.12, 1.06, 0.8), clamp(sM * 2.4, 0.0, 1.0) * 0.55 * leaf);",
  "  alb = mix(alb, alb * vec3(0.86, 0.96, 1.08), clamp(-sM * 2.4, 0.0, 1.0) * 0.5 * leaf);",
  // a birch's bark: short dark marks across it in broken bands, fewer at the dark foot
  "  if (vPart > 0.2 && vPart < 0.3) {",
  "    float bandY = vLoc.y * 26.0 + st.g * 1.4;",
  "    float gapK = texture2D(uNoise, vec2(atan(vLoc.z, vLoc.x) * 0.45 + vTint.w, floor(bandY) * 0.137)).r;",
  "    float band = smoothstep(0.74, 0.86, fract(bandY)) * step(0.42, gapK);",
  "    alb *= 1.0 - band * 0.66 * smoothstep(0.1, 0.18, vLoc.y);",
  "  }",
  // a fruit tree (its tint's fourth part past 1.5): apples among the leaves on the sunny side
  "  if (vTint.w > 1.5) {",
  "    vec4 fr = noiseTri(vPW * 1.9, N);",
  "    float apple = smoothstep(0.8, 0.85, fr.a) * leaf * smoothstep(0.0, 0.5, dot(N, uSunDir) + 0.3);",
  "    alb = mix(alb, mix(vec3(0.62, 0.06, 0.03), vec3(0.75, 0.48, 0.05), step(0.5, fract(vTint.w * 3.7))), apple);",
  "  }",
  // the foot of a tree stands in its own shade
  "  float above = vPW.y - vRoot.y;",
  "  ao *= mix(0.55, 1.0, smoothstep(0.0, 2.2, above));",
  "  wrap = 0.38 * leaf;",
  "  thin = leaf;",
  "  shK = 0.88;",
  "  lift = 0.8;",
  "#endif",
  // ------------------------------------------------ stones: rock, the walls' dry stone
  "#ifdef ROCK",
  // chiselled: the light partly the flat face's, so a stone shows its planes
  "  vec3 fN = normalize(cross(dFdx(vPW), dFdy(vPW)));",
  "  if (dot(fN, N) < 0.0) fN = -fN;",
  "  N = normalize(mix(N, fN, 0.5));",
  "  vec4 nr = noiseTri(vPW / 6.0 + vTint.w * 3.0, N);",
  "  vec4 nf = noiseTri(vPW / 1.3, N);",
  "  vec4 st = paintTri(vPW * 0.5, N);",
  "  alb *= vTint.rgb;",
  "  alb *= 0.82 + (nr.r - 0.5) * 0.35 + (nf.a - 0.5) * 0.3 + (st.r - 0.5) * 0.3 + nr.b * 0.18;",
  // lichen: pale and warm in freckles
  "  alb = mix(alb, vec3(0.62, 0.58, 0.42), smoothstep(0.7, 0.86, nf.g) * 0.4);",
  // moss on whatever faces the sky, more on some stones than others
  "  float moss = smoothstep(0.4, 0.85, N.y + (nr.g - 0.5) * 0.8 + (nf.r - 0.5) * 0.3) * clamp(vTint.w, 0.0, 1.0);",
  "  vec3 mc = uMoss * (0.8 + nf.b * 0.4) * (1.0 + (st.r - 0.5) * 0.4);",
  "  alb = mix(alb, mc, moss);",
  // wet and dark only in the splash, from the water to a metre or so up, a weedy green at the water line
  "  float wet = (1.0 - smoothstep(0.0, 1.2 + (nr.r - 0.5) * 0.6, vPW.y)) * smoothstep(-0.7, -0.2, vPW.y);",
  "  alb = mix(alb, uWet * (0.85 + nf.g * 0.4), wet * 0.7);",
  "  alb = mix(alb, alb * vec3(0.75, 0.88, 0.6), wet * (1.0 - smoothstep(0.0, 0.5, vPW.y)) * 0.5);",
  // under the water pale sand and weed, so a stone just under the surface reads as a light shoal, not a hole
  "  float sub = 1.0 - smoothstep(-0.8, -0.3, vPW.y);",
  "  alb = mix(alb, vec3(0.27, 0.28, 0.19) * (0.85 + nf.b * 0.3) * mix(1.0, 0.7, smoothstep(-0.6, -2.5, vPW.y)), sub * 0.9);",
  "  ao *= mix(0.5, 1.0, smoothstep(-0.1, 0.9, vLoc.y + 0.25));",
  "  ao = mix(ao, 1.0, sub * 0.6);",
  "  wrap = 0.12;",
  "  lift = 0.6;",
  "  bounce = 0.18;",
  "#endif",
  "#ifdef WALL",
  "  alb *= vTint.rgb;",
  // the stones: rows of blocks along the wall (its own x), each block its own shade, soft gaps between
  "  float along = vLoc.x + vTint.w * 17.0;",
  "  float topF = step(0.75, N.y);",
  "  float ry = mix(vLoc.y, vLoc.z + 0.4, topF);",
  "  float row = floor(ry / 0.22);",
  "  float shift = fract(sin(row * 12.9898 + vTint.w * 7.0) * 43758.5453);",
  "  float sx = along / (0.3 + shift * 0.2) + shift * 3.0;",
  "  float h = fract(sin(floor(sx) * 78.233 + row * 37.719) * 43758.5453);",
  "  float gx = abs(fract(sx) - 0.5) * 2.0;",
  "  float gy = abs(fract(ry / 0.22) - 0.5) * 2.0;",
  "  float gap = max(smoothstep(0.76, 0.97, gx), smoothstep(0.7, 0.95, gy));",
  "  alb *= (0.88 + h * 0.26) * (1.0 - gap * 0.32);",
  "  ao *= 1.0 - gap * 0.2;",
  "  vec4 nf = noiseTri(vPW / 1.5, N);",
  "  float moss = smoothstep(0.55, 0.9, N.y + (nf.r - 0.5) * 0.9) * 0.7;",
  "  alb = mix(alb, uMoss * (0.85 + nf.b * 0.3), moss);",
  // lichen: a paler, warmer freckle on the stone, never white
  "  alb = mix(alb, alb * vec3(1.16, 1.12, 0.92), smoothstep(0.72, 0.88, nf.g) * 0.5);",
  "  wrap = 0.18;",
  "  lift = 0.75;",
  "  bounce = 0.38;",
  "#endif",
  // ------------------------------------------------ wood and straw
  "#ifdef SOLID",
  "  vec4 st = paintTri(vPW * 0.9, N);",
  "  if (vPart > 3.5) alb *= vTint.rgb;",
  "  alb *= 1.0 + (st.r - 0.5) * 0.35 + (st.b - 0.5) * 0.3;",
  "  if (vPart > 3.5 && vPart < 4.5) {",
  // straw: a combed thatch of strands down the stack, darker and greyer toward the foot
  "    float strand = texture2D(uStroke, vec2(atan(vLoc.z, vLoc.x) * 1.3, vLoc.y * 0.35)).b - 0.5;",
  "    alb *= 1.0 + strand * 0.5;",
  "    alb = mix(alb * vec3(0.78, 0.76, 0.72), alb, smoothstep(0.0, 1.0, vLoc.y));",
  "  }",
  "  wrap = 0.2;",
  "#endif",
  // ------------------------------------------------ grass: the ground's colour at the root, lighter and warmer up the blade
  "#ifdef GRASS",
  // the blades' cut-out: the mipmaps thin the coverage as the card gets small, so it is lifted to match
  "  vec2 tdx = dFdx(vUv * 256.0), tdy = dFdy(vUv * 256.0);",
  "  float mip = max(0.0, 0.5 * log2(max(dot(tdx, tdx), dot(tdy, tdy))));",
  "  if (diffuseColor.a * (1.0 + mip * 0.32) < 0.45) discard;",
  "  float up = vPart;",
  "  vec3 base = vGround;",
  // (its tint's fourth part: under 1.5 meadow grass, 2 to 3 a fern, 3 and up standing wheat)
  "  float wheat = step(2.95, vTint.w);",
  "  if (vTint.w > 1.5) base = vTint.rgb;",
  // each tuft its own: some drier and golden, some a cooler blue-green
  "  float hv = (fract(vTint.w * 7.31) - 0.5) * (1.0 - wheat);",
  "  base = mix(base, base * vec3(1.12, 1.04, 0.7), max(hv, 0.0) * 0.8);",
  "  base = mix(base, base * vec3(0.8, 0.98, 1.1), max(-hv, 0.0) * 0.9);",
  // dark at the roots, the tips bright where the sun catches them
  "  vec3 tipC = base * mix(vec3(1.22, 1.32, 0.92), vec3(1.2, 1.15, 1.02), wheat) + uSunCol * 0.02;",
  // the blades' shade, unmixed from the clear gaps between them (black in the texture) that the mipmaps blend in afar
  "  float bladeK = clamp(diffuseColor.r / max(diffuseColor.a, 0.05), 0.0, 1.0);",
  "  vec3 rootC = base * mix(vec3(0.62, 0.74, 0.5), vec3(0.8), wheat);",
  "  alb = mix(rootC, tipC, smoothstep(0.05, 1.0, up)) * (0.62 + 0.42 * bladeK);",
  "  alb *= 1.0 + (fract(vTint.w * 13.7) - 0.5) * 0.16;",
  // seen from afar a tuft is a soft lighter fleck in the meadow, not a dark mark
  "  alb = mix(alb, base * 1.07, smoothstep(60.0, 240.0, camD) * 0.6);",
  "  ao = mix(0.62, 1.1, smoothstep(0.0, 0.85, up));",
  "  ao = mix(ao, 1.0, smoothstep(60.0, 240.0, camD) * 0.6);",
  "  wrap = 0.3;",
  "  thin = up * 0.7;",
  "  shK = 0.9;",
  "#endif",
  // ------------------------------------------------ blossoms: their colour, a warm heart
  "#ifdef BLOSSOM",
  "  float heart = 1.0 - smoothstep(0.5, 0.9, vPart);",
  "  vec3 eye = vTint.w > 0.5 ? vec3(0.95, 0.62, 0.08) : vTint.rgb * 0.45;",
  "  alb = mix(vTint.rgb, eye, heart * 0.9);",
  // the stem
  "  if (vPart < 0.3) { alb = vec3(0.17, 0.27, 0.08); ao = 0.8; }",
  "  wrap = 0.4;",
  "  thin = 0.5;",
  "  lift = 0.7;",
  "#endif",
  // ------------------------------------------------ the light, as the land's
  "float sh = smoothstep(0.1, 0.9, pShadow);",
  "float ndl = dot(N, uSunDir);",
  // faces turned from the sun take no part in the shadow test (no speckle on the dark side of a leaf)
  "sh = mix(1.0, sh, smoothstep(-0.3, 0.15, ndl) * shK);",
  "float lam = clamp((ndl + wrap) / (1.0 + wrap), 0.0, 1.0);",
  "lam = mix(lam, lam * lam * (3.0 - 2.0 * lam), wrap);",
  "float lit = lam * sh;",
  "vec3 direct = uSunCol * lit * mix(0.8, 1.0, clamp(ao, 0.0, 1.0));",
  "float upN = N.y * 0.5 + 0.5;",
  "vec3 amb = mix(uGndCol, uSkyCol, upN) * ao;",
  "vec3 c = alb * (direct + amb);",
  // the shade takes the sky's blue
  "c += alb * uSkyCol * mix(smoothstep(0.55, 0.95, N.y), 1.0, lift - 0.5) * (1.0 - lit) * uShadeLift * 0.5 * ao;",
  // stone's shade warmed by the light the sunny ground throws back into it, so it stays a warm grey
  "c += alb * uGndCol * bounce * (1.0 - lit) * ao;",
  // the sun through the leaves when it is behind them
  "c += uSunCol * alb * pow(max(dot(-V, uSunDir), 0.0), 4.0) * 0.45 * thin * sh;",
  // a warm rim on edges turned away, as the builds have
  "float fr = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);",
  "c += uRimCol * alb * fr * (0.2 + 0.8 * lit) * 0.35;",
  "float f = smoothstep(uFog.x, uFog.y, camD) * 0.94;",
  "c = mix(c, uFogCol, f);",
  "gl_FragColor = vec4(c, clamp(lit, 0.0, 1.0));",
].join("\n");

// A material for one kind: the kit's light, hooked into a Lambert material so three's shadow test is there.
function dressMaterial(kind, defines, opts = {}) {
  const G = window.KIT.G;
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: opts.side ?? THREE.FrontSide, map: opts.map ?? null, alphaTest: opts.alphaTest ?? 0 });
  // (a spruce's tiers are open skirts: both their faces go into the sun's shadow map, or most of the tree casts none)
  if (opts.shadowSide !== undefined) m.shadowSide = opts.shadowSide;
  m.defines = defines;
  if (opts.derivatives) m.extensions = { derivatives: true };
  const U = {
    uNoise: { value: noiseTexture() },
    uFade: { value: new THREE.Vector2(opts.fade?.[0] ?? 1e6, opts.fade?.[1] ?? 2e6) },
    uMoss: { value: new THREE.Vector3(...lin("#6f8c3c")) },
    uWet: { value: new THREE.Vector3(...lin("#4f4c46")) },
  };
  m.onBeforeCompile = (sh) => {
    for (const k of ["uSunDir", "uSunCol", "uSkyCol", "uGndCol", "uRimCol", "uFogCol", "uFog", "uShadeLift", "uStroke"]) sh.uniforms[k] = G[k];
    Object.assign(sh.uniforms, U);
    sh.vertexShader = VERT_PARS + "\n" + sh.vertexShader.replace("#include <begin_vertex>", VERT_BEGIN).replace("#include <project_vertex>", VERT_PROJECT);
    sh.fragmentShader =
      FRAG_PARS +
      "\n" +
      sh.fragmentShader
        .replace("reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();", "float pShadow = getShadowMask();")
        .replace("gl_FragColor = vec4( outgoingLight, diffuseColor.a );", FRAG_MAIN);
  };
  m.customProgramCacheKey = () => "glade-dress-" + kind;
  m.userData.uniforms = U;
  return m;
}

// The contact shade: multiplies the ground under it toward the shade's blue, soft at the edge, gone in the haze.
function decalMaterial() {
  const G = window.KIT.G;
  return new THREE.ShaderMaterial({
    uniforms: { uFog: G.uFog, uShade: { value: new THREE.Vector3(...lin("#5f6f86")) } },
    vertexShader: [
      "attribute vec4 aTint; varying vec2 vUv; varying float vS; varying float vCamD;",
      "void main() {",
      "  vUv = uv; vS = aTint.w;",
      "  mat4 im = mat4(1.0);",
      "  #ifdef USE_INSTANCING",
      "    im = instanceMatrix;",
      "  #endif",
      "  vec4 wp = modelMatrix * im * vec4(position, 1.0);",
      "  vCamD = length(wp.xyz - cameraPosition);",
      "  gl_Position = projectionMatrix * viewMatrix * wp;",
      "}",
    ].join("\n"),
    fragmentShader: [
      "uniform vec3 uFog; uniform vec3 uShade; varying vec2 vUv; varying float vS; varying float vCamD;",
      "void main() {",
      "  float r = length(vUv * 2.0 - 1.0);",
      "  float a = 1.0 - smoothstep(0.05, 1.0, r);",
      "  a = a * a * vS * (1.0 - smoothstep(uFog.x, uFog.y, vCamD));",
      "  gl_FragColor = vec4(mix(vec3(1.0), uShade, a), 1.0);",
      "}",
    ].join("\n"),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -6,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor,
    blendDst: THREE.SrcColorFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
}

// ------------------------------------------------------------------ the fields' paint

// The fields lie on the ground as a skin of the terrain's own triangles: the
// grass round their edges painted as terrain.js paints it, so a field melts
// into the meadow, and inside, the crop: wheat gold in rows, green rows on
// brown earth, fallow furrows, a mown hay meadow.
const FIELD_VERT = "attribute vec4 aField; attribute float aAOg; varying vec3 vPW; varying vec3 vNW; varying vec4 vField; varying float vAOg;";
const FIELD_FRAG = [
  "uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uGndCol; uniform vec3 uFogCol; uniform vec3 uFog; uniform float uShadeLift;",
  "uniform sampler2D uStroke; uniform sampler2D uNoise;",
  "uniform vec3 uWheat; uniform vec3 uSoil; uniform vec3 uCrop; uniform vec3 uFallow; uniform vec3 uHay;",
  "varying vec3 vPW; varying vec3 vNW; varying vec4 vField; varying float vAOg;",
  // stripes of a period that fade out where they get finer than the pixels
  "float rows(float v, float period, float sharp) { float x = v / period; float w = fwidth(x); float s = 0.5 + 0.5 * cos(x * 6.2831853);",
  "  s = smoothstep(0.5 - sharp, 0.5 + sharp, s); return mix(s, 0.5, smoothstep(0.18, 0.5, w)); }",
].join("\n");
const FIELD_MAIN = [
  "vec3 N = normalize(vNW);",
  "vec2 p = vPW.xz;",
  "float camD = length(vPW - cameraPosition);",
  "vec4 nA = texture2D(uNoise, p / 310.0);",
  "vec4 nB = texture2D(uNoise, p / 73.0 + 0.31);",
  "vec4 nC = texture2D(uNoise, p / 15.0 + 0.57);",
  "vec4 nD = texture2D(uNoise, p / 3.3 + 0.19);",
  // the grass, exactly as the ground paints it
  "vec3 g = diffuseColor.rgb;",
  "float brush = texture2D(uStroke, p * 0.31).r - 0.5;",
  "float vary = (nB.r - 0.5) * 0.7 + (nC.g - 0.5) * 0.55 + (nD.a - 0.5) * 0.5 + brush * 0.5;",
  "g *= 1.0 + vary * 0.3;",
  "float dry = clamp((nA.r - 0.5) * 2.4 + (nC.b - 0.5) * 0.9, -1.0, 1.0);",
  "g = mix(g, g * vec3(1.12, 1.05, 0.72), max(dry, 0.0) * 0.5);",
  "g = mix(g, g * vec3(0.84, 0.97, 1.02), max(-dry, 0.0) * 0.45);",
  // the crop
  "float u = vField.x, v = vField.y, kind = vField.z;",
  "vec4 nU = texture2D(uNoise, vec2(u, v) / 9.0 + 0.13);",
  "vec3 crop;",
  // (the rows wander a little, so no line is ruled)
  "float vw = v + (nC.r - 0.5) * 0.45 + (nB.g - 0.5) * 1.2;",
  "if (kind < 0.5) {",
  // wheat: gold, a sheen where the wind combs it, soft fine rows
  "  crop = uWheat * (0.92 + (nU.r - 0.5) * 0.3 + (nD.g - 0.5) * 0.14 + brush * 0.12 + (nB.b - 0.5) * 0.12);",
  "  crop = mix(crop, crop * vec3(1.1, 1.06, 0.86), smoothstep(0.55, 0.8, nC.r) * 0.6);",
  "  crop *= mix(0.93, 1.03, rows(vw, 0.75, 0.3));",
  "} else if (kind < 1.5) {",
  // green rows on brown earth, thicker in some patches than others
  "  float r = rows(vw, 1.5, 0.22);",
  "  vec3 leaves = uCrop * (0.85 + (nD.r - 0.5) * 0.4 + brush * 0.2);",
  "  float thick = clamp(0.62 + (nB.r - 0.5) * 0.5 + (nU.g - 0.5) * 0.3, 0.2, 1.0);",
  "  crop = mix(uSoil * (0.9 + (nD.b - 0.5) * 0.2), leaves, thick * mix(0.55, 1.0, r));",
  "} else if (kind < 2.5) {",
  // fallow: ploughed furrows, a few weeds coming back
  "  crop = uFallow * (0.92 + (nU.b - 0.5) * 0.25 + (nD.r - 0.5) * 0.15) * mix(0.9, 1.03, rows(vw, 0.8, 0.35));",
  "  crop = mix(crop, g * 0.9, smoothstep(0.62, 0.82, nC.a + (nD.g - 0.5) * 0.3) * 0.7);",
  "} else {",
  // a hay meadow, mown in bands, the cut hay drying in lines along them
  "  crop = mix(g, uHay, 0.42) * mix(0.96, 1.04, rows(vw, 4.5, 0.05));",
  "  float wr = 0.5 + 0.5 * cos((vw + 1.1) / 9.0 * 6.2831853) + (nD.g - 0.5) * 0.14;",
  "  float windrow = smoothstep(0.84, 0.97, wr) * (1.0 - smoothstep(0.2, 0.5, fwidth(v / 9.0)));",
  "  crop = mix(crop, uWheat * (0.85 + nD.r * 0.25), windrow * 0.5);",
  "}",
  "float edge = vField.w + (nD.r - 0.5) * 1.1 + (nC.g - 0.5) * 0.8;",
  "float inK = smoothstep(0.2, 1.6, edge);",
  "vec3 alb = mix(g, crop, inK);",
  // the light, as terrain.js lights the ground
  "float sh = smoothstep(0.1, 0.9, pShadow);",
  "float ndl = dot(N, uSunDir);",
  "float lam = clamp(ndl * 0.92 + 0.08, 0.0, 1.0);",
  "float lit = lam * sh;",
  "float ao = vAOg;",
  "vec3 direct = uSunCol * lit * mix(0.8, 1.0, clamp(ao, 0.0, 1.0));",
  "float up = N.y * 0.5 + 0.5;",
  "vec3 amb = mix(uGndCol, uSkyCol, up) * ao;",
  "vec3 c = alb * (direct + amb);",
  "c += alb * uSkyCol * smoothstep(0.55, 0.95, N.y) * (1.0 - lit) * uShadeLift * 0.5 * ao;",
  "float f = smoothstep(uFog.x, uFog.y, camD) * 0.94;",
  "c = mix(c, uFogCol, f);",
  "gl_FragColor = vec4(c, clamp(lit, 0.0, 1.0));",
].join("\n");

function fieldMaterial() {
  const G = window.KIT.G;
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  m.extensions = { derivatives: true };
  const U = {
    uNoise: { value: noiseTexture() },
    uWheat: { value: new THREE.Vector3(...lin("#d6ad55")) },
    uSoil: { value: new THREE.Vector3(...lin("#8c6f4d")) },
    uCrop: { value: new THREE.Vector3(...lin("#5d8a34")) },
    uFallow: { value: new THREE.Vector3(...lin("#9a7a55")) },
    uHay: { value: new THREE.Vector3(...lin("#b9b261")) },
  };
  m.onBeforeCompile = (sh) => {
    for (const k of ["uSunDir", "uSunCol", "uSkyCol", "uGndCol", "uFogCol", "uFog", "uShadeLift", "uStroke"]) sh.uniforms[k] = G[k];
    Object.assign(sh.uniforms, U);
    sh.vertexShader =
      FIELD_VERT +
      "\n" +
      sh.vertexShader.replace(
        "#include <project_vertex>",
        "#include <project_vertex>\n  vPW = (modelMatrix * vec4(transformed, 1.0)).xyz; vNW = normalize(mat3(modelMatrix) * objectNormal);\n" +
          "  vField = aField; vAOg = aAOg;",
      );
    sh.fragmentShader =
      FIELD_FRAG +
      "\n" +
      sh.fragmentShader
        .replace("reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();", "float pShadow = getShadowMask();")
        .replace("gl_FragColor = vec4( outgoingLight, diffuseColor.a );", FIELD_MAIN);
  };
  m.customProgramCacheKey = () => "glade-dress-fields";
  return m;
}

// ------------------------------------------------------------------ the ground as it is drawn

// The ground's height at any point as the terrain draws it: its grid's
// heights (asked of the ground only when first needed) and between them the
// same two triangles terrain.js splits each square into.
class Surface {
  // grid: the heights shared by every chunk at this step ({ H, x0, z0, nx, nz }), so a node on a
  // chunk's border is asked of the ground once, not by each chunk that touches it
  constructor(ground, x0, z0, size, step, grid) {
    this.g = ground;
    this.x0 = x0;
    this.z0 = z0;
    this.st = step;
    this.G = grid;
    this.gi = Math.round((x0 - grid.x0) / step);
    this.gj = Math.round((z0 - grid.z0) / step);
    // nodes -2 .. size / step + 2 each way, for any point outside the shared grid
    this.n = Math.round(size / step) + 5;
    this.H = null;
    this.h = 0;
    this.gx = 0;
    this.gz = 0;
  }
  node(i, j) {
    const G = this.G;
    const gi = this.gi + i;
    const gj = this.gj + j;
    if (gi >= 0 && gj >= 0 && gi < G.nx && gj < G.nz) {
      const k = gj * G.nx + gi;
      let v = G.H[k];
      if (v !== v) v = G.H[k] = this.g.height(G.x0 + gi * this.st, G.z0 + gj * this.st);
      return v;
    }
    if (!this.H) this.H = new Float32Array(this.n * this.n).fill(NaN);
    const k = (j + 2) * this.n + (i + 2);
    let v = this.H[k];
    if (v !== v) v = this.H[k] = this.g.height(this.x0 + i * this.st, this.z0 + j * this.st);
    return v;
  }
  // Sets this.h (the height), this.gx and this.gz (its slope along x and z).
  at(x, z) {
    const st = this.st;
    const fx = (x - this.x0) / st;
    const fz = (z - this.z0) / st;
    const i = clamp(Math.floor(fx), -2, this.n - 4);
    const j = clamp(Math.floor(fz), -2, this.n - 4);
    const u = fx - i;
    const v = fz - j;
    const a = this.node(i, j);
    const b = this.node(i + 1, j);
    const c = this.node(i, j + 1);
    const d = this.node(i + 1, j + 1);
    if (Math.abs(a - d) < Math.abs(b - c)) {
      if (v > u) {
        this.h = a + (d - c) * u + (c - a) * v;
        this.gx = d - c;
        this.gz = c - a;
      } else {
        this.h = a + (b - a) * u + (d - b) * v;
        this.gx = b - a;
        this.gz = d - b;
      }
    } else if (u + v < 1) {
      this.h = a + (b - a) * u + (c - a) * v;
      this.gx = b - a;
      this.gz = c - a;
    } else {
      this.h = d + (c - d) * (1 - u) + (b - d) * (1 - v);
      this.gx = d - c;
      this.gz = d - b;
    }
    this.gx /= st;
    this.gz /= st;
    return this.h;
  }
  get slope() {
    return Math.hypot(this.gx, this.gz);
  }
}

// ------------------------------------------------------------------ the farmland

// a field's kind (its index): 0 wheat, 1 green rows, 2 fallow, 3 a hay meadow, 4 pasture
let FARM = null;

// The x of a river where it crosses z (the nearest of its samples).
function riverXAt(rv, z) {
  let best = rv.samples[0];
  for (const s of rv.samples) if (Math.abs(s.z - z) < Math.abs(best.z - z)) best = s;
  return best.x;
}

// The signed distance from a convex polygon's edge (positive inside).
function polyIn(poly, x, z) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i];
    const [bx, bz] = poly[(i + 1) % poly.length];
    const ex = bx - ax;
    const ez = bz - az;
    const L = Math.hypot(ex, ez) || 1;
    // the inward normal of a counter-clockwise polygon (x right, z down the page) is (-ez, ex) / L
    d = Math.min(d, ((x - ax) * -ez + (z - az) * ex) / L);
  }
  return d;
}

// How far inside a field's crop a point is: the field's own edges with their corners rounded off (a soft
// minimum of the edges' distances, which cuts a corner by about 2.4 m), drawn in from the wall by a
// margin of grass that wanders between about half a metre and three, so no crop edge is ruled straight.
function cropIn(f, x, z) {
  const K = 3.5;
  let s = 0;
  const poly = f.poly;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i];
    const [bx, bz] = poly[(i + 1) % poly.length];
    const ex = bx - ax;
    const ez = bz - az;
    const L = Math.hypot(ex, ez) || 1;
    s += Math.exp(-clamp(((x - ax) * -ez + (z - az) * ex) / L, -60, 60) / K);
  }
  const d = -K * Math.log(s);
  return d - (1.6 + 1.1 * noise2(x / 11 + f.i * 3.1, z / 11 + f.j * 1.7) + 0.45 * noise2(x / 4.1 + 7.7, z / 4.1));
}

// The headlands' fields, worked out once: each field a quad on a turned,
// jittered grid where the ground is gentle, open, dry and away from the
// cliffs, the rivers and every build site. { fields: [{ poly, kind, ux, uz, ox, oz }], walls: [...], hay: [...] }
export function farmland() {
  if (FARM) return FARM;
  const fields = [];
  const walls = [];
  const hay = [];
  const list = sites();
  const W = RIVERS.find((r) => r.id === "west");
  const E = RIVERS.find((r) => r.id === "east");
  const sides = [
    { id: 1, ox: -300, oz: -120, ang: 0.38, ok: (x, z) => x < -128 && x < riverXAt(W, z) - 22, stone: 0.75 },
    // the east is wooded: its farm is a clearing cut in the woods
    { id: 2, ox: 330, oz: -130, ang: -0.3, ok: (x, z) => x > 206 && x > riverXAt(E, z) + 22, stone: 0.45, clear: [300, -160, 105] },
  ];
  for (const side of sides) {
    const r = rngOf(hash3(side.id, 77, 5));
    const ca = Math.cos(side.ang);
    const sa = Math.sin(side.ang);
    // the grid's lines across and along, each field its own size
    const us = [-250];
    while (us[us.length - 1] < 250) us.push(us[us.length - 1] + 34 + r() * 26);
    const vs = [-250];
    while (vs[vs.length - 1] < 250) vs.push(vs[vs.length - 1] + 26 + r() * 20);
    const P = us.map((u) => vs.map((v) => [u + (r() - 0.5) * 9, v + (r() - 0.5) * 9]));
    const world = ([u, v]) => [side.ox + u * ca - v * sa, side.oz + u * sa + v * ca];
    const cleared = (x, z) => side.clear && Math.hypot(x - side.clear[0], z - side.clear[1]) < side.clear[2];
    const okAt = (x, z) => {
      if (x < CORE.x0 + 12 || x > CORE.x1 - 12 || z < CORE.z0 + 12 || z > CORE.z1 - 12) return false;
      if (!side.ok(x, z)) return false;
      if (shoreDist(x, z) < 34) return false;
      if (forestAt(x, z) > 0.75 && !cleared(x, z)) return false;
      const rv = riverAt(x, z);
      if (rv && !rv.past && rv.d < rv.w / 2 + 12) return false;
      for (const s of list) if (Math.abs(s.x - x) < 60 && Math.abs(s.z - z) < 60 && rectOut(s, x, z) < 14) return false;
      return true;
    };
    const taken = new Map();
    for (let i = 0; i < us.length - 1; i++)
      for (let j = 0; j < vs.length - 1; j++) {
        const q = [P[i][j], P[i + 1][j], P[i + 1][j + 1], P[i][j + 1]].map(world);
        const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4;
        const cz = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
        const pts = [...q, [cx, cz], ...q.map((c, k) => [(c[0] + q[(k + 1) % 4][0]) / 2, (c[1] + q[(k + 1) % 4][1]) / 2])];
        if (!pts.every(([x, z]) => okAt(x, z))) continue;
        if (forestAt(cx, cz) > 0.6 && !cleared(cx, cz)) continue;
        // gentle: the corners within a few metres of a plane through them, and not steep
        const hs = pts.map(([x, z]) => naturalAt(x, z));
        const hc = hs[4];
        const grad = Math.max(...q.map(([x, z], k) => Math.abs(hs[k] - hc) / Math.hypot(x - cx, z - cz)));
        if (grad > 0.2 || hs.some((h) => h > 85)) continue;
        if (r() < 0.12) continue;
        // counter-clockwise as polyIn wants (the inward normal (-ez, ex))
        let poly = q;
        if (polyIn(poly, cx, cz) < 0) poly = [...q].reverse();
        const kindR = r();
        const kind = kindR < 0.34 ? 0 : kindR < 0.56 ? 1 : kindR < 0.7 ? 2 : kindR < 0.88 ? 3 : 4;
        const f = { poly, kind, ux: ca, uz: sa, ox: cx, oz: cz, hc, side: side.id, i, j, n: fields.length };
        fields.push(f);
        taken.set(`${i},${j}`, f);
      }
    // the walls and fences round them: each edge once, a gate gap in some
    const seen = new Set();
    for (const f of fields.filter((ff) => ff.side === side.id)) {
      const { i, j } = f;
      const corners = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
      for (let k = 0; k < 4; k++) {
        const a = corners[k];
        const b = corners[(k + 1) % 4];
        const key = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? `${a}-${b}` : `${b}-${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const pa = world(P[a[0]][a[1]]);
        const pb = world(P[b[0]][b[1]]);
        const stone = r() < side.stone;
        const L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
        const seg = stone ? 2.0 : 2.6;
        const n = Math.max(1, Math.round(L / seg));
        const gate = r() < 0.45 ? Math.floor(n * (0.25 + r() * 0.5)) : -1;
        const gateW = stone ? 2 : 1;
        for (let s = 0; s < n; s++) {
          if (gate >= 0 && s >= gate && s < gate + gateW) continue;
          const t0 = s / n;
          const t1 = (s + 1) / n;
          const seed = hash3(side.id, walls.length, 3);
          walls.push({ stone, x0: lerp(pa[0], pb[0], t0), z0: lerp(pa[1], pb[1], t0), x1: lerp(pa[0], pb[0], t1), z1: lerp(pa[1], pb[1], t1), seed });
        }
      }
      // hay stacks in the mown meadows and the cut wheat
      if (f.kind === 3 || (f.kind === 0 && r() < 0.35)) {
        const n = 1 + Math.floor(r() * 3);
        for (let s = 0; s < n; s++) {
          const x = f.ox + (r() - 0.5) * 18;
          const z = f.oz + (r() - 0.5) * 14;
          if (polyIn(f.poly, x, z) > 5) hay.push({ x, z, s: 0.8 + r() * 0.35, yaw: r() * 6.28, seed: hash3(s, walls.length, 9) });
        }
      }
    }
  }
  FARM = { fields, walls, hay };
  return FARM;
}

// The field (and how far inside it) at a point: { f, d } or null.
function fieldAt(farm, x, z, reach = 0) {
  let best = null;
  for (const f of farm.near(x, z)) {
    const d = polyIn(f.poly, x, z);
    if (d > -reach && (!best || d > best.d)) best = { f, d };
  }
  return best;
}

// ------------------------------------------------------------------ what blocks things

// The lanes as segments in a grid, for the distance from a point to the nearest.
function laneIndex(lanes) {
  const CELL = 32;
  const grid = new Map();
  const segs = [];
  for (const pts of lanes)
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const s = [ax, az, bx, bz];
      segs.push(s);
      for (let cx = Math.floor((Math.min(ax, bx) - 12) / CELL); cx <= Math.floor((Math.max(ax, bx) + 12) / CELL); cx++)
        for (let cz = Math.floor((Math.min(az, bz) - 12) / CELL); cz <= Math.floor((Math.max(az, bz) + 12) / CELL); cz++) {
          const k = cx * 100003 + cz;
          let l = grid.get(k);
          if (!l) grid.set(k, (l = []));
          l.push(s);
        }
    }
  return {
    segs,
    // the distance to the nearest lane (up to 12 m; further is "far")
    dist(x, z) {
      const l = grid.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL));
      if (!l) return 99;
      let d = 99;
      for (const [ax, az, bx, bz] of l) {
        const vx = bx - ax;
        const vz = bz - az;
        const t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1), 0, 1);
        d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t));
      }
      return d;
    },
  };
}

// Rectangles (pads, sites) in a grid: the least distance outside any near a point, good out to `reach`
// metres from a rectangle (further is 99). fn.at(x, z, m): the rectangle a point is on (or within m of), or null.
function rectIndex(list, reach = 24) {
  const CELL = 48;
  const grid = new Map();
  for (const p of list) {
    const R = Math.hypot(p.hw, p.hd) + reach;
    for (let cx = Math.floor((p.x - R) / CELL); cx <= Math.floor((p.x + R) / CELL); cx++)
      for (let cz = Math.floor((p.z - R) / CELL); cz <= Math.floor((p.z + R) / CELL); cz++) {
        const k = cx * 100003 + cz;
        let l = grid.get(k);
        if (!l) grid.set(k, (l = []));
        l.push(p);
      }
  }
  const cell = (x, z) => grid.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL));
  const fn = (x, z) => {
    const l = cell(x, z);
    if (!l) return 99;
    let d = 99;
    for (const p of l) d = Math.min(d, rectOut(p, x, z));
    return d;
  };
  fn.at = (x, z, m = 0) => {
    const l = cell(x, z);
    if (l) for (const p of l) if (rectOut(p, x, z) <= m) return p;
    return null;
  };
  return fn;
}

// How far the town will soon reach: the pads up to this one (the highest levelled, and FRONTIER_GAP more)
// are kept clear; past it the pads are the countryside till the town comes. (The town takes its pads in order.)
function frontierOf(ground) {
  let top = -1;
  for (const p of ground.pads) if (!p.plaza && Number.isFinite(p.plot)) top = Math.max(top, p.plot);
  return top + FRONTIER_GAP;
}

// What a pad past the frontier is till the town comes (the same every time):
// { use: woods | grove | orchard | meadow | copse | hay, hedges: [front, right, back, left], seed }.
const USES = new Map();
function siteUse(s) {
  let u = USES.get(s.plot);
  if (u) return u;
  const r = rngOf(hash3(s.plot, 41, 7));
  const t = r();
  const fo = forestAt(s.x, s.z);
  const use = fo > 0.42 ? "woods" : t < 0.3 ? "grove" : t < 0.5 ? "orchard" : t < 0.7 ? "meadow" : t < 0.85 ? "copse" : "hay";
  const hedged = use === "orchard" || use === "hay" ? 0.65 : 0.42;
  u = { use, hedges: [r() < hedged, r() < hedged, r() < hedged, r() < hedged], seed: hash3(s.plot, 43, 11) };
  USES.set(s.plot, u);
  return u;
}

// The box round every pad, and how far a point is from it (for the far hills: is the town near?).
let SITE_BOX = null;
function siteBoxOut(x, z) {
  if (!SITE_BOX) {
    SITE_BOX = [Infinity, Infinity, -Infinity, -Infinity];
    for (const s of sites()) {
      SITE_BOX[0] = Math.min(SITE_BOX[0], s.x - 24);
      SITE_BOX[1] = Math.min(SITE_BOX[1], s.z - 24);
      SITE_BOX[2] = Math.max(SITE_BOX[2], s.x + 24);
      SITE_BOX[3] = Math.max(SITE_BOX[3], s.z + 24);
    }
  }
  return Math.hypot(Math.max(0, SITE_BOX[0] - x, x - SITE_BOX[2]), Math.max(0, SITE_BOX[1] - z, z - SITE_BOX[3]));
}

const pierOut = (x, z) => Math.max(Math.abs(x - PIER.x) - PIER.w, z < PIER.z0 - 6 ? PIER.z0 - 6 - z : 0, z > PIER.z1 ? z - PIER.z1 : 0);

// Everything the chunks are grown against: the ground, its pads, the sites (kept clear or not), the lanes, the fields.
function makeEnv(ground, lanes, detail) {
  const farm = farmland();
  if (!farm.near) {
    const CELL = 64;
    const grid = new Map();
    for (const f of farm.fields) {
      const xs = f.poly.map((p) => p[0]);
      const zs = f.poly.map((p) => p[1]);
      f.box = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
      for (let cx = Math.floor((f.box[0] - 8) / CELL); cx <= Math.floor((f.box[2] + 8) / CELL); cx++)
        for (let cz = Math.floor((f.box[1] - 8) / CELL); cz <= Math.floor((f.box[3] + 8) / CELL); cz++) {
          const k = cx * 100003 + cz;
          let l = grid.get(k);
          if (!l) grid.set(k, (l = []));
          l.push(f);
        }
    }
    farm.near = (x, z) => grid.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL)) || [];
    // the walls and stacks by chunk
    farm.byChunk = new Map();
    const add = (x, z, what, item) => {
      const k = `${Math.floor((x - CORE.x0) / CHUNK)},${Math.floor((z - CORE.z0) / CHUNK)}`;
      let e = farm.byChunk.get(k);
      if (!e) farm.byChunk.set(k, (e = { walls: [], hay: [] }));
      e[what].push(item);
    };
    for (const w of farm.walls) add((w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2, "walls", w);
    for (const h of farm.hay) add(h.x, h.z, "hay", h);
  }
  const plaza = ground.pads.find((p) => p.plaza);
  // the ground's heights on its two grids, filled as the chunks ask for them
  const grid = (x0, z0, x1, z1, step) => {
    const nx = Math.round((x1 - x0) / step) + 1;
    const nz = Math.round((z1 - z0) / step) + 1;
    return { H: new Float32Array(nx * nz).fill(NaN), x0, z0, nx, nz };
  };
  const grids = {
    near: grid(CORE.x0 - 2 * STEP, CORE.z0 - 2 * STEP, CORE.x1 + 2 * STEP, CORE.z1 + 2 * STEP, STEP),
    far: grid(-WORLD_R - 2 * FAR_STEP, -WORLD_R - 2 * FAR_STEP, WORLD_R + 2 * FAR_STEP, CORE.z1 + FAR_CHUNK + 2 * FAR_STEP, FAR_STEP),
  };
  const frontier = frontierOf(ground);
  const all = sites();
  const kept = all.filter((s) => s.plot <= frontier);
  const open = all.filter((s) => s.plot > frontier);
  return {
    ground,
    farm,
    plaza,
    grids,
    detail,
    frontier,
    kept,
    open,
    padOut: rectIndex(ground.pads.filter((p) => !p.plaza)),
    // the pads kept clear for the town to come
    siteOut: rectIndex(kept),
    // the pads past the frontier
    openAt: rectIndex(open, 4).at,
    // how far from any pad at all (up to 100 m)
    siteNear: rectIndex(all, 100),
    lane: laneIndex(lanes),
  };
}

// ------------------------------------------------------------------ growing a chunk

// What a chunk grows, kind by kind: instance matrices and tints. A chunk grows into scratch lists
// kept from one chunk to the next (one chunk grows at a time), then keeps copies cut to length,
// with the box its instances stand in and their largest stretch (for the batches' bounds).
const SCRATCH = new Map();
class Out {
  constructor() {
    this.k = {};
  }
  list(kind) {
    let o = this.k[kind];
    if (!o) {
      let sc = SCRATCH.get(kind);
      if (!sc) SCRATCH.set(kind, (sc = { m: new Float32Array(64 * 16), t: new Float32Array(64 * 4) }));
      this.k[kind] = o = { m: sc.m, t: sc.t, n: 0, sc };
    }
    if (o.n * 16 >= o.m.length) {
      const m = new Float32Array(o.m.length * 2);
      m.set(o.m);
      const t = new Float32Array(o.t.length * 2);
      t.set(o.t);
      o.m = o.sc.m = m;
      o.t = o.sc.t = t;
    }
    return o;
  }
  // Each list copied out of the scratch, cut to its length (a chunk keeps what it grew for as long as it stands).
  // The tufts and flowers are shuffled (the same way every time), so any share of them is spread evenly.
  trim() {
    for (const [kind, o] of Object.entries(this.k)) {
      o.m = o.m.slice(0, o.n * 16);
      o.t = o.t.slice(0, o.n * 4);
      o.sc = null;
      if (THIN.has(kind) && o.n > 1) shuffle(o, rngOf(hash3(o.n, Math.round(o.m[12] * 8), Math.round(o.m[14] * 8))));
      const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      let big = 0;
      const m = o.m;
      for (let i = 0; i < o.n; i++) {
        const q = i * 16;
        b[0] = Math.min(b[0], m[q + 12]);
        b[1] = Math.min(b[1], m[q + 13]);
        b[2] = Math.min(b[2], m[q + 14]);
        b[3] = Math.max(b[3], m[q + 12]);
        b[4] = Math.max(b[4], m[q + 13]);
        b[5] = Math.max(b[5], m[q + 14]);
        big = Math.max(big, Math.hypot(m[q], m[q + 1], m[q + 2]), Math.hypot(m[q + 4], m[q + 5], m[q + 6]), Math.hypot(m[q + 8], m[q + 9], m[q + 10]));
      }
      o.box = b;
      o.big = big;
    }
    return this;
  }
}

// The kinds drawn thinner far from the eye (Batch thin), in this many even shares.
const THIN = new Set(["tuft", "flower"]);
const THIN_L = 8;

// A list's instances in a random order (each one's matrix and tint together).
function shuffle(o, r) {
  const M = o.m;
  const T = o.t;
  for (let i = o.n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    if (j === i) continue;
    for (let k = 0; k < 16; k++) {
      const v = M[i * 16 + k];
      M[i * 16 + k] = M[j * 16 + k];
      M[j * 16 + k] = v;
    }
    for (let k = 0; k < 4; k++) {
      const v = T[i * 4 + k];
      T[i * 4 + k] = T[j * 4 + k];
      T[j * 4 + k] = v;
    }
  }
}

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _eul = new THREE.Euler();
const _mat = new THREE.Matrix4();
const _q2 = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _nrm = new THREE.Vector3();

// One instance: at (x, y, z), turned yaw about the vertical, leant (tx about x, tz about z), stretched (sx, sy, sz).
// order "XZY" leans it after the turn (a tree's lean); "YZX" pitches it along its own length first (a wall up a slope).
function put(out, kind, x, y, z, yaw, sx, sy, sz, tx, tz, c, w, order = "XZY") {
  const o = out.list(kind);
  _pos.set(x, y, z);
  _eul.set(tx, yaw, tz, order);
  _quat.setFromEuler(_eul);
  _scl.set(sx, sy, sz);
  _mat.compose(_pos, _quat, _scl);
  o.m.set(_mat.elements, o.n * 16);
  o.t[o.n * 4] = c[0];
  o.t[o.n * 4 + 1] = c[1];
  o.t[o.n * 4 + 2] = c[2];
  o.t[o.n * 4 + 3] = w;
  o.n++;
}

// One instance laid on the ground's slope (gx, gz its gradient, k how much of it) and turned yaw in it.
function putOnSlope(out, kind, x, y, z, yaw, sx, sy, sz, gx, gz, c, w, k = 1) {
  const o = out.list(kind);
  _nrm.set(-gx * k, 1, -gz * k).normalize();
  _q2.setFromUnitVectors(_up, _nrm);
  _eul.set(0, yaw, 0);
  _quat.setFromEuler(_eul).premultiply(_q2);
  _pos.set(x, y, z);
  _scl.set(sx, sy, sz);
  _mat.compose(_pos, _quat, _scl);
  o.m.set(_mat.elements, o.n * 16);
  o.t[o.n * 4] = c[0];
  o.t[o.n * 4 + 1] = c[1];
  o.t[o.n * 4 + 2] = c[2];
  o.t[o.n * 4 + 3] = w;
  o.n++;
}

const SHADE_C = [0, 0, 0];

// A contact shade under something of radius rad (stretched along yaw by sk).
function shade(out, S, x, z, rad, k, yaw = 0, sk = 1) {
  S.at(x, z);
  putOnSlope(out, "decal", x, S.h + 0.05, z, yaw, rad * 2 * sk, 1, rad * 2, S.gx, S.gz, SHADE_C, k);
}

// The colours trees of each kind take here: neighbours alike (a broad noise picks from the list), each a little its own.
// (The conifers' warmth varies half as much as the broadleaf trees', so none turns lime.)
function treeTint(kind, x, z, r) {
  const n = clamp(fbm2(x / 95 + 13.1, z / 95 - 4.4, 2) * 0.5 + 0.5 + (r() - 0.5) * 0.35, 0, 0.999);
  if (kind === "spruce") {
    const warm = r() < 0.05;
    const list = warm ? TONE.spruceWarm : TONE.spruce;
    return jitter(list[Math.floor(n * list.length)], r, 1, 0.5);
  }
  if (kind === "pine") return jitter(TONE.pine[Math.floor(n * TONE.pine.length)], r, 1, 0.5);
  if (kind === "birch") return jitter(r() < 0.07 ? pick(r, TONE.birchGold) : TONE.birch[Math.floor(n * TONE.birch.length)], r);
  if (kind === "broad") return jitter(r() < 0.06 ? pick(r, TONE.autumn) : TONE.broad[Math.floor(n * TONE.broad.length)], r);
  if (kind === "hedge") return jitter(TONE.hedge[Math.floor(n * TONE.hedge.length)], r, 0.8);
  return jitter(TONE.bush[Math.floor(n * TONE.bush.length)], r);
}

// Tree sizes: [height range], the crown's radius as a share of the height.
const TREES = {
  spruce: { h: [9, 19], r: 0.3 },
  pine: { h: [10, 17], r: 0.2 },
  broad: { h: [6.5, 11], r: 0.42 },
  birch: { h: [7, 12], r: 0.18 },
};

// The chunk at (x0, z0), size across: everything it grows.
function growChunk(env, ch) {
  const out = new Out();
  const far = ch.far;
  const S = new Surface(env.ground, ch.x0, ch.z0, ch.size, far ? FAR_STEP : STEP, far ? env.grids.far : env.grids.near);
  const { x0, z0, size } = ch;
  // a quick look at the chunk: all sea, or all far beyond the shore?
  let land = false;
  let coast = false;
  for (let j = 0; j <= 4; j++)
    for (let i = 0; i <= 4; i++) {
      const sd = shoreDist(x0 + (i * size) / 4, z0 + (j * size) / 4);
      if (sd > -2) land = true;
      if (sd > -24 && sd < 30) coast = true;
    }
  let stackNear = false;
  for (const s of STACKS) if (s.x > x0 - 30 && s.x < x0 + size + 30 && s.z > z0 - 30 && s.z < z0 + size + 30) stackNear = true;
  if (!land && !coast && !stackNear) {
    ch.fields = null;
    return out.trim();
  }
  // the woods' thickness on a coarse grid, read between its points
  const FS = far ? 16 : 8;
  const FN = size / FS + 1;
  const FO = new Float32Array(FN * FN);
  for (let j = 0; j < FN; j++) for (let i = 0; i < FN; i++) FO[j * FN + i] = forestAt(x0 + i * FS, z0 + j * FS);
  const forest = (x, z) => {
    const fx = clamp((x - x0) / FS, 0, FN - 1.001);
    const fz = clamp((z - z0) / FS, 0, FN - 1.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const k = j * FN + i;
    return (FO[k] * (1 - u) + FO[k + 1] * u) * (1 - v) + (FO[k + FN] * (1 - u) + FO[k + FN + 1] * u) * v;
  };
  // what every part of the growing shares
  const K = {
    env,
    out,
    S,
    ch,
    far,
    forest,
    look: null,
    inside: (x, z) => x >= x0 && x < x0 + size && z >= z0 && z < z0 + size,
  };
  // the ground's colour, for the grass near the town
  if (!far && Math.hypot(x0 + size / 2, z0 + size / 2) < MEADOW_R + size) K.look = lookGrid(K);
  // a stream of numbers for each part, so one never shifts another's
  treesIn(K, rngOf(hash3(ch.i, ch.j, far ? 7 : 3)));
  if (!far) {
    clustersIn(K);
    sitesIn(K);
    lanesIn(K);
  }
  rocksIn(K, rngOf(hash3(ch.i, ch.j, far ? 17 : 13)));
  if (!far) {
    farmIn(K);
    if (K.look) {
      padsIn(K);
      meadowIn(K, rngOf(hash3(ch.i, ch.j, 23)));
    }
  }
  ch.fields = !far ? fieldSkin(env, S, ch) : null;
  return out.trim();
}

// The ground's colour on a coarse grid over the chunk (as terrain.js paints it), and a reader between its points.
function lookGrid(K) {
  const { S } = K;
  const { x0, z0, size } = K.ch;
  const LS = 8;
  const LN = size / LS + 1;
  const LOOK = new Float32Array(LN * LN * 3);
  for (let j = 0; j < LN; j++)
    for (let i = 0; i < LN; i++) {
      const x = x0 + i * LS;
      const z = z0 + j * LS;
      const h = S.at(x, z);
      LOOK.set(groundLook(x, z, h, 0)[0], (j * LN + i) * 3);
    }
  return (x, z) => {
    const fx = clamp((x - x0) / LS, 0, LN - 1.001);
    const fz = clamp((z - z0) / LS, 0, LN - 1.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const k = (j * LN + i) * 3;
    const o = [0, 0, 0];
    const k2 = k + LN * 3;
    for (let c = 0; c < 3; c++) o[c] = (LOOK[k + c] * (1 - u) + LOOK[k + 3 + c] * u) * (1 - v) + (LOOK[k2 + c] * (1 - u) + LOOK[k2 + 3 + c] * u) * v;
    return o;
  };
}

// Whether a tree with a crown this wide has room at (x, z): off the pads, the pads kept clear, the lanes,
// the plaza, the pier, the rivers, the shore and the fields.
function roomFor(K, x, z, crown) {
  const { env } = K;
  if (env.padOut(x, z) < 4 + crown * 0.6) return false;
  if (env.siteOut(x, z) < 3 + crown * 0.5) return false;
  if (env.lane.dist(x, z) < 3 + crown * 0.55) return false;
  if (rectOut(env.plaza, x, z) < 14 + crown) return false;
  if (pierOut(x, z) < 10) return false;
  const rv = riverAt(x, z);
  if (rv && !rv.past && rv.d - rv.w / 2 < 2 + crown * 0.35) return false;
  if (shoreDist(x, z) < 4 + crown * 0.4) return false;
  if (fieldAt(env.farm, x, z, 4 + crown)) return false;
  return true;
}

// Which spruce: the finer one near the town (where the camera comes close), the plainer one further off,
// and on the far hills the plainest, unless the town is near enough to see it close.
function spruceBatch(K, x, z) {
  if (K.far) return siteBoxOut(x, z) < 300 ? "spruceLo" : "spruceDist";
  return Math.hypot(x, z) < 180 || K.env.siteNear(x, z) < 70 ? "spruce" : "spruceLo";
}

// A tree of a kind, h tall, at (x, z), if the ground there is not too steep (the room is the caller's to find).
// o: { tint, w (its tint's fourth part), lean, windward (a lean away from the sea), wk (how wide), lone (a
// contact shade and grass round its foot) }
function plantTree(K, r, kind, x, z, h, o = {}) {
  const { S, out } = K;
  S.at(x, z);
  if (S.slope > 0.78) return false;
  const lean = o.lean ?? 0.035;
  const tx = (r() - 0.5) * lean * 2 - (o.windward ?? 0);
  const tz = (r() - 0.5) * lean * 2;
  const sink = 0.3 + S.slope * 0.6 + (K.far ? 1 : 0);
  const wk = (o.wk ?? 1) * (0.85 + r() * 0.3);
  const tint = o.tint ?? treeTint(kind, x, z, r);
  const batch = kind === "spruce" ? spruceBatch(K, x, z) : kind;
  put(out, batch, x, S.h - sink, z, r() * Math.PI * 2, h * wk, h, h * wk * (0.9 + r() * 0.2), tx, tz, tint, o.w ?? r());
  if (o.lone && !K.far) {
    const crown = h * TREES[kind].r;
    shade(out, S, x, z, crown * 1.05, 0.5);
    if (K.look) tuftRing(K, r, x, z, Math.max(0.6, h * 0.035), 2 + Math.floor(r() * 3));
  }
  return true;
}

// A bush at (x, z), if there is room for it, with grass round it in the meadow.
// o: { onSite (may stand on a pad kept clear: a thicket), yaw, stretch (along yaw, for a hedge), tint, grass }
function bushAt(K, r, x, z, k, o = {}) {
  const { env, S, out } = K;
  // nothing grows through the harbour's paving, boards and stores
  if (harbourCovers(x, z, 0.6)) return;
  const s = (1.4 + r() * 1.6) * k;
  const tint = o.tint ?? treeTint("bush", x, z, r);
  const yaw = o.yaw ?? r() * 6.28;
  const sx = s * (0.9 + r() * 0.3) * (o.stretch ?? 1);
  const sy = s * (0.7 + r() * 0.4);
  const w = r();
  if (shoreDist(x, z) < 5) return false;
  if (env.padOut(x, z) < 4) return false;
  if (!o.onSite && env.siteOut(x, z) < 2) return false;
  if (env.lane.dist(x, z) < 3) return false;
  if (rectOut(env.plaza, x, z) < 6) return false;
  const rv = riverAt(x, z);
  if (rv && !rv.past && rv.d < rv.w / 2 + 1.6) return false;
  if (fieldAt(env.farm, x, z, 2)) return false;
  S.at(x, z);
  if (S.slope > 0.7) return false;
  putOnSlope(out, "bush", x, S.h - 0.1, z, yaw, sx, sy, s, S.gx, S.gz, tint, w, 0.5);
  shade(out, S, x, z, s * 0.75, 0.45, yaw, o.stretch ?? 1);
  if (K.look && o.grass !== false) tuftRing(K, r, x, z, s * 0.45, 1 + Math.floor(r() * 3));
  return true;
}

// A mound of n bushes about (x, z) that reads as one thicket, k their size.
function bushClump(K, r, x, z, n, k, o = {}) {
  const tint = o.tint ?? treeTint("bush", x, z, r);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = i ? (0.9 + r() * 1.3) * k : 0;
    const t2 = jitter(tint, r, 0.5);
    bushAt(K, r, x + Math.cos(a) * d, z + Math.sin(a) * d, k * (i ? 0.75 + r() * 0.3 : 1.05), { ...o, tint: t2, grass: i === 0 });
  }
}

// Whether grass may grow at (x, z): not on the shore, the sand, a pad, the plaza, a lane, a river, a crop or a steep bank.
function grassOk(K, x, z) {
  const { env, S } = K;
  const sd = shoreDist(x, z);
  if (sd < 6) return false;
  if (env.padOut(x, z) < 0.6) return false;
  if (harbourCovers(x, z, 0.3)) return false;
  if (rectOut(env.plaza, x, z) < 1.5) return false;
  if (env.lane.dist(x, z) < 1.9) return false;
  const rv = riverAt(x, z);
  if (rv && !rv.past && rv.d < rv.w / 2 + 1.6) return false;
  const fd = fieldAt(env.farm, x, z, 0.5);
  if (fd && fd.f.kind !== 4 && cropIn(fd.f, x, z) > -0.3) return false;
  S.at(x, z);
  if (S.slope > 0.45) return false;
  if (S.h < 2.6 && sd < 32) return false;
  return true;
}

// A tuft of grass (or a fern) at (x, z) on the ground S has just read. look: the ground's colour there.
// Each its own height (a third of a metre to a metre) and, in the shader, its own shade of green.
function tuftAt(K, r, x, z, look, k = 1, fern = false) {
  const { S, out } = K;
  const s = (0.8 + r() * 0.6) * k;
  // a fern is the ground's own colour, greener: never a bright fleck on the dark floor of the woods
  const j = 0.92 + r() * 0.16;
  const c = fern ? [look[0] * 0.9 * j, look[1] * 1.12 * j, look[2] * 0.75 * j] : look || TONE.bush[0];
  const tall = 0.55 + r() * r() * 1.0;
  putOnSlope(out, "tuft", x, S.h, z, r() * 6.28, s * (0.9 + r() * 0.4), s * tall, s * (0.9 + r() * 0.4), S.gx, S.gz, c, fern ? 2 + r() * 0.9 : r(), 0.8);
}

// A few tufts round a thing's foot (a tree, a bush, a stone), rad out from its middle.
function tuftRing(K, r, x, z, rad, n) {
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = rad + r() * 1.1;
    const tx = x + Math.cos(a) * d;
    const tz = z + Math.sin(a) * d;
    const k = 0.75 + r() * 0.45;
    if (!K.inside(tx, tz) || Math.hypot(tx, tz) > MEADOW_R || r() > K.env.detail) continue;
    if (!grassOk(K, tx, tz)) continue;
    if (K.forest(tx, tz) > 0.4) continue;
    tuftAt(K, r, tx, tz, K.look(tx, tz), k);
  }
}

// The trees on a jittered grid: the woods, the old groves, the rivers' trees, the cliff tops' pines.
function treesIn(K, r) {
  const { env, ch, far, forest, S } = K;
  const { x0, z0, size } = ch;
  const inCore = (x, z) => x >= CORE.x0 && x < CORE.x1 && z >= CORE.z0 && z < CORE.z1;
  const nT = far ? 8 : 11;
  const cellT = size / nT;
  for (let cj = 0; cj < nT; cj++)
    for (let ci = 0; ci < nT; ci++) {
      const x = x0 + (ci + 0.15 + r() * 0.7) * cellT;
      const z = z0 + (cj + 0.15 + r() * 0.7) * cellT;
      const roll = r();
      const roll2 = r();
      if (far && inCore(x, z)) continue;
      if (Math.hypot(x, z) > FAR_R) continue;
      const sd = shoreDist(x, z);
      if (sd < 6) continue;
      const fo = forest(x, z);
      const rad = Math.hypot(x, z);
      // how likely a tree is here: the woods, a grove, the river's trees
      let p = smooth(0.06, 0.55, fo) * lerp(0.92, 0.74, smooth(0.5, 0.9, fo));
      const grove = smooth(0.12, 0.42, fbm2(x / 64 + 5.3, z / 64 - 3.1, 2)) * smooth(40, 90, rad) * smooth(14, 30, sd);
      p = Math.max(p, grove * 0.42);
      let rv = null;
      let byRiver = 0;
      if (!far) {
        rv = riverAt(x, z);
        if (rv && !rv.past) {
          const edge = rv.d - rv.w / 2;
          if (edge < 2.5) continue;
          byRiver = smooth(2.5, 5, edge) * (1 - smooth(10, 22, edge));
          p = Math.max(p, byRiver * 0.42 * (0.6 + 0.4 * noise2(x / 18, z / 18)));
        }
      }
      // the cliff tops' pines
      const lip = !far && Math.abs(x) > 70 && sd < 45 && cliffTop(x) > 6 ? smooth(6, 14, sd) * (1 - smooth(28, 45, sd)) : 0;
      p = Math.max(p, lip * 0.35 * smooth(-0.3, 0.3, noise2(x / 30 + 4.1, z / 30)));
      // a pad past the frontier grows its own (sitesIn), unless the woods stand there
      if (!far) {
        const open = env.openAt(x, z, 2);
        if (open && siteUse(open).use !== "woods") p = 0;
      }
      if (roll > p * (far ? env.detail : 1)) {
        // no tree: perhaps a few bushes together at the woods' edge or by the water
        if (far) continue;
        const edgeB = smooth(0.04, 0.16, fo) * (1 - smooth(0.3, 0.6, fo));
        const pb = Math.max(edgeB * 0.3, byRiver * 0.2);
        if (roll2 < pb * env.detail) bushClump(K, r, x, z, 2 + Math.floor(r() * 2), 0.9);
        continue;
      }
      // what grows here (few pines deep in the woods: the woods are spruce)
      let kind = "spruce";
      const t = r();
      const town = 1 - smooth(140, 300, rad);
      if (byRiver > 0.3 && fo < 0.5) kind = t < 0.45 ? "birch" : t < 0.8 ? "broad" : "spruce";
      else if (lip > 0.3) kind = t < 0.55 ? "pine" : "spruce";
      else if (fo < 0.3 && rad < 320) kind = t < 0.5 * town + 0.15 ? "broad" : t < 0.62 ? "spruce" : t < 0.8 ? "pine" : "birch";
      else kind = t < 0.87 ? "spruce" : t < 0.92 ? "pine" : t < 0.96 && rad < 400 ? "broad" : "birch";
      if (far) kind = "spruce";
      const T = TREES[kind];
      // smaller at the woods' edge and high up, bigger deep in them
      const deep = smooth(0.3, 0.9, fo);
      let h = lerp(T.h[0], T.h[1], clamp(r() * 0.75 + deep * 0.35, 0, 1));
      S.at(x, z);
      h *= 1 - smooth(70, 125, S.h) * 0.35;
      if (far) h *= 1.2;
      const crown = h * T.r;
      // room: off the pads, the pads kept clear (their edges a little ragged), the lanes, the plaza, the rivers, the shore, the fields
      if (!far) {
        if (env.padOut(x, z) < 4 + crown * 0.6) continue;
        if (env.siteOut(x, z) < 3 + crown * 0.5 + 3 * noise2(x / 9 + 1.7, z / 9 - 3.3)) continue;
        if (env.lane.dist(x, z) < 3 + crown * 0.55) continue;
        if (rectOut(env.plaza, x, z) < 14 + crown) continue;
        if (pierOut(x, z) < 10) continue;
        if (rv && !rv.past && rv.d - rv.w / 2 < 2 + crown * 0.35) continue;
        if (sd < 4 + crown * 0.4) continue;
        if (fieldAt(env.farm, x, z, 4 + crown)) {
          // the woods' edge round a field cut in them: a hedge of bushes
          if (fo > 0.3 && roll2 < 0.4 * env.detail) bushAt(K, r, x, z, 1, { grass: false });
          continue;
        }
      }
      // in the woods the trees stand a little wider, so fewer fill the canopy
      const ok = plantTree(K, r, kind, x, z, h, { lean: 0.035 + lip * 0.07, windward: lip * 0.06, wk: 1 + deep * 0.2, lone: !far && fo < 0.45 });
      // a bush at the foot of some lone ones
      if (ok && !far && fo < 0.5 && r() < 0.22 * env.detail) bushAt(K, r, x + (r() - 0.5) * crown * 1.6, z + (r() - 0.5) * crown * 1.6, 0.8);
    }
}

// Lone trees in the meadows come in little clusters (where a broad noise allows): a big parent tree, three
// to six smaller ones round it, a bush or two at their feet. Each cluster is worked out whole, from its own
// cell's seed, and each chunk keeps the trees that stand in it.
function clustersIn(K) {
  const { ch, env } = K;
  const CL = 46;
  const { x0, z0, size } = ch;
  for (let cj = Math.floor((z0 - 14) / CL); cj <= Math.floor((z0 + size + 14) / CL); cj++)
    for (let ci = Math.floor((x0 - 14) / CL); ci <= Math.floor((x0 + size + 14) / CL); ci++) {
      const r = rngOf(hash3(ci, cj, 515));
      const cx = (ci + 0.2 + r() * 0.6) * CL;
      const cz = (cj + 0.2 + r() * 0.6) * CL;
      const roll = r();
      const rad = Math.hypot(cx, cz);
      if (rad < 75 || rad > 720) continue;
      if (shoreDist(cx, cz) < 18) continue;
      if (forestAt(cx, cz) > 0.35) continue;
      const p = smooth(-0.15, 0.3, fbm2(cx / 150 + 2.7, cz / 150 - 8.1, 2)) * 0.75 + 0.08;
      if (roll > p) continue;
      // a pad past the frontier grows its own; the kept ones turn the trees away one by one
      if (env.openAt(cx, cz, 3)) continue;
      const n = 3 + Math.floor(r() * 5);
      const tp = r();
      const parent = tp < 0.62 ? "broad" : tp < 0.86 ? "spruce" : "birch";
      for (let k = 0; k < n; k++) {
        const a = r() * Math.PI * 2;
        const d = k ? 3.6 + r() * 5.5 : r() * 1.2;
        const tk = r();
        const hk = r();
        const x = cx + Math.cos(a) * d;
        const z = cz + Math.sin(a) * d;
        if (!K.inside(x, z)) continue;
        const kind = k === 0 ? parent : tk < 0.5 ? parent : tk < 0.78 ? "broad" : tk < 0.92 ? "birch" : "spruce";
        const T = TREES[kind];
        const h = k === 0 ? lerp(T.h[1] * 0.85, T.h[1] * 1.08, hk) : lerp(T.h[0] * 0.7, T.h[1] * 0.8, hk);
        const crown = h * T.r;
        if (!roomFor(K, x, z, crown)) continue;
        const rt = rngOf(hash3(ci * 977 + k, cj, 517));
        if (plantTree(K, rt, kind, x, z, h, { lone: true }) && rt() < 0.45 * env.detail) {
          const ba = rt() * Math.PI * 2;
          bushClump(K, rt, x + Math.cos(ba) * crown * 0.8, z + Math.sin(ba) * crown * 0.8, 1 + Math.floor(rt() * 2), 0.8);
        }
      }
    }
}

// The pads: those kept clear in the woods keep a mound or two of the woods' undergrowth till a build comes;
// those past the frontier are the countryside till the town comes.
function sitesIn(K) {
  const { env, ch } = K;
  const { x0, z0, size } = ch;
  const near = (s) => s.x > x0 - 30 && s.x < x0 + size + 30 && s.z > z0 - 30 && s.z < z0 + size + 30;
  for (const s of env.kept) {
    if (!near(s) || forestAt(s.x, s.z) < 0.5) continue;
    const r = rngOf(hash3(s.plot, 29, 3));
    const mounds = 1 + Math.floor(r() * 2.5);
    const c = Math.cos(s.ry);
    const sn = Math.sin(s.ry);
    for (let m = 0; m < mounds; m++) {
      const u = (r() - 0.5) * (s.hw * 2 - 10);
      const v = (r() - 0.5) * (s.hd * 2 - 10);
      const x = s.x + u * c + v * sn;
      const z = s.z - u * sn + v * c;
      const rm = rngOf(hash3(s.plot, m, 31));
      if (K.inside(x, z) && r() < K.env.detail + 0.2) bushClump(K, rm, x, z, 4 + Math.floor(rm() * 5), 1.05, { onSite: true });
    }
  }
  for (const s of env.open) {
    if (!near(s)) continue;
    const U = siteUse(s);
    if (U.use !== "woods") growSite(K, s, U);
  }
}

// A pad past the frontier, grown as what it is till the town comes: hedges along some of its edges (a gap
// for a gate in each), and in it a grove, an orchard in rows, a meadow with one big tree, a copse of birches
// or a hay meadow. Its plan comes from its own seed, whatever chunk asks, and each chunk keeps what stands
// in it. The pads just past the frontier are only hedged meadows, so the town's edge opens gently.
function growSite(K, s, U) {
  const { env } = K;
  const r = rngOf(U.seed);
  const c = Math.cos(s.ry);
  const sn = Math.sin(s.ry);
  const W = (u, v) => [s.x + u * c + v * sn, s.z - u * sn + v * c];
  const use = s.plot <= env.frontier + 3 ? "meadow" : U.use;
  // the hedges: edge 0 the front (v = hd), 1 the right (u = hw), 2 the back, 3 the left
  for (let e = 0; e < 4; e++) {
    if (!U.hedges[e]) continue;
    const re = rngOf(hash3(s.plot, e, 61));
    const half = e % 2 ? s.hd : s.hw;
    const L = 2 * half - 3;
    const n = Math.floor(L / 2.9);
    const gate = Math.floor(re() * (n - 1));
    const inset = 1.7;
    const yaw = s.ry + (e % 2 ? Math.PI / 2 : 0);
    const tint = treeTint("hedge", s.x, s.z, re);
    for (let k = 0; k < n; k++) {
      const t = -L / 2 + (k + 0.5) * (L / n) + (re() - 0.5) * 0.5;
      const roll = re();
      if (k === gate || k === gate + 1) continue;
      const [u, v] = e === 0 ? [t, s.hd - inset] : e === 1 ? [s.hw - inset, t] : e === 2 ? [t, -s.hd + inset] : [-s.hw + inset, t];
      const [x, z] = W(u, v);
      if (!K.inside(x, z)) continue;
      const rb = rngOf(hash3(s.plot * 7 + e, k, 63));
      if (roll < 0.09) {
        // now and then a tree grown up out of the hedge
        const kind = rb() < 0.7 ? "broad" : "birch";
        const h = lerp(TREES[kind].h[0] * 0.8, TREES[kind].h[1] * 0.85, rb());
        if (roomFor(K, x, z, h * TREES[kind].r)) plantTree(K, rb, kind, x, z, h, { lone: true });
      } else if (rb() < env.detail + 0.15) bushAt(K, rb, x, z, 1.18, { yaw, stretch: 1.5, tint: jitter(tint, rb, 0.4) });
    }
  }
  // what stands inside
  const items = [];
  const tree = (kind, u, v, h, o = {}) => items.push({ kind, u, v, h, o });
  if (use === "grove") {
    const gu = (r() - 0.5) * (s.hw * 2 - 18);
    const gv = (r() - 0.5) * (s.hd * 2 - 18);
    const pk = r() < 0.7 ? "broad" : "spruce";
    tree(pk, gu, gv, pk === "broad" ? 9.5 + r() * 2.5 : 14 + r() * 4);
    const n = 5 + Math.floor(r() * 6);
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2;
      const d = 3.8 + r() * 6.5;
      const t = r();
      const kind = t < 0.55 ? "broad" : t < 0.8 ? "birch" : "spruce";
      tree(kind, gu + Math.cos(a) * d, gv + Math.sin(a) * d, lerp(TREES[kind].h[0] * 0.75, TREES[kind].h[1] * 0.85, r()));
    }
    for (let k = 0; k < 3; k++) {
      const a = r() * Math.PI * 2;
      items.push({ kind: "bush", u: gu + Math.cos(a) * (2 + r() * 6), v: gv + Math.sin(a) * (2 + r() * 6), n: 2 + Math.floor(r() * 3) });
    }
  } else if (use === "orchard") {
    // fruit trees in rows of four, a few gaps where one has died
    const tone = pick(r, TONE.orchard);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const gap = r() < 0.12;
        const ju = (r() - 0.5) * 0.8;
        const jv = (r() - 0.5) * 0.8;
        const h = 4.2 + r() * 1.5;
        if (!gap) tree("broad", (i - 1.5) * 7 + ju, (j - 1.5) * 7 + jv, h, { tint: tone, w: 2 + r() * 0.98, fruit: true });
      }
  } else if (use === "meadow") {
    if (r() < 0.65) {
      const t = r();
      const kind = t < 0.7 ? "broad" : t < 0.85 ? "spruce" : "birch";
      tree(
        kind,
        (r() < 0.5 ? -1 : 1) * (s.hw - 8 - r() * 4),
        (r() < 0.5 ? -1 : 1) * (s.hd - 8 - r() * 4),
        lerp(TREES[kind].h[1] * 0.9, TREES[kind].h[1] * 1.1, r()),
      );
    }
    if (r() < 0.5) items.push({ kind: "bush", u: (r() - 0.5) * 20, v: (r() - 0.5) * 20, n: 2 + Math.floor(r() * 3) });
  } else if (use === "copse") {
    const gu = (r() - 0.5) * (s.hw * 2 - 16);
    const gv = (r() - 0.5) * (s.hd * 2 - 16);
    const n = 4 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2;
      const d = k ? 2.5 + r() * 5 : 0;
      const kind = r() < 0.82 ? "birch" : "spruce";
      tree(kind, gu + Math.cos(a) * d, gv + Math.sin(a) * d, lerp(TREES[kind].h[0], TREES[kind].h[1] * 0.9, r()));
    }
    items.push({ kind: "bush", u: gu + 4, v: gv - 3, n: 2 });
  } else if (use === "hay") {
    const n = 1 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) items.push({ kind: "hay", u: (r() - 0.5) * 16, v: (r() - 0.5) * 16, s: 0.75 + r() * 0.3, yaw: r() * 6.28 });
  }
  items.forEach((it, k) => {
    const [x, z] = W(it.u, it.v);
    if (!K.inside(x, z)) return;
    const ri = rngOf(hash3(s.plot, k, 71));
    if (it.kind === "bush") {
      if (ri() < env.detail + 0.1) bushClump(K, ri, x, z, it.n, 0.9);
      return;
    }
    if (it.kind === "hay") {
      if (!roomFor(K, x, z, 2)) return;
      K.S.at(x, z);
      const sy = it.s * (0.9 + ri() * 0.2);
      put(K.out, "hay", x, K.S.h - 0.1, z, it.yaw, it.s, sy, it.s, (ri() - 0.5) * 0.05, (ri() - 0.5) * 0.05, jitter(pick(ri, TONE.hay), ri, 0.7), ri());
      shade(K.out, K.S, x, z, 2.2 * it.s, 0.55);
      if (K.look) tuftRing(K, ri, x, z, 1.8 * it.s, 4);
      return;
    }
    const crown = it.h * TREES[it.kind].r;
    if (!roomFor(K, x, z, crown)) return;
    plantTree(K, ri, it.kind, x, z, it.h, { tint: it.o.tint ? jitter(it.o.tint, ri, 0.7) : undefined, w: it.o.w, lone: true });
  });
}

// Bushes along the lanes, and now and then a tree (each lane's own seed).
function lanesIn(K) {
  const { env, ch } = K;
  const { x0, z0, size } = ch;
  for (const [ax, az, bx, bz] of env.lane.segs) {
    if (Math.max(ax, bx) < x0 - 10 || Math.min(ax, bx) > x0 + size + 10 || Math.max(az, bz) < z0 - 10 || Math.min(az, bz) > z0 + size + 10) continue;
    const r = rngOf(hash3(Math.round(ax * 10), Math.round(az * 10), Math.round(bx * 10 + bz * 7)));
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.floor(L / 7);
    for (let s = 0; s < n; s++) {
      const t = (s + r()) / n;
      const side = r() < 0.5 ? -1 : 1;
      const off = 4 + r() * 3.5;
      const x = lerp(ax, bx, t) + (-(bz - az) / L) * off * side;
      const z = lerp(az, bz, t) + ((bx - ax) / L) * off * side;
      if (!K.inside(x, z)) continue;
      const roll = r();
      // a mound of bushes (never a lone one) or a tree by the lane
      if (roll < 0.3) {
        if (roll < 0.14 * env.detail) bushClump(K, r, x, z, 3 + Math.floor(r() * 3), 0.85);
      } else if (roll < 0.4) {
        const tx = x + (-(bz - az) / L) * side * 3;
        const tz = z + ((bx - ax) / L) * side * 3;
        const kind = r() < 0.7 ? "broad" : "birch";
        const h = lerp(TREES[kind].h[0], TREES[kind].h[1], r());
        if (shoreDist(tx, tz) > 12 && roomFor(K, tx, tz, h * TREES[kind].r)) plantTree(K, r, kind, tx, tz, h, { lone: true });
      }
    }
  }
}

// How high a stone's top stands over its foot, as a share of its height: [rounded, blocky].
const ROCK_TOP = [0.6, 0.52];
// and how high its widest is
const ROCK_MID = [0.18, 0.12];

// A stone into the batches: the rounded or the blocky kind, those over a metre and a half among the
// boulders that cast the sun's shadow, the smaller ones not (their contact shade is enough).
function putRock(out, blocky, x, y, z, yaw, sx, sy, sz, gx, gz, tint, moss, tilt) {
  if (harbourCovers(x, z, 0.5 + Math.max(sx, sz) * 0.5)) return;
  const big = Math.max(sx, sy, sz) >= 1.5;
  const kind = big ? (blocky ? "boulderB" : "boulderA") : blocky ? "rockB" : "rockA";
  putOnSlope(out, kind, x, y, z, yaw, sx, sy, sz, gx, gz, tint, moss, tilt);
}

// The stones a chunk has: on the cliff tops and heaped at their feet in the surf, by the rivers and under
// the falls, up the mountains, round the stacks. Nothing in the sea is left with its top under the water.
function rocksIn(K, r) {
  const { env, out, S, ch, far, forest } = K;
  const { x0, z0, size } = ch;
  const rockTint = (rr) => jitter(pick(rr, TONE.rock), rr, 0.8);
  // a stone of size s at (x, z), if there is room; its top kept clear of the sea
  const place = (x, z, s, opts = {}) => {
    S.at(x, z);
    // nothing stuck to a cliff's face
    if (S.slope > 1.2) return false;
    if (!far) {
      if (env.padOut(x, z) < 4 + s) return false;
      if (env.siteOut(x, z) < 2 + s * 0.5) return false;
      if (env.lane.dist(x, z) < 2.5 + s * 0.5) return false;
      if (rectOut(env.plaza, x, z) < 8) return false;
      if (fieldAt(env.farm, x, z, 1 + s)) return false;
    }
    const blocky = r() < 0.45;
    const sy = s * (0.55 + r() * 0.5) * (opts.flat ?? 1);
    const y = S.h - sy * (opts.sink ?? 0.18);
    if (y + sy * ROCK_TOP[blocky ? 1 : 0] < 0.35) return false;
    const moss = opts.moss ?? clamp(0.25 + forest(x, z) * 0.8 + r() * 0.3, 0, 1);
    putRock(out, blocky, x, y, z, r() * 6.28, s * (0.8 + r() * 0.5), sy, s * (0.8 + r() * 0.4), S.gx, S.gz, rockTint(r), moss, opts.tilt ?? 0.6);
    if (!far && opts.shade !== false && y > 0.5) shade(out, S, x, z, s * 0.8, 0.5);
    return true;
  };
  // a stone of size s in the sea or the surf, its top at least `top` out of the water
  const surf = (rr, x, z, s, sink, top = 0.6) => {
    S.at(x, z);
    if (S.h > 3.4 || S.h < -4.5 || S.slope > 1.6) return 0;
    const blocky = rr() < 0.35;
    const tk = ROCK_TOP[blocky ? 1 : 0];
    const sy = s * (0.75 + rr() * 0.35);
    // stood on the bed where the water is shallow; where it is deep, hung with its widest a little above the
    // water line, so its sides drop steeply in (no broad pale shelf of rock just under the surface) and its foot
    // is lost in the deep
    const y = Math.max(S.h - sy * sink, -ROCK_MID[blocky ? 1 : 0] * sy + (rr() - 0.3) * 0.3);
    if (y + sy * tk < top) return 0;
    putRock(out, blocky, x, y, z, rr() * 6.28, s * (1.0 + rr() * 0.4), sy, s * (0.9 + rr() * 0.35), S.gx, S.gz, rockTint(rr), 0, 0.25);
    return sy;
  };
  if (!far) {
    // the feet of the cliffs: big boulders tumbled into the surf, each heaped round with smaller ones, more
    // at the headlands' points, the cove's horns and under the falls
    for (let x = x0 + r() * 3; x < x0 + size; x += 2.6 + r() * 3.6) {
      const ct = cliffTop(x);
      const roll = r();
      const d = -2 + r() * r() * 7;
      const sz = 3 + r() * r() * 5;
      const heap = 3 + Math.floor(r() * 4);
      const rh = rngOf(hash3(Math.round(x * 10), 7, 41));
      if (ct < 4 || Math.abs(x) < 36) continue;
      const point = smooth(2, 12, coastZ(x) - (coastZ(x - 40) + coastZ(x + 40)) / 2);
      const horn = smooth(0, 1, 1 - Math.abs(Math.abs(x) - 70) / 30);
      let fall = 0;
      for (const rv of RIVERS) fall = Math.max(fall, 1 - smooth(10, 40, Math.abs(x - rv.fall.x)));
      const gaps = 0.45 + 0.55 * smooth(-0.3, 0.3, noise2(x / 17 + 3.3, 0.5));
      const p = (0.5 + 0.35 * point + 0.35 * horn + 0.6 * fall) * smooth(4, 9, ct) * gaps;
      if (roll > p) continue;
      const sl = (coastZ(x + 1) - coastZ(x - 1)) / 2;
      const L = Math.hypot(sl, 1);
      const bx = x - (sl / L) * d;
      const bz = coastZ(x) + d / L;
      if (!K.inside(bx, bz)) continue;
      const sy = surf(rh, bx, bz, sz, 0.12, Math.max(0.9, sz * 0.38));
      if (!sy) continue;
      for (let k = 0; k < heap; k++) {
        const a = rh() * Math.PI * 2;
        const dd = sy * (0.55 + rh() * 0.6);
        surf(rh, bx + Math.cos(a) * dd, bz + Math.sin(a) * dd, sy * (0.28 + rh() * 0.32), 0.15, 0.35);
      }
    }
    // scree under the highest cliffs: an apron of fallen stones along their foot, half in the water
    for (let x = x0 + r() * 2; x < x0 + size; x += 1.8 + r() * 2.4) {
      const ct = cliffTop(x);
      const roll = r();
      const d = -2 + r() * 4.5;
      const s = 1.1 + r() * r() * 2.4;
      const rh = rngOf(hash3(Math.round(x * 10), 9, 43));
      if (roll > smooth(16, 28, ct) * 0.75) continue;
      const sl = (coastZ(x + 1) - coastZ(x - 1)) / 2;
      const L = Math.hypot(sl, 1);
      const bx = x - (sl / L) * d;
      const bz = coastZ(x) + d / L;
      if (K.inside(bx, bz)) surf(rh, bx, bz, s, 0.18, 0.35);
    }
  }
  // a jittered grid over the chunk, each point tried for what it suits
  const cell = far ? 14 : 6;
  const n = size / cell;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = x0 + (i + r()) * cell;
      const z = z0 + (j + r()) * cell;
      const roll = r();
      if (far && x >= CORE.x0 && x < CORE.x1 && z >= CORE.z0 && z < CORE.z1) continue;
      if (Math.hypot(x, z) > FAR_R) continue;
      const sd = shoreDist(x, z);
      if (sd < 4) continue;
      const ct = cliffTop(x);
      S.at(x, z);
      const slope = S.slope;
      const h = S.h;
      // never on the beach, nor on a cliff's face
      if (h < 2.8 && sd < 34) continue;
      if (slope > 1.2) continue;
      // the cliff tops: lone stones and little heaps along the lip
      let p = 0;
      if (!far && ct > 6 && sd < 26 && Math.abs(x) > 60) p = 0.14 * (1 - smooth(14, 26, sd));
      // steep ground and the mountains
      p = Math.max(p, smooth(0.45, 0.9, slope) * (far ? 0.06 : 0.16), smooth(60, 110, h) * (far ? 0.018 : 0.06));
      // the odd boulder left in the meadows
      p = Math.max(p, 0.012 * smooth(50, 90, Math.hypot(x, z)));
      if (roll > p * (far ? env.detail : 1)) continue;
      const big = smooth(60, 120, h) + smooth(0.5, 1.0, slope) * 0.6;
      const s = (0.8 + r() * r() * 2.6) * (1 + big * 1.4) * (far ? 1.9 : 1);
      if (!place(x, z, s, { sink: 0.22 + slope * 0.2 })) continue;
      // a few smaller ones round it, grass at its foot, and sometimes a bush
      const m = Math.floor(r() * 3);
      for (let k = 0; k < m; k++) place(x + (r() - 0.5) * s * 2.6, z + (r() - 0.5) * s * 2.6, s * (0.3 + r() * 0.35), { sink: 0.25 });
      if (K.look) tuftRing(K, r, x, z, s * 0.55, 2 + Math.floor(r() * 3));
      if (!far && r() < 0.35 * env.detail && h < 90) bushAt(K, r, x + (r() - 0.5) * s * 2.2, z + (r() - 0.5) * s * 2.2, 0.8);
    }
  if (far) return;
  // the river banks: stones at the water's edge, some in it
  for (const rv of RIVERS) {
    const smp = rv.samples;
    for (let i = 0; i < smp.length; i += 1) {
      const sp = smp[i];
      if (sp.x < x0 - 8 || sp.x >= x0 + size + 8 || sp.z < z0 - 8 || sp.z >= z0 + size + 8) continue;
      const nx = smp[Math.min(i + 1, smp.length - 1)].x - smp[Math.max(i - 1, 0)].x;
      const nz = smp[Math.min(i + 1, smp.length - 1)].z - smp[Math.max(i - 1, 0)].z;
      const L = Math.hypot(nx, nz) || 1;
      for (const side of [-1, 1]) {
        if (r() > 0.42) continue;
        const off = sp.w / 2 + (r() - 0.35) * 2.2;
        const x = sp.x + (-nz / L) * off * side;
        const z = sp.z + (nx / L) * off * side;
        if (!K.inside(x, z)) continue;
        const s = 0.5 + r() * r() * 1.6;
        place(x, z, s, { sink: 0.3, moss: 0.35 + r() * 0.4, tilt: 0.5, shade: false });
      }
    }
    // boulders heaped round the foot of the fall, in the surf, and flanking its lip
    const f = rv.fall;
    if (f.x > x0 - 30 && f.x < x0 + size + 30 && f.z > z0 - 50 && f.z < z0 + size + 50) {
      const rr = rngOf(hash3(Math.round(f.x), Math.round(f.z), 99));
      for (let k = 0; k < 26; k++) {
        const along = 2 + rr() * 22;
        const across = (rr() < 0.5 ? -1 : 1) * (f.w / 2 + 1 + rr() * 12);
        const s = 1.6 + rr() * rr() * 4.2;
        const rk = rngOf(hash3(Math.round(f.x), k, 101));
        const x = f.x + f.dx * along - f.dz * across;
        const z = f.z + f.dz * along + f.dx * across;
        if (K.inside(x, z)) surf(rk, x, z, s, 0.14, 0.5 + rk() * 0.9);
      }
      for (const side of [-1, 1]) {
        const x = f.x - f.dx * 3 - f.dz * side * (f.w / 2 + 2.2);
        const z = f.z - f.dz * 3 + f.dx * side * (f.w / 2 + 2.2);
        if (K.inside(x, z)) place(x, z, 2.2 + rr() * 1.2, { sink: 0.35, moss: 0.6, tilt: 0.4 });
      }
    }
  }
  // the sea stacks' feet
  for (const st of STACKS) {
    if (st.x < x0 - 20 || st.x >= x0 + size + 20 || st.z < z0 - 20 || st.z >= z0 + size + 20) continue;
    const rr = rngOf(hash3(Math.round(st.x), Math.round(st.z), 5));
    const n = Math.round(st.r * 1.4);
    for (let k = 0; k < n; k++) {
      const a = rr() * Math.PI * 2;
      const d = st.r * (0.95 + rr() * 0.6);
      const s = 1.4 + rr() * 2.4;
      const rk = rngOf(hash3(Math.round(st.x), k, 7));
      const x = st.x + Math.cos(a) * d;
      const z = st.z + Math.sin(a) * d;
      if (K.inside(x, z)) surf(rk, x, z, s, 0.14, 0.5 + rk() * 0.7);
    }
  }
}

// The meadows: tufts of grass in clumps, thick near the town and thinning out, ferns in the woods, drifts of wildflowers.
function meadowIn(K, r) {
  const { env, ch, forest, look } = K;
  const { x0, z0, size } = ch;
  const cell = 1.8;
  const n = Math.round(size / cell);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = x0 + (i + r()) * cell;
      const z = z0 + (j + r()) * cell;
      const roll = r();
      const many = r();
      const rad = Math.hypot(x, z);
      if (rad > MEADOW_R) continue;
      const fo = forest(x, z);
      const clumps = smooth(-0.35, 0.45, fbm2(x / 13 + 2.2, z / 13 - 7.1, 2));
      let p = lerp(0.8, 0.05, smooth(100, 330, rad)) * (0.3 + 0.7 * clumps);
      // ferns in clumps under the trees; a pad cleared in the woods keeps only a little grass
      const wood = fo > 0.4;
      const fern = wood && env.siteOut(x, z) > 6;
      if (wood) p = fern ? 0.45 * smooth(0.4, 0.7, fo) * clumps * clumps : 0.3 * clumps;
      if (roll > p * env.detail) continue;
      if (!grassOk(K, x, z)) continue;
      const c = look(x, z);
      tuftAt(K, r, x, z, c, fern ? 1.5 : 1, fern);
      // most come two or three together
      const more = fern ? 0 : many < 0.5 ? 0 : many < 0.88 ? 1 : 2;
      for (let k = 0; k < more; k++) {
        const a = r() * Math.PI * 2;
        const d = 0.45 + r() * 0.5;
        const tx = x + Math.cos(a) * d;
        const tz = z + Math.sin(a) * d;
        if (K.inside(tx, tz) && grassOk(K, tx, tz)) tuftAt(K, r, tx, tz, c, 0.8 + r() * 0.3);
      }
    }
  // a fringe of tufts along the lanes' edges, where the grass meets the worn earth
  for (const [ax, az, bx, bz] of env.lane.segs) {
    if (Math.max(ax, bx) < x0 - 4 || Math.min(ax, bx) > x0 + size + 4 || Math.max(az, bz) < z0 - 4 || Math.min(az, bz) > z0 + size + 4) continue;
    const L = Math.hypot(bx - ax, bz - az);
    const rr = rngOf(hash3(Math.round(ax * 10), Math.round(bz * 10), 61));
    const m = Math.floor(L / 1.0);
    for (let k = 0; k < m; k++) {
      const t = (k + rr()) / m;
      const side = rr() < 0.5 ? -1 : 1;
      const off = 2.0 + rr() * 1.2;
      const x = lerp(ax, bx, t) + (-(bz - az) / L) * off * side;
      const z = lerp(az, bz, t) + ((bx - ax) / L) * off * side;
      if (rr() > 0.75 * env.detail || !K.inside(x, z)) continue;
      if (!grassOk(K, x, z)) continue;
      tuftAt(K, rr, x, z, look(x, z), 0.9 + rr() * 0.3);
    }
  }
  // wildflowers in drifts, each drift mostly one colour (more in the meadows past the frontier)
  const fc = 2.9;
  const fnn = Math.round(size / fc);
  const F = TONE.flower;
  for (let j = 0; j < fnn; j++)
    for (let i = 0; i < fnn; i++) {
      const x = x0 + (i + r()) * fc;
      const z = z0 + (j + r()) * fc;
      const roll = r();
      const rad = Math.hypot(x, z);
      if (rad > MEADOW_R) continue;
      const drift = smooth(0.12, 0.42, fbm2(x / 26 - 9.2, z / 26 + 4.4, 2));
      const open = env.openAt(x, z, 0);
      const boost = open && siteUse(open).use === "meadow" ? 1.6 : 1;
      const p = (drift * lerp(0.6, 0.16, smooth(80, MEADOW_R, rad)) + 0.03) * boost;
      if (roll > p * env.detail) continue;
      if (forest(x, z) > 0.3) continue;
      if (!grassOk(K, x, z)) continue;
      const hue = fbm2(x / 40 + 3.3, z / 40 + 8.8, 2) + (r() - 0.5) * 0.35;
      let c;
      let eye = 1;
      if (hue < -0.18) c = F.yellow;
      else if (hue < 0.14) c = r() < 0.85 ? F.white : F.cream;
      else if (hue < 0.26) c = r() < 0.6 ? F.purple : F.blue;
      else if (hue < 0.34) c = F.pink;
      else if (r() < 0.5) c = F.white;
      else {
        c = F.red;
        eye = 0;
      }
      if (c === F.purple || c === F.blue || c === F.pink) eye = r() < 0.5 ? 1 : 0;
      const s = 0.85 + r() * 0.5;
      putOnSlope(K.out, "flower", x, K.S.h, z, r() * 6.28, s, s * (0.85 + r() * 0.35), s, K.S.gx, K.S.gz, jitter(c, r, 0.4), eye, 0.7);
    }
}

// Grass grown up round the levelled pads' edges, so each build sits wrapped in it.
function padsIn(K) {
  const { env, ch } = K;
  const { x0, z0, size } = ch;
  for (const p of env.ground.pads) {
    if (p.plaza || p.x < x0 - 30 || p.x > x0 + size + 30 || p.z < z0 - 30 || p.z > z0 + size + 30) continue;
    const r = rngOf(hash3(Math.round(p.x * 10), Math.round(p.z * 10), 81));
    const c = Math.cos(p.ry);
    const sn = Math.sin(p.ry);
    for (let e = 0; e < 4; e++) {
      const half = e % 2 ? p.hd : p.hw;
      const n = Math.floor((2 * half) / 1.15);
      for (let k = 0; k < n; k++) {
        const t = -half + (k + r()) * ((2 * half) / n);
        const out = 0.7 + r() * r() * 2.6;
        const roll = r();
        const [u, v] = e === 0 ? [t, p.hd + out] : e === 1 ? [p.hw + out, t] : e === 2 ? [t, -p.hd - out] : [-p.hw - out, t];
        const x = p.x + u * c + v * sn;
        const z = p.z - u * sn + v * c;
        if (roll > 0.8 * env.detail || !K.inside(x, z)) continue;
        if (!grassOk(K, x, z) || K.forest(x, z) > 0.4) continue;
        tuftAt(K, r, x, z, K.look(x, z), 0.85 + r() * 0.35);
      }
    }
  }
}

// The farmland in a chunk: its dry-stone walls and fences (the pieces overlapping, so a wall runs on
// unbroken), a fringe of grass and weeds along them, the hay stacks, and standing wheat at the edges
// of the wheat fields (and all through those near the town).
function farmIn(K) {
  const { env, out, S, ch } = K;
  const fe = env.farm.byChunk.get(`${ch.i},${ch.j}`);
  if (fe) {
    for (const w of fe.walls) {
      const rr = rngOf(w.seed);
      const ha = S.at(w.x0, w.z0);
      const hb = S.at(w.x1, w.z1);
      const mx = (w.x0 + w.x1) / 2;
      const mz = (w.z0 + w.z1) / 2;
      const hm = S.at(mx, mz);
      const L = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
      const yaw = Math.atan2(-(w.z1 - w.z0), w.x1 - w.x0);
      const pitch = Math.atan2(hb - ha, L);
      const y = Math.min(hm, (ha + hb) / 2) - 0.05;
      // (the wall's height and breadth wander along it in the shader, by where it is, so the pieces agree)
      if (w.stone) put(out, "wall", mx, y, mz, yaw, (L / 2) * 1.18, 0.98, 1, 0, pitch, pick(rr, TONE.wall), rr(), "YZX");
      else put(out, "fence", mx, y, mz, yaw, L / 2.6, 1, 1, 0, pitch * 0.9, jitter(pick(rr, TONE.wood), rr, 0.6), rr(), "YZX");
      // tufts and weeds grown up against the wall's foot on both sides
      if (!K.look) continue;
      for (let k = 0; k < 5; k++) {
        const t = rr();
        const side = rr() < 0.5 ? -1 : 1;
        const off = (w.stone ? 0.45 : 0.15) + rr() * 1.1;
        const roll = rr();
        const sx = lerp(w.x0, w.x1, t) + (-(w.z1 - w.z0) / L) * side * off;
        const sz = lerp(w.z0, w.z1, t) + ((w.x1 - w.x0) / L) * side * off;
        if (roll > 0.8 * env.detail || !K.inside(sx, sz)) continue;
        S.at(sx, sz);
        if (S.slope > 0.6) continue;
        if (roll < 0.06) {
          const yaw = rr() * 6.28;
          putOnSlope(out, "flower", sx, S.h, sz, yaw, 0.7, 0.9, 0.7, S.gx, S.gz, jitter(rr() < 0.6 ? TONE.flower.white : TONE.flower.yellow, rr, 0.4), 1, 0.7);
          continue;
        }
        tuftAt(K, rr, sx, sz, K.look(sx, sz), 1.0 + rr() * 0.3);
      }
    }
    for (const hk of fe.hay) {
      const rr = rngOf(hk.seed);
      S.at(hk.x, hk.z);
      const sy = hk.s * (0.9 + rr() * 0.2);
      put(out, "hay", hk.x, S.h - 0.1, hk.z, hk.yaw, hk.s, sy, hk.s, (rr() - 0.5) * 0.05, (rr() - 0.5) * 0.05, jitter(pick(rr, TONE.hay), rr, 0.7), rr());
      shade(out, S, hk.x, hk.z, 2.2 * hk.s, 0.55);
    }
  }
  // standing wheat: a band along the edge of every wheat field, and the whole field near the town,
  // each a gold tuft on a world grid (so a field split by chunks grows the same)
  const { x0, z0, size } = ch;
  const seen = new Set();
  for (const [px, pz] of [[x0, z0], [x0 + size, z0], [x0, z0 + size], [x0 + size, z0 + size], [x0 + size / 2, z0 + size / 2]])
    for (const f of env.farm.near(px, pz)) {
      if (f.kind !== 0 || seen.has(f)) continue;
      seen.add(f);
      const near = Math.hypot(f.ox, f.oz) < 250;
      const C = 0.95;
      const i0 = Math.floor(Math.max(f.box[0], x0) / C);
      const i1 = Math.floor(Math.min(f.box[2], x0 + size - 0.001) / C);
      const j0 = Math.floor(Math.max(f.box[1], z0) / C);
      const j1 = Math.floor(Math.min(f.box[3], z0 + size - 0.001) / C);
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const rr = rngOf(hash3(i, j, 900 + f.n));
          const x = (i + rr()) * C;
          const z = (j + rr()) * C;
          const roll = rr();
          if (!K.inside(x, z)) continue;
          const d = cropIn(f, x, z);
          if (d < 0.15) continue;
          const p = d < 4.5 ? 0.85 : near ? 0.3 : 0;
          if (roll > p * env.detail) continue;
          S.at(x, z);
          const s = 1.0 + rr() * 0.35;
          const tint = jitter(pick(rr, TONE.wheat), rr, 0.5);
          putOnSlope(out, "tuft", x, S.h, z, rr() * 6.28, s, s * (1.1 + rr() * 0.3), s, S.gx, S.gz, tint, 3 + rr() * 0.98, 0.8);
        }
    }
}

// The skin of field over the ground in a chunk: the terrain's own 2 m grid wherever a field reaches, each
// square given to the field it is most inside. Returns { pos, nor, col, fld, ao, idx } or null.
function fieldSkin(env, S, ch) {
  const { x0, z0, size } = ch;
  const farm = env.farm;
  const mine = new Set();
  const probe = [[x0, z0], [x0 + size, z0], [x0, z0 + size], [x0 + size, z0 + size], [x0 + size / 2, z0 + size / 2]];
  for (const [x, z] of probe) for (const f of farm.near(x, z)) mine.add(f);
  if (!mine.size) return null;
  const list = [...mine];
  const n = size / STEP;
  const pos = [];
  const nor = [];
  const col = [];
  const fld = [];
  const ao = [];
  const idx = [];
  const verts = new Map();
  const vert = (f, fi, i, j) => {
    const key = (fi * 40 + i) * 40 + j;
    let v = verts.get(key);
    if (v !== undefined) return v;
    const x = x0 + i * STEP;
    const z = z0 + j * STEP;
    const h = S.node(i, j);
    const gx = (S.node(i + 1, j) - S.node(i - 1, j)) / (2 * STEP);
    const gz = (S.node(i, j + 1) - S.node(i, j - 1)) / (2 * STEP);
    const L = Math.hypot(gx, 1, gz);
    const d = cropIn(f, x, z);
    pos.push(x, h, z);
    nor.push(-gx / L, 1 / L, -gz / L);
    const fine = (S.node(i + 2, j) + S.node(i - 2, j) + S.node(i, j + 2) + S.node(i, j - 2)) / 4 - h;
    const c = d < 2.4 ? groundLook(x, z, h, fine)[0] : [0.2, 0.25, 0.1];
    col.push(c[0], c[1], c[2]);
    // the field's own frame: along its rows (u) and across them (v), the rows bent a little with the ground's contours
    const dx = x - f.ox;
    const dz = z - f.oz;
    const u = dx * f.ux + dz * f.uz;
    const vv = -dx * f.uz + dz * f.ux + (h - f.hc) * 1.8 + 2.4 * noise2(u / 42 + f.i * 1.7, f.j * 2.3 + 0.5);
    fld.push(u, vv, f.kind, d);
    ao.push(clamp(1 - fine * 0.09, 0.5, 1.12));
    v = pos.length / 3 - 1;
    verts.set(key, v);
    return v;
  };
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const cx = x0 + (i + 0.5) * STEP;
      const cz = z0 + (j + 0.5) * STEP;
      let best = null;
      let bi = -1;
      list.forEach((f, fi) => {
        if (f.kind === 4) return;
        const d = polyIn(f.poly, cx, cz);
        if (d > -2.2 && (!best || d > best.d)) {
          best = { f, d };
          bi = fi;
        }
      });
      if (!best) continue;
      const a = vert(best.f, bi, i, j);
      const b = vert(best.f, bi, i + 1, j);
      const c = vert(best.f, bi, i, j + 1);
      const d = vert(best.f, bi, i + 1, j + 1);
      const ha = S.node(i, j);
      const hb = S.node(i + 1, j);
      const hc = S.node(i, j + 1);
      const hd = S.node(i + 1, j + 1);
      if (Math.abs(ha - hd) < Math.abs(hb - hc)) idx.push(a, c, d, a, d, b);
      else idx.push(a, c, b, b, c, d);
    }
  if (!idx.length) return null;
  return { pos, nor, col, fld, ao, idx };
}

// ------------------------------------------------------------------ the batches

// The region a chunk's things are drawn with, for the kinds split by region: the west headland, the valley
// and the east headland (split near the rivers), each north and south of z = -256; then the far hills west,
// east and north. What is out of the camera's sight, or outside the sun's shadow, is then not drawn.
function regionOf(ch) {
  const x = ch.x0 + ch.size / 2;
  const z = ch.z0 + ch.size / 2;
  if (ch.far) return x < CORE.x0 ? 6 : x >= CORE.x1 ? 7 : 8;
  return (z < -256 ? 0 : 3) + (x < -128 ? 0 : x < 192 ? 1 : 2);
}

// One kind of thing: an InstancedMesh its chunks' instances are gathered into, or for a kind split by
// region one for each region that has enough of them (the rest share one), each with true bounds so the
// camera and the sun's shadow pass it by when it is out of their sight.
class Batch {
  constructor(group, name, geo, material, { cast = false, receive = true, split = false, fade = 0, thin = null } = {}) {
    this.group = group;
    // (the kinds that shrink away far from the eye: past this, a part out of reach is not drawn at all)
    this.fade = fade;
    // (and drawn thinner as a part gets farther: [near, far, least share]; the instances are laid in THIN_L
    // even shares, each spread over the whole part, and as many shares are drawn as the distance allows)
    this.thin = thin;
    this.name = name;
    this.geo = geo;
    this.material = material;
    this.cast = cast;
    this.receive = receive;
    this.split = split;
    this.parts = new Map();
    this.count = 0;
    geo.computeBoundingSphere();
    this.reach = geo.boundingSphere.radius + geo.boundingSphere.center.length();
  }
  make(cap) {
    const g = this.geo.clone();
    g.setAttribute("aTint", new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4));
    const m = new THREE.InstancedMesh(g, this.material, cap);
    m.name = "dress-" + this.name;
    // (an InstancedMesh is drawn whatever the camera sees unless told otherwise; its bounds are set in fill())
    m.frustumCulled = true;
    m.castShadow = this.cast;
    m.receiveShadow = this.receive;
    m.matrixAutoUpdate = false;
    this.group.add(m);
    const p = { mesh: m, cap, o: 0, box: null, layers: new Int32Array(THIN_L) };
    if (this.fade) {
      const fade = this.fade;
      const thin = this.thin;
      m.onBeforeRender = (renderer, scene, camera) => {
        const b = m.geometry.boundingSphere;
        if (!b) return;
        const d = camera.position.distanceTo(b.center);
        if (d - b.radius > fade) m.count = 0;
        else if (!thin) m.count = p.o;
        else {
          // how far the middle of the part is (its near half counts as here)
          const k = lerp(1, thin[2], smooth(thin[0], thin[1], d - b.radius * 0.5));
          m.count = p.layers[clamp(Math.ceil(k * THIN_L) - 1, 0, THIN_L - 1)];
        }
      };
    }
    return p;
  }
  drop(p) {
    this.group.remove(p.mesh);
    p.mesh.geometry.dispose();
  }
  fill(chunks) {
    // how many each region has
    const per = new Map();
    let total = 0;
    for (const c of chunks) {
      const n = c.out?.k[this.name]?.n || 0;
      if (!n) continue;
      const reg = this.split ? c.region : 0;
      per.set(reg, (per.get(reg) || 0) + n);
      total += n;
    }
    // a region with few of them shares a mesh with the others like it (never with a big one: a bigger part is
    // culled less often, which costs more than the draw call it saves)
    const minN = Math.max(150, total * 0.08);
    const keyOf = (reg) => (!this.split ? "all" : per.get(reg) >= minN ? "r" + reg : "rest");
    const want = new Map();
    for (const [reg, n] of per) want.set(keyOf(reg), (want.get(keyOf(reg)) || 0) + n);
    for (const [k, p] of this.parts)
      if (!want.has(k)) {
        this.drop(p);
        this.parts.delete(k);
      }
    for (const [k, n] of want) {
      let p = this.parts.get(k);
      if (!p || n > p.cap) {
        if (p) this.drop(p);
        p = this.make(Math.max(16, Math.ceil(n * 1.12)));
        this.parts.set(k, p);
      }
      p.o = 0;
      p.box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    }
    // (a kind drawn thinner far off is laid in even shares: the first share of every chunk, then the second...)
    const L = this.thin ? THIN_L : 1;
    for (let l = 0; l < L; l++) {
      for (const c of chunks) {
        const e = c.out?.k[this.name];
        if (!e || !e.n) continue;
        const p = this.parts.get(keyOf(this.split ? c.region : 0));
        const a = Math.floor((e.n * l) / L);
        const b = Math.floor((e.n * (l + 1)) / L);
        if (b > a) {
          p.mesh.instanceMatrix.array.set(e.m.subarray(a * 16, b * 16), p.o * 16);
          p.mesh.geometry.attributes.aTint.array.set(e.t.subarray(a * 4, b * 4), p.o * 4);
          p.o += b - a;
        }
        if (l) continue;
        const R = e.big * this.reach;
        for (let i = 0; i < 3; i++) {
          p.box[i] = Math.min(p.box[i], e.box[i] - R);
          p.box[i + 3] = Math.max(p.box[i + 3], e.box[i + 3] + R);
        }
      }
      for (const p of this.parts.values()) p.layers[l] = p.o;
    }
    for (const p of this.parts.values()) p.layers.fill(p.o, L);
    for (const p of this.parts.values()) {
      const m = p.mesh;
      const b = p.box;
      m.count = p.o;
      m.visible = p.o > 0;
      const mid = new THREE.Vector3((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2);
      m.geometry.boundingSphere = new THREE.Sphere(mid, Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]) / 2);
      m.instanceMatrix.needsUpdate = true;
      m.geometry.attributes.aTint.needsUpdate = true;
    }
    this.count = total;
  }
  get triangles() {
    return (this.geo.index ? this.geo.index.count / 3 : this.geo.attributes.position.count / 3) * this.count;
  }
  get meshes() {
    return [...this.parts.values()].filter((p) => p.o > 0).length;
  }
  dispose() {
    for (const p of this.parts.values()) this.drop(p);
    this.parts.clear();
    this.geo.dispose();
  }
}

// ------------------------------------------------------------------ the whole

// A lane as its points: [[x, z], ...] as given, or a lane object's own points ({ points }).
const lanePoints = (list) => list.map((l) => (Array.isArray(l) ? l : l?.points)).filter((l) => Array.isArray(l) && l.length > 1);

// How long one slice of the growing after the first picture may run before the page gets a turn, in ms.
const SLICE_MS = 12;

export function makeDressing(stage, ground, { lanes: lanes0 = [], detail: detail0 = 1 } = {}) {
  const t0 = performance.now();
  const lanes = lanePoints(lanes0);
  const detail = clamp(detail0, 0.25, 1);
  const group = new THREE.Group();
  group.name = "dressing";
  const DOUBLE = THREE.DoubleSide;
  const mats = {
    foliage: dressMaterial("foliage", { FOLIAGE: 1 }),
    conifer: dressMaterial("foliage", { FOLIAGE: 1 }, { shadowSide: DOUBLE }),
    rock: dressMaterial("rock", { ROCK: 1 }, { derivatives: true }),
    wall: dressMaterial("wall", { WALL: 1 }),
    solid: dressMaterial("solid", { SOLID: 1 }),
    grass: dressMaterial("grass", { GRASS: 1, FADE_FAR: 1 }, { side: DOUBLE, fade: [330, 520], map: grassTexture(), derivatives: true }),
    blossom: dressMaterial("blossom", { BLOSSOM: 1, FADE_FAR: 1 }, { side: DOUBLE, fade: [380, 600] }),
    decal: decalMaterial(),
    fields: fieldMaterial(),
  };
  const SPLIT = { split: true };
  const CAST = { cast: true, split: true };
  const batches = [
    new Batch(group, "spruce", spruceGeo(0), mats.conifer, CAST),
    new Batch(group, "spruceLo", spruceGeo(1), mats.conifer, SPLIT),
    new Batch(group, "spruceDist", spruceGeo(2), mats.foliage, SPLIT),
    new Batch(group, "pine", pineGeo(), mats.foliage, CAST),
    new Batch(group, "broad", broadGeo(), mats.foliage, CAST),
    new Batch(group, "birch", birchGeo(), mats.foliage, CAST),
    new Batch(group, "bush", bushGeo(), mats.foliage, SPLIT),
    new Batch(group, "boulderA", rockGeo(0), mats.rock, CAST),
    new Batch(group, "boulderB", rockGeo(1), mats.rock, CAST),
    new Batch(group, "rockA", rockGeo(0), mats.rock),
    new Batch(group, "rockB", rockGeo(1), mats.rock),
    new Batch(group, "wall", wallGeo(), mats.wall),
    new Batch(group, "fence", fenceGeo(), mats.solid),
    new Batch(group, "hay", hayGeo(), mats.solid, { cast: true }),
    new Batch(group, "tuft", tuftGeo(), mats.grass, { split: true, fade: 520, thin: [120, 400, 0.25] }),
    new Batch(group, "flower", flowerGeo(), mats.blossom, { split: true, fade: 600, thin: [120, 400, 0.25] }),
    new Batch(group, "decal", decalGeo(), mats.decal, { receive: false }),
  ];
  // the chunks: CORE's, then the far ones round it
  const EMPTY = { k: {} };
  const chunks = [];
  const NX = (CORE.x1 - CORE.x0) / CHUNK;
  const NZ = (CORE.z1 - CORE.z0) / CHUNK;
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) chunks.push({ i, j, x0: CORE.x0 + i * CHUNK, z0: CORE.z0 + j * CHUNK, size: CHUNK, far: false });
  for (let z = -WORLD_R; z < CORE.z1 + FAR_CHUNK; z += FAR_CHUNK)
    for (let x = -WORLD_R; x < WORLD_R; x += FAR_CHUNK) {
      // only those with some ground outside CORE, near enough to see
      const inside = x >= CORE.x0 && x + FAR_CHUNK <= CORE.x1 && z >= CORE.z0 && z + FAR_CHUNK <= CORE.z1;
      if (inside) continue;
      const nx = clamp(0, x, x + FAR_CHUNK);
      const nz = clamp(0, z, z + FAR_CHUNK);
      if (Math.hypot(nx, nz) > FAR_R) continue;
      chunks.push({ i: Math.round(x / FAR_CHUNK) + 1000, j: Math.round(z / FAR_CHUNK) + 1000, x0: x, z0: z, size: FAR_CHUNK, far: true });
    }
  for (const c of chunks) {
    c.region = regionOf(c);
    c.out = EMPTY;
    c.grown = false;
    c.d = Math.hypot(c.x0 + c.size / 2, c.z0 + c.size / 2);
  }
  // the fields' skin: one mesh, made again from its chunks' pieces
  let fieldMesh = null;
  const buildFields = () => {
    const parts = chunks.filter((c) => c.fields);
    if (fieldMesh) {
      group.remove(fieldMesh);
      fieldMesh.geometry.dispose();
      fieldMesh = null;
    }
    if (!parts.length) return;
    let nv = 0;
    let ni = 0;
    for (const c of parts) {
      nv += c.fields.pos.length / 3;
      ni += c.fields.idx.length;
    }
    const pos = new Float32Array(nv * 3);
    const nor = new Float32Array(nv * 3);
    const col = new Float32Array(nv * 3);
    const fld = new Float32Array(nv * 4);
    const ao = new Float32Array(nv);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let v = 0;
    let k = 0;
    for (const c of parts) {
      const f = c.fields;
      pos.set(f.pos, v * 3);
      nor.set(f.nor, v * 3);
      col.set(f.col, v * 3);
      fld.set(f.fld, v * 4);
      ao.set(f.ao, v);
      for (let q = 0; q < f.idx.length; q++) idx[k + q] = f.idx[q] + v;
      v += f.pos.length / 3;
      k += f.idx.length;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aField", new THREE.BufferAttribute(fld, 4));
    g.setAttribute("aAOg", new THREE.BufferAttribute(ao, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    fieldMesh = new THREE.Mesh(g, mats.fields);
    fieldMesh.name = "dress-fields";
    fieldMesh.receiveShadow = true;
    fieldMesh.matrixAutoUpdate = false;
    group.add(fieldMesh);
  };
  const stats = {};
  const count = () => {
    stats.chunks = chunks.length;
    stats.grown = chunks.filter((c) => c.grown).length;
    stats.counts = Object.fromEntries(batches.map((b) => [b.name, b.count]));
    stats.trianglesBy = Object.fromEntries(batches.map((b) => [b.name, Math.round(b.triangles)]));
    stats.triangles = Math.round(batches.reduce((s, b) => s + b.triangles, 0) + (fieldMesh ? fieldMesh.geometry.index.count / 3 : 0));
    stats.drawCalls = batches.reduce((s, b) => s + b.meshes, 0) + (fieldMesh ? 1 : 0);
    stats.shadowCalls = batches.reduce((s, b) => s + (b.cast ? b.meshes : 0), 0);
    stats.fields = env.farm.fields.length;
    stats.frontier = env.frontier;
  };
  const fillAll = () => {
    for (const b of batches) b.fill(chunks);
    buildFields();
    count();
  };
  let env = makeEnv(ground, lanes, detail);
  const grow = (c) => {
    c.out = growChunk(env, c);
    c.grown = true;
  };
  // the first picture: the chunks round the town, nearest first
  const first = chunks.filter((c) => !c.far && c.d < FIRST_R);
  for (const c of first) grow(c);
  fillAll();
  stats.ms = Math.round(performance.now() - t0);
  // the rest in slices, between the page's other work; shown together when the last has grown
  let dead = false;
  let work = stats.ms;
  const pending = chunks.filter((c) => !c.grown).sort((a, b) => b.d - a.d);
  let done = null;
  const ready = new Promise((res) => (done = res));
  const finish = () => {
    env.grids = null;
    fillAll();
    stats.msAll = Math.round(performance.now() - t0);
    stats.msWork = Math.round(work);
    if (stage) {
      stage.still = true;
      stage.shadowDirty = true;
    }
    done(stats);
  };
  const slice = () => {
    if (dead) return;
    const ts = performance.now();
    while (pending.length && performance.now() - ts < SLICE_MS) {
      const c = pending.pop();
      if (!c.grown) grow(c);
    }
    work += performance.now() - ts;
    if (pending.length) setTimeout(slice, 0);
    else finish();
  };
  if (pending.length) setTimeout(slice, 0);
  else finish();
  let laneKeys = new Set(lanes.map((l) => JSON.stringify(l)));
  return {
    group,
    stats,
    ready,
    // Grows again the chunks any of rects (a lane that came or went, a pad the frontier reached) touches, on the new ground.
    update(next, { lanes: nextLanes0 = [] } = {}, rects = []) {
      const t1 = performance.now();
      const nextLanes = lanePoints(nextLanes0);
      const all = [...rects];
      const keys = new Set(nextLanes.map((l) => JSON.stringify(l)));
      const changed = [...nextLanes.filter((l) => !laneKeys.has(JSON.stringify(l))), ...[...laneKeys].filter((k) => !keys.has(k)).map((k) => JSON.parse(k))];
      for (const l of changed)
        for (let i = 0; i < l.length - 1; i++)
          all.push({
            x0: Math.min(l[i][0], l[i + 1][0]) - 10,
            z0: Math.min(l[i][1], l[i + 1][1]) - 10,
            x1: Math.max(l[i][0], l[i + 1][0]) + 10,
            z1: Math.max(l[i][1], l[i + 1][1]) + 10,
          });
      laneKeys = keys;
      // the pads the frontier has reached (or left), cleared (or grown) again
      const was = env.frontier;
      env = makeEnv(next, nextLanes, detail);
      if (env.frontier !== was)
        for (const s of sites()) {
          if (s.plot <= Math.min(was, env.frontier) || s.plot > Math.max(was, env.frontier)) continue;
          const R = Math.hypot(s.hw, s.hd) + 12;
          all.push({ x0: s.x - R, z0: s.z - R, x1: s.x + R, z1: s.z + R });
        }
      const M = 14;
      let n = 0;
      for (const c of chunks) {
        if (!c.grown) continue;
        if (!all.some((q) => q.x1 >= c.x0 - M && q.x0 <= c.x0 + c.size + M && q.z1 >= c.z0 - M && q.z0 <= c.z0 + c.size + M)) continue;
        grow(c);
        n++;
      }
      if (!pending.length) env.grids = null;
      if (n) fillAll();
      else count();
      stats.updateMs = Math.round(performance.now() - t1);
      stats.updated = n;
      if (stage) stage.still = true;
      return n;
    },
    dispose() {
      dead = true;
      for (const b of batches) b.dispose();
      if (fieldMesh) {
        group.remove(fieldMesh);
        fieldMesh.geometry.dispose();
      }
      for (const m of Object.values(mats)) m.dispose();
    },
  };
}
