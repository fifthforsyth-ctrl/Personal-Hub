// The village's life: everything on the coast that moves but the water.
// Gulls wheel over the cove, the cliffs and the sea stacks, gliding with now
// and then a few beats of the wings and banking into their turns; some stand
// on the stacks, the pier and the wet sand turning their heads; terns skim
// the cove and a few crows circle the woods. Horses graze the headlands'
// pastures and a meadow up the valley in small herds, heads down, now and
// then walking on, or trotting; flocks of sheep shuffle round the town's
// edges and up the hills. In the cove two fishing boats bob at the pier and
// a third is rowed slowly round, and out at sea a longship with a striped
// sail and a row of shields cruises a long loop, its oars dipping.
//
//   const life = makeLife(stage, ground, { pads, fields })
//     -> { group, update(t, dt), setGround(ground, { pads }), dispose(), stats, where(kind, i, j, t) }
//   ground: coast.js groundOf(active pads); pads: its pads (the plaza and every levelled build pad).
//   fields (optional): the headlands' fields as dressing.js lays them out, [{ poly: [[x, z] x4], kind }] (kind
//     0 wheat, 1 green rows, 2 fallow, 3 hay meadow, 4 pasture). Given them, a herd near a pasture or a hay
//     meadow grazes inside its walls, and no herd walks through a field or its wall.
//   update(t) poses everything for the time t in seconds: the same t gives the same picture (dt is not needed).
//   setGround() takes a new ground: a herd whose pasture a new pad now covers finds another near it.
//   where(kind, i, j, t) -> [x, y, z]: where a thing is at t ("herd" i member j, "boat" i, "flock" i bird j), for a camera.
//
// Everything is in the stage's moving layer (stage.moving), so nothing here
// casts a shadow in the sun's map: each animal has its own soft contact
// shadow and a softer one cast away from the sun, and each boat a shade, a
// ring of foam and a wake on the water. Eight draw calls: horses, sheep,
// birds in flight, birds standing, the fishing boats, the longship, the
// shadows on the ground and the marks on the water. Each kind is one
// InstancedMesh whose parts (legs, necks, wings, oars, rowers, the sail) are
// posed in its vertex shader from a few numbers per instance set here each
// frame. How things move is worked out in closed form from t (a herd's
// walks and rests come from a table of its own, a bird's circle from a few
// sines), so nothing accumulates and nothing is allocated per frame. The
// light is the land's (terrain.js): the kit's sun with a little wrap times
// the still layer's shadow, sky and ground filling the shade, the shade
// lifted toward the sky's blue, a warm rim, the same haze.

import * as THREE from "three";
import { CORE, tileStep } from "./terrain.js";
import { PIER, STACKS, forestAt, heightAt, naturalAt, noise2, rectOut, riverAt, shoreDist, smooth } from "./coast.js";
import { noiseTexture } from "./glade.js";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const lin = (hex) => {
  const c = new THREE.Color(hex).convertSRGBToLinear();
  return [c.r, c.g, c.b];
};
// a linear colour a little lighter or darker, warmer or cooler
const nudge = (c, k, warm = 0) => [c[0] * k * (1 + warm), c[1] * k, c[2] * k * (1 - warm)];
const pick = (list, r) => list[Math.floor(r * list.length) % list.length];

// ------------------------------------------------------------------ seeds and wandering

// A number from three integers, well mixed.
function hash3(a, b, c) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

// A stream of numbers in [0, 1) from a seed (xorshift).
function rngOf(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

// A smooth wandering line in [-1, 1] along x, one for each seed.
const wander = (x, seed) => noise2(x, seed * 13.37 + 0.41);

// A value that holds still and now and then turns quickly to the next (a bird's head, a glance).
function jerky(t, rate, seed) {
  const f = t * rate + seed;
  const k = Math.floor(f);
  const u = smooth(0.82, 1, f - k);
  return lerp(noise2(k * 0.731, seed), noise2((k + 1) * 0.731, seed), u);
}

// ------------------------------------------------------------------ small vector helpers (arrays)

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const L = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / L, a[1] / L, a[2] / L];
};

// ------------------------------------------------------------------ shapes

// What each vertex carries: position, normal, a colour (linear), a zone (what it is, for the shader's colours), a bone
// (part + weight * 0.45, then the part's pivot), how much sky it sees, and a (u, v) on its surface.
class Geo {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.zone = [];
    this.bone = [];
    this.ao = [];
    this.uv = [];
    this.idx = [];
  }
  get count() {
    return this.pos.length / 3;
  }
  // A piece: vertices V (flat), triangles F (flat, local indices), normals N (flat) or found smooth from the faces.
  // o.col / zone / bone / ao / uv: a value, or a function (p, n, i) of each vertex.
  prim(V, F, o = {}, N = null) {
    const base = this.count;
    const n = V.length / 3;
    if (!N) N = smoothNormals(V, F);
    const val = (k, d, p, nn, i) => {
      const f = o[k];
      if (f === undefined) return d;
      return typeof f === "function" ? f(p, nn, i) : f;
    };
    for (let i = 0; i < n; i++) {
      const p = [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]];
      const nn = [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]];
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nn[0], nn[1], nn[2]);
      const c = val("col", WHITE, p, nn, i);
      this.col.push(c[0], c[1], c[2]);
      this.zone.push(val("zone", 0, p, nn, i));
      const b = val("bone", BONE0, p, nn, i);
      this.bone.push(b[0], b[1], b[2], b[3]);
      this.ao.push(val("ao", 1, p, nn, i));
      const u = val("uv", UV0, p, nn, i);
      this.uv.push(u[0], u[1]);
    }
    for (let i = 0; i < F.length; i++) this.idx.push(base + F[i]);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("aCol", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("aZone", new THREE.Float32BufferAttribute(this.zone, 1));
    g.setAttribute("aBone", new THREE.Float32BufferAttribute(this.bone, 4));
    g.setAttribute("aAO", new THREE.Float32BufferAttribute(this.ao, 1));
    g.setAttribute("aUV", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    return g;
  }
}
const WHITE = [1, 1, 1];
const BONE0 = [0, 0, 0, 0];
const UV0 = [0, 0];

// Normals from the faces round each vertex, weighted by their size.
function smoothNormals(V, F) {
  const N = new Float32Array(V.length);
  for (let f = 0; f < F.length; f += 3) {
    const a = F[f] * 3;
    const b = F[f + 1] * 3;
    const c = F[f + 2] * 3;
    const e1 = [V[b] - V[a], V[b + 1] - V[a + 1], V[b + 2] - V[a + 2]];
    const e2 = [V[c] - V[a], V[c + 1] - V[a + 1], V[c + 2] - V[a + 2]];
    const n = cross(e1, e2);
    for (const k of [a, b, c]) {
      N[k] += n[0];
      N[k + 1] += n[1];
      N[k + 2] += n[2];
    }
  }
  for (let i = 0; i < N.length; i += 3) {
    const L = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1;
    N[i] /= L;
    N[i + 1] /= L;
    N[i + 2] /= L;
  }
  return N;
}

// Turns every face over when most of them face the wrong way: out(centroid) says which way is out at a face.
function orient(V, F, out) {
  let vote = 0;
  for (let f = 0; f < F.length; f += 3) {
    const a = F[f] * 3;
    const b = F[f + 1] * 3;
    const c = F[f + 2] * 3;
    const n = cross([V[b] - V[a], V[b + 1] - V[a + 1], V[b + 2] - V[a + 2]], [V[c] - V[a], V[c + 1] - V[a + 1], V[c + 2] - V[a + 2]]);
    const m = [(V[a] + V[b] + V[c]) / 3, (V[a + 1] + V[b + 1] + V[c + 1]) / 3, (V[a + 2] + V[b + 2] + V[c + 2]) / 3];
    vote += Math.sign(dot(n, out(m, f / 3)));
  }
  if (vote < 0)
    for (let f = 0; f < F.length; f += 3) {
      const t = F[f + 1];
      F[f + 1] = F[f + 2];
      F[f + 2] = t;
    }
}

// A loft: rings round a line ({ c, rx, ry } each: its centre and its two radii), `sides` round, closed round and
// capped at either end (o.cap0 / o.cap1: a length past the end ring, or an exact point). rx lies along o.ref
// (squared to the line), ry across it. The faces are turned so they look out from the line.
function loft(g, rings, o = {}) {
  const S = o.sides || 8;
  const R = rings.length;
  const ref = o.ref || [1, 0, 0];
  const V = [];
  const F = [];
  const axes = [];
  for (let i = 0; i < R; i++) {
    const r = rings[i];
    const a = rings[Math.max(0, i - 1)].c;
    const b = rings[Math.min(R - 1, i + 1)].c;
    const t = norm(sub(b, a));
    let ax = sub(ref, scl(t, dot(ref, t)));
    if (Math.hypot(...ax) < 1e-4) ax = Math.abs(t[1]) < 0.9 ? cross(t, [0, 1, 0]) : cross(t, [1, 0, 0]);
    ax = norm(ax);
    const ay = cross(t, ax);
    axes.push(t);
    for (let k = 0; k < S; k++) {
      const an = (TAU * k) / S + (o.rot || 0);
      const ca = Math.cos(an) * r.rx;
      const sa = Math.sin(an) * r.ry;
      V.push(r.c[0] + ax[0] * ca + ay[0] * sa, r.c[1] + ax[1] * ca + ay[1] * sa, r.c[2] + ax[2] * ca + ay[2] * sa);
    }
  }
  const centreOf = [];
  for (let i = 0; i < R - 1; i++)
    for (let k = 0; k < S; k++) {
      const v00 = i * S + k;
      const v01 = i * S + ((k + 1) % S);
      const v10 = (i + 1) * S + k;
      const v11 = (i + 1) * S + ((k + 1) % S);
      F.push(v00, v01, v10, v01, v11, v10);
      const m = scl(addv(rings[i].c, rings[i + 1].c), 0.5);
      centreOf.push(m, m);
    }
  const pole = (cap, i, dir) => {
    if (cap === undefined || cap === null || cap === false) return;
    const p = Array.isArray(cap) ? cap : addv(rings[i].c, scl(axes[i], dir * cap));
    const P = V.length / 3;
    V.push(p[0], p[1], p[2]);
    for (let k = 0; k < S; k++) {
      const a = i * S + k;
      const b = i * S + ((k + 1) % S);
      if (dir < 0) F.push(b, a, P);
      else F.push(a, b, P);
      centreOf.push(rings[i].c);
    }
  };
  pole(o.cap0, 0, -1);
  pole(o.cap1, R - 1, 1);
  if (o.deform) {
    for (let v = 0; v < V.length / 3; v++) {
      const p = o.deform([V[v * 3], V[v * 3 + 1], V[v * 3 + 2]], v);
      V[v * 3] = p[0];
      V[v * 3 + 1] = p[1];
      V[v * 3 + 2] = p[2];
    }
  }
  orient(V, F, (m, f) => sub(m, centreOf[f]));
  g.prim(V, F, o);
}

// An ellipsoid at c with radii r ([x, y, z]), its long axis along z unless o.axis says otherwise.
// More rings between the given ones, along a smooth curve through them (Catmull-Rom on the centre and radii),
// so a long body has a round silhouette from few numbers.
function denser(rings, k = 2) {
  const out = [];
  const n = rings.length;
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  for (let i = 0; i < n - 1; i++) {
    const A = rings[Math.max(0, i - 1)];
    const B = rings[i];
    const C = rings[i + 1];
    const D = rings[Math.min(n - 1, i + 2)];
    for (let j = 0; j < k; j++) {
      const t = j / k;
      out.push({ c: [0, 1, 2].map((q) => cr(A.c[q], B.c[q], C.c[q], D.c[q], t)), rx: cr(A.rx, B.rx, C.rx, D.rx, t), ry: cr(A.ry, B.ry, C.ry, D.ry, t) });
    }
  }
  out.push(rings[n - 1]);
  return out;
}

function ellipsoid(g, c, r, o = {}) {
  const n = o.rings || 6;
  const rings = [];
  for (let i = 1; i < n; i++) {
    const th = (Math.PI * i) / n;
    rings.push({ c: [c[0], c[1], c[2] - Math.cos(th) * r[2]], rx: r[0] * Math.sin(th), ry: r[1] * Math.sin(th) });
  }
  loft(g, rings, { ...o, cap0: [c[0], c[1], c[2] - r[2]], cap1: [c[0], c[1], c[2] + r[2]], ref: [1, 0, 0] });
}

