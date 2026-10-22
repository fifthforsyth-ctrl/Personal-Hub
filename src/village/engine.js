// The village drawing: an ink-and-watercolour survey map in 3D, the way the
// Ascent mountain is drawn. Every quest stands on its own plot around the
// plaza, each camp builds one part of it, and each step ticked lays a few
// bricks. Bullseyes on The Mark train the soldiers who march in the plaza.
// The slider replays it all from the first step to today.
//
// This is the mockup's engine (https://claude.ai/artifact/7HfmhqkCg8qxuefFbx4abi)
// fed his real quests instead of a sample, so it keeps the mockup's plain
// ES5 style. It draws into a shadow root on `host`, so its styles and the
// Hub's never meet. src/lib/village.js shapes the data; src/pages/Village.jsx
// loads it and saves what's tapped here:
//
//   api.toggleStep(step, doneOn)  a step ticked or opened again in a sheet
//   api.build({ quest_id, kind, seed, plot })  Build this, in Generate project
//   api.open(path)  a link out (a camp, the plans)
//   api.close()     the close button
//
// Two things matter when changing it, both learned the hard way:
//   * three r128 sizes instanceColor from .count on the first setColorAt, so
//     every pool fills all its slots before trimming the count (see
//     makePools). Get it wrong and real GPUs drop whole draws, leaving only
//     black pen outlines, while headless SwiftShader shows nothing wrong.
//   * check it under Mesa (chromium --use-gl=angle --use-angle=gl in Xvfb)
//     with zero GL_INVALID_OPERATION errors, not only in SwiftShader.

import * as T from "three";
import CSS from "./village.css?raw";
import { haptic } from "../lib/haptics";
import { parseDateStr } from "../lib/planDates";
import { assignCamps, bandLine, buildOptions, dayIndex, layout, NATURE_START, shortName, tileOf } from "../lib/village";

const MARKUP = `

<div id="paper"></div>
<div id="grain"></div>
<canvas id="scene" aria-label="3D drawing of your village. Drag to turn it, pinch or scroll to zoom, tap a building for its quest."></canvas>
<div id="labels"></div>
<div id="ui">
  <header class="top">
    <div class="titlecard">
      <span class="eyebrow">More · Village</span>
      <h1>Your village</h1>
      <span class="scale" aria-hidden="true"><i></i>1 plot = 1 quest</span>
    </div>
    <div class="top-actions">
      <button class="iconbtn" id="leave" type="button" aria-label="Close the village"><svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="#141414" stroke-width="1.8" stroke-linecap="round"/></svg></button>
      <button class="iconbtn compass" id="recenter" type="button" aria-label="Show the whole village"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="13.5" fill="none" stroke="#d9d6d0" stroke-width="1"/><g stroke="#141414" stroke-width="1" stroke-linecap="round"><path d="M20 4.5v2.2M20 33.3v2.2M4.5 20h2.2M33.3 20h2.2"/></g><g id="needle"><path d="M20 8.5l3.6 11.5h-7.2z" fill="#141414"/><path d="M20 31.5l3.6-11.5h-7.2z" fill="#ffffff" stroke="#141414" stroke-width="1.2" stroke-linejoin="round"/><circle cx="20" cy="20" r="1.6" fill="#ffffff" stroke="#141414" stroke-width="1"/></g></svg></button>
    </div>
  </header>
  <div class="spacer"></div>
  <!-- the hint sits just above the dock, clear of the quest labels at the top of the drawing -->
  <p class="hint" id="hint"><span class="long">Drag to turn · pinch to zoom · tap a building</span><span class="short">Drag · pinch · tap a building</span></p>

  <section class="card dock" id="dock" aria-label="Watch the village grow">
    <div class="dock-row">
      <button class="play" id="play" type="button" aria-label="Play it back from the first day"><svg viewBox="0 0 16 16" aria-hidden="true"><path id="playicon" d="M4 2.5v11l9.5-5.5z" fill="currentColor"/></svg></button>
      <div class="when"><span class="eyebrow" id="dayno">Today</span><b id="date"></b></div>
    </div>
    <div class="slider">
      <input type="range" id="time" min="0" max="1000" step="1" value="1000" aria-label="Day in the village's life">
      <div class="ticks" id="ticks"></div>
    </div>
    <div class="stats">
      <div class="stat"><b><svg class="key" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="3" width="10" height="6.5" rx="1.8" fill="#d5cec1" stroke="#141414" stroke-width="1"/></svg><span id="s-bricks">0</span></b><span>bricks laid</span></div>
      <div class="stat"><b><svg class="key" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 11V1.2" stroke="#141414" stroke-width="1.2" stroke-linecap="round"/><path d="M3 1.6l7 2.3-7 2.3z" fill="#141414"/></svg><span id="s-builds">0</span></b><span>builds standing</span></div>
      <div class="stat"><b><svg class="key" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="1" fill="#c6d3b0" stroke="#141414" stroke-width="1"/></svg><span id="s-land">0</span></b><span>plots of land</span></div>
      <div class="stat"><b><svg class="key" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="#ffffff" stroke="#141414" stroke-width="1"/><circle cx="6" cy="6" r="2" fill="#141414"/></svg><span id="s-army">0</span></b><span>soldiers</span></div>
    </div>
    <p class="verse">“So built we the wall… for the people had a mind to work.”<cite>Nehemiah 4:6</cite></p>
  </section>

  <section class="card sheet" id="sheet" hidden aria-label="Building"></section>
  <section class="card sheet" id="gen" hidden aria-label="Generate project"></section>
</div>
<div class="toast" id="toast" role="status" hidden></div>
<div id="nogl" hidden><div class="card"><b>This view needs 3D graphics.</b><p class="note">Your browser didn't start WebGL. Try opening the page in Safari or Chrome.</p></div></div>
`;

