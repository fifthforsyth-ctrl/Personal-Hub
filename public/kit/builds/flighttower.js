// Round tower (kind 'flighttower'): a tall round stone tower. Three timber platforms jut out at different heights on
// heavy struts, each with its own doorway into the tower; a lookout under a slate cone roof with the orange pennant on
// top; a winch and a hoist boom on the low platform, ladders, round shields on the rails, carved dragon-head posts at
// the platform tips, and the black banner over the door.
// Built footings first, the tower course by course, each platform (corbels, struts, joists, deck plank by plank,
// rails) as the wall reaches it, the lookout and the roof row by row, then the yard, and last the people.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL, U = KIT.util;
  function V(x, y, z) { return new T.Vector3(x, y, z); }

  // ---- the tower's shape, shared by the helpers
  var TX = -1.0, TZ = -0.6, Y0 = 0.45, YT = 12.4, R0 = 2.7, R1 = 2.3, TH = 0.62;
  function rAt(y) { return R0 - (R0 - R1) * U.clamp((y - Y0) / (YT - Y0), 0, 1); }
  function rOut(y) { return rAt(y) + TH / 2; }
  // the three platforms: a = the angle they jut out at (0 = +x, PI/2 = +z, the front), yd = deck top,
  // L = how far they reach past the wall, W = width
  var PLAT = [
    { name: 'Low platform', a: 0.3, yd: 3.6, L: 3.6, W: 2.6 },
    { name: 'Middle platform', a: 2.8, yd: 6.6, L: 5.4, W: 3.0 },
    { name: 'Top platform', a: 0.95, yd: 9.5, L: 3.9, W: 2.6 }
  ];
  var DOOR_A = 1.55, DOOR_H = 2.3, DOOR_W = 1.6;
  // a point in a platform's own frame (x across it, z out from the tower's axis) in the build's frame
  function pw(P, x, y, z) { var s = Math.sin(P.a), c = Math.cos(P.a); return [TX + x * s + z * c, y, TZ - x * c + z * s]; }
  function polar(a, r, y) { return [TX + Math.cos(a) * r, y, TZ + Math.sin(a) * r]; }

  // ---- poses
  // climbing a ladder that leans away in front (+z): one foot a rung up, hands high on the rails
  KIT.people.poses.flighttowerClimb = function () { return { feet: [V(-0.13, 0.42, 0.22), V(0.13, 0.09, 0.12)], hands: [V(-0.24, 1.78, 0.42), V(0.24, 1.5, 0.36)], lean: 0.14, twist: 0, side: 0, hip: 0, drop: 0.0, head: [0, -0.3], pole: [V(-1, -0.5, -0.3), V(1, -0.5, -0.3)] }; };
  // turning a winch crank in front, leaning into it
  KIT.people.poses.flighttowerCrank = function () { return { feet: [V(-0.2, 0.09, 0.12), V(0.17, 0.09, -0.22)], hands: [V(-0.12, 0.98, 0.5), V(0.08, 1.08, 0.48)], lean: 0.28, twist: 0.1, side: 0, hip: 0, drop: 0.1, head: [0.1, -0.05], pole: [V(-0.8, -0.6, -0.3), V(0.8, -0.6, -0.3)] }; };
  // reaching up and out for a load on a rope
  KIT.people.poses.flighttowerReach = function () { return { feet: [V(-0.16, 0.09, 0.18), V(0.14, 0.09, -0.16)], hands: [V(-0.1, 1.62, 0.52), V(0.14, 1.4, 0.5)], lean: 0.12, twist: 0, side: 0, hip: 0, drop: 0.02, head: [0, -0.25], pole: [V(-1, -0.4, -0.2), V(1, -0.4, -0.2)] }; };
  // waving one arm high to someone below
  KIT.people.poses.flighttowerWave = function () { return { feet: [V(-0.16, 0.09, 0.06), V(0.15, 0.09, -0.08)], hands: [V(-0.3, 1.02, 0.08), V(0.34, 2.0, 0.22)], lean: -0.06, twist: -0.1, side: -0.05, hip: 0, drop: 0, head: [0.1, -0.35], pole: [V(-1, -0.4, -0.2), V(1, -0.1, -0.2)] }; };

  // ---- a curved stone for the round wall (the ring sector ri..ro, angles a0..a1, h tall)
  function flighttowerArc(ri, ro, a0, a1, h, bev) {
    var n = Math.max(2, Math.ceil((a1 - a0) / 0.14)), sh = new T.Shape(), i, a;
    for (i = 0; i <= n; i++) { a = a0 + (a1 - a0) * i / n; if (i === 0) sh.moveTo(Math.cos(a) * ro, -Math.sin(a) * ro); else sh.lineTo(Math.cos(a) * ro, -Math.sin(a) * ro); }
    for (i = n; i >= 0; i--) { a = a0 + (a1 - a0) * i / n; sh.lineTo(Math.cos(a) * ri, -Math.sin(a) * ri); }
    bev = Math.min(bev, h * 0.3);
    var g = new T.ExtrudeGeometry(sh, { depth: Math.max(0.01, h - 2 * bev), bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelOffset: -bev, bevelSegments: 1, steps: 1, curveSegments: 1 });
    g.rotateX(-Math.PI / 2); g.translate(0, bev, 0); g.deleteAttribute('uv');
    return KIT.geo.flat(g);
  }
  // A round wall course by course (one step a course). Openings: [{a, w (metres at the face), y0, y1}]; a stone that
  // runs into an opening is cut back to its edge, so doorways have clean jambs.
  function flighttowerRing(b, o) {
    var ch0 = o.course || 0.42, n = Math.max(1, Math.round(o.h / ch0)), ch = o.h / n, len = o.len || 0.8, pal = o.pal || 'stone';
    for (var k = 0; k < n; k++) (function (k) {
      var y = o.y0 + k * ch, rr = o.r || rAt(y + ch / 2), th = o.thick || TH;
      b.unit(function () {
        if (o.core !== false) b.cyl(o.cx, y, o.cz, rr - th * 0.45, ch, { c: o.mortar || '#8a7e6c', m: M.stone, seg: 30, ao: 0.1, jit: 0.01, open: !!o.hollow });
        var ns = Math.max(6, Math.round(Math.PI * 2 * rr / len)), arc = Math.PI * 2 / ns, off = (k % 2) * arc * 0.5 + (o.k0 || 0) * 0.37;
        var ym = y + ch * 0.5, cuts = (o.holes || []).filter(function (H) { return ym > H.y0 && ym < H.y1; }).map(function (H) { var hw = H.w / 2 / (rr + th / 2); return [H.a - hw, H.a + hw]; });
        for (var i = 0; i < ns; i++) {
          var am = i * arc + off + b.j(arc * 0.06), a0 = am - arc / 2, a1 = am + arc / 2, pieces = [[a0, a1]];
          cuts.forEach(function (cu) {
            var np = [];
            pieces.forEach(function (p) {
              var mid = (p[0] + p[1]) / 2, sh = Math.round((mid - (cu[0] + cu[1]) / 2) / (Math.PI * 2)) * Math.PI * 2, c0 = cu[0] + sh, c1 = cu[1] + sh;
              if (p[1] <= c0 || p[0] >= c1) { np.push(p); return; }
              if (p[0] < c0) np.push([p[0], c0]);
              if (p[1] > c1) np.push([c1, p[1]]);
            });
            pieces = np;
          });
          pieces.forEach(function (p) {
            var gap = 0.045 / rr, q0 = p[0] + (p[0] === a0 ? gap : 0.004), q1 = p[1] - (p[1] === a1 ? gap : 0.004);
            if ((q1 - q0) * rr < 0.14) return;
            var hh = ch * (0.88 + b.j(0.05)), ro = rr + th / 2 + b.j(0.02), ri = rr - th / 2;
            b.addGeo(flighttowerArc(ri, ro, q0, q1, hh, Math.min(0.06, hh * 0.18)), { x: o.cx, y: y + (ch - hh) / 2, z: o.cz, c: b.stoneC(pal, y), m: M.stone, ao: 0.18, jit: 0.04 });
          });
        }
      });
    })(k);
  }

  // a carved dragon head on a post: the profile in the local XY plane, snout toward +x, neck foot at the origin
  var HEAD = [[0.12, 0], [0.14, 0.3], [0.22, 0.48], [0.38, 0.56], [0.6, 0.55], [0.84, 0.58], [0.7, 0.635], [0.88, 0.68], [0.86, 0.76], [0.66, 0.8], [0.5, 0.86], [0.4, 1.0], [0.34, 0.86], [0.2, 0.94], [0.18, 0.8], [0.04, 0.78], [-0.02, 0.64], [-0.18, 0.62], [-0.08, 0.52], [-0.22, 0.44], [-0.1, 0.36], [-0.17, 0.2], [-0.12, 0]];
  function flighttowerHead(b, x, y, z, ry, s, o) {
    o = o || {};
    b.push(x, y, z, ry);
    b.extrude(0, 0, 0, HEAD.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.15 * s, { c: o.c || 'beam', m: M.wood, bevel: 0.012 * s, ao: 0.1 });
    [-1, 1].forEach(function (sd) {
      b.ball(0.56 * s, 0.73 * s, sd * 0.08 * s, 0.035 * s, { c: '#efebe4', m: M.paint, detail: 1, ao: 0, jit: 0 });
      b.box(0.6 * s, 0.6 * s, sd * 0.075 * s, 0.32 * s, 0.025 * s, 0.02 * s, { c: '#1a1918', m: M.wood, bevel: 0, ao: 0, rz: 0.05 });
    });
    b.pop();
  }
  // a round shield facing +z in the local frame, painted in quarters
  function flighttowerShield(b, x, y, z, ry, c1, c2, s) {
    var r = 0.42 * s * 0.97, n = 8;
    b.push(x, y, z, ry);
    b.shield(0, 0, 0, { kind: 'round', c: c1, s: s });
    [0, Math.PI].forEach(function (a0) {
      var pts = [[0, 0]]; for (var i = 0; i <= n; i++) { var a = a0 + Math.PI / 4 + i / n * Math.PI / 2; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      b.extrude(0, 0, 0.055, pts, 0.006, { c: c2, m: M.paint, ao: 0, jit: 0.01 });
    });
    b.pop();
  }
  // a small fish lying in the local XY plane
  var FISH = [[0, 0], [0.08, 0.05], [0.24, 0.045], [0.32, 0.01], [0.4, 0.065], [0.39, -0.06], [0.32, -0.01], [0.24, -0.045], [0.08, -0.05]];
  function flighttowerFish(b, x, y, z, o) {
    o = o || {}; var s = o.s || 1;
    b.extrude(x, y, z, FISH.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.05 * s, { rx: o.rx || 0, ry: o.ry || 0, rz: o.rz || 0, c: b.pick(['#6f7b80', '#647076', '#7c868a']), m: M.metal, ao: 0.1, jit: 0.03, bevel: 0.01 });
  }
  // a wicker basket heaped with fish, standing at (x, y, z)
  function flighttowerBasket(b, x, y, z, o) {
    o = o || {}; var r = o.r || 0.34, h = o.h || 0.42;
    b.lathe(x, y, z, [[0.01, 0], [r * 0.8, 0], [r, h * 0.85], [r * 1.04, h], [r * 0.9, h * 0.98], [0.01, h * 0.8]], { c: '#8c7658', m: M.straw, seg: 14, flat: true });
    [0.25, 0.55, 0.85].forEach(function (f) { b.cyl(x, y + h * f - 0.02, z, r * (0.8 + 0.2 * f) + 0.012, 0.04, { c: '#6a5940', m: M.rope, seg: 14, open: true }); });
    for (var i = 0; i < (o.n || 7); i++) {
      var a = i / (o.n || 7) * Math.PI * 2 + b.j(0.4), d = r * (0.2 + b.r() * 0.4);
      flighttowerFish(b, x + Math.cos(a) * d - 0.12, y + h * 0.86 + b.r() * 0.08, z + Math.sin(a) * d, { ry: a + b.j(0.5), rx: Math.PI / 2 + b.j(0.4), s: 0.9 + b.r() * 0.3 });
    }
  }
  // a riding saddle on a trestle, along local x
  function flighttowerSaddle(b, x, z, ry) {
    var leather = '#3a2b21';
    b.push(x, 0, z, ry);
    [-0.55, 0.55].forEach(function (sx) { [-1, 1].forEach(function (sz) { b.beam([sx, 0, sz * 0.32], [sx, 0.82, 0], 0.035, { c: 'wood' }); }); });
    b.beam([-0.75, 0.84, 0], [0.75, 0.84, 0], 0.07, { c: 'woodLight', round: true });
    b.box(0, 0.88, 0, 0.62, 0.12, 0.46, { c: leather, m: M.wood, bevel: 0.04 });
    [-1, 1].forEach(function (sd) { b.box(0, 0.5, sd * 0.25, 0.5, 0.42, 0.04, { c: '#2c211a', m: M.wood, rx: sd * 0.32, bevel: 0.01 }); });
    b.box(-0.3, 0.95, 0, 0.1, 0.2, 0.44, { c: leather, m: M.wood, bevel: 0.03 });
    b.cyl(0.28, 0.96, 0, 0.04, 0.16, { c: '#8f8a80', m: M.metal, seg: 6 });
    b.addGeo(new T.TorusGeometry(0.06, 0.012, 4, 10), { x: 0.02, y: 0.38, z: 0.29, c: 'iron', m: M.metal, ao: 0 });
    b.beam([0.02, 0.9, 0.27], [0.02, 0.42, 0.29], 0.012, { c: leather, m: M.wood });
    b.pop();
  }
  // the banner's emblem, a dragon with wings spread (one of the dragon ornaments), drawn proud of both faces of a cloth
  // facing +z at (x, y, z), size s
  var DRAGON_E = (function () {
    var R = [[0, 0.52], [0.05, 0.47], [0.07, 0.4], [0.12, 0.45], [0.065, 0.34], [0.05, 0.26], [0.09, 0.2], [0.22, 0.27], [0.36, 0.33], [0.5, 0.37], [0.44, 0.24], [0.38, 0.22], [0.34, 0.11], [0.27, 0.12], [0.21, 0.02], [0.14, 0.04], [0.08, -0.06], [0.06, -0.16], [0.04, -0.3], [0.025, -0.42], [0.09, -0.47], [0.02, -0.5], [0.0, -0.55]];
    var L = R.slice(1, R.length - 1).reverse().map(function (p) { return [-p[0], p[1]]; });
    return R.concat(L);
  })();
  function flighttowerEmblem(b, x, y, z, s, ec) {
    [0.022, -0.022].forEach(function (dz) { b.extrude(x, y, z + dz, DRAGON_E.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.006, { c: ec, m: M.cloth, bucket: 'cloth', ao: 0, jit: 0.01, vary: 0.02 }); });
  }

  // ---- a platform, in its own frame (built after the wall below its deck is up)
  var TONES = ['#86745d', '#7b6a55', '#907d65', '#73624f', '#8c7a62'];
  function flighttowerPlatform(b, P, o) {
    o = o || {};
    var yd = P.yd, L = P.L, W = P.W, ro = rOut(yd), z1 = ro + L, jt = 0.08, jh = 0.32, jy = yd - jt - jh;
    var jx = [-W / 2 + 0.16, -W / 6, W / 6, W / 2 - 0.16], zb = ro + L * 0.58, by = jy - 0.26;
    function wz(x, y) { var r = rOut(y); return Math.sqrt(Math.max(0, r * r - x * x)); }
    b.push(TX, 0, TZ, Math.PI / 2 - P.a);
    b.part(P.name + ', brackets');
    b.pop();
    flighttowerFloor(b, yd, rAt(yd) - TH / 2 + 0.02);
    b.push(TX, 0, TZ, Math.PI / 2 - P.a);
    b.unit(function () {
      // stone corbels set in the wall for the struts' feet
      jx.forEach(function (x, i) {
        var yf = yd - (i === 0 || i === 3 ? 2.45 : 2.1);
        b.box(x, yf - 0.4, wz(x, yf) - 0.16, 0.46, 0.42, 0.56, { c: 'sandstone', bevel: 0.05 });
        b.box(x, yf - 0.62, wz(x, yf) - 0.2, 0.36, 0.22, 0.44, { c: 'sandstone', bevel: 0.04 });
      });
    });
    b.unit(function () {
      // the heavy raking struts and the bearer they carry
      jx.forEach(function (x, i) { var yf = yd - (i === 0 || i === 3 ? 2.45 : 2.1); b.beam([x, yf - 0.02, wz(x, yf) - 0.12], [x, by, zb], 0.115, { c: 'beam' }); });
      b.box(0, by, zb, W + 0.3, 0.26, 0.28, { c: 'beam', m: M.wood, bevel: 0.03 });
      [-1, 1].forEach(function (s) { b.box(s * (W / 2 + 0.16), by + 0.05, zb, 0.03, 0.16, 0.18, { c: 'iron', m: M.metal, bevel: 0.005 }); });
    });
    b.unit(function () {
      // the joists, run deep into the wall, with iron caps on their ends
      jx.forEach(function (x) {
        var zi = ro - 0.8;
        b.box(x, jy, (zi + z1) / 2, 0.24, jh, z1 - zi, { c: 'beam', m: M.wood, bevel: 0.03 });
        b.box(x, jy + 0.02, z1 + 0.005, 0.27, jh - 0.04, 0.03, { c: 'iron', m: M.metal, bevel: 0.006 });
        // a short hanger from the strut to the joist
        b.beam([x, by + 0.26, zb - 0.9], [x, by + 0.26 + 0.01, zb - 0.9 + 0.01], 0.01, { c: 'beam' });
      });
    });
    b.part(P.name + ', deck');
    var planks = [], pz = ro - 0.55;
    while (pz < z1 - 0.1) { planks.push(pz); pz += 0.29; }
    var per = Math.ceil(planks.length / 3);
    for (var g = 0; g < planks.length; g += per) (function (g) {
      b.unit(function () {
        for (var i = g; i < Math.min(planks.length, g + per); i++) {
          var zc = planks[i] + 0.14, ww = W + 0.06 + b.j(0.05);
          b.box(b.j(0.03), yd - jt, Math.min(zc, z1 - 0.14), ww, jt + b.j(0.008), 0.27, { c: b.pick(TONES), m: M.wood, bevel: 0.014, ry: b.j(0.012), ao: 0.25 });
          if (i % 2 === 0) [-1, 1].forEach(function (s) { b.ball(s * (W / 2 - 0.16), yd + 0.0, zc, 0.03, { c: 'iron', m: M.metal, detail: 0, ao: 0 }); });
        }
        if (g + per >= planks.length) {
          // the lip at the tip: a thick beam shod in iron
          b.box(0, yd - 0.02, z1 - 0.15, W + 0.12, 0.18, 0.28, { c: 'beam', m: M.wood, bevel: 0.03 });
          b.box(0, yd + 0.155, z1 - 0.15, W + 0.12, 0.025, 0.2, { c: 'iron', m: M.metal, bevel: 0.006 });
        }
      });
    })(g);
    b.part(P.name + ', rails');
    b.unit(function () {
      // side rails along the inner part, posts at the tip carved into dragon heads
      var rl = o.rails || [[ro + 0.15, ro + L * 0.5], [ro + 0.15, ro + L * 0.5]];
      [-1, 1].forEach(function (s, si) {
        var r = rl[si]; if (!r) return;
        var x = s * (W / 2 - 0.07), n = Math.max(1, Math.round((r[1] - r[0]) / 0.95));
        for (var i = 0; i <= n; i++) b.post(x, yd, r[0] + (r[1] - r[0]) * i / n, 0.065, 1.05, { c: 'beam' });
        b.beam([x, yd + 1.0, r[0] - 0.05], [x, yd + 1.0, r[1] + 0.05], 0.055, { c: 'beam' });
        b.beam([x, yd + 0.55, r[0]], [x, yd + 0.55, r[1]], 0.04, { c: 'woodDark' });
      });
      (o.heads || [-1, 1]).forEach(function (s) {
        var x = s * (W / 2 - 0.12), zz = z1 - 0.42;
        b.post(x, yd, zz, 0.1, 1.15, { c: 'beam' });
        flighttowerHead(b, x, yd + 1.12, zz, -Math.PI / 2, 0.62, {});
      });
    });
    if (o.shields) b.unit(function () {
      o.shields.forEach(function (sh) { var s = sh[0]; flighttowerShield(b, s * (W / 2 + 0.01), yd + 0.66, sh[1], s * Math.PI / 2, sh[2], sh[3], 0.78); });
    });
    if (o.extra) o.extra(b, { yd: yd, L: L, W: W, ro: ro, z1: z1 });
    b.pop();
  }
  // a plank floor inside the tower at yTop, on two beams, its planks cut to the round wall
  function flighttowerFloor(b, yTop, r) {
    b.unit(function () {
      [-0.9, 0.9].forEach(function (x) { var hl = Math.sqrt(r * r - x * x); b.box(TX + x, yTop - 0.36, TZ, 0.24, 0.28, hl * 2, { c: 'beam', m: M.wood, bevel: 0.03 }); });
      for (var z = -r + 0.15; z < r; z += 0.29) { var hl = Math.sqrt(Math.max(0, r * r - z * z)); if (hl < 0.25) continue; b.box(TX + b.j(0.02), yTop - 0.08, TZ + z, hl * 2 - 0.04, 0.08, 0.27, { c: b.pick(TONES), m: M.wood, bevel: 0.012, ao: 0.25 }); }
    });
  }
  // the doorway onto a platform: a timber frame, a dark way in, plank doors swung open
  function flighttowerDoorway(b, P) {
    var yd = P.yd, w = DOOR_W, h = DOOR_H, ro = rOut(yd + 1.2), rr = rAt(yd + 1.2);
    b.push(TX, 0, TZ, Math.PI / 2 - P.a);
    b.unit(function () {
      b.box(0, yd - 0.05, rr - 0.12, w + 0.04, h + 0.1, 0.5, { c: '#1c1b1a', m: M.dark, bevel: 0, ao: 0, jit: 0 });
      [-1, 1].forEach(function (s) {
        var x = s * (w / 2 + 0.11), zj = Math.sqrt(ro * ro - x * x) - 0.06;
        b.box(x, yd, zj, 0.24, h, 0.3, { c: 'beam', m: M.wood, bevel: 0.03 });
        // a leaf of plank door swung back against the wall
        b.push(s * (w / 2 + 0.24), yd + 0.05, zj + 0.17, s * -1.25);
        var nl = Math.round(w / 2 / 0.25), pwid = w / 2 / nl;
        for (var i = 0; i < nl; i++) b.box(-s * (pwid / 2 + i * pwid), 0, 0, pwid - 0.015, h - 0.15 + b.j(0.03), 0.07, { c: b.pick(['#8a7660', '#7f6c56', '#937f67']), m: M.wood, bevel: 0.012, ao: 0.3 });
        [0.35, h - 0.55].forEach(function (yy) { b.box(-s * w / 4, yy, 0.045, w / 2 - 0.05, 0.07, 0.025, { c: 'iron', m: M.metal, bevel: 0.005 }); });
        b.pop();
      });
      var zl = Math.sqrt(ro * ro - 0.49) - 0.1;
      b.box(0, yd + h, zl, w + 0.95, 0.3, 0.34, { c: 'beam', m: M.wood, bevel: 0.04 });
    });
    b.pop();
  }

  KIT.defineBuild('flighttower', {
    name: 'Round tower', size: 'middle', need: 44,
    line: 'A tall round stone tower with three timber platforms jutting out at different heights on heavy brackets, a winch and ladders, a sentry on the long platform, and a lookout under a slate cone.',
    r: 11.5, flat: [12, 12], ground: 'cobble', path: [[2.6, 12.0], [-0.9, 3.6]],
    frameY: 8.0, frameR: 14.0, glowAt: [TX, 18.9, TZ],
    trees: [{ x: -8.6, z: -5.6, kind: 'pine', h: 7.4 }, { x: -9.6, z: -1.4, kind: 'pine', h: 6.0 }, { x: 7.6, z: 6.4, kind: 'birch', h: 6.0 }, { x: -9.4, z: 3.0, kind: 'birch', h: 5.0 }],
    bushes: [{ x: 8.6, z: 4.6, r: 0.8, flowers: '#f3f1ec' }, { x: -6.6, z: 7.2, r: 0.7 }, { x: 5.6, z: -7.6, r: 0.75 }, { x: -7.6, z: 5.0, r: 0.6, flowers: '#f3f1ec' }],
    build: function (b) {
      var P1 = PLAT[0], P2 = PLAT[1], P3 = PLAT[2];
      // openings in the wall: the front door, the three platform doorways, arrow slits
      var SLITS = [[0.85, 1.5], [2.15, 2.4], [1.25, 5.2], [2.05, 8.0], [1.6, 7.4], [1.7, 10.4], [0.25, 7.8], [2.6, 10.9]];
      var holes = [{ a: DOOR_A, w: 1.95, y0: 0, y1: 2.3 }, { a: DOOR_A, w: 1.3, y0: 2.3, y1: 3.3 }];
      PLAT.forEach(function (P) { holes.push({ a: P.a, w: DOOR_W + 0.18, y0: P.yd - 0.3, y1: P.yd + DOOR_H + 0.05 }); });
      SLITS.forEach(function (s) { holes.push({ a: s[0], w: 0.3, y0: s[1], y1: s[1] + 0.85 }); });
      function slits(y0, y1) {
        b.unit(function () {
          SLITS.forEach(function (s) {
            if (s[1] < y0 || s[1] >= y1) return;
            var r = rAt(s[1] + 0.4), p = polar(s[0], r - 0.02, s[1] - 0.02);
            b.box(p[0], p[1], p[2], 0.32, 0.9, TH * 0.9, { ry: Math.PI / 2 - s[0], c: '#1c1b1a', m: M.dark, bevel: 0, ao: 0, jit: 0 });
            var q = polar(s[0], r + TH / 2 + 0.02, s[1] - 0.12);
            b.box(q[0], q[1], q[2], 0.5, 0.12, 0.2, { ry: Math.PI / 2 - s[0], c: 'sandstone', bevel: 0.03 });
          });
        });
      }
      var ring = function (y0, y1, k0) { flighttowerRing(b, { cx: TX, cz: TZ, y0: y0, h: y1 - y0, course: 0.41, holes: holes, k0: k0, hollow: true }); };

      b.part('Footings');
      b.unit(function () {
        b.cyl(TX, -0.12, TZ, R0 + 0.95, 0.3, { c: 'stoneDark', m: M.stone, seg: 30, flat: true });
      });
      flighttowerRing(b, { cx: TX, cz: TZ, y0: 0.14, h: 0.31, course: 0.31, r: R0 + 0.3, thick: 1.05, len: 1.05, pal: 'stoneDark', holes: [{ a: DOOR_A, w: 1.95, y0: 0, y1: 1 }] });
      b.unit(function () {
        // two broad steps up to the door
        var p = polar(DOOR_A, R0 + 1.05, -0.05), q = polar(DOOR_A, R0 + 0.62, 0.15);
        b.box(p[0], p[1], p[2], 2.3, 0.22, 0.75, { ry: Math.PI / 2 - DOOR_A, c: 'sandstone', bevel: 0.05 });
        b.box(q[0], q[1], q[2], 1.8, 0.3, 0.7, { ry: Math.PI / 2 - DOOR_A, c: 'sandstone', bevel: 0.05 });
      });

      b.unit(function () {
        // flagstones inside the tower
        var r = R0 - TH / 2 + 0.02;
        b.cyl(TX, Y0 - 0.12, TZ, r, 0.1, { c: '#8a7e6c', m: M.stone, seg: 30 });
        for (var i = 0; i < 26; i++) { var a = b.r() * Math.PI * 2, d = Math.sqrt(b.r()) * (r - 0.35); b.box(TX + Math.cos(a) * d, Y0 - 0.04, TZ + Math.sin(a) * d, 0.5 + b.j(0.1), 0.05, 0.4 + b.j(0.08), { ry: b.r() * 3, c: 'stoneDark', bevel: 0.03 }); }
      });
      b.part('Tower, first courses');
      ring(Y0, P1.yd, 0);
      b.part('Front door and slits');
      b.unit(function () {
        var p = polar(DOOR_A, rOut(1.2) - 0.08, Y0);
        b.archDoor(p[0], p[1], p[2], 1.5, 2.5, { ry: Math.PI / 2 - DOOR_A, depth: 0.8, keyC: 'sandstone', frameStone: 'sandstone', doorC: 'woodDark' });
      });
      slits(0, P1.yd);

      flighttowerPlatform(b, P1, {
        rails: [[rOut(P1.yd) + 1.75, rOut(P1.yd) + 2.2], [rOut(P1.yd) + 0.15, rOut(P1.yd) + 2.2]], heads: [1],
        shields: [[-1, rOut(P1.yd) + 1.98, 'ink', 'bone'], [1, rOut(P1.yd) + 0.9, 'bone', 'ink'], [1, rOut(P1.yd) + 1.8, 'ink', 'bone']],
        extra: function (b, f) {
          // the hoist boom at the tip: a post, an arm reaching out over the yard, a brace and a pulley block
          b.unit(function () {
            var x = -(f.W / 2 - 0.14), zp = f.z1 - 0.32, top = f.yd + 2.5;
            b.post(x, f.yd, zp, 0.1, 2.6, { c: 'beam' });
            flighttowerHead(b, x, f.yd + 2.62, zp, -Math.PI / 2, 0.5, {});
            b.beam([x, top, zp - 0.35], [x + 0.35, top, f.z1 + 0.85], 0.09, { c: 'beam' });
            b.beam([x, f.yd + 1.2, zp], [x + 0.22, top - 0.05, f.z1 + 0.3], 0.06, { c: 'beam' });
            b.box(x + 0.33, top - 0.38, f.z1 + 0.7, 0.12, 0.3, 0.26, { c: 'woodDark', m: M.wood, bevel: 0.02 });
            b.cyl(x + 0.27, top - 0.23, f.z1 + 0.7, 0.11, 0.12, { c: 'iron', m: M.metal, rz: -Math.PI / 2, seg: 10 });
          });
        }
      });
      b.part('Tower, middle courses');
      ring(P1.yd, P2.yd, 3);
      b.part('Low doorway and slits');
      flighttowerDoorway(b, P1);
      slits(P1.yd, P2.yd);

      flighttowerPlatform(b, P2, {
        rails: [[rOut(P2.yd) + 0.15, rOut(P2.yd) + 1.4], [rOut(P2.yd) + 0.15, rOut(P2.yd) + 1.4]], heads: [],
        shields: [[-1, rOut(P2.yd) + 0.8, 'bone', 'ink'], [1, rOut(P2.yd) + 0.8, 'ink', 'bone']],
        extra: function (b, f) { b.unit(function () { flighttowerBasket(b, 1.0, f.yd, f.ro + 0.5, { r: 0.32, n: 7 }); b.bucket(-1.0, f.yd, f.ro + 0.45); }); }
      });
      b.part('Tower, upper courses');
      ring(P2.yd, P3.yd, 5);
      b.part('Middle doorway and slits');
      flighttowerDoorway(b, P2);
      slits(P2.yd, P3.yd);

      flighttowerPlatform(b, P3, {
        rails: [[rOut(P3.yd) + 0.15, rOut(P3.yd) + 1.9], [rOut(P3.yd) + 0.15, rOut(P3.yd) + 1.9]],
        shields: [[-1, rOut(P3.yd) + 0.65, 'ink', 'bone'], [-1, rOut(P3.yd) + 1.5, 'bone', 'ink'], [1, rOut(P3.yd) + 1.1, 'ink', 'bone']],
        extra: function (b, f) { b.unit(function () { b.ropeCoil(0.75, f.yd, f.ro + 0.55, 0.26); b.ropeCoil(0.78, f.yd + 0.1, f.ro + 0.53, 0.2); b.bucket(-0.85, f.yd, f.ro + 0.45); }); }
      });
      b.part('Tower, top courses');
      ring(P3.yd, YT, 2);
      b.part('Top doorway and slits');
      flighttowerDoorway(b, P3);
      slits(P3.yd, 99);

      b.part('Corbels and parapet');
      b.unit(function () {
        // a ring of stepped corbels carrying the parapet out past the wall
        for (var i = 0; i < 20; i++) {
          var a = i / 20 * Math.PI * 2 + 0.08, p = polar(a, R1 + 0.3, YT - 0.62), q = polar(a, R1 + 0.38, YT - 0.32);
          b.box(p[0], p[1], p[2], 0.3, 0.3, 0.5, { ry: Math.PI / 2 - a, c: 'sandstone', bevel: 0.04 });
          b.box(q[0], q[1], q[2], 0.34, 0.32, 0.62, { ry: Math.PI / 2 - a, c: 'sandstone', bevel: 0.04 });
        }
      });
      flighttowerRing(b, { cx: TX, cz: TZ, y0: YT, h: 0.3, course: 0.3, r: R1 + 0.36, thick: 0.62, len: 0.9, pal: 'sandstone', core: true });
      b.unit(function () {
        // the lookout floor, plank by plank, inside the parapet
        var rr = R1 + 0.2;
        for (var z = -rr + 0.15; z < rr; z += 0.29) { var hl = Math.sqrt(Math.max(0, rr * rr - z * z)); if (hl < 0.2) continue; b.box(TX + b.j(0.02), YT + 0.3, TZ + z, hl * 2, 0.07, 0.27, { c: b.pick(TONES), m: M.wood, bevel: 0.012, ao: 0.25 }); }
      });
      flighttowerRing(b, { cx: TX, cz: TZ, y0: YT + 0.3, h: 0.9, course: 0.45, r: R1 + 0.4, thick: 0.34, len: 0.62, pal: 'stone', core: false });

      b.part('Lookout');
      var NP = 8, ph = 3.0, py = YT + 0.37, pr = R1 + 0.03;
      b.unit(function () {
        for (var i = 0; i < NP; i++) { var a = (i + 0.5) / NP * Math.PI * 2, p = polar(a, pr, py); b.post(p[0], p[1], p[2], 0.1, ph, { c: 'beam', ry: Math.PI / 2 - a }); }
      });
      b.unit(function () {
        for (var i = 0; i < NP; i++) {
          var a0 = (i + 0.5) / NP * Math.PI * 2, a1 = (i + 1.5) / NP * Math.PI * 2, p = polar(a0, pr, py + ph - 0.1), q = polar(a1, pr, py + ph - 0.1);
          b.beam(p, q, 0.1, { c: 'beam' });
          // knee braces under the plate
          var am = (a0 + a1) / 2, m = polar(am, pr * Math.cos(Math.PI / NP), py + ph - 0.18);
          b.beam(polar(a0, pr, py + ph - 0.75), [(p[0] + m[0]) / 2, py + ph - 0.18, (p[2] + m[2]) / 2], 0.045, { c: 'beam' });
          b.beam(polar(a1, pr, py + ph - 0.75), [(q[0] + m[0]) / 2, py + ph - 0.18, (q[2] + m[2]) / 2], 0.045, { c: 'beam' });
        }
      });
      b.part('Roof');
      var ey = py + ph;
      b.coneRoof(TX, ey, TZ, R1 + 0.75, 3.4, { m: 'slate', rows: 7, flare: 0.5, seg: 22 });
      b.unit(function () {
        var top = ey + 3.4 - 0.3;
        b.cyl(TX, top, TZ, 0.07, 0.7, { c: 'iron', m: M.metal, seg: 6, r2: 0.04 });
        flighttowerHead(b, TX - 0.1, top + 0.55, TZ, 0.6, 0.75, { c: '#1f1e1c' });
        b.flag(TX, top + 0.55, TZ, 1.7, 1.5, 0.55, { c: 'ember', pennant: true, ry: -0.7, pr: 0.045 });
      });

      b.part('Banner');
      b.unit(function () {
        var a = DOOR_A, r = rOut(5.0), ry = Math.PI / 2 - a, bp = polar(a, r + 0.42, 6.3), ap = polar(a, r - 0.05, 6.3);
        b.beam(ap, bp, 0.045, { c: 'iron', m: M.metal });
        b.push(bp[0], bp[1], bp[2], ry);
        b.beam([-0.8, 0.02, 0], [0.8, 0.02, 0], 0.04, { c: 'iron', m: M.metal, round: true });
        b.banner(0, 0, 0, 1.3, 2.7, { c: 'ink', emblem: 'none', tail: 'swallow', band: 'ember', bandAt: 0.7, bandH: 0.05, trim: 'iron' });
        flighttowerEmblem(b, 0, -1.05, 0, 1.0, '#f1eee8');
        b.pop();
      });
      b.unit(function () { [-1, 1].forEach(function (s) { var p = polar(DOOR_A + s * 0.42, rOut(2.4) - 0.02, 2.2); b.torch(p[0], p[1], p[2], { s: 0.6, ry: Math.PI / 2 - DOOR_A - s * 0.42 }); }); });

      b.part('Signal horn and lookout stores');
      b.unit(function () {
        // a long bone signal horn on two forked props, a water barrel and spears against the parapet, up in the lookout
        var fy = YT + 0.37, a = -0.6, p = polar(a, 0.8, fy), ry = Math.atan2(-Math.cos(a), -Math.sin(a));
        b.push(p[0], fy, p[2], ry);
        [[-0.45, 0.86], [0.2, 0.92]].forEach(function (q) { [-1, 1].forEach(function (sd) { b.beam([q[0], 0, sd * 0.2], [q[0], q[1], 0], 0.03, { c: 'wood' }); }); });
        b.cyl(-0.7, 1.0, 0, 0.17, 0.72, { r2: 0.1, rz: -Math.PI / 2, c: '#efebe4', m: M.paint, seg: 12 });
        b.cyl(0.0, 1.0, 0, 0.1, 0.62, { r2: 0.035, rz: -Math.PI / 2 + 0.4, c: '#e6e0d2', m: M.paint, seg: 10 });
        [-0.66, -0.1].forEach(function (x, i) { b.cyl(x, 1.0, 0, i ? 0.115 : 0.175, 0.05, { rz: -Math.PI / 2, c: 'iron', m: M.metal, seg: 12 }); });
        b.pop();
        var q = polar(-1.75, 1.75, fy); b.barrel(q[0], fy, q[2], { h: 0.8, r: 0.3 });
        [-0.25, -0.1].forEach(function (aa, i) { var s = polar(aa, 2.4, fy), ra = Math.PI / 2 - aa; b.spear(s[0], fy, s[2], 2.0, { ry: ra, rx: 0.11, rz: i ? 0.06 : -0.05 }); });
      });

      b.part('Winch and hoist rope');
      // the winch stands in the yard below the low platform's boom
      var bx = pw(P1, -(P1.W / 2 - 0.47), P1.yd + 2.27, rOut(P1.yd) + P1.L + 0.7), WX = 4.0, WZ = 3.4, wry = -1.19;
      b.unit(function () {
        b.push(WX, 0, WZ, wry);
        [-0.62, 0.62].forEach(function (x) {
          b.beam([x, 0, -0.45], [x, 1.05, 0], 0.06, { c: 'wood' }); b.beam([x, 0, 0.45], [x, 1.05, 0], 0.06, { c: 'wood' });
          b.box(x, 0, 0, 0.14, 0.12, 1.1, { c: 'wood', m: M.wood, bevel: 0.02 });
        });
        b.cyl(-0.58, 0.9, 0, 0.26, 1.16, { c: 'woodLight', m: M.wood, rz: -Math.PI / 2, seg: 12 });
        for (var i = 0; i < 7; i++) b.cyl(-0.4 + i * 0.13, 0.9, 0, 0.275, 0.07, { c: 'rope', m: M.rope, rz: -Math.PI / 2, seg: 12 });
        [-1, 1].forEach(function (s) { b.beam([s * 0.7, 0.9, 0], [s * 0.82, 0.9, 0], 0.03, { c: 'iron', m: M.metal }); b.beam([s * 0.82, 0.9, 0], [s * 0.82, 1.05, -0.3], 0.025, { c: 'iron', m: M.metal }); b.beam([s * 0.82, 1.05, -0.3], [s * 0.98, 1.05, -0.3], 0.03, { c: 'woodDark', round: true }); });
        b.pop();
      });
      b.unit(function () {
        // the rope from the drum up to the pulley, and down from it to the load
        var d = [WX + Math.sin(wry) * 0.0, 1.16, WZ];
        b.beam(d, [bx[0], bx[1] - 0.12, bx[2]], 0.018, { c: 'rope', m: M.rope, round: true, seg: 5 });
        var hy = P1.yd + 1.0;
        b.beam([bx[0], bx[1] - 0.15, bx[2]], [bx[0], hy, bx[2]], 0.018, { c: 'rope', m: M.rope, round: true, seg: 5 });
        b.addGeo(new T.TorusGeometry(0.06, 0.015, 4, 10), { x: bx[0], y: hy - 0.04, z: bx[2], c: 'iron', m: M.metal, ao: 0 });
        [0, 1.57, 3.14, 4.71].forEach(function (a) { b.beam([bx[0], hy - 0.08, bx[2]], [bx[0] + Math.cos(a) * 0.3, hy - 0.62, bx[2] + Math.sin(a) * 0.3], 0.012, { c: 'rope', m: M.rope, round: true, seg: 4 }); });
        flighttowerBasket(b, bx[0], hy - 1.05, bx[2], { r: 0.36, h: 0.44, n: 8 });
      });
      b.unit(function () { b.ropeCoil(WX + 0.2, 0, WZ + 1.2, 0.28); b.ropeCoil(WX + 0.25, 0.1, WZ + 1.18, 0.22); });

      b.part('Ladders');
      b.unit(function () {
        // from the yard up to the low platform
        var p = pw(P1, -P1.W / 2 - 0.08, 0, rOut(P1.yd) + 1.2);
        b.ladder(p[0], 0, p[2], P1.yd + 0.95, { ry: Math.PI / 2 - P1.a - Math.PI / 2, lean: 0.75, w: 0.55 });
      });
      b.unit(function () {
        // a second ladder against the wall by the door, where the banner was hung
        var a = 2.25, p = polar(a, rOut(2.5) + 0.02, 0);
        b.ladder(p[0], 0, p[2], 4.6, { ry: Math.PI / 2 - a, lean: 0.8, w: 0.5 });
      });

      b.part('Saddles and stores');
      b.unit(function () { flighttowerSaddle(b, 2.6, 6.2, 0.5); });
      b.unit(function () {
        b.barrel(6.7, 0, 3.7, {}); b.barrel(7.3, 0, 4.3, { h: 0.82 }); b.barrel(6.5, 0, 4.6, { lie: true, ry: 0.6 });
        flighttowerBasket(b, 5.3, 0, 4.7, {}); flighttowerBasket(b, 4.7, 0, 5.4, { r: 0.3, n: 6 });
      });
      b.unit(function () {
        b.crate(-4.9, 0, 2.6, 0.75, { ry: 0.3 }); b.crate(-4.85, 0.75, 2.62, 0.58, { ry: 0.1 }); b.crate(-5.7, 0, 3.3, 0.7, { ry: -0.2 });
        b.sack(-4.1, 0, 3.4, 0.5); b.sack(-4.5, 0, 3.9, 0.44);
      });
      b.unit(function () {
        // a stone water trough
        var x = -3.4, z = 5.4;
        b.push(x, 0, z, 0.35);
        b.box(0, 0, 0, 2.0, 0.14, 0.8, { c: 'stoneDark', bevel: 0.03 });
        [-1, 1].forEach(function (sd) {
          b.box(sd * 0.03, 0.12, sd * 0.32, 1.96, 0.44, 0.15, { c: 'stone', bevel: 0.04, ry: b.j(0.01) });
          b.box(sd * 0.92, 0.12, 0, 0.15, 0.44, 0.5, { c: 'sandstone', bevel: 0.04 });
        });
        b.box(0, 0.14, 0, 1.7, 0.34, 0.5, { c: '#4f626c', m: M.water, bevel: 0, ao: 0 });
        b.pop();
        b.bucket(x + 1.3, 0, z - 0.2);
      });
      b.unit(function () {
        [0, 1, 2].forEach(function (i) { var a = 2.55 + i * 0.32, p = polar(a, rOut(1.0) + 0.06, 1.02); flighttowerShield(b, p[0], p[1], p[2], Math.PI / 2 - a + 0.0, i === 1 ? 'bone' : 'ink', i === 1 ? 'ink' : 'bone', 0.85); });
      });
      b.unit(function () { b.woodpile(-6.0, -1.2, { ry: 1.2, n: 4, len: 1.6 }); b.hay(-5.4, 0, 0.8, { ry: 0.4 }); b.hay(-5.6, 0.55, 0.75, { ry: 0.55, w: 1.0 }); });
      b.unit(function () {
        // a cart of fish come up from the harbour
        b.cart(-5.4, 6.0, { ry: 0.95, load: function (bb) { flighttowerBasket(bb, -0.3, 0.77, -0.5, { r: 0.32, n: 6 }); flighttowerBasket(bb, 0.32, 0.77, 0.1, { r: 0.3, n: 6 }); bb.barrel(-0.25, 0.77, 0.55, { h: 0.7, r: 0.27 }); } });
      });

      b.part('Platform stores');
      b.unit(function () {
        // barrels and a coil of rope by the middle platform's doorway, a crate of spears near its tip
        var q1 = pw(P2, -1.0, P2.yd, rOut(P2.yd) + 0.75), q2 = pw(P2, -0.95, P2.yd, rOut(P2.yd) + 1.45), q3 = pw(P2, 0.95, P2.yd, rOut(P2.yd) + 2.6);
        b.barrel(q1[0], q1[1], q1[2], { h: 0.95 }); b.barrel(q2[0], q2[1], q2[2], { h: 0.8, r: 0.3 });
        b.ropeCoil(q3[0], q3[1], q3[2], 0.32);
        var q4 = pw(P2, 0.85, P2.yd, rOut(P2.yd) + P2.L - 1.6), ry4 = Math.PI / 2 - P2.a;
        b.crate(q4[0], q4[1], q4[2], 0.62, { ry: ry4 + 0.2 });
        [-0.12, 0.0, 0.13].forEach(function (dx, i) { b.spear(q4[0] + dx, q4[1] + 0.3, q4[2] + (i - 1) * 0.08, 1.9, { rx: -0.1 + i * 0.08 }); });
      });

      b.part('Ivy and flowers');
      b.unit(function () {
        var a = 2.4, n = [Math.cos(a), 0, Math.sin(a)], p = polar(a, rOut(1) + 0.15, 0.4);
        b.ivy([[p[0], 0.4, p[2]], [p[0] + 0.1, 1.8, p[2]], [p[0] - 0.05, 3.0, p[2] + 0.05]], n, { density: 6, spread: 0.5 });
        var a2 = 0.7, n2 = [Math.cos(a2), 0, Math.sin(a2)], p2 = polar(a2, rOut(1) + 0.15, 0.4);
        b.ivy([[p2[0], 0.4, p2[2]], [p2[0] - 0.1, 1.6, p2[2]], [p2[0], 2.4, p2[2]]], n2, { density: 5, spread: 0.45 });
        var q = polar(1.95, R0 + 1.25, 0); b.bush(q[0], q[2], 0.5, { flowers: '#f3f1ec', n: 2 });
        var q2 = polar(1.15, R0 + 1.25, 0); b.bush(q2[0], q2[2], 0.45, { flowers: '#e6e0d2', n: 2 });
      });

      // ---- the people
      b.life(function () {
        // the lookout at the top, pointing out over the island
        var lk = polar(1.85, R1 - 0.27, YT + 0.37); b.figure(lk[0], lk[2], { role: 'soldier', pose: 'point', y: lk[1], ry: Math.PI / 2 - 1.85 - 0.3 });
        // on the middle platform a sentry at the tip looks out over the island, and a villager calls to him
        var s2 = pw(P2, -0.35, 0, rOut(P2.yd) + P2.L - 0.95); b.figure(s2[0], s2[2], { role: 'soldier', pose: 'spear', y: P2.yd, ry: Math.PI / 2 - P2.a - 0.25 });
        var h2 = pw(P2, 0.9, 0, rOut(P2.yd) + 1.55); b.figure(h2[0], h2[2], { role: 'villager', pose: 'talk', y: P2.yd, ry: Math.PI / 2 - P2.a - 0.6, c: '#5c5e62' });
        // on the top platform, waving to the yard below
        var h3 = pw(P3, -0.4, 0, rOut(P3.yd) + 2.6); b.figure(h3[0], h3[2], { role: 'villager', pose: 'flighttowerWave', y: P3.yd, ry: Math.PI / 2 - P3.a - 0.2 });
        // on the low platform, reaching for the basket coming up
        var h1 = pw(P1, -0.5, 0, rOut(P1.yd) + P1.L - 0.45); b.figure(h1[0], h1[2], { role: 'villager', pose: 'flighttowerReach', y: P1.yd, ry: Math.PI / 2 - P1.a, c: '#6e5a44' });
        // climbing the ladder
        var lp = pw(P1, -P1.W / 2 - 0.08 - 0.95, 0, rOut(P1.yd) + 1.2);
        b.figure(lp[0], lp[2], { role: 'villager', pose: 'flighttowerClimb', y: 1.25, ry: Math.PI / 2 - P1.a + Math.PI / 2 });
        // at the winch
        var wk = [WX + 0.9 * Math.cos(wry) - 0.82 * Math.sin(wry), WZ - 0.9 * Math.sin(wry) - 0.82 * Math.cos(wry)];
        b.figure(wk[0], wk[1], { role: 'villager', pose: 'flighttowerCrank', ry: wry, c: '#3b3a38' });
        // a guard by the door, a child waving back up at the tower, and a carrier
        var gd = polar(DOOR_A - 0.55, R0 + 1.25, 0); b.figure(gd[0], gd[2], { role: 'soldier', pose: 'spear', ry: Math.PI / 2 - DOOR_A + 0.3 });
        b.figure(3.4, 8.6, { role: 'child', pose: 'cheer', ry: 3.0 });
        b.figure(0.2, 8.4, { role: 'villager', pose: 'carry', ry: -2.7, c: '#6e5a44' });
      });
    }
  });
})();
