// Command tent: a long two-pole marquee striped ink and bone on a plank deck raised on stone pads, its front flap
// raised on carved posts over the map table, dragon heads carved on the pole tops, a small round annex for the
// chieftain, war banners with the dragon crest, a war horn, a rail of round shields, a cook fire, a messenger perch
// and, out in the sun, a sand table of the coast with carved dragons and the enemy fleet on it.
// Built pads first, the deck plank by plank, the poles, the walls and roof gore by gore, the porch, the annex, then
// the banners, the tables, the stores, and last the people.
(function () {
  var T = THREE;
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  var INK = '#1f1e1c', BONE = '#efebe4', HEMP = '#6e6253', GRIME = new T.Color('#8a7d69');

  // a planner leaning over a table on both hands, and one pointing down at it
  KIT.people.poses.tentLean = function (r) { return { feet: [V(-0.15, 0.09, -0.06), V(0.15, 0.09, -0.14)], hands: [V(-0.27, 0.86, 0.47), V(0.25, 0.86, 0.44)], lean: 0.42, twist: r(0.08), side: 0, hip: 0, drop: 0.03, head: [r(0.2), 0.4], pole: [V(-0.8, -0.1, -0.4), V(0.8, -0.1, -0.4)] }; };
  KIT.people.poses.tentPoint = function (r) { return { feet: [V(-0.14, 0.09, 0.1), V(0.14, 0.09, -0.08)], hands: [V(-0.22, 1.04, 0.6), V(0.27, 0.9, 0.1)], lean: 0.2, twist: 0.1, side: 0.02, hip: 0.02, drop: 0.02, head: [0.1, 0.38], pole: [V(-0.6, -0.5, -0.4), V(0.7, -0.4, -0.3)] }; };

  // a sheet of cloth through F(u, v) -> [x, y, z], normals turned toward out
  function tentSheet(b, F, nu, nv, o) {
    var g = new T.PlaneGeometry(1, 1, nu, nv), p = g.attributes.position;
    for (var i = 0; i < p.count; i++) { var q = F(p.getX(i) + 0.5, p.getY(i) + 0.5); p.setXYZ(i, q[0], q[1], q[2]); }
    g.computeVertexNormals();
    if (o.out) {
      var n = g.attributes.normal, k = Math.floor(n.count / 2) + 1, d = n.getX(k) * o.out[0] + n.getY(k) * o.out[1] + n.getZ(k) * o.out[2];
      if (d < 0) {
        // turn the sheet over: normals and winding together, so both faces still light correctly
        for (var j = 0; j < n.count; j++) n.setXYZ(j, -n.getX(j), -n.getY(j), -n.getZ(j));
        var ix = g.index; for (var t = 0; t < ix.count; t += 3) { var i1 = ix.getX(t + 1); ix.setX(t + 1, ix.getX(t + 2)); ix.setX(t + 2, i1); }
      }
    }
    b.addGeo(g, { c: o.c, m: KIT.M.cloth, bucket: 'cloth', ao: o.ao === undefined ? 0.2 : o.ao, jit: o.jit === undefined ? 0.015 : o.jit, vary: 0.05, sway: o.sway || 0, swayFn: o.swayFn, colors: o.colors });
  }

  // A marquee's plan: a stadium (two half rounds joined by straight sides along x; ls = 0 makes a round pavilion),
  // centre (cx, cz), floor at dy, eaves wh up, ridge rh above them. u runs round the eave from the front middle toward +x.
  function tentShape(cx, cz, ls, rr, dy, wh, rh, np) {
    var per = 2 * ls + 2 * Math.PI * rr;
    var S = { cx: cx, cz: cz, ls: ls, rr: rr, dy: dy, wh: wh, rh: rh, top: dy + wh + rh, per: per, np: np, pw: per / np };
    S.eave = function (u) {
      u = ((u % per) + per) % per; var a = ls / 2, arc = Math.PI * rr, th;
      if (u < a) return [cx + u, cz + rr, 0, 1]; u -= a;
      if (u < arc) { th = Math.PI / 2 - u / rr; return [cx + ls / 2 + rr * Math.cos(th), cz + rr * Math.sin(th), Math.cos(th), Math.sin(th)]; } u -= arc;
      if (u < ls) return [cx + ls / 2 - u, cz - rr, 0, -1]; u -= ls;
      if (u < arc) { th = -Math.PI / 2 - u / rr; return [cx - ls / 2 + rr * Math.cos(th), cz + rr * Math.sin(th), Math.cos(th), Math.sin(th)]; } u -= arc;
      return [cx - ls / 2 + u, cz + rr, 0, 1];
    };
    S.ridge = function (x) { return [cx + Math.max(-ls / 2, Math.min(ls / 2, x - cx)), cz]; };
    // a point on the roof: k along the eave, v from the eave (0) to the ridge (1)
    S.roof = function (u, v, sag) {
      var e = S.eave(u), rg = S.ridge(e[0]), vv = Math.min(v, 0.985), ex = rg[0] + (e[0] - rg[0]) * 1.06, ez = rg[1] + (e[1] - rg[1]) * 1.06;
      return [ex + (rg[0] - ex) * vv, dy + wh - 0.06 + (rh + 0.06) * Math.pow(v, 0.92) - (sag || 0), ez + (rg[1] - ez) * vv];
    };
    S.u0 = function (k) { return (k - 0.5) * S.pw; };
    return S;
  }
  function tentWall(b, S, k, c) {
    var u0 = S.u0(k), u1 = u0 + S.pw, em = S.eave(u0 + S.pw / 2);
    tentSheet(b, function (u, v) { var e = S.eave(u0 + S.pw * u), bul = Math.sin(u * Math.PI) * 0.05 * (1 - v) + 0.02; return [e[0] + e[2] * bul, S.dy + 0.01 + v * (S.wh - 0.03), e[1] + e[3] * bul]; }, 3, 3, {
      c: c, out: [em[2], 0, em[3]], ao: 0.35,
      // weathered and splashed along the hem
      colors: c === BONE ? function (x, y) { var t = Math.max(0, 1 - (y - S.dy) / 0.7); return new T.Color(c).lerp(GRIME, t * t * 0.55); } : undefined
    });
    // the hem rope along the foot, a seam rope up the panel's edge
    var a = S.eave(u0), bb = S.eave(u1);
    b.beam([a[0] + a[2] * 0.045, S.dy + 0.05, a[1] + a[3] * 0.045], [bb[0] + bb[2] * 0.045, S.dy + 0.05, bb[1] + bb[3] * 0.045], 0.024, { c: 'rope', m: KIT.M.rope, round: true, seg: 4 });
    b.beam([a[0] + a[2] * 0.03, S.dy + 0.05, a[1] + a[3] * 0.03], [a[0] + a[2] * 0.03, S.dy + S.wh - 0.05, a[1] + a[3] * 0.03], 0.012, { c: HEMP, m: KIT.M.rope, round: true, seg: 4 });
  }
  function tentGore(b, S, k, c) {
    var u0 = S.u0(k);
    tentSheet(b, function (u, v) { return S.roof(u0 + S.pw * u, v, Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.1); }, 3, 7, { c: c, out: [0, 1, 0], ao: 0.12 });
    // the seam rope up the gore's edge, where the cloth is pulled tight
    var prev = null;
    for (var i = 0; i <= 5; i++) { var p = S.roof(u0, i / 5 * 0.97, 0); p[1] += 0.022; if (prev) b.beam(prev, p, 0.019, { c: '#4a4238', m: KIT.M.rope, round: true, seg: 4 }); prev = p; }
  }
  function tentValance(b, S, k, c, drop) {
    var u0 = S.u0(k), em = S.eave(u0 + S.pw / 2);
    tentSheet(b, function (u, v) { var e = S.eave(u0 + S.pw * u), rg = S.ridge(e[0]), cut = Math.sin(u * Math.PI) * 0.55 + 0.45; return [rg[0] + (e[0] - rg[0]) * 1.065, S.dy + S.wh - 0.04 - drop * (1 - v) * cut, rg[1] + (e[1] - rg[1]) * 1.065]; }, 4, 1, { c: c, out: [em[2], 0, em[3]], ao: 0.05, sway: 0.25, swayFn: function () { return 1; } });
  }

  // a carved dragon head in profile (XY plane, snout toward +x), neck foot at (x, y, z), s tall
  var TENT_HEAD = [[-0.12, 0], [-0.16, 0.25], [-0.14, 0.5], [-0.08, 0.7], [-0.22, 0.93], [-0.02, 0.86], [-0.13, 1.1], [0.06, 0.96], [0.2, 1.0], [0.36, 0.98], [0.58, 0.9], [0.63, 0.85],
    [0.44, 0.82], [0.57, 0.74], [0.53, 0.7], [0.34, 0.72], [0.18, 0.66], [0.1, 0.5], [0.08, 0.25], [0.1, 0]];
  function tentDragon(b, x, y, z, ry, s, o) {
    o = o || {}; var M = KIT.M, c = o.c || 'beam';
    b.push(x, y, z, ry);
    b.extrude(0, 0, 0, TENT_HEAD.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.13 * s, { c: c, m: M.wood, ao: 0.1, bevel: 0.012 * s });
    [[[-0.15, 0.28], [-0.32, 0.4], [-0.15, 0.46]], [[-0.13, 0.5], [-0.3, 0.64], [-0.1, 0.65]]].forEach(function (f) {
      b.extrude(0, 0, 0, f.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.06 * s, { c: c, m: M.wood, ao: 0.05, bevel: 0.006 * s });
    });
    [1, -1].forEach(function (sd) {
      b.ball(0.3 * s, 0.9 * s, sd * 0.078 * s, 0.032 * s, { c: 'bone', m: M.paint, ao: 0, detail: 0 });
      b.box(0.28 * s, 0.94 * s, sd * 0.075 * s, 0.16 * s, 0.03 * s, 0.03 * s, { c: c, m: M.wood, bevel: 0.004, rz: -0.2 });
    });
    b.box(0, -0.04 * s, 0, 0.32 * s, 0.08 * s, 0.2 * s, { c: c, m: M.wood, bevel: 0.01 });
    b.pop();
  }

  // the town's crest, a dragon seen from below with its wings spread, on both faces of a cloth at (x, y, z)
  var TENT_CREST = [[0, 0.48], [0.05, 0.38], [0.06, 0.24], [0.2, 0.3], [0.36, 0.37], [0.5, 0.34], [0.42, 0.22], [0.36, 0.08], [0.28, 0.13], [0.22, 0.0], [0.14, 0.05], [0.07, -0.06], [0.045, -0.25], [0.025, -0.38], [0.09, -0.48], [0, -0.43],
    [-0.09, -0.48], [-0.025, -0.38], [-0.045, -0.25], [-0.07, -0.06], [-0.14, 0.05], [-0.22, 0.0], [-0.28, 0.13], [-0.36, 0.08], [-0.42, 0.22], [-0.5, 0.34], [-0.36, 0.37], [-0.2, 0.3], [-0.06, 0.24], [-0.05, 0.38]];
  function tentCrest(b, x, y, z, s, ec, dz) {
    var pts = TENT_CREST.map(function (p) { return [p[0] * s, p[1] * s]; });
    [dz || 0.03, -(dz || 0.03)].forEach(function (d) { b.addGeo(KIT.geo.extrude(pts, 0.006), { x: x, y: y, z: z + d, c: ec, m: KIT.M.cloth, bucket: 'cloth', ao: 0, jit: 0.01, vary: 0.02 }); });
  }

  // a round shield facing +z, painted in quarters when c2 is given
  function tentShield(b, x, y, z, o) {
    var M = KIT.M, s = o.s || 0.8, r = 0.42 * s * 0.97;
    b.push(x, y, z, o.ry || 0);
    if (o.rx) b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(o.rx));
    b.shield(0, 0, 0, { kind: 'round', c: o.c1 || 'ink', s: s });
    if (o.c2) [0, Math.PI].forEach(function (a0) {
      var pts = [[0, 0]]; for (var i = 0; i <= 8; i++) { var a = a0 + Math.PI / 4 + i / 8 * Math.PI / 2; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      b.extrude(0, 0, 0.053, pts, 0.006, { c: o.c2, m: M.paint, ao: 0, jit: 0.01 });
    });
    b.pop();
  }

  // a carved dragon token for the sand table: a body in profile, wings raised in a V, on a round foot; facing +x
  function tentToken(b, x, y, z, ry, s, c) {
    var M = KIT.M;
    b.push(x, y, z, ry);
    b.cyl(0, 0, 0, 0.07 * s, 0.03 * s, { c: 'woodDark', m: M.wood, seg: 10 });
    var body = [[-0.2, 0.07], [-0.1, 0.085], [0.0, 0.08], [0.07, 0.1], [0.11, 0.15], [0.16, 0.165], [0.19, 0.15], [0.12, 0.12], [0.08, 0.065], [0.03, 0.04], [0.02, 0.025], [-0.02, 0.025], [-0.04, 0.05], [-0.12, 0.06]];
    b.extrude(0, 0.005 * s, 0, body.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.045 * s, { c: c, m: M.paint, ao: 0.1, bevel: 0.004 * s });
    [1, -1].forEach(function (sd) {
      b.extrude(0, 0.08 * s, sd * 0.012 * s, [[-0.07 * s, 0], [0.06 * s, 0], [-0.04 * s, 0.17 * s], [-0.07 * s, 0.1 * s]], 0.008 * s, { c: c, m: M.paint, ao: 0, rx: sd * 1.0, bevel: 0.002 });
    });
    b.pop();
  }

  // a small A-frame tent along x, striped in gores from the ridge down, closed at +x, its door at -x tied open
  function tentRidge(b, x, z, ry, L, W, H, n) {
    var M = KIT.M;
    b.push(x, 0, z, ry);
    [-1, 1].forEach(function (e) { b.post(e * L / 2, 0, 0, 0.045, H + 0.22, { c: 'woodDark' }); });
    b.beam([-L / 2 - 0.12, H + 0.03, 0], [L / 2 + 0.12, H + 0.03, 0], 0.035, { c: 'woodDark', round: true });
    [-1, 1].forEach(function (sd) {
      for (var i = 0; i < n; i++) (function (i) {
        tentSheet(b, function (u, v) { var t = (i + u) / n, sag = Math.sin(t * Math.PI) * Math.sin(v * Math.PI) * 0.07; return [-L / 2 + t * L, (H - 0.01) * (1 - v) + 0.02 - sag * 0.5, sd * (W / 2 * v - sag * 0.6)]; }, 2, 3, { c: i % 2 ? INK : BONE, out: [0, 0.6, sd], ao: 0.25 });
      })(i);
      // hem rope and pegs along the foot
      b.beam([-L / 2, 0.04, sd * W / 2], [L / 2, 0.04, sd * W / 2], 0.018, { c: 'rope', m: M.rope, round: true, seg: 4 });
      [-0.42, 0, 0.42].forEach(function (f) { b.post(f * L, -0.05, sd * (W / 2 + 0.12), 0.025, 0.2, { c: 'woodLight' }); });
    });
    // the closed end, and the shade inside the open door
    b.extrude(L / 2 - 0.01, 0, 0, [[-W / 2, 0], [W / 2, 0], [0, H]], 0.02, { c: BONE, m: M.cloth, ry: Math.PI / 2, bucket: 'cloth' });
    b.extrude(L / 2 - 0.05, 0, 0, [[-W * 0.36, 0], [W * 0.36, 0], [0, H * 0.78]], 0.02, { c: INK, m: M.cloth, ry: Math.PI / 2, bucket: 'cloth' });
    b.extrude(-L / 2 + 0.25, 0.01, 0, [[-W * 0.44, 0], [W * 0.44, 0], [0, H * 0.85]], 0.02, { c: '#1c1b1a', m: M.dark, ry: Math.PI / 2, ao: 0 });
    b.box(-L / 2 + 0.5, 0.01, 0, 0.7, 0.04, W * 0.6, { c: '#4a3e34', m: M.hair, bevel: 0.01, ao: 0 });
    // the door flaps, folded back to the sides and tied
    [-1, 1].forEach(function (sd) {
      var A = [-L / 2 - 0.01, H - 0.04, sd * 0.03], B2 = [-L / 2 - 0.01, 0.03, sd * W / 2], C = [-L / 2 - 0.1, 0.5, sd * W * 0.3];
      tentSheet(b, function (u, v) { var p = [C[0] + (B2[0] - C[0]) * u, C[1] + (B2[1] - C[1]) * u, C[2] + (B2[2] - C[2]) * u]; return [A[0] + (p[0] - A[0]) * v, A[1] + (p[1] - A[1]) * v, A[2] + (p[2] - A[2]) * v]; }, 2, 3, { c: sd > 0 ? BONE : INK, out: [-1, 0, 0], ao: 0.15 });
      b.ball(C[0] - 0.01, C[1], C[2], 0.045, { c: 'rope', m: M.rope, detail: 0 });
    });
    // guy ropes off the ridge ends
    [-1, 1].forEach(function (e) { var px = e * (L / 2 + 0.95); b.beam([e * (L / 2 + 0.1), H + 0.03, 0], [px, 0.12, 0], 0.012, { c: 'rope', m: M.rope, round: true, seg: 4 }); b.post(px, -0.05, 0, 0.03, 0.26, { c: 'woodLight', rz: -e * 0.2 }); });
    b.pop();
  }

  KIT.defineBuild('tent', {
    name: 'Command tent', size: 'middle', need: 28,
    line: 'A striped black and bone command pavilion with a map table under its raised flap, war banners, and a sand table of carved dragons.',
    r: 11.8, flat: [16.4, 11.2], ground: 'grass', path: [[0.9, 12.6], [0.3, 5.5]],
    frameY: 2.5, frameR: 10.4, glowAt: [1.9, 7.9, -1.3],
    trees: [{ x: -4.6, z: -8.6, kind: 'pine', h: 8.4 }, { x: 9.7, z: -3.0, kind: 'round', h: 5.6 }, { x: -9.9, z: 3.0, kind: 'olive', h: 4.4 }, { x: 10.1, z: 1.4, kind: 'cypress', h: 7.4 }],
    bushes: [{ x: 8.0, z: 5.6, r: 0.85, flowers: '#f3f1ec' }, { x: -8.1, z: 7.1, r: 0.8 }, { x: -9.4, z: -2.6, r: 0.7 }],
    perches: [{ x: 7.0, y: 3.5, z: -2.6, ry: 0 }, { x: -6.3, y: 0, z: 7.3, ry: 0.7 }, { x: 8.0, y: 0, z: 3.2, ry: -1.9 }],
    build: function (b) {
      var M = KIT.M, gh = function (x, z) { return b.ground ? b.ground.height(x, z) : 0; };
      var DY = 0.42, TZ = -1.3, LS = 3.8, RR = 3.0, WH = 2.6, RH = 3.4;
      var X0 = -5.45, X1 = 5.45, Z0 = -4.8, Z1 = 2.15, PX = 2.1, PZ1 = 4.65;
      var S = tentShape(0, TZ, LS, RR, DY, WH, RH, 36), TOP = S.top;
      var BONES = ['#efebe4', '#e9e4da', '#f2efe9', '#ebe6dd'], INKS = ['#1f1e1c', '#262523', '#1c1b1a'];
      function stripe(k) { var m = ((k % 2) + 2) % 2, h = ((k * 7 + 3) % 4 + 4) % 4; return m ? BONES[h] : INKS[h % 3]; }
      var isDoor = function (k) { return k >= -1 && k <= 1; };
      var DOOR = 1.5 * S.pw;
      var ks = []; for (var k = -17; k < 19; k++) ks.push(k);

      b.part('Stone pads');
      var padX = [-5.2, -3.1, -1.05, 1.05, 3.1, 5.2], padZ = [-4.55, -2.4, -0.25, 1.9];
      var pads = [];
      padZ.forEach(function (z) { padX.forEach(function (x) { pads.push([x, z]); }); });
      [3.25, 4.4].forEach(function (z) { [-1.85, 0, 1.85].forEach(function (x) { pads.push([x, z]); }); });
      [0, 1].forEach(function (h) {
        b.unit(function () { pads.forEach(function (p, i) { if (i % 2 !== h) return; b.box(p[0] + b.j(0.04), -0.12, p[1] + b.j(0.04), 0.5 + b.j(0.05), 0.3, 0.5 + b.j(0.05), { c: b.stoneC('stone', 0.1), m: M.stone, bevel: 0.06, ry: b.j(0.2) }); }); });
      });

      b.part('Deck frame');
      b.unit(function () {
        padZ.forEach(function (z) { b.box(0, 0.18, z, X1 - X0 - 0.1, 0.1, 0.18, { c: 'wood', m: M.wood, bevel: 0.02 }); });
        [3.25, 4.4].forEach(function (z) { b.box(0, 0.18, z, 2 * PX - 0.1, 0.1, 0.18, { c: 'wood', m: M.wood, bevel: 0.02 }); });
      });
      b.unit(function () {
        for (var x = X0 + 0.15; x <= X1 - 0.1; x += 0.66) b.box(x, 0.28, (Z0 + Z1) / 2, 0.1, 0.08, Z1 - Z0 - 0.08, { c: 'woodDark', m: M.wood, bevel: 0.015 });
        for (var x2 = -PX + 0.15; x2 <= PX - 0.1; x2 += 0.64) b.box(x2, 0.28, (Z1 + PZ1) / 2 - 0.05, 0.1, 0.08, PZ1 - Z1 + 0.1, { c: 'woodDark', m: M.wood, bevel: 0.015 });
      });

      b.part('Deck planks');
      var BOARD = ['#a8957c', '#9d8a72', '#b29f86', '#958169', '#a39077', '#8c7963'];
      function boards(xa, xb, z, w) {
        var x = xa, first = true;
        while (x < xb - 0.05) {
          var L = first ? 0.5 + b.rand() * 1.8 : 1.7 + b.rand() * 1.6; first = false;
          if (xb - (x + L) < 0.6) L = xb - x;
          b.box(x + L / 2, DY - 0.06, z + b.j(0.006), L - 0.03, 0.06 + b.j(0.004), w - 0.028, { c: b.pick(BOARD), m: M.wood, bevel: 0.012, ao: 0.12 });
          b.ball(x + 0.1, DY + 0.001, z - w * 0.25, 0.014, { c: 'iron', m: M.metal, detail: 0, ao: 0 }); b.ball(x + 0.1, DY + 0.001, z + w * 0.25, 0.014, { c: 'iron', m: M.metal, detail: 0, ao: 0 });
          x += L;
        }
      }
      var nb = Math.round((Z1 - Z0) / 0.285), bw = (Z1 - Z0) / nb;
      for (var r0 = 0; r0 < nb; r0 += 3) (function (r0) { b.unit(function () { for (var r = r0; r < Math.min(nb, r0 + 3); r++) boards(X0, X1, Z0 + (r + 0.5) * bw, bw); }); })(r0);
      var npb = Math.round((PZ1 - Z1) / 0.285), pbw = (PZ1 - Z1) / npb;
      for (var r1 = 0; r1 < npb; r1 += 3) (function (r1) { b.unit(function () { for (var r = r1; r < Math.min(npb, r1 + 3); r++) boards(-PX, PX, Z1 + (r + 0.5) * pbw, pbw); }); })(r1);
      b.unit(function () {
        // fascia boards round the edge, and the steps down from the porch
        var fc = { c: 'wood', m: M.wood, bevel: 0.015 };
        b.box(0, 0.1, Z0 - 0.03, X1 - X0 + 0.08, 0.32, 0.06, fc);
        b.box(X0 - 0.03, 0.1, (Z0 + Z1) / 2, 0.06, 0.32, Z1 - Z0 + 0.06, fc); b.box(X1 + 0.03, 0.1, (Z0 + Z1) / 2, 0.06, 0.32, Z1 - Z0 + 0.06, fc);
        [-1, 1].forEach(function (s) { b.box(s * (PX + X1) / 2, 0.1, Z1 + 0.03, X1 - PX, 0.32, 0.06, fc); b.box(s * (PX + 0.03), 0.1, (Z1 + PZ1) / 2, 0.06, 0.32, PZ1 - Z1, fc); });
        b.box(0, 0.1, PZ1 + 0.03, 2 * PX + 0.06, 0.32, 0.06, fc);
        [[0.28, 0.36], [0.14, 0.72]].forEach(function (st) { for (var k = 0; k < 2; k++) b.box(0, 0, PZ1 + st[1] - 0.18 + k * 0.17 - 0.09, 2.2, st[0], 0.16, { c: b.pick(BOARD), m: M.wood, bevel: 0.012 }); });
        [-1.12, 1.12].forEach(function (x) { b.box(x, 0, PZ1 + 0.36, 0.08, 0.32, 0.72, { c: 'woodDark', m: M.wood, bevel: 0.015 }); });
      });

      b.part('Tent poles');
      b.unit(function () {
        [-1, 1].forEach(function (s) {
          b.log(s * LS / 2, DY, TZ, 0.11, TOP - DY + 0.55, { c: 'woodDark', r2: 0.09 });
          b.box(s * LS / 2, DY, TZ, 0.5, 0.12, 0.5, { c: 'beam', m: M.wood, bevel: 0.02 });
        });
        b.beam([-LS / 2, TOP - 0.08, TZ], [LS / 2, TOP - 0.08, TZ], 0.07, { c: 'woodDark', round: true });
        // the door frame
        [-1, 1].forEach(function (s) { var e = S.eave(s * DOOR); b.post(e[0], DY, e[1] - 0.06, 0.06, WH, { c: 'beam' }); });
        b.beam([-DOOR - 0.08, DY + WH - 0.06, TZ + RR - 0.06], [DOOR + 0.08, DY + WH - 0.06, TZ + RR - 0.06], 0.06, { c: 'beam' });
      });

      b.part('Tent walls');
      for (var w0 = 0; w0 < ks.length; w0 += 4) (function (w0) { b.unit(function () { for (var i = w0; i < Math.min(ks.length, w0 + 4); i++) if (!isDoor(ks[i])) tentWall(b, S, ks[i], stripe(ks[i])); }); })(w0);
      b.unit(function () {
        // the door curtains, rolled up and tied either side
        [-1, 1].forEach(function (s) {
          var e = S.eave(s * DOOR);
          b.cyl(e[0] + s * 0.12, DY + 0.75, e[1] + 0.12, 0.1, WH - 0.85, { c: stripe(s * 2), m: M.cloth, seg: 9, ao: 0.2 });
          [DY + 1.0, DY + 2.1].forEach(function (y) { b.cyl(e[0] + s * 0.12, y, e[1] + 0.12, 0.112, 0.05, { c: 'rope', m: M.rope, seg: 9 }); });
        });
      });

      b.part('Tent roof');
      for (var g0 = 0; g0 < ks.length; g0 += 4) (function (g0) { b.unit(function () { for (var i = g0; i < Math.min(ks.length, g0 + 4); i++) tentGore(b, S, ks[i], stripe(ks[i])); }); })(g0);
      b.unit(function () {
        // a hide ridge cap and a crown of hide round each pole
        b.beam([-LS / 2, TOP + 0.01, TZ], [LS / 2, TOP + 0.01, TZ], 0.075, { c: '#2a2724', m: M.cloth, round: true, seg: 8 });
        [-1, 1].forEach(function (s) {
          b.lathe(s * LS / 2, TOP - 0.22, TZ, [[0.42, 0], [0.3, 0.14], [0.17, 0.28], [0.12, 0.34]], { c: '#2a2724', m: M.cloth, seg: 14 });
          b.cyl(s * LS / 2, TOP + 0.08, TZ, 0.13, 0.06, { c: 'rope', m: M.rope, seg: 10 });
        });
      });
      b.unit(function () { ks.forEach(function (k) { tentValance(b, S, k, stripe(k + 1), 0.42); }); });

      b.part('Dragon finials');
      b.unit(function () {
        tentDragon(b, LS / 2, TOP + 0.5, TZ, -0.45, 1.0, {});
        tentDragon(b, -LS / 2, TOP + 0.5, TZ, Math.PI - 0.45, 1.0, {});
        // a small ember pennant streaming from a staff lashed behind the right head
        b.flag(LS / 2, TOP - 0.05, TZ - 0.15, 1.75, 1.0, 0.32, { c: 'ember', pennant: true, pr: 0.025, ry: -0.5 });
      });

      b.part('Guy ropes');
      b.unit(function () {
        for (var k2 = -17; k2 < 19; k2 += 3) {
          var u = S.u0(k2), uu = ((u % S.per) + S.per) % S.per;
          if (uu < 2.4 || uu > S.per - 2.4) continue;
          var e = S.eave(u), rf = S.roof(u, 0, 0);
          // out past the deck's edge
          var tx = e[2] > 0.01 ? (X1 - e[0]) / e[2] : e[2] < -0.01 ? (X0 - e[0]) / e[2] : 1e9, tz = e[3] > 0.01 ? (Z1 - e[1]) / e[3] : e[3] < -0.01 ? (Z0 - e[1]) / e[3] : 1e9;
          var t = Math.max(1.5, Math.min(tx, tz) + 0.45), px = e[0] + e[2] * t, pz = e[1] + e[3] * t, py = gh(px, pz);
          if (px < -5.3 && pz < -1.5) continue; // the annex stands there
          b.beam([rf[0], rf[1] - 0.06, rf[2]], [px, py + 0.2, pz], 0.012, { c: 'rope', m: M.rope, round: true, seg: 4 });
          b.post(px, py - 0.05, pz, 0.035, 0.3, { c: 'woodLight', rz: 0.15 });
        }
      });

      b.part('Porch');
      var CZ0 = TZ + RR - 0.25, CZ1 = 3.95, CX = 1.78, CY1 = DY + 2.25;
      var CY0 = S.roof(0, (TZ + RR * 1.06 - CZ0) / (RR * 1.06), 0)[1] + 0.03;
      b.unit(function () {
        [-1, 1].forEach(function (s) {
          // stave posts carved with bands, a dragon head atop
          var px = s * CX;
          b.post(px, DY, CZ1, 0.08, CY1 - DY + 0.05, { c: 'beam' });
          [0.35, 1.25, 2.1].forEach(function (y) { b.box(px, DY + y, CZ1, 0.2, 0.06, 0.2, { c: 'woodDark', m: M.wood, bevel: 0.02 }); });
          tentDragon(b, px, CY1 + 0.06, CZ1, s > 0 ? -0.45 : Math.PI - 0.45, 0.55, {});
          // a lantern on an iron arm
          b.beam([px, DY + 1.85, CZ1 + 0.06], [px, DY + 1.85, CZ1 + 0.42], 0.018, { c: 'iron', m: M.metal });
          b.cyl(px, DY + 1.5, CZ1 + 0.42, 0.09, 0.3, { c: 'iron', m: M.metal, seg: 6, open: true });
          b.cone(px, DY + 1.8, CZ1 + 0.42, 0.12, 0.12, { c: 'iron', m: M.metal, seg: 6 });
          b.flame(px, DY + 1.55, CZ1 + 0.42, 0.26, { i: 0.7 });
          // guy ropes out to the grass
          var gx = s * 2.6, gz = 5.35;
          b.beam([px, CY1 + 0.02, CZ1], [gx, gh(gx, gz) + 0.18, gz], 0.012, { c: 'rope', m: M.rope, round: true, seg: 4 });
          b.post(gx, gh(gx, gz) - 0.05, gz, 0.035, 0.3, { c: 'woodLight' });
        });
      });
      b.unit(function () {
        // the raised door flap: seven stripes on a slope from the roof out to the posts, a scalloped hem
        var n = 7, W2 = 2 * CX + 0.24;
        for (var i = 0; i < n; i++) (function (i) {
          var xa = -CX - 0.12 + i * W2 / n, xb = xa + W2 / n;
          tentSheet(b, function (u, v) {
            var x = xa + (xb - xa) * u, U2 = (x + CX + 0.12) / W2, sag = Math.sin(U2 * Math.PI) * Math.sin(v * Math.PI) * 0.1 + Math.sin(U2 * Math.PI * n) * 0.02 * v;
            return [x, CY0 + (CY1 - CY0) * v - sag, CZ0 + (CZ1 - CZ0) * v];
          }, 2, 5, { c: i % 2 ? INK : BONE, out: [0, 1, 0], ao: 0.1, sway: 0.3, swayFn: function () { return 0.4; } });
        })(i);
        for (var q = 0; q < 8; q++) (function (q) {
          var xa = -CX - 0.12 + q * W2 / 8, xb = xa + W2 / 8;
          tentSheet(b, function (u, v) { var cut = Math.sin(u * Math.PI) * 0.55 + 0.45; return [xa + (xb - xa) * u, CY1 - 0.02 - 0.28 * (1 - v) * cut, CZ1 + 0.02]; }, 3, 1, { c: q % 2 ? INK : BONE, out: [0, 0, 1], ao: 0.05, sway: 0.3, swayFn: function () { return 1; } });
        })(q);
        b.beam([-CX - 0.15, CY1 + 0.02, CZ1], [CX + 0.15, CY1 + 0.02, CZ1], 0.04, { c: 'woodDark', round: true });
      });

      b.part('Chieftain\'s annex');
      // a small round pavilion off the left end, on its own ring of planks
      var A = tentShape(-7.0, -3.3, 0, 1.65, 0.12, 2.1, 2.3, 16);
      b.unit(function () {
        for (var i = 0; i < 14; i++) { var a = i / 14 * Math.PI * 2; b.box(A.cx + Math.cos(a) * 1.25, -0.1, A.cz + Math.sin(a) * 1.25, 0.32, 0.22, 0.32, { c: b.stoneC('stoneDark', 0.1), m: M.stone, bevel: 0.05, ry: a }); }
        b.cyl(A.cx, 0.0, A.cz, 1.85, 0.12, { c: 'wood', m: M.wood, seg: 16, flat: true });
        for (var j = 0; j < 7; j++) b.box(A.cx - 1.6 + j * 0.53, 0.115, A.cz, 0.5, 0.012, 2.4 + (j % 3) * 0.3, { c: b.pick(BOARD), m: M.wood, bevel: 0.006 });
        b.log(A.cx, A.dy, A.cz, 0.09, A.top - A.dy + 0.4, { c: 'woodDark', r2: 0.07 });
      });
      var aks = []; for (var ak = 0; ak < 16; ak++) aks.push(ak);
      b.unit(function () { aks.forEach(function (k) { if (k === 0) return; tentWall(b, A, k, stripe(k)); }); });
      b.unit(function () { aks.forEach(function (k) { tentGore(b, A, k, stripe(k)); }); });
      b.unit(function () {
        aks.forEach(function (k) { tentValance(b, A, k, stripe(k + 1), 0.32); });
        b.lathe(A.cx, A.top - 0.15, A.cz, [[0.3, 0], [0.18, 0.14], [0.1, 0.24]], { c: '#2a2724', m: M.cloth, seg: 12 });
        b.ball(A.cx, A.top + 0.42, A.cz, 0.1, { c: 'iron', m: M.metal });
        // a hide curtain across its door, half drawn
        var e = A.eave(0);
        tentSheet(b, function (u, v) { return [e[0] - 0.36 + u * 0.55, A.dy + 0.02 + v * (A.wh - 0.08), e[1] + 0.03 + Math.sin(u * Math.PI * 3) * 0.03]; }, 4, 2, { c: '#5a4a3c', out: [0, 0, 1], ao: 0.2 });
        for (var k3 = 0; k3 < 8; k3++) {
          var u3 = A.u0(k3 * 2 + 1), e3 = A.eave(u3), rf = A.roof(u3, 0, 0), pt = 1.1, px = e3[0] + e3[2] * pt, pz = e3[1] + e3[3] * pt;
          if (px > -5.4) continue;
          b.beam([rf[0], rf[1] - 0.06, rf[2]], [px, gh(px, pz) + 0.18, pz], 0.011, { c: 'rope', m: M.rope, round: true, seg: 4 });
          b.post(px, gh(px, pz) - 0.05, pz, 0.03, 0.26, { c: 'woodLight' });
        }
      });

      b.part('War banners');
      function bannerPole(x, z, ph, bw, bh, o) {
        var y0 = o.deck ? DY : gh(x, z);
        b.log(x, y0 - 0.05, z, 0.075, ph, { c: 'woodDark', r2: 0.06 });
        if (o.deck) { b.box(x, y0, z, 0.3, 0.3, 0.3, { c: 'beam', m: M.wood, bevel: 0.03 }); [0.08, 0.24].forEach(function (yy) { b.box(x, y0 + yy, z, 0.32, 0.04, 0.32, { c: 'iron', m: M.metal, bevel: 0.01 }); }); }
        else {
          [0, Math.PI / 2].forEach(function (a) { b.box(x, y0, z, 0.9, 0.1, 0.12, { ry: a + 0.3, c: 'beam', m: M.wood, bevel: 0.02 }); });
          for (var k = 0; k < 4; k++) { var a = k / 4 * Math.PI * 2 + 0.7; b.rock(x + Math.cos(a) * 0.42, y0 + 0.05, z + Math.sin(a) * 0.42, 0.16); }
        }
        if (!o.head) b.extrude(x, y0 + ph - 0.06, z, [[-0.06, 0], [0.06, 0], [0, 0.34]], 0.03, { c: 'iron', m: M.metal });
        b.banner(x, y0 + ph - 0.5, z + 0.09, bw, bh, { c: o.c, emblem: 'none', tail: 'swallow', band: o.band, bandAt: 0.8, bandH: 0.04, trim: 'iron', ry: 0 });
        b.push(x, y0 + ph - 0.5, z + 0.09, 0); tentCrest(b, 0, -bh * 0.4, 0, bw * 0.78, o.ec); b.pop();
      }
      b.unit(function () { bannerPole(-2.6, 1.98, 4.9, 0.95, 2.1, { c: 'ink', ec: '#f1eee8', band: 'ember', deck: true }); });
      b.unit(function () { bannerPole(2.6, 1.98, 4.9, 0.95, 2.1, { c: 'ink', ec: '#f1eee8', band: 'ember', deck: true }); });
      b.unit(function () {
        bannerPole(-6.5, -0.3, 6.0, 1.05, 2.7, { c: 'bone', ec: '#232220', head: true });
        tentDragon(b, -6.5, gh(-6.5, -0.3) + 6.0 - 0.05, -0.3, Math.PI - 0.45, 0.6, {});
      });

      b.part('Map table');
      var MX = 0, MZ = 3.72;
      b.unit(function () {
        b.push(MX, DY, MZ, 0);
        // a heavy trestle table and two stools
        b.box(0, 0.76, 0, 2.0, 0.08, 1.05, { c: 'wood', m: M.wood, bevel: 0.02 });
        [-0.75, 0.75].forEach(function (x) { b.box(x, 0, 0, 0.12, 0.76, 0.7, { c: 'woodDark', m: M.wood, bevel: 0.02 }); b.box(x, 0, 0, 0.2, 0.08, 0.95, { c: 'woodDark', m: M.wood, bevel: 0.02 }); });
        b.beam([-0.75, 0.3, 0], [0.75, 0.3, 0], 0.045, { c: 'woodDark' });
        b.box(1.25, 0, 0.35, 0.42, 0.45, 0.42, { c: 'wood', m: M.wood, bevel: 0.03, ry: 0.3 });
        b.pop();
      });
      b.unit(function () {
        b.push(MX, DY + 0.84, MZ, 0.05);
        // the chart of the coast, inked, weighed down at the corners
        b.box(0, 0, 0, 1.6, 0.012, 0.86, { c: '#e6dcc4', m: M.paint, bevel: 0.003, ao: 0 });
        var coast = [[-0.75, 0.3], [-0.5, 0.22], [-0.38, 0.05], [-0.15, 0.08], [-0.02, -0.14], [0.22, -0.1], [0.36, -0.3], [0.74, -0.36]];
        for (var i = 0; i < coast.length - 1; i++) { var a = coast[i], c = coast[i + 1]; b.beam([a[0], 0.014, a[1]], [c[0], 0.014, c[1]], 0.009, { c: '#2a2622', m: M.dark, ao: 0 }); }
        [[0.3, 0.2], [0.45, 0.05], [0.12, 0.3]].forEach(function (p) { b.cyl(p[0], 0.012, p[1], 0.03, 0.004, { c: '#2a2622', m: M.dark, seg: 8, ao: 0 }); });
        b.cyl(-0.4, 0.012, 0.3, 0.025, 0.006, { c: 'ember', m: M.paint, seg: 8, ao: 0 });
        [[-0.74, -0.38], [0.74, 0.38], [-0.74, 0.38], [0.74, -0.38]].forEach(function (p, i) { if (i < 2) b.rock(p[0], 0.02, p[1], 0.06); else b.cyl(p[0], 0.012, p[1], 0.05, 0.06, { c: 'iron', m: M.metal, seg: 8 }); });
        // a dagger stood in the map, a candle, an ink pot, rolled charts and dividers
        b.sword(0.3, 0.4, 0.2, { rz: Math.PI, len: 0.32, bw: 0.03, hilt: 'iron' });
        b.cyl(-0.55, 0.012, -0.32, 0.05, 0.03, { c: 'brass', m: M.gold, seg: 10 }); b.cyl(-0.55, 0.04, -0.32, 0.025, 0.14, { c: '#f2eee4', m: M.paint, seg: 8 }); b.flame(-0.55, 0.18, -0.32, 0.12, { i: 0.5 });
        b.cyl(-0.3, 0.012, -0.36, 0.04, 0.06, { c: '#2a2622', m: M.dark, seg: 8 });
        b.cyl(0.95, 0.04, -0.3, 0.05, 0.85, { c: '#e6dcc4', m: M.paint, seg: 8, rz: Math.PI / 2, ry: 0.4 });
        b.cyl(0.92, 0.1, -0.15, 0.04, 0.7, { c: '#ddd2b8', m: M.paint, seg: 8, rz: Math.PI / 2, ry: 0.2 });
        b.beam([0.05, 0.015, 0.0], [0.2, 0.015, 0.16], 0.008, { c: 'iron', m: M.metal }); b.beam([0.05, 0.015, 0.0], [0.24, 0.015, 0.05], 0.008, { c: 'iron', m: M.metal });
        tentToken(b, -0.2, 0.0, -0.05, 2.6, 0.9, INK);
        b.pop();
      });

      b.part('Inside the tent');
      b.unit(function () {
        // the chief's carved chair facing the door, on a fur, a chest of charts and a candle stand
        var cz = TZ + 0.9;
        b.ball(0, DY - 0.02, cz + 0.3, 0.85, { c: '#4a3e34', m: M.hair, sy: 0.06, detail: 1, ao: 0 });
        b.box(0, DY, cz, 0.7, 0.5, 0.6, { c: 'woodDark', m: M.wood, bevel: 0.02 });
        b.box(0, DY + 0.5, cz - 0.27, 0.72, 1.1, 0.1, { c: 'woodDark', m: M.wood, bevel: 0.02 });
        [-1, 1].forEach(function (s) { tentDragon(b, s * 0.36, DY + 1.55, cz - 0.27, s > 0 ? 0 : Math.PI, 0.32, {}); b.box(s * 0.36, DY + 0.5, cz, 0.08, 0.32, 0.58, { c: 'beam', m: M.wood, bevel: 0.015 }); });
        b.box(-1.5, DY, TZ + 1.6, 0.8, 0.5, 0.5, { c: 'wood', m: M.wood, bevel: 0.02, ry: 0.2 });
        b.box(-1.5, DY + 0.5, TZ + 1.6, 0.84, 0.06, 0.54, { c: 'iron', m: M.metal, bevel: 0.01, ry: 0.2 });
        b.box(1.4, DY, TZ + 1.8, 0.5, 0.75, 0.5, { c: 'woodDark', m: M.wood, bevel: 0.02 });
        b.flame(1.4, DY + 0.8, TZ + 1.8, 0.2, { i: 0.6 });
      });

      b.part('Sand table');
      var SX = 4.85, SZ = 4.0, SRY = -0.3;
      b.unit(function () {
        b.push(SX, gh(SX, SZ), SZ, SRY);
        [-1.05, 1.05].forEach(function (x) { [-1, 1].forEach(function (s) { b.beam([x - s * 0.32, 0, -0.6], [x + s * 0.32, 0.8, 0.6], 0.05, { c: 'woodDark' }); b.beam([x - s * 0.32, 0, 0.6], [x + s * 0.32, 0.8, -0.6], 0.05, { c: 'woodDark' }); }); });
        b.box(0, 0.8, 0, 2.7, 0.1, 1.75, { c: 'wood', m: M.wood, bevel: 0.02 });
        [-1, 1].forEach(function (s) { b.box(0, 0.9, s * 0.86, 2.7, 0.14, 0.06, { c: 'woodLight', m: M.wood, bevel: 0.015 }); b.box(s * 1.33, 0.9, 0, 0.06, 0.14, 1.66, { c: 'woodLight', m: M.wood, bevel: 0.015 }); });
        b.box(0, 0.9, 0, 2.6, 0.07, 1.66, { c: '#d6c39b', m: M.dirt, bevel: 0, ao: 0, jit: 0.02 });
        b.pop();
      });
      b.unit(function () {
        b.push(SX, gh(SX, SZ) + 0.97, SZ, SRY);
        // the sea along the left end, the coast heaped in sand, and the isle of the town with its tiny halls
        b.extrude(0, 0.004, 0, [[-1.3, -0.83], [-0.55, -0.83], [-0.42, -0.5], [-0.6, -0.2], [-0.4, 0.15], [-0.62, 0.5], [-0.5, 0.83], [-1.3, 0.83]], 0.01, { c: '#596468', m: M.paint, rx: Math.PI / 2, ao: 0 });
        [[0.1, -0.2, 0.42], [0.62, 0.35, 0.38], [0.9, -0.45, 0.3], [0.3, 0.5, 0.25], [-0.15, -0.55, 0.22]].forEach(function (m) { b.ball(m[0], 0, m[1], m[2], { c: b.pick(['#cdb98f', '#c4b086', '#d2bf96']), m: M.dirt, sy: 0.32, detail: 1, ao: 0.2 }); });
        [[0.62, 0.35], [0.1, -0.2]].forEach(function (c, i) {
          for (var k = 0; k < 5; k++) { var a = k * 1.3 + i, d = 0.08 + (k % 2) * 0.1, hx = c[0] + Math.cos(a) * d, hz = c[1] + Math.sin(a) * d; b.box(hx, 0.06, hz, 0.1, 0.06, 0.06, { c: 'woodLight', m: M.wood, ry: a, bevel: 0.005 }); b.extrude(hx, 0.12, hz, [[-0.04, 0], [0.04, 0], [0, 0.04]], 0.1, { c: INK, m: M.wood, ry: a + Math.PI / 2, bevel: 0 }); }
          b.cyl(c[0], 0.06, c[1], 0.035, 0.18, { c: 'stone', m: M.stone, seg: 8 });
        });
        // pins: bone for the watch, one ember where the enemy will land
        [[0.45, -0.1, 'bone'], [0.95, 0.1, 'bone'], [-0.25, 0.32, 'ink'], [-0.3, -0.25, 'ember']].forEach(function (p) { b.cyl(p[0], 0, p[1], 0.008, 0.22, { c: 'iron', m: M.metal, seg: 4 }); b.extrude(p[0] + 0.05, 0.16, p[1], [[-0.05, 0], [0.06, 0.03], [-0.05, 0.06]], 0.005, { c: p[2], m: M.cloth, ao: 0 }); });
        // the enemy fleet on the water
        [[-1.0, -0.5, 0.3], [-0.85, -0.05, 0.2], [-1.05, 0.35, 0.5], [-0.75, 0.6, 0.1]].forEach(function (s) {
          b.push(s[0], 0.01, s[1], s[2]);
          b.lathe(0, 0, 0, [[0.01, 0], [0.05, 0.02], [0.06, 0.05], [0.01, 0.05]], { c: '#3a2f27', m: M.wood, seg: 8, sx: 2.3 });
          b.cyl(0, 0.04, 0, 0.006, 0.18, { c: 'woodDark', m: M.wood, seg: 4 }); b.box(0, 0.1, 0, 0.012, 0.09, 0.1, { c: INK, m: M.cloth, bevel: 0 });
          b.pop();
        });
        // carved dragons, ours in bone and the scouts in ink, flying out to meet them
        [[0.3, 0.05, 2.9, BONE], [0.55, -0.3, 3.3, BONE], [0.0, 0.3, 2.6, BONE], [-0.2, -0.05, 3.1, INK], [0.85, 0.55, 3.6, INK]].forEach(function (t) { tentToken(b, t[0], 0.0, t[1], t[2], 1.25, t[3]); });
        // a pointer laid across the corner
        b.beam([0.9, 0.08, 0.95], [1.5, 0.08, 0.6], 0.012, { c: 'woodLight', round: true });
        b.pop();
      });

      b.part('Shields and arms');
      b.unit(function () {
        // a rail of round shields along the deck
        var y = DY;
        b.box(-4.0, y + 0.0, 1.85, 1.9, 0.12, 0.14, { c: 'beam', m: M.wood, bevel: 0.02 });
        [-4.85, -3.15].forEach(function (x) { b.post(x, y, 1.65, 0.05, 0.75, { c: 'beam' }); });
        b.beam([-4.9, y + 0.7, 1.65], [-3.1, y + 0.7, 1.65], 0.04, { c: 'woodDark' });
        [[-4.6, 'ink', null], [-4.15, 'bone', null], [-3.7, 'inkGrey', null], [-3.25, 'bone', null]].forEach(function (s, i) { tentShield(b, s[0], y + 0.42, 1.8 - 0.02 * i, { c1: s[1], c2: s[2], s: 0.82, rx: -0.28 }); });
      });
      b.unit(function () { var x = -6.4, z = 2.0; b.rack(x, gh(x, z), z, 1.8, { kind: 'spears', ry: 0.45 }); });
      b.unit(function () {
        // the war horn on its stand, a great curled horn bound in iron
        var hx = 4.1, hz = 1.68, y = DY;
        [-0.55, 0.55].forEach(function (dx) { b.beam([hx + dx - 0.25, y, hz - 0.2], [hx + dx, y + 1.0, hz], 0.04, { c: 'woodDark' }); b.beam([hx + dx + 0.25, y, hz + 0.2], [hx + dx, y + 1.0, hz], 0.04, { c: 'woodDark' }); });
        var pts = [], n = 9;
        for (var i = 0; i <= n; i++) { var t = i / n, a = -0.3 + t * 1.6; pts.push([hx - 0.85 + t * 1.6, y + 0.95 + Math.sin(a) * 0.32 - t * 0.12, hz + Math.sin(t * Math.PI) * 0.06]); }
        for (var j = 0; j < n; j++) {
          var r0 = 0.03 + Math.pow(j / n, 2.2) * 0.2, r1 = 0.03 + Math.pow((j + 1) / n, 2.2) * 0.2;
          b.beam(pts[j], pts[j + 1], r0, { r2: r1, round: true, seg: 10, c: j % 3 === 2 ? '#d9cfb9' : '#e9e1cf', m: M.paint, bevel: 0 });
          if (j % 3 === 1) b.beam(pts[j], [pts[j][0] + 0.04, pts[j][1], pts[j][2]], r0 + 0.012, { round: true, seg: 10, c: 'iron', m: M.metal });
        }
        b.cyl(pts[n][0], pts[n][1] - 0.02, pts[n][2], 0.24, 0.04, { c: 'iron', m: M.metal, seg: 14, rz: Math.PI / 2, open: true });
      });
      b.unit(function () {
        b.brazier(-2.65, gh(-2.65, 5.45), 5.45, 0.62);
        b.box(-2.65, gh(-2.65, 5.45) - 0.08, 5.45, 0.7, 0.12, 0.7, { c: 'stoneDark', m: M.stone, bevel: 0.04, ry: 0.3 });
      });

      b.part('Stores and cook fire');
      b.unit(function () {
        b.barrel(6.4, 0, 1.0, { ry: 0.3 }); b.barrel(6.95, 0, 1.6, { h: 0.82 }); b.barrel(6.2, 0, 1.75, { lie: true, ry: 1.2 });
        b.crate(5.9, 0, 0.2, 0.7, { ry: 0.25 }); b.crate(5.92, 0.7, 0.22, 0.55, { ry: -0.2 });
      });
      b.unit(function () {
        b.sack(-4.5, 0, 3.7, 0.5); b.sack(-4.95, 0, 4.1, 0.45); b.sack(-4.6, 0.42, 3.95, 0.42); b.sack(-4.1, 0, 4.25, 0.42);
        b.crate(-5.3, 0, 3.4, 0.72, { ry: -0.3 }); b.barrel(-5.4, 0, 4.4, {});
        b.woodpile(-3.6, -5.6, { n: 4, len: 1.4, ry: 0.15 });
      });
      b.unit(function () {
        // a cook fire: a ring of stones, coals, an iron pot on a tripod, a log to sit on
        var fx = -3.7, fz = 7.0, y0 = gh(fx, fz);
        for (var i = 0; i < 9; i++) { var a = i / 9 * Math.PI * 2; b.rock(fx + Math.cos(a) * 0.5, y0, fz + Math.sin(a) * 0.5, 0.15); }
        b.embers(fx, y0 + 0.05, fz, 0.38);
        [0, 2.1, 4.2].forEach(function (a) { b.beam([fx + Math.cos(a) * 0.7, y0, fz + Math.sin(a) * 0.7], [fx, y0 + 1.25, fz], 0.03, { c: 'woodDark', round: true }); });
        b.beam([fx, y0 + 1.25, fz], [fx, y0 + 0.75, fz], 0.008, { c: 'iron', m: M.metal, round: true });
        b.lathe(fx, y0 + 0.35, fz, [[0.01, 0], [0.22, 0.04], [0.27, 0.2], [0.24, 0.36], [0.22, 0.38]], { c: '#2f2d2b', m: M.metal, seg: 12 });
        b.log(fx + 1.1, y0 + 0.2, fz - 0.55, 0.2, 1.4, { rz: Math.PI / 2, ry: 0.5, c: 'wood' });
        b.bucket(fx - 0.9, y0, fz + 0.4);
        // firewood stacked by the path, a chopping block with the axe left in it
        var wx = -2.25, wz = 8.35;
        b.push(0, gh(wx, wz) - 0.03, 0, 0); b.woodpile(wx, wz, { n: 4, len: 1.3, ry: 0.35 }); b.pop();
        var kx = -1.35, kz = 7.55, ky = gh(kx, kz);
        b.cyl(kx, ky - 0.04, kz, 0.27, 0.5, { c: 'wood', m: M.wood, seg: 12 });
        b.cyl(kx, ky + 0.45, kz, 0.24, 0.015, { c: 'woodLight', m: M.wood, seg: 12, ao: 0 });
        b.beam([kx + 0.02, ky + 0.47, kz], [kx + 0.42, ky + 0.9, kz + 0.25], 0.025, { c: 'woodLight', round: true });
        b.box(kx + 0.02, ky + 0.42, kz, 0.03, 0.14, 0.2, { c: 'iron', m: M.metal, bevel: 0.005, ry: -0.55 });
        [[0.45, 0.2, 0.5], [0.35, -0.35, 1.9]].forEach(function (c) { b.log(kx + c[0], gh(kx + c[0], kz + c[1]) + 0.08, kz + c[1], 0.08, 0.38, { rz: Math.PI / 2, ry: c[2], c: 'woodLight' }); });
      });

      b.part('Messenger perch');
      b.unit(function () {
        var px = 7.0, pz = -2.6, y0 = gh(px, pz);
        b.log(px, y0 - 0.1, pz, 0.17, 3.55, { c: 'woodDark', r2: 0.14 });
        b.beam([px - 0.85, y0 + 3.4, pz], [px + 0.85, y0 + 3.4, pz], 0.1, { c: 'wood', round: true });
        for (var i = 0; i < 6; i++) b.cyl(px - 0.7 + i * 0.28, y0 + 3.4, pz, 0.12, 0.05, { c: 'rope', m: M.rope, seg: 8, rz: -Math.PI / 2 });
        [-1, 1].forEach(function (s) { b.beam([px + s * 0.11, y0 + 2.4, pz], [px + s * 0.66, y0 + 3.32, pz], 0.05, { c: 'woodDark' }); });
        for (var q = 0; q < 4; q++) { var a = q * 1.57 + 0.4; b.rock(px + Math.cos(a) * 0.45, y0, pz + Math.sin(a) * 0.45, 0.22); }
        b.ladder(px, y0, pz + 0.3, 3.0, { w: 0.42, ry: 0, lean: 0.3 });
        b.bucket(px + 0.8, y0, pz + 0.8);
      });

      b.part('Guard tent and supply cart');
      b.unit(function () {
        // the night watch's own small ridge tent, striped like the great one, a shield leant at its side, a spear stood by
        var gx = -7.0, gz = 4.7;
        tentRidge(b, gx, gz, 0.2, 1.95, 1.65, 1.35, 6);
        tentShield(b, gx + 0.35, 0.36, gz + 1.12, { c1: 'ink', c2: 'bone', s: 0.66, rx: -0.4, ry: 0.2 });
        b.beam([gx + 1.0, 0, gz + 1.05], [gx + 1.1, 2.1, gz + 1.0], 0.025, { c: 'woodDark', round: true });
        b.extrude(gx + 1.1, 2.08, gz + 1.0, [[-0.05, 0], [0.05, 0], [0, 0.3]], 0.025, { c: 'iron', m: M.metal, rz: -0.05 });
        b.ropeCoil(gx - 0.5, 0, gz + 1.25, 0.2);
        b.bench(-4.55, 6.15, 1.2, { ry: 0.55 });
      });
      b.unit(function () {
        // a supply cart drawn up by the path, its load of sacks, a cask and a crate of arrows
        var cx2 = 4.3, cz2 = 7.4;
        b.push(0, gh(cx2, cz2), 0, 0);
        b.cart(cx2, cz2, { ry: -2.19, load: function (bb) {
          bb.sack(-0.3, 0.71, -0.5, 0.42); bb.sack(0.3, 0.71, -0.35, 0.4); bb.sack(-0.05, 1.05, -0.45, 0.36);
          bb.barrel(0.25, 0.71, 0.45, { h: 0.7 }); bb.crate(-0.3, 0.71, 0.5, 0.55, { ry: 0.2 });
        } });
        b.pop();
      });

      b.part('Grass and flowers');
      b.base(function () {
        // the camp's lawn: tufts in the levelled ground, kept off the deck and the paths
        for (var i = 0; i < 300; i++) {
          var x = -8.2 + b.rand() * 16.4, z = -5.6 + b.rand() * 11.2;
          if (x > X0 - 0.4 && x < X1 + 0.4 && z > Z0 - 0.4 && z < Z1 + 0.3) continue;
          if (Math.abs(x) < PX + 0.4 && z < 5.9 && z > Z1 - 0.2) continue;
          if (Math.abs(x - 0.5) < 1.1 && z > 5) continue;
          if (Math.hypot(x - SX, z - SZ) < 1.8 || Math.hypot(x - A.cx, z - A.cz) < 2.0 || Math.hypot(x + 7.0, z - 4.7) < 1.25) continue;
          b.grass(x, gh(x, z), z, 0.3 + b.rand() * 0.3);
          if (b.chance(0.12)) b.flowers(x, gh(x, z), z, 0.3, { n: 4, c: '#f3f1ec' });
        }
      });
      b.unit(function () { b.bush(-5.0, 5.85, 0.5, { flowers: '#f3f1ec', n: 2 }); b.bush(5.8, -0.8, 0.5, { n: 2 }); b.bush(2.6, 7.05, 0.45, { flowers: '#e6e3dc', n: 2 }); });

      b.life(function () {
        b.figure(-1.32, MZ + 0.05, { role: 'villager', pose: 'tentPoint', ry: Math.PI / 2 - 0.15, y: DY, cape: 'ink', beard: true, c: '#8a857c' });
        b.figure(0.35, MZ - 0.98, { role: 'villager', pose: 'tentLean', ry: 0.05, y: DY, c: '#a39d92', beard: true });
        b.figure(-1.4, Z1 - 0.2, { role: 'soldier', pose: 'spear', ry: 0.25, y: DY });
        b.figure(1.45, Z1 - 0.15, { role: 'soldier', pose: 'guard', ry: -0.35, y: DY, team: 'bone' });
        b.figure(3.75, 4.9, { role: 'villager', pose: 'tentPoint', ry: 2.0, c: '#5c5e62', beard: true });
        b.figure(6.15, 3.2, { role: 'archer', pose: 'talk', ry: -1.0 });
        b.figure(1.2, 7.6, { role: 'villager', pose: 'run', ry: Math.PI - 0.15, y: gh(1.2, 7.6), c: '#5f5850' });
        b.figure(4.9, 5.7, { role: 'child', pose: 'cheer', ry: Math.PI - 0.4 });
      });
    }
  });
})();
