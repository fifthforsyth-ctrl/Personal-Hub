// The town's fixed heart and its waterfront: the plaza at the head of the cove
// and the pier running out from the beach below it, built with the painterly
// kit (public/kit) so they stand in the same light and the same hand as the
// builds round them.
//
// The plaza is paved with soft cushioned flagstones, each its own colour, in
// rings round the flag's stepped base and at random beyond, the grass creeping
// into the joints toward a chunky kerb that breaks where the town's lanes come
// in (its north corners, the middle of its north, east and west sides). The
// Hub's orange flies over it from a tall pole; lamps stand by the lanes and on
// the south wall, benches face the drill ground and the sea, a birch grows in
// a round stone bed in the south-west corner, and a well, a notice post with
// its papers and two fires burning on stone pillars give it a Nordic hearth.
// Its south side is a low wall looking over the beach, broken by broad steps
// down to the sand and by the boardwalk that slopes down to the pier, a lamp
// on a pier either side of its head.
//
// The pier is a deck of planks on pile bents marching out into the cove: piles
// dark with weed where the tide wets them, braced crosswise under the deck,
// a bollard at every other bent, a lantern and a ladder at its end. On the
// sand: a boat drawn up on rollers and one turned over on logs, nets drying
// over a rail, a rack of stockfish, a little net shed with a turf roof, crates.
//
//   makeHarbour(stage) -> { group, height(x, z), dispose() }
//   group: the still layer (layer 0), casting and receiving the sun's shadows; the flag's cloth is in the
//     moving layer (stage.moving), drawn every frame so it flies. group.userData: { ms (build time),
//     tris (triangles laid by each part, for the lab) }.
//   height(x, z): the top of what the harbour adds to stand on there (the paving, the flag's steps, the steps
//     down to the beach, the boardwalk, the pier's deck), or null where it adds nothing.
//
// Everything stands on coast.js heightAt, and only where that is the same
// whichever pads the town has levelled (|x| < 14 on the beach), so nothing
// floats or sinks as the town grows. Nothing stands in the drill ground in
// front of the flag (plots.js formationOf: 16 m wide from z 2 to z 9), and
// both sides of the pier are clear below the deck for the boats moored there.

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
// the steps down to the beach, between their cheek walls
const STEP_X = 2.6;
const CHEEK = 0.6;
// the flag's stepped base: [outer radius, height] of each tier, from the bottom
const TIERS = [
  [1.75, 0.32],
  [1.2, 0.3],
  [0.68, 0.28],
];
// the paving's stones: warm greys and buffs, now and then a blue-grey or a brown one
const PAL_FLAG = ["#aca290", "#b4a995", "#a39a8a", "#bbb09b", "#a9a092", "#9c968b", "#b0a48d", "#a8a39a", "#b8a78c", "#a1937f", "#9ea09a", "#b3aa9c"];
// the birch in the plaza's south-west corner, in its round bed of stones
const TREE = [-9.7, 8.9];
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
        const f = r ? 0.74 : 1;
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

