// The coast's land in 3D: the ground of ./coast.js as tiles of mesh, with a
// material of its own that paints it where it stands: grass in broad patches
// and fine grain (so the texture is the land's, and moves with it), rock in
// layers wherever the ground is steep, sand, river banks, forest floor, the
// snow on the peaks, and the lanes worn into the grass.
//
//   makeTerrain(ground)   ground: coast.js groundOf(active pads)
//     -> { group, tiles, material, rebuild(ground, rects), setPaths(lanes), dispose() }
//   rebuild() makes again only the tiles a changed pad touches (rects: [{ x0, z0, x1, z1 }]).
//   setPaths([[[x, z], ...], ...]) wears those lanes into the grass.
//
// The town and the cove are tiles TILE metres square at STEP metres; past
// them one coarse grid runs out to the horizon, its edge meeting the tiles'
// exactly. The light is the kit's (the same sun, sky and haze as the builds),
// but true to the slope, so the hills show their shape.

import * as THREE from "three";
import { WORLD_R, fbm2, forestAt, noise2, riverAt, shoreDist, smooth } from "./coast.js";
import { noiseTexture } from "./glade.js";

export const TILE = 64;
export const STEP = 2;
// the tiles cover x0..x1, z0..z1; the far grid the rest (every bound a multiple of FAR_STEP from -WORLD_R)
export const CORE = { x0: -448, x1: 448, z0: -704, z1: 256 };
const FAR_STEP = 16;
// tiles nearer the plaza than this are at STEP, the rest at twice it
const NEAR = 360;
// the lanes' picture covers this much of the world
const PATH_BOX = { x0: -380, z0: -720, x1: 380, z1: 120 };
const PATH_PX = 1024;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const lin = (hex) => {
  const c = new THREE.Color(hex).convertSRGBToLinear();
  return [c.r, c.g, c.b];
};

export const PALETTE = {
  grass: "#7f9a4e",
  grassLush: "#5e8047",
  grassDry: "#aaa36a",
  meadow: "#97aa5c",
  forest: "#4d6538",
  sand: "#e6d6ab",
  sandWet: "#bfae82",
  seabed: "#c4b68c",
  deep: "#6f8a83",
  mud: "#7f7258",
  snow: "#f1f3f5",
  rockA: "#8f897e",
  rockB: "#b5ad9d",
  dirt: "#bba98a",
  dirtDark: "#97856a",
};
const C = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, lin(v)]));

// The colour a point of ground is before the light (linear), and what it is:
// [r, g, b], soil [grass 0..1, forest floor 0..1, wet 0..1, snow 0..1].
// cav: how much the ground round it stands above it (a hollow is positive).
export function groundLook(x, z, h, cav) {
  const dc = shoreDist(x, z);
  const n1 = fbm2(x / 52 + 3.3, z / 52 - 1.2, 3);
  const n2 = noise2(x / 11 + 7.7, z / 11 + 1.9);
  // grass: lush in the hollows and low by the water, drier and paler on the high bare ground
  let c = mix3(C.grass, C.meadow, clamp(n1 * 1.5 + 0.2, 0, 1) * 0.6);
  c = mix3(c, C.grassLush, clamp(cav * 0.22 + (-n1 - 0.1) * 1.2, 0, 1) * 0.75);
  c = mix3(c, C.grassDry, clamp(smooth(30, 110, h) * 0.6 - cav * 0.08 + n2 * 0.25, 0, 1) * 0.6);
  let grass = 1;
  let wet = 0;
  // forest floor under the trees
  const rv = riverAt(x, z);
  const fo = forestAt(x, z, h, rv);
  if (fo > 0) c = mix3(c, C.forest, smooth(0.15, 0.7, fo) * 0.85);
  // river banks: wet earth at the water's edge
  if (rv && !rv.past) {
    const e = 1 - smooth(rv.w / 2 + 0.3, rv.w / 2 + 2.2, rv.d);
    if (e > 0) {
      c = mix3(c, C.mud, e);
      grass -= e;
      wet = Math.max(wet, e);
    }
  }
  // sand on the beach and under the shallows, the sea bed darker as it deepens
  const beach = (1 - smooth(1.2, 2.6, h)) * (1 - smooth(8, 30, dc));
  if (h < 0.4) {
    const under = smooth(0.4, -1.2, h);
    let s = mix3(C.sandWet, C.seabed, under);
    s = mix3(s, C.deep, smooth(-3, -16, h));
    const k = Math.max(under, beach);
    c = mix3(c, s, k);
    grass -= k;
    wet = Math.max(wet, 1 - smooth(-0.5, 0.4, h) * 0.5);
  } else if (beach > 0) {
    c = mix3(c, mix3(C.sand, C.sandWet, smooth(1.0, 0.4, h)), beach);
    grass -= beach;
    wet = Math.max(wet, smooth(1.0, 0.4, h) * beach);
  }
  // the peaks: snow on the tops
  let snow = 0;
  if (h > 100) {
    snow = smooth(122 + n1 * 16, 138 + n1 * 16, h);
    c = mix3(c, C.snow, snow);
    grass -= snow;
  }
  return [c, [clamp(grass, 0, 1), fo, clamp(wet, 0, 1), snow]];
}

