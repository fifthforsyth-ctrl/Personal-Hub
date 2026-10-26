// Painterly village kit, part 6: a village. The builds stand on their plots on one ground, the way each build stands
// on its own island: a turf top levelled under every plot and the plaza, paths of trodden earth between them, trees,
// bushes and a pond on the green between, the turf's lip and a skirt of earth and rock below. The village's people
// stand on it too, each laid as a step of their own so a count shows as many as there are.
//
//   KIT.village.ground(o)       -> { group, mats, uniforms, units, height(x, z), R }  the ground for the whole village
//   KIT.village.stake(o)        -> { group, mats }   pegs and string round an empty plot waiting for a build
//   KIT.village.people(list, o) -> { group, mats, units, show(n) }   figures, each its own step, shown n at a time
//   KIT.village.ghosts(mk, on)     give a build its pencil meshes (what is still to come) or take them away
//   KIT.village.torches(list, near) the lit torches of every build, in the world, nearest `near` first
//   KIT.village.air(o)             the village's own air over every look ({ fog: [near, far], cloud }); null to clear
//   KIT.village.dispose(made)      a ground, stake, people or build off the GPU
//
// Builds are KIT.make(kind, { island: false, ground: { height }, detail: 1, ghost: false, cull: true }); the app
// places their groups. Positions are metres in the village, +y up, the plaza at the origin.
(function () {
  var T = THREE, KIT = window.KIT, U = KIT.util, M = KIT.M, PAL = KIT.PAL, G = KIT.geo;
  var clamp = U.clamp, lerp = U.lerp, noise3 = U.noise3, fbm3 = U.fbm3, smooth = U.smooth;
  var V = KIT.village = {};

  // pieces made outside KIT.make take the same box detail the builds do, and leave no cached pieces behind
  function withDetail(detail, fn) {
    var was = KIT.boxDetail;
    if (detail !== undefined) KIT.boxDetail = detail;
    KIT.dropGeoCache();
    try { return fn(); } finally { KIT.dropGeoCache(); KIT.boxDetail = was; }
  }
  function finish(b, o) {
    var Uu = KIT.buildUniforms(), mats = KIT.makeMaterials(Uu);
    var out = b.finish(mats, { ghost: false, cull: !!o.cull, shadows: o.shadows });
    out.uniforms = Uu; out.mats = mats; Uu.uTotal.value = out.units; Uu.uShown.value = out.units + 1;
    return out;
  }

  // A flat: a rectangle w x d (metres, in its own frame) centred at (x, z) and turned ry about +y, as a build's group is.
  // The distance from (x, z) to it, m metres out from its edge; and where (x, z) is in its frame.
  function local(f, x, z) { var dx = x - f.x, dz = z - f.z, c = f.cos, s = f.sin; return [dx * c - dz * s, dx * s + dz * c]; }
  function rectD(f, x, z, m) { var l = local(f, x, z), dx = Math.max(0, Math.abs(l[0]) - f.w / 2 - m), dz = Math.max(0, Math.abs(l[1]) - f.d / 2 - m); return Math.hypot(dx, dz); }
  function prep(f) { f = Object.assign({ ry: 0 }, f); f.cos = Math.cos(f.ry); f.sin = Math.sin(f.ry); return f; }
  function segD(x, z, a, c) { var vx = c[0] - a[0], vz = c[1] - a[1], L2 = vx * vx + vz * vz, t = clamp(((x - a[0]) * vx + (z - a[1]) * vz) / (L2 || 1), 0, 1); return Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t); }

  // ------------------------------------------------------------------ the ground
  // o: { r (radius), seed, detail, cull,
  //      flats: [{ x, z, w, d, ry, s, ground: 'grass'|'dirt'|'cobble'|'paving', skip(lx, lz) (no cobble there, in the
  //               build's own unscaled frame, as its islandOpts.cobbleSkip) }],
  //      plaza: { x, z, w, d } (paved, with a flag of the Hub's orange, lamps and benches),
  //      paths: [[[x, z], ...], ...], nature: [{ x, z, s (the tile's size), kind: 'forest'|'orchard'|'pond'|'meadow' }],
  //      tufts (how many tufts of grass; by the area if left out), trees: [{ x, z, kind, h }] }
  V.ground = function (o) {
    o = o || {};
    return withDetail(o.detail, function () { return ground(o); });
  };
  function ground(o) {
    var b = new KIT.Builder(o.seed || 7, {}), r = b.r;
    var R = o.r || 60, depth = o.depth || Math.max(14, R * 0.3), sd = (o.seed || 1) * 7.3;
    // rings about a metre apart, so the edges of the plots and the paths read
    var NS = o.ns || Math.max(192, Math.min(360, Math.round(R * 3.2))), NR = o.nr || Math.max(26, Math.round(R / 1.15));
    var flats = (o.flats || []).map(prep), paths = o.paths || [], plaza = o.plaza ? prep(Object.assign({ ground: 'paving' }, o.plaza)) : null;
    if (plaza) flats.push(plaza);
    var ponds = (o.nature || []).filter(function (n) { return n.kind === 'pond'; }).map(function (n) { return { x: n.x + (r() - 0.5) * n.s * 0.15, z: n.z + (r() - 0.5) * n.s * 0.15, r: n.s * (0.22 + r() * 0.05), s: n.s }; });
    // A pond stays on the turf: its mud and reeds reach about 1.32 times its radius, so one whose reeds would reach the
    // lip is drawn in toward the middle (a little: it keeps to its own tile), then made smaller; one that would run onto a
    // plot or the plaza is made smaller too, and one left too small to read is dropped.
    var PONDR = 1.32;
    ponds = ponds.filter(function (p) {
      var lim = R * 0.84, d = Math.hypot(p.x, p.z), over = d + p.r * PONDR - lim;
      if (over > 0 && d > 0) {
        var pull = Math.min(over, p.s * 0.3), k = (d - pull) / d;
        p.x *= k; p.z *= k; d -= pull;
        if (d + p.r * PONDR > lim) p.r = (lim - d) / PONDR;
      }
      var room = inFlat(p.x, p.z, 0) - 1;
      if (p.r * PONDR > room) p.r = room / PONDR;
      return p.r >= 3.5;
    });
    function edgeR(a) { return R * (1 + 0.04 * noise3(Math.cos(a) * 1.6 + sd, Math.sin(a) * 1.6, 0.5) + 0.02 * noise3(Math.cos(a) * 4 + sd, Math.sin(a) * 4, 2.5)); }
    function inFlat(x, z, m) { var best = 1e9; for (var i = 0; i < flats.length; i++) best = Math.min(best, rectD(flats[i], x, z, m)); return best; }
    function pathD(x, z) { var best = 1e9; for (var p = 0; p < paths.length; p++) for (var i = 0; i < paths[p].length - 1; i++) best = Math.min(best, segD(x, z, paths[p][i], paths[p][i + 1])); return best; }
    function pondK(x, z) { var k = 0; for (var i = 0; i < ponds.length; i++) k = Math.max(k, 1 - smooth(0.75, 1.3, Math.hypot(x - ponds[i].x, z - ponds[i].z) / ponds[i].r)); return k; }
    function height(x, z, rr) {
      var d = inFlat(x, z, 0.6), lift = smooth(0, 4, d);
      var hgt = (fbm3(x * 0.11 + sd, 0, z * 0.11, 3) * 0.55 + 0.22) * lift;
      var pd = pathD(x, z); hgt -= (1 - smooth(0.6, 1.8, pd)) * 0.06 * lift;
      var pk = pondK(x, z); if (pk > 0) hgt = lerp(hgt, -0.5, pk);
      var lip = smooth(R * 0.9, R * 1.0, rr); hgt -= lip * lip * 0.55;
      return hgt;
    }
    var GC = { dirt: new T.Color('#b0916a'), sand: new T.Color('#d8bf8c'), paving: new T.Color('#c2b59c'), cobble: new T.Color('#6f6658') };
    var MUD = new T.Color('#6f6a55');
    function groundCol(x, y, z) {
      var n = fbm3(x * 0.18 + sd, 3, z * 0.18, 3), n2 = noise3(x * 0.9, 1, z * 0.9);
      var c = new T.Color('#5d6b4c').lerp(new T.Color('#76805e'), clamp(n * 1.2 + 0.35, 0, 1) * 0.4).lerp(new T.Color('#4a5842'), clamp(-n * 1.5, 0, 1) * 0.6);
      c.offsetHSL(0, 0, n2 * 0.03);
      var pd = pathD(x, z), dirt = new T.Color(PAL.dirt[0]).offsetHSL(0, 0, n2 * 0.04);
      c.lerp(dirt, 1 - smooth(0.85, 1.7 + n * 0.4, pd));
      for (var i = 0; i < flats.length; i++) {
        var f = flats[i], g = f.ground || 'grass'; if (g === 'grass') continue;
        var fd = rectD(f, x, z, 0); if (fd > 2.5) continue;
        c.lerp(GC[g].clone().offsetHSL(0, 0, n2 * 0.05), 1 - smooth(0.0, 1.2 + n * 0.8, fd));
      }
      var pk = pondK(x, z); if (pk > 0) c.lerp(MUD, pk);
      return c;
    }
    // the top: polar rings, levelled under the plots
    var pos = [], idx = [], i, j;
    pos.push(0, height(0, 0, 0), 0);
    for (j = 1; j <= NR; j++) for (i = 0; i < NS; i++) {
      var a = i / NS * Math.PI * 2, f = j / NR, er = edgeR(a), rr = er * f, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      pos.push(x, height(x, z, rr / er * R), z);
    }
    for (i = 0; i < NS; i++) idx.push(0, 1 + (i + 1) % NS, 1 + i);
    for (j = 1; j < NR; j++) for (i = 0; i < NS; i++) { var a0 = 1 + (j - 1) * NS + i, a1 = 1 + (j - 1) * NS + (i + 1) % NS, b0 = 1 + j * NS + i, b1 = 1 + j * NS + (i + 1) % NS; idx.push(a0, a1, b1, a0, b1, b0); }
    var top = new T.BufferGeometry(); top.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); top.setIndex(idx); top.computeVertexNormals();
    b.base(function () { b.addGeo(top, { c: '#ffffff', m: M.grass, ao: 0, jit: 0, vary: 0.05, colors: groundCol }); });
    // the skirt: the village floats, as every build's island does
    var K = 9, sp = [], si = [], rim = [];
    for (i = 0; i < NS; i++) { var a2 = i / NS * Math.PI * 2, er2 = edgeR(a2); rim.push([Math.cos(a2) * er2, height(Math.cos(a2) * er2, Math.sin(a2) * er2, R), Math.sin(a2) * er2]); }
    for (var k = 0; k <= K; k++) for (i = 0; i < NS; i++) {
      var t = k / K, a3 = i / NS * Math.PI * 2, shrink = lerp(1.0, 0.18, Math.pow(t, 1.25)) * (1 + noise3(Math.cos(a3) * 3 + sd, t * 4, Math.sin(a3) * 3) * 0.12 * (t > 0.05 ? 1 : 0));
      var rp = rim[i], yy = k === 0 ? rp[1] - 0.05 : rp[1] - 0.25 - t * depth * (1 + noise3(Math.cos(a3) * 2 + 9, Math.sin(a3) * 2, sd) * 0.25) - Math.pow(t, 3) * depth * 0.2;
      sp.push(rp[0] * shrink, yy, rp[2] * shrink);
    }
    sp.push(0, -depth * 1.35, 0);
    var tip = (K + 1) * NS;
    for (k = 0; k < K; k++) for (i = 0; i < NS; i++) { var c0 = k * NS + i, c1 = k * NS + (i + 1) % NS, d0 = (k + 1) * NS + i, d1 = (k + 1) * NS + (i + 1) % NS; si.push(c0, d1, c1, c0, d0, d1); }
    for (i = 0; i < NS; i++) si.push(K * NS + i, tip, K * NS + (i + 1) % NS);
    var skirt = new T.BufferGeometry(); skirt.setAttribute('position', new T.Float32BufferAttribute(sp, 3)); skirt.setIndex(si); skirt = G.flat(skirt);
    var strata = ['#5d5348', '#6f6556', '#857a69', '#9a8f7d', '#827a70', '#958d82', '#77716a', '#8b857c', '#67625c'];
    b.base(function () {
      b.addGeo(skirt, { c: '#ffffff', m: M.soil, ao: 0, jit: 0, vary: 0.08, colors: function (x, y, z) {
        var t2 = clamp(-y / depth, 0, 1.3), n = noise3(x * 0.5 + sd, y * 1.4, z * 0.5);
        if (y > -0.45) return '#6d7b57';
        return new T.Color(strata[Math.floor(clamp(t2 * 7 + n * 0.9, 0, strata.length - 1))]).offsetHSL(0, 0, n * 0.03);
      } });
    });
    var H = function (x, z) { return height(x, z, Math.hypot(x, z)); };
    // the ponds: still water a little below the turf, reeds and stones round the edge
    b.base(function () {
      ponds.forEach(function (p) {
        var g = new T.CircleGeometry(p.r * 1.02, 40); g.rotateX(-Math.PI / 2);
        var ps = g.attributes.position;
        for (var q = 1; q < ps.count; q++) { var px = ps.getX(q), pz = ps.getZ(q), ang = Math.atan2(pz, px), kk = 1 + noise3(Math.cos(ang) * 2 + p.x, Math.sin(ang) * 2, 3.3) * 0.12; ps.setX(q, px * kk); ps.setZ(q, pz * kk); }
        g.computeVertexNormals();
        b.addGeo(g, { x: p.x, y: -0.2, z: p.z, c: '#8aa3a6', m: M.water, ao: 0, jit: 0, vary: 0.03 });
        for (var e = 0; e < 26; e++) {
          var a4 = r() * Math.PI * 2, d4 = p.r * (0.95 + r() * 0.3), x4 = p.x + Math.cos(a4) * d4, z4 = p.z + Math.sin(a4) * d4;
          // never out over the lip, as the trees keep off it
          if (Math.hypot(x4, z4) > R * 0.9) continue;
          if (r() < 0.75) b.grass(x4, H(x4, z4), z4, 0.6 + r() * 0.5, { c: b.pick(['#7d8a5e', '#6e7b52', '#8d9668']) });
          else b.rock(x4, H(x4, z4) - 0.08, z4, 0.25 + r() * 0.3);
        }
      });
    });
    // dressing: tufts and flowers off the plots and paths, rocks on the lip
    b.base(function () {
      var tufts = o.tufts === undefined ? Math.min(4500, Math.round(R * R * 0.32)) : o.tufts, laid = 0;
      for (var tt = 0; tt < tufts * 3 && laid < tufts; tt++) {
        var a5 = r() * Math.PI * 2, rr5 = edgeR(a5) * Math.sqrt(0.02 + r() * 0.95), x5 = Math.cos(a5) * rr5, z5 = Math.sin(a5) * rr5;
        if (inFlat(x5, z5, 0.4) < 0.01 || pathD(x5, z5) < 1.5 || pondK(x5, z5) > 0.1) continue;
        var hh = height(x5, z5, rr5 / edgeR(a5) * R);
        b.grass(x5, hh, z5, 0.35 + r() * 0.35); laid++;
        if (r() < 0.2) b.flowers(x5, hh, z5, 0.35, { n: 4 + Math.round(r() * 5) });
      }
      for (var q2 = 0; q2 < Math.round(R * 0.8); q2++) { var a6 = r() * Math.PI * 2, er6 = edgeR(a6) * (0.93 + r() * 0.05), x6 = Math.cos(a6) * er6, z6 = Math.sin(a6) * er6; if (pathD(x6, z6) < 1.6) continue; b.rock(x6, height(x6, z6, R * 0.95) - 0.1, z6, 0.3 + r() * 0.5); }
    });
    // the green between the plots: woods, an orchard, a meadow, trees round the pond
    var trees = (o.trees || []).slice(), bushes = [];
    var clear = function (x, z, m) { return inFlat(x, z, m) > 0.01 && pathD(x, z) > m + 1.2 && pondK(x, z) <= 0 && Math.hypot(x, z) < R * 0.86; };
    (o.nature || []).forEach(function (n) {
      var s = n.s, k2, x7, z7, tries;
      if (n.kind === 'forest') {
        for (k2 = 0, tries = 0; k2 < 9 && tries < 60; tries++) { x7 = n.x + (r() - 0.5) * s * 0.78; z7 = n.z + (r() - 0.5) * s * 0.78; if (!clear(x7, z7, 2.5)) continue; trees.push({ x: x7, z: z7, kind: b.pick(['pine', 'pine', 'round', 'cypress', 'birch']), h: 5 + r() * 3.5 }); k2++; }
        for (k2 = 0; k2 < 4; k2++) { x7 = n.x + (r() - 0.5) * s * 0.8; z7 = n.z + (r() - 0.5) * s * 0.8; if (clear(x7, z7, 1.5)) bushes.push({ x: x7, z: z7, r: 0.7 + r() * 0.5 }); }
      } else if (n.kind === 'orchard') {
        for (var gx = -1; gx <= 1; gx++) for (var gz = -1; gz <= 1; gz++) { x7 = n.x + gx * s * 0.24 + (r() - 0.5) * 1.2; z7 = n.z + gz * s * 0.24 + (r() - 0.5) * 1.2; if (clear(x7, z7, 2)) trees.push({ x: x7, z: z7, kind: r() < 0.6 ? 'round' : 'olive', h: 3.6 + r() * 1.2 }); }
      } else if (n.kind === 'meadow') {
        for (k2 = 0; k2 < 6; k2++) { x7 = n.x + (r() - 0.5) * s * 0.7; z7 = n.z + (r() - 0.5) * s * 0.7; if (clear(x7, z7, 1.5)) bushes.push({ x: x7, z: z7, r: 0.6 + r() * 0.5, flowers: b.pick(['#f3f1ec', '#efebe4', '#e6e3dc']) }); }
        for (k2 = 0; k2 < 2; k2++) { x7 = n.x + (r() - 0.5) * s * 0.6; z7 = n.z + (r() - 0.5) * s * 0.6; if (clear(x7, z7, 2.5)) trees.push({ x: x7, z: z7, kind: 'round', h: 5 + r() * 2 }); }
      } else if (n.kind === 'pond') {
        for (k2 = 0, tries = 0; k2 < 3 && tries < 30; tries++) { var a8 = r() * Math.PI * 2, d8 = s * (0.33 + r() * 0.1); x7 = n.x + Math.cos(a8) * d8; z7 = n.z + Math.sin(a8) * d8; if (!clear(x7, z7, 2.5)) continue; trees.push({ x: x7, z: z7, kind: r() < 0.5 ? 'birch' : 'round', h: 4.5 + r() * 2.5 }); k2++; }
      }
    });
    b.base(function () {
      trees.forEach(function (tr) { b.tree(tr.x, tr.z, { kind: tr.kind, h: tr.h, y: H(tr.x, tr.z) - 0.05 }); });
      bushes.concat(o.bushes || []).forEach(function (bu) { b.bush(bu.x, bu.z, bu.r || 0.8, { y: H(bu.x, bu.z) - 0.1, flowers: bu.flowers }); });
    });
    // cobbles or flags on the plots that ask for them, ragged at the edge as on an island
    b.base(function () {
      flats.forEach(function (fl) {
        if (fl.ground !== 'cobble' && fl.ground !== 'paving') return;
        var step = fl.ground === 'paving' ? 0.9 : 0.5, fw = fl.w / 2, fd = fl.d / 2, s = fl.s || 1;
        for (var gx2 = -fw - 0.8; gx2 <= fw + 0.8; gx2 += step) for (var gz2 = -fd - 0.8; gz2 <= fd + 0.8; gz2 += step * 0.8) {
          var jx = gx2 + b.j(step * 0.15) + ((Math.round(gz2 / (step * 0.8)) % 2) * step * 0.5), jz = gz2 + b.j(step * 0.1);
          var dd = Math.hypot(Math.max(0, Math.abs(jx) - fw), Math.max(0, Math.abs(jz) - fd)); if (dd > 0.6 * (0.6 + b.r())) continue;
          if (fl.skip && fl.skip(jx / s, jz / s)) continue;
          // the frame's turn, back into the village
          var wx = fl.x + jx * fl.cos + jz * fl.sin, wz = fl.z - jx * fl.sin + jz * fl.cos;
          b.box(wx, -0.06, wz, step * (0.8 + b.j(0.08)), 0.12, step * 0.68, { ry: fl.ry + b.j(0.12), c: b.stoneC(fl.ground === 'paving' ? 'stone' : 'stoneCool').offsetHSL(0, -0.02, -0.05), m: M.stone, bevel: 0, ao: 0.1, jit: 0.05 });
        }
      });
    });
    // the plaza: the Hub's orange flying over it, a lamp at each corner and benches along its sides
    if (plaza) b.base(function () {
      var px = plaza.x, pz = plaza.z, hw = plaza.w / 2, hd = plaza.d / 2;
      b.box(px, 0, pz, 1.6, 0.35, 1.6, { c: 'stone', m: M.stone, bevel: 0.06 });
      b.box(px, 0.35, pz, 1.1, 0.3, 1.1, { c: 'stone', m: M.stone, bevel: 0.05 });
      b.flag(px, 0.6, pz, 9, 2.6, 1.6, { c: '#f26a1b', pr: 0.08, ry: 0.6 });
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) {
        var lx = px + q[0] * (hw - 1.2), lz = pz + q[1] * (hd - 1.2);
        b.post(lx, 0, lz, 0.07, 2.9, { c: 'woodDark' });
        b.box(lx, 2.9, lz, 0.32, 0.38, 0.32, { c: 'iron', m: M.metal, bevel: 0.03 });
        b.cone(lx, 3.28, lz, 0.26, 0.24, { c: 'iron', m: M.metal, seg: 4, ry: Math.PI / 4 });
        b.bench(px + q[0] * (hw - 1.4) * 0.45, pz + q[1] * (hd - 1.0), 2.2, { ry: q[1] > 0 ? Math.PI : 0 });
      });
    });
    var out = finish(b, o);
    out.height = H; out.R = R;
    return out;
  }

  // ------------------------------------------------------------------ an empty plot, staked out
  // o: { x, z, w, d, ry, height(x, z) } pegs at the corners and along the sides, a string between them, a strip of
  // the Hub's orange tied to the corner pegs.
  V.stake = function (o) {
    return withDetail(o.detail, function () {
      var b = new KIT.Builder(o.seed || 3, {}), f = prep(o), hw = f.w / 2, hd = f.d / 2, H = o.height || KIT.LEVEL.height;
      var pts = [], n = 0, corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
      corners.forEach(function (c0, i) {
        var c1 = corners[(i + 1) % 4], L = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]), k = Math.max(1, Math.round(L / 3.2));
        for (var s = 0; s < k; s++) pts.push([lerp(c0[0], c1[0], s / k), lerp(c0[1], c1[1], s / k), s === 0]);
      });
      function world(p) { return [f.x + p[0] * f.cos + p[1] * f.sin, f.z - p[0] * f.sin + p[1] * f.cos]; }
      b.base(function () {
        pts.forEach(function (p, i) {
          var w = world(p), q = world(pts[(i + 1) % pts.length]), y = H(w[0], w[1]) - 0.05, y2 = H(q[0], q[1]) - 0.05;
          b.box(w[0], y, w[1], 0.09, p[2] ? 0.85 : 0.65, 0.09, { c: 'woodLight', m: M.wood, bevel: 0.015, ry: f.ry + b.j(0.2) });
          b.beam([w[0], y + 0.5, w[1]], [q[0], y2 + 0.5, q[1]], 0.012, { c: '#e9e2cf', m: M.rope, round: true, seg: 4, bevel: 0 });
          if (p[2]) b.box(w[0] + 0.06, y + 0.62, w[1], 0.03, 0.18, 0.06, { c: '#f26a1b', m: M.cloth, bevel: 0, ry: f.ry, ao: 0, jit: 0 });
          n++;
        });
      });
      return finish(b, o);
    });
  };

  // ------------------------------------------------------------------ people
  // list: [{ x, z, y, ry, role, pose, tier, c, team, hat, beard, s }] (KIT.people.figure's options), each laid as its
  // own step: show(n) shows the first n.
  V.people = function (list, o) {
    o = o || {};
    return withDetail(o.detail, function () {
      var b = new KIT.Builder(o.seed || 11, {});
      list.forEach(function (p, i) { b.figure(p.x, p.z, Object.assign({}, p, { unit: i })); });
      var out = finish(b, o);
      out.show = function (n) { out.uniforms.uShown.value = Math.max(0, Math.min(n, out.units)); out.uniforms.uNewFrom.value = 1e6; out.uniforms.uTotal.value = out.units; };
      out.show(list.length);
      return out;
    });
  };

  // ------------------------------------------------------------------ what is still to come, in pencil
  // A build made with { ghost: false } has no pencil meshes; these give it them (they share its geometry, so they cost
  // no upload) or take them away again.
  V.ghosts = function (mk, on) {
    var solids = [], ghosts = [];
    mk.group.traverse(function (o) {
      if (!o.isMesh) return;
      if (o.userData.ghost) ghosts.push(o);
      else if (o.material === mk.mats.solid || o.material === mk.mats.cloth) solids.push(o);
    });
    if (!on) { ghosts.forEach(function (g) { g.parent.remove(g); }); return; }
    var have = new Set(ghosts.map(function (g) { return g.geometry; }));
    solids.forEach(function (m) {
      if (have.has(m.geometry)) return;
      var gm = new T.Mesh(m.geometry, mk.mats.ghost); gm.renderOrder = 5; gm.frustumCulled = m.frustumCulled; gm.userData.ghost = mk.mats.ghostSolid;
      m.parent.add(gm);
    });
  };

  // ------------------------------------------------------------------ torches, air, letting go
  // list: [{ mk, matrix }]: every lit torch in the world, the nearest `near` (a Vector3) first, at most MAXT
  V.torches = function (list, near, max) {
    var all = [], v = new T.Vector3();
    list.forEach(function (e) { e.mk.litTorches(e.matrix || e.mk.group.matrixWorld).forEach(function (t) { v.set(t.pos[0], t.pos[1], t.pos[2]); all.push(Object.assign({}, t, { d: near ? v.distanceToSquared(near) : 0 })); }); });
    all.sort(function (a, b) { return a.d - b.d; });
    return all.slice(0, max || KIT.MAXT);
  };
  // The looks' fog is set for one build seen from about 60 m, and their cloud's shadow is placed over one build at the
  // origin; a village is seen from hundreds of metres. o: { fog: [near, far], cloud } holds through every look until
  // air(null) gives the looks their own air back.
  V.air = function (o) {
    KIT.air = o || null;
    if (o) {
      if (o.fog) { KIT.G.uFog.value.x = o.fog[0]; KIT.G.uFog.value.y = o.fog[1]; }
      if (o.cloud !== undefined) KIT.G.uCloud.value.w = o.cloud;
    } else if (KIT.lookName) KIT.applyLook(KIT.lookName);
  };
  V.dispose = function (made) {
    if (!made) return;
    var seen = new Set();
    made.group.traverse(function (o) { if (o.isMesh && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); } });
    for (var k in made.mats) made.mats[k].dispose();
  };
})();
