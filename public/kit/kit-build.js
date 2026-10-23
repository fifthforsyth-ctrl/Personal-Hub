// Painterly village kit, part 2: geometry and the Builder.
//
// A build is a list of steps ("units"). Every finished task lays the next step(s), so a build is written in the
// order it goes up: footings, walls course by course, beams, roof rows, then the details and props. Pieces added
// inside b.unit(fn) appear together as one step; a piece added outside any unit is a step of its own.
// b.base(fn) pieces are always there (ground, the plot). b.life(fn) pieces appear only once it stands (people,
// smoke, a lit fire, banners raised on completion).
//
// Units are metres. +y is up, the build's front faces +z, and its footprint is centred on the origin.
(function () {
  var T = THREE, KIT = window.KIT, U = KIT.util, M = KIT.M, PAL = KIT.PAL;
  var rng = U.rng, clamp = U.clamp, lerp = U.lerp, noise3 = U.noise3;

  // ------------------------------------------------------------------ geometry generators (local, base at y = 0)
  var GEO_CACHE = {};
  function cached(key, make) { return GEO_CACHE[key] || (GEO_CACHE[key] = make()); }
  // the cached pieces are only ever copied into a build's buckets, so they can go once a build is made (a big build
  // caches tens of thousands of them)
  KIT.dropGeoCache = function () { GEO_CACHE = {}; };
  function flat(g) { g = g.index ? g.toNonIndexed() : g; g.computeVertexNormals(); return g; }

  // a box with its edges chamfered at 45 degrees, so every edge catches the light
  function chamferBox(w, h, d, c) {
    c = Math.min(c || 0, w * 0.45, h * 0.45, d * 0.45);
    if (c <= 0.004) { var b = new T.BoxGeometry(w, h, d); b.translate(0, h / 2, 0); return b; }
    var g = new T.BoxGeometry(w, h, d, 3, 3, 3), p = g.attributes.position, hx = w / 2, hy = h / 2, hz = d / 2, i;
    for (i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (Math.abs(Math.abs(x) - hx) > 1e-4) x = Math.sign(x) * (hx - c);
      if (Math.abs(Math.abs(y) - hy) > 1e-4) y = Math.sign(y) * (hy - c);
      if (Math.abs(Math.abs(z) - hz) > 1e-4) z = Math.sign(z) * (hz - c);
      var ix = clamp(x, -(hx - c), hx - c), iy = clamp(y, -(hy - c), hy - c), iz = clamp(z, -(hz - c), hz - c);
      var dx = x - ix, dy = y - iy, dz = z - iz, L = Math.hypot(dx, dy, dz);
      if (L > 1e-6) { x = ix + dx / L * c; y = iy + dy / L * c; z = iz + dz / L * c; }
      p.setXYZ(i, x, y + hy, z);
    }
    return flat(g);
  }
  function cylGeo(rb, rt, h, seg, o) {
    o = o || {};
    var g = new T.CylinderGeometry(rt, rb, h, seg || 12, o.hseg || 1, !!o.open);
    g.translate(0, h / 2, 0);
    return o.flat ? flat(g) : g;
  }
  function ballGeo(r, detail, o) { var g = new T.IcosahedronGeometry(r, detail == null ? 1 : detail); return o && o.smooth ? g : flat(g); }
  function latheGeo(pts, seg, o) {
    var v = pts.map(function (p) { return new T.Vector2(Math.max(0.0001, p[0]), p[1]); });
    var g = new T.LatheGeometry(v, seg || 16);
    return o && o.flat ? flat(g) : g;
  }
  function extrudeGeo(pts, depth, o) {
    o = o || {};
    var sh = new T.Shape();
    sh.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
    if (o.holes) o.holes.forEach(function (hp) { var p = new T.Path(); p.moveTo(hp[0][0], hp[0][1]); for (var j = 1; j < hp.length; j++) p.lineTo(hp[j][0], hp[j][1]); sh.holes.push(p); });
    var bev = o.bevel || 0;
    var g = new T.ExtrudeGeometry(sh, { depth: depth, bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelSegments: 1, steps: 1, curveSegments: o.curve || 8 });
    g.translate(0, 0, -depth / 2);
    g.deleteAttribute('uv');
    return flat(g);
  }
  // A band of a hipped roof or a tapering frustum: rectangle (w0 x d0) at y0 to (w1 x d1) at y1.
  function frustumGeo(w0, d0, w1, d1, h, o) {
    o = o || {};
    var a = w0 / 2, b = d0 / 2, c = w1 / 2, e = d1 / 2;
    var P = [[-a, 0, -b], [a, 0, -b], [a, 0, b], [-a, 0, b], [-c, h, -e], [c, h, -e], [c, h, e], [-c, h, e]];
    var F = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7], [3, 2, 1, 0]];
    var pos = [];
    F.forEach(function (f) { var q = f.map(function (k) { return P[k]; }); pos.push.apply(pos, q[0].concat(q[1], q[2], q[0], q[2], q[3])); });
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    // the faces are wound outward from the cube corners above
    g.computeVertexNormals();
    var n = g.attributes.normal; for (var i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    return g;
  }
  // a slab whose top and bottom ripple across x like a row of barrel tiles
  function corrugated(w, h, d, pitch, amp) {
    var nx = Math.max(2, Math.round(w / pitch) * 4), g = new T.BoxGeometry(w, h, d, nx, 1, 1), p = g.attributes.position;
    for (var i = 0; i < p.count; i++) { var x = p.getX(i), k = Math.abs(Math.sin((x / pitch) * Math.PI)); p.setY(i, p.getY(i) + h / 2 + k * amp); }
    return flat(g);
  }
  // shade a roof piece along its length: k at the z end given by sgn (-1: -z), 1 at the other, so every row of tiles or
  // slates darkens where it tucks under the row above
  function shadeZ(g, sgn, k) {
    if (!g.boundingBox) g.computeBoundingBox();
    var p = g.attributes.position, z0 = g.boundingBox.min.z, z1 = g.boundingBox.max.z, c = [];
    for (var i = 0; i < p.count; i++) { var t = (p.getZ(i) - z0) / Math.max(1e-4, z1 - z0); if (sgn > 0) t = 1 - t; var v = lerp(k, 1, Math.pow(U.smooth(0, 0.75, t), 0.8)); c.push(v, v, v * 0.98); }
    g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
    return g;
  }
  // one barrel tile, w wide (x), len long (z), arched across x; base at y = 0
  function tilePiece(w, h, len, amp) {
    return cached('tile' + [w, h, len, amp].map(function (v) { return v.toFixed(3); }).join(','), function () {
      var g = new T.BoxGeometry(w, h, len, 4, 1, 1), p = g.attributes.position;
      for (var i = 0; i < p.count; i++) { var x = p.getX(i), k = Math.sin((x / w + 0.5) * Math.PI); p.setY(i, p.getY(i) + h / 2 + k * amp); p.setX(i, x * (1 - 0.08 * (p.getZ(i) / len + 0.5))); }
      return shadeZ(flat(g), -1, 0.62);
    });
  }
  // a curved stone for a round wall: the ring sector between radii ri and ro, angles a0..a1 (0 = +x, PI/2 = +z), h tall
  function arcStoneGeo(ri, ro, a0, a1, h, bev) {
    var n = Math.max(2, Math.ceil((a1 - a0) / 0.14)), sh = new T.Shape(), i, a;
    for (i = 0; i <= n; i++) { a = a0 + (a1 - a0) * i / n; if (i === 0) sh.moveTo(Math.cos(a) * ro, -Math.sin(a) * ro); else sh.lineTo(Math.cos(a) * ro, -Math.sin(a) * ro); }
    for (i = n; i >= 0; i--) { a = a0 + (a1 - a0) * i / n; sh.lineTo(Math.cos(a) * ri, -Math.sin(a) * ri); }
    bev = Math.min(bev, h * 0.3);
    var g = new T.ExtrudeGeometry(sh, { depth: Math.max(0.01, h - 2 * bev), bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelOffset: -bev, bevelSegments: 1, steps: 1, curveSegments: 1 });
    g.rotateX(-Math.PI / 2); g.translate(0, bev, 0); g.deleteAttribute('uv');
    return flat(g);
  }
  function planeGeo(w, h, sx, sy) { var g = new T.PlaneGeometry(w, h, sx || 1, sy || 1); return g; }

  KIT.geo = { chamferBox: chamferBox, cyl: cylGeo, ball: ballGeo, lathe: latheGeo, extrude: extrudeGeo, frustum: frustumGeo, plane: planeGeo, flat: flat };

  // ------------------------------------------------------------------ buckets
  // A bucket's lists grow as typed arrays: a big build runs to millions of numbers, which plain arrays would hold as
  // doubles at twice the memory and then copy again into the geometry. They hold exactly what the geometry would.
  function Grow(Type) { this.a = new Type(1024); this.n = 0; }
  Grow.prototype.push = function (x, y, z) {
    var k = arguments.length, a = this.a;
    if (this.n + k > a.length) { var b = new a.constructor(a.length * 2); b.set(a); this.a = a = b; }
    a[this.n++] = x; if (k > 1) a[this.n++] = y; if (k > 2) a[this.n++] = z;
    return this.n;
  };
  // the numbers laid so far, as a view (no copy: the geometry takes it as it is)
  Grow.prototype.done = function () { return this.a.subarray(0, this.n); };
  function Bucket(uv) {
    this.pos = new Grow(Float32Array); this.nor = new Grow(Float32Array); this.col = new Grow(Float32Array); this.unit = new Grow(Float32Array);
    this.mat = new Grow(Float32Array); this.ao = new Grow(Float32Array); this.sway = new Grow(Float32Array); this.uv = uv ? new Grow(Float32Array) : null;
    this.idx = new Grow(Uint32Array); this.n = 0;
  }
  var _v = new T.Vector3(), _n = new T.Vector3(), _nm = new T.Matrix3(), _c = new T.Color();

  // ------------------------------------------------------------------ the Builder
  function Builder(seed, opts) {
    opts = opts || {};
    this.r = rng(seed || 1);
    this.seed = seed || 1;
    this.buckets = {};
    this.stack = [new T.Matrix4()];
    this.nUnits = 0; this.curUnit = null; this.mode = null; // 'base' | 'life'
    this.parts = []; this.curPart = null;
    this.torches = []; this.spinners = []; this.labels = [];
    this.parent = opts.parent || null;
  }
  KIT.Builder = Builder;
  var B = Builder.prototype;

  // random helpers
  B.rand = function (a, b) { return a === undefined ? this.r() : (b === undefined ? this.r() * a : a + this.r() * (b - a)); };
  B.j = function (a) { return (this.r() * 2 - 1) * a; };
  B.pick = function (arr) { return arr[Math.floor(this.r() * arr.length)]; };
  B.chance = function (p) { return this.r() < p; };
  // a colour from a palette name (or a hex), with a touch of lightness / hue jitter
  B.pal = function (name, dl) {
    var hex = PAL[name] ? this.pick(PAL[name]) : name;
    return hex;
  };

  // transforms
  B.top = function () { return this.stack[this.stack.length - 1]; };
  B.push = function (x, y, z, ry, s) {
    var m = new T.Matrix4().compose(new T.Vector3(x || 0, y || 0, z || 0), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), ry || 0), new T.Vector3(s || 1, s || 1, s || 1));
    this.stack.push(this.top().clone().multiply(m)); return this;
  };
  B.pop = function () { if (this.stack.length > 1) this.stack.pop(); return this; };
  B.at = function (x, y, z, ry, fn) { this.push(x, y, z, ry); fn.call(this, this); this.pop(); return this; };
  // where a local point ends up in the build's frame
  B.world = function (x, y, z) { return new T.Vector3(x, y, z).applyMatrix4(this.top()); };

  // steps
  B.part = function (name) { this.curPart = { name: name, from: this.nUnits }; this.parts.push(this.curPart); return this; };
  B.unit = function (fn) {
    if (this.curUnit !== null || this.mode) { fn.call(this, this); return this; }
    this.curUnit = this.root().nUnits++; fn.call(this, this); this.curUnit = null; return this;
  };
  B.base = function (fn) { var m = this.mode; this.mode = 'base'; fn.call(this, this); this.mode = m; return this; };
  B.life = function (fn) { var m = this.mode; this.mode = 'life'; fn.call(this, this); this.mode = m; return this; };
  B.root = function () { var b = this; while (b.parent) b = b.parent; return b; };
  B.unitNow = function () {
    if (this.mode === 'base') return -1;
    if (this.mode === 'life') return 99999;
    if (this.curUnit !== null) return this.curUnit;
    var root = this.root();
    if (root !== this && root.curUnit !== null) return root.curUnit;
    return root.nUnits++;
  };

  // Add a geometry. o: { c (hex or palette name), m (material id or name), x,y,z, rx,ry,rz, sx,sy,sz, ao (0..1), vary,
  //   sway, bucket ('solid' | 'cloth' | 'leaf' | 'leafTri' | 'needle' | 'grass' | 'glow'), colors (fn(x,y,z,lx,ly,lz) -> hex|Color) }
  B.addGeo = function (g, o) {
    o = o || {};
    var bucketName = o.bucket || 'solid';
    var bk = this.buckets[bucketName] || (this.buckets[bucketName] = new Bucket(/leaf|Tri|needle|grass/.test(bucketName)));
    var Mx = new T.Matrix4().compose(
      new T.Vector3(o.x || 0, o.y || 0, o.z || 0),
      new T.Quaternion().setFromEuler(new T.Euler(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ')),
      new T.Vector3(o.sx || o.s || 1, o.sy || o.s || 1, o.sz || o.s || 1));
    var W = this.top().clone().multiply(Mx);
    _nm.getNormalMatrix(W);
    var p = g.attributes.position, nr = g.attributes.normal, uv = g.attributes.uv, sw = g.attributes.sway, gc = g.attributes.color;
    if (!g.boundingBox) g.computeBoundingBox();
    var y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y, hy = Math.max(1e-4, y1 - y0);
    var unit = o.unit !== undefined ? o.unit : this.unitNow();
    var mid = typeof o.m === 'string' ? M[o.m] : (o.m === undefined ? M.stone : o.m);
    var base = o.c instanceof T.Color ? o.c.clone() : U.col(PAL[o.c] ? this.pick(PAL[o.c]) : (o.c || '#b9ab94'));
    if (o.jit !== 0) base.offsetHSL(this.j(0.008), this.j(0.03), this.j(o.jit === undefined ? 0.035 : o.jit));
    base.convertSRGBToLinear();
    var aoK = o.ao === undefined ? 0.3 : o.ao, vary = o.vary === undefined ? 0.07 : o.vary, swayK = o.sway || 0;
    var glowK = o.glow || 1;
    var off = bk.n, i;
    for (i = 0; i < p.count; i++) {
      var lx = p.getX(i), ly = p.getY(i), lz = p.getZ(i);
      _v.set(lx, ly, lz).applyMatrix4(W);
      bk.pos.push(_v.x, _v.y, _v.z);
      if (nr) { _n.set(nr.getX(i), nr.getY(i), nr.getZ(i)).applyMatrix3(_nm).normalize(); bk.nor.push(_n.x, _n.y, _n.z); } else bk.nor.push(0, 1, 0);
      var cc;
      if (o.colors) { var r = o.colors(_v.x, _v.y, _v.z, lx, ly, lz); cc = (r instanceof T.Color ? r.clone() : U.col(r)).convertSRGBToLinear(); }
      else if (gc) cc = _c.setRGB(gc.getX(i), gc.getY(i), gc.getZ(i)).clone().multiply(base);
      else cc = base;
      var vn = 1 + noise3(_v.x * 0.9 + 11.3, _v.y * 0.9, _v.z * 0.9) * vary;
      bk.col.push(cc.r * vn * glowK, cc.g * vn * glowK, cc.b * vn * glowK);
      bk.unit.push(unit); bk.mat.push(mid);
      bk.ao.push(1 - aoK * (1 - U.smooth(0, 1, (ly - y0) / hy)));
      bk.sway.push(sw ? sw.getX(i) * swayK : (swayK && o.swayFn ? o.swayFn(lx, ly, lz) : 0));
      if (bk.uv) bk.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
    }
    if (g.index) { var ix = g.index; for (i = 0; i < ix.count; i++) bk.idx.push(ix.getX(i) + off); }
    else for (i = 0; i < p.count; i++) bk.idx.push(i + off);
    bk.n += p.count;
    return this;
  };

  // ---------------------------------------------------------------- shapes
  // box: bottom-centred at (x, y, z). o.bevel (chamfer, metres), o.c, o.m, o.ry ...
  B.box = function (x, y, z, w, h, d, o) {
    o = o || {}; var bev = o.bevel === undefined ? Math.min(0.05, Math.min(w, h, d) * 0.12) : o.bevel;
    var g = o.taper ? frustumGeo(w, d, w * o.taper, d * (o.taperD || o.taper), h) : chamferBox(w, h, d, bev);
    return this.addGeo(g, Object.assign({}, o, { x: x, y: y, z: z }));
  };
  B.cyl = function (x, y, z, r, h, o) {
    o = o || {}; var g = cylGeo(r, o.r2 === undefined ? r : o.r2, h, o.seg || (r > 1 ? 20 : 10), o);
    return this.addGeo(g, Object.assign({ m: M.wood, c: 'wood' }, o, { x: x, y: y, z: z }));
  };
  B.cone = function (x, y, z, r, h, o) { return this.cyl(x, y, z, r, h, Object.assign({}, o, { r2: 0.0001 })); };
  B.ball = function (x, y, z, r, o) { o = o || {}; return this.addGeo(ballGeo(r, o.detail, o), Object.assign({}, o, { x: x, y: y, z: z })); };
  B.lathe = function (x, y, z, pts, o) { o = o || {}; return this.addGeo(latheGeo(pts, o.seg || 16, o), Object.assign({}, o, { x: x, y: y, z: z })); };
  // extrude a 2D outline (x, y in the XY plane) by depth along z, centred on z
  B.extrude = function (x, y, z, pts, depth, o) { o = o || {}; return this.addGeo(extrudeGeo(pts, depth, o), Object.assign({}, o, { x: x, y: y, z: z })); };
  // a beam from a to b ([x,y,z]), square (o.round for a log); r is half its thickness
  B.beam = function (a, b, r, o) {
    o = o || {};
    var A = new T.Vector3(a[0], a[1], a[2]), Bv = new T.Vector3(b[0], b[1], b[2]), d = Bv.clone().sub(A), L = d.length();
    var g = o.round ? cylGeo(r, o.r2 || r, L, o.seg || 7, { flat: true }) : chamferBox(r * 2, L, (o.r2 || r) * 2, o.bevel === undefined ? r * 0.25 : o.bevel);
    var q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    if (o.roll) q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), o.roll));
    var e = new T.Euler().setFromQuaternion(q, 'YXZ');
    return this.addGeo(g, Object.assign({ m: M.wood, c: 'beam' }, o, { x: A.x, y: A.y, z: A.z, rx: e.x, ry: e.y, rz: e.z, order: 'YXZ' }));
  };
  // a plank or flat slab lying in a plane: centre (x,y,z), size w x d, thickness t
  B.slab = function (x, y, z, w, t, d, o) { return this.box(x, y - t / 2, z, w, t, d, o); };

  // ---------------------------------------------------------------- masonry
  // A stone's colour: a pick from the palette, now and then darker and cooler, warmer, or touched with moss, and
  // grimier near the ground.
  var MOSS = new T.Color('#7f8657'), GRIME = new T.Color('#6f6656');
  B.stoneC = function (pal, y) {
    var c = U.col(this.pick(PAL[pal] || PAL.stone)), r = this.r();
    if (r < 0.13) c.offsetHSL(0.015, -0.04, -0.07); else if (r < 0.24) c.offsetHSL(-0.01, 0.03, 0.035); else if (r < 0.31) c.lerp(MOSS, 0.32);
    if (y !== undefined && y < 1.0) c.lerp(GRIME, 0.22 * (1 - Math.max(0, y) / 1.0));
    return c;
  };
  // A wall of individual stones from (ax, az) to (bx, bz), from y0 up h metres, thick metres deep, course by course.
  // Each course is one step unless o.per is set (stones per step). o.hole(t, y) -> true leaves a stone out (t = metres
  // along the wall from a), so doors and windows can be framed. o.pal: palette name. o.course: course height.
  B.stoneWall = function (ax, az, bx, bz, y0, h, thick, o) {
    o = o || {};
    var dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 0.2) return this;
    var ux = dx / L, uz = dz / L, ry = -Math.atan2(uz, ux), ch = o.course || 0.42, n = Math.max(1, Math.round(h / ch)); ch = h / n;
    var pal = o.pal || 'stone', len = o.len || 0.85, self = this, core = o.core === undefined ? true : o.core;
    for (var k = 0; k < n; k++) {
      var y = y0 + k * ch, stones = [], t = (k % 2) * len * 0.5 * (0.6 + this.r() * 0.6);
      var cuts = [0]; while (t < L - 0.2) { if (t > 0.15) cuts.push(t); t += len * (0.7 + this.r() * 0.6); } cuts.push(L);
      for (var i = 0; i < cuts.length - 1; i++) stones.push([cuts[i], cuts[i + 1]]);
      var doCourse = function () {
        if (core) self.box(ax + ux * L / 2, y, az + uz * L / 2, L - 0.04, ch, thick * 0.8, { ry: ry, c: o.mortar || '#8a7e6c', m: M.stone, bevel: 0, ao: 0.1, jit: 0.01 });
        var placed = 0;
        var pieces = [];
        stones.forEach(function (s) {
          // a stone that overlaps an opening is cut back to its edge rather than left out
          var hr = o.hole ? o.hole((s[0] + s[1]) / 2, y + ch / 2, s[0], s[1]) : false;
          if (hr === true) return;
          if (Array.isArray(hr)) hr.forEach(function (q) { pieces.push(q); }); else pieces.push(s);
        });
        pieces.forEach(function (s) {
          var tm = (s[0] + s[1]) / 2, w = s[1] - s[0] - 0.05;
          if (w < 0.12) return;
          var put = function () {
            var hh = ch * (0.86 + self.j(0.06)), dd = thick * (0.98 + self.j(0.05)), out = self.j(0.025);
            self.box(ax + ux * tm - uz * out, y + (ch - hh) / 2, az + uz * tm + ux * out, w, hh, dd, { ry: ry + self.j(0.012), c: self.stoneC(pal, y), m: o.m === undefined ? M.stone : o.m, bevel: o.bevel === undefined ? Math.min(0.07, hh * 0.2) : o.bevel, ao: 0.18, jit: 0.04 });
          };
          if (o.per) { self.unit(put); } else put();
          placed++;
        });
      };
      if (o.per) doCourse(); else this.unit(doCourse);
      if (o.onCourse) o.onCourse.call(this, k, y, ch);
    }
    return this;
  };
  // Four stone walls around a rectangle, course by course (all four sides of a course are one step).
  // o.holes: [{side: 'front'|'back'|'left'|'right', at: t from the side's centre, w, y0, y1}]
  B.stoneBox = function (cx, cz, w, d, y0, h, thick, o) {
    o = o || {};
    var x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, holes = o.holes || [], self = this;
    var ch = o.course || 0.42, n = Math.max(1, Math.round(h / ch)); ch = h / n;
    var sides = [
      { key: 'front', a: [x0, z1 - thick / 2], b: [x1, z1 - thick / 2], len: w },
      { key: 'right', a: [x1 - thick / 2, z1 - thick], b: [x1 - thick / 2, z0 + thick], len: d - 2 * thick },
      { key: 'back', a: [x1, z0 + thick / 2], b: [x0, z0 + thick / 2], len: w },
      { key: 'left', a: [x0 + thick / 2, z0 + thick], b: [x0 + thick / 2, z1 - thick], len: d - 2 * thick }
    ];
    for (var k = 0; k < n; k++) {
      var y = y0 + k * ch;
      this.unit(function () {
        sides.forEach(function (sd) {
          var hs = holes.filter(function (hh) { return hh.side === sd.key; });
          var hole = hs.length ? function (t, yy, s0, s1) {
            var keep = [[s0, s1]], hit = false;
            hs.forEach(function (hh) {
              if (!(yy > (hh.y0 === undefined ? y0 : hh.y0) && yy < hh.y1)) return;
              var a = (hh.at || 0) - hh.w / 2 + sd.len / 2, bb = (hh.at || 0) + hh.w / 2 + sd.len / 2, nk = [];
              keep.forEach(function (k) { if (k[1] <= a || k[0] >= bb) { nk.push(k); return; } hit = true; if (k[0] < a) nk.push([k[0], a]); if (k[1] > bb) nk.push([bb, k[1]]); });
              keep = nk;
            });
            return !hit ? false : keep.length ? keep : true;
          } : null;
          var a = sd.a, b = sd.b;
          self.stoneWall(a[0], a[1], b[0], b[1], y, ch, thick, { pal: o.pal, len: o.len, hole: hole, course: ch, core: !hole, mortar: o.mortar, m: o.m });
        });
      });
      if (o.onCourse) o.onCourse.call(this, k, y, ch);
    }
    return this;
  };
  // A round wall of stones (towers, wells, the windmill), course by course. o.hole(angle, y) leaves a stone out
  // (angle 0 = +x, PI/2 = +z, the front). o.taper: radius at the top as a fraction.
  B.stoneRing = function (cx, cz, r, y0, h, thick, o) {
    o = o || {}; var self = this, ch = o.course || 0.42, n = Math.max(1, Math.round(h / ch)); ch = h / n;
    var pal = o.pal || 'stone', len = o.len || 0.8;
    for (var k = 0; k < n; k++) {
      var y = y0 + k * ch, rr = r * (1 - (1 - (o.taper || 1)) * (k / n)), ns = Math.max(6, Math.round(Math.PI * 2 * rr / len)), arc = Math.PI * 2 / ns, off = (k % 2) * arc * 0.5;
      this.unit(function () {
        if (o.core !== false) self.cyl(cx, y, cz, rr - thick * 0.45, ch, { c: o.mortar || '#8a7e6c', m: M.stone, seg: ns, ao: 0.1, jit: 0.01 });
        for (var i = 0; i < ns; i++) {
          var a = i * arc + off + self.j(arc * 0.06);
          if (o.hole && o.hole(((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), y + ch / 2)) continue;
          var gap = 0.045 / rr, hh = ch * (0.88 + self.j(0.05)), ro = rr + thick / 2 + self.j(0.02), ri = rr - thick / 2;
          self.addGeo(arcStoneGeo(ri, ro, a - arc / 2 + gap, a + arc / 2 - gap, hh, Math.min(0.06, hh * 0.18)), { x: cx, y: y + (ch - hh) / 2, z: cz, c: self.stoneC(pal, y), m: M.stone, ao: 0.18, jit: 0.04 });
        }
      });
    }
    return this;
  };
  // A timber-framed wall from (ax, az) to (bx, bz): sill and top plates, posts, a mid rail, braces, and plaster
  // infill panels, each panel its own step. Faces outward to the right of a->b (for a->b along +x that is +z).
  // o: { h, post (spacing), braces (true), infill (palette), frame (palette), windows: [{t, w, y0, y1}] (t from a) }
  B.timberWall = function (ax, az, bx, bz, y0, o) {
    o = o || {}; var self = this, h = o.h || 2.6, dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = -uz, nz = ux;
    var np = Math.max(1, Math.round(L / (o.post || 1.3))), sp = L / np, fr = o.frame || 'beam', inf = o.infill || 'plaster', r = 0.1, wins = o.windows || [];
    function P(t, y, out) { return [ax + ux * t + nx * (out || 0), y, az + uz * t + nz * (out || 0)]; }
    this.unit(function () {
      self.beam(P(0, y0 + r), P(L, y0 + r), r * 1.2, { c: fr });
      for (var i = 0; i <= np; i++) self.beam(P(i * sp, y0), P(i * sp, y0 + h), r, { c: fr });
      self.beam(P(0, y0 + h - r), P(L, y0 + h - r), r * 1.2, { c: fr });
    });
    var mid = y0 + h * 0.48;
    for (var i = 0; i < np; i++) {
      var t0 = i * sp + r, t1 = (i + 1) * sp - r, tm = (t0 + t1) / 2, win = wins.filter(function (w) { return Math.abs(w.t - tm) < sp / 2; })[0];
      (function (t0, t1, tm, win, i) {
        self.unit(function () {
          var ry = -Math.atan2(uz, ux);
          if (win) {
            var wy0 = y0 + (win.y0 || 0.9), wy1 = y0 + (win.y1 || 2.0), ww = Math.min(win.w || 0.7, t1 - t0 - 0.1);
            var pc = P(tm, 0, -0.02);
            self.box(pc[0], y0 + 0.2, pc[2], t1 - t0, wy0 - y0 - 0.2, 0.16, { ry: ry, c: inf, m: M.plaster, bevel: 0.01 });
            self.box(pc[0], wy1, pc[2], t1 - t0, y0 + h - 0.2 - wy1, 0.16, { ry: ry, c: inf, m: M.plaster, bevel: 0.01 });
            var side = (t1 - t0 - ww) / 2;
            if (side > 0.05) [t0 + side / 2, t1 - side / 2].forEach(function (tt) { var q = P(tt, 0, -0.02); self.box(q[0], wy0, q[2], side, wy1 - wy0, 0.16, { ry: ry, c: inf, m: M.plaster, bevel: 0.01 }); });
            self.push(pc[0], wy0, pc[2], ry);
            self.box(0, 0, -0.04, ww, wy1 - wy0, 0.1, { c: '#1f1f21', m: M.window, ao: 0, jit: 0, bevel: 0 });
            self.box(0, 0, 0.02, 0.05, wy1 - wy0, 0.05, { c: 'woodDark', m: M.wood, bevel: 0.01, ao: 0 });
            self.box(0, (wy1 - wy0) * 0.5, 0.02, ww, 0.05, 0.05, { c: 'woodDark', m: M.wood, bevel: 0.01, ao: 0 });
            self.box(0, -0.08, 0.08, ww + 0.2, 0.08, 0.18, { c: fr, m: M.wood, bevel: 0.02 });
            if (win.shutters) [-1, 1].forEach(function (sd) { self.box(sd * (ww * 0.75 + 0.03), 0, 0.09, ww * 0.5, wy1 - wy0, 0.04, { c: win.shutters, m: M.paint, ry: sd * 0.35, bevel: 0.01 }); });
            if (win.flowers) { self.box(0, -0.34, 0.2, ww + 0.15, 0.24, 0.26, { c: 'wood', m: M.wood }); for (var f = 0; f < 6; f++) self.ball(-ww / 2 + f * ww / 5, -0.08, 0.22 + self.j(0.05), 0.08, { c: self.pick(win.flowers === true ? PAL.flowers : [win.flowers]), m: M.paint, ao: 0, detail: 0 }); for (var g2 = 0; g2 < 4; g2++) self.ball(-ww / 2 + g2 * ww / 3, -0.12, 0.25, 0.1, { c: 'leaf', m: M.leaf, ao: 0.2, detail: 0 }); }
            self.pop();
          } else {
            var q2 = P(tm, 0, -0.02);
            self.box(q2[0], y0 + 0.2, q2[2], t1 - t0, mid - y0 - 0.25, 0.16, { ry: ry, c: inf, m: M.plaster, bevel: 0.01 });
            self.box(q2[0], mid + 0.05, q2[2], t1 - t0, y0 + h - 0.25 - mid, 0.16, { ry: ry, c: inf, m: M.plaster, bevel: 0.01 });
            self.beam(P(t0 - r, mid), P(t1 + r, mid), r * 0.8, { c: fr });
            if (o.braces !== false && (i === 0 || i === np - 1 || i % 3 === 1)) { var up = i < np / 2; self.beam(P(up ? t0 : t1, mid, 0.03), P(up ? t1 : t0, y0 + h - 0.15, 0.03), r * 0.8, { c: fr }); self.beam(P(up ? t0 : t1, mid, 0.03), P(up ? t1 : t0, y0 + 0.2, 0.03), r * 0.8, { c: fr }); }
          }
        });
      })(t0, t1, tm, win, i);
    }
    return this;
  };
  // quoins: big alternating corner stones up a corner at (x, z), for plastered walls
  B.quoins = function (x, z, y0, h, sx, sz, o) {
    o = o || {}; var ch = o.course || 0.5, n = Math.round(h / ch), self = this;
    for (var k = 0; k < n; k++) {
      var long = k % 2 === 0, w = long ? 0.75 : 0.45, dd = long ? 0.45 : 0.75;
      this.box(x - sx * (w / 2 - 0.2), y0 + k * ch, z - sz * (dd / 2 - 0.2), w, ch * 0.92, dd, { c: o.pal || 'stone', bevel: 0.06 });
    }
    return this;
  };

  // ---------------------------------------------------------------- roofs
  // A gabled roof whose ridge runs along x: eaves at y, rising h, span d (z), length w (x), laid in rows from the eaves.
  // o: { over (eave overhang), rows (count), m ('tile'|'thatch'|'slate'|'wood'), c, thick, ry, rowsAsUnits (default true),
  //      ridge (true), bell (slight curve) }
  B.gableRoof = function (x, y, z, w, d, h, o) {
    o = o || {};
    var over = o.over === undefined ? 0.45 : o.over, half = d / 2 + over, slope = Math.atan2(h, d / 2), run = half / Math.cos(slope);
    var rows = o.rows || Math.max(3, Math.round(run / 0.55)), rl = run / rows, thick = o.thick || (o.m === 'thatch' ? 0.42 : 0.14);
    var m = o.m || 'tile', pal = o.c || (m === 'thatch' ? 'thatch' : m === 'slate' ? 'slate' : m === 'wood' ? 'woodDark' : 'tile');
    var mid = m === 'thatch' ? M.thatch : m === 'wood' ? M.wood : M.tile, self = this, L = w + 2 * (o.overX === undefined ? over * 0.8 : o.overX);
    this.push(x, y, z, o.ry || 0);
    // the drop below the eave line created by the overhang
    var dropY = -over * Math.tan(slope);
    for (var r = 0; r < rows; r++) {
      var layRow = function () {
        [-1, 1].forEach(function (side) {
          var t0 = r * rl, t1 = (r + 1) * rl + rl * 0.35;
          var cx = side * (half - (t0 + t1) / 2 * Math.cos(slope)), cy = dropY + (t0 + t1) / 2 * Math.sin(slope);
          var bell = o.bell ? (1 - r / rows) * o.bell : 0;
          var ry0 = cy + thick * 0.4 + (r % 2) * 0.01, rx0 = side * (slope + 0.06 - bell);
          if (m === 'thatch') {
            var g = chamferBox(L, thick, (t1 - t0), Math.min(0.05, thick * 0.3)).clone(); g.translate(0, -thick / 2, 0);
            self.addGeo(g, { x: 0, y: ry0, z: cx, rx: rx0, c: self.pick(PAL[pal] || [pal]), m: mid, ao: 0.25, jit: 0.04 });
            return;
          }
          // tiles, slates or shingles laid one by one, each its own colour, a little out of true
          var pw = o.pitch || (m === 'tile' ? 0.34 : 0.4), n = Math.ceil(L / pw), off = m === 'tile' ? 0 : (r % 2) * pw * 0.5, len = t1 - t0;
          var pg = m === 'tile' ? tilePiece(pw * 1.02, thick * 0.75, len, thick * 0.5) : cached('slate' + [pw, thick, len].join(','), function () { return shadeZ(chamferBox(pw * 0.96, thick * 0.7, len, Math.min(0.03, thick * 0.2)), -1, 0.62); });
          self.push(0, ry0, cx, 0); self.stack[self.stack.length - 1].multiply(new T.Matrix4().makeRotationX(rx0));
          for (var i = 0; i <= n; i++) {
            var px = -L / 2 + i * pw + off - (m === 'tile' ? 0 : pw * 0.25); if (px > L / 2 + pw * 0.2) break; if (px < -L / 2 - pw * 0.2) continue;
            var cc = U.col(self.pick(PAL[pal] || [pal])), q = self.r();
            if (q < 0.12) cc.offsetHSL(0.006, -0.04, -0.035); else if (q < 0.22) cc.offsetHSL(-0.006, 0.01, 0.025); else if (q < 0.26) cc.lerp(MOSS, 0.15);
            self.addGeo(pg, { x: Math.max(-L / 2 + pw / 2, Math.min(L / 2 - pw / 2, px)), y: -thick / 2 + self.j(0.008), z: self.j(0.02), rx: self.j(0.008), ry: self.j(0.015) + (side < 0 ? Math.PI : 0), rz: self.j(0.01), c: cc, m: mid, ao: 0.3, jit: 0.02, vary: 0.04 });
          }
          self.pop();
        });
      };
      if (o.rowsAsUnits === false) layRow(); else this.unit(layRow);
    }
    if (o.ridge !== false) this.unit(function () {
      self.addGeo(cylGeo(thick * 1.1, thick * 1.1, L + 0.1, 8, { flat: true }), { x: -L / 2 - 0.05, y: h + dropY * 0 + thick * 0.5, z: 0, rz: -Math.PI / 2, c: m === 'thatch' ? 'thatch' : (o.ridgeC || (m === 'tile' ? '#3a3937' : '#3f4347')), m: mid });
    });
    this.pop();
    return this;
  };
  // the triangular gable end wall: base width d at y0, peak h above, in the plane facing x (ridge along x)
  B.gableEnd = function (x, y0, z, d, h, thick, o) {
    o = o || {};
    var pts = [[-d / 2, 0], [d / 2, 0], [0, h]];
    return this.extrude(x, y0, z, pts, thick, Object.assign({ c: 'plaster', m: M.plaster, ry: Math.PI / 2 }, o));
  };
  // A hipped or pyramidal roof in rows: base (w x d) at y, rising h to a ridge of length max(0, w - d) (o.ridge to set).
  B.hipRoof = function (x, y, z, w, d, h, o) {
    o = o || {};
    var over = o.over === undefined ? 0.45 : o.over, W0 = w + 2 * over, D0 = d + 2 * over, ridge = o.ridge === undefined ? Math.max(0.05, w - d) : o.ridge;
    var rows = o.rows || Math.max(3, Math.round(h / 0.45)), m = o.m || 'tile', self = this;
    var pal = o.c || (m === 'thatch' ? 'thatch' : m === 'slate' ? 'slate' : 'tile'), mid = m === 'thatch' ? M.thatch : M.tile;
    var drop = over * (h / (D0 / 2));
    this.push(x, y - drop, z, o.ry || 0);
    for (var r = 0; r < rows; r++) {
      var f0 = r / rows, f1 = Math.min(1, (r + 1.25) / rows);
      var lay = function () {
        var wa = lerp(W0, ridge, f0), da = lerp(D0, 0.05, f0), wb = lerp(W0, ridge, f1), db = lerp(D0, 0.05, f1), hh = (f1 - f0) * (h + drop);
        self.addGeo(frustumGeo(wa, da, wb, db, hh), { y: f0 * (h + drop), c: self.pick(PAL[pal] || [pal]), m: mid, ao: 0.2, jit: 0.04 });
      };
      if (o.rowsAsUnits === false) lay(); else this.unit(lay);
    }
    this.pop();
    return this;
  };
  // A conical roof (towers, the windmill cap) in rows, r at the eave, h tall. o.flare bends the eaves out.
  B.coneRoof = function (x, y, z, r, h, o) {
    o = o || {}; var rows = o.rows || Math.max(3, Math.round(h / 0.5)), m = o.m || 'tile', self = this;
    var pal = o.c || (m === 'thatch' ? 'thatch' : m === 'slate' ? 'slate' : 'tile'), mid = m === 'thatch' ? M.thatch : M.tile, seg = o.seg || 18;
    for (var k = 0; k < rows; k++) {
      var f0 = k / rows, f1 = Math.min(1, (k + 1.3) / rows);
      var prof = function (f) { var fl = o.flare ? Math.pow(1 - f, 2) * o.flare : 0; return [r * (1 - f) + fl * 0.6, f * h - fl * 0.4]; };
      var lay = function () {
        var a = prof(f0), b = prof(f1);
        // a dark under-cone keeps the gaps closed; the shingles sit on it one by one
        self.addGeo(cylGeo(a[0] * 0.97, Math.max(0.02, b[0] * 0.97), b[1] - a[1], seg, { open: false, flat: true }), { x: x, y: y + a[1], z: z, c: U.col(self.pick(PAL[pal] || [pal])).offsetHSL(0, 0, -0.08), m: mid, ao: 0.2, jit: 0.02 });
        if (m === 'thatch' || o.shingles === false) return;
        var dr = a[0] - b[0], dy = b[1] - a[1], sl = Math.hypot(dr, dy), rm = (a[0] + b[0]) / 2, ym = (a[1] + b[1]) / 2, ns = Math.max(7, Math.round(Math.PI * 2 * rm / 0.36));
        var th = 0.06, pg = shadeZ(chamferBox(Math.PI * 2 * rm / ns * 1.16, th, sl * 1.08, 0.018), 1, 0.6), off = (k % 2) * 0.5;
        for (var i = 0; i < ns; i++) {
          var t = (i + off) / ns * Math.PI * 2 + self.j(0.02), R = new T.Vector3(Math.cos(t), 0, Math.sin(t)), Tn = new T.Vector3(-Math.sin(t), 0, Math.cos(t));
          var N = R.clone().multiplyScalar(dy).add(new T.Vector3(0, dr, 0)).normalize(), Z = new T.Vector3().crossVectors(Tn, N);
          var e = new T.Euler().setFromRotationMatrix(new T.Matrix4().makeBasis(Tn, N, Z), 'YXZ');
          var cc = U.col(self.pick(PAL[pal] || [pal])), q = self.r();
          if (q < 0.15) cc.offsetHSL(0.006, -0.02, -0.035); else if (q < 0.3) cc.offsetHSL(-0.006, 0.01, 0.03);
          var pr = rm + N.x * 0 + 0.01, base = new T.Vector3(Math.cos(t) * rm, ym, Math.sin(t) * rm).addScaledVector(N, 0.005 - th * 0.3);
          self.addGeo(pg, { x: x + base.x, y: y + base.y, z: z + base.z, rx: e.x + self.j(0.03), ry: e.y, rz: e.z, order: 'YXZ', c: cc, m: mid, ao: 0.25, jit: 0.02, vary: 0.04 });
        }
      };
      if (o.rowsAsUnits === false) lay(); else this.unit(lay);
    }
    return this;
  };

  // ---------------------------------------------------------------- openings
  // An arched opening in a wall facing +z (rotate with o.ry): a dark recess, a stone or timber surround, and an
  // optional plank door with iron straps. (x, y, z) is the bottom centre on the wall's outer face.
  B.archDoor = function (x, y, z, w, h, o) {
    o = o || {}; var self = this, depth = o.depth || 0.3, arch = o.arch === undefined ? w / 2 : o.arch, seg = 8;
    var pts = [[-w / 2, 0], [w / 2, 0], [w / 2, h - arch]];
    for (var i = 1; i < seg; i++) { var a = i / seg * Math.PI; pts.push([Math.cos(a) * w / 2, h - arch + Math.sin(a) * arch]); }
    pts.push([-w / 2, h - arch]);
    this.push(x, y, z, o.ry || 0);
    this.extrude(0, 0, -depth / 2 + 0.02, pts, depth, { c: '#2b2420', m: M.dark, ao: 0, jit: 0 });
    if (o.door !== false) {
      var pl = Math.max(2, Math.round(w / 0.28)), pw = w / pl;
      for (var k = 0; k < pl; k++) {
        var px = -w / 2 + (k + 0.5) * pw, top = h - arch + Math.sqrt(Math.max(0, arch * arch - px * px)) * (arch > 0 ? 1 : 0) - 0.04;
        this.box(px, 0, -0.12, pw - 0.025, Math.max(0.2, top), 0.08, { c: o.doorC || 'wood', m: M.wood, bevel: 0.012, ao: 0.4 });
      }
      [0.25, 0.7].forEach(function (f) { self.box(0, h * f, -0.07, w * 0.92, 0.07, 0.04, { c: 'iron', m: M.metal, bevel: 0.01 }); });
      this.ball(w * 0.28, h * 0.45, -0.05, 0.05, { c: 'iron', m: M.metal });
    }
    if (o.frame !== false) {
      var fs = o.frameStone || 'stone', fw = o.frameW || 0.28;
      if (o.timber) {
        this.box(-w / 2 - 0.09, 0, 0.02, 0.18, h - arch * 0.4, 0.22, { c: 'beam', m: M.wood });
        this.box(w / 2 + 0.09, 0, 0.02, 0.18, h - arch * 0.4, 0.22, { c: 'beam', m: M.wood });
        this.box(0, h - arch * 0.4, 0.02, w + 0.5, 0.2, 0.24, { c: 'beam', m: M.wood });
      } else {
        var n = 9;
        for (var s = 0; s < n; s++) {
          var a0 = Math.PI - s / (n - 1) * Math.PI, cxx = Math.cos(a0) * (w / 2 + fw / 2), cyy = h - arch + Math.sin(a0) * (arch + fw / 2);
          if (arch < 0.05) { cxx = -w / 2 - fw / 2 + s / (n - 1) * (w + fw); cyy = h + fw / 2; }
          this.box(cxx, cyy - fw * 0.5, 0.02, (Math.PI * (w / 2 + fw / 2)) / n * 0.92, fw, 0.26, { c: s === (n - 1) / 2 ? (o.keyC || fs) : fs, rz: arch < 0.05 ? 0 : a0 - Math.PI / 2, bevel: 0.05 });
        }
        var jh = h - arch, jn = Math.max(1, Math.round(jh / 0.45));
        for (var q = 0; q < jn; q++) [-1, 1].forEach(function (sd) { var big = (q % 2 === 0); self.box(sd * (w / 2 + (big ? 0.2 : 0.14)), q * jh / jn, 0.02, big ? 0.4 : 0.28, jh / jn - 0.04, 0.28, { c: fs, bevel: 0.05 }); });
      }
    }
    this.pop();
    return this;
  };
  // A window facing +z: a pane (glows at dusk), a sill and lintel, optional arch, mullion and shutters.
  B.window = function (x, y, z, w, h, o) {
    o = o || {}; var self = this;
    this.push(x, y, z, o.ry || 0);
    if (o.arch) {
      var pts = [[-w / 2, 0], [w / 2, 0], [w / 2, h - w / 2]], seg = 7;
      for (var i = 1; i < seg; i++) { var a = i / seg * Math.PI; pts.push([Math.cos(a) * w / 2, h - w / 2 + Math.sin(a) * w / 2]); }
      pts.push([-w / 2, h - w / 2]);
      this.extrude(0, 0, -0.06, pts, 0.14, { c: '#1f1f21', m: M.window, ao: 0, jit: 0 });
    } else this.box(0, 0, -0.06, w, h, 0.14, { c: '#1f1f21', m: M.window, ao: 0, jit: 0, bevel: 0 });
    if (o.mullion !== false) {
      this.box(0, 0, 0.0, 0.05, h * (o.arch ? 0.92 : 1), 0.05, { c: o.frameC || 'woodDark', m: M.wood, bevel: 0.01, ao: 0 });
      this.box(0, h * 0.52, 0.0, w, 0.05, 0.05, { c: o.frameC || 'woodDark', m: M.wood, bevel: 0.01, ao: 0 });
    }
    var sc = o.sillC || 'stone', sm = o.sillM === undefined ? M.stone : o.sillM;
    this.box(0, -0.12, 0.06, w + 0.3, 0.12, 0.22, { c: sc, m: sm, bevel: 0.03 });
    if (!o.arch) this.box(0, h, 0.04, w + 0.34, 0.16, 0.2, { c: o.lintelC || sc, m: sm, bevel: 0.03 });
    if (o.shutters) [-1, 1].forEach(function (s) { self.box(s * (w * 0.75 + 0.03), 0, 0.06, w * 0.5, h, 0.05, { c: o.shutters, m: M.paint, ry: s * 0.25, bevel: 0.01 }); });
    if (o.box) { this.box(0, -0.42, 0.22, w + 0.2, 0.28, 0.3, { c: 'wood', m: M.wood }); for (var f = 0; f < 5; f++) this.ball(-w / 2 + f * w / 4, -0.12, 0.25 + self.j(0.05), 0.09, { c: self.pick(PAL.flowers), m: M.leaf, ao: 0 }); }
    this.pop();
    return this;
  };

  // ---------------------------------------------------------------- timber
  B.post = function (x, y, z, r, h, o) { return this.box(x, y, z, r * 2, h, r * 2, Object.assign({ c: 'beam', m: M.wood, bevel: r * 0.25 }, o)); };
  B.log = function (x, y, z, r, h, o) { return this.cyl(x, y, z, r, h, Object.assign({ c: 'wood', m: M.wood, seg: 7, flat: true }, o)); };
  // planks across a span facing +z: a plank wall w wide, h tall at (x, y, z)
  B.planks = function (x, y, z, w, h, o) {
    o = o || {}; var n = Math.max(1, Math.round((o.vertical ? w : h) / (o.pw || 0.28))), self = this;
    this.push(x, y, z, o.ry || 0);
    for (var i = 0; i < n; i++) {
      if (o.vertical) { var pw = w / n; this.box(-w / 2 + (i + 0.5) * pw, 0, 0, pw - 0.02, h * (1 + self.j(0.02)), o.t || 0.08, { c: o.c || 'woodLight', m: M.wood, bevel: 0.012 }); }
      else { var ph = h / n; this.box(0, i * ph, self.j(0.01), w, ph - 0.02, o.t || 0.08, { c: o.c || 'woodLight', m: M.wood, bevel: 0.012 }); }
    }
    this.pop();
    return this;
  };
  B.ladder = function (x, y, z, h, o) {
    o = o || {}; var w = o.w || 0.5, lean = o.lean || 0.25, self = this;
    this.push(x, y, z, o.ry || 0);
    [-1, 1].forEach(function (s) { self.beam([s * w / 2, 0, lean * h * 0.3], [s * w / 2, h, 0], 0.04, { c: 'woodLight' }); });
    for (var k = 1; k < h / 0.33; k++) { var t = k * 0.33 / h; this.beam([-w / 2, t * h, lean * h * 0.3 * (1 - t)], [w / 2, t * h, lean * h * 0.3 * (1 - t)], 0.025, { c: 'woodLight', round: true }); }
    this.pop();
    return this;
  };
  B.fence = function (pts, o) {
    o = o || {}; var self = this, h = o.h || 1.1, step = o.step || 1.6;
    for (var s = 0; s < pts.length - 1; s++) {
      var a = pts[s], b = pts[s + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / step));
      for (var i = 0; i < n; i++) {
        var x0 = lerp(a[0], b[0], i / n), z0 = lerp(a[1], b[1], i / n), x1 = lerp(a[0], b[0], (i + 1) / n), z1 = lerp(a[1], b[1], (i + 1) / n);
        this.unit(function () {
          self.post(x0, 0, z0, 0.07, h + self.j(0.06), { c: 'wood', ry: self.j(0.2) });
          self.beam([x0, h * 0.75, z0], [x1, h * 0.75 + self.j(0.04), z1], 0.04, { c: 'woodLight', roll: self.j(0.2) });
          self.beam([x0, h * 0.38, z0], [x1, h * 0.38 + self.j(0.04), z1], 0.04, { c: 'woodLight', roll: self.j(0.2) });
        });
      }
      if (s === pts.length - 2) self.post(b[0], 0, b[1], 0.07, h, { c: 'wood' });
    }
    return this;
  };
  B.palisade = function (pts, o) {
    o = o || {}; var self = this, h = o.h || 3.2, r = o.r || 0.16;
    for (var s = 0; s < pts.length - 1; s++) {
      var a = pts[s], b = pts[s + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / (r * 2.05)));
      for (var i = 0; i < n; i += (o.per || 4)) {
        this.unit(function () {
          for (var k = i; k < Math.min(n, i + (o.per || 4)); k++) {
            var t = (k + 0.5) / n, x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t), hh = h * (0.92 + self.r() * 0.16);
            self.log(x, 0, z, r * (0.9 + self.r() * 0.2), hh, { c: 'wood' });
            self.cone(x, hh, z, r * (0.9 + self.r() * 0.1), r * 3, { c: 'woodLight', m: M.wood, seg: 7, flat: true });
          }
        });
      }
    }
    return this;
  };

  // ---------------------------------------------------------------- cloth
  // A hanging banner from a crossbar at (x, y, z) (y = the bar), w wide and h long, facing +z.
  // o: { c (field), trim, emblem ('swords'|'sun'|'tower'|'cross'|'none'), ec (emblem colour), tail ('point'|'swallow'|'flat'), ry, wave }
  B.banner = function (x, y, z, w, h, o) {
    o = o || {}; var self = this, sx = 4, sy = 10, tail = o.tail || 'swallow';
    var g = planeGeo(w, h, sx, sy), p = g.attributes.position, sway = [];
    for (var i = 0; i < p.count; i++) {
      var px = p.getX(i), py = p.getY(i), t = (h / 2 - py) / h; // 0 at the bar, 1 at the bottom
      if (t > 0.82) { var k = (t - 0.82) / 0.18; if (tail === 'point') px *= 1 - k * 0.98; else if (tail === 'swallow') py += Math.abs(px) / (w / 2) * 0 + (1 - Math.abs(px) / (w / 2)) * k * h * 0.14; }
      var wave = Math.sin(px * 3.1 + t * 2.0 + this.seed) * 0.05 * t + (o.wave || 0) * t * t;
      p.setXYZ(i, px, py - h / 2, wave);
      sway.push(t * t);
    }
    g.setAttribute('sway', new T.Float32BufferAttribute(sway, 1));
    g.computeVertexNormals();
    this.push(x, y, z, o.ry || 0);
    this.addGeo(g, { c: o.c || 'crimson', m: M.cloth, bucket: 'cloth', sway: 1, ao: 0.15, jit: 0.02, vary: 0.04 });
    if (o.band) {
      // a stripe across the cloth, following its folds, just proud of both faces
      var b0 = o.bandAt || 0.7, bh = o.bandH || 0.07, gb = planeGeo(w, h * bh, sx, 2), pb = gb.attributes.position;
      for (var j = 0; j < pb.count; j++) {
        var bx = pb.getX(j), tb = b0 + (0.5 - pb.getY(j) / (h * bh)) * bh;
        pb.setXYZ(j, bx, h / 2 - tb * h - h / 2, Math.sin(bx * 3.1 + tb * 2.0 + this.seed) * 0.05 * tb + (o.wave || 0) * tb * tb);
      }
      gb.computeVertexNormals();
      [0.011, -0.011].forEach(function (dz) { self.addGeo(gb.clone(), { z: dz, c: o.band, m: M.cloth, bucket: 'cloth', ao: 0, jit: 0.01, vary: 0.02 }); });
    }
    if (o.trim !== false) this.box(0, -0.06, 0.0, w, 0.12, 0.03, { c: o.trim || 'brass', m: o.trim ? M.metal : M.gold, bevel: 0.01 });
    this.beam([-w / 2 - 0.15, 0.02, 0.0], [w / 2 + 0.15, 0.02, 0.0], 0.035, { c: 'woodDark', round: true });
    this.emblem(0, -h * 0.42, 0, Math.min(w, h) * (o.es || 0.55), o.emblem || 'swords', o.ec || '#e8d7a8');
    this.pop();
    return this;
  };
  // a heraldic emblem drawn just proud of both faces of a cloth at (x,y,z), size s
  B.emblem = function (x, y, z, s, kind, ec) {
    if (kind === 'none') return this;
    var self = this, shapes = [];
    if (kind === 'swords') {
      var blade = [[-0.05, -0.42], [0.05, -0.42], [0.05, 0.36], [0, 0.46], [-0.05, 0.36]];
      var guard = [[-0.2, -0.3], [0.2, -0.3], [0.2, -0.24], [-0.2, -0.24]];
      [-0.6, 0.6].forEach(function (a) { shapes.push({ pts: blade, rz: a }); shapes.push({ pts: guard, rz: a }); });
    } else if (kind === 'sun') {
      var sun = []; for (var i = 0; i < 24; i++) { var a = i / 24 * Math.PI * 2, rr = i % 2 ? 0.26 : 0.42; sun.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      shapes.push({ pts: sun, rz: 0 });
    } else if (kind === 'tower') {
      shapes.push({ pts: [[-0.25, -0.4], [0.25, -0.4], [0.25, 0.2], [0.32, 0.2], [0.32, 0.4], [0.18, 0.4], [0.18, 0.3], [0.06, 0.3], [0.06, 0.4], [-0.06, 0.4], [-0.06, 0.3], [-0.18, 0.3], [-0.18, 0.4], [-0.32, 0.4], [-0.32, 0.2], [-0.25, 0.2]], rz: 0 });
    } else if (kind === 'cross') {
      shapes.push({ pts: [[-0.06, -0.42], [0.06, -0.42], [0.06, 0.12], [0.26, 0.12], [0.26, 0.24], [0.06, 0.24], [0.06, 0.42], [-0.06, 0.42], [-0.06, 0.24], [-0.26, 0.24], [-0.26, 0.12], [-0.06, 0.12]], rz: 0 });
    }
    shapes.forEach(function (sh) {
      var pts = sh.pts.map(function (p) { return [p[0] * s, p[1] * s]; });
      [0.012, -0.012].forEach(function (dz) { self.addGeo(extrudeGeo(pts, 0.006), { x: x, y: y, z: z + dz + 0.0, rz: sh.rz, c: ec, m: M.cloth, bucket: 'cloth', ao: 0, jit: 0.01, vary: 0.02 }); });
    });
    return this;
  };
  // a flag on a pole: pole base at (x, y, z), pole height ph, flag w x h flying toward +x (rotate with o.ry)
  B.flag = function (x, y, z, ph, w, h, o) {
    o = o || {}; var self = this;
    this.push(x, y, z, o.ry || 0);
    this.cyl(0, 0, 0, o.pr || 0.05, ph, { c: 'woodDark', seg: 6, r2: (o.pr || 0.05) * 0.7 });
    this.ball(0, ph, 0, (o.pr || 0.05) * 1.6, { c: 'brass', m: M.gold });
    var g = planeGeo(w, h, 8, 3), p = g.attributes.position, sway = [];
    for (var i = 0; i < p.count; i++) {
      var px = p.getX(i) + w / 2, py = p.getY(i), t = px / w;
      if (o.pennant) py *= 1 - t * 0.85;
      p.setXYZ(i, px, py + ph - h / 2 - 0.08, Math.sin(t * 5.0 + this.seed) * 0.12 * t);
      sway.push(t);
    }
    g.setAttribute('sway', new T.Float32BufferAttribute(sway, 1)); g.computeVertexNormals();
    this.addGeo(g, { c: o.c || 'crimson', m: M.cloth, bucket: 'cloth', sway: 1, ao: 0.1, jit: 0.02 });
    if (o.emblem) this.emblem(w * 0.45, ph - h / 2 - 0.08, 0, h * 0.7, o.emblem, o.ec || '#e8d7a8');
    this.pop();
    return this;
  };
  // a round pavilion: walls of radius r and height wh, a peaked roof rising rh, a scalloped valance, a centre pole
  // with a finial and pennant, and guy ropes. o.stripes: [hex, hex] alternate panels; o.open: front opening angle.
  B.pavilion = function (x, z, r, wh, rh, o) {
    o = o || {}; var self = this, seg = o.seg || 16, c1 = o.c || 'canvas', stripes = o.stripes;
    this.push(x, 0, z, o.ry || 0);
    var pick = function (a) { if (!stripes) return null; var k = Math.floor(((a / (Math.PI * 2)) % 1 + 1) % 1 * seg); return stripes[k % 2]; };
    // centre pole first
    this.unit(function () { self.log(0, 0, 0, 0.09, wh + rh + 0.9, { c: 'woodDark' }); });
    // the walls, panel by panel
    var open = o.open || 0;
    for (var k = 0; k < seg; k++) {
      var a0 = k / seg * Math.PI * 2, a1 = (k + 1) / seg * Math.PI * 2, am = (a0 + a1) / 2;
      var front = Math.abs(((am - Math.PI / 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI) < open / 2;
      this.unit(function () {
        self.post(Math.cos(a0) * r, 0, Math.sin(a0) * r, 0.045, wh, { c: 'wood' });
        if (front) return;
        var g = planeGeo(1, 1, 1, 4), p = g.attributes.position;
        var x0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r, x1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
        for (var i = 0; i < p.count; i++) { var u = p.getX(i) + 0.5, v = p.getY(i) + 0.5, bulge = Math.sin(u * Math.PI) * 0.06 * (1 - v); p.setXYZ(i, lerp(x0, x1, u) + Math.cos(am) * bulge, v * wh, lerp(z0, z1, u) + Math.sin(am) * bulge); }
        g.computeVertexNormals();
        self.addGeo(g, { c: pick(am) || c1, m: M.cloth, bucket: 'cloth', ao: 0.35, jit: 0.02 });
      });
    }
    // the roof, a gore at a time, sagging a little between the ribs
    for (var q = 0; q < seg; q++) {
      (function (q) {
        var a0 = q / seg * Math.PI * 2, a1 = (q + 1) / seg * Math.PI * 2, am = (a0 + a1) / 2, rr = r * 1.08;
        self.unit(function () {
          var g = planeGeo(1, 1, 2, 6), p = g.attributes.position;
          for (var i = 0; i < p.count; i++) {
            var u = p.getX(i) + 0.5, v = p.getY(i) + 0.5, a = lerp(a0, a1, u), rad = rr * (1 - v), sag = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.16;
            var yy = wh + rh * Math.pow(v, 0.85) - sag;
            p.setXYZ(i, Math.cos(a) * rad, yy, Math.sin(a) * rad);
          }
          g.computeVertexNormals(); var n = g.attributes.normal; for (var j = 0; j < n.count; j++) if (n.getY(j) < 0) n.setXYZ(j, -n.getX(j), -n.getY(j), -n.getZ(j));
          self.addGeo(g, { c: pick(am) || o.roofC || c1, m: M.cloth, bucket: 'cloth', ao: 0.1, jit: 0.02 });
        });
      })(q);
    }
    // valance: scallops round the eave
    this.unit(function () {
      var rr = r * 1.085, n = seg * 2, vh = o.valance || 0.45;
      for (var k = 0; k < n; k++) {
        var a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2, g = planeGeo(1, 1, 4, 2), p = g.attributes.position;
        for (var i = 0; i < p.count; i++) { var u = p.getX(i) + 0.5, v = p.getY(i) + 0.5, a = lerp(a0, a1, u), cut = Math.sin(u * Math.PI) * 0.5 + 0.5; p.setXYZ(i, Math.cos(a) * rr, wh - vh * (1 - v) * cut + 0.02, Math.sin(a) * rr); }
        g.computeVertexNormals();
        self.addGeo(g, { c: o.valanceC || (k % 2 ? o.trim || 'crimson' : o.trim2 || o.trim || 'crimson'), m: M.cloth, bucket: 'cloth', ao: 0.05, jit: 0.02, sway: 0.25, swayFn: function (lx, ly) { return 1; } });
      }
    });
    // finial and pennant
    this.unit(function () {
      self.ball(0, wh + rh + 0.9, 0, 0.12, { c: 'brass', m: M.gold });
      if (o.pennant !== false) self.flag(0, wh + rh + 0.2, 0, 0.75, 0.9, 0.38, { c: o.pennantC || o.trim || 'crimson', pennant: true, pr: 0.03 });
    });
    // guy ropes and pegs
    if (o.ropes !== false) this.unit(function () {
      for (var k = 0; k < 8; k++) { var a = k / 8 * Math.PI * 2 + 0.2, px = Math.cos(a) * (r + 1.4), pz = Math.sin(a) * (r + 1.4); self.beam([Math.cos(a) * r * 1.08, wh + 0.05, Math.sin(a) * r * 1.08], [px, 0.05, pz], 0.012, { c: 'rope', m: M.rope, round: true, seg: 4 }); self.post(px, 0, pz, 0.04, 0.25, { c: 'woodLight' }); }
    });
    this.pop();
    return this;
  };
  // an A-frame tent along x: length w, width d, height h
  B.ridgeTent = function (x, z, w, d, h, o) {
    o = o || {}; var self = this;
    this.push(x, 0, z, o.ry || 0);
    this.unit(function () { self.post(-w / 2, 0, 0, 0.05, h + 0.3, { c: 'wood' }); self.post(w / 2, 0, 0, 0.05, h + 0.3, { c: 'wood' }); self.beam([-w / 2 - 0.2, h, 0], [w / 2 + 0.2, h, 0], 0.04, { c: 'wood', round: true }); });
    [-1, 1].forEach(function (s) {
      self.unit(function () {
        var g = planeGeo(1, 1, 6, 3), p = g.attributes.position;
        for (var i = 0; i < p.count; i++) { var u = p.getX(i) + 0.5, v = p.getY(i) + 0.5, sag = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.1; p.setXYZ(i, lerp(-w / 2, w / 2, u), h * (1 - v) + 0.0 - sag * 0.5, s * (d / 2 * v - sag)); }
        g.computeVertexNormals();
        self.addGeo(g, { c: o.c || 'canvas', m: M.cloth, bucket: 'cloth', ao: 0.3 });
      });
    });
    this.unit(function () { self.extrude(-w / 2 + 0.01, 0, 0, [[-d / 2, 0], [d / 2, 0], [0, h]], 0.02, { c: o.c || 'canvasDusty', m: M.cloth, ry: Math.PI / 2, bucket: 'cloth' }); });
    this.pop();
    return this;
  };
  // a sloping awning from a wall: (x, y, z) the high edge's centre, w wide, reaching out d and dropping dy, on two poles
  B.awning = function (x, y, z, w, d, dy, o) {
    o = o || {}; var self = this;
    this.push(x, y, z, o.ry || 0);
    var stripes = o.stripes, ns = o.n || 6;
    var g = planeGeo(1, 1, stripes ? ns * 2 : 6, 4).toNonIndexed(), p = g.attributes.position, sway = [], cols = [];
    for (var i = 0; i < p.count; i++) { var u = p.getX(i) + 0.5, v = p.getY(i) + 0.5, sag = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.08 + Math.sin(u * Math.PI * ns) * 0.025 * v; p.setXYZ(i, (u - 0.5) * w, -dy * v - sag, d * v); sway.push(v * 0.4); }
    if (stripes) for (var t3 = 0; t3 < p.count; t3 += 3) {
      // each triangle takes its stripe from its centre, so the stripes stay crisp
      var uc = (p.getX(t3) + p.getX(t3 + 1) + p.getX(t3 + 2)) / 3 / w + 0.5, sc0 = U.col(stripes[Math.floor(uc * ns) % 2]).convertSRGBToLinear();
      for (var q3 = 0; q3 < 3; q3++) cols.push(sc0.r, sc0.g, sc0.b);
    }
    g.setAttribute('sway', new T.Float32BufferAttribute(sway, 1)); g.computeVertexNormals();
    if (stripes) g.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    var n = g.attributes.normal; for (var j = 0; j < n.count; j++) if (n.getY(j) < 0) n.setXYZ(j, -n.getX(j), -n.getY(j), -n.getZ(j));
    this.addGeo(g, { c: stripes ? '#ffffff' : (o.c || 'canvas'), jit: stripes ? 0 : undefined, m: M.cloth, bucket: 'cloth', sway: 1, ao: 0.1 });
    // scalloped front edge
    var sc = Math.max(3, Math.round(w / 0.5));
    for (var k = 0; k < sc; k++) {
      var gx = planeGeo(w / sc, 0.22, 2, 1), pp = gx.attributes.position;
      for (var t = 0; t < pp.count; t++) { var lx2 = pp.getX(t), ly2 = pp.getY(t); if (ly2 < 0) pp.setY(t, ly2 * (1 - Math.abs(lx2) / (w / sc / 2)) * 1.0); }
      gx.computeVertexNormals();
      this.addGeo(gx, { x: -w / 2 + (k + 0.5) * w / sc, y: -dy - 0.11, z: d, c: o.trim || (stripes ? stripes[k % 2] : 'crimson'), m: M.cloth, bucket: 'cloth', ao: 0 });
    }
    if (o.poles !== false) [-1, 1].forEach(function (s) { self.post(s * w / 2 * 0.96, -y, d, 0.045, y - dy, { c: 'wood' }); });
    this.pop();
    return this;
  };

  // ---------------------------------------------------------------- fire, light and smoke
  // a flame at (x, y, z), s high. Glows past white so the bloom catches it.
  B.flame = function (x, y, z, s, o) {
    o = o || {}; var self = this;
    var mk = function (r, h, c, k, rot) {
      var g = cylGeo(r, 0.001, h, 6, { hseg: 3 }), p = g.attributes.position;
      for (var i = 0; i < p.count; i++) { var yy = p.getY(i) / h; p.setX(i, p.getX(i) + Math.sin(yy * 5 + rot) * r * 0.35 * yy); p.setZ(i, p.getZ(i) + Math.cos(yy * 4 + rot) * r * 0.3 * yy); }
      self.addGeo(g, { x: x, y: y, z: z, ry: rot, c: c, bucket: 'glow', glow: k, ao: 0, jit: 0, vary: 0.15 });
    };
    mk(0.2 * s, 0.9 * s, '#e0602a', 2.2, 0.3);
    mk(0.13 * s, 0.75 * s, '#f39a3a', 3.2, 1.7);
    mk(0.07 * s, 0.5 * s, '#ffe7a0', 4.5, 2.9);
    if (o.light !== false) this.light(x, y + 0.4 * s, z, o.color || '#ff8c3a', o.i || 1);
    return this;
  };
  // a torchlight source (used by the dusk look); it lights only once its step is laid
  B.light = function (x, y, z, color, i) {
    var p = this.world(x, y, z);
    this.root().torches.push({ pos: [p.x, p.y, p.z], color: color || '#ff8c3a', i: i || 1, unit: this.unitNow() });
    return this;
  };
  // glowing coals in a bowl or hearth: a flattened cluster
  B.embers = function (x, y, z, r, o) {
    for (var i = 0; i < 7; i++) { var a = this.r() * Math.PI * 2, d = this.r() * r * 0.7; this.addGeo(ballGeo(r * (0.18 + this.r() * 0.15), 0), { x: x + Math.cos(a) * d, y: y, z: z + Math.sin(a) * d, sy: 0.6, c: this.pick(['#ff7a2a', '#ffb347', '#e04f1f']), bucket: 'glow', glow: 2.4, ao: 0, jit: 0 }); }
    if (!o || o.light !== false) this.light(x, y + 0.5, z, '#ff7a2a', 0.8);
    return this;
  };
  B.torch = function (x, y, z, o) {
    o = o || {};
    this.push(x, y, z, o.ry || 0);
    this.box(0, -0.1, -0.06, 0.06, 0.25, 0.12, { c: 'iron', m: M.metal, bevel: 0.01 });
    this.beam([0, 0, 0], [0, 0.42, 0.16], 0.03, { c: 'woodDark', round: true });
    this.cyl(0, 0.36, 0.14, 0.07, 0.12, { c: 'iron', m: M.metal, r2: 0.09, seg: 6 });
    this.flame(0, 0.46, 0.15, o.s || 0.7, { i: o.i || 1 });
    this.pop();
    return this;
  };
  B.brazier = function (x, y, z, s, o) {
    s = s || 1; var self = this;
    this.push(x, y, z, 0);
    [0, 2.1, 4.2].forEach(function (a) { self.beam([Math.cos(a) * 0.35 * s, 0, Math.sin(a) * 0.35 * s], [Math.cos(a) * 0.16 * s, 0.85 * s, Math.sin(a) * 0.16 * s], 0.03 * s, { c: 'iron', m: M.metal }); });
    this.lathe(0, 0.8 * s, 0, [[0.05, 0], [0.32 * s, 0.05 * s], [0.42 * s, 0.25 * s], [0.38 * s, 0.27 * s], [0.28 * s, 0.1 * s], [0.01, 0.08 * s]], { c: 'iron', m: M.metal, seg: 12 });
    this.embers(0, 1.0 * s, 0, 0.32 * s, { light: false });
    this.flame(0, 1.0 * s, 0, 1.1 * s, { i: (o && o.i) || 1.4 });
    this.pop();
    return this;
  };
  // smoke rising from (x, y, z): puffs growing and fading upward (shown once it stands)
  B.smoke = function (x, y, z, o) {
    o = o || {}; var self = this;
    this.life(function () { for (var i = 0; i < 6; i++) { var t = i / 6; self.ball(x + Math.sin(i * 1.7) * 0.3 * t + t * 0.8, y + t * 3.2, z + Math.cos(i * 1.3) * 0.3 * t, 0.25 + t * 0.55, { c: i < 2 ? '#d9d2c4' : '#e8e3d8', m: M.cloth, ao: 0.1, detail: 1, smooth: true, vary: 0.02 }); } });
    return this;
  };

  // ---------------------------------------------------------------- finishing
  // Turn the build into meshes. mats: KIT.makeMaterials(uniforms). Returns { group, units, parts, torches, bounds }.
  B.finish = function (mats, opts) {
    opts = opts || {};
    var self = this, group = new T.Group(), U = this.nUnits;
    var depthFor = { solid: mats.depth, cloth: mats.depth, leaf: mats.depthLeaf, leafTri: mats.depthLeafTri, needle: mats.depthNeedle, grass: mats.depthGrass };
    function meshes(bks, parent) {
      Object.keys(bks).forEach(function (name) {
        var bk = bks[name]; if (!bk.n) return;
        var units = bk.unit.done().map(function (u) { return u === 99999 ? U : u; });
        var g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(bk.pos.done(), 3));
        g.setAttribute('normal', new T.BufferAttribute(bk.nor.done(), 3));
        g.setAttribute('color', new T.BufferAttribute(bk.col.done(), 3));
        g.setAttribute('aUnit', new T.BufferAttribute(units, 1));
        g.setAttribute('aMat', new T.BufferAttribute(bk.mat.done(), 1));
        g.setAttribute('aAO', new T.BufferAttribute(bk.ao.done(), 1));
        g.setAttribute('aSway', new T.BufferAttribute(bk.sway.done(), 1));
        if (bk.uv) g.setAttribute('uv', new T.BufferAttribute(bk.uv.done(), 2));
        g.setIndex(bk.n > 65535 ? new T.BufferAttribute(bk.idx.done(), 1) : new T.Uint16BufferAttribute(bk.idx.done(), 1));
        g.computeBoundingSphere(); g.computeBoundingBox();
        var mesh = new T.Mesh(g, mats[name] || mats.solid);
        mesh.frustumCulled = false;
        if (name !== 'glow') { mesh.castShadow = opts.shadows !== false; mesh.receiveShadow = true; mesh.customDepthMaterial = depthFor[name] || mats.depth; }
        parent.add(mesh);
        if ((name === 'solid' || name === 'cloth') && opts.ghost !== false) { var gm = new T.Mesh(g, mats.ghost); gm.renderOrder = 5; gm.frustumCulled = false; gm.userData.ghost = mats.ghostSolid; parent.add(gm); }
      });
    }
    meshes(this.buckets, group);
    this.spinners.forEach(function (sp) {
      var g2 = new T.Group(); g2.position.copy(sp.pivot); g2.quaternion.copy(sp.quat);
      meshes(sp.builder.buckets, g2); g2.userData.spin = { axis: sp.axis, speed: sp.speed }; group.add(g2);
    });
    var bounds = new T.Box3();
    group.traverse(function (o) { if (o.isMesh && o.geometry.boundingBox) bounds.union(o.geometry.boundingBox); });
    var parts = this.parts.map(function (p, i) { var nx = self.parts[i + 1]; return { name: p.name, from: p.from, to: nx ? nx.from : U }; });
    return { group: group, units: U, parts: parts, torches: this.torches.map(function (t) { return Object.assign({}, t, { unit: t.unit === 99999 ? U : t.unit }); }), bounds: bounds };
  };
  // Pieces that turn (windmill sails, a waterwheel): pivot in local coords, axis [x,y,z], speed in rad/s.
  // fn receives a builder whose origin is the pivot. Its steps continue the build's own numbering.
  B.spin = function (pivot, axis, speed, fn) {
    var sb = new Builder(this.seed + 7, { parent: this });
    sb.curUnit = null;
    var pw = this.world(pivot[0], pivot[1], pivot[2]);
    var q = new T.Quaternion(); this.top().decompose(new T.Vector3(), q, new T.Vector3());
    this.spinners.push({ builder: sb, pivot: pw, quat: q, axis: new T.Vector3(axis[0], axis[1], axis[2]).normalize(), speed: speed });
    // share the unit counter: the child asks the root for units, and honours the parent's open unit
    var self = this;
    sb.unitNow = function () { if (sb.mode === 'base' || self.mode === 'base') return -1; if (sb.mode === 'life' || self.mode === 'life') return 99999; if (sb.curUnit !== null) return sb.curUnit; if (self.curUnit !== null) return self.curUnit; return self.root().nUnits++; };
    sb.unit = function (f) { if (sb.curUnit !== null || self.curUnit !== null || sb.mode || self.mode) { f.call(sb, sb); return sb; } sb.curUnit = self.root().nUnits++; f.call(sb, sb); sb.curUnit = null; return sb; };
    sb.light = function (x, y, z, c, i) { var p = sb.world(x, y, z).applyQuaternion(q).add(pw); self.root().torches.push({ pos: [p.x, p.y, p.z], color: c, i: i || 1, unit: sb.unitNow() }); return sb; };
    fn.call(sb, sb);
    return this;
  };
})();
