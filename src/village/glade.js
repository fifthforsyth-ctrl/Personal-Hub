// The village's stage: how the coast is drawn, in the spirit of Tiny Glade.
// Warm sun, soft blue shade and sky, haze over the distance, and a tilt-shift
// lens that keeps a band of the town sharp and lets the sea in front and the
// hills behind melt, so the whole coast reads as a model on a table.
//
// Everything that never moves (the land, the builds, the trees, the people)
// is drawn once into a picture with its depth (the still layer, layer 0) and
// drawn again only when the view or the village changes. Each frame starts
// from that picture, then draws what moves over it (the sea and rivers, the
// waterfalls, birds, horses, boats: the moving layer, layer 1), then the lens
// and the grade. So the sea can ripple and the gulls circle at the cost of
// a few cheap passes, not the whole town.
//
//   const st = new Glade(canvas, gl, { float, shadowSize, fov })
//   st.scene, st.camera, st.renderer       (st.moving(obj) puts obj in the moving layer)
//   st.setSize(w, h)                        the drawing's size in pixels
//   st.fitShadow(centre, radius)            the sun's shadow over that much of the world
//   st.still = true                         the still layer is drawn again on the next frame
//   st.lens                                 the tilt-shift: { focus, range, ramp, blur, screen, mid } (see LENS)
//   st.render(t)                            one frame, t in seconds
//   st.shared                               uniforms the moving layer's materials read (the still picture, its depth...)
//
// The kit's materials (public/kit/kit-core.js) light everything; the look
// they take is GLADE below. Their alpha carries the kit's flags: today's
// steps (6 and up) are painted the Hub's orange here, as the pen pass did.

import * as THREE from "three";

// Tiny Glade's light: a warm sun from behind the left shoulder, a clear blue
// sky filling the shade, a haze of the same blue over the distance.
export const GLADE = {
  label: "Glade",
  sunDir: [-0.58, 0.6, 0.55],
  sun: "#fff0d8",
  sunI: 2.05,
  sky: "#a7c3e4",
  skyI: 0.74,
  gnd: "#a39c74",
  gndI: 0.3,
  rim: "#ffe6c0",
  rimI: 0.32,
  fog: "#cfdde6",
  fogNear: 600,
  fogFar: 3600,
  mist: 0,
  cloud: [0, 0, 1, 0],
  torch: 0,
  window: 0,
  shadeLift: 0.55,
};

// The sky: the same blue the haze takes at the horizon, deepening overhead, a warm glow round the sun, soft clouds low down.
const SKY = { top: "#6f9fd8", mid: "#a9c8e8", horizon: "#dfe9ee", glow: "#fff2dc" };

// The lens. focus: the distance kept sharpest; range: how far either side
// stays sharp (as a fraction of focus); ramp: how far beyond that it takes to
// blur fully (a fraction of focus); blur: the most blur, in pixels of a
// picture 1000 high; screen: how much the top and bottom of the picture
// blur whatever their depth (a tilt-shift lens' band); mid: where that band
// sits, 0 the bottom of the picture, 1 the top.
export const LENS = { focus: 300, range: 0.12, ramp: 0.45, blur: 9, screen: 0.55, mid: 0.5, band: 0.2 };

const QUAD_VS = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const pass = (fs, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, ...extra });
const linear = (hex) => new THREE.Color(hex).convertSRGBToLinear();
const v3 = (c) => new THREE.Vector3(c.r, c.g, c.b);

const LIN = "float lin(float d, vec2 cam) { float z = d * 2.0 - 1.0; return 2.0 * cam.x * cam.y / (cam.y + cam.x - z * (cam.y - cam.x)); }";

// Back to the still picture: its colour, and its depth so what moves is hidden behind what stands.
const RESTORE_FS = ["uniform sampler2D tColor; uniform sampler2D tDepth; varying vec2 vUv;", "void main() { gl_FragColor = texture2D(tColor, vUv); gl_FragDepthEXT = texture2D(tDepth, vUv).r; }"].join("\n");

