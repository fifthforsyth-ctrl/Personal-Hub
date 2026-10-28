// The coast's growing things and stones, laid over the land of ./terrain.js:
// woods of spruce and pine (Berk's), broadleaf trees and birches by the town
// and the rivers, bushes at the woods' edges and along the lanes, grass tufts
// and wildflowers in the meadows round the town, boulders on the cliff tops,
// tumbled in the surf, on the river banks and up the mountainsides, and on
// the two headlands a patchwork of fields walled with dry stone or fenced
// with rails, a hay stack or two standing in them.
//
//   makeDressing(stage, ground, { lanes, detail })
//     -> { group, update(ground, { lanes }, rects), dispose(), stats }
//   ground: coast.js groundOf(active pads); lanes: [[[x, z], ...], ...] (routeOf of each built plot),
//     or lane objects with their points ({ points: [[x, z], ...] }).
//   detail (optional, 0.25 to 1, default 1): less of the small things (tufts, flowers, bushes, the far
//     hills' trees and stones) for a weaker device; the trees and stones near the town stay as they are.
//   update() works out again only the chunks a rect ({ x0, z0, x1, z1 }) or a new lane touches.
//   stats: { ms, chunks, counts: { kind: instances }, triangles, trianglesBy, drawCalls, shadowCalls, updateMs, updated }
//
// The land is cut into chunks CHUNK metres square aligned with terrain.js
// CORE (and past CORE, out to the far hills, chunks FAR_CHUNK square that
// only grow trees and stones). Each chunk grows from a seed of its own, so it
// always grows the same. Each kind of thing is one InstancedMesh for the
// whole coast, its instances gathered from every chunk: a draw call a kind,
// and one more for the sun's shadow where it casts one. All of it stands in
// the still layer. Every instance stands on the ground as it is drawn (the
// terrain's own triangles), so nothing floats. The light is the land's: the
// kit's sun (soft and wrapped round the leaves), its shadows, the sky and
// ground fill with the shade lifted toward the sky's blue, and the same haze.

import * as THREE from "three";
import { CORE, PALETTE, groundLook } from "./terrain.js";
import { noiseTexture } from "./glade.js";
import { PIER, RIVERS, STACKS, WORLD_R, cliffTop, coastZ, fbm2, forestAt, naturalAt, noise2, rectOut, riverAt, shoreDist, sites, smooth } from "./coast.js";

export const CHUNK = 64;
export const FAR_CHUNK = 128;
// how far the far chunks reach from the plaza
const FAR_R = 1450;
// tufts and flowers grow within this of the plaza
const MEADOW_R = 360;
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
  spruceWarm: lins(["#536f3b", "#5c7840", "#4c6a38"]),
  pine: lins(["#466a3a", "#4f723c", "#41633a", "#56763f"]),
  broad: lins(["#64903d", "#729a45", "#5a873b", "#80a449", "#6a9246", "#87a142"]),
  autumn: lins(["#c98d3e", "#b9773a", "#cfa548", "#b0603a", "#c49a45"]),
  birch: lins(["#88a64e", "#93ab55", "#7f9f4c", "#9aae5a"]),
  birchGold: lins(["#d8b443", "#cfa338"]),
  bush: lins(["#557f3a", "#618a3e", "#4b7442", "#6c9044", "#527845", "#76923f"]),
  rock: lins([PALETTE.rockA, PALETTE.rockB, "#9d978b", "#a8a193", "#8a857c"]),
  wall: lins(["#a59f92", "#9a948a", "#aea797", "#938e85"]),
  wood: lins(["#7a6a58", "#6f604f", "#857461"]),
  hay: lins(["#cfae5c", "#c7a453", "#d6b766"]),
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
  birch: lin("#e6e1d4"),
};
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

