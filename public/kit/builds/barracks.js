// Barracks: the long hall of bunks where the stripling warriors sleep. A low stone hall with a timber clerestory
// under a steep slate roof, a round shield hung on the wall for every bunk, a carved porch, and at its sunny end
// the captain's wing, two storeys with a jettied upper floor and crossed dragon-head barge boards. In the sanded
// yard a line of young soldiers drills with sword and shield while the captain calls the count and a boy beats the
// drum; beside the hall the mess fire, a cauldron on its tripod and a shingled shelter over the long table.
// Built footings first, the hall's stone course by course, the wing's stone, the doors, the timber walls panel by
// panel, the upper floor, the roofs row by row, the gables and their dragon heads, then the yard, the mess, the
// stores, and last the people.
(function () {
  var T = THREE, M = KIT.M, PAL = KIT.PAL;
  PAL.barracks_sand = ['#d6c7a5', '#cfc09c', '#dbccab', '#cbbc98'];
  PAL.barracks_plank = ['#5b4a3c', '#544437', '#634f3f', '#4d3f33', '#5f5042'];
  function V(x, y, z) { return new T.Vector3(x, y, z); }

  // a carved dragon-head finial in the local XY plane, snout toward local +x, neck foot at (x, y, z), turned by ry
  // and leaned by o.rz, s tall
  // a stout carved head: a thick neck with a spiked mane down its back, open jaws, a swept-back horn, so it reads as
  // a dragon (not a twig) against the sky at hero scale
  var HEAD = [[0.17, 0], [0.19, 0.18], [0.26, 0.36], [0.38, 0.48], [0.56, 0.52], [0.78, 0.55], [0.9, 0.6], [0.87, 0.66], [0.7, 0.67], [0.56, 0.72], [0.72, 0.77], [0.96, 0.8], [1.02, 0.87], [0.97, 0.94], [0.82, 0.97], [0.62, 1.03], [0.5, 1.1], [0.42, 1.18], [0.22, 1.5], [0.26, 1.18], [0.12, 1.12], [0.0, 1.0], [-0.14, 0.96], [-0.06, 0.88], [-0.2, 0.8], [-0.12, 0.72], [-0.24, 0.62], [-0.15, 0.54], [-0.24, 0.42], [-0.16, 0.34], [-0.2, 0.18], [-0.17, 0]];
  function head(b, x, y, z, ry, s, o) {
    o = o || {}; var c = o.c || 'woodDark', hd = 0.17 * s;
    b.push(x, y, z, ry);
    if (o.rz) b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(o.rz));
    b.extrude(0, 0, 0, HEAD.map(function (p) { return [p[0] * s, p[1] * s]; }), hd, { c: c, m: M.wood, bevel: 0.014 * s });
    // a carved collar round the neck
    b.box(0.0, 0.26 * s, 0, 0.46 * s, 0.07 * s, hd + 0.05 * s, { c: c, m: M.wood, bevel: 0.012 * s, rz: 0.1 });
    // bone-white eyes and teeth
    [-1, 1].forEach(function (sd) { b.ball(0.66 * s, 0.93 * s, sd * (hd / 2 + 0.012 * s), 0.045 * s, { c: '#e9e4da', m: M.paint, sz: 0.5, detail: 0, ao: 0 }); });
    [0.64, 0.74, 0.84].forEach(function (tx) { b.extrude(tx * s, 0.665 * s, 0, [[-0.03 * s, 0], [0.03 * s, 0], [0, 0.06 * s]], hd * 0.6, { c: '#e9e4da', m: M.paint, ao: 0 }); });
    [0.7, 0.82, 0.92].forEach(function (tx) { b.extrude(tx * s, 0.785 * s, 0, [[-0.03 * s, 0], [0, -0.055 * s], [0.03 * s, 0]], hd * 0.6, { c: '#e9e4da', m: M.paint, ao: 0 }); });
    b.pop();
  }
  // crossed barge boards on a gable, in a frame at (x, z) turned ry so the gable faces local +z: the boards run up
  // the verges from the eave corners (+-hs, ey), cross at the apex (0, ay) and run on past it to carved heads
  function crossed(b, x, z, ry, hs, ey, ay, o) {
    o = o || {}; var th = Math.atan2(ay - ey, hs), ext = o.ext || 0.5, w = o.w || 0.12, s = o.s || 0.8, lift = o.lift || 0.12;
    b.push(x, 0, z, ry);
    [-1, 1].forEach(function (sd) {
      // the board from the eave on side sd crosses to the other side and ends in a head looking out that way
      var dz = sd * 0.055, a = [sd * hs, ey + lift, dz], tip = [-sd * Math.cos(th) * ext, ay + lift + Math.sin(th) * ext, dz];
      b.beam(a, tip, w, { c: 'woodDark', r2: 0.045 });
      // little carved tongues along the board
      for (var k = 1; k < 4; k++) { var f = k / 4, px = a[0] + (0 - a[0]) * f, py = a[1] + (ay + lift - a[1]) * f; b.box(px - sd * 0.02, py - w - 0.07, dz, 0.07, 0.12, 0.08, { c: 'woodDark', m: M.wood, bevel: 0.01, rz: sd * (Math.PI / 2 - th), taper: 0.3 }); }
      head(b, tip[0], tip[1] - 0.05, dz, sd < 0 ? 0 : Math.PI, s, { rz: -0.42, c: 'woodDark' });
    });
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
    else if (kind === 'wedge') { for (var w = 0; w < 4; w++) b.extrude(0, 0, 0.056, arc(w * Math.PI / 2, w * Math.PI / 2 + Math.PI / 4, rr), 0.008, { c: pc, m: M.paint }); }
    b.addGeo(new T.TorusGeometry(r, 0.024, 4, 28), { z: 0.03, c: 'iron', m: M.metal, ao: 0 });
    b.ball(0, 0, 0.065, r * 0.21, { c: 'iron', m: M.metal, sz: 0.6, detail: 1 });
    b.pop();
  }
  // a square stave post with carved collars and a cap
  function stave(b, x, y, z, h, w, o) {
    o = o || {}; var c = o.c || 'beam';
    b.post(x, y, z, w / 2, h, { c: c, ry: o.ry || 0 });
    [0.14, h - 0.42, h - 0.24].forEach(function (yy) { b.box(x, y + yy, z, w * 1.3, 0.07, w * 1.3, { c: c, m: M.wood, bevel: 0.015, ry: o.ry || 0 }); });
    // a twist of carving up the middle of the post
    for (var k = 0; k < 4; k++) b.box(x, y + h * 0.35 + k * 0.16, z, w * 1.12, 0.05, w * 1.12, { c: c, m: M.wood, bevel: 0.01, ry: (o.ry || 0) + k * 0.4 });
    if (o.cap !== false) b.box(x, y + h, z, w * 1.4, 0.12, w * 1.4, { c: c, m: M.wood, taper: 0.55, ry: o.ry || 0 });
  }
  // a rope swagged between two points
  function swag(b, a, c, sag, r) {
    var n = 6, prev = a;
    for (var i = 1; i <= n; i++) { var t = i / n, p = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (c[2] - a[2]) * t]; b.beam(prev, p, r || 0.02, { c: 'rope', m: M.rope, round: true, seg: 5 }); prev = p; }
  }
  // a point beside a figure standing at (x, z) turned ry, from its own frame
  function by(x, z, ry, lx, ly, lz) { return [x + lx * Math.cos(ry) + lz * Math.sin(ry), ly, z - lx * Math.sin(ry) + lz * Math.cos(ry)]; }
  // stones left out (or cut back) where openings are: list of [t0, t1, y0, y1], t along the wall
  function holeFn(list) {
    if (!list || !list.length) return null;
    return function (t, yy, s0, s1) {
      var keep = [[s0, s1]], hit = false;
      list.forEach(function (h) {
        if (!(yy > h[2] && yy < h[3])) return;
        var nk = [];
        keep.forEach(function (k) { if (k[1] <= h[0] || k[0] >= h[1]) { nk.push(k); return; } hit = true; if (k[0] < h[0]) nk.push([k[0], h[0]]); if (k[1] > h[1]) nk.push([h[1], k[1]]); });
        keep = nk;
      });
      return !hit ? false : keep.length ? keep : true;
    };
  }

  // stirring the pot with a long ladle, both hands low and forward
  KIT.people.poses.barracks_stir = function (r) { return { feet: [V(-0.14, 0.09, 0.05), V(0.15, 0.09, -0.12)], hands: [V(-0.08, 1.02, 0.42), V(0.1, 1.2, 0.36)], lean: 0.2, twist: 0.08, side: 0, hip: 0, drop: 0.02, head: [0.05, 0.3], pole: [V(-0.7, -0.6, -0.2), V(0.7, -0.6, -0.2)] }; };
  // beating a drum slung at the waist: one stick raised, one on the skin
  KIT.people.poses.barracks_drum = function (r) { return { feet: [V(-0.15, 0.09, 0.03), V(0.15, 0.09, -0.03)], hands: [V(-0.16, 0.95, 0.36), V(0.18, 1.3, 0.3)], lean: 0.04, twist: 0, side: 0, hip: 0, drop: 0, head: [0.3, 0.05], pole: [V(-0.8, -0.5, -0.2), V(0.8, -0.3, -0.2)] }; };

  KIT.defineBuild('barracks', {
    name: 'Barracks', size: 'middle', need: 50,
    line: 'A long stone and timber hall of bunks with a shield for every bed, the captain\'s wing, a mess fire, and young soldiers drilling in the yard.',
    r: 15, flat: [22, 15.5], ground: 'cobble', path: [[4.4, 15.6], [3.4, 7.2]],
    frameY: 3.4, frameR: 12.5, glowAt: [5.4, 10.2, 0.4],
    islandOpts: { cobbleSkip: function (x, z) { return x > -3.75 && x < 4.6 && z > 2.75 && z < 6.5; } },
    trees: [{ x: -11.6, z: -5.6, kind: 'pine', h: 8.2 }, { x: -13.2, z: -2.2, kind: 'pine', h: 6.3 }, { x: 14.1, z: -0.1, kind: 'pine', h: 7.2 }, { x: 12.5, z: 5.4, kind: 'birch', h: 5.4 }],
    bushes: [{ x: 9.4, z: 7.6, r: 0.8, flowers: '#f3f1ec' }, { x: -9.4, z: 7.6, r: 0.8 }, { x: 12.6, z: 1.2, r: 0.7 }, { x: -11.0, z: 5.8, r: 0.6, flowers: '#f3f1ec' }, { x: -12.4, z: 2.6, r: 0.7 }],
    perches: [{ x: 6.6, y: 9.3, z: -1.93, ry: 0 }, { x: -2.05, y: 7.0, z: -2.5, ry: 0 }, { x: -8.6, y: 3.5, z: 0.6, ry: 0 }],
    build: function (b) {
      var base = 0.55, TH = 0.6;
      // the hall: x -5.6..3.2 (it butts into the wing), z -4.8..-0.2
      var x0 = -5.6, xw = 3.2, z0 = -4.8, z1 = -0.2, cz = (z0 + z1) / 2, hallTop = 2.4;
      // the captain's wing: x 3.2..8.4, z -5.4..1.2, its upper floor jettied out to 1.55 at the front
      var wx0 = 3.2, wx1 = 8.4, wcx = (wx0 + wx1) / 2, wz0 = -5.4, wz1 = 1.2, jet = 0.35, wz1j = wz1 + jet, wcz = (wz0 + wz1) / 2, wTop = base + 2.9;
      var dX = -1.4; // the hall door
      var wdX = wcx - 1.1; // the wing door

      b.part('Footings');
      b.unit(function () {
        b.box((x0 + xw) / 2, -0.08, cz, xw - x0 + 1.0, 0.36, z1 - z0 + 1.0, { c: 'stoneDark', bevel: 0.08 });
        b.box(wcx, -0.08, wcz, wx1 - wx0 + 1.0, 0.36, wz1 - wz0 + 1.0, { c: 'stoneDark', bevel: 0.08 });
      });
      b.unit(function () {
        b.box((x0 + xw) / 2, 0.28, cz, xw - x0 + 0.5, 0.27, z1 - z0 + 0.5, { c: 'stone', bevel: 0.07 });
        b.box(wcx, 0.28, wcz, wx1 - wx0 + 0.5, 0.27, wz1 - wz0 + 0.5, { c: 'stone', bevel: 0.07 });
        // a step up to each door
        b.box(dX, -0.02, z1 + 0.55, 1.6, 0.3, 0.55, { c: 'sandstone', bevel: 0.05 });
        b.box(wdX, -0.02, wz1 + 0.55, 1.8, 0.3, 0.55, { c: 'sandstone', bevel: 0.05 });
      });

      b.part('Hall walls, stone');
      var hn = 6, hch = (hallTop - base) / hn;
      var hallSides = [
        { a: [x0, z1 - TH / 2], b: [xw + 0.05, z1 - TH / 2], hole: holeFn([[dX - x0 - 0.68, dX - x0 + 0.68, 0, 9]]) },
        { a: [x0 + TH / 2, z0 + TH], b: [x0 + TH / 2, z1 - TH], hole: null },
        { a: [xw + 0.05, z0 + TH / 2], b: [x0, z0 + TH / 2], hole: null }
      ];
      for (var k = 0; k < hn; k++) {
        (function (y) {
          b.unit(function () { hallSides.forEach(function (sd) { b.stoneWall(sd.a[0], sd.a[1], sd.b[0], sd.b[1], y, hch, TH, { pal: 'stone', len: 0.66, course: hch, hole: sd.hole, core: !sd.hole }); }); });
        })(base + k * hch);
      }

      b.part('Captain\'s wing, stone');
      b.stoneBox(wcx, wcz, wx1 - wx0, wz1 - wz0, base, 2.9, TH, {
        pal: 'stone', course: 0.32, len: 0.66,
        holes: [
          { side: 'front', at: -1.1, w: 1.7, y1: base + 2.5 },
          { side: 'front', at: 1.6, w: 0.95, y0: base + 1.0, y1: base + 2.3 },
          { side: 'right', at: 0.5, w: 0.95, y0: base + 1.0, y1: base + 2.3 }
        ]
      });

      b.part('Doors and windows');
      b.unit(function () {
        b.archDoor(wdX, base, wz1, 1.35, 2.35, { depth: TH + 0.15, keyC: 'sandstone', frameStone: 'sandstone', doorC: 'woodDark' });
        b.window(wcx + 1.6, base + 1.05, wz1 - 0.1, 0.8, 1.2, { arch: true, sillC: 'sandstone' });
        b.window(wx1 - 0.1, base + 1.05, wcz - 0.5, 0.8, 1.2, { arch: true, ry: Math.PI / 2, sillC: 'sandstone' });
      });
      b.unit(function () {
        // the hall door: planks in a carved timber frame
        b.archDoor(dX, base, z1, 1.2, hallTop - base, { arch: 0.0, timber: true, depth: TH + 0.1, doorC: 'woodDark' });
        [-1, 1].forEach(function (sd) { for (var q = 0; q < 3; q++) b.box(dX + sd * 0.69, base + 0.45 + q * 0.45, z1 + 0.14, 0.22, 0.06, 0.06, { c: 'beam', m: M.wood, bevel: 0.01 }); });
      });

      b.part('Hall walls, timber');
      var u0 = hallTop + 0.12, hH = 1.65, eave = u0 + hH, wl = 0.15; // the timber wall stands 0.15 in from the stone face
      b.unit(function () {
        // a sill beam laid along the top of the stone
        b.box((x0 + xw) / 2, hallTop, z1 - TH / 2 + 0.01, xw - x0, 0.12, TH + 0.02, { c: 'beam', m: M.wood, bevel: 0.02 });
        b.box((x0 + xw) / 2, hallTop, z0 + TH / 2 - 0.01, xw - x0, 0.12, TH + 0.02, { c: 'beam', m: M.wood, bevel: 0.02 });
        b.box(x0 + TH / 2 - 0.01, hallTop, cz, TH + 0.02, 0.12, z1 - z0 - 2 * TH, { c: 'beam', m: M.wood, bevel: 0.02 });
      });
      var win = { w: 0.72, y0: 0.45, y1: 1.3, shutters: '#1f1e1c' };
      b.timberWall(x0 + wl, z1 - wl, xw, z1 - wl, u0, { h: hH, post: 1.25, windows: [Object.assign({ t: 0.63 }, win, { flowers: '#f3f1ec' }), Object.assign({ t: 1.88 }, win), Object.assign({ t: 6.91 }, win, { flowers: '#efebe4' }), Object.assign({ t: 8.17 }, win)] });
      b.timberWall(x0 + wl, z0 + wl, x0 + wl, z1 - wl, u0, { h: hH, post: 1.2, windows: [Object.assign({ t: 2.15 }, win)] });
      b.timberWall(xw, z0 + wl, x0 + wl, z0 + wl, u0, { h: hH, post: 1.6, windows: [Object.assign({ t: 2.4 }, win), Object.assign({ t: 6.2 }, win)] });

      b.part('Captain\'s wing, upper floor');
      b.unit(function () {
        // joists run out under the jetty on carved brackets
        for (var i = 0; i <= 13; i++) { var x = wx0 + 0.25 + i * (wx1 - wx0 - 0.5) / 13; b.box(x, wTop, wz1 + jet / 2 - 0.35, 0.2, 0.22, 0.7 + jet, { c: 'beam', m: M.wood, bevel: 0.03 }); }
        for (var q = 0; q < 3; q++) { var x2 = wx0 + 0.95 + q * 1.65; b.beam([x2, wTop - 0.75, wz1 + 0.02], [x2, wTop + 0.02, wz1 + jet + 0.05], 0.08, { c: 'beam' }); }
      });
      var wu0 = wTop + 0.22, wH = 2.4, weave = wu0 + wH;
      b.unit(function () { b.box(wcx, wu0 - 0.05, wcz + jet / 2, wx1 - wx0 + 0.15, 0.12, wz1 - wz0 + jet + 0.1, { c: 'beam', m: M.wood, bevel: 0.02 }); });
      var ww = { w: 0.7, y0: 0.8, y1: 1.9, shutters: '#1f1e1c' };
      b.timberWall(wx0, wz1j, wx1, wz1j, wu0, { h: wH, post: 1.3, windows: [Object.assign({ t: 0.65 }, ww, { flowers: '#f3f1ec' }), Object.assign({ t: 3.25 }, ww), Object.assign({ t: 4.55 }, ww, { flowers: '#efebe4' })] });
      b.timberWall(wx1, wz1j, wx1, wz0, wu0, { h: wH, post: 1.3, windows: [Object.assign({ t: 3.0 }, ww)] });
      b.timberWall(wx1, wz0, wx0, wz0, wu0, { h: wH, post: 1.7 });
      b.timberWall(wx0, wz0, wx0, wz1j, wu0, { h: wH, post: 1.25, windows: [{ t: 6.37, w: 0.66, y0: 0.85, y1: 1.85, shutters: '#1f1e1c' }] });

      b.part('Hall roof');
      var hRise = 2.6, hSpan = z1 - z0 - 2 * wl, hOver = 0.6;
      b.unit(function () {
        // the gable end over the left wall, with its timbers
        var gx = x0 + wl;
        b.gableEnd(gx, eave, cz, hSpan - 0.1, hRise - 0.15, 0.24, { c: 'plaster' });
        var ox = gx - 0.14;
        b.beam([ox, eave, cz - hSpan / 2 + 0.25], [ox, eave + hRise - 0.15, cz], 0.08, { c: 'beam' });
        b.beam([ox, eave, cz + hSpan / 2 - 0.25], [ox, eave + hRise - 0.15, cz], 0.08, { c: 'beam' });
        b.beam([ox, eave + 0.1, cz], [ox, eave + 0.55, cz], 0.08, { c: 'beam' });
        b.beam([ox, eave + 1.25, cz - 1.0], [ox, eave + 1.25, cz + 1.0], 0.07, { c: 'beam' });
        b.window(ox - 0.02, eave + 0.55, cz, 0.5, 0.6, { ry: -Math.PI / 2, sillC: 'beam', sillM: M.wood, lintelC: 'beam' });
      });
      // the roof runs right up to the wing's gable wall
      b.gableRoof(-1.35, eave, cz, 8.5, hSpan, hRise, { m: 'slate', over: hOver, overX: 0.45, rows: 8 });

      b.part('Captain\'s wing, roof');
      var wRise = 3.0, wSpan = wz1j - wz0, wOver = 0.55, wrz = (wz0 + wz1j) / 2, wLen = wx1 - wx0, wTan = wRise / (wSpan / 2);
      b.unit(function () {
        [[wx0, -1], [wx1, 1]].forEach(function (g) {
          var gx = g[0], f = g[1], ox = gx + f * 0.14;
          b.gableEnd(gx, weave, wrz, wSpan - 0.1, wRise - 0.15, 0.24, { c: 'plaster' });
          b.beam([ox, weave, wrz - wSpan / 2 + 0.3], [ox, weave + wRise - 0.15, wrz], 0.08, { c: 'beam' });
          b.beam([ox, weave, wrz + wSpan / 2 - 0.3], [ox, weave + wRise - 0.15, wrz], 0.08, { c: 'beam' });
          b.beam([ox, weave + 1.75, wrz], [ox, weave + wRise - 0.2, wrz], 0.08, { c: 'beam' });
          b.beam([ox, weave + 1.75, wrz - 1.6], [ox, weave + 1.75, wrz + 1.6], 0.07, { c: 'beam' });
          [-1, 1].forEach(function (sd) { b.beam([ox, weave + 0.05, wrz + sd * 2.2], [ox, weave + 1.72, wrz + sd * 1.0], 0.06, { c: 'beam' }); });
          b.window(ox + f * 0.02, weave + 0.85, wrz, 0.55, 0.7, { ry: f * Math.PI / 2, sillC: 'beam', sillM: M.wood, lintelC: 'beam', shutters: '#1f1e1c' });
        });
      });
      b.gableRoof(wcx, weave, wrz, wLen, wSpan, wRise, { m: 'slate', over: wOver, overX: 0.4, rows: 9 });

      b.part('Dormer gable');
      // a tall dormer on the wing's front slope, its gable carved with crossed dragon heads
      // set toward the hall end, so its shadow falls where the wing already shades the hall and the rest of the
      // wing's front slope stays in the sun
      var dcx = wx0 + 1.75, dW = 2.5, dz1 = wz1j - 0.35, dE = weave + 1.13, dRise = 1.5, dOver = 0.3;
      var roofY = function (z) { return weave + (wz1j - z) * wTan; };
      b.unit(function () {
        b.box(dcx, roofY(dz1) - 0.25, (dz1 + 0.0) / 2, dW, dE - roofY(dz1) + 0.25, dz1 - 0.0, { c: 'plaster', m: M.plaster, bevel: 0.02 });
        [-1, 1].forEach(function (sd) { b.beam([dcx + sd * (dW / 2 - 0.02), roofY(dz1) + 0.02, dz1 + 0.02], [dcx + sd * (dW / 2 - 0.02), dE, dz1 + 0.02], 0.08, { c: 'beam' }); });
        b.beam([dcx - dW / 2, roofY(dz1) + 0.1, dz1 + 0.03], [dcx + dW / 2, roofY(dz1) + 0.1, dz1 + 0.03], 0.07, { c: 'beam' });
        b.beam([dcx - dW / 2 - 0.05, dE - 0.06, dz1 + 0.03], [dcx + dW / 2 + 0.05, dE - 0.06, dz1 + 0.03], 0.08, { c: 'beam' });
        b.window(dcx, roofY(dz1) + 0.24, dz1 + 0.03, 0.9, 0.5, { sillC: 'beam', sillM: M.wood, lintelC: 'beam', mullion: true });
      });
      b.unit(function () {
        b.gableEnd(dcx, dE, dz1 - 0.12, dW - 0.05, dRise - 0.12, 0.24, { c: 'plaster', ry: 0 });
        var oz = dz1 + 0.03;
        b.beam([dcx, dE, oz], [dcx, dE + dRise - 0.15, oz], 0.07, { c: 'beam' });
        [-1, 1].forEach(function (sd) { b.beam([dcx + sd * 0.95, dE + 0.02, oz], [dcx + sd * 0.12, dE + dRise - 0.3, oz], 0.06, { c: 'beam' }); });
      });
      var dBack = -1.75, dLen = dz1 - dBack;
      b.gableRoof(dcx, dE, (dz1 + dBack) / 2, dLen, dW, dRise, { m: 'slate', over: dOver, overX: 0.25, rows: 4, ry: Math.PI / 2 });

      b.part('Dragon heads on the gables');
      b.unit(function () {
        var th = Math.atan2(dRise, dW / 2), hs = dW / 2 + dOver, ey = dE - dOver * Math.tan(th);
        crossed(b, dcx, dz1 + 0.25 - 0.02, 0, hs, ey, dE + dRise, { s: 0.8, ext: 0.42, lift: 0.13 });
      });
      b.unit(function () {
        var hs = wSpan / 2 + wOver, ey = weave - wOver * wTan;
        crossed(b, wx0 - 0.4 + 0.02, wrz, -Math.PI / 2, hs, ey, weave + wRise, { s: 1.15, ext: 0.5, w: 0.14, lift: 0.14 });
      });
      b.unit(function () {
        var th = Math.atan2(hRise, hSpan / 2), hs = hSpan / 2 + hOver, ey = eave - hOver * Math.tan(th);
        crossed(b, x0 + wl - 0.45 + 0.02, cz, -Math.PI / 2, hs, ey, eave + hRise, { s: 1.0, ext: 0.45, w: 0.13, lift: 0.14 });
        // the flag over the wing's sunny gable, a small orange pennant against the sky
        b.flag(wx1 + 0.12, weave + wRise + 0.1, wrz, 1.4, 1.0, 0.42, { c: 'ember', pennant: true, pr: 0.035, ry: -0.5 });
      });

      b.part('Porch');
      var pz0 = z1 - wl, pz1 = 1.5, pw = 1.8, pe = 2.35, pRise = 0.8;
      b.unit(function () {
        [-1, 1].forEach(function (sd) {
          b.box(dX + sd * pw / 2, -0.05, pz1, 0.36, 0.2, 0.36, { c: b.stoneC('stoneDark'), m: M.stone, bevel: 0.05 });
          stave(b, dX + sd * pw / 2, 0.12, pz1, pe - 0.2, 0.18, { cap: false });
        });
      });
      b.unit(function () {
        [-1, 1].forEach(function (sd) { b.beam([dX + sd * pw / 2, pe - 0.08, pz0], [dX + sd * pw / 2, pe - 0.08, pz1 + 0.15], 0.09, { c: 'beam' }); });
        b.beam([dX - pw / 2 - 0.15, pe - 0.08, pz1], [dX + pw / 2 + 0.15, pe - 0.08, pz1], 0.09, { c: 'beam' });
        [-1, 1].forEach(function (sd) { b.beam([dX + sd * pw / 2, pe - 0.7, pz1], [dX + sd * (pw / 2 - 0.5), pe - 0.15, pz1], 0.05, { c: 'beam' }); });
        // the little gable filled with upright planks
        var n = 7;
        for (var i = 0; i < n; i++) { var t = -pw / 2 + (i + 0.5) * pw / n, hh = (pRise - 0.1) * (1 - Math.abs(t) / (pw / 2 + 0.05)); if (hh > 0.06) b.box(dX + t, pe, pz1 + 0.02, pw / n - 0.02, hh, 0.05, { c: b.pick(PAL.barracks_plank), m: M.wood, bevel: 0.01 }); }
      });
      b.gableRoof(dX, pe, (pz0 + pz1) / 2, pz1 - pz0, pw, pRise, { m: 'wood', over: 0.25, overX: 0.18, rows: 3, ry: Math.PI / 2, pitch: 0.3 });
      b.unit(function () {
        var th = Math.atan2(pRise, pw / 2), hs = pw / 2 + 0.25, ey = pe - 0.25 * Math.tan(th);
        crossed(b, dX, pz1 + 0.18 + 0.02, 0, hs, ey, pe + pRise, { s: 0.5, ext: 0.3, w: 0.08, lift: 0.1 });
        [-1, 1].forEach(function (sd) { b.torch(dX + sd * (pw / 2), 1.55, pz1 + 0.1, { s: 0.55 }); });
      });

      b.part('Chimney and smoke louvres');
      b.unit(function () {
        // the wing's chimney, laid stone by stone up through the slates behind the ridge
        var chx = 7.55, chz = wrz - 0.8, cw = 0.9, y = 8.0;
        for (var c = 0; c < 8; c++) {
          var yy = y + c * 0.3, long = c % 2 === 0;
          [-1, 1].forEach(function (sd) {
            b.box(chx + sd * (cw / 2 - 0.1), yy, chz, 0.2, 0.27, long ? cw : cw - 0.4, { c: b.stoneC('stone', yy), m: M.stone, bevel: 0.04 });
            b.box(chx, yy, chz + sd * (cw / 2 - 0.1), long ? cw - 0.4 : cw, 0.27, 0.2, { c: b.stoneC('stone', yy), m: M.stone, bevel: 0.04 });
          });
        }
        b.box(chx, y + 2.4, chz, cw + 0.2, 0.18, cw + 0.2, { c: 'sandstone', bevel: 0.05 });
        b.box(chx, y + 2.58, chz, 0.45, 0.3, 0.45, { c: 'stoneDark', bevel: 0.04 });
      });
      b.unit(function () {
        // two louvred smoke vents on the hall ridge
        [-3.7, -0.4].forEach(function (lx) {
          var ly = eave + hRise - 0.35;
          b.box(lx, ly, cz, 0.85, 0.6, 0.9, { c: 'beam', m: M.wood, bevel: 0.02 });
          [-1, 1].forEach(function (sd) { for (var s = 0; s < 3; s++) b.box(lx - 0.25 + s * 0.25, ly + 0.15, cz + sd * 0.46, 0.16, 0.36, 0.04, { c: '#141312', m: M.dark, bevel: 0, ao: 0 }); });
          b.push(lx, ly + 0.6, cz, 0);
          b.gableRoof(0, 0, 0, 0.85, 0.95, 0.42, { m: 'slate', over: 0.14, overX: 0.08, rows: 2, rowsAsUnits: false, ridge: false, pitch: 0.24 });
          b.pop();
        });
      });

      b.part('A shield for every bunk');
      var shieldX = [-5.0, -4.2, -3.4, -2.6, -0.2, 0.6, 1.4, 2.25];
      var kinds = [['half', 'ink', 'bone'], ['ring', 'bone', 'ink'], ['quarter', 'ink', 'bone'], ['cross', 'bone', 'ink'], ['wedge', 'ink', 'bone'], ['half', 'bone', 'ink'], ['ring', 'ink', 'bone'], ['quarter', 'bone', 'ink']];
      [[0, 4], [4, 8]].forEach(function (rg) {
        b.unit(function () { for (var i = rg[0]; i < rg[1]; i++) { b.beam([shieldX[i], 1.88, z1 + 0.0], [shieldX[i], 1.92, z1 + 0.12], 0.025, { c: 'woodDark', round: true, seg: 5 }); vShield(b, shieldX[i], 1.55, z1 + 0.08, 0, 0.34, kinds[i][0], kinds[i][1], kinds[i][2], -0.12); } });
      });

      b.part('Banner and torches');
      b.unit(function () {
        // the wing's banner hung from an iron arm off the sunny corner
        var bx = wx1 + 0.55, by0 = wu0 + 1.95, bz = wz1j - 0.25;
        b.beam([wx1 + 0.05, by0, bz], [bx + 0.2, by0, bz], 0.04, { c: 'iron', m: M.metal });
        b.beam([wx1 + 0.05, by0 - 0.55, bz], [bx - 0.1, by0, bz], 0.025, { c: 'iron', m: M.metal });
        b.banner(bx, by0 - 0.04, bz + 0.06, 1.15, 2.7, { c: 'ink', emblem: 'swords', ec: '#f1eee8', es: 0.8, tail: 'swallow', band: 'ember', bandAt: 0.74, bandH: 0.05, trim: 'iron', ry: 0.25 });
      });
      b.unit(function () { [wdX - 1.1, wdX + 1.1].forEach(function (x) { b.torch(x, base + 1.85, wz1 + 0.02, { s: 0.6 }); }); });

      b.part('Drill yard');
      var yx0 = -3.75, yx1 = 4.6, yz0 = 2.75, yz1 = 6.5, ycx = (yx0 + yx1) / 2, ycz = (yz0 + yz1) / 2;
      b.unit(function () {
        b.box(ycx, -0.03, ycz, yx1 - yx0 + 0.1, 0.07, yz1 - yz0 + 0.1, { c: 'barracks_sand', m: M.dirt, bevel: 0.02, jit: 0.01, vary: 0.05 });
        // a kerb of squared timbers round the yard, open toward the path
        [[yx0, yz0, yx1, yz0], [yx0, yz1, 2.3, yz1], [yx0, yz0, yx0, yz1], [yx1, yz0, yx1, 5.1]].forEach(function (s) { b.beam([s[0], 0.06, s[1]], [s[2], 0.06, s[3]], 0.1, { c: 'wood', r2: 0.08 }); });
      });
      b.unit(function () {
        // rake marks in rows, scuffed where the line stands, footprints and straw blown in
        for (var row = 0; row < 13; row++) {
          var rz = yz0 + 0.22 + row * 0.27;
          for (var sg = 0; sg < 6; sg++) {
            var sx0 = yx0 + 0.25 + sg * 1.38 + b.j(0.2), L = 0.85 + b.r() * 0.4;
            if (sx0 + L > yx1 - 0.15) L = yx1 - 0.15 - sx0; if (L < 0.2) continue;
            if (Math.abs(rz - 4.3) < 0.55 && b.r() < 0.75) continue;
            b.box(sx0 + L / 2, 0.035, rz + b.j(0.03), L, 0.012, 0.04, { c: '#b9a782', m: M.dirt, bevel: 0, ao: 0, jit: 0.02, ry: b.j(0.03) });
          }
        }
        for (var f = 0; f < 34; f++) { var fx = yx0 + 0.4 + b.r() * (yx1 - yx0 - 0.8), fz = yz0 + 0.4 + b.r() * (yz1 - yz0 - 0.8); b.box(fx, 0.04, fz, 0.11, 0.012, 0.24, { ry: b.r() * 3, c: '#b6a47f', m: M.dirt, bevel: 0.02, ao: 0 }); }
        for (var w = 0; w < 20; w++) { var wx = yx0 + b.r() * (yx1 - yx0), wz = yz0 + b.r() * (yz1 - yz0); b.box(wx, 0.042, wz, 0.16 + b.r() * 0.12, 0.012, 0.012, { ry: b.r() * 3, c: 'straw', m: M.straw, bevel: 0, ao: 0 }); }
      });
      b.unit(function () {
        // marker stakes for the line, each with a strip of cloth
        for (var i = 0; i < 6; i++) { var sx = -3.2 + i * 1.2; b.post(sx, 0, 3.35, 0.035, 0.55, { c: 'woodLight' }); b.box(sx, 0.5, 3.35, 0.12, 0.05, 0.02, { c: i % 2 ? 'bone' : 'ink', m: M.cloth, bevel: 0 }); }
      });

      b.part('Practice arms');
      b.unit(function () {
        // a rack of wooden swords and round shields at the end of the yard
        var rx = -4.45, rz = 3.75;
        b.push(rx, 0, rz, Math.PI / 2 + 0.1);
        b.post(-0.9, 0, 0, 0.05, 1.35, { c: 'wood' }); b.post(0.9, 0, 0, 0.05, 1.35, { c: 'wood' });
        b.box(0, 1.08, 0, 1.9, 0.08, 0.12, { c: 'woodLight', m: M.wood }); b.box(0, 0.25, 0, 1.9, 0.08, 0.22, { c: 'woodLight', m: M.wood });
        for (var i = 0; i < 6; i++) { var px = -0.72 + i * 0.29; b.box(px, 0.3, 0.05, 0.06, 0.95, 0.03, { c: 'woodLight', m: M.wood, bevel: 0.008, rz: b.j(0.05) }); b.box(px, 1.02, 0.05, 0.22, 0.04, 0.05, { c: 'wood', m: M.wood, bevel: 0.008 }); }
        b.pop();
        vShield(b, rx + 0.32, 0.42, rz - 0.45, Math.PI / 2 + 0.1, 0.3, 'half', 'bone', 'ink', 0.25);
        vShield(b, rx + 0.36, 0.42, rz + 0.35, Math.PI / 2 - 0.1, 0.3, 'ring', 'ink', 'bone', 0.3);
      });
      b.unit(function () { b.dummy(5.7, 0, 3.5, { ry: -1.0, helm: true, shield: 'bone' }); b.dummy(6.1, 0, 5.5, { ry: -1.3 }); b.bucket(6.5, 0, 4.4); });

      b.part('Mess shelter');
      var mx = -8.6, mz = 0.6, mw = 3.0, md = 2.3, me = 2.25, mRise = 1.1;
      b.unit(function () {
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) {
          var px = mx + q[0] * mw / 2, pz = mz + q[1] * md / 2;
          b.box(px, -0.05, pz, 0.38, 0.2, 0.38, { c: b.stoneC('stoneDark'), m: M.stone, bevel: 0.05 });
          stave(b, px, 0.12, pz, me - 0.2, 0.2, { cap: false });
        });
      });
      b.unit(function () {
        [-1, 1].forEach(function (sd) { b.beam([mx - mw / 2 - 0.15, me - 0.08, mz + sd * md / 2], [mx + mw / 2 + 0.15, me - 0.08, mz + sd * md / 2], 0.1, { c: 'beam' }); });
        [-1, 1].forEach(function (sd) { b.beam([mx + sd * mw / 2, me - 0.06, mz - md / 2 - 0.12], [mx + sd * mw / 2, me - 0.06, mz + md / 2 + 0.12], 0.09, { c: 'beam' }); });
        [-1, 1].forEach(function (sd) { [-1, 1].forEach(function (e) { b.beam([mx + e * mw / 2, me - 0.75, mz + sd * md / 2], [mx + e * (mw / 2 - 0.55), me - 0.15, mz + sd * md / 2], 0.05, { c: 'beam' }); }); });
        // a plank gable at the back end
        var n = 8;
        for (var i = 0; i < n; i++) { var t = -md / 2 + (i + 0.5) * md / n, hh = (mRise - 0.1) * (1 - Math.abs(t) / (md / 2 + 0.05)); if (hh > 0.06) b.box(mx + mw / 2, me, mz + t, 0.05, hh, md / n - 0.02, { c: b.pick(PAL.barracks_plank), m: M.wood, bevel: 0.01 }); }
      });
      b.gableRoof(mx, me, mz, mw, md, mRise, { m: 'wood', over: 0.35, overX: 0.3, rows: 4, pitch: 0.3 });
      b.unit(function () {
        var th = Math.atan2(mRise, md / 2), hs = md / 2 + 0.35, ey = me - 0.35 * Math.tan(th);
        crossed(b, mx - mw / 2 - 0.3 + 0.02, mz, -Math.PI / 2, hs, ey, me + mRise, { s: 0.6, ext: 0.32, w: 0.08, lift: 0.12 });
        // a lantern hung from the ridge
        b.beam([mx - 0.4, me + mRise - 0.1, mz], [mx - 0.4, me - 0.3, mz], 0.012, { c: 'iron', m: M.metal, round: true, seg: 4 });
        b.box(mx - 0.4, me - 0.62, mz, 0.2, 0.3, 0.2, { c: 'iron', m: M.metal, bevel: 0.02 });
        b.box(mx - 0.4, me - 0.58, mz, 0.21, 0.22, 0.14, { c: '#ffd9a0', bucket: 'glow', glow: 1.6, ao: 0, jit: 0 });
        b.light(mx - 0.4, me - 0.5, mz, '#ffb060', 0.7);
      });
      b.unit(function () {
        // the long table, benches either side, and supper laid out
        b.table(mx, mz, 2.6, 0.85, {});
        [-1, 1].forEach(function (sd) { b.bench(mx, mz + sd * 0.72, 2.5, {}); });
        for (var i = 0; i < 6; i++) {
          var tx = mx - 1.0 + i * 0.4, sd = i % 2 ? 1 : -1;
          b.lathe(tx, 0.81, mz + sd * 0.22, [[0.01, 0], [0.09, 0.0], [0.13, 0.07], [0.12, 0.08], [0.01, 0.03]], { c: 'wood', m: M.wood, seg: 10 });
          b.cyl(tx + 0.12, 0.81, mz - sd * 0.25, 0.045, 0.12, { c: 'woodLight', m: M.wood, seg: 8 });
        }
        b.ball(mx + 0.2, 0.88, mz, 0.13, { c: '#c49a63', m: M.cloth, sz: 0.9, sy: 0.6, sx: 1.4, detail: 1 });
        b.ball(mx - 0.5, 0.88, mz + 0.05, 0.11, { c: '#b78c57', m: M.cloth, sy: 0.6, sx: 1.3, detail: 1 });
        b.lathe(mx + 0.85, 0.81, mz - 0.05, [[0.01, 0], [0.1, 0], [0.13, 0.12], [0.07, 0.26], [0.08, 0.32], [0.01, 0.32]], { c: '#8a7a68', m: M.stone, seg: 10 });
      });

      b.part('Mess fire');
      var fx = -6.15, fz = 4.0;
      b.unit(function () {
        for (var i = 0; i < 13; i++) { var a = i / 13 * Math.PI * 2, rr = 0.82; b.box(fx + Math.cos(a) * rr, 0.0, fz + Math.sin(a) * rr, 0.34, 0.24 + b.r() * 0.08, 0.26, { ry: -a, c: b.stoneC('stoneDark'), m: M.stone, bevel: 0.07 }); }
        b.cyl(fx, 0.0, fz, 0.7, 0.04, { c: '#3a332c', m: M.dirt, seg: 14 });
      });
      b.unit(function () {
        // logs in a star, the flames and the coals
        for (var i = 0; i < 5; i++) { var a = i / 5 * Math.PI * 2 + 0.3; b.beam([fx + Math.cos(a) * 0.62, 0.06, fz + Math.sin(a) * 0.62], [fx + Math.cos(a) * 0.08, 0.22, fz + Math.sin(a) * 0.08], 0.06, { c: i % 2 ? 'wood' : '#4a3a2c', round: true, seg: 6 }); }
        b.embers(fx, 0.06, fz, 0.45, { light: false });
        b.flame(fx, 0.08, fz, 0.85, { i: 1.4 });
      });
      b.unit(function () {
        // the iron tripod and the cauldron on its chain
        var top = 1.95;
        for (var i = 0; i < 3; i++) { var a = i / 3 * Math.PI * 2 + 0.5; b.beam([fx + Math.cos(a) * 1.0, 0, fz + Math.sin(a) * 1.0], [fx, top, fz], 0.03, { c: 'iron', m: M.metal }); }
        b.beam([fx, top, fz], [fx, 1.08, fz], 0.012, { c: 'iron', m: M.metal, round: true, seg: 4 });
        b.addGeo(new T.TorusGeometry(0.3, 0.012, 4, 14), { x: fx, y: 1.0, z: fz, rx: 0.0, c: 'iron', m: M.metal, ao: 0 });
        b.lathe(fx, 0.58, fz, [[0.01, 0], [0.18, 0.0], [0.33, 0.1], [0.36, 0.25], [0.31, 0.4], [0.32, 0.43], [0.27, 0.43]], { c: '#2b2b2c', m: M.metal, seg: 16 });
        b.cyl(fx, 0.96, fz, 0.27, 0.02, { c: '#9a7a52', m: M.water, seg: 14 });
      });
      b.unit(function () {
        // seats round the fire, a woodpile and kindling
        b.log(fx - 1.75, 0.16, fz + 0.9, 0.16, 1.5, { rz: -Math.PI / 2, ry: 0.6, c: 'wood' });
        b.log(fx - 0.3, 0.16, fz + 1.75, 0.16, 1.4, { rz: -Math.PI / 2, ry: -0.25, c: 'wood' });
        b.woodpile(-6.65, -1.9, { n: 4, len: 1.5, ry: Math.PI / 2 });
        b.woodpile(-6.6, -3.5, { n: 3, len: 1.3, ry: Math.PI / 2 });
        // the chopping block and its axe
        b.log(-7.75, 0, -1.95, 0.3, 0.5, { c: 'woodLight', seg: 9 });
        b.beam([-7.75, 0.5, -1.95], [-7.5, 1.05, -1.8], 0.025, { c: 'woodLight', round: true, seg: 5 });
        b.box(-7.77, 0.47, -1.97, 0.06, 0.16, 0.26, { c: 'iron', m: M.metal, bevel: 0.01, ry: 0.5 });
      });

      b.part('Stores and water');
      b.unit(function () {
        b.barrel(-6.55, 0, 1.25, {}); b.barrel(-6.45, 0, 2.0, { h: 0.82 });
        b.sack(-9.9, 0, 2.6, 0.5); b.sack(-9.45, 0, 2.85, 0.42); b.crate(-10.0, 0, -1.3, 0.7, { ry: 0.3 }); b.crate(-9.95, 0.7, -1.25, 0.55, { ry: -0.2 });
      });
      b.unit(function () {
        // a handcart of supplies for the mess: sacks of grain, a cask and a bundle of firewood
        b.cart(-8.9, 4.9, { ry: 0.75, load: function () {
          b.sack(-0.3, 0.71, -0.5, 0.5); b.sack(0.25, 0.71, -0.6, 0.46); b.sack(0.0, 0.71, 0.0, 0.48);
          b.barrel(0.3, 0.71, 0.55, { lie: true, ry: 0.2, h: 0.7, r: 0.26 });
          for (var i = 0; i < 4; i++) b.log(-0.45, 0.82 + (i % 2) * 0.16, 0.45 + i * 0.1, 0.07, 0.9, { rz: -Math.PI / 2, ry: 0.1, c: b.pick(PAL.wood) });
        } });
        b.crate(-10.3, 0, 4.0, 0.6, { ry: 0.6 }); b.bucket(-7.6, 0, 5.4);
      });
      b.unit(function () {
        // the water trough and a rain barrel by the wing, and the spears racked on its wall
        var tx = 1.9, tz = 1.05;
        b.box(tx, 0, tz, 0.55, 0.55, 1.45, { c: 'stone', m: M.stone, bevel: 0.05 });
        b.box(tx, 0.44, tz, 0.42, 0.06, 1.3, { c: '#5f7680', m: M.water, bevel: 0 });
        b.barrel(2.55, 0, 2.1, { h: 1.0, r: 0.36 });
        b.cyl(2.55, 0.985, 2.1, 0.3, 0.02, { c: '#5f7680', m: M.water, seg: 14 });
        b.rack(wx0 - 0.28, 0, 0.55, 1.0, { kind: 'spears', ry: -Math.PI / 2 });
      });
      b.unit(function () {
        // a straw tick and a blanket out to air on the bench by the door
        b.bench(-3.6, 0.55, 1.9, {});
        b.box(-3.6, 0.49, 0.55, 1.8, 0.14, 0.62, { c: 'straw', m: M.straw, bevel: 0.05 });
        b.box(-3.35, 0.62, 0.56, 0.9, 0.05, 0.66, { c: 'ink', m: M.cloth, bevel: 0.02 });
        b.box(-3.35, 0.665, 0.56, 0.9, 0.012, 0.08, { c: 'bone', m: M.cloth, bevel: 0 });
        b.crate(7.6, 0, 2.3, 0.7, { ry: 0.25 }); b.sack(6.85, 0, 2.4, 0.48); b.ropeCoil(7.3, 0, 3.05, 0.26);
      });

      b.part('Washing line');
      var la = [8.2, 0, 4.5], lb = [10.7, 0, 3.95];
      b.unit(function () {
        [la, lb].forEach(function (p) { b.post(p[0], 0, p[2], 0.06, 2.0, { c: 'wood' }); b.box(p[0], 1.9, p[2], 0.6, 0.08, 0.1, { c: 'wood', m: M.wood, ry: -Math.atan2(lb[2] - la[2], lb[0] - la[0]) }); });
        swag(b, [la[0], 1.92, la[2]], [lb[0], 1.92, lb[2]], 0.18, 0.015);
      });
      b.unit(function () {
        var ry = -Math.atan2(lb[2] - la[2], lb[0] - la[0]);
        [[0.22, 'ink', 'bone'], [0.5, 'bone', 'ink'], [0.78, 'inkGrey', 'bone']].forEach(function (q, i) {
          var t = q[0], px = la[0] + (lb[0] - la[0]) * t, pz = la[2] + (lb[2] - la[2]) * t, py = 1.92 - 0.18 * 4 * t * (1 - t) - 0.02;
          b.banner(px, py, pz, 0.62, 1.05 + i * 0.1, { c: q[1], emblem: 'none', tail: 'flat', trim: false, band: q[2], bandAt: 0.8, bandH: 0.06, ry: ry });
        });
      });

      b.part('Training ground');
      var gh = function (x, z) { return b.ground ? b.ground.height(x, z) : 0; };
      b.unit(function () {
        // a row of sword posts out on the green: each a stout post on a crossed timber foot, a bone-white padded
        // wrap bound with rope where the blows land, and an arm to parry
        [[-2.7, 9.2, 1.75], [-1.45, 9.55, 1.6], [-0.2, 9.9, 1.7]].forEach(function (p, i) {
          var x = p[0], z = p[1], y = gh(x, z) - 0.04, h = p[2];
          [0, Math.PI / 2].forEach(function (a) { b.box(x, y, z, 0.9, 0.12, 0.16, { ry: a + 0.3 * i, c: 'woodDark', m: M.wood, bevel: 0.03 }); });
          b.post(x, y, z, 0.12, h, { c: i === 1 ? 'woodLight' : 'wood' });
          b.box(x, y + h, z, 0.28, 0.08, 0.28, { c: 'woodDark', m: M.wood, taper: 0.5, ry: 0.4 });
          b.cyl(x, y + 0.62, z, 0.18, 0.5, { c: i === 1 ? '#e4ded2' : '#efebe4', m: M.cloth, seg: 10 });
          [0.6, 0.86, 1.1].forEach(function (yy) { b.cyl(x, y + yy, z, 0.19, 0.05, { c: 'rope', m: M.rope, seg: 10 }); });
          b.box(x, y + 1.32, z, 0.86, 0.09, 0.09, { ry: 0.5 + 0.35 * i, c: 'woodDark', m: M.wood, bevel: 0.02 });
        });
        // a wooden sword and a shield left leaning on the middle post
        b.beam([-1.25, gh(-1.25, 9.8), 9.8], [-1.32, gh(-1.25, 9.8) + 0.9, 9.72], 0.025, { c: 'woodLight', r2: 0.012 });
        b.box(-1.31, gh(-1.25, 9.8) + 0.66, 9.73, 0.22, 0.04, 0.05, { c: 'wood', m: M.wood, bevel: 0.01 });
        vShield(b, -1.75, gh(-1.75, 9.92) + 0.3, 9.92, -0.4, 0.3, 'cross', 'ink', 'bone', -0.28);
      });
      b.unit(function () {
        // a balance log on two trestles, shields stacked against it, a water bucket
        var lx = -4.8, lz = 10.2, lr = 0.3, L = 2.8;
        b.push(lx, gh(lx, lz) - 0.03, lz, lr);
        [-1, 1].forEach(function (e) {
          [-1, 1].forEach(function (sd) { b.beam([e * (L / 2 - 0.3), 0, sd * 0.38], [e * (L / 2 - 0.3), 0.62, -sd * 0.06], 0.05, { c: 'woodDark' }); });
        });
        b.log(-L / 2, 0.7, 0, 0.16, L, { rz: -Math.PI / 2, c: 'woodLight' });
        b.pop();
        [[0.75, 'half', 'bone', 'ink'], [1.15, 'ring', 'ink', 'bone']].forEach(function (s, i) {
          var p = by(lx, lz, lr, s[0], 0, 0.5 + i * 0.06);
          vShield(b, p[0], gh(p[0], p[2]) + 0.29, p[2], lr, 0.3, s[1], s[2], s[3], -0.3);
        });
        b.bucket(-2.05, gh(-2.05, 10.8) - 0.02, 10.8);
      });

      b.part('Ivy and flowers');
      b.unit(function () {
        b.ivy([[wx0 + 0.15, 0.4, wz1 + 0.3], [wx0 + 0.35, 1.6, wz1 + 0.3], [wx0 + 0.2, 2.8, wz1 + 0.3]], [0, 0, 1], { density: 6, spread: 0.45 });
        b.ivy([[x0 - 0.3, 0.4, z1 - 0.4], [x0 - 0.3, 1.4, z1 - 0.6], [x0 - 0.3, 2.2, z1 - 0.5]], [-1, 0, 0], { density: 5, spread: 0.4 });
        b.bush(wcx + 0.5, wz1 + 0.75, 0.5, { flowers: '#f3f1ec', n: 2 });
        b.bush(dX - 2.2, z1 + 0.75, 0.45, { flowers: '#e6e0d2', n: 2 });
        b.bush(x0 - 0.6, z1 + 0.5, 0.5, {});
      });

      b.life(function () {
        // the stripling warriors drilling in a line, the captain calling the count, the drummer setting the beat
        [-2.6, -1.4, -0.2, 1.0, 2.2].forEach(function (x, i) {
          b.figure(x, 4.3 + (i % 2) * 0.05, { role: 'soldier', pose: 'guard', ry: -0.12, team: 'bone', s: 0.9 });
        });
        b.figure(0.0, 6.0, { role: 'villager', pose: 'point', ry: -2.84, beard: true, cape: 'ink', c: '#4c4b48' });
        var drx = -3.25, drz = 5.35, dr = Math.PI / 2 - 0.25;
        b.figure(drx, drz, { role: 'villager', pose: 'barracks_drum', ry: dr, s: 0.8, c: '#6f6a62' });
        // the drum slung at the drummer's waist, and its sticks
        var dp = by(drx, drz, dr, -0.02, 0.0, 0.36 * 0.8);
        b.cyl(dp[0], 0.62, dp[2], 0.2, 0.26, { c: '#7a5a3e', m: M.wood, seg: 14 });
        b.cyl(dp[0], 0.875, dp[2], 0.205, 0.015, { c: '#e9e0cc', m: M.cloth, seg: 14 });
        [0.66, 0.84].forEach(function (yy) { b.cyl(dp[0], yy, dp[2], 0.21, 0.03, { c: 'ink', m: M.cloth, seg: 14, open: true }); });
        var hA = by(drx, drz, dr, -0.16 * 0.8, 0.95 * 0.8, 0.36 * 0.8), hB = by(drx, drz, dr, 0.18 * 0.8, 1.3 * 0.8, 0.3 * 0.8);
        b.beam(hA, [dp[0] + 0.02, 0.9, dp[2] + 0.02], 0.012, { c: 'woodLight', round: true, seg: 4 });
        b.beam(hB, [hB[0] + 0.05, hB[1] + 0.28, hB[2] - 0.1], 0.012, { c: 'woodLight', round: true, seg: 4 });
        // the cook at the cauldron with a long ladle
        var cx = -5.25, czk = 4.55, cry = Math.atan2(fx - cx, fz - czk);
        b.figure(cx, czk, { role: 'villager', pose: 'barracks_stir', ry: cry, c: '#7a7065', beard: true });
        var hand = by(cx, czk, cry, 0.0, 1.1, 0.42);
        b.beam(hand, [fx + 0.08, 0.82, fz + 0.06], 0.016, { c: 'woodLight', round: true, seg: 5 });
      });
    }
  });
})();