// Half size: the picture and how blurred each point wants to be (alpha, 0..1).
const COC_FS = [
  "uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uCam; uniform vec4 uLens; uniform vec4 uBand; uniform vec2 uTexel; varying vec2 vUv;",
  LIN,
  "float coc(vec2 uv) {",
  "  float d = lin(texture2D(tDepth, uv).r, uCam);",
  "  float k = smoothstep(uLens.x * uLens.y, uLens.x * (uLens.y + uLens.z), abs(d - uLens.x));",
  // the band across the picture a tilted lens keeps sharp: above and below it everything goes soft
  "  float b = smoothstep(uBand.z, uBand.z + uBand.w, abs(uv.y - uBand.y));",
  "  return clamp(max(k, b * uBand.x), 0.0, 1.0);",
  "}",
  "void main() {",
  // four texels down to one, each weighted so a sharp thing doesn't smear into the blur round it
  "  vec3 c = vec3(0.0); float w = 0.0, m = 0.0;",
  "  for (int i = 0; i < 4; i++) { vec2 o = (vec2(i == 1 || i == 3 ? 0.5 : -0.5, i >= 2 ? 0.5 : -0.5)) * uTexel; float k = coc(vUv + o); vec3 s = texture2D(tColor, vUv + o).rgb; float ww = 0.25 + k; c += s * ww; w += ww; m = max(m, k); }",
  "  gl_FragColor = vec4(c / w, m);",
  "}",
].join("\n");

// The blur: a disc of samples, each counted only where its own blur reaches this far (a gather that acts like a scatter).
const N_TAPS = 28;
const BLUR_FS = [
  "uniform sampler2D tHalf; uniform vec2 uTexel; uniform float uMax; varying vec2 vUv;",
  "void main() {",
  "  vec4 c0 = texture2D(tHalf, vUv);",
  "  float r0 = c0.a * uMax;",
  "  vec3 acc = c0.rgb; float wsum = 1.0;",
  "  if (r0 > 0.4) {",
  `    for (int i = 1; i < ${N_TAPS}; i++) {`,
  `      float f = float(i) / float(${N_TAPS - 1}); float ang = float(i) * 2.39996323; float rad = sqrt(f) * uMax;`,
  "      vec2 o = vec2(cos(ang), sin(ang)) * rad;",
  "      vec4 s = texture2D(tHalf, vUv + o * uTexel);",
  "      float rs = s.a * uMax;",
  // a sample counts if its blur reaches here, and only as far out as this point's own blur
  "      float w = smoothstep(rad - 1.0, rad + 0.5, rs) * smoothstep(rad - 1.0, rad + 0.5, max(r0, rs * 0.6));",
  "      acc += s.rgb * w; wsum += w;",
  "    }",
  "  }",
  "  gl_FragColor = vec4(acc / wsum, c0.a);",
  "}",
].join("\n");

