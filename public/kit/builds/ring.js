// Training ring: a round pit floored with flagstones, ringed by a stone wall with barred stall gates, three tiers of
// stone benches above a walkway, a parapet hung with round shields, an earth bank heaped against the outside so the
// ring sits sunk in its mound, a cut through the bank to the great gate, and a dome of curved iron ribs with chains
// slung across the top. Built footings first, the floor ring by ring, the walls course by course, the benches tier by
// tier, the bank, the dome rib by rib, then the training gear, and last the dragons, riders and the crowd.
(function () {
  var T = THREE, TAU = Math.PI * 2;
  var E = 1.3, SEAM = 2.9;                     // the great gate faces E; stone rings start at SEAM, where nothing is cut
  var EX = Math.cos(E), EZ = Math.sin(E), TX = -EZ, TZ = EX;
  var STALLS = [-2.05, -1.35, -0.62, 0.25];
  var STAIR = 2.1;                             // the spectators' stair up the bank to a door in the outer wall    // stall gates in the pit wall (angle, 0 = +x, PI/2 = +z)

  function ringNorm(a) { while (a < SEAM) a += TAU; while (a >= SEAM + TAU) a -= TAU; return a; }
  function ringGap(c, half) { var m = ringNorm(c); return [m - half, m + half]; }
  // the cut through the stands is 4.2 m between wall centres; at radius r it takes this half-angle
  function ringCut(r, w) { return ringGap(E, Math.asin(Math.min(0.99, (w || 2.1) / r))); }
  function ringPol(r, a) { return [Math.cos(a) * r, Math.sin(a) * r]; }
  function ringIn(a) { return Math.atan2(-Math.cos(a), -Math.sin(a)); }   // ry that faces the centre from angle a
  function ringOut(a) { return Math.atan2(Math.cos(a), Math.sin(a)); }
  // a point along the gate's axis: axial metres out from the centre, lateral to its left (+) or right (-)
  function ringAx(ax, lat) { return [EX * ax + TX * lat, EZ * ax + TZ * lat]; }
  // a point in the build's frame turned into a dragon's own frame (for o.look)
  function ringLook(dx, dy, dz, ry, s, wx, wy, wz) {
    var x = wx - dx, y = wy - dy, z = wz - dz, c = Math.cos(-ry), sn = Math.sin(-ry);
    return [(x * c + z * sn) / s, y / s, (-x * sn + z * c) / s];
  }

  // a curved stone: the ring sector between radii ri and ro, angles a0..a1, h tall, base at y = 0
  function ringArcGeo(ri, ro, a0, a1, h, bev) {
    var n = Math.max(2, Math.ceil((a1 - a0) / 0.14)), sh = new T.Shape(), i, a;
    for (i = 0; i <= n; i++) { a = a0 + (a1 - a0) * i / n; if (i === 0) sh.moveTo(Math.cos(a) * ro, -Math.sin(a) * ro); else sh.lineTo(Math.cos(a) * ro, -Math.sin(a) * ro); }
    for (i = n; i >= 0; i--) { a = a0 + (a1 - a0) * i / n; sh.lineTo(Math.cos(a) * ri, -Math.sin(a) * ri); }
    bev = Math.min(bev || 0, h * 0.3);
    var g = new T.ExtrudeGeometry(sh, { depth: Math.max(0.01, h - 2 * bev), bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelOffset: -bev, bevelSegments: 1, steps: 1, curveSegments: 1 });
    g.rotateX(-Math.PI / 2); g.translate(0, bev, 0); g.deleteAttribute('uv');
    return KIT.geo.flat(g);
  }

  // One course of a round wall (or a ring of seat blocks, slabs or flagstones) at radius r, thick wide, ch tall from y,
  // stone by stone, every stone cut back to the edge of a gap. o: { gaps: [[a0, a1]], len, pal, split (steps round the
  // ring), off (stagger, in stones), core (mortar behind the joints), mortar, bev, hj (height trim), tint(x, z, c) }
  function ringCourse(b, r, thick, y, ch, o) {
    o = o || {};
    var M = KIT.M, len = o.len || 0.8, ns = Math.max(8, Math.round(TAU * r / len)), arc = TAU / ns, off = (o.off || 0) * arc;
    var gaps = (o.gaps || []).slice().sort(function (p, q) { return p[0] - q[0]; }), split = o.split || 1, seg = TAU / split;
    var ri = r - thick / 2, ro = r + thick / 2, pieces = [], bnd = [], i;
    function cut(a0, a1) {
      var keep = [[a0, a1]];
      gaps.forEach(function (g) { var nk = []; keep.forEach(function (k) { if (k[1] <= g[0] || k[0] >= g[1]) { nk.push(k); return; } if (k[0] < g[0]) nk.push([k[0], g[0]]); if (k[1] > g[1]) nk.push([g[1], k[1]]); }); keep = nk; });
      return keep;
    }
    function grp(a) { var t = ((a - SEAM) % TAU + TAU) % TAU; return Math.min(split - 1, Math.floor(t / seg)); }
    for (i = 0; i < ns; i++) bnd.push(SEAM + off + i * arc + b.j(arc * 0.08));
    bnd.push(bnd[0] + TAU);
    var gapA = 0.024 / r;
    for (i = 0; i < ns; i++) cut(bnd[i] + gapA, bnd[i + 1] - gapA).forEach(function (p) { if ((p[1] - p[0]) * r > 0.14) pieces.push({ a0: p[0], a1: p[1], g: grp((p[0] + p[1]) / 2) }); });
    // the mortar core: the ring between the gaps, pulled back a little from each gap's face
    var cores = [];
    if (o.core !== false) {
      var free = cut(SEAM, SEAM + TAU), pull = 0.03 / r;
      free.forEach(function (f) {
        var a0 = f[0] + (f[0] > SEAM + 1e-6 ? pull : 0), a1 = f[1] - (f[1] < SEAM + TAU - 1e-6 ? pull : 0);
        for (var k = 0; k < split; k++) { var s0 = Math.max(a0, SEAM + k * seg), s1 = Math.min(a1, SEAM + (k + 1) * seg); if (s1 - s0 > 0.002) cores.push({ a0: s0, a1: s1, g: k }); }
      });
    }
    var bev = o.bev === undefined ? Math.min(0.06, ch * 0.18) : o.bev;
    for (var g = 0; g < split; g++) {
      (function (g) {
        b.unit(function () {
          cores.forEach(function (c) { if (c.g === g) b.addGeo(ringArcGeo(ri + 0.07, ro - 0.07, c.a0, c.a1, ch * 0.96, 0), { y: y, c: o.mortar || '#857a69', m: M.stone, ao: 0.1, jit: 0.01 }); });
          pieces.forEach(function (p) {
            if (p.g !== g) return;
            var hh = ch * ((o.hj === undefined ? 0.88 : o.hj) + b.j(0.04)), am = (p.a0 + p.a1) / 2, c = b.stoneC(o.pal || 'stone', y);
            if (o.tint) c = o.tint(Math.cos(am) * r, Math.sin(am) * r, c);
            b.addGeo(ringArcGeo(ri - b.j(0.02), ro + b.j(0.02), p.a0, p.a1, hh, bev), { y: y + (ch - hh) / 2 + (o.drop ? b.j(0.012) : 0), c: c, m: M.stone, ao: 0.18, jit: 0.04 });
          });
        });
      })(g);
    }
  }

  // a carved dragon-head finial, the profile in the local XY plane with the snout toward local +x, neck foot at
  // (x, y, z); ry turns it, s is its height
  function ringFinial(b, x, y, z, ry, s, o) {
    o = o || {}; var M = KIT.M, c = o.c || 'beam';
    var P = [[-0.12, 0], [-0.17, 0.3], [-0.13, 0.56], [-0.04, 0.78], [0.08, 0.9], [-0.02, 1.16], [0.16, 1.02], [0.32, 1.05], [0.52, 1.0], [0.76, 0.93], [0.88, 0.86],
      [0.66, 0.8], [0.5, 0.78], [0.78, 0.72], [0.84, 0.66], [0.6, 0.62], [0.36, 0.6], [0.2, 0.52], [0.12, 0.36], [0.1, 0.16], [0.12, 0]];
    b.push(x, y, z, ry);
    b.extrude(0, 0, 0, P.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.15 * s, { c: c, m: M.wood, ao: 0.1, bevel: 0.01 });
    // a mane of swept fins down the neck and a curled crest
    [[[-0.15, 0.3], [-0.36, 0.38], [-0.15, 0.46]], [[-0.12, 0.54], [-0.34, 0.66], [-0.08, 0.7]], [[-0.02, 0.8], [-0.24, 0.98], [0.04, 0.9]]].forEach(function (f) {
      b.extrude(0, 0, 0, f.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.07 * s, { c: c, m: M.wood, ao: 0.05, bevel: 0.005 });
    });
    [1, -1].forEach(function (sd) {
      b.ball(0.42 * s, 0.93 * s, sd * 0.08 * s, 0.035 * s, { c: 'bone', m: M.paint, ao: 0, detail: 0 });
      b.box(0.39 * s, 0.97 * s, sd * 0.075 * s, 0.16 * s, 0.03 * s, 0.03 * s, { c: c, m: M.wood, bevel: 0.004, rz: -0.25 });
      [0.6, 0.7].forEach(function (tx) { b.box(tx * s, 0.79 * s, sd * 0.05 * s, 0.025 * s, 0.05 * s, 0.025 * s, { c: 'bone', m: M.paint, bevel: 0.003, ao: 0 }); });
    });
    b.box(0, 0, 0, 0.36 * s, 0.07 * s, 0.2 * s, { c: c, m: M.wood, bevel: 0.01 });
    b.pop();
  }

  // a stave-carved post: a square shaft with carved collars, a band of twisted cord, a cap, and a dragon head on top
  // looking along ry (local +x of the finial)
  function ringStave(b, x, z, h, ry, o) {
    o = o || {}; var M = KIT.M, w = o.w || 0.34;
    b.push(x, 0, z, ry);
    b.box(0, 0, 0, w + 0.26, 0.28, w + 0.26, { c: 'stoneDark', bevel: 0.05 });
    b.box(0, 0.28, 0, w, h - 0.28, w, { c: 'beam', m: M.wood, bevel: 0.04 });
    [0.62, h * 0.52, h - 0.42].forEach(function (yy) { b.box(0, yy, 0, w + 0.08, 0.1, w + 0.08, { c: 'beam', m: M.wood, bevel: 0.025 }); b.box(0, yy + 0.16, 0, w + 0.05, 0.05, w + 0.05, { c: 'bone', m: M.paint, bevel: 0.01 }); });
    // twisted cord carved round the shaft between the collars
    for (var k = 0; k < 9; k++) { var yy2 = 0.95 + k * (h * 0.52 - 1.05) / 9; [0, 1, 2, 3].forEach(function (f) { var a = f * Math.PI / 2; b.box(Math.sin(a) * (w / 2 + 0.012), yy2, Math.cos(a) * (w / 2 + 0.012), f % 2 ? 0.03 : w * 0.8, 0.07, f % 2 ? w * 0.8 : 0.03, { c: 'woodDark', m: M.wood, bevel: 0.01, rx: f % 2 ? 0.5 : 0, rz: f % 2 ? 0 : 0.5 }); }); }
    if (o.ring !== false) b.addGeo(new T.TorusGeometry(0.08, 0.015, 4, 10), { x: w / 2 + 0.02, y: h * 0.38, z: 0, ry: Math.PI / 2, c: 'iron', m: M.metal, ao: 0 });
    b.box(0, h, 0, w + 0.12, 0.12, w + 0.12, { c: 'woodDark', m: M.wood, bevel: 0.03 });
    b.pop();
    if (o.head !== false) ringFinial(b, x, h + 0.12, z, ry + (o.headTurn || 0), o.hs || 1.0, {});
  }

  // a barred stall gate leaf: hinged at (0,0,0) in the gate's frame, w wide toward sgn * x, open th radians into the pit
  function ringBarLeaf(b, w, h, sgn, th) {
    var M = KIT.M;
    b.push(0, 0, 0, sgn * th);
    // frame of flat iron, round bars, a cross brace
    [0.06, h * 0.5, h - 0.06].forEach(function (yy) { b.box(sgn * w / 2, yy - 0.05, 0, w, 0.1, 0.05, { c: 'iron', m: M.metal, bevel: 0.01 }); });
    [0.03, w - 0.03].forEach(function (xx) { b.box(sgn * xx, 0, 0, 0.07, h, 0.06, { c: 'iron', m: M.metal, bevel: 0.01 }); });
    var nb = Math.max(3, Math.round(w / 0.17));
    for (var i = 1; i < nb; i++) { var xx2 = sgn * i * w / nb; b.cyl(xx2, 0.02, 0, 0.022, h - 0.04, { c: 'iron', m: M.metal, seg: 6 }); b.cone(xx2, h - 0.03, 0, 0.035, 0.14, { c: 'iron', m: M.metal, seg: 4 }); }
    b.beam([sgn * 0.08, 0.1, 0.03], [sgn * (w - 0.08), h * 0.5 - 0.08, 0.03], 0.03, { c: 'iron', m: M.metal });
    [0.3, h - 0.35].forEach(function (yy) { b.cyl(0, yy, 0, 0.045, 0.2, { c: 'iron', m: M.metal, seg: 6 }); });
    b.pop();
  }

  // a free-standing plank barrier to duck behind: w wide, h tall, facing +z, braced behind; o.burnt chars the top,
  // o.fallen lays it on its back
  function ringBarrier(b, x, z, ry, o) {
    o = o || {}; var M = KIT.M, w = o.w || 2.4, h = o.h || 1.8, n = Math.round(w / 0.3), pw = w / n;
    var tones = ['#6a5845', '#5f4f3f', '#574839', '#6f5d49', '#655443'];
    b.push(x, 0, z, ry);
    if (o.fallen) { b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeTranslation(0, 0.12, 0)).multiply(new T.Matrix4().makeRotationX(-Math.PI / 2 + 0.06)); }
    for (var i = 0; i < n; i++) {
      var hh = h * (0.94 + b.r() * 0.08), burnt = o.burnt && (i % 3 !== 1 || b.r() < 0.4);
      b.box(-w / 2 + (i + 0.5) * pw, 0.08, 0, pw - 0.025, hh * (burnt ? 0.82 + b.r() * 0.12 : 1), 0.07, { c: burnt ? b.pick(['#2f2924', '#3a322b', '#463c33']) : b.pick(tones), m: M.wood, bevel: 0.012, ao: 0.35 });
      if (burnt) b.box(-w / 2 + (i + 0.5) * pw, 0.08 + hh * 0.55, 0.0, pw - 0.02, hh * 0.25, 0.075, { c: '#22201d', m: M.wood, bevel: 0.01, ao: 0.1 });
    }
    [0.4, h - 0.35].forEach(function (yy) { b.box(0, yy, -0.07, w - 0.1, 0.14, 0.06, { c: 'woodDark', m: M.wood, bevel: 0.015 }); });
    if (!o.fallen) [-1, 1].forEach(function (sd) {
      b.box(sd * (w / 2 - 0.35), 0, -0.14, 0.16, h + 0.12, 0.14, { c: 'woodDark', m: M.wood, bevel: 0.03 });
      b.beam([sd * (w / 2 - 0.35), h * 0.72, -0.18], [sd * (w / 2 - 0.35), 0.03, -1.05], 0.05, { c: 'wood' });
      b.box(sd * (w / 2 - 0.35), 0, -0.6, 0.14, 0.08, 1.1, { c: 'woodDark', m: M.wood, bevel: 0.02 });
    });
    for (var k = 0; k < n; k += 2) b.ball(-w / 2 + (k + 0.5) * pw, h - 0.28, 0.04, 0.025, { c: 'iron', m: M.metal, detail: 0 });
    b.pop();
  }

  // a round painted target board on an easel, ink and bone rings with a small ember eye, scorched at one edge
  function ringTarget(b, x, z, ry) {
    var M = KIT.M, r = 0.85;
    b.push(x, 0, z, ry);
    b.beam([-0.55, 0, 0.2], [-0.3, 2.0, -0.05], 0.06, { c: 'woodDark' });
    b.beam([0.55, 0, 0.2], [0.3, 2.0, -0.05], 0.06, { c: 'woodDark' });
    b.beam([0, 0, -0.9], [0, 1.9, -0.1], 0.06, { c: 'woodDark' });
    b.box(0, 0.62, 0.08, 1.3, 0.1, 0.12, { c: 'wood', m: M.wood });
    b.cyl(0, 1.45, 0.0, r, 0.12, { c: 'wood', m: M.wood, seg: 22, rx: Math.PI / 2 - 0.1, flat: true });
    var rings = ['#efebe4', '#1f1e1c', '#efebe4', '#1f1e1c', '#f26a1b'];
    b.addGeo(new T.CircleGeometry(r * 0.94, 30), { x: 0, y: 1.45 - 0.006, z: 0.065, rx: -0.1, c: '#ffffff', m: M.paint, ao: 0, jit: 0, vary: 0.05, colors: function (wx, wy, wz, lx, ly) { var d = Math.hypot(lx, ly) / (r * 0.94); if (lx > 0.35 && ly < -0.1 && d > 0.5) return '#2a2622'; return rings[Math.min(4, Math.floor((1 - d) * 4.6))]; } });
    b.cyl(0, 1.45, 0.0, r + 0.03, 0.14, { c: 'iron', m: M.metal, seg: 22, rx: Math.PI / 2 - 0.1, open: true });
    // spears stuck in it
    [[-0.3, 1.7, 0.4, -0.35], [0.25, 1.25, -0.3, 0.3]].forEach(function (s) { b.spear(s[0], s[1], 0.12, 1.5, { rx: Math.PI / 2 + 0.2, rz: s[2], ry: s[3] }); });
    b.pop();
  }

  // a chain of links slung between a and b ([x,y,z]) sagging by sag, links about 0.34 long
  var LINK = null;
  function ringChain(b, a, c, sag, o) {
    o = o || {}; var M = KIT.M;
    if (!LINK) LINK = new T.TorusGeometry(0.085, 0.024, 4, 8);
    var A = new T.Vector3(a[0], a[1], a[2]), C = new T.Vector3(c[0], c[1], c[2]), L = A.distanceTo(C) + sag * 1.2, n = Math.max(3, Math.round(L / 0.25));
    var pts = [];
    for (var i = 0; i <= n; i++) { var t = i / n, p = A.clone().lerp(C, t); p.y -= sag * 4 * t * (1 - t); pts.push(p); }
    for (var k = 0; k < n; k++) {
      var p0 = pts[k], p1 = pts[k + 1], d = p1.clone().sub(p0).normalize(), mid = p0.clone().add(p1).multiplyScalar(0.5);
      var q = new T.Quaternion().setFromUnitVectors(new T.Vector3(1, 0, 0), d);
      if (k % 2) q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI / 2));
      var e = new T.Euler().setFromQuaternion(q, 'YXZ');
      b.addGeo(LINK, { x: mid.x, y: mid.y, z: mid.z, rx: e.x, ry: e.y, rz: e.z, order: 'YXZ', sx: 1.7, c: o.c || 'iron', m: M.metal, ao: 0.05, jit: 0.03 });
    }
  }

  // three claw slashes, bone on a banner's two faces, at (x, y, z) in the banner's frame, s tall
  function ringClaws(b, x, y, z, s, c) {
    var M = KIT.M;
    [-1, 0, 1].forEach(function (k) {
      var pts = [[-0.035, -0.5], [0.0, -0.56], [0.05, -0.2], [0.06, 0.25], [0.02, 0.5], [-0.02, 0.2], [-0.045, -0.2]].map(function (p) { return [(p[0] + k * 0.17 + p[1] * 0.28) * s, (p[1] - Math.abs(k) * 0.06) * s]; });
      [0.013, -0.013].forEach(function (dz) { b.extrude(x, y, z + dz, pts, 0.006, { c: c || '#f1eee8', m: M.cloth, bucket: 'cloth', ao: 0, jit: 0.01, vary: 0.02 }); });
    });
  }


  // a woven basket heaped with silver fish, the basket's foot at (x, y, z)
  function ringFishBasket(b, x, y, z, s) {
    var M = KIT.M; s = s || 1;
    b.lathe(x, y, z, [[0.01, 0], [0.3 * s, 0], [0.38 * s, 0.4 * s], [0.36 * s, 0.42 * s], [0.01, 0.34 * s]], { c: '#8c7658', m: M.straw, seg: 14, flat: true });
    for (var i = 0; i < 6; i++) { var a = i / 6 * TAU + b.j(0.3); b.extrude(x + Math.cos(a) * 0.15 * s, y + 0.5 * s - 0.08, z + Math.sin(a) * 0.15 * s, [[0, 0], [0.08, 0.05], [0.24, 0.045], [0.32, 0.01], [0.4, 0.065], [0.39, -0.06], [0.32, -0.01], [0.24, -0.045], [0.08, -0.05]].map(function (p) { return [p[0] * s, p[1] * s]; }), 0.05 * s, { rx: Math.PI / 2 + b.j(0.4), ry: a, c: b.pick(['#6f7b80', '#647076', '#7c868a']), m: M.metal, ao: 0.1, bevel: 0.01 }); }
  }

  // a banner pole at the turn of the path: a square post with bone-painted bands, an arm with a bone banner bearing
  // three ink claw slashes, a dragon head carved on top looking out along the arm (local +x); the banner faces +z
  function ringBannerPole(b, x, y, z, ry, h) {
    var M = KIT.M;
    b.push(x, y, z, ry);
    b.box(0, -0.1, 0, 0.62, 0.32, 0.62, { c: 'stoneDark', m: M.stone, bevel: 0.06, ao: 0.3 });
    b.box(0, 0.2, 0, 0.26, h - 0.2, 0.26, { c: 'beam', m: M.wood, bevel: 0.03 });
    [0.75, 1.0, h * 0.55, h - 0.75].forEach(function (yy, i) { b.box(0, yy, 0, 0.3, i % 2 ? 0.05 : 0.09, 0.3, { c: i % 2 ? 'bone' : 'woodDark', m: i % 2 ? M.paint : M.wood, bevel: 0.01 }); });
    b.box(0.6, h - 0.5, 0, 1.36, 0.13, 0.13, { c: 'beam', m: M.wood, bevel: 0.025 });
    b.beam([0.1, h - 1.15, 0], [0.62, h - 0.47, 0], 0.035, { c: 'woodDark' });
    b.box(1.26, h - 0.62, 0, 0.1, 0.18, 0.1, { c: 'woodDark', m: M.wood, bevel: 0.015 });
    b.banner(0.78, h - 0.53, 0.08, 0.92, 2.1, { c: 'bone', emblem: 'none', tail: 'swallow', band: 'ember', bandAt: 0.82, bandH: 0.035, trim: 'iron' });
    ringClaws(b, 0.78, h - 1.5, 0.08, 0.72, '#1f1e1c');
    b.box(0, h, 0, 0.32, 0.08, 0.32, { c: 'woodDark', m: M.wood, bevel: 0.02 });
    b.pop();
    // the carved head on top, turned with the post
    ringFinial(b, x, y + h + 0.08, z, ry, 0.85, {});
  }

  // a seated spectator: hips on the bench, feet on the tier below
  if (KIT.people && KIT.people.poses) {
    var PV = function (x, y, z) { return new T.Vector3(x, y, z); };
    KIT.people.poses.ringSit = function (r) { return { feet: [PV(-0.14, 0.08, 0.46), PV(0.13, 0.08, 0.44)], hands: [PV(-0.2, 0.66, 0.36), PV(0.21, 0.67, 0.34)], lean: 0.12, twist: r(0.12), side: 0, hip: 0, drop: 0.44, head: [r(0.35), -0.05], pole: [PV(-0.6, -0.5, -0.3), PV(0.6, -0.5, -0.3)] }; };
    KIT.people.poses.ringSitCheer = function (r) { return { feet: [PV(-0.15, 0.08, 0.44), PV(0.15, 0.08, 0.46)], hands: [PV(-0.3, 1.55, 0.2), PV(0.32, 1.5, 0.24)], lean: -0.04, twist: 0, side: 0, hip: 0, drop: 0.44, head: [r(0.2), -0.25], pole: [PV(-1, -0.2, -0.2), PV(1, -0.2, -0.2)] }; };
    KIT.people.poses.ringSitPoint = function (r) { return { feet: [PV(-0.14, 0.08, 0.46), PV(0.14, 0.08, 0.44)], hands: [PV(-0.4, 1.32, 0.5), PV(0.22, 0.66, 0.32)], lean: 0.06, twist: 0.2, side: 0, hip: 0, drop: 0.44, head: [-0.4, -0.12] }; };
  }

  KIT.defineBuild('ring', {
    name: 'Training ring', size: 'big', need: 75,
    line: 'A sunken stone ring with barred dragon stalls, tiers of benches and a dome of iron ribs and chains, where dragons and riders train.',
    r: 17.6, flat: [29, 29], ground: 'grass', path: [[-5.6, 17.4], [-1.7, 16.3], [2.0, 15.2], ringAx(14.3, 0)],
    // framed from a little higher than the others (el 0.55), as its approved picture was
    frameY: 3.4, frameR: 13.8, frameEl: 0.55, glowAt: [0, 13.0, 0],
    trees: [{ x: -11.4, z: -11.0, kind: 'pine', h: 9.0 }, { x: -13.8, z: -7.6, kind: 'pine', h: 7.2 }, { x: 14.6, z: -4.6, kind: 'pine', h: 6.5 }, { x: 15.0, z: 4.0, kind: 'round', h: 6.0 }, { x: 12.6, z: 9.4, kind: 'pine', h: 7.0 }, { x: -15.2, z: 4.6, kind: 'round', h: 5.2 }],
    bushes: [{ x: 7.6, z: 13.4, r: 0.9, flowers: '#f3f1ec' }, { x: -9.4, z: 12.9, r: 0.8 }, { x: 8.9, z: 12.6, r: 0.8 }, { x: 15.6, z: -1.4, r: 0.85, flowers: '#f3f1ec' }],
    perches: [{ x: 0, y: 11.13, z: 0, ry: -1.35 }, { x: ringAx(14.8, 2.25)[0], y: 4.9, z: ringAx(14.8, 2.25)[1], ry: Math.atan2(EX, EZ) }, { x: ringPol(11.4, E + 6.5 * TAU / 12)[0], y: 5.05, z: ringPol(11.4, E + 6.5 * TAU / 12)[1], ry: ringIn(E + 6.5 * TAU / 12) + Math.PI / 2 }],
    build: function (b) {
      var M = KIT.M, U = KIT.util;
      var base = 0.14, PW = base + 2.4, WT = PW + 0.2;              // plinth top, pit wall top, walkway top
      var TIERS = [[9.6, 10.35, WT], [10.35, 11.1, WT + 0.4]];   // [front, back, foot] of each bench
      var PT = base + 10 * 0.41, DOME0 = PT + 0.81, DOMEH = 6.0, DR = 11.4;          // parapet top, rib foot height, dome rise, rib foot radius
      var RIBS = 12, ribA = function (k) { return E + (k + 0.5) * TAU / RIBS; };
      var stallGaps = function (half) { return STALLS.map(function (a) { return ringGap(a, half); }); };
      var scorch = [ringPol(2.2, -2.4), ringPol(3.4, -0.9), ringPol(1.0, 0.8), ringPol(4.6, -1.7)];
      var tintFloor = function (x, z, c) { scorch.forEach(function (s) { var d = Math.hypot(x - s[0], z - s[1]); if (d < 1.5) c.lerp(new T.Color('#3b3631'), 0.75 * (1 - d / 1.5)); }); return c; };

      b.part('Footings');
      b.unit(function () {
        // the pit floor levelled and bedded, and a plinth ring for the pit wall
        b.cyl(0, 0, 0, 7.84, 0.05, { c: '#7a7062', m: M.stone, seg: 64, flat: true, ao: 0 });
        ringCourse(b, 8.38, 1.16, -0.12, 0.26, { len: 1.1, pal: 'stoneDark', core: true, split: 1, hj: 1.0 });
      });
      b.unit(function () {
        ringCourse(b, 11.4, 0.9, -0.12, 0.26, { len: 1.2, pal: 'stoneDark', core: true, gaps: [ringCut(11.4)], split: 1, hj: 1.0 });
        // the cut's floor bed out to the bank's foot
        var c = ringAx(11.45, 0);
        b.box(c[0], -0.02, c[1], 3.7, 0.06, 7.2, { ry: Math.atan2(EX, EZ), c: '#7a7062', m: M.stone, bevel: 0, ao: 0 });
      });

      b.part('Pit floor');
      b.unit(function () {
        // the tether stone in the middle: a round slab with an iron ring let into it
        b.cyl(0, 0.02, 0, 0.8, 0.12, { c: 'sandstone', m: M.stone, seg: 24, flat: true });
        b.cyl(0, 0.14, 0, 0.32, 0.03, { c: 'iron', m: M.metal, seg: 16, flat: true });
        b.addGeo(new T.TorusGeometry(0.2, 0.035, 5, 14), { x: 0.12, y: 0.17, z: 0.05, rx: Math.PI / 2 - 0.25, c: 'iron', m: M.metal, ao: 0 });
      });
      var rings = [[0.84, 1.74], [1.76, 2.66], [2.68, 3.58], [3.6, 4.5], [4.52, 5.42], [5.44, 6.34], [6.36, 7.26], [7.28, 7.82]];
      rings.forEach(function (rr, k) {
        ringCourse(b, (rr[0] + rr[1]) / 2, rr[1] - rr[0] - 0.03, 0.02, 0.12, { len: 0.95 + k * 0.03, pal: k % 2 ? 'stoneCool' : 'stone', core: false, split: 1, off: k * 0.37, hj: 0.95, bev: 0.035, tint: tintFloor, drop: true });
      });

      b.part('Pit wall');
      for (var k = 0; k < 6; k++) {
        var gp = [ringCut(8.35, 2.0)].concat(k < 5 ? stallGaps(1.0 / 8.35) : stallGaps(1.38 / 8.35));
        ringCourse(b, 8.35, 0.7, base + k * 0.4, 0.4, { len: 0.78, pal: 'stone', gaps: gp, split: 4, off: (k % 2) * 0.5 });
      }

      b.part('Stall gates');
      STALLS.forEach(function (a, gi) {
        var p = ringPol(8.0, a), ry = ringIn(a);
        b.unit(function () {
          b.push(p[0], 0, p[1], ry);
          // the jambs, the lintel with iron studs, the threshold, straw on the stall floor and the dark of the stall
          [-1, 1].forEach(function (sd) { b.box(sd * 1.12, base, 0.02, 0.26, 1.98, 0.26, { c: 'beam', m: M.wood, bevel: 0.03 }); b.box(sd * 1.12, base, 0.02, 0.34, 0.22, 0.34, { c: 'stoneDark', m: M.stone, bevel: 0.04 }); });
          b.box(0, base + 2.0, -0.32, 2.72, 0.38, 0.86, { c: 'beam', m: M.wood, bevel: 0.04 });
          for (var q = 0; q < 7; q++) b.ball(-1.08 + q * 0.36, base + 2.19, 0.12, 0.04, { c: 'iron', m: M.metal, detail: 0 });
          b.box(0, -0.02, -1.05, 2.1, 0.1, 1.1, { c: '#8a7b5e', m: M.straw, bevel: 0.03, ao: 0.4 });
          for (var s = 0; s < 6; s++) b.ball(b.j(0.8), 0.1, -0.75 - b.r() * 0.7, 0.2 + b.r() * 0.12, { c: b.pick(['#bfa977', '#b7a06d', '#ae9866']), m: M.straw, sy: 0.4, detail: 1, ao: 0.4 });
          b.box(0, 0, -1.55, 2.3, base + 2.5, 0.08, { c: '#1d1b19', m: M.dark, bevel: 0, ao: 0, jit: 0 });
          b.shield(0, base + 2.19, 0.16, { kind: 'round', c: gi % 2 ? 'bone' : 'ink', s: 0.5, emblem: 'none' });
          b.pop();
        });
        b.unit(function () {
          b.push(p[0], 0, p[1], ry);
          // the barred leaves: the second stall stands open
          var open = gi === 1 ? [1.45, 1.2] : gi === 3 ? [0.25, 0] : [0, 0];
          b.push(-1.0, base + 0.02, 0.1, 0); ringBarLeaf(b, 0.99, 1.92, 1, open[0]); b.pop();
          b.push(1.0, base + 0.02, 0.1, 0); ringBarLeaf(b, 0.99, 1.92, -1, open[1]); b.pop();
          if (!open[0]) { b.box(0.0, base + 0.9, 0.16, 0.36, 0.08, 0.05, { c: 'iron', m: M.metal, bevel: 0.01 }); b.addGeo(new T.TorusGeometry(0.06, 0.016, 4, 10), { x: 0.06, y: base + 0.8, z: 0.2, c: 'iron', m: M.metal, ao: 0 }); }
          b.pop();
        });
      });

      b.part('Outer wall');
      for (var k2 = 0; k2 < 8; k2++) {
        ringCourse(b, 11.4, 0.6, base + k2 * 0.41, 0.41, { len: 0.86, pal: 'stone', gaps: [ringCut(11.4)], split: 2, off: (k2 % 2) * 0.5 });
      }

      b.part('Gate cut walls');
      var cutA = Math.sqrt(8.0 * 8.0 - 2.1 * 2.1), cutB = Math.sqrt(11.7 * 11.7 - 2.1 * 2.1), wingB = 14.4;
      for (var k3 = 0; k3 < 9; k3++) {
        (function (k3) {
          b.unit(function () {
            [-1, 1].forEach(function (sd) {
              var a = ringAx(cutA, sd * 2.1), c = ringAx(k3 < 6 ? wingB : cutB, sd * 2.1);
              if (sd > 0) { var t = a; a = c; c = t; }
              b.stoneWall(a[0], a[1], c[0], c[1], k3 * 0.41, 0.41, 0.6, { pal: 'stone', len: 0.8, course: 0.41 });
            });
          });
        })(k3);
      }
      b.unit(function () {
        // cap stones along the tops, stepping down where the walls run out through the bank
        [-1, 1].forEach(function (sd) {
          [[cutA - 0.1, cutB + 0.05, 3.69], [cutB + 0.05, wingB + 0.05, 2.46]].forEach(function (s) {
            var n = Math.round((s[1] - s[0]) / 0.75);
            for (var q = 0; q < n; q++) { var ax = s[0] + (q + 0.5) * (s[1] - s[0]) / n, c = ringAx(ax, sd * 2.1); b.box(c[0], s[2], c[1], 0.78, 0.18, (s[1] - s[0]) / n - 0.04, { ry: Math.atan2(EX, EZ) + b.j(0.02), c: b.stoneC('sandstone'), m: M.stone, bevel: 0.04 }); }
          });
          // a pier where the tall wall steps down
          var pc = ringAx(cutB + 0.2, sd * 2.1);
          b.box(pc[0], 2.46, pc[1], 0.86, 1.4, 0.8, { ry: Math.atan2(EX, EZ), c: 'stone', m: M.stone, bevel: 0.05 });
          b.box(pc[0], 3.86, pc[1], 1.0, 0.2, 0.94, { ry: Math.atan2(EX, EZ), c: 'sandstone', m: M.stone, bevel: 0.05 });
        });
      });

      b.part('Rubble fill');
      b.unit(function () {
        // packed rubble behind the pit wall, the stalls left open in it
        var sg = function (r) { return STALLS.map(function (a) { return ringGap(a, Math.asin(1.0 / r)); }); };
        [[8.7, 9.6, PW]].forEach(function (f) {
          var rm = (f[0] + f[1]) / 2;
          ringCourse(b, rm, f[1] - f[0] + 0.02, 0, f[2], { len: 2.4, pal: 'stoneDark', gaps: [ringCut(rm)].concat(sg(rm)), core: false, hj: 1.0, bev: 0.02 });
        });
      });
      b.unit(function () {
        [[9.6, 10.35, WT], [10.35, 11.1, WT + 0.4]].forEach(function (f) {
          var rm = (f[0] + f[1]) / 2;
          ringCourse(b, rm, f[1] - f[0] + 0.02, 0, f[2], { len: 2.4, pal: 'stoneDark', gaps: [ringCut(rm)], core: false, hj: 1.0, bev: 0.02 });
        });
      });

      b.part('Walkway');
      [[7.86, 8.78], [8.8, 9.6]].forEach(function (rw, i) {
        var rm = (rw[0] + rw[1]) / 2;
        ringCourse(b, rm, rw[1] - rw[0], PW, 0.2, { len: 1.05, pal: i ? 'stone' : 'sandstone', gaps: [ringCut(rm)], split: 3, core: false, hj: 0.97, bev: 0.04, off: i * 0.5 });
      });

      b.part('Stone benches');
      TIERS.forEach(function (t, i) {
        var rm = (t[0] + t[1]) / 2;
        ringCourse(b, rm, t[1] - t[0] - 0.02, t[2], 0.4, { len: 1.15, pal: 'stone', gaps: [ringCut(rm)], split: 6, core: true, hj: 0.97, bev: 0.05, off: i * 0.33 });
      });

      b.part('Parapet');
      for (var k4 = 8; k4 < 10; k4++) ringCourse(b, 11.4, 0.6, base + k4 * 0.41, 0.41, { len: 0.86, pal: 'stone', gaps: [ringCut(11.4)], split: 2, off: (k4 % 2) * 0.5 });
      ringCourse(b, 11.4, 0.82, PT, 0.16, { len: 1.0, pal: 'sandstone', gaps: [ringCut(11.4, 2.45)], split: 2, core: false, hj: 1.0, bev: 0.04 });
      b.unit(function () {
        // the piers the dome's ribs stand on, each with an iron shoe
        for (var r = 0; r < RIBS; r++) {
          var a = ribA(r), p = ringPol(DR, a), ry = ringOut(a);
          b.box(p[0], PT + 0.16, p[1], 0.86, DOME0 - PT - 0.16 - 0.12, 0.92, { ry: ry, c: b.stoneC('stone'), m: M.stone, bevel: 0.05 });
          b.box(p[0], DOME0 - 0.12, p[1], 1.0, 0.14, 1.04, { ry: ry, c: 'sandstone', m: M.stone, bevel: 0.04 });
          b.box(p[0], DOME0 + 0.02, p[1], 0.5, 0.08, 0.6, { ry: ry, c: 'iron', m: M.metal, bevel: 0.01 });
        }
      });

      b.part('Earth bank');
      // the bank heaped against the outer wall so the ring sits sunk in its mound; cut through for the gate
      var bankGeo = (function () {
        var R0 = 11.6, R1 = 14.6, RT = 14.2, H0 = 2.45, NA = 220, NRr = 14, pos = [], cols = [], idx = [], i, j;
        function hAt(r, x, z) {
          var f = (r - R0) / (RT - R0), h;
          if (f <= 1) h = H0 * (1 - Math.pow(Math.max(0, f), 1.7)) + U.fbm3(x * 0.22 + 4.1, 0.3, z * 0.22, 3) * 0.22 * Math.sin(Math.PI * Math.max(0, Math.min(1, f)));
          else h = -0.12 * Math.min(1, (f - 1) / ((R1 - RT) / (RT - R0)));
          return h;
        }
        var c0 = new T.Color('#5d6b4c'), c1 = new T.Color('#76805e'), c2 = new T.Color('#4a5842');
        for (i = 0; i <= NA; i++) for (j = 0; j <= NRr; j++) {
          var a = E + i / NA * TAU, r = R0 + (R1 - R0) * Math.pow(j / NRr, 0.9), x = Math.cos(a) * r, z = Math.sin(a) * r;
          var ax = x * EX + z * EZ, lat = x * TX + z * TZ;
          if (ax > 0 && Math.abs(lat) < 2.42) { var sg2 = i === NA ? -1 : i === 0 ? 1 : Math.sign(lat) || 1; lat = sg2 * 2.42; x = EX * ax + TX * lat; z = EZ * ax + TZ * lat; r = Math.hypot(x, z); }
          pos.push(x, hAt(r, x, z), z);
        }
        for (i = 0; i < NA; i++) for (j = 0; j < NRr; j++) { var p0 = i * (NRr + 1) + j, p1 = p0 + 1, q0 = p0 + NRr + 1, q1 = q0 + 1; idx.push(p0, q0, q1, p0, q1, p1); }
        var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
        // wind every face upward
        var P = g.attributes.position, mi = (NA / 2) * NRr * 6, A = new T.Vector3().fromBufferAttribute(P, idx[mi]), Bv = new T.Vector3().fromBufferAttribute(P, idx[mi + 1]), Cv = new T.Vector3().fromBufferAttribute(P, idx[mi + 2]);
        if (Bv.sub(A).cross(Cv.sub(A)).y < 0) { for (i = 0; i < idx.length; i += 3) { var t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); }
        g.computeVertexNormals();
        var N = g.attributes.normal; for (i = 0; i < N.count; i++) if (!(N.getY(i) > -2)) N.setXYZ(i, 0, 1, 0);
        var colors = function (x, y, z) { var n = U.fbm3(x * 0.18 + 2, 3, z * 0.18, 3), cc = c0.clone().lerp(c1, U.clamp(n * 1.2 + 0.35, 0, 1) * 0.45).lerp(c2, U.clamp(-n * 1.5, 0, 1) * 0.6); cc.offsetHSL(0, 0, U.noise3(x * 0.9, 1, z * 0.9) * 0.03); return cc; };
        return { g: g, colors: colors, h: function (x, z) { return hAt(Math.hypot(x, z), x, z); } };
      })();
      b.unit(function () { b.addGeo(bankGeo.g, { c: '#ffffff', m: M.grass, ao: 0, jit: 0, vary: 0.05, colors: bankGeo.colors }); });
      b.unit(function () {
        // turf tufts, white flowers and stones bedded in the bank
        for (var t = 0; t < 240; t++) {
          var a = b.r() * TAU, r = 11.95 + b.r() * 2.3, x = Math.cos(a) * r, z = Math.sin(a) * r, ax = x * EX + z * EZ, lat = x * TX + z * TZ;
          if (ax > 0 && Math.abs(lat) < 2.75) continue;
          if (Math.abs(ringNorm(a) - ringNorm(STAIR)) < 1.3 / r) continue;
          var y = bankGeo.h(x, z);
          b.grass(x, y, z, 0.3 + b.r() * 0.35);
          if (b.r() < 0.18) b.flowers(x, y, z, 0.3, { n: 4, c: '#f3f1ec' });
          if (b.r() < 0.06) b.rock(x, y - 0.12, z, 0.25 + b.r() * 0.3);
        }
        // a few bushes and bedded boulders down the bank's lower slope
        [[2.45, 13.5, 0.85, 1], [2.78, 13.3, 0.7, 0], [1.88, 13.6, 0.6, 1], [3.1, 13.4, 0.8, 0], [-2.6, 13.4, 0.8, 0]].forEach(function (q) {
          var p = ringPol(q[1], q[0]); b.bush(p[0], p[1], q[2], { y: bankGeo.h(p[0], p[1]) - 0.12, flowers: q[3] ? '#f3f1ec' : undefined });
        });
        [[2.3, 13.0, 0.45], [2.6, 12.6, 0.35], [2.95, 13.7, 0.5], [1.97, 12.9, 0.3]].forEach(function (q) {
          var p = ringPol(q[1], q[0]); b.rock(p[0], bankGeo.h(p[0], p[1]) - 0.15, p[1], q[2]);
        });
      });

      b.part('Spectators\' stair');
      b.unit(function () {
        // stone steps up the bank, each step two or three stones set on the turf, kerbs either side
        var n = 10, ry = ringOut(STAIR);
        for (var i = 0; i < n; i++) {
          var r = 11.85 + i * 0.255, p = ringPol(r, STAIR), top = bankGeo.h(p[0], p[1]) + 0.1 - i * 0.004, ns = i % 2 ? 2 : 3;
          for (var q = 0; q < ns; q++) {
            var w = 1.5 / ns, lat = -0.75 + (q + 0.5) * w, c = [p[0] + Math.cos(STAIR + Math.PI / 2) * lat, p[1] + Math.sin(STAIR + Math.PI / 2) * lat];
            b.box(c[0], top - 0.42, c[1], w - 0.04, 0.42 + b.j(0.015), 0.3, { ry: ry + b.j(0.03), c: b.stoneC(q % 2 ? 'stoneCool' : 'stone'), m: M.stone, bevel: 0.035, ao: 0.25 });
          }
          [-1, 1].forEach(function (sd) {
            var c = [p[0] + Math.cos(STAIR + Math.PI / 2) * sd * 0.88, p[1] + Math.sin(STAIR + Math.PI / 2) * sd * 0.88];
            b.box(c[0], top - 0.4, c[1], 0.24, 0.5 + b.j(0.04), 0.27, { ry: ry + b.j(0.05), c: b.stoneC('stoneDark'), m: M.stone, bevel: 0.04, ao: 0.3 });
          });
        }
      });
      b.unit(function () {
        // the door at the top: a low opening in the outer wall with a timber frame, its plank leaf swung open
        var p = ringPol(11.74, STAIR), ry = ringOut(STAIR), y0 = 2.42;
        b.push(p[0], y0, p[1], ry);
        b.box(0, 0, 0.0, 0.96, 1.6, 0.06, { c: '#1d1b19', m: M.dark, bevel: 0, ao: 0, jit: 0 });
        [-1, 1].forEach(function (sd) { b.box(sd * 0.56, 0, 0.06, 0.17, 1.66, 0.16, { c: 'beam', m: M.wood, bevel: 0.025 }); });
        b.box(0, 1.62, 0.07, 1.36, 0.17, 0.2, { c: 'beam', m: M.wood, bevel: 0.03 });
        for (var q = 0; q < 4; q++) b.ball(-0.45 + q * 0.3, 1.7, 0.18, 0.03, { c: 'iron', m: M.metal, detail: 0 });
        b.box(0, -0.04, 0.12, 1.3, 0.1, 0.4, { c: 'sandstone', m: M.stone, bevel: 0.03 });
        b.push(-0.48, 0.04, 0.12, -1.25);
        for (var k = 0; k < 4; k++) b.box(0.12 + k * 0.23, 0, 0.0, 0.22, 1.5, 0.06, { c: b.pick(['#4e4135', '#463a30', '#55473a']), m: M.wood, bevel: 0.01, ao: 0.3 });
        [0.3, 1.15].forEach(function (yy) { b.box(0.47, yy, 0.045, 0.92, 0.08, 0.025, { c: 'iron', m: M.metal, bevel: 0.005 }); });
        b.pop();
        b.pop();
        // a torch bracket beside it
        var tp = ringPol(11.75, STAIR + 0.075); b.torch(tp[0], y0 + 1.0, tp[1], { ry: ry, s: 0.5 });
      });

      b.part('Great gate');
      var gEdge = cutA + 0.12, gry = Math.atan2(EX, EZ);
      b.unit(function () {
        // carved gate posts with dragon heads looking out down the cut, and a crossbeam with a shield
        [-1, 1].forEach(function (sd) { var p = ringAx(gEdge, sd * 1.62); ringStave(b, p[0], p[1], 4.1, gry - Math.PI / 2, { w: 0.36, hs: 1.05 }); });
        b.push(ringAx(gEdge, 0)[0], 3.62, ringAx(gEdge, 0)[1], gry);
        b.box(0, 0, 0, 3.7, 0.34, 0.34, { c: 'beam', m: M.wood, bevel: 0.04 });
        for (var q = 0; q < 8; q++) b.ball(-1.5 + q * 0.43, 0.17, 0.18, 0.035, { c: 'iron', m: M.metal, detail: 0 });
        b.shield(0, -0.3, 0.24, { kind: 'round', c: 'ink', s: 0.9, emblem: 'none' });
        b.pop();
      });
      b.unit(function () {
        // two great leaves of planking strapped with iron: the left one shut, the right swung back into the ring
        var tones = ['#4e4135', '#463a30', '#55473a', '#3f342b'];
        [[-1, 0.05], [1, 1.75]].forEach(function (lf) {
          var sd = lf[0], hp = ringAx(gEdge + 0.12, sd * 1.4), w = 1.4, h = 3.25;
          b.push(hp[0], base, hp[1], gry + sd * lf[1]);
          for (var i = 0; i < 6; i++) b.box(sd * (i + 0.5) * w / 6, 0, 0, w / 6 - 0.02, h * (1 + b.j(0.01)), 0.1, { c: b.pick(tones), m: M.wood, bevel: 0.012, ao: 0.35 });
          [0.45, 1.6, 2.75].forEach(function (yy) { b.box(sd * w / 2, yy, 0.065, w - 0.04, 0.12, 0.03, { c: 'iron', m: M.metal, bevel: 0.006 }); for (var s = 0; s < 5; s++) b.ball(sd * (0.12 + s * 0.29), yy + 0.06, 0.085, 0.03, { c: 'iron', m: M.metal, detail: 0 }); });
          b.beam([sd * 0.1, 0.6, 0.07], [sd * (w - 0.1), 1.5, 0.07], 0.05, { c: 'woodDark', r2: 0.025 });
          b.addGeo(new T.TorusGeometry(0.11, 0.022, 4, 12), { x: sd * (w - 0.2), y: 1.45, z: 0.12, c: 'iron', m: M.metal, ao: 0 });
          b.pop();
        });
      });
      b.unit(function () {
        // the cut's flagstones from the gate out to the path
        var n = 15;
        for (var q = 0; q < n; q++) for (var c = 0; c < 6; c++) {
          var ax = cutA + 1.35 + (q + 0.5) * (14.7 - cutA - 1.35) / n + (c % 2) * 0.12, lat = -1.5 + c * 0.6, p = ringAx(ax, lat);
          b.box(p[0], 0.0, p[1], 0.56, 0.1 + b.j(0.015), (14.7 - cutA - 1.35) / n - 0.06, { ry: gry + b.j(0.04), c: b.stoneC(c % 2 ? 'stoneCool' : 'stone'), m: M.stone, bevel: 0.03, ao: 0.1 });
        }
      });
      b.unit(function () {
        // the mouth of the cut: two tall carved posts with dragon heads looking out over the path
        [-1, 1].forEach(function (sd) { var p = ringAx(14.8, sd * 2.25); ringStave(b, p[0], p[1], 3.0, gry - Math.PI / 2, { w: 0.42, hs: 1.7 }); });
      });

      b.part('Dome ribs');
      var u1 = Math.acos(1.15 / DR), ribP = function (a, u) { var rr = DR * Math.cos(u); return [Math.cos(a) * rr, DOME0 + DOMEH * Math.sin(u), Math.sin(a) * rr]; };
      for (var r2 = 0; r2 < RIBS; r2++) {
        (function (r2) {
          b.unit(function () {
            var a = ribA(r2), n = 16;
            for (var i = 0; i < n; i++) {
              var ua = u1 * i / n, ub = u1 * (i + 1) / n, pa = ribP(a, ua), pb = ribP(a, ub);
              b.beam(pa, pb, 0.085, { c: 'iron', m: M.metal, r2: 0.12, bevel: 0.02, roll: -a });
              if (i % 4 === 2) { var pm = ribP(a, (ua + ub) / 2); b.ball(pm[0], pm[1], pm[2], 0.13, { c: 'iron', m: M.metal, detail: 0, sy: 0.7 }); }
            }
            // a knee of iron where the rib leaves its pier
            var f0 = ribP(a, 0), f1 = ribP(a, 0.16), fo = ringPol(DR + 0.45, a);
            b.beam([fo[0], DOME0 + 0.05, fo[1]], f1, 0.06, { c: 'iron', m: M.metal });
          });
        })(r2);
      }
      b.part('Dome hoops and crown');
      [0.62, 1.08].forEach(function (u) {
        var rr = DR * Math.cos(u), y = DOME0 + DOMEH * Math.sin(u);
        [0, 1, 2].forEach(function (h) {
          b.unit(function () {
            for (var r = h * RIBS / 3; r < (h + 1) * RIBS / 3; r++) {
              for (var s = 0; s < 3; s++) {
                var a0 = ribA(r) + s / 3 * TAU / RIBS, a1 = ribA(r) + (s + 1) / 3 * TAU / RIBS;
                b.beam([Math.cos(a0) * rr, y, Math.sin(a0) * rr], [Math.cos(a1) * rr, y, Math.sin(a1) * rr], 0.07, { c: 'iron', m: M.metal, r2: 0.09, bevel: 0.015 });
              }
              b.box(Math.cos(ribA(r)) * rr, y - 0.14, Math.sin(ribA(r)) * rr, 0.34, 0.28, 0.34, { ry: ringOut(ribA(r)), c: 'iron', m: M.metal, bevel: 0.02 });
            }
          });
        });
      });
      var crownY = DOME0 + DOMEH * Math.sin(u1);
      b.unit(function () {
        b.addGeo(new T.TorusGeometry(1.15, 0.11, 6, 28), { y: crownY, rx: Math.PI / 2, c: 'iron', m: M.metal, ao: 0.05 });
        b.cyl(0, crownY - 0.1, 0, 0.5, 0.26, { c: 'iron', m: M.metal, seg: 12 });
        for (var r = 0; r < RIBS; r++) { var a = ribA(r); b.beam([Math.cos(a) * 1.12, crownY, Math.sin(a) * 1.12], [Math.cos(a) * 0.45, crownY + 0.05, Math.sin(a) * 0.45], 0.05, { c: 'iron', m: M.metal }); }
        b.cone(0, crownY + 0.16, 0, 0.14, 0.18, { c: 'iron', m: M.metal, seg: 6 });
      });

      b.part('Chains');
      // chains slung between the ribs in two rows, and one long chain across the top with a hook
      [[0.82, 0.55], [1.24, 0.32]].forEach(function (row) {
        [0, 1, 2, 3].forEach(function (q4) {
          b.unit(function () {
            for (var r = q4 * 3; r < q4 * 3 + 3; r++) ringChain(b, ribP(ribA(r), row[0]), ribP(ribA(r + 1), row[0]), row[1]);
          });
        });
      });
      b.unit(function () {
        var a = ribA(1), c = ribA(7);
        ringChain(b, ribP(a, 0.95), ribP(c, 0.95), 2.2);
        ringChain(b, ribP(ribA(4), 0.95), ribP(ribA(10), 0.95), 2.0);
      });

      b.part('Shields and banners');
      [0, 1].forEach(function (h) {
        b.unit(function () {
          // round shields hung all round the parapet's outer face
          for (var r = h * RIBS; r < (h + 1) * RIBS; r++) {
            var a = E + (r + 0.5) * TAU / (RIBS * 2) + TAU / (RIBS * 4);
            var cg = ringCut(11.7, 2.9); if (ringNorm(a) > cg[0] && ringNorm(a) < cg[1]) continue;
            var p = ringPol(11.76, a), k = r % 3;
            b.shield(p[0], 3.95, p[1], { kind: 'round', c: k === 0 ? 'ink' : k === 1 ? 'bone' : 'inkGrey', s: 0.74, emblem: 'none', ry: ringOut(a), rx: -0.08 });
            if (k === 1) { var p2 = ringPol(11.81, a); b.box(p2[0], 3.88, p2[1], 0.06, 0.18, 0.04, { ry: ringOut(a), c: 'ink', m: M.paint, bevel: 0 }); }
          }
        });
      });
      b.unit(function () {
        // long black banners down the parapet either side of the cut, hung from iron arms
        [E - 0.42, E + 0.42].forEach(function (a, bi) {
          var p = ringPol(11.95, a), ry = ringOut(a);
          b.push(p[0], PT + 0.08, p[1], ry);
          b.beam([0, 0, -0.35], [0, 0, 0.05], 0.04, { c: 'iron', m: M.metal });
          b.banner(0, 0, 0.0, 1.2, 1.9, { c: bi ? 'bone' : 'ink', emblem: 'none', tail: 'swallow', band: 'ember', bandAt: 0.76, bandH: 0.05, trim: 'iron' });
          ringClaws(b, 0, -0.8, 0, 0.8, bi ? '#1f1e1c' : '#f1eee8');
          b.pop();
        });
      });

      b.part('Pennants and furs');
      [0, 1].forEach(function (h) {
        b.unit(function () {
          // ink and bone pennants on every other pier of the dome
          for (var r = h; r < RIBS; r += 2) { var a = ribA(r), p = ringPol(DR + 0.36, a); b.flag(p[0], DOME0 - 0.05, p[1], 1.6, 0.85, 0.34, { c: (r >> 1) % 2 ? 'bone' : 'ink', pennant: true, pr: 0.03, ry: -0.55 }); }
        });
      });
      [0, 1].forEach(function (h) {
        b.unit(function () {
          // furs and cushions thrown on the far benches, a shield and a horn left by a seat
          var spots = h ? [[-2.2, 0], [-1.5, 1], [-0.7, 0], [-0.05, 1]] : [[-2.6, 1], [-1.95, 0], [-1.25, 0], [-0.55, 1]];
          spots.forEach(function (sp, i) {
            var t = TIERS[sp[1]], a = sp[0] + b.j(0.05), p = ringPol((t[0] + t[1]) / 2 + 0.05, a);
            b.ball(p[0], t[2] + 0.4, p[1], 0.36, { c: b.pick(['#3b3a38', '#efebe4', '#5c5e62', '#2f2e2c', '#8a857c']), m: M.cloth, sy: 0.18, sx: 1.4, ry: ringIn(a) + Math.PI / 2, detail: 1, ao: 0.2 });
            if (i === 1) { var q = ringPol(t[1] - 0.18, a + 0.06); b.shield(q[0], t[2] + 0.75, q[1], { kind: 'round', c: h ? 'bone' : 'ink', s: 0.6, emblem: 'none', ry: ringIn(a), rx: 0.25 }); }
          });
        });
      });

      b.part('Training gear');
      var WP = function (d, l) { return [d * 0.58 + l * 0.81, -d * 0.81 + l * 0.58]; };   // depth into the ring from the camera, and across it
      b.unit(function () { ringBarrier(b, -3.65, -4.45, Math.PI / 2, { burnt: true }); });
      b.unit(function () { ringBarrier(b, 1.78, 3.67, 2.52, { w: 2.3 }); });
      b.unit(function () {
        // spare barriers stacked against the wall by the open stall
        var a = -0.15, p = ringPol(7.35, a), ry = ringIn(a);
        [0, 1].forEach(function (i) { var q = ringPol(7.35 - i * 0.16, a + i * 0.02); b.push(q[0], 0.14, q[1], ry); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(-0.12)); for (var k = 0; k < 6; k++) b.box(-0.9 + k * 0.36, 0, 0, 0.33, 1.75 + b.j(0.05), 0.07, { c: b.pick(['#6a5845', '#5f4f3f', '#574839']), m: M.wood, bevel: 0.012, ao: 0.35 }); b.box(0, 0.4, -0.06, 2.1, 0.12, 0.05, { c: 'woodDark', m: M.wood }); b.pop(); });
      });
      b.unit(function () { ringBarrier(b, -2.7, 3.3, 0.9, { fallen: true, burnt: true, w: 2.1 }); });
      b.unit(function () { var p = ringPol(6.6, -0.95); ringTarget(b, p[0], p[1], ringIn(-0.95) - 0.3); });
      b.unit(function () {
        // shields dropped on the floor, one on its rim against the barrier
        [[[-3.0, 2.2], 0.2, 'bone'], [[-2.1, -3.1], 1.9, 'ink'], [[3.7, 3.5], 0.8, 'inkGrey']].forEach(function (s) {
          b.shield(s[0][0], 0.14, s[0][1], { kind: 'round', c: s[2], s: 0.78, emblem: 'none', rx: -Math.PI / 2 + 0.06, ry: s[1] });
        });
        b.shield(1.55, 0.42, 2.75, { kind: 'round', c: 'ink', s: 0.78, emblem: 'none', rx: -0.35, ry: 2.52 + Math.PI });
      });
      b.unit(function () {
        // a rack of shields and spears against the wall between two stalls
        var a = 0.6, p = ringPol(7.45, a);
        b.rack(p[0], 0.14, p[1], 2.2, { kind: 'shields', ry: ringIn(a) });
        var a2 = 2.25, p2 = ringPol(7.45, a2);
        b.rack(p2[0], 0.14, p2[1], 1.6, { kind: 'spears', ry: ringIn(a2) });
      });
      b.unit(function () {
        // water against fire: barrels and buckets by the great gate, a trough by the stalls
        var p = ringAx(6.6, 2.6), p2 = ringAx(6.5, -2.7);
        b.barrel(p[0], 0.14, p[1], { h: 1.0, r: 0.36 }); b.barrel(p[0] + 0.7, 0.14, p[1] - 0.3, {});
        b.bucket(p2[0], 0.14, p2[1]); b.bucket(p2[0] + 0.45, 0.14, p2[1] + 0.25); b.barrel(p2[0] - 0.5, 0.14, p2[1] - 0.45, { h: 0.85 });
        var tp = ringPol(7.3, 3.0), try_ = ringIn(3.0) + Math.PI / 2;
        b.push(tp[0], 0.14, tp[1], try_);
        b.box(0, 0, 0, 2.0, 0.55, 0.7, { c: 'stone', m: M.stone, bevel: 0.05 });
        b.box(0, 0.5, 0, 1.75, 0.04, 0.48, { c: '#5b6a70', m: M.water || M.window, bevel: 0, ao: 0 });
        b.pop();
      });
      b.unit(function () {
        // fish for a good dragon, a coil of rope and a straw dummy
        ringFishBasket(b, -4.3, 0.14, -2.6, 1); ringFishBasket(b, -4.85, 0.14, -2.2, 0.9);
        var q = [-1.2, 3.2]; b.ropeCoil(q[0], 0.14, q[1], 0.32); b.ropeCoil(q[0], 0.22, q[1], 0.26);
        var dm = ringPol(6.5, -2.78); b.dummy(dm[0], 0.14, dm[1], { ry: 0.9, helm: true, shield: 'bone' });
      });

      b.part('Braziers and torches');
      b.unit(function () {
        [-2.6, -0.3, 0.95].forEach(function (a) { var p = ringPol(9.2, a); b.brazier(p[0], WT, p[1], 0.75); });
      });
      b.unit(function () {
        STALLS.forEach(function (a) { [-1, 1].forEach(function (sd) { var at = a + sd * Math.asin(1.42 / 8.0), p = ringPol(7.99, at); b.torch(p[0], base + 1.45, p[1], { ry: ringIn(at), s: 0.55 }); }); });
      });

      b.part('Ivy');
      b.unit(function () {
        [2.55, 2.95, 1.25].forEach(function (a, i) {
          var n = [Math.cos(a), 0, Math.sin(a)], p = ringPol(11.75, a);
          b.ivy([[p[0], 2.2, p[1]], [p[0] + n[2] * 0.3, 3.2, p[1] - n[0] * 0.3], [p[0] - n[2] * 0.2, 4.2 - i * 0.3, p[1] + n[0] * 0.2]], n, { density: 6, spread: 0.45 });
        });
        var w = ringAx(12.6, -2.42);
        b.ivy([[w[0], 0.8, w[1]], [w[0] + EX * 0.4, 1.8, w[1] + EZ * 0.4], [w[0] - EX * 0.3, 2.4, w[1] - EZ * 0.3]], [TX * -1, 0, TZ * -1], { density: 6, spread: 0.4 });
      });

      b.part('Ring yard');
      var gh = function (x, z) { return b.ground && b.ground.height ? b.ground.height(x, z) : 0; };
      b.unit(function () {
        // a fish cart by the path, baskets of the day's catch for the dragons
        var cp = ringPol(15.3, 1.78), cry = 1.36, cy0 = Math.min(gh(cp[0], cp[1]), gh(cp[0] - 0.4, cp[1] + 0.8)) - 0.02;
        b.push(0, cy0, 0, 0);
        b.cart(cp[0], cp[1], { ry: cry, load: function (bb) {
          ringFishBasket(bb, -0.3, 0.77, -0.55, 0.9); ringFishBasket(bb, 0.3, 0.77, -0.5, 0.85); ringFishBasket(bb, -0.22, 0.77, 0.3, 0.95);
          bb.barrel(0.34, 0.77, 0.5, { h: 0.7, r: 0.26 });
        } });
        b.pop();
        // barrels, a crate and baskets set down beside it
        [[ringPol(15.3, 1.98), 0.9, 0], [ringPol(14.75, 2.07), 0.8, 0]].forEach(function (q) { b.barrel(q[0][0], gh(q[0][0], q[0][1]) - 0.03, q[0][1], { h: q[1] }); });
        var lb = ringPol(15.6, 2.03); b.barrel(lb[0], gh(lb[0], lb[1]) - 0.04, lb[1], { lie: true, ry: 0.4, h: 0.85 });
        var cr = ringPol(14.75, 1.92); b.crate(cr[0], gh(cr[0], cr[1]) - 0.02, cr[1], 0.62, { ry: 0.3 }); b.crate(cr[0] + 0.05, gh(cr[0], cr[1]) + 0.6, cr[1] - 0.02, 0.5, { ry: 0.6 });
        var fb = ringPol(15.75, 1.9); ringFishBasket(b, fb[0], gh(fb[0], fb[1]) - 0.02, fb[1], 1.0);
        var fb2 = ringPol(16.1, 1.98); ringFishBasket(b, fb2[0], gh(fb2[0], fb2[1]) - 0.03, fb2[1], 0.85);
      });
      b.unit(function () {
        // a banner pole at the turn of the path, its banner toward the road
        var rp = ringPol(15.2, 2.32), y = gh(rp[0], rp[1]);
        ringBannerPole(b, rp[0], y, rp[1], 0.1, 4.4);
        [[0.7, 0.25, 0.32], [-0.6, 0.4, 0.26], [0.2, -0.45, 0.22]].forEach(function (k) { b.rock(rp[0] + k[0], gh(rp[0] + k[0], rp[1] + k[1]) - 0.08, rp[1] + k[1], k[2]); });
        for (var t = 0; t < 7; t++) { var gx = rp[0] + b.j(1.0), gz = rp[1] + b.j(0.6) + 0.5; b.grass(gx, gh(gx, gz), gz, 0.35 + b.r() * 0.25); }
      });
      b.unit(function () {
        // a rack of practice shields and a stack of split wood for the braziers
        var sp = ringPol(15.0, 2.56), sa = 2.56;
        b.rack(sp[0], gh(sp[0], sp[1]) - 0.02, sp[1], 2.4, { kind: 'shields', ry: Math.atan2(Math.cos(sa), Math.sin(sa)) });
        var wp = ringPol(15.0, 2.8), wy = gh(wp[0], wp[1]) - 0.03;
        b.push(0, wy, 0, 0); b.woodpile(wp[0], wp[1], { n: 5, len: 1.3, ry: -2.19 }); b.pop();
        var ax = ringPol(15.7, 2.71); b.push(ax[0], gh(ax[0], ax[1]), ax[1], 0.8);
        b.box(0, 0, 0, 0.5, 0.42, 0.5, { c: 'woodLight', m: M.wood, bevel: 0.04 });
        b.beam([0.05, 0.4, 0.0], [0.25, 0.95, 0.2], 0.025, { c: 'wood', round: true });
        b.box(0.0, 0.38, -0.02, 0.16, 0.06, 0.04, { c: 'steel', m: M.metal, bevel: 0.01, rz: 0.5 });
        b.pop();
      });

      b.life(function () {
        // the night dragon perched on the crown of the dome with its rider up, wings half open, the hero in the sun
        var nry = -1.35, ns = 1.35, off = 0.25 * ns, nd = [Math.sin(nry) * off, Math.cos(nry) * off];
        b.dragon(nd[0], crownY + 0.13, nd[1], { kind: 'night', pose: 'sit', ry: nry, s: ns, wing: 0.3, saddle: true });
        // in the pit the dawn dragon rears and roars at two recruits braced behind a barrier
        var dd = [-1.7, 1.0], dry = -1.35;
        b.dragon(dd[0], 0.14, dd[1], { kind: 'dawn', pose: 'roar', ry: dry, s: 1.3, wing: 0.62, saddle: true, rider: { c: '#5c5e62', cape: '#1f1e1c' } });
        // behind it the boulder dragon, ridden, crouches low and watches the trainer
        var bd = [0.6, -1.9], bry = -1.35;
        b.dragon(bd[0], 0.14, bd[1], { kind: 'boulder', pose: 'crouch', ry: bry, s: 1.3, saddle: true, rider: { c: '#4a4c50', cape: '#efebe4' }, look: ringLook(bd[0], 0.14, bd[1], bry, 1.3, -3.2, 1.6, -2.0) });
        // the trainer, and the recruits with shields braced behind the barrier
        b.figure(-3.2, -2.0, { role: 'villager', pose: 'point', ry: 1.27, beard: true, cape: '#1f1e1c', c: '#4a4c50', y: 0.14 });
        b.figure(-4.78, 1.11, { role: 'soldier', pose: 'guard', ry: 1.79, team: 'bone', y: 0.14 });
        b.figure(-4.98, 0.23, { role: 'soldier', pose: 'guard', ry: 1.79, team: 'ink', y: 0.14 });
        // the crowd on the benches: the far stands, and a few with their backs to us on the near side
        [[-1.95, 1, 'ringSitCheer'], [-1.78, 1, 'ringSit'], [-1.12, 2, 'ringSitPoint'], [-0.95, 1, 'ringSitCheer'], [-0.42, 2, 'ringSit'], [-2.45, 2, 'ringSit'], [-0.25, 1, 'ringSitCheer'], [-2.7, 1, 'ringSit'],
          [-3.0, 1, 'ringSitPoint'], [2.95, 2, 'ringSitCheer'], [2.62, 1, 'ringSit'], [2.4, 2, 'ringSitCheer'], [2.78, 1, 'ringSitPoint']].forEach(function (s, i) {
          var t = TIERS[s[1] - 1], rr = t[0] + 0.12, p = ringPol(rr, s[0]), y = s[1] === 1 ? WT : TIERS[s[1] - 2][2] + 0.4;
          b.figure(p[0], p[1], { role: i === 5 || i === 11 ? 'child' : 'villager', pose: s[2], ry: ringIn(s[0]), y: y, cape: i % 3 === 0 ? '#1f1e1c' : undefined, beard: i === 2 || i === 9 });
        });
        var kp = ringPol(6.9, -1.62);
        b.figure(kp[0], kp[1], { role: 'villager', pose: 'talk', ry: ringIn(-1.62) + 0.5, c: '#6f6a62', y: 0.14 });
        var ch = ringPol(8.5, -1.62);
        b.figure(ch[0], ch[1], { role: 'child', pose: 'cheer', ry: ringIn(-1.62), y: WT });
        // two folk climbing the stair to the benches
        [[3, 'walk'], [7, 'walk']].forEach(function (c, i) {
          var r = 11.85 + c[0] * 0.255, lat = i ? -0.3 : 0.3, p = ringPol(r, STAIR + lat / r);
          b.figure(p[0], p[1], { role: 'villager', pose: c[1], ry: ringIn(STAIR), y: bankGeo.h(p[0], p[1]) + 0.1, c: i ? '#6f6a62' : '#4a4c50', cape: i ? undefined : '#1f1e1c' });
        });
        // outside: a carrier with a sack of fish for the stalls, a child running to the gate, the carter
        var gh2 = function (x, z) { return b.ground && b.ground.height ? b.ground.height(x, z) : 0; };
        b.figure(0.9, 15.4, { role: 'villager', pose: 'carry', ry: 2.2, c: '#5c5e62', y: gh2(0.9, 15.4) });
        b.figure(-1.5, 16.05, { role: 'child', pose: 'run', ry: 1.85, y: gh2(-1.5, 16.05) });
        var cp = ringPol(14.4, 1.7);
        b.figure(cp[0], cp[1], { role: 'villager', pose: 'talk', ry: -1.07, beard: true, c: '#4a4c50', y: gh2(cp[0], cp[1]) });
      });
    }
  });
})();
