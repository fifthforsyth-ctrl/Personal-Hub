// Watchtower: a stone base, a tapering log tower clad and braced stage by stage, a wide top deck with a tongue
// jutting out at the front, a watch cabin under a shingled gable with carved dragon-head barge boards, and the great horn.
// Built footings first, the stone course by course, the frame stage by stage, the deck plank by plank, the roof row
// by row, then the horn, the ladders, the shields and stores, and last the people.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL;
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  PAL.watchtowerShingle = ['#3e3a35', '#36332f', '#45403a', '#3a3632', '#312e2b'];

  // the watchman blowing the horn: both hands up on the horn, head back
  KIT.people.poses.watchtowerHorn = function () { return { feet: [V(-0.15, 0.09, 0.06), V(0.15, 0.09, -0.1)], hands: [V(-0.07, 1.56, 0.34), V(0.05, 1.6, 0.47)], lean: -0.05, twist: 0, side: 0, hip: 0, drop: 0, head: [0, -0.16], pole: [V(-1, -0.4, -0.2), V(1, -0.4, -0.2)] }; };
  // climbing a ladder that stands in front (+z): one foot a rung up, hands high on the rails
  KIT.people.poses.watchtowerClimb = function () { return { feet: [V(-0.13, 0.42, 0.2), V(0.13, 0.09, 0.14)], hands: [V(-0.25, 1.78, 0.4), V(0.25, 1.5, 0.37)], lean: 0.12, twist: 0, side: 0, hip: 0, drop: 0.0, head: [0, -0.3], pole: [V(-1, -0.5, -0.3), V(1, -0.5, -0.3)] }; };

  // a carpenter's mallet raised over a plank on the trestle in front
  KIT.people.poses.watchtowerMallet = function () { return { feet: [V(-0.2, 0.09, 0.1), V(0.16, 0.09, -0.12)], hands: [V(0.2, 1.62, 0.22), V(-0.2, 0.86, 0.42)], lean: 0.2, twist: 0.1, side: 0, hip: 0, drop: 0.05, head: [0, 0.4], pole: [V(1, 0.2, -0.4), V(-0.6, -0.6, 0)] }; };

  // a rack of fish hung to dry for the watch: two A-frames and a ridge pole, fish hung in pairs
  function fishRack(b, x, z, ry, L) {
    var y0 = (b.ground ? b.ground.height(x, z) : 0) - 0.06, hp = 1.72;
    b.push(x, y0, z, ry);
    [-1, 1].forEach(function (s) { [-1, 1].forEach(function (e) { b.beam([s * L / 2, 0, e * 0.5], [s * L / 2, hp + 0.12, -e * 0.04], 0.04, { c: 'woodDark' }); }); });
    b.beam([-L / 2 - 0.2, hp, 0], [L / 2 + 0.2, hp + 0.02, 0], 0.045, { c: 'wood', round: true, seg: 8 });
    b.beam([-L / 2, 0.55, 0.36], [L / 2, 0.55, 0.36], 0.025, { c: 'wood' });
    var n = Math.round(L / 0.16);
    for (var i = 0; i < n; i++) {
      var t = -L / 2 + 0.12 + i * (L - 0.24) / (n - 1);
      [-1, 1].forEach(function (sd) {
        if (b.chance(0.12)) return;
        var len = 0.34 + b.r() * 0.12, zz = sd * 0.07, top = hp - 0.05, col = b.pick(['#9aa3a6', '#b8bfc0', '#7f898d', '#a9b0ae']);
        b.beam([t, hp, 0], [t + b.j(0.02), top - 0.08, zz], 0.006, { c: 'rope', m: M.rope, round: true, seg: 4, bevel: 0 });
        b.ball(t, top - 0.1 - len / 2, zz, len / 2, { sx: 0.26, sz: 0.11, c: col, m: M.metal, detail: 1, ao: 0.1, jit: 0.02 });
        b.extrude(t, top - 0.08 - len - 0.02, zz, [[-0.07, -0.08], [0, 0.03], [0.07, -0.08], [0, -0.04]], 0.012, { c: '#5f686b', m: M.metal, bevel: 0 });
      });
    }
    b.pop();
  }
  // a sheep, white fleece and a black face, facing local +z
  function sheep(b, x, z, ry, s) {
    s = s || 1; var y0 = (b.ground ? b.ground.height(x, z) : 0) - 0.03;
    b.push(x, y0, z, ry);
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (c) { b.beam([c[0] * 0.1 * s, 0, c[1] * 0.2 * s], [c[0] * 0.1 * s, 0.3 * s, c[1] * 0.18 * s], 0.025 * s, { c: '#1f1e1c', m: M.cloth }); });
    b.ball(0, 0.42 * s, 0, 0.24 * s, { sx: 0.95, sy: 0.85, sz: 1.3, c: '#efebe4', m: M.cloth, detail: 2, smooth: true, ao: 0.35 });
    for (var i = 0; i < 6; i++) { var a = i * 1.05; b.ball(Math.cos(a) * 0.12 * s, (0.56 + (i % 2) * 0.03) * s, Math.sin(a) * 0.2 * s, 0.11 * s, { c: '#f3f1ec', m: M.cloth, detail: 1, smooth: true, ao: 0.2 }); }
    b.ball(0, 0.5 * s, 0.34 * s, 0.085 * s, { sz: 1.45, rx: 0.5, c: '#1f1e1c', m: M.cloth, detail: 1, smooth: true });
    [-1, 1].forEach(function (sd) { b.box(sd * 0.09 * s, 0.53 * s, 0.3 * s, 0.1 * s, 0.03 * s, 0.05 * s, { c: '#1f1e1c', m: M.cloth, bevel: 0, rz: sd * 0.4 }); });
    b.pop();
  }
  // a sawhorse: a squared top bar on four splayed legs
  function sawhorse(b, x, y, z, ry, L) {
    b.push(x, y, z, ry);
    b.box(0, 0.62, 0, L, 0.1, 0.12, { c: 'woodLight', m: M.wood, bevel: 0.02 });
    [-1, 1].forEach(function (s) { [-1, 1].forEach(function (e) { b.beam([s * (L / 2 - 0.12), 0.64, 0], [s * (L / 2 - 0.04), 0, e * 0.3], 0.03, { c: 'wood' }); }); });
    b.pop();
  }

  // a carved dragon head: the neck rises from the origin, the snout points along +x, carved spines down the nape
  var HEAD = [[0, 0], [0.2, 0], [0.24, 0.16], [0.32, 0.36], [0.44, 0.52], [0.6, 0.57], [0.8, 0.6], [0.73, 0.64], [0.62, 0.665], [0.8, 0.72], [0.93, 0.76], [0.91, 0.84], [0.75, 0.87], [0.58, 0.9], [0.5, 0.97], [0.29, 1.12], [0.38, 0.92], [0.28, 0.86], [0.19, 0.93], [0.2, 0.76], [0.09, 0.71], [0.14, 0.57], [0.02, 0.47], [0.07, 0.35], [-0.03, 0.23], [0.03, 0.12]];
  function dragonHead(b, x, y, z, s, ry, o) {
    o = o || {};
    b.push(x, y, z, ry || 0);
    if (o.rz) b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(o.rz));
    b.extrude(0, 0, 0, HEAD.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.12 * s, { c: o.c || 'woodDark', m: M.wood, bevel: 0.012 * s });
    [-1, 1].forEach(function (sd) {
      b.ball(0.6 * s, 0.8 * s, sd * 0.075 * s, 0.04 * s, { c: '#efebe4', m: M.paint, detail: 1, ao: 0, jit: 0 });
      // a ridge of carving along the jaw
      b.box(0.62 * s, 0.68 * s, sd * 0.07 * s, 0.28 * s, 0.03 * s, 0.02 * s, { c: '#1f1e1c', m: M.wood, bevel: 0, ao: 0, rz: 0.15 });
    });
    b.pop();
  }
  // planks laid side by side, each its own board: along 'z' (boards run along z, side by side across x) or 'x'
  function deck(b, run, a0, a1, c0, c1, y, o) {
    o = o || {}; var pw = o.pw || 0.25, n = Math.max(1, Math.round((a1 - a0) / pw)), w = (a1 - a0) / n, t = o.t || 0.08;
    for (var i = 0; i < n; i++) {
      var ac = a0 + (i + 0.5) * w, segs = [[c0, c1]];
      if (o.hole && ac > o.hole[0] && ac < o.hole[1]) segs = [[c0, o.hole[2]], [o.hole[3], c1]];
      segs.forEach(function (s) {
        var L = s[1] - s[0]; if (L < 0.12) return;
        var cm = (s[0] + s[1]) / 2 + b.j(0.025), col = b.chance(0.3) ? 'wood' : (o.c || 'woodLight'), dy = b.j(0.008);
        if (run === 'z') b.box(ac, y - t + dy, cm, w - 0.03, t, L + b.j(0.03), { c: col, m: M.wood, bevel: 0.014, ry: b.j(0.01) });
        else b.box(cm, y - t + dy, ac, L + b.j(0.03), t, w - 0.03, { c: col, m: M.wood, bevel: 0.014, ry: b.j(0.01) });
      });
    }
  }
  // a rail: posts every ~1 m, a top and a mid rail, from p to q at deck height y
  function rail(b, p, q, y, o) {
    o = o || {}; var h = o.h || 1.0, L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.round(L / 1.05));
    for (var i = 0; i <= n; i++) { var t = i / n; b.post(p[0] + (q[0] - p[0]) * t, y, p[1] + (q[1] - p[1]) * t, 0.065, h + 0.08, { c: 'woodDark' }); }
    b.beam([p[0], y + h, p[1]], [q[0], y + h, q[1]], 0.06, { c: 'wood', r2: 0.07 });
    b.beam([p[0], y + h * 0.5, p[1]], [q[0], y + h * 0.5, q[1]], 0.04, { c: 'wood' });
  }
  // a round shield, its face toward the direction ry turns +z to, with a painted cross band now and then
  function shield(b, x, y, z, ry, c, band) {
    b.shield(x, y, z, { kind: 'round', c: c, s: 0.78, ry: ry, emblem: 'none' });
    if (band) { b.push(x, y, z, ry); b.box(0, -0.31, 0.058, 0.09, 0.62, 0.016, { c: band, m: M.paint, bevel: 0, ao: 0, jit: 0 }); b.box(0, -0.045, 0.058, 0.62, 0.09, 0.016, { c: band, m: M.paint, bevel: 0, ao: 0, jit: 0 }); b.pop(); }
  }

  // the carved head drawn flat on both faces of a cloth, as a crest
  function headEmblem(b, x, y, z, s, c) {
    var pts = HEAD.map(function (p) { return [(p[0] - 0.45) * s, (p[1] - 0.56) * s]; });
    [0.014, -0.014].forEach(function (dz) { b.addGeo(KIT.geo.extrude(pts, 0.006), { x: x, y: y, z: z + dz, c: c, m: M.cloth, bucket: 'cloth', ao: 0, jit: 0.01, vary: 0.02 }); });
  }

  KIT.defineBuild('watchtower', {
    name: 'Watchtower', size: 'small', need: 18,
    line: 'A log watchtower on a stone base with ladders, a shingled watch cabin, the great horn, a wide deck jutting out at the top, fish drying on a rack and a sheep fold at its foot.',
    r: 9.5, flat: [7.4, 7.4], ground: 'grass', path: [[3.2, 9.8], [0.5, 2.6]],
    frameY: 4.4, frameR: 11.2, glowAt: [0.6, 12.6, 0.8],
    trees: [{ x: -6.4, z: -5.2, kind: 'pine', h: 6.8 }, { x: 6.9, z: -3.6, kind: 'pine', h: 6.2 }, { x: -7.3, z: -0.6, kind: 'birch', h: 5.2 }],
    bushes: [{ x: 6.4, z: 3.4, r: 0.8, flowers: '#f3f1ec' }, { x: -5.0, z: 5.8, r: 0.75 }, { x: 4.4, z: -6.0, r: 0.7 }],
    build: function (b) {
      var W = 4.0, Tk = 0.55, base = 0.45, H1 = 2.4, top1 = base + H1, fl = top1 + 0.12;
      var x0 = -W / 2, x1 = W / 2, z0 = -W / 2, z1 = W / 2;
      var yD = 8.6, yR = 8.32; // the top deck's surface, and the top ring beam that carries it
      function pp(y) { return 1.6 - 0.15 * Math.min(1, Math.max(0, (y - fl) / (yR - fl))); }
      function corner(sx, sz, y) { var p = pp(y); return [sx * p, y, sz * p]; }
      var faces = [[[-1, 1], [1, 1]], [[1, 1], [1, -1]], [[1, -1], [-1, -1]], [[-1, -1], [-1, 1]]]; // front, right, back, left

      b.part('Footings');
      b.unit(function () { b.box(0, -0.08, 0, W + 1.0, 0.36, W + 1.0, { c: 'stoneDark', bevel: 0.08 }); });
      b.unit(function () { b.box(0, 0.28, 0, W + 0.55, 0.2, W + 0.55, { c: 'stone', bevel: 0.07 }); });

      b.part('Stone base');
      b.stoneBox(0, 0, W, W, base, H1, Tk, {
        pal: 'stone', course: 0.34, len: 0.62,
        holes: [{ side: 'front', at: 0, w: 1.4, y1: base + 2.15 }, { side: 'left', at: -0.55, w: 0.3, y0: base + 0.9, y1: base + 1.75 }, { side: 'right', at: 0.4, w: 0.3, y0: base + 0.9, y1: base + 1.75 }]
      });
      b.unit(function () {
        b.archDoor(0, base, z1, 1.1, 2.0, { depth: Tk + 0.15, keyC: 'sandstone', frameStone: 'sandstone', doorC: 'woodDark' });
        b.box(x0 - 0.01, base + 0.9, -0.55, 0.2, 0.85, 0.16, { c: '#1c1b1a', m: M.dark, bevel: 0, ao: 0 });
        b.box(x1 + 0.01, base + 0.9, -0.4, 0.2, 0.85, 0.16, { c: '#1c1b1a', m: M.dark, bevel: 0, ao: 0 });
        // a coping course of big dressed stones, the front and back running corner to corner
        var cE = W / 2 + 0.29, cI = W / 2 - 0.41, cm = (cE + cI) / 2;
        [-1, 1].forEach(function (s) {
          for (var k = 0; k < 7; k++) { var x = -cE + (k + 0.5) * 2 * cE / 7; b.box(x, top1 - 0.02, s * cm, 2 * cE / 7 - 0.04, 0.16, cE - cI, { c: b.stoneC('sandstone'), bevel: 0.04, ry: b.j(0.02) }); }
          for (var q = 0; q < 5; q++) { var z = -cI + (q + 0.5) * 2 * cI / 5; b.box(s * cm, top1 - 0.02, z, cE - cI, 0.16, 2 * cI / 5 - 0.04, { c: b.stoneC('sandstone'), bevel: 0.04, ry: b.j(0.02) }); }
        });
      });

      b.part('Floor on the stone');
      b.unit(function () {
        // joists through the walls, their ends standing out of the stone, and boards inside the coping
        for (var k = 0; k < 7; k++) { var z = -1.5 + k * 0.5; b.box(0, top1 - 0.3, z, W + 0.5, 0.16, 0.18, { c: 'woodDark', m: M.wood, bevel: 0.02 }); }
        deck(b, 'x', -1.6, 1.6, -1.6, 1.6, fl + 0.04, { pw: 0.27 });
      });

      b.part('Corner logs');
      b.unit(function () {
        [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach(function (c) {
          b.beam(corner(c[0], c[1], fl), corner(c[0], c[1], yR + 0.1), 0.17, { c: 'wood', round: true, seg: 9, r2: 0.15 });
          // stave-style carved collars at the stage joints
          [fl + 0.15, 4.9, 6.7].forEach(function (y) { var q = corner(c[0], c[1], y); b.cyl(q[0], y - 0.06, q[2], 0.205, 0.12, { c: 'woodDark', m: M.wood, seg: 10, flat: true }); });
        });
      });
      b.unit(function () {
        [fl + 0.1, 4.9, 6.7, yR].forEach(function (y) { faces.forEach(function (f) { b.beam(corner(f[0][0], f[0][1], y), corner(f[1][0], f[1][1], y), 0.1, { c: 'woodDark' }); }); });
      });

      b.part('Guard room');
      // vertical boards between the corner logs, a shuttered window to the front and a door to the ladder on the left
      var c0 = fl + 0.2, c1 = 4.85;
      faces.forEach(function (f, fi) {
        b.unit(function () {
          var p0 = pp(c0), p1 = pp(c1), along = fi % 2 === 0 ? 'x' : 'z', n = 11;
          for (var k = 0; k < n; k++) {
            var t = -1.38 + (k + 0.5) * 2.76 / n, segs = [[c0, c1]];
            if (fi === 0 && Math.abs(t) < 0.34) segs = [[c0, 3.55], [4.35, c1]];
            if (fi === 3 && t > 0.3 && t < 1.2) segs = [[4.5, c1]];
            segs.forEach(function (s) {
              var sgn = fi === 0 || fi === 1 ? 1 : -1, ya = s[0], yb = s[1] + b.j(0.03), pa = pp(ya) * sgn, pb = pp(yb) * sgn;
              if (along === 'x') b.beam([t, ya, pa], [t, yb, pb], 0.12, { c: b.chance(0.35) ? 'woodLight' : 'wood', r2: 0.035, bevel: 0.012 });
              else b.beam([pa, ya, t], [pb, yb, t], 0.035, { c: b.chance(0.35) ? 'woodLight' : 'wood', r2: 0.12, bevel: 0.012 });
            });
          }
          if (fi === 0) {
            var wz = pp(3.95) + 0.02;
            b.box(0, 3.55, wz - 0.06, 0.66, 0.8, 0.08, { c: '#1f1f21', m: M.window, ao: 0, jit: 0, bevel: 0 });
            b.box(0, 3.55, wz - 0.01, 0.05, 0.8, 0.05, { c: 'woodDark', m: M.wood, bevel: 0.01, ao: 0 });
            b.box(0, 3.47, wz + 0.04, 0.86, 0.09, 0.16, { c: 'woodDark', m: M.wood, bevel: 0.02 });
            b.box(0, 4.35, wz + 0.02, 0.86, 0.1, 0.14, { c: 'woodDark', m: M.wood, bevel: 0.02 });
            [-1, 1].forEach(function (sd) { b.box(sd * 0.49, 3.55, wz + 0.09, 0.3, 0.8, 0.04, { c: '#1f1e1c', m: M.paint, ry: sd * 0.4, bevel: 0.01 }); });
          }
          if (fi === 3) {
            var dx = -pp(4.0) - 0.02;
            b.box(dx + 0.04, c0, 0.75, 0.06, 4.5 - c0, 0.9, { c: '#2b2420', m: M.dark, bevel: 0, ao: 0 });
            b.push(dx - 0.05, c0, 0.3, -0.9); for (var q = 0; q < 3; q++) b.box(-0.04, 0, 0.14 + q * 0.29, 0.06, 1.5, 0.27, { c: 'woodDark', m: M.wood, bevel: 0.01 }); b.box(-0.08, 0.35, 0.45, 0.03, 0.06, 0.85, { c: 'iron', m: M.metal, bevel: 0 }); b.box(-0.08, 1.1, 0.45, 0.03, 0.06, 0.85, { c: 'iron', m: M.metal, bevel: 0 }); b.pop();
          }
        });
      });

      b.part('Braced frame');
      [[4.9, 6.7], [6.7, yR]].forEach(function (st) {
        b.unit(function () {
          faces.forEach(function (f, fi) {
            var o = 0.035, a = corner(f[0][0], f[0][1], st[0]), bb = corner(f[1][0], f[1][1], st[1]), c = corner(f[1][0], f[1][1], st[0]), d = corner(f[0][0], f[0][1], st[1]);
            var nx = fi === 1 ? 1 : fi === 3 ? -1 : 0, nz = fi === 0 ? 1 : fi === 2 ? -1 : 0;
            b.beam([a[0] + nx * o, a[1], a[2] + nz * o], [bb[0] + nx * o, bb[1], bb[2] + nz * o], 0.065, { c: 'woodDark' });
            b.beam([c[0] - nx * o, c[1], c[2] - nz * o], [d[0] - nx * o, d[1], d[2] - nz * o], 0.065, { c: 'woodDark' });
          });
        });
      });

      b.part('Deck joists');
      var E = 2.3, hz = [-2.1, -1.5, -0.95, -0.2, 1.0]; // the hatch for the ladder: x -2.3..-1.5, z -0.95..-0.25
      b.unit(function () {
        [-2.2, -1.45, -1.0, 0.0, 0.75, 1.45, 2.2].forEach(function (z) { b.box(0, yD - 0.3, z, E * 2, 0.22, 0.16, { c: 'woodDark', m: M.wood, bevel: 0.02 }); });
        [-E, E].forEach(function (x) { b.box(x, yD - 0.3, 0, 0.16, 0.22, E * 2 + 0.1, { c: 'woodDark', m: M.wood, bevel: 0.02 }); });
      });
      b.unit(function () {
        [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach(function (c) {
          var lo = corner(c[0], c[1], 7.35);
          b.beam(lo, [c[0] * (E - 0.08), yD - 0.3, lo[2]], 0.07, { c: 'woodDark' });
          b.beam(lo, [lo[0], yD - 0.3, c[1] * (E - 0.08)], 0.07, { c: 'woodDark' });
        });
      });

      b.part('Deck tongue');
      var tz0 = E, tz1 = 5.1, tw = 1.25;
      b.unit(function () {
        [-1, 1].forEach(function (s) {
          b.box(s * 1.0, yD - 0.34, (tz1 - 1.45) / 2, 0.24, 0.26, tz1 + 1.45, { c: 'woodDark', m: M.wood, bevel: 0.03 });
          var a1 = corner(s, 1, 5.35), a2 = corner(s, 1, 6.8);
          b.beam(a1, [s * 1.02, yD - 0.36, 4.35], 0.09, { c: 'woodDark' });
          b.beam(a2, [s * 1.02, yD - 0.36, 3.05], 0.08, { c: 'woodDark' });
        });
        [3.0, 3.7, 4.4, tz1 - 0.08].forEach(function (z) { b.box(0, yD - 0.3, z, 2.3, 0.2, 0.15, { c: 'woodDark', m: M.wood, bevel: 0.02 }); });
      });

      b.part('Deck boards');
      b.unit(function () { deck(b, 'z', -E - 0.05, 0, -E - 0.05, E + 0.05, yD, { pw: 0.25, hole: [-2.4, -1.5, -0.95, -0.25] }); });
      b.unit(function () { deck(b, 'z', 0, E + 0.05, -E - 0.05, E + 0.05, yD, { pw: 0.25 }); });
      b.unit(function () { deck(b, 'x', tz0 + 0.03, tz1 + 0.05, -tw, tw, yD, { pw: 0.24 }); });

      b.part('Deck rail');
      b.unit(function () {
        var R0 = E - 0.05;
        rail(b, [-R0, -R0], [R0, -R0], yD); rail(b, [R0, -R0], [R0, R0], yD);
        rail(b, [R0, R0], [tw + 0.05, R0], yD, { h: 1.0 }); rail(b, [-tw - 0.05, R0], [-R0, R0], yD);
        rail(b, [-R0, R0], [-R0, -0.15], yD); rail(b, [-R0, -1.05], [-R0, -R0], yD);
      });
      b.unit(function () {
        // shields hung along the rail like the gunwale of a longship
        var cs = ['ink', 'bone', 'inkGrey', 'bone', 'ink'];
        [-1.85, -1.4].forEach(function (x, i) { shield(b, x, yD + 0.78, E + 0.04, 0, cs[i], null); });
        [1.45].forEach(function (x, i) { shield(b, x, yD + 0.78, E + 0.04, 0, cs[i + 2], null); });
        [1.6, 0.6, -0.5, -1.6].forEach(function (z, i) { shield(b, E + 0.04, yD + 0.78, z, Math.PI / 2, cs[(i + 1) % 5], null); });
        [1.6, 0.7].forEach(function (z, i) { shield(b, -E - 0.04, yD + 0.78, z, -Math.PI / 2, cs[(i + 3) % 5], null); });
      });
      b.unit(function () {
        // the tongue's end posts, carved into dragon heads that look out over the drop
        [-1, 1].forEach(function (s) {
          b.post(s * (tw - 0.1), yD - 0.5, tz1 - 0.1, 0.1, 1.35, { c: 'woodDark' });
          dragonHead(b, s * (tw - 0.1), yD + 0.75, tz1 - 0.1, 0.62, -Math.PI / 2 + s * 0.25, {});
        });
      });

      b.part('Watch cabin');
      var cp = 1.45, eave = yD + 1.95;
      b.unit(function () {
        [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach(function (c) { b.log(c[0] * cp, yD - 0.02, c[1] * cp, 0.14, eave - yD + 0.05, { c: 'wood', seg: 9 }); b.cyl(c[0] * cp, eave - 0.32, c[1] * cp, 0.18, 0.1, { c: 'woodDark', m: M.wood, seg: 10, flat: true }); });
        [-1, 1].forEach(function (s) { b.beam([-cp - 0.2, eave - 0.1, s * cp], [cp + 0.2, eave - 0.1, s * cp], 0.11, { c: 'woodDark' }); b.beam([s * cp, eave - 0.1, -cp - 0.2], [s * cp, eave - 0.1, cp + 0.2], 0.1, { c: 'woodDark' }); });
        // curved brackets under the plates
        [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach(function (c) { b.beam([c[0] * cp, eave - 0.75, c[1] * cp], [c[0] * cp * 0.62, eave - 0.12, c[1] * cp], 0.05, { c: 'woodDark' }); b.beam([c[0] * cp, eave - 0.75, c[1] * cp], [c[0] * cp, eave - 0.12, c[1] * cp * 0.62], 0.05, { c: 'woodDark' }); });
      });
      b.unit(function () {
        // a boarded back wall and a low wall on the left, against the weather
        for (var k = 0; k < 11; k++) { var x = -cp + 0.14 + (k + 0.5) * (2 * cp - 0.28) / 11; b.box(x, yD, -cp, 0.24, eave - yD - 0.18 + b.j(0.03), 0.07, { c: b.chance(0.3) ? 'woodLight' : 'wood', m: M.wood, bevel: 0.012 }); }
        for (var q = 0; q < 10; q++) { var z = -cp + 0.14 + (q + 0.5) * (2 * cp - 0.28) / 10; b.box(-cp, yD, z, 0.07, 0.9 + b.j(0.03), 0.25, { c: b.chance(0.3) ? 'woodLight' : 'wood', m: M.wood, bevel: 0.012 }); }
        b.box(-cp, yD + 0.9, 0, 0.14, 0.08, 2 * cp, { c: 'woodDark', m: M.wood, bevel: 0.02 });
      });

      b.part('Shingled roof');
      var rise = 1.75, rov = 0.3, rox = 0.3, rd = 2 * cp, half = cp + rov, drop = -rov * rise / cp;
      b.unit(function () {
        [-1, 1].forEach(function (s) {
          // the gable ends, boarded up and down
          var x = s * (cp + 0.02);
          for (var k = 0; k < 12; k++) { var z = -cp + (k + 0.5) * rd / 12, hgt = rise * (1 - Math.abs(z) / cp) - 0.08; if (hgt < 0.08) continue; b.box(x, eave + 0.02, z, 0.07, hgt, rd / 12 - 0.02, { c: b.chance(0.4) ? 'wood' : 'woodDark', m: M.wood, bevel: 0.01 }); }
        });
      });
      b.gableRoof(0, eave + 0.02, 0, rd, rd, rise, { m: 'wood', c: 'watchtowerShingle', over: rov, overX: rox, rows: 7, pitch: 0.3 });
      b.unit(function () {
        // crossed barge boards running up past the ridge, their tips carved into dragon heads
        [-1, 1].forEach(function (s) {
          var x = s * (cp + rox + 0.03), yA = eave + 0.02 + drop + 0.16, yT = eave + 0.02 + rise + 0.16, dirY = (yT - yA), dirZ = half, L = Math.hypot(dirY, dirZ), uy = dirY / L, uz = dirZ / L, ext = 0.55;
          [-1, 1].forEach(function (e) {
            var xo = x + e * 0.045, A = [xo, yA, e * half], Tp = [xo, yT + uy * ext, -e * uz * ext];
            b.beam(A, Tp, 0.04, { c: 'woodDark', r2: 0.12 });
            dragonHead(b, xo, Tp[1] - 0.05, Tp[2], 0.78, e > 0 ? Math.PI / 2 : -Math.PI / 2, { rz: -0.42 });
          });
        });
      });
      b.unit(function () { b.flag(0.75, eave + rise + 0.2, 0, 1.6, 1.15, 0.42, { c: 'ember', pennant: true, emblem: 'none', ry: -0.5 }); });

      b.part('The great horn');
      var hx = 2.25 - 0.45 * Math.SQRT1_2, hz0 = 2.25 - 0.45 * Math.SQRT1_2, hry = Math.PI / 4; // the watchman stands at the front-right corner; the horn runs out over it
      b.unit(function () {
        // a forked rest at the rail, the horn laid in it, mouthpiece at the watchman's lips
        b.push(hx, yD, hz0, hry);
        b.post(0, 0, 0.45, 0.05, 1.5, { c: 'woodDark' }); b.cyl(0, 1.0, 0.45, 0.075, 0.1, { c: 'rope', m: M.rope, seg: 8 });
        [-1, 1].forEach(function (s) { b.beam([0, 1.48, 0.45], [s * 0.14, 1.72, 0.45], 0.03, { c: 'woodDark' }); });
        var A = V(0, 1.585, 0.14), C = V(0, 1.6, 1.0), Bp = V(0, 2.15, 1.72), prev = null, N = 12;
        for (var i = 0; i <= N; i++) {
          var t = i / N, p = A.clone().multiplyScalar((1 - t) * (1 - t)).add(C.clone().multiplyScalar(2 * (1 - t) * t)).add(Bp.clone().multiplyScalar(t * t));
          if (prev) { var r0 = 0.02 + Math.pow((i - 1) / N, 1.5) * 0.15, r1 = 0.02 + Math.pow(t, 1.5) * 0.15; b.beam(prev.toArray(), p.toArray(), r0, { c: i > N - 2 ? '#3a3632' : '#ece4d3', m: M.wood, round: true, seg: 12, r2: r1, bevel: 0 }); if (i % 3 === 0) b.beam(prev.clone().lerp(p, 0.35).toArray(), prev.clone().lerp(p, 0.65).toArray(), r1 + 0.014, { c: 'iron', m: M.metal, round: true, seg: 12, bevel: 0 }); }
          prev = p;
        }
        var d = Bp.clone().sub(C).normalize(), e = new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(V(0, 1, 0), d), 'YXZ');
        b.lathe(Bp.x, Bp.y, Bp.z, [[0.16, 0], [0.21, 0.06], [0.25, 0.11], [0.2, 0.11], [0.15, 0.02]], { c: '#3a3632', m: M.wood, seg: 16, rx: e.x, ry: e.y, rz: e.z, order: 'YXZ' });
        b.pop();
      });
      b.unit(function () { b.brazier(-1.85, yD, 1.85, 0.6, { i: 1.1 }); b.push(0, yD, 0, 0); b.woodpile(1.85, -1.4, { n: 3, len: 0.75, ry: Math.PI / 2 }); b.pop(); });

      b.part('Ladders');
      b.unit(function () { b.ladder(-2.14, 0, 0.75, fl + 0.85, { w: 0.52, lean: 0.44, ry: -Math.PI / 2 }); });
      b.unit(function () { b.ladder(-1.84, fl, -0.6, yD - fl + 0.95, { w: 0.5, lean: 0.11, ry: -Math.PI / 2 }); });

      b.part('Banner and shields');
      b.unit(function () {
        // hung from the tongue's end beam, in the low sun
        [-0.45, 0.45].forEach(function (x) { b.beam([x, yD - 0.3, tz1 + 0.02], [x, yD - 0.4, tz1 + 0.1], 0.02, { c: 'iron', m: M.metal }); });
        b.banner(0, yD - 0.4, tz1 + 0.1, 1.15, 2.7, { c: 'ink', emblem: 'none', tail: 'swallow', band: 'ember', bandAt: 0.74, bandH: 0.05, trim: 'iron' });
        headEmblem(b, 0, yD - 0.4 - 2.7 * 0.44, tz1 + 0.1, 0.95, '#f1eee8');
      });
      b.unit(function () {
        var zf = pp(4.2) + 0.06;
        shield(b, -1.03, 4.45, zf, 0, 'bone', null); shield(b, 1.03, 4.45, zf, 0, 'ink', null);
        shield(b, -pp(4.2) - 0.06, 4.42, -0.6, -Math.PI / 2, 'inkGrey', null);
        b.torch(-1.3, base + 1.5, z1 + 0.02, { s: 0.6 }); b.torch(1.3, base + 1.5, z1 + 0.02, { s: 0.6 });
      });

      b.part('Stores at the foot');
      b.unit(function () { b.barrel(2.75, 0, 2.2, {}); b.barrel(3.35, 0, 1.6, { h: 0.82 }); b.barrel(3.0, 0, 0.7, { lie: true, ry: 0.2 }); b.crate(2.6, 0, 3.1, 0.66, { ry: 0.3 }); });
      b.unit(function () {
        // a basket of fish for the watch
        var fx = 1.75, fz = 3.05;
        b.lathe(fx, 0, fz, [[0.01, 0], [0.32, 0], [0.42, 0.3], [0.44, 0.42], [0.4, 0.42], [0.36, 0.08], [0.01, 0.06]], { c: 'woodLight', m: M.straw, seg: 14, flat: true });
        for (var i = 0; i < 9; i++) { var a = i * 2.4, rr = 0.06 + (i % 3) * 0.09; b.ball(fx + Math.cos(a) * rr, 0.42 + (i % 2) * 0.05, fz + Math.sin(a) * rr, 0.07, { c: b.pick(['#9aa3a6', '#b8bfc0', '#7f898d']), m: M.metal, sx: 2.6, sz: 0.8, ry: a, detail: 1 }); }
      });
      b.unit(function () {
        // spears and a ladder's worth of spare poles against the stone
        for (var i = 0; i < 4; i++) b.spear(-1.3 + i * 0.2, 0.28, z1 + 0.42, 2.1, { rx: -0.2, rz: b.j(0.05) });
        b.woodpile(3.4, -1.3, { n: 4, len: 1.5, ry: 0.15 });
      });
      b.unit(function () {
        // a saddle on a trestle, ready for the messenger
        var sx = -3.4, sz = 2.6;
        b.push(sx, 0, sz, 0.5);
        [-1, 1].forEach(function (s) { b.beam([s * 0.5, 0, -0.3], [s * 0.5, 0.75, 0], 0.04, { c: 'wood' }); b.beam([s * 0.5, 0, 0.3], [s * 0.5, 0.75, 0], 0.04, { c: 'wood' }); });
        b.beam([-0.6, 0.78, 0], [0.6, 0.78, 0], 0.06, { c: 'woodLight', round: true });
        // an ink saddle cloth draped over the bar, a bone stripe at its hem
        [-1, 1].forEach(function (s) { b.box(0, 0.5, s * 0.2, 0.95, 0.38, 0.03, { rx: s * 0.42, c: 'ink', m: M.cloth, bevel: 0.01 }); b.box(0, 0.52, s * 0.29, 0.96, 0.05, 0.035, { rx: s * 0.42, c: 'bone', m: M.cloth, bevel: 0 }); });
        b.box(0, 0.8, 0, 0.98, 0.04, 0.45, { c: 'ink', m: M.cloth, bevel: 0.01 });
        b.box(0, 0.84, 0, 0.7, 0.11, 0.42, { c: '#5a3f2b', m: M.wood, bevel: 0.05 });
        b.extrude(-0.33, 0.84, 0, [[-0.06, 0], [0.08, 0], [0.04, 0.2], [-0.06, 0.36], [-0.12, 0.34], [-0.06, 0.18]], 0.34, { c: '#4a3424', m: M.wood, bevel: 0.02 });
        b.extrude(0.3, 0.84, 0, [[-0.08, 0], [0.06, 0], [0.12, 0.22], [0.06, 0.26], [-0.02, 0.1]], 0.3, { c: '#4a3424', m: M.wood, bevel: 0.02 });
        b.ball(0.37, 1.1, 0, 0.05, { c: 'iron', m: M.metal });
        [-1, 1].forEach(function (s) { b.beam([0, 0.86, s * 0.22], [0.02, 0.32, s * 0.4], 0.018, { c: '#3a2a20', m: M.wood }); b.extrude(0.02, 0.2, s * 0.41, [[-0.08, 0], [0.08, 0], [0.06, 0.1], [-0.06, 0.1]], 0.03, { c: 'iron', m: M.metal, bevel: 0.005 }); });
        b.pop();
        b.bucket(-2.7, 0, 3.3); b.sack(-2.95, 0, 3.75, 0.42);
      });
      b.unit(function () {
        // flagstones round the foot of the tower
        for (var i = 0; i < 26; i++) { var a = i / 26 * Math.PI * 2, r = 2.95 + b.j(0.15), x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.abs(x) > 2.75 || Math.abs(z) > 2.75) { x = Math.max(-2.85, Math.min(2.85, x)); z = Math.max(-2.85, Math.min(2.85, z)); } b.box(x, -0.04, z, 0.55 + b.j(0.08), 0.1, 0.45 + b.j(0.06), { ry: -a + b.j(0.2), c: b.stoneC('stoneCool'), bevel: 0.04 }); }
        for (var k = 0; k < 6; k++) b.box(0.15 + b.j(0.08), -0.04, z1 + 0.85 + k * 0.5, 1.0 + b.j(0.1), 0.1, 0.4, { ry: b.j(0.08), c: b.stoneC('stoneCool'), bevel: 0.04 });
      });

      b.unit(function () {
        b.rack(-3.2, 0, -0.9, 1.9, { kind: 'spears', ry: -Math.PI / 2 });
        b.cart(-2.3, 5.7, { ry: 1.0, load: function () { for (var r = 0; r < 3; r++) for (var i = 0; i < 5 - r; i++) b.log((i - (4 - r) / 2) * 0.25, 0.84 + r * 0.2, -0.92 + b.j(0.08), 0.115, 1.8, { c: b.pick(PAL.wood), rx: Math.PI / 2 }); } });
      });
      b.unit(function () {
        // the beacon: an iron fire basket stacked with split logs on a post, ready to be lit when raiders are sighted
        var gx = 6.0, gz = 0.3;
        b.stoneRing(gx, gz, 0.55, 0, 0.6, 0.35, { pal: 'stone', course: 0.3, len: 0.45 });
        b.log(gx, 0.6, gz, 0.13, 2.1, { c: 'woodDark' });
        [0, 2.1, 4.2].forEach(function (a) { b.beam([gx + Math.cos(a) * 0.5, 0.6, gz + Math.sin(a) * 0.5], [gx + Math.cos(a) * 0.1, 1.6, gz + Math.sin(a) * 0.1], 0.04, { c: 'woodDark' }); });
        b.lathe(gx, 2.6, gz, [[0.06, 0], [0.38, 0.06], [0.5, 0.42], [0.46, 0.44], [0.34, 0.1], [0.01, 0.08]], { c: 'iron', m: M.metal, seg: 10, flat: true });
        for (var i = 0; i < 9; i++) { var a = i * 0.7, rr = 0.1 + (i % 3) * 0.1; b.beam([gx + Math.cos(a) * rr, 2.72, gz + Math.sin(a) * rr], [gx + Math.cos(a + 0.4) * rr * 0.6, 3.25 + (i % 2) * 0.1, gz + Math.sin(a + 0.4) * rr * 0.6], 0.05, { c: b.pick(PAL.wood) }); }
      });
      b.unit(function () {
        // spare deck planks: a carpenter's trestle on the lawn, a stack of boards and a plank being trimmed
        var gx = -5.0, gz = 1.1, gy = (b.ground ? b.ground.height(gx, gz) : 0) - 0.04;
        sawhorse(b, gx - 0.63, gy, gz + 0.3, -1.12, 0.8); sawhorse(b, gx + 0.63, gy, gz - 0.3, -1.12, 0.8);
        b.push(gx, gy + 0.72, gz, 0.45 - Math.PI / 2);
        b.box(0, 0, 0, 0.3, 0.06, 2.2, { c: 'woodLight', m: M.wood, bevel: 0.012 });
        b.pop();
        var sx = -5.9, sz = -0.6, sy = (b.ground ? b.ground.height(sx, sz) : 0) - 0.04;
        b.push(sx, sy, sz, 0.3);
        [-0.7, 0, 0.7].forEach(function (z) { b.box(0, 0, z, 1.0, 0.1, 0.12, { c: 'woodDark', m: M.wood, bevel: 0.02 }); });
        for (var r = 0; r < 4; r++) for (var i = 0; i < 4 - (r >> 1); i++) b.box(-0.36 + i * 0.25 + (r % 2) * 0.06 + b.j(0.02), 0.1 + r * 0.075, b.j(0.05), 0.23, 0.07, 2.0 + b.j(0.08), { c: b.chance(0.3) ? 'wood' : 'woodLight', m: M.wood, bevel: 0.012, ry: b.j(0.02) });
        b.pop();
        b.bucket(gx + 1.15, gy, gz - 0.75); b.ropeCoil(-4.4, gy, -0.1, 0.22);
      });
      b.unit(function () {
        // fish hung to dry, in the low sun at the front right
        fishRack(b, 4.55, 4.4, -0.62, 1.9);
        var bx = 3.6, bz = 5.4, by = (b.ground ? b.ground.height(bx, bz) : 0) - 0.04;
        b.lathe(bx, by, bz, [[0.01, 0], [0.32, 0], [0.42, 0.3], [0.44, 0.42], [0.4, 0.42], [0.36, 0.08], [0.01, 0.06]], { c: 'woodLight', m: M.straw, seg: 14, flat: true });
        for (var i = 0; i < 8; i++) { var a = i * 2.4, rr = 0.06 + (i % 3) * 0.09; b.ball(bx + Math.cos(a) * rr, by + 0.42 + (i % 2) * 0.05, bz + Math.sin(a) * rr, 0.07, { c: b.pick(['#9aa3a6', '#b8bfc0', '#7f898d']), m: M.metal, sx: 2.6, sz: 0.8, ry: a, detail: 1 }); }
        b.barrel(5.6, (b.ground ? b.ground.height(5.6, 3.3) : 0) - 0.05, 3.3, { h: 0.8 });
      });
      b.part('Sheep fold');
      var fx = -5.4, fz = 3.6, fr = 1.2;
      b.unit(function () {
        // a ring of stakes woven with withies, a gap to the tower; sheep kept for the watch's table
        var np = 14;
        for (var i = 0; i < np; i++) {
          var a = i / np * Math.PI * 2, a2 = (i + 1) / np * Math.PI * 2, gap = function (q) { return Math.abs(q - 5.95) < 0.25; };
          if (gap(a)) continue;
          var x0 = fx + Math.cos(a) * fr, z0 = fz + Math.sin(a) * fr, x1 = fx + Math.cos(a2) * fr, z1 = fz + Math.sin(a2) * fr;
          var y0 = (b.ground ? b.ground.height(x0, z0) : 0) - 0.06, y1 = (b.ground ? b.ground.height(x1, z1) : 0) - 0.06;
          b.post(x0, y0, z0, 0.04, 0.85 + b.j(0.05), { c: 'woodDark', ry: b.j(0.4) });
          if (gap(a2)) continue;
          for (var w = 0; w < 4; w++) b.beam([x0, y0 + 0.2 + w * 0.15, z0], [x1, y1 + 0.24 + w * 0.15 + b.j(0.02), z1], 0.024, { c: w % 2 ? 'woodLight' : 'wood', round: true, seg: 5, bevel: 0 });
        }
        // a water trough hewn from a log
        var ty = (b.ground ? b.ground.height(fx + 0.35, fz - 0.55) : 0) - 0.04;
        b.push(fx + 0.35, ty, fz - 0.55, 0.3);
        b.box(0, 0, 0, 0.9, 0.3, 0.36, { c: 'woodDark', m: M.wood, bevel: 0.04 });
        b.box(0, 0.24, 0, 0.78, 0.07, 0.24, { c: '#2a3236', m: M.window, bevel: 0, ao: 0 });
        b.pop();
      });
      b.unit(function () { sheep(b, fx - 0.45, fz + 0.3, 2.2, 1); sheep(b, fx + 0.35, fz + 0.5, -0.4, 0.95); sheep(b, fx - 0.25, fz - 0.45, 0.9, 0.85); });

      b.part('Ivy and flowers');
      b.unit(function () {
        b.ivy([[x0 - 0.05, 0.4, -1.6], [x0 - 0.05, 1.5, -1.3], [x0 - 0.05, 2.6, -1.5]], [-1, 0, 0], { density: 6, spread: 0.45 });
        b.ivy([[x1 - 0.3, 0.4, z1 + 0.05], [x1 - 0.5, 1.6, z1 + 0.05], [x1 - 0.35, 2.5, z1 + 0.05]], [0, 0, 1], { density: 5, spread: 0.4 });
        b.bush(-1.4, z1 + 0.65, 0.45, { flowers: '#f3f1ec', n: 2 }); b.bush(1.45, z1 + 0.6, 0.42, { flowers: '#e6e0d2', n: 2 });
      });

      b.life(function () {
        b.figure(hx, hz0, { role: 'villager', pose: 'watchtowerHorn', ry: hry, y: yD, cape: 'ink', beard: true, c: '#5c5e62' });
        b.figure(-1.87, 0.75, { role: 'soldier', pose: 'point', ry: -0.9, y: yD });
        b.figure(-2.82, 0.75, { role: 'villager', pose: 'watchtowerClimb', ry: Math.PI / 2, y: 0.99, c: '#7a5a46' });
        b.figure(1.05, z1 + 0.9, { role: 'soldier', pose: 'spear', ry: 0.1 });
        b.figure(-0.4, z1 + 3.6, { role: 'villager', pose: 'carry', ry: 2.6 });
        b.figure(0.55, z1 + 3.2, { role: 'soldier', pose: 'talk', ry: -2.3, team: 'bone' });
        b.figure(3.2, z1 + 4.2, { role: 'child', pose: 'run', ry: -2.4 });
        b.figure(-5.2, 0.68, { role: 'smith', pose: 'watchtowerMallet', ry: 0.45, c: '#6e5a44', y: (b.ground ? b.ground.height(-5.2, 0.68) : 0) - 0.03 });
      });
    }
  });
})();