// A tree's crown grown the way dressing.js grows the coast's trees, so the plaza's birch is one of them: puffs of
// lumpy ball, each lit by its own roundness bent toward the whole crown's, darker low down and in the hollows
// between the puffs, lighter and warmer on top (a colour to multiply the leaves' by). puffs: [[x, y, z, r], ...]
function crownGeo(puffs, rnd) {
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const ball = new THREE.IcosahedronGeometry(1, 2).attributes.position;
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
  for (const [px, py, pz, pr] of puffs) {
    const lumps = [];
    for (let k = 0; k < 6; k++) {
      const u = rnd() * 2 - 1;
      const a = rnd() * TAU;
      const sq = Math.sqrt(1 - u * u);
      lumps.push([Math.cos(a) * sq, u, Math.sin(a) * sq, 0.5 + rnd() * 0.5]);
    }
    const tone = 0.94 + rnd() * 0.12;
    for (let i = 0; i < ball.count; i++) {
      const dx = ball.getX(i);
      const dy = ball.getY(i);
      const dz = ball.getZ(i);
      let k = 1;
      for (const [lx, ly, lz, w] of lumps) k += 0.2 * w * Math.exp(-((dx - lx) ** 2 + (dy - ly) ** 2 + (dz - lz) ** 2) * 6);
      const x = px + dx * k * pr;
      const y = py + dy * k * pr * 0.92;
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
      const nx = lerp(dx, ex, 0.5);
      const ny = lerp(dy, ey, 0.5);
      const nz = lerp(dz, ez, 0.5);
      const nL = Math.hypot(nx, ny, nz) || 1;
      nor.push(nx / nL, ny / nL, nz / nL);
      // facing into the crown (between puffs) is dark, and so is low down
      const out = dx * ex + dy * ey + dz * ez;
      const up = clamp((y - lo) / (hi - lo), 0, 1);
      const ao = lerp(0.42, 1, smooth(0, 0.85, up)) * lerp(0.58, 1, smooth(-0.3, 0.6, out));
      const t = smooth(0.15, 1, up);
      col.push(tone * ao * lerp(0.74, 1.14, t), tone * ao * lerp(0.82, 1.1, t), tone * ao * lerp(0.96, 0.88, t));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// ------------------------------------------------------------------ the net's mesh

// A net's mesh drawn on a canvas: diamonds of twine, knotted where they cross (white; the vertex colour tints it).
// The twine covers a little over half the tile, so the mesh never thins away to nothing in the distance.
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
  g.lineWidth = 9;
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
        g.arc(i * s + ox, j * s + oy, 7, 0, TAU);
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

// ------------------------------------------------------------------ the flag, flying

// The Hub's flag in the moving layer: the cloth waves in the wind from the sea, lit as the kit lights cloth (a soft
// sun ramp, the still layer's shadows, sky and ground fill with the shade lifted toward the sky's blue, a warm rim,
// the haze), so it sits with the rest. The pole and its finial stay in the still layer.
const FLAG_VERT = ["uniform float uFlagTime; uniform float uFlagW;", "varying vec3 vPW; varying vec3 vNW; varying float vU;"].join("\n");
const FLAG_WAVE = [
  // u: 0 at the pole, 1 at the fly; the wave runs out along it, growing toward the free end
  "float u = clamp(position.x / uFlagW, 0.0, 1.0);",
  "float ph = uFlagTime * 3.1 - u * 7.0;",
  "float amp = (0.06 + 0.3 * u * u) * uFlagW * 0.22;",
  "transformed.z += sin(ph) * amp + sin(uFlagTime * 1.7 - u * 4.0 + position.y * 1.3) * amp * 0.35;",
  "transformed.y -= u * u * uFlagW * 0.04 * (1.0 + 0.5 * sin(uFlagTime * 0.9));",
  "transformed.x -= (1.0 - cos(ph)) * amp * 0.12 * u;",
  // the normal from the wave's slope along u
  "float dz = cos(ph) * (-7.0 / uFlagW) * amp;",
  "objectNormal = normalize(vec3(-dz, 0.0, 1.0));",
  "vU = u;",
].join("\n");
const FLAG_FRAG = [
  "uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uGndCol; uniform vec3 uRimCol; uniform vec3 uFogCol; uniform vec3 uFog;",
  "uniform float uShadeLift; uniform sampler2D uStroke;",
  "varying vec3 vPW; varying vec3 vNW; varying float vU;",
].join("\n");
const FLAG_MAIN = [
  "vec3 N = normalize(vNW);",
  "vec3 V = normalize(cameraPosition - vPW);",
  // the side of the cloth turned to the camera
  "if (dot(N, V) < 0.0) N = -N;",
  "vec4 st = texture2D(uStroke, vPW.xy * 0.32 + vPW.z * 0.21);",
  "vec3 alb = diffuseColor.rgb * (1.0 + (st.r - 0.5) * 0.12 + (st.b - 0.5) * 0.08);",
  // the hem and the edge by the pole a touch darker, as a sewn edge is
  "alb *= mix(0.88, 1.0, smoothstep(0.0, 0.04, vU));",
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
  "float dist = length(vPW - cameraPosition);",
  "c = mix(c, uFogCol, smoothstep(uFog.x, uFog.y, dist) * 0.92);",
  "gl_FragColor = vec4(c, clamp(lit, 0.0, 1.0));",
].join("\n");

function makeFlag(stage, at, w, h, ry) {
  const KIT = window.KIT;
  const G = KIT.G;
  const geo = new THREE.PlaneGeometry(w, h, 14, 6);
  geo.translate(w / 2, -h / 2, 0);
  const color = new THREE.Color("#f26a1b").convertSRGBToLinear();
  const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
  const U = { uFlagTime: stage.shared.uTime, uFlagW: { value: w } };
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
  const treads = stepTreads();
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
    // the triangles each part of the harbour lays (kept on group.userData.tris, for the lab)
    const tris = {};
    // spots on the plaza gone to grass, for a tuft each
    const TUFTS = [];
    const count = () => Object.values(b.buckets).reduce((a, k) => a + k.idx.n, 0) / 3;
    const secMs = {};
    const sec = (name, fn) => {
      const n0 = count();
      const m0 = performance.now();
      b.base(fn);
      tris[name] = (tris[name] || 0) + Math.round(count() - n0);
      secMs[name] = Math.round(performance.now() - m0);
    };

    // ================================================================ the plaza
    sec("paving", () => {
      // the bed the flagstones are set in: its joints a warm grey, greening toward the kerb where the grass creeps in
      const JOINT = new T.Color("#766c5d");
      const TURF = new T.Color("#738a48");
      const greenAt = (x, z) => clamp(U.smooth(8.6, 11.7, Math.max(Math.abs(x), Math.abs(z))) * 0.9 + noise2(x * 0.45 + 7.1, z * 0.45) * 0.4, 0, 1);
      const bed = new T.PlaneGeometry(PLAZA.w - 0.4, PLAZA.d - 0.4, 24, 24);
      bed.rotateX(-Math.PI / 2);
      b.addGeo(bed, { y: Y0 + 0.035, m: M.stone, ao: 0, jit: 0, vary: 0.05, colors: (wx, wy, wz) => JOINT.clone().lerp(TURF, greenAt(wx, wz)) });
      // the flagstones: two rings of wedges round the flag's base, then at random to the kerb, some merged into big ones
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
      const stones = flagstones([-IN, IN, -IN, IN], 0.84, rnd, { extra: rings, jitter: 0.9, skip: (x, z) => Math.hypot(x, z) < 3.55 || rnd() < 0.17 });
      const PAL_RING = ["#c0aa88", "#b8a182", "#c7b291", "#ae977a"];
      const PAL_TURF = ["#6f8745", "#7a9150", "#68803f", "#809555"];
      const MOSS = new T.Color("#7f8a58");
      const list = [];
      const turf = [];
      for (const s of stones) {
        // under the birch's bed: nothing
        if (Math.hypot(s.cx - TREE[0], s.cz - TREE[1]) < 1.0) continue;
        const ring = Math.hypot(s.cx, s.cz) < 3.4;
        const edge = Math.max(Math.abs(s.cx), Math.abs(s.cz));
        const toEdge = U.smooth(7.5, 11.8, edge);
        // near the kerb, out of the ways people walk, a stone now and then gone to grass
        const walked = (Math.abs(s.cx) < 4.2 && s.cz > 7) || (s.cx > 7 && s.cz > 7) || (s.cz < -7.5 && (Math.abs(s.cx) > 7.8 || Math.abs(s.cx - 1) < 2.6));
        if (!walked && r2() < 0.3 * U.smooth(9.4, 11.3, edge)) {
          turf.push({ pts: s.pts, y: Y0 + 0.07, foot: Y0 + 0.02, dome: 0.035, bevel: 0.14, c: lc(pick(PAL_TURF)), cx: s.cx, cz: s.cz });
          continue;
        }
        const c = new T.Color(pick(ring ? PAL_RING : PAL_FLAG));
        const q = r2();
        if (q < 0.1) c.offsetHSL(0.01, -0.03, -0.06);
        else if (q < 0.2) c.offsetHSL(-0.01, 0.03, 0.03);
        // worn paler where feet go, darker and greener toward the kerb
        c.offsetHSL(0, 0, -0.04 * toEdge + 0.015 * (1 - toEdge));
        if (r2() < 0.4 * toEdge) c.lerp(MOSS, 0.15 + r2() * 0.25);
        c.offsetHSL(0, 0, noise2(s.cx / 6 + 3.1, s.cz / 6 - 1.7) * 0.03);
        list.push({ pts: s.pts, y: TOP + (r2() - 0.5) * 0.02, foot: Y0 + 0.02, dome: 0.02 + r2() * 0.018, bevel: 0.1, c: lc("#" + c.getHexString()) });
      }
      // the landing at the head of the steps, paved the same
      const land = treads[0];
      const landStones = flagstones([-STEP_X, STEP_X, HW - 0.46, land.z1 - 0.3], 0.86, rnd);
      for (const s of landStones) {
        const c = new T.Color(pick(PAL_FLAG)).offsetHSL(0, 0, -0.02 + (r2() - 0.5) * 0.05);
        list.push({ pts: s.pts, y: TOP + (r2() - 0.5) * 0.02, foot: Y0 + 0.02, dome: 0.025, bevel: 0.1, c: lc("#" + c.getHexString()) });
      }
      b.addGeo(cushionGeo(list), { c: "#ffffff", m: M.stone, ao: 0.35, jit: 0, vary: 0.05 });
      b.addGeo(cushionGeo(turf), { c: "#ffffff", m: M.grass, ao: 0.2, jit: 0, vary: 0.08 });
      for (const t of turf) if (r2() < 0.7) TUFTS.push([t.cx, t.cz]);
      // the landing's bed
      b.box(0, Y0 - 0.6, (HW - 0.46 + land.z1) / 2, STEP_X * 2, 0.635, land.z1 - HW + 0.46, { c: JOINT, m: M.stone, bevel: 0, ao: 0, jit: 0 });
    });

    // the kerb: long dressed stones a hand above the paving, broken where the lanes come in
    sec("kerb", () => {
      const kerbRun = (side, a0, a1) => {
        let t = a0;
        while (t < a1 - 0.2) {
          const len = Math.min(a1 - t, 0.95 + r2() * 0.75);
          const m = t + len / 2;
          const w = len - 0.05;
          const h = 0.55 + r2() * 0.05;
          const top = TOP + 0.12 + (r2() - 0.5) * 0.03;
          const o = { c: stone("stone", 0.5), m: M.stone, bevel: 0.09, ao: 0.3, jit: 0.035, ry: (r2() - 0.5) * 0.025 };
          const inset = HW - 0.25;
          if (side === "north") b.box(m, top - h, -inset, w, h, 0.5, o);
          else if (side === "west") b.box(-inset, top - h, m, 0.5, h, w, o);
          else b.box(inset, top - h, m, 0.5, h, w, o);
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
      const sill = (x, z, w, d) => b.box(x, TOP - 0.25, z, w, 0.265, d, { c: stone("stoneCool", 0.5), m: M.stone, bevel: 0.06, ao: 0.2, jit: 0.04 });
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
          b.box(x + len / 2, wallTop - 0.12, HW - 0.25, len - 0.03, 0.13, 0.62, {
            c: stone("sandstone", 1),
            m: M.stone,
            bevel: 0.05,
            ao: 0.15,
            jit: 0.03,
            ry: (r2() - 0.5) * 0.02,
          });
          x += len;
        }
      };
      run(-HW, -STEP_X - CHEEK);
      run(STEP_X + CHEEK, PIERS[1] - 0.36);
      // square piers a little taller, a lamp on each: at the south-west corner and either side of the boardwalk
      for (const x of PIERS) {
        b.box(x, Y0 - 0.3, HW - 0.3, 0.72, wallTop + 0.2 - (Y0 - 0.3), 0.72, { c: stone("stone", 0.5), m: M.stone, bevel: 0.07, ao: 0.2 });
        b.box(x, wallTop + 0.17, HW - 0.3, 0.84, 0.12, 0.84, { c: stone("sandstone", 1), m: M.stone, bevel: 0.05, ao: 0.1 });
      }
    });

    // the steps down to the beach, between cheek walls that step down with them
    sec("steps", () => {
      const SAND = new T.Color("#c9b48c");
      treads.forEach((t, k) => {
        const next = treads[k + 1];
        if (k >= 0) {
          // two or three long stones across each tread (the landing's only along its front edge)
          const n = 2 + (r2() < 0.5 ? 1 : 0);
          let x = -STEP_X;
          for (let i = 0; i < n; i++) {
            const w = i === n - 1 ? STEP_X - x : (2 * STEP_X) / n + (r2() - 0.5) * 0.8;
            const z0 = k === 0 ? t.z1 - 0.34 : t.z0 - 0.05;
            const z1 = t.z1 + 0.07;
            const low = Math.min(lowOf(x + w / 2, (z0 + z1) / 2, w / 2), next ? next.y : t.y) - 0.3;
            // the paving's stones, a little darker and sandier toward the beach
            const c = new T.Color(pick(PAL_FLAG)).lerp(SAND, 0.25 * (k / treads.length)).offsetHSL(0, 0, -0.03 * (k / treads.length));
            b.box(x + w / 2, low, (z0 + z1) / 2, w - 0.04, t.y - low, z1 - z0, { c, m: M.stone, bevel: 0.07, ao: 0.3, jit: 0.03 });
            x += w;
          }
        }
        // the cheek walls: a block a tread, its top a step above the tread
        for (const sd of [-1, 1]) {
          const cx = sd * (STEP_X + CHEEK / 2);
          const z0 = k === 0 ? HW - 0.3 : t.z0;
          const z1 = t.z1 + (next ? 0 : 0.3);
          const low = lowOf(cx + sd * 0.4, (z0 + z1) / 2, (z1 - z0) / 2) - 0.3;
          const top = k === 0 ? wallTop - 0.1 : t.y + 0.42;
          b.box(cx, low, (z0 + z1) / 2, CHEEK, top - low, z1 - z0 - 0.02, { c: stone("stone", 0.6), m: M.stone, bevel: 0.07, ao: 0.3, jit: 0.035 });
          b.box(cx, top, (z0 + z1) / 2, CHEEK + 0.1, 0.11, z1 - z0 + 0.04, { c: stone("sandstone", 1), m: M.stone, bevel: 0.045, ao: 0.1, jit: 0.03 });
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
      // the pole: a straight pine trunk, iron bands, a collar of wedges at its foot
      b.cyl(0, flagTop - 0.05, 0, 0.16, POLE, { r2: 0.085, c: "#5e5245", m: M.wood, seg: 9 });
      for (const [yy, rr] of [
        [0.15, 0.175],
        [0.55, 0.17],
        [POLE * 0.5, 0.135],
        [POLE - 0.6, 0.1],
      ])
        b.cyl(0, flagTop + yy, 0, rr, 0.09, { c: "iron", m: M.metal, seg: 9 });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + 0.4;
        b.box(Math.cos(a) * 0.24, flagTop - 0.02, Math.sin(a) * 0.24, 0.14, 0.22, 0.2, { ry: -a, c: "woodDark", m: M.wood, bevel: 0.02, taper: 0.6 });
      }
      // the finial: a ring and a gilded ball, and the halyard down the pole
      b.ball(0, flagTop + POLE + 0.05, 0, 0.17, { c: "brass", m: M.gold, detail: 1 });
      b.cyl(0, flagTop + POLE - 0.12, 0, 0.12, 0.1, { c: "iron", m: M.metal, seg: 9 });
      const hx = Math.cos(FLAG_RY) * 0.1;
      const hz = -Math.sin(FLAG_RY) * 0.1;
      b.beam([hx, flagTop + 1.1, hz], [hx, flagTop + POLE - 0.15, hz], 0.012, { round: true, seg: 3, c: "rope", m: M.rope, ao: 0 });
      b.box(hx, flagTop + 1.0, hz, 0.06, 0.18, 0.06, { c: "iron", m: M.metal, bevel: 0.01 });
    });
    flag = makeFlag(stage, [Math.cos(FLAG_RY) * 0.1, flagTop + POLE - 0.22, -Math.sin(FLAG_RY) * 0.1], FLAG_W, FLAG_H, FLAG_RY);

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
      b.beam([0, ay - 0.04, 0.8], [0, ay - 0.15, 0.8], 0.014, { round: true, seg: 4, c: "iron", m: M.metal, ao: 0 });
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
      b.addGeo(new T.TorusGeometry(0.045, 0.014, 4, 8), { x: 0, y: ly + 0.74, z: 0.8, c: "iron", m: M.metal, ao: 0 });
      b.pop();
    };
    // a bench: a thick plank on two blocks of stone
    const bench = (x, z, L, ry, y = TOP) => {
      b.push(x, y, z, ry);
      for (const s of [-1, 1]) b.box(s * (L / 2 - 0.3), -0.04, 0, 0.32, 0.42, 0.42, { c: stone("stone", 0.6), m: M.stone, bevel: 0.05, ao: 0.3 });
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
      b.flowers(x, y + 0.62, z, 0.36, { c, n: 7 });
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

    // the birch in the plaza's south-west corner: a round bed of stones to sit on, turfed, flowers in the grass
    sec("birch", () => {
      const [tx, tz] = TREE;
      b.stoneRing(tx, tz, 0.95, Y0 + 0.03, 0.36, 0.3, { pal: "stone", course: 0.36, len: 0.7, core: false });
      b.stoneRing(tx, tz, 0.98, Y0 + 0.39, 0.1, 0.4, { pal: "sandstone", course: 0.1, len: 0.75, core: false });
      b.cyl(tx, Y0 + 0.03, tz, 0.84, 0.35, { c: "#6c8444", m: M.grass, seg: 12, ao: 0 });
      // the trunk, slim and white, leaning a little; three boughs out to the low puffs
      const h = 6.3;
      const y0 = Y0 + 0.36;
      const top = [tx + 0.12, y0 + h * 0.8, tz - 0.06];
      b.beam([tx, y0 - 0.1, tz], top, 0.13, { round: true, r2: 0.06, seg: 7, c: "#e4ded0", m: M.wood, ao: 0.4 });
      const puffs = [
        [0, 0.71, 0, 0.2],
        [-0.14, 0.59, 0.08, 0.16],
        [0.15, 0.6, -0.06, 0.16],
        [0.03, 0.56, 0.16, 0.15],
        [-0.04, 0.87, -0.02, 0.15],
        [0.09, 0.78, 0.11, 0.14],
        [-0.11, 0.76, -0.09, 0.14],
        [0.05, 0.62, -0.16, 0.14],
      ].map(([x, y, z, r]) => [tx + x * h, y0 + y * h, tz + z * h, r * h]);
      // the bark's dark marks
      for (let i = 0; i < 14; i++) {
        const f = 0.05 + r2() * 0.62;
        const a = r2() * TAU;
        const rr = lerp(0.13, 0.06, f / 0.8) + 0.005;
        b.box(
          lerp(tx, top[0], f) + Math.cos(a) * rr,
          lerp(y0, top[1], f),
          lerp(tz, top[2], f) + Math.sin(a) * rr,
          0.09 + r2() * 0.06,
          0.025 + r2() * 0.02,
          0.02,
          { ry: -a + Math.PI / 2, c: "#3d3832", m: M.wood, bevel: 0, ao: 0, jit: 0.03 },
        );
      }
      for (const q of [puffs[1], puffs[2], puffs[3]])
        b.beam([tx + 0.06, y0 + h * 0.42, tz - 0.03], [q[0], q[1] - q[3] * 0.3, q[2]], 0.05, { round: true, r2: 0.03, seg: 5, c: "#d9d2c2", m: M.wood, ao: 0 });
      b.addGeo(crownGeo(puffs, r2), { c: "#6f9842", m: M.leaf, ao: 0, jit: 0, vary: 0.05 });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + r2() * 0.5;
        const d = 0.3 + r2() * 0.45;
        b.grass(tx + Math.cos(a) * d, Y0 + 0.38, tz + Math.sin(a) * d, 0.28 + r2() * 0.2, { c: pick(["#7f9a4e", "#86a052", "#748f47"]) });
      }
      b.flowers(tx + 0.3, Y0 + 0.3, tz - 0.25, 0.4, { c: "#f3f1ec", n: 6 });
      b.flowers(tx - 0.35, Y0 + 0.3, tz + 0.3, 0.3, { c: "#efe08a", n: 4 });
    });

    // the well: a round of stones, a timber frame with a little roof, a windlass, a rope and a bucket
    sec("well", () => {
      // out in the corner, a couple of metres clear of where the villagers stand (plots.js spotsOf)
      const wx = -9.6;
      const wz = -7.0;
      b.stoneRing(wx, wz, 0.72, TOP - 0.05, 0.84, 0.3, { pal: "stoneCool", course: 0.28, len: 0.62, core: false });
      b.cyl(wx, TOP + 0.5, wz, 0.6, 0.02, { c: "#3b5054", m: M.water, seg: 12, ao: 0 });
      b.stoneRing(wx, wz, 0.74, TOP + 0.79, 0.12, 0.36, { pal: "sandstone", course: 0.12, len: 0.7, core: false });
      for (const s of [-1, 1]) {
        b.post(wx + s * 0.78, TOP + 0.3, wz, 0.07, 1.75, { c: "woodDark" });
        b.box(wx + s * 0.78, TOP + 0.5, wz, 0.3, 0.12, 0.2, { c: "iron", m: M.metal, bevel: 0.02 });
      }
      b.beam([wx - 0.95, TOP + 1.5, wz], [wx + 0.95, TOP + 1.5, wz], 0.07, { round: true, seg: 8, c: "wood" });
      b.addGeo(new T.TorusGeometry(0.07, 0.03, 4, 10), { x: wx + 0.95, y: TOP + 1.5, z: wz, ry: Math.PI / 2, c: "iron", m: M.metal, ao: 0 });
      b.beam([wx + 0.95, TOP + 1.5, wz], [wx + 0.95, TOP + 1.25, wz + 0.18], 0.025, { c: "iron", m: M.metal });
      b.beam([wx, TOP + 1.47, wz], [wx, TOP + 0.95, wz], 0.014, { round: true, seg: 4, c: "rope", m: M.rope, ao: 0 });
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
      for (const [px, py, w, h, c, rz] of papers) b.box(px, py - h / 2, 0.16, w, h, 0.012, { rz, c, m: M.paint, bevel: 0, ao: 0, jit: 0.01 });
      b.pop();
      // a cart's worth of stores beside it
      b.barrel(10.6, TOP, -6.5, { h: 0.9, r: 0.33 });
      b.barrel(10.2, TOP, -5.8, { h: 0.82, r: 0.3, ry: 0.8 });
      b.crate(10.75, TOP, -7.4, 0.7, { ry: 0.25 });
      b.crate(10.7, TOP + 0.7, -7.35, 0.55, { ry: -0.1 });
      b.barrel(9.85, TOP, -7.0, { lie: true, ry: 1.1, h: 0.8, r: 0.28 });
    });

    // a fire at the head of the steps, either side: an iron brazier burning on a squat pillar of stones
    sec("braziers", () => {
      for (const s of [-1, 1]) {
        const x = s * (STEP_X + CHEEK + 0.75);
        const z = HW - 1.0;
        b.box(x, TOP - 0.12, z, 1.0, 0.46, 1.0, { c: stone("stone", 0.3), m: M.stone, bevel: 0.08, ao: 0.3 });
        b.box(x, TOP + 0.34, z, 0.8, 0.55, 0.8, { c: stone("stone", 0.9), m: M.stone, bevel: 0.07, ao: 0.15, ry: 0.06 * s });
        b.box(x, TOP + 0.89, z, 0.76, 0.48, 0.76, { c: stone("stone", 1.4), m: M.stone, bevel: 0.07, ao: 0.1, ry: -0.05 * s });
        b.box(x, TOP + 1.37, z, 0.94, 0.14, 0.94, { c: stone("sandstone", 2), m: M.stone, bevel: 0.05, ao: 0.1 });
        b.brazier(x, TOP + 1.51, z, 0.72, { i: 1.2 });
      }
    });

    // ================================================================ the boardwalk and the pier
    sec("pier", () => {
      const zEnd = PIER.z1;
      // the bents the deck stands on: two piles each, a cap across them
      const bents = [];
      for (let z = HW + 1.4; z < PIER.z0; z += 2.2) bents.push(z);
      for (let z = PIER.z0 + 0.4; z < zEnd - 1.6; z += 3.55) bents.push(z);
      bents.push(zEnd - 0.3);
      // the life module's gulls stand on the deck near the end, a little in from either edge: keep their spots clear
      const gullAt = (x, z) =>
        [
          [PX + PH - 0.3, zEnd - 0.8],
          [PX - PH + 0.3, zEnd - 3.1],
          [PX + PH - 0.3, zEnd - 5.4],
        ].some(([gx, gz]) => Math.hypot(gx - x, gz - z) < 0.9);
      const pileC = (wy) => (wy < 0.25 ? "#33372d" : wy < 0.65 ? "#4b4a3c" : wy < 0.75 ? "#5e594b" : "#6c6152");
      bents.forEach((z, k) => {
        const yd = deckY(z);
        const cap = yd - 0.47;
        const sea = H(PX, z) < 0.2;
        for (const s of [-1, 1]) {
          const px = PX + s * (PH - 0.24);
          const bed = lowOf(px, z, 0.3);
          // every other pile on the pier runs up through the deck: a bollard to tie to
          const bollard = sea && k % 2 === 1 && !gullAt(px, z);
          const top = bollard ? yd + 0.62 : cap + 0.2;
          const r = sea ? 0.17 : 0.13;
          b.cyl(px, bed - 0.6, z, r * 1.04, top - bed + 0.6, {
            r2: r * 0.96,
            c: "wood",
            m: M.wood,
            seg: 8,
            ao: 0.05,
            colors: (wx, wy) => (bollard && wy > yd + 0.05 ? "#4f463c" : pileC(wy)),
          });
          if (bollard) {
            b.cyl(px, top - 0.02, z, r * 0.9, 0.06, { c: "#3a332c", m: M.wood, seg: 8 });
            b.addGeo(new T.TorusGeometry(r + 0.025, 0.035, 5, 10), { x: px, y: yd + 0.3, z, rx: Math.PI / 2, c: "rope", m: M.rope, ao: 0 });
            b.addGeo(new T.TorusGeometry(r + 0.025, 0.035, 5, 10), { x: px, y: yd + 0.38, z, rx: Math.PI / 2 + 0.15, c: "rope", m: M.rope, ao: 0 });
          }
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
      const PAL_DECK = ["#958670", "#8a7c67", "#9e8f78", "#7f735f", "#a59780", "#8f8068"];
      const step = 0.29;
      const plank = plankGeo(0.26, 0.07, 0.022);
      for (let z = HW - 0.3; z < zEnd; z += step) {
        const yd = deckY(z);
        const slope = Math.atan2(deckY(z + 0.5) - deckY(z - 0.5), 1);
        const fresh = r2() < 0.06;
        const c = new T.Color(fresh ? "#b39a78" : pick(PAL_DECK)).offsetHSL(0, 0, (r2() - 0.5) * 0.04);
        const w = PH * 2 + 0.08 + (r2() - 0.5) * 0.14;
        b.addGeo(plank, {
          x: PX + (r2() - 0.5) * 0.08,
          y: yd,
          z: Math.min(z, zEnd - 0.13),
          sx: w,
          rx: -slope,
          ry: (r2() - 0.5) * 0.012,
          c,
          m: M.wood,
          ao: 0.12,
          jit: 0.02,
        });
      }
      // a facing board along each side of the deck
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
      // a ladder down the end into the water
      const lx = PX - 0.7;
      const lz = zEnd + 0.06;
      for (const s of [-1, 1]) b.beam([lx + s * 0.24, DECK + 0.5, lz], [lx + s * 0.24, -1.2, lz + 0.05], 0.04, { c: "#4a4036", colors: (wx, wy) => pileC(wy) });
      for (let y = DECK - 0.35; y > -1.0; y -= 0.34)
        b.beam([lx - 0.24, y, lz + 0.01], [lx + 0.24, y, lz + 0.01], 0.025, { round: true, seg: 5, c: "#5a4e40", colors: (wx, wy) => pileC(wy) });
      // the lantern at the end
      lamp(PX - PH + 0.35, DECK, zEnd - 0.45, Math.PI / 2 + 0.2, false);
      // stores on the deck by the root and at the end, coils of rope by the bollards
      b.crate(PX + PH - 0.45, DECK, PIER.z0 + 1.6, 0.7, { ry: 0.12 });
      b.crate(PX + PH - 0.45, DECK, PIER.z0 + 2.35, 0.62, { ry: -0.2 });
      b.crate(PX + PH - 0.42, DECK + 0.7, PIER.z0 + 1.7, 0.52, { ry: 0.35 });
      b.barrel(PX - PH + 0.42, DECK, PIER.z0 + 1.2, { h: 0.86, r: 0.31 });
      b.barrel(PX - PH + 0.4, DECK, zEnd - 1.7, { h: 0.8, r: 0.3, ry: 0.4 });
      b.ropeCoil(PX + PH - 0.55, DECK, PIER.z0 + 9.1, 0.3);
      b.ropeCoil(PX - PH + 0.55, DECK, PIER.z0 + 23.2, 0.28);
      b.ropeCoil(PX + PH - 0.55, DECK, PIER.z0 + 37.5, 0.3);
      b.ropeCoil(PX - PH + 0.55, DECK, zEnd - 6.6, 0.26);
      b.bucket(PX - PH + 0.95, DECK, zEnd - 1.15);
    });

    // ================================================================ the beach
    // A clinker boat, its bow to local +x, its keel's middle at (x, y, z): strakes of oiled wood (or tarred) and a
    // painted top strake, thwarts, stems, oars; upside down when `over`, propped on two logs.
    const boat = (x, z, ry, over, hull, band) => {
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
      boat(-8.6, 22.9, -Math.PI / 2 + 0.32, false, "#8a6a4a", "#3f6f86");
      boat(-12.0, 21.2, -Math.PI / 2 - 0.42, true, "#4b3d32", "#a3482f");
      // a pair of oars and a bucket by the upturned one
      b.beam([-10.3, H(-10.3, 20.2) + 0.05, 20.2], [-10.0, H(-10, 22.6) + 0.05, 22.6], 0.03, { round: true, seg: 6, c: "woodLight", m: M.wood });
      b.bucket(-9.9, H(-9.9, 19.7) - 0.03, 19.7);
    });

    // the nets drying: three grey poles, a rail along their tops, nets hung over it to the sand
    const netMat = KIT.makeMaterials(KIT.buildUniforms()).cloth;
    sec("nets", () => {
      const zN = 17.6;
      const poles = [-11.0, -8.3, -5.6];
      const rail = 2.25;
      for (const x of poles) {
        const g = H(x, zN);
        b.cyl(x, g - 0.3, zN, 0.075, rail + 0.55, { r2: 0.06, c: "#7a7066", m: M.wood, seg: 7 });
        b.box(x, g - 0.06, zN, 0.42, 0.14, 0.42, { c: stone("stoneCool", 0.2), m: M.stone, bevel: 0.05 });
      }
      const yR = (x) => H(x, zN) + rail;
      b.beam([poles[0] - 0.3, yR(poles[0]), zN], [poles[2] + 0.3, yR(poles[2]), zN], 0.045, { round: true, seg: 6, c: "#857a6c", m: M.wood });
      // the net: hung over the rail, longer on the sea side, in folds, its hem in a scallop between the poles
      const x0 = poles[0] + 0.15;
      const x1 = poles[2] - 0.15;
      const NU = 26;
      const NV = 8;
      const pos = [];
      const uv = [];
      const idx = [];
      for (const side of [1, -1]) {
        const drop = side > 0 ? 1.85 : 1.35;
        const base = pos.length / 3;
        for (let j = 0; j <= NV; j++)
          for (let i = 0; i <= NU; i++) {
            const u = i / NU;
            const v = j / NV;
            const x = lerp(x0, x1, u);
            const fold = Math.sin(u * 31 + side) * 0.07 * v + Math.sin(u * 11.0) * 0.05 * v;
            const sag = Math.sin(((x - poles[0]) / (poles[1] - poles[0])) * Math.PI) * 0.06;
            const hem = Math.abs(Math.sin(((x - x0) / (x1 - x0)) * Math.PI * 2)) * 0.3;
            const yTop = yR(x) + 0.03 - sag;
            const y = yTop - v * (drop - hem * v);
            const zz = zN + side * (0.05 + v * 0.18 + fold) * (1 - 0.3 * v);
            pos.push(x, Math.max(y, H(x, zz) + 0.04), zz);
            uv.push((u * (x1 - x0)) / 0.5, (v * drop) / 0.5);
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
      b.addGeo(g, { c: "#8a8371", m: M.rope, bucket: "netTri", ao: 0.1, jit: 0, vary: 0.12 });
      // cork floats along the hem
      for (let i = 0; i < 9; i++) {
        const x = lerp(x0 + 0.2, x1 - 0.2, i / 8);
        const hem = Math.abs(Math.sin(((x - x0) / (x1 - x0)) * Math.PI * 2)) * 0.3;
        const y = Math.max(yR(x) - (1.85 - hem), H(x, zN + 0.2) + 0.08);
        b.cyl(x, y - 0.05, zN + 0.25, 0.06, 0.11, { c: i === 4 ? "ember" : "#cdbb94", m: M.paint, seg: 7, rz: Math.PI / 2, ao: 0.1 });
      }
    });

    // the stockfish rack on the sand between the steps and the boardwalk, running east and west so the fish face the
    // town: A-frames of grey poles, rails, split fish hung in pairs over them, tails up
    sec("fishrack", () => {
      const rz = 18.4;
      const x0 = 4.15;
      const x1 = 7.75;
      const bays = 2;
      const RH = 2.6;
      const RS = 0.75;
      const rails = [1.1, 1.68, 2.22];
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
      // a fish: a cupped sheet hanging from its tail at the rail, narrow at the tail, silver skin out or pale flesh out
      const fishGeo = new T.PlaneGeometry(0.2, 0.5, 1, 3);
      {
        const p = fishGeo.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const fx = p.getX(i);
          const t = (0.25 - p.getY(i)) / 0.5;
          const w = t < 0.15 ? 0.35 : 1 - 0.25 * t;
          p.setXYZ(i, fx * w, -t * 0.5, -0.03 * (fx / 0.1) * (fx / 0.1));
        }
        fishGeo.computeVertexNormals();
      }
      for (const yr of rails)
        for (let bay = 0; bay < bays; bay++) {
          const xa = frames[bay] + 0.22;
          const xb = frames[bay + 1] - 0.22;
          const n = 7;
          for (let k = 0; k < n; k++) {
            if (yr === rails[2] && bay === 1 && k > 3) continue;
            const x = lerp(xa, xb, (k + 0.5) / n) + (r2() - 0.5) * 0.03;
            const y = lerp(g(x0), g(x1), (x - x0) / (x1 - x0)) + yr + 0.03;
            for (const s of [-1, 1]) {
              const flesh = r2() < 0.4;
              b.addGeo(fishGeo, {
                x,
                y,
                z: rz + s * 0.045,
                ry: s > 0 ? 0 : Math.PI,
                rx: -0.08,
                sy: 0.85 + r2() * 0.3,
                c: flesh ? pick(["#c9b58f", "#bfa985"]) : pick(["#8d8b83", "#99948a", "#83817a", "#a19b8e"]),
                m: M.scale,
                bucket: "cloth",
                ao: 0.25,
                jit: 0.03,
                vary: 0.06,
              });
            }
          }
        }
    });

    // the net shed at the back of the beach: red-brown boards on a stone footing, a turf roof, its door to the sea
    sec("shed", () => {
      const sx = -11.9;
      const sz = 15.0;
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
      // the door: a dark opening, a plank door standing half open, white trim
      b.box(0, floor, D / 2 - 0.02, 0.86, 1.55, 0.05, { c: "#231f1c", m: M.dark, bevel: 0, ao: 0 });
      b.box(-0.5, floor, D / 2 + 0.3, 0.06, 1.5, 0.8, { ry: 0.5, c: "#6b5846", m: M.wood, bevel: 0.015 });
      for (const s of [-1, 1]) b.box(s * 0.48, floor, D / 2 + 0.04, 0.08, 1.62, 0.06, { c: "#e6e0d3", m: M.paint, bevel: 0.01 });
      b.box(0, floor + 1.6, D / 2 + 0.04, 1.04, 0.08, 0.06, { c: "#e6e0d3", m: M.paint, bevel: 0.01 });
      // the roof: birch-bark boards, then a thick mat of turf with grass and a few flowers on it
      const pitch = Math.atan2(1.05, D / 2);
      const run = Math.hypot(1.05, D / 2) + 0.35;
      for (const s of [-1, 1]) {
        const cz = s * (D / 4 + 0.06);
        const cy = floor + wallH + 0.55;
        b.box(0, cy - 0.05, cz, W + 0.5, 0.06, run, { rx: s * pitch, c: "#4b3f34", m: M.wood, bevel: 0.01 });
        b.box(0, cy + 0.0, cz, W + 0.4, 0.2, run - 0.08, { rx: s * pitch, c: "#6f8a4c", m: M.grass, bevel: 0.08, ao: 0.1 });
        for (let i = 0; i < 16; i++) {
          const u = (r2() - 0.5) * (W + 0.2);
          const v = (r2() - 0.5) * (run - 0.3);
          // a point on the turf's top, tipped with the roof
          const yy = cy + 0.19 * Math.cos(pitch) - v * Math.sin(s * pitch);
          const zz = cz + 0.19 * Math.sin(s * pitch) + v * Math.cos(pitch);
          b.grass(u, yy - 0.03, zz, 0.3 + r2() * 0.25, { c: pick(["#7d9150", "#879a58", "#6f8549"]) });
        }
      }
      b.flowers(0.6, floor + wallH + 0.68, 0.62, 0.2, { c: "#f3f1ec", n: 5 });
      // the turf held at the eaves by a log
      for (const s of [-1, 1])
        b.beam([-W / 2 - 0.25, floor + wallH + 0.03, s * (D / 2 + 0.3)], [W / 2 + 0.25, floor + wallH + 0.03, s * (D / 2 + 0.3)], 0.06, {
          round: true,
          seg: 6,
          c: "#5b4d3f",
          m: M.wood,
        });
      b.pop();
      // stores at its side: a barrel, a crate, a basket of floats, lobster pots
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
      b.crate(12.6, at(12.6, 21.4), 21.4, 0.7, { ry: 0.2 });
      b.crate(12.9, at(12.9, 22.3), 22.3, 0.6, { ry: -0.35 });
      b.barrel(12.5, at(12.5, 20.3), 20.3, { h: 0.86, r: 0.31 });
      b.barrel(12.7, at(12.7, 23.3), 23.3, { lie: true, ry: 0.2 });
      b.ropeCoil(7.2, at(7.2, 23.2), 23.2, 0.3);
    });

    // grass at the foot of every wall and post, so nothing stands on the land as if set down on it
    sec("grass", () => {
      const tuft = (x, z, s) => b.grass(x, H(x, z) + 0.02, z, s, { c: pick(["#7f9a4e", "#86a052", "#748f47", "#8ea35a"]) });
      // round the kerb, outside it
      for (let i = 0; i < 150; i++) {
        const side = Math.floor(r2() * 3);
        const t = (r2() * 2 - 1) * (HW + 0.4);
        const o = HW + 0.12 + r2() * 0.45;
        const [x, z] = side === 0 ? [t, -o] : side === 1 ? [-o, t] : [o, t];
        if (side === 0 && OPENINGS.north.some(([a, c]) => t > a - 0.2 && t < c + 0.2)) continue;
        if (side > 0 && OPENINGS.west.some(([a, c]) => t > a - 0.2 && t < c + 0.2)) continue;
        tuft(x, z, 0.3 + r2() * 0.3);
      }
      // along the south wall's foot and the steps' cheeks
      for (let i = 0; i < 90; i++) {
        const x = (r2() * 2 - 1) * (HW + 0.3);
        const z = HW + 0.15 + r2() * 0.9;
        if (Math.abs(x) < STEP_X + CHEEK + 0.05 && z < treads[treads.length - 1].z1) continue;
        if (Math.abs(x - PX) < PH + 0.1) continue;
        tuft(x, z, 0.3 + r2() * 0.35);
      }
      for (const t of treads)
        for (const sd of [-1, 1])
          for (let i = 0; i < 3; i++) {
            const z = lerp(t.z0, t.z1, r2());
            tuft(sd * (STEP_X + CHEEK + 0.1 + r2() * 0.4), z, 0.3 + r2() * 0.3);
          }
      // round the boardwalk's posts and the shed
      for (let i = 0; i < 26; i++) {
        const z = lerp(HW + 0.8, 18.5, r2());
        tuft(PX + (r2() < 0.5 ? -1 : 1) * (PH + 0.1 + r2() * 0.5), z, 0.3 + r2() * 0.3);
      }
      for (let i = 0; i < 18; i++) tuft(-11.9 + (r2() - 0.5) * 3.8, 13.4 + r2() * 0.6, 0.3 + r2() * 0.3);
      // in the plaza's corners where a stone has gone to grass
      for (const [x, z] of TUFTS)
        b.grass(x + (r2() - 0.5) * 0.2, Y0 + 0.08, z + (r2() - 0.5) * 0.2, 0.22 + r2() * 0.18, { c: pick(["#7f9a4e", "#86a052", "#748f47"]) });
    });

    const U2 = KIT.buildUniforms();
    const mats = KIT.makeMaterials(U2);
    // the nets: the kit's cloth with the mesh cut out of it
    netMat.map = netTexture();
    netMat.alphaTest = 0.5;
    netMat.needsUpdate = true;
    mats.netTri = netMat;
    made = b.finish(mats, { ghost: false, cull: true });
    made.mats = mats;
    made.tris = tris;
    made.secMs = secMs;
    made.group.traverse((o) => {
      if (o.isMesh && o.material === netMat)
        o.customDepthMaterial = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map: netMat.map, alphaTest: 0.5 });
    });
  } finally {
    KIT.dropGeoCache();
    KIT.boxDetail = was;
  }
  const group = made.group;
  group.name = "harbour";
  group.add(flag);
  group.userData.ms = Math.round(performance.now() - t0);
  group.userData.tris = made.tris;
  group.userData.secMs = made.secMs;

  const plinthR = TIERS.map((t) => t[0]);
  const lastTread = treads[treads.length - 1];
  return {
    group,
    // The top of what the harbour adds to stand on at (x, z), or null.
    height(x, z) {
      // the boardwalk and the pier
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
    },
  };
}
