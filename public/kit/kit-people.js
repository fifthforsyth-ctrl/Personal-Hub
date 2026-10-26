// Painterly village kit, part 4: people. Stylized but human: a slightly big head, broad shoulders, tapered limbs and
// poses with weight in them. Arms and legs are placed by two-bone IK from hand and foot targets, so a pose is only a
// handful of points (where the hands and feet are, how the body leans, where the head looks) plus what is in hand.
// The figure faces +z; its right side is -x. Index 0 is the right hand or foot, 1 the left.
(function () {
  var T = THREE, KIT = window.KIT, M = KIT.M, PAL = KIT.PAL, U = KIT.util;
  function V(x, y, z) { return new T.Vector3(x, y, z); }

  // elbow or knee for a limb from S reaching toward H, bones a and b, bending toward pole
  function ik(S, H, a, b, pole) {
    var d = H.clone().sub(S), L = d.length(), maxL = (a + b) * 0.995;
    if (L > maxL) { d.setLength(maxL); H = S.clone().add(d); L = maxL; }
    L = Math.max(L, 1e-4);
    var dir = d.clone().normalize(), x = (a * a - b * b + L * L) / (2 * L), h = Math.sqrt(Math.max(0, a * a - x * x));
    var p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))); if (p.lengthSq() < 1e-6) p = V(0, 0, 1); p.normalize();
    return { E: S.clone().addScaledVector(dir, x).addScaledVector(p, h), H: H };
  }
  // Euler (order YXZ) that turns +y toward dir
  function aim(dir) { var q = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize()); return new T.Euler().setFromQuaternion(q, 'YXZ'); }

  var TUNICS = ['#5c5e62', '#3b3a38', '#8a857c', '#6f6a62', '#2f2e2c', '#a39d92', '#7a5a46', '#4a4c50'];
  var HOSE = ['#4a3c30', '#3d3a36', '#5a4a3a', '#43474a'];

  // Poses: feet (ankles) and hands in figure space, lean (forward), twist, side tilt, hip drop, head turn/tilt.
  // Each is a function of the side sign table so it can be mirrored.
  var POSES = {
    stand: function (r) { return { feet: [V(-0.12, 0.09, 0.03), V(0.13, 0.09, -0.06)], hands: [V(-0.27, 0.86, 0.06), V(0.27, 0.88, 0.0)], lean: 0.03, twist: r(0.12), side: 0.03, hip: 0.03, drop: 0, head: [r(0.4), r(0.08)] }; },
    walk: function (r) { return { feet: [V(-0.1, 0.13, 0.3), V(0.11, 0.1, -0.27)], hands: [V(-0.24, 0.92, -0.2), V(0.25, 0.93, 0.24)], lean: 0.1, twist: 0.12, side: 0, hip: 0, drop: 0.02, head: [r(0.2), 0.05] }; },
    talk: function (r) { return { feet: [V(-0.14, 0.09, 0.05), V(0.12, 0.09, -0.04)], hands: [V(-0.2, 1.12, 0.32), V(0.3, 0.98, 0.15)], lean: 0.02, twist: -0.15, side: -0.04, hip: -0.03, drop: 0, head: [0.25, -0.1], pole: [V(-0.6, -0.5, -0.4), V(0.7, -0.4, -0.4)] }; },
    point: function (r) { return { feet: [V(-0.16, 0.09, 0.12), V(0.13, 0.09, -0.12)], hands: [V(-0.42, 1.62, 0.42), V(0.27, 0.95, 0.04)], lean: -0.02, twist: 0.2, side: 0.06, hip: 0.02, drop: 0, head: [-0.45, -0.15] }; },
    cheer: function (r) { return { feet: [V(-0.17, 0.09, 0.02), V(0.17, 0.09, -0.02)], hands: [V(-0.36, 1.98, 0.08), V(0.33, 1.95, 0.1)], lean: -0.08, twist: 0, side: 0, hip: 0, drop: 0, head: [0, -0.3], pole: [V(-1, -0.2, -0.2), V(1, -0.2, -0.2)] }; },
    guard: function (r) { return { feet: [V(-0.22, 0.09, 0.3), V(0.2, 0.09, -0.25)], hands: [V(-0.2, 1.18, 0.36), V(0.24, 1.15, 0.3)], lean: 0.16, twist: -0.3, side: 0, hip: 0, drop: 0.07, head: [0.25, -0.08], pole: [V(-0.8, -0.6, -0.2), V(0.9, -0.5, 0)] }; },
    swing: function (r) { return { feet: [V(-0.24, 0.09, 0.33), V(0.18, 0.09, -0.28)], hands: [V(-0.12, 1.86, -0.02), V(0.26, 1.2, 0.34)], lean: 0.1, twist: 0.35, side: -0.06, hip: 0, drop: 0.06, head: [-0.2, -0.05], pole: [V(-1, 0.1, 0), V(0.9, -0.5, 0)] }; },
    vigil: function (r) { return { feet: [V(-0.16, 0.09, 0.02), V(0.16, 0.09, 0.0)], hands: [V(-0.05, 1.05, 0.33), V(0.05, 1.07, 0.33)], lean: 0.02, twist: 0, side: 0, hip: 0, drop: 0, head: [r(0.15), 0.12], pole: [V(-1, -0.4, -0.3), V(1, -0.4, -0.3)] }; },
    hammer: function (r) { return { feet: [V(-0.2, 0.09, 0.12), V(0.16, 0.09, -0.12)], hands: [V(-0.24, 1.78, 0.1), V(0.1, 1.0, 0.45)], lean: 0.22, twist: 0.15, side: 0, hip: 0, drop: 0.05, head: [0, 0.35], pole: [V(-1, 0.2, -0.4), V(0.6, -0.6, 0)] }; },
    draw: function (r) { return { feet: [V(-0.15, 0.09, -0.12), V(0.17, 0.09, 0.14)], hands: [V(-0.1, 1.56, 0.02), V(0.06, 1.47, 0.64)], lean: -0.02, twist: -0.75, side: 0.04, hip: 0, drop: 0.02, head: [0.75, 0.05], pole: [V(-0.6, 0.2, -1), V(0.4, -0.6, 0)] }; },
    carry: function (r) { return { feet: [V(-0.1, 0.12, 0.24), V(0.11, 0.1, -0.22)], hands: [V(-0.26, 0.9, -0.12), V(0.16, 1.63, 0.05)], lean: 0.1, twist: 0.08, side: 0.08, hip: 0, drop: 0.03, head: [-0.15, 0.05], pole: [V(-0.5, -0.4, -0.6), V(1, -0.3, 0.1)] }; },
    spear: function (r) { return { feet: [V(-0.12, 0.09, 0.03), V(0.14, 0.09, -0.04)], hands: [V(-0.3, 1.18, 0.12), V(0.25, 0.92, 0.02)], lean: 0.0, twist: r(0.1), side: -0.04, hip: -0.03, drop: 0, head: [r(0.35), 0.0], pole: [V(-0.6, -0.6, -0.4), V(0.6, -0.4, -0.4)] }; },
    run: function (r) { return { feet: [V(-0.1, 0.3, 0.38), V(0.1, 0.16, -0.42)], hands: [V(-0.26, 1.12, -0.28), V(0.24, 1.22, 0.32)], lean: 0.22, twist: 0.15, side: 0, hip: 0, drop: 0.0, head: [0, -0.1], pole: [V(-0.4, -0.5, -0.8), V(0.4, -0.8, 0.2)] }; }
  };

  // o: { role 'villager'|'soldier'|'knight'|'archer'|'smith'|'child', pose, ry, c (tunic or team colour), team, s,
  //      hair, skin, hat, beard, cape, tier (an archer's bow: 0 wood, 1 longbow (default), 2 recurve, 3 steel),
  //      unit (lay the figure as that step instead of with the life that comes once a build stands) }
  function figure(b, x, z, o) {
    o = o || {};
    var role = o.role || 'villager', child = role === 'child';
    var pose = o.pose || ({ knight: 'vigil', soldier: 'spear', archer: 'draw', smith: 'hammer', child: 'run' })[role] || 'stand';
    var s = o.s || (child ? 0.62 : 1), y = o.y || 0, r = function (k) { return b.j(k); };
    var P0 = (POSES[pose] || POSES.stand)(r);
    var skin = o.skin || b.pick(PAL.skin), hair = o.hair || b.pick(PAL.hair), tunic = o.c || b.pick(TUNICS), hose = b.pick(HOSE);
    var team = o.team || 'ink', boots = '#3a2c22', leather = '#5a3f2b';
    var knight = role === 'knight', soldier = role === 'soldier', archer = role === 'archer', smith = role === 'smith';
    var metalArms = knight, bulk = knight ? 1.12 : smith ? 1.08 : 1;
    var sleeve = metalArms ? 'steel' : soldier ? '#7b7f80' : tunic, sleeveM = metalArms || soldier ? M.metal : M.cloth;
    var headK = child ? 1.22 : 1;

    var lay = o.unit === undefined ? function (fn) { b.life(fn); } : function (fn) { b.stepAs(o.unit, fn); };
    lay(function () {
      b.push(x, y, z, o.ry || 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeScale(s, s, s));
      var P = V(P0.hip, 0.92 - P0.drop, 0);
      var Q = new T.Quaternion().setFromEuler(new T.Euler(P0.lean, P0.twist, P0.side, 'YXZ'));
      var E = new T.Euler().setFromQuaternion(Q, 'YXZ');
      function up(v) { return v.clone().applyQuaternion(Q).add(P); }

      // legs
      [0, 1].forEach(function (i) {
        var sd = i ? 1 : -1, H = V(sd * 0.1, P.y, 0).add(V(P.x, 0, 0)), F = P0.feet[i];
        var k = ik(H, F, 0.43, 0.42, V(sd * 0.12, 0, 1));
        b.beam(H.toArray(), k.E.toArray(), 0.075 * bulk, { r2: 0.06 * bulk, round: true, seg: 7, c: knight ? '#6e7276' : hose, m: knight ? M.metal : M.cloth });
        b.ball(k.E.x, k.E.y, k.E.z, 0.062 * bulk, { c: knight ? 'steel' : hose, m: knight ? M.metal : M.cloth, detail: 1, smooth: true });
        b.beam(k.E.toArray(), k.H.toArray(), 0.058 * bulk, { r2: 0.05, round: true, seg: 7, c: knight ? 'steel' : boots, m: knight ? M.metal : M.wood });
        // boot: a cuff and a foot pointing a little outward along the step
        var fy = Math.max(0, k.H.y - 0.09), toe = 0.12 + sd * 0.05 * 0;
        b.box(k.H.x + sd * 0.01, fy, k.H.z + 0.05, 0.12 * bulk, 0.11, 0.27, { ry: sd * -0.12, c: boots, m: M.wood, bevel: 0.035, ao: 0.2 });
      });

      // the body, in the torso's own frame
      b.push(P.x, P.y, P.z, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationFromQuaternion(Q));
      var bodyC = knight ? 'steel' : smith ? '#8a6a52' : soldier ? '#8c7a5c' : tunic, bodyM = knight ? M.metal : M.cloth;
      b.lathe(0, -0.02, 0, [[0.15, 0], [0.16, 0.12], [0.15, 0.22], [0.18, 0.35], [0.2, 0.45], [0.15, 0.53], [0.05, 0.57]], { c: bodyC, m: bodyM, seg: 12, sx: 1.25 * bulk, sz: 0.8 * bulk });
      // the skirt of the tunic (or the mail skirt) over the tops of the legs
      var skirtC = knight ? '#7b8085' : smith ? tunic : soldier ? '#8c7a5c' : tunic;
      b.lathe(0, -0.36, 0, [[0.27, 0], [0.24, 0.12], [0.19, 0.32], [0.16, 0.42]], { c: skirtC, m: knight ? M.metal : M.cloth, seg: 12, sx: 1.18 * bulk, sz: 0.95 * bulk });
      b.cyl(0, 0.08, 0, 0.165, 0.06, { c: leather, m: M.wood, seg: 12, sx: 1.25 * bulk, sz: 0.82 * bulk });
      b.box(0, 0.08, 0.13 * bulk, 0.06, 0.06, 0.03, { c: 'brass', m: M.gold, bevel: 0.01 });
      if (knight || soldier) {
        // a tabard in the house colour, front and back, the crossed swords on the front
        [1, -1].forEach(function (f) { b.box(0, -0.4, f * 0.155 * bulk, 0.3, 0.86, 0.03, { rx: f * 0.06, c: team, m: M.cloth, bevel: 0.008, ao: 0.15 }); });
        b.emblem(0, 0.2, 0.172 * bulk, 0.2, knight ? 'cross' : 'swords', o.ec || (team === 'bone' ? '#232220' : '#f1eee8'));
      }
      if (smith) { b.box(0, -0.42, 0.15, 0.34, 0.86, 0.03, { rx: 0.05, c: leather, m: M.wood, bevel: 0.01 }); }
      if (knight || o.cape) {
        // a cape that hangs from the shoulders and swings in the wind
        var cg = new T.PlaneGeometry(1, 1, 4, 7), cp = cg.attributes.position, capeLen = 1.18;
        for (var i = 0; i < cp.count; i++) {
          var u = cp.getX(i) + 0.5, v = 0.5 - cp.getY(i), w = 0.42 + v * 0.26, xx = (u - 0.5) * w;
          var zz = -0.17 * bulk - v * v * 0.22 + Math.pow(u * 2 - 1, 2) * 0.09 * (1 - v * 0.5) + Math.sin(u * Math.PI * 3) * 0.025 * v;
          cp.setXYZ(i, xx, 0.5 - v * capeLen, zz);
        }
        cg.computeVertexNormals();
        b.addGeo(cg, { c: o.cape || team, m: M.cloth, bucket: 'cloth', sway: 1, swayFn: function (lx, ly) { return U.clamp((0.45 - ly) / 1.2, 0, 1) * 0.6; }, ao: 0.1 });
        if (knight) b.lathe(0, 0.47, 0, [[0.23, 0], [0.2, 0.07], [0.12, 0.1]], { c: o.cape || team, m: M.cloth, seg: 12, sx: 1.2, sz: 0.9 });
      }
      if (archer) {
        // the quiver on the back, a hood's cowl round the shoulders
        b.lathe(0, 0.42, 0, [[0.25, 0], [0.21, 0.08], [0.11, 0.13]], { c: tunic, m: M.cloth, seg: 12, sx: 1.2, sz: 0.95 });
        b.push(0.08, 0.05, -0.2, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationZ(-0.45));
        b.cyl(0, 0, 0, 0.07, 0.55, { c: leather, m: M.wood, seg: 8 });
        for (var a = 0; a < 5; a++) { b.cyl(b.j(0.03), 0.55, b.j(0.03), 0.008, 0.18, { c: 'woodLight', m: M.wood, seg: 4 }); b.box(b.j(0.03), 0.66, b.j(0.03), 0.04, 0.08, 0.005, { c: '#e9e2cf', m: M.cloth, bevel: 0 }); }
        b.pop();
      }
      if (soldier && pose !== 'guard') { b.push(0, 0.25, -0.2, 0); b.shield(0, 0, -0.02, { kind: 'round', c: team, s: 0.82, ry: Math.PI }); b.pop(); }
      b.pop();

      // arms
      var hands = [];
      [0, 1].forEach(function (i) {
        var sd = i ? 1 : -1, S = up(V(sd * 0.205 * bulk, 0.47, 0)), H = P0.hands[i], pole = (P0.pole && P0.pole[i]) || V(sd * 0.5, -0.3, -0.6);
        var k = ik(S, H, 0.29, 0.27, pole);
        b.ball(S.x, S.y, S.z, (metalArms ? 0.1 : 0.072) * bulk, { c: sleeve, m: sleeveM, detail: 1, smooth: true, sy: metalArms ? 0.8 : 1 });
        b.beam(S.toArray(), k.E.toArray(), 0.062 * bulk, { r2: 0.052 * bulk, round: true, seg: 7, c: sleeve, m: sleeveM });
        b.ball(k.E.x, k.E.y, k.E.z, 0.052 * bulk, { c: smith ? skin : sleeve, m: smith ? M.skin : sleeveM, detail: 1, smooth: true });
        b.beam(k.E.toArray(), k.H.toArray(), 0.05 * bulk, { r2: 0.04 * bulk, round: true, seg: 7, c: smith || role === 'villager' || child ? skin : sleeve, m: smith || role === 'villager' || child ? M.skin : sleeveM });
        b.ball(k.H.x, k.H.y, k.H.z, 0.054 * bulk, { c: knight ? '#6e7276' : archer || soldier ? leather : skin, m: knight ? M.metal : archer || soldier ? M.wood : M.skin, detail: 1, smooth: true, sy: 1.15 });
        hands.push(k);
      });

      // neck and head
      var N = up(V(0, 0.55, 0)), hq = new T.Quaternion().setFromEuler(new T.Euler(P0.head[1] + P0.lean * -0.5, P0.head[0] - P0.twist * 0.6, 0, 'YXZ')).premultiply(Q);
      var HC = N.clone().add(V(0, 0.15 * headK, 0.01).applyQuaternion(hq)), he = new T.Euler().setFromQuaternion(hq, 'YXZ');
      b.beam(N.toArray(), HC.toArray(), 0.055, { round: true, seg: 6, c: skin, m: M.skin });
      b.push(HC.x, HC.y, HC.z, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationFromQuaternion(hq).scale(V(headK, headK, headK)));
      b.ball(0, 0, 0, 0.125, { c: skin, m: M.skin, detail: 2, smooth: true, sy: 1.1, sz: 1.02 });
      b.ball(0, -0.012, 0.122, 0.026, { c: skin, m: M.skin, detail: 1, smooth: true, sy: 1.2 });
      [-1, 1].forEach(function (sd) { b.ball(sd * 0.044, 0.018, 0.108, 0.013, { c: '#2a201b', m: M.dark, detail: 0, ao: 0 }); b.ball(sd * 0.122, 0.0, 0.0, 0.026, { c: skin, m: M.skin, detail: 1, sz: 1.4 }); });
      var helm = knight ? 'great' : soldier ? 'kettle' : archer ? 'hood' : o.hat || null;
      if (helm === 'great') {
        b.lathe(0, -0.15, 0, [[0.148, 0], [0.152, 0.17], [0.14, 0.24], [0.08, 0.29], [0.005, 0.3]], { c: 'steel', m: M.metal, seg: 14 });
        b.box(0, 0.02, 0.135, 0.2, 0.025, 0.04, { c: '#1f1b19', m: M.dark, bevel: 0, ao: 0 });
        b.box(0, -0.12, 0.14, 0.025, 0.14, 0.03, { c: '#8d9398', m: M.metal, bevel: 0.005 });
        // a plume streaming back
        b.beam([0, 0.14, -0.02], [0, 0.28, -0.2], 0.05, { round: true, seg: 6, r2: 0.025, c: o.plume || team, m: M.cloth });
        b.ball(0, 0.2, -0.12, 0.07, { c: o.plume || team, m: M.cloth, detail: 1, sz: 1.4, sy: 0.8 });
      } else if (helm === 'kettle') {
        b.ball(0, 0.04, -0.005, 0.138, { c: 'steel', m: M.metal, detail: 2, smooth: true, sy: 0.85 });
        b.cyl(0, 0.03, 0, 0.21, 0.02, { c: '#8d9398', m: M.metal, seg: 16 });
      } else if (helm === 'hood') {
        b.ball(0, 0.03, -0.03, 0.148, { c: tunic, m: M.cloth, detail: 2, smooth: true, sy: 1.0, sz: 1.08 });
        b.beam([0, 0.08, -0.12], [0, -0.06, -0.26], 0.05, { round: true, seg: 6, r2: 0.015, c: tunic, m: M.cloth });
      } else if (!smith || o.hair) {
        b.ball(0, 0.04, -0.022, 0.134, { c: hair, m: M.hair, detail: 2, smooth: true, sy: 0.82 });
        if (b.chance ? b.chance(0.35) : b.r() < 0.35) b.ball(0, -0.06, -0.08, 0.1, { c: hair, m: M.hair, detail: 1, smooth: true, sy: 1.2, sz: 0.8 });
        if (o.hat === 'straw') { b.cyl(0, 0.06, 0, 0.24, 0.02, { c: 'straw', m: M.straw, seg: 16 }); b.lathe(0, 0.07, 0, [[0.13, 0], [0.11, 0.09], [0.01, 0.1]], { c: 'straw', m: M.straw, seg: 12 }); }
      }
      if (o.beard || smith) b.ball(0, -0.085, 0.06, 0.088, { c: hair, m: M.hair, detail: 1, smooth: true, sy: 1.0, sz: 0.85 });
      b.pop();

      // in hand
      var R = hands[0], L = hands[1];
      function holdDir(k, d) { return d ? d.clone().normalize() : k.H.clone().sub(k.E).normalize(); }
      if (knight) {
        if (pose === 'vigil') { var mid = R.H.clone().add(L.H).multiplyScalar(0.5), e1 = aim(V(0, -1, 0.05)); b.sword(mid.x, mid.y + 0.05, mid.z, { rx: e1.x, ry: e1.y, rz: e1.z, len: 0.78 }); }
        else { var d1 = pose === 'swing' ? V(0.1, 0.35, -1) : V(0.05, 1, 0.35), e2 = aim(d1); b.sword(R.H.x, R.H.y, R.H.z, { rx: e2.x, ry: e2.y, rz: e2.z, len: 0.95 }); b.shield(L.H.x + 0.03, L.H.y - 0.05, L.H.z + 0.06, { kind: 'heater', c: team, s: 0.85, ry: -0.2 }); }
      }
      if (soldier) {
        if (pose === 'guard' || pose === 'swing') { var e3 = aim(pose === 'swing' ? V(0.1, 0.35, -1) : V(0.05, 1, 0.4)); b.sword(R.H.x, R.H.y, R.H.z, { rx: e3.x, ry: e3.y, rz: e3.z, len: 0.85 }); b.shield(L.H.x + 0.03, L.H.y, L.H.z + 0.06, { kind: 'round', c: team, s: 0.8, ry: -0.3 }); }
        else b.spear(R.H.x, 0.02, R.H.z, 2.3, {});
      }
      if (archer) {
        if (pose === 'draw') {
          var fwd = L.H.clone().sub(R.H).setY(0).normalize(), ry = Math.atan2(fwd.x, fwd.z) - Math.PI / 2, g0 = L.H.clone().addScaledVector(fwd, -0.2);
          b.bow(g0.x, g0.y, g0.z, { tier: o.tier === undefined ? 1 : o.tier, ry: ry, h: 1.5 });
          b.beam(R.H.toArray(), L.H.clone().addScaledVector(fwd, 0.18).toArray(), 0.008, { round: true, seg: 4, c: 'woodLight', m: M.wood });
        } else b.bow(R.H.x, R.H.y + 0.1, R.H.z, { tier: o.tier === undefined ? 1 : o.tier, h: 1.5 });
      }
      if (smith) {
        var dh = holdDir(R, pose === 'hammer' ? V(0.1, 0.15, -1) : null), eh = aim(dh);
        b.push(R.H.x, R.H.y, R.H.z, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationFromEuler(eh));
        b.cyl(0, -0.08, 0, 0.022, 0.48, { c: 'wood', m: M.wood, seg: 6 }); b.box(0, 0.36, 0, 0.1, 0.11, 0.24, { c: 'iron', m: M.metal, bevel: 0.015 });
        b.pop();
        if (pose === 'hammer') { b.beam(L.H.toArray(), L.H.clone().add(V(-0.05, -0.05, 0.4)).toArray(), 0.012, { round: true, seg: 4, c: 'iron', m: M.metal }); b.box(L.H.x - 0.05, L.H.y - 0.09, L.H.z + 0.42, 0.22, 0.04, 0.08, { c: '#d9733a', m: M.gold, glow: 2, bevel: 0.01 }); }
      }
      if (pose === 'carry') b.ball(L.H.x - 0.08, L.H.y + 0.08, L.H.z - 0.05, 0.2, { c: '#cdb48a', m: M.cloth, detail: 1, sy: 0.75, sx: 1.25 });
      if (child && o.toy !== false) { var e4 = aim(V(0.1, 1, 0.5)); b.push(R.H.x, R.H.y, R.H.z, 0); b.stack[b.stack.length - 1].multiply(new T.Matrix4().makeRotationFromEuler(e4)); b.box(0, 0, 0, 0.04, 0.6, 0.03, { c: 'woodLight', m: M.wood, bevel: 0.008 }); b.box(0, 0.1, 0, 0.22, 0.04, 0.04, { c: 'woodLight', m: M.wood, bevel: 0.008 }); b.pop(); }
      b.pop();
    });
    return b;
  }
  KIT.people = { figure: figure, poses: POSES };
})();
