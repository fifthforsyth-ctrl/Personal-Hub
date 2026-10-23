// Quartermaster's stalls: a long open-fronted market shed on a flagged stone walk, five bays under ink and bone
// awnings (grain, rope, leather, lamp oil and salted fish), and at the sunny end the quartermaster's tally house: a
// stone ground floor with a serving hatch, a timber upper floor, and a steep slate gable with a carved dragon head
// and a hoist. In the yard: carts of sacks and barrels, a steelyard, a fish rack, racks of shields and spears waiting to
// be issued, and the quartermaster with his ledger.
// Built footings and the walk first, the tally house course by course, the shed frame, walls and counters, the upper
// floor panel by panel, both roofs row by row, then the awnings and signs, the wares, the yard, and last the people.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL;
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  PAL.stallsShingle = ['#3e3a35', '#36332f', '#45403a', '#3a3632', '#312e2b'];
  PAL.stallsLeather = ['#7a5a46', '#8b6a4e', '#6b4a33', '#9a7756', '#5a3f2b'];
  PAL.stallsFish = ['#d7d3c8', '#c9c5b9', '#bfc2bc', '#e0dccf', '#b4b8b2'];
  PAL.stallsPot = ['#8a857c', '#6f6a62', '#e6e0d2', '#3a3936', '#a39d92', '#e6e0d2'];
  PAL.stallsGrain = ['#d8c79c', '#cfbd90', '#e0d1a8'];
  PAL.stallsSack = ['#b4a384', '#a3926f', '#c4b393', '#958569', '#bcae90'];
  var INK = '#1f1e1c', BONE = '#efebe4';

  // poses: reading a ledger held open; scooping grain into a sack; hanging fish on a bar overhead; holding a coil out
  var PO = KIT.people.poses;
  PO.stallsLedger = function () { return { feet: [V(-0.13, 0.09, 0.02), V(0.13, 0.09, -0.03)], hands: [V(-0.14, 1.1, 0.33), V(0.15, 1.1, 0.33)], lean: 0.06, twist: 0, side: 0, hip: 0.02, drop: 0, head: [0.1, 0.4], pole: [V(-1, -0.5, -0.3), V(1, -0.5, -0.3)] }; };
  PO.stallsScoop = function () { return { feet: [V(-0.18, 0.09, 0.1), V(0.16, 0.09, -0.12)], hands: [V(-0.08, 0.74, 0.5), V(0.17, 0.84, 0.42)], lean: 0.42, twist: 0.1, side: 0, hip: 0, drop: 0.08, head: [0, 0.3], pole: [V(-1, -0.3, -0.3), V(1, -0.3, -0.3)] }; };
  PO.stallsReach = function () { return { feet: [V(-0.14, 0.09, 0.04), V(0.14, 0.09, -0.04)], hands: [V(-0.17, 1.84, 0.3), V(0.19, 1.8, 0.32)], lean: -0.06, twist: 0, side: 0, hip: 0, drop: 0, head: [0, -0.35], pole: [V(-1, -0.2, -0.2), V(1, -0.2, -0.2)] }; };
  PO.stallsOffer = function () { return { feet: [V(-0.14, 0.09, 0.06), V(0.13, 0.09, -0.05)], hands: [V(-0.17, 1.14, 0.4), V(0.17, 1.14, 0.4)], lean: 0.05, twist: 0, side: 0, hip: 0, drop: 0, head: [0, 0.1], pole: [V(-1, -0.5, -0.3), V(1, -0.5, -0.3)] }; };

  // a point in a figure's own frame (it faces +z, turned ry) in build space
  function fpt(x, z, ry, p) { var c = Math.cos(ry), s = Math.sin(ry); return [x + p[0] * c + p[2] * s, p[1], z - p[0] * s + p[2] * c]; }

  var HEAD = [[0, 0], [0.2, 0], [0.24, 0.16], [0.32, 0.36], [0.44, 0.52], [0.6, 0.57], [0.8, 0.6], [0.73, 0.64], [0.62, 0.665], [0.8, 0.72], [0.93, 0.76], [0.91, 0.84], [0.75, 0.87], [0.58, 0.9], [0.5, 0.97], [0.29, 1.12], [0.38, 0.92], [0.28, 0.86], [0.19, 0.93], [0.2, 0.76], [0.09, 0.71], [0.14, 0.57], [0.02, 0.47], [0.07, 0.35], [-0.03, 0.23], [0.03, 0.12]];
  // a carved dragon head: the neck rises from the origin, the snout points along local +x
  function dragonHead(b, x, y, z, s, ry, o) {
    o = o || {};
    b.push(x, y, z, ry || 0);
    if (o.rz) b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(o.rz));
    b.extrude(0, 0, 0, HEAD.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.12 * s, { c: 'woodDark', m: M.wood, bevel: 0.012 * s });
    [-1, 1].forEach(function (sd) {
      b.ball(0.6 * s, 0.8 * s, sd * 0.075 * s, 0.04 * s, { c: BONE, m: M.paint, detail: 1, ao: 0, jit: 0 });
      b.box(0.62 * s, 0.68 * s, sd * 0.07 * s, 0.28 * s, 0.03 * s, 0.02 * s, { c: INK, m: M.wood, bevel: 0, ao: 0, rz: 0.15 });
    });
    b.pop();
  }

  // ---------------------------------------------------------------- wares
  // an open sack, its mouth rolled down round a heap of grain
  function openSack(b, x, y, z, s) {
    b.lathe(x, y, z, [[0.01, 0], [0.34 * s, 0], [0.45 * s, 0.14 * s], [0.47 * s, 0.42 * s], [0.42 * s, 0.68 * s], [0.38 * s, 0.76 * s], [0.01, 0.76 * s]], { c: 'canvasDusty', m: M.cloth, seg: 12, ao: 0.4 });
    b.addGeo(new T.TorusGeometry(0.385 * s, 0.075 * s, 5, 14), { x: x, y: y + 0.74 * s, z: z, rx: Math.PI / 2, c: 'canvas', m: M.cloth, ao: 0.1 });
    b.ball(x, y + 0.75 * s, z, 0.36 * s, { c: 'stallsGrain', m: M.straw, sy: 0.42, detail: 1, ao: 0 });
  }
  // a wooden measure, banded, heaped with grain (or empty)
  function tub(b, x, y, z, r, h, fill) {
    b.lathe(x, y, z, [[0.01, 0], [r * 0.86, 0], [r, h], [r * 0.9, h], [r * 0.78, h * 0.15], [0.01, h * 0.15]], { c: 'wood', m: M.wood, seg: 12 });
    b.cyl(x, y + h * 0.72, z, r * 0.97, 0.035, { c: 'iron', m: M.metal, seg: 12, open: true });
    if (fill) b.ball(x, y + h * 0.88, z, r * 0.86, { c: fill, m: M.straw, sy: 0.38, detail: 1, ao: 0 });
  }
  // a stoppered jar of lamp oil, glazed, with an ink band at the shoulder
  function jar(b, x, y, z, s, c, band) {
    c = c || b.pick(PAL.stallsPot);
    b.lathe(x, y, z, [[0.01, 0], [0.1 * s, 0], [0.2 * s, 0.1 * s], [0.25 * s, 0.32 * s], [0.22 * s, 0.5 * s], [0.12 * s, 0.62 * s], [0.08 * s, 0.68 * s], [0.1 * s, 0.74 * s], [0.01, 0.74 * s]], { c: c, m: M.stone, seg: 14, vary: 0.04 });
    b.cyl(x, y + 0.735 * s, z, 0.065 * s, 0.05 * s, { c: 'woodLight', m: M.wood, seg: 8 });
    if (band) b.cyl(x, y + 0.42 * s, z, 0.238 * s, 0.035 * s, { c: band, m: M.paint, seg: 14, open: true });
  }
  // a little clay oil lamp, spout along +x
  function lamp(b, x, y, z, ry) {
    b.push(x, y, z, ry || 0);
    b.lathe(0, 0, 0, [[0.01, 0], [0.06, 0], [0.085, 0.025], [0.06, 0.05], [0.02, 0.05], [0.01, 0.04]], { c: b.pick(['#8a857c', '#a39d92', '#6f6a62']), m: M.stone, seg: 10 });
    b.box(0.09, 0.012, 0, 0.07, 0.028, 0.035, { c: '#8a857c', m: M.stone, bevel: 0.008 });
    b.pop();
  }
  var FISH = [[-0.5, 0], [-0.38, 0.1], [-0.12, 0.16], [0.18, 0.13], [0.36, 0.05], [0.42, 0.11], [0.5, 0.15], [0.47, 0], [0.5, -0.15], [0.42, -0.11], [0.36, -0.05], [0.18, -0.12], [-0.12, -0.14], [-0.38, -0.09]];
  // a salted fish, head along -x, tail along +x; o.rz and o.ry turn it
  function fish(b, x, y, z, s, o) {
    o = o || {};
    b.extrude(x, y, z, FISH.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.05 * s, { rz: o.rz || 0, ry: o.ry || 0, rx: o.rx || 0, c: o.c || b.pick(PAL.stallsFish), m: M.paint, bevel: 0.01 * s, ao: 0.1 });
  }
  var HIDE = [[-0.5, 0.42], [-0.3, 0.5], [0, 0.46], [0.3, 0.5], [0.5, 0.42], [0.62, 0.55], [0.58, 0.3], [0.48, 0.1], [0.5, -0.3], [0.62, -0.5], [0.4, -0.45], [0.2, -0.52], [-0.2, -0.52], [-0.4, -0.45], [-0.62, -0.5], [-0.5, -0.3], [-0.48, 0.1], [-0.58, 0.3], [-0.62, 0.55]];
  // a tanned hide w x h, its centre at (x, y, z), facing +z (turn with ry)
  function hide(b, x, y, z, w, h, o) {
    o = o || {};
    b.extrude(x, y, z, HIDE.map(function (p) { return [p[0] * w, p[1] * h]; }), 0.025, { ry: o.ry || 0, rx: o.rx || 0, c: o.c || b.pick(PAL.stallsLeather), m: M.cloth, bevel: 0.006, ao: 0.15 });
  }
  // a coil of rope hung on a peg, upright, facing +z (turn with ry)
  function hungCoil(b, x, y, z, r, ry) {
    b.addGeo(new T.TorusGeometry(r, 0.045, 5, 16), { x: x, y: y, z: z, ry: ry || 0, sy: 1.15, c: 'rope', m: M.rope });
    b.addGeo(new T.TorusGeometry(r * 0.82, 0.04, 5, 14), { x: x, y: y - r * 0.12, z: z + 0.03, ry: ry || 0, sy: 1.1, c: 'rope', m: M.rope });
  }
  // a stack of rope coils lying flat
  function sk(b, x, y, z, s) { b.sack(x, y, z, s, { c: b.pick(PAL.stallsSack) }); }
  function coilStack(b, x, y, z, r, n) { for (var i = 0; i < n; i++) b.addGeo(new T.TorusGeometry(r * (1 - i * 0.04), 0.055, 5, 16), { x: x + b.j(0.02), y: y + 0.055 + i * 0.1, z: z + b.j(0.02), rx: Math.PI / 2, c: 'rope', m: M.rope }); b.cyl(x, y, z, r * 0.7, n * 0.1, { c: 'rope', m: M.rope, seg: 12 }); }

  // A sloping awning like the kit's, but wound so its top faces up (the double-sided cloth then lights from above):
  // (x, y, z) the high edge's centre, w wide, reaching out d along +z and dropping dy; a scalloped front edge.
  function awning(b, x, y, z, w, d, dy, o) {
    o = o || {};
    b.push(x, y, z, o.ry || 0);
    var stripes = o.stripes, ns = o.n || 6;
    var g = new T.PlaneGeometry(1, 1, stripes ? ns * 2 : 6, 4).toNonIndexed(), p = g.attributes.position, sway = [], cols = [];
    for (var i = 0; i < p.count; i++) { var u = p.getX(i) + 0.5, v = p.getY(i) + 0.5, sag = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.07 + Math.sin(u * Math.PI * ns) * 0.025 * v; p.setXYZ(i, (0.5 - u) * w, -dy * v - sag, d * v); sway.push(v * 0.4); }
    if (stripes) for (var t3 = 0; t3 < p.count; t3 += 3) {
      var uc = 0.5 - (p.getX(t3) + p.getX(t3 + 1) + p.getX(t3 + 2)) / 3 / w, sc0 = new T.Color(stripes[Math.min(ns - 1, Math.floor(uc * ns)) % 2]).convertSRGBToLinear();
      for (var q3 = 0; q3 < 3; q3++) cols.push(sc0.r, sc0.g, sc0.b);
    }
    g.setAttribute('sway', new T.Float32BufferAttribute(sway, 1)); g.computeVertexNormals();
    if (stripes) g.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    b.addGeo(g, { c: stripes ? '#ffffff' : (o.c || 'canvas'), jit: stripes ? 0 : undefined, m: M.cloth, bucket: 'cloth', sway: 1, ao: 0.1 });
    var sc = Math.max(3, Math.round(w / 0.5));
    for (var k = 0; k < sc; k++) {
      var gx = new T.PlaneGeometry(w / sc, 0.22, 2, 1), pp = gx.attributes.position;
      for (var t = 0; t < pp.count; t++) { var lx2 = pp.getX(t), ly2 = pp.getY(t); if (ly2 < 0) pp.setY(t, ly2 * (1 - Math.abs(lx2) / (w / sc / 2))); }
      gx.computeVertexNormals();
      b.addGeo(gx, { x: -w / 2 + (k + 0.5) * w / sc, y: -dy - 0.11, z: d, c: o.trim || (stripes ? stripes[k % 2] : INK), m: M.cloth, bucket: 'cloth', ao: 0 });
    }
    b.pop();
  }

  // A slatted louvre astride a ridge running along x at height yR (the roof falling away at angle slope either side),
  // centred at (x, z): corner posts round a dark core, angled slats, and a little slate cap with boarded gables.
  function louvre(b, x, yR, z, slope) {
    var w = 1.0, d = 0.82, h = 0.62, y0 = yR - 0.62, lowZ = yR - (d / 2) * Math.tan(slope) + 0.12;
    b.push(x, 0, z, 0);
    b.box(0, y0, 0, w - 0.12, yR + h - y0 - 0.02, d - 0.12, { c: '#1c1b1a', m: M.dark, bevel: 0, ao: 0 });
    [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) { b.box(sx * (w / 2 - 0.05), y0, sz * (d / 2 - 0.05), 0.09, yR + h - y0, 0.09, { c: 'beam', m: M.wood, bevel: 0.012 }); }); });
    for (var yy = lowZ + 0.02; yy < yR + h - 0.08; yy += 0.12) {
      [-1, 1].forEach(function (sz) { b.box(0, yy, sz * (d / 2 - 0.04), w - 0.16, 0.05, 0.035, { c: 'woodDark', m: M.wood, bevel: 0.005, rx: sz * 0.55 }); });
      if (yy > yR + 0.24) [-1, 1].forEach(function (sx) { b.box(sx * (w / 2 - 0.04), yy, 0, 0.035, 0.05, d - 0.16, { c: 'woodDark', m: M.wood, bevel: 0.005, rz: -sx * 0.55 }); });
    }
    b.box(0, yR + h - 0.06, 0, w + 0.04, 0.08, d + 0.04, { c: 'beam', m: M.wood, bevel: 0.015 });
    b.push(0, yR + h + 0.02, 0, 0);
    [-1, 1].forEach(function (sx) { b.gableEnd(sx * (w / 2 - 0.02), 0, 0, d, 0.4, 0.06, { c: 'woodDark', m: M.wood }); });
    b.gableRoof(0, 0, 0, w + 0.04, d + 0.04, 0.44, { m: 'slate', over: 0.16, rows: 2, rowsAsUnits: false, overX: 0.1 });
    b.pop();
    b.pop();
  }

  // ---------------------------------------------------------------- sign pictograms, bone on ink, drawn on both faces
  function icon(b, kind, x, y, z, s) {
    var shapes = [];
    if (kind === 'grain') {
      [-0.42, 0, 0.42].forEach(function (a) {
        shapes.push({ pts: [[-0.018, -0.34], [0.018, -0.34], [0.018, 0.12], [-0.018, 0.12]], rz: a, oy: 0 });
        shapes.push({ pts: [[0, 0.08], [0.06, 0.18], [0.05, 0.36], [0, 0.44], [-0.05, 0.36], [-0.06, 0.18]], rz: a, oy: 0 });
      });
      shapes.push({ pts: [[-0.12, -0.08], [0.12, -0.08], [0.12, -0.02], [-0.12, -0.02]], rz: 0, oy: 0 });
    } else if (kind === 'rope') {
      // a coil: a band wound in a spiral of two and a half turns, its end trailing off
      var outer = [], inner = [];
      for (var i = 0; i <= 40; i++) { var t = i / 40 * Math.PI * 5, r = 0.07 + 0.05 * t / Math.PI; outer.push([Math.cos(t) * (r + 0.028), Math.sin(t) * (r + 0.028)]); inner.unshift([Math.cos(t) * (r - 0.028), Math.sin(t) * (r - 0.028)]); }
      shapes.push({ pts: outer.concat(inner), rz: 0, oy: 0 });
    } else if (kind === 'hide') {
      shapes.push({ pts: HIDE.map(function (p) { return [p[0] * 0.62, p[1] * 0.72]; }), rz: 0, oy: 0 });
    } else if (kind === 'oil') {
      shapes.push({ pts: [[-0.36, -0.1], [-0.22, -0.2], [0.12, -0.2], [0.3, -0.08], [0.42, -0.06], [0.4, 0.0], [0.22, 0.02], [0.06, 0.06], [-0.2, 0.06], [-0.34, 0.02]], rz: 0, oy: -0.08 });
      shapes.push({ pts: [[0.38, 0.06], [0.44, 0.14], [0.44, 0.26], [0.39, 0.4], [0.35, 0.24], [0.34, 0.14]], rz: 0, oy: -0.08 });
    } else if (kind === 'fish') {
      shapes.push({ pts: FISH.map(function (p) { return [p[0] * 0.8, p[1] * 1.15]; }), rz: 0, oy: 0 });
    }
    shapes.forEach(function (sh) {
      var pts = sh.pts.map(function (p) { return [p[0] * s, (p[1] + sh.oy) * s]; });
      var holes = sh.holes ? sh.holes.map(function (h) { return h.map(function (p) { return [p[0] * s, (p[1] + sh.oy) * s]; }); }) : undefined;
      [0.03, -0.03].forEach(function (dz) { b.extrude(x, y, z + dz, pts, 0.008, { rz: sh.rz, c: BONE, m: M.paint, ao: 0, jit: 0.01, holes: holes }); });
    });
  }

  KIT.defineBuild('stalls', {
    name: "Quartermaster's stalls", size: 'middle', need: 30,
    line: "A row of awninged stalls of grain, rope, leather, lamp oil and salted fish, with carts, sacks, racks of shields and spears to issue, and the quartermaster at his tally house.",
    r: 13, flat: [17.6, 12.4], ground: 'cobble', path: [[1.2, 13.5], [0.9, 6.4]],
    frameY: 1.9, frameR: 11.2, glowAt: [5.45, 9.4, -0.3],
    trees: [{ x: -9.6, z: -4.6, kind: 'pine', h: 7.0 }, { x: 10.5, z: 1.0, kind: 'pine', h: 6.4 }, { x: -4.6, z: -7.2, kind: 'round', h: 5.0 }],
    bushes: [{ x: 9.4, z: 4.6, r: 0.85, flowers: '#f3f1ec' }, { x: -7.6, z: 7.4, r: 0.8 }, { x: -10.4, z: 1.6, r: 0.75, flowers: '#f3f1ec' }, { x: 9.6, z: -2.2, r: 0.8, flowers: '#f3f1ec' }, { x: 8.6, z: -5.6, r: 0.9 }, { x: -3.6, z: 7.6, r: 0.6 }],
    perches: [{ x: 5.45, y: 9.0, z: -0.3, ry: Math.PI / 2 }, { x: -2.05, y: 5.2, z: -2.4, ry: 0 }],
    build: function (b) {
      var OX = 0.2, OZ = 0.7;
      b.push(OX, 0, OZ, 0);
      // the storehouse behind the stalls: five bays of 1.9 m, x -7..2.5, its front wall at zw
      var NB = 5, bw = 1.9, x0 = -7.0, x1 = x0 + NB * bw, zb = -4.6, zw = -1.6, fy = 0.18, pT = fy + 0.5, eave = 3.3, rise = 1.8;
      var W = x1 - x0, D = zw - zb, cx = (x0 + x1) / 2, cz = (zb + zw) / 2;
      var bx = function (i) { return x0 + bw * (i + 0.5); };
      var postX = function (i) { return i === 0 ? x0 + 0.12 : i === NB ? x1 - 0.12 : x0 + i * bw; };
      // the awnings: from a rail on the wall at aY, out aD and down aDy to poles at the front; counters just inside
      var aY = 2.45, az0 = zw + 0.06, aD = 1.95, aDy = 0.55, azF = az0 + aD, ayF = aY - aDy, cF = azF + 0.1, ct = fy + 0.9, zE = azF + 0.85;
      // the tally house
      var tx = 5.25, tz = -1.15, TW = 2.9, tb = 0.3, H1 = 2.97, jet = 0.3;
      var tX0 = tx - TW / 2, tX1 = tx + TW / 2, tZ0 = tz - TW / 2, tZ1 = tz + TW / 2, top1 = tb + H1;
      var u0 = top1 + 0.22, H2 = 2.5, eave2 = u0 + H2, rise2 = 2.9, tZF = tZ1 + jet;

      b.part('Footings and the stone walk');
      b.unit(function () {
        b.box(cx, -0.1, (zb - 0.4 + zE) / 2, W + 0.9, 0.18, zE - zb + 0.4, { c: 'stoneDark', bevel: 0.05 });
        b.box(tx, -0.1, tz + 0.1, TW + 0.8, 0.4, TW + 1.0, { c: 'stoneDark', bevel: 0.08 });
        // kerb stones along the front and the left end of the walk
        var t = x0 - 0.45; while (t < x1 + 0.4) { var L = Math.min(x1 + 0.45 - t, 0.7 + b.r() * 0.4); b.box(t + L / 2, -0.12, zE - 0.12, L - 0.04, 0.3, 0.3, { c: b.stoneC('stone'), m: M.stone, bevel: 0.05, ry: b.j(0.01) }); t += L; }
        var s = zb - 0.4; while (s < zE - 0.3) { var L2 = Math.min(zE - 0.27 - s, 0.7 + b.r() * 0.4); b.box(x0 - 0.33, -0.12, s + L2 / 2, 0.3, 0.3, L2 - 0.04, { c: b.stoneC('stone'), m: M.stone, bevel: 0.05 }); s += L2; }
      });
      // flagstones laid one by one, the front of the walk first
      [[zw - 0.2, zE - 0.27], [zb - 0.35, zw - 0.2]].forEach(function (rg, k) {
        b.unit(function () {
          var fz = rg[0], row = 0;
          while (fz < rg[1] - 0.05) {
            var fd = Math.min(rg[1] - fz, 0.42 + b.r() * 0.22), fx = x0 - 0.18 + (row % 2) * 0.22;
            while (fx < x1 + 0.41) { var fw = Math.min(x1 + 0.42 - fx, 0.5 + b.r() * 0.35); if (fw > 0.12) b.box(fx + fw / 2, 0.07, fz + fd / 2, fw - 0.05, 0.11 + b.j(0.01), fd - 0.05, { c: b.stoneC(k ? 'stoneDark' : 'stoneCool'), m: M.stone, bevel: 0.03, ry: b.j(0.015), ao: 0.1 }); fx += fw; }
            fz += fd; row++;
          }
        });
      });

      b.part('Storehouse plinth');
      b.stoneBox(cx, cz, W, D, fy, 0.5, 0.45, { pal: 'stone', course: 0.25, len: 0.6 });

      b.part('Tally house, stone floor');
      b.stoneBox(tx, tz, TW, TW, tb, H1, 0.5, {
        pal: 'stone', course: 0.37, len: 0.68,
        holes: [
          { side: 'front', at: 0.35, w: 1.2, y0: tb + 0.75, y1: tb + 1.8 },
          { side: 'left', at: 0.2, w: 1.0, y1: tb + 2.0 },
          { side: 'right', at: 0.0, w: 0.5, y0: tb + 1.1, y1: tb + 1.8 }
        ]
      });

      b.part('Door and serving hatch');
      b.unit(function () {
        b.archDoor(tX0 + 0.02, tb, tz + 0.2, 1.0, 1.84, { ry: -Math.PI / 2, depth: 0.55, timber: true, doorC: 'woodDark', arch: 0.001 });
        b.box(tX1 - 0.02, tb + 1.1, tz, 0.1, 0.7, 0.45, { c: '#1c1b1a', m: M.dark, bevel: 0, ao: 0 });
      });
      b.unit(function () {
        // the hatch: a dark opening lined with timber, a counter board on brackets, and a shutter propped open above
        var hx = tx + 0.35, hy0 = 1.043, hy1 = 2.157, fz = tZ1;
        b.box(hx, hy0, fz - 0.32, 1.2, hy1 - hy0, 0.1, { c: '#1f1d1b', m: M.dark, bevel: 0, ao: 0 });
        [-1, 1].forEach(function (sd) { b.box(hx + sd * 0.55, hy0, fz - 0.2, 0.1, hy1 - hy0, 0.5, { c: 'beam', m: M.wood, bevel: 0.02 }); });
        b.box(hx, hy1 - 0.14, fz - 0.2, 1.2, 0.14, 0.5, { c: 'beam', m: M.wood, bevel: 0.02 });
        b.box(hx, hy0 - 0.08, fz + 0.04, 1.5, 0.09, 0.62, { c: 'woodLight', m: M.wood, bevel: 0.02 });
        [-0.55, 0.55].forEach(function (dx) { b.beam([hx + dx, hy0 - 0.5, fz + 0.03], [hx + dx, hy0 - 0.08, fz + 0.3], 0.04, { c: 'beam' }); });
        b.push(hx, hy1, fz + 0.04, 0);
        b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(-(Math.PI / 2 + 0.22)));
        for (var p = 0; p < 5; p++) b.box(-0.52 + p * 0.26, -1.0, 0, 0.25, 1.0, 0.05, { c: p % 2 ? INK : '#2a2826', m: M.paint, bevel: 0.01 });
        [-0.3, -0.75].forEach(function (y) { b.box(0, y, 0.04, 1.28, 0.06, 0.03, { c: 'iron', m: M.metal, bevel: 0 }); });
        b.pop();
        b.beam([hx - 0.62, hy0, fz + 0.25], [hx - 0.62, hy1 + 0.2, fz + 0.95], 0.025, { c: 'woodLight', round: true });
      });

      b.part('Storehouse frame');
      b.unit(function () {
        // carved posts along the front, a sill on the plinth, and the top plate
        for (var i = 0; i <= NB; i++) {
          var px = postX(i), pz = zw - 0.12;
          b.post(px, pT, pz, 0.12, eave - pT, { c: 'beam' });
          [0.3, 0.37].forEach(function (f) { b.box(px, pT + (eave - pT) * f, pz, 0.29, 0.07, 0.29, { c: 'woodDark', m: M.wood, bevel: 0.015 }); });
          b.box(px, eave - 0.5, pz, 0.32, 0.22, 0.32, { c: 'woodDark', m: M.wood, bevel: 0.03, taper: 1.25 });
        }
        b.beam([x0 + 0.12, pT + 0.1, zw - 0.12], [x1 - 0.12, pT + 0.1, zw - 0.12], 0.1, { c: 'beam' });
        b.beam([x0 - 0.15, eave - 0.12, zw - 0.12], [x1 + 0.15, eave - 0.12, zw - 0.12], 0.12, { c: 'beam' });
        b.beam([x0 - 0.15, eave - 0.12, zb + 0.12], [x1 + 0.15, eave - 0.12, zb + 0.12], 0.12, { c: 'beam' });
      });
      b.unit(function () {
        // knee braces, and the rails the awnings hang from
        for (var i = 0; i <= NB; i++) {
          var px = postX(i);
          [-1, 1].forEach(function (sd) { if ((i === 0 && sd < 0) || (i === NB && sd > 0)) return; b.beam([px + sd * 0.12, eave - 0.9, zw - 0.12], [px + sd * 0.6, eave - 0.2, zw - 0.12], 0.06, { c: 'beam' }); });
        }
        for (var k = 0; k < NB; k++) b.beam([postX(k) + 0.14, aY + 0.02, zw + 0.03], [postX(k + 1) - 0.14, aY + 0.02, zw + 0.03], 0.03, { c: 'iron', m: M.metal, round: true });
      });

      b.part('Storehouse walls');
      for (var wi = 0; wi < NB; wi++) {
        (function (i) {
          b.unit(function () {
            var a = postX(i) + 0.12, c = postX(i + 1) - 0.12;
            b.planks((a + c) / 2, pT + 0.2, zw - 0.14, c - a, eave - 0.24 - pT - 0.2, { vertical: true, c: i % 2 ? 'wood' : '#6f5e4c', pw: 0.26 });
          });
        })(wi);
      }
      b.timberWall(x0 + 0.12, zb + 0.1, x0 + 0.12, zw - 0.26, pT, { h: eave - pT, post: 0.95, windows: [{ t: 1.45, w: 0.62, y0: 0.95, y1: 1.8, shutters: INK, flowers: '#f3f1ec' }] });
      b.unit(function () {
        b.planks(cx, pT, zb + 0.14, W - 0.3, eave - pT - 0.1, { vertical: true, c: 'woodDark', pw: 0.34 });
        b.planks(x1 - 0.14, pT, cz, D - 0.4, eave - pT - 0.1, { vertical: true, c: 'woodDark', pw: 0.34, ry: Math.PI / 2 });
      });

      b.part('Counters');
      for (var ci = 0; ci < NB; ci++) {
        (function (i) {
          b.unit(function () {
            var x = bx(i), cw = bw - 0.34;
            b.planks(x, fy, cF - 0.04, cw, 0.82, { vertical: true, c: i % 2 ? 'wood' : 'woodLight', pw: 0.24 });
            b.box(x, fy + 0.82, cF - 0.27, cw + 0.1, 0.08, 0.68, { c: 'woodLight', m: M.wood, bevel: 0.02 });
            [-1, 1].forEach(function (sd) { b.box(x + sd * (cw / 2 - 0.03), fy, cF - 0.33, 0.06, 0.82, 0.58, { c: 'wood', m: M.wood, bevel: 0.01 }); });
            for (var z = 0; z < 7; z++) b.box(x - cw / 2 + 0.14 + z * (cw - 0.28) / 6, fy + 0.62, cF + 0.01, 0.09, 0.09, 0.03, { c: INK, m: M.paint, rz: Math.PI / 4, bevel: 0.005, ao: 0 });
          });
        })(ci);
      }

      b.part('Tally house, upper floor');
      b.unit(function () {
        for (var i = 0; i <= 8; i++) { var x = tX0 + 0.2 + i * (TW - 0.4) / 8; b.box(x, top1, tZ1 - 0.55, 0.18, 0.22, 0.95, { c: 'beam', m: M.wood, bevel: 0.03 }); }
        [tX0 + 0.45, tX1 - 0.45].forEach(function (x) { b.beam([x, top1 - 0.6, tZ1 + 0.02], [x, top1 + 0.02, tZ1 + jet + 0.04], 0.07, { c: 'beam' }); });
        b.box(tx, u0 - 0.12, tz + jet / 2, TW + 0.14, 0.12, TW + jet + 0.08, { c: 'beam', m: M.wood, bevel: 0.02 });
      });
      b.timberWall(tX0, tZF, tX1, tZF, u0, { h: H2, post: 0.97, windows: [{ t: 1.45, w: 0.62, y0: 0.8, y1: 1.8, shutters: INK, flowers: '#f3f1ec' }] });
      b.timberWall(tX0, tZ0 + 0.1, tX0, tZF - 0.1, u0, { h: H2, post: 1.0, windows: [{ t: 1.55, w: 0.6, y0: 0.85, y1: 1.8, shutters: INK, flowers: '#e6e3dc' }] });
      b.unit(function () { b.timberWall(tX1, tZF - 0.1, tX1, tZ0 + 0.1, u0, { h: H2, post: 1.0, windows: [{ t: 1.5, w: 0.6, y0: 0.85, y1: 1.8, shutters: INK }] }); b.timberWall(tX1, tZ0, tX0, tZ0, u0, { h: H2, post: 0.97 }); });

      b.part('Storehouse roof');
      var over = 0.25, overX = 0.4, slope = Math.atan2(rise, D / 2), dropY = -over * Math.tan(slope);
      b.unit(function () {
        // the gable ends: dark boards with battens
        [x0 + 0.12, x1 - 0.12].forEach(function (x, k) {
          b.gableEnd(x, eave, cz, D - 0.1, rise - 0.12, 0.14, { c: 'woodDark', m: M.wood });
          var sx = k ? 1 : -1;
          for (var z = cz - D / 2 + 0.25; z < cz + D / 2 - 0.15; z += 0.3) { var hh = (rise - 0.12) * (1 - Math.abs(z - cz) / (D / 2)) - 0.08; if (hh > 0.1) b.box(x + sx * 0.09, eave, z, 0.05, hh, 0.08, { c: 'beam', m: M.wood, bevel: 0.01 }); }
        });
      });
      b.gableRoof(cx, eave, cz, W, D, rise, { m: 'slate', over: over, overX: overX, rows: 6, pitch: 0.34 });
      b.unit(function () {
        // two louvres on the ridge to air the stores, slatted, each under its own little slate roof
        [bx(1), bx(3)].forEach(function (lx) { louvre(b, lx, eave + rise, cz, slope); });
      });
      b.unit(function () {
        // crossed bargeboards and a carved dragon head at each ridge end
        [[x0 - overX + 0.05, Math.PI, 1.0], [x1 + overX - 0.05, 0, 0.6]].forEach(function (g) {
          var x = g[0], half = D / 2 + over;
          [-1, 1].forEach(function (sd) { b.beam([x, eave + dropY - 0.1, cz + sd * half], [x, eave + rise + 0.12, cz - sd * 0.18], 0.035, { r2: 0.13, c: 'woodDark' }); });
          dragonHead(b, x, eave + rise + 0.02, cz, g[2], g[1], { rz: -0.1 });
        });
      });

      b.part('Tally house roof');
      var over2 = 0.45, overX2 = 0.4, slope2 = Math.atan2(rise2, TW / 2), drop2 = -over2 * Math.tan(slope2), rzc = tz + jet / 2;
      b.unit(function () {
        [tZF, tZ0].forEach(function (z, k) {
          var sz = k ? -1 : 1;
          b.extrude(tx, eave2, z - sz * 0.02, [[-TW / 2 + 0.05, 0], [TW / 2 - 0.05, 0], [0, rise2 - 0.1]], 0.14, { c: 'woodDark', m: M.wood });
          for (var x = tx - TW / 2 + 0.2; x < tx + TW / 2 - 0.1; x += 0.28) {
            var hh = (rise2 - 0.1) * (1 - Math.abs(x - tx) / (TW / 2)) - 0.08, y0 = (!k && Math.abs(x - tx) < 0.5) ? 1.25 : 0;
            if (hh - y0 > 0.1) b.box(x, eave2 + y0, z + sz * 0.07, 0.08, hh - y0, 0.05, { c: 'beam', m: M.wood, bevel: 0.01 });
          }
        });
        // a loft door in the front gable under the hoist
        b.box(tx, eave2 + 0.2, tZF + 0.08, 0.7, 0.95, 0.06, { c: '#2b2420', m: M.dark, bevel: 0, ao: 0 });
        [-0.4, 0.4].forEach(function (dx) { b.box(tx + dx, eave2 + 0.15, tZF + 0.1, 0.1, 1.05, 0.08, { c: 'beam', m: M.wood }); });
        b.box(tx, eave2 + 1.15, tZF + 0.1, 0.92, 0.1, 0.1, { c: 'beam', m: M.wood });
      });
      b.gableRoof(tx, eave2, rzc, TW + jet, TW, rise2, { ry: Math.PI / 2, m: 'slate', over: over2, overX: overX2, rows: 7 });
      b.unit(function () {
        [[tZF + overX2 - 0.05, -Math.PI / 2, 1.2], [tZ0 - overX2 + 0.05, Math.PI / 2, 0.9]].forEach(function (g) {
          var z = g[0], half = TW / 2 + over2;
          [-1, 1].forEach(function (sd) { b.beam([tx + sd * half, eave2 + drop2 - 0.1, z], [tx - sd * 0.18, eave2 + rise2 + 0.12, z], 0.13, { r2: 0.035, c: 'woodDark' }); });
          dragonHead(b, tx, eave2 + rise2 + 0.02, z, g[2], g[1], { rz: -0.1 });
        });
      });
      b.unit(function () {
        // the hoist: a beam out of the gable, a pulley block, and the rope tied off to a cleat
        var hy = eave2 + 1.35, z0 = tZF, z1 = tZF + 1.25;
        b.beam([tx, hy, z0 - 0.3], [tx, hy, z1], 0.09, { c: 'beam' });
        b.beam([tx, hy - 0.75, z0 + 0.1], [tx, hy - 0.05, z1 - 0.45], 0.06, { c: 'beam' });
        b.box(tx, hy - 0.42, z1 - 0.12, 0.12, 0.3, 0.16, { c: 'woodDark', m: M.wood, bevel: 0.02 });
        b.cyl(tx, hy - 0.27, z1 - 0.12, 0.1, 0.06, { c: 'iron', m: M.metal, seg: 10, rz: Math.PI / 2 });
        b.beam([tx, hy - 0.42, z1 - 0.06], [tx, 3.05, z1 - 0.06], 0.014, { c: 'rope', m: M.rope, round: true, seg: 4 });
        b.addGeo(new T.TorusGeometry(0.07, 0.018, 4, 10), { x: tx, y: 2.98, z: z1 - 0.06, c: 'iron', m: M.metal });
        b.beam([tx, hy - 0.42, z1 - 0.18], [tX0 + 0.35, top1 + 0.05, tZ1 + 0.06], 0.014, { c: 'rope', m: M.rope, round: true, seg: 4 });
        b.box(tX0 + 0.35, top1 - 0.08, tZ1 + 0.06, 0.08, 0.2, 0.06, { c: 'iron', m: M.metal, bevel: 0.01 });
      });
      b.unit(function () { b.flag(tx, eave2 + rise2 - 0.55, tz - 1.0, 1.7, 0.95, 0.4, { c: 'ember', pennant: true, ry: -0.5 }); });

      b.part('Awnings');
      var awn = [{ stripes: [INK, BONE], n: 6 }, { stripes: [BONE, INK], n: 3 }, { stripes: [BONE, INK], n: 8 }, { stripes: [BONE, INK], n: 3 }, { stripes: [INK, BONE], n: 6 }];
      b.unit(function () {
        // poles shared by neighbouring awnings, with a front rail
        for (var i = 0; i <= NB; i++) {
          var px = x0 + i * bw;
          b.post(px, fy, azF, 0.055, ayF - fy + 0.08, { c: 'woodDark' });
          b.ball(px, ayF + 0.1, azF, 0.075, { c: 'woodDark', m: M.wood, detail: 1 });
        }
        b.beam([x0, ayF, azF], [x1, ayF, azF], 0.03, { c: 'woodDark', round: true });
      });
      awn.forEach(function (a, i) { b.unit(function () { awning(b, bx(i), aY, az0, bw - 0.06, aD, aDy, { stripes: a.stripes, n: a.n, c: a.c, trim: a.trim }); }); });

      b.part('Signboards and shields');
      b.unit(function () {
        ['fish', 'rope', 'hide', 'oil', 'grain'].forEach(function (k, i) {
          var x = bx(i) + (i % 2 ? 0.2 : -0.2), y = ayF + 0.04, z = azF + 0.05;
          [-0.26, 0.26].forEach(function (dx) { b.box(x + dx, y - 0.05, z, 0.04, 0.16, 0.04, { c: 'iron', m: M.metal, bevel: 0 }); });
          b.box(x, y + 0.08, z, 0.88, 0.54, 0.05, { c: INK, m: M.paint, bevel: 0.015 });
          b.box(x, y + 0.6, z, 0.94, 0.05, 0.07, { c: 'woodDark', m: M.wood, bevel: 0.01 });
          icon(b, k, x, y + 0.35, z, 0.52);
        });
      });
      b.unit(function () {
        // round shields hung on the posts above the awnings
        var cols = ['ink', 'bone', 'inkGrey', 'bone', 'ink', 'bone'];
        for (var i = 0; i <= NB; i++) b.shield(postX(i), 2.86, zw + 0.06, { kind: 'round', c: cols[i], s: 0.58, emblem: 'none' });
      });

      b.part('Salt-fish stall');
      b.unit(function () {
        var x = bx(0);
        // fish laid head to tail in open boxes of salt
        [[-0.4, -0.25], [0.22, -0.3]].forEach(function (p) {
          var fx = x + p[0], fz = cF + p[1];
          b.box(fx, ct, fz, 0.6, 0.04, 0.5, { c: 'wood', m: M.wood, bevel: 0.01 });
          [-1, 1].forEach(function (sd) { b.box(fx, ct, fz + sd * 0.23, 0.6, 0.16, 0.04, { c: 'woodLight', m: M.wood, bevel: 0.008 }); b.box(fx + sd * 0.28, ct, fz, 0.04, 0.16, 0.5, { c: 'woodLight', m: M.wood, bevel: 0.008 }); });
          b.box(fx, ct + 0.04, fz, 0.52, 0.06, 0.42, { c: BONE, m: M.plaster, bevel: 0.02, ao: 0 });
          for (var k = 0; k < 4; k++) fish(b, fx + (k % 2 ? 0.02 : -0.02), ct + 0.11, fz - 0.15 + k * 0.1, 0.42, { rx: -Math.PI / 2, ry: k % 2 ? Math.PI : 0 });
        });
        tub(b, x + 0.62, ct, cF - 0.3, 0.14, 0.18, BONE);
        [[-0.5, 0.72], [0.15, 0.68]].forEach(function (p) { b.barrel(x + p[0], fy, cF + p[1], { h: 0.8, r: 0.28 }); b.ball(x + p[0], fy + 0.8, cF + p[1], 0.22, { c: BONE, m: M.plaster, sy: 0.4, detail: 1, ao: 0 }); });
        b.crate(x + 0.62, fy, cF + 0.55, 0.5, { ry: 0.2 });
      });
      b.unit(function () {
        // a drying rack at the end of the walk: two trestles, two bars, fish hung by the tail in pairs
        var rxx = x0 - 1.15, rz0 = zw - 0.2, rz1 = zw + 1.6;
        [rz0, rz1].forEach(function (z) { [-1, 1].forEach(function (sd) { b.beam([rxx + sd * 0.5, 0, z], [rxx, 2.15, z], 0.04, { c: 'wood', round: true }); }); });
        [2.0, 1.45].forEach(function (y, row) {
          var xx = rxx + (row ? 0.12 : 0);
          b.beam([xx, y, rz0 - 0.12], [xx, y, rz1 + 0.12], 0.03, { c: 'woodLight', round: true });
          for (var k = 0; k < 7; k++) {
            var fz = rz0 + 0.18 + k * (rz1 - rz0 - 0.36) / 6 + (row ? 0.1 : 0);
            if (row === 0 && k > 4) continue;
            [-1, 1].forEach(function (sd) { fish(b, xx + sd * 0.045, y - 0.2, fz, 0.4, { rz: Math.PI / 2 + b.j(0.08), ry: Math.PI / 2 + sd * 0.22 }); });
            b.cyl(xx, y - 0.04, fz, 0.03, 0.06, { c: 'rope', m: M.rope, seg: 5 });
          }
        });
        b.lathe(rxx + 0.75, 0, rz1 + 0.6, [[0.01, 0], [0.26, 0], [0.32, 0.3], [0.28, 0.3], [0.22, 0.05], [0.01, 0.05]], { c: 'woodLight', m: M.wood, seg: 12 });
        for (var q = 0; q < 4; q++) fish(b, rxx + 0.75 + b.j(0.08), 0.3, rz1 + 0.6 + (q - 1.5) * 0.09, 0.4, { rx: -Math.PI / 2, ry: b.j(0.4) });
      });

      b.part('Rope stall');
      b.unit(function () {
        var x = bx(1);
        coilStack(b, x - 0.42, ct, cF - 0.28, 0.24, 3); coilStack(b, x + 0.1, ct, cF - 0.32, 0.2, 2); coilStack(b, x + 0.52, ct, cF - 0.22, 0.17, 4);
        [x0 + bw, x0 + 2 * bw].forEach(function (px, k) { b.beam([px, 1.66, azF], [px, 1.7, azF + 0.18], 0.02, { c: 'woodDark' }); hungCoil(b, px, 1.36, azF + 0.12, 0.24 - k * 0.03, 0); });
      });
      b.unit(function () {
        var x = bx(1);
        // a drum of hawser on its side, a basket of line, and a hank on the walk (a cylinder turned rz PI/2 runs toward -x)
        b.cyl(x + 0.66, 0.45, zE + 0.55, 0.36, 0.62, { c: 'rope', m: M.rope, seg: 16, rz: Math.PI / 2 });
        [0.69, 0.07].forEach(function (dx) { b.cyl(x + dx, 0.45, zE + 0.55, 0.45, 0.05, { c: 'wood', m: M.wood, seg: 14, rz: Math.PI / 2, flat: true }); });
        b.lathe(x - 0.5, fy, cF + 0.6, [[0.01, 0], [0.26, 0], [0.34, 0.38], [0.3, 0.38], [0.22, 0.05], [0.01, 0.05]], { c: 'woodLight', m: M.wood, seg: 12 });
        coilStack(b, x - 0.5, fy + 0.3, cF + 0.6, 0.2, 1);
        b.ropeCoil(x + 0.05, fy, cF + 0.55, 0.22);
      });

      b.part('Leather stall');
      b.unit(function () {
        var x = bx(2);
        for (var k = 0; k < 5; k++) b.box(x - 0.4 + b.j(0.02), ct + k * 0.05, cF - 0.32, 0.62 - k * 0.03, 0.05, 0.48, { c: b.pick(PAL.stallsLeather), m: M.cloth, bevel: 0.015, ry: b.j(0.08) });
        // rolled hides (a cylinder turned rx PI/2 runs from its base toward +z)
        [0, 1, 2].forEach(function (k) { b.cyl(x + 0.15 + k * 0.2, ct + 0.09, cF - 0.58, 0.09, 0.52, { c: b.pick(PAL.stallsLeather), m: M.cloth, seg: 10, rx: Math.PI / 2, ry: b.j(0.1) }); b.cyl(x + 0.15 + k * 0.2, ct + 0.09, cF - 0.36, 0.1, 0.03, { c: 'rope', m: M.rope, seg: 10, rx: Math.PI / 2 }); });
        b.cyl(x + 0.25, ct + 0.26, cF - 0.55, 0.09, 0.48, { c: b.pick(PAL.stallsLeather), m: M.cloth, seg: 10, rx: Math.PI / 2 });
      });
      b.unit(function () {
        // a hide thrown over a trestle in front, and two more hung from the front rail
        var x = bx(2) + 0.1, z = zE + 0.55;
        [-0.45, 0.45].forEach(function (dx) { [-1, 1].forEach(function (sd) { b.beam([x + dx, 0, z + sd * 0.3], [x + dx, 0.8, z], 0.035, { c: 'wood' }); }); });
        b.beam([x - 0.6, 0.82, z], [x + 0.6, 0.82, z], 0.05, { c: 'woodLight' });
        [-1, 1].forEach(function (sd) { hide(b, x, 0.6, z + sd * 0.17, 1.15, 0.5, { c: sd < 0 ? '#9a7756' : '#8b6a4e', rx: sd * 0.55 }); });
        [-0.42, 0.42].forEach(function (dx, k) { hide(b, bx(2) + dx, ayF - 0.38, azF + 0.08 + k * 0.04, 0.62, 0.72, {}); });
      });

      b.part('Lamp-oil stall');
      b.unit(function () {
        var x = bx(3);
        for (var k = 0; k < 5; k++) lamp(b, x - 0.62 + k * 0.17, ct, cF - 0.1 + b.j(0.03), b.j(0.5));
        [[-0.6, 0.5], [-0.38, 0.45], [0.05, 0.55], [0.28, 0.5]].forEach(function (p) { jar(b, x + p[0], ct, cF - 0.4, p[1], null, null); });
        b.lathe(x + 0.55, ct, cF - 0.3, [[0.015, 0], [0.025, 0.12], [0.16, 0.26], [0.17, 0.28], [0.01, 0.28]], { c: 'iron', m: M.metal, seg: 10 });
      });
      b.unit(function () {
        var x = bx(3);
        jar(b, x - 0.62, fy, cF + 0.48, 1.1, '#e6e0d2', INK); jar(b, x - 0.05, fy, cF + 0.52, 1.0, '#8a857c', null);
        // a cask on a cradle with a tap, a pail beneath
        var kx = x + 0.3, kz = zE + 0.6;
        [-0.25, 0.25].forEach(function (dz) { b.box(kx, 0, kz + dz, 0.7, 0.16, 0.1, { c: 'wood', m: M.wood, bevel: 0.02 }); });
        b.barrel(kx, 0.02, kz, { lie: true, h: 0.78, r: 0.27, ry: Math.PI / 2 });
        b.cyl(kx, 0.3, kz + 0.42, 0.03, 0.12, { c: 'brass', m: M.gold, seg: 6, rx: Math.PI / 2 });
        b.bucket(kx, 0, kz + 0.62);
        jar(b, x - 0.55, 0, zE + 0.45, 0.85, '#3a3936', BONE);
        // a lantern hung from the pole on an iron arm
        var px = x0 + 4 * bw;
        b.beam([px, 2.05, azF], [px - 0.42, 2.05, azF], 0.018, { c: 'iron', m: M.metal });
        b.beam([px - 0.38, 2.05, azF], [px - 0.38, 1.92, azF], 0.008, { c: 'iron', m: M.metal, round: true, seg: 3 });
        b.box(px - 0.38, 1.62, azF, 0.15, 0.3, 0.15, { c: 'iron', m: M.metal, bevel: 0.01 });
        b.cone(px - 0.38, 1.9, azF, 0.11, 0.08, { c: 'iron', m: M.metal, seg: 6 });
        b.flame(px - 0.38, 1.67, azF + 0.08, 0.16, { i: 0.7 });
      });

      b.part('Grain stall');
      b.unit(function () {
        var x = bx(4);
        tub(b, x - 0.5, ct, cF - 0.3, 0.17, 0.22, 'stallsGrain'); tub(b, x - 0.05, ct, cF - 0.2, 0.13, 0.17, 'stallsGrain'); tub(b, x + 0.42, ct, cF - 0.32, 0.2, 0.26, 'stallsGrain');
        b.box(x + 0.1, ct, cF - 0.52, 0.16, 0.06, 0.22, { c: 'woodLight', m: M.wood, bevel: 0.01, ry: 0.5 });
        openSack(b, x - 0.5, fy, cF + 0.55, 0.62); openSack(b, x + 0.15, fy, cF + 0.62, 0.56);
        sk(b, x + 0.7, fy, cF + 0.45, 0.55);
        [[-0.55, 0], [0, 0], [0.55, 0], [-0.28, 1], [0.28, 1]].forEach(function (p) { sk(b, x + p[0] + b.j(0.03), fy + p[1] * 0.42, zw + 0.45 + b.j(0.04), 0.58); });
      });

      b.part("Quartermaster's tally");
      b.unit(function () {
        // the tally board: strokes in fives; the ledger, a balance and tally sticks on the hatch counter
        var bxx = tx - 0.78, by = 1.1, bz = tZ1 + 0.08;
        b.box(bxx, by, bz, 0.68, 0.84, 0.05, { c: INK, m: M.paint, bevel: 0.015 });
        b.box(bxx, by + 0.84, bz, 0.76, 0.06, 0.07, { c: 'woodDark', m: M.wood, bevel: 0.01 });
        for (var r = 0; r < 4; r++) for (var g = 0; g < 2; g++) {
          var gx = bxx - 0.22 + g * 0.27, gy = by + 0.14 + r * 0.17;
          if (r === 3 && g === 1) continue;
          for (var s = 0; s < 4; s++) b.box(gx + s * 0.04, gy, bz + 0.03, 0.012, 0.11, 0.01, { c: BONE, m: M.paint, bevel: 0, ao: 0 });
          b.box(gx + 0.06, gy + 0.045, bz + 0.035, 0.18, 0.012, 0.01, { c: BONE, m: M.paint, bevel: 0, ao: 0, rz: 0.5 });
        }
        var hx = tx + 0.35, ty = 1.055;
        b.box(hx - 0.25, ty, tZ1 + 0.15, 0.36, 0.035, 0.26, { c: INK, m: M.paint, bevel: 0.01, ry: 0.1 });
        b.box(hx - 0.25, ty + 0.035, tZ1 + 0.15, 0.33, 0.02, 0.23, { c: BONE, m: M.paint, bevel: 0.005, ry: 0.1 });
        b.post(hx + 0.35, ty, tZ1 + 0.12, 0.015, 0.33, { c: 'brass', m: M.gold });
        b.box(hx + 0.35, ty + 0.33, tZ1 + 0.12, 0.42, 0.02, 0.02, { c: 'brass', m: M.gold, bevel: 0 });
        [-0.2, 0.2].forEach(function (dx) { b.cyl(hx + 0.35 + dx, ty + 0.13, tZ1 + 0.12, 0.08, 0.02, { c: 'brass', m: M.gold, seg: 10 }); b.beam([hx + 0.35 + dx, ty + 0.15, tZ1 + 0.12], [hx + 0.35 + dx, ty + 0.33, tZ1 + 0.12], 0.004, { c: 'iron', m: M.metal, round: true, seg: 3 }); });
        for (var k = 0; k < 6; k++) b.box(hx + 0.05 + b.j(0.03), ty + (k % 2) * 0.025, tZ1 + 0.28, 0.025, 0.025, 0.3, { c: 'woodLight', m: M.wood, bevel: 0.004, ry: b.j(0.3) + 1.2 });
        b.torch(bxx, 2.15, tZ1 + 0.04, { s: 0.55 });
      });
      b.unit(function () {
        // the quartermaster's lectern
        var lx = tX0 - 0.1, lz = tZ1 + 1.05;
        b.post(lx, 0, lz, 0.05, 1.05, { c: 'woodDark' });
        b.box(lx, 0, lz, 0.5, 0.06, 0.4, { c: 'woodDark', m: M.wood });
        b.box(lx, 1.05, lz, 0.6, 0.05, 0.45, { c: 'woodLight', m: M.wood, rx: 0.35, ry: -0.4, bevel: 0.01 });
        b.cyl(lx + 0.2, 1.14, lz - 0.08, 0.035, 0.06, { c: INK, m: M.paint, seg: 8 });
        b.beam([lx + 0.2, 1.18, lz - 0.08], [lx + 0.26, 1.36, lz - 0.15], 0.012, { c: BONE, m: M.cloth, r2: 0.002 });
      });
      b.unit(function () {
        // the steelyard: a beam hung from a tripod, a pan of sacks one end, the weight the other
        var sx = tX0 - 1.2, sz = tZ1 + 2.6, ay = 2.55;
        [Math.PI / 2, Math.PI / 2 + 2.09, Math.PI / 2 + 4.19].forEach(function (a) { b.beam([sx + Math.cos(a) * 0.95, 0, sz + Math.sin(a) * 0.95], [sx, ay + 0.12, sz], 0.045, { c: 'wood', round: true }); });
        b.cyl(sx, ay - 0.05, sz, 0.08, 0.16, { c: 'rope', m: M.rope, seg: 8 });
        b.beam([sx, ay - 0.05, sz], [sx, 1.96, sz], 0.012, { c: 'iron', m: M.metal, round: true, seg: 4 });
        b.beam([sx - 0.32, 1.92, sz], [sx + 0.82, 1.92, sz], 0.03, { c: 'woodDark', round: true });
        for (var k = 0; k < 6; k++) b.box(sx + 0.15 + k * 0.11, 1.95, sz, 0.008, 0.03, 0.07, { c: BONE, m: M.paint, bevel: 0, ao: 0 });
        [0, 2.09, 4.19].forEach(function (a) { b.beam([sx - 0.32, 1.92, sz], [sx - 0.32 + Math.cos(a) * 0.24, 1.0, sz + Math.sin(a) * 0.24], 0.006, { c: 'iron', m: M.metal, round: true, seg: 3 }); });
        b.lathe(sx - 0.32, 0.94, sz, [[0.01, 0], [0.24, 0.02], [0.27, 0.09], [0.24, 0.09], [0.01, 0.05]], { c: 'brass', m: M.gold, seg: 14 });
        sk(b, sx - 0.32, 0.99, sz, 0.42);
        b.beam([sx + 0.62, 1.92, sz], [sx + 0.62, 1.66, sz], 0.006, { c: 'iron', m: M.metal, round: true, seg: 3 });
        b.lathe(sx + 0.62, 1.48, sz, [[0.01, 0], [0.09, 0.02], [0.1, 0.12], [0.06, 0.18], [0.01, 0.2]], { c: 'iron', m: M.metal, seg: 10 });
        // sacks waiting to be weighed
        [[0, 0], [0.5, 0.1], [0.25, 0.5], [0.22, 0.15, 0.42]].forEach(function (p) { sk(b, sx - 1.35 + p[0], p[2] || 0, sz - 0.2 + p[1], 0.52); });
      });

      b.part('Banner');
      b.unit(function () {
        var ax = tX0 - 0.05, ay = u0 + 1.85, az = tZF - 0.25;
        b.beam([ax, ay, az], [ax - 0.95, ay, az], 0.04, { c: 'iron', m: M.metal });
        b.beam([ax, ay - 0.55, az], [ax - 0.65, ay - 0.02, az], 0.025, { c: 'iron', m: M.metal });
        b.banner(ax - 0.52, ay - 0.05, az, 0.78, 2.0, { c: 'ink', emblem: 'none', tail: 'swallow', band: 'ember', bandAt: 0.7, bandH: 0.05, trim: 'iron', ry: 0 });
        // a key in bone, the quartermaster's mark
        b.push(ax - 0.52, ay - 0.05 - 2.0 * 0.4, az, 0);
        var key = [[-0.025, -0.26], [0.025, -0.26], [0.025, 0.12], [-0.025, 0.12]];
        var bit = [[0.025, -0.26], [0.13, -0.26], [0.13, -0.2], [0.09, -0.2], [0.09, -0.16], [0.025, -0.16]];
        var bow = [], hole = []; for (var i = 0; i < 16; i++) { var a = i / 16 * Math.PI * 2; bow.push([Math.cos(a) * 0.12, 0.22 + Math.sin(a) * 0.12]); hole.unshift([Math.cos(a) * 0.06, 0.22 + Math.sin(a) * 0.06]); }
        var sc = function (p) { return p.map(function (q) { return [q[0] * 1.5, q[1] * 1.5]; }); };
        [0.045, -0.045].forEach(function (dz) {
          [key, bit].forEach(function (p) { b.extrude(0, 0, dz, sc(p), 0.008, { c: BONE, m: M.cloth, bucket: 'cloth', ao: 0 }); });
          b.extrude(0, 0, dz, sc(bow), 0.008, { c: BONE, m: M.cloth, bucket: 'cloth', ao: 0, holes: [sc(hole)] });
        });
        b.pop();
      });

      b.part('Carts and stores');
      b.unit(function () {
        b.cart(-3.0, 3.9, { ry: 1.25, load: function () {
          [[-0.3, -0.6], [0.3, -0.55], [-0.28, 0.05], [0.3, 0.1], [0, -0.3]].forEach(function (p, k) { sk(b, p[0], 0.77 + (k === 4 ? 0.4 : 0), p[1], 0.55); });
          sk(b, 0, 0.77, 0.65, 0.5);
          b.beam([-0.3, 0.45, 2.6], [0.3, 0.45, 2.6], 0.04, { c: 'wood' }); b.log(0, 0, 2.6, 0.08, 0.42, { c: 'woodDark' });
        } });
        sk(b, -1.6, 0, 5.0, 0.5); sk(b, -1.95, 0, 5.3, 0.45);
      });
      b.unit(function () {
        b.cart(7.6, 3.2, { ry: -0.75, load: function () {
          b.barrel(-0.32, 0.77, -0.55, { h: 0.75, r: 0.27 }); b.barrel(0.32, 0.77, -0.5, { h: 0.75, r: 0.27 });
          b.barrel(0, 0.77, 0.3, { lie: true, h: 0.8, r: 0.27, ry: Math.PI / 2 });
          b.crate(-0.3, 0.77, 0.75, 0.5, { ry: 0.1 });
          b.beam([-0.3, 0.45, 2.6], [0.3, 0.45, 2.6], 0.04, { c: 'wood' }); b.log(0, 0, 2.6, 0.08, 0.42, { c: 'woodDark' });
        } });
      });
      b.unit(function () {
        // crates and casks stacked by the tally house's sunny wall
        b.crate(tX1 + 0.75, 0, tz + 0.6, 0.75, { ry: 0.1 }); b.crate(tX1 + 0.72, 0.75, tz + 0.58, 0.6, { ry: -0.2 }); b.crate(tX1 + 0.8, 0, tz - 0.4, 0.7, { ry: -0.15 });
        b.barrel(tX1 + 0.7, 0, tz + 1.5, {}); b.barrel(tX1 + 1.35, 0, tz + 1.15, { h: 0.82 });
      });
      b.unit(function () {
        b.barrel(x0 - 0.9, 0, zb + 0.2, {}); b.barrel(x0 - 1.0, 0, zb - 0.45, { h: 0.8 }); b.crate(x0 - 1.0, 0, zw - 1.2, 0.7, { ry: 0.3 }); b.crate(x0 - 0.95, 0.7, zw - 1.2, 0.55, { ry: -0.1 });
        b.woodpile(x0 - 1.0, zb + 1.2, { n: 3, len: 1.1, ry: Math.PI / 2 });
      });

      b.unit(function () {
        // a hand-barrow with baskets of fish by the rack, and casks and crates at the end of the row
        var hx = x0 + 0.1, hz = zE + 1.7;
        b.push(hx, 0, hz, 0.35);
        [-0.3, 0.3].forEach(function (dz) { b.beam([-1.0, 0.52, dz], [1.0, 0.52, dz], 0.035, { c: 'wood', round: true }); [-0.55, 0.55].forEach(function (dx) { b.post(dx, 0, dz, 0.03, 0.52, { c: 'wood' }); }); });
        for (var k = 0; k < 6; k++) b.box(-0.55 + k * 0.22, 0.54, 0, 0.16, 0.04, 0.68, { c: 'woodLight', m: M.wood, bevel: 0.01 });
        [-0.28, 0.3].forEach(function (dx) {
          b.lathe(dx, 0.58, 0, [[0.01, 0], [0.2, 0], [0.26, 0.24], [0.22, 0.24], [0.17, 0.04], [0.01, 0.04]], { c: 'woodLight', m: M.wood, seg: 12 });
          for (var q = 0; q < 3; q++) fish(b, dx + b.j(0.05), 0.8 + q * 0.02, (q - 1) * 0.1, 0.36, { rx: -Math.PI / 2, ry: b.j(0.5) });
        });
        b.pop();
        b.barrel(x0 + 1.7, 0, zE + 2.7, {}); b.barrel(x0 + 2.3, 0, zE + 2.95, { h: 0.82 }); b.crate(x0 + 1.95, 0, zE + 3.55, 0.65, { ry: 0.4 });
        sk(b, x0 + 2.75, 0, zE + 3.4, 0.5);
        // a loading pile in the yard: crates, a cask and sacks waiting for the cart
        var lx = 2.3, lz = zE + 3.6;
        b.crate(lx, 0, lz, 0.7, { ry: 0.25 }); b.crate(lx + 0.75, 0, lz + 0.15, 0.62, { ry: -0.1 }); b.crate(lx + 0.35, 0.7, lz + 0.05, 0.55, { ry: 0.5 });
        b.barrel(lx - 0.7, 0, lz + 0.35, { h: 0.85 }); sk(b, lx + 0.2, 0, lz + 0.8, 0.5); sk(b, lx - 0.25, 0, lz + 0.95, 0.46);
        b.ropeCoil(lx + 1.1, 0, lz + 0.75, 0.2);
      });

      b.part('War stores');
      b.unit(function () {
        // kit waiting to be issued: a rack of round and heater shields, a rack of spears, quivers of arrows
        b.rack(-6.3, 0, 4.4, 1.6, { kind: 'shields', ry: -0.35 });
        b.rack(-7.85, 0, 4.25, 1.2, { kind: 'spears', ry: -1.2 });
        b.quiver(-7.3, 0, 4.95, { ry: 0.4 }); b.quiver(-7.02, 0, 5.12, { ry: -0.3 });
        b.shield(-6.6, 0.4, 5.05, { kind: 'round', c: 'bone', s: 0.9, rx: -0.3, ry: -0.5, emblem: 'none' });
      });

      b.part('Ivy and flowers');
      b.unit(function () {
        b.ivy([[tX0 + 0.05, 0.4, tZ1 + 0.28], [tX0 + 0.3, 1.6, tZ1 + 0.28], [tX0 + 0.12, 2.6, tZ1 + 0.28]], [0, 0, 1], { density: 5, spread: 0.4 });
        b.ivy([[tX0 - 0.28, 0.4, tz - 0.6], [tX0 - 0.28, 1.5, tz - 0.4], [tX0 - 0.28, 2.5, tz - 0.7]], [-1, 0, 0], { density: 5, spread: 0.45 });
        b.bush(tx + 1.3, tZ1 + 0.6, 0.45, { flowers: '#f3f1ec', n: 2 });
        b.bush(x0 - 0.7, zE + 0.9, 0.5, { flowers: '#e6e0d2', n: 2 });
      });

      b.life(function () {
        var qx = tX0 + 0.55, qz = tZ1 + 1.2, qr = -0.45;
        b.figure(qx, qz, { role: 'villager', pose: 'stallsLedger', ry: qr, c: '#2f2e2c', beard: true, cape: INK });
        var lp = fpt(qx, qz, qr, [0, 1.13, 0.36]);
        b.push(lp[0], lp[1], lp[2], qr); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(-0.55));
        [-1, 1].forEach(function (sd) { b.box(sd * 0.1, 0, 0, 0.2, 0.025, 0.26, { c: INK, m: M.paint, bevel: 0.005, rz: sd * 0.12 }); b.box(sd * 0.095, 0.02, 0, 0.18, 0.02, 0.24, { c: BONE, m: M.paint, bevel: 0.004, rz: sd * 0.12 }); });
        b.pop();
        b.figure(tX0 + 1.45, tZ1 + 2.05, { role: 'soldier', pose: 'talk', ry: -2.5, team: 'bone' });
        b.figure(0.2, 2.7, { role: 'villager', pose: 'carry', ry: 1.45, c: '#8a857c' });
        var gx = bx(4) - 0.3, gz = zE + 0.75, gr = 0.1;
        b.figure(gx, gz, { role: 'villager', pose: 'stallsScoop', ry: gr, c: '#6f6a62', hat: 'straw' });
        var sp = fpt(gx, gz, gr, [0.05, 0, 0.58]);
        openSack(b, sp[0], 0, sp[2], 0.62);
        b.figure(x0 - 0.78, zw + 0.75, { role: 'villager', pose: 'stallsReach', ry: -Math.PI / 2, c: '#5c5e62' });
        b.figure(-0.6, 5.2, { role: 'child', pose: 'run', ry: 2.3 });
        var rx = bx(1) - 0.2, rz2 = zE + 0.55, rr = 0.35;
        b.figure(rx, rz2, { role: 'villager', pose: 'stallsOffer', ry: rr, c: '#3b3a38', beard: true });
        var cp = fpt(rx, rz2, rr, [0, 1.12, 0.44]);
        hungCoil(b, cp[0], cp[1] - 0.12, cp[2], 0.2, rr);
        b.figure(rx + 0.55, rz2 + 0.95, { role: 'villager', pose: 'talk', ry: -2.6, c: '#a39d92' });
      });
      b.pop();
    }
  });
})();
