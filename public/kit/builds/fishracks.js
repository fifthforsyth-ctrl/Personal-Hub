// Fish racks: where the catch comes in. A long stone trough of fish in water, tall A-frame racks of split silver-grey
// fish drying in the wind, a gutting shed with a slate roof, a net hung between two poles, a boat drawn up on rollers,
// and baskets, barrels and a handcart of the catch. Built footings first, the trough course by course, the rack frame,
// its rails and each rail of fish in turn, the shed wall by course and its roof row by row, the net, the stores, and
// last the people: a villager tipping a basket into the trough, a fisherman bringing up another from the cart, and a
// child holding a fish up to a swooping gull.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL, U = KIT.util, G = KIT.geo;
  PAL.fishracks_stone = ['#77736c', '#6d6963', '#827d75', '#67635d', '#8a857c', '#726e67'];
  PAL.fishracks_cap = ['#8f8a81', '#878279', '#99948a', '#817c74'];
  PAL.fishracks_pole = ['#6d655b', '#625b52', '#776e63', '#5a534b', '#80776b'];
  function V(x, y, z) { return new T.Vector3(x, y, z); }

  // ---------------------------------------------------------------- poses
  var P = KIT.people.poses;
  // leaning over the trough, a basket held out in both hands and tipped forward
  P.fishracks_tip = function (r) { return { feet: [V(-0.13, 0.09, 0.14), V(0.15, 0.09, -0.2)], hands: [V(-0.25, 1.16, 0.44), V(0.25, 1.3, 0.5)], lean: 0.2, twist: 0, side: 0, hip: 0, drop: 0.04, head: [0, 0.32], pole: [V(-0.9, -0.4, -0.2), V(0.9, -0.4, -0.2)] }; };
  // standing at a bench, both hands low on the board, head bent to the work
  P.fishracks_gut = function (r) { return { feet: [V(-0.14, 0.09, 0.04), V(0.14, 0.09, -0.06)], hands: [V(-0.2, 0.92, 0.42), V(0.18, 0.94, 0.4)], lean: 0.24, twist: r(0.08), side: 0, hip: 0, drop: 0.03, head: [0.15, 0.4], pole: [V(-0.8, -0.4, -0.4), V(0.8, -0.4, -0.4)] }; };
  // a child holding a fish up high in one hand, the other out for balance
  P.fishracks_tease = function (r) { return { feet: [V(-0.13, 0.09, 0.1), V(0.15, 0.09, -0.14)], hands: [V(-0.3, 1.9, 0.32), V(0.36, 1.0, 0.05)], lean: -0.05, twist: 0.1, side: 0.05, hip: 0, drop: 0, head: [-0.2, -0.3], pole: [V(-1, 0, -0.2), V(1, -0.4, -0.2)] }; };
  // reaching up to hang a pair of fish over a rail
  P.fishracks_hang = function (r) { return { feet: [V(-0.13, 0.09, 0.08), V(0.15, 0.09, -0.12)], hands: [V(-0.16, 1.82, 0.3), V(0.16, 1.86, 0.3)], lean: -0.06, twist: 0, side: 0, hip: 0, drop: 0, head: [0, -0.35], pole: [V(-0.9, -0.2, -0.2), V(0.9, -0.2, -0.2)] }; };

  // kneeling at a heap of net, both hands low on the mesh, head bent to the work
  P.fishracks_mend = function (r) { return { feet: [V(-0.16, 0.09, 0.3), V(0.15, 0.12, -0.42)], hands: [V(-0.16, 0.62, 0.5), V(0.2, 0.66, 0.44)], lean: 0.32, twist: r(0.08), side: 0, hip: 0, drop: 0.4, head: [r(0.1), 0.45], pole: [V(-0.6, -0.4, -0.3), V(0.6, -0.4, -0.3)] }; };

  function fig(fx, fz, ry, x, y, z, s) { s = s || 1; return [fx + (x * Math.cos(ry) + z * Math.sin(ry)) * s, y * s, fz + (-x * Math.sin(ry) + z * Math.cos(ry)) * s]; }

  // ---------------------------------------------------------------- fish
  // a whole fish: flat silver body with a darker back and a forked tail, head to local +x, in the XY plane
  var FISH = [[-0.5, 0.0], [-0.62, 0.12], [-0.6, 0.02], [-0.62, -0.1], [-0.5, -0.02], [-0.38, -0.08], [-0.1, -0.15], [0.2, -0.14], [0.4, -0.08], [0.5, -0.02], [0.5, 0.03], [0.4, 0.09], [0.2, 0.15], [-0.1, 0.16], [-0.38, 0.08]];
  var FG = {};
  function fishGeo(s) { var k = Math.round(s * 100) / 100; return FG[k] || (FG[k] = G.extrude(FISH.map(function (p) { return [p[0] * k, p[1] * k]; }), 0.05 * k, { bevel: 0.01 * k })); }
  function fish(b, x, y, z, ry, s, rz, rx) {
    b.addGeo(fishGeo(s), { x: x, y: y, z: z, ry: ry, rz: rz || 0, rx: rx || 0, c: '#ffffff', m: M.scale, bucket: 'cloth', ao: 0.15, jit: 0, vary: 0.05, colors: function (wx, wy, wz, lx, ly) { var t = ly / (0.16 * s); return t > 0.35 ? '#5d666c' : t > -0.2 ? '#a9b2b6' : '#c9ced0'; } });
  }
  // a fish lying flat at (x, y, z) (y its underside), turned ry
  function flatFish(b, x, y, z, ry, s, tip) { fish(b, x, y + 0.025 * s, z, ry, s, tip || 0, -Math.PI / 2); }

  // a split, headless fish for the racks: a cupped double-sided sheet hanging tail up from (0, 0, 0), len long
  function hw(t) { return t < 0.08 ? 0.1 - t / 0.08 * 0.07 : t < 0.16 ? 0.03 + (t - 0.08) / 0.08 * 0.015 : t < 0.6 ? 0.045 + 0.105 * Math.sin((t - 0.16) / 0.44 * Math.PI / 2) : 0.15 * (1 - Math.pow((t - 0.6) / 0.4, 2) * 0.5); }
  var SG = {};
  function splitGeo(len) {
    var k = Math.round(len * 100) / 100; if (SG[k]) return SG[k];
    var g = new T.PlaneGeometry(1, 1, 4, 12), p = g.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var u = p.getX(i) * 2, t = 0.5 - p.getY(i), w = hw(t) * k;
      var y = -t * k + (t < 0.001 ? Math.abs(u) * 0.05 * k : 0);
      p.setXYZ(i, u * w, y, -0.035 * k * u * u + 0.01 * k * Math.sin(t * 6));
    }
    g.computeVertexNormals();
    return (SG[k] = g);
  }
  var SKIN = [['#7b7f80', '#bcbdb9', '#dcdbd5', '#727678'], ['#82858a', '#c3c3bf', '#e1e0da', '#787b7d']];
  var FLESH = [['#a69f93', '#e0d9ca', '#979b9b', '#787c7e'], ['#ada699', '#e6dfcf', '#9da0a0', '#7e8284']];
  function splitFish(b, x, y, z, ry, len, rx, rz, flesh) {
    var pal = flesh ? b.pick(FLESH) : b.pick(SKIN);
    b.addGeo(splitGeo(len), { x: x, y: y, z: z, ry: ry, rx: rx || 0, rz: rz || 0, c: '#ffffff', m: M.scale, bucket: 'cloth', ao: 0.15, jit: 0, vary: 0.05,
      colors: function (wx, wy, wz, lx, ly) {
        var t = U.clamp(-ly / len, 0, 1), u = Math.abs(lx) / Math.max(0.001, hw(t) * len);
        if (t < 0.15) return pal[3];
        if (flesh) return u < 0.22 ? pal[0] : u > 0.82 ? pal[2] : pal[1];
        return u < 0.38 ? pal[0] : u > 0.8 ? pal[2] : pal[1];
      } });
  }

  // ---------------------------------------------------------------- pieces
  var SLATE = {};
  function slateGeo(w, t, len) {
    var key = [w, t, len].join(',');
    if (SLATE[key]) return SLATE[key];
    var g = G.chamferBox(w, t, len, Math.min(0.025, t * 0.3)), p = g.attributes.position, c = [];
    for (var i = 0; i < p.count; i++) { var f = (p.getZ(i) + len / 2) / len, v = U.lerp(0.6, 1, Math.pow(U.smooth(0, 0.8, f), 0.8)); c.push(v, v, v * 0.98); }
    g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
    return (SLATE[key] = g);
  }
  // a single-pitch slate roof laid from the eave (x0..x1 at zf, yf) up to the back (zb, yb), a row a step; each row
  // fills the width exactly, odd rows starting with a half slate
  function leanRoof(b, x0, x1, zf, yf, zb, yb, o) {
    o = o || {};
    var run = Math.hypot(zf - zb, yb - yf), slope = Math.atan2(yb - yf, zf - zb), rows = o.rows || Math.max(3, Math.round(run / 0.5)), rl = run / rows;
    var pw = o.pitch || 0.4, L = x1 - x0, n = Math.max(2, Math.round(L / pw)), w = L / n, th = o.thick || 0.06;
    for (var r = 0; r < rows; r++) {
      (function (r) {
        b.unit(function () {
          var len = rl * 1.45, tm = r * rl + len / 2 - rl * 0.1, i;
          var cy = yf + Math.sin(slope) * tm + r * 0.003, cz = zf - Math.cos(slope) * tm, edges = [];
          if (r % 2) { edges.push(x0); for (i = 0; i < n; i++) edges.push(x0 + (i + 0.5) * w); edges.push(x1); } else for (i = 0; i <= n; i++) edges.push(x0 + i * w);
          for (i = 0; i < edges.length - 1; i++) {
            var a = edges[i], c = edges[i + 1], g = slateGeo(Math.round((c - a - 0.03) * 1000) / 1000, th, Math.round(len * 1000) / 1000);
            var cc = U.col(b.pick(PAL.slate)), q = b.r();
            if (q < 0.14) cc.offsetHSL(0.006, -0.03, -0.04); else if (q < 0.26) cc.offsetHSL(-0.004, 0.01, 0.03); else if (q < 0.3) cc.lerp(new T.Color('#7f8657'), 0.14);
            b.addGeo(g, { x: (a + c) / 2 + b.j(0.008), y: cy, z: cz + b.j(0.015), rx: slope - 0.05 + b.j(0.01), ry: b.j(0.02), rz: b.j(0.012), c: cc, m: M.tile, ao: 0.3, jit: 0.02, vary: 0.04 });
          }
        });
      })(r);
    }
  }
  // a carved dragon-head finial in the XY plane, snout to local +x, neck foot at (x, y, z), turned ry, s tall
  var HEAD = [[-0.09, 0], [0.09, 0], [0.11, 0.24], [0.16, 0.44], [0.27, 0.57], [0.46, 0.61], [0.66, 0.62], [0.75, 0.67], [0.56, 0.7], [0.46, 0.73], [0.63, 0.78], [0.81, 0.81], [0.83, 0.87], [0.64, 0.92], [0.47, 0.96], [0.33, 1.02], [0.13, 1.24], [0.21, 0.99], [0.07, 0.91], [-0.04, 0.88], [-0.11, 0.72], [-0.07, 0.62], [-0.14, 0.46], [-0.1, 0.3], [-0.12, 0.12]];
  function finial(b, x, y, z, ry, s) {
    b.push(x, y, z, ry);
    b.extrude(0, 0, 0, HEAD.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.13 * s, { c: 'woodDark', m: M.wood, bevel: 0.012 * s });
    b.box(0.02 * s, 0.3 * s, 0, 0.3 * s, 0.06 * s, 0.17 * s, { c: '#3d3934', m: M.wood, bevel: 0.01 * s, rz: 0.15 });
    [-1, 1].forEach(function (sd) { b.ball(0.54 * s, 0.86 * s, sd * 0.075 * s, 0.028 * s, { c: '#e9e4da', m: M.paint, detail: 0, ao: 0 }); });
    [0.55, 0.65].forEach(function (tx) { b.extrude(tx * s, 0.7 * s, 0, [[-0.022 * s, 0], [0.022 * s, 0], [0, -0.05 * s]], 0.05 * s, { c: '#e9e4da', m: M.paint, ao: 0 }); });
    b.pop();
  }
  // a stave post: dark squared post with carved bands on a stone pad, h tall
  function stavePost(b, x, z, h, o) {
    o = o || {};
    b.box(x, -0.02, z, 0.42, 0.16, 0.42, { c: b.pick(PAL.fishracks_cap), m: M.stone, bevel: 0.04 });
    b.post(x, 0.14, z, 0.1, h - 0.14, { c: 'woodDark', ry: o.ry || 0 });
    [0.35, h * 0.55, h - 0.25].forEach(function (yy, i) { b.box(x, yy, z, 0.25, i === 1 ? 0.14 : 0.08, 0.25, { c: '#3a3631', m: M.wood, bevel: 0.025, ry: (o.ry || 0) + 0.785 * (i % 2) }); });
    for (var k = 0; k < 6; k++) { var yy2 = h * 0.62 + k * 0.08, a = k * 1.05 + (o.ry || 0); b.ball(x + Math.cos(a) * 0.105, yy2, z + Math.sin(a) * 0.105, 0.035, { c: '#46413a', m: M.wood, detail: 0, ao: 0 }); }
  }
  // a wicker basket at (x, y, z): r its rim radius, h tall; full: fish heaped in it
  function basket(b, x, y, z, r, h, o) {
    o = o || {};
    b.lathe(x, y, z, [[0.01, 0], [r * 0.78, 0], [r * 0.92, h * 0.35], [r, h * 0.85], [r * 1.02, h], [r * 0.95, h], [r * 0.9, h * 0.6], [0.01, h * 0.08]], { c: o.c || '#8a6a45', m: M.straw, seg: 14, flat: true, ao: 0.25 });
    // bands of darker withy round it, and a rolled rim
    [0.22, 0.5, 0.78].forEach(function (f) { b.cyl(x, y + h * f - 0.012, z, r * (0.82 + f * 0.19) + 0.006, 0.024, { c: '#6b5134', m: M.wood, seg: 14, open: true, ao: 0 }); });
    b.addGeo(new T.TorusGeometry(r, 0.022, 4, 16), { x: x, y: y + h, z: z, rx: Math.PI / 2, c: '#6b5134', m: M.wood, ao: 0 });
    if (o.full) for (var i = 0; i < (o.n || 7); i++) { var a = b.r() * 6.28, d = Math.sqrt(b.r()) * r * 0.55; fish(b, x + Math.cos(a) * d, y + h * 0.92 + i * 0.012, z + Math.sin(a) * d, b.r() * 6.28, r * 1.35, b.j(0.25), -Math.PI / 2 + b.j(0.35)); }
  }
  // a barrel of fish, heads and tails standing out of the top
  function fishBarrel(b, x, z, o) {
    o = o || {}; var h = o.h || 0.9, r = o.r || 0.34;
    b.barrel(x, 0, z, { h: h, r: r, ry: o.ry || 0 });
    for (var i = 0; i < (o.n || 7); i++) { var a = i / (o.n || 7) * 6.28 + b.j(0.3), d = r * 0.45 * (0.4 + b.r() * 0.6); fish(b, x + Math.cos(a) * d, h + 0.08, z + Math.sin(a) * d, -a + b.j(0.4), 0.42, Math.PI / 2 + b.j(0.4), b.j(0.3)); }
  }
  // a gull standing at (x, y, z) facing ry
  function gull(b, x, y, z, ry, o) {
    o = o || {};
    b.push(x, y, z, ry);
    [-1, 1].forEach(function (sd) { b.beam([sd * 0.035, 0, 0.01], [sd * 0.035, 0.1, 0], 0.008, { round: true, seg: 3, c: '#c98e6c', m: M.skin, ao: 0 }); });
    b.ball(0, 0.17, 0, 0.1, { c: '#f1efe9', m: M.cloth, sx: 0.75, sy: 0.72, sz: 1.35, detail: 1, smooth: true, ao: 0.2 });
    [-1, 1].forEach(function (sd) { b.box(sd * 0.07, 0.18, -0.04, 0.03, 0.09, 0.28, { rx: -0.18, rz: sd * 0.2, c: '#8e9398', m: M.cloth, bevel: 0.012, ao: 0.1 }); b.box(sd * 0.065, 0.2, -0.2, 0.025, 0.05, 0.08, { rx: -0.25, c: '#232221', m: M.cloth, bevel: 0.01, ao: 0 }); });
    var hy = o.peck ? 0.14 : 0.27, hz = o.peck ? 0.17 : 0.1;
    b.ball(0, hy, hz, 0.055, { c: '#f4f2ed', m: M.cloth, detail: 1, smooth: true, ao: 0.1 });
    b.beam([0, hy - 0.005, hz + 0.045], [0, hy - (o.peck ? 0.05 : 0.015), hz + 0.11], 0.012, { r2: 0.005, round: true, seg: 4, c: '#e7a43c', m: M.paint, ao: 0 });
    [-1, 1].forEach(function (sd) { b.ball(sd * 0.04, hy + 0.012, hz + 0.022, 0.009, { c: '#151413', m: M.dark, detail: 0, ao: 0 }); });
    b.pop();
  }

  // a gull in flight at (x, y, z) heading ry, wings raised k (0 level .. 1 up)
  function gullFly(b, x, y, z, ry, k) {
    b.push(x, y, z, ry);
    b.ball(0, 0, 0, 0.1, { c: '#f1efe9', m: M.cloth, sx: 0.7, sy: 0.6, sz: 1.5, detail: 1, smooth: true, ao: 0 });
    b.ball(0, 0.03, 0.15, 0.05, { c: '#f4f2ed', m: M.cloth, detail: 1, smooth: true, ao: 0 });
    b.beam([0, 0.02, 0.19], [0, 0.0, 0.25], 0.01, { r2: 0.004, round: true, seg: 4, c: '#e7a43c', m: M.paint, ao: 0 });
    [-1, 1].forEach(function (sd) {
      var a0 = sd * (0.12 + 0.35 * k), a1 = sd * (-0.25 + 0.6 * k);
      b.push(sd * 0.05, 0.02, 0.0, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(a0));
      b.box(sd * 0.2, 0, 0, 0.4, 0.025, 0.2, { c: '#d9dbdc', m: M.cloth, bucket: 'cloth', bevel: 0.008, ao: 0 });
      b.push(sd * 0.4, 0, 0, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(a1 - a0));
      b.box(sd * 0.16, 0, -0.02, 0.32, 0.02, 0.14, { c: '#9a9fa3', m: M.cloth, bucket: 'cloth', bevel: 0.006, ao: 0 });
      b.box(sd * 0.3, 0, -0.04, 0.08, 0.02, 0.1, { c: '#232221', m: M.cloth, bucket: 'cloth', bevel: 0.005, ao: 0 });
      b.pop(); b.pop();
    });
    b.box(0, 0, -0.2, 0.14, 0.02, 0.12, { c: '#e9e8e4', m: M.cloth, bucket: 'cloth', bevel: 0.005, ao: 0 });
    b.pop();
  }
  // a slab of rock: an irregular outline (radius rx by rz, turned rot), h thick, its top at y + h; lumpy flanks
  function rockSlab(b, x, y, z, rx, rz, h, rot, seed) {
    var n = 13, pts = [];
    for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2, k = 0.86 + 0.22 * (U.noise3(Math.cos(a) * 1.7 + seed, Math.sin(a) * 1.7, seed) + 0.5) * 0.9; pts.push([Math.cos(a) * rx * k, Math.sin(a) * rz * k]); }
    var g = G.extrude(pts, h, { bevel: 0.05 }), p = g.attributes.position;
    g.rotateX(-Math.PI / 2); g.computeBoundingBox(); var y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
    for (var j = 0; j < p.count; j++) {
      var px = p.getX(j), py = p.getY(j), pz = p.getZ(j), f = (py - y0) / (y1 - y0), nz = U.noise3(px * 1.3 + seed, py * 2.1, pz * 1.3);
      p.setXYZ(j, px * (1 + nz * 0.08 * (1 - f * 0.7)), py + (f > 0.92 ? 0 : nz * 0.03), pz * (1 + nz * 0.08 * (1 - f * 0.7)));
    }
    g = G.flat(g);
    b.addGeo(g, { x: x, y: y - y0, z: z, ry: rot, c: b.pick(['#7f7a72', '#77726a', '#878278', '#716d66']), m: M.rock, ao: 0.3, jit: 0.03, vary: 0.07 });
    return y + (y1 - y0);
  }

  // a small clinker boat drawn up on two rollers: tarred strakes with a pale top strake, ribs and thwarts inside, a
  // carved head on the stem; local x bow (+) to stern (-), centre (x, z) turned ry
  function boat(b, x, z, ry) {
    var HL = 1.6, N = 28;
    var wAt = function (u) { return 0.6 * Math.pow(Math.max(0, 1 - u * u), 0.55); };
    var yk = function (u) { return 0.25 + 0.12 * Math.pow(u, 4); }, ys = function (u) { return 0.8 + 0.3 * Math.pow(u, 4); };
    var pt = function (u, s, sd, out) { var w = wAt(u) + (out || 0), a = s * Math.PI / 2; return [u * HL, yk(u) + (ys(u) - yk(u)) * (1 - Math.cos(a)), sd * w * Math.pow(Math.sin(a), 0.75)]; };
    b.push(x, 0, z, ry);
    b.unit(function () {
      // the rollers, chocked
      [-0.75, 0.75].forEach(function (rx) { b.beam([rx, 0.12, -0.75], [rx, 0.12, 0.75], 0.12, { round: true, seg: 9, c: b.pick(PAL.fishracks_pole), m: M.wood }); [-1, 1].forEach(function (sd) { b.box(rx + sd * 0.2, 0, 0.55, 0.12, 0.1, 0.14, { c: 'wood', m: M.wood, bevel: 0.02 }); }); });
      // the keel along the bottom
      for (var i = 0; i < 12; i++) { var u0 = -0.97 + i / 12 * 1.94, u1 = u0 + 1.94 / 12; b.beam([u0 * HL, yk(u0) - 0.02, 0], [u1 * HL, yk(u1) - 0.02, 0], 0.035, { c: '#1f1e1c', m: M.wood }); }
    });
    b.unit(function () {
      // four strakes a side, each lapped a little outside the one below
      for (var k = 0; k < 4; k++) {
        [-1, 1].forEach(function (sd) {
          var pos = [], s0 = Math.max(0, k / 4 - 0.02), s1 = (k + 1) / 4 + 0.03, out = k * 0.012;
          for (var i = 0; i < N; i++) {
            var u0 = -1 + i / N * 2, u1 = u0 + 2 / N;
            var a0 = pt(u0, s0, sd, out), a1 = pt(u1, s0, sd, out), c0 = pt(u0, s1, sd, out), c1 = pt(u1, s1, sd, out);
            pos.push.apply(pos, a0.concat(a1, c1, a0, c1, c0));
          }
          var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
          b.addGeo(g, { c: k === 3 ? '#e6e1d7' : b.pick(['#262422', '#2c2a27', '#22201e']), m: M.wood, bucket: 'cloth', ao: 0.3, jit: 0, vary: 0.04 });
        });
      }
      // the gunwale on each side
      [-1, 1].forEach(function (sd) { for (var i = 0; i < 16; i++) { var u0 = -0.96 + i / 16 * 1.92, u1 = u0 + 1.92 / 16; b.beam(pt(u0, 1, sd, 0.03), pt(u1, 1, sd, 0.03), 0.028, { round: true, seg: 5, c: '#2a2826', m: M.wood, ao: 0 }); } });
    });
    b.unit(function () {
      // ribs inside, two thwarts, the stems with a carved head at the bow
      [-0.62, -0.31, 0, 0.31, 0.62].forEach(function (u) { [-1, 1].forEach(function (sd) { for (var j = 0; j < 4; j++) b.beam(pt(u, j / 4 + 0.03, sd, -0.035), pt(u, (j + 1) / 4, sd, -0.035), 0.022, { c: '#4a3c30', m: M.wood, ao: 0.1 }); }); });
      [-0.42, 0.2].forEach(function (u) { var w = wAt(u) - 0.06; b.box(u * HL, ys(u) - 0.18, 0, 0.22, 0.05, w * 2, { c: 'woodLight', m: M.wood, bevel: 0.012 }); });
      [-1, 1].forEach(function (e) {
        var pts = [[e * 0.97 * HL, yk(0.97) - 0.01, 0], [e * (HL + 0.06), 0.55, 0], [e * (HL + 0.1), 0.9, 0], [e * (HL + 0.06), 1.2, 0]];
        for (var q = 0; q < pts.length - 1; q++) b.beam(pts[q], pts[q + 1], 0.045, { c: '#1f1e1c', m: M.wood });
      });
      finial(b, HL + 0.06, 1.18, 0, 0, 0.42);
      // oars along the thwarts, a heap of net and a basket in the bottom
      [-0.12, 0.12].forEach(function (oz) { b.beam([-1.15, 0.66, oz], [1.05, 0.7, oz * 1.6], 0.025, { round: true, seg: 6, c: 'woodLight', m: M.wood }); b.box(1.0, 0.68, oz * 1.6, 0.42, 0.025, 0.12, { ry: 0, c: 'woodLight', m: M.wood, bevel: 0.008 }); });
      for (var n = 0; n < 9; n++) b.ball(-0.75 + b.j(0.25), 0.42 + b.r() * 0.08, b.j(0.18), 0.16 + b.r() * 0.06, { c: b.pick(['#4c443c', '#544b42', '#463f38']), m: M.rope, detail: 1, sy: 0.55, ao: 0.3 });
      b.cyl(-0.62, 0.62, 0.05, 0.06, 0.1, { c: '#cdbb94', m: M.paint, seg: 8, rz: Math.PI / 2 }); b.cyl(-0.9, 0.58, -0.1, 0.06, 0.1, { c: 'ember', m: M.paint, seg: 8, rz: Math.PI / 2, ry: 0.6 });
    });
    b.pop();
  }

  KIT.defineBuild('fishracks', {
    name: 'Fish racks', size: 'small', need: 16,
    line: 'A stone trough heaped with fish beside tall racks of split silver fish, a gutting shed, a net strung between poles and a boat drawn up on rollers.',
    r: 9.5, flat: [12, 12.5], ground: 'dirt', path: [[3.4, 9.2], [2.0, 4.2]],
    frameY: 1.5, frameR: 7.4, glowAt: [3.0, 2.7, 0.45],
    trees: [{ x: -6.3, z: -4.6, kind: 'pine', h: 6.2 }, { x: 2.0, z: -6.9, kind: 'pine', h: 5.6 }, { x: 6.9, z: 3.2, kind: 'birch', h: 5.0 }],
    bushes: [{ x: 4.3, z: -4.7, r: 0.7, flowers: '#f3f1ec' }, { x: -6.4, z: 3.0, r: 0.7 }, { x: -5.2, z: 5.6, r: 0.6, flowers: '#efebe4' }, { x: 6.6, z: -3.4, r: 0.6, flowers: '#efebe4' }],
    build: function (b) {
      // ---- where things stand
      // the trough: centre TC turned TR; its local x runs along it, local +z is the side the people feed from
      var TC = [0.2, 2.3], TR = 0, tc = Math.cos(TR), ts = Math.sin(TR);
      var tl = function (lx, lz) { return [TC[0] + lx * tc + lz * ts, TC[1] - lx * ts + lz * tc]; };
      var TL = 4.6, TW = 1.3, TH = 0.6, tw = 0.22;
      // the rack: centre RC turned RR (it runs across the view), n bays
      var RC = [-1.4, -3.2], RR = 0, RL = 4.8, RB = 3, RH = 3.6, RS = 0.85, rails = [0.95, 1.55, 2.15, 2.75];
      // the gutting shed: centre SC turned SR, open to the front (local +z)
      var SC = [-5.1, -0.9], SR = -0.2;
      // the net between two poles
      var N1 = [3.0, -3.6], N2 = [5.9, -1.9], NH = 2.55;
      // the handcart of the catch, parked past the trough's feeding end: [x, z, ry]
      var HC = [4.75, 2.55, Math.PI];
      var FT = [];
      // the boat drawn up on rollers
      var BC = [-4.6, 3.6], BR = -0.42;
      // the drying flats: bare rock in the sun where split fish are laid out, centre FC turned FR
      // the net mender kneeling on the lawn: [x, z, ry]
      var MD = [0.75, 7.25, -0.95];
      var FC = [-0.8, 5.4], FR = -0.62, FL = [[-1.25, -0.1, 0.75, 0.55, 0.4], [-0.2, 0.15, 0.7, 0.62, 2.1], [0.95, -0.12, 0.8, 0.58, 4.4], [-0.75, -0.65, 0.5, 0.38, 6.3], [0.45, 0.62, 0.55, 0.4, 8.2]];

      // ================================================================ footings
      b.part('Footings');
      b.unit(function () {
        // flat stones under the trough, and the pads under the rack's legs
        b.push(TC[0], 0, TC[1], TR);
        b.box(0, -0.06, 0, TL + 0.4, 0.16, TW + 0.36, { c: 'stoneDark', m: M.stone, bevel: 0.04 });
        b.box(0, 0.06, 0, TL, 0.06, TW, { c: '#6c6862', m: M.stone, bevel: 0.02 });
        // an apron of flags round it where the feeders stand
        for (var gx = -TL / 2 - 0.9; gx < TL / 2 + 0.9; gx += 0.5) for (var gz = -TW / 2 - 0.85; gz < TW / 2 + 0.9; gz += 0.46) {
          if (Math.abs(gx) < TL / 2 + 0.2 && Math.abs(gz) < TW / 2 + 0.18) continue;
          var edge = Math.max(Math.abs(gx) - TL / 2, Math.abs(gz) - TW / 2); if (edge > 0.45 && b.r() < 0.45) continue;
          b.box(gx + b.j(0.04), -0.04, gz + b.j(0.04), 0.44 + b.j(0.05), 0.09, 0.4 + b.j(0.04), { ry: b.j(0.12), c: b.stoneC('fishracks_cap', 0.3), m: M.stone, bevel: 0.03, ao: 0.1, jit: 0.04 });
        }
        b.pop();
        b.push(RC[0], 0, RC[1], RR);
        for (var i = 0; i <= RB; i++) { var x = -RL / 2 + i * RL / RB; [-1, 1].forEach(function (sd) { b.box(x, -0.04, sd * RS, 0.36, 0.14, 0.34, { ry: b.j(0.2), c: b.pick(PAL.fishracks_cap), m: M.stone, bevel: 0.04 }); }); }
        b.pop();
      });
      b.unit(function () {
        // the drying flats: broad slabs of bare rock bedded in the ground
        FL.forEach(function (q) { var p = fig(FC[0], FC[1], FR, q[0], 0, q[1]); FT.push(rockSlab(b, p[0], -0.02, p[2], q[2], q[3], 0.16 + q[4] * 0.004, FR + q[4], q[4])); });
      });
      b.unit(function () {
        // the shed's floor of flags on a low footing
        b.push(SC[0], 0, SC[1], SR);
        b.box(0, -0.08, 0, 3.4, 0.2, 2.0, { c: 'stoneDark', m: M.stone, bevel: 0.05 });
        for (var i = 0; i < 6; i++) for (var j = 0; j < 3; j++) b.box(-1.4 + i * 0.56 + (j % 2) * 0.14, 0.1, -0.62 + j * 0.6, 0.52 + b.j(0.03), 0.05, 0.54, { ry: b.j(0.04), c: b.stoneC('fishracks_cap', 0.4), m: M.stone, bevel: 0.02 });
        b.pop();
      });

      // ================================================================ the trough
      b.part('Feeding trough');
      b.push(TC[0], 0, TC[1], TR);
      b.stoneBox(0, 0, TL, TW, 0.1, TH - 0.12, tw, { pal: 'fishracks_stone', course: 0.24, len: 0.5, core: false });
      b.unit(function () {
        // the rim: long flat stones along both sides, a block across each end, a lip for the water at the right end
        [-1, 1].forEach(function (sd) {
          var n = 5, L = TL + 0.12;
          for (var i = 0; i < n; i++) { var a = -L / 2 + i * L / n, c = a + L / n; b.box((a + c) / 2, TH - 0.02, sd * (TW / 2 - tw / 2 + 0.01), c - a - 0.03, 0.12, tw + 0.12, { ry: b.j(0.015), c: b.stoneC('fishracks_cap', 1.2), m: M.stone, bevel: 0.03 }); }
        });
        [-1, 1].forEach(function (sd) { b.box(sd * (TL / 2 - tw / 2 + 0.02), TH - 0.02, 0, tw + 0.16, 0.12, TW - tw * 2 - 0.12 + 0.01, { c: b.stoneC('fishracks_cap', 1.2), m: M.stone, bevel: 0.03 }); });
      });
      b.unit(function () {
        // water most of the way up, and the fish heaped in it, thickest where the cart's baskets and the tipped basket pour
        b.box(0, 0.12, 0, TL - tw * 2 - 0.02, TH - 0.22, TW - tw * 2 - 0.02, { c: '#55606a', m: M.water, bevel: 0, ao: 0 });
        var heaps = [[-0.9, 0.0, 26, 0.8], [-1.6, 0.0, 16, 0.5], [0.6, 0.0, 12, 0.8], [1.6, 0.0, 8, 0.5]];
        heaps.forEach(function (hp) {
          for (var i = 0; i < hp[2]; i++) {
            var u = b.j(1) * hp[3], v = b.j(1) * 0.3, rise = (1 - Math.abs(u) / hp[3]) * 0.16 * (1 - Math.abs(v) / 0.4);
            flatFish(b, hp[0] + u, TH - 0.12 + rise + b.r() * 0.04, hp[1] + v, b.r() * 6.28, 0.42 + b.r() * 0.12, b.j(0.3));
          }
        });
      });
      b.pop();

      // ================================================================ the drying rack
      b.part('Drying rack');
      var yX = 0.12 + RS / (RS + 0.18) * (RH - 0.12), zAt = function (y) { return RS - (RS + 0.18) * (y - 0.12) / (RH - 0.12); };
      b.push(RC[0], 0, RC[1], RR);
      b.unit(function () {
        // A-frames of grey poles crossed at the top, lashed, with a tie at each rail height
        for (var i = 0; i <= RB; i++) {
          var x = -RL / 2 + i * RL / RB;
          [-1, 1].forEach(function (sd) { b.beam([x, 0.1, sd * RS], [x + b.j(0.02), RH, -sd * 0.18], 0.06, { round: true, seg: 7, c: b.pick(PAL.fishracks_pole), m: M.wood }); });
          b.beam([x - 0.08, yX + 0.02, 0.0], [x + 0.08, yX - 0.02, 0.0], 0.075, { round: true, seg: 6, c: 'rope', m: M.rope, ao: 0 });
          rails.forEach(function (yr) { var z = zAt(yr - 0.07) + 0.07; b.beam([x, yr - 0.07, -z], [x, yr - 0.07, z], 0.035, { round: true, seg: 5, c: b.pick(PAL.fishracks_pole), m: M.wood }); });
        }
      });
      b.unit(function () {
        // the ridge pole in the crossings, the rails along the ties, each lashed at the frames
        b.beam([-RL / 2 - 0.35, yX + 0.09, 0], [RL / 2 + 0.35, yX + 0.09, 0], 0.055, { round: true, seg: 7, c: b.pick(PAL.fishracks_pole), m: M.wood });
        rails.forEach(function (yr) {
          b.beam([-RL / 2 - 0.22, yr, 0.0], [RL / 2 + 0.22, yr + b.j(0.01), 0.0], 0.035, { round: true, seg: 6, c: b.pick(PAL.fishracks_pole), m: M.wood });
          for (var i = 0; i <= RB; i++) { var x = -RL / 2 + i * RL / RB; b.beam([x - 0.05, yr, 0], [x + 0.05, yr, 0], 0.048, { round: true, seg: 5, c: 'rope', m: M.rope, ao: 0 }); }
        });
      });
      // each rail of fish is its own step, bottom rail first
      rails.forEach(function (yr, ri) {
        b.unit(function () {
          for (var bay = 0; bay < RB; bay++) {
            var x0 = -RL / 2 + bay * RL / RB + 0.2, x1 = x0 + RL / RB - 0.4, n = 7;
            for (var k = 0; k < n; k++) {
              if (ri === 3 && bay === 2 && k > 3) continue;
              var x = x0 + (k + 0.5) * (x1 - x0) / n + b.j(0.02), len = 0.48 + b.r() * 0.1;
              [-1, 1].forEach(function (sd) { splitFish(b, x, yr + 0.035, sd * 0.045, sd > 0 ? 0 : Math.PI, len * (0.95 + b.r() * 0.08), -0.1 + b.j(0.04), b.j(0.06), b.r() < 0.45); });
              b.beam([x, yr + 0.035, -0.05], [x, yr + 0.035, 0.05], 0.012, { round: true, seg: 4, c: '#3a3632', m: M.rope, ao: 0 });
            }
          }
        });
      });
      b.pop();

      // ================================================================ the gutting shed
      b.part('Gutting shed');
      var lx0 = -1.5, lx1 = 1.5, lzb = -0.8, lzf = 0.8, wallTop = 2.5, yf = 2.0;
      b.push(SC[0], 0, SC[1], SR);
      for (var k = 0; k < 3; k++) {
        (function (k) {
          b.unit(function () { b.stoneWall(lx0, lzb, lx1, lzb, 0.13 + k * 0.38, 0.38, 0.4, { pal: 'fishracks_stone', course: 0.38, len: 0.62 }); });
        })(k);
      }
      b.unit(function () {
        // boards above the stone, between two dark posts at the back corners
        [lx0 + 0.1, lx1 - 0.1].forEach(function (x) { b.post(x, 1.27, lzb, 0.09, wallTop - 1.27 + 0.1, { c: 'woodDark' }); });
        b.planks(0, 1.27, lzb + 0.04, lx1 - lx0 - 0.38, wallTop - 1.27, { vertical: true, pw: 0.24, c: 'wood', t: 0.07 });
        b.beam([lx0 + 0.1, 1.29, lzb + 0.1], [lx1 - 0.1, 1.29, lzb + 0.1], 0.05, { c: 'woodDark' });
      });
      b.unit(function () {
        stavePost(b, lx0 + 0.12, lzf, yf - 0.02); stavePost(b, lx1 - 0.12, lzf, yf - 0.02);
        b.beam([lx0 - 0.25, yf, lzf], [lx1 + 0.25, yf, lzf], 0.1, { c: 'woodDark' });
        // knee braces from the posts up to the beam
        [[lx0 + 0.12, 1], [lx1 - 0.12, -1]].forEach(function (q) { b.beam([q[0], yf - 0.55, lzf], [q[0] + q[1] * 0.5, yf - 0.06, lzf], 0.04, { c: 'woodDark' }); });
      });
      var ezf = lzf + 0.65, eyf = yf + 0.02, ezb = lzb - 0.18, eyb = wallTop + 0.22;
      b.unit(function () {
        for (var i = 0; i < 5; i++) { var x = lx0 - 0.2 + i * (lx1 - lx0 + 0.4) / 4; b.beam([x, eyb - 0.12, ezb + 0.05], [x, eyf - 0.08, ezf - 0.05], 0.06, { c: 'beam' }); }
        b.beam([lx0 - 0.3, wallTop + 0.05, lzb + 0.05], [lx1 + 0.3, wallTop + 0.05, lzb + 0.05], 0.08, { c: 'beam' });
      });
      leanRoof(b, lx0 - 0.4, lx1 + 0.4, ezf, eyf, ezb, eyb, { rows: 5, pitch: 0.38, thick: 0.06 });
      b.unit(function () {
        [lx0 - 0.42, lx1 + 0.42].forEach(function (x) { b.beam([x, eyf + 0.02, ezf + 0.02], [x, eyb + 0.06, ezb], 0.05, { c: 'woodDark', r2: 0.1 }); });
        b.beam([lx0 - 0.45, eyb + 0.1, ezb + 0.05], [lx1 + 0.45, eyb + 0.1, ezb + 0.05], 0.085, { c: 'woodDark' });
        finial(b, lx1 + 0.32, yf + 0.05, lzf + 0.02, 0, 0.58);
        finial(b, lx0 - 0.32, yf + 0.05, lzf + 0.02, Math.PI, 0.58);
      });
      b.unit(function () {
        // the gutting bench: a thick board on trestles, a split fish on it, a knife, a pail of heads, a salt tub
        var bz = 1.95; b.box(0.1, 0.0, bz, 0.12, 0.8, 0.5, { c: 'wood', m: M.wood, bevel: 0.02 }); b.box(1.0, 0.0, bz, 0.12, 0.8, 0.5, { c: 'wood', m: M.wood, bevel: 0.02 });
        b.box(0.55, 0.8, bz, 1.6, 0.09, 0.62, { c: 'woodLight', m: M.wood, bevel: 0.02 });
        b.box(0.62, 0.89, bz + 0.02, 0.6, 0.012, 0.4, { c: '#8d7a66', m: M.wood, bevel: 0 });
        flatFish(b, 0.5, 0.9, bz + 0.02, 0.2, 0.5); flatFish(b, 0.95, 0.9, bz - 0.05, -0.3, 0.46); flatFish(b, 1.15, 0.92, bz + 0.15, 2.6, 0.44);
        for (var sf = 0; sf < 3; sf++) splitFish(b, -0.05 + sf * 0.16, 0.912, bz + 0.18, 0.1 + sf * 0.2, 0.42, -Math.PI / 2, 0, true);
        b.box(0.2, 0.9, bz + 0.12, 0.2, 0.012, 0.035, { ry: 0.5, c: '#b5b8ba', m: M.metal, bevel: 0 }); b.box(0.06, 0.9, bz + 0.2, 0.1, 0.025, 0.03, { ry: 0.5, c: 'wood', m: M.wood, bevel: 0.005 });
        b.bucket(-0.4, 0, bz + 0.2); for (var i = 0; i < 5; i++) b.ball(-0.4 + b.j(0.08), 0.3, bz + 0.2 + b.j(0.08), 0.05, { c: '#9a9e9e', m: M.scale, detail: 0, ao: 0.1 });
        basket(b, 1.65, 0, bz + 0.1, 0.27, 0.38, { full: true, n: 7 });
        b.barrel(-1.05, 0.12, -0.35, { h: 0.8, r: 0.32 }); b.cyl(-1.05, 0.92, -0.35, 0.26, 0.03, { c: '#ecebe6', m: M.plaster, seg: 12 });
        b.sack(-0.5, 0.12, -0.45, 0.48, { c: '#d9d3c6' }); b.sack(-1.25, 0.12, 0.35, 0.42, { c: '#cfc8b9' });
        // oars and a coil of line hung on the boards
        [[0.45, 0.06], [0.75, -0.06]].forEach(function (q) { b.beam([q[0], 0.25, lzb + 0.2], [q[0] + q[1] * 4, 2.35, lzb + 0.12], 0.03, { round: true, seg: 6, c: 'woodLight', m: M.wood }); b.box(q[0] + q[1] * 0.2, 0.32, lzb + 0.2, 0.16, 0.5, 0.03, { rz: -q[1], c: 'woodLight', m: M.wood, bevel: 0.01 }); });
        b.beam([-0.8, 2.0, lzb + 0.06], [-0.8, 2.0, lzb + 0.2], 0.02, { round: true, seg: 4, c: 'iron', m: M.metal });
        b.ropeCoil(-0.8, 1.68, lzb + 0.15, 0.22);
        b.shield(lx1 - 0.12, 1.25, lzf + 0.13, { kind: 'round', c: 'ink', s: 0.62 });
      });
      b.pop();

      // ================================================================ the net
      b.part('Net');
      var nx = N2[0] - N1[0], nz = N2[1] - N1[1], NL = Math.hypot(nx, nz), nux = nx / NL, nuz = nz / NL, nry = -Math.atan2(nuz, nux);
      b.unit(function () {
        // two grey poles on stones, a carved head on the near one, a stay rope from each to a peg
        [N1, N2].forEach(function (p, i) {
          b.box(p[0], -0.03, p[1], 0.44, 0.16, 0.44, { ry: 0.3, c: b.pick(PAL.fishracks_cap), m: M.stone, bevel: 0.04 });
          b.cyl(p[0], 0.12, p[1], 0.085, NH + 0.25, { r2: 0.07, c: b.pick(PAL.fishracks_pole), m: M.wood, seg: 8 });
          b.cyl(p[0], NH - 0.05, p[1], 0.1, 0.1, { c: 'rope', m: M.rope, seg: 8 });
          var sx = p[0] + (i ? 1 : -1) * nux * 1.1, sz = p[1] + (i ? 1 : -1) * nuz * 1.1;
          b.beam([p[0], NH + 0.12, p[1]], [sx, 0.12, sz], 0.012, { round: true, seg: 4, c: 'rope', m: M.rope, ao: 0 });
          b.box(sx, 0, sz, 0.08, 0.2, 0.08, { c: 'wood', m: M.wood, bevel: 0.01 });
        });
        finial(b, N2[0], NH + 0.37, N2[1], nry + Math.PI, 0.5);
      });
      b.unit(function () {
        // the head rope and the net hung from it in diamonds, bellied a little by the wind
        var depth = 1.75, sag = 0.12;
        var at = function (u, v) {
          var f = u / NL, ry0 = NH - sag * Math.sin(f * Math.PI), y = ry0 - v * (1 + 0.06 * Math.sin(f * Math.PI)), bel = 0.16 * Math.sin(f * Math.PI) * Math.sin(Math.min(1, v / depth) * Math.PI * 0.8);
          return [N1[0] + nux * u - nuz * bel, y, N1[1] + nuz * u + nux * bel];
        };
        for (var s = 0; s < 40; s++) { var u0 = s / 40 * NL, u1 = (s + 1) / 40 * NL; b.beam(at(u0, -0.02), at(u1, -0.02), 0.016, { round: true, seg: 4, c: 'rope', m: M.rope, ao: 0 }); b.beam(at(u0, depth), at(u1, depth), 0.014, { round: true, seg: 4, c: '#5e5348', m: M.rope, ao: 0 }); }
        var step = 0.2, u = 0.08, uMax = NL - 0.08;
        [-1, 1].forEach(function (dir) {
          for (var c = -depth; c < NL + depth; c += step) {
            var pts = [];
            for (var t = 0; t <= 24; t++) { var v = t / 24 * depth, uu = c + dir * v; if (uu < u || uu > uMax) continue; pts.push(at(uu, v)); }
            for (var q = 0; q < pts.length - 1; q++) b.beam(pts[q], pts[q + 1], 0.0065, { round: true, seg: 3, c: '#4c443c', m: M.rope, ao: 0, jit: 0 });
          }
        });
        // a fish or two caught in the mesh
        [[0.9, 1.1, 0.4], [2.3, 1.45, -0.5], [2.9, 0.75, 0.2]].forEach(function (q) { var p = at(q[0], q[1]); fish(b, p[0], p[1], p[2], nry + 0.08, 0.36, q[2]); });
      });
      b.unit(function () {
        // cork floats along the head rope (two painted in the Hub's orange), lead weights along the foot
        for (var i = 1; i < 9; i++) {
          var u = i / 9 * NL, f = u / NL, x = N1[0] + nux * u, z = N1[1] + nuz * u, y = NH - 0.12 * Math.sin(f * Math.PI);
          b.cyl(x, y - 0.06, z, 0.06, 0.12, { c: i === 3 || i === 6 ? 'ember' : '#cdbb94', m: M.paint, seg: 8, rz: Math.PI / 2, ry: nry, ao: 0.1 });
          var by = y - 1.75 * (1 + 0.06 * Math.sin(f * Math.PI)) - 0.04;
          b.cyl(x - nuz * 0.0, by - 0.03, z, 0.03, 0.07, { c: '#3b3d40', m: M.metal, seg: 6, rz: Math.PI / 2, ry: nry, ao: 0 });
        }
      });

      // ================================================================ stores
      b.part('Baskets and barrels');
      b.unit(function () {
        // barrels of fish at the trough's feeding end
        var p1 = tl(1.9, 1.5), p2 = tl(2.6, 1.6), p3 = tl(1.25, 1.65);
        fishBarrel(b, p1[0], p1[1], { h: 0.92 }); fishBarrel(b, p2[0], p2[1], { h: 0.86, r: 0.32, ry: 0.6 });
        b.barrel(p3[0], 0, p3[1], { h: 0.8, lie: true, ry: TR + 0.4 });
        var p4 = tl(0.85, 1.12); b.bucket(p4[0], 0, p4[1]);
        // the handcart that brings the catch up from the boats, baskets of fish in its bed
        b.cart(HC[0], HC[1], { ry: HC[2], load: function () {
          [[-0.33, -0.62], [0.32, -0.55], [-0.3, 0.12], [0.34, 0.2], [0.0, 0.78]].forEach(function (q, i) { basket(b, q[0], 0.71, q[1], 0.25, 0.32, { full: i !== 4, n: 6 }); });
        } });
      });
      b.unit(function () {
        // baskets, full and empty, by the trough
        var q1 = tl(-1.1, 1.15), q2 = tl(-0.5, 1.3), q3 = tl(-3.2, 0.95);
        basket(b, q1[0], 0, q1[1], 0.3, 0.42, { full: true, n: 8 });
        basket(b, q2[0], 0, q2[1], 0.27, 0.38, { full: true, n: 6 });
        basket(b, q3[0], 0, q3[1], 0.26, 0.36, {});
        b.push(q3[0] + 0.05, 0.36, q3[1], 0.4); basket(b, 0, 0, 0, 0.24, 0.33, {}); b.pop();
        // a few fish dropped on the stones
        var f1 = tl(0.1, 0.9), f2 = tl(-3.6, -0.8); flatFish(b, f1[0], 0.06, f1[1], 1.1, 0.42); flatFish(b, f2[0], 0.06, f2[1], -0.4, 0.4);
      });
      b.unit(function () {
        // split fish laid out flesh up on the flats to dry in the sun and the wind
        FL.forEach(function (q, i) {
          var n = Math.round(q[2] * q[3] * 34);
          for (var k = 0; k < n; k++) {
            var a = k / n * Math.PI * 2 * 2.618, d = Math.sqrt((k + 0.5) / n) * 0.72, ux = Math.cos(a) * d * q[2], uz = Math.sin(a) * d * q[3];
            if (i === 2 && Math.hypot(ux - 0.3, uz - 0.1) < 0.3) continue;
            var c = fig(FC[0], FC[1], FR, q[0], 0, q[1]), p = fig(c[0], c[2], FR + q[4], ux, 0, uz);
            splitFish(b, p[0], FT[i] + 0.022, p[2], FR + 0.25 + b.j(0.25), 0.46 + b.r() * 0.08, -Math.PI / 2, 0, b.r() < 0.8);
          }
        });
      });
      boat(b, BC[0], BC[1], BR);
      b.unit(function () {
        // fish traps of withy and a stack of crates under the rack's near end
        var r1 = fig(RC[0], RC[1], RR, 2.95, 0, 0.6), r2 = [3.7, 0, -2.0];
        b.crate(r1[0], 0, r1[2], 0.6, { ry: RR + 0.2 }); b.crate(r1[0] + 0.1, 0.6, r1[2] + 0.05, 0.5, { ry: RR - 0.1 });
        [[r2[0], r2[2], 0.5, 0.3], [2.3, -1.1, 0.4, 0.3], [2.95, -0.55, -0.9, 0.26]].forEach(function (q) {
          b.push(q[0], q[3], q[1], q[2]); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(Math.PI / 2)).multiply(new T.Matrix4().makeScale(q[3] / 0.3, q[3] / 0.3, q[3] / 0.3));
          b.lathe(0, -0.5, 0, [[0.05, 0], [0.26, 0.1], [0.3, 0.5], [0.26, 0.9], [0.05, 1.0]], { c: '#8a6a45', m: M.straw, seg: 10, flat: true, ao: 0.2 });
          for (var i = 1; i < 5; i++) b.cyl(0, -0.5 + i * 0.2, 0, 0.3 * Math.sin(Math.PI * (0.1 + i * 0.2)) + 0.01, 0.025, { c: '#6b5134', m: M.wood, seg: 10, open: true, ao: 0 });
          b.pop();
        });
        b.ropeCoil(r2[0] - 0.75, 0, r2[2] + 0.1, 0.26); b.ropeCoil(1.55, 0, -0.75, 0.24);
        flatFish(b, 0.9, 0.0, -0.2, 2.1, 0.42); flatFish(b, 1.25, 0.0, 0.15, 0.4, 0.38); flatFish(b, -0.3, 0.0, -1.3, -1.0, 0.4);
        for (var g = 0; g < 8; g++) b.grass(4.6 + b.j(0.8), 0.02, 6.0 + b.j(0.6), 0.25 + b.r() * 0.2);
      });
      b.unit(function () {
        // grass at the edges of the yard, stones at the trough's foot
        for (var i = 0; i < 16; i++) { var u = b.j(1) * (TL / 2 + 0.3), sd = b.r() < 0.5 ? -1 : 1, p = tl(u, sd * (TW / 2 + 0.28 + b.r() * 0.1)); b.grass(p[0], 0.02, p[1], 0.25 + b.r() * 0.22); }
        for (var j = 0; j < 14; j++) { var a = b.r() * 6.28, q = fig(RC[0], RC[1], RR, b.j(1) * RL / 2, 0, (b.r() < 0.5 ? -1 : 1) * (RS + 0.25)); b.grass(q[0], 0.02, q[2], 0.35 + b.r() * 0.3); }
        b.rock(N1[0] - 0.6, 0.02, N1[1] + 0.5, 0.3); b.rock(N2[0] + 0.3, 0.02, N2[1] + 0.6, 0.35);
      });

      b.unit(function () {
        // a net being mended on the near lawn: a heap of dark mesh, strands drawn out over the grass, floats, a creel
        var hx = MD[0] + Math.sin(MD[2]) * 0.75, hz = MD[1] + Math.cos(MD[2]) * 0.75;
        for (var i = 0; i < 24; i++) { var a = b.r() * 6.28, d = Math.sqrt(b.r()) * 0.5; b.ball(hx + Math.cos(a) * d * 1.3, 0.03 + (0.5 - d) * 0.3, hz + Math.sin(a) * d, 0.11 + b.r() * 0.08, { c: b.pick(['#4c443c', '#544b42', '#463f38', '#5a5046']), m: M.rope, detail: 1, sy: 0.5, ao: 0.3 }); }
        for (var k = 0; k < 11; k++) {
          var a0 = k / 11 * 6.28 + b.j(0.2), pts = [];
          for (var t = 0; t <= 7; t++) { var d2 = 0.25 + t / 7 * 0.85; pts.push([hx + Math.cos(a0 + t * 0.12) * d2 * 1.25, 0.03 + Math.max(0, 0.2 * (1 - d2 / 0.65)), hz + Math.sin(a0 + t * 0.12) * d2]); }
          for (var q = 0; q < pts.length - 1; q++) b.beam(pts[q], pts[q + 1], 0.008, { round: true, seg: 3, c: '#3e3832', m: M.rope, ao: 0, jit: 0 });
        }
        for (var f = 0; f < 6; f++) { var a1 = f / 6 * 6.28 + 0.5; b.cyl(hx + Math.cos(a1) * 0.95, 0.02, hz + Math.sin(a1) * 0.7, 0.055, 0.1, { c: '#cdbb94', m: M.paint, seg: 8, rz: Math.PI / 2, ry: a1, ao: 0.1 }); }
        basket(b, hx + 1.0, 0, hz - 0.45, 0.24, 0.34, { full: true, n: 5 });
        b.ropeCoil(hx - 1.05, 0, hz - 0.35, 0.22);
        // stones and white flowers along the near edge of the lawn
        [[-2.4, 8.0, 0.3], [4.9, 7.1, 0.34], [-3.6, 6.9, 0.22]].forEach(function (q) { b.rock(q[0], 0.02, q[1], q[2]); b.grass(q[0] + 0.3, 0.02, q[1] + 0.15, 0.3); b.grass(q[0] - 0.25, 0.02, q[1] - 0.1, 0.25); });
        b.flowers(-1.5, 0, 8.1, 0.4, { c: '#f3f1ec', n: 8 }); b.flowers(5.4, 0, 6.2, 0.35, { c: '#efebe4', n: 6 }); b.flowers(-3.0, 0, 7.6, 0.3, { c: '#f3f1ec', n: 5 });
      });

      // ================================================================ life
      b.life(function () {
        // a fisherman bringing a basket of the catch from the cart to the trough on his shoulder
        var FP = [3.75, 4.35], fry = Math.atan2(2.75 - 3.75, 2.75 - 4.35);
        b.figure(FP[0], FP[1], { role: 'villager', pose: 'carry', ry: fry, c: '#4f5a63', beard: true });
        var fb = fig(FP[0], FP[1], fry, 0.17, 1.6, 0.03);
        basket(b, fb[0], fb[1], fb[2], 0.24, 0.32, { full: true, n: 6 });
        // the villager at the trough's end tipping in a basket, fish falling from it
        var vp = tl(-TL / 2 - 0.55, 0.05), vry = Math.PI / 2;
        b.figure(vp[0], vp[1], { role: 'villager', pose: 'fishracks_tip', ry: vry, c: '#5c5e62', hat: null });
        var bc = fig(vp[0], vp[1], vry, 0, 1.2, 0.68);
        b.push(bc[0], bc[1], bc[2], vry); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(1.95)).multiply(new T.Matrix4().makeTranslation(0, -0.18, 0));
        basket(b, 0, 0, 0, 0.26, 0.38, {});
        b.pop();
        for (var i = 0; i < 6; i++) { var t = i / 5, f = fig(vp[0], vp[1], vry, b.j(0.08), 1.08 - t * t * 0.48 - t * 0.05, 0.92 + t * 0.32); fish(b, f[0], f[1], f[2], vry + Math.PI / 2 + b.j(0.6), 0.4, -0.8 - t * 0.6 + b.j(0.4), b.j(0.5)); }
        // a child on the path holding up a fish, and a gull swooping down for it
        var CP = [2.15, 6.65], GS = [2.95, 1.75, 6.35];
        var cry = Math.atan2(GS[0] - CP[0], GS[2] - CP[1]) - 0.35, ch = fig(CP[0], CP[1], cry, -0.3, 1.9, 0.32, 0.62);
        b.figure(CP[0], CP[1], { role: 'child', pose: 'fishracks_tease', ry: cry, toy: false });
        fish(b, ch[0], ch[1] - 0.12, ch[2], cry + Math.PI / 2, 0.42, -1.45, 0.2);
        gullFly(b, GS[0], GS[1], GS[2], Math.atan2(CP[0] - GS[0], CP[1] - GS[2]), 0.85);
        var gc = fig(FC[0], FC[1], FR, FL[2][0], 0, FL[2][1]), GL = fig(gc[0], gc[2], FR + FL[2][4], 0.3, 0, 0.1); GL = [GL[0], GL[2]];
        // the gutter at the shed's bench, facing out
        var gp = fig(SC[0], SC[1], SR, 0.55, 0, 1.42);
        b.figure(gp[0], gp[2], { role: 'villager', pose: 'fishracks_gut', ry: SR, c: '#8a857c', beard: true });
        // a woman hanging a pair of fish on the low rail of the rack
        var hp = fig(RC[0], RC[1], RR, 0.0, 0, 0.62);
        b.figure(hp[0], hp[2], { role: 'villager', pose: 'fishracks_hang', ry: RR + Math.PI, c: '#3b3a38' });
        // the old man mending the net, a wooden needle in his hand
        b.figure(MD[0], MD[1], { role: 'villager', pose: 'fishracks_mend', ry: MD[2], c: '#6e5a44', beard: true });
        var nh = fig(MD[0], MD[1], MD[2], 0.2, 0.66, 0.44); b.box(nh[0], nh[1] - 0.02, nh[2], 0.03, 0.02, 0.16, { ry: MD[2] + 0.4, c: 'woodLight', m: M.wood, bevel: 0.006 });
        var hh = fig(hp[0], hp[2], RR + Math.PI, 0, 1.86, 0.32);
        [-1, 1].forEach(function (sd) { splitFish(b, hh[0] + sd * 0.05, hh[1] + 0.04, hh[2], RR + (sd > 0 ? 0 : Math.PI), 0.5, -0.12, 0, sd > 0); });
        // gulls on the rack and the net pole, one at the dropped fish
        var g1 = fig(RC[0], RC[1], RR, 0.6, 0, 0), g2 = fig(RC[0], RC[1], RR, -1.7, 0, 0);
        gull(b, g1[0], yX + 0.14, g1[2], RR + 1.4); gull(b, g2[0], yX + 0.14, g2[2], RR - 1.9);
        gull(b, N1[0], NH + 0.38, N1[1], -0.9);
        gullFly(b, -0.4, 5.3, -2.2, -1.2, 0.8); gullFly(b, 1.6, 4.7, -3.4, 2.4, 0.2);
        gull(b, GL[0], FT[2], GL[1], -2.2, { peck: true });
      });
    }
  });
})();
