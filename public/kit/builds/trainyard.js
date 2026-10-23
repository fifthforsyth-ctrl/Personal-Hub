// Training yard: a sanded sparring ring fenced with carved posts and rope, an open arms shed with a slate roof and
// dragon-head finials, a tall perch gantry where the riders' dragons land between drills, straw dummies, and a saddle
// strapped to a sawhorse with a carved head where a young rider learns to sit. Laid sand first, then the fence post by
// post, the shed, the gantry, the riding rig, the arms and stores, and the people.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL;
  PAL.trainyard_sand = ['#bba57c', '#b59f76', '#c0aa81', '#b09a72'];
  PAL.trainyard_bale = ['#c9ad74', '#c2a56c', '#cfb47c'];
  PAL.trainyard_plank = ['#5b4a3c', '#544437', '#634f3f', '#4d3f33', '#5f5042'];
  function V(x, y, z) { return new T.Vector3(x, y, z); }

  // a carved dragon-head finial in the XY plane, snout toward local +x, neck foot at (x, y, z), turned by ry, s tall
  var HEAD = [[-0.1, 0], [0.1, 0], [0.12, 0.2], [0.17, 0.42], [0.26, 0.58], [0.42, 0.63], [0.62, 0.64], [0.8, 0.66], [0.78, 0.71], [0.6, 0.72], [0.46, 0.76], [0.62, 0.8], [0.84, 0.83], [0.87, 0.89], [0.8, 0.92], [0.62, 0.94], [0.5, 0.98], [0.42, 1.04], [0.2, 1.3], [0.29, 1.04], [0.15, 1.13], [0.16, 0.98], [0.06, 0.93], [-0.01, 0.95], [-0.02, 0.85], [-0.09, 0.82], [-0.06, 0.71], [-0.13, 0.64], [-0.1, 0.53], [-0.16, 0.44], [-0.12, 0.33], [-0.13, 0.15]];
  function dragonHead(b, x, y, z, ry, s, o) {
    o = o || {};
    b.push(x, y, z, ry);
    b.extrude(0, 0, 0, HEAD.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.13 * s, { c: o.c || 'woodDark', m: M.wood, bevel: 0.012 * s });
    b.box(0.02 * s, 0.3 * s, 0, 0.3 * s, 0.06 * s, 0.17 * s, { c: o.c || 'woodDark', m: M.wood, bevel: 0.01 * s, rz: 0.15 });
    [-1, 1].forEach(function (sd) { b.ball(0.53 * s, 0.89 * s, sd * 0.075 * s, 0.03 * s, { c: '#e9e4da', m: M.paint, detail: 0, ao: 0 }); });
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
    if (o.knob) b.ball(x, y + h + 0.14, z, w * 0.42, { c: c, m: M.wood, detail: 1 });
  }
  // a rope swagged between two points
  function swag(b, a, c, sag, r) {
    var n = 5, prev = a;
    for (var i = 1; i <= n; i++) { var t = i / n, p = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (c[2] - a[2]) * t]; b.beam(prev, p, r || 0.022, { c: 'rope', m: M.rope, round: true, seg: 5 }); prev = p; }
  }
  function fwd(fx, fz, ry, lx, ly, lz) { var c = Math.cos(ry), s = Math.sin(ry); return [fx + lx * c + lz * s, ly, fz - lx * s + lz * c]; }

  // astride the saddle: feet in the stirrups, hands on the reins, leaning a little into the ride
  KIT.people.poses.trainyard_ride = function (r) { return { feet: [V(-0.38, 0.3, 0.1), V(0.38, 0.3, 0.12)], hands: [V(-0.12, 1.08, 0.38), V(0.12, 1.1, 0.4)], lean: 0.14, twist: 0, side: 0.02, hip: 0, drop: 0, head: [0.1, -0.08], pole: [V(-0.6, -0.5, -0.5), V(0.6, -0.5, -0.5)] }; };
  // leaning on the fence rail, forearms on the rope
  KIT.people.poses.trainyard_lean = function (r) { return { feet: [V(-0.13, 0.09, -0.12), V(0.15, 0.09, -0.28)], hands: [V(-0.22, 1.02, 0.42), V(0.2, 1.04, 0.44)], lean: 0.24, twist: 0.05, side: 0, hip: 0, drop: 0.02, head: [0.2, 0.05], pole: [V(-0.8, -0.6, 0), V(0.8, -0.6, 0)] }; };

  KIT.defineBuild('trainyard', {
    name: 'Training yard', size: 'small', need: 16,
    line: 'A sanded sparring ring with a perch gantry for the dragons, an arms shed, straw dummies and a saddle rig for young riders.',
    r: 7.9, flat: [12.5, 10.5], ground: 'grass', path: [[-3.4, 7.3], [-1.35, 3.9]],
    frameY: 1.5, frameR: 7.5, glowAt: [3.5, 5.7, -4.05],
    trees: [{ x: -6.0, z: -4.2, kind: 'pine', h: 6.8 }, { x: 6.9, z: -0.8, kind: 'birch', h: 5.2 }, { x: -1.8, z: -6.3, kind: 'pine', h: 5.4 }],
    bushes: [{ x: 5.9, z: 4.6, r: 0.7, flowers: '#f3f1ec' }, { x: -5.8, z: 3.6, r: 0.7 }, { x: 5.6, z: -4.6, r: 0.6 }],
    perches: [{ x: 2.5, y: 4.93, z: -4.05, ry: 0 }, { x: 4.6, y: 4.93, z: -4.05, ry: 0 }, { x: -4.7, y: 4.0, z: -1.8, ry: 1.57 }],
    build: function (b) {
      var rx = 0.8, rz = 0.75, RS = 3.3, RF = 3.55, top = 0.04;
      var gateA = 2.19, gate = function (a) { return Math.abs(((a - gateA) + Math.PI * 3) % (Math.PI * 2) - Math.PI); };

      b.part('Sand ring');
      b.unit(function () {
        b.cyl(rx, -0.04, rz, RS + 0.1, top + 0.04, { c: 'trainyard_sand', m: M.dirt, seg: 40, flat: true, jit: 0.01, vary: 0.04 });
        // a low berm of darker sand thrown up against the fence
        b.lathe(rx, -0.02, rz, [[RS - 0.35, top + 0.02], [RS - 0.05, top + 0.08], [RS + 0.25, top + 0.06], [RS + 0.45, 0.0]], { c: '#a8926b', m: M.dirt, seg: 40, flat: true });
      });
      b.unit(function () {
        // rake marks in patches, scuffs and footprints where the fighters turn
        // the rake drawn round the ring in arcs, broken where the fighters have trodden it
        for (var ring = 0; ring < 9; ring++) {
          var rr2 = 0.9 + ring * 0.27, a0 = b.r() * 6.28;
          for (var sgm = 0; sgm < 5; sgm++) {
            var aa = a0 + sgm * 1.25 + b.j(0.2), span = 0.55 + b.r() * 0.45, nseg = Math.max(2, Math.round(span * rr2 / 0.3));
            for (var q = 0; q < nseg; q++) { var t0 = aa + q * span / nseg, t1 = t0 + span / nseg, tm = (t0 + t1) / 2; b.box(rx + Math.cos(tm) * rr2, top, rz + Math.sin(tm) * rr2, 0.04, 0.012, rr2 * span / nseg + 0.02, { ry: -tm, c: '#94805c', m: M.dirt, bevel: 0, ao: 0, jit: 0.02 }); }
          }
        }
        for (var s = 0; s < 7; s++) { var a2 = b.r() * 6.28, d2 = b.r() * 1.6; b.cyl(rx + 0.3 + Math.cos(a2) * d2, top - 0.006 + s * 0.0015, rz + 0.2 + Math.sin(a2) * d2, 0.35 + b.r() * 0.4, 0.012, { c: '#a99370', m: M.dirt, seg: 12, flat: true, sx: 1.3 }); }
        for (var f = 0; f < 22; f++) { var a3 = b.r() * 6.28, d3 = 0.4 + b.r() * 1.8; b.box(rx + 0.3 + Math.cos(a3) * d3, top + 0.004, rz + 0.2 + Math.sin(a3) * d3, 0.11, 0.012, 0.24, { ry: b.r() * 3, c: '#8f7b5a', m: M.dirt, bevel: 0.02, ao: 0 }); }
        for (var w = 0; w < 26; w++) { var a4 = b.r() * 6.28, d4 = b.r() * (RS + 0.3); b.box(rx + Math.cos(a4) * d4, top + 0.008, rz + Math.sin(a4) * d4, 0.16 + b.r() * 0.12, 0.012, 0.012, { ry: b.r() * 3, c: 'straw', m: M.straw, bevel: 0, ao: 0 }); }
      });

      b.part('Fence');
      var posts = []; for (var i = 0; i <= 18; i++) posts.push(gateA + 0.28 + i / 18 * (Math.PI * 2 - 0.56));
      var PP = function (a, y) { return [rx + Math.cos(a) * RF, y, rz + Math.sin(a) * RF]; };
      for (var g = 0; g < posts.length; g += 3) {
        (function (g) {
          b.unit(function () {
            for (var k = g; k < Math.min(posts.length, g + 3); k++) {
              var a = posts[k], gatePost = k === 0 || k === posts.length - 1, p = PP(a, 0);
              if (gatePost) {
                stave(b, p[0], 0, p[2], 2.3, 0.22, { cap: false, ry: -a });
                // the gate posts' heads look away from the gate, along the fence
                dragonHead(b, p[0], 2.3, p[2], k === 0 ? Math.atan2(-Math.cos(a), -Math.sin(a)) : Math.atan2(Math.cos(a), Math.sin(a)), 0.72);
              } else stave(b, p[0], 0, p[2], 1.22 + b.j(0.03), 0.15, { ry: -a + b.j(0.08), knob: true });
              if (k > 0) { var a0 = posts[k - 1]; swag(b, PP(a0, 1.02), PP(a, 1.02), 0.12); swag(b, PP(a0, 0.56), PP(a, 0.56), 0.08); }
            }
          });
        })(g);
      }
      b.unit(function () {
        // round shields hung on the fence, and a lintel over the gate hung with a horn
        // outside the front posts, inside the back ones, so they face the way in
        [[2, 'half', 'ink', 'bone', 1], [5, 'ring', 'bone', 'ink', -1], [9, 'quarter', 'ink', 'bone', -1], [12, 'cross', 'bone', 'ink', -1], [14, 'half', 'bone', 'ink', 1]].forEach(function (q) {
          var a = posts[q[0]], p = PP(a, 0.78), nx = Math.cos(a) * q[4], nz = Math.sin(a) * q[4];
          vShield(b, p[0] + nx * 0.12, 0.8, p[2] + nz * 0.12, Math.atan2(nx, nz), 0.3, q[1], q[2], q[3], -0.15);
        });
        // a horn hung on the gate post, and a rope across the way in
        var g0 = PP(posts[0], 1.6), g1 = PP(posts[posts.length - 1], 1.6);
        swag(b, [g0[0], 1.0, g0[2]], [g1[0], 1.0, g1[2]], 0.35, 0.02);
        [posts[0], posts[posts.length - 1]].forEach(function (a) { var p = PP(a, 0); b.torch(p[0] + Math.cos(a) * 0.12, 1.65, p[2] + Math.sin(a) * 0.12, { s: 0.55, ry: Math.atan2(Math.cos(a), Math.sin(a)) }); });
      });

      b.part('Arms shed');
      var sx = -4.7, sz = -1.8, sw = 3.3, sd = 2.5, eave = 2.5, rise = 1.3;
      var x0 = sx - sw / 2, x1 = sx + sw / 2, z0 = sz - sd / 2, z1 = sz + sd / 2;
      b.unit(function () {
        [[x0, z0], [sx, z0], [x1, z0], [x0, z1], [sx, z1], [x1, z1]].forEach(function (p) { b.box(p[0], -0.05, p[1], 0.4, 0.18, 0.4, { c: b.stoneC('stoneDark'), m: M.stone, bevel: 0.05 }); stave(b, p[0], 0.12, p[1], eave - 0.12, 0.2, { cap: false }); });
      });
      b.unit(function () {
        [z0, z1].forEach(function (z) { b.beam([x0 - 0.12, eave - 0.1, z], [x1 + 0.12, eave - 0.1, z], 0.1, { c: 'beam' }); });
        [x0, sx, x1].forEach(function (x) { b.beam([x, eave - 0.1, z0 - 0.12], [x, eave - 0.1, z1 + 0.12], 0.09, { c: 'beam' }); });
        // knee braces under the front plate
        [x0, sx, x1].forEach(function (x, i) { [-1, 1].forEach(function (s) { if ((i === 0 && s < 0) || (i === 2 && s > 0)) return; b.beam([x, eave - 0.75, z1], [x + s * 0.55, eave - 0.18, z1], 0.05, { c: 'beam' }); }); });
        // a plank back wall
        b.planks(sx, 0.05, z0 - 0.02, sw - 0.2, eave - 0.2, { vertical: true, c: 'trainyard_plank', pw: 0.26, t: 0.06 });
      });
      b.unit(function () {
        [x0 + 0.02, x1 - 0.02].forEach(function (x) { for (var t = -sd / 2 + 0.13; t < sd / 2; t += 0.26) { var hh = (rise - 0.2) * (1 - Math.abs(t) / (sd / 2 + 0.05)); if (hh < 0.08) continue; b.box(x, eave, sz + t, 0.06, hh, 0.24, { c: b.pick(PAL.trainyard_plank), m: M.wood, bevel: 0.01 }); } });
      });
      b.gableRoof(sx, eave, sz, sw, sd, rise, { m: 'slate', over: 0.4, overX: 0.32, rows: 6, ridge: false, pitch: 0.32 });
      b.unit(function () {
        var L = sw + 0.64, sl = Math.atan2(rise, sd / 2), drop = 0.4 * Math.tan(sl);
        b.beam([sx - L / 2 - 0.05, eave + rise + 0.08, sz], [sx + L / 2 + 0.05, eave + rise + 0.08, sz], 0.12, { c: 'beam', round: true, seg: 8 });
        [-1, 1].forEach(function (e) {
          var x = sx + e * (L / 2 - 0.04);
          [-1, 1].forEach(function (s) { var zz = sz + s * (sd / 2 + 0.4), y0b = eave - drop - 0.06, dz = -s * (sd / 2 + 0.4), dy = rise + drop; b.beam([x, y0b, zz], [x, y0b + dy * 1.22, zz + dz * 1.22], 0.07, { c: 'beam', r2: 0.05 }); });
          dragonHead(b, x + e * 0.02, eave + rise + 0.12, sz, e > 0 ? 0 : Math.PI, 0.95);
        });
      });
      b.unit(function () {
        b.rack(sx - 0.8, 0, z0 + 0.45, 1.4, { kind: 'swords' });
        b.rack(sx + 0.85, 0, z0 + 0.45, 1.3, { kind: 'shields' });
        [[x0 + 0.02, -0.5, 'half', 'ink', 'bone'], [x0 + 0.02, 0.35, 'quarter', 'bone', 'ink']].forEach(function (q) { vShield(b, q[0] - 0.08, 1.35, sz + q[1], -Math.PI / 2, 0.34, q[2], q[3], q[4]); });
      });
      b.unit(function () {
        b.bench(sx, sz + 0.55, 2.0, {});
        b.crate(x1 - 0.45, 0, sz + 0.2, 0.6, { ry: 0.2 });
        for (var i = 0; i < 3; i++) b.lathe(sx - 0.6 + i * 0.45, 0.49, sz + 0.55, [[0.15, 0], [0.16, 0.1], [0.12, 0.2], [0.01, 0.23]], { c: 'iron', m: M.metal, seg: 10 });
        vShield(b, sx + 0.7, 0.78, sz + 0.72, 0.1, 0.3, 'ring', 'ink', 'bone', -0.35);
      });

      b.part('Perch gantry');
      var gx0 = 1.7, gx1 = 5.3, gz = -4.05, gh = 4.6;
      b.unit(function () {
        [gx0, gx1].forEach(function (x) {
          b.box(x, -0.08, gz, 0.7, 0.3, 0.7, { c: b.stoneC('stoneDark'), m: M.stone, bevel: 0.06 });
          b.log(x, 0.2, gz, 0.2, gh - 0.2, { c: 'woodDark', seg: 9, r2: 0.17 });
          [0.6, gh - 0.55].forEach(function (y) { b.cyl(x, y, gz, 0.215, 0.1, { c: 'iron', m: M.metal, seg: 10 }); });
        });
      });
      b.unit(function () {
        // raking struts out to the sides, footed in stones
        [[gx0, -1], [gx1, 1]].forEach(function (q) { [-1, 1].forEach(function (s) { b.beam([q[0], gh - 1.4, gz], [q[0] + q[1] * 0.4, 0.05, gz + s * 1.05], 0.075, { c: 'beam' }); b.box(q[0] + q[1] * 0.4, -0.05, gz + s * 1.05, 0.32, 0.16, 0.32, { c: b.stoneC('stone'), m: M.stone, bevel: 0.04 }); }); });
        [-1, 1].forEach(function (s) { b.beam([gx0, gh - 0.7, gz], [gx0 + s * 0 + 0.9, gh - 0.05, gz], 0.06, { c: 'beam' }); b.beam([gx1, gh - 0.7, gz], [gx1 - 0.9, gh - 0.05, gz], 0.06, { c: 'beam' }); });
      });
      b.unit(function () {
        // the perch: a great log across the posts, worn smooth by claws, its ends carved as heads
        b.beam([gx0 - 0.55, gh + 0.12, gz], [gx1 + 0.55, gh + 0.12, gz], 0.21, { c: 'wood', round: true, seg: 10, r2: 0.2 });
        for (var i = 0; i < 9; i++) { var x = gx0 - 0.2 + i * 0.47; b.box(x, gh + 0.3, gz + b.j(0.08), 0.05, 0.02, 0.22, { c: '#5a4a3c', m: M.wood, bevel: 0, ry: b.j(0.4) + 0.2 }); }
        dragonHead(b, gx0 - 0.52, gh + 0.12, gz, Math.PI, 1.05);
        dragonHead(b, gx1 + 0.52, gh + 0.12, gz, 0, 1.05);
        b.flag(gx1, gh + 0.32, gz - 0.05, 1.1, 0.8, 0.3, { c: 'ember', pennant: true, pr: 0.03, ry: -0.3 });
      });
      b.unit(function () {
        // a rope ladder down one side and two straw bales slung beneath for the riders to strike at speed
        var lx = gx0 + 0.55;
        [-0.2, 0.2].forEach(function (d) { b.beam([lx + d, gh - 0.05, gz + 0.18], [lx + d * 0.8, 0.25, gz + 0.32], 0.016, { c: 'rope', m: M.rope, round: true, seg: 4 }); });
        for (var k = 0; k < 11; k++) { var t = k / 11, y = gh - 0.35 - t * (gh - 0.7); b.beam([lx - 0.2 + t * 0.04, y, gz + 0.18 + t * 0.14], [lx + 0.2 - t * 0.04, y, gz + 0.18 + t * 0.14], 0.025, { c: 'woodLight', round: true, seg: 5 }); }
        [[3.0, 2.0], [4.25, 2.55]].forEach(function (q) {
          b.beam([q[0], gh - 0.02, gz], [q[0], q[1] + 0.75, gz], 0.018, { c: 'rope', m: M.rope, round: true, seg: 4 });
          b.box(q[0], q[1], gz, 0.62, 0.78, 0.48, { c: 'trainyard_bale', m: M.straw, bevel: 0.08 });
          [0.2, 0.55].forEach(function (f) { b.box(q[0], q[1] + 0.78 * f, gz, 0.66, 0.05, 0.52, { c: 'rope', m: M.rope, bevel: 0.01 }); });
          vShield(b, q[0], q[1] + 0.4, gz + 0.25, 0, 0.18, 'cross', 'bone', 'ink');
        });
      });

      b.part('Riding rig');
      var hx = 1.6, hz = 5.25, hry = Math.PI / 2 - 0.3, seat = 1.12;
      b.unit(function () {
        // the sawhorse: a squared beam on splayed legs
        b.push(hx, 0, hz, hry);
        b.box(0, 0.86, 0, 0.26, 0.2, 2.1, { c: 'wood', m: M.wood, bevel: 0.03 });
        [-0.8, 0.8].forEach(function (z) { [-1, 1].forEach(function (s) { b.beam([0, 0.92, z], [s * 0.5, 0, z + (z > 0 ? 0.12 : -0.12)], 0.05, { c: 'wood' }); }); b.beam([-0.36, 0.3, z + (z > 0 ? 0.04 : -0.04)], [0.36, 0.3, z + (z > 0 ? 0.04 : -0.04)], 0.035, { c: 'wood' }); });
        b.pop();
      });
      b.unit(function () {
        b.push(hx, 0, hz, hry);
        // a blanket striped in ink and bone, the saddle laid over it with a high cantle and horn
        [-1, 1].forEach(function (s) { b.box(s * 0.2, 0.62, -0.08, 0.025, 0.42, 0.8, { c: 'ink', m: M.cloth, rz: s * 0.12, bevel: 0.005 }); b.box(s * 0.215, 0.7, -0.08, 0.026, 0.06, 0.81, { c: 'bone', m: M.cloth, rz: s * 0.12, bevel: 0 }); });
        b.box(0, 1.06, -0.08, 0.42, 0.03, 0.82, { c: 'ink', m: M.cloth, bevel: 0.01 });
        b.extrude(0, 1.08, 0, [[0, -0.45], [0, 0.3], [0.08, 0.34], [0.2, 0.3], [0.08, 0.2], [0.04, -0.2], [0.18, -0.4], [0.06, -0.48]].map(function (p) { return [p[1], p[0]]; }), 0.36, { c: '#5a3f2b', m: M.wood, ry: -Math.PI / 2, bevel: 0.02 });
        b.cyl(0, 1.3, 0.3, 0.04, 0.12, { c: '#4a3424', m: M.wood, seg: 8 }); b.ball(0, 1.43, 0.3, 0.05, { c: 'brass', m: M.gold, detail: 1 });
        // girth strap and stirrups
        b.box(0, 0.74, -0.05, 0.3, 0.42, 0.08, { c: '#4a3424', m: M.wood, bevel: 0.01 });
        [-1, 1].forEach(function (s) { b.box(s * 0.23, 0.68, 0.05, 0.03, 0.42, 0.05, { c: '#4a3424', m: M.wood, bevel: 0 }); b.addGeo(new T.TorusGeometry(0.07, 0.012, 4, 10), { x: s * 0.24, y: 0.64, z: 0.05, ry: Math.PI / 2, c: 'iron', m: M.metal }); });
        b.pop();
      });
      b.unit(function () {
        // a carved head on a neck post at the front, the reins knotted to its jaw
        var hp = fwd(hx, hz, hry, 0, 0, 1.0);
        b.beam([hp[0], 0.86, hp[2]], fwd(hx, hz, hry, 0, 1.45, 1.22), 0.07, { c: 'wood' });
        var hh = fwd(hx, hz, hry, 0, 1.4, 1.22);
        dragonHead(b, hh[0], hh[1], hh[2], hry - Math.PI / 2, 0.62, { c: 'wood' });
        var jaw = fwd(hx, hz, hry, 0, 1.8, 1.6), hand = fwd(hx, hz, hry, 0, 1.25, 0.3);
        [-0.06, 0.06].forEach(function (d) { var j2 = fwd(hx, hz, hry, d, 1.82, 1.58), h2 = fwd(hx, hz, hry, d * 1.8, 1.27, 0.32); swag(b, j2, h2, 0.1, 0.012); });
      });

      b.part('Dummies and stores');
      b.unit(function () { b.dummy(-3.75, 0, 4.4, { ry: 0.9, helm: true, shield: 'bone' }); b.dummy(-4.9, 0, 3.3, { ry: 0.6 }); b.dummy(-2.6, 0, 5.7, { ry: 1.1 }); });
      b.unit(function () { b.dummy(rx - 1.6, top, rz - 1.9, { ry: 0.3, helm: true }); b.bucket(rx - 1.1, top, rz - 2.3); });
      b.unit(function () {
        // inside the rope on the sunny side: a barrel of wooden practice swords, and a bench where the next pair waits
        // with their helms and a shield set down
        var ba = 0.15, bx = rx + Math.cos(ba) * 2.7, bz = rz + Math.sin(ba) * 2.7;
        b.barrel(bx, top, bz, { h: 0.8, r: 0.3 });
        for (var k = 0; k < 6; k++) {
          var a = k / 6 * 6.28 + 0.4, d = 0.1 + (k % 2) * 0.06, p0 = [bx + Math.cos(a) * d, top + 0.35, bz + Math.sin(a) * d], p1 = [bx + Math.cos(a) * (d + 0.14), top + 1.25 + (k % 3) * 0.06, bz + Math.sin(a) * (d + 0.14)];
          b.beam(p0, p1, 0.028, { c: 'woodLight', m: M.wood, r2: 0.02 });
          var gx = p0[0] + (p1[0] - p0[0]) * 0.8, gy = p0[1] + (p1[1] - p0[1]) * 0.8, gz2 = p0[2] + (p1[2] - p0[2]) * 0.8;
          b.box(gx, gy, gz2, 0.2, 0.035, 0.04, { c: 'wood', m: M.wood, ry: -a, bevel: 0.008 });
        }
        vShield(b, bx - 0.25, top + 0.32, bz + 0.33, -0.5, 0.3, 'cross', 'ink', 'bone', -0.32);
        var ka = -0.55, kx = rx + Math.cos(ka) * 2.75, kz = rz + Math.sin(ka) * 2.75, kry = Math.atan2(-Math.cos(ka), -Math.sin(ka));
        b.bench(kx, kz, 1.4, { ry: kry });
        [-0.4, 0.05].forEach(function (t) { var p = fwd(kx, kz, kry, t, 0, 0); b.lathe(p[0], 0.455, p[2], [[0.15, 0], [0.16, 0.1], [0.12, 0.2], [0.01, 0.23]], { c: 'iron', m: M.metal, seg: 10 }); });
        var sp = fwd(kx, kz, kry, 0.45, 0, 0.3);
        vShield(b, sp[0], top + 0.28, sp[2], kry + 0.25, 0.28, 'half', 'bone', 'ink', -0.22);
      });
      b.unit(function () {
        // the water barrel and its dipper, a trough beside it
        var wx = -3.55, wz = 1.7;
        b.barrel(wx, 0, wz, { h: 1.0, r: 0.36 });
        b.cyl(wx, 0.985, wz, 0.3, 0.02, { c: '#5f7680', m: M.water, seg: 14 });
        b.beam([wx + 0.05, 1.0, wz], [wx + 0.45, 1.25, wz + 0.15], 0.018, { c: 'woodLight', round: true, seg: 5 });
        b.lathe(wx + 0.02, 0.92, wz - 0.02, [[0.01, 0], [0.08, 0], [0.09, 0.08], [0.01, 0.07]], { c: 'wood', m: M.wood, seg: 8 });
        b.box(wx - 0.2, 0, wz + 0.85, 1.4, 0.45, 0.5, { c: 'wood', m: M.wood, bevel: 0.03, ry: 0.3 });
        b.box(wx - 0.2, 0.36, wz + 0.85, 1.25, 0.06, 0.37, { c: '#5f7680', m: M.water, bevel: 0, ry: 0.3 });
      });
      b.unit(function () {
        // practice arms dropped in the sand, a stack of hay, and sacks of sand for the ring
        b.box(rx + 1.6, top, rz + 1.1, 0.06, 0.03, 0.85, { c: 'woodLight', m: M.wood, ry: 0.8 });
        b.box(rx + 1.75, top + 0.03, rz + 1.25, 0.2, 0.03, 0.05, { c: 'woodLight', m: M.wood, ry: 0.8 });
        b.box(rx - 2.2, top, rz + 0.4, 0.06, 0.03, 0.85, { c: 'woodLight', m: M.wood, ry: -0.5 });
        // the ring's rake laid by the fence, its teeth up
        (function () {
          var ra = 0.6, p0 = [rx + Math.cos(ra) * 2.2, top + 0.03, rz + Math.sin(ra) * 2.2], p1 = [rx + Math.cos(ra + 0.42) * 3.05, top + 0.03, rz + Math.sin(ra + 0.42) * 3.05];
          b.beam(p0, p1, 0.022, { c: 'woodLight', round: true, seg: 5 });
          var dx = p1[0] - p0[0], dz = p1[2] - p0[2], L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L;
          b.box(p1[0], top, p1[2], 0.62, 0.06, 0.07, { c: 'wood', m: M.wood, ry: Math.atan2(dx, dz) + Math.PI / 2, bevel: 0.01 });
          for (var t = -4; t <= 4; t++) b.beam([p1[0] + nx * t * 0.07, top + 0.05, p1[2] + nz * t * 0.07], [p1[0] + nx * t * 0.07 + dx / L * 0.02, top + 0.15, p1[2] + nz * t * 0.07 + dz / L * 0.02], 0.009, { c: 'woodDark', round: true, seg: 4 });
        })();
        vShield(b, rx - 1.2, top + 0.03, rz + 1.6, 0.5, 0.32, 'half', 'bone', 'ink', -Math.PI / 2 + 0.05);
        b.hay(6.1, 0, -1.0, { ry: 0.4 }); b.hay(6.0, 0.55, -0.95, { ry: 0.55, w: 0.95 }); b.hay(6.1, 0, -0.1, { ry: -0.2 });
        b.sack(-4.4, 0, 0.35, 0.5); b.sack(-4.0, 0, 0.6, 0.44); b.ropeCoil(-5.1, 0, 0.4, 0.26);
        b.barrel(gx1 + 0.9, 0, gz + 1.3, {}); b.crate(gx1 + 1.0, 0, gz + 2.1, 0.65, { ry: 0.4 });
      });
      b.unit(function () {
        // a rack of practice spears behind the ring, in the sun, shields leant at its foot; sacks of sand by the fence
        var kx = -0.6, kz = -3.65, kry = -0.3;
        b.rack(kx, 0, kz, 1.6, { kind: 'spears', ry: kry });
        var sp = fwd(kx, kz, kry, 0.35, 0, 0.32);
        vShield(b, sp[0], 0.33, sp[2], kry, 0.3, 'quarter', 'ink', 'bone', -0.3);
        var sp2 = fwd(kx, kz, kry, -0.4, 0, 0.3);
        vShield(b, sp2[0], 0.33, sp2[2], kry + 0.15, 0.3, 'ring', 'bone', 'ink', -0.28);
        b.sack(5.75, 0, 2.0, 0.45); b.sack(5.55, 0, 1.55, 0.4);
      });

      b.life(function () {
        b.figure(rx + 1.05, rz + 0.35, { role: 'soldier', pose: 'swing', ry: -Math.PI / 2 + 0.2, team: 'ink' });
        b.figure(rx - 0.2, rz + 0.55, { role: 'soldier', pose: 'guard', ry: Math.PI / 2 + 0.15, team: 'bone' });
        var rp = fwd(hx, hz, hry, 0, 0, -0.08);
        b.figure(rp[0], rp[2], { role: 'villager', pose: 'trainyard_ride', ry: hry, s: 0.82, y: seat - 0.75 + 0.03, c: '#d9d2c3', hair: '#b08a5a' });
        // the riding master stands out ahead of the carved head, calling the seat
        var mp = fwd(hx, hz, hry, 1.0, 0, 2.0);
        b.figure(mp[0], mp[2], { role: 'villager', pose: 'point', ry: Math.atan2(hx - mp[0], hz - mp[2]) + 0.25, beard: true, c: '#5c5e62', cape: 'ink' });
        // a third fighter working the dummy at the back of the ring
        b.figure(rx - 0.85, rz - 1.55, { role: 'soldier', pose: 'swing', ry: Math.atan2(-0.75, -0.35), team: 'bone' });
        var la = 0.15, lp = [rx + Math.cos(la) * 3.98, rz + Math.sin(la) * 3.98];
        b.figure(lp[0], lp[1], { role: 'villager', pose: 'trainyard_lean', ry: Math.atan2(rx - lp[0], rz - lp[1]), c: '#6f6a62' });
        b.figure(-0.25, 4.85, { role: 'child', pose: 'cheer', ry: Math.atan2(hx + 0.25, hz - 4.85) });
        b.figure(-2.55, 2.75, { role: 'villager', pose: 'carry', ry: -2.3, c: '#8a857c' });
      });
    }
  });
})();
