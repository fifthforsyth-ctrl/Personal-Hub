// Sword armory: a stone hall with a timber-framed upper floor, a round watch turret, a covered rack yard of swords,
// spears and shields, and the crossed-sword banner. Built footings first, then the hall course by course, the
// upper floor panel by panel, the roof row by row, and last the racks, the banner and the people.
KIT.defineBuild('armory', {
  name: 'Sword armory', size: 'middle', need: 40,
  line: 'A stone armory with a watch turret, racks of swords, and the crossed-sword banner.',
  r: 14, flat: [18, 13], ground: 'cobble', path: [[1.2, 14.5], [1.0, 6.5]],
  frameY: 3.2, frameR: 12.5, glowAt: [5.3, 12.6, 1.5],
  trees: [{ x: -9.8, z: -6.2, kind: 'round', h: 6.4 }, { x: 12.2, z: 3.4, kind: 'cypress', h: 7.4 }, { x: -11.2, z: 2.5, kind: 'olive', h: 4.6 }],
  bushes: [{ x: 9.6, z: 6.5, r: 0.9, flowers: '#f3f1ec' }, { x: -7.8, z: 7.6, r: 0.8 }, { x: 11.6, z: 1.2, r: 0.7 }],
  build: function (b) {
    var M = KIT.M;
    // the hall: x -3.5..5.5, z -4.45..2.05; the upper floor overhangs the front by 0.35
    var cx = 1.0, cz = -1.2, W = 9, D = 6.5, T = 0.62, base = 0.55, H1 = 2.9, jet = 0.35;
    var x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2, top1 = base + H1;
    var tx = x1 + 0.3, tz = z1 - 0.35, tr = 1.65; // the turret, on the front-right corner, in the sun
    b.push(-0.5, 0, -0.2, 0);

    b.part('Footings');
    b.unit(function () { b.box(cx, -0.08, cz, W + 1.0, 0.36, D + 1.0, { c: 'stoneDark', bevel: 0.08 }); b.cyl(tx, -0.08, tz, tr + 0.45, 0.36, { c: 'stoneDark', m: M.stone, seg: 22, flat: true }); });
    b.unit(function () { b.box(cx, 0.28, cz, W + 0.55, 0.27, D + 0.55, { c: 'stone', bevel: 0.07 }); b.cyl(tx, 0.28, tz, tr + 0.25, 0.27, { c: 'stone', m: M.stone, seg: 22, flat: true }); });

    b.part('Stone hall');
    b.stoneBox(cx, cz, W, D, base, H1, T, {
      pal: 'stone', course: 0.33, len: 0.66,
      holes: [
        { side: 'front', at: 0.5, w: 1.9, y1: base + 2.75 },
        { side: 'front', at: -2.6, w: 1.0, y0: base + 1.0, y1: base + 2.35 },
        { side: 'left', at: 1.0, w: 1.0, y0: base + 1.0, y1: base + 2.35 }
      ]
    });

    b.part('Watch turret');
    var slit = function (a, y) { var f = Math.abs(((a - Math.PI * 0.45) + Math.PI * 3) % (Math.PI * 2) - Math.PI), g = Math.abs(((a - Math.PI * 0.15) + Math.PI * 3) % (Math.PI * 2) - Math.PI); return (f < 0.16 && ((y > 2.0 && y < 3.0) || (y > 5.2 && y < 6.2))) || (g < 0.16 && y > 3.6 && y < 4.6); };
    b.stoneRing(tx, tz, tr, base, 4.1, 0.6, { pal: 'stone', hole: slit, course: 0.41 });

    b.part('Doorway and windows');
    b.unit(function () { b.archDoor(cx + 0.5, base, z1, 1.6, 2.6, { depth: T + 0.15, keyC: 'sandstone', frameStone: 'sandstone', doorC: 'woodDark' }); });
    b.unit(function () {
      b.window(cx - 2.6, base + 1.05, z1 - 0.1, 0.8, 1.2, { arch: true, sillC: 'sandstone' });
      b.window(x0 + 0.1, base + 1.05, cz + 1.0, 0.8, 1.2, { arch: true, ry: -Math.PI / 2, sillC: 'sandstone' });
      // arrow slits
      [[Math.PI * 0.45, 2.1], [Math.PI * 0.45, 5.3], [Math.PI * 0.15, 3.7]].forEach(function (s) { b.box(tx + Math.cos(s[0]) * (tr + 0.05), s[1], tz + Math.sin(s[0]) * (tr + 0.05), 0.16, 0.85, 0.2, { ry: -s[0] - Math.PI / 2, c: '#1c1b1a', m: M.dark, bevel: 0, ao: 0 }); });
    });

    b.part('Upper floor');
    // joists run out under the overhang, on carved brackets
    b.unit(function () {
      for (var i = 0; i <= 13; i++) { var x = x0 + 0.25 + i * (W - 0.5) / 13; b.box(x, top1, z1 - 0.6, 0.2, 0.22, 1.25, { c: 'beam', m: M.wood, bevel: 0.03 }); }
      for (var k = 0; k < 4; k++) { var x2 = x0 + 1.4 + k * 2.3; b.beam([x2, top1 - 0.75, z1 + 0.02], [x2, top1 + 0.02, z1 + jet + 0.05], 0.08, { c: 'beam' }); }
    });
    var u0 = top1 + 0.22, H2 = 2.55;
    b.unit(function () { b.box(cx + 0.1, u0 - 0.05, cz + jet / 2, W + 0.15, 0.12, D + jet + 0.1, { c: 'beam', m: M.wood, bevel: 0.02 }); });
    b.timberWall(x0 + 0.35, z1 + jet, x1, z1 + jet, u0, { h: H2, post: 1.25, windows: [{ t: 1.9, w: 0.8, y0: 0.8, y1: 1.95, shutters: '#1f1e1c', flowers: '#f3f1ec' }, { t: 5.2, w: 0.8, y0: 0.8, y1: 1.95, shutters: '#1f1e1c', flowers: '#e6e3dc' }, { t: 7.7, w: 0.7, y0: 0.85, y1: 1.9, shutters: '#1f1e1c' }] });
    b.timberWall(x1, z1 + jet, x1, z0, u0, { h: H2, post: 1.3, windows: [{ t: 3.4, w: 0.7, y0: 0.85, y1: 1.9, shutters: '#1f1e1c' }] });
    b.timberWall(x0 + 0.35, z0, x0 + 0.35, z1 + jet, u0, { h: H2, post: 1.3, windows: [{ t: 3.8, w: 0.7, y0: 0.85, y1: 1.9, shutters: '#1f1e1c', flowers: '#f3f1ec' }] });
    b.timberWall(x1, z0, x0 + 0.35, z0, u0, { h: H2, post: 1.3 });

    b.part('Turret, upper');
    b.stoneRing(tx, tz, tr, base + 4.1, 3.7, 0.6, { pal: 'stone', hole: slit, course: 0.41 });
    b.unit(function () {
      // a ring of corbels and a jutting parapet course
      for (var i = 0; i < 16; i++) { var a = i / 16 * Math.PI * 2; b.box(tx + Math.cos(a) * (tr + 0.12), base + 7.8, tz + Math.sin(a) * (tr + 0.12), 0.32, 0.38, 0.5, { ry: -a - Math.PI / 2, c: 'sandstone', bevel: 0.05, taper: 1.0 }); }
      b.cyl(tx, base + 8.18, tz, tr + 0.36, 0.3, { c: 'sandstone', m: M.stone, seg: 24, flat: true });
    });

    b.part('Roof');
    var rw = W + jet, rcx = cx - jet / 2, rd = D + jet, rcz = cz + jet / 2, rise = 3.25, eave = u0 + H2;
    b.unit(function () { [-1, 1].forEach(function (s) { b.gableEnd(rcx + s * (rw / 2 - 0.12), eave, rcz, rd - 0.1, rise - 0.15, 0.24, { c: 'plaster' }); }); });
    b.unit(function () { [-1, 1].forEach(function (s) { var x = rcx + s * (rw / 2 + 0.02); b.beam([x, eave, rcz - rd / 2 + 0.3], [x, eave + rise - 0.15, rcz], 0.08, { c: 'beam' }); b.beam([x, eave, rcz + rd / 2 - 0.3], [x, eave + rise - 0.15, rcz], 0.08, { c: 'beam' }); b.beam([x, eave + 0.1, rcz], [x, eave + rise - 0.2, rcz], 0.08, { c: 'beam' }); b.beam([x, eave + 1.2, rcz - 1.2], [x, eave + 1.2, rcz + 1.2], 0.07, { c: 'beam' }); }); });
    b.gableRoof(rcx, eave, rcz, rw, rd, rise, { m: 'tile', over: 0.6, rows: 8, overX: 0.45 });

    b.part('Dormer and chimney');
    b.unit(function () {
      var dx = cx + 0.5, dz = z1 + jet - 0.5;
      b.box(dx, eave - 0.1, dz - 0.6, 1.55, 1.45, 1.6, { c: 'plaster', m: M.plaster, bevel: 0.02 });
      b.window(dx, eave + 0.25, dz + 0.21, 0.6, 0.85, { sillC: 'beam', sillM: M.wood, lintelC: 'beam', mullion: true });
      b.beam([dx - 0.8, eave - 0.1, dz + 0.2], [dx - 0.8, eave + 1.35, dz + 0.2], 0.07, { c: 'beam' });
      b.beam([dx + 0.8, eave - 0.1, dz + 0.2], [dx + 0.8, eave + 1.35, dz + 0.2], 0.07, { c: 'beam' });
      b.push(dx, eave + 1.35, dz - 0.55, Math.PI / 2);
      b.gableRoof(0, 0, 0, 2.1, 1.7, 0.85, { m: 'tile', over: 0.18, rows: 3, rowsAsUnits: false, overX: 0.05 });
      b.pop();
    });
    b.unit(function () {
      var chx = x1 - 1.3, chz = cz - 1.6;
      b.box(chx, eave + 0.5, chz, 0.95, 3.4, 0.95, { c: 'stone', bevel: 0.06 });
      b.box(chx, eave + 3.9, chz, 1.15, 0.22, 1.15, { c: 'sandstone', bevel: 0.05 });
      b.box(chx, eave + 4.12, chz, 0.5, 0.35, 0.5, { c: 'tile', m: M.tile, bevel: 0.05 });
    });

    b.part('Turret roof');
    b.coneRoof(tx, base + 8.42, tz, tr + 0.62, 4.0, { m: 'slate', rows: 6, flare: 0.5, seg: 20 });
    b.unit(function () { b.flag(tx, base + 12.35, tz, 1.5, 1.3, 0.55, { c: 'ember', pennant: true, emblem: 'none', ry: -0.6 }); });

    b.part('Banner and sign');
    b.unit(function () {
      // hung flat to the front from an iron arm, so it catches the sun
      var bx = tx - 0.1, bz = tz + tr + 0.45;
      b.beam([bx, base + 7.3, bz - 0.45], [bx, base + 7.3, bz + 0.05], 0.045, { c: 'iron', m: M.metal });
      b.beam([bx - 0.75, base + 7.32, bz], [bx + 0.75, base + 7.32, bz], 0.04, { c: 'iron', m: M.metal, round: true });
      b.banner(bx, base + 7.3, bz, 1.35, 3.2, { c: 'ink', emblem: 'swords', ec: '#f1eee8', es: 0.85, tail: 'swallow', band: 'ember', bandAt: 0.72, bandH: 0.06, trim: 'iron', ry: 0 });
    });
    b.unit(function () {
      var sx = cx + 1.75, sy = base + 3.0;
      b.beam([sx, sy, z1 + 0.02], [sx, sy, z1 + 1.0], 0.035, { c: 'iron', m: M.metal });
      b.beam([sx, sy - 0.45, z1 + 0.02], [sx, sy, z1 + 0.7], 0.025, { c: 'iron', m: M.metal });
      b.push(sx, sy - 0.08, z1 + 0.78, Math.PI / 2);
      b.box(0, -0.75, 0, 0.9, 0.65, 0.06, { c: 'ink', m: M.paint, bevel: 0.015 });
      b.emblem(0, -0.43, 0.02, 0.55, 'swords', '#f1eee8');
      b.emblem(0, -0.43, -0.02, 0.55, 'swords', '#f1eee8');
      b.pop();
    });
    b.unit(function () { [-0.65, 1.65].forEach(function (x) { b.torch(cx + x, base + 2.0, z1 + 0.02, { s: 0.6 }); }); });

    b.part('Rack yard');
    // a striped canvas awning off the left wall, open to the yard, over racks of swords, spears and bows
    var yx0 = x0 - 3.4, yx1 = x0, yz0 = z0 + 0.6, yz1 = z1 - 0.5;
    b.unit(function () { b.box(x0 - 0.12, base + 2.85, (yz0 + yz1) / 2, 0.24, 0.2, yz1 - yz0 + 0.3, { c: 'beam', m: M.wood, bevel: 0.03 }); });
    b.unit(function () { b.awning(x0 - 0.1, base + 2.95, (yz0 + yz1) / 2, yz1 - yz0 + 0.2, 3.3, 1.05, { ry: -Math.PI / 2, stripes: ['#1f1e1c', '#efebe4'], n: 7 }); });
    b.unit(function () { b.rack(x0 - 1.8, 0, yz0 + 0.8, 2.6, { kind: 'swords' }); });
    b.unit(function () { b.rack(x0 - 1.9, 0, yz0 + 2.6, 2.4, { kind: 'spears' }); });
    b.unit(function () { b.rack(x0 - 1.8, 0, yz1 - 0.6, 2.2, { kind: 'bows', tier: 2 }); });

    b.part('Arms and stores');
        b.unit(function () {
      // an armour stand: a full harness on a cross of timber
      var ax = cx + 3.1, az = z1 + 2.1;
      b.post(ax, 0, az, 0.05, 1.5, { c: 'beam' }); b.box(ax, 0, az, 0.6, 0.06, 0.6, { c: 'beam', m: M.wood });
      b.lathe(ax, 0.75, az, [[0.18, 0], [0.26, 0.12], [0.22, 0.45], [0.28, 0.68], [0.14, 0.8], [0.01, 0.82]], { c: 'steel', m: M.metal, seg: 12 });
      [-1, 1].forEach(function (s) { b.ball(ax + s * 0.3, 1.5, az, 0.13, { c: 'steel', m: M.metal, sy: 0.8 }); b.beam([ax + s * 0.32, 1.45, az], [ax + s * 0.38, 0.95, az + 0.05], 0.06, { c: 'steel', m: M.metal, round: true }); });
      b.lathe(ax, 1.6, az, [[0.17, 0], [0.18, 0.14], [0.13, 0.27], [0.01, 0.3]], { c: 'steel', m: M.metal, seg: 12 });
      b.box(ax, 1.68, az + 0.15, 0.22, 0.04, 0.04, { c: '#2b2420', m: M.dark, bevel: 0 });
      b.lathe(ax, 0.62, az, [[0.24, 0], [0.27, 0.16], [0.2, 0.2]], { c: 'ink', m: M.cloth, seg: 12 });
    });
    b.unit(function () { b.anvil(cx + 5.35, 0, z1 + 2.75, { ry: 0.4 }); });
    b.unit(function () {
      // the grindstone
      var gx = cx + 6.9, gz = z1 + 4.4;
      b.box(gx, 0, gz, 0.9, 0.5, 0.35, { c: 'wood', m: M.wood }); b.cyl(gx, 0.85, gz - 0.02, 0.42, 0.16, { c: '#b9b2a2', m: M.stone, rx: Math.PI / 2, seg: 16, flat: true });
      b.beam([gx - 0.45, 0.5, gz], [gx - 0.45, 0.95, gz], 0.04, { c: 'wood' }); b.beam([gx + 0.45, 0.5, gz], [gx + 0.45, 0.95, gz], 0.04, { c: 'wood' });
      b.bucket(gx + 0.8, 0, gz + 0.3);
    });
    b.unit(function () { b.barrel(x0 - 0.9, 0, z1 + 0.9, {}); b.barrel(x0 - 1.6, 0, z1 + 1.4, { h: 0.82 }); b.barrel(x0 - 1.9, 0, z1 + 0.4, { lie: true, ry: 0.3 }); b.crate(x0 - 0.7, 0, z1 + 1.9, 0.7, { ry: 0.3 }); });
    b.unit(function () { b.crate(yx0 + 0.4, 0, z1 + 0.55, 0.75, { ry: -0.2 }); b.crate(yx0 + 0.45, 0.75, z1 + 0.6, 0.6, { ry: 0.25 }); b.sack(yx0 + 1.25, 0, z1 + 0.6, 0.5); b.sack(yx0 + 1.0, 0, z1 + 1.1, 0.42); });
    b.unit(function () { b.dummy(cx - 3.2, 0, z1 + 4.2, { ry: 0.6, helm: true, shield: 'bone' }); b.dummy(cx - 4.6, 0, z1 + 3.4, { ry: 0.9 }); });
    b.unit(function () { [0, 1, 2].forEach(function (i) { b.shield(cx - 3.45 + i * 0.55, 0.45, z1 + 0.34, { kind: i === 1 ? 'round' : 'heater', c: i === 1 ? 'inkGrey' : i === 0 ? 'ink' : 'bone', emblem: i === 1 ? 'none' : 'cross', s: 0.7, rx: -0.3, ry: 0.2 }); }); });

    b.part('Ivy and flowers');
    b.unit(function () {
      var a = Math.PI * 0.78, nx = Math.cos(a), nz = Math.sin(a), px = tx + nx * (tr + 0.3), pz = tz + nz * (tr + 0.3);
      b.ivy([[px, 0.4, pz], [px + 0.1, 2.2, pz - 0.05], [px - 0.1, 4.0, pz + 0.1], [px + 0.05, 5.5, pz]], [nx, 0, nz], { density: 7, spread: 0.55 });
      b.ivy([[x0 + 0.3, 0.4, z1 + 0.3], [x0 + 0.6, 1.8, z1 + 0.3], [x0 + 0.4, 3.0, z1 + 0.3]], [0, 0, 1], { density: 5, spread: 0.45 });
      b.bush(cx - 1.4, z1 + 0.7, 0.55, { flowers: '#f3f1ec', n: 2 });
      b.bush(cx + 2.4, z1 + 0.6, 0.5, { flowers: '#e6e0d2', n: 2 });
    });

    b.life(function () {
      b.figure(cx + 1.9, z1 + 2.2, { role: 'knight', pose: 'vigil', ry: -0.5 });
      b.figure(cx - 0.75, z1 + 0.85, { role: 'soldier', pose: 'spear', ry: -0.25 });
      b.figure(cx + 5.95, z1 + 2.45, { role: 'smith', pose: 'hammer', ry: -1.2, c: '#6e5a44' });
      b.figure(cx - 0.2, z1 + 5.2, { role: 'soldier', pose: 'guard', ry: Math.PI / 2 + 0.2 });
      b.figure(cx + 1.25, z1 + 5.0, { role: 'soldier', pose: 'swing', ry: -Math.PI / 2 + 0.1, team: 'bone' });
      b.figure(cx + 0.4, z1 + 2.0, { role: 'villager', pose: 'carry', ry: -0.6 });
      b.figure(cx - 2.6, z1 + 6.6, { role: 'child', pose: 'run', ry: -2.2 });
      b.figure(cx + 3.1, z1 + 6.2, { role: 'villager', pose: 'cheer', ry: -2.4, c: '#5c5e62' });
    });
    b.pop();
  }
});