// A box at c, half sizes h, turned yaw about y; flat faces.
function box(g, c, h, o = {}, yaw = 0) {
  const V = [];
  const N = [];
  const F = [];
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const tr = (x, y, z) => [c[0] + x * cy + z * sy, c[1] + y, c[2] - x * sy + z * cy];
  const faces = [
    [[1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[-1, 0, 0], [0, 0, -1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [-1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [1, 0, 0], [0, 1, 0]],
  ];
  for (const [n, u, v] of faces) {
    const b = V.length / 3;
    for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = (n[0] + u[0] * su + v[0] * sv) * h[0];
      const y = (n[1] + u[1] * su + v[1] * sv) * h[1];
      const z = (n[2] + u[2] * su + v[2] * sv) * h[2];
      V.push(...tr(x, y, z));
      N.push(n[0] * cy + n[2] * sy, n[1], -n[0] * sy + n[2] * cy);
    }
    F.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  orient(V, F, (m) => sub(m, c));
  g.prim(V, F, o, N);
}

// A grid of points rows x cols (open both ways), its faces turned so out(centroid) is their front.
function sheet(g, P, o, out) {
  const rows = P.length;
  const cols = P[0].length;
  const V = [];
  const F = [];
  for (const row of P) for (const p of row) V.push(p[0], p[1], p[2]);
  for (let i = 0; i < rows - 1; i++)
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      F.push(a, a + 1, a + cols, a + 1, a + cols + 1, a + cols);
    }
  orient(V, F, out);
  g.prim(V, F, o);
}

// ------------------------------------------------------------------ the light (the land's, as terrain.js)

const VERT_PARS = [
  "attribute vec3 aCol; attribute float aZone; attribute vec4 aBone; attribute float aAO; attribute vec2 aUV;",
  "attribute vec4 aI0; attribute vec4 aI1; attribute vec4 aI2;",
  "varying vec3 vPW; varying vec3 vNW; varying vec3 vAlb; varying vec4 vMisc; varying vec3 vLP; varying vec3 vPaint;",
  "vec3 rotX(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z); }",
  "vec3 rotY(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }",
  "vec3 rotZ(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z); }",
  "float bitOf(float m, float k) { return mod(floor(m / exp2(k) + 0.001), 2.0); }",
  "float partOf() { return floor(aBone.x + 0.01); }",
  "float weightOf() { return clamp((aBone.x - floor(aBone.x + 0.01)) / 0.45, 0.0, 1.0); }",
].join("\n");

// world position and normal (the instance's matrix too), and what the fragment needs
const VERT_OUT = [
  "#include <project_vertex>",
  "  vec4 lw = vec4(transformed, 1.0); vec3 ln = objectNormal;",
  "  #ifdef USE_INSTANCING",
  "    mat3 lm = mat3(instanceMatrix); lw = instanceMatrix * lw; ln = lm * (ln / vec3(dot(lm[0], lm[0]), dot(lm[1], lm[1]), dot(lm[2], lm[2])));",
  "  #endif",
  "  vPW = (modelMatrix * lw).xyz; vNW = normalize(mat3(modelMatrix) * ln); vLP = transformed;",
  "  vMisc = vec4(aAO, aZone, aUV); vPaint = vec3(0.0); vAlb = lifeAlbedo();",
].join("\n");

const FRAG_PARS = [
  "uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uGndCol; uniform vec3 uRimCol; uniform vec3 uFogCol; uniform vec3 uFog;",
  "uniform float uShadeLift; uniform sampler2D uNoise;",
  "varying vec3 vPW; varying vec3 vNW; varying vec3 vAlb; varying vec4 vMisc; varying vec3 vLP; varying vec3 vPaint;",
].join("\n");

// The light: the sun wrapped a little round the form (wrap), its shadow, the sky above and the ground below
// filling the shade, the shade lifted toward the sky's blue, a warm rim, the haze. `surface` may change alb, N, glow.
const fragMain = (wrap, rim, surface = "") =>
  [
    "vec3 N = normalize(vNW);",
    "vec3 toC = cameraPosition - vPW; float camD = length(toC); vec3 V = toC / camD;",
    "vec3 alb = vAlb; float glow = 0.0; float ao = vMisc.x;",
    surface,
    "float ndl = dot(N, uSunDir);",
    "float sh = smoothstep(0.1, 0.9, pShadow);",
    `float lam = clamp((ndl + ${wrap.toFixed(3)}) / ${(1 + wrap).toFixed(3)}, 0.0, 1.0);`,
    "lam = lam * lam * (3.0 - 2.0 * lam) * 0.35 + lam * 0.65;",
    "float lit = lam * sh;",
    "vec3 direct = uSunCol * lit;",
    "float up = N.y * 0.5 + 0.5;",
    "vec3 amb = mix(uGndCol, uSkyCol, up) * ao;",
    "vec3 c = alb * (direct + amb);",
    "c += alb * uSkyCol * smoothstep(0.55, 0.95, N.y) * (1.0 - lit) * uShadeLift * 0.5 * ao;",
    "float fr = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);",
    `c += uRimCol * alb * fr * (0.25 + 0.75 * lit) * ${rim.toFixed(3)};`,
    "c += alb * uSunCol * glow * sh;",
    "float f = smoothstep(uFog.x, uFog.y, camD) * 0.94;",
    "c = mix(c, uFogCol, f);",
    "gl_FragColor = vec4(c, clamp(lit, 0.0, 1.0));",
  ].join("\n");

// A material for one kind: the Lambert material with its light replaced (so three's shadow mask is at hand),
// posed by kind.pose (GLSL: void lifePose(inout vec3 p, inout vec3 n)) and coloured by kind.albedo (vec3 lifeAlbedo()).
function lifeMaterial(name, kind) {
  const G = window.KIT.G;
  const m = new THREE.MeshLambertMaterial();
  m.extensions = { derivatives: true };
  const noise = { value: noiseTexture() };
  m.onBeforeCompile = (sh) => {
    for (const k of ["uSunDir", "uSunCol", "uSkyCol", "uGndCol", "uRimCol", "uFogCol", "uFog", "uShadeLift"]) sh.uniforms[k] = G[k];
    sh.uniforms.uNoise = noise;
    sh.vertexShader =
      VERT_PARS +
      "\n" +
      kind.vert +
      "\n" +
      sh.vertexShader
        .replace("#include <beginnormal_vertex>", "vec3 objectNormal = vec3(normal); vec3 lifeP = position; lifePose(lifeP, objectNormal);")
        .replace("#include <begin_vertex>", "vec3 transformed = lifeP;")
        .replace("#include <project_vertex>", VERT_OUT);
    sh.fragmentShader =
      FRAG_PARS +
      "\n" +
      (kind.fragPars || "") +
      "\n" +
      sh.fragmentShader
        .replace("reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();", "float pShadow = getShadowMask();")
        .replace("gl_FragColor = vec4( outgoingLight, diffuseColor.a );", fragMain(kind.wrap ?? 0.3, kind.rim ?? 0.8, kind.surface || ""));
  };
  m.customProgramCacheKey = () => "life-" + name;
  return m;
}

// ------------------------------------------------------------------ horses

const H_NECK = [0, 1.2, 0.62];
const H_POLL = [0, 1.88, 1.02];

// A horse, a small sturdy northern one (1.4 m at the withers), facing +z, its hooves at y 0.
// Parts: 0 body, 1-4 legs (left fore, right fore, left hind, right hind; the weight is how far below the knee),
// 5 neck and mane, 6 head, 7 tail (the weight is how far down it).
function horseGeo() {
  const g = new Geo();
  const bone = (part, w, piv) => [part + 0.45 * w, piv[0], piv[1], piv[2]];
  const aoOf = (p, n) => clamp(0.6 + 0.4 * smooth(0.0, 1.25, p[1]), 0, 1) * (0.84 + 0.16 * (n[1] * 0.5 + 0.5));
  const st = (list) => list.map(([z, y, rx, ry]) => ({ c: [0, y, z], rx, ry }));
  // the barrel: rump, back dipping to the withers, deep chest
  const body = st([
    [-0.92, 1.17, 0.17, 0.2],
    [-0.83, 1.15, 0.28, 0.29],
    [-0.63, 1.12, 0.325, 0.325],
    [-0.36, 1.07, 0.335, 0.335],
    [-0.06, 1.05, 0.34, 0.34],
    [0.24, 1.08, 0.33, 0.34],
    [0.48, 1.12, 0.305, 0.32],
    [0.66, 1.12, 0.255, 0.28],
    [0.8, 1.1, 0.175, 0.21],
  ]);
  loft(g, denser(body, 2), {
    sides: 12,
    cap0: 0.09,
    cap1: 0.08,
    zone: (p, n) => (n[1] < -0.6 ? 7 : n[1] > 0.93 && Math.abs(p[0]) < 0.07 ? 8 : 0),
    bone: BONE0,
    ao: aoOf,
  });
  // the chest and the point of the shoulder, filling the join under the neck
  ellipsoid(g, [0, 1.02, 0.6], [0.22, 0.25, 0.23], { sides: 10, rings: 6, zone: 0, bone: BONE0, ao: aoOf });
  // the neck: deep at its base, arched, slimming to the throat
  const neck = [
    [1.13, 0.58, 0.19, 0.27],
    [1.34, 0.73, 0.16, 0.225],
    [1.54, 0.86, 0.133, 0.175],
    [1.7, 0.95, 0.112, 0.138],
    [1.81, 1.0, 0.1, 0.12],
  ].map(([y, z, rx, ry]) => ({ c: [0, y, z], rx, ry }));
  // how far each point bends with the neck: a little at the withers, fully at the throat (so the neck arcs)
  const nb = (p) => bone(5, 0.12 + 0.88 * smooth(0.05, 1.0, ((p[1] - 1.13) * 0.68 + (p[2] - 0.58) * 0.42) / 0.64), H_NECK);
  loft(g, neck, { sides: 8, cap0: 0.08, zone: 0, bone: nb, ao: aoOf });
  // the mane along the crest, standing up a little, and on over the withers
  const crest = [];
  for (let i = neck.length - 1; i >= 0; i--) {
    const a = neck[Math.max(0, i - 1)].c;
    const b = neck[Math.min(neck.length - 1, i + 1)].c;
    const t = norm(sub(b, a));
    const up = cross(t, [1, 0, 0]);
    crest.push({ c: addv(addv(neck[i].c, scl(up, neck[i].ry * 0.8)), [0.035, 0, 0]), rx: 0.06, ry: 0.042 });
  }
  loft(g, crest, { sides: 6, cap0: 0.04, cap1: 0.05, zone: 1, bone: nb, ao: 0.95 });
  // the head: poll, deep jowl, long face to a soft muzzle
  const hb = bone(6, 0, H_POLL);
  const head = [
    [1.93, 0.99, 0.088, 0.09],
    [1.86, 1.07, 0.115, 0.16],
    [1.72, 1.19, 0.1, 0.13],
    [1.58, 1.31, 0.087, 0.105],
    [1.49, 1.39, 0.085, 0.094],
  ].map(([y, z, rx, ry]) => ({ c: [0, y, z], rx, ry }));
  const face = norm([0, 0.7, 0.7]);
  loft(g, head, {
    sides: 8,
    cap0: 0.05,
    cap1: [0, 1.44, 1.445],
    zone: (p, n) => (p[2] > 1.33 ? 5 : dot(n, face) > 0.8 && Math.abs(p[0]) < 0.045 && p[2] > 1.04 ? 4 : 0),
    bone: hb,
    ao: (p, n) => 0.9 + 0.1 * n[1],
  });
  for (const s of [-1, 1]) {
    // ears, pricked forward
    loft(g, [{ c: [s * 0.055, 1.95, 1.0], rx: 0.034, ry: 0.024 }, { c: [s * 0.068, 2.03, 1.02], rx: 0.026, ry: 0.018 }], {
      sides: 5,
      ref: [0, 0, 1],
      cap0: 0.01,
      cap1: [s * 0.08, 2.11, 1.035],
      zone: 0,
      bone: hb,
      ao: 0.9,
    });
    // eyes
    ellipsoid(g, [s * 0.097, 1.815, 1.105], [0.022, 0.026, 0.032], { sides: 6, rings: 3, zone: 6, bone: hb, ao: 1 });
  }
  // the forelock
  ellipsoid(g, [0, 1.94, 1.04], [0.045, 0.028, 0.065], { sides: 6, rings: 3, zone: 1, bone: hb, ao: 0.95 });
  // the tail: full, hanging to the hocks
  const tail = [
    [1.37, -0.88, 0.05],
    [1.3, -1.0, 0.072],
    [1.12, -1.08, 0.09],
    [0.88, -1.12, 0.098],
    [0.67, -1.11, 0.082],
    [0.52, -1.09, 0.045],
  ].map(([y, z, r]) => ({ c: [0, y, z], rx: r * 1.2, ry: r * 1.35 }));
  loft(g, tail, {
    sides: 7,
    cap1: [0, 0.45, -1.08],
    zone: 1,
    bone: (p) => bone(7, clamp((1.37 - p[1]) / 0.85, 0, 1), [0, 1.37, -0.88]),
    ao: (p) => 0.75 + 0.25 * smooth(0.4, 1.3, p[1]),
  });
  // the legs: forearm and knee, cannon, fetlock, pastern and hoof; the hind with a gaskin and a hock behind
  // (each ring [y, z, radius] from the top down)
  const FORE = [[1.02, 0.5, 0.13], [0.82, 0.52, 0.11], [0.62, 0.53, 0.084], [0.5, 0.53, 0.075], [0.4, 0.535, 0.062], [0.22, 0.54, 0.055]];
  FORE.push([0.13, 0.545, 0.065], [0.08, 0.565, 0.056]);
  const HIND = [[1.1, -0.5, 0.18], [0.86, -0.62, 0.14], [0.66, -0.7, 0.096], [0.55, -0.72, 0.078], [0.44, -0.69, 0.064], [0.24, -0.655, 0.055]];
  HIND.push([0.13, -0.64, 0.065], [0.08, -0.62, 0.056]);
  const legs = [
    { part: 1, x: 0.17, knee: 0.5, rings: FORE, hoof: 0.575 },
    { part: 2, x: -0.17, knee: 0.5, rings: null, hoof: 0.575 },
    { part: 3, x: 0.18, knee: 0.55, rings: HIND, hoof: -0.61 },
    { part: 4, x: -0.18, knee: 0.55, rings: null, hoof: -0.61 },
  ];
  legs[1].rings = legs[0].rings;
  legs[3].rings = legs[2].rings;
  for (const L of legs) {
    const hip = [L.x, L.rings[0][0], L.rings[0][1]];
    const rings = L.rings.map(([y, z, r]) => ({ c: [L.x, y, z], rx: r * 1.12, ry: r * 0.88 }));
    const w = (p) => smooth(L.knee + 0.06, L.knee - 0.06, p[1]);
    loft(g, rings, {
      sides: 7,
      ref: [0, 0, 1],
      zone: (p) => (p[1] < 0.31 ? 2 : p[1] < L.knee + 0.02 ? 9 : 0),
      bone: (p) => bone(L.part, w(p), hip),
      ao: (p, n) => (0.62 + 0.38 * smooth(0.0, 1.0, p[1])) * (0.88 + 0.12 * Math.abs(n[0])),
    });
    loft(g, [{ c: [L.x, 0.088, L.hoof - 0.008], rx: 0.06, ry: 0.057 }, { c: [L.x, 0.0, L.hoof + 0.01], rx: 0.077, ry: 0.072 }], {
      sides: 7,
      ref: [0, 0, 1],
      cap0: 0.004,
      cap1: [L.x, 0.0, L.hoof + 0.008],
      zone: 3,
      bone: bone(L.part, 1, hip),
      ao: 0.7,
    });
  }
  return g.geometry();
}

const HORSE_VERT = `
// aI0: gait phase, how much it walks (0 still .. 1), trot (0 walk .. 1 trot), head down (0 up .. 1 grazing)
// aI1: coat (rgb), markings (bits: 1 blaze, 2 4 8 16 socks LF RF LH RH, 32 dark points, 64 a dun's dorsal stripe)
// aI2: mane and tail (rgb), the tail's swish (radians)
const vec3 NECK = vec3(${H_NECK.join(", ")});
const vec3 POLL = vec3(${H_POLL.join(", ")});
const vec2 KNEE_F = vec2(0.5, 0.53);
const vec2 KNEE_H = vec2(0.55, -0.72);
void lifePose(inout vec3 p, inout vec3 n) {
  float part = partOf(), w = weightOf();
  float ph = aI0.x, amp = aI0.y, trot = aI0.z, down = aI0.w;
  float bob = amp * (0.012 + 0.03 * trot) * cos(2.0 * ph);
  float carry = 1.0;
  if (part > 0.5 && part < 4.5) {
    float leg = part - 1.0;
    float offW = leg < 0.5 ? 0.25 : (leg < 1.5 ? 0.75 : (leg < 2.5 ? 0.0 : 0.5));
    float offT = (leg < 0.5 || leg > 2.5) ? 0.5 : 0.0;
    float f = ph + 6.2832 * mix(offW, offT, trot);
    float sw = sin(f) * amp * mix(0.34, 0.5, trot);
    float lift = max(0.0, cos(f)) * amp * mix(0.85, 1.35, trot);
    vec3 hip = aBone.yzw;
    vec3 knee = vec3(hip.x, leg < 1.5 ? KNEE_F : KNEE_H);
    p = hip + rotX(p - hip, -sw); n = rotX(n, -sw);
    knee = hip + rotX(knee - hip, -sw);
    float b = lift * w * (leg < 1.5 ? 1.1 : -0.75);
    p = knee + rotX(p - knee, b); n = rotX(n, b);
    carry = 1.0 - w;
  } else if (part > 4.5 && part < 6.5) {
    float nod = amp * (0.06 + 0.04 * trot) * sin(2.0 * ph + 0.8) * (1.0 - down);
    float a = down * 1.62 + nod;
    float k = part < 5.5 ? w : 1.0;
    p = NECK + rotX(p - NECK, a * k); n = rotX(n, a * k);
    if (part > 5.5) {
      vec3 pl = NECK + rotX(POLL - NECK, a);
      float hb = -down * 0.82 - 0.04;
      p = pl + rotX(p - pl, hb); n = rotX(n, hb);
    }
  } else if (part > 6.5) {
    vec3 r = aBone.yzw;
    float lift = (0.08 + 0.4 * trot * amp) * w;
    p = r + rotX(p - r, lift); n = rotX(n, lift);
    float sw = aI2.w * w;
    p = r + rotY(p - r, sw); n = rotY(n, sw);
  }
  p.y += bob * carry;
}
vec3 lifeAlbedo() {
  float z = floor(aZone + 0.5);
  vec3 coat = aI1.rgb; vec3 hair = aI2.rgb; float m = aI1.w;
  float leg = partOf() - 1.0;
  float pts = bitOf(m, 5.0);
  vec3 white = vec3(0.84, 0.8, 0.71);
  vec3 c = coat;
  if (z == 1.0) c = hair;
  else if (z == 2.0 || z == 9.0) {
    c = mix(coat, hair * 0.9, pts * (z == 2.0 ? 1.0 : 0.85));
    if (z == 2.0) c = mix(c, white, bitOf(m, 1.0 + leg));
  }
  else if (z == 3.0) c = mix(vec3(0.05, 0.04, 0.032), vec3(0.3, 0.24, 0.17), bitOf(m, 1.0 + leg));
  else if (z == 4.0) c = mix(coat, white, bitOf(m, 0.0));
  else if (z == 5.0) c = mix(coat, vec3(0.06, 0.05, 0.045), 0.5);
  else if (z == 6.0) c = vec3(0.012, 0.01, 0.009);
  else if (z == 7.0) c = coat * 1.1;
  else if (z == 8.0) c = mix(coat, hair, 0.6 * bitOf(m, 6.0));
  return c;
}
`;

// a horse's coat, its mane and tail, its points (black lower legs) and a dun's stripe
const COATS = [
  { coat: "#7a4a2c", hair: "#1d1612", points: true },
  { coat: "#9c5a2d", hair: "#6b3519" },
  { coat: "#b6b1a8", hair: "#6f6a64" },
  { coat: "#c6a46b", hair: "#2e241c", points: true, dorsal: true },
  { coat: "#55382a", hair: "#16110e", points: true },
  { coat: "#a46534", hair: "#dcc797" },
  { coat: "#d4cfc6", hair: "#a29c93" },
  { coat: "#8a5531", hair: "#21170f", points: true },
];

// ------------------------------------------------------------------ sheep

const S_HEAD = [0, 0.55, 0.38];

// A sheep: a round lumpy fleece on short dark legs, a dark face, ears out sideways. Facing +z, hooves at y 0.
// Parts: 0 fleece, 1-4 legs, 6 head, 7 tail.
function sheepGeo() {
  const g = new Geo();
  const bone = (part, w, piv) => [part + 0.45 * w, piv[0], piv[1], piv[2]];
  // the fleece: puffs of wool over the round of the body
  const lump = (p) => {
    const k = 0.06 * Math.max(-0.4, noise2(p[0] * 6.1 + p[2] * 2.3 + 3.1, p[1] * 6.7 - p[2] * 4.1)) + 0.026 * noise2(p[0] * 14.3 - 4.1, p[2] * 13.9 + p[1] * 3.1);
    const d = norm([p[0], (p[1] - 0.55) * 1.1, p[2] * 0.6]);
    return addv(p, scl(d, k));
  };
  const fleece = [
    [-0.47, 0.55, 0.17, 0.17],
    [-0.4, 0.55, 0.28, 0.27],
    [-0.24, 0.555, 0.345, 0.315],
    [0.0, 0.56, 0.365, 0.33],
    [0.22, 0.57, 0.345, 0.315],
    [0.37, 0.585, 0.28, 0.27],
    [0.45, 0.595, 0.18, 0.18],
  ].map(([z, y, rx, ry]) => ({ c: [0, y, z], rx, ry }));
  loft(g, denser(fleece, 2), {
    sides: 14,
    cap0: 0.07,
    cap1: 0.07,
    deform: lump,
    zone: 0,
    bone: BONE0,
    ao: (p, n) => clamp(0.5 + 0.5 * smooth(0.22, 0.8, p[1]), 0, 1) * (0.8 + 0.2 * (n[1] * 0.5 + 0.5)),
  });
  // the head: a dark face with a woolly cap
  const hb = bone(6, 0, S_HEAD);
  const head = [
    [0.64, 0.41, 0.1, 0.115],
    [0.6, 0.53, 0.097, 0.108],
    [0.54, 0.64, 0.082, 0.09],
    [0.49, 0.72, 0.062, 0.068],
  ].map(([y, z, rx, ry]) => ({ c: [0, y, z], rx, ry }));
  loft(g, head, { sides: 8, cap0: 0.04, cap1: [0, 0.47, 0.765], zone: 1, bone: hb, ao: (p, n) => 0.85 + 0.15 * n[1] });
  ellipsoid(g, [0, 0.715, 0.46], [0.1, 0.07, 0.09], { sides: 7, rings: 4, zone: 0, bone: hb, ao: 0.95, deform: lump });
  for (const s of [-1, 1]) {
    loft(g, [{ c: [s * 0.08, 0.65, 0.49], rx: 0.036, ry: 0.018 }, { c: [s * 0.15, 0.625, 0.48], rx: 0.04, ry: 0.016 }], {
      sides: 5,
      ref: [0, 0, 1],
      cap0: 0.01,
      cap1: [s * 0.205, 0.605, 0.47],
      zone: 1,
      bone: hb,
      ao: 0.85,
    });
  }
  // a short tail
  ellipsoid(g, [0, 0.53, -0.5], [0.075, 0.085, 0.065], { sides: 6, rings: 3, zone: 0, bone: bone(7, 1, [0, 0.6, -0.46]), ao: 0.85 });
  // the legs, dark and thin, a little woolly at the top
  const legs = [
    [1, 0.15, 0.25],
    [2, -0.15, 0.25],
    [3, 0.15, -0.25],
    [4, -0.15, -0.25],
  ];
  for (const [part, x, z] of legs) {
    const hip = [x, 0.42, z];
    loft(
      g,
      [
        { c: [x, 0.42, z], rx: 0.065, ry: 0.06 },
        { c: [x, 0.22, z], rx: 0.05, ry: 0.046 },
        { c: [x, 0.07, z + 0.01], rx: 0.04, ry: 0.037 },
        { c: [x, 0.0, z + 0.02], rx: 0.045, ry: 0.041 },
      ],
      { sides: 6, ref: [0, 0, 1], cap1: [x, 0.0, z + 0.02], zone: (p) => (p[1] < 0.05 ? 3 : 2), bone: bone(part, 1, hip), ao: (p) => 0.55 + 0.45 * smooth(0, 0.4, p[1]) },
    );
  }
  return g.geometry();
}

const SHEEP_VERT = `
// aI0: gait phase, how much it walks, head down (0 up .. 1 grazing), lying down (0 .. 1)
// aI1: fleece (rgb); aI2: face and legs (rgb)
const vec3 SHEAD = vec3(${S_HEAD.join(", ")});
void lifePose(inout vec3 p, inout vec3 n) {
  float part = partOf();
  float ph = aI0.x, amp = aI0.y, down = aI0.z, lie = aI0.w;
  if (part > 0.5 && part < 4.5) {
    float leg = part - 1.0;
    float off = leg < 0.5 ? 0.25 : (leg < 1.5 ? 0.75 : (leg < 2.5 ? 0.0 : 0.5));
    float sw = sin(ph + 6.2832 * off) * amp * 0.5;
    vec3 hip = aBone.yzw;
    float fold = lie * 1.5 * (leg < 1.5 ? 1.0 : -1.0);
    p = hip + rotX(p - hip, -sw + fold); n = rotX(n, -sw + fold);
    p.y += lie * 0.06;
  } else if (part > 5.5 && part < 6.5) {
    float a = down * 0.95 + amp * 0.07 * sin(2.0 * ph) - lie * 0.12;
    p = SHEAD + rotX(p - SHEAD, a); n = rotX(n, a);
  }
  p.y += amp * 0.02 * cos(2.0 * ph) - lie * 0.26;
}
vec3 lifeAlbedo() {
  float z = floor(aZone + 0.5);
  if (z < 0.5) return aI1.rgb;
  if (z < 2.5) return aI2.rgb;
  return aI2.rgb * 0.5;
}
`;
// the fleece's curls, from its own surface (so it never swims), soft and mipmapped so it never shimmers
const SHEEP_SURFACE = [
  "if (vMisc.y < 0.5) {",
  "  float cu = texture2D(uNoise, vLP.xz * 2.3 + vLP.y * 1.7).a * 0.6 + texture2D(uNoise, vLP.zy * 1.1 + 0.3).g * 0.4;",
  "  alb *= 0.9 + cu * 0.2;",
  "}",
].join("\n");

const FLEECES = ["#eee7d6", "#e7dec9", "#f2ede1", "#ded3bc", "#e9e1cc"];
const FACES = ["#2b2421", "#2b2421", "#332a25", "#d4c2a8", "#6d5848"];

// ------------------------------------------------------------------ birds

// A gull in flight, at its true size (the flocks draw it larger, so it reads from far off): body along +z,
// wings out along x. Parts: 0 body, 1 inner wing (from the shoulder), 2 outer wing (from the wrist).
// Zones: 0 white, 1 the wing's top (grey), 2 wing tips, 3 beak, 4 the crown (a tern's black cap), 5 legs.
const B_SHOULDER = [0.04, 0.02, 0.01];
const B_WRIST = [0.33, 0.03, -0.012];
function birdGeo() {
  const g = new Geo();
  const body = [
    [-0.13, 0.004, 0.05, 0.045],
    [-0.05, 0.008, 0.07, 0.064],
    [0.04, 0.014, 0.069, 0.064],
    [0.11, 0.028, 0.052, 0.052],
    [0.16, 0.043, 0.047, 0.049],
    [0.205, 0.042, 0.031, 0.033],
  ].map(([z, y, rx, ry]) => ({ c: [0, y, z], rx, ry }));
  loft(g, body, { sides: 8, cap0: 0.03, cap1: 0.01, zone: (p, n) => (p[2] > 0.13 && n[1] > 0.3 ? 4 : 0), ao: (p, n) => 0.82 + 0.18 * (n[1] * 0.5 + 0.5) });
  // the beak
  loft(g, [{ c: [0, 0.04, 0.205], rx: 0.016, ry: 0.018 }], { sides: 5, cap0: 0.004, cap1: [0, 0.033, 0.28], zone: 3, ao: 1 });
  // the tail, a flat fan
  loft(
    g,
    [
      { c: [0, 0.006, -0.12], rx: 0.04, ry: 0.01 },
      { c: [0, 0.004, -0.2], rx: 0.062, ry: 0.007 },
      { c: [0, 0.002, -0.26], rx: 0.07, ry: 0.004 },
    ],
    { sides: 6, cap1: 0.005, zone: 0, ao: 0.95 },
  );
  // the wings: a long arm to the wrist, a swept hand to the tip, thin, rounded at the leading edge
  const span = [
    [0.035, 0.012, 0.088, 0.018, 0.02],
    [0.18, 0.006, 0.088, 0.015, 0.024],
    [0.33, -0.012, 0.072, 0.012, 0.03],
    [0.46, -0.038, 0.056, 0.009, 0.03],
    [0.56, -0.064, 0.036, 0.006, 0.028],
  ];
  for (const s of [-1, 1]) {
    const rings = span.map(([x, z, hc, ht, y]) => ({ c: [s * x, y, z], rx: hc, ry: ht }));
    const S = [s * B_SHOULDER[0], B_SHOULDER[1], B_SHOULDER[2]];
    loft(g, rings, {
      sides: 6,
      ref: [0, 0, 1],
      cap1: [s * 0.63, 0.027, -0.088],
      zone: (p, n) => (Math.abs(p[0]) > 0.47 ? 2 : n[1] > 0.05 ? 1 : 0),
      bone: (p) => (Math.abs(p[0]) > 0.34 ? [2, S[0], S[1], S[2]] : [1, S[0], S[1], S[2]]),
      ao: (p, n) => 0.9 + 0.1 * n[1],
    });
  }
  return g.geometry();
}

const BIRD_ALBEDO = `
vec3 birdAlbedo(float kind) {
  float z = floor(aZone + 0.5);
  vec3 white = vec3(0.86, 0.85, 0.82), grey = vec3(0.37, 0.43, 0.49), tip = vec3(0.025, 0.025, 0.03), beak = vec3(0.82, 0.56, 0.07);
  vec3 cap = white, legs = vec3(0.72, 0.36, 0.27);
  if (kind > 0.5 && kind < 1.5) {
    white = vec3(0.9, 0.9, 0.88); grey = vec3(0.6, 0.65, 0.7); tip = vec3(0.2, 0.23, 0.27);
    beak = vec3(0.75, 0.1, 0.03); cap = vec3(0.02, 0.02, 0.022); legs = beak;
  }
  else if (kind > 1.5) { white = vec3(0.026, 0.025, 0.03); grey = vec3(0.034, 0.033, 0.04); tip = vec3(0.018); beak = vec3(0.012); cap = white; legs = beak; }
  return z < 0.5 ? white : (z < 1.5 ? grey : (z < 2.5 ? tip : (z < 3.5 ? beak : (z < 4.5 ? cap : legs))));
}
`;

const BIRD_VERT = `
// aI0: wingbeat phase, how hard it flaps (0 gliding .. 1), the glide's dihedral (radians), kind (0 gull, 1 tern, 2 crow)
const vec3 SHOULDER = vec3(${B_SHOULDER.join(", ")});
const vec3 WRIST = vec3(${B_WRIST.join(", ")});
void lifePose(inout vec3 p, inout vec3 n) {
  float part = partOf();
  float f = aI0.x, k = aI0.y;
  if (part > 0.5) {
    float s = p.x > 0.0 ? 1.0 : -1.0;
    float a1 = aI0.z + k * 0.78 * sin(f);
    float a2 = -0.2 - aI0.z * 0.6 + k * 0.5 * sin(f - 1.1);
    vec3 S = vec3(s * SHOULDER.x, SHOULDER.yz);
    p = S + rotZ(p - S, s * a1); n = rotZ(n, s * a1);
    if (part > 1.5) {
      vec3 W = S + rotZ(vec3(s * WRIST.x, WRIST.yz) - S, s * a1);
      p = W + rotZ(p - W, s * a2); n = rotZ(n, s * a2);
    }
  }
  p.y -= k * 0.025 * sin(f);
}
${BIRD_ALBEDO}
vec3 lifeAlbedo() { return birdAlbedo(aI0.w); }
`;

// A gull standing: a little upright, wings folded over its back with their black tips crossed over the tail,
// pink legs. Facing +z, its feet at y 0. Parts: 0 body, 6 head (turns about the neck).
const P_NECK = [0, 0.235, 0.075];
function perchGeo() {
  const g = new Geo();
  const pitch = 0.32;
  const tilt = (p) => {
    const y = p[1] - 0.17;
    const z = p[2];
    return [p[0], 0.17 + y * Math.cos(pitch) + z * Math.sin(pitch), -y * Math.sin(pitch) + z * Math.cos(pitch)];
  };
  const body = [
    [-0.15, 0.17, 0.045, 0.04],
    [-0.08, 0.17, 0.072, 0.07],
    [0.0, 0.17, 0.078, 0.078],
    [0.07, 0.172, 0.066, 0.07],
    [0.11, 0.18, 0.05, 0.052],
  ].map(([z, y, rx, ry]) => ({ c: [0, y, z], rx, ry }));
  loft(g, body, {
    sides: 8,
    cap0: [0, 0.17, -0.2],
    cap1: 0.03,
    deform: tilt,
    zone: (p, n) => (n[1] > 0.45 && p[2] < 0.06 ? 1 : 0),
    ao: (p, n) => 0.8 + 0.2 * (n[1] * 0.5 + 0.5),
  });
  // the folded wings' tips, crossed over the tail
  for (const s of [-1, 1]) {
    loft(g, [{ c: [s * 0.045, 0.215, -0.06], rx: 0.03, ry: 0.012 }, { c: [s * 0.03, 0.19, -0.16], rx: 0.022, ry: 0.01 }], {
      sides: 5,
      ref: [1, 0, 0],
      cap0: 0.01,
      cap1: [-s * 0.012, 0.165, -0.27],
      zone: 2,
      ao: 0.9,
    });
    loft(g, [{ c: [s * 0.03, 0.12, 0.0], rx: 0.009, ry: 0.009 }, { c: [s * 0.032, 0.0, 0.01], rx: 0.007, ry: 0.007 }], {
      sides: 4,
      ref: [0, 0, 1],
      cap1: [s * 0.032, 0.0, 0.05],
      zone: 5,
      ao: 0.8,
    });
  }
  // the head and beak, turning
  const hb = [6, P_NECK[0], P_NECK[1], P_NECK[2]];
  ellipsoid(g, [0, 0.28, 0.115], [0.045, 0.047, 0.058], { sides: 7, rings: 4, zone: 0, bone: hb, ao: (p, n) => 0.88 + 0.12 * n[1] });
  loft(g, [{ c: [0, 0.278, 0.16], rx: 0.013, ry: 0.016 }], { sides: 5, cap0: 0.004, cap1: [0, 0.27, 0.215], zone: 3, bone: hb, ao: 1 });
  return g.geometry();
}

const PERCH_VERT = `
// aI0: the head's turn (radians), unused, unused, kind (0 gull)
const vec3 PNECK = vec3(${P_NECK.join(", ")});
void lifePose(inout vec3 p, inout vec3 n) {
  if (partOf() > 5.5) { p = PNECK + rotY(p - PNECK, aI0.x); n = rotY(n, aI0.x); }
}
${BIRD_ALBEDO}
vec3 lifeAlbedo() { return birdAlbedo(aI0.w); }
`;

// ------------------------------------------------------------------ boats

// A clinker hull, double ended: stations from the stern (u 0) to the bow (u 1), each a section from one gunwale
// down round the keel and up to the other. Its outside (zone 1: the shader draws the lapped planks and paints
// the top one), the inside, darker, a floor of boards above the waterline (so the sea never shows in the boat)
// and the gunwale's cap. Returns the hull's measures.
function hull(g, H) {
  const { L, B, keel, sheer, sheerEnd, keelEnd, nu, nv, th } = H;
  const hw = (u) => (B / 2) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * u - 1), 2.3)), 0.62);
  const sh = (u) => sheer + (sheerEnd - sheer) * Math.pow(Math.abs(2 * u - 1), 2.4);
  const kl = (u) => keel + (keelEnd - keel) * Math.pow(Math.abs(2 * u - 1), 3.2);
  const zOf = (u) => (u - 0.5) * L;
  const widthAt = (u, a) => hw(u) * Math.pow(Math.sin((a * Math.PI) / 2), 0.62);
  const sect = (u, v, inset) => {
    const a = Math.abs(v);
    const s = v < 0 ? -1 : 1;
    const w = Math.max(0, widthAt(u, a) - inset);
    return [s * w, kl(u) + (sh(u) - kl(u)) * a + inset * (1 - a) * 1.4, zOf(u)];
  };
  const us = [];
  for (let i = 0; i < nu; i++) us.push(0.5 - 0.5 * Math.cos((Math.PI * i) / (nu - 1)));
  const vs = [];
  for (let j = 0; j <= 2 * nv; j++) vs.push(-1 + j / nv);
  const outer = us.map((u) => vs.map((v) => sect(u, v, 0)));
  const inner = us.map((u) => vs.map((v) => sect(u, v, th)));
  const uvOf = (p) => {
    // (u along the hull, how far up from the keel), found back from the point
    const u = clamp(p[2] / L + 0.5, 0, 1);
    const a = clamp((p[1] - kl(u)) / Math.max(1e-3, sh(u) - kl(u)), 0, 1);
    return [u, a];
  };
  sheet(g, outer, { zone: 1, col: H.wood, uv: uvOf, ao: (p) => 0.72 + 0.28 * smooth(-0.2, sheer, p[1]) }, (m) => [m[0], (m[1] - keel) * 0.2 - 0.05, 0]);
  sheet(g, inner, { zone: 0, col: H.inside, uv: uvOf, ao: (p) => 0.7 + 0.3 * smooth(H.floor, sheer, p[1]) }, (m) => [-m[0], 0.2, 0]);
  // the gunwale's cap
  for (const side of [0, 2 * nv]) {
    const P = [us.map((u, i) => outer[i][side]), us.map((u, i) => inner[i][side])];
    const capRows = P[0].map((p, i) => [p, P[1][i]]);
    sheet(g, capRows, { zone: 0, col: H.cap, ao: 1 }, () => [0, 1, 0]);
  }
  // the floor boards
  const fl = us.map((u) => {
    const a = clamp((H.floor - kl(u)) / Math.max(1e-3, sh(u) - kl(u)), 0, 1);
    const w = Math.max(0, widthAt(u, a) - th);
    return [[-w, H.floor, zOf(u)], [w, H.floor, zOf(u)]];
  });
  sheet(g, fl, { zone: 0, col: H.floorCol, ao: 0.7 }, () => [0, 1, 0]);
  // half the beam and half the length where the hull meets the water
  const a0 = clamp((0 - keel) / (sheer - keel), 0, 1);
  const wl = Math.pow((0 - keel) / (keelEnd - keel), 1 / 3.2);
  return { hw, sh, kl, zOf, widthAt, beamWL: widthAt(0.5, a0), lenWL: (wl * L) / 2 };
}

