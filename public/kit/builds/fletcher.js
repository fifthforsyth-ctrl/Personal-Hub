// Fletcher's hut: a log hut on a dry-stone plinth, laid log by log with crossed corners, under a steep shingled
// gable whose ridge ends in carved dragon heads. In the sunny yard: the fletcher at his bench, feathers drying on
// lines, sheaves of arrow shafts, a chopping block, a glue fire, and a butt where the arrows are tried.
// Built plinth first, the walls a course at a time, the gables, the roof row by row, then the yard and the people.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL;
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  PAL.fletcherShingle = ['#3e3a35', '#36332f', '#45403a', '#3a3632', '#312e2b'];
  PAL.fletcherFeather = ['#f3f1ec', '#efebe4', '#e6e3dc', '#f6f4f0', '#8a857c', '#3a3936', '#f3f1ec', '#d9d6cf'];

  // sitting on a stool at a bench in front (+z), working a shaft in both hands
  KIT.people.poses.fletcherSit = function () { return { feet: [V(-0.16, 0.09, 0.36), V(0.15, 0.09, 0.42)], hands: [V(-0.13, 0.7, 0.4), V(0.12, 0.72, 0.43)], lean: 0.14, twist: 0, side: 0, hip: 0, drop: 0.45, head: [0.12, 0.32], pole: [V(-1, -0.6, -0.2), V(1, -0.6, -0.2)] }; };
  // an axe raised overhead, about to split a billet on the block in front
  KIT.people.poses.fletcherChop = function () { return { feet: [V(-0.21, 0.09, 0.06), V(0.2, 0.09, -0.06)], hands: [V(-0.04, 1.86, -0.02), V(0.05, 1.78, 0.02)], lean: -0.06, twist: 0, side: 0, hip: 0, drop: 0.02, head: [0, 0.25], pole: [V(-1, -0.2, 0.3), V(1, -0.2, 0.3)] }; };

  // sitting on a low stool plucking a goose laid across the lap
  KIT.people.poses.fletcherPluck = function () { return { feet: [V(-0.18, 0.09, 0.34), V(0.17, 0.09, 0.38)], hands: [V(-0.1, 0.68, 0.3), V(0.16, 0.74, 0.34)], lean: 0.2, twist: 0, side: 0, hip: 0, drop: 0.45, head: [0.1, 0.42], pole: [V(-1, -0.6, -0.2), V(1, -0.6, -0.2)] }; };

  var HEAD = [[0, 0], [0.2, 0], [0.24, 0.16], [0.32, 0.36], [0.44, 0.52], [0.6, 0.57], [0.8, 0.6], [0.73, 0.64], [0.62, 0.665], [0.8, 0.72], [0.93, 0.76], [0.91, 0.84], [0.75, 0.87], [0.58, 0.9], [0.5, 0.97], [0.29, 1.12], [0.38, 0.92], [0.28, 0.86], [0.19, 0.93], [0.2, 0.76], [0.09, 0.71], [0.14, 0.57], [0.02, 0.47], [0.07, 0.35], [-0.03, 0.23], [0.03, 0.12]];
  // a carved dragon head: the neck rises from the origin, the snout points along local +x
  function dragonHead(b, x, y, z, s, ry, o) {
    o = o || {};
    b.push(x, y, z, ry || 0);
    if (o.rz) b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(o.rz));
    b.extrude(0, 0, 0, HEAD.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.12 * s, { c: o.c || 'woodDark', m: M.wood, bevel: 0.012 * s });
    [-1, 1].forEach(function (sd) {
      b.ball(0.6 * s, 0.8 * s, sd * 0.075 * s, 0.04 * s, { c: '#efebe4', m: M.paint, detail: 1, ao: 0, jit: 0 });
      b.box(0.62 * s, 0.68 * s, sd * 0.07 * s, 0.28 * s, 0.03 * s, 0.02 * s, { c: '#1f1e1c', m: M.wood, bevel: 0, ao: 0, rz: 0.15 });
    });
    b.pop();
  }
  // a log from a to b ([x, y, z], level), with gaps [[t0, t1], ...] in metres from a
  function logRun(b, a, c, r, gaps) {
    var L = Math.hypot(c[0] - a[0], c[2] - a[2]), ux = (c[0] - a[0]) / L, uz = (c[2] - a[2]) / L, cuts = [[0, L]];
    (gaps || []).forEach(function (g) { var nk = []; cuts.forEach(function (k) { if (k[1] <= g[0] || k[0] >= g[1]) { nk.push(k); return; } if (k[0] < g[0]) nk.push([k[0], g[0]]); if (k[1] > g[1]) nk.push([g[1], k[1]]); }); cuts = nk; });
    cuts.forEach(function (k) {
      if (k[1] - k[0] < 0.2) return;
      var rr = r * (0.94 + b.r() * 0.12);
      b.beam([a[0] + ux * k[0], a[1], a[2] + uz * k[0]], [a[0] + ux * k[1], a[1] + b.j(0.01), a[2] + uz * k[1]], rr, { c: b.chance(0.3) ? 'wood' : 'woodLight', round: true, seg: 9, r2: rr * (0.92 + b.r() * 0.1), bevel: 0 });
      // the sawn end grain, paler
      [k[0], k[1]].forEach(function (t, i) { if ((t === 0 || t === L)) b.addGeo(new T.CircleGeometry(rr * 0.92, 9), { x: a[0] + ux * (t + (i ? 0.012 : -0.012)), y: a[1], z: a[2] + uz * (t + (i ? 0.012 : -0.012)), ry: Math.atan2(ux, uz) + (i ? 0 : Math.PI), c: '#b8a68a', m: M.wood, ao: 0, jit: 0.04 }); });
    });
  }
  // a round shield with its face toward the direction ry turns +z to
  function shield(b, x, y, z, ry, c) { b.shield(x, y, z, { kind: 'round', c: c, s: 0.75, ry: ry, emblem: 'none' }); }
  // a sheaf of arrow shafts standing at (x, y, z), bound with twine, splaying a little; fletched if o.fletch
  function sheaf(b, x, y, z, n, h, o) {
    o = o || {};
    for (var i = 0; i < n; i++) {
      var a = i * 2.39996, rr = 0.025 * Math.sqrt(i + 0.5), dx = Math.cos(a) * rr, dz = Math.sin(a) * rr, top = [x + dx * 2.6 + (o.lean || 0), y + h + b.j(0.03), z + dz * 2.6];
      b.beam([x + dx, y, z + dz], top, 0.009, { c: b.chance(0.3) ? '#c8b89a' : 'woodLight', round: true, seg: 4, bevel: 0 });
      if (o.fletch) [0, 2.1, 4.2].forEach(function (q) { b.box(top[0] + Math.cos(q) * 0.012, top[1] - 0.2, top[2] + Math.sin(q) * 0.012, 0.004, 0.13, 0.035, { ry: -q, c: b.pick(PAL.fletcherFeather), m: M.cloth, bevel: 0, ao: 0 }); });
    }
    b.cyl(x, y + h * 0.42, z, 0.025 * Math.sqrt(n) * 1.7, 0.04, { c: 'rope', m: M.rope, seg: 10 });
  }

  KIT.defineBuild('fletcher', {
    name: "Fletcher's hut", size: 'small', need: 20,
    line: "The arrow maker's log hut, with shafts in sheaves, feathers drying on lines, a chopping block, a goose pen, and the fletcher at his bench.",
    r: 8.4, flat: [10.0, 8.0], ground: 'grass', path: [[1.4, 8.6], [-0.2, 1.4]],
    frameY: 2.3, frameR: 8.1, glowAt: [-0.9, 6.1, -1.0],
    trees: [{ x: -5.6, z: -4.6, kind: 'round', h: 5.2 }, { x: 6.4, z: -3.2, kind: 'pine', h: 6.0 }],
    bushes: [{ x: 6.6, z: 0.4, r: 0.75, flowers: '#f3f1ec' }, { x: -5.7, z: 4.4, r: 0.7 }, { x: 3.0, z: -5.2, r: 0.7 }, { x: -6.6, z: 1.6, r: 0.8 }],
    build: function (b) {
      var hx = -0.9, hz = -1.0, W = 4.8, D = 3.8, r = 0.15, p0 = 0.45, step = 0.28, n = 9;
      var yT = p0 + r + (n - 1) * step + 0.14 + r, rise = 2.1, over = 0.48, overX = 0.5;

      b.part('Plinth');
      b.unit(function () { b.box(hx, -0.08, hz, W + 0.9, 0.3, D + 0.9, { c: 'stoneDark', bevel: 0.08 }); });
      b.stoneBox(hx, hz, W + 0.25, D + 0.25, 0.2, p0 - 0.2, 0.45, { pal: 'stone', course: 0.25, len: 0.55 });

      b.push(hx, 0, hz, 0);
      var fz = D / 2 - r, sx = W / 2 - r, ext = 0.32;
      b.part('Log walls');
      for (var k = 0; k < n; k++) {
        (function (k) {
          var yf = p0 + r + k * step, ys = yf + 0.14;
          b.unit(function () {
            // front and back logs run past the corners; the side logs sit a half log higher and cross them
            var fg = [];
            if (yf < 2.15) fg.push([W / 2 + ext + 0.2, W / 2 + ext + 1.1]);
            if (yf > 1.0 && yf < 1.85) fg.push([W / 2 + ext - 1.4, W / 2 + ext - 0.6]);
            logRun(b, [-W / 2 - ext, yf, fz], [W / 2 + ext, yf, fz], r, fg);
            logRun(b, [W / 2 + ext, yf, -fz], [-W / 2 - ext, yf, -fz], r, []);
            var lg = ys > 1.0 && ys < 1.85 ? [[D / 2 + ext - 0.5, D / 2 + ext + 0.3]] : [];
            logRun(b, [-sx, ys, -D / 2 - ext], [-sx, ys, D / 2 + ext], r, lg);
            logRun(b, [sx, ys, D / 2 + ext], [sx, ys, -D / 2 - ext], r, []);
          });
        })(k);
      }

      b.part('Door and windows');
      b.unit(function () {
        // a dark doorway with a heavy frame and a plank door standing open
        b.box(0.65, p0, fz - 0.02, 0.9, 1.7, 0.1, { c: '#2b2420', m: M.dark, bevel: 0, ao: 0 });
        [0.15, 1.15].forEach(function (x) { b.box(x, p0, fz + 0.06, 0.16, 1.72, 0.2, { c: 'woodDark', m: M.wood, bevel: 0.03 }); });
        b.box(0.65, p0 + 1.68, fz + 0.06, 1.32, 0.18, 0.22, { c: 'woodDark', m: M.wood, bevel: 0.03 });
        for (var q = 0; q < 5; q++) b.box(0.66 + q * 0.04, p0 + 1.78, fz + 0.18, 0.025, 0.06, 0.04, { c: '#efebe4', m: M.paint, bevel: 0, ao: 0 });
        b.push(1.12, p0, fz + 0.05, 1.15);
        for (var p = 0; p < 4; p++) b.box(-0.11 - p * 0.215, 0, 0, 0.2, 1.64, 0.06, { c: p % 2 ? 'woodDark' : '#3d3833', m: M.wood, bevel: 0.01 });
        [0.35, 1.25].forEach(function (y) { b.box(-0.43, y, 0.04, 0.82, 0.06, 0.03, { c: 'iron', m: M.metal, bevel: 0 }); });
        b.pop();
      });
      b.unit(function () {
        // the front window: frame, sill, and ink shutters thrown open
        var wx = -1.0, y0 = 1.0, y1 = 1.87;
        b.box(wx, y0, fz - 0.03, 0.8, y1 - y0, 0.1, { c: '#1f1f21', m: M.window, ao: 0, jit: 0, bevel: 0 });
        b.box(wx, y0 - 0.09, fz + 0.12, 1.0, 0.09, 0.16, { c: 'woodDark', m: M.wood, bevel: 0.02 });
        b.box(wx, y0, fz + 0.06, 0.05, y1 - y0, 0.05, { c: 'woodDark', m: M.wood, bevel: 0.01, ao: 0 });
        [-1, 1].forEach(function (s) { b.box(wx + s * 0.62, y0, fz + 0.17, 0.42, y1 - y0, 0.04, { c: '#1f1e1c', m: M.paint, ry: s * 0.45, bevel: 0.01 }); });
        // the side window
        var wz = D / 2 + ext - (D / 2 + ext) - 0.1;
        b.box(-sx - 0.03, 0.87, wz, 0.1, 0.86, 0.8, { c: '#1f1f21', m: M.window, ao: 0, jit: 0, bevel: 0 });
        b.box(-sx - 0.12, 0.78, wz, 0.16, 0.09, 1.0, { c: 'woodDark', m: M.wood, bevel: 0.02 });
        [-1, 1].forEach(function (s) { b.box(-sx - 0.17, 0.87, wz + s * 0.62, 0.04, 0.86, 0.42, { c: '#1f1e1c', m: M.paint, ry: s * 0.45, bevel: 0.01 }); });
      });

      b.part('Gables');
      b.unit(function () {
        // squared wall plates on the front and back logs, under the eaves
        [-1, 1].forEach(function (s) { b.box(0, yT - 0.15, s * fz, W + 0.5, 0.16, 0.24, { c: 'woodDark', m: M.wood, bevel: 0.03 }); });
        [-1, 1].forEach(function (s) {
          var x = s * sx;
          for (var q = 0; q < 14; q++) { var z = -D / 2 + (q + 0.5) * D / 14, hgt = rise * (1 - Math.abs(z) / (D / 2)) - 0.1; if (hgt < 0.1) continue; b.box(x, yT - 0.05, z, 0.08, hgt + 0.05, D / 14 - 0.02, { c: b.chance(0.4) ? 'wood' : 'woodDark', m: M.wood, bevel: 0.01 }); }
          // a small vent below the peak
          b.box(x + s * 0.03, yT + rise * 0.55, 0, 0.06, 0.26, 0.4, { c: '#1f1e1c', m: M.dark, bevel: 0, ao: 0 });
        });
      });

      b.part('Shingled roof');
      b.gableRoof(0, yT, 0, W, D, rise, { m: 'wood', c: 'fletcherShingle', over: over, overX: overX, rows: 8, pitch: 0.3 });
      var half = D / 2 + over, drop = -over * rise / (D / 2), ridgeY = yT + rise + 0.07, xe = W / 2 + overX;
      b.unit(function () {
        // plain barge boards down the gables
        [-1, 1].forEach(function (s) { [-1, 1].forEach(function (e) { b.beam([s * (xe + 0.03), yT + drop + 0.12, e * half], [s * (xe + 0.03), ridgeY + 0.08, 0], 0.04, { c: 'woodDark', r2: 0.11 }); }); });
      });
      b.unit(function () {
        // carved dragon heads rearing off both ends of the ridge, as on the old stave halls
        dragonHead(b, xe - 0.05, ridgeY - 0.1, 0, 1.05, 0, { rz: -0.12 });
        dragonHead(b, -xe + 0.05, ridgeY - 0.1, 0, 1.05, Math.PI, { rz: -0.12 });
      });
      b.unit(function () {
        // a louvred smoke vent on the ridge
        var vx = -0.9;
        b.box(vx, ridgeY - 0.25, 0, 0.55, 0.55, 0.5, { c: 'woodDark', m: M.wood, bevel: 0.02 });
        b.box(vx, ridgeY + 0.08, 0.255, 0.4, 0.14, 0.02, { c: '#1f1e1c', m: M.dark, bevel: 0, ao: 0 });
        b.push(vx, ridgeY + 0.3, 0, 0); b.gableRoof(0, 0, 0, 0.55, 0.5, 0.3, { m: 'wood', c: 'fletcherShingle', over: 0.12, overX: 0.08, rows: 2, rowsAsUnits: false, pitch: 0.2 }); b.pop();
      });

      b.part('Bows and shields on the walls');
      b.unit(function () {
        // pegs on the front wall with bows hung to season, and a pair of round shields
        [1.55, 1.85, 2.15].forEach(function (x, i) { b.beam([x, 1.62, fz + 0.12], [x, 1.66, fz + 0.32], 0.02, { c: 'woodDark' }); b.bow(x, 1.45 - i * 0.05, fz + 0.24, { tier: i === 1 ? 2 : 1, h: 1.25 }); });
        shield(b, -sx - 0.16, 1.6, 1.25, -Math.PI / 2, 'bone'); shield(b, -sx - 0.16, 1.7, -2.35 + 0.1, -Math.PI / 2, 'ink');
        b.quiver(-0.25, 0.75, fz + 0.2, { ry: 0.2 });
      });
      b.unit(function () {
        // a rack of seasoning shafts against the side wall, under the eave
        var rx = -sx - 0.45;
        [-1.95, -1.15].forEach(function (z) { b.beam([rx - 0.25, p0, z], [rx, 2.1, z], 0.035, { c: 'woodDark' }); });
        for (var i = 0; i < 14; i++) b.beam([rx - 0.02 - (i >> 1) * 0.015, 1.95 - (i % 2) * 0.08, -2.1], [rx - 0.03 - (i >> 1) * 0.015, 1.98 - (i % 2) * 0.08, -1.0], 0.01, { c: 'woodLight', round: true, seg: 4, bevel: 0 });
        b.beam([rx - 0.02, 1.86, -2.1], [rx - 0.02, 1.86, -1.0], 0.025, { c: 'woodDark' });
        sheaf(b, -1.95, p0 - 0.02, fz + 0.36, 16, 0.95, { lean: 0.05 });
      });
      b.pop();

      // ---------------------------------------------------------------- the yard (build coordinates)
      b.part('Feather lines');
      var posts = [[2.6, 1.15], [4.1, 1.45], [5.5, 2.05]];
      b.unit(function () {
        posts.forEach(function (p) { b.post(p[0], 0, p[1], 0.06, 1.95, { c: 'woodDark', ry: 0.2 }); b.box(p[0], 1.92, p[1], 0.24, 0.08, 0.1, { c: 'woodDark', m: M.wood, ry: 0.2 }); });
        for (var s = 0; s < posts.length - 1; s++) [1.82, 1.5, 1.18].forEach(function (y) { var a = posts[s], c = posts[s + 1], m = [(a[0] + c[0]) / 2, y - 0.08, (a[1] + c[1]) / 2]; b.beam([a[0], y, a[1]], m, 0.008, { c: 'rope', m: M.rope, round: true, seg: 4, bevel: 0 }); b.beam(m, [c[0], y, c[1]], 0.008, { c: 'rope', m: M.rope, round: true, seg: 4, bevel: 0 }); });
      });
      for (var s = 0; s < posts.length - 1; s++) {
        (function (a, c) {
          b.unit(function () {
            [1.82, 1.5, 1.18].forEach(function (y, li) {
              for (var i = 1; i < 12; i++) {
                var t = (i + b.j(0.25)) / 12, sag = Math.sin(t * Math.PI) * 0.08, x = a[0] + (c[0] - a[0]) * t, z = a[1] + (c[1] - a[1]) * t, ry = Math.atan2(c[0] - a[0], c[1] - a[1]) + Math.PI / 2 + b.j(0.5);
                var len = 0.26 + b.r() * 0.14, col = b.pick(PAL.fletcherFeather);
                b.beam([x, y - sag, z], [x + b.j(0.02), y - sag - 0.04, z + b.j(0.02)], 0.004, { c: '#efe6d4', m: M.cloth, bevel: 0 });
                b.ball(x, y - sag - 0.04 - len / 2, z, len / 2, { sx: 0.32, sz: 0.08, ry: ry, rz: b.j(0.15), c: col, m: M.cloth, detail: 1, ao: 0.05, jit: 0.02 });
              }
            });
          });
        })(posts[s], posts[s + 1]);
      }

      b.part("Fletcher's bench");
      var bx = 1.55, bz = 3.05;
      b.unit(function () {
        // a low workbench: a thick plank on splayed trestle legs
        b.box(bx, 0.54, bz, 1.75, 0.08, 0.62, { c: 'woodLight', m: M.wood, bevel: 0.02 });
        [-1, 1].forEach(function (s) { [-1, 1].forEach(function (e) { b.beam([bx + s * 0.62, 0, bz + e * 0.3], [bx + s * 0.66, 0.55, bz + e * 0.18], 0.035, { c: 'wood' }); }); b.beam([bx + s * 0.64, 0.25, bz - 0.25], [bx + s * 0.64, 0.25, bz + 0.25], 0.025, { c: 'wood' }); });
        // the stool behind it
        b.cyl(bx, 0.42, bz - 0.62, 0.2, 0.06, { c: 'woodLight', m: M.wood, seg: 10 });
        [0, 2.1, 4.2].forEach(function (a) { b.beam([bx + Math.cos(a) * 0.17, 0, bz - 0.62 + Math.sin(a) * 0.17], [bx + Math.cos(a) * 0.1, 0.43, bz - 0.62 + Math.sin(a) * 0.1], 0.025, { c: 'wood' }); });
      });
      b.unit(function () {
        var y = 0.62;
        // shafts laid out, a pot of hide glue, a heap of feathers, arrowheads, the knife and the twine
        for (var i = 0; i < 9; i++) b.beam([bx - 0.75, y + 0.012, bz + 0.12 + i * 0.022], [bx - 0.05, y + 0.012, bz + 0.1 + i * 0.024], 0.009, { c: 'woodLight', round: true, seg: 4, bevel: 0 });
        b.lathe(bx + 0.35, y, bz + 0.15, [[0.01, 0], [0.09, 0], [0.11, 0.08], [0.09, 0.14], [0.07, 0.15], [0.01, 0.13]], { c: '#4a3a2c', m: M.wood, seg: 10 });
        b.beam([bx + 0.33, y + 0.12, bz + 0.15], [bx + 0.42, y + 0.32, bz + 0.2], 0.008, { c: 'woodLight', round: true, seg: 4 });
        for (var f = 0; f < 10; f++) b.ball(bx + 0.55 + b.j(0.1), y + 0.02 + f * 0.006, bz - 0.05 + b.j(0.12), 0.09, { sx: 0.3, sy: 0.12, ry: b.r() * 6, c: b.pick(PAL.fletcherFeather), m: M.cloth, detail: 1, ao: 0, jit: 0.02 });
        for (var h = 0; h < 6; h++) b.extrude(bx - 0.2 + h * 0.06, y + 0.01, bz - 0.2, [[-0.015, 0], [0.015, 0], [0, 0.07]], 0.01, { c: 'iron', m: M.metal, rx: -Math.PI / 2, bevel: 0 });
        b.box(bx + 0.1, y, bz - 0.15, 0.2, 0.02, 0.03, { c: 'steel', m: M.metal, bevel: 0, ry: 0.4 });
        b.cyl(bx - 0.55, y, bz - 0.18, 0.06, 0.07, { c: 'rope', m: M.rope, seg: 8 });
      });
      b.unit(function () {
        // a barrel of finished arrows, fletched white and grey, and sheaves of bare shafts
        b.barrel(bx + 1.25, 0, bz + 0.25, { h: 0.82 });
        sheaf(b, bx + 1.25, 0.5, bz + 0.25, 22, 0.75, { fletch: true });
        sheaf(b, bx - 1.2, 0, bz + 0.15, 18, 0.95, { lean: -0.08 });
        b.push(bx + 0.2, 0, bz + 0.95, 1.4); for (var q = 0; q < 2; q++) { b.push(0, 0.06 + q * 0.07, q * 0.12, 0); for (var i = 0; i < 12; i++) b.beam([-0.45, 0.008 * (i % 3), (i - 6) * 0.012], [0.45, 0.008 * (i % 3), (i - 6) * 0.012], 0.009, { c: 'woodLight', round: true, seg: 4, bevel: 0 }); b.cyl(0, -0.03, 0, 0.09, 0.04, { c: 'rope', m: M.rope, seg: 8, rz: Math.PI / 2 }); b.pop(); } b.pop();
      });

      b.part('Chopping block and billets');
      var cx = 4.05, cz = 4.0;
      b.unit(function () {
        b.cyl(cx, 0, cz, 0.36, 0.55, { c: 'wood', m: M.wood, seg: 11, flat: true });
        b.addGeo(new T.CircleGeometry(0.33, 11), { x: cx, y: 0.556, z: cz, rx: -Math.PI / 2, c: '#c2ae8e', m: M.wood, ao: 0, jit: 0.03 });
        // a billet set up on the block, and split staves all round
        b.box(cx, 0.55, cz, 0.16, 0.42, 0.16, { c: '#c2ae8e', m: M.wood, bevel: 0.02 });
        for (var i = 0; i < 9; i++) { var a = i * 0.9 + 0.3, d = 0.65 + b.r() * 0.45; b.box(cx + Math.cos(a) * d, 0, cz + Math.sin(a) * d, 0.11, 0.08, 0.45 + b.r() * 0.15, { ry: a + b.j(0.6), c: b.chance(0.5) ? '#c2ae8e' : 'woodLight', m: M.wood, bevel: 0.015 }); }
      });
      b.unit(function () { b.woodpile(5.25, 3.15, { n: 4, len: 1.4, ry: 0.9 }); b.woodpile(5.55, 5.05, { n: 3, len: 1.1, ry: 1.3 }); });

      b.part('Glue fire');
      var gx = 2.9, gz = 5.3;
      b.unit(function () {
        for (var i = 0; i < 9; i++) { var a = i / 9 * Math.PI * 2; b.rock(gx + Math.cos(a) * 0.42, 0.02, gz + Math.sin(a) * 0.42, 0.13 + b.r() * 0.05, { c: b.pick(PAL.stoneCool) }); }
        for (var k = 0; k < 4; k++) { var a2 = k * 1.6; b.beam([gx + Math.cos(a2) * 0.3, 0.05, gz + Math.sin(a2) * 0.3], [gx - Math.cos(a2) * 0.15, 0.2, gz - Math.sin(a2) * 0.15], 0.05, { c: '#3a3430', round: true }); }
        [0, 2.1, 4.2].forEach(function (a) { b.beam([gx + Math.cos(a) * 0.62, 0, gz + Math.sin(a) * 0.62], [gx, 1.25, gz], 0.03, { c: 'woodDark' }); });
        b.beam([gx, 1.25, gz], [gx, 0.72, gz], 0.006, { c: 'iron', m: M.metal, round: true, seg: 4 });
        b.lathe(gx, 0.42, gz, [[0.01, 0], [0.14, 0.02], [0.19, 0.14], [0.17, 0.28], [0.15, 0.3], [0.01, 0.27]], { c: 'iron', m: M.metal, seg: 12 });
        b.embers(gx, 0.1, gz, 0.22, { light: false }); b.flame(gx, 0.12, gz, 0.32, { i: 1 });
      });

      b.part('The butt');
      var tx = -6.3, tz = 0.9;
      b.unit(function () {
        // a straw boss on a timber stand, painted ink and bone, a dot of ember at the clout
        b.push(tx, 0, tz, 0.55);
        var R = 0.62;
        b.beam([-R * 0.7, 0, -0.45], [-R * 0.5, R * 1.6, 0], 0.05, { c: 'wood' });
        b.beam([R * 0.7, 0, -0.45], [R * 0.5, R * 1.6, 0], 0.05, { c: 'wood' });
        b.beam([0, 0, -0.9], [0, R * 1.5, -0.08], 0.05, { c: 'wood' });
        b.cyl(0, R * 1.25, 0, R, 0.32, { c: 'straw', m: M.straw, seg: 18, rx: Math.PI / 2 - 0.12, flat: true });
        // painted in flat bands: a small ember clout, then bone and ink rings
        var bands = [['#ec6418', 0, 0.16], ['#f1eee8', 0.16, 0.36], ['#1f1e1c', 0.36, 0.56], ['#f1eee8', 0.56, 0.76], ['#1f1e1c', 0.76, 0.96]];
        bands.forEach(function (bd) { var g = bd[1] === 0 ? new T.CircleGeometry(R * bd[2], 20) : new T.RingGeometry(R * bd[1], R * bd[2], 28, 1); b.addGeo(g, { x: 0, y: R * 1.25 + 0.04, z: 0.325, rx: -0.12, c: bd[0], m: M.paint, ao: 0, jit: 0, vary: 0.03 }); });
        // arrows that found it
        [[0.12, 0.08], [-0.2, -0.05], [0.05, -0.25], [0.28, 0.2]].forEach(function (p) { var a = [p[0], R * 1.25 + 0.04 + p[1], 0.3], e = [p[0] + 0.05, R * 1.25 + p[1] + 0.12, 0.9]; b.beam(a, e, 0.009, { c: 'woodLight', round: true, seg: 4, bevel: 0 }); b.box(e[0], e[1] - 0.06, e[2] - 0.08, 0.004, 0.035, 0.12, { c: '#f3f1ec', m: M.cloth, bevel: 0, ao: 0 }); });
        b.pop();
      });

      b.part('Goose pen');
      var px = -2.3, pz = 4.75, pr = 1.25;
      b.unit(function () {
        // a ring of stakes woven with withies; the geese give the grey and white feathers
        var np = 13;
        for (var i = 0; i < np; i++) {
          var a = i / np * Math.PI * 2, a2 = (i + 1) / np * Math.PI * 2; if (Math.abs(a - 0.2) < 0.25) continue;
          var x0 = px + Math.cos(a) * pr, z0 = pz + Math.sin(a) * pr, x1 = px + Math.cos(a2) * pr, z1 = pz + Math.sin(a2) * pr;
          b.post(x0, 0, z0, 0.035, 0.72 + b.j(0.05), { c: 'woodDark', ry: b.j(0.4) });
          if (Math.abs(a2 - 0.2) < 0.25) continue;
          for (var w = 0; w < 4; w++) b.beam([x0, 0.16 + w * 0.13, z0], [x1, 0.2 + w * 0.13 + b.j(0.02), z1], 0.022, { c: w % 2 ? 'woodLight' : 'wood', round: true, seg: 5, bevel: 0 });
        }
        b.bucket(px + 0.5, 0, pz - 0.55);
      });
      b.unit(function () {
        [[px - 0.3, pz + 0.2, 0.6], [px + 0.25, pz + 0.45, 2.4], [px - 0.1, pz - 0.4, -1.0], [px + 1.9, pz + 0.3, 1.2]].forEach(function (g, i) {
          b.push(g[0], 0, g[1], g[2]);
          var wc = i === 2 ? '#8a857c' : '#f1eee8';
          b.ball(0, 0.3, 0, 0.2, { sx: 0.85, sy: 0.75, sz: 1.35, c: wc, m: M.cloth, detail: 2, smooth: true, ao: 0.3 });
          b.ball(0, 0.36, -0.2, 0.12, { sx: 0.9, sy: 0.6, sz: 1.2, rx: 0.5, c: wc, m: M.cloth, detail: 1, smooth: true });
          b.beam([0, 0.36, 0.18], [0, 0.66, 0.3], 0.045, { c: wc, m: M.cloth, round: true, seg: 6, r2: 0.035 });
          b.ball(0, 0.69, 0.32, 0.065, { c: wc, m: M.cloth, detail: 1, smooth: true, sz: 1.2 });
          b.cone(0, 0.68, 0.37, 0.026, 0.12, { c: '#5a5550', m: M.wood, seg: 5, rx: Math.PI / 2 });
          [-1, 1].forEach(function (sd) { b.beam([sd * 0.06, 0.18, 0.02], [sd * 0.07, 0.0, 0.05], 0.012, { c: '#5a5550', m: M.wood }); });
          b.pop();
        });
      });

      b.part('Stave rack and plucking stool');
      b.unit(function () {
        // ash staves leaned to season against a pole on two forked uprights
        var sx = -4.9, sz = -1.7, sy = (b.ground ? b.ground.height(sx, sz) : 0) - 0.04;
        b.push(sx, sy, sz, -0.62);
        [-1, 1].forEach(function (s) { b.post(s * 0.9, 0, 0, 0.05, 1.62, { c: 'woodDark' }); [-1, 1].forEach(function (e) { b.beam([s * 0.9, 1.55, 0], [s * 0.9 + e * 0.1, 1.72, 0], 0.025, { c: 'woodDark' }); }); });
        b.beam([-1.1, 1.6, 0], [1.1, 1.62, 0], 0.04, { c: 'wood', round: true, seg: 8 });
        for (var i = 0; i < 15; i++) { var x = -0.8 + i * 0.115 + b.j(0.02); b.beam([x + b.j(0.05), 0, 0.62 + b.j(0.06)], [x, 1.72 + b.j(0.08), -0.06], 0.022, { c: b.chance(0.35) ? '#c8b89a' : 'woodLight', round: true, seg: 5, r2: 0.014, bevel: 0 }); }
        // and a bundle of rough billets at its foot
        for (var r = 0; r < 3; r++) for (var k = 0; k < 4 - r; k++) b.box(1.35 + (k - (3 - r) / 2) * 0.13, 0.065 + r * 0.12, 0.1, 0.12, 0.12, 0.95 + b.j(0.08), { c: b.chance(0.5) ? '#c2ae8e' : 'woodLight', m: M.wood, bevel: 0.015, ry: b.j(0.04) });
        b.pop();
      });
      var qx = -4.0, qz = 5.6, qy = (b.ground ? b.ground.height(qx, qz) : 0) - 0.03;
      b.unit(function () {
        // the plucking stool, a basket heaped with down, and feathers on the turf
        b.cyl(qx, qy + 0.42, qz, 0.2, 0.06, { c: 'woodLight', m: M.wood, seg: 10 });
        [0, 2.1, 4.2].forEach(function (a) { b.beam([qx + Math.cos(a) * 0.17, qy, qz + Math.sin(a) * 0.17], [qx + Math.cos(a) * 0.1, qy + 0.43, qz + Math.sin(a) * 0.1], 0.025, { c: 'wood' }); });
        var kx = qx + 0.62, kz = qz + 0.2;
        b.lathe(kx, qy, kz, [[0.01, 0], [0.24, 0], [0.32, 0.26], [0.34, 0.36], [0.3, 0.36], [0.27, 0.06], [0.01, 0.05]], { c: 'woodLight', m: M.straw, seg: 14, flat: true });
        for (var f = 0; f < 14; f++) { var a = f * 2.4, rr = 0.05 + (f % 4) * 0.06; b.ball(kx + Math.cos(a) * rr, qy + 0.34 + (f % 3) * 0.04, kz + Math.sin(a) * rr, 0.08, { sx: 0.4, sy: 0.3, ry: a, c: b.pick(PAL.fletcherFeather), m: M.cloth, detail: 1, ao: 0, jit: 0.02 }); }
        for (var g = 0; g < 12; g++) { var a2 = g * 1.7 + 0.4, d = 0.35 + b.r() * 0.6; b.ball(qx + Math.cos(a2) * d, qy + 0.035, qz + Math.sin(a2) * d, 0.06, { sx: 0.4, sy: 0.25, ry: a2, c: b.pick(PAL.fletcherFeather), m: M.cloth, detail: 1, ao: 0, jit: 0.02 }); }
        // arrows stuck in the turf at the archer's feet, ready to hand
        [[-3.85, 4.35], [-3.75, 4.2], [-3.95, 4.15], [-3.7, 4.4]].forEach(function (p, i) { var yy = (b.ground ? b.ground.height(p[0], p[1]) : 0) - 0.05, top = [p[0] + 0.08 + b.j(0.04), yy + 0.78, p[1] + 0.12 + b.j(0.04)]; b.beam([p[0], yy, p[1]], top, 0.009, { c: 'woodLight', round: true, seg: 4, bevel: 0 }); b.box(top[0], top[1] - 0.17, top[2], 0.004, 0.13, 0.035, { ry: i, c: i === 2 ? '#3a3936' : '#f3f1ec', m: M.cloth, bevel: 0, ao: 0 }); });
      });

      b.part('Stores and flowers');
      b.unit(function () { b.barrel(2.05, 0, 0.8, {}); b.crate(1.6, 0, 1.25, 0.6, { ry: 0.3 }); b.sack(2.55, 0, 1.6, 0.45); b.bucket(-0.9, 0, 1.7); });
      b.unit(function () {
        b.bush(-2.7, 1.55, 0.45, { flowers: '#f3f1ec', n: 2 }); b.bush(1.85, -3.4, 0.5, { flowers: '#e6e0d2', n: 2 });
        b.ivy([[-3.4, 0.35, -2.1], [-3.4, 1.2, -2.3], [-3.4, 2.0, -2.0]], [-1, 0, 0], { density: 5, spread: 0.4 });
        b.flowers(0.8, 0, 1.55, 0.4, { n: 7, c: '#f3f1ec' }); b.flowers(-2.0, 0, 1.6, 0.35, { n: 6, c: '#efebe4' });
      });

      b.life(function () {
        b.figure(bx, bz - 0.62, { role: 'villager', pose: 'fletcherSit', ry: 0, beard: true, c: '#6f6a62' });
        b.figure(cx + 0.62, cz + 0.05, { role: 'villager', pose: 'fletcherChop', ry: -Math.PI / 2, c: '#d9d6cf' });
        b.figure(-4.4, 4.0, { role: 'archer', pose: 'draw', ry: -2.59 });
        b.figure(0.9, 5.0, { role: 'child', pose: 'carry', ry: 2.8 });
        b.figure(qx, qz, { role: 'villager', pose: 'fletcherPluck', ry: -0.62, c: '#5c5e62', y: qy });
        // the goose across her lap, its neck hanging over her knee
        b.push(qx, qy, qz, -0.62);
        b.ball(0.02, 0.64, 0.3, 0.17, { sx: 1.35, sy: 0.7, sz: 0.85, c: '#f1eee8', m: M.cloth, detail: 2, smooth: true, ao: 0.3 });
        b.beam([0.22, 0.64, 0.32], [0.34, 0.4, 0.36], 0.04, { c: '#f1eee8', m: M.cloth, round: true, seg: 6, r2: 0.03 });
        b.ball(0.35, 0.36, 0.37, 0.055, { c: '#f1eee8', m: M.cloth, detail: 1, smooth: true });
        b.cone(0.35, 0.3, 0.37, 0.022, 0.09, { c: '#5a5550', m: M.wood, seg: 5, rx: Math.PI });
        b.pop();
        b.figure(0.35, 2.35, { role: 'soldier', pose: 'talk', ry: Math.PI / 2 - 0.15, team: 'bone' });
      });
      // the fletcher's shaft, and the axe overhead
      b.life(function () {
        b.beam([bx - 0.3, 0.7, bz - 0.2], [bx + 0.35, 0.74, bz - 0.15], 0.009, { c: 'woodLight', round: true, seg: 4 });
        b.box(bx + 0.33, 0.69, bz - 0.15, 0.004, 0.05, 0.12, { c: '#f3f1ec', m: M.cloth, bevel: 0, ao: 0 });
        b.push(cx + 0.62, 0, cz + 0.05, -Math.PI / 2);
        b.beam([0, 1.8, 0.0], [0, 2.32, -0.34], 0.025, { c: 'woodLight', round: true, seg: 6 });
        b.box(0, 2.22, -0.4, 0.05, 0.16, 0.28, { rx: -0.58, c: 'steel', m: M.metal, bevel: 0.01 });
        b.pop();
      });
    }
  });
})();
