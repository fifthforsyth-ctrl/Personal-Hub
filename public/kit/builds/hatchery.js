// Fire ring (kind 'hatchery'): a ring of warm dark stone round a pit of glowing coals with an iron pot hung over it on
// a tripod, log seats about the fire, braziers at the way in, a great iron fire basket on a rock of stacked slabs, and
// a keeper's lean-to with a slate roof. Built footings first, the ring course by course, the coals and the pot, then
// each seat as its own step, the braziers, the rock and its fire basket, the lean-to wall by course and its roof row by
// row, the tools and stores, the way in, and last the people: the keeper raking the coals, a child warming his hands,
// a villager bringing in an armful of firewood and the woodcutter at his block.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL, U = KIT.util, G = KIT.geo;
  PAL.hatchery_stone = ['#6f665c', '#675e55', '#786d62', '#5f5750', '#80756a', '#6b6259', '#736a5f'];
  PAL.hatchery_cap = ['#857a6e', '#7c7166', '#8d8276', '#776d63'];
  PAL.hatchery_rock = ['#a1978a', '#978d80', '#aba194', '#8f867a'];
  PAL.hatchery_twig = ['#3b332b', '#463c32', '#2f2924', '#54483b', '#3f372f', '#5c5042'];
  function V(x, y, z) { return new T.Vector3(x, y, z); }

  // ---------------------------------------------------------------- poses for the people here
  var P = KIT.people.poses;
  // kneeling on one knee at the coals, leaning in, both hands low on a poker
  P.hatchery_tend = function (r) { return { feet: [V(-0.16, 0.09, 0.32), V(0.15, 0.12, -0.42)], hands: [V(-0.1, 0.8, 0.5), V(0.12, 0.72, 0.4)], lean: 0.42, twist: r(0.08), side: 0.02, hip: 0, drop: 0.38, head: [r(0.1), 0.35], pole: [V(-0.6, -0.4, -0.3), V(0.6, -0.4, -0.3)] }; };
  // carrying an armful of firewood against the chest, walking
  P.hatchery_hold = function (r) { return { feet: [V(-0.1, 0.12, 0.22), V(0.11, 0.1, -0.2)], hands: [V(-0.17, 1.0, 0.3), V(0.17, 1.0, 0.3)], lean: -0.04, twist: 0, side: 0, hip: 0, drop: 0.02, head: [r(0.1), 0.25], pole: [V(-0.8, -0.4, -0.2), V(0.8, -0.4, -0.2)] }; };
  // a child kneeling, one hand held out to the warmth
  P.hatchery_kneel = function (r) { return { feet: [V(-0.15, 0.09, 0.3), V(0.15, 0.12, -0.42)], hands: [V(-0.12, 0.9, 0.62), V(0.22, 0.6, 0.22)], lean: 0.3, twist: -0.1, side: 0, hip: 0, drop: 0.4, head: [0.1, 0.3], pole: [V(-0.6, -0.3, -0.4), V(0.6, -0.4, -0.3)] }; };

  // a point in figure space (x, y, z) for a figure at (fx, fz) turned ry, in the build frame
  function fig(fx, fz, ry, x, y, z, s) { s = s || 1; return [fx + (x * Math.cos(ry) + z * Math.sin(ry)) * s, y * s, fz + (-x * Math.sin(ry) + z * Math.cos(ry)) * s]; }

  // ---------------------------------------------------------------- pieces
  // a slate or shingle, darker at its upper end where the row above covers it
  var SLATE = {};
  function slateGeo(w, t, len) {
    var key = [w, t, len].join(',');
    if (SLATE[key]) return SLATE[key];
    var g = G.chamferBox(w, t, len, Math.min(0.025, t * 0.3)), p = g.attributes.position, c = [];
    for (var i = 0; i < p.count; i++) { var f = (p.getZ(i) + len / 2) / len, v = U.lerp(0.6, 1, Math.pow(U.smooth(0, 0.8, f), 0.8)); c.push(v, v, v * 0.98); }
    g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
    return (SLATE[key] = g);
  }
  // A single-pitch roof laid from the eave up, a row a step: from the eave line (x0..x1 at zf, yf) up to the back
  // (zb, yb). Each row's slates fill the width exactly, the odd rows starting with a half slate; each slate lies a
  // little flatter than the roof so its lower edge rests on the row below.
  function leanRoof(b, x0, x1, zf, yf, zb, yb, o) {
    o = o || {};
    var run = Math.hypot(zf - zb, yb - yf), slope = Math.atan2(yb - yf, zf - zb), rows = o.rows || Math.max(3, Math.round(run / 0.5)), rl = run / rows;
    var pw = o.pitch || 0.4, L = x1 - x0, n = Math.max(2, Math.round(L / pw)), w = L / n, th = o.thick || 0.06, pal = o.pal || 'slate';
    for (var r = 0; r < rows; r++) {
      (function (r) {
        b.unit(function () {
          var len = rl * 1.45, tm = r * rl + len / 2 - rl * 0.1, i;
          var cy = yf + Math.sin(slope) * tm + r * 0.003, cz = zf - Math.cos(slope) * tm, edges = [];
          if (r % 2) { edges.push(x0); for (i = 0; i < n; i++) edges.push(x0 + (i + 0.5) * w); edges.push(x1); } else for (i = 0; i <= n; i++) edges.push(x0 + i * w);
          for (i = 0; i < edges.length - 1; i++) {
            var a = edges[i], c = edges[i + 1], g = slateGeo(Math.round((c - a - 0.03) * 1000) / 1000, th, Math.round(len * 1000) / 1000);
            var cc = U.col(b.pick(PAL[pal])), q = b.r();
            if (q < 0.14) cc.offsetHSL(0.006, -0.03, -0.04); else if (q < 0.26) cc.offsetHSL(-0.004, 0.01, 0.03); else if (q < 0.3) cc.lerp(new T.Color('#7f8657'), 0.14);
            b.addGeo(g, { x: (a + c) / 2 + b.j(0.008), y: cy, z: cz + b.j(0.015), rx: slope - 0.05 + b.j(0.01), ry: b.j(0.02), rz: b.j(0.012), c: cc, m: M.tile, ao: 0.3, jit: 0.02, vary: 0.04 });
          }
        });
      })(r);
    }
  }
  // a seat by the fire: a split log, flat face up, on two short stumps, centred at (x, y, z) and running along local x
  // turned ry, L long
  function logSeat(b, x, y, z, ry, L) {
    b.push(x, y, z, ry);
    [-1, 1].forEach(function (sd) { b.cyl(sd * L * 0.32, 0, b.j(0.03), 0.15 + b.r() * 0.02, 0.28, { c: b.pick(PAL.wood), m: M.wood, seg: 9, ao: 0.25 }); b.cyl(sd * L * 0.32, 0.28, 0, 0.15, 0.012, { c: '#b89a74', m: M.wood, seg: 9, ao: 0 }); });
    var half = [], n = 8;
    for (var i = 0; i <= n; i++) { var t = Math.PI + i / n * Math.PI; half.push([Math.cos(t) * 0.17, Math.sin(t) * 0.17 * 0.9]); }
    b.addGeo(G.extrude(half, L, { bevel: 0.012 }), { x: -L / 2, y: 0.28 + 0.155, z: 0, ry: Math.PI / 2, c: b.pick(PAL.wood), m: M.wood, ao: 0.2, jit: 0.01 });
    b.box(0, 0.28 + 0.15, 0, L - 0.04, 0.012, 0.3, { c: '#b89a74', m: M.wood, bevel: 0.004 });
    b.pop();
  }
  // a slab of rock: an irregular outline (radius rx by rz, turned rot), h thick, its top at y + h; lumpy flanks
  function rockSlab(b, x, y, z, rx, rz, h, rot, seed, pal) {
    var n = 13, pts = [];
    for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2, k = 0.86 + 0.22 * (U.noise3(Math.cos(a) * 1.7 + seed, Math.sin(a) * 1.7, seed) + 0.5) * 0.9; pts.push([Math.cos(a) * rx * k, Math.sin(a) * rz * k]); }
    var g = G.extrude(pts, h, { bevel: 0.08 }), p = g.attributes.position;
    // the extrusion runs along z: lay it flat, then rough up the sides (the top stays nearly level)
    g.rotateX(-Math.PI / 2); g.computeBoundingBox(); var y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
    for (var j = 0; j < p.count; j++) {
      var px = p.getX(j), py = p.getY(j), pz = p.getZ(j), f = (py - y0) / (y1 - y0), nz = U.noise3(px * 1.3 + seed, py * 2.1, pz * 1.3);
      var k2 = 1 + nz * 0.08 * (1 - f * 0.7) - (f > 0.9 ? 0.04 : 0);
      p.setXYZ(j, px * k2, py + (f > 0.92 ? U.noise3(px * 0.9, seed, pz * 0.9) * 0.025 : nz * 0.05), pz * k2);
    }
    g = G.flat(g);
    b.addGeo(g, { x: x, y: y - y0, z: z, ry: rot, c: b.pick(PAL[pal || 'hatchery_rock']), m: M.rock, ao: 0.35, jit: 0.03, vary: 0.08 });
  }
  // a carved dragon-head finial in the XY plane, snout to local +x, neck foot at (x, y, z), turned ry, s tall
  var HEAD = [[-0.09, 0], [0.09, 0], [0.11, 0.24], [0.16, 0.44], [0.27, 0.57], [0.46, 0.61], [0.66, 0.62], [0.75, 0.67], [0.56, 0.7], [0.46, 0.73], [0.63, 0.78], [0.81, 0.81], [0.83, 0.87], [0.64, 0.92], [0.47, 0.96], [0.33, 1.02], [0.13, 1.24], [0.21, 0.99], [0.07, 0.91], [-0.04, 0.88], [-0.11, 0.72], [-0.07, 0.62], [-0.14, 0.46], [-0.1, 0.3], [-0.12, 0.12]];
  function finial(b, x, y, z, ry, s) {
    b.push(x, y, z, ry);
    b.extrude(0, 0, 0, HEAD.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.13 * s, { c: 'woodDark', m: M.wood, bevel: 0.012 * s });
    b.box(0.02 * s, 0.3 * s, 0, 0.3 * s, 0.06 * s, 0.17 * s, { c: '#3d3934', m: M.wood, bevel: 0.01 * s, rz: 0.15 });
    [-1, 1].forEach(function (sd) { b.ball(0.54 * s, 0.86 * s, sd * 0.075 * s, 0.028 * s, { c: '#e9e4da', m: M.paint, detail: 0, ao: 0 }); });
    [0.55, 0.65].forEach(function (tx) { b.extrude(tx * s, 0.7 * s, 0, [[-0.022 * s, 0], [0.022 * s, 0], [0, -0.05 * s]], 0.05 * s, { c: '#e9e4da', m: M.paint, ao: 0 }); });
    b.pop();
  }
  // a stave post: a dark squared post with carved bands and a knot, on a stone pad, h tall
  function stavePost(b, x, z, h, o) {
    o = o || {};
    b.box(x, -0.02, z, 0.42, 0.16, 0.42, { c: b.pick(PAL.hatchery_cap), m: M.stone, bevel: 0.04 });
    b.post(x, 0.14, z, 0.1, h - 0.14, { c: 'woodDark', ry: o.ry || 0 });
    [0.35, h * 0.55, h - 0.25].forEach(function (yy, i) { b.box(x, yy, z, 0.25, i === 1 ? 0.14 : 0.08, 0.25, { c: '#3a3631', m: M.wood, bevel: 0.025, ry: (o.ry || 0) + 0.785 * (i % 2) }); });
    // a rope of carving twisting up the middle
    for (var k = 0; k < 6; k++) { var yy2 = h * 0.62 + k * 0.08, a = k * 1.05 + (o.ry || 0); b.ball(x + Math.cos(a) * 0.105, yy2, z + Math.sin(a) * 0.105, 0.035, { c: '#46413a', m: M.wood, detail: 0, ao: 0 }); }
  }
  // a long-handled tool leaning on a wall: from foot (x, y, z) up to top; kind 'shovel' | 'rake' | 'poker' | 'tongs'
  function tool(b, kind, foot, top) {
    var d = V(top[0] - foot[0], top[1] - foot[1], top[2] - foot[2]), L = d.length(); d.normalize();
    if (kind === 'poker' || kind === 'tongs') {
      var sp = kind === 'tongs' ? 0.04 : 0;
      [-1, 1].forEach(function (sd) { if (!sp && sd > 0) return; b.beam([foot[0] + sd * sp, foot[1], foot[2]], [top[0] - sd * sp * 0.2, top[1], top[2]], 0.014, { round: true, seg: 5, c: 'iron', m: M.metal }); });
      if (kind === 'poker') { b.beam(foot, [foot[0] + 0.1, foot[1] + 0.06, foot[2]], 0.014, { round: true, seg: 5, c: 'iron', m: M.metal }); b.cyl(top[0], top[1] - 0.18, top[2], 0.025, 0.18, { c: 'wood', m: M.wood, seg: 6 }); }
      else { b.box(top[0], top[1] - 0.05, top[2], 0.08, 0.06, 0.03, { c: 'iron', m: M.metal, bevel: 0.01 }); }
      return;
    }
    b.beam(foot, top, 0.022, { round: true, seg: 6, c: 'woodLight', m: M.wood });
    if (kind === 'shovel') b.box(foot[0], foot[1] - 0.02, foot[2], 0.24, 0.32, 0.03, { c: 'iron', m: M.metal, bevel: 0.01, rx: -0.12 });
    if (kind === 'rake') { b.box(foot[0], foot[1] + 0.06, foot[2], 0.42, 0.04, 0.05, { c: 'iron', m: M.metal, bevel: 0.008 }); for (var i = 0; i < 6; i++) b.box(foot[0] - 0.18 + i * 0.072, foot[1] - 0.06, foot[2] + 0.01, 0.018, 0.13, 0.018, { c: 'iron', m: M.metal, bevel: 0 }); }
  }
  // an iron brazier on three legs, banked with coals and a low flame
  function brazier(b, x, y, z, s) {
    b.push(x, y, z, 0);
    [0, 2.1, 4.2].forEach(function (a) { b.beam([Math.cos(a) * 0.35 * s, 0, Math.sin(a) * 0.35 * s], [Math.cos(a) * 0.16 * s, 0.85 * s, Math.sin(a) * 0.16 * s], 0.03 * s, { c: 'iron', m: M.metal }); b.box(Math.cos(a) * 0.37 * s, 0, Math.sin(a) * 0.37 * s, 0.06 * s, 0.03, 0.06 * s, { c: 'iron', m: M.metal, bevel: 0.005 }); });
    b.lathe(0, 0.8 * s, 0, [[0.05, 0], [0.32 * s, 0.05 * s], [0.42 * s, 0.25 * s], [0.38 * s, 0.27 * s], [0.28 * s, 0.1 * s], [0.01, 0.08 * s]], { c: 'iron', m: M.metal, seg: 12 });
    b.embers(0, 0.98 * s, 0, 0.32 * s, { light: false });
    for (var i = 0; i < 6; i++) { var a = i / 6 * Math.PI * 2 + 0.3; b.ball(Math.cos(a) * 0.22 * s, 1.0 * s, Math.sin(a) * 0.22 * s, 0.055 * s, { c: '#2a2725', m: M.rock, detail: 0, ao: 0.1 }); }
    b.flame(0, 1.0 * s, 0, 0.42 * s, { i: 1.1 });
    b.pop();
  }
  // a pair of bellows lying on a bench, nozzle toward local +z
  function bellows(b, x, y, z, ry) {
    b.push(x, y, z, ry);
    var shape = [[-0.17, 0], [0.17, 0], [0.22, 0.25], [0.2, 0.42], [0.1, 0.52], [-0.1, 0.52], [-0.2, 0.42], [-0.22, 0.25]].map(function (p) { return [p[0], p[1] - 0.26]; });
    [0.02, 0.15].forEach(function (yy) { b.addGeo(G.extrude(shape, 0.025, { bevel: 0.006 }), { y: yy, rx: -Math.PI / 2, c: 'wood', m: M.wood, ao: 0.1 }); });
    b.box(0, 0.035, 0.02, 0.36, 0.11, 0.42, { c: '#4a3a2c', m: M.cloth, bevel: 0.04, taper: 0.8 });
    b.beam([0, 0.08, 0.26], [0, 0.07, 0.48], 0.03, { r2: 0.015, round: true, seg: 6, c: 'brass', m: M.gold });
    [-1, 1].forEach(function (sd) { b.beam([sd * 0.06, 0.17, -0.26], [sd * 0.06, 0.2, -0.46], 0.015, { round: true, seg: 5, c: 'woodLight', m: M.wood }); });
    b.pop();
  }

  // a fish: a flat silver body with a darker back, a forked tail, local +x toward its head, lying in the XY plane
  // turned ry, tipped rz; s its length
  var FISH = [[-0.5, 0.0], [-0.62, 0.12], [-0.6, 0.02], [-0.62, -0.1], [-0.5, -0.02], [-0.38, -0.08], [-0.1, -0.15], [0.2, -0.14], [0.4, -0.08], [0.5, -0.02], [0.5, 0.03], [0.4, 0.09], [0.2, 0.15], [-0.1, 0.16], [-0.38, 0.08]];
  function fish(b, x, y, z, ry, s, rz, rx) {
    var g = G.extrude(FISH.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.05 * s, { bevel: 0.01 * s });
    b.addGeo(g, { x: x, y: y, z: z, ry: ry, rz: rz || 0, rx: rx || 0, c: '#ffffff', m: M.scale, bucket: 'cloth', ao: 0.1, jit: 0, vary: 0.04, colors: function (wx, wy, wz, lx, ly) { var t = ly / (0.16 * s); return t > 0.35 ? '#5d666c' : t > -0.2 ? '#a9b2b6' : '#c9ced0'; } });
  }

  KIT.defineBuild('hatchery', {
    name: 'Fire ring', size: 'small', need: 20,
    line: "A low ring of stone round a pit of glowing coals with an iron pot hung over the fire, log seats about it, braziers at the way in, a fire basket on a rock of stacked slabs, a slate-roofed lean-to and a cart of firewood by the woodcutter's block.",
    r: 9.5, flat: [11.5, 10], ground: 'cobble', path: [[0.2, 9.8], [-0.75, 5.0]],
    frameY: 1.5, frameR: 7.4, glowAt: [1.3, 4.5, -3.2],
    trees: [{ x: -7.5, z: -4.7, kind: 'pine', h: 6.8 }, { x: 6.6, z: 2.6, kind: 'birch', h: 5.4 }, { x: -3.4, z: -6.9, kind: 'pine', h: 5.4 }],
    bushes: [{ x: 4.4, z: 6.0, r: 0.75, flowers: '#f3f1ec' }, { x: -6.4, z: 3.4, r: 0.7 }, { x: 6.4, z: -1.4, r: 0.6, flowers: '#efebe4' }],
    islandOpts: { cobbleSkip: function (x, z) { return Math.hypot(x + 0.7, z - 1.3) < 3.2 || Math.hypot((x - 3.2) / 2.3, (z + 3.2) / 2.0) < 1 || (x < -2.8 && x > -6.3 && z < -1.9 && z > -4.5); } },
    build: function (b) {
      var cx = -0.7, cz = 1.3, ringR = 2.7, thick = 0.62, wallH = 0.62, top = 0.18 + wallH;
      // the way in faces the path (and the camera); gap is its half-width in radians
      var GA = 1.55, gap = 0.36, jamb = gap + 0.13;
      // the rock of stacked slabs, its fire basket on top
      var R0 = [3.2, -3.2];
      // the lean-to: x0..x1, back wall at zb, posts at zf
      var lx0 = -6.0, lx1 = -3.0, lzb = -4.0, lzf = -2.1;
      var at = function (a, d) { return [cx + Math.cos(a) * d, cz + Math.sin(a) * d]; };
      var adiff = function (a, c) { return Math.abs(((a - c) + Math.PI * 3) % (Math.PI * 2) - Math.PI); };
      var inGap = function (a) { return adiff(a, GA) < gap; };

      b.part('Footings');
      b.unit(function () {
        b.cyl(cx, -0.1, cz, ringR + thick / 2 + 0.35, 0.22, { c: 'stoneDark', m: M.stone, seg: 36, flat: true });
        b.cyl(cx, 0.06, cz, ringR + thick / 2 + 0.16, 0.12, { c: '#6c645b', m: M.stone, seg: 36, flat: true });
      });
      b.unit(function () { b.box((lx0 + lx1) / 2, -0.1, lzb, lx1 - lx0 + 0.5, 0.36, 0.8, { c: 'stoneDark', bevel: 0.06 }); b.box(lx0 + 0.27, -0.1, (lzb + lzf) / 2, 0.75, 0.36, lzf - lzb + 0.2, { c: 'stoneDark', bevel: 0.06 }); });

      b.part('Fire ring');
      b.stoneRing(cx, cz, ringR, 0.18, wallH, thick, { pal: 'hatchery_stone', course: 0.31, len: 0.62, core: false, hole: function (a) { return inGap(a); } });
      b.unit(function () {
        // the capstones, laid flat and a little proud of both faces
        var ns = 22, arc = Math.PI * 2 / ns;
        for (var i = 0; i < ns; i++) {
          var a = i * arc + 0.07; if (inGap(a) || inGap(a - arc * 0.45) || inGap(a + arc * 0.45)) continue;
          var ri = ringR - thick / 2 - 0.08, ro = ringR + thick / 2 + 0.08, sh = [], k;
          for (k = 0; k <= 4; k++) { var t = a - arc / 2 + 0.02 + (arc - 0.04) * k / 4; sh.push([Math.cos(t) * ro, Math.sin(t) * ro]); }
          for (k = 4; k >= 0; k--) { var t2 = a - arc / 2 + 0.02 + (arc - 0.04) * k / 4; sh.push([Math.cos(t2) * ri, Math.sin(t2) * ri]); }
          var g = G.extrude(sh, 0.12, { bevel: 0.022 }); g.rotateX(Math.PI / 2);
          b.addGeo(g, { x: cx, y: top + 0.05 + b.j(0.008), z: cz, c: b.stoneC('hatchery_cap', 1.2), m: M.stone, ao: 0.15, jit: 0.03 });
        }
      });
      b.unit(function () {
        // the jamb stones either side of the way in, taller, capped
        [-1, 1].forEach(function (sd) {
          var a = GA + sd * jamb, p = at(a, ringR);
          // three big stones laid crosswise, then a cap
          [[0.0, 0.32, 0.76, 0.66], [0.32, 0.34, 0.62, 0.78], [0.66, 0.3, 0.72, 0.62]].forEach(function (q, i) {
            b.box(p[0], 0.18 + q[0], p[1], q[2], q[1] - 0.03, q[3], { ry: -a + b.j(0.08) + (i % 2) * 0.05, c: b.stoneC('hatchery_stone', q[0]), m: M.stone, bevel: 0.06 });
          });
          b.box(p[0], 1.14, p[1], 0.84, 0.14, 0.86, { ry: -a + 0.04, c: b.stoneC('hatchery_cap', 1.3), m: M.stone, bevel: 0.04 });
        });
      });

      b.part('Ash bed and coals');
      b.unit(function () {
        b.cyl(cx, 0.06, cz, ringR - thick / 2 + 0.02, 0.1, { c: '#5b5650', m: M.soil, seg: 36, flat: true, ao: 0.1 });
        for (var i = 0; i < 46; i++) { var a = b.r() * Math.PI * 2, d = 1.1 + b.r() * (ringR - thick / 2 - 1.25); b.ball(cx + Math.cos(a) * d, 0.16, cz + Math.sin(a) * d, 0.05 + b.r() * 0.07, { c: b.pick(['#6e6862', '#4f4a45', '#7a746c', '#3c3835']), m: M.soil, sy: 0.35, detail: 0, ao: 0.1 }); }
      });
      var pr = 0.82;
      b.unit(function () {
        // the pit's kerb of rounded stones, two rows
        for (var i = 0; i < 15; i++) { var a = i / 15 * Math.PI * 2; b.rock(cx + Math.cos(a) * pr, 0.14, cz + Math.sin(a) * pr, 0.2 + b.r() * 0.05, { c: b.pick(PAL.hatchery_stone) }); }
        for (var j = 0; j < 11; j++) { var a2 = j / 11 * Math.PI * 2 + 0.3; b.rock(cx + Math.cos(a2) * pr * 0.97, 0.27, cz + Math.sin(a2) * pr * 0.97, 0.14 + b.r() * 0.04, { c: b.pick(PAL.hatchery_stone) }); }
        b.cyl(cx, 0.12, cz, pr * 0.82, 0.08, { c: '#262321', m: M.dark, seg: 16, flat: true, ao: 0 });
      });
      b.unit(function () {
        // the coals, banked high, the charred logs and the fire between them
        [[0, 0, 0.42], [0.28, -0.22, 0.3], [-0.3, 0.12, 0.32], [-0.05, -0.34, 0.3], [-0.18, 0.36, 0.28], [0.22, 0.3, 0.22]].forEach(function (q, i) { b.embers(cx + q[0], 0.2, cz + q[1], q[2], { light: i === 0 }); });
        [1.2, 2.77, 4.34, 5.91].forEach(function (a) { b.beam([cx + Math.cos(a) * 0.66, 0.22, cz + Math.sin(a) * 0.66], [cx + Math.cos(a) * 0.12, 0.44, cz + Math.sin(a) * 0.12], 0.07, { round: true, seg: 7, c: '#2b2724', m: M.wood, ao: 0.1 }); b.ball(cx + Math.cos(a) * 0.15, 0.43, cz + Math.sin(a) * 0.15, 0.06, { c: '#ff8a32', bucket: 'glow', glow: 2.2, detail: 0, ao: 0, jit: 0 }); });
        [[0.05, -0.04, 0.3, true], [-0.2, 0.12, 0.22, false], [0.2, 0.16, 0.2, false]].forEach(function (q) { b.flame(cx + q[0], 0.3, cz + q[1], q[2], { i: 1.3, light: q[3] }); });
      });
      b.unit(function () {
        // an iron pot hung over the coals on a chain from a tripod of iron bars
        var apex = [cx, 1.78, cz];
        [0.35, 2.45, 4.55].forEach(function (a) { var f = [cx + Math.cos(a) * 1.02, 0.16, cz + Math.sin(a) * 1.02]; b.beam(f, apex, 0.028, { round: true, seg: 6, c: 'iron', m: M.metal }); b.box(f[0], 0.15, f[2], 0.09, 0.04, 0.09, { c: 'iron', m: M.metal, bevel: 0.01 }); });
        b.ball(apex[0], apex[1] + 0.02, apex[2], 0.05, { c: 'iron', m: M.metal, detail: 0 });
        for (var k = 0; k < 6; k++) b.addGeo(new T.TorusGeometry(0.035, 0.009, 4, 8), { x: cx, y: apex[1] - 0.06 - k * 0.075, z: cz, ry: k * 1.57, c: 'iron', m: M.metal, ao: 0 });
        b.beam([cx - 0.27, 1.15, cz], [cx, 1.32, cz], 0.01, { round: true, seg: 4, c: 'iron', m: M.metal }); b.beam([cx + 0.27, 1.15, cz], [cx, 1.32, cz], 0.01, { round: true, seg: 4, c: 'iron', m: M.metal });
        b.lathe(cx, 0.76, cz, [[0.01, 0], [0.16, 0.02], [0.25, 0.1], [0.28, 0.24], [0.26, 0.36], [0.28, 0.4], [0.24, 0.41], [0.01, 0.39]], { c: '#2c2a28', m: M.metal, seg: 16 });
      });

      b.part('Log seats');
      // a seat of split log at each of four places round the fire, laid in turn
      [0.38, -1.28, -2.08, 3.4].forEach(function (a) {
        b.unit(function () {
          var p = at(a, 1.75);
          logSeat(b, p[0], 0.15, p[1], -a + Math.PI / 2 + b.j(0.08), 1.15);
        });
      });

      b.part('Braziers');
      b.unit(function () {
        [-0.35, GA + 1.25].forEach(function (a) {
          var p = at(a, ringR);
          b.box(p[0], top + 0.1, p[1], 0.6, 0.1, 0.6, { ry: -a, c: b.stoneC('hatchery_cap', 1.3), m: M.stone, bevel: 0.03 });
          brazier(b, p[0], top + 0.2, p[1], 0.6);
        });
      });

      b.part('Rock and fire basket');
      var rrot = 0.37, rc = Math.cos(rrot), rs = Math.sin(rrot), rp = function (u, v) { return [R0[0] + u * rc + v * rs, R0[1] - u * rs + v * rc]; };
      b.unit(function () { rockSlab(b, R0[0], 0, R0[1], 2.25, 1.95, 0.44, rrot, 3.1); for (var i = 0; i < 9; i++) { var a = i / 9 * 6.28 + 0.3, q = rp(Math.cos(a) * 2.2, Math.sin(a) * 1.9); b.rock(q[0], 0.1, q[1], 0.3 + b.r() * 0.26, { c: b.pick(PAL.hatchery_rock) }); } });
      b.unit(function () { var q = rp(-0.05, 0.05); rockSlab(b, q[0], 0.5, q[1], 2.05, 1.78, 0.39, rrot + 0.05, 7.7); });
      b.unit(function () { var q = rp(0.05, 0.0); rockSlab(b, q[0], 1.05, q[1], 1.88, 1.62, 0.34, rrot - 0.06, 12.4); });
      b.unit(function () {
        // a great iron fire basket on the top slab, and a little stack of firewood beside it
        var q = rp(0.1, 0.05); brazier(b, q[0], 1.39, q[1], 1.6);
        var w = rp(-0.95, 0.35); b.push(0, 1.39, 0, 0); b.woodpile(w[0], w[1], { n: 2, len: 0.75, ry: rrot + 0.3 }); b.pop();
      });
      b.unit(function () {
        // grass in the cracks, a few stones at its foot
        for (var i = 0; i < 18; i++) { var a = b.r() * 6.28, rr = 0.98 + b.r() * 0.1, q = rp(Math.cos(a) * 2.25 * rr, Math.sin(a) * 1.95 * rr); b.grass(q[0], 0.02, q[1], 0.35 + b.r() * 0.3); }
        b.rock(0.55, 0.05, -2.75, 0.34); b.rock(5.3, 0.05, -2.2, 0.4); b.rock(4.6, 0.05, -4.9, 0.3);
      });

      b.part('Keeper\'s lean-to');
      var wallTop = 2.72, yf = 2.02;
      for (var k = 0; k < 6; k++) {
        (function (k) {
          b.unit(function () {
            var y = 0.26 + k * 0.41;
            b.stoneWall(lx0, lzb, lx1, lzb, y, 0.41, 0.52, { pal: 'hatchery_stone', course: 0.41, len: 0.66 });
            // the side wall steps down toward the front, under the roof's line
            var zEnd = k < 2 ? lzf - 0.2 : lzb + 0.26 + (lzf - lzb - 0.3) * (1 - (k - 1) / 5);
            if (zEnd - (lzb + 0.26) > 0.4) b.stoneWall(lx0 + 0.27, lzb + 0.26, lx0 + 0.27, zEnd, y, 0.41, 0.52, { pal: 'hatchery_stone', course: 0.41, len: 0.62 });
          });
        })(k);
      }
      b.unit(function () {
        // the front posts on stone pads, carved, and the beam they carry
        stavePost(b, lx0 + 0.27, lzf, yf - 0.02);
        stavePost(b, lx1 - 0.15, lzf, yf - 0.02);
        b.beam([lx0 - 0.15, yf, lzf], [lx1 + 0.3, yf, lzf], 0.11, { c: 'woodDark' });
      });
      var ezf = lzf + 0.75, eyf = yf + 0.02, ezb = lzb - 0.15, eyb = wallTop + 0.2;
      b.unit(function () {
        // rafters from the wall head over the front beam and out to the eave
        for (var i = 0; i < 5; i++) { var x = lx0 - 0.15 + i * (lx1 - lx0 + 0.45) / 4; b.beam([x, eyb - 0.12, ezb + 0.05], [x, eyf - 0.08, ezf - 0.05], 0.065, { c: 'beam' }); }
        b.beam([lx0 - 0.25, wallTop + 0.05, lzb + 0.1], [lx1 + 0.4, wallTop + 0.05, lzb + 0.1], 0.08, { c: 'beam' });
      });
      leanRoof(b, lx0 - 0.4, lx1 + 0.5, ezf, eyf, ezb, eyb, { rows: 6, pitch: 0.38, thick: 0.06 });
      b.unit(function () {
        // barge boards down both open edges, the ridge board, a carved head at each end of the front beam
        [lx0 - 0.42, lx1 + 0.52].forEach(function (x) { b.beam([x, eyf + 0.02, ezf + 0.02], [x, eyb + 0.06, ezb], 0.055, { c: 'woodDark', r2: 0.1 }); });
        b.beam([lx0 - 0.45, eyb + 0.1, ezb + 0.05], [lx1 + 0.55, eyb + 0.1, ezb + 0.05], 0.09, { c: 'woodDark' });
        finial(b, lx1 + 0.42, yf + 0.05, lzf + 0.02, 0, 0.6);
        finial(b, lx0 - 0.32, yf + 0.05, lzf + 0.02, Math.PI, 0.6);
      });

      b.part('Tools and stores');
      var fz = lzb + 0.3;
      b.unit(function () {
        // tools along the back wall on iron pegs: a poker, tongs, a shovel, a rake, and a coil of rope
        [-4.5, -4.1, -3.7, -3.3].forEach(function (x) { b.beam([x, 1.95, fz - 0.06], [x, 1.98, fz + 0.1], 0.02, { round: true, seg: 5, c: 'iron', m: M.metal }); });
        tool(b, 'poker', [-4.55, 0.28, fz + 0.32], [-4.5, 1.95, fz + 0.08]);
        tool(b, 'tongs', [-4.15, 0.28, fz + 0.3], [-4.1, 1.92, fz + 0.08]);
        tool(b, 'shovel', [-3.73, 0.42, fz + 0.38], [-3.7, 2.0, fz + 0.1]);
        tool(b, 'rake', [-3.3, 0.36, fz + 0.36], [-3.32, 2.0, fz + 0.1]);
        b.ropeCoil(-5.0, 1.75, fz + 0.03, 0.2);
      });
      b.unit(function () { b.woodpile(-5.04, -2.95, { n: 3, len: 1.2, ry: Math.PI / 2 }); });
      b.unit(function () { b.table(-2.3, -2.4, 1.1, 0.55, { ry: 0.35 }); bellows(b, -2.45, 0.78, -2.35, 1.2); b.bucket(-1.95, 0.78, -2.55); });
      b.unit(function () {
        // sacks of charcoal and a heap of it spilling out of the front
        b.sack(-4.35, 0, -2.55, 0.55, { c: '#3d3b38' }); b.sack(-3.85, 0, -2.45, 0.5, { c: '#47443f' }); b.sack(-4.1, 0.38, -2.62, 0.42, { c: '#3a3835' });
        for (var i = 0; i < 28; i++) { var a = b.r() * 6.28, d = Math.sqrt(b.r()) * 0.55; b.ball(-4.05 + Math.cos(a) * d, 0.04 + (0.55 - d) * 0.35, -1.75 + Math.sin(a) * d * 0.7, 0.06 + b.r() * 0.04, { c: b.pick(['#242220', '#2e2b28', '#1c1b1a']), m: M.rock, detail: 0, ao: 0.2 }); }
      });
      b.unit(function () {
        // a cart loaded with split firewood
        b.cart(3.4, 3.4, { ry: 0.6, load: function () {
          for (var row = 0; row < 3; row++) for (var i = 0; i < 5 - row; i++) b.log((i - (4 - row) / 2) * 0.25, 0.71 + 0.11 + row * 0.2, 0.97, 0.11, 1.95, { c: b.pick(PAL.wood), rz: -Math.PI / 2, ry: Math.PI / 2 });
        } });
      });
      b.unit(function () {
        // round shields hung on the side wall, facing out, a water barrel at the corner
        [[-3.4, 'ink'], [-2.75, 'bone']].forEach(function (s, i) { b.shield(lx0 - 0.02, 1.02 - i * 0.04, s[0], { kind: 'round', c: s[1], s: 0.76, ry: -Math.PI / 2 }); });
        b.barrel(lx0 - 0.55, 0, lzf + 0.45, { h: 0.85 }); b.bucket(lx0 - 0.15, 0, lzf + 0.95);
        b.ivy([[lx0 - 0.02, 0.3, lzb + 0.4], [lx0 - 0.02, 1.2, lzb + 0.6], [lx0 - 0.02, 2.0, lzb + 0.45], [lx0 - 0.02, 2.5, lzb + 0.75]], [-1, 0, 0], { density: 6, spread: 0.4 });
        b.ivy([[lx0 + 0.3, 0.3, lzb - 0.28], [lx0 + 0.8, 1.4, lzb - 0.28], [lx0 + 0.5, 2.3, lzb - 0.28]], [0, 0, -1], { density: 5, spread: 0.4 });
      });
      b.unit(function () {
        // the woodcutter's block: a broad stump, split logs fallen round it and chips in the grass
        b.cyl(4.9, 0, -0.7, 0.36, 0.52, { c: '#6b5843', m: M.wood, seg: 12, ao: 0.3 }); b.cyl(4.9, 0.52, -0.7, 0.35, 0.015, { c: '#c2a47c', m: M.wood, seg: 12, ao: 0 });
        [[5.55, -0.45, 0.6], [4.35, -0.15, 2.2], [5.25, -1.35, -0.8]].forEach(function (q) { b.log(q[0], 0.1, q[1], 0.1, 0.55, { c: b.pick(PAL.wood), rz: -Math.PI / 2, ry: q[2] }); });
        for (var c = 0; c < 10; c++) b.box(4.9 + b.j(0.8), 0.02, -0.7 + b.j(0.8), 0.08, 0.02, 0.05, { ry: b.r() * 3, c: '#c2a47c', m: M.wood, bevel: 0.004, ao: 0 });
      });

      b.part('Way in');
      var post = function (sd) { return at(GA + sd * jamb, ringR + 0.8); }, pA = post(-1), pB = post(1);
      var lx = pB[0] - pA[0], lz = pB[1] - pA[1], lL = Math.hypot(lx, lz), ux = lx / lL, uz = lz / lL, ly = 2.72;
      b.unit(function () { [pA, pB].forEach(function (p) { stavePost(b, p[0], p[1], ly - 0.06); }); });
      b.unit(function () {
        // a carved head on top of each post, looking out along the path; the sign on an iron arm off the right post,
        // facing the path, and an iron lantern on an arm off the left post
        var hry = -GA, sry = Math.atan2(Math.cos(GA), Math.sin(GA));
        [pA, pB].forEach(function (p) { b.box(p[0], ly - 0.08, p[1], 0.26, 0.1, 0.26, { c: '#3a3631', m: M.wood, bevel: 0.02 }); finial(b, p[0], ly + 0.02, p[1], hry, 0.7); });
        var ay = 2.2, m = [pA[0] - ux * 0.5, pA[1] - uz * 0.5];
        b.beam([pA[0], ay, pA[1]], [pA[0] - ux * 0.82, ay, pA[1] - uz * 0.82], 0.028, { c: 'iron', m: M.metal });
        b.beam([pA[0], ay - 0.4, pA[1]], [pA[0] - ux * 0.55, ay, pA[1] - uz * 0.55], 0.018, { c: 'iron', m: M.metal });
        b.push(m[0], ay, m[1], sry);
        [-0.2, 0.2].forEach(function (cxr) { b.beam([cxr, 0, 0], [cxr, -0.22, 0], 0.008, { round: true, seg: 3, c: 'iron', m: M.metal }); });
        b.box(0, -0.75, 0, 0.54, 0.52, 0.05, { c: 'ink', m: M.paint, bevel: 0.015 });
        // a flame painted on both faces
        var flame = [[0.0, -0.15], [0.09, -0.13], [0.135, -0.05], [0.125, 0.04], [0.07, 0.12], [0.075, 0.03], [0.03, 0.07], [0.0, 0.19], [-0.05, 0.08], [-0.1, 0.12], [-0.135, 0.02], [-0.12, -0.09], [-0.07, -0.14]];
        [0.03, -0.03].forEach(function (dz) { b.extrude(0, -0.49, dz, flame, 0.008, { c: '#f1eee8', m: M.paint, ao: 0 }); });
        b.box(0, -0.72, 0.028, 0.54, 0.03, 0.008, { c: 'ember', m: M.paint, bevel: 0 });
        b.pop();
        var lp = [pB[0] + ux * 0.45, pB[1] + uz * 0.45], ly2 = 2.3;
        b.beam([pB[0], ly2, pB[1]], [pB[0] + ux * 0.6, ly2, pB[1] + uz * 0.6], 0.028, { c: 'iron', m: M.metal });
        b.beam([pB[0], ly2 - 0.4, pB[1]], [pB[0] + ux * 0.4, ly2, pB[1] + uz * 0.4], 0.018, { c: 'iron', m: M.metal });
        b.beam([lp[0], ly2, lp[1]], [lp[0], ly2 - 0.32, lp[1]], 0.01, { round: true, seg: 3, c: 'iron', m: M.metal });
        b.push(lp[0], ly2 - 0.68, lp[1], sry);
        b.box(0, 0, 0, 0.2, 0.3, 0.2, { c: '#2a2a2a', m: M.window, bevel: 0.01, ao: 0 });
        [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]].forEach(function (q) { b.box(q[0], -0.02, q[1], 0.03, 0.34, 0.03, { c: 'iron', m: M.metal, bevel: 0 }); });
        b.cone(0, 0.32, 0, 0.17, 0.12, { c: 'iron', m: M.metal, seg: 4, ry: 0.785 }); b.box(0, -0.04, 0, 0.26, 0.04, 0.26, { c: 'iron', m: M.metal, bevel: 0.005 });
        b.light(0, 0.15, 0, '#ffb36a', 0.9);
        b.pop();
      });
      b.unit(function () {
        // grass at the wall foot, a water butt by the way in, a pile of kindling for the fire
        for (var i = 0; i < 26; i++) { var a = b.r() * 6.28; if (adiff(a, GA) < 0.7) continue; var rr = ringR + thick / 2 + 0.42 + b.r() * 0.2; b.grass(cx + Math.cos(a) * rr, 0.05, cz + Math.sin(a) * rr, 0.3 + b.r() * 0.3); }
        b.barrel(-4.2, 0, 2.6, { h: 0.95, r: 0.36 }); b.bucket(-4.7, 0, 2.95); b.barrel(-4.6, 0, 1.95, { h: 0.8, lie: true, ry: 0.4 });
        b.woodpile(4.6, 0.6, { n: 3, len: 1.1, ry: 0.9 });
        for (var t = 0; t < 30; t++) { var a2 = b.r() * 6.28, d = Math.sqrt(b.r()) * 0.5, x = 3.0 + Math.cos(a2) * d, z = 1.25 + Math.sin(a2) * d, ta = b.r() * 6.28, L = 0.35 + b.r() * 0.3; b.beam([x - Math.cos(ta) * L / 2, 0.05 + (0.5 - d) * 0.4, z - Math.sin(ta) * L / 2], [x + Math.cos(ta) * L / 2, 0.05 + (0.5 - d) * 0.4 + b.j(0.05), z + Math.sin(ta) * L / 2], 0.016, { round: true, seg: 4, c: b.pick(PAL.hatchery_twig), m: M.wood, ao: 0.2 }); }
      });
      b.unit(function () {
        // a bench by the way in with a basket of fish for the pot, and straw bales
        b.bench(2.35, 6.1, 1.5, { ry: -0.35 });
        var bk = fig(2.35, 6.1, -0.35, 0.35, 0, 0);
        b.lathe(bk[0], 0.49, bk[2], [[0.01, 0], [0.19, 0], [0.25, 0.22], [0.27, 0.27], [0.01, 0.26]], { c: '#8a6a45', m: M.straw, seg: 12, flat: true });
        b.cyl(bk[0], 0.73, bk[2], 0.27, 0.04, { c: '#6b5134', m: M.wood, seg: 12, open: true });
        for (var f = 0; f < 6; f++) fish(b, bk[0] + b.j(0.1), 0.79 + f * 0.018, bk[2] + b.j(0.1), b.r() * 6.28, 0.36, b.j(0.15), -Math.PI / 2 + b.j(0.25));
        fish(b, bk[0] - 0.45, 0.505, bk[2] + 0.08, 0.4, 0.38, 0, -Math.PI / 2);
        [[-4.25, 5.0, 0.35], [-3.55, 5.55, 0.5]].forEach(function (q) {
          // a straw bale: two bands of rope, loose strands on its top and sides
          b.push(q[0], 0, q[1], q[2]);
          b.box(0, 0, 0, 0.9, 0.46, 0.55, { c: 'straw', m: M.straw, bevel: 0.08, jit: 0.03 });
          [-0.25, 0.25].forEach(function (bx) { b.box(bx, -0.005, 0, 0.05, 0.475, 0.565, { c: 'rope', m: M.rope, bevel: 0.015 }); });
          for (var k = 0; k < 22; k++) { var sx = b.j(0.42), sz = b.j(0.25), ta = b.r() * 6.28, L = 0.15 + b.r() * 0.2; b.beam([sx, 0.465, sz], [sx + Math.cos(ta) * L, 0.47 + b.r() * 0.04, sz + Math.sin(ta) * L * 0.6], 0.007, { round: true, seg: 3, c: b.pick(PAL.straw), m: M.straw, ao: 0 }); }
          for (var k2 = 0; k2 < 10; k2++) { var sz2 = b.j(0.26), sy = 0.05 + b.r() * 0.36; b.beam([0.45, sy, sz2], [0.5 + b.r() * 0.06, sy - 0.05 - b.r() * 0.08, sz2 + b.j(0.06)], 0.006, { round: true, seg: 3, c: b.pick(PAL.straw), m: M.straw, ao: 0 }); }
          b.pop();
        });
        b.ropeCoil(-4.25, 0.46, 5.0, 0.2);
        for (var g = 0; g < 9; g++) b.grass(-3.9 + b.j(1.0), 0.02, 5.3 + b.j(0.8), 0.3 + b.r() * 0.2);
      });

      b.part('Near lawn');
      b.unit(function () {
        // a few stones and a tuft of flowers scattered over the near lawn
        [[-5.2, 6.0, 0.32], [-1.0, 8.2, 0.26], [3.6, 7.4, 0.3]].forEach(function (q) { b.rock(q[0], 0.02, q[1], q[2]); b.grass(q[0] + 0.35, 0.02, q[1] + 0.1, 0.3); });
        b.flowers(-4.6, 0, 7.0, 0.4, { c: '#f3f1ec', n: 8 }); b.flowers(2.6, 0, 7.9, 0.35, { c: '#efebe4', n: 6 });
      });

      b.life(function () {
        // a child kneeling inside the ring, warming his hands at the coals, and another running in along the path
        var cp = at(2.3, 1.3), chr = Math.atan2(cx - cp[0], cz - cp[1]);
        b.figure(cp[0], cp[1], { role: 'child', pose: 'hatchery_kneel', ry: chr, toy: false });
        b.figure(0.55, 5.9, { role: 'child', pose: 'run', ry: Math.atan2(cx - 0.55, cz - 5.9) });
        // the keeper raking the coals
        var kp = at(-0.5, 1.38), kry = Math.atan2(cx - kp[0], cz - kp[1]);
        b.figure(kp[0], kp[1], { role: 'villager', pose: 'hatchery_tend', ry: kry, c: '#5c5e62', beard: true });
        var h0 = fig(kp[0], kp[1], kry, -0.02, 0.86, 0.3), h1 = fig(kp[0], kp[1], kry, 0.0, 0.24, 1.1);
        b.beam(h0, h1, 0.016, { round: true, seg: 5, c: 'iron', m: M.metal });
        b.beam([h0[0], h0[1], h0[2]], [h0[0] + (h0[0] - h1[0]) * 0.2, h0[1] + (h0[1] - h1[1]) * 0.2, h0[2] + (h0[2] - h1[2]) * 0.2], 0.026, { round: true, seg: 6, c: 'wood', m: M.wood });
        // carrying an armful of firewood from the lean-to to the ring
        var cxp = -4.3, czp = 0.9, cry = 0.56;
        b.figure(cxp, czp, { role: 'villager', pose: 'hatchery_hold', ry: cry, c: '#8a857c' });
        b.push(cxp, 0, czp, cry);
        [[-0.07, 0.98, 0.34], [0.07, 0.98, 0.32], [0.0, 1.11, 0.33]].forEach(function (q) { b.log(-0.36, q[1], q[2] + q[0] * 0.2, 0.07, 0.72, { c: b.pick(PAL.wood), rz: -Math.PI / 2 }); });
        b.pop();
        // the woodcutter at his block, the axe raised
        var wp = [4.3, -1.25], wry = Math.atan2(4.9 - wp[0], -0.7 - wp[1]);
        b.figure(wp[0], wp[1], { role: 'villager', pose: 'hammer', ry: wry, c: '#3b3a38' });
        var a0 = fig(wp[0], wp[1], wry, -0.24, 1.78, 0.1), a1 = fig(wp[0], wp[1], wry, -0.2, 2.32, -0.3);
        b.beam(a0, a1, 0.022, { round: true, seg: 6, c: 'woodLight', m: M.wood });
        b.push(a1[0], a1[1], a1[2], wry - Math.PI / 2); b.extrude(0, 0, -0.022, [[-0.04, -0.045], [0.05, -0.045], [0.12, -0.12], [0.16, -0.11], [0.15, 0.1], [0.11, 0.11], [0.05, 0.045], [-0.04, 0.045]], 0.045, { rz: 0.5, c: 'iron', m: M.metal, bevel: 0.006 }); b.pop();
      });
    }
  });
})();