// One of the town's rowers (or a crewman on the longship): seated, facing the stern (-z), a tunic, a beard and
// a horned helmet. Parts: 4 torso and head (leans about the hips), 5 arms (lean, and reach about the shoulders), 8 seated legs (still).
// col: { tunic: "paint" or a colour, skin, beard, steel, horn, legs }; at (x, y, z) the seat.
function rower(g, x, y, z, col, arms = true, standing = false) {
  const hip = [x, y + 0.04, z];
  // (one standing at the helm keeps still)
  const b4 = standing ? BONE0 : [4, hip[0], hip[1], hip[2]];
  const b5 = standing ? BONE0 : [5, hip[0], hip[1], hip[2]];
  const tunic = col.tunic === "paint" ? { zone: 2, col: WHITE } : { zone: 0, col: col.tunic };
  const rise = standing ? 0.45 : 0;
  loft(
    g,
    [
      { c: [x, y + 0.02 + rise, z + 0.02], rx: 0.15, ry: 0.11 },
      { c: [x, y + 0.24 + rise, z + 0.01], rx: 0.16, ry: 0.115 },
      { c: [x, y + 0.46 + rise, z], rx: 0.175, ry: 0.11 },
      { c: [x, y + 0.56 + rise, z], rx: 0.12, ry: 0.08 },
    ],
    { sides: 8, ref: [1, 0, 0], cap0: 0.03, cap1: 0.02, ...tunic, bone: b4, ao: (p) => 0.7 + 0.3 * smooth(y, y + 0.5, p[1]) },
  );
  // a belt
  loft(g, [{ c: [x, y + 0.2 + rise, z + 0.012], rx: 0.163, ry: 0.118 }, { c: [x, y + 0.25 + rise, z + 0.01], rx: 0.166, ry: 0.12 }], {
    sides: 8,
    zone: 0,
    col: col.legs,
    bone: b4,
    ao: 0.8,
  });
  const hy = y + 0.69 + rise;
  ellipsoid(g, [x, hy, z], [0.09, 0.1, 0.095], { sides: 8, rings: 4, zone: 0, col: col.skin, bone: b4, ao: 0.95 });
  // a beard, in front (toward -z)
  ellipsoid(g, [x, hy - 0.07, z - 0.06], [0.075, 0.075, 0.05], { sides: 7, rings: 3, zone: 0, col: col.beard, bone: b4, ao: 0.9 });
  // the helmet and its horns
  const brim = (p) => (p[1] < hy + 0.03 ? [p[0], hy + 0.03, p[2]] : p);
  ellipsoid(g, [x, hy + 0.035, z + 0.005], [0.102, 0.085, 0.105], { sides: 8, rings: 3, zone: 0, col: col.steel, bone: b4, ao: 1, deform: brim });
  for (const s of [-1, 1]) {
    loft(
      g,
      [
        { c: [x + s * 0.085, hy + 0.06, z], rx: 0.03, ry: 0.03 },
        { c: [x + s * 0.16, hy + 0.1, z - 0.01], rx: 0.022, ry: 0.022 },
        { c: [x + s * 0.2, hy + 0.17, z - 0.03], rx: 0.013, ry: 0.013 },
      ],
      { sides: 5, ref: [0, 0, 1], cap1: [x + s * 0.205, hy + 0.23, z - 0.05], zone: 0, col: col.horn, bone: b4, ao: 1 },
    );
    if (arms) {
      // arms down and forward to the oar's handle
      loft(
        g,
        [
          { c: [x + s * 0.16, y + 0.5 + rise, z], rx: 0.048, ry: 0.048 },
          { c: [x + s * 0.17, y + 0.33 + rise, z - 0.12], rx: 0.042, ry: 0.042 },
          { c: [x + s * 0.15, y + 0.3 + rise, z - 0.34], rx: 0.036, ry: 0.036 },
        ],
        { sides: 6, ref: [0, 0, 1], cap0: 0.02, cap1: 0.035, ...tunic, bone: b5, ao: 0.85 },
      );
    }
    // legs, braced toward the stern (seated) or straight down (standing)
    const L = standing
      ? [{ c: [x + s * 0.08, y + 0.47, z], rx: 0.06, ry: 0.06 }, { c: [x + s * 0.09, y - 0.3, z], rx: 0.05, ry: 0.05 }]
      : [
          { c: [x + s * 0.085, y + 0.06, z - 0.02], rx: 0.06, ry: 0.06 },
          { c: [x + s * 0.09, y + 0.12, z - 0.34], rx: 0.055, ry: 0.055 },
          { c: [x + s * 0.09, y - 0.18, z - 0.42], rx: 0.045, ry: 0.045 },
        ];
    // (seated legs keep still, but go with the rest when the boat has no crew: part 8)
    loft(g, L, { sides: 6, ref: [0, 0, 1], cap1: 0.03, zone: 0, col: col.legs, bone: standing ? b4 : [8, hip[0], hip[1], hip[2]], ao: 0.7 });
  }
}

