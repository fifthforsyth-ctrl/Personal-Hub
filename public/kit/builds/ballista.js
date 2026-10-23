// Ballista tower: a square stone tower with dressed corner stones, string courses and arrow slits, a corbelled
// fighting deck behind battlements hung with round shields, a little slate-roofed stair house with a carved dragon
// head, and on the deck the great crossbow on its turntable with a rack of bolts. A timber jib hoists bundles of bolts
// up from the yard, a slate lean-to stores the shafts, and the smith forges the heads below.
// Built footings first, the tower course by course, the corbels and deck, the battlements, the stair house and its
// roof row by row, the lean-to, then the ballista piece by piece, the stores, the hoist, the colours and the people.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL;
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  function rotX(b, a) { b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(a)); }
  function rotZ(b, a) { b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(a)); }
  PAL.ballista_deck = ['#8a735c', '#7d6852', '#937c64', '#76624e', '#85705a'];
  PAL.ballista_bow = ['#2f2a25', '#38312a', '#2a2622'];
  var DARK = '#1c1b1a';

  // the crew: turning the windlass spokes, hauling the hoist rope, a bolt on the shoulder
  KIT.people.poses.ballista_crank = function () { return { feet: [V(-0.17, 0.09, 0.16), V(0.16, 0.09, -0.2)], hands: [V(-0.1, 1.52, 0.42), V(0.12, 1.2, 0.46)], lean: 0.14, twist: 0.05, side: 0, hip: 0, drop: 0.08, head: [0.1, 0.25], pole: [V(-0.8, -0.6, -0.3), V(0.8, -0.6, -0.3)] }; };
  KIT.people.poses.ballista_haul = function () { return { feet: [V(-0.15, 0.09, 0.2), V(0.15, 0.09, -0.32)], hands: [V(-0.03, 1.7, 0.3), V(0.04, 1.36, 0.33)], lean: -0.14, twist: 0, side: 0, hip: 0, drop: 0.08, head: [0, -0.35], pole: [V(-0.9, -0.5, -0.2), V(0.9, -0.5, -0.2)] }; };
  KIT.people.poses.ballista_shoulder = function () { return { feet: [V(-0.1, 0.12, 0.26), V(0.11, 0.1, -0.24)], hands: [V(-0.21, 1.5, 0.16), V(0.25, 0.92, 0.18)], lean: 0.08, twist: 0.06, side: 0.04, hip: 0, drop: 0.03, head: [0.1, 0.05], pole: [V(-0.6, -0.8, -0.2), V(0.6, -0.4, -0.5)] }; };

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
  function vShield(b, x, y, z, ry, r, kind, fc, pc) {
    b.push(x, y, z, ry);
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
  // a rope from a to c, sagging
  function swag(b, a, c, sag, r) {
    var n = 5, prev = a;
    for (var i = 1; i <= n; i++) { var t = i / n, p = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (c[2] - a[2]) * t]; b.beam(prev, p, r || 0.02, { c: 'rope', m: M.rope, round: true, seg: 5 }); prev = p; }
  }
  // a ballista bolt: tail at (x, y, z), heading ry, pitched up by p, the shaft L long to the iron socket, a bodkin head
  // and three vanes
  function bolt(b, x, y, z, ry, p, L, o) {
    o = o || {};
    b.push(x, y, z, ry); rotX(b, -p);
    b.beam([0, 0, 0], [0, 0, L], 0.034, { c: o.shaft || 'woodLight', m: M.wood, round: true, seg: 6 });
    b.cyl(0, 0, L - 0.04, 0.046, 0.16, { rx: Math.PI / 2, c: 'iron', m: M.metal, seg: 6 });
    b.cyl(0, 0, L + 0.12, 0.075, 0.3, { rx: Math.PI / 2, r2: 0.002, c: 'steel', m: M.metal, seg: 4, flat: true });
    var fins = o.fins || ['bone', 'bone', 'inkGrey'];
    for (var i = 0; i < 3; i++) b.box(0, 0, 0.25, 0.014, 0.115, 0.36, { rz: i * 2.094 + (o.roll || 0.3), c: fins[i], m: M.cloth, bevel: 0.003, ao: 0 });
    b.pop();
  }
  // the crossbow glyph for the banner, drawn just proud of both faces of the cloth
  function xbowEmblem(b, x, y, z, s, ec, ry) {
    var sh = [], i, n = 12;
    sh.push([[-0.045, -0.44], [0.045, -0.44], [0.045, 0.16], [-0.045, 0.16]]);
    sh.push([[-0.018, 0.16], [0.018, 0.16], [0.018, 0.34], [-0.018, 0.34]]);
    sh.push([[-0.075, 0.33], [0.075, 0.33], [0, 0.49]]);
    var bow = [];
    for (i = 0; i <= n; i++) { var a = 0.45 + (Math.PI - 0.9) * i / n; bow.push([Math.cos(a) * 0.46, -0.2 + Math.sin(a) * 0.46]); }
    for (i = n; i >= 0; i--) { var a2 = 0.45 + (Math.PI - 0.9) * i / n; bow.push([Math.cos(a2) * 0.39, -0.2 + Math.sin(a2) * 0.39]); }
    sh.push(bow);
    function bar(p, q, w) { var dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy), nx = -dy / L * w, ny = dx / L * w; return [[p[0] + nx, p[1] + ny], [q[0] + nx, q[1] + ny], [q[0] - nx, q[1] - ny], [p[0] - nx, p[1] - ny]]; }
    var tip = [Math.cos(0.45) * 0.425, -0.2 + Math.sin(0.45) * 0.425];
    sh.push(bar(tip, [0, -0.24], 0.013)); sh.push(bar([-tip[0], tip[1]], [0, -0.24], 0.013));
    b.push(x, y, z, ry || 0);
    sh.forEach(function (pts) { var P = pts.map(function (p) { return [p[0] * s, p[1] * s]; }); [0.013, -0.013].forEach(function (dz) { b.extrude(0, 0, dz, P, 0.006, { c: ec, m: M.cloth, bucket: 'cloth', ao: 0, jit: 0.01, vary: 0.02 }); }); });
    b.pop();
  }

  // ---------------------------------------------------------------- masonry
  function subtract(segs, cuts) {
    cuts.forEach(function (c) { var nk = []; segs.forEach(function (k) { if (k[1] <= c[0] || k[0] >= c[1]) { nk.push(k); return; } if (k[0] < c[0]) nk.push([k[0], c[0]]); if (k[1] > c[1]) nk.push([c[1], k[1]]); }); segs = nk; });
    return segs;
  }
  // one course of stones along a run from (ax, az) along (ux, uz) for L: no stone over cuts or ends; mortar behind all
  // but the cuts (openings)
  function course(b, r, y, ch, th, o) {
    var cuts = o.cuts || [], all = cuts.concat(o.ends || []);
    var hole = all.length ? function (tm, yy, s0, s1) { var keep = subtract([[s0, s1]], all); if (keep.length === 1 && keep[0][0] === s0 && keep[0][1] === s1) return false; return keep.length ? keep : true; } : null;
    b.stoneWall(r.ax, r.az, r.ax + r.ux * r.L, r.az + r.uz * r.L, y, ch, th, { pal: o.pal, len: o.len, course: ch, hole: hole, core: false });
    if (o.core !== false) subtract([[0, r.L]], cuts).forEach(function (s) { if (s[1] - s[0] < 0.06) return; var tm = (s[0] + s[1]) / 2; b.box(r.ax + r.ux * tm, y, r.az + r.uz * tm, s[1] - s[0] - 0.02, ch, th * 0.8, { ry: -Math.atan2(r.uz, r.ux), c: '#8a7e6c', m: M.stone, bevel: 0, ao: 0.1, jit: 0.01 }); });
  }
  // the stones an opening takes out of the course whose middle is at yy (arched tops follow the arch)
  function openCut(op, yy) {
    if (yy < op.y0 || yy > op.top) return null;
    var half = op.half;
    if (op.spring !== undefined && yy > op.spring) { var dy = yy - op.spring; if (dy >= op.R) return null; half = Math.min(half, Math.sqrt(op.R * op.R - dy * dy)); if (half < 0.07) return null; }
    return [op.t - half, op.t + half];
  }
  // A box of walls laid course by course (each course one step): front and back run full width, the sides between.
  // Corner stones (quoins) alternate long and short. o: { k0, k1, ch, th, len, palAt(k), growAt(k), quoins, open }
  function sidesOf(cx, cz, w, d, th) {
    var x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    return {
      front: { a: [x0, z1 - th / 2], u: [1, 0], n: [0, 1], L: w, inset: false },
      right: { a: [x1 - th / 2, z1 - th], u: [0, -1], n: [1, 0], L: d - 2 * th, inset: true },
      back: { a: [x1, z0 + th / 2], u: [-1, 0], n: [0, -1], L: w, inset: false },
      left: { a: [x0 + th / 2, z0 + th], u: [0, 1], n: [-1, 0], L: d - 2 * th, inset: true }
    };
  }
  function masonBox(b, cx, cz, w, d, y0, o) {
    var th = o.th, x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, S = sidesOf(cx, cz, w, d, th);
    for (var k = o.k0 || 0; k < o.k1; k++) {
      (function (k) {
        var y = y0 + k * o.ch, yy = y + o.ch / 2, grow = o.growAt ? o.growAt(k) : 0, pal = o.palAt ? o.palAt(k) : 'stone';
        var q = o.quoins, qF = q ? (k % 2 ? q[1] : q[0]) : 0, qS = q ? (k % 2 ? q[0] : q[1]) : 0;
        b.unit(function () {
          Object.keys(S).forEach(function (key) {
            var sd = S[key], cuts = [];
            (o.open || []).forEach(function (op) { if (op.side !== key) return; var c = openCut(op, yy); if (c) cuts.push(c); });
            var ec = q ? (sd.inset ? qS - th : qF) : 0, ends = ec > 0.03 ? [[-1, ec], [sd.L - ec, sd.L + 1]] : [];
            course(b, { ax: sd.a[0] + sd.n[0] * grow / 2, az: sd.a[1] + sd.n[1] * grow / 2, ux: sd.u[0], uz: sd.u[1], L: sd.L }, y, o.ch, th + grow, { pal: pal, len: o.len, cuts: cuts, ends: ends });
          });
          if (q) [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(function (c) {
            var px = c[0] > 0 ? x1 : x0, pz = c[1] > 0 ? z1 : z0, p = grow + 0.035;
            var xa = px - c[0] * qF, xb = px + c[0] * p, za = pz - c[1] * qS, zb = pz + c[1] * p;
            b.box((xa + xb) / 2, y + o.ch * 0.04, (za + zb) / 2, Math.abs(xb - xa), o.ch * 0.92, Math.abs(zb - za), { c: b.stoneC(o.qpal || 'sandstone', y), m: M.stone, bevel: 0.06, ao: 0.18, jit: 0.04 });
          });
        });
      })(k);
    }
    return S;
  }
  function onFace(sd, t, th, out) { return [sd.a[0] + sd.u[0] * t + sd.n[0] * (th / 2 + (out || 0)), sd.a[1] + sd.u[1] * t + sd.n[1] * (th / 2 + (out || 0))]; }
  function faceRy(sd) { return -Math.atan2(sd.u[1], sd.u[0]); }
  // the courses an opening spans, and the cross arm a tall slit gets on its middle course (a crossbow loop)
  var SLIT_ARM = 0.26;
  function slitCourses(op, y0, ch) { var ks = []; for (var k = 0; k < 40; k++) { var yy = y0 + k * ch + ch / 2; if (yy >= op.y0 && yy <= op.top) ks.push(k); } return ks; }
  function slitArms(open, y0, ch) {
    open.slice().forEach(function (op) {
      if (op.kind !== 'slit') return; var ks = slitCourses(op, y0, ch); if (ks.length < 3) return;
      var ym = y0 + ks[(ks.length - 1) >> 1] * ch + ch / 2;
      open.push({ side: op.side, t: op.t, half: SLIT_ARM, y0: ym - 0.05, top: ym + 0.05, kind: 'arm' });
    });
    return open;
  }
  // an arrow slit: the dark slot in the gap the courses left, a cross arm on tall ones, dressed jambs long and short,
  // a sill and a lintel
  function slit(b, sd, op, y0, ch, th) {
    var ks = slitCourses(op, y0, ch), mid = ks.length >= 3 ? ks[(ks.length - 1) >> 1] : -1;
    var ylo = y0 + ks[0] * ch, yhi = y0 + (ks[ks.length - 1] + 1) * ch, ry = faceRy(sd);
    var c = onFace(sd, op.t, th, -th / 2), f = onFace(sd, op.t, th, 0);
    b.box(c[0], ylo, c[1], op.half * 2 + 0.02, yhi - ylo, th * 0.96, { ry: ry, c: DARK, m: M.dark, bevel: 0, ao: 0, jit: 0 });
    if (mid >= 0) b.box(c[0], y0 + mid * ch, c[1], SLIT_ARM * 2 + 0.02, ch, th * 0.96, { ry: ry, c: DARK, m: M.dark, bevel: 0, ao: 0, jit: 0 });
    ks.forEach(function (k, i) {
      var hw = k === mid ? SLIT_ARM : op.half, w = i % 2 ? 0.2 : 0.24;
      [-1, 1].forEach(function (s) { var p = onFace(sd, op.t + s * (hw + w / 2), th, 0.0); b.box(p[0], y0 + k * ch + ch * 0.04, p[1], w, ch * 0.92, 0.16, { ry: ry, c: b.stoneC('sandstone', y0 + k * ch), m: M.stone, bevel: 0.035, ao: 0.18, jit: 0.02 }); });
    });
    b.box(f[0], ylo - 0.07, f[1], op.half * 2 + 0.7, 0.14, 0.18, { ry: ry, c: 'sandstone', m: M.stone, bevel: 0.03 });
    b.box(f[0], yhi - 0.08, f[1], op.half * 2 + 0.78, 0.17, 0.18, { ry: ry, c: 'sandstone', m: M.stone, bevel: 0.03 });
  }
  // an arched window in a dressed frame, a mullioned pane, ink shutters and a box of white flowers on the string course
  function archWindow(b, sd, op, w, h, th, o) {
    o = o || {}; var f = onFace(sd, op.t, th, 0), ry = faceRy(sd);
    b.archDoor(f[0], op.y0, f[1], w, h, { ry: ry, door: false, depth: th * 0.7, frameStone: 'sandstone', keyC: 'sandstone', frameW: 0.2 });
    b.push(f[0], op.y0, f[1], ry);
    b.window(0, 0.02, 0.03, w - 0.04, h - 0.04, { arch: true, sillC: 'sandstone' });
    [-1, 1].forEach(function (s) { b.box(s * (w / 2 + 0.44 + w * 0.25), 0.05, 0.07, w * 0.5, h * 0.82, 0.05, { c: '#1f1e1c', m: M.paint, ry: s * 0.18, bevel: 0.01 }); b.box(s * (w / 2 + 0.44 + w * 0.25), 0.05 + h * 0.25, 0.1, w * 0.46, 0.04, 0.02, { c: 'iron', m: M.metal, ry: s * 0.18, bevel: 0 }); });
    if (o.flowers) {
      b.box(0, 0.0, 0.3, w + 0.25, 0.22, 0.3, { c: 'wood', m: M.wood, bevel: 0.02 });
      [-1, 1].forEach(function (s) { b.beam([s * (w / 2), -0.25, 0.06], [s * (w / 2), 0.0, 0.4], 0.02, { c: 'iron', m: M.metal }); });
      for (var i = 0; i < 6; i++) b.ball(-w / 2 + i * w / 5, 0.25, 0.3 + b.j(0.06), 0.085, { c: b.pick(['#f3f1ec', '#efebe4', '#f6f4f0']), m: M.paint, ao: 0, detail: 0 });
      for (var g = 0; g < 4; g++) b.ball(-w / 2 + 0.1 + g * (w - 0.2) / 3, 0.2, 0.36, 0.1, { c: 'leaf', m: M.leaf, ao: 0.2, detail: 0 });
    }
    b.pop();
  }
  // a single-pitch roof of slates from the low eave (xl, yl) up to (xh, yh), across za..zb, laid row by row
  function monoRoof(b, xl, yl, xh, yh, za, zb, rows, o) {
    o = o || {};
    var dx = xh - xl, dy = yh - yl, L = Math.hypot(dx, dy), a = Math.atan2(dy, Math.abs(dx)), rl = L / rows, pw = 0.38, zl = zb - za;
    var dir = dx < 0 ? Math.PI : 0;
    for (var r = 0; r < rows; r++) {
      (function (r) {
        b.unit(function () {
          var s1 = Math.min(L + 0.05, (r + 1.35) * rl), len = s1 - r * rl, del = 0.085 / len;
          b.push(xl, yl, (za + zb) / 2, dir); rotZ(b, a); b.push(s1, 0, 0, 0); rotZ(b, -del);
          var n = Math.ceil(zl / pw) + 1, off = (r % 2) * pw * 0.5;
          for (var i = 0; i < n; i++) {
            var zc = -zl / 2 + i * pw - off + pw / 2; if (zc > zl / 2 + 0.05) break; if (zc < -zl / 2 - 0.05) continue;
            var cc = new T.Color(b.pick(PAL[o.pal || 'slate'])), q = b.r();
            if (q < 0.18) cc.offsetHSL(0.006, -0.03, -0.05); else if (q < 0.4) cc.offsetHSL(-0.006, 0.01, 0.06); else if (q < 0.46) cc.lerp(new T.Color('#7f8657'), 0.25);
            var base = cc;
            b.box(-len / 2 + b.j(0.02), 0, Math.max(-zl / 2 + pw * 0.48, Math.min(zl / 2 - pw * 0.48, zc)), len, 0.05, pw * 0.95, { ry: b.j(0.02), rx: b.j(0.01), m: M.tile, bevel: 0.012, ao: 0.25, jit: 0, vary: 0.04, colors: function (wx, wy, wz, lx) { var t = (lx + len / 2) / len; return base.clone().multiplyScalar(1 - 0.36 * Math.pow(Math.max(0, t - 0.45) / 0.55, 1.2)); } });
          }
          b.pop(); b.pop();
        });
      })(r);
    }
  }

  KIT.defineBuild('ballista', {
    name: 'Ballista tower', size: 'middle', need: 48,
    line: 'A square stone tower with battlements and a giant crossbow on its roof, a rack of bolts and a crew of two.',
    r: 11, flat: [14, 12.5], ground: 'cobble', path: [[3.0, 11.0], [0.4, 3.4]],
    frameY: 5.2, frameR: 11.5, glowAt: [1.6, 10.8, -1.6],
    trees: [{ x: -7.6, z: -4.4, kind: 'pine', h: 7.4 }, { x: -8.6, z: -1.2, kind: 'pine', h: 5.6 }, { x: 8.6, z: 2.6, kind: 'birch', h: 6.4 }, { x: -9.0, z: 3.0, kind: 'round', h: 4.8 }],
    bushes: [{ x: 7.2, z: 5.0, r: 0.8, flowers: '#f3f1ec' }, { x: -5.9, z: 6.3, r: 0.7 }, { x: 7.6, z: -0.8, r: 0.6 }, { x: 2.6, z: -5.4, r: 0.7 }],
    build: function (b) {
      var tcx = 0.3, tcz = -0.6, W = 5.6, TH = 0.66, base = 0.55, CH = 0.33, NC = 22, top = base + NC * CH;
      var x0 = tcx - W / 2, x1 = tcx + W / 2, z0 = tcz - W / 2, z1 = tcz + W / 2;
      var deckY = top + 0.2;
      var PT = 0.5, PX0 = x0 - 0.3, PX1 = x1 + 0.3, PZ0 = z0 - 0.3, PZ1 = z1 + 0.3, CW = 2.2, CD = 2.4;
      var hcx = PX0 + CW / 2, hcz = PZ0 + CD / 2, eaveY = deckY + 2.5, hRise = 1.3;
      var BX = 0.75, BZ = -0.2, BRY = 2.62, BS = 1.2;
      // a point given in metres in the ballista's own frame (it aims along +z)
      function bw(lx, lz) { var c = Math.cos(BRY), s = Math.sin(BRY); return [BX + lx * c + lz * s, BZ - lx * s + lz * c]; }

      // the tower's openings, t measured along each side from its start
      var OPEN = [
        { side: 'front', t: 2.8, half: 0.82, y0: base, spring: base + 1.65, R: 0.86, top: base + 2.7, kind: 'door' },
        { side: 'front', t: 2.8, half: 0.52, y0: 5.5, spring: 6.35, R: 0.55, top: 7.0, kind: 'win', w: 0.8, h: 1.25, flowers: true },
        { side: 'front', t: 1.5, half: 0.15, y0: 3.7, top: 4.7, kind: 'slit' },
        { side: 'front', t: 4.28, half: 0.15, y0: 1.25, top: 2.1, kind: 'slit' },
        { side: 'left', t: 1.0, half: 0.15, y0: 3.7, top: 4.7, kind: 'slit' },
        { side: 'left', t: 2.6, half: 0.47, y0: 5.5, spring: 6.25, R: 0.5, top: 6.9, kind: 'win', w: 0.7, h: 1.1 },
        { side: 'right', t: 2.1, half: 0.15, y0: 2.0, top: 3.0, kind: 'slit' },
        { side: 'right', t: 1.2, half: 0.15, y0: 4.6, top: 5.6, kind: 'slit' },
        { side: 'back', t: 2.8, half: 0.15, y0: 3.0, top: 4.0, kind: 'slit' },
        { side: 'back', t: 2.8, half: 0.15, y0: 5.7, top: 6.6, kind: 'slit' }
      ];
      slitArms(OPEN, base, CH);
      var TOWER = { ch: CH, th: TH, len: 0.66, quoins: [0.95, 0.7], open: OPEN,
        palAt: function (k) { return k < 2 ? 'stoneDark' : (k === 8 || k === 14) ? 'sandstone' : 'stone'; },
        growAt: function (k) { return k < 2 ? 0.12 : (k === 8 || k === 14) ? 0.07 : 0; } };
      var S = sidesOf(tcx, tcz, W, W, TH);

      b.part('Footings');
      b.unit(function () { b.box(tcx, -0.08, tcz, W + 1.0, 0.36, W + 1.0, { c: 'stoneDark', bevel: 0.08 }); });
      b.unit(function () {
        b.box(tcx, 0.28, tcz, W + 0.55, 0.27, W + 0.55, { c: 'stone', bevel: 0.07 });
        b.box(tcx, 0.28, z1 + 0.43, 1.9, 0.22, 0.36, { c: 'sandstone', bevel: 0.05 });
      });

      b.part('Tower walls');
      masonBox(b, tcx, tcz, W, W, base, Object.assign({ k0: 0, k1: 10 }, TOWER));

      b.part('Doorway and arrow slits');
      b.unit(function () {
        b.archDoor(tcx, base, z1, 1.4, 2.35, { depth: TH + 0.15, frameStone: 'sandstone', keyC: 'sandstone', doorC: 'woodDark' });
        // one leaf shut, planked and strapped with iron, the other swung in
        b.push(tcx, base, z1, 0);
        for (var i = 0; i < 3; i++) { var px = 0.02 + (i + 0.5) * 0.226, tp = 1.65 + Math.sqrt(Math.max(0, 0.49 - px * px)) - 0.04; b.box(px, 0, 0.05, 0.21, tp, 0.07, { c: 'woodDark', m: M.wood, bevel: 0.012, ao: 0.4 }); }
        [0.45, 1.55].forEach(function (yy) { b.box(0.36, yy, 0.09, 0.64, 0.07, 0.03, { c: 'iron', m: M.metal, bevel: 0.01 }); });
        b.addGeo(new T.TorusGeometry(0.07, 0.014, 4, 10), { x: 0.14, y: 1.05, z: 0.1, c: 'iron', m: M.metal, ao: 0 });
        b.pop();
      });
      b.unit(function () { OPEN.forEach(function (op) { if (op.kind === 'slit' && op.top < 3.86) slit(b, S[op.side], op, base, CH, TH); }); });

      b.part('Tower walls, upper');
      masonBox(b, tcx, tcz, W, W, base, Object.assign({ k0: 10, k1: NC }, TOWER));

      b.part('Windows');
      b.unit(function () {
        OPEN.forEach(function (op) {
          if (op.kind === 'slit' && op.top >= 3.86) slit(b, S[op.side], op, base, CH, TH);
          if (op.kind === 'win') archWindow(b, S[op.side], op, op.w, op.h, TH, { flowers: op.flowers });
        });
      });

      b.part('Corbels and ledge');
      // three-stepped corbels carry the battlements out past the walls
      var faces = [
        { a: [x0, z1], u: [1, 0], n: [0, 1], L: W }, { a: [x1, z1], u: [0, -1], n: [1, 0], L: W },
        { a: [x1, z0], u: [-1, 0], n: [0, -1], L: W }, { a: [x0, z0], u: [0, 1], n: [-1, 0], L: W }
      ];
      faces.forEach(function (f) {
        b.unit(function () {
          var n = 9, ry = -Math.atan2(f.u[1], f.u[0]);
          for (var i = 0; i < n; i++) {
            var t = 0.35 + i * (f.L - 0.7) / (n - 1);
            for (var s = 0; s < 3; s++) { var out = 0.12 + s * 0.1, cx = f.a[0] + f.u[0] * t + f.n[0] * (out - 0.22) / 2, cz = f.a[1] + f.u[1] * t + f.n[1] * (out - 0.22) / 2; b.box(cx, top - 0.6 + s * 0.2, cz, 0.26, 0.19, out + 0.22, { ry: ry, c: b.stoneC('sandstone', 5), m: M.stone, bevel: 0.04 }); }
          }
        });
      });
      var LEDGE = [
        { ax: x0 - 0.36, az: z1 + 0.08, ux: 1, uz: 0, L: W + 0.72 }, { ax: x1 + 0.08, az: z1 - 0.2, ux: 0, uz: -1, L: W - 0.4 },
        { ax: x1 + 0.36, az: z0 - 0.08, ux: -1, uz: 0, L: W + 0.72 }, { ax: x0 - 0.08, az: z0 + 0.2, ux: 0, uz: 1, L: W - 0.4 }
      ];
      b.unit(function () { LEDGE.slice(0, 2).forEach(function (r) { course(b, r, top, 0.2, 0.56, { pal: 'sandstone', len: 0.6 }); }); });
      b.unit(function () { LEDGE.slice(2).forEach(function (r) { course(b, r, top, 0.2, 0.56, { pal: 'sandstone', len: 0.6 }); }); });

      b.part('Fighting deck');
      b.unit(function () { b.box(tcx, top + 0.02, tcz, W - 0.4, 0.1, W - 0.4, { c: '#8a7e6c', m: M.stone, bevel: 0, jit: 0.01 }); });
      // pale flagstones laid row by row
      var FR = 9, fd = (W - 0.4) / FR;
      for (var g = 0; g < 6; g++) {
        (function (g) {
          b.unit(function () {
            for (var i = Math.round(g * FR / 6); i < Math.round((g + 1) * FR / 6); i++) {
              var fz = z0 + 0.2 + (i + 0.5) * fd, xx = x0 + 0.2 - (i % 2) * 0.3;
              while (xx < x1 - 0.25) {
                var L = 0.5 + b.r() * 0.45, xa = Math.max(x0 + 0.2, xx), xb = Math.min(x1 - 0.2, xx + L);
                if (xb - xa > 0.12) b.box((xa + xb) / 2, top + 0.12, fz + b.j(0.015), xb - xa - 0.035, 0.08, fd - 0.035, { ry: b.j(0.015), c: b.stoneC(b.chance(0.6) ? 'sandstone' : 'stone', 5), m: M.stone, bevel: 0.025, ao: 0.15, jit: 0.03 });
                xx += L;
              }
            }
          });
        })(g);
      }

      b.part('Battlements');
      var RUNS = [
        { ax: PX0, az: PZ1 - PT / 2, ux: 1, uz: 0, L: PX1 - PX0, u0: 0, side: 0 },
        { ax: PX1 - PT / 2, az: PZ1 - PT, ux: 0, uz: -1, L: (PZ1 - PZ0) - 2 * PT, u0: PT, side: 1 },
        { ax: PX1, az: PZ0 + PT / 2, ux: -1, uz: 0, L: (PX1 - PX0) - CW, u0: 0, side: 0 },
        { ax: PX0 + PT / 2, az: PZ1 - PT, ux: 0, uz: -1, L: (PZ1 - PZ0) - PT - CD, u0: PT, side: 1 }
      ];
      var CREN = [[0.792, 1.352], [2.144, 2.704], [3.496, 4.056], [4.848, 5.408]];
      RUNS.forEach(function (r) {
        r.cuts = [];
        CREN.forEach(function (c) { var a = Math.max(0, c[0] - r.u0), e = Math.min(r.L, c[1] - r.u0); if (e - a > 0.5) r.cuts.push([a, e]); });
        r.merlons = subtract([[0, r.L]], r.cuts);
      });
      for (var pk = 0; pk < 4; pk++) {
        (function (pk) {
          [[0, 3], [1, 2]].forEach(function (pair) { b.unit(function () { pair.forEach(function (ri) { var r = RUNS[ri]; course(b, r, deckY + pk * 0.3, 0.3, PT, { pal: 'stone', len: 0.58, cuts: pk >= 2 ? r.cuts : [] }); }); }); });
        })(pk);
      }
      b.unit(function () {
        RUNS.forEach(function (r) {
          var ry = -Math.atan2(r.uz, r.ux);
          r.merlons.forEach(function (m) { var a = m[0] + (r.side && m[0] < 0.01 ? 0.06 : -0.03), e = m[1] + 0.03, tm = (a + e) / 2; b.box(r.ax + r.ux * tm, deckY + 1.2, r.az + r.uz * tm, e - a, 0.11, PT + 0.07, { ry: ry, c: b.stoneC('sandstone', 5), m: M.stone, bevel: 0.035 }); });
          r.cuts.forEach(function (c) { var tm = (c[0] + c[1]) / 2; b.box(r.ax + r.ux * tm, deckY + 0.6, r.az + r.uz * tm, c[1] - c[0] - 0.04, 0.09, PT + 0.06, { ry: ry, c: b.stoneC('sandstone', 5), m: M.stone, bevel: 0.03 }); });
        });
      });

      b.part('Stair house');
      var HS = masonBox(b, hcx, hcz, CW, CD, deckY, { k0: 0, k1: 7, ch: 0.357, th: 0.42, len: 0.55, quoins: [0.62, 0.45],
        open: [{ side: 'front', t: 1.3, half: 0.52, y0: deckY, spring: deckY + 1.4, R: 0.56, top: deckY + 2.1 }, { side: 'left', t: 0.78, half: 0.13, y0: deckY + 0.9, top: deckY + 1.75 }] });
      b.unit(function () {
        var df = onFace(HS.front, 1.3, 0.42, 0);
        b.archDoor(df[0], deckY, df[1], 0.8, 1.8, { depth: 0.6, frameStone: 'sandstone', keyC: 'sandstone', doorC: 'woodDark', frameW: 0.2 });
        b.push(df[0], deckY, df[1], 0);
        for (var i = 0; i < 3; i++) { var px = -0.4 + (i + 0.5) * 0.267, tp = 1.4 + Math.sqrt(Math.max(0, 0.16 - px * px)) - 0.03; b.box(px, 0, 0.05, 0.25, tp, 0.07, { c: 'woodDark', m: M.wood, bevel: 0.012 }); }
        [0.35, 1.25].forEach(function (yy) { b.box(0, yy, 0.09, 0.74, 0.06, 0.03, { c: 'iron', m: M.metal, bevel: 0.01 }); });
        b.pop();
        slit(b, HS.left, { t: 0.78, half: 0.13, y0: deckY + 0.9, top: deckY + 1.75 }, deckY, 0.357, 0.42);
      });
      b.unit(function () {
        [1, -1].forEach(function (e) {
          var gz = e > 0 ? hcz + CD / 2 - 0.21 : hcz - CD / 2 + 0.21;
          b.gableEnd(hcx, eaveY, gz, CW - 0.04, hRise - 0.06, 0.42, { ry: 0, c: 'woodDark', m: M.wood });
          for (var i = 0; i < 9; i++) { var dx = -0.96 + i * 0.24, hh = (1.1 - Math.abs(dx)) / 1.1 * (hRise - 0.06) - 0.08; if (hh > 0.1) b.box(hcx + dx, eaveY, gz + e * 0.22, 0.07, hh, 0.04, { c: 'beam', m: M.wood, bevel: 0.01 }); }
        });
      });
      b.gableRoof(hcx, eaveY, hcz, CD, CW, hRise, { m: 'slate', ry: Math.PI / 2, over: 0.32, overX: 0.3, rows: 5 });
      b.unit(function () {
        // barge boards, the carved head at the front and the flag at the back
        var zb = hcz + CD / 2 + 0.28, m = hRise / (CW / 2);
        [-1, 1].forEach(function (s) { b.beam([hcx + s * (CW / 2 + 0.34), eaveY - 0.34 * m + 0.13, zb], [hcx, eaveY + hRise + 0.16, zb], 0.07, { c: 'woodDark', r2: 0.035 }); });
        dragonHead(b, hcx, eaveY + hRise + 0.08, zb - 0.05, -Math.PI / 2, 0.85);
        var zr = hcz - CD / 2 - 0.2;
        [-1, 1].forEach(function (s) { b.beam([hcx + s * (CW / 2 + 0.34), eaveY - 0.34 * m + 0.13, zr], [hcx, eaveY + hRise + 0.16, zr], 0.07, { c: 'woodDark', r2: 0.035 }); });
      });

      b.part('Bolt shed');
      // a gabled timber shed against the west wall, its ridge running out from the tower so the long slope faces the
      // sun, a carved dragon head on the open gable
      var sx0 = x0, gx = -5.0, sz0 = -2.75, sz1 = 1.55, eY = 2.2, sRise = 1.25, sOX = 0.35, sw = (sx0 + 0.05 - sOX) - gx, scx = gx + sw / 2, scz = (sz0 + sz1) / 2;
      b.unit(function () {
        [sz0, sz1].forEach(function (z) { stave(b, gx, 0, z, eY - 0.32, 0.22); });
        // eave plates from the posts to iron corbels in the wall, a tie beam across the gable
        [sz0, sz1].forEach(function (z) {
          b.beam([gx - 0.25, eY - 0.16, z], [sx0, eY - 0.16, z], 0.085, { c: 'beam' });
          b.box(sx0 - 0.1, eY - 0.42, z, 0.22, 0.2, 0.22, { c: 'iron', m: M.metal, bevel: 0.02, taper: 0.7 });
        });
        b.beam([gx, eY - 0.16, sz0 - 0.2], [gx, eY - 0.16, sz1 + 0.2], 0.085, { c: 'beam' });
        [sz0, sz1].forEach(function (z) { b.beam([gx, eY - 0.75, z + (z < scz ? 0.05 : -0.05)], [gx, eY - 0.22, z + (z < scz ? 0.6 : -0.6)], 0.05, { c: 'beam' }); });
      });
      b.unit(function () {
        // king post, ridge beam and rafters
        b.beam([gx, eY - 0.1, scz], [gx, eY + sRise - 0.2, scz], 0.07, { c: 'beam' });
        b.beam([gx - 0.1, eY + sRise - 0.2, scz], [sx0, eY + sRise - 0.2, scz], 0.075, { c: 'beam' });
        [gx, gx + sw * 0.36, gx + sw * 0.7, sx0 - 0.1].forEach(function (x) { [sz0, sz1].forEach(function (z) { b.beam([x, eY - 0.13, z], [x, eY + sRise - 0.2, scz], 0.05, { c: 'beam' }); }); });
      });
      b.gableRoof(scx, eY, scz, sw, sz1 - sz0, sRise, { m: 'slate', over: 0.35, overX: sOX, rows: 4 });
      b.unit(function () {
        // barge boards crossing at the apex into a carved dragon head looking out over the yard
        var bx = gx - sOX - 0.05, m = sRise / ((sz1 - sz0) / 2);
        [sz0 - 0.4, sz1 + 0.4].forEach(function (z) { b.beam([bx, eY - 0.4 * m + 0.12, z], [bx, eY + sRise + 0.17, scz], 0.065, { c: 'woodDark', r2: 0.035 }); });
        dragonHead(b, bx, eY + sRise + 0.1, scz, Math.PI, 0.7);
        // a round shield hung on the king post, facing out
        vShield(b, gx - 0.08, eY + 0.5, scz, -Math.PI / 2, 0.3, 'quarter', 'bone', 'ink');
      });
      b.unit(function () {
        // finished bolts on iron pegs along the wall, and rough shafts on trestles
        [1.4, 1.8].forEach(function (yy, j) {
          [-2.2, -0.2].forEach(function (z) { b.beam([x0 - 0.02, yy - 0.05, z], [x0 - 0.3, yy - 0.02, z], 0.02, { c: 'iron', m: M.metal }); });
          for (var k = 0; k < 3; k++) bolt(b, x0 - 0.2 - k * 0.075, yy + 0.02, -2.5, 0, 0, 2.15, { roll: j + k });
        });
        [-2.0, -0.2].forEach(function (z) { b.beam([-4.35, 0, z - 0.3], [-4.15, 0.75, z], 0.04, { c: 'wood' }); b.beam([-3.75, 0, z - 0.3], [-3.95, 0.75, z], 0.04, { c: 'wood' }); b.beam([-4.35, 0, z + 0.3], [-4.15, 0.75, z], 0.04, { c: 'wood' }); b.beam([-3.75, 0, z + 0.3], [-3.95, 0.75, z], 0.04, { c: 'wood' }); b.box(-4.05, 0.72, z, 0.6, 0.08, 0.12, { c: 'wood', m: M.wood }); });
        for (var r2 = 0; r2 < 2; r2++) for (var q = 0; q < 4 - r2; q++) b.beam([-4.32 + q * 0.18 + r2 * 0.09, 0.85 + r2 * 0.12, -2.6], [-4.32 + q * 0.18 + r2 * 0.09, 0.85 + r2 * 0.12, 0.4], 0.055, { c: b.pick(['woodLight', 'wood']) });
        b.log(-4.3, 0, 1.0, 0.28, 0.5, { c: 'wood', seg: 9 });
        b.box(-4.3, 0.5, 1.0, 0.04, 0.32, 0.14, { c: 'steel', m: M.metal, rz: 0.4, bevel: 0.005 });
        // a few finished bolts stood against the front post
        for (var i = 0; i < 4; i++) bolt(b, gx - 0.13 + i * 0.085, 0.02, sz1 + 0.5 + b.j(0.04), Math.PI + b.j(0.08), Math.PI / 2 - 0.2, 1.9, { roll: i });
      });

      b.part('Ballista dais');
      // a round stone dais lifts the engine above the battlements, into the sun
      b.stoneRing(BX, BZ, 1.36, deckY, 0.48, 0.32, { pal: 'stone', course: 0.24, len: 0.62 });
      b.unit(function () {
        for (var i = 0; i < 13; i++) { var a = i / 13 * Math.PI * 2; b.box(BX + Math.cos(a) * 1.38, deckY + 0.48, BZ + Math.sin(a) * 1.38, 0.62, 0.09, 0.42, { ry: -a + Math.PI / 2, c: b.stoneC('sandstone', 5), m: M.stone, bevel: 0.03 }); }
        // two steps up on the crew's side
        var st = bw(1.05, -1.18), sphi = Math.atan2(st[1] - BZ, st[0] - BX);
        b.box(st[0], deckY, st[1], 0.9, 0.24, 0.4, { ry: -Math.PI / 2 - sphi, c: 'sandstone', m: M.stone, bevel: 0.04 });
      });

      b.part('Ballista');
      b.push(BX, deckY + 0.57, BZ, BRY, BS);
      var PIV = 1.12, P = 0.16;
      b.unit(function () {
        // a round timber turntable with an iron tyre, planked across
        b.cyl(0, 0, 0, 1.26, 0.1, { c: 'woodDark', m: M.wood, seg: 10, flat: true });
        for (var i = 0; i < 7; i++) { var z = -1.08 + (i + 0.5) * 2.16 / 7, hw = Math.sqrt(Math.max(0.05, 1.2 * 1.2 - (Math.abs(z) + 0.15) * (Math.abs(z) + 0.15))); b.box(0, 0.1, z, hw * 2, 0.05, 0.29, { c: 'ballista_deck', m: M.wood, bevel: 0.012 }); }
        b.cyl(0, 0.02, 0, 1.28, 0.08, { c: 'iron', m: M.metal, seg: 24, open: true });
      });
      b.unit(function () {
        // the carriage: sleepers and cross-ties
        [-1, 1].forEach(function (s) { b.box(s * 0.42, 0.15, -0.3, 0.2, 0.18, 2.3, { c: 'beam', m: M.wood, bevel: 0.03 }); });
        [-1.25, 0.65].forEach(function (z) { b.box(0, 0.15, z, 1.08, 0.16, 0.18, { c: 'beam', m: M.wood, bevel: 0.03 }); });
        [-1, 1].forEach(function (s) { [-1.2, 0.6].forEach(function (z) { b.box(s * 0.42, 0.33, z, 0.24, 0.02, 0.24, { c: 'iron', m: M.metal, bevel: 0 }); }); });
      });
      b.unit(function () {
        // the cheeks that hold the trunnion, the traversing trail and the elevating prop
        [-1, 1].forEach(function (s) {
          b.extrude(s * 0.24, 0, 0, [[0.78, 0.32], [-0.78, 0.32], [-0.16, PIV + 0.16], [0.16, PIV + 0.16]], 0.1, { ry: Math.PI / 2, c: 'beam', m: M.wood, bevel: 0.012 });
          b.box(s * 0.3, PIV - 0.1, 0, 0.04, 0.2, 0.2, { c: 'iron', m: M.metal, bevel: 0.01 });
          b.beam([s * 0.42, 0.24, -1.4], [s * 0.26, 0.86, -1.9], 0.05, { c: 'beam' });
        });
        b.cyl(-0.36, PIV, 0, 0.05, 0.72, { rz: -Math.PI / 2, c: 'iron', m: M.metal, seg: 8 });
        b.beam([-0.34, 0.86, -1.9], [0.34, 0.86, -1.9], 0.045, { c: 'woodLight', round: true });
        b.post(0, 0.32, -1.0, 0.07, 0.52, { c: 'wood' }); b.box(0, 0.82, -1.0, 0.24, 0.08, 0.2, { c: 'woodDark', m: M.wood, rx: -0.15 });
      });
      b.push(0, PIV, 0, 0); rotX(b, -P);
      b.unit(function () {
        // the tiller: a long stock with a groove between two rails, banded in iron
        b.box(0, -0.11, 0.12, 0.26, 0.18, 3.7, { c: 'woodDark', m: M.wood, bevel: 0.025 });
        [-1, 1].forEach(function (s) { b.box(s * 0.085, 0.07, 0.25, 0.09, 0.06, 3.3, { c: 'wood', m: M.wood, bevel: 0.012 }); });
        [-1.45, -0.55, 0, 0.9, 1.5].forEach(function (z) { b.box(0, -0.125, z, 0.29, 0.25, 0.07, { c: 'iron', m: M.metal, bevel: 0.01 }); });
        b.box(0, -0.2, 1.72, 0.52, 0.26, 0.32, { c: 'woodDark', m: M.wood, bevel: 0.03 });
        b.box(0, -0.21, 1.72, 0.56, 0.06, 0.36, { c: 'iron', m: M.metal, bevel: 0.01 });
      });
      b.unit(function () {
        // the claw that holds the drawn string, and the trigger lever under it
        b.box(0, 0.13, -0.95, 0.24, 0.1, 0.26, { c: 'iron', m: M.metal, bevel: 0.02 });
        b.box(0, 0.22, -0.84, 0.08, 0.1, 0.08, { c: 'iron', m: M.metal, bevel: 0.01, rx: 0.4 });
        b.beam([0, -0.12, -0.92], [0, -0.48, -1.14], 0.03, { c: 'iron', m: M.metal });
        b.ball(0, -0.48, -1.14, 0.045, { c: 'iron', m: M.metal });
      });
      // the bow, one arm at a time: laminated timber bent back toward the drawn string, bound in iron, horn nocks
      var ARM = [[0.22, 1.8, 0.13], [0.6, 1.76, 0.12], [0.92, 1.65, 0.105], [1.17, 1.47, 0.09], [1.33, 1.26, 0.075], [1.4, 1.07, 0.065]], AY = -0.08;
      [-1, 1].forEach(function (s) {
        b.unit(function () {
          for (var i = 0; i < ARM.length - 1; i++) {
            var A = [s * ARM[i][0], AY, ARM[i][1]], C = [s * ARM[i + 1][0], AY, ARM[i + 1][1]];
            b.beam(A, C, ARM[i][2], { c: 'ballista_bow', m: M.wood, round: true, seg: 7, r2: ARM[i + 1][2] });
            b.ball(C[0], C[1], C[2], ARM[i + 1][2], { c: 'ballista_bow', m: M.wood, detail: 1 });
            if (i < 4) b.cyl(A[0] + (C[0] - A[0]) * 0.5, AY, A[2] + (C[2] - A[2]) * 0.5, ARM[i][2] * 1.14, 0.07, { c: i % 2 ? 'iron' : '#e9e2cf', m: i % 2 ? M.metal : M.rope, seg: 8, rz: Math.PI / 2, ry: -Math.atan2(C[2] - A[2], C[0] - A[0]) });
          }
          var tp = ARM[ARM.length - 1];
          b.cone(s * tp[0], AY, tp[1], 0.07, 0.22, { c: 'bone', m: M.paint, seg: 6, rx: -Math.PI / 2 });
          b.box(s * 0.2, -0.17, 1.72, 0.08, 0.24, 0.36, { c: 'iron', m: M.metal, bevel: 0.01 });
        });
      });
      var tipL = [-ARM[5][0], AY, ARM[5][1] - 0.12], tipR = [ARM[5][0], AY, ARM[5][1] - 0.12], claw = [0, 0.15, -0.9];
      b.unit(function () {
        b.beam(tipL, claw, 0.024, { c: '#e9e2cf', m: M.rope, round: true, seg: 4 });
        b.beam(tipR, claw, 0.024, { c: '#e9e2cf', m: M.rope, round: true, seg: 4 });
      });
      b.unit(function () {
        // the windlass at the tail: an axle through the stock, rope drums, and a spoked wheel each side
        b.cyl(-0.66, -0.02, -1.55, 0.04, 1.32, { rz: -Math.PI / 2, c: 'iron', m: M.metal, seg: 8 });
        [-1, 1].forEach(function (s) {
          b.cyl(s * 0.2 - 0.06, -0.02, -1.55, 0.1, 0.12, { rz: -Math.PI / 2, c: 'rope', m: M.rope, seg: 10 });
          b.addGeo(new T.TorusGeometry(0.3, 0.025, 5, 16), { x: s * 0.56, y: -0.02, z: -1.55, ry: Math.PI / 2, c: 'woodLight', m: M.wood, ao: 0 });
          b.cyl(s * 0.56 - 0.06, -0.02, -1.55, 0.07, 0.12, { rz: -Math.PI / 2, c: 'woodDark', m: M.wood, seg: 8 });
          for (var i = 0; i < 6; i++) { var a = i / 6 * Math.PI * 2 + 0.3; b.beam([s * 0.56, -0.02, -1.55], [s * 0.56, -0.02 + Math.sin(a) * 0.44, -1.55 + Math.cos(a) * 0.44], 0.022, { c: 'woodLight', round: true, seg: 5 }); }
          b.beam([s * 0.2, 0.06, -1.5], [s * 0.05, 0.16, -1.0], 0.014, { c: 'rope', m: M.rope, round: true, seg: 4 });
        });
        b.box(-0.2, 0.0, -1.38, 0.05, 0.05, 0.2, { c: 'iron', m: M.metal, rx: -0.5, bevel: 0.005 });
      });
      b.unit(function () {
        // a bolt laid in the groove, its tail at the claw; one vane is the Hub's orange
        bolt(b, 0, 0.105, -0.8, 0, 0, 2.6, { fins: ['bone', 'ember', 'bone'], roll: 0.0 });
      });
      b.pop(); // the stock frame
      b.pop(); // the ballista frame

      b.part('Bolt rack and stores');
      var rkx = PX1 - PT - 0.2, rz0 = 0.45, rz1 = 1.85;
      b.unit(function () {
        [rz0, rz1].forEach(function (z) { b.post(rkx, deckY, z, 0.06, 1.45, { c: 'beam' }); });
        b.box(rkx, deckY, (rz0 + rz1) / 2, 0.3, 0.2, rz1 - rz0 + 0.14, { c: 'woodDark', m: M.wood, bevel: 0.02 });
        b.box(rkx, deckY + 1.25, (rz0 + rz1) / 2, 0.1, 0.1, rz1 - rz0 + 0.14, { c: 'wood', m: M.wood, bevel: 0.015 });
      });
      b.unit(function () {
        for (var i = 0; i < 6; i++) { var z = rz0 + 0.17 + i * (rz1 - rz0 - 0.34) / 5; bolt(b, rkx - 0.02, deckY + 0.06, z, Math.PI / 2, Math.PI / 2 - 0.09, 2.05, { roll: i * 0.7, fins: ['bone', i % 3 === 0 ? 'ink' : 'bone', 'inkGrey'] }); }
      });
      b.unit(function () {
        // three spare bolts in a cradle along the west wall, a crate of bolt heads, a rope coil, a barrel, a bucket
        [-0.55, 0.75].forEach(function (z) { b.box(-2.0, deckY, z, 0.5, 0.16, 0.2, { c: 'woodDark', m: M.wood }); });
        for (var k = 0; k < 3; k++) bolt(b, -2.1 + k * 0.1, deckY + 0.2, -1.1, 0, 0, 2.05, { roll: k });
        b.crate(-1.55, deckY, 1.6, 0.55, { ry: 0.3 });
        for (var i = 0; i < 6; i++) b.cone(-1.68 + (i % 3) * 0.12, deckY + 0.55, 1.5 + Math.floor(i / 3) * 0.16, 0.05, 0.18, { c: 'steel', m: M.metal, seg: 4, flat: true });
        b.ropeCoil(0.3, deckY, 1.65, 0.24); b.ropeCoil(0.3, deckY + 0.08, 1.65, 0.2);
        b.barrel(1.15, deckY, 1.68, { h: 0.78 });
        b.bucket(-0.25, deckY, -2.7);
      });

      b.part('Hoist');
      var hz = 0.08, armY = deckY + 2.15, jx = PX1 + 1.55;
      b.unit(function () {
        stave(b, PX1 - PT - 0.25, deckY, hz, 2.35, 0.22, { cap: false });
        b.beam([PX1 - PT - 0.5, armY, hz], [jx + 0.15, armY, hz], 0.1, { c: 'beam' });
        b.beam([PX1 - PT - 0.25, deckY + 1.0, hz], [PX1 + 0.45, armY - 0.06, hz], 0.07, { c: 'beam' });
        dragonHead(b, jx + 0.1, armY + 0.04, hz, 0, 0.5);
      });
      var pulX = jx - 0.12, ropeTop = armY - 0.42, loadY = 5.3;
      b.unit(function () {
        b.beam([pulX, armY - 0.08, hz], [pulX, ropeTop + 0.1, hz], 0.02, { c: 'iron', m: M.metal });
        b.box(pulX, ropeTop - 0.12, hz, 0.12, 0.34, 0.16, { c: 'wood', m: M.wood, bevel: 0.02 });
        b.addGeo(new T.TorusGeometry(0.13, 0.03, 5, 12), { x: pulX, y: ropeTop, z: hz, c: 'iron', m: M.metal, ao: 0 });
        // one strand down to the bundle of bolts, the other to the man hauling in the yard
        b.beam([pulX - 0.12, ropeTop, hz], [pulX - 0.12, loadY + 0.45, hz], 0.018, { c: 'rope', m: M.rope, round: true, seg: 4 });
        b.beam([pulX + 0.12, ropeTop, hz], [pulX + 0.37, 1.72, hz + 0.02], 0.018, { c: 'rope', m: M.rope, round: true, seg: 4 });
        swag(b, [pulX + 0.38, 1.36, hz + 0.02], [pulX + 0.95, 0.06, hz + 0.75], 0.25, 0.018);
        b.ropeCoil(pulX + 1.05, 0, hz + 0.85, 0.28);
      });
      b.unit(function () {
        var lx = pulX - 0.12;
        b.beam([lx, loadY + 0.45, hz], [lx, loadY + 0.18, hz - 0.45], 0.014, { c: 'rope', m: M.rope, round: true, seg: 4 });
        b.beam([lx, loadY + 0.45, hz], [lx, loadY + 0.18, hz + 0.45], 0.014, { c: 'rope', m: M.rope, round: true, seg: 4 });
        for (var i = 0; i < 5; i++) { var a = i / 5 * Math.PI * 2; bolt(b, lx + Math.cos(a) * 0.07, loadY + 0.08 + Math.sin(a) * 0.07, hz - 1.05, 0, 0, 2.0, { roll: i }); }
        [-0.45, 0.45].forEach(function (d) { b.cyl(lx - 0.13, loadY + 0.08, hz + d, 0.13, 0.26, { rz: -Math.PI / 2, c: 'rope', m: M.rope, seg: 8, open: true }); });
      });

      b.part('Banner, shields and flag');
      b.unit(function () {
        var bx = tcx + 1.9, by = top - 0.72, bz = z1 + 0.38;
        b.beam([bx, by, z1 - 0.05], [bx, by, bz + 0.05], 0.045, { c: 'iron', m: M.metal });
        b.beam([bx, by - 0.5, z1 - 0.02], [bx, by - 0.02, bz - 0.12], 0.03, { c: 'iron', m: M.metal });
        b.banner(bx, by, bz, 1.1, 2.7, { c: 'ink', emblem: 'none', tail: 'swallow', band: 'ember', bandAt: 0.75, bandH: 0.05, trim: 'iron', ry: 0 });
        xbowEmblem(b, bx, by - 2.7 * 0.42, bz, 0.78, '#f1eee8', 0);
      });
      b.unit(function () {
        var kinds = ['half', 'ring', 'quarter', 'cross', 'half'], cols = [['ink', 'bone'], ['bone', 'ink'], ['ink', 'bone'], ['inkGrey', 'bone'], ['bone', 'ink']];
        RUNS[0].merlons.forEach(function (m, i) { var x = PX0 + (m[0] + m[1]) / 2; vShield(b, x, deckY + 0.88, PZ1 + 0.03, 0, 0.32, kinds[i % 5], cols[i % 5][0], cols[i % 5][1]); });
        [2.1, 0.75, -0.75].forEach(function (z, i) { vShield(b, PX0 - 0.03, deckY + 0.88, z, -Math.PI / 2, 0.32, kinds[(i + 2) % 5], cols[(i + 1) % 5][0], cols[(i + 1) % 5][1]); });
      });
      b.unit(function () {
        var fz = hcz - CD / 2 - 0.12, fy = eaveY + hRise + 0.1;
        b.flag(hcx, fy, fz, 2.4, 1.25, 0.75, { c: 'ink', emblem: 'none', ry: -0.6 });
        b.flag(hcx, fy + 2.4, fz, 0.6, 0.8, 0.26, { c: 'ember', pennant: true, emblem: 'none', pr: 0.03, ry: -0.6 });
      });

      b.part('Yard');
      b.unit(function () { [-1.35, 1.35].forEach(function (x) { b.torch(tcx + x, base + 2.0, z1 + 0.04, { s: 0.6 }); }); });
      b.unit(function () {
        b.cart(-2.0, 4.15, { ry: 0.5, load: function () {
          // a heaped load of bolts, white vanes to the tail board, bound down with rope
          for (var row = 0; row < 5; row++) for (var i = 0; i < 6 - row; i++) bolt(b, -0.5 + row * 0.1 + i * 0.2, 0.82 + row * 0.085, 1.0 + b.j(0.05), Math.PI + b.j(0.03), 0, 1.75, { roll: i + row, shaft: b.pick(['woodLight', 'woodLight', 'wood']), fins: ['bone', 'bone', row === 4 && i === 0 ? 'ember' : 'bone'] });
          [-0.4, 0.55].forEach(function (z) { b.beam([-0.66, 1.16, z], [0, 1.27, z], 0.018, { c: 'rope', m: M.rope, round: true, seg: 4 }); b.beam([0, 1.27, z], [0.66, 1.16, z], 0.018, { c: 'rope', m: M.rope, round: true, seg: 4 }); });
        } });
      });
      b.unit(function () {
        // the smith's corner: anvil, a brazier for the bolt heads, a quench bucket, a crate of finished heads
        b.anvil(4.15, 0, 4.0, { ry: 0.35 });
        b.brazier(4.95, 0, 4.75, 0.75, { i: 1.1 });
        b.bucket(4.9, 0, 3.7);
        b.crate(3.35, 0, 5.15, 0.6, { ry: -0.3 });
        for (var i = 0; i < 5; i++) b.cone(3.2 + (i % 3) * 0.14, 0.62, 5.05 + Math.floor(i / 3) * 0.18, 0.05, 0.18, { c: 'steel', m: M.metal, seg: 4, flat: true });
      });
      b.unit(function () {
        // stores by the shed: barrels of pitch and crates of fletching
        b.barrel(-3.35, 0, 2.95, {}); b.barrel(-4.0, 0, 3.2, { h: 0.82 }); b.barrel(-3.75, 0, 3.95, { lie: true, ry: 0.35 });
        b.crate(-4.6, 0, 2.55, 0.7, { ry: 0.25 }); b.crate(-4.55, 0.7, 2.55, 0.5, { ry: -0.1 });
      });
      b.unit(function () {
        b.sack(x1 - 0.35, 0, z1 + 0.85, 0.5); b.sack(x1 - 0.85, 0, z1 + 0.95, 0.42);
        // a bundle of finished bolts on two blocks by the path, bound with rope, ready to go up
        [2.3, 3.5].forEach(function (bx) { b.box(bx, 0, 6.0, 0.22, 0.16, 0.6, { c: 'woodDark', m: M.wood, ry: 0.1 }); });
        for (var i = 0; i < 7; i++) { var col = i < 4 ? i : i - 4, row = i < 4 ? 0 : 1; bolt(b, 1.75, 0.2 + row * 0.07, 5.85 + col * 0.09 + row * 0.045, Math.PI / 2 + 0.1, 0, 2.05, { roll: i }); }
        [2.0, 3.25].forEach(function (bx) { b.cyl(bx, 0.24, 6.0 - 0.1 * (bx - 2.0), 0.22, 0.05, { rz: Math.PI / 2, ry: 0.1, c: 'rope', m: M.rope, seg: 8, open: true }); });
      });
      b.unit(function () { b.woodpile(-1.3, -4.8, { n: 3, len: 1.8, ry: 0.1 }); b.woodpile(2.6, -4.6, { n: 4, len: 1.5, ry: -0.2 }); });

      b.part('Ivy and flowers');
      b.unit(function () {
        b.ivy([[x0 - 0.1, 0.5, z1 - 0.3], [x0 - 0.05, 2.0, z1 - 0.5], [x0 - 0.12, 3.0, z1 - 0.2]], [-1, 0, 0], { density: 5, spread: 0.45 });
        b.ivy([[x0 + 0.4, 0.5, z1 + 0.1], [x0 + 0.6, 1.9, z1 + 0.08], [x0 + 0.3, 3.4, z1 + 0.06], [x0 + 0.55, 4.6, z1 + 0.06]], [0, 0, 1], { density: 6, spread: 0.5 });
        b.bush(tcx - 1.65, z1 + 0.75, 0.45, { flowers: '#f3f1ec', n: 2 });
        b.bush(x1 + 0.6, z1 + 0.4, 0.5, { flowers: '#e6e0d2', n: 2 });
      });

      b.life(function () {
        // the crew of two on the deck: one winds the windlass, one brings a fresh bolt from the rack
        var cp = bw(1.11, -1.86);
        b.figure(cp[0], cp[1], { role: 'villager', pose: 'ballista_crank', ry: BRY - Math.PI / 2, y: deckY, hat: 'kettle', c: '#3b3a38' });
        // the loader brings a fresh bolt from the rack, slung across his body from the low hand over the shoulder
        var lx = 1.95, lz = 1.2, lry = -1.87;
        b.figure(lx, lz, { role: 'villager', pose: 'ballista_shoulder', ry: lry, y: deckY, hat: 'kettle', c: '#5c5e62' });
        b.push(lx, deckY, lz, lry);
        bolt(b, 0.59, 0.49, 0.195, -1.614, 0.9, 2.05, { roll: 1 });
        b.pop();
        // in the yard: hauling the hoist, guarding the door, forging heads, carrying, and a child pointing up
        b.figure(pulX + 0.72, hz + 0.02, { role: 'villager', pose: 'ballista_haul', ry: -Math.PI / 2, c: '#6f6a62' });
        b.figure(tcx + 1.75, z1 + 1.0, { role: 'soldier', pose: 'spear', ry: 0.25 });
        b.figure(3.5, 4.35, { role: 'smith', pose: 'hammer', ry: Math.PI / 2 - 0.25, c: '#6e5a44' });
        b.figure(-0.15, 4.55, { role: 'villager', pose: 'carry', ry: Math.PI - 0.35 });
        b.figure(1.3, 6.4, { role: 'child', pose: 'point', ry: Math.PI + 0.25, toy: false });
      });
    },
    perches: [{ x: -1.7, y: 11.93, z: -2.5, ry: 0 }, { x: 3.0, y: 9.32, z: 2.1, ry: 0.8 }, { x: 3.0, y: 9.32, z: -3.3, ry: 2.3 }]
  });
})();
