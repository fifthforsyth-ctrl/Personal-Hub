// Prayer shrine: a small stone hall on a paved terrace, its gable to the front, the opening spanned by a carved timber
// lintel on twisted stave posts, candles at the threshold and on the altar before a painted rune stone. Riders kneel
// here before they fly to war. Built terrace first, the walls course by course, the lintel and posts, the gable and the
// slate roof row by row, the altar and the candles, then the forecourt, the rune stones, the ward pole and the people.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL;
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  PAL.shrineSlate = ['#5a5853', '#52504c', '#615e59', '#4b4946', '#66635e', '#56534f'];

  // kneeling on the right knee, both hands on a planted spear, head bowed
  KIT.people.poses.shrineKneel = function () { return { feet: [V(-0.12, 0.12, -0.42), V(0.14, 0.09, 0.3)], hands: [V(-0.07, 0.98, 0.27), V(0.05, 0.9, 0.29)], lean: 0.12, twist: 0, side: 0, hip: 0, drop: 0.32, head: [0, 0.5], pole: [V(-1, -0.5, -0.3), V(1, -0.5, -0.3)] }; };
  // the elder: right hand raised in blessing, the left on a staff
  KIT.people.poses.shrineBless = function () { return { feet: [V(-0.14, 0.09, 0.08), V(0.13, 0.09, -0.08)], hands: [V(-0.32, 1.66, 0.36), V(0.3, 1.12, 0.14)], lean: 0.04, twist: -0.1, side: 0.03, hip: 0, drop: 0, head: [0.15, 0.12], pole: [V(-1, -0.3, -0.2), V(0.7, -0.6, -0.4)] }; };
  // sitting on a bench, hands on the knees
  KIT.people.poses.shrineSit = function () { return { feet: [V(-0.16, 0.09, 0.4), V(0.16, 0.09, 0.36)], hands: [V(-0.17, 0.58, 0.34), V(0.17, 0.58, 0.32)], lean: 0.08, twist: 0, side: 0, hip: 0, drop: 0.45, head: [0.3, 0.05], pole: [V(-1, -0.5, -0.4), V(1, -0.5, -0.4)] }; };

  var HEAD = [[0, 0], [0.2, 0], [0.24, 0.16], [0.32, 0.36], [0.44, 0.52], [0.6, 0.57], [0.8, 0.6], [0.73, 0.64], [0.62, 0.665], [0.8, 0.72], [0.93, 0.76], [0.91, 0.84], [0.75, 0.87], [0.58, 0.9], [0.5, 0.97], [0.29, 1.12], [0.38, 0.92], [0.28, 0.86], [0.19, 0.93], [0.2, 0.76], [0.09, 0.71], [0.14, 0.57], [0.02, 0.47], [0.07, 0.35], [-0.03, 0.23], [0.03, 0.12]];
  function dragonHead(b, x, y, z, s, ry, o) {
    o = o || {};
    b.push(x, y, z, ry || 0);
    if (o.rz) b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(o.rz));
    b.extrude(0, 0, 0, HEAD.map(function (p) { return [p[0] * s, p[1] * s]; }), (o.d || 0.12) * s, { c: o.c || 'woodDark', m: o.m === undefined ? M.wood : o.m, bevel: 0.012 * s });
    if (o.eyes !== false) [-1, 1].forEach(function (sd) {
      b.ball(0.6 * s, 0.8 * s, sd * (o.d || 0.12) * 0.62 * s, 0.04 * s, { c: '#efebe4', m: M.paint, detail: 1, ao: 0, jit: 0 });
      b.box(0.62 * s, 0.68 * s, sd * (o.d || 0.12) * 0.58 * s, 0.28 * s, 0.03 * s, 0.02 * s, { c: '#1f1e1c', m: M.wood, bevel: 0, ao: 0, rz: 0.15 });
    });
    b.pop();
  }
  function headEmblem(b, x, y, z, s, c, off) {
    var pts = HEAD.map(function (p) { return [(p[0] - 0.45) * s, (p[1] - 0.56) * s]; });
    [off || 0.014, -(off || 0.014)].forEach(function (dz) { b.addGeo(KIT.geo.extrude(pts, 0.006), { x: x, y: y, z: z + dz, c: c, m: M.cloth, bucket: 'cloth', ao: 0, jit: 0.01, vary: 0.02 }); });
  }
  // painted runes: a few strokes each, cut into a face that looks along +z at (x, y, z), h tall
  function runes(b, x0, x1, y, z, h, c) {
    var x = x0, kinds = [[[0, 0, 0, 1], [0, 0.6, 0.45, 0.85]], [[0, 0, 0, 1], [0, 1, 0.45, 0.7], [0.45, 0.7, 0, 0.45]], [[0, 0, 0, 1], [0.5, 0, 0.5, 1], [0, 0.5, 0.5, 0.75]], [[0.25, 0, 0.25, 1], [0, 0.75, 0.5, 0.4]], [[0, 0, 0, 1], [0, 1, 0.5, 0.5], [0.5, 0.5, 0, 0]], [[0, 0, 0.5, 1], [0.5, 0, 0, 1]], [[0.25, 0, 0.25, 1], [0, 0.6, 0.25, 1], [0.5, 0.6, 0.25, 1]]];
    while (x < x1 - 0.05) {
      var k = b.pick(kinds), w = h * 0.5;
      k.forEach(function (s) { var ax = x + s[0] * w, ay = y + s[1] * h, bx = x + s[2] * w, by = y + s[3] * h, L = Math.hypot(bx - ax, by - ay); b.box(ax, ay, z, h * 0.09, L, 0.012, { rz: -Math.atan2(bx - ax, by - ay), c: c, m: M.paint, bevel: 0, ao: 0, jit: 0 }); });
      x += w + h * 0.28;
    }
  }
  // a candle: a cream stick, a wick and a small flame (the light is added once per cluster)
  function candle(b, x, y, z, h) {
    b.cyl(x, y, z, 0.035, h, { c: b.pick(['#efe6d2', '#e8dcc2', '#f3ecdc']), m: M.paint, seg: 7, ao: 0.1 });
    b.flame(x, y + h, z, 0.16, { light: false });
  }
  function cluster(b, x, y, z, n, light) {
    for (var i = 0; i < n; i++) { var a = i * 2.4, r = 0.05 + (i % 3) * 0.06; candle(b, x + Math.cos(a) * r, y, z + Math.sin(a) * r, 0.12 + ((i * 7) % 5) * 0.05); }
    if (light) b.light(x, y + 0.45, z, '#ffb15a', light);
  }
  // a standing stone with a rounded head, a serpent band painted round its face and runes inside
  function runeStone(b, x, z, w, h, ry, y) {
    b.push(x, y || 0, z, ry || 0);
    var pts = [[-w * 0.54, 0], [w * 0.5, 0], [w * 0.5, h * 0.3], [w * 0.44, h * 0.62], [w * 0.36, h * 0.84], [w * 0.2, h * 0.95], [w * 0.02, h], [-w * 0.2, h * 0.96], [-w * 0.37, h * 0.83], [-w * 0.47, h * 0.55], [-w * 0.55, h * 0.22]];
    b.extrude(0, 0, 0, pts, 0.24, { c: b.stoneC('stone'), m: M.stone, bevel: 0.03 });
    // the band: an arch of short painted segments, ending in a small head at the foot
    var R = w * 0.36, cy = h * 0.74, segs = [];
    segs.push([-R, 0.12], [-R, cy]); for (var k = 1; k <= 8; k++) { var a2 = Math.PI - k / 8 * Math.PI; segs.push([Math.cos(a2) * R, cy + Math.sin(a2) * R]); } segs.push([R, 0.2]);
    for (var j = 0; j < segs.length - 1; j++) { var p = segs[j], q = segs[j + 1], L = Math.hypot(q[0] - p[0], q[1] - p[1]); b.box(p[0], p[1], 0.158, 0.06, L + 0.02, 0.012, { rz: -Math.atan2(q[0] - p[0], q[1] - p[1]), c: '#e8e2d4', m: M.paint, bevel: 0, ao: 0, jit: 0 }); }
    runes(b, -R + 0.1, R - 0.05, h * 0.5, 0.158, 0.16, '#e8e2d4');
    runes(b, -R + 0.1, R - 0.05, h * 0.28, 0.158, 0.16, '#1f1e1c');
    b.pop();
  }

  KIT.defineBuild('shrine', {
    name: 'Prayer shrine', size: 'small', need: 20,
    line: 'A small stone shrine under a carved dragon lintel on twisted stave posts, candles on the altar in its doorway, the stones of the fallen beside it, and riders kneeling before they fly to war.',
    r: 7.8, flat: [8.6, 12.4], ground: 'grass', path: [[0.4, 8.2], [0.0, 6.0]],
    frameY: 2.2, frameR: 7.7, glowAt: [0.0, 6.9, 1.4],
    trees: [{ x: -4.7, z: -4.3, kind: 'round', h: 5.6 }, { x: 5.0, z: -3.4, kind: 'pine', h: 6.2 }],
    bushes: [{ x: 5.5, z: 2.7, r: 0.75, flowers: '#f3f1ec' }, { x: -6.2, z: 1.7, r: 0.7, flowers: '#f3f1ec' }, { x: -3.3, z: -3.9, r: 0.6 }, { x: 3.0, z: -5.4, r: 0.7 }, { x: -2.3, z: -4.9, r: 0.55 }, { x: -5.85, z: 3.95, r: 0.55, flowers: '#f3f1ec' }],
    perches: [{ x: 0, y: 6.05, z: -0.9, ry: 0 }, { x: 3.9, y: 5.6, z: 0.9, ry: 0 }],
    build: function (b) {
      var sz = -0.9, W = 3.8, D = 4.0, Tk = 0.55, y0 = 0.6, H = 3.25, yW = y0 + H;
      var z1 = sz + D / 2, z0 = sz - D / 2, px0 = -2.6, px1 = 2.6, pz0 = -3.5, pz1 = 2.9, yO = y0 + 2.6, rise = 2.0;

      b.part('Terrace');
      b.unit(function () { b.box(0, -0.1, (pz0 + pz1) / 2, px1 - px0 + 0.6, 0.3, pz1 - pz0 + 0.6, { c: 'stoneDark', bevel: 0.08 }); });
      b.stoneBox(0, (pz0 + pz1) / 2, px1 - px0, pz1 - pz0, 0.2, y0 - 0.2, 0.5, { pal: 'stone', course: 0.2, len: 0.6 });
      b.unit(function () {
        // the terrace paved slab by slab, the floor of the shrine with it
        b.box(0, y0 - 0.2, (pz0 + pz1) / 2, px1 - px0 - 0.8, 0.12, pz1 - pz0 - 0.8, { c: '#8a7e6c', m: M.stone, bevel: 0, ao: 0 });
        for (var x = px0 + 0.05; x < px1 - 0.1; x += 0.62) for (var z = pz0 + 0.05; z < pz1 - 0.1; z += 0.52) {
          var w = Math.min(0.58, px1 - 0.05 - x), d = Math.min(0.48, pz1 - 0.05 - z); if (w < 0.15 || d < 0.15) continue;
          b.box(x + w / 2 + b.j(0.015), y0 - 0.08, z + d / 2 + b.j(0.015), w - 0.04, 0.08 + b.j(0.012), d - 0.04, { ry: b.j(0.02), c: b.stoneC('stoneCool', 1.2), m: M.stone, bevel: 0.025, ao: 0.1 });
        }
      });
      b.unit(function () {
        // two steps down to the forecourt
        [[0.4, pz1, pz1 + 0.36], [0.2, pz1 + 0.36, pz1 + 0.72]].forEach(function (s) { for (var i = 0; i < 4; i++) b.box(-1.3 + (i + 0.5) * 0.65 + b.j(0.01), 0, (s[1] + s[2]) / 2, 0.62, s[0], s[2] - s[1] + 0.02, { c: b.stoneC('sandstone', 1.2), m: M.stone, bevel: 0.04 }); });
      });

      b.part('Stone walls');
      b.stoneBox(0, sz, W, D, y0, H, Tk, {
        pal: 'stone', course: 0.325, len: 0.58,
        holes: [{ side: 'front', at: 0, w: 2.1, y1: yO }, { side: 'front', at: 0, w: 3.0, y0: yO, y1: yW + 0.01 }, { side: 'left', at: 0.3, w: 0.26, y0: y0 + 1.0, y1: y0 + 1.9 }, { side: 'right', at: 0.3, w: 0.26, y0: y0 + 1.0, y1: y0 + 1.9 }]
      });
      b.unit(function () {
        b.box(-W / 2 - 0.01, y0 + 1.0, sz + 0.3, 0.16, 0.86, 0.14, { c: '#1c1b1a', m: M.dark, bevel: 0, ao: 0 });
        b.box(W / 2 + 0.01, y0 + 1.0, sz + 0.3, 0.16, 0.86, 0.14, { c: '#1c1b1a', m: M.dark, bevel: 0, ao: 0 });
        // dressed jambs at the opening
        for (var k = 0; k < 8; k++) [-1, 1].forEach(function (s) { var big = k % 2 === 0; b.box(s * (1.05 + (big ? 0.2 : 0.14)), y0 + k * 0.325, z1 - 0.12, big ? 0.4 : 0.28, 0.3, 0.3, { c: b.stoneC('sandstone'), bevel: 0.05 }); });
      });

      b.part('Carved lintel and posts');
      var lz = z1 - Tk + (Tk + 0.4) / 2, lf = z1 + 0.4;
      b.unit(function () {
        b.box(0, yO, lz, 3.0, yW - yO, Tk + 0.4, { c: 'woodDark', m: M.wood, bevel: 0.04 });
        b.box(0, yW - 0.07, lz, 3.1, 0.09, Tk + 0.48, { c: '#2a2826', m: M.wood, bevel: 0.02 });
      });
      b.unit(function () {
        // two carved beasts meeting at the middle, runes either side, painted bone on the dark oak
        dragonHead(b, -0.62, yO + 0.08, lf + 0.015, 0.46, 0, { d: 0.08, c: '#e8e2d4', m: M.paint, eyes: false });
        dragonHead(b, 0.62, yO + 0.08, lf + 0.015, 0.46, Math.PI, { d: 0.08, c: '#e8e2d4', m: M.paint, eyes: false });
        b.ball(0, yO + 0.33, lf + 0.02, 0.07, { c: 'ember', m: M.paint, detail: 1, ao: 0, sz: 0.5 });
        runes(b, -1.42, -0.8, yO + 0.16, lf + 0.006, 0.26, '#e8e2d4');
        runes(b, 0.82, 1.45, yO + 0.16, lf + 0.006, 0.26, '#e8e2d4');
        [yO + 0.04, yW - 0.12].forEach(function (y) { b.box(0, y, lf + 0.004, 2.92, 0.025, 0.01, { c: '#e8e2d4', m: M.paint, bevel: 0, ao: 0, jit: 0 }); });
      });
      b.unit(function () {
        // stave posts: a stone foot, a twisted rope carving up the shaft, collars and a block capital
        [-1, 1].forEach(function (s) {
          var x = s * 1.32, z = z1 + 0.2;
          b.box(x, y0 - 0.02, z, 0.42, 0.22, 0.42, { c: b.stoneC('sandstone'), bevel: 0.05 });
          b.log(x, y0 + 0.2, z, 0.13, yO - y0 - 0.4, { c: 'woodDark', seg: 10 });
          for (var i = 0; i < 22; i++) { var t = i / 22, a = t * Math.PI * 7 * s, y = y0 + 0.4 + t * (yO - y0 - 0.85); b.box(x + Math.cos(a) * 0.12, y, z + Math.sin(a) * 0.12, 0.05, 0.16, 0.075, { ry: -a, rx: 0.55 * s, c: '#3a3632', m: M.wood, bevel: 0.01, ao: 0.1 }); }
          [y0 + 0.28, yO - 0.42].forEach(function (y) { b.cyl(x, y, z, 0.165, 0.09, { c: '#26241f', m: M.wood, seg: 12, flat: true }); });
          b.box(x, yO - 0.2, z, 0.42, 0.2, 0.42, { c: '#2a2826', m: M.wood, bevel: 0.04, taper: 1.25 });
        });
      });

      b.part('Front gable');
      b.unit(function () {
        // boarded up and down, a bone shield at its heart
        for (var q = 0; q < 16; q++) { var x = -W / 2 + (q + 0.5) * W / 16, hgt = rise * (1 - Math.abs(x) / (W / 2)) - 0.06; if (hgt < 0.08) continue; b.box(x, yW - 0.02, z1 + 0.03, W / 16 - 0.02, hgt, 0.08, { c: b.chance(0.4) ? '#463f38' : 'woodDark', m: M.wood, bevel: 0.01 }); }
        for (var q2 = 0; q2 < 16; q2++) { var x2 = -W / 2 + (q2 + 0.5) * W / 16, h2 = rise * (1 - Math.abs(x2) / (W / 2)) - 0.06; if (h2 < 0.08) continue; b.box(x2, yW - 0.02, z0 - 0.03, W / 16 - 0.02, h2, 0.08, { c: b.chance(0.4) ? '#463f38' : 'woodDark', m: M.wood, bevel: 0.01 }); }
        b.shield(0, yW + 0.78, z1 + 0.08, { kind: 'round', c: 'bone', s: 0.82, emblem: 'none' });
      });

      b.part('Slate roof');
      b.gableRoof(0, yW, sz, D, W, rise, { ry: Math.PI / 2, m: 'slate', c: 'shrineSlate', over: 0.45, overX: 0.42, rows: 7, pitch: 0.32 });
      b.unit(function () {
        // crossed barge boards on both gables, their tips carved into dragon heads
        var over = 0.45, oX = 0.42, half = W / 2 + over, drop = -over * rise / (W / 2), yA = yW + drop + 0.16, yTp = yW + rise + 0.16, L = Math.hypot(yTp - yA, half), ux = half / L, uy = (yTp - yA) / L, ext = 0.6;
        [[z1 + oX + 0.03, 1], [z0 - oX - 0.03, -1]].forEach(function (g) {
          [-1, 1].forEach(function (e) {
            var zz = g[0] + e * 0.045 * g[1], A = [e * half, yA, zz], Tp = [-e * ux * ext, yTp + uy * ext, zz];
            b.beam(A, Tp, 0.12, { c: 'woodDark', r2: 0.04 });
            dragonHead(b, Tp[0], Tp[1] - 0.05, zz, 0.8, e > 0 ? Math.PI : 0, { rz: -0.42 });
          });
        });
      });

      b.part('Altar and rune stone');
      b.unit(function () {
        var az = z1 - 0.5;
        b.box(0, y0, az, 1.35, 0.72, 0.8, { c: b.stoneC('sandstone'), bevel: 0.05 });
        b.box(0, y0 + 0.72, az, 1.6, 0.12, 0.98, { c: b.stoneC('sandstone'), bevel: 0.04 });
        // a cloth of ink with a bone hem hung over its face
        b.box(0, y0 + 0.36, az + 0.41, 1.0, 0.5, 0.02, { c: 'ink', m: M.cloth, bevel: 0 });
        b.box(0, y0 + 0.36, az + 0.425, 1.0, 0.05, 0.015, { c: 'bone', m: M.cloth, bevel: 0 });
        runeStone(b, 0, az - 0.68, 1.15, 1.95, 0, y0);
      });
      b.unit(function () {
        var az = z1 - 0.5, yt = y0 + 0.84;
        cluster(b, -0.5, yt, az + 0.1, 5, 0);
        cluster(b, 0.5, yt, az + 0.12, 5, 0);
        b.light(0, yt + 0.5, az + 0.3, '#ffb15a', 1.2);
        // a sword laid across, a horn cup and a bowl of offerings
        b.sword(-0.42, yt + 0.035, az + 0.3, { rz: -Math.PI / 2, rx: Math.PI / 2, len: 0.8 });
        b.lathe(0.12, yt, az - 0.18, [[0.01, 0], [0.12, 0.01], [0.16, 0.08], [0.14, 0.09], [0.01, 0.04]], { c: 'iron', m: M.metal, seg: 12 });
        b.beam([0.25, yt + 0.02, az + 0.25], [0.43, yt + 0.14, az + 0.2], 0.03, { c: '#e4dccb', m: M.wood, round: true, seg: 7, r2: 0.05 });
      });

      b.part('Candles at the threshold');
      b.unit(function () {
        cluster(b, -0.72, y0, z1 + 0.5, 7, 0.8);
        cluster(b, 0.72, y0, z1 + 0.5, 7, 0.8);
        cluster(b, -1.15, 0.4, pz1 + 0.18, 4, 0);
        cluster(b, 1.15, 0.4, pz1 + 0.18, 4, 0);
      });
      b.unit(function () {
        // a garland of white flowers swung under the lintel, post to post
        for (var i = 0; i <= 18; i++) { var t = i / 18, x = -1.32 + t * 2.64, y = yO - 0.12 - Math.sin(t * Math.PI) * 0.42, z = z1 + 0.22 + Math.sin(t * Math.PI) * 0.06; b.ball(x, y, z, 0.07, { c: 'leaf', m: M.leaf, detail: 0, ao: 0.1 }); if (i % 2 === 0) b.ball(x + 0.02, y - 0.03, z + 0.05, 0.055, { c: b.pick(PAL.flowers), m: M.paint, detail: 0, ao: 0 }); }
      });
      b.unit(function () {
        // two fire bowls on stone pedestals, burning low
        [-2.0, 2.0].forEach(function (x) {
          var z = 2.35;
          b.box(x, y0, z, 0.34, 0.6, 0.34, { c: b.stoneC('sandstone'), bevel: 0.04 });
          b.box(x, y0 + 0.6, z, 0.46, 0.08, 0.46, { c: b.stoneC('sandstone'), bevel: 0.03 });
          b.lathe(x, y0 + 0.68, z, [[0.04, 0], [0.2, 0.02], [0.27, 0.13], [0.24, 0.15], [0.17, 0.05], [0.01, 0.04]], { c: 'iron', m: M.metal, seg: 12 });
          b.embers(x, y0 + 0.79, z, 0.2, { light: false });
          b.flame(x, y0 + 0.79, z, 0.4, { i: 0.7 });
        });
      });

      b.part('Shields on the walls');
      b.unit(function () {
        [[-2.3, 'ink'], [-1.45, 'bone'], [0.45, 'inkGrey']].forEach(function (s) { b.shield(-W / 2 - 0.06, y0 + 1.95, s[0], { kind: 'round', c: s[1], s: 0.74, ry: -Math.PI / 2, emblem: 'none' }); });
        // offerings: shields of the fallen leant against the terrace
        [[-2.15, 0], [-1.8, 0.25], [1.85, -0.2]].forEach(function (s, i) { b.shield(s[0], 0.28, pz1 + 0.1, { kind: 'round', c: i === 1 ? 'bone' : 'ink', s: 0.62, rx: -0.25, ry: s[1], emblem: 'none' }); });
      });

      b.part('Forecourt');
      b.unit(function () {
        for (var z = pz1 + 0.75; z < 6.4; z += 0.55) for (var x = -1.5; x < 1.5; x += 0.6) {
          var w = 0.55 + b.j(0.05), d = 0.5 + b.j(0.04), xx = x + 0.3 + ((Math.round(z / 0.55) % 2) * 0.28) + b.j(0.04);
          if (Math.abs(xx) > 1.2 - Math.max(0, z - 5.2) * 0.25) continue;
          b.box(xx, -0.05, z + 0.25, w, 0.1, d, { ry: b.j(0.06), c: b.stoneC('stoneCool', 1.2), m: M.stone, bevel: 0.03, ao: 0.1 });
        }
      });
      b.unit(function () { runeStone(b, -2.15, 5.5, 0.72, 1.8, 0.25); runeStone(b, 2.15, 5.5, 0.72, 1.7, -0.25); });
      b.unit(function () {
        // beds of white flowers either side of the steps, kerbed with stones
        [-1, 1].forEach(function (s) {
          var cx = s * 2.05, cz = pz1 + 0.7;
          for (var i = 0; i < 8; i++) { var a = i / 8 * Math.PI * 2; b.box(cx + Math.cos(a) * 0.62, -0.02, cz + Math.sin(a) * 0.4, 0.26, 0.14, 0.18, { ry: -a, c: b.stoneC('stone'), bevel: 0.03 }); }
          b.bush(cx, cz, 0.4, { flowers: '#f3f1ec', n: 2 });
          b.flowers(cx + 0.2, 0, cz + 0.1, 0.45, { n: 9, c: '#f3f1ec' }); b.flowers(cx - 0.25, 0, cz - 0.05, 0.35, { n: 7, c: '#efebe4' });
        });
      });
      b.unit(function () { b.bench(-3.95, 2.75, 1.9, { ry: 0.15 }); b.bench(3.45, 3.6, 1.6, { ry: -Math.PI / 2 + 0.2 }); });
      b.unit(function () {
        // a rider's cairn: field stones heaped round a planted spear, a shield and candles at its foot
        var cx = -3.5, cz = 4.65;
        for (var i = 0; i < 9; i++) { var a = i / 9 * Math.PI * 2; b.rock(cx + Math.cos(a) * 0.58, 0.04, cz + Math.sin(a) * 0.58, 0.3, { c: b.pick(PAL.stoneDark) }); }
        for (var k = 0; k < 6; k++) { var a2 = k / 6 * Math.PI * 2 + 0.4; b.rock(cx + Math.cos(a2) * 0.32, 0.3, cz + Math.sin(a2) * 0.32, 0.27, { c: b.pick(PAL.stone) }); }
        for (var k2 = 0; k2 < 3; k2++) { var a3 = k2 / 3 * Math.PI * 2 + 1.1; b.rock(cx + Math.cos(a3) * 0.14, 0.55, cz + Math.sin(a3) * 0.14, 0.2, { c: b.pick(PAL.stoneCool) }); }
        b.flag(cx, 0.5, cz, 1.95, 0.6, 0.28, { c: 'ink', pennant: true, pr: 0.026, ry: 0.6 });
        b.cone(cx, 2.47, cz, 0.045, 0.26, { c: 'iron', m: M.metal, seg: 4 });
        b.shield(cx + 0.5, 0.32, cz + 0.8, { kind: 'round', c: 'bone', s: 0.58, rx: -0.3, ry: 0.5, emblem: 'none' });
        cluster(b, cx - 0.25, 0, cz + 0.95, 4, 0);
        b.flowers(cx - 0.6, 0, cz + 0.5, 0.35, { n: 7, c: '#f3f1ec' });
      });

      b.unit(function () {
        // the stones of the fallen: a row of small rune stones by the shrine wall, a candle and white flowers at each foot
        [[-5.75, -0.75, 1.15, 0.32], [-5.0, -1.25, 1.45, 0.18], [-4.2, -1.0, 1.25, 0.12], [-3.55, -1.6, 1.05, 0.05]].forEach(function (m, i) {
          runeStone(b, m[0], m[1], 0.5 + (i % 2) * 0.06, m[2], m[3]);
          cluster(b, m[0] + 0.12, 0, m[1] + 0.32, 3, 0);
          b.flowers(m[0] - 0.12, 0, m[1] + 0.35, 0.22, { n: 5, c: '#f3f1ec' });
        });
        b.shield(-4.95, 0.3, -0.9, { kind: 'round', c: 'ink', s: 0.55, rx: -0.3, ry: 0.2, emblem: 'none' });
        b.ball(-4.2, 0.13, -0.62, 0.15, { c: 'steel', m: M.metal, sy: 0.85, detail: 2, smooth: true });
        b.cyl(-4.2, 0.03, -0.62, 0.155, 0.04, { c: 'iron', m: M.metal, seg: 12, open: true });
      });
      b.unit(function () {
        // a rack where riders leave their spears before they kneel, shields leant at its foot
        b.rack(4.55, 0, 4.7, 1.6, { kind: 'spears', ry: -0.85 });
        b.push(4.55, 0, 4.7, -0.85);
        b.shield(-0.4, 0.3, 0.35, { kind: 'round', c: 'bone', s: 0.6, rx: -0.3, emblem: 'none' });
        b.shield(0.35, 0.3, 0.33, { kind: 'round', c: 'inkGrey', s: 0.6, rx: -0.28, ry: 0.1, emblem: 'none' });
        b.pop();
      });

      b.part('Ward pole');
      var wx = 3.9, wz = 0.9;
      b.unit(function () {
        b.box(wx, -0.05, wz, 0.8, 0.25, 0.8, { c: b.stoneC('stone'), bevel: 0.06 });
        b.log(wx, 0.2, wz, 0.15, 4.6, { c: 'woodDark', seg: 10, r2: 0.12 });
        [0.9, 2.2, 3.4, 4.4].forEach(function (y) { b.cyl(wx, y, wz, 0.19, 0.1, { c: '#26241f', m: M.wood, seg: 12, flat: true }); });
        dragonHead(b, wx, 4.75, wz - 0.1, 0.95, -Math.PI / 2, { rz: -0.1 });
        b.beam([wx - 0.75, 4.2, wz + 0.04], [wx + 0.75, 4.2, wz + 0.04], 0.05, { c: 'woodDark' });
      });
      b.unit(function () {
        b.banner(wx, 4.14, wz + 0.1, 1.15, 2.6, { c: 'ink', emblem: 'none', tail: 'swallow', band: 'ember', bandAt: 0.76, bandH: 0.05, trim: 'iron' });
        headEmblem(b, wx, 4.14 - 2.6 * 0.44, wz + 0.1, 0.95, '#f1eee8', 0.05);
      });

      b.part('Ivy and moss');
      b.unit(function () {
        b.ivy([[-W / 2 - 0.05, y0 + 0.2, z0 + 0.12], [-W / 2 - 0.05, y0 + 1.4, z0 + 0.25], [-W / 2 - 0.05, y0 + 2.4, z0 + 0.1]], [-1, 0, 0], { density: 6, spread: 0.45 });
        b.ivy([[W / 2 - 0.2, y0 + 0.1, z1 + 0.05], [W / 2 - 0.35, y0 + 1.2, z1 + 0.05], [W / 2 - 0.25, y0 + 2.1, z1 + 0.05]], [0, 0, 1], { density: 5, spread: 0.35 });
      });

      b.life(function () {
        // two riders kneel on the threshold before the altar; the elder blesses the nearer one
        b.figure(0.38, z1 + 0.98, { role: 'soldier', pose: 'shrineKneel', ry: Math.PI + 0.08, y: y0 });
        b.figure(-0.55, z1 + 1.22, { role: 'soldier', pose: 'shrineKneel', ry: Math.PI - 0.1, y: y0, team: 'bone' });
        b.figure(1.12, 2.0, { role: 'villager', pose: 'shrineBless', ry: -1.28, y: y0, cape: 'bone', beard: true, c: '#3b3a38', hair: '#d9d6cf' });
        // a knight keeping vigil at the stones of the fallen
        b.figure(-3.2, -0.55, { role: 'knight', pose: 'vigil', ry: -Math.PI / 2 - 0.25 });
        // one rider walks out, blessed; another waits his turn on the bench
        b.figure(1.0, 4.7, { role: 'soldier', pose: 'walk', ry: -0.35, team: 'bone' });
        b.figure(-4.15, 2.72, { role: 'soldier', pose: 'shrineSit', ry: 0.15 });
        b.figure(-0.55, 6.6, { role: 'villager', pose: 'walk', ry: 0.15, c: '#7a5a46' });
        b.figure(2.75, 6.0, { role: 'child', pose: 'run', ry: 0.9 });
      });
      b.life(function () {
        // the elder's staff
        b.push(1.12, y0, 2.0, -1.28);
        b.beam([0.3, 0, 0.16], [0.3, 1.85, 0.12], 0.025, { c: 'woodLight', round: true, seg: 6 });
        b.ball(0.3, 1.88, 0.12, 0.045, { c: 'iron', m: M.metal });
        b.pop();
      });
    }
  });
})();