// The finished picture: sharp and blurred mixed by depth, today's steps in the Hub's orange, the pencil of what is
// still to come, then the grade: a soft filmic curve, a little more colour, warm light and cool shade, a vignette.
const FINAL_FS = [
  "uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tBlur; uniform sampler2D tGhost; uniform vec2 uCam; uniform vec4 uLens; uniform vec4 uBand; uniform float uMax;",
  "uniform vec2 uRes; uniform vec2 uTexel; uniform float uExposure; uniform float uSat; uniform float uContrast; uniform vec3 uWarm; uniform vec3 uCool; uniform float uVignette;",
  "uniform vec3 uToday; uniform float uGhostOn; uniform vec3 uGraphite; uniform float uTime; varying vec2 vUv;",
  LIN,
  "float gd(vec2 uv) { return lin(texture2D(tGhost, uv).r, uCam); }",
  "float hsh(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }",
  // a gentle filmic shoulder that keeps colours clean (no hard ACES hue shifts)
  "vec3 film(vec3 x) { x = max(x, vec3(0.0)); vec3 a = x * (1.0 + x / 9.0) / (1.0 + x); return a; }",
  "vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }",
  "void main() {",
  "  vec4 t0 = texture2D(tColor, vUv);",
  "  float dRaw = texture2D(tDepth, vUv).r;",
  "  float d = lin(dRaw, uCam);",
  "  float k = smoothstep(uLens.x * uLens.y, uLens.x * (uLens.y + uLens.z), abs(d - uLens.x));",
  "  float b = smoothstep(uBand.z, uBand.z + uBand.w, abs(vUv.y - uBand.y));",
  "  float coc = clamp(max(k, b * uBand.x), 0.0, 1.0);",
  "  vec4 bl = texture2D(tBlur, vUv);",
  // where the blur round a sharp edge is bigger than this point's own (the soft background behind a sharp roof) it shows too
  "  float mixK = smoothstep(0.6, 2.2, max(coc, bl.a * 0.85) * uMax);",
  "  vec3 c = mix(t0.rgb, bl.rgb, mixK);",
  // today's steps: the Hub's own orange, shaded by the light they stand in
  "  float a = t0.a;",
  "  float today = step(5.5, a) * (1.0 - step(7.5, a)) * (1.0 - mixK);",
  "  vec3 g = film(c * uExposure);",
  "  float l = dot(g, vec3(0.2126, 0.7152, 0.0722));",
  "  g = mix(vec3(l), g, uSat);",
  "  g = mix(g * uCool, g, smoothstep(0.0, 0.45, l));",
  "  g = mix(g, g * uWarm, smoothstep(0.45, 1.0, l));",
  "  g = 0.18 * pow(max(g, vec3(1e-5)) / 0.18, vec3(uContrast));",
  "  vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);",
  "  g *= 1.0 - uVignette * smoothstep(0.45, 1.15, length(q));",
  "  vec3 s = toSRGB(clamp(g, 0.0, 1.0));",
  "  if (today > 0.5) { float pv = clamp(a - 6.0, 0.0, 1.0); s = mix(s, uToday * mix(0.72, 1.0, smoothstep(0.15, 0.75, pv)), 0.92); }",
  // what is still to come, in pencil, where it stands in front of what is built
  "  if (uGhostOn > 0.5) {",
  "    float g0 = gd(vUv), gs = 0.0;",
  "    for (int i = 0; i < 8; i++) { float an = float(i) * 0.78539816 + 0.3; gs = max(gs, (gd(vUv + vec2(cos(an), sin(an)) * 1.25 * uTexel) - g0) / g0); }",
  "    vec2 e2 = 1.5 * uTexel; float gi = 1.0 / g0;",
  "    float glx = 1.0 / gd(vUv + vec2(e2.x, 0.0)) + 1.0 / gd(vUv - vec2(e2.x, 0.0)) - 2.0 * gi, gly = 1.0 / gd(vUv + vec2(0.0, e2.y)) + 1.0 / gd(vUv - vec2(0.0, e2.y)) - 2.0 * gi;",
  "    float gc = smoothstep(0.0018, 0.0054, (abs(glx) + abs(gly)) / gi) * 0.55;",
  "    float front = 1.0 - smoothstep(0.0, 0.05, g0 - d * 1.001);",
  "    float pl = max(smoothstep(0.006, 0.024, gs), gc) * front * (0.6 + 0.4 * hsh(floor(gl_FragCoord.xy / 3.0))) * (1.0 - mixK * 0.8);",
  "    s = mix(s, mix(s, vec3(1.0), 0.35), front * 0.5 * (1.0 - mixK));",
  "    s = mix(s, uGraphite, pl * 0.7);",
  "  }",
  // a whisper of noise so the sky's gradients never band
  "  s += (hsh(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;",
  "  gl_FragColor = vec4(s, 1.0);",
  "}",
].join("\n");

// The sky dome: blue overhead to a pale haze at the horizon, a glow round the sun, soft clouds low over the sea.
const SKY_VS = "varying vec3 vDir; void main() { vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }";
const SKY_FS = [
  "uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uSunDir; uniform vec3 uBelow; varying vec3 vDir;",
  "float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
  "float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }",
  "float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += vn(p) * a; p = p * 2.03 + 7.1; a *= 0.5; } return s; }",
  "void main() {",
  "  vec3 d = normalize(vDir);",
  "  float y = d.y;",
  "  vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.22, y));",
  "  c = mix(c, uTop, smoothstep(0.2, 0.85, y));",
  "  float sd = max(dot(d, normalize(uSunDir)), 0.0);",
  "  c += uGlow * (pow(sd, 6.0) * 0.25 + pow(sd, 60.0) * 0.4);",
  // clouds: soft heaps along the horizon, lit warm on the sun's side
  "  if (y > 0.0) {",
  "    vec2 p = d.xz / (y + 0.12) * 1.6;",
  "    float n = fbm(p * 0.9 + vec2(3.0, 1.0));",
  "    float cl = smoothstep(0.52, 0.78, n) * smoothstep(0.0, 0.08, y) * (1.0 - smoothstep(0.25, 0.6, y));",
  "    vec3 cc = mix(uHorizon * 1.04, vec3(1.05, 1.02, 0.97), 0.5 + 0.5 * sd);",
  "    c = mix(c, cc, cl * 0.75);",
  "  }",
  "  c = mix(c, uBelow, smoothstep(0.0, -0.08, y));",
  "  gl_FragColor = vec4(c, 1.0);",
  "}",
].join("\n");