// An oar in its resting pose: out along x from its pivot on the gunwale (side s), sloping down to the water.
function oar(g, piv, s, inboard, outboard, drop, col, bladeW = 0.12) {
  const dir = [s * Math.cos(drop), -Math.sin(drop), 0];
  const at = (d) => addv(piv, scl(dir, d));
  const b = [3, piv[0], piv[1], piv[2]];
  loft(
    g,
    [
      { c: at(-inboard), rx: 0.03, ry: 0.03 },
      { c: at(-inboard + 0.15), rx: 0.024, ry: 0.024 },
      { c: at(0), rx: 0.035, ry: 0.035 },
      { c: at(outboard * 0.7), rx: 0.03, ry: 0.03 },
    ],
    { sides: 5, ref: [0, 0, 1], cap0: 0.02, zone: 0, col, bone: b, ao: 1 },
  );
  // the blade: flat and wide
  loft(
    g,
    [
      { c: at(outboard * 0.68), rx: 0.03, ry: 0.025 },
      { c: at(outboard * 0.78), rx: bladeW, ry: 0.018 },
      { c: at(outboard * 0.97), rx: bladeW * 1.05, ry: 0.014 },
    ],
    { sides: 6, ref: [0, 0, 1], cap1: 0.03, zone: 0, col, bone: b, ao: 1 },
  );
}

// The fishing boats: a færing, 6 m, two oars, three thwarts, a rower who shows when the instance has one,
// a basket and a coil of rope in the bow. Parts: 3 oars, 4, 5 and 8 the rower.
const FB = { L: 6.0, B: 1.75, keel: -0.36, sheer: 0.44, sheerEnd: 1.0, keelEnd: 0.42, nu: 21, nv: 5, th: 0.045, floor: 0.16 };
function fishingGeo(P) {
  const g = new Geo();
  const H = { ...FB, wood: P.wood, inside: P.woodIn, cap: P.woodLight, floorCol: P.floor };
  const h = hull(g, H);
  // stem and stern posts, rising and curling a little out
  for (const s of [-1, 1]) {
    const z0 = (s * FB.L) / 2;
    const pts = [
      [0, FB.keelEnd - 0.2, z0 - s * 0.05],
      [0, FB.sheerEnd - 0.05, z0 + s * 0.04],
      [0, FB.sheerEnd + 0.22, z0 + s * 0.12],
      [0, FB.sheerEnd + 0.36, z0 + s * 0.07],
    ];
    loft(
      g,
      pts.map((c, i) => ({ c, rx: 0.045 - i * 0.005, ry: 0.075 - i * 0.01 })),
      { sides: 6, ref: [1, 0, 0], cap0: 0.02, cap1: 0.03, zone: 0, col: P.woodLight, ao: 1 },
    );
  }
  // thwarts
  for (const z of [-1.55, 0.35, 1.7]) {
    const u = z / FB.L + 0.5;
    const yy = 0.3;
    const a = clamp((yy - h.kl(u)) / (h.sh(u) - h.kl(u)), 0, 1);
    const w = h.widthAt(u, a) - FB.th;
    box(g, [0, yy, z], [w, 0.025, 0.11], { zone: 0, col: P.woodLight, ao: 0.95 });
  }
  // a basket and a coil of rope in the bow, a keg in the stern
  const flat = (p) => (p[1] < 0.18 ? [p[0], 0.18, p[2]] : p);
  ellipsoid(g, [0.05, 0.27, 2.2], [0.2, 0.13, 0.18], { sides: 7, rings: 3, zone: 0, col: P.straw, ao: 0.85, deform: flat });
  const coil = [{ c: [-0.18, 0.17, 2.0], rx: 0.16, ry: 0.16 }, { c: [-0.18, 0.25, 2.0], rx: 0.16, ry: 0.16 }];
  loft(g, coil, { sides: 8, ref: [1, 0, 0], cap1: 0.0, zone: 0, col: P.rope, ao: 0.85 });
  loft(g, [{ c: [0.1, 0.17, -2.15], rx: 0.13, ry: 0.13 }, { c: [0.1, 0.31, -2.15], rx: 0.15, ry: 0.15 }, { c: [0.1, 0.45, -2.15], rx: 0.13, ry: 0.13 }], {
    sides: 8,
    ref: [1, 0, 0],
    cap0: 0.0,
    cap1: 0.0,
    zone: 0,
    col: P.wood,
    ao: 0.85,
  });
  // the oars, on pivots by the middle thwart
  const zo = -0.05;
  for (const s of [-1, 1]) {
    const u = zo / FB.L + 0.5;
    const piv = [s * (h.widthAt(u, 1) - 0.02), h.sh(u) + 0.05, zo];
    box(g, [piv[0], piv[1] - 0.02, zo], [0.03, 0.05, 0.03], { zone: 0, col: P.woodDark, ao: 1 });
    oar(g, piv, s, 0.72, 2.05, 0.25, P.woodLight, 0.075);
  }
  rower(g, 0, 0.3, 0.42, { tunic: "paint", skin: P.skin, beard: P.beard, steel: P.steel, horn: P.horn, legs: P.legs });
  return { geo: g.geometry(), hull: h };
}

const BOAT_VERT = `
// aI0: stroke phase, rowing (0 oars shipped .. 1), crew (0 none, 1 a rower), the sail's billow (the longship)
// aI1: the top strake's paint (rgb), the flutter's phase; aI2: the rower's tunic (rgb)
void lifePose(inout vec3 p, inout vec3 n) {
  float part = partOf();
  float ph = aI0.x, row = aI0.y;
  if (part > 2.5 && part < 3.5) {
    vec3 pv = aBone.yzw;
    float s = pv.x > 0.0 ? 1.0 : -1.0;
    float yaw = mix(1.66, 0.55 * cos(ph), row);
    float lift = mix(0.25, 0.02 + 0.17 * max(0.0, -sin(ph)), row);
    p = pv + rotZ(p - pv, s * lift); n = rotZ(n, s * lift);
    p = pv + rotY(p - pv, -s * yaw); n = rotY(n, -s * yaw);
  } else if (part > 3.5 && part < 5.5) {
    if (aI0.z < 0.5) { p = vec3(0.0); return; }
    vec3 hip = aBone.yzw;
    float lean = -0.36 * cos(ph) * row;
    p = hip + rotX(p - hip, lean); n = rotX(n, lean);
    if (part > 4.5) {
      vec3 sh = hip + rotX(vec3(hip.x, hip.y + 0.46, hip.z) - hip, lean);
      float arm = -0.45 * cos(ph) * row;
      p = sh + rotX(p - sh, arm); n = rotX(n, arm);
    }
  } else if (part > 7.5) {
    if (aI0.z < 0.5) p = vec3(0.0);
  } else if (part > 5.5 && part < 6.5) {
    // the sail, full of wind: bellied forward, deepest low in the middle, rippling a little
    float u = aUV.x, v = aUV.y;
    float hu = 1.0 - (2.0 * u - 1.0) * (2.0 * u - 1.0);
    float dhu = -4.0 * (2.0 * u - 1.0);
    float a = 3.1416 * (0.12 + 0.78 * v);
    float gv = sin(a), dgv = 3.1416 * 0.78 * cos(a);
    float rip = 1.0 + 0.04 * sin(aI1.w + u * 7.0 + v * 3.0);
    float B = aI0.w * rip;
    p.z += B * hu * gv;
    vec3 nn = normalize(vec3(-B * dhu * gv / SAIL_W, B * hu * dgv / SAIL_H, 1.0));
    n = n.z > 0.0 ? nn : -nn;
  }
}
vec3 lifeAlbedo() {
  float z = floor(aZone + 0.5);
  vPaint = aI1.rgb;
  return z > 2.5 ? aI1.rgb : (z > 1.5 ? aI2.rgb : aCol);
}
`;

// The lapped planks of a clinker hull, from (u, v) on it: each plank its own tone, a dark line in the shadow
// under each plank's lower edge and a lit lip on it (gone where the planks are too fine to draw), the top plank
// painted, tar below the waterline on the longship. The sail: stripes of the Hub's orange and bone, light
// through the cloth when the sun is behind it.
const boatSurface = (strakes, tar) =>
  [
    "float zn = floor(vMisc.y + 0.5);",
    "if (zn > 0.5 && zn < 1.5) {",
    `  float vv = vMisc.w * ${strakes.toFixed(1)}; float k = floor(vv); float fk = vv - k;`,
    "  float tone = fract(sin(k * 91.7 + 3.1) * 4375.85);",
    "  alb *= 0.9 + tone * 0.14;",
    `  if (k > ${(strakes - 1.5).toFixed(1)}) alb = vPaint * (0.94 + tone * 0.08);`,
    `  if (k < ${tar.toFixed(1)}) alb = mix(alb, vec3(0.035, 0.03, 0.028), 0.82);`,
    "  float fw = fwidth(vv); float fine = 1.0 - smoothstep(0.12, 0.35, fw);",
    "  alb *= 1.0 - 0.42 * smoothstep(0.86 - fw, 0.97, fk) * fine;",
    "  alb *= 1.0 + 0.18 * (1.0 - smoothstep(0.0, 0.1 + fw, fk)) * fine;",
    "  alb *= 0.93 + 0.14 * texture2D(uNoise, vec2(vMisc.z * 6.0, vv * 0.37)).a;",
    "} else if (zn > 3.5 && zn < 4.5) {",
    "  float su = vMisc.z * 7.0; float fu = fract(su); float fw = fwidth(su) + 1e-3;",
    "  float odd = mod(floor(su), 2.0);",
    "  vec3 orange = vec3(0.85, 0.14, 0.012); vec3 bone = vec3(0.86, 0.84, 0.79);",
    // near each seam the two stripes meet in their mean, as wide as a pixel, so the stripes never crawl
    "  float edge = smoothstep(0.0, fw, fu) * smoothstep(1.0, 1.0 - fw, fu);",
    "  alb = mix(mix(orange, bone, 0.5), odd > 0.5 ? bone : orange, edge);",
    "  alb *= 0.92 + 0.1 * texture2D(uNoise, vMisc.zw * vec2(3.0, 2.0)).g;",
    "  glow = max(0.0, -dot(N, uSunDir)) * 0.55;",
    "  N = dot(N, V) < 0.0 ? -N : N;",
    "}",
  ].join("\n");

