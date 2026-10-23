// Signal beacon: a tall round pillar of stone with steps cut into it spiralling up, a corbelled platform and an iron
// fire basket on top, lit to call the riders home. A timber hoist lifts the firewood; a woodstore with a carved
// dragon-head roof keeps it dry; a great horn rests on a forked post. Built footings first, the pillar course by
// course with its steps, the platform, the basket, then the woodstore, the horn and the people. The fire is lit last.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL;
  PAL.beacon_shingle = ['#2f2b27', '#35302b', '#29251f', '#3b352f', '#2c2824'];
  PAL.beacon_plank = ['#5b4a3c', '#544437', '#634f3f', '#4d3f33', '#5f5042'];
  function V(x, y, z) { return new T.Vector3(x, y, z); }

  // a carved dragon-head finial in the XY plane, snout toward local +x, neck foot at (x, y, z), turned by ry, s tall
  var HEAD = [[-0.1, 0], [0.1, 0], [0.12, 0.2], [0.17, 0.42], [0.26, 0.58], [0.42, 0.63], [0.62, 0.64], [0.8, 0.66], [0.78, 0.71], [0.6, 0.72], [0.46, 0.76], [0.62, 0.8], [0.84, 0.83], [0.87, 0.89], [0.8, 0.92], [0.62, 0.94], [0.5, 0.98], [0.42, 1.04], [0.2, 1.3], [0.29, 1.04], [0.15, 1.13], [0.16, 0.98], [0.06, 0.93], [-0.01, 0.95], [-0.02, 0.85], [-0.09, 0.82], [-0.06, 0.71], [-0.13, 0.64], [-0.1, 0.53], [-0.16, 0.44], [-0.12, 0.33], [-0.13, 0.15]];
  function dragonHead(b, x, y, z, ry, s, o) {
    o = o || {};
    b.push(x, y, z, ry);
    b.extrude(0, 0, 0, HEAD.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.13 * s, { c: o.c || 'woodDark', m: M.wood, bevel: 0.012 * s });
    // a carved collar, the eyes, and a curl of mane down the neck
    b.box(0.02 * s, 0.3 * s, 0, 0.3 * s, 0.06 * s, 0.17 * s, { c: o.c || 'woodDark', m: M.wood, bevel: 0.01 * s, rz: 0.15 });
    [-1, 1].forEach(function (sd) { b.ball(0.53 * s, 0.89 * s, sd * 0.075 * s, 0.03 * s, { c: '#e9e4da', m: M.paint, detail: 0, ao: 0 }); });
    // teeth in the open jaw
    [0.56, 0.66, 0.76].forEach(function (tx) { b.extrude(tx * s, 0.72 * s, 0, [[-0.025 * s, 0], [0.025 * s, 0], [0, 0.06 * s]], 0.05 * s, { c: '#e9e4da', m: M.paint, ao: 0 }); });
    b.pop();
  }
  // a round Norse shield facing local +z: a painted field, a pattern in the other colour, an iron rim and boss
  function vShield(b, x, y, z, ry, r, kind, fc, pc, tilt) {
    b.push(x, y, z, ry);
    if (tilt) b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(tilt));
    b.cyl(0, 0, 0, r, 0.05, { rx: Math.PI / 2, c: fc, m: M.paint, seg: 24, flat: true });
    var arc = function (a0, a1, rr) { var p = [[0, 0]]; for (var i = 0; i <= 10; i++) { var a = a0 + (a1 - a0) * i / 10; p.push([Math.cos(a) * rr, Math.sin(a) * rr]); } return p; };
    var rr = r * 0.95;
    if (kind === 'half') b.extrude(0, 0, 0.056, arc(0, Math.PI, rr), 0.008, { c: pc, m: M.paint });
    else if (kind === 'quarter') { b.extrude(0, 0, 0.056, arc(0, Math.PI / 2, rr), 0.008, { c: pc, m: M.paint }); b.extrude(0, 0, 0.056, arc(Math.PI, Math.PI * 1.5, rr), 0.008, { c: pc, m: M.paint }); }
    else if (kind === 'cross') { b.box(0, -rr, 0.052, r * 0.24, rr * 2, 0.008, { c: pc, m: M.paint, bevel: 0 }); b.box(0, -r * 0.12, 0.052, rr * 2, r * 0.24, 0.008, { c: pc, m: M.paint, bevel: 0 }); }
    else if (kind === 'ring') { var o2 = [], i2; for (i2 = 0; i2 <= 24; i2++) { var a2 = i2 / 24 * Math.PI * 2; o2.push([Math.cos(a2) * rr * 0.82, Math.sin(a2) * rr * 0.82]); } var hole = o2.map(function (p) { return [p[0] * 0.72, p[1] * 0.72]; }).reverse(); b.extrude(0, 0, 0.056, o2, 0.008, { c: pc, m: M.paint, holes: [hole] }); }
    b.addGeo(new T.TorusGeometry(r, 0.024, 4, 28), { z: 0.03, c: 'iron', m: M.metal, ao: 0 });
    b.ball(0, 0, 0.065, r * 0.21, { c: 'iron', m: M.metal, sz: 0.6, detail: 1 });
    b.pop();
  }
  // a square stave post with carved collars and a cap
  function stave(b, x, y, z, h, w, o) {
    o = o || {}; var c = o.c || 'beam';
    b.post(x, y, z, w / 2, h, { c: c, ry: o.ry || 0 });
    [0.14, h - 0.42, h - 0.24].forEach(function (yy) { b.box(x, y + yy, z, w * 1.3, 0.07, w * 1.3, { c: c, m: M.wood, bevel: 0.015, ry: o.ry || 0 }); });
    if (o.cap !== false) b.box(x, y + h, z, w * 1.4, 0.12, w * 1.4, { c: c, m: M.wood, taper: 0.55, ry: o.ry || 0 });
  }
  // a split log lying along z from z0, its sawn end showing pale toward +z
  function logZ(b, x, y, z0, r, len, c) {
    b.cyl(x, y, z0, r, len, { rx: Math.PI / 2, c: c || 'wood', m: M.wood, seg: 7, flat: true, ry: b.j(0.4) });
    b.cyl(x, y, z0 + len, r * 0.9, 0.012, { rx: Math.PI / 2, c: b.pick(['#b9a27f', '#c4ad89', '#ab9471']), m: M.wood, seg: 7, ao: 0 });
  }
  // a curved stone between radii ri and ro, angles a0..a1 (0 = +x, PI/2 = +z), h tall, base at y = 0
  function arcStoneGeo(ri, ro, a0, a1, h, bev) {
    var n = Math.max(2, Math.ceil((a1 - a0) / 0.14)), sh = new T.Shape(), i, a;
    for (i = 0; i <= n; i++) { a = a0 + (a1 - a0) * i / n; if (i === 0) sh.moveTo(Math.cos(a) * ro, -Math.sin(a) * ro); else sh.lineTo(Math.cos(a) * ro, -Math.sin(a) * ro); }
    for (i = n; i >= 0; i--) { a = a0 + (a1 - a0) * i / n; sh.lineTo(Math.cos(a) * ri, -Math.sin(a) * ri); }
    bev = Math.min(bev, h * 0.3);
    var g = new T.ExtrudeGeometry(sh, { depth: Math.max(0.01, h - 2 * bev), bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelOffset: -bev, bevelSegments: 1, steps: 1, curveSegments: 1 });
    g.rotateX(-Math.PI / 2); g.translate(0, bev, 0); g.deleteAttribute('uv');
    return KIT.geo.flat(g);
  }
  // one course of a round wall, its stones of uneven length so the joints never line up
  function ringCourse(b, cx, cz, r, y, h, thick, o) {
    o = o || {}; var len = o.len || 0.75, a = b.r() * Math.PI * 2, end = a + Math.PI * 2, cuts = [a];
    while (a < end - 0.01) { a += len * (0.6 + b.r() * 0.75) / r; if (end - a < len * 0.4 / r) a = end; cuts.push(Math.min(a, end)); }
    if (o.core !== false) b.cyl(cx, y, cz, r - thick * 0.45, h, { c: '#8a7e6c', m: M.stone, seg: Math.max(12, cuts.length * 2), ao: 0.1, jit: 0.01 });
    for (var i = 0; i < cuts.length - 1; i++) {
      var a0 = cuts[i], a1 = cuts[i + 1], am = (a0 + a1) / 2;
      if (o.hole && o.hole(((am % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), y + h / 2)) continue;
      var gap = 0.045 / r, hh = h * (0.88 + b.j(0.05)), ro = r + thick / 2 + b.j(0.025), ri = r - thick / 2;
      b.addGeo(arcStoneGeo(ri, ro, a0 + gap, a1 - gap, hh, Math.min(0.065, hh * 0.18)), { x: cx, y: y + (h - hh) / 2, z: cz, c: b.stoneC(o.pal || 'stone', y), m: M.stone, ao: 0.18, jit: 0.04 });
    }
  }
  // figure-space point -> build space, for a figure at (fx, fz) turned by ry
  function fwd(fx, fz, ry, lx, ly, lz) { var c = Math.cos(ry), s = Math.sin(ry); return [fx + lx * c + lz * s, ly, fz - lx * s + lz * c]; }

  // the horn-blower: both hands up at the mouth holding the horn, chest out, head tipped back
  KIT.people.poses.beacon_horn = function (r) { return { feet: [V(-0.17, 0.09, 0.1), V(0.15, 0.09, -0.12)], hands: [V(-0.05, 1.56, 0.31), V(0.05, 1.66, 0.57)], lean: -0.06, twist: 0, side: 0, hip: 0.02, drop: 0.02, head: [0, -0.22], pole: [V(-0.9, -0.4, -0.2), V(0.9, -0.5, -0.1)] }; };
  // the woodcutter at the top of his swing, both hands on the haft over his head
  KIT.people.poses.beacon_chop = function (r) { return { feet: [V(-0.2, 0.09, 0.12), V(0.19, 0.09, -0.08)], hands: [V(-0.04, 1.86, 0.04), V(0.04, 1.74, 0.1)], lean: -0.07, twist: 0.05, side: 0, hip: 0, drop: 0.05, head: [0, 0.32], pole: [V(-0.8, 0.2, 0.3), V(0.8, 0.1, 0.3)] }; };

  KIT.defineBuild('beacon', {
    name: 'Signal beacon', size: 'small', need: 12,
    line: 'A stone pillar with steps cut into it and an iron fire basket on top, lit at dusk to call the riders home.',
    r: 8, flat: [11.5, 9], ground: 'grass', path: [[1.0, 8.6], [0.9, 3.0]],
    frameY: 3.3, frameR: 8.5, glowAt: [0.6, 9.6, -1.2],
    trees: [{ x: -5.8, z: -4.6, kind: 'pine', h: 7.2 }, { x: 6.6, z: 0.6, kind: 'birch', h: 5.4 }, { x: -2.4, z: -6.2, kind: 'pine', h: 5.2 }],
    bushes: [{ x: 5.6, z: 3.6, r: 0.75, flowers: '#f3f1ec' }, { x: -5.3, z: 5.3, r: 0.65 }, { x: 5.4, z: -3.4, r: 0.6 }],
    perches: [{ x: 0.11, y: 7.5, z: -2.7, ry: -2.83 }, { x: 2.83, y: 9.32, z: -0.63, ry: 1.32 }, { x: -3.8, y: 3.5, z: -1.9, ry: 1.57 }],
    build: function (b) {
      var cx = 0.6, cz = -1.2, y0 = 0.6, H = 6.3, R0 = 1.2, TH = 0.6, TAPER = 0.2, NC = 14;
      // courses of uneven height, as the quarry gave them
      var CH = [], sum = 0; for (var q = 0; q < NC; q++) { var hq = q % 2 ? 0.36 + b.r() * 0.08 : 0.46 + b.r() * 0.08; CH.push(hq); sum += hq; }
      CH = CH.map(function (v) { return v * H / sum; });
      var CY = [y0]; for (q = 1; q <= NC; q++) CY.push(CY[q - 1] + CH[q - 1]);
      var rr = function (y) { return R0 * (1 - TAPER * (y - y0) / H); };
      var top = y0 + H, deck = top + 0.3;
      // the steps: 19 of them, a turn and a bit, starting at the front-right and arriving at the front-left
      var NS = 19, A0 = 1.0, DA = (8.28 - A0) / (NS - 1), steps = [];
      for (var k = 0; k < NS; k++) steps.push({ a: A0 + k * DA, y: 0.9 + 0.3 * k });
      var lastA = steps[NS - 1].a % (Math.PI * 2);
      var angD = function (a, b2) { return Math.abs(((a - b2) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI); };
      var jibA = 0.25;

      b.part('Footings');
      b.unit(function () { ringCourse(b, cx, cz, 2.95, -0.1, 0.16, 0.95, { pal: 'stoneCool', core: false, len: 0.9, hole: function () { return b.r() < 0.14; } }); ringCourse(b, cx, cz, 3.75, -0.1, 0.15, 0.6, { pal: 'stoneCool', core: false, len: 0.8, hole: function (a) { return b.r() < 0.45 || Math.abs(a - 1.62) < 0.25; } }); });
      b.unit(function () { ringCourse(b, cx, cz, 2.05, -0.12, 0.38, 0.9, { pal: 'stoneDark', len: 0.95 }); });
      b.unit(function () { ringCourse(b, cx, cz, 1.7, 0.26, 0.34, 0.8, { pal: 'stone', len: 0.85 }); });

      b.part('Pillar and steps');
      for (var c = 0; c < NC; c++) {
        (function (c) {
          var y = CY[c], ch = CH[c];
          b.unit(function () {
            ringCourse(b, cx, cz, rr(y + ch / 2), y, ch, TH, { pal: 'stone', len: 0.72 });
            steps.forEach(function (s) {
              var ci = 0; while (ci < NC - 1 && CY[ci + 1] <= s.y - 0.14) ci++;
              if (ci !== c) return;
              var r0 = rr(s.y), ri = r0 - 0.1, ro = r0 + TH / 2 + 0.85, rm = (ri + ro) / 2, ca = Math.cos(s.a), sa = Math.sin(s.a);
              b.box(cx + ca * rm, s.y - 0.24, cz + sa * rm, ro - ri, 0.24, 0.64, { ry: -s.a + b.j(0.03), c: b.stoneC('sandstone', s.y), m: M.stone, bevel: 0.045 });
              var rc = r0 + TH / 2 + 0.22;
              b.box(cx + ca * rc, s.y - 0.56, cz + sa * rc, 0.3, 0.32, 0.42, { ry: -s.a, c: b.stoneC('stone', s.y), m: M.stone, taper: 1.55, taperD: 1.0, bevel: 0.03 });
            });
          });
        })(c);
      }

      b.part('Platform');
      b.unit(function () {
        var n = 20, rc = rr(top) + TH / 2 + 0.12;
        for (var i = 0; i < n; i++) {
          var a = i / n * Math.PI * 2 + 0.08;
          if (angD(a, lastA) < 0.32 || angD(a, steps[NS - 2].a) < 0.3) continue;
          b.box(cx + Math.cos(a) * rc, top - 0.4, cz + Math.sin(a) * rc, 0.3, 0.4, 0.36, { ry: -a - Math.PI / 2, c: 'sandstone', m: M.stone, taper: 1.0, taperD: 1.6, bevel: 0.04 });
        }
      });
      b.unit(function () {
        ringCourse(b, cx, cz, 1.25, top, 0.3, 0.9, { pal: 'sandstone', len: 0.62 });
        // the deck paved over in wedges of flagstone
        var a = b.r() * 6.28; for (var i = 0; i < 6; i++) { var a1 = a + Math.PI * 2 / 6; b.addGeo(arcStoneGeo(0.05, 0.86, a + 0.03, a1 - 0.03, 0.09, 0.025), { x: cx, y: top + 0.25, z: cz, c: b.stoneC('stoneCool'), m: M.stone, ao: 0.1, jit: 0.04 }); a = a1; }
      });
      b.unit(function () {
        // a kerb round the deck, open where the ladder comes up and where the hoist stands
        ringCourse(b, cx, cz, 1.58, deck, 0.28, 0.24, { pal: 'stone', len: 0.5, core: false, hole: function (a) { return angD(a, lastA) < 0.28 || angD(a, jibA) < 0.2; } });
        var la = lastA + 0.02, lr = rr(steps[NS - 1].y) + TH / 2 + 0.6;
        b.ladder(cx + Math.cos(la) * lr, steps[NS - 1].y, cz + Math.sin(la) * lr, deck - steps[NS - 1].y + 0.45, { ry: -la - Math.PI / 2 + Math.PI, w: 0.46, lean: 0.55 });
      });

      b.part('Fire basket');
      b.unit(function () {
        b.cyl(cx, deck, cz, 0.1, 0.62, { c: 'iron', m: M.metal, seg: 8 });
        for (var i = 0; i < 4; i++) { var a = i / 4 * Math.PI * 2 + 0.4; b.beam([cx + Math.cos(a) * 0.62, deck, cz + Math.sin(a) * 0.62], [cx + Math.cos(a) * 0.1, deck + 0.58, cz + Math.sin(a) * 0.1], 0.04, { c: 'iron', m: M.metal }); b.box(cx + Math.cos(a) * 0.64, deck, cz + Math.sin(a) * 0.64, 0.16, 0.05, 0.16, { c: 'iron', m: M.metal, bevel: 0.015 }); }
        b.lathe(cx, deck + 0.6, cz, [[0.01, 0], [0.4, 0], [0.45, 0.07], [0.01, 0.07]], { c: 'iron', m: M.metal, seg: 16 });
      });
      var bb = deck + 0.66, bt = bb + 1.0;
      b.unit(function () {
        var n = 16;
        for (var i = 0; i < n; i++) {
          var a = i / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
          b.beam([cx + ca * 0.43, bb, cz + sa * 0.43], [cx + ca * 0.92, bt, cz + sa * 0.92], 0.028, { c: 'iron', m: M.metal });
          b.beam([cx + ca * 0.92, bt, cz + sa * 0.92], [cx + ca * 1.0, bt + (i % 2 ? 0.28 : 0.42), cz + sa * 1.0], 0.028, { c: 'iron', m: M.metal, r2: 0.008 });
          if (i % 2 === 0) b.ball(cx + ca * 1.0, bt + 0.44, cz + sa * 1.0, 0.04, { c: 'iron', m: M.metal, detail: 0 });
        }
        [[bb + 0.01, 0.44], [bb + 0.48, 0.67], [bt - 0.04, 0.925]].forEach(function (q) { b.cyl(cx, q[0], cz, q[1], 0.07, { c: 'iron', m: M.metal, seg: 20, open: true }); });
      });
      b.unit(function () {
        // firewood laid crosswise in the basket
        for (var i = 0; i < 10; i++) {
          var a = i * 1.17 + b.j(0.2), y = bb + 0.12 + (i / 10) * 0.75, L = 0.75 + (i / 10) * 0.7, ca = Math.cos(a), sa = Math.sin(a);
          b.beam([cx - ca * L / 2, y, cz - sa * L / 2], [cx + ca * L / 2, y + b.j(0.06), cz + sa * L / 2], 0.085, { c: b.pick(PAL.wood), m: M.wood, round: true, seg: 7 });
        }
      });

      b.part('Hoist');
      b.unit(function () {
        var ca = Math.cos(jibA), sa = Math.sin(jibA), pr = 1.5, ar = 3.0, py = deck + 2.0;
        var P = function (r, y) { return [cx + ca * r, y, cz + sa * r]; };
        b.post(cx + ca * pr, deck, cz + sa * pr, 0.1, 2.12, { c: 'beam', ry: -jibA });
        b.beam(P(pr - 0.1, py), P(ar + 0.05, py), 0.09, { c: 'beam' });
        // the arm ends in a carved dragon's head, the pulley hung under its jaw
        dragonHead(b, cx + ca * (ar - 0.05), py - 0.05, cz + sa * (ar - 0.05), -jibA, 0.62);
        b.beam(P(pr, deck + 1.1), P(pr + 1.0, py), 0.06, { c: 'beam' });
        b.box(cx + ca * pr, py + 0.12, cz + sa * pr, 0.28, 0.1, 0.28, { c: 'beam', m: M.wood, taper: 0.6 });
        b.push(cx + ca * (ar - 0.12), py - 0.24, cz + sa * (ar - 0.12), -jibA);
        b.addGeo(new T.TorusGeometry(0.16, 0.035, 5, 14), { c: 'wood', m: M.wood });
        b.box(-0.04, -0.05, -0.08, 0.08, 0.3, 0.03, { c: 'iron', m: M.metal, bevel: 0.005 }); b.box(-0.04, -0.05, 0.05, 0.08, 0.3, 0.03, { c: 'iron', m: M.metal, bevel: 0.005 });
        b.pop();
        // the rope down to a sling of logs waiting on the ground, and its tail made fast to a cleat
        var gx = cx + ca * (ar - 0.01), gz = cz + sa * (ar - 0.01);
        b.beam([gx, py - 0.25, gz], [gx, 0.75, gz], 0.014, { c: 'rope', m: M.rope, round: true, seg: 4 });
        for (var i = 0; i < 5; i++) { var oy = i < 3 ? 0.12 : 0.32, oz = i < 3 ? (i - 1) * 0.22 : (i - 3.5) * 0.22; b.beam([gx - 0.65, oy, gz + oz], [gx + 0.65, oy + b.j(0.03), gz + oz], 0.1, { c: b.pick(PAL.wood), m: M.wood, round: true, seg: 7, ry: -jibA }); }
        [-0.35, 0.35].forEach(function (d) { b.beam([gx + d, 0.0, gz - 0.35], [gx, 0.75, gz], 0.014, { c: 'rope', m: M.rope, round: true, seg: 4 }); b.beam([gx + d, 0.0, gz + 0.35], [gx, 0.75, gz], 0.014, { c: 'rope', m: M.rope, round: true, seg: 4 }); });
        b.beam(P(ar - 0.05, py - 0.3), P(pr + 0.12, deck + 0.9), 0.012, { c: 'rope', m: M.rope, round: true, seg: 4 });
        b.flag(cx + ca * pr, py + 0.2, cz + sa * pr, 0.95, 0.9, 0.32, { c: 'ember', pennant: true, ry: -0.5, pr: 0.03 });
      });

      b.part('Woodstore');
      var sx = -3.8, sz = -1.9, sw = 3.0, sd = 2.2, eave = 2.05, rise = 1.25;
      var wx0 = sx - sw / 2, wx1 = sx + sw / 2, wz0 = sz - sd / 2, wz1 = sz + sd / 2;
      b.unit(function () {
        [[wx0, wz0], [wx1, wz0], [wx0, wz1], [wx1, wz1]].forEach(function (p) { stave(b, p[0], 0, p[1], eave, 0.2, { cap: false }); });
        b.beam([wx0 - 0.1, eave - 0.1, wz1], [wx1 + 0.1, eave - 0.1, wz1], 0.1, { c: 'beam' });
        b.beam([wx0 - 0.1, eave - 0.1, wz0], [wx1 + 0.1, eave - 0.1, wz0], 0.1, { c: 'beam' });
        [wx0, wx1].forEach(function (x) { b.beam([x, eave - 0.1, wz0 - 0.1], [x, eave - 0.1, wz1 + 0.1], 0.1, { c: 'beam' }); });
        [-0.6, 0.55].forEach(function (dz) { b.box(sx, 0, sz + dz, sw - 0.3, 0.1, 0.14, { c: 'woodDark', m: M.wood }); });
      });
      b.unit(function () {
        b.planks(sx, 0.05, wz0 + 0.04, sw - 0.2, eave - 0.2, { vertical: true, c: 'beacon_plank', pw: 0.26, t: 0.06 });
        [wx0 + 0.04, wx1 - 0.04].forEach(function (x) { b.planks(x, 0.05, sz, sd - 0.2, eave - 0.2, { vertical: true, c: 'beacon_plank', pw: 0.26, t: 0.06, ry: Math.PI / 2 }); });
      });
      b.unit(function () {
        // the gable ends boarded in, plank by plank
        [wx0 + 0.04, wx1 - 0.04].forEach(function (x) {
          for (var t = -sd / 2 + 0.13; t < sd / 2; t += 0.26) { var hh = (rise - 0.2) * (1 - Math.abs(t) / (sd / 2 + 0.05)); if (hh < 0.08) continue; b.box(x, eave, sz + t, 0.06, hh, 0.24, { c: b.pick(PAL.beacon_plank), m: M.wood, bevel: 0.01 }); }
        });
      });
      b.unit(function () {
        b.gableRoof(sx, eave, sz, sw, sd, rise, { m: 'wood', c: 'beacon_shingle', over: 0.38, overX: 0.32, rows: 8, rowsAsUnits: false, ridge: false, pitch: 0.3 });
      });
      b.unit(function () {
        var L = sw + 0.64, sl = Math.atan2(rise, sd / 2), drop = 0.38 * Math.tan(sl);
        b.beam([sx - L / 2 - 0.05, eave + rise + 0.08, sz], [sx + L / 2 + 0.05, eave + rise + 0.08, sz], 0.12, { c: 'beam', round: true, seg: 8 });
        [-1, 1].forEach(function (e) {
          var x = sx + e * (L / 2 - 0.04);
          // crossed barge boards, their tops running past the ridge
          [-1, 1].forEach(function (s) { var z0 = sz + s * (sd / 2 + 0.38), y0b = eave - drop - 0.06; var dz = -s * (sd / 2 + 0.38), dy = rise + drop; b.beam([x, y0b, z0], [x, y0b + dy * 1.22, z0 + dz * 1.22], 0.07, { c: 'beam', r2: 0.05 }); });
          dragonHead(b, x + e * 0.02, eave + rise + 0.12, sz, e > 0 ? 0 : Math.PI, 0.95);
        });
      });
      b.unit(function () {
        // the woodpile, sawn ends to the front
        for (var row = 0; row < 3; row++) for (var i = 0; i < 12; i++) logZ(b, wx0 + 0.27 + i * 0.226 + (row % 2) * 0.1, 0.22 + row * 0.205, wz0 + 0.12, 0.11, sd - 0.25, b.pick(PAL.wood));
      });
      b.unit(function () {
        for (var row = 3; row < 6; row++) { var n = row === 5 ? 7 : 11; for (var i = 0; i < n; i++) logZ(b, wx0 + 0.3 + i * 0.226 + (row % 2) * 0.1 + (row === 5 ? 0.5 : 0), 0.22 + row * 0.205, wz0 + 0.12, 0.11, sd - 0.25 - b.r() * 0.1, b.pick(PAL.wood)); }
        vShield(b, wx0 - 0.02, 1.25, wz1 + 0.13, 0, 0.36, 'half', 'ink', 'bone');
        vShield(b, wx1 + 0.02, 1.25, wz1 + 0.13, 0, 0.36, 'quarter', 'bone', 'ink');
        vShield(b, wx0 - 0.13, 1.2, sz - 0.25, -Math.PI / 2, 0.36, 'ring', 'ink', 'bone');
      });

      b.part('Great horn');
      var hx = 2.7, hz = 2.35, hry = 0.72;
      var hp = function (t) { return fwd(hx, hz, hry, 0, 1.6 + 0.32 * t + 0.42 * t * t, 0.16 + 2.05 * t); };
      var hr = function (t) { return 0.028 + 0.2 * Math.pow(t, 2.3); };
      b.unit(function () {
        // the forked rest, a stave post, its feet in a ring of stones
        var tp = 0.6, q = hp(tp), qy = q[1] - hr(tp) - 0.02;
        stave(b, q[0], 0, q[2], qy - 0.2, 0.17, { cap: false, ry: -hry });
        [-1, 1].forEach(function (s) { var o = fwd(0, 0, hry, s * 0.15, 0, 0); b.beam([q[0], qy - 0.22, q[2]], [q[0] + o[0], qy + 0.14, q[2] + o[2]], 0.04, { c: 'beam' }); });
        for (var i = 0; i < 6; i++) { var a = i / 6 * 6.28; b.rock(q[0] + Math.cos(a) * 0.32, 0.0, q[2] + Math.sin(a) * 0.32, 0.16 + b.r() * 0.06); }
      });
      b.unit(function () {
        var N = 14;
        for (var i = 0; i < N; i++) { var t0 = i / N, t1 = (i + 1) / N; b.beam(hp(t0), hp(t1), hr(t0), { r2: hr(t1), round: true, seg: 12, c: i % 4 === 3 ? '#cfc4ae' : '#e6dccb', m: M.paint }); }
        [0.18, 0.45, 0.72].forEach(function (t) { var a = hp(t - 0.015), c2 = hp(t + 0.015); b.beam(a, c2, hr(t) + 0.018, { round: true, seg: 12, c: 'iron', m: M.metal }); });
        var e0 = hp(0.985), e1 = hp(1.0); b.beam(e0, e1, hr(1) + 0.03, { round: true, seg: 14, c: 'iron', m: M.metal, r2: hr(1) + 0.04 });
        var m0 = hp(0), mm = hp(-0.03); b.beam(mm, m0, 0.034, { round: true, seg: 8, c: 'iron', m: M.metal });
      });

      b.part('Chopping block and stores');
      b.unit(function () {
        var kx = -3.1, kz = 0.75;
        b.log(kx, 0, kz, 0.34, 0.52, { c: 'wood', seg: 9 });
        b.cyl(kx, 0.52, kz, 0.31, 0.01, { c: '#b9a27f', m: M.wood, seg: 9 });
        b.cyl(kx + 0.04, 0.53, kz, 0.14, 0.5, { c: 'wood', m: M.wood, seg: 7, flat: true });
        // split billets about the block
        for (var i = 0; i < 9; i++) { var a = i * 0.9 + 0.3, d = 0.6 + b.r() * 0.5; b.extrude(kx + Math.cos(a) * d, 0.09, kz + Math.sin(a) * d, [[0, 0], [0.16, 0], [0.08, 0.13]], 0.42, { c: b.pick(['#b9a27f', '#a48c6a', '#c4ad89']), m: M.wood, ry: a + b.j(0.5), rx: Math.PI / 2 * 0 }); }
        b.barrel(-1.9, 0, 1.75, { c: 'woodDark' }); b.barrel(-1.35, 0, 2.3, { c: 'woodDark', h: 0.8 }); b.bucket(-1.25, 0, 1.55);
        b.sack(-2.3, 0, 2.35, 0.5); b.ropeCoil(-0.9, 0, 2.6, 0.28);
      });
      b.unit(function () {
        // a sledge of logs hauled up from the woods, its runners curled at the nose
        b.push(-0.9, 0, 4.1, 0.35);
        [-0.42, 0.42].forEach(function (x) {
          b.box(x, 0, -0.1, 0.1, 0.12, 2.3, { c: 'woodDark', m: M.wood, bevel: 0.02 });
          b.beam([x, 0.06, 1.05], [x, 0.42, 1.38], 0.05, { c: 'woodDark', r2: 0.04 });
          [-0.85, 0, 0.85].forEach(function (z) { b.box(x, 0.12, z, 0.07, 0.2, 0.07, { c: 'woodDark', m: M.wood }); });
        });
        [-0.85, -0.3, 0.3, 0.85].forEach(function (z) { b.box(0, 0.3, z, 1.05, 0.06, 0.14, { c: 'wood', m: M.wood, bevel: 0.015 }); });
        for (var i = 0; i < 6; i++) { var row = i < 4 ? 0 : 1, xx = row ? (i - 4.5) * 0.24 : (i - 1.5) * 0.24; logZ(b, xx, 0.46 + row * 0.2, -1.05 + b.r() * 0.1, 0.12, 2.0, b.pick(PAL.wood)); }
        [-0.6, 0.55].forEach(function (z) { b.cyl(0, 0.53, z, 0.52, 0.04, { c: 'rope', m: M.rope, seg: 10, open: true, rz: Math.PI / 2, sx: 1, sy: 1 }); });
        b.ropeCoil(0.1, 0.64, 0.05, 0.22);
        b.pop();
        b.log(1.0, 0, 1.6 + 0.7, 0.3, 0.38, { c: 'wood', seg: 8 }); b.cyl(1.0, 0.38, 2.3, 0.27, 0.01, { c: '#b9a27f', m: M.wood, seg: 8 });
      });

      b.part('Firewood yard');
      // a bundle of brushwood (a faggot) lying along local x, tied twice with rope
      var faggot = function (x, y, z, ry, L) {
        b.push(x, y, z, ry);
        for (var i = 0; i < 9; i++) { var a = i * 2.4, rr2 = i ? 0.1 + (i % 3) * 0.03 : 0; b.beam([-L / 2 + b.j(0.08), Math.sin(a) * rr2, Math.cos(a) * rr2], [L / 2 + b.j(0.1), Math.sin(a) * rr2 * 1.2 + b.j(0.03), Math.cos(a) * rr2 * 1.2], 0.03, { c: b.pick(['#6b5a48', '#5e4f40', '#7a6650', '#544638']), m: M.wood, round: true, seg: 4 }); }
        [-L * 0.25, L * 0.25].forEach(function (bx) { b.cyl(bx, 0, 0, 0.17, 0.05, { rz: Math.PI / 2, c: 'rope', m: M.rope, seg: 8 }); });
        b.pop();
      };
      b.unit(function () {
        // the firewood cart, unhitched, its bed loaded with split logs
        b.cart(-3.3, 3.9, { ry: -1.75, load: function (bb) {
          for (var i = 0; i < 5; i++) logZ(bb, -0.48 + i * 0.24, 0.9, -0.95 + bb.r() * 0.1, 0.11, 1.85, bb.pick(PAL.wood));
          for (i = 0; i < 4; i++) logZ(bb, -0.36 + i * 0.24, 1.1, -0.9 + bb.r() * 0.1, 0.11, 1.7, bb.pick(PAL.wood));
          for (i = 0; i < 2; i++) logZ(bb, -0.12 + i * 0.24, 1.3, -0.7, 0.11, 1.3, bb.pick(PAL.wood));
        } });
        // brushwood bundles stacked to kindle the fire
        var fx = -5.0, fz = 1.9, fry = 0.35;
        [[-0.36, 0.17], [0.0, 0.17], [0.36, 0.17], [-0.18, 0.47], [0.18, 0.47], [0.0, 0.77]].forEach(function (q) { var o = fwd(fx, fz, fry, 0, 0, q[0]); faggot(o[0], q[1], o[2], fry, 1.3 + b.j(0.1)); });
        faggot(-4.1, 0.17, 2.75, 1.1, 1.2);
      });
      b.unit(function () {
        // a tar pot for the torches on a ring of stones, and a pair of spears with a shield left by the cart
        var tx = -1.9, tz = 5.6;
        for (var i = 0; i < 7; i++) { var a = i / 7 * 6.28; b.rock(tx + Math.cos(a) * 0.42, 0.0, tz + Math.sin(a) * 0.42, 0.13 + b.r() * 0.05); }
        b.lathe(tx, 0.12, tz, [[0.02, 0], [0.26, 0.03], [0.34, 0.2], [0.32, 0.42], [0.36, 0.46], [0.3, 0.46], [0.02, 0.4]], { c: 'iron', m: M.metal, seg: 14 });
        b.cyl(tx, 0.52, tz, 0.3, 0.02, { c: '#1f1e1c', m: M.dark, seg: 14 });
        b.beam([tx + 0.05, 0.5, tz], [tx + 0.55, 1.0, tz - 0.2], 0.02, { c: 'woodDark', round: true, seg: 5 });
        // two spears leant against the cart's side board
        b.spear(-2.55, 0, 5.0, 2.3, { rx: -0.36, rz: 0.06 }); b.spear(-2.8, 0, 4.98, 2.2, { rx: -0.37, rz: -0.08 });
        // grass and white flowers in the open turf
        var tufts = [[-4.6, 5.6], [-3.6, 6.1], [-2.6, 5.4], [-5.6, 3.6], [-6.0, 1.8], [-1.8, 6.5], [-3.0, 6.8], [0.2, 6.4], [2.6, 6.2], [3.4, 5.2], [4.6, 4.6], [-6.4, 0.4], [-4.4, 4.9], [-2.2, 4.8], [1.8, 6.9], [3.9, 3.8], [5.4, 2.2], [-5.0, 3.1], [-0.2, 5.4]];
        var gh = function (x, z) { return b.ground ? b.ground.height(x, z) : 0; };
        tufts.forEach(function (t) { var x = t[0] + b.j(0.2), z = t[1] + b.j(0.2); b.grass(x, gh(x, z), z, 0.3 + b.r() * 0.3); });
        [[-4.0, 5.8], [-2.4, 6.2], [3.0, 5.6], [-5.6, 2.6]].forEach(function (t) { b.flowers(t[0], gh(t[0], t[1]), t[1], 0.35, { n: 6, c: '#f3f1ec' }); });
        [[-3.4, 6.6, 0.22], [1.4, 5.9, 0.16], [4.4, 3.4, 0.2]].forEach(function (t) { b.rock(t[0], gh(t[0], t[1]), t[1], t[2]); });
      });

      b.part('Ivy');
      b.unit(function () {
        var a = 2.25, nx = Math.cos(a), nz = Math.sin(a), px = cx + nx * (rr(1) + 0.36), pz = cz + nz * (rr(1) + 0.36);
        b.ivy([[px, 0.5, pz], [px - 0.05, 1.6, pz + 0.05], [px + 0.1, 2.6, pz - 0.05], [px, 3.2, pz]], [nx, 0, nz], { density: 6, spread: 0.45 });
        b.ivy([[wx1 + 0.12, 0.1, wz1 + 0.12], [wx1 + 0.12, 1.2, wz1 + 0.12], [wx1 + 0.15, 1.9, wz1 + 0.1]], [0.7, 0, 0.7], { density: 5, spread: 0.3 });
        b.flowers(cx - 2.0, 0, cz + 2.6, 0.4, { n: 6 }); b.flowers(cx + 2.9, 0, cz + 1.4, 0.35, { n: 5 });
      });

      b.life(function () {
        // the beacon lit: coals, tongues of flame and a column of smoke
        var fy = bb + 0.72;
        b.embers(cx, fy - 0.05, cz, 0.7, { light: false });
        b.flame(cx, fy, cz, 1.65, { i: 2.6 });
        for (var i = 0; i < 5; i++) { var a = i * 1.26 + 0.5; b.flame(cx + Math.cos(a) * 0.45, fy - 0.1, cz + Math.sin(a) * 0.45, 0.8 + b.r() * 0.35, { light: false }); }

        var w = steps[16], wr = rr(w.y) + TH / 2 + 0.38;
        b.figure(cx + Math.cos(w.a) * wr, cz + Math.sin(w.a) * wr, { role: 'soldier', pose: 'spear', y: w.y, ry: Math.atan2(Math.cos(w.a), Math.sin(w.a)) - 0.5, team: 'ink' });
        b.figure(hx, hz, { role: 'villager', pose: 'beacon_horn', ry: hry, c: '#3b3a38', cape: 'ink', beard: true });
        var ax = -2.45, az = 0.78, ary = -Math.PI / 2 - 0.1;
        b.figure(ax, az, { role: 'villager', pose: 'beacon_chop', ry: ary, c: '#6f6a62' });
        // the axe in his hands: a long haft, its bearded head at the top of the swing, edge up and forward
        var h0 = fwd(ax, az, ary, 0, 1.6, 0.21), h1 = fwd(ax, az, ary, 0, 2.38, -0.33);
        b.beam(h0, h1, 0.024, { c: 'woodLight', round: true, seg: 6 });
        b.push(h1[0], h1[1], h1[2], ary);
        b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeBasis(V(0, 0.57, 0.82), V(0, 0.82, -0.57), V(-1, 0, 0)));
        b.extrude(0, -0.08, 0, [[-0.05, -0.06], [0.06, -0.07], [0.2, -0.17], [0.25, -0.04], [0.25, 0.1], [0.21, 0.15], [0.06, 0.06], [-0.05, 0.05]], 0.035, { c: 'iron', m: M.metal, bevel: 0.006 });
        b.pop();
        b.figure(-1.75, 1.05, { role: 'villager', pose: 'carry', ry: 0.75, c: '#5c5e62' });
        b.figure(1.9, 4.6, { role: 'child', pose: 'run', ry: -2.5 });
        // a carrier bringing brushwood from the cart, and a rider-watch pointing out the flight coming home
        b.figure(-3.55, 2.65, { role: 'villager', pose: 'carry', ry: 1.15, c: '#3b3a38' });
        faggot(-3.45, 1.62, 2.7, 1.15 + Math.PI / 2, 1.0);
        b.figure(0.55, 5.1, { role: 'soldier', pose: 'point', ry: 2.7, team: 'bone' });
      });
    }
  });
})();
