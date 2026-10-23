// Storehouse: a timber granary raised on twelve staddle stones, its plank walls framed in dark timber under a steep
// slate roof, crossed barge boards carved into dragon heads at both gables, a hoist dormer on the front slope whose
// hood shelters the hoist beam and pulley, round shields on the wall, a door with a landing and a ladder, a loading
// door over the cart, and a yard stocked for a siege: a pyramid of barrels, bonded stacks of sacks, crates, a
// weighing tripod and the tally table.
// Built staddles first, the sills, joists and floor, the frame, the walls board by board, the gables, the roof row by
// row, the dormer, finials and hoist, then the landing and ladder, the stores, and last the people.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL;
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  PAL.storehouseBoard = ['#a99d8a', '#b4a894', '#9e927f', '#bbb09c', '#a59a88', '#afa491', '#988d7c', '#c0b5a1'];
  PAL.storehouseSack = ['#d3cbb8', '#cbc2ad', '#dbd4c3', '#c4bba6', '#d8d1bf'];
  // flat slates catch the low sun harder than the armory's curved tiles, so they are laid a shade darker to read as charcoal
  PAL.storehouseSlate = ['#1f2124', '#25282b', '#1c1e21', '#2a2d30', '#222528'];
  PAL.storehouseFish = ['#cbbda4', '#bfb197', '#d4c8b0', '#b3a58c', '#c6b89e'];

  // hauling a hoist rope down hand over hand, one hand high on the rope
  KIT.people.poses.storehouseHaul = function () { return { feet: [V(-0.16, 0.09, 0.14), V(0.15, 0.09, -0.24)], hands: [V(-0.05, 1.85, 0.25), V(0.05, 1.45, 0.3)], lean: -0.06, twist: 0.05, side: 0, hip: 0, drop: 0.05, head: [0, -0.4], pole: [V(-1, -0.2, -0.3), V(1, -0.2, -0.3)] }; };
  // bending over a cart side to lift a sack out with both hands
  KIT.people.poses.storehouseLift = function () { return { feet: [V(-0.2, 0.09, 0.06), V(0.2, 0.09, -0.08)], hands: [V(-0.22, 1.22, 0.5), V(0.22, 1.22, 0.5)], lean: 0.32, twist: 0, side: 0, hip: 0, drop: 0.1, head: [0, 0.3], pole: [V(-1, -0.3, -0.3), V(1, -0.3, -0.3)] }; };
  // stooped behind a barrel lying on its side, rolling it forward
  KIT.people.poses.storehouseRoll = function () { return { feet: [V(-0.16, 0.09, 0.2), V(0.15, 0.12, -0.36)], hands: [V(-0.2, 0.66, 0.5), V(0.2, 0.68, 0.5)], lean: 0.5, twist: 0, side: 0, hip: 0, drop: 0.14, head: [0, -0.1], pole: [V(-1, -0.3, -0.4), V(1, -0.3, -0.4)] }; };

  // reaching up with both hands to hang fish over a rack pole
  KIT.people.poses.storehouseHang = function () { return { feet: [V(-0.15, 0.09, 0.06), V(0.15, 0.09, -0.1)], hands: [V(-0.16, 1.66, 0.42), V(0.14, 1.72, 0.4)], lean: -0.04, twist: 0.05, side: 0, hip: 0, drop: 0, head: [0.1, -0.35], pole: [V(-1, -0.2, -0.3), V(1, -0.2, -0.3)] }; };

  // a point beside a figure standing at (x, z) turned ry, from its own frame (lx, ly, lz)
  function by(x, z, ry, lx, ly, lz) { return [x + lx * Math.cos(ry) + lz * Math.sin(ry), ly, z - lx * Math.sin(ry) + lz * Math.cos(ry)]; }

  // a carved dragon head: the neck rises from the origin, the snout points along local +x
  var HEAD = [[0, 0], [0.2, 0], [0.24, 0.16], [0.32, 0.36], [0.44, 0.52], [0.6, 0.57], [0.8, 0.6], [0.73, 0.64], [0.62, 0.665], [0.8, 0.72], [0.93, 0.76], [0.91, 0.84], [0.75, 0.87], [0.58, 0.9], [0.5, 0.97], [0.29, 1.12], [0.38, 0.92], [0.28, 0.86], [0.19, 0.93], [0.2, 0.76], [0.09, 0.71], [0.14, 0.57], [0.02, 0.47], [0.07, 0.35], [-0.03, 0.23], [0.03, 0.12]];
  function dragonHead(b, x, y, z, s, ry, rz) {
    b.push(x, y, z, ry || 0);
    if (rz) b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(rz));
    b.extrude(0, 0, 0, HEAD.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.12 * s, { c: 'beam', m: M.wood, bevel: 0.012 * s });
    [-1, 1].forEach(function (sd) {
      b.ball(0.6 * s, 0.8 * s, sd * 0.075 * s, 0.04 * s, { c: '#efebe4', m: M.paint, detail: 1, ao: 0, jit: 0 });
      b.box(0.62 * s, 0.68 * s, sd * 0.07 * s, 0.28 * s, 0.03 * s, 0.02 * s, { c: '#1f1e1c', m: M.wood, bevel: 0, ao: 0, rz: 0.15 });
    });
    b.pop();
  }

  // a staddle stone: a tapering stone pillar and a mushroom cap, h to the cap
  function staddle(b, x, z, h) {
    b.box(x + b.j(0.05), -0.05, z + b.j(0.05), 0.72, 0.1, 0.72, { c: b.stoneC('stoneDark'), m: M.stone, bevel: 0.04, ry: b.r(), ao: 0 });
    b.lathe(x, 0, z, [[0.01, -0.05], [0.26, -0.05], [0.23, h * 0.4], [0.15, h], [0.01, h]], { c: b.stoneC('stone', 0.5), m: M.stone, seg: 9, flat: true, ao: 0.45, ry: b.r() * 6 });
    b.lathe(x, h - 0.01, z, [[0.01, 0], [0.22, 0], [0.38, 0.05], [0.41, 0.11], [0.35, 0.18], [0.01, 0.2]], { c: b.stoneC('sandstone'), m: M.stone, seg: 12, flat: true, ao: 0.2, ry: b.r() * 6 });
  }

  // a sack lying on its side, long along local x (turned by ry), its tied neck toward +x
  function sackLie(b, x, y, z, o) {
    o = o || {}; var w = o.w || 0.72, h = o.h || 0.3, d = o.d || 0.44, c = b.pick(PAL.storehouseSack);
    b.push(x, y, z, o.ry || 0);
    b.box(0, 0, 0, w, h, d, { c: c, m: M.cloth, bevel: 0.12, ao: 0.35 });
    b.cone(w / 2 - 0.06, h * 0.5, 0, 0.1, 0.16, { c: c, m: M.cloth, seg: 6, rz: -Math.PI / 2 });
    b.cyl(w / 2 + 0.05, h * 0.5, 0, 0.045, 0.04, { c: 'rope', m: M.rope, seg: 6, rz: -Math.PI / 2 });
    b.pop();
  }

  // a round shield hung on a wall, its face toward ry, painted in two halves
  function shieldHalves(b, x, y, z, ry, c1, c2, s, rot) {
    var r = 0.42 * s * 0.97, n = 10;
    b.push(x, y, z, ry);
    b.shield(0, 0, 0, { kind: 'round', c: c1, s: s });
    if (c2) {
      var pts = []; for (var i = 0; i <= n; i++) { var a = (rot || 0) + i / n * Math.PI; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      b.extrude(0, 0, 0.053, pts, 0.006, { c: c2, m: M.paint, ao: 0, jit: 0.01 });
    }
    b.pop();
  }

  // a plank door leaf hinged on a vertical axis at (hx, y0, hz); ry turns local +x (the leaf's run) to where it points
  function leaf(b, hx, y0, hz, ry, w, h) {
    var n = Math.max(2, Math.round(w / 0.24)), pw = w / n;
    b.push(hx, y0, hz, ry);
    for (var i = 0; i < n; i++) b.box(pw * (i + 0.5), 0, 0, pw - 0.02, h * (1 + b.j(0.01)), 0.07, { c: b.pick(PAL.storehouseBoard), m: M.wood, bevel: 0.012, ao: 0.35 });
    [0.3, h - 0.42].forEach(function (yy) {
      [-1, 1].forEach(function (sd) {
        b.box(w / 2, yy, sd * 0.05, w - 0.04, 0.13, 0.04, { c: 'woodDark', m: M.wood, bevel: 0.012 });
        b.box(w * 0.32, yy + 0.04, sd * 0.075, w * 0.62, 0.045, 0.014, { c: 'iron', m: M.metal, bevel: 0.004 });
      });
    });
    b.beam([0.1, 0.43, 0.05], [w - 0.1, h - 0.42, 0.05], 0.045, { c: 'woodDark', r2: 0.02 });
    b.pop();
  }

  // a post with a carved face (a column of diamonds, like stave work) toward ry and a broad capital
  function carvedPost(b, x, y0, z, h, ry) {
    b.push(x, y0, z, ry);
    b.post(0, 0, 0, 0.12, h, { c: 'beam' });
    for (var y = 0.3; y < h - 0.35; y += 0.24) b.box(0, y, 0.125, 0.11, 0.11, 0.03, { c: 'woodDark', m: M.wood, rz: Math.PI / 4, bevel: 0.01, ao: 0 });
    b.box(0, h - 0.16, 0, 0.32, 0.16, 0.32, { c: 'beam', m: M.wood, bevel: 0.03 });
    b.box(0, 0, 0, 0.3, 0.1, 0.3, { c: 'beam', m: M.wood, bevel: 0.03 });
    b.pop();
  }

  // Plank boards standing side by side along a wall. axis 'x': a wall in the XY plane at z = w; axis 'z': a wall in
  // the YZ plane at x = w. out (+1/-1) is toward the outside. From a to c along the wall, from bot(t) up to top(t)
  // (numbers or functions of t, the coordinate along the wall), with holes [{a0, a1, y0, y1}] left open, laid in
  // nUnits steps. A board whose ends are not level is cut to the slope.
  function boards(b, axis, w, out, a, c, bot, top, holes, nUnits) {
    var B = typeof bot === 'function' ? bot : function () { return bot; }, Tp = typeof top === 'function' ? top : function () { return top; };
    var n = Math.max(1, Math.round((c - a) / 0.265)), pw = (c - a) / n, per = Math.ceil(n / nUnits), wp = w - out * 0.04;
    for (var u = 0; u < nUnits; u++) b.unit(function () {
      for (var i = u * per; i < Math.min(n, (u + 1) * per); i++) {
        var ta = a + i * pw + 0.009, tb = a + (i + 1) * pw - 0.009, cuts = [ta, tb];
        holes.forEach(function (h) { [h.a0, h.a1].forEach(function (q) { if (q > ta + 0.03 && q < tb - 0.03) cuts.push(q); }); });
        cuts.sort(function (p, q) { return p - q; });
        var tone = b.pick(PAL.storehouseBoard), dy = b.j(0.02);
        for (var k = 0; k < cuts.length - 1; k++) {
          var s0 = cuts[k] + (k > 0 ? 0.006 : 0), s1 = cuts[k + 1] - (k < cuts.length - 2 ? 0.006 : 0), sm = (s0 + s1) / 2, segs = [{ lo: null, hi: null }];
          holes.forEach(function (h) {
            if (!(sm > h.a0 && sm < h.a1)) return;
            var ns = [];
            segs.forEach(function (sg) {
              var l = sg.lo === null ? B(sm) : sg.lo, hh = sg.hi === null ? Tp(sm) : sg.hi;
              if (h.y1 <= l || h.y0 >= hh) { ns.push(sg); return; }
              if (h.y0 > l) ns.push({ lo: sg.lo, hi: h.y0 });
              if (h.y1 < hh) ns.push({ lo: h.y1, hi: sg.hi });
            });
            segs = ns;
          });
          segs.forEach(function (sg) {
            var b0 = sg.lo === null ? B(s0) : sg.lo, b1 = sg.lo === null ? B(s1) : sg.lo;
            var t0 = sg.hi === null ? Tp(s0) + dy : sg.hi, t1 = sg.hi === null ? Tp(s1) + dy : sg.hi;
            if (Math.min(t0 - b0, t1 - b1) < 0.05) return;
            var o = { c: tone, m: M.wood, ao: 0.3, jit: 0.02 };
            if (Math.abs(b0 - b1) < 0.01 && Math.abs(t0 - t1) < 0.01) {
              var mid = (s0 + s1) / 2, wd = s1 - s0, yb = Math.min(b0, b1), hh = Math.min(t0, t1) - yb;
              o.bevel = 0.01;
              if (axis === 'x') b.box(mid, yb, wp, wd, hh, 0.07, o); else b.box(wp, yb, mid, 0.07, hh, wd, o);
            } else if (axis === 'x') {
              b.extrude(0, 0, wp, [[s0, b0], [s1, b1], [s1, t1], [s0, t0]], 0.07, Object.assign(o, { bevel: 0.004 }));
            } else {
              b.extrude(wp, 0, 0, [[-s0, b0], [-s1, b1], [-s1, t1], [-s0, t0]], 0.07, Object.assign(o, { bevel: 0.004, ry: Math.PI / 2 }));
            }
          });
        }
      }
    });
  }

  // a bonded stack of lying sacks on a pallet at (x, z): layers alternate their run
  function sackStack(b, x, z, layers, ry) {
    b.push(x, 0, z, ry || 0);
    b.unit(function () {
      for (var i = 0; i < 6; i++) b.box(-0.68 + i * 0.272, 0, 0, 0.22, 0.06, 1.55, { c: 'wood', m: M.wood, bevel: 0.01 });
      [-0.6, 0, 0.6].forEach(function (zz) { b.box(0, 0.06, zz, 1.6, 0.06, 0.12, { c: 'woodDark', m: M.wood, bevel: 0.01 }); });
    });
    var y = 0.12;
    layers.forEach(function (L, li) {
      b.unit(function () {
        for (var i = 0; i < L[0]; i++) for (var k = 0; k < L[1]; k++) {
          var along = li % 2 === 0;
          var px = (i - (L[0] - 1) / 2) * (along ? 0.47 : 0.74), pz = (k - (L[1] - 1) / 2) * (along ? 0.74 : 0.47);
          sackLie(b, px + b.j(0.03), y, pz + b.j(0.03), { ry: (along ? Math.PI / 2 : 0) + b.j(0.08) + (b.chance(0.5) ? Math.PI : 0) });
        }
      });
      y += 0.27;
    });
    b.pop();
    return y;
  }

  // a sheaf of grain painted on a board, both faces (local XY plane, z the board's face offset)
  function sheafSign(b, x, y, z, s, ec) {
    var shapes = [];
    for (var k = -2; k <= 2; k++) {
      var bx = k * 0.03, tx = k * 0.13, ty = 0.28 - Math.abs(k) * 0.04;
      shapes.push([[bx - 0.018, -0.4], [bx + 0.018, -0.4], [tx + 0.018, ty], [tx - 0.018, ty]]);
      shapes.push([[tx, ty - 0.04], [tx + 0.045, ty + 0.06], [tx, ty + 0.2], [tx - 0.045, ty + 0.06]]);
    }
    shapes.push([[-0.12, -0.16], [0.12, -0.16], [0.12, -0.08], [-0.12, -0.08]]);
    shapes.forEach(function (pts) {
      [z, -z].forEach(function (dz) { b.extrude(x, y, dz, pts.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.006, { c: ec, m: M.paint, ao: 0, jit: 0.01 }); });
    });
  }

  // a hjell, the Norse rack for drying stockfish: two crossed-pole trestles, a ridge pole in their crotch and two side
  // rails, with fish hung in pairs over the poles; centred at (x, z), running along x, in two units (frame, fish)
  function fishRack(b, x, z, len) {
    var hl = len / 2, ends = [-hl + 0.12, hl - 0.12], ry0 = 1.95, rails = [[ry0, 0], [1.26, -0.26], [1.26, 0.26]];
    b.push(x, 0, z, 0);
    b.unit(function () {
      ends.forEach(function (ex) {
        [-1, 1].forEach(function (s) {
          b.box(ex, -0.02, s * 0.62, 0.22, 0.06, 0.22, { c: b.stoneC('stoneDark'), m: M.stone, bevel: 0.03, ry: b.r() });
          b.beam([ex, 0.02, s * 0.62], [ex + b.j(0.02), 2.22, -s * 0.12], 0.042, { c: 'wood', round: true, seg: 6 });
        });
        b.cyl(ex, ry0 - 0.03, 0, 0.06, 0.08, { c: 'rope', m: M.rope, seg: 7, rz: Math.PI / 2 });
      });
      b.beam([-hl - 0.15, ry0 + 0.04, 0], [hl + 0.15, ry0 + 0.04, 0], 0.04, { c: 'woodLight', round: true, seg: 6 });
      [-1, 1].forEach(function (s) { b.beam([-hl - 0.05, 1.3, s * 0.27], [hl + 0.05, 1.3, s * 0.27], 0.032, { c: 'woodLight', round: true, seg: 6 }); });
    });
    b.unit(function () {
      rails.forEach(function (rl, ri) {
        var top = rl[0] + (ri ? 0.02 : 0.06);
        for (var fx = -hl + 0.3; fx < hl - 0.22; fx += 0.15) {
          if (b.chance(0.14)) continue;
          var sides = ri ? [rl[1] + (rl[1] > 0 ? 0.05 : -0.05)] : [-0.06, 0.06];
          sides.forEach(function (fz) {
            var c = b.pick(PAL.storehouseFish), lenF = 0.36 + b.j(0.05), fxx = fx + b.j(0.025);
            b.ball(fxx, top - lenF * 0.5 - 0.04, fz, 0.052, { c: c, m: M.cloth, sy: lenF / 0.104, sz: 0.42, detail: 1, ao: 0.25, jit: 0.01 });
            b.cone(fxx, top - 0.06, fz, 0.05, 0.08, { c: c, m: M.cloth, seg: 4, sz: 0.4 });
          });
        }
      });
    });
    b.pop();
  }

  // a cat sitting, facing +z, turned by ry
  function cat(b, x, y, z, ry) {
    var c = '#2c2b29';
    b.push(x, y, z, ry);
    b.ball(0, 0.11, 0, 0.11, { c: c, m: M.cloth, sy: 1.15, sz: 1.2, detail: 1, ao: 0.2 });
    b.ball(0, 0.29, 0.06, 0.075, { c: c, m: M.cloth, detail: 1, ao: 0.1 });
    [-1, 1].forEach(function (sd) { b.cone(sd * 0.04, 0.34, 0.06, 0.03, 0.07, { c: c, m: M.cloth, seg: 4 }); b.ball(sd * 0.03, 0.3, 0.13, 0.012, { c: '#e9e4c8', m: M.paint, detail: 0, ao: 0 }); });
    b.beam([0, 0.03, -0.12], [0.12, 0.02, -0.25], 0.022, { c: c, m: M.cloth, round: true, seg: 5 });
    b.beam([0.12, 0.02, -0.25], [0.2, 0.08, -0.2], 0.02, { c: c, m: M.cloth, round: true, seg: 5 });
    b.pop();
  }

  // A slate roof like gableRoof (ridge along x, eaves at y, rising h over span d), laid slate by slate, row by row,
  // where o.skip(x, side, zTop, pw) leaves out a slate that a cross gable covers (zTop: where its top edge reaches).
  var SLATE = {}, MOSS = new T.Color('#7f8657');
  function slateGeo(pw, thick, len) {
    var key = [pw, thick, len].map(function (v) { return v.toFixed(3); }).join(',');
    if (SLATE[key]) return SLATE[key];
    var g = KIT.geo.chamferBox(pw * 0.96, thick * 0.7, len, Math.min(0.03, thick * 0.2));
    g.computeBoundingBox(); var p = g.attributes.position, za = g.boundingBox.min.z, zb = g.boundingBox.max.z, c = [];
    for (var i = 0; i < p.count; i++) { var t = (p.getZ(i) - za) / Math.max(1e-4, zb - za), v = 0.62 + 0.38 * Math.pow(KIT.util.smooth(0, 0.75, t), 0.8); c.push(v, v, v * 0.98); }
    g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
    return (SLATE[key] = g);
  }
  function slateRoof(b, x, y, z, w, d, h, o) {
    var U = KIT.util, over = o.over, half = d / 2 + over, slope = Math.atan2(h, d / 2), run = half / Math.cos(slope);
    var rows = o.rows, rl = run / rows, thick = 0.14, L = w + 2 * o.overX, pw = 0.4, dropY = -over * Math.tan(slope);
    b.push(x, y, z, 0);
    for (var r = 0; r < rows; r++) {
      b.unit(function () {
        [-1, 1].forEach(function (side) {
          var t0 = r * rl, t1 = (r + 1) * rl + rl * 0.35, len = t1 - t0;
          var cz = side * (half - (t0 + t1) / 2 * Math.cos(slope)), cy = dropY + (t0 + t1) / 2 * Math.sin(slope);
          var pg = slateGeo(pw, thick, len), n = Math.ceil(L / pw), off = (r % 2) * pw * 0.5, zTop = z + side * (half - t1 * Math.cos(slope));
          b.push(0, cy + thick * 0.4 + (r % 2) * 0.01, cz, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(side * (slope + 0.06)));
          for (var i = 0; i <= n; i++) {
            var px = -L / 2 + i * pw + off - pw * 0.25; if (px > L / 2 + pw * 0.2) break; if (px < -L / 2 - pw * 0.2) continue;
            var pc = Math.max(-L / 2 + pw / 2, Math.min(L / 2 - pw / 2, px));
            if (o.skip && o.skip(pc + x, side, zTop, pw)) continue;
            var cc = U.col(b.pick(PAL.storehouseSlate)), q = b.r();
            if (q < 0.12) cc.offsetHSL(0.006, -0.04, -0.035); else if (q < 0.22) cc.offsetHSL(-0.006, 0.01, 0.025); else if (q < 0.26) cc.lerp(MOSS, 0.15);
            b.addGeo(pg, { x: pc, y: -thick / 2 + b.j(0.008), z: b.j(0.02), rx: b.j(0.008), ry: b.j(0.015) + (side < 0 ? Math.PI : 0), rz: b.j(0.01), c: cc, m: M.tile, ao: 0.3, jit: 0.02, vary: 0.04 });
          }
          b.pop();
        });
      });
    }
    b.unit(function () { b.addGeo(KIT.geo.cyl(thick * 1.1, thick * 1.1, L + 0.1, 8, { flat: true }), { x: -L / 2 - 0.05, y: h + thick * 0.5, z: 0, rz: -Math.PI / 2, c: '#2e3134', m: M.tile }); });
    b.pop();
  }

  // A pent roof of slates: across x (xc, L wide), from its low front edge at (zF, yF) rising back at tp (rise per
  // metre) to zB, laid row by row from the front.
  function pentRoof(b, xc, L, zF, yF, tp, zB, rows) {
    var U = KIT.util, phi = Math.atan(tp), run = (zF - zB) / Math.cos(phi), rl = run / rows, thick = 0.14, pw = 0.4;
    for (var r = 0; r < rows; r++) {
      b.unit(function () {
        var t0 = r * rl, t1 = (r + 1) * rl + rl * 0.35, tm = (t0 + t1) / 2, len = t1 - t0, n = Math.ceil(L / pw), off = (r % 2) * pw * 0.5, pg = slateGeo(pw, thick, len);
        b.push(xc, yF + tm * Math.sin(phi) + thick * 0.4 + (r % 2) * 0.01, zF - tm * Math.cos(phi), 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(phi + 0.06));
        for (var i = 0; i <= n; i++) {
          var px = -L / 2 + i * pw + off - pw * 0.25; if (px > L / 2 + pw * 0.2) break; if (px < -L / 2 - pw * 0.2) continue;
          var pc = Math.max(-L / 2 + pw / 2, Math.min(L / 2 - pw / 2, px)), cc = U.col(b.pick(PAL.storehouseSlate)), q = b.r();
          if (q < 0.12) cc.offsetHSL(0.006, -0.04, -0.035); else if (q < 0.22) cc.offsetHSL(-0.006, 0.01, 0.025); else if (q < 0.26) cc.lerp(MOSS, 0.15);
          b.addGeo(pg, { x: pc, y: -thick / 2 + b.j(0.008), z: b.j(0.02), rx: b.j(0.008), ry: b.j(0.015), rz: b.j(0.01), c: cc, m: M.tile, ao: 0.3, jit: 0.02, vary: 0.04 });
        }
        b.pop();
      });
    }
  }

  KIT.defineBuild('storehouse', {
    name: 'Storehouse', size: 'middle', need: 32,
    line: 'A timber granary raised on staddle stones, with a ladder up to its door, a hoist under a dragon-headed hood, and a yard stocked for a siege.',
    r: 10, flat: [13.2, 10], ground: 'cobble', path: [[0.9, 10.4], [0.7, 5.1]],
    frameY: 2.5, frameR: 9.2, glowAt: [1.0, 6.4, 1.2],
    trees: [{ x: -8.0, z: -4.3, kind: 'pine', h: 8.0 }, { x: -5.9, z: -6.6, kind: 'pine', h: 6.2 }, { x: 8.0, z: -4.5, kind: 'pine', h: 7.2 }, { x: 8.6, z: 2.3, kind: 'birch', h: 5.4 }],
    bushes: [{ x: 7.5, z: 5.0, r: 0.8, flowers: '#f3f1ec' }, { x: -6.2, z: 6.1, r: 0.8 }, { x: -8.6, z: -0.8, r: 0.7, flowers: '#f3f1ec' }, { x: 3.4, z: -5.9, r: 0.7 }],
    perches: [{ x: -0.8, y: 6.9, z: -1.6, ry: Math.PI / 2 }, { x: 2.6, y: 6.9, z: -1.6, ry: Math.PI / 2 }],
    build: function (b) {
      // the granary: posts on x -4.6..3.0, z -4.1..0.9, ridge along x; the floor at FL on staddles
      var cx = -0.8, cz = -1.6, W = 7.6, D = 5.0, x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
      var sH = 0.7, FL = 1.34, eave = FL + 2.5, half = (D + 0.5) / 2, rise = 2.9, apex = eave + rise, sl = rise / half, gOver = 0.45;
      var roofY = function (z) { return eave + rise - sl * Math.abs(z - cz); };
      var xs = [0, 1, 2, 3].map(function (i) { return x0 + 0.35 + i * (W - 0.7) / 3; }), zs = [z0 + 0.35, cz, z1 - 0.35];
      // front posts: the people door (with the landing) and the loading door under the hoist dormer
      var pd0 = -3.2, pd1 = -1.8, xd = 1.0, fdW = 0.7;
      var fBays = [x0, pd0, pd1, xd - fdW - 0.12, xd + fdW + 0.12, x1], bBays = [x0, -2.7, -0.8, 1.1, x1], eBays = [z0, cz, z1];
      // the hoist bay: the front wall rises over the loading door to yF under a shallow pent hood (tp rise per metre)
      // that runs out to zf over the hoist and back up the main roof to zJ
      var gW = 1.0, yF = eave + 1.75, yP0 = eave + 1.85, tp = 0.3, zf = z1 + 0.7, hoodX = gW + 0.27;
      var pY0 = function (z) { return yP0 + tp * (z1 - z); };
      var zJ = (eave + rise + sl * cz - yP0 - tp * z1) / (sl - tp);
      var skipMain = function (x, side, zTop) { return side > 0 && Math.abs(x - xd) < gW + 0.05 && zTop > zJ - 0.05; };

      b.part('Staddle stones');
      zs.forEach(function (z) { b.unit(function () { xs.forEach(function (x) { staddle(b, x + b.j(0.02), z + b.j(0.02), sH); }); }); });

      b.part('Sill beams and joists');
      b.unit(function () { zs.forEach(function (z) { b.box(cx, sH + 0.18, z, W + 0.4, 0.24, 0.28, { c: 'beam', m: M.wood, bevel: 0.03 }); }); });
      b.unit(function () {
        for (var k = 0; k <= 16; k++) { var x = x0 + 0.1 + k * (W - 0.2) / 16; b.box(x + b.j(0.02), sH + 0.42, cz, 0.15, 0.16, D + 0.36, { c: 'woodDark', m: M.wood, bevel: 0.02 }); }
      });

      b.part('Granary floor');
      b.unit(function () { var n = 17, pw = D / n; for (var i = 0; i < n; i++) b.box(cx, FL - 0.06, z0 + (i + 0.5) * pw, W, 0.06, pw - 0.015, { c: b.pick(PAL.storehouseBoard), m: M.wood, bevel: 0.01 }); });

      b.part('Frame');
      b.unit(function () {
        // sill plates: the long walls run full length, the ends sit between them
        [z0, z1].forEach(function (z) { b.box(cx, FL, z, W + 0.24, 0.2, 0.24, { c: 'beam', m: M.wood, bevel: 0.03 }); });
        [x0, x1].forEach(function (x) { b.box(x, FL, cz, 0.24, 0.2, D - 0.24, { c: 'beam', m: M.wood, bevel: 0.03 }); });
      });
      var ph = eave - 0.22 - (FL + 0.2);
      b.unit(function () {
        fBays.forEach(function (x, i) { if (i === 0 || i === fBays.length - 1) b.post(x, FL + 0.2, z1, 0.12, ph, { c: 'beam' }); else carvedPost(b, x, FL + 0.2, z1, ph, 0); });
        bBays.forEach(function (x) { b.post(x, FL + 0.2, z0, 0.12, ph, { c: 'beam' }); });
        [x0, x1].forEach(function (x) { b.post(x, FL + 0.2, cz, 0.12, ph, { c: 'beam' }); });
      });

      b.part('Plank walls');
      var low = eave - 0.1, doorP = { a0: pd0 + 0.12, a1: pd1 - 0.12, y0: FL + 0.2, y1: FL + 2.05 }, doorL = { a0: xd - fdW, a1: xd + fdW, y0: FL + 0.2, y1: FL + 2.05 };
      boards(b, 'x', z1, 1, x0, x1, FL + 0.1, low, [doorP, doorL], 4);
      boards(b, 'z', x0, -1, z0, z1, FL + 0.1, low, [], 2);
      boards(b, 'x', z0, -1, x0, x1, FL + 0.1, low, [], 2);
      boards(b, 'z', x1, 1, z0, z1, FL + 0.1, low, [], 2);

      b.part('Girts and wall plates');
      b.unit(function () {
        // the mid rail between posts, left out where a door falls
        var gy = FL + 1.2;
        [0, 2, 4].forEach(function (i) { var a = fBays[i] + 0.12, c = fBays[i + 1] - 0.12; b.box((a + c) / 2, gy, z1 + 0.02, c - a, 0.14, 0.15, { c: 'beam', m: M.wood, bevel: 0.02 }); });
        for (var i = 0; i < bBays.length - 1; i++) { var a = bBays[i] + 0.12, c = bBays[i + 1] - 0.12; b.box((a + c) / 2, gy, z0 - 0.02, c - a, 0.14, 0.15, { c: 'beam', m: M.wood, bevel: 0.02 }); }
        [[x0, -1], [x1, 1]].forEach(function (e) { for (var k = 0; k < 2; k++) { var a = eBays[k] + 0.12, c = eBays[k + 1] - 0.12; b.box(e[0] + e[1] * 0.02, gy, (a + c) / 2, 0.15, 0.14, c - a, { c: 'beam', m: M.wood, bevel: 0.02 }); } });
      });
      b.unit(function () {
        // top plates: the long walls run full length, the tie beams of the gable ends sit between them
        [z0, z1].forEach(function (z) { b.box(cx, eave - 0.22, z, W + 0.24, 0.22, 0.24, { c: 'beam', m: M.wood, bevel: 0.03 }); });
        [x0, x1].forEach(function (x) { b.box(x, eave - 0.22, cz, 0.24, 0.22, D - 0.24, { c: 'beam', m: M.wood, bevel: 0.03 }); });
      });

      b.part('Gables');
      var gTop = function (z) { return roofY(z) - 0.12; }, ventL = { a0: cz - 0.32, a1: cz + 0.32, y0: eave + 0.9, y1: eave + 1.5 };
      boards(b, 'z', x0, -1, z0, z1, eave - 0.11, gTop, [ventL], 2);
      boards(b, 'z', x1, 1, z0, z1, eave - 0.11, gTop, [{ a0: cz - 0.3, a1: cz + 0.3, y0: eave + 0.9, y1: eave + 1.4 }], 2);
      b.unit(function () {
        // studs in the gables round their vents, and the louvres
        [[x0, -1], [x1, 1]].forEach(function (e) {
          [-0.4, 0.4, -1.5, 1.5].forEach(function (dz) { var top = gTop(cz + dz + (dz > 0 ? 0.08 : -0.08)) - 0.04; b.box(e[0], eave, cz + dz, 0.2, top - eave, 0.16, { c: 'beam', m: M.wood, bevel: 0.02 }); });
          [eave + 0.78, eave + 1.5].forEach(function (y) { b.box(e[0] + e[1] * 0.02, y, cz, 0.22, 0.12, 0.96, { c: 'beam', m: M.wood, bevel: 0.02 }); });
          for (var k = 0; k < 3; k++) b.box(e[0] + e[1] * 0.04, eave + 0.97 + k * 0.15, cz, 0.12, 0.05, 0.64, { c: 'woodDark', m: M.wood, rz: -e[1] * 0.5, bevel: 0.01 });
          b.box(e[0] - e[1] * 0.12, eave + 0.88, cz, 0.04, 0.62, 0.66, { c: '#2b2420', m: M.dark, ao: 0, jit: 0 });
        });
      });

      b.part('Doors');
      b.unit(function () {
        // the loading door, one leaf swung wide and one ajar, sacks inside on the floor
        b.box(xd, FL, z1 - 1.3, fdW * 2 + 0.2, 2.1, 0.05, { c: '#2b2420', m: M.dark, ao: 0, jit: 0 });
        b.box(xd, FL + 2.05, z1 + 0.02, fdW * 2 + 0.1, 0.16, 0.22, { c: 'beam', m: M.wood, bevel: 0.02 });
        leaf(b, xd - fdW + 0.02, FL + 0.22, z1 + 0.06, -1.5, fdW - 0.03, 1.8);
        leaf(b, xd + fdW - 0.02, FL + 0.22, z1 + 0.06, Math.PI + 1.4, fdW - 0.03, 1.8);
        sackLie(b, xd - 0.32, FL, z1 - 0.82, { ry: Math.PI / 2 + 0.1 }); sackLie(b, xd + 0.3, FL, z1 - 0.8, { ry: Math.PI / 2 - 0.15 }); sackLie(b, xd, FL + 0.27, z1 - 0.82, { ry: 0.05 });
      });
      b.unit(function () {
        // the people door onto the landing, both leaves open
        var a = pd0 + 0.12, c = pd1 - 0.12, lw = (c - a) / 2 - 0.02;
        b.box((a + c) / 2, FL, z1 - 1.0, c - a + 0.2, 2.1, 0.05, { c: '#2b2420', m: M.dark, ao: 0, jit: 0 });
        b.box((a + c) / 2, FL + 2.05, z1 + 0.02, c - a + 0.1, 0.16, 0.22, { c: 'beam', m: M.wood, bevel: 0.02 });
        leaf(b, a + 0.02, FL + 0.22, z1 + 0.06, -1.45, lw, 1.8);
        leaf(b, c - 0.02, FL + 0.22, z1 + 0.06, Math.PI + 1.5, lw, 1.8);
        sackLie(b, (a + c) / 2 + 0.1, FL, z1 - 0.55, { ry: 0.1 });
      });

      b.part('Slate roof');
      slateRoof(b, cx, eave, cz, W, D + 0.5, rise, { over: 0.45, overX: gOver, rows: 9, skip: skipMain });

      b.part('Hoist bay');
      var hatch = { a0: xd - 0.42, a1: xd + 0.42, y0: eave + 0.05, y1: eave + 1.1 }, hoistHole = { a0: xd - 0.125, a1: xd + 0.125, y0: eave + 1.3, y1: eave + 1.54 };
      boards(b, 'x', z1, 1, xd - gW, xd + gW, eave - 0.11, yF - 0.1, [hatch, hoistHole], 2);
      b.unit(function () {
        // the bay's cheeks, cut between the main roof and the hood
        [-1, 1].forEach(function (s) { boards(b, 'z', xd + s * gW, s, zJ + 0.05, z1 - 0.12, function (z) { return roofY(z) - 0.12; }, function (z) { return pY0(z) - 0.1; }, [], 1); });
        [-1, 1].forEach(function (s) { b.post(xd + s * gW, eave, z1, 0.11, yF - 0.2 - eave, { c: 'beam' }); });
        b.box(xd, yF - 0.2, z1, 2 * gW + 0.22, 0.2, 0.22, { c: 'beam', m: M.wood, bevel: 0.03 });
      });
      b.unit(function () {
        // studs and lintel round the hatch, the hatch leaves open, the dark loft behind
        [-0.5, 0.5].forEach(function (dx) { b.box(xd + dx, eave, z1, 0.16, yF - 0.2 - eave, 0.2, { c: 'beam', m: M.wood, bevel: 0.02 }); });
        b.box(xd, hatch.y1, z1 + 0.02, 1.16, 0.14, 0.22, { c: 'beam', m: M.wood, bevel: 0.02 });
        b.box(xd, eave - 0.1, z1 - 0.7, 1.4, 0.1, 1.3, { c: 'woodDark', m: M.wood, bevel: 0.01 });
        b.box(xd, eave, z1 - 1.2, 1.2, 1.5, 0.05, { c: '#2b2420', m: M.dark, ao: 0, jit: 0 });
        leaf(b, xd - 0.42, hatch.y0 + 0.02, z1 + 0.12, -1.4, 0.41, 1.02);
        leaf(b, xd + 0.42, hatch.y0 + 0.02, z1 + 0.12, Math.PI + 1.3, 0.41, 1.02);
        sackLie(b, xd + 0.15, eave, z1 - 0.45, { ry: 0.2 });
      });
      b.unit(function () {
        // rafter ends and knee braces under the hood, and the fascia along its edge
        [-gW, -0.42, 0.42, gW].forEach(function (dx) { b.beam([xd + dx, pY0(z1) - 0.2, z1 + 0.1], [xd + dx, pY0(zf - 0.05) - 0.2, zf - 0.05], 0.06, { c: 'beam' }); });
        [-0.85, 0.85].forEach(function (dx) { b.beam([xd + dx, eave + 0.85, z1 + 0.12], [xd + dx, pY0(zf - 0.1) - 0.24, zf - 0.12], 0.055, { c: 'beam' }); });
        b.box(xd, pY0(zf) - 0.24, zf + 0.01, 2 * hoodX, 0.2, 0.06, { c: 'beam', m: M.wood, bevel: 0.015 });
        [-1, 1].forEach(function (s) { b.beam([xd + s * hoodX, pY0(zf) - 0.08, zf + 0.02], [xd + s * hoodX, pY0(zJ + 0.4) - 0.08, zJ + 0.4], 0.035, { c: 'beam', r2: 0.1 }); });
      });
      pentRoof(b, xd, 2 * hoodX, zf, pY0(zf), tp, zJ - 0.15, 6);

      b.part('Dragon gables');
      var off = -0.058, ext = 0.55;
      [[x0 - gOver - 0.045, -1], [x1 + gOver + 0.045, 1]].forEach(function (g) {
        b.unit(function () {
          var x = g[0], run = half + 0.45;
          // crossed barge boards, each running past the apex into a carved dragon head
          [-1, 1].forEach(function (s, i) {
            var xx = x + (i ? g[1] * 0.075 : 0);
            b.beam([xx, roofY(cz + s * run) + off, cz + s * run], [xx, apex + sl * ext + off, cz - s * ext], 0.035, { c: 'beam', r2: 0.13 });
            dragonHead(b, xx, apex + sl * ext + off - 0.05, cz - s * ext, 0.95, s > 0 ? Math.PI / 2 : -Math.PI / 2, -0.35);
            b.box(xx, roofY(cz + s * run) + off - 0.22, cz + s * (run - 0.05), 0.07, 0.2, 0.12, { c: 'beam', m: M.wood, bevel: 0.02 });
          });
          if (g[1] > 0) b.flag(x + 0.15, apex - 0.3, cz, 1.9, 0.95, 0.38, { c: 'ember', pennant: true, ry: -0.9, pr: 0.04 });
        });
      });
      b.part('Hoist');
      var bY = eave + 1.31, bEnd = z1 + 0.98, pZ = zf + 0.02, pY = bY - 0.34, hookY = 3.0, zb0 = z1 - 0.6;
      b.unit(function () {
        b.box(xd, bY, (zb0 + bEnd) / 2, 0.22, 0.22, bEnd - zb0, { c: 'beam', m: M.wood, bevel: 0.03 });
        dragonHead(b, xd, bY + 0.2, bEnd - 0.15, 0.7, -Math.PI / 2, -0.1);
        [z1 + 0.2, pZ - 0.2].forEach(function (z) { b.box(xd, bY - 0.01, z, 0.25, 0.24, 0.05, { c: 'iron', m: M.metal, bevel: 0.01 }); });
        // the pulley block
        b.box(xd, bY - 0.16, pZ, 0.05, 0.16, 0.05, { c: 'iron', m: M.metal, bevel: 0.005 });
        [-1, 1].forEach(function (s) { b.box(xd, pY - 0.17, pZ + s * 0.05, 0.32, 0.32, 0.03, { c: 'wood', m: M.wood, bevel: 0.01 }); });
        b.cyl(xd, pY, pZ - 0.03, 0.13, 0.06, { c: 'woodDark', m: M.wood, seg: 12, rx: Math.PI / 2 });
      });
      var hx = xd + 1.25, hz = pZ + 0.05, hry = -Math.PI / 2;
      b.unit(function () {
        // the rope down to a sling of two sacks, and down to the hauler's hands on the other side
        var lx = xd - 0.13;
        b.beam([lx, pY, pZ], [lx, hookY + 0.06, pZ], 0.018, { c: 'rope', m: M.rope, round: true, seg: 5 });
        b.addGeo(new T.TorusGeometry(0.06, 0.014, 4, 10), { x: lx, y: hookY, z: pZ, c: 'iron', m: M.metal, ao: 0 });
        sackLie(b, lx, 2.22, pZ, { ry: 0.1 }); sackLie(b, lx + 0.02, 2.5, pZ, { ry: -0.08 });
        [[-0.3, -0.18], [0.3, -0.18], [-0.3, 0.18], [0.3, 0.18]].forEach(function (p) { b.beam([lx, hookY - 0.05, pZ], [lx + p[0], 2.22, pZ + p[1]], 0.012, { c: 'rope', m: M.rope, round: true, seg: 4 }); });
        var h1 = by(hx, hz, hry, -0.05, 1.85, 0.25), h2 = by(hx, hz, hry, 0.05, 1.45, 0.3);
        b.beam([xd + 0.13, pY, pZ], h1, 0.018, { c: 'rope', m: M.rope, round: true, seg: 5 });
        b.beam(h1, h2, 0.018, { c: 'rope', m: M.rope, round: true, seg: 5 });
        b.beam(h2, [hx + 0.35, 0.06, hz + 0.25], 0.018, { c: 'rope', m: M.rope, round: true, seg: 5 });
        b.ropeCoil(hx + 0.45, 0, hz + 0.35, 0.22);
      });

      b.part('Landing and ladder');
      var lx0 = pd0 - 0.15, lx1 = pd1 + 0.15, lz0 = z1 + 0.12, lz1 = z1 + 1.25, lxc = (lx0 + lx1) / 2;
      b.unit(function () {
        [lx0 + 0.1, lx1 - 0.1].forEach(function (x) { b.box(x, -0.04, lz1 - 0.1, 0.4, 0.12, 0.4, { c: b.stoneC('stoneDark'), m: M.stone, bevel: 0.04 }); b.post(x, 0.06, lz1 - 0.1, 0.08, FL + 0.9, { c: 'beam' }); });
        b.box(lxc, FL - 0.42, lz1 - 0.1, lx1 - lx0, 0.2, 0.16, { c: 'beam', m: M.wood, bevel: 0.02 });
        [lx0 + 0.1, lxc, lx1 - 0.1].forEach(function (x) { b.box(x, FL - 0.22, (lz0 + lz1) / 2, 0.14, 0.16, lz1 - lz0, { c: 'woodDark', m: M.wood, bevel: 0.02 }); });
        [lx0 + 0.1, lx1 - 0.1].forEach(function (x) { b.beam([x, FL - 0.75, lz1 - 0.1], [x, FL - 0.24, lz0 + 0.5], 0.05, { c: 'beam' }); });
      });
      b.unit(function () { var n = 5, pw = (lz1 - lz0) / n; for (var i = 0; i < n; i++) b.box(lxc + b.j(0.02), FL - 0.06, lz0 + (i + 0.5) * pw, lx1 - lx0 + 0.04, 0.06, pw - 0.02, { c: b.pick(PAL.storehouseBoard), m: M.wood, bevel: 0.01 }); });
      b.unit(function () {
        [lx0 + 0.1, lx1 - 0.1].forEach(function (x) {
          b.beam([x, FL + 0.86, lz1 - 0.1], [x, FL + 0.86, lz0], 0.045, { c: 'beam' });
          b.beam([x, FL + 0.45, lz1 - 0.1], [x, FL + 0.45, lz0], 0.035, { c: 'beam' });
        });
      });
      b.unit(function () {
        var h = FL + 0.8, lean = 0.9, offL = lean * h * 0.3, zt = lz1 + 0.04 - offL * (1 - FL / h);
        b.ladder(lxc, 0, zt, h, { ry: 0, lean: lean, w: 0.55 });
      });

      b.part('Shields and sign');
      b.unit(function () {
        var y = FL + 1.75;
        shieldHalves(b, (x0 + pd0) / 2, y, z1, 0, 'ink', 'bone', 0.75, 0.3);
        shieldHalves(b, pd1 + 0.5, y, z1, 0, 'bone', 'ink', 0.75, -0.4);
        shieldHalves(b, pd1 + 1.48, y, z1, 0, 'inkGrey', 'bone', 0.75, Math.PI / 2);
        shieldHalves(b, (xd + fdW + 0.12 + x1) / 2, y, z1, 0, 'ink', null, 0.75);
      });
      b.unit(function () {
        // a painted sign of a sheaf, hung off the front corner post on an iron arm
        var sy = FL + 2.05;
        b.beam([x1, sy, z1 + 0.12], [x1, sy, z1 + 1.0], 0.035, { c: 'iron', m: M.metal });
        b.beam([x1, sy - 0.45, z1 + 0.12], [x1, sy, z1 + 0.7], 0.025, { c: 'iron', m: M.metal });
        b.push(x1, sy - 0.06, z1 + 0.62, Math.PI / 2);
        [-0.32, 0.32].forEach(function (dx) { b.beam([dx, 0.04, 0], [dx, -0.12, 0], 0.01, { c: 'iron', m: M.metal, round: true }); });
        b.box(0, -0.82, 0, 0.8, 0.7, 0.06, { c: 'ink', m: M.paint, bevel: 0.015 });
        b.box(0, -0.84, 0, 0.8, 0.035, 0.065, { c: 'ember', m: M.paint, bevel: 0.005 });
        sheafSign(b, 0, -0.46, 0.034, 0.62, '#f1eee8');
        b.pop();
      });
      b.unit(function () {
        b.torch(pd1, FL + 1.35, z1 + 0.12, { s: 0.55 });
        b.torch(xd - fdW - 0.12, FL + 1.35, z1 + 0.12, { s: 0.55 });
      });

      b.part('Siege stores');
      // a pyramid of barrels on chocks, laid row by row
      var px0 = 4.4, pz = -0.7;
      b.unit(function () {
        [-0.28, 0.28].forEach(function (dz) { b.box(px0 + 1.0, 0, pz + dz, 2.9, 0.08, 0.14, { c: 'woodDark', m: M.wood, bevel: 0.01 }); });
        for (var i = 0; i < 4; i++) b.barrel(px0 + i * 0.66 + b.j(0.02), 0.06, pz + b.j(0.04), { lie: true, ry: Math.PI / 2 + b.j(0.04) });
      });
      b.unit(function () { for (var i = 0; i < 3; i++) b.barrel(px0 + 0.33 + i * 0.66 + b.j(0.02), 0.62, pz + b.j(0.04), { lie: true, ry: Math.PI / 2 + b.j(0.04) }); });
      b.unit(function () {
        for (var i = 0; i < 2; i++) b.barrel(px0 + 0.66 + i * 0.66 + b.j(0.02), 1.18, pz + b.j(0.04), { lie: true, ry: Math.PI / 2 + b.j(0.04) });
        b.barrel(px0 + 0.99, 1.74, pz, { lie: true, ry: Math.PI / 2 });
        [-0.06, 2.04].forEach(function (dx) { b.box(px0 + dx, 0.06, pz, 0.16, 0.16, 0.5, { c: 'wood', m: M.wood, taper: 0.4, taperD: 1 }); });
      });
      // bonded stacks of sacks
      var sx = 3.9, sz = 2.0, sTop = sackStack(b, sx, sz, [[3, 2], [2, 3], [2, 2]], 0.15);
      b.unit(function () {
        b.sack(-3.75, 0, 2.45, 0.55); b.sack(-4.2, 0, 2.0, 0.5); b.sack(-3.55, 0, 2.95, 0.46); b.sack(-4.35, 0, 2.6, 0.42);
        sackLie(b, -4.0, 0, 1.45, { ry: 0.5 });
      });
      // crates
      b.unit(function () { b.crate(-5.6, 0, -2.9, 0.8, { ry: 0.25 }); b.crate(-5.8, 0, -2.05, 0.72, { ry: -0.15 }); b.crate(-5.65, 0.8, -2.8, 0.62, { ry: 0.55 }); });
      b.unit(function () { b.crate(5.6, 0, -3.4, 0.75, { ry: 0.1 }); b.crate(6.4, 0, -3.1, 0.7, { ry: -0.3 }); b.barrel(4.8, 0, -3.3, {}); b.barrel(4.2, 0, -3.7, { h: 0.82 }); b.crate(6.2, 0.7, -3.25, 0.55, { ry: 0.4 }); });
      // the cart, backed in under the hoist with its load
      var cartX = xd - 0.13, cartZ = z1 + 1.55;
      b.unit(function () {
        b.cart(cartX, cartZ, { load: function () {
          sackLie(b, -0.28, 0.77, -0.25, { ry: Math.PI / 2 + 0.1 }); sackLie(b, 0.26, 0.77, -0.3, { ry: Math.PI / 2 - 0.05 });
          sackLie(b, -0.25, 0.77, 0.55, { ry: Math.PI / 2 - 0.1 }); sackLie(b, 0.05, 1.05, 0.1, { ry: 0.15 });
          b.barrel(0.32, 0.77, 0.6, { h: 0.7, r: 0.26 });
        } });
        b.lathe(cartX - 0.55, 0, z1 + 0.75, [[0.01, 0], [0.42, 0], [0.22, 0.07], [0.01, 0.1]], { c: 'straw', m: M.straw, seg: 10 });
      });
      // the weighing tripod with a steelyard, and the tally table
      var tx = 5.2, tz = 4.0;
      b.unit(function () {
        [0, 2.09, 4.19].forEach(function (a) { b.beam([tx + Math.cos(a) * 1.0, 0, tz + Math.sin(a) * 1.0], [tx + Math.cos(a) * 0.06, 2.65, tz + Math.sin(a) * 0.06], 0.045, { c: 'wood', round: true, seg: 6 }); });
        b.cyl(tx, 2.42, tz, 0.1, 0.16, { c: 'rope', m: M.rope, seg: 8 });
        b.beam([tx, 2.42, tz], [tx, 2.02, tz], 0.012, { c: 'iron', m: M.metal, round: true });
        b.beam([tx - 0.32, 1.98, tz], [tx + 0.72, 2.04, tz], 0.025, { c: 'iron', m: M.metal, round: true });
        b.beam([tx + 0.6, 2.03, tz], [tx + 0.6, 1.86, tz], 0.008, { c: 'iron', m: M.metal, round: true }); b.ball(tx + 0.6, 1.8, tz, 0.08, { c: 'iron', m: M.metal, detail: 1 });
        b.beam([tx - 0.25, 1.98, tz], [tx - 0.25, 1.72, tz], 0.012, { c: 'rope', m: M.rope, round: true });
        b.sack(tx - 0.25, 1.06, tz, 0.55);
      });
      b.unit(function () {
        var bx = 6.7, bz = 2.9, ry = -0.35;
        b.table(bx, bz, 1.3, 0.7, { ry: ry });
        b.push(bx, 0.81, bz, ry);
        b.box(-0.15, 0, 0.02, 0.3, 0.03, 0.4, { c: '#f3f1ec', m: M.paint, ry: 0.06, bevel: 0.005 }); b.box(0.16, 0, 0.02, 0.3, 0.03, 0.4, { c: '#efebe4', m: M.paint, ry: -0.06, bevel: 0.005 });
        b.box(0, -0.01, 0.02, 0.66, 0.02, 0.44, { c: '#1f1e1c', m: M.wood, bevel: 0.005 });
        b.cyl(0.45, 0, -0.15, 0.05, 0.08, { c: '#1f1e1c', m: M.paint, seg: 8 });
        for (var i = 0; i < 6; i++) b.box(-0.48 + i * 0.03, 0, -0.18, 0.02, 0.02, 0.28, { c: 'woodLight', m: M.wood, ry: b.j(0.1), bevel: 0.003 });
        b.pop();
        b.bench(bx - 0.25, bz - 0.7, 0.9, { ry: ry });
      });
      // fire water, firewood and odds
      b.unit(function () {
        [[-5.6, 1.5, 0.38], [-6.25, 1.0, 0.34]].forEach(function (w) { b.barrel(w[0], 0, w[1], { r: w[2], h: 1.0 }); b.cyl(w[0], 0.96, w[1], w[2] * 0.82, 0.02, { c: '#3d4a4c', m: M.water, seg: 14 }); });
        b.bucket(-5.1, 0, 2.05); b.bucket(-6.2, 0, 1.8);
      });
      b.unit(function () {
        b.woodpile(-6.4, -0.6, { n: 4, len: 1.7, ry: Math.PI / 2 }); b.woodpile(-7.1, -0.9, { n: 3, len: 1.5, ry: Math.PI / 2 + 0.1 });
        b.log(-6.6, 0, -2.3, 0.26, 0.5, { c: 'wood', seg: 9 });
        b.beam([-6.55, 0.48, -2.25], [-6.3, 0.78, -2.35], 0.025, { c: 'woodLight', round: true });
        b.box(-6.28, 0.72, -2.35, 0.06, 0.12, 0.16, { c: 'iron', m: M.metal, rx: 0.2, bevel: 0.01 });
      });
      b.unit(function () {
        // a broom against the landing post, a barrel being rolled to the pyramid, the granary cat on the sacks
        b.beam([lx1 + 0.3, 0.05, lz1 + 0.05], [lx1 + 0.02, 1.55, lz1 - 0.1], 0.022, { c: 'woodLight', round: true, seg: 5 });
        b.cone(lx1 + 0.3, 0.0, lz1 + 0.05, 0.12, 0.35, { c: '#a69576', m: M.straw, seg: 7 });
        b.barrel(5.5, 0, 0.95, { lie: true, ry: 0.1 });
        cat(b, sx - 0.1, sTop - 0.04, sz + 0.2, -0.6);
      });

      // spare crates by the path, a cartwheel leaned on them for mending, a sack waiting
      b.unit(function () {
        b.crate(3.3, 0, 4.7, 0.7, { ry: 0.3 }); b.crate(4.05, 0, 4.95, 0.62, { ry: -0.2 }); b.crate(3.45, 0.7, 4.75, 0.55, { ry: 0.05 });
        b.wheel(3.05, 0.5, 5.25, 0.52, { ry: 0.3 + Math.PI / 2 + 1.25, c: 'wood' });
        b.sack(2.55, 0, 4.3, 0.48);
      });
      // the fish rack in the front yard, and a basket of fish at its foot
      var fkx = -5.1, fkz = 3.9;
      fishRack(b, fkx, fkz, 2.6);
      b.unit(function () {
        var kx = fkx - 0.2, kz = fkz - 0.95;
        b.lathe(kx, 0, kz, [[0.01, 0], [0.22, 0], [0.27, 0.3], [0.25, 0.32], [0.01, 0.3]], { c: '#8a7552', m: M.straw, seg: 11, flat: true, ao: 0.3 });
        for (var i = 0; i < 5; i++) b.ball(kx + b.j(0.12), 0.3, kz + b.j(0.12), 0.05, { c: b.pick(PAL.storehouseFish), m: M.cloth, sx: 3.2, sy: 0.5, ry: b.r() * 3, detail: 1, ao: 0.2 });
        b.sack(fkx - 0.75, 0, fkz - 1.0, 0.42);
      });

      b.part('Grass and flowers');
      b.unit(function () {
        zs.forEach(function (z) { xs.forEach(function (x) { b.grass(x + 0.34, 0, z + 0.2, 0.45); b.grass(x - 0.3, 0, z - 0.25, 0.35); }); });
        b.bush(x0 - 0.35, z1 - 1.4, 0.5, { flowers: '#f3f1ec', n: 2 });
        b.bush(x1 + 0.5, z1 - 0.5, 0.45, { flowers: '#e6e3dc', n: 2 });
        b.flowers(x1 + 0.7, 0, -1.3, 0.4, { n: 6 });
        b.grass(lx0 - 0.2, 0, lz1, 0.5); b.grass(-6.8, 0, 2.2, 0.4); b.grass(3.4, 0, 2.6, 0.4);
      });

      b.life(function () {
        // hauling the load up to the dormer
        b.figure(hx, hz, { role: 'villager', pose: 'storehouseHaul', ry: hry, c: '#5c5e62' });
        // pointing up from the loading door
        b.figure(xd - 0.1, z1 - 0.25, { role: 'villager', pose: 'point', ry: 0.2, y: FL, c: '#8a857c' });
        // lifting a sack out of the cart
        var lxf = cartX - 1.25, lzf = cartZ - 0.35, lry = Math.PI / 2;
        b.figure(lxf, lzf, { role: 'villager', pose: 'storehouseLift', ry: lry, c: '#3b3a38' });
        var sp = by(lxf, lzf, lry, 0, 1.3, 0.62); sackLie(b, sp[0], sp[1] - 0.12, sp[2], { ry: lry + Math.PI / 2 });
        // carrying a sack in at the door off the landing
        b.figure(lxc + 0.05, z1 + 0.7, { role: 'villager', pose: 'carry', ry: Math.PI, y: FL, c: '#6f6a62' });
        // rolling a barrel to the pyramid
        b.figure(5.55, 1.7, { role: 'villager', pose: 'storehouseRoll', ry: Math.PI + 0.1, c: '#4a4c50' });
        // the reeve at the steelyard, reading the weight
        b.figure(tx + 1.0, tz + 0.7, { role: 'villager', pose: 'point', ry: -2.2, c: '#2f2e2c', beard: true });
        // a guard on the stores, and a child with a wooden sword
        b.figure(-2.3, 4.5, { role: 'soldier', pose: 'spear', ry: -0.5 });
        b.figure(-0.9, 5.6, { role: 'child', pose: 'run', ry: 1.9 });
        // carrying a sack off the cart to the stacks
        b.figure(2.35, 3.55, { role: 'villager', pose: 'carry', ry: 2.2, c: '#58544e' });
        // hanging the catch on the fish rack
        b.figure(fkx + 0.55, fkz - 0.72, { role: 'villager', pose: 'storehouseHang', ry: 0.05, c: '#77726a' });
      });
    }
  });
})();
