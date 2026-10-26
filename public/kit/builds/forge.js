// Forge: an open smithy under a shingled timber roof on carved stave posts. At its right end a stone hearth glows under
// its hood, the chimney climbing beside the gable; the bellows blow from the right on a rocking beam, the smith hammers
// at the anvil out front by the quench trough, new blades cool on a rack, and in the corner a saddle waits on its
// trestle for a new buckle beside a drawing board of plans and a shield hung for its boss. Built footings and flags
// first, the hearth course by course, the posts and frame, the walls, the hood and chimney, the gables and the roof row
// by row, then the bellows, the fire, the tools and the people.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL;
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  PAL.forgeShingle = ['#3b3733', '#34312d', '#423d37', '#383430', '#2f2c29'];

  // working the bellows handle: both hands on the crossbar in front, leaning in
  KIT.people.poses.forgePump = function () { return { feet: [V(-0.15, 0.09, -0.12), V(0.15, 0.09, 0.18)], hands: [V(-0.13, 1.66, 0.4), V(0.12, 1.64, 0.42)], lean: -0.04, twist: 0, side: 0, hip: 0, drop: 0.1, head: [0, -0.15], pole: [V(-1, -0.6, -0.3), V(1, -0.6, -0.3)] }; };
  // bent over the bench, both hands on the work
  KIT.people.poses.forgeBench = function () { return { feet: [V(-0.14, 0.09, -0.02), V(0.14, 0.09, 0.04)], hands: [V(-0.16, 0.98, 0.42), V(0.14, 1.0, 0.45)], lean: 0.22, twist: 0, side: 0, hip: 0, drop: 0.02, head: [0, 0.45], pole: [V(-1, -0.5, -0.3), V(1, -0.5, -0.3)] }; };

  var HEAD = [[0, 0], [0.2, 0], [0.24, 0.16], [0.32, 0.36], [0.44, 0.52], [0.6, 0.57], [0.8, 0.6], [0.73, 0.64], [0.62, 0.665], [0.8, 0.72], [0.93, 0.76], [0.91, 0.84], [0.75, 0.87], [0.58, 0.9], [0.5, 0.97], [0.29, 1.12], [0.38, 0.92], [0.28, 0.86], [0.19, 0.93], [0.2, 0.76], [0.09, 0.71], [0.14, 0.57], [0.02, 0.47], [0.07, 0.35], [-0.03, 0.23], [0.03, 0.12]];
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
  // a stave post: a stone pad, a dark log carved with a twisted rope band, collars and a block capital
  function stave(b, x, z, y0, y1, s) {
    b.box(x, -0.04, z, 0.46, 0.2, 0.46, { c: b.stoneC('stone'), bevel: 0.05 });
    b.log(x, y0, z, 0.14, y1 - y0, { c: 'woodDark', seg: 10 });
    var n = 20;
    for (var i = 0; i < n; i++) { var t = i / n, a = t * Math.PI * 6 * s, y = y0 + 0.5 + t * (y1 - y0 - 1.1); b.box(x + Math.cos(a) * 0.13, y, z + Math.sin(a) * 0.13, 0.05, 0.17, 0.075, { ry: -a, rx: 0.55 * s, c: '#3a3632', m: M.wood, bevel: 0.01, ao: 0.1 }); }
    [y0 + 0.36, y1 - 0.52].forEach(function (y) { b.cyl(x, y, z, 0.175, 0.09, { c: '#26241f', m: M.wood, seg: 12, flat: true }); });
    b.box(x, y1 - 0.26, z, 0.4, 0.26, 0.4, { c: '#2a2826', m: M.wood, bevel: 0.04, taper: 1.25 });
  }
  function tongs(b, x, y, z, ry, len) {
    b.push(x, y, z, ry || 0);
    b.beam([-0.025, 0, 0], [0.01, -len, 0.0], 0.012, { c: 'iron', m: M.metal, round: true, seg: 5 });
    b.beam([0.025, 0, 0], [-0.01, -len, 0.0], 0.012, { c: 'iron', m: M.metal, round: true, seg: 5 });
    b.box(0, -len - 0.06, 0, 0.05, 0.09, 0.03, { c: 'iron', m: M.metal, bevel: 0.005 });
    b.pop();
  }
  function hammer(b, x, y, z, ry, len) {
    b.push(x, y, z, ry || 0);
    b.cyl(0, -len, 0, 0.02, len, { c: 'wood', m: M.wood, seg: 6 });
    b.box(0, -len - 0.07, 0, 0.2, 0.08, 0.08, { c: 'iron', m: M.metal, bevel: 0.012 });
    b.pop();
  }

  KIT.defineBuild('forge', {
    name: 'Forge', size: 'small', need: 22,
    line: 'An open smithy under a shingled roof: a glowing stone hearth and its chimney, the bellows, the smith at his anvil by the quench trough, new blades cooling on the rack and a soldier proving one on the pell.',
    r: 7.4, flat: [11.0, 8.6], ground: 'grass', path: [[0.9, 7.5], [0.9, 3.6]],
    frameY: 2.4, frameR: 7.2, glowAt: [1.6, 6.5, 0.5],
    trees: [{ x: -5.6, z: -3.0, kind: 'pine', h: 5.6 }, { x: -1.6, z: -5.6, kind: 'pine', h: 4.6 }],
    bushes: [{ x: 6.0, z: 1.6, r: 0.65, flowers: '#f3f1ec' }, { x: 4.8, z: -3.4, r: 0.75 }, { x: 5.9, z: -1.6, r: 0.55 }, { x: -5.0, z: 4.1, r: 0.6, flowers: '#f3f1ec' }, { x: 2.6, z: -4.4, r: 0.65 }],
    build: function (b) {
      var X = [-3.9, -1.95, 0.0], Z = [-2.3, 0.9], yE = 3.15, yP = yE - 0.22, rise = 1.45, over = 0.45, overX = 0.38;
      var rcx = -1.95, rcz = -0.7, W = 3.9, D = 3.2;
      var hx = 1.6, hz = -0.1, hw = 1.7, hd = 1.6, yT = 0.96;
      b.push(0, 0, 0.9, 0);

      b.part('Footings and flags');
      b.unit(function () {
        // stone pads under every post
        X.forEach(function (x) { Z.forEach(function (z) { b.box(x, -0.12, z, 0.62, 0.2, 0.62, { c: 'stoneDark', bevel: 0.05 }); }); });
      });
      [[-2.6, -0.4], [-0.4, 2.9]].forEach(function (zr) {
        b.unit(function () {
          // the smithy floor laid in flags, ragged at the front where the yard begins
          for (var z = zr[0]; z < zr[1]; z += 0.5) for (var x = -4.2; x < 3.0; x += 0.58) {
            var w = 0.54 + b.j(0.05), d = 0.46 + b.j(0.04), xx = x + 0.29 + ((Math.round(z / 0.5) % 2) * 0.24) + b.j(0.03), zz = z + 0.25 + b.j(0.02);
            if (xx > 3.3 || (zz > 1.8 && b.chance(0.3 + (zz - 1.8) * 0.7)) || (xx > 0.4 && zz < -0.2 && xx > hx + hw / 2 + 0.1)) continue;
            if (xx > hx - hw / 2 - 0.05 && xx < hx + hw / 2 + 0.05 && zz > hz - hd / 2 - 0.05 && zz < hz + hd / 2 + 0.05) continue;
            b.box(xx, -0.05, zz, w, 0.1, d, { ry: b.j(0.05), c: b.stoneC('stoneCool', 1.2), m: M.stone, bevel: 0.03, ao: 0.1 });
          }
        });
      });

      b.part('Hearth');
      b.stoneBox(hx, hz, hw, hd, 0, 0.84, 0.32, { pal: 'stone', course: 0.28, len: 0.5 });
      b.unit(function () {
        // the hearth top, a clay-lined fire pan sunk in it, and an iron rim
        b.box(hx, 0.84, hz, hw + 0.1, 0.12, hd + 0.1, { c: 'stoneDark', bevel: 0.04 });
        b.box(hx, yT - 0.01, hz + 0.18, 1.0, 0.05, 0.78, { c: '#2b2724', m: M.dark, bevel: 0.02, ao: 0 });
        [-1, 1].forEach(function (s) { b.box(hx + s * 0.52, yT, hz + 0.18, 0.05, 0.07, 0.84, { c: 'iron', m: M.metal, bevel: 0.01 }); b.box(hx, yT, hz + 0.18 + s * 0.41, 1.08, 0.07, 0.05, { c: 'iron', m: M.metal, bevel: 0.01 }); });
      });
      b.unit(function () {
        // the fireback and the cheeks that carry the hood
        b.stoneWall(hx - hw / 2, hz - 0.62, hx + hw / 2, hz - 0.62, yT, 1.0, 0.32, { pal: 'stone', course: 0.25, len: 0.5 });
        [-1, 1].forEach(function (s) { b.stoneWall(hx + s * 0.72, hz - 0.46, hx + s * 0.72, hz + 0.05, yT, 1.0, 0.26, { pal: 'stone', course: 0.25, len: 0.45 }); });
      });

      b.part('Stave posts and frame');
      b.unit(function () { X.forEach(function (x, i) { stave(b, x, Z[1], 0.06, yP, i % 2 ? -1 : 1); }); });
      b.unit(function () { X.forEach(function (x, i) { stave(b, x, Z[0], 0.06, yP, i % 2 ? 1 : -1); }); });
      b.unit(function () {
        // wall plates along the front and back, tie beams across
        Z.forEach(function (z) { b.box(rcx, yP, z, W + 0.5, 0.22, 0.26, { c: 'woodDark', m: M.wood, bevel: 0.03 }); });
        X.forEach(function (x) { b.box(x, yP - 0.2, rcz, 0.22, 0.2, D + 0.5, { c: 'woodDark', m: M.wood, bevel: 0.03 }); });
      });
      b.unit(function () {
        // knee braces from the posts to the plates, and a king post on each tie
        X.forEach(function (x) { Z.forEach(function (z) {
          [-1, 1].forEach(function (s) { var xx = x + s * 0.7; if (xx < X[0] - 0.1 || xx > X[2] + 0.1) return; b.beam([x, yP - 0.75, z], [xx, yP, z], 0.06, { c: 'woodDark' }); });
        }); b.beam([x, yP, rcz], [x, yE + rise - 0.15, rcz], 0.08, { c: 'woodDark' }); b.beam([x, yP + 0.1, Z[0] + 0.3], [x, yE + rise - 0.25, rcz], 0.06, { c: 'woodDark' }); b.beam([x, yP + 0.1, Z[1] - 0.3], [x, yE + rise - 0.25, rcz], 0.06, { c: 'woodDark' }); });
      });

      b.part('Back and end walls');
      b.unit(function () {
        // the back wall: a stone sill and upright planks to the plate
        b.stoneWall(X[0] + 0.15, Z[0], X[2] - 0.15, Z[0], 0, 0.6, 0.3, { pal: 'stone', course: 0.3, len: 0.55 });
        for (var x = X[0] + 0.15; x < X[2] - 0.15; x += 0.27) b.box(x + 0.13, 0.6, Z[0] - 0.02, 0.25, yP - 0.6, 0.07, { c: b.chance(0.35) ? 'wood' : 'woodDark', m: M.wood, bevel: 0.01 });
      });
      b.unit(function () {
        // a low end wall on the left, planked, with a rail of hung tools above it
        b.stoneWall(X[0], Z[0] + 0.15, X[0], 0.2, 0, 0.5, 0.28, { pal: 'stone', course: 0.25, len: 0.5 });
        for (var z = Z[0] + 0.15; z < 0.2; z += 0.27) b.box(X[0] - 0.02, 0.5, z + 0.13, 0.07, 0.75, 0.25, { c: b.chance(0.35) ? 'wood' : 'woodDark', m: M.wood, bevel: 0.01 });
        b.box(X[0] - 0.02, 1.25, (Z[0] + 0.2) / 2 + 0.07, 0.12, 0.08, 2.5, { c: 'woodDark', m: M.wood, bevel: 0.02 });
        b.box(X[0] - 0.02, 1.95, (Z[0] + Z[1]) / 2, 0.1, 0.08, Z[1] - Z[0], { c: 'woodDark', m: M.wood, bevel: 0.02 });
      });

      b.part('Hood and chimney');
      var cz = hz - 0.3, yH = yT + 1.0, yC = yH + 0.78;
      b.unit(function () {
        // a stone hood gathering the smoke, on a dark oak lintel
        b.box(hx, yH - 0.16, hz + 0.3, hw + 0.15, 0.18, 0.2, { c: 'woodDark', m: M.wood, bevel: 0.03 });
        b.box(hx, yH, cz, hw + 0.1, yC - yH, 1.3, { c: b.stoneC('stone'), m: M.stone, taper: 0.56, taperD: 0.68 });
        for (var k = 1; k < 3; k++) { var t = k / 3, ww = (hw + 0.1) * (1 - t * 0.44) + 0.04, dd = 1.3 * (1 - t * 0.32) + 0.04; b.box(hx, yH + t * (yC - yH) - 0.03, cz, ww, 0.05, dd, { c: '#8a7e6c', m: M.stone, bevel: 0, ao: 0.1 }); }
      });
      b.stoneBox(hx, cz, 1.0, 0.92, yC, 4.3 - yC, 0.3, { pal: 'stone', course: 0.39, len: 0.5 });
      b.unit(function () { b.box(hx, 4.3, cz, 1.16, 0.13, 1.08, { c: 'sandstone', bevel: 0.04 }); });

      b.part('Gables');
      b.unit(function () {
        // boarded gables, a round shield at the heart of each
        [X[0], X[2]].forEach(function (x, gi) {
          for (var q = 0; q < 12; q++) { var z = rcz - D / 2 + (q + 0.5) * D / 12, hgt = rise * (1 - Math.abs(z - rcz) / (D / 2)) - 0.08; if (hgt < 0.1) continue; b.box(x, yE - 0.02, z, 0.08, hgt, D / 12 - 0.02, { c: b.chance(0.4) ? 'wood' : 'woodDark', m: M.wood, bevel: 0.01 }); }
          b.shield(x + (gi ? 0.08 : -0.08), yE + 0.55, rcz, { kind: 'round', c: gi ? 'ink' : 'bone', s: 0.7, ry: gi ? Math.PI / 2 : -Math.PI / 2, emblem: 'none' });
        });
      });

      b.part('Shingled roof');
      b.gableRoof(rcx, yE, rcz, W, D, rise, { m: 'wood', c: 'forgeShingle', over: over, overX: overX, rows: 6, pitch: 0.3 });
      b.unit(function () {
        // crossed barge boards on both gables, carved into dragon heads where they cross
        var half = D / 2 + over, drop = -over * rise / (D / 2), yA = yE + drop + 0.16, yTp = yE + rise + 0.16, L = Math.hypot(yTp - yA, half), uz = half / L, uy = (yTp - yA) / L, ext = 0.62;
        [[rcx - W / 2 - overX - 0.03, -1], [rcx + W / 2 + overX + 0.03, 1]].forEach(function (g) {
          [-1, 1].forEach(function (e) {
            var xx = g[0] + e * 0.045 * g[1], A = [xx, yA, rcz + e * half], Tp = [xx, yTp + uy * ext, rcz - e * uz * ext];
            b.beam(A, Tp, 0.04, { c: 'woodDark', r2: 0.12 });
            dragonHead(b, Tp[0], Tp[1] - 0.05, Tp[2], 0.8, e > 0 ? Math.PI / 2 : -Math.PI / 2, { rz: -0.42 });
          });
        });
      });

      b.part('Chimney top');
      b.stoneBox(hx, cz, 0.8, 0.74, 4.43, 1.25, 0.26, { pal: 'stone', course: 0.42, len: 0.45 });
      b.unit(function () {
        // a capstone, a pot to draw the smoke, and an iron dragon-head vane
        b.box(hx, 5.68, cz, 0.98, 0.14, 0.92, { c: 'sandstone', bevel: 0.04 });
        b.cyl(hx, 5.82, cz, 0.22, 0.26, { c: '#4a4541', m: M.stone, seg: 10, r2: 0.18 });
        b.beam([hx + 0.36, 5.82, cz + 0.3], [hx + 0.36, 6.55, cz + 0.3], 0.018, { c: 'iron', m: M.metal, round: true, seg: 5 });
        dragonHead(b, hx + 0.36, 6.4, cz + 0.3, 0.5, 0, { c: '#2a2826' });
      });

      b.part('Bellows');
      var bx = hx + hw / 2 + 0.15, bz = hz, PEAR = [[0, -0.12], [0.3, -0.3], [0.95, -0.44], [1.32, -0.38], [1.44, 0], [1.32, 0.38], [0.95, 0.44], [0.3, 0.3], [0, 0.12]];
      function pear(b, y, a, k, c, th) {
        b.push(0, y, 0, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(a)).multiply(new T.Matrix4().makeRotationX(Math.PI / 2));
        b.extrude(0, 0, -th / 2, PEAR.map(function (p) { return [p[0] * k + (1 - k) * 0.7, p[1] * k]; }), th, { c: c, m: M.wood, bevel: 0.01 });
        b.pop();
      }
      b.unit(function () {
        // a trestle and the bottom board, the nozzle let into the side of the hearth
        b.push(bx, 0, bz, 0);
        [0.45, 1.15].forEach(function (x) { [-1, 1].forEach(function (s) { b.beam([x, 0, s * 0.32], [x, 0.66, s * 0.16], 0.04, { c: 'wood' }); }); b.box(x, 0.62, 0, 0.1, 0.08, 0.5, { c: 'wood', m: M.wood, bevel: 0.01 }); });
        pear(b, 0.73, 0, 1, 'woodDark', 0.06);
        b.cyl(-0.05, 0.78, 0, 0.07, 0.5, { c: 'iron', m: M.metal, rz: Math.PI / 2, r2: 0.04, seg: 8 });
        b.pop();
      });
      b.unit(function () {
        // the leather bag in pleats, and the top board lifted on its hinge
        b.push(bx, 0, bz, 0);
        for (var i = 1; i <= 4; i++) { var f = i / 5; pear(b, 0.76 + f * 0.04, f * 0.2, 0.9 + (i % 2) * 0.05, i % 2 ? '#4a3424' : '#3a2a1e', 0.07); }
        pear(b, 0.82, 0.2, 1, 'woodDark', 0.06);
        b.push(0, 0.82, 0, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(0.2));
        [0.4, 0.85, 1.25].forEach(function (x) { b.box(x, 0.035, 0, 0.04, 0.02, 0.85 - Math.abs(x - 0.95) * 0.5, { c: 'iron', m: M.metal, bevel: 0 }); });
        b.box(0.85, 0.04, 0, 0.08, 0.06, 0.08, { c: 'iron', m: M.metal, bevel: 0.01 });
        b.pop();
        b.pop();
      });
      b.unit(function () {
        // the rocking beam on its post: pull the handle down and the chain lifts the board
        b.push(bx, 0, bz, 0);
        b.log(1.78, 0, 0, 0.08, 2.0, { c: 'woodDark', seg: 8 });
        b.box(1.78, 1.92, 0, 0.12, 0.16, 0.22, { c: 'woodDark', m: M.wood, bevel: 0.02 });
        b.beam([0.78, 2.34, 0], [2.72, 1.68, 0], 0.05, { c: 'woodDark', round: true, seg: 7 });
        b.beam([2.72, 1.68, -0.2], [2.72, 1.68, 0.2], 0.03, { c: 'woodLight', round: true, seg: 6 });
        for (var k = 0; k < 9; k++) b.cyl(0.84, 1.0 + k * 0.145, 0, 0.022, 0.1, { c: 'iron', m: M.metal, seg: 5, open: true, rx: k % 2 ? 0 : Math.PI / 2 });
        b.beam([0.84, 1.0, 0], [0.84, 2.31, 0], 0.008, { c: 'iron', m: M.metal, round: true, seg: 4 });
        b.box(1.4, 1.98, 0, 0.3, 0.26, 0.22, { c: '#55504a', m: M.stone, bevel: 0.04 });
        b.pop();
      });

      b.part('The fire');
      b.unit(function () {
        // the coals, a low flame, a bar heating in the fire and the glow under the hood
        b.embers(hx - 0.15, yT + 0.03, hz + 0.18, 0.42, { light: false });
        b.embers(hx + 0.2, yT + 0.03, hz + 0.1, 0.32, { light: false });
        for (var i = 0; i < 16; i++) b.ball(hx + b.j(0.42), yT + 0.03, hz + 0.18 + b.j(0.3), 0.06 + b.r() * 0.04, { c: b.pick(['#2a2522', '#3a332e', '#1f1c1a']), m: M.dark, sy: 0.6, detail: 0, ao: 0 });
        b.flame(hx - 0.05, yT + 0.04, hz + 0.12, 0.55, { i: 1.6, color: '#ff8a3a' });
        b.light(hx, yT + 0.6, hz + 0.5, '#ff9a4a', 1.0);
        b.box(hx + 0.25, yT + 0.06, hz + 0.32, 0.5, 0.035, 0.04, { ry: 0.5, c: '#f08a3a', m: M.gold, glow: 2, bevel: 0.005 });
        tongs(b, hx + 0.55, yT + 0.12, hz + 0.45, 0.5, 0.5);
      });

      b.part('Anvil and quench');
      var sx = 1.1, sz = 1.45, sry = -0.35, ax = sx + Math.sin(sry) * 0.85, az = sz + Math.cos(sry) * 0.85;
      b.unit(function () {
        b.anvil(ax, 0, az, { ry: sry });
        // a hammer and set tools stood by the stump
        b.push(ax, 0, az, sry);
        hammer(b, -0.36, 0.55, 0.12, 0.3, 0.5); b.box(0.3, 0, 0.3, 0.22, 0.22, 0.22, { c: 'wood', m: M.wood, bevel: 0.02 });
        b.pop();
      });
      b.unit(function () {
        // the quench trough: planked, iron banded, full of dark water
        var qx = 2.5, qz = 1.6, L = 1.3, Wd = 0.55, Hh = 0.52;
        b.push(qx, 0, qz, 0.08);
        [-1, 1].forEach(function (s) { b.box(0, 0, s * (Wd / 2 - 0.03), L, Hh, 0.06, { c: 'woodDark', m: M.wood, bevel: 0.01 }); b.box(s * (L / 2 - 0.03), 0, 0, 0.06, Hh, Wd - 0.06, { c: 'woodDark', m: M.wood, bevel: 0.01 }); });
        b.box(0, 0.02, 0, L - 0.1, 0.06, Wd - 0.1, { c: 'woodDark', m: M.wood, bevel: 0 });
        b.box(0, Hh - 0.07, 0, L - 0.1, 0.03, Wd - 0.1, { c: '#6f8a94', m: M.water, bevel: 0, ao: 0 });
        [-0.42, 0.42].forEach(function (x) { b.box(x, 0.1, 0, 0.05, Hh - 0.12, Wd + 0.02, { c: 'iron', m: M.metal, bevel: 0 }); });
        tongs(b, 0.2, Hh + 0.02, 0, Math.PI / 2, 0.01);
        b.beam([0.05, Hh + 0.02, -0.1], [0.6, Hh + 0.02, 0.15], 0.012, { c: 'iron', m: M.metal, round: true, seg: 5 });
        b.pop();
      });

      b.part('Racks and tools');
      b.unit(function () {
        // the rack of new blades cooling in the yard, two still dull red at the edge
        b.rack(-4.55, 0, 2.05, 1.6, { kind: 'swords', ry: -0.3 });
        b.push(-4.55, 0, 2.05, -0.3);
        [-0.3, 0.32].forEach(function (x) { b.box(x, 0.55, 0.05, 0.05, 0.42, 0.012, { c: '#c8642e', m: M.gold, glow: 1.2, bevel: 0 }); });
        b.pop();
      });
      b.unit(function () {
        // tongs and hammers hung along the end wall rail, and on pegs by the hearth
        for (var i = 0; i < 7; i++) { var z = Z[0] + 0.35 + i * 0.36; if (i % 3 === 1) hammer(b, X[0] - 0.08, 1.9, z, Math.PI / 2, 0.42); else tongs(b, X[0] - 0.08, 1.92, z, Math.PI / 2, 0.55 + (i % 2) * 0.1); }
        [-0.95, -0.7, -0.45].forEach(function (x, i) { tongs(b, x, 1.6, Z[0] + 0.12, 0, 0.5 + i * 0.06); });
      });
      b.unit(function () {
        // the coal bin by the hearth, heaped with charcoal, and a shovel
        var cx = hx - hw / 2 - 0.55, czz = hz + 0.1;
        [-1, 1].forEach(function (s) { b.box(cx, 0, czz + s * 0.38, 0.75, 0.5, 0.05, { c: 'wood', m: M.wood, bevel: 0.01 }); b.box(cx + s * 0.36, 0, czz, 0.05, 0.5, 0.8, { c: 'wood', m: M.wood, bevel: 0.01 }); });
        for (var i = 0; i < 22; i++) b.ball(cx + b.j(0.28), 0.42 + b.r() * 0.12, czz + b.j(0.3), 0.07 + b.r() * 0.04, { c: b.pick(['#262321', '#302c29', '#1c1a19']), m: M.rock, detail: 0, ao: 0.2 });
        b.beam([cx + 0.2, 0.3, czz - 0.1], [cx + 0.45, 1.2, czz - 0.25], 0.02, { c: 'woodLight', round: true, seg: 5 });
        b.box(cx + 0.17, 0.12, czz - 0.08, 0.2, 0.24, 0.03, { ry: 0.5, rx: 0.3, c: 'iron', m: M.metal, bevel: 0.005 });
      });

      b.part('Shields under the eave');
      b.unit(function () {
        // round shields hung along the front plate, as on a longship
        [-3.2, -2.58, -1.95, -1.27, -0.6].forEach(function (x, i) { b.shield(x, yP - 0.62, Z[1] + 0.2, { kind: 'round', c: ['ink', 'bone', 'inkGrey', 'bone', 'ink'][i], s: 0.66, emblem: 'none' }); });
      });

      b.part('Saddle corner');
      b.unit(function () {
        // a saddle on a trestle, brought in for a new buckle
        b.push(-3.0, 0, 0.35, 0.45);
        [-1, 1].forEach(function (s) { b.beam([s * 0.5, 0, -0.3], [s * 0.5, 0.75, 0], 0.04, { c: 'wood' }); b.beam([s * 0.5, 0, 0.3], [s * 0.5, 0.75, 0], 0.04, { c: 'wood' }); });
        b.beam([-0.6, 0.78, 0], [0.6, 0.78, 0], 0.06, { c: 'woodLight', round: true });
        [-1, 1].forEach(function (s) { b.box(0, 0.5, s * 0.2, 0.95, 0.38, 0.03, { rx: s * 0.42, c: 'bone', m: M.cloth, bevel: 0.01 }); b.box(0, 0.52, s * 0.29, 0.96, 0.05, 0.035, { rx: s * 0.42, c: 'ink', m: M.cloth, bevel: 0 }); });
        b.box(0, 0.8, 0, 0.98, 0.04, 0.45, { c: 'bone', m: M.cloth, bevel: 0.01 });
        b.box(0, 0.84, 0, 0.7, 0.11, 0.42, { c: '#5a3f2b', m: M.wood, bevel: 0.05 });
        b.extrude(-0.33, 0.84, 0, [[-0.06, 0], [0.08, 0], [0.04, 0.2], [-0.06, 0.36], [-0.12, 0.34], [-0.06, 0.18]], 0.34, { c: '#4a3424', m: M.wood, bevel: 0.02 });
        b.extrude(0.3, 0.84, 0, [[-0.08, 0], [0.06, 0], [0.12, 0.22], [0.06, 0.26], [-0.02, 0.1]], 0.3, { c: '#4a3424', m: M.wood, bevel: 0.02 });
        [-1, 1].forEach(function (s) { b.beam([0, 0.86, s * 0.22], [0.02, 0.32, s * 0.4], 0.018, { c: '#3a2a20', m: M.wood }); b.extrude(0.02, 0.2, s * 0.41, [[-0.08, 0], [0.08, 0], [0.06, 0.1], [-0.06, 0.1]], 0.03, { c: 'iron', m: M.metal, bevel: 0.005 }); });
        b.pop();
      });
      b.unit(function () {
        // a drawing board out in the light with the plans for a new sword pinned to it
        b.push(-2.3, 0, 1.5, -0.55);
        [-1, 1].forEach(function (sd) { b.beam([sd * 0.5, 0, -0.18], [sd * 0.45, 1.55, 0.02], 0.035, { c: 'woodDark' }); });
        b.beam([0, 0, -0.55], [0, 1.45, 0.0], 0.03, { c: 'woodDark' });
        b.push(0, 1.08, 0.06, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(-0.14));
        b.box(0, -0.34, 0, 1.0, 0.7, 0.04, { c: 'wood', m: M.wood, bevel: 0.01 });
        [[-0.24, 0.05], [0.24, -0.06]].forEach(function (p) {
          b.box(p[0], -0.3, 0.025, 0.42, 0.56, 0.008, { rz: p[1], c: '#ece5d3', m: M.paint, bevel: 0, ao: 0 });
          // an inked sword, blade and cross guard, and a line of notes under it
          b.box(p[0] - 0.08, -0.2, 0.031, 0.012, 0.3, 0.003, { rz: 0.5, c: '#2a2826', m: M.paint, bevel: 0, ao: 0, jit: 0 });
          b.box(p[0] - 0.01, -0.12, 0.031, 0.12, 0.012, 0.003, { rz: 0.5, c: '#2a2826', m: M.paint, bevel: 0, ao: 0, jit: 0 });
          for (var r = 0; r < 3; r++) b.box(p[0], -0.36 - r * 0.07, 0.031, 0.28 - r * 0.05, 0.012, 0.003, { c: '#2a2826', m: M.paint, bevel: 0, ao: 0, jit: 0 });
        });
        b.pop();
        b.pop();
        // a new round shield hung on the corner post by the hearth, waiting for its iron boss
        b.shield(X[2] + 0.05, 1.5, Z[1] + 0.22, { kind: 'round', c: 'bone', s: 0.72, emblem: 'none' });
      });

      b.part('Stores');
      b.unit(function () {
        // charcoal in sacks and a heap by the bellows, and a barrel of iron bar
        b.sack(3.3, 0, -1.75, 0.5, { c: '#4a4541' }); b.sack(3.85, 0, -1.95, 0.44, { c: '#4a4541' }); b.sack(2.9, 0, -2.25, 0.46, { c: '#4a4541' });
        for (var i = 0; i < 26; i++) { var a = b.r() * 6.28, d = b.r() * 0.55; b.ball(4.6 + Math.cos(a) * d, 0.05 + (0.55 - d) * 0.45, -1.55 + Math.sin(a) * d, 0.09, { c: b.pick(['#262321', '#302c29', '#1c1a19']), m: M.rock, detail: 0, ao: 0.2 }); }
        b.barrel(1.7, 0, -1.6, { r: 0.3, h: 0.85 });
        for (var k = 0; k < 7; k++) b.beam([1.7 + b.j(0.1), 0.6, -1.6 + b.j(0.1)], [1.7 + b.j(0.25), 1.45 + b.r() * 0.2, -1.6 + b.j(0.25)], 0.014, { c: 'iron', m: M.metal, bevel: 0 });
      });
      b.unit(function () {
        // the woodpile and the grindstone on the shaded side
        b.woodpile(-4.75, -1.35, { ry: Math.PI / 2 });
        var gx = -5.0, gz = 0.45;
        b.push(gx, 0, gz, 0.4);
        b.box(0, 0, 0, 0.9, 0.5, 0.35, { c: 'wood', m: M.wood }); b.cyl(0, 0.85, -0.02, 0.42, 0.16, { c: '#b9b2a2', m: M.stone, rx: Math.PI / 2, seg: 16, flat: true });
        b.beam([-0.45, 0.5, 0], [-0.45, 0.95, 0], 0.04, { c: 'wood' }); b.beam([0.45, 0.5, 0], [0.45, 0.95, 0], 0.04, { c: 'wood' });
        b.beam([0.45, 0.85, -0.02], [0.68, 0.85, -0.02], 0.02, { c: 'iron', m: M.metal, round: true, seg: 5 });
        b.pop();
        b.bucket(-4.45, 0, 0.95);
      });
      b.unit(function () {
        b.barrel(-3.0, 0, -3.0, {}); b.barrel(-2.35, 0, -3.15, { h: 0.8 }); b.crate(-1.7, 0, -3.05, 0.62, { ry: 0.2 });
      });

      b.unit(function () {
        // a cart come up from the charcoal burners, half unloaded
        b.push(4.35, 0, 1.95, 0.31);
        b.box(0, 0.62, 0, 1.3, 0.1, 2.0, { c: 'woodLight', m: M.wood, bevel: 0.02 });
        for (var pl = 0; pl < 6; pl++) b.box(-0.54 + pl * 0.216, 0.72, 0, 0.2, 0.02, 1.98, { c: b.pick(PAL.wood), m: M.wood, bevel: 0.005 });
        [-1, 1].forEach(function (s) { b.box(s * 0.63, 0.73, 0, 0.06, 0.34, 2.0, { c: 'wood', m: M.wood, bevel: 0.01 }); for (var st = 0; st < 4; st++) b.box(s * 0.65, 0.62, -0.85 + st * 0.57, 0.05, 0.48, 0.07, { c: 'woodDark', m: M.wood, bevel: 0.005 }); });
        b.box(0, 0.73, -0.98, 1.3, 0.34, 0.06, { c: 'wood', m: M.wood, bevel: 0.01 });
        b.box(0, 0.42, 0.15, 1.5, 0.1, 0.12, { c: 'woodDark', m: M.wood, bevel: 0.01 });
        [-1, 1].forEach(function (s) { b.wheel(s * 0.8, 0.52, 0.15, 0.5, { ry: Math.PI / 2 }); b.beam([s * 0.36, 0.64, 0.95], [s * 0.28, 0.06, 2.15], 0.045, { c: 'wood' }); });
        b.beam([-0.31, 0.3, 1.6], [0.31, 0.3, 1.6], 0.03, { c: 'woodDark' });
        [[-0.3, -0.62], [0.3, -0.58], [-0.28, 0.02], [0.3, 0.1], [-0.3, 0.6]].forEach(function (p, i) { b.sack(p[0], 0.73, p[1], 0.5 - (i % 2) * 0.05); });
        b.sack(0.02, 1.1, -0.35, 0.44, { c: 'canvas' });
        for (var cl = 0; cl < 18; cl++) b.ball(0.15 + b.j(0.35), 0.78 + b.r() * 0.08, 0.55 + b.j(0.3), 0.07 + b.r() * 0.03, { c: b.pick(['#262321', '#302c29', '#1c1a19']), m: M.rock, detail: 0, ao: 0.2 });
        b.beam([0.35, 0.75, 0.75], [0.62, 1.45, 0.95], 0.02, { c: 'woodLight', round: true, seg: 5 });
        b.box(0.32, 0.8, 0.72, 0.2, 0.03, 0.24, { rx: 0.4, ry: 0.4, c: 'iron', m: M.metal, bevel: 0.005 });
        b.pop();
      });

      b.unit(function () {
        // dented shields and a helm left by the path for mending
        var px = -0.75, pz = 4.25;
        b.barrel(px, 0, pz, { h: 0.78, r: 0.28 });
        [[-0.32, 0.25, 0.3, 'ink'], [0.05, 0.36, -0.1, 'bone'], [0.38, 0.2, -0.45, 'inkGrey']].forEach(function (q) { b.shield(px + q[0], 0.34, pz + q[1], { kind: 'round', c: q[3], s: 0.6, rx: -0.35, ry: q[2], emblem: 'none' }); });
        b.ball(px + 0.05, 0.86, pz - 0.02, 0.17, { c: 'steel', m: M.metal, sy: 0.85, detail: 2, smooth: true });
        b.box(px + 0.05, 0.7, pz + 0.15, 0.04, 0.16, 0.03, { c: 'steel', m: M.metal, bevel: 0.005 });
        b.cyl(px + 0.05, 0.76, pz - 0.02, 0.175, 0.04, { c: 'iron', m: M.metal, seg: 12, open: true });
      });

      b.part('Proving the blades');
      b.unit(function () {
        // a straw-wrapped pell in the yard, where a soldier tries the new blade before he takes it
        b.dummy(-2.35, 0, 4.61, { ry: -2.19, helm: true, shield: 'ink' });
        b.flowers(-2.0, 0, 4.95, 0.25, { n: 5, c: '#f3f1ec' });
      });
      b.unit(function () {
        // a proving stump: a new sword struck into the end grain, chips and offcuts round its foot
        var px = -1.4, pz = 5.3;
        b.log(px, 0, pz, 0.32, 0.55, { c: 'wood', seg: 12 });
        b.cyl(px, 0.55, pz, 0.29, 0.02, { c: 'woodLight', m: M.wood, seg: 12, flat: true });
        b.sword(px + 0.05, 1.5, pz - 0.02, { rz: Math.PI + 0.12, ry: 0.6, len: 0.85 });
        for (var i = 0; i < 7; i++) { var a = i * 2.1, d = 0.45 + (i % 3) * 0.12; b.box(px + Math.cos(a) * d, 0, pz + Math.sin(a) * d, 0.12, 0.03, 0.06, { ry: a * 1.7, c: 'woodLight', m: M.wood, bevel: 0.005 }); }
        b.log(px + 0.55, 0.1, pz - 0.3, 0.1, 0.7, { c: 'wood', seg: 7, rz: -Math.PI / 2 });
      });

      b.part('Ivy and flowers');
      b.unit(function () {
        b.ivy([[hx + 0.49, 3.0, cz + 0.46], [hx + 0.49, 4.2, cz + 0.46], [hx + 0.4, 5.1, cz + 0.46]], [0, 0, 1], { density: 4, spread: 0.25 });
        b.bush(-4.4, -0.35, 0.36, { flowers: '#f3f1ec', n: 2 }); b.flowers(-4.5, 0, 0.05, 0.3, { n: 6, c: '#f3f1ec' });
        b.bush(4.5, 1.7, 0.42, { flowers: '#efebe4', n: 2 });
      });

      b.life(function () {
        b.figure(sx, sz, { role: 'smith', pose: 'hammer', ry: sry, c: '#6e5a44' });
        b.figure(bx + 3.12, bz, { role: 'villager', pose: 'forgePump', ry: -Math.PI / 2, c: '#6b5440', hair: '#c9a46a' });
        b.figure(-1.1, 2.6, { role: 'soldier', pose: 'talk', ry: 2.05 });
        b.figure(-3.2, 4.0, { role: 'soldier', pose: 'swing', ry: 0.95, team: 'bone' });
        b.figure(3.1, 2.75, { role: 'villager', pose: 'carry', ry: -2.0, c: '#5c5e62' });
        b.figure(2.15, 3.45, { role: 'child', pose: 'cheer', ry: -2.63 });
        b.figure(-2.72, -0.28, { role: 'villager', pose: 'forgeBench', ry: -0.43, c: '#a39a8a', hair: '#6b4a33' });
      });
      b.life(function () {
        // smoke from the chimney, leaning off with the wind, and a curl of steam over the trough
        [[0, 6.14, 0, 0.1, '#6e6a64'], [-0.06, 6.34, 0.02, 0.13, '#76726b'],
         [-0.22, 6.62, 0.0, 0.2, '#7f7a73'], [-0.42, 6.68, 0.08, 0.17, '#857f78'], [-0.3, 6.84, -0.05, 0.19, '#8a857d'],
         [-0.78, 7.08, 0.05, 0.28, '#958f87'], [-1.12, 7.02, -0.04, 0.24, '#9a948c'], [-0.98, 7.34, 0.06, 0.27, '#a19b93'], [-1.36, 7.3, 0.1, 0.21, '#a6a098']
        ].forEach(function (p) { b.ball(hx + p[0], p[1], cz + 0.05 + p[2], p[3], { c: p[4], m: M.cloth, ao: 0.05, detail: 1, smooth: true, vary: 0.02, sy: 0.82 }); });
        // sparks off the anvil
        for (var k = 0; k < 9; k++) { var a = k * 2.4; b.ball(ax + Math.cos(a) * (0.15 + k * 0.03), 0.95 + (k % 4) * 0.09, az + Math.sin(a) * (0.12 + k * 0.025), 0.018, { c: '#ffb347', bucket: 'glow', glow: 3, detail: 0, ao: 0, jit: 0 }); }
      });
      b.pop();
    }
  });
})();