// A tiling noise picture the ground and the water read at several scales (each channel its own: R broad, G finer,
// B broadest, A finest), smooth and 0..1, so colour can vary over the land without a seam anywhere.
let NOISE = null;
export function noiseTexture() {
  if (NOISE) return NOISE;
  const N = 256;
  let seed = 9071;
  const rnd = () => {
    seed ^= seed << 13;
    seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed / 4294967296;
  };
  const layer = (cells, oct) => {
    const out = new Float32Array(N * N);
    let amp = 1;
    for (let o = 0; o < oct; o++, amp *= 0.5) {
      const C = cells << o;
      const g = new Float32Array(C * C).map(rnd);
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const fx = (x / N) * C;
          const fy = (y / N) * C;
          const x0 = Math.floor(fx);
          const y0 = Math.floor(fy);
          let tx = fx - x0;
          let ty = fy - y0;
          tx = tx * tx * (3 - 2 * tx);
          ty = ty * ty * (3 - 2 * ty);
          const at = (i, j) => g[(j % C) * C + (i % C)];
          const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
          const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
          out[y * N + x] += (a + (b - a) * ty) * amp;
        }
    }
    // stretched to fill 0..1
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of out) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    return out.map((v) => (v - lo) / (hi - lo));
  };
  const L = [layer(4, 4), layer(8, 3), layer(2, 4), layer(16, 2)];
  const data = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) for (let c = 0; c < 4; c++) data[i * 4 + c] = Math.round(L[c][i] * 255);
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  NOISE = t;
  return t;
}

