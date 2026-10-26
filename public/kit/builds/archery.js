// Archery range: a covered shooting line of stave posts under a charcoal slate roof with dragon-head finials, its open
// front to the sun and the lane; a roped lane out to three straw butts on trestles, painted on both faces so they can
// be shot from either end, and a bale backstop; a tall target mast with an iron hoop and a swinging target to shoot
// at aloft; a bow rack, quivers, and a fletcher at his table. Laid out in the range's own frame (+x
// along the shooting line, +z down the lane): the lane and its rope, the shed from its pads to the ridge, the bows, the
// butts, the mast, the fletcher's corner, and last the people.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL;
  PAL.archery_plank = ['#5b4a3c', '#544437', '#634f3f', '#4d3f33', '#5f5042'];
  PAL.archery_deck = ['#7d6a57', '#73614f', '#86725d', '#6f5d4b'];
  PAL.archery_bale = ['#cbb78a', '#c4b083', '#d0bd91'];
  function V(x, y, z) { return new T.Vector3(x, y, z); }

  // the range frame in the build: origin and turn
  var TH = 0.17, OX = -1.9, OZ = -1.15;
  function W(lx, lz) { var c = Math.cos(TH), s = Math.sin(TH); return [OX + lx * c + lz * s, OZ - lx * s + lz * c]; }
  // the island sinks its turf a little along the path; things standing near it are set down to match
  var PATH = [[-4.9, 6.9], [-3.9, 3.6], [-3.0, 0.4]];
  function sinkAt(lx, lz) {
    var w = W(lx, lz), best = 1e9;
    for (var i = 0; i < PATH.length - 1; i++) { var a = PATH[i], c = PATH[i + 1], vx = c[0] - a[0], vz = c[1] - a[1], L2 = vx * vx + vz * vz, t = Math.max(0, Math.min(1, ((w[0] - a[0]) * vx + (w[1] - a[1]) * vz) / L2)); best = Math.min(best, Math.hypot(w[0] - a[0] - vx * t, w[1] - a[1] - vz * t)); }
    var u = Math.max(0, Math.min(1, (best - 0.4) / 1.0)); return -(1 - u * u * (3 - 2 * u)) * 0.06;
  }

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
    if (o.knob) b.ball(x, y + h + 0.14, z, w * 0.42, { c: c, m: M.wood, detail: 1 });
  }
  // a rope swagged between two points
  function swag(b, a, c, sag, r) {
    var n = 5, prev = a;
    for (var i = 1; i <= n; i++) { var t = i / n, p = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (c[2] - a[2]) * t]; b.beam(prev, p, r || 0.022, { c: 'rope', m: M.rope, round: true, seg: 5 }); prev = p; }
  }
  function fwd(fx, fz, ry, lx, ly, lz) { var c = Math.cos(ry), s = Math.sin(ry); return [fx + lx * c + lz * s, ly, fz - lx * s + lz * c]; }
  function add3(a, d, k) { return [a[0] + d[0] * k, a[1] + d[1] * k, a[2] + d[2] * k]; }
  function norm3(d) { var l = Math.hypot(d[0], d[1], d[2]); return [d[0] / l, d[1] / l, d[2] / l]; }

  // an arrow from its point p along d (unit), len long: a pale shaft and two crossed vanes at the nock
  function arrow(b, p, d, len, o) {
    o = o || {};
    b.beam(p, add3(p, d, len), 0.011, { c: 'woodLight', m: M.wood, round: true, seg: 4 });
    var f0 = add3(p, d, len - 0.13), f1 = add3(p, d, len - 0.01), fc = o.fc || 'bone';
    b.beam(f0, f1, 0.026, { r2: 0.003, c: fc, m: M.cloth, bevel: 0, roll: o.roll || 0 });
    b.beam(f0, f1, 0.026, { r2: 0.003, c: fc, m: M.cloth, bevel: 0, roll: (o.roll || 0) + Math.PI / 2 });
  }
  // a straw boss bound with rope, painted on both faces in ink and bone rings round an ember eye, centred on the
  // origin and facing +z (and -z); n arrows stand in the +z face
  function boss(b, r, th, n) {
    b.cyl(0, 0, -th / 2, r, th, { rx: Math.PI / 2, c: 'straw', m: M.straw, seg: 22, flat: true });
    [0.22, 0.78].forEach(function (f) { b.addGeo(new T.TorusGeometry(r + 0.004, 0.022, 4, 26), { z: -th / 2 + th * f, c: 'rope', m: M.rope }); });
    for (var w = 0; w < 16; w++) { var a = w / 16 * Math.PI * 2 + b.j(0.15); b.box(Math.cos(a) * (r - 0.01), Math.sin(a) * (r - 0.01), th * (b.r() - 0.5) * 0.8, 0.014, 0.06 + b.r() * 0.05, 0.014, { rz: a - Math.PI / 2, c: 'straw', m: M.straw, bevel: 0, ao: 0 }); }
    var rings = [[0, r * 0.9, 'bone'], [r * 0.72, r * 0.9, 'ink'], [r * 0.38, r * 0.54, 'ink'], [0, r * 0.17, 'ink']];
    [1, -1].forEach(function (side) {
      rings.forEach(function (q, i) { var g = q[0] > 0 ? new T.RingGeometry(q[0], q[1], 36) : new T.CircleGeometry(q[1], 36); b.addGeo(g, { z: side * (th / 2 + 0.004 + i * 0.003), ry: side > 0 ? 0 : Math.PI, c: q[2], m: M.paint, ao: 0, jit: 0.01, vary: 0.03 }); });
    });
    for (var k = 0; k < n; k++) {
      var aa = b.r() * 6.28, dd = r * (0.08 + b.r() * 0.55), p = [Math.cos(aa) * dd, Math.sin(aa) * dd, th / 2 - 0.12];
      arrow(b, p, norm3([b.j(0.12), 0.1 + b.j(0.08), 1]), 0.66, { roll: b.r() * 3, fc: k === 1 ? 'inkGrey' : 'bone' });
    }
  }
  // a butt on its trestles: an A-frame to each side of the boss, a tie low between them and a bar over the top
  function buttStand(b, x, z, ry, r, cy) {
    b.push(x, 0, z, ry);
    var ap = cy + r + 0.14;
    [-1, 1].forEach(function (s) {
      [-1, 1].forEach(function (f) { b.beam([s * (r + 0.08), ap + 0.04, 0], [s * (r + 0.22), -0.04, f * 0.52], 0.045, { c: 'wood' }); });
      b.beam([s * (r + 0.18), 0.3, -0.42], [s * (r + 0.18), 0.3, 0.42], 0.032, { c: 'wood' });
      b.beam([s * (r + 0.13), cy, 0], [s * (r - 0.03), cy, 0], 0.022, { c: 'iron', m: M.metal, round: true, seg: 6 });
    });
    b.beam([-(r + 0.2), 0.3, 0], [r + 0.2, 0.3, 0], 0.035, { c: 'wood' });
    b.beam([-(r + 0.12), ap, 0], [r + 0.12, ap, 0], 0.04, { c: 'woodLight', round: true, seg: 6 });
    [-0.18, 0.18].forEach(function (d) { b.beam([d, ap - 0.02, 0], [d * 0.8, cy + r - 0.02, 0], 0.014, { c: 'rope', m: M.rope, round: true, seg: 4 }); });
    b.pop();
  }
  function buttBoss(b, x, z, ry, r, cy, n) {
    b.push(x, 0, z, ry);
    b.push(0, cy, 0, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(-0.1));
    boss(b, r, 0.3, n);
    b.pop(); b.pop();
  }
  // a flat cloth banner with a swallowtail foot, a drawn bow and arrow in bone and an ember band, facing +z
  function bowBanner(b, x, y, z, w, h, ry) {
    var wav = function (px, t) { return Math.sin(px * 2.6 + t * 2.2 + 0.7) * 0.03 * t; };
    var tOf = function (py) { return -py / h; };
    b.push(x, y, z, ry);
    var g = new T.PlaneGeometry(w, h, 4, 10), p = g.attributes.position, sway = [];
    for (var i = 0; i < p.count; i++) {
      var px = p.getX(i), py = p.getY(i) - h / 2, t = tOf(py);
      if (t > 0.84) { var k = (t - 0.84) / 0.16; py += (1 - Math.abs(px) / (w / 2)) * k * h * 0.14; }
      p.setXYZ(i, px, py, wav(px, tOf(py))); sway.push(t * t);
    }
    g.setAttribute('sway', new T.Float32BufferAttribute(sway, 1)); g.computeVertexNormals();
    b.addGeo(g, { c: 'ink', m: M.cloth, bucket: 'cloth', sway: 1, ao: 0.12, jit: 0.02, vary: 0.04 });
    var shapeGeo = function (pts, s, cx, cy) {
      var sh = new T.Shape(pts.map(function (q) { return new T.Vector2(cx + q[0] * s, cy + q[1] * s); }));
      var gg = new T.ShapeGeometry(sh), pp = gg.attributes.position;
      for (var j = 0; j < pp.count; j++) pp.setZ(j, wav(pp.getX(j), tOf(pp.getY(j))) + 0.01);
      gg.computeVertexNormals();
      return gg;
    };
    // the bow: a crescent bent toward +x, its string drawn back to the nock; the arrow laid across it
    var s = Math.min(w, h) * 0.72, cy0 = -h * 0.42, bow = [], R = 0.44, Ri = 0.38, a;
    for (a = -1.05; a <= 1.0501; a += 0.15) bow.push([-0.22 + Math.cos(a) * R, Math.sin(a) * R]);
    for (a = 1.05; a >= -1.0501; a -= 0.15) bow.push([-0.22 + Math.cos(a) * Ri * 1.04, Math.sin(a) * Ri * 1.06]);
    var tipX = -0.22 + Math.cos(1.05) * R, tipY = Math.sin(1.05) * R, nock = [-0.36, 0];
    var strip = function (a0, a1, hw) { var dx = a1[0] - a0[0], dy = a1[1] - a0[1], l = Math.hypot(dx, dy), nx = -dy / l * hw, ny = dx / l * hw; return [[a0[0] + nx, a0[1] + ny], [a1[0] + nx, a1[1] + ny], [a1[0] - nx, a1[1] - ny], [a0[0] - nx, a0[1] - ny]]; };
    [bow, strip([tipX, tipY], nock, 0.012), strip([tipX, -tipY], nock, 0.012), strip([-0.42, 0], [0.36, 0], 0.022), [[0.33, 0.07], [0.5, 0], [0.33, -0.07]], [[-0.44, 0.0], [-0.34, 0.0], [-0.28, 0.08], [-0.38, 0.08]], [[-0.44, 0.0], [-0.34, 0.0], [-0.28, -0.08], [-0.38, -0.08]]].forEach(function (pts) {
      b.addGeo(shapeGeo(pts, s, 0, cy0), { c: 'bone', m: M.cloth, bucket: 'cloth', ao: 0, jit: 0.01, vary: 0.02 });
    });
    // an ember band across the foot, following the cloth
    var gb = new T.PlaneGeometry(w, h * 0.05, 4, 1), pb = gb.attributes.position;
    for (var q = 0; q < pb.count; q++) { var by = pb.getY(q) - h * 0.76; pb.setXYZ(q, pb.getX(q), by, wav(pb.getX(q), tOf(by)) + 0.008); }
    gb.computeVertexNormals();
    b.addGeo(gb, { c: 'ember', m: M.cloth, bucket: 'cloth', ao: 0, jit: 0.01 });
    b.box(0, -0.05, 0, w + 0.04, 0.08, 0.03, { c: 'iron', m: M.metal, bevel: 0.01 });
    b.beam([-w / 2 - 0.12, 0.02, 0], [w / 2 + 0.12, 0.02, 0], 0.03, { c: 'woodDark', round: true, seg: 6 });
    b.pop();
  }

  // a bale bound with two bands of twine
  function bale(b, x, y, z, ry, w) {
    w = w || 1.1; b.box(x, y, z, w, 0.55, 0.7, { c: 'archery_bale', m: M.straw, bevel: 0.1, ry: ry });
    [-0.28, 0.28].forEach(function (f) { var p = fwd(x, z, ry, f * w, 0, 0); b.box(p[0], y - 0.005, p[2], 0.035, 0.565, 0.715, { ry: ry, c: '#8c7550', m: M.rope, bevel: 0.01, ao: 0 }); });
  }

  // sitting on a low stool working at a table, head bent to the work
  // an archer at full draw with the face showing: a bare-headed figure in the kit's draw pose, and the bow, the nocked
  // arrow and a back quiver laid in the same figure space the pose uses (the pose's hands are reached exactly)
  function drawArcher(b, x, y, z, ry, o) {
    b.figure(x, z, { role: 'villager', pose: 'draw', ry: ry, y: y, c: o.c, hair: o.hair, beard: o.beard });
    var P0 = KIT.people.poses.draw(function () { return 0; }), Rh = P0.hands[0], Lh = P0.hands[1];
    var f = Lh.clone().sub(Rh).setY(0).normalize(), g0 = Lh.clone().addScaledVector(f, -0.2), tip = Lh.clone().addScaledVector(f, 0.2);
    b.push(x, y, z, ry);
    b.bow(g0.x, g0.y, g0.z, { tier: o.tier || 1, ry: Math.atan2(f.x, f.z) - Math.PI / 2, h: 1.5 });
    b.beam(Rh.toArray(), tip.toArray(), 0.011, { round: true, seg: 4, c: 'woodLight', m: M.wood });
    b.beam(Rh.clone().addScaledVector(f, 0.02).toArray(), Rh.clone().addScaledVector(f, 0.13).toArray(), 0.026, { r2: 0.003, c: 'bone', m: M.cloth, bevel: 0 });
    // the quiver slung on the back, following the torso's turn
    var Q = new T.Quaternion().setFromEuler(new T.Euler(P0.lean, P0.twist, P0.side, 'YXZ'));
    b.push(P0.hip, 0.92 - P0.drop, 0, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationFromQuaternion(Q));
    b.push(0.08, 0.05, -0.21, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(-0.45));
    b.cyl(0, 0, 0, 0.07, 0.55, { c: '#5a3f2b', m: M.wood, seg: 8 });
    for (var a = 0; a < 5; a++) { var ax = (a - 2) * 0.022; b.cyl(ax, 0.55, b.j(0.02), 0.008, 0.18, { c: 'woodLight', m: M.wood, seg: 4 }); b.box(ax, 0.66, b.j(0.02), 0.04, 0.08, 0.005, { c: '#e9e2cf', m: M.cloth, bevel: 0 }); }
    b.pop(); b.pop();
    b.pop();
  }

  KIT.people.poses.archery_sit = function (r) { return { feet: [V(-0.16, 0.09, 0.36), V(0.15, 0.09, 0.42)], hands: [V(-0.15, 0.84, 0.42), V(0.14, 0.86, 0.45)], lean: 0.14, twist: 0, side: 0, hip: 0, drop: 0.45, head: [0.1, 0.35], pole: [V(-1, -0.6, -0.2), V(1, -0.6, -0.2)] }; };

  // the plan in range coordinates: the shed behind the line (z < 0), the lane out along +z
  var SL = 5.1, SD = 2.6, EAVE = 3.4, RISE = 1.5, DECK = 0.3;
  var PX = [0.15, 1.75, 3.35, 4.95], PZ = [-0.12, -SD + 0.12];
  var TG = [{ x: 1.3, z: 3.2, n: 3 }, { x: 2.6, z: 4.6, n: 2 }, { x: 3.8, z: 6.0, n: 4 }];
  var ARCH = [{ x: 0.95, c: '#d9d2c3', t: 0, hair: '#3a2a1e' }, { x: 2.55, c: '#8a857c', t: 1, hair: '#b08a5a' }, { x: 4.15, c: '#cfc6b3', t: 2, hair: '#5a3c26', beard: true }];
  var AZ = -0.2;
  // each butt faces its archer, eased a little toward the open lawn so the painted rings show on both sides
  TG.forEach(function (t, i) { var a = ARCH[i]; t.ry = Math.atan2(a.x - t.x, AZ - t.z) - 0.35; });
  var MX = 6.0, MZ = 5.4, MH = 5.7, MRY = -0.79, RX = -0.9;
  var FX = -3.3, FZ = 2.2, FRY = -0.79;

  KIT.defineBuild('archery', {
    name: 'Archery range', size: 'small', need: 24,
    line: 'Archers at full draw on a covered shooting line under a slate roof, a roped lane out to straw butts, and a tall mast hung with an iron hoop and a swinging target.',
    r: 8.2, flat: [13.5, 13], ground: 'grass', path: PATH,
    frameY: 1.5, frameR: 7.7, glowAt: [W(SL / 2, -SD / 2)[0], EAVE + RISE + 0.35, W(SL / 2, -SD / 2)[1]],
    trees: [{ x: -5.7, z: -3.3, kind: 'pine', h: 6.6 }, { x: -2.2, z: -6.4, kind: 'pine', h: 5.6 }, { x: 6.0, z: -2.8, kind: 'birch', h: 5.4 }],
    bushes: [{ x: 5.9, z: 0.9, r: 0.65, flowers: '#f3f1ec' }, { x: -6.0, z: 1.2, r: 0.7 }, { x: 1.6, z: -6.2, r: 0.7 }],
    build: function (b) {
      b.push(OX, 0, OZ, TH);

      b.part('Lane');
      b.unit(function () {
        // the turf worn where the archers walk out to pull their arrows, tufts along the lane
        TG.forEach(function (tg) { var f = fwd(tg.x, tg.z, tg.ry, 0.1, 0, 0.8); b.cyl(f[0], -0.03, f[2], 0.42, 0.034, { c: '#9c8c72', m: M.dirt, seg: 12, flat: true, sx: 1.4, jit: 0.02 }); });
        for (var i = 0; i < 6; i++) b.cyl(-0.35 + b.j(0.12), -0.03, 0.9 + i * 1.05, 0.22 + b.r() * 0.08, 0.034, { c: '#a3937a', m: M.dirt, seg: 10, flat: true, sx: 1.3, jit: 0.03 });
        for (var g = 0; g < 18; g++) b.grass(-0.6 + b.r() * 5.0, 0, 0.7 + b.r() * 6.0, 0.16 + b.r() * 0.1);
      });
      var RS = [0.95, 1.7, 2.45, 3.2, 3.9, 4.6, 5.3, 6.0, 6.7], MK = { '3.2': 1, '4.6': 2, '6': 3 };
      [[0, 5], [4, 9]].forEach(function (rg) {
        b.unit(function () {
          for (var i = rg[0]; i < rg[1]; i++) {
            var z = RS[i], m = MK[String(z)];
            if (m) {
              // the distance posts: taller, banded in ink and bone, one bone ring for each mark
              stave(b, RX, -0.1, z, 1.15, 0.13, { c: 'woodDark' });
              for (var k = 0; k < m; k++) b.cyl(RX, 0.62 + k * 0.12, z, 0.085, 0.06, { c: 'bone', m: M.paint, seg: 8 });
              b.cyl(RX, 0.98, z, 0.085, 0.1, { c: 'ink', m: M.paint, seg: 8 });
            } else stave(b, RX, -0.1, z, 0.9 + b.j(0.03), 0.1, { c: 'wood', knob: true });
            if (i > rg[0]) swag(b, [RX, 0.72, RS[i - 1]], [RX, 0.72, z], 0.1, 0.018);
          }
        });
      });
      b.unit(function () {
        // a banner on a pole at the head of the lane: the drawn bow in bone on ink, an ember band
        var bx = -1.05, bz = 0.35;
        stave(b, bx, 0, bz, 3.5, 0.14, { c: 'woodDark', knob: true });
        b.beam([bx, 3.28, bz], [bx - 0.98, 3.28, bz], 0.04, { c: 'woodDark' });
        b.beam([bx, 2.85, bz], [bx - 0.5, 3.26, bz], 0.03, { c: 'woodDark' });
        bowBanner(b, bx - 0.56, 3.22, bz, 0.68, 1.25, 0);
      });

      b.part('Shooting shed');
      b.unit(function () {
        PX.forEach(function (x) { PZ.forEach(function (z) { b.box(x, -0.05, z, 0.42, 0.18, 0.42, { c: b.stoneC('stoneDark'), m: M.stone, bevel: 0.05 }); }); });
        [-0.55, -1.3, -2.05].forEach(function (z) { [0.55, SL / 2, SL - 0.55].forEach(function (x) { b.box(x + b.j(0.1), -0.03, z, 0.26, 0.12, 0.24, { c: b.stoneC('stone'), m: M.stone, bevel: 0.04, ry: b.j(0.3) }); }); });
      });
      b.unit(function () { [-0.55, -1.3, -2.05].forEach(function (z) { b.beam([0.02, 0.16, z], [SL - 0.02, 0.16, z], 0.07, { c: 'wood' }); }); });
      var NP = Math.round(SL / 0.23), pw = SL / NP;
      [[0, Math.ceil(NP / 2)], [Math.ceil(NP / 2), NP]].forEach(function (rg, h) {
        b.unit(function () {
          for (var i = rg[0]; i < rg[1]; i++) {
            var xc = (i + 0.5) * pw, notch = PX.some(function (px) { return Math.abs(xc - px) < 0.11 + pw / 2 - 0.01; });
            var z0 = notch ? -SD + 0.27 : -SD, z1 = notch ? -0.27 : 0;
            b.box(xc, 0.24, (z0 + z1) / 2, pw - 0.016, 0.06, z1 - z0 - 0.01, { c: b.pick(PAL.archery_deck), m: M.wood, bevel: 0.012, ry: b.j(0.006) });
          }
          if (h === 1) {
            // a dark sill along the front edge: the shooting line itself
            b.box(SL / 2, 0.1, 0.02, SL + 0.04, 0.21, 0.05, { c: 'woodDark', m: M.wood, bevel: 0.01 });
            // a split-log step up at the open end
            b.box(-0.24, 0, -1.0, 0.4, 0.15, 1.0, { c: 'wood', m: M.wood, bevel: 0.05 });
          }
        });
      });
      [[0, 2], [2, 4]].forEach(function (rg) {
        b.unit(function () { for (var i = rg[0]; i < rg[1]; i++) PZ.forEach(function (z) { stave(b, PX[i], 0.12, z, EAVE - 0.12, 0.2, { cap: false }); }); });
      });
      b.unit(function () {
        PZ.forEach(function (z) { b.beam([-0.08, EAVE - 0.1, z], [SL + 0.08, EAVE - 0.1, z], 0.1, { c: 'beam' }); });
        PX.forEach(function (x) { b.beam([x, EAVE - 0.1, 0.0], [x, EAVE - 0.1, -SD], 0.09, { c: 'beam' }); });
      });
      b.unit(function () {
        // knee braces under both plates, a king post in each gable
        PX.forEach(function (x, i) { PZ.forEach(function (z) { [-1, 1].forEach(function (s) { if ((i === 0 && s < 0) || (i === 3 && s > 0)) return; b.beam([x, EAVE - 0.78, z], [x + s * 0.58, EAVE - 0.18, z], 0.05, { c: 'beam' }); }); }); });
        [PX[0], PX[3]].forEach(function (x) { b.beam([x, EAVE, -SD / 2], [x, EAVE + RISE - 0.12, -SD / 2], 0.07, { c: 'beam' }); });
      });
      b.unit(function () {
        // the back boarded up to the plate, the first two bays
        for (var i = 0; i < 2; i++) { var cx = (PX[i] + PX[i + 1]) / 2; b.planks(cx, DECK, PZ[1], PX[i + 1] - PX[i] - 0.2, EAVE - DECK - 0.2, { vertical: true, c: 'archery_plank', pw: 0.24, t: 0.06 }); }
      });
      b.unit(function () {
        var cx = (PX[2] + PX[3]) / 2; b.planks(cx, DECK, PZ[1], PX[3] - PX[2] - 0.2, EAVE - DECK - 0.2, { vertical: true, c: 'archery_plank', pw: 0.24, t: 0.06 });
        // and a low parapet across the far end, open above to the sun
        b.planks(PX[3], DECK, -SD / 2, SD - 0.44, 0.85, { vertical: true, ry: Math.PI / 2, c: 'archery_plank', pw: 0.24, t: 0.06 });
        b.box(PX[3], DECK + 0.85, -SD / 2, 0.14, 0.08, SD - 0.42, { c: 'wood', m: M.wood, bevel: 0.02 });
      });
      b.unit(function () {
        // the gables boarded above the tie beams, a shield on the open end's
        [PX[0], PX[3]].forEach(function (x) { for (var t = -SD / 2 + 0.13; t < SD / 2; t += 0.24) { if (Math.abs(t) < 0.06) continue; var hh = (RISE - 0.16) * (1 - Math.abs(t) / (SD / 2 + 0.05)); if (hh < 0.08) continue; b.box(x + (x < 1 ? -0.07 : 0.07), EAVE, -SD / 2 + t, 0.05, hh, 0.22, { c: b.pick(PAL.archery_plank), m: M.wood, bevel: 0.01 }); } });
        vShield(b, PX[0] - 0.1, EAVE + 0.55, -SD / 2, -Math.PI / 2, 0.36, 'quarter', 'bone', 'ink');
      });
      b.gableRoof(SL / 2, EAVE, -SD / 2, SL, SD, RISE, { m: 'slate', over: 0.35, overX: 0.45, rows: 8, ridge: false, pitch: 0.32 });
      b.unit(function () {
        var L = SL + 0.9, over = 0.35, sl = Math.atan2(RISE, SD / 2), drop = over * Math.tan(sl);
        b.beam([SL / 2 - L / 2 - 0.05, EAVE + RISE + 0.08, -SD / 2], [SL / 2 + L / 2 + 0.05, EAVE + RISE + 0.08, -SD / 2], 0.12, { c: 'beam', round: true, seg: 8 });
        [-1, 1].forEach(function (e) {
          var x = SL / 2 + e * (L / 2 - 0.04);
          [-1, 1].forEach(function (s) { var zz = -SD / 2 + s * (SD / 2 + over), y0b = EAVE - drop - 0.06, dz = -s * (SD / 2 + over), dy = RISE + drop; b.beam([x, y0b, zz], [x, y0b + dy * 1.22, zz + dz * 1.22], 0.07, { c: 'beam', r2: 0.05 }); });
          dragonHead(b, x + e * 0.02, EAVE + RISE + 0.12, -SD / 2, e > 0 ? 0 : Math.PI, 1.05);
        });
      });
      b.unit(function () {
        // torches on the front posts at each end, bone marks on the deck where each archer toes the line
        [PX[0], PX[3]].forEach(function (x) { b.torch(x, 1.95, PZ[0] + 0.12, { s: 0.55, ry: 0 }); });
        ARCH.forEach(function (a) { [-0.16, 0.16].forEach(function (d) { b.box(a.x + d, DECK, -0.12, 0.05, 0.008, 0.16, { c: 'bone', m: M.paint, bevel: 0, ao: 0 }); }); });
      });

      b.part('Bows and quivers');
      b.unit(function () {
        // a rack on the back wall of the first bay: a rail, bows stood against it
        var zw = PZ[1] + 0.04;
        b.beam([PX[0] + 0.12, DECK + 1.45, zw + 0.06], [PX[1] - 0.12, DECK + 1.45, zw + 0.06], 0.045, { c: 'woodLight' });
        b.beam([PX[0] + 0.12, DECK + 0.05, zw + 0.42], [PX[1] - 0.12, DECK + 0.05, zw + 0.42], 0.04, { c: 'wood' });
        var tiers = [1, 2, 1, 0, 2, 1];
        for (var i = 0; i < 6; i++) {
          var x = PX[0] + 0.34 + i * 0.22;
          b.push(x, DECK + 0.78, zw + 0.24, -Math.PI / 2); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(0.15));
          b.bow(0, 0, 0, { tier: tiers[i], h: 1.46 });
          b.pop();
        }
      });
      b.unit(function () {
        // quivers hung on pegs and round shields along the back wall of the other bays
        var zw = PZ[1] + 0.04;
        [PX[1] + 0.35, PX[1] + 0.75].forEach(function (x, i) { b.beam([x, DECK + 1.75, zw], [x, DECK + 1.75, zw + 0.16], 0.02, { c: 'wood', round: true, seg: 5 }); b.push(x, DECK + 1.05, zw + 0.14, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(-0.08)); b.quiver(0, 0, 0, { ry: i ? 0.4 : -0.3 }); b.pop(); });
        vShield(b, PX[1] + 1.25, DECK + 1.5, zw, 0, 0.34, 'half', 'ink', 'bone');
        vShield(b, (PX[2] + PX[3]) / 2 - 0.3, DECK + 1.55, zw, 0, 0.34, 'ring', 'bone', 'ink');
        vShield(b, (PX[2] + PX[3]) / 2 + 0.45, DECK + 1.5, zw, 0, 0.32, 'cross', 'ink', 'bone');
      });
      b.unit(function () {
        // a barrel of arrows in the last bay, a bench along the back of the middle one
        var bx = PX[3] - 0.5, bz = PZ[1] + 0.55;
        b.barrel(bx, DECK, bz, { h: 0.7, r: 0.26 });
        for (var k = 0; k < 9; k++) { var a = k / 9 * 6.28, d = 0.05 + (k % 3) * 0.05; arrow(b, [bx + Math.cos(a) * d, DECK + 0.25, bz + Math.sin(a) * d], norm3([Math.cos(a) * 0.12, 1, Math.sin(a) * 0.12]), 0.78, {}); }
        b.push(0, DECK, 0, 0); b.bench((PX[1] + PX[2]) / 2, PZ[1] + 0.4, 1.3, {}); b.pop();
        b.quiver((PX[1] + PX[2]) / 2 - 0.3, DECK + 0.49, PZ[1] + 0.4, { ry: 1.2 });
      });
      b.unit(function () {
        // a quiver stood by each archer on the line
        ARCH.forEach(function (a, i) { b.quiver(a.x + 0.42, DECK, AZ - 0.32, { ry: 2.6 + i * 0.4 }); });
      });

      b.part('Butts');
      TG.forEach(function (tg) {
        b.unit(function () { buttStand(b, tg.x, tg.z, tg.ry, 0.52, 1.22); });
        b.unit(function () { buttBoss(b, tg.x, tg.z, tg.ry, 0.52, 1.22, tg.n); });
      });
      var t3 = TG[2], bk = fwd(t3.x, t3.z, t3.ry, 0, 0, -1.35);
      b.unit(function () {
        // a bale wall behind the far butt
        b.push(bk[0], 0, bk[2], t3.ry);
        [-1.15, 0, 1.15].forEach(function (x) { bale(b, x, 0, 0, b.j(0.04)); });
        b.pop();
      });
      b.unit(function () {
        b.push(bk[0], 0, bk[2], t3.ry);
        bale(b, -0.58, 0.55, 0, b.j(0.05), 1.05); bale(b, 0.5, 0.55, 0.02, b.j(0.05), 0.95);
        [-1.8, 1.8].forEach(function (x) { b.post(x, -0.1, -0.1, 0.05, 1.25, { c: 'wood' }); });
        b.beam([-1.8, 1.0, -0.42], [1.8, 1.0, -0.42], 0.016, { c: 'rope', m: M.rope, round: true, seg: 4 });
        b.pop();
      });
      b.unit(function () {
        // the ones that went wide, standing in the turf past the butts
        [[0.2, 4.0], [2.0, 3.8], [3.4, 5.3], [1.5, 5.8], [4.6, 6.8], [2.6, 6.6]].forEach(function (q, i) { arrow(b, [q[0], -0.12, q[1]], norm3([b.j(0.2), 0.42, -0.9]), 0.62, { roll: i }); });
        for (var g = 0; g < 12; g++) { var t = TG[g % 3]; b.grass(t.x + b.j(0.9), 0, t.z + b.j(0.5) + 0.2, 0.18 + b.r() * 0.1); }
      });

      b.part('Target mast');
      b.unit(function () {
        b.lathe(MX, -0.06, MZ, [[0.95, 0], [0.9, 0.18], [0.62, 0.36], [0.32, 0.42]], { c: 'stoneDark', m: M.stone, seg: 9, flat: true });
        for (var k = 0; k < 7; k++) { var a = k / 7 * 6.28 + 0.3; b.rock(MX + Math.cos(a) * 0.9, 0.02, MZ + Math.sin(a) * 0.9, 0.24 + b.r() * 0.1); }
        b.log(MX, 0.3, MZ, 0.18, MH - 0.3, { c: 'woodDark', seg: 9, r2: 0.15 });
        [0.75, 2.6, MH - 1.3].forEach(function (y) { b.cyl(MX, y, MZ, 0.19, 0.1, { c: 'iron', m: M.metal, seg: 10 }); });
      });
      b.unit(function () {
        // three raking struts footed in stones
        [-0.4, 1.7, 3.8].forEach(function (a) { var fx = MX + Math.cos(a) * 1.5, fz = MZ + Math.sin(a) * 1.5; b.beam([MX + Math.cos(a) * 0.12, 2.3, MZ + Math.sin(a) * 0.12], [fx, 0.05, fz], 0.07, { c: 'beam' }); b.box(fx, -0.05, fz, 0.34, 0.16, 0.34, { c: b.stoneC('stone'), m: M.stone, bevel: 0.04, ry: a }); });
      });
      b.unit(function () {
        // climbing pegs up the near side, a shield on the mast
        for (var k = 0; k < 11; k++) { var y = 0.9 + k * 0.42, a = MRY + (k % 2 ? 0.5 : -0.5), d = [Math.sin(a), 0, Math.cos(a)]; b.beam([MX + d[0] * 0.1, y, MZ + d[2] * 0.1], [MX + d[0] * 0.42, y + 0.04, MZ + d[2] * 0.42], 0.03, { c: 'woodLight', round: true, seg: 5 }); }
        var sp = fwd(MX, MZ, MRY + 1.0, 0, 0, 0.17);
        vShield(b, sp[0], 1.55, sp[2], MRY + 1.0, 0.36, 'cross', 'ink', 'bone');
      });
      b.unit(function () {
        // the arm the targets hang from, a brace under it, a head on its end looking out
        b.push(MX, 0, MZ, MRY);
        b.beam([-0.15, 4.5, 0], [2.15, 4.5, 0], 0.08, { c: 'beam' });
        b.beam([0.12, 3.55, 0], [1.0, 4.44, 0], 0.055, { c: 'beam' });
        dragonHead(b, 2.12, 4.52, 0, 0, 0.8);
        b.pop();
      });
      b.unit(function () {
        b.push(MX, 0, MZ, MRY);
        // an iron hoop to shoot through and a small boss that swings in the wind
        [-0.16, 0.16].forEach(function (d) { b.beam([0.85 + d, 4.42, 0], [0.85 + d * 2.4, 3.88, 0], 0.012, { c: 'rope', m: M.rope, round: true, seg: 4 }); });
        b.addGeo(new T.TorusGeometry(0.42, 0.03, 5, 28), { x: 0.85, y: 3.46, z: 0, c: 'iron', m: M.metal });
        for (var k = 0; k < 6; k++) { var a = k / 6 * 6.28; b.box(0.85 + Math.cos(a) * 0.42, 3.46 + Math.sin(a) * 0.42, 0, 0.05, 0.07, 0.065, { rz: a, c: 'bone', m: M.cloth, bevel: 0 }); }
        b.beam([1.75, 4.42, 0], [1.75, 3.55, 0], 0.012, { c: 'rope', m: M.rope, round: true, seg: 4 });
        b.push(1.75, 3.22, 0, 0.7); boss(b, 0.32, 0.18, 2); b.pop();
        b.pop();
      });
      b.unit(function () {
        // the crow's nest on top: a ring of planks on brackets, an ember pennant
        b.cyl(MX, MH, MZ, 0.78, 0.1, { c: 'wood', m: M.wood, seg: 12, flat: true });
        for (var k = 0; k < 6; k++) { var a = k / 6 * 6.28; b.beam([MX + Math.cos(a) * 0.15, MH - 0.75, MZ + Math.sin(a) * 0.15], [MX + Math.cos(a) * 0.65, MH - 0.02, MZ + Math.sin(a) * 0.65], 0.04, { c: 'beam' }); }
        b.addGeo(new T.TorusGeometry(0.76, 0.06, 5, 16), { x: MX, y: MH + 0.11, z: MZ, rx: Math.PI / 2, c: 'woodDark', m: M.wood });
        for (var c = 0; c < 10; c++) { var a2 = c / 10 * 6.28 + 0.2; b.box(MX + Math.cos(a2) * 0.55, MH + 0.1, MZ + Math.sin(a2) * 0.55, 0.05, 0.015, 0.2, { ry: -a2 + 0.6, c: '#5a4a3c', m: M.wood, bevel: 0, ao: 0 }); }
        var fp = fwd(MX, MZ, MRY, -0.6, 0, -0.25);
        b.flag(fp[0], MH + 0.1, fp[2], 1.2, 0.85, 0.32, { c: 'ember', pennant: true, pr: 0.03, ry: MRY + 0.4 });
      });

      b.part('Fletcher’s table');
      b.unit(function () {
        b.table(FX, FZ, 1.4, 0.7, { ry: FRY });
        var st = fwd(FX, FZ, FRY, 0, 0, -0.56);
        b.log(st[0], 0, st[2], 0.19, 0.45, { c: 'wood', seg: 8 });
      });
      b.unit(function () {
        b.push(FX, 0.81, FZ, FRY);
        // shafts in a bundle, feathers in a heap, a glue pot, finished arrows laid in a row
        for (var k = 0; k < 7; k++) b.beam([-0.62, 0.012 + (k % 2) * 0.02, 0.12 + k * 0.025], [-0.02, 0.012 + (k % 2) * 0.02, 0.12 + k * 0.025], 0.011, { c: 'woodLight', round: true, seg: 4 });
        b.cyl(-0.32, 0, 0.2, 0.08, 0.05, { c: 'rope', m: M.rope, seg: 8, rz: Math.PI / 2, open: true });
        for (var f = 0; f < 10; f++) b.box(0.2 + b.j(0.08), 0, -0.15 + b.j(0.06), 0.03, 0.012, 0.1, { ry: b.r() * 3, c: f % 4 ? 'bone' : 'inkGrey', m: M.cloth, bevel: 0, ao: 0 });
        b.lathe(0.45, 0, 0.05, [[0.01, 0], [0.07, 0], [0.08, 0.08], [0.06, 0.11], [0.01, 0.11]], { c: '#4a3424', m: M.wood, seg: 10 });
        for (var a = 0; a < 4; a++) arrow(b, [0.05 + a * 0.012, 0.015, 0.32 - a * 0.05], [1, 0, 0.02], 0.6, { roll: 0.8 });
        b.pop();
      });
      b.unit(function () {
        var p = fwd(FX, FZ, FRY, 1.2, 0, -0.35), c = fwd(FX, FZ, FRY, -1.35, 0, -0.5), h = fwd(FX, FZ, FRY, 0.4, 0, -1.25);
        b.barrel(p[0], 0, p[2], { h: 0.85, r: 0.3 });
        for (var k = 0; k < 10; k++) { var a = k / 10 * 6.28, d = 0.06 + (k % 3) * 0.06; arrow(b, [p[0] + Math.cos(a) * d, 0.5, p[2] + Math.sin(a) * d], norm3([Math.cos(a) * 0.1, 1, Math.sin(a) * 0.1]), 0.75, {}); }
        b.crate(c[0], 0, c[2], 0.62, { ry: FRY + 0.3 });
        bale(b, h[0], sinkAt(h[0], h[2]), h[2], FRY + 0.2, 1.0);
        // bowstaves seasoning against the near post
        for (var s = 0; s < 4; s++) b.beam([-0.62 - s * 0.05, 0.0, -0.32 - s * 0.12], [0.02, 1.72 - s * 0.06, -0.18 - s * 0.05], 0.025, { c: s % 2 ? 'woodLight' : 'wood', round: true, seg: 5, r2: 0.017 });
      });
      var CX = -2.0, CZ = 5.6, CRY = Math.PI - 0.25;
      b.unit(function () { b.cart(CX, CZ, { ry: CRY }); });
      b.unit(function () {
        // the cart's load: bales for the backstop, a sheaf of new shafts, a spare boss
        b.push(CX, 0, CZ, CRY);
        bale(b, 0.0, 0.77, -0.5, 0.02, 1.15); bale(b, 0.0, 0.77, 0.25, -0.03, 1.15);
        for (var k = 0; k < 8; k++) b.beam([-0.47 + (k % 4) * 0.035, 1.34 + Math.floor(k / 4) * 0.03, -0.8], [-0.47 + (k % 4) * 0.035, 1.34 + Math.floor(k / 4) * 0.03, 0.62], 0.016, { c: 'woodLight', round: true, seg: 4 });
        b.ropeCoil(-0.3, 1.31, 0.42, 0.13);
        b.push(0.16, 1.32 + 0.13, -0.15, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(-Math.PI / 2)); boss(b, 0.38, 0.26, 0); b.pop();
        b.pop();
      });
      b.unit(function () {
        // a water butt and bucket by the step, white flowers at the posts, tufts along the footings
        b.barrel(-0.55, 0, -2.25, { h: 0.95, r: 0.34 }); b.cyl(-0.55, 0.93, -2.25, 0.28, 0.02, { c: '#5f7680', m: M.water, seg: 14 });
        b.bucket(-0.75, 0, -1.65);
        for (var g = 0; g < 14; g++) b.grass(-0.3 + b.r() * 5.6, 0, 0.15 + b.r() * 0.35, 0.15 + b.r() * 0.1);
        [[PX[0] - 0.25, 0.25], [PX[3] + 0.3, 0.2], [SL + 0.45, -1.2]].forEach(function (q) { b.flowers(q[0], -0.06, q[1], 0.25, { n: 7, c: '#f3f1ec' }); });
      });

      b.life(function () {
        ARCH.forEach(function (a) {
          var tg = TG[a.t], ry = Math.atan2(tg.x - a.x, tg.z - AZ) - 0.25;
          drawArcher(b, a.x, DECK, AZ, ry, { c: a.c, hair: a.hair, beard: a.beard, tier: a.t === 1 ? 2 : 1 });
        });
        // the master at the far end of the line, turned to watch his archers
        b.figure(5.6, 0.4, { role: 'villager', pose: 'point', ry: -1.28, beard: true, c: '#5c5e62', cape: 'ink' });
        // the fletcher at his table with a boy at his elbow, a woman bringing new arrows from the table
        var fs = fwd(FX, FZ, FRY, 0, 0, -0.58);
        b.figure(fs[0], fs[2], { role: 'villager', pose: 'archery_sit', ry: FRY, beard: true, c: '#6f6a62', y: sinkAt(fs[0], fs[2]) });
        var cp = fwd(FX, FZ, FRY, -0.95, 0, 0.12);
        b.figure(cp[0], cp[2], { role: 'child', pose: 'talk', ry: FRY + Math.PI / 2, toy: false, y: sinkAt(cp[0], cp[2]) });
        var wx = -2.0, wz = -0.3, wry = -0.64;
        b.figure(wx, wz, { role: 'villager', pose: 'walk', ry: wry, c: '#8a857c', y: sinkAt(wx, wz) });
        var hp = fwd(wx, wz, wry, 0.25, 0.93 + sinkAt(wx, wz), 0.24);
        for (var k = 0; k < 5; k++) arrow(b, [hp[0] + b.j(0.03), hp[1] - 0.3, hp[2] + b.j(0.03)], norm3([b.j(0.08), 1, 0.3]), 0.72, { roll: k });
      });
      b.pop();
    }
  });
})();
