// Citadel: the last and greatest build. A square of stone curtain walls with a battlemented wall walk, four round
// corner towers crowned with open arcades (a wide stone ledge on corbels, under a ring of arches and a slate cone)
// with a fire basket under each and a sentry on each ledge, a great gate under a timber gallery with carved dragon
// heads, and the keep with its stone gable and banners. Built footings first, the curtain walls course by course, each
// tower course by course, the gatehouse round its arch, the keep and its gable, the wall walks and merlons, the tower
// tops' ledges, arches and roofs, the keep roof row by row, the gate gallery, banners and stores, and last the people.
(function () {
  var T = THREE;
  var BASE = 0.55, CH = 0.42;
  // curtain walls: tower centres at (+-WX, +-WZ); walls WT thick, NW courses up to the wall walk
  var WX = 10, WZ = 8, WT = 1.5, NW = 12, WALK = BASE + NW * CH;
  var TR = 2.5, TRO = TR + 0.35;
  // the gatehouse, astride the front wall
  var GX = 3.5, GZ0 = 6.4, GZ1 = 10.0, GN = 18, GTOP = BASE + GN * CH;
  // the keep, against the back wall
  var KX0 = -3.5, KX1 = 4.5, KZ0 = -7.0, KZ1 = 0.4, KT = 0.85, KN = 29, KE = BASE + KN * CH, KR = 4.8;
  var KCX = (KX0 + KX1) / 2, KCZ = (KZ0 + KZ1) / 2, KW = KX1 - KX0, KD = KZ1 - KZ0;
  // the timber gallery on the gatehouse
  var GLX = 3.75, GLZ0 = 6.15, GLZ1 = 10.35, GLY = GTOP + 0.36, GLH = 2.2, GLT = GLY + GLH, GLR = 2.4;
  // the corner towers: the front-right one, in the sun, is the tallest
  var TOWERS = [
    { key: 'fr', x: WX, z: WZ, n: 25, dr: 4.3, ar: 2.5, ph: 2.8, rise: 3.9, pen: 'ember', la: 1.4 },
    // the front-left tower stands low, its top just over the wall walk, so the keep's front shows above its cone
    { key: 'fl', x: -WX, z: WZ, n: 14, dr: 4.0, ar: 2.4, ph: 2.4, rise: 3.0, pen: 'bone', la: 1.48, low: true },
    { key: 'bl', x: -WX, z: -WZ, n: 21, dr: 4.0, ar: 2.4, ph: 2.6, rise: 3.5, pen: 'ink', la: 1.48 },
    { key: 'br', x: WX, z: -WZ, n: 21, dr: 4.0, ar: 2.4, ph: 2.6, rise: 3.5, pen: 'bone', la: 1.3 }
  ];
  // each tower top has a broad ledge on its sunny side, centred on angle la
  TOWERS.forEach(function (t) { t.yS = BASE + t.n * CH; t.dy = t.yS + 0.52; });

  // a curved stone of a ring: radii ri..ro, angles a0..a1 (0 = +x, PI/2 = +z), h tall, base at y = 0
  function citadelArcGeo(ri, ro, a0, a1, h, bev) {
    var n = Math.max(2, Math.ceil((a1 - a0) / 0.14)), sh = new T.Shape(), i, a;
    for (i = 0; i <= n; i++) { a = a0 + (a1 - a0) * i / n; if (i === 0) sh.moveTo(Math.cos(a) * ro, -Math.sin(a) * ro); else sh.lineTo(Math.cos(a) * ro, -Math.sin(a) * ro); }
    for (i = n; i >= 0; i--) { a = a0 + (a1 - a0) * i / n; sh.lineTo(Math.cos(a) * ri, -Math.sin(a) * ri); }
    bev = Math.min(bev, h * 0.3);
    var g = new T.ExtrudeGeometry(sh, { depth: Math.max(0.01, h - 2 * bev), bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelOffset: -bev, bevelSegments: 1, steps: 1, curveSegments: 1 });
    g.rotateX(-Math.PI / 2); g.translate(0, bev, 0); g.deleteAttribute('uv');
    return KIT.geo.flat(g);
  }

  // openings for a course: [{t, hw, y0, spring, r}] (t along the wall, r the arch's outer radius, 0 for a square head);
  // returns cut(t0, t1, yc) -> the spans of [t0, t1] to keep
  function citadelCut(ops) {
    return function (s0, s1, yc) {
      var keep = [[s0, s1]];
      ops.forEach(function (op) {
        if (yc < op.y0 || yc > op.spring + (op.r || 0)) return;
        var half = yc <= op.spring ? op.hw : Math.sqrt(Math.max(0, op.r * op.r - (yc - op.spring) * (yc - op.spring)));
        if (half < 0.05) return;
        var a = op.t - half, c = op.t + half, nk = [];
        keep.forEach(function (k) { if (k[1] <= a || k[0] >= c) { nk.push(k); return; } if (k[0] < a) nk.push([k[0], a]); if (k[1] > c) nk.push([c, k[1]]); });
        keep = nk;
      });
      return keep;
    };
  }

  // one course of a straight wall from a to b (centred on the line), laid stone by stone; o.cut frames openings with
  // cut stones and leaves the mortar core out behind them
  function citadelCourse(b, ax, az, bx, bz, y, ch, thick, k, o) {
    o = o || {}; var M = KIT.M, dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 0.2) return;
    var ux = dx / L, uz = dz / L, ry = -Math.atan2(uz, ux), len = o.len || 0.8, pal = o.pal || 'stone';
    var cuts = [0], t = (k % 2) * len * 0.5 * (0.6 + b.r() * 0.6);
    while (t < L - 0.2) { if (t > 0.15) cuts.push(t); t += len * (0.7 + b.r() * 0.6); }
    cuts.push(L);
    var pieces = [];
    for (var i = 0; i < cuts.length - 1; i++) { var kept = o.cut ? o.cut(cuts[i], cuts[i + 1], y + ch / 2) : [[cuts[i], cuts[i + 1]]]; kept.forEach(function (p) { pieces.push(p); }); }
    var runs = o.cut ? o.cut(0, L, y + ch / 2) : [[0, L]];
    if (o.core !== false) runs.forEach(function (r) {
      var w = r[1] - r[0] - 0.06, tm = (r[0] + r[1]) / 2; if (w < 0.1) return;
      b.box(ax + ux * tm, y, az + uz * tm, w, ch, thick * 0.8, { ry: ry, c: o.mortar || '#8a7e6c', m: M.stone, bevel: 0, ao: 0.1, jit: 0.01 });
    });
    pieces.forEach(function (s) {
      var tm = (s[0] + s[1]) / 2, w = s[1] - s[0] - 0.05; if (w < 0.12) return;
      var hh = ch * (0.86 + b.j(0.06)), dd = thick * (0.98 + b.j(0.05)), out = b.j(0.025);
      b.box(ax + ux * tm - uz * out, y + (ch - hh) / 2, az + uz * tm + ux * out, w, hh, dd, { ry: ry + b.j(0.012), c: b.stoneC(pal, y), m: M.stone, bevel: Math.min(0.07, hh * 0.2), ao: 0.18, jit: 0.04 });
    });
  }

  // four walls round a rectangle, a course a step, with openings per side (t from each side's start: front from x0,
  // right from z1 toward z0, back from x1, left from z0 toward z1). An opening with lay() is finished (its arch turned,
  // its window set) as a step of its own once the courses reach its spring.
  function citadelBox(b, cx, cz, w, d, y0, n, ch, thick, ops, o) {
    o = o || {};
    var x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    var sides = [
      { key: 'front', a: [x0, z1 - thick / 2], b: [x1, z1 - thick / 2] },
      { key: 'right', a: [x1 - thick / 2, z1 - thick], b: [x1 - thick / 2, z0 + thick] },
      { key: 'back', a: [x1, z0 + thick / 2], b: [x0, z0 + thick / 2] },
      { key: 'left', a: [x0 + thick / 2, z0 + thick], b: [x0 + thick / 2, z1 - thick] }
    ];
    sides.forEach(function (sd) { var mine = ops.filter(function (op) { return op.side === sd.key; }); sd.cut = mine.length ? citadelCut(mine) : null; });
    for (var k = 0; k < n; k++) {
      var y = y0 + k * ch;
      b.unit(function () { sides.forEach(function (sd) { citadelCourse(b, sd.a[0], sd.a[1], sd.b[0], sd.b[1], y, ch, thick, k, { cut: sd.cut, pal: o.pal, len: o.len }); }); });
      var due = ops.filter(function (op) { return op.lay && !op.done && y + ch >= op.spring - 0.01; });
      if (due.length) b.unit(function () { due.forEach(function (op) { op.done = true; op.lay(); }); });
      if (o.onCourse) o.onCourse(k, y, ch);
    }
  }

  // a round wall of curved stones, a course a step; o.cut(a0, a1, yc) -> arcs to keep (slits cut clean)
  function citadelRing(b, cx, cz, r, y0, n, ch, thick, o) {
    o = o || {}; var M = KIT.M, len = o.len || 0.85;
    for (var k = 0; k < n; k++) {
      (function (k) {
        var y = y0 + k * ch, ns = Math.max(6, Math.round(Math.PI * 2 * r / len)), arc = Math.PI * 2 / ns, off = (k % 2) * arc * 0.5;
        b.unit(function () {
          b.cyl(cx, y, cz, r - thick * 0.45, ch, { c: '#8a7e6c', m: M.stone, seg: ns, ao: 0.1, jit: 0.01 });
          for (var i = 0; i < ns; i++) {
            var a = i * arc + off + b.j(arc * 0.06), gap = 0.045 / r, pieces = [[a - arc / 2 + gap, a + arc / 2 - gap]];
            if (o.cut) pieces = o.cut(pieces[0][0], pieces[0][1], y + ch / 2, k);
            pieces.forEach(function (p) {
              if ((p[1] - p[0]) * r < 0.12) return;
              var hh = ch * (0.88 + b.j(0.05)), ro = r + thick / 2 + b.j(0.02), ri = r - thick / 2;
              b.addGeo(citadelArcGeo(ri, ro, p[0], p[1], hh, Math.min(0.06, hh * 0.18)), { x: cx, y: y + (ch - hh) / 2, z: cz, c: b.stoneC(o.pal || 'stone', y), m: M.stone, ao: 0.18, jit: 0.04 });
            });
          }
        });
      })(k);
    }
  }

  // a ring of wedge-shaped voussoirs over an opening in a wall facing +z (turned by ry): centred at (x, y, z) on the
  // spring line, inner radius ri, rt deep, depth through the wall
  function citadelArch(b, x, y, z, ry, ri, rt, depth, o) {
    o = o || {}; var M = KIT.M, n = o.n || Math.max(5, Math.round(Math.PI * (ri + rt / 2) / 0.36)); if (n % 2 === 0) n++;
    b.push(x, y, z, ry);
    for (var i = 0; i < n; i++) {
      var a0 = Math.PI * i / n, a1 = Math.PI * (i + 1) / n, am = (a0 + a1) / 2, w = 2 * ri * Math.sin((a1 - a0) / 2) * 0.93;
      b.box(Math.cos(am) * ri, Math.sin(am) * ri, 0, w, rt, depth, { rz: am - Math.PI / 2, taper: (ri + rt) / ri, taperD: 1, c: b.stoneC(i === (n - 1) / 2 ? (o.key || 'sandstone') : (o.pal || 'sandstone')), m: M.stone, ao: 0.15, jit: 0.04 });
    }
    b.pop();
  }

  // an arched window in a wall: (fx, fz) the outer face at the opening's centre, ry the way it faces; op as for the cut
  function citadelWin(b, fx, fz, ry, op, thick, o) {
    o = o || {}; var M = KIT.M, hw = op.hw, rt = op.r - op.hw, self = b;
    b.push(fx, 0, fz, ry);
    citadelArch(b, 0, op.spring, -thick / 2, 0, hw, rt, thick + 0.04, {});
    b.window(0, op.y0, -0.24, hw * 2, op.spring - op.y0 + hw, { arch: true, sillC: 'sandstone', frameC: 'woodDark' });
    b.box(0, op.y0 - 0.12, 0.05, hw * 2 + 0.34, 0.13, 0.32, { c: b.stoneC('sandstone'), m: M.stone, bevel: 0.03 });
    if (o.shutters) [-1, 1].forEach(function (s) { b.box(s * (hw + 0.3), op.y0 + 0.02, 0.12, 0.5, op.spring - op.y0 + hw * 0.55, 0.05, { c: o.shutters, m: M.paint, ry: -s * 0.3, bevel: 0.01 }); });
    if (o.flowers) {
      b.box(0, op.y0 - 0.36, 0.22, hw * 2 + 0.2, 0.24, 0.28, { c: 'woodDark', m: M.wood, bevel: 0.02 });
      for (var f = 0; f < 6; f++) self.ball(-hw + f * hw * 2 / 5, op.y0 - 0.1, 0.24 + self.j(0.05), 0.08, { c: self.pick(['#f3f1ec', '#efebe4', '#f6f4f0']), m: M.paint, ao: 0, detail: 0 });
      for (var g = 0; g < 4; g++) self.ball(-hw + g * hw * 2 / 3, -0.0 + op.y0 - 0.14, 0.27, 0.1, { c: 'leaf', m: M.leaf, ao: 0.2, detail: 0 });
    }
    b.pop();
  }

  // a carved dragon head on the end of a barge board: the profile in the local XY plane, snout toward +x, neck at
  // (x, y, z); ry turns it (PI for a head looking -x), s is its height
  var CIT_HEAD = [[-0.09, 0], [-0.15, 0.3], [-0.12, 0.56], [-0.03, 0.76], [0.06, 0.9], [-0.04, 1.16], [0.15, 1.02], [0.28, 1.08], [0.42, 1.05], [0.58, 0.99], [0.8, 0.93],
    [0.9, 0.87], [0.81, 0.84], [0.57, 0.83], [0.41, 0.8], [0.6, 0.73], [0.69, 0.67], [0.6, 0.65], [0.39, 0.65], [0.21, 0.59], [0.11, 0.43], [0.09, 0.2], [0.11, 0]];
  function citadelHead(b, x, y, z, ry, s, o) {
    o = o || {}; var M = KIT.M, c = o.c || 'beam';
    b.push(x, y, z, ry);
    if (o.rz) b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(o.rz));
    b.extrude(0, 0, 0, CIT_HEAD.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.15 * s, { c: c, m: M.wood, ao: 0.1, bevel: 0.01 });
    [[[-0.14, 0.34], [-0.37, 0.45], [-0.13, 0.51]], [[-0.08, 0.6], [-0.31, 0.75], [-0.04, 0.75]], [[0.01, 0.86], [-0.2, 1.03], [0.05, 0.94]]].forEach(function (f) {
      b.extrude(0, 0, 0, f.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.08 * s, { c: c, m: M.wood, ao: 0.05, bevel: 0.005 });
    });
    [1, -1].forEach(function (sd) {
      b.ball(0.44 * s, 0.95 * s, sd * 0.078 * s, 0.036 * s, { c: 'bone', m: M.paint, ao: 0, detail: 0 });
      b.box(0.41 * s, 0.99 * s, sd * 0.072 * s, 0.17 * s, 0.03 * s, 0.03 * s, { c: c, m: M.wood, bevel: 0.004, rz: -0.25 });
    });
    b.pop();
  }

  // crossed barge boards on a gable facing +z at plane z: eave corners at (cx +- hs, ye), peak (cx, yp); they run on
  // past the peak and end in carved dragon heads looking out
  function citadelBarge(b, cx, ye, yp, hs, z, ext, hs2, sgnZ) {
    var L = Math.hypot(hs, yp - ye), ux = hs / L, uy = (yp - ye) / L;
    [-1, 1].forEach(function (sd) {
      var a = [cx + sd * hs, ye, z + (sd > 0 ? 0.06 : 0) * sgnZ], e = [cx - sd * ux * ext, yp + uy * ext, a[2]];
      b.beam(a, e, 0.14, { c: 'beam', r2: 0.05, bevel: 0.02 });
      citadelHead(b, e[0] + (-sd) * 0.02, e[1] - 0.12, a[2], sd > 0 ? Math.PI : 0, hs2, { rz: -0.15 });
    });
  }

  // a round shield on a wall facing +z (turned by ry), painted in quarters
  function citadelShield(b, x, y, z, c1, c2, s, ry) {
    var M = KIT.M, r = 0.42 * s * 0.97, n = 8;
    b.push(x, y, z, ry || 0);
    b.shield(0, 0, 0, { kind: 'round', c: c1, s: s });
    [0, Math.PI].forEach(function (a0) {
      var pts = [[0, 0]]; for (var i = 0; i <= n; i++) { var a = a0 + Math.PI / 4 + i / n * Math.PI / 2; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      b.extrude(0, 0, 0.053, pts, 0.006, { c: c2, m: M.paint, ao: 0, jit: 0.01 });
    });
    b.pop();
  }

  // a banner with the citadel's dragon, flying with wings spread, in bone on ink, and one made tail fin in the Hub orange
  var CIT_DRAGON = [[0, 0.5], [0.05, 0.42], [0.045, 0.31], [0.1, 0.26], [0.3, 0.37], [0.5, 0.32], [0.43, 0.2], [0.36, 0.22], [0.31, 0.1], [0.24, 0.13], [0.17, 0.02], [0.1, 0.05], [0.075, -0.08], [0.035, -0.2], [0.02, -0.34]];
  function citadelDragonPts() {
    var R = CIT_DRAGON, L = R.slice().reverse().map(function (p) { return [-p[0], p[1]]; });
    return R.concat([[0, -0.42]]).concat(L.slice(0, L.length - 1));
  }
  function citadelBanner(b, x, y, z, w, h, o) {
    o = o || {}; var M = KIT.M, s = Math.min(w, h) * (o.es || 0.82), cy = -h * (o.ey || 0.4), seed = b.seed, ec = o.ec || '#f1eee8';
    b.banner(x, y, z, w, h, Object.assign({}, o, { emblem: 'none' }));
    var shapes = [{ pts: citadelDragonPts(), c: ec }, { pts: [[0.025, -0.3], [0.14, -0.41], [0.02, -0.39]], c: o.fin || 'ember' }, { pts: [[-0.025, -0.3], [-0.14, -0.41], [-0.02, -0.39]], c: ec }];
    b.push(x, y, z, o.ry || 0);
    shapes.forEach(function (sh) {
      [0.016, -0.016].forEach(function (dz) {
        var g = KIT.geo.extrude(sh.pts.map(function (p) { return [p[0] * s, cy + p[1] * s]; }), 0.006, {}), p = g.attributes.position;
        for (var i = 0; i < p.count; i++) { var px = p.getX(i), py = p.getY(i), t = -py / h; p.setZ(i, p.getZ(i) + dz + Math.sin(px * 3.1 + t * 2.0 + seed) * 0.05 * t + (o.wave || 0) * t * t); }
        b.addGeo(g, { c: sh.c, m: M.cloth, bucket: 'cloth', ao: 0, jit: 0.01, vary: 0.02, sway: 1, swayFn: function (lx, ly) { var tt = -ly / h; return tt * tt; } });
      });
    });
    b.pop();
  }

  // a corner tower's top: corbels, a wide ledge of curved kerb stones and flagstones, six piers, the arches, a band,
  // the slate cone row by row and its pennant, and an iron fire basket under the arches
  function citadelTowerTop(b, t) {
    var M = KIT.M, cx = t.x, cz = t.z, yS = t.yS, DR = t.dr, AR = t.ar, PH = t.ph, DY = t.dy, NP = 6, rot = t.la - Math.PI / 6, i;
    b.unit(function () {
      var n = 22;
      for (i = 0; i < n; i++) {
        var a = i / n * Math.PI * 2 + 0.07, ca = Math.cos(a), sa = Math.sin(a), ry = Math.PI / 2 - a;
        if (Math.abs(Math.atan2(Math.sin(a - t.la), Math.cos(a - t.la))) < 0.9) continue;
        if (t.low && [Math.atan2(0, -Math.sign(t.x)), Math.atan2(-Math.sign(t.z), 0)].some(function (wa) { return Math.abs(Math.atan2(Math.sin(a - wa), Math.cos(a - wa))) < 0.55; })) continue;
        b.box(cx + ca * (TRO + 0.12), yS - 0.92, cz + sa * (TRO + 0.12), 0.34, 0.46, 0.55, { ry: ry, c: b.stoneC('sandstone'), bevel: 0.05 });
        b.box(cx + ca * (TRO + 0.34), yS - 0.47, cz + sa * (TRO + 0.34), 0.4, 0.47, 0.96, { ry: ry, c: b.stoneC('sandstone'), bevel: 0.05 });
      }
    });
    b.unit(function () {
      b.cyl(cx, yS, cz, DR - 0.5, 0.44, { c: 'stoneDark', m: M.stone, seg: 28, flat: true, ao: 0.1 });
      var n = Math.round(Math.PI * 2 * DR / 0.85), ar = Math.PI * 2 / n;
      for (i = 0; i < n; i++) { var a = i * ar + b.j(0.02); b.addGeo(citadelArcGeo(DR - 0.62, DR + b.j(0.02), a - ar / 2 + 0.012, a + ar / 2 - 0.012, 0.52, 0.06), { x: cx, y: yS, z: cz, c: b.stoneC('stone', 8), m: M.stone, ao: 0.15, jit: 0.04 }); }
    });
    b.unit(function () {
      b.cyl(cx, yS + 0.44, cz, AR - 0.45, 0.08, { c: 'stone', m: M.stone, seg: 20, flat: true });
      [[AR - 0.45, AR + 0.45], [AR + 0.45, DR - 0.62]].forEach(function (rg, k) {
        var rm = (rg[0] + rg[1]) / 2, n = Math.max(8, Math.round(Math.PI * 2 * rm / 0.8)), ar = Math.PI * 2 / n, off = k * ar * 0.5;
        for (var q = 0; q < n; q++) { var a = q * ar + off; b.addGeo(citadelArcGeo(rg[0] + 0.02, rg[1] - 0.02, a - ar / 2 + 0.02 / rm, a + ar / 2 - 0.02 / rm, 0.08 + b.j(0.008), 0.02), { x: cx, y: yS + 0.44, z: cz, c: b.stoneC('stoneCool'), m: M.stone, ao: 0.1, jit: 0.04 }); }
      });
    });
    // the ledge: a broad sector of curved slabs out past the rim on the sunny side, on stepped brackets
    b.unit(function () {
      var A0 = t.la - 0.85, A1 = t.la + 0.85, DO = DR + 2.1;
      [[DR - 0.6, DR + 0.75], [DR + 0.75, DO]].forEach(function (rg, q) {
        var rm = (rg[0] + rg[1]) / 2, n = Math.max(3, Math.round((A1 - A0) * rm / 0.95)), ar = (A1 - A0) / n, off = q ? ar * 0.5 : 0;
        for (var k = 0; k < n + (q ? 1 : 0); k++) {
          var a0 = Math.max(A0, A0 + k * ar - off), a1 = Math.min(A1, A0 + (k + 1) * ar - off); if (a1 - a0 < 0.05) continue;
          b.addGeo(citadelArcGeo(rg[0] + 0.02, rg[1] - 0.02 + b.j(0.02), a0 + 0.02 / rm, a1 - 0.02 / rm, 0.5, 0.04), { x: cx, y: DY - 0.515, z: cz, c: b.stoneC('stone', 9), m: M.stone, ao: 0.15, jit: 0.04 });
        }
      });
      for (var k = 0; k <= 8; k++) {
        var a = A0 + 0.07 + k * (A1 - A0 - 0.14) / 8, ry = Math.PI / 2 - a, ca = Math.cos(a), sa = Math.sin(a);
        [[TRO + 0.75, DY - 2.05, 0.44, 0.5], [DR + 0.3, DY - 1.55, 0.48, 0.5], [DO - 0.3, DY - 1.05, 0.5, 0.52]].forEach(function (q) {
          var r0 = TRO - 0.2, rm = (r0 + q[0]) / 2; b.box(cx + ca * rm, q[1], cz + sa * rm, q[2], q[3], q[0] - r0, { ry: ry, c: b.stoneC('sandstone'), m: M.stone, bevel: 0.05 });
        });
      }
    });
    var P = []; for (i = 0; i < NP; i++) { var ap = rot + i * Math.PI * 2 / NP; P.push([cx + Math.cos(ap) * AR, cz + Math.sin(ap) * AR, ap]); }
    b.unit(function () {
      P.forEach(function (p) {
        var ry = Math.PI / 2 - p[2], nd = 4, dh = (PH - 0.5) / nd;
        b.box(p[0], DY, p[1], 0.72, 0.26, 0.72, { ry: ry, c: b.stoneC('sandstone'), bevel: 0.05 });
        for (var k = 0; k < nd; k++) b.box(p[0], DY + 0.26 + k * dh, p[1], 0.52 + b.j(0.02), dh - 0.03, 0.52 + b.j(0.02), { ry: ry + b.j(0.03), c: b.stoneC('stone', 9), bevel: 0.05 });
        b.box(p[0], DY + PH - 0.24, p[1], 0.74, 0.24, 0.74, { ry: ry, c: b.stoneC('sandstone'), bevel: 0.05 });
      });
    });
    var C = 2 * AR * Math.sin(Math.PI / NP), ri = (C - 0.52) / 2, rt = 0.32, ySp = DY + PH, yB = ySp + ri + rt;
    b.unit(function () {
      for (i = 0; i < NP; i++) {
        var p = P[i], q = P[(i + 1) % NP], mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2, am = Math.atan2(mz - cz, mx - cx), ry = Math.PI / 2 - am;
        citadelArch(b, mx, ySp, mz, ry, ri, rt, 0.5, {});
        b.push(mx, ySp, mz, ry);
        var x0 = ri * 0.48, yb = Math.sqrt(ri * ri - x0 * x0) + 0.05;
        [-1, 1].forEach(function (sd) { b.box(sd * (x0 + ri * 1.04) / 2, yb, 0, ri * 0.56, ri + rt - yb, 0.4, { c: b.stoneC('stone', 12), m: M.stone, bevel: 0.04 }); });
        b.pop();
      }
      P.forEach(function (p) { b.box(p[0], ySp, p[1], 0.62, ri + rt, 0.48, { ry: Math.PI / 2 - p[2], c: b.stoneC('stone', 12), bevel: 0.05 }); });
    });
    b.unit(function () {
      for (i = 0; i < NP; i++) {
        var p = P[i], q = P[(i + 1) % NP], mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2, am = Math.atan2(mz - cz, mx - cx), ry = Math.PI / 2 - am;
        b.push(mx, yB, mz, ry);
        [-1, 1].forEach(function (sd) { b.box(sd * C / 4, 0, 0.04, C / 2 + 0.16, 0.36, 0.66, { c: b.stoneC('sandstone'), m: M.stone, bevel: 0.05 }); });
        b.pop();
      }
    });
    b.coneRoof(cx, yB + 0.36, cz, AR + 1.0, t.rise, { m: 'slate', rows: 5, flare: 0.45, seg: 18 });
    b.unit(function () {
      var top = yB + 0.36 + t.rise;
      b.flag(cx, top - 0.15, cz, t.key === 'fr' ? 1.9 : 1.5, t.key === 'fr' ? 1.5 : 1.2, t.key === 'fr' ? 0.55 : 0.45, { c: t.pen, pennant: true, ry: -0.5 });
      // the fire basket under the arches, on a round stone step, to signal from
      b.cyl(cx, DY, cz, 0.62, 0.22, { c: 'stoneDark', m: M.stone, seg: 14, flat: true, ao: 0.2 });
      b.brazier(cx, DY + 0.22, cz, 1.0);
    });
  }

  KIT.defineBuild('citadel', {
    name: 'Citadel', size: 'big', need: 150,
    line: 'The last and greatest build: a stone keep inside battlemented curtain walls, a gate under a carved timber gallery, and four round corner towers crowned with open arcades, a fire basket under each and a sentry on its ledge.',
    r: 22, flat: [27, 25], ground: 'cobble', path: [[1.6, 22.5], [0.8, 13.0], [0.2, 10.4]],
    frameY: 7.8, frameR: 21, glowAt: [WX, 20.2, WZ],
    trees: [{ x: -16.8, z: -9.4, kind: 'pine', h: 9.2 }, { x: -18.6, z: -4.4, kind: 'pine', h: 7.4 }, { x: 16.9, z: -9.8, kind: 'pine', h: 8.8 }, { x: 18.6, z: -3.6, kind: 'pine', h: 6.8 },
      { x: 18.2, z: 5.8, kind: 'round', h: 5.6 }, { x: -18.0, z: 6.6, kind: 'birch', h: 6.2 }, { x: 4.0, z: -17.6, kind: 'pine', h: 8.4 }, { x: -6.5, z: -17.2, kind: 'pine', h: 7.6 }],
    bushes: [{ x: 14.8, z: 11.2, r: 0.9, flowers: '#f3f1ec' }, { x: -14.6, z: 12.4, r: 0.85 }, { x: 16.8, z: 1.6, r: 0.75 }, { x: -16.2, z: 1.0, r: 0.8, flowers: '#efebe4' }, { x: 7.8, z: 16.4, r: 0.7 }],
    islandOpts: { cobbleSkip: function (x, z) { return (Math.abs(x) < WX - 0.6 && Math.abs(z) < WZ - 0.6) || (Math.abs(x) < WX + 0.9 && Math.abs(Math.abs(z) - WZ) < 1.2) || (Math.abs(z) < WZ + 0.9 && Math.abs(Math.abs(x) - WX) < 1.2) || (Math.abs(x) < GX + 0.4 && z > GZ0 && z < GZ1 + 0.3) || Math.hypot(Math.abs(x) - WX, Math.abs(z) - WZ) < TRO + 0.3; } },
    build: function (b) {
      var M = KIT.M, i, k;
      var GH = b.ground;
      function gh(x, z) { return GH ? Math.max(-0.04, GH.height(x, z)) : 0; }
      b.push(0, 0, 0, 0);

      // the curtain wall runs between the towers; their ends tuck into the towers and the gatehouse
      var runs = [
        { a: [-WX + TR - 0.4, WZ], b: [-GX + 0.25, WZ], out: [0, 1] },
        { a: [GX - 0.25, WZ], b: [WX - TR + 0.4, WZ], out: [0, 1] },
        { a: [WX, WZ - TR + 0.4], b: [WX, -WZ + TR - 0.4], out: [1, 0] },
        { a: [WX - TR + 0.4, -WZ], b: [-WX + TR - 0.4, -WZ], out: [0, -1] },
        { a: [-WX, -WZ + TR - 0.4], b: [-WX, WZ - TR + 0.4], out: [-1, 0] }
      ];
      function strip(r, y, h, grow, c) {
        var mx = (r.a[0] + r.b[0]) / 2, mz = (r.a[1] + r.b[1]) / 2, L = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]), alongX = Math.abs(r.b[0] - r.a[0]) > 0.1;
        b.box(mx, y, mz, alongX ? L : WT + grow, h, alongX ? WT + grow : L, { c: c, bevel: 0.07 });
      }

      b.part('Footings');
      b.unit(function () {
        runs.forEach(function (r) { strip(r, -0.08, 0.36, 0.9, 'stoneDark'); });
        TOWERS.forEach(function (t) { b.cyl(t.x, -0.08, t.z, TRO + 0.42, 0.36, { c: 'stoneDark', m: M.stone, seg: 26, flat: true }); });
        b.box(0, -0.08, (GZ0 + GZ1) / 2, GX * 2 + 0.9, 0.36, GZ1 - GZ0 + 0.9, { c: 'stoneDark', bevel: 0.08 });
        b.box(KCX, -0.08, KCZ, KW + 0.9, 0.36, KD + 0.9, { c: 'stoneDark', bevel: 0.08 });
      });
      b.unit(function () {
        runs.forEach(function (r) { strip(r, 0.28, 0.27, 0.5, 'stone'); });
        TOWERS.forEach(function (t) { b.cyl(t.x, 0.28, t.z, TRO + 0.2, 0.27, { c: 'stone', m: M.stone, seg: 26, flat: true }); });
        b.box(0, 0.28, (GZ0 + GZ1) / 2, GX * 2 + 0.5, 0.27, GZ1 - GZ0 + 0.5, { c: 'stone', bevel: 0.07 });
        b.box(KCX, 0.28, KCZ, KW + 0.5, 0.27, KD + 0.5, { c: 'stone', bevel: 0.07 });
      });

      b.part('Curtain walls');
      var groups = [[0, 1], [2], [3], [4]];
      for (k = 0; k < NW; k++) groups.forEach(function (g) {
        b.unit(function () { g.forEach(function (ri) { var r = runs[ri]; citadelCourse(b, r.a[0], r.a[1], r.b[0], r.b[1], BASE + k * CH, CH, WT, k, { pal: 'stone', len: 0.85 }); }); });
      });

      b.part('Corner towers');
      function wrap(a) { return ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; }
      TOWERS.forEach(function (t) {
        var th = Math.atan2(t.z, t.x), slits = [];
        [[th - 0.62, [3, 13]], [th, [8, 18]], [th + 0.62, [3, 13]]].forEach(function (s) { s[1].forEach(function (k0) { if (k0 + 1 < t.n - 3) slits.push({ a: s[0], k0: k0 }); }); });
        var hw = 0.11 / TRO;
        var cut = function (a0, a1, yc, kk) {
          var keep = [[a0, a1]], am = (a0 + a1) / 2;
          slits.forEach(function (s) {
            if (kk < s.k0 || kk > s.k0 + 1) return;
            var c = am + wrap(s.a - am), lo = c - hw, hi = c + hw, nk = [];
            keep.forEach(function (q) { if (q[1] <= lo || q[0] >= hi) { nk.push(q); return; } if (q[0] < lo) nk.push([q[0], lo]); if (q[1] > hi) nk.push([hi, q[1]]); });
            keep = nk;
          });
          return keep;
        };
        citadelRing(b, t.x, t.z, TR, BASE, t.n, CH, 0.7, { cut: cut, pal: 'stone' });
        t.slits = slits;
      });
      b.unit(function () {
        TOWERS.forEach(function (t) {
          t.slits.forEach(function (s) {
            var y = BASE + s.k0 * CH + 0.02, ca = Math.cos(s.a), sa = Math.sin(s.a);
            b.box(t.x + ca * (TR + 0.12), y, t.z + sa * (TR + 0.12), 0.24, CH * 2 - 0.04, 0.3, { ry: Math.PI / 2 - s.a, c: '#1c1b1a', m: M.dark, bevel: 0, ao: 0 });
            b.box(t.x + ca * (TRO + 0.02), y - 0.14, t.z + sa * (TRO + 0.02), 0.5, 0.14, 0.24, { ry: Math.PI / 2 - s.a, c: b.stoneC('sandstone'), m: M.stone, bevel: 0.03 });
          });
        });
      });

      b.part('Great gate');
      var gateOp = { side: 'front', t: GX, hw: 1.45, y0: 0, spring: BASE + 7 * CH, r: 1.45 + 0.42 };
      var gwinOp = { side: 'front', t: GX, hw: 0.32, y0: BASE + 14 * CH, spring: BASE + 14 * CH + 0.66, r: 0.32 + 0.22 };
      gateOp.lay = function () {
        var zl = GZ1 - 0.425, hr = gateOp.spring - BASE, pts = [[-1.45, 0], [1.45, 0], [1.45, hr]];
        citadelArch(b, 0, gateOp.spring, zl, 0, 1.45, 0.42, 0.9, { n: 15 });
        for (var q = 1; q < 12; q++) { var a = q / 12 * Math.PI; pts.push([Math.cos(a) * 1.45, hr + Math.sin(a) * 1.45]); }
        pts.push([-1.45, hr]);
        b.extrude(0, BASE, GZ1 - 0.55 - 1.5, pts, 3.0, { c: '#2b2420', m: M.dark, ao: 0, jit: 0 });
        // the portcullis, raised: iron bars in the arch with spiked feet
        var pz = GZ1 - 0.32, yb = BASE + 2.45, sp = gateOp.spring;
        for (var x = -1.3; x <= 1.31; x += 0.26) {
          var top = sp + Math.sqrt(Math.max(0, 1.45 * 1.45 - x * x)) - 0.06;
          b.beam([x, yb, pz], [x, top, pz], 0.035, { c: 'iron', m: M.metal });
          b.cone(x, yb, pz, 0.045, 0.18, { c: 'iron', m: M.metal, seg: 4, rx: Math.PI });
        }
        [yb + 0.2, yb + 0.75, sp + 0.3, sp + 0.85].forEach(function (y) { var hh = y <= sp ? 1.42 : Math.sqrt(1.45 * 1.45 - (y - sp) * (y - sp)) - 0.04; b.beam([-hh, y, pz + 0.04], [hh, y, pz + 0.04], 0.03, { c: 'iron', m: M.metal }); });
      };
      gwinOp.lay = function () { citadelWin(b, 0, GZ1, 0, gwinOp, 0.85, { shutters: '#1f1e1c' }); };
      citadelBox(b, 0, (GZ0 + GZ1) / 2, GX * 2, GZ1 - GZ0, BASE, GN, CH, 0.85, [gateOp, gwinOp], { pal: 'stone' });

      b.part('The keep');
      var kops = [], kwin = [];
      var kdoor = { side: 'front', t: KW / 2, hw: 0.72, y0: BASE + 7 * CH, spring: BASE + 11 * CH, r: 0.72 + 0.32 };
      kdoor.lay = function () {
        citadelArch(b, KCX, kdoor.spring, KZ1 - KT / 2, 0, 0.72, 0.32, KT + 0.04, {});
        b.archDoor(KCX, kdoor.y0, KZ1 - 0.25, 1.44, kdoor.spring - kdoor.y0 + 0.72, { frame: false, depth: 0.6, doorC: 'woodDark' });
      };
      kops.push(kdoor);
      [[1.25, 1], [6.75, 1], [1.25, 2], [KW / 2, 2], [6.75, 2], [1.25, 3], [6.75, 3]].forEach(function (w) {
        var row2 = w[1] === 2, row3 = w[1] === 3, op = { side: 'front', t: w[0], hw: row2 ? 0.44 : row3 ? 0.32 : 0.38, y0: BASE + (row2 ? 16 : row3 ? 23 : 9) * CH, spring: BASE + (row2 ? 19 : row3 ? 25 : 11) * CH };
        op.r = op.hw + (row2 ? 0.26 : 0.24);
        op.lay = function () { citadelWin(b, KX0 + op.t, KZ1, 0, op, KT, { shutters: row2 ? '#1f1e1c' : null, flowers: !row2 }); };
        kops.push(op);
      });
      [[1.7, 1], [4.6, 1], [1.7, 2], [4.6, 2]].forEach(function (w) {
        var row2 = w[1] === 2;
        ['left', 'right'].forEach(function (sd) {
          var op = { side: sd, t: w[0], hw: 0.38, y0: BASE + (row2 ? 16 : 9) * CH, spring: BASE + (row2 ? 18 : 11) * CH, r: 0.62 };
          op.lay = function () {
            if (sd === 'left') citadelWin(b, KX0, KZ0 + KT + op.t, -Math.PI / 2, op, KT, { shutters: row2 ? '#1f1e1c' : null });
            else citadelWin(b, KX1, KZ1 - KT - op.t, Math.PI / 2, op, KT, {});
          };
          kops.push(op);
        });
      });
      citadelBox(b, KCX, KCZ, KW, KD, BASE, KN, CH, KT, kops, { pal: 'stone' });

      b.part('Keep gable');
      var gwin = { t: 0, hw: 0.42, y0: KE + CH, spring: KE + 3 * CH, r: 0.42 + 0.24 }, gwinDone = false;
      for (k = 0; k < 12; k++) {
        var gy = KE + k * CH, hwTop = (KW / 2) * (1 - (gy + CH - KE) / KR) - 0.04;
        if (hwTop < 0.3) break;
        b.unit(function () {
          [KZ1 - KT / 2, KZ0 + KT / 2].forEach(function (zg, gi) {
            var cut = gi === 0 ? citadelCut([{ t: hwTop, hw: gwin.hw, y0: gwin.y0, spring: gwin.spring, r: gwin.r }]) : null;
            citadelCourse(b, KCX - hwTop, zg, KCX + hwTop, zg, gy, CH, KT, k, { cut: cut, pal: 'stone' });
          });
        });
        if (!gwinDone && gy + CH >= gwin.spring - 0.01) { gwinDone = true; b.unit(function () { citadelWin(b, KCX, KZ1, 0, gwin, KT, { shutters: '#1f1e1c' }); }); }
      }

      b.part('Wall walks and battlements');
      // the clean run of each wall between the tower faces and the gatehouse
      var walks = [
        { a: [-WX + TRO, WZ], b: [-GX, WZ], o: [0, 1] }, { a: [GX, WZ], b: [WX - TRO, WZ], o: [0, 1] },
        { a: [WX, WZ - TRO], b: [WX, -WZ + TRO], o: [1, 0] }, { a: [WX - TRO, -WZ], b: [-WX + TRO, -WZ], o: [0, -1] }, { a: [-WX, -WZ + TRO], b: [-WX, WZ - TRO], o: [-1, 0] }
      ];
      walks.forEach(function (w) {
        var dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, ry = -Math.atan2(uz, ux);
        var P = function (t, off) { return [w.a[0] + ux * t + w.o[0] * off, w.a[1] + uz * t + w.o[1] * off]; };
        b.unit(function () {
          // flagstones over the walk, and the parapet's first course
          var t = 0.05; while (t < L - 0.1) { var l = Math.min(L - 0.05 - t, 0.7 + b.r() * 0.35), p = P(t + l / 2, -0.27); b.box(p[0], WALK, p[1], l - 0.05, 0.1, 0.92, { ry: ry, c: b.stoneC('stoneCool'), m: M.stone, bevel: 0.025 }); t += l; }
          t = 0; while (t < L - 0.05) { var l2 = Math.min(L - t, 0.7 + b.r() * 0.4), p2 = P(t + l2 / 2, 0.47); b.box(p2[0], WALK, p2[1], l2 - 0.05, 0.4, 0.56, { ry: ry + b.j(0.01), c: b.stoneC('stone', 6), m: M.stone, bevel: 0.05 }); t += l2; }
        });
        b.unit(function () {
          // merlons with capstones, and the crenels between
          var n = Math.max(2, Math.round((L + 0.55) / 1.4)), pitch = (L + 0.55) / n;
          for (var q = 0; q < n; q++) {
            var tm = q * pitch + (pitch - 0.55) / 2, p = P(tm, 0.47), mw = pitch - 0.6;
            if (TOWERS.some(function (t) { return t.low && Math.hypot(p[0] - t.x, p[1] - t.z) < t.dr + 0.25 + mw / 2; })) continue;
            b.box(p[0], WALK + 0.4, p[1], mw, 0.72, 0.52, { ry: ry + b.j(0.015), c: b.stoneC('stone', 7), m: M.stone, bevel: 0.05 });
            b.box(p[0], WALK + 1.12, p[1], mw + 0.1, 0.13, 0.62, { ry: ry, c: b.stoneC('sandstone'), m: M.stone, bevel: 0.03 });
          }
        });
      });

      b.part('Tower tops');
      // each tower's top is laid in turn: corbels, ledge and flagstones, piers, arches, band, cone and fire basket
      var topOrder = [0, 1, 3, 2];
      topOrder.forEach(function (ti) { citadelTowerTop(b, TOWERS[ti]); });

      b.part('Keep roof');
      b.gableRoof(KCX, KE, KCZ, KD + 0.1, KW, KR, { m: 'slate', ry: Math.PI / 2, rows: 11, over: 0.55, overX: 0.5 });
      b.unit(function () {
        var slope = KR / (KW / 2), ye = KE - 0.55 * slope;
        citadelBarge(b, KCX, ye, KE + KR + 0.1, KW / 2 + 0.55, KZ1 + 0.56, 1.0, 1.05, 1);
        citadelBarge(b, KCX, ye, KE + KR + 0.1, KW / 2 + 0.55, KZ0 - 0.56, 1.0, 1.05, -1);
      });
      b.unit(function () {
        var chx = KCX + 2.1, chz = KCZ - 1.9;
        b.box(chx, KE + 1.6, chz, 0.95, 2.9, 0.95, { c: 'stone', bevel: 0.06 });
        b.box(chx, KE + 4.5, chz, 1.15, 0.22, 1.15, { c: 'sandstone', bevel: 0.05 });
        b.box(chx, KE + 4.72, chz, 0.5, 0.32, 0.5, { c: 'tile', m: M.tile, bevel: 0.05 });
      });

      b.part('Gate gallery');
      var GLZC = (GLZ0 + GLZ1) / 2;
      b.unit(function () {
        b.box(0, GTOP, (GZ0 + GZ1) / 2, GX * 2 + 0.16, 0.12, GZ1 - GZ0 + 0.16, { c: 'stoneDark', bevel: 0.03 });
        for (var x = -GX + 0.3; x <= GX - 0.2; x += 0.7) b.box(x, GTOP + 0.12, GLZC, 0.18, 0.16, GLZ1 - GLZ0 + 0.2, { c: 'beam', m: M.wood, bevel: 0.03 });
        b.box(0, GTOP + 0.28, GLZC, GLX * 2, 0.08, GLZ1 - GLZ0, { c: 'woodDark', m: M.wood, bevel: 0.01 });
        [-3.35, -1.2, 1.2, 3.35].forEach(function (x) { b.beam([x, GTOP - 0.95, GZ1 + 0.02], [x, GTOP + 0.12, GLZ1 + 0.05], 0.08, { c: 'beam' }); });
      });
      b.unit(function () {
        var xs = [-GLX, -2.25, -0.75, 0.75, 2.25, GLX], zs = [GLZ0, GLZ0 + 1.4, GLZ0 + 2.8, GLZ1];
        b.beam([-GLX, GLY + 0.1, GLZ1], [GLX, GLY + 0.1, GLZ1], 0.12, { c: 'beam' }); b.beam([-GLX, GLY + 0.1, GLZ0], [GLX, GLY + 0.1, GLZ0], 0.12, { c: 'beam' });
        b.beam([-GLX, GLY + 0.1, GLZ0], [-GLX, GLY + 0.1, GLZ1], 0.12, { c: 'beam' }); b.beam([GLX, GLY + 0.1, GLZ0], [GLX, GLY + 0.1, GLZ1], 0.12, { c: 'beam' });
        xs.forEach(function (x) { b.post(x, GLY, GLZ1, 0.11, GLH, { c: 'beam' }); b.post(x, GLY, GLZ0, 0.11, GLH, { c: 'beam' }); });
        zs.forEach(function (z) { b.post(-GLX, GLY, z, 0.11, GLH, { c: 'beam' }); b.post(GLX, GLY, z, 0.11, GLH, { c: 'beam' }); });
        b.beam([-GLX - 0.1, GLT - 0.1, GLZ1], [GLX + 0.1, GLT - 0.1, GLZ1], 0.12, { c: 'beam' }); b.beam([-GLX - 0.1, GLT - 0.1, GLZ0], [GLX + 0.1, GLT - 0.1, GLZ0], 0.12, { c: 'beam' });
        b.beam([-GLX, GLT - 0.1, GLZ0], [-GLX, GLT - 0.1, GLZ1], 0.12, { c: 'beam' }); b.beam([GLX, GLT - 0.1, GLZ0], [GLX, GLT - 0.1, GLZ1], 0.12, { c: 'beam' });
      });
      b.unit(function () {
        b.planks(0, GLY + 0.2, GLZ1 - 0.04, GLX * 2, GLH - 0.3, { vertical: true, c: '#4a3e33', t: 0.07 });
        b.planks(0, GLY + 0.2, GLZ0 + 0.04, GLX * 2, GLH - 0.3, { vertical: true, c: '#4a3e33', t: 0.07, ry: Math.PI });
      });
      b.unit(function () {
        b.planks(-GLX + 0.04, GLY + 0.2, GLZC, GLZ1 - GLZ0, GLH - 0.3, { vertical: true, c: '#463a30', t: 0.07, ry: -Math.PI / 2 });
        b.planks(GLX - 0.04, GLY + 0.2, GLZC, GLZ1 - GLZ0, GLH - 0.3, { vertical: true, c: '#463a30', t: 0.07, ry: Math.PI / 2 });
        // the gable ends, boarded and battened
        [GLZ1 - 0.03, GLZ0 + 0.03].forEach(function (z) {
          b.extrude(0, GLT, z, [[-GLX, 0], [GLX, 0], [0, GLR - 0.05]], 0.06, { c: '#3d332a', m: M.wood });
          for (var x = -GLX + 0.45; x < GLX - 0.3; x += 0.5) { var hh = GLR * (1 - Math.abs(x) / GLX) - 0.12; if (hh > 0.2) b.beam([x, GLT, z + (z > GLZC ? 0.05 : -0.05)], [x, GLT + hh, z + (z > GLZC ? 0.05 : -0.05)], 0.035, { c: 'beam' }); }
        });
      });
      b.gableRoof(0, GLT, GLZC, GLZ1 - GLZ0 + 0.1, GLX * 2, GLR, { m: 'wood', ry: Math.PI / 2, rows: 5, over: 0.45, overX: 0.35 });
      b.unit(function () {
        var slope = GLR / GLX, ye = GLT - 0.45 * slope;
        citadelBarge(b, 0, ye, GLT + GLR + 0.08, GLX + 0.45, GLZ1 + 0.45, 0.85, 0.8, 1);
        citadelBarge(b, 0, ye, GLT + GLR + 0.08, GLX + 0.45, GLZ0 - 0.45, 0.85, 0.8, -1);
      });

      b.part('Banners and shields');
      b.unit(function () {
        [-2.45, 2.45].forEach(function (x) {
          b.beam([x, GTOP - 0.5, GZ1 + 0.02], [x, GTOP - 0.5, GZ1 + 0.22], 0.04, { c: 'iron', m: M.metal });
          citadelBanner(b, x, GTOP - 0.5, GZ1 + 0.2, 1.25, 3.6, { c: 'ink', tail: 'swallow', band: 'ember', bandAt: 0.76, bandH: 0.045, trim: 'iron' });
        });
      });
      b.unit(function () {
        [-1.45, 1.45].forEach(function (dx) {
          var x = KCX + dx, y = KE - 0.35;
          b.beam([x, y, KZ1 + 0.02], [x, y, KZ1 + 0.26], 0.045, { c: 'iron', m: M.metal });
          citadelBanner(b, x, y, KZ1 + 0.24, 1.35, 5.0, { c: 'ink', tail: 'swallow', band: 'ember', bandAt: 0.78, bandH: 0.04, trim: 'iron' });
        });
      });
      b.unit(function () {
        [[-3.3, 'ink', 'bone'], [0, 'bone', 'ink'], [3.3, 'inkGrey', 'bone']].forEach(function (s) { citadelShield(b, KCX + s[0], BASE + 14.6 * CH, KZ1 + 0.07, s[1], s[2], 0.95); });
      });
      b.unit(function () {
        [-3.0, -1.5, 0, 1.5, 3.0].forEach(function (x, q) { citadelShield(b, x, GLY + 1.0, GLZ1 + 0.1, q % 2 ? 'bone' : 'ink', q % 2 ? 'ink' : 'bone', 0.9); });
      });
      b.unit(function () {
        [-6.4, -5.2, -4.1].forEach(function (x, q) { citadelShield(b, x, BASE + 9.6 * CH, WZ + WT / 2 + 0.07, q % 2 ? 'bone' : 'ink', q % 2 ? 'ink' : 'bone', 0.85); });
        [4.1, 5.2, 6.4].forEach(function (x, q) { citadelShield(b, x, BASE + 9.6 * CH, WZ + WT / 2 + 0.07, q % 2 ? 'ink' : 'bone', q % 2 ? 'bone' : 'ink', 0.85); });
      });
      b.unit(function () {
        [-2.1, 2.1].forEach(function (x) { b.torch(x, BASE + 2.2, GZ1 + 0.03, { s: 0.65 }); });
        [-1.15, 1.15].forEach(function (x) { b.torch(KCX + x, BASE + 8.8 * CH, KZ1 + 0.03, { s: 0.55 }); });
      });

      b.part('Keep stair');
      b.unit(function () {
        var top = kdoor.y0, lz = KZ1 + 0.8;
        b.box(KCX, 0, lz, 2.3, top - 0.1, 1.4, { c: '#8a7e6c', bevel: 0 });
        for (var q = 0; q < Math.round(top / CH); q++) citadelCourse(b, KCX - 1.15, KZ1 + 1.5, KCX + 1.15, KZ1 + 1.5, q * CH, CH, 0.36, q, { pal: 'stone', len: 0.7 });
        b.box(KCX, top - 0.12, lz, 2.45, 0.14, 1.6, { c: b.stoneC('sandstone'), m: M.stone, bevel: 0.03 });
      });
      b.unit(function () {
        var top = kdoor.y0, n = 9, rise = (top - 0.12) / n;
        for (var q = 0; q < n; q++) b.box(KCX + 1.15 + (q + 0.5) * 0.34, 0, KZ1 + 0.82, 0.36, top - 0.12 - (q + 1) * rise + rise, 1.3, { c: b.stoneC('stone', 1), m: M.stone, bevel: 0.04 });
      });

      b.part('Stores and yard');
      // out front, in the sun: racks, a water trough, hay, barrels, braziers at the gate, a cart
      b.unit(function () { b.rack(-5.4, 0, WZ + WT / 2 + 0.55, 2.3, { kind: 'spears' }); });
      b.unit(function () { b.rack(-4.6, 0, WZ + WT / 2 + 1.9, 1.9, { kind: 'shields', ry: 0.25 }); });
      b.unit(function () {
        // a long plank water trough on trestles, buckets beside it
        var tx = 5.5, tz = WZ + WT / 2 + 1.1;
        [-1, 1].forEach(function (sd) { b.box(tx, 0.12, tz + sd * 0.4, 3.2, 0.5, 0.08, { c: 'woodDark', m: M.wood, bevel: 0.015 }); b.box(tx + sd * 1.56, 0.12, tz, 0.08, 0.5, 0.88, { c: 'woodDark', m: M.wood, bevel: 0.015 }); });
        [-1.3, 0, 1.3].forEach(function (dx) { b.box(tx + dx, 0, tz, 0.14, 0.14, 1.0, { c: 'beam', m: M.wood, bevel: 0.02 }); b.box(tx + dx, 0.12, tz + 0.46, 0.06, 0.55, 0.06, { c: 'iron', m: M.metal, bevel: 0.01 }); });
        b.box(tx, 0.16, tz, 3.04, 0.3, 0.74, { c: '#2b2723', m: M.wood, bevel: 0 });
        b.box(tx, 0.46, tz, 3.0, 0.02, 0.7, { c: '#55666b', m: M.water || M.window, bevel: 0, ao: 0 });
        b.bucket(tx + 2.1, 0, tz + 0.4); b.bucket(tx + 2.4, 0, tz - 0.1);
      });
      b.unit(function () {
        b.hay(7.6, 0, 11.0, { ry: 0.3 }); b.hay(8.6, 0, 11.6, { ry: -0.2 }); b.hay(8.0, 0.55, 11.3, { ry: 0.1, w: 1.0 });
        b.sack(6.6, 0, 11.7, 0.5); b.sack(6.2, 0, 12.1, 0.42);
      });
      b.unit(function () {
        b.barrel(-3.95, 0, 10.6, {}); b.barrel(-4.0, 0, 11.4, { h: 0.82 }); b.barrel(-7.4, 0, 10.8, { lie: true, ry: 0.4 });
        b.crate(-7.0, 0, 9.9, 0.75, { ry: 0.2 }); b.crate(-7.05, 0.75, 9.95, 0.55, { ry: -0.3 });
      });
      b.unit(function () {
        [-2.9, 2.9].forEach(function (x) {
          b.box(x, 0, 11.1, 0.7, 0.55, 0.7, { c: b.stoneC('sandstone'), m: M.stone, bevel: 0.06 });
          b.brazier(x, 0.55, 11.1, 0.75, { i: 1.2 });
        });
      });
      b.unit(function () {
        var cx = -5.2, cz = 14.2, y0 = gh(cx, cz);
        b.push(0, y0, 0, 0);
        b.cart(cx, cz, { ry: -0.45, load: function () { b.box(0, 0.78, -0.3, 1.1, 0.4, 0.9, { c: 'straw', m: M.straw, bevel: 0.08 }); b.barrel(-0.3, 0.71, 0.55, { h: 0.6, r: 0.24 }); b.sack(0.3, 0.71, 0.5, 0.4); } });
        b.pop();
      });
      b.unit(function () { b.woodpile(-8.2, 12.0, { ry: 0.3, n: 4, len: 1.5 }); });
      b.unit(function () {
        // inside: hay and barrels by the keep stair, a water trough
        b.hay(-4.4, 0, 2.2, { ry: 0.2 }); b.hay(-4.6, 0, 3.1, { ry: -0.3 }); b.barrel(-3.3, 0, 2.6, {}); b.barrel(4.8, 0, 3.0, {});
        b.box(5.6, 0, 0.5, 2.6, 0.6, 0.9, { c: 'stone', bevel: 0.05 });
      });

      b.part('Ivy');
      b.unit(function () {
        var t = TOWERS[1], a = Math.PI * 0.62, nx = Math.cos(a), nz = Math.sin(a), px = t.x + nx * (TRO + 0.05), pz = t.z + nz * (TRO + 0.05);
        b.ivy([[px, 0.5, pz], [px + 0.15, 2.4, pz + 0.05], [px - 0.1, 3.6, pz], [px + 0.05, 4.9, pz]], [nx, 0, nz], { density: 7, spread: 0.6 });
        b.ivy([[-7.0, 0.5, WZ + WT / 2 + 0.02], [-6.8, 2.0, WZ + WT / 2 + 0.02], [-6.6, 3.2, WZ + WT / 2 + 0.02]], [0, 0, 1], { density: 6, spread: 0.5 });
        b.bush(-6.2, WZ + WT / 2 + 0.6, 0.55, { flowers: '#f3f1ec', n: 2 });
        b.bush(3.9, GZ1 + 0.6, 0.5, { n: 2 });
      });

      b.life(function () {
        // a sentry on each tower's ledge, looking out over the country
        TOWERS.forEach(function (t, ti) {
          if (t.key === 'fr') return;
          var a = t.la + 0.35, d = t.dr + 1.1;
          b.figure(t.x + Math.cos(a) * d, t.z + Math.sin(a) * d, { role: ti === 2 ? 'archer' : 'soldier', pose: ti === 2 ? 'stand' : 'spear', ry: Math.atan2(Math.cos(a), Math.sin(a)), y: t.dy });
        });
        // people: gate guards, a knight pointing up at the high tower, a carrier, a soldier telling a child of the
        // wars, a villager on the path, an archer and a spearman on the wall walk and the captain on the high tower
        var sx = 2.0, sz = 16.6;
        b.figure(sx, sz, { role: 'soldier', pose: 'talk', ry: Math.atan2(4.7 - sx, 18.1 - sz), y: gh(sx, sz) });
        b.figure(-2.05, 10.75, { role: 'soldier', pose: 'spear', ry: 0.12 });
        b.figure(2.05, 10.75, { role: 'soldier', pose: 'guard', ry: -0.12 });
        b.figure(-1.9, 13.0, { role: 'knight', pose: 'point', ry: -2.7, y: gh(-1.9, 13.0) });
        b.figure(-0.4, 14.6, { role: 'villager', pose: 'carry', ry: Math.PI - 0.15, y: gh(-0.4, 14.6) });
        b.figure(4.7, 18.1, { role: 'child', pose: 'cheer', ry: Math.atan2(sx - 4.7, sz - 18.1), y: gh(4.7, 18.1) });
        b.figure(-1.7, 18.3, { role: 'villager', pose: 'talk', ry: 2.2, y: gh(-1.7, 18.3), c: '#5c5e62' });
        b.figure(-4.7, WZ - 0.25, { role: 'archer', pose: 'draw', ry: 0.2, y: WALK + 0.1 });
        b.figure(6.3, WZ - 0.25, { role: 'soldier', pose: 'spear', ry: -0.2, y: WALK + 0.1 });
        var fr = TOWERS[0];
        b.figure(fr.x + Math.cos(0.45) * 3.7, fr.z + Math.sin(0.45) * 3.7, { role: 'villager', pose: 'talk', ry: -0.9, y: fr.dy, c: '#3b3a38' });
      });
      b.pop();
    }
  });
})();
