// Painterly village kit, part 6: dragons. One generator draws every kind: a spine curve from the tail tip to the back
// of the head, skinned with oval rings; a head with its own profile; legs placed by two-bone IK; bat wings of bone
// and membrane that fold or spread; fins, spines, horns, a saddle and a rider. Poses move the spine and the limbs,
// kinds change the proportions and the details. The dragon faces +z and stands on y = 0; its left side is +x.
(function () {
  var T = THREE, KIT = window.KIT, M = KIT.M, U = KIT.util, B = KIT.Builder.prototype;
  var SCALE = M.scale !== undefined ? M.scale : M.skin;
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  function A(a) { return V(a[0], a[1], a[2]); }
  T.BufferGeometry.prototype.ni = function () { return this.index ? this.toNonIndexed() : this; };
  function lin(hex) { return new T.Color(hex).convertSRGBToLinear(); }
  function sm(t) { t = U.clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function mixC(a, b, t) { return a.clone().lerp(b, U.clamp(t, 0, 1)); }

  // ------------------------------------------------------------------ the kinds
  // body: keys along the spine, tail tip first: [x, y, z] is the stand pose; r = [half width, half height]
  var KINDS = {
    night: {
      name: 'Night dragon', col: '#211f1e', col2: '#292726', belly: '#1c1b1a', mem: '#1c1a1a', bone: '#171515', eye: '#c3e255', claw: '#8d8f92',
      len: 1, ex: 2.3, belly0: 0.86, spines: 'fins', ears: 'night', tailFins: 'night', prosthetic: true, wings: { span: 1, fingers: 4, k: 1 }, head: 'night', legs: 4,
      rad: [[0.035, 0.03], [0.075, 0.07], [0.12, 0.11], [0.18, 0.17], [0.26, 0.26], [0.42, 0.44], [0.5, 0.52], [0.52, 0.55], [0.53, 0.56], [0.42, 0.44], [0.36, 0.38], [0.33, 0.35]]
    },
    dawn: {
      name: 'Dawn dragon', col: '#eceae4', col2: '#f6f4ef', belly: '#e2ded5', mem: '#e6e3dc', bone: '#d9d5cc', eye: '#8ec3e6', claw: '#a8a49a',
      len: 1.04, ex: 2.1, belly0: 0.88, spines: 'none', ears: 'dawn', tailFins: 'dawn', wings: { span: 1.06, fingers: 4, k: 1 }, head: 'dawn', legs: 4, slim: 0.86,
      rad: [[0.03, 0.03], [0.06, 0.055], [0.1, 0.09], [0.15, 0.14], [0.2, 0.2], [0.31, 0.34], [0.38, 0.41], [0.39, 0.43], [0.4, 0.44], [0.26, 0.29], [0.22, 0.24], [0.23, 0.25]]
    },
    boulder: {
      name: 'Boulder dragon', col: '#565553', col2: '#636260', belly: '#77736b', mem: '#5d5c59', bone: '#4f4e4b', eye: '#e9d9a0', claw: '#3b3a38',
      len: 0.62, ex: 2.0, belly0: 0.92, spines: 'knobs', ears: 'none', tailFins: 'club', bumps: true, wings: { span: 0.42, fingers: 3, k: 0.7 }, head: 'boulder', legs: 4, stout: true,
      rad: [[0.16, 0.16], [0.2, 0.2], [0.24, 0.23], [0.3, 0.3], [0.42, 0.42], [0.68, 0.66], [0.82, 0.8], [0.84, 0.82], [0.78, 0.76], [0.5, 0.5], [0.44, 0.44], [0.42, 0.42]]
    },
    ember: {
      name: 'Ember dragon', col: '#232224', col2: '#2b2a2c', belly: '#c95a1f', mem: '#3a2a24', bone: '#1d1c1e', eye: '#f2b33d', claw: '#d9d2c4',
      len: 1.22, ex: 2.2, belly0: 0.84, spines: 'big', ears: 'none', horns: 'ember', tailFins: 'spikes', wings: { span: 1.12, fingers: 4, k: 1.05, claws: true }, head: 'ember', legs: 4, bellyCol: true, slim: 0.9,
      rad: [[0.03, 0.03], [0.06, 0.06], [0.1, 0.1], [0.15, 0.15], [0.21, 0.21], [0.33, 0.36], [0.4, 0.43], [0.41, 0.45], [0.42, 0.46], [0.24, 0.27], [0.2, 0.22], [0.22, 0.24]]
    },
    crest: {
      name: 'Crest dragon', col: '#d7d3c9', col2: '#e4e0d7', belly: '#ebe8e1', mem: '#bdb8ad', bone: '#2a2927', eye: '#f2c74a', claw: '#2a2927',
      len: 0.92, ex: 2.0, belly0: 0.9, spines: 'tailspikes', ears: 'none', crest: true, tailFins: 'spikes', spots: true, wings: { span: 0.95, fingers: 4, k: 0.95 }, head: 'crest', legs: 2, slim: 0.82,
      rad: [[0.03, 0.03], [0.06, 0.06], [0.1, 0.1], [0.14, 0.14], [0.2, 0.2], [0.3, 0.33], [0.37, 0.4], [0.37, 0.42], [0.35, 0.4], [0.2, 0.22], [0.16, 0.17], [0.17, 0.18]]
    }
  };
  KIT.dragonKinds = KINDS;

  // ------------------------------------------------------------------ poses
  // spine keys (12, tail tip to head base; index 5 the hips, 8 the shoulders), head direction, legs' feet, wing spread 0..1
  var POSES = {
    stand: {
      spine: [[-1.5, 0.1, -4.9], [-1.35, 0.11, -4.25], [-0.95, 0.16, -3.6], [-0.45, 0.3, -2.95], [-0.12, 0.58, -2.3], [0, 0.92, -1.55], [0, 0.98, -0.8], [0, 1.0, -0.1], [0, 1.08, 0.55], [0, 1.32, 1.02], [0, 1.56, 1.32], [0, 1.7, 1.52]],
      head: [0, -0.22, 1], feet: { fl: [0.42, 0, 0.82], fr: [-0.42, 0, 0.62], hl: [0.48, 0, -1.25], hr: [-0.46, 0, -1.75] }, wing: 0.0, tilt: 0
    },
    alert: {
      spine: [[-1.9, 0.1, -4.3], [-1.75, 0.11, -3.7], [-1.35, 0.15, -3.1], [-0.8, 0.28, -2.55], [-0.3, 0.55, -2.1], [0, 0.92, -1.45], [0, 1.05, -0.75], [0, 1.12, -0.08], [0, 1.28, 0.5], [0, 1.72, 0.95], [0, 2.15, 1.15], [0, 2.38, 1.3]],
      head: [0.12, -0.08, 1], feet: { fl: [0.44, 0, 0.75], fr: [-0.4, 0, 0.45], hl: [0.5, 0, -1.2], hr: [-0.5, 0, -1.6] }, wing: 0.35, tilt: 0
    },
    // low in front and high at the hips, head up and curious, the way a cat watches something
    crouch: {
      spine: [[-2.2, 0.1, -3.9], [-2.0, 0.11, -3.35], [-1.55, 0.16, -2.85], [-0.95, 0.36, -2.4], [-0.35, 0.78, -1.95], [0, 1.1, -1.4], [0, 1.04, -0.72], [0, 0.9, -0.08], [0, 0.84, 0.5], [0, 0.98, 0.98], [0, 1.18, 1.32], [0, 1.3, 1.58]],
      head: [0.1, 0.02, 1], feet: { fl: [0.48, 0, 1.0], fr: [-0.44, 0, 0.78], hl: [0.52, 0, -1.15], hr: [-0.5, 0, -1.5] }, wing: 0.1, tilt: 0
    },
    sit: {
      spine: [[1.55, 0.08, 1.45], [1.35, 0.09, 0.75], [1.2, 0.1, 0.05], [0.95, 0.14, -0.6], [0.5, 0.3, -1.05], [0, 0.62, -0.95], [0, 0.98, -0.6], [0, 1.32, -0.18], [0, 1.6, 0.25], [0, 1.98, 0.62], [0, 2.3, 0.85], [0, 2.5, 1.02]],
      head: [0, -0.3, 1], feet: { fl: [0.32, 0, 0.62], fr: [-0.32, 0, 0.66], hl: [0.62, 0, -0.35], hr: [-0.62, 0, -0.35] }, wing: 0, tilt: 0, sitting: true
    },
    curl: {
      spine: [[-1.25, 0.12, 1.55], [-1.6, 0.13, 0.95], [-1.75, 0.15, 0.25], [-1.6, 0.18, -0.45], [-1.1, 0.25, -1.0], [-0.35, 0.48, -1.15], [0.35, 0.55, -0.95], [0.9, 0.55, -0.45], [1.15, 0.52, 0.2], [1.05, 0.42, 0.8], [0.7, 0.33, 1.25], [0.25, 0.3, 1.5]],
      head: [-0.95, -0.12, 0.3], feet: { fl: [1.5, 0, 0.4], fr: [0.85, 0, 0.6], hl: [0.25, 0, -1.55], hr: [-0.35, 0, -0.35] }, wing: 0, tilt: 0, low: true
    },
    fly: {
      spine: [[0.6, -0.55, -5.0], [0.45, -0.42, -4.35], [0.25, -0.25, -3.65], [0.08, -0.08, -2.95], [0, 0.02, -2.25], [0, 0.05, -1.5], [0, 0.07, -0.75], [0, 0.08, 0.0], [0, 0.1, 0.65], [0, 0.25, 1.25], [0, 0.42, 1.75], [0, 0.52, 2.1]],
      head: [0, -0.12, 1], feet: { fl: [0.34, -0.42, -0.02], fr: [-0.34, -0.4, 0.04], hl: [0.4, -0.3, -2.35], hr: [-0.4, -0.28, -2.4] }, wing: 1, tilt: 0, air: true
    },
    glide: {
      spine: [[-0.4, -0.2, -5.0], [-0.3, -0.15, -4.35], [-0.18, -0.08, -3.65], [-0.06, 0.0, -2.95], [0, 0.04, -2.25], [0, 0.05, -1.5], [0, 0.06, -0.75], [0, 0.07, 0.0], [0, 0.1, 0.65], [0, 0.2, 1.25], [0, 0.3, 1.78], [0, 0.35, 2.12]],
      head: [0.1, -0.2, 1], feet: { fl: [0.34, -0.42, -0.02], fr: [-0.34, -0.4, 0.04], hl: [0.4, -0.3, -2.35], hr: [-0.4, -0.28, -2.4] }, wing: 0.92, tilt: 0, air: true, glide: true
    },
    perch: {
      spine: [[-0.4, 0.95, -4.6], [-0.55, 0.5, -4.15], [-0.6, 0.18, -3.55], [-0.45, 0.12, -2.9], [-0.18, 0.38, -2.25], [0, 0.82, -1.55], [0, 0.98, -0.85], [0, 1.0, -0.15], [0, 1.02, 0.48], [0, 1.2, 1.05], [0, 1.36, 1.48], [0, 1.4, 1.82]],
      head: [0.18, -0.55, 1], feet: { fl: [0.34, 0, 0.75], fr: [-0.34, 0, 0.7], hl: [0.42, 0, -1.4], hr: [-0.42, 0, -1.45] }, wing: 0.55, tilt: 0
    },
    roar: {
      spine: [[-1.6, 0.1, -4.8], [-1.4, 0.11, -4.15], [-0.95, 0.17, -3.5], [-0.45, 0.33, -2.9], [-0.12, 0.62, -2.3], [0, 0.98, -1.6], [0, 1.1, -0.85], [0, 1.2, -0.15], [0, 1.4, 0.45], [0, 1.85, 0.85], [0, 2.3, 1.02], [0, 2.6, 1.12]],
      head: [0, 0.38, 1], feet: { fl: [0.46, 0, 0.75], fr: [-0.46, 0, 0.5], hl: [0.5, 0, -1.25], hr: [-0.5, 0, -1.75] }, wing: 0.82, tilt: 0, jaw: 0.5
    }
  };
  KIT.dragonPoses = POSES;

  // ------------------------------------------------------------------ geometry helpers
  // rotation-minimising frames along a list of points: tangent T, up N, side S (+x when T = +z, N = +y)
  function frames(P, up0) {
    var n = P.length, Tn = [], N = [], S = [], i;
    for (i = 0; i < n; i++) { var a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)]; Tn.push(b.clone().sub(a).normalize()); }
    var u = (up0 || V(0, 1, 0)).clone(); u.sub(Tn[0].clone().multiplyScalar(u.dot(Tn[0]))); if (u.lengthSq() < 1e-6) u = V(0, 0, 1); N.push(u.normalize());
    for (i = 1; i < n; i++) {
      var q = new T.Quaternion().setFromUnitVectors(Tn[i - 1], Tn[i]), nn = N[i - 1].clone().applyQuaternion(q);
      nn.sub(Tn[i].clone().multiplyScalar(nn.dot(Tn[i]))).normalize(); N.push(nn);
    }
    for (i = 0; i < n; i++) S.push(N[i].clone().cross(Tn[i]).normalize());
    return { T: Tn, N: N, S: S };
  }
  // frames that keep 'up' as close to the world's up as the curve allows (a back stays a back), falling back on the
  // transported frame where the curve runs near vertical
  function framesUp(P, up) {
    var F = frames(P, up), n = P.length;
    up = up || V(0, 1, 0);
    for (var i = 0; i < n; i++) {
      var t = F.T[i], u = up.clone().sub(t.clone().multiplyScalar(up.dot(t))), L = u.length();
      if (L > 0.35) { F.N[i] = u.multiplyScalar(1 / L); }
      else if (i > 0) { var q = new T.Quaternion().setFromUnitVectors(F.T[i - 1], t); var nn = F.N[i - 1].clone().applyQuaternion(q); nn.sub(t.clone().multiplyScalar(nn.dot(t))).normalize(); F.N[i] = nn; }
      F.S[i] = F.N[i].clone().cross(t).normalize();
    }
    return F;
  }
  // A skinned tube: rings at points P, each ring an oval (rx, ry) with a flatter underside, a superellipse exponent,
  // and an optional ridge on top. prof(i) -> { rx, ry, belly, ex, ridge }. col(i, th) -> linear colour.
  // Ends are closed with a little rounded cap.
  function tubeGeo(P, F, prof, seg, col, o) {
    o = o || {};
    var n = P.length, pos = [], cols = [], idx = [], i, j;
    function ring(i, k) {
      var pr = prof(i), Pc = P[i];
      for (j = 0; j < seg; j++) {
        var th = j / seg * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
        var e = 2 / (pr.ex || 2), cx = Math.sign(c) * Math.pow(Math.abs(c), e), sy = Math.sign(s) * Math.pow(Math.abs(s), e);
        var x = cx * pr.rx * k, y = sy * pr.ry * k * (s < 0 ? (pr.belly || 1) : 1) + (pr.ridge || 0) * Math.pow(Math.max(0, s), 14) * k;
        var p = Pc.clone().addScaledVector(F.S[i], x).addScaledVector(F.N[i], y);
        pos.push(p.x, p.y, p.z);
        var cc = col(i, th); cols.push(cc.r, cc.g, cc.b);
      }
    }
    for (i = 0; i < n; i++) ring(i, 1);
    for (i = 0; i < n - 1; i++) for (j = 0; j < seg; j++) {
      var a = i * seg + j, b = i * seg + (j + 1) % seg, c2 = (i + 1) * seg + j, d = (i + 1) * seg + (j + 1) % seg;
      idx.push(a, c2, b, b, c2, d);
    }
    // caps: a ring pulled in, then a point
    [[0, -1], [n - 1, 1]].forEach(function (e) {
      if (o.open && o.open[e[0] ? 1 : 0]) return;
      var i0 = e[0], sgn = e[1], pr = prof(i0), base = pos.length / 3, Pc = P[i0], Tn = F.T[i0];
      var rr = Math.min(pr.rx, pr.ry), ctr = Pc.clone().addScaledVector(Tn, sgn * rr * 0.55);
      for (j = 0; j < seg; j++) {
        var th = j / seg * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
        var p = Pc.clone().addScaledVector(Tn, sgn * rr * 0.38).addScaledVector(F.S[i0], c * pr.rx * 0.72).addScaledVector(F.N[i0], s * pr.ry * 0.72 * (s < 0 ? (pr.belly || 1) : 1));
        pos.push(p.x, p.y, p.z); var cc = col(i0, th); cols.push(cc.r, cc.g, cc.b);
      }
      pos.push(ctr.x, ctr.y, ctr.z); var c0 = col(i0, Math.PI / 2); cols.push(c0.r, c0.g, c0.b);
      var tip = base + seg;
      for (j = 0; j < seg; j++) {
        var r0 = i0 * seg + j, r1 = i0 * seg + (j + 1) % seg, m0 = base + j, m1 = base + (j + 1) % seg;
        if (sgn < 0) { idx.push(r0, r1, m0, r1, m1, m0, m0, m1, tip); } else { idx.push(r0, m0, r1, r1, m0, m1, m0, tip, m1); }
      }
    });
    // the rings run counter-clockwise seen from the head, so turn every triangle round to face outward
    for (i = 0; i < idx.length; i += 3) { var sw = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = sw; }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // sample a smooth curve through keys, with values riding along: keys [[x,y,z], ...], vals [[...], ...]
  function sampleSpine(keys, vals, per) {
    var cv = new T.CatmullRomCurve3(keys.map(A), false, 'centripetal'), n = (keys.length - 1) * per + 1, P = [], R = [], i;
    for (i = 0; i < n; i++) {
      var t = i / (n - 1); P.push(cv.getPoint(t));
      var f = t * (vals.length - 1), k = Math.min(vals.length - 2, Math.floor(f)), u = f - k, w = sm(u);
      // a smooth blend of neighbouring radii (Catmull-like through the keys)
      var a = vals[Math.max(0, k - 1)], b = vals[k], c = vals[k + 1], d = vals[Math.min(vals.length - 1, k + 2)];
      R.push(b.map(function (v, q) { var p0 = a[q], p1 = b[q], p2 = c[q], p3 = d[q]; var u2 = u * u, u3 = u2 * u; return Math.max(0.01, 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3)); }));
    }
    return { P: P, R: R, curve: cv };
  }
  // a flat leaf or fin outline in its own plane, from base (0,0) along +x to the tip at (len, 0), w wide
  function finShape(len, w, kind) {
    var pts = [], n = 10, i;
    for (i = 0; i <= n; i++) { var t = i / n; pts.push([t * len, Math.pow(Math.sin(Math.PI * Math.pow(t, kind === 'blade' ? 0.7 : 0.8)), kind === 'ear' ? 0.9 : 1.1) * w * (kind === 'spike' ? (1 - t) : 1)]); }
    for (i = n - 1; i >= 1; i--) { var t2 = i / n; pts.push([t2 * len, -Math.pow(Math.sin(Math.PI * Math.pow(t2, 0.8)), 1.3) * w * 0.25 * (kind === 'fluke' ? 2.6 : 1)]); }
    return pts;
  }
  // a geometry made in a local frame (x along dir, y along normal-ish up, z = x cross y) then placed at origin
  function placed(g, origin, xAxis, yAxis) {
    var X = xAxis.clone().normalize(), Z = X.clone().cross(yAxis).normalize(), Y = Z.clone().cross(X).normalize();
    var m = new T.Matrix4().makeBasis(X, Y, Z).setPosition(origin);
    g.applyMatrix4(m); return g;
  }
  function solidCol(g, c) {
    var n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new T.BufferAttribute(a, 3)); return g;
  }
  // lay a point onto the body's skin: find the nearest ring and set the point's distance from the spine to m times the
  // ring's (super)ellipse, by weight w; points well clear of the body (beyond 'reach') are left alone
  function wrapTo(p, P, F, R, m, w, ex, belly, reach) {
    if (w <= 0) return p;
    var best = 0, bd = 1e9, i;
    for (i = 0; i < P.length; i++) { var dd = p.distanceToSquared(P[i]); if (dd < bd) { bd = dd; best = i; } }
    i = best;
    var d = p.clone().sub(P[i]), t = d.dot(F.T[i]), x = d.dot(F.S[i]), y = d.dot(F.N[i]);
    var rx = R[i][0], ry = R[i][1] * (y < 0 ? belly : 1);
    var rho = Math.pow(Math.pow(Math.abs(x) / rx, ex) + Math.pow(Math.abs(y) / ry, ex), 1 / ex);
    if (rho > (reach || 1.8)) return p;
    if (rho < 1e-3) { x = rx * 1e-3; rho = 1e-3; }
    var fall = 1 - sm((rho - 1.3) / ((reach || 1.8) - 1.3)), k = 1 + (m / rho - 1) * w * fall;
    return P[i].clone().addScaledVector(F.T[i], t).addScaledVector(F.S[i], x * k).addScaledVector(F.N[i], y * k);
  }
  // two-bone IK: joint for a limb from S to H with bones a, b, bending toward pole
  function ik(S, H, a, b, pole) {
    var d = H.clone().sub(S), L = d.length(), maxL = (a + b) * 0.999;
    if (L > maxL) { d.setLength(maxL); H = S.clone().add(d); L = maxL; }
    var dir = d.clone().normalize(), x = (a * a - b * b + L * L) / (2 * L), h = Math.sqrt(Math.max(0, a * a - x * x));
    var p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))); if (p.lengthSq() < 1e-6) p = V(0, 0, 1); p.normalize();
    return { J: S.clone().addScaledVector(dir, x).addScaledVector(p, h), H: H };
  }

  // the rider's pose, astride; made out here so the pose list never holds on to a build that drew one
  function dragonride(rr) { return { feet: [V(-0.3, 0.52, 0.12), V(0.3, 0.52, 0.12)], hands: [V(-0.14, 1.06, 0.42), V(0.14, 1.06, 0.42)], lean: 0.3, twist: 0, side: 0, hip: 0, drop: 0, head: [rr(0.2), -0.12], pole: [V(-0.6, -0.4, -0.4), V(0.6, -0.4, -0.4)] }; }

  // ------------------------------------------------------------------ the dragon
  // o: { kind, pose, ry, s, age ('adult' | 'young' | 'hatchling'), saddle, rider (figure opts), tilt, wing (0..1 override),
  //      look ([x,y,z] world point the head turns toward), fire, name }
  B.dragon = function (x, y, z, o) {
    o = o || {};
    var K = KINDS[o.kind || 'night'], P0 = POSES[o.pose || 'stand'] || POSES.stand, self = this;
    var age = o.age || 'adult', young = age === 'hatchling' ? 1 : age === 'young' ? 0.5 : 0;
    var s = (o.s || 1) * (age === 'hatchling' ? 0.34 : age === 'young' ? 0.62 : 1) * (K.len < 0.7 ? 1.05 : 1);
    var headK = 1 + young * 0.55, tailK = 1 - young * 0.25, wingK = (o.wingScale || 1) * (1 - young * 0.42);
    var cBody = lin(K.col), cBody2 = lin(K.col2), cBelly = lin(K.belly), cMem = lin(K.mem), cBone = lin(K.bone);
    var rnd = U.rng(o.seed || 7);
    this.life(function () {
      self.push(x, y, z, o.ry || 0, s);
      if (o.roll || o.pitch) self.stack[self.stack.length - 1].multiply(new T.Matrix4().makeRotationFromEuler(new T.Euler(o.pitch || 0, 0, o.roll || 0, 'YXZ')));
      build();
      self.pop();
    });

    function build() {
      // ---- the spine
      var lenK = K.len, keys = P0.spine.map(function (p, i) {
        var q = p.slice();
        // proportions: the tail and neck stretch with the kind's length; a stout kind is shorter in the tail
        var zK = i <= 4 ? lenK * tailK : i >= 9 ? (K.stout ? 0.72 : 1) * (1 + young * 0.1) : 1;
        if (i <= 4) { var hip = P0.spine[5]; q = [hip[0] + (p[0] - hip[0]) * zK, hip[1] + (p[1] - hip[1]) * (K.stout ? 0.7 : 1), hip[2] + (p[2] - hip[2]) * zK]; }
        if (i >= 9) { var sh = P0.spine[8]; q = [sh[0] + (p[0] - sh[0]) * zK, sh[1] + (p[1] - sh[1]) * zK, sh[2] + (p[2] - sh[2]) * zK]; }
        if (K.stout) { if (i >= 5 && i <= 8) q[1] = q[1] * 0.92 + (P0.air ? 0 : 0.05); }
        if (young && !P0.air) q[1] *= 1 - young * 0.12;
        return q;
      });
      var slim = K.slim || 1, rad = K.rad.map(function (r, i) { return [r[0] * (i >= 5 && i <= 8 ? slim : 1), r[1] * (i >= 5 && i <= 8 ? (1 + (slim - 1) * 0.6) : 1)]; });
      if (young) rad = rad.map(function (r, i) { return i >= 9 ? [r[0] * 1.15, r[1] * 1.15] : r; });
      var SP = sampleSpine(keys, rad, 9), P = SP.P, n = P.length, F = framesUp(P, V(0, 1, 0));
      // a frame whose up follows the world when the spine is level, so the back stays up
      var H = { hip: Math.round(5 / 11 * (n - 1)), sh: Math.round(8 / 11 * (n - 1)), neck: Math.round(9 / 11 * (n - 1)) };
      var bellyCol = K.bellyCol, spots = K.spots;
      function bodyCol(i, th) {
        var s = Math.sin(th), c = mixC(cBody, cBody2, 0.5 + 0.5 * Math.sin(i * 0.9 + th * 3.0) * 0.4);
        if (s < -0.25) c = mixC(c, cBelly, sm((-s - 0.25) / 0.5) * (bellyCol ? 1 : 0.7));
        if (spots && s > 0.1) { var k = Math.sin(i * 1.7 + 3.1 * Math.cos(th * 2.0)) * Math.sin(th * 5 + i * 0.6); if (k > 0.55) c = mixC(c, lin('#2a2927'), 0.85); }
        return c;
      }
      var bodyG = tubeGeo(P, F, function (i) { return { rx: SP.R[i][0], ry: SP.R[i][1], belly: K.belly0, ex: K.ex, ridge: i > H.neck ? 0 : 0.025 }; }, 18, bodyCol);
      self.addGeo(bodyG, { c: '#ffffff', jit: 0, m: SCALE, ao: 0.42, vary: 0.05 });

      // ---- spines / fins down the back
      dorsal(P, F, SP.R, H);
      if (K.bumps) bumps(P, F, SP.R, H);

      // ---- tail tip
      tailTip(P, F, SP.R);

      // ---- legs
      var legs = K.legs === 2 ? ['hl', 'hr'] : ['fl', 'fr', 'hl', 'hr'];
      legs.forEach(function (lg) { leg(lg, P, F, SP.R, H); });

      // ---- wings
      [1, -1].forEach(function (sd) { wing(sd, P, F, SP.R, H); });

      // ---- head
      head(P, F, SP.R, n);

      // ---- saddle and rider
      if (o.saddle || o.rider) saddle(P, F, SP.R, H);
      if (o.fire) fireBreath();
    }

    // dorsal decoration: small back-swept fins (night), big spikes (ember), knobs (boulder), tail spikes (crest)
    function dorsal(P, F, R, H) {
      var kind = K.spines; if (kind === 'none') return;
      var from = kind === 'tailspikes' ? 4 : 2, to = kind === 'tailspikes' ? Math.round(H.hip * 0.75) : (kind === 'knobs' ? H.neck + 4 : H.neck + 6);
      var step = kind === 'big' ? 5 : kind === 'knobs' ? 4 : 4;
      for (var i = from; i < Math.min(P.length - 3, to); i += step) {
        var r = R[i], top = P[i].clone().addScaledVector(F.N[i], r[1] * (kind === 'knobs' ? 0.92 : 0.96));
        var big = kind === 'big' ? 0.18 + 0.32 * sm(1 - Math.abs(i - H.sh * 0.8) / (P.length * 0.5)) : kind === 'fins' ? 0.07 + 0.08 * sm(i / H.hip) * (1 - sm((i - H.sh) / 6)) : 0.14;
        if (kind === 'knobs') { var gk = new T.IcosahedronGeometry(0.11 + rnd() * 0.07, 0); gk.translate(top.x, top.y, top.z); self.addGeo(solidCol(gk.ni(), mixC(cBody2, cBelly, 0.4)), { c: '#ffffff', jit: 0, m: M.rock, ao: 0.1 }); continue; }
        var len = big * (kind === 'tailspikes' ? 1.4 : 1.6), wid = big * (kind === 'fins' ? 0.55 : 0.5);
        var gs = new T.ExtrudeGeometry(new T.Shape(finShape(len, wid, kind === 'fins' ? 'blade' : 'spike').map(function (p) { return new T.Vector2(p[0], p[1]); })), { depth: kind === 'fins' ? 0.018 : 0.04, bevelEnabled: false });
        gs.translate(0, 0, kind === 'fins' ? -0.009 : -0.02); gs.deleteAttribute('uv');
        // the fin leans back along the tail: x axis of the fin = up and back
        var dir = F.N[i].clone().multiplyScalar(kind === 'tailspikes' ? 0.8 : 0.55).addScaledVector(F.T[i], -1);
        var gp = placed(gs.ni(), top, dir, F.N[i].clone().multiplyScalar(-1).addScaledVector(F.T[i], -0.5));
        gp.computeVertexNormals();
        if (kind === 'tailspikes') {
          [1, -1].forEach(function (sd) {
            var gq = new T.ExtrudeGeometry(new T.Shape(finShape(len * 0.9, wid * 0.7, 'spike').map(function (p) { return new T.Vector2(p[0], p[1]); })), { depth: 0.04, bevelEnabled: false }); gq.deleteAttribute('uv');
            var side = P[i].clone().addScaledVector(F.S[i], sd * R[i][0] * 0.85).addScaledVector(F.N[i], R[i][1] * 0.3);
            var d2 = F.S[i].clone().multiplyScalar(sd * 0.9).addScaledVector(F.T[i], -0.6).addScaledVector(F.N[i], 0.3);
            var g2 = placed(gq.ni(), side, d2, F.N[i]); g2.computeVertexNormals();
            self.addGeo(solidCol(g2, cBone), { c: '#ffffff', jit: 0, m: SCALE, ao: 0.1 });
          });
        }
        self.addGeo(solidCol(gp, kind === 'big' ? mixC(cBody, lin('#000000'), 0.2) : cBone), { c: '#ffffff', jit: 0, m: SCALE, ao: 0.1 });
      }
    }
    // the boulder dragon's hide: lumps of rock all over its back
    function bumps(P, F, R, H) {
      for (var i = 4; i < P.length - 4; i += 2) for (var k = 0; k < 4; k++) {
        var th = 0.15 * Math.PI + rnd() * 0.7 * Math.PI, r = R[i], c = Math.cos(th), s = Math.sin(th);
        var p = P[i].clone().addScaledVector(F.S[i], c * r[0] * 0.97).addScaledVector(F.N[i], s * r[1] * 0.97);
        var g = new T.IcosahedronGeometry(0.06 + rnd() * 0.09 * (r[0] / 0.6), 0); g.scale(1, 0.6, 1);
        var nrm = F.S[i].clone().multiplyScalar(c).addScaledVector(F.N[i], s).normalize();
        g = placed(g.ni(), p, F.T[i], nrm); g.computeVertexNormals();
        self.addGeo(solidCol(g, mixC(cBody2, cBelly, rnd() * 0.6)), { c: '#ffffff', jit: 0, m: M.rock, ao: 0.15 });
      }
    }
    // the tail's end: twin fins (night, dawn), a club (boulder), a crown of spikes (ember, crest)
    function tailTip(P, F, R) {
      var kind = K.tailFins;
      if (kind === 'club') {
        var c = P[1].clone(), g = new T.IcosahedronGeometry(0.3, 1); g.scale(1, 0.85, 1.25); g.translate(c.x, c.y, c.z);
        self.addGeo(solidCol(g.ni(), cBody2), { c: '#ffffff', jit: 0, m: M.rock, ao: 0.2 });
        for (var q = 0; q < 9; q++) { var a = q / 9 * Math.PI * 2, gg = new T.ConeGeometry(0.07, 0.22, 5); var d = V(Math.cos(a), Math.sin(a) * 0.85, (rnd() - 0.5) * 0.6).normalize(); gg.translate(0, 0.11, 0); gg = placed(gg.ni(), c.clone().addScaledVector(d, 0.26), d.clone().cross(V(0, 0, 1)).lengthSq() > 0.01 ? d.clone().cross(V(0, 0, 1)) : V(1, 0, 0), d); gg.computeVertexNormals(); self.addGeo(solidCol(gg, cBone), { c: '#ffffff', jit: 0, m: M.rock, ao: 0.1 }); }
        return;
      }
      if (kind === 'spikes') {
        for (var j = 0; j < 7; j++) {
          var i = 2 + (j % 3), sd = j % 2 ? 1 : -1, a2 = (j / 7) * Math.PI * 2;
          var base = P[i].clone().addScaledVector(F.S[i], Math.cos(a2) * R[i][0]).addScaledVector(F.N[i], Math.sin(a2) * R[i][1]);
          var dd = F.S[i].clone().multiplyScalar(Math.cos(a2) * 0.8).addScaledVector(F.N[i], Math.sin(a2) * 0.8).addScaledVector(F.T[i], -0.7).normalize();
          var gc = new T.ConeGeometry(0.045, 0.5 + rnd() * 0.25, 5); gc.translate(0, 0.28, 0);
          gc = placed(gc.ni(), base, F.T[i], dd); gc.computeVertexNormals();
          self.addGeo(solidCol(gc, K.kind === 'ember' ? lin('#d9d2c4') : cBone), { c: '#ffffff', jit: 0, m: SCALE, ao: 0.1 });
        }
        return;
      }
      // twin fins: a big pair at the tip, a small pair a little up the tail; on the night dragon one tip fin is
      // the rider-made replacement in the Hub's orange, held on with iron rods
      [[3, 1.0], [Math.round(P.length * 0.17), 0.55]].forEach(function (fp, pairIdx) {
        var i = fp[0], k = fp[1] * (kind === 'dawn' ? 1.15 : 1);
        [1, -1].forEach(function (sd) {
          var len = 0.62 * k, wid = 0.36 * k;
          var pts = [[0, 0], [len * 0.25, wid * 0.55], [len * 0.62, wid * 0.92], [len * 0.92, wid * 0.7], [len, wid * 0.25], [len * 0.82, -wid * 0.08], [len * 0.55, -wid * 0.04], [len * 0.3, -wid * 0.14], [len * 0.08, -wid * 0.05]];
          var sh = new T.Shape(pts.map(function (p) { return new T.Vector2(p[0], p[1]); }));
          var g = new T.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: false }); g.translate(0, 0, -0.011); g.deleteAttribute('uv');
          var root = P[i].clone().addScaledVector(F.S[i], sd * R[i][0] * 0.8);
          var dir = F.S[i].clone().multiplyScalar(sd * 0.75).addScaledVector(F.T[i], -0.62).addScaledVector(F.N[i], 0.05);
          // the fin's width runs back along the tail
          var yv = F.T[i].clone().multiplyScalar(-sd).addScaledVector(F.S[i], 0.0);
          var gp = placed(g.ni(), root, dir, sd > 0 ? F.T[i].clone().multiplyScalar(-1) : F.T[i].clone());
          gp.computeVertexNormals();
          var made = K.prosthetic && pairIdx === 0 && sd > 0 && young < 0.5;
          self.addGeo(solidCol(gp, made ? lin('#f26a1b') : cMem), { c: '#ffffff', jit: 0, m: made ? M.cloth : SCALE, ao: 0.05, vary: 0.03 });
          if (made) {
            // the iron frame of the made fin, and its white mark
            var tipW = root.clone().addScaledVector(dir.clone().normalize(), len * 0.92);
            self.beam(root.toArray(), tipW.toArray(), 0.014, { c: '#2b2b2c', m: M.metal, round: true });
            var mid = root.clone().addScaledVector(dir.clone().normalize(), len * 0.5);
            var back = mid.clone().addScaledVector(F.T[i], -wid * 0.75);
            self.beam(mid.toArray(), back.toArray(), 0.012, { c: '#2b2b2c', m: M.metal, round: true });
            self.box(root.x, root.y - 0.03, root.z, 0.12, 0.07, 0.14, { c: '#2b2b2c', m: M.metal, bevel: 0.015 });
          }
        });
      });
    }
    // a leg: root on the body's side, two-bone IK to the ankle, a foot with toes and claws
    function leg(lg, P, F, R, H) {
      var front = lg[0] === 'f', sd = lg[1] === 'l' ? 1 : -1, i = front ? H.sh - 1 : H.hip + 1;
      var r = R[i], stout = K.stout ? 1.35 : 1, two = K.legs === 2;
      var root = P[i].clone().addScaledVector(F.S[i], sd * r[0] * 0.62).addScaledVector(F.N[i], -r[1] * 0.25);
      var ft = P0.feet[lg].slice(); ft[0] = ft[0] * (K.stout ? 1.5 : 1) * (K.slim ? 0.95 : 1);
      if (K.len !== 1 && !P0.air) ft[2] = ft[2] * (front ? 1 : (K.stout ? 0.6 : 1));
      if (two) { ft[2] = (P0.spine[5][2] + 0.1); ft[0] = sd * 0.45; }
      var foot = A(ft); if (o.pose === 'curl' && !front) foot.y = 0;
      if (young && !P0.air) { foot.x *= 1; }
      var legLen = (front ? 0.86 : 1.02) * (K.stout ? 0.62 : 1) * (two ? 1.35 : 1) * (1 + young * 0.15);
      var ankle = foot.clone().add(V(0, front ? 0.12 : 0.18, front ? -0.04 : -0.1).multiplyScalar(K.stout ? 0.8 : 1));
      var a = legLen * 0.52, b = legLen * 0.5;
      var pole = front ? V(sd * 0.15, -0.1, -1) : V(sd * 0.1, 0, 1);
      if (P0.air) pole = front ? V(0, -0.3, -1) : V(0, -0.4, 1);
      var k = ik(root, ankle, a, b, pole), knee = k.J, ank = k.H;
      if (P0.air) { foot = ank.clone().add(V(0, -0.04, front ? 0.12 : -0.18)); }
      var lp = [root, root.clone().lerp(knee, 0.5), knee, knee.clone().lerp(ank, 0.5), ank, foot.clone().add(V(0, 0.03, 0))];
      var radii = [[0.33 * stout, 0.38 * stout], [0.24 * stout, 0.26 * stout], [0.14 * stout, 0.15 * stout], [0.11 * stout, 0.11 * stout], [0.095 * stout, 0.095 * stout], [0.11 * stout, 0.075 * stout]];
      if (!front) radii = [[0.36 * stout, 0.44 * stout], [0.27 * stout, 0.3 * stout], [0.15 * stout, 0.16 * stout], [0.11 * stout, 0.11 * stout], [0.09 * stout, 0.09 * stout], [0.11 * stout, 0.075 * stout]];
      if (two) radii = radii.map(function (q) { return [q[0] * 1.2, q[1] * 1.2]; });
      var g = sampleSpine(lp.map(function (p) { return [p.x, p.y, p.z]; }), radii, 4), Fl = frames(g.P, V(0, 0, 1));
      self.addGeo(tubeGeo(g.P, Fl, function (q) { return { rx: g.R[q][0], ry: g.R[q][1], ex: 2.1 }; }, 10, function (q, th) { return mixC(cBody, cBody2, 0.3); }), { c: '#ffffff', jit: 0, m: SCALE, ao: 0.4, vary: 0.04 });
      // toes: three forward and a dewclaw, each tipped with a claw
      var fwd = V(0, 0, 1);
      if (P0.air) fwd = V(0, -0.5, front ? 0.6 : -1).normalize();
      for (var t = 0; t < (K.stout ? 3 : 4); t++) {
        var aT = (t - 1.5) * 0.38, dir = V(Math.sin(aT) * 0.9 + sd * 0.05, 0, Math.cos(aT)).applyQuaternion(new T.Quaternion().setFromUnitVectors(V(0, 0, 1), fwd));
        if (t === 3) dir = V(sd * 0.6, 0.1, -0.8).normalize();
        var tl = (t === 3 ? 0.1 : 0.2) * stout * (two ? 1.3 : 1), base = foot.clone().addScaledVector(dir, 0.04).add(V(0, 0.05, 0));
        var tip = base.clone().addScaledVector(dir, tl).add(V(0, -0.03, 0));
        self.beam(base.toArray(), tip.toArray(), 0.045 * stout, { r2: 0.032 * stout, round: true, seg: 6, c: K.col, m: SCALE });
        var cg = new T.ConeGeometry(0.026 * stout, 0.09 * stout, 5); cg.translate(0, 0.045 * stout, 0);
        var cd = dir.clone().add(V(0, -0.6, 0)).normalize();
        cg = placed(cg.ni(), tip, cd.clone().cross(V(0, 1, 0)).lengthSq() > 1e-3 ? cd.clone().cross(V(0, 1, 0)) : V(1, 0, 0), cd); cg.computeVertexNormals();
        self.addGeo(solidCol(cg, lin(K.claw)), { c: '#ffffff', jit: 0, m: M.paint, ao: 0 });
      }
    }
    // a bat wing: arm bones from the shoulder to the wrist, fingers fanning from the wrist, membrane between them.
    // Folded, the wing lies along the flank like a cloak: every point of it is laid onto the skin.
    function wing(sd, P, F, R, H) {
      var W = K.wings, span = W.span * wingK, k = o.wing === undefined ? P0.wing : o.wing;
      var i = H.sh - 2, r = R[i];
      var root = P[i].clone().addScaledVector(F.S[i], sd * r[0] * 0.55).addScaledVector(F.N[i], r[1] * 0.72);
      var hipI = Math.max(2, H.hip - 3), hipP = P[hipI].clone().addScaledVector(F.S[hipI], sd * R[hipI][0] * 0.8).addScaledVector(F.N[hipI], R[hipI][1] * 0.3);
      // the wing's frame: out (side), up, back, taken from the body there
      var out = F.S[i].clone().multiplyScalar(sd), upv = F.N[i].clone(), back = F.T[i].clone().multiplyScalar(-1);
      function L(o3) { return out.clone().multiplyScalar(o3[0]).addScaledVector(upv, o3[1]).addScaledVector(back, o3[2]); }
      // folded and spread shapes, blended by k (the glide holds the wings a little swept)
      var elbowF = [0.3, 0.05, 0.5], elbowS = [1.15, 0.3, 0.1];
      var wristF = [0.34, 0.16, -0.26], wristS = [2.55, 0.42, -0.32];
      var dihed = P0.glide ? 0.18 : 0.32;
      var fingF = [[0.05, -0.06, 1], [0.05, -0.26, 1], [0.05, -0.46, 1], [0.04, -0.68, 1]];
      var fingS = [[0.96, dihed * 0.6, -0.28], [0.72, dihed * 0.5, 0.7], [0.4, dihed * 0.3, 1], [0.1, 0.05, 1]];
      var flen = [1.9, 2.05, 1.85, 1.45];
      if (W.fingers === 3) { fingF = fingF.slice(0, 3); fingS = [[0.95, 0.1, -0.1], [0.55, 0.05, 0.85], [0.12, 0, 1]]; flen = [1.2, 1.25, 1.0]; }
      var kk = sm(k), wk = 1 - sm(k * 2.2), ex = K.ex, bl = K.belly0;
      function skin(p, m) { return wrapTo(p, P, F, R, m, wk, ex, bl, 2.0); }
      var elbow = root.clone().add(L(lerp3(elbowF, elbowS, kk)).multiplyScalar(span)), wrist = elbow.clone().add(L(lerp3(sub3(wristF, elbowF), sub3(wristS, elbowS), kk)).multiplyScalar(span));
      var tips = fingF.map(function (f, q) { var d = L(lerp3(f, fingS[q], kk)).normalize(); return wrist.clone().addScaledVector(d, flen[q] * span * (0.62 + 0.38 * kk) * (W.fingers === 3 ? 0.8 : 1)); });
      // flapping: the fly holds the tips a little up
      if (P0.air && !P0.glide) tips = tips.map(function (t, q) { return t.add(upv.clone().multiplyScalar(0.35 * span * (q + 1) / tips.length)); });
      elbow = skin(elbow, 1.12); wrist = skin(wrist, 1.16); tips = tips.map(function (t) { return skin(t, 1.08); });
      // bones
      var br = 0.085 * Math.sqrt(span) * (K.stout ? 1.3 : 1);
      self.beam(root.toArray(), elbow.toArray(), br, { r2: br * 0.8, round: true, seg: 8, c: K.col, m: SCALE });
      self.beam(elbow.toArray(), wrist.toArray(), br * 0.8, { r2: br * 0.62, round: true, seg: 8, c: K.col, m: SCALE });
      self.ball(elbow.x, elbow.y, elbow.z, br * 0.95, { c: K.col, m: SCALE, smooth: true, detail: 1 });
      self.ball(wrist.x, wrist.y, wrist.z, br * 0.75, { c: K.col, m: SCALE, smooth: true, detail: 1 });
      // fingers: laid in a few pieces so a folded one follows the curve of the flank
      tips.forEach(function (t) {
        var seg = [], q;
        for (q = 0; q <= 5; q++) seg.push(skin(wrist.clone().lerp(t, q / 5), 1.1));
        for (q = 0; q < 5; q++) self.beam(seg[q].toArray(), seg[q + 1].toArray(), br * (0.44 - q * 0.05), { r2: br * (0.44 - (q + 1) * 0.05), round: true, seg: 6, c: K.bone, m: SCALE });
      });
      // a thumb claw at the wrist
      var cg = new T.ConeGeometry(br * 0.38, br * 1.4, 5); cg.translate(0, br * 0.7, 0);
      var cdir = L([0.1, 0.5, -0.9]).normalize(); cg = placed(cg.ni(), wrist.clone().addScaledVector(cdir, br * 0.5), out, cdir); cg.computeVertexNormals();
      self.addGeo(solidCol(cg, lin(K.claw)), { c: '#ffffff', jit: 0, m: M.paint, ao: 0 });
      if (W.claws) tips.slice(0, 1).forEach(function (t) { var c2 = new T.ConeGeometry(br * 0.4, br * 2.2, 5); c2.translate(0, br * 1.1, 0); var dd = t.clone().sub(wrist).normalize(); c2 = placed(c2.ni(), t, out, dd); c2.computeVertexNormals(); self.addGeo(solidCol(c2, lin(K.claw)), { c: '#ffffff', jit: 0, m: M.paint, ao: 0 }); });
      // membrane: a fan from the wrist between each pair of fingers, the trailing edge scalloped toward the wrist;
      // then the inner panel from the last finger back to the body, the arm along its leading edge
      var pos = [], col = [];
      function tri(a, b, c, ca, cb, cc) { pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); [ca, cb, cc].forEach(function (q) { col.push(q.r, q.g, q.b); }); }
      var memIn = mixC(cMem, cBody, 0.35), memEdge = K.bellyCol ? lin('#c95a1f') : mixC(cMem, lin(K.col2), 0.3);
      function scallop(a, b, pull, n) {
        var mid = a.clone().add(b).multiplyScalar(0.5), ctrl = mid.clone().lerp(wrist, pull), out2 = [];
        for (var q = 0; q <= n; q++) { var t = q / n, p = a.clone().multiplyScalar((1 - t) * (1 - t)).addScaledVector(ctrl, 2 * (1 - t) * t).addScaledVector(b, t * t); out2.push(p); }
        return out2;
      }
      // a panel from a centre out to a ring of edge points, in rows, so it can sag between the bones and lie on the skin
      var FR = [0, 0.2, 0.4, 0.6, 0.8, 1];
      function fan(c0, ring, sagK, edgeAt) {
        var rows = FR.map(function (f) {
          return ring.map(function (e, q) {
            var p = c0.clone().lerp(e, f), w = Math.sin(Math.PI * q / Math.max(1, ring.length - 1));
            return p.addScaledVector(upv, -sagK * w * 4 * f * (1 - f));
          });
        });
        function cf(f, q) { var ce = edgeAt(q) ? memEdge : cMem; return f < 0.5 ? mixC(memIn, cMem, f * 2) : mixC(cMem, ce, (f - 0.5) * 2); }
        for (var y = 0; y < rows.length - 1; y++) for (var q = 0; q < ring.length - 1; q++) {
          var a1 = rows[y][q], b1 = rows[y][q + 1], c1 = rows[y + 1][q], d1 = rows[y + 1][q + 1];
          tri(a1, c1, d1, cf(FR[y], q), cf(FR[y + 1], q), cf(FR[y + 1], q + 1));
          if (y > 0) tri(a1, d1, b1, cf(FR[y], q), cf(FR[y + 1], q + 1), cf(FR[y], q + 1));
        }
      }
      for (var q = 0; q < tips.length - 1; q++) fan(wrist, scallop(tips[q], tips[q + 1], 0.28 + 0.1 * (1 - kk), 8), 0.06 * span * kk, function () { return true; });
      // inner panel: wrist, last tip, scallop to the hip, then the body edge forward to the shoulder root and elbow
      var lastTip = tips[tips.length - 1], inner = scallop(lastTip, hipP, 0.2, 10), ctr = wrist.clone().add(elbow).add(root).add(hipP).add(lastTip).multiplyScalar(0.2);
      var ring2 = [wrist].concat(inner, [root, elbow, wrist]);
      fan(ctr, ring2, 0, function (e2) { return e2 > 0 && e2 < inner.length; });
      if (wk > 0) for (var v = 0; v < pos.length; v += 3) { var pv = skin(V(pos[v], pos[v + 1], pos[v + 2]), 1.06); pos[v] = pv.x; pos[v + 1] = pv.y; pos[v + 2] = pv.z; }
      var gm = new T.BufferGeometry(); gm.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); gm.setAttribute('color', new T.Float32BufferAttribute(col, 3)); gm.computeVertexNormals();
      self.addGeo(gm, { c: '#ffffff', jit: 0, m: SCALE, bucket: 'cloth', ao: 0.1, vary: 0.03 });
    }
    function f2(v) { return Math.round(v * 100) / 100; }
  function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }

    // ---- the head
    function head(P, F, R, n) {
      var base = P[n - 1], hk = headK * (K.stout ? 1.15 : 1);
      var fwd = A(P0.head).normalize();
      if (o.look) { var tgt = A(o.look); var lw = tgt.clone().sub(base); lw.y *= 0.5; if (lw.lengthSq() > 0.01) fwd = fwd.clone().lerp(lw.normalize(), 0.7).normalize(); }
      var upw = V(0, 1, 0).sub(fwd.clone().multiplyScalar(fwd.y)).normalize(), side = upw.clone().cross(fwd).normalize();
      var HP = {
        night: { L: 0.98, keys: [[0, 0.31, 0.31, 0], [0.12, 0.45, 0.37, 0.02], [0.3, 0.52, 0.37, 0.03], [0.5, 0.49, 0.31, 0.0], [0.7, 0.41, 0.25, -0.03], [0.86, 0.35, 0.2, -0.05], [0.96, 0.27, 0.14, -0.06], [1, 0.12, 0.07, -0.06]], ex: 2.7, belly: 0.8 },
        dawn: { L: 0.9, keys: [[0, 0.21, 0.21, 0], [0.14, 0.3, 0.26, 0.02], [0.32, 0.34, 0.27, 0.03], [0.52, 0.3, 0.22, 0.0], [0.72, 0.23, 0.17, -0.03], [0.88, 0.17, 0.13, -0.045], [1, 0.04, 0.04, -0.05]], ex: 2.3, belly: 0.84 },
        boulder: { L: 0.85, keys: [[0, 0.36, 0.34, 0], [0.18, 0.45, 0.4, 0.02], [0.4, 0.46, 0.38, 0.0], [0.62, 0.44, 0.34, -0.05], [0.82, 0.4, 0.3, -0.08], [0.94, 0.34, 0.24, -0.09], [1, 0.12, 0.1, -0.09]], ex: 2.8, belly: 1.0 },
        ember: { L: 1.15, keys: [[0, 0.2, 0.22, 0], [0.12, 0.28, 0.28, 0.03], [0.3, 0.3, 0.27, 0.04], [0.5, 0.25, 0.21, 0.0], [0.72, 0.18, 0.16, -0.03], [0.9, 0.13, 0.12, -0.04], [1, 0.04, 0.04, -0.05]], ex: 2.2, belly: 0.85 },
        crest: { L: 0.95, keys: [[0, 0.15, 0.16, 0], [0.12, 0.21, 0.22, 0.03], [0.3, 0.22, 0.22, 0.04], [0.5, 0.17, 0.16, 0.0], [0.72, 0.12, 0.11, -0.02], [0.9, 0.07, 0.07, -0.03], [1, 0.02, 0.02, -0.035]], ex: 2.0, belly: 0.9 }
      }[K.head];
      var L = HP.L * hk, keysP = HP.keys.map(function (k2) { var p = base.clone().addScaledVector(fwd, (k2[0] - 0.08) * L).addScaledVector(upw, k2[3] * hk); return [p.x, p.y, p.z]; });
      var radH = HP.keys.map(function (k2) { return [k2[1] * hk, k2[2] * hk]; });
      var SH = sampleSpine(keysP, radH, 5), Fh = framesUp(SH.P, upw);
      self.addGeo(tubeGeo(SH.P, Fh, function (q) { return { rx: SH.R[q][0], ry: SH.R[q][1], belly: HP.belly, ex: HP.ex, ridge: 0 }; }, 18, function (q, th) { var s = Math.sin(th); var c = mixC(cBody, cBody2, 0.4); if (s < -0.3) c = mixC(c, cBelly, sm((-s - 0.3) / 0.5) * (K.bellyCol ? 0.8 : 0.6)); return c; }), { c: '#ffffff', jit: 0, m: SCALE, ao: 0.3, vary: 0.04 });
      function at(u, sx, sy, sz) { // a point on the head: u along, sx across (fraction of half width), sy up (fraction of half height)
        var f = u * (SH.P.length - 1), q = Math.max(0, Math.min(SH.P.length - 1, Math.round(f))), r = SH.R[q];
        return SH.P[q].clone().addScaledVector(Fh.S[q], sx * r[0]).addScaledVector(Fh.N[q], sy * r[1]).addScaledVector(Fh.T[q], sz || 0);
      }
      // eyes: big and set to the sides, a slit pupil and a heavy brow
      var eyeU = K.head === 'boulder' ? 0.55 : K.head === 'crest' ? 0.42 : 0.5, eyeR = (K.head === 'boulder' ? 0.06 : K.head === 'crest' ? 0.06 : K.head === 'ember' ? 0.065 : 0.118) * hk * (1 + young * 0.25);
      [1, -1].forEach(function (sd) {
        var ep = at(eyeU, sd * 0.84, 0.36), en = side.clone().multiplyScalar(sd).addScaledVector(fwd, 0.55).addScaledVector(upw, 0.18).normalize();
        var eg = new T.SphereGeometry(eyeR, 14, 10); eg.scale(1.05, 0.82, 1.18);
        eg = placed(eg, ep, fwd, upw);
        self.addGeo(solidCol(eg, lin(K.eye)), { c: '#ffffff', jit: 0, m: M.glow !== undefined ? M.glow : M.paint, ao: 0, vary: 0 });
        var pg = new T.SphereGeometry(eyeR * 0.5, 10, 8); pg.scale(young ? 0.7 : 0.32, 1.0, 0.2);
        var pc = ep.clone().addScaledVector(en, eyeR * 1.1); pg = placed(pg, pc, en.clone().cross(upw).lengthSq() > 1e-3 ? upw.clone().cross(en) : fwd, upw);
        // the pupil faces outward: build it in a frame whose z is the eye normal
        var pg2 = new T.SphereGeometry(eyeR * 0.5, 10, 8); pg2.scale(young ? 0.7 : 0.36, 0.98, 0.14);
        var Z = en.clone(), Y = upw.clone().sub(Z.clone().multiplyScalar(upw.dot(Z))).normalize(), X = Y.clone().cross(Z);
        pg2.applyMatrix4(new T.Matrix4().makeBasis(X, Y, Z).setPosition(pc));
        self.addGeo(solidCol(pg2, lin('#0c0c0d')), { c: '#ffffff', jit: 0, m: M.paint, ao: 0, vary: 0 });
        // a white catchlight
        var hg = new T.SphereGeometry(eyeR * 0.14, 6, 5); var hp = pc.clone().addScaledVector(upw, eyeR * 0.35).addScaledVector(fwd, eyeR * 0.15).addScaledVector(en, eyeR * 0.05); hg.translate(hp.x, hp.y, hp.z);
        self.addGeo(solidCol(hg, lin('#f6f4ef')), { c: '#ffffff', jit: 0, m: M.paint, ao: 0, vary: 0 });
        // brow
        var bp = at(eyeU + 0.02, sd * 0.8, 0.62);
        var bg = new T.SphereGeometry(eyeR * 1.0, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5); bg.scale(1.3, 0.3, 0.9);
        bg = placed(bg, bp, fwd, upw.clone().addScaledVector(side, sd * 0.35));
        self.addGeo(solidCol(bg, mixC(cBody, cBody2, 0.6)), { c: '#ffffff', jit: 0, m: SCALE, ao: 0.1 });
        // nostril
        var np = at(0.93, sd * 0.42, 0.92), ng = new T.SphereGeometry(0.022 * hk, 6, 5); ng.scale(1.3, 0.6, 1); ng.translate(np.x, np.y, np.z);
        self.addGeo(solidCol(ng, lin('#0b0b0c')), { c: '#ffffff', jit: 0, m: M.dark, ao: 0, vary: 0 });
        // mouth line, from the snout back under the eye
        var mp = []; for (var u = 0.96; u >= 0.5; u -= 0.08) mp.push(at(u, sd * 0.97, -0.28 - (0.96 - u) * 0.25));
        for (var m = 0; m < mp.length - 1; m++) self.beam(mp[m].toArray(), mp[m + 1].toArray(), 0.011 * hk, { round: true, seg: 4, c: '#111113', m: M.dark, ao: 0 });
      });
      // ear flaps and horns
      if (K.ears === 'night' || K.ears === 'dawn') {
        var big = K.ears === 'night' ? 1.3 : 0.85;
        [[0.06, 0.55, 0.62, 0.64 * big, 0.17, [-0.9, 0.42, 0.42]], [0.12, 0.85, 0.05, 0.42 * big, 0.12, [-0.9, 0.12, 0.6]], [0.3, 0.95, -0.42, 0.26 * big, 0.08, [-0.85, -0.35, 0.55]], [0.02, 0.25, 0.9, 0.3 * big, 0.09, [-0.95, 0.5, 0.1]]].forEach(function (E) {
          if (K.ears === 'dawn' && E[0] === 0.3) return;
          [1, -1].forEach(function (sd) {
            var bp = at(E[0], sd * E[1], E[2]), d = fwd.clone().multiplyScalar(-E[5][0] * -1 * -1).multiplyScalar(-1);
            d = fwd.clone().multiplyScalar(E[5][0]).addScaledVector(upw, E[5][1]).addScaledVector(side, sd * E[5][2]).normalize();
            var sh = new T.Shape(finShape(E[3] * hk, E[4] * hk, 'ear').map(function (p) { return new T.Vector2(p[0], p[1]); }));
            var g = new T.ExtrudeGeometry(sh, { depth: 0.026 * hk, bevelEnabled: false }); g.translate(0, 0, -0.013 * hk); g.deleteAttribute('uv');
            // curl the flap a little: bend its tip down
            var pp = g.attributes.position; for (var q = 0; q < pp.count; q++) { var xx = pp.getX(q) / (E[3] * hk); pp.setZ(q, pp.getZ(q) - xx * xx * 0.12 * hk); }
            var nrm = upw.clone().addScaledVector(side, sd * 0.6).normalize();
            g = placed(g.ni(), bp, d, nrm.clone().cross(d).cross(d).multiplyScalar(-1)); g.computeVertexNormals();
            self.addGeo(solidCol(g, mixC(cBody, cBody2, 0.7)), { c: '#ffffff', jit: 0, m: SCALE, ao: 0.1, vary: 0.03 });
          });
        });
      }
      if (K.horns === 'ember') {
        [1, -1].forEach(function (sd) {
          var hp = at(0.12, sd * 0.55, 0.75), pts = [], q;
          for (q = 0; q <= 6; q++) { var t = q / 6; pts.push(hp.clone().addScaledVector(fwd, -0.75 * t * hk).addScaledVector(upw, (0.35 * t - 0.25 * t * t) * hk).addScaledVector(side, sd * 0.2 * t * hk)); }
          var Fh2 = frames(pts, upw);
          self.addGeo(tubeGeo(pts, Fh2, function (q2) { var t = q2 / 6; return { rx: 0.075 * (1 - t * 0.85) * hk, ry: 0.075 * (1 - t * 0.85) * hk, ex: 2 }; }, 8, function () { return lin('#d9d2c4'); }), { c: '#ffffff', jit: 0, m: SCALE, ao: 0.2 });
          var hp2 = at(0.25, sd * 0.75, 0.2);
          var g2 = new T.ConeGeometry(0.05 * hk, 0.32 * hk, 6); g2.translate(0, 0.16 * hk, 0); var d2 = fwd.clone().multiplyScalar(-0.8).addScaledVector(side, sd * 0.5).addScaledVector(upw, 0.1).normalize();
          g2 = placed(g2.ni(), hp2, upw, d2); g2.computeVertexNormals(); self.addGeo(solidCol(g2, lin('#d9d2c4')), { c: '#ffffff', jit: 0, m: SCALE, ao: 0.1 });
        });
      }
      if (K.crest) {
        // a crown of spines sweeping back from the brow, and a beak-like snout horn
        for (var c = 0; c < 9; c++) {
          var a = (c / 8 - 0.5) * 2.0, cp = at(0.2, Math.sin(a) * 0.7, Math.cos(a) * 0.85), d3 = fwd.clone().multiplyScalar(-1).addScaledVector(upw, 0.35 + Math.cos(a) * 0.3).addScaledVector(side, Math.sin(a) * 0.55).normalize();
          var g3 = new T.ConeGeometry(0.035 * hk, (0.38 + 0.25 * Math.cos(a)) * hk, 5); g3.translate(0, (0.19 + 0.125 * Math.cos(a)) * hk, 0);
          g3 = placed(g3.ni(), cp, upw.clone().cross(d3).lengthSq() > 1e-3 ? upw.clone().cross(d3) : side, d3); g3.computeVertexNormals();
          self.addGeo(solidCol(g3, lin('#2a2927')), { c: '#ffffff', jit: 0, m: SCALE, ao: 0.05 });
        }
        var sp = at(0.86, 0, 0.8), g4 = new T.ConeGeometry(0.035 * hk, 0.18 * hk, 5); g4.translate(0, 0.09 * hk, 0); var d4 = upw.clone().addScaledVector(fwd, 0.6).normalize();
        g4 = placed(g4.ni(), sp, side, d4); g4.computeVertexNormals(); self.addGeo(solidCol(g4, lin('#2a2927')), { c: '#ffffff', jit: 0, m: SCALE, ao: 0.05 });
      }
      if (K.head === 'boulder') {
        // a heavy underbite with two blunt tusks, and warts over the brow
        [1, -1].forEach(function (sd) {
          var tp = at(0.9, sd * 0.62, -0.35), g5 = new T.ConeGeometry(0.035 * hk, 0.12 * hk, 5); g5.translate(0, 0.06 * hk, 0); g5.translate(tp.x, tp.y, tp.z);
          self.addGeo(solidCol(g5.ni(), lin('#d6d0c2')), { c: '#ffffff', jit: 0, m: M.paint, ao: 0 });
        });
        for (var w = 0; w < 10; w++) { var wp = at(0.15 + rnd() * 0.6, (rnd() - 0.5) * 1.4, 0.75 + rnd() * 0.2); var g6 = new T.IcosahedronGeometry(0.04 + rnd() * 0.05, 0); g6.translate(wp.x, wp.y, wp.z); self.addGeo(solidCol(g6.ni(), mixC(cBody2, cBelly, rnd())), { c: '#ffffff', jit: 0, m: M.rock, ao: 0.1 }); }
      }
      // dorsal fins along the neck to the head (night): a little row behind the ears
      if (K.spines === 'fins') {
        for (var dn = 0; dn < 3; dn++) {
          var dp = at(0.02 - dn * 0.03, 0, 0.98, -dn * 0.12 * hk), sh2 = new T.Shape(finShape(0.14 * hk, 0.07 * hk, 'blade').map(function (p) { return new T.Vector2(p[0], p[1]); }));
          var g7 = new T.ExtrudeGeometry(sh2, { depth: 0.016, bevelEnabled: false }); g7.deleteAttribute('uv'); g7.translate(0, 0, -0.008);
          g7 = placed(g7.ni(), dp, upw.clone().multiplyScalar(0.5).addScaledVector(fwd, -1), side); g7.computeVertexNormals();
          self.addGeo(solidCol(g7, cBone), { c: '#ffffff', jit: 0, m: SCALE, ao: 0.1 });
        }
      }
    }

    // ---- saddle, straps and a rider
    function saddle(P, F, R, H) {
      var i = Math.round(H.sh - (H.sh - H.hip) * 0.22), r = R[i], seat = [];
      var pos = [], col = [], cL = lin('#1f1e1c'), cL2 = lin('#2e2c29');
      function patch(i0, i1, th0, th1, k, c) {
        var rows = [];
        for (var a = i0; a <= i1; a++) { var row = []; for (var q = 0; q <= 10; q++) { var th = th0 + (th1 - th0) * q / 10; row.push(P[a].clone().addScaledVector(F.S[a], Math.cos(th) * R[a][0] * k).addScaledVector(F.N[a], Math.sin(th) * R[a][1] * k)); } rows.push(row); }
        for (var y = 0; y < rows.length - 1; y++) for (var q2 = 0; q2 < 10; q2++) { var A1 = rows[y][q2], B1 = rows[y][q2 + 1], C1 = rows[y + 1][q2], D1 = rows[y + 1][q2 + 1]; pos.push(A1.x, A1.y, A1.z, C1.x, C1.y, C1.z, B1.x, B1.y, B1.z, B1.x, B1.y, B1.z, C1.x, C1.y, C1.z, D1.x, D1.y, D1.z); for (var z = 0; z < 6; z++) col.push(c.r, c.g, c.b); }
      }
      patch(i - 3, i + 4, Math.PI * 0.18, Math.PI * 0.82, 1.06, cL);
      // straps round the chest
      patch(i - 6, i - 5, -Math.PI * 0.95, Math.PI * 1.95, 1.04, cL2);
      patch(i + 6, i + 7, -Math.PI * 0.95, Math.PI * 1.95, 1.04, cL2);
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
      self.addGeo(g, { c: '#ffffff', jit: 0, m: M.wood, bucket: 'cloth', ao: 0.1, vary: 0.04 });
      // the seat's raised back and its front handles
      var top = P[i].clone().addScaledVector(F.N[i], r[1] * 1.06);
      var cant = P[i - 3].clone().addScaledVector(F.N[i - 3], R[i - 3][1] * 1.12);
      self.beam(cant.clone().addScaledVector(F.S[i], 0.18).toArray(), cant.clone().addScaledVector(F.S[i], -0.18).toArray(), 0.04, { round: true, c: '#1f1e1c', m: M.wood });
      var hand = P[i + 4].clone().addScaledVector(F.N[i + 4], R[i + 4][1] * 1.1);
      [1, -1].forEach(function (sd) { var hb = hand.clone().addScaledVector(F.S[i + 4], sd * 0.12); self.beam(hb.toArray(), hb.clone().addScaledVector(F.N[i + 4], 0.12).addScaledVector(F.T[i + 4], 0.05).toArray(), 0.02, { round: true, c: '#8f8a80', m: M.metal }); });
      [1, -1].forEach(function (sd) { var st = P[i].clone().addScaledVector(F.S[i], sd * r[0] * 1.08).addScaledVector(F.N[i], -r[1] * 0.1); self.box(st.x, st.y - 0.05, st.z, 0.05, 0.1, 0.12, { c: '#8f8a80', m: M.metal, bevel: 0.01 }); });
      if (o.rider) {
        // the rider sits astride: register the pose once
        if (!KIT.people.poses.dragonride) KIT.people.poses.dragonride = dragonride;
        var yaw = Math.atan2(F.T[i].x, F.T[i].z);
        var pitch = Math.asin(U.clamp(F.T[i].y, -1, 1));
        self.push(top.x, top.y - 0.86, top.z, yaw);
        if (Math.abs(pitch) > 0.02) self.stack[self.stack.length - 1].multiply(new T.Matrix4().makeRotationX(-pitch));
        self.figure(0, 0, Object.assign({ role: 'villager', pose: 'dragonride', c: '#3b3a38', cape: '#1f1e1c', s: 1 / s }, o.rider));
        self.pop();
      }
    }
    function fireBreath() {}
  };

  // ------------------------------------------------------------------ eggs
  // o: { kind, s, ry, tilt, glow }
  B.dragonEgg = function (x, y, z, o) {
    o = o || {};
    var kind = o.kind || 'night', K = KINDS[kind], s = (o.s || 1) * 0.58, self = this, rnd = U.rng(o.seed || 3);
    var c1 = lin(K.col), c2 = lin(K.col2), cb = lin(K.belly);
    var spec = {
      night: function (p) { var n = U.noise3(p.x * 9, p.y * 9, p.z * 9); return n > 0.45 ? mixC(c2, lin('#4a5560'), 0.55) : mixC(c1, c2, n * 0.5 + 0.5); },
      dawn: function (p) { var n = U.noise3(p.x * 6, p.y * 6, p.z * 6); return mixC(c1, lin('#d9e3ea'), sm(n * 0.8 + 0.3) * 0.6); },
      boulder: function (p) { var n = U.noise3(p.x * 7, p.y * 7, p.z * 7); return mixC(lin('#5c5b58'), lin('#8b887f'), sm(n * 0.9 + 0.5)); },
      ember: function (p) { var n = Math.abs(U.noise3(p.x * 5, p.y * 5, p.z * 5)); return n < 0.06 ? lin('#f26a1b') : mixC(c1, c2, 0.4); },
      crest: function (p) { var n = U.noise3(p.x * 8, p.y * 8, p.z * 8); return n > 0.35 ? lin('#2a2927') : mixC(c1, c2, 0.5); }
    }[kind];
    this.unit(function () {
      var g = new T.SphereGeometry(0.28, 40, 30); g.scale(1, 1.32, 1);
      if (kind === 'boulder') { var pp = g.attributes.position; for (var i = 0; i < pp.count; i++) { var v = V(pp.getX(i), pp.getY(i), pp.getZ(i)), k = 1 + U.noise3(v.x * 8, v.y * 8, v.z * 8) * 0.08; pp.setXYZ(i, v.x * k, v.y * k, v.z * k); } }
      // a little ridge of scales spiralling up the shell
      var p2 = g.attributes.position, cols = [];
      for (var j = 0; j < p2.count; j++) { var q = V(p2.getX(j), p2.getY(j), p2.getZ(j)), ang = Math.atan2(q.z, q.x), row = q.y * 16, sc = Math.pow(Math.abs(Math.sin(ang * 7 + Math.floor(row) * 1.57)), 0.6) * Math.pow(Math.abs(Math.sin(row * Math.PI)), 0.5) * 0.035 * (1 - Math.abs(q.y) * 2.2); p2.setXYZ(j, q.x * (1 + sc), q.y, q.z * (1 + sc)); var c = spec(q); cols.push(c.r, c.g, c.b); }
      g.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); g.computeVertexNormals(); g.translate(0, 0.28 * 1.32, 0);
      self.push(x, y, z, o.ry || 0, s);
      if (o.tilt) self.stack[self.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(o.tilt));
      self.addGeo(g, { c: '#ffffff', jit: 0, m: kind === 'boulder' ? M.rock : SCALE, ao: 0.35, vary: 0.04 });
      self.pop();
    });
  };

  // ------------------------------------------------------------------ his own dragons (the Hub)
  // Set KIT.hub = { dragons: [{ id, kind, stage }], eggs: [{ id, kind }] } before KIT.make and the dragons and eggs a
  // build draws become his. Every place the build draws one is a slot; slots are gathered as the build runs and filled
  // when it finishes, so each slot first gets one of his of the same kind and then, in a second pass, any kind, each of
  // his at most once per build. A slot with nothing left for it draws nothing.
  // A dragon's stage sets its age (hatchling: a hatchling, fledgling: young, flier and rider: grown). Only fliers and
  // riders take a slot in the air, a hatchling only a hatchling's slot or one on the ground, and anything from a
  // fledgling up a perch or a ledge. A rider's dragon wears its saddle, and carries the slot's rider where it has one;
  // no other stage has either. An egg slot keeps its step whether or not it draws (the count of steps never changes),
  // and its o.then (cracks over the shell) draws only with the egg. His dragons and eggs draw from their own random
  // stream, so they never change how the rest of the build comes out. With KIT.hub unset everything draws as before.
  var FIVE = ['night', 'dawn', 'boulder', 'ember', 'crest'];
  var AGE = { hatchling: 'hatchling', fledgling: 'young', flier: 'adult', rider: 'adult' };
  var drawDragon = B.dragon, drawEgg = B.dragonEgg, finish = B.finish;
  // the kind a slot was drawn as, for a build's own variant (fishracks_boulder is a boulder)
  function kindOf(k) {
    k = k || 'night';
    for (var i = 0; i < FIVE.length; i++) if (k === FIVE[i] || k.slice(-FIVE[i].length - 1) === '_' + FIVE[i]) return FIVE[i];
    return k;
  }
  B.dragon = function (x, y, z, o) {
    if (!KIT.hub) return drawDragon.call(this, x, y, z, o);
    o = o || {};
    var P0 = POSES[o.pose || 'stand'] || POSES.stand, root = this.root();
    (root.hubDragons = root.hubDragons || []).push({
      b: this, m: this.top().clone(), x: x, y: y, z: z, o: o, kind: kindOf(o.kind),
      air: !!P0.air, small: o.age === 'hatchling', high: o.pose === 'perch' || this.world(x, y, z).y > 0.9
    });
    return this;
  };
  B.dragonEgg = function (x, y, z, o) {
    o = o || {};
    if (!KIT.hub) { drawEgg.call(this, x, y, z, o); if (o.then) o.then(); return this; }
    var slot = { b: this, m: this.top().clone(), x: x, y: y, z: z, o: o, kind: kindOf(o.kind) };
    // take the egg's step now, just as drawing it would
    this.unit(function (b) { slot.unit = b.unitNow(); });
    var root = this.root();
    (root.hubEggs = root.hubEggs || []).push(slot);
    return this;
  };
  function fitsSlot(s, d) {
    if (!KINDS[d.kind] || !AGE[d.stage]) return false;
    if (s.air) return d.stage === 'flier' || d.stage === 'rider';
    if (s.small) return d.stage === 'hatchling' || d.stage === 'fledgling';
    if (s.high) return d.stage !== 'hatchling';
    return true;
  }
  function fill(slots, his, fits) {
    var left = (his || []).slice(), got = slots.map(function () { return null; });
    [true, false].forEach(function (sameKind) {
      slots.forEach(function (s, i) {
        if (got[i]) return;
        for (var j = 0; j < left.length; j++) {
          if ((!sameKind || left[j].kind === s.kind) && fits(s, left[j])) { got[i] = left[j]; left.splice(j, 1); return; }
        }
      });
    });
    return got;
  }
  // draw into a slot's builder as it stood when the slot was made: its frame, its step, and a stream of its own
  function drawIn(slot, unit, seed, fn) {
    var b = slot.b, r0 = b.r, cu = b.curUnit, md = b.mode;
    if (unit !== undefined) { b.mode = unit < 0 ? 'base' : unit >= 99999 ? 'life' : null; b.curUnit = b.mode ? null : unit; }
    b.r = U.rng(seed);
    b.stack.push(slot.m);
    try { fn(b); } finally { b.stack.pop(); b.r = r0; b.curUnit = cu; b.mode = md; }
  }
  B.finish = function (mats, opts) {
    var hub = KIT.hub, ds = this.hubDragons || [], es = this.hubEggs || [];
    if (hub && (ds.length || es.length)) {
      fill(ds, hub.dragons, fitsSlot).forEach(function (d, i) {
        if (!d) return;
        var s = ds[i], rider = d.stage === 'rider';
        var o = Object.assign({}, s.o, { kind: d.kind, age: AGE[d.stage], saddle: rider, rider: rider ? s.o.rider || null : null, seed: s.o.seed || 7 });
        drawIn(s, undefined, U.hashStr('dragon ' + (d.id || d.kind) + ' ' + i), function (b) { drawDragon.call(b, s.x, s.y, s.z, o); });
      });
      fill(es, hub.eggs, function (s, e) { return !!KINDS[e.kind]; }).forEach(function (e, i) {
        if (!e) return;
        var s = es[i];
        drawIn(s, s.unit, U.hashStr('egg ' + (e.id || e.kind) + ' ' + i), function (b) {
          drawEgg.call(b, s.x, s.y, s.z, Object.assign({}, s.o, { kind: e.kind }));
          if (s.o.then) s.o.then();
        });
      });
    }
    var out = finish.call(this, mats, opts);
    out.hubSlots = ds.length + es.length;
    this.hubDragons = this.hubEggs = null;
    return out;
  };
})();
