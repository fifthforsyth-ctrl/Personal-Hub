// Windmill: a battered stone tower mill grinding flour for the army. Built footings first, the tower course by course
// (laid stone by stone and cut back round the door and windows), the reefing stage on its knee braces, the upper
// tower, the curb, the timber cap board by board and its shingles row by row, the windshaft and the four lattice sails
// (two clothed, two furled), the tail pole, a granary on staddle stones with dragon-head barge boards, then the yard:
// the sack hoist (its jib carved as a dragon's neck) over a cart of flour, spare millstones, a stone being dressed on
// trestles, a stubble field of stooks, a beehive bread oven, and last the miller and his people.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL, G = KIT.geo, TAU = Math.PI * 2;
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  PAL.windmillShingle = ['#3e3a35', '#36332f', '#45403a', '#3a3632', '#312e2b'];
  PAL.windmillFlour = ['#ece8df', '#e6e1d6', '#f0ece4', '#e0dbd0'];
  PAL.windmillSack = ['#cdbd9c', '#d5c6a6', '#c8b693'];
  PAL.windmillWheat = ['#c9b385', '#c2ab7c', '#cfba8f'];

  // hauling a rope hand over hand, leaning back and looking up at the pulley
  KIT.people.poses.windmill_haul = function () { return { feet: [V(-0.15, 0.09, -0.1), V(0.15, 0.09, 0.16)], hands: [V(-0.07, 1.3, 0.42), V(0.06, 1.56, 0.46)], lean: -0.14, twist: 0.05, side: 0, hip: 0, drop: 0.04, head: [0.05, -0.3], pole: [V(-0.8, -0.6, -0.3), V(0.8, -0.6, -0.3)] }; };

  // a point beside a figure at (x, z) turned ry, from its own frame
  function wmBy(x, z, ry, lx, ly, lz) { return [x + lx * Math.cos(ry) + lz * Math.sin(ry), ly, z - lx * Math.sin(ry) + lz * Math.cos(ry)]; }
  // Euler angles (YXZ) that turn +y onto d
  function wmAim(d) { var q = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize()); return new T.Euler().setFromQuaternion(q, 'YXZ'); }
  function wmRotX(b, a) { b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(a)); }
  function wmRotZ(b, a) { b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(a)); }

  // a curved stone: the ring sector between radii ri and ro, angles a0..a1 (0 = +x, PI/2 = +z), h tall
  function wmArcStone(ri, ro, a0, a1, h, bev) {
    var n = Math.max(2, Math.ceil((a1 - a0) / 0.14)), sh = new T.Shape(), i, a;
    for (i = 0; i <= n; i++) { a = a0 + (a1 - a0) * i / n; if (i === 0) sh.moveTo(Math.cos(a) * ro, -Math.sin(a) * ro); else sh.lineTo(Math.cos(a) * ro, -Math.sin(a) * ro); }
    for (i = n; i >= 0; i--) { a = a0 + (a1 - a0) * i / n; sh.lineTo(Math.cos(a) * ri, -Math.sin(a) * ri); }
    bev = Math.min(bev, h * 0.3);
    var g = new T.ExtrudeGeometry(sh, { depth: Math.max(0.01, h - 2 * bev), bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelOffset: -bev, bevelSegments: 1, steps: 1, curveSegments: 1 });
    g.rotateX(-Math.PI / 2); g.translate(0, bev, 0); g.deleteAttribute('uv');
    return G.flat(g);
  }
  // A battered round wall of stones, course by course (one step each): rf(y) is the wall's centre line. Openings
  // [{a, y0, y1, hw (metres, or fn(y))}] cut the stones back to the opening's edge, so doors and windows stay crisp.
  function wmRing(b, cx, cz, rf, y0, y1, thick, o) {
    o = o || {};
    var n = Math.max(1, Math.round((y1 - y0) / (o.course || 0.38))), ch = (y1 - y0) / n, len = o.len || 0.62, ops = o.openings || [];
    for (var k = 0; k < n; k++) (function (k) {
      var y = y0 + k * ch, yc = y + ch / 2, rr = rf(yc), ro0 = rr + thick / 2, ri = rr - thick / 2;
      b.unit(function () {
        if (o.core !== false) b.cyl(cx, y, cz, rr - thick * 0.45, ch, { c: o.mortar || '#8a7e6c', m: M.stone, seg: 36, ao: 0.1, jit: 0.01 });
        var cuts = [];
        ops.forEach(function (op) {
          if (yc <= op.y0 || yc >= op.y1) return;
          var hw = typeof op.hw === 'function' ? op.hw(yc) : op.hw; if (!(hw > 0)) return;
          var da = hw / ro0;
          for (var m = -1; m <= 1; m++) cuts.push([op.a - da + m * TAU, op.a + da + m * TAU]);
        });
        var st = (k % 2) * 0.5 * len / rr + b.r() * 0.15, edges = [st], t = st;
        for (;;) { t += len * (0.7 + b.r() * 0.6) / rr; if (t > st + TAU - 0.45 * len / rr) break; edges.push(t); }
        edges.push(st + TAU);
        for (var i = 0; i < edges.length - 1; i++) {
          var pieces = [[edges[i], edges[i + 1], 0, 0]];
          cuts.forEach(function (c) { var nk = []; pieces.forEach(function (p) { if (p[1] <= c[0] || p[0] >= c[1]) { nk.push(p); return; } if (p[0] < c[0]) nk.push([p[0], c[0], p[2], 1]); if (p[1] > c[1]) nk.push([c[1], p[1], 1, p[3]]); }); pieces = nk; });
          pieces.forEach(function (p) {
            var a0 = p[0] + (p[2] ? 0.01 : 0.035) / rr, a1 = p[1] - (p[3] ? 0.01 : 0.035) / rr;
            if ((a1 - a0) * rr < 0.1) return;
            var hh = ch * (0.88 + b.j(0.05)), ro = ro0 + b.j(0.02);
            b.addGeo(wmArcStone(ri, ro, a0, a1, hh, Math.min(0.06, hh * 0.18)), { x: cx, y: y + (ch - hh) / 2, z: cz, c: b.stoneC(o.pal || 'stone', y), m: M.stone, ao: 0.18, jit: 0.04 });
          });
        }
      });
    })(k);
  }
  // vertical boards in the local XY plane from x0 to x1, standing on y0 up to top(x) (or a number), centred on z
  function wmBoards(b, x0, x1, y0, top, z, o) {
    o = o || {}; var pw = o.pw || 0.26, n = Math.max(1, Math.round((x1 - x0) / pw)), w = (x1 - x0) / n, t = o.t || 0.07;
    for (var i = 0; i < n; i++) {
      var xc = x0 + (i + 0.5) * w, yt = typeof top === 'function' ? Math.min(top(xc - w / 2), top(xc + w / 2)) : top;
      if (yt - y0 < 0.05) continue;
      b.box(xc, y0, z + b.j(0.008), w - 0.02, yt - y0, t, { c: o.c || (b.chance(0.3) ? 'woodLight' : 'wood'), m: M.wood, bevel: 0.01, ao: 0.3 });
    }
  }
  // crossed barge boards on a gable in the local XY plane at z = 0: half the span, the eave line yE, the rise, the
  // overhang; they cross above the apex and stand proud as horns
  function wmBarge(b, half, yE, rise, over, o) {
    o = o || {}; var tan = rise / half, ext = o.ext || 0.42;
    [-1, 1].forEach(function (sd) {
      var x0 = sd * (half + over), y0 = yE - over * tan + 0.06, x1 = 0, y1 = yE + rise + 0.06, L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, nx = -uy, ny = ux;
      var xe = x1 + ux * ext, ye = y1 + uy * ext, hw = 0.1;
      b.extrude(0, 0, 0, [[x0 + nx * hw, y0 + ny * hw], [x0 - nx * hw, y0 - ny * hw], [xe - nx * hw, ye - ny * hw], [xe + nx * hw, ye + ny * hw]], 0.07, { c: o.c || 'beam', m: M.wood, bevel: 0.01 });
      if (o.knob) b.ball(xe, ye, 0, 0.09, { c: o.c || 'beam', m: M.wood, detail: 1 });
    });
  }
  // a carved dragon-head finial, the profile in the local XY plane, snout toward local +x, neck foot at (x, y, z)
  var WM_HEAD = [[-0.1, 0], [-0.17, 0.28], [-0.15, 0.52], [-0.07, 0.74], [0.04, 0.9], [-0.04, 1.14], [0.14, 1.0], [0.24, 1.06], [0.36, 1.05], [0.5, 1.0], [0.74, 0.95],
    [0.85, 0.9], [0.8, 0.86], [0.6, 0.85], [0.42, 0.82], [0.62, 0.76], [0.71, 0.7], [0.64, 0.67], [0.4, 0.66], [0.22, 0.6], [0.12, 0.45], [0.09, 0.22], [0.12, 0]];
  function wmHead(b, x, y, z, ry, s, o) {
    o = o || {}; var c = o.c || 'beam';
    b.push(x, y, z, ry);
    if (o.rz) wmRotZ(b, o.rz);
    b.extrude(0, 0, 0, WM_HEAD.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.14 * s, { c: c, m: M.wood, ao: 0.1, bevel: 0.01 });
    [[[-0.15, 0.36], [-0.34, 0.44], [-0.15, 0.52]], [[-0.1, 0.6], [-0.3, 0.72], [-0.06, 0.74]], [[0.0, 0.84], [-0.18, 1.0], [0.04, 0.92]]].forEach(function (f) {
      b.extrude(0, 0, 0, f.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.07 * s, { c: c, m: M.wood, ao: 0.05, bevel: 0.005 });
    });
    [1, -1].forEach(function (sd) {
      b.ball(0.43 * s, 0.93 * s, sd * 0.075 * s, 0.035 * s, { c: 'bone', m: M.paint, ao: 0, detail: 0 });
      b.box(0.4 * s, 0.97 * s, sd * 0.07 * s, 0.16 * s, 0.03 * s, 0.03 * s, { c: c, m: M.wood, bevel: 0.004, rz: -0.25 });
    });
    b.box(0, 0, 0, 0.34 * s, 0.07 * s, 0.18 * s, { c: c, m: M.wood, bevel: 0.01 });
    b.pop();
  }
  // a sack lying on its side, its tied neck toward local +z; s is its length
  function wmSack(b, x, y, z, ry, s, c) {
    b.push(x, y, z, ry);
    b.ball(0, s * 0.21, 0, s * 0.5, { sx: 0.62, sy: 0.42, sz: 1.0, c: c || 'windmillFlour', m: M.cloth, detail: 2, smooth: true, ao: 0.35 });
    b.cone(0, s * 0.21, s * 0.44, s * 0.11, s * 0.2, { c: c || 'windmillFlour', m: M.cloth, seg: 7, rx: Math.PI / 2 });
    b.cyl(0, s * 0.21, s * 0.47, s * 0.07, 0.04, { c: 'rope', m: M.rope, seg: 7, rx: Math.PI / 2 });
    b.pop();
  }
  // a millstone lying flat: the eye, an iron hoop, and (o.furrows) the dressed harps on its grinding face
  function wmMillstone(b, x, y, z, r, h, o) {
    o = o || {};
    b.cyl(x, y, z, r, h, { c: o.c || '#b9b2a2', m: M.stone, seg: 26, flat: true });
    b.cyl(x, y + h * 0.35, z, r + 0.012, h * 0.3, { c: 'iron', m: M.metal, seg: 26, open: true });
    b.cyl(x, y + h, z, r * 0.17, 0.012, { c: '#2b2420', m: M.dark, seg: 12 });
    if (o.furrows) for (var i = 0; i < 10; i++) { var a = i / 10 * TAU; b.box(x + Math.cos(a + 0.3) * r * 0.56, y + h, z + Math.sin(a + 0.3) * r * 0.56, r * 0.72, 0.014, 0.035, { ry: -a, c: '#6f675b', m: M.stone, bevel: 0, ao: 0, jit: 0.02 }); }
  }
  // a sawhorse along local x, L long and h high
  function wmTrestle(b, x, z, ry, L, h) {
    b.push(x, 0, z, ry);
    b.box(0, h - 0.11, 0, L, 0.11, 0.14, { c: 'woodLight', m: M.wood });
    [-1, 1].forEach(function (s) { [-1, 1].forEach(function (f) { b.beam([s * (L / 2 - 0.14), h - 0.06, 0], [s * (L / 2 - 0.04), 0, f * 0.26], 0.035, { c: 'wood' }); }); });
    b.pop();
  }
  // a stook: n sheaves of wheat leaning together, bound with a twist of straw
  function wmStook(b, x, z, n) {
    var y = b.ground ? b.ground.height(x, z) - 0.04 : 0;
    for (var i = 0; i < n; i++) {
      var a = i / n * TAU + b.j(0.2), d = V(-Math.cos(a) * 0.3, 1, -Math.sin(a) * 0.3), e = wmAim(d), bx = x + Math.cos(a) * 0.34, bz = z + Math.sin(a) * 0.34;
      b.lathe(bx, y, bz, [[0.01, 0], [0.13, 0.02], [0.11, 0.5], [0.075, 0.66], [0.2, 0.98], [0.17, 1.14], [0.07, 1.26], [0.01, 1.3]], { c: b.pick(PAL.windmillWheat), m: M.straw, seg: 9, flat: true, rx: e.x, ry: e.y, rz: e.z });
      var q = d.clone().normalize().multiplyScalar(0.62);
      b.cyl(bx + q.x, y + q.y, bz + q.z, 0.085, 0.06, { c: 'rope', m: M.rope, seg: 8, rx: e.x, ry: e.y, rz: e.z });
    }
  }
  // the mill-sail emblem, drawn just proud of both faces of a banner (in the banner's frame), following its folds
  function wmEmblem(b, h, cy, s, ec) {
    var shapes = [], i, seed = b.seed;
    var rot = function (pts, a) { var c = Math.cos(a), sn = Math.sin(a); return pts.map(function (p) { return [p[0] * c - p[1] * sn, p[0] * sn + p[1] * c]; }); };
    for (i = 0; i < 4; i++) {
      var a = Math.PI / 4 + i * Math.PI / 2;
      shapes.push(rot([[-0.035, 0.07], [0.035, 0.07], [0.035, 0.5], [-0.035, 0.5]], a));
      shapes.push(rot([[0.06, 0.16], [0.21, 0.16], [0.21, 0.48], [0.06, 0.48]], a));
    }
    var hub = []; for (i = 0; i < 8; i++) { var q = i / 8 * TAU; hub.push([Math.cos(q) * 0.08, Math.sin(q) * 0.08]); }
    shapes.push(hub);
    shapes.forEach(function (pts) {
      var g = G.extrude(pts.map(function (p) { return [p[0] * s, p[1] * s + cy]; }), 0.006), P = g.attributes.position;
      for (var k = 0; k < P.count; k++) { var px = P.getX(k), t = -P.getY(k) / h; P.setZ(k, P.getZ(k) + Math.sin(px * 3.1 + t * 2.0 + seed) * 0.05 * t); }
      [0.014, -0.014].forEach(function (dz) { b.addGeo(g, { z: dz, c: ec, m: M.cloth, bucket: 'cloth', ao: 0, jit: 0.01, vary: 0.02 }); });
    });
  }

  KIT.defineBuild('windmill', {
    name: 'Windmill', size: 'middle', need: 45,
    line: 'A stone tower mill with a timber cap and four lattice sails, grinding flour for the army: sacks on the cart, a granary on staddle stones, a bread oven, and the miller at his door.',
    r: 13.5, flat: [16, 13], ground: 'cobble', path: [[2.2, 14.8], [0.9, 3.4]],
    frameY: 6.0, frameR: 13.0, glowAt: [0.5, 14.2, -0.6],
    trees: [{ x: -9.8, z: -5.2, kind: 'pine', h: 7.2 }, { x: -7.4, z: -8.2, kind: 'pine', h: 6.0 }, { x: 8.6, z: 7.4, kind: 'round', h: 5.4 }, { x: -10.6, z: -1.2, kind: 'olive', h: 4.4 }],
    bushes: [{ x: 10.4, z: 4.6, r: 0.9, flowers: '#f3f1ec' }, { x: -8.6, z: 7.2, r: 0.8 }, { x: 10.6, z: -2.6, r: 0.7 }, { x: -2.6, z: -9.6, r: 0.8 }],
    islandOpts: { cobbleSkip: function (x, z) { return Math.hypot(x - 0.6, z + 0.8) < 2.6; } },
    build: function (b) {
      var tx = 0.6, tz = -0.8, yb = 0.45, yS = 3.5, yTop = 10.6, R0 = 2.65, R1 = 1.9, TH = 0.6;
      var BAT = Math.atan((R0 - R1) / (yTop - yb));
      function rf(y) { return R0 + (R1 - R0) * (y - yb) / (yTop - yb); }
      function face(y) { return rf(y) + TH / 2; }
      function faceRy(a) { return Math.atan2(Math.cos(a), Math.sin(a)); }
      // a frame standing on the tower's face at angle a, height y, leaning back with the batter (local +z out)
      function onFace(a, y, out) { var r = face(y) + (out || 0); b.push(tx + Math.cos(a) * r, y, tz + Math.sin(a) * r, faceRy(a)); wmRotX(b, -BAT); }
      function P(a, r, y) { return [tx + Math.cos(a) * r, y, tz + Math.sin(a) * r]; }
      var capRy = -0.2;

      // openings in the tower: the door, a window beside it; the stage door and three windows above
      var nL = 8, chL = (yS - yb) / nL, nU = 18, chU = (yTop - yS) / nU;
      var door = { a: Math.PI / 2, w: 1.2, h: 2.3 };
      var winL = { a: Math.PI / 2 + 1.2, y0: yb + 3 * chL, y1: yb + 5 * chL, w: 0.5 };
      var sDoor = { a: 0.85, w: 0.8, y0: yS, y1: yS + 5 * chU };
      var winsU = [{ a: Math.PI / 2 + 0.95, y0: yS + 8 * chU, y1: yS + 10 * chU, w: 0.48 }, { a: 0.3, y0: yS + 11 * chU, y1: yS + 13 * chU, w: 0.45 }, { a: Math.PI + 0.55, y0: yS + 3 * chU, y1: yS + 5 * chU, w: 0.48 }, { a: Math.PI / 2 + 0.35, y0: yS + 14 * chU, y1: yS + 16 * chU, w: 0.42 }];
      var opsL = [
        { a: door.a, y0: yb - 0.1, y1: yb + door.h, hw: function (y) { var yr = y - yb, ar = door.w / 2; return yr < door.h - ar ? ar + 0.02 : Math.sqrt(Math.max(0, ar * ar - Math.pow(yr - (door.h - ar), 2))) + 0.02; } },
        { a: winL.a, y0: winL.y0, y1: winL.y1, hw: winL.w / 2 + 0.02 }
      ];
      var opsU = [{ a: sDoor.a, y0: sDoor.y0, y1: sDoor.y1, hw: sDoor.w / 2 + 0.03 }].concat(winsU.map(function (w) { return { a: w.a, y0: w.y0, y1: w.y1, hw: w.w / 2 + 0.02 }; }));
      function towerWindow(w, o) {
        o = o || {};
        onFace(w.a, w.y0);
        var hgt = w.y1 - w.y0;
        b.box(0, 0, -0.34, w.w + 0.06, hgt, 0.44, { c: '#1f1f21', m: M.window, ao: 0, jit: 0, bevel: 0 });
        b.box(0, 0, -0.1, 0.05, hgt, 0.05, { c: 'woodDark', m: M.wood, bevel: 0.01, ao: 0 });
        b.box(0, hgt * 0.5, -0.1, w.w, 0.05, 0.05, { c: 'woodDark', m: M.wood, bevel: 0.01, ao: 0 });
        b.box(0, -0.14, 0.02, w.w + 0.34, 0.14, 0.32, { c: 'sandstone', bevel: 0.03 });
        b.box(0, hgt - 0.02, 0.0, w.w + 0.4, 0.22, 0.3, { c: 'sandstone', bevel: 0.03 });
        [-1, 1].forEach(function (s) { b.box(s * (w.w * 0.75 + 0.05), 0.02, 0.06, w.w * 0.5, hgt - 0.04, 0.04, { c: '#1f1e1c', m: M.paint, ry: s * 0.18, bevel: 0.01 }); });
        if (o.flowers) {
          b.box(0, -0.42, 0.2, w.w + 0.22, 0.26, 0.28, { c: 'wood', m: M.wood, bevel: 0.02 });
          for (var f = 0; f < 6; f++) b.ball(-w.w / 2 + f * w.w / 5, -0.14, 0.22 + b.j(0.05), 0.08, { c: b.pick(['#f3f1ec', '#efebe4', '#e6e3dc']), m: M.paint, ao: 0, detail: 0 });
          for (var g2 = 0; g2 < 4; g2++) b.ball(-w.w / 2 + g2 * w.w / 3, -0.17, 0.26, 0.1, { c: 'leaf', m: M.leaf, ao: 0.2, detail: 0 });
        }
        b.pop();
      }

      b.part('Footings');
      b.unit(function () { b.cyl(tx, -0.12, tz, R0 + 0.87, 0.3, { c: 'stoneDark', m: M.stone, seg: 40, flat: true }); });
      wmRing(b, tx, tz, function () { return R0 + 0.39; }, 0.0, yb, 0.76, { pal: 'stoneDark', course: 0.45, len: 0.95 });

      b.part('Tower, lower courses');
      wmRing(b, tx, tz, rf, yb, yS, TH, { openings: opsL, course: chL });

      b.part('Doorway and window');
      b.unit(function () {
        onFace(door.a, yb, -0.02);
        b.archDoor(0, 0, 0, door.w, door.h, { depth: 0.66, keyC: 'sandstone', frameStone: 'sandstone', door: false });
        // the door stands open, hung on the right jamb
        b.push(door.w / 2, 0.02, 0.19, 1.75);
        for (var k = 0; k < 4; k++) { var u = (k + 0.5) * door.w / 4, dx = door.w / 2 - u, top = door.h - door.w / 2 + Math.sqrt(Math.max(0, door.w * door.w / 4 - dx * dx)) - 0.06; b.box(-u, 0, 0, door.w / 4 - 0.02, top, 0.07, { c: 'woodDark', m: M.wood, bevel: 0.012, ao: 0.3 }); }
        [0.45, 1.55].forEach(function (y) { b.box(-door.w * 0.47, y, 0.05, door.w * 0.88, 0.07, 0.03, { c: 'iron', m: M.metal, bevel: 0.01 }); });
        b.ball(-door.w * 0.8, 1.05, 0.06, 0.05, { c: 'iron', m: M.metal });
        b.pop();
        b.pop();
        // a worn step up to the threshold
        b.box(tx, 0, tz + R0 + 1.04, door.w + 0.4, 0.24, 0.48, { c: 'sandstone', bevel: 0.04 });
      });
      b.unit(function () { towerWindow(winL, { flowers: true }); });

      b.part('Reefing stage');
      var nJ = 16, rIn = face(yS) + 0.06, rOut = rIn + 1.12, rRail = rOut - 0.12;
      var nearOpening = function (a) { return [door.a, winL.a].some(function (oa) { return Math.abs(((a - oa) + Math.PI * 3) % TAU - Math.PI) < 0.34; }); };
      b.unit(function () {
        for (var i = 0; i < nJ; i++) {
          var a = (i + 0.5) / nJ * TAU;
          b.beam(P(a, rf(yS - 0.2) + 0.05, yS - 0.16), P(a, rOut + 0.12, yS - 0.16), 0.09, { c: 'beam' });
          if (nearOpening(a)) continue;
          // a knee brace on a sandstone corbel
          var yf = yS - 1.25, rfb = face(yf);
          b.beam(P(a, rfb - 0.04, yf), P(a, rIn + 0.7, yS - 0.24), 0.06, { c: 'beam' });
          var pc = P(a, rfb, yf - 0.14); b.box(pc[0], pc[1], pc[2], 0.26, 0.24, 0.3, { ry: faceRy(a), c: 'sandstone', bevel: 0.04 });
        }
      });
      for (var u = 0; u < 3; u++) (function (u) {
        b.unit(function () {
          for (var j = 0; j < 4; j++) {
            var rm = rIn + (j + 0.5) * (rOut - rIn) / 4, n = Math.ceil(TAU * rm / 0.78);
            for (var i = 0; i < n; i++) {
              var th = (i + 0.5 * (j % 2)) / n * TAU; if (th < u * TAU / 3 || th >= (u + 1) * TAU / 3) continue;
              var p = P(th, rm, yS - 0.07);
              b.box(p[0], p[1], p[2], 2 * rm * Math.sin(Math.PI / n) - 0.015, 0.07, (rOut - rIn) / 4 - 0.02, { ry: -th - Math.PI / 2, c: b.chance(0.3) ? 'wood' : 'woodLight', m: M.wood, bevel: 0.01, ao: 0.2 });
            }
          }
        });
      })(u);
      var nP = 24, postA = function (i) { return (i + 0.5) / nP * TAU + 0.05; };
      b.unit(function () {
        for (var i = 0; i < nP; i++) { var p = P(postA(i), rRail, yS); b.post(p[0], yS, p[2], 0.05, 1.05, { c: 'beam' }); b.cone(p[0], yS + 1.05, p[2], 0.07, 0.12, { c: 'beam', m: M.wood, seg: 6 }); }
      });
      b.unit(function () {
        for (var i = 0; i < nP; i++) {
          var a0 = postA(i), a1 = postA(i + 1);
          b.beam(P(a0, rRail, yS + 0.98), P(a1, rRail, yS + 0.98), 0.045, { c: 'wood' });
          b.beam(P(a0, rRail, yS + 0.5), P(a1, rRail, yS + 0.5), 0.03, { c: 'woodLight' });
        }
      });

      b.part('Tower, upper courses');
      wmRing(b, tx, tz, rf, yS, yTop, TH, { openings: opsU, course: chU });

      b.part('Stage door and windows');
      b.unit(function () {
        onFace(sDoor.a, yS);
        b.archDoor(0, 0, 0, sDoor.w, sDoor.y1 - sDoor.y0, { timber: true, arch: 0.02, depth: 0.66, door: false });
        b.pop();
        towerWindow(winsU[0], { flowers: true });
      });
      b.unit(function () { towerWindow(winsU[1]); towerWindow(winsU[2]); towerWindow(winsU[3]); });

      b.part('Curb and petticoat');
      b.unit(function () {
        // a ring of sandstone corbels carries the petticoat
        for (var i = 0; i < 26; i++) { var a = (i + 0.5) / 26 * TAU, p = P(a, face(yTop - 0.5) + 0.02, yTop - 0.66); b.box(p[0], p[1], p[2], 0.3, 0.34, 0.36, { ry: faceRy(a), c: 'sandstone', bevel: 0.05, taper: 1.0 }); }
        b.cyl(tx, yTop - 0.36, tz, R1 + 0.46, 0.1, { c: 'sandstone', m: M.stone, seg: 30, flat: true });
      });
      b.unit(function () {
        for (var i = 0; i < 18; i++) { var a = (i + 0.5) / 18 * TAU, p = P(a, R1, yTop); b.box(p[0], yTop, p[2], 2 * R1 * Math.sin(Math.PI / 18) + 0.02, 0.2, 0.62, { ry: -a - Math.PI / 2, c: 'beam', m: M.wood, bevel: 0.02 }); }
        b.cyl(tx, yTop + 0.2, tz, R1 + 0.3, 0.05, { c: 'woodDark', m: M.wood, seg: 36 });
      });
      b.unit(function () {
        for (var i = 0; i < 34; i++) { var a = i / 34 * TAU, p = P(a, R1 + 0.38, yTop - 0.32); b.box(p[0], p[1], p[2], 2 * (R1 + 0.38) * Math.sin(Math.PI / 34) - 0.02, 0.54 + b.j(0.02), 0.05, { ry: -a - Math.PI / 2, c: b.chance(0.3) ? 'woodLight' : 'wood', m: M.wood, bevel: 0.01 }); }
      });

      b.part('Timber cap');
      var yC = yTop + 0.25, cw = 1.75, cz0 = -2.0, cz1 = 2.2, eaveC = 1.05, riseC = 1.9;
      b.push(tx, yC, tz, capRy);
      b.unit(function () {
        [-1, 1].forEach(function (s) { b.box(s * 1.05, 0, 0.15, 0.24, 0.26, 4.5, { c: 'beam', m: M.wood, bevel: 0.03 }); });
        [-1.5, 0.1, 1.7].forEach(function (z) { b.box(0, 0.02, z, 3.5, 0.22, 0.22, { c: 'beam', m: M.wood, bevel: 0.03 }); });
        [-1, 1].forEach(function (s) { b.box(s * cw, 0.1, 0.1, 0.16, 0.14, cz1 - cz0, { c: 'beam', m: M.wood, bevel: 0.02 }); });
        [[-1, cz0], [1, cz0], [-1, cz1], [1, cz1]].forEach(function (c) { b.post(c[0] * cw, 0.1, c[1], 0.09, eaveC - 0.05, { c: 'beam' }); });
      });
      [-1, 1].forEach(function (s) {
        b.unit(function () {
          b.push(s * cw, 0.18, 0.1, s * Math.PI / 2);
          wmBoards(b, -(cz1 - cz0) / 2 + 0.1, (cz1 - cz0) / 2 - 0.1, 0, eaveC - 0.24, 0, { t: 0.06 });
          b.pop();
          b.box(s * cw, eaveC - 0.12, 0.1, 0.18, 0.14, cz1 - cz0 + 0.1, { c: 'beam', m: M.wood, bevel: 0.02 });
        });
      });
      b.unit(function () {
        [[cz1, 0], [cz0, Math.PI]].forEach(function (g) {
          b.push(0, 0.18, g[0], g[1]);
          wmBoards(b, -cw + 0.09, cw - 0.09, 0, function (x) { return eaveC - 0.18 + riseC * (1 - Math.abs(x) / cw) - 0.12; }, 0, { t: 0.06, pw: 0.24 });
          b.pop();
        });
      });

      b.part('Cap roof');
      b.gableRoof(0, eaveC, 0.1, cz1 - cz0, 2 * cw, riseC, { ry: Math.PI / 2, m: 'slate', c: 'windmillShingle', over: 0.3, overX: 0.3, rows: 5 });
      b.unit(function () {
        // crossed barge boards at both ends; a carved dragon head looks back over the tail
        b.push(0, 0, cz1 + 0.34, 0); wmBarge(b, cw, eaveC, riseC, 0.3, { knob: true, ext: 0.32 }); b.pop();
        b.push(0, 0, cz0 - 0.34, Math.PI); wmBarge(b, cw, eaveC, riseC, 0.3, { ext: 0.22 }); b.pop();
        wmHead(b, 0, eaveC + riseC + 0.08, cz0 - 0.36, Math.PI / 2, 0.95);
      });
      b.unit(function () { b.flag(0, eaveC + riseC + 0.16, cz0 + 0.3, 1.35, 1.1, 0.42, { c: 'ember', pennant: true, pr: 0.035, ry: 2.6 }); });

      b.part('Windshaft');
      var tilt = 0.12, Pv = [0, 1.35, 3.05], dir = [0, Math.sin(tilt), Math.cos(tilt)];
      b.unit(function () {
        var a = [Pv[0] - dir[0] * 3.4, Pv[1] - dir[1] * 3.4, Pv[2] - dir[2] * 3.4], e = [Pv[0] - dir[0] * 0.28, Pv[1] - dir[1] * 0.28, Pv[2] - dir[2] * 0.28];
        b.beam(a, e, 0.2, { round: true, seg: 10, c: 'woodDark' });
        b.box(0, 0.8, cz1 + 0.19, 3.0, 0.28, 0.3, { c: 'beam', m: M.wood, bevel: 0.03 });
        [0.55, 0.85].forEach(function (f) { var q = [Pv[0] - dir[0] * f, Pv[1] - dir[1] * f, Pv[2] - dir[2] * f]; b.beam(q, [q[0] + dir[0] * 0.06, q[1] + dir[1] * 0.06, q[2] + dir[2] * 0.06], 0.215, { round: true, seg: 10, c: 'iron', m: M.metal }); });
      });

      b.part('Sails');
      b.spin(Pv, dir, 0.5, function (s) {
        s.push(0, 0, 0, 0); wmRotX(s, -tilt);
        s.unit(function () {
          s.cyl(0, 0, -0.32, 0.36, 0.64, { rx: Math.PI / 2, c: 'iron', m: M.metal, seg: 12 });
          s.cyl(0, 0, 0.32, 0.18, 0.12, { rx: Math.PI / 2, c: 'iron', m: M.metal, seg: 10 });
        });
        var SL = 6.3, y0 = 1.2, y1 = 6.2;
        for (var i = 0; i < 4; i++) (function (i) {
          var th = Math.PI / 4 + i * Math.PI / 2, zb = i % 2 ? -0.12 : 0.12, clothed = i % 2 === 1;
          s.unit(function () {
            s.push(0, 0, 0, 0); wmRotZ(s, -th);
            s.box(0, 0, zb, 0.2, SL, 0.2, { taper: 0.55, c: 'woodDark', m: M.wood });
            s.box(-0.24, y0, zb - 0.02, 0.26, y1 - y0, 0.035, { c: 'woodLight', m: M.wood, bevel: 0.008 });
            s.pop();
          });
          s.unit(function () {
            s.push(0, 0, 0, 0); wmRotZ(s, -th);
            for (var y = y0 + 0.05; y <= y1; y += 0.38) s.box(0.47, y, zb - 0.0275, 1.7, 0.05, 0.055, { c: 'wood', m: M.wood, bevel: 0.008, jit: 0.02 });
            [[1.31, 0.07, 0.08], [0.89, 0.04, 0.05], [0.47, 0.04, 0.05], [-0.37, 0.05, 0.06]].forEach(function (h) { s.box(h[0], y0 - 0.05, zb - h[2] / 2, h[1], y1 - y0 + 0.15, h[2], { c: 'wood', m: M.wood, bevel: 0.008 }); });
            s.pop();
          });
          s.unit(function () {
            s.push(0, 0, 0, 0); wmRotZ(s, -th);
            if (clothed) {
              var g = new T.PlaneGeometry(1.12, y1 - y0 - 0.1, 4, 10), pp = g.attributes.position;
              for (var k = 0; k < pp.count; k++) { var uu = pp.getX(k) / 1.12 + 0.5, vv = pp.getY(k) / (y1 - y0 - 0.1) + 0.5; pp.setZ(k, -0.03 * Math.sin(Math.PI * uu) * Math.sin(Math.PI * vv)); }
              g.computeVertexNormals();
              s.addGeo(g, { x: 0.69, y: (y0 + y1) / 2, z: zb + 0.04, c: '#efebe4', m: M.cloth, bucket: 'cloth', ao: 0.1, jit: 0.015 });
              // reef points: little ties along the hemlath
              for (var yy = y0 + 0.3; yy < y1; yy += 0.76) s.box(1.31, yy, zb + 0.05, 0.1, 0.035, 0.1, { c: 'rope', m: M.rope, bevel: 0 });
              // stitched seams across the cloth, and a bolt rope down its leading edge
              for (var ys = y0 + 0.62; ys < y1 - 0.3; ys += 0.62) s.box(0.69, ys, zb + 0.045, 1.08, 0.022, 0.012, { c: '#d8d1c3', m: M.cloth, bevel: 0, ao: 0 });
              s.box(0.15, y0 + 0.05, zb + 0.045, 0.03, y1 - y0 - 0.15, 0.02, { c: 'rope', m: M.rope, bevel: 0 });
            } else {
              s.beam([0.24, y0 + 0.1, zb - 0.15], [0.24, y1 - 0.15, zb - 0.15], 0.085, { round: true, seg: 8, c: '#e9e5dc', m: M.cloth });
              for (var yt = y0 + 0.5; yt < y1 - 0.2; yt += 0.9) s.cyl(0.24, yt, zb - 0.15, 0.098, 0.05, { c: 'rope', m: M.rope, seg: 8 });
            }
            s.pop();
          });
        })(i);
        s.pop();
      });

      b.part('Tail pole');
      b.unit(function () {
        var top = [0, 0.12, -2.4], end = [0, yS + 0.44 - yC, -3.35];
        b.beam(top, end, 0.11, { c: 'beam' });
        var tq = (-2.9 - top[2]) / (end[2] - top[2]), ty = top[1] + (end[1] - top[1]) * tq;
        [-1, 1].forEach(function (s) { b.beam([s * 1.05, 0.12, -1.2], [s * 0.08, ty, -2.9], 0.06, { c: 'beam' }); });
        b.push(end[0], end[1], end[2], Math.PI / 2); b.wheel(0, 0, 0, 0.42, { c: 'wood' }); b.pop();
      });
      b.pop();

      b.part('Granary');
      var gx = -6.3, gz = 0.6, GW = 3.6, GD = 2.6, gF = 0.91, gE = 2.78, gR = 1.6;
      b.unit(function () {
        [-1.55, 0, 1.55].forEach(function (dx) { [-1.1, 0, 1.1].forEach(function (dz) {
          b.lathe(gx + dx, 0, gz + dz, [[0.01, 0], [0.21, 0], [0.22, 0.05], [0.13, 0.5], [0.01, 0.5]], { c: 'stone', m: M.stone, seg: 10, flat: true });
          b.lathe(gx + dx, 0.48, gz + dz, [[0.01, 0], [0.33, 0], [0.34, 0.07], [0.22, 0.14], [0.01, 0.16]], { c: 'sandstone', m: M.stone, seg: 14, flat: true });
        }); });
      });
      b.unit(function () {
        [-1.1, 0, 1.1].forEach(function (dz) { b.box(gx, 0.63, gz + dz, GW + 0.3, 0.2, 0.22, { c: 'beam', m: M.wood, bevel: 0.03 }); });
        for (var i = 0; i < 15; i++) b.box(gx - 1.85 + (i + 0.5) * 3.7 / 15, 0.83, gz, 3.7 / 15 - 0.02, 0.08, GD + 0.2, { c: b.chance(0.3) ? 'wood' : 'woodLight', m: M.wood, bevel: 0.01 });
      });
      b.unit(function () {
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
          var px = gx + c[0] * (GW / 2 - 0.05), pz = gz + c[1] * (GD / 2 - 0.05);
          b.post(px, gF, pz, 0.1, gE - gF, { c: 'beam' });
          b.lathe(px, gE - 0.42, pz, [[0.14, 0], [0.16, 0.06], [0.12, 0.12], [0.15, 0.2], [0.13, 0.26]], { c: 'beam', m: M.wood, seg: 8 });
        });
        [-1, 1].forEach(function (s) { b.box(gx, gF, gz + s * (GD / 2 - 0.05), GW, 0.12, 0.16, { c: 'beam', m: M.wood }); b.box(gx + s * (GW / 2 - 0.05), gF, gz, 0.16, 0.12, GD, { c: 'beam', m: M.wood }); });
        [-1, 1].forEach(function (s) { b.box(gx, gE - 0.15, gz + s * (GD / 2 - 0.05), GW + 0.1, 0.15, 0.17, { c: 'beam', m: M.wood }); });
        b.box(gx, gF, gz, GW - 0.3, 1.7, GD - 0.3, { c: '#1c1b1a', m: M.dark, bevel: 0, ao: 0 });
      });
      b.unit(function () {
        // the back wall, and the front with its door
        b.push(gx, gF + 0.12, gz - GD / 2 + 0.05, Math.PI); wmBoards(b, -GW / 2 + 0.12, GW / 2 - 0.12, 0, gE - 0.15 - gF - 0.12, 0); b.pop();
        b.push(gx, gF + 0.12, gz + GD / 2 - 0.05, 0);
        wmBoards(b, -GW / 2 + 0.12, -0.5, 0, gE - 0.15 - gF - 0.12, 0); wmBoards(b, 0.5, GW / 2 - 0.12, 0, gE - 0.15 - gF - 0.12, 0);
        [-1, 1].forEach(function (s) { b.box(s * 0.56, 0, 0.03, 0.12, 1.6, 0.12, { c: 'beam', m: M.wood }); });
        b.box(0, 1.5, 0.03, 1.3, 0.12, 0.14, { c: 'beam', m: M.wood });
        // the door leaf, open against the wall
        b.push(-0.5, 0.02, 0.1, -1.95);
        for (var k = 0; k < 4; k++) b.box(0.12 + k * 0.245, 0, 0, 0.225, 1.45, 0.06, { c: 'woodDark', m: M.wood, bevel: 0.01 });
        [0.3, 1.1].forEach(function (y) { b.box(0.49, y, 0.04, 0.9, 0.07, 0.03, { c: 'iron', m: M.metal, bevel: 0.01 }); });
        b.pop();
        b.pop();
      });
      b.unit(function () {
        [-1, 1].forEach(function (s) {
          b.push(gx + s * (GW / 2 - 0.05), gF + 0.12, gz, s * Math.PI / 2);
          wmBoards(b, -GD / 2 + 0.12, GD / 2 - 0.12, 0, function (x) { return gE + gR * (1 - Math.abs(x) / (GD / 2)) - 0.14 - gF - 0.12; }, 0);
          b.pop();
        });
      });
      b.gableRoof(gx, gE, gz, GW, GD, gR, { m: 'slate', c: 'windmillShingle', over: 0.35, overX: 0.3, rows: 5 });
      b.unit(function () {
        [-1, 1].forEach(function (s) {
          b.push(gx + s * (GW / 2 + 0.34), 0, gz, Math.PI / 2); wmBarge(b, GD / 2, gE, gR, 0.35, { ext: 0.3 }); b.pop();
          wmHead(b, gx + s * (GW / 2 + 0.38), gE + gR + 0.06, gz, s > 0 ? 0 : Math.PI, 0.85);
        });
      });
      b.unit(function () {
        b.box(gx, 0, gz + GD / 2 + 0.95, 1.1, 0.3, 0.5, { c: 'sandstone', bevel: 0.05 });
        b.box(gx, 0, gz + GD / 2 + 0.5, 1.1, 0.6, 0.42, { c: 'sandstone', bevel: 0.05 });
        wmSack(b, gx - 0.12, 0.6, gz + GD / 2 + 0.48, Math.PI / 2 + 0.15, 0.72, 'windmillSack');
        // shields hung on the gable that faces the yard
        b.shield(gx - GW / 2 - 0.0, 1.85, gz - 0.55, { kind: 'round', c: 'ink', s: 0.72, ry: -Math.PI / 2, emblem: 'none' });
        b.shield(gx - GW / 2 - 0.0, 1.8, gz + 0.5, { kind: 'round', c: 'bone', s: 0.72, ry: -Math.PI / 2, emblem: 'none' });
        b.shield(gx + 1.15, 1.85, gz + GD / 2 + 0.04, { kind: 'round', c: 'inkGrey', s: 0.66, emblem: 'none' });
      });

      b.part('Sack hoist and banner');
      var aj = postA(2), rJ = 5.8;
      b.unit(function () {
        var pb = P(aj, rRail, yS);
        b.post(pb[0], yS, pb[2], 0.07, 1.7, { c: 'beam' });
        b.beam(P(aj, rRail - 0.05, yS + 1.62), P(aj, rJ + 0.1, yS + 1.62), 0.07, { c: 'beam' });
        b.beam(P(aj, rRail, yS + 0.7), P(aj, rRail + 1.15, yS + 1.58), 0.05, { c: 'beam' });
        var ph = P(aj, rJ - 0.04, yS + 1.66); wmHead(b, ph[0], ph[1], ph[2], -aj, 0.85);
        var pe = P(aj, rJ, yS + 1.3);
        b.box(pe[0], pe[1], pe[2], 0.14, 0.26, 0.18, { ry: faceRy(aj), c: 'woodDark', m: M.wood, bevel: 0.02 });
        b.cyl(pe[0], pe[1] + 0.13, pe[2], 0.12, 0.05, { rx: Math.PI / 2, ry: faceRy(aj) + Math.PI / 2, c: 'iron', m: M.metal, seg: 10 });
        b.beam([pe[0], pe[1], pe[2]], [pe[0], 2.36, pe[2]], 0.014, { round: true, seg: 4, c: 'rope', m: M.rope });
        b.ball(pe[0], 2.0, pe[2], 0.3, { sx: 0.95, sy: 1.25, sz: 0.85, c: 'windmillFlour', m: M.cloth, detail: 2, smooth: true, ao: 0.3 });
        b.cyl(pe[0], 2.3, pe[2], 0.07, 0.08, { c: 'rope', m: M.rope, seg: 7 });
      });
      b.unit(function () {
        var ab = 1.3, rb = rOut + 0.24, yh = yS + 0.98, pb = P(ab, rb, yh - 0.04);
        [-1, 1].forEach(function (s) { b.beam(P(ab + s * 0.12, rRail, yh), P(ab + s * 0.12, rb + 0.03, yh), 0.022, { c: 'iron', m: M.metal, round: true }); });
        b.banner(pb[0], pb[1], pb[2], 1.0, 1.6, { c: 'ink', emblem: 'none', tail: 'swallow', band: 'ember', bandAt: 0.8, bandH: 0.05, trim: 'iron', ry: faceRy(ab) });
        b.push(pb[0], pb[1], pb[2], faceRy(ab)); wmEmblem(b, 1.6, -1.6 * 0.42, 0.9, '#f1eee8'); b.pop();
      });

      b.part('Flour and millstones');
      b.unit(function () {
        // flour sacks stacked by the door
        var a0 = 1.1;
        [[0, 0], [0.2, 0], [0.4, 0], [0.1, 1], [0.3, 1]].forEach(function (q, i) {
          var a = a0 - q[0], p = P(a, 3.95, 0.06 + q[1] * 0.34);
          wmSack(b, p[0], p[1], p[2], faceRy(a) + Math.PI / 2 + b.j(0.15), 0.85, i % 3 === 2 ? 'windmillSack' : 'windmillFlour');
        });
      });
      b.unit(function () {
        var p = P(0.35, 4.0, 0.06);
        b.sack(p[0], 0.06, p[2], 0.55, { c: 'windmillFlour' }); b.sack(p[0] + 0.45, 0.06, p[2] + 0.35, 0.5, { c: 'windmillSack' });
        // bushel measures
        b.lathe(p[0] + 0.45, 0.06, p[2] - 0.5, [[0.01, 0], [0.24, 0], [0.26, 0.3], [0.23, 0.31], [0.21, 0.04], [0.01, 0.04]], { c: 'woodLight', m: M.wood, seg: 12, flat: true });
        b.cyl(p[0] + 0.45, 0.12, p[2] - 0.5, 0.265, 0.04, { c: 'iron', m: M.metal, seg: 12, open: true });
        b.lathe(p[0] + 0.95, 0.06, p[2] - 0.1, [[0.01, 0], [0.17, 0], [0.18, 0.22], [0.16, 0.23], [0.15, 0.04], [0.01, 0.04]], { c: 'woodLight', m: M.wood, seg: 12, flat: true });
      });
      b.unit(function () {
        // spare stones, by the door
        var q = P(2.15, 4.3, 0);
        wmMillstone(b, q[0], 0.06, q[2], 0.62, 0.24, {});
        wmMillstone(b, q[0] + 0.05, 0.3, q[2] + 0.04, 0.6, 0.24, { c: '#c4bdac' });
      });
      var ms = [-2.8, 4.6];
      b.unit(function () {
        // a runner stone up on trestles, being dressed
        wmTrestle(b, ms[0], ms[1] - 0.38, 0.1, 1.3, 0.56); wmTrestle(b, ms[0], ms[1] + 0.38, 0.1, 1.3, 0.56);
        wmMillstone(b, ms[0], 0.56, ms[1], 0.68, 0.28, { furrows: true });
        b.beam([ms[0] - 0.55, 0.86, ms[1] + 0.15], [ms[0] + 0.5, 0.86, ms[1] + 0.32], 0.02, { c: 'woodLight' });
        b.bucket(ms[0] + 0.95, 0, ms[1] + 0.25);
        b.box(ms[0] - 1.0, 0, ms[1] + 0.3, 0.55, 0.22, 0.32, { c: 'wood', m: M.wood, ry: 0.4 });
      });
      var cartA = aj, cp = P(cartA, rJ, 0), cry = faceRy(cartA);
      b.unit(function () {
        b.cart(cp[0], cp[2], { ry: cry });
        b.push(cp[0], 0, cp[2], cry); b.cyl(-0.55, 0.21, 2.45, 0.21, 1.1, { rz: -Math.PI / 2, c: 'wood', m: M.wood, seg: 8, flat: true }); b.pop();
      });
      b.unit(function () {
        b.push(cp[0], 0, cp[2], cry);
        [[-0.29, -0.5], [0.29, -0.5], [-0.29, 0.42], [0.29, 0.42]].forEach(function (q, i) { wmSack(b, q[0], 0.77, q[1], b.j(0.12) + (i % 2 ? Math.PI : 0), 0.85, i === 2 ? 'windmillSack' : 'windmillFlour'); });
        [[-0.15, -0.05], [0.2, 0.55]].forEach(function (q) { wmSack(b, q[0], 1.12, q[1], Math.PI / 2 + b.j(0.2), 0.8, 'windmillFlour'); });
        b.pop();
      });
      b.unit(function () {
        b.barrel(gx + 2.45, 0, gz + 1.7, {}); b.barrel(gx + 2.95, 0, gz + 1.15, { h: 0.82 }); b.crate(gx + 2.6, 0, gz + 0.35, 0.68, { ry: 0.25 });
        b.barrel(gx + 3.2, 0, gz + 2.3, { lie: true, ry: 0.5 });
      });
      b.unit(function () { wmStook(b, 9.5, 0.9, 8); wmStook(b, 9.1, -1.9, 7); });
      b.unit(function () { wmStook(b, 10.3, 2.4, 7); wmStook(b, -9.4, -1.6, 7); });
      b.unit(function () { wmStook(b, 3.6, 9.6, 8); wmStook(b, 4.8, 8.2, 7); });
      b.unit(function () { wmStook(b, 6.4, 7.9, 8); wmStook(b, 5.3, 9.5, 7); b.sack(3.9, b.ground ? b.ground.height(3.9, 8.6) : 0, 8.6, 0.5, { c: 'windmillSack' }); });
      b.unit(function () {
        // a stone trough and a hitching post for the carter's horse
        var hx0 = 6.9, hz0 = 0.3;
        b.push(hx0, 0, hz0, 0.85);
        b.box(0, 0, 0, 1.9, 0.16, 0.74, { c: 'stone', bevel: 0.04 });
        [-1, 1].forEach(function (sd) { b.box(0, 0.16, sd * 0.31, 1.9, 0.44, 0.12, { c: 'stone', bevel: 0.03 }); b.box(sd * 0.89, 0.16, 0, 0.12, 0.44, 0.5, { c: 'stone', bevel: 0.03 }); });
        b.box(0, 0.16, 0, 1.66, 0.3, 0.5, { c: '#55605f', m: M.water, bevel: 0, ao: 0, jit: 0.01 });
        b.pop();
        b.post(hx0 + 1.3, 0, hz0 + 0.9, 0.08, 1.2, { c: 'beam' }); b.ball(hx0 + 1.3, 1.22, hz0 + 0.9, 0.1, { c: 'beam', m: M.wood });
        b.ropeCoil(hx0 + 1.3, 0.75, hz0 + 0.9, 0.12);
        b.barrel(hx0 - 0.4, 0, hz0 - 1.2, { h: 0.85 }); b.crate(hx0 + 0.55, 0, hz0 - 1.5, 0.62, { ry: 0.4 }); b.sack(hx0 + 0.45, 0.62, hz0 - 1.5, 0.45, { c: 'windmillSack' });
      });

      b.part('Bread oven');
      var ox = -6.4, oz = 6.0, oa = 2.0;
      function OP(a, r, y) { return [ox + Math.cos(a) * r, y, oz + Math.sin(a) * r]; }
      b.unit(function () { b.cyl(ox, -0.06, oz, 1.15, 0.14, { c: 'stoneDark', m: M.stone, seg: 24, flat: true }); });
      wmRing(b, ox, oz, function () { return 0.92; }, 0.08, 0.6, 0.36, { course: 0.26, len: 0.48, pal: 'stoneDark' });
      b.unit(function () { b.cyl(ox, 0.6, oz, 1.06, 0.09, { c: 'sandstone', m: M.stone, seg: 24, flat: true }); });
      wmRing(b, ox, oz, function (y) { var t = (y - 0.69) / 1.0; return 0.84 * Math.sqrt(Math.max(0.05, 1 - t * t)); }, 0.69, 1.59, 0.3, { course: 0.18, len: 0.42, openings: [{ a: oa, y0: 0.6, y1: 1.2, hw: 0.25 }] });
      b.unit(function () {
        b.cyl(ox, 1.59, oz, 0.4, 0.08, { c: 'sandstone', m: M.stone, seg: 14, flat: true });
        b.lathe(ox, 1.67, oz, [[0.01, 0], [0.17, 0], [0.13, 0.26], [0.15, 0.3], [0.1, 0.3], [0.09, 0.05], [0.01, 0.05]], { c: 'stoneDark', m: M.stone, seg: 10, flat: true });
        // the mouth: a sandstone lintel, the dark oven and the coals glowing on its floor
        var pl = OP(oa, 0.76, 1.23); b.box(pl[0], pl[1], pl[2], 0.78, 0.16, 0.36, { ry: faceRy(oa), c: 'sandstone', bevel: 0.03 });
        var pd = OP(oa, 0.51, 0.69); b.box(pd[0], pd[1], pd[2], 0.46, 0.52, 0.5, { ry: faceRy(oa), c: '#1c1b1a', m: M.dark, bevel: 0, ao: 0 });
        var pc = OP(oa, 0.86, 0.71); b.embers(pc[0], pc[1], pc[2], 0.14); b.flame(pc[0], pc[1], pc[2], 0.3, { i: 0.8 });
        // a woodpile for firing it and a table of fresh loaves
        var pw = OP(oa + 1.3, 1.55, 0); b.woodpile(pw[0], pw[2], { n: 3, len: 1.0, ry: faceRy(oa + 1.3) + Math.PI / 2 });
        var pt = OP(oa - 1.05, 1.95, 0), tr = faceRy(oa - 1.05) + Math.PI / 2;
        b.table(pt[0], pt[2], 1.2, 0.62, { ry: tr });
        b.push(pt[0], 0.81, pt[2], tr);
        for (var k = 0; k < 7; k++) b.ball(-0.42 + k * 0.14, 0.05, b.j(0.12), 0.09, { sx: 1.25, sy: 0.6, c: b.pick(['#a87c4d', '#9c6f42', '#b48a58']), m: M.cloth, detail: 1, smooth: true, ao: 0.3 });
        b.box(0.35, 0, 0.12, 0.3, 0.02, 0.24, { c: 'bone', m: M.cloth, bevel: 0 });
        b.pop();
        b.bucket(pt[0] + 0.3, 0, pt[2] + 0.55);
      });

      b.part('Ivy and flowers');
      b.unit(function () {
        var a = 2.2, n = [Math.cos(a), 0, Math.sin(a)], p0 = P(a, face(0.4) + 0.05, 0.4), p1 = P(a + 0.04, face(1.6) + 0.05, 1.6), p2 = P(a - 0.05, face(2.6) + 0.05, 2.6), p3 = P(a, face(3.1) + 0.05, 3.05);
        b.ivy([p0, p1, p2, p3], n, { density: 7, spread: 0.5 });
        var a2 = Math.PI + 0.2, n2 = [Math.cos(a2), 0, Math.sin(a2)];
        b.ivy([P(a2, face(0.4) + 0.05, 0.4), P(a2 + 0.05, face(1.8) + 0.05, 1.8), P(a2, face(2.9) + 0.05, 2.9)], n2, { density: 6, spread: 0.45 });
        var pbu = P(Math.PI / 2 + 0.3, 3.95, 0); b.bush(pbu[0], pbu[2], 0.42, { flowers: '#f3f1ec', n: 2 });
        b.bush(gx - 1.6, gz + 1.9, 0.5, { flowers: '#efebe4', n: 2 });
        b.flowers(-3.1, 0.02, 3.3, 0.4, { n: 7, c: '#f3f1ec' }); b.flowers(-0.4, 0.02, 4.4, 0.35, { n: 6, c: '#efebe4' });
      });

      b.life(function () {
        // the miller in his floury smock at the door, giving the count to the quartermaster's man
        b.figure(0.85, 3.55, { role: 'villager', pose: 'talk', ry: 0.9, c: '#e6e1d6', beard: true });
        b.figure(2.9, 4.7, { role: 'soldier', pose: 'spear', ry: -2.08 });
        // sacks carried out to the cart
        b.figure(2.2, 3.7, { role: 'villager', pose: 'carry', ry: 1.99, c: '#6f6a62' });
        b.figure(4.08, 3.6, { role: 'villager', pose: 'carry', ry: 2.44, c: '#4a4c50' });
        // up on the stage, hauling on the hoist rope
        var ha = 0.48, hr = 3.35, hx = tx + Math.cos(ha) * hr, hz = tz + Math.sin(ha) * hr, hry = 0.58;
        b.figure(hx, hz, { role: 'villager', pose: 'windmill_haul', ry: hry, y: yS, c: '#e3ded3' });
        var hh = wmBy(hx, hz, hry, 0.06, yS + 1.56, 0.46), pe = P(aj, rJ, yS + 1.42);
        b.beam(hh, pe, 0.012, { round: true, seg: 4, c: 'rope', m: M.rope });
        var hl = wmBy(hx, hz, hry, -0.07, yS + 1.3, 0.42), fl = wmBy(hx, hz, hry, 0.1, yS + 0.02, 0.55);
        b.beam(hl, fl, 0.012, { round: true, seg: 4, c: 'rope', m: M.rope });
        b.ropeCoil(fl[0], yS, fl[2], 0.2);
        // dressing the runner stone with a mill bill
        var dry = -0.4, dpos = wmBy(ms[0], ms[1], dry, 0, 0, -0.98);
        b.figure(dpos[0], dpos[2], { role: 'villager', pose: 'hammer', ry: dry, c: '#5c5e62', beard: true });
        var bh = wmBy(dpos[0], dpos[2], dry, -0.24, 1.78, 0.1), be = wmBy(dpos[0], dpos[2], dry, -0.2, 1.62, 0.42);
        b.beam(bh, be, 0.018, { round: true, seg: 5, c: 'woodLight' });
        var bs0 = wmBy(dpos[0], dpos[2], dry, -0.2, 1.7, 0.42), bs1 = wmBy(dpos[0], dpos[2], dry, -0.2, 1.5, 0.45);
        b.beam(bs0, bs1, 0.028, { c: 'steel', m: M.metal });
        // a sack carried up to the granary, and a child running with a wooden sword
        b.figure(gx + 0.15, gz + GD / 2 + 1.7, { role: 'villager', pose: 'carry', ry: Math.PI + 0.1, c: '#6e5a44' });
        b.figure(-3.9, 7.2, { role: 'child', pose: 'run', ry: 2.5 });
        // the baker drawing loaves from the oven on a long peel
        var bp = OP(oa, 2.05, 0), bry = Math.atan2(-Math.cos(oa), -Math.sin(oa));
        b.figure(bp[0], bp[2], { role: 'villager', pose: 'vigil', ry: bry, c: '#e6e1d6' });
        b.push(bp[0], 0, bp[2], bry);
        b.beam([0, 1.2, -0.2], [0, 0.83, 0.92], 0.022, { round: true, seg: 6, c: 'woodLight' });
        b.box(0, 0.8, 1.06, 0.3, 0.025, 0.3, { c: 'woodLight', m: M.wood, bevel: 0.006 });
        b.ball(0, 0.86, 1.06, 0.1, { sx: 1.2, sy: 0.6, c: '#a87c4d', m: M.cloth, detail: 1, smooth: true });
        b.pop();
        // bringing in the last sheaves from the field
        b.figure(5.6, 8.4, { role: 'villager', pose: 'carry', ry: -0.3, c: '#5b5d55' });
      });
    }
  });
})();