// A tint jittered a little in brightness and warmth.
function jitter(c, r, k = 1) {
  const l = 1 + (r() - 0.5) * 0.22 * k;
  const w = (r() - 0.5) * 0.12 * k;
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
  const { verts, faces } = SHAPES[o.shape ?? "low"];
  const squash = o.squash ?? 0.85;
  for (const [px, py, pz, pr] of puffs) {
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

// A tapering trunk of `sides` from (x0, 0, z0) to (x1, h, z1), its colour from c0 at the foot to c1 at the top.
function trunk(geo, { sides = 5, r0, r1, h, x1 = 0, z1 = 0, c0, c1, y0 = -0.4, aoFoot = 0.45 }) {
  const base = geo.count;
  for (let ring = 0; ring < 2; ring++) {
    const y = ring ? h : y0;
    const rr = ring ? r1 : r0;
    const ox = ring ? x1 : 0;
    const oz = ring ? z1 : 0;
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      geo.v(ox + Math.cos(a) * rr, y, oz + Math.sin(a) * rr, Math.cos(a), 0.15, Math.sin(a), ring ? c1 : c0, ring ? 0.85 : aoFoot, 0);
    }
  }
  for (let s = 0; s < sides; s++) {
    const a = base + s;
    const b = base + ((s + 1) % sides);
    geo.t(a, a + sides, b);
    geo.t(b, a + sides, b + sides);
  }
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
    const k = lod ? 5 : t < 2 ? 7 : t < 5 ? 6 : 5;
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

// A Scots pine a metre tall: a long bare trunk, orange toward the top, a crown of flat clumps.
function pineGeo() {
  const geo = new Geo();
  trunk(geo, { sides: 5, r0: 0.026, r1: 0.014, h: 0.78, x1: 0.03, z1: -0.01, c0: BARK.pineLow, c1: BARK.pineHigh, y0: -0.05 });
  const clumps = [
    [0.02, 0.84, 0.0, 0.21, 0.09, 0.2],
    [-0.14, 0.74, 0.07, 0.14, 0.07, 0.13],
    [0.16, 0.72, -0.08, 0.13, 0.065, 0.12],
  ];
  crown(geo, clumps.map(([x, y, z, rx]) => [x, y, z, rx]), { shape: "pad", seed: 71, squash: 0.45, flat: 0.5, aoLow: 0.4 });
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
    [0.04, 0.58, 0.21, 0.19],
    [-0.02, 0.6, -0.2, 0.19],
    [0.1, 0.86, 0.08, 0.15],
  ];
  crown(geo, puffs, { shape: "mid", seed: 5, flat: 0.55, aoLow: 0.35 });
  return geo.build();
}

// A birch a metre tall: a slim white trunk and a light, narrow crown.
function birchGeo() {
  const geo = new Geo();
  trunk(geo, { sides: 5, r0: 0.022, r1: 0.012, h: 0.86, x1: 0.02, c0: BARK.birch, c1: BARK.birch, y0: -0.05, aoFoot: 0.6 });
  const puffs = [[0.0, 0.76, 0.0, 0.17], [-0.09, 0.6, 0.06, 0.14], [0.1, 0.62, -0.05, 0.13], [0.03, 0.9, -0.03, 0.1]];
  crown(geo, puffs, { shape: "low", seed: 31, squash: 1.05, aoLow: 0.45 });
  return geo.build();
}

// A bush a metre across: a low soft mound of clumps.
function bushGeo() {
  const geo = new Geo();
  crown(geo, [[0.0, 0.36, 0.0, 0.34], [-0.26, 0.24, 0.1, 0.26], [0.24, 0.22, -0.1, 0.26]], { shape: "bush", seed: 11, squash: 0.85, flat: 0.6, aoLow: 0.4 });
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

// A tuft of meadow grass about a metre across: five cards of painted blades (grassTexture()) round a
// small root, each leaning outward like a fountain, so it is a rosette seen from above and a bush from
// the side. aPart is how far up a card a point is.
function tuftGeo() {
  const geo = new Geo();
  const r = rngOf(808);
  const n = 5;
  for (let c = 0; c < n; c++) {
    const a = (c / n) * Math.PI * 2 + (r() - 0.5) * 0.5;
    // the card's own across (tx, tz) and out (ox, oz)
    const ox = Math.cos(a);
    const oz = Math.sin(a);
    const tx = -oz;
    const tz = ox;
    const w = 0.34 + r() * 0.1;
    const h = 0.5 + r() * 0.22;
    const r0 = 0.06;
    const lean = 0.26 + r() * 0.12;
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

// A patch of wildflowers a metre across: a few blossoms on the grass, each a small star facing the sky.
// aPart: 1 a petal's tip, 0.5 its heart.
function flowerGeo() {
  const geo = new Geo();
  const r = rngOf(91);
  const n = 7;
  for (let b = 0; b < n; b++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 0.5;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const y = 0.16 + r() * 0.24;
    const s = 0.12 + r() * 0.08;
    const tx = (r() - 0.5) * 0.6;
    const tz = (r() - 0.5) * 0.6;
    const c = geo.v(x, y + 0.01, z, tx, 1, tz, [1, 1, 1], 1, 0.5);
    const petals = 5;
    const rim = [];
    for (let p = 0; p < petals; p++) {
      const pa = (p / petals) * Math.PI * 2 + r();
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
  const rings = 5;
  const r = rngOf(55);
  const base = geo.count;
  for (let k = 0; k < rings; k++) {
    const x = -1 + (2 * k) / (rings - 1);
    const lump = k === 0 || k === rings - 1 ? 0 : (r() - 0.5) * 0.12;
    prof.forEach(([z, y], j) => {
      const yy = y > 0.5 ? y + lump : y;
      const ny = y > 0.7 ? 1 : y > 0.5 ? 0.6 : 0.1;
      geo.v(x, yy, z, 0, ny, Math.sign(z) || 0, [1, 1, 1], y > 0.5 ? 1 : lerp(0.55, 0.9, (y + 0.3) / 0.8), 3);
    });
  }
  const P = prof.length;
  for (let k = 0; k < rings - 1; k++)
    for (let j = 0; j < P - 1; j++) {
      const a = base + k * P + j;
      const b = a + P;
      geo.t(a, b, a + 1);
      geo.t(a + 1, b, b + 1);
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
  // ------------------------------------------------ leaves and bark
  "#ifdef FOLIAGE",
  "  float leaf = step(0.5, vPart);",
  "  alb *= mix(vec3(1.0), vTint.rgb, leaf);",
  "  vec4 st = paintTri(vPW * 0.16 + vTint.w * 7.0, N);",
  "  vec4 st2 = paintTri(vPW * 0.05 + vTint.w * 3.0, N);",
  "  vec4 cl = noiseTri(vPW / 5.5 + vTint.w * 9.0, N);",
  "  float sS = st.r - 0.5, sB = st.b - 0.5, sM = st2.g - 0.5;",
  // leaf clumps: lit tops and dark gaps a metre or so across
  "  alb *= 1.0 + ((cl.g - 0.5) * 0.55 + (cl.a - 0.5) * 0.3) * leaf;",
  "  alb *= 1.0 + (sS * 0.3 + sB * 0.15) * leaf + (sS * 0.25 + sB * 0.3) * (1.0 - leaf);",
  "  alb = mix(alb, alb * vec3(1.12, 1.06, 0.8), clamp(sM * 2.4, 0.0, 1.0) * 0.55 * leaf);",
  "  alb = mix(alb, alb * vec3(0.86, 0.96, 1.08), clamp(-sM * 2.4, 0.0, 1.0) * 0.5 * leaf);",
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
  // wet and dark where the sea washes, a weedy green at the water line
  "  float wet = 1.0 - smoothstep(-0.2, 1.6 + (nr.r - 0.5) * 0.8, vPW.y);",
  "  alb = mix(alb, uWet * (0.8 + nf.g * 0.4), wet * 0.8);",
  "  alb = mix(alb, alb * vec3(0.7, 0.85, 0.55), wet * (1.0 - smoothstep(-0.6, 0.4, vPW.y)) * 0.6);",
  "  ao *= mix(0.5, 1.0, smoothstep(-0.1, 0.9, vLoc.y + 0.25));",
  "  wrap = 0.12;",
  "  lift = 0.6;",
  "#endif",
  "#ifdef WALL",
  "  alb *= vTint.rgb;",
  // the stones: rows of blocks along the wall (its own x), each block its own shade, dark gaps between
  "  float along = vLoc.x + vTint.w * 17.0;",
  "  float topF = step(0.75, N.y);",
  "  float ry = mix(vLoc.y, vLoc.z + 0.4, topF);",
  "  float row = floor(ry / 0.22);",
  "  float shift = fract(sin(row * 12.9898 + vTint.w * 7.0) * 43758.5453);",
  "  float sx = along / (0.3 + shift * 0.2) + shift * 3.0;",
  "  float h = fract(sin(floor(sx) * 78.233 + row * 37.719) * 43758.5453);",
  "  float gx = abs(fract(sx) - 0.5) * 2.0;",
  "  float gy = abs(fract(ry / 0.22) - 0.5) * 2.0;",
  "  float gap = max(smoothstep(0.74, 0.97, gx), smoothstep(0.68, 0.95, gy));",
  "  alb *= (0.8 + h * 0.38) * (1.0 - gap * 0.5);",
  "  ao *= 1.0 - gap * 0.3;",
  "  vec4 nf = noiseTri(vPW / 1.5, N);",
  "  float moss = smoothstep(0.55, 0.9, N.y + (nf.r - 0.5) * 0.9) * 0.75;",
  "  alb = mix(alb, uMoss * (0.85 + nf.b * 0.3), moss);",
  "  alb = mix(alb, vec3(0.62, 0.58, 0.42), smoothstep(0.72, 0.88, nf.g) * 0.35);",
  "  wrap = 0.1;",
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
  "  if (vTint.w > 1.5) base = vTint.rgb;",
  "  vec3 tipC = base * vec3(1.22, 1.25, 0.9);",
  // the blades' shade, unmixed from the clear gaps between them (black in the texture) that the mipmaps blend in afar
  "  float bladeK = clamp(diffuseColor.r / max(diffuseColor.a, 0.05), 0.0, 1.0);",
  "  alb = mix(base, tipC, smoothstep(0.25, 1.0, up)) * (0.6 + 0.42 * bladeK);",
  "  alb *= 1.0 + (fract(vTint.w * 13.7) - 0.5) * 0.18;",
  // seen from afar a tuft is a soft lighter fleck in the meadow, not a dark mark
  "  alb = mix(alb, base * 1.07, smoothstep(50.0, 220.0, camD) * 0.6);",
  "  ao = mix(0.92, 1.08, up);",
  "  wrap = 0.3;",
  "  thin = up * 0.7;",
  "  shK = 0.9;",
  "#endif",
  // ------------------------------------------------ blossoms: their colour, a warm heart
  "#ifdef BLOSSOM",
  "  float heart = 1.0 - smoothstep(0.5, 0.9, vPart);",
  "  vec3 eye = vTint.w > 0.5 ? vec3(0.95, 0.62, 0.08) : vTint.rgb * 0.45;",
  "  alb = mix(vTint.rgb, eye, heart * 0.9);",
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
  "if (kind < 0.5) {",
  // wheat: gold, a sheen where the wind combs it, fine rows
  "  crop = uWheat * (0.92 + (nU.r - 0.5) * 0.3 + (nD.g - 0.5) * 0.14 + brush * 0.12);",
  "  crop = mix(crop, crop * vec3(1.1, 1.06, 0.86), smoothstep(0.55, 0.8, nC.r) * 0.6);",
  "  crop *= mix(0.84, 1.05, rows(v, 0.75, 0.3));",
  "} else if (kind < 1.5) {",
  // green rows on brown earth
  "  float r = rows(v, 1.5, 0.22);",
  "  vec3 leaves = uCrop * (0.85 + (nD.r - 0.5) * 0.4 + brush * 0.2);",
  "  crop = mix(uSoil * (0.9 + (nD.b - 0.5) * 0.2), leaves, r * (0.75 + (nU.g - 0.5) * 0.5));",
  "} else if (kind < 2.5) {",
  // fallow: ploughed furrows, a few weeds coming back
  "  crop = uFallow * (0.92 + (nU.b - 0.5) * 0.25 + (nD.r - 0.5) * 0.15) * mix(0.8, 1.06, rows(v, 0.8, 0.35));",
  "  crop = mix(crop, g * 0.9, smoothstep(0.62, 0.82, nC.a + (nD.g - 0.5) * 0.3) * 0.7);",
  "} else {",
  // a hay meadow, mown in broad stripes, the cut hay drying in lines
  "  crop = mix(g, uHay, 0.45) * mix(0.93, 1.07, rows(u, 6.0, 0.05));",
  "  float wr = 0.5 + 0.5 * cos(v / 4.5 * 6.2831853) + (nD.g - 0.5) * 0.12;",
  "  float windrow = smoothstep(0.86, 0.98, wr) * (1.0 - smoothstep(0.2, 0.5, fwidth(v / 4.5)));",
  "  crop = mix(crop, uWheat * (0.85 + nD.r * 0.25), windrow * 0.55);",
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

// The headlands' fields, worked out once: each field a quad on a turned,
// jittered grid where the ground is gentle, open, dry and away from the
// cliffs, the rivers and every build site. { fields: [{ poly, kind, ux, uz, ox, oz }], walls: [...], hay: [...] }
function farmland() {
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
        const f = { poly, kind, ux: ca, uz: sa, ox: cx, oz: cz, side: side.id, i, j };
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

// Rectangles (pads, sites) in a grid: the least distance outside any near a point.
function rectIndex(list) {
  const CELL = 48;
  const grid = new Map();
  for (const p of list) {
    const reach = Math.hypot(p.hw, p.hd) + 24;
    for (let cx = Math.floor((p.x - reach) / CELL); cx <= Math.floor((p.x + reach) / CELL); cx++)
      for (let cz = Math.floor((p.z - reach) / CELL); cz <= Math.floor((p.z + reach) / CELL); cz++) {
        const k = cx * 100003 + cz;
        let l = grid.get(k);
        if (!l) grid.set(k, (l = []));
        l.push(p);
      }
  }
  return (x, z) => {
    const l = grid.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL));
    if (!l) return 99;
    let d = 99;
    for (const p of l) d = Math.min(d, rectOut(p, x, z));
    return d;
  };
}

// Everything the chunks are grown against: the ground, its pads, the sites, the lanes, the fields.
function makeEnv(ground, lanes, detail) {
  const farm = farmland();
  if (!farm.near) {
    const CELL = 64;
    const grid = new Map();
    for (const f of farm.fields) {
      const xs = f.poly.map((p) => p[0]);
      const zs = f.poly.map((p) => p[1]);
      for (let cx = Math.floor((Math.min(...xs) - 8) / CELL); cx <= Math.floor((Math.max(...xs) + 8) / CELL); cx++)
        for (let cz = Math.floor((Math.min(...zs) - 8) / CELL); cz <= Math.floor((Math.max(...zs) + 8) / CELL); cz++) {
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
  return {
    ground,
    farm,
    plaza,
    grids,
    detail,
    padOut: rectIndex(ground.pads.filter((p) => !p.plaza)),
    siteOut: rectIndex(sites()),
    lane: laneIndex(lanes),
  };
}

// ------------------------------------------------------------------ growing a chunk

// What a chunk grows, kind by kind: instance matrices and tints. A chunk grows into scratch lists
// kept from one chunk to the next (one chunk grows at a time), then keeps copies cut to length.
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
  trim() {
    for (const o of Object.values(this.k)) {
      o.m = o.m.slice(0, o.n * 16);
      o.t = o.t.slice(0, o.n * 4);
      o.sc = null;
    }
    return this;
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

// One instance laid on the ground's slope (nx, ny, nz the ground's normal) and turned yaw in it.
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

// A contact shade under something of radius rad.
function shade(out, S, x, z, rad, k) {
  S.at(x, z);
  putOnSlope(out, "decal", x, S.h + 0.05, z, 0, rad * 2, 1, rad * 2, S.gx, S.gz, SHADE_C, k);
}

// The colours trees of each kind take here: neighbours alike (a broad noise picks from the list), each a little its own.
function treeTint(kind, x, z, r) {
  const n = clamp(fbm2(x / 95 + 13.1, z / 95 - 4.4, 2) * 0.5 + 0.5 + (r() - 0.5) * 0.35, 0, 0.999);
  if (kind === "spruce") {
    const warm = r() < 0.12;
    const list = warm ? TONE.spruceWarm : TONE.spruce;
    return jitter(list[Math.floor(n * list.length)], r);
  }
  if (kind === "pine") return jitter(TONE.pine[Math.floor(n * TONE.pine.length)], r);
  if (kind === "birch") return jitter(r() < 0.07 ? pick(r, TONE.birchGold) : TONE.birch[Math.floor(n * TONE.birch.length)], r);
  if (kind === "broad") return jitter(r() < 0.06 ? pick(r, TONE.autumn) : TONE.broad[Math.floor(n * TONE.broad.length)], r);
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
  const { ground } = env;
  const out = new Out();
  const far = ch.far;
  const S = new Surface(ground, ch.x0, ch.z0, ch.size, far ? FAR_STEP : STEP, far ? env.grids.far : env.grids.near);
  const x0 = ch.x0;
  const z0 = ch.z0;
  const size = ch.size;
  const inCore = (x, z) => x >= CORE.x0 && x < CORE.x1 && z >= CORE.z0 && z < CORE.z1;
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
  // a stream of numbers for each thing the chunk grows, so one never shifts another's
  const r = rngOf(hash3(ch.i, ch.j, far ? 7 : 3));
  const plaza = env.plaza;
  const pierOut = (x, z) => Math.max(Math.abs(x - PIER.x) - PIER.w, z < PIER.z0 - 6 ? PIER.z0 - 6 - z : 0, z > PIER.z1 ? z - PIER.z1 : 0);

  // ---------------------------------------------------------------- trees and bushes
  // spruces near the town (where the camera comes close) are the finer ones
  const close = !far && nearSite(x0 + size / 2, z0 + size / 2);
  const cellT = far ? 15 : 5;
  const nT = size / cellT;
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
      // how likely a tree is here: the woods, a grove, a lone tree in the meadow, the river's trees
      let p = smooth(0.06, 0.55, fo) * 0.9;
      const grove = smooth(0.12, 0.42, fbm2(x / 64 + 5.3, z / 64 - 3.1, 2)) * smooth(40, 90, rad) * smooth(14, 30, sd);
      p = Math.max(p, grove * 0.42, 0.03 * smooth(40, 80, rad) * smooth(14, 30, sd));
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
      if (roll > p * (far ? env.detail : 1)) {
        // no tree: perhaps a bush at the woods' edge or by the water
        if (far) continue;
        const edgeB = smooth(0.02, 0.15, fo) * (1 - smooth(0.3, 0.6, fo));
        const pb = Math.max(edgeB * 0.5, byRiver * 0.22, grove * 0.12);
        if (roll2 < pb * env.detail) bushAt(env, out, S, r, x, z, sd, 1);
        continue;
      }
      // what grows here
      let kind = "spruce";
      const t = r();
      const town = 1 - smooth(140, 300, rad);
      if (byRiver > 0.3 && fo < 0.5) kind = t < 0.45 ? "birch" : t < 0.8 ? "broad" : "spruce";
      else if (lip > 0.3) kind = t < 0.55 ? "pine" : "spruce";
      else if (fo < 0.3 && rad < 320) kind = t < 0.5 * town + 0.15 ? "broad" : t < 0.62 ? "spruce" : t < 0.8 ? "pine" : "birch";
      else kind = t < 0.8 ? "spruce" : t < 0.93 ? "pine" : t < 0.97 && rad < 400 ? "broad" : "birch";
      if (far) kind = "spruce";
      const T = TREES[kind];
      // smaller at the woods' edge and high up, bigger deep in them
      const deep = smooth(0.3, 0.9, fo);
      let h = lerp(T.h[0], T.h[1], clamp(r() * 0.75 + deep * 0.35, 0, 1));
      S.at(x, z);
      const gy = S.h;
      h *= 1 - smooth(70, 125, gy) * 0.35;
      if (far) h *= 1.2;
      const crown = h * T.r;
      // room: off the pads, the sites, the lanes, the plaza, the rivers, the shore, the fields
      if (!far) {
        if (env.padOut(x, z) < 4 + crown * 0.6) continue;
        const siteM = 3 + crown * 0.5 + 3 * noise2(x / 9 + 1.7, z / 9 - 3.3);
        if (env.siteOut(x, z) < siteM) {
          // a site in the woods keeps some of the woods' undergrowth till a build comes: thickets, not a scatter
          const thicket = smooth(0.1, 0.5, noise2(x / 15 + 3.7, z / 15 - 1.9));
          if (fo > 0.25 && roll2 < 0.8 * thicket * env.detail) bushAt(env, out, S, r, x, z, sd, 0.9, true);
          continue;
        }
        if (env.lane.dist(x, z) < 3 + crown * 0.55) continue;
        if (rectOut(plaza, x, z) < 14 + crown) continue;
        if (pierOut(x, z) < 10) continue;
        if (rv && !rv.past && rv.d - rv.w / 2 < 2 + crown * 0.35) continue;
        if (sd < 4 + crown * 0.4) continue;
        const fd = fieldAt(env.farm, x, z, 4 + crown);
        if (fd) {
          // the woods' edge round a field cut in them: a hedge of bushes
          if (fo > 0.3 && roll2 < 0.45 * env.detail) bushAt(env, out, S, r, x, z, sd, 1);
          continue;
        }
      }
      if (S.slope > 0.78) continue;
      // a lean (on the cliff tops, away from the sea's wind)
      const lean = 0.035 + lip * 0.07;
      const tx = (r() - 0.5) * lean * 2 - lip * 0.06;
      const tz = (r() - 0.5) * lean * 2;
      const sink = 0.3 + S.slope * 0.6 + (far ? 1 : 0);
      const wk = 0.85 + r() * 0.3;
      const tint = treeTint(kind, x, z, r);
      const batch = kind !== "spruce" ? kind : far ? "spruceDist" : close ? "spruce" : "spruceLo";
      put(out, batch, x, gy - sink, z, r() * Math.PI * 2, h * wk, h, h * wk * (0.9 + r() * 0.2), tx, tz, tint, r());
      // contact shade under the lone trees
      if (!far && fo < 0.45) shade(out, S, x, z, crown * 1.05, 0.5);
      // bushes at the foot of some
      if (!far && fo < 0.5 && r() < 0.25 * env.detail) bushAt(env, out, S, r, x + (r() - 0.5) * crown * 1.6, z + (r() - 0.5) * crown * 1.6, sd, 0.8);
    }

  // ---------------------------------------------------------------- bushes along the lanes (each lane's own seed)
  if (!far && env.lane.segs.length) {
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
        if (x < x0 || x >= x0 + size || z < z0 || z >= z0 + size) continue;
        const roll = r();
        if (roll < 0.3) {
          if (roll < 0.3 * env.detail) bushAt(env, out, S, r, x, z, shoreDist(x, z), 0.9);
        } else if (roll < 0.4) laneTree(env, out, S, r, x + (-(bz - az) / L) * side * 3, z + ((bx - ax) / L) * side * 3);
      }
    }
  }

  // ---------------------------------------------------------------- rocks
  rocksIn(env, out, S, rngOf(hash3(ch.i, ch.j, far ? 17 : 13)), ch, forest);

  // ---------------------------------------------------------------- the farmland's walls, fences and hay stacks
  if (!far) {
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
        if (w.stone) put(out, "wall", mx, y, mz, yaw, (L / 2) * 1.06, 0.95 + rr() * 0.25, 1 + rr() * 0.15, 0, pitch, pick(rr, TONE.wall), rr(), "YZX");
        else put(out, "fence", mx, y, mz, yaw, L / 2.6, 1, 1, 0, pitch * 0.9, jitter(pick(rr, TONE.wood), rr, 0.6), rr(), "YZX");
        // tufts grown up against the wall's foot
        for (let k = 0; k < 2; k++) {
          if (rr() > 0.45 * env.detail) continue;
          const t = rr();
          const side = rr() < 0.5 ? -1 : 1;
          const sx = lerp(w.x0, w.x1, t) + (-(w.z1 - w.z0) / L) * side * 0.55;
          const sz = lerp(w.z0, w.z1, t) + ((w.x1 - w.x0) / L) * side * 0.55;
          S.at(sx, sz);
          tuftAt(out, S, rr, sx, sz, null, 1.2);
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
  }

  // ---------------------------------------------------------------- tufts, ferns and wildflowers near the town
  const cx = x0 + size / 2;
  const cz = z0 + size / 2;
  if (!far && Math.hypot(cx, cz) < MEADOW_R + size) meadowIn(env, out, S, rngOf(hash3(ch.i, ch.j, 23)), ch, forest);

  ch.fields = !far ? fieldSkin(env, S, ch) : null;
  return out.trim();
}

// A broadleaf tree or a birch beside a lane, if there is room for it.
function laneTree(env, out, S, r, x, z) {
  const kind = r() < 0.7 ? "broad" : "birch";
  const T = TREES[kind];
  const h = lerp(T.h[0], T.h[1], r());
  const crown = h * T.r;
  if (env.padOut(x, z) < 4 + crown * 0.6 || env.siteOut(x, z) < 3 + crown * 0.5 || env.lane.dist(x, z) < 3 + crown * 0.55) return;
  if (rectOut(env.plaza, x, z) < 14 + crown || shoreDist(x, z) < 12) return;
  const rv = riverAt(x, z);
  if (rv && !rv.past && rv.d - rv.w / 2 < 2 + crown * 0.35) return;
  S.at(x, z);
  if (S.slope > 0.6) return;
  const wk = 0.85 + r() * 0.3;
  put(out, kind, x, S.h - 0.3 - S.slope * 0.6, z, r() * 6.28, h * wk, h, h * wk, (r() - 0.5) * 0.06, (r() - 0.5) * 0.06, treeTint(kind, x, z, r), r());
  shade(out, S, x, z, crown * 1.05, 0.5);
}

// Whether a point is near enough the town (a site, the plaza) that the camera comes close.
function nearSite(x, z) {
  if (Math.hypot(x, z) < 230) return true;
  for (const s of sites()) if (Math.abs(s.x - x) < 125 && Math.abs(s.z - z) < 125) return true;
  return false;
}

// A bush (or two) at (x, z), if there is room for it.
function bushAt(env, out, S, r, x, z, sd, k, onSite = false) {
  if (sd < 5) return;
  if (env.padOut(x, z) < 4) return;
  if (!onSite && env.siteOut(x, z) < 2) return;
  if (env.lane.dist(x, z) < 3) return;
  if (rectOut(env.plaza, x, z) < 6) return;
  const rv = riverAt(x, z);
  if (rv && !rv.past && rv.d < rv.w / 2 + 1.6) return;
  if (fieldAt(env.farm, x, z, 2)) return;
  S.at(x, z);
  if (S.slope > 0.7) return;
  const s = (1.4 + r() * 1.6) * k;
  const tint = treeTint("bush", x, z, r);
  putOnSlope(out, "bush", x, S.h - 0.1, z, r() * 6.28, s * (0.9 + r() * 0.3), s * (0.7 + r() * 0.4), s, S.gx, S.gz, tint, r(), 0.5);
  shade(out, S, x, z, s * 0.75, 0.45);
}

// A tuft of grass (or a fern) at (x, z) on the ground S has just read. look: the ground's colour there.
function tuftAt(out, S, r, x, z, look, k = 1, fern = false) {
  const s = (0.85 + r() * 0.7) * k;
  // a fern is the ground's own colour, greener: never a bright fleck on the dark floor of the woods
  const j = 0.92 + r() * 0.16;
  const c = fern ? [look[0] * 0.9 * j, look[1] * 1.12 * j, look[2] * 0.75 * j] : look || TONE.bush[0];
  putOnSlope(out, "tuft", x, S.h, z, r() * 6.28, s * (0.9 + r() * 0.5), s * (0.7 + r() * 0.5), s * (0.9 + r() * 0.5), S.gx, S.gz, c, fern ? 2 + r() : r(), 0.8);
}

// The stones a chunk has: on the cliff tops and their feet in the surf, by the rivers, up the mountains, round the stacks.
function rocksIn(env, out, S, r, ch, forest) {
  const { x0, z0, size, far } = ch;
  const rockTint = (rr) => {
    const c = pick(rr, TONE.rock);
    return jitter(c, rr, 0.8);
  };
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
    const kind = r() < 0.45 ? "rockB" : "rockA";
    const sy = s * (0.55 + r() * 0.5) * (opts.flat ?? 1);
    const y = S.h - sy * (opts.sink ?? 0.18);
    const moss = opts.moss ?? clamp(0.25 + forest(x, z) * 0.8 + r() * 0.3, 0, 1);
    putOnSlope(out, kind, x, y, z, r() * 6.28, s * (0.8 + r() * 0.5), sy, s * (0.8 + r() * 0.4), S.gx, S.gz, rockTint(r), moss, opts.tilt ?? 0.6);
    if (!far && opts.shade !== false && y > 0.5) shade(out, S, x, z, s * 0.8, 0.5);
    return true;
  };
  // the foot of the cliffs: boulders tumbled into the surf, walked along the shore, each big enough to break the water
  if (!far) {
    for (let x = x0 + r() * 2; x < x0 + size; x += 1.6 + r() * 2.6) {
      const ct = cliffTop(x);
      const roll = r();
      const d = -1.2 + r() * r() * 8;
      const sz = 1.3 + r() * r() * 4.2;
      if (ct < 4 || Math.abs(x) < 36) continue;
      // thicker round the cove, where the camera comes close
      const cove = 1 - smooth(110, 220, Math.abs(x));
      const gaps = 0.35 + 0.25 * cove + (0.65 - 0.25 * cove) * smooth(-0.3, 0.3, noise2(x / 17 + 3.3, 0.5));
      if (roll > (0.75 + 0.2 * cove) * smooth(4, 9, ct) * gaps) continue;
      const sl = (coastZ(x + 1) - coastZ(x - 1)) / 2;
      const L = Math.hypot(sl, 1);
      const bx = x - (sl / L) * d;
      const bz = coastZ(x) + d / L;
      if (bz < z0 || bz >= z0 + size || bx < x0 || bx >= x0 + size) continue;
      S.at(bx, bz);
      if (S.h > 3.2 || S.h < -3.2) continue;
      const sy = Math.max(sz * 0.8, (0.6 - S.h) / 0.42);
      const kind = r() < 0.5 ? "rockA" : "rockB";
      putOnSlope(out, kind, bx, S.h - sy * 0.22, bz, r() * 6.28, sy * (1 + r() * 0.5), sy, sy * (0.9 + r() * 0.4), S.gx, S.gz, rockTint(r), 0, 0.25);
      // and smaller ones heaped round it
      const m = r() < 0.6 ? 1 + Math.floor(r() * 2.2) : 0;
      for (let k = 0; k < m; k++) {
        const ox = bx + (r() - 0.5) * sy * 2.4;
        const oz = bz + (r() - 0.5) * sy * 2.4;
        S.at(ox, oz);
        const ss = sy * (0.4 + r() * 0.3);
        if (S.h < 2.5 && S.h > -ss * 0.6) putOnSlope(out, "rockA", ox, S.h - ss * 0.2, oz, r() * 6.28, ss * 1.2, ss, ss * 1.1, S.gx, S.gz, rockTint(r), 0, 0.25);
      }
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
      if (sd < -14) continue;
      const ct = cliffTop(x);
      if (sd < 4) continue;
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
      // a few smaller ones round it, and sometimes a bush
      const m = Math.floor(r() * 3);
      for (let k = 0; k < m; k++) place(x + (r() - 0.5) * s * 2.6, z + (r() - 0.5) * s * 2.6, s * (0.3 + r() * 0.35), { sink: 0.25 });
      if (!far && r() < 0.35 * env.detail && h < 90) bushAt(env, out, S, r, x + (r() - 0.5) * s * 2.2, z + (r() - 0.5) * s * 2.2, sd, 0.8);
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
        if (x < x0 || x >= x0 + size || z < z0 || z >= z0 + size) continue;
        const s = 0.5 + r() * r() * 1.6;
        place(x, z, s, { sink: 0.3, moss: 0.35 + r() * 0.4, tilt: 0.5, shade: false });
      }
    }
    // boulders round the foot of the fall, in the sea, and flanking its lip
    const f = rv.fall;
    if (f.x > x0 - 20 && f.x < x0 + size + 20 && f.z > z0 - 40 && f.z < z0 + size + 40) {
      const rr = rngOf(hash3(ch.i, ch.j, 99));
      for (let k = 0; k < 14; k++) {
        const along = 3 + rr() * 16;
        const across = (rr() < 0.5 ? -1 : 1) * (f.w / 2 + 1.5 + rr() * 9);
        const x = f.x + f.dx * along - f.dz * across;
        const z = f.z + f.dz * along + f.dx * across;
        if (x < x0 || x >= x0 + size || z < z0 || z >= z0 + size) continue;
        S.at(x, z);
        if (S.h > 4) continue;
        place(x, z, 1.4 + rr() * 2.8, { sink: 0.3, moss: 0, tilt: 0.3, shade: false });
      }
      for (const side of [-1, 1]) {
        const x = f.x - f.dx * 3 - f.dz * side * (f.w / 2 + 2.2);
        const z = f.z - f.dz * 3 + f.dx * side * (f.w / 2 + 2.2);
        if (x < x0 || x >= x0 + size || z < z0 || z >= z0 + size) continue;
        place(x, z, 2.2 + rr() * 1.2, { sink: 0.35, moss: 0.6, tilt: 0.4 });
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
      const x = st.x + Math.cos(a) * d;
      const z = st.z + Math.sin(a) * d;
      if (x < x0 || x >= x0 + size || z < z0 || z >= z0 + size) continue;
      S.at(x, z);
      if (S.h > 2 || S.h < -3) continue;
      const sy = Math.max(1.2 + rr() * 2.4, (0.5 - S.h) / 0.42);
      putOnSlope(out, rr() < 0.5 ? "rockA" : "rockB", x, S.h - sy * 0.22, z, rr() * 6.28, sy * (1 + rr() * 0.4), sy, sy, S.gx, S.gz, rockTint(rr), 0, 0.25);
    }
  }
}

// The meadows: tufts of grass thick near the town and thinning out, ferns in the woods, drifts of wildflowers.
function meadowIn(env, out, S, r, ch, forest) {
  const { x0, z0, size } = ch;
  // the ground's colour on a coarse grid (as terrain.js paints it), read between its points
  const LS = 8;
  const LN = size / LS + 1;
  const LOOK = new Float32Array(LN * LN * 3);
  for (let j = 0; j < LN; j++)
    for (let i = 0; i < LN; i++) {
      const x = x0 + i * LS;
      const z = z0 + j * LS;
      const h = S.at(x, z);
      const c = groundLook(x, z, h, 0)[0];
      LOOK.set(c, (j * LN + i) * 3);
    }
  const look = (x, z) => {
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
  const free = (x, z, sd) => {
    if (sd < 6) return false;
    if (env.padOut(x, z) < 0.6) return false;
    if (rectOut(env.plaza, x, z) < 1.5) return false;
    if (env.lane.dist(x, z) < 1.9) return false;
    return true;
  };
  const cell = 1.75;
  const n = Math.round(size / cell);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = x0 + (i + r()) * cell;
      const z = z0 + (j + r()) * cell;
      const roll = r();
      const rad = Math.hypot(x, z);
      if (rad > MEADOW_R) continue;
      const sd = shoreDist(x, z);
      if (sd < 6) continue;
      // beach and sand
      const fo = forest(x, z);
      const clumps = smooth(-0.35, 0.45, fbm2(x / 13 + 2.2, z / 13 - 7.1, 2));
      let p = lerp(0.9, 0.16, smooth(90, MEADOW_R, rad)) * (0.5 + 0.5 * clumps);
      // ferns in clumps under the trees; a site cleared in the woods keeps only a little grass
      const wood = fo > 0.4;
      const fern = wood && env.siteOut(x, z) > 6;
      if (wood) p = fern ? 0.45 * smooth(0.4, 0.7, fo) * clumps * clumps : 0.3 * clumps;
      if (roll > p * env.detail) continue;
      if (!free(x, z, sd)) continue;
      const rv = riverAt(x, z);
      if (rv && !rv.past && rv.d < rv.w / 2 + 1.6) continue;
      const fd = fieldAt(env.farm, x, z, 0.5);
      if (fd && fd.f.kind !== 4) continue;
      S.at(x, z);
      if (S.slope > 0.42) continue;
      if (S.h < 2.6 && sd < 32) continue;
      tuftAt(out, S, r, x, z, look(x, z), fern ? 1.5 : 1, fern);
    }
  // a fringe of tufts along the lanes' edges, where the grass meets the worn earth
  for (const [ax, az, bx, bz] of env.lane.segs) {
    if (Math.max(ax, bx) < x0 - 4 || Math.min(ax, bx) > x0 + size + 4 || Math.max(az, bz) < z0 - 4 || Math.min(az, bz) > z0 + size + 4) continue;
    const L = Math.hypot(bx - ax, bz - az);
    const rr = rngOf(hash3(Math.round(ax * 10), Math.round(bz * 10), 61));
    const m = Math.floor(L / 1.1);
    for (let k = 0; k < m; k++) {
      const t = (k + rr()) / m;
      const side = rr() < 0.5 ? -1 : 1;
      const off = 2.1 + rr() * 1.1;
      const x = lerp(ax, bx, t) + (-(bz - az) / L) * off * side;
      const z = lerp(az, bz, t) + ((bx - ax) / L) * off * side;
      if (rr() > 0.7 * env.detail || x < x0 || x >= x0 + size || z < z0 || z >= z0 + size) continue;
      const sd = shoreDist(x, z);
      if (!free(x, z, sd)) continue;
      S.at(x, z);
      if (S.slope > 0.5) continue;
      tuftAt(out, S, rr, x, z, look(x, z), 1.0);
    }
  }
  // wildflowers in drifts, each drift mostly one colour
  const fc = 2.6;
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
      const p = drift * lerp(0.6, 0.2, smooth(80, MEADOW_R, rad)) + 0.04;
      if (roll > p * env.detail) continue;
      const sd = shoreDist(x, z);
      if (!free(x, z, sd)) continue;
      if (forest(x, z) > 0.3) continue;
      const rv = riverAt(x, z);
      if (rv && !rv.past && rv.d < rv.w / 2 + 1.5) continue;
      const fd = fieldAt(env.farm, x, z, 0.5);
      if (fd && fd.f.kind !== 4 && fd.f.kind !== 3) continue;
      S.at(x, z);
      if (S.slope > 0.4 || (S.h < 2.6 && sd < 32)) continue;
      const hue = fbm2(x / 40 + 3.3, z / 40 + 8.8, 2) + (r() - 0.5) * 0.35;
      let c;
      let eye = 1;
      if (hue < -0.2) c = F.yellow;
      else if (hue < 0.12) c = r() < 0.85 ? F.white : F.cream;
      else if (hue < 0.24) c = r() < 0.6 ? F.purple : F.blue;
      else if (hue < 0.32) c = F.pink;
      else {
        c = F.red;
        eye = 0;
      }
      if (c === F.purple || c === F.blue || c === F.pink) eye = r() < 0.5 ? 1 : 0;
      const s = 0.8 + r() * 0.7;
      putOnSlope(out, "flower", x, S.h, z, r() * 6.28, s, s * (0.8 + r() * 0.5), s, S.gx, S.gz, jitter(c, r, 0.4), eye, 0.7);
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
    const d = polyIn(f.poly, x, z);
    pos.push(x, h, z);
    nor.push(-gx / L, 1 / L, -gz / L);
    const fine = (S.node(i + 2, j) + S.node(i - 2, j) + S.node(i, j + 2) + S.node(i, j - 2)) / 4 - h;
    const c = d < 2.4 ? groundLook(x, z, h, fine)[0] : [0.2, 0.25, 0.1];
    col.push(c[0], c[1], c[2]);
    // the field's own frame: along its rows (u) and across them (v)
    const dx = x - f.ox;
    const dz = z - f.oz;
    fld.push(dx * f.ux + dz * f.uz, -dx * f.uz + dz * f.ux, f.kind, d);
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

// One kind of thing for the whole coast: an InstancedMesh its chunks' instances are gathered into.
class Batch {
  constructor(group, name, geo, material, { cast = false, receive = true } = {}) {
    this.group = group;
    this.name = name;
    this.geo = geo;
    this.material = material;
    this.cast = cast;
    this.receive = receive;
    this.mesh = null;
    this.cap = 0;
    this.count = 0;
  }
  alloc(cap) {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    const g = this.geo.clone();
    g.setAttribute("aTint", new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4));
    const m = new THREE.InstancedMesh(g, this.material, cap);
    m.name = "dress-" + this.name;
    m.frustumCulled = false;
    m.castShadow = this.cast;
    m.receiveShadow = this.receive;
    m.matrixAutoUpdate = false;
    this.mesh = m;
    this.cap = cap;
    this.group.add(m);
  }
  fill(chunks) {
    let n = 0;
    for (const c of chunks) n += c.out.k[this.name]?.n || 0;
    if (!this.mesh || n > this.cap) this.alloc(Math.max(16, Math.ceil(n * 1.12)));
    const M = this.mesh.instanceMatrix.array;
    const T = this.mesh.geometry.attributes.aTint.array;
    let o = 0;
    for (const c of chunks) {
      const e = c.out.k[this.name];
      if (!e || !e.n) continue;
      M.set(e.m.subarray(0, e.n * 16), o * 16);
      T.set(e.t.subarray(0, e.n * 4), o * 4);
      o += e.n;
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.geometry.attributes.aTint.needsUpdate = true;
    this.count = n;
  }
  get triangles() {
    return (this.geo.index ? this.geo.index.count / 3 : this.geo.attributes.position.count / 3) * this.count;
  }
  dispose() {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    this.geo.dispose();
  }
}

// ------------------------------------------------------------------ the whole

// A lane as its points: [[x, z], ...] as given, or a lane object's own points ({ points }).
const lanePoints = (list) => list.map((l) => (Array.isArray(l) ? l : l?.points)).filter((l) => Array.isArray(l) && l.length > 1);

export function makeDressing(stage, ground, { lanes: lanes0 = [], detail: detail0 = 1 } = {}) {
  const t0 = performance.now();
  const lanes = lanePoints(lanes0);
  const detail = clamp(detail0, 0.25, 1);
  const group = new THREE.Group();
  group.name = "dressing";
  const DOUBLE = THREE.DoubleSide;
  const mats = {
    foliage: dressMaterial("foliage", { FOLIAGE: 1 }),
    rock: dressMaterial("rock", { ROCK: 1 }, { derivatives: true }),
    wall: dressMaterial("wall", { WALL: 1 }),
    solid: dressMaterial("solid", { SOLID: 1 }),
    grass: dressMaterial("grass", { GRASS: 1, FADE_FAR: 1 }, { side: DOUBLE, fade: [330, 520], map: grassTexture(), derivatives: true }),
    blossom: dressMaterial("blossom", { BLOSSOM: 1, FADE_FAR: 1 }, { side: DOUBLE, fade: [380, 600] }),
    decal: decalMaterial(),
    fields: fieldMaterial(),
  };
  const batches = [
    new Batch(group, "spruce", spruceGeo(0), mats.foliage, { cast: true }),
    new Batch(group, "spruceLo", spruceGeo(1), mats.foliage, { cast: true }),
    new Batch(group, "spruceDist", spruceGeo(2), mats.foliage, { cast: false }),
    new Batch(group, "pine", pineGeo(), mats.foliage, { cast: true }),
    new Batch(group, "broad", broadGeo(), mats.foliage, { cast: true }),
    new Batch(group, "birch", birchGeo(), mats.foliage, { cast: true }),
    new Batch(group, "bush", bushGeo(), mats.foliage, { cast: true }),
    new Batch(group, "rockA", rockGeo(0), mats.rock, { cast: true }),
    new Batch(group, "rockB", rockGeo(1), mats.rock, { cast: true }),
    new Batch(group, "wall", wallGeo(), mats.wall, { cast: true }),
    new Batch(group, "fence", fenceGeo(), mats.solid, { cast: true }),
    new Batch(group, "hay", hayGeo(), mats.solid, { cast: true }),
    new Batch(group, "tuft", tuftGeo(), mats.grass),
    new Batch(group, "flower", flowerGeo(), mats.blossom),
    new Batch(group, "decal", decalGeo(), mats.decal, { receive: false }),
  ];
  // the chunks: CORE's, then the far ones round it
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
  let env = makeEnv(ground, lanes, detail);
  for (const c of chunks) c.out = growChunk(env, c);
  env.grids = null;
  for (const b of batches) b.fill(chunks);
  buildFields();
  const stats = {};
  const count = () => {
    stats.chunks = chunks.length;
    stats.counts = Object.fromEntries(batches.map((b) => [b.name, b.count]));
    stats.trianglesBy = Object.fromEntries(batches.map((b) => [b.name, Math.round(b.triangles)]));
    stats.triangles = Math.round(batches.reduce((s, b) => s + b.triangles, 0) + (fieldMesh ? fieldMesh.geometry.index.count / 3 : 0));
    stats.drawCalls = batches.filter((b) => b.count).length + (fieldMesh ? 1 : 0);
    stats.shadowCalls = batches.filter((b) => b.count && b.cast).length;
    stats.fields = env.farm.fields.length;
  };
  stats.ms = Math.round(performance.now() - t0);
  count();
  let laneKeys = new Set(lanes.map((l) => JSON.stringify(l)));
  return {
    group,
    stats,
    // Grows again the chunks any of rects (or a lane that came or went) touches, on the new ground.
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
      env = makeEnv(next, nextLanes, detail);
      const M = 14;
      let n = 0;
      for (const c of chunks) {
        if (!all.some((q) => q.x1 >= c.x0 - M && q.x0 <= c.x0 + c.size + M && q.z1 >= c.z0 - M && q.z0 <= c.z0 + c.size + M)) continue;
        c.out = growChunk(env, c);
        n++;
      }
      env.grids = null;
      if (n) {
        for (const b of batches) b.fill(chunks);
        buildFields();
      }
      count();
      stats.updateMs = Math.round(performance.now() - t1);
      stats.updated = n;
      if (stage) stage.still = true;
      return n;
    },
    dispose() {
      for (const b of batches) b.dispose();
      if (fieldMesh) fieldMesh.geometry.dispose();
      for (const m of Object.values(mats)) m.dispose();
    },
  };
}
