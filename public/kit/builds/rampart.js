// Moroni's rampart (Alma 50:1-4): a long curved ridge of heaped earth thrown up from a ditch, faced with turf laid
// course by course (some courses in herringbone, the Norse way), topped with a breastwork of logs to the height of a
// man, a frame of sharpened pickets on the logs and a plank walkway behind them, and timber towers rising above the
// works with roofed places of security on top. A gate cuts through the ridge under the tallest tower, with a plank
// bridge over the ditch. Built: the ditch and its spoil bank, the ridge in three lifts, the turf facing, the gate
// passage, the breastwork log by log, the walkway, the pickets, the bridge and gate, the towers, then the stores
// and the people.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL, U = KIT.util;
  PAL.rampart_turf = ['#626a47', '#5a6142', '#6b6748', '#706549', '#5e5840', '#676f4b', '#5b5541'];
  PAL.rampart_turfDark = ['#5a4c3a', '#615240', '#54493a', '#5d5341'];
  PAL.rampart_grass = ['#66744f', '#5f6d4a', '#6f7c55', '#5a6747'];
  PAL.rampart_log = ['#6f5d4b', '#665545', '#75624f', '#5e4e40', '#6a5848'];
  PAL.rampart_plank = ['#5b4a3c', '#544437', '#634f3f', '#4d3f33', '#5f5042'];
  PAL.rampart_rock = ['#7c776d', '#857f74', '#6f6a62', '#8d877b', '#767067'];
  // the gate tower's slates: charcoal leaning warm and a little more spread, so the slope turned from the sun reads as
  // dark slate rather than a flat navy plane
  PAL.rampart_slate = ['#47423d', '#55504a', '#3e3a36', '#5e5852', '#433f3b', '#4f4a44'];
  PAL.rampart_deck = ['#8a7863', '#7f6e5a', '#938069', '#776753'];

  // the works follow an arc round a centre behind the island: angle th (0 = straight out to the front, + toward +x),
  // n metres outward from the breastwork line, y up
  // the whole works are laid out in their own frame, then turned by ROT about the island's centre so the ridge faces
  // the viewer broadside while the low sun still rakes across its face
  var CX = 0, CZ = -28.0, RW = 30, YB = 2.05, YD = 3.05, TG = 0.03, GW = 1.25, END = 0.31, TL = -0.27, TR = 0.27, ROT = -0.2, YPG = 8.2, YPW = 7.0, YPE = 7.3;
  var RC = Math.cos(ROT), RS_ = Math.sin(ROT);
  function W(th, n, y) { var r = RW + n; return [CX + r * Math.sin(th), y, CZ + r * Math.cos(th)]; }
  // a point in the works' frame to the island's, and back
  function toW(p) { return [p[0] * RC + p[2] * RS_, p[1], -p[0] * RS_ + p[2] * RC]; }
  function toL(x, z) { return [x * RC - z * RS_, x * RS_ + z * RC]; }
  function locN(x, z) { var l = toL(x, z); return { n: Math.hypot(l[0] - CX, l[1] - CZ) - RW, th: Math.atan2(l[0] - CX, l[1] - CZ) }; }
  function ang(f, r) { return typeof f === 'function' ? f(r) : f; }
  function cutL(w) { return function (r) { return TG - Math.asin(w / r); }; }
  function cutR(w) { return function (r) { return TG + Math.asin(w / r); }; }
  function fr(b, th, n, y) { var p = W(th, n, y || 0); b.push(p[0], p[1], p[2], th); }

  // the ridge's cross-section, inner toe to outer toe; the spoil bank beyond the ditch; the ditch floor
  var BANK = [[-3.5, 0], [-3.05, 0.42], [-2.6, 1.05], [-2.2, 1.62], [-1.9, 1.95], [-1.5, 2.04], [-0.6, 2.07], [0.3, 2.06], [0.48, 2.0], [0.62, 1.8], [0.84, 1.38], [1.06, 0.9], [1.27, 0.44], [1.47, 0]];
  var GLACIS = [[4.15, 0], [4.3, 0.4], [4.5, 0.76], [4.8, 0.96], [5.3, 1.0], [5.9, 0.86], [6.6, 0.55], [7.3, 0.24], [7.9, 0.06], [8.2, 0]];
  // standing water along the bottom of the ditch, a muddy margin each side
  var WATER = [[1.92, 0.015], [1.98, 0.065], [3.8, 0.065], [3.86, 0.015]];
  var DITCH = [[1.2, 0], [1.45, 0.025], [2.8, 0.03], [4.3, 0.025], [4.55, 0]];
  function glacisH(n) { for (var i = 0; i < GLACIS.length - 1; i++) { var a = GLACIS[i], c = GLACIS[i + 1]; if (n >= a[0] && n <= c[0]) return U.lerp(a[1], c[1], (n - a[0]) / (c[0] - a[0])); } return 0; }
  function bankH(n) { for (var i = 0; i < BANK.length - 1; i++) { var a = BANK[i], c = BANK[i + 1]; if (n >= a[0] && n <= c[0]) return U.lerp(a[1], c[1], (n - a[0]) / (c[0] - a[0])); } return 0; }

  function rampartBankC(x, y, z) {
    var L = locN(x, z), n = L.n, q = U.noise3(x * 0.7, y * 0.9, z * 0.7), q2 = U.noise3(x * 2.3 + 7, y * 2.3, z * 2.3);
    var c = new T.Color('#86704f').lerp(new T.Color('#9a8464'), U.clamp(q * 1.5 + 0.5, 0, 1));
    c.lerp(new T.Color('#6b5842'), U.clamp(-q2 * 1.6, 0, 1) * 0.5);
    if (n < -1.85) c.lerp(new T.Color('#68724c'), U.smooth(0.05, 0.4, q2 + (1.1 - y) * 0.25) * 0.85);
    if (y > 1.9 && n > -1.9) c.lerp(new T.Color('#a08d70'), 0.3);
    // the old ends of the ridge, past the towers, have grassed over
    c.lerp(new T.Color('#647049').lerp(new T.Color('#55613f'), U.clamp(q2 + 0.3, 0, 1)), U.smooth(END + 0.015, END + 0.05, Math.abs(L.th - TG * 0)) * 0.85);
    return c;
  }
  function rampartGlacisC(x, y, z) {
    var n = locN(x, z).n, q = U.noise3(x * 0.5 + 2, 1.3, z * 0.5), q2 = U.noise3(x * 1.9, y * 2, z * 1.9);
    var g = new T.Color('#5d6b4c').lerp(new T.Color('#76805e'), U.clamp(q * 1.2 + 0.35, 0, 1) * 0.4).lerp(new T.Color('#4a5842'), U.clamp(-q * 1.5, 0, 1) * 0.6);
    var e = new T.Color('#7d6a50').lerp(new T.Color('#6a5843'), U.clamp(q2 + 0.4, 0, 1) * 0.6);
    return e.lerp(g, U.smooth(4.7, 5.1, n + q2 * 0.25));
  }
  function rampartMudC(x, y, z) {
    var q = U.noise3(x * 0.9, 0.5, z * 0.9);
    return new T.Color('#564c40').lerp(new T.Color('#443c33'), U.clamp(q + 0.4, 0, 1) * 0.7);
  }
  function rampartWaterC(x, y, z) {
    var q = U.noise3(x * 0.35, 2.5, z * 0.35), q2 = U.noise3(x * 1.7, 4.1, z * 1.7);
    return new T.Color('#3d4644').lerp(new T.Color('#56605c'), U.clamp(q * 1.2 + 0.4, 0, 1) * 0.55).lerp(new T.Color('#6d7671'), U.smooth(0.35, 0.6, q2) * 0.35);
  }

  // Sweep a cross-section along the arc from angle a to bb (either may be a function of radius, so an end can be cut
  // square to the gate). o: tap0 / tap1 (radians over which the ridge sinks into the ground at that end), sn / sy
  // (scale of the section about n0, for the lower lifts), cutA / cutB (close that end with a cap), noise, colors.
  function rampartSweep(b, prof, a, bb, o) {
    o = o || {};
    var Pn = prof.length, n0 = o.n0 || 0, sn = o.sn || 1, sy = o.sy || 1, amp = o.noise === undefined ? 0.07 : o.noise;
    var S = Math.max(4, Math.ceil((ang(bb, RW) - ang(a, RW)) * RW / (o.step || 0.3))), pos = [], idx = [], i, j;
    for (j = 0; j <= S; j++) for (i = 0; i < Pn; i++) {
      var n = n0 + (prof[i][0] - n0) * sn, y = prof[i][1] * sy, r = RW + n;
      var A = ang(a, r), B2 = ang(bb, r), th = A + (B2 - A) * j / S;
      var k = 1; if (o.tap0) k *= U.smooth(A, A + o.tap0, th); if (o.tap1) k *= U.smooth(B2, B2 - o.tap1, th);
      var x0 = CX + r * Math.sin(th), z0 = CZ + r * Math.cos(th), edge = (j === 0 && o.cutA) || (j === S && o.cutB);
      var aa = (o.ampFn ? o.ampFn(n) : 1) * amp;
      if (prof[i][1] > 0.012 && !edge) { y += U.noise3(x0 * 0.8 + 3.1, y * 0.8, z0 * 0.8) * aa * 1.2; r += U.noise3(x0 * 0.6, y * 0.6 + 5.3, z0 * 0.6) * aa; }
      if (prof[i][1] <= 0.012) y = -0.05;
      y = y * k - (1 - k) * 0.3;
      pos.push(CX + r * Math.sin(th), y, CZ + r * Math.cos(th));
    }
    for (j = 0; j < S; j++) for (i = 0; i < Pn - 1; i++) { var v00 = j * Pn + i, v10 = v00 + 1, v01 = v00 + Pn, v11 = v01 + 1; idx.push(v00, v10, v11, v00, v11, v01); }
    function cap(jj, flip) {
      var c = pos.length / 3, p0 = jj * Pn, pl = p0 + Pn - 1;
      pos.push((pos[p0 * 3] + pos[pl * 3]) / 2, -0.05, (pos[p0 * 3 + 2] + pos[pl * 3 + 2]) / 2);
      for (var q = 0; q < Pn - 1; q++) { if (flip) idx.push(c, p0 + q + 1, p0 + q); else idx.push(c, p0 + q, p0 + q + 1); }
    }
    if (o.cutA) cap(0, true); if (o.cutB) cap(S, false);
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    g = KIT.geo.flat(g);
    b.addGeo(g, { c: '#ffffff', m: o.m === undefined ? M.dirt : o.m, ao: o.ao === undefined ? 0.25 : o.ao, jit: 0, vary: 0.06, colors: o.colors || rampartBankC });
  }

  // a square stave post with carved collars and a cap
  function rampartStave(b, x, y, z, h, w, o) {
    o = o || {}; var c = o.c || 'beam', ry = o.ry || 0;
    b.box(x, y, z, w, h, w, { c: c, m: M.wood, bevel: w * 0.12, ry: ry });
    [0.16, h - 0.42].forEach(function (yy) { b.box(x, y + yy, z, w * 1.28, 0.07, w * 1.28, { c: c, m: M.wood, bevel: 0.015, ry: ry }); });
    if (o.cap !== false) b.box(x, y + h, z, w * 1.3, 0.12, w * 1.3, { c: c, m: M.wood, taper: 0.55, ry: ry });
    if (o.knob) b.ball(x, y + h + 0.15, z, w * 0.42, { c: c, m: M.wood, detail: 1 });
  }
  // a sharpened stake from a to the point c: a shaft and a freshly cut point
  function rampartStake(b, a, c, r, o) {
    o = o || {}; var f = o.tip || 0.8, m = [a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f, a[2] + (c[2] - a[2]) * f];
    b.beam(a, m, r, { round: true, seg: 7, c: o.c || b.pick(PAL.rampart_log), m: M.wood });
    b.beam(m, c, r, { round: true, seg: 7, r2: 0.008, c: o.tipC || '#c9b48f', m: M.wood });
  }
  // a carved dragon-head finial in the XY plane, snout toward local +x, neck foot at (x, y, z), turned by ry, s tall
  var HEAD = [[-0.1, 0], [0.1, 0], [0.12, 0.2], [0.17, 0.42], [0.26, 0.58], [0.42, 0.63], [0.62, 0.64], [0.8, 0.66], [0.78, 0.71], [0.6, 0.72], [0.46, 0.76], [0.62, 0.8], [0.84, 0.83], [0.87, 0.89], [0.8, 0.92], [0.62, 0.94], [0.5, 0.98], [0.42, 1.04], [0.2, 1.3], [0.29, 1.04], [0.15, 1.13], [0.16, 0.98], [0.06, 0.93], [-0.01, 0.95], [-0.02, 0.85], [-0.09, 0.82], [-0.06, 0.71], [-0.13, 0.64], [-0.1, 0.53], [-0.16, 0.44], [-0.12, 0.33], [-0.13, 0.15]];
  function rampartHead(b, x, y, z, ry, s, o) {
    o = o || {};
    b.push(x, y, z, ry);
    b.extrude(0, 0, 0, HEAD.map(function (p) { return [p[0] * s, p[1] * s]; }), 0.13 * s, { c: o.c || 'woodDark', m: M.wood, bevel: 0.012 * s });
    b.box(0.02 * s, 0.3 * s, 0, 0.3 * s, 0.06 * s, 0.17 * s, { c: o.c || 'woodDark', m: M.wood, bevel: 0.01 * s, rz: 0.15 });
    [-1, 1].forEach(function (sd) { b.ball(0.53 * s, 0.89 * s, sd * 0.075 * s, 0.03 * s, { c: '#e9e4da', m: M.paint, detail: 0, ao: 0 }); });
    [0.56, 0.66, 0.76].forEach(function (tx) { b.extrude(tx * s, 0.72 * s, 0, [[-0.025 * s, 0], [0.025 * s, 0], [0, 0.06 * s]], 0.05 * s, { c: '#e9e4da', m: M.paint, ao: 0 }); });
    b.pop();
  }
  // a round Norse shield facing local +z: a painted field, a pattern in the other colour, an iron rim and boss
  function rampartShield(b, x, y, z, ry, r, kind, fc, pc, tilt) {
    b.push(x, y, z, ry);
    if (tilt) b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationX(tilt));
    b.cyl(0, 0, 0, r, 0.05, { rx: Math.PI / 2, c: fc, m: M.paint, seg: 24, flat: true });
    var arc = function (a0, a1, rr) { var p = [[0, 0]]; for (var i = 0; i <= 10; i++) { var a = a0 + (a1 - a0) * i / 10; p.push([Math.cos(a) * rr, Math.sin(a) * rr]); } return p; };
    var rr = r * 0.95;
    if (kind === 'half') b.extrude(0, 0, 0.056, arc(0, Math.PI, rr), 0.008, { c: pc, m: M.paint });
    else if (kind === 'quarter') { b.extrude(0, 0, 0.056, arc(0, Math.PI / 2, rr), 0.008, { c: pc, m: M.paint }); b.extrude(0, 0, 0.056, arc(Math.PI, Math.PI * 1.5, rr), 0.008, { c: pc, m: M.paint }); }
    else if (kind === 'cross') { b.box(0, -rr, 0.052, r * 0.24, rr * 2, 0.008, { c: pc, m: M.paint, bevel: 0 }); b.box(0, -r * 0.12, 0.052, rr * 2, r * 0.24, 0.008, { c: pc, m: M.paint, bevel: 0 }); }
    b.addGeo(new T.TorusGeometry(r, 0.024, 4, 28), { z: 0.03, c: 'iron', m: M.metal, ao: 0 });
    b.ball(0, 0, 0.065, r * 0.21, { c: 'iron', m: M.metal, sz: 0.6, detail: 1 });
    b.pop();
  }
  // a gate leaf hinged on a vertical axis at (hx, y0, hz), w wide, h tall; sgn +1 hung on the left of the opening;
  // th = how far it stands open, swinging toward local -z
  function rampartLeaf(b, hx, y0, hz, sgn, th, w, h) {
    var n = Math.max(3, Math.round(w / 0.24)), pw = w / n;
    b.push(hx, y0, hz, sgn * th);
    for (var i = 0; i < n; i++) { var top = h + (i % 2 ? 0.06 : 0); b.box(sgn * pw * (i + 0.5), 0, -0.04, pw - 0.02, top, 0.08, { c: b.pick(PAL.rampart_plank), m: M.wood, bevel: 0.012, ao: 0.35 }); b.cone(sgn * pw * (i + 0.5), top, -0.04, pw * 0.42, 0.14, { c: b.pick(PAL.rampart_plank), m: M.wood, seg: 4, flat: true }); }
    [0.35, h - 0.45].forEach(function (yy) { b.box(sgn * w / 2, yy, 0.03, w - 0.06, 0.15, 0.05, { c: 'woodDark', m: M.wood, bevel: 0.015 }); b.box(sgn * w * 0.32, yy + 0.05, 0.06, w * 0.62, 0.05, 0.014, { c: 'iron', m: M.metal, bevel: 0.004 }); });
    b.beam([sgn * 0.14, 0.5, 0.03], [sgn * (w - 0.14), h - 0.45, 0.03], 0.05, { c: 'woodDark', r2: 0.022 });
    b.pop();
  }

  var HERR = (function () { var g = KIT.geo.chamferBox(0.44, 0.13, 0.38, 0.03).clone(); g.translate(0, -0.065, 0); return g; })();
  // one course of the turf facing on the ridge's outer face, from angle a to bb. Courses step back as they rise; the
  // second and fourth are laid in herringbone, the top one is turned grass up.
  function rampartCourse(b, k, a, bb) {
    var CH = 0.35, y0 = k * CH, nf = 1.76 - k * 0.19, nc = nf - 0.21, r = RW + nc, A = ang(a, r), B2 = ang(bb, r), L = (B2 - A) * r;
    if (k === 1 || k === 3) {
      var sp = 0.2, cnt = Math.floor((L - 0.3) / sp), tilt = k === 1 ? 0.58 : -0.58;
      for (var i = 0; i <= cnt; i++) {
        var th = A + (0.15 + i * sp) / r, p = W(th, nc + b.j(0.02), y0 + CH / 2 + b.j(0.01));
        b.addGeo(HERR, { x: p[0], y: p[1], z: p[2], ry: th + b.j(0.03), rz: tilt + b.j(0.06), c: b.pick(PAL[b.r() < 0.6 ? 'rampart_turfDark' : 'rampart_turf']), m: M.dirt, ao: 0.15, jit: 0.03 });
      }
      return;
    }
    var s = 0, first = true;
    while (s < L - 0.12) {
      var l = first ? 0.22 + (k % 3) * 0.16 : 0.5 + b.r() * 0.24; l = Math.min(l, L - s); first = false;
      var th2 = A + (s + l / 2) / r, hh = CH * (0.92 + b.j(0.04)), p2 = W(th2, nc + b.j(0.025), y0 + (CH - hh) / 2);
      b.box(p2[0], p2[1], p2[2], l - 0.045, hh, 0.42, { ry: th2 + b.j(0.015), rz: b.j(0.02), c: b.pick(PAL[k === 5 ? 'rampart_grass' : k === 0 ? 'rampart_turfDark' : 'rampart_turf']), m: M.dirt, bevel: 0.05, ao: 0.15, jit: 0.03 });
      if (k === 5 && b.r() < 0.35) { var pg = W(th2 + b.j(0.2 / r), nf - 0.12, y0 + hh); b.grass(pg[0], pg[1] + 0.03, pg[2], 0.28 + b.r() * 0.15); }
      s += l;
    }
  }

  // the stretches of the works between the end towers and the gate
  var SPANS = [[-END, -0.205], [-0.205, -0.1], [-0.1, cutL(GW - 0.08)], [cutR(GW - 0.08), 0.19], [0.19, END]];
  var NLOG = -0.17;
  var STATIONS = SPANS.map(function (sp) { var r = RW + NLOG, A = ang(sp[0], r), B2 = ang(sp[1], r), N = Math.max(1, Math.round((B2 - A) * r / 1.6)), out = []; for (var i = 0; i <= N; i++) out.push(A + (B2 - A) * i / N); return out; });

  // A timber tower over the works at angle th: four stave posts on the ridge, braced, a jettied platform with a
  // plank breastwork round it (the place of security), and a slate roof on the posts with dragon-head gables.
  // o: { name, w (along the wall), d (across), n0, yP (platform), rise, axis ('x' ridge along the wall, 'z' across) }
  function rampartTower(b, th, o) {
    var w = o.w, d = o.d, hw = w / 2, hd = d / 2, yP = o.yP, yE = yP + 2.0, ps = 0.3, jet = 0.34, yG = 4.75, nm = o.name;
    fr(b, th, o.n0, 0);
    var C = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
    b.part(nm + ', posts');
    b.unit(function () { C.forEach(function (c) { b.box(c[0], YB - 0.4, c[1], ps + 0.22, 0.42, ps + 0.22, { c: b.stoneC('stoneDark'), m: M.stone, bevel: 0.05 }); rampartStave(b, c[0], YB, c[1], yE - YB, ps, { cap: false }); }); });
    b.part(nm + ', bracing');
    b.unit(function () {
      [-1, 1].forEach(function (s) {
        var z = s * (hd + ps / 2 + 0.05);
        b.beam([-hw - 0.15, yG, z], [hw + 0.15, yG, z], 0.09, { c: 'beam' });
        b.beam([-hw, yG + 0.12, z], [hw, yP - 0.35, z], 0.07, { c: 'beam' }); b.beam([hw, yG + 0.12, z], [-hw, yP - 0.35, z], 0.07, { c: 'beam' });
        if (s < 0 || !o.gate) { b.beam([-hw, YB + 0.35, z], [hw, yG - 0.12, z], 0.07, { c: 'beam' }); b.beam([hw, YB + 0.35, z], [-hw, yG - 0.12, z], 0.07, { c: 'beam' }); }
      });
      [-1, 1].forEach(function (s) {
        var x = s * (hw + ps / 2 + 0.05);
        b.beam([x, yG, -hd - 0.15], [x, yG, hd + 0.15], 0.09, { c: 'beam' });
        b.beam([x, yG + 0.12, -hd], [x, yP - 0.35, hd], 0.07, { c: 'beam' }); b.beam([x, yG + 0.12, hd], [x, yP - 0.35, -hd], 0.07, { c: 'beam' });
      });
    });
    b.part(nm + ', platform');
    var PW = w + 2 * jet, PD = d + 2 * jet;
    b.unit(function () {
      [-1, 1].forEach(function (s) { b.box(0, yP - 0.5, s * hd, PW + 0.1, 0.24, 0.26, { c: 'beam', m: M.wood, bevel: 0.03 }); });
      var nj = Math.round(PW / 0.55);
      for (var i = 0; i <= nj; i++) { var x = -PW / 2 + 0.1 + i * (PW - 0.2) / nj; b.box(x, yP - 0.26, 0, 0.15, 0.18, PD, { c: 'beam', m: M.wood, bevel: 0.02 }); }
      C.forEach(function (c) { [[Math.sign(c[0]), 0], [0, Math.sign(c[1])]].forEach(function (dv) { b.beam([c[0] + dv[0] * 0.12, yP - 1.1, c[1] + dv[1] * 0.12], [c[0] + dv[0] * jet * 0.95, yP - 0.3, c[1] + dv[1] * jet * 0.95], 0.06, { c: 'beam' }); }); });
    });
    b.unit(function () { for (var z = -PD / 2 + 0.12; z < PD / 2 - 0.05; z += 0.25) b.box(b.j(0.02), yP - 0.08, z, PW - 0.04 + b.j(0.04), 0.08, 0.23, { c: b.pick(PAL.rampart_deck), m: M.wood, bevel: 0.012 }); });
    b.part(nm + ', place of security');
    function wall(side) {
      // the plank breastwork on one side: a slit every fourth plank, a rail along the top
      var alongX = side === 'front' || side === 'back', sg = side === 'front' || side === 'right' ? 1 : -1, L = alongX ? PW : PD, off = (alongX ? PD : PW) / 2 - 0.04;
      var n = Math.round(L / 0.24), pw = L / n, y0 = yP, h = 1.15;
      for (var i = 0; i < n; i++) {
        var t = -L / 2 + (i + 0.5) * pw, slit = i % 4 === 2;
        var px = alongX ? t : sg * off, pz = alongX ? sg * off : t, ry = alongX ? 0 : Math.PI / 2, c = b.pick(PAL.rampart_plank);
        if (slit) { b.box(px, y0 - 0.02, pz, pw - 0.02, 0.45, 0.07, { ry: ry, c: c, m: M.wood, bevel: 0.01 }); b.box(px, y0 + 0.95, pz, pw - 0.02, h - 0.95, 0.07, { ry: ry, c: c, m: M.wood, bevel: 0.01 }); }
        else b.box(px, y0 - 0.02, pz, pw - 0.02, h + b.j(0.02), 0.07, { ry: ry, c: c, m: M.wood, bevel: 0.01 });
      }
      var a0 = alongX ? [-L / 2, y0 + h, sg * (off + 0.02)] : [sg * (off + 0.02), y0 + h, -L / 2], a1 = alongX ? [L / 2, y0 + h, sg * (off + 0.02)] : [sg * (off + 0.02), y0 + h, L / 2];
      b.beam(a0, a1, 0.07, { c: 'beam' });
    }
    b.unit(function () { wall('front'); wall('left'); [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (c) { b.post(c[0] * (PW / 2 - 0.04), yP - 0.45, c[1] * (PD / 2 - 0.04), 0.08, 1.7, { c: 'beam' }); }); });
    b.unit(function () { wall('back'); wall('right'); });
    b.unit(function () {
      // round shields hung on the breastwork, outside, facing the field and the left
      var pat = [['half', 'ink', 'bone'], ['quarter', 'bone', 'ink'], ['cross', 'ink', 'bone'], ['half', 'bone', 'ink'], ['quarter', 'ink', 'bone']];
      var nf = Math.max(2, Math.round(PW / 1.05));
      for (var i = 0; i < nf; i++) { var q = pat[(i + (o.seed || 0)) % pat.length]; rampartShield(b, -PW / 2 + (i + 0.5) * PW / nf, yP + 0.55, PD / 2 + 0.03, 0, 0.3, q[0], q[1], q[2], -0.12); }
      var ns = Math.max(2, Math.round(PD / 1.05));
      for (var k2 = 0; k2 < ns; k2++) { var q2 = pat[(k2 + 2 + (o.seed || 0)) % pat.length]; rampartShield(b, -PW / 2 - 0.03, yP + 0.55, -PD / 2 + (k2 + 0.5) * PD / ns, -Math.PI / 2, 0.3, q2[0], q2[1], q2[2], -0.12); }
    });
    b.part(nm + ', roof');
    var alongX = o.axis !== 'z', RL = (alongX ? w : d) + 0.3, RS = (alongX ? d : w) + 0.3, rise = o.rise || 1.6, over = 0.62;
    b.unit(function () {
      // plates on the post heads and the gable ends boarded
      [-1, 1].forEach(function (s) { b.box(0, yE - 0.24, s * hd, w + 0.4, 0.24, 0.24, { c: 'beam', m: M.wood, bevel: 0.03 }); b.box(s * hw, yE - 0.24, 0, 0.24, 0.24, d + 0.4, { c: 'beam', m: M.wood, bevel: 0.03 }); });
      [-1, 1].forEach(function (s) {
        var nb = Math.round(RS / 0.26);
        for (var i = 0; i < nb; i++) {
          var t = -RS / 2 + (i + 0.5) * RS / nb, hh = (rise - 0.12) * (1 - Math.abs(t) / (RS / 2 + 0.02)); if (hh < 0.08) continue;
          if (alongX) b.box(s * (RL / 2 - 0.02), yE, t, 0.07, hh, RS / nb - 0.02, { c: b.pick(PAL.rampart_plank), m: M.wood, bevel: 0.01 });
          else b.box(t, yE, s * (RL / 2 - 0.02), RS / nb - 0.02, hh, 0.07, { c: b.pick(PAL.rampart_plank), m: M.wood, bevel: 0.01 });
        }
      });
    });
    b.gableRoof(0, yE, 0, RL, RS, rise, { m: 'slate', c: o.slate, over: over, overX: 0.32, rows: 6, ridge: false, pitch: 0.32, ry: alongX ? 0 : Math.PI / 2 });
    b.unit(function () {
      // the ridge pole, crossed barge boards and a carved dragon head on each gable
      var Lr = RL + 0.64, sl = Math.atan2(rise, RS / 2), drop = over * Math.tan(sl), hs = RS / 2 + over;
      b.push(0, 0, 0, alongX ? 0 : Math.PI / 2);
      b.beam([-Lr / 2 - 0.05, yE + rise + 0.08, 0], [Lr / 2 + 0.05, yE + rise + 0.08, 0], 0.12, { c: 'beam', round: true, seg: 8 });
      [-1, 1].forEach(function (e) {
        var x = e * (Lr / 2 - 0.04);
        [-1, 1].forEach(function (s) { var zz = s * hs, y0b = yE - drop - 0.06, dz = -s * hs, dy = rise + drop; b.beam([x, y0b, zz], [x, y0b + dy * 1.22, zz + dz * 1.22], 0.07, { c: 'beam', r2: 0.05 }); });
        rampartHead(b, x + e * 0.02, yE + rise + 0.12, 0, e > 0 ? 0 : Math.PI, o.headS || 0.95);
      });
      b.pop();
    });
    b.part(nm + ', ladder');
    b.unit(function () { b.ladder(hw - 0.45, YD, -hd + 0.4, yP - YD + 0.05, { w: 0.45, lean: 0.12, ry: Math.PI / 2 }); });
    if (o.extra) o.extra(b, { w: w, d: d, yP: yP, yE: yE, PW: PW, PD: PD, rise: rise });
    b.pop();
  }

  var PERCHES = [
    { p: W(TG, -0.7, YPG + 2.0 + 2.1 + 0.2), ry: TG + ROT },
    { p: W(TL, -0.65, YPW + 2.0 + 1.55 + 0.2), ry: TL + ROT + Math.PI / 2 },
    { p: W(TR, -0.65, YPE + 2.0 + 1.55 + 0.2), ry: TR + ROT + Math.PI / 2 }
  ].map(function (q) { var w = toW(q.p); return { x: +w[0].toFixed(2), y: +w[1].toFixed(2), z: +w[2].toFixed(2), ry: +q.ry.toFixed(2) }; });
  var GLOW = toW(W(TG, -0.7, YPG + 4.3)).map(function (v) { return +v.toFixed(2); });
  var PATH = [W(TG, 16.5, 0), W(TG, 1.9, 0), W(TG + 0.01, -9, 0)].map(function (p) { var w = toW(p); return [+w[0].toFixed(2), +w[2].toFixed(2)]; });

  KIT.defineBuild('rampart', {
    name: "Moroni's rampart", size: 'big', need: 90,
    line: 'A ridge of heaped earth faced with turf, topped with log timbers, a frame of sharpened pickets and a walkway, with timber towers above it and a staked ditch and spoil bank in front.',
    r: 17, flat: [27, 20], ground: 'grass', path: PATH,
    frameY: 3.8, frameR: 15.5, glowAt: GLOW,
    trees: [{ x: -12.6, z: -4.2, kind: 'pine', h: 7.6 }, { x: -9.8, z: -10.6, kind: 'pine', h: 6.4 }, { x: 12.4, z: -4.6, kind: 'pine', h: 7.0 }, { x: 13.4, z: 4.8, kind: 'birch', h: 5.6 }, { x: -11.2, z: -8.4, kind: 'pine', h: 5.6 }, { x: 4.5, z: -13.2, kind: 'pine', h: 6.0 }, { x: -3.2, z: -13.6, kind: 'round', h: 5.2 }],
    bushes: [{ x: -11.6, z: 9.2, r: 0.8, flowers: '#f3f1ec' }, { x: 9.8, z: 10.2, r: 0.7 }, { x: 13.6, z: 0.8, r: 0.7 }, { x: -6.0, z: -12.6, r: 0.8 }, { x: -4.6, z: 13.2, r: 0.6, flowers: '#f3f1ec' }, { x: -11.8, z: -3.0, r: 0.7 }, { x: -12.6, z: 5.4, r: 0.9 }, { x: -11.4, z: 6.2, r: 0.6, flowers: '#f3f1ec' }, { x: -13.2, z: 2.6, r: 0.8, flowers: '#f3f1ec' }, { x: -12.4, z: 8.6, r: 0.55 }],
    perches: PERCHES,
    build: function (b) {
      var self = b;
      // the ground's height under a point of the island (the field rises a little past the levelled works)
      var gy = function (x, z) { return self.ground ? self.ground.height(x, z) - 0.03 : 0; };
      var gyL = function (th, n) { var w = toW(W(th, n, 0)); return Math.max(0, gy(w[0], w[2])); };
      b.push(0, 0, 0, ROT);

      // the knolls of rock the works are tied into at either end (ground, always there)
      b.base(function () {
        [-1, 1].forEach(function (sd) {
          [[0.412, -2.6, 1.05], [0.43, -1.2, 1.35], [0.418, 0.4, 0.95], [0.445, 1.6, 0.7], [0.452, -0.2, 0.8], [0.4, 1.9, 0.5], [0.44, -3.4, 0.6], [0.395, -1.9, 0.55]].forEach(function (q) {
            var th = sd * q[0], p = W(th, q[1], 0); b.rock(p[0], gyL(th, q[1]) + q[2] * 0.12, p[2], q[2] * 0.85, { c: b.pick(PAL.rampart_rock) });
          });
          for (var k = 0; k < 14; k++) { var th = sd * (0.39 + b.r() * 0.07), n = -3.6 + b.r() * 5.6, p = W(th, n, 0); b.grass(p[0], gyL(th, n), p[2], 0.28 + b.r() * 0.2); if (b.r() < 0.25) b.flowers(p[0], gyL(th, n) - 0.1, p[2], 0.3, { n: 4, c: '#f3f1ec' }); }
        });
      });

      b.part('Ditch dug');
      [[-0.39, -0.12], [-0.12, 0.14], [0.14, 0.39]].forEach(function (sp, i) {
        b.unit(function () {
          rampartSweep(b, DITCH, sp[0], sp[1], { tap0: i === 0 ? 0.06 : 0, tap1: i === 2 ? 0.06 : 0, noise: 0, colors: rampartMudC, ao: 0, step: 0.5 });
          // the water standing in the bottom
          rampartSweep(b, WATER, sp[0] + (i === 0 ? 0.025 : 0), sp[1] - (i === 2 ? 0.025 : 0), { tap0: i === 0 ? 0.05 : 0, tap1: i === 2 ? 0.05 : 0, noise: 0, colors: rampartWaterC, m: M.water, ao: 0, step: 0.5 });
        });
      });

      b.part('Spoil bank');
      b.unit(function () { rampartSweep(b, GLACIS, -0.35, cutL(1.0), { tap0: 0.08, tap1: 0.06, colors: rampartGlacisC, noise: 0.05, ampFn: function (n) { return n > 5.2 ? 0.6 : 1; }, step: 0.4 }); });
      b.unit(function () { rampartSweep(b, GLACIS, cutR(1.0), 0.35, { tap0: 0.06, tap1: 0.08, colors: rampartGlacisC, noise: 0.05, ampFn: function (n) { return n > 5.2 ? 0.6 : 1; }, step: 0.4 }); });

      b.part('Earth ridge');
      var SEG = [[-0.4, -0.15, 0], [-0.15, 'L', 0], ['R', 0.18, 0], [0.18, 0.4, 0]];
      [[0.38, 0.86, 0.04], [0.7, 0.93, 0.02], [1, 1, 0]].forEach(function (lift) {
        SEG.forEach(function (sg, i) {
          b.unit(function () {
            var a = sg[0] === 'R' ? cutR(GW + lift[2]) : sg[0], bb = sg[1] === 'L' ? cutL(GW + lift[2]) : sg[1];
            rampartSweep(b, BANK, a, bb, { sy: lift[0], sn: lift[1], n0: -0.9, tap0: i === 0 ? 0.075 : 0, tap1: i === 3 ? 0.075 : 0, cutA: sg[0] === 'R', cutB: sg[1] === 'L', ampFn: function (n) { return n > -1.6 ? 0.5 : 1.15; } });
          });
        });
      });

      b.part('Gate passage');
      // the cut through the ridge lined with upright planks, posts at intervals
      [-1, 1].forEach(function (s) {
        b.unit(function () {
          fr(b, TG, 0, 0);
          var x = s * (GW - 0.04);
          for (var zz = -3.5; zz < 1.5; zz += 0.25) { var hh = Math.max(bankH(zz), bankH(zz + 0.25)) + 0.06; if (hh < 0.12) continue; b.box(x, -0.05, zz + 0.125, 0.08, hh + 0.05, 0.24, { c: b.pick(PAL.rampart_plank), m: M.wood, bevel: 0.012 }); }
          [-3.0, -1.7, 0.8].forEach(function (zz) { rampartStave(b, x - s * 0.08, -0.05, zz, bankH(zz) + 0.4, 0.18, { knob: true }); });
          b.pop();
        });
      });

      b.part('Turf facing');
      for (var k = 0; k < 6; k++) SPANS.forEach(function (sp) { b.unit(function () { rampartCourse(b, k, sp[0], sp[1]); }); });

      b.part('Gate posts');
      b.unit(function () {
        fr(b, TG, NLOG, 0);
        [-1, 1].forEach(function (s) { rampartStave(b, s * (GW - 0.15), -0.05, 0, 3.45, 0.3, { knob: true }); });
        b.box(0, 2.12, 0, 2 * GW + 0.1, 0.36, 0.3, { c: 'beam', m: M.wood, bevel: 0.04 });
        b.pop();
      });

      b.part('Breastwork posts');
      SPANS.forEach(function (sp, si) {
        b.unit(function () {
          STATIONS[si].forEach(function (th, i) {
            if (si === 2 && i === STATIONS[si].length - 1) return; if (si === 3 && i === 0) return;
            var pi = W(th, -0.47, YB - 0.12), po = W(th, 0.12, YB - 0.12);
            rampartStave(b, pi[0], pi[1], pi[2], 4.32 - YB, 0.22, { ry: th, knob: true });
            rampartStave(b, po[0], po[1], po[2], 3.38 - YB, 0.22, { ry: th });
          });
        });
      });

      b.part('Breastwork timbers');
      for (var c = 0; c < 4; c++) {
        STATIONS.forEach(function (st, si) {
          for (var i = 0; i < st.length - 1; i++) (function (t0, t1) {
            b.unit(function () { var e = 0.12 / (RW + NLOG), y = YB + 0.15 + c * 0.285; b.beam(W(t0 - e, NLOG, y + b.j(0.01)), W(t1 + e, NLOG, y + b.j(0.01)), 0.145 + b.j(0.012), { round: true, seg: 8, c: b.pick(PAL.rampart_log), m: M.wood, roll: b.r() }); });
          })(st[i], st[i + 1]);
        });
      }
      b.unit(function () {
        // over the gate: two logs on the lintel and a deep sill
        fr(b, TG, NLOG, 0);
        [2.47 + 0.145, 2.47 + 0.43].forEach(function (y) { b.beam([-GW + 0.05, y, 0], [GW - 0.05, y, 0], 0.145, { round: true, seg: 8, c: b.pick(PAL.rampart_log), m: M.wood }); });
        b.pop();
      });

      b.part('Walkway');
      SPANS.forEach(function (sp, si) {
        b.unit(function () {
          STATIONS[si].forEach(function (th, i) {
            if (si === 2 && i === STATIONS[si].length - 1) return; if (si === 3 && i === 0) return;
            var p = W(th, -1.02, YD - 0.2), q = W(th, -1.6, YB - 0.15);
            b.box(p[0], p[1], p[2], 0.15, 0.13, 1.4, { ry: th, c: 'beam', m: M.wood, bevel: 0.02 });
            rampartStave(b, q[0], q[1], q[2], YD + 0.98 - YB + 0.15, 0.16, { ry: th, knob: true });
          });
        });
      });
      SPANS.forEach(function (sp) {
        [0, 1].forEach(function (half) {
          b.unit(function () {
            var r = RW - 1.02, A = ang(sp[0], r), B2 = ang(sp[1], r), L = (B2 - A) * r, n = Math.floor((L - 0.1) / 0.27), h0 = half ? Math.floor(n / 2) + 1 : 0, h1 = half ? n : Math.floor(n / 2);
            for (var i = h0; i <= h1; i++) { var th = A + (0.14 + i * 0.27) / r, p = W(th, -1.02 + b.j(0.03), YD - 0.07); b.box(p[0], p[1], p[2], 0.24, 0.07, 1.32 + b.j(0.05), { ry: th + b.j(0.03), c: b.pick(PAL.rampart_deck), m: M.wood, bevel: 0.012 }); }
          });
        });
      });
      b.unit(function () {
        // the walkway carried over the gate on two beams
        fr(b, TG, 0, 0);
        [-0.55, -1.5].forEach(function (z) { b.box(0, YD - 0.29, z, 2 * GW + 0.7, 0.22, 0.22, { c: 'beam', m: M.wood, bevel: 0.03 }); });
        for (var x = -GW - 0.2; x < GW + 0.25; x += 0.27) b.box(x, YD - 0.07, -1.02, 0.24, 0.07, 1.32, { c: b.pick(PAL.rampart_deck), m: M.wood, bevel: 0.012 });
        b.pop();
      });
      SPANS.forEach(function (sp, si) {
        b.unit(function () {
          var st = STATIONS[si];
          for (var i = 0; i < st.length - 1; i++) { var e = 0.06 / RW; b.beam(W(st[i] - e, -1.6, YD + 0.85), W(st[i + 1] + e, -1.6, YD + 0.85), 0.045, { round: true, seg: 6, c: 'woodLight', m: M.wood }); }
        });
      });

      b.part('Picket frame');
      SPANS.concat([['gate']]).forEach(function (sp, si) {
        b.unit(function () {
          var r = RW + NLOG, A, B2;
          if (sp[0] === 'gate') { A = cutL(GW - 0.15)(r); B2 = cutR(GW - 0.15)(r); } else { A = ang(sp[0], r); B2 = ang(sp[1], r); }
          var L = (B2 - A) * r, n = Math.max(1, Math.round((L - 0.2) / 0.3));
          // the sill on the top log
          var e = 0.08 / r;
          for (var q = 0; q < (sp[0] === 'gate' ? 1 : STATIONS[si].length - 1); q++) {
            var t0 = sp[0] === 'gate' ? A : STATIONS[si][q], t1 = sp[0] === 'gate' ? B2 : STATIONS[si][q + 1], tm = (t0 + t1) / 2, pm = W(tm, NLOG, 3.18), Lc = (t1 - t0) * r + 0.2;
            b.box(pm[0], pm[1], pm[2], Lc, 0.13, 0.24, { ry: tm, c: 'beam', m: M.wood, bevel: 0.03 });
          }
          for (var i = 0; i <= n; i++) {
            var th = A + (B2 - A) * (i + 0.5) / (n + 1), lean = b.j(0.025), top = 4.06 + b.j(0.05);
            rampartStake(b, W(th, NLOG, 3.22), W(th + lean / r, NLOG + 0.04, top + 0.24), 0.075 + b.j(0.008), { tip: (top - 3.22) / (top + 0.24 - 3.22) });
          }
          // two rails binding them behind
          [3.52, 3.92].forEach(function (y) { b.beam(W(A - e, -0.3, y), W(B2 + e, -0.3, y), 0.05, { c: 'beam' }); });
        });
      });

      b.part('Bridge over the ditch');
      b.unit(function () {
        fr(b, TG, 0, 0);
        [2.2, 3.3, 4.35].forEach(function (z) { [-1, 1].forEach(function (s) { b.post(s * 0.8, -0.1, z, 0.08, 0.32, { c: 'wood' }); b.beam([s * 0.8, 0.0, z + 0.35], [s * 0.8, 0.2, z], 0.04, { c: 'wood' }); }); b.box(0, 0.12, z, 1.85, 0.12, 0.16, { c: 'beam', m: M.wood }); });
        [-1, 1].forEach(function (s) { b.box(s * 0.72, 0.2, 3.15, 0.16, 0.12, 3.8, { c: 'beam', m: M.wood, bevel: 0.02 }); });
        b.pop();
      });
      b.unit(function () {
        fr(b, TG, 0, 0);
        for (var z = 1.33; z < 5.0; z += 0.25) b.box(b.j(0.03), 0.3, z, 1.75 + b.j(0.06), 0.07, 0.23, { c: b.pick(PAL.rampart_deck), m: M.wood, bevel: 0.012, ry: b.j(0.02) });
        b.pop();
      });
      b.unit(function () {
        fr(b, TG, 0, 0);
        [-1, 1].forEach(function (s) {
          [1.4, 3.15, 4.9].forEach(function (z) { b.post(s * 0.92, 0.0, z, 0.06, 1.25, { c: 'wood' }); });
          b.beam([s * 0.92, 1.12, 1.4], [s * 0.92, 1.12, 4.9], 0.04, { round: true, seg: 6, c: 'woodLight', m: M.wood });
          b.beam([s * 0.92, 0.7, 1.4], [s * 0.92, 0.7, 4.9], 0.03, { round: true, seg: 6, c: 'rope', m: M.rope });
        });
        b.pop();
      });

      b.part('Gate');
      b.unit(function () {
        fr(b, TG, NLOG, 0);
        rampartLeaf(b, -(GW - 0.32), -0.02, -0.18, 1, 1.15, GW - 0.34, 2.05);
        rampartLeaf(b, GW - 0.32, -0.02, -0.18, -1, 1.35, GW - 0.34, 2.05);
        b.pop();
      });
      b.unit(function () {
        // carved cheek posts at the mouth of the passage, a dragon looking out from each, and torches
        fr(b, TG, 1.92, 0);
        [-1, 1].forEach(function (s) {
          rampartStave(b, s * (GW + 0.1), -0.05, 0, 2.55, 0.26, { cap: false });
          rampartHead(b, s * (GW + 0.1), 2.5, 0, -Math.PI / 2 + s * 0.35, 0.8);
          b.torch(s * (GW - 0.05), 1.55, 0.08, { s: 0.55, ry: 0 });
        });
        b.pop();
      });

      b.part('Stakes in the ditch');
      [[-0.34, -0.12], [-0.12, TG - 0.03], [TG + 0.03, 0.34]].forEach(function (sp, si) {
        b.unit(function () {
          for (var row = 0; row < 2; row++) {
            var n0 = 2.1 + row * 0.85, r = RW + n0, A = sp[0], B2 = sp[1], cnt = Math.floor((B2 - A) * r / 0.62);
            for (var i = 0; i <= cnt; i++) {
              var th = A + (i + row * 0.5) * 0.62 / r; if (th > B2) continue;
              var lat = r * Math.sin(th - TG); if (Math.abs(lat) < 1.35) continue;
              rampartStake(b, W(th, n0 + b.j(0.05), -0.1), W(th + b.j(0.08) / r, n0 + 0.6, 1.02 + b.j(0.08)), 0.07, { tip: 0.74 });
            }
          }
        });
      });

      b.part('Stakes on the spoil bank');
      [[-0.3, TG - 0.04], [TG + 0.04, 0.3]].forEach(function (sp) {
        b.unit(function () {
          var n0 = 5.45, r = RW + n0, cnt = Math.floor((sp[1] - sp[0]) * r / 1.15);
          for (var i = 0; i <= cnt; i++) {
            var th = sp[0] + (i + 0.5) * 1.15 / r; if (th > sp[1]) continue; if (Math.abs(r * Math.sin(th - TG)) < 2.0) continue;
            var k = U.smooth(0.33, 0.27, Math.abs(th)), y0 = glacisH(n0) * k - 0.14;
            [-1, 1].forEach(function (sd) { rampartStake(b, W(th - sd * 0.22 / r, n0 - 0.15, y0), W(th + sd * 0.25 / r, n0 + 0.75, y0 + 1.05), 0.05, { tip: 0.78 }); });
            var pm = W(th, n0 + 0.3, y0 + 0.45); b.cyl(pm[0], pm[1], pm[2], 0.065, 0.07, { c: 'rope', m: M.rope, seg: 6 });
          }
        });
      });

      // the towers: the west and east towers first, then the gate tower
      rampartTower(b, TL, { name: 'West tower', w: 2.6, d: 2.3, n0: -0.65, yP: YPW, rise: 1.55, axis: 'x', seed: 0 });
      rampartTower(b, TR, { name: 'East tower', w: 2.6, d: 2.3, n0: -0.65, yP: YPE, rise: 1.55, axis: 'x', seed: 2,
        extra: function (b, t) {
          b.part('East tower, signal fire');
          b.unit(function () { b.brazier(-0.35, t.yP, 0.1, 0.75); });
        } });
      rampartTower(b, TG, { name: 'Gate tower', w: 3.8, d: 2.4, n0: -0.7, yP: YPG, rise: 2.1, axis: 'z', gate: true, seed: 1, headS: 1.15, slate: 'rampart_slate',
        extra: function (b, t) {
          b.part('Gate tower, banner');
          b.unit(function () {
            var bz = t.PD / 2 + 0.12;
            b.beam([0, t.yP - 0.62, t.PD / 2 - 0.1], [0, t.yP - 0.62, bz + 0.05], 0.045, { c: 'iron', m: M.metal });
            b.banner(0, t.yP - 0.6, bz, 1.3, 2.7, { c: 'ink', emblem: 'none', tail: 'swallow', band: 'ember', bandAt: 0.74, bandH: 0.05, trim: 'iron' });
            // a row of pickets on a bar, both faces
            var s0 = 0.95, ey = t.yP - 0.6 - 2.7 * 0.42;
            [[-0.24, 0.2], [0, 0.34], [0.24, 0.2]].forEach(function (pl) {
              var pts = [[-0.075, -0.4], [0.075, -0.4], [0.075, pl[1]], [0, pl[1] + 0.16], [-0.075, pl[1]]].map(function (q) { return [(q[0] + pl[0]) * s0, q[1] * s0]; });
              [0.016, -0.016].forEach(function (dz) { b.addGeo(KIT.geo.extrude(pts, 0.006), { x: 0, y: ey, z: bz + dz, c: '#f1eee8', m: M.cloth, bucket: 'cloth', ao: 0, jit: 0.01, vary: 0.02 }); });
            });
            [0.016, -0.016].forEach(function (dz) { b.addGeo(KIT.geo.extrude([[-0.38 * s0, -0.2 * s0], [0.38 * s0, -0.2 * s0], [0.38 * s0, -0.12 * s0], [-0.38 * s0, -0.12 * s0]], 0.006), { x: 0, y: ey, z: bz + dz, c: '#f1eee8', m: M.cloth, bucket: 'cloth', ao: 0, jit: 0.01, vary: 0.02 }); });
          });
          b.unit(function () { b.flag(0, t.yE + t.rise + 0.18, 0, 1.5, 1.2, 0.5, { c: 'ember', pennant: true, ry: -0.9 }); });
        } });

      b.part('Arms on the walkway');
      b.unit(function () {
        // baskets of stones for throwing, bundles of arrows and spare spears along the walkway
        [-0.235, -0.15, -0.065, 0.13, 0.225].forEach(function (th, i) {
          var p = W(th, -1.3, YD);
          b.lathe(p[0], p[1], p[2], [[0.01, 0], [0.22, 0], [0.28, 0.32], [0.26, 0.34], [0.01, 0.33]], { c: '#9a8160', m: M.straw, seg: 10, flat: true });
          for (var s = 0; s < 6; s++) b.ball(p[0] + b.j(0.15), p[1] + 0.36 + b.r() * 0.05, p[2] + b.j(0.15), 0.08 + b.r() * 0.03, { c: b.stoneC('stone'), m: M.stone, detail: 0 });
          if (i % 2 === 0) { var q = W(th + 0.018, -1.35, YD); b.quiver(q[0], q[1], q[2], { ry: th }); }
        });
      });
      b.unit(function () {
        [-0.19, -0.02, 0.17].forEach(function (th) { for (var s = 0; s < 3; s++) { var a = W(th + s * 0.006, -0.42, YD), c2 = W(th + s * 0.006 + 0.002, -0.33, YD + 2.1); var d = [c2[0] - a[0], c2[1] - a[1], c2[2] - a[2]]; b.beam(a, c2, 0.022, { round: true, seg: 5, c: 'woodLight', m: M.wood }); var tp = [c2[0] + d[0] * 0.12, c2[1] + d[1] * 0.12, c2[2] + d[2] * 0.12]; b.beam(c2, tp, 0.035, { r2: 0.004, round: true, seg: 4, c: 'steel', m: M.metal }); } });
      });
      b.unit(function () {
        // round shields hung on the pickets, facing the field
        var pat = [['half', 'ink', 'bone'], ['quarter', 'bone', 'ink'], ['cross', 'ink', 'bone'], ['half', 'bone', 'ink'], ['quarter', 'ink', 'bone'], ['cross', 'bone', 'ink']];
        [-0.225, -0.17, -0.115, -0.06, -0.02, 0.115, 0.165, 0.215].forEach(function (th, i) { var q = pat[i % pat.length], p = W(th, NLOG + 0.12, 3.72); rampartShield(b, p[0], p[1], p[2], th, 0.27, q[0], q[1], q[2], -0.08); });
      });

      b.part('Stores and works');
      b.unit(function () {
        // a stack of cut turves on the field, and the bare patches where they were lifted
        for (var row = 0; row < 3; row++) for (var i = 0; i < 4 - row; i++) for (var j = 0; j < 2; j++) { var tq = -0.19 + (i - 1.5 + row * 0.5) * 0.0135, nq = 8.75 + j * 0.46, q = W(tq, nq, row * 0.2 + gyL(tq, nq)); b.box(q[0], q[1], q[2], 0.5, 0.19, 0.42, { ry: -0.19 + b.j(0.08), c: b.pick(PAL.rampart_turf), m: M.dirt, bevel: 0.04, ao: 0.2 }); }
        for (var s = 0; s < 12; s++) { var ts = -0.218 + (s % 4) * 0.019 + b.j(0.002), ns = 9.4 + Math.floor(s / 4) * 0.62 + b.j(0.05), q2 = W(ts, ns, gyL(ts, ns) + 0.012); if (s === 6 || s === 9) continue; b.box(q2[0], q2[1] - 0.02, q2[2], 0.52, 0.035, 0.46, { ry: ts + b.j(0.06), c: b.pick(['#6b5a44', '#625240', '#725f48']), m: M.dirt, bevel: 0.01, ao: 0, jit: 0.03 }); }
      });
      b.unit(function () {
        // a cart of logs coming up the road to the bridge
        var p = W(TG + 0.004, 8.5, 0);
        b.cart(p[0], p[2], { ry: TG + Math.PI, load: function (bb) { for (var i = 0; i < 5; i++) bb.log(-0.42 + (i % 3) * 0.42 + (i > 2 ? 0.21 : 0), 0.85 + (i > 2 ? 0.3 : 0), -1.3, 0.17, 2.6, { c: bb.pick(PAL.rampart_log), rx: Math.PI / 2 }); } });
      });
      b.unit(function () {
        // sharpened pickets stacked on trestles, a chopping block and an axe
        fr(b, 0.15, 8.5, gyL(0.15, 8.5));
        [-0.9, 0.9].forEach(function (x) { b.beam([x, 0, -0.4], [x, 0.75, 0], 0.04, { c: 'wood' }); b.beam([x, 0, 0.4], [x, 0.75, 0], 0.04, { c: 'wood' }); });
        for (var i = 0; i < 7; i++) rampartStake(b, [-1.4, 0.82, -0.45 + i * 0.15], [1.45, 0.82 + b.j(0.02), -0.45 + i * 0.15], 0.07, { tip: 0.86 });
        for (var k2 = 0; k2 < 4; k2++) rampartStake(b, [-1.2, 0.96, -0.25 + k2 * 0.16], [1.3, 0.96, -0.25 + k2 * 0.16], 0.07, { tip: 0.86 });
        b.log(2.3, 0, 0.6, 0.28, 0.5, { c: 'wood', seg: 9 });
        b.beam([2.3, 0.5, 0.6], [2.55, 0.95, 0.75], 0.03, { c: 'woodLight', round: true });
        b.box(2.25, 0.47, 0.55, 0.06, 0.16, 0.2, { c: 'iron', m: M.metal, bevel: 0.01, rx: 0.4 });
        for (var ch = 0; ch < 12; ch++) b.box(2.3 + b.j(0.8), 0.0, 0.6 + b.j(0.7), 0.08, 0.02, 0.05, { ry: b.r() * 3, c: '#c9b48f', m: M.wood, bevel: 0, ao: 0 });
        for (var lg = 0; lg < 3; lg++) b.log(-1.2, 0.13, 1.3 + lg * 0.27, 0.13, 2.4, { c: b.pick(PAL.rampart_log), rz: -Math.PI / 2 });
        b.pop();
      });
      b.unit(function () {
        // a barrow of earth and spades by the ditch
        fr(b, -0.09, 8.65, 0);
        b.box(0, 0.35, 0, 0.62, 0.3, 0.95, { c: 'wood', m: M.wood, bevel: 0.03 }); b.ball(0, 0.62, 0, 0.32, { c: '#86704f', m: M.dirt, sy: 0.45, detail: 1 });
        b.wheel(0, 0.25, 0.62, 0.25, { ry: Math.PI / 2 });
        [-1, 1].forEach(function (s) { b.beam([s * 0.25, 0.45, -0.4], [s * 0.3, 0.55, -1.15], 0.035, { c: 'woodLight' }); b.beam([s * 0.25, 0.35, -0.35], [s * 0.25, 0, -0.45], 0.03, { c: 'wood' }); });
        [[0.75, 0.2], [0.95, -0.25]].forEach(function (q) { b.beam([q[0], 0, q[1]], [q[0] + 0.12, 1.15, q[1] - 0.25], 0.025, { c: 'woodLight', round: true }); b.box(q[0] - 0.01, -0.05, q[1] + 0.02, 0.24, 0.3, 0.03, { c: 'iron', m: M.metal, bevel: 0.01, rx: -0.2 }); });
        b.pop();
      });
      b.unit(function () {
        // inside the works: a log pile, tents for the watch, and a cooking fire
        var lp = W(-0.06, -7.4, 0); b.woodpile(lp[0], lp[2], { n: 4, len: 2.6, ry: -0.06 + Math.PI / 2 });
        [[-0.2, -8.8, -0.2], [0.2, -8.6, 0.2]].forEach(function (t, i) { var p = W(t[0], t[1], 0); b.ridgeTent(p[0], p[2], 2.4, 2.0, 1.6, { ry: t[2] + Math.PI / 2, c: i ? '#efebe4' : '#f3f1ec' }); });
        var fp = W(0.08, -7.6, 0);
        for (var s = 0; s < 9; s++) { var a = s / 9 * 6.28; b.box(fp[0] + Math.cos(a) * 0.55, 0, fp[2] + Math.sin(a) * 0.55, 0.26, 0.18, 0.2, { ry: -a, c: b.stoneC('stone'), m: M.stone, bevel: 0.05 }); }
        b.log(fp[0] - 0.2, 0.08, fp[2], 0.07, 0.6, { rz: Math.PI / 2, c: 'woodDark' }); b.log(fp[0], 0.08, fp[2] - 0.25, 0.07, 0.6, { rx: Math.PI / 2, c: 'woodDark' });
        b.embers(fp[0], 0.1, fp[2], 0.35, { light: false }); b.flame(fp[0], 0.1, fp[2], 0.8, { i: 0.9 });
      });

      b.unit(function () {
        // a stack of felled trunks for the pickets, with a saw horse
        fr(b, 0.235, 8.95, gyL(0.235, 8.95));
        for (var row = 0; row < 3; row++) for (var i = 0; i < 4 - row; i++) b.log(-1.6, 0.16 + row * 0.28, (i - (3 - row) / 2) * 0.32, 0.16, 3.2 + b.j(0.2), { c: b.pick(PAL.rampart_log), rz: -Math.PI / 2 });
        [-1, 1].forEach(function (s) { b.box(s * 1.7, 0, 0, 0.18, 0.12, 1.4, { c: 'woodDark', m: M.wood }); });
        fr(b, 0, -1.6, 0);
        [-0.35, 0.35].forEach(function (x) { b.beam([x, 0, -0.3], [x * 0.4, 0.8, 0], 0.04, { c: 'wood' }); b.beam([x, 0, 0.3], [x * 0.4, 0.8, 0], 0.04, { c: 'wood' }); });
        b.log(-0.9, 0.86, 0, 0.12, 1.8, { c: b.pick(PAL.rampart_log), rz: -Math.PI / 2 });
        b.box(0.5, 0.95, 0.12, 0.7, 0.12, 0.02, { c: 'steel', m: M.metal, bevel: 0.005, rz: -0.3 });
        b.pop(); b.pop();
      });

      b.unit(function () {
        // a second stack of turves built up like a wall, grass side down, ready to be carried to the face
        fr(b, -0.248, 8.8, gyL(-0.248, 8.8));
        for (var c = 0; c < 5; c++) for (var i = 0; i < (c > 2 ? 4 : 5); i++) for (var j = 0; j < 2; j++) b.box((i - (c > 2 ? 1.5 : 2)) * 0.52 + b.j(0.02), c * 0.19, j * 0.45 - 0.225 + b.j(0.015), 0.49, 0.18, 0.42, { ry: b.j(0.05), c: b.pick(PAL[c === 4 && b.r() < 0.3 ? 'rampart_grass' : b.r() < 0.5 ? 'rampart_turfDark' : 'rampart_turf']), m: M.dirt, bevel: 0.04, ao: 0.2, jit: 0.03 });
        b.pop();
        // a sledge loaded with turves, its tow rope lying out in front
        fr(b, -0.132, 9.95, gyL(-0.132, 9.95));
        [-0.36, 0.36].forEach(function (x) { b.box(x, 0, 0, 0.09, 0.11, 1.8, { c: 'woodDark', m: M.wood, bevel: 0.02 }); b.beam([x, 0.05, -0.88], [x, 0.26, -1.08], 0.045, { c: 'woodDark' }); });
        for (var z = -0.75; z < 0.8; z += 0.19) b.box(b.j(0.02), 0.13, z, 0.92, 0.04, 0.17, { c: b.pick(PAL.rampart_plank), m: M.wood, bevel: 0.01 });
        for (var l = 0; l < 2; l++) for (var a = 0; a < 2; a++) for (var q = 0; q < 3 - l; q++) b.box((a - 0.5) * 0.44 + b.j(0.02), 0.15 + l * 0.17, (q - (2 - l) / 2) * 0.5 + b.j(0.02), 0.42, 0.16, 0.46, { ry: b.j(0.05), c: b.pick(PAL[l === 1 ? 'rampart_turf' : 'rampart_turfDark']), m: M.dirt, bevel: 0.04, ao: 0.2 });
        b.beam([-0.36, 0.2, -1.02], [0, 0.03, -1.6], 0.022, { c: 'rope', m: M.rope }); b.beam([0.36, 0.2, -1.02], [0, 0.03, -1.6], 0.022, { c: 'rope', m: M.rope });
        b.beam([0, 0.03, -1.6], [0.35, 0.02, -2.3], 0.022, { c: 'rope', m: M.rope });
        b.pop();
        // turf spades and a cutting iron stuck in the lifted ground
        [[-0.2, 9.55, 0.25], [-0.17, 10.45, -0.3], [-0.215, 10.6, 0.1]].forEach(function (q) {
          fr(b, q[0], q[1], gyL(q[0], q[1]));
          b.push(0, 0, 0, q[2]);
          b.box(0, 0.05, 0, 0.22, 0.26, 0.025, { c: 'iron', m: M.metal, bevel: 0.006, rx: 0.18 });
          b.beam([0, 0.17, 0.02], [0, 1.2, 0.2], 0.022, { c: 'woodLight', round: true, seg: 6 });
          b.beam([-0.09, 1.2, 0.2], [0.09, 1.2, 0.2], 0.02, { c: 'woodLight', round: true, seg: 6 });
          b.pop(); b.pop();
        });
      });
      b.unit(function () {
        // finished pickets leaning on a rack by the road, both sides, tips up, turned to face the road
        fr(b, -0.045, 9.85, gyL(-0.045, 9.85));
        b.push(0, 0, 0, -0.42 + 0.045);
        [-0.95, 0.95].forEach(function (x) { b.beam([x, 0, -0.42], [x, 1.16, 0], 0.045, { c: 'wood' }); b.beam([x, 0, 0.42], [x, 1.16, 0], 0.045, { c: 'wood' }); });
        b.beam([-1.15, 1.12, 0], [1.15, 1.12, 0], 0.05, { c: 'beam', round: true, seg: 7 });
        [-1, 1].forEach(function (sd) {
          for (var i = 0; i < 8; i++) { var x = -0.92 + i * 0.26 + b.j(0.03) + (sd > 0 ? 0.12 : 0); rampartStake(b, [x, 0, sd * 0.7], [x + b.j(0.04), 1.72 + b.j(0.06), -sd * 0.3], 0.058, { tip: 0.86 }); }
        });
        for (var ch = 0; ch < 10; ch++) b.box(b.j(1.3), 0.0, b.j(0.9), 0.08, 0.02, 0.05, { ry: b.r() * 3, c: '#c9b48f', m: M.wood, bevel: 0, ao: 0 });
        b.pop(); b.pop();
      });

      b.part('Grass on the works');
      b.unit(function () {
        // tufts on the spoil bank, on the ridge's inner slope and over its old grassed ends
        var gh = glacisH;
        for (var i = 0; i < 110; i++) { var th = -0.31 + b.r() * 0.62, n = 5.0 + b.r() * 3.0, lat = (RW + n) * Math.sin(th - TG); if (Math.abs(lat) < 2.4) continue; var p = W(th, n, 0), h = gh(n) * U.smooth(0.35, 0.27, Math.abs(th)); b.grass(p[0], h, p[2], 0.3 + b.r() * 0.25); if (b.r() < 0.18) b.flowers(p[0], h - 0.1, p[2], 0.3, { n: 4 }); }
        for (var k3 = 0; k3 < 30; k3++) { var th2 = -0.3 + b.r() * 0.6, n2 = -3.3 + b.r() * 0.9; var p2 = W(th2, n2, 0); b.grass(p2[0], bankH(n2), p2[2], 0.25 + b.r() * 0.2); }
        [-1, 1].forEach(function (sd) { for (var k4 = 0; k4 < 22; k4++) { var th3 = sd * (END + 0.03 + b.r() * 0.07), n3 = -3.0 + b.r() * 4.2, kk = U.smooth(0.4, 0.325, Math.abs(th3)), p3 = W(th3, n3, 0); b.grass(p3[0], bankH(n3) * kk - 0.02, p3[2], 0.3 + b.r() * 0.2); } });
      });

      b.life(function () {
        var fg = function (th, n, y, o) { var p = W(th, n, 0); if (y === 0 && n > 7.9) { var w = toW(p); y = Math.max(0, gy(w[0], w[2])); } o.y = y; o.ry = (o.ry === undefined ? 0 : o.ry) + th; b.figure(p[0], p[2], o); };
        // on the walkway, facing the field
        fg(-0.225, -0.8, YD, { role: 'soldier', pose: 'spear' });
        fg(-0.16, -0.85, YD, { role: 'soldier', pose: 'spear', team: 'bone' });
        fg(-0.085, -0.95, YD, { role: 'soldier', pose: 'point', ry: 0.3 });
        fg(-0.035, -0.8, YD, { role: 'soldier', pose: 'spear' });
        fg(0.12, -0.85, YD, { role: 'soldier', pose: 'spear', team: 'bone' });
        fg(0.2, -0.9, YD, { role: 'archer', pose: 'draw', ry: 0.5 });
        // in the towers
        fg(TG + 0.02, -0.2, YPG, { role: 'archer', pose: 'draw', ry: 0.6 });
        fg(TG - 0.028, 0.0, YPG, { role: 'knight', pose: 'point', ry: -0.2 });
        fg(TL + 0.01, -0.3, YPW, { role: 'archer', pose: 'draw', ry: 0.7 });
        fg(TR - 0.016, -0.2, YPE, { role: 'soldier', pose: 'vigil' });
        // at the bridge, in the ditch and in the field
        fg(TG + 0.02, 5.6, 0, { role: 'soldier', pose: 'guard', ry: 0.4 });
        fg(TG - 0.012, 7.4, 0, { role: 'villager', pose: 'carry', ry: Math.PI });
        fg(-0.16, 2.5, 0.03, { role: 'smith', pose: 'swing', ry: Math.PI / 2, c: '#6e5a44' });
        fg(-0.1, 9.55, 0, { role: 'villager', pose: 'walk', ry: Math.PI + 0.4 });
        fg(-0.232, 9.9, 0, { role: 'villager', pose: 'carry', ry: Math.PI + 0.1 });
        fg(-0.15, 10.95, 0, { role: 'villager', pose: 'walk', ry: Math.PI - 0.15 });
        fg(0.205, 8.85, 0, { role: 'smith', pose: 'swing', ry: -1.2, c: '#5b4a3c' });
        fg(0.07, 11.0, 0, { role: 'child', pose: 'run', ry: Math.PI + 0.5 });
        fg(-0.13, 10.5, 0, { role: 'soldier', pose: 'guard', ry: Math.PI / 2 + 0.2 });
        fg(-0.098, 10.7, 0, { role: 'soldier', pose: 'swing', ry: -Math.PI / 2 + 0.1, team: 'bone' });
        fg(-0.115, 11.9, 0, { role: 'knight', pose: 'vigil', ry: Math.PI - 0.2 });
        fg(0.1, -7.0, 0, { role: 'villager', pose: 'talk', ry: Math.PI + 0.4 });
      });
      b.pop();
    }
  });
})();
