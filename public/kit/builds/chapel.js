// Chapel: a stone chapel with three tall arched windows between buttresses, a round apse, and a square bell tower
// whose bell rings the muster. The belfry is open on all four sides, the bell hangs on its headstock with a wheel,
// and a slate spire carries the Hub pennant; a lych-gate with carved dragons opens the churchyard wall. Pews stand outside on the paving
// for the muster, facing the elder at the tower door. Built footings first, the nave walls course by course, the
// apse, the buttresses and window frames, the tower course by course, the gables, the roofs row by row, the belfry,
// the bell, the spire row by row, then the door, the yard, and last the people.
(function () {
  var T = THREE;
  function V(x, y, z) { return new T.Vector3(x, y, z); }

  KIT.PAL.chapelSlateLit = ['#565b61', '#5f646a', '#51565c', '#666b71'];

  // sitting on a pew, hands on the knees; pulling a bell rope, both hands up on it, leaning back
  KIT.people.poses.chapelSit = function (r) { return { feet: [V(-0.14, 0.09, 0.4), V(0.14, 0.09, 0.44)], hands: [V(-0.15, 0.66, 0.36), V(0.15, 0.68, 0.38)], lean: 0.06, twist: 0, side: 0, hip: 0, drop: 0.43, head: [r(0.25), 0.08], pole: [V(-1, -0.6, -0.2), V(1, -0.6, -0.2)] }; };
  KIT.people.poses.chapelPull = function () { return { feet: [V(-0.16, 0.09, 0.12), V(0.15, 0.09, -0.1)], hands: [V(-0.03, 1.86, 0.24), V(0.03, 1.56, 0.26)], lean: -0.07, twist: 0, side: 0, hip: 0, drop: 0.04, head: [0, -0.3], pole: [V(-1, -0.3, 0.1), V(1, -0.3, 0.1)] }; };

  // a point beside something standing at (x, z) turned ry, from its own frame (lx, lz)
  function chapelBy(x, z, ry, lx, lz) { return [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)]; }

  // a carved dragon head, the profile in the local XY plane, snout toward local +x, neck foot at (x, y, z)
  function chapelDragon(b, x, y, z, ry, s, o) {
    o = o || {}; var M = KIT.M, c = o.c || 'beam', m = o.m === undefined ? M.wood : o.m;
    var P = [[-0.1, 0], [-0.17, 0.28], [-0.15, 0.52], [-0.07, 0.74], [0.04, 0.9], [-0.04, 1.14], [0.14, 1.0], [0.24, 1.06], [0.36, 1.05], [0.5, 1.0], [0.74, 0.95],
      [0.85, 0.9], [0.8, 0.86], [0.6, 0.85], [0.42, 0.82], [0.62, 0.76], [0.71, 0.7], [0.64, 0.67], [0.4, 0.66], [0.22, 0.6], [0.12, 0.45], [0.09, 0.22], [0.12, 0]];
    b.push(x, y, z, ry);
    if (o.rz) b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(o.rz));
    b.extrude(0, 0, 0, P.map(function (p) { return [p[0] * s, p[1] * s]; }), (o.thick || 0.14) * s, { c: c, m: m, ao: 0.1, bevel: 0.01 });
    if (!o.plain) [[[-0.15, 0.36], [-0.34, 0.44], [-0.15, 0.52]], [[-0.1, 0.6], [-0.3, 0.72], [-0.06, 0.74]], [[0.0, 0.84], [-0.18, 1.0], [0.04, 0.92]]].forEach(function (f) {
      b.extrude(0, 0, 0, f.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.07 * s, { c: c, m: m, ao: 0.05, bevel: 0.005 });
    });
    [1, -1].forEach(function (sd) {
      b.ball(0.43 * s, 0.93 * s, sd * (o.thick || 0.14) * 0.54 * s, 0.035 * s, { c: o.eye || 'bone', m: M.paint, ao: 0, detail: 0 });
      if (!o.plain) b.box(0.4 * s, 0.97 * s, sd * 0.07 * s, 0.16 * s, 0.03 * s, 0.03 * s, { c: c, m: m, bevel: 0.004, rz: -0.25 });
    });
    if (o.foot !== false) b.box(0, 0, 0, 0.34 * s, 0.07 * s, (o.thick || 0.14) * 1.3 * s, { c: c, m: m, bevel: 0.01 });
    b.pop();
  }

  // The holes a stoneBox needs for an arched opening, course by course, so the stones are cut to the arch's curve:
  // opening w wide, sill at ySill (on a course line), inner arch top h above it, a ring of voussoirs ring wide.
  function chapelArchHoles(side, at, w, ring, ySill, h, wallY0, wallH, course) {
    var n = Math.max(1, Math.round(wallH / course)), ch = wallH / n, out = [], yS = ySill + h - w / 2, R = w / 2 + ring;
    for (var k = 0; k < n; k++) {
      var ym = wallY0 + (k + 0.5) * ch, half;
      if (ym < ySill) continue;
      if (ym <= yS) half = R; else { var dy = ym - yS; if (dy >= R * 0.96) continue; half = Math.sqrt(R * R - dy * dy); }
      out.push({ side: side, at: at, w: 2 * half, y0: ym - 0.01, y1: ym + 0.01 });
    }
    return out;
  }
  // snap a height to the course lines of a wall
  function chapelSnap(y, wallY0, wallH, course) { var n = Math.max(1, Math.round(wallH / course)), ch = wallH / n; return wallY0 + Math.round((y - wallY0) / ch) * ch; }

  // An arched opening's stonework, in a frame facing +z whose origin is the sill's centre on the wall's outer face:
  // jamb stones long and short up to the springing, a ring of voussoirs with a keystone, a sill. o.depth is the wall
  // thickness, o.out how proud of the face the frame stands. o.pane: a leaded window set into the wall; o.mullion.
  function chapelArch(b, w, h, o) {
    o = o || {}; var M = KIT.M, ring = o.ring || 0.26, depth = o.depth || 0.6, out = o.out || 0.06, fs = o.pal || 'sandstone';
    var yS = h - w / 2, ri = w / 2, dz = (out - depth) / 2, dd = depth + out;
    // jambs
    var jn = Math.max(2, Math.round(yS / 0.4)), jh = yS / jn;
    for (var q = 0; q < jn; q++) [-1, 1].forEach(function (sd) {
      var big = (q + (sd > 0 ? 1 : 0)) % 2 === 0, jw = big ? ring + 0.13 : ring;
      b.box(sd * (ri + jw / 2), q * jh + 0.02, dz, jw - 0.03, jh - 0.04, dd, { c: b.stoneC(fs, 2), m: M.stone, bevel: 0.045, ao: 0.15 });
    });
    // voussoirs
    var nv = o.nv || 9, rm = ri + ring / 2;
    for (var s = 0; s < nv; s++) {
      var a0 = Math.PI - (s + 0.5) / nv * Math.PI, key = s === (nv - 1) / 2, tw = Math.PI * rm / nv * 0.9;
      b.box(Math.cos(a0) * ri, yS + Math.sin(a0) * ri, dz + (key ? 0.02 : 0), tw * (key ? 1.15 : 1), ring * (key ? 1.2 : 1), dd + (key ? 0.04 : 0), { rz: a0 - Math.PI / 2, c: key ? 'bone' : b.stoneC(fs, 2), m: M.stone, bevel: 0.04, ao: 0.12 });
    }
    // the sill, weathered and proud
    if (o.sill !== false) b.box(0, -0.13, out / 2 + 0.04, w + 2 * ring + 0.12, 0.13, depth * 0.45 + out + 0.12, { c: b.stoneC(fs, 2), m: M.stone, bevel: 0.035 });
    if (o.pane) {
      // the glass set back half the wall, two lights under a mullion, the leads across it
      var pz = -depth * 0.55, pts = [[-w / 2, 0], [w / 2, 0], [w / 2, yS]];
      for (var i = 1; i < 10; i++) { var a = i / 10 * Math.PI; pts.push([Math.cos(a) * w / 2, yS + Math.sin(a) * w / 2]); }
      pts.push([-w / 2, yS]);
      b.extrude(0, 0, pz, pts, 0.08, { c: '#1f1f21', m: M.window, ao: 0, jit: 0 });
      if (o.mullion !== false) {
        b.box(0, 0, pz + 0.07, 0.1, yS + w * 0.18, 0.12, { c: b.stoneC(fs, 2), m: M.stone, bevel: 0.02 });
        // a little round light in the head between the two pointed lights
        var tor = new T.TorusGeometry(w * 0.17, 0.035, 4, 14);
        b.addGeo(tor, { x: 0, y: yS + w * 0.2 + w * 0.17, z: pz + 0.07, c: b.stoneC(fs, 2), m: M.stone, ao: 0 });
      }
      for (var yy = 0.32; yy < yS + w * 0.3; yy += 0.34) {
        var hw = yy <= yS ? w / 2 : Math.sqrt(Math.max(0, w * w / 4 - (yy - yS) * (yy - yS)));
        if (hw > 0.08) b.box(0, yy, pz + 0.055, hw * 2 - 0.02, 0.022, 0.02, { c: '#2b2a28', m: M.metal, bevel: 0, ao: 0 });
      }
    }
  }

  // A buttress against a wall facing +z, laid stone by stone: deep at the foot, a set-off, then shallower, each
  // stage capped with a sloping weathering stone. (x, y0, z) is its foot's centre on the wall face.
  function chapelButtress(b, x, y0, z, w, d1, h1, d2, h2) {
    var M = KIT.M, ch = 0.34;
    function stage(ya, yb, d) {
      var n = Math.max(1, Math.round((yb - ya) / ch)), c = (yb - ya) / n;
      for (var k = 0; k < n; k++) {
        var y = ya + k * c, split = 0.3 + b.r() * 0.4;
        if (k % 2 === 0) {
          b.box(x - w / 2 + w * split / 2, y, z + d / 2, w * split - 0.04, c - 0.04, d + b.j(0.02), { c: b.stoneC('stone', y), m: M.stone, bevel: 0.05 });
          b.box(x + w * split / 2, y, z + d / 2, w * (1 - split) - 0.04, c - 0.04, d + b.j(0.02), { c: b.stoneC('stone', y), m: M.stone, bevel: 0.05 });
        } else {
          b.box(x, y, z + d * split / 2, w + b.j(0.02), c - 0.04, d * split - 0.04, { c: b.stoneC('stone', y), m: M.stone, bevel: 0.05 });
          b.box(x, y, z + d * split + d * (1 - split) / 2, w + b.j(0.02), c - 0.04, d * (1 - split) - 0.04, { c: b.stoneC('stone', y), m: M.stone, bevel: 0.05 });
        }
      }
    }
    // a weathering: a wedge of sandstone sloping down to the front
    function cap(y, d, rise) { b.extrude(x, y, z, [[0, 0], [d + 0.06, 0], [d + 0.06, 0.08], [0, rise]], w + 0.08, { ry: -Math.PI / 2, c: b.stoneC('sandstone', 3), m: M.stone, bevel: 0.015 }); }
    stage(y0, y0 + h1, d1); cap(y0 + h1 - 0.02, d1, 0.42);
    stage(y0 + h1, y0 + h1 + h2, d2); cap(y0 + h1 + h2 - 0.02, d2, 0.5);
  }

  // A square spire laid slate by slate: base w x w at y, rising h; four faces per row, hip caps up the corners.
  function chapelSpire(b, x, y, z, w, h, o) {
    o = o || {}; var M = KIT.M, PAL = KIT.PAL, U = KIT.util, over = o.over || 0.25, rows = o.rows || 9;
    var a = w / 2 + over, drop = over * h / (w / 2), H = h + drop, Ls = Math.hypot(a, H), phi = Math.atan2(H, a), rl = Ls / rows, th = 0.07;
    var MOSS = new T.Color('#7f8657'), cache = {};
    // one slate, darker at its upper end where it tucks under the row above
    function slate(len) {
      var key = len.toFixed(3); if (cache[key]) return cache[key];
      var g = KIT.geo.chamferBox(1, th, len, 0.02); g.computeBoundingBox();
      var p = g.attributes.position, za = g.boundingBox.min.z, zb = g.boundingBox.max.z, cl = [];
      for (var i = 0; i < p.count; i++) { var t = (p.getZ(i) - za) / Math.max(1e-4, zb - za), v = 0.62 + 0.38 * Math.pow(U.smooth(0, 0.75, t), 0.8); cl.push(v, v, v * 0.98); }
      g.setAttribute('color', new T.Float32BufferAttribute(cl, 3));
      return (cache[key] = g);
    }
    b.push(x, y - drop, z, 0);
    b.unit(function () { b.addGeo(KIT.geo.frustum(2 * a * 0.985, 2 * a * 0.985, 0.03, 0.03, H * 0.995), { c: '#2c2f33', m: M.tile, ao: 0.2, jit: 0.01 }); });
    for (var r = 0; r < rows; r++) {
      b.unit(function () {
        for (var k = 0; k < 4; k++) {
          var t0 = r * rl, t1 = Math.min(Ls * 0.99, (r + 1) * rl + rl * 0.35), tm = (t0 + t1) / 2, f = tm / Ls, len = t1 - t0;
          var hw = a * (1 - (t0 + rl * 0.5) / Ls) - 0.02; if (hw < 0.06) continue;
          var n = Math.max(1, Math.round(2 * hw / 0.34)), pw = 2 * hw / n, odd = r % 2 === 1;
          var g = slate(len);
          b.push(0, 0, 0, k * Math.PI / 2);
          b.push(0, H * f, a * (1 - f), 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(phi - 0.035));
          var cuts = []; if (odd && n > 1) { cuts.push([-hw, -hw + pw / 2]); for (var i = 0; i < n - 1; i++) cuts.push([-hw + pw / 2 + i * pw, -hw + pw / 2 + (i + 1) * pw]); cuts.push([hw - pw / 2, hw]); } else for (var i2 = 0; i2 < n; i2++) cuts.push([-hw + i2 * pw, -hw + (i2 + 1) * pw]);
          cuts.forEach(function (cu) {
            var cc = U.col(b.pick(PAL.slate)), q = b.r();
            if (q < 0.12) cc.offsetHSL(0.006, -0.04, -0.035); else if (q < 0.24) cc.offsetHSL(-0.006, 0.01, 0.03); else if (q < 0.28) cc.lerp(MOSS, 0.15);
            b.addGeo(g, { x: (cu[0] + cu[1]) / 2, y: b.j(0.006), z: b.j(0.015), sx: (cu[1] - cu[0]) * 0.95, ry: b.j(0.012), rz: b.j(0.01), c: cc, m: M.tile, ao: 0.3, jit: 0.02, vary: 0.04 });
          });
          b.pop(); b.pop();
        }
      });
    }
    b.unit(function () {
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (c) { b.beam([c[0] * (a + 0.02), 0.05, c[1] * (a + 0.02)], [0, H + 0.02, 0], 0.07, { c: '#2e3134', m: M.tile, round: true, seg: 6 }); });
    });
    b.pop();
  }

  // a round shield on a wall facing +z, painted in quarters
  function chapelShield(b, x, y, z, c1, c2, s) {
    var M = KIT.M, r = 0.42 * s * 0.97, n = 8;
    b.shield(x, y, z, { kind: 'round', c: c1, s: s });
    if (c2) [0, Math.PI].forEach(function (a0) {
      var pts = [[0, 0]]; for (var i = 0; i <= n; i++) { var a = a0 + Math.PI / 4 + i / n * Math.PI / 2; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      b.extrude(x, y, z + 0.053, pts, 0.006, { c: c2, m: M.paint, ao: 0, jit: 0.01 });
    });
  }

  // an outdoor pew: two seat planks on end boards, a back of two rails; faces +z
  function chapelPew(b, x, z, L, ry) {
    var M = KIT.M;
    b.push(x, 0, z, ry);
    b.box(0, 0.42, 0.07, L, 0.05, 0.19, { c: 'woodLight', m: M.wood, bevel: 0.012 });
    b.box(0, 0.42, -0.13, L, 0.05, 0.18, { c: 'woodLight', m: M.wood, bevel: 0.012 });
    [-1, 1].forEach(function (sd) {
      b.box(sd * (L / 2 - 0.14), 0, -0.03, 0.07, 0.42, 0.42, { c: 'wood', m: M.wood, bevel: 0.012 });
      b.box(sd * (L / 2 - 0.14), 0, -0.24, 0.07, 0.98, 0.07, { c: 'wood', m: M.wood, bevel: 0.012 });
    });
    if (L > 2) b.box(0, 0, -0.03, 0.07, 0.42, 0.36, { c: 'wood', m: M.wood, bevel: 0.012 });
    b.box(0, 0.62, -0.25, L - 0.1, 0.1, 0.04, { c: 'woodLight', m: M.wood, bevel: 0.01 });
    b.box(0, 0.82, -0.25, L + 0.05, 0.13, 0.05, { c: 'wood', m: M.wood, bevel: 0.012 });
    b.pop();
  }

  // a lantern on a post, its arm reaching toward (dx, dz)
  function chapelLantern(b, x, z, dx, dz, y0) {
    var M = KIT.M, h = 2.15, lx = x + dx * 0.44, lz = z + dz * 0.44, ly = y0 + h - 0.72;
    b.post(x, y0 - 0.05, z, 0.065, h + 0.05, { c: 'woodDark' });
    b.box(x, y0 - 0.05, z, 0.26, 0.2, 0.26, { c: 'stone', m: M.stone, bevel: 0.04 });
    b.beam([x, y0 + h - 0.12, z], [x + dx * 0.5, y0 + h - 0.12, z + dz * 0.5], 0.035, { c: 'woodDark' });
    b.beam([x, y0 + h - 0.5, z], [x + dx * 0.28, y0 + h - 0.14, z + dz * 0.28], 0.025, { c: 'woodDark' });
    b.beam([lx, y0 + h - 0.14, lz], [lx, ly + 0.42, lz], 0.008, { c: 'iron', m: M.metal, round: true, seg: 4 });
    b.box(lx, ly, lz, 0.22, 0.04, 0.22, { c: 'iron', m: M.metal, bevel: 0.01 });
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (c) { b.box(lx + c[0] * 0.095, ly + 0.04, lz + c[1] * 0.095, 0.025, 0.27, 0.025, { c: 'iron', m: M.metal, bevel: 0 }); });
    b.cone(lx, ly + 0.3, lz, 0.17, 0.13, { c: 'iron', m: M.metal, seg: 4, ry: Math.PI / 4, flat: true });
    b.ball(lx, ly + 0.44, lz, 0.03, { c: 'iron', m: M.metal, detail: 0 });
    b.flame(lx, ly + 0.05, lz, 0.26, { i: 0.7 });
  }

  // a carved rune stone: a rounded slab with a serpent band round its face and a few runes, facing +z
  function chapelRuneStone(b, x, y, z, h, ry) {
    var M = KIT.M, wd = 0.82;
    var P = [[-0.4, 0], [0.4, 0], [0.44, 0.5], [0.38, 0.8], [0.22, 0.95], [0.0, 1.0], [-0.22, 0.95], [-0.36, 0.78], [-0.43, 0.45]].map(function (p) { return [p[0] * wd / 0.82, p[1] * h]; });
    b.push(x, y - 0.08, z, ry);
    b.extrude(0, 0, 0, P, 0.3, { c: 'stoneCool', m: M.rock, bevel: 0.05, ao: 0.35 });
    var cx = 0, cy = h * 0.48;
    function scaled(k) { return P.map(function (p) { return [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]; }); }
    var outer = scaled(0.84), inner = scaled(0.7).reverse();
    [0.2, -0.2].forEach(function (zz) {
      b.extrude(0, 0.0, zz * 0.92, outer, 0.02, { c: '#3a3936', m: M.paint, ao: 0, jit: 0.01, holes: [inner] });
    });
    // the serpent's head and a few runes in the field
    b.ball(0.22 * wd, h * 0.12, 0.17, 0.06, { c: '#3a3936', m: M.paint, sz: 0.3, detail: 0 });
    for (var i = 0; i < 4; i++) {
      var ry0 = h * (0.3 + i * 0.13);
      b.box(-0.06, ry0, 0.165, 0.025, 0.09, 0.02, { c: '#3a3936', m: M.paint, bevel: 0, ao: 0 });
      b.box(0.02, ry0 + 0.02, 0.165, 0.07, 0.022, 0.02, { c: '#3a3936', m: M.paint, bevel: 0, ao: 0, rz: i % 2 ? 0.7 : -0.7 });
    }
    b.pop();
  }

  KIT.defineBuild('chapel', {
    name: 'Chapel', size: 'middle', need: 45,
    line: 'A stone chapel with tall arched windows, a round apse, and a bell tower whose bell rings the muster.',
    r: 14, flat: [19.4, 16.6], ground: 'grass', path: [[3.4, 14.8], [5.1, 9.0], [5.7, 6.0]],
    frameY: 4.7, frameR: 13.8, glowAt: [5.7, 16.1, 0.7],
    perches: [{ x: -2.6, y: 8.5, z: -1.1, ry: 0 }, { x: 1.4, y: 8.5, z: -1.1, ry: Math.PI }],
    trees: [{ x: -9.8, z: -5.8, kind: 'round', h: 6.4 }, { x: 10.6, z: -4.6, kind: 'pine', h: 8.6 }, { x: -11.0, z: 3.0, kind: 'olive', h: 4.6 }, { x: 11.0, z: 2.6, kind: 'cypress', h: 7.2 }],
    bushes: [{ x: 8.1, z: 10.1, r: 0.9, flowers: '#f3f1ec' }, { x: -5.4, z: 10.0, r: 0.8 }, { x: 10.8, z: -0.8, r: 0.7 }, { x: -10.4, z: -1.4, r: 0.75, flowers: '#f3f1ec' }],
    build: function (b) {
      var M = KIT.M;
      var base = 0.55, Tw = 0.6;
      // the nave: x -5..4, z -3.8..1.6
      var cx = -0.5, cz = -1.1, W = 9, D = 5.4, H1 = 4.9, course = 0.34;
      var x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2, eave = base + H1, rise = 2.9;
      // the apse, a half round on the left gable
      var ax = x0 + Tw / 2, ar = 2.0, Ha = 3.9;
      // the bell tower on the front-right, in the sun: x 4..7.4, z -1..2.4
      var tcx = 5.7, tcz = 0.7, S = 3.4, Tt = 0.65, tx0 = tcx - S / 2, tx1 = tcx + S / 2, tz0 = tcz - S / 2, tz1 = tcz + S / 2;
      var tH = 7.8, tCourse = 0.39, bel0 = base + tH + 0.2, belH = 2.9, belC = 0.362, corn = bel0 + belH;

      // the ground: a flagged forecourt before the tower door and the pews, the rest a grassy churchyard
      b.base(function () {
        function rectD(x, z, r) { return Math.hypot(Math.max(0, r[0] - x, x - r[1]), Math.max(0, r[2] - z, z - r[3])); }
        var R1 = [-2.4, 9.2, 1.5, 5.9], R2 = [7.3, 9.2, -2.4, 1.6];
        function paveD(x, z) { return Math.min(rectD(x, z, R1), rectD(x, z, R2)); }
        function built(x, z, m) { return (x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m) || (x > tx0 - m && x < tx1 + m && z > tz0 - m && z < tz1 + m) || Math.hypot(x - ax, z - cz) < ar + Tw / 2 + m; }
        var step = 0.86;
        for (var gz = -2.8, row = 0; gz <= 6.6; gz += step * 0.78, row++) for (var gx = -3.2; gx <= 9.9; gx += step) {
          var jx = gx + b.j(step * 0.12) + (row % 2) * step * 0.5, jz = gz + b.j(step * 0.07);
          if (paveD(jx, jz) > 0.55 * (0.35 + b.r())) continue;
          if (built(jx, jz, 0.25)) continue;
          b.box(jx, -0.06, jz, step * (0.82 + b.j(0.08)), 0.12, step * 0.64, { ry: b.j(0.1), c: b.stoneC('stone', 0.6).offsetHSL(0, -0.02, -0.04), m: M.stone, bevel: 0.04, ao: 0.1, jit: 0.05 });
        }
        // tufts and flowers over the churchyard grass
        for (var t = 0; t < 180; t++) {
          var x = -9.6 + b.r() * 19.2, z = -6.2 + b.r() * 14.8;
          if (paveD(x, z) < 0.5 || built(x, z, 0.4) || (z > 5.5 && Math.abs(x - 5.3) < 1.1)) continue;
          b.grass(x, 0.0, z, 0.28 + b.r() * 0.3);
          if (b.r() < 0.2) b.flowers(x, 0.0, z, 0.3, { n: 3 + Math.round(b.r() * 4) });
        }
      });

      b.part('Footings');
      b.unit(function () {
        b.box(cx, -0.08, cz, W + 1.0, 0.36, D + 1.0, { c: 'stoneDark', bevel: 0.08 });
        b.box(tcx, -0.08, tcz, S + 1.0, 0.36, S + 1.0, { c: 'stoneDark', bevel: 0.08 });
        b.cyl(ax, -0.08, cz, ar + Tw / 2 + 0.5, 0.36, { c: 'stoneDark', m: M.stone, seg: 24, flat: true });
      });
      b.unit(function () {
        b.box(cx, 0.28, cz, W + 0.55, 0.27, D + 0.55, { c: 'stone', bevel: 0.07 });
        b.box(tcx, 0.28, tcz, S + 0.55, 0.27, S + 0.55, { c: 'stone', bevel: 0.07 });
        b.cyl(ax, 0.28, cz, ar + Tw / 2 + 0.27, 0.27, { c: 'stone', m: M.stone, seg: 24, flat: true });
      });

      b.part('Nave walls');
      var winX = [-3.0, 0.0, 3.0], winW = 1.0, winH = 2.85, winRing = 0.26, winSill = chapelSnap(1.6, base, H1, course);
      var holes = [];
      winX.forEach(function (at) { holes = holes.concat(chapelArchHoles('front', at, winW, winRing, winSill, winH, base, H1, course)); });
      b.stoneBox(cx, cz, W, D, base, H1, Tw, { pal: 'stone', course: course, len: 0.66, holes: holes });

      b.part('Apse');
      b.stoneRing(ax, cz, ar, base, Ha, Tw, { pal: 'stone', course: 0.34, len: 0.62, hole: function (a) { return Math.cos(a) > 0.02; } });

      b.part('Buttresses');
      [-1.5, 1.5].forEach(function (at) { b.unit(function () { chapelButtress(b, cx + at, base, z1, 0.74, 0.9, 1.75, 0.52, 1.6); }); });

      b.part('Window frames');
      b.unit(function () { winX.forEach(function (at) { b.push(cx + at, winSill, z1, 0); chapelArch(b, winW, winH, { ring: winRing, depth: Tw, pane: true }); b.pop(); }); });
      b.unit(function () {
        // two narrow lights in the apse, set on its curve
        [Math.PI * 0.74, Math.PI * 1.02].forEach(function (a) {
          var rr = ar + Tw / 2 + 0.01;
          b.push(ax + Math.cos(a) * rr, base + 1.1, cz + Math.sin(a) * rr, Math.PI / 2 - a);
          chapelArch(b, 0.55, 2.1, { ring: 0.2, depth: 0.22, out: 0.12, nv: 7, pal: 'sandstone' });
          var ys = 2.1 - 0.275, pts = [[-0.275, 0], [0.275, 0], [0.275, ys]]; for (var i = 1; i < 8; i++) { var q = i / 8 * Math.PI; pts.push([Math.cos(q) * 0.275, ys + Math.sin(q) * 0.275]); } pts.push([-0.275, ys]);
          b.extrude(0, 0, 0.05, pts, 0.06, { c: '#1f1f21', m: M.window, ao: 0, jit: 0 });
          [0.42, 0.8, 1.18, 1.56].forEach(function (yy) { b.box(0, yy, 0.085, 0.53, 0.02, 0.02, { c: '#2b2a28', m: M.metal, bevel: 0, ao: 0 }); });
          b.pop();
        });
      });

      b.part('Bell tower');
      var doorW = 1.3, doorH = 2.55, slitSill = chapelSnap(5.2, base, tH, tCourse);
      var tHoles = chapelArchHoles('front', 0, doorW, 0.28, base, doorH, base, tH, tCourse)
        .concat(chapelArchHoles('right', 0, 0.42, 0.18, slitSill, 1.1, base, tH, tCourse));
      b.stoneBox(tcx, tcz, S, S, base, tH, Tt, { pal: 'stone', course: tCourse, len: 0.7, holes: tHoles });

      b.part('Tower doorway and slits');
      b.unit(function () {
        b.push(tcx, base, tz1, 0);
        chapelArch(b, doorW, doorH, { ring: 0.28, depth: Tt, out: 0.08, sill: false, nv: 9 });
        // the dark of the tower inside the open doors
        var pts = [[-doorW / 2, 0], [doorW / 2, 0], [doorW / 2, doorH - doorW / 2]];
        for (var i = 1; i < 10; i++) { var a = i / 10 * Math.PI; pts.push([Math.cos(a) * doorW / 2, doorH - doorW / 2 + Math.sin(a) * doorW / 2]); }
        pts.push([-doorW / 2, doorH - doorW / 2]);
        b.extrude(0, 0, -Tt * 0.7, pts, 0.1, { c: '#221d1a', m: M.dark, ao: 0, jit: 0 });
        b.box(0, -0.02, -Tt / 2, doorW, 0.06, Tt, { c: 'stoneDark', m: M.stone, bevel: 0.02 });
        b.pop();
        // a slit in the sunny side
        b.push(tx1, slitSill, tcz, Math.PI / 2); chapelArch(b, 0.42, 1.1, { ring: 0.18, depth: Tt, pane: true, mullion: false, nv: 5 }); b.pop();
      });

      b.part('Gables');
      // both gables, laid course by course together: the left one above the apse, the right one against the tower
      (function () {
        var ch = 0.34, n = Math.floor(rise / ch);
        for (var k = 0; k < n; k++) {
          var y = eave + k * ch, hw = D / 2 * (1 - (k + 1) * ch / rise) - 0.03;
          if (hw < 0.18) break;
          b.unit(function () {
            b.stoneWall(x0 + Tw / 2, cz - hw, x0 + Tw / 2, cz + hw, y, ch, Tw, { pal: 'stone', course: ch, len: 0.66 });
            b.stoneWall(x1 - Tw / 2, cz + hw, x1 - Tw / 2, cz - hw, y, ch, Tw, { pal: 'stone', course: ch, len: 0.66 });
          });
        }
      })();

      b.part('Nave roof');
      var over = 0.35, rcx = (x0 - 0.42 + x1) / 2, rw = x1 - (x0 - 0.42);
      b.gableRoof(rcx, eave, cz, rw, D, rise, { m: 'slate', over: over, rows: 8, overX: 0 });
      b.unit(function () {
        // barge boards on the left gable, and on its peak a carved dragon looking out over the apse
        var slope = Math.atan2(rise, D / 2), half = D / 2 + over, bx = x0 - 0.42 - 0.06;
        var ye = eave - over * Math.tan(slope) + 0.16, yTop = eave + rise + 0.16;
        [-1, 1].forEach(function (sd) { b.beam([bx + sd * 0.03, ye, cz + sd * half], [bx + sd * 0.03, yTop, cz], 0.05, { c: 'beam', r2: 0.15 }); });
        chapelDragon(b, bx + 0.12, yTop - 0.06, cz, Math.PI, 1.15, { rz: -0.3, c: 'beam' });
      });

      b.part('Apse roof');
      b.unit(function () {
        // a corbel table of sandstone round the apse under its eave
        var rr = ar + Tw / 2 + 0.07;
        for (var i = 0; i <= 11; i++) { var a = Math.PI * 0.6 + i / 11 * Math.PI * 0.8; b.box(ax + Math.cos(a) * rr, base + Ha - 0.3, cz + Math.sin(a) * rr, 0.22, 0.26, 0.24, { ry: Math.PI / 2 - a, c: b.stoneC('sandstone', 3), m: M.stone, bevel: 0.04 }); }
      });
      b.coneRoof(ax, base + Ha, cz, ar + Tw / 2 + 0.24, 1.95, { m: 'slate', c: 'chapelSlateLit', rows: 6, flare: 0.1, seg: 22 });
      b.unit(function () { b.lathe(ax, base + Ha + 1.8, cz, [[0.16, 0], [0.12, 0.12], [0.06, 0.3], [0.1, 0.4], [0.01, 0.55]], { c: 'iron', m: M.metal, seg: 8 }); });

      b.part('Belfry');
      b.unit(function () {
        // the string course between tower and belfry
        b.box(tcx, bel0 - 0.22, tcz, S + 0.24, 0.24, S + 0.24, { c: 'sandstone', bevel: 0.05 });
        // the bell chamber floor
        for (var i = 0; i < 8; i++) b.box(tcx - (S - 2 * Tt) / 2 + (i + 0.5) * (S - 2 * Tt) / 8, bel0 + 0.02, tcz, (S - 2 * Tt) / 8 - 0.02, 0.06, S - 2 * Tt, { c: b.pick(['woodLight', 'wood']), m: M.wood, bevel: 0.01 });
      });
      var bSill = chapelSnap(bel0 + 0.34, bel0, belH, belC), bW = 1.5, bWs = 1.3, bH = 1.58;
      var bHoles = [];
      ['front', 'back', 'left', 'right'].forEach(function (sd) { bHoles = bHoles.concat(chapelArchHoles(sd, 0, sd === 'front' || sd === 'back' ? bW : bWs, 0.22, bSill, bH, bel0, belH, belC)); });
      b.stoneBox(tcx, tcz, S, S, bel0, belH, Tt, { pal: 'stone', course: belC, len: 0.7, holes: bHoles });
      b.unit(function () {
        [[tcx, tz1, 0, bW], [tcx + S / 2, tcz, Math.PI / 2, bWs], [tcx, tz0, Math.PI, bW], [tcx - S / 2, tcz, -Math.PI / 2, bWs]].forEach(function (f) {
          b.push(f[0], bSill, f[1], f[2]);
          chapelArch(b, f[3], bH, { ring: 0.22, depth: Tt, out: 0.06, nv: 9 });
          // a low timber rail across the opening
          b.box(0, 0.42, -Tt * 0.5, f[3], 0.08, 0.1, { c: 'woodDark', m: M.wood, bevel: 0.015 });
          b.pop();
        });
      });

      b.part('The bell');
      // the bell hangs forward and to the right of the chamber's middle, where the front arch shows it
      var bx = tcx + 0.32, bz = tcz + 0.42;
      b.unit(function () {
        // the bell frame: two oak posts on sills, the bearings on top
        [-1, 1].forEach(function (sd) {
          b.post(bx + sd * 0.68, bel0, bz, 0.08, 1.95, { c: 'beam' });
          b.box(bx + sd * 0.68, bel0 + 0.04, bz, 0.24, 0.12, 1.2, { c: 'beam', m: M.wood, bevel: 0.02 });
          b.beam([bx + sd * 0.68, bel0 + 0.1, bz - 0.5], [bx + sd * 0.68, bel0 + 0.9, bz], 0.04, { c: 'beam' });
          b.box(bx + sd * 0.68, bel0 + 1.95, bz, 0.22, 0.1, 0.3, { c: 'iron', m: M.metal, bevel: 0.01 });
        });
      });
      b.unit(function () {
        // the bell, swung part way on its headstock, the ringing wheel beside it
        var hy = bel0 + 1.9, tilt = -0.32;
        b.push(bx, hy, bz, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(tilt));
        b.box(0, -0.06, 0, 1.44, 0.16, 0.18, { c: 'beam', m: M.wood, bevel: 0.02 });
        b.lathe(0, -1.06, 0, [[0.01, 0.24], [0.44, 0.11], [0.56, 0.0], [0.59, 0.07], [0.51, 0.2], [0.42, 0.46], [0.36, 0.77], [0.33, 0.88], [0.23, 0.97], [0.01, 1.0]], { c: '#a8844c', m: M.metal, seg: 18, sx: 0.86, sz: 0.86, sy: 0.92 });
        b.box(0, -0.16, 0, 0.24, 0.12, 0.12, { c: 'iron', m: M.metal, bevel: 0.01 });
        b.ball(0, -1.08, 0, 0.08, { c: 'iron', m: M.metal, detail: 0 });
        var wx = -0.58, wr = 0.46;
        b.addGeo(new T.TorusGeometry(wr, 0.035, 4, 22), { x: wx, y: -0.06, z: 0, ry: Math.PI / 2, c: 'woodLight', m: M.wood, ao: 0 });
        for (var i = 0; i < 6; i++) { var a = i / 6 * Math.PI * 2; b.beam([wx, -0.06, 0], [wx, -0.06 + Math.sin(a) * wr, Math.cos(a) * wr], 0.022, { c: 'woodLight' }); }
        b.pop();
        // the rope off the wheel, down through the floor
        b.beam([bx - 0.58, hy - 0.5, bz - 0.12], [bx - 0.58, bel0 + 0.05, bz - 0.25], 0.016, { c: 'rope', m: M.rope, round: true, seg: 4 });
      });

      b.part('Cornice');
      b.unit(function () {
        // corbels under a jutting cornice
        [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(function (d) {
          for (var i = 0; i < 6; i++) {
            var t = -S / 2 + 0.3 + i * (S - 0.6) / 5, px = tcx + d[0] * (S / 2 + 0.1) + (d[1] !== 0 ? t : 0), pz = tcz + d[1] * (S / 2 + 0.1) + (d[0] !== 0 ? t : 0);
            b.box(px, corn - 0.3, pz, d[0] !== 0 ? 0.28 : 0.24, 0.3, d[0] !== 0 ? 0.24 : 0.28, { c: b.stoneC('sandstone', 3), m: M.stone, bevel: 0.04, taper: 1.0 });
          }
        });
        b.box(tcx, corn, tcz, S + 0.42, 0.3, S + 0.42, { c: 'sandstone', bevel: 0.06 });
      });
      b.part('Spire');
      chapelSpire(b, tcx, corn + 0.3, tcz, S + 0.42, 4.2, { over: 0.2, rows: 9 });
      b.unit(function () {
        var top = corn + 0.3 + 4.2;
        b.lathe(tcx, top - 0.1, tcz, [[0.12, 0], [0.08, 0.2], [0.13, 0.32], [0.04, 0.42], [0.01, 0.5]], { c: 'iron', m: M.metal, seg: 8 });
        b.flag(tcx, top + 0.3, tcz, 1.15, 1.3, 0.5, { c: 'ember', pennant: true, emblem: 'none', ry: -0.6 });
      });

      b.part('Door and porch hood');
      b.unit(function () {
        // the two plank doors stand open
        [-1, 1].forEach(function (sd) {
          var lw = doorW / 2 - 0.03, lh = doorH - doorW * 0.22;
          b.push(tcx + sd * doorW / 2, base + 0.02, tz1 + 0.02, sd * 1.15);
          for (var i = 0; i < 3; i++) b.box(-sd * lw * (i + 0.5) / 3, 0, 0.04, lw / 3 - 0.02, lh * (1 - 0.03 * i), 0.07, { c: b.pick(['#5f4f3f', '#574839', '#655443']), m: M.wood, bevel: 0.012, ao: 0.35 });
          [0.4, lh - 0.5].forEach(function (yy) { b.box(-sd * lw / 2, yy, 0.09, lw, 0.06, 0.02, { c: 'iron', m: M.metal, bevel: 0.005 }); b.ball(-sd * lw * 0.97, yy + 0.03, 0.1, 0.03, { c: 'iron', m: M.metal, detail: 0 }); });
          b.pop();
        });
      });
      b.unit(function () {
        // stone steps up to the door
        [[0, 1.1, 0.37, 0.48], [1, 1.5, 0.19, 0.42]].forEach(function (st) {
          var zc = tz1 + 0.28 + (st[0] === 0 ? 0.24 : 0.69), parts = st[0] === 0 ? 3 : 4, wd = st[1] * 2 / parts;
          for (var i = 0; i < parts; i++) b.box(tcx - st[1] + wd * (i + 0.5), -0.03, zc, wd - 0.04, st[2] + 0.03, st[3], { c: b.stoneC('stone', 0.5), m: M.stone, bevel: 0.04 });
        });
      });
      b.unit(function () {
        // a timber hood over the door on carved brackets, slate roofed, a dragon on each barge board
        var hy = base + doorH + 0.62, hz = tz1, hw = 2.2, hd = 1.15;
        [-1, 1].forEach(function (sd) {
          b.beam([tcx + sd * 0.95, hy - 1.05, hz + 0.02], [tcx + sd * 0.95, hy - 0.06, hz + hd - 0.12], 0.06, { c: 'beam' });
          b.box(tcx + sd * 0.95, hy - 0.14, hz, 0.12, 0.14, hd, { c: 'beam', m: M.wood, bevel: 0.02 });
        });
        b.box(tcx, hy - 0.16, hz + 0.08, hw + 0.1, 0.16, 0.16, { c: 'beam', m: M.wood, bevel: 0.02 });
        b.box(tcx, hy - 0.16, hz + hd - 0.12, hw, 0.12, 0.12, { c: 'beam', m: M.wood, bevel: 0.02 });
        b.gableEnd(tcx, hy - 0.04, hz + hd - 0.14, hw - 0.2, 0.68, 0.06, { c: 'woodDark', m: M.wood, ry: 0 });
        b.push(tcx, hy, hz + hd / 2 - 0.05, Math.PI / 2);
        b.gableRoof(0, 0, 0, hd + 0.05, hw, 0.8, { m: 'slate', over: 0.16, rows: 3, rowsAsUnits: false, overX: 0.06 });
        b.pop();
        var sl = Math.atan2(0.8, hw / 2), ca = Math.cos(sl), sa = Math.sin(sl), fz = hz + hd + 0.02;
        [-1, 1].forEach(function (sd) {
          b.beam([tcx + sd * (hw / 2 + 0.16), hy - 0.13, fz + sd * 0.03], [tcx - sd * 0.38 * ca, hy + 0.8 + 0.12 + 0.38 * sa, fz + sd * 0.03], 0.035, { c: 'beam', r2: 0.1 });
        });
        [-1, 1].forEach(function (sd) {
          // the dragons look out to either side over the steps
          chapelDragon(b, tcx - sd * 0.38 * ca, hy + 0.88 + 0.38 * sa, fz + sd * 0.03, sd > 0 ? Math.PI : 0, 0.5, { rz: -0.45, foot: false });
        });
      });
      b.unit(function () { [-1, 1].forEach(function (sd) { b.torch(tcx + sd * 1.25, base + 1.55, tz1 + 0.02, { s: 0.6 }); }); });

      b.part('Banner and shields');
      b.unit(function () {
        // the muster banner hung flat on the tower front from an iron rod
        var by = bel0 - 0.5, bz = tz1 + 0.16;
        [-1, 1].forEach(function (sd) { b.beam([tcx + sd * 0.55, by, tz1 - 0.05], [tcx + sd * 0.55, by, bz + 0.02], 0.03, { c: 'iron', m: M.metal }); });
        b.banner(tcx, by, bz, 1.0, 1.75, { c: 'ink', emblem: 'none', tail: 'swallow', band: 'ember', bandAt: 0.74, bandH: 0.05, trim: 'iron', ry: 0 });
        // the sun of the muster, drawn proud of the cloth's folds
        b.emblem(tcx, by - 1.75 * 0.42, bz + 0.035, 0.64, 'sun', '#f1eee8');
      });
      b.unit(function () {
        [-1.5, 1.5].forEach(function (at, i) { chapelShield(b, cx + at, base + 1.2, z1 + 0.9 + 0.035, i ? 'bone' : 'ink', null, 0.85); });
      });

      b.part('Pews');
      var pews = [[2.55, 4.55, 2.6], [0.85, 4.75, 2.6], [-0.85, 4.95, 2.6]];
      pews.forEach(function (p) { b.unit(function () { chapelPew(b, p[0], p[1], p[2], Math.PI / 2); }); });

      b.part('Churchyard wall');
      // a low dry-stone wall right round the churchyard, two courses and a row of capstones, broken by the lych-gate
      var gx = 5.12, gz = 8.9;
      var wallSegs = [[[-9.2, -4.2], [-9.2, 6.4]], [[-9.2, 6.4], [-7.4, 8.4]], [[-7.4, 8.4], [gx - 1.13, gz]], [[gx + 1.13, gz], [9.5, 7.4]]];
      [0, 1].forEach(function (k) {
        b.unit(function () { wallSegs.forEach(function (sg) { b.stoneWall(sg[0][0], sg[0][1], sg[1][0], sg[1][1], k * 0.31, 0.31, 0.5, { pal: 'stoneCool', course: 0.31, len: 0.55 }); }); });
      });
      b.unit(function () {
        wallSegs.forEach(function (sg) {
          var dx = sg[1][0] - sg[0][0], dz = sg[1][1] - sg[0][1], L = Math.hypot(dx, dz), n = Math.round(L / 0.3), ry = -Math.atan2(dz, dx);
          for (var i = 0; i < n; i++) { var t = (i + 0.5) / n; b.box(sg[0][0] + dx * t, 0.6, sg[0][1] + dz * t, 0.2 + b.j(0.03), 0.22 + b.j(0.05), 0.5, { ry: ry + b.j(0.06), rz: b.j(0.08), c: b.stoneC('stoneCool', 1), m: M.stone, bevel: 0.04 }); }
        });
      });

      b.part('Lych-gate');
      b.unit(function () {
        // four carved stave posts on stone pads, wall plates and tie beams, braces in the corners
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (c) {
          var px = gx + c[0] * 1.02, pz = gz + c[1] * 0.5;
          b.box(px, -0.04, pz, 0.34, 0.16, 0.34, { c: b.stoneC('stone', 0.5), m: M.stone, bevel: 0.04 });
          b.post(px, 0.1, pz, 0.1, 2.05, { c: 'beam' });
          [0.55, 1.25].forEach(function (y) { b.box(px, y, pz, 0.25, 0.07, 0.25, { c: 'woodDark', m: M.wood, bevel: 0.02 }); });
          b.beam([px, 1.55, pz], [px - c[0] * 0.5, 2.1, pz], 0.045, { c: 'beam' });
        });
        [-1, 1].forEach(function (sd) {
          b.box(gx, 2.12, gz + sd * 0.5, 2.6, 0.16, 0.16, { c: 'beam', m: M.wood, bevel: 0.025 });
          b.box(gx + sd * 1.02, 2.12, gz, 0.15, 0.15, 1.3, { c: 'beam', m: M.wood, bevel: 0.025 });
        });
      });
      b.unit(function () {
        // a slate roof, ridge along the wall, timber gable ends, and a carved dragon on each ridge end
        var y = 2.28, rise = 0.9, d = 1.0, over = 0.32, L = 2.6 + 0.24;
        b.gableRoof(gx, y, gz, 2.6, d, rise, { m: 'slate', over: over, rows: 3, rowsAsUnits: false, overX: 0.12 });
        [-1, 1].forEach(function (sd) {
          b.gableEnd(gx + sd * 1.1, y, gz, d, rise, 0.06, { c: 'wood', m: M.wood });
          var xe = gx + sd * (L / 2 + 0.04), slope = Math.atan2(rise, d / 2), ye = y - over * Math.tan(slope) + 0.12;
          [-1, 1].forEach(function (zs) { b.beam([xe, ye, gz + zs * (d / 2 + over)], [xe, y + rise + 0.14, gz], 0.04, { c: 'beam', r2: 0.1 }); });
          chapelDragon(b, xe + sd * 0.04, y + rise + 0.08, gz, sd > 0 ? 0 : Math.PI, 0.62, { rz: -0.3, foot: false });
        });
      });
      b.unit(function () {
        // the two gate leaves, palings on rails, swung open into the churchyard
        [-1, 1].forEach(function (sd) {
          b.push(gx + sd * 0.92, 0.12, gz - 0.02, -sd * 1.25);
          for (var i = 0; i < 5; i++) b.box(-sd * (0.09 + i * 0.18), 0, 0, 0.09, 0.92 + (i % 2) * 0.06, 0.05, { c: b.pick(['#5f4f3f', '#574839', '#655443']), m: M.wood, bevel: 0.012 });
          [0.2, 0.7].forEach(function (yy) { b.box(-sd * 0.42, yy, -0.05, 0.86, 0.08, 0.05, { c: 'woodDark', m: M.wood, bevel: 0.01 }); });
          b.beam([-sd * 0.05, 0.22, -0.06], [-sd * 0.8, 0.74, -0.06], 0.03, { c: 'woodDark' });
          b.pop();
        });
      });

      b.part('Graves and rune stones');
      b.unit(function () {
        chapelRuneStone(b, -7.6, 0, 2.9, 1.7, -0.5); chapelRuneStone(b, -8.1, 0, 0.2, 1.25, -1.1); chapelRuneStone(b, -6.4, 0, 4.4, 1.05, -0.25);
        b.rock(-8.3, 0.02, 1.9, 0.3); b.rock(-6.9, 0.02, 3.9, 0.22);
      });
      b.unit(function () {
        // the newer graves toward the gate: rune stones and carved grave posts, each with white flowers at its foot
        chapelRuneStone(b, -5.3, 0, 6.9, 1.35, -0.35); chapelRuneStone(b, -2.9, 0, 7.4, 1.0, -0.6); chapelRuneStone(b, -7.4, 0, 6.5, 0.95, -0.15);
        [[-4.1, 6.4, 1.3], [-1.6, 7.1, 1.05], [-6.3, 5.4, 1.15], [0.2, 7.6, 0.95]].forEach(function (g, i) {
          // a grave board of weathered oak with a gabled head and a dark carved band
          var hw = 0.17, hh = g[2];
          b.extrude(g[0], -0.05, g[1], [[-hw, 0], [hw, 0], [hw, hh - 0.2], [0, hh], [-hw, hh - 0.2]], 0.09, { ry: -0.4 + i * 0.12, c: '#8d8479', m: M.wood, bevel: 0.015, ao: 0.25 });
          b.box(g[0], hh * 0.58, g[1], 0.36, 0.06, 0.1, { ry: -0.4 + i * 0.12, c: '#3a3936', m: M.wood, bevel: 0.01 });
          b.flowers(g[0] + 0.25, 0, g[1] + 0.3, 0.3, { n: 4 });
          b.rock(g[0] - 0.3, 0.02, g[1] + 0.25, 0.14 + 0.04 * i);
        });
        b.flowers(-5.1, 0, 7.4, 0.35, { n: 5 }); b.flowers(-2.6, 0, 7.9, 0.3, { n: 4 });
      });
      b.unit(function () {
        // a carved memorial post, its head a dragon looking out over the churchyard
        var px = -6.0, pz = 1.6;
        b.post(px, 0, pz, 0.11, 2.3, { c: 'beam' });
        [0.5, 1.1, 1.7].forEach(function (y) { b.box(px, y, pz, 0.27, 0.08, 0.27, { c: 'woodDark', m: M.wood, bevel: 0.02 }); });
        chapelDragon(b, px, 2.3, pz, -0.4, 0.75, { c: 'beam' });
        // a cairn of field stones beside it
        for (var i = 0; i < 9; i++) { var a = i * 2.4, rr = i < 6 ? 0.32 : 0.12; b.rock(px - 1.1 + Math.cos(a) * rr, i < 6 ? 0.08 : 0.32, pz + 0.3 + Math.sin(a) * rr, i < 6 ? 0.24 : 0.2); }
      });
      b.part('Lanterns, muster board and stores');
      b.unit(function () { chapelLantern(b, 4.3, 6.2, 0, -1, 0); chapelLantern(b, 7.1, 5.4, 0, -1, 0); });
      b.unit(function () {
        // the muster board by the door: a little roofed board with notices pinned to it
        var nx = 8.9, nz = 3.0, ry = -0.5;
        b.push(nx, 0, nz, ry);
        [-0.6, 0.6].forEach(function (x) { b.post(x, 0, 0, 0.06, 2.05, { c: 'woodDark' }); });
        b.box(0, 0.95, 0.02, 1.25, 0.85, 0.06, { c: 'wood', m: M.wood, bevel: 0.015 });
        [[-0.32, 1.42, 0.34, 0.42, 0.1], [0.12, 1.36, 0.32, 0.3, -0.06], [0.38, 1.12, 0.26, 0.34, 0.08], [-0.1, 1.06, 0.36, 0.24, 0.0]].forEach(function (pp, i) { b.box(pp[0], pp[1] - pp[3] / 2, 0.06, pp[2], pp[3], 0.012, { c: i === 1 ? 'ink' : 'bone', m: M.cloth, rz: pp[4], bevel: 0 }); });
        b.push(0, 2.0, -0.05, 0); b.gableRoof(0, 0, 0, 1.4, 0.5, 0.28, { m: 'slate', over: 0.1, rows: 2, rowsAsUnits: false, overX: 0.05 }); b.pop();
        b.pop();
      });
      b.unit(function () {
        b.barrel(8.3, 0, 0.3, {}); b.barrel(8.75, 0, -0.45, { h: 0.82 }); b.crate(8.45, 0, -1.3, 0.7, { ry: 0.3 }); b.bucket(7.95, 0, 1.25);
        b.woodpile(8.6, -2.6, { ry: Math.PI / 2, n: 3, len: 1.5 });
        // a ladder against the tower where the nave meets it, a coil of new bell rope at its foot
        b.ladder(tx0, 0, 2.0, 3.3, { ry: -Math.PI / 2, lean: 0.35 });
        b.ropeCoil(3.4, 0, 2.35, 0.26);
      });

      b.unit(function () {
        // a handcart of grain sacks left by the churchyard wall for the muster
        var kx = 0.5, kz = 10.0;
        b.push(0, b.ground.height(kx, kz) - 0.02, 0, 0);
        b.cart(kx, kz, { ry: Math.PI / 2 + 0.05, load: function () {
          [[-0.3, -0.5], [0.3, -0.35], [-0.25, 0.25], [0.28, 0.45]].forEach(function (q, i) { b.sack(q[0], 0.7, q[1], 0.5, { c: i % 2 ? 'canvasDusty' : '#d9d4c8' }); });
          b.sack(0.0, 1.08, -0.1, 0.44, {});
        } });
        b.pop();
      });

      b.part('Flowers and ivy');
      b.unit(function () {
        b.bush(cx - 3.0, z1 + 0.55, 0.5, { flowers: '#f3f1ec', n: 2 });
        b.bush(cx + 0.0, z1 + 0.5, 0.45, { flowers: '#e6e3dc', n: 2 });
        b.bush(cx + 3.0, z1 + 0.55, 0.48, { flowers: '#f3f1ec', n: 2 });
        b.bush(tx0 - 0.3, tz1 + 0.5, 0.4, { n: 2 });
        var a = Math.PI * 0.86, nx = Math.cos(a), nz = Math.sin(a), px = ax + nx * (ar + Tw / 2 + 0.05), pz = cz + nz * (ar + Tw / 2 + 0.05);
        b.ivy([[px, 0.4, pz], [px + 0.1, 1.6, pz - 0.05], [px - 0.05, 2.8, pz + 0.05], [px, 3.6, pz]], [nx, 0, nz], { density: 7, spread: 0.5 });
        b.ivy([[tx0 + 0.05, 0.4, tz1 + 0.06], [tx0 + 0.25, 2.0, tz1 + 0.06], [tx0 + 0.15, 3.6, tz1 + 0.06], [tx0 + 0.3, 4.6, tz1 + 0.06]], [0, 0, 1], { density: 6, spread: 0.4 });
        b.flowers(-7.2, 0, 3.6, 0.5, { n: 7 }); b.flowers(-8.4, 0, 1.7, 0.4, { n: 5 });
      });

      b.life(function () {
        // the ringer in the doorway hauling the rope that comes down from the bell
        var rx = tcx, rz = tz1 + 0.14;
        b.figure(rx, rz, { role: 'villager', pose: 'chapelPull', ry: 0, y: base, c: '#5c5e62' });
        b.beam([rx - 0.02, base + doorH - 0.05, tz1 - 0.1], [rx - 0.03, base + 1.88, rz + 0.24], 0.018, { c: 'rope', m: M.rope, round: true, seg: 4 });
        b.beam([rx + 0.03, base + 1.54, rz + 0.26], [rx + 0.12, base + 0.06, rz + 0.44], 0.018, { c: 'rope', m: M.rope, round: true, seg: 4 });
        b.ropeCoil(rx + 0.2, base - 0.04, rz + 0.5, 0.16);
        // the elder at the steps, speaking to the muster
        b.figure(3.85, 3.5, { role: 'villager', pose: 'talk', ry: -Math.PI / 2 + 0.45, c: '#efebe4', cape: '#1f1e1c', beard: true, hair: '#d9d6cf' });
        // folk on the pews, facing him
        var p0 = chapelBy(pews[0][0], pews[0][1], Math.PI / 2, -0.55, 0), p1 = chapelBy(pews[0][0], pews[0][1], Math.PI / 2, 0.6, 0), p2 = chapelBy(pews[1][0], pews[1][1], Math.PI / 2, 0.1, 0);
        b.figure(p0[0], p0[1], { role: 'villager', pose: 'chapelSit', ry: Math.PI / 2, c: '#efebe4' });
        b.figure(p1[0], p1[1], { role: 'villager', pose: 'chapelSit', ry: Math.PI / 2 - 0.15, c: '#8a857c' });
        b.figure(p2[0], p2[1], { role: 'villager', pose: 'chapelSit', ry: Math.PI / 2, c: '#6f6a62', beard: true });
        // soldiers answering the bell
        b.figure(5.95, 5.6, { role: 'soldier', pose: 'walk', ry: Math.PI - 0.08 });
        b.figure(6.55, 9.55, { role: 'soldier', pose: 'spear', ry: -0.5, team: 'bone', y: b.ground.height(6.55, 9.55) });
        b.figure(4.85, 10.5, { role: 'child', pose: 'run', ry: Math.PI - 0.25, y: b.ground.height(4.85, 10.5) });
      });
    }
  });
})();