// The longship: 21 m, a dragon at the prow and a curl at the stern, shields along both sides, five oars a side
// and a crew of eight rowing, a helmsman at the steering oar, a mast and yard with a striped sail.
// Parts: 3 oars, 4 the rowers' bodies (lean), 5 their arms, 6 the sail, 8 the rowers' legs.
const LS = { L: 21, B: 4.7, keel: -0.85, sheer: 0.95, sheerEnd: 2.5, keelEnd: 1.6, nu: 33, nv: 7, th: 0.07, floor: 0.32 };
const SAIL = { w: 8.8, h: 6.8, top: 10.4, z: 0.75 };
function longshipGeo(P) {
  const g = new Geo();
  const H = { ...LS, wood: P.wood, inside: P.woodIn, cap: P.woodLight, floorCol: P.floor };
  const h = hull(g, H);
  // the prow: the stem rising and curving forward into a dragon's neck and head
  const zb = LS.L / 2;
  const prow = [
    [0, LS.keelEnd - 0.3, zb - 0.15],
    [0, LS.sheerEnd - 0.1, zb + 0.15],
    [0, LS.sheerEnd + 0.8, zb + 0.55],
    [0, LS.sheerEnd + 1.6, zb + 0.7],
    [0, LS.sheerEnd + 2.3, zb + 0.55],
    [0, LS.sheerEnd + 2.75, zb + 0.6],
  ];
  loft(
    g,
    prow.map((c, i) => ({ c, rx: 0.13 - i * 0.008, ry: 0.22 - i * 0.012 })),
    { sides: 7, ref: [1, 0, 0], cap0: 0.05, zone: 0, col: P.dragon, ao: 0.95 },
  );
  // the dragon's head, looking ahead, jaws a little open, horns swept back, eyes of the Hub's orange
  const hy = LS.sheerEnd + 2.85;
  const hz = zb + 0.75;
  loft(
    g,
    [
      { c: [0, hy, hz - 0.1], rx: 0.16, ry: 0.2 },
      { c: [0, hy + 0.06, hz + 0.25], rx: 0.17, ry: 0.19 },
      { c: [0, hy + 0.02, hz + 0.65], rx: 0.13, ry: 0.13 },
      { c: [0, hy - 0.02, hz + 0.95], rx: 0.1, ry: 0.09 },
    ],
    { sides: 8, ref: [1, 0, 0], cap0: 0.06, cap1: [0, hy - 0.04, hz + 1.08], zone: 0, col: P.dragon, ao: 1 },
  );
  loft(
    g,
    [{ c: [0, hy - 0.13, hz + 0.2], rx: 0.11, ry: 0.06 }, { c: [0, hy - 0.2, hz + 0.6], rx: 0.09, ry: 0.05 }, { c: [0, hy - 0.22, hz + 0.88], rx: 0.07, ry: 0.035 }],
    { sides: 6, ref: [1, 0, 0], cap0: 0.04, cap1: 0.05, zone: 0, col: P.dragonDark, ao: 0.85 },
  );
  for (const s of [-1, 1]) {
    ellipsoid(g, [s * 0.14, hy + 0.1, hz + 0.42], [0.04, 0.045, 0.06], { sides: 6, rings: 3, zone: 0, col: P.ember, ao: 1.15 });
    loft(
      g,
      [{ c: [s * 0.09, hy + 0.16, hz + 0.15], rx: 0.05, ry: 0.05 }, { c: [s * 0.14, hy + 0.32, hz - 0.15], rx: 0.035, ry: 0.035 }],
      { sides: 5, ref: [0, 0, 1], cap1: [s * 0.17, hy + 0.42, hz - 0.45], zone: 0, col: P.horn, ao: 1 },
    );
  }
  // spines down the back of the neck
  for (let i = 0; i < 4; i++) {
    const c = [0, LS.sheerEnd + 1.0 + i * 0.5, zb + 0.42 + Math.sin(i * 0.9) * 0.1 - 0.1];
    loft(g, [{ c, rx: 0.025, ry: 0.07 }], { sides: 4, ref: [1, 0, 0], cap0: 0.02, cap1: [0, c[1] + 0.05, c[2] - 0.32], zone: 0, col: P.ember, ao: 1 });
  }
  // the stern: the post rising and curling over in a spiral
  const zs = -LS.L / 2;
  const stern = [
    [0, LS.keelEnd - 0.3, zs + 0.15],
    [0, LS.sheerEnd - 0.1, zs - 0.15],
    [0, LS.sheerEnd + 0.8, zs - 0.5],
    [0, LS.sheerEnd + 1.6, zs - 0.55],
    [0, LS.sheerEnd + 2.15, zs - 0.25],
    [0, LS.sheerEnd + 2.25, zs + 0.2],
    [0, LS.sheerEnd + 1.95, zs + 0.38],
    [0, LS.sheerEnd + 1.75, zs + 0.15],
  ];
  loft(
    g,
    stern.map((c, i) => ({ c, rx: 0.12 - i * 0.009, ry: 0.2 - i * 0.017 })),
    { sides: 7, ref: [1, 0, 0], cap0: 0.05, cap1: 0.04, zone: 0, col: P.dragon, ao: 0.95 },
  );
  // shields along both sides on the top plank: orange and bone by turns, a steel boss, a dark rim
  const NSH = 10;
  for (const s of [-1, 1])
    for (let i = 0; i < NSH; i++) {
      const u = 0.24 + (0.52 * i) / (NSH - 1);
      const z = h.zOf(u);
      const a = 0.86;
      const x = s * h.widthAt(u, a);
      const y = h.kl(u) + (h.sh(u) - h.kl(u)) * a + 0.02;
      const out = norm([s * 1, 0.12, (h.widthAt(u - 0.02, a) - h.widthAt(u + 0.02, a)) * s * 2]);
      const c0 = addv([x, y, z], scl(out, 0.05));
      const R = 0.46;
      const main = (i + (s > 0 ? 0 : 1)) % 2 ? P.ember : P.bone;
      const other = main === P.ember ? P.bone : P.ember;
      const ringed = i % 3 === 1;
      const rings = [
        [0.16, 0.07, P.steel],
        [0.2, 0.05, main],
        [0.52, 0.035, main],
        [0.6, 0.032, ringed ? other : main],
        [0.7, 0.028, ringed ? other : main],
        [0.78, 0.025, main],
        [0.88, 0.02, main],
        [0.93, 0.018, P.woodDark],
        [1.0, 0.0, P.woodDark],
      ];
      const lr = rings.map(([r, d]) => ({ c: addv(c0, scl(out, d)), rx: r * R, ry: r * R }));
      const cols = rings.map((r) => r[2]);
      lr.reverse();
      cols.reverse();
      loft(g, lr, {
        sides: 10,
        ref: [0, 1, 0],
        cap1: addv(c0, scl(out, 0.1)),
        zone: 0,
        col: (p, n, vi) => (vi >= lr.length * 10 ? P.steel : cols[Math.floor(vi / 10)]),
        ao: 1,
      });
    }
  // the oars, between the shields, through the top plank
  const NO = 5;
  for (const s of [-1, 1])
    for (let i = 0; i < NO; i++) {
      const u = 0.29 + (0.42 * i) / (NO - 1);
      const z = h.zOf(u);
      const piv = [s * (h.widthAt(u, 0.8) + 0.02), h.kl(u) + (h.sh(u) - h.kl(u)) * 0.8, z];
      oar(g, piv, s, 1.3, 4.0, 0.2, P.woodLight, 0.14);
    }
  // the crew: four rowers a side on their sea chests, facing aft; the helmsman standing at the steering oar
  const crew = [P.crimson, P.navy, P.teal, P.ochre, P.canvas, P.navy, P.crimson, P.teal];
  let ci = 0;
  for (const s of [-1, 1])
    for (let i = 0; i < 4; i++) {
      const u = 0.33 + (0.36 * i) / 3 + (s > 0 ? 0.03 : 0);
      const z = h.zOf(u) + 0.6;
      const x = s * (h.widthAt(u, 0.8) - 0.95);
      box(g, [x, LS.floor + 0.16, z + 0.05], [0.28, 0.16, 0.2], { zone: 0, col: P.woodDark, ao: 0.85 });
      const look = { tunic: crew[ci++ % crew.length], skin: P.skin, beard: pick(P.beards, ci * 0.37), steel: P.steel, horn: P.horn, legs: P.legs };
      rower(g, x, LS.floor + 0.33, z, look, false);
    }
  const helm = { tunic: P.crimson, skin: P.skin, beard: P.beards[0], steel: P.steel, horn: P.horn, legs: P.legs };
  rower(g, 1.1, LS.floor + 0.3, -LS.L / 2 + 2.6, helm, false, true);
  // the steering oar on the starboard quarter
  {
    const u = 0.12;
    const x = h.widthAt(u, 1) + 0.12;
    const z = h.zOf(u);
    const shaft = [{ c: [x, h.sh(u) + 0.6, z + 0.3], rx: 0.07, ry: 0.07 }, { c: [x + 0.1, -0.2, z - 0.35], rx: 0.07, ry: 0.07 }];
    loft(g, shaft, { sides: 6, ref: [0, 0, 1], cap0: 0.03, zone: 0, col: P.woodDark, ao: 1 });
    box(g, [x + 0.12, -0.55, z - 0.5], [0.05, 0.6, 0.28], { zone: 0, col: P.woodDark, ao: 0.9 });
  }
  // the mast, the yard and the sail
  const mz = SAIL.z - 0.3;
  loft(g, [{ c: [0, LS.floor, mz], rx: 0.16, ry: 0.16 }, { c: [0, 6, mz], rx: 0.13, ry: 0.13 }, { c: [0, SAIL.top + 1.3, mz], rx: 0.085, ry: 0.085 }], {
    sides: 7,
    ref: [1, 0, 0],
    cap1: 0.08,
    zone: 0,
    col: P.woodLight,
    ao: 1,
  });
  loft(
    g,
    [
      { c: [-SAIL.w / 2 - 0.35, SAIL.top + 0.08, SAIL.z - 0.05], rx: 0.06, ry: 0.06 },
      { c: [0, SAIL.top + 0.12, SAIL.z - 0.05], rx: 0.11, ry: 0.11 },
      { c: [SAIL.w / 2 + 0.35, SAIL.top + 0.08, SAIL.z - 0.05], rx: 0.06, ry: 0.06 },
    ],
    { sides: 6, ref: [0, 1, 0], cap0: 0.04, cap1: 0.04, zone: 0, col: P.woodLight, ao: 1 },
  );
  const NX = 15;
  const NY = 8;
  for (const face of [1, -1]) {
    const rows = [];
    for (let j = 0; j <= NY; j++) {
      const row = [];
      for (let i = 0; i <= NX; i++) {
        const u = i / NX;
        const v = j / NY;
        // a little narrower at the foot, as a square sail hangs
        const w = SAIL.w * (1 - 0.06 * v);
        row.push([(u - 0.5) * w, SAIL.top - v * SAIL.h, SAIL.z + face * 0.012]);
      }
      rows.push(row);
    }
    const V = [];
    const F = [];
    const UVs = [];
    rows.forEach((row, j) =>
      row.forEach((p, i) => {
        V.push(...p);
        UVs.push([i / NX, j / NY]);
      }),
    );
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const a = j * (NX + 1) + i;
        if (face > 0) F.push(a, a + NX + 1, a + 1, a + 1, a + NX + 1, a + NX + 2);
        else F.push(a, a + 1, a + NX + 1, a + 1, a + NX + 2, a + NX + 1);
      }
    const N = [];
    for (let k = 0; k < V.length / 3; k++) N.push(0, 0, face);
    orient(V, F, () => [0, 0, face]);
    g.prim(V, F, { zone: 4, col: WHITE, uv: (p, n, i) => UVs[i], bone: [6, 0, 0, 0], ao: 1 }, N);
  }
  return { geo: g.geometry(), hull: h };
}

// ------------------------------------------------------------------ the shadows on the ground and the marks on the water

const BLOB_VS = [
  "attribute vec4 aI0; varying vec2 vQ; varying float vK; varying float vD;",
  "void main() {",
  "  vQ = position.xz; vK = aI0.x;",
  "  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);",
  "  vD = distance(w.xyz, cameraPosition);",
  "  gl_Position = projectionMatrix * viewMatrix * w;",
  "}",
].join("\n");
const BLOB_FS = [
  "uniform vec3 uTint; uniform vec3 uFog; varying vec2 vQ; varying float vK; varying float vD;",
  "void main() {",
  "  float d = length(vQ);",
  "  float a = vK * (1.0 - smoothstep(0.25, 1.0, d));",
  "  a *= 1.0 - smoothstep(uFog.x, uFog.y, vD) * 0.94;",
  "  gl_FragColor = vec4(mix(vec3(1.0), uTint, a), 1.0);",
  "}",
].join("\n");

// The water round a boat, in the boat's own metres (x across, z along, the bow +z): the hull's shade on the water,
// a ring of foam where the hull meets it, a bow wave, the wake's two arms spreading behind and the churned water
// between them, and the shadow of the sail.
const MARK_VS = [
  "attribute vec4 aI0; attribute vec4 aI1; attribute vec4 aI2; uniform vec3 uSunDir;",
  "varying vec2 vL; varying vec3 vPW; varying vec3 vSun; varying vec4 vA; varying vec4 vB; varying vec4 vC;",
  "void main() {",
  "  vec3 lp = vec3(position.x * aI0.x, 0.0, mix(aI0.z, aI0.y, position.z * 0.5 + 0.5));",
  "  vL = lp.xz; vA = aI0; vB = aI1; vC = aI2;",
  "  vec4 w = modelMatrix * instanceMatrix * vec4(lp, 1.0);",
  "  vPW = w.xyz;",
  "  mat3 R = mat3(instanceMatrix);",
  "  vSun = vec3(dot(R[0], uSunDir), dot(R[1], uSunDir), dot(R[2], uSunDir));",
  "  gl_Position = projectionMatrix * viewMatrix * w;",
  "}",
].join("\n");
const MARK_FS = [
  "uniform sampler2D uNoise; uniform float uTime; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uFogCol; uniform vec3 uFog;",
  "varying vec2 vL; varying vec3 vPW; varying vec3 vSun; varying vec4 vA; varying vec4 vB; varying vec4 vC;",
  // the hull's outline at the waterline: how far outside it (metres, across)
  "float outside(vec2 q, float hl, float hb) {",
  "  float nz = clamp(q.y / hl, -1.0, 1.0); float w = hb * pow(max(0.0, 1.0 - pow(abs(nz), 2.3)), 0.62);",
  "  return max(abs(q.x) - w, abs(q.y) - hl);",
  "}",
  "void main() {",
  "  float speed = vA.w; float hl = vB.x, hb = vB.y;",
  "  vec2 q = vL;",
  "  float o = outside(q, hl, hb);",
  "  if (o < -0.02) discard;",
  "  vec2 wp = vPW.xz;",
  "  float n1 = texture2D(uNoise, wp / 5.0 + vec2(uTime * 0.03, uTime * 0.017)).a;",
  "  float n2 = texture2D(uNoise, wp / 13.0 - vec2(uTime * 0.012, 0.0)).g;",
  // the hull's shade, and the sail's, cast away from the sun
  "  vec3 sl = normalize(vSun);",
  "  vec2 off = -sl.xz / max(sl.y, 0.2);",
  "  float shade = (1.0 - smoothstep(-0.1, 0.9, outside(q - off * 0.5, hl * 1.02, hb * 1.15))) * 0.55;",
  "  if (vB.z > 0.0) {",
  "    float lam = (vC.y - q.y) / (abs(sl.z) > 1e-3 ? sl.z : 1e-3);",
  "    float sy = lam * sl.y; float sx = q.x + lam * sl.x;",
  "    float inS = step(0.0, lam) * smoothstep(vB.w - 0.6, vB.w + 0.6, sy) * (1.0 - smoothstep(vC.x - 0.6, vC.x + 0.6, sy));",
  "    inS *= 1.0 - smoothstep(vB.z - 0.6, vB.z + 0.6, abs(sx));",
  "    shade = max(shade, inS * 0.45);",
  "  }",
  // a ring of foam where the hull meets the water, more at the bow when under way
  "  float bow = smoothstep(0.2, 1.0, q.y / hl);",
  "  float ring = (1.0 - smoothstep(0.0, 0.25 + 0.5 * speed * bow + 0.15 * n2, o)) * (0.45 + 0.55 * n1);",
  "  ring *= 0.55 + speed * bow * 0.9;",
  // the wake: two arms spreading at the Kelvin angle behind the stern, the churned water between, both breaking up and fading
  "  float d = -q.y - hl * 0.85;",
  "  float wake = 0.0;",
  "  if (d > 0.0 && speed > 0.01) {",
  "    float fade = exp(-d / (3.0 + 11.0 * speed * vC.w)) * smoothstep(0.0, 1.5, d + 0.5);",
  "    float arm = hb * 0.8 + d * 0.34;",
  "    float th = 0.3 + d * 0.07;",
  "    float ax = (abs(q.x) - arm) / th;",
  // a soft crest with a sharper outer edge, feathered by the short slanting waves that run off it (still in the
  // boat's frame, as a real wake is), broken into patches by the noise, and thinning as it spreads
  "    float feather = 0.5 + 0.5 * sin((d * 0.8 - abs(q.x) * 0.55) * 6.2832 / (1.4 * vC.w));",
  "    float arms = exp(-ax * ax * (ax > 0.0 ? 3.0 : 1.2)) * smoothstep(0.25, 0.8, n1 + 0.1 + 0.25 * n2) * (0.4 + 0.6 * feather) / (1.0 + d * 0.05);",
  "    float trail = (1.0 - smoothstep(hb * 0.35, hb * 0.7 + d * 0.09, abs(q.x))) * exp(-d / (2.0 + 5.0 * speed * vC.w)) * smoothstep(0.3, 0.75, n2 * 0.6 + n1 * 0.5);",
  "    wake = clamp(arms * 0.75 + trail * 0.95, 0.0, 1.0) * fade * clamp(speed * 1.4, 0.0, 1.0);",
  "  }",
  "  float foam = clamp(max(ring, wake), 0.0, 1.0);",
  "  vec3 fc = vec3(0.93, 0.95, 0.93) * (uSunCol * 0.4 + uSkyCol * 0.5);",
  "  vec3 dark = vec3(0.012, 0.05, 0.07);",
  "  float aS = shade * (1.0 - foam);",
  "  float a = clamp(foam * 0.9 + aS, 0.0, 1.0);",
  "  vec3 c = (dark * aS + fc * foam * 0.9) / max(a, 1e-3);",
  "  float camD = distance(vPW, cameraPosition);",
  "  float f = smoothstep(uFog.x, uFog.y, camD) * 0.94;",
  "  c = mix(c, uFogCol, f);",
  "  gl_FragColor = vec4(c, a * (1.0 - f * 0.8));",
  "}",
].join("\n");

