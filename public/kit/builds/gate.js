// Town gate: a stone gatehouse between twin round towers on a stone-faced rampart, its passage closed by a portcullis
// half raised, a timber drawbridge on chains over a dry ditch set with stakes, a timber gate hall with dragon-head
// gables over the passage, stubs of curtain wall either side with round shields hung along them, banners on both
// towers, carved posts at the bridge foot, and the guard on watch.
// Built the earthworks first (the rampart, the ditch and the counterscarp, each faced course by course), then the
// gatehouse and towers course by course with the arch and the passage, the curtain walls, the parapets and tower
// crowns, the gate hall panel by panel, the roofs row by row, the drawbridge plank by plank, and last the props and
// the people.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL;

  // a carved dragon-head finial in the XY plane, snout toward local +x, neck foot at (x, y, z), turned by ry, s tall
  var HEAD = [[-0.1, 0], [0.1, 0], [0.12, 0.2], [0.17, 0.42], [0.26, 0.58], [0.42, 0.63], [0.62, 0.64], [0.8, 0.66], [0.78, 0.71], [0.6, 0.72], [0.46, 0.76], [0.62, 0.8], [0.84, 0.83], [0.87, 0.89], [0.8, 0.92], [0.62, 0.94], [0.5, 0.98], [0.42, 1.04], [0.2, 1.3], [0.29, 1.04], [0.15, 1.13], [0.16, 0.98], [0.06, 0.93], [-0.01, 0.95], [-0.02, 0.85], [-0.09, 0.82], [-0.06, 0.71], [-0.13, 0.64], [-0.1, 0.53], [-0.16, 0.44], [-0.12, 0.33], [-0.13, 0.15]];
  function gateHead(b, x, y, z, ry, s, o) {
    o = o || {};
    b.push(x, y, z, ry);
    b.extrude(0, 0, 0, HEAD.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.13 * s, { c: o.c || 'woodDark', m: M.wood, bevel: 0.012 * s });
    b.box(0.02 * s, 0.3 * s, 0, 0.3 * s, 0.06 * s, 0.17 * s, { c: o.c || 'woodDark', m: M.wood, bevel: 0.01 * s, rz: 0.15 });
    [-1, 1].forEach(function (sd) { b.ball(0.53 * s, 0.89 * s, sd * 0.075 * s, 0.03 * s, { c: '#e9e4da', m: M.paint, detail: 0, ao: 0 }); });
    [0.56, 0.66, 0.76].forEach(function (tx) { b.extrude(tx * s, 0.72 * s, 0, [[-0.025 * s, 0], [0.025 * s, 0], [0, 0.06 * s]], 0.05 * s, { c: '#e9e4da', m: M.paint, ao: 0 }); });
    b.pop();
  }
  // a round Norse shield facing local +z: a painted field, a pattern in the other colour, an iron rim and boss
  function gateShield(b, x, y, z, ry, r, kind, fc, pc, tilt) {
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
  // a square stave post with carved collars, a band of knotwork notches and a cap
  function gateStave(b, x, y, z, h, w, o) {
    o = o || {}; var c = o.c || 'beam';
    b.post(x, y, z, w / 2, h, { c: c, ry: o.ry || 0 });
    [0.16, h * 0.55, h - 0.42, h - 0.24].forEach(function (yy) { b.box(x, y + yy, z, w * 1.3, 0.07, w * 1.3, { c: c, m: M.wood, bevel: 0.015, ry: o.ry || 0 }); });
    for (var k = 0; k < 5; k++) b.box(x, y + h * 0.6 + k * 0.16, z, w * 1.08, 0.05, w * 1.08, { c: k % 2 ? c : 'woodDark', m: M.wood, bevel: 0.01, ry: (o.ry || 0) + Math.PI / 4 });
    b.box(x, y + h, z, w * 1.4, 0.12, w * 1.4, { c: c, m: M.wood, ry: o.ry || 0 });
  }
  // an iron chain from a to c ([x,y,z]), sagging a little, link by link
  function gateChain(b, a, c, sag) {
    var d = new T.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]), L = d.length(), n = Math.max(4, Math.round(L / 0.12)), link = new T.TorusGeometry(0.05, 0.014, 4, 8);
    for (var i = 0; i < n; i++) {
      var t = (i + 0.5) / n, s = sag * 4 * t * (1 - t);
      var p = [a[0] + d.x * t, a[1] + d.y * t - s, a[2] + d.z * t];
      var tan = d.clone().normalize(); tan.y -= sag * 4 * (1 - 2 * t) / L; tan.normalize();
      var q = new T.Quaternion().setFromUnitVectors(new T.Vector3(1, 0, 0), tan);
      if (i % 2) q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI / 2));
      var e = new T.Euler().setFromQuaternion(q, 'YXZ');
      b.addGeo(link, { x: p[0], y: p[1], z: p[2], rx: e.x, ry: e.y, rz: e.z, order: 'YXZ', sx: 1.45, c: 'iron', m: M.metal, ao: 0, jit: 0.02 });
    }
  }
  // flagstones or cobbles laid one by one over a rectangle, tops at y
  function gateSet(b, x0, x1, z0, z1, y, step, pal, o) {
    o = o || {};
    for (var gz = z0 + step * 0.4, row = 0; gz < z1 - step * 0.2; gz += step * 0.82, row++) {
      for (var gx = x0 + step * 0.45 + (row % 2) * step * 0.5; gx < x1 - step * 0.25; gx += step) {
        var jx = gx + b.j(step * 0.08), jz = gz + b.j(step * 0.06), w = step * (0.84 + b.j(0.06)), d = step * 0.7;
        if (o.skip && o.skip(jx, jz)) continue;
        w = Math.min(w, (Math.min(jx - x0, x1 - jx) - 0.02) * 2); if (w < step * 0.35) continue;
        b.box(jx, y - 0.1, jz, w, 0.12 + b.j(0.015), d, { ry: b.j(0.08), c: b.stoneC(pal || 'stoneCool', 1.2).offsetHSL(0, -0.02, o.dl || -0.04), m: M.stone, bevel: 0.035, ao: 0.1, jit: 0.04 });
      }
    }
  }
  // a stretch of turf: a soil body under a grassy top
  function gateTurf(b, x0, x1, z0, z1, y0, y1) {
    b.box((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0 - 0.1, z1 - z0, { c: '#6b5f50', m: M.soil, bevel: 0, ao: 0.1, jit: 0.02 });
    b.box((x0 + x1) / 2, y1 - 0.1, (z0 + z1) / 2, x1 - x0, 0.1, z1 - z0, { c: '#627152', m: M.grass, bevel: 0.03, ao: 0, jit: 0.02, vary: 0.08 });
  }
  // a banner hung flat against a tower: like the kit's banner but still, so the emblem stays on the cloth
  function gateBanner(b, x, y, z, w, h, o) {
    var sx = 4, sy = 10, g = KIT.geo.plane(w, h, sx, sy), p = g.attributes.position, wv = function (px, t) { return Math.sin(px * 3.1 + t * 2.0 + b.seed) * 0.02 * t; };
    for (var i = 0; i < p.count; i++) {
      var px = p.getX(i), py = p.getY(i), t = (h / 2 - py) / h;
      if (t > 0.82) { var k = (t - 0.82) / 0.18; py += (1 - Math.abs(px) / (w / 2)) * k * h * 0.14; }
      p.setXYZ(i, px, py - h / 2, wv(px, t));
    }
    g.computeVertexNormals();
    b.push(x, y, z, o.ry || 0);
    b.addGeo(g, { c: o.c || 'ink', m: M.cloth, bucket: 'cloth', ao: 0.15, jit: 0.02, vary: 0.04 });
    var b0 = o.bandAt || 0.7, bh = o.bandH || 0.06, gb = KIT.geo.plane(w, h * bh, sx, 2), pb = gb.attributes.position;
    for (var j = 0; j < pb.count; j++) { var bx = pb.getX(j), tb = b0 + (0.5 - pb.getY(j) / (h * bh)) * bh; pb.setXYZ(j, bx, h / 2 - tb * h - h / 2, wv(bx, tb)); }
    gb.computeVertexNormals();
    [0.011, -0.011].forEach(function (dz) { b.addGeo(gb.clone(), { z: dz, c: o.band || 'ember', m: M.cloth, bucket: 'cloth', ao: 0, jit: 0.01, vary: 0.02 }); });
    b.box(0, -0.06, 0.0, w, 0.12, 0.03, { c: 'iron', m: M.metal, bevel: 0.01 });
    b.beam([-w / 2 - 0.15, 0.02, 0.0], [w / 2 + 0.15, 0.02, 0.0], 0.035, { c: 'woodDark', round: true });
    b.emblem(0, -h * 0.42, 0, Math.min(w, h) * (o.es || 0.55), o.emblem || 'tower', o.ec || '#f1eee8');
    b.pop();
  }
  // a tuft of reeds standing in the wet of the ditch
  function gateReeds(b, x, z, n) {
    for (var i = 0; i < n; i++) {
      var a = b.r() * 6.28, d = b.r() * 0.25, h = 0.55 + b.r() * 0.5, lx = Math.cos(a) * d, lz = Math.sin(a) * d;
      b.beam([x + lx, 0, z + lz], [x + lx * 2.2 + b.j(0.12), h, z + lz * 2.2 + b.j(0.12)], 0.016, { c: b.pick(['#6e7d4e', '#7b8857', '#62703f', '#8a8f5c']), m: M.leaf, round: true, seg: 4, r2: 0.005 });
      if (b.chance(0.3)) b.beam([x + lx * 2.2, h * 0.92, z + lz * 2.2], [x + lx * 2.3, h * 1.08, z + lz * 2.3], 0.03, { c: '#5a4632', m: M.wood, round: true, seg: 5 });
    }
  }
  function gsm(a, c, x) { var t = Math.max(0, Math.min(1, (x - a) / (c - a))); return t * t * (3 - 2 * t); }
  var gR = 16.5, gSD = 7.3;
  function gEdge(x, z) { var a = Math.atan2(z, x), n3 = KIT.util.noise3; return gR * (1 + 0.07 * n3(Math.cos(a) * 1.6 + gSD, Math.sin(a) * 1.6, 0.5) + 0.035 * n3(Math.cos(a) * 4 + gSD, Math.sin(a) * 4, 2.5)); }
  function gLip(r) { var l = KIT.util.smooth(gR * 0.84, gR, r); return l * l * 0.55; }
  function gGround(b, x, z) { if (!b.ground) return 0; var r = Math.hypot(x, z); return b.ground.height(x, z) + gLip(r) - gLip(r / gEdge(x, z) * gR); }
  // a grassy bank laid as a height field over a rectangle: h(x, z) its top, never below the island's own ground;
  // cells that lie wholly at the ground are left out so nothing hangs past the island's edge
  function gateMound(b, x0, x1, z0, z1, step, h) {
    var nx = Math.max(2, Math.round((x1 - x0) / step)), nz = Math.max(2, Math.round((z1 - z0) / step)), pos = [], up = [], idx = [], i, j;
    for (j = 0; j <= nz; j++) for (i = 0; i <= nx; i++) {
      var x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz, g = gGround(b, x, z) - 0.04, er = gEdge(x, z), r = Math.hypot(x, z);
      var y = h(x, z) * (1 - gsm(er - 2.2, er - 1.1, r));
      pos.push(x, Math.max(y, g), z); up.push(y > 0.01 && y > g + 0.02 && r < er - 1.0);
    }
    for (j = 0; j < nz; j++) for (i = 0; i < nx; i++) {
      var a = j * (nx + 1) + i, c = a + 1, d = a + nx + 1, e = d + 1;
      if (up[a] || up[c] || up[d]) idx.push(a, d, c);
      if (up[c] || up[d] || up[e]) idx.push(c, d, e);
    }
    var g2 = new T.BufferGeometry(); g2.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g2.setIndex(idx); g2.computeVertexNormals();
    b.addGeo(g2, { c: '#627152', m: M.grass, ao: 0, jit: 0.02, vary: 0.08 });
  }
  // cobbles laid one by one on the island's ground, each tipped to the slope under it; keep(x, z) says where
  function gateCobbles(b, x0, x1, z0, z1, step, keep) {
    for (var gz = z0 + step * 0.4, row = 0; gz < z1; gz += step * 0.82, row++) {
      for (var gx = x0 + step * 0.45 + (row % 2) * step * 0.5; gx < x1 - step * 0.25; gx += step) {
        var jx = gx + b.j(step * 0.08), jz = gz + b.j(step * 0.06);
        if (keep && !keep(jx, jz)) continue;
        var g = gGround(b, jx, jz), sx = gGround(b, jx + 0.2, jz) - gGround(b, jx - 0.2, jz), sz = gGround(b, jx, jz + 0.2) - gGround(b, jx, jz - 0.2);
        b.push(jx, g, jz, b.j(0.08)); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationFromEuler(new T.Euler(-Math.atan2(sz, 0.4), 0, Math.atan2(sx, 0.4))));
        b.box(0, -0.08, 0, step * (0.84 + b.j(0.06)), 0.13 + b.j(0.015), step * 0.7, { c: b.stoneC('stoneCool', 1.2).offsetHSL(0, -0.02, -0.04), m: M.stone, bevel: 0.035, ao: 0.1, jit: 0.04 });
        b.pop();
      }
    }
  }
  // the toll house at the road foot: a little hut of upright dark boards on a stone sill, a slate roof, a carved
  // dragon on its gable, a door and a shuttered window toward the road
  function gateHut(b, cx, cz) {
    var W = 2.4, D = 2.3, x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
    var ys = [gGround(b, x0 - 0.3, z0 - 0.3), gGround(b, x1 + 0.3, z0 - 0.3), gGround(b, x0 - 0.3, z1 + 0.3), gGround(b, x1 + 0.3, z1 + 0.3), gGround(b, cx, cz)];
    var ylo = Math.min.apply(null, ys), yhi = Math.max.apply(null, ys), PY = yhi + 0.42, WH2 = 1.95, EV = PY + WH2, RS = 1.3, DX = x1 - 0.5;
    b.part('Toll house');
    b.unit(function () {
      b.box(cx, ylo - 0.25, cz, W + 0.5, yhi - ylo + 0.33, D + 0.5, { c: 'stoneDark', bevel: 0.05 });
      b.stoneBox(cx, cz, W + 0.3, D + 0.3, yhi + 0.06, PY - yhi - 0.06, 0.36, { pal: 'stone', course: PY - yhi - 0.06, len: 0.52 });
      b.box(cx, PY - 0.12, cz, W - 0.1, 0.12, D - 0.1, { c: 'woodDark', m: M.wood, bevel: 0.01 });
      b.box(DX, ylo - 0.1, z1 + 0.36, 0.95, PY - ylo + 0.07, 0.42, { c: 'sandstone', m: M.stone, bevel: 0.04 });
    });
    var win = { y0: 0.8, y1: 1.4, shutters: '#1f1e1c' };
    b.timberWall(x0, z1, x1 - 1.0, z1, PY, { h: WH2, post: 0.7, windows: [Object.assign({ t: 0.35, w: 0.44, flowers: '#f3f1ec' }, win), Object.assign({ t: 1.05, w: 0.44, flowers: '#efebe4' }, win)] });
    b.timberWall(x0, z0, x0, z1, PY, { h: WH2, post: 0.8, windows: [Object.assign({ t: 1.15, w: 0.46 }, win)] });
    b.timberWall(x1, z1, x1, z0, PY, { h: WH2, post: 0.8 });
    b.timberWall(x1, z0, x0, z0, PY, { h: WH2, post: 0.8 });
    b.unit(function () {
      // the door: boards, iron straps and a ring, a threshold and a lintel, a plastered panel above
      b.planks(DX, PY + 0.05, z1 - 0.01, 0.8, 1.66, { vertical: true, c: '#3a2d23', t: 0.06, pw: 0.2 });
      [0.42, 1.32].forEach(function (yy) { b.box(DX, PY + yy, z1 + 0.03, 0.72, 0.06, 0.02, { c: 'iron', m: M.metal, bevel: 0.005 }); });
      b.addGeo(new T.TorusGeometry(0.06, 0.016, 4, 10), { x: DX - 0.24, y: PY + 0.92, z: z1 + 0.05, c: 'iron', m: M.metal, ao: 0 });
      b.box(DX, PY - 0.02, z1 + 0.02, 0.88, 0.08, 0.22, { c: 'woodDark', m: M.wood, bevel: 0.015 });
      b.beam([x1 - 1.0, PY + 1.76, z1 + 0.02], [x1, PY + 1.76, z1 + 0.02], 0.08, { c: 'beam' });
      b.beam([x1 - 1.0, EV - 0.1, z1], [x1, EV - 0.1, z1], 0.12, { c: 'beam' });
      b.box(DX, PY + 1.84, z1 - 0.02, 0.8, EV - 0.22 - (PY + 1.84), 0.16, { c: 'plaster', m: M.plaster, bevel: 0.01 });
    });
    b.unit(function () {
      [z1, z0].forEach(function (z) {
        b.gableEnd(cx, EV, z, W, RS - 0.1, 0.14, { ry: 0, c: 'plaster' });
        var zf = z + (z > cz ? 0.09 : -0.09);
        b.beam([cx, EV, zf], [cx, EV + RS - 0.2, zf], 0.065, { c: 'beam' });
        b.beam([cx - 0.72, EV + 0.42, zf], [cx + 0.72, EV + 0.42, zf], 0.055, { c: 'beam' });
        [-1, 1].forEach(function (s) { b.beam([cx + s * (W / 2 - 0.08), EV + 0.04, zf], [cx, EV + RS - 0.16, zf], 0.065, { c: 'beam' }); });
      });
    });
    b.gableRoof(cx, EV, cz, D, W, RS, { m: 'slate', over: 0.3, overX: 0.34, rows: 4, ry: Math.PI / 2 });
    b.unit(function () {
      var slope = Math.atan2(RS, W / 2), ex = W / 2 + 0.3, ey = EV - 0.3 * Math.tan(slope);
      [z1 + 0.38, z0 - 0.38].forEach(function (z, fi) {
        [-1, 1].forEach(function (s) { b.beam([cx + s * ex, ey + 0.1, z], [cx, EV + RS + 0.16, z], 0.07, { c: 'woodDark', r2: 0.03 }); });
        gateHead(b, cx + 0.03, EV + RS + 0.04, z, fi ? Math.PI : 0, 0.66);
      });
      b.torch(x1 - 1.0, PY + 1.4, z1 + 0.12, { s: 0.5 });
    });
    return { PY: PY, EV: EV, x0: x0, x1: x1, z0: z0, z1: z1 };
  }

  // the frame of the build: heights and plan
  var HB = 1.1, BASE = 1.25, CH = 0.4;                                     // rampart top, wall base, course height
  var GX = 2.7, GZ0 = -5.2, GZ1 = 0.4, GZC = -2.4, GT = 0.7, GH = 6.0;      // the gatehouse
  var AW = 2.8, AS = 2.6, AR = 1.4;                                        // the arch: width, spring, radius
  var TX = 4.6, TZ = -0.8, TR = 2.1, TT = 0.65, TH = 8.4;                  // the towers
  var WZ = -2.0, WT = 1.6, WX0 = 5.8, WX1 = 10.5, WH = 4.8;                 // the curtain walls
  var PX = 11.5, PZ0 = -5.6, PZ1 = 2.4, NX = 1.6;                           // the rampart and the bridge pit
  var CZ0 = 5.6, CZ1 = 7.2, GL = 9.0, RZ1 = 10.6, RW = 1.6;                 // counterscarp, glacis foot, ramp
  var HX = 1.85, HZ0 = -4.75, HZ1 = -0.9, HY = BASE + GH + 0.12, EAVE = BASE + 8.3; // the gate hall

  KIT.defineBuild('gate', {
    name: 'Town gate', size: 'big', need: 80,
    line: 'A stone gatehouse between twin round towers, its portcullis half raised over a drawbridge across the ditch, with walls, banners, the gate guard and a toll house at the road foot.',
    r: 16.5, flat: [25, 21.6], ground: 'grass', path: [[0.8, 16.4], [0.5, 10.4], [0.4, -8.8], [-0.6, -17.5]],
    frameY: 5.0, frameR: 15.8, glowAt: [TX, BASE + 15.3, TZ],
    trees: [{ x: -12.6, z: 4.6, kind: 'round', h: 6.2 }, { x: -10.5, z: -8.4, kind: 'pine', h: 8.2 }, { x: 12.6, z: 4.4, kind: 'cypress', h: 7.4 }, { x: 10.6, z: -8.6, kind: 'pine', h: 7.6 }, { x: -5.4, z: -11.2, kind: 'round', h: 5.6 }, { x: 5.0, z: -11.8, kind: 'olive', h: 4.8 }],
    bushes: [{ x: -14.5, z: 1.0, r: 0.85 }, { x: 14.4, z: -1.4, r: 0.8, flowers: '#f3f1ec' }, { x: -2.9, z: 14.7, r: 0.7, flowers: '#f3f1ec' }, { x: 5.3, z: 13.7, r: 0.75 }, { x: -9.5, z: 10.3, r: 0.72 }],
    perches: [{ x: 0, y: EAVE + 2.95, z: (HZ0 + HZ1) / 2, ry: 0 }, { x: -8.8, y: BASE + WH + 0.1, z: WZ - 0.1, ry: 0.2 }, { x: 8.6, y: BASE + WH + 0.1, z: WZ - 0.1, ry: -0.2 }],
    build: function (b, opts) {
      var self = b;
      gSD = ((opts && opts.seed) || 1) * 7.3;   // the island's own seed, so the banks can find its edge

      // ------------------------------------------------------------ earthworks
      b.part('Rampart and ditch');
      b.unit(function () {
        // the rampart's earth body: two wings and the bit behind the bridge pit
        gateTurf(b, -PX + 0.3, -NX - 0.3, PZ0 + 0.3, PZ1 - 0.3, 0, HB);
        gateTurf(b, NX + 0.3, PX - 0.3, PZ0 + 0.3, PZ1 - 0.3, 0, HB);
        gateTurf(b, -NX - 0.4, NX + 0.4, PZ0 + 0.3, GZ1 - 0.3, 0, HB);
      });
      b.unit(function () {
        // the counterscarp bank and its grassy glacis falling away to the field
        gateTurf(b, -PX + 0.3, PX - 0.3, CZ0 + 0.3, CZ1, 0, HB);
        b.extrude(0, 0, 0, [[-CZ1, HB - 0.02], [-CZ1, 0], [-GL, 0]], 2 * PX - 0.6, { ry: Math.PI / 2, c: '#627152', m: M.grass, ao: 0, jit: 0.02, vary: 0.08 });
      });
      // the rampart and counterscarp faced in stone, course by course
      var RC = HB / 3;
      for (var rk = 0; rk < 3; rk++) {
        (function (k) {
          var y = k * RC, o = { course: RC, len: 0.75, pal: 'stone' };
          b.unit(function () {
            b.stoneWall(-PX, PZ1 - 0.25, -NX, PZ1 - 0.25, y, RC, 0.5, o);
            b.stoneWall(NX, PZ1 - 0.25, PX, PZ1 - 0.25, y, RC, 0.5, o);
            b.stoneWall(-NX - 0.25, GZ1 - 0.1, -NX - 0.25, PZ1 - 0.5, y, RC, 0.5, o);
            b.stoneWall(NX + 0.25, PZ1 - 0.5, NX + 0.25, GZ1 - 0.1, y, RC, 0.5, o);
            b.stoneWall(-NX, GZ1 - 0.25, NX, GZ1 - 0.25, y, RC, 0.5, o);
            b.stoneWall(-PX + 0.5, PZ0 + 0.25, PX - 0.5, PZ0 + 0.25, y, RC, 0.5, o);
          });
          b.unit(function () {
            b.stoneWall(-PX, CZ0 + 0.25, PX, CZ0 + 0.25, y, RC, 0.5, o);
          });
        })(rk);
      }
      b.unit(function () {
        // coping slabs along the lip of the ditch and the bridge pit
        var cope = function (ax, az, bx, bz) {
          var L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, n = Math.round(L / 0.62), ry = -Math.atan2(uz, ux);
          for (var i = 0; i < n; i++) { var t = (i + 0.5) / n * L; b.box(ax + ux * t, HB - 0.02, az + uz * t, L / n - 0.04, 0.13 + b.j(0.01), 0.62, { ry: ry + b.j(0.015), c: b.stoneC('sandstone'), m: M.stone, bevel: 0.035, ao: 0.1 }); }
        };
        cope(-PX, PZ1 - 0.27, -NX - 0.02, PZ1 - 0.27); cope(NX + 0.02, PZ1 - 0.27, PX, PZ1 - 0.27);
        cope(-NX - 0.27, GZ1 + 0.05, -NX - 0.27, PZ1 - 0.6); cope(NX + 0.27, GZ1 + 0.05, NX + 0.27, PZ1 - 0.6);
        cope(-PX, CZ0 + 0.27, -RW - 0.1, CZ0 + 0.27); cope(RW + 0.1, CZ0 + 0.27, PX, CZ0 + 0.27);
      });
      b.unit(function () {
        // the ramp up to the bridge foot, and the way down behind the gate
        b.extrude(0, 0, 0, [[-CZ1 + 0.05, HB - 0.08], [-CZ1 + 0.05, 0], [-RZ1 - 0.1, 0]], 2 * RW + 0.75, { ry: Math.PI / 2, c: '#627152', m: M.grass, ao: 0, jit: 0.02, vary: 0.08 });
        b.extrude(0, 0, 0, [[-PZ0 - 0.05, HB - 0.08], [-PZ0 - 0.05, 0], [-PZ0 + 3.2, 0]], 2 * RW, { ry: Math.PI / 2, c: '#8f8270', m: M.dirt, ao: 0 });
        // kerbs either side of the ramp
        var sl = Math.atan2(HB, RZ1 - CZ1), Ls = Math.hypot(HB, RZ1 - CZ1), nk = 6;
        [-1, 1].forEach(function (s) { for (var i = 0; i < nk; i++) { var t = (i + 0.5) / nk; b.push(s * (RW + 0.12), HB * (1 - t) - 0.05, CZ1 + t * (RZ1 - CZ1), 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(sl)); b.box(0, -0.1, 0, 0.3, 0.32, Ls / nk - 0.05, { c: b.stoneC('stone'), m: M.stone, bevel: 0.05 }); b.pop(); } });
      });
      b.unit(function () {
        // cobbles up the ramp, laid along the slope
        var sl = Math.atan2(HB, RZ1 - CZ1), step = 0.46, n = Math.floor((RZ1 - CZ1) / Math.cos(sl) / (step * 0.82));
        for (var r = 0; r < n; r++) {
          var t = (r + 0.5) / n, z = CZ1 + t * (RZ1 - CZ1), y = HB * (1 - t);
          for (var x = -RW + 0.28 + (r % 2) * 0.22; x < RW - 0.2; x += step) {
            b.push(x + b.j(0.03), y, z, b.j(0.08)); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(sl));
            b.box(0, -0.09, 0, step * 0.84, 0.13, step * 0.7, { c: b.stoneC('stoneCool', 1.2).offsetHSL(0, -0.02, -0.04), m: M.stone, bevel: 0.035, ao: 0.1 });
            b.pop();
          }
        }
      });
      b.unit(function () { gateSet(b, -RW, RW, CZ0 + 0.25, CZ1 - 0.02, HB + 0.03, 0.46, 'stoneCool'); });
      // the banks close round the ends of the ditch and roll away into the field, both sides
      var endH = function (x, z) {
        var xa = Math.abs(x), out = 1 - gsm(11.6, 14.4, xa), prof;
        if (z < PZ0 + 0.25) prof = HB * gsm(PZ0 - 1.3, PZ0 + 0.25, z); else if (z <= CZ1) prof = HB; else prof = HB * Math.max(0, (GL - z) / (GL - CZ1));
        var dm = gsm(PZ1 - 0.1, PZ1 + 0.4, z) * (1 - gsm(CZ0 - 0.4, CZ0 + 0.1, z)), hd = HB * gsm(10.4, 11.6, xa);
        return (prof * (1 - dm) + hd * dm) * out - 0.05 * (1 - gsm(11.35, 11.7, xa)) * (1 - dm);
      };
      b.unit(function () { gateMound(b, -14.6, -10.3, PZ0 - 1.5, GL + 0.15, 0.2, endH); gateMound(b, 10.3, 14.6, PZ0 - 1.5, GL + 0.15, 0.2, endH); });
      // a cobbled apron where the road meets the ramp, running out into the dirt road
      var apron = function (x, z) {
        var hw = z < 12.6 ? 1.75 + (z - 10.6) * 0.45 : 2.65 - (z - 12.6) * 0.52;
        if (z > 13.6 && b.r() < (z - 13.6) / 1.4) return false;
        return Math.abs(x - 0.25) < hw;
      };
      b.unit(function () { gateCobbles(b, -2.6, 3.0, RZ1 + 0.02, 12.6, 0.46, apron); });
      b.unit(function () { gateCobbles(b, -2.6, 3.0, 12.5, 15.0, 0.46, apron); });
      b.unit(function () {
        // the ditch floor: a trodden line where the old ford was, wet hollows and reeds
        for (var i = 0; i < 9; i++) { var x = -10.5 + i * 2.6 + b.j(0.6); if (Math.abs(x) < 2.2) continue; b.cyl(x, 0.0, (PZ1 + CZ0) / 2 + b.j(0.5), 0.6 + b.r() * 0.5, 0.025, { c: '#4c5458', m: M.water, seg: 14, flat: true, sx: 1.8, jit: 0.02, ao: 0 }); }
        for (var j = 0; j < 22; j++) { var x2 = -11 + b.r() * 22, z2 = PZ1 + 0.2 + b.r() * (CZ0 - PZ1 - 0.4); b.ball(x2, 0.0, z2, 0.18 + b.r() * 0.2, { c: b.pick(['#5c5246', '#4f473d', '#665b4c']), m: M.soil, sy: 0.25, detail: 1, ao: 0.2 }); }
        for (var k2 = 0; k2 < 26; k2++) { var x3 = -11 + b.r() * 22; if (Math.abs(x3) < 1.9) continue; gateReeds(b, x3, b.chance(0.5) ? PZ1 + 0.25 : CZ0 - 0.25, 4 + Math.round(b.r() * 4)); }
        for (var g = 0; g < 40; g++) { var x4 = -11 + b.r() * 22, z4 = PZ1 + 0.3 + b.r() * (CZ0 - PZ1 - 0.6); b.grass(x4, 0, z4, 0.3 + b.r() * 0.3); }
        for (var q = 0; q < 7; q++) b.rock(-10 + b.r() * 20, 0.02, PZ1 + 0.4 + b.r() * 2.4, 0.18 + b.r() * 0.2);
      });

      // ------------------------------------------------------------ gatehouse and towers
      b.part('Footings');
      b.unit(function () {
        b.box(0, HB - 0.05, (GZ0 - 0.25 + GZ1 + 0.08) / 2, 2 * GX + 0.5, BASE - HB + 0.05, GZ1 - GZ0 + 0.33, { c: 'stoneDark', bevel: 0.05 });
        [-1, 1].forEach(function (s) {
          b.cyl(s * TX, HB - 0.05, TZ, TR + 0.55, BASE - HB + 0.05, { c: 'stoneDark', m: M.stone, seg: 26, flat: true });
          b.box(s * (WX0 + WX1 + 0.4) / 2, HB - 0.05, WZ, WX1 - WX0 + 0.6, BASE - HB + 0.05, WT + 0.4, { c: 'stoneDark', bevel: 0.05 });
        });
      });
      b.unit(function () { gateSet(b, -AW / 2 + 0.02, AW / 2 - 0.02, GZ0 - 0.4, GZ1, BASE + 0.04, 0.42, 'stone', { dl: -0.02 }); });

      // the arch holes, course by course: full width to the spring, then narrowing round the curve
      var archHoles = [];
      for (var ak = 0; ak < GH / CH; ak++) {
        var yb = ak * CH, yt = yb + CH, hw;
        if (yt <= AS + 0.001) hw = AW / 2;
        else if (yb < AS + AR) { var dy = Math.max(0, yb - AS); hw = Math.sqrt(Math.max(0, AR * AR - dy * dy)); } else hw = 0;
        if (hw > 0.1) ['front', 'back'].forEach(function (sd) { archHoles.push({ side: sd, at: 0, w: hw * 2, y0: BASE + yb, y1: BASE + yt }); });
      }
      var SLITS = [[0.72, 3.6, 4.45], [2.32, 2.0, 2.85], [2.32, 5.6, 6.45], [0.5 * Math.PI + 0.62, 7.0, 7.7]];
      var adiff = function (a, c) { return Math.abs(((a - c) + Math.PI * 3) % (Math.PI * 2) - Math.PI); };
      var towerSkip = function (s, aw, yy, r) {
        var px = s * TX + Math.cos(aw) * r, pz = TZ + Math.sin(aw) * r, ry = yy - BASE;
        if (ry < GH && Math.abs(px) < GX - 0.06 && pz < GZ1 - 0.06 && pz > GZ0) return true;
        if (ry < WH && Math.abs(pz - WZ) < WT / 2 - 0.1 && Math.abs(px) > TX) return true;
        for (var i = 0; i < SLITS.length; i++) { var a0 = s > 0 ? SLITS[i][0] : Math.PI - SLITS[i][0]; if (adiff(aw, a0) < 0.17 && ry > SLITS[i][1] && ry < SLITS[i][2]) return true; }
        return false;
      };
      var towerCourse = function (s, k) {
        var y = BASE + k * CH, r = k === 0 ? TR + 0.3 : k === 1 ? TR + 0.15 : TR, ns = Math.max(6, Math.round(Math.PI * 2 * r / 0.8)), rot = (k % 2) * Math.PI / ns + s * 0.07;
        b.push(s * TX, 0, TZ, rot);
        b.stoneRing(0, 0, r, y, CH, TT, { pal: 'stone', course: CH, len: 0.8, hole: function (a, yy) { return towerSkip(s, a - rot, yy, r); } });
        b.pop();
      };
      var gateCourse = function (k) {
        var y = BASE + k * CH;
        b.stoneBox(0, GZC, 2 * GX, GZ1 - GZ0, y, CH, GT, { pal: 'stone', course: CH, len: 0.66, holes: archHoles });
        if (y < BASE + AS - 0.3) [-1, 1].forEach(function (s) { b.stoneWall(s * (AW / 2 + 0.15), GZ1 - GT, s * (AW / 2 + 0.15), GZ0 + GT, y, CH, 0.3, { pal: 'stone', course: CH, len: 0.6, core: false }); });
      };
      // the arch: voussoirs round the curve and jambs down the sides, facing +z (or -z with ry)
      var gateArch = function (z, ry) {
        b.push(0, BASE, z, ry);
        var n = 13, fw = 0.36;
        for (var s = 0; s < n; s++) {
          var a0 = Math.PI - s / (n - 1) * Math.PI, cx = Math.cos(a0) * (AR + fw / 2), cy = AS + Math.sin(a0) * (AR + fw / 2);
          b.push(cx, cy, 0.04, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(a0 - Math.PI / 2));
          b.box(0, -fw / 2, 0, (Math.PI * (AR + fw / 2)) / n * 0.9, fw * (s === (n - 1) / 2 ? 1.25 : 1), 0.3, { c: s === (n - 1) / 2 ? '#d9d3c8' : b.stoneC('sandstone'), m: M.stone, bevel: 0.05 });
          b.pop();
        }
        var jn = 6;
        for (var q = 0; q < jn; q++) [-1, 1].forEach(function (sd) { var big = q % 2 === 0; b.box(sd * (AW / 2 + (big ? 0.22 : 0.15)), q * AS / jn, 0.04, big ? 0.44 : 0.3, AS / jn - 0.04, 0.3, { c: b.stoneC('sandstone'), m: M.stone, bevel: 0.05 }); });
        [-1, 1].forEach(function (sd) { b.box(sd * (AW / 2 + 0.2), AS - 0.02, 0.05, 0.56, 0.16, 0.34, { c: '#d9d3c8', m: M.stone, bevel: 0.04 }); });
        b.pop();
      };

      b.part('Gatehouse and towers');
      for (var k = 0; k < TH / CH; k++) {
        (function (k) {
          if (k < GH / CH) b.unit(function () { gateCourse(k); });
          b.unit(function () { towerCourse(-1, k); });
          b.unit(function () { towerCourse(1, k); });
          if (k === 6) {
            b.unit(function () {
              // the passage: an impost course and the barrel vault over it
              [-1, 1].forEach(function (s) { b.box(s * (AW / 2 + 0.1), BASE + AS - 0.2, GZC, 0.36, 0.2, GZ1 - GZ0 - 0.1, { c: 'sandstone', m: M.stone, bevel: 0.04 }); });
              var pts = [], i;
              for (i = 0; i <= 14; i++) { var a = i / 14 * Math.PI; pts.push([Math.cos(a) * (AR + 0.55), Math.sin(a) * (AR + 0.55)]); }
              for (i = 14; i >= 0; i--) { var a2 = i / 14 * Math.PI; pts.push([Math.cos(a2) * AR, Math.sin(a2) * AR]); }
              b.extrude(0, BASE + AS, GZC, pts, GZ1 - GZ0 - 0.16, { c: 'stoneDark', m: M.stone, ao: 0.2 });
            });
          }
          if (k === 10) b.unit(function () { gateArch(GZ1, 0); gateArch(GZ0, Math.PI); });
        })(k);
      }

      b.part('Portcullis');
      b.unit(function () {
        // oak bars shod with iron points, hanging half raised in its slot just inside the arch
        var pz = GZ1 - 0.32, yb = BASE + 1.95;
        for (var i = 0; i < 10; i++) {
          var x = -AW / 2 + 0.12 + i * (AW - 0.24) / 9;
          b.box(x, yb, pz, 0.11, 2.6, 0.12, { c: 'woodDark', m: M.wood, bevel: 0.015 });
          b.cone(x, yb, pz, 0.06, 0.24, { c: 'iron', m: M.metal, seg: 4, rx: Math.PI, flat: true });
        }
      });
      b.unit(function () {
        var pz = GZ1 - 0.32, yb = BASE + 1.95;
        for (var j = 0; j < 6; j++) b.box(0, yb + 0.18 + j * 0.42, pz + 0.075, AW + 0.06, 0.08, 0.05, { c: 'iron', m: M.metal, bevel: 0.01 });
        for (var i = 0; i < 10; i++) { var x = -AW / 2 + 0.12 + i * (AW - 0.24) / 9; for (var j2 = 0; j2 < 6; j2++) b.ball(x, yb + 0.22 + j2 * 0.42, pz + 0.1, 0.03, { c: 'iron', m: M.metal, detail: 0 }); }
      });

      b.part('Arrow slits and the town arms');
      b.unit(function () {
        [-1, 1].forEach(function (s) {
          SLITS.forEach(function (sl) {
            var a = s > 0 ? sl[0] : Math.PI - sl[0];
            b.box(s * TX + Math.cos(a) * (TR + 0.02), BASE + sl[1] + 0.03, TZ + Math.sin(a) * (TR + 0.02), 0.15, sl[2] - sl[1] - 0.06, 0.2, { ry: -a - Math.PI / 2, c: '#1c1b1a', m: M.dark, bevel: 0, ao: 0 });
            b.box(s * TX + Math.cos(a) * (TR + 0.3), BASE + sl[1] - 0.12, TZ + Math.sin(a) * (TR + 0.3), 0.62, 0.14, 0.24, { ry: -a - Math.PI / 2, c: 'sandstone', m: M.stone, bevel: 0.03 });
          });
        });
      });
      b.unit(function () {
        // the town's arms over the gate: a bone tower on an ink shield, on a carved sandstone panel
        b.box(0, BASE + 4.48, GZ1 + 0.03, 1.0, 0.86, 0.16, { c: '#d6d0c4', m: M.stone, bevel: 0.04 });
        b.shield(0, BASE + 4.95, GZ1 + 0.13, { kind: 'heater', c: 'ink', emblem: 'tower', ec: '#f1eee8', s: 0.88 });
      });

      b.part('Curtain walls');
      for (var wk = 0; wk < WH / CH; wk++) {
        (function (k) {
          b.unit(function () {
            var y = BASE + k * CH, tooth = (k % 2) ? 0.45 : 0;
            b.stoneWall(-(WX1 - tooth), WZ, -WX0, WZ, y, CH, WT, { pal: 'stone', course: CH, len: 0.72 });
            b.stoneWall(WX0, WZ, WX1 - tooth, WZ, y, CH, WT, { pal: 'stone', course: CH, len: 0.72 });
          });
        })(wk);
      }
      b.unit(function () {
        // the wall walk: flags laid along the top, and the low rear parapet
        [-1, 1].forEach(function (s) {
          var x0 = s < 0 ? -WX1 + 0.5 : WX0 + 0.6, x1 = s < 0 ? -WX0 - 0.6 : WX1 - 0.5;
          gateSet(b, x0, x1, WZ - WT / 2 + 0.38, WZ + WT / 2 - 0.42, BASE + WH + 0.1, 0.5, 'stone', { dl: 0 });
          b.stoneWall(x0 - 0.1, WZ - WT / 2 + 0.19, x1 + 0.1, WZ - WT / 2 + 0.19, BASE + WH, 0.45, 0.38, { pal: 'stone', course: 0.45, len: 0.7 });
        });
      });
      b.unit(function () {
        // the front breastwork, then the merlons, each capped
        [-1, 1].forEach(function (s) {
          var x0 = s < 0 ? -WX1 + 0.5 : WX0 + 0.6, x1 = s < 0 ? -WX0 - 0.6 : WX1 - 0.5, zf = WZ + WT / 2 - 0.21;
          b.stoneWall(x0 - 0.1, zf, x1 + 0.1, zf, BASE + WH, 0.48, 0.42, { pal: 'stone', course: 0.48, len: 0.7 });
        });
      });
      b.unit(function () {
        [-1, 1].forEach(function (s) {
          var x0 = s < 0 ? -WX1 + 0.5 : WX0 + 0.6, x1 = s < 0 ? -WX0 - 0.6 : WX1 - 0.5, zf = WZ + WT / 2 - 0.21, n = Math.round((x1 - x0) / 1.1);
          for (var i = 0; i <= n; i++) {
            var x = x0 + i * (x1 - x0) / n;
            b.box(x, BASE + WH + 0.48, zf, 0.66, 0.36, 0.42, { c: b.stoneC('stone', 6), m: M.stone, bevel: 0.05, ry: b.j(0.02) });
            b.box(x + b.j(0.03), BASE + WH + 0.86, zf, 0.62, 0.3, 0.42, { c: b.stoneC('stone', 6), m: M.stone, bevel: 0.05, ry: b.j(0.02) });
            b.box(x, BASE + WH + 1.18, zf, 0.74, 0.12, 0.5, { c: b.stoneC('sandstone'), m: M.stone, bevel: 0.035 });
          }
        });
      });

      b.part('Gatehouse parapet');
      b.unit(function () {
        // machicolations: a row of corbels carrying the parapet out over the gate
        for (var i = 0; i < 10; i++) { var x = -2.3 + i * 4.6 / 9; b.box(x, BASE + 5.56, GZ1 + 0.18, 0.28, 0.4, 0.5, { c: 'sandstone', m: M.stone, bevel: 0.04, taper: 1.0 }); b.box(x, BASE + 5.38, GZ1 + 0.06, 0.24, 0.2, 0.22, { c: 'sandstone', m: M.stone, bevel: 0.03 }); }
        b.box(0, BASE + GH, GZC + 0.1, 2 * GX, 0.12, GZ1 - GZ0 - 0.2, { c: 'stoneDark', m: M.stone, bevel: 0.02 });
      });
      b.unit(function () {
        b.box(0, BASE + 5.95, GZ1 + 0.2, 5.2, 0.22, 0.9, { c: 'sandstone', m: M.stone, bevel: 0.04 });
        b.stoneWall(-2.6, GZ1 + 0.44, 2.6, GZ1 + 0.44, BASE + 6.17, 0.45, 0.42, { pal: 'stone', course: 0.45, len: 0.66 });
        b.stoneWall(-2.0, GZ0 + 0.11, 2.0, GZ0 + 0.11, BASE + 6.12, 0.42, 0.22, { pal: 'stone', course: 0.42, len: 0.6 });
      });
      b.unit(function () {
        for (var i = 0; i < 5; i++) {
          var x = -2.2 + i * 1.1;
          b.box(x, BASE + 6.62, GZ1 + 0.44, 0.62, 0.4, 0.42, { c: b.stoneC('stone', 6), m: M.stone, bevel: 0.05 });
          b.box(x, BASE + 7.02, GZ1 + 0.44, 0.58, 0.28, 0.42, { c: b.stoneC('stone', 6), m: M.stone, bevel: 0.05 });
          b.box(x, BASE + 7.3, GZ1 + 0.44, 0.7, 0.12, 0.5, { c: b.stoneC('sandstone'), m: M.stone, bevel: 0.035 });
        }
        gateSet(b, -1.8, 1.8, HZ1 + 0.05, GZ1 + 0.2, HY + 0.02, 0.5, 'stone', { dl: 0 });
      });

      b.part('Tower crowns');
      b.unit(function () {
        [-1, 1].forEach(function (s) {
          for (var i = 0; i < 20; i++) { var a = i / 20 * Math.PI * 2; b.box(s * TX + Math.cos(a) * (TR + 0.12), BASE + TH, TZ + Math.sin(a) * (TR + 0.12), 0.32, 0.38, 0.52, { ry: -a - Math.PI / 2, c: 'sandstone', bevel: 0.05, taper: 1.0 }); }
          b.cyl(s * TX, BASE + TH + 0.38, TZ, TR + 0.5, 0.22, { c: 'sandstone', m: M.stone, seg: 28, flat: true });
        });
      });
      // the parapet ring, two courses, the upper pierced with little watch windows
      var CROWN = function (a) { var f = ((a - 0.35) / (Math.PI * 2) * 7 % 1 + 1) % 1; return f < 0.1; };
      [0, 1].forEach(function (k) {
        b.unit(function () { [-1, 1].forEach(function (s) { var rot = k * 0.2; b.push(s * TX, 0, TZ, rot); b.stoneRing(0, 0, TR + 0.28, BASE + TH + 0.6 + k * 0.4, 0.4, 0.42, { pal: 'stone', course: 0.4, len: 0.7, hole: k ? function (a) { return CROWN(a - rot); } : null }); b.pop(); }); });
      });
      b.unit(function () {
        [-1, 1].forEach(function (s) { for (var i = 0; i < 7; i++) { var a = 0.35 + (i + 0.05) / 7 * Math.PI * 2; b.box(s * TX + Math.cos(a) * (TR + 0.16), BASE + TH + 1.02, TZ + Math.sin(a) * (TR + 0.16), 0.36, 0.34, 0.1, { ry: -a - Math.PI / 2, c: '#1c1b1a', m: M.dark, bevel: 0, ao: 0 }); } });
      });

      // ------------------------------------------------------------ the gate hall
      b.part('Gate hall');
      var win = { y0: 0.75, y1: 1.75, shutters: '#1f1e1c' };
      b.timberWall(-HX, HZ1, HX, HZ1, HY, { h: EAVE - HY, post: 0.95, windows: [Object.assign({ t: 1.39, w: 0.56, flowers: '#f3f1ec' }, win), Object.assign({ t: 2.31, w: 0.56, flowers: '#efebe4' }, win)] });
      b.timberWall(-HX, HZ0, -HX, HZ1, HY, { h: EAVE - HY, post: 1.0, windows: [Object.assign({ t: 2.5, w: 0.56 }, win)] });
      b.timberWall(HX, HZ1, HX, HZ0, HY, { h: EAVE - HY, post: 1.0, windows: [Object.assign({ t: 1.5, w: 0.56 }, win)] });
      b.timberWall(HX, HZ0, -HX, HZ0, HY, { h: EAVE - HY, post: 0.95 });

      b.part('Gate hall roof');
      var RISE = 2.8;
      b.unit(function () {
        [HZ1, HZ0].forEach(function (z) {
          b.gableEnd(0, EAVE, z, 2 * HX, RISE - 0.12, 0.16, { ry: 0, c: 'plaster' });
          var zf = z + (z > -3 ? 0.1 : -0.1);
          b.beam([0, EAVE, zf], [0, EAVE + RISE - 0.2, zf], 0.08, { c: 'beam' });
          b.beam([-1.15, EAVE + 0.75, zf], [1.15, EAVE + 0.75, zf], 0.07, { c: 'beam' });
          [-1, 1].forEach(function (s) { b.beam([s * (HX - 0.1), EAVE + 0.05, zf], [0, EAVE + RISE - 0.15, zf], 0.08, { c: 'beam' }); b.beam([s * 0.9, EAVE + 0.06, zf], [s * 0.35, EAVE + 0.72, zf], 0.06, { c: 'beam' }); });
        });
        gateShield(b, 0, EAVE + 1.12, HZ1 + 0.2, 0, 0.42, 'quarter', 'ink', 'bone');
      });
      b.gableRoof(0, EAVE, (HZ0 + HZ1) / 2, HZ1 - HZ0, 2 * HX, RISE, { m: 'slate', over: 0.28, overX: 0.38, rows: 6, ry: Math.PI / 2 });
      b.unit(function () {
        // barge boards crossed at the peak, carved into dragon heads looking out both ways
        var slope = Math.atan2(RISE, HX), ex = HX + 0.28, ey = EAVE - 0.28 * Math.tan(slope);
        [HZ1 + 0.42, HZ0 - 0.42].forEach(function (z, fi) {
          [-1, 1].forEach(function (s) { b.beam([s * ex, ey + 0.1, z], [0, EAVE + RISE + 0.18, z], 0.085, { c: 'woodDark', r2: 0.035 }); });
          gateHead(b, 0.03, EAVE + RISE + 0.05, z, fi ? Math.PI : 0, 0.92);
        });
      });

      b.part('Tower roofs');
      [-1, 1].forEach(function (s) { b.coneRoof(s * TX, BASE + TH + 1.42, TZ, TR + 0.72, 5.4, { m: 'slate', rows: 7, flare: 0.45, seg: 24 }); });
      b.unit(function () {
        var tip = BASE + TH + 6.82;
        [-1, 1].forEach(function (s) {
          b.cone(s * TX, tip - 0.12, TZ, 0.09, 0.5, { c: 'iron', m: M.metal, seg: 6 });
          b.flag(s * TX, tip + 0.25, TZ, 1.5, s > 0 ? 1.25 : 1.1, 0.5, { c: s > 0 ? 'ember' : 'bone', pennant: true, emblem: 'none', ry: -0.6, pr: 0.045 });
        });
      });

      // ------------------------------------------------------------ the drawbridge
      b.part('Drawbridge');
      var DZ1 = CZ0 + 0.35, DY = BASE + 0.02;
      b.unit(function () {
        // the landing sill on the counterscarp, the hinge beam at the gate, and the two stringers
        b.box(0, HB - 0.1, CZ0 + 0.2, AW + 0.4, 0.22, 0.5, { c: 'sandstone', m: M.stone, bevel: 0.04 });
        b.beam([-AW / 2 + 0.05, DY - 0.18, GZ1 + 0.05], [AW / 2 - 0.05, DY - 0.18, GZ1 + 0.05], 0.1, { c: 'iron', m: M.metal, round: true, seg: 8 });
        [-1, 1].forEach(function (s) { b.box(s * 1.12, DY - 0.42, (GZ1 + DZ1) / 2, 0.24, 0.3, DZ1 - GZ1, { c: 'woodDark', m: M.wood, bevel: 0.03 }); });
        [GZ1 + 1.2, (GZ1 + DZ1) / 2, DZ1 - 0.9].forEach(function (z) { b.box(0, DY - 0.34, z, AW - 0.1, 0.2, 0.22, { c: 'woodDark', m: M.wood, bevel: 0.03 }); });
      });
      var NPL = 20, PLW = (DZ1 - GZ1 - 0.1) / NPL;
      for (var pg = 0; pg < 4; pg++) {
        (function (g) {
          b.unit(function () {
            for (var i = g * 5; i < g * 5 + 5; i++) b.box(b.j(0.03), DY - 0.14, GZ1 + 0.1 + (i + 0.5) * PLW, AW - 0.12 + b.j(0.04), 0.13, PLW - 0.03, { c: b.pick(['#6a5845', '#5f4f3f', '#574839', '#6f5d49', '#655443']), m: M.wood, bevel: 0.015, ao: 0.3, ry: b.j(0.012) });
          });
        })(pg);
      }
      b.unit(function () {
        // iron straps, the kerbs and the chain eyes
        [-0.72, 0.72].forEach(function (x) { b.box(x, DY - 0.01, (GZ1 + DZ1) / 2, 0.1, 0.025, DZ1 - GZ1 - 0.2, { c: 'iron', m: M.metal, bevel: 0.005 }); for (var i = 0; i < 9; i++) b.ball(x, DY + 0.01, GZ1 + 0.4 + i * 0.6, 0.025, { c: 'iron', m: M.metal, detail: 0 }); });
        [-1, 1].forEach(function (s) {
          b.box(s * (AW / 2 - 0.04), DY - 0.02, (GZ1 + DZ1) / 2, 0.14, 0.16, DZ1 - GZ1 - 0.1, { c: 'woodDark', m: M.wood, bevel: 0.025 });
          b.addGeo(new T.TorusGeometry(0.08, 0.022, 4, 10), { x: s * (AW / 2 - 0.04), y: DY + 0.22, z: DZ1 - 0.25, ry: Math.PI / 2, c: 'iron', m: M.metal, ao: 0 });
          b.addGeo(new T.TorusGeometry(0.09, 0.025, 4, 10), { x: s * 2.05, y: BASE + 4.92, z: GZ1 + 0.06, c: 'iron', m: M.metal, ao: 0 });
        });
      });
      b.unit(function () { [-1, 1].forEach(function (s) { gateChain(b, [s * (AW / 2 - 0.04), DY + 0.3, DZ1 - 0.25], [s * 2.05, BASE + 4.85, GZ1 + 0.1], 0.18); }); });

      // ------------------------------------------------------------ banners, shields and lights
      b.part('Banners and shields');
      [-1, 1].forEach(function (s) {
        b.unit(function () {
          var bx = s * TX, bz = TZ + TR + 0.5, by = BASE + 7.75;
          b.beam([bx, by, bz - 0.5], [bx, by, bz + 0.05], 0.045, { c: 'iron', m: M.metal });
          b.beam([bx, by - 0.6, bz - 0.45], [bx, by, bz - 0.05], 0.03, { c: 'iron', m: M.metal });
          b.beam([bx - 0.78, by + 0.02, bz], [bx + 0.78, by + 0.02, bz], 0.04, { c: 'iron', m: M.metal, round: true });
          gateBanner(b, bx, by, bz, 1.4, 3.3, { c: 'ink', emblem: 'tower', ec: '#f1eee8', es: 0.72, tail: 'swallow', band: 'ember', bandAt: 0.74, bandH: 0.05, trim: 'iron', ry: 0 });
        });
      });
      [-1, 1].forEach(function (s) {
        b.unit(function () {
          var kinds = ['quarter', 'half', 'ring', 'cross'];
          for (var i = 0; i < 3; i++) {
            var x = s * (7.6 + i * 0.95), fc = (i % 2) ? 'bone' : 'ink', pc = (i % 2) ? 'ink' : 'bone';
            gateShield(b, x, BASE + 3.75 + (i % 2) * 0.08, WZ + WT / 2 + 0.04, 0, 0.4, kinds[(i + (s > 0 ? 1 : 0)) % 4], fc, pc, -0.06);
            b.beam([x, BASE + 4.18, WZ + WT / 2 - 0.02], [x, BASE + 4.2, WZ + WT / 2 + 0.12], 0.022, { c: 'iron', m: M.metal });
          }
        });
      });
      b.unit(function () { [-1, 1].forEach(function (s) { b.torch(s * 2.08, BASE + 2.25, GZ1 + 0.04, { s: 0.62 }); }); });

      // ------------------------------------------------------------ the bridge foot
      b.part('Gate posts');
      [-1, 1].forEach(function (s) {
        b.unit(function () {
          var x = s * (RW + 0.42), z = CZ0 + 0.85;
          b.box(x, HB, z, 0.62, 0.22, 0.62, { c: 'sandstone', m: M.stone, bevel: 0.05 });
          gateStave(b, x, HB + 0.22, z, 2.7, 0.28, { c: 'beam' });
          gateHead(b, x, HB + 0.22 + 2.82, z, -Math.PI / 2, 0.72, {});
          gateShield(b, x, HB + 1.55, z + 0.17, 0, 0.3, s > 0 ? 'half' : 'ring', s > 0 ? 'bone' : 'ink', s > 0 ? 'ink' : 'bone');
        });
      });
      b.unit(function () { b.brazier(RW + 1.35, HB, CZ0 + 0.95, 0.85); b.brazier(-RW - 1.35, HB, CZ0 + 0.95, 0.85); });

      b.part('Ditch stakes');
      for (var sg = 0; sg < 4; sg++) {
        (function (g) {
          b.unit(function () {
            var s = g < 2 ? -1 : 1, zr = g % 2 ? PZ1 + 1.0 : PZ1 + 2.2;
            for (var x = 2.3 + (g % 2) * 0.35; x < 11.0; x += 0.72) {
              var px = s * (x + b.j(0.1)), lean = 0.42 + b.j(0.08), L = 1.25 + b.j(0.12), tx = b.j(0.1);
              var a = [px, -0.05, zr + b.j(0.08)], m = [px + tx * 0.8, a[1] + Math.cos(lean) * L * 0.82, a[2] + Math.sin(lean) * L * 0.82], c = [px + tx, a[1] + Math.cos(lean) * L, a[2] + Math.sin(lean) * L];
              b.beam(a, m, 0.065, { c: b.pick(['#6e5c48', '#7d6a57', '#665645']), round: true, seg: 6 });
              b.beam(m, c, 0.065, { c: '#a8957c', round: true, seg: 6, r2: 0.006 });
            }
          });
        })(sg);
      }

      // ------------------------------------------------------------ the toll house at the road foot
      gateHut(b, -6.2, 11.5);
      b.part('Toll table and trough');
      b.unit(function () {
        // the toll table by the road: an open ledger and an iron-bound coin chest; a barrel and a sack taken in kind
        var tx = -3.4, tz = 12.95, ty = gGround(b, tx, tz);
        b.push(0, ty, 0, 0); b.table(tx, tz, 1.15, 0.62, { ry: 0.12 }); b.pop();
        b.push(tx - 0.18, ty + 0.81, tz + 0.04, 0.4);
        b.box(-0.12, 0.012, 0, 0.24, 0.025, 0.32, { c: '#efebe4', m: M.paint, bevel: 0.004, rz: 0.08 });
        b.box(0.12, 0.012, 0, 0.24, 0.025, 0.32, { c: '#f3f1ec', m: M.paint, bevel: 0.004, rz: -0.08 });
        b.box(0, 0, 0, 0.52, 0.02, 0.35, { c: '#2a2623', m: M.wood, bevel: 0.004 });
        b.pop();
        b.push(tx + 0.32, ty + 0.81, tz - 0.06, 0.15);
        b.box(0, 0, 0, 0.36, 0.2, 0.24, { c: 'woodDark', m: M.wood, bevel: 0.02 });
        [-0.11, 0.11].forEach(function (xx) { b.box(xx, -0.004, 0, 0.04, 0.21, 0.25, { c: 'iron', m: M.metal, bevel: 0.005 }); });
        b.pop();
        b.barrel(-2.7, gGround(b, -2.7, 12.05), 12.05, { h: 0.8 }); b.sack(-4.35, gGround(b, -4.35, 13.3), 13.3, 0.42); b.sack(-4.25, gGround(b, -4.25, 12.75), 12.75, 0.36);
        // firewood stacked along the toll house wall, and the chopping block
        b.push(0, gGround(b, -8.1, 11.5), 0, 0); b.woodpile(-8.1, 11.5, { n: 3, len: 1.7, ry: Math.PI / 2 }); b.pop();
        var cy2 = gGround(b, -8.35, 13.0);
        b.cyl(-8.35, cy2 - 0.05, 13.0, 0.26, 0.5, { c: 'wood', m: M.wood, seg: 10, flat: true });
        b.beam([-8.3, cy2 + 0.47, 13.0], [-8.05, cy2 + 1.02, 13.22], 0.025, { c: 'woodLight', round: true });
        b.box(-8.33, cy2 + 0.4, 12.98, 0.06, 0.16, 0.2, { c: 'iron', m: M.metal, bevel: 0.01, ry: 0.7 });
      });
      b.unit(function () {
        // a stone trough and a hitching rail for carts waiting on the gate
        var qx = 6.7, qz = 12.1, qy = gGround(b, qx, qz) + 0.02;
        b.box(qx, qy - 0.15, qz, 1.7, 0.22, 0.78, { c: 'stoneDark', m: M.stone, bevel: 0.03 });
        [-1, 1].forEach(function (s) {
          b.box(qx, qy + 0.07, qz + s * 0.31, 1.62, 0.48, 0.13, { c: b.stoneC('sandstone'), m: M.stone, bevel: 0.03, ry: b.j(0.01) });
          b.box(qx + s * 0.75, qy + 0.07, qz, 0.13, 0.48, 0.49, { c: b.stoneC('sandstone'), m: M.stone, bevel: 0.03 });
        });
        b.box(qx, qy + 0.38, qz, 1.36, 0.03, 0.48, { c: '#4c5458', m: M.water, bevel: 0, ao: 0 });
        [-1, 1].forEach(function (s) { b.post(qx + s * 1.05, qy - 0.12, qz - 0.75, 0.07, 1.22, { c: 'woodDark' }); });
        b.beam([qx - 1.2, qy + 0.95, qz - 0.75], [qx + 1.2, qy + 0.95, qz - 0.75], 0.05, { c: 'wood', round: true });
        b.ropeCoil(qx - 1.45, qy - 0.02, qz + 0.35, 0.22); b.bucket(qx + 1.2, qy - 0.04, qz + 0.5);
        // tufts over the strip of field between the glacis foot and the road foot
        for (var i = 0; i < 34; i++) {
          var x = -11 + b.r() * 22, z = GL + 0.2 + b.r() * 2.3;
          if (Math.abs(x - 0.25) < 2.4 || (x > 2.7 && x < 4.9 && z > 10.1)) continue;
          b.grass(x, gGround(b, x, z), z, 0.25 + b.r() * 0.3); if (b.chance(0.25)) b.flowers(x, gGround(b, x, z), z, 0.3, { n: 4 });
        }
      });

      // ------------------------------------------------------------ stores and work along the rampart
      b.part('Stores and arms');
      b.unit(function () {
        b.rack(-8.4, HB, WZ + WT / 2 + 0.3, 2.2, { kind: 'spears' });
        b.rack(8.3, HB, WZ + WT / 2 + 0.3, 1.8, { kind: 'shields' });
      });
      b.unit(function () {
        b.barrel(-9.5, HB, 0.2, {}); b.barrel(-10.2, HB, 0.7, { h: 0.82 }); b.barrel(-9.9, HB, -0.4, { h: 0.86 });
        b.crate(-10.5, HB, 1.5, 0.7, { ry: 0.3 }); b.crate(-10.45, HB + 0.7, 1.52, 0.55, { ry: -0.2 }); b.sack(-9.6, HB, 1.3, 0.48); b.sack(-9.1, HB, 1.0, 0.42);
        b.barrel(-6.6, HB, 1.6, { lie: true, ry: 1.2 });
      });
      b.unit(function () {
        b.ladder(9.6, HB, WZ + WT / 2 + 0.05, WH + 0.45, { lean: 0.22 });
        b.push(0, HB, 0, 0); b.woodpile(8.4, 1.4, { n: 4, len: 1.5, ry: 0.15 }); b.pop();
        b.crate(10.6, HB, 0.9, 0.7, { ry: -0.3 }); b.sack(10.5, HB, 1.8, 0.5); b.bucket(6.9, HB, 1.5);
        b.push(0, HB, 0, 0); b.bench(7.3, 0.0, 1.4, { ry: 0.05 }); b.pop();
      });
      b.unit(function () {
        // a cart of hay coming up the road
        var gy = gGround(b, 0.6, 13.5) + 0.03; b.push(0, gy, 0, 0);
        b.cart(0.6, 13.5, { ry: Math.PI + 0.06, load: function () { b.hay(0, 0.71, -0.45, { w: 1.2, h: 0.5, d: 0.75 }); b.hay(0, 0.71, 0.42, { w: 1.2, h: 0.5, d: 0.75 }); b.hay(0.05, 1.21, 0.0, { w: 1.1, h: 0.45, d: 0.7, ry: 0.1 }); b.sack(-0.35, 1.21, -0.6, 0.4); } });
        b.pop();
        // a signpost where the road meets the ramp
        var SX = -2.95, SZ = 13.75, sy = gGround(b, SX, SZ);
        b.post(SX, sy - 0.1, SZ, 0.07, 2.4, { c: 'woodDark' });
        b.push(SX, sy + 1.85, SZ, -0.4); b.extrude(0.05, 0, 0, [[0, -0.13], [0.8, -0.13], [0.98, 0], [0.8, 0.13], [0, 0.13]], 0.05, { c: 'bone', m: M.paint, bevel: 0.01 }); b.pop();
        b.push(SX, sy + 1.5, SZ, 2.2); b.extrude(0.05, 0, 0, [[0, -0.12], [0.7, -0.12], [0.86, 0], [0.7, 0.12], [0, 0.12]], 0.05, { c: 'ink', m: M.paint, bevel: 0.01 }); b.pop();
        b.cone(SX, sy + 2.3, SZ, 0.12, 0.18, { c: 'woodDark', m: M.wood, seg: 4, flat: true });
        b.rock(3.2, gGround(b, 3.2, 11.75), 11.75, 0.35);
      });

      b.part('Ivy, turf and flowers');
      b.unit(function () {
        var zf = WZ + WT / 2 + 0.02;
        b.ivy([[-10.0, HB + 0.2, zf], [-9.7, HB + 1.6, zf], [-9.9, HB + 3.0, zf], [-9.6, HB + 4.2, zf]], [0, 0, 1], { density: 6, spread: 0.5 });
        var a = Math.PI * 0.82, nx = Math.cos(a), nz = Math.sin(a), px = -TX + nx * (TR + 0.33), pz = TZ + nz * (TR + 0.33);
        b.ivy([[px, BASE + 0.3, pz], [px + 0.1, BASE + 2.0, pz - 0.05], [px - 0.1, BASE + 3.6, pz + 0.1]], [nx, 0, nz], { density: 6, spread: 0.5 });
        b.ivy([[-6.0, 0.1, PZ1 + 0.02], [-5.6, 0.7, PZ1 + 0.02]], [0, 0, 1], { density: 7, spread: 0.5 });
        b.ivy([[7.2, 0.1, PZ1 + 0.02], [7.6, 0.8, PZ1 + 0.02]], [0, 0, 1], { density: 7, spread: 0.5 });
      });
      b.unit(function () {
        // tufts and flowers over the rampart turf, the counterscarp and the glacis
        for (var i = 0; i < 70; i++) {
          var x = -PX + 0.6 + b.r() * (2 * PX - 1.2), z = WZ + WT / 2 + 0.3 + b.r() * (PZ1 - WZ - WT / 2 - 0.9);
          if (Math.abs(x) < 6.9 && z < 2.0) continue;
          b.grass(x, HB, z, 0.25 + b.r() * 0.3); if (b.chance(0.2)) b.flowers(x, HB, z, 0.3, { n: 4 });
        }
        for (var j = 0; j < 60; j++) {
          var x2 = -PX + 0.5 + b.r() * (2 * PX - 1.0), t = b.r(), z2 = CZ0 + 0.6 + t * (GL - CZ0 - 0.7), y2 = z2 < CZ1 ? HB : HB * (1 - (z2 - CZ1) / (GL - CZ1));
          if (Math.abs(x2) < RW + 0.5) continue;
          b.grass(x2, y2, z2, 0.25 + b.r() * 0.3); if (b.chance(0.25)) b.flowers(x2, y2, z2, 0.3, { n: 4 });
        }
        for (var q = 0; q < 26; q++) { var x3 = -PX + 0.6 + b.r() * (2 * PX - 1.2), z3 = PZ0 + 0.5 + b.r() * (WZ - WT / 2 - PZ0 - 0.7); if (Math.abs(x3) < GX + 0.4) continue; b.grass(x3, HB, z3, 0.25 + b.r() * 0.3); }
        b.bush(-8.2, CZ1 - 0.6, 0.55, { y: HB - 0.05, flowers: '#f3f1ec', n: 2 }); b.bush(6.4, CZ1 - 0.5, 0.5, { y: HB - 0.05, n: 2 });
        b.bush(-6.6, 1.7, 0.5, { y: HB - 0.05, flowers: '#efebe4', n: 2 });
        var bankY = function (x, z) { return Math.max(endH(x, z), gGround(b, x, z)); };
        b.bush(-11.9, 8.0, 0.75, { y: bankY(-11.9, 8.0) - 0.08, n: 3 }); b.bush(-12.1, 6.5, 0.6, { y: bankY(-12.1, 6.5) - 0.06, flowers: '#f3f1ec', n: 2 }); b.bush(11.9, 7.6, 0.7, { y: bankY(11.9, 7.6) - 0.08, n: 3 });
        b.rock(-12.6, bankY(-12.6, 1.2) - 0.05, 1.2, 0.36); b.rock(-13.0, bankY(-13.0, 3.6) - 0.05, 3.6, 0.3);
        for (var e = 0; e < 26; e++) { var ex = (b.chance(0.5) ? -1 : 1) * (10.8 + b.r() * 3.0), ez = PZ0 + b.r() * (GL - PZ0), ey = bankY(ex, ez); if (Math.hypot(ex, ez) > gEdge(ex, ez) - 1.3) continue; b.grass(ex, ey, ez, 0.25 + b.r() * 0.3); if (b.chance(0.25)) b.flowers(ex, ey, ez, 0.3, { n: 4 }); }
        b.rock(-12.2, 0.05, 9.0, 0.4); b.rock(-11.0, 0.05, 9.5, 0.28); b.rock(11.4, 0.05, 9.4, 0.32);
        // a stack of stores waiting at the roadside for the gate to pass them
        var g2 = function (x, z) { return b.ground ? b.ground.height(x, z) : 0; };
        b.crate(3.6, g2(3.6, 10.9), 10.9, 0.7, { ry: 0.25 }); b.crate(3.65, g2(3.6, 10.9) + 0.7, 10.92, 0.55, { ry: -0.15 }); b.barrel(4.4, g2(4.4, 10.6), 10.6, {}); b.sack(3.1, g2(3.1, 11.4), 11.4, 0.48); b.sack(4.2, g2(4.2, 11.3), 11.3, 0.42);
      });

      // ------------------------------------------------------------ the people
      b.life(function () {
        b.figure(0.35, 1.5, { role: 'knight', pose: 'vigil', ry: 0.12, y: BASE + 0.02 });
        b.figure(0.95, 3.6, { role: 'villager', pose: 'carry', ry: Math.PI + 0.15, y: BASE + 0.02 });
        b.figure(-1.2, CZ0 + 1.0, { role: 'soldier', pose: 'spear', ry: 0.4, y: HB + 0.03 });
        b.figure(-8.6, WZ - 0.15, { role: 'archer', pose: 'draw', ry: 0.25, y: BASE + WH + 0.1 });
        b.figure(-0.9, -0.2, { role: 'soldier', pose: 'point', ry: 0.35, y: HY + 0.04 });
        // at the road foot the guard stops the hay cart, and the toll keeper calls the toll from his table
        var gh = function (x, z) { return gGround(b, x, z) + 0.05; };
        b.figure(-0.85, 11.0, { role: 'soldier', pose: 'guard', ry: 0.45, y: gh(-0.85, 11.0) });
        b.figure(0.6, 11.3, { role: 'villager', pose: 'walk', ry: Math.PI + 0.06, c: '#5c5e62', y: gh(0.6, 11.3) });
        b.figure(-3.45, 12.35, { role: 'villager', pose: 'talk', ry: 0.6, c: '#3b3a38', y: gh(-3.45, 12.35) - 0.05 });
        b.figure(2.3, 12.9, { role: 'child', pose: 'run', ry: 0.5, y: gh(2.3, 12.9) });
      });
    }
  });
})();
