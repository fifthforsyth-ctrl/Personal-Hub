// Painterly village kit, part 1: utilities, painted textures, the looks, and the materials.
// three.js r128 (global THREE). Everything is procedural: no image files.
(function () {
  var T = THREE;
  var KIT = (window.KIT = window.KIT || {});
  KIT.builds = KIT.builds || {};
  KIT.defineBuild = function (kind, def) { def.kind = kind; KIT.builds[kind] = def; };

  // ------------------------------------------------------------------ utilities
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s >>> 0) / 4294967296; };
  }
  function hashStr(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  // 3D value noise in [-1, 1]
  var PERM = new Uint8Array(512);
  (function () { var r = rng(1337), p = [], i; for (i = 0; i < 256; i++) p[i] = i; for (i = 255; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = p[i]; p[i] = p[j]; p[j] = t; } for (i = 0; i < 512; i++) PERM[i] = p[i & 255]; })();
  function hv(x, y, z) { return PERM[(PERM[(PERM[x & 255] + y) & 255] + z) & 255] / 127.5 - 1; }
  function fade(t) { return t * t * (3 - 2 * t); }
  function noise3(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    var u = fade(xf), v = fade(yf), w = fade(zf);
    var a = lerp(lerp(hv(xi, yi, zi), hv(xi + 1, yi, zi), u), lerp(hv(xi, yi + 1, zi), hv(xi + 1, yi + 1, zi), u), v);
    var b = lerp(lerp(hv(xi, yi, zi + 1), hv(xi + 1, yi, zi + 1), u), lerp(hv(xi, yi + 1, zi + 1), hv(xi + 1, yi + 1, zi + 1), u), v);
    return lerp(a, b, w);
  }
  function fbm3(x, y, z, oct) { var s = 0, a = 0.5, f = 1, n = 0; for (var i = 0; i < (oct || 3); i++) { s += noise3(x * f, y * f, z * f) * a; n += a; a *= 0.5; f *= 2.03; } return s / n; }

  function col(hex) { return hex instanceof T.Color ? hex.clone() : new T.Color(hex); }
  // a colour in linear space, nudged in lightness / hue / saturation
  function tone(hex, dl, dh, ds) { var c = col(hex); if (dl || dh || ds) c.offsetHSL(dh || 0, ds || 0, dl || 0); return c.convertSRGBToLinear(); }

  KIT.util = { rng: rng, hashStr: hashStr, clamp: clamp, lerp: lerp, smooth: smooth, noise3: noise3, fbm3: fbm3, col: col, tone: tone };

  // ------------------------------------------------------------------ the palette (sRGB hex; the builder turns them linear)
  // Warm, sun-baked and hand-painted: limestone and sandstone, lime plaster, oak, terracotta, faded canvas,
  // crimson and navy heraldry, dull steel and old brass. Greens lean yellow in the light.
  KIT.PAL = {
    stone: ['#a6a198', '#b1aca2', '#9b968d', '#bbb5aa', '#a19b91', '#8f8a82', '#b4ada1', '#a8a296'],
    stoneCool: ['#a7a39a', '#b4b0a5', '#9b978e', '#bdb8ac'],
    stoneDark: ['#7f7b74', '#76726b', '#88837b'],
    sandstone: ['#cfc9be', '#c6c0b4', '#d8d2c7', '#beb7aa'],
    plaster: ['#ecebe7', '#e7e6e1', '#f0efeb', '#e3e1dc'],
    plasterWarm: ['#e7c9a1', '#e0bc90', '#ebd2ae'],
    plasterRose: ['#dfb39a', '#d9a58b', '#e5c0a8'],
    wood: ['#7d6a57', '#73614f', '#86725d', '#665645'],
    woodLight: ['#a8957c', '#9d8a72', '#b29f86'],
    woodDark: ['#33312e', '#2d2b29', '#3a3734'],
    beam: ['#222120', '#272624'],
    tile: ['#3d4146', '#44484e', '#393d42', '#4a4e54', '#35393e'],
    terracotta: ['#8e5547', '#965b4c', '#885044', '#9a614f', '#8d584a'],
    slate: ['#3d4146', '#44484e', '#393d42', '#4a4e54'],
    thatch: ['#caa35e', '#d3ae69', '#bf9853', '#c79e58'],
    canvas: ['#e9dcc0', '#efe3c9', '#e2d3b3'],
    canvasDusty: ['#cdbd9c', '#d5c6a6'],
    crimson: ['#8f2f2a', '#983630', '#842a25'],
    navy: ['#2c3e5c', '#34486a', '#26364f'],
    teal: ['#3f6f6a', '#467a74'],
    ochre: ['#c9973e', '#d4a24b'],
    steel: ['#959da4', '#8b939a', '#a2a9af'],
    iron: ['#4d4f52', '#45474a', '#57595c'],
    brass: ['#c9a24a', '#d4ae56', '#b88f3b'],
    leaf: ['#66784c', '#6f8153', '#5c6d45', '#788a5a', '#627349'],
    leafDark: ['#3f5a2c', '#4a6631', '#365026'],
    leafWarm: ['#8b9462', '#959d6a', '#818a5a'],
    pine: ['#3e5a3a', '#466443', '#365034'],
    grass: ['#66765a', '#6e7e60', '#5e6e53', '#748464'],
    tuft: ['#84926c', '#8d9a73', '#7a8964', '#96a27b'],
    dirt: ['#a99a82', '#9e8f78', '#b3a48d'],
    straw: ['#d3c7a8', '#dacfb2', '#c9bc9b'],
    rope: ['#b99c6c', '#a98c5e'],
    skin: ['#e0b48f', '#c99470', '#a8745a', '#edc6a2', '#8a5d45'],
    hair: ['#3b2a20', '#5a3d27', '#2a211d', '#8a5a33', '#b8915c', '#6b4a33'],
    white: ['#f2ede2'],
    // the Hub's own colours, for everything the town dyes or paints: ink, bone white, and the orange accent
    ink: ['#1e1d1b', '#232220', '#1a1918'],
    inkGrey: ['#3a3936', '#43413e'],
    bone: ['#f3f1ec', '#eeebe5', '#f6f4f0'],
    ember: ['#f26a1b', '#ec6418', '#f57a30'],
    dark: ['#2a2420'],
    flowers: ['#f3f1ec', '#e6e3dc', '#f6f4f0', '#d9d6cf']
  };

  // material ids (the shader reads these per vertex)
  var M = KIT.M = { stone: 0, plaster: 1, wood: 2, tile: 3, thatch: 4, cloth: 5, metal: 6, gold: 7, leaf: 8, grass: 9, dirt: 10, window: 11, dark: 12, skin: 13, hair: 14, straw: 15, rope: 16, rock: 17, soil: 18, water: 19, paint: 20, scale: 21, glow: 22, hide: 23 };
  // a pale matte hide (a white dragon's): see the painted surface below
  M.pale = 24;
  // a thin membrane (a wing's sail, lit through from behind) and a warm pale hide (a cream dragon's): see the painted
  // surface below
  M.memb = 25;
  M.hidePale = 26;

  // ------------------------------------------------------------------ painted textures
  // Brush texture, tileable. R: directional paint strokes; G: broad wet-in-wet mottling; B: bristle streaks; A: canvas weave.
  function makeCanvas(n) { var c = document.createElement('canvas'); c.width = c.height = n; return c; }
  function tileNoise(N, cells, seed, oct) {
    var r = rng(seed), out = new Float32Array(N * N), o, total = 0;
    for (o = 0; o < oct; o++) {
      var C = cells << o, g = new Float32Array(C * C), amp = Math.pow(0.55, o), x, y;
      for (var i = 0; i < C * C; i++) g[i] = r();
      for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
        var fx = x / N * C, fy = y / N * C, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fade(fx - x0), ty = fade(fy - y0);
        var a = g[(y0 % C) * C + (x0 % C)], b = g[(y0 % C) * C + ((x0 + 1) % C)], c = g[((y0 + 1) % C) * C + (x0 % C)], d = g[((y0 + 1) % C) * C + ((x0 + 1) % C)];
        out[y * N + x] += lerp(lerp(a, b, tx), lerp(c, d, tx), ty) * amp;
      }
      total += amp;
    }
    for (var k = 0; k < out.length; k++) out[k] /= total;
    return out;
  }
  function strokesLayer(N, seed, count, wMin, wMax, lMin, lMax, alpha, dirSpread) {
    var c = makeCanvas(N), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, N, N); g.lineCap = 'round';
    var base = r() * Math.PI;
    for (var i = 0; i < count; i++) {
      var x = r() * N, y = r() * N, a = base + (r() - 0.5) * dirSpread, L = lMin + r() * (lMax - lMin), w = wMin + r() * (wMax - wMin);
      var v = Math.round(255 * (0.18 + r() * 0.64)), bend = (r() - 0.5) * L * 0.35;
      g.strokeStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + alpha + ')'; g.lineWidth = w;
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
        var cx = x + ox * N, cy = y + oy * N, dx = Math.cos(a) * L / 2, dy = Math.sin(a) * L / 2;
        if (cx + L < 0 || cx - L > N || cy + L < 0 || cy - L > N) continue;
        g.beginPath(); g.moveTo(cx - dx, cy - dy); g.quadraticCurveTo(cx - dy / L * bend * 2, cy + dx / L * bend * 2, cx + dx, cy + dy); g.stroke();
      }
    }
    return g.getImageData(0, 0, N, N).data;
  }
  KIT.strokeTex = (function () {
    var N = 512, img = new ImageData(N, N), d = img.data;
    var S = strokesLayer(N, 11, 1500, 7, 18, 18, 64, 0.42, 1.1);
    var Bm = strokesLayer(N, 23, 5200, 1, 2.2, 8, 26, 0.3, 0.8);
    var Mo = tileNoise(N, 4, 37, 4), Wv = tileNoise(N, 64, 41, 2);
    for (var i = 0; i < N * N; i++) {
      var x = i % N, y = (i / N) | 0, weave = 0.5 + 0.25 * (Math.sin(x * 1.57) * Math.sin(y * 1.57)) + (Wv[i] - 0.5) * 0.5;
      d[i * 4] = S[i * 4]; d[i * 4 + 1] = clamp((Mo[i] - 0.5) * 2.2 + 0.5, 0, 1) * 255; d[i * 4 + 2] = Bm[i * 4]; d[i * 4 + 3] = clamp(weave, 0, 1) * 255;
    }
    var c = makeCanvas(N); c.getContext('2d').putImageData(img, 0, 0);
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; t.anisotropy = 4;
    t.premultiplyAlpha = false;
    return t;
  })();

  // A clump of painted leaves: grey value in rgb (the vertex colour carries the hue), alpha for the cut-out.
  function leafTex(seed, shape) {
    var N = 256, c = makeCanvas(N), g = c.getContext('2d'), r = rng(seed);
    g.clearRect(0, 0, N, N);
    var n = shape === 'needle' ? 90 : 34;
    for (var i = 0; i < n; i++) {
      var ang = r() * Math.PI * 2, rad = Math.pow(r(), 0.6) * N * 0.36, x = N / 2 + Math.cos(ang) * rad, y = N / 2 + Math.sin(ang) * rad * 0.92;
      var len = shape === 'needle' ? 18 + r() * 18 : 30 + r() * 26, wid = shape === 'needle' ? 4 + r() * 3 : len * (0.42 + r() * 0.2);
      var lit = 0.55 + 0.45 * clamp(0.5 - (y - N / 2) / N * 1.2 + (r() - 0.5) * 0.5, 0, 1), v = Math.round(255 * lit);
      g.save(); g.translate(x, y); g.rotate(ang + Math.PI / 2 + (r() - 0.5) * 0.9);
      g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      g.beginPath();
      if (shape === 'tri') { g.moveTo(0, -len / 2); g.lineTo(wid / 2, len / 2); g.lineTo(-wid / 2, len / 2); g.closePath(); }
      else { g.moveTo(0, -len / 2); g.quadraticCurveTo(wid / 2, -len * 0.1, 0, len / 2); g.quadraticCurveTo(-wid / 2, -len * 0.1, 0, -len / 2); }
      g.fill(); g.restore();
    }
    var t = new T.CanvasTexture(c); t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter;
    return t;
  }
  KIT.leafTex = { round: leafTex(5, 'round'), tri: leafTex(9, 'tri'), needle: leafTex(13, 'needle') };
  // A tuft of grass blades fanning up from the bottom middle.
  KIT.grassTex = (function () {
    var N = 256, c = makeCanvas(N), g = c.getContext('2d'), r = rng(77);
    for (var i = 0; i < 46; i++) {
      var bx = N / 2 + (r() - 0.5) * N * 0.5, h = N * (0.45 + r() * 0.5), lean = (r() - 0.5) * N * 0.5, w = 4 + r() * 6;
      var v = Math.round(255 * (0.5 + r() * 0.5));
      g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      g.beginPath(); g.moveTo(bx - w, N); g.quadraticCurveTo(bx + lean * 0.3, N - h * 0.6, bx + lean, N - h); g.quadraticCurveTo(bx + lean * 0.3 + w * 0.4, N - h * 0.55, bx + w, N); g.closePath(); g.fill();
    }
    var t = new T.CanvasTexture(c); t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter;
    return t;
  })();

  // ------------------------------------------------------------------ the looks
  // Each look sets the sun, the colours light and shade take, the air, and the grade. Shade is never grey:
  // it takes the sky's hue (teal in the day, violet at dusk, blue-grey in mist), and light is warm.
  KIT.LOOKS = {
    day: {
      label: 'Golden day',
      // a low, warm sun raking across from the right, a cool shade, a cloud's shadow over the near lawn, and a storm behind
      sunDir: [0.74, 0.41, 0.42], sun: '#ffd6a2', sunI: 1.85,
      sky: '#8a9cbc', skyI: 0.62, gnd: '#6a6052', gndI: 0.22, rim: '#ffd6a2', rimI: 0.55,
      fog: '#cfd6d8', fogNear: 120, fogFar: 520, mist: 0.0,
      bgTop: '#5e6a78', bgMid: '#aeb7be', bgBot: '#ebe6dc', sunGlow: '#f3e4c6', splat: '#141414', paper: '#f2f1ee', wash: [0.66, 0.57, 0, 1],
      cloud: [-7.5, 7.5, 6.5, 0.72],
      torch: 0.0, window: 0.0,
      exposure: 0.9, sat: 0.96, contrast: 1.1, shadowTint: '#2b4a62', highTint: '#fff0dc', split: 0.2, vignette: 0.1, bloom: 0.08, shadeLift: 1.0, hatch: 0.46
    },
    dusk: {
      label: 'Torchlit dusk',
      sunDir: [0.75, 0.22, -0.35], sun: '#eeaa6a', sunI: 1.15,
      sky: '#4f5b78', skyI: 0.5, gnd: '#3c3b3c', gndI: 0.2, rim: '#f2a26c', rimI: 0.55,
      fog: '#4e5566', fogNear: 110, fogFar: 460, mist: 0.12,
      bgTop: '#232b3d', bgMid: '#3f4862', bgBot: '#b98b6e', sunGlow: '#d9a273', splat: '#141414', paper: '#e6e3dd', wash: [0.98, 0.55, 0, 1], glowLow: 1,
      torch: 1.0, window: 1.0,
      exposure: 1.05, sat: 0.86, contrast: 1.08, shadowTint: '#2a3442', highTint: '#ffd9b0', split: 0.18, vignette: 0.3, bloom: 0.7, hatch: 0.26, cross: 0, shadeLift: 0.5
    },
    mist: {
      label: 'Misty morning',
      sunDir: [-0.3, 0.55, -0.62], sun: '#fff0d2', sunI: 1.35,
      sky: '#b9c8c4', skyI: 0.85, gnd: '#7d8064', gndI: 0.3, rim: '#f4f0dc', rimI: 0.45,
      fog: '#c9d3cc', fogNear: 30, fogFar: 230, mist: 0.6,
      bgTop: '#94a6a5', bgMid: '#c3cec8', bgBot: '#e6e4d6', sunGlow: '#f6f0dc', splat: '#141414', paper: '#f2f1ee', wash: [0.6, 0.56, 0, 0.85],
      torch: 0.35, window: 0.25,
      exposure: 1.02, sat: 0.92, contrast: 0.98, shadowTint: '#46635f', highTint: '#fbf4df', split: 0.1, vignette: 0.1, bloom: 0.45, hatch: 0.34
    }
  };

  // ------------------------------------------------------------------ shared uniforms
  function lv(hex, k) { var c = tone(hex); return new T.Vector3(c.r * (k || 1), c.g * (k || 1), c.b * (k || 1)); }
  var MAXT = 12;
  var G = KIT.G = {
    uSunDir: { value: new T.Vector3(0, 1, 0) }, uSunCol: { value: new T.Vector3(1, 1, 1) }, uSkyCol: { value: new T.Vector3(0.5, 0.6, 0.7) },
    uGndCol: { value: new T.Vector3(0.3, 0.25, 0.2) }, uRimCol: { value: new T.Vector3(1, 0.9, 0.7) }, uFogCol: { value: new T.Vector3(0.8, 0.85, 0.85) },
    uFog: { value: new T.Vector3(120, 520, 0) }, uStroke: { value: KIT.strokeTex }, uStrokeScale: { value: 0.32 }, uTime: { value: 0 },
    uTorchPos: { value: [] }, uTorchCol: { value: [] }, uTorchN: { value: 0 }, uWindow: { value: 0 }, uAccent: { value: lv('#f26a1b', 1.6) },
    uPaint: { value: 1.0 }, uShadeLift: { value: 0 }, uCloud: { value: new T.Vector4(0, 0, 1, 0) }
  };
  for (var ti = 0; ti < MAXT; ti++) { G.uTorchPos.value.push(new T.Vector3()); G.uTorchCol.value.push(new T.Vector3()); }
  KIT.MAXT = MAXT;
  KIT.applyLook = function (name) {
    var L = KIT.LOOKS[name] || KIT.LOOKS.day; KIT.look = L; KIT.lookName = name;
    G.uSunDir.value.set(L.sunDir[0], L.sunDir[1], L.sunDir[2]).normalize();
    G.uSunCol.value.copy(lv(L.sun, L.sunI)); G.uSkyCol.value.copy(lv(L.sky, L.skyI)); G.uGndCol.value.copy(lv(L.gnd, L.gndI));
    G.uRimCol.value.copy(lv(L.rim, L.rimI)); G.uFogCol.value.copy(lv(L.fog)); G.uFog.value.set(L.fogNear, L.fogFar, L.mist); G.uWindow.value = L.window; G.uShadeLift.value = L.shadeLift || 0; var cl = L.cloud || [0, 0, 1, 0]; G.uCloud.value.set(cl[0], cl[1], cl[2], cl[3]);
    return L;
  };
  KIT.setTorches = function (list) {
    var L = KIT.look || KIT.LOOKS.day, n = Math.min(MAXT, list.length);
    for (var i = 0; i < MAXT; i++) {
      if (i < n) { var t = list[i], c = tone(t.color || '#ff9a4a'), k = (t.i || 1) * L.torch * 3.2; G.uTorchPos.value[i].set(t.pos[0], t.pos[1], t.pos[2]); G.uTorchCol.value[i].set(c.r * k, c.g * k, c.b * k); }
      else G.uTorchCol.value[i].set(0, 0, 0);
    }
    G.uTorchN.value = n;
  };

  // ------------------------------------------------------------------ the painted surface
  // A Lambert material whose lighting is replaced: a soft sun ramp whose edge wobbles with the brush, cast shadow with a
  // brushed edge, sky and ground fill taking the look's hues, a warm rim, stylised highlights on steel and brass,
  // torchlight, glowing windows at dusk, and aerial perspective. Every vertex carries its build step (aUnit): steps not
  // yet laid fold away, the step being laid can drop in, and today's steps take the orange of the app.
  var VERT_PARS = [
    'attribute float aUnit; attribute float aMat; attribute float aAO; attribute float aSway;',
    'uniform float uShown; uniform float uTotal; uniform float uRiseUnit; uniform float uRise; uniform float uTime;',
    'varying vec3 vPW; varying vec3 vNW; varying float vMat; varying float vAO; varying float vUnit;'
  ].join('\n');
  var VERT_HIDE = [
    '#ifdef PAINT_GHOST',
    '  if (aUnit < uShown || aUnit >= uTotal || aUnit < 0.0) transformed = vec3(0.0);',
    '#else',
    '  if (aUnit >= uShown) transformed = vec3(0.0);',
    '#endif',
    '  if (abs(aUnit - uRiseUnit) < 0.5) transformed.y += uRise;',
    '  if (aSway > 0.0) { float sw = sin(uTime * 1.7 + position.x * 0.9 + position.z * 0.7) * 0.5 + sin(uTime * 2.9 + position.y * 1.3) * 0.25; transformed.x += sw * aSway * 0.18; transformed.z += sw * aSway * 0.12; }'
  ].join('\n');
  function vertHook(sh, full) {
    var v = VERT_PARS + '\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_HIDE);
    if (full) v = v.replace('#include <project_vertex>', '#include <project_vertex>\n  vPW = (modelMatrix * vec4(transformed, 1.0)).xyz; vNW = normalize(mat3(modelMatrix) * objectNormal); vMat = aMat; vAO = aAO; vUnit = aUnit;');
    sh.vertexShader = v;
  }
  var FRAG_PARS = [
    'uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uGndCol; uniform vec3 uRimCol; uniform vec3 uFogCol; uniform vec3 uFog;',
    'uniform sampler2D uStroke; uniform float uStrokeScale; uniform float uTime; uniform vec3 uTorchPos[' + MAXT + ']; uniform vec3 uTorchCol[' + MAXT + ']; uniform float uTorchN;',
    'uniform float uWindow; uniform vec3 uAccent; uniform float uShown; uniform float uTotal; uniform float uNewFrom; uniform float uPaint; uniform float uLeaf; uniform float uShadeLift; uniform vec4 uCloud;',
    'varying vec3 vPW; varying vec3 vNW; varying float vMat; varying float vAO; varying float vUnit;',
    'vec4 paintTri(vec3 p, vec3 n) { vec3 b = abs(n); b = b * b; b = b * b; b /= (b.x + b.y + b.z + 1e-5);',
    '  return texture2D(uStroke, p.zy) * b.x + texture2D(uStroke, p.xz + 0.37) * b.y + texture2D(uStroke, p.xy + 0.71) * b.z; }'
  ].join('\n');
  var FRAG_MAIN = [
    'vec3 N = normalize(vNW);',
    '#ifdef DOUBLE_SIDED',
    '  N *= gl_FrontFacing ? 1.0 : -1.0;',
    '#endif',
    'float mt = floor(vMat + 0.5);',
    'vec3 V = normalize(cameraPosition - vPW);',
    'vec4 st = paintTri(vPW * uStrokeScale, N);',
    'vec4 st2 = paintTri(vPW * uStrokeScale * 0.21 + 3.1, N);',
    'float sS = st.r - 0.5, sB = st.b - 0.5, sM = st2.g - 0.5;',
    // how much each material shows the brush
    'float sk = 1.0; float gloss = 0.0; float spec = 0.0;',
    'if (mt == 0.0 || mt == 17.0) { sk = 1.25; } else if (mt == 1.0) { sk = 0.95; } else if (mt == 2.0) { sk = 1.1; } else if (mt == 3.0) { sk = 1.2; }',
    'else if (mt == 4.0 || mt == 15.0) { sk = 1.5; } else if (mt == 5.0) { sk = 0.7; } else if (mt == 6.0) { sk = 0.6; spec = 1.0; gloss = 46.0; } else if (mt == 7.0) { sk = 0.6; spec = 0.8; gloss = 22.0; }',
    'else if (mt == 13.0) { sk = 0.35; } else if (mt == 20.0) { sk = 0.5; } else if (mt == 21.0) { sk = 0.5; spec = 0.16; gloss = 34.0; } else if (mt == 23.0) { sk = 0.6; }',
    'if (mt == 24.0) sk = 0.5;',
    'if (mt == 26.0 || mt == 25.0) sk = 0.6;',
    'sk *= uPaint;',
    'vec3 alb = diffuseColor.rgb;',
    'alb *= 1.0 + sS * 0.26 * sk + sB * 0.12 * sk;',
    'float hueK = (mt == 3.0 || mt == 12.0) ? 0.15 : mt == 23.0 ? 0.25 : 1.0;',
    'if (mt == 24.0) hueK = 0.3;',
    'if (mt == 26.0 || mt == 25.0) hueK = 0.25;',
    'alb = mix(alb, alb * mix(vec3(1.0), vec3(1.1, 0.98, 0.84), hueK), clamp(sM * 2.2, 0.0, 1.0) * 0.7 * sk);',
    'alb = mix(alb, alb * mix(vec3(1.0), vec3(0.86, 0.95, 1.06), hueK), clamp(-sM * 2.2, 0.0, 1.0) * 0.7 * sk);',
    'alb *= 1.0 + (st2.r - 0.5) * 0.18 * sk;',
    'float ndl = dot(N, uSunDir);',
    'float wob = (sS * 0.3 + sM * 0.35) * min(sk, 1.2);',
    '#ifdef PAINT_LEAF',
    '  float lit = smoothstep(-0.35, 0.45, ndl + wob * 0.8);',
    '#else',
    '  float lit;',
    // (a pale hide turns from the sun over a broader band, a thin membrane of it broader still, so a white wing's flat
    // panels shade from lit to cool across their billow instead of flipping from white to blue)
    '  if (mt == 24.0) {',
    '#ifdef DOUBLE_SIDED',
    '    lit = smoothstep(-0.16, 0.36, ndl + wob * 0.45);',
    '#else',
    '    lit = smoothstep(-0.08, 0.26, ndl + wob * 0.45);',
    '#endif',
    // (a warm pale hide (26) turns into its shade softly, like rounded flesh, never along a drawn line; a thin membrane
    // (25) the same, and lit through from behind: the side turned from the sun glows warm with the light that comes
    // through it, so a spread wing reads as one taut sail instead of panels of light and dark)
    '  } else if (mt == 26.0 || mt == 25.0) lit = smoothstep(-0.2, 0.32, ndl + wob * 0.45);',
    '  else lit = smoothstep(-0.03, 0.17, ndl + wob * 0.45);',
    '#endif',
    'float lb = 0.0;',
    'if (mt == 25.0) { lb = smoothstep(-0.1, 0.3, -ndl + wob * 0.45); lit = max(lit, lb * 0.85); }',
    'float shd = smoothstep(0.2, 0.8, pShadow + wob * 0.7);',
    '#ifdef PAINT_LEAF',
    '  shd = mix(1.0, shd, 0.7);',
    '#endif',
    'if (mt == 18.0) shd = 1.0;',
    // (a pale hide takes a cast shadow a little lighter than its own shade, so the shadow of a big head on the chest
    // under it is a soft cool grey, never a collar)
    'if (mt == 24.0) shd = mix(1.0, shd, 0.86);',
    // (a pale membrane seen from its back face: the shadow test's offset runs along the face's own normal, which points
    // the other way, so it would shadow itself where the sun falls on it; there its light is taken unshadowed, or a
    // white wing turns blue panel by panel)
    '#ifdef DOUBLE_SIDED',
    '  if (mt == 24.0 && !gl_FrontFacing) shd = 1.0;',
    '#endif',
    // (a membrane takes only a little of the shadows: the light comes through it, and the shadow map's normal offset,
    // taken from the side its triangles face, would shade a thin sheet by itself wherever its other side is lit)
    'if (mt == 25.0) shd = mix(1.0, shd, 0.25);',
    // (a warm pale hide's cast shadows a little open, so a big head's shadow on its chest is a soft shade, never a dark
    // scarf)
    'if (mt == 26.0) shd = mix(1.0, shd, 0.6);',
    // a cloud's shadow drifting over part of the island, found by following the sun down to the ground
    'vec2 cgp = vPW.xz - uSunDir.xz * (vPW.y / max(uSunDir.y, 0.1));',
    'float cld = length(cgp - uCloud.xy) / uCloud.z + (st2.g - 0.5) * 0.5 + sM * 0.25;',
    'shd *= 1.0 - (1.0 - smoothstep(0.78, 1.0, cld)) * uCloud.w;',
    'lit *= shd;',
    'vec3 direct = uSunCol * lit * mix(0.78, 1.0, smoothstep(0.15, 0.85, ndl));',
    // (a pale hide turns from the sun through a broader half-tone, so white shows its form in the light too, and takes
    // only a little of the sun's warmth, its light leaning a touch cool and lilac: pearl, never ivory or cream)
    'if (mt == 24.0) { direct *= mix(0.3, 1.0, smoothstep(0.0, 1.0, ndl)); direct = mix(vec3(dot(direct, vec3(0.2126, 0.7152, 0.0722))), direct, 0.25) * vec3(0.96, 0.98, 1.04); }',
    'float up = N.y * 0.5 + 0.5;',
    'if (mt == 18.0) up = 0.55 + up * 0.35;',
    'vec3 amb = mix(uGndCol, uSkyCol, smoothstep(0.0, 1.0, up));',
    'float ao = vAO;',
    'if (mt != 9.0 && mt != 18.0 && mt != 10.0) ao *= mix(0.62, 1.0, smoothstep(0.0, 1.1, vPW.y));',
    'vec3 c = alb * (direct + amb * ao);',
    // the ground in shade takes more of the sky, the way the Hub's washes do, so the pen hatching reads on it
    'c += alb * uSkyCol * smoothstep(0.55, 0.95, N.y) * (1.0 - lit) * uShadeLift * ao;',
    // warm rim on the edges turned away from you, strongest where the sun is behind
    'float fr = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);',
    'c += uRimCol * alb * fr * (0.25 + 0.75 * lit) * 1.2;',
    // steel and brass: a stylised, broken highlight, and the sky in the sheen
    'if (spec > 0.0) { vec3 H = normalize(uSunDir + V); float sp = pow(max(dot(N, H), 0.0), gloss); sp = smoothstep(0.25, 0.6, sp + sS * 0.25); c += uSunCol * sp * lit * spec * 0.9; c += uSkyCol * alb * fr * 1.4 * spec; }',
    // dragon hide: a broad cool sheen on the grazing edges and a soft sun gloss, so a black hide still shows its form
    'if (mt == 21.0) { vec3 H2 = normalize(uSunDir + V); c += uSkyCol * fr * 0.12 * (0.4 + 0.6 * up) + uSunCol * lit * pow(max(dot(N, H2), 0.0), 8.0) * 0.1; }',
    // a matte dark hide (the night dragon's): no gloss, only a soft cool sheen where it turns from you or faces the sky,
    // and a broad, faint one where the sun catches it, so near-black still shows its form without looking like plastic
    'if (mt == 23.0) { vec3 H3 = normalize(uSunDir + V); float shn = pow(max(dot(N, H3), 0.0), 4.0); c += uSkyCol * (fr * 0.14 * (0.3 + 0.7 * up) + shn * lit * 0.075) + uSkyCol * alb * up * 0.3; }',
    // a pale hide (a white dragon's): cool pearl in the sun, and in its shade the cool blue-grey of the sky it takes,
    // so it models in light and shade and never turns navy or paper. Its shade is filled with the light thrown back
    // into it: the sky's from above, and from below the sunlit ground's with some sky in it, so a belly or a throat is
    // a mid cool grey, never charcoal. A thin wing's membrane (drawn two-sided) lets a little of the sun through where
    // it turns away (its own shadow test is its other face, so that light is not shadowed). It greys a little where it
    // turns edge-on, so its outline holds against a pale sky or pale stone
    'if (mt == 24.0) { vec3 fill = mix(uSunCol * 0.24 + uGndCol * 1.6 + uSkyCol * 1.1, uSkyCol * 1.8, smoothstep(0.0, 1.0, up)); fill = mix(vec3(dot(fill, vec3(0.2126, 0.7152, 0.0722))), fill, 0.8);',
    // (the fill is least just past the turn from the sun and grows deeper into the shade: a cool core shadow on the
    // turn of every mass, the head, the chest, the haunch, with the light thrown back into the shade beyond it; a face
    // turned to the sun but in a cast shadow takes the whole fill, so the shadow of the head on the throat is a soft
    // grey and never a dark collar)
    // (a membrane's far face takes less of it, and only a little of the sun through it, so a wing turned from the sun
    // or seen from under it is a cool mid grey that sets off its lit panels, never paper)
    '  float fk = 0.85;',
    '#ifdef DOUBLE_SIDED',
    '  fk = 0.6; c += alb * uSunCol * max(-ndl, 0.0) * 0.28;',
    '#endif',
    '  c += alb * fill * (1.0 - lit) * mix(0.85, 1.0, ao) * fk * mix(0.6, 1.0, max(smoothstep(-0.02, -0.6, ndl), smoothstep(0.12, 0.4, ndl)));',
    // (and a faint, broad cool sheen where the sun and the eye meet on it, so its lit planes have a lustre)
    '  vec3 H4 = normalize(uSunDir + V); c += uSkyCol * vec3(0.95, 0.97, 1.08) * pow(max(dot(N, H4), 0.0), 6.0) * lit * 0.16;',
    '  c *= 1.0 - 0.3 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.0); c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, mix(0.92, 1.0, lit)); }',
    // a warm pale hide (a cream dragon's): its shade lit by the light thrown back off the sunlit ground and the body
    // itself, warm and soft, strongest on the planes turned down and away from the sky, so a pale hide in shade turns
    // a soft warm grey instead of slate; a little of the sky on the planes that face it
    'if (mt == 26.0) { c += alb * (uSunCol * vec3(1.0, 0.8, 0.58) * 0.24 * (1.0 - lit) * mix(1.0, 0.55, up) * ao - uSkyCol * 0.3 * (1.0 - lit) * up * ao + uSkyCol * up * 0.06); }',
    'if (mt == 25.0) { c *= mix(vec3(1.0), vec3(1.12, 0.92, 0.7), lb); c += alb * uSunCol * vec3(1.0, 0.8, 0.58) * 0.16 * (1.0 - lit) * ao; }',
    // torches
    'for (int i = 0; i < ' + MAXT + '; i++) { if (float(i) >= uTorchN) break; vec3 d = uTorchPos[i] - vPW; float L2 = dot(d, d); float att = 1.0 / (1.0 + L2 * 0.22); float nl = clamp(dot(N, d * inversesqrt(L2 + 1e-4)) * 0.75 + 0.25, 0.0, 1.0); c += alb * uTorchCol[i] * att * nl * (0.85 + sS * 0.3); }',
    // window panes and dark openings
    'if (mt == 11.0) { c = mix(alb * (amb * 0.9 + direct * 0.3) + vec3(dot(uSkyCol, vec3(0.3, 0.5, 0.2))) * (0.05 + fr * 0.22), vec3(1.0, 0.6, 0.27) * (1.9 + sS * 0.8), uWindow); }',
    'if (mt == 12.0) { c = alb * (amb * 0.55 + direct * 0.12); }',
    // eyes and embers: their own light, so they read even in shade
    'if (mt == 22.0) { c = alb * (0.95 + 0.2 * up + fr * 0.3); }',
    '#ifdef PAINT_LEAF',
    // light through the leaves
    '  c += uSunCol * alb * pow(max(dot(-V, uSunDir), 0.0), 3.0) * 0.45;',
    '#endif',
    // today's steps (the people and life that come once it stands are never today's)
    'if (vUnit >= uNewFrom && vUnit < uShown && vUnit < uTotal && vUnit >= 0.0) { c = mix(c, uAccent * (0.45 + lit * 0.7), 0.42) + uAccent * fr * 0.5; }',
    // aerial perspective, and low mist that pools in the hollows
    'float dist = length(vPW - cameraPosition);',
    'float f = smoothstep(uFog.x, uFog.y, dist) * 0.92;',
    'f = max(f, (1.0 - smoothstep(-10.0, 9.0, vPW.y)) * uFog.z);',
    'c = mix(c, uFogCol, f);',
    // alpha carries the paper value for the pen work after the paint: 1 in the sun, 0 in deep shade, +4 for foliage
    'float pv = lit * mix(0.8, 1.0, ao);',
    '#ifdef PAINT_LEAF',
    '  pv = 4.0 + mix(1.0, lit, 0.7);',
    '#endif',
    '#ifdef GRASS',
    '  pv = 5.0;',
    '#endif',
    // (a pale hide is never hatched: its shade is a colour, not a dark; flagged +12 so the pen draws its folds lightly)
    'if (mt == 24.0) pv = 12.0 + mix(0.55, 1.0, pv);',
    'if (mt == 11.0 && uWindow > 0.5) pv = 1.0;',
    'if (mt == 22.0) pv = 1.0;',
    // (a warm pale hide's shade, and a membrane's, hatched more lightly: it is a soft warm grey, never a dark)
    'if (mt == 26.0) pv = max(pv, 0.42);',
    'if (mt == 25.0) pv = max(pv, 0.55);',
    '#ifndef PAINT_LEAF',
    '  if (mt == 9.0) pv += 8.0;',
    '#endif',
    // today's steps are flagged so the pen paints them in the app's exact orange
    'if (vUnit >= uNewFrom && vUnit < uShown && vUnit < uTotal && vUnit >= 0.0) pv = 6.0 + lit;',
    'gl_FragColor = vec4(c, pv);'
  ].join('\n');
  function fragHook(sh) {
    sh.fragmentShader = FRAG_PARS + '\n' + sh.fragmentShader
      .replace('reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();', 'float pShadow = getShadowMask();')
      .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', FRAG_MAIN);
  }
  // Per-build uniforms (each build lays its own steps); the look's uniforms are shared.
  KIT.buildUniforms = function () {
    return { uShown: { value: 1e6 }, uTotal: { value: 1e6 }, uNewFrom: { value: 1e6 }, uRiseUnit: { value: -9 }, uRise: { value: 0 } };
  };
  function hookAll(mat, U, frag) {
    mat.onBeforeCompile = function (sh) {
      for (var k in G) sh.uniforms[k] = G[k];
      for (var j in U) sh.uniforms[j] = U[j];
      sh.uniforms.uLeaf = { value: 0 };
      vertHook(sh, frag);
      if (frag) fragHook(sh);
    };
    var key = Object.keys(mat.defines || {}).join(',') + (frag ? 'f' : 'd');
    mat.customProgramCacheKey = function () { return key; };
    return mat;
  }
  KIT.makeMaterials = function (U) {
    var solid = hookAll(new T.MeshLambertMaterial({ vertexColors: true }), U, true);
    var cloth = hookAll(new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide }), U, true);
    var leaf = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide, map: KIT.leafTex.round, alphaTest: 0.5 });
    leaf.defines = { PAINT_LEAF: 1 }; hookAll(leaf, U, true);
    var leafTri = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide, map: KIT.leafTex.tri, alphaTest: 0.5 });
    leafTri.defines = { PAINT_LEAF: 1, LEAF_TRI: 1 }; hookAll(leafTri, U, true);
    var needle = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide, map: KIT.leafTex.needle, alphaTest: 0.45 });
    needle.defines = { PAINT_LEAF: 1, LEAF_NEEDLE: 1 }; hookAll(needle, U, true);
    var grass = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide, map: KIT.grassTex, alphaTest: 0.5 });
    grass.defines = { PAINT_LEAF: 1, GRASS: 1 }; hookAll(grass, U, true);
    var glow = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    hookAll(glow, U, false);
    var ghost = new T.MeshBasicMaterial({ color: new T.Color('#f2f1ee').convertSRGBToLinear(), transparent: true, opacity: 0.1, depthWrite: false, side: T.DoubleSide });
    ghost.defines = { PAINT_GHOST: 1 }; hookAll(ghost, U, false);
    // the ghost tints what is behind it but leaves its alpha (the pen work's paper value) alone
    ghost.blending = T.CustomBlending; ghost.blendSrc = T.SrcAlphaFactor; ghost.blendDst = T.OneMinusSrcAlphaFactor; ghost.blendSrcAlpha = T.ZeroFactor; ghost.blendDstAlpha = T.OneFactor;
    // the same steps as an opaque depth-only silhouette, for drawing what is still to come as pencil lines
    var ghostSolid = new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide });
    ghostSolid.defines = { PAINT_GHOST: 1, GHOST_SOLID: 1 }; hookAll(ghostSolid, U, false);
    function depth(map, at) {
      var m = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map: map || null, alphaTest: at || 0 });
      return hookAll(m, U, false);
    }
    return {
      solid: solid, cloth: cloth, leaf: leaf, leafTri: leafTri, needle: needle, grass: grass, glow: glow, ghost: ghost, ghostSolid: ghostSolid,
      depth: depth(), depthLeaf: depth(KIT.leafTex.round, 0.5), depthLeafTri: depth(KIT.leafTex.tri, 0.5), depthNeedle: depth(KIT.leafTex.needle, 0.45), depthGrass: depth(KIT.grassTex, 0.5)
    };
  };
})();
