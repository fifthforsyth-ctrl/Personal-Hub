// Title of Liberty (Alma 46:12-13): a tall pole on a stepped stone plinth flying Moroni's torn coat, written over in
// dark lines, "In memory of our God, our religion, and freedom, and our peace, our wives, and our children".
// Moroni stands on the plinth with his sword raised; the people gather, cheer, and cast their rent garments at his
// feet. Built tier by tier, then the pole, the yard, the coat and its writing, the posts, the covenant stone, the arms.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL;
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  PAL.liberty_flag = ['#7e786f', '#888177', '#746f67', '#8f887d', '#6f6a63'];
  PAL.liberty_tread = ['#958f85', '#9e978c', '#8c867d', '#a49d91'];

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
  }
  // a grid of flagstones over a rectangle, top at y, each slab its own size and tone
  function paving(b, x0, x1, z0, z1, y, o) {
    o = o || {}; var sl = o.len || 0.7, sd = o.dep || 0.55, rows = Math.max(1, Math.round((z1 - z0) / sd)), dz = (z1 - z0) / rows;
    for (var r = 0; r < rows; r++) {
      var t = x0, cuts = [x0]; if (r % 2) t += sl * 0.45;
      while (t < x1 - 0.2) { t += sl * (0.7 + b.r() * 0.6); if (t < x1 - 0.18) cuts.push(t); } cuts.push(x1);
      if (cuts[1] - cuts[0] < 0.2) cuts.splice(1, 1);
      for (var i = 0; i < cuts.length - 1; i++) {
        var w = cuts[i + 1] - cuts[i] - 0.04, zc = z0 + (r + 0.5) * dz;
        if (o.skip && o.skip((cuts[i] + cuts[i + 1]) / 2, zc)) continue;
        b.box((cuts[i] + cuts[i + 1]) / 2, y - 0.12 + b.j(0.008), zc, w, 0.12, dz - 0.04, { c: b.stoneC(o.pal || 'sandstone'), m: M.stone, bevel: 0.035, ry: b.j(0.01), ao: 0.15, jit: 0.04 });
      }
    }
  }

  // Moroni: sword arm raised high, his face turned up to the title
  KIT.people.poses.liberty_oath = function (r) { return { feet: [V(-0.16, 0.09, 0.06), V(0.15, 0.09, -0.06)], hands: [V(-0.17, 2.02, 0.16), V(0.3, 0.98, 0.12)], lean: -0.04, twist: 0.05, side: 0.04, hip: 0.03, drop: 0, head: [0.45, -0.3], pole: [V(-1, -0.2, -0.1), V(0.7, -0.4, -0.4)] }; };
  // one knee down, laying a rent garment at the foot of the plinth
  KIT.people.poses.liberty_kneel = function (r) { return { feet: [V(-0.13, 0.08, -0.5), V(0.15, 0.09, 0.32)], hands: [V(-0.16, 0.5, 0.52), V(0.16, 0.52, 0.5)], lean: 0.38, twist: 0.05, side: 0, hip: 0, drop: 0.42, head: [0, 0.3], pole: [V(-0.5, -0.6, -0.3), V(0.5, -0.6, -0.3)] }; };

  KIT.defineBuild('liberty', {
    name: 'Title of Liberty', size: 'small', need: 14,
    line: 'Moroni’s torn coat, written over with the cause of liberty, flown from a tall pole on a stepped stone plinth.',
    r: 7.5, flat: [8.8, 8.6], ground: 'grass', path: [[0.4, 8.2], [0.2, 3.4]],
    frameY: 3.5, frameR: 8.2, glowAt: [1.4, 9.4, -1.2],
    trees: [{ x: -4.6, z: -5.0, kind: 'pine', h: 6.6 }, { x: 6.0, z: 0.4, kind: 'birch', h: 5.0 }, { x: -6.1, z: -1.8, kind: 'round', h: 3.4 }],
    bushes: [{ x: 5.4, z: 3.0, r: 0.7, flowers: '#f3f1ec' }, { x: -4.6, z: 4.6, r: 0.65, flowers: '#f3f1ec' }, { x: 4.6, z: -4.6, r: 0.6 }],
    build: function (b) {
      var cx = -0.5, cz = -0.9;
      var tiers = [{ w: 5.6, y: 0, h: 0.45 }, { w: 4.2, y: 0.45, h: 0.45 }, { w: 2.8, y: 0.9, h: 0.5 }];
      var deck = 1.4;

      var gh = function (x, z) { return b.ground ? b.ground.height(x, z) : 0; };
      b.part('Paved square');
      // the square the people gather on, flagged in darker stone, its edge ragged where the turf creeps in
      var sq = { x0: cx - 4.0, x1: cx + 4.05, z0: cz - 3.2, z1: cz + 5.3 };
      var under = function (x, z) { return Math.abs(x - cx) < 2.72 && Math.abs(z - cz) < 2.72; };
      var ragged = function (x, z) { var e = Math.min(x - sq.x0, sq.x1 - x, z - sq.z0, sq.z1 - z); return e < 0.75 && b.r() < 0.55 - e * 0.5; };
      b.unit(function () { paving(b, sq.x0, sq.x1, sq.z0, cz + 1.0, 0.05, { pal: 'liberty_flag', len: 0.62, dep: 0.5, skip: function (x, z) { return under(x, z) || ragged(x, z); } }); });
      b.unit(function () { paving(b, sq.x0, sq.x1, cz + 1.0, sq.z1, 0.05, { pal: 'liberty_flag', len: 0.62, dep: 0.5, skip: function (x, z) { return under(x, z) || ragged(x, z); } }); });

      tiers.forEach(function (t, i) {
        b.part(['Footing course', 'Second tier', 'Top tier'][i]);
        b.stoneBox(cx, cz, t.w, t.w, t.y, t.h, 0.55, { pal: i === 0 ? 'stoneDark' : 'stone', course: i === 2 ? 0.25 : t.h, len: 0.8 });
        b.unit(function () { paving(b, cx - t.w / 2 - 0.05, cx + t.w / 2 + 0.05, cz - t.w / 2 - 0.05, cz + t.w / 2 + 0.05, t.y + t.h + 0.04, { pal: i === 2 ? 'stone' : 'liberty_tread', len: 0.75, dep: 0.6 }); });
        b.unit(function () {
          // two steps up the front, the lower one of three stones
          var zf = cz + t.w / 2, sh = t.h / 2;
          [-0.6, 0, 0.6].forEach(function (dx) { b.box(cx + dx, t.y, zf + 0.2, 0.57, sh, 0.42, { c: b.stoneC('sandstone', t.y), m: M.stone, bevel: 0.04 }); });
          if (i === 0) { [[-2.3, 0.4], [2.3, -0.3]].forEach(function (q) { b.box(cx + q[0], 0, zf + 0.35, 0.7 + q[1] * 0.2, 0.22, 0.5, { c: b.stoneC('stoneDark'), m: M.stone, bevel: 0.05, ry: q[1] }); }); }
        });
      });

      b.part('Shields on the tiers');
      b.unit(function () {
        // a frieze of small round shields along the faces of the upper tiers, either side of the steps
        var K = ['half', 'quarter', 'ring', 'cross'], n = 0;
        [[1, 0.2, 0.17], [2, 0.25, 0.19]].forEach(function (q) {
          var t = tiers[q[0]], zf = cz + t.w / 2;
          [-1, 1].forEach(function (sd) { for (var k = 0; k < 2; k++) { var x = cx + sd * (1.35 + k * 0.6) * (q[0] === 2 ? 0.62 : 1); if (Math.abs(x - cx) > t.w / 2 - 0.25) continue; var ink = (n++) % 2 === 0; vShield(b, x, t.y + q[1], zf + 0.02, 0, q[2], K[n % 4], ink ? 'ink' : 'bone', ink ? 'bone' : 'ink'); } });
        });
        // moss and ivy at the corners of the footing course
        b.ivy([[cx - 2.75, 0.1, cz + 2.75], [cx - 2.7, 0.5, cz + 2.7], [cx - 2.0, 0.85, cz + 2.1]], [-0.7, 0, 0.7], { density: 6, spread: 0.3 });
        b.ivy([[cx + 2.75, 0.1, cz - 2.2], [cx + 2.78, 0.4, cz - 1.0]], [1, 0, 0], { density: 6, spread: 0.3 });
      });

      b.part('Socket stone');
      b.unit(function () {
        b.box(cx, deck, cz, 1.1, 0.55, 1.1, { c: 'sandstone', m: M.stone, bevel: 0.08 });
        b.box(cx, deck + 0.55, cz, 0.86, 0.2, 0.86, { c: 'sandstone', m: M.stone, bevel: 0.06, taper: 0.8 });
        for (var i = 0; i < 4; i++) { var a = i * Math.PI / 2 + 0.785; b.box(cx + Math.cos(a) * 0.2, deck + 0.72, cz + Math.sin(a) * 0.2, 0.1, 0.14, 0.06, { c: 'iron', m: M.metal, ry: -a, bevel: 0.01, taper: 0.5 }); }
      });

      b.part('The pole');
      var p0 = deck + 0.7, pTop = 9.95, yard = 9.3, pr = function (y) { return 0.12 - 0.045 * (y - p0) / (pTop - p0); };
      b.unit(function () { b.cyl(cx, p0 - 0.1, cz, pr(p0), 4.2, { r2: pr(p0 + 4.1), c: 'wood', m: M.wood, seg: 10 }); });
      b.unit(function () {
        b.cyl(cx, p0 + 4.1, cz, pr(p0 + 4.1), pTop - p0 - 4.1, { r2: pr(pTop), c: 'wood', m: M.wood, seg: 10 });
        [p0 + 0.5, p0 + 4.1, yard - 0.25].forEach(function (y) { b.cyl(cx, y - 0.06, cz, pr(y) + 0.018, 0.12, { c: 'iron', m: M.metal, seg: 10 }); });
      });
      var RY = 0.12, YP = function (x, y, dz) { return [cx + x * Math.cos(RY) + (dz || 0) * Math.sin(RY), y, cz - x * Math.sin(RY) + (dz || 0) * Math.cos(RY)]; };
      b.unit(function () {
        // the yard the coat hangs from, braced to the pole and lashed
        b.beam(YP(-0.18, yard), YP(3.6, yard - 0.04), 0.055, { c: 'wood', m: M.wood, round: true, seg: 8, r2: 0.045 });
        b.beam(YP(0.05, yard - 1.0, -0.06), YP(1.0, yard - 0.03, -0.06), 0.035, { c: 'wood', m: M.wood, round: true, seg: 6 });
        b.cyl(cx, yard - 0.1, cz, pr(yard) + 0.03, 0.2, { c: 'rope', m: M.rope, seg: 10 });
        var e = YP(3.64, yard - 0.04); b.ball(e[0], e[1], e[2], 0.06, { c: 'iron', m: M.metal, detail: 0 });
        // a spear-point crowning the pole, and a thin orange streamer tied below it
        b.cyl(cx, pTop, cz, 0.065, 0.1, { c: 'iron', m: M.metal, seg: 8 });
        b.extrude(cx, pTop + 0.08, cz, [[-0.07, 0], [0.07, 0], [0.09, 0.16], [0, 0.5], [-0.09, 0.16]], 0.04, { c: 'steel', m: M.metal, bevel: 0.006 });
        b.flag(cx, pTop - 0.55, cz, 0.45, 1.3, 0.2, { c: 'ember', pennant: true, pr: 0.001, ry: -0.3 });
      });

      b.part('Guy ropes');
      [[[-1, -1], [1, -1]], [[-1, 0.3], [1, 0.3]]].forEach(function (pair, pi) {
        b.unit(function () {
          pair.forEach(function (s) {
            var gx = cx + s[0] * 2.55, gz = cz + s[1] * 2.55;
            b.beam([cx, 5.3, cz], [gx, 0.62, gz], 0.016, { c: 'rope', m: M.rope, round: true, seg: 4 });
            b.addGeo(new T.TorusGeometry(0.09, 0.02, 4, 10), { x: gx, y: 0.6, z: gz, ry: Math.atan2(s[0], s[1]), c: 'iron', m: M.metal });
            b.box(gx, 0.48, gz, 0.12, 0.08, 0.12, { c: 'iron', m: M.metal, bevel: 0.01 });
          });
          if (pi === 0) b.cyl(cx, 5.23, cz, pr(5.3) + 0.025, 0.16, { c: 'rope', m: M.rope, seg: 10 });
        });
      });

      // ---------------------------------------------------------------- the coat
      // the cloth as a surface: u across from the pole (0) to the free edge (1), v down from the yard (0) to the hem (1)
      var CW = 3.3, CH = 3.75, ctop = yard - 0.07, cz0 = cz;
      var cr = KIT.util.rng(4612);
      function S(u, v) {
        var amp = (0.12 + 0.88 * Math.min(1, v * 2.2 + 0.1)) * (0.25 + 0.75 * u);
        var x = 0.14 + u * CW + v * v * 0.28 * u + Math.sin(v * 3.1 + 0.4) * 0.05 * u;
        var y = -v * CH - u * u * 0.1 * v + Math.sin(u * 7.0 + 1.3) * 0.03 * v;
        var z = (Math.sin(u * 3.3 - 0.5 + v * 1.6) * 0.2 + Math.sin(u * 8.0 + v * 4.0) * 0.04) * amp;
        var c = Math.cos(RY), s = Math.sin(RY);
        return V(cx + x * c + z * s, ctop + y, cz0 - x * s + z * c);
      }
      function N(u, v) { var e = 0.004, a = S(u + e, v).sub(S(u - e, v)), c = S(u, v + e).sub(S(u, v - e)); return c.cross(a).normalize(); }
      // a patch of the surface between u0..u1, v0(u)..v1(u), with an optional push along the normal
      function patch(u0, u1, v0f, v1f, nu, nv, off) {
        var pos = [], idx = [], i, j;
        for (j = 0; j <= nv; j++) for (i = 0; i <= nu; i++) {
          var u = u0 + (u1 - u0) * i / nu, va = v0f(u), vb = v1f(u), v = va + (vb - va) * j / nv, p = S(u, v);
          if (off) p.addScaledVector(N(u, v), off);
          pos.push(p.x, p.y, p.z);
        }
        for (j = 0; j < nv; j++) for (i = 0; i < nu; i++) { var a = j * (nu + 1) + i, c2 = a + nu + 1; idx.push(a, c2 + 1, a + 1, a, c2, c2 + 1); }
        var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        return g;
      }
      // the ragged free edge and the torn hem
      var edgeJ = []; for (var q = 0; q <= 40; q++) edgeJ.push(1 - (q % 2 ? 0.02 + cr() * 0.05 : cr() * 0.015));
      var uMax = function (v) { var f = v * 40, k = Math.floor(f), t = f - k; return edgeJ[Math.min(40, k)] * (1 - t) + edgeJ[Math.min(40, k + 1)] * t; };
      var BODY = 0.6;
      var tongues = [[0.0, 0.2, 0.97], [0.215, 0.43, 0.86], [0.445, 0.63, 1.0], [0.645, 0.8, 0.78], [0.815, 0.985, 0.9]];
      b.part('The coat');
      b.unit(function () {
        var pos = [], idx = [], NU = 30, NV = 16;
        for (var j = 0; j <= NV; j++) { var v = j / NV * BODY, um = uMax(v); for (var i = 0; i <= NU; i++) { var s2 = S(i / NU * um, v); pos.push(s2.x, s2.y, s2.z); } }
        for (j = 0; j < NV; j++) for (i = 0; i < NU; i++) { var a = j * (NU + 1) + i, c2 = a + NU + 1; idx.push(a, c2 + 1, a + 1, a, c2, c2 + 1); }
        var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        b.addGeo(g, { c: 'bone', m: M.cloth, bucket: 'cloth', ao: 0.12, jit: 0.01, vary: 0.05 });
        // the hem rolled over the yard, and ties down the pole
        for (var k = 0; k < 10; k++) { var u = 0.04 + k * 0.104, pp = S(u, 0.0); b.cyl(pp.x + 0.05, pp.y + 0.07, pp.z, 0.075, 0.1, { c: 'rope', m: M.rope, seg: 6, rz: Math.PI / 2, ry: -RY }); }
        for (var t = 0; t < 5; t++) { var vv = 0.1 + t * 0.2; if (vv > 0.95) break; var pt = S(0.0, vv); b.beam([cx, pt.y + 0.03, cz], [pt.x, pt.y, pt.z], 0.016, { c: 'rope', m: M.rope, round: true, seg: 4 }); b.cyl(cx, pt.y - 0.03, cz, pr(pt.y) + 0.02, 0.07, { c: 'rope', m: M.rope, seg: 8 }); }
      });
      b.unit(function () {
        // the tongues of the torn skirt, each with a jagged end
        tongues.forEach(function (tg, n) {
          var u0 = tg[0], u1 = Math.min(tg[1], uMax(BODY) - 0.002), end = tg[2];
          var jag = []; for (var q = 0; q <= 6; q++) jag.push(end - (q % 2 ? 0.03 + cr() * 0.07 : cr() * 0.02));
          var v1f = function (u) { var f = (u - u0) / (u1 - u0) * 6, k = Math.floor(f), t = f - k; return jag[Math.min(6, k)] * (1 - t) + jag[Math.min(6, k + 1)] * t; };
          b.addGeo(patch(u0, u1, function () { return BODY - 0.002; }, v1f, 7, 10, 0), { c: n % 2 ? '#ece8df' : 'bone', m: M.cloth, bucket: 'cloth', ao: 0.15, jit: 0.01, vary: 0.05 });
        });
        // one sleeve still on the coat, hanging from the yard's end
        var s0 = S(0.93, 0.03), pts = [[s0.x, s0.y - 0.05, s0.z], [s0.x + 0.12, s0.y - 0.45, s0.z + 0.1], [s0.x + 0.28, s0.y - 0.9, s0.z + 0.16], [s0.x + 0.38, s0.y - 1.3, s0.z + 0.12]];
        for (var k = 0; k < 3; k++) b.beam(pts[k], pts[k + 1], 0.15 - k * 0.022, { r2: 0.128 - k * 0.022, round: true, seg: 10, c: 'bone', m: M.cloth });
        b.cyl(pts[3][0], pts[3][1] - 0.02, pts[3][2], 0.095, 0.05, { c: '#ddd7cb', m: M.cloth, seg: 10, open: true });
      });

      // the writing: lines of short dark strokes, on both faces, following the folds
      function writing(lines) {
        var ink = function (u0, u1, va, vb) { [0.016, -0.016].forEach(function (off) { b.addGeo(patch(u0, u1, function () { return va; }, function () { return vb; }, Math.max(1, Math.round((u1 - u0) / 0.02)), 1, off), { c: '#1c1b1a', m: M.cloth, bucket: 'cloth', ao: 0, jit: 0.01, vary: 0.02 }); }); };
        lines.forEach(function (ln) {
          // each word one stroke of the pen, with an upright here and there for the tall letters
          var v = 0.07 + ln * 0.074, u = 0.08 + cr() * 0.04, uEnd = (ln === 6 ? 0.55 : 0.88) - cr() * 0.04;
          while (u < uEnd - 0.03) {
            var w = Math.min(uEnd - u, 0.05 + cr() * 0.1), hv = 0.0085;
            ink(u, u + w, v - hv, v + hv);
            var ticks = Math.floor(cr() * 3);
            for (var t = 0; t < ticks; t++) { var tu = u + 0.01 + cr() * (w - 0.02), up = cr() < 0.6; ink(tu, tu + 0.007, up ? v - 0.03 : v, up ? v : v + 0.026); }
            u += w + 0.022 + cr() * 0.012;
          }
        });
      }
      b.part('The writing');
      b.unit(function () { writing([0, 1]); });
      b.unit(function () { writing([2, 3]); });
      b.unit(function () { writing([4, 5, 6]); });

      b.part('Carved posts and torches');
      [-1, 1].forEach(function (s) {
        b.unit(function () {
          var px = cx + s * 2.45, pz = cz + 2.45;
          stave(b, px, 0.49, pz, 2.35, 0.24, { cap: false });
          b.box(px, 0.49, pz, 0.46, 0.16, 0.46, { c: 'stoneDark', m: M.stone, bevel: 0.04 });
          dragonHead(b, px, 2.84, pz, s > 0 ? 0 : Math.PI, 0.78);
          vShield(b, px, 1.6, pz + 0.14, 0, 0.3, s > 0 ? 'half' : 'quarter', s > 0 ? 'ink' : 'bone', s > 0 ? 'bone' : 'ink');
        });
      });
      b.unit(function () { [-1, 1].forEach(function (s) { b.torch(cx + s * 2.45 + s * 0.13, 2.25, cz + 2.45, { s: 0.45, ry: s * Math.PI / 2 }); }); });

      b.part('Covenant stone');
      var rsx = cx + 4.1, rsz = cz + 3.1, rsry = -0.35;
      var RS = [[-0.5, 0], [0.52, 0], [0.58, 1.1], [0.5, 1.72], [0.26, 2.12], [-0.08, 2.24], [-0.38, 2.02], [-0.55, 1.45]];
      b.unit(function () {
        b.extrude(rsx, 0, rsz, RS, 0.34, { c: 'stoneCool', m: M.stone, bevel: 0.05, ry: rsry });
        for (var i = 0; i < 5; i++) { var a = i * 1.3; b.rock(rsx + Math.cos(a) * 0.62, 0.0, rsz + Math.sin(a) * 0.4, 0.14 + b.r() * 0.08); }
      });
      b.unit(function () {
        // a carved serpent band round the face, and the oath cut in rows inside it
        b.push(rsx, 0, rsz, rsry);
        var inset = RS.map(function (p) { return [p[0] * 0.8, 0.12 + p[1] * 0.86]; });
        for (var i = 0; i < inset.length; i++) {
          var a = inset[i], c = inset[(i + 1) % inset.length]; if (i === inset.length - 1) continue;
          b.beam([a[0], a[1], 0.225], [c[0], c[1], 0.225], 0.035, { c: '#2a2826', m: M.dark, r2: 0.012 });
        }
        for (var r = 0; r < 6; r++) { var y = 0.45 + r * 0.22, w = 0.62 - Math.abs(r - 2.5) * 0.03 - (r > 4 ? 0.2 : 0); for (var t = -w / 2; t < w / 2 - 0.04;) { var L = 0.04 + b.r() * 0.08; b.box(t + L / 2, y, 0.222, L, 0.055, 0.02, { c: '#2a2826', m: M.dark, bevel: 0, ao: 0 }); t += L + 0.03; } }
        dragonHead(b, inset[inset.length - 1][0] + 0.02, inset[inset.length - 1][1] - 0.1, 0.235, 0, 0.22, { c: '#2a2826' });
        b.pop();
      });

      b.part('Arms and rent garments');
      b.unit(function () {
        // shields leant against the footing course, spears stacked in a stook
        [[-2.4, 'half', 'ink', 'bone'], [-1.75, 'ring', 'bone', 'ink'], [-1.1, 'quarter', 'ink', 'bone']].forEach(function (q, i) { vShield(b, cx + q[0], 0.36, cz + 2.86 + 0.12, 0.05 * i, 0.34, q[1], q[2], q[3], -0.22); });
        [[1.35, 'cross', 'bone', 'ink'], [2.05, 'half', 'inkGrey', 'bone']].forEach(function (q) { vShield(b, cx + q[0], 0.36, cz + 2.98, -0.1, 0.34, q[1], q[2], q[3], -0.22); });
      });
      b.unit(function () {
        var kx = cx - 3.7, kz = cz + 1.7;
        for (var i = 0; i < 6; i++) { var a = i / 6 * Math.PI * 2; b.beam([kx + Math.cos(a) * 0.5, 0, kz + Math.sin(a) * 0.5], [kx - Math.cos(a) * 0.08, 2.1, kz - Math.sin(a) * 0.08], 0.025, { c: 'woodLight', round: true, seg: 6 }); var tip = [kx - Math.cos(a) * 0.1, 2.1, kz - Math.sin(a) * 0.1]; b.extrude(tip[0], tip[1], tip[2], [[-0.04, 0], [0.04, 0], [0.05, 0.1], [0, 0.26], [-0.05, 0.1]], 0.02, { c: 'steel', m: M.metal, ry: -a, rz: 0 }); }
        b.cyl(kx, 1.45, kz, 0.16, 0.06, { c: 'rope', m: M.rope, seg: 8 });
      });
      b.unit(function () {
        // garments rent and cast down at Moroni's feet
        var G = [[3.05, -0.1, 0.4, 'bone'], [3.15, 0.55, -0.5, '#3a3936'], [3.0, -0.75, 1.2, '#d9d3c7'], [3.5, -1.2, 2.0, 'bone'], [3.2, 1.15, 0.3, '#5c5e62'], [0.2, 3.7, -1.1, 'bone'], [-0.4, 3.85, 0.7, '#d9d3c7']];
        G.forEach(function (gm) {
          var pts = []; for (var i = 0; i < 9; i++) { var a = i / 9 * Math.PI * 2, rr = (0.26 + b.r() * 0.16) * (i % 2 ? 1 : 0.8); pts.push([Math.cos(a) * rr * 1.3, Math.sin(a) * rr]); }
          b.extrude(cx + gm[0], 0.02, cz + gm[1], pts, 0.025, { c: gm[3], m: M.cloth, rx: -Math.PI / 2, ry: gm[2], ao: 0.1 });
        });
        b.bench(cx + 4.6, cz - 1.6, 1.6, { ry: 1.2 });
        // tufts and white flowers in the turf round the square
        [[-4.9, 3.6], [-4.2, 4.8], [-3.0, 5.6], [-1.6, 5.9], [1.6, 5.8], [2.9, 5.3], [4.4, 3.9], [5.2, 2.0], [5.6, -0.6], [-5.3, 1.2], [-5.1, -1.0], [-2.0, -5.2], [0.8, -5.0], [3.2, -4.0], [-3.6, 2.9], [3.9, 3.0], [-0.6, 4.6], [4.9, -2.6]].forEach(function (t) {
          var x = t[0] + b.j(0.2), z = t[1] + b.j(0.2); b.grass(x, gh(x, z), z, 0.3 + b.r() * 0.3);
        });
        [[-4.4, 4.2], [2.4, 5.6], [5.0, 1.0], [-5.4, 0.2]].forEach(function (t) { b.flowers(t[0], gh(t[0], t[1]), t[1], 0.35, { n: 6, c: '#f3f1ec' }); });
        b.cart(cx - 3.9, cz - 1.6, { ry: 0.25, load: function (bb) {
          for (var i = 0; i < 4; i++) bb.spear(-0.45 + i * 0.3, 0.75, -0.7, 2.4, { rx: Math.PI / 2 - 0.12 });
          vShield(bb, -0.3, 1.05, 0.55, 0, 0.32, 'half', 'ink', 'bone', -1.2); vShield(bb, 0.3, 1.1, 0.25, 0.2, 0.32, 'ring', 'bone', 'ink', -1.0);
          bb.sack(0.25, 0.77, -0.75, 0.42); bb.crate(-0.3, 0.77, -0.6, 0.45, { ry: 0.3 });
        } }); b.barrel(cx + 3.4, 0, cz - 2.4, {}); b.barrel(cx + 3.9, 0, cz - 1.9, { h: 0.8 }); b.crate(cx + 3.2, 0, cz - 1.7, 0.6, { ry: 0.4 });
      });

      b.life(function () {
        b.figure(cx - 0.65, cz + 0.55, { role: 'knight', pose: 'liberty_oath', y: deck + 0.04, ry: 0.45, cape: 'ink' });
        b.figure(cx - 1.35, cz + 3.35, { role: 'soldier', pose: 'spear', ry: -0.3, team: 'ink' });
        b.figure(cx + 1.35, cz + 3.45, { role: 'soldier', pose: 'spear', ry: 0.25, team: 'ink' });
        b.figure(cx + 3.5, cz + 1.7, { role: 'villager', pose: 'cheer', ry: Math.atan2(-3.5, -1.7), c: '#5c5e62' });
        b.figure(cx + 3.55, cz + 0.05, { role: 'villager', pose: 'liberty_kneel', ry: -Math.PI / 2, c: '#6f6a62' });
        b.figure(cx + 4.35, cz + 0.9, { role: 'villager', pose: 'talk', ry: -1.75, c: '#3b3a38', beard: true });
        b.figure(cx + 2.4, cz + 4.6, { role: 'soldier', pose: 'guard', ry: -0.75, team: 'bone' });
        b.figure(cx + 3.6, cz + 5.3, { role: 'child', pose: 'run', ry: -Math.PI / 2 - 0.3 });
        b.figure(cx - 2.9, cz + 0.1, { role: 'villager', pose: 'carry', ry: 2.2, c: '#8a857c' });
        b.figure(cx - 1.1, cz + 5.2, { role: 'villager', pose: 'walk', ry: Math.PI - 0.35, c: '#6f6a62' });
        // more of the people coming in across the square, one bringing a rent coat to cast down
        b.figure(cx - 2.7, cz + 4.4, { role: 'villager', pose: 'carry', ry: Math.PI - 0.6, c: '#3b3a38', beard: true });
        b.figure(cx - 3.4, cz + 3.2, { role: 'villager', pose: 'cheer', ry: 2.4, c: '#d9d3c7' });
        b.figure(cx - 2.2, cz + 3.0, { role: 'child', pose: 'point', ry: Math.PI - 0.2 });
      });
    }
  });
})();
