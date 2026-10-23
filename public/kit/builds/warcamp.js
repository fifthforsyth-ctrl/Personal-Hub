// War camp: a ring of log palisade with a gate between two log towers, a bank of dug earth set with sharpened stakes on the open side, a
// corner watchtower, rows of Norse ridge tents whose crossed gable boards end in carved dragon heads, a command
// pavilion in ink and bone with a porch over the map table, cook fires with a cauldron and a fish spit, a smith's
// hearth, weapon racks, war banners, and the camp at work. Built footings first, the palisade log by log, the gate
// towers course by course, the gate, the stake line, the watchtower, the pavilion deck, walls and roof gore by gore,
// the tents row by row, the duckboards, then the fires, banners, racks, smithy and stores, and last the people.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL, U = KIT.util, DEG = Math.PI / 180;
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  var INK = '#1f1e1c', BONE = '#efebe4', GREY = '#5e5b55', MUD = new T.Color('#7c6f5c');
  PAL.warcamp_log = ['#6d5f50', '#625547', '#77685a', '#584c40', '#6a5a4a'];
  PAL.warcamp_plank = ['#6a5846', '#5f4f3f', '#574839', '#6f5d49', '#655443'];
  PAL.warcamp_deck = ['#8a7660', '#7f6c57', '#937f68', '#776551', '#85715b'];
  var RP = 12.8; // the palisade's radius

  // ---------------------------------------------------------------- poses
  var PO = KIT.people.poses;
  PO.warcamp_sit = function (r) { return { feet: [V(-0.17, 0.09, 0.38), V(0.15, 0.09, 0.45)], hands: [V(-0.15, 0.68, 0.38), V(0.14, 0.7, 0.41)], lean: 0.14, twist: r(0.08), side: 0, hip: 0, drop: 0.45, head: [r(0.35), 0.08], pole: [V(-1, -0.6, -0.2), V(1, -0.6, -0.2)] }; };
  PO.warcamp_stir = function (r) { return { feet: [V(-0.17, 0.09, 0.06), V(0.15, 0.09, -0.1)], hands: [V(-0.12, 1.12, 0.44), V(0.04, 1.2, 0.36)], lean: 0.18, twist: 0.05, side: 0, hip: 0, drop: 0.03, head: [0, 0.38], pole: [V(-0.8, -0.4, -0.3), V(0.8, -0.4, -0.3)] }; };
  PO.warcamp_lean = function (r) { return { feet: [V(-0.15, 0.09, -0.1), V(0.15, 0.09, -0.18)], hands: [V(-0.27, 0.86, 0.46), V(0.25, 0.86, 0.43)], lean: 0.42, twist: r(0.08), side: 0, hip: 0, drop: 0.03, head: [r(0.2), 0.4], pole: [V(-0.8, -0.1, -0.4), V(0.8, -0.1, -0.4)] }; };
  PO.warcamp_mark = function (r) { return { feet: [V(-0.14, 0.09, 0.1), V(0.14, 0.09, -0.08)], hands: [V(-0.22, 1.0, 0.62), V(0.27, 0.9, 0.1)], lean: 0.22, twist: 0.1, side: 0.02, hip: 0.02, drop: 0.02, head: [0.1, 0.4], pole: [V(-0.6, -0.5, -0.4), V(0.7, -0.4, -0.3)] }; };
  PO.warcamp_grind = function (r) { return { feet: [V(-0.18, 0.09, -0.02), V(0.16, 0.09, -0.12)], hands: [V(-0.1, 0.98, 0.5), V(0.1, 1.0, 0.52)], lean: 0.3, twist: 0, side: 0, hip: 0, drop: 0.06, head: [0, 0.4], pole: [V(-0.9, -0.5, -0.2), V(0.9, -0.5, -0.2)] }; };
  PO.warcamp_chop = function (r) { return { feet: [V(-0.21, 0.09, 0.06), V(0.2, 0.09, -0.06)], hands: [V(-0.04, 1.86, -0.02), V(0.05, 1.78, 0.02)], lean: -0.06, twist: 0, side: 0, hip: 0, drop: 0.02, head: [0, 0.3], pole: [V(-1, -0.2, 0.3), V(1, -0.2, 0.3)] }; };

  // ---------------------------------------------------------------- pieces
  // a carved dragon head in the XY plane, snout toward local +x, neck foot at (x, y, z), turned by ry, s tall
  var HEAD = [[-0.1, 0], [0.1, 0], [0.12, 0.2], [0.17, 0.42], [0.26, 0.58], [0.42, 0.63], [0.62, 0.64], [0.8, 0.66], [0.78, 0.71], [0.6, 0.72], [0.46, 0.76], [0.62, 0.8], [0.84, 0.83], [0.87, 0.89], [0.8, 0.92], [0.62, 0.94], [0.5, 0.98], [0.42, 1.04], [0.2, 1.3], [0.29, 1.04], [0.15, 1.13], [0.16, 0.98], [0.06, 0.93], [-0.01, 0.95], [-0.02, 0.85], [-0.09, 0.82], [-0.06, 0.71], [-0.13, 0.64], [-0.1, 0.53], [-0.16, 0.44], [-0.12, 0.33], [-0.13, 0.15]];
  function wcHead(b, x, y, z, ry, s, o) {
    o = o || {}; var c = o.c || 'woodDark';
    b.push(x, y, z, ry);
    b.extrude(0, 0, 0, HEAD.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.13 * s, { c: c, m: M.wood, bevel: 0.012 * s });
    b.box(0.02 * s, 0.3 * s, 0, 0.3 * s, 0.06 * s, 0.17 * s, { c: c, m: M.wood, bevel: 0.01 * s, rz: 0.15 });
    if (s > 0.5) {
      [-1, 1].forEach(function (sd) { b.ball(0.53 * s, 0.89 * s, sd * 0.075 * s, 0.03 * s, { c: '#e9e4da', m: M.paint, detail: 0, ao: 0 }); });
      [0.56, 0.66, 0.76].forEach(function (tx) { b.extrude(tx * s, 0.72 * s, 0, [[-0.025 * s, 0], [0.025 * s, 0], [0, 0.06 * s]], 0.05 * s, { c: '#e9e4da', m: M.paint, ao: 0 }); });
    }
    b.pop();
  }
  // a round Norse shield facing local +z: a painted field, a pattern in the other colour, an iron rim and boss
  function wcShield(b, x, y, z, ry, r, kind, fc, pc, tilt) {
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
  var SH = [['half', INK, BONE], ['quarter', BONE, INK], ['ring', INK, BONE], ['cross', BONE, INK], ['half', GREY, BONE], ['quarter', INK, BONE]];
  function anyShield(b, i, x, y, z, ry, r, tilt) { var s = SH[i % SH.length]; wcShield(b, x, y, z, ry, r, s[0], s[1], s[2], tilt); }
  // a square stave post with carved collars and a cap
  function stave(b, x, y, z, h, w, o) {
    o = o || {}; var c = o.c || 'woodDark';
    b.post(x, y, z, w / 2, h, { c: c, ry: o.ry || 0 });
    [0.14, h - 0.42, h - 0.24].forEach(function (yy) { b.box(x, y + yy, z, w * 1.3, 0.07, w * 1.3, { c: c, m: M.wood, bevel: 0.015, ry: o.ry || 0 }); });
    if (o.cap !== false) b.box(x, y + h, z, w * 1.4, 0.12, w * 1.4, { c: c, m: M.wood, taper: 0.55, ry: o.ry || 0 });
  }
  // a rope swagged between two points
  function swag(b, a, c, sag, r) {
    var n = 5, prev = a;
    for (var i = 1; i <= n; i++) { var t = i / n, p = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (c[2] - a[2]) * t]; b.beam(prev, p, r || 0.02, { c: 'rope', m: M.rope, round: true, seg: 5 }); prev = p; }
  }
  // a sheet of cloth through F(u, v) -> [x, y, z], turned so its normals face out
  function sheet(b, F, nu, nv, o) {
    var g = new T.PlaneGeometry(1, 1, nu, nv), p = g.attributes.position;
    for (var i = 0; i < p.count; i++) { var q = F(p.getX(i) + 0.5, p.getY(i) + 0.5); p.setXYZ(i, q[0], q[1], q[2]); }
    g.computeVertexNormals();
    if (o.out) {
      var n = g.attributes.normal, k = Math.floor(n.count / 2), d = n.getX(k) * o.out[0] + n.getY(k) * o.out[1] + n.getZ(k) * o.out[2];
      if (d < 0) {
        for (var j = 0; j < n.count; j++) n.setXYZ(j, -n.getX(j), -n.getY(j), -n.getZ(j));
        var ix = g.index; for (var t = 0; t < ix.count; t += 3) { var i1 = ix.getX(t + 1); ix.setX(t + 1, ix.getX(t + 2)); ix.setX(t + 2, i1); }
      }
    }
    b.addGeo(g, { c: o.c, m: M.cloth, bucket: 'cloth', ao: o.ao === undefined ? 0.2 : o.ao, jit: o.jit === undefined ? 0.015 : o.jit, vary: 0.05, colors: o.colors, sway: o.sway || 0, swayFn: o.swayFn });
  }
  // cloth that darkens toward the mud at its hem
  function hemmed(c, k) { var base = new T.Color(c); return function (wx, wy, wz, lx, ly) { return base.clone().lerp(MUD, (1 - U.smooth(0.0, 0.55, ly)) * (k || 0.5)); }; }

  // the palisade: logs on a ring of radius R from angle a0 to a1, a few to a step, each step lashed to two wales inside
  function palisade(b, R, a0, a1, per) {
    var r = 0.17, L = Math.abs(a1 - a0) * R, n = Math.round(L / (r * 2.04)), da = (a1 - a0) / n;
    for (var i = 0; i < n; i += per) {
      b.unit(function () {
        var k1 = Math.min(n, i + per);
        for (var k = i; k < k1; k++) {
          var a = a0 + (k + 0.5) * da, rr = r * (0.88 + b.r() * 0.24), hh = 2.9 * (0.93 + b.r() * 0.14), x = Math.cos(a) * R, z = Math.sin(a) * R;
          b.log(x, -0.1, z, rr, hh + 0.1, { c: 'warcamp_log', seg: 7 });
          b.cone(x, hh, z, rr, rr * 3.0, { c: b.pick(['#9d8a72', '#a8957c', '#8f7c66']), m: M.wood, seg: 7, flat: true });
        }
        var aA = a0 + i * da + da * 0.15, aB = a0 + k1 * da - da * 0.15, Ri = R - r - 0.06;
        [0.75, 2.15].forEach(function (y) { b.beam([Math.cos(aA) * Ri, y, Math.sin(aA) * Ri], [Math.cos(aB) * Ri, y + b.j(0.03), Math.sin(aB) * Ri], 0.075, { c: 'warcamp_log', round: true, seg: 6 }); });
      });
    }
  }
  // a stake line: a low bank of dug earth on the ring of radius R, and sharpened stakes driven into it leaning out at
  // the enemy, two staggered rows, fresh-cut pale points, a few to a step
  var BPROF = [[-1.05, 0], [-0.8, 0.13], [-0.5, 0.33], [-0.2, 0.45], [0.1, 0.47], [0.4, 0.4], [0.7, 0.22], [0.95, 0.07], [1.15, 0]];
  function bankH(n) { for (var i = 0; i < BPROF.length - 1; i++) { var p = BPROF[i], q = BPROF[i + 1]; if (n >= p[0] && n <= q[0]) return p[1] + (q[1] - p[1]) * (n - p[0]) / (q[0] - p[0]); } return 0; }
  function bankC(R) {
    return function (x, y, z) {
      var n = Math.hypot(x, z) - R, q = U.noise3(x * 0.8, y * 1.1, z * 0.8), q2 = U.noise3(x * 2.4 + 7, y * 2.4, z * 2.4);
      var c = new T.Color('#7f6b51').lerp(new T.Color('#97815f'), U.clamp(q * 1.4 + 0.5, 0, 1));
      c.lerp(new T.Color('#625140'), U.clamp(-q2 * 1.6, 0, 1) * 0.5);
      // turf creeping back over the toes and in patches on the crest
      c.lerp(new T.Color('#5f6c47').lerp(new T.Color('#717b52'), U.clamp(q2 + 0.5, 0, 1)), U.smooth(0.12, 0.0, y + q2 * 0.12) * 0.8 + U.smooth(0.25, 0.6, q) * 0.45);
      return c;
    };
  }
  function bankSweep(b, R, a0, a1) {
    var S = Math.max(3, Math.ceil(Math.abs(a1 - a0) * R / 0.28)), Pn = BPROF.length, pos = [], idx = [], i, j;
    for (j = 0; j <= S; j++) for (i = 0; i < Pn; i++) {
      var th = a0 + (a1 - a0) * j / S, n = BPROF[i][0], y = BPROF[i][1], r;
      var x0 = Math.cos(th) * (R + n), z0 = Math.sin(th) * (R + n);
      if (y > 0.01) { y += U.noise3(x0 * 0.9 + 3.1, 0.4, z0 * 0.9) * 0.09; n += U.noise3(x0 * 0.7, 5.3, z0 * 0.7) * 0.08; } else y = -0.06;
      r = R + n; pos.push(Math.cos(th) * r, y, Math.sin(th) * r);
    }
    for (j = 0; j < S; j++) for (i = 0; i < Pn - 1; i++) { var v00 = j * Pn + i, v10 = v00 + 1, v01 = v00 + Pn, v11 = v01 + 1; if (a1 > a0) idx.push(v00, v11, v10, v00, v01, v11); else idx.push(v00, v10, v11, v00, v11, v01); }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    g = KIT.geo.flat(g);
    b.addGeo(g, { c: '#ffffff', m: M.dirt, ao: 0.25, jit: 0, vary: 0.05, colors: bankC(R) });
  }
  function wcStake(b, a, c, r, f) {
    var m = [a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f, a[2] + (c[2] - a[2]) * f];
    b.beam(a, m, r, { round: true, seg: 7, c: 'warcamp_log', m: M.wood });
    b.beam(m, c, r, { round: true, seg: 7, r2: 0.008, c: b.pick(['#c9b48f', '#bfa983', '#d2bf9b']), m: M.wood });
  }
  function stakeLine(b, R, a0, a1, per) {
    var L = Math.abs(a1 - a0) * R, n = Math.round(L / 0.62), da = (a1 - a0) / n;
    for (var i = 0; i < n; i += per) {
      b.unit(function () {
        var k1 = Math.min(n, i + per);
        bankSweep(b, R, a0 + i * da - (i ? 0.004 : 0), a0 + k1 * da);
        for (var k = i; k < k1; k++) {
          [[0, -0.2, 0.42, 1.6, 0.085], [0.5, 0.3, 1.3, 0.95, 0.065]].forEach(function (row) {
            var a = a0 + (k + 0.5 + row[0] * (k % 2 ? 0.9 : 1.1)) * da + b.j(da * 0.12); if (row[0] && k === n - 1) return;
            var cx = Math.cos(a), cz = Math.sin(a), tx = -cz, tz = cx, lean = b.j(0.16), top = row[3] + b.j(0.14);
            var r0 = R + row[1], r1 = R + row[2] + b.j(0.08), y0 = bankH(row[1]) - 0.25;
            wcStake(b, [cx * r0, y0, cz * r0], [cx * r1 + tx * lean, top, cz * r1 + tz * lean], row[4] * (0.9 + b.r() * 0.2), 0.74);
          });
        }
      });
    }
  }
  // a Norse ridge tent along local z, door to +z: crossed gable boards carved into dragon heads at both ends, a ridge
  // pole in their crotch, cloth to the ground, the door flaps tied back, and guy ropes to pegs
  function tent(b, x, z, ry, o) {
    o = o || {}; var L = o.L || 2.8, W = o.W || 2.4, H = o.H || 2.0, c = o.c || BONE, hw = W / 2, xe = 0.36, ye = H * (1 + xe / hw);
    b.push(x, 0, z, ry || 0);
    b.unit(function () {
      [-1, 1].forEach(function (e) {
        var ze = e * (L / 2 + 0.05);
        [-1, 1].forEach(function (s) {
          b.beam([s * (hw + 0.04), -0.04, ze], [-s * xe, ye, ze], 0.065, { c: 'woodDark', r2: 0.032 });
          wcHead(b, -s * xe, ye - 0.05, ze, s > 0 ? Math.PI : 0, 0.42, { c: 'woodDark' });
        });
      });
      b.beam([0, H + 0.05, -L / 2 - 0.3], [0, H + 0.05, L / 2 + 0.3], 0.05, { c: 'woodDark', round: true, seg: 7 });
    });
    [-1, 1].forEach(function (s) {
      b.unit(function () {
        sheet(b, function (u, v) { var sag = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.07; return [s * (hw * v - sag * 0.6), (H + 0.1) * (1 - v) + 0.02 - sag, (u - 0.5) * L]; }, 8, 5, { c: c, out: [s, 1, 0], colors: hemmed(c, c === GREY ? 0.25 : 0.5), ao: 0.25 });
      });
    });
    b.unit(function () {
      // the back closed; the front a dark doorway with both flaps tied back
      b.extrude(0, 0, -L / 2 + 0.01, [[-hw + 0.04, 0.02], [hw - 0.04, 0.02], [0, H + 0.06]], 0.03, { c: c, m: M.cloth, bucket: 'cloth', ao: 0.3 });
      b.extrude(0, 0, L / 2 - 0.35, [[-hw + 0.3, 0.02], [hw - 0.3, 0.02], [0, H - 0.25]], 0.04, { c: '#2a2521', m: M.dark, ao: 0, jit: 0 });
      if (o.closed) {
        b.extrude(0, 0, L / 2 - 0.01, [[-hw + 0.04, 0.02], [hw - 0.04, 0.02], [0, H + 0.06]], 0.03, { c: c, m: M.cloth, bucket: 'cloth', ao: 0.3 });
        b.box(0, 0.02, L / 2 + 0.02, 0.03, H - 0.05, 0.02, { c: c === GREY ? '#24231f' : '#cfc9bd', m: M.cloth, bevel: 0 });
      } else {
        [-1, 1].forEach(function (s) {
          b.extrude(0, 0, L / 2 + 0.015, [[s * (hw - 0.02), 0.02], [s * (hw - 0.62), 0.05], [s * 0.05, H - 0.02]].map(function (p) { return s > 0 ? p : p; }), 0.03, { c: c, m: M.cloth, bucket: 'cloth', ao: 0.2 });
          b.beam([s * (hw - 0.62), 0.12, L / 2 + 0.05], [s * 0.1, H - 0.2, L / 2 + 0.05], 0.06, { c: c, m: M.cloth, round: true, seg: 6, bucket: 'cloth' });
          b.beam([s * (hw - 0.5), 0.95, L / 2 + 0.07], [s * (hw - 0.2), 0.75, L / 2 + 0.07], 0.012, { c: 'rope', m: M.rope, round: true, seg: 4 });
        });
      }
    });
    b.unit(function () {
      [-1, 1].forEach(function (e) {
        var pz = e * (L / 2 + 0.72);
        b.beam([0, H + 0.05, e * (L / 2 + 0.26)], [0, 0.08, pz], 0.012, { c: 'rope', m: M.rope, round: true, seg: 4 });
        b.post(0, 0, pz, 0.035, 0.24, { c: 'woodLight' });
        [-1, 1].forEach(function (s) {
          var zz = e * L * 0.3, px = s * (hw + 0.6);
          b.beam([s * hw * 0.5, (H + 0.1) * 0.5 + 0.02, zz], [px, 0.08, zz], 0.011, { c: 'rope', m: M.rope, round: true, seg: 4 });
          b.post(px, 0, zz, 0.03, 0.22, { c: 'woodLight' });
        });
      });
    });
    b.pop();
  }
  // a round pavilion in the local frame: a centre pole, walls panel by panel (two to a step), the roof gore by gore,
  // a scalloped valance, and the front left open over o.open radians. o.wall / o.roof: fn(k) -> colour
  function pavilion(b, r, wh, rh, o) {
    o = o || {}; var seg = o.seg || 16, open = o.open || 0, lerp = function (a, c, t) { return a + (c - a) * t; };
    b.unit(function () { b.log(0, 0, 0, 0.1, wh + rh + (o.pole || 0.6), { c: 'woodDark', seg: 8 }); });
    var per = o.per || 1;
    for (var k0 = 0; k0 < seg; k0 += per) {
      b.unit(function () {
        for (var k = k0; k < k0 + per; k++) {
          var a0 = k / seg * Math.PI * 2, a1 = (k + 1) / seg * Math.PI * 2, am = (a0 + a1) / 2;
          b.post(Math.cos(a0) * r, 0, Math.sin(a0) * r, 0.05, wh, { c: 'woodDark' });
          if (Math.abs(((am - Math.PI / 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI) < open / 2) continue;
          var col = o.wall(k);
          sheet(b, function (u, v) { var a = lerp(a0, a1, u), bulge = Math.sin(u * Math.PI) * 0.06 * (1 - v); return [Math.cos(a) * (r + bulge), v * wh, Math.sin(a) * (r + bulge)]; }, 3, 4, { c: col, out: [Math.cos(am), 0, Math.sin(am)], colors: hemmed(col, 0.35), ao: 0.35 });
        }
      });
    }
    if (o.roofPart) b.part(o.roofPart);
    for (var q0 = 0; q0 < seg; q0 += per) {
      b.unit(function () {
        for (var q = q0; q < q0 + per; q++) {
          var a0 = q / seg * Math.PI * 2, a1 = (q + 1) / seg * Math.PI * 2, rr = r * 1.08;
          sheet(b, function (u, v) { var a = lerp(a0, a1, u), rad = rr * (1 - v), sag = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.14; return [Math.cos(a) * rad, wh + rh * Math.pow(v, 0.85) - sag, Math.sin(a) * rad]; }, 2, 6, { c: o.roof(q), out: [0, 1, 0], ao: 0.1 });
        }
      });
    }
    if (o.valance !== false) b.unit(function () {
      var rr = r * 1.085, n = seg * 2, vh = o.valance || 0.42;
      for (var k = 0; k < n; k++) {
        var a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2;
        sheet(b, function (u, v) { var a = lerp(a0, a1, u), cut = Math.sin(u * Math.PI) * 0.5 + 0.5; return [Math.cos(a) * rr, wh - vh * (1 - v) * cut + 0.02, Math.sin(a) * rr]; }, 4, 2, { c: k % 2 ? INK : BONE, out: [Math.cos(a0), 0, Math.sin(a0)], ao: 0.05, sway: 0.25, swayFn: function () { return 1; } });
      }
    });
  }
  // duckboards along a lane: two runners, and planks across them a few to a step
  function duckboards(b, pts, w, per) {
    var planks = [];
    for (var s = 0; s < pts.length - 1; s++) {
      var a = pts[s], c = pts[s + 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]), n = Math.round(L / 0.3), ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L;
      for (var i = 0; i < n; i++) { var t = (i + 0.5) / n; planks.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, Math.atan2(ux, uz), ux, uz]); }
    }
    for (var i0 = 0; i0 < planks.length; i0 += per) {
      b.unit(function () {
        var p0 = planks[i0], p1 = planks[Math.min(planks.length - 1, i0 + per)];
        [-1, 1].forEach(function (sd) { var ox = p0[4] * sd * w * 0.36, oz = -p0[3] * sd * w * 0.36; b.beam([p0[0] - p0[3] * 0.2 + ox, 0.0, p0[1] - p0[4] * 0.2 + oz], [p1[0] + p1[3] * 0.1 + ox, 0.0, p1[1] + p1[4] * 0.1 + oz], 0.05, { c: 'warcamp_log', round: true, seg: 5 }); });
        for (var k = i0; k < Math.min(planks.length, i0 + per); k++) { var p = planks[k]; b.box(p[0] + b.j(0.03), 0.03, p[1], w * (0.94 + b.j(0.05)), 0.055, 0.25, { ry: p[2] + b.j(0.05), c: 'warcamp_deck', m: M.wood, bevel: 0.012 }); }
      });
    }
  }
  // a cook fire: a ring of stones, the wood and flames, and a log seat or two
  function fireRing(b, x, z) {
    for (var i = 0; i < 11; i++) { var a = i / 11 * Math.PI * 2 + b.j(0.1); b.rock(x + Math.cos(a) * 0.68, 0.02, z + Math.sin(a) * 0.68, 0.17 + b.r() * 0.06, { c: b.pick(PAL.stoneDark) }); }
    b.cyl(x, 0, z, 0.58, 0.04, { c: '#5a5550', m: M.soil, seg: 14, flat: true, ao: 0 });
  }
  function fireWood(b, x, z, s) {
    for (var i = 0; i < 5; i++) { var a = i / 5 * Math.PI * 2 + 0.4; b.beam([x + Math.cos(a) * 0.5, 0.06, z + Math.sin(a) * 0.5], [x + Math.cos(a) * 0.06, 0.24, z + Math.sin(a) * 0.06], 0.06, { c: i % 2 ? '#3a2f26' : 'wood', m: M.wood, round: true, seg: 6 }); }
    b.embers(x, 0.1, z, 0.42, { light: false });
    b.flame(x, 0.1, z, s || 1.0, { i: 1.3 });
  }
  function seatLog(b, x, z, ry, L) { b.push(x, 0, z, ry); b.beam([-L / 2, 0.2, 0], [L / 2, 0.21, 0], 0.2, { c: 'warcamp_log', round: true, seg: 8 }); b.cyl(-L / 2 + 0.012, 0.2, 0, 0.19, 0.02, { c: '#a89377', m: M.wood, rz: Math.PI / 2, seg: 8 }); b.pop(); }
  // smoke from a fire: small puffs, each a cluster, widening and drifting downwind as they rise
  function wisp(b, x, y, z, k) {
    b.life(function () {
      // a soft grey column: puffs packed far closer than their size so no gaps show between them, swelling a little
      // and leaning off downwind as it rises, and paling toward the top
      var n = 20, c0 = new T.Color('#625e58'), c1 = new T.Color('#97928a');
      for (var i = 0; i < n; i++) {
        var t = i / (n - 1), r = (0.08 + 0.17 * Math.sqrt(t)) * (1 + 0.2 * Math.sin(i * 2.7)) * k, px = x - Math.pow(t, 1.7) * 0.95 * k + Math.sin(i * 1.9) * 0.07 * k * (0.3 + t), py = y + t * 2.3 * k, pz = z + Math.cos(i * 1.4) * 0.07 * k * (0.3 + t);
        b.ball(px, py, pz, r, { c: c0.clone().lerp(c1, t), m: M.cloth, ao: 0.04, detail: 2, smooth: true, vary: 0.015, sy: 0.9, jit: 0 });
      }
    });
  }
  // a banner pole: a stave pole with a crossbar, and a banner hung from it facing +z (turn with ry)
  function bannerPole(b, x, z, ry, h, bw, bh, o) {
    b.push(x, 0, z, ry);
    b.post(0, 0, -0.08, 0.07, h, { c: 'woodDark' });
    [0.25, h * 0.5].forEach(function (yy) { b.box(0, yy, -0.08, 0.2, 0.06, 0.2, { c: 'woodDark', m: M.wood, bevel: 0.015 }); });
    b.box(0, -0.1, -0.08, 0.5, 0.2, 0.5, { c: 'stoneDark', bevel: 0.06 });
    b.banner(0, h - 0.2, 0.0, bw, bh, Object.assign({ c: 'ink', emblem: 'swords', ec: '#f1eee8', es: 0.8, tail: 'swallow', trim: 'iron' }, o || {}));
    if (o && o.head) wcHead(b, 0, h, -0.08, Math.PI / 2, 0.55, { c: 'woodDark' });
    b.pop();
  }
  // a Norse log tower's parts, in the frame of whoever calls them: centre (tx, tz), half-width hw
  function crib(b, tx, tz, hw, i0, i1) {
    for (var i = i0; i < i1; i++) {
      var y = 0.26 + i * 0.25;
      [-1, 1].forEach(function (sd) {
        var e1 = hw + 0.26 + b.j(0.06), e2 = hw + 0.26 + b.j(0.06);
        b.beam([tx - e1, y, tz + sd * hw], [tx + e2, y + b.j(0.015), tz + sd * hw], 0.14 * (0.92 + b.r() * 0.16), { c: 'warcamp_log', round: true, seg: 7 });
        b.beam([tx + sd * hw, y + 0.125, tz - e1], [tx + sd * hw, y + 0.125 + b.j(0.015), tz + e2], 0.14 * (0.92 + b.r() * 0.16), { c: 'warcamp_log', round: true, seg: 7 });
      });
    }
  }
  function towerDeck(b, tx, tz, y, half) {
    for (var k = 0; k < 5; k++) { var z = tz - half + 0.25 + k * (half * 2 - 0.5) / 4; b.beam([tx - half - 0.05, y - 0.1, z], [tx + half + 0.05, y - 0.1, z], 0.1, { c: 'warcamp_log', round: true, seg: 6 }); }
    var n = Math.round(half * 2 / 0.28);
    for (var p = 0; p < n; p++) { var xx = tx - half + (p + 0.5) * (half * 2 / n); b.box(xx, y, tz + b.j(0.03), half * 2 / n - 0.02, 0.07, half * 2 + 0.04, { c: 'warcamp_plank', m: M.wood, bevel: 0.012, ry: b.j(0.01) }); }
  }
  // the parapet round a deck: planks standing on its edge, a rail, skipping sides in o.skip ('x-', 'x+', 'z-', 'z+')
  function parapet(b, tx, tz, y, half, skip, gap) {
    [['z+', 0, 1], ['z-', 0, -1], ['x+', 1, 0], ['x-', -1, 0]].forEach(function (sd) {
      if (skip.indexOf(sd[0]) >= 0) return;
      var nx = sd[1], nz = sd[2], n = Math.round(half * 2 / 0.23);
      for (var i = 0; i < n; i++) {
        var t = -half + (i + 0.5) * (half * 2 / n); if (gap && sd[0] === gap[0] && Math.abs(t - gap[1]) < gap[2]) continue;
        var px = tx + (nx ? nx * half : t), pz = tz + (nz ? nz * half : t);
        b.box(px, y, pz, nx ? 0.06 : 0.21, 0.95 + b.j(0.03), nx ? 0.21 : 0.06, { c: 'warcamp_plank', m: M.wood, bevel: 0.01 });
      }
      var a = nx ? [tx + nx * half, y + 0.98, tz - half] : [tx - half, y + 0.98, tz + nz * half], c = nx ? [tx + nx * half, y + 0.98, tz + half] : [tx + half, y + 0.98, tz + nz * half];
      b.beam(a, c, 0.06, { c: 'woodDark' });
    });
  }
  function towerRoof(b, tx, tz, eave, rise, half, ry) {
    b.gableRoof(tx, eave, tz, half * 2 + 0.1, half * 2 + 0.1, rise, { m: 'slate', rows: 4, over: 0.32, ry: ry, overX: 0.2 });
  }
  function towerGables(b, tx, tz, eave, rise, half, headS, alongX) {
    // plank gables at both ends of the ridge, a dragon head on each ridge end looking out along it
    [-1, 1].forEach(function (e) {
      for (var i = 0; i < 7; i++) {
        var pt = -half + (i + 0.5) * (half * 2 / 7), top = rise * (1 - Math.abs(pt) / (half + 0.3)) - 0.05;
        if (alongX) b.box(tx + e * (half + 0.02), eave - 0.05, tz + pt, 0.05, Math.max(0.1, top), half * 2 / 7 - 0.02, { c: 'woodDark', m: M.wood, bevel: 0.008 });
        else b.box(tx + pt, eave - 0.05, tz + e * (half + 0.02), half * 2 / 7 - 0.02, Math.max(0.1, top), 0.05, { c: 'woodDark', m: M.wood, bevel: 0.008 });
      }
      if (alongX) wcHead(b, tx + e * (half + 0.28), eave + rise + 0.08, tz, e > 0 ? 0 : Math.PI, headS, { c: 'woodDark' });
      else wcHead(b, tx, eave + rise + 0.08, tz + e * (half + 0.28), e > 0 ? -Math.PI / 2 : Math.PI / 2, headS, { c: 'woodDark' });
    });
  }

  var aG = 68 * DEG, nG = 86 * DEG, GX = Math.cos(aG) * RP, GZ = Math.sin(aG) * RP, RYG = Math.PI / 2 - nG, TX = 2.3, THW = 0.85, NCRIB = 11, TDECK = 0.26 + (NCRIB - 1) * 0.25 + 0.125 + 0.14 + 0.2, TEAVE = TDECK + 1.75, TRISE = 1.15, TH = 1.3;
  function gw(lx, ly, lz) { var c = Math.cos(RYG), s = Math.sin(RYG); return { x: GX + lx * c + lz * s, y: ly, z: GZ - lx * s + lz * c }; }
  var aW = -165 * DEG, WX = Math.cos(aW) * 13.15, WZ = Math.sin(aW) * 13.15, RYW = Math.atan2(-Math.cos(aW), -Math.sin(aW)), WDECK = 5.0, WEAVE = 6.95, WRISE = 1.25;
  var PX = 3.2, PZ = -4.2, DECKY = 0.32, PR = 3.0, PWH = 2.45, PRH = 3.1;
  var F1 = [-6.2, 7.7], F2 = [0.6, -9.9];
  var p1 = gw(TX, 0, 0), p2 = gw(-TX, 0, 0);

  KIT.defineBuild('warcamp', {
    name: 'War camp', size: 'big', need: 120,
    line: 'A palisaded war camp: rows of Norse tents round the striped command pavilion, a gate between two log towers, a staked earth bank, cook fires, banners, weapon racks and soldiers at work.',
    r: 16, flat: [27, 27], ground: 'grass',
    path: [[GX + Math.cos(nG) * 4.6, GZ + Math.sin(nG) * 4.6], [GX, GZ], [3.75, 4.95], [3.3, 1.75], [3.75, 4.95], [-1.0, 4.95], [-12.2, 4.95]],
    frameY: 2.0, glowAt: [PX, DECKY + PWH + PRH + 1.5, PZ],
    perches: [
      { x: +p1.x.toFixed(2), y: TEAVE + TRISE + 0.15, z: +p1.z.toFixed(2), ry: +RYG.toFixed(2) },
      { x: +p2.x.toFixed(2), y: TEAVE + TRISE + 0.15, z: +p2.z.toFixed(2), ry: +RYG.toFixed(2) },
      { x: +WX.toFixed(2), y: WEAVE + WRISE + 0.15, z: +WZ.toFixed(2), ry: +RYW.toFixed(2) }
    ],
    trees: [{ x: -10.3, z: -10.6, kind: 'round', h: 6.4 }, { x: -3.0, z: -14.4, kind: 'cypress', h: 7.6 }, { x: 6.2, z: -13.4, kind: 'round', h: 6.0 }, { x: 14.4, z: -2.6, kind: 'cypress', h: 7.2 }, { x: 13.4, z: 6.2, kind: 'round', h: 5.2 }],
    bushes: [{ x: -10.6, z: 9.6, r: 0.85, flowers: '#f3f1ec' }, { x: -0.9, z: 15.05, r: 0.7 }, { x: 10.6, z: 9.9, r: 0.7, flowers: '#f3f1ec' }, { x: -14.4, z: 1.6, r: 0.75 }, { x: 8.3, z: 12.6, r: 0.6 }],
    build: function (b) {
      // ---------------------------------------------------------------- ground dressing (always there)
      b.base(function () {
        for (var i = 0; i < 90; i++) { var a = (-162 + b.r() * 198) * DEG, rr = RP + (b.r() < 0.5 ? -0.35 : 0.35) + b.j(0.12); b.grass(Math.cos(a) * rr, 0, Math.sin(a) * rr, 0.3 + b.r() * 0.3); }
      });

      b.part('Footings');
      b.unit(function () {
        b.push(GX, 0, GZ, RYG);
        [-TX, TX].forEach(function (tx) { b.box(tx, -0.12, 0, THW * 2 + 0.9, 0.3, THW * 2 + 0.9, { c: 'stoneDark', bevel: 0.07 }); });
        b.pop();
        b.push(WX, 0, WZ, RYW);
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) { b.box(c[0] * 1.25, -0.12, c[1] * 1.25, 0.62, 0.3, 0.62, { c: 'stoneDark', bevel: 0.07, ry: b.j(0.2) }); });
        b.pop();
      });

      b.part('Palisade, right');
      palisade(b, RP, 55.5 * DEG, -40 * DEG, 3);
      b.part('Palisade, back');
      palisade(b, RP, -40 * DEG, -110 * DEG, 3);
      b.part('Palisade, left');
      palisade(b, RP, -110 * DEG, -159.5 * DEG, 3);

      // ---------------------------------------------------------------- the gate towers, rising together
      b.push(GX, 0, GZ, RYG);
      b.part('Gate towers');
      // a log crib to shoulder height, then an open frame of corner logs and braces up to the fighting deck, so the
      // camp shows through
      var NBASE = 5;
      for (var c0 = 0; c0 < NBASE; c0 += 3) {
        [TX, -TX].forEach(function (tx) { b.unit(function () { crib(b, tx, 0, THW, c0, Math.min(NBASE, c0 + 3)); }); });
      }
      b.part('Tower frames');
      var fy0 = 0.26 + (NBASE - 1) * 0.25 + 0.2, fy1 = TDECK - 0.3;
      [TX, -TX].forEach(function (tx) {
        b.unit(function () {
          [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) { b.beam([tx + sx * THW, fy0 - 0.25, sz * THW], [tx + sx * THW, TDECK - 0.14, sz * THW], 0.13 * (0.95 + b.r() * 0.1), { c: 'warcamp_log', round: true, seg: 7 }); }); });
          // sills under the deck joists, out to the deck's edge
          [-1, 1].forEach(function (sx) { b.beam([tx + sx * THW, TDECK - 0.26, -TH - 0.05], [tx + sx * THW, TDECK - 0.26, TH + 0.05], 0.11, { c: 'warcamp_log', round: true, seg: 7 }); });
        });
      });
      [TX, -TX].forEach(function (tx) {
        b.unit(function () {
          var ym = (fy0 + fy1) / 2;
          [['x', 1], ['x', -1], ['z', 1], ['z', -1]].forEach(function (sd) {
            var P = function (t, y) { return sd[0] === 'x' ? [tx + sd[1] * (THW + 0.02), y, t * THW] : [tx + t * THW, y, sd[1] * (THW + 0.02)]; };
            b.beam(P(-1, ym), P(1, ym), 0.075, { c: 'warcamp_log', round: true, seg: 6 });
            b.beam(P(-1, fy0), P(1, fy1), 0.05, { c: 'woodDark' });
            b.beam(P(1, fy0), P(-1, fy1), 0.05, { c: 'woodDark' });
          });
        });
      });
      b.part('Tower decks');
      [TX, -TX].forEach(function (tx) {
        b.unit(function () { towerDeck(b, tx, 0, TDECK, TH); });
      });
      [TX, -TX].forEach(function (tx) {
        b.unit(function () {
          parapet(b, tx, 0, TDECK + 0.04, TH - 0.03, [tx > 0 ? 'x-' : 'x+']);
          [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) { b.beam([tx + sx * (TH - 0.06), TDECK, sz * (TH - 0.06)], [tx + sx * (TH - 0.06), TEAVE + 0.05, sz * (TH - 0.06)], 0.08, { c: 'woodDark' }); }); });
          for (var k = 0; k < 3; k++) anyShield(b, k + (tx > 0 ? 0 : 3), tx - 0.8 + k * 0.8, TDECK + 0.55, TH + 0.07, 0, 0.31, 0.06);
          anyShield(b, tx > 0 ? 4 : 1, tx + (tx > 0 ? 1 : -1) * (TH + 0.07), TDECK + 0.55, 0, tx > 0 ? Math.PI / 2 : -Math.PI / 2, 0.31, 0.06);
        });
      });
      b.part('Tower roofs');
      [TX, -TX].forEach(function (tx) { towerRoof(b, tx, 0, TEAVE, TRISE, TH, 0); });
      [TX, -TX].forEach(function (tx) { b.unit(function () { towerGables(b, tx, 0, TEAVE, TRISE, TH, 0.7, true); b.flag(tx + 0.25, TEAVE + TRISE + 0.1, 0, 1.3, 0.8, 0.36, { c: tx > 0 ? 'ink' : 'bone', pennant: true, pr: 0.03, ry: -0.5 }); }); });

      b.part('Gate');
      b.unit(function () {
        [-1, 1].forEach(function (s) { stave(b, s * 1.2, 0, -0.05, TDECK - 0.33, 0.24, { cap: false }); });
        [-0.55, 0.55].forEach(function (z) { b.beam([-1.55, TDECK - 0.17, z], [1.55, TDECK - 0.17, z], 0.16, { c: 'warcamp_log', round: true, seg: 8 }); });
      });
      b.unit(function () {
        for (var i = 0; i < 11; i++) { var x = -1.3 + (i + 0.5) * (2.6 / 11); b.box(x, TDECK - 0.01, 0, 2.6 / 11 - 0.02, 0.07, 1.45, { c: 'warcamp_plank', m: M.wood, bevel: 0.01 }); }
        [-0.66, 0.66].forEach(function (z) {
          [-1.05, 0, 1.05].forEach(function (x) { b.post(x, TDECK + 0.05, z, 0.05, 0.95, { c: 'woodDark' }); });
          b.beam([-1.3, TDECK + 0.93, z], [1.3, TDECK + 0.93, z], 0.055, { c: 'woodDark' });
          b.beam([-1.3, TDECK + 0.5, z], [1.3, TDECK + 0.5, z], 0.035, { c: 'woodDark' });
        });
      });
      // the two leaves, swung in
      [-1, 1].forEach(function (sg) {
        b.unit(function () {
          var w = 1.08, h = TDECK - 0.65, n = 6, pw = w / n;
          b.push(-sg * 1.08, 0, -0.08, sg * 1.2);
          for (var i = 0; i < n; i++) { var px = sg * pw * (i + 0.5), hh = h + b.j(0.06); b.box(px, 0.03, 0, pw - 0.02, hh, 0.09, { c: 'warcamp_plank', m: M.wood, bevel: 0.015 }); b.box(px, 0.03 + hh, 0, pw - 0.02, 0.16, 0.09, { c: 'warcamp_plank', m: M.wood, taper: 0.12, taperD: 1.0 }); }
          [0.5, h - 0.55].forEach(function (yy) { b.box(sg * w / 2, yy, -0.08, w - 0.04, 0.16, 0.06, { c: 'woodDark', m: M.wood, bevel: 0.012 }); b.box(sg * w * 0.45, yy + 0.04, 0.055, w * 0.85, 0.06, 0.015, { c: 'iron', m: M.metal, bevel: 0.004 }); });
          b.beam([sg * 0.12, 0.67, -0.08], [sg * (w - 0.12), h - 0.55, -0.08], 0.05, { c: 'woodDark', r2: 0.025 });
          b.addGeo(new T.TorusGeometry(0.07, 0.013, 4, 10), { x: sg * (w - 0.18), y: 1.5, z: 0.065, c: 'iron', m: M.metal, ao: 0 });
          b.pop();
        });
      });
      b.unit(function () {
        b.banner(0, TDECK - 0.3, 0.74, 1.15, 1.05, { c: 'ink', emblem: 'swords', ec: '#f1eee8', es: 0.78, tail: 'swallow', trim: 'iron' });
        [-1, 1].forEach(function (s) { b.torch(s * 1.2, 1.85, 0.08, { s: 0.6 }); });
      });
      b.pop();

      b.part('Stake line');
      stakeLine(b, 13.0, 84.4 * DEG, 189 * DEG, 3);

      // ---------------------------------------------------------------- the corner watchtower
      b.part('Watchtower');
      b.push(WX, 0, WZ, RYW);
      var leg = function (y) { return 1.25 - 0.25 * y / WDECK; };
      b.unit(function () { [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) { b.beam([c[0] * 1.25, 0, c[1] * 1.25], [c[0] * 1.0, WDECK + 0.02, c[1] * 1.0], 0.15, { c: 'warcamp_log', round: true, seg: 7 }); }); });
      [[0.35, 2.6], [2.6, 4.85]].forEach(function (yy) {
        b.unit(function () {
          var h0 = leg(yy[0]), h1 = leg(yy[1]);
          [['x', 1], ['x', -1], ['z', 1], ['z', -1]].forEach(function (sd) {
            var P = function (t, y, h) { return sd[0] === 'x' ? [sd[1] * h, y, t * h] : [t * h, y, sd[1] * h]; };
            b.beam(P(-1, yy[1], h1), P(1, yy[1], h1), 0.08, { c: 'warcamp_log', round: true, seg: 6 });
            b.beam(P(-1, yy[0], h0), P(1, yy[1], h1), 0.055, { c: 'woodDark' });
            b.beam(P(1, yy[0], h0), P(-1, yy[1], h1), 0.055, { c: 'woodDark' });
          });
        });
      });
      b.unit(function () { towerDeck(b, 0, 0, WDECK + 0.12, 1.35); });
      b.unit(function () {
        parapet(b, 0, 0, WDECK + 0.16, 1.32, [], ['z+', 0, 0.35]);
        [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) { b.beam([sx * 1.28, WDECK + 0.1, sz * 1.28], [sx * 1.28, WEAVE + 0.05, sz * 1.28], 0.08, { c: 'woodDark' }); }); });
      });
      b.unit(function () { for (var k = 0; k < 3; k++) { anyShield(b, k + 1, -1.39, WDECK + 0.66, -0.8 + k * 0.8, -Math.PI / 2, 0.3, 0.05); anyShield(b, k + 4, -0.8 + k * 0.8, WDECK + 0.66, -1.39, Math.PI, 0.3, 0.05); } });
      towerRoof(b, 0, 0, WEAVE, WRISE, 1.35, 0);
      b.unit(function () {
        // ridge along local x here: gables face -x and +x, heads look out along the ridge
        towerGables(b, 0, 0, WEAVE, WRISE, 1.35, 0.68, true);
        b.flag(0.3, WEAVE + WRISE + 0.1, 0, 1.5, 0.95, 0.42, { c: 'ink', pennant: true, pr: 0.035, ry: -0.4 });
      });
      b.unit(function () { b.ladder(0, 0, 1.45, WDECK + 0.2, { ry: 0, w: 0.5, lean: 0.22 }); });
      b.pop();

      // ---------------------------------------------------------------- the command pavilion
      b.push(PX, 0, PZ, 0);
      b.part('Pavilion deck');
      var deckHalf = function (z) { var c = Math.sqrt(Math.max(0, 3.6 * 3.6 - z * z)); return z > 2.0 ? Math.max(c, 1.95) : c; };
      b.unit(function () {
        [-3.0, -1.5, 0, 1.5, 3.0].forEach(function (x) { var zl = Math.sqrt(Math.max(0.1, 3.5 * 3.5 - x * x)), zh = Math.abs(x) < 1.95 ? 5.25 : zl; b.beam([x, 0.12, -zl], [x, 0.12, zh], 0.13, { c: 'warcamp_log', round: true, seg: 7 }); });
      });
      var rows = []; for (var zr = -3.45; zr <= 5.3; zr += 0.29) rows.push(zr);
      for (var r0 = 0; r0 < rows.length; r0 += 6) {
        b.unit(function () {
          for (var k = r0; k < Math.min(rows.length, r0 + 6); k++) {
            var z = rows[k], hw = deckHalf(z); if (hw < 0.4) continue;
            var cut = b.j(hw * 0.4);
            b.box((-hw + cut) / 2, 0.26, z, hw + cut - 0.02, 0.06, 0.27, { c: 'warcamp_deck', m: M.wood, bevel: 0.012 });
            b.box((hw + cut) / 2, 0.26, z, hw - cut - 0.02, 0.06, 0.27, { c: 'warcamp_deck', m: M.wood, bevel: 0.012 });
          }
        });
      }
      b.unit(function () { b.beam([-1.7, 0.1, 5.62], [1.7, 0.1, 5.62], 0.12, { c: 'warcamp_log', round: true, seg: 7 }); b.box(0, 0.1, 5.62, 3.3, 0.06, 0.34, { c: 'warcamp_deck', m: M.wood, bevel: 0.012 }); });

      b.push(0, DECKY, 0, 0);
      b.part('Pavilion walls');
      var wallC = function (k) { return k % 2 ? '#e9e5dc' : BONE; }, roofC = function (k) { return k % 2 ? INK : BONE; };
      pavilion(b, PR, PWH, PRH, { seg: 16, open: 0.9, wall: wallC, roof: roofC, pole: 0.55, roofPart: 'Pavilion roof' });
      b.part('Pavilion finial');
      b.unit(function () {
        var top = PWH + PRH + 0.55;
        wcHead(b, 0, top - 0.02, 0, 0, 0.9, { c: 'woodDark' });
        b.flag(-0.12, top + 0.25, 0, 1.25, 1.05, 0.4, { c: 'ember', pennant: true, pr: 0.025, ry: 0.5 });
      });
      b.part('Pavilion porch');
      b.unit(function () {
        [-1, 1].forEach(function (s) { stave(b, s * 1.6, 0, 5.05, 2.05, 0.2, { cap: false }); wcHead(b, s * 1.6, 2.02, 5.05, s > 0 ? 0 : Math.PI, 0.45, { c: 'woodDark' }); });
        b.beam([-1.7, 2.0, 5.05], [1.7, 2.0, 5.05], 0.06, { c: 'woodDark' });
      });
      b.unit(function () { b.awning(0, PWH - 0.02, PR * 0.9, 3.3, 2.38, 0.42, { stripes: [INK, BONE], n: 6, poles: false }); });
      b.unit(function () {
        [-150, -115, -80, -50, -12, 18, 162, 198].forEach(function (d) {
          var a = d * DEG, rr = PR * 1.08, pr = PR + 1.3;
          b.beam([Math.cos(a) * rr, PWH + 0.02, Math.sin(a) * rr], [Math.cos(a) * pr, -DECKY + 0.06, Math.sin(a) * pr], 0.012, { c: 'rope', m: M.rope, round: true, seg: 4 });
          b.post(Math.cos(a) * pr, -DECKY, Math.sin(a) * pr, 0.035, 0.25, { c: 'woodLight' });
        });
      });
      b.part('Pavilion furnishings');
      b.unit(function () {
        // the chieftain's high seat inside, a chest and a horn on a stand
        b.push(0, 0, -1.6, 0);
        b.box(0, 0, 0, 0.9, 0.5, 0.7, { c: 'woodDark', m: M.wood });
        b.box(0, 0.5, -0.3, 0.9, 1.1, 0.1, { c: 'woodDark', m: M.wood });
        [-1, 1].forEach(function (s) { b.post(s * 0.42, 0, -0.32, 0.05, 1.75, { c: 'woodDark' }); wcHead(b, s * 0.42, 1.72, -0.32, Math.PI / 2, 0.32, { c: 'woodDark' }); });
        b.box(0, 0.5, 0.05, 0.8, 0.06, 0.6, { c: '#d9d2c4', m: M.cloth });
        b.pop();
        b.box(1.4, 0, -1.7, 0.8, 0.5, 0.5, { c: 'wood', m: M.wood, ry: 0.6 }); b.box(1.4, 0.5, -1.7, 0.82, 0.08, 0.52, { c: 'iron', m: M.metal, ry: 0.6 });
        anyShield(b, 2, -1.6, 0.9, -1.9, 0.6, 0.38, 0.0);
      });
      b.unit(function () {
        // the map table: a chart of the coast held flat with stones, carved markers on it
        b.table(0, 3.95, 1.9, 1.05);
        b.box(0, 0.81, 3.95, 1.6, 0.012, 0.85, { c: '#e9e3d6', m: M.cloth, bevel: 0, ry: 0.04 });
        [[-0.6, 0.2, 0.5], [-0.2, -0.1, 0.7], [0.3, 0.15, 0.6], [0.55, -0.25, 0.4]].forEach(function (s) { b.box(s[0], 0.822, 3.95 + s[1], s[2], 0.006, 0.03, { c: '#2a2826', m: M.paint, bevel: 0, ry: b.j(0.8) }); });
        [[-0.5, -0.2, INK], [-0.35, 0.25, INK], [0.1, 0.05, BONE], [0.45, 0.25, BONE], [0.6, -0.1, 'ember']].forEach(function (s) { b.box(s[0], 0.82, 3.95 + s[1], 0.07, 0.09, 0.07, { c: s[2], m: M.paint, bevel: 0.01 }); });
        [[-0.78, 0.4], [0.78, -0.4], [0.75, 0.38]].forEach(function (s) { b.rock(s[0], 0.84, 3.95 + s[1], 0.05); });
        b.box(0.0, 0, 3.0, 0.4, 0.45, 0.4, { c: 'wood', m: M.wood });
      });
      b.pop(); // deck height
      b.pop(); // pavilion frame

      // ---------------------------------------------------------------- tents, row by row
      var tents = [
        ['Tents, back row', [[-6.2, -8.2, BONE], [-2.8, -8.2, GREY]]],
        ['Tents, middle row', [[-9.0, -3.1, BONE], [-5.7, -3.1, GREY, true], [-2.4, -3.1, BONE]]],
        ['Tents, front row', [[-9.6, 2.0, GREY], [-6.2, 2.0, BONE], [-2.8, 2.0, BONE]]],
        ['Tent by the wall', [[9.4, -2.7, BONE]]]
      ];
      tents.forEach(function (row) { b.part(row[0]); row[1].forEach(function (t) { tent(b, t[0], t[1], b.j(0.05), { c: t[2], closed: t[3] }); }); });
      b.part('Bell tent');
      b.push(8.0, 0, -6.9, 0.4);
      pavilion(b, 1.35, 0.75, 1.95, { seg: 8, open: 0, wall: function () { return BONE; }, roof: function (k) { return k % 2 ? '#e6e2d9' : BONE; }, valance: false, pole: 0.3, per: 2 });
      b.unit(function () {
        b.extrude(0, 0, 1.385, [[-0.32, 0.01], [0.32, 0.01], [0, 0.74]], 0.03, { c: '#2a2521', m: M.dark, ao: 0, jit: 0 });
        [-1, 1].forEach(function (s) { b.extrude(0, 0, 1.41, [[s * 0.3, 0.01], [s * 0.5, 0.01], [s * 0.06, 0.76]], 0.02, { c: BONE, m: M.cloth, bucket: 'cloth' }); });
        b.cyl(0, 0.75, 0, 1.47, 0.12, { c: INK, m: M.cloth, open: true, seg: 16, bucket: 'cloth' });
        [-130, -70, -20, 30, 170, 220].forEach(function (d) { var a = d * DEG; b.beam([Math.cos(a) * 1.45, 0.78, Math.sin(a) * 1.45], [Math.cos(a) * 2.05, 0.06, Math.sin(a) * 2.05], 0.011, { c: 'rope', m: M.rope, round: true, seg: 4 }); b.post(Math.cos(a) * 2.05, 0, Math.sin(a) * 2.05, 0.03, 0.22, { c: 'woodLight' }); });
      });
      b.pop();

      b.part('Duckboards');
      var gl = gw(0, 0, -1.25); duckboards(b, [[gl.x, gl.z], [3.75, 4.95], [3.3, 1.8]], 1.25, 6);
      duckboards(b, [[3.0, 4.95], [-11.2, 4.95]], 1.15, 7);

      // ---------------------------------------------------------------- cook fires
      b.part('Cook fire');
      b.unit(function () { fireRing(b, F1[0], F1[1]); });
      b.unit(function () { fireWood(b, F1[0], F1[1], 0.85); });
      b.unit(function () {
        // the tripod and the cauldron
        var ax = F1[0], az = F1[1];
        [0.3, 2.4, 4.5].forEach(function (a) { b.beam([ax + Math.cos(a) * 0.82, 0, az + Math.sin(a) * 0.82], [ax, 1.75, az], 0.03, { c: 'iron', m: M.metal, round: true, seg: 5 }); });
        b.beam([ax, 1.75, az], [ax, 1.0, az], 0.012, { c: 'iron', m: M.metal, round: true, seg: 4 });
        b.addGeo(new T.TorusGeometry(0.3, 0.012, 4, 14, Math.PI), { x: ax, y: 0.98, z: az, rz: Math.PI, c: 'iron', m: M.metal, ao: 0 });
        b.lathe(ax, 0.42, az, [[0.01, 0], [0.18, 0.02], [0.3, 0.14], [0.33, 0.32], [0.29, 0.5], [0.31, 0.53]], { c: '#2e2f31', m: M.metal, seg: 14 });
        b.cyl(ax, 0.88, az, 0.27, 0.02, { c: '#8a7656', m: M.soil, seg: 14 });
      });
      b.unit(function () {
        seatLog(b, F1[0] - 0.1, F1[1] + 1.65, 0.1, 1.9);
        seatLog(b, F1[0] - 1.6, F1[1] + 0.2, Math.PI / 2 + 0.3, 1.6);
        b.log(F1[0] + 1.45, 0, F1[1] + 0.95, 0.26, 0.45, { c: 'warcamp_log', seg: 8 });
      });
      b.unit(function () {
        b.woodpile(-5.4, 10.7, { n: 4, len: 1.3, ry: 0.45 });
        b.bucket(F1[0] + 1.2, 0, F1[1] - 0.7);
        b.sack(F1[0] + 1.85, 0, F1[1] - 0.2, 0.48); b.sack(F1[0] + 2.2, 0, F1[1] + 0.3, 0.42);
        b.barrel(F1[0] + 2.4, 0, F1[1] - 0.9, { h: 0.85 });
        // the cook's table: bread, bowls and a basket of fish
        b.table(F1[0] + 2.9, F1[1] + 1.4, 1.4, 0.7, { ry: -0.4 });
        b.push(F1[0] + 2.9, 0.78, F1[1] + 1.4, -0.4);
        [-0.45, -0.2, 0.05].forEach(function (x) { b.lathe(x, 0, -0.1, [[0.01, 0], [0.07, 0], [0.1, 0.06], [0.09, 0.065]], { c: 'woodLight', m: M.wood, seg: 10 }); });
        b.ball(0.35, 0.06, 0.05, 0.12, { c: '#b48d5e', m: M.straw, sy: 0.6, detail: 1 }); b.ball(0.5, 0.05, -0.15, 0.1, { c: '#a8814f', m: M.straw, sy: 0.6, detail: 1 });
        b.lathe(-0.45, 0, 0.18, [[0.01, 0], [0.16, 0], [0.19, 0.18], [0.17, 0.19]], { c: '#a08a68', m: M.straw, seg: 10 });
        for (var f = 0; f < 3; f++) b.ball(-0.48 + f * 0.05, 0.17, 0.18 + b.j(0.05), 0.05, { c: '#8f979b', m: M.metal, sx: 2.2, sy: 0.6, detail: 1, ry: f });
        b.pop();
      });
      b.unit(function () {
        // the mess table: a trestle board with benches, bowls, cups and bread
        b.push(-9.0, 0, 6.7, 2.21);
        b.table(0, 0, 2.1, 0.75);
        [-0.62, 0.62].forEach(function (z) { b.bench(0, z, 1.9); });
        for (var k = 0; k < 5; k++) { var x = -0.8 + k * 0.4, zz = (k % 2 ? 0.18 : -0.18); b.lathe(x, 0.775, zz, [[0.01, 0], [0.07, 0], [0.1, 0.06], [0.09, 0.065]], { c: 'woodLight', m: M.wood, seg: 10 }); b.cyl(x + 0.14, 0.775, -zz, 0.045, 0.12, { c: 'wood', m: M.wood, seg: 8 }); }
        b.ball(0.85, 0.83, 0.05, 0.12, { c: '#b48d5e', m: M.straw, sy: 0.6, detail: 1 });
        b.barrel(1.45, 0, 0.1, { h: 0.8 });
        b.pop();
      });
      b.part('Fish spit');
      b.unit(function () { fireRing(b, F2[0], F2[1]); });
      b.unit(function () { fireWood(b, F2[0], F2[1], 0.75); });
      b.unit(function () {
        var ax = F2[0], az = F2[1];
        [-1, 1].forEach(function (s) { b.beam([ax + s * 0.85, 0, az], [ax + s * 0.85, 1.0, az], 0.04, { c: 'woodDark' }); b.beam([ax + s * 0.85, 0.85, az], [ax + s * 0.85 + 0.12, 1.08, az], 0.025, { c: 'woodDark' }); b.beam([ax + s * 0.85, 0.85, az], [ax + s * 0.85 - 0.12, 1.08, az], 0.025, { c: 'woodDark' }); });
        b.beam([ax - 1.1, 0.95, az], [ax + 1.0, 0.95, az], 0.02, { c: 'iron', m: M.metal, round: true, seg: 5 });
        b.beam([ax - 1.1, 0.95, az], [ax - 1.1, 0.7, az + 0.05], 0.015, { c: 'iron', m: M.metal, round: true, seg: 4 });
        for (var f = 0; f < 5; f++) { var fx = ax - 0.5 + f * 0.25; b.ball(fx, 0.82, az, 0.06, { c: f % 2 ? '#8f979b' : '#9a8a6a', m: M.metal, sx: 0.6, sy: 2.4, detail: 1 }); b.extrude(fx, 0.6, az, [[0, 0.06], [-0.06, -0.04], [0.06, -0.04]], 0.015, { c: '#7d858a', m: M.metal, ao: 0 }); }
      });
      b.unit(function () {
        seatLog(b, F2[0] + 0.1, F2[1] + 1.5, -0.08, 1.7);
        b.log(F2[0] - 1.5, 0, F2[1] + 0.6, 0.25, 0.42, { c: 'warcamp_log', seg: 8 });
        b.woodpile(F2[0] + 2.3, F2[1] - 0.6, { n: 3, len: 1.2, ry: -0.3 });
        b.bucket(F2[0] + 1.3, 0, F2[1] + 0.8);
        b.barrel(F2[0] - 1.7, 0, F2[1] - 0.7, { h: 0.8 });
      });

      // ---------------------------------------------------------------- banners
      b.part('Banners');
      b.unit(function () { [-2.35, 2.35].forEach(function (x) { bannerPole(b, PX + x, PZ + 5.45, 0, 4.4, 0.95, 2.3, { emblem: 'swords', head: true }); }); });
      b.unit(function () { bannerPole(b, 5.7, 8.5, -0.45, 5.8, 1.2, 3.0, { c: 'bone', emblem: 'swords', ec: '#232220', es: 0.85, band: 'ember', bandAt: 0.74, bandH: 0.05, trim: 'iron', head: true }); });
      b.unit(function () {
        [[-11.0, -0.2], [-0.5, -5.6]].forEach(function (p, i) { b.flag(p[0], 0, p[1], 3.4, 0.9, 0.4, { c: i ? 'bone' : 'ink', pennant: true, pr: 0.04, ry: -0.3 }); b.box(p[0], -0.05, p[1], 0.3, 0.12, 0.3, { c: 'stoneDark', bevel: 0.04 }); });
      });

      // ---------------------------------------------------------------- arms
      b.part('Weapon racks');
      b.unit(function () {
        // a second stook of spears on the muster ground, two shields propped against it
        var sx = 3.0, sz = 8.5;
        for (var k = 0; k < 8; k++) { var a = k / 8 * Math.PI * 2 + 0.3, rr = 0.5; b.beam([sx + Math.cos(a) * rr, 0, sz + Math.sin(a) * rr], [sx - Math.cos(a) * 0.12, 2.2, sz - Math.sin(a) * 0.12], 0.022, { c: 'woodLight', round: true, seg: 5 }); b.extrude(sx - Math.cos(a) * 0.12, 2.2, sz - Math.sin(a) * 0.12, [[-0.04, 0], [0.04, 0], [0, 0.26]], 0.02, { ry: -a, rz: Math.cos(a) * 0.2, c: 'steel', m: M.metal }); }
        b.cyl(sx, 1.68, sz, 0.1, 0.1, { c: 'rope', m: M.rope, seg: 8 });
        anyShield(b, 0, sx - 0.25, 0.36, sz + 0.62, -0.5, 0.34, -0.32); anyShield(b, 3, sx + 0.45, 0.36, sz + 0.45, 0.3, 0.34, -0.32);
      });
      b.unit(function () {
        b.rack(1.5, 0, 6.15, 1.9, { kind: 'swords', ry: -0.1 });
        // round shields leant against its foot and helms on its posts, so it reads as a rack and not a fence
        b.push(1.5, 0, 6.15, -0.1);
        [-0.6, 0.05, 0.65].forEach(function (x, i) { anyShield(b, i + 1, x, 0.38, 0.32, b.j(0.15), 0.34, -0.3); });
        [-1, 1].forEach(function (s) { b.lathe(s * 0.95, 1.5, 0, [[0.16, 0], [0.17, 0.13], [0.12, 0.25], [0.01, 0.28]], { c: 'steel', m: M.metal, seg: 12 }); });
        b.pop();
      });
      b.unit(function () {
        // a rail of round shields by the tents
        var sx = -4.4, sz = 6.3;
        [-1, 1].forEach(function (s) { stave(b, sx + s * 1.25, 0, sz, 1.25, 0.14, { cap: true }); });
        b.beam([sx - 1.3, 1.1, sz], [sx + 1.3, 1.1, sz], 0.05, { c: 'woodDark' });
        for (var k = 0; k < 4; k++) anyShield(b, k, sx - 0.95 + k * 0.63, 0.82, sz + 0.1, 0.0, 0.3, -0.12);
      });
      b.unit(function () {
        // a stook of spears, tied at the top
        var sx = -0.45, sz = -0.6;
        for (var k = 0; k < 9; k++) { var a = k / 9 * Math.PI * 2, rr = 0.55; b.beam([sx + Math.cos(a) * rr, 0, sz + Math.sin(a) * rr], [sx - Math.cos(a) * 0.14, 2.3, sz - Math.sin(a) * 0.14], 0.022, { c: 'woodLight', round: true, seg: 5 }); b.extrude(sx - Math.cos(a) * 0.14, 2.3, sz - Math.sin(a) * 0.14, [[-0.04, 0], [0.04, 0], [0, 0.26]], 0.02, { ry: -a, rz: Math.cos(a) * 0.2, c: 'steel', m: M.metal }); }
        b.cyl(sx, 1.75, sz, 0.11, 0.1, { c: 'rope', m: M.rope, seg: 8 });
      });
      b.unit(function () { b.dummy(-1.4, 0, 10.6, { ry: 0.5, helm: true, shield: 'bone' }); b.dummy(0.6, 0, 11.3, { ry: 0.2 }); });
      b.unit(function () {
        // an armour stand by the porch
        var ax = PX + 2.75, az = PZ + 6.1;
        b.post(ax, 0, az, 0.05, 1.5, { c: 'beam' }); b.box(ax, 0, az, 0.6, 0.06, 0.6, { c: 'beam', m: M.wood });
        b.lathe(ax, 0.75, az, [[0.18, 0], [0.26, 0.12], [0.22, 0.45], [0.28, 0.68], [0.14, 0.8], [0.01, 0.82]], { c: 'steel', m: M.metal, seg: 12 });
        b.lathe(ax, 1.6, az, [[0.17, 0], [0.18, 0.14], [0.13, 0.27], [0.01, 0.3]], { c: 'steel', m: M.metal, seg: 12 });
        b.box(ax, 1.62, az + 0.16, 0.04, 0.2, 0.03, { c: 'steel', m: M.metal, bevel: 0.005 });
        b.lathe(ax, 0.62, az, [[0.24, 0], [0.27, 0.16], [0.2, 0.2]], { c: 'ink', m: M.cloth, seg: 12 });
      });

      // ---------------------------------------------------------------- the smith's corner
      b.part('Smithy');
      var SX = 9.2, SZ = 1.3;
      b.unit(function () {
        // a hearth of laid stones with coals on top
        for (var cy = 0; cy < 3; cy++) for (var i = 0; i < 4; i++) { var off = (cy % 2) * 0.17; b.box(SX - 0.55 + i * 0.36 + off - 0.08, cy * 0.27, SZ - 0.42, 0.34, 0.26, 0.3, { c: b.stoneC('stone', cy * 0.27), m: M.stone, bevel: 0.04 }); b.box(SX - 0.55 + i * 0.36 + off - 0.08, cy * 0.27, SZ + 0.42, 0.34, 0.26, 0.3, { c: b.stoneC('stone', cy * 0.27), m: M.stone, bevel: 0.04 }); }
        for (var cy2 = 0; cy2 < 3; cy2++) [-1, 1].forEach(function (s) { b.box(SX + s * 0.62, cy2 * 0.27, SZ, 0.3, 0.26, 0.55, { c: b.stoneC('stone', cy2 * 0.27), m: M.stone, bevel: 0.04 }); });
        b.box(SX, 0.8, SZ, 1.5, 0.08, 1.1, { c: 'stoneDark', bevel: 0.03 });
        b.embers(SX, 0.9, SZ, 0.36, {});
        b.flame(SX, 0.88, SZ, 0.45, { light: false });
        // the bellows
        b.box(SX + 0.95, 0.55, SZ + 0.1, 0.5, 0.12, 0.32, { c: '#5a3f2b', m: M.cloth, taper: 0.5, taperD: 1 });
      });
      b.unit(function () {
        // a lean-to of dark shingles over the hearth
        var x0 = SX - 1.0, x1 = SX + 1.15, z0 = SZ - 1.05, z1 = SZ + 1.05;
        [[x0, z0, 1.95], [x0, z1, 1.95], [x1, z0, 2.5], [x1, z1, 2.5]].forEach(function (p) { b.post(p[0], 0, p[1], 0.07, p[2], { c: 'woodDark' }); });
        [z0, z1].forEach(function (z) { b.beam([x0 - 0.15, 1.95, z], [x1 + 0.15, 2.5, z], 0.06, { c: 'woodDark' }); });
        var slope = Math.atan2(0.55, x1 - x0);
        for (var r = 0; r < 5; r++) for (var i = 0; i < 9; i++) {
          var t = (r + 0.5) / 5, x = x0 - 0.25 + t * (x1 - x0 + 0.5), y = 1.98 + t * 0.6 + 0.06 + (r % 2) * 0.01, z = z0 - 0.2 + (i + 0.5 + (r % 2) * 0.5) * ((z1 - z0 + 0.4) / 9.5);
          b.box(x, y, z, (x1 - x0 + 0.5) / 5 * 1.35, 0.05, (z1 - z0 + 0.4) / 9.5 - 0.02, { rz: slope + b.j(0.02), ry: b.j(0.03), c: 'woodDark', m: M.wood, bevel: 0.01 });
        }
      });
      b.unit(function () {
        b.anvil(SX - 1.1, 0, SZ + 1.75, { ry: 0.3 });
        // the quench tub and a rack of tongs
        b.cyl(SX + 0.6, 0, SZ + 1.9, 0.38, 0.5, { c: 'woodLight', m: M.wood, seg: 12 }); b.cyl(SX + 0.6, 0.46, SZ + 1.9, 0.33, 0.03, { c: '#4c5a5e', m: M.water, seg: 12 });
        [0.48, 0.12].forEach(function (yy) { b.cyl(SX + 0.6, yy, SZ + 1.9, 0.395, 0.05, { c: 'iron', m: M.metal, seg: 12, open: true }); });
      });
      b.unit(function () {
        // the grindstone
        var gx = SX - 2.6, gz = SZ + 2.1;
        b.box(gx, 0, gz, 0.9, 0.5, 0.35, { c: 'wood', m: M.wood, ry: 0.5 }); b.cyl(gx, 0.85, gz, 0.42, 0.16, { c: '#b9b2a2', m: M.stone, rx: Math.PI / 2, ry: 0.5, seg: 16, flat: true });
        b.bucket(gx + 0.75, 0, gz - 0.35);
      });

      // ---------------------------------------------------------------- stores
      b.part('Supply cart');
      b.unit(function () {
        b.cart(7.1, -0.35, { ry: 0.12, load: function () { b.barrel(-0.3, 0.71, -0.4, { h: 0.7, r: 0.26 }); b.barrel(0.32, 0.71, -0.55, { h: 0.7, r: 0.26 }); b.sack(-0.25, 0.71, 0.35, 0.5); b.sack(0.3, 0.71, 0.3, 0.46); b.sack(0.0, 1.05, 0.0, 0.42); } });
      });
      b.unit(function () { b.barrel(11.0, 0, 2.75, {}); b.barrel(11.25, 0, 3.5, { h: 0.85 }); b.crate(10.95, 0, 1.25, 0.7, { ry: 0.3 }); b.crate(10.95, 0.7, 1.3, 0.55, { ry: 0.5 }); });
      b.unit(function () { b.crate(11.45, 0, -0.7, 0.75, { ry: -0.2 }); b.crate(11.55, 0, 0.15, 0.65, { ry: 0.25 }); b.crate(11.47, 0.75, -0.7, 0.55, { ry: 0.1 }); b.sack(10.85, 0, -1.0, 0.48); b.sack(10.8, 0, -0.3, 0.44); b.sack(10.95, 0, 0.5, 0.42); });
      b.unit(function () { b.hay(10.4, 0, -5.5, { ry: 0.9 }); b.hay(10.4, 0.55, -5.5, { ry: 0.8, w: 0.9 }); b.barrel(10.9, 0, -4.5, {}); b.crate(11.3, 0, -3.6, 0.65, { ry: 0.2 }); });
      b.part('Stake cutters');
      b.unit(function () {
        // fresh stakes being cut for the line: a sawhorse, a log on it, a pile of sharpened stakes
        var cx = -1.3, cz = 6.05;
        [-0.6, 0.6].forEach(function (s) { b.beam([cx + s - 0.25, 0, cz - 0.25], [cx + s, 0.75, cz], 0.04, { c: 'wood' }); b.beam([cx + s + 0.25, 0, cz + 0.25], [cx + s, 0.75, cz], 0.04, { c: 'wood' }); });
        b.beam([cx - 1.0, 0.82, cz], [cx + 1.1, 0.82, cz], 0.12, { c: 'warcamp_log', round: true, seg: 7 });
        [[4, 0], [3, 1], [2, 2]].forEach(function (L) {
          for (var k = 0; k < L[0]; k++) {
            var zz = cz + 1.05 + (k + L[1] * 0.5) * 0.17, yy = 0.08 + L[1] * 0.14, x0 = cx - 1.0 + b.j(0.08), x1 = cx + 0.75 + b.j(0.08);
            b.beam([x0, yy, zz], [x1, yy, zz], 0.08, { c: 'warcamp_log', round: true, seg: 6 });
            b.beam([x1, yy, zz], [x1 + 0.42, yy, zz], 0.08, { c: '#c9b48f', m: M.wood, round: true, seg: 6, r2: 0.008 });
            b.cyl(x0 + 0.012, yy, zz, 0.074, 0.02, { c: '#b9a483', m: M.wood, rz: Math.PI / 2, seg: 6 });
          }
        });
        // two finished stakes leant on the sawhorse
        [0.25, 0.5].forEach(function (dz, i) { b.beam([cx - 0.3 - i * 0.5, 0, cz + 0.55 + dz], [cx - 0.1 - i * 0.5, 1.0, cz + 0.08], 0.06, { c: 'warcamp_log', round: true, seg: 6 }); b.beam([cx - 0.1 - i * 0.5, 1.0, cz + 0.08], [cx - 0.06 - i * 0.5, 1.2, cz - 0.02], 0.06, { c: '#c9b48f', m: M.wood, round: true, seg: 6, r2: 0.008 }); });
        for (var c2 = 0; c2 < 10; c2++) b.box(cx + 1.1 + b.j(0.5), 0.01, cz + 0.3 + b.j(0.5), 0.08, 0.02, 0.04, { c: '#c8b796', m: M.wood, ry: b.r() * 3, bevel: 0 });
      });
      b.part('Kit by the tents');
      b.unit(function () {
        // a bedroll drying on a line between two tents, a helm on a stump, spears planted
        b.log(-1.4, 0, 3.6, 0.22, 0.45, { c: 'warcamp_log', seg: 8 }); b.lathe(-1.4, 0.45, 3.6, [[0.17, 0], [0.18, 0.14], [0.13, 0.27], [0.01, 0.3]], { c: 'steel', m: M.metal, seg: 12 });
      });
      b.unit(function () {
        anyShield(b, 1, -9.0, 0.42, 3.55, 0.2, 0.36, -0.35); anyShield(b, 3, -2.3, 0.42, 3.55, -0.3, 0.36, -0.35);
        anyShield(b, 2, -6.1, 0.42, -1.55, 0.1, 0.36, -0.35); anyShield(b, 4, -1.7, 0.42, -6.65, -0.2, 0.36, -0.35);
        [[-8.3, 3.45], [-1.85, 3.3], [-4.9, -1.6]].forEach(function (p) { b.spear(p[0], -0.1, p[1], 2.2, { rx: 0.06, rz: b.j(0.06) }); });
        b.crate(-10.8, 0, -1.0, 0.6, { ry: 0.4 }); b.sack(-11.0, 0, -0.3, 0.42);
        b.crate(-4.3, 0, -10.6, 0.65, { ry: 0.2 }); b.barrel(-3.5, 0, -10.8, { h: 0.85 });
      });

      // ---------------------------------------------------------------- the camp at work
      b.life(function () {
        var g = function (lx, lz) { return gw(lx, 0, lz); };
        // at the gate and on the towers
        var q = g(0.85, 1.7); b.figure(q.x, q.z, { role: 'soldier', pose: 'spear', ry: RYG + 0.15 });
        q = g(-0.8, -1.6); b.figure(q.x, q.z, { role: 'soldier', pose: 'spear', ry: RYG + Math.PI - 0.6 });
        q = g(TX + 0.2, 0.45); b.figure(q.x, q.z, { role: 'archer', pose: 'point', ry: RYG + 0.3, y: TDECK + 0.07 });
        b.push(WX, 0, WZ, RYW); b.figure(0.2, -0.4, { role: 'archer', pose: 'draw', ry: Math.PI + 0.5, y: WDECK + 0.19 }); b.pop();
        // at the map table
        b.figure(PX + 0.25, PZ + 3.25, { role: 'knight', pose: 'warcamp_mark', ry: 0.15, y: DECKY });
        b.figure(PX - 0.55, PZ + 4.75, { role: 'soldier', pose: 'warcamp_lean', ry: Math.PI - 0.15, y: DECKY, team: 'bone' });
        b.figure(PX + 1.15, PZ + 4.6, { role: 'villager', pose: 'talk', ry: -2.6, y: DECKY, c: '#5c5e62' });
        b.figure(3.7, 5.6, { role: 'villager', pose: 'run', ry: -3.06, c: '#3b3a38', y: 0.08 });
        // sparring on the open ground, the captain watching
        b.figure(0.6, 8.2, { role: 'soldier', pose: 'guard', ry: 0.95 });
        b.figure(1.65, 8.95, { role: 'soldier', pose: 'swing', ry: 0.95 + Math.PI, team: 'bone' });
        b.figure(2.3, 7.4, { role: 'knight', pose: 'vigil', ry: -0.78 });
        b.figure(-0.6, 9.4, { role: 'soldier', pose: 'cheer', ry: 0.3 });
        // at the cook fire
        b.figure(F1[0] + 0.62, F1[1] - 0.5, { role: 'villager', pose: 'warcamp_stir', ry: -0.89, c: '#7a5a46' });
        b.figure(F1[0] - 0.2, F1[1] + 1.55, { role: 'soldier', pose: 'warcamp_sit', ry: Math.PI + 0.1 });
        b.figure(F1[0] - 1.45, F1[1] + 0.25, { role: 'soldier', pose: 'warcamp_sit', ry: Math.PI / 2 + 0.3, team: 'bone' });
        b.figure(F1[0] + 1.45, F1[1] + 0.95, { role: 'villager', pose: 'warcamp_sit', ry: -2.0, c: '#5c5e62', y: 0.0 });
        // eating at the mess table
        b.push(-9.0, 0, 6.7, 2.21);
        b.figure(-0.4, 0.66, { role: 'soldier', pose: 'warcamp_sit', ry: Math.PI, team: 'bone' });
        b.figure(0.5, -0.66, { role: 'soldier', pose: 'warcamp_sit', ry: 0 });
        b.figure(-0.55, -0.66, { role: 'villager', pose: 'warcamp_sit', ry: 0.1, c: '#5c5e62' });
        b.pop();
        // the ladle in the pot
        b.beam([F1[0] + 0.35, 1.18, F1[1] - 0.25], [F1[0] + 0.05, 0.75, F1[1] + 0.02], 0.016, { c: 'wood', m: M.wood, round: true, seg: 5 });
        // at the fish spit
        b.figure(F2[0] + 0.0, F2[1] + 1.4, { role: 'villager', pose: 'warcamp_sit', ry: Math.PI - 0.1, c: '#6f6a62' });
        b.figure(F2[0] - 1.25, F2[1] + 0.95, { role: 'soldier', pose: 'talk', ry: 2.2 });
        // the smith and the grinder
        b.figure(SX - 0.5, SZ + 1.45, { role: 'smith', pose: 'hammer', ry: -1.25, c: '#6e5a44' });
        b.figure(SX - 2.6 - 0.55, SZ + 2.1 + 0.3, { role: 'soldier', pose: 'warcamp_grind', ry: 2.07 });
        // hauling stores in from the cart
        b.figure(6.15, 0.95, { role: 'villager', pose: 'carry', ry: -1.45, c: '#8a857c' });
        // along the tent lane
        b.figure(-3.6, 4.95, { role: 'soldier', pose: 'walk', ry: Math.PI / 2, y: 0.08 });
        b.figure(-8.2, 4.2, { role: 'child', pose: 'run', ry: 2.0 });
        // a patrol marching round the outside of the stake bank to the gate
        [[101, 'soldier', 'walk', 0], [106.5, 'soldier', 'walk', 1], [112, 'soldier', 'walk', 0], [117.5, 'archer', 'walk', 1]].forEach(function (p) {
          var a = p[0] * DEG, rr = 14.75; b.figure(Math.cos(a) * rr, Math.sin(a) * rr, { role: p[1], pose: p[2], ry: Math.atan2(Math.sin(a), -Math.cos(a)), team: p[3] ? 'bone' : undefined });
        });
        // cutting stakes
        b.figure(-1.35, 5.4, { role: 'villager', pose: 'warcamp_chop', ry: 0.0, c: '#4a4c50' });
        b.push(-1.35, 0, 5.4, 0); b.beam([0.0, 1.82, 0.0], [0.05, 1.5, 0.55], 0.025, { c: 'wood', m: M.wood, round: true, seg: 5 }); b.box(0.05, 1.82, 0.0, 0.04, 0.18, 0.2, { c: 'iron', m: M.metal, bevel: 0.01, rx: 0.5 }); b.pop();
      });
      wisp(b, F1[0] + 0.05, 1.05, F1[1], 1.25);
      wisp(b, F2[0], 1.1, F2[1], 1.15);
    }
  });
})();