// ------------------------------------------------------------------ the ground as the terrain draws it


// The height of the land as its triangles have it (so feet and shadows sit on what is drawn), each node of the
// terrain's grid read from the ground once and kept.
class Surface {
  constructor(ground) {
    this.set(ground);
    this.h = 0;
  }
  set(ground) {
    this.g = ground;
    this.H = new Map();
  }
  node(x, z) {
    const k = (x + 8192) * 32768 + (z + 16384);
    let h = this.H.get(k);
    if (h === undefined) {
      h = this.g.height(x, z);
      this.H.set(k, h);
    }
    return h;
  }
  step(x, z) {
    return tileStep(x, z);
  }
  at(x, z) {
    const st = this.step(x, z);
    const fx = x / st;
    const fz = z / st;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const a = this.node(i * st, j * st);
    const b = this.node((i + 1) * st, j * st);
    const c = this.node(i * st, (j + 1) * st);
    const d = this.node((i + 1) * st, (j + 1) * st);
    if (Math.abs(a - d) < Math.abs(b - c)) return v > u ? a + (d - c) * u + (c - a) * v : a + (b - a) * u + (d - b) * v;
    return u + v < 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }
}

// ------------------------------------------------------------------ where the herds go

// Whether an animal may stand at (x, z): on the drawn tiles, well up from the shore, off the rivers and their
// banks, off the town's pads, out of the woods, below the moors, on gentle ground.
// F (optional): { list: the fields, home: the field the herd keeps to, or null }: inside its home, 3 m in
// from the wall (the dressing keeps the fields clear of trees); outside every other field by as much.
function landOk(x, z, pads, keep = 0, F = null) {
  if (x < CORE.x0 + 24 || x > CORE.x1 - 24 || z < CORE.z0 + 24 || z > CORE.z1 - 24) return false;
  if (shoreDist(x, z) < 14 + keep) return false;
  const rv = riverAt(x, z);
  if (rv && !rv.past && rv.d < rv.w / 2 + 8 + keep) return false;
  if (padNear(pads, x, z, 7 + keep)) return false;
  const home = F && F.home;
  if (home && fieldIn(home, x, z) < 3 + keep) return false;
  if (F) for (const f of F.list) if (f !== home && x > f.x0 - 5 && x < f.x1 + 5 && z > f.z0 - 5 && z < f.z1 + 5 && fieldIn(f, x, z) > -3 - keep) return false;
  if (!home && forestAt(x, z) > 0.16) return false;
  const h = naturalAt(x, z);
  if (h > 95) return false;
  const gx = (naturalAt(x + 2.5, z) - naturalAt(x - 2.5, z)) / 5;
  const gz = (naturalAt(x, z + 2.5) - naturalAt(x, z - 2.5)) / 5;
  return Math.hypot(gx, gz) < 0.28;
}
// The fields as the herds use them: each a convex polygon, its middle, the turn of its grid and its half sizes
// along it (a little short of the jittered corners), and a box round it.
function prepFields(fields) {
  return (fields || [])
    .filter((f) => f && f.poly && f.poly.length >= 3)
    .map((f) => {
      const poly = f.poly.map((p) => [p[0], p[1]]);
      const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length;
      const cz = poly.reduce((a, p) => a + p[1], 0) / poly.length;
      const q = { poly, kind: f.kind, cx, cz, sgn: 1, x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
      if (fieldIn(q, cx, cz) < 0) q.sgn = -1;
      for (const [x, z] of poly) {
        q.x0 = Math.min(q.x0, x);
        q.x1 = Math.max(q.x1, x);
        q.z0 = Math.min(q.z0, z);
        q.z1 = Math.max(q.z1, z);
      }
      // the grid's turn: given, or the first side's
      const ux0 = f.ux ?? poly[1][0] - poly[0][0];
      const uz0 = f.uz ?? poly[1][1] - poly[0][1];
      q.rot = Math.atan2(uz0, ux0);
      const ux = Math.cos(q.rot);
      const uz = Math.sin(q.rot);
      // how far the walls are from the middle along each axis (the nearest of the sides crossed)
      const reach = (dx, dz) => {
        let lo = 0;
        let hi = 400;
        for (let k = 0; k < 24; k++) {
          const m = (lo + hi) / 2;
          if (fieldIn(q, cx + dx * m, cz + dz * m) > 0) lo = m;
          else hi = m;
        }
        return lo;
      };
      q.hu = Math.min(reach(ux, uz), reach(-ux, -uz));
      q.hv = Math.min(reach(-uz, ux), reach(uz, -ux));
      return q;
    });
}
// How far (x, z) is inside a field (negative outside), to its nearest side.
function fieldIn(f, x, z) {
  const P = f.poly;
  let d = Infinity;
  for (let i = 0; i < P.length; i++) {
    const a = P[i];
    const b = P[(i + 1) % P.length];
    const ex = b[0] - a[0];
    const ez = b[1] - a[1];
    const L = Math.hypot(ex, ez) || 1;
    d = Math.min(d, (f.sgn * ((x - a[0]) * -ez + (z - a[1]) * ex)) / L);
  }
  return d;
}

function padNear(pads, x, z, keep) {
  for (const p of pads) if (Math.abs(p.x - x) < 80 && Math.abs(p.z - z) < 80 && rectOut(p, x, z) < keep) return true;
  return false;
}

// A closed line every metre or so: { X, Z, TX, TZ (unit tangent), n, ds, L }.
function lineOf(pts) {
  const n0 = pts.length;
  const cum = [0];
  for (let i = 1; i <= n0; i++) {
    const a = pts[i - 1];
    const b = pts[i % n0];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const L = cum[n0];
  const n = Math.max(8, Math.round(L));
  const ds = L / n;
  const X = new Float64Array(n);
  const Z = new Float64Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const s = i * ds;
    while (cum[k + 1] < s) k++;
    const a = pts[k];
    const b = pts[(k + 1) % n0];
    const t = (s - cum[k]) / (cum[k + 1] - cum[k] || 1);
    X[i] = lerp(a[0], b[0], t);
    Z[i] = lerp(a[1], b[1], t);
  }
  const TX = new Float64Array(n);
  const TZ = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const dx = X[(i + 1) % n] - X[(i - 1 + n) % n];
    const dz = Z[(i + 1) % n] - Z[(i - 1 + n) % n];
    const l = Math.hypot(dx, dz) || 1;
    TX[i] = dx / l;
    TZ[i] = dz / l;
  }
  return { X, Z, TX, TZ, n, ds, L };
}

// The point s along a closed line (out: [x, z, tx, tz]).
function along(line, s, out) {
  const f = (((s / line.ds) % line.n) + line.n) % line.n;
  const i = Math.floor(f);
  const j = (i + 1) % line.n;
  const t = f - i;
  out[0] = lerp(line.X[i], line.X[j], t);
  out[1] = lerp(line.Z[i], line.Z[j], t);
  const tx = lerp(line.TX[i], line.TX[j], t);
  const tz = lerp(line.TZ[i], line.TZ[j], t);
  const l = Math.hypot(tx, tz) || 1;
  out[2] = tx / l;
  out[3] = tz / l;
  return out;
}

// A wandering loop round (cx, cz), about R across, stretched and turned.
function loopAround(cx, cz, R, asp, rot, p1, p2, wob = 1) {
  const pts = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let k = 0; k < 240; k++) {
    const th = (TAU * k) / 240;
    const r = R * (1 + wob * (0.17 * Math.sin(2 * th + p1) + 0.08 * Math.sin(3 * th + p2)));
    const lx = r * Math.cos(th) * asp;
    const lz = (r * Math.sin(th)) / asp;
    pts.push([cx + lx * c - lz * s, cz + lx * s + lz * c]);
  }
  return lineOf(pts);
}

// Whether a herd may walk a loop, its band `band` wide either side (F: the fields, as landOk takes them).
function loopOk(line, band, pads, full = true, F = null) {
  const o = [0, 0, 0, 0];
  for (let s = 0; s < line.L; s += 4) {
    along(line, s, o);
    for (const k of [-1, 0, 1]) {
      const x = o[0] - o[3] * band * k;
      const z = o[1] + o[2] * band * k;
      if (full ? !landOk(x, z, pads, 0, F) : padNear(pads, x, z, 7)) return false;
    }
  }
  return true;
}

// A pasture for a herd near herd.at: { line, home (its field or null), laneK (how close its lanes are drawn
// in to fit) } or null. A field of the kinds it likes, near and not another herd's, comes first: a loop round
// its middle, kept off the walls; else the first loop on open ground that fits, looking further out each try.
function pastureNear(herd, pads, salt = 0, fields = [], taken = new Set()) {
  const r = rngOf(hash3(herd.id, 911, salt));
  const want = herd.kind === "horse" ? [4, 3] : [4, 3, 2];
  const far = (f) => Math.hypot(f.cx - herd.at[0], f.cz - herd.at[1]);
  const homes = fields.filter((f) => want.includes(f.kind) && !taken.has(f) && far(f) < (herd.reach || 170));
  homes.sort((a, b) => want.indexOf(a.kind) - want.indexOf(b.kind) || far(a) - far(b));
  for (const f of homes) {
    const A = Math.min(f.hu, f.hv) - 3;
    if (A < 8) continue;
    const band = Math.min(herd.band, 0.3 * A);
    for (let k = 0; k < 5; k++) {
      const sh = 1 - k * 0.1;
      const Ru = (Math.max(0, f.hu - 3 - band) * sh) / 1.13;
      const Rv = (Math.max(0, f.hv - 3 - band) * sh) / 1.13;
      if (Math.min(Ru, Rv) < band * 1.4) break;
      const line = loopAround(f.cx, f.cz, Math.sqrt(Ru * Rv), Math.sqrt(Ru / Rv), f.rot, r() * TAU, r() * TAU, 0.5);
      if (loopOk(line, band, pads, true, { list: fields, home: f })) return { line, home: f, laneK: band / herd.band };
    }
  }
  const F = fields.length ? { list: fields, home: null } : null;
  for (let tries = 0; tries < 46; tries++) {
    const reach = tries * 9;
    const a = r() * TAU;
    const cx = herd.at[0] + Math.cos(a) * reach * r();
    const cz = herd.at[1] + Math.sin(a) * reach * r();
    const R = herd.R * (tries > 30 ? 0.7 : 1) * (0.85 + r() * 0.3);
    const line = loopAround(cx, cz, R, 0.8 + r() * 0.5, r() * Math.PI, r() * TAU, r() * TAU);
    if (loopOk(line, herd.band, pads, true, F)) return { line, home: null, laneK: 1 };
  }
  return null;
}

// The ease of a walk: it gathers pace, keeps it, and slows to a stop (A of the time each).
const EA = 0.2;
const ease = (u) => (u < EA ? (u * u) / (2 * EA * (1 - EA)) : u > 1 - EA ? 1 - ((1 - u) * (1 - u)) / (2 * EA * (1 - EA)) : (u - EA / 2) / (1 - EA));
const easeV = (u) => (u < EA ? u / (EA * (1 - EA)) : u > 1 - EA ? (1 - u) / (EA * (1 - EA)) : 1 / (1 - EA));

// An animal's days: by turns it grazes and then walks a little way (now and then a trot), K of each, then all again.
// Every animal of a herd goes as far in the same time over the whole table, so a herd keeps together.
const KINDS = {
  horse: { graze: [12, 44], walkT: [4, 13], walkV: [1.0, 1.45], trotV: [2.7, 3.3], trot: 0.13, mean: 0.3, stride: 2.2, band: 3.2, len: [0.62, 0.55], scale: 1.15 },
  sheep: { graze: [5, 28], walkT: [2, 6], walkV: [0.38, 0.58], trotV: [1.0, 1.25], trot: 0.04, mean: 0.11, stride: 0.95, band: 1.4, len: [0.3, 0.3], scale: 1.25 },
};
// A member's own table is the herd's (base) with its rests and walks a little longer or shorter, over the same
// whole time: it goes as far as the herd, never far from it.
function scheduleOf(kind, r, base = null) {
  const K = 36;
  const G = new Float64Array(K);
  const W = new Float64Array(K);
  const D = new Float64Array(K);
  for (let k = 0; k < K; k++) {
    if (base) {
      G[k] = base.G[k] * (0.7 + r() * 0.6);
      W[k] = base.W[k] * (0.9 + r() * 0.2);
      D[k] = base.D[k];
      continue;
    }
    G[k] = lerp(kind.graze[0], kind.graze[1], r() * r() * 0.5 + r() * 0.5);
    const trot = r() < kind.trot;
    W[k] = lerp(kind.walkT[0], kind.walkT[1], r()) * (trot ? 0.75 : 1);
    const v = trot ? lerp(kind.trotV[0], kind.trotV[1], r()) : lerp(kind.walkV[0], kind.walkV[1], r());
    D[k] = v * W[k] * (1 - EA);
  }
  // the grazing stretched (or the walks shortened) to the herd's pace
  let Gt = 0;
  let Wt = 0;
  let St = 0;
  for (let k = 0; k < K; k++) {
    Gt += G[k];
    Wt += W[k];
    St += D[k];
  }
  let kG = base ? (base.T[K] - Wt) / Gt : (St / kind.mean - Wt) / Gt;
  if (!base && kG < 0.4) {
    const kD = (kind.mean * (Wt + 0.4 * Gt)) / St;
    for (let k = 0; k < K; k++) D[k] *= kD;
    kG = 0.4;
  }
  const T = new Float64Array(K + 1);
  const S = new Float64Array(K + 1);
  for (let k = 0; k < K; k++) {
    G[k] *= kG;
    T[k + 1] = T[k] + G[k] + W[k];
    S[k + 1] = S[k] + D[k];
  }
  return { K, G, W, D, T, S };
}

// How far an animal has gone by t, and how fast it goes (out: [distance, speed]).
function progress(sc, t, out) {
  const Tt = sc.T[sc.K];
  const n = Math.floor(t / Tt);
  const r = t - n * Tt;
  let lo = 0;
  let hi = sc.K - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (sc.T[m] <= r) lo = m;
    else hi = m - 1;
  }
  const k = lo;
  const local = r - sc.T[k];
  let s = sc.S[k];
  let v = 0;
  if (local > sc.G[k]) {
    const u = clamp((local - sc.G[k]) / sc.W[k], 0, 1);
    s += sc.D[k] * ease(u);
    v = (sc.D[k] * easeV(u)) / sc.W[k];
  }
  out[0] = n * sc.S[sc.K] + s;
  out[1] = v;
  return out;
}

// The herds: where each would like to graze (with fields, it settles in a pasture or a hay meadow within reach of
// there, 170 m unless given; else on the nearest open ground that fits), how many, how many young, how big a loop.
const HERDS = [
  { id: 1, kind: "horse", at: [-236, -40], R: 30, n: 5, foals: 1 },
  { id: 2, kind: "horse", at: [238, -66], R: 28, n: 4, foals: 0, reach: 240 },
  { id: 3, kind: "horse", at: [100, -105], R: 26, n: 4, foals: 1 },
  { id: 4, kind: "sheep", at: [-62, -112], R: 22, n: 13, foals: 3 },
  { id: 5, kind: "sheep", at: [148, -42], R: 20, n: 10, foals: 2 },
  { id: 6, kind: "sheep", at: [-360, -220], R: 26, n: 9, foals: 1 },
];

// ------------------------------------------------------------------ the boats' and the birds' ways

// A closed smooth line through points (Catmull-Rom), every metre.
function splineLoop(ctrl, step = 2) {
  const n = ctrl.length;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n];
    const p1 = ctrl[i];
    const p2 = ctrl[(i + 1) % n];
    const p3 = ctrl[(i + 2) % n];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const m = Math.max(2, Math.ceil(len / step));
    for (let k = 0; k < m; k++) {
      const t = k / m;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return lineOf(pts);
}

// Whether a boat's line keeps to water deep enough (heightAt under the hull and a margin round it) and off the stacks.
function seaOk(line, halfL, halfB) {
  const o = [0, 0, 0, 0];
  for (let s = 0; s < line.L; s += 3) {
    along(line, s, o);
    for (const [a, b] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const x = o[0] + o[2] * halfL * a - o[3] * halfB * b;
      const z = o[1] + o[3] * halfL * a + o[2] * halfB * b;
      if (heightAt(x, z) > -1.8 || shoreDist(x, z) > -6) return false;
    }
    for (const st of STACKS) if (Math.hypot(o[0] - st.x, o[1] - st.z) < st.r * 1.7 + halfL + 6) return false;
  }
  return true;
}

// The longship's long loop: in past the cove's mouth, out round the east stacks, far out to sea and back round the west.
const LONGSHIP_WAY = [
  [-30, 128],
  [40, 136],
  [92, 224],
  [230, 260],
  [330, 330],
  [300, 440],
  [120, 500],
  [-130, 490],
  [-320, 420],
  [-330, 300],
  [-230, 215],
  [-120, 160],
];
// The rowed boat's round in the cove, west of the pier.
const ROWED_WAY = [
  [-6, 74],
  [-14, 92],
  [-36, 102],
  [-56, 96],
  [-58, 80],
  [-42, 66],
  [-22, 63],
];