// The coarse hollowness of the ground round a tile: heights every 8 m with a border of two, and a reader.
function hollows(ground, x0, z0, size) {
  const S = 8;
  const n = Math.round(size / S) + 1 + 4;
  const H = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) H[j * n + i] = ground.height(x0 + (i - 2) * S, z0 + (j - 2) * S);
  const cav = new Float32Array(n * n);
  for (let j = 2; j < n - 2; j++)
    for (let i = 2; i < n - 2; i++) {
      const k = j * n + i;
      const near = (H[k - 1] + H[k + 1] + H[k - n] + H[k + n]) / 4;
      const far = (H[k - 2] + H[k + 2] + H[k - 2 * n] + H[k + 2 * n]) / 4;
      cav[k] = (near - H[k]) * 0.6 + (far - H[k]) * 0.4;
    }
  return (x, z) => {
    const fx = clamp((x - x0) / S + 2, 2, n - 3.001);
    const fz = clamp((z - z0) / S + 2, 2, n - 3.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const k = j * n + i;
    return (cav[k] * (1 - u) + cav[k + 1] * u) * (1 - v) + (cav[k + n] * (1 - u) + cav[k + n + 1] * u) * v;
  };
}

// How much sky a point sees, from how hollow it is (fine: the 2 m grid round it; broad: the 8 m one).
const aoOf = (fine, broad) => clamp(1 - fine * 0.09 - broad * 0.035, 0.5, 1.12);

// The height at a point on the tiles' outer edge, as the far grid sees it (straight between its vertices), so the two meet.
function edgeHeight(ground, x, z) {
  const onX = x === CORE.x0 || x === CORE.x1;
  const onZ = z === CORE.z0 || z === CORE.z1;
  if (!onX && !onZ) return null;
  const along = onX ? z : x;
  const a = Math.floor(along / FAR_STEP) * FAR_STEP;
  if (a === along) return ground.height(x, z);
  const t = (along - a) / FAR_STEP;
  const h0 = onX ? ground.height(x, a) : ground.height(a, z);
  const h1 = onX ? ground.height(x, a + FAR_STEP) : ground.height(a + FAR_STEP, z);
  return h0 + (h1 - h0) * t;
}

