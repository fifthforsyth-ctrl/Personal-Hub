// Trebuchet: a counterweight trebuchet on a great frame of dark oak, standing on a platform of dressed flagstones. Its
// arm is winched down into the sling trough, so the iron-bound counterweight box rides high in the low sun; a
// two-wheeled windlass holds it, a stone lies in the sling, and the crew bring round shot from a pile, a cart and a
// shot store with a slate roof and dragon-head finials. Laid flagstones first, then the sills and soles, the deck and
// trough, the side frames timber by timber, the bearings and axle, the arm, the counterweight box course by course and
// its stones, the windlass, the sling, the carvings, the store, the shot and stores, and last the crew.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL;
  PAL.trebuchet_oak = ['#5b4e42', '#54483d', '#625447', '#4f4339', '#584b40'];
  PAL.trebuchet_oakPale = ['#7a6b5b', '#726354', '#82725f', '#6c5e50'];
  PAL.trebuchet_flag = ['#c2bbae', '#b8b1a4', '#cac3b6', '#aea79a', '#bdb6a9', '#a8a194'];
  PAL.trebuchet_shot = ['#aaa59b', '#b5b0a5', '#9f9a90', '#bdb7ac', '#a39d93'];
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  // a point in a figure's frame (standing at fx, fy, fz, turned ry) in world space
  function fwd(fx, fy, fz, ry, lx, ly, lz) { var c = Math.cos(ry), s = Math.sin(ry); return [fx + lx * c + lz * s, fy + ly, fz - lx * s + lz * c]; }
  function add(a, d, k) { return [a[0] + d[0] * k, a[1] + d[1] * k, a[2] + d[2] * k]; }
  function norm(d) { var L = Math.hypot(d[0], d[1], d[2]) || 1; return [d[0] / L, d[1] / L, d[2] / L]; }

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
  }
  // a rope swagged between two points
  function swag(b, a, c, sag, r) {
    var n = 6, prev = a;
    for (var i = 1; i <= n; i++) { var t = i / n, p = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (c[2] - a[2]) * t]; b.beam(prev, p, r || 0.022, { c: 'rope', m: M.rope, round: true, seg: 5 }); prev = p; }
  }
  // a wooden mallet held at hand, its handle along dir
  function mallet(b, hand, dir, len) {
    dir = norm(dir); var end = add(hand, dir, len), perp = norm([dir[2], 0, -dir[0]]);
    b.beam(add(hand, dir, -0.08), end, 0.022, { round: true, seg: 6, c: 'woodLight', m: M.wood });
    b.beam(add(end, perp, -0.12), add(end, perp, 0.12), 0.075, { round: true, seg: 8, c: 'wood', m: M.wood });
  }

  // crew poses: turning the windlass by a handle, stooping over the sling, carrying a hand-barrow (front and back),
  // and holding the trigger lanyard ready
  var PO = KIT.people.poses;
  PO.trebuchet_crank = function (r) { return { feet: [V(-0.16, 0.09, -0.04), V(0.15, 0.09, -0.48)], hands: [V(-0.09, 1.4, 0.47), V(0.09, 1.38, 0.47)], lean: 0.26, twist: 0.0, side: 0, hip: 0, drop: 0.05, head: [0, 0.12], pole: [V(-0.8, -0.5, -0.2), V(0.8, -0.5, -0.2)] }; };
  PO.trebuchet_stoop = function (r) { return { feet: [V(-0.2, 0.09, 0.08), V(0.19, 0.09, -0.18)], hands: [V(-0.17, 0.52, 0.5), V(0.17, 0.5, 0.48)], lean: 0.62, twist: 0, side: 0, hip: 0, drop: 0.16, head: [0, 0.35], pole: [V(-0.9, -0.2, 0.2), V(0.9, -0.2, 0.2)] }; };
  PO.trebuchet_barrowFront = function (r) { return { feet: [V(-0.1, 0.13, 0.3), V(0.11, 0.1, -0.27)], hands: [V(-0.3, 0.86, -0.16), V(0.3, 0.86, -0.16)], lean: 0.14, twist: 0, side: 0, hip: 0, drop: 0.03, head: [r(0.2), 0.05] }; };
  PO.trebuchet_barrowBack = function (r) { return { feet: [V(-0.1, 0.1, -0.25), V(0.11, 0.13, 0.28)], hands: [V(-0.3, 0.86, 0.34), V(0.3, 0.86, 0.34)], lean: 0.1, twist: 0, side: 0, hip: 0, drop: 0.03, head: [0, 0.05], pole: [V(-0.6, -0.5, -0.4), V(0.6, -0.5, -0.4)] }; };
  PO.trebuchet_climb = function (r) { return { feet: [V(-0.12, 0.09, 0.12), V(0.12, 0.42, 0.14)], hands: [V(-0.24, 1.45, 0.25), V(0.24, 1.78, 0.22)], lean: 0.08, twist: 0, side: 0, hip: 0, drop: 0.04, head: [0, -0.3], pole: [V(-0.9, -0.2, -0.4), V(0.9, -0.2, -0.4)] }; };
  PO.trebuchet_splice = function (r) { return { feet: [V(-0.16, 0.09, 0.02), V(0.15, 0.09, -0.1)], hands: [V(-0.14, 0.87, 0.4), V(0.17, 0.87, 0.43)], lean: 0.3, twist: 0, side: 0, hip: 0, drop: 0.04, head: [0.1, 0.4], pole: [V(-0.9, -0.3, 0.1), V(0.9, -0.3, 0.1)] }; };
  PO.trebuchet_lanyard = function (r) { return { feet: [V(-0.15, 0.09, 0.16), V(0.15, 0.09, -0.22)], hands: [V(-0.06, 1.0, 0.36), V(0.07, 0.94, 0.28)], lean: -0.06, twist: 0.1, side: 0, hip: 0, drop: 0.02, head: [0, 0.05], pole: [V(-0.7, -0.6, -0.3), V(0.7, -0.6, -0.3)] }; };

  // the machine: the axle at (X0, Y0, Z0) along z; the arm swings in the x-y plane, cocked AL below level on the long
  // side (toward -x, the windlass) so the short side and its counterweight ride high toward +x, the enemy
  var X0 = 1.9, Y0 = 7.0, Z0 = -0.6, LL = 9.2, LS = 2.7, SP = 1.35, AL = Math.asin((Y0 - 0.86) / LL), PHI = Math.PI + AL;
  var CA = Math.cos(AL), SA = Math.sin(AL);
  var PX = X0 + LS * CA, PY = Y0 + LS * SA;            // the counterweight pin
  var YB1 = PY - 1.5, YB0 = YB1 - 1.8, BW = 2.0, BD = 1.84;     // the counterweight box
  var YT = Y0 - 0.3, LG = 3.7, R1 = 1.7, R2 = 3.85;        // frame top (under the bearings), leg spread, rails
  var S0 = 0.17, S1 = 0.57, SL1 = 0.51, DY = 0.575;      // sole bottom and top, sill top, deck top
  var SX0 = X0 - 9.45, SX1 = X0 + 4.9;
  var XW = X0 - 8.45, YW = 1.55, WR = 0.95;              // the windlass drum and its wheels
  var FX0 = XW - 1.5, FX1 = X0 + 5.3, FZ0 = Z0 - 3.1, FZ1 = Z0 + 3.0, FY = 0.16;   // the flagstone platform
  var SPX = X0 - 5.2;                                     // the sling pouch, lying in the trough
  var OX = 0.4, OZ = 0.3;                                 // the whole yard, shifted to sit centred on its island
  var SHX = -6.9, SHZ = -5.3;                             // the shot store
  var PLX = 2.9, PLZ = 3.9;                               // the pile of round shot
  var MX = 5.15, MZ = 4.05;                               // the mason's block
  function legX(y, sg) { return X0 + sg * (LG - (LG - 0.3) * (y - S1) / (YT + 0.04 - S1)); }
  // a point in the arm's frame (x along the long arm toward its tip, y across it, +y toward the ground side) in world
  function armW(lx, ly) { var c = Math.cos(PHI), s = Math.sin(PHI); return [X0 + lx * c - ly * s, Y0 + lx * s + ly * c, Z0]; }

  KIT.defineBuild('trebuchet', {
    name: 'Trebuchet', size: 'big', need: 70,
    line: 'A great oak trebuchet on a flagstone platform, its arm winched down and the iron-bound counterweight raised, with a pile of round shot, a two-wheeled windlass, a slate-roofed shot store and a crew at work.',
    r: 13.4, flat: [18.2, 12.2], ground: 'cobble', path: [[1.8, 13.8], [1.3, 6.2]],
    frameY: 1.6, frameR: 11.8, glowAt: [PX + OX, PY + 0.5, Z0 + OZ],
    islandOpts: { cobbleSkip: function (x, z) { x -= OX; z -= OZ; return x > FX0 - 0.12 && x < FX1 + 0.12 && z > FZ0 - 0.12 && z < FZ1 + 0.12; } },
    trees: [{ x: -9.0, z: -8.0, kind: 'pine', h: 6.8 }, { x: -12.0, z: -3.0, kind: 'pine', h: 7.6 }, { x: 10.6, z: -2.2, kind: 'pine', h: 8.0 }],
    bushes: [{ x: 9.4, z: 6.3, r: 0.9, flowers: '#f3f1ec' }, { x: -9.7, z: 6.5, r: 0.8 }, { x: 10.5, z: 4.1, r: 0.7 }, { x: 6.8, z: -7.7, r: 0.8 }, { x: -1.6, z: 10.6, r: 0.75, flowers: '#f3f1ec' }, { x: 5.6, z: 9.8, r: 0.8 }, { x: -6.8, z: 9.2, r: 0.7, flowers: '#e6e3dc' }],
    perches: [{ x: SHX + OX, y: 2.35 + 1.25 + 0.18, z: SHZ + OZ, ry: 0 }, { x: XW + OX, y: 2.22, z: Z0 + OZ, ry: Math.PI / 2 }, { x: -7.9, y: 0.06, z: 4.5, ry: 0.6 }],
    build: function (b) {
      var oak = 'trebuchet_oak', pale = 'trebuchet_oakPale', sides = [1, -1];
      function W(o) { return Object.assign({ c: oak, m: M.wood }, o || {}); }
      var IRON = { c: '#34353a', m: M.metal, bevel: 0.006 };
      function bolt(x, y, z, r) { b.ball(x, y, z, r || 0.032, { c: 'iron', m: M.metal, detail: 0, ao: 0 }); }
      b.push(OX, 0, OZ, 0);

      // ------------------------------------------------------------ the platform, column by column
      b.part('Flagstone platform');
      var NC = 20, cw = (FX1 - FX0) / NC;
      for (var ci = 0; ci < NC; ci++) (function (ci) {
        b.unit(function () {
          var x = FX0 + (ci + 0.5) * cw, cuts = [FZ0], t = FZ0 + (ci % 2 ? 0.45 : 0.8) + b.r() * 0.25;
          while (t < FZ1 - 0.4) { cuts.push(t); t += 0.62 + b.r() * 0.42; }
          cuts.push(FZ1);
          for (var k = 0; k < cuts.length - 1; k++) {
            var h = 0.15 + b.j(0.012), d = cuts[k + 1] - cuts[k];
            b.box(x + b.j(0.012), FY - h, (cuts[k] + cuts[k + 1]) / 2, cw - 0.05, h, d - 0.05, { ry: b.j(0.014), c: b.stoneC('trebuchet_flag'), m: M.stone, bevel: 0.035, ao: 0.12, jit: 0.04 });
          }
        });
      })(ci);

      // ------------------------------------------------------------ sills across, then the two long soles
      b.part('Sills');
      var sills = [X0 - 8.85, X0 - 6.4, X0 - 4.0, X0 - 1.6, X0, X0 + 1.9, X0 + 4.25];
      sills.forEach(function (x) {
        b.unit(function () {
          var half = x === X0 ? 2.95 : 1.68;
          b.box(x, S0, Z0, 0.36, SL1 - S0, half * 2, W({ bevel: 0.035 }));
          [-1, 1].forEach(function (s) { b.box(x, SL1 - 0.01, Z0 + s * (half - 0.14), 0.1, 0.05, 0.1, { c: 'woodDark', m: M.wood, bevel: 0.01 }); });
          if (x === X0) [-1, 1].forEach(function (s) { b.box(x, SL1, Z0 + s * 2.66, 0.42, 0.16, 0.46, W({ c: pale, bevel: 0.03 })); });
        });
      });
      b.part('Soles');
      sides.forEach(function (s) {
        b.unit(function () {
          var z = Z0 + s * SP, xj = X0 - 2.7;
          b.box((SX0 + xj) / 2, S0, z, xj - SX0 - 0.03, S1 - S0, 0.4, W({ bevel: 0.04 }));
          b.box((xj + SX1) / 2, S0, z, SX1 - xj - 0.03, S1 - S0, 0.4, W({ bevel: 0.04 }));
          // an iron plate over the scarf, and a trenail where each sill crosses
          b.box(xj, S0 + 0.06, z + s * 0.215, 0.8, 0.28, 0.03, IRON);
          [-0.3, -0.1, 0.1, 0.3].forEach(function (dx) { [0.1, 0.24].forEach(function (dy) { bolt(xj + dx, S0 + 0.06 + dy, z + s * 0.235); }); });
          sills.forEach(function (x) { b.cyl(x, S1 - 0.2, z + s * 0.19, 0.04, 0.05, { rx: Math.PI / 2, c: 'woodDark', m: M.wood, seg: 6 }); });
        });
      });

      // ------------------------------------------------------------ the deck between the soles, and the sling trough
      b.part('Deck and trough');
      var DX0 = X0 - 9.1, DX1 = X0 - 1.6, NP = 8, pw = 2.3 / NP;
      for (var pi = 0; pi < NP; pi++) (function (pi) {
        b.unit(function () {
          var z = Z0 - 1.15 + (pi + 0.5) * pw, xs = pi % 2 ? X0 - 6.4 : X0 - 4.0;
          [[DX0, xs], [xs, DX1]].forEach(function (sg) { b.box((sg[0] + sg[1]) / 2, SL1, z, sg[1] - sg[0] - 0.03, DY - SL1, pw - 0.025, { c: b.pick(PAL.trebuchet_oakPale), m: M.wood, bevel: 0.012, ao: 0.2 }); });
          [xs - 0.1, xs + 0.1, DX0 + 0.15, DX1 - 0.15].forEach(function (x) { b.box(x, DY - 0.005, z, 0.04, 0.012, 0.04, { c: 'woodDark', m: M.wood, bevel: 0 }); });
        });
      })(pi);
      sides.forEach(function (s) {
        b.unit(function () {
          var z = Z0 + s * 0.5;
          [0, 1].forEach(function (k) { b.box(X0 - 4.8, DY + k * 0.15, z, 6.2, 0.14, 0.06, { c: b.pick(PAL.trebuchet_oakPale), m: M.wood, bevel: 0.012 }); });
          for (var x = X0 - 7.7; x <= X0 - 1.8; x += 1.45) b.box(x, DY, z + s * 0.065, 0.07, 0.36, 0.07, { c: 'woodDark', m: M.wood, bevel: 0.01 });
        });
      });

      // ------------------------------------------------------------ the two side frames, timber by timber
      b.part('Frame posts');
      sides.forEach(function (s) {
        b.unit(function () {
          var z = Z0 + s * SP;
          b.box(X0, S1, z, 0.38, YT - S1, 0.38, W({ bevel: 0.04 }));
          [1.2, 4.6].forEach(function (y) { b.box(X0, y, z, 0.46, 0.09, 0.46, { c: 'woodDark', m: M.wood, bevel: 0.02 }); });
        });
      });
      b.part('Frame legs');
      sides.forEach(function (s) {
        [1, -1].forEach(function (sg) {
          b.unit(function () {
            var z = Z0 + s * SP;
            b.beam([X0 + sg * LG, S1 - 0.1, z], [X0 + sg * 0.3, YT + 0.04, z], 0.17, W());
            b.box(X0 + sg * (LG + 0.31), S1, z, 0.34, 0.2, 0.36, W({ c: pale, bevel: 0.03 }));
          });
        });
      });
      b.part('Frame rails');
      sides.forEach(function (s) {
        [R1, R2].forEach(function (y) {
          b.unit(function () {
            var z = Z0 + s * (SP + 0.1), xa = legX(y, -1) - 0.22, xb = legX(y, 1) + 0.22;
            b.box((xa + xb) / 2, y - 0.13, z, xb - xa, 0.26, 0.26, W({ bevel: 0.03 }));
            [xa + 0.1, xb - 0.1].forEach(function (x) { b.box(x, y - 0.04, z + s * 0.14, 0.07, 0.07, 0.04, { c: 'woodDark', m: M.wood, bevel: 0.01 }); });
          });
        });
      });
      b.part('Frame braces');
      sides.forEach(function (s) {
        b.unit(function () {
          var z = Z0 + s * SP;
          [1, -1].forEach(function (sg) {
            b.beam([X0 + sg * 1.0, S1 - 0.04, z], [X0 + sg * 0.12, R1 - 0.2, z], 0.11, W());
            b.beam([X0 + sg * 0.12, R1 + 0.14, z], [legX(R2 - 0.14, sg) - sg * 0.1, R2 - 0.14, z], 0.11, W());
            b.beam([legX(R2 + 0.14, sg) - sg * 0.15, R2 + 0.14, z], [X0 + sg * 0.12, R2 + 1.6, z], 0.11, W());
          });
        });
      });
      b.part('Side struts');
      sides.forEach(function (s) {
        b.unit(function () { b.beam([X0, SL1 + 0.12, Z0 + s * 2.62], [X0, R2 - 0.4, Z0 + s * (SP + 0.14)], 0.13, W({ c: pale })); });
      });
      b.part('Iron straps');
      sides.forEach(function (s) {
        b.unit(function () {
          var z = Z0 + s * (SP + 0.205), zr = Z0 + s * (SP + 0.245);
          b.box(X0, YT - 0.85, z, 1.5, 0.6, 0.03, IRON);
          [-0.6, -0.3, 0, 0.3, 0.6].forEach(function (dx) { bolt(X0 + dx, YT - 0.72, z + s * 0.022); bolt(X0 + dx, YT - 0.37, z + s * 0.022); });
          [R1, R2].forEach(function (y) {
            b.box(X0, y - 0.17, zr, 0.5, 0.34, 0.03, IRON);
            [-0.15, 0.15].forEach(function (dx) { bolt(X0 + dx, y - 0.08, zr + s * 0.022); bolt(X0 + dx, y + 0.08, zr + s * 0.022); });
            [-1, 1].forEach(function (sg) { bolt(legX(y, sg), y, zr + s * 0.01, 0.04); });
          });
        });
      });

      // ------------------------------------------------------------ bearings and the axle
      b.part('Bearings and axle');
      sides.forEach(function (s) {
        b.unit(function () {
          var z = Z0 + s * SP;
          b.box(X0, YT, z, 0.66, 0.62, 0.52, W({ c: 'woodDark', bevel: 0.04 }));
          [YT + 0.02, YT + 0.5].forEach(function (y) { b.box(X0, y, z + s * 0.27, 0.72, 0.07, 0.03, IRON); });
          b.box(X0, YT + 0.62, z, 0.84, 0.15, 0.62, W({ bevel: 0.03 }));
          b.box(X0, YT + 0.77, z, 0.26, 0.4, 0.26, W({ c: 'woodDark', bevel: 0.03 }));
        });
      });
      b.unit(function () { b.cyl(X0, Y0, Z0 - 1.85, 0.17, 3.7, { rx: Math.PI / 2, c: oak, m: M.wood, seg: 12, flat: true }); });
      b.unit(function () {
        [-1, 1].forEach(function (s) {
          b.cyl(X0, Y0, Z0 + (s > 0 ? 0.3 : -0.38), 0.23, 0.08, { rx: Math.PI / 2, c: 'iron', m: M.metal, seg: 14 });
          b.cyl(X0, Y0, Z0 + (s > 0 ? 1.62 : -1.72), 0.25, 0.1, { rx: Math.PI / 2, c: 'iron', m: M.metal, seg: 14 });
          b.box(X0, Y0 + 0.12, Z0 + s * 1.78, 0.06, 0.32, 0.06, { c: 'iron', m: M.metal, bevel: 0.01 });
        });
      });

      // ------------------------------------------------------------ the throwing arm, in its own frame
      b.part('Throwing arm');
      function arm(fn) { b.push(X0, Y0, Z0, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(PHI)); fn(); b.pop(); }
      [[-0.55, 1.25, 0.62, 0.48], [-3.0, -0.55, 0.56, 0.46], [1.25, 3.9, 0.52, 0.44], [3.9, 6.5, 0.44, 0.4], [6.5, 9.32, 0.36, 0.36]].forEach(function (sg) {
        b.unit(function () { arm(function () { b.box((sg[0] + sg[1]) / 2, -sg[2] / 2, 0, sg[1] - sg[0], sg[2], sg[3], W({ c: pale, bevel: 0.04 })); }); });
      });
      b.unit(function () {
        arm(function () {
          // fish plates either side of the hub, bolted through
          [-1, 1].forEach(function (s) {
            b.box(0.3, -0.37, s * 0.275, 2.3, 0.74, 0.05, W({ bevel: 0.012 }));
            [-0.65, -0.3, 0.35, 0.75, 1.15].forEach(function (x) { [-0.24, 0.24].forEach(function (y) { bolt(x, y, s * 0.31, 0.035); }); });
          });
        });
      });
      b.unit(function () { arm(function () { [[-2.85, 0.56, 0.46], [-1.8, 0.56, 0.46]].forEach(function (h) { b.box(h[0], -(h[1] + 0.06) / 2, 0, 0.13, h[1] + 0.06, h[2] + 0.06, { c: 'iron', m: M.metal, bevel: 0.012 }); }); }); });
      b.unit(function () { arm(function () { [[2.6, 0.52, 0.44], [3.9, 0.52, 0.44], [5.2, 0.44, 0.4], [6.5, 0.44, 0.4], [7.8, 0.36, 0.36], [9.1, 0.36, 0.36]].forEach(function (h) { b.box(h[0], -(h[1] + 0.06) / 2, 0, 0.13, h[1] + 0.06, h[2] + 0.06, { c: 'iron', m: M.metal, bevel: 0.012 }); }); }); });
      b.unit(function () {
        arm(function () {
          // rope lashings near the tip, the release prong and the eye the windlass rope hauls on
          for (var i = 0; i < 5; i++) b.box(8.2 + i * 0.1, -0.215, 0, 0.065, 0.43, 0.43, { c: 'rope', m: M.rope, bevel: 0.02 });
          b.beam([9.32, 0, 0], [9.72, -0.07, 0], 0.035, { round: true, c: 'iron', m: M.metal, seg: 6 });
          b.addGeo(new T.TorusGeometry(0.09, 0.025, 4, 10), { x: 9.05, y: 0.27, z: 0, c: 'iron', m: M.metal, ao: 0 });
        });
      });

      // ------------------------------------------------------------ the counterweight box, raised high in the sun
      b.part('Counterweight box');
      b.unit(function () {
        b.cyl(PX, PY, Z0 - 0.6, 0.075, 1.2, { rx: Math.PI / 2, c: 'iron', m: M.metal, seg: 10 });
        [-1, 1].forEach(function (s) {
          var z = Z0 + s * 0.42;
          b.box(PX, YB1 + 0.18, z, 0.2, PY + 0.14 - YB1 - 0.18, 0.13, W({ c: 'woodDark', bevel: 0.025 }));
          b.box(PX, PY - 0.24, z, 0.26, 0.46, 0.17, { c: 'iron', m: M.metal, bevel: 0.015 });
          b.box(PX, YB1 + 0.24, z, 0.26, 0.3, 0.17, { c: 'iron', m: M.metal, bevel: 0.015 });
          b.cyl(PX, PY, z + (s > 0 ? 0.09 : -0.13), 0.11, 0.04, { rx: Math.PI / 2, c: 'iron', m: M.metal, seg: 10 });
        });
      });
      b.unit(function () {
        b.box(PX, YB0, Z0, BW - 0.06, 0.12, BD - 0.06, W({ c: 'woodDark', bevel: 0.02 }));
        [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) { b.box(PX + sx * (BW / 2 - 0.08), YB0, Z0 + sz * (BD / 2 - 0.08), 0.17, YB1 - YB0 + 0.05, 0.17, W({ bevel: 0.025 })); }); });
      });
      var NCo = 7, chh = (YB1 - YB0 - 0.12) / NCo;
      for (var kc = 0; kc < NCo; kc++) (function (k) {
        b.unit(function () {
          var y = YB0 + 0.12 + k * chh, hh = chh - 0.022;
          [-1, 1].forEach(function (s) {
            b.box(PX + b.j(0.01), y, Z0 + s * (BD / 2 - 0.075), BW - 0.2, hh, 0.07, { c: b.pick(PAL.wood), m: M.wood, bevel: 0.012 });
            b.box(PX + s * (BW / 2 - 0.075), y, Z0 + b.j(0.01), 0.07, hh, BD - 0.2, { c: b.pick(PAL.wood), m: M.wood, bevel: 0.012 });
          });
        });
      })(kc);
      [0, 1].forEach(function (q) {
        b.unit(function () {
          var y = q ? YB1 - 0.34 : YB0 + 0.28, ez = BD / 2 - 0.08 + 0.085 + 0.03, ex = BW / 2 - 0.08 + 0.085 + 0.03;
          [-1, 1].forEach(function (s) {
            b.box(PX, y, Z0 + s * ez, BW + 0.1, 0.1, 0.03, { c: 'iron', m: M.metal, bevel: 0.008 });
            b.box(PX + s * ex, y, Z0, 0.03, 0.1, BD + 0.1, { c: 'iron', m: M.metal, bevel: 0.008 });
            [-0.6, -0.2, 0.2, 0.6].forEach(function (d) { bolt(PX + d, y + 0.05, Z0 + s * (ez + 0.02), 0.026); bolt(PX + s * (ex + 0.02), y + 0.05, Z0 + d * 0.9, 0.026); });
          });
        });
      });
      b.unit(function () {
        b.box(PX, YB1 - 0.04, Z0, 0.26, 0.24, BD + 0.24, W({ c: 'woodDark', bevel: 0.03 }));
        [-1, 1].forEach(function (s) { b.box(PX, YB1 - 0.06, Z0 + s * (BD / 2 + 0.06), 0.3, 0.28, 0.06, { c: 'iron', m: M.metal, bevel: 0.01 }); });
      });
      var boxStones = [];
      [-1, 1].forEach(function (sx) { [-0.44, 0, 0.44].forEach(function (dz) { boxStones.push([PX + sx * 0.44, YB1 - 0.1, Z0 + dz, 0.25]); }); });
      b.unit(function () { boxStones.forEach(function (p) { b.ball(p[0] + b.j(0.03), p[1] + b.j(0.03), p[2] + b.j(0.03), p[3] * (0.92 + b.r() * 0.14), { c: b.pick(PAL.trebuchet_shot), m: M.stone, detail: 1 }); }); });
      b.unit(function () { [[PX - 0.44, YB1 + 0.24, Z0 - 0.22, 0.2], [PX + 0.45, YB1 + 0.22, Z0 + 0.24, 0.19], [PX + 0.42, YB1 + 0.2, Z0 - 0.3, 0.18]].forEach(function (p) { b.ball(p[0], p[1], p[2], p[3], { c: b.pick(PAL.trebuchet_shot), m: M.stone, detail: 1 }); }); });

      // ------------------------------------------------------------ the windlass that hauls the arm down
      b.part('Windlass');
      b.unit(function () {
        sides.forEach(function (s) { var z = Z0 + s * SP; b.box(XW, S1, z, 0.32, 2.35 - S1, 0.32, W({ bevel: 0.03 })); b.box(XW, 2.35, z, 0.42, 0.12, 0.42, W({ c: 'woodDark', taper: 0.6, bevel: 0 })); });
      });
      b.unit(function () {
        sides.forEach(function (s) { var z = Z0 + s * SP; [-1, 1].forEach(function (sg) { b.beam([XW + sg * 0.85, S1 - 0.04, z], [XW + sg * 0.12, 1.25, z], 0.09, W({ c: pale })); }); });
        b.box(XW, 2.0, Z0, 0.24, 0.22, 2 * SP + 0.3, W({ bevel: 0.03 }));
      });
      b.unit(function () {
        b.cyl(XW, YW, Z0 - 2.0, 0.2, 4.0, { rx: Math.PI / 2, c: pale, m: M.wood, seg: 10, flat: true });
        b.cyl(XW, YW, Z0 - 0.55, 0.27, 1.1, { rx: Math.PI / 2, c: 'rope', m: M.rope, seg: 12 });
        for (var i = 0; i < 7; i++) b.addGeo(new T.TorusGeometry(0.27, 0.03, 4, 14), { x: XW, y: YW, z: Z0 - 0.48 + i * 0.16, c: 'rope', m: M.rope, ao: 0 });
      });
      b.unit(function () {
        // a ratchet wheel and its pawl, so the arm cannot run back
        var rz = Z0 + 0.95, pts = [];
        for (var i = 0; i < 16; i++) { var a0 = i / 16 * Math.PI * 2, a1 = (i + 0.7) / 16 * Math.PI * 2; pts.push([Math.cos(a0) * 0.36, Math.sin(a0) * 0.36]); pts.push([Math.cos(a1) * 0.46, Math.sin(a1) * 0.46]); }
        b.extrude(XW, YW, rz, pts, 0.08, { c: 'iron', m: M.metal, bevel: 0.005 });
        b.beam([XW + 0.14, 2.06, rz], [XW + 0.34, 1.89, rz], 0.035, { c: 'iron', m: M.metal });
        bolt(XW + 0.14, 2.06, rz + 0.05, 0.04);
      });
      function wheelAt(z, s) {
        var n = 8;
        b.cyl(XW, YW, z - 0.17, 0.17, 0.34, { rx: Math.PI / 2, c: 'woodDark', m: M.wood, seg: 10, flat: true });
        for (var i = 0; i < n; i++) {
          var a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
          b.beam([XW + Math.cos(a0) * 0.14, YW + Math.sin(a0) * 0.14, z], [XW + Math.cos(a0) * (WR - 0.05), YW + Math.sin(a0) * (WR - 0.05), z], 0.055, W({ c: pale, r2: 0.045 }));
          b.beam([XW + Math.cos(a0) * WR, YW + Math.sin(a0) * WR, z], [XW + Math.cos(a1) * WR, YW + Math.sin(a1) * WR, z], 0.08, W({ r2: 0.07 }));
          bolt(XW + Math.cos(a0) * WR, YW + Math.sin(a0) * WR, z + s * 0.075, 0.03);
        }
      }
      sides.forEach(function (s) { b.unit(function () { wheelAt(Z0 + s * 1.8, s); }); });
      b.unit(function () {
        sides.forEach(function (s) {
          var z = Z0 + s * 1.8;
          for (var i = 0; i < 8; i += 2) { var a = i / 8 * Math.PI * 2; b.cyl(XW + Math.cos(a) * WR, YW + Math.sin(a) * WR, s > 0 ? z + 0.05 : z - 0.43, 0.04, 0.38, { rx: Math.PI / 2, c: 'woodLight', m: M.wood, seg: 6 }); }
        });
      });
      var eye = armW(9.05, 0.27);
      b.unit(function () {
        // the haul rope from the drum to the eye, and the trigger: an iron hook through the eye, held by a pin across
        // the trough that a lanyard pulls free
        swag(b, [XW + 0.22, YW + 0.12, Z0], [eye[0] - 0.08, eye[1] + 0.02, Z0], 0.05, 0.03);
        b.box(eye[0] + 0.02, DY, Z0, 0.4, 0.08, 0.34, { c: 'iron', m: M.metal, bevel: 0.01 });
        b.beam([eye[0], DY + 0.06, Z0], [eye[0], eye[1] - 0.06, Z0], 0.03, { c: 'iron', m: M.metal, round: true, seg: 6 });
        b.cyl(eye[0] + 0.18, DY + 0.12, Z0 - 0.52, 0.035, 1.2, { rx: Math.PI / 2, c: 'iron', m: M.metal, seg: 6 });
        b.ball(eye[0] + 0.18, DY + 0.12, Z0 + 0.7, 0.06, { c: 'iron', m: M.metal, detail: 0 });
      });

      // ------------------------------------------------------------ the sling, a stone lying in its pouch
      b.part('Sling and stone');
      b.unit(function () {
        b.ball(SPX, 0.6, Z0, 0.36, { sx: 1.2, sy: 0.26, sz: 0.78, c: '#4b3a2c', m: M.wood, detail: 2, smooth: true });
        b.ball(SPX, 0.9, Z0, 0.3, { c: b.pick(PAL.trebuchet_shot), m: M.stone, detail: 1 });
      });
      b.unit(function () {
        var tp = armW(9.35, 0.02), pr = armW(9.7, -0.07);
        [-1, 1].forEach(function (s) { b.beam([SPX - 0.4, 0.66, Z0 + s * 0.15], [tp[0] + 0.06, tp[1] + 0.02, Z0 + s * 0.05], 0.022, { c: 'rope', m: M.rope, round: true, seg: 5 }); });
        b.beam([SPX - 0.42, 0.66, Z0], [pr[0] + 0.03, pr[1] + 0.03, Z0], 0.018, { c: 'rope', m: M.rope, round: true, seg: 5 });
        b.addGeo(new T.TorusGeometry(0.06, 0.018, 4, 8), { x: pr[0] + 0.02, y: pr[1], z: Z0, rx: Math.PI / 2, c: 'iron', m: M.metal, ao: 0 });
      });

      // ------------------------------------------------------------ carvings and shields
      b.part('Dragon heads and shields');
      b.unit(function () { sides.forEach(function (s) { dragonHead(b, X0 - 0.03, YT + 1.17, Z0 + s * SP, 0, 1.0); }); });
      b.unit(function () {
        [-2.3, -1.25, 1.25, 2.3].forEach(function (dx, i) { vShield(b, X0 + dx, R1 - 0.2, Z0 + SP + 0.29, 0, 0.4, ['half', 'ring', 'quarter', 'cross'][i], i % 2 ? 'bone' : 'ink', i % 2 ? 'ink' : 'bone', -0.08); });
      });

      // ------------------------------------------------------------ the shot store: an open shed behind the trough
      b.part('Shot store');
      var shw = 1.65, shd = 1.0, SH = 2.15, sEave = SH + 0.2, sRise = 1.25;
      var shPosts = [[-shw, -shd], [0, -shd], [shw, -shd], [-shw, shd], [0, shd], [shw, shd]];
      b.unit(function () { shPosts.forEach(function (p) { b.box(SHX + p[0], -0.04, SHZ + p[1], 0.44, 0.24, 0.44, { c: b.stoneC('stone'), m: M.stone, bevel: 0.05 }); }); });
      b.unit(function () { shPosts.forEach(function (p) { stave(b, SHX + p[0], 0.2, SHZ + p[1], SH - 0.2, 0.2, { cap: false }); }); });
      b.unit(function () {
        [-1, 1].forEach(function (s) { b.box(SHX, SH, SHZ + s * shd, 2 * shw + 0.34, 0.2, 0.24, { c: 'beam', m: M.wood, bevel: 0.02 }); });
        [-shw, 0, shw].forEach(function (x) { b.box(SHX + x, SH - 0.02, SHZ, 0.18, 0.18, 2 * shd + 0.3, { c: 'beam', m: M.wood, bevel: 0.02 }); });
      });
      [-1, 1].forEach(function (h) {
        b.unit(function () {
          var n = 6, x0 = SHX + (h < 0 ? -shw : 0), w = shw;
          for (var i = 0; i < n; i++) b.box(x0 + (i + 0.5) * w / n, 0.05, SHZ - shd - 0.15, w / n - 0.02, SH - 0.05 + b.j(0.03), 0.07, { c: b.pick(PAL.trebuchet_oak), m: M.wood, bevel: 0.012 });
        });
      });
      b.unit(function () {
        [-1, 1].forEach(function (e) {
          // a plastered gable with a king post and braces, like the halls of the town
          var gx = SHX + e * (shw + 0.18);
          b.gableEnd(SHX + e * (shw + 0.13), sEave, SHZ, 2 * shd + 0.2, sRise - 0.08, 0.07, { c: 'plaster', m: M.plaster });
          b.beam([gx, sEave, SHZ], [gx, sEave + sRise - 0.2, SHZ], 0.02, { c: 'beam', r2: 0.06 });
          [-1, 1].forEach(function (sz) { b.beam([gx, sEave + 0.06, SHZ + sz * 0.9], [gx, sEave + 0.62, SHZ + sz * 0.08], 0.02, { c: 'beam', r2: 0.05 }); });
          b.beam([gx, sEave + 0.04, SHZ - shd - 0.08], [gx, sEave + 0.04, SHZ + shd + 0.08], 0.02, { c: 'beam', r2: 0.05 });
        });
      });
      b.gableRoof(SHX, sEave, SHZ, 2 * shw + 0.3, 2 * shd + 0.24, sRise, { m: 'slate', over: 0.42, rows: 4, overX: 0.3 });
      b.unit(function () { [-1, 1].forEach(function (e) { dragonHead(b, SHX + e * (shw + 0.45), sEave + sRise + 0.1, SHZ, e > 0 ? 0 : Math.PI, 0.72); }); vShield(b, SHX - shw - 0.24, sEave - 0.75, SHZ + 0.45, -Math.PI / 2, 0.34, 'quarter', 'ink', 'bone', 0); vShield(b, SHX - shw - 0.24, sEave - 0.75, SHZ - 0.45, -Math.PI / 2, 0.34, 'half', 'bone', 'ink', 0); });
      b.unit(function () {
        // a cradle of shot along the back wall, pitch barrels and a sledge
        [-1, 1].forEach(function (s) { b.box(SHX, 0, SHZ - 0.55 + s * 0.2, 3.0, 0.18, 0.12, W({ c: 'woodDark' })); });
        for (var i = 0; i < 7; i++) b.ball(SHX - 1.2 + i * 0.4, 0.38, SHZ - 0.55, 0.22, { c: b.pick(PAL.trebuchet_shot), m: M.stone, detail: 1 });
        b.barrel(SHX + 1.05, 0, SHZ + 0.25, { c: '#3a3734' }); b.barrel(SHX + 0.4, 0, SHZ + 0.45, { c: '#3a3734', h: 0.8 });
        b.barrel(SHX - 0.9, 0, SHZ + 0.35, { lie: true, ry: 0.2, c: '#3a3734' });
      });
      b.unit(function () {
        [[SHX - 0.9, 1.45], [SHX + 0.6, 1.55]].forEach(function (p) { b.box(p[0], p[1] + 0.22, SHZ - shd - 0.06, 0.06, 0.06, 0.16, { c: 'woodDark', m: M.wood }); b.addGeo(new T.TorusGeometry(0.26, 0.05, 5, 16), { x: p[0], y: p[1], z: SHZ - shd - 0.06, c: 'rope', m: M.rope }); });
        b.box(SHX + 1.25, 0.9, SHZ - shd - 0.07, 0.34, 0.75, 0.04, { c: '#4b3a2c', m: M.wood, bevel: 0.01 });
        b.torch(SHX + shw, 1.6, SHZ + shd + 0.1, { s: 0.55 });
      });

      // ------------------------------------------------------------ the pile of round shot in its bin
      b.part('Pile of round shot');
      b.unit(function () {
        [-1, 1].forEach(function (s) { b.box(PLX, 0, PLZ + s * 1.02, 2.76, 0.2, 0.16, W({ c: 'woodDark', bevel: 0.02 })); b.box(PLX + s * 1.34, 0, PLZ, 0.16, 0.2, 2.2, W({ c: 'woodDark', bevel: 0.02 })); });
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { b.post(PLX + c[0] * 1.34, 0, PLZ + c[1] * 1.02, 0.09, 0.34, { c: 'woodDark' }); });
      });
      function shotLayer(nx, nz, y, rows) {
        for (var j = 0; j < nz; j++) {
          if (rows && rows.indexOf(j) < 0) continue;
          for (var i = 0; i < nx; i++) b.ball(PLX + (i - (nx - 1) / 2) * 0.6 + b.j(0.015), y + b.j(0.01), PLZ + (j - (nz - 1) / 2) * 0.6 + b.j(0.015), 0.285 + b.j(0.012), { c: b.pick(PAL.trebuchet_shot), m: M.stone, detail: 1, ry: b.r() * 6 });
        }
      }
      b.unit(function () { shotLayer(4, 3, 0.35, [0, 1]); });
      b.unit(function () { shotLayer(4, 3, 0.35, [2]); });
      b.unit(function () { shotLayer(3, 2, 0.745); });
      b.unit(function () { shotLayer(2, 1, 1.14); });

      // ------------------------------------------------------------ the mason dressing shot, and rough blocks
      b.part("Mason's block");
      b.unit(function () {
        b.log(MX, 0, MZ, 0.36, 0.52, { c: 'wood', seg: 9 });
        b.ball(MX, 0.52 + 0.27, MZ, 0.28, { c: b.pick(PAL.trebuchet_shot), m: M.stone, detail: 1 });
        [[0.6, -1.0, 0.4], [1.5, -0.8, -0.3], [-0.2, -1.25, 0.9]].forEach(function (p, i) { b.box(MX + p[0], 0, MZ + p[1], 0.62 - i * 0.08, 0.5 - i * 0.06, 0.55, { c: b.stoneC('stone'), m: M.stone, bevel: 0.09, ry: p[2] }); });
        for (var i = 0; i < 16; i++) { var a = b.r() * 6.28, d = 0.45 + b.r() * 0.7; b.box(MX + Math.cos(a) * d, 0.04, MZ + Math.sin(a) * d, 0.08 + b.r() * 0.08, 0.04, 0.06 + b.r() * 0.06, { c: b.pick(PAL.trebuchet_shot), m: M.stone, bevel: 0.01, ry: b.r() * 3 }); }
      });

      // ------------------------------------------------------------ stores: the cart, pitch and fire, ropes, timber
      b.part('Stores and tools');
      b.unit(function () {
        b.push(0, gy(6.3, 7.1), 0, 0); b.cart(6.3, 7.1, { ry: 4.09, load: function () { [[-0.33, -0.7], [0.33, -0.7], [-0.33, 0], [0.33, 0], [-0.33, 0.7], [0.33, 0.7]].forEach(function (p) { b.ball(p[0], 0.98, p[1], 0.27, { c: b.pick(PAL.trebuchet_shot), m: M.stone, detail: 1 }); }); b.ball(0, 1.36, -0.35, 0.26, { c: b.pick(PAL.trebuchet_shot), m: M.stone, detail: 1 }); b.ball(0, 1.36, 0.35, 0.26, { c: b.pick(PAL.trebuchet_shot), m: M.stone, detail: 1 }); } }); b.pop();
      });
      b.unit(function () {
        // a pot of pitch on an iron trivet over a few coals, a ladle in it
        var px = -3.9, pz = 3.2;
        [0, 2.1, 4.2].forEach(function (a) { b.beam([px + Math.cos(a) * 0.38, 0, pz + Math.sin(a) * 0.38], [px + Math.cos(a) * 0.22, 0.42, pz + Math.sin(a) * 0.22], 0.025, { c: 'iron', m: M.metal }); });
        b.addGeo(new T.TorusGeometry(0.24, 0.025, 4, 14), { x: px, y: 0.42, z: pz, rx: Math.PI / 2, c: 'iron', m: M.metal, ao: 0 });
        b.lathe(px, 0.3, pz, [[0.02, 0], [0.2, 0.03], [0.29, 0.16], [0.3, 0.34], [0.27, 0.4], [0.25, 0.37]], { c: '#2a2b2e', m: M.metal, seg: 14 });
        b.cyl(px, 0.6, pz, 0.255, 0.02, { c: '#121212', m: M.dark, seg: 14 });
        b.beam([px + 0.05, 0.62, pz], [px + 0.42, 1.05, pz + 0.1], 0.018, { c: 'woodLight', m: M.wood, round: true, seg: 5 });
        b.embers(px, 0.04, pz, 0.2, { light: false });
        b.light(px, 0.5, pz, '#ff7a2a', 0.8);
        b.barrel(-4.9, 0, 3.4, { c: '#2f2d2a' }); b.barrel(-5.0, 0, 2.7, { c: '#2f2d2a', lie: true, ry: 1.1 }); b.crate(-4.4, 0, 4.1, 0.6, { ry: 0.3 });
        b.bucket(-3.3, 0, 3.8);
      });
      b.unit(function () {
        b.ropeCoil(-7.6, FY, -2.9, 0.32); b.ropeCoil(-7.5, FY + 0.1, -2.9, 0.26); b.ropeCoil(5.8, FY, -2.6, 0.3);
        b.bucket(X0 + 0.6, FY, Z0 + SP + 0.75);
        b.ladder(X0 - 0.55, FY, Z0 + SP + 0.22, 6.1, { w: 0.5, lean: 0.24 });
      });
      b.unit(function () {
        // spare timbers for a new arm, stacked on chocks
        [-1, 1].forEach(function (s) { b.box(-3.0 + s * 1.2, 0, -5.3, 0.3, 0.16, 1.4, W({ c: 'woodDark' })); });
        for (var r = 0; r < 3; r++) for (var i = 0; i < 3 - r; i++) b.box(-3.0 + b.j(0.1), 0.16 + r * 0.3, -5.3 + (i - (2 - r) / 2) * 0.34, 3.4 - r * 0.3, 0.3, 0.3, W({ c: b.pick(PAL.trebuchet_oakPale), bevel: 0.03 }));
        b.woodpile(7.6, -4.8, { n: 4, len: 1.6, ry: 0.3 });
      });
      b.unit(function () { b.torch(X0, 2.4, Z0 + SP + 0.19, { s: 0.6 }); });
      b.unit(function () {
        // a trestle where a new sling is being made: the leather pouch, its cords laid out, a fid and a coil
        var tx = -5.9, tz = 5.4;
        b.table(tx, tz, 1.7, 0.75, { ry: 0.1 });
        b.push(tx, 0.81, tz, 0.1);
        b.ball(-0.25, 0.015, 0, 0.3, { sx: 1.1, sy: 0.12, sz: 0.7, c: '#4b3a2c', m: M.wood, detail: 2, smooth: true });
        [-0.08, 0.08].forEach(function (dz) { b.beam([0.05, 0.025, dz], [0.78, 0.025, dz * 1.6], 0.018, { c: 'rope', m: M.rope, round: true, seg: 5 }); });
        b.ropeCoil(-0.64, 0.0, 0.2, 0.12);
        b.beam([0.3, 0.02, -0.26], [0.56, 0.02, -0.23], 0.015, { c: 'iron', m: M.metal, round: true, seg: 5 });
        b.pop();
        b.crate(tx + 1.32, 0, tz - 0.55, 0.55, { ry: 0.4 });
        b.bucket(tx - 1.15, 0, tz + 0.15);
      });
      b.unit(function () {
        // a rack of handspikes for heaving the great frame round to bear
        var hx = -3.3, hz = 5.75;
        [-0.85, 0.85].forEach(function (dx) { [-1, 1].forEach(function (s) { b.beam([hx + dx, 0, hz + s * 0.3], [hx + dx, 0.64, hz - s * 0.06], 0.04, W({ c: 'woodDark' })); }); });
        for (var i = 0; i < 4; i++) b.beam([hx - 1.25, 0.66 + (i % 2) * 0.03, hz - 0.15 + i * 0.1], [hx + 1.25, 0.66 + (i % 2) * 0.03, hz - 0.15 + i * 0.1], 0.045, W({ c: pale, round: true, seg: 7 }));
      });

      // ------------------------------------------------------------ out on the grass: rough blocks on a quarry sledge, spare shot
      b.part('Quarry sledge');
      function gy(x, z) { return b.ground ? b.ground.height(x + OX, z + OZ) : 0; }
      b.unit(function () {
        var qx = -4.4, qz = 7.5, qy = gy(qx, qz) - 0.03, ry = 0.35;
        b.push(qx, qy, qz, ry);
        [-1, 1].forEach(function (s) { b.box(0, 0, s * 0.55, 2.6, 0.16, 0.16, W({ c: 'woodDark', bevel: 0.03 })); b.box(1.32, 0.02, s * 0.55, 0.3, 0.12, 0.16, W({ c: 'woodDark', bevel: 0.03, rz: 0.5 })); });
        for (var i = 0; i < 7; i++) b.box(-1.1 + i * 0.36, 0.16, 0, 0.3, 0.06, 1.36, { c: b.pick(PAL.trebuchet_oakPale), m: M.wood, bevel: 0.01 });
        [[-0.6, 0.0, 0.66, 0.6, 0.62, 0.2], [0.35, -0.1, 0.58, 0.52, 0.7, -0.3], [-0.2, 0.62, 0.5, 0.42, 0.46, 0.5]].forEach(function (q) { b.box(q[0], 0.22 + (q[1] > 0.3 ? 0.55 : 0), q[1] > 0.3 ? -0.05 : q[1], q[2], q[3], q[4], { c: b.stoneC('stone'), m: M.stone, bevel: 0.08, ry: q[5] }); });
        swag(b, [1.4, 0.12, -0.45], [1.4, 0.12, 0.45], 0.0, 0.025);
        swag(b, [1.4, 0.12, 0.0], [2.6, 0.02, 0.4], 0.05, 0.025);
        b.ropeCoil(2.75, -0.02, 0.5, 0.22);
        b.pop();
      });
      b.unit(function () {
        [[3.3, 7.2], [3.9, 7.35], [3.6, 7.75]].forEach(function (p) { b.ball(p[0], gy(p[0], p[1]) + 0.24, p[1], 0.27, { c: b.pick(PAL.trebuchet_shot), m: M.stone, detail: 1 }); });
        b.ball(3.6, gy(3.6, 7.4) + 0.62, 7.42, 0.26, { c: b.pick(PAL.trebuchet_shot), m: M.stone, detail: 1 });
      });

      // ------------------------------------------------------------ the banner, raised on its pole
      b.part('Banner');
      var BX = 8.0, BZ = 4.4;
      b.unit(function () { b.box(BX, 0, BZ, 0.5, 0.26, 0.5, { c: b.stoneC('stone'), m: M.stone, bevel: 0.06 }); b.log(BX, 0.26, BZ, 0.08, 5.45, { c: 'woodDark' }); });
      b.unit(function () { b.banner(BX, 5.3, BZ + 0.12, 1.15, 2.7, { c: 'ink', emblem: 'swords', ec: '#f1eee8', es: 0.8, tail: 'swallow', band: 'ember', bandAt: 0.74, bandH: 0.05, trim: 'iron', ry: 0 }); });
      b.unit(function () { b.flag(BX, 5.71, BZ, 0.8, 0.9, 0.34, { c: 'ember', pennant: true, emblem: 'none', ry: -0.5 }); });

      // ------------------------------------------------------------ the crew
      b.life(function () {
        // turning the windlass by the handle on the front wheel
        b.figure(XW - WR, Z0 + 1.8 + 0.43 + 0.47, { role: 'villager', pose: 'trebuchet_crank', ry: Math.PI, y: FY, c: '#5c5e62' });
        // holding the trigger lanyard, waiting on the word
        var lx = -5.15, lz = 1.8, lry = Math.atan2(eye[0] + 0.18 - lx, Z0 + 0.7 - lz);
        b.figure(lx, lz, { role: 'villager', pose: 'trebuchet_lanyard', ry: lry, y: FY, c: '#3b3a38' });
        var lh = fwd(lx, FY, lz, lry, 0.0, 0.97, 0.33);
        swag(b, lh, [eye[0] + 0.18, DY + 0.12, Z0 + 0.72], 0.18, 0.014);
        // settling the stone in the sling
        b.figure(SPX + 0.5, Z0 + 0.78, { role: 'villager', pose: 'trebuchet_stoop', ry: Math.atan2(-0.5, -0.78), y: DY, c: '#5c5e62' });
        // two carrying a stone on a hand-barrow from the cart to the pile
        var bz = 3.75, xf = 0.35, xb = -2.05;
        b.figure(xf, bz, { role: 'villager', pose: 'trebuchet_barrowFront', ry: Math.PI / 2, c: '#6f6a62' });
        b.figure(xb, bz, { role: 'villager', pose: 'trebuchet_barrowBack', ry: Math.PI / 2, c: '#4a4c50' });
        [-1, 1].forEach(function (s) { b.beam([xb + 0.2, 0.86, bz + s * 0.3], [xf + 0.02, 0.86, bz + s * 0.3], 0.035, { c: 'woodLight', m: M.wood, round: true, seg: 6 }); });
        for (var i = 0; i < 5; i++) b.box(-1.2 + i * 0.17, 0.88, bz, 0.12, 0.04, 0.64, { c: 'wood', m: M.wood, bevel: 0.01 });
        b.ball(-0.86, 1.2, bz, 0.28, { c: b.pick(PAL.trebuchet_shot), m: M.stone, detail: 1 });
        // the mason, dressing a ball with mallet and chisel
        var mx = MX + 0.72, mz = MZ - 0.05, mry = -Math.PI / 2;
        b.figure(mx, mz, { role: 'villager', pose: 'hammer', ry: mry, c: '#8a857c', beard: true });
        var rh = fwd(mx, 0, mz, mry, -0.24, 1.78, 0.1), lhand = fwd(mx, 0, mz, mry, 0.1, 1.0, 0.45);
        mallet(b, rh, [0.6, 0.55, 0.05], 0.38);
        b.beam(lhand, [MX + 0.17, 1.0, MZ + 0.02], 0.014, { c: 'iron', m: M.metal, round: true, seg: 5 });
        // the master of the engine, calling to the windlass crew
        b.figure(4.3, 2.1, { role: 'villager', pose: 'point', ry: -0.6, y: FY, cape: '#1f1e1c', c: '#3b3a38', beard: true });
        // climbing the ladder to grease the axle, a pot of tallow on his belt
        var Zl = Z0 + SP + 0.22, ky = 7, ry0 = ky * 0.33, rz = Zl + 0.44 * (1 - ry0 / 6.1), cyb = ry0 + 0.025 + FY;
        b.figure(X0 - 0.55, rz + 0.13, { role: 'villager', pose: 'trebuchet_climb', ry: Math.PI, y: cyb, c: '#6f6a62' });
        b.lathe(X0 - 0.55 + 0.2, cyb + 0.72, rz + 0.3, [[0.01, 0], [0.09, 0.01], [0.1, 0.14], [0.08, 0.16]], { c: '#2a2b2e', m: M.metal, seg: 10 });
        // splicing the cords of a new sling at the trestle
        b.figure(-5.9 - 0.06, 5.4 - 0.62, { role: 'villager', pose: 'trebuchet_splice', ry: 0.1, c: '#4a4c50', beard: true });
        // a child come to watch
        b.figure(-1.4, 5.7, { role: 'child', pose: 'cheer', ry: Math.PI - 0.5, toy: false });
      });
      b.pop();
    }
  });
})();