// ------------------------------------------------------------------ making it

export function makeLife(stage, ground, { pads = [], fields = null } = {}) {
  const KIT = window.KIT;
  const G = KIT.G;
  const PAL = KIT.PAL || {};
  const pal = (k, i, d) => lin((PAL[k] && PAL[k][i]) || d);
  const t0 = performance.now();
  const group = new THREE.Group();
  group.name = "life";
  const surf = new Surface(ground);
  let padList = pads.length ? pads : ground.pads || [];
  const fieldList = prepFields(fields);
  // (perKind: the triangles of one of each kind)
  const stats = { drawCalls: 0, triangles: 0, instances: {}, perKind: {}, ms: 0, herds: [], boats: [], fields: 0 };
  stats.fields = fieldList.length;
  const disposables = [];

  const instanced = (name, geo, kind, count, opts = {}) => {
    const mat = lifeMaterial(name, kind);
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.name = name;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const attrs = ["aI0", "aI1", "aI2"].map((k) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
      a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(k, a);
      return a;
    });
    mesh.userData.attrs = attrs;
    if (opts.order !== undefined) mesh.renderOrder = opts.order;
    group.add(mesh);
    disposables.push(geo, mat);
    const tris = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    stats.instances[name] = count;
    stats.perKind[name] = tris;
    stats.triangles += tris * count;
    stats.drawCalls++;
    return mesh;
  };

  const _m = new THREE.Matrix4();
  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const _e = new THREE.Euler(0, 0, 0, "YXZ");
  const _n = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  const _q2 = new THREE.Quaternion();
  // instance i of mesh at (x, y, z), turned yaw, pitched (nose up +), banked (right wing down +), scaled k (or kx, ky, kz)
  const place = (mesh, i, x, y, z, yaw, pitch, bank, kx, ky = kx, kz = kx) => {
    _p.set(x, y, z);
    _e.set(-pitch, yaw, -bank, "YXZ");
    _q.setFromEuler(_e);
    _s.set(kx, ky, kz);
    _m.compose(_p, _q, _s);
    _m.toArray(mesh.instanceMatrix.array, i * 16);
  };
  const set4 = (attr, i, a, b, c, d) => {
    const A = attr.array;
    A[i * 4] = a;
    A[i * 4 + 1] = b;
    A[i * 4 + 2] = c;
    A[i * 4 + 3] = d;
  };
  const done = (mesh, n = mesh.count) => {
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    for (const a of mesh.userData.attrs) a.needsUpdate = true;
  };

  // the sun's way across the ground: where a thing's shadow falls, per metre of its height
  const sunDir = G.uSunDir.value;
  const so = [0, 0];
  const sunOff = () => {
    so[0] = -sunDir.x / Math.max(sunDir.y, 0.2);
    so[1] = -sunDir.z / Math.max(sunDir.y, 0.2);
  };

  // ---------------------------------------------------------------- the colours
  const P = {
    wood: pal("wood", 0, "#7d6a57"),
    woodDark: nudge(pal("wood", 3, "#665645"), 0.8),
    woodLight: pal("woodLight", 0, "#a8957c"),
    // the inside of a hull: between the two, so it stays warm in its own shade
    woodIn: nudge(pal("wood", 0, "#7d6a57"), 0.9, 0.04),
    floor: pal("wood", 1, "#73614f"),
    straw: pal("straw", 0, "#d3c7a8"),
    rope: pal("rope", 0, "#b99c6c"),
    skin: pal("skin", 0, "#e0b48f"),
    beard: lin("#8a5a33"),
    beards: [lin("#8a5a33"), lin("#b8915c"), lin("#5a3d27"), lin("#c9a36a")],
    steel: pal("steel", 0, "#959da4"),
    horn: lin("#ece3cf"),
    legs: lin("#4a3f35"),
    ember: lin("#f26a1b"),
    bone: lin("#f3f1ec"),
    crimson: pal("crimson", 0, "#8f2f2a"),
    navy: pal("navy", 1, "#34486a"),
    teal: pal("teal", 1, "#467a74"),
    ochre: pal("ochre", 0, "#c9973e"),
    canvas: pal("canvasDusty", 0, "#cdbd9c"),
    dragon: lin("#5b4a3a"),
    dragonDark: lin("#3a3029"),
  };

  // ---------------------------------------------------------------- herds
  const horseGeom = horseGeo();
  const sheepGeom = sheepGeo();
  const nHorse = HERDS.filter((h) => h.kind === "horse").reduce((a, h) => a + h.n, 0);
  const nSheep = HERDS.filter((h) => h.kind === "sheep").reduce((a, h) => a + h.n, 0);
  const horses = instanced("horses", horseGeom, { vert: HORSE_VERT, wrap: 0.32, rim: 0.7 }, nHorse);
  const sheep = instanced("sheep", sheepGeom, { vert: SHEEP_VERT, wrap: 0.55, rim: 0.9, surface: SHEEP_SURFACE }, nSheep);

  // where a herd grazes: its loop, its field (kept from the other herds) and how close its lanes are drawn in
  const taken = new Set();
  const settle = (herd, plan) => {
    if (herd.home) taken.delete(herd.home);
    herd.line = plan ? plan.line : null;
    herd.home = plan ? plan.home : null;
    herd.laneK = plan ? plan.laneK : 1;
    if (herd.home) taken.add(herd.home);
  };
  const herds = HERDS.map((def) => {
    const kind = KINDS[def.kind];
    const r = rngOf(hash3(def.id, 17, 3));
    const herd = { ...def, k: kind, band: ((def.n - 1) / 2) * kind.band + 1.5, members: [] };
    // lanes across the band, shuffled, so no two walk over each other
    const lanes = [];
    for (let m = 0; m < def.n; m++) lanes.push((m - (def.n - 1) / 2) * kind.band);
    for (let m = lanes.length - 1; m > 0; m--) {
      const j = Math.floor(r() * (m + 1));
      [lanes[m], lanes[j]] = [lanes[j], lanes[m]];
    }
    // the herd's own table of rests and walks, and where in it the herd is at t = 0
    const base = scheduleOf(kind, rngOf(hash3(def.id, 5, 99)));
    const off = r() * base.T[base.K];
    for (let m = 0; m < def.n; m++) {
      const young = m >= def.n - def.foals;
      const lag = (r() - 0.5) * (def.kind === "horse" ? 14 : 10);
      const mem = {
        lane: lanes[m] + (r() - 0.5) * 0.5,
        lag,
        // those in front set off first
        toff: off + lag * 0.7 + r() * 4,
        sched: scheduleOf(kind, rngOf(hash3(def.id, m, 99)), base),
        seed: r() * 100,
        scale: kind.scale * (young ? 0.6 + r() * 0.06 : 0.93 + r() * 0.14),
        young,
      };
      if (def.kind === "horse") {
        // a foal takes its mother's coat (the herd's first)
        const ci = young ? herd.members[0].ci : Math.floor(r() * COATS.length);
        const C = COATS[ci];
        const k = 0.92 + r() * 0.16;
        mem.ci = ci;
        mem.coat = nudge(lin(C.coat), k);
        mem.hair = nudge(lin(C.hair), 0.9 + r() * 0.2);
        let marks = (C.points ? 32 : 0) | (C.dorsal ? 64 : 0);
        if (r() < 0.4) marks |= 1;
        for (let l = 0; l < 4; l++) if (r() < (l < 2 ? 0.16 : 0.3)) marks |= 2 << l;
        mem.marks = marks;
      } else {
        const black = !young && r() < 0.09;
        mem.coat = black ? lin("#3b3330") : nudge(lin(pick(FLEECES, r())), 0.96 + r() * 0.08);
        mem.hair = black ? lin("#1f1a17") : lin(pick(FACES, r()));
        mem.lie = r() < 0.25;
      }
      herd.members.push(mem);
    }
    settle(herd, pastureNear(herd, padList, 0, fieldList, taken));
    const L = herd.line ? Math.round(herd.line.L) : 0;
    stats.herds.push({ id: def.id, kind: def.kind, n: def.n, placed: !!herd.line, L, field: herd.home ? herd.home.kind : null });
    return herd;
  });

  // ---------------------------------------------------------------- birds
  const birdGeom = birdGeo();
  const flocks = [];
  const fr = rngOf(9127);
  const addFlock = (f) => {
    f.birds = [];
    for (let i = 0; i < f.n; i++) {
      const R = lerp(f.R[0], f.R[1], fr());
      f.birds.push({
        R,
        w: ((f.dir ?? (fr() < 0.5 ? 1 : -1)) * lerp(f.speed[0], f.speed[1], fr())) / R,
        ph: fr() * TAU,
        rm: 0.12 + fr() * 0.2,
        rw: 0.05 + fr() * 0.08,
        rp: fr() * TAU,
        h: lerp(f.h[0], f.h[1], fr()),
        hA: 2 + fr() * 5,
        hw: 0.06 + fr() * 0.1,
        hp: fr() * TAU,
        seed: fr() * 50,
        k: f.scale * (0.9 + fr() * 0.2),
      });
    }
    flocks.push(f);
  };
  // gulls: over the cove, round the east stacks, along the west cliffs, over the town, and following the longship
  addFlock({ kind: 0, n: 7, c: [6, 70], drift: [26, 18, 140], R: [18, 50], speed: [7, 9.5], h: [16, 38], scale: 1.9 });
  addFlock({ kind: 0, n: 6, c: [128, 158], drift: [22, 16, 170], R: [14, 40], speed: [7, 9], h: [22, 46], scale: 1.9 });
  addFlock({ kind: 0, n: 5, c: [-118, 92], drift: [24, 20, 160], R: [16, 42], speed: [7, 9], h: [20, 44], scale: 1.9 });
  addFlock({ kind: 0, n: 3, c: [10, -20], drift: [30, 24, 200], R: [22, 40], speed: [7, 8.5], h: [34, 52], scale: 1.9 });
  addFlock({ kind: 0, n: 4, c: null, ship: true, drift: [0, 0, 1], R: [8, 18], speed: [6, 8], h: [10, 18], scale: 1.9 });
  // crows over the woods up the valley
  addFlock({ kind: 2, n: 5, c: [-40, -380], drift: [30, 26, 150], R: [10, 26], speed: [6, 7.5], h: [28, 40], scale: 1.25, ground: true, dir: 1 });
  // terns, skimming the cove beyond the pier on their own looping ways
  const terns = [];
  for (let i = 0; i < 4; i++)
    terns.push({
      cx: -4 + (fr() - 0.5) * 16,
      cz: 106 + (fr() - 0.5) * 10,
      ax: 34 + fr() * 12,
      bx: 6 + fr() * 6,
      az: 12 + fr() * 6,
      w1: 0.13 + fr() * 0.05,
      w2: 0.21 + fr() * 0.07,
      w3: 0.47 + fr() * 0.2,
      p1: fr() * TAU,
      p2: fr() * TAU,
      p3: fr() * TAU,
      h: 2.8 + fr() * 1.2,
      seed: fr() * 50,
      k: 1.3,
    });
  const nFly = flocks.reduce((a, f) => a + f.n, 0) + terns.length;
  const birds = instanced("birds", birdGeom, { vert: BIRD_VERT, wrap: 0.45, rim: 0.6 }, nFly);

  // gulls standing: on the stacks' tops, along the pier's deck at its end, on the wet sand
  const perchGeom = perchGeo();
  const perched = [];
  const pr = rngOf(4411);
  for (const st of STACKS) {
    const n = st.r > 7 ? 3 : st.r > 5 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      let best = null;
      for (let tr = 0; tr < 24; tr++) {
        const a = pr() * TAU;
        const d = pr() * st.r * 0.55;
        const x = st.x + Math.cos(a) * d;
        const z = st.z + Math.sin(a) * d;
        const h = naturalAt(x, z);
        const flat = Math.abs(naturalAt(x + 0.6, z) - naturalAt(x - 0.6, z)) + Math.abs(naturalAt(x, z + 0.6) - naturalAt(x, z - 0.6));
        if (flat < 0.5 && (!best || h > best.h - 0.3) && !perched.some((p) => Math.hypot(p.x - x, p.z - z) < 1.2)) best = { x, z, h };
      }
      if (best) perched.push({ x: best.x, z: best.z, y: null, yaw: pr() * TAU, seed: pr() * 40, k: 1.55 });
    }
  }
  // three on the pier's deck near its end, a little in from either edge (harbour.js keeps these spots clear)
  for (let i = 0; i < 3; i++) {
    const s = i % 2 ? -1 : 1;
    const yaw = (s > 0 ? -1 : 1) * Math.PI * 0.5 + (pr() - 0.5);
    perched.push({ x: PIER.x + s * (PIER.w / 2 - 0.3), z: PIER.z1 - 0.8 - i * 2.3, y: PIER.deck, yaw, seed: pr() * 40, k: 1.55, deck: true });
  }
  for (let tr = 0; tr < 80 && perched.filter((p) => p.sand).length < 4; tr++) {
    const x = -30 + pr() * 54;
    const z = 30 + pr() * 6;
    if (Math.abs(x - PIER.x) < 5) continue;
    const h = heightAt(x, z);
    if (h < 0.2 || h > 0.7) continue;
    if (perched.some((p) => Math.hypot(p.x - x, p.z - z) < 2)) continue;
    perched.push({ x, z, y: null, yaw: Math.PI * 0.85 + (pr() - 0.5) * 1.5, seed: pr() * 40, k: 1.55, sand: true });
  }
  const perch = instanced("perched", perchGeom, { vert: PERCH_VERT, wrap: 0.45, rim: 0.6 }, perched.length);

  // ---------------------------------------------------------------- boats
  const fish = fishingGeo(P);
  const longGeo = longshipGeo(P);
  const boatKind = (strakes, tar) => ({
    vert: BOAT_VERT.replace("void lifePose", `const float SAIL_W = ${SAIL.w.toFixed(2)}; const float SAIL_H = ${SAIL.h.toFixed(2)};\nvoid lifePose`),
    wrap: 0.25,
    rim: 0.55,
    surface: boatSurface(strakes, tar),
  });
  const boats = [
    { kind: "moored", x: PIER.x + PIER.w / 2 + FB.B / 2 + 0.35, z: 60, yaw: 0.04, paint: P.teal, crew: 0 },
    { kind: "moored", x: PIER.x - PIER.w / 2 - FB.B / 2 - 0.35, z: 69, yaw: Math.PI - 0.03, paint: P.crimson, crew: 0 },
    { kind: "rowed", line: splineLoop(ROWED_WAY, 1.5), v: 0.95, paint: P.ember, crew: 1, tunic: P.navy },
  ];
  const fishing = instanced("boats", fish.geo, boatKind(5, 0), boats.length);
  const longship = { line: splineLoop(LONGSHIP_WAY, 3), v: 2.3 };
  const ship = instanced("longship", longGeo.geo, boatKind(7, 3), 1);
  stats.boats.push({
    rowed: seaOk(boats[2].line, FB.L / 2, FB.B / 2),
    rowedL: Math.round(boats[2].line.L),
    longship: seaOk(longship.line, LS.L / 2, LS.B / 2),
    longL: Math.round(longship.line.L),
  });

  // ---------------------------------------------------------------- shadows and water marks
  const quad = new THREE.PlaneGeometry(2, 2);
  quad.rotateX(-Math.PI / 2);
  const nBlob = (nHorse + nSheep) * 2 + perched.length;
  const blobMat = new THREE.ShaderMaterial({
    vertexShader: BLOB_VS,
    fragmentShader: BLOB_FS,
    uniforms: { uTint: { value: new THREE.Vector3(0.3, 0.36, 0.5) }, uFog: G.uFog },
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.DstColorFactor,
    blendDst: THREE.ZeroFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  const blobGeo = quad.clone();
  const blobA = new THREE.InstancedBufferAttribute(new Float32Array(nBlob * 4), 4);
  blobA.setUsage(THREE.DynamicDrawUsage);
  blobGeo.setAttribute("aI0", blobA);
  const blobs = new THREE.InstancedMesh(blobGeo, blobMat, nBlob);
  blobs.name = "shadows";
  blobs.frustumCulled = false;
  blobs.renderOrder = 1;
  blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  blobs.userData.attrs = [blobA];
  group.add(blobs);
  disposables.push(blobGeo, blobMat);
  stats.drawCalls++;
  stats.triangles += 2 * nBlob;

  const markGeo = new THREE.PlaneGeometry(2, 2, 1, 1);
  markGeo.rotateX(-Math.PI / 2);
  const markMat = new THREE.ShaderMaterial({
    vertexShader: MARK_VS,
    fragmentShader: MARK_FS,
    uniforms: {
      uNoise: { value: noiseTexture() },
      uTime: stage.shared.uTime,
      uSunDir: G.uSunDir,
      uSunCol: G.uSunCol,
      uSkyCol: G.uSkyCol,
      uFogCol: G.uFogCol,
      uFog: G.uFog,
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  const nMark = boats.length + 1;
  const markAttrs = ["aI0", "aI1", "aI2"].map((k) => {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(nMark * 4), 4);
    a.setUsage(THREE.DynamicDrawUsage);
    markGeo.setAttribute(k, a);
    return a;
  });
  const marks = new THREE.InstancedMesh(markGeo, markMat, nMark);
  marks.name = "water marks";
  marks.frustumCulled = false;
  // after the sea (which is drawn at 0)
  marks.renderOrder = 3;
  marks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  marks.userData.attrs = markAttrs;
  group.add(marks);
  disposables.push(markGeo, markMat, quad);
  stats.drawCalls++;
  stats.triangles += 2 * nMark;

  stage.moving(group);

  // ---------------------------------------------------------------- each frame
  const o4 = [0, 0, 0, 0];
  const pr2 = [0, 0];
  let nb = 0;
  // a soft shadow on the ground at (x, z): half-length hl along yaw, half-width hw, how dark
  // the tilt of the last shadow, for a second one nearby
  let bYaw = 0;
  let bPitch = 0;
  let bRoll = 0;
  // pitch and y0, when the caller already knows them, save reading the ground again
  const blob = (x, z, yaw, hl, hw, k, pitch = null, y0 = null) => {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    if (y0 === null) y0 = surf.at(x, z);
    if (pitch === null) {
      const yf = surf.at(x + fx * hl, z + fz * hl);
      const yb = surf.at(x - fx * hl, z - fz * hl);
      pitch = Math.atan2(yf - yb, 2 * hl);
    }
    const yl = surf.at(x + fz * hw, z - fx * hw);
    const yr = surf.at(x - fz * hw, z + fx * hw);
    const roll = Math.atan2(yr - yl, 2 * hw);
    const y = Math.max(y0, (yl + yr) / 2) + 0.06;
    place(blobs, nb, x, y, z, yaw, pitch, roll, hw, 1, hl);
    set4(blobA, nb, k, 0, 0, 0);
    bYaw = yaw;
    bPitch = pitch;
    bRoll = roll;
    nb++;
  };
  // a second shadow at (x, z) lying on the same slope as the last
  const blobAgain = (x, z, hl, hw, k) => {
    const y = surf.at(x, z) + 0.08;
    place(blobs, nb, x, y, z, bYaw, bPitch, bRoll, hw, 1, hl);
    set4(blobA, nb, k, 0, 0, 0);
    nb++;
  };

  // where a herd's member is at t: [x, z, yaw, speed, distance]
  const memberAt = (herd, m, t, out) => {
    progress(m.sched, t + m.toff, pr2);
    const dist = pr2[0];
    const v = pr2[1];
    along(herd.line, m.lag + dist, o4);
    const lane = (m.lane + 0.7 * Math.sin(dist / 23 + m.seed)) * herd.laneK;
    out[0] = o4[0] - o4[3] * lane;
    out[1] = o4[1] + o4[2] * lane;
    const still = 1 - smooth(0.05, 0.4, v);
    out[2] = Math.atan2(o4[2], o4[3]) + still * 0.75 * wander(t * 0.021 + m.seed, m.seed);
    out[3] = v;
    out[4] = dist;
    return out;
  };

  const mo = [0, 0, 0, 0, 0];
  const updateHerds = (t) => {
    let ih = 0;
    let is = 0;
    sunOff();
    for (let hi = 0; hi < herds.length; hi++) {
      const herd = herds[hi];
      if (!herd.line) continue;
      const isHorse = herd.kind === "horse";
      const mesh = isHorse ? horses : sheep;
      const A0 = mesh.userData.attrs[0];
      const A1 = mesh.userData.attrs[1];
      const A2 = mesh.userData.attrs[2];
      for (let mi = 0; mi < herd.members.length; mi++) {
        const m = herd.members[mi];
        memberAt(herd, m, t, mo);
        const x = mo[0];
        const z = mo[1];
        const yaw = mo[2];
        const v = mo[3];
        const dist = mo[4];
        const k = m.scale;
        const lf = herd.k.len[0] * k;
        const lb = herd.k.len[1] * k;
        const fx = Math.sin(yaw);
        const fz = Math.cos(yaw);
        const yf = surf.at(x + fx * lf, z + fz * lf);
        const yb = surf.at(x - fx * lb, z - fz * lb);
        const pitch = Math.atan2(yf - yb, lf + lb);
        const y = yb + ((yf - yb) * lb) / (lf + lb);
        const walk = smooth(0.03, isHorse ? 0.9 : 0.35, v);
        const i = isHorse ? ih++ : is++;
        const phase = ((dist / (herd.k.stride * k)) * TAU) % TAU;
        if (isHorse) {
          const trot = smooth(1.7, 2.5, v);
          // grazing, with now and then a look up and about
          const look = smooth(0.55, 0.8, wander(t * 0.05 + m.seed * 3.1, m.seed + 7));
          const down = (1 - walk) * (1 - look);
          place(mesh, i, x, y, z, yaw, pitch, 0, k);
          set4(A0, i, phase, walk, trot, down);
          set4(A1, i, m.coat[0], m.coat[1], m.coat[2], m.marks);
          const swish = 0.32 * Math.sin(t * 1.9 + m.seed) * smooth(0.3, 0.7, wander(t * 0.13 + m.seed, m.seed * 2)) + 0.05 * Math.sin(t * 0.7 + m.seed);
          set4(A2, i, m.hair[0], m.hair[1], m.hair[2], swish);
          blob(x, z, yaw, 0.95 * k, 0.42 * k, 0.78, pitch, y);
          blobAgain(x + so[0] * 1.1 * k, z + so[1] * 1.1 * k, 1.05 * k, 0.42 * k, 0.42);
        } else {
          const lie = m.lie ? smooth(0.3, 0.6, wander(t * 0.006 + m.seed, m.seed + 3)) * (1 - walk) : 0;
          const down = (1 - walk) * (1 - smooth(0.5, 0.8, wander(t * 0.07 + m.seed * 2.3, m.seed + 9))) * (1 - lie);
          place(mesh, i, x, y, z, yaw, pitch * (1 - lie), 0, k);
          set4(A0, i, phase, walk, down, lie);
          set4(A1, i, m.coat[0], m.coat[1], m.coat[2], 0);
          set4(A2, i, m.hair[0], m.hair[1], m.hair[2], 0);
          blob(x, z, yaw, 0.55 * k, 0.4 * k, 0.75, pitch, y);
          blobAgain(x + so[0] * 0.55 * k, z + so[1] * 0.55 * k, 0.55 * k, 0.42 * k, 0.4);
        }
      }
    }
    done(horses, ih);
    done(sheep, is);
  };

  // where a flying bird is at t (out: [x, y, z])
  const shipAt = [0, 0, 0, 0];
  const birdAt = (f, b, t, out) => {
    let cx;
    let cz;
    if (f.ship) {
      along(longship.line, longship.v * t, shipAt);
      cx = shipAt[0] - shipAt[2] * 6;
      cz = shipAt[1] - shipAt[3] * 6;
    } else {
      cx = f.c[0] + f.drift[0] * Math.sin((TAU * t) / f.drift[2] + b.seed * 0.1);
      cz = f.c[1] + f.drift[1] * Math.sin((TAU * t) / (f.drift[2] * 1.37) + b.seed * 0.07);
    }
    const th = b.w * t + b.ph;
    const r = b.R * (1 + b.rm * Math.sin(b.rw * t + b.rp));
    out[0] = cx + r * Math.cos(th);
    out[2] = cz + r * Math.sin(th);
    out[1] = (f.ground ? f.base : 0) + b.h + b.hA * Math.sin(b.hw * t + b.hp);
    return out;
  };
  const ternAt = (b, t, out) => {
    out[0] = b.cx + b.ax * Math.sin(b.w1 * t + b.p1) + b.bx * Math.sin(b.w3 * t + b.p3);
    out[2] = b.cz + b.az * Math.sin(b.w2 * t + b.p2);
    out[1] = b.h + 0.9 * Math.sin(b.w3 * 1.3 * t + b.p2);
    return out;
  };
  for (const f of flocks) if (f.ground) f.base = naturalAt(f.c[0], f.c[1]);

  const pa = [0, 0, 0];
  const pb = [0, 0, 0];
  const pc = [0, 0, 0];
  const flyPose = (i, at, t, kind, k, seed, flapBase) => {
    const h = 0.12;
    at(t - h, pa);
    at(t, pb);
    at(t + h, pc);
    const vx = (pc[0] - pa[0]) / (2 * h);
    const vy = (pc[1] - pa[1]) / (2 * h);
    const vz = (pc[2] - pa[2]) / (2 * h);
    const ax = (pc[0] - 2 * pb[0] + pa[0]) / (h * h);
    const az = (pc[2] - 2 * pb[2] + pa[2]) / (h * h);
    const vh = Math.hypot(vx, vz) || 1;
    const yaw = Math.atan2(vx, vz);
    // sideways pull in the bird's own frame (+x its right... its +x wing): into the turn it banks
    const side = (ax * Math.cos(yaw) - az * Math.sin(yaw)) / 9.8;
    const bank = clamp(Math.atan(side) * 1.5, -0.85, 0.85);
    const pitch = clamp(Math.atan2(vy, vh), -0.4, 0.4);
    place(birds, i, pb[0], pb[1], pb[2], yaw, pitch, bank, k);
    let flap;
    let dih;
    let freq;
    if (kind === 0) {
      flap = Math.max(smooth(0.25, 0.65, wander(t * 0.09 + seed, seed)), smooth(0.4, 1.6, vy) * 0.8);
      dih = 0.14;
      freq = 2.7;
    } else if (kind === 1) {
      flap = 0.65 + 0.3 * wander(t * 0.4 + seed, seed);
      dih = 0.05;
      freq = 3.6;
    } else {
      flap = Math.max(0.15, smooth(-0.1, 0.5, wander(t * 0.12 + seed, seed)));
      dih = 0.09;
      freq = 3.1;
    }
    flap = Math.max(flap, flapBase);
    set4(birds.userData.attrs[0], i, (t * freq * TAU + seed * 7) % TAU, flap, dih, kind);
  };
  // every bird in flight with its way through the air (made once)
  const flyers = [];
  for (const f of flocks) for (const b of f.birds) flyers.push({ at: (tt, out) => birdAt(f, b, tt, out), kind: f.kind, k: b.k, seed: b.seed });
  for (const b of terns) flyers.push({ at: (tt, out) => ternAt(b, tt, out), kind: 1, k: b.k, seed: b.seed });
  const updateBirds = (t) => {
    let i = 0;
    for (let fi = 0; fi < flyers.length; fi++) {
      const b = flyers[fi];
      flyPose(i++, b.at, t, b.kind, b.k, b.seed, 0);
    }
    done(birds, i);
    // standing gulls, now and then turning their heads
    let j = 0;
    for (const p of perched) {
      if (p.y === null) p.y = p.deck ? PIER.deck : surf.at(p.x, p.z);
      place(perch, j, p.x, p.y, p.z, p.yaw + 0.25 * jerky(t, 0.05, p.seed + 3), 0, 0, p.k);
      set4(perch.userData.attrs[0], j, 1.3 * jerky(t, 0.45, p.seed), 0, 0, 0);
      if (!p.deck) blob(p.x, p.z, p.yaw, 0.32, 0.22, 0.5);
      j++;
    }
    done(perch, j);
  };

  const bo = [0, 0, 0, 0];
  const updateBoats = (t) => {
    const F0 = fishing.userData.attrs[0];
    const F1 = fishing.userData.attrs[1];
    const F2 = fishing.userData.attrs[2];
    const M0 = markAttrs[0];
    const M1 = markAttrs[1];
    const M2 = markAttrs[2];
    let im = 0;
    for (let i = 0; i < boats.length; i++) {
      const b = boats[i];
      let x;
      let z;
      let yaw;
      let speed = 0;
      let row = 0;
      let ph = 0;
      const sd = i * 1.7;
      if (b.kind === "moored") {
        // tied at the pier: it bobs, rolls a little, and swings on its ropes
        x = b.x + 0.12 * Math.sin(t * 0.21 + sd);
        z = b.z + 0.2 * Math.sin(t * 0.13 + sd);
        yaw = b.yaw + 0.035 * Math.sin(t * 0.17 + sd);
      } else {
        // rowed: a pull at each stroke, gliding between
        const w = TAU * 0.42;
        ph = (w * t) % TAU;
        const s = b.v * t + ((b.v * 0.3) / w) * Math.sin(w * t);
        along(b.line, s, bo);
        x = bo[0];
        z = bo[1];
        yaw = Math.atan2(bo[2], bo[3]);
        speed = (b.v * (1 + 0.3 * Math.cos(w * t))) / 2.5;
        row = 1;
      }
      // (the floor, 0.16 up, stays above the water at the deepest of these)
      const y = 0.045 * Math.sin(t * 1.15 + sd) + 0.025 * Math.sin(t * 1.9 + sd * 2);
      const roll = 0.035 * Math.sin(t * 0.93 + sd) + 0.015 * Math.sin(t * 1.7 + sd);
      const pitch = 0.012 * Math.sin(t * 0.77 + sd * 3);
      place(fishing, i, x, y, z, yaw, pitch, roll, 1);
      set4(F0, i, ph, row, b.crew, 0);
      set4(F1, i, b.paint[0], b.paint[1], b.paint[2], 0);
      const tu = b.tunic || P.navy;
      set4(F2, i, tu[0], tu[1], tu[2], 0);
      // the water round it
      place(marks, im, x, 0.02, z, yaw, 0, 0, 1);
      set4(M0, im, speed > 0 ? FB.B / 2 + 22 * 0.36 + 2 : FB.B / 2 + 3, FB.L / 2 + 2, -(FB.L / 2 + (speed > 0 ? 22 : 2)), clamp(speed, 0, 1));
      set4(M1, im, fish.hull.lenWL, fish.hull.beamWL, 0, 0);
      set4(M2, im, 0, 0, i, 1);
      im++;
    }
    done(fishing, boats.length);
    // the longship
    const w = TAU * 0.33;
    const s = longship.v * t + ((longship.v * 0.12) / w) * Math.sin(w * t);
    along(longship.line, s, bo);
    const yaw = Math.atan2(bo[2], bo[3]);
    const y = 0.05 * Math.sin(t * 0.8) + 0.03 * Math.sin(t * 1.31 + 1);
    // it heels a little into the wind on the sail and rolls with the swell
    const roll = 0.03 + 0.015 * Math.sin(t * 0.61 + 0.3);
    const pitch = 0.01 * Math.sin(t * 0.9);
    place(ship, 0, bo[0], y, bo[1], yaw, pitch, roll, 1);
    const S0 = ship.userData.attrs[0];
    const S1 = ship.userData.attrs[1];
    const S2 = ship.userData.attrs[2];
    set4(S0, 0, (w * t) % TAU, 1, 1, 1.25);
    set4(S1, 0, P.ember[0], P.ember[1], P.ember[2], (t * 2.3) % TAU);
    set4(S2, 0, P.navy[0], P.navy[1], P.navy[2], 0);
    done(ship, 1);
    place(marks, im, bo[0], 0.02, bo[1], yaw, 0, 0, 1);
    set4(M0, im, LS.B / 2 + 50 * 0.36 + 3, LS.L / 2 + 14, -(LS.L / 2 + 50), clamp(longship.v / 2.6, 0, 1));
    set4(M1, im, longGeo.hull.lenWL, longGeo.hull.beamWL, SAIL.w / 2, SAIL.top - SAIL.h);
    set4(M2, im, SAIL.top, SAIL.z + 0.6, 9, 2.4);
    im++;
    done(marks, im);
  };

  let last = 0;
  const life = {
    group,
    stats,
    update(t) {
      last = t;
      nb = 0;
      updateHerds(t);
      updateBirds(t);
      updateBoats(t);
      done(blobs, nb);
    },
    setGround(next, { pads: np } = {}) {
      ground = next;
      surf.set(next);
      padList = np || next.pads || [];
      for (const herd of herds) {
        if (herd.line && loopOk(herd.line, herd.band * herd.laneK, padList, false)) continue;
        if (herd.home) taken.delete(herd.home);
        settle(herd, pastureNear(herd, padList, 1, fieldList, taken));
      }
      for (const p of perched) if (!p.deck) p.y = null;
      // read the new ground under everything now, not over the next frames
      life.update(last);
    },
    // where something is at t, for pointing a camera at it
    where(kind, i, j, t) {
      if (kind === "herd") {
        const herd = herds[i];
        if (!herd?.line) return null;
        memberAt(herd, herd.members[j || 0], t, mo);
        return [mo[0], surf.at(mo[0], mo[1]), mo[1]];
      }
      if (kind === "boat") {
        if (i >= boats.length) {
          along(longship.line, longship.v * t, bo);
          return [bo[0], 0, bo[1]];
        }
        const b = boats[i];
        if (b.kind === "moored") return [b.x, 0, b.z];
        along(b.line, b.v * t, bo);
        return [bo[0], 0, bo[1]];
      }
      if (kind === "flock") {
        const f = flocks[i];
        birdAt(f, f.birds[j || 0], t, pa);
        return pa.slice();
      }
      return null;
    },
    dispose() {
      for (const d of disposables) d.dispose();
      group.clear();
    },
  };
  // the first picture, which also reads the ground under everything once
  life.update(0);
  stats.ms = Math.round(performance.now() - t0);
  return life;
}
