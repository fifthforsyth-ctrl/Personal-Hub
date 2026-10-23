// Dragon stables: a long stone stable of four tall stalls under a row of stone cross gables, each stall with a pair of
// plank doors open a different amount and straw inside, crossed barge boards carved into dragon heads, a hay hoist,
// a louvred cupola with a night-dragon weathervane, harness on hooks, a stone water trough and a fish store lean-to.
// Built footings first, the stall floors, the walls course by course, the stall frames and doors, the hayloft floor,
// the gables course by course, the slate roofs row by row, the cupola, then the yard, and last the dragons and people.
(function () {
  var T = THREE;

  // a point in the build's frame turned into a dragon's own frame (for o.look)
  function stablesLook(dx, dy, dz, ry, s, wx, wy, wz) {
    var x = wx - dx, y = wy - dy, z = wz - dz, c = Math.cos(-ry), sn = Math.sin(-ry);
    return [(x * c + z * sn) / s, y / s, (-x * sn + z * c) / s];
  }
  // a point beside a figure standing at (x, z) turned ry, from its own frame (lx, ly, lz)
  function stablesBy(x, z, ry, lx, ly, lz) { return [x + lx * Math.cos(ry) + lz * Math.sin(ry), ly, z - lx * Math.sin(ry) + lz * Math.cos(ry)]; }

  // a carved dragon-head finial, the profile in the local XY plane, snout toward local +x, neck foot at (x, y, z);
  // ry turns it, s is its height
  function stablesFinial(b, x, y, z, ry, s, o) {
    o = o || {}; var M = KIT.M, c = o.c || 'beam';
    var P = [[-0.1, 0], [-0.17, 0.28], [-0.15, 0.52], [-0.07, 0.74], [0.04, 0.9], [-0.04, 1.14], [0.14, 1.0], [0.24, 1.06], [0.36, 1.05], [0.5, 1.0], [0.74, 0.95],
      [0.85, 0.9], [0.8, 0.86], [0.6, 0.85], [0.42, 0.82], [0.62, 0.76], [0.71, 0.7], [0.64, 0.67], [0.4, 0.66], [0.22, 0.6], [0.12, 0.45], [0.09, 0.22], [0.12, 0]];
    b.push(x, y, z, ry);
    if (o.rz) b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(o.rz));
    b.extrude(0, 0, 0, P.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.14 * s, { c: c, m: M.wood, ao: 0.1, bevel: 0.01 });
    // a mane of back-swept fins down the neck, thinner than the head
    [[[-0.15, 0.36], [-0.34, 0.44], [-0.15, 0.52]], [[-0.1, 0.6], [-0.3, 0.72], [-0.06, 0.74]], [[0.0, 0.84], [-0.18, 1.0], [0.04, 0.92]]].forEach(function (f) {
      b.extrude(0, 0, 0, f.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.07 * s, { c: c, m: M.wood, ao: 0.05, bevel: 0.005 });
    });
    // the eye and the brow ridge, both faces
    [1, -1].forEach(function (sd) {
      b.ball(0.43 * s, 0.93 * s, sd * 0.075 * s, 0.035 * s, { c: 'bone', m: M.paint, ao: 0, detail: 0 });
      b.box(0.4 * s, 0.97 * s, sd * 0.07 * s, 0.16 * s, 0.03 * s, 0.03 * s, { c: c, m: M.wood, bevel: 0.004, rz: -0.25 });
    });
    b.box(0, 0, 0, 0.34 * s, 0.07 * s, 0.18 * s, { c: c, m: M.wood, bevel: 0.01 });
    b.pop();
  }

  // a stall door leaf: hinged on a vertical axis at (hx, y0, hz), w wide and h tall, sgn +1 for a leaf hung on the
  // left of its opening (closing toward +x), -1 on the right; th = how far it is open (0 closed, PI/2 square to the wall)
  function stablesLeaf(b, hx, y0, hz, sgn, th, w, h, o) {
    o = o || {}; var M = KIT.M, n = Math.max(3, Math.round(w / 0.26)), pw = w / n;
    var tones = ['#6a5845', '#5f4f3f', '#574839', '#6f5d49', '#655443'];
    b.push(hx, y0, hz, -sgn * th);
    for (var i = 0; i < n; i++) b.box(sgn * pw * (i + 0.5), 0, -0.035, pw - 0.022, h * (1 + b.j(0.012)), 0.07, { c: b.pick(tones), m: M.wood, bevel: 0.012, ao: 0.35 });
    var ly = [0.32, h - 0.46];
    ly.forEach(function (yy) { b.box(sgn * w / 2, yy, 0.025, w - 0.06, 0.15, 0.05, { c: 'woodDark', m: M.wood, bevel: 0.015 }); });
    b.beam([sgn * 0.14, ly[0] + 0.15, 0.03], [sgn * (w - 0.14), ly[1], 0.03], 0.05, { c: 'woodDark', r2: 0.022 });
    // iron strap hinges from the hinge side, with a curled end
    ly.forEach(function (yy) {
      b.box(sgn * w * 0.3, yy + 0.05, 0.057, w * 0.6, 0.05, 0.014, { c: 'iron', m: M.metal, bevel: 0.004 });
      b.ball(sgn * w * 0.6, yy + 0.075, 0.06, 0.03, { c: 'iron', m: M.metal, detail: 0 });
      b.cyl(0, yy + 0.02, 0.0, 0.03, 0.12, { c: 'iron', m: M.metal, seg: 6 });
    });
    if (o.ring !== false) b.addGeo(new T.TorusGeometry(0.06, 0.011, 4, 10), { x: sgn * (w - 0.16), y: h * 0.5, z: 0.06, c: 'iron', m: M.metal, ao: 0 });
    b.pop();
  }

  // a round shield on a wall facing +z, painted in quarters
  function stablesShield(b, x, y, z, c1, c2, s) {
    var M = KIT.M, r = 0.42 * s * 0.97, n = 8;
    b.shield(x, y, z, { kind: 'round', c: c1, s: s });
    [0, Math.PI].forEach(function (a0) {
      var pts = [[0, 0]]; for (var i = 0; i <= n; i++) { var a = a0 + Math.PI / 4 + i / n * Math.PI / 2; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      b.extrude(x, y, z + 0.053, pts, 0.006, { c: c2, m: M.paint, ao: 0, jit: 0.01 });
    });
  }

  // harness hung from a wooden peg on a wall facing +z: loops of strap, iron rings and a buckle
  function stablesHarness(b, x, y, z, o) {
    o = o || {}; var M = KIT.M, leather = o.c || '#2c231d';
    b.push(x, y, z, o.ry || 0);
    b.beam([0, 0, 0], [0, 0.05, 0.24], 0.03, { c: 'woodDark', round: true, seg: 6 });
    var loop = new T.TorusGeometry(0.2, 0.02, 4, 18);
    b.addGeo(loop, { x: 0, y: -0.31, z: 0.12, sy: 1.55, c: leather, m: M.wood, ao: 0.1, jit: 0.02 });
    b.addGeo(loop, { x: 0.05, y: -0.42, z: 0.1, sy: 1.95, sx: 0.8, rz: 0.12, c: '#3a2c22', m: M.wood, ao: 0.1, jit: 0.02 });
    b.addGeo(new T.TorusGeometry(0.07, 0.013, 4, 10), { x: -0.06, y: -0.7, z: 0.13, c: 'iron', m: M.metal, ao: 0 });
    b.addGeo(new T.TorusGeometry(0.05, 0.012, 4, 10), { x: 0.16, y: -0.55, z: 0.11, ry: 0.4, c: 'iron', m: M.metal, ao: 0 });
    b.box(0.17, -0.3, 0.13, 0.07, 0.09, 0.02, { c: 'iron', m: M.metal, bevel: 0.004 });
    b.beam([-0.1, -0.02, 0.14], [-0.14, -0.95, 0.12], 0.018, { c: leather, m: M.wood, r2: 0.008 });
    b.pop();
  }

  // a small fish, lying in the local XY plane, head at the origin, 0.4 long
  var FISH = [[0, 0], [0.08, 0.05], [0.24, 0.045], [0.32, 0.01], [0.4, 0.065], [0.39, -0.06], [0.32, -0.01], [0.24, -0.045], [0.08, -0.05]];
  function stablesFish(b, x, y, z, o) {
    o = o || {}; var M = KIT.M, s = o.s || 1;
    b.extrude(x, y, z, FISH.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.05 * s, { rx: o.rx || 0, ry: o.ry || 0, rz: o.rz || 0, c: b.pick(['#6f7b80', '#647076', '#7c868a']), m: M.metal, ao: 0.1, jit: 0.03, bevel: 0.01 });
  }
  // a wicker basket heaped with fish
  function stablesFishBasket(b, x, z, o) {
    o = o || {}; var M = KIT.M, r = o.r || 0.34, h = o.h || 0.42;
    b.lathe(x, 0, z, [[0.01, 0], [r * 0.8, 0], [r, h * 0.85], [r * 1.04, h], [r * 0.9, h * 0.98], [0.01, h * 0.8]], { c: '#8c7658', m: M.straw, seg: 14, flat: true });
    [0.25, 0.55, 0.85].forEach(function (f) { b.cyl(x, h * f - 0.02, z, r * (0.8 + 0.2 * f) + 0.012, 0.04, { c: '#6a5940', m: M.rope, seg: 14, open: true }); });
    for (var i = 0; i < (o.n || 7); i++) {
      var a = i / (o.n || 7) * Math.PI * 2 + b.j(0.4), d = r * (0.2 + b.r() * 0.4);
      stablesFish(b, x + Math.cos(a) * d - 0.12, h * 0.86 + b.r() * 0.08, z + Math.sin(a) * d, { ry: a + b.j(0.5), rx: Math.PI / 2 + b.j(0.4), s: 0.9 + b.r() * 0.3 });
    }
  }
  // a bale of hay bound with two cords
  var HAY = ['#bfa977', '#b7a06d', '#c6b183', '#ae9866'];
  function stablesBale(b, x, y, z, o) {
    o = o || {}; var M = KIT.M, w = o.w || 1.05, h = o.h || 0.5, d = o.d || 0.62, ry = o.ry || 0;
    b.box(x, y, z, w, h, d, { c: b.pick(HAY), m: M.straw, bevel: 0.09, ry: ry, ao: 0.35 });
    [-0.28, 0.28].forEach(function (f) { var c = Math.cos(ry), s = Math.sin(ry); b.box(x + f * w * c, y - 0.005, z - f * w * s, 0.04, h + 0.02, d + 0.02, { c: '#6a5940', m: M.rope, ry: ry, bevel: 0.01, ao: 0.2 }); });
  }
  // a pitchfork leaning on a wall
  function stablesFork(b, x, z, o) {
    o = o || {}; var M = KIT.M;
    b.push(x, 0, z, o.ry || 0);
    b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(o.lean === undefined ? -0.18 : o.lean));
    b.cyl(0, 0.35, 0, 0.022, 1.45, { c: 'woodLight', m: M.wood, seg: 6 });
    b.box(0, 0.28, 0, 0.26, 0.04, 0.03, { c: 'iron', m: M.metal, bevel: 0.005 });
    [-0.11, 0, 0.11].forEach(function (dx) { b.cone(dx, 0.3, 0, 0.012, 0.3, { c: 'iron', m: M.metal, seg: 4, rx: Math.PI }); });
    b.pop();
  }

  // A slate roof like gableRoof (ridge along x, eaves at y, rising h over span d), laid slate by slate, row by row,
  // where o.skip(x, side, u, pw) leaves out a slate hidden under a cross gable (u: how far in from the wall line its
  // top edge reaches).
  var SLATE_CACHE = {}, MOSS = new T.Color('#7f8657');
  function stablesSlate(pw, thick, len) {
    var key = [pw, thick, len].map(function (v) { return v.toFixed(3); }).join(',');
    if (SLATE_CACHE[key]) return SLATE_CACHE[key];
    var g = KIT.geo.chamferBox(pw * 0.96, thick * 0.7, len, Math.min(0.03, thick * 0.2));
    g.computeBoundingBox(); var p = g.attributes.position, za = g.boundingBox.min.z, zb = g.boundingBox.max.z, c = [];
    for (var i = 0; i < p.count; i++) { var t = (p.getZ(i) - za) / Math.max(1e-4, zb - za), v = 0.62 + 0.38 * Math.pow(KIT.util.smooth(0, 0.75, t), 0.8); c.push(v, v, v * 0.98); }
    g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
    return (SLATE_CACHE[key] = g);
  }
  function stablesRoof(b, x, y, z, w, d, h, o) {
    var M = KIT.M, PAL = KIT.PAL, U = KIT.util, over = o.over, half = d / 2 + over, slope = Math.atan2(h, d / 2), run = half / Math.cos(slope);
    var rows = o.rows, rl = run / rows, thick = 0.14, L = w + 2 * o.overX, pw = 0.4, dropY = -over * Math.tan(slope);
    b.push(x, y, z, 0);
    for (var r = 0; r < rows; r++) {
      b.unit(function () {
        [-1, 1].forEach(function (side) {
          var t0 = r * rl, t1 = (r + 1) * rl + rl * 0.35, len = t1 - t0;
          var cz = side * (half - (t0 + t1) / 2 * Math.cos(slope)), cy = dropY + (t0 + t1) / 2 * Math.sin(slope);
          var pg = stablesSlate(pw, thick, len), n = Math.ceil(L / pw), off = (r % 2) * pw * 0.5, uTop = t1 * Math.cos(slope) - over;
          b.push(0, cy + thick * 0.4 + (r % 2) * 0.01, cz, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(side * (slope + 0.06)));
          for (var i = 0; i <= n; i++) {
            var px = -L / 2 + i * pw + off - pw * 0.25; if (px > L / 2 + pw * 0.2) break; if (px < -L / 2 - pw * 0.2) continue;
            var pc = Math.max(-L / 2 + pw / 2, Math.min(L / 2 - pw / 2, px));
            if (o.skip && o.skip(pc + x, side, uTop, pw)) continue;
            var cc = U.col(b.pick(PAL.slate)), q = b.r();
            if (q < 0.12) cc.offsetHSL(0.006, -0.04, -0.035); else if (q < 0.22) cc.offsetHSL(-0.006, 0.01, 0.025); else if (q < 0.26) cc.lerp(MOSS, 0.15);
            b.addGeo(pg, { x: pc, y: -thick / 2 + b.j(0.008), z: b.j(0.02), rx: b.j(0.008), ry: b.j(0.015) + (side < 0 ? Math.PI : 0), rz: b.j(0.01), c: cc, m: M.tile, ao: 0.3, jit: 0.02, vary: 0.04 });
          }
          b.pop();
        });
      });
    }
    b.unit(function () { b.addGeo(KIT.geo.cyl(thick * 1.1, thick * 1.1, L + 0.1, 8, { flat: true }), { x: -L / 2 - 0.05, y: h + thick * 0.5, z: 0, rz: -Math.PI / 2, c: '#3f4347', m: M.tile }); });
    b.pop();
  }

  KIT.defineBuild('stables', {
    name: 'Dragon stables', size: 'middle', need: 42,
    line: 'A long stone stable of four tall-doored stalls under slate gables carved with dragon heads, where the night dragon crouches in the yard and a dawn dragon sleeps on the grass.',
    r: 14, flat: [20, 13], ground: 'cobble', path: [[1.8, 14.5], [1.2, 6.2]],
    frameY: 3.0, frameR: 12.5, glowAt: [1.65, 10.2, -2.2],
    trees: [{ x: -11.6, z: -5.4, kind: 'pine', h: 8.4 }, { x: -9.6, z: -8.2, kind: 'pine', h: 6.6 }, { x: 12.0, z: -4.2, kind: 'pine', h: 7.6 }, { x: 12.6, z: 3.6, kind: 'round', h: 5.2 }],
    bushes: [{ x: 10.4, z: 6.6, r: 0.9, flowers: '#f3f1ec' }, { x: -8.6, z: 7.4, r: 0.8 }, { x: -12.2, z: 1.2, r: 0.75 }],
    perches: [{ x: -4.6, y: 7.45, z: -2.2, ry: -Math.PI / 2 }, { x: 8.3, y: 4.35, z: 3.1, ry: -0.7 }, { x: -8.0, y: 3.4, z: -2.2, ry: -Math.PI / 2 + 0.3 }],
    build: function (b) {
      var M = KIT.M;
      // the stable: x -6.6..6.6, z -5.1..0.7; four stalls open to the front (+z), each under its own cross gable
      var cx = 0, cz = -2.2, W = 13.2, D = 5.8, Tk = 0.6, base = 0.25, H = 3.95;
      var x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2, eave = base + H;
      var stalls = [-4.85, -1.65, 1.65, 4.85], ow = 2.4, course = H / 11, oTop = base + course * 10, doorH = 2.9;
      var piers = [-3.25, 0, 3.25];
      var gW = 1.55, gRise = 1.55, gOver = 0.12; // cross gables: half-span, rise (45 degrees), side overhang

      b.part('Footings');
      b.unit(function () { b.box(cx, -0.1, cz, W + 0.9, 0.22, D + 0.9, { c: 'stoneDark', bevel: 0.06 }); });
      b.unit(function () { b.box(cx, 0.08, cz, W + 0.5, 0.17, D + 0.5, { c: 'stone', bevel: 0.05 }); });

      b.part('Stall floors');
      b.unit(function () {
        stalls.forEach(function (sx) {
          b.box(sx, base - 0.01, cz, 3.05, 0.07, D - 2 * Tk, { c: b.pick(HAY), m: M.straw, bevel: 0.03, ao: 0.4 });
          b.lathe(sx - 0.9, base, z0 + Tk + 0.8, [[0.01, 0], [0.8, 0], [0.7, 0.4], [0.3, 0.85], [0.01, 0.9]], { c: b.pick(HAY), m: M.straw, seg: 12 });
          for (var k = 0; k < 7; k++) b.ball(sx + b.j(1.2), base + 0.04, z1 - 0.6 - b.r() * 2.8, 0.22 + b.r() * 0.15, { c: b.pick(HAY), m: M.straw, sy: 0.35, detail: 1, ao: 0.3 });
        });
      });

      b.part('Stone walls');
      b.stoneBox(cx, cz, W, D, base, H, Tk, {
        pal: 'stone', course: course, len: 0.7,
        holes: stalls.map(function (sx) { return { side: 'front', at: sx, w: ow, y1: oTop }; }).concat(stalls.map(function (sx) { return { side: 'front', at: sx, w: ow + 0.6, y0: oTop, y1: eave + 0.1 }; }))
      });

      b.part('Stall partitions');
      b.unit(function () { piers.forEach(function (px) { b.box(px, base, cz, 0.14, eave - base - 0.3, D - 2 * Tk, { c: 'wood', m: M.wood, bevel: 0.01 }); }); });

      b.part('Stall frames');
      stalls.forEach(function (sx) {
        b.unit(function () {
          // carved posts, a heavy lintel studded with iron, knee braces in the corners, a stone threshold
          [-1, 1].forEach(function (sd) {
            var px = sx + sd * (ow / 2 - 0.11);
            b.box(px, base, z1 - 0.13, 0.22, oTop - base, 0.22, { c: 'beam', m: M.wood, bevel: 0.03 });
            b.box(px, base, z1 - 0.13, 0.3, 0.2, 0.3, { c: 'stoneDark', m: M.stone, bevel: 0.04 });
            [1.75, 1.87].forEach(function (yy) { b.box(px, base + yy, z1 - 0.13, 0.27, 0.07, 0.27, { c: 'beam', m: M.wood, bevel: 0.02 }); });
            b.box(px, oTop - 0.2, z1 - 0.13, 0.3, 0.2, 0.3, { c: 'beam', m: M.wood, bevel: 0.03 });
            b.beam([px - sd * 0.08, oTop - 0.66, z1 - 0.1], [px - sd * 0.58, oTop - 0.02, z1 - 0.1], 0.075, { c: 'beam', r2: 0.09 });
          });
          b.box(sx, oTop, z1 - 0.3, ow + 0.6, eave - oTop, Tk + 0.06, { c: 'beam', m: M.wood, bevel: 0.03 });
          for (var k = 0; k < 7; k++) b.ball(sx - 1.2 + k * 0.4, oTop + (eave - oTop) / 2, z1 + 0.01, 0.035, { c: 'iron', m: M.metal, detail: 0 });
          for (var q = 0; q < 4; q++) for (var rr = 0; rr < 2; rr++) b.box(sx - 0.9 + q * 0.6 + (rr ? 0.15 : 0), 0.0, z1 + 0.47 + rr * 0.6, rr && q === 3 ? 0.32 : 0.56, base + b.j(0.015), 0.56, { c: b.stoneC('sandstone'), m: M.stone, bevel: 0.04, ry: b.j(0.04) });
        });
      });

      b.part('Stall doors');
      // each pair open a different amount: [left leaf, right leaf]; the first stall has split doors, the top half open
      var open = [[0, 0], [0, 0.55], [2.75, 2.85], [1.1, 0.32]];
      stalls.forEach(function (sx, i) {
        b.unit(function () {
          var w = ow / 2 - 0.22, hl = sx - ow / 2 + 0.22, hr = sx + ow / 2 - 0.22, hz = z1 - 0.06;
          if (i === 0 || i === 3) {
            var tl = i ? 2.7 : 2.0, tr = i ? 2.8 : 1.45;
            stablesLeaf(b, hl, base, hz, 1, 0.03, w, 1.5, { ring: false }); stablesLeaf(b, hr, base, hz, -1, 0.02, w, 1.5);
            stablesLeaf(b, hl, base + 1.54, hz, 1, tl, w, 1.36, { ring: false }); stablesLeaf(b, hr, base + 1.54, hz, -1, tr, w, 1.36, { ring: false });
          } else {
            stablesLeaf(b, hl, base, hz, 1, open[i][0], w, doorH); stablesLeaf(b, hr, base, hz, -1, open[i][1], w, doorH);
          }
        });
      });

      b.part('Hayloft floor');
      b.unit(function () {
        b.box(cx, eave - 0.3, cz, W - 2 * Tk + 0.1, 0.14, D - 2 * Tk + 0.1, { c: 'woodDark', m: M.wood, bevel: 0.01 });
        stalls.forEach(function (sx) { for (var k = 0; k < 5; k++) b.box(sx - 1.0 + k * 0.5, eave - 0.48, z1 - 1.1, 0.12, 0.18, 1.0, { c: 'beam', m: M.wood, bevel: 0.02 }); });
      });

      b.part('Stall gables');
      // a stone gable over each stall, laid course by course; the second has a hay door for the hoist
      stalls.forEach(function (sx, si) {
        b.stoneWall(sx - gW, z1 - Tk / 2, sx + gW, z1 - Tk / 2, eave, gRise - 0.12, Tk, {
          pal: 'stone', course: course, len: 0.62, core: false,
          hole: function (t, y, s0, s1) {
            var hw = gW - (y - eave) - 0.08, a = gW - hw, c = gW + hw, keep = [];
            if (hw < 0.12) return true;
            [[Math.max(s0, a), Math.min(s1, c)]].forEach(function (k) { if (k[1] - k[0] > 0.1) keep.push(k); });
            if (si === 1 && y > eave + 0.08 && y < eave + 0.95) keep = keep.reduce(function (acc, k) { if (k[1] <= gW - 0.42 || k[0] >= gW + 0.42) acc.push(k); else { if (k[0] < gW - 0.42) acc.push([k[0], gW - 0.42]); if (k[1] > gW + 0.42) acc.push([gW + 0.42, k[1]]); } return acc; }, []);
            if (!keep.length) return true;
            if (keep.length === 1 && keep[0][0] <= s0 + 1e-6 && keep[0][1] >= s1 - 1e-6) return false;
            return keep;
          }
        });
      });

      // the main roof: ridge along x; the front slope leaves out what the cross gables cover
      var rise = 3.2, over = 0.55, overX = 0.5, rcx = cx, rcz = cz, rw = W, rd = D;
      var slope = Math.atan2(rise, rd / 2), tanS = Math.tan(slope), rTop = eave + rise;
      b.part('End gables');
      [-1, 1].forEach(function (sd) {
        b.unit(function () {
          var gx = rcx + sd * (rw / 2 - 0.12);
          b.gableEnd(gx, eave, rcz, rd - 0.1, rise - 0.15, 0.24, { c: 'woodDark' });
          var fx = gx + sd * 0.13;
          for (var k = -9; k <= 9; k++) {
            var zz = rcz + k * 0.3, hh = (rise - 0.25) * (1 - Math.abs(zz - rcz) / ((rd - 0.1) / 2)) - 0.05;
            if (hh > 0.15) b.box(fx, eave, zz, 0.05, hh, 0.07, { c: 'beam', m: M.wood, bevel: 0.01 });
          }
          b.box(fx, eave - 0.02, rcz, 0.08, 0.14, rd - 0.1, { c: 'beam', m: M.wood, bevel: 0.02 });
          b.cyl(fx + sd * 0.01, eave + 1.6, rcz, 0.3, 0.06, { c: '#1c1b1a', m: M.dark, rz: Math.PI / 2, seg: 14, ao: 0 });
          b.addGeo(new T.TorusGeometry(0.32, 0.05, 5, 16), { x: fx + sd * 0.03, y: eave + 1.6, z: rcz, ry: Math.PI / 2, c: 'beam', m: M.wood, ao: 0 });
        });
      });
      b.part('Slate roof');
      stablesRoof(b, rcx, eave, rcz, rw, rd, rise, {
        over: over, overX: overX, rows: 10,
        skip: function (x, side, u, pw) {
          if (side < 0) return false;
          for (var i = 0; i < stalls.length; i++) { var e = Math.max(0, Math.abs(x - stalls[i]) - pw / 2); if (e < gW + gOver - 0.05 && u * tanS < gRise - e + 0.02) return true; }
          return false;
        }
      });

      b.part('Stall gable roofs');
      stalls.forEach(function (sx) {
        // the cross gable's own slates, its ridge running back into the main roof
        b.push(sx, eave, z1 - 0.72, Math.PI / 2);
        b.gableRoof(0, 0, 0, 1.8, gW * 2, gRise, { m: 'slate', over: gOver, rows: 4, overX: 0.17 });
        b.pop();
      });

      b.part('Carved barge boards');
      stalls.forEach(function (sx) {
        b.unit(function () {
          // crossed boards whose ends are carved into a pair of dragon heads looking out along the row
          var bz = z1 + 0.17 + 0.18 + 0.06, top = eave + gRise + 0.18;
          [-1, 1].forEach(function (e) {
            var xe = sx + e * (gW + gOver), ye = eave - gOver + 0.12, ddx = sx - xe, ddy = top - ye, L = Math.hypot(ddx, ddy), ext = 0.5;
            var end = [sx + ddx / L * ext, top + ddy / L * ext];
            b.beam([xe, ye - 0.08, bz], [end[0], end[1], bz], 0.085, { c: 'beam', r2: 0.06 });
            stablesFinial(b, end[0] - e * 0.02, end[1] - 0.05, bz, e > 0 ? Math.PI : 0, 0.62, { rz: 0.15 });
          });
          // purlin ends under the verge
          [-0.7, 0, 0.7].forEach(function (o2) { b.box(sx + o2, eave + gRise - Math.abs(o2) - 0.42, z1 + 0.12, 0.16, 0.18, 0.4, { c: 'beam', m: M.wood, bevel: 0.03 }); });
        });
      });

      b.part('Ridge finials');
      [-1, 1].forEach(function (sd) {
        b.unit(function () {
          var bx = rcx + sd * (rw / 2 + overX + 0.06), top = rTop + 0.17;
          [-1, 1].forEach(function (e) {
            var ze = rcz + e * (rd / 2 + over), ye = eave - over * tanS + 0.14, dz = rcz - ze, dy = top - ye, ext = 0.5, L = Math.hypot(dz, dy);
            b.beam([bx, ye - 0.1, ze], [bx, top + dy / L * ext, rcz + dz / L * ext], 0.1, { c: 'beam', r2: 0.07 });
          });
          stablesFinial(b, bx + sd * 0.05, top + 0.18, rcz, sd > 0 ? 0 : Math.PI, 1.2);
        });
      });

      b.part('Hay hoist');
      var hx = stalls[1];
      b.unit(function () {
        // the hay door in the second gable, one leaf swung open
        b.box(hx, eave + 0.08, z1 - 0.32, 0.86, 0.9, 0.5, { c: '#1c1b1a', m: M.dark, bevel: 0, ao: 0 });
        b.box(hx, eave + 0.0, z1 + 0.02, 1.06, 0.1, 0.2, { c: 'beam', m: M.wood, bevel: 0.02 });
        [-1, 1].forEach(function (sd) { b.box(hx + sd * 0.47, eave + 0.05, z1 - 0.02, 0.1, 0.92, 0.14, { c: 'beam', m: M.wood, bevel: 0.02 }); });
        b.box(hx, eave + 0.95, z1 - 0.02, 1.06, 0.12, 0.16, { c: 'beam', m: M.wood, bevel: 0.02 });
        stablesLeaf(b, hx + 0.42, eave + 0.08, z1 + 0.03, -1, 1.75, 0.42, 0.86, { ring: false });
      });
      b.unit(function () {
        // the hoist beam out of the gable's peak, its end carved into a dragon's head, a pulley and a bale on the rope
        var hy = eave + 1.18;
        b.beam([hx, hy, z1 - 0.5], [hx, hy, z1 + 1.5], 0.09, { c: 'beam' });
        b.beam([hx, eave + 0.98, z1 + 0.1], [hx, hy - 0.02, z1 + 0.75], 0.055, { c: 'beam' });
        stablesFinial(b, hx, hy - 0.16, z1 + 1.42, -Math.PI / 2, 0.5);
        b.cyl(hx, hy - 0.32, z1 + 1.1, 0.13, 0.06, { c: 'woodLight', m: M.wood, rz: Math.PI / 2, seg: 10 });
        b.box(hx, hy - 0.3, z1 + 1.1, 0.04, 0.3, 0.04, { c: 'iron', m: M.metal, bevel: 0.005 });
        b.beam([hx, hy - 0.42, z1 + 1.22], [hx, 3.62, z1 + 1.22], 0.012, { c: 'rope', m: M.rope, round: true, seg: 4 });
        b.beam([hx, hy - 0.42, z1 + 0.98], [hx + 0.3, 0.9, z1 + 0.95], 0.012, { c: 'rope', m: M.rope, round: true, seg: 4 });
        stablesBale(b, hx, 3.05, z1 + 1.22, { ry: 0.12, w: 0.95 });
        [-0.25, 0.25].forEach(function (o2) { b.beam([hx + o2, 3.56, z1 + 1.22], [hx, 3.7, z1 + 1.22], 0.01, { c: 'rope', m: M.rope, round: true, seg: 4 }); });
      });

      b.part('Cupola');
      var cpx = 1.65;
      b.unit(function () {
        b.box(cpx, rTop - 0.95, rcz, 1.5, 1.35, 1.5, { c: 'woodDark', m: M.wood, bevel: 0.03 });
        b.box(cpx, rTop + 0.38, rcz, 1.66, 0.12, 1.66, { c: 'beam', m: M.wood, bevel: 0.02 });
        var lr = 0.62, ly0 = rTop + 0.5, lh = 0.95;
        b.cyl(cpx, ly0, rcz, lr - 0.08, lh, { c: '#1c1b1a', m: M.dark, seg: 8, ao: 0 });
        for (var k = 0; k < 8; k++) {
          var a = k / 8 * Math.PI * 2 + Math.PI / 8, am = a + Math.PI / 8;
          b.box(cpx + Math.cos(a) * lr, ly0, rcz + Math.sin(a) * lr, 0.1, lh, 0.1, { c: 'beam', m: M.wood, bevel: 0.015, ry: -a });
          for (var q = 0; q < 5; q++) b.box(cpx + Math.cos(am) * (lr - 0.03), ly0 + 0.1 + q * 0.17, rcz + Math.sin(am) * (lr - 0.03), 0.46, 0.035, 0.11, { c: 'wood', m: M.wood, bevel: 0.005, ry: -am + Math.PI / 2, rx: 0.55 });
        }
        b.cyl(cpx, ly0 + lh, rcz, lr + 0.14, 0.1, { c: 'beam', m: M.wood, seg: 8, flat: true });
      });
      b.coneRoof(cpx, rTop + 1.55, rcz, 0.95, 1.3, { m: 'slate', rows: 3, flare: 0.18, seg: 8 });
      b.unit(function () {
        // the weathervane: a night dragon in flight, cut from iron, its made tail fin in the Hub's orange
        var vy = rTop + 2.8;
        b.cyl(cpx, vy - 0.05, rcz, 0.03, 1.0, { c: 'iron', m: M.metal, seg: 6 });
        b.ball(cpx, vy + 0.02, rcz, 0.07, { c: 'iron', m: M.metal, detail: 1 });
        [0, Math.PI / 2].forEach(function (a) { b.beam([cpx - Math.cos(a) * 0.4, vy + 0.25, rcz - Math.sin(a) * 0.4], [cpx + Math.cos(a) * 0.4, vy + 0.25, rcz + Math.sin(a) * 0.4], 0.012, { c: 'iron', m: M.metal, round: true, seg: 4 }); });
        var V = [[-0.68, 0.02], [-0.45, 0.04], [-0.2, 0.07], [-0.12, 0.1], [-0.36, 0.5], [-0.12, 0.36], [0.0, 0.54], [0.08, 0.32], [0.22, 0.46], [0.18, 0.12], [0.3, 0.12], [0.37, 0.21],
          [0.42, 0.13], [0.6, 0.09], [0.6, 0.05], [0.42, 0.02], [0.3, 0.0], [0.22, -0.06], [0.2, -0.16], [0.13, -0.07], [-0.12, -0.05], [-0.17, -0.15], [-0.23, -0.04], [-0.45, -0.01]];
        b.push(cpx, vy + 0.55, rcz, -0.55);
        b.extrude(0, 0, 0, V.map(function (p) { return [p[0] * 1.25, p[1] * 1.25]; }), 0.035, { c: '#1f1e1c', m: M.metal, ao: 0, bevel: 0.004 });
        b.extrude(0, 0, 0, [[-0.84, 0.02], [-0.72, 0.04], [-0.86, 0.2]], 0.045, { c: 'ember', m: M.cloth, ao: 0 });
        b.extrude(0, 0, 0, [[-0.84, 0.0], [-0.72, 0.0], [-0.86, -0.15]], 0.04, { c: '#1f1e1c', m: M.metal, ao: 0 });
        b.ball(0.5, 0.12, 0.025, 0.018, { c: '#b3d64a', m: M.paint, ao: 0, detail: 0 }); b.ball(0.5, 0.12, -0.025, 0.018, { c: '#b3d64a', m: M.paint, ao: 0, detail: 0 });
        b.pop();
      });

      b.part('Fish store');
      var lx0 = x0 - 2.75, lzA = z0 + 0.55, lzB = z1 - 0.45, lyHi = 3.85, lyLo = 2.55;
      b.unit(function () {
        [lzA, (lzA + lzB) / 2, lzB].forEach(function (zz) {
          b.box(lx0 + 0.15, 0, zz, 0.22, lyLo - 0.05, 0.22, { c: 'beam', m: M.wood, bevel: 0.03 });
          b.box(lx0 + 0.15, 0, zz, 0.32, 0.2, 0.32, { c: 'stoneDark', m: M.stone, bevel: 0.04 });
          b.beam([lx0 + 0.27, lyLo - 0.7, zz], [lx0 + 0.7, lyLo - 0.15, zz], 0.06, { c: 'beam' });
        });
        b.box(lx0 + 0.15, lyLo - 0.2, (lzA + lzB) / 2, 0.26, 0.24, lzB - lzA + 0.5, { c: 'beam', m: M.wood, bevel: 0.03 });
        b.box(x0 - 0.12, lyHi - 0.3, (lzA + lzB) / 2, 0.24, 0.24, lzB - lzA + 0.5, { c: 'beam', m: M.wood, bevel: 0.03 });
        for (var k = 0; k < 6; k++) { var zz = lzA - 0.15 + k * (lzB - lzA + 0.3) / 5; b.beam([x0 - 0.05, lyHi - 0.12, zz], [lx0 - 0.25, lyLo - 0.2, zz], 0.055, { c: 'beam', r2: 0.05 }); }
      });
      (function () {
        // the lean-to's slates, row by row from the low edge
        var xa = lx0 - 0.35, xb = x0 - 0.02, ya = lyLo - 0.12, yb = lyHi + 0.02, rows = 5, L = Math.hypot(xb - xa, yb - ya), ang = Math.atan2(yb - ya, xb - xa), rl = L / rows, za = lzA - 0.45, zb = lzB + 0.45;
        for (var r = 0; r < rows; r++) {
          b.unit(function () {
            var t0 = r * rl, n = Math.ceil((zb - za) / 0.38), off = (r % 2) * 0.19;
            for (var i = 0; i < n; i++) {
              var zz = za + off + i * 0.38; if (zz > zb - 0.1) break;
              var px = xa + Math.cos(ang) * (t0 + rl * 0.6), py = ya + Math.sin(ang) * (t0 + rl * 0.6);
              // dark timber shingles: slate on this shaded, sky-facing slope reads blue
              var c = KIT.util.col(b.pick(KIT.PAL.woodDark)); if (b.r() < 0.15) c.offsetHSL(0, 0, -0.03); else if (b.r() < 0.2) c.offsetHSL(0, 0.02, 0.03);
              b.box(px, py - 0.03 + (r % 2) * 0.005, zz + 0.19, rl * 1.35, 0.05, 0.36, { rz: ang + b.j(0.015), ry: b.j(0.02), c: c, m: M.wood, bevel: 0.012, ao: 0.25, jit: 0.02 });
            }
          });
        }
      })();
      b.unit(function () {
        // barrels of fish, crates and a basket under the lean-to, a net hung from the beam
        b.barrel(lx0 + 0.9, 0, lzA + 0.6, { h: 0.95 }); b.barrel(lx0 + 1.7, 0, lzA + 0.45, {}); b.barrel(lx0 + 1.2, 0, lzA + 1.35, { h: 0.85 });
        [[lx0 + 0.9, lzA + 0.6, 0.95], [lx0 + 1.2, lzA + 1.35, 0.85]].forEach(function (bb) { for (var k = 0; k < 4; k++) stablesFish(b, bb[0] - 0.1 + b.j(0.12), bb[2] - 0.02, bb[1] + b.j(0.12), { rz: Math.PI / 2 + 0.4 + b.j(0.3), ry: b.r() * 6.28, s: 1.1 }); });
        b.crate(lx0 + 1.8, 0, lzB - 0.6, 0.7, { ry: 0.2 }); b.crate(lx0 + 1.75, 0.7, lzB - 0.55, 0.55, { ry: -0.15 });
        stablesFishBasket(b, lx0 + 0.9, lzB - 0.9, {});
        for (var k = 0; k < 7; k++) { var zz = lzA + 0.4 + k * 0.38; b.beam([lx0 + 0.28, lyLo - 0.25, zz], [lx0 + 0.34, lyLo - 1.1 - b.r() * 0.3, zz + b.j(0.08)], 0.012, { c: '#5e584f', m: M.rope, round: true, seg: 4 }); }
        b.beam([lx0 + 0.32, lyLo - 1.0, lzA + 0.4], [lx0 + 0.32, lyLo - 1.1, lzA + 2.7], 0.012, { c: '#5e584f', m: M.rope, round: true, seg: 4 });
      });

      b.part('Harness and shields');
      b.unit(function () {
        stablesHarness(b, piers[0] + 0.2, 2.45, z1, {});
        stablesHarness(b, x1 - 0.28, 2.4, z1, { c: '#3a2c22' });
      });
      b.unit(function () {
        piers.forEach(function (px, i) { stablesShield(b, px, 3.35, z1 + 0.06, ['ink', 'bone', 'inkGrey'][i], ['bone', 'ink', 'bone'][i], 0.8); });
        stablesShield(b, x0 + 0.3, 3.35, z1 + 0.06, 'bone', 'ink', 0.62);
        [piers[0] - 0.2, x0 + 0.28].forEach(function (px) { b.torch(px, 2.0, z1 + 0.02, { s: 0.6 }); });
      });

      b.part('Water trough');
      var tx = -4.85, tz = z1 + 2.25, tL = 2.7, tW = 0.95, tH = 0.62;
      b.unit(function () {
        b.box(tx, 0, tz, tL, 0.12, tW, { c: 'stoneDark', bevel: 0.03 });
        [-1, 1].forEach(function (sd) { for (var k = 0; k < 3; k++) b.box(tx - tL / 2 + (k + 0.5) * tL / 3, 0.1, tz + sd * (tW / 2 - 0.08), tL / 3 - 0.04, tH - 0.1, 0.16, { c: b.stoneC('stone'), m: M.stone, bevel: 0.04 }); });
        [-1, 1].forEach(function (sd) { b.box(tx + sd * (tL / 2 - 0.08), 0.1, tz, 0.16, tH - 0.1, tW - 0.3, { c: b.stoneC('stone'), m: M.stone, bevel: 0.04 }); });
        b.box(tx, 0.1, tz, tL - 0.3, tH - 0.18, tW - 0.3, { c: '#55666b', m: M.water, bevel: 0, ao: 0 });
      });
      b.unit(function () {
        b.bucket(tx + 1.65, 0, tz + 0.2); b.bucket(tx - 1.6, 0, tz - 0.25);
        b.barrel(tx - 1.85, 0, tz + 0.55, { h: 1.0, r: 0.36 });
        b.cyl(tx - 1.85, 1.0, tz + 0.55, 0.29, 0.02, { c: '#55666b', m: M.water, seg: 14 });
      });

      b.part('Hay and feed');
      b.unit(function () {
        // bales stacked by the hoist, a haystack by the fish store
        var bx = hx - 1.1, bz = z1 + 1.7;
        stablesBale(b, bx, 0, bz, { ry: 0.05 }); stablesBale(b, bx + 1.08, 0, bz + 0.05, { ry: -0.04 }); stablesBale(b, bx + 0.5, 0.5, bz, { ry: 0.1 });
        stablesBale(b, bx - 0.2, 0, bz + 0.75, { ry: 1.45, w: 1.0 });
      });
      b.unit(function () {
        // a wagon loaded with bales, its shafts down on the cobbles
        b.cart(x0 - 3.7, z1 + 1.9, { ry: 0.35, load: function () {
          stablesBale(b, -0.3, 0.71, -0.45, { w: 0.62, d: 1.0, h: 0.46, ry: 0.03 }); stablesBale(b, 0.33, 0.71, -0.42, { w: 0.62, d: 1.0, h: 0.46, ry: -0.04 });
          stablesBale(b, -0.3, 0.71, 0.6, { w: 0.62, d: 1.0, h: 0.46, ry: 0.02 }); stablesBale(b, 0.32, 0.71, 0.62, { w: 0.62, d: 1.0, h: 0.46 });
          stablesBale(b, 0.0, 1.17, 0.05, { w: 0.62, d: 1.0, h: 0.46, ry: 0.06 }); stablesBale(b, 0.05, 1.17, -0.75, { w: 1.0, d: 0.6, h: 0.44, ry: 1.5 });
        } });
        stablesFork(b, x0 - 2.35, z1 + 2.7, { ry: 0.6, lean: 0.25 });
      });
      b.unit(function () {
        // fish for the dragon in the open stall
        stablesFishBasket(b, stalls[2] - 1.75, z1 + 1.45, {});
        stablesFishBasket(b, stalls[2] - 2.3, z1 + 1.05, { r: 0.28, h: 0.36, n: 5 });
        for (var k = 0; k < 4; k++) stablesFish(b, stalls[2] - 1.15 + b.j(0.3), 0.03, z1 + 1.75 + b.j(0.3), { rx: Math.PI / 2, ry: b.r() * 6.28, s: 1.1 });
      });
      b.unit(function () {
        // a barrow of straw and a fork at the last stall
        var wx = x1 + 1.5, wz = z1 - 0.6;
        b.push(wx, 0, wz, 0.5);
        b.box(0, 0.35, 0, 0.8, 0.08, 1.0, { c: 'woodLight', m: M.wood });
        [-1, 1].forEach(function (sd) { b.box(sd * 0.4, 0.4, 0, 0.06, 0.32, 1.0, { c: 'wood', m: M.wood }); b.beam([sd * 0.3, 0.42, -0.4], [sd * 0.32, 0.62, -1.15], 0.03, { c: 'wood' }); b.beam([sd * 0.3, 0.38, -0.4], [sd * 0.3, 0.0, -0.45], 0.025, { c: 'wood' }); });
        b.box(0, 0.4, 0.5, 0.8, 0.32, 0.06, { c: 'wood', m: M.wood });
        b.wheel(0, 0.24, 0.62, 0.24, { ry: Math.PI / 2 });
        b.ball(0, 0.65, 0, 0.42, { c: b.pick(HAY), m: M.straw, sy: 0.45, sz: 1.2, detail: 1, ao: 0.2 });
        b.pop();
        stablesFork(b, x1 - 0.55, z1 + 0.25, { ry: 0.1, lean: -0.2 });
      });

      b.part('Wood and water');
      b.unit(function () {
        // firewood stacked against the far gable, rain barrels at its corner
        b.woodpile(x1 + 0.75, cz - 0.6, { ry: Math.PI / 2, n: 4, len: 2.6 });
        b.woodpile(x1 + 0.75, cz - 2.6, { ry: Math.PI / 2, n: 3, len: 1.3 });
        b.barrel(x1 + 0.7, 0, z0 + 0.15, { h: 1.0, r: 0.36 }); b.barrel(x1 + 1.45, 0, z0 + 0.45, { h: 0.9 });
        b.crate(x1 + 1.5, 0, cz + 1.7, 0.7, { ry: 0.3 }); b.sack(x1 + 2.1, 0, cz + 1.4, 0.5); b.sack(x1 + 1.9, 0, cz + 2.0, 0.45);
      });

      b.part('Perch post');
      b.unit(function () {
        // a tall carved post with a crossbar, where a dragon lands to wait its turn
        var ppx = 8.3, ppz = 3.1;
        b.box(ppx, 0, ppz, 0.7, 0.3, 0.7, { c: 'stoneDark', bevel: 0.05 });
        b.box(ppx, 0.3, ppz, 0.34, 3.7, 0.34, { c: 'beam', m: M.wood, bevel: 0.04 });
        [1.1, 1.25, 2.6, 2.75].forEach(function (yy) { b.box(ppx, yy, ppz, 0.4, 0.08, 0.4, { c: 'beam', m: M.wood, bevel: 0.02 }); });
        b.push(ppx, 4.0, ppz, 0.95);
        b.box(0, 0, 0, 2.6, 0.3, 0.32, { c: 'beam', m: M.wood, bevel: 0.04 });
        [-1, 1].forEach(function (sd) { b.beam([sd * 0.15, -0.7, 0], [sd * 0.85, 0.02, 0], 0.07, { c: 'beam', r2: 0.08 }); });
        b.pop();
        b.shield(ppx, 1.8, ppz + 0.19, { kind: 'round', c: 'ink', s: 0.62 });
        b.flag(ppx + 0.05, 4.3, ppz, 1.3, 0.9, 0.34, { c: 'ember', pennant: true, pr: 0.035, ry: -2.2 });
      });

      b.part('Ivy');
      b.unit(function () {
        b.ivy([[x1 - 0.1, 0.3, z1 + 0.06], [x1 - 0.25, 1.8, z1 + 0.06], [x1 - 0.15, 3.1, z1 + 0.06]], [0, 0, 1], { density: 5, spread: 0.3 });
        b.ivy([[x0 + 0.15, 0.3, z1 + 0.06], [x0 + 0.2, 1.5, z1 + 0.06]], [0, 0, 1], { density: 5, spread: 0.25 });
        b.bush(x1 + 0.6, z1 + 0.4, 0.5, { n: 2 });
      });

      b.life(function () {
        // the night dragon has come out of its open stall and crouches in the sun, curious, eyes on the child's fish; a
        // boulder dragon looks out over the half door of the last stall; a dawn dragon sleeps curled on the warm grass
        var nx = 1.5, ny = 0, nz = 5.6, nry = -1.35, ns = 1.15, chx = -2.9, chz = 6.55;
        b.dragon(nx, ny, nz, { kind: 'night', pose: 'crouch', ry: nry, s: ns, look: stablesLook(nx, ny, nz, nry, ns, chx, 1.0, chz) });
        var bx2 = stalls[3] + 0.05, bz2 = z1 - 1.0;
        b.dragon(bx2, base, bz2, { kind: 'boulder', pose: 'alert', ry: -0.3, s: 0.95, wing: 0.0, look: stablesLook(bx2, base, bz2, -0.3, 0.95, -2.0, 1.2, 4.0) });
        b.dragon(5.2, 0, 7.5, { kind: 'dawn', pose: 'curl', ry: 0.45, s: 1.05 });
        // the stable hand with an armful of hay, a child holding out a fish, riders at the trough
        var sh = [-2.0, 3.05, 1.0];
        b.figure(sh[0], sh[1], { role: 'villager', pose: 'carry', ry: sh[2], c: '#6f6a62' });
        var hp = stablesBy(sh[0], sh[1], sh[2], 0.3, 1.6, -0.05);
        b.ball(hp[0], hp[1], hp[2], 0.3, { c: '#bba574', m: M.straw, sx: 0.75, sy: 0.6, sz: 1.6, ry: sh[2] + 0.15, detail: 1, ao: 0.25 });
        var ch = [chx, chz, 1.87];
        b.figure(ch[0], ch[1], { role: 'child', pose: 'point', ry: ch[2], toy: false });
        var fp = stablesBy(ch[0], ch[1], ch[2], -0.26, 0.98, 0.27);
        stablesFish(b, fp[0], fp[1], fp[2], { rz: -1.2, ry: ch[2] + 1.5, s: 1.0 });
        b.figure(-5.7, 3.7, { role: 'villager', pose: 'talk', ry: 0.6, cape: '#1f1e1c', c: '#3b3a38' });
        b.figure(-4.4, 4.0, { role: 'villager', pose: 'stand', ry: -2.2, beard: true, c: '#5c5e62' });
        b.figure(lx0 + 1.3, z1 + 0.9, { role: 'villager', pose: 'carry', ry: -0.4, c: '#8a857c' });
      });
    }
  });
})();
