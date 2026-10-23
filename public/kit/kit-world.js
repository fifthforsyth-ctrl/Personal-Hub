// Painterly village kit, part 3: nature, props, people (first pass) and the ground a build stands on.
(function () {
  var T = THREE, KIT = window.KIT, U = KIT.util, M = KIT.M, PAL = KIT.PAL, G = KIT.geo;
  var B = KIT.Builder.prototype, clamp = U.clamp, lerp = U.lerp, noise3 = U.noise3, fbm3 = U.fbm3;

  // ---------------------------------------------------------------- foliage
  // A card of painted leaves at p, facing roughly along dir, its normal pointing out of the clump so the light rolls
  // softly over the whole crown rather than flickering card to card.
  function leafCard(b, p, dir, size, c, bucket, rot) {
    var g = G.plane(size, size, 1, 1), n = g.attributes.normal;
    var d = new T.Vector3(dir[0], dir[1], dir[2]).normalize();
    for (var i = 0; i < n.count; i++) n.setXYZ(i, d.x, d.y, d.z);
    var q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(b.j(1), b.j(1), b.j(1)).add(d).normalize());
    q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), rot === undefined ? b.r() * 6.28 : rot));
    var e = new T.Euler().setFromQuaternion(q, 'YXZ');
    // the normals were set in local space; keep them pointing along dir in the build frame
    var inv = new T.Quaternion().copy(q).invert();
    var ld = d.clone().applyQuaternion(inv);
    for (var k = 0; k < n.count; k++) n.setXYZ(k, ld.x, ld.y, ld.z);
    b.addGeo(g, { x: p[0], y: p[1], z: p[2], rx: e.x, ry: e.y, rz: e.z, order: 'YXZ', c: c, m: M.leaf, bucket: bucket || 'leaf', ao: 0, jit: 0.05, vary: 0.05 });
  }
  KIT.leafCard = leafCard;
  // A clump of leaves: a soft painted core with leaf cards round its skin.
  B.clump = function (x, y, z, r, o) {
    o = o || {}; var self = this, pal = o.pal || 'leaf', cards = o.cards || Math.round(10 + r * 6), bucket = o.bucket || 'leaf';
    var core = G.ball(r * 0.82, 2, { smooth: true }), p = core.attributes.position;
    for (var i = 0; i < p.count; i++) { var vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), k = 1 + noise3(vx * 1.7 + x, vy * 1.7 + y, vz * 1.7 + z) * 0.22; p.setXYZ(i, vx * k, vy * k * 0.92, vz * k); }
    core.computeVertexNormals();
    this.addGeo(core, { x: x, y: y, z: z, c: o.coreC || this.pick(PAL[o.corePal || pal]), m: M.leaf, ao: 0.45, vary: 0.1 });
    for (var c = 0; c < cards; c++) {
      var u = this.r() * 2 - 1, a = this.r() * Math.PI * 2, s = Math.sqrt(1 - u * u), dir = [Math.cos(a) * s, Math.abs(u) * (u > -0.3 ? 1 : -0.6), Math.sin(a) * s];
      var top = dir[1] > 0.4, rr = r * (0.75 + this.r() * 0.3);
      leafCard(this, [x + dir[0] * rr, y + dir[1] * rr * 0.9, z + dir[2] * rr], dir, r * (0.9 + this.r() * 0.5), this.pick(PAL[top ? (o.topPal || 'leafWarm') : pal]), bucket);
    }
    return this;
  };
  // trees: o.kind 'round' (default) | 'pine' | 'cypress' | 'olive' | 'birch'; o.h height
  B.tree = function (x, z, o) {
    o = o || {}; var kind = o.kind || 'round', h = o.h || (kind === 'pine' ? 7.5 : kind === 'cypress' ? 7 : 5.5), self = this, y0 = o.y || 0;
    this.push(x, y0, z, this.r() * 6.28);
    if (kind === 'pine') {
      this.log(0, 0, 0, 0.18 * h / 7, h * 0.55, { c: 'woodDark', r2: 0.08 });
      var tiers = 4;
      for (var t = 0; t < tiers; t++) {
        var f = t / tiers, ty = h * (0.18 + f * 0.62), tr = h * 0.24 * (1 - f * 0.7), th = h * 0.34;
        var g = G.cyl(tr, 0.05, th, 9, { flat: true, hseg: 2 }), p = g.attributes.position;
        for (var i = 0; i < p.count; i++) { var py = p.getY(i); if (py < th * 0.3) { var k = 1 + (this.r() - 0.3) * 0.25; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); p.setY(i, py - this.r() * 0.25); } }
        g.computeVertexNormals();
        this.addGeo(g, { y: ty, c: this.pick(PAL.pine), m: M.leaf, ao: 0.45, vary: 0.08 });
        for (var c = 0; c < 9; c++) { var a = c / 9 * 6.28 + this.r(); leafCard(this, [Math.cos(a) * tr * 0.85, ty + th * 0.12, Math.sin(a) * tr * 0.85], [Math.cos(a), 0.35, Math.sin(a)], tr * 0.9, this.pick(PAL.pine), 'needle'); }
      }
    } else if (kind === 'cypress') {
      // a flame of dark foliage: a lumpy spindle with leaf cards all over its skin, the tip bent a little by wind
      this.log(0, 0, 0, 0.14, h * 0.3, { c: 'woodDark' });
      var R0 = h * 0.115, yb = h * 0.1, lean = this.j(0.25), prof2 = function (f) { return R0 * Math.pow(Math.sin(Math.PI * Math.min(1, f * 0.92 + 0.04)), 0.75) * (1 - 0.3 * f); };
      var pts = []; for (var q = 0; q <= 14; q++) { var fq = q / 14; pts.push([Math.max(0.02, prof2(fq) * 0.85), yb + fq * (h - yb)]); }
      var core = G.lathe(pts, 12), pc = core.attributes.position;
      for (var vi = 0; vi < pc.count; vi++) { var vx = pc.getX(vi), vy = pc.getY(vi), vz = pc.getZ(vi), fy = (vy - yb) / (h - yb), kk = 1 + noise3(vx * 1.3, vy * 0.9, vz * 1.3) * 0.25; pc.setXYZ(vi, vx * kk + lean * fy * fy, vy, vz * kk); }
      core.computeVertexNormals();
      this.addGeo(core, { c: this.pick(PAL.pine), m: M.leaf, ao: 0.5, vary: 0.12 });
      var nc = Math.round(h * 9);
      for (var c3 = 0; c3 < nc; c3++) {
        var fy2 = Math.pow(this.r(), 0.85), a4 = this.r() * Math.PI * 2, rr4 = prof2(fy2) * (0.85 + this.r() * 0.25), up = 0.25 + fy2 * 0.3;
        leafCard(this, [Math.cos(a4) * rr4 + lean * fy2 * fy2, yb + fy2 * (h - yb), Math.sin(a4) * rr4], [Math.cos(a4), up, Math.sin(a4)], R0 * (0.75 + this.r() * 0.45), this.pick(PAL[fy2 > 0.6 && this.r() < 0.5 ? 'leaf' : 'pine']), 'leafTri');
      }
    } else {
      // a trunk that forks into two or three boughs, each carrying a clump
      var trunkH = h * (kind === 'olive' ? 0.38 : 0.45), tc = kind === 'birch' ? '#d8d2c2' : 'woodDark';
      this.beam([0, 0, 0], [this.j(0.2), trunkH, this.j(0.2)], 0.16 * h / 5.5, { c: tc, round: true, r2: 0.11 * h / 5.5, seg: 7 });
      var forks = kind === 'olive' ? 3 : 2 + Math.round(this.r()), crown = [];
      for (var f2 = 0; f2 < forks; f2++) {
        var a3 = f2 / forks * 6.28 + this.r(), lean = h * (0.16 + this.r() * 0.1), ey = h * (0.62 + this.r() * 0.12);
        var end = [Math.cos(a3) * lean, ey, Math.sin(a3) * lean];
        this.beam([0, trunkH * 0.95, 0], end, 0.09 * h / 5.5, { c: tc, round: true, r2: 0.05, seg: 6 });
        crown.push(end);
      }
      crown.push([0, h * 0.8, 0]);
      if (kind === 'round') for (var x2 = 0; x2 < 3; x2++) { var a5 = x2 / 3 * 6.28 + this.r() * 2; crown.push([Math.cos(a5) * h * 0.2, h * (0.58 + this.r() * 0.2), Math.sin(a5) * h * 0.2]); }
      var pal = kind === 'olive' ? 'leafDark' : 'leaf';
      crown.forEach(function (cp, i) { var rr3 = h * (i === crown.length - 1 ? 0.27 : 0.22) * (0.85 + self.r() * 0.3); self.clump(cp[0], cp[1] + rr3 * 0.3, cp[2], rr3, { pal: pal, topPal: kind === 'olive' ? 'leaf' : 'leafWarm', bucket: kind === 'olive' ? 'leafTri' : 'leaf' }); });
    }
    this.pop();
    return this;
  };
  B.bush = function (x, z, r, o) {
    o = o || {}; var n = o.n || 3;
    for (var i = 0; i < n; i++) { var a = this.r() * 6.28, d = r * 0.5 * this.r(); this.clump(x + Math.cos(a) * d, (o.y || 0) + r * 0.55, z + Math.sin(a) * d, r * (0.6 + this.r() * 0.35), { pal: o.pal || 'leaf', cards: 8, bucket: o.bucket }); }
    if (o.flowers) for (var k = 0; k < 8; k++) { var a2 = this.r() * 6.28; this.ball(x + Math.cos(a2) * r * 0.8, (o.y || 0) + r * (0.6 + this.r() * 0.5), z + Math.sin(a2) * r * 0.8, 0.07, { c: o.flowers, m: M.paint, ao: 0, jit: 0.05 }); }
    return this;
  };
  // a tuft of grass: crossed cards
  B.grass = function (x, y, z, s, o) {
    o = o || {}; var c = o.c || this.pick(PAL.tuft || PAL.grass);
    for (var i = 0; i < 2; i++) {
      var g = G.plane(s * 1.4, s, 1, 1), n = g.attributes.normal;
      g.translate(0, s / 2, 0);
      for (var k = 0; k < n.count; k++) n.setXYZ(k, 0, 1, 0.25);
      this.addGeo(g, { x: x, y: y - 0.04, z: z, ry: i * 1.57 + this.r(), c: c, m: M.grass, bucket: 'grass', ao: 0.7, jit: 0.05, sway: 0.3, swayFn: function (lx, ly) { return ly / s; } });
    }
    return this;
  };
  B.flowers = function (x, y, z, r, o) {
    o = o || {}; var n = o.n || 6, c = o.c || this.pick(PAL.flowers);
    for (var i = 0; i < n; i++) { var a = this.r() * 6.28, d = this.r() * r; this.ball(x + Math.cos(a) * d, y + 0.12 + this.r() * 0.18, z + Math.sin(a) * d, 0.05 + this.r() * 0.03, { c: c, m: M.paint, ao: 0, jit: 0.06, detail: 0 }); }
    return this;
  };
  B.rock = function (x, y, z, s, o) {
    o = o || {};
    var g = G.ball(1, 1, { smooth: true }), p = g.attributes.position, sd = this.r() * 100;
    for (var i = 0; i < p.count; i++) { var vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), k = 1 + noise3(vx * 1.3 + sd, vy * 1.3, vz * 1.3) * 0.35; p.setXYZ(i, vx * k, Math.max(-0.2, vy * k * 0.65), vz * k * (0.8 + 0.2 * Math.sin(sd))); }
    g = G.flat(g);
    return this.addGeo(g, { x: x, y: y, z: z, s: s, ry: this.r() * 6.28, c: o.c || this.pick(PAL.stoneCool), m: M.rock, ao: 0.4 });
  };
  // ivy climbing a wall: pts is a path [[x,y,z],...] on the wall face, n its outward normal
  B.ivy = function (pts, n, o) {
    o = o || {}; var self = this, dens = o.density || 6, spread = o.spread || 0.35;
    for (var s = 0; s < pts.length - 1; s++) {
      var a = pts[s], b = pts[s + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), k = Math.max(1, Math.round(L * dens));
      for (var i = 0; i < k; i++) {
        var t = (i + this.r()) / k, px = lerp(a[0], b[0], t), py = lerp(a[1], b[1], t), pz = lerp(a[2], b[2], t);
        var tx = (this.r() - 0.5) * spread * 2, ty = (this.r() - 0.5) * spread * 2;
        // spread across the wall plane (perpendicular to n)
        var right = new T.Vector3(n[2], 0, -n[0]).normalize(); if (right.lengthSq() < 0.1) right.set(1, 0, 0);
        px += right.x * tx; pz += right.z * tx; py += ty;
        leafCard(this, [px + n[0] * 0.06, py, pz + n[2] * 0.06], [n[0] + this.j(0.4), n[1] + 0.3, n[2] + this.j(0.4)], 0.28 + this.r() * 0.22, this.pick(this.r() < 0.6 ? PAL.leafDark : PAL.leaf), 'leafTri');
      }
    }
    return this;
  };

  // ---------------------------------------------------------------- props
  B.barrel = function (x, y, z, o) {
    o = o || {}; var h = o.h || 0.9, r = o.r || 0.32, self = this;
    this.push(x, y, z, o.ry || 0);
    if (o.lie) this.push(0, r, 0, 0), this.stack[this.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(Math.PI / 2)).multiply(new T.Matrix4().makeTranslation(0, -h / 2, 0));
    var prof = [[0.01, 0], [r * 0.86, 0], [r, h * 0.5], [r * 0.86, h], [0.01, h]];
    this.lathe(0, 0, 0, prof, { c: o.c || 'woodLight', m: M.wood, seg: 14, flat: true });
    [0.12, 0.88].forEach(function (f) { var rr = r * (0.86 + 0.14 * Math.sin(f * Math.PI)) + 0.012; self.cyl(0, h * f - 0.04, 0, rr, 0.08, { c: 'iron', m: M.metal, seg: 14, open: true }); });
    this.cyl(0, h - 0.02, 0, r * 0.8, 0.03, { c: 'wood', m: M.wood, seg: 14 });
    if (o.lie) this.pop();
    this.pop();
    return this;
  };
  B.crate = function (x, y, z, s, o) {
    o = o || {}; s = s || 0.7; var self = this;
    this.push(x, y, z, o.ry || 0);
    this.box(0, 0, 0, s, s, s, { c: o.c || 'woodLight', m: M.wood, bevel: 0.02 });
    [[0, 1], [1, 0]].forEach(function () {});
    [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) { self.box(sx * (s / 2 - 0.04), 0, sz * (s / 2 - 0.04), 0.1, s + 0.01, 0.1, { c: 'wood', m: M.wood, bevel: 0.015 }); }); });
    this.box(0, s * 0.45, s / 2, s * 1.0, 0.09, 0.04, { c: 'wood', m: M.wood, rz: 0.78, bevel: 0.01 });
    this.pop();
    return this;
  };
  B.sack = function (x, y, z, s, o) {
    o = o || {}; s = s || 0.45;
    this.ball(x, y + s * 0.5, z, s * 0.62, { c: o.c || 'canvasDusty', m: M.cloth, sy: 0.85, sx: 0.9, detail: 2, smooth: true, ao: 0.4 });
    this.cone(x, y + s * 0.95, z, s * 0.18, s * 0.3, { c: o.c || 'canvasDusty', m: M.cloth, seg: 6 });
    this.cyl(x, y + s * 0.92, z, s * 0.12, 0.05, { c: 'rope', m: M.rope, seg: 6 });
    return this;
  };
  // a sword standing on its point is rz = PI. Built along +y from the pommel at (x, y, z).
  B.sword = function (x, y, z, o) {
    o = o || {}; var L = o.len || 1.05, self = this, bw = o.bw || 0.055;
    this.push(x, y, z, o.ry || 0);
    var Mx = new T.Matrix4().makeRotationFromEuler(new T.Euler(o.rx || 0, 0, o.rz || 0)); this.stack[this.stack.length - 1].multiply(Mx);
    this.ball(0, 0, 0, 0.045, { c: o.hilt || 'brass', m: M.gold, detail: 1 });
    this.cyl(0, 0.03, 0, 0.022, 0.2, { c: '#3a2a20', m: M.wood, seg: 6 });
    this.box(0, 0.22, 0, 0.32, 0.04, 0.05, { c: o.hilt || 'brass', m: M.gold, bevel: 0.01 });
    this.extrude(0, 0.25, 0, [[-bw, 0], [bw, 0], [bw * 0.85, L * 0.8], [0, L], [-bw * 0.85, L * 0.8]], 0.016, { c: 'steel', m: M.metal, bevel: 0.004 });
    this.pop();
    return this;
  };
  B.spear = function (x, y, z, h, o) {
    o = o || {};
    this.push(x, y, z, o.ry || 0);
    var Mx = new T.Matrix4().makeRotationFromEuler(new T.Euler(o.rx || 0, 0, o.rz || 0)); this.stack[this.stack.length - 1].multiply(Mx);
    this.cyl(0, 0, 0, 0.025, h, { c: 'woodLight', m: M.wood, seg: 6 });
    this.extrude(0, h, 0, [[-0.05, 0], [0.05, 0], [0.06, 0.12], [0, 0.32], [-0.06, 0.12]], 0.02, { c: 'steel', m: M.metal });
    this.pop();
    return this;
  };
  // shields face +z: o.kind 'round' | 'heater' | 'kite'
  B.shield = function (x, y, z, o) {
    o = o || {}; var kind = o.kind || 'heater', s = o.s || 1, field = o.c || 'ink', self = this;
    this.push(x, y, z, o.ry || 0);
    if (o.rx || o.rz) this.stack[this.stack.length - 1].multiply(new T.Matrix4().makeRotationFromEuler(new T.Euler(o.rx || 0, 0, o.rz || 0)));
    if (kind === 'round') {
      var r = 0.42 * s;
      this.cyl(0, 0, 0, r, 0.05, { c: field, m: M.paint, seg: 20, rx: Math.PI / 2 });
      this.cyl(0, 0, 0.0, r + 0.03, 0.04, { c: 'iron', m: M.metal, seg: 20, rx: Math.PI / 2, open: true });
      this.ball(0, 0, 0.05, r * 0.25, { c: 'steel', m: M.metal, sz: 0.6, detail: 1 });
    } else {
      var pts = kind === 'kite' ? [[-0.32, 0.45], [0.32, 0.45], [0.3, 0.05], [0, -0.75], [-0.3, 0.05]] : [[-0.36, 0.42], [0.36, 0.42], [0.35, -0.02], [0.2, -0.38], [0, -0.52], [-0.2, -0.38], [-0.35, -0.02]];
      pts = pts.map(function (p) { return [p[0] * s, p[1] * s]; });
      var rim = pts.map(function (p) { return [p[0] * 1.08, p[1] * 1.08 + 0.01]; });
      this.extrude(0, 0, -0.01, rim, 0.04, { c: 'iron', m: M.metal, bevel: 0.006 });
      this.extrude(0, 0, 0.012, pts, 0.04, { c: field, m: M.paint, bevel: 0.008 });
      if (o.emblem !== 'none') this.emblem(0, -0.02 * s, 0.035, 0.55 * s, o.emblem || 'cross', o.ec || (field === 'bone' ? '#232220' : '#f1eee8'));
    }
    this.pop();
    return this;
  };
  // a bow: o.tier 0 wood, 1 longbow, 2 recurve, 3 steel. Stands in the XY plane, grip at (x, y, z).
  B.bow = function (x, y, z, o) {
    o = o || {}; var tier = o.tier || 0, h = o.h || (tier === 1 ? 1.7 : 1.25), self = this;
    var pts = [];
    for (var i = 0; i <= 12; i++) { var t = i / 12 * 2 - 1, bend = (1 - t * t) * 0.18 * h; if (tier >= 2) bend -= Math.pow(Math.abs(t), 6) * 0.12 * h; pts.push(new T.Vector3(bend, t * h / 2, 0)); }
    var curve = new T.CatmullRomCurve3(pts), g = new T.TubeGeometry(curve, 16, tier === 3 ? 0.02 : 0.024, 5, false);
    this.addGeo(g, { x: x, y: y, z: z, ry: o.ry || 0, c: tier === 3 ? 'steel' : tier === 2 ? '#5a3a24' : tier === 1 ? 'woodLight' : 'wood', m: tier === 3 ? M.metal : M.wood, ao: 0 });
    var top = pts[0], bot = pts[12];
    this.push(x, y, z, o.ry || 0); this.beam([top.x, top.y, 0], [bot.x, bot.y, 0], 0.004, { c: '#e9e2cf', m: M.rope, round: true, seg: 3 }); this.pop();
    return this;
  };
  // an archery butt: a straw boss with painted rings on a timber stand, facing +z
  B.target = function (x, y, z, r, o) {
    o = o || {}; var self = this;
    this.push(x, y, z, o.ry || 0);
    this.beam([-r * 0.7, 0, -0.45], [-r * 0.5, r * 1.6, 0], 0.05, { c: 'wood' });
    this.beam([r * 0.7, 0, -0.45], [r * 0.5, r * 1.6, 0], 0.05, { c: 'wood' });
    this.beam([0, 0, -0.9], [0, r * 1.5, -0.08], 0.05, { c: 'wood' });
    this.cyl(0, r * 1.25, 0, r, 0.32, { c: 'straw', m: M.straw, seg: 18, rx: Math.PI / 2 - 0.12, flat: true });
    var rings = ['#f1e9d6', '#2b2b2b', '#3f6aa5', '#c33b2a', '#e8b842'];
    var g = new T.CircleGeometry(r * 0.96, 28, 0, Math.PI * 2);
    this.addGeo(g, { x: 0, y: r * 1.25 + 0.0, z: 0.17, rx: -0.12, c: '#ffffff', m: M.paint, ao: 0, jit: 0, vary: 0.04, colors: function (wx, wy, wz, lx, ly) { var d = Math.hypot(lx, ly) / (r * 0.96); return rings[Math.min(4, Math.floor((1 - d) * 5))]; } });
    this.pop();
    return this;
  };
  B.dummy = function (x, y, z, o) {
    o = o || {}; var self = this;
    this.push(x, y, z, o.ry || 0);
    this.post(0, 0, 0, 0.06, 1.9, { c: 'wood' });
    this.beam([-0.55, 1.35, 0], [0.55, 1.4, 0], 0.045, { c: 'wood', round: true });
    // straw-stuffed arms bound on the crossbar, and a cross of planks at the foot
    [-1, 1].forEach(function (sd) { self.beam([sd * 0.22, 1.37, 0], [sd * 0.62, 1.4, 0.02], 0.085, { c: 'straw', m: M.straw, round: true, seg: 7, r2: 0.06 }); self.cyl(sd * 0.45, 1.3, 0, 0.09, 0.03, { c: 'rope', m: M.rope, seg: 8, rz: Math.PI / 2 }); });
    this.box(0, 0, 0, 0.9, 0.08, 0.14, { c: 'woodDark', m: M.wood, bevel: 0.02 }); this.box(0, 0, 0, 0.14, 0.08, 0.9, { c: 'woodDark', m: M.wood, bevel: 0.02 });
    this.lathe(0, 0.7, 0, [[0.05, 0], [0.26, 0.1], [0.3, 0.45], [0.24, 0.8], [0.05, 0.86]], { c: 'straw', m: M.straw, seg: 9, flat: true });
    [0.78, 0.98, 1.2].forEach(function (yy) { self.cyl(0, yy, 0, 0.3, 0.04, { c: 'rope', m: M.rope, seg: 9, open: true }); });
    this.ball(0, 1.72, 0, 0.19, { c: 'canvasDusty', m: M.cloth, detail: 1 });
    if (o.helm) this.lathe(0, 1.74, 0, [[0.21, 0], [0.22, 0.12], [0.16, 0.24], [0.01, 0.27]], { c: 'iron', m: M.metal, seg: 10 });
    if (o.shield) this.shield(0.12, 1.15, 0.28, { kind: 'round', s: 0.7, c: o.shield, emblem: 'none' });
    this.pop();
    return this;
  };
  B.anvil = function (x, y, z, o) {
    o = o || {};
    this.push(x, y, z, o.ry || 0);
    this.log(0, 0, 0, 0.3, 0.55, { c: 'wood', seg: 9 });
    this.extrude(0, 0.55, 0, [[-0.18, 0], [0.18, 0], [0.12, 0.12], [0.3, 0.2], [0.42, 0.32], [-0.28, 0.32], [-0.28, 0.22], [-0.12, 0.12]], 0.2, { c: 'iron', m: M.metal, bevel: 0.01 });
    this.pop();
    return this;
  };
  B.wheel = function (x, y, z, r, o) {
    o = o || {}; var self = this;
    this.push(x, y, z, o.ry || 0);
    var tor = new T.TorusGeometry(r, 0.05, 5, 18);
    this.addGeo(tor, { c: o.c || 'wood', m: M.wood, ao: 0 });
    this.cyl(0, -0.08, 0, 0.09, 0.16, { c: 'woodDark', rx: Math.PI / 2, seg: 8 });
    for (var i = 0; i < 8; i++) { var a = i / 8 * 6.28; this.beam([0, 0, 0], [Math.cos(a) * r, Math.sin(a) * r, 0], 0.025, { c: o.c || 'wood' }); }
    this.pop();
    return this;
  };
  B.cart = function (x, z, o) {
    o = o || {}; var self = this;
    this.push(x, 0, z, o.ry || 0);
    this.box(0, 0.65, 0, 1.4, 0.12, 2.2, { c: 'woodLight', m: M.wood });
    [-1, 1].forEach(function (s) { self.box(s * 0.68, 0.77, 0, 0.06, 0.4, 2.2, { c: 'wood', m: M.wood }); });
    self.box(0, 0.77, -1.08, 1.4, 0.4, 0.06, { c: 'wood', m: M.wood });
    [-1, 1].forEach(function (s) { self.wheel(s * 0.8, 0.55, 0.2, 0.55, { ry: Math.PI / 2 }); self.beam([s * 0.35, 0.7, 1.1], [s * 0.3, 0.45, 2.6], 0.04, { c: 'wood' }); });
    if (o.load) o.load.call(this, this);
    this.pop();
    return this;
  };
  B.hay = function (x, y, z, o) { o = o || {}; return this.box(x, y, z, o.w || 1.1, o.h || 0.55, o.d || 0.7, { c: 'straw', m: M.straw, bevel: 0.1, ry: o.ry || 0 }); };
  B.haystack = function (x, z, r, h) { return this.lathe(x, 0, z, [[0.01, 0], [r, 0.05], [r * 1.05, h * 0.4], [r * 0.7, h * 0.8], [0.01, h]], { c: 'straw', m: M.straw, seg: 12, flat: true }); };
  B.woodpile = function (x, z, o) {
    o = o || {}; var self = this, n = o.n || 4, L = o.len || 1.4;
    this.push(x, 0, z, o.ry || 0);
    for (var row = 0; row < n; row++) for (var i = 0; i < n - row; i++) self.log(-L / 2, 0.13 + row * 0.22, (i - (n - row - 1) / 2) * 0.25, 0.12, L, { c: self.pick(PAL.wood), rz: -Math.PI / 2 });
    this.pop();
    return this;
  };
  B.bench = function (x, z, L, o) { o = o || {}; this.push(x, 0, z, o.ry || 0); this.box(0, 0.42, 0, L, 0.07, 0.38, { c: 'woodLight', m: M.wood }); this.box(-L / 2 + 0.15, 0, 0, 0.08, 0.42, 0.32, { c: 'wood', m: M.wood }); this.box(L / 2 - 0.15, 0, 0, 0.08, 0.42, 0.32, { c: 'wood', m: M.wood }); this.pop(); return this; };
  B.table = function (x, z, w, d, o) { o = o || {}; var self = this; this.push(x, 0, z, o.ry || 0); this.box(0, 0.74, 0, w, 0.07, d, { c: 'woodLight', m: M.wood }); [-1, 1].forEach(function (a) { [-1, 1].forEach(function (b2) { self.post(a * (w / 2 - 0.1), 0, b2 * (d / 2 - 0.1), 0.04, 0.74, { c: 'wood' }); }); }); this.pop(); return this; };
  B.bucket = function (x, y, z) { this.lathe(x, y, z, [[0.01, 0], [0.16, 0], [0.2, 0.3], [0.01, 0.29]], { c: 'wood', m: M.wood, seg: 10, flat: true }); this.cyl(x, y + 0.25, z, 0.2, 0.03, { c: 'iron', m: M.metal, open: true, seg: 10 }); return this; };
  B.ropeCoil = function (x, y, z, r) { var g = new T.TorusGeometry(r || 0.25, 0.05, 5, 14); return this.addGeo(g, { x: x, y: y + 0.05, z: z, rx: Math.PI / 2, c: 'rope', m: M.rope }); };
  B.quiver = function (x, y, z, o) {
    o = o || {}; var self = this;
    this.push(x, y, z, o.ry || 0);
    this.cyl(0, 0, 0, 0.09, 0.62, { c: '#6b4a33', m: M.wood, seg: 8, rz: 0.15 });
    for (var i = 0; i < 6; i++) { var a = i / 6 * 6.28; self.beam([Math.cos(a) * 0.04 + 0.08, 0.5, Math.sin(a) * 0.04], [Math.cos(a) * 0.05 + 0.12, 0.85, Math.sin(a) * 0.05], 0.01, { c: 'woodLight' }); self.box(Math.cos(a) * 0.05 + 0.12, 0.8, Math.sin(a) * 0.05, 0.02, 0.1, 0.05, { c: '#efe6d4', m: M.cloth, bevel: 0 }); }
    this.pop();
    return this;
  };
  // a rack of weapons against a wall facing +z: o.kind 'swords' | 'spears' | 'bows' | 'shields'
  B.rack = function (x, y, z, w, o) {
    o = o || {}; var self = this, kind = o.kind || 'swords', n = Math.max(2, Math.round(w / (kind === 'shields' ? 0.8 : 0.3)));
    this.push(x, y, z, o.ry || 0);
    this.post(-w / 2, 0, 0, 0.05, 1.5, { c: 'wood' }); this.post(w / 2, 0, 0, 0.05, 1.5, { c: 'wood' });
    this.box(0, 1.2, 0, w + 0.1, 0.08, 0.12, { c: 'woodLight', m: M.wood }); this.box(0, 0.25, 0, w + 0.1, 0.08, 0.2, { c: 'woodLight', m: M.wood });
    for (var i = 0; i < n; i++) {
      var px = -w / 2 + (i + 0.5) * w / n;
      if (kind === 'swords') self.sword(px, 1.32, 0.04, { rz: Math.PI, len: 0.95 });
      else if (kind === 'spears') self.spear(px, 0.3, 0.06, 1.9, { rx: -0.08 });
      else if (kind === 'bows') self.bow(px, 0.95, 0.06, { tier: o.tier || 1, h: 1.3, ry: Math.PI / 2 });
      else self.shield(px, 0.85, 0.08, { kind: self.pick(['heater', 'round', 'kite']), c: self.pick(['ink', 'bone', 'ink', 'inkGrey']), s: 0.8, rx: -0.12 });
    }
    this.pop();
    return this;
  };

  // ---------------------------------------------------------------- people (first pass; people.js replaces this)
  // A stylised figure about 1.75 m tall standing at (x, z), facing +z (rotate with o.ry).
  // o.role: 'villager' | 'soldier' | 'archer' | 'smith' | 'knight' | 'child'; o.pose: 'stand' | 'walk' | 'work' | 'draw'
  B.figure = function (x, z, o) {
    if (KIT.people && KIT.people.figure) return KIT.people.figure(this, x, z, o || {});
    o = o || {}; var self = this, s = o.role === 'child' ? 0.62 : (o.s || 1), y = o.y || 0;
    var skin = o.skin || this.pick(PAL.skin), hair = o.hair || this.pick(PAL.hair), tunic = o.c || this.pick(['#7c4a3a', '#4f6a7d', '#6e7a4a', '#8a6a3e', '#a0523c', '#5b4f6e']);
    var armor = o.role === 'soldier' || o.role === 'knight' || o.role === 'archer';
    this.life(function () {
      self.push(x, y, z, o.ry || 0); self.stack[self.stack.length - 1].multiply(new T.Matrix4().makeScale(s, s, s));
      var walk = o.pose === 'walk' ? 0.35 : 0;
      [-1, 1].forEach(function (sd) {
        self.beam([sd * 0.1, 0.85, 0], [sd * 0.11, 0.08, sd * walk * 0.5], 0.06, { c: '#4a3c30', m: M.cloth, round: true, seg: 6, r2: 0.05 });
        self.box(sd * 0.11, 0, sd * walk * 0.5 + 0.04, 0.12, 0.12, 0.24, { c: '#2e241d', m: M.wood, bevel: 0.03 });
      });
      self.lathe(0, 0.62, 0, [[0.2, 0], [0.24, 0.12], [0.2, 0.45], [0.23, 0.72], [0.12, 0.84], [0.01, 0.86]], { c: armor ? (o.role === 'knight' ? 'steel' : '#6b6f72') : tunic, m: armor ? M.metal : M.cloth, seg: 10 });
      if (armor) self.lathe(0, 0.6, 0, [[0.26, 0], [0.27, 0.32], [0.2, 0.4]], { c: o.c || 'crimson', m: M.cloth, seg: 10 });
      self.cyl(0, 0.98, 0, 0.215, 0.06, { c: '#3a2a20', m: M.wood, seg: 10 });
      var sh = 1.38;
      [-1, 1].forEach(function (sd) {
        var hand = o.pose === 'draw' ? (sd < 0 ? [-0.05, 1.42, 0.6] : [0.05, 1.42, -0.05]) : o.pose === 'work' ? [sd * 0.18, 1.25, 0.42] : [sd * 0.3, 0.86, -sd * walk * 0.3];
        self.beam([sd * 0.24, sh, 0], hand, 0.055, { c: armor ? '#6b6f72' : tunic, m: armor ? M.metal : M.cloth, round: true, seg: 6, r2: 0.045 });
        self.ball(hand[0], hand[1] - 0.02, hand[2], 0.055, { c: skin, m: M.skin, detail: 1 });
      });
      self.cyl(0, 1.43, 0, 0.06, 0.1, { c: skin, m: M.skin, seg: 6 });
      self.ball(0, 1.64, 0.01, 0.15, { c: skin, m: M.skin, detail: 2, smooth: true, sy: 1.08 });
      if (armor) self.lathe(0, 1.66, 0, [[0.17, 0], [0.175, 0.1], [0.13, 0.2], [0.01, 0.23]], { c: 'steel', m: M.metal, seg: 12 });
      else self.ball(0, 1.71, -0.02, 0.155, { c: hair, m: M.hair, detail: 1, sy: 0.75 });
      if (o.role === 'archer') { self.bow(-0.05, 1.3, 0.55, { tier: o.tier || 0, ry: Math.PI / 2, h: 1.15 }); self.quiver(0.12, 1.0, -0.15, { ry: 0.3 }); }
      if (o.role === 'soldier') self.spear(0.32, 0.0, 0.06, 2.2, {});
      if (o.role === 'knight') self.shield(-0.32, 1.0, 0.1, { kind: 'heater', s: 0.8, ry: -0.3 });
      self.pop();
    });
    return this;
  };

  // ---------------------------------------------------------------- the ground a build stands on
  // An island of ground: a grassy top whose middle is levelled for the build, a lip of turf, and a skirt of earth and
  // rock below. o: { r, flat: [w, d] or radius, ground: 'grass'|'dirt'|'cobble'|'sand'|'paving', path: [[x,z],...],
  //   depth, trees: [{x, z, kind, h}], bushes, tufts, seed }
  KIT.island = function (b, o) {
    o = o || {};
    var R = o.r || 12, depth = o.depth || R * 0.55, NS = 128, NR = 26, sd = (o.seed || 1) * 7.3;
    var fw = Array.isArray(o.flat) ? o.flat[0] / 2 : (o.flat || R * 0.5), fd = Array.isArray(o.flat) ? o.flat[1] / 2 : fw;
    var path = o.path || [[0, R], [0, fd]];
    function edgeR(a) { return R * (1 + 0.07 * noise3(Math.cos(a) * 1.6 + sd, Math.sin(a) * 1.6, 0.5) + 0.035 * noise3(Math.cos(a) * 4 + sd, Math.sin(a) * 4, 2.5)); }
    function inFlat(x, z, m) { var dx = Math.max(0, Math.abs(x) - fw - m), dz = Math.max(0, Math.abs(z) - fd - m); return Math.hypot(dx, dz); }
    function pathD(x, z) { var best = 1e9; for (var i = 0; i < path.length - 1; i++) { var a = path[i], c = path[i + 1], vx = c[0] - a[0], vz = c[1] - a[1], L2 = vx * vx + vz * vz, t = clamp(((x - a[0]) * vx + (z - a[1]) * vz) / (L2 || 1), 0, 1); best = Math.min(best, Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t)); } return best; }
    function height(x, z, rr) {
      var d = inFlat(x, z, 0.6), lift = U.smooth(0, 4, d);
      var hgt = (fbm3(x * 0.11 + sd, 0, z * 0.11, 3) * 0.55 + 0.22) * lift;
      var pd = pathD(x, z); hgt -= (1 - U.smooth(0.4, 1.4, pd)) * 0.06;
      // the lip of turf rolls down at the edge
      var lip = U.smooth(R * 0.84, R * 1.0, rr); hgt -= lip * lip * 0.55;
      return hgt;
    }
    function groundCol(x, y, z) {
      var n = fbm3(x * 0.18 + sd, 3, z * 0.18, 3), n2 = noise3(x * 0.9, 1, z * 0.9);
      var c = new T.Color('#5d6b4c').lerp(new T.Color('#76805e'), clamp(n * 1.2 + 0.35, 0, 1) * 0.4).lerp(new T.Color('#4a5842'), clamp(-n * 1.5, 0, 1) * 0.6);
      c.offsetHSL(0, 0, n2 * 0.03);
      var pd = pathD(x, z);
      var dirt = new T.Color(PAL.dirt[0]).offsetHSL(0, 0, n2 * 0.04);
      c.lerp(dirt, 1 - U.smooth(0.55, 1.35 + n * 0.4, pd));
      var fdist = inFlat(x, z, 0);
      var g = o.ground || 'grass';
      if (g !== 'grass') {
        var gc = g === 'dirt' ? new T.Color('#b0916a') : g === 'sand' ? new T.Color('#d8bf8c') : g === 'paving' ? new T.Color('#c2b59c') : new T.Color('#6f6658');
        gc.offsetHSL(0, 0, n2 * 0.05);
        c.lerp(gc, 1 - U.smooth(0.0, 1.2 + n * 0.8, fdist));
      }
      return c;
    }
    // top: polar rings, levelled in the middle
    var pos = [], idx = [], i, j;
    pos.push(0, height(0, 0, 0), 0);
    for (j = 1; j <= NR; j++) for (i = 0; i < NS; i++) {
      var a = i / NS * Math.PI * 2, f = Math.pow(j / NR, 0.85), er = edgeR(a), rr = er * f, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      pos.push(x, height(x, z, rr / er * R), z);
    }
    for (i = 0; i < NS; i++) idx.push(0, 1 + (i + 1) % NS, 1 + i);
    for (j = 1; j < NR; j++) for (i = 0; i < NS; i++) {
      var a0 = 1 + (j - 1) * NS + i, a1 = 1 + (j - 1) * NS + (i + 1) % NS, b0 = 1 + j * NS + i, b1 = 1 + j * NS + (i + 1) % NS;
      idx.push(a0, a1, b1, a0, b1, b0);
    }
    var top = new T.BufferGeometry(); top.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); top.setIndex(idx); top.computeVertexNormals();
    b.base(function () { b.addGeo(top, { c: '#ffffff', m: M.grass, ao: 0, jit: 0, vary: 0.05, colors: groundCol }); });
    // the skirt: from the turf's edge down into a point of rock, banded earth then stone
    var K = 9, sp = [], si = [], rim = [];
    for (i = 0; i < NS; i++) { var a2 = i / NS * Math.PI * 2, er2 = edgeR(a2); rim.push([Math.cos(a2) * er2, height(Math.cos(a2) * er2, Math.sin(a2) * er2, R), Math.sin(a2) * er2]); }
    for (var k = 0; k <= K; k++) for (i = 0; i < NS; i++) {
      var t = k / K, a3 = i / NS * Math.PI * 2, shrink = lerp(1.0, 0.18, Math.pow(t, 1.25)) * (1 + noise3(Math.cos(a3) * 3 + sd, t * 4, Math.sin(a3) * 3) * 0.12 * (t > 0.05 ? 1 : 0));
      var rp = rim[i], yy = k === 0 ? rp[1] - 0.05 : rp[1] - 0.25 - t * depth * (1 + noise3(Math.cos(a3) * 2 + 9, Math.sin(a3) * 2, sd) * 0.25) - Math.pow(t, 3) * depth * 0.2;
      sp.push(rp[0] * shrink, yy, rp[2] * shrink);
    }
    sp.push(0, -depth * 1.35, 0);
    var tip = (K + 1) * NS;
    for (k = 0; k < K; k++) for (i = 0; i < NS; i++) { var c0 = k * NS + i, c1 = k * NS + (i + 1) % NS, d0 = (k + 1) * NS + i, d1 = (k + 1) * NS + (i + 1) % NS; si.push(c0, d1, c1, c0, d0, d1); }
    for (i = 0; i < NS; i++) si.push(K * NS + i, tip, K * NS + (i + 1) % NS);
    var skirt = new T.BufferGeometry(); skirt.setAttribute('position', new T.Float32BufferAttribute(sp, 3)); skirt.setIndex(si);
    skirt = G.flat(skirt);
    var strata = ['#5d5348', '#6f6556', '#857a69', '#9a8f7d', '#827a70', '#958d82', '#77716a', '#8b857c', '#67625c'];
    b.base(function () {
      b.addGeo(skirt, { c: '#ffffff', m: M.soil, ao: 0, jit: 0, vary: 0.08, colors: function (x, y, z) {
        var t = clamp(-y / depth, 0, 1.3), n = noise3(x * 0.5 + sd, y * 1.4, z * 0.5);
        if (y > -0.45) return '#6d7b57';
        var band = Math.floor(clamp(t * 7 + n * 0.9, 0, strata.length - 1));
        return new T.Color(strata[band]).offsetHSL(0, 0, n * 0.03);
      } });
    });
    // dressing: tufts and flowers round the edge, rocks on the lip, trees and bushes
    var r = b.r, self = b;
    b.base(function () {
      var tufts = o.tufts === undefined ? Math.round(R * R * 1.5) : o.tufts;
      for (var t = 0; t < tufts; t++) {
        var a4 = r() * Math.PI * 2, rr4 = edgeR(a4) * Math.sqrt(0.08 + r() * 0.9), x4 = Math.cos(a4) * rr4, z4 = Math.sin(a4) * rr4;
        if (inFlat(x4, z4, 0.25) < 0.01 || pathD(x4, z4) < 0.9) continue;
        var hh = height(x4, z4, rr4 / edgeR(a4) * R);
        self.grass(x4, hh, z4, 0.35 + r() * 0.35);
        if (r() < 0.22) self.flowers(x4, hh, z4, 0.35, { n: 4 + Math.round(r() * 5) });
      }
      for (var q = 0; q < Math.round(R * 0.9); q++) { var a5 = r() * Math.PI * 2, er5 = edgeR(a5) * (0.9 + r() * 0.08), x5 = Math.cos(a5) * er5, z5 = Math.sin(a5) * er5; if (pathD(x5, z5) < 1.2) continue; self.rock(x5, height(x5, z5, R * 0.95) - 0.1, z5, 0.25 + r() * 0.45); }
      (o.trees || []).forEach(function (tr) { var rr6 = Math.hypot(tr.x, tr.z); self.tree(tr.x, tr.z, { kind: tr.kind, h: tr.h, y: height(tr.x, tr.z, rr6) - 0.05 }); });
      (o.bushes || []).forEach(function (bu) { var rr7 = Math.hypot(bu.x, bu.z); self.bush(bu.x, bu.z, bu.r || 0.8, { y: height(bu.x, bu.z, rr7) - 0.1, flowers: bu.flowers }); });
      for (var s2 = 0; s2 < (o.stones || 0); s2++) { var a6 = r() * 6.28, d6 = r() * R * 0.8, x6 = Math.cos(a6) * d6, z6 = Math.sin(a6) * d6; if (inFlat(x6, z6, 0.3) < 0.01) continue; self.rock(x6, height(x6, z6, d6), z6, 0.12 + r() * 0.15); }
    });
    // cobbles laid in the levelled middle
    if (o.ground === 'cobble' || o.ground === 'paving') b.base(function () {
      var step = o.ground === 'paving' ? 0.9 : 0.5;
      for (var gx = -fw - 0.8; gx <= fw + 0.8; gx += step) for (var gz = -fd - 0.8; gz <= fd + 0.8; gz += step * 0.8) {
        var jx = gx + self.j(step * 0.15) + ((Math.round(gz / (step * 0.8)) % 2) * step * 0.5), jz = gz + self.j(step * 0.1);
        var dd = inFlat(jx, jz, 0); if (dd > 0.6 * (0.6 + self.r())) continue;
        if (o.cobbleSkip && o.cobbleSkip(jx, jz)) continue;
        self.box(jx, -0.06, jz, step * (0.8 + self.j(0.08)), 0.12, step * 0.68, { ry: self.j(0.12), c: self.stoneC(o.ground === 'paving' ? 'stone' : 'stoneCool').offsetHSL(0, -0.02, -0.05), m: M.stone, bevel: 0.04, ao: 0.1, jit: 0.05 });
      }
    });
    return { height: function (x, z) { return height(x, z, Math.hypot(x, z)); }, R: R };
  };
})();
