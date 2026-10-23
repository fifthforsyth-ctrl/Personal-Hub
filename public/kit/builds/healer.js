// Healer's house: a stone and timber cottage on an L plan, the front wing's gable crossed with carved dragon heads,
// a stone chimney on the sunny gable, a little porch on stave posts over the door. Round it: the herb garden in raised
// beds behind a wattle fence, racks of herbs drying in the sun, clean linen on the lines, a remedy pot on the fire,
// bee skeps for honey, and the healer binding a wounded soldier's arm on the bench in the yard.
// Built footings first, the stone walls course by course, the timber upper floor panel by panel, the gables, the slate
// roofs row by row, the chimney, the carved heads and the porch, then the yard, the garden and the racks, and last
// the people.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL;
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  PAL.healerSage = ['#8b9877', '#7f8c6c', '#96a283', '#87937a'];
  PAL.healerHerb = ['#5f7447', '#6b7f4f', '#566a40', '#71844f'];
  PAL.healerDry = ['#8c8a62', '#7d8059', '#96915f', '#6f7550', '#a39d72', '#7b8a62'];
  PAL.healerSoil = ['#4f4034', '#57463a', '#4a3c31'];
  PAL.healerLinen = ['#f3f1ec', '#efebe4', '#f6f4f0', '#e9e5dd'];
  PAL.healerShingle = ['#3e3a35', '#36332f', '#45403a', '#3a3632', '#312e2b'];
  PAL.healerSlateW = ['#69645c', '#716b62', '#615c55', '#7a7469', '#5b5650', '#6d6860'];

  // a lean-to roof of slates off a wall facing +z: top edge centre (x, yTop, zWall), w wide, reaching out depth and
  // dropping drop, laid row by row from the eave up
  function pentRoof(b, x, yTop, zWall, w, depth, drop, rows) {
    var a = Math.atan2(drop, depth), run = Math.hypot(depth, drop), rl = run / rows, n = Math.ceil(w / 0.34);
    b.box(x, yTop - Math.sin(a) * run / 2 - 0.06, zWall + Math.cos(a) * run / 2, w - 0.04, 0.04, run, { rx: a, c: 'woodDark', m: M.wood, bevel: 0.01 });
    for (var r = 0; r < rows; r++) {
      var tc = run - (r + 0.5) * rl, off = (r % 2) * 0.17;
      for (var i = 0; i <= n; i++) {
        var px = -w / 2 + i * 0.34 + off; if (px > w / 2 + 0.05) break;
        px = Math.max(-w / 2 + 0.17, Math.min(w / 2 - 0.17, px));
        var cc = KIT.util.col(b.pick(PAL.slate)); if (b.r() < 0.15) cc.offsetHSL(0, -0.02, -0.035); else if (b.r() < 0.25) cc.offsetHSL(0, 0.01, 0.03);
        b.box(x + px + b.j(0.01), yTop - Math.sin(a) * tc - 0.035 + (r % 2) * 0.008 + r * 0.004, zWall + Math.cos(a) * tc, 0.32, 0.035, rl * 1.4, { rx: a + b.j(0.01), ry: b.j(0.015), c: cc, m: M.tile, bevel: 0.01, ao: 0.3, jit: 0.02 });
      }
    }
  }

  // seated on a bench, the right hand on his spear at his side, the left arm bound across his chest
  KIT.people.poses.healer_sit = function () { return { feet: [V(-0.17, 0.09, 0.44), V(0.16, 0.09, 0.4)], hands: [V(-0.34, 0.62, 0.26), V(0.05, 0.88, 0.22)], lean: 0.04, twist: 0, side: 0.02, hip: 0, drop: 0.4, head: [0.5, 0.12], pole: [V(-0.9, -0.5, -0.2), V(0.9, -0.7, 0.1)] }; };
  // bending in to bind a bandage, both hands low in front
  KIT.people.poses.healer_tend = function () { return { feet: [V(-0.15, 0.09, 0.08), V(0.15, 0.09, -0.1)], hands: [V(-0.08, 0.92, 0.5), V(0.1, 0.94, 0.47)], lean: 0.3, twist: 0, side: 0, hip: 0, drop: 0.06, head: [0, 0.42], pole: [V(-1, -0.5, -0.3), V(1, -0.5, -0.3)] }; };
  // kneeling on one knee at a bed, reaching into it
  KIT.people.poses.healer_kneel = function () { return { feet: [V(-0.12, 0.09, -0.4), V(0.15, 0.09, 0.32)], hands: [V(-0.15, 0.5, 0.6), V(0.17, 0.55, 0.55)], lean: 0.5, twist: 0, side: 0, hip: 0, drop: 0.32, head: [0, 0.4], pole: [V(-1, -0.6, -0.2), V(1, -0.6, -0.2)] }; };
  // pegging a sheet on the line overhead
  KIT.people.poses.healer_hang = function () { return { feet: [V(-0.15, 0.09, 0.05), V(0.14, 0.09, -0.06)], hands: [V(-0.22, 1.8, 0.34), V(0.24, 1.78, 0.32)], lean: -0.06, twist: 0, side: 0, hip: 0, drop: 0, head: [0, -0.28], pole: [V(-1, -0.4, -0.2), V(1, -0.4, -0.2)] }; };
  // bearing a stretcher: poles held low behind (front bearer) or in front (rear bearer)
  KIT.people.poses.healer_bearF = function () { return { feet: [V(-0.1, 0.13, 0.28), V(0.11, 0.1, -0.25)], hands: [V(-0.3, 0.84, -0.18), V(0.3, 0.84, -0.18)], lean: 0.06, twist: 0, side: 0, hip: 0, drop: 0.02, head: [0, 0.05], pole: [V(-0.6, -0.2, 0.6), V(0.6, -0.2, 0.6)] }; };
  KIT.people.poses.healer_bearB = function () { return { feet: [V(-0.1, 0.1, -0.24), V(0.11, 0.13, 0.27)], hands: [V(-0.3, 0.84, 0.32), V(0.3, 0.84, 0.32)], lean: 0.08, twist: 0, side: 0, hip: 0, drop: 0.02, head: [0, 0.1], pole: [V(-0.7, -0.4, -0.5), V(0.7, -0.4, -0.5)] }; };
  // lying on his back, one hand on his chest
  KIT.people.poses.healer_lie = function () { return { feet: [V(-0.12, 0.09, 0.0), V(0.12, 0.09, 0.02)], hands: [V(-0.27, 0.86, 0.02), V(0.12, 1.12, 0.17)], lean: 0, twist: 0, side: 0, hip: 0, drop: 0, head: [0.35, -0.1], pole: [V(-0.6, -0.3, -0.6), V(0.8, -0.5, -0.2)] }; };
  // stirring the pot with a long paddle
  KIT.people.poses.healer_stir = function () { return { feet: [V(-0.16, 0.09, 0.1), V(0.15, 0.09, -0.08)], hands: [V(-0.06, 1.0, 0.44), V(0.06, 1.25, 0.36)], lean: 0.12, twist: 0.05, side: 0, hip: 0, drop: 0.03, head: [0, 0.35], pole: [V(-1, -0.5, -0.3), V(1, -0.5, -0.3)] }; };

  // a point beside a figure standing at (x, z) turned ry, from its own frame (lx, ly, lz)
  function loc(x, z, ry, lx, ly, lz) { return [x + lx * Math.cos(ry) + lz * Math.sin(ry), ly, z - lx * Math.sin(ry) + lz * Math.cos(ry)]; }

  // a carved dragon head: the neck rises from the origin, the snout points along local +x; s is its height
  var HEAD = [[-0.08, 0], [0.12, 0], [0.15, 0.22], [0.2, 0.44], [0.3, 0.6], [0.46, 0.66], [0.66, 0.64], [0.8, 0.62], [0.78, 0.68], [0.6, 0.72], [0.82, 0.78], [0.9, 0.84],
    [0.86, 0.9], [0.64, 0.94], [0.48, 0.98], [0.36, 1.0], [0.42, 1.12], [0.3, 1.2], [0.22, 1.04], [0.1, 0.98], [0.02, 0.86], [-0.04, 0.64], [-0.09, 0.4], [-0.1, 0.18]];
  function healerHead(b, x, y, z, s, ry, rz) {
    b.push(x, y, z, ry || 0);
    if (rz) b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(rz));
    b.extrude(0, 0, 0, HEAD.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.11 * s, { c: 'woodDark', m: M.wood, bevel: 0.012 * s, ao: 0.1 });
    [-1, 1].forEach(function (sd) {
      b.ball(0.52 * s, 0.86 * s, sd * 0.065 * s, 0.035 * s, { c: '#efebe4', m: M.paint, detail: 1, ao: 0, jit: 0 });
      b.box(0.66 * s, 0.7 * s, sd * 0.062 * s, 0.24 * s, 0.025 * s, 0.02 * s, { c: '#1f1e1c', m: M.wood, bevel: 0, ao: 0, rz: 0.12 });
    });
    b.pop();
  }
  // crossed barge boards along a gable's verges, in a frame whose local XY is the gable plane (local +z outward):
  // hw the half width at the eave edge, yE the eave edge height, yA the apex; each board runs ext past the apex and
  // there turns into a dragon head (s high) looking outward. ext 0: plain boards meeting at the apex.
  function healerBarge(b, hw, yE, yA, ext, s) {
    var k = (yA - yE) / hw;
    [-1, 1].forEach(function (sd) {
      var zz = sd * 0.022, e = ext ? [-sd * ext, yA + ext * k, zz] : [0, yA + 0.03, zz];
      b.beam([sd * hw, yE, zz], e, 0.12, { r2: 0.035, c: 'woodDark' });
      // a row of carved notches along the board's lower edge
      for (var i = 1; i < 6; i++) { var t = i / 6, px = sd * hw * (1 - t), py = yE + (yA - yE) * t; b.box(px, py - 0.19, zz, 0.07, 0.07, 0.08, { c: 'woodDark', m: M.wood, rz: 0.78, bevel: 0.01 }); }
      if (ext && s) healerHead(b, -sd * ext, yA + ext * k - 0.1, zz, s, sd > 0 ? Math.PI : 0, -0.32);
    });
  }
  // a bundle of herbs hung upside down from a pole at (x, y, z): string, tie, and the bunch flaring below
  function bundle(b, x, y, z, len, c) {
    var top = y - 0.1 - b.r() * 0.08;
    b.beam([x, y, z], [x, top, z], 0.006, { c: 'rope', m: M.rope, round: true, seg: 4, bevel: 0 });
    b.cyl(x, top - 0.05, z, 0.028, 0.05, { c: 'rope', m: M.rope, seg: 6 });
    b.cyl(x, top - 0.05 - len, z, 0.07 + b.r() * 0.04, len, { r2: 0.025, c: c || b.pick(PAL.healerDry), m: M.leaf, seg: 7, ao: 0.25, flat: true, ry: b.r() * 3 });
    for (var i = 0; i < 3; i++) { var a = b.r() * 6.28; b.ball(x + Math.cos(a) * 0.05, top - 0.05 - len + 0.02, z + Math.sin(a) * 0.05, 0.035 + b.r() * 0.02, { c: b.chance(0.3) ? '#e9e5da' : b.pick(PAL.healerDry), m: M.leaf, detail: 0, ao: 0.1 }); }
  }
  // a herb plant as a spray of leaf blades fanning up and out from (x, y, z): s long, w wide, t0..t1 their tilt
  function herbSpray(b, x, y, z, s, pal, n, w, t0, t1) {
    var a0 = b.r() * 6.28;
    for (var k = 0; k < n; k++) {
      var a = a0 + k * 2.39996, t = t0 + (t1 - t0) * ((k * 0.618) % 1), L = s * (0.7 + b.r() * 0.4);
      b.beam([x, y, z], [x + Math.cos(a) * Math.sin(t) * L, y + Math.cos(t) * L, z + Math.sin(a) * Math.sin(t) * L], w, { r2: 0.008, c: b.pick(PAL[pal]), m: M.leaf, bevel: 0, ao: 0.35, roll: a });
    }
  }
  // a sheet pegged on a line: hung at (x, y, z) on a line running at angle ry, w wide and h long
  function sheet(b, x, y, z, ry, w, h, c) {
    var g = new T.PlaneGeometry(w, h, 5, 6), p = g.attributes.position, sway = [], ph = b.r() * 6;
    for (var i = 0; i < p.count; i++) {
      var px = p.getX(i), py = p.getY(i), t = (h / 2 - py) / h;
      p.setXYZ(i, px, py - h / 2, Math.sin(px * 4.2 + ph) * 0.035 * (0.3 + t) + Math.sin(t * 3.1) * 0.05 * t);
      sway.push(t * t);
    }
    g.setAttribute('sway', new T.Float32BufferAttribute(sway, 1)); g.computeVertexNormals();
    b.push(x, y, z, ry);
    b.addGeo(g, { c: c || b.pick(PAL.healerLinen), m: M.cloth, bucket: 'cloth', sway: 1, ao: 0.12, jit: 0.015, vary: 0.03 });
    [-1, 1].forEach(function (sd) { b.box(sd * (w / 2 - 0.06), -0.06, 0, 0.03, 0.1, 0.035, { c: 'woodLight', m: M.wood, bevel: 0.005, ao: 0 }); });
    b.pop();
  }
  // a woven wattle fence from (ax, az) to (bx, bz): stakes, and withies woven in and out between them
  function wattle(b, ax, az, bx, bz, h) {
    var L = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.round(L / 0.42)), ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
    for (var i = 0; i <= n; i++) { var t = i / n; b.cyl(ax + ux * L * t, 0, az + uz * L * t, 0.032, h + 0.08 + b.j(0.04), { c: 'wood', m: M.wood, seg: 6, r2: 0.026 }); }
    var rows = Math.round(h / 0.085);
    for (var r = 0; r < rows; r++) {
      var y = 0.1 + r * (h - 0.1) / rows;
      for (var s = 0; s < n; s++) {
        var o0 = ((s + r) % 2 ? 1 : -1) * 0.035, t0 = s / n, t1 = (s + 1) / n;
        b.beam([ax + ux * L * t0 + nx * o0, y, az + uz * L * t0 + nz * o0], [ax + ux * L * t1 - nx * o0, y + b.j(0.012), az + uz * L * t1 - nz * o0], 0.024, { c: b.chance(0.35) ? 'woodLight' : '#8a7660', round: true, seg: 5, bevel: 0 });
      }
    }
  }
  // a small leafed sprig, the healer's mark, drawn proud of both faces of a board at (x, y, z), s high
  function sprig(b, x, y, z, s, c) {
    var leaf = function (cx, cy, a, L, W) { var pts = []; for (var i = 0; i <= 8; i++) { var t = i / 8, w = Math.sin(t * Math.PI) * W; pts.push([t * L, w]); } for (var j = 7; j >= 1; j--) { var t2 = j / 8; pts.push([t2 * L, -Math.sin(t2 * Math.PI) * W * 0.9]); } return { pts: pts, x: cx, y: cy, rz: a }; };
    var parts = [{ pts: [[-0.02, -0.45], [0.02, -0.45], [0.025, 0.42], [-0.015, 0.42]], x: 0, y: 0, rz: 0 },
      leaf(0, 0.38, 1.45, 0.24, 0.08), leaf(0.01, 0.12, 0.55, 0.3, 0.09), leaf(-0.01, 0.04, 2.6, 0.3, 0.09), leaf(0.01, -0.2, 0.6, 0.26, 0.08), leaf(-0.01, -0.26, 2.55, 0.26, 0.08)];
    parts.forEach(function (sh) {
      var pts = sh.pts.map(function (p) { return [p[0] * s, p[1] * s]; });
      [0.038, -0.038].forEach(function (dz) { b.extrude(x + sh.x * s, y + sh.y * s, z + dz, pts, 0.008, { rz: sh.rz, c: c, m: M.paint, ao: 0, jit: 0.01, vary: 0.02 }); });
    });
  }

  KIT.defineBuild('healer', {
    name: "Healer's house", size: 'middle', need: 36,
    line: "The healer's stone and timber cottage, with an herb garden in raised beds, racks of drying herbs, clean linen on the lines, and the healer binding a wounded soldier on the bench.",
    r: 13.5, flat: [20, 15], ground: 'grass', path: [[2.2, 14.2], [1.5, 8.4], [1.0, 4.6]],
    frameY: 3.4, frameR: 11.6, glowAt: [-2.4, 9.0, 3.2],
    perches: [{ x: 2.3, y: 8.75, z: -1.5, ry: 0 }, { x: -2.4, y: 8.05, z: 1.3, ry: Math.PI / 2 }],
    trees: [{ x: -9.6, z: -4.2, kind: 'round', h: 6.4 }, { x: 10.4, z: 4.6, kind: 'birch', h: 6.6 }, { x: -2.6, z: -8.4, kind: 'olive', h: 5.0 }, { x: 9.7, z: -3.0, kind: 'pine', h: 5.2 }],
    bushes: [{ x: 8.4, z: 7.6, r: 0.85, flowers: '#f3f1ec' }, { x: -8.4, z: 7.4, r: 0.75 }, { x: 3.6, z: -7.2, r: 0.7 }, { x: -10.4, z: 1.6, r: 0.6, flowers: '#efebe4' }, { x: 4.6, z: 9.2, r: 0.6 }],
    build: function (b) {
      // the main block: x -4.8..4.4, z -4.4..-0.4; the front wing: x -4.2..-1.2, out to z 1.8
      var x0 = -4.8, x1 = 4.4, z0 = -4.4, z1 = -0.4, wx0 = -4.2, wx1 = -1.2, wz1 = 1.8;
      var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, wcx = (wx0 + wx1) / 2, W = x1 - x0, D = z1 - z0, WW = wx1 - wx0;
      var TH = 0.55, base = 0.5, H1 = 2.7, top1 = base + H1, u0 = top1 + 0.14, H2 = 2.15, eave = u0 + H2;
      b.push(0.3, 0, 0.9, 0);

      // the L outline of stone walls, offset outward by off, from y0 up h, course by course
      function lWalls(off, y0, h, th, o) {
        var X0 = x0 - off, X1 = x1 + off, Z0 = z0 - off, Z1 = z1 + off, WX0 = wx0 - off, WX1 = wx1 + off, WZ1 = wz1 + off;
        var segs = [
          { k: 'back', a: [X1, Z0 + th / 2], c: [X0, Z0 + th / 2], ax: 0 },
          { k: 'left', a: [X0 + th / 2, Z0 + th], c: [X0 + th / 2, Z1 - th], ax: 1 },
          { k: 'fleft', a: [X0, Z1 - th / 2], c: [WX0 + th, Z1 - th / 2], ax: 0 },
          { k: 'wleft', a: [WX0 + th / 2, Z1], c: [WX0 + th / 2, WZ1 - th], ax: 1 },
          { k: 'wfront', a: [WX0, WZ1 - th / 2], c: [WX1, WZ1 - th / 2], ax: 0 },
          { k: 'wright', a: [WX1 - th / 2, WZ1 - th], c: [WX1 - th / 2, Z1], ax: 1 },
          { k: 'front', a: [WX1 - th, Z1 - th / 2], c: [X1, Z1 - th / 2], ax: 0 },
          { k: 'right', a: [X1 - th / 2, Z1 - th], c: [X1 - th / 2, Z0 + th], ax: 1 }
        ];
        var n = Math.max(1, Math.round(h / (o.course || 0.31))), ch = h / n;
        for (var k = 0; k < n; k++) {
          var y = y0 + k * ch;
          b.unit(function () {
            segs.forEach(function (sg) {
              var hs = (o.holes || []).filter(function (q) { return q.seg === sg.k; });
              var au = sg.a[sg.ax], cu = sg.c[sg.ax], dir = cu > au ? 1 : -1;
              var hole = hs.length ? function (t, yy, s0, s1) {
                var keep = [[s0, s1]], hit = false;
                hs.forEach(function (q) {
                  if (!(yy > q.y0 && yy < q.y1)) return;
                  var ta = (q.u0 - au) * dir, tb = (q.u1 - au) * dir, A = Math.min(ta, tb), B2 = Math.max(ta, tb), nk = [];
                  keep.forEach(function (kk) { if (kk[1] <= A || kk[0] >= B2) { nk.push(kk); return; } hit = true; if (kk[0] < A) nk.push([kk[0], A]); if (kk[1] > B2) nk.push([B2, kk[1]]); });
                  keep = nk;
                });
                return !hit ? false : keep.length ? keep : true;
              } : null;
              b.stoneWall(sg.a[0], sg.a[1], sg.c[0], sg.c[1], y, ch, th, { pal: o.pal || 'stone', len: o.len || 0.66, hole: hole, course: ch, core: !hole });
            });
          });
        }
      }

      b.part('Footings');
      b.unit(function () {
        b.box(cx, -0.1, cz, W + 0.8, 0.3, D + 0.8, { c: 'stoneDark', bevel: 0.07 });
        b.box(wcx, -0.1, (z1 + 0.4 + wz1 + 0.4) / 2, WW + 0.8, 0.3, wz1 - z1, { c: 'stoneDark', bevel: 0.07 });
      });
      lWalls(0.12, 0.2, 0.3, TH + 0.24, { pal: 'stoneDark', len: 0.95, course: 0.3 });

      b.part('Stone walls');
      var ww = 0.8, wh = 1.2, wy = base + 1.1, dX = 0.6, dW = 1.4, dH = 2.4, fwx = 2.3, gwx = wcx, lwz = 0.55, mwz = cz;
      lWalls(0, base, H1, TH, {
        course: 0.31, holes: [
          { seg: 'front', u0: dX - dW / 2 - 0.15, u1: dX + dW / 2 + 0.15, y0: -1, y1: base + dH + 0.1 },
          { seg: 'front', u0: fwx - 0.5, u1: fwx + 0.5, y0: wy - 0.05, y1: wy + wh + 0.08 },
          { seg: 'wfront', u0: gwx - 0.78, u1: gwx + 0.78, y0: wy - 0.05, y1: wy + wh + 0.08 },
          { seg: 'wleft', u0: lwz - 0.45, u1: lwz + 0.45, y0: wy - 0.05, y1: wy + wh + 0.08 },
          { seg: 'left', u0: mwz - 0.5, u1: mwz + 0.5, y0: wy - 0.05, y1: wy + wh + 0.08 }
        ]
      });

      b.part('Doorway and windows');
      b.unit(function () {
        b.archDoor(dX, base, z1, dW, dH, { depth: TH + 0.15, keyC: 'sandstone', frameStone: 'sandstone', doorC: 'woodDark' });
        // two stone steps up to the door
        b.box(dX, 0, z1 + 0.535, dW + 0.7, 0.24, 0.83, { c: 'stone', bevel: 0.05 });
        b.box(dX, 0.2, z1 + 0.335, dW + 0.45, 0.22, 0.43, { c: 'sandstone', bevel: 0.05 });
      });
      b.unit(function () {
        b.window(fwx, wy, z1 - 0.05, ww, wh, { arch: true, sillC: 'sandstone', shutters: '#1f1e1c' });
        b.window(gwx - 0.36, wy, wz1 - 0.05, 0.62, wh, { arch: true, sillC: 'sandstone' });
        b.window(gwx + 0.36, wy, wz1 - 0.05, 0.62, wh, { arch: true, sillC: 'sandstone' });
        b.box(gwx, wy, wz1 - 0.08, 0.14, wh, 0.3, { c: 'sandstone', bevel: 0.03 });
        b.box(gwx, wy - 0.46, wz1 + 0.2, 1.55, 0.28, 0.3, { c: 'wood', m: M.wood });
        for (var f = 0; f < 9; f++) b.ball(gwx - 0.7 + f * 0.175, wy - 0.16, wz1 + 0.22 + b.j(0.05), 0.085, { c: b.pick(PAL.flowers), m: M.paint, ao: 0, detail: 0 });
        for (var g2 = 0; g2 < 6; g2++) b.ball(gwx - 0.65 + g2 * 0.26, wy - 0.2, wz1 + 0.26, 0.1, { c: 'leaf', m: M.leaf, ao: 0.2, detail: 0 });
        b.window(wx0 + 0.05, wy, lwz, 0.7, 1.1, { arch: true, ry: -Math.PI / 2, sillC: 'sandstone', shutters: '#1f1e1c' });
        b.window(x0 + 0.05, wy, mwz, 0.8, wh, { arch: true, ry: -Math.PI / 2, sillC: 'sandstone' });
      });

      b.part('Floor beams');
      b.unit(function () {
        b.box(cx, top1, cz, W + 0.14, 0.14, D + 0.1, { c: 'beam', m: M.wood, bevel: 0.02 });
        b.box(wcx, top1, (z1 + 0.05 + wz1 + 0.07) / 2, WW + 0.14, 0.14, wz1 + 0.07 - z1 - 0.05, { c: 'beam', m: M.wood, bevel: 0.02 });
        // joist ends showing along the fronts
        for (var i = 0; i < 12; i++) { var jx = wx1 + 0.3 + i * (x1 - wx1 - 0.5) / 11; if (Math.abs(jx - dX) < 1.3) continue; b.box(jx, top1 - 0.16, z1 + 0.06, 0.15, 0.16, 0.16, { c: 'beam', m: M.wood, bevel: 0.025 }); }
        for (var j = 0; j < 7; j++) { var kx = wx0 + 0.25 + j * (WW - 0.5) / 6; b.box(kx, top1 - 0.16, wz1 + 0.06, 0.15, 0.16, 0.16, { c: 'beam', m: M.wood, bevel: 0.025 }); }
      });

      b.part('Timber upper floor');
      var tw = { h: H2, shutters: '#1f1e1c' };
      b.timberWall(wx1, z1, x1, z1, u0, { h: H2, post: 1.4, windows: [{ t: 2.1, w: 0.75, y0: 0.75, y1: 1.75, shutters: tw.shutters, flowers: '#f3f1ec' }, { t: 3.5, w: 0.65, y0: 0.8, y1: 1.75, shutters: tw.shutters, flowers: '#efebe4' }] });
      b.timberWall(wx0, wz1, wx1, wz1, u0, { h: H2, post: 0.75, windows: [{ t: 1.125, w: 0.55, y0: 0.75, y1: 1.75, shutters: tw.shutters, flowers: '#f3f1ec' }, { t: 1.875, w: 0.55, y0: 0.75, y1: 1.75, shutters: tw.shutters, flowers: '#e6e3dc' }] });
      b.unit(function () { b.timberWall(wx0, z1, wx0, wz1, u0, { h: H2, post: 1.1, windows: [{ t: 1.65, w: 0.6, y0: 0.8, y1: 1.7, shutters: tw.shutters }] }); });
      b.unit(function () { b.timberWall(wx1, wz1, wx1, z1, u0, { h: H2, post: 1.1, windows: [{ t: 0.55, w: 0.6, y0: 0.8, y1: 1.7, shutters: tw.shutters }] }); b.timberWall(x0, z1, wx0, z1, u0, { h: H2, post: 0.6 }); });
      b.unit(function () { b.timberWall(x0, z0, x0, z1, u0, { h: H2, post: 1.33, windows: [{ t: 2.0, w: 0.7, y0: 0.8, y1: 1.75, shutters: tw.shutters, flowers: '#f3f1ec' }] }); });
      b.unit(function () { b.timberWall(x1, z1, x1, z0, u0, { h: H2, post: 1.33 }); b.timberWall(x1, z0, x0, z0, u0, { h: H2, post: 1.3, windows: [{ t: 2.6, w: 0.6, y0: 0.8, y1: 1.7 }] }); });

      // the roofs: the main ridge along x; the wing's ridge along z, running back into the main roof
      var rw = W + 0.2, rd = D + 0.2, rise = 3.0, over = 0.5, overX = 0.4, slope = rise / (rd / 2);
      var rdw = WW + 0.2, risew = slope * rdw / 2, overW = 0.45, wFront = wz1 + 0.1 + overX, wBack = cz + 0.12, wLen = wFront - wBack - 2 * overX, wzc = (wFront + wBack) / 2;

      b.part('Gable ends');
      b.unit(function () {
        [-1, 1].forEach(function (s) {
          var gx = s < 0 ? x0 + 0.02 : x1 - 0.02, bx = s < 0 ? x0 - 0.1 : x1 + 0.1;
          b.gableEnd(gx, eave, cz, rd - 0.1, rise - 0.12, 0.2, { c: 'plaster' });
          b.beam([bx, eave, cz - rd / 2 + 0.28], [bx, eave + rise - 0.2, cz], 0.08, { c: 'beam' });
          b.beam([bx, eave, cz + rd / 2 - 0.28], [bx, eave + rise - 0.2, cz], 0.08, { c: 'beam' });
          b.beam([bx, eave + 1.25, cz - 1.12], [bx, eave + 1.25, cz + 1.12], 0.075, { c: 'beam' });
          b.beam([bx, eave + 1.25, cz], [bx, eave + rise - 0.25, cz], 0.075, { c: 'beam' });
          b.beam([bx, eave, cz], [bx, eave + 1.25, cz], 0.075, { c: 'beam' });
          if (s < 0) [-1, 1].forEach(function (q) { b.window(bx - 0.02, eave + 0.3, cz + q * 0.65, 0.42, 0.62, { ry: -Math.PI / 2, sillC: 'beam', sillM: M.wood, lintelC: 'beam', shutters: '#1f1e1c', mullion: false }); });
        });
      });
      b.unit(function () {
        var gz = wz1 - 0.04, bz = wz1 + 0.1, hb = rdw / 2 - 0.05, gh = risew - 0.12;
        b.extrude(wcx, eave, gz, [[-hb, 0], [hb, 0], [0, gh]], 0.2, { c: 'plaster', m: M.plaster });
        b.beam([wcx - hb + 0.2, eave, bz], [wcx, eave + gh - 0.08, bz], 0.08, { c: 'beam' });
        b.beam([wcx + hb - 0.2, eave, bz], [wcx, eave + gh - 0.08, bz], 0.08, { c: 'beam' });
        b.beam([wcx - 0.68, eave + 1.2, bz], [wcx + 0.68, eave + 1.2, bz], 0.075, { c: 'beam' });
        b.beam([wcx, eave + 1.2, bz], [wcx, eave + gh - 0.15, bz], 0.075, { c: 'beam' });
        [-1, 1].forEach(function (s) { b.beam([wcx + s * 1.25, eave + 0.05, bz], [wcx + s * 0.42, eave + 1.2, bz], 0.07, { c: 'beam' }); });
        b.window(wcx, eave + 0.32, bz - 0.04, 0.5, 0.66, { sillC: 'beam', sillM: M.wood, lintelC: 'beam', shutters: '#1f1e1c', mullion: true });
      });

      b.part('Main roof');
      b.gableRoof(cx, eave, cz, rw, rd, rise, { m: 'slate', over: over, overX: overX });

      b.part('Wing roof');
      b.gableRoof(wcx, eave, wzc, wLen, rdw, risew, { m: 'slate', c: 'healerSlateW', over: overW, overX: overX, ry: Math.PI / 2 });

      b.part('Ridge tiles');
      b.unit(function () {
        // rounded ridge tiles capping both ridges, laid one at a time
        var ry0 = eave + rise + 0.06, xa = cx - rw / 2 - overX + 0.1, xb = x1 + 0.12;
        for (var x = xa; x < xb; x += 0.29) b.cyl(x, ry0, cz, 0.1, 0.31, { r2: 0.09, rz: -Math.PI / 2, c: b.pick(['#6d6a64', '#66635d', '#74706a']), m: M.tile, seg: 8, ao: 0.15, jit: 0.01 });
        var wy0 = eave + risew + 0.06, za = cz + 0.55, zb = wFront - 0.12;
        for (var z = za; z < zb; z += 0.29) b.cyl(wcx, wy0, z, 0.1, 0.31, { r2: 0.09, rx: Math.PI / 2, c: b.pick(['#6d6a64', '#66635d', '#74706a']), m: M.tile, seg: 8, ao: 0.15, jit: 0.01 });
      });

      b.part('Dormer');
      b.unit(function () {
        // a broad gabled dormer on the wing's shaded slope, two shuttered casements in a plastered, timbered face
        var dz = 0.75, fxd = wx0 - 0.02, dl = 1.6, dw = 1.65, dy0 = eave - 0.12, dh = 1.42, drise = 0.78;
        b.box(fxd + dl / 2, dy0, dz, dl, dh, dw, { c: 'plaster', m: M.plaster, bevel: 0.02 });
        [-1, 0, 1].forEach(function (q) { b.beam([fxd - 0.06, dy0, dz + q * (dw / 2 - 0.05)], [fxd - 0.06, dy0 + dh, dz + q * (dw / 2 - 0.05)], 0.07, { c: 'beam' }); });
        b.beam([fxd - 0.06, dy0 + dh - 0.06, dz - dw / 2], [fxd - 0.06, dy0 + dh - 0.06, dz + dw / 2], 0.07, { c: 'beam' });
        b.beam([fxd - 0.06, dy0 + 0.3, dz - dw / 2], [fxd - 0.06, dy0 + 0.3, dz + dw / 2], 0.06, { c: 'beam' });
        [-1, 1].forEach(function (q) { b.window(fxd - 0.04, dy0 + 0.42, dz + q * 0.4, 0.42, 0.66, { ry: -Math.PI / 2, sillC: 'beam', sillM: M.wood, lintelC: 'beam', mullion: true }); });
        // its little gable: plaster with a king post under the barge boards
        b.extrude(fxd - 0.03, dy0 + dh, dz, [[-dw / 2 - 0.02, 0], [dw / 2 + 0.02, 0], [0, drise - 0.06]], 0.06, { c: 'plaster', m: M.plaster, ry: -Math.PI / 2 });
        b.beam([fxd - 0.07, dy0 + dh, dz], [fxd - 0.07, dy0 + dh + drise - 0.12, dz], 0.05, { c: 'beam' });
        b.push(fxd + dl / 2 - 0.1, dy0 + dh, dz, 0);
        b.gableRoof(0, 0, 0, dl + 0.2, dw + 0.1, drise, { m: 'slate', c: 'healerSlateW', over: 0.16, overX: 0.12, rows: 3, rowsAsUnits: false });
        b.pop();
        healerHead(b, fxd - 0.2, dy0 + dh + drise, dz, 0.46, Math.PI, -0.4);
      });

      b.part('Chimney');
      var chx = x1 + 0.6, chz = cz;
      var chB = eave - 0.8, chT = eave + rise + 1.2, chS = (chT - chB - 0.45) / 2;
      b.unit(function () { b.stoneBox(chx, chz, 1.2, 1.7, 0.2, (chB - 0.2) / 2, 0.42, { pal: 'stone', course: 0.37, len: 0.55 }); });
      b.unit(function () {
        b.stoneBox(chx, chz, 1.2, 1.7, 0.2 + (chB - 0.2) / 2, (chB - 0.2) / 2, 0.42, { pal: 'stone', course: 0.37, len: 0.55 });
        b.box(chx, chB, chz, 1.28, 0.45, 1.78, { c: 'sandstone', taper: 0.72, taperD: 0.62 });
      });
      b.unit(function () { b.stoneBox(chx, chz, 0.82, 1.06, chB + 0.45, chS, 0.36, { pal: 'stone', course: 0.375, len: 0.5 }); });
      b.unit(function () {
        b.stoneBox(chx, chz, 0.82, 1.06, chB + 0.45 + chS, chS, 0.36, { pal: 'stone', course: 0.375, len: 0.5 });
        b.box(chx, chT, chz, 1.02, 0.18, 1.26, { c: 'sandstone', bevel: 0.05 });
        [-0.24, 0.24].forEach(function (q) { b.lathe(chx, chT + 0.18, chz + q, [[0.17, 0], [0.19, 0.08], [0.15, 0.32], [0.17, 0.4], [0.12, 0.42], [0.11, 0.1]], { c: 'stoneDark', m: M.stone, seg: 10, flat: true }); });
      });

      b.part('Carved dragon heads');
      var dropW = -overW * slope, dropM = -over * slope;
      b.unit(function () {
        b.push(wcx, 0, wzc + wLen / 2 + overX + 0.05, 0);
        healerBarge(b, rdw / 2 + overW, eave + dropW + 0.1, eave + risew + 0.1, 0.4, 0.88);
        b.pop();
      });
      b.unit(function () {
        b.push(cx - rw / 2 - overX - 0.05, 0, cz, -Math.PI / 2);
        healerBarge(b, rd / 2 + over, eave + dropM + 0.1, eave + rise + 0.1, 0.5, 1.15);
        b.pop();
        b.push(cx + rw / 2 + overX + 0.05, 0, cz, Math.PI / 2);
        healerBarge(b, rd / 2 + over, eave + dropM + 0.1, eave + rise + 0.1, 0, 0);
        b.pop();
      });

      b.part('Porch');
      var pz = z1 + 1.5, py = 2.85, pTop = 3.5;
      b.unit(function () {
        [-1, 1].forEach(function (s) {
          var px = dX + s * 1.02;
          b.box(px, 0, pz, 0.34, 0.16, 0.34, { c: 'stone', bevel: 0.04 });
          b.post(px, 0.16, pz, 0.085, py - 0.16, { c: 'woodDark' });
          // stave carving: rings and a bulbed capital
          [0.55, 1.4].forEach(function (y) { b.box(px, 0.16 + y, pz, 0.22, 0.07, 0.22, { c: 'woodDark', m: M.wood, bevel: 0.02, ry: 0.78 }); });
          b.lathe(px, py - 0.32, pz, [[0.09, 0], [0.13, 0.1], [0.14, 0.2], [0.11, 0.3], [0.13, 0.32]], { c: 'woodDark', m: M.wood, seg: 8, flat: true });
        });
      });
      b.unit(function () {
        b.beam([dX - 1.3, py + 0.1, pz], [dX + 1.3, py + 0.1, pz], 0.09, { c: 'beam' });
        [-1, 1].forEach(function (s) {
          var px = dX + s * 1.02;
          b.beam([px, py + 0.1, pz + 0.1], [px, pTop - 0.05, z1 - 0.05], 0.08, { c: 'beam' });
          b.beam([px, py - 0.6, pz], [px - s * 0.5, py + 0.05, pz], 0.05, { c: 'beam' });
          // the header's ends carved into small dragon heads looking out along the wall
          healerHead(b, dX + s * 1.3, py + 0.02, pz, 0.46, s > 0 ? 0 : Math.PI, -0.55);
        });
        // a round shield hung on the post by the door
        b.shield(dX - 1.02, 1.5, pz + 0.1, { kind: 'round', c: 'ink', s: 0.62 });
      });
      b.unit(function () { pentRoof(b, dX, pTop, z1 + 0.02, 2.75, 1.78, pTop - py - 0.18, 4); });

      b.part("Healer's sign");
      b.unit(function () {
        var sx = wx1 - 0.375, sy = u0 + 1.5;
        b.beam([sx, sy, wz1 + 0.08], [sx, sy, wz1 + 1.05], 0.035, { c: 'iron', m: M.metal });
        b.beam([sx, sy - 0.5, wz1 + 0.08], [sx, sy, wz1 + 0.72], 0.025, { c: 'iron', m: M.metal });
        b.push(sx, sy - 0.06, wz1 + 0.78, Math.PI / 2);
        [-0.32, 0.32].forEach(function (q) { b.beam([q, 0.06, 0], [q, -0.16, 0], 0.01, { c: 'iron', m: M.metal, round: true, seg: 4 }); });
        b.box(0, -0.86, 0, 0.82, 0.72, 0.06, { c: 'ink', m: M.paint, bevel: 0.015 });
        sprig(b, 0, -0.5, 0, 0.6, '#f1eee8');
        b.box(0, -0.92, 0, 0.82, 0.035, 0.075, { c: 'ember', m: M.paint, bevel: 0.005, ao: 0 });
        b.pop();
        b.torch(dX - 1.02, 2.1, pz + 0.09, { s: 0.55 });
      });

      b.part('Yard paving');
      var slabs = [];
      (function () {
        for (var gx = -4.2; gx <= 5.4; gx += 0.6) for (var gz = -0.1; gz <= 3.5; gz += 0.55) {
          var x = gx + b.j(0.08) + (Math.round(gz / 0.55) % 2) * 0.3, z = gz + b.j(0.06);
          var inMain = x > wx1 + 0.1 && x < 5.4 && z > z1 + 0.15 && z < 3.2, inWing = x > wx0 && x <= wx1 + 0.1 && z > wz1 + 0.25 && z < 3.4;
          if (!(inMain || inWing)) continue;
          if (Math.abs(x - dX) < 1.2 && z < z1 + 0.85) continue; // the steps
          if (Math.hypot(x - 5.0, z - 3.0) < 0.8) continue; // the fire
          var edge = Math.min(x - wx0, 5.4 - x, (inMain ? 3.2 : 3.4) - z);
          if (b.r() < (edge < 0.5 ? 0.45 : 0.06)) continue;
          slabs.push([x, z]);
        }
      })();
      var half = Math.floor(slabs.length / 2);
      [slabs.slice(0, half), slabs.slice(half)].forEach(function (set) {
        b.unit(function () { set.forEach(function (s) { b.box(s[0], -0.02, s[1], 0.5 + b.j(0.06), 0.06, 0.45 + b.j(0.05), { ry: b.j(0.12), c: b.stoneC('stone', 0.6), m: M.stone, bevel: 0.03, ao: 0.1, jit: 0.04 }); }); });
      });

      b.part('Raised beds');
      var beds = [[-9.0, 2.3], [-7.25, 2.3], [-5.5, 2.3]], bw = 1.2, bl = 2.6, bh = 0.42;
      beds.forEach(function (bd) {
        b.unit(function () {
          var X = bd[0], Z = bd[1];
          [-1, 1].forEach(function (s) {
            for (var r = 0; r < 2; r++) {
              b.box(X + s * (bw / 2 - 0.035), r * 0.19, Z, 0.07, 0.18, bl - 0.08, { c: b.pick(PAL.wood), m: M.wood, bevel: 0.012 });
              b.box(X, r * 0.19, Z + s * (bl / 2 - 0.035), bw - 0.14, 0.18, 0.07, { c: b.pick(PAL.wood), m: M.wood, bevel: 0.012 });
            }
            [-1, 1].forEach(function (q) { b.post(X + s * (bw / 2 - 0.05), 0, Z + q * (bl / 2 - 0.05), 0.055, bh, { c: 'woodDark' }); });
          });
          b.box(X, 0.05, Z, bw - 0.12, 0.3, bl - 0.12, { c: b.pick(PAL.healerSoil), m: M.soil, bevel: 0.02, ao: 0.2 });
        });
      });

      b.part('Herbs planted');
      b.unit(function () {
        // sage cushions and white yarrow
        var X = beds[0][0], Z = beds[0][1];
        for (var i = 0; i < 4; i++) for (var k = 0; k < 2; k++) {
          var hx = X - 0.27 + k * 0.54 + b.j(0.05), hz = Z - 0.95 + i * 0.63 + b.j(0.05);
          b.ball(hx, 0.4, hz, 0.15, { c: b.pick(PAL.healerSage), m: M.leaf, sy: 0.75, detail: 1, ao: 0.4 }); herbSpray(b, hx, 0.4, hz, 0.34, 'healerSage', 22, 0.06, 0.45, 1.3);
          if (b.chance(0.6)) for (var f = 0; f < 3; f++) { var fx = hx + b.j(0.15), fz = hz + b.j(0.15), fy = 0.7 + b.r() * 0.15; b.beam([fx, 0.4, fz], [fx, fy, fz], 0.008, { c: '#6b7f4f', m: M.leaf, round: true, seg: 3, bevel: 0 }); b.ball(fx, fy, fz, 0.05, { c: '#f1eee8', m: M.paint, sy: 0.5, detail: 0, ao: 0 }); }
        }
      });
      b.unit(function () {
        // broad comfrey leaves and white feverfew
        var X = beds[1][0], Z = beds[1][1];
        for (var i = 0; i < 3; i++) {
          var hx = X + b.j(0.1), hz = Z - 0.8 + i * 0.8;
          b.clump(hx, 0.56, hz, 0.3, { pal: 'healerHerb', topPal: 'leaf', cards: 12 });
          for (var f = 0; f < 7; f++) { var a = b.r() * 6.28; b.ball(hx + Math.cos(a) * 0.3, 0.62 + b.r() * 0.22, hz + Math.sin(a) * 0.3, 0.04, { c: b.pick(['#f3f1ec', '#efebe4']), m: M.paint, detail: 0, ao: 0 }); }
        }
      });
      b.unit(function () {
        // feathery fennel and dill on tall stalks, low thyme beneath
        var X = beds[2][0], Z = beds[2][1];
        for (var i = 0; i < 5; i++) {
          var hx = X + (i % 2 ? 0.25 : -0.25) + b.j(0.06), hz = Z - 1.0 + i * 0.5;
          herbSpray(b, hx, 0.38, hz, 0.24, 'healerHerb', 14, 0.045, 0.8, 1.35);
          for (var s = 0; s < 4; s++) {
            var sx = hx + b.j(0.12), sz = hz + b.j(0.12), top = [sx + b.j(0.08), 0.95 + b.r() * 0.35, sz + b.j(0.08)];
            b.beam([sx, 0.4, sz], top, 0.01, { c: '#7d8a55', m: M.leaf, round: true, seg: 3, bevel: 0 });
            b.ball(top[0], top[1], top[2], 0.08, { c: b.chance(0.5) ? '#e3ddc4' : '#c9c79a', m: M.leaf, sy: 0.35, detail: 1, ao: 0 });
          }
        }
      });

      b.part('Lavender walk');
      // two rows of white lavender line the walk out of the garden gate
      [-7.3, -5.7].forEach(function (lx0) {
        b.unit(function () {
          for (var i = 0; i < 3; i++) {
            var lx = lx0 + b.j(0.06), lz = 5.0 + i * 0.65 + b.j(0.06);
            b.ball(lx, 0.1, lz, 0.22, { c: b.pick(PAL.healerSage), m: M.leaf, sy: 0.7, detail: 1, ao: 0.45 }); herbSpray(b, lx, 0.04, lz, 0.5, 'healerSage', 26, 0.035, 0.2, 1.0);
            for (var f = 0; f < 7; f++) { var a = b.r() * 6.28, d = b.r() * 0.2, fy = 0.5 + b.r() * 0.18; b.beam([lx + Math.cos(a) * d, 0.3, lz + Math.sin(a) * d], [lx + Math.cos(a) * d * 1.4, fy, lz + Math.sin(a) * d * 1.4], 0.008, { c: '#6b7f4f', m: M.leaf, round: true, seg: 3, bevel: 0 }); b.box(lx + Math.cos(a) * d * 1.4, fy - 0.02, lz + Math.sin(a) * d * 1.4, 0.035, 0.11, 0.035, { c: b.pick(['#f3f1ec', '#e6e3dc']), m: M.paint, bevel: 0.01, ao: 0 }); }
          }
        });
      });

      b.part('Wattle fence');
      b.unit(function () { wattle(b, -9.8, 4.35, -6.9, 4.35, 0.68); });
      b.unit(function () { wattle(b, -6.1, 4.35, -4.1, 4.35, 0.68); wattle(b, -9.8, 4.35, -9.8, 2.6, 0.68); });
      b.unit(function () {
        // the wicket gate, swung open into the garden
        b.push(-6.9, 0, 4.35, 0.9);
        [0.14, 0.62].forEach(function (y) { b.box(0.4, y, 0, 0.78, 0.07, 0.05, { c: 'woodLight', m: M.wood, bevel: 0.01 }); });
        for (var i = 0; i < 5; i++) b.box(0.06 + i * 0.17, 0.05, 0, 0.07, 0.68, 0.04, { c: 'woodLight', m: M.wood, bevel: 0.01 });
        b.beam([0.05, 0.16, 0.03], [0.75, 0.62, 0.03], 0.03, { c: 'wood' });
        b.pop();
        b.post(-6.1, 0, 4.35, 0.05, 0.85, { c: 'wood' });
      });

      b.part('Drying racks');
      var racks = [[7.2, 0.6, 0.1, 2.4], [7.1, -2.3, -0.05, 2.4]];
      racks.forEach(function (rk) {
        b.unit(function () {
          b.push(rk[0], 0, rk[1], rk[2]);
          [-1, 1].forEach(function (s) {
            var x = s * rk[3] / 2;
            b.beam([x, 0, -0.55], [x, 1.95, 0], 0.05, { c: 'wood' });
            b.beam([x, 0, 0.55], [x, 1.95, 0], 0.05, { c: 'wood' });
            b.beam([x, 0.7, -0.37], [x, 0.7, 0.37], 0.035, { c: 'woodLight' });
          });
          b.beam([-rk[3] / 2 - 0.2, 1.9, 0], [rk[3] / 2 + 0.2, 1.9, 0], 0.04, { c: 'woodLight', round: true });
          [-1, 1].forEach(function (q) { b.beam([-rk[3] / 2, 1.25, q * 0.2], [rk[3] / 2, 1.25, q * 0.2], 0.03, { c: 'woodLight', round: true }); });
          b.pop();
        });
        b.unit(function () {
          b.push(rk[0], 0, rk[1], rk[2]);
          var n = Math.round(rk[3] / 0.24);
          for (var i = 0; i < n; i++) { var x = -rk[3] / 2 + 0.15 + i * (rk[3] - 0.3) / (n - 1); bundle(b, x + b.j(0.03), 1.86, b.j(0.02), 0.32 + b.r() * 0.12); }
          [-1, 1].forEach(function (q) { for (var k = 0; k < n - 2; k++) { var x2 = -rk[3] / 2 + 0.3 + k * (rk[3] - 0.6) / (n - 3); bundle(b, x2 + b.j(0.03), 1.22, q * 0.2, 0.26 + b.r() * 0.1); } });
          b.pop();
        });
      });

      b.part('Linen lines');
      var lines = [[[2.4, 5.6], [5.6, 4.6]], [[5.6, 4.6], [8.2, 3.0]]];
      b.unit(function () {
        [[2.4, 5.6], [5.6, 4.6], [8.2, 3.0]].forEach(function (p) { b.post(p[0], 0, p[1], 0.06, 2.15, { c: 'wood' }); b.box(p[0], 2.08, p[1], 0.36, 0.08, 0.1, { c: 'wood', m: M.wood, ry: b.r() }); });
        lines.forEach(function (ln) {
          var a = ln[0], c = ln[1];
          for (var i = 0; i < 6; i++) {
            var t0 = i / 6, t1 = (i + 1) / 6, s0 = 0.18 * 4 * t0 * (1 - t0), s1 = 0.18 * 4 * t1 * (1 - t1);
            b.beam([a[0] + (c[0] - a[0]) * t0, 2.02 - s0, a[1] + (c[1] - a[1]) * t0], [a[0] + (c[0] - a[0]) * t1, 2.02 - s1, a[1] + (c[1] - a[1]) * t1], 0.008, { c: 'rope', m: M.rope, round: true, seg: 4, bevel: 0 });
          }
        });
      });
      b.unit(function () {
        lines.forEach(function (ln, li) {
          var a = ln[0], c = ln[1], L = Math.hypot(c[0] - a[0], c[1] - a[1]), ry = -Math.atan2(c[1] - a[1], c[0] - a[0]);
          var items = li === 0 ? [[0.19, 1.05, 1.25], [0.47, 0.55, 0.75], [0.74, 1.0, 1.15]] : [[0.42, 1.0, 1.2], [0.8, 0.55, 0.7]];
          items.forEach(function (it) {
            var t = it[0], sag = 0.18 * 4 * t * (1 - t);
            sheet(b, a[0] + (c[0] - a[0]) * t, 2.02 - sag, a[1] + (c[1] - a[1]) * t, ry, it[1], it[2]);
          });
        });
      });

      b.part('Remedy fire');
      var px2 = 5.0, pz2 = 3.0;
      b.unit(function () {
        for (var i = 0; i < 9; i++) { var a = i / 9 * 6.28; b.rock(px2 + Math.cos(a) * 0.48, 0.02, pz2 + Math.sin(a) * 0.48, 0.15, {}); }
        [0.9, 3.0, 5.1].forEach(function (a) { b.beam([px2 + Math.cos(a) * 0.75, 0, pz2 + Math.sin(a) * 0.75], [px2, 1.55, pz2], 0.03, { c: 'iron', m: M.metal }); });
        b.beam([px2, 1.55, pz2], [px2, 0.95, pz2], 0.012, { c: 'iron', m: M.metal, round: true, seg: 4 });
        b.lathe(px2, 0.45, pz2, [[0.01, 0], [0.2, 0.02], [0.32, 0.18], [0.34, 0.36], [0.3, 0.48], [0.32, 0.5]], { c: '#2e2f31', m: M.metal, seg: 14 });
        b.cyl(px2, 0.9, pz2, 0.3, 0.02, { c: '#5f6a52', m: M.water, seg: 14 });
        b.embers(px2, 0.08, pz2, 0.34, {});
        b.flame(px2, 0.08, pz2, 0.5, { i: 0.6 });
        b.woodpile(px2 + 0.4, pz2 + 1.05, { n: 3, len: 0.9, ry: 0.3 });
      });

      b.part('Bee skeps');
      b.unit(function () {
        var hx = -7.6, hz = -0.9;
        [-0.75, 0.75].forEach(function (s) { b.box(hx + s, 0, hz, 0.28, 0.42, 0.42, { c: 'stone', bevel: 0.05 }); });
        b.box(hx, 0.42, hz, 2.1, 0.07, 0.5, { c: 'woodLight', m: M.wood });
        [-0.55, 0.0, 0.55].forEach(function (s, i) {
          b.lathe(hx + s, 0.49, hz, [[0.01, 0], [0.24, 0], [0.26, 0.1], [0.24, 0.24], [0.19, 0.36], [0.11, 0.44], [0.01, 0.47]], { c: '#978c78', m: M.straw, seg: 14, flat: true });
          [0.08, 0.18, 0.28, 0.37].forEach(function (y, k) { var rr = [0.262, 0.254, 0.228, 0.186][k]; b.cyl(hx + s, 0.49 + y, hz, rr, 0.025, { c: 'rope', m: M.rope, seg: 14, open: true }); });
          b.box(hx + s, 0.49, hz + 0.22, 0.1, 0.06, 0.05, { c: '#2a2420', m: M.dark, bevel: 0, ao: 0 });
        });
      });

      b.part('Bench and remedies');
      var sx = 2.9, sz = 2.1, sry = -0.35, tbx = 3.75, tbz = 0.45;
      b.unit(function () {
        b.bench(sx, sz, 1.6, { ry: sry });
        b.table(tbx, tbz, 0.95, 0.6, { ry: 0 });
      });
      b.unit(function () {
        b.push(tbx, 0.81, tbz, 0);
        b.lathe(-0.22, 0, 0.02, [[0.01, 0], [0.13, 0], [0.2, 0.09], [0.22, 0.1]], { c: 'wood', m: M.wood, seg: 12, flat: true });
        b.cyl(-0.22, 0.07, 0.02, 0.18, 0.01, { c: '#7f8a86', m: M.water, seg: 12 });
        b.lathe(0.12, 0, -0.14, [[0.01, 0], [0.08, 0], [0.1, 0.08], [0.07, 0.2], [0.045, 0.24], [0.055, 0.28]], { c: '#8a857c', m: M.stone, seg: 10 });
        b.lathe(0.3, 0, 0.1, [[0.01, 0], [0.08, 0], [0.1, 0.09], [0.11, 0.11], [0.07, 0.11]], { c: '#b9b2a2', m: M.stone, seg: 10, flat: true });
        b.beam([0.3, 0.05, 0.1], [0.36, 0.22, 0.05], 0.015, { c: '#b9b2a2', m: M.stone, round: true, seg: 5 });
        [[-0.02, 0.16], [0.08, 0.2], [0.03, 0.06]].forEach(function (p) { b.cyl(p[0], 0.045, p[1], 0.045, 0.1, { c: '#f3f1ec', m: M.cloth, seg: 8, rz: Math.PI / 2, ry: b.r() }); });
        [[0.36, -0.16, '#3a3936'], [0.25, -0.2, '#f3f1ec'], [-0.36, -0.2, '#3a3936']].forEach(function (p) { b.lathe(p[0], 0, p[1], [[0.01, 0], [0.04, 0], [0.05, 0.06], [0.03, 0.1], [0.035, 0.12]], { c: p[2], m: M.paint, seg: 8 }); });
        b.pop();
        // a bucket of clean water at the soldier's feet, a basket of cut herbs by the table
        var bp = loc(sx, sz, sry, 0.2, 0, 0.8); b.bucket(bp[0], 0, bp[2]);
        var kx = tbx - 0.75, kz = tbz + 0.35;
        b.lathe(kx, 0, kz, [[0.01, 0], [0.2, 0], [0.24, 0.22], [0.25, 0.24]], { c: 'woodLight', m: M.wood, seg: 12, flat: true });
        for (var i = 0; i < 4; i++) b.ball(kx + b.j(0.12), 0.24, kz + b.j(0.12), 0.08, { c: b.pick(PAL.healerHerb), m: M.leaf, detail: 0 });
      });

      b.part('Stores and firewood');
      b.unit(function () {
        b.barrel(x0 - 0.15, 0, 0.45, { h: 0.95 });
        b.cyl(x0 - 0.15, 0.94, 0.45, 0.27, 0.01, { c: '#5f6a6a', m: M.water, seg: 12 });
        b.woodpile(x0 - 0.95, z0 + 1.6, { n: 4, len: 1.8, ry: Math.PI / 2 });
        b.woodpile(x0 - 0.85, z0 + 3.1, { n: 3, len: 1.1, ry: Math.PI / 2 });
        b.log(x0 - 1.6, 0, -1.2, 0.26, 0.5, { c: 'woodLight' });
        b.beam([x0 - 1.55, 0.5, -1.2], [x0 - 1.25, 0.95, -1.05], 0.025, { c: 'wood' });
        b.box(x0 - 1.53, 0.46, -1.22, 0.04, 0.12, 0.2, { c: 'iron', m: M.metal, ry: 0.4 });
      });
      b.unit(function () {
        b.crate(x1 + 0.75, 0, z1 + 0.3, 0.65, { ry: 0.2 });
        b.sack(x1 + 0.72, 0.65, z1 + 0.28, 0.42);
        b.sack(x1 + 0.6, 0, z1 + 1.1, 0.5);
        b.sack(x1 + 1.2, 0, z1 + 0.7, 0.44);
        // a watering can and a hoe by the garden
        b.lathe(-4.25, 0, 3.95, [[0.01, 0], [0.13, 0], [0.14, 0.26], [0.1, 0.3], [0.01, 0.3]], { c: 'iron', m: M.metal, seg: 10 });
        b.beam([-4.15, 0.12, 3.95], [-3.87, 0.34, 4.0], 0.018, { c: 'iron', m: M.metal, round: true, seg: 5 });
        b.beam([-4.75, 0, 4.22], [-4.6, 1.45, 4.36], 0.022, { c: 'woodLight', round: true, seg: 5 });
        b.box(-4.77, 0, 4.2, 0.2, 0.12, 0.03, { c: 'iron', m: M.metal, ry: 0.3 });
      });

      b.part('Herbs at the door');
      b.unit(function () {
        // bundles on the porch beam and under the wing eave
        for (var i = 0; i < 7; i++) bundle(b, dX - 0.9 + i * 0.3, py + 0.02, pz + 0.02, 0.26 + b.r() * 0.08);
        b.beam([wx0 + 0.3, eave - 0.32, wz1 + 0.42], [wx1 - 0.9, eave - 0.32, wz1 + 0.42], 0.025, { c: 'woodLight', round: true });
        [wx0 + 0.3, wx1 - 0.9].forEach(function (x) { b.beam([x, eave - 0.32, wz1 + 0.1], [x, eave - 0.32, wz1 + 0.44], 0.03, { c: 'iron', m: M.metal }); });
        for (var k = 0; k < 6; k++) bundle(b, wx0 + 0.42 + k * 0.33, eave - 0.34, wz1 + 0.42, 0.26 + b.r() * 0.08);
      });

      b.part('Well');
      var wlx = -2.9, wlz = 5.75;
      b.stoneRing(wlx, wlz, 0.6, 0, 0.84, 0.3, { pal: 'stone', course: 0.28, len: 0.42 });
      b.unit(function () {
        b.lathe(wlx, 0.84, wlz, [[0.44, 0], [0.82, 0], [0.84, 0.08], [0.8, 0.12], [0.46, 0.12], [0.44, 0]], { c: 'sandstone', m: M.stone, seg: 18, flat: true });
        b.cyl(wlx, 0.55, wlz, 0.45, 0.01, { c: '#3b4446', m: M.water, seg: 14 });
        [-1, 1].forEach(function (s) { b.post(wlx + s * 0.92, 0, wlz, 0.07, 2.05, { c: 'woodDark' }); b.box(wlx + s * 0.92, 0, wlz, 0.3, 0.12, 0.3, { c: 'stoneDark', bevel: 0.03 }); });
        b.beam([wlx - 1.05, 1.5, wlz], [wlx + 1.0, 1.5, wlz], 0.06, { c: 'woodLight', round: true });
        b.cyl(wlx - 0.32, 1.5, wlz, 0.1, 0.55, { c: 'rope', m: M.rope, seg: 10, rz: -Math.PI / 2 });
        b.beam([wlx - 1.05, 1.5, wlz], [wlx - 1.05, 1.22, wlz + 0.12], 0.025, { c: 'iron', m: M.metal });
        b.beam([wlx - 1.05, 1.22, wlz + 0.12], [wlx - 1.25, 1.22, wlz + 0.12], 0.025, { c: 'woodLight', round: true });
        b.beam([wlx - 0.05, 1.45, wlz + 0.08], [wlx - 0.05, 1.08, wlz + 0.08], 0.01, { c: 'rope', m: M.rope, round: true, seg: 4, bevel: 0 });
        b.bucket(wlx - 0.05, 0.78, wlz + 0.08);
        b.bucket(wlx + 0.45, 0.96, wlz + 0.42);
      });
      b.unit(function () {
        b.gableRoof(wlx, 2.0, wlz, 1.84, 1.2, 0.62, { m: 'wood', c: 'healerShingle', over: 0.2, overX: 0.14, rows: 2, rowsAsUnits: false });
        [-1, 1].forEach(function (s) { b.gableEnd(wlx + s * 0.92, 2.0, wlz, 1.15, 0.58, 0.05, { c: 'woodDark', m: M.wood }); });
        healerHead(b, wlx - 1.08, 2.5, wlz, 0.42, Math.PI, -0.35);
      });

      b.part('Stepping stones');
      var steps = [[-6.5, 4.75], [-6.45, 5.35], [-6.5, 5.95], [-6.4, 6.5], [-6.0, 6.95], [-5.4, 7.12], [-4.8, 7.15], [-4.2, 7.08], [-3.6, 7.0], [-3.0, 6.98], [-2.4, 7.0], [-1.8, 7.04], [-1.2, 7.08], [-0.6, 7.12], [0.0, 7.16], [0.5, 7.2]];
      [steps.slice(0, 8), steps.slice(8)].forEach(function (set) {
        b.unit(function () { set.forEach(function (p) { b.box(p[0] + b.j(0.05), -0.03, p[1] + b.j(0.05), 0.46 + b.j(0.08), 0.07, 0.4 + b.j(0.06), { ry: b.r() * 3, c: b.stoneC('stone', 0.6), m: M.stone, bevel: 0.035, ao: 0.1, jit: 0.04 }); }); });
      });

      b.part('Drying trestle');
      b.unit(function () {
        // herbs laid out to dry on a clean cloth over a trestle board
        b.push(-4.3, 0, 8.25, 0.35);
        [-1, 1].forEach(function (sd) {
          b.beam([sd * 0.75, -0.12, -0.3], [sd * 0.75, 0.68, 0], 0.035, { c: 'wood' });
          b.beam([sd * 0.75, -0.12, 0.3], [sd * 0.75, 0.68, 0], 0.035, { c: 'wood' });
          b.beam([sd * 0.75, 0.3, -0.16], [sd * 0.75, 0.3, 0.16], 0.025, { c: 'woodLight' });
        });
        b.box(0, 0.66, 0, 1.95, 0.05, 0.64, { c: 'woodLight', m: M.wood, bevel: 0.01 });
        b.box(0, 0.71, 0, 1.82, 0.012, 0.6, { c: '#efebe4', m: M.cloth, bevel: 0.004, ao: 0 });
        [-1, 1].forEach(function (sd) { b.box(0, 0.54, sd * 0.3, 1.82, 0.18, 0.012, { c: '#efebe4', m: M.cloth, bevel: 0.003, ao: 0.05 }); });
        for (var i = 0; i < 8; i++) {
          var hx = -0.74 + i * 0.21 + b.j(0.02);
          b.cyl(hx, 0.77, -0.2 + b.j(0.03), 0.05, 0.36, { r2: 0.022, rx: Math.PI / 2, ry: b.j(0.15), c: b.pick(i % 3 ? PAL.healerDry : PAL.healerHerb), m: M.leaf, seg: 7, ao: 0.2, flat: true });
          b.ball(hx, 0.77, 0.17, 0.04, { c: b.chance(0.4) ? '#e9e5da' : b.pick(PAL.healerDry), m: M.leaf, detail: 0, ao: 0.1 });
        }
        // a basket of cut sprigs and a knife by the trestle
        b.lathe(1.25, 0, 0.1, [[0.01, 0], [0.2, 0], [0.24, 0.22], [0.25, 0.24]], { c: 'woodLight', m: M.wood, seg: 12, flat: true });
        for (var k = 0; k < 5; k++) b.ball(1.25 + b.j(0.12), 0.24, 0.1 + b.j(0.12), 0.08, { c: b.pick(PAL.healerHerb), m: M.leaf, detail: 0 });
        b.box(0.55, 0.725, 0.12, 0.22, 0.012, 0.035, { c: 'steel', m: M.metal, bevel: 0.002, ry: 0.4 });
        b.pop();
      });

      b.part('Ivy and flowers');
      b.unit(function () {
        b.ivy([[x0 - 0.1, 0.4, z1 - 0.3], [x0 - 0.1, 1.6, z1 - 0.5], [x0 - 0.1, 2.8, z1 - 0.4], [x0 - 0.12, 3.6, z1 - 0.6]], [-1, 0, 0], { density: 6, spread: 0.4 });
        b.ivy([[wx0 - 0.08, 0.4, wz1 - 0.2], [wx0 - 0.08, 1.8, wz1 - 0.3], [wx0 - 0.1, 2.9, wz1 - 0.25]], [-1, 0, 0], { density: 5, spread: 0.35 });
        b.bush(wx0 + 0.2, wz1 + 0.55, 0.45, { flowers: '#f3f1ec', n: 2 });
        b.bush(wx1 - 0.2, wz1 + 0.5, 0.42, { flowers: '#efebe4', n: 2 });
        b.flowers(-5.0, 0, 4.9, 0.4, {});
        b.flowers(-8.0, 0, 4.85, 0.35, {});
      });

      b.life(function () {
        // the wounded soldier on the bench, his left arm bound in a sling
        b.figure(sx, sz, { role: 'soldier', pose: 'healer_sit', ry: sry, team: 'ink' });
        var h1 = loc(sx, sz, sry, 0.05, 0.88, 0.22), sh = loc(sx, sz, sry, -0.2, 1.02, 0.02), el = loc(sx, sz, sry, 0.27, 0.77, 0.17);
        b.beam(h1, sh, 0.05, { r2: 0.012, c: '#f3f1ec', m: M.cloth, bevel: 0 });
        b.beam(el, h1, 0.062, { c: '#f3f1ec', m: M.cloth, round: true, seg: 7 });
        // the healer in a pale linen gown, bending to bind it
        var hp = loc(sx, sz, sry, 0.6, 0, 0.36);
        b.figure(hp[0], hp[2], { role: 'villager', pose: 'healer_tend', ry: sry - 1.72, c: '#e6e1d6', hair: '#8a857c' });
        var rl = loc(hp[0], hp[2], sry - 1.72, 0.0, 0.92, 0.52); b.cyl(rl[0], rl[1] - 0.05, rl[2], 0.05, 0.1, { c: '#f3f1ec', m: M.cloth, seg: 8, rz: Math.PI / 2, ry: sry });
        // her helper kneeling at the beds
        b.figure(beds[1][0] + 0.1, 0.5, { role: 'villager', pose: 'healer_kneel', ry: 0.05, c: '#5c5e62' });
        // pegging out linen
        b.figure(6.56, 4.41, { role: 'villager', pose: 'healer_hang', ry: -2.59, c: '#6f6a62' });
        // stirring the remedy pot
        var stx = px2 + 0.62, stz = pz2 - 0.46, stry = -0.93;
        b.figure(stx, stz, { role: 'villager', pose: 'healer_stir', ry: stry, c: '#3b3a38', beard: true });
        var p1 = loc(stx, stz, stry, 0.0, 1.32, 0.38), p2 = [px2 - 0.05, 0.7, pz2 + 0.02];
        b.beam(p1, p2, 0.02, { c: 'woodLight', round: true, seg: 5 });
        // two bearers bringing a wounded man up the path on a stretcher, feet first
        var fx = 0.95, fz = 6.1, ddx = -0.13, ddz = -0.99, fry = Math.atan2(ddx, ddz), rx = fx - ddx * 2.5, rz = fz - ddz * 2.5;
        b.figure(fx, fz, { role: 'villager', pose: 'healer_bearF', ry: fry, c: '#4a4c50' });
        b.figure(rx, rz, { role: 'villager', pose: 'healer_bearB', ry: fry, c: '#7a5a46' });
        [-1, 1].forEach(function (q) {
          var a = loc(rx, rz, fry, q * 0.3, 0.84, 0.17), c = loc(fx, fz, fry, q * 0.3, 0.84, -0.03);
          b.beam(a, c, 0.03, { c: 'woodLight', round: true, seg: 6 });
        });
        var mx = fx - ddx * 1.18, mz = fz - ddz * 1.18;
        b.push(mx, 0.8, mz, fry);
        b.box(0, 0, 0, 0.58, 0.03, 1.65, { c: '#e9e5dd', m: M.cloth, bevel: 0.01 });
        b.pop();
        b.push(mx - ddx * 0.86, 0.98, mz - ddz * 0.86, fry);
        b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationY(Math.PI)).multiply(new T.Matrix4().makeRotationX(-Math.PI / 2));
        b.figure(0, 0, { role: 'villager', pose: 'healer_lie', c: '#5c5e62', hair: '#3b2a20' });
        b.box(0, 0.05, 0.1, 0.56, 0.85, 0.07, { c: 'ink', m: M.cloth, bevel: 0.02 });
        b.cyl(0, 1.64, 0.01, 0.134, 0.05, { c: '#f3f1ec', m: M.cloth, seg: 12, open: true });
        b.pop();
        // smoke from the chimney and steam off the pot
        for (var si = 0; si < 5; si++) { var st = si / 5; b.ball(chx + st * 1.0 + Math.sin(si * 1.7) * 0.1, chT + 0.62 + st * 1.9, chz - st * 0.35 + Math.cos(si * 1.3) * 0.1 * st, 0.15 + st * 0.3, { c: si < 2 ? '#d9d2c4' : '#e8e3d8', m: M.cloth, ao: 0.1, detail: 1, smooth: true, vary: 0.02 }); }
      });
      b.pop();
    }
  });
})();
