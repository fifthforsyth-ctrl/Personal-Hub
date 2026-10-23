// Armorer: the armorer's hall, stone below and dark timber above under a steep slate roof, with a gabled wing over
// the door boarded in dark planks, a great bone shield on it and crossed bargeboards carved into dragon heads on every
// gable. Before it, on a paved
// court, six stands hold the whole armor of God (Ephesians 6:13-17): the belt of truth, the breastplate of
// righteousness, the shoes of the gospel of peace, the shield of faith, the helmet of salvation and the sword of the
// Spirit, with the Word open on a lectern beside it. A forge lean-to with its chimney on the shady side, mail hung to
// air and a sand barrel for scouring it in the sun. Built footings first, the hall course by course, the lean-to and
// chimney, the upper floor panel by panel, the gables, the roof row by row, the dragon heads, then the court, the six
// stands one by one, the banner, the workshop props, and last the people.
(function () {
  var T = THREE;
  function V3(x, y, z) { return new T.Vector3(x, y, z); }

  // two working poses: wiping a helm on its stand, and turning a crank at waist height
  KIT.people.poses.armorerPolish = function (r) { return { feet: [V3(-0.15, 0.09, 0.06), V3(0.14, 0.09, -0.08)], hands: [V3(-0.08, 1.6, 0.5), V3(0.17, 1.47, 0.46)], lean: 0.12, twist: 0.05, side: 0, hip: 0.02, drop: 0, head: [0, -0.22], pole: [V3(-0.8, -0.5, -0.3), V3(0.8, -0.5, -0.3)] }; };
  KIT.people.poses.armorerCrank = function (r) { return { feet: [V3(-0.2, 0.09, 0.16), V3(0.17, 0.09, -0.2)], hands: [V3(-0.08, 0.98, 0.5), V3(0.1, 0.94, 0.48)], lean: 0.25, twist: 0.1, side: 0, hip: 0, drop: 0.06, head: [0, 0.25], pole: [V3(-0.8, -0.6, -0.2), V3(0.8, -0.6, -0.2)] }; };

  // a carved dragon head, the profile in the local XY plane, snout toward local +x, neck foot at (x, y, z);
  // ry turns it, s is its height, o.rz leans the neck
  function armorerHead(b, x, y, z, ry, s, o) {
    o = o || {}; var M = KIT.M, c = o.c || 'beam';
    var P = [[-0.11, 0], [-0.16, 0.26], [-0.13, 0.5], [-0.05, 0.7], [-0.14, 0.86], [-0.1, 1.12], [0.03, 0.98], [0.17, 1.03], [0.38, 1.01], [0.6, 0.96],
      [0.73, 1.03], [0.8, 0.93], [0.7, 0.84], [0.5, 0.82], [0.66, 0.77], [0.62, 0.7], [0.32, 0.65], [0.17, 0.57], [0.1, 0.38], [0.09, 0.18], [0.12, 0]];
    b.push(x, y, z, ry);
    if (o.rz) b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(o.rz));
    b.extrude(0, 0, 0, P.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.14 * s, { c: c, m: M.wood, ao: 0.1, bevel: 0.01 });
    // a mane of back-swept fins down the neck
    [[[-0.15, 0.28], [-0.33, 0.38], [-0.14, 0.45]], [[-0.11, 0.54], [-0.3, 0.66], [-0.08, 0.66]]].forEach(function (f) {
      b.extrude(0, 0, 0, f.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.07 * s, { c: c, m: M.wood, ao: 0.05, bevel: 0.005 });
    });
    [1, -1].forEach(function (sd) {
      b.ball(0.37 * s, 0.93 * s, sd * 0.075 * s, 0.034 * s, { c: 'bone', m: M.paint, ao: 0, detail: 0 });
      b.box(0.34 * s, 0.97 * s, sd * 0.07 * s, 0.15 * s, 0.03 * s, 0.03 * s, { c: c, m: M.wood, bevel: 0.004, rz: -0.25 });
    });
    b.box(0, 0, 0, 0.32 * s, 0.07 * s, 0.2 * s, { c: c, m: M.wood, bevel: 0.01 });
    b.pop();
  }

  // a lean-to roof of slates laid one by one, rising from the low eave (xl, yl) to the high edge (xh, yh), z from za
  // to zb; each row is a step. skip(x, z) leaves a slate out (where the chimney stands).
  var monoGeo = {};
  function armorerMono(b, xl, yl, xh, yh, za, zb, rows, skip) {
    var M = KIT.M, PAL = KIT.PAL, U = KIT.util, dx = xh - xl, dy = yh - yl, run = Math.hypot(dx, dy), ang = Math.atan2(dy, Math.abs(dx)), sg = Math.sign(dx);
    var rl = run / rows, pw = 0.4, th = 0.07, n = Math.ceil((zb - za) / pw), len = rl * 1.35, key = [len, pw].map(function (v) { return v.toFixed(3); }).join(',');
    var g = monoGeo[key];
    if (!g) {
      g = KIT.geo.chamferBox(len, th, pw * 0.95, 0.02); var p = g.attributes.position, cc = [];
      for (var i = 0; i < p.count; i++) { var t = sg > 0 ? (len / 2 - p.getX(i)) / len : (p.getX(i) + len / 2) / len, v = U.lerp(0.62, 1, Math.pow(U.smooth(0, 0.75, t), 0.8)); cc.push(v, v, v * 0.98); }
      g.setAttribute('color', new T.Float32BufferAttribute(cc, 3)); monoGeo[key] = g;
    }
    var MOSS = new T.Color('#7f8657');
    for (var r = 0; r < rows; r++) {
      (function (r) {
        b.unit(function () {
          var tc = (r + 0.5) * rl + rl * 0.175, xc = xl + sg * tc * Math.cos(ang), yc = yl + tc * Math.sin(ang) + (r % 2) * 0.01;
          for (var i = 0; i <= n; i++) {
            var zc = za + (i + (r % 2) * 0.5) * pw; if (zc > zb - pw * 0.3) break; zc = Math.max(za + pw / 2, Math.min(zb - pw / 2, zc));
            if (skip && skip(xc, zc)) continue;
            var col = U.col(b.pick(PAL.slate)), q = b.r();
            if (q < 0.12) col.offsetHSL(0.006, -0.04, -0.035); else if (q < 0.22) col.offsetHSL(-0.006, 0.01, 0.025); else if (q < 0.26) col.lerp(MOSS, 0.15);
            b.addGeo(g, { x: xc, y: yc - th * 0.3, z: zc + b.j(0.015), rz: sg * (ang + 0.06) + b.j(0.01), ry: b.j(0.015), c: col, m: M.tile, ao: 0.3, jit: 0.02, vary: 0.04 });
          }
        });
      })(r);
    }
  }

  // a gable boarded in vertical planks, each cut to the roof line: base centre (cx, y0) at depth z, half width half,
  // peak rise above the base; o.skip(x, y0, y1) leaves a plank (or the part of it) out
  function armorerGable(b, cx, y0, z, half, rise, o) {
    o = o || {}; var M = KIT.M, n = Math.round(half * 2 / 0.27), pw = half * 2 / n, tones = ['#2b2927', '#33302c', '#262422', '#3a3530', '#2f2c29'];
    function hh(x) { return rise * (1 - Math.abs(x) / half) - 0.03; }
    for (var i = 0; i < n; i++) {
      var a = -half + i * pw + 0.012, c = -half + (i + 1) * pw - 0.012, pts = [[a, 0], [c, 0], [c, hh(c)]];
      if (a < 0 && c > 0) pts.push([0, hh(0)]);
      pts.push([a, hh(a)]);
      if (Math.max(hh(a), hh(c)) < 0.06) continue;
      b.extrude(cx, y0, z, pts, 0.08, { c: b.pick(tones), m: M.wood, bevel: 0.006, ao: 0.25, jit: 0.02 });
    }
  }

  // a round shield facing +z: o.c field, o.c2 the paint, o.design 'cross' | 'band' | 'quarters' | 'plain'
  function armorerShield(b, x, y, z, r, o) {
    o = o || {}; var M = KIT.M, f = o.c || 'ink', c2 = o.c2 || (f === 'bone' ? 'ink' : 'bone'), seg = 24;
    b.push(x, y, z, o.ry || 0);
    if (o.rx) b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(o.rx));
    b.cyl(0, 0, -0.04, r, 0.06, { c: f, m: M.paint, seg: seg, rx: Math.PI / 2, flat: true, jit: 0.015 });
    if (o.design === 'cross') {
      b.box(0, -r * 0.9, 0.026, r * 0.2, r * 1.8, 0.012, { c: c2, m: M.paint, bevel: 0.003, ao: 0, jit: 0 });
      b.box(0, -r * 0.1, 0.026, r * 1.8, r * 0.2, 0.016, { c: c2, m: M.paint, bevel: 0.003, ao: 0, jit: 0 });
    } else if (o.design === 'band') {
      b.box(0, -r * 0.94, 0.026, r * 0.42, r * 1.88, 0.012, { c: c2, m: M.paint, bevel: 0.003, ao: 0, jit: 0 });
    } else if (o.design === 'quarters') {
      [0, Math.PI].forEach(function (a0) { var pts = [[0, 0]]; for (var k = 0; k <= 6; k++) { var a = a0 + k / 6 * Math.PI / 2; pts.push([Math.cos(a) * r * 0.96, Math.sin(a) * r * 0.96]); } b.extrude(0, 0, 0.026, pts, 0.012, { c: c2, m: M.paint, ao: 0, jit: 0 }); });
    }
    b.cyl(0, 0, -0.045, r + 0.025, 0.075, { c: 'iron', m: M.metal, seg: seg, rx: Math.PI / 2, open: true });
    b.ball(0, 0, 0.03, r * 0.2, { c: 'steel', m: M.metal, sz: 0.65, detail: 1 });
    for (var k = 0; k < 8; k++) { var a = (k + 0.5) / 8 * Math.PI * 2; b.ball(Math.cos(a) * r * 0.87, Math.sin(a) * r * 0.87, 0.036, r * 0.035, { c: 'iron', m: M.metal, detail: 0, ao: 0 }); }
    b.pop();
  }

  // a two-stone plinth under each stand; returns the height of its top
  function armorerPlinth(b, w) {
    var M = KIT.M;
    b.box(0, 0, 0, w + 0.24, 0.13, w + 0.24, { c: b.stoneC('stoneDark'), m: M.stone, bevel: 0.04 });
    b.box(0, 0.13, 0, w, 0.27, w, { c: b.stoneC('sandstone'), m: M.stone, bevel: 0.05 });
    b.box(0, 0.4, 0, w - 0.1, 0.035, w - 0.1, { c: 'wood', m: M.wood, bevel: 0.008, ao: 0.15, jit: 0.03 });
    return 0.435;
  }
  // a carved stave post: square, with bands cut round it and a knot at the top
  function armorerPost(b, x, y, z, h, o) {
    o = o || {}; var M = KIT.M, r = o.r || 0.055;
    b.post(x, y, z, r, h, { c: o.c || 'woodDark' });
    (o.bands || [0.18, 0.5, 0.82]).forEach(function (f) { b.box(x, y + h * f, z, r * 2.5, 0.05, r * 2.5, { c: 'beam', m: M.wood, bevel: 0.012 }); });
    if (o.knot !== false) b.ball(x, y + h + 0.02, z, r * 1.35, { c: o.c || 'woodDark', m: M.wood, detail: 1, sy: 0.9 });
  }
  // the cross foot of a stand
  function armorerFoot(b, y, s) { var M = KIT.M; s = s || 0.5; b.box(0, y, 0, s, 0.06, 0.1, { c: 'beam', m: M.wood, bevel: 0.015 }); b.box(0, y, 0, 0.1, 0.06, s, { c: 'beam', m: M.wood, bevel: 0.015 }); }

  // ------------------------------------------------------------ the six stands (each in its own frame, facing +z)
  var LEATHER = '#5a3f2b', LEATHER_D = '#3a2c22';
  function standBelt(b) {
    var M = KIT.M, y = armorerPlinth(b, 0.72);
    armorerFoot(b, y, 0.56);
    b.post(0, y, 0, 0.045, 0.9, { c: 'woodDark' });
    var hy = y + 0.86;
    // a wooden form of a man's trunk
    b.lathe(0, hy, 0, [[0.04, 0], [0.16, 0.02], [0.185, 0.12], [0.165, 0.3], [0.19, 0.46], [0.205, 0.56], [0.15, 0.64], [0.06, 0.68], [0.01, 0.7]], { c: 'woodLight', m: M.wood, seg: 14, sx: 1.2, sz: 0.78 });
    b.cyl(0, hy + 0.66, 0, 0.045, 0.07, { c: 'woodLight', m: M.wood, seg: 8 });
    b.ball(0, hy + 0.75, 0, 0.065, { c: 'woodLight', m: M.wood, detail: 1, sy: 0.7 });
    // the belt: a broad band of leather, studs, a brass buckle, and an apron of studded straps hanging before
    b.cyl(0, hy + 0.07, 0, 0.198, 0.13, { c: LEATHER, m: M.wood, seg: 18, sx: 1.22, sz: 0.8 });
    for (var k = 0; k < 9; k++) { var a = Math.PI * (0.12 + k * 0.095); b.ball(Math.cos(a) * 0.243, hy + 0.135, Math.sin(a) * 0.16, 0.013, { c: 'brass', m: M.gold, detail: 0, ao: 0 }); }
    b.box(0, hy + 0.08, 0.16, 0.13, 0.11, 0.03, { c: 'brass', m: M.gold, bevel: 0.008 });
    b.box(0, hy + 0.105, 0.172, 0.065, 0.055, 0.012, { c: LEATHER_D, m: M.wood, bevel: 0, ao: 0 });
    [-0.12, -0.06, 0, 0.06, 0.12].forEach(function (sx, i) {
      var zf = 0.16 * Math.sqrt(Math.max(0, 1 - Math.pow(sx / 0.243, 2))) + 0.018, L = 0.42 - Math.abs(sx) * 0.6;
      b.push(sx, hy + 0.08, zf, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(0.1).multiply(new T.Matrix4().makeRotationZ(sx * 0.6)));
      b.box(0, -L, 0, 0.042, L, 0.016, { c: LEATHER, m: M.wood, bevel: 0.004, ao: 0.2 });
      [0.12, 0.24, 0.36].forEach(function (f) { if (f < L - 0.03) b.ball(0, -f, 0.01, 0.014, { c: 'brass', m: M.gold, detail: 0, ao: 0 }); });
      b.box(0, -L - 0.045, 0, 0.05, 0.05, 0.02, { c: 'brass', m: M.gold, bevel: 0.005 });
      b.pop();
    });
    // a white girdle knotted at the left hip, its two tails hanging
    b.ball(0.22, hy + 0.06, 0.07, 0.05, { c: 'bone', m: M.cloth, detail: 1, sy: 0.75 });
    b.box(0.215, hy - 0.32, 0.09, 0.05, 0.36, 0.014, { c: 'bone', m: M.cloth, rz: 0.08, bevel: 0.003 });
    b.box(0.25, hy - 0.26, 0.07, 0.045, 0.3, 0.014, { c: '#efebe4', m: M.cloth, rz: -0.05, bevel: 0.003 });
    // a dagger in its sheath at the right hip
    b.beam([-0.245, hy + 0.05, 0.04], [-0.31, hy - 0.4, 0.1], 0.028, { c: LEATHER_D, m: M.wood, r2: 0.016 });
    b.ball(-0.31, hy - 0.41, 0.1, 0.03, { c: 'iron', m: M.metal, detail: 0 });
    b.beam([-0.245, hy + 0.05, 0.04], [-0.235, hy + 0.2, 0.03], 0.014, { c: '#3a2a20', m: M.wood, round: true, seg: 6 });
    b.box(-0.245, hy + 0.04, 0.04, 0.12, 0.025, 0.03, { c: 'brass', m: M.gold, bevel: 0.005 });
    b.ball(-0.235, hy + 0.215, 0.03, 0.025, { c: 'brass', m: M.gold, detail: 0 });
  }
  function standBreastplate(b) {
    var M = KIT.M, y = armorerPlinth(b, 0.72);
    armorerFoot(b, y, 0.56);
    b.post(0, y, 0, 0.045, 0.85, { c: 'woodDark' });
    var ty = y + 0.82;
    // faulds: three hoops of steel below the plate
    for (var k = 0; k < 3; k++) b.cyl(0, ty - 0.07 * (k + 1), 0, 0.192 + k * 0.016, 0.075, { r2: 0.18 + k * 0.016, c: 'steel', m: M.metal, seg: 18, sx: 1.25, sz: 0.88 });
    b.lathe(0, ty, 0, [[0.17, 0], [0.185, 0.08], [0.18, 0.22], [0.205, 0.38], [0.225, 0.5], [0.2, 0.58], [0.12, 0.64], [0.07, 0.66], [0.01, 0.67]], { c: 'steel', m: M.metal, seg: 18, sx: 1.25, sz: 0.85 });
    b.beam([0, ty + 0.08, 0.157], [0, ty + 0.52, 0.19], 0.012, { c: 'steel', m: M.metal, round: true, seg: 5 });
    // the gorget at the neck, and pauldrons of three lames on each shoulder
    b.cyl(0, ty + 0.6, 0, 0.1, 0.08, { c: 'iron', m: M.metal, seg: 14, r2: 0.085 });
    b.cyl(0, ty + 0.58, 0, 0.16, 0.04, { c: 'steel', m: M.metal, seg: 16, sx: 1.2, sz: 0.85, r2: 0.12 });
    [-1, 1].forEach(function (sd) {
      b.lathe(sd * 0.29, ty + 0.5, 0, [[0.13, 0], [0.125, 0.06], [0.09, 0.11], [0.01, 0.135]], { c: 'steel', m: M.metal, seg: 12, rz: -sd * 0.6 });
      [0, 1].forEach(function (q) { b.cyl(sd * (0.34 + q * 0.03), ty + 0.4 - q * 0.08, 0, 0.115 - q * 0.01, 0.07, { c: 'steel', m: M.metal, seg: 12, rz: -sd * 0.55, open: false, r2: 0.105 - q * 0.01 }); });
      // a leather strap over the shoulder
      b.box(sd * 0.13, ty + 0.5, 0.09, 0.05, 0.16, 0.02, { c: LEATHER, m: M.wood, rx: 0.5, bevel: 0.004 });
    });
    // a small bone cross inlaid on the breast
    b.box(0, ty + 0.24, 0.168, 0.035, 0.2, 0.012, { c: 'bone', m: M.paint, rx: 0.14, bevel: 0.003, ao: 0, jit: 0 });
    b.box(0, ty + 0.345, 0.183, 0.13, 0.035, 0.012, { c: 'bone', m: M.paint, rx: 0.14, bevel: 0.003, ao: 0, jit: 0 });
    // brass rivets round the neck and arms
    for (var i = 0; i < 6; i++) { var a = Math.PI * (0.2 + i * 0.12); b.ball(Math.cos(a) * 0.2, ty + 0.6, Math.sin(a) * 0.135, 0.012, { c: 'brass', m: M.gold, detail: 0, ao: 0 }); }
  }
  function standBoots(b) {
    var M = KIT.M, y = armorerPlinth(b, 0.8);
    // a little planked chest to stand them on, with iron at the corners
    b.box(0, y, 0, 0.74, 0.52, 0.5, { c: 'wood', m: M.wood, bevel: 0.02 });
    [0.17, 0.34].forEach(function (f) { b.box(0, y + f, 0.252, 0.72, 0.012, 0.01, { c: '#3a3028', m: M.dark, bevel: 0, ao: 0 }); });
    [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) { b.box(sx * 0.35, y, sz * 0.23, 0.06, 0.53, 0.06, { c: 'iron', m: M.metal, bevel: 0.01 }); }); });
    b.box(0, y + 0.52, 0, 0.78, 0.04, 0.54, { c: 'woodLight', m: M.wood, bevel: 0.012 });
    var sy = y + 0.56;
    [-1, 1].forEach(function (sd) {
      b.push(sd * 0.16, sy, -0.03, sd * 0.16);
      b.box(0, 0, 0.04, 0.15, 0.04, 0.34, { c: '#2a211d', m: M.wood, bevel: 0.015 });
      b.box(0, 0.04, 0.02, 0.14, 0.11, 0.3, { c: LEATHER_D, m: M.wood, bevel: 0.04 });
      b.ball(0, 0.075, 0.16, 0.07, { c: LEATHER_D, m: M.wood, detail: 1, sy: 0.75 });
      b.cyl(0, 0.08, -0.06, 0.078, 0.24, { c: '#43342a', m: M.wood, seg: 10 });
      // greave, knee cop and the strap that holds them
      b.lathe(0, 0.22, -0.06, [[0.084, 0], [0.094, 0.1], [0.09, 0.26], [0.08, 0.4], [0.06, 0.42]], { c: 'steel', m: M.metal, seg: 12 });
      b.ball(0, 0.66, -0.055, 0.07, { c: 'steel', m: M.metal, detail: 1, sy: 0.8, sz: 0.9 });
      b.cyl(0, 0.4, -0.06, 0.098, 0.035, { c: LEATHER, m: M.wood, seg: 12 });
      // sabaton lames over the instep
      b.box(0, 0.12, 0.05, 0.155, 0.04, 0.11, { c: 'steel', m: M.metal, rx: 0.3, bevel: 0.01 });
      b.box(0, 0.09, 0.14, 0.15, 0.04, 0.09, { c: 'steel', m: M.metal, rx: 0.45, bevel: 0.01 });
      b.pop();
    });
    // a folded white cloth beside them
    b.box(0.0, sy, -0.2, 0.28, 0.06, 0.12, { c: 'bone', m: M.cloth, bevel: 0.02 });
  }
  function standShield(b) {
    var M = KIT.M, y = armorerPlinth(b, 0.8);
    // an easel: two legs, a back prop, a ledge to stand the shield on
    [-1, 1].forEach(function (sd) { b.beam([sd * 0.36, y, 0.12], [sd * 0.22, y + 1.32, -0.12], 0.035, { c: 'woodDark' }); });
    b.beam([0, y, -0.5], [0, y + 1.2, -0.13], 0.03, { c: 'woodDark' });
    b.beam([-0.3, y + 1.0, -0.07], [0.3, y + 1.0, -0.07], 0.03, { c: 'woodDark' });
    b.box(0, y + 0.1, 0.12, 0.84, 0.06, 0.16, { c: 'woodLight', m: M.wood, bevel: 0.012 });
    b.box(0, y + 0.16, 0.19, 0.84, 0.07, 0.03, { c: 'wood', m: M.wood, bevel: 0.008 });
    var sc = y + 0.17 + 0.62;
    armorerShield(b, 0, sc, 0.06, 0.62, { c: 'bone', c2: 'ink', design: 'cross', rx: -0.16 });
    // the flaming darts it has put out: three arrows stuck fast, each in a scorch
    b.push(0, sc, 0.06, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(-0.16));
    [[0.3, 0.24, 0.3, 0.2], [-0.34, 0.06, -0.35, 0.1], [0.16, -0.36, 0.15, -0.25]].forEach(function (a) {
      var d = V3(a[2], a[3], 1).normalize(), P0 = V3(a[0], a[1], 0.02), E = P0.clone().addScaledVector(d, 0.52), F = P0.clone().addScaledVector(d, 0.4);
      b.cyl(a[0], a[1], 0.034, 0.06, 0.004, { c: '#2a2724', m: M.paint, rx: Math.PI / 2, seg: 10, ao: 0, jit: 0 });
      b.beam(P0.toArray(), E.toArray(), 0.011, { c: 'woodLight', m: M.wood, round: true, seg: 5 });
      b.beam(F.toArray(), E.toArray(), 0.004, { r2: 0.035, c: 'bone', m: M.cloth, bevel: 0 });
      b.beam(F.toArray(), E.toArray(), 0.004, { r2: 0.035, c: '#e6e3dc', m: M.cloth, bevel: 0, roll: Math.PI / 2 });
    });
    b.pop();
  }
  function standHelmet(b) {
    var M = KIT.M, y = armorerPlinth(b, 0.66);
    armorerPost(b, 0, y, 0, 0.82, { bands: [0.15, 0.45, 0.75], knot: false });
    var hc = y + 1.01;
    b.cyl(0, hc - 0.2, 0, 0.06, 0.12, { c: 'woodLight', m: M.wood, seg: 8 });
    b.ball(0, hc - 0.02, 0, 0.15, { c: 'woodLight', m: M.wood, detail: 2, smooth: true, sy: 1.15 });
    // the mail aventail hanging from the rim, round the back and sides
    b.push(0, hc, 0, 0, 1.2);
    hc = 0;
    var pts = []; for (var k = 4; k >= 0; k--) pts.push(new T.Vector2(0.168 + k * 0.012 + (k % 2) * 0.008, -k * 0.035));
    b.addGeo(new T.LatheGeometry(pts, 14, Math.PI * 0.6, Math.PI * 0.8), { x: 0, y: hc - 0.035, z: 0, c: '#6c7175', m: M.metal, bucket: 'cloth', ao: 0.25, jit: 0.02, vary: 0.1 });
    // a crest of white horsehair from brow to nape
    b.box(0, hc + 0.27, -0.01, 0.035, 0.05, 0.3, { c: 'iron', m: M.metal, bevel: 0.008 });
    for (var q = 0; q < 7; q++) { var a2 = Math.PI * (0.08 + q * 0.14), cr = 0.2; b.ball(0, hc + 0.05 + Math.sin(a2) * cr * 1.25, Math.cos(a2) * cr - 0.02, 0.055 - Math.abs(q - 3) * 0.004, { c: q % 2 ? 'bone' : '#efebe4', m: M.cloth, detail: 1, sx: 0.55, sy: 1.1 }); }
    // cheek guards
    [-1, 1].forEach(function (sd) { b.box(sd * 0.15, hc - 0.22, 0.05, 0.03, 0.2, 0.13, { c: 'steel', m: M.metal, rz: sd * 0.12, bevel: 0.01 }); });
    // the bowl of the helm, its brow band, the bands over the crown and the spectacle guard
    b.lathe(0, hc - 0.02, 0, [[0.158, 0], [0.162, 0.05], [0.152, 0.13], [0.125, 0.2], [0.08, 0.255], [0.03, 0.28], [0.005, 0.285]], { c: 'steel', m: M.metal, seg: 20 });
    b.cyl(0, hc - 0.04, 0, 0.168, 0.06, { c: 'iron', m: M.metal, seg: 20 });
    [0, Math.PI / 2].forEach(function (ry) { b.addGeo(new T.TorusGeometry(0.164, 0.013, 4, 16, Math.PI), { x: 0, y: hc - 0.005, z: 0, ry: ry, sy: 1.66, c: 'iron', m: M.metal, ao: 0 }); });
    b.ball(0, hc + 0.27, 0, 0.026, { c: 'brass', m: M.gold, detail: 1 });
    for (var i = 0; i < 10; i++) { var a = i / 10 * Math.PI * 2; b.ball(Math.cos(a) * 0.17, hc - 0.01, Math.sin(a) * 0.17, 0.011, { c: 'brass', m: M.gold, detail: 0, ao: 0 }); }
    [-1, 1].forEach(function (sd) { b.addGeo(new T.TorusGeometry(0.045, 0.012, 4, 12), { x: sd * 0.056, y: hc - 0.085, z: 0.15, c: 'steel', m: M.metal, ao: 0 }); });
    b.box(0, hc - 0.2, 0.158, 0.032, 0.17, 0.022, { c: 'steel', m: M.metal, bevel: 0.006 });
    b.box(0, hc - 0.055, 0.162, 0.25, 0.03, 0.02, { c: 'steel', m: M.metal, bevel: 0.006 });
    b.pop();
  }
  function standSword(b) {
    var M = KIT.M, y = armorerPlinth(b, 0.72);
    // the sword stands point down in a cut block, hilt high
    b.box(0, y, 0, 0.52, 0.34, 0.44, { c: b.stoneC('sandstone'), m: M.stone, bevel: 0.05 });
    b.box(0, y + 0.34, 0, 0.42, 0.05, 0.34, { c: b.stoneC('stone'), m: M.stone, bevel: 0.02 });
    b.box(0, y + 0.39, 0, 0.12, 0.012, 0.05, { c: '#1f1e1c', m: M.dark, bevel: 0, ao: 0, jit: 0 });
    var py = y + 0.39 - 0.08 + 1.62;
    b.sword(0, py, 0, { rz: Math.PI, len: 1.37, bw: 0.07 });
    b.ball(0, py + 0.01, 0, 0.06, { c: 'brass', m: M.gold, detail: 1, sx: 1.4, sy: 0.8 });
    // a white ribbon tied below the guard
    [-1, 1].forEach(function (sd) { b.box(sd * 0.06, py - 0.58, 0.03, 0.035, 0.32, 0.008, { c: sd < 0 ? 'bone' : '#efebe4', m: M.cloth, rz: sd * 0.1, bevel: 0.002 }); });
    b.ball(0, py - 0.27, 0.0, 0.04, { c: 'bone', m: M.cloth, detail: 1, sz: 0.7 });
  }
  // the Word, open on a carved lectern
  function lecternWord(b) {
    var M = KIT.M;
    b.box(0, 0, 0, 0.42, 0.06, 0.36, { c: 'beam', m: M.wood, bevel: 0.015 });
    armorerPost(b, 0, 0.06, 0, 0.9, { r: 0.045, bands: [0.2, 0.7], knot: false });
    b.push(0, 0.98, 0, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(0.42));
    b.box(0, -0.03, 0, 0.56, 0.04, 0.42, { c: 'woodDark', m: M.wood, bevel: 0.012 });
    b.box(0, -0.04, 0.2, 0.58, 0.07, 0.04, { c: 'woodDark', m: M.wood, bevel: 0.01 });
    b.box(0, 0.01, 0, 0.48, 0.025, 0.34, { c: 'ink', m: M.cloth, bevel: 0.006 });
    [-1, 1].forEach(function (sd) { b.box(sd * 0.112, 0.035, 0, 0.215, 0.03, 0.31, { c: sd < 0 ? 'bone' : '#efebe4', m: M.paint, rz: -sd * 0.07, bevel: 0.006 }); });
    b.box(0.04, 0.065, 0.12, 0.012, 0.004, 0.24, { c: 'ember', m: M.cloth, bevel: 0, ao: 0 });
    b.pop();
  }

  // a bone cross laid on a hanging banner (as b.banner hangs it: bar at (x, y, z), w x h, turned ry), piece by piece so
  // it follows the folds of the cloth
  function armorerBannerCross(b, x, y, z, w, h, ry, cy, ch, cw) {
    var M = KIT.M, seed = b.seed, wave = function (px, ly) { var t = -ly / h; return Math.sin(px * 3.1 + t * 2.0 + seed) * 0.05 * t; };
    b.push(x, y, z, ry);
    var th = 0.13, n = 7, seg = ch / n;
    for (var i = 0; i < n; i++) { var ly = cy + ch / 2 - (i + 0.5) * seg; [1, -1].forEach(function (f) { b.box(0, ly - seg / 2, wave(0, ly) + f * 0.016, th, seg + 0.004, 0.008, { c: 'bone', m: M.cloth, bucket: 'cloth', bevel: 0, ao: 0, jit: 0 }); }); }
    var nx = 5, sx = cw / nx, hy = cy + ch * 0.18;
    for (var k = 0; k < nx; k++) { var px = -cw / 2 + (k + 0.5) * sx; if (Math.abs(px) < th / 2) continue; [1, -1].forEach(function (f) { b.box(px, hy - th / 2, wave(px, hy) + f * 0.019, sx + 0.004, th, 0.008, { c: 'bone', m: M.cloth, bucket: 'cloth', bevel: 0, ao: 0, jit: 0 }); }); }
    b.pop();
  }

  // a mail shirt hung from a wooden hanger at (x, y, z), facing +z
  function armorerMail(b, x, y, z, o) {
    o = o || {}; var M = KIT.M, mc = o.c || '#6c7175';
    b.push(x, y, z, o.ry || 0);
    b.beam([-0.34, 0, 0], [0.34, 0, 0], 0.022, { c: 'woodLight', m: M.wood, round: true, seg: 6 });
    var pts = []; for (var k = 0; k <= 14; k++) pts.push([0.2 + (k < 4 ? (4 - k) * 0.012 : 0) + (k % 2) * 0.007, k * 0.056]);
    pts.push([0.15, 0.8], [0.06, 0.83]);
    b.lathe(0, -0.86, 0, pts, { c: mc, m: M.metal, seg: 16, sx: 1.25, sz: 0.55, vary: 0.12 });
    [-1, 1].forEach(function (sd) { b.beam([sd * 0.22, -0.1, 0], [sd * 0.4, -0.5, 0.02], 0.075, { r2: 0.06, c: mc, m: M.metal, round: true, seg: 7 }); });
    b.box(0, -0.06, 0.1, 0.18, 0.08, 0.02, { c: LEATHER, m: M.wood, bevel: 0.005 });
    b.pop();
  }

  // crossed bargeboards ending in two dragon heads, on a gable whose span runs along local x and whose face looks
  // toward local +z; the frame is set by the caller (push). half: half the span, rise, over: the eave overhang
  function armorerCrossed(b, eave, half, rise, over, hs) {
    var tanS = rise / half;
    [-1, 1].forEach(function (sg) {
      var E = [-sg * (half + over), eave - over * tanS + 0.12], P = [0, eave + rise + 0.12], L = Math.hypot(P[0] - E[0], P[1] - E[1]), ux = (P[0] - E[0]) / L, uy = (P[1] - E[1]) / L;
      var zz = sg > 0 ? 0 : -0.11, end = [P[0] + ux * 0.62, P[1] + uy * 0.62];
      b.beam([E[0], E[1], zz], [end[0], end[1], zz], 0.13, { c: 'beam', r2: 0.05 });
      armorerHead(b, end[0] - ux * 0.06, end[1] - 0.04, zz, sg > 0 ? 0 : Math.PI, hs || 1.2, { rz: -0.25 });
    });
  }

  KIT.defineBuild('armorer', {
    name: 'Armorer', size: 'middle', need: 38,
    line: 'The armorer\'s hall with a dragon-headed gable over its door, and the whole armor of God on six stands before it: belt, breastplate, shoes, shield, helmet and sword.',
    r: 14, flat: [18, 13], ground: 'cobble', path: [[1.2, 14.5], [0.85, 7.2]],
    frameY: 3.4, frameR: 12, glowAt: [0.75, 9.6, 3.3],
    trees: [{ x: -10.6, z: -5.6, kind: 'pine', h: 7.8 }, { x: -7.6, z: -9.0, kind: 'pine', h: 6.2 }, { x: 10.2, z: -5.6, kind: 'birch', h: 6.0 }, { x: 12.2, z: 2.0, kind: 'round', h: 4.6 }],
    bushes: [{ x: 9.8, z: 6.6, r: 0.9, flowers: '#f3f1ec' }, { x: -8.8, z: 6.4, r: 0.8 }, { x: 11.8, z: -1.4, r: 0.7 }],
    perches: [{ x: -3.85, y: 8.85, z: -3.2, ry: -Math.PI / 2 }, { x: 3.75, y: 8.85, z: -3.2, ry: Math.PI / 2 }, { x: 0.75, y: 8.1, z: 1.6, ry: 0 }, { x: -6.55, y: 6.7, z: -5.6, ry: 0.4 }],
    build: function (b) {
      var M = KIT.M;
      // the hall: x -4.8..4.8, z -6.4..-0.8, ridge along x; a gabled wing comes forward over the door, x -1.6..2.8,
      // to z 2.2, its upper floor overhanging the front by 0.35
      var cx = 0.0, cz = -3.6, W = 9.6, D = 5.6, Tk = 0.6, base = 0.55, H1 = 3.0, jet = 0.35;
      var x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2, top1 = base + H1;
      var wx = 0.6, Ww = 4.4, wx0 = wx - Ww / 2, wx1 = wx + Ww / 2, wz0 = z1, wz1 = 2.2, Dw = wz1 - wz0, wzc = (wz0 + wz1) / 2, wzf = wz1 + jet;
      var u0 = top1 + 0.22, H2 = 1.8, eave = u0 + H2, rise = 3.0, riseW = 2.3, over = 0.55, overX = 0.5;
      // the forge lean-to against the hall's left end: x -7.9..-4.8, z -5.8..-1.4; its roof falls from 3.45 to 2.35
      var lx0 = -7.9, lz0 = -5.8, lz1 = -1.4, lk = 1.1 / (x0 - lx0), roofY = function (x) { return 2.35 + (x - lx0) * lk; };
      var chx = -6.7, chz = -6.0, chw = 1.3, chd = 1.2;
      b.push(0.15, 0, 0.4, 0);

      b.part('Footings');
      b.unit(function () {
        b.box(cx, -0.08, cz, W + 1.0, 0.36, D + 1.0, { c: 'stoneDark', bevel: 0.08 });
        b.box(wx, -0.08, wzc + 0.3, Ww + 1.0, 0.36, Dw + 0.6, { c: 'stoneDark', bevel: 0.08 });
        b.box((lx0 + x0) / 2 - 0.2, -0.08, (lz0 + lz1) / 2 + 0.05, x0 - lx0 + 0.7, 0.3, lz1 - lz0 + 0.8, { c: 'stoneDark', bevel: 0.08 });
        b.box(chx, -0.08, chz - 0.1, chw + 0.4, 0.3, chd + 0.4, { c: 'stoneDark', bevel: 0.06 });
      });
      b.unit(function () {
        b.box(cx, 0.28, cz, W + 0.55, 0.27, D + 0.55, { c: 'stone', bevel: 0.07 });
        b.box(wx, 0.28, wzc + 0.15, Ww + 0.55, 0.27, Dw + 0.3, { c: 'stone', bevel: 0.07 });
        // the lean-to's floor of big flags
        for (var fx = lx0 - 0.1; fx < x0 - 0.2; fx += 0.78) for (var fz = lz0 + 0.1; fz < lz1 + 0.2; fz += 0.72) b.box(fx + 0.38, 0.02, fz + 0.35, 0.72 + b.j(0.04), 0.16, 0.66, { c: b.stoneC('stoneCool', 0.2), m: M.stone, bevel: 0.03, ry: b.j(0.03) });
      });

      b.part('Stone hall');
      var nC = 9, ch = H1 / nC;
      var hallHoles = [
        { side: 'front', at: -3.2, w: 1.0, y0: base + 1.0, y1: base + 2.35 },
        { side: 'front', at: 3.8, w: 1.0, y0: base + 1.0, y1: base + 2.35 },
        { side: 'left', at: 0.2, w: 1.25, y1: base + 2.3 },
        { side: 'right', at: 0.0, w: 1.0, y0: base + 1.0, y1: base + 2.35 },
        { side: 'back', at: -1.5, w: 1.0, y0: base + 1.0, y1: base + 2.35 }
      ];
      var wingHoles = [
        { side: 'front', at: 0, w: 1.9, y1: base + 2.75 },
        { side: 'left', at: 0.3, w: 1.0, y0: base + 1.0, y1: base + 2.35 },
        { side: 'right', at: -0.3, w: 1.0, y0: base + 1.0, y1: base + 2.35 }
      ];
      for (var k = 0; k < nC; k++) {
        (function (y) {
          b.unit(function () {
            b.stoneBox(cx, cz, W, D, y, ch, Tk, { pal: 'stone', course: ch, len: 0.66, holes: hallHoles });
            b.stoneBox(wx, wzc, Ww, Dw, y, ch, Tk, { pal: 'stone', course: ch, len: 0.66, holes: wingHoles });
          });
        })(base + k * ch);
      }

      b.part('Forge lean-to');
      var leanCourse = function (y0) {
        b.unit(function () {
          b.stoneWall(lx0, lz0, x0, lz0, y0, 1.1, 0.45, { pal: 'stone', course: 0.367, len: 0.62, hole: function (t, yy) { var xx = lx0 + t; return yy > roofY(xx) - 0.1 || (xx > chx - chw / 2 + 0.05 && xx < chx + chw / 2 - 0.05); } });
          if (y0 < 0.5) b.stoneWall(lx0, lz0 + 0.225, lx0, lz1, y0, 1.1, 0.42, { pal: 'stone', course: 0.367, len: 0.62 });
          b.stoneBox(chx, chz, chw, chd, y0, 1.1, 0.42, { pal: 'stone', course: 0.367, len: 0.55 });
        });
      };
      leanCourse(0.18); leanCourse(1.28); leanCourse(2.38);
      b.unit(function () {
        var py = roofY(lx0) - 0.14;
        armorerPost(b, lx0, 0.18, lz1, py - 0.18, { r: 0.08, bands: [0.12, 0.62], knot: false });
        armorerPost(b, lx0, 1.28, (lz0 + lz1) / 2, py - 1.28, { r: 0.07, bands: [0.5], knot: false });
        b.box(lx0, py, (lz0 + lz1) / 2 + 0.15, 0.2, 0.14, lz1 - lz0 + 0.75, { c: 'beam', m: M.wood, bevel: 0.03 });
        for (var rz = lz0 + 0.5; rz <= lz1 + 0.3; rz += 0.85) b.beam([lx0 - 0.35, roofY(lx0 - 0.35) - 0.08, rz], [x0, roofY(x0) - 0.08, rz], 0.06, { c: 'beam', r2: 0.05 });
        b.box(x0 - 0.12, roofY(x0) - 0.25, (lz0 + lz1) / 2 + 0.15, 0.2, 0.2, lz1 - lz0 + 0.75, { c: 'beam', m: M.wood, bevel: 0.03 });
        b.beam([lx0, py - 0.7, lz1], [lx0 + 0.7, roofY(lx0 + 0.7) - 0.1, lz1], 0.05, { c: 'beam' });
      });

      b.part('Doorway and windows');
      b.unit(function () {
        b.archDoor(wx, base, wz1, 1.6, 2.6, { depth: Tk + 0.15, keyC: 'sandstone', frameStone: 'sandstone', doorC: 'woodDark' });
        b.archDoor(x0, base, cz + 0.2, 1.0, 2.15, { ry: -Math.PI / 2, depth: Tk + 0.15, frameStone: 'sandstone', doorC: 'woodDark' });
      });
      b.unit(function () {
        [-3.2, 3.8].forEach(function (x) { b.window(x, base + 1.05, z1 - 0.1, 0.8, 1.2, { arch: true, sillC: 'sandstone' }); });
        b.window(wx0 + 0.1, base + 1.05, wzc + 0.3, 0.8, 1.2, { arch: true, ry: -Math.PI / 2, sillC: 'sandstone' });
        b.window(wx1 - 0.1, base + 1.05, wzc + 0.3, 0.8, 1.2, { arch: true, ry: Math.PI / 2, sillC: 'sandstone' });
        b.window(x1 - 0.1, base + 1.05, cz, 0.8, 1.2, { arch: true, ry: Math.PI / 2, sillC: 'sandstone' });
      });

      b.part('Upper floor');
      b.unit(function () {
        // joists run out under the wing's overhang, on carved brackets
        for (var i = 0; i <= 7; i++) { var x = wx0 + 0.25 + i * (Ww - 0.5) / 7; b.box(x, top1, wz1 - 0.3, 0.2, 0.22, 1.4, { c: 'beam', m: M.wood, bevel: 0.03 }); }
        [wx0 + 0.55, wx1 - 0.55].forEach(function (x2) { b.beam([x2, top1 - 0.75, wz1 + 0.02], [x2, top1 + 0.02, wzf + 0.05], 0.08, { c: 'beam' }); });
      });
      b.unit(function () {
        b.box(cx, u0 - 0.05, cz, W + 0.15, 0.12, D + 0.1, { c: 'beam', m: M.wood, bevel: 0.02 });
        b.box(wx, u0 - 0.05, (z1 + wzf) / 2, Ww + 0.15, 0.12, wzf - z1 + 0.1, { c: 'beam', m: M.wood, bevel: 0.02 });
      });
      var win = function (t, fl) { return { t: t, w: 0.72, y0: 0.55, y1: 1.45, shutters: '#1f1e1c', flowers: fl }; };
      // the far walls first, the front of the wing last
      b.timberWall(x1, z0, x0, z0, u0, { h: H2, post: 1.4 });
      b.timberWall(x1, z1, x1, z0, u0, { h: H2, post: 1.4, windows: [win(2.8)] });
      b.timberWall(x0, z0, x0, z1, u0, { h: H2, post: 1.4 });
      b.timberWall(wx1, z1, x1, z1, u0, { h: H2, post: 1.5, windows: [win(1.0, '#e6e3dc')] });
      b.timberWall(x0, z1, wx0, z1, u0, { h: H2, post: 1.5, windows: [win(0.8, '#f3f1ec')] });
      b.timberWall(wx1, wzf, wx1, z1, u0, { h: H2, post: 1.6, windows: [win(0.84)] });
      b.timberWall(wx0, z1, wx0, wzf, u0, { h: H2, post: 1.6, windows: [win(2.5, '#f3f1ec')] });
      b.timberWall(wx0, wzf, wx1, wzf, u0, { h: H2, post: 1.45, windows: [win(0.73, '#f3f1ec'), win(3.67, '#e6e3dc')] });

      b.part('Gables');
      b.unit(function () { armorerGable(b, wx, eave, wzf + 0.02, Ww / 2, riseW); });
      b.unit(function () {
        // the kingpost and collar, two shuttered lights, and the great shield of the house
        b.beam([wx, eave, wzf], [wx, eave + riseW - 0.15, wzf], 0.09, { c: 'beam' });
        var cy2 = eave + 1.75, hw = (Ww / 2) * (1 - 1.75 / riseW) - 0.05;
        b.beam([wx - hw, cy2, wzf + 0.02], [wx + hw, cy2, wzf + 0.02], 0.08, { c: 'beam' });
        b.beam([wx0 + 0.1, eave + 0.06, wzf + 0.04], [wx1 - 0.1, eave + 0.06, wzf + 0.04], 0.1, { c: 'beam' });
        [-1.3, 1.3].forEach(function (dx) { b.window(wx + dx, eave + 0.24, wzf + 0.1, 0.36, 0.38, { shutters: '#efebe4', sillC: 'beam', sillM: M.wood, lintelC: 'beam' }); });
        armorerShield(b, wx, eave + 0.98, wzf + 0.15, 0.66, { c: 'bone', c2: 'ink', design: 'cross' });
      });
      b.unit(function () { [x0 + 0.08, x1 - 0.08].forEach(function (x) { b.gableEnd(x, eave, cz, D - 0.12, rise - 0.1, 0.2, { c: 'plaster' }); }); });
      b.unit(function () {
        [[x0 - 0.04, -1], [x1 + 0.04, 1]].forEach(function (g) {
          var x = g[0];
          b.beam([x, eave + 0.02, cz - D / 2 + 0.12], [x, eave + rise - 0.12, cz], 0.08, { c: 'beam' });
          b.beam([x, eave + 0.02, cz + D / 2 - 0.12], [x, eave + rise - 0.12, cz], 0.08, { c: 'beam' });
          b.beam([x, eave + 0.06, cz - D / 2 + 0.1], [x, eave + 0.06, cz + D / 2 - 0.1], 0.09, { c: 'beam' });
          b.beam([x, eave + 0.1, cz], [x, eave + rise - 0.2, cz], 0.08, { c: 'beam' });
          b.beam([x, eave + 1.75, cz - 1.15], [x, eave + 1.75, cz + 1.15], 0.07, { c: 'beam' });
          b.window(x + g[1] * 0.02, eave + 0.45, cz - 0.95, 0.42, 0.6, { ry: g[1] * Math.PI / 2, shutters: '#efebe4', sillC: 'beam', sillM: M.wood, lintelC: 'beam' });
          b.window(x + g[1] * 0.02, eave + 0.45, cz + 0.95, 0.42, 0.6, { ry: g[1] * Math.PI / 2, shutters: '#efebe4', sillC: 'beam', sillM: M.wood, lintelC: 'beam' });
        });
      });

      b.part('Roof');
      b.gableRoof(cx, eave, cz, W, D, rise, { m: 'slate', over: over, overX: overX, rows: 8 });
      b.part('Wing roof');
      // the wing's ridge runs back until it meets the hall's front slope
      var zMeet = z1 - riseW / (rise / (D / 2)) - 0.15, Lw = wzf + overX - zMeet, rczw = wzf + overX - Lw / 2;
      b.gableRoof(wx, eave, rczw, Lw - 2 * overX, Ww, riseW, { ry: Math.PI / 2, m: 'slate', over: 0.5, overX: overX, rows: 7 });

      b.part('Dormer');
      b.unit(function () {
        var tanW = riseW / (Ww / 2), xf = wx0 + 0.34, yb = eave + (xf - wx0) * tanW, dzc = 0.95, dw = 1.7, top = yb + 1.15, dr = 0.55, xb = wx - 0.5;
        b.box((xf + xb) / 2, yb - 0.3, dzc, xb - xf, top - yb + 0.3, dw, { c: 'plaster', m: M.plaster, bevel: 0.01 });
        [-1, 1].forEach(function (sd) {
          b.beam([xf - 0.05, yb - 0.05, dzc + sd * (dw / 2 - 0.06)], [xf - 0.05, top, dzc + sd * (dw / 2 - 0.06)], 0.07, { c: 'beam' });
          b.beam([xf, top - 0.06, dzc + sd * (dw / 2 + 0.02)], [xb, top - 0.06, dzc + sd * (dw / 2 + 0.02)], 0.06, { c: 'beam' });
        });
        b.beam([xf - 0.06, top - 0.04, dzc - dw / 2], [xf - 0.06, top - 0.04, dzc + dw / 2], 0.08, { c: 'beam' });
        b.window(xf - 0.05, yb + 0.22, dzc, 0.52, 0.66, { ry: -Math.PI / 2, shutters: '#efebe4', sillC: 'beam', sillM: M.wood, lintelC: 'beam' });
        b.gableEnd(xf - 0.02, top, dzc, dw + 0.04, dr, 0.1, { c: 'plaster' });
        [-1, 1].forEach(function (sd) { b.beam([xf - 0.1, top - 0.08, dzc + sd * (dw / 2 + 0.16)], [xf - 0.1, top + dr + 0.06, dzc], 0.06, { c: 'beam' }); });
        b.gableRoof((xf - 0.2 + wx - 0.1) / 2, top, dzc, wx - 0.1 - (xf - 0.2), dw, dr, { m: 'slate', over: 0.16, overX: 0.0, rows: 3, rowsAsUnits: false });
      });

      b.part('Dragon heads');
      b.unit(function () { b.push(wx, 0, wzf + overX - 0.06, 0); armorerCrossed(b, eave, Ww / 2, riseW, 0.5, 1.3); b.pop(); });
      b.unit(function () {
        b.push(x0 - overX + 0.06, 0, cz, -Math.PI / 2); armorerCrossed(b, eave, D / 2, rise, over); b.pop();
        b.push(x1 + overX - 0.06, 0, cz, Math.PI / 2); armorerCrossed(b, eave, D / 2, rise, over); b.pop();
      });

      b.part('Smoke louvre');
      b.unit(function () {
        var lx = -2.6, ly = eave + rise - 0.1;
        [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) { b.post(lx + sx * 0.42, ly, cz + sz * 0.38, 0.05, 0.75, { c: 'beam' }); }); });
        for (var k2 = 0; k2 < 4; k2++) [-1, 1].forEach(function (sz) { b.box(lx, ly + 0.15 + k2 * 0.15, cz + sz * 0.4, 0.8, 0.05, 0.04, { c: 'woodDark', m: M.wood, rx: -sz * 0.5, bevel: 0.008 }); });
        b.gableRoof(lx, ly + 0.75, cz, 1.0, 0.9, 0.45, { m: 'slate', over: 0.14, rows: 2, rowsAsUnits: false, overX: 0.1 });
        b.flag(lx, ly + 1.22, cz, 1.0, 0.95, 0.36, { c: 'ember', pennant: true, emblem: 'none', ry: -0.4 });
      });

      b.part('Forge roof');
      armorerMono(b, lx0 - 0.4, roofY(lx0 - 0.4), x0, roofY(x0), lz0 - 0.32, lz1 + 0.38, 5, function (x, z) { return Math.abs(x - chx) < chw / 2 + 0.1 && Math.abs(z - chz) < chd / 2 + 0.12; });
      b.unit(function () { b.box(x0 - 0.06, roofY(x0) + 0.02, (lz0 + lz1) / 2 + 0.03, 0.14, 0.1, lz1 - lz0 + 0.72, { c: 'iron', m: M.metal, bevel: 0.02 }); });

      b.part('Chimney');
      b.unit(function () { b.stoneBox(chx, chz, chw, chd, 3.48, 1.47, 0.42, { pal: 'stone', course: 0.367, len: 0.55 }); });
      b.unit(function () {
        b.stoneBox(chx, chz, chw - 0.1, chd - 0.1, 4.95, 1.1, 0.42, { pal: 'stone', course: 0.367, len: 0.55 });
        b.box(chx, 6.05, chz, chw + 0.16, 0.2, chd + 0.16, { c: 'sandstone', bevel: 0.05 });
        [-0.28, 0.28].forEach(function (dx) { b.cyl(chx + dx, 6.25, chz, 0.17, 0.4, { c: 'stoneDark', m: M.stone, seg: 8, r2: 0.14 }); b.cyl(chx + dx, 6.6, chz, 0.12, 0.05, { c: '#1f1e1c', m: M.dark, seg: 8 }); });
      });

      b.part('Paved court');
      var cA = 5.7, cB = 5.1, cZ = wz1 - 0.2, fz0 = wz1 + 0.15, cN = 4;
      var inCourt = function (x, z) { var dx = Math.abs(x - wx) / cA, dz = Math.abs(z - cZ) / cB; return z > fz0 && Math.pow(dx, cN) + Math.pow(dz, cN) < 1; };
      var rowsZ = []; for (var zz = fz0 + 0.27; zz < cZ + cB - 0.1; zz += 0.56) rowsZ.push(zz);
      [0, 1, 2].forEach(function (g) {
        b.unit(function () {
          rowsZ.forEach(function (rz, ri) {
            if (Math.floor(ri * 3 / rowsZ.length) !== g) return;
            var x = wx - cA - 0.3 + b.r() * 0.4;
            while (x < wx + cA) {
              var w = 0.55 + b.r() * 0.35, xm = x + w / 2;
              if (inCourt(xm, rz) && inCourt(x + 0.08, rz) && inCourt(x + w - 0.08, rz)) b.box(xm, -0.02, rz + b.j(0.03), w - 0.06, 0.12, 0.5, { ry: b.j(0.03), c: b.stoneC(b.chance(0.78) ? 'sandstone' : 'stone', 1.2), m: M.stone, bevel: 0.035, ao: 0.1, jit: 0.03 });
              x += w;
            }
          });
        });
      });
      b.unit(function () {
        // a curb of long stones round the court, laid at even spacing along its rounded-square edge
        var prev = null, acc = 0.3;
        for (var a = 0; a <= Math.PI + 1e-6; a += 0.003) {
          var ca = Math.cos(a), sa = Math.max(0, Math.sin(a));
          var x = wx + (cA + 0.1) * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / cN), z = cZ + (cB + 0.1) * Math.pow(sa, 2 / cN);
          if (prev) {
            acc += Math.hypot(x - prev[0], z - prev[1]);
            if (acc >= 0.52 && z > fz0 + 0.12) { acc = 0; b.box(x, -0.04, z, 0.5, 0.17 + b.j(0.012), 0.24, { ry: Math.atan2(-(z - prev[1]), x - prev[0]), c: b.stoneC('sandstone', 0.5), m: M.stone, bevel: 0.04 }); }
          }
          prev = [x, z];
        }
      });

      // the six stands, in an open horseshoe before the door, each turned toward the court's mouth
      var SX = [-4.3, -2.85, -1.4, 1.4, 2.85, 4.3], SZ = [5.0, 4.85, 4.75, 4.75, 4.85, 5.0];
      var stands = [['Belt of truth', standBelt], ['Breastplate of righteousness', standBreastplate], ['Shoes of peace', standBoots], ['Shield of faith', standShield], ['Helmet of salvation', standHelmet], ['Sword of the Spirit', standSword]];
      var spot = function (i) { var x = wx + SX[i], z = SZ[i]; return { x: x, z: z, ry: Math.atan2((wx - 3.5) - x, 15 - z) }; };
      stands.forEach(function (s, i) {
        b.part(s[0]);
        b.unit(function () {
          var p = spot(i);
          b.push(p.x, 0.1, p.z, p.ry, 1.1); s[1](b); b.pop();
          if (i === 5) { b.push(p.x + 0.74, 0.1, p.z + 0.22, p.ry + 0.1); lecternWord(b); b.pop(); }
        });
      });

      b.part('Banner');
      var bpx = wx + 4.85, bpz = 2.75;
      b.unit(function () {
        b.box(bpx, 0, bpz, 0.6, 0.3, 0.6, { c: 'stone', bevel: 0.05 });
        armorerPost(b, bpx, 0.3, bpz, 4.8, { r: 0.08, bands: [0.1, 0.3, 0.55], knot: false });
        armorerHead(b, bpx, 5.1, bpz, -Math.PI / 2 - 0.3, 0.6, {});
        b.beam([bpx, 4.62, bpz - 0.05], [bpx, 4.62, bpz + 0.32], 0.04, { c: 'iron', m: M.metal });
        b.banner(bpx, 4.6, bpz + 0.2, 1.2, 2.75, { c: 'ink', emblem: 'none', tail: 'swallow', band: 'ember', bandAt: 0.74, bandH: 0.05, trim: 'iron', ry: -0.3 });
        armorerBannerCross(b, bpx, 4.6, bpz + 0.2, 1.2, 2.75, -0.3, -1.0, 0.95, 0.64);
      });

      b.part('Sign and torches');
      b.unit(function () {
        // a helm hung from an iron arm off the wing's corner, for a sign
        var sz = wz1 - 0.55, sy = base + 2.85, ax = wx0;
        b.beam([ax, sy, sz], [ax - 0.95, sy, sz], 0.035, { c: 'iron', m: M.metal });
        b.beam([ax, sy - 0.45, sz], [ax - 0.6, sy, sz], 0.025, { c: 'iron', m: M.metal });
        b.beam([ax - 0.85, sy, sz], [ax - 0.85, sy - 0.3, sz], 0.012, { c: 'iron', m: M.metal, round: true, seg: 4 });
        b.lathe(ax - 0.85, sy - 0.62, sz, [[0.2, 0], [0.205, 0.07], [0.19, 0.17], [0.15, 0.26], [0.09, 0.32], [0.01, 0.34]], { c: 'steel', m: M.metal, seg: 16 });
        b.cyl(ax - 0.85, sy - 0.64, sz, 0.215, 0.07, { c: 'iron', m: M.metal, seg: 16 });
        b.box(ax - 0.85, sy - 0.82, sz + 0.21, 0.04, 0.2, 0.03, { c: 'steel', m: M.metal, bevel: 0.006 });
        [-1.3, 1.3].forEach(function (dx) { b.torch(wx + dx, base + 1.8, wz1 + 0.02, { s: 0.6 }); });
      });

      b.part('Wall shields');
      b.unit(function () {
        var cols = [['ink', 'bone', 'cross'], ['bone', 'ink', 'quarters'], ['inkGrey', 'bone', 'plain'], ['ink', 'bone', 'band']];
        [0.7, 2.1, 3.5, 4.9].forEach(function (t, i) { var c = cols[i]; armorerShield(b, x0 - 0.13, u0 + 0.95, z0 + t, 0.37, { ry: -Math.PI / 2, c: c[0], c2: c[1], design: c[2] }); });
        armorerShield(b, -2.4, u0 + 0.95, z1 + 0.13, 0.4, { c: 'bone', c2: 'ink', design: 'band' });
      });

      b.part('Forge');
      b.unit(function () {
        // the hearth of stone before the chimney, a fire on it, and a hood to draw the smoke
        var hz = chz + chd / 2 + 0.4;
        b.box(chx, 0.18, hz, 1.5, 0.75, 0.8, { c: 'stoneDark', bevel: 0.04 });
        [-0.5, 0, 0.5].forEach(function (dx) { b.box(chx + dx, 0.2, hz + 0.41, 0.47, 0.34, 0.05, { c: b.stoneC('stone'), m: M.stone, bevel: 0.03 }); if (dx < 0.4) b.box(chx + dx + 0.25, 0.56, hz + 0.41, 0.46, 0.34, 0.05, { c: b.stoneC('stone'), m: M.stone, bevel: 0.03 }); });
        b.box(chx, 0.93, hz, 1.6, 0.1, 0.9, { c: 'sandstone', bevel: 0.03 });
        b.box(chx, 1.0, hz, 0.7, 0.06, 0.45, { c: '#1f1e1c', m: M.dark, bevel: 0.02, ao: 0 });
        b.embers(chx, 1.05, hz, 0.3);
        b.flame(chx, 1.03, hz, 0.65, { i: 1.2 });
        b.box(chx, 1.85, hz - 0.02, 1.5, 0.95, 0.82, { taper: 0.62, taperD: 1.0, c: 'stoneDark', m: M.stone, bevel: 0 });
        b.box(chx, 1.8, hz + 0.4, 1.56, 0.1, 0.06, { c: 'iron', m: M.metal, bevel: 0.01 });
        b.push(chx + 0.78, 0.62, hz, 0);
        b.post(0.5, -0.44, 0, 0.04, 0.44, { c: 'wood' }); b.post(0.85, -0.44, 0, 0.04, 0.44, { c: 'wood' });
        b.extrude(0, 0, 0, [[0, 0.02], [0.92, -0.02], [0.92, 0.3], [0, 0.12]], 0.48, { c: LEATHER, m: M.cloth, bevel: 0.01 });
        b.box(0.48, 0.25, 0, 0.96, 0.04, 0.52, { c: 'woodLight', m: M.wood, rz: 0.1, bevel: 0.01 });
        b.beam([0.82, 0.32, 0], [0.78, 1.15, 0.22], 0.025, { c: 'wood', round: true });
        b.cyl(-0.1, 0.06, 0, 0.04, 0.2, { c: 'iron', m: M.metal, rz: Math.PI / 2, seg: 6 });
        b.pop();
      });
      b.unit(function () {
        b.anvil(-6.15, 0, -0.45, { ry: 0.2 });
        b.lathe(-7.2, 0.18, -3.4, [[0.01, 0], [0.38, 0], [0.42, 0.45], [0.01, 0.44]], { c: 'woodLight', m: M.wood, seg: 14, flat: true });
        b.cyl(-7.2, 0.55, -3.4, 0.43, 0.06, { c: 'iron', m: M.metal, seg: 14, open: true });
        b.cyl(-7.2, 0.55, -3.4, 0.38, 0.02, { c: '#3c4a52', m: M.water, seg: 14 });
        for (var k3 = 0; k3 < 9; k3++) b.ball(-7.35 + b.j(0.2), 0.25 + b.r() * 0.12, -4.25 + b.j(0.2), 0.12, { c: '#24221f', m: M.dark, detail: 0 });
        b.box(x0 - 0.06, 1.55, -1.97, 0.06, 0.08, 0.95, { c: 'beam', m: M.wood, bevel: 0.01 });
        [-2.3, -2.08, -1.86, -1.64].forEach(function (tz, i) {
          if (i % 2 === 0) { b.beam([x0 - 0.12, 1.55, tz], [x0 - 0.14, 1.0, tz + 0.05], 0.012, { c: 'iron', m: M.metal, round: true, seg: 4 }); b.beam([x0 - 0.12, 1.55, tz + 0.06], [x0 - 0.14, 1.0, tz + 0.02], 0.012, { c: 'iron', m: M.metal, round: true, seg: 4 }); }
          else { b.beam([x0 - 0.12, 1.55, tz], [x0 - 0.12, 1.15, tz], 0.018, { c: 'wood', round: true, seg: 5 }); b.box(x0 - 0.12, 1.08, tz, 0.1, 0.08, 0.16, { c: 'iron', m: M.metal, bevel: 0.01 }); }
        });
        b.bucket(-5.25, 0.18, -4.45);
      });

      b.part('Mail and scouring');
      var mx = 6.6, mz = 0.4;
      b.unit(function () {
        // a frame where the mail hangs to air
        [-1.05, 1.05].forEach(function (dx) { armorerPost(b, mx + dx, 0, mz, 2.15, { r: 0.07, bands: [0.2, 0.8] }); });
        b.beam([mx - 1.2, 2.05, mz], [mx + 1.2, 2.05, mz], 0.06, { c: 'woodDark' });
        armorerMail(b, mx - 0.5, 1.98, mz + 0.05, {});
        armorerMail(b, mx + 0.5, 1.98, mz + 0.05, { c: '#7a7f83' });
        b.beam([mx - 1.05, 1.86, mz], [mx - 1.32, 1.92, mz], 0.022, { c: 'wood', round: true, seg: 5 });
        b.lathe(mx - 1.3, 1.58, mz, [[0.12, 0], [0.13, 0.12], [0.11, 0.22], [0.01, 0.28]], { c: '#6c7175', m: M.metal, seg: 12, vary: 0.12 });
      });
      var px = 7.3, pz = 3.0;
      b.unit(function () {
        // a barrel of sand on a cradle, turned by a crank to scour the mail bright
        [-0.62, 0.62].forEach(function (dx) { b.beam([px + dx, 0, pz - 0.45], [px + dx, 0.95, pz], 0.05, { c: 'wood' }); b.beam([px + dx, 0, pz + 0.45], [px + dx, 0.95, pz], 0.05, { c: 'wood' }); b.box(px + dx, 0, pz, 0.12, 0.08, 1.0, { c: 'woodDark', m: M.wood }); });
        b.push(px, 0.95 - 0.34, pz, 0); b.barrel(0, 0, 0, { lie: true, h: 1.0, r: 0.34 }); b.pop();
        b.beam([px - 0.75, 0.95, pz], [px + 0.8, 0.95, pz], 0.03, { c: 'iron', m: M.metal, round: true, seg: 6 });
        b.beam([px + 0.8, 0.95, pz], [px + 0.8, 0.95, pz + 0.28], 0.025, { c: 'iron', m: M.metal });
        b.beam([px + 0.8, 0.95, pz + 0.28], [px + 1.04, 0.95, pz + 0.28], 0.025, { c: 'wood', round: true, seg: 6 });
        b.sack(px - 0.3, 0, pz + 0.85, 0.48, { c: 'canvasDusty' });
      });
      b.unit(function () {
        // the bench where the plates are fitted and riveted
        var tx = 7.25, tz = 5.9;
        b.table(tx, tz, 1.6, 0.8, { ry: -0.3 });
        b.push(tx, 0.81, tz, -0.3);
        b.lathe(-0.45, 0.0, 0.05, [[0.16, 0.24], [0.17, 0.18], [0.15, 0.08], [0.1, 0.02], [0.01, 0]], { c: 'steel', m: M.metal, seg: 14 });
        b.box(0.25, 0, 0.0, 0.5, 0.06, 0.34, { c: 'steel', m: M.metal, bevel: 0.04 });
        b.beam([0.55, 0.03, 0.25], [0.8, 0.03, 0.05], 0.018, { c: 'wood', round: true, seg: 5 }); b.box(0.82, 0, 0.03, 0.08, 0.07, 0.14, { c: 'iron', m: M.metal, ry: 0.7, bevel: 0.01 });
        b.lathe(0.05, 0, 0.28, [[0.01, 0], [0.09, 0], [0.11, 0.05], [0.01, 0.04]], { c: 'wood', m: M.wood, seg: 10 });
        b.pop();
        b.barrel(tx + 1.2, 0, tz - 0.5, { h: 0.85 });
      });

      b.part('Stores');
      b.unit(function () {
        b.barrel(lx0 - 0.6, 0, lz1 + 0.6, {}); b.barrel(lx0 - 1.2, 0, lz1 + 1.1, { h: 0.82 });
        b.crate(lx0 - 0.3, 0, lz1 + 1.5, 0.7, { ry: 0.3 }); b.crate(lx0 - 0.25, 0.7, lz1 + 1.45, 0.55, { ry: 0.1 });
        b.woodpile(lx0 - 0.75, -3.6, { n: 3, len: 1.8, ry: Math.PI / 2 });
      });
      b.unit(function () {
        // a cart come with plates from the smelter
        b.cart(-6.0, 2.6, { ry: 0.75, load: function () { b.crate(0, 0.71, -0.4, 0.62, { ry: 0.1 }); b.box(0.15, 0.71, 0.45, 0.6, 0.08, 0.5, { c: 'steel', m: M.metal, bevel: 0.02 }); b.box(0.1, 0.79, 0.42, 0.55, 0.06, 0.45, { c: '#8b939a', m: M.metal, bevel: 0.02, ry: 0.2 }); } });
        b.sack(-4.3, 0, 3.4, 0.45); b.sack(-3.95, 0, 3.75, 0.4);
      });
      b.unit(function () {
        // a bench of helms waiting for their straps, and a quench tub by the anvil
        b.bench(-3.55, -0.35, 1.7, {});
        [-0.55, 0.0, 0.55].forEach(function (dx, i) { b.lathe(-3.55 + dx, 0.45, -0.35, [[0.15, 0], [0.155, 0.06], [0.14, 0.15], [0.1, 0.22], [0.05, 0.26], [0.01, 0.27]], { c: i === 1 ? '#8b939a' : 'steel', m: M.metal, seg: 14 }); b.cyl(-3.55 + dx, 0.45, -0.35, 0.16, 0.04, { c: 'iron', m: M.metal, seg: 14 }); });
        armorerShield(b, -4.55, 0.42, -0.5, 0.38, { c: 'ink', c2: 'bone', design: 'quarters', rx: -0.3, ry: 0.4 });
        b.lathe(-7.05, 0, -0.75, [[0.01, 0], [0.34, 0], [0.38, 0.42], [0.01, 0.41]], { c: 'woodLight', m: M.wood, seg: 14, flat: true });
        b.cyl(-7.05, 0.36, -0.75, 0.39, 0.06, { c: 'iron', m: M.metal, seg: 14, open: true });
        b.cyl(-7.05, 0.36, -0.75, 0.34, 0.02, { c: '#3c4a52', m: M.water, seg: 14 });
        b.beam([-6.85, 0.4, -0.75], [-6.55, 0.9, -0.55], 0.012, { c: 'iron', m: M.metal, round: true, seg: 4 });
      });

      b.part('Ivy and flowers');
      b.unit(function () {
        b.ivy([[wx1 - 0.2, 0.5, wz1 + 0.32], [wx1 - 0.4, 1.8, wz1 + 0.32], [wx1 - 0.1, 3.0, wz1 + 0.32]], [0, 0, 1], { density: 6, spread: 0.5 });
        b.ivy([[x0 + 0.3, 0.5, z1 + 0.32], [x0 + 0.6, 1.7, z1 + 0.32], [x0 + 0.4, 2.8, z1 + 0.32]], [0, 0, 1], { density: 5, spread: 0.45 });
        b.ivy([[lx0 - 0.12, 0.3, lz1], [lx0 - 0.12, 1.2, lz1 + 0.05], [lx0 - 0.12, 2.0, lz1]], [-1, 0, 0], { density: 4, spread: 0.35 });
        b.bush(wx0 - 0.6, z1 + 0.5, 0.5, { flowers: '#f3f1ec', n: 2 });
        b.bush(wx1 + 0.6, z1 + 0.5, 0.5, { flowers: '#e6e0d2', n: 2 });
      });

      b.life(function () {
        b.figure(-6.3, -1.03, { role: 'smith', pose: 'hammer', ry: 0.2, c: '#6e5a44' });
        // the knight keeps vigil in the gap between the stands, on the way to the door; the people stand clear of the
        // line from the viewer to each stand
        b.figure(wx - 0.45, 6.3, { role: 'knight', pose: 'vigil', ry: -0.35 });
        b.figure(wx + 3.57, 4.55, { role: 'villager', pose: 'armorerPolish', ry: -1.18, c: '#5c5e62' });
        b.figure(wx - 5.05, 4.3, { role: 'smith', pose: 'talk', ry: 0.86, c: '#3b3a38', hair: '#8a5a33' });
        b.figure(wx - 1.95, 6.85, { role: 'child', pose: 'cheer', ry: -0.25 });
        b.figure(-7.7, 1.0, { role: 'villager', pose: 'carry', ry: 1.0 });
        b.figure(wx + 5.4, 6.45, { role: 'soldier', pose: 'spear', ry: -0.45 });
        b.figure(px + 1.42, pz + 0.26, { role: 'villager', pose: 'armorerCrank', ry: -Math.PI / 2, c: '#8a857c' });
      });
      b.life(function () {
        for (var i = 0; i < 11; i++) {
          var t = i / 10;
          b.ball(chx + 0.28 + t * t * 1.6 + Math.sin(i * 1.9) * 0.1, 6.7 + t * 3.1, chz - t * 0.6 + Math.cos(i * 1.3) * 0.1, 0.17 + t * 0.48, { c: i < 3 ? '#bfb9ae' : i < 7 ? '#cdc8be' : '#dcd8cf', m: M.cloth, ao: 0.05, detail: 1, smooth: true, vary: 0.02, sy: 0.85 });
        }
      });
      b.pop();
    }
  });
})();