export function mountVillage(host, data, api) {
  var root = host.shadowRoot || host.attachShadow({ mode: "open" });
  root.innerHTML = "<style>" + CSS + "</style><div class=\"vg\">" + MARKUP + "</div>";
  var $ = function (id) { return root.getElementById(id); };
  var canvas = $('scene');
  var renderer;
  try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
  catch (e) { $('nogl').hidden = false; return { destroy: function () { root.innerHTML = ''; } }; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  // ---------------------------------------------------------------- constants
  // day 0 is the village's first day (its first step done or build made); MAXDAY is today
  var TILE = 28, DEPTH = 4.2, MAXDAY = data.days;
  var DAY0 = parseDateStr(data.day0);
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // watercolour washes under the pen: warm grey stone, sepia timber, slate and charcoal roofs, sage greens, pale blue-grey
  // water, whitewash that is mostly paper. Muted, but present. Orange is kept for today's stones, the plaza flag,
  // small flames and the Generate plot; pennants and banners are ink.
  var PAL = {
    stone: ['#ddd6ca', '#d5cec1', '#cec6b8', '#e2dcd1', '#c9c1b3', '#d9d2c6'],
    core: '#8f897f',
    path: ['#e8e3d9', '#e1dbd0', '#ece8e0', '#dbd5c9'],
    wood: ['#c8b193', '#bea687', '#d0bc9f', '#b89f80'],
    woodDark: '#4a4743',
    plank: ['#dccbb0', '#d4c2a6', '#e2d4bd'],
    barn: ['#cdbfad', '#c4b5a2', '#d4c8b8'],
    plaster: ['#faf8f3', '#f6f3ec', '#fcfbf7'],
    glass: '#3e3f42',
    slate: '#717880', charcoal: '#62666c', terracotta: '#958a80', teal: '#7b8a8c',
    straw: ['#e6d7aa', '#e0cf9d', '#ebdfb8'],
    wool: ['#ffffff', '#f8f7f4', '#fbfaf8'],
    leaf: ['#bccb9f', '#b3c495', '#c4d2ab', '#aabd8e'],
    pine: ['#a5ae99', '#9ca690', '#acb4a1'],
    trunk: '#a08c74',
    water: '#d2dfe2',
    soil: '#dccdb6',
    crop: ['#c9d5b0', '#d2dcbb', '#c0cda4'],
    flower: ['#ffffff', '#f2ecd9', '#ffffff', '#ebe8e1', '#ffffff'],
    tuft: ['#aab797', '#a0ae8c'],
    rock: ['#dedad1', '#d5d0c6', '#e4e0d8'],
    ink: '#2a2926', orange: '#f26a1b', skin: '#f6f1e9', tunic: '#5c5e62', helm: '#8e9195',
    canvas: ['#f3efe6', '#eee9de', '#f6f3ec'],
    glow: '#f7e9c4', dot: '#3a3935'
  };
  function lin(hex) { return new T.Color(hex).convertSRGBToLinear(); }
  var ORANGE = lin('#f26a1b'), WHITE = new T.Color(1, 1, 1), GHOST_SEL = lin('#dedad2');

  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function angDiff(a, b) { var d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  var UP = new T.Vector3(0, 1, 0);
  function qY(a) { return new T.Quaternion().setFromAxisAngle(UP, a); }
  function qBeam(dx, dy, dz) { return new T.Quaternion().setFromUnitVectors(UP, new T.Vector3(dx, dy, dz).normalize()); }

  // ---------------------------------------------------------------- builder: every piece belongs to a part, laid in order
  function Builder(seed) { this.r = rng(seed); this.parts = []; this.cur = null; this.grp = -1; this.attach = null; }
  var BP = Builder.prototype;
  BP.j = function (a) { return (this.r() * 2 - 1) * a; };
  BP.pick = function (a) { return a[Math.floor(this.r() * a.length)]; };
  BP.col = function (hex, amt) { var c = new T.Color(hex); if (amt) c.offsetHSL(0, 0, this.j(amt)); return c.convertSRGBToLinear(); };
  BP.stoneCol = function (pal) { return this.col(this.pick(pal || PAL.stone), 0.035); };
  BP.part = function (key, name, o) { var p = { key: key, name: name, units: 0, pieces: [], hidden: !!(o && o.hidden) }; this.parts.push(p); this.cur = p; return p; };
  BP.unit = function (fn) {
    if (this.grp >= 0) { fn.call(this); return; }
    this.grp = this.cur.units++; fn.call(this); this.grp = -1;
  };
  BP.mk = function (g, x, y, z, sx, sy, sz, q, c, fl) { return { g: g, x: x, y: y, z: z, sx: sx, sy: sy, sz: sz, q: q || null, c: c, ord: 0, fl: fl || null }; };
  BP.add = function (g, x, y, z, sx, sy, sz, q, c, fl) {
    var p = this.cur, ord = this.grp >= 0 ? this.grp : p.units++;
    var pc = this.mk(g, x, y, z, sx, sy, sz, q, c, fl); pc.ord = ord; p.pieces.push(pc);
    if (this.attach) { var a = this.attach; this.attach = null; a.ord = ord; p.pieces.push(a); }
    return this;
  };
  BP.course = function (ax, az, bx, bz, y, o) {
    var dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 0.25) return;
    var ux = dx / L, uz = dz / L, q = qY(-Math.atan2(uz, ux));
    var len = o.len || 1.1, h = o.h || 0.62, d = o.d || 0.85, n = Math.max(1, Math.round(L / len)), sl = L / n, off = o.off || 0;
    var cuts = [0], i;
    for (i = 0; i <= n; i++) { var t = (i + off) * sl; if (t > 0.15 && t < L - 0.15) cuts.push(t); }
    cuts.push(L);
    for (i = 0; i < cuts.length - 1; i++) {
      var w = cuts[i + 1] - cuts[i]; if (w < 0.12) continue;
      var tm = (cuts[i] + cuts[i + 1]) / 2, px = ax + ux * tm, pz = az + uz * tm;
      if (o.hole && o.hole(px, pz, y)) continue;
      this.add('stone', px, y, pz, w - 0.07, h * (0.88 + this.j(0.04)), d * (0.95 + this.j(0.04)), q, this.stoneCol(o.pal));
    }
  };
  BP.wall = function (ax, az, bx, bz, y0, courses, o) {
    o = o || {}; var h = o.h || 0.62, d = o.d || 0.7, faces = o.faces || [-d / 2, d / 2];
    var dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L;
    for (var k = 0; k < courses; k++) {
      var y = y0 + k * h + h / 2;
      for (var f = 0; f < faces.length; f++) {
        var off = faces[f];
        this.course(ax + nx * off, az + nz * off, bx + nx * off, bz + nz * off, y, { len: o.len || 1.0, h: h, d: d, off: ((k + f) % 2) * 0.5, hole: o.hole, pal: o.pal });
      }
    }
    return y0 + courses * h;
  };
  BP.ring = function (cx, cz, r, y0, courses, o) {
    o = o || {}; var h = o.h || 0.62, len = o.len || 1.1, d = o.d || 0.85, r1 = o.r1 || r;
    for (var k = 0; k < courses; k++) {
      var rr = r + (r1 - r) * (courses > 1 ? k / (courses - 1) : 0);
      var n = Math.max(6, Math.round(Math.PI * 2 * rr / len)), arc = Math.PI * 2 * rr / n, y = y0 + k * h + h / 2, off = (k % 2) * 0.5;
      if (o.core) this.attach = this.mk('log', cx, y, cz, rr - d / 2 + 0.08, h, rr - d / 2 + 0.08, null, this.col(o.core, 0));
      for (var i = 0; i < n; i++) {
        var a = (i + off) / n * Math.PI * 2;
        if (o.hole && o.hole(a, y)) continue;
        this.add('stone', cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr, arc * (0.9 + this.j(0.03)), h * (0.88 + this.j(0.04)), d * (0.95 + this.j(0.04)), qY(-a - Math.PI / 2), this.stoneCol(o.pal));
      }
      this.attach = null;
      if (o.onCourse) o.onCourse.call(this, k, y);
    }
    return y0 + courses * h;
  };
  BP.rect = function (x0, z0, x1, z1, y0, courses, o) {
    o = o || {}; var h = o.h || 0.62, d = o.d || 0.85, len = o.len || 1.1;
    for (var k = 0; k < courses; k++) {
      var y = y0 + k * h + h / 2, ev = k % 2 === 0, c = { len: len, h: h, d: d, off: ev ? 0 : 0.5, hole: o.hole, pal: o.pal };
      if (o.core) this.attach = this.mk('block', (x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0 - 2 * d + 0.12, h, z1 - z0 - 2 * d + 0.12, null, this.col(o.core, 0));
      var xa = ev ? x0 : x0 + d, xb = ev ? x1 : x1 - d, za = ev ? z0 + d : z0, zb = ev ? z1 - d : z1;
      this.course(xa, z1 - d / 2, xb, z1 - d / 2, y, c);
      this.course(x1 - d / 2, zb, x1 - d / 2, za, y, c);
      this.course(xb, z0 + d / 2, xa, z0 + d / 2, y, c);
      this.course(x0 + d / 2, za, x0 + d / 2, zb, y, c);
      this.attach = null;
      if (o.onCourse) o.onCourse.call(this, k, y);
    }
    return y0 + courses * h;
  };
  BP.merlons = function (ax, az, bx, bz, y, o) {
    o = o || {}; var dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = -uz, nz = ux, q = qY(-Math.atan2(uz, ux));
    var off = o.off || 0, n = Math.max(2, Math.round(L / (o.step || 1.7))), w = Math.min(0.95, L / n * 0.55);
    for (var i = 0; i < n; i++) { var t = (i + 0.5) * L / n; this.add('stone', ax + ux * t + nx * off, y + 0.42, az + uz * t + nz * off, w, 0.84, o.d || 0.62, q, this.stoneCol()); }
  };
  BP.post = function (x, y0, z, r, h, c) { this.add('log', x, y0 + h / 2, z, r, h, r, null, c); };
  BP.beam = function (x0, y0, z0, x1, y1, z1, r, c) {
    var dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, L = Math.hypot(dx, dy, dz);
    this.add('log', (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, r, L, r, qBeam(dx, dy, dz), c);
  };
  BP.cone = function (x, y, z, r, h, c) { this.add('cone', x, y, z, r, h, r, null, c); };
  BP.pyr = function (x, y, z, w, dp, h, c) { this.add('pyr', x, y, z, w * 0.7072, h, dp * 0.7072, null, c); };
  BP.gable = function (x, y, z, len, wid, h, c, ry, g) { this.add(g || 'gable', x, y, z, len, h, wid, ry ? qY(ry) : null, c); };
  BP.pennant = function (x, y, z, hex, big) {
    var k = big ? 1.9 : 1;
    this.unit(function () {
      this.post(x, y, z, 0.06 * k, 1.7 * k, this.col(PAL.woodDark, 0));
      this.add('flag', x, y + 1.7 * k - 0.72 * k, z, 1.15 * k, 0.7 * k, 1, null, this.col(hex, 0), { flag: this.r() * 6 });
    });
  };
  BP.flame = function (x, y, z, s) {
    this.unit(function () {
      this.add('glow', x, y, z, 0.6 * s, 1.35 * s, 0.6 * s, null, lin('#f2862e'), { flame: this.r() * 6 });
      this.add('glow', x + 0.1 * s, y, z - 0.08 * s, 0.34 * s, 1.75 * s, 0.34 * s, null, lin('#ffcf6e'), { flame: this.r() * 6 });
    });
  };
  BP.smoke = function (x, y, z) {
    this.unit(function () { for (var i = 0; i < 5; i++) this.add('puff', x, y, z, 0.4, 0.4, 0.4, null, lin('#f3f1ec'), { smoke: i / 5 }); });
  };
  BP.tree = function (x, z, s, kind) {
    s = s || 1;
    this.unit(function () {
      if (kind === 'pine') {
        this.post(x, 0, z, 0.18 * s, 1.1 * s, this.col(PAL.trunk, 0.03));
        var g = this.col(this.pick(PAL.pine), 0.03);
        this.add('tip', x, 0.8 * s, z, 1.3 * s, 2.0 * s, 1.3 * s, null, g);
        this.add('tip', x, 1.9 * s, z, 1.05 * s, 1.8 * s, 1.05 * s, null, g);
        this.add('tip', x, 2.95 * s, z, 0.75 * s, 1.6 * s, 0.75 * s, null, g);
      } else {
        this.post(x, 0, z, 0.2 * s, 1.6 * s, this.col(PAL.trunk, 0.03));
        var c = this.col(kind === 'fruit' ? '#c3cfaa' : this.pick(PAL.leaf), 0.03);
        this.add('ball', x, 2.35 * s, z, 1.3 * s, 1.12 * s, 1.3 * s, null, c);
        this.add('ball', x + 0.6 * s, 1.95 * s, z + 0.3 * s, 0.82 * s, 0.76 * s, 0.82 * s, null, c);
        this.add('ball', x - 0.55 * s, 2.05 * s, z - 0.35 * s, 0.78 * s, 0.72 * s, 0.78 * s, null, c);
        if (kind === 'fruit') for (var i = 0; i < 4; i++) {
          var a = this.r() * Math.PI * 2;
          this.add('dot', x + Math.cos(a) * 1.15 * s, (1.9 + this.r() * 0.9) * s, z + Math.sin(a) * 1.15 * s, 0.15 * s, 0.15 * s, 0.15 * s, null, lin(PAL.dot));
        }
      }
    });
  };
  BP.sheep = function (x, z, ry) {
    var cs = Math.cos(ry), sn = Math.sin(ry);
    function P(dx, dz) { return [x + dx * cs + dz * sn, z - dx * sn + dz * cs]; }
    this.unit(function () {
      var w = this.col(this.pick(PAL.wool), 0.02), dk = this.col('#3a3532', 0), q = qY(ry);
      this.add('ball', x, 0.8, z, 0.62, 0.5, 0.82, q, w);
      var hd = P(0, 0.8); this.add('ball', hd[0], 0.98, hd[1], 0.22, 0.25, 0.28, q, dk);
      var cap = P(0, 0.62); this.add('ball', cap[0], 1.12, cap[1], 0.3, 0.24, 0.3, q, w);
      var self = this;
      [[-0.25, 0.4], [0.25, 0.4], [-0.25, -0.4], [0.25, -0.4]].forEach(function (l) { var p = P(l[0], l[1]); self.post(p[0], 0, p[1], 0.07, 0.48, dk); });
    });
  };
  BP.bale = function (x, y, z, ry) { this.add('stone', x, y, z, 1.15, 0.7, 0.78, qY(ry || 0), this.col(this.pick(PAL.straw), 0.03)); };
  BP.palisade = function (cx, cz, r, gap) {
    var span = Math.PI * 2 - 2 * gap, n = Math.round(span * r / 0.62);
    for (var i = 0; i < n; i++) {
      var a = Math.PI / 2 + gap + (i + 0.5) / n * span;
      var h = 3.0 + this.r() * 0.7, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, c = this.col(this.pick(PAL.wood), 0.03);
      this.unit(function () { this.post(x, 0, z, 0.3, h, c); this.add('tip', x, h, z, 0.3, 0.62, 0.3, null, c); });
    }
  };
  BP.fence = function (pts, gapLast) {
    var posts = [];
    for (var s = 0; s < pts.length - 1; s++) {
      var a = pts[s], b = pts[s + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 1.8));
      for (var i = 0; i < n; i++) posts.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
    }
    posts.push(pts[pts.length - 1]);
    var wood = PAL.wood;
    for (var k = 0; k < posts.length; k++) {
      var p = posts[k], nx = posts[k + 1];
      this.unit(function () {
        this.post(p[0], 0, p[1], 0.11, 1.35, this.col(this.pick(wood), 0.02));
        if (nx && !(gapLast && k === posts.length - 2)) {
          var dx = nx[0] - p[0], dz = nx[1] - p[1], L = Math.hypot(dx, dz), q = qY(-Math.atan2(dz, dx));
          this.add('block', (p[0] + nx[0]) / 2, 0.6, (p[1] + nx[1]) / 2, L, 0.13, 0.09, q, this.col(this.pick(PAL.plank), 0.03));
          this.add('block', (p[0] + nx[0]) / 2, 1.05, (p[1] + nx[1]) / 2, L, 0.13, 0.09, q, this.col(this.pick(PAL.plank), 0.03));
        }
      });
    }
  };
  BP.timberTower = function (cx, cz, o) {
    o = o || {}; var s = o.size || 1.5, H = o.h || 8, lev = 3, lh = H / lev, wd = PAL.wood, sec = o.sec || function () {};
    var cs = [[-s, -s], [s, -s], [s, s], [-s, s]], i, L;
    for (L = 0; L < lev; L++) {
      for (i = 0; i < 4; i++) this.post(cx + cs[i][0], L * lh, cz + cs[i][1], 0.2, lh, this.col(this.pick(wd), 0.02));
      for (i = 0; i < 4; i++) {
        var a = cs[i], b = cs[(i + 1) % 4], up = (L + i) % 2 === 0;
        this.beam(cx + a[0], L * lh + (up ? 0.3 : lh - 0.3), cz + a[1], cx + b[0], L * lh + (up ? lh - 0.3 : 0.3), cz + b[1], 0.11, this.col(this.pick(wd), 0.02));
      }
    }
    sec.call(this, 'platform');
    var py = H, n = 7, span = 2 * s + 0.8;
    for (var k = 0; k < n; k++) this.add('block', cx, py + 0.12, cz - span / 2 + (k + 0.5) * span / n, 2 * s + 0.9, 0.22, span / n - 0.05, null, this.col(this.pick(PAL.plank), 0.03));
    for (i = 0; i < 4; i++) {
      var a2 = cs[i], b2 = cs[(i + 1) % 4];
      this.beam(cx + a2[0] * 1.1, py + 1.0, cz + a2[1] * 1.1, cx + b2[0] * 1.1, py + 1.0, cz + b2[1] * 1.1, 0.09, this.col(PAL.wood[0], 0.02));
    }
    sec.call(this, 'roof');
    var ry = py + 0.25, rh = 2.3;
    this.unit(function () { for (var i = 0; i < 4; i++) this.post(cx + cs[i][0], ry, cz + cs[i][1], 0.12, rh, this.col(PAL.wood[1], 0)); });
    this.pyr(cx, ry + rh, cz, 2 * s + 1.7, 2 * s + 1.7, 2.4, this.col(o.roof || PAL.charcoal, 0.02));
    return ry + rh + 2.4;
  };
  BP.barn = function (cx, cz, w, dp, o) {
    o = o || {}; var wh = o.wh || 3.6, rh = o.rh || 3, y0 = 0.5, x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - dp / 2, z1 = cz + dp / 2;
    var pal = o.pal || PAL.barn, bw = 0.62, dh = Math.min(2.8, wh * 0.78), dw = Math.min(2.6, w * 0.42), self = this;
    this.rect(x0, z0, x1, z1, 0, 1, { h: 0.5, d: 0.6, len: 1.0 });
    function side(ax, az, bx, bz, door) {
      var L = Math.hypot(bx - ax, bz - az), n = Math.round(L / bw), ux = (bx - ax) / L, uz = (bz - az) / L, q = qY(-Math.atan2(uz, ux));
      for (var i = 0; i < n; i++) {
        var tt = (i + 0.5) * L / n; if (door && Math.abs(tt - L / 2) < dw / 2) continue;
        self.add('block', ax + ux * tt, y0 + wh / 2, az + uz * tt, L / n - 0.04, wh, 0.22, q, self.col(self.pick(pal), 0.03));
      }
    }
    side(x0, z1 - 0.15, x1, z1 - 0.15, true);
    side(x1 - 0.15, z1, x1 - 0.15, z0, false);
    side(x1, z0 + 0.15, x0, z0 + 0.15, false);
    side(x0 + 0.15, z0, x0 + 0.15, z1, false);
    this.add('block', cx - dw / 4, y0 + dh / 2, z1 - 0.12, dw / 2 - 0.06, dh, 0.14, null, this.col(PAL.woodDark, 0));
    this.add('block', cx + dw / 4, y0 + dh / 2, z1 - 0.12, dw / 2 - 0.06, dh, 0.14, null, this.col(PAL.woodDark, 0));
    var nTop = Math.max(1, Math.round(dw / bw));
    for (var i = 0; i < nTop; i++) this.add('block', cx - dw / 2 + (i + 0.5) * dw / nTop, y0 + dh + (wh - dh) / 2, z1 - 0.15, dw / nTop - 0.04, wh - dh, 0.22, null, this.col(this.pick(pal), 0.03));
    var gy = y0 + wh;
    [z1 - 0.15, z0 + 0.15].forEach(function (zz) {
      var n = Math.round(w / bw);
      for (var i = 0; i < n; i++) {
        var xx = x0 + (i + 0.5) * w / n, hb = rh * (1 - Math.abs(xx - cx) / (w / 2)) - 0.15;
        if (hb < 0.3) continue;
        self.add('block', xx, gy + hb / 2, zz, w / n - 0.04, hb, 0.22, null, self.col(self.pick(pal), 0.03));
      }
    });
    this.add('block', cx, gy + rh * 0.42, z1 - 0.05, 0.8, 0.8, 0.12, null, this.col(PAL.woodDark, 0));
    this.unit(function () { this.gable(cx, gy - 0.05, cz, dp + 0.9, w + 1.0, rh + 0.3, this.col(o.roof || PAL.slate, 0.02), Math.PI / 2); });
    return gy + rh + 0.25;
  };
  BP.panels = function (ax, az, bx, bz, y0, rows, ph, hole) {
    var dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, q = qY(-Math.atan2(uz, ux)), n = Math.max(1, Math.round(L / 1.0));
    for (var r = 0; r < rows; r++) for (var i = 0; i < n; i++) {
      var t = (i + 0.5) * L / n, px = ax + ux * t, pz = az + uz * t, y = y0 + (r + 0.5) * ph;
      if (hole && hole(px, pz, y)) continue;
      this.add('block', px, y, pz, L / n - 0.05, ph - 0.05, 0.32, q, this.col(this.pick(PAL.plaster), 0.01));
    }
  };

  // ---------------------------------------------------------------- the builds
  var GEN = {};
  GEN.fortress = function (b) {
    var roof = b.pick([PAL.slate, PAL.charcoal, PAL.teal]), tc = 14 + Math.floor(b.r() * 3), kc = 18 + Math.floor(b.r() * 3);
    var TX = 10.3, TZ = 1.8, R = 2.4;
    function tower(key, name, cx) {
      b.part(key, name);
      var top = b.ring(cx, TZ, R, 0, tc, { core: PAL.core, hole: function (a, y) { return Math.abs(angDiff(a, Math.PI / 2)) < 0.2 && ((y > 2.4 && y < 3.8) || (y > 5.4 && y < 6.8)); } });
      top = b.ring(cx, TZ, R + 0.28, top, 1, { len: 0.95, h: 0.5, d: 1.0, core: PAL.core });
      var rh = 4.4 + b.r() * 0.8;
      b.unit(function () { b.cone(cx, top - 0.05, TZ, R + 0.85, rh, b.col(roof, 0.02)); });
      b.pennant(cx, top + rh - 0.4, TZ, PAL.ink);
    }
    function curtain(key, name, ax, az, bx, bz) {
      b.part(key, name);
      var top = b.wall(ax, az, bx, bz, 0, 10, { d: 0.7, len: 1.0 }), dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
      b.add('block', (ax + bx) / 2, top + 0.1, (az + bz) / 2, L, 0.2, 1.45, qY(-Math.atan2(dz, dx)), b.stoneCol());
      b.merlons(ax, az, bx, bz, top + 0.2, { off: 0.42, d: 0.5 });
    }
    tower('lt', 'Left tower', -TX);
    var u = [6.3, -2.8], ul = Math.hypot(u[0], u[1]); u = [u[0] / ul, u[1] / ul];
    curtain('ww', 'West wall', -TX + u[0] * (R - 0.5), TZ + u[1] * (R - 0.5), -4.1, -1.6);
    b.part('kp', 'Keep and gate');
    var x0 = -4, x1 = 4, z0 = -8, z1 = -1, d = 0.85;
    var top = b.rect(x0, z0, x1, z1, 0, kc, { d: d, len: 1.1, core: PAL.core,
      hole: function (px, pz, y) {
        var front = pz > z1 - d - 0.01, back = pz < z0 + d + 0.01;
        if (front && Math.abs(px) < 1.25 && y < 3.3) return true;
        if ((front || back) && y > 7.3 && y < 8.7 && Math.abs(Math.abs(px) - 2.2) < 0.5) return true;
        if (!front && !back && y > 7.3 && y < 8.7 && Math.abs(pz - (z0 + z1) / 2) < 0.5) return true;
        return false;
      },
      onCourse: function (k) { if (k === 5) this.add('block', 0, 1.6, z1 - d / 2, 2.4, 3.2, 0.3, null, this.col(PAL.woodDark, 0)); }
    });
    b.add('block', 0, top + 0.1, (z0 + z1) / 2, x1 - x0, 0.2, z1 - z0, null, b.stoneCol());
    b.merlons(x0, z1 - 0.3, x1, z1 - 0.3, top + 0.2, { d: 0.55 });
    b.merlons(x1 - 0.3, z1, x1 - 0.3, z0, top + 0.2, { d: 0.55 });
    b.merlons(x1, z0 + 0.3, x0, z0 + 0.3, top + 0.2, { d: 0.55 });
    b.merlons(x0 + 0.3, z0, x0 + 0.3, z1, top + 0.2, { d: 0.55 });
    var tt = b.ring(x0 + 1.3, z0 + 1.3, 1.05, top + 0.2, 5, { len: 0.8, h: 0.55, d: 0.6, core: PAL.core });
    b.unit(function () { b.cone(x0 + 1.3, tt - 0.05, z0 + 1.3, 1.6, 2.8, b.col(roof, 0.02)); });
    curtain('ew', 'East wall', 4.1, -1.6, TX - u[0] * (R - 0.5), TZ + u[1] * (R - 0.5));
    tower('rt', 'Right tower', TX);
    b.part('fin', 'Banner', { hidden: true });
    b.unit(function () {
      b.post(0.8, top + 0.2, (z0 + z1) / 2 + 0.6, 0.09, 4.6, b.col(PAL.woodDark, 0));
      b.add('flag', 0.8, top + 0.2 + 4.6 - 1.35, (z0 + z1) / 2 + 0.6, 2.5, 1.35, 1, null, b.col(PAL.ink, 0), { flag: 1 });
    });
    return { door: [0, -0.4] };
  };
  GEN.outpost = function (b) {
    b.part('tw', 'Watchtower');
    var top = b.timberTower(-3, -2.8, { size: 1.5, h: 8, roof: b.pick([PAL.charcoal, PAL.slate]) });
    b.pennant(-3, top - 0.35, -2.8, PAL.ink);
    b.part('pl', 'Palisade');
    b.palisade(0, 0, 8.4, 0.3);
    b.part('sf', 'Signal fire');
    b.ring(3.4, -3, 1.15, 0, 2, { len: 0.85, h: 0.45, d: 0.6 });
    for (var L = 0; L < 2; L++) for (var i = 0; i < 2; i++) {
      var o = i ? 0.32 : -0.32, y = 0.98 + L * 0.28;
      if (L === 0) b.beam(3.4 - 0.85, y, -3 + o, 3.4 + 0.85, y, -3 + o, 0.14, b.col(b.pick(PAL.wood), 0.03));
      else b.beam(3.4 + o, y, -3 - 0.85, 3.4 + o, y, -3 + 0.85, 0.14, b.col(b.pick(PAL.wood), 0.03));
    }
    b.part('fin', 'Fire', { hidden: true });
    b.flame(3.4, 1.25, -3, 1);
    return { door: [0, 8.4] };
  };
  GEN.farm = function (b) {
    var roof = b.pick([PAL.slate, PAL.charcoal]);
    b.part('bn', 'Barn');
    var rt = b.barn(-4.5, -4.5, 8, 6.5, { roof: roof });
    b.part('fc', 'Fence');
    b.fence([[0.6, 2.6], [0.6, -1.6], [11, -1.6], [11, 10.5], [0.6, 10.5], [0.6, 4.4]], false);
    b.part('hd', 'Herd');
    var spots = [[3, 1.5], [6.5, 0.8], [9, 3.5], [4.2, 5.4], [7.6, 6.9], [3.4, 8.6], [9.1, 8.9], [5.6, 3.2]];
    for (var i = 0; i < 6; i++) b.sheep(spots[i][0] + b.j(0.4), spots[i][1] + b.j(0.4), b.r() * Math.PI * 2);
    b.part('hy', 'Hay');
    var rows = [5, 4, 3];
    for (var r = 0; r < rows.length; r++) for (var k = 0; k < rows[r]; k++) b.bale(-10.2 + k * 1.2 + r * 0.6, 0.35 + r * 0.68, 3.4, 0);
    b.part('fin', 'Pennant', { hidden: true });
    b.pennant(-4.5, rt - 0.3, -1.7, PAL.ink);
    return { door: [-4.5, -1.0] };
  };
  GEN.windmill = function (b) {
    var roof = b.pick([PAL.slate, PAL.terracotta, PAL.charcoal]), zc = -1.5;
    b.part('tw', 'Mill tower');
    var top = b.ring(0, zc, 2.5, 0, 15, { r1: 1.85, len: 1.05, core: PAL.core, hole: function (a, y) {
      var f = Math.abs(angDiff(a, Math.PI / 2));
      return (f < 0.3 && y < 2.2) || (f < 0.18 && y > 5.2 && y < 6.4) || (Math.abs(angDiff(a, -Math.PI / 2)) < 0.18 && y > 3.6 && y < 4.6);
    }, onCourse: function (k) { if (k === 4) this.add('block', 0, 1.1, zc + 2.35, 1.2, 2.2, 0.2, null, this.col(PAL.woodDark, 0)); } });
    b.part('cap', 'Cap and sails');
    b.unit(function () { b.cone(0, top - 0.1, zc, 2.3, 2.6, b.col(roof, 0.02)); });
    var hub = [0, top - 0.55, zc + 2.45];
    b.add('block', 0, hub[1], zc + 2.1, 0.55, 0.55, 0.9, null, b.col(PAL.woodDark, 0));
    for (var k = 0; k < 4; k++) b.unit(function () {
      var sp = { hub: hub, a0: k * Math.PI / 2 + 0.3 };
      b.add('block', 0, 2.9, 0.05, 0.2, 5.8, 0.16, null, b.col(PAL.woodDark, 0), { spin: sp });
      b.add('block', 0.62, 3.4, 0, 1.0, 4.3, 0.06, null, b.col(b.pick(PAL.canvas), 0), { spin: { hub: hub, a0: sp.a0 } });
    });
    b.part('mh', 'Mill house');
    b.barn(4.9, 1.8, 4.4, 3.6, { wh: 2.4, rh: 1.9, pal: PAL.plank, roof: roof });
    b.part('fin', 'Pennant', { hidden: true });
    b.pennant(0, top + 2.3, zc, PAL.ink);
    return { door: [0, zc + 2.8] };
  };
  GEN.cottage = function (b) {
    var roof = b.pick([PAL.terracotta, PAL.slate, PAL.teal]), W = 6.4, D = 4.6, x0 = -W / 2, x1 = W / 2, z0 = -D / 2 - 1, z1 = D / 2 - 1;
    var rows = 3, ph = 0.9, y0 = 0.5, wt = y0 + rows * ph, ins = 0.28;
    b.part('wl', 'Walls');
    b.rect(x0, z0, x1, z1, 0, 1, { h: 0.5, d: 0.56, len: 0.9 });
    function hole(px, pz, y) {
      var front = pz > z1 - 0.6, back = pz < z0 + 0.6;
      if (front && Math.abs(px) < 0.6 && y < 2.4) return true;
      if ((front || back) && Math.abs(Math.abs(px) - 1.95) < 0.55 && y > 1.4 && y < 2.4) return true;
      if (!front && !back && Math.abs(pz - (z0 + z1) / 2) < 0.55 && y > 1.4 && y < 2.4) return true;
      return false;
    }
    b.panels(x0 + 0.1, z1 - ins, x1 - 0.1, z1 - ins, y0, rows, ph, hole);
    b.panels(x1 - ins, z1 - 0.1, x1 - ins, z0 + 0.1, y0, rows, ph, hole);
    b.panels(x1 - 0.1, z0 + ins, x0 + 0.1, z0 + ins, y0, rows, ph, hole);
    b.panels(x0 + ins, z0 + 0.1, x0 + ins, z1 - 0.1, y0, rows, ph, hole);
    var dark = b.col(PAL.woodDark, 0), glass = b.col(PAL.glass, 0);
    b.unit(function () { [[x0 + 0.1, z1 - 0.1], [x1 - 0.1, z1 - 0.1], [x1 - 0.1, z0 + 0.1], [x0 + 0.1, z0 + 0.1]].forEach(function (c) { b.add('block', c[0], y0 + rows * ph / 2, c[1], 0.3, rows * ph, 0.3, null, dark); }); });
    b.add('block', 0, y0 + 0.95, z1 - ins, 1.15, 1.9, 0.2, null, b.col(PAL.teal, 0.02));
    [[-1.95, z1 - ins, 0], [1.95, z1 - ins, 0], [-1.95, z0 + ins, 0], [1.95, z0 + ins, 0], [x0 + ins, (z0 + z1) / 2, 1], [x1 - ins, (z0 + z1) / 2, 1]].forEach(function (w) {
      b.add('block', w[0], 1.9, w[1], w[2] ? 0.26 : 1.0, 0.85, w[2] ? 1.0 : 0.26, null, glass);
    });
    b.unit(function () {
      b.add('block', 0, wt + 0.1, z1 - 0.1, W, 0.2, 0.25, null, dark); b.add('block', 0, wt + 0.1, z0 + 0.1, W, 0.2, 0.25, null, dark);
      b.add('block', x0 + 0.1, wt + 0.1, (z0 + z1) / 2, 0.25, 0.2, D, null, dark); b.add('block', x1 - 0.1, wt + 0.1, (z0 + z1) / 2, 0.25, 0.2, D, null, dark);
    });
    b.part('rf', 'Roof');
    var rh = 3.0, steps = 5;
    [x0 + ins, x1 - ins].forEach(function (xx) {
      for (var s = 0; s < steps; s++) { var hh = rh / steps, wdt = D * (1 - (s + 0.5) / steps); b.add('block', xx, wt + 0.2 + (s + 0.5) * hh, (z0 + z1) / 2, 0.3, hh - 0.04, wdt, null, b.col(b.pick(PAL.plaster), 0.01)); }
    });
    var cx = x1 - 1.4, cz = z0 + 1.1;
    var ct = b.rect(cx - 0.5, cz - 0.5, cx + 0.5, cz + 0.5, wt - 0.4, 7, { h: 0.55, d: 0.5, len: 0.55 });
    b.unit(function () { b.gable(0, wt + 0.15, (z0 + z1) / 2, W + 0.9, D + 1.1, rh + 0.3, b.col(roof, 0.02)); });
    b.part('gd', 'Garden');
    b.fence([[x0 - 1.2, z1 + 2.4], [-0.9, z1 + 2.4]], false);
    b.fence([[0.9, z1 + 2.4], [x1 + 1.2, z1 + 2.4]], false);
    for (var f = 0; f < 10; f++) b.add('ball', x0 + 0.4 + f * 0.62, 0.3, z1 + 0.65, 0.28, 0.24, 0.28, null, b.col(f % 3 === 0 ? PAL.flower[1] : b.pick(PAL.leaf), 0.03));
    b.unit(function () { b.add('block', x1 + 1.6, 0.5, z1 - 0.2, 1.8, 0.14, 0.5, qY(Math.PI / 2), b.col(PAL.plank[0], 0)); b.post(x1 + 1.6, 0, z1 - 0.9, 0.06, 0.45, dark); b.post(x1 + 1.6, 0, z1 + 0.5, 0.06, 0.45, dark); });
    b.tree(x0 - 2.2, z0 + 0.8, 0.95);
    b.part('fin', 'Smoke', { hidden: true });
    b.smoke(cx, ct + 0.2, cz);
    return { door: [0, z1 + 0.3] };
  };
  GEN.forge = function (b) {
    var roof = b.pick([PAL.slate, PAL.charcoal]), x0 = -3, x1 = 3, z0 = -3.4, z1 = 1.2;
    b.part('wl', 'Walls');
    var top = b.rect(x0, z0, x1, z1, 0, 5, { d: 0.75, len: 1.0, core: PAL.core, hole: function (px, pz, y) {
      var front = pz > z1 - 0.8;
      return (front && Math.abs(px + 0.9) < 0.65 && y < 2.2) || (front && Math.abs(px - 1.5) < 0.5 && y > 1.2 && y < 2.3);
    }, onCourse: function (k) { if (k === 3) this.add('block', -0.9, 1.1, z1 - 0.38, 1.2, 2.2, 0.2, null, this.col(PAL.woodDark, 0)); } });
    b.part('ch', 'Chimney');
    var ct = b.rect(0.6, z0 - 1.0, 1.9, z0 + 0.25, 0, 11, { h: 0.6, d: 0.5, len: 0.65 });
    b.part('rf', 'Roof and anvil');
    b.unit(function () { b.gable(0, top - 0.05, (z0 + z1) / 2, x1 - x0 + 0.8, z1 - z0 + 1.0, 2.3, b.col(roof, 0.02)); });
    b.unit(function () { b.add('block', -2.4, 0.45, z1 + 1.6, 0.6, 0.9, 0.5, null, b.col('#4a4b4e', 0)); b.add('block', -2.4, 1.0, z1 + 1.6, 1.2, 0.3, 0.45, null, b.col('#55575b', 0)); });
    b.unit(function () { b.add('block', 2.0, 0.4, z1 + 1.5, 1.8, 0.8, 0.8, null, b.col(PAL.plank[1], 0)); b.add('disc', 2.0, 0.81, z1 + 1.5, 0.75, 0.04, 0.3, null, b.col(PAL.water, 0)); });
    b.part('fin', 'Smoke', { hidden: true });
    b.smoke(1.25, ct + 0.2, z0 - 0.38);
    return { door: [-0.9, z1 + 0.4] };
  };
  GEN.well = function (b) {
    var roof = b.pick([PAL.terracotta, PAL.slate, PAL.teal]);
    b.part('rg', 'Stone ring');
    var top = b.ring(0, 0, 1.4, 0, 3, { len: 0.8, h: 0.45, d: 0.55 });
    b.add('disc', 0, top - 0.35, 0, 1.15, 0.05, 1.15, null, b.col('#5f8e95', 0));
    b.part('fr', 'Frame');
    var dark = b.col(PAL.wood[1], 0);
    b.post(-1.6, 0, 0, 0.13, 3.1, dark); b.post(1.6, 0, 0, 0.13, 3.1, dark);
    b.beam(-1.75, 2.85, 0, 1.75, 2.85, 0, 0.11, dark);
    b.unit(function () { b.post(0.2, 1.6, 0, 0.025, 1.2, b.col('#d8cbb0', 0)); b.post(0.2, 1.25, 0, 0.24, 0.38, b.col(PAL.wood[2], 0)); });
    b.part('rf', 'Roof');
    b.unit(function () { b.gable(0, 3.0, 0, 3.9, 2.6, 1.15, b.col(roof, 0.02)); });
    b.part('fin', 'Pennant', { hidden: true });
    b.pennant(0, 4.0, 0, PAL.ink);
    return { door: [0, 1.8] };
  };
  GEN.watchtower = function (b) {
    b.part('lg', 'Footing and legs');
    b.rect(-2.3, -2.3, 2.3, 2.3, 0, 2, { d: 0.6, len: 0.9, h: 0.5 });
    var top = b.timberTower(0, 0, { size: 1.5, h: 8.4, roof: b.pick([PAL.charcoal, PAL.slate, PAL.terracotta]), sec: function (s) {
      if (s === 'platform') b.part('pf', 'Platform'); else b.part('rf', 'Roof');
    } });
    b.part('fin', 'Pennant', { hidden: true });
    b.pennant(0, top - 0.35, 0, PAL.ink);
    return { door: [0, 2.6] };
  };
  GEN.warcamp = function (b) {
    b.part('pl', 'Palisade');
    b.palisade(0, 0, 11.6, 0.26);
    b.part('gh', 'Gatehouse');
    [-2.3, 2.3].forEach(function (gx) { b.ring(gx, 11.4, 1.25, 0, 10, { len: 0.8, h: 0.55, d: 0.6, core: PAL.core }); });
    b.add('block', 0, 5.75, 11.4, 5.8, 0.5, 1.2, null, b.stoneCol());
    b.unit(function () { b.cone(-2.3, 5.45, 11.4, 1.75, 2.4, b.col(PAL.charcoal, 0.02)); b.cone(2.3, 5.45, 11.4, 1.75, 2.4, b.col(PAL.charcoal, 0.02)); });
    b.part('t1', 'West watchtower');
    b.timberTower(-6.5, -6, { size: 1.3, h: 7 });
    b.part('t2', 'East watchtower');
    b.timberTower(6.5, -6, { size: 1.3, h: 7 });
    b.part('tn', 'Tents');
    var spots = [[-7, 1.2, 0.3], [-3.6, 4.4, -0.2], [0, 6.2, 0.05], [3.6, 4.4, 0.2], [7, 1.2, -0.3], [-7.4, 5.6, 0.6], [7.4, 5.6, -0.6], [-2.8, -4.4, 0], [2.8, -4.4, 0], [-8.6, -2.2, 1.2], [8.6, -2.2, -1.2], [0, -8.4, 0]];
    spots.forEach(function (s) {
      b.unit(function () {
        b.gable(s[0], 0, s[1], 2.8, 2.7, 2.2, b.col(b.pick(PAL.canvas), 0.02), s[2] + Math.PI / 2, 'tent');
        var c = Math.cos(s[2] + Math.PI / 2), sn = Math.sin(s[2] + Math.PI / 2);
        b.add('block', s[0] + 1.42 * sn, 0.55, s[1] + 1.42 * c, 0.7, 1.1, 0.06, qY(s[2] + Math.PI / 2 + Math.PI / 2), b.col(PAL.woodDark, 0));
      });
    });
    b.part('cf', 'Campfire and stores');
    b.ring(0, 0.2, 1.1, 0, 1, { len: 0.75, h: 0.4, d: 0.5 });
    for (var i = 0; i < 6; i++) b.unit(function () {
      var x = -1.6 + (i % 3) * 1.6, z = -1.8 - Math.floor(i / 3) * 0.3;
      if (i % 2) b.post(x + 4.6, 0, z + 1.2, 0.42, 0.95, b.col(PAL.wood[2], 0.02)); else b.add('block', x - 4.6, 0.45, z + 1.2, 0.95, 0.9, 0.95, qY(b.r()), b.col(b.pick(PAL.plank), 0.03));
    });
    b.part('fin', 'Banner and fire', { hidden: true });
    b.flame(0, 0.3, 0.2, 1.1);
    b.unit(function () { b.post(0, 0, -2.4, 0.1, 7, b.col(PAL.woodDark, 0)); b.add('flag', 0, 7 - 1.4, -2.4, 2.6, 1.4, 1, null, b.col(PAL.ink, 0), { flag: 2 }); });
    return { door: [0, 11.6] };
  };
  GEN.farmstead = function (b) {
    var roof = b.pick([PAL.slate, PAL.charcoal, PAL.teal]);
    b.part('bn', 'Barn');
    var rt = b.barn(-5, -6.2, 9, 7, { wh: 4, rh: 3.4, roof: roof });
    b.part('sl', 'Silo');
    var st = b.ring(2.6, -7.2, 1.7, 0, 15, { len: 0.95, core: PAL.core });
    b.unit(function () { b.add('ball', 2.6, st - 0.1, -7.2, 1.85, 1.5, 1.85, null, b.col(roof, 0.02)); });
    b.part('fd', 'Fields');
    for (var r = 0; r < 6; r++) {
      var z = 0.6 + r * 1.75;
      b.add('block', -6.2, 0.08, z, 10, 0.18, 0.95, null, b.col(PAL.soil, 0.03));
      b.unit(function () { for (var i = 0; i < 9; i++) b.add('ball', -10.6 + i * 1.1 + b.j(0.1), 0.42, z + b.j(0.08), 0.34, 0.36, 0.34, null, b.col(b.pick(PAL.crop), 0.03)); });
    }
    b.part('fc', 'Fence');
    b.fence([[1.2, 4.5], [1.2, -2.4], [12, -2.4], [12, 11.5], [1.2, 11.5], [1.2, 6.4]], false);
    b.part('hd', 'Herd');
    var spots = [[3.5, 0.4], [7, -0.6], [10, 1.8], [4.6, 4.2], [8.2, 4.6], [3.6, 8.4], [7.4, 9.1], [10.3, 7.4]];
    spots.forEach(function (s) { b.sheep(s[0] + b.j(0.4), s[1] + b.j(0.4), b.r() * Math.PI * 2); });
    b.part('fin', 'Pennant', { hidden: true });
    b.pennant(-5, rt - 0.3, -2.9, PAL.ink);
    return { door: [-5, -2.4] };
  };
  var KIND = {
    fortress: { name: 'Stone fortress', line: 'Towers, curtain walls and a keep. Built to hold.' },
    warcamp: { name: 'War camp', line: 'A palisade, two watchtowers and a ring of tents.' },
    farmstead: { name: 'Frontier farmstead', line: 'A barn, a stone silo, six fields and a flock.' },
    windmill: { name: 'Windmill', line: 'A stone mill. Its sails turn once it stands.' },
    farm: { name: 'Farm', line: 'A barn, a fenced pasture, a small flock and hay.' },
    outpost: { name: 'Outpost', line: 'A watchtower inside a palisade, with a signal fire.' },
    cottage: { name: 'Cottage', line: 'Whitewashed walls, a steep roof and a garden.' },
    forge: { name: 'Forge', line: 'A stone smithy with a tall chimney and an anvil.' },
    well: { name: 'Well', line: 'A stone well with a little roof.' },
    watchtower: { name: 'Watchtower', line: 'A timber lookout on a stone footing.' }
  };

  // ---------------------------------------------------------------- nature and the plaza (always standing once the land is there)
  var NAT = {};
  function scatter(b, n, avoid, fn) {
    var placed = 0, tries = 0;
    while (placed < n && tries < n * 30) {
      tries++;
      var x = b.j(12.6), z = b.j(12.6);
      if (avoid && avoid(x, z)) continue;
      fn(x, z); placed++;
    }
  }
  function flowers(b, n, avoid) {
    scatter(b, n, avoid, function (x, z) {
      if (b.r() < 0.4) b.add('tip', x, 0, z, 0.13, 0.5, 0.13, null, b.col(b.pick(PAL.tuft), 0.03));
      else b.add('dot', x, 0.14, z, 0.14, 0.14, 0.14, null, b.col(b.pick(PAL.flower), 0.01));
    });
  }
  function rocks(b, n, avoid) {
    scatter(b, n, avoid, function (x, z) { var s = 0.4 + b.r() * 0.7; b.add('stone', x, s * 0.3, z, s * 1.4, s * 0.8, s, qY(b.r() * 3), b.col(b.pick(PAL.rock), 0.03)); });
  }
  function trees(b, n, avoid, pineShare, minGap) {
    var pts = [];
    scatter(b, n, function (x, z) {
      if (avoid && avoid(x, z)) return true;
      for (var i = 0; i < pts.length; i++) if (Math.hypot(pts[i][0] - x, pts[i][1] - z) < (minGap || 3.4)) return true;
      return false;
    }, function (x, z) { pts.push([x, z]); b.tree(x, z, 0.85 + b.r() * 0.45, b.r() < pineShare ? 'pine' : 'round'); });
  }
  NAT.forest = function (b) { trees(b, 13, null, 0.6, 3.3); rocks(b, 4); flowers(b, 18); };
  NAT.meadow = function (b) { flowers(b, 80); trees(b, 3, null, 0.2, 6); rocks(b, 3); b.bale(4.5, 0.35, -3.5, 0.4); b.bale(5.7, 0.35, -2.8, 0.9); };
  NAT.orchard = function (b) {
    for (var i = 0; i < 3; i++) for (var k = 0; k < 3; k++) b.tree(-7.5 + i * 7.5 + b.j(0.6), -7.5 + k * 7.5 + b.j(0.6), 0.85, 'fruit');
    flowers(b, 30);
  };
  NAT.pond = function (b) {
    b.add('disc', 0, 0.03, 0, 7.4, 0.06, 5.2, null, b.col(PAL.water, 0));
    var n = 34;
    for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; b.add('stone', Math.cos(a) * 7.6, 0.12, Math.sin(a) * 5.4, 1.0 + b.j(0.2), 0.3, 0.7, qY(-a - Math.PI / 2), b.col(b.pick(PAL.rock), 0.03)); }
    for (i = 0; i < 16; i++) { var a2 = b.r() * Math.PI * 2, rr = 0.82 + b.r() * 0.1; b.add('tip', Math.cos(a2) * 7.4 * rr, 0, Math.sin(a2) * 5.2 * rr, 0.08, 1.2 + b.r() * 0.6, 0.08, null, b.col('#6f8f4a', 0.03)); }
    var avoid = function (x, z) { return (x * x) / 81 + (z * z) / 44 < 1; };
    trees(b, 4, avoid, 0.4, 4); flowers(b, 24, avoid);
  };
  function plaza(b) {
    for (var r = 1.6; r <= 6.6; r += 0.95) {
      var n = Math.round(Math.PI * 2 * r / 0.95);
      for (var i = 0; i < n; i++) { var a = (i + (r * 3) % 1) / n * Math.PI * 2; b.add('stone', Math.cos(a) * r, 0.05, Math.sin(a) * r, 0.84, 0.12, 0.74, qY(-a - Math.PI / 2), b.col(b.pick(PAL.path), 0.02)); }
    }
    b.ring(0, 0, 0.85, 0, 2, { len: 0.7, h: 0.42, d: 0.5 });
    b.post(0, 0.8, 0, 0.09, 9, b.col(PAL.woodDark, 0));
    b.add('flag', 0, 9.8 - 1.5, 0, 2.7, 1.5, 1, null, b.col(PAL.orange, 0), { flag: 3 });
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (s) {
      var x = s[0] * 5.4, z = s[1] * 5.4;
      b.post(x, 0, z, 0.08, 2.4, b.col(PAL.woodDark, 0));
      b.add('block', x, 2.55, z, 0.36, 0.42, 0.36, null, lin(PAL.glow));
    });
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(function (d) { path(b, d[0] * 7.2, d[1] * 7.2, d[0] * 14, d[1] * 14); });
    [[10.5, 10.5], [-10.5, 10.5], [10.5, -10.5], [-10.5, -10.5]].forEach(function (p) { b.tree(p[0] + b.j(1), p[1] + b.j(1), 1.05, 'round'); });
    flowers(b, 40, function (x, z) { return Math.hypot(x, z) < 7.5 || Math.abs(x) < 1.8 || Math.abs(z) < 1.8; });
  }
  // a trail is a dotted ink line, like the dotted route on the Ascent drawing: one hand-placed dot about every metre
  function path(b, ax, az, bx, bz) {
    var L = Math.hypot(bx - ax, bz - az); if (L < 0.5) return;
    var ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux, n = Math.round(L / 0.95), wob = b.r() * 6;
    for (var i = 0; i < n; i++) {
      var t = (i + 0.5) * L / n + b.j(0.05), o = Math.sin(wob + t * 0.35) * 0.18 + b.j(0.04), r = 0.2 + b.j(0.02);
      b.add('dot', ax + ux * t + nx * o, 0.03, az + uz * t + nz * o, r, 0.06, r, null, b.col(PAL.dot, 0));
    }
  }

  // ---------------------------------------------------------------- the village plan, from his quests
  function stepDay(st) { return st.done_on ? clamp(dayIndex(st.done_on, data.day0), 0, MAXDAY) : Infinity; }
  data.builds.forEach(function (b) { b.camps.forEach(function (c) { c.steps.forEach(function (st) { st._d = stepDay(st); }); }); });
  // a build stands on the map from the day it was made, or from its first step if that came sooner
  function fromDay(b) {
    var d = b.made ? clamp(dayIndex(b.made, data.day0), 0, MAXDAY) : 0;
    b.camps.forEach(function (c) { c.steps.forEach(function (st) { if (st._d < d) d = st._d; }); });
    return d;
  }
  var QUESTS = data.builds.map(function (b) {
    return { id: b.id, name: b.name, label: shortName(b.name), type: b.type, goal: b.goal, note: b.note, kind: b.kind, seed: b.seed, plot: b.plot, tile: tileOf(b.plot), from: fromDay(b), camps: b.camps, real: true };
  });
  var BYPLOT = {}; QUESTS.forEach(function (q) { BYPLOT[q.plot] = q; });
  var WAITING = data.waiting, PLOT_TILE_AT = WAITING.length ? tileOf(data.nextPlot) : null;
  var LAYOUT = layout(Math.max(data.nextPlot + 2, QUESTS.reduce(function (m, q) { return Math.max(m, q.plot + 1); }, 0)));
  // the woods, orchard, pond and meadow are there from the start; more green comes with the builds further out
  var NATURE = NATURE_START.map(function (n) { return { tile: n.tile, kind: n.kind, day: 0 }; }).concat(LAYOUT.nature.map(function (n) {
    var q = BYPLOT[n.withPlot]; return { tile: n.tile, kind: n.nature, day: q ? q.from : Infinity };
  }));
  // the next plot after the one waiting for Generate project, staked in pencil
  var NEXT_AT = tileOf(WAITING.length ? data.nextPlot + 1 : data.nextPlot);
  // one soldier for each bullseye loosed on The Mark, from the day it landed
  var BULLS = data.bullseyes.map(function (d) { return clamp(dayIndex(d, data.day0), 0, MAXDAY); });
  function soldiers(d) { var n = 0; for (var i = 0; i < BULLS.length; i++) if (BULLS[i] <= d) n++; return n; }
  function stepsDone(s, d) { if (d < s.start) return 0; return Math.min(s.steps, Math.round(s.rate * (d - s.start))); }
  function partDone(P, d) { if (!P.list) return stepsDone(P.sched, d); var n = 0; for (var i = 0; i < P.list.length; i++) if (P.list[i]._d <= d) n++; return n; }
  function standing(P) { return P.steps > 0 && P.done >= P.steps; }
  function faceCenter(tile) { var dx = -tile[0], dz = -tile[1]; if (Math.abs(dx) >= Math.abs(dz)) return dx > 0 ? Math.PI / 2 : -Math.PI / 2; return dz > 0 ? 0 : Math.PI; }

  // ---------------------------------------------------------------- geometry, materials, pools
  function roundedBox(r, seg) {
    var g = new T.BoxGeometry(1, 1, 1, seg, seg, seg), p = g.attributes.position, nrm = g.attributes.normal, h = 0.5 - r;
    var v = new T.Vector3(), c = new T.Vector3();
    // the face each vertex belongs to (the box's own flat normal): the wash is lit per face, so a stone's rounded
    // edges don't each catch their own light and shade, and a wall reads as one sunlit or shaded plane
    g.setAttribute('inkFace', nrm.clone());
    function remap(u) { var a = Math.abs(u); if (a < 1e-4) return 0; if (a < 0.45) return Math.sign(u) * (h + 0.6 * r); return Math.sign(u) * 0.5; }
    for (var i = 0; i < p.count; i++) {
      v.set(remap(p.getX(i)), remap(p.getY(i)), remap(p.getZ(i)));
      c.set(clamp(v.x, -h, h), clamp(v.y, -h, h), clamp(v.z, -h, h));
      v.sub(c); if (v.lengthSq() < 1e-9) v.set(0, 1, 0); v.normalize();
      nrm.setXYZ(i, v.x, v.y, v.z);
      p.setXYZ(i, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r);
    }
    return g;
  }
  function coneGeo(seg) { var g = new T.ConeGeometry(1, 1, seg, 1); g.translate(0, 0.5, 0); return g; }
  function pyrGeo() { var g = new T.ConeGeometry(1, 1, 4, 1); g.rotateY(Math.PI / 4); g.translate(0, 0.5, 0); return g; }
  function gableGeo() {
    var P = [], N = [], U = [];
    function tri(a, b, c, n, ua, ub, uc) { P.push.apply(P, a.concat(b, c)); for (var i = 0; i < 3; i++) N.push.apply(N, n); U.push.apply(U, ua.concat(ub, uc)); }
    var s = 1 / Math.sqrt(1.25), nf = [0, 0.5 * s, 1 * s], nb = [0, 0.5 * s, -1 * s];
    tri([-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 1, 0], nf, [0, 0], [1, 0], [1, 1]);
    tri([-0.5, 0, 0.5], [0.5, 1, 0], [-0.5, 1, 0], nf, [0, 0], [1, 1], [0, 1]);
    tri([0.5, 0, -0.5], [-0.5, 0, -0.5], [-0.5, 1, 0], nb, [0, 0], [1, 0], [1, 1]);
    tri([0.5, 0, -0.5], [-0.5, 1, 0], [0.5, 1, 0], nb, [0, 0], [1, 1], [0, 1]);
    tri([-0.5, 0, -0.5], [-0.5, 0, 0.5], [-0.5, 1, 0], [-1, 0, 0], [0, 0], [0.3, 0], [0.15, 0.3]);
    tri([0.5, 0, 0.5], [0.5, 0, -0.5], [0.5, 1, 0], [1, 0, 0], [0, 0], [0.3, 0], [0.15, 0.3]);
    tri([-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [0, -1, 0], [0, 0], [0, 0], [0, 0]);
    tri([-0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5], [0, -1, 0], [0, 0], [0, 0], [0, 0]);
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(U, 2));
    return g;
  }
  function pennantGeo() {
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 1, 0.5, 0, 0, 1, 0], 3));
    g.setAttribute('normal', new T.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    return g;
  }
  var maxAniso = renderer.capabilities.getMaxAnisotropy();
  function canvasTex(w, h, draw, rx, ry) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx || 1, ry || 1);
    t.encoding = T.sRGBEncoding; t.anisotropy = Math.min(8, maxAniso);
    return t;
  }
  // roof courses drawn as pen lines over the charcoal wash
  function shingle(rx, ry) {
    return canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      var rows = 4, rh = h / rows;
      for (var r = 0; r < rows; r++) {
        var y = r * rh, off = (r % 2) * 16;
        g.fillStyle = 'rgba(20,20,20,0.34)'; g.fillRect(0, y + rh - 2.5, w, 2.5);
        g.fillStyle = 'rgba(20,20,20,0.18)';
        for (var x = off; x < w + 32; x += 32) g.fillRect(x - 0.75, y + rh * 0.3, 1.5, rh * 0.7);
      }
    }, rx, ry);
  }
  // an irregular watercolour blot: translucent fill with a slightly darker rim where the pigment pools
  function blot(g, R, x, y, r, rgb, a) {
    var n = 18, pts = [], k, ph = R() * 6, ph2 = R() * 6;
    for (k = 0; k < n; k++) { var t = k / n * Math.PI * 2, rr = r * (0.78 + 0.16 * Math.sin(t * 2 + ph) + 0.09 * Math.sin(t * 5 + ph2) + R() * 0.06); pts.push([x + Math.cos(t) * rr, y + Math.sin(t) * rr * (0.7 + R() * 0.05)]); }
    g.beginPath();
    for (k = 0; k <= n; k++) { var p0 = pts[k % n], p1 = pts[(k + 1) % n], mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2; if (k === 0) g.moveTo(mx, my); else g.quadraticCurveTo(p0[0], p0[1], mx, my); }
    g.closePath();
    g.fillStyle = 'rgba(' + rgb + ',' + a + ')'; g.fill();
    g.lineWidth = 2.5 + R() * 2; g.strokeStyle = 'rgba(' + rgb.split(',').map(function (v) { return Math.round(v * 0.9); }).join(',') + ',' + (a * 0.9) + ')'; g.stroke();
  }
  // land: a sage watercolour wash on paper, with paler patches where the paper shows, a few ochre blooms,
  // pen grass ticks and a little stipple (like map symbols for grassland)
  function landTex(seed) {
    return canvasTex(1024, 1024, function (g, w, h) {
      var R = rng(seed), i;
      g.fillStyle = '#d6dfca'; g.fillRect(0, 0, w, h);
      for (i = 0; i < 24; i++) blot(g, R, R() * w, R() * h, 70 + R() * 190, R() < 0.6 ? '184,202,174' : '236,239,230', 0.3 + R() * 0.22);
      for (i = 0; i < 4; i++) blot(g, R, R() * w, R() * h, 50 + R() * 110, '208,198,156', 0.12 + R() * 0.04);
      for (i = 0; i < 12; i++) blot(g, R, R() * w, R() * h, 30 + R() * 70, '174,193,158', 0.22);
      g.lineCap = 'round';
      for (i = 0; i < 130; i++) {
        var x = 20 + R() * (w - 40), y = 20 + R() * (h - 40), s = 0.8 + R() * 0.6;
        g.strokeStyle = 'rgba(58,68,50,' + (0.32 + R() * 0.2) + ')'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x - 3 * s, y); g.lineTo(x - 6.5 * s, y - 8 * s); g.moveTo(x, y + 0.5); g.lineTo(x + 0.5 * s, y - 11 * s); g.moveTo(x + 3 * s, y); g.lineTo(x + 7 * s, y - 7.5 * s); g.stroke();
      }
      for (i = 0; i < 260; i++) { g.fillStyle = 'rgba(66,74,58,' + (0.1 + R() * 0.18) + ')'; g.beginPath(); g.arc(R() * w, R() * h, 0.9 + R() * 0.9, 0, 7); g.fill(); }
    }, 1, 1);
  }
  // the side of each plot is a block-diagram section: paper, a thin turf layer and pen strata
  // (drawn on a 160px-high design, squeezed into 128px so the texture stays a power of two for WebGL1)
  var sideTex = canvasTex(1024, 128, function (g, w) {
    var R = rng(8), i, x, h = 160;
    g.scale(1, 128 / 160);
    g.fillStyle = '#efe8dc'; g.fillRect(0, 0, w, h);
    for (i = 0; i < 26; i++) { g.fillStyle = 'rgba(' + (R() < 0.5 ? '214,198,172' : '246,242,234') + ',' + (0.2 + R() * 0.25) + ')'; g.beginPath(); g.ellipse(R() * w, 30 + R() * 110, 40 + R() * 120, 8 + R() * 18, (R() - 0.5) * 0.1, 0, 7); g.fill(); }
    g.fillStyle = '#ccd8b6'; g.fillRect(0, 0, w, 15);
    function stratum(y0, amp, a, lw) {
      g.strokeStyle = 'rgba(40,40,38,' + a + ')'; g.lineWidth = lw; g.beginPath();
      var ph = R() * 6;
      for (x = 0; x <= w; x += 8) { var y = y0 + Math.sin(x / 90 + ph) * amp + Math.sin(x / 23 + ph * 2) * amp * 0.3; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
    }
    stratum(15, 0.6, 0.5, 1.6); stratum(82, 14, 0.3, 1.5);
    for (i = 0; i < 380; i++) { var yy = 22 + R() * 60; g.fillStyle = 'rgba(50,50,46,' + (0.1 + R() * 0.2) + ')'; g.beginPath(); g.arc(R() * w, yy, 0.8 + R() * 1.2, 0, 7); g.fill(); }
    for (i = 0; i < 34; i++) { var cx = R() * w, cy = 100 + R() * 50, rr = 3 + R() * 6; g.fillStyle = 'rgba(255,255,255,0.7)'; g.strokeStyle = 'rgba(40,40,38,0.32)'; g.lineWidth = 1.3; g.beginPath(); g.ellipse(cx, cy, rr * 1.5, rr, R() - 0.5, 0, 7); g.fill(); g.stroke(); }
  }, 1, 1);
  // water and shields: concentric pen rings (waterlining on the pond, a bullseye on a shield)
  var ringTex = canvasTex(256, 256, function (g, w) {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, w);
    [[0.475, 0.85, 6], [0.405, 0.42, 3], [0.335, 0.3, 2.6], [0.255, 0.2, 2.4], [0.17, 0.12, 2.2]].forEach(function (r) {
      g.strokeStyle = 'rgba(28,30,32,' + r[1] + ')'; g.lineWidth = r[2]; g.beginPath(); g.arc(w / 2, w / 2, r[0] * w, 0, 7); g.stroke();
    });
  }, 1, 1);
  // paper grain, shared by the 3D drawing (sampled in screen space) and the page behind it
  var GRAIN = (function () {
    var n = 256, c = document.createElement('canvas'); c.width = c.height = n;
    var g = c.getContext('2d', { willReadFrequently: true }), R = rng(21), small = document.createElement('canvas'); small.width = small.height = 64;
    var sg = small.getContext('2d'), id = sg.createImageData(64, 64), i;
    for (i = 0; i < 64 * 64; i++) { var v = 200 + R() * 55; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
    sg.putImageData(id, 0, 0);
    g.imageSmoothingEnabled = true; g.drawImage(small, 0, 0, n, n);
    var big = g.getImageData(0, 0, n, n);
    for (i = 0; i < n * n; i++) { var f = (R() - 0.5) * 36; for (var k = 0; k < 3; k++) big.data[i * 4 + k] = Math.max(0, Math.min(255, big.data[i * 4 + k] + f)); }
    g.putImageData(big, 0, 0);
    for (i = 0; i < 90; i++) { g.strokeStyle = 'rgba(150,150,150,0.25)'; g.lineWidth = 0.6; g.beginPath(); var x = R() * n, y = R() * n, a = R() * 6; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * (4 + R() * 9), y + Math.sin(a) * (4 + R() * 9)); g.stroke(); }
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.minFilter = T.LinearFilter; t.generateMipmaps = false;
    // the page gets the same grain as dark specks at low alpha
    var css = document.createElement('canvas'); css.width = css.height = n;
    var cg = css.getContext('2d'), out = cg.createImageData(n, n), src = g.getImageData(0, 0, n, n);
    for (i = 0; i < n * n; i++) { out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = 30; out.data[i * 4 + 3] = Math.max(0, 255 - src.data[i * 4]) * 0.16; }
    cg.putImageData(out, 0, 0);
    try { $('grain').style.backgroundImage = 'url(' + css.toDataURL('image/png') + ')'; } catch (e) { /* the page is fine without it */ }
    return t;
  })();
  // pigment, drawn once at load: one tileable 256px field sampled in world space by every wash.
  // R = granulation (pigment settling in the paper's tooth), G = wash mottling (low frequency), B = a second, independent mottle.
  function tnoise(N, cells, wts, seed) {
    var out = new Float32Array(N * N), R = rng(seed);
    for (var o = 0; o < cells.length; o++) {
      var C = cells[o], grid = new Float32Array(C * C), w = wts[o], s = C / N, k;
      for (k = 0; k < C * C; k++) grid[k] = R();
      for (var y = 0; y < N; y++) {
        var fy = y * s, iy = Math.floor(fy), ty = fy - iy; ty = ty * ty * (3 - 2 * ty);
        var r0 = (iy % C) * C, r1 = ((iy + 1) % C) * C;
        for (var x = 0; x < N; x++) {
          var fx = x * s, ix = Math.floor(fx), tx = fx - ix; tx = tx * tx * (3 - 2 * tx);
          var c0 = ix % C, c1 = (ix + 1) % C, a = grid[r0 + c0], b = grid[r0 + c1], c = grid[r1 + c0], d = grid[r1 + c1];
          var top = a + (b - a) * tx; out[y * N + x] += w * (top + ((c + (d - c) * tx) - top) * ty);
        }
      }
    }
    return out;
  }
  function stretch(a) { var lo = 1e9, hi = -1e9, i; for (i = 0; i < a.length; i++) { if (a[i] < lo) lo = a[i]; if (a[i] > hi) hi = a[i]; } for (i = 0; i < a.length; i++) a[i] = (a[i] - lo) / (hi - lo || 1); return a; }
  var pigTex = (function () {
    var N = 256, c = document.createElement('canvas'); c.width = c.height = N;
    var g = c.getContext('2d'), i;
    var gran = tnoise(N, [16, 32, 64, 128], [0.12, 0.3, 0.33, 0.25], 5), mot = stretch(tnoise(N, [2, 4, 8, 16], [0.46, 0.28, 0.17, 0.09], 9)), mot2 = stretch(tnoise(N, [3, 6, 12], [0.55, 0.3, 0.15], 13));
    var img = g.createImageData(N, N), d = img.data;
    for (i = 0; i < N * N; i++) {
      d[i * 4] = Math.max(0, Math.min(1, (gran[i] - 0.5) * 3.4 + 0.32)) * 255; d[i * 4 + 1] = mot[i] * 255; d[i * 4 + 2] = mot2[i] * 255; d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = Math.min(4, maxAniso);
    return t;
  })();

  // ------------------------------------------------------------ ink and watercolour shading
  // Every solid is a Lambert material whose final colour is rewritten as a watercolour wash under pen work:
  // a flat local wash that lets the paper through on sunlit tops, a deeper, cooler glaze on the side away from the sun
  // and in cast shadow (its boundary wobbles with the pigment, like a brushed edge), granulation that settles more in the
  // shade, pigment pooling along the edges of every block, a slow warm/cool temperature drift across the village, and
  // pen hatching (screen-space diagonals, like the Ascent mountain's shadow side) over the shade. Plots also get pen edges.
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  function sq(hex) { var c = lin(hex); return new T.Vector3(Math.sqrt(c.r), Math.sqrt(c.g), Math.sqrt(c.b)); }
  var INK = {
    uSunV: { value: new T.Vector3(0, 1, 0) }, uUpV: { value: new T.Vector3(0, 1, 0) }, uCamW: { value: new T.Vector3(0, 300, 0) }, uSunW: { value: new T.Vector3(0, 1, 0) },
    uRes: { value: new T.Vector2(1, 1) }, uDpr: { value: DPR }, uGrain: { value: GRAIN },
    uInk: { value: new T.Vector3(0.12, 0.12, 0.115) }, uPig: { value: pigTex }, uPaper: { value: sq('#f6f4ef') },
    uWarm: { value: sq('#efe6d2') }, uCool: { value: sq('#dde4e6') }, uHatchMove: { value: 1 },
    // the shade glaze (a cooler, deeper second wash) and the soft warm light on faces turned to the sun, in wash space
    uShade: { value: new T.Vector3(0.7, 0.735, 0.835) }, uSunTint: { value: sq('#fcf5e6') }
  };
  var INK_FRAG_PARS = [
    'uniform vec3 uSunV; uniform vec3 uUpV; uniform vec3 uCamW; uniform vec2 uRes; uniform float uDpr; uniform sampler2D uGrain; uniform vec3 uInk;',
    'uniform sampler2D uPig; uniform vec3 uPaper; uniform vec3 uWarm; uniform vec3 uCool; uniform float uHatchMove; uniform vec3 uShade; uniform vec3 uSunTint;',
    'uniform float uHatchK; uniform float uEdgeW; uniform float uEdgeA; uniform float uDash;',
    'varying vec3 vInkN; varying vec3 vInkW;',
    '#ifdef INK_BOX',
    'varying vec3 vInkO; varying vec3 vInkS;',
    '#endif',
    'float inkHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }',
    'float inkLines(vec2 p, float gap, float w) {',
    '  float t = fract((p.x + p.y) / (gap * 1.41421356));',
    '  float f = min(t, 1.0 - t) * gap;',
    '  return 1.0 - smoothstep(w * 0.5 - 0.55, w * 0.5 + 0.55, f);',
    '}',
    '#ifdef INK_LAND',
    // a dried wash leaves a thin darker line where it stopped: the contour of v at t, about 1.5px wide
    'float inkTide(float v, float t) { return 1.0 - smoothstep(0.6, 1.7, abs(v - t) / max(fwidth(v), 1e-4)); }',
    '#endif'
  ].join('\n');
  // the land: one wash texture, laid on each plot turned or flipped one of 8 ways (picked by the plot), so plots never repeat
  var INK_LAND_MAP = [
    '#ifdef INK_LAND',
    '  float lH = inkHash(floor(vInkW.xz / 28.0 + 0.5) + 17.0);',
    '  vec2 lUv = vUv;',
    '  lUv = mix(lUv, lUv.yx, step(0.5, lH));',
    '  lUv.x = mix(lUv.x, 1.0 - lUv.x, step(0.5, fract(lH * 7.0)));',
    '  lUv.y = mix(lUv.y, 1.0 - lUv.y, step(0.5, fract(lH * 13.0)));',
    '  diffuseColor *= mapTexelToLinear(texture2D(map, lUv));',
    '#else',
    '  #include <map_fragment>',
    '#endif'
  ].join('\n');
  var INK_FRAG_MAIN = [
    'vec3 inkN = normalize(vInkN);',
    '#ifdef DOUBLE_SIDED',
    '  inkN *= gl_FrontFacing ? 1.0 : -1.0;',
    '#endif',
    // world-space pigment, sampled three ways and blended by the surface's world normal
    'vec3 inkNw = normalize((vec4(inkN, 0.0) * viewMatrix).xyz);',
    'vec3 inkB = inkNw * inkNw; inkB *= inkB; inkB /= (inkB.x + inkB.y + inkB.z + 1e-5);',
    'vec3 inkP = vInkW * 0.045;',
    '#ifdef INK_BOX',
    // a block face is flat, so one projection (the face's own axis) is exact and saves two fetches
    '  vec3 inkA = abs(inkNw);',
    '  vec4 inkPig = texture2D(uPig, inkA.x > inkA.y && inkA.x > inkA.z ? inkP.zy : (inkA.y > inkA.z ? inkP.xz : inkP.xy));',
    '#else',
    '  vec4 inkPig = texture2D(uPig, inkP.zy) * inkB.x + texture2D(uPig, inkP.xz) * inkB.y + texture2D(uPig, inkP.xy) * inkB.z;',
    '#endif',
    'float inkMot = inkPig.g - 0.5;',
    // light and cast shadow; the edges are nudged by the wash so they read as brushed, not computed
    'float inkSh = smoothstep(0.2, 0.8, inkShadow + inkMot * 0.38);',
    'float inkNL = dot(inkN, uSunV);',
    'float inkLit = smoothstep(-0.04, 0.24, inkNL + inkMot * 0.2) * inkSh;',
    'float inkDark = 1.0 - inkLit;',
    'float inkUp = dot(inkN, uUpV);',
    'vec3 inkG = sqrt(max(diffuseColor.rgb, vec3(0.0)));',
    // temperature drift: the village is washed slightly warmer here, slightly cooler there (a slow wave, no fetch)
    'float inkTmp = 0.5 + 0.25 * sin(vInkW.x * 0.07 + 1.3) * sin(vInkW.z * 0.058 + 0.4) + 0.2 * sin((vInkW.x - vInkW.z) * 0.027);',
    'inkG = mix(inkG, mix(uCool, uWarm, smoothstep(0.3, 0.7, inkTmp)), 0.05);',
    'inkG *= 1.0 + inkMot * 0.09 + (inkPig.b - 0.5) * 0.04;',
    // shade: a second, cooler and deeper glaze of the same pigment, on the side away from the sun and in cast shadow
    'inkG *= mix(uShade, vec3(1.0), inkLit) * mix(0.955, 1.0, clamp(inkUp + 0.4, 0.0, 1.0));',
    '#ifndef INK_LAND',
    // sun: faces turned to it (walls and roof slopes) take a soft warm light, as if the wash were lifted there
    '  float inkSlope = 1.0 - smoothstep(0.75, 1.0, inkUp);',
    '  inkG = mix(inkG, uSunTint, inkLit * inkSlope * (0.11 * smoothstep(0.08, 0.6, inkNL) + 0.16 * smoothstep(0.55, 0.95, inkNL)));',
    '#endif',
    // sunlit tops: the paper shows through the wash
    'inkG = mix(inkG, uPaper, smoothstep(0.55, 0.98, inkUp + inkMot * 0.5) * inkLit * 0.2);',
    // granulation settles in the paper's tooth, more where the wash is deep
    'inkG *= 1.0 - inkPig.r * mix(0.045, 0.085, inkDark);',
    '#ifdef INK_BOX',
    // pigment pools along every edge of a block, where the wash stopped
    '  vec3 inkD = (0.5 - abs(vInkO)) * vInkS;',
    '  float inkMid = inkD.x + inkD.y + inkD.z - min(inkD.x, min(inkD.y, inkD.z)) - max(inkD.x, max(inkD.y, inkD.z));',
    '  inkG *= 1.0 - 0.15 * (1.0 - smoothstep(0.0, 0.07 + 0.12 * inkPig.g, inkMid));',
    '#elif !defined(INK_LAND) && !defined(INK_FLAT)',
    // round things: it pools at the silhouette
    '  float inkRim = 1.0 - abs(dot(inkNw, normalize(uCamW - vInkW)));',
    '  inkG *= 1.0 - 0.12 * smoothstep(0.5, 0.95, inkRim + inkMot * 0.3);',
    '#endif',
    '#ifdef INK_LAND',
    // each plot's wash: soft blooms dropped wet-in-wet that dried with a tide line, and pigment pooled at the plot's edge
    '  float lBig = texture2D(uPig, vInkW.xz / 97.0 + 0.31).g * 0.6 + texture2D(uPig, vInkW.zx / 41.0).b * 0.4;',
    '  float lIn1 = smoothstep(0.6, 0.62, lBig), lIn2 = 1.0 - smoothstep(0.33, 0.35, lBig);',
    '  inkG *= mix(vec3(1.0), vec3(1.02, 1.01, 0.965), lIn1);',
    '  inkG *= mix(vec3(1.0), vec3(0.95, 0.975, 0.985), lIn2);',
    '  inkG *= 1.0 - 0.05 * inkTide(lBig, 0.61) - 0.04 * inkTide(lBig, 0.34);',
    '  vec2 lQ = abs(fract(vInkW.xz / 28.0 + 0.5) - 0.5) * 28.0;',
    '  float lEdge = 14.0 - max(lQ.x, lQ.y) + inkMot * 1.6;',
    '  inkG *= 1.0 - 0.06 * (1.0 - smoothstep(0.0, 2.2, lEdge)) - 0.06 * (1.0 - smoothstep(0.05, 0.45, lEdge));',
    '#endif',
    // pen hatching over the shade; its threshold wobbles with the wash too
    'float inkH = inkLines(gl_FragCoord.xy, 4.0 * uDpr, mix(0.5, 0.85, inkDark) * uDpr) * smoothstep(0.32, 0.82, inkDark + inkMot * 0.14) * uHatchK * uHatchMove;',
    'inkG = mix(inkG, uInk, inkH * 0.34);',
    '#ifdef INK_EDGE',
    '  vec2 eUv = vUv; vec2 eFw = max(fwidth(eUv), vec2(1e-5));',
    '  vec2 ePx = min(eUv, 1.0 - eUv) / eFw;',
    '  float eW = uEdgeW * uDpr;',
    '  float eX = 1.0 - smoothstep(eW - 0.6, eW + 0.6, ePx.x), eY = 1.0 - smoothstep(eW - 0.6, eW + 0.6, ePx.y);',
    '  #ifdef INK_DASH',
    '    eX *= step(0.38, fract(eUv.y * uDash)); eY *= step(0.38, fract(eUv.x * uDash));',
    '  #endif',
    '  inkG = mix(inkG, uInk, max(eX, eY) * uEdgeA);',
    '#endif',
    'float inkGr = texture2D(uGrain, vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / (256.0 * uDpr)).r;',
    'inkG *= 0.955 + 0.045 * inkGr;',
    'gl_FragColor = vec4(inkG * inkG, diffuseColor.a);'
  ].join('\n');
  function inkCompile(sh) {
    var ud = this.userData;
    ['uSunV', 'uUpV', 'uCamW', 'uRes', 'uDpr', 'uGrain', 'uInk', 'uPig', 'uPaper', 'uWarm', 'uCool', 'uHatchMove', 'uShade', 'uSunTint'].forEach(function (k) { sh.uniforms[k] = INK[k]; });
    sh.uniforms.uHatchK = { value: ud.hatch }; sh.uniforms.uEdgeW = { value: ud.edgeW || 0.6 }; sh.uniforms.uEdgeA = { value: ud.edgeA || 0.85 }; sh.uniforms.uDash = { value: ud.dash || 28 };
    sh.vertexShader = 'varying vec3 vInkN; varying vec3 vInkW;\n#ifdef INK_BOX\nattribute vec3 inkFace; varying vec3 vInkO; varying vec3 vInkS;\n#endif\n' + sh.vertexShader
      .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\n\tvInkN = transformedNormal;\n#ifdef INK_BOX\n\tvec3 inkF = inkFace;\n#ifdef USE_INSTANCING\n\tinkF = mat3(instanceMatrix) * inkF;\n#endif\n\tvInkN = normalMatrix * inkF;\n#endif')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n\tvec4 inkW = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n\tinkW = instanceMatrix * inkW;\n#endif\n\tvInkW = (modelMatrix * inkW).xyz;\n#ifdef INK_BOX\n\tvInkO = position;\n#ifdef USE_INSTANCING\n\tvInkS = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));\n#else\n\tvInkS = vec3(1.0);\n#endif\n#endif');
    sh.fragmentShader = INK_FRAG_PARS + '\n' + sh.fragmentShader
      .replace('#include <map_fragment>', INK_LAND_MAP)
      .replace('reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();', 'float inkShadow = getShadowMask();')
      .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', INK_FRAG_MAIN);
  }
  function wash(o, x) {
    var m = new T.MeshLambertMaterial({ color: 0xffffff });
    if (o) for (var k in o) m[k] = o[k];
    x = x || {};
    m.userData.hatch = x.hatch === undefined ? 1 : x.hatch; m.userData.edgeW = x.edgeW; m.userData.edgeA = x.edgeA; m.userData.dash = x.dash;
    m.defines = {};
    if (x.edge) { m.defines.INK_EDGE = 1; if (x.edge === 'dash') m.defines.INK_DASH = 1; }
    if (x.box) m.defines.INK_BOX = 1;
    if (x.land) m.defines.INK_LAND = 1;
    if (x.flat) m.defines.INK_FLAT = 1;
    if (x.edge || x.land) m.extensions = { derivatives: true };
    m.onBeforeCompile = inkCompile;
    // keep one program per variant (three caches programs by onBeforeCompile's source, which every wash shares)
    m.customProgramCacheKey = function () { return Object.keys(m.defines).join(','); };
    return m;
  }

  // ------------------------------------------------------------ pen outlines
  // Each pool gets a twin InstancedMesh that shares its instanceMatrix (so counts and animation stay in sync for free)
  // and draws the back faces pushed out in screen space: an inverted hull whose line is ~1.3 css px wide whatever the
  // instance's scale. Small or far pieces get a proportionally thinner line so dense walls read as fine masonry, not
  // black mush. Hidden pieces (zero matrix) are thrown out of clip space.
  var HULL_VS = [
    'uniform vec2 uRes; uniform float uW; uniform float uK; uniform float uBias;',
    '#ifdef INK_TINT',
    'varying vec3 vTint;',
    '#endif',
    '#ifdef INK_FADE',
    'uniform vec3 uSunW; varying float vFine;',
    '#endif',
    'void main() {',
    '#ifdef USE_INSTANCING',
    '  mat4 im = instanceMatrix;',
    '#else',
    '  mat4 im = mat4(1.0);',
    '#endif',
    '  vec3 s2 = vec3(dot(im[0].xyz, im[0].xyz), dot(im[1].xyz, im[1].xyz), dot(im[2].xyz, im[2].xyz));',
    '  if (max(s2.x, max(s2.y, s2.z)) < 1e-8) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }',
    '#ifdef INK_TINT',
    '  vTint = instanceColor;',
    '#endif',
    '  vec4 vp = modelViewMatrix * im * vec4(position, 1.0);',
    '  vec3 n = normalMatrix * (mat3(im) * normal);',
    '  float sz = pow(s2.x * s2.y * s2.z, 1.0 / 6.0), smin = sqrt(min(s2.x, min(s2.y, s2.z)));',
    '  float ppu = projectionMatrix[1][1] * 0.5 * uRes.y / max(-vp.z, 0.01);',
    '  float w = min(uW, sz * ppu * uK);',
    '#ifdef INK_FADE',
    // masonry is drawn with a lighter pen on the sunlit side (judged by the block's face turned most to you) and,
    // from afar, a finer one everywhere, so the wash carries a wall's light and shade instead of the joints
    '  vec3 iAx = normalize(im[0].xyz), iAz = normalize(im[2].xyz), iTc = normalize(cameraPosition - im[3].xyz);',
    '  float iDx = dot(iAx, iTc), iDz = dot(iAz, iTc);',
    '  vec3 iF = abs(iDx) > abs(iDz) ? iAx * sign(iDx) : iAz * sign(iDz);',
    '  vFine = min(0.72, (1.0 - smoothstep(0.22, 0.62, w / uW)) * 0.42 + smoothstep(-0.05, 0.3, dot(iF, uSunW)) * 0.36);',
    '#endif',
    '  vp.xyz += normalize(-vp.xyz) * (uBias > 0.0 ? min(uBias * w / ppu, 0.3 * smin) : uBias * w / ppu);',
    '  vec4 clip = projectionMatrix * vp;',
    '  vec2 d = n.xy; float dl = length(d); d = dl > 1e-4 ? d / dl : vec2(0.0);',
    '  clip.xy += d * (w * 2.0 / uRes) * clip.w;',
    '  gl_Position = clip;',
    '}'
  ].join('\n');
  var HULL_FS = [
    'uniform vec3 uColor; uniform float uAlpha;',
    '#ifdef INK_TINT',
    'varying vec3 vTint;',
    '#endif',
    '#ifdef INK_FADE',
    'varying float vFine;',
    '#endif',
    'void main() {',
    '  vec3 c = uColor;',
    '#ifdef INK_TINT',
    // the part you picked: its plan is drawn in full ink (orange stays for the stones laid today)
    '  if (vTint.g < 0.98) c = vec3(0.14, 0.137, 0.12);',
    '#endif',
    '#ifdef INK_FADE',
    '  c = mix(c, vec3(0.64, 0.62, 0.585), vFine);',
    '#endif',
    '  gl_FragColor = vec4(c, uAlpha);',
    '}'
  ].join('\n');
  function hullMat(o) {
    var m = new T.ShaderMaterial({
      uniforms: { uRes: INK.uRes, uW: { value: (o.w || 1.3) * DPR }, uK: { value: o.k || 0.11 }, uBias: { value: o.bias === undefined ? 1.6 : o.bias }, uColor: { value: new T.Color(o.color || '#24231f') }, uAlpha: { value: o.alpha === undefined ? 1 : o.alpha } },
      vertexShader: HULL_VS, fragmentShader: HULL_FS, side: T.BackSide
    });
    m.defines = {};
    if (o.tint) m.defines.INK_TINT = 1;
    if (o.fade) { m.defines.INK_FADE = 1; m.uniforms.uSunW = INK.uSunW; }
    if (o.transparent) { m.transparent = true; m.depthWrite = false; }
    return m;
  }
  // hull geometry: the same shape with normals averaged where faces meet, so the pushed-out shell has no cracks
  function smoothN(g) {
    var p = g.attributes.position, n = g.attributes.normal, acc = {}, i, k, a;
    function key(i) { return Math.round(p.getX(i) * 1e3) + ',' + Math.round(p.getY(i) * 1e3) + ',' + Math.round(p.getZ(i) * 1e3); }
    for (i = 0; i < p.count; i++) { k = key(i); a = acc[k] || (acc[k] = [0, 0, 0]); a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); }
    for (i = 0; i < p.count; i++) { a = acc[key(i)]; var l = Math.hypot(a[0], a[1], a[2]) || 1; n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
    return g;
  }

  var blockGeo = roundedBox(0.05, 2);
  var POOLDEF = {
    stone: { geo: roundedBox(0.16, 4), hull: roundedBox(0.16, 2), hullOpt: { fade: true }, mat: wash(null, { box: true }), ghost: true },
    block: { geo: blockGeo, hull: blockGeo, hullOpt: { fade: true }, mat: wash(null, { box: true }), ghost: true },
    log: { geo: new T.CylinderGeometry(1, 1, 1, 10, 1), hull: new T.CylinderGeometry(1, 1, 1, 8, 1), mat: wash(), ghost: true },
    cone: { geo: coneGeo(20), hull: smoothN(coneGeo(14)), mat: wash({ map: shingle(12, 3) }), ghost: true },
    pyr: { geo: pyrGeo(), hull: smoothN(pyrGeo()), mat: wash({ map: shingle(4, 3) }), ghost: true },
    gable: { geo: gableGeo(), hull: smoothN(gableGeo()), mat: wash({ map: shingle(3, 3) }), ghost: true },
    tent: { geo: gableGeo(), hull: smoothN(gableGeo()), mat: wash(), ghost: true },
    tip: { geo: coneGeo(9), hull: smoothN(coneGeo(9)), hullOpt: { w: 1.0, k: 0.08, color: '#3b3a36' }, mat: wash(null, { hatch: 0.75 }), ghost: true },
    ball: { geo: new T.IcosahedronGeometry(1, 2), hull: new T.IcosahedronGeometry(1, 1), hullOpt: { w: 1.1, k: 0.1, color: '#2f2e2a' }, mat: wash(null, { hatch: 0.85 }), ghost: true },
    disc: { geo: new T.CylinderGeometry(1, 1, 1, 28, 1), mat: wash({ map: ringTex }, { flat: true }), ghost: true },
    // flowers, fruit and shield bosses: too small for a pen line or a visible shadow, so they skip both passes
    dot: { geo: new T.IcosahedronGeometry(1, 1), mat: wash(null, { hatch: 0.6 }), noShadow: true },
    flag: { geo: pennantGeo(), mat: wash({ side: T.DoubleSide }, { hatch: 0.6 }) },
    glow: { geo: coneGeo(7), hull: smoothN(coneGeo(7)), hullOpt: { w: 1.0 }, mat: new T.MeshBasicMaterial({ color: 0xffffff }), noShadow: true },
    puff: { geo: new T.IcosahedronGeometry(1, 1), hull: new T.IcosahedronGeometry(1, 1), hullOpt: { w: 1.0, color: '#6f6c66', transparent: true }, mat: wash({ transparent: true, opacity: 0.92 }, { hatch: 0.5 }), noShadow: true }
  };
  // the unbuilt plan is a pencil drawing on the paper: a breath of paper colour and a light grey line (ink for the part you picked)
  var ghostMat = new T.MeshBasicMaterial({ color: lin('#f2f1ee'), transparent: true, opacity: 0.2, depthWrite: true });
  var ghostHullMat = hullMat({ w: 1.15, k: 0.12, color: '#97938b', tint: true, transparent: true });

  // ---------------------------------------------------------------- scene
  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(30, 1, 2, 5000);
  var hemi = new T.HemisphereLight(0xeef4ff, 0x8f7f60, 0.62);
  scene.add(hemi);
  var sun = new T.DirectionalLight(0xfff0d9, 0.98);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  var SUN_DIR = new T.Vector3(-0.5, 1, 0.48).normalize();
  INK.uSunW.value.copy(SUN_DIR);
  scene.add(sun); scene.add(sun.target);

  // ---------------------------------------------------------------- owners: a run of pieces shown in order
  var PIECES = [], OWNERS = [], ANIMS = [], SPIN = [], FLAME = [], SMOKE = [], FLAGS = [];
  function Owner(kind, units) { this.kind = kind; this.units = units; this.n = 0; this.list = []; this.ghost = false; this.oa = 0; this.ob = 0; this.tint = false; this.dynamic = false; this.day = 0; }
  Owner.prototype.finalize = function () {
    this.list.sort(function (a, b) { return a.ord - b.ord; });
    this.start = new Int32Array(this.units + 1);
    var j = 0;
    for (var o = 0; o <= this.units; o++) { while (j < this.list.length && this.list[j].ord < o) j++; this.start[o] = j; }
  };
  var POOLS = {}, ZERO = new T.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  var _p = new T.Vector3(), _q = new T.Quaternion(), _s = new T.Vector3(), _m = new T.Matrix4(), _m2 = new T.Matrix4();
  function compose(pc, M) {
    _p.set(pc.x, pc.y, pc.z); _s.set(pc.sx, pc.sy, pc.sz);
    if (pc.q) _q.copy(pc.q); else _q.set(0, 0, 0, 1);
    var m = new T.Matrix4().compose(_p, _q, _s);
    if (pc.fl && pc.fl.spin) {
      var sp = pc.fl.spin;
      pc.spA = new T.Matrix4().multiplyMatrices(M, new T.Matrix4().makeTranslation(sp.hub[0], sp.hub[1], sp.hub[2]));
      pc.spB = m.clone();
      return new T.Matrix4().copy(pc.spA).multiply(new T.Matrix4().makeRotationZ(sp.a0)).multiply(pc.spB);
    }
    return m.premultiply(M);
  }
  // pass 1 collects every piece; pools are sized once we know the counts
  var PENDING = [];
  function register(pieces, owner, M) {
    for (var i = 0; i < pieces.length; i++) {
      var pc = pieces[i];
      pc.m = compose(pc, M); pc.owner = owner;
      owner.list.push(pc);
      if (owner.dynamic) DYN.push(pc); else PENDING.push(pc);
    }
  }
  function placePiece(pc) {
    var pool = POOLS[pc.g];
    pc.idx = owner_alloc(pool, pc.owner.dynamic); pc.gOn = false;
    if (!pc.owner.dynamic) pool.sDays.push(pc.owner.day);
    setM(pool, pc.idx, ZERO);
    pool.mesh.setColorAt(pc.idx, pc.c);
    if (pool.ghost) { setGM(pool, pc.idx, ZERO); pool.ghost.setColorAt(pc.idx, WHITE); }
    pool.cdirty = true;
    if (pc.fl) {
      if (pc.fl.spin) SPIN.push(pc);
      if (pc.fl.flame !== undefined) FLAME.push(pc);
      if (pc.fl.smoke !== undefined) SMOKE.push(pc);
      if (pc.fl.flag !== undefined) FLAGS.push(pc);
    }
  }
  // each pool: the plot's reserve first [0, R), then every static piece sorted by the day it first appears,
  // so a pool only draws up to the last piece that can exist on the day shown
  function owner_alloc(pool, dyn) {
    if (dyn) { if (pool.dynUsed >= pool.R) return pool.R - 1; return pool.dynUsed++; }
    return pool.used++;
  }
  function makePools(counts, reserve) {
    Object.keys(POOLDEF).forEach(function (g) {
      var def = POOLDEF[g], n = (counts[g] || 0), R = reserve[g] || 0, cap = Math.max(1, n + R);
      var mesh = new T.InstancedMesh(def.geo, def.mat, cap);
      mesh.frustumCulled = false; mesh.castShadow = !def.noShadow; mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      // three sizes instanceColor from .count on the first setColorAt, so fill every slot before trimming the count;
      // a colour buffer shorter than the drawn count makes real GPUs drop the whole draw (only the pen hull is left)
      for (var i = 0; i < cap; i++) { mesh.setMatrixAt(i, ZERO); mesh.setColorAt(i, WHITE); }
      scene.add(mesh);
      var ghost = null;
      if (def.ghost) {
        // the ghost is a flat pencil wash, so it uses the low-poly hull shape (a quarter of the triangles)
        ghost = new T.InstancedMesh(def.hull || def.geo, ghostMat, cap);
        ghost.frustumCulled = false; ghost.renderOrder = 2;
        for (i = 0; i < cap; i++) { ghost.setMatrixAt(i, ZERO); ghost.setColorAt(i, WHITE); }
        scene.add(ghost);
      }
      // pen outlines share the pool's matrices (and the ghost's tint), so they never need syncing
      var hull = null, gh = null;
      if (def.hull) {
        hull = new T.InstancedMesh(def.hull, hullMat(def.hullOpt || {}), 1);
        hull.count = cap; hull.instanceMatrix = mesh.instanceMatrix;
        hull.frustumCulled = false; hull.renderOrder = 1; hull.castShadow = hull.receiveShadow = false;
        scene.add(hull);
        if (ghost) {
          gh = new T.InstancedMesh(def.hull, ghostHullMat, 1);
          gh.count = cap; gh.instanceMatrix = ghost.instanceMatrix; gh.instanceColor = ghost.instanceColor;
          gh.frustumCulled = false; gh.renderOrder = 3;
          scene.add(gh);
        }
      }
      POOLS[g] = { mesh: mesh, ghost: ghost, hull: hull, ghostHull: gh, cap: cap, R: R, used: R, dynUsed: 0, sDays: [], ghostN: 0, lo: 0, hi: cap - 1, glo: 0, ghi: cap - 1, cdirty: true };
    });
  }
  // only draw the instances that can show on the day: the reserve, then the static pieces up to the last one whose
  // building or plot exists by then (pieces are sorted by that day). Main, shadow, hull and ghost passes all follow.
  function trimPool(pool) {
    var a = pool.sDays, lo = 0, hi = a.length;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (a[mid] <= DAY) lo = mid + 1; else hi = mid; }
    var c = Math.max(1, pool.R + lo);
    if (pool.mesh.count === c) return;
    // the colour buffers must cover every drawn instance, or real GPUs drop the whole draw
    if (pool.mesh.instanceColor && pool.mesh.instanceColor.count < c) console.warn('village: instance colours shorter than the draw');
    pool.mesh.count = c; if (pool.ghost) pool.ghost.count = c; if (pool.hull) pool.hull.count = c; if (pool.ghostHull) pool.ghostHull.count = c;
  }
  function rng01(o, a) { return o.start[a]; }
  // matrix writes note the span they touched, so each frame uploads only that span (the soldiers walk every frame)
  function setM(pool, i, m) { pool.mesh.setMatrixAt(i, m); if (i < pool.lo) pool.lo = i; if (i > pool.hi) pool.hi = i; }
  function setGM(pool, i, m) { pool.ghost.setMatrixAt(i, m); if (i < pool.glo) pool.glo = i; if (i > pool.ghi) pool.ghi = i; }
  function upload(attr, lo, hi) {
    if (hi < lo) return;
    var ur = attr.updateRange;
    // a span not yet sent (the mesh was hidden that frame) is merged in, never dropped
    if (ur.count !== -1) { var a = ur.offset / 16, b = a + ur.count / 16 - 1; if (a < lo) lo = a; if (b > hi) hi = b; }
    ur.offset = lo * 16; ur.count = (hi - lo + 1) * 16; attr.needsUpdate = true;
  }
  function show(pc, on) { setM(POOLS[pc.g], pc.idx, on ? pc.m : ZERO); }
  function showGhost(pc, on) {
    var pool = POOLS[pc.g]; if (!pool.ghost) return;
    setGM(pool, pc.idx, on ? pc.m : ZERO);
    // a pool with no plan showing skips its ghost and pencil draws
    if (pc.gOn !== on) { pc.gOn = on; pool.ghostN += on ? 1 : -1; }
  }
  function setCount(o, n, animate) {
    n = clamp(n, 0, o.units);
    if (n === o.n) return;
    var i, a, b, now = performance.now(), k = 0;
    if (n > o.n) {
      a = rng01(o, o.n); b = rng01(o, n);
      var anim = animate && !REDUCED && (b - a) < 260;
      for (i = a; i < b; i++) {
        var pc = o.list[i];
        if (o.ghost) showGhost(pc, false);
        if (anim && !(pc.fl && (pc.fl.spin || pc.fl.walk !== undefined))) { ANIMS.push({ pc: pc, t0: now + (k++) * 16 + (pc.ord - o.n) * 6, dur: 420 }); show(pc, false); }
        else show(pc, true);
      }
    } else {
      a = rng01(o, n); b = rng01(o, o.n);
      for (i = a; i < b; i++) { show(o.list[i], false); if (o.ghost) showGhost(o.list[i], true); }
    }
    o.n = n;
  }
  function setGhost(o, on) {
    if (!o.ghostable || o.ghost === on) return;
    o.ghost = on;
    for (var i = rng01(o, o.n); i < o.list.length; i++) showGhost(o.list[i], on);
  }
  function setTint(o, on) {
    if (o.tint === on) return; o.tint = on;
    for (var i = 0; i < o.list.length; i++) { var pc = o.list[i], pool = POOLS[pc.g]; if (pool.ghost) { pool.ghost.setColorAt(pc.idx, on ? GHOST_SEL : WHITE); pool.cdirty = true; } }
  }
  function paint(o, a, b, on) {
    for (var i = rng01(o, a); i < rng01(o, b); i++) {
      var pc = o.list[i]; if (pc.fl && (pc.fl.flag !== undefined || pc.fl.flame !== undefined)) continue;
      var pool = POOLS[pc.g]; pool.mesh.setColorAt(pc.idx, on ? ORANGE : pc.c); pool.cdirty = true;
    }
  }
  function setOrange(o, a, b) {
    a = clamp(a, 0, o.units); b = clamp(b, a, o.units);
    if (o.oa === a && o.ob === b) return;
    paint(o, o.oa, o.ob, false); paint(o, a, b, true); o.oa = a; o.ob = b;
  }

  // ---------------------------------------------------------------- build the world
  var BUILDINGS = [], TILES = [], DYN = [], DYNALL = [];
  function tileMatrix(tile, ry) { return new T.Matrix4().makeRotationY(ry || 0).setPosition(tile[0] * TILE, 0, tile[1] * TILE); }
  function localBounds(parts) {
    var bx = [Infinity, -Infinity, Infinity, -Infinity, 0];
    parts.forEach(function (p) { p.pieces.forEach(function (pc) {
      if (pc.fl && pc.fl.spin) return;
      var r = Math.max(pc.sx, pc.sz) * (pc.g === 'cone' || pc.g === 'ball' || pc.g === 'log' || pc.g === 'tip' || pc.g === 'disc' ? 1 : 0.5);
      bx[0] = Math.min(bx[0], pc.x - r); bx[1] = Math.max(bx[1], pc.x + r); bx[2] = Math.min(bx[2], pc.z - r); bx[3] = Math.max(bx[3], pc.z + r);
      bx[4] = Math.max(bx[4], pc.y + (pc.g === 'cone' || pc.g === 'pyr' || pc.g === 'gable' || pc.g === 'tip' ? pc.sy : pc.sy / 2));
    }); });
    return bx;
  }
  function makeBuilding(def, dynamic) {
    var b = new Builder(def.seed || 1), info = GEN[def.kind](b) || {}, ry = def.ry !== undefined ? def.ry : 0, M = tileMatrix(def.tile, ry);
    var B = { def: def, kind: def.kind, parts: [], fin: null, info: info, M: M, ry: ry, exists: false, complete: false, mode: def.mode || 'plan', dynamic: !!dynamic };
    var vis = b.parts.filter(function (p) { return !p.hidden; }), total = vis.reduce(function (s, p) { return s + p.units; }, 0);
    var camps = def.real ? assignCamps(def.camps, vis) : null;
    vis.forEach(function (p, i) {
      var sc = null;
      if (!camps) {
        var steps = Math.max(3, Math.round((def.steps || 30) * p.units / total)), span = def.span || 90;
        sc = { steps: steps, start: (def.start || 0) + Math.round(i * span * 0.16), rate: steps / (span * 0.62) };
      }
      var O = new Owner('part', p.units); O.ghostable = true; O.dynamic = !!dynamic; O.day = def.from || 0;
      register(p.pieces, O, M); O.finalize();
      var P = camps
        ? { key: p.key, name: p.name, camp: camps[i].title, campIds: camps[i].camps, list: camps[i].steps, steps: camps[i].steps.length, sched: null, units: p.units, owner: O, done: 0 }
        : { key: p.key, name: p.name, camp: null, steps: sc.steps, sched: sc, units: p.units, owner: O, done: 0 };
      var cx = 0, cy = 0, cz = 0, top = 0;
      p.pieces.forEach(function (pc) { cx += pc.m.elements[12]; cz += pc.m.elements[14]; top = Math.max(top, pc.m.elements[13]); });
      P.center = new T.Vector3(cx / p.pieces.length, top + 1.2, cz / p.pieces.length);
      B.parts.push(P);
    });
    b.parts.filter(function (p) { return p.hidden; }).forEach(function (p) {
      var O = new Owner('fin', p.units); O.dynamic = !!dynamic; O.day = def.from || 0; register(p.pieces, O, M); O.finalize(); B.fin = O;
    });
    var lb = localBounds(b.parts);
    B.local = lb;
    var c = new T.Vector3((lb[0] + lb[1]) / 2, 0, (lb[2] + lb[3]) / 2).applyMatrix4(M);
    var hx = (lb[1] - lb[0]) / 2, hz = (lb[3] - lb[2]) / 2;
    if (Math.abs(Math.sin(ry)) > 0.5) { var t = hx; hx = hz; hz = t; }
    B.center = c; B.half = [hx, lb[4], hz]; B.top = lb[4];
    B.radius = Math.hypot(hx, hz, lb[4] * 0.6);
    var hit = new T.Mesh(new T.BoxGeometry(hx * 2, lb[4], hz * 2), new T.MeshBasicMaterial({ visible: false }));
    hit.position.set(c.x, lb[4] / 2, c.z); hit.userData.B = B; scene.add(hit); B.hit = hit;
    B.steps = B.parts.reduce(function (s, p) { return s + p.steps; }, 0);
    B.units = B.parts.reduce(function (s, p) { return s + p.units; }, 0);
    return B;
  }
  // one wash of land, turned per plot in the shader so neighbouring plots differ; plot borders are fine pen lines
  var landMat = wash({ map: landTex(3) }, { edge: 'solid', edgeW: 0.5, edgeA: 0.5, land: true });
  var soilMat = wash({ map: sideTex }, { edge: 'solid', edgeW: 0.65, hatch: 1.1, flat: true });
  // a plot is two draws: its four sides in one group, then its top. The bottom can never be seen (the camera stays
  // above the land), so it is left out.
  var tileGeo = (function () {
    var g = new T.BoxGeometry(TILE, DEPTH, TILE), idx = g.index.array, gr = g.groups, out = [];
    function grp(k) { for (var i = gr[k].start; i < gr[k].start + gr[k].count; i++) out.push(idx[i]); }
    grp(0); grp(1); grp(4); grp(5); grp(2);
    g.setIndex(out); g.clearGroups(); g.addGroup(0, 24, 0); g.addGroup(24, 6, 1);
    return g;
  })();
  function makeTile(tile, day, decorFn, kind) {
    var mesh = new T.Mesh(tileGeo, [soilMat, landMat]);
    mesh.position.set(tile[0] * TILE, -DEPTH / 2, tile[1] * TILE); mesh.receiveShadow = true; mesh.visible = false;
    scene.add(mesh);
    var Tl = { tile: tile, day: day, mesh: mesh, kind: kind, present: false, decor: null, rise: null };
    if (decorFn) {
      var b = new Builder(tile[0] * 73 + tile[1] * 31 + 900), M = tileMatrix(tile, 0);
      b.part('decor', 'Decor'); b.grp = 0; b.cur.units = 1; decorFn(b); b.grp = -1;
      var O = new Owner('decor', 1); O.day = day; register(b.parts[0].pieces, O, M); O.finalize(); Tl.decor = O;
    }
    TILES.push(Tl);
    return Tl;
  }
  function buildingDecor(B) {
    var lb = B.local, door = B.info.door || [0, 0];
    var edgeW = new T.Vector3(B.def.tile[0] * TILE, 0, B.def.tile[1] * TILE), dir = new T.Vector3(-B.def.tile[0], 0, -B.def.tile[1]);
    if (Math.abs(dir.x) >= Math.abs(dir.z)) dir.set(Math.sign(dir.x), 0, 0); else dir.set(0, 0, Math.sign(dir.z));
    edgeW.addScaledVector(dir, TILE / 2 - 0.3);
    var inv = new T.Matrix4().copy(B.M).invert(), edgeL = edgeW.clone().applyMatrix4(inv);
    return function (b) {
      var M = B.M, Minv = inv;
      // decor is generated in tile-local axes, so convert the building's box into them
      var corners = [[lb[0], lb[2]], [lb[1], lb[2]], [lb[0], lb[3]], [lb[1], lb[3]]].map(function (p) { var v = new T.Vector3(p[0], 0, p[1]).applyMatrix4(M); return [v.x - B.def.tile[0] * TILE, v.z - B.def.tile[1] * TILE]; });
      var bx0 = Math.min.apply(null, corners.map(function (c) { return c[0]; })) - 1.6, bx1 = Math.max.apply(null, corners.map(function (c) { return c[0]; })) + 1.6;
      var bz0 = Math.min.apply(null, corners.map(function (c) { return c[1]; })) - 1.6, bz1 = Math.max.apply(null, corners.map(function (c) { return c[1]; })) + 1.6;
      var dW = new T.Vector3(door[0], 0, door[1]).applyMatrix4(M), eW = edgeW;
      var da = [dW.x - B.def.tile[0] * TILE, dW.z - B.def.tile[1] * TILE], ea = [eW.x - B.def.tile[0] * TILE, eW.z - B.def.tile[1] * TILE];
      if (!B.def.noPath) path(b, da[0], da[1], ea[0], ea[1]);
      var avoid = function (x, z) {
        if (x > bx0 && x < bx1 && z > bz0 && z < bz1) return true;
        var L = Math.hypot(ea[0] - da[0], ea[1] - da[1]) || 1, t = ((x - da[0]) * (ea[0] - da[0]) + (z - da[1]) * (ea[1] - da[1])) / (L * L);
        if (t > -0.05 && t < 1.05) { var px = da[0] + (ea[0] - da[0]) * t, pz = da[1] + (ea[1] - da[1]) * t; if (Math.hypot(x - px, z - pz) < 1.8) return true; }
        return false;
      };
      trees(b, 5, avoid, 0.35, 3.6); flowers(b, 34, avoid); rocks(b, 2, avoid);
      void Minv;
    };
  }

  // static content
  var GARRISON = null, PLOTMARK = null, PLOT = { preview: null, q: 0, roll: 0, opts: [], sel: 0, busy: false }, PLOT_B = null, PLOT_TILE = null;
  function world() {
    makeTile([0, 0], 0, plaza, 'plaza');
    QUESTS.forEach(function (q) {
      q.ry = faceCenter(q.tile);
      var B = makeBuilding(q, false); B.exists = false; BUILDINGS.push(B);
      makeTile(q.tile, 0, buildingDecor(B), 'quest');
    });
    NATURE.forEach(function (n) { makeTile(n.tile, n.day, NAT[n.kind], 'nature'); });
    if (PLOT_TILE_AT) PLOT_TILE = makeTile(PLOT_TILE_AT, 0, function (b) {
      trees(b, 4, function (x, z) { return Math.abs(x) < 10 && Math.abs(z) < 10; }, 0.3, 4);
      flowers(b, 20, function (x, z) { return Math.abs(x) < 10.5 && Math.abs(z) < 10.5; });
    }, 'plot');
    // the staked-out plot: orange marks show while it waits for Generate project
    var mb = new Builder(77); mb.part('marks', 'Marks'); mb.grp = 0; mb.cur.units = 1;
    var inset = 9.2;
    for (var s = 0; s < 4; s++) for (var i = 0; i < 9; i++) {
      var t = -inset + (i + 0.5) * (2 * inset) / 9, x = s < 2 ? t : (s === 2 ? -inset : inset), z = s < 2 ? (s === 0 ? -inset : inset) : t;
      mb.add('block', x, 0.06, z, s < 2 ? 1.1 : 0.22, 0.1, s < 2 ? 0.22 : 1.1, null, lin(PAL.orange));
    }
    [[-inset, -inset], [inset, -inset], [-inset, inset], [inset, inset]].forEach(function (p) { mb.post(p[0], 0, p[1], 0.1, 1.2, mb.col(PAL.wood[0], 0)); });
    mb.grp = -1;
    PLOTMARK = new Owner('decor', 1);
    register(mb.parts[0].pieces, PLOTMARK, tileMatrix(PLOT_TILE_AT || [0, 0], 0)); PLOTMARK.finalize();
    PLOT_HIT = new T.Mesh(new T.BoxGeometry(TILE, 1, TILE), new T.MeshBasicMaterial({ visible: false }));
    if (PLOT_TILE_AT) { PLOT_HIT.position.set(PLOT_TILE_AT[0] * TILE, 0, PLOT_TILE_AT[1] * TILE); scene.add(PLOT_HIT); }
    // the garrison: one soldier for each bullseye on The Mark
    var gb = new Builder(5); gb.part('army', 'Soldiers');
    for (var k = 0; k < 48; k++) gb.unit(function () {
      gb.add('block', 0, 0, 0, 0.56, 0.86, 0.38, null, gb.col(PAL.tunic, 0.02), { walk: k, off: [0, 0.68, 0] });
      gb.add('ball', 0, 0, 0, 0.23, 0.23, 0.23, null, gb.col(PAL.skin, 0.02), { walk: k, off: [0, 1.32, 0] });
      gb.add('ball', 0, 0, 0, 0.26, 0.14, 0.26, null, gb.col(PAL.helm, 0), { walk: k, off: [0, 1.46, 0] });
      gb.add('log', 0, 0, 0, 0.04, 1.9, 0.04, null, gb.col(PAL.wood[1], 0), { walk: k, off: [0.36, 1.0, 0.05] });
      gb.add('disc', 0, 0, 0, 0.3, 0.07, 0.3, new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), Math.PI / 2), gb.col(PAL.wool[0], 0), { walk: k, off: [-0.34, 0.75, 0.02] });
      gb.add('dot', 0, 0, 0, 0.075, 0.075, 0.075, null, gb.col(PAL.woodDark, 0), { walk: k, off: [-0.385, 0.75, 0.02] });
    });
    GARRISON = new Owner('army', 48);
    register(gb.parts[0].pieces, GARRISON, new T.Matrix4()); GARRISON.finalize();
  }
  var PLOT_HIT = null;
  world();

  // the plot's build lives in a reserved stretch of each pool, so Generate project can swap it
  var reserve = {};
  Object.keys(GEN).forEach(function (kind) {
    for (var s = 1; s <= 3; s++) {
      var b = new Builder(s * 13), cnt = {};
      GEN[kind](b);
      b.parts.forEach(function (p) { p.pieces.forEach(function (pc) { cnt[pc.g] = (cnt[pc.g] || 0) + 1; }); });
      Object.keys(cnt).forEach(function (g) { reserve[g] = Math.max(reserve[g] || 0, Math.ceil(cnt[g] * 1.2) + 16); });
    }
  });
  var counts = {};
  PENDING.forEach(function (pc, i) { counts[pc.g] = (counts[pc.g] || 0) + 1; pc.seq = i; });
  makePools(counts, reserve);
  PENDING.sort(function (a, b) { return a.owner.day - b.owner.day || a.seq - b.seq; });
  PENDING.forEach(placePiece);
  PENDING = null;

  // the land's outer silhouette: one instanced pen hull for every plot, kept in step with each plot as it rises.
  // Its depth is pushed back, so where two plots meet the neighbour's turf hides it and only the outline of the land shows.
  var tileHull = new T.InstancedMesh(roundedBox(0.004, 2), hullMat({ w: 1.5, k: 1, bias: -2.6 }), TILES.length);
  tileHull.frustumCulled = false; tileHull.renderOrder = 1;
  scene.add(tileHull);
  var _ts = new T.Vector3(TILE, DEPTH, TILE), _tq = new T.Quaternion();
  function syncTileHull() {
    for (var i = 0; i < TILES.length; i++) {
      var tm = TILES[i].mesh;
      if (tm.visible) { _m.compose(tm.position, _tq, _ts); tileHull.setMatrixAt(i, _m); } else tileHull.setMatrixAt(i, ZERO);
    }
    tileHull.instanceMatrix.needsUpdate = true;
  }

  function plotDef() {
    var q = WAITING[PLOT.q], o = PLOT.preview;
    return { id: 'next', name: q.name, label: null, type: q.type, tile: PLOT_TILE_AT, ry: faceCenter(PLOT_TILE_AT), noPath: true, kind: o.kind, seed: o.seed, from: 0, start: 0, steps: Math.max(1, q.steps), span: 90, mode: 'preview' };
  }
  function rebuildPlot() {
    if (PLOT_B) DYNALL.forEach(function (pc) { if (pc.gOn) showGhost(pc, false); });
    Object.keys(POOLS).forEach(function (g) {
      var pool = POOLS[g];
      for (var i = 0; i < pool.dynUsed; i++) { setM(pool, i, ZERO); if (pool.ghost) setGM(pool, i, ZERO); }
      pool.dynUsed = 0;
    });
    if (PLOT_B) {
      scene.remove(PLOT_B.hit); PLOT_B.hit.geometry.dispose(); PLOT_B.hit.material.dispose();
      var gone = {}; PLOT_B.parts.forEach(function (P) { P.owner.list.forEach(function (pc) { gone[pc.idx + pc.g] = pc; }); });
      if (PLOT_B.fin) PLOT_B.fin.list.forEach(function (pc) { gone[pc.idx + pc.g] = pc; });
      [SPIN, FLAME, SMOKE, FLAGS].forEach(function (arr) { for (var i = arr.length - 1; i >= 0; i--) if (gone[arr[i].idx + arr[i].g] === arr[i]) arr.splice(i, 1); });
      for (var i = ANIMS.length - 1; i >= 0; i--) if (ANIMS[i].pc.owner.dynamic) ANIMS.splice(i, 1);
      BUILDINGS.splice(BUILDINGS.indexOf(PLOT_B), 1);
    }
    DYN = []; DYNALL = []; PLOT_B = null;
    if (PLOT.preview) {
      PLOT_B = makeBuilding(plotDef(), true);
      DYN.forEach(placePiece); DYNALL = DYN;
      BUILDINGS.push(PLOT_B);
    }
    applyDay(DAY, false, true);
  }

  // ---------------------------------------------------------------- time
  var DAY = MAXDAY;
  function posToDay(p) { return Math.round(p / 1000 * MAXDAY); }
  function dayToPos(d) { return d / MAXDAY * 1000; }
  var bounds = { cx: 0, cz: 0, r: 60, key: '' };
  function applyDay(d, animate, force) {
    DAY = d;
    var landKey = '';
    TILES.forEach(function (Tl) {
      var on = d >= Tl.day;
      landKey += on ? '1' : '0';
      if (on !== Tl.present) {
        Tl.present = on; Tl.mesh.visible = on;
        if (on && animate && !REDUCED) { Tl.rise = performance.now(); Tl.mesh.position.y = -DEPTH / 2 - 16; if (Tl.decor) Tl.decorAt = Tl.rise + 520; }
        else { Tl.rise = null; Tl.mesh.position.y = -DEPTH / 2; if (Tl.decor) setCount(Tl.decor, on ? 1 : 0, false); }
      }
    });
    BUILDINGS.forEach(function (B) {
      var exists = d >= B.def.from, preview = B.mode === 'preview', all = exists;
      B.parts.forEach(function (P) {
        var done = !exists ? 0 : preview ? P.steps : Math.min(P.steps, partDone(P, d));
        var prev = !exists ? 0 : preview ? P.steps : partDone(P, d - 1);
        var n = P.steps ? Math.round(P.units * done / P.steps) : 0, n0 = P.steps ? Math.min(n, Math.round(P.units * prev / P.steps)) : 0;
        if (!P.steps || done < P.steps) all = false;
        P.done = done; P.n = n; P.today = n - n0;
        setCount(P.owner, n, animate);
        setOrange(P.owner, n0, n);
      });
      B.complete = exists && all; B.exists = exists;
      if (B.fin) setCount(B.fin, B.complete ? B.fin.units : 0, animate);
      var g = exists && !B.complete && !preview;
      B.parts.forEach(function (P) { setGhost(P.owner, g || (exists && SEL.B === B && !preview && !B.complete)); });
    });
    setCount(GARRISON, Math.min(48, soldiers(d)), false);
    setCount(PLOTMARK, plotEmpty() ? 1 : 0, false);
    for (var g in POOLS) trimPool(POOLS[g]);
    if (landKey !== bounds.key || force) updateBounds(landKey);
    updateDock(); updateLabels(); refreshSheet();
  }
  function plotEmpty() { return !PLOT_B || !PLOT_B.exists; }
  function updateBounds(key) {
    var x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    TILES.forEach(function (Tl) { if (!Tl.present) return; x0 = Math.min(x0, Tl.tile[0]); x1 = Math.max(x1, Tl.tile[0]); z0 = Math.min(z0, Tl.tile[1]); z1 = Math.max(z1, Tl.tile[1]); });
    bounds.cx = (x0 + x1) / 2 * TILE; bounds.cz = (z0 + z1) / 2 * TILE;
    bounds.x0 = x0 * TILE - TILE / 2; bounds.x1 = x1 * TILE + TILE / 2; bounds.z0 = z0 * TILE - TILE / 2; bounds.z1 = z1 * TILE + TILE / 2;
    bounds.r = Math.hypot((x1 - x0 + 1) * TILE, (z1 - z0 + 1) * TILE) / 2;
    bounds.key = key;
    var R = bounds.r + 8;
    var sc = sun.shadow.camera; sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 1; sc.far = 600; sc.updateProjectionMatrix();
    sun.target.position.set(bounds.cx, 0, bounds.cz);
    sun.position.set(bounds.cx, 0, bounds.cz).addScaledVector(SUN_DIR, 260);
    var px = 2048 / (2 * R);
    sun.shadow.normalBias = clamp(0.6 / px, 0.03, 0.18);
    if (!userCam && !SEL.B && !GEN_OPEN) fitVillage();
  }

  // ---------------------------------------------------------------- camera
  var view = { th: 0.62, ph: 0.62, dist: 300, tx: 0, ty: 2, tz: 0, ox: 0, oy: 0 };
  var goal = { th: 0.62, ph: 0.62, dist: 300, tx: 0, ty: 2, tz: 0, ox: 0, oy: 0 };
  var userCam = false, W = 1, H = 1;
  // the part of the screen the drawing can use: below the title, clear of the dock or the open panel.
  // On wide screens a panel sits on the right; the dock sits bottom left, so the map can go above it or right of it.
  function rectOf(top, bottom, left, right) { return { top: top, bottom: bottom, left: left, right: right, w: W - right - left, h: H - top - bottom }; }
  var SIDE = window.matchMedia ? matchMedia('(orientation: landscape) and (max-height: 520px)') : { matches: false };
  function freeRects() {
    var top = root.querySelector('.top').getBoundingClientRect().bottom;
    var panel = [$('sheet'), $('gen'), $('dock')].filter(function (el) { return !el.hidden; })[0];
    if (!panel) return [rectOf(top, 0, 0, 0)];
    var r = panel.getBoundingClientRect(), wide = window.innerWidth >= 900;
    if (SIDE.matches || (wide && panel !== $('dock'))) return [rectOf(top, 0, 0, W - r.left + 8)];
    if (wide) return [rectOf(top, H - r.top + 8, 0, 0), rectOf(top, 0, r.right + 8, 0)];
    return [rectOf(top, H - r.top + 8, 0, 0)];
  }
  function freeRect() { return freeRects()[0]; }
  function fitDist(radius) {
    var f = freeRect(), half = 15 * Math.PI / 180;
    var vh = Math.atan(Math.tan(half) * f.h / H), hh = Math.atan(Math.tan(half) * f.w / H);
    return radius / Math.tan(Math.min(vh, hh)) * 1.02;
  }
  function frameOffset() { var f = freeRect(); goal.ox = (f.right - f.left) / 2; goal.oy = (f.bottom - f.top) / 2; }
  // the whole plate, as drawn: its land box is projected at the goal angle and fitted inside the free area with a margin
  var fitCam = new T.PerspectiveCamera(30, 1, 2, 5000), _fc = [], _fv = new T.Vector3();
  for (var fci = 0; fci < 8; fci++) _fc.push(new T.Vector3());
  function plateBox(D) {
    var cp = Math.cos(goal.ph);
    fitCam.aspect = W / H; fitCam.updateProjectionMatrix();
    fitCam.position.set(goal.tx + D * cp * Math.sin(goal.th), goal.ty + D * Math.sin(goal.ph), goal.tz + D * cp * Math.cos(goal.th));
    fitCam.lookAt(goal.tx, goal.ty, goal.tz); fitCam.updateMatrixWorld();
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    for (var i = 0; i < 8; i++) {
      _fv.set(i & 1 ? bounds.x1 : bounds.x0, i & 2 ? 5 : -DEPTH, i & 4 ? bounds.z1 : bounds.z0).project(fitCam);
      var x = (_fv.x + 1) / 2 * W, y = (1 - _fv.y) / 2 * H;
      b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
    }
    return b;
  }
  function fitVillage() {
    goal.tx = bounds.cx; goal.tz = bounds.cz; goal.ty = 2;
    if (bounds.x0 === undefined) { goal.dist = clamp(fitDist(bounds.r * 0.8), 60, 2400); frameOffset(); return; }
    var m = W >= 900 ? 28 : 12, best = null;
    freeRects().forEach(function (f) {
      var lo = 40, hi = 3000;
      for (var it = 0; it < 22; it++) {
        var mid = (lo + hi) / 2, b = plateBox(mid);
        if (b[2] - b[0] <= f.w - 2 * m && b[3] - b[1] <= f.h - 2 * m) hi = mid; else lo = mid;
      }
      // above the dock (centred) unless beside it draws the plate clearly larger (very wide, short windows)
      if (!best || hi < best.d * 0.88) best = { d: hi, f: f };
    });
    var f = best.f, bb = plateBox(best.d);
    goal.dist = clamp(best.d, 60, 2400);
    goal.ox = (bb[0] + bb[2]) / 2 - (f.left + (W - f.right)) / 2;
    goal.oy = (bb[1] + bb[3]) / 2 - (f.top + (H - f.bottom)) / 2;
  }
  function focus(v, radius) {
    goal.tx = v.x; goal.ty = Math.max(1, v.y * 0.4); goal.tz = v.z;
    goal.dist = clamp(fitDist(radius), 30, 2400);
    frameOffset();
  }
  function resize() {
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false);
    renderer.getDrawingBufferSize(INK.uRes.value);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    if (SEL.B) focusSel(); else if (GEN_OPEN) focusPlot(); else if (!userCam) fitVillage(); else frameOffset();
    uiDirty = true; placeToast();
  }
  function placeCamera() {
    var cp = Math.cos(view.ph);
    camera.position.set(view.tx + view.dist * cp * Math.sin(view.th), view.ty + view.dist * Math.sin(view.ph), view.tz + view.dist * cp * Math.cos(view.th));
    camera.lookAt(view.tx, view.ty, view.tz);
    camera.setViewOffset(W, H, view.ox, view.oy, W, H);
  }

  // input
  var ptrs = new Map(), drag = null, pinch0 = 0, dist0 = 0;
  function interacted() { var h = $('hint'); if (!h.classList.contains('gone')) { h.classList.add('gone'); uiDirty = true; } }
  var hintT = null; // the hint shows for 7 seconds from the first drawn frame (slow phones take a while to get there)
  function pdist() { var a = Array.from(ptrs.values()); return a.length < 2 ? 1 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
  canvas.addEventListener('pointerdown', function (e) {
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
    else { if (drag) drag.moved = 99; pinch0 = pdist(); dist0 = goal.dist; }
    interacted();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1 && drag) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 6) { goal.th -= dx * 0.0075; view.th = goal.th; goal.ph = clamp(goal.ph + dy * 0.005, 0.2, 1.3); view.ph = goal.ph; userCam = true; }
    } else if (ptrs.size === 2) { goal.dist = clamp(dist0 * pinch0 / pdist(), 25, 2600); userCam = true; }
  });
  function up(e) {
    if (!ptrs.has(e.pointerId)) return;
    if (ptrs.size === 1 && drag && drag.moved < 8 && performance.now() - drag.t < 500) tap(e.clientX, e.clientY);
    ptrs.delete(e.pointerId);
    if (ptrs.size === 1) { var r = Array.from(ptrs.values())[0]; drag = { x: r.x, y: r.y, t: 0, moved: 99 }; }
    if (ptrs.size === 0) drag = null;
  }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', function (e) { e.preventDefault(); goal.dist = clamp(goal.dist * Math.exp(e.deltaY * 0.0012), 25, 2600); userCam = true; interacted(); }, { passive: false });
  var ray = new T.Raycaster(), ndc = new T.Vector2();
  function tap(x, y) {
    var r = canvas.getBoundingClientRect();
    ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    var objs = BUILDINGS.filter(function (B) { return B.exists; }).map(function (B) { return B.hit; });
    if (plotEmpty() && PLOT_TILE_AT) objs.push(PLOT_HIT);
    var h = ray.intersectObjects(objs, false)[0];
    if (!h) { if (SEL.B) closeSheet(); return; }
    if (h.object === PLOT_HIT) openGen(); else if (h.object.userData.B === PLOT_B && PLOT_B.mode === 'preview') return; else openBuilding(h.object.userData.B);
  }
  $('recenter').addEventListener('click', function () { userCam = false; closeAll(); goal.th = 0.62; goal.ph = 0.62; fitVillage(); });

  // ---------------------------------------------------------------- dock
  var slider = $('time'), playing = false, playPos = 0;
  function fmt(n) { return n.toLocaleString('en-US'); }
  function dateOf(d) { var dt = new Date(DAY0.getTime()); dt.setDate(dt.getDate() + d); return dt; }
  function shortDate(d, year) { var o = { month: 'short', day: 'numeric' }; if (year) o.year = 'numeric'; return dateOf(d).toLocaleDateString('en-US', o); }
  var TICKS = [[0, shortDate(0, MAXDAY > 300)], [MAXDAY, 'Today', 'today']];
  if (MAXDAY >= 60) TICKS.splice(1, 0, [Math.round(MAXDAY / 2), shortDate(Math.round(MAXDAY / 2), false)]);
  $('ticks').innerHTML = TICKS.map(function (t) { return '<span class="' + (t[2] || '') + '" style="left:' + (dayToPos(t[0]) / 10) + '%">' + t[1] + '</span>'; }).join('');
  function updateDock() {
    var dt = dateOf(DAY), opts = { weekday: 'short', month: 'short', day: 'numeric' };
    if (MAXDAY > 300) opts.year = 'numeric';
    $('date').textContent = dt.toLocaleDateString('en-US', opts);
    var dn = DAY + 1, when = dn < 120 ? 'Week ' + Math.ceil(dn / 7) + ' · day ' + dn : 'Year ' + Math.ceil(dn / 365) + ' · day ' + dn;
    $('dayno').textContent = DAY === MAXDAY ? 'Today · ' + when : when;
    var bricks = 0, standing = 0, land = 0;
    BUILDINGS.forEach(function (B) { if (B.mode === 'preview') return; B.parts.forEach(function (P) { bricks += P.owner.n; }); if (B.complete) standing++; });
    TILES.forEach(function (Tl) { if (Tl.present) land++; });
    $('s-bricks').textContent = fmt(bricks); $('s-builds').textContent = fmt(standing); $('s-land').textContent = fmt(land); $('s-army').textContent = fmt(soldiers(DAY));
    var p = Math.round(dayToPos(DAY)); if (!playing || Math.abs(+slider.value - p) > 3) slider.value = p;
    slider.style.setProperty('--fill', (slider.value / 10) + '%');
  }
  slider.addEventListener('input', function () {
    stop();
    var d = posToDay(+slider.value);
    slider.style.setProperty('--fill', (slider.value / 10) + '%');
    applyDay(d, Math.abs(d - DAY) <= 2);
  });
  function setPlayIcon() { $('playicon').setAttribute('d', playing ? 'M4 2.5h3v11H4zM9 2.5h3v11H9z' : 'M4 2.5v11l9.5-5.5z'); $('play').setAttribute('aria-label', playing ? 'Pause' : 'Play it back from the first day'); }
  // the replay takes a second for every few days, between 4 and 30 seconds in all
  var PLAY_SECS = clamp(MAXDAY / 3, 4, 30);
  function stop() { if (playing) { playing = false; setPlayIcon(); } }
  $('play').addEventListener('click', function () {
    if (playing) { stop(); return; }
    closeAll();
    playPos = +slider.value >= 999 ? 0 : +slider.value;
    if (playPos === 0) applyDay(0, false);
    playing = true; setPlayIcon();
  });

  // ---------------------------------------------------------------- labels over the 3D view
  var LABELS = [], PARTLABELS = [], layer = $('labels'), STEM = '<i class="stem" aria-hidden="true"></i>';
  function addLabel(el, pos, visible, onTap) {
    layer.appendChild(el);
    if (onTap) el.addEventListener('click', function (e) { e.stopPropagation(); onTap(); });
    var L = { el: el, pos: pos, visible: visible }; return L;
  }
  BUILDINGS.forEach(function (B) {
    if (!B.def.label) return;
    var el = document.createElement('button'); el.type = 'button'; el.className = 'lbl';
    el.innerHTML = '<b class="tag"><span>' + B.def.label + '</span><small></small></b>' + STEM;
    LABELS.push(addLabel(el, function () { return _lv.set(B.center.x, B.top + 0.9, B.center.z); }, function () { return B.exists && !SEL.B && !GEN_OPEN; }, function () { openBuilding(B); }));
    B.label = el;
  });
  (function () {
    var el = document.createElement('button'); el.type = 'button'; el.className = 'lbl go';
    el.innerHTML = '<b class="tag"><em aria-hidden="true">+</em><span>Generate project</span></b>' + STEM;
    var at = PLOT_TILE_AT || [0, 0];
    LABELS.push(addLabel(el, function () { return _lv.set(at[0] * TILE, 0.2, at[1] * TILE); }, function () { return !!PLOT_TILE_AT && plotEmpty() && !GEN_OPEN && !SEL.B; }, openGen));
  })();
  // the next plot to be claimed: a faint pencil outline staked on the paper, with its grid reference
  // columns A to E and rows 1 to 5 across the first two rings; further out the letters and numbers keep going
  function gridRef(tile) { var c = tile[0] + 2; return (c >= 0 && c < 26 ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[c] : 'x' + tile[0] + ',') + (tile[1] + 3); }
  var NEXT = { tile: null, label: null, mesh: null };
  function nextTile() { return { tile: NEXT_AT }; }
  (function () {
    var mb = [], inset = 13.1, n = 11, i, sd;
    for (sd = 0; sd < 4; sd++) for (i = 0; i < n; i++) {
      var t = -inset + (i + 0.5) * (2 * inset) / n, x = sd < 2 ? t : (sd === 2 ? -inset : inset), z = sd < 2 ? (sd === 0 ? -inset : inset) : t;
      mb.push([x, z, sd < 2 ? 1.25 : 0.16, sd < 2 ? 0.16 : 1.25]);
    }
    var mesh = new T.InstancedMesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: lin('#97938b'), transparent: true, opacity: 0.75, depthWrite: false }), mb.length);
    mb.forEach(function (d, k) { _m.makeScale(d[2], 1, d[3]).setPosition(d[0], 0.02, d[1]); mesh.setMatrixAt(k, _m); });
    mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 2; scene.add(mesh); NEXT.mesh = mesh;
    var el = document.createElement('div'); el.className = 'lbl ref'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<b class="tag"><span></span></b>' + STEM;
    var L = addLabel(el, function () { return NEXT.tile ? _lv.set(NEXT.tile.tile[0] * TILE, 0, NEXT.tile.tile[1] * TILE) : _lv.set(0, 0, 0); }, function () { return !!NEXT.tile && !SEL.B && !GEN_OPEN; }, null);
    L.opt = true; el.style.pointerEvents = 'none'; el.style.cursor = 'default'; LABELS.push(L); NEXT.label = el;
  })();
  function syncNextStake() {
    NEXT.on = !!NEXT.tile && !SEL.B && !GEN_OPEN;
    if (NEXT.on) NEXT.mesh.position.set(NEXT.tile.tile[0] * TILE, 0, NEXT.tile.tile[1] * TILE);
    else NEXT.mesh.visible = false;
  }
  var _lv = new T.Vector3(), _pv = new T.Vector3();
  var FLAG_RING = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 1.5v9M3.5 2l6 2.2-6 2.2" stroke="currentColor" stroke-width="1.4" fill="currentColor" stroke-linejoin="round"/></svg>';
  var FLAG_SM = '<svg viewBox="0 0 12 12" role="img" aria-label="Standing"><path d="M3 1v10M3 1.5l7 2.5-7 2.5" stroke="#141414" stroke-width="1.4" fill="#141414" stroke-linejoin="round"/></svg>';
  function setTag(el, sel, html) {
    var t = el.querySelector(sel); if (t._v === html) return;
    t._v = html; t.innerHTML = html; if (el._L) el._L.w = 0;
  }
  function updateLabels() {
    BUILDINGS.forEach(function (B) {
      if (!B.label) return;
      var pct = B.units ? Math.round(100 * B.parts.reduce(function (s, P) { return s + P.owner.n; }, 0) / B.units) : 0;
      setTag(B.label, 'small', B.complete ? FLAG_SM : pct + '%');
    });
    // part tags: the same ring as the sheet's row (orange = stones laid today, ink with a flag = standing)
    PARTLABELS.forEach(function (L) {
      var P = L.P, done = standing(P), cls = done ? 'done' : P.today > 0 ? 'today' : '', html = done ? FLAG_RING : String(L.num);
      if (L.ringV !== cls + html) { L.ringV = cls + html; L.ring.className = cls; L.ring.innerHTML = html; }
    });
    if (NEXT.label) { var nt = nextTile(); NEXT.tile = nt; if (nt) setTag(NEXT.label, 'span', 'Next plot · ' + gridRef(nt.tile)); }
    syncNextStake();
  }
  // labels behave like map callouts: each sits on its building. When it would cover a tag or a leader already placed,
  // it is nudged sideways on a slanted leader, then lifted by at most one tag height; a part tag (never the one you
  // picked) that still collides is left out, and so is any tag the toast covers while it shows. The tag of the part you
  // picked may also hang below its building, so it is never lost under the title card or the toast.
  var CANDS = [[0, 0], [-1, 0], [1, 0], [0, 1], [-1, 1], [1, 1]];
  var CANDS_SEL = CANDS.concat([[0, -1], [-1, -1], [1, -1]]);
  var UIRECTS = [root.querySelector('.titlecard'), $('leave'), $('recenter'), $('hint'), $('dock'), $('sheet'), $('gen')];
  // the cards over the drawing count as taken; they are measured when they change (and twice a second as a safety net),
  // not every frame
  var uiRects = [], toastRect = null, uiDirty = true, uiAt = 0, edgeTop = 8, taken = [], stems = [];
  function measureUI(now) {
    placeToast();
    uiRects.length = 0;
    UIRECTS.forEach(function (el) {
      if (el.hidden || el.classList.contains('gone') || !el.getClientRects().length) return;
      var b = el.getBoundingClientRect(); uiRects.push([b.left, b.top, b.right, b.bottom]);
    });
    var te = $('toast'); toastRect = null;
    if (!te.hidden) { var tb = te.getBoundingClientRect(); toastRect = [tb.left - 4, tb.top - 4, tb.right + 4, tb.bottom + 4]; }
    edgeTop = Math.max(4, (parseFloat(getComputedStyle($('ui')).paddingTop) || 12) - 8);
    uiDirty = false; uiAt = now;
  }
  function overlap(a, b) { return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]; }
  function segInRects(sg, rects) {
    for (var k = 1; k <= 8; k++) {
      var t = k / 9, px = sg[0] + (sg[2] - sg[0]) * t, py = sg[1] + (sg[3] - sg[1]) * t;
      for (var q = 0; q < rects.length; q++) { var r = rects[q]; if (px > r[0] && px < r[2] && py > r[1] && py < r[3]) return true; }
    }
    return false;
  }
  function placeLabels(now) {
    if (uiDirty || now - uiAt > 500) measureUI(now);
    var parts = PARTLABELS.slice().sort(function (a, b) { return (b.P === SEL.part) - (a.P === SEL.part); });
    var all = LABELS.concat(parts), tr = toastRect;
    taken.length = 0; stems.length = 0;
    for (var u = 0; u < uiRects.length; u++) taken.push(uiRects[u]);
    for (var i = 0; i < all.length; i++) {
      var L = all[i];
      if (!L.visible()) { L.el.hidden = true; continue; }
      _pv.copy(L.pos()).project(camera);
      if (_pv.z > 1 || _pv.z < -1) { L.el.hidden = true; continue; }
      var x = (_pv.x + 1) / 2 * W, y = (1 - _pv.y) / 2 * H, isSel = !!L.P && L.P === SEL.part;
      if (!L.w) { L.el._L = L; L.el.hidden = false; var tg = L.el.firstChild; L.w = tg.offsetWidth || 80; L.th = tg.offsetHeight || 24; L.sh = Math.max(0, L.el.offsetHeight - L.th - (L.lift || 0)); }
      var best = null, cands = isSel ? CANDS_SEL : CANDS;
      for (var k = 0; k < cands.length && !best; k++) {
        var down = cands[k][1] < 0, dx = cands[k][0] * L.w / 2, lift = down ? 0 : cands[k][1] * (L.th + 4);
        dx += clamp(x + dx, 8 + L.w / 2, W - 8 - L.w / 2) - (x + dx);
        var r = down ? [x + dx - L.w / 2 - 3, y + L.sh - 3, x + dx + L.w / 2 + 3, y + L.sh + L.th + 3]
          : [x + dx - L.w / 2 - 3, y - L.sh - lift - L.th - 3, x + dx + L.w / 2 + 3, y - L.sh - lift + 3];
        if (r[1] < edgeTop || r[3] > H - 6) continue;
        if (tr && overlap(r, tr)) continue;
        var ok = true;
        for (var q = 0; q < taken.length; q++) if (overlap(r, taken[q])) { ok = false; break; }
        if (!ok) continue;
        var sg = down ? [x + dx, y + L.sh, x, y + 3] : [x + dx, y - L.sh - lift, x, y - 3];
        if (segInRects(sg, taken)) continue;
        for (q = 0; q < stems.length && ok; q++) if (segInRects(stems[q], [r])) ok = false;
        if (ok) best = { dx: dx, lift: lift, r: r, sg: sg, down: down };
      }
      if (!best) {
        if (L.opt && !isSel) { L.el.hidden = true; continue; }
        best = { dx: 0, lift: 0, r: [x - L.w / 2 - 3, y - L.sh - L.th - 3, x + L.w / 2 + 3, y - L.sh + 3], sg: [x, y - L.sh, x, y - 3], down: false };
      }
      if (tr && overlap(best.r, tr) && !isSel) { L.el.hidden = true; continue; }
      taken.push(best.r); stems.push(best.sg);
      if (L.P) L.el.classList.toggle('sel', isSel);
      if ((L.lift || 0) !== best.lift || (L.dx || 0) !== best.dx || !!L.down !== best.down) {
        L.lift = best.lift; L.dx = best.dx; L.down = best.down;
        var sh = Math.max(1, L.sh - 3 + best.lift);
        L.el.classList.toggle('below', best.down);
        L.el.style.setProperty('--lift', best.lift + 'px'); L.el.style.setProperty('--dx', best.dx.toFixed(1) + 'px');
        L.el.style.setProperty('--len', Math.hypot(sh, best.dx).toFixed(1) + 'px'); L.el.style.setProperty('--rot', Math.atan2(best.dx, sh).toFixed(4) + 'rad');
      }
      L.el.hidden = false;
      L.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,' + (best.down ? '0' : '-100%') + ')';
    }
    // the staked plot is only drawn while its grid reference can be shown with it
    NEXT.mesh.visible = !!NEXT.on && !NEXT.label.hidden;
  }

  // ---------------------------------------------------------------- building sheet
  var SEL = { B: null, part: null }, GEN_OPEN = false, sheet = $('sheet'), gen = $('gen');
  var X = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  var CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function closeAll() { if (SEL.B) closeSheet(true); if (GEN_OPEN) closeGen(true); }
  function openBuilding(B) {
    if (GEN_OPEN) closeGen(true);
    stop();
    if (SEL.B && SEL.B !== B) clearSel();
    SEL.B = B; SEL.part = SEL.part && B.parts.indexOf(SEL.part) >= 0 ? SEL.part : null;
    $('dock').hidden = true; sheet.hidden = false;
    PARTLABELS.forEach(function (L) { L.el.remove(); });
    PARTLABELS = B.parts.map(function (P, i) {
      var el = document.createElement('button'); el.type = 'button'; el.className = 'lbl part';
      el.innerHTML = '<b class="tag"><i aria-hidden="true">' + (i + 1) + '</i><span></span></b>' + STEM; el.querySelector('span').textContent = P.camp || P.name;
      var L = addLabel(el, function () { return P.center; }, function () { return SEL.B === B; }, function () { selectPart(P); });
      L.P = P; L.opt = true; L.num = i + 1; L.ring = el.querySelector('i'); return L;
    });
    applyDay(DAY, false, true);
    renderSheet();
    sheet.scrollTop = 0;
    requestAnimationFrame(focusSel);
  }
  function clearSel() { if (!SEL.B) return; SEL.B.parts.forEach(function (P) { setTint(P.owner, false); }); }
  function focusSel() {
    var B = SEL.B; if (!B) return;
    if (SEL.part) focus(SEL.part.center, Math.max(7, B.radius * 0.55)); else focus(new T.Vector3(B.center.x, B.top, B.center.z), B.radius * 1.05);
  }
  function selectPart(P) {
    SEL.part = SEL.part === P ? null : P;
    renderSheet(); focusSel();
  }
  function closeSheet(silent) {
    clearSel(); SEL.B = null; SEL.part = null;
    PARTLABELS.forEach(function (L) { L.el.remove(); }); PARTLABELS = [];
    sheet.hidden = true; $('dock').hidden = false; uiDirty = true;
    applyDay(DAY, false, true);
    if (!silent) { if (!userCam) requestAnimationFrame(fitVillage); else requestAnimationFrame(function () { frameOffset(); }); }
  }
  // meta lines break only between their · segments
  function nw(t) { return '<span class="nw">' + t + '</span>'; }
  function refreshSheet() { if (SEL.B && !sheet.hidden) renderSheet(); }
  function bar(P) {
    var w = P.steps ? Math.round(100 * P.done / P.steps) : 0;
    var todayW = P.today > 0 ? Math.max(3, Math.round(100 * P.today / P.units)) : 0;
    return '<span class="bar"><i style="width:' + Math.max(0, w - todayW) + '%;float:left"></i><i class="today" style="width:' + todayW + '%;float:left;border-radius:0 3px 3px 0"></i></span>';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function plural(n, one, many) { return fmt(n) + ' ' + (n === 1 ? one : many); }
  // the steps a part shows: the next ones to do, then a few of the latest done
  var TODO_SHOWN = 12;
  function partSteps(P) {
    var todo = P.list.filter(function (st) { return !st.done_on; }), done = P.list.filter(function (st) { return st.done_on; });
    done.sort(function (a, b) { return a.done_on < b.done_on ? 1 : a.done_on > b.done_on ? -1 : 0; });
    return { todo: todo.slice(0, TODO_SHOWN), more: Math.max(0, todo.length - TODO_SHOWN), done: done.slice(0, 3), doneAll: done.length };
  }
  var SHOWN = [];
  function stepBtn(st) {
    var k = SHOWN.push(st) - 1, on = !!st.done_on;
    return '<button type="button" class="step' + (on ? ' on' : '') + '" data-step="' + k + '" aria-pressed="' + on + '"><i>' + CHECK + '</i><span>' + esc(st.text) + '</span></button>';
  }
  function renderSheet() {
    var B = SEL.B; if (!B) return;
    var def = B.def, kind = KIND[B.kind].name;
    B.parts.forEach(function (P) { setTint(P.owner, P === SEL.part); });
    var laid = B.parts.reduce(function (s, P) { return s + P.owner.n; }, 0), up = B.parts.filter(standing).length;
    var h = '<div class="sheet-head"><div><span class="eyebrow">' + (def.type === 'Lesson' ? 'Lesson · ' : 'Quest · ') + kind + '</span><h2>' + esc(def.name) + '</h2></div><button class="close" type="button" data-close aria-label="Close">' + X + '</button></div>';
    var chips = ['<span class="chip ref">Plot ' + gridRef(def.tile) + '</span>'];
    if (def.goal) chips.push('<span class="chip or"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 10.5L6 2l5 8.5z" fill="none" stroke="#141414" stroke-width="1.3" stroke-linejoin="round"/><path d="M4.2 5.6L6 6.8l1.6-1.1" fill="none" stroke="#141414" stroke-width="1.1"/></svg>' + esc(def.goal) + '</span>');
    chips.push('<span class="chip">' + plural(def.camps.length, 'camp', 'camps') + '</span>');
    chips.push('<span class="chip">' + plural(B.steps, 'step', 'steps') + '</span>');
    h += '<div class="chips">' + chips.join('') + '</div>';
    if (def.note) h += '<p class="note">' + esc(def.note) + '</p>';
    if (!B.steps) h += '<p class="note">Its camps have no steps yet. Add steps to a camp and bricks start landing here as you tick them.</p>';
    h += '<span class="sub">' + nw(fmt(laid) + ' of ' + fmt(B.units) + ' bricks') + ' · ' + nw(up + ' of ' + B.parts.length + ' parts standing') + (B.complete ? ' · ' + nw('banner up') : '') + '</span>';
    h += '<div class="label">Parts · build in any order</div><div class="parts">';
    B.parts.forEach(function (P, i) {
      var done = standing(P), pct = P.steps ? Math.round(100 * P.done / P.steps) : 0;
      h += '<button type="button" class="prow' + (P === SEL.part ? ' sel' : '') + '" data-part="' + i + '" aria-pressed="' + (P === SEL.part) + '">' +
        '<span class="num' + (done ? ' done' : P.today > 0 ? ' today' : '') + '" aria-hidden="true">' + (done ? '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1v10M3 1.5l7 2.5-7 2.5" stroke="#ffffff" stroke-width="1.4" fill="#ffffff" stroke-linejoin="round"/></svg>' : (i + 1)) + '</span>' +
        '<span class="nm">' + (P.camp ? esc(P.camp) + '<small>' + P.name + '</small>' : P.name) + '</span>' +
        '<span class="pct' + (done ? ' done' : '') + '">' + (done ? 'Standing' : !P.steps ? 'No steps' : (P.today > 0 ? '<span class="td">+' + P.today + ' today</span> · ' : '') + pct + '%') + '</span>' + bar(P) + '</button>';
    });
    h += '</div>';
    var P = SEL.part;
    SHOWN = [];
    if (P) {
      h += '<div class="detail"><h3>' + P.name + (P.camp ? ' · ' + esc(P.camp) : '') + '</h3><span class="sub">' + nw(P.done + ' of ' + plural(P.steps, 'step', 'steps')) + ' · ' + nw(P.owner.n + ' of ' + P.units + ' bricks') + (P.today > 0 ? ' · ' + nw('+' + P.today + ' today') : '') + '</span>';
      if (!P.campIds.length) h += '<p class="note">No camp builds this part yet.</p>';
      else if (!P.steps) h += '<p class="note">The camp has no steps yet. Add them in the camp and tick them here or there.</p>';
      else {
        if (DAY !== MAXDAY) h += '<p class="note">You\'re looking back at ' + shortDate(DAY, true) + '. Ticking a step counts it today.</p>';
        h += '<p class="note">Each step lays about ' + Math.max(1, Math.round(P.units / P.steps)) + ' bricks here.</p>';
        var ps = partSteps(P);
        if (ps.todo.length) { h += '<span class="sub">Next to do</span>'; ps.todo.forEach(function (st) { h += stepBtn(st); }); }
        else h += '<p class="note">Standing. Its pennant is up.</p>';
        if (ps.more) h += '<span class="sub">' + plural(ps.more, 'more step', 'more steps') + ' in the camp</span>';
        if (ps.done.length) { h += '<span class="sub">Done lately · ' + fmt(ps.doneAll) + ' in all</span>'; ps.done.forEach(function (st) { h += stepBtn(st); }); }
      }
      if (P.campIds.length) h += '<button type="button" class="btn ghost" data-camp="' + esc(P.campIds[0]) + '">Open the camp</button>';
      h += '</div>';
    }
    sheet.innerHTML = h; uiDirty = true;
  }
  sheet.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-close')) { closeSheet(); return; }
    if (t.hasAttribute('data-part')) { selectPart(SEL.B.parts[+t.getAttribute('data-part')]); return; }
    if (t.hasAttribute('data-camp')) { api.open('/ascent/camp/' + t.getAttribute('data-camp')); return; }
    if (t.hasAttribute('data-step')) {
      var st = SHOWN[+t.getAttribute('data-step')], P = SEL.part; if (!st || !P) return;
      var was = st.done_on, before = P.owner.n;
      st.done_on = was ? null : data.today; st._d = stepDay(st);
      applyDay(MAXDAY, true, true);
      var diff = P.owner.n - before;
      haptic(was ? 'tap' : 'success');
      toast(diff > 0 ? '+' + diff + ' bricks on the ' + P.name : diff < 0 ? -diff + ' bricks taken back off' : was ? 'Step opened again' : 'Step done', diff > 0);
      api.toggleStep(st, st.done_on).catch(function () {
        st.done_on = was; st._d = stepDay(st);
        applyDay(MAXDAY, false, true);
        toast('Couldn\'t save that step. Try again.');
      });
    }
  });
  var toastT = null;
  // the swatch is a brick: orange when the message is about stones laid today
  function toast(msg, today) {
    var el = $('toast'); el.innerHTML = '<i' + (today ? ' class="today"' : '') + '></i><span></span>'; el.lastChild.textContent = msg; el.hidden = false;
    placeToast(); uiDirty = true;
    clearTimeout(toastT); toastT = setTimeout(function () { el.hidden = true; uiDirty = true; }, 2200);
  }
  // under the title card; on a phone with a sheet open, just above the sheet (clear of the building in focus);
  // on a wide screen with a panel open, centred in the drawing left of it
  function placeToast() {
    var el = $('toast'); if (el.hidden) return;
    var panel = !sheet.hidden ? sheet : !gen.hidden ? gen : SIDE.matches ? $('dock') : null, top = root.querySelector('.top').getBoundingClientRect().bottom + 12, left = W / 2, maxW = '';
    if (panel) {
      var r = panel.getBoundingClientRect();
      if (window.innerWidth >= 900 || SIDE.matches) { left = r.left / 2; maxW = Math.max(200, r.left - 32) + 'px'; }
      else top = Math.max(top, r.top - el.offsetHeight - 12);
    }
    el.style.left = left + 'px'; el.style.top = top + 'px'; el.style.maxWidth = maxW;
  }

  // ---------------------------------------------------------------- Generate project
  function genOptions() {
    var q = WAITING[PLOT.q];
    PLOT.opts = q.steps ? buildOptions(q.id, q.steps, PLOT.roll).map(function (o) {
      var b = new Builder(o.seed); GEN[o.kind](b);
      var parts = b.parts.filter(function (p) { return !p.hidden; });
      return { kind: o.kind, seed: o.seed, steps: q.steps, units: parts.reduce(function (s, p) { return s + p.units; }, 0), parts: parts.map(function (p) { return p.name; }) };
    }) : [];
  }
  function openGen() {
    if (SEL.B) closeSheet(true);
    stop();
    GEN_OPEN = true; PLOT.sel = 0;
    if (!PLOT.opts.length) genOptions();
    $('dock').hidden = true; gen.hidden = false;
    renderGen();
    previewOpt();
    gen.scrollTop = 0;
  }
  function previewOpt() {
    var o = PLOT.opts[PLOT.sel];
    PLOT.preview = o ? { kind: o.kind, seed: o.seed, steps: o.steps } : null;
    rebuildPlot();
    requestAnimationFrame(focusPlot);
  }
  function focusPlot() {
    if (PLOT_B) focus(new T.Vector3(PLOT_B.center.x, PLOT_B.top, PLOT_B.center.z), Math.max(10, PLOT_B.radius * 1.05));
    else if (PLOT_TILE_AT) focus(new T.Vector3(PLOT_TILE_AT[0] * TILE, 2, PLOT_TILE_AT[1] * TILE), 26);
  }
  function closeGen(silent) {
    GEN_OPEN = false; gen.hidden = true; $('dock').hidden = false; uiDirty = true;
    if (PLOT.preview) { PLOT.preview = null; rebuildPlot(); }
    if (!silent) requestAnimationFrame(function () { if (!userCam) fitVillage(); else frameOffset(); });
  }
  function renderGen() {
    var q = WAITING[PLOT.q];
    var h = '<div class="sheet-head"><div><span class="eyebrow">Generate project · Plot ' + gridRef(PLOT_TILE_AT) + '</span><h2>What will this quest build?</h2></div><button class="close" type="button" data-close aria-label="Close">' + X + '</button></div>';
    if (WAITING.length > 1) h += '<div class="label">Quest</div><div class="seg" role="group" aria-label="Quest">' + WAITING.map(function (w, i) { return '<button type="button" data-q="' + i + '" aria-pressed="' + (i === PLOT.q) + '">' + esc(shortName(w.name)) + '</button>'; }).join('') + '</div>';
    h += '<p class="note serif">' + esc(q.name) + '</p>';
    if (!q.steps) {
      h += '<p class="note">Its camps don\'t have steps yet. Lay out its steps first, by hand or from a plan, and the three builds will be sized to fit them. Each camp becomes one part.</p>';
      h += '<div class="actions"><button type="button" class="btn ghost" data-plans>Plans</button><button type="button" class="btn dark" data-camp="' + esc(q.camps[0].id) + '">Add steps</button></div>';
    } else {
      h += '<p class="note">' + bandLine(q.steps) + ' Each of its ' + plural(q.camps.length, 'camp', 'camps') + ' builds one part.</p><div class="opts">';
      PLOT.opts.forEach(function (o, i) {
        var k = KIND[o.kind];
        h += '<button type="button" class="opt" data-opt="' + i + '" aria-pressed="' + (i === PLOT.sel) + '"><span class="dot"></span><b>' + k.name + '</b><span>' + k.line + '</span><em>' + o.parts.length + ' parts · ' + fmt(o.units) + ' bricks · about ' + Math.max(1, Math.round(o.units / o.steps)) + ' a step</em></button>';
      });
      h += '</div><div class="actions"><button type="button" class="btn ghost" data-again' + (PLOT.busy ? ' disabled' : '') + '>Generate again</button><button type="button" class="btn dark" data-build' + (PLOT.busy ? ' disabled' : '') + '>' + (PLOT.busy ? 'Building…' : 'Build this') + '</button></div>';
    }
    gen.innerHTML = h; uiDirty = true;
  }
  gen.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t || t.disabled) return;
    if (t.hasAttribute('data-close')) { closeGen(); return; }
    if (t.hasAttribute('data-plans')) { api.open('/ascent/plans'); return; }
    if (t.hasAttribute('data-camp')) { api.open('/ascent/camp/' + t.getAttribute('data-camp')); return; }
    if (t.hasAttribute('data-q')) { PLOT.q = +t.getAttribute('data-q'); PLOT.roll = 0; PLOT.sel = 0; genOptions(); previewOpt(); renderGen(); return; }
    if (t.hasAttribute('data-opt')) { PLOT.sel = +t.getAttribute('data-opt'); previewOpt(); renderGen(); return; }
    if (t.hasAttribute('data-again')) { PLOT.roll++; PLOT.sel = 0; genOptions(); previewOpt(); renderGen(); return; }
    if (t.hasAttribute('data-build')) {
      var o = PLOT.opts[PLOT.sel], q = WAITING[PLOT.q];
      PLOT.busy = true; renderGen(); haptic('success');
      api.build({ quest_id: q.id, kind: o.kind, seed: o.seed, plot: data.nextPlot }).catch(function () {
        if (dead) return;
        PLOT.busy = false; renderGen();
        toast('Couldn\'t save that build. Try again.');
      });
    }
  });

  // ---------------------------------------------------------------- frame loop
  var last = performance.now(), _a = new T.Matrix4(), _b = new T.Matrix4(), _r = new T.Matrix4(), _v3 = new T.Vector3(), _e = new T.Euler();
  var needle = $('needle'), needleDeg = null;
  function ease(k) { return 1 - Math.pow(1 - k, 3); }
  var camWas = [0, 0, 0], rdtLast = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (hintT === null) hintT = setTimeout(interacted, 7000);
    if (playing) {
      playPos = Math.min(1000, playPos + dt * 1000 / PLAY_SECS);
      var d = posToDay(playPos);
      if (d !== DAY) applyDay(d, true);
      slider.value = Math.round(playPos); slider.style.setProperty('--fill', (playPos / 10) + '%');
      if (playPos >= 1000) { stop(); toast('That\'s where it stands today.'); }
    }
    var k = 1 - Math.exp(-dt * 5);
    ['th', 'ph', 'dist', 'tx', 'ty', 'tz', 'ox', 'oy'].forEach(function (key) { view[key] += (goal[key] - view[key]) * k; });
    placeCamera();
    camera.updateMatrixWorld();
    // screen-space hatching shimmers while the view turns, so it eases off while moving and back in ~250 ms at rest
    var rdt = Math.min(1, (now - rdtLast) / 1000); rdtLast = now;
    var mv = Math.abs(view.th - camWas[0]) + Math.abs(view.ph - camWas[1]) + Math.abs(view.dist - camWas[2]) / Math.max(1, view.dist) * 3;
    camWas[0] = view.th; camWas[1] = view.ph; camWas[2] = view.dist;
    var moving = mv > 0.0012 || ptrs.size > 1 || (drag && drag.moved > 6);
    INK.uHatchMove.value += ((moving ? 0.45 : 1) - INK.uHatchMove.value) * (1 - Math.exp(-rdt * (moving ? 18 : 12)));
    INK.uSunV.value.copy(SUN_DIR).transformDirection(camera.matrixWorldInverse);
    INK.uCamW.value.copy(camera.position);
    INK.uUpV.value.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
    var deg = Math.round(view.th * 180 / Math.PI * 4) / 4;
    if (deg !== needleDeg) { needleDeg = deg; needle.setAttribute('transform', 'rotate(' + deg + ' 20 20)'); }
    var i, pc, pool;
    for (i = ANIMS.length - 1; i >= 0; i--) {
      var A = ANIMS[i]; pc = A.pc;
      if (pc.ord >= pc.owner.n) { ANIMS.splice(i, 1); continue; }
      var t = (now - A.t0) / A.dur;
      if (t < 0) continue;
      if (t >= 1) { show(pc, true); ANIMS.splice(i, 1); continue; }
      _a.copy(pc.m); _a.elements[13] += (1 - ease(t)) * 6;
      setM(POOLS[pc.g], pc.idx, _a);
    }
    TILES.forEach(function (Tl) {
      if (Tl.decor && Tl.decorAt && now >= Tl.decorAt) { Tl.decorAt = null; setCount(Tl.decor, Tl.present ? 1 : 0, true); }
      if (Tl.rise === null) return;
      var t = (now - Tl.rise) / 650;
      if (t >= 1) { Tl.mesh.position.y = -DEPTH / 2; Tl.rise = null; }
      else Tl.mesh.position.y = -DEPTH / 2 - 16 * (1 - ease(Math.max(0, t)));
    });
    var secs = now / 1000;
    if (!REDUCED) {
      for (i = 0; i < SPIN.length; i++) {
        pc = SPIN[i]; if (pc.ord >= pc.owner.n) continue;
        _r.makeRotationZ(pc.fl.spin.a0 - secs * 0.9);
        _a.copy(pc.spA).multiply(_r).multiply(pc.spB);
        pc.m.copy(_a); setM(POOLS[pc.g], pc.idx, _a);
        if (pc.owner.ghost) { /* ghosts of turning sails stay put */ }
      }
      for (i = 0; i < FLAME.length; i++) {
        pc = FLAME[i]; if (pc.ord >= pc.owner.n) continue;
        var f = 1 + 0.16 * Math.sin(secs * 9 + pc.fl.flame) + 0.08 * Math.sin(secs * 17 + pc.fl.flame * 2);
        _b.makeScale(1 + (f - 1) * 0.4, f, 1 + (f - 1) * 0.4); _a.copy(pc.m).multiply(_b);
        setM(POOLS[pc.g], pc.idx, _a);
      }
      for (i = 0; i < FLAGS.length; i++) {
        pc = FLAGS[i]; if (pc.ord >= pc.owner.n) continue;
        _b.makeRotationY(0.22 * Math.sin(secs * 2.2 + pc.fl.flag)); _a.copy(pc.m).multiply(_b);
        setM(POOLS[pc.g], pc.idx, _a);
      }
    }
    for (i = 0; i < SMOKE.length; i++) {
      pc = SMOKE[i]; pool = POOLS[pc.g];
      if (pc.ord >= pc.owner.n) continue;
      var ph = REDUCED ? pc.fl.smoke : (secs * 0.22 + pc.fl.smoke) % 1, sc = (0.35 + ph * 0.9) * (ph > 0.8 ? (1 - ph) / 0.2 : 1);
      _a.copy(pc.m); _a.elements[12] += ph * 1.2; _a.elements[13] += ph * 3.6;
      _b.makeScale(sc / 0.4, sc / 0.4, sc / 0.4); _a.multiply(_b);
      setM(pool, pc.idx, _a);
    }
    // soldiers walk laps around the plaza
    var lanes = [[4.0, 14], [5.25, 18], [6.2, 16]], n = GARRISON.n;
    for (i = 0; i < GARRISON.list.length; i++) {
      pc = GARRISON.list[i]; var s = pc.fl.walk; if (s >= n) continue;
      var lane = s < 14 ? 0 : s < 32 ? 1 : 2, idx = lane === 0 ? s : lane === 1 ? s - 14 : s - 32, L = lanes[lane];
      var dir = lane === 1 ? -1 : 1, a = (REDUCED ? 0 : secs * 0.1 * dir) - dir * idx * (Math.PI * 2 / L[1]) + lane * 0.4;
      var x = Math.cos(a) * L[0], z = Math.sin(a) * L[0], yaw = Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir);
      var bob = REDUCED ? 0 : Math.abs(Math.sin(secs * 6 + s)) * 0.06;
      _q.setFromAxisAngle(UP, yaw); _v3.set(pc.fl.off[0], pc.fl.off[1] + bob, pc.fl.off[2]).applyQuaternion(_q);
      _p.set(x + _v3.x, _v3.y, z + _v3.z); _s.set(pc.sx, pc.sy, pc.sz);
      if (pc.q) _q.multiply(pc.q);
      _a.compose(_p, _q, _s);
      setM(POOLS[pc.g], pc.idx, _a);
    }
    Object.keys(POOLS).forEach(function (g) {
      var P = POOLS[g];
      upload(P.mesh.instanceMatrix, P.lo, P.hi); P.lo = Infinity; P.hi = -1;
      if (P.ghost) { upload(P.ghost.instanceMatrix, P.glo, P.ghi); P.glo = Infinity; P.ghi = -1; }
      if (P.cdirty) { if (P.mesh.instanceColor) P.mesh.instanceColor.needsUpdate = true; if (P.ghost && P.ghost.instanceColor) P.ghost.instanceColor.needsUpdate = true; P.cdirty = false; }
      if (P.ghost) { P.ghost.visible = P.ghostN > 0; if (P.ghostHull) P.ghostHull.visible = P.ghostN > 0; }
    });
    syncTileHull();
    renderer.render(scene, camera);
    placeLabels(now);
    raf = requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- start
  var raf = 0, dead = false;
  window.addEventListener('resize', resize);
  $('leave').addEventListener('click', function () { api.close(); });
  // the app's tap haptic listens on the page, which can't see into the village, so it plays from here
  root.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('button')) haptic('tap'); });
  rebuildPlot();
  resize();
  applyDay(MAXDAY, false, true);
  fitVillage();
  ['th', 'ph', 'dist', 'tx', 'ty', 'tz', 'ox', 'oy'].forEach(function (key) { view[key] = goal[key]; });
  raf = requestAnimationFrame(frame);
  if (data.focus) { var fb = BUILDINGS.filter(function (B) { return B.def.id === data.focus; })[0]; if (fb) { openBuilding(fb); toast(KIND[fb.kind].name + ' it is. Its plot is staked out.'); } }

  // for the page's own checks: the camera, the day and the buildings
  host.__village = { renderer: renderer, scene: scene, camera: camera, snap: function () { ['th', 'ph', 'dist', 'tx', 'ty', 'tz', 'ox', 'oy'].forEach(function (k) { view[k] = goal[k]; }); }, applyDay: applyDay, openBuilding: openBuilding, openGen: openGen, BUILDINGS: BUILDINGS, goal: goal, view: view, POOLS: POOLS, get DAY() { return DAY; } };

  return {
    destroy: function () {
      dead = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      clearTimeout(hintT); clearTimeout(toastT);
      scene.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); });
      });
      renderer.dispose();
      renderer.forceContextLoss();
      delete host.__village;
      root.innerHTML = '';
    }
  };
}