export class Glade {
  constructor(canvas, gl, opts = {}) {
    const KIT = window.KIT;
    this.KIT = KIT;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: false, alpha: false, preserveDrawingBuffer: false }));
    r.setPixelRatio(1);
    r.autoClear = false;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.shadowMap.autoUpdate = false;
    r.outputEncoding = THREE.LinearEncoding;
    r.toneMapping = THREE.NoToneMapping;
    this.ft = opts.float === false ? THREE.UnsignedByteType : THREE.HalfFloatType;
    this.w = 1;
    this.h = 1;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(opts.fov || 30, 1, 1, 8000);
    this.camera.layers.set(0);
    const sun = (this.sun = new THREE.DirectionalLight(0xffffff, 1));
    sun.castShadow = true;
    const ss = opts.shadowSize || 2048;
    sun.shadow.mapSize.set(ss, ss);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.05;
    sun.shadow.radius = 3;
    sun.layers.enableAll();
    this.scene.add(sun, sun.target);
    this.lens = { ...LENS };
    this.look();

    // the sky, in the still layer
    const skyU = (this.skyU = {
      uTop: { value: v3(linear(SKY.top)) },
      uMid: { value: v3(linear(SKY.mid)) },
      uHorizon: { value: v3(linear(SKY.horizon)) },
      uGlow: { value: v3(linear(SKY.glow)) },
      uBelow: { value: v3(linear(SKY.horizon)) },
      uSunDir: KIT.G.uSunDir,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: skyU, side: THREE.BackSide, depthWrite: false }));
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    sky.onBeforeRender = (rr, sc, cam) => {
      sky.position.copy(cam.position);
      sky.scale.setScalar(cam.far * 0.9);
      sky.updateMatrixWorld();
    };
    this.sky = sky;
    this.scene.add(sky);

    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    const texel = new THREE.Vector2(1, 1);
    this.uCam = new THREE.Vector2(1, 8000);
    this.uLens = new THREE.Vector4();
    this.uBand = new THREE.Vector4();
    this.mRestore = pass(RESTORE_FS, { tColor: { value: null }, tDepth: { value: null } }, { depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth, extensions: { fragDepth: true } });
    this.mCoc = pass(COC_FS, { tColor: { value: null }, tDepth: { value: null }, uCam: { value: this.uCam }, uLens: { value: this.uLens }, uBand: { value: this.uBand }, uTexel: { value: new THREE.Vector2() } });
    this.mBlur = pass(BLUR_FS, { tHalf: { value: null }, uTexel: { value: new THREE.Vector2() }, uMax: { value: 8 } });
    this.mFinal = pass(FINAL_FS, {
      tColor: { value: null },
      tDepth: { value: null },
      tBlur: { value: null },
      tGhost: { value: null },
      uCam: { value: this.uCam },
      uLens: { value: this.uLens },
      uBand: { value: this.uBand },
      uMax: { value: 8 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTexel: { value: texel },
      uExposure: { value: 1.0 },
      uSat: { value: 1.1 },
      uContrast: { value: 1.04 },
      uWarm: { value: new THREE.Vector3(1.04, 1.0, 0.94) },
      uCool: { value: new THREE.Vector3(0.94, 0.98, 1.06) },
      uVignette: { value: 0.16 },
      uToday: { value: new THREE.Vector3(...new THREE.Color("#f26a1b").toArray()) },
      uGhostOn: { value: 0 },
      uGraphite: { value: new THREE.Vector3(0.36, 0.36, 0.35) },
      uTime: { value: 0 },
    });

    // what the moving layer's materials read: the still picture and its depth, the camera's range, the size, the time
    this.shared = {
      tStill: { value: null },
      tStillDepth: { value: null },
      uCam: { value: this.uCam },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
    };
    this.still = true;
    this.shadowDirty = true;
    this.targets = new Map();
    this.setSize(opts.width || 1, opts.height || 1);
  }

  look() {
    const KIT = this.KIT;
    KIT.LOOKS.glade = GLADE;
    KIT.applyLook("glade");
    KIT.G.uPaint.value = 0.55;
  }

  // Puts an object and everything in it in the moving layer: drawn every frame over the still picture, never in the
  // sun's shadow map (it casts no shadow; it still stands in the shadows of what is still).
  moving(obj) {
    obj.traverse((o) => o.layers.set(1));
    return obj;
  }

  makeTargets(w, h) {
    const ft = this.ft;
    const t = {};
    const rt = (W, H, depth) => {
      const r = new THREE.WebGLRenderTarget(W, H, { type: ft, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: !!depth, stencilBuffer: false });
      if (depth) {
        r.depthTexture = new THREE.DepthTexture(W, H);
        r.depthTexture.type = THREE.UnsignedIntType;
      }
      return r;
    };
    t.still = rt(w, h, true);
    t.frame = rt(w, h, true);
    t.ghost = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
    t.ghost.depthTexture = new THREE.DepthTexture(w, h);
    t.ghost.depthTexture.type = THREE.UnsignedIntType;
    const hw = Math.max(1, Math.round(w / 2));
    const hh = Math.max(1, Math.round(h / 2));
    t.half = rt(hw, hh, false);
    t.blur = rt(hw, hh, false);
    // the flags in the still picture's alpha are read at texel centres
    t.still.texture.minFilter = t.still.texture.magFilter = THREE.NearestFilter;
    t.frame.texture.minFilter = t.frame.texture.magFilter = THREE.NearestFilter;
    return t;
  }

  disposeTargets(t) {
    for (const k of Object.keys(t)) {
      t[k].depthTexture?.dispose();
      t[k].dispose();
    }
  }

  // The drawing's size in pixels. The targets for the last two sizes are kept (a finger on the glass draws smaller).
  setSize(w, h) {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    if (w === this.w && h === this.h && this.t) return;
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    const key = `${w}x${h}`;
    let t = this.targets.get(key);
    if (!t) {
      t = this.makeTargets(w, h);
      this.targets.set(key, t);
      while (this.targets.size > 2) {
        const [k0, old] = this.targets.entries().next().value;
        this.disposeTargets(old);
        this.targets.delete(k0);
      }
    } else {
      // most recently used last
      this.targets.delete(key);
      this.targets.set(key, t);
    }
    this.t = t;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.mFinal.uniforms.uRes.value.set(w, h);
    this.mFinal.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.mCoc.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.mBlur.uniforms.uTexel.value.set(1 / t.half.width, 1 / t.half.height);
    this.shared.uRes.value.set(w, h);
    this.shared.tStill.value = t.still.texture;
    this.shared.tStillDepth.value = t.still.depthTexture;
    this.still = true;
  }

  // Points the sun's shadow camera at a sphere so the shadow map is spent where it is seen.
  fitShadow(center, radius) {
    const d = this.KIT.G.uSunDir.value;
    this.sun.position.copy(center).addScaledVector(d, radius * 3);
    this.sun.target.position.copy(center);
    this.sun.target.updateMatrixWorld();
    const c = this.sun.shadow.camera;
    c.left = -radius;
    c.right = radius;
    c.top = radius;
    c.bottom = -radius;
    c.near = radius * 0.5;
    c.far = radius * 6;
    c.updateProjectionMatrix();
    this.shadowDirty = true;
    this.still = true;
  }

  draw(m, target) {
    this.quad.material = m;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  // One frame. The still layer is drawn again first if anything asked for it.
  render(time = 0) {
    const r = this.renderer;
    const cam = this.camera;
    const t = this.t;
    cam.updateMatrixWorld();
    this.uCam.set(cam.near, cam.far);
    this.shared.uTime.value = time;
    this.mFinal.uniforms.uTime.value = time;
    this.KIT.G.uTime.value = 1.3;
    if (this.still) {
      this.still = false;
      if (this.shadowDirty) {
        r.shadowMap.needsUpdate = true;
        this.shadowDirty = false;
      }
      cam.layers.set(0);
      r.setRenderTarget(t.still);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      r.render(this.scene, cam);
      // what is still to come, as depth only, for the pencil
      const ghosts = [];
      this.scene.traverseVisible((o) => {
        if (o.isMesh && o.userData.ghost) ghosts.push(o);
      });
      this.ghostOn = ghosts.length > 0;
      if (this.ghostOn) {
        const seen = [];
        this.scene.traverse((o) => {
          if (o.isMesh || o.isPoints || o.isLine) seen.push([o, o.visible, o.material]);
        });
        for (const [o] of seen) {
          o.visible = !!o.userData.ghost && o.visible;
          if (o.userData.ghost) o.material = o.userData.ghost;
        }
        r.setRenderTarget(t.ghost);
        r.clear(true, true, false);
        r.render(this.scene, cam);
        for (const [o, vis, mat] of seen) {
          o.visible = vis;
          o.material = mat;
        }
      }
    }
    // the frame: the still picture back, then what moves over it
    this.mRestore.uniforms.tColor.value = t.still.texture;
    this.mRestore.uniforms.tDepth.value = t.still.depthTexture;
    r.setRenderTarget(t.frame);
    this.quad.material = this.mRestore;
    r.render(this.quadScene, this.quadCam);
    cam.layers.set(1);
    r.render(this.scene, cam);
    cam.layers.set(0);
    // the lens
    const L = this.lens;
    const scale = this.h / 1000;
    this.uLens.set(L.focus, L.range, L.ramp, 0);
    this.uBand.set(L.screen, L.mid, L.band, 0.32);
    const maxHalf = Math.max(0.5, (L.blur * scale) / 2);
    this.mCoc.uniforms.tColor.value = t.frame.texture;
    this.mCoc.uniforms.tDepth.value = t.frame.depthTexture;
    this.draw(this.mCoc, t.half);
    this.mBlur.uniforms.tHalf.value = t.half.texture;
    this.mBlur.uniforms.uMax.value = maxHalf;
    this.draw(this.mBlur, t.blur);
    const f = this.mFinal.uniforms;
    f.tColor.value = t.frame.texture;
    f.tDepth.value = t.frame.depthTexture;
    f.tBlur.value = t.blur.texture;
    f.tGhost.value = t.ghost.depthTexture;
    f.uGhostOn.value = this.ghostOn ? 1 : 0;
    f.uMax.value = maxHalf * 2;
    this.draw(this.mFinal, null);
  }

  dispose() {
    for (const t of this.targets.values()) this.disposeTargets(t);
    this.targets.clear();
    for (const m of [this.mRestore, this.mCoc, this.mBlur, this.mFinal, this.sky.material]) m.dispose();
    this.sky.geometry.dispose();
    this.quad.geometry.dispose();
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
  }
}