// One tile's mesh: n x n quads from (x0, z0), `step` apart, with a skirt round it.
function tileGeo(ground, x0, z0, size, step) {
  const n = Math.round(size / step);
  const B = 2;
  const N = n + 1 + 2 * B;
  // heights with a border, for normals and hollows that match across tiles
  const H = new Float32Array(N * N);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = x0 + (i - B) * step;
      const z = z0 + (j - B) * step;
      H[j * N + i] = edgeHeight(ground, x, z) ?? ground.height(x, z);
    }
  const broad = hollows(ground, x0, z0, size);
  const V = (n + 1) * (n + 1);
  const S = 4 * n;
  const pos = new Float32Array((V + S) * 3);
  const nor = new Float32Array((V + S) * 3);
  const col = new Float32Array((V + S) * 3);
  const soil = new Float32Array((V + S) * 4);
  const ao = new Float32Array(V + S);
  const at = (i, j) => H[(j + B) * N + (i + B)];
  let v = 0;
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++, v++) {
      const x = x0 + i * step;
      const z = z0 + j * step;
      const h = at(i, j);
      const gx = (at(i + 1, j) - at(i - 1, j)) / (2 * step);
      const gz = (at(i, j + 1) - at(i, j - 1)) / (2 * step);
      const L = Math.hypot(gx, 1, gz);
      pos.set([x, h, z], v * 3);
      nor.set([-gx / L, 1 / L, -gz / L], v * 3);
      const fine = (at(i + 2, j) + at(i - 2, j) + at(i, j + 2) + at(i, j - 2)) / 4 - h;
      const cav = broad(x, z);
      const [c, s] = groundLook(x, z, h, cav + fine);
      col.set(c, v * 3);
      soil.set(s, v * 4);
      ao[v] = aoOf(fine, cav);
    }
  const idx = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i;
      const b = a + 1;
      const c = a + (n + 1);
      const d = c + 1;
      // split each quad along the diagonal that follows the ground best
      if (Math.abs(pos[a * 3 + 1] - pos[d * 3 + 1]) < Math.abs(pos[b * 3 + 1] - pos[c * 3 + 1])) idx.push(a, c, d, a, d, b);
      else idx.push(a, c, b, b, c, d);
    }
  // the skirt: the edge's vertices again, lowered, so a coarser neighbour never shows a crack
  const edge = [];
  for (let i = 0; i < n; i++) edge.push(i);
  for (let j = 0; j < n; j++) edge.push(j * (n + 1) + n);
  for (let i = n; i > 0; i--) edge.push(n * (n + 1) + i);
  for (let j = n; j > 0; j--) edge.push(j * (n + 1));
  const drop = Math.max(1.5, step * 1.5);
  edge.forEach((e, k) => {
    const s = V + k;
    pos.set([pos[e * 3], pos[e * 3 + 1] - drop, pos[e * 3 + 2]], s * 3);
    nor.set(nor.subarray(e * 3, e * 3 + 3), s * 3);
    col.set(col.subarray(e * 3, e * 3 + 3), s * 3);
    soil.set(soil.subarray(e * 4, e * 4 + 4), s * 4);
    ao[s] = ao[e];
  });
  const E = edge.length;
  for (let k = 0; k < E; k++) {
    const a = edge[k];
    const b = edge[(k + 1) % E];
    const sa = V + k;
    const sb = V + ((k + 1) % E);
    idx.push(a, sa, b, b, sa, sb, a, b, sa, b, sb, sa);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aSoil", new THREE.BufferAttribute(soil, 4));
  g.setAttribute("aAO", new THREE.BufferAttribute(ao, 1));
  g.setIndex(new THREE.BufferAttribute(V + S > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

// Whether a tile is open sea, deep all over: it can be coarse.
function deepTile(ground, x0, z0, size) {
  for (let j = 0; j <= 4; j++)
    for (let i = 0; i <= 4; i++) {
      const x = x0 + (i * size) / 4;
      const z = z0 + (j * size) / 4;
      if (shoreDist(x, z) > -40 || ground.height(x, z) > -6) return false;
    }
  return true;
}

// The far land and sea floor out to the horizon, coarse, with a hole where the tiles are.
function farGeo(ground) {
  const R = WORLD_R;
  const n = Math.round((2 * R) / FAR_STEP);
  const idxOf = new Int32Array((n + 1) * (n + 1)).fill(-1);
  const pos = [];
  const nor = [];
  const col = [];
  const soil = [];
  const ao = [];
  const inCore = (x, z) => x >= CORE.x0 && x <= CORE.x1 && z >= CORE.z0 && z <= CORE.z1;
  // heights on the grid, each found once (a border of one round it for the slopes)
  const W = n + 3;
  const H = new Float32Array(W * W).fill(NaN);
  const hAt = (i, j) => {
    const k = (j + 1) * W + (i + 1);
    if (Number.isNaN(H[k])) H[k] = ground.height(-R + i * FAR_STEP, -R + j * FAR_STEP);
    return H[k];
  };
  const vert = (i, j) => {
    const k = j * (n + 1) + i;
    if (idxOf[k] >= 0) return idxOf[k];
    const x = -R + i * FAR_STEP;
    const z = -R + j * FAR_STEP;
    const h = hAt(i, j);
    const e = FAR_STEP;
    const hx0 = hAt(i - 1, j);
    const hx1 = hAt(i + 1, j);
    const hz0 = hAt(i, j - 1);
    const hz1 = hAt(i, j + 1);
    const gx = (hx1 - hx0) / (2 * e);
    const gz = (hz1 - hz0) / (2 * e);
    const L = Math.hypot(gx, 1, gz);
    const cav = (hx0 + hx1 + hz0 + hz1) / 4 - h;
    const [c, s] = groundLook(x, z, h, cav);
    pos.push(x, h, z);
    nor.push(-gx / L, 1 / L, -gz / L);
    col.push(...c);
    soil.push(...s);
    ao.push(aoOf(0, cav * 0.5));
    idxOf[k] = pos.length / 3 - 1;
    return idxOf[k];
  };
  const idx = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = -R + i * FAR_STEP;
      const z = -R + j * FAR_STEP;
      if (Math.hypot(x + FAR_STEP / 2, z + FAR_STEP / 2) > R) continue;
      // under the tiles: left out (the bounds are on this grid, so a cell is all in or all out)
      if (inCore(x, z) && inCore(x + FAR_STEP, z + FAR_STEP)) continue;
      const a = vert(i, j);
      const b = vert(i + 1, j);
      const c = vert(i, j + 1);
      const d = vert(i + 1, j + 1);
      if (Math.abs(pos[a * 3 + 1] - pos[d * 3 + 1]) < Math.abs(pos[b * 3 + 1] - pos[c * 3 + 1])) idx.push(a, c, d, a, d, b);
      else idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("aSoil", new THREE.Float32BufferAttribute(soil, 4));
  g.setAttribute("aAO", new THREE.Float32BufferAttribute(ao, 1));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

// ------------------------------------------------------------------ the ground's paint

const TERRAIN_VERT = [
  "attribute vec4 aSoil; attribute float aAO;",
  "varying vec3 vPW; varying vec3 vNW; varying vec4 vSoil; varying float vAO;",
].join("\n");
const TERRAIN_FRAG = [
  "uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uGndCol; uniform vec3 uFogCol; uniform vec3 uFog; uniform float uShadeLift;",
  "uniform sampler2D uStroke; uniform sampler2D uNoise; uniform sampler2D uPaths; uniform vec4 uPathBox;",
  "uniform vec3 uRockA; uniform vec3 uRockB; uniform vec3 uDirt; uniform vec3 uDirtDark;",
  "varying vec3 vPW; varying vec3 vNW; varying vec4 vSoil; varying float vAO;",
].join("\n");
const TERRAIN_MAIN = [
  "vec3 N = normalize(vNW);",
  "vec2 p = vPW.xz;",
  "float camD = length(vPW - cameraPosition);",
  "vec4 nA = texture2D(uNoise, p / 310.0);",
  "vec4 nB = texture2D(uNoise, p / 73.0 + 0.31);",
  "vec4 nC = texture2D(uNoise, p / 15.0 + 0.57);",
  "vec4 nD = texture2D(uNoise, p / 3.3 + 0.19);",
  "vec3 alb = diffuseColor.rgb;",
  "float gr = vSoil.x;",
  // grass: patches at every scale, warm dry ones and cool lush ones, and a painted grain that belongs to the ground
  "float brush = texture2D(uStroke, p * 0.31).r - 0.5;",
  "float vary = (nB.r - 0.5) * 0.7 + (nC.g - 0.5) * 0.55 + (nD.a - 0.5) * 0.5 + brush * 0.5;",
  "alb *= 1.0 + vary * 0.3 * gr;",
  // the kit's brush, as on the builds' own grass: dabs of light and dark, warm and cool
  "vec4 stA = texture2D(uStroke, p * 0.32 + 0.37);",
  "vec4 stB = texture2D(uStroke, p * 0.067 + 3.1);",
  "float sM = stB.g - 0.5;",
  "alb *= 1.0 + ((stA.r - 0.5) * 0.3 + (stA.b - 0.5) * 0.14) * gr;",
  "alb = mix(alb, alb * vec3(1.1, 0.98, 0.84), clamp(sM * 2.2, 0.0, 1.0) * 0.6 * gr);",
  "alb = mix(alb, alb * vec3(0.86, 0.95, 1.06), clamp(-sM * 2.2, 0.0, 1.0) * 0.6 * gr);",
  // close to, clumps of clover, gone by the time the whole town is in view
  "float nearK = 1.0 - smoothstep(50.0, 240.0, camD);",
  "if (nearK > 0.0) {",
  "  vec4 nE = texture2D(uNoise, p / 1.15 + 0.73);",
  "  alb = mix(alb, alb * vec3(0.84, 0.95, 0.82), smoothstep(0.6, 0.78, nE.g) * 0.5 * gr * nearK);",
  "}",
  "float dry = clamp((nA.r - 0.5) * 2.4 + (nC.b - 0.5) * 0.9, -1.0, 1.0);",
  "alb = mix(alb, alb * vec3(1.12, 1.05, 0.72), max(dry, 0.0) * 0.5 * gr);",
  "alb = mix(alb, alb * vec3(0.84, 0.97, 1.02), max(-dry, 0.0) * 0.45 * gr);",
  // sand and earth: a finer grain
  "alb *= 1.0 + ((nD.b - 0.5) * 0.12 + brush * 0.08) * (1.0 - gr);",
  // the lanes worn into the grass, soft at the edges, broken by tufts
  "vec2 pu = (p - uPathBox.xy) * uPathBox.zw;",
  "float lane = 0.0;",
  "if (pu.x > 0.0 && pu.x < 1.0 && pu.y > 0.0 && pu.y < 1.0) {",
  "  float pm = texture2D(uPaths, pu).r;",
  "  lane = smoothstep(0.32, 0.62, pm + (nC.a - 0.5) * 0.3 + (nD.r - 0.5) * 0.28) * step(0.01, pm);",
  "  vec3 dirt = mix(uDirt, uDirtDark, clamp(nD.g * 0.7 + (nC.r - 0.5) * 0.6 + (1.0 - pm) * 0.3, 0.0, 1.0));",
  "  alb = mix(alb, dirt, lane);",
  "}",
  // rock wherever the ground is steep: laid down in layers, a dark seam under each and a lit lip on top, moss on the ledges
  "float slope = 1.0 - N.y;",
  "float rk = smoothstep(0.26, 0.38, slope + (nC.r - 0.5) * 0.16 + (nD.g - 0.5) * 0.07);",
  "rk = max(rk, smoothstep(0.55, 0.7, slope));",
  // along the face (for streaks that run down it) and up it (for the layers)
  "vec2 fd = normalize(vec2(-N.z, N.x) + 1e-4);",
  "float fu = dot(p, fd);",
  "float ly = vPW.y + (nB.b - 0.5) * 9.0 + (texture2D(uNoise, vec2(fu / 31.0, vPW.y / 40.0)).r - 0.5) * 4.0;",
  "float band = fract(ly / 5.2);",
  "float layer = floor(ly / 5.2);",
  "float lk = fract(sin(layer * 12.9898) * 43758.5453);",
  "vec3 rock = mix(uRockA, uRockB, clamp(lk * 0.7 + (nB.g - 0.5) * 0.8 + (nD.r - 0.5) * 0.3, 0.0, 1.0));",
  "rock *= mix(vec3(1.0), vec3(1.06, 1.0, 0.9), smoothstep(0.4, 0.9, lk));",
  "float seam = smoothstep(0.0, 0.07, band) * (1.0 - smoothstep(0.93, 1.0, band) * 0.3);",
  "rock *= mix(0.74, 1.0, seam);",
  // streaks down the face where water runs, and the cracks between blocks
  "float streak = texture2D(uNoise, vec2(fu / 4.5, vPW.y / 26.0)).a;",
  "rock *= 0.86 + streak * 0.24;",
  "float crack = smoothstep(0.035, 0.0, abs(texture2D(uNoise, vec2(fu / 9.0, layer * 0.37)).g - 0.5));",
  "rock *= 1.0 - crack * 0.25;",
  "rock *= 0.94 + (nD.b - 0.5) * 0.2;",
  "rock = mix(rock, alb * 0.9, smoothstep(0.62, 0.86, N.y) * 0.55 * (1.0 - vSoil.w));",
  "alb = mix(alb, rock, rk);",
  // the light: the kit's sun, sky and haze, true to the slope so the hills read; shade takes the sky's blue
  "float sh = smoothstep(0.1, 0.9, pShadow);",
  "float ndl = dot(N, uSunDir);",
  "float lam = clamp(ndl * 0.92 + 0.08, 0.0, 1.0);",
  "float lit = lam * sh;",
  "float ao = vAO;",
  "vec3 direct = uSunCol * lit * mix(0.8, 1.0, clamp(ao, 0.0, 1.0));",
  "float up = N.y * 0.5 + 0.5;",
  "vec3 amb = mix(uGndCol, uSkyCol, up) * ao;",
  "vec3 c = alb * (direct + amb);",
  "c += alb * uSkyCol * smoothstep(0.55, 0.95, N.y) * (1.0 - lit) * uShadeLift * 0.5 * ao;",
  "float f = smoothstep(uFog.x, uFog.y, camD) * 0.94;",
  "c = mix(c, uFogCol, f);",
  "gl_FragColor = vec4(c, clamp(lit, 0.0, 1.0));",
].join("\n");

export function terrainMaterial(paths) {
  const G = window.KIT.G;
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  const U = {
    uNoise: { value: noiseTexture() },
    uPaths: { value: paths },
    uPathBox: { value: new THREE.Vector4(PATH_BOX.x0, PATH_BOX.z0, 1 / (PATH_BOX.x1 - PATH_BOX.x0), 1 / (PATH_BOX.z1 - PATH_BOX.z0)) },
    uRockA: { value: new THREE.Vector3(...C.rockA) },
    uRockB: { value: new THREE.Vector3(...C.rockB) },
    uDirt: { value: new THREE.Vector3(...C.dirt) },
    uDirtDark: { value: new THREE.Vector3(...C.dirtDark) },
  };
  m.onBeforeCompile = (sh) => {
    for (const k of ["uSunDir", "uSunCol", "uSkyCol", "uGndCol", "uFogCol", "uFog", "uShadeLift", "uStroke"]) sh.uniforms[k] = G[k];
    Object.assign(sh.uniforms, U);
    sh.vertexShader =
      TERRAIN_VERT +
      "\n" +
      sh.vertexShader.replace(
        "#include <project_vertex>",
        "#include <project_vertex>\n  vPW = (modelMatrix * vec4(transformed, 1.0)).xyz; vNW = normalize(mat3(modelMatrix) * objectNormal); vSoil = aSoil; vAO = aAO;",
      );
    sh.fragmentShader =
      TERRAIN_FRAG +
      "\n" +
      sh.fragmentShader
        .replace("reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();", "float pShadow = getShadowMask();")
        .replace("gl_FragColor = vec4( outgoingLight, diffuseColor.a );", TERRAIN_MAIN);
  };
  m.customProgramCacheKey = () => "glade-terrain";
  m.userData.uniforms = U;
  return m;
}

// The lanes' picture: white where a lane is worn, soft at the edges.
function drawPaths(canvas, lanes) {
  const g = canvas.getContext("2d");
  g.clearRect(0, 0, PATH_PX, PATH_PX);
  const sx = PATH_PX / (PATH_BOX.x1 - PATH_BOX.x0);
  const sz = PATH_PX / (PATH_BOX.z1 - PATH_BOX.z0);
  g.lineCap = g.lineJoin = "round";
  // soft edges from strokes of falling width (canvas filters are not everywhere)
  for (const [w, a] of [[4.4, 0.16], [3.6, 0.3], [2.9, 0.55], [2.2, 1]]) {
    g.strokeStyle = `rgba(255,255,255,${a})`;
    g.lineWidth = w * sx;
    for (const pts of lanes) {
      if (pts.length < 2) continue;
      g.beginPath();
      pts.forEach(([x, z], i) => {
        const px = (x - PATH_BOX.x0) * sx;
        const pz = (z - PATH_BOX.z0) * sz;
        if (i) g.lineTo(px, pz);
        else g.moveTo(px, pz);
      });
      g.stroke();
    }
  }
}

export function makeTerrain(ground) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PATH_PX;
  const paths = new THREE.CanvasTexture(canvas);
  paths.flipY = false;
  paths.minFilter = THREE.LinearFilter;
  paths.generateMipmaps = false;
  const material = terrainMaterial(paths);
  const group = new THREE.Group();
  group.name = "terrain";
  const tiles = new Map();
  const mesh = (g, shadows) => {
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    m.castShadow = shadows;
    return m;
  };
  const makeTile = (tx, tz) => {
    const x0 = CORE.x0 + tx * TILE;
    const z0 = CORE.z0 + tz * TILE;
    const deep = deepTile(ground, x0, z0, TILE);
    // finest round the town and the cove, coarser out on the hills
    const near = Math.hypot(clamp(0, x0, x0 + TILE), clamp(0, z0, z0 + TILE)) < NEAR;
    const m = mesh(tileGeo(ground, x0, z0, TILE, deep ? 16 : near ? STEP : STEP * 2), !deep);
    m.userData.tile = [tx, tz];
    return m;
  };
  const NX = (CORE.x1 - CORE.x0) / TILE;
  const NZ = (CORE.z1 - CORE.z0) / TILE;
  for (let tz = 0; tz < NZ; tz++)
    for (let tx = 0; tx < NX; tx++) {
      const m = makeTile(tx, tz);
      tiles.set(`${tx},${tz}`, m);
      group.add(m);
    }
  const far = mesh(farGeo(ground), false);
  group.add(far);
  return {
    group,
    tiles,
    material,
    // Makes again the tiles any of rects ({ x0, z0, x1, z1 }) touch, on the new ground.
    rebuild(next, rects) {
      ground = next;
      for (const [key, m] of tiles) {
        const [tx, tz] = m.userData.tile;
        const x0 = CORE.x0 + tx * TILE;
        const z0 = CORE.z0 + tz * TILE;
        if (!rects.some((r) => r.x1 >= x0 && r.x0 <= x0 + TILE && r.z1 >= z0 && r.z0 <= z0 + TILE)) continue;
        const fresh = makeTile(tx, tz);
        group.remove(m);
        m.geometry.dispose();
        group.add(fresh);
        tiles.set(key, fresh);
      }
    },
    setPaths(lanes) {
      drawPaths(canvas, lanes);
      paths.needsUpdate = true;
    },
    dispose() {
      group.traverse((o) => o.isMesh && o.geometry.dispose());
      material.dispose();
      paths.dispose();
    },
  };
}
