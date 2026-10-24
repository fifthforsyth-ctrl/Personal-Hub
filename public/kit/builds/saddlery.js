// Saddle and fin workshop: an open timber workshop on a plank floor under a dark shingle roof, a carved cross gable over
// the big work table with a fin painted on its shield, a stone back wall hung with spare tail fins and harness, a forge
// wing with a stone gable and a tall chimney at one end, saddles on sawhorse stands, hides laced on frames in the yard and rope
// coils everywhere; in the yard a saddled night dragon stands to be fitted while its rider waits at its head.
// Built footings first, the floor plank by plank, the walls course by course, the frame post by post, the roofs row by
// row, the chimney course by course, then the fittings, last the dragon and the people.
(function () {
  var T = THREE;
  function V(x, y, z) { return new T.Vector3(x, y, z); }

  // poses: bent over a job at a bench, and reaching up to a saddle on a dragon's back
  if (KIT.people && KIT.people.poses) {
    KIT.people.poses.saddleryWork = function (r) { return { feet: [V(-0.15, 0.09, 0.06), V(0.15, 0.09, -0.04)], hands: [V(-0.17, 0.98, 0.44), V(0.19, 0.96, 0.4)], lean: 0.34, twist: r(0.08), side: 0, hip: 0, drop: 0.03, head: [r(0.15), 0.45], pole: [V(-0.7, -0.5, -0.3), V(0.7, -0.5, -0.3)] }; };
    KIT.people.poses.saddleryReach = function (r) { return { feet: [V(-0.14, 0.09, 0.06), V(0.15, 0.09, -0.06)], hands: [V(-0.2, 1.3, 0.46), V(0.22, 1.42, 0.4)], lean: 0.06, twist: 0.1, side: 0.02, hip: 0, drop: 0.0, head: [0.15, -0.12], pole: [V(-0.7, -0.5, -0.3), V(0.7, -0.5, -0.3)] }; };
  }
  // a point in the build's frame turned into a dragon's own frame (for o.look)
  function saddleryLook(dx, dy, dz, ry, s, wx, wy, wz) {
    var x = wx - dx, y = wy - dy, z = wz - dz, c = Math.cos(-ry), sn = Math.sin(-ry);
    return [(x * c + z * sn) / s, y / s, (-x * sn + z * c) / s];
  }
  // a point in a dragon's (or a figure's) own frame at (x, z) turned ry, back in the build's frame
  function saddleryBy(x, z, ry, lx, lz) { return [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)]; }

  // a carved dragon-head finial, the profile in the local XY plane, snout toward local +x, neck foot at (x, y, z)
  function saddleryFinial(b, x, y, z, ry, s, o) {
    o = o || {}; var M = KIT.M, c = o.c || 'beam';
    var P = [[-0.1, 0], [-0.17, 0.28], [-0.15, 0.52], [-0.07, 0.74], [0.04, 0.9], [-0.04, 1.14], [0.14, 1.0], [0.24, 1.06], [0.36, 1.05], [0.5, 1.0], [0.74, 0.95],
      [0.85, 0.9], [0.8, 0.86], [0.6, 0.85], [0.42, 0.82], [0.62, 0.76], [0.71, 0.7], [0.64, 0.67], [0.4, 0.66], [0.22, 0.6], [0.12, 0.45], [0.09, 0.22], [0.12, 0]];
    b.push(x, y, z, ry);
    if (o.rz) b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(o.rz));
    b.extrude(0, 0, 0, P.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.14 * s, { c: c, m: M.wood, ao: 0.1, bevel: 0.01 });
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

  // a curved band (an arc between radii r1 and r2, angles a0..a1 in the XY plane) run len along z
  function saddleryArc(b, x, y, z, r1, r2, a0, a1, len, o) {
    var sh = new T.Shape(), n = 12, i, a;
    for (i = 0; i <= n; i++) { a = a0 + (a1 - a0) * i / n; if (i === 0) sh.moveTo(Math.cos(a) * r2, Math.sin(a) * r2); else sh.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); }
    for (i = n; i >= 0; i--) { a = a0 + (a1 - a0) * i / n; sh.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); }
    var g = new T.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false, curveSegments: 1 }); g.translate(0, 0, -len / 2); g.deleteAttribute('uv');
    g.computeVertexNormals();
    return b.addGeo(g, Object.assign({ m: KIT.M.wood }, o, { x: x, y: y, z: z }));
  }
  // a dragon saddle sitting on a rounded back whose top is at (x, y, z), radius R, length along local z (front +z):
  // a bone-white blanket, the leather seat with a raised cantle and a pommel with iron grab handles, flaps down each
  // side, stirrups on straps and a girth hanging free
  function saddlerySaddle(b, x, y, z, o) {
    o = o || {}; var M = KIT.M, R = o.R || 0.22, lc = o.c || '#2a211b', lc2 = o.c2 || '#45352a', iron = '#8f8a80', drop = o.drop === undefined ? 1 : o.drop;
    b.push(x, y - R, z, o.ry || 0);
    if (o.blanket !== false) saddleryArc(b, 0, 0, 0, R, R + 0.022, 0.12, Math.PI - 0.12, 0.84, { c: o.blanket || '#e9e4da', m: M.cloth, ao: 0.15 });
    saddleryArc(b, 0, 0, 0, R + 0.02, R + 0.075, 0.5, Math.PI - 0.5, 0.62, { c: lc, m: M.wood, ao: 0.2 });
    saddleryArc(b, 0, 0, 0.02, R + 0.07, R + 0.1, 1.0, Math.PI - 1.0, 0.36, { c: lc2, m: M.wood, ao: 0.2 });
    saddleryArc(b, 0, 0, -0.28, R + 0.06, R + 0.22, 1.08, Math.PI - 1.08, 0.07, { c: lc, m: M.wood, ao: 0.1, rx: -0.15 });
    saddleryArc(b, 0, 0, 0.29, R + 0.06, R + 0.14, 1.2, Math.PI - 1.2, 0.08, { c: lc2, m: M.wood, ao: 0.1, rx: 0.1 });
    [-1, 1].forEach(function (sd) {
      var a = sd > 0 ? 0.5 : Math.PI - 0.5, ex = Math.cos(a) * (R + 0.05), ey = Math.sin(a) * (R + 0.05);
      // the flap, tilted out at the foot, edged with rivets
      b.push(ex, ey, 0.0, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(sd * 0.32));
      b.box(sd * 0.012, -0.36, 0, 0.03, 0.38, 0.5, { c: lc, m: M.wood, bevel: 0.012, ao: 0.15 });
      for (var k = 0; k < 4; k++) b.ball(sd * 0.03, -0.06 - k * 0.09, 0.22, 0.013, { c: '#a8a296', m: M.metal, detail: 0, ao: 0 });
      b.pop();
      // iron grab handles on the pommel
      b.addGeo(new T.TorusGeometry(0.06, 0.012, 4, 10, Math.PI), { x: sd * 0.08, y: R + 0.12, z: 0.3, ry: Math.PI / 2, c: iron, m: M.metal, ao: 0 });
      // the stirrup on its strap
      var sx = ex + sd * 0.16, sy = ey - 0.5 * drop;
      b.beam([ex + sd * 0.05, ey - 0.08, 0.1], [sx, sy, 0.12], 0.018, { c: lc2, m: M.wood, r2: 0.006 });
      b.addGeo(new T.TorusGeometry(0.07, 0.013, 4, 10), { x: sx, y: sy - 0.07, z: 0.12, ry: Math.PI / 2, sy: 0.85, c: iron, m: M.metal, ao: 0 });
      b.box(sx, sy - 0.15, 0.12, 0.05, 0.025, 0.12, { c: iron, m: M.metal, bevel: 0.005 });
    });
    if (o.girth !== false) b.beam([Math.cos(0.5) * (R + 0.04), Math.sin(0.5) * (R + 0.04) - 0.2, -0.12], [R + 0.16, -0.55 * drop, -0.14], 0.026, { c: lc2, m: M.wood, r2: 0.007 });
    b.pop();
  }
  // a sawhorse stand for a saddle, length along local z
  function saddleryStand(b, x, y, z, ry, o) {
    o = o || {}; var M = KIT.M, Hs = 0.95;
    b.push(x, y, z, ry);
    b.box(0, Hs - 0.12, 0, 0.11, 0.12, 1.1, { c: 'woodLight', m: M.wood, bevel: 0.02 });
    [-0.44, 0.44].forEach(function (zz) {
      [-1, 1].forEach(function (sd) { b.beam([sd * 0.33, 0, zz + (zz > 0 ? 0.06 : -0.06)], [sd * 0.03, Hs - 0.1, zz], 0.03, { c: 'wood' }); });
      b.beam([-0.21, 0.34, zz + (zz > 0 ? 0.03 : -0.03)], [0.21, 0.34, zz + (zz > 0 ? 0.03 : -0.03)], 0.022, { c: 'wood' });
    });
    b.beam([0, 0.3, -0.44], [0, 0.3, 0.44], 0.022, { c: 'wood' });
    if (o.saddle !== false) saddlerySaddle(b, 0, Hs, 0, { R: 0.2, c: o.c, c2: o.c2, blanket: o.blanket, drop: 0.9 });
    b.pop();
  }
  // a made tail fin: cloth on an iron frame, in the local XY plane, root at the origin, along +x
  function saddleryFin(b, x, y, z, o) {
    o = o || {}; var M = KIT.M, s = o.s || 1, len = 0.9 * s, wid = 0.55 * s;
    var pts = [[0, 0], [len * 0.25, wid * 0.55], [len * 0.62, wid * 0.92], [len * 0.92, wid * 0.7], [len, wid * 0.25], [len * 0.82, -wid * 0.08], [len * 0.55, -wid * 0.04], [len * 0.3, -wid * 0.14], [len * 0.08, -wid * 0.05]];
    b.push(x, y, z, o.ry || 0);
    b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationFromEuler(new T.Euler(o.rx || 0, 0, o.rz || 0)));
    b.extrude(0, 0, 0, pts, 0.022, { c: o.c || 'ember', m: o.cm === undefined ? M.cloth : o.cm, ao: 0.05, jit: 0.01 });
    var ic = '#2b2b2c';
    [[0, 0.02], [len * 0.25, wid * 0.5], [len * 0.62, wid * 0.86], [len * 0.92, wid * 0.66], [len * 0.98, wid * 0.25]].reduce(function (a, p) { b.beam([a[0], a[1], 0.014], [p[0], p[1], 0.014], 0.011 * Math.max(1, s), { c: ic, m: M.metal, round: true, seg: 5 }); return p; });
    b.beam([0, 0.0, 0.014], [len * 0.92, wid * 0.18, 0.014], 0.013 * Math.max(1, s), { c: ic, m: M.metal, round: true, seg: 5 });
    b.beam([len * 0.5, 0.0, 0.014], [len * 0.5, wid * 0.75, 0.014], 0.01 * Math.max(1, s), { c: ic, m: M.metal, round: true, seg: 5 });
    b.box(0.02, -0.05, 0, 0.12, 0.1, 0.06, { c: ic, m: M.metal, bevel: 0.01 });
    if (o.mark) b.extrude(len * 0.55, wid * 0.32, 0.02, [[-0.05, -0.05], [0.05, -0.05], [0.06, 0.04], [0, 0.09], [-0.06, 0.04]].map(function (p) { return [p[0] * s, p[1] * s]; }), 0.006, { c: 'bone', m: M.paint, ao: 0 });
    b.pop();
  }
  // a hide stretched and laced on a standing timber frame, facing +z
  function saddleryHide(b, x, z, ry, w, h, o) {
    o = o || {}; var M = KIT.M, y0 = 0.45, cy = y0 + h / 2, pts = [], n = 28;
    b.push(x, 0, z, ry);
    [-1, 1].forEach(function (sd) { b.post(sd * w / 2, 0, 0, 0.055, h + y0 + 0.25, { c: 'wood' }); b.box(sd * w / 2, 0, 0, 0.12, 0.08, 0.7, { c: 'woodDark', m: M.wood, bevel: 0.02 }); b.beam([sd * w / 2, 0.9, 0.0], [sd * w / 2, 0.02, -0.55], 0.03, { c: 'wood' }); });
    [y0, y0 + h].forEach(function (yy) { b.beam([-w / 2 - 0.08, yy, 0], [w / 2 + 0.08, yy, 0], 0.045, { c: 'wood', round: true, seg: 6 }); });
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2, k = 1 + 0.17 * Math.cos(4 * (a - Math.PI / 4)) + b.j(0.04);
      pts.push([Math.cos(a) * (w / 2 - 0.2) * k * 0.92, Math.sin(a) * (h / 2 - 0.16) * k * 0.92]);
    }
    b.extrude(0, cy, 0, pts, 0.025, { c: o.c || '#7a5f47', m: M.cloth, ao: 0.1, jit: 0.03, vary: 0.1 });
    for (var q = 0; q < n; q += 2) {
      var p = pts[q], d = Math.max(Math.abs(p[0]) / (w / 2 - 0.05), Math.abs(p[1]) / (h / 2 - 0.05)), e = [p[0] / d, p[1] / d];
      b.beam([p[0], cy + p[1], 0.0], [e[0], cy + e[1], 0.0], 0.006, { c: '#d8ccb4', m: M.rope, round: true, seg: 3 });
    }
    b.pop();
  }
  // a round shield on a wall facing +z, painted in quarters
  function saddleryShield(b, x, y, z, c1, c2, s) {
    var M = KIT.M, r = 0.42 * s * 0.97, n = 8;
    b.shield(x, y, z, { kind: 'round', c: c1, s: s });
    [0, Math.PI].forEach(function (a0) {
      var pts = [[0, 0]]; for (var i = 0; i <= n; i++) { var a = a0 + Math.PI / 4 + i / n * Math.PI / 2; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      b.extrude(x, y, z + 0.053, pts, 0.006, { c: c2, m: M.paint, ao: 0, jit: 0.01 });
    });
  }
  // harness hung from a wooden peg on a wall facing +z: loops of strap, iron rings and a buckle
  function saddleryHarness(b, x, y, z, o) {
    o = o || {}; var M = KIT.M, leather = o.c || '#2c231d';
    b.push(x, y, z, 0);
    b.beam([0, 0, 0], [0, 0.05, 0.24], 0.03, { c: 'woodDark', round: true, seg: 6 });
    var loop = new T.TorusGeometry(0.2, 0.02, 4, 18);
    b.addGeo(loop, { x: 0, y: -0.31, z: 0.12, sy: 1.55, c: leather, m: M.wood, ao: 0.1, jit: 0.02 });
    b.addGeo(loop, { x: 0.05, y: -0.42, z: 0.1, sy: 1.95, sx: 0.8, rz: 0.12, c: '#3a2c22', m: M.wood, ao: 0.1, jit: 0.02 });
    b.addGeo(new T.TorusGeometry(0.07, 0.013, 4, 10), { x: -0.06, y: -0.7, z: 0.13, c: 'iron', m: M.metal, ao: 0 });
    b.addGeo(new T.TorusGeometry(0.05, 0.012, 4, 10), { x: 0.16, y: -0.55, z: 0.11, ry: 0.4, c: 'iron', m: M.metal, ao: 0 });
    b.box(0.17, -0.3, 0.13, 0.07, 0.09, 0.02, { c: 'iron', m: M.metal, bevel: 0.004 });
    b.beam([-0.1, -0.02, 0.14], [-0.14, -0.95, 0.12], 0.018, { c: leather, m: M.wood, r2: 0.008 });
    b.pop();
  }
  // a window box of white flowers, length along local x
  function saddleryFlowerBox(b, x, y, z, len, ry) {
    var M = KIT.M;
    b.push(x, y, z, ry || 0);
    b.box(0, 0, 0, len, 0.2, 0.26, { c: 'woodDark', m: M.wood, bevel: 0.02 });
    for (var k = 0; k < Math.round(len / 0.16); k++) {
      var px = -len / 2 + 0.1 + k * 0.16;
      b.ball(px, 0.24 + b.r() * 0.05, b.j(0.05), 0.08 + b.r() * 0.03, { c: b.pick(['#5c6d45', '#66784c', '#4a6631']), m: M.leaf, ao: 0.2, jit: 0.05, detail: 0 });
      b.ball(px + b.j(0.05), 0.33 + b.r() * 0.06, b.j(0.07), 0.045 + b.r() * 0.02, { c: '#f3f1ec', m: M.paint, ao: 0, detail: 0 });
    }
    b.pop();
  }

  // Shingles laid one by one, each its own shade of dark timber, lighter at the exposed foot
  var SH_CACHE = {}, MOSS = new T.Color('#7f8657');
  function saddleryShingle(pw, thick, len) {
    var key = [pw, thick, len].map(function (v) { return v.toFixed(3); }).join(',');
    if (SH_CACHE[key]) return SH_CACHE[key];
    var g = KIT.geo.chamferBox(pw * 0.94, thick * 0.7, len, Math.min(0.03, thick * 0.2));
    g.computeBoundingBox(); var p = g.attributes.position, za = g.boundingBox.min.z, zb = g.boundingBox.max.z, c = [];
    for (var i = 0; i < p.count; i++) { var t = (p.getZ(i) - za) / Math.max(1e-4, zb - za), v = 0.6 + 0.4 * Math.pow(KIT.util.smooth(0, 0.75, t), 0.8); c.push(v, v * 0.99, v * 0.97); }
    g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
    return (SH_CACHE[key] = g);
  }
  function saddleryTone(b, slate) {
    var cc = KIT.util.col(b.pick(slate ? KIT.PAL.slate : KIT.PAL.woodDark)), q = b.r();
    if (q < 0.14) cc.offsetHSL(0.01, 0.03, -0.03); else if (q < 0.3) cc.offsetHSL(0.0, 0.02, 0.035); else if (q < 0.34) cc.lerp(MOSS, 0.18);
    return cc;
  }
  // A gabled shingle roof (ridge along x, eaves at y, rising h over span d), row by row from the eaves; o.skip(x, side,
  // u, pw) leaves out a shingle hidden under a cross gable (u: how far in from the wall line its top edge reaches);
  // o.slate lays charcoal slates instead
  function saddleryRoof(b, x, y, z, w, d, h, o) {
    var M = KIT.M, over = o.over, half = d / 2 + over, slope = Math.atan2(h, d / 2), run = half / Math.cos(slope);
    var rows = o.rows, rl = run / rows, thick = 0.13, L = w + 2 * o.overX, pw = 0.36, dropY = -over * Math.tan(slope);
    b.push(x, y, z, 0);
    for (var r = 0; r < rows; r++) {
      b.unit(function () {
        [-1, 1].forEach(function (side) {
          var t0 = r * rl, t1 = (r + 1) * rl + rl * 0.4, len = t1 - t0;
          var cz = side * (half - (t0 + t1) / 2 * Math.cos(slope)), cy = dropY + (t0 + t1) / 2 * Math.sin(slope);
          var pg = saddleryShingle(pw, thick, len), n = Math.ceil(L / pw), off = (r % 2) * pw * 0.5, uTop = t1 * Math.cos(slope) - over;
          b.push(0, cy + thick * 0.4 + (r % 2) * 0.01, cz, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(side * (slope + 0.07)));
          for (var i = 0; i <= n; i++) {
            var px = -L / 2 + i * pw + off - pw * 0.25; if (px > L / 2 + pw * 0.2) break; if (px < -L / 2 - pw * 0.2) continue;
            var pc = Math.max(-L / 2 + pw / 2, Math.min(L / 2 - pw / 2, px));
            if (o.skip && o.skip(pc + x, side, uTop, pw)) continue;
            b.addGeo(pg, { x: pc, y: -thick / 2 + b.j(0.01), z: b.j(0.025), rx: b.j(0.01), ry: b.j(0.02) + (side < 0 ? Math.PI : 0), rz: b.j(0.015), c: saddleryTone(b, o.slate), m: o.slate ? M.tile : M.wood, ao: 0.3, jit: 0.02, vary: 0.05 });
          }
          b.pop();
        });
      });
    }
    b.unit(function () { b.addGeo(KIT.geo.cyl(thick * 1.15, thick * 1.15, L + 0.1, 8, { flat: true }), { x: -L / 2 - 0.05, y: h + thick * 0.5, z: 0, rz: -Math.PI / 2, c: o.slate ? '#3f4347' : '#2a2826', m: o.slate ? M.tile : M.wood }); });
    b.pop();
  }

  KIT.defineBuild('saddlery', {
    name: 'Saddle and fin workshop', size: 'middle', need: 55,
    line: 'An open timber workshop with a forge corner, where a saddler fits a saddle to the night dragon while a dawn dragon waits on the grass.',
    r: 14, flat: [19, 13], ground: 'paving', path: [[0.8, 14.5], [0.6, 6.2]],
    frameY: 2.8, frameR: 12, glowAt: [-7.42, 7.0, -1.85],
    trees: [{ x: -10.8, z: -6.2, kind: 'pine', h: 8.0 }, { x: 11.4, z: -5.0, kind: 'pine', h: 7.2 }, { x: -11.9, z: 2.6, kind: 'round', h: 5.0 }],
    bushes: [{ x: 10.4, z: 5.4, r: 0.85, flowers: '#f3f1ec' }, { x: -8.8, z: 6.4, r: 0.8 }, { x: 11.4, z: 1.2, r: 0.7 }],
    perches: [{ x: -2.3, y: 6.15, z: -1.8, ry: -Math.PI / 2 }, { x: 9.4, y: 2.5, z: 3.0, ry: -1.4 }],
    build: function (b) {
      var M = KIT.M;
      // the hall: x -4.4..5.2 between the back wall (z -4.55) and the front posts (z 0.95), open to the front and the
      // right; the forge wing: x -7.0..-4.4, z -4.85..-1.1, under its own roof, the chimney on its stone gable
      var cx = 0.4, W = 9.6, fl = 0.3, eave = 3.35, x0 = cx - W / 2, x1 = cx + W / 2;
      var pzB = -4.55, pzF = 0.95, Tk = 0.6, zL = -1.1, lx0 = -7.0;
      var yR = eave + 0.15, rise = 2.5, over = 0.6, overX = 0.45, rcz = (pzF + pzB) / 2, rd = pzF - pzB, tanS = rise / (rd / 2);
      var gx = 0.6, gW = 1.7, gRise = 1.7, gOver = 0.15;
      var postX = [x0 + 0.15, gx - gW, gx + gW, x1 - 0.15];
      // the forge wing's roof, its hearth at the front by the gable and the chimney outside that gable
      var wE = 2.35, wRise = 1.3, wOver = 0.35, wz0 = pzB - Tk / 2, wd = zL - wz0, wcz = (wz0 + zL) / 2, tanW = wRise / (wd / 2);
      var hx = -5.75, hz = -1.85, chX = lx0 - 0.42, winZ = -3.15;

      b.part('Footings');
      b.unit(function () {
        b.box(cx, -0.1, rcz - 0.05, W + 0.7, 0.22, rd + 0.9, { c: 'stoneDark', bevel: 0.06 });
        b.box((lx0 + x0) / 2 - 0.1, -0.1, (pzB + zL) / 2 - 0.1, x0 - lx0 + 0.5, 0.22, zL - pzB + 0.9, { c: 'stoneDark', bevel: 0.06 });
      });
      b.unit(function () {
        // a kerb of dressed stones along the front and the open side, and wide steps up under the cross gable
        for (var t = 0; t < 15; t++) b.box(x0 - 0.2 + (t + 0.5) * (W + 0.4) / 15, 0.08, pzF + 0.38, (W + 0.4) / 15 - 0.04, 0.17, 0.42, { c: b.stoneC('stone'), m: M.stone, bevel: 0.04, ry: b.j(0.02) });
        for (var u = 0; u < 9; u++) b.box(x1 + 0.22, 0.08, pzB - 0.25 + (u + 0.5) * (rd + 0.85) / 9, 0.42, 0.17, (rd + 0.85) / 9 - 0.04, { c: b.stoneC('stone'), m: M.stone, bevel: 0.04 });
        for (var s2 = 0; s2 < 3; s2++) b.box(gx - 1.0 + s2 * 1.0, 0, pzF + 0.86, 0.96, 0.16, 0.5, { c: b.stoneC('sandstone'), m: M.stone, bevel: 0.04, ry: b.j(0.03) });
      });
      b.unit(function () {
        postX.forEach(function (px) { b.box(px, 0.08, pzF, 0.46, 0.24, 0.46, { c: 'stone', bevel: 0.05 }); });
        b.box(x1 - 0.15, 0.08, rcz, 0.46, 0.24, 0.46, { c: 'stone', bevel: 0.05 }); b.box(x0 + 0.15, 0.08, zL, 0.46, 0.24, 0.46, { c: 'stone', bevel: 0.05 });
        // oak sills under the open sides of the floor
        b.box(x0 + 0.08, 0.1, (zL + pzF) / 2 + 0.1, 0.16, 0.14, pzF - zL + 0.2, { c: 'beam', m: M.wood, bevel: 0.02 });
        b.box(x1 - 0.08, 0.1, rcz, 0.16, 0.14, rd, { c: 'beam', m: M.wood, bevel: 0.02 });
      });

      b.part('Plank floor');
      (function () {
        var n = 36, pw = (W - 0.1) / n, per = 6;
        for (var i = 0; i < n; i += per) {
          b.unit(function () {
            for (var k = i; k < Math.min(n, i + per); k++) {
              var x = x0 + 0.05 + (k + 0.5) * pw, split = -1.6 + b.j(1.3);
              [[pzB + Tk / 2, split], [split, pzF + 0.2]].forEach(function (seg) { b.box(x, fl - 0.07, (seg[0] + seg[1]) / 2, pw - 0.018, 0.07, seg[1] - seg[0] - 0.02, { c: b.pick(['#7d6a57', '#73614f', '#86725d', '#6d5c4b']), m: M.wood, bevel: 0.01, ao: 0.15, jit: 0.03 }); });
            }
          });
        }
      })();
      b.part('Forge floor');
      (function () {
        // the forge floor of stone flags, laid row by row
        var nz = 6, nx = 5, fw = (x0 - lx0 - 0.5) / nx, fd = (zL - pzB - Tk / 2) / nz;
        for (var r = 0; r < nz; r += 2) b.unit(function () {
          for (var q = r; q < r + 2; q++) for (var i = 0; i < nx; i++) b.box(lx0 + 0.5 + (i + 0.5) * fw + b.j(0.02), 0.1, pzB + Tk / 2 + (q + 0.5) * fd, fw - 0.05, 0.07, fd - 0.05, { c: b.stoneC('stoneDark'), m: M.stone, bevel: 0.02, ry: b.j(0.03), ao: 0.2 });
        });
      })();

      b.part('Back wall');
      // one wall course by course from the forge to the open end; behind the forge it stops at the wing's eaves
      b.stoneWall(lx0, pzB, x1, pzB, 0.08, eave - 0.08, Tk, {
        pal: 'stone', course: 0.41, len: 0.72, core: false,
        hole: function (t, y, s0, s1) {
          if (y + 0.2 <= wE + 0.02 || s0 >= x0 - lx0 - 0.02) return false;
          if (s1 <= x0 - lx0 + 0.02) return true;
          return [[x0 - lx0, s1]];
        }
      });
      b.part('Forge gable');
      // the wing's stone gable, course by course to a point, with a shuttered window; its corner at the back is the
      // back wall's
      b.stoneWall(lx0 + 0.25, wz0, lx0 + 0.25, zL, 0.08, wE + wRise + 0.05, 0.5, {
        pal: 'stone', course: 0.37, len: 0.62, core: false,
        hole: function (t, y, s0, s1) {
          var top = y + 0.185, keep = [[s0, s1]];
          if (y < wE) { if (s1 <= Tk + 0.02) return true; if (s0 < Tk) keep = [[Tk, s1]]; }
          else { var hw = (wE + wRise + 0.1 - top) / tanW; if (hw < 0.1) return true; keep = [[Math.max(s0, wd / 2 - hw), Math.min(s1, wd / 2 + hw)]]; if (keep[0][1] - keep[0][0] < 0.1) return true; }
          var w0 = winZ - wz0 - 0.36, w1 = winZ - wz0 + 0.36;
          if (y > 1.0 && y < 1.95) keep = keep.reduce(function (acc, k) { if (k[1] <= w0 || k[0] >= w1) acc.push(k); else { if (k[0] < w0) acc.push([k[0], w0]); if (k[1] > w1) acc.push([w1, k[1]]); } return acc; }, []);
          if (!keep.length) return true;
          if (keep.length === 1 && keep[0][0] <= s0 + 1e-6 && keep[0][1] >= s1 - 1e-6) return false;
          return keep;
        }
      });
      b.unit(function () {
        // coping stones up both slopes of the gable, a kneeler at each foot
        [-1, 1].forEach(function (e) {
          var ze = wcz + e * (wd / 2 + 0.05), ye = wE + 0.02, zt = wcz, yt = wE + wRise + 0.2;
          b.beam([lx0 + 0.25, ye + 0.14, ze], [lx0 + 0.25, yt, zt + e * 0.02], 0.27, { c: 'sandstone', m: M.stone, r2: 0.075 });
          b.box(lx0 + 0.25, wE - 0.12, ze - e * 0.12, 0.54, 0.26, 0.4, { c: 'sandstone', bevel: 0.03 });
        });
        b.window(lx0, 0.96, winZ, 0.56, 0.82, { ry: -Math.PI / 2, sillC: 'sandstone', lintelC: 'sandstone', shutters: 'ink' });
        saddleryFlowerBox(b, lx0 - 0.2, 0.55, winZ, 0.9, Math.PI / 2);
      });

      b.part('Forge');
      b.stoneBox(hx, hz, 1.1, 1.3, 0.13, 0.85, 0.3, { pal: 'stoneDark', course: 0.28, len: 0.5 });
      b.unit(function () {
        b.box(hx, 0.98, hz, 1.22, 0.12, 1.42, { c: 'sandstone', bevel: 0.03 });
        b.box(hx - 0.05, 1.06, hz, 0.66, 0.06, 0.86, { c: '#2a2420', m: M.dark, bevel: 0, ao: 0 });
        b.embers(hx - 0.05, 1.12, hz, 0.34, {});
        b.flame(hx - 0.05, 1.1, hz + 0.05, 0.45, { i: 0.9 });
        // the hood, stepping back into the gable wall, on an oak mantel beam
        b.box(hx - 0.12, 1.92, hz, 1.25, 0.92, 1.36, { taper: 0.45, taperD: 0.6, c: 'stoneDark', m: M.stone, bevel: 0.03 });
        b.box(hx + 0.42, 1.82, hz, 0.24, 0.14, 1.5, { c: 'beam', m: M.wood, bevel: 0.02 });
      });
      b.unit(function () {
        // the bellows on its trestle beside the hearth, tongs on the mantel, a coal bin, a grindstone
        b.push(hx + 1.0, 0.75, hz - 0.1, Math.PI);
        b.extrude(0, 0, 0, [[-0.45, -0.1], [0.4, -0.02], [0.4, 0.02], [-0.45, 0.14]], 0.55, { c: '#4a3a2e', m: M.wood });
        b.extrude(0, 0.035, 0, [[-0.42, -0.06], [0.38, 0.0], [-0.42, 0.1]], 0.57, { c: '#2a221d', m: M.cloth });
        b.cyl(0.4, 0.0, 0, 0.04, 0.3, { c: 'iron', m: M.metal, rz: -Math.PI / 2, seg: 6 });
        b.pop();
        b.box(hx + 1.0, 0.13, hz - 0.1, 0.55, 0.6, 0.45, { c: 'wood', m: M.wood, bevel: 0.03 });
        for (var k = 0; k < 3; k++) b.beam([hx + 0.5, 1.86, hz + 0.25 + k * 0.13], [hx + 0.53, 1.3 - k * 0.05, hz + 0.24 + k * 0.14], 0.012, { c: 'iron', m: M.metal, round: true, seg: 4 });
        b.box(-5.1, 0.13, -3.75, 0.75, 0.45, 0.6, { c: 'woodDark', m: M.wood, bevel: 0.02 });
        b.box(-5.1, 0.55, -3.75, 0.65, 0.06, 0.5, { c: '#1d1c1b', m: M.dark, bevel: 0.0, ao: 0 });
        [-6.15, -5.87].forEach(function (gxx) { b.box(gxx, 0.13, -3.6, 0.06, 0.66, 0.5, { c: 'wood', m: M.wood, bevel: 0.01 }); });
        b.cyl(-5.95, 0.74, -3.6, 0.34, 0.12, { c: 'sandstone', m: M.stone, rz: Math.PI / 2, seg: 14 });
        b.beam([-6.22, 0.74, -3.6], [-5.8, 0.74, -3.6], 0.02, { c: 'iron', m: M.metal, round: true, seg: 5 });
      });

      b.part('Chimney');
      b.stoneBox(chX, hz, 0.84, 1.1, 0.0, 6.4, 0.24, { pal: 'stone', course: 0.42, len: 0.55 });
      b.unit(function () {
        b.box(chX, 6.4, hz, 1.04, 0.18, 1.3, { c: 'sandstone', bevel: 0.04 });
        b.box(chX, 6.58, hz, 0.5, 0.36, 0.6, { c: 'stoneDark', bevel: 0.05 });
        b.box(chX, 6.94, hz, 0.68, 0.07, 0.78, { c: 'iron', m: M.metal, bevel: 0.01 });
        b.box(chX, 6.62, hz, 0.36, 0.34, 0.46, { c: '#1a1918', m: M.dark, bevel: 0, ao: 0 });
      });

      b.part('Posts');
      postX.forEach(function (px, i) {
        b.unit(function () {
          // carved stave posts: a plinth, bands, a capital and knee braces to the plate
          b.box(px, fl, pzF, 0.3, eave - fl - 0.27, 0.3, { c: 'beam', m: M.wood, bevel: 0.04 });
          [0.95, 1.07, 2.15].forEach(function (yy) { b.box(px, fl + yy, pzF, 0.36, 0.07, 0.36, { c: 'beam', m: M.wood, bevel: 0.02 }); });
          b.box(px, eave - 0.52, pzF, 0.4, 0.24, 0.4, { c: 'beam', m: M.wood, bevel: 0.04 });
          [-1, 1].forEach(function (sd) { if ((i === 0 && sd < 0) || (i === postX.length - 1 && sd > 0)) return; b.beam([px + sd * 0.1, eave - 1.15, pzF], [px + sd * 0.75, eave - 0.27, pzF], 0.07, { c: 'beam', r2: 0.09 }); });
        });
      });
      b.unit(function () {
        // the post where the lean-to meets the hall, and the middle post of the open end
        b.box(x0 + 0.15, fl, zL, 0.28, eave - fl - 0.27, 0.28, { c: 'beam', m: M.wood, bevel: 0.04 });
        [-1, 1].forEach(function (sd) { b.beam([x0 + 0.15, eave - 1.1, zL + sd * 0.1], [x0 + 0.15, eave - 0.27, zL + sd * 0.8], 0.07, { c: 'beam', r2: 0.09 }); });
        b.box(x1 - 0.15, fl, rcz, 0.28, eave - fl - 0.27, 0.28, { c: 'beam', m: M.wood, bevel: 0.04 });
        [-1, 1].forEach(function (sd) { b.beam([x1 - 0.15, eave - 1.15, rcz + sd * 0.1], [x1 - 0.15, eave - 0.27, rcz + sd * 0.8], 0.07, { c: 'beam', r2: 0.09 }); });
      });

      b.part('Plates and trusses');
      b.unit(function () {
        b.box(cx, eave - 0.3, pzF, W + 0.4, 0.3, 0.32, { c: 'beam', m: M.wood, bevel: 0.03 });
        b.box(cx, eave - 0.3, pzB, W + 0.4, 0.3, 0.34, { c: 'beam', m: M.wood, bevel: 0.03 });
        b.box(x1 - 0.15, eave - 0.3, rcz, 0.3, 0.3, rd - 0.3, { c: 'beam', m: M.wood, bevel: 0.03 });
        b.box(x0 + 0.15, eave - 0.3, rcz, 0.3, 0.3, rd - 0.3, { c: 'beam', m: M.wood, bevel: 0.03 });
        // iron studs along the lintel under the cross gable
        for (var k = 0; k < 9; k++) b.ball(gx - 1.45 + k * 0.3625, eave - 0.15, pzF + 0.165, 0.028, { c: 'iron', m: M.metal, detail: 0, ao: 0 });
      });
      b.unit(function () {
        // painted round shields hung on the carved posts either side of the cross gable
        [gx - gW, gx + gW].forEach(function (sx, i) { saddleryShield(b, sx, fl + 1.6, pzF + 0.15, i ? 'bone' : 'ink', i ? 'ink' : 'bone', 0.78); });
      });
      b.unit(function () {
        // tie beams, king posts and principal rafters
        [x0 + 1.7, gx - gW, gx + gW, x1 - 1.5].forEach(function (px) {
          b.box(px, eave - 0.02, rcz, 0.22, 0.24, rd + 0.3, { c: 'beam', m: M.wood, bevel: 0.03 });
          b.box(px, eave + 0.22, rcz, 0.18, rise - 0.45, 0.18, { c: 'beam', m: M.wood, bevel: 0.03 });
          [-1, 1].forEach(function (e) { b.beam([px, eave + 0.2, rcz + e * (rd / 2)], [px, eave + rise - 0.1, rcz], 0.08, { c: 'beam', r2: 0.09 }); b.beam([px, eave + 0.3, rcz + e * 0.12], [px, eave + 1.15, rcz + e * 1.05], 0.055, { c: 'beam' }); });
        });
      });

      b.part('Forge wing frame');
      b.unit(function () {
        // the front plate on a knee brace from the hall post, the back plate on the wall, tie beams and king posts
        b.box((lx0 + 0.5 + x0 + 0.15) / 2, wE - 0.26, zL, x0 + 0.15 - lx0 - 0.5, 0.26, 0.26, { c: 'beam', m: M.wood, bevel: 0.03 });
        b.beam([x0 + 0.05, wE - 1.0, zL], [x0 - 0.6, wE - 0.24, zL], 0.06, { c: 'beam', r2: 0.075 });
        b.box((lx0 + 0.5 + x0) / 2, wE - 0.26, pzB, x0 - lx0 - 0.5, 0.26, 0.3, { c: 'beam', m: M.wood, bevel: 0.03 });
        [-4.95].forEach(function (tx0) {
          b.box(tx0, wE - 0.04, wcz, 0.2, 0.2, wd + 0.2, { c: 'beam', m: M.wood, bevel: 0.03 });
          b.box(tx0, wE + 0.14, wcz, 0.16, wRise - 0.3, 0.16, { c: 'beam', m: M.wood, bevel: 0.02 });
          [-1, 1].forEach(function (e) { b.beam([tx0, wE + 0.12, wcz + e * (wd / 2 - 0.05)], [tx0, wE + wRise - 0.08, wcz], 0.07, { c: 'beam', r2: 0.08 }); });
        });
        // a board gable at the hall end of the wing
        b.gableEnd(x0 - 0.1, wE, wcz, wd - 0.1, wRise - 0.08, 0.1, { c: 'woodDark' });
      });
      b.part('Forge roof');
      saddleryRoof(b, (lx0 + 0.3 + x0 - 0.05) / 2, wE, wcz, x0 - 0.05 - lx0 - 0.3, wd, wRise, { over: wOver, overX: 0, rows: 5 });

      b.part('End gables');
      [-1, 1].forEach(function (sd) {
        b.unit(function () {
          var ex = cx + sd * (W / 2 - 0.12);
          b.gableEnd(ex, yR - 0.02, rcz, rd - 0.1, rise - 0.15, 0.22, { c: '#6a5845', m: M.wood });
          var fx = ex + sd * 0.12;
          for (var k = -9; k <= 9; k++) {
            var zz = rcz + k * 0.3, hh = (rise - 0.25) * (1 - Math.abs(zz - rcz) / ((rd - 0.1) / 2)) - 0.05;
            if (hh > 0.15) b.box(fx, yR - 0.02, zz, 0.05, hh, 0.07, { c: 'beam', m: M.wood, bevel: 0.01 });
          }
          b.box(fx, yR - 0.05, rcz, 0.08, 0.14, rd - 0.1, { c: 'beam', m: M.wood, bevel: 0.02 });
          b.cyl(fx + sd * 0.01, yR + 1.05, rcz, 0.28, 0.06, { c: '#1c1b1a', m: M.dark, rz: Math.PI / 2, seg: 14, ao: 0 });
          b.addGeo(new T.TorusGeometry(0.3, 0.05, 5, 16), { x: fx + sd * 0.03, y: yR + 1.05, z: rcz, ry: Math.PI / 2, c: 'beam', m: M.wood, ao: 0 });
        });
      });
      b.part('Cross gable');
      var gz = pzF + 0.44;
      b.unit(function () {
        // a board gable over the work table, jettied out on carved brackets, its shield painted with a fin
        b.box(gx, eave - 0.28, gz - 0.02, gW * 2 + 0.5, 0.28, 0.26, { c: 'beam', m: M.wood, bevel: 0.03 });
        [-1, 1].forEach(function (e) { b.beam([gx + e * gW, eave - 1.05, pzF + 0.1], [gx + e * gW, eave - 0.3, gz - 0.06], 0.07, { c: 'beam', r2: 0.09 }); b.box(gx + e * gW, eave - 0.3, (pzF + gz) / 2, 0.22, 0.22, gz - pzF + 0.2, { c: 'beam', m: M.wood, bevel: 0.03 }); });
        b.extrude(gx, eave, gz, [[-(gW + 0.1), 0], [gW + 0.1, 0], [0, gRise + 0.1]], 0.12, { c: '#7d6a57', m: M.wood, ao: 0.2 });
        for (var k = -5; k <= 5; k++) { var ox = k * 0.3, hh = gRise + 0.05 - Math.abs(ox) - 0.06; if (hh > 0.12) b.box(gx + ox, eave, gz + 0.08, 0.05, hh, 0.05, { c: 'beam', m: M.wood, bevel: 0.01 }); }
        b.box(gx, eave + 0.02, gz + 0.1, gW * 2 + 0.1, 0.12, 0.08, { c: 'beam', m: M.wood, bevel: 0.02 });
        b.shield(gx, eave + 0.74, gz + 0.12, { kind: 'round', c: 'ink', s: 0.95 });
        saddleryFin(b, gx - 0.2, eave + 0.62, gz + 0.19, { s: 0.42, c: '#f1eee8', cm: M.paint, rz: 0.3 });
      });

      b.part('Shingle roof');
      saddleryRoof(b, cx, yR, rcz, W, rd, rise, {
        over: over, overX: overX, rows: 9,
        skip: function (x, side, u, pw) {
          if (side < 0) return false;
          var e = Math.max(0, Math.abs(x - gx) - pw / 2);
          return e < gW + gOver - 0.05 && u * tanS < gRise - e + 0.02;
        }
      });
      b.part('Cross gable roof');
      b.push(gx, yR, pzF - 0.8, Math.PI / 2);
      b.gableRoof(0, 0, 0, 2.6, gW * 2, gRise, { m: 'wood', over: gOver, rows: 5, overX: 0.2, ridgeC: '#2a2826' });
      b.pop();

      b.part('Carved barge boards');
      b.unit(function () {
        // crossed boards over the cross gable, their ends carved into a pair of dragon heads, purlins under the verge
        var bz = pzF + 0.76, top = yR + gRise + 0.18;
        [-1, 1].forEach(function (e) {
          var xe = gx + e * (gW + gOver), ye = yR - gOver + 0.12, ddx = gx - xe, ddy = top - ye, L = Math.hypot(ddx, ddy), ext = 0.5;
          var end = [gx + ddx / L * ext, top + ddy / L * ext];
          b.beam([xe, ye - 0.08, bz], [end[0], end[1], bz], 0.085, { c: 'beam', r2: 0.06 });
          saddleryFinial(b, end[0] - e * 0.02, end[1] - 0.05, bz, e > 0 ? Math.PI : 0, 0.66, { rz: 0.15 });
        });
        [-0.8, 0, 0.8].forEach(function (o2) { b.box(gx + o2, yR + gRise - Math.abs(o2) - 0.36, (gz + bz) / 2, 0.15, 0.17, bz - gz + 0.1, { c: 'beam', m: M.wood, bevel: 0.03 }); });
      });
      b.part('Ridge finials');
      [-1, 1].forEach(function (sd) {
        b.unit(function () {
          var bx = cx + sd * (W / 2 + overX + 0.06), top = yR + rise + 0.17;
          [-1, 1].forEach(function (e) {
            var ze = rcz + e * (rd / 2 + over), ye = yR - over * tanS + 0.14, dz = rcz - ze, dy = top - ye, ext = 0.5, L = Math.hypot(dz, dy);
            b.beam([bx, ye - 0.1, ze], [bx, top + dy / L * ext, rcz + dz / L * ext], 0.1, { c: 'beam', r2: 0.07 });
          });
          saddleryFinial(b, bx + sd * 0.05, top + 0.18, rcz, sd > 0 ? 0 : Math.PI, 1.1);
        });
      });

      b.part('Work table');
      var tx = gx, tz = -1.3, ty = fl + 0.81;
      b.unit(function () {
        b.push(0, fl, 0, 0);
        b.table(tx, tz, 3.4, 1.4, {});
        b.box(tx, 0.3, tz, 3.1, 0.05, 1.15, { c: 'wood', m: M.wood, bevel: 0.01 });
        // under the table: rolled leather and a basket of offcuts
        [[-0.9, '#5a4434'], [-0.5, '#2c231d'], [0.3, '#7a5f47']].forEach(function (p) { b.cyl(tx + p[0], 0.5, tz - 0.4, 0.13, 0.85, { c: p[1], m: M.cloth, rx: Math.PI / 2, seg: 10 }); });
        b.lathe(tx + 1.05, 0.35, tz, [[0.01, 0], [0.22, 0], [0.26, 0.24], [0.01, 0.22]], { c: '#8c7658', m: M.straw, seg: 12, flat: true });
        b.pop();
      });
      b.unit(function () {
        // on the table: the new fin being stitched, a saddle half made on its form, cut leather, tools
        saddleryFin(b, tx + 0.3, ty + 0.012, tz + 0.3, { rx: -Math.PI / 2, ry: 0.25, s: 1.1, mark: true });
        b.box(tx - 1.05, ty, tz - 0.1, 0.36, 0.24, 0.62, { c: 'woodLight', m: M.wood, bevel: 0.03, ry: 0.4 });
        saddlerySaddle(b, tx - 1.05, ty + 0.27, tz - 0.1, { R: 0.18, ry: 0.4, drop: 0.35, blanket: false, girth: false, c: '#5a4434', c2: '#6b5440' });
        [[tx + 1.2, tz - 0.3, 0.3, '#6b5440'], [tx + 1.05, tz + 0.35, -0.5, '#3b2e25'], [tx - 0.25, tz - 0.45, 0.9, '#7a5f47']].forEach(function (L) {
          b.extrude(L[0], ty + 0.01, L[1], [[-0.25, -0.15], [0.22, -0.18], [0.28, 0.1], [0.05, 0.2], [-0.24, 0.12]], 0.012, { rx: -Math.PI / 2, ry: L[2], c: L[3], m: M.cloth, ao: 0 });
        });
        b.box(tx + 1.5, ty, tz + 0.15, 0.3, 0.05, 0.03, { c: 'steel', m: M.metal, bevel: 0.005, ry: 0.4 });
        b.cyl(tx + 1.3, ty, tz + 0.5, 0.06, 0.1, { c: '#d8ccb4', m: M.rope, seg: 8 });
        b.cyl(tx - 0.35, ty, tz + 0.45, 0.07, 0.16, { c: 'woodLight', m: M.wood, seg: 8, rz: Math.PI / 2 });
        b.beam([tx - 0.27, ty + 0.07, tz + 0.45], [tx - 0.07, ty + 0.07, tz + 0.53], 0.015, { c: 'wood', round: true, seg: 5 });
        b.box(tx + 0.65, ty, tz - 0.45, 0.22, 0.12, 0.16, { c: 'wood', m: M.wood, bevel: 0.01 });
        for (var k = 0; k < 6; k++) b.ball(tx + 0.58 + (k % 3) * 0.06, ty + 0.13, tz - 0.48 + Math.floor(k / 3) * 0.06, 0.02, { c: '#a8a296', m: M.metal, detail: 0, ao: 0 });
        b.cyl(tx - 1.55, ty, tz + 0.45, 0.09, 0.2, { c: '#3a3b3d', m: M.metal, seg: 10 });
      });

      b.part('Back bench');
      b.unit(function () {
        // a long bench along the back wall: pots of oil and tallow, stacked hides, a rack of knives and awls above
        var wz = pzB + Tk / 2, bz = wz + 0.35;
        b.box(0.2, fl + 0.78, bz, 4.6, 0.08, 0.66, { c: 'woodLight', m: M.wood, bevel: 0.01 });
        [-2.0, 0.2, 2.4].forEach(function (lx) { b.box(lx, fl, bz, 0.08, 0.78, 0.56, { c: 'wood', m: M.wood, bevel: 0.01 }); });
        [[-1.6, 0.16, '#4a3a2e'], [-1.25, 0.13, '#3a3b3d'], [-0.95, 0.11, '#6b5440']].forEach(function (p) { b.lathe(p[0], fl + 0.86, bz, [[0.01, 0], [p[1], 0], [p[1] * 1.1, p[1] * 1.4], [p[1] * 0.7, p[1] * 1.8], [0.01, p[1] * 1.8]], { c: p[2], m: M.wood, seg: 10, flat: true }); });
        for (var k = 0; k < 5; k++) b.box(1.3 + b.j(0.04), fl + 0.86 + k * 0.06, bz + b.j(0.04), 1.0 - k * 0.05, 0.05, 0.55, { c: b.pick(['#7a5f47', '#6b5440', '#5a4434', '#8a6e52']), m: M.cloth, bevel: 0.015, ry: b.j(0.08) });
        b.box(-0.4, fl + 1.35, wz + 0.04, 1.3, 0.1, 0.07, { c: 'woodDark', m: M.wood, bevel: 0.02 });
        for (var q = 0; q < 6; q++) { var tx2 = -0.95 + q * 0.22; b.beam([tx2, fl + 1.4, wz + 0.09], [tx2, fl + 1.05, wz + 0.09], 0.012, { c: 'woodLight', round: true, seg: 4 }); b.box(tx2, fl + 0.9, wz + 0.09, 0.05, 0.16, 0.02, { c: 'steel', m: M.metal, bevel: 0.004 }); }
      });

      b.part('Wall racks');
      b.unit(function () {
        // spare fins hung on the back wall: one finished, one of old black leather, one bone-white trial
        var wz = pzB + Tk / 2;
        b.box(0.8, fl + 2.55, wz + 0.04, 4.4, 0.12, 0.08, { c: 'beam', m: M.wood, bevel: 0.02 });
        saddleryFin(b, -0.85, fl + 1.85, wz + 0.1, { rz: 0.35, s: 1.0, mark: true });
        saddleryFin(b, 0.45, fl + 1.9, wz + 0.1, { rz: 0.15, s: 0.9, c: '#24201d', cm: M.wood });
        saddleryFin(b, 1.65, fl + 1.85, wz + 0.1, { rz: 0.4, s: 0.85, c: '#e9e4da' });
        [-0.85, 0.45, 1.65].forEach(function (px) { b.beam([px + 0.05, fl + 2.5, wz + 0.04], [px + 0.06, fl + 2.5, wz + 0.2], 0.02, { c: 'woodDark', round: true, seg: 5 }); });
      });
      b.unit(function () {
        // harness on pegs, coils of rope, painted shields
        var wz = pzB + Tk / 2;
        [2.9, 3.45, 4.0].forEach(function (px, i) { saddleryHarness(b, px, fl + 2.2, wz, { c: i === 1 ? '#3a2c22' : '#2c231d' }); });
        [[-2.6, 2.2], [-2.0, 2.3]].forEach(function (p) { b.beam([p[0], p[1] + 0.18, wz], [p[0], p[1] + 0.2, wz + 0.22], 0.025, { c: 'woodDark', round: true, seg: 5 }); b.addGeo(new T.TorusGeometry(0.22, 0.045, 5, 16), { x: p[0], y: p[1], z: wz + 0.1, c: 'rope', m: M.rope, ao: 0.1 }); b.addGeo(new T.TorusGeometry(0.17, 0.045, 5, 16), { x: p[0], y: p[1] - 0.04, z: wz + 0.13, c: 'rope', m: M.rope, ao: 0.1 }); });
        saddleryShield(b, -3.4, fl + 2.35, wz + 0.02, 'ink', 'bone', 0.8);
        saddleryShield(b, 4.65, fl + 2.35, wz + 0.02, 'bone', 'ink', 0.8);
      });

      b.part('Saddle stands');
      b.unit(function () { saddleryStand(b, 3.75, fl, -3.2, Math.PI / 2, { c: '#2a211b' }); saddleryStand(b, 3.75, fl, -2.0, Math.PI / 2, { c: '#5a4434', c2: '#2a211b', blanket: '#24201d' }); });
      b.unit(function () { saddleryStand(b, -2.95, fl, -2.6, 0.1, { c: '#3a2c22' }); saddleryStand(b, -3.0, fl, -0.9, -0.1, { saddle: false }); });
      [[-3.9, 2.35, 0.25, '#2a211b', 0], [-2.65, 2.75, 0.05, '#5a4434', '#24201d'], [-1.4, 2.45, -0.15, '#2a211b', 0]].forEach(function (p) {
        b.unit(function () { saddleryStand(b, p[0], 0, p[1], p[2], { c: p[3], blanket: p[4] || undefined }); });
      });

      b.part('Forge yard');
      b.unit(function () {
        // the anvil in the open before the forge, a quench tub, iron rods for fin frames, wood and charcoal
        b.anvil(-5.25, 0.0, -0.1, { ry: 0.55 });
        b.lathe(-6.35, 0, -0.55, [[0.01, 0], [0.3, 0], [0.33, 0.5], [0.01, 0.49]], { c: 'wood', m: M.wood, seg: 12, flat: true });
        b.cyl(-6.35, 0.45, -0.55, 0.29, 0.02, { c: '#445459', m: M.water, seg: 12 });
        b.beam([-6.2, 0.45, -0.6], [-6.0, 1.05, -0.7], 0.012, { c: 'iron', m: M.metal, round: true, seg: 4 });
        b.beam([-6.15, 0.45, -0.5], [-5.98, 1.05, -0.62], 0.012, { c: 'iron', m: M.metal, round: true, seg: 4 });
        for (var k = 0; k < 7; k++) b.beam([lx0 + 0.06 + k * 0.06, 0.1, zL + 0.14], [lx0 + 0.08 + k * 0.062, 1.45 + b.r() * 0.3, zL + 0.03], 0.012, { c: '#3a3b3d', m: M.metal, round: true, seg: 4 });
      });
      b.unit(function () {
        b.woodpile(lx0 - 0.62, -4.15, { n: 4, len: 1.2, ry: Math.PI / 2 });
        b.sack(lx0 - 0.5, 0, -0.95, 0.9); b.sack(lx0 - 0.35, 0, -0.5, 0.8);
      });

      b.part('Hide frames');
      b.unit(function () { saddleryHide(b, 7.5, 0.7, -0.35, 1.9, 1.5, { c: '#7a5f47' }); });
      b.unit(function () { saddleryHide(b, 8.5, -1.35, -0.6, 1.6, 1.3, { c: '#d8ccb4' }); });

      b.part('Tanning corner');
      b.unit(function () {
        // a third frame with a fresh hide being scraped, and a tanning vat with its paddle
        saddleryHide(b, -7.3, 2.5, 0.55, 1.8, 1.4, { c: '#8a6e52' });
        b.lathe(-8.7, 0, 4.3, [[0.01, 0], [0.5, 0], [0.56, 0.62], [0.6, 0.66], [0.52, 0.66], [0.01, 0.56]], { c: 'woodDark', m: M.wood, seg: 16, flat: true });
        [0.16, 0.48].forEach(function (yy) { b.cyl(-8.7, yy, 4.3, 0.535 + yy * 0.08, 0.05, { c: 'iron', m: M.metal, seg: 16, open: true }); });
        b.cyl(-8.7, 0.56, 4.3, 0.5, 0.02, { c: '#3a2e24', m: M.water, seg: 16 });
        b.beam([-8.85, 0.5, 4.2], [-9.25, 1.55, 3.95], 0.03, { c: 'woodLight', round: true, seg: 6 });
      });
      b.unit(function () {
        // a hide pegged out flat on the stones to dry, and a pile of tanned hides on a pallet
        var px = -6.7, pz = 5.6, pts = [], n = 22;
        for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2, k = 1 + 0.2 * Math.cos(4 * (a - Math.PI / 4)) + b.j(0.05); pts.push([Math.cos(a) * 0.95 * k, Math.sin(a) * 0.68 * k]); }
        b.extrude(px, 0.03, pz, pts, 0.02, { rx: -Math.PI / 2, ry: 0.35, c: '#a58b6c', m: M.cloth, ao: 0.05, jit: 0.03, vary: 0.1 });
        for (var q = 0; q < n; q += 2) { var p = pts[q], c = Math.cos(0.35), sn = Math.sin(0.35), wx = px + p[0] * 1.05 * c + p[1] * 1.05 * sn, wz = pz - p[0] * 1.05 * sn + p[1] * 1.05 * c; b.cyl(wx, 0, wz, 0.025, 0.16, { c: 'woodLight', m: M.wood, seg: 5 }); }
        b.box(-8.4, 0, 2.1, 1.1, 0.14, 0.8, { c: 'wood', m: M.wood, bevel: 0.02, ry: 0.3 });
        for (var k = 0; k < 6; k++) b.box(-8.4 + b.j(0.05), 0.14 + k * 0.07, 2.1 + b.j(0.05), 1.0 - k * 0.04, 0.06, 0.72 - k * 0.03, { c: b.pick(['#7a5f47', '#6b5440', '#5a4434', '#8a6e52', '#d8ccb4']), m: M.cloth, bevel: 0.02, ry: 0.3 + b.j(0.12) });
        b.ropeCoil(-7.7, 0, 1.3, 0.26);
        b.bucket(-6.25, 0, 3.55);
      });

      b.part('Stores');
      b.unit(function () {
        // rolls of leather on a rack, barrels of oil and tallow, crates, coils of rope at the open end
        b.push(0, fl, 0, 0);
        [[4.3, -0.95], [4.62, -0.8], [4.45, -0.5]].forEach(function (p, i) { b.cyl(p[0], 0.16 + (i === 2 ? 0.3 : 0), p[1] - 0.17, 0.16, 0.95, { c: ['#6b5440', '#3b2e25', '#7a5f47'][i], m: M.cloth, rx: Math.PI / 2, seg: 10 }); });
        b.pop();
      });
      b.unit(function () {
        b.push(0, fl, 0, 0);
        b.barrel(4.6, 0, -3.75, { h: 0.95 }); b.barrel(4.05, 0, -3.95, { h: 0.85 });
        b.ropeCoil(3.4, 0, 0.45, 0.3); b.ropeCoil(3.4, 0.1, 0.45, 0.24);
        b.pop();
      });
      b.unit(function () {
        b.push(0, fl, 0, 0);
        b.crate(4.7, 0, -2.8, 0.62, { ry: 0.1 }); b.crate(4.72, 0.62, -2.78, 0.48, { ry: -0.2 });
        b.pop();
      });
      b.unit(function () {
        // in the yard: a coil on a post, buckets of oil, a mounting block, torches on the posts
        b.post(7.7, 0, 3.6, 0.08, 1.3, { c: 'wood' }); b.ropeCoil(7.7, 0.9, 3.6, 0.28); b.ropeCoil(7.7, 1.0, 3.6, 0.22);
        b.bucket(7.25, 0, 4.2); b.bucket(7.75, 0, 4.35);
        b.ropeCoil(-0.5, 0, 2.2, 0.3); b.ropeCoil(-0.45, 0.1, 2.2, 0.22);
      });
      b.unit(function () {
        // a hand cart of rolled hides come up from the tannery
        b.cart(-4.6, 4.7, { ry: -2.0, load: function () { [[-0.55, 0.95], [0, 0.95], [0.55, 0.95], [-0.27, 1.27]].forEach(function (q, i) { b.cyl(-0.5, q[1], q[0], 0.17, 1.0, { c: ['#7a5f47', '#5a4434', '#8a6e52', '#d8ccb4'][i], m: M.cloth, rz: -Math.PI / 2, seg: 10 }); }); } });
        [postX[0], postX[3]].forEach(function (px) { b.torch(px, 2.0, pzF + 0.15, { s: 0.6 }); });
      });

      b.part('Landing rail');
      b.unit(function () {
        // a stout rail on two carved posts where a dragon lands to wait its turn, a coil of rope and a bone pennant
        b.push(9.4, 0, 3.0, 0.17);
        [-1.0, 1.0].forEach(function (lx) {
          b.box(lx, 0, 0, 0.56, 0.26, 0.56, { c: 'stoneDark', bevel: 0.05 });
          b.box(lx, 0.26, 0, 0.28, 1.95, 0.28, { c: 'beam', m: M.wood, bevel: 0.04 });
          [0.9, 1.02].forEach(function (yy) { b.box(lx, yy, 0, 0.34, 0.07, 0.34, { c: 'beam', m: M.wood, bevel: 0.02 }); });
          [-1, 1].forEach(function (sd) { b.beam([lx + sd * 0.12, 1.5, 0], [lx + sd * 0.55, 2.2, 0], 0.06, { c: 'beam', r2: 0.075 }); });
        });
        b.box(0, 2.2, 0, 2.9, 0.3, 0.34, { c: 'beam', m: M.wood, bevel: 0.04 });
        [-1.25, 1.25].forEach(function (lx) { b.box(lx, 2.18, 0, 0.1, 0.34, 0.37, { c: 'iron', m: M.metal, bevel: 0.01 }); });
        b.addGeo(new T.TorusGeometry(0.22, 0.045, 5, 16), { x: 0.2, y: 1.85, z: 0.2, c: 'rope', m: M.rope, ao: 0.1 });
        b.addGeo(new T.TorusGeometry(0.17, 0.045, 5, 16), { x: 0.24, y: 1.82, z: 0.23, c: 'rope', m: M.rope, ao: 0.1 });
        b.pop();
        b.flag(9.4 + 1.0 * Math.cos(0.17), 2.5, 3.0 - 1.0 * Math.sin(0.17) - 0.05, 1.2, 0.85, 0.32, { c: 'bone', pennant: true, pr: 0.035, ry: -2.3 });
      });

      b.part('Ivy and flowers');
      b.unit(function () {
        b.ivy([[lx0 - 0.02, 1.0, wz0 + 0.1], [lx0 - 0.02, 1.9, wz0 + 0.4], [lx0 - 0.02, 2.4, wz0 + 0.75]], [-1, 0, 0], { density: 5, spread: 0.25 });
        b.bush(x1 + 1.3, pzB + 0.4, 0.6, { n: 2 });
        b.bush(lx0 - 0.5, zL + 0.9, 0.5, { flowers: '#f3f1ec', n: 2 });
      });

      b.life(function () {
        // the night dragon, saddled, stands in the yard to be fitted; the saddler buckles the girth at its flank, the
        // rider waits at its head; inside an apprentice stitches the new fin, the smith forges a frame at the anvil
        var dxp = 1.5, dzp = 5.3, dry = -1.5, ds = 1.2, rdx = -2.2, rdz = 6.54;
        // (its pale saddle cloth is laid on its back by the dragon itself, so it follows the back's shape)
        b.dragon(dxp, 0, dzp, { kind: 'night', pose: 'alert', ry: dry, s: ds, saddle: true, wing: 0.0, blanket: '#e9e4da' });
        var sp = saddleryBy(dxp, dzp, dry, 1.25, -0.45);
        b.figure(sp[0], sp[1], { role: 'villager', pose: 'saddleryReach', ry: dry - Math.PI / 2 + 0.1, beard: true, c: '#6e5a44' });
        b.figure(rdx, rdz, { role: 'villager', pose: 'talk', ry: 1.9, cape: '#1f1e1c', c: '#3b3a38' });
        // a dawn dragon, saddled already, crouches on the grass in the sun waiting its turn
        b.dragon(6.6, 0, 8.5, { kind: 'dawn', pose: 'crouch', ry: -1.35, s: 1.0, saddle: true });
        b.figure(tx + 2.0, tz + 0.05, { role: 'villager', pose: 'saddleryWork', ry: -Math.PI / 2, y: fl, c: '#8a857c' });
        b.figure(-4.85, -0.55, { role: 'smith', pose: 'hammer', ry: -0.72, c: '#6e5a44' });
        b.figure(-2.4, 7.3, { role: 'child', pose: 'point', ry: 2.05 });
        b.figure(-0.2, 3.0, { role: 'villager', pose: 'carry', ry: -1.9, c: '#a39b8c' });
        b.figure(7.29, 1.26, { role: 'villager', pose: 'saddleryWork', ry: 2.79, c: '#5a4636' });
        var tp = saddleryBy(-7.3, 2.5, 0.55, 0.1, 0.62);
        b.figure(tp[0], tp[1], { role: 'villager', pose: 'saddleryWork', ry: 0.55 + Math.PI, c: '#6f6a62' });
      });
    }
  });
})();
