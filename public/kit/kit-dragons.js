// Painterly village kit, part 6: dragons. One generator draws every kind: a spine curve from the tail tip to the back
// of the head, skinned with oval rings; a head with its own profile; legs placed by two-bone IK; bat wings of bone
// and membrane that fold or spread; fins, spines, horns, a saddle and a rider. Poses move the spine and the limbs,
// kinds change the proportions and the details. The dragon faces +z and stands on y = 0; its left side is +x.
(function () {
  var T = THREE, KIT = window.KIT, M = KIT.M, U = KIT.util, B = KIT.Builder.prototype;
  var SCALE = M.scale !== undefined ? M.scale : M.skin;
  // the loft dragon's matte hide: kit-core's hide material, or where a kit has none the matte paint one (never the
  // glossy scale, which turns a black hide to plastic)
  var HIDE = M.hide !== undefined ? M.hide : M.paint !== undefined ? M.paint : SCALE;
  // a pale kind's hide (LF.pale): kit-core's pale one, whose shade is filled with light thrown back into it, so a white
  // hide models in soft cool greys instead of turning navy under the hatching; a warm pale one (LF.hidePale): kit-core's
  // warm pale hide, whose shade takes warm bounced light instead of going slate under the sky
  function hideOf(LF) { return LF.pale && M.pale !== undefined ? M.pale : LF.hidePale && M.hidePale !== undefined ? M.hidePale : HIDE; }
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
      rad: [[0.035, 0.03], [0.075, 0.07], [0.12, 0.11], [0.18, 0.17], [0.26, 0.26], [0.42, 0.44], [0.5, 0.52], [0.52, 0.55], [0.53, 0.56], [0.42, 0.44], [0.36, 0.38], [0.33, 0.35]],
      // drawn as one anatomical loft (see the loft dragon below): its colours, then its shape
      loft: {
        skin: '#171717', skin2: '#1f1f21', belly: '#252526', mem: '#18181b', memEdge: '#2d2e33', memFold: '#1f2024', foldEdge: '#3b3d45', plate: '#19191c', claw: '#3d4045', dark: '#060708', pad: '#24272c',
        iris: '#8cab2c', irisRim: '#3b5a16', irisIn: '#bdd447', mouthIn: '#3d1c22', gum: '#24161a', tooth: '#e8e4d8',
        // head: its length; headS: how much bigger the grown one's head is than the generator's (broad, so its width takes
        // all of it and its length part); neck: the neck's length (short and thick, flaring into the jaw); trunk: the body's
        head: 0.88, headS: 1.19, snoutCap: 0.13, neck: 0.8, trunk: 0.9,
        // the neck shorter still where it is held up (so the head sits on the shoulders, never on a column)
        neckP: { alert: 0.78, sit: 0.84, roar: 0.88, perch: 0.92 },
        // the skin's rings by station (0 the tail's tip, 1 the hips, 2 the shoulders, 3 the back of the skull, 4 the snout):
        // [station, half width, top, bottom, squareness, back ridge, shoulder blades, chest, haunches, brows, cheeks, the snout's
        // lower sides drawn in]. The head is a low wedge: the skull highest just behind the brows, then sloping down to a
        // short, broad snout, the cheeks flaring at the back of the jaw.
        prof: [
          [0.00, 0.026, 0.026, 0.022, 2.0, 0, 0, 0, 0, 0, 0, 0], [0.08, 0.052, 0.05, 0.044, 2.0, 0.006, 0, 0, 0, 0, 0, 0],
          [0.25, 0.088, 0.088, 0.074, 2.1, 0.014, 0, 0, 0, 0, 0, 0], [0.45, 0.13, 0.134, 0.11, 2.2, 0.02, 0, 0, 0, 0, 0, 0],
          [0.65, 0.185, 0.19, 0.158, 2.25, 0.022, 0, 0, 0, 0, 0, 0], [0.82, 0.265, 0.28, 0.23, 2.3, 0.018, 0, 0, 0.02, 0, 0, 0],
          [0.94, 0.32, 0.36, 0.3, 2.3, 0.012, 0, 0, 0.06, 0, 0, 0], [1.05, 0.35, 0.4, 0.31, 2.3, 0.01, 0, 0, 0.075, 0, 0, 0],
          [1.18, 0.34, 0.395, 0.27, 2.25, 0.008, 0, 0, 0.055, 0, 0, 0], [1.33, 0.305, 0.39, 0.235, 2.2, 0.008, 0, 0, 0.012, 0, 0, 0],
          [1.50, 0.32, 0.41, 0.33, 2.15, 0.008, 0, 0, 0, 0, 0, 0], [1.68, 0.355, 0.44, 0.49, 2.05, 0.008, 0.02, 0, 0, 0, 0, 0],
          [1.84, 0.37, 0.455, 0.53, 2.0, 0.006, 0.05, 0.02, 0, 0, 0, 0], [1.98, 0.37, 0.45, 0.5, 2.0, 0.005, 0.05, 0.025, 0, 0, 0, 0],
          [2.15, 0.36, 0.44, 0.46, 2.0, 0.005, 0.02, 0.03, 0, 0, 0, 0], [2.45, 0.32, 0.37, 0.36, 2.05, 0.006, 0, 0, 0, 0, 0, 0],
          [2.72, 0.268, 0.298, 0.275, 2.05, 0.005, 0, 0, 0, 0, 0, 0], [2.88, 0.245, 0.262, 0.212, 2.1, 0.004, 0, 0, 0, 0, 0, 0],
          [2.97, 0.262, 0.282, 0.222, 2.15, 0, 0, 0, 0, 0, 0.004, 0], [3.05, 0.31, 0.318, 0.252, 2.15, 0, 0, 0, 0, 0, 0.026, 0],
          [3.13, 0.35, 0.348, 0.272, 2.15, 0, 0, 0, 0, 0, 0.05, 0], [3.24, 0.37, 0.366, 0.274, 2.15, 0, 0, 0, 0, 0.006, 0.056, 0],
          [3.36, 0.37, 0.356, 0.26, 2.2, 0, 0, 0, 0, 0.022, 0.034, 0], [3.47, 0.345, 0.326, 0.24, 2.25, 0, 0, 0, 0, 0.038, 0.01, 0.01],
          [3.57, 0.318, 0.282, 0.22, 2.3, 0, 0, 0, 0, 0.034, 0, 0.022], [3.67, 0.278, 0.235, 0.198, 2.3, 0, 0, 0, 0, 0.01, 0, 0.028],
          [3.79, 0.245, 0.19, 0.178, 2.25, 0, 0, 0, 0, 0, 0, 0.03], [3.90, 0.222, 0.162, 0.16, 2.2, 0, 0, 0, 0, 0, 0, 0.026],
          [4.00, 0.2, 0.145, 0.148, 2.15, 0, 0, 0, 0, 0, 0, 0.02]
        ],
        // the shoulders: a mass each side of the chest over the forelegs' roots (the upper arm and the muscle on it), by
        // station, so the forelegs grow out of the flank instead of dropping from under the chest like posts (running on
        // up the root of the neck, so the upper arm never stands off the chest with daylight between)
        sho: [[1.72, 0], [1.9, 0.09], [2.06, 0.11], [2.28, 0.05], [2.42, 0]],
        // the chest's underside drawn to a keel (a smaller exponent below the middle there): deep and narrow, not a barrel
        keel: 0.4,
        // the young's jaw drawn in under the cheeks (a smaller exponent under the head), so from the front its round
        // head tapers down to a soft chin instead of a flat shelf over the chest
        chinY: 0.32,
        // the young's head, blended in by age: a round, even dome of a skull, its forehead full and rounding over into a
        // short little muzzle (no flat face, no corner), and under it a full throat running smoothly up into the jaw (no
        // shelf of a chin over the chest)
        profY: [
          [2.92, 0.27, 0.26, 0.27, 2.0, 0, 0, 0, 0, 0, 0, 0], [3.00, 0.31, 0.29, 0.3, 2.0, 0, 0, 0, 0, 0, 0.01, 0],
          [3.10, 0.38, 0.37, 0.305, 2.0, 0, 0, 0, 0, 0, 0.025, 0], [3.22, 0.425, 0.45, 0.295, 2.0, 0, 0, 0, 0, 0, 0.03, 0],
          [3.35, 0.44, 0.5, 0.275, 2.0, 0, 0, 0, 0, 0.006, 0.022, 0], [3.47, 0.425, 0.51, 0.252, 2.0, 0, 0, 0, 0, 0.012, 0.01, 0],
          [3.58, 0.39, 0.48, 0.228, 2.0, 0, 0, 0, 0, 0.01, 0, 0.006], [3.68, 0.345, 0.425, 0.204, 2.0, 0, 0, 0, 0, 0, 0, 0.01],
          [3.79, 0.29, 0.35, 0.178, 2.0, 0, 0, 0, 0, 0, 0, 0.01], [3.90, 0.235, 0.27, 0.152, 2.0, 0, 0, 0, 0, 0, 0, 0.008],
          [4.00, 0.19, 0.2, 0.13, 2.0, 0, 0, 0, 0, 0, 0, 0.006]
        ],
        // eye [along the head, angle up from the side, radius, how far it turns forward], lids [upper, lower] (where their
        // edges cross the eye, cos from its top), nostrils [along, angle, size], mouth [its corner along the head, its height
        // there and at the snout (of the jaw's depth), how far along it curves up into the corner: a smile]
        eye: [0.54, 0.58, 0.146, 0.36, 0.08], lid: [0.74, -0.64], lidDrop: { sit: 0.36, curl: 0.46 }, nose: [0.935, 1.22, 0.028], mouth: [0.4, -0.07, 0.15, 0.3],
        // legs: root station and where in the ring ([out, up] of its half width and height), bones, paw [half width,
        // height, length], toes [length, radius, claw], how far down the fillet reaches, and the profile by station
        // (0 the root, 1 the elbow or knee, 2 the wrist or hock, 3 the paw, 4 the toes): [station, side, front-back, front
        // bump, back bump, squareness]
        // (the forearm short and thick under a clear elbow; the hind leg a strong haunch and thigh as broad as the
        // shoulders, a thick upper shin with its calf behind, then the slim hock)
        fore: { st: 1.98, at: [0.78, -0.15], len: [0.7, 0.5], paw: [0.15, 0.07, 0.11], toe: [0.15, 0.048, 0.055], fil: 0.8,
          prof: [[0, 0.29, 0.37, 0, 0, 2.0], [0.3, 0.25, 0.3, 0.025, 0, 2.0], [0.7, 0.19, 0.22, 0.01, 0, 2.0], [1, 0.16, 0.18, 0, 0.065, 2.1], [1.3, 0.162, 0.176, 0.024, 0, 2.1], [1.75, 0.126, 0.132, 0, 0, 2.0], [2, 0.108, 0.11, 0, 0, 2.0], [2.5, 0.115, 0.085, 0, 0, 2.2], [3, 0.15, 0.07, 0, 0, 2.6], [4, 0.14, 0.058, 0, 0, 2.6]] },
        hind: { st: 1.06, at: [0.84, 0.02], len: [0.64, 0.55], paw: [0.155, 0.072, 0.12], toe: [0.16, 0.05, 0.06], fil: 0.85,
          prof: [[0, 0.31, 0.43, 0, 0, 2.2], [0.3, 0.28, 0.38, 0.025, 0, 2.2], [0.65, 0.23, 0.3, 0.012, 0, 2.1], [1, 0.155, 0.175, 0.03, 0, 2.1], [1.3, 0.155, 0.18, 0, 0.04, 2.1], [1.75, 0.1, 0.115, 0, 0.012, 2.0], [2, 0.085, 0.095, 0, 0.035, 2.0], [2.5, 0.078, 0.078, 0, 0, 2.0], [3, 0.155, 0.072, 0, 0, 2.6], [4, 0.145, 0.058, 0, 0, 2.6]] },
        // the wing: its root (station, angle up from the side), where the membrane meets the hip. Open, the bones from the
        // shoulder [out, up, back]: the elbow, the wrist (a short strong arm, about two fifths of the span) and the four
        // fingers' ways from the wrist (the long rest, fanned wide), with their lengths; level in the air (gliding, a shallow
        // V: the arm a little up, the hand held out flat and swept back by glideSweep), and held up on the ground (m...: mantled, raised
        // and spread wide to the sides with the fingers fanned up, out and back to the hip, the hand leaning back like a
        // cape held up, so the membrane faces forward and a little up and shows its face from the front, three-quarters
        // and the high cameras of the builds, never its edge), by how much in each pose: well up in
        // every pose but the crouch, where the wings stay low and spread, ready to spring. Folded, its layout on the flank
        // in the skin's own terms [station, angle, how far out]: the elbow back along the top of the flank, the wrist
        // forward at the shoulder, riding up over the back's line (the knuckle that shows), and the fingers lying back
        // from it side by side past the hips, like a cloak, standing off the flank a little more toward their tips
        // (flare) so its lighter lower edge throws a line of shadow
        wing: { st: 1.86, a: 1.0, hip: 1.12, span: 1,
          elbow: [0.85, 0.3, 0.14], wrist: [1.78, 0.44, -0.18], fing: [[0.97, 0.6, -0.16], [0.76, 0.5, 0.62], [0.4, 0.3, 0.95], [0.0, 0.15, 1]],
          mElbow: [0.66, 0.5, 0.2], mWrist: [1.3, 0.88, 0.6], mFing: [[0.17, 0.79, 0.59], [0.77, 0.51, 0.39], [1.0, -0.07, -0.05], [0.6, -0.5, 0.62]],
          flen: [2.45, 2.65, 2.4, 1.9], glideUp: [-0.1, -0.18, -0.04], glideSweep: 0.55, mantle: { roar: 0.9, sit: 0.85, alert: 0.85, perch: 0.85, stand: 0.85, crouch: 0.35 }, mSweep: 0.18,
          fold: { elbow: [-0.34, 1.0, 0.0], wrist: [0.16, 1.45, 0.15], tips: [[-1.16, 1.3], [-1.14, 0.98], [-1.06, 0.68], [-0.9, 0.42]], off: 0.09, flare: 0.05, hipA: 0.15,
            knuckle: 0.45, knP: { crouch: 0.35, curl: 0.2 }, lift: 0.16, liftP: { curl: 0, sit: 0.4, crouch: 0.6 }, offP: { curl: 0.5 } } },
        // ear flaps, soft leaves: where on the head (along it, angle up from the side), length, width, thickness at the
        // root, the way they point [back, up, out], the way their flat face turns [out, up, forward], how far the tip curls
        // away from the face (less than 0: toward it, an upturned tip) and sweeps back, how much the edges cup and the leaf
        // twists along its length, how much bigger and broader on the young (yk, yw), and how much lighter its upper
        // face and rim (rim). The big pair rides on the back-sides of the skull and fans out sideways about 50 degrees,
        // back and a little down, a broad leaf with its face turned up and forward and its tip drooping over, so it
        // flares past the cheeks from the front and from a high camera the far one lies out to the side instead of
        // standing up like a cat's ear; its light upper face parts the near one from the black neck. The second pair
        // tucks low under it (never a second spike), the third is one broad leaf laid back along the jaw's hinge.
        ears: [
          { at: 0.08, a: 0.6, len: 1.5, w: 0.2, t: 0.08, dir: [0.78, 0.06, 0.62], face: [0.3, 0.85, 0.3], curl: 0.1, sweep: 0.1, bsw: 0.15, cup: 0.25, twist: -0.5, rim: 0.9, yk: -0.12, yw: 0.45 },
          { at: 0.19, a: 0.3, len: 0.5, w: 0.11, t: 0.055, dir: [0.6, -0.5, 0.62], face: [0.7, 0.5, 0.45], curl: -0.08, sweep: 0.04, cup: 0.16, twist: 0.1, yk: -0.05, yw: 0.4 },
          { at: 0.27, a: -0.04, len: 0.28, w: 0.068, t: 0.034, dir: [0.92, -0.05, 0.38], face: [0.85, 0.15, 0.4], curl: 0.03, sweep: 0.04, cup: 0.14, twist: 0.08, yk: 0, yw: 0.2 }
        ],
        // dorsal plates, a short row of soft rounded leaves from the nape (behind the skull, so never a peak on a round
        // young head) to the root of the tail: [station, size], spaced gap sizes apart. Ten or so, biggest behind the
        // head and over the shoulders, fading out down the tail; big enough to read as leaves, not a seam of rivets
        // (smaller curled up (poseK), so they never poke through the cloak of the wing laid close over the back)
        plates: { from: 2.84, to: 0.84, gap: 3.0, poseK: { curl: 0.5 }, size: [[0.84, 0], [0.92, 0.045], [1.05, 0.07], [1.25, 0.09], [1.6, 0.11], [2.0, 0.13], [2.45, 0.14], [2.84, 0.12]] },
        // tail fins, leaves: [station, length, width, how far out, sweep back]
        fins: [[0.04, 0.62, 0.2, 0.85, 0.9], [0.27, 0.36, 0.11, 0.85, 0.7]],
        saddle: [1.58, 1.84],
        // the body lifted [at the hips, at the shoulders] off the pose's spine: low-slung like a panther, so the legs bend
        // at the elbow and the hock and the shoulder shows over them; the neck and the head held up a little in the poses
        // where it looks about (sitting, the chest a little lower, so the forelegs stand short and sturdy under it)
        lift: { stand: [0.1, 0.04], alert: [0.1, 0.08], roar: [0.06, 0.0], perch: [0.02, -0.04], sit: [0, -0.12] },
        neckUp: { alert: 0.1, sit: 0.12, roar: 0.08 }, riddenDown: 0.2,
        // ridden, the big ear flaps shorter (by the first), turned up (less the second) and out (the third), so they sweep
        // back over the neck clear of the rider's legs, never a hood over him
        riddenEar: [0.8, 0.12, 0.1],
        // the feet where this kind holds them its own way: gliding, all four tucked back close along the belly and the
        // tail like a cat's in a leap, so nothing dangles under it and it rides clear of the ground
        feet: { glide: { fl: [0.36, -0.2, -0.5], fr: [-0.36, -0.18, -0.44], hl: [0.4, -0.08, -2.7], hr: [-0.4, -0.06, -2.76] } },
        // the tail's keys (tip first, to the one before the hips) where this kind holds it its own way: crouched, it
        // runs back to the right along the ground and the last of it curls back across behind and lifts, a cat's twitch,
        // so its fins show over the back (in the pose's own footprint, so a build's neighbours stay clear); flying, it runs straight back with its fins
        // level, so it and its fins show from above and behind
        tail: {
          crouch: [[0.3, 0.58, -3.3], [-0.3, 0.26, -3.2], [-0.92, 0.13, -2.82], [-0.95, 0.33, -2.28], [-0.4, 0.74, -1.95]],
          fly: [[0.32, 0.22, -5.05], [0.2, 0.2, -4.38], [0.1, 0.16, -3.68], [0.03, 0.11, -2.97], [0, 0.07, -2.26]],
          glide: [[-0.24, 0.12, -5.05], [-0.15, 0.11, -4.38], [-0.07, 0.09, -3.68], [-0.02, 0.07, -2.97], [0, 0.05, -2.26]]
        },
        // and the young's, blended in by age (all of it from a fledgling down): sitting, a little one curls its short
        // tail out to the side along the ground (never straight down between its legs); crouched, its tail lies flat
        tailY: { sit: [[2.45, 0.07, 0.1], [2.15, 0.08, -0.45], [1.62, 0.1, -0.88], [1.0, 0.16, -1.1], [0.42, 0.34, -1.14]],
          crouch: [[0.45, 0.1, -3.25], [-0.2, 0.1, -3.22], [-0.9, 0.12, -2.85], [-0.95, 0.32, -2.28], [-0.4, 0.74, -1.95]] },
        // the jaw opened (radians) in the poses that open it
        jaw: { roar: 0.6, alert: 0.0 }
      }
    },
    dawn: {
      name: 'Dawn dragon', col: '#eceae4', col2: '#f6f4ef', belly: '#e2ded5', mem: '#e6e3dc', bone: '#d9d5cc', eye: '#8ec3e6', claw: '#a8a49a',
      len: 1.04, ex: 2.1, belly0: 0.88, spines: 'none', ears: 'dawn', tailFins: 'dawn', wings: { span: 1.06, fingers: 4, k: 1 }, head: 'dawn', legs: 4, slim: 0.86,
      rad: [[0.03, 0.03], [0.06, 0.055], [0.1, 0.09], [0.15, 0.14], [0.2, 0.2], [0.31, 0.34], [0.38, 0.41], [0.39, 0.43], [0.4, 0.44], [0.26, 0.29], [0.22, 0.24], [0.23, 0.25]],
      // the night dragon's sister, drawn by the same loft with her own numbers (see the night's for what each means):
      // pearl white, shaded cool blue-grey so she models in the light and reads against a pale sky; sleeker and slimmer,
      // a rounder, narrower head with one pair of smooth ear flaps swept out and back, a clean back (no plates), long
      // twin tail fins and broad wings
      loft: {
        skin: '#bac2d2', skin2: '#c1c8d6', belly: '#c8ccd8', mem: '#a6abc0', memEdge: '#9aa0b8', memFold: '#4d5973', foldEdge: '#c3cad8', plate: '#9aa2ac', claw: '#4f5966', dark: '#8a94a3', pad: '#8e97a3',
        // (a soft blue-grey line down her back to the nape: see the kinds' features)
        backLine: { col: '#9ea8bc', w: 0.34, k: 0.6, st: [0.0, 2.84] },
        iris: '#93cdee', irisRim: '#3f77a0', irisIn: '#e0f5ff', mouthIn: '#5e3442', gum: '#8a6670', tooth: '#f4f2ea', lip: '#aeb4c4',
        // (roaring, a cool dark mouth behind a pale grey lip and a few bigger pointed teeth at the front)
        fangs: { n: 3, len: 0.07, from: 0.45 },
        pale: true, head: 0.84, gMax: 0.12, headS: 1.24, snoutCap: 0.13, neck: 0.86, trunk: 0.9, headFloor: 0.01, floorStraps: true,
        neckP: { alert: 0.74, sit: 0.8, roar: 0.84, perch: 0.9 },
        // (the night's rings drawn slimmer through the body and the tail, the chest still deep under the shoulders and the
        // waist tucked in behind it, so she swells and narrows like her brother rather than running on as one tube; the
        // head a little narrower than his but as big on her (headS), its skull a smooth, low, rounded dome, never a lamb's
        // tall brow, the snout drawn finer and lower to a soft flat-topped wedge with a rounded tip, the throat slim under
        // the jaw, a soft brow over each eye and a cheek plane behind it to catch the light)
        prof: [
          [0.00, 0.022, 0.023, 0.019, 2, 0, 0, 0, 0, 0, 0, 0], [0.08, 0.044, 0.044, 0.038, 2, 0.004, 0, 0, 0, 0, 0, 0],
          [0.25, 0.075, 0.078, 0.063, 2.1, 0.008, 0, 0, 0, 0, 0, 0], [0.45, 0.111, 0.118, 0.094, 2.2, 0.012, 0, 0, 0, 0, 0, 0],
          [0.65, 0.158, 0.168, 0.135, 2.25, 0.013, 0, 0, 0, 0, 0, 0], [0.82, 0.227, 0.247, 0.197, 2.3, 0.011, 0, 0, 0.015, 0, 0, 0],
          [0.94, 0.288, 0.335, 0.27, 2.3, 0.007, 0, 0, 0.045, 0, 0, 0], [1.05, 0.315, 0.372, 0.279, 2.3, 0.006, 0, 0, 0.056, 0, 0, 0],
          [1.18, 0.306, 0.36, 0.235, 2.25, 0.005, 0, 0, 0.041, 0, 0, 0], [1.33, 0.262, 0.352, 0.198, 2.2, 0.005, 0, 0, 0.009, 0, 0, 0],
          [1.50, 0.28, 0.381, 0.285, 2.15, 0.005, 0, 0, 0, 0, 0, 0], [1.68, 0.32, 0.42, 0.485, 2.05, 0.005, 0.014, 0, 0, 0, 0, 0],
          [1.84, 0.338, 0.432, 0.525, 2, 0.004, 0.035, 0.032, 0, 0, 0, 0], [1.98, 0.338, 0.428, 0.495, 2, 0.003, 0.035, 0.042, 0, 0, 0, 0],
          [2.15, 0.324, 0.409, 0.44, 2, 0.003, 0.014, 0.036, 0, 0, 0, 0], [2.45, 0.276, 0.344, 0.31, 2.05, 0.004, 0, 0, 0, 0, 0, 0],
          [2.72, 0.232, 0.277, 0.25, 2.05, 0.003, 0, 0, 0, 0, 0, 0], [2.88, 0.22, 0.252, 0.222, 2.05, 0.004, 0, 0, 0, 0, 0, 0],
          [2.97, 0.24, 0.265, 0.228, 2.05, 0, 0, 0, 0, 0, 0.002, 0], [3.05, 0.29, 0.3, 0.25, 2.05, 0, 0, 0, 0, 0, 0.022, 0],
          [3.13, 0.322, 0.33, 0.262, 2.08, 0, 0, 0, 0, 0, 0.032, 0], [3.24, 0.335, 0.35, 0.262, 2.1, 0, 0, 0, 0, 0.01, 0.034, 0],
          [3.36, 0.333, 0.345, 0.25, 2.1, 0, 0, 0, 0, 0.026, 0.022, 0], [3.47, 0.31, 0.318, 0.232, 2.1, 0, 0, 0, 0, 0.034, 0.008, 0.006],
          [3.57, 0.282, 0.272, 0.212, 2.1, 0, 0, 0, 0, 0.028, 0, 0.014], [3.67, 0.24, 0.215, 0.185, 2.15, 0, 0, 0, 0, 0.01, 0, 0.018],
          [3.79, 0.208, 0.165, 0.158, 2.2, 0, 0, 0, 0, 0, 0, 0.02], [3.90, 0.185, 0.138, 0.138, 2.25, 0, 0, 0, 0, 0, 0, 0.018],
          [4.00, 0.164, 0.118, 0.12, 2.25, 0, 0, 0, 0, 0, 0, 0.014]
        ],
        sho: [[1.72, 0], [1.9, 0.085], [2.06, 0.1], [2.28, 0.045], [2.42, 0]],
        // (only a faint keel under her chest, so the pale breast shows no seam)
        keel: 0.3, chinY: 0.32,
        // (the young's head: a big round dome, a little wider than it is tall (never a beluga's or a lamb's tall egg),
        // over a short, soft, rounded muzzle with no ridge down it, and under it a full throat that the chin flows into,
        // so the head never sits on the body like a ball on a collar)
        profY: [
          [2.92, 0.29, 0.27, 0.33, 2, 0, 0, 0, 0, 0, 0, 0], [3.00, 0.325, 0.3, 0.345, 2, 0, 0, 0, 0, 0, 0.006, 0],
          [3.10, 0.385, 0.36, 0.33, 2, 0, 0, 0, 0, 0, 0.015, 0], [3.22, 0.425, 0.415, 0.28, 2, 0, 0, 0, 0, 0, 0.018, 0],
          [3.35, 0.445, 0.45, 0.261, 2, 0, 0, 0, 0, 0.006, 0.013, 0], [3.47, 0.43, 0.455, 0.232, 2, 0, 0, 0, 0, 0.012, 0.006, 0],
          [3.58, 0.375, 0.44, 0.206, 2, 0, 0, 0, 0, 0.01, 0, 0.006], [3.68, 0.315, 0.385, 0.188, 2.1, 0, 0, 0, 0, 0, 0, 0.01],
          [3.79, 0.27, 0.29, 0.163, 2.2, 0, 0, 0, 0, 0, 0, 0.01], [3.90, 0.215, 0.218, 0.138, 2.25, 0, 0, 0, 0, 0, 0, 0.008],
          [4.00, 0.162, 0.155, 0.118, 2.25, 0, 0, 0, 0, 0, 0, 0.006]
        ],
        // (her eyes big, set up on the front of the face and turned well forward like a cat's, under a soft brow, the upper
        // lid a little lower than her brother's: a calm, almond look rather than a frog's bulging stare or a sheep's eyes
        // on the sides of its head; the pupil kept near the middle of the eye that shows (gMax), so looking at you she
        // never goes cross-eyed; a long mouth curving up into its corner, and small nostrils)
        eye: [0.55, 0.52, 0.138, 0.48, 0.05], lid: [0.6, -0.6], lidDrop: { sit: 0.3, curl: 0.42 }, nose: [0.94, 1.25, 0.014], mouth: [0.42, -0.06, 0.15, 0.28],
        // (her legs the night's, a little slimmer and drawn in finer above the wrist and the ankle so the joints read,
        // blended into her body by broad fillets (fil) so her pale hide shows no seam at the shoulder or the hip; the
        // foreleg a soft muscle in front of the upper arm, a clear knob at the elbow, the forearm full under it and
        // tapering to a slim wrist, and shorter than his, so it reads as a limb and not a white stilt; over them the
        // chest swells into a soft pectoral each side (the chest column of prof) so the breast is never a plain column)
        fore: { st: 1.98, at: [0.78, -0.15], len: [0.7, 0.45], paw: [0.14, 0.066, 0.105], toe: [0.145, 0.045, 0.052], fil: 1.0,
          prof: [[0, 0.276, 0.355, 0, 0, 2.0], [0.3, 0.239, 0.288, 0.03, 0, 2.0], [0.7, 0.172, 0.2, 0.016, 0, 2.0], [1, 0.165, 0.168, 0, 0.11, 2.1], [1.22, 0.16, 0.172, 0.04, 0.012, 2.1], [1.6, 0.11, 0.115, 0.01, 0, 2.0], [2, 0.077, 0.082, 0, 0, 2.0], [2.5, 0.106, 0.08, 0, 0, 2.2], [3, 0.148, 0.07, 0, 0, 2.6], [4, 0.138, 0.057, 0, 0, 2.6]] },
        hind: { st: 1.06, at: [0.84, 0.02], len: [0.64, 0.55], paw: [0.145, 0.068, 0.115], toe: [0.15, 0.047, 0.056], fil: 1.0,
          prof: [[0, 0.297, 0.413, 0, 0, 2.2], [0.3, 0.267, 0.366, 0.023, 0, 2.2], [0.65, 0.219, 0.289, 0.012, 0, 2.1], [1, 0.148, 0.17, 0.029, 0, 2.1], [1.3, 0.148, 0.174, 0, 0.038, 2.1], [1.75, 0.086, 0.1, 0, 0.012, 2.0], [2, 0.073, 0.082, 0, 0.034, 2.0], [2.5, 0.075, 0.075, 0, 0, 2.0], [3, 0.154, 0.071, 0, 0, 2.6], [4, 0.143, 0.057, 0, 0, 2.6]] },
        // (broad, graceful wings: the night's a little longer in the fingers, the trailing edge scalloped deeper
        // between them, the bones and the trailing edge a cool grey (boneOpen, memEdge) that draws the white membrane;
        // folded, one smooth cloak a full value step darker and cooler than the hide (memFold, taken by the arm and the
        // fingers too: arm), so a white dragon at rest still shows a wing at a glance: barely pleated, its scallops
        // tucked under into one clean, narrow, paler lower edge (edgeLow) and no pale top edge (edgeTop), the knuckle
        // riding clearly over the back's line, and on the young only a soft knuckle (knY); opened on the ground in a
        // crouch she holds them well up (mantle), two broad sails from the front rather than a pair of edge-on scythes)
        wing: { st: 1.86, a: 1.0, hip: 1.12, span: 1.02,
          elbow: [0.85, 0.3, 0.14], wrist: [1.78, 0.44, -0.18], fing: [[0.97, 0.6, -0.16], [0.76, 0.5, 0.62], [0.4, 0.3, 0.95], [0.0, 0.15, 1]],
          mElbow: [0.66, 0.5, 0.2], mWrist: [1.3, 0.88, 0.6], mFing: [[0.17, 0.79, 0.59], [0.77, 0.51, 0.39], [1.0, -0.07, -0.05], [0.6, -0.5, 0.62]],
          flen: [2.5, 2.74, 2.5, 2.0], glideUp: [-0.1, -0.18, -0.04], glideSweep: 0.55, mantle: { roar: 0.9, sit: 0.85, alert: 0.85, perch: 0.85, stand: 0.85, crouch: 0.7 }, mSweep: 0.18, scallop: 0.48, boneOpen: '#9aa0b8',
          fold: { elbow: [-0.34, 1.0, 0.0], wrist: [0.16, 1.36, 0.15], tips: [[-1.16, 1.42], [-1.14, 1.06], [-1.06, 0.72], [-0.9, 0.42]], off: 0.09, flare: 0.05, hipA: 0.15,
            knuckle: 0.6, knP: { crouch: 0.35, curl: 0.2 }, knY: 0.25, lift: 0.14, liftP: { curl: 0, sit: 0.4, crouch: 0.6 }, offP: { curl: 0.5 }, scallop: 0, pleat: 0.004, edgeTop: 0.1, edgeLow: [0.7, 0.82], arm: 0.75 } },
        // one pair of smooth ear flaps (no second pair), slim pointed leaves set low on the back of the skull and swept
        // back along the line of the neck, a little out and their tips turned up, their faces turned out and up: from the
        // front two blades behind the cheeks, from the side lying back along the neck, from above two leaves breaking
        // the head's outline, never a lamb's lop ears or a cat's pricked ones; the young's broader and softer, set up and
        // back (yUp, yBack) so two soft leaves rise behind the dome
        ears: [
          { at: 0.08, a: 0.42, len: 0.95, w: 0.085, t: 0.05, dir: [0.9, -0.1, 0.44], face: [0.5, 0.86, 0.1], curl: -0.12, sweep: 0.06, bsw: 0.15, cup: 0.2, twist: -0.3, rim: 0.6, yk: 0.25, yw: 0.55, yUp: 0.45, yBack: 0.4, level: 0.75 }
        ],
        // her twin tail fins: long narrow swept blades (shorter than her head and neck, never a fish's fluke), narrow at
        // the root, broadest a third of the way out and drawn to a fine point that curves back (finW: the outline, see the kinds' features), the second pair a smaller echo of
        // the first; thin to a knife edge and cambered (finT, finCup), held level and spread wide in the air (finAir),
        // lying draped flat on the ground when she rests (finDrape), and on the young shorter, softer rounded leaves
        // (finYk)
        fins: [[0.03, 1.1, 0.14, 0.42, 2.4], [0.24, 0.56, 0.08, 0.5, 1.6]], finW: [0.42, 0.34, 1.5],
        finT: 0.014, finCup: 0.1, finDrape: 1, finYk: 0.65, finAir: { lift: 0.02, out: 2.0 },
        saddle: [1.58, 1.84],
        lift: { stand: [0.1, 0.04], alert: [0.1, 0.08], roar: [0.06, 0.0], perch: [0.02, -0.04], sit: [0, -0.12] },
        neckUp: { alert: 0.1, sit: 0.12, roar: 0.08 }, riddenDown: 0.2, riddenEar: [0.85, 0.12, 0.1],
        feet: { glide: { fl: [0.36, -0.2, -0.5], fr: [-0.36, -0.18, -0.44], hl: [0.4, -0.08, -2.7], hr: [-0.4, -0.06, -2.76] } },
        // (standing alert, her tail sweeps out to her left and curls forward round her hip like a cat's, its fins lying
        // flat on the ground beside her where they show their outline; crouched it curls out to her right and back with
        // its end along the ground, and perched it trails out behind her along the ground, so in both the fins drape on
        // the grass rather than standing up off the tip like a forked twig)
        tail: {
          alert: [[2.2, 0.1, -2.25], [1.95, 0.11, -2.8], [1.3, 0.14, -3.05], [0.75, 0.27, -2.6], [0.25, 0.55, -2.1]],
          crouch: [[0.45, 0.06, -3.3], [-0.22, 0.07, -3.25], [-0.88, 0.12, -2.85], [-0.95, 0.33, -2.28], [-0.4, 0.74, -1.95]],
          perch: [[-1.0, 0.05, -4.45], [-0.85, 0.06, -3.9], [-0.65, 0.1, -3.35], [-0.45, 0.16, -2.8], [-0.18, 0.38, -2.25]],
          fly: [[0.32, 0.22, -5.05], [0.2, 0.2, -4.38], [0.1, 0.16, -3.68], [0.03, 0.11, -2.97], [0, 0.07, -2.26]],
          glide: [[-0.24, 0.12, -5.05], [-0.15, 0.11, -4.38], [-0.07, 0.09, -3.68], [-0.02, 0.07, -2.97], [0, 0.05, -2.26]]
        },
        tailY: { sit: [[2.45, 0.07, 0.1], [2.15, 0.08, -0.45], [1.62, 0.1, -0.88], [1.0, 0.16, -1.1], [0.42, 0.34, -1.14]],
          crouch: [[0.45, 0.1, -3.25], [-0.2, 0.1, -3.22], [-0.9, 0.12, -2.85], [-0.95, 0.32, -2.28], [-0.4, 0.74, -1.95]] },
        jaw: { roar: 0.6, alert: 0.0 }
      }
    },
    boulder: {
      name: 'Boulder dragon', col: '#565553', col2: '#636260', belly: '#77736b', mem: '#5d5c59', bone: '#4f4e4b', eye: '#e9d9a0', claw: '#3b3a38',
      len: 0.34, ex: 2.0, belly0: 0.92, spines: 'knobs', ears: 'none', tailFins: 'club', bumps: true, wings: { span: 0.42, fingers: 3, k: 0.7 }, head: 'boulder', legs: 4, stout: true,
      rad: [[0.16, 0.16], [0.2, 0.2], [0.24, 0.23], [0.3, 0.3], [0.42, 0.42], [0.68, 0.66], [0.82, 0.8], [0.84, 0.82], [0.78, 0.76], [0.5, 0.5], [0.44, 0.44], [0.42, 0.42]],
      // heavy, round and lovable: a barrel of a body slung low on short thick legs, almost no neck, a big blunt head with
      // a wide jaw and an underbite, two small tusks showing with the mouth shut, small eyes under heavy brows, a knobbly
      // rocky hide (lumps grown out of the back, the shoulders and the brow), a short tail ending in a knobbed club, and
      // small stubby rounded wings of three fingers; stone grey-brown, mottled, over a lighter warmer belly
      loft: {
        skin: '#393836', skin2: '#45433f', belly: '#a28c68', mem: '#4a3428', memEdge: '#9c7b5c', memFold: '#4a382c', foldEdge: '#a08a70', plate: '#4f4d4a', claw: '#2a2826', dark: '#121110', pad: '#55524d',
        iris: '#c9a046', irisRim: '#5a4318', irisIn: '#f0da8a', mouthIn: '#3e211e', gum: '#4a2a26', tooth: '#e8e0cb',
        head: 0.8, headS: 1.14, snoutCap: 0.17, dome: 0.55, neck: 0.42, trunk: 0.56, tipCap: 0.13, stance: 1.2, skinStep: [[0, 0.07], [0.26, 0.042], [2.8, 0.042], [2.88, 0.021]], skinN: 72, skinSoft: [2, 0.5], jawBelly: 0.25, tailRaise: 0.3, headFloor: 0.01, floorStraps: true,
        neckP: { alert: 0.9, sit: 0.9, roar: 0.95, perch: 0.95 },
        // (a barrel: broad and deep from the hips to the shoulders, squarish; the tail short and thick, drawn in to a
        // narrow wrist before the club at its end; the neck as thick as the head; the head broad and boxy, its brows
        // heavy, the muzzle broad and blunt and the lower jaw fuller than the upper (jaw < 0))
        prof: [
          [0.00, 0.14, 0.13, 0.12, 2.2, 0, 0, 0, 0, 0, 0, 0], [0.07, 0.23, 0.18, 0.16, 2.3, 0, 0, 0, 0, 0, 0, 0],
          [0.15, 0.25, 0.19, 0.17, 2.3, 0, 0, 0, 0, 0, 0, 0], [0.24, 0.19, 0.15, 0.14, 2.2, 0, 0, 0, 0, 0, 0, 0],
          [0.32, 0.13, 0.13, 0.12, 2.1, 0, 0, 0, 0, 0, 0, 0], [0.45, 0.18, 0.18, 0.16, 2.1, 0, 0, 0, 0, 0, 0, 0],
          [0.62, 0.29, 0.29, 0.25, 2.15, 0, 0, 0, 0, 0, 0, 0], [0.78, 0.41, 0.41, 0.36, 2.2, 0, 0, 0, 0.03, 0, 0, 0],
          [0.90, 0.51, 0.52, 0.46, 2.2, 0, 0, 0, 0.09, 0, 0, 0], [1.02, 0.58, 0.6, 0.54, 2.15, 0, 0, 0, 0.12, 0, 0, 0],
          [1.18, 0.62, 0.66, 0.61, 2.1, 0, 0, 0, 0.07, 0, 0, 0], [1.38, 0.64, 0.7, 0.65, 2.05, 0, 0, 0, 0, 0, 0, 0],
          [1.60, 0.64, 0.69, 0.66, 2.0, 0, 0.02, 0, 0, 0, 0, 0], [1.80, 0.61, 0.64, 0.63, 2.0, 0, 0.05, 0.03, 0, 0, 0, 0],
          [1.98, 0.57, 0.57, 0.58, 2.05, 0, 0.05, 0.04, 0, 0, 0, 0], [2.15, 0.52, 0.51, 0.51, 2.1, 0, 0.02, 0.03, 0, 0, 0, 0],
          [2.45, 0.49, 0.48, 0.5, 2.2, 0, 0, 0, 0, 0, 0, 0], [2.72, 0.45, 0.43, 0.5, 2.2, 0, 0, 0, 0, 0, 0, 0],
          [2.88, 0.42, 0.41, 0.46, 2.25, 0, 0, 0, 0, 0, 0, 0], [2.97, 0.39, 0.38, 0.36, 2.3, 0, 0, 0, 0, 0, 0.01, 0],
          [3.06, 0.41, 0.4, 0.38, 2.35, 0, 0, 0, 0, 0, 0.04, -0.01], [3.16, 0.42, 0.43, 0.4, 2.4, 0, 0, 0, 0, 0, 0.07, -0.02],
          [3.28, 0.42, 0.45, 0.42, 2.45, 0, 0, 0, 0, 0, 0.08, -0.03], [3.40, 0.405, 0.44, 0.43, 2.5, 0, 0, 0, 0, 0.07, 0.06, -0.045],
          [3.52, 0.38, 0.4, 0.435, 2.55, 0, 0, 0, 0, 0.12, 0.03, -0.06], [3.64, 0.355, 0.34, 0.43, 2.6, 0, 0, 0, 0, 0.1, 0.01, -0.07],
          [3.76, 0.33, 0.28, 0.42, 2.6, 0, 0, 0, 0, 0.04, 0, -0.07], [3.87, 0.305, 0.24, 0.4, 2.5, 0, 0, 0, 0, 0, 0, -0.065],
          [3.95, 0.28, 0.21, 0.37, 2.35, 0, 0, 0, 0, 0, 0, -0.05], [4.00, 0.245, 0.175, 0.32, 2.2, 0, 0, 0, 0, 0, 0, -0.03]
        ],
        sho: [[1.7, 0], [1.88, 0.11], [2.04, 0.14], [2.24, 0.06], [2.4, 0]],
        keel: 0, chinY: 0.4,
        // (the young: a round ball of a head, a broad soft muzzle)
        profY: [
          [2.92, 0.4, 0.36, 0.48, 2.0, 0, 0, 0, 0, 0, 0, 0], [3.00, 0.42, 0.39, 0.45, 2.0, 0, 0, 0, 0, 0, 0.01, 0],
          [3.10, 0.44, 0.44, 0.4, 2.0, 0, 0, 0, 0, 0, 0.025, 0], [3.22, 0.46, 0.49, 0.35, 2.0, 0, 0, 0, 0, 0, 0.03, 0],
          [3.35, 0.47, 0.51, 0.33, 2.0, 0, 0, 0, 0, 0.01, 0.02, 0], [3.47, 0.46, 0.5, 0.32, 2.0, 0, 0, 0, 0, 0.02, 0.01, 0],
          [3.58, 0.44, 0.46, 0.34, 2.05, 0, 0, 0, 0, 0.012, 0, 0], [3.68, 0.41, 0.41, 0.33, 2.1, 0, 0, 0, 0, 0, 0, -0.01],
          [3.79, 0.38, 0.35, 0.31, 2.15, 0, 0, 0, 0, 0, 0, -0.01], [3.90, 0.34, 0.29, 0.28, 2.2, 0, 0, 0, 0, 0, 0, -0.01],
          [4.00, 0.29, 0.23, 0.24, 2.2, 0, 0, 0, 0, 0, 0, -0.008]
        ],
        // (small eyes high under the brow, a sleepy heavy lid; big nostrils; a long straight mouth)
        eye: [0.58, 0.86, 0.097, 0.55, 0.15], eyeOut: 0.1, lid: [0.24, -0.62], lidDrop: { sit: 0.15, curl: 0.3 }, nose: [0.88, 1.2, 0.045], noseCap: true, noseRim: [0.6, 0.8, 1.4, 0.92], mouth: [0.26, 0.04, 0.06, 0.55], pupil: [0.3, 0.34], eyeRim: [0.8, 0.25], faceY: { eye: [0.56, 0.68], nose: [0.9, 1.22, 0.03], eyeOut: 0.14, eyeR: 0.12, lid: 0.6 }, lipCrease: [0.03, -0.014],
        // the lower jaw jutting forward past the upper, a little
        underbite: [0.14, 0.4],
        // short, thick legs on broad paws
        fore: { st: 1.96, at: [0.68, -0.38], len: [0.36, 0.3], paw: [0.19, 0.08, 0.13], toe: [0.13, 0.062, 0.05], fil: 0.85,
          prof: [[0, 0.34, 0.42, 0, 0, 2.1], [0.3, 0.29, 0.34, 0.03, 0, 2.1], [0.7, 0.23, 0.26, 0.015, 0, 2.1], [1, 0.2, 0.22, 0, 0.06, 2.1], [1.3, 0.21, 0.22, 0.03, 0, 2.1], [1.75, 0.18, 0.18, 0, 0, 2.0], [2, 0.16, 0.15, 0, 0, 2.0], [2.5, 0.17, 0.11, 0, 0, 2.2], [3, 0.2, 0.085, 0, 0, 2.6], [4, 0.18, 0.07, 0, 0, 2.6]] },
        hind: { st: 1.08, at: [0.72, -0.28], len: [0.36, 0.3], hock: [0.2, 0.12], paw: [0.19, 0.08, 0.13], toe: [0.13, 0.062, 0.05], fil: 0.85,
          prof: [[0, 0.34, 0.44, 0, 0, 2.2], [0.3, 0.3, 0.38, 0.03, 0, 2.2], [0.65, 0.24, 0.29, 0.015, 0, 2.1], [1, 0.18, 0.2, 0.03, 0, 2.1], [1.3, 0.17, 0.19, 0, 0.04, 2.1], [1.75, 0.14, 0.14, 0, 0.012, 2.0], [2, 0.13, 0.13, 0, 0.03, 2.0], [2.5, 0.13, 0.11, 0, 0, 2.0], [3, 0.19, 0.08, 0, 0, 2.6], [4, 0.17, 0.066, 0, 0, 2.6]] },
        // short broad wings of three fingers on a thick fleshy arm, rooted high on the shoulders: rounded fans whose
        // three finger bones stand as ribs in the leather (fingR) with shallow cusps between them (scallop), that look
        // able to lift the weight; at rest held open out to the sides (mantle), gliding in a shallow V (glideUp), flying
        // on a strong upstroke (flap), their membrane's panels each wound to face the sky (faceUp 'panel') and its trailing
        // edge meeting the body high on the flank (hipUp), so no dark sail hangs from the root. Folded, a
        // compact rounded bud on top of each shoulder, its wrist's knuckle riding over the spine's line and its upper
        // edge lifted clear of the back (lift), so the wings read on the resting dragon even far off
        wing: { st: 1.7, a: 1.25, hip: 1.42, hipUp: 0.9, span: 0.7, faceUp: 'panel', flap: 0.55, fingR: 1.9, arm: { k: [2.2, 2.6, 2.0], fold: 0.45, fil: 0.1, upto: 0.7, deep: 0.12 },
          elbow: [0.45, 0.25, 0.2], wrist: [0.85, 0.35, 0.0], fing: [[0.9, 0.3, -0.25], [0.8, 0.15, 0.45], [0.35, 0.05, 0.95]],
          mElbow: [0.6, 0.25, 0.1], mWrist: [1.05, 0.4, 0.2], mFing: [[0.9, 0.3, 0.25], [0.5, 0.55, 0.65], [0.1, 0.6, 0.8]],
          flen: [1.8, 1.9, 1.5], glideUp: [0.08, 0.14, 0.06], glideSweep: 0.2, mantle: { roar: 0.85, sit: 0.85, alert: 0.85, perch: 0.85, stand: 0.85, crouch: 0.35 }, mSweep: 0, scallop: 0.13,
          fold: { elbow: [-0.2, 1.1, 0.05], wrist: [0.12, 1.45, 0.18], tips: [[-0.4, 1.47], [-0.46, 1.2], [-0.38, 0.92]], off: 0.1, flare: 0.03, puff: 0.15, smooth: true, hipA: 1.1,
            // (the young's short wing folded small and standing up on top of the shoulder: a round bud seen from the front)
            y: { elbow: [-0.12, 1.0, 0.0], wrist: [0.06, 1.25, 0.06], tips: [[-0.26, 1.36], [-0.3, 1.12], [-0.24, 0.9]], off: 0.07, edge: 0.3 },
            knuckle: 0.6, knP: { crouch: 0.35, curl: 0.2 }, lift: 0.06, liftP: { curl: 0, sit: 0.4, crouch: 0.6 }, offP: { curl: 0.5 } } },
        // the rocky hide, laid out on the anatomy: the biggest rocks along the spine and crowning the shoulders and the
        // haunches, stones of every size between them, fewer and smaller down the flanks to a smooth belly (each run kept
        // clear of the bigger ones before it, so stones sit between rocks, never on them); their tops worn lighter (hi)
        // and their feet dark in the crevices (lo), so they read as stone grown out of the hide
        lumps: { seed: 11, yk: 0.5, hi: '#8c8a83', hiK: 0.45, hiH: 0.08, lo: '#2b2722', loK: 0.6, lut: true, runs: [
          // the spine: a row of big crowned rocks from the nape over the shoulders and down the back (left bare under a
          // saddle), smaller over the rump and on down the top of the tail
          { st: [0.95, 2.72], a: [1.5, 1.5708], n: 40, size: [0.09, 0.13], h: [1.0, 1.3], p: 2.4, sep: [0.2, 1.0], bare: true, yk: 0.8 },
          { st: [0.3, 0.95], a: [1.45, 1.5708], n: 20, size: [0.06, 0.1], h: [0.85, 1.05], p: 3.5, sep: [0.15, 1.0] },
          // a few big rocks crowning the shoulders and the haunches each side, some grown in pairs
          { st: [1.72, 2.4], a: [0.55, 1.15], n: 16, size: [0.1, 0.14], h: [0.9, 1.15], p: 2.5, sep: [0.26, 0.45], clear: 1.05, twin: [0.5, 0.55] },
          { st: [0.82, 1.32], a: [0.35, 1.1], n: 16, size: [0.1, 0.14], h: [0.9, 1.15], p: 2.5, sep: [0.24, 0.45], clear: 1.05, twin: [0.5, 0.55] },
          // stones between them, of every size, thinning and shrinking down the flanks toward the smooth belly
          { st: [0.55, 2.6], a: [0.6, 1.45], n: 110, size: [0.055, 0.085], h: [0.85, 1.1], p: 2.2, sep: [0.11, 0.28], clear: 1.0, twin: [0.3, 0.6] },
          { st: [0.75, 2.45], a: [0.05, 0.75], n: 140, size: [0.04, 0.06], h: [0.75, 1.0], p: 2.2, sep: [0.09, 0.22], clear: 1.0 },
          { st: [0.85, 2.3], a: [-0.45, 0.1], n: 60, size: [0.03, 0.045], h: [0.6, 0.8], p: 2.2, sep: [0.12, 0.36], clear: 1.1 },
          // warts over the brow and the skull, and on the cheeks
          { st: [3.04, 3.5], a: [1.3, 1.5708], n: 10, size: [0.06, 0.09], h: [0.4, 0.55], p: 2.5, sep: [0.13, 0.42] },
          { st: [3.46, 3.62], a: [1.05, 1.2], n: 4, size: [0.07, 0.09], h: [0.45, 0.6], p: 2.2, sep: [0.08, 0.2], yk: 0.9 },
          { st: [3.68, 3.92], a: [0.3, 0.72], n: 5, size: [0.04, 0.06], h: [0.5, 0.7], p: 2.5, sep: [0.08, 0.3] },
          { st: [3.45, 3.85], a: [-0.75, -0.3], n: 6, size: [0.04, 0.06], h: [0.4, 0.6], p: 2.5, sep: [0.1, 0.3] },
          { st: [3.8, 3.8], a: [0.85, 0.85], n: 1, size: [0.1, 0.1], h: [0.45, 0.45], p: 2 },
          { st: [3.85, 3.85], a: [-0.22, -0.22], n: 1, size: [0.055, 0.055], h: [0.6, 0.6], p: 2 },
          { st: [3.12, 3.3], a: [-0.45, 0.1], n: 6, size: [0.05, 0.08], h: [0.3, 0.5], p: 2.5, sep: [0.08, 0.3] },
          // the tail's sides, and knobs all round the club
          { st: [0.3, 0.8], a: [0.1, 1.2], n: 14, size: [0.035, 0.06], h: [0.4, 0.6], p: 3, sep: [0.1, 0.4], clear: 1.0 },
          { st: [0.02, 0.24], a: [-1.5708, 1.5708], n: 30, size: [0.04, 0.09], h: [0.45, 0.8], p: 1.8, sep: [0.06, 0.45], twin: [0.4, 0.6] }
        ] },
        // stone mottling: soft, low patches of darker and lighter grain, felt as stone rather than read as blotches, so
        // the big shapes survive across a build
        stone: { cols: ['#2e2c29', '#6f6c66'], scale: 1.5, k: [0.4, 0.3] },
        // the belly's warm sand carried up the flanks to about their middle, with a wandering edge, and under the
        // throat and the jaw, so it shows from the side and three-quarters and a cast shadow under the chin falls on a
        // light surface
        band: { col: '#bea279', col2: '#7c6e59', edge: 0.08, soft: 0.28, wave: 0.12, st: [[0.3, 0], [0.7, 0.9], [1.0, 1], [3.0, 1], [3.25, 0.35], [3.5, 0.1]] },
        // two small ivory tusks up from the lower lip near its front, rooted in a swelling of the gum, in front of the
        // upper lip; a pair of blunt knob-horns at the back of the skull; and knobs round the club
        spikes: [
          { st: [3.86, 3.86], a: [0], lip: 0.012, len: 0.16, w: 0.3, taper: 0.6, flare: 0.1, sides: 10, rings: 8, dir: [-0.2, 0.35, 1, 0.35], curl: -0.35, col: '#ad9c78', tip: '#d6c79f', tipK: 0.3, sink: 0.5, yk: 0.3 },
          // a pair of blunt knob-horns at the back of the skull, short and thick, swept back and a little out, so the
          // head's outline breaks into a dragon's even far off
          { st: [3.12, 3.12], a: [0.85], len: 0.25, w: 0.48, taper: 0.5, sides: 10, flare: 0.3, dir: [1, 0.25, 0.05, 0.25], curl: 0.3, col: '#4f4940', tip: '#8d8473', tipK: 0.5, yk: 0.25, rings: 6 },
          // a few round knobs of stone of different sizes grown out of the club, low domes with their tops worn lighter:
          // a big one crowning it, a pair high on its sides, smaller ones low and behind
          { st: [0.14, 0.14], a: [1.5708], len: 0.12, w: 0.8, taper: 0.25, flare: 0.45, sink: 0.6, sides: 10, dir: [0.2, 1, 0, 0], col: '#4c4238', tip: '#7a7164', tipK: 0.45, yk: 0.3 },
          { st: [0.1, 0.1], a: [0.85], len: 0.095, w: 0.8, taper: 0.25, flare: 0.45, sink: 0.6, sides: 10, dir: [0.15, 1, 0, 0], col: '#4c4238', tip: '#7a7164', tipK: 0.45, yk: 0.3 },
          { st: [0.19, 0.19], a: [0.15], len: 0.07, w: 0.8, taper: 0.25, flare: 0.45, sink: 0.6, sides: 10, dir: [0.3, 1, 0, 0], col: '#4c4238', tip: '#7a7164', tipK: 0.45, yk: 0.3 },
          { st: [0.04, 0.04], a: [0.45], len: 0.06, w: 0.8, taper: 0.25, flare: 0.45, sink: 0.6, dir: [0.6, 1, 0, 0], col: '#4c4238', tip: '#7a7164', tipK: 0.45, yk: 0.3 }
        ],
        saddle: [1.45, 1.8],
        // (slung low: the hips and the shoulders held below the pose's spine, so the short legs reach the ground)
        // (in the air the chest held a little higher than the hips, nose up, so the wings are seen to carry it)
        lift: { stand: [-0.08, -0.06], alert: [-0.06, -0.03], roar: [-0.1, -0.06], perch: [-0.12, -0.12], sit: [-0.05, -0.18], crouch: [-0.24, -0.1], fly: [0, 0.16], glide: [0, 0.1] },
        // in the air the fore paws drawn up under the chest and the hind legs tucked back along the belly, the feet
        // trailing, so nothing dangles; the short tail carried level with the back and the club lifted behind
        feet: { fly: { fl: [0.38, -0.3, 0.92], fr: [-0.38, -0.28, 0.98], hl: [0.44, -0.24, -2.05], hr: [-0.44, -0.22, -2.1] },
          glide: { fl: [0.36, -0.22, 0.86], fr: [-0.36, -0.2, 0.9], hl: [0.42, -0.14, -2.2], hr: [-0.42, -0.12, -2.25] } },
        tail: { fly: [[0, 0.3, -5.0], [0, 0.23, -4.35], [0, 0.15, -3.65], [0, 0.1, -2.95], [0, 0.07, -2.25]],
          glide: [[0, 0.26, -5.0], [0, 0.2, -4.35], [0, 0.13, -3.65], [0, 0.09, -2.95], [0, 0.06, -2.25]] },
        neckUp: { alert: 0.08, sit: 0.06, roar: 0.06 }, neckUpY: -0.1, neckY: 0.1, riddenDown: 0.1,
        jaw: { roar: 0.5, alert: 0.0 },
        // a thick tongue in the open mouth
        tongue: { w: 0.62, h: 0.75, from: 0.08, to: 0.72, col: '#74403a' },
        // a full row of short, blunt, flat-topped teeth for crushing rock
        teeth: { n: 9, len: 1.15, w: 0.7, blunt: 0.6 }
      }
    },
    ember: {
      name: 'Ember dragon', col: '#232224', col2: '#2b2a2c', belly: '#c95a1f', mem: '#3a2a24', bone: '#1d1c1e', eye: '#f2b33d', claw: '#d9d2c4',
      len: 1.22, ex: 2.2, belly0: 0.84, spines: 'big', ears: 'none', horns: 'ember', tailFins: 'spikes', wings: { span: 1.12, fingers: 4, k: 1.05, claws: true }, head: 'ember', legs: 4, bellyCol: true, slim: 0.9,
      rad: [[0.03, 0.03], [0.06, 0.06], [0.1, 0.1], [0.15, 0.15], [0.21, 0.21], [0.33, 0.36], [0.4, 0.43], [0.41, 0.45], [0.42, 0.46], [0.24, 0.27], [0.2, 0.22], [0.22, 0.24]],
      // long, lean and fierce: a long sinuous neck and tail, a long head with a strong jaw and heavy brows, a pair of big
      // horns swept back off the skull, spines on the cheeks and along the jaw, a row of tall blades down the neck and
      // the back, a hooked claw on each wing's leading edge, a spiked tail end; charcoal hide over an ember-orange belly,
      // the wings' membranes edged in orange, amber eyes
      loft: {
        skin: '#2a2421', skin2: '#342c28', belly: '#2e2420', mem: '#5e2a1c', memEdge: '#e0621e', memFold: '#211a17', foldEdge: '#c4531c', plate: '#2a2526', claw: '#3a3330', dark: '#0a0808', pad: '#36302d',
        iris: '#e39a2a', irisRim: '#7a360c', irisIn: '#ffd769', mouthIn: '#5a1f1a', gum: '#3a1918', tooth: '#d9ccab',
        horn: '#2b2624', hornTip: '#8f7f66',
        head: 1.05, headS: 1.14, snoutCap: 0.055, neck: 1.45, trunk: 0.95, headFloor: 0.01, floorStraps: true, ringK: 1.3, legPat: true,
        neckP: { alert: 0.86, sit: 0.9, roar: 0.92, perch: 0.95 },
        // (the night's body drawn leaner, the neck slim, the head long and boxy (squareness 2.4 to 2.55) under heavy
        // brows, its jaw muscles flaring behind the eyes and a long straight muzzle)
        prof: [
          [0.00, 0.021, 0.021, 0.018, 2, 0, 0, 0, 0, 0, 0, 0], [0.08, 0.042, 0.041, 0.036, 2, 0.005, 0, 0, 0, 0, 0, 0],
          [0.25, 0.07, 0.072, 0.061, 2.1, 0.011, 0, 0, 0, 0, 0, 0], [0.45, 0.104, 0.11, 0.09, 2.2, 0.016, 0, 0, 0, 0, 0, 0],
          [0.65, 0.148, 0.156, 0.13, 2.25, 0.018, 0, 0, 0, 0, 0, 0], [0.82, 0.212, 0.23, 0.189, 2.3, 0.014, 0, 0, 0.02, 0, 0, 0],
          [0.94, 0.255, 0.31, 0.268, 2.3, 0.012, 0, 0, 0.055, 0, 0, 0], [1.05, 0.275, 0.342, 0.275, 2.3, 0.01, 0, 0, 0.062, 0, 0, 0],
          [1.18, 0.265, 0.34, 0.24, 2.25, 0.008, 0, 0, 0.045, 0, 0, 0], [1.33, 0.24, 0.34, 0.21, 2.2, 0.008, 0, 0, 0.01, 0, 0, 0],
          [1.50, 0.269, 0.369, 0.304, 2.15, 0.008, 0, 0, 0, 0, 0, 0], [1.68, 0.298, 0.396, 0.451, 2.05, 0.008, 0.022, 0, 0, 0, 0, 0],
          [1.84, 0.311, 0.41, 0.488, 2, 0.006, 0.055, 0.022, 0, 0, 0, 0], [1.98, 0.311, 0.405, 0.46, 2, 0.005, 0.055, 0.028, 0, 0, 0, 0],
          [2.15, 0.302, 0.396, 0.423, 2, 0.005, 0.022, 0.033, 0, 0, 0, 0], [2.45, 0.237, 0.289, 0.288, 2.05, 0.006, 0, 0, 0, 0, 0, 0],
          [2.72, 0.198, 0.232, 0.22, 2.05, 0.005, 0, 0, 0, 0, 0, 0], [2.88, 0.198, 0.208, 0.2, 2.1, 0.004, 0, 0, 0, 0, 0, 0],
          [2.97, 0.215, 0.222, 0.215, 2.2, 0.003, 0, 0, 0, 0, 0.01, 0], [3.05, 0.24, 0.235, 0.22, 2.3, 0, 0, 0, 0, 0, 0.04, 0],
          [3.14, 0.258, 0.25, 0.24, 2.4, 0, 0, 0, 0, 0, 0.06, 0], [3.25, 0.258, 0.255, 0.24, 2.45, 0, 0, 0, 0, 0.025, 0.058, 0.006],
          [3.37, 0.236, 0.248, 0.228, 2.5, 0, 0, 0, 0, 0.1, 0.03, 0.006], [3.48, 0.196, 0.232, 0.214, 2.6, 0.004, 0, 0, 0, 0.15, 0.01, -0.006],
          [3.60, 0.152, 0.205, 0.202, 2.7, 0.014, 0, 0, 0, 0.1, 0, -0.012], [3.72, 0.122, 0.182, 0.192, 2.8, 0.02, 0, 0, 0, 0.03, 0, -0.012],
          [3.84, 0.1, 0.168, 0.18, 2.7, 0.02, 0, 0, 0, 0, 0, -0.004], [3.93, 0.084, 0.16, 0.148, 2.5, 0.014, 0, 0, 0, 0, 0, 0.012],
          [4.00, 0.066, 0.13, 0.104, 2.3, 0.004, 0, 0, 0, 0, 0, 0.018]
        ],
        sho: [[1.72, 0], [1.9, 0.085], [2.06, 0.1], [2.28, 0.045], [2.42, 0]],
        keel: 0.45, chinY: 0.32,
        // (raised nostrils on top of the snout's tip that catch the light, a square knob of a chin under it and the
        // jaw's muscle squared off at its hinge, so the jaw's line shows from three-quarters; none on the young)
        lumps: { seed: 3, yk: 0, runs: [
          { st: [3.885, 3.885], a: [1.1, 1.1], n: 1, size: [0.046, 0.046], h: [0.62, 0.62], p: 2 },
          { st: [3.8, 3.8], a: [-1.38, -1.38], n: 1, size: [0.05, 0.05], h: [0.34, 0.34], p: 3 },
          { st: [3.3, 3.3], a: [-0.72, -0.72], n: 1, size: [0.075, 0.075], h: [0.32, 0.32], p: 3 },
          // and a raised bridge down the middle of the muzzle from between the brows to the nostrils, so from the front
          // the snout is a wedge with a keel on top, never a round bulb
          { st: [3.56, 3.9], a: [1.5708, 1.5708], n: 5, size: [0.06, 0.06], h: [0.42, 0.42], p: 2, sep: [0.06, 0.1] }
        ] },
        profY: [
          [2.92, 0.221, 0.234, 0.238, 2, 0, 0, 0, 0, 0, 0, 0], [3.00, 0.253, 0.261, 0.264, 2, 0, 0, 0, 0, 0, 0.012, 0],
          [3.10, 0.308, 0.333, 0.268, 2, 0, 0, 0, 0, 0, 0.03, 0], [3.22, 0.328, 0.41, 0.26, 2, 0, 0, 0, 0, 0, 0.036, 0],
          [3.35, 0.337, 0.455, 0.242, 2, 0, 0, 0, 0, 0.006, 0.026, 0], [3.47, 0.322, 0.462, 0.222, 2, 0, 0, 0, 0, 0.012, 0.012, 0],
          [3.58, 0.29, 0.432, 0.2, 2, 0, 0, 0, 0, 0.01, 0, 0.006], [3.68, 0.252, 0.382, 0.18, 2, 0, 0, 0, 0, 0, 0, 0.01],
          [3.79, 0.19, 0.315, 0.158, 2, 0, 0, 0, 0, 0, 0, 0.01], [3.90, 0.142, 0.245, 0.135, 2, 0, 0, 0, 0, 0, 0, 0.008],
          [4.00, 0.104, 0.18, 0.115, 2, 0, 0, 0, 0, 0, 0, 0.006]
        ],
        // (smaller eyes than the night's, more to the side, under a heavy, low lid: a hard, narrowed look; a long mouth)
        eye: [0.47, 0.6, 0.118, 0.24, 0.04], eyeYk: 0.55, browA: [[3.25, 0.2], [3.42, 0.28], [3.54, 0.45], [3.66, 0.68], [3.78, 0.88]], lid: [0.32, -0.55], lidTilt: 0.48, lidDrop: { sit: 0.15, curl: 0.3 }, nose: [0.93, 1.1, 0.032], mouth: [0.3, 0.14, 0.1, 0.28], mouthY: [0.58, -0.04, 0.08, 0.2],
        fore: { st: 1.98, at: [0.78, -0.15], len: [0.78, 0.56], paw: [0.135, 0.062, 0.11], toe: [0.16, 0.042, 0.07], fil: 0.8,
          prof: [[0, 0.25, 0.33, 0, 0, 2.0], [0.3, 0.215, 0.265, 0.025, 0, 2.0], [0.7, 0.168, 0.2, 0.01, 0, 2.0], [1, 0.152, 0.176, 0, 0.06, 2.1], [1.3, 0.158, 0.176, 0.026, 0, 2.1], [1.75, 0.122, 0.128, 0, 0, 2.0], [2, 0.102, 0.104, 0, 0, 2.0], [2.5, 0.1, 0.074, 0, 0, 2.2], [3, 0.135, 0.062, 0, 0, 2.6], [4, 0.125, 0.052, 0, 0, 2.6]] },
        hind: { st: 1.06, at: [0.84, 0.02], len: [0.68, 0.58], paw: [0.14, 0.065, 0.115], toe: [0.165, 0.044, 0.075], fil: 0.85,
          prof: [[0, 0.25, 0.36, 0, 0, 2.2], [0.3, 0.228, 0.315, 0.025, 0, 2.2], [0.65, 0.19, 0.245, 0.012, 0, 2.1], [1, 0.15, 0.17, 0.03, 0, 2.1], [1.3, 0.152, 0.176, 0, 0.045, 2.1], [1.75, 0.1, 0.112, 0, 0.012, 2.0], [2, 0.075, 0.083, 0, 0.032, 2.0], [2.5, 0.068, 0.068, 0, 0, 2.0], [3, 0.14, 0.064, 0, 0, 2.6], [4, 0.13, 0.052, 0, 0, 2.6]] },
        // (big wings, a little longer than the night's, a hooked claw on each wrist (thumb), the membranes edged orange)
        wing: { st: 1.86, a: 1.0, hip: 1.12, span: 1.12,
          elbow: [0.85, 0.3, 0.14], wrist: [1.78, 0.44, -0.18], fing: [[0.97, 0.6, -0.16], [0.76, 0.5, 0.62], [0.4, 0.3, 0.95], [0.0, 0.15, 1]],
          mElbow: [0.66, 0.5, 0.2], mWrist: [1.3, 0.88, 0.6], mFing: [[0.17, 0.79, 0.59], [0.77, 0.51, 0.39], [1.0, -0.07, -0.05], [0.6, -0.5, 0.62]],
          flen: [2.6, 2.85, 2.55, 2.0], glideUp: [-0.1, -0.18, -0.04], glideSweep: 0.55, mantle: { roar: 0.9, sit: 0.85, alert: 0.85, perch: 0.85, stand: 0.85, crouch: 0.35 }, mSweep: 0.18, scallop: 0.44,
          thumb: { len: 3.2, r: 0.5, fdir: [0.3, 0.25, -0.9], yk: 0.35 }, edge: [0.62, 0.14, 0.25],
          // folded: the arm proud along the top of the flank with a big knuckle at the shoulder, the fingers laid back
          // only to the hips, and the cloak as dark as the hide, only its lower edge and its tips seamed in orange
          fold: { elbow: [-0.32, 0.98, 0.02], wrist: [0.18, 1.36, 0.2], tips: [[-0.9, 1.12], [-0.88, 0.9], [-0.82, 0.66], [-0.7, 0.44]], off: 0.09, flare: 0.05, hipA: 0.15,
            knuckle: 0.8, knP: { crouch: 0.45, curl: 0.25 }, lift: 0.16, liftP: { curl: 0, sit: 0.4, crouch: 0.6 }, offP: { curl: 0.5 }, yUp: 0.1, yLift: 0, dark: 0.97,
            young: { elbow: [-0.3, 0.86, 0.0], wrist: [0.1, 1.1, 0.04], tipK: 0.72, offK: 0.45 }, seam: [0.16, 0.08] } },
        // the ember-orange belly: from near the tail's tip (coming up its sides there, so it shows from the side) along
        // the belly, the chest and the throat, narrowing under the jaw to the chin; its edge wandering a little, crossed
        // by the dark lines between its plates; bright enough to stay a warm red in shade
        band: { col: '#dd6420', col2: '#9a3a14', edge: 0.4, soft: 0.25, softY: 0.42, wave: 0.07, scute: [0.09, 0.45], yk: 0.2, st: [[0.12, 0, 0], [0.4, 0.85, -0.18], [0.9, 1, -0.06], [1.2, 1, 0], [3.0, 1, 0], [3.2, 0.85, 0.15], [3.6, 0.75, 0.3], [3.86, 0.55, 0.36], [3.97, 0, 0.4]] },
        // horns, spines and blades (see spikes())
        spikes: [
          // the big pair of horns: off the back of the skull, swept back and a little out, lifting toward their tips
          { st: [3.12, 3.12], a: [0.78], len: 1.05, w: 0.13, rings: 7, taper: 1.2, flare: 0.45, dir: [1, 0.12, -0.02, 0.32], curl: 0.42, col: 'horn', tip: 'hornTip', tipK: 0.45, yk: 0.4, sink: 0.6,
            y: { da: 0.15, dir: [0.8, 0.45, 0.15, 0.8], curl: 0.45, w: 0.32, taper: 0.75 } },
          // a fan of spines on the cheeks swept back off the jaw's hinge behind the eye, longest in the middle of the fan,
          // shorter up toward the eye and down toward the jaw, their roots swelling out of the skin, dark to the tip
          { st: [3.1, 3.1], a: [-0.62, -0.26, 0.08, 0.4], aK: [0.62, 1, 0.86, 0.56], len: 0.3, w: 0.15, flare: 0.8, sink: 0.6, fil: 0.8, dir: [1, 0.95, 0, 0.25], curl: -0.18, col: 'horn', tip: '#86725b', tipK: 0.45, yk: 0.65, y: { dir: [0.4, 0.8, 0, 0.9] } },
          // a second, shorter fan in front of it, closer under the eye
          { st: [3.22, 3.22], a: [-0.42, -0.08], aK: [0.8, 1], len: 0.15, w: 0.22, flare: 0.6, sink: 0.6, fil: 0.8, dir: [1, 0.8, 0, 0.15], curl: -0.12, col: 'horn', tip: '#7d6a55', tipK: 0.55, yk: 0.3 },
          // and a row along the lower jaw, shortening toward the chin, turning with it when it opens
          { st: [3.3, 3.62], n: 3, a: [0], lip: 0.05, len: [[3.3, 0.15], [3.62, 0.08]], w: 0.22, flare: 0.5, dir: [1, 0.7, -0.15, 0.25], curl: -0.1, col: 'horn', tip: '#5b4b3d', tipK: 0.6, yk: 0.1 },
          // fangs over the lower lip with the mouth shut (open, the jaw's own teeth show instead)
          { st: [3.6, 3.92], n: 3, a: [0], lip: -0.012, len: [[3.6, 0.045], [3.76, 0.055], [3.92, 0.075]], w: 0.28, taper: 1.3, dir: [-0.15, 0.25, -1, 0], col: 'tooth', m: 'paint', fil: 0, yk: -1, poseK: { roar: 0 } },
          // a low ridge of three blades down the back of the skull between the horns, growing on into the neck's row
          { st: [3.2, 3.02], n: 3, a: [1.5708], len: [[3.02, 0.17], [3.2, 0.09]], w: 0.42, flat: 0.45, flare: 0.6, sink: 0.4, dir: [0.75, 0.65, 0, 0], curl: -0.25, col: 'horn', tip: '#5b4b3d', tipK: 0.6, yk: 0.2 },
          // the row of tall blades down the back, graded like grown things: rising along the neck to the tallest over the
          // withers, lower at the waist, up again over the hips and the tail's root, then dwindling down the tail; thick
          // at the root, so from above they read as a keel of spikes, never a line of slashes. Along the neck they stand
          // out of it more (it rises steeply, so blades raked back along it would lie flat against it)
          { st: [2.94, 2.16], every: 0.85, a: [1.5708], sadK: [0.55, 0.4], len: [[2.16, 0.74], [2.45, 0.64], [2.7, 0.48], [2.94, 0.3]], w: 0.22, flat: 0.3, flare: 0.9, sink: 0.4, dir: [0.3, 0.95, 0, 0], curl: -0.22, col: 'horn', tip: '#5e4c3c', tipK: 0.7, yk: 0.3, poseK: { curl: 0.6 } },
          { st: [1.98, 0.68], every: 1.25, a: [1.5708], sadK: [0.3, 0.8], len: [[0.68, 0.22], [0.82, 0.36], [1.05, 0.5], [1.3, 0.42], [1.5, 0.4], [1.75, 0.52], [1.98, 0.7]], w: 0.24, flat: 0.3, flare: 0.8, sink: 0.4, dir: [0.45, 0.9, 0, 0], curl: -0.25, col: 'horn', tip: '#5e4c3c', tipK: 0.7, yk: 0.3, poseK: { curl: 0.6 } },
          // and on down the tail only a few low thorns, further apart and dwindling, ending well before its tip, so the
          // tail runs on bare and the blades at its end stand alone
          { st: [0.56, 0.27], n: 3, a: [1.5708], len: [[0.27, 0.075], [0.56, 0.13]], w: 0.26, flat: 0.3, flare: 0.8, sink: 0.4, dir: [0.55, 0.85, 0, 0], curl: -0.25, col: 'horn', tip: '#5e4c3c', tipK: 0.7, yk: 0.3, poseK: { curl: 0.6 } },
          // the spiked tail end, a weapon: the tail running on into one long central blade, and a fan of long flat blades
          // swept back off its upper sides and up (none low on its sides, where on the ground they would read as toes),
          // dark from the root, bone only toward their points
          { st: [0.025, 0.025], a: [1.5708], len: 0.58, w: 0.2, flat: 0.55, flare: 0.5, sink: 0.6, dir: [1, 0.36, 0, 0], curl: 0.2, col: 'horn', tip: '#c9b691', tipK: 0.62, yk: 0.35 },
          { st: [0.065, 0.065], a: [1.0], len: 0.48, w: 0.2, flat: 0.55, flare: 0.5, sink: 0.6, dir: [0.85, 0.5, 0.15, 0.32], curl: 0.12, col: 'horn', tip: '#c9b691', tipK: 0.62, yk: 0.35 },
          { st: [0.125, 0.125], a: [1.25], len: 0.36, w: 0.22, flat: 0.55, flare: 0.5, sink: 0.6, dir: [0.8, 0.6, 0.2, 0.16], curl: 0.08, col: 'horn', tip: '#c9b691', tipK: 0.62, yk: 0.35 }
        ],
        saddle: [1.58, 1.84],
        lift: { stand: [0.13, 0.16], alert: [0.13, 0.2], roar: [0.1, 0.1], perch: [0.04, -0.02], sit: [0, -0.1] },
        // the long neck carried up and proud in a lazy S (see neckKey()): forward out of the chest, then up, then over
        // into the head; crouched, raised like a snake's about to strike, standing up off the shoulders so even from a
        // high camera it rises as a column; in the air reaching far out ahead in a shallow S, first a little down out of
        // the chest, then up, then level into the head, and a little from side to side, so it reads as a long snake of a
        // neck from the side and from above (never a head sat on the shoulders)
        neckKeys: {
          stand: [[0, 0.225, 0.39], [0, 0.6, 0.527], [0, 0.75, 0.787]], alert: [[0, 0.26, 0.42], [0, 0.64, 0.56], [0, 0.86, 0.8]],
          crouch: [[0, 0.42, 0.26], [0, 1.0, 0.3], [0, 1.3, 0.52]], sit: [[0, 0.32, 0.3], [0, 0.72, 0.42], [0, 0.92, 0.66]],
          roar: [[0, 0.36, 0.42], [0, 0.82, 0.6], [0, 1.1, 0.72]],
          fly: [[0.05, -0.03, 0.56], [-0.09, 0.2, 1.22], [0.03, 0.34, 1.9]], glide: [[-0.05, -0.04, 0.56], [0.08, 0.13, 1.22], [-0.02, 0.24, 1.9]]
        },
        neckUp: { perch: 0.08 }, riddenDown: 0.2,
        feet: { glide: { fl: [0.36, -0.2, -0.5], fr: [-0.36, -0.18, -0.44], hl: [0.4, -0.08, -2.7], hr: [-0.4, -0.06, -2.76] } },
        tail: {
          stand: [[-1.45, 0.3, -4.75], [-1.3, 0.2, -4.12], [-0.95, 0.24, -3.5], [-0.48, 0.42, -2.9], [-0.14, 0.66, -2.28]],
          alert: [[-1.95, 0.1, -4.05], [-1.74, 0.1, -3.52], [-1.32, 0.2, -3.0], [-0.8, 0.36, -2.5], [-0.3, 0.6, -2.08]],
          crouch: [[0.3, 0.58, -3.3], [-0.3, 0.26, -3.2], [-0.92, 0.13, -2.82], [-0.95, 0.33, -2.28], [-0.4, 0.74, -1.95]],
          // in the air a whip: a lazy S from side to side, its middle dipping a little and its tip lifting
          fly: [[0.3, 0.42, -5.0], [-0.04, 0.08, -4.38], [-0.3, -0.09, -3.7], [-0.17, -0.01, -2.98], [0, 0.07, -2.26]],
          glide: [[-0.3, 0.36, -5.0], [0.04, 0.05, -4.38], [0.3, -0.1, -3.7], [0.17, -0.02, -2.98], [0, 0.05, -2.26]]
        },
        tailY: { sit: [[2.45, 0.07, 0.1], [2.15, 0.08, -0.45], [1.62, 0.1, -0.88], [1.0, 0.16, -1.1], [0.42, 0.34, -1.14]],
          crouch: [[0.45, 0.1, -3.25], [-0.2, 0.1, -3.22], [-0.9, 0.12, -2.85], [-0.95, 0.32, -2.28], [-0.4, 0.74, -1.95]] },
        jaw: { roar: 0.62, alert: 0.0 }
      }
    },
    crest: {
      name: 'Crest dragon', col: '#d7d3c9', col2: '#e4e0d7', belly: '#ebe8e1', mem: '#bdb8ad', bone: '#2a2927', eye: '#f2c74a', claw: '#2a2927',
      len: 0.78, ex: 2.0, belly0: 0.9, spines: 'tailspikes', ears: 'none', crest: true, tailFins: 'spikes', spots: true, wings: { span: 0.95, fingers: 4, k: 0.95 }, head: 'crest', legs: 2, slim: 0.82,
      rad: [[0.03, 0.03], [0.06, 0.06], [0.1, 0.1], [0.14, 0.14], [0.2, 0.2], [0.3, 0.33], [0.37, 0.4], [0.37, 0.42], [0.35, 0.4], [0.2, 0.22], [0.16, 0.17], [0.17, 0.18]],
      // bird-like and proud: it stands on two strong bird's legs under its balance point, the body tilted up over them
      // like a bird's, the wings its arms, folded at its sides; a slender curving neck, a narrow head drawn out into a
      // hooked parrot's beak with a little horn on it, a crown of spines fanned round the back of the skull, a long tail
      // lined with spikes ending in a spiked tip; cream hide with dark spots over a paler belly, yellow eyes
      loft: {
        skin: '#a69882', skin2: '#b0a38c', belly: '#dad3c2', mem: '#7f6a52', memEdge: '#3e2a1c', memFold: '#4f3d2c', foldEdge: '#2e2018', plate: '#a8a08c', claw: '#2b2723', dark: '#221e1a', pad: '#8c7f69',
        iris: '#e6bd33', irisRim: '#7a5810', irisIn: '#fff08c', mouthIn: '#4e2426', gum: '#3e2522', tooth: '#ece6d6',
        horn: '#8e6440', hornTip: '#1d1814',
        // countershaded: a warm ochre down the back, the top of the neck and the tail and the outside of the thighs,
        // fading round the flanks into the tan hide and a pale belly that comes in softly from low on the side
        dorsal: { col: '#6f604d', from: -0.12, soft: 0.75, wave: 0.15, leg: 1, st: [[0, 0.8], [1, 1], [2.92, 1], [3.08, 0.45], [3.3, 0]], fromSt: [[2.1, 0], [2.5, -0.88], [2.95, -0.88], [3.15, 0]], softSt: [[2.1, 1], [2.5, 0.3], [2.95, 0.3], [3.15, 1]] },
        bellyEdge: [0.05, 0.75, [[2.0, 0], [2.45, 0.62], [2.92, 0.62], [3.15, 0]]],
        head: 0.84, headS: 1.16, snoutCap: 0.05, neck: 1.08, trunk: 0.72, headFloor: 0.01, floorStraps: true, hidePale: true,
        neckP: { alert: 0.9, sit: 0.9, roar: 0.92, perch: 0.95 },
        // (a compact, deep-chested body like a bird's, a slender neck, a long slim tail; a narrow head tapering to a
        // beak, its skull a little high behind the eyes)
        prof: [
          [0.00, 0.045, 0.045, 0.04, 2.0, 0, 0, 0, 0, 0, 0, 0], [0.08, 0.07, 0.075, 0.062, 2.0, 0.004, 0, 0, 0, 0, 0, 0],
          [0.25, 0.1, 0.11, 0.09, 2.1, 0.008, 0, 0, 0, 0, 0, 0], [0.45, 0.14, 0.15, 0.12, 2.15, 0.01, 0, 0, 0, 0, 0, 0],
          [0.65, 0.185, 0.195, 0.16, 2.2, 0.01, 0, 0, 0, 0, 0, 0], [0.82, 0.245, 0.265, 0.215, 2.2, 0.008, 0, 0, 0.02, 0, 0, 0],
          [0.94, 0.3, 0.33, 0.29, 2.2, 0.006, 0, 0, 0.05, 0, 0, 0], [1.05, 0.335, 0.36, 0.34, 2.2, 0.005, 0, 0, 0.07, 0, 0, 0],
          [1.18, 0.345, 0.375, 0.39, 2.15, 0.005, 0, 0, 0.05, 0, 0, 0], [1.33, 0.335, 0.385, 0.46, 2.1, 0.005, 0, 0, 0.015, 0, 0, 0],
          [1.50, 0.335, 0.395, 0.54, 2.05, 0.005, 0, 0.01, 0, 0, 0, 0], [1.68, 0.345, 0.4, 0.6, 2.0, 0.005, 0.015, 0.03, 0, 0, 0, 0],
          [1.84, 0.34, 0.4, 0.61, 2.0, 0.004, 0.03, 0.045, 0, 0, 0, 0], [1.98, 0.315, 0.38, 0.55, 2.0, 0.004, 0.02, 0.045, 0, 0, 0, 0],
          [2.15, 0.29, 0.34, 0.43, 2.0, 0.004, 0, 0.02, 0, 0, 0, 0], [2.35, 0.25, 0.28, 0.31, 2.0, 0.004, 0, 0, 0, 0, 0, 0],
          [2.55, 0.2, 0.215, 0.215, 2.0, 0.004, 0, 0, 0, 0, 0, 0],
          [2.72, 0.165, 0.18, 0.168, 2.0, 0.003, 0, 0, 0, 0, 0, 0], [2.88, 0.145, 0.163, 0.148, 2.0, 0.003, 0, 0, 0, 0, 0, 0],
          [2.97, 0.14, 0.17, 0.14, 2.0, 0, 0, 0, 0, 0, 0.005, 0], [3.07, 0.172, 0.215, 0.162, 2.05, 0, 0, 0, 0, 0, 0.015, 0],
          [3.18, 0.205, 0.255, 0.178, 2.1, 0, 0, 0, 0, 0, 0.03, 0], [3.3, 0.214, 0.272, 0.178, 2.15, 0, 0, 0, 0, 0.022, 0.03, 0],
          [3.42, 0.2, 0.27, 0.17, 2.2, 0, 0, 0, 0, 0.068, 0.015, 0], [3.53, 0.168, 0.252, 0.155, 2.2, 0, 0, 0, 0, 0.07, 0, 0],
          [3.62, 0.128, 0.236, 0.132, 2.15, 0, 0, 0, 0, 0.02, 0, 0], [3.7, 0.104, 0.218, 0.11, 2.1, 0, 0, 0, 0, 0, 0, 0],
          [3.78, 0.085, 0.19, 0.086, 2.05, 0, 0, 0, 0, 0, 0, 0], [3.85, 0.067, 0.164, 0.064, 2.0, 0, 0, 0, 0, 0, 0, 0],
          [3.91, 0.05, 0.132, 0.045, 2.0, 0, 0, 0, 0, 0, 0, 0], [3.96, 0.034, 0.094, 0.028, 2.0, 0, 0, 0, 0, 0, 0, 0],
          [4.00, 0.018, 0.05, 0.012, 2.0, 0, 0, 0, 0, 0, 0, 0]
        ],
        keel: 0.55, chinY: 0.2,
        // (the young: a big round head, the forehead full, rounding over into a short little hooked beak like a parrot
        // chick's)
        profY: [
          [2.92, 0.19, 0.2, 0.19, 2.0, 0, 0, 0, 0, 0, 0, 0], [3.00, 0.22, 0.235, 0.21, 2.0, 0, 0, 0, 0, 0, 0.008, 0],
          [3.10, 0.26, 0.29, 0.22, 2.0, 0, 0, 0, 0, 0, 0.018, 0], [3.22, 0.285, 0.34, 0.22, 2.0, 0, 0, 0, 0, 0, 0.02, 0],
          [3.35, 0.29, 0.36, 0.21, 2.0, 0, 0, 0, 0, 0.006, 0.014, 0], [3.47, 0.275, 0.35, 0.195, 2.0, 0, 0, 0, 0, 0.01, 0.006, 0],
          [3.58, 0.2, 0.29, 0.16, 2.0, 0, 0, 0, 0, 0.006, 0, 0], [3.66, 0.14, 0.24, 0.125, 1.9, 0, 0, 0, 0, 0, 0, 0],
          [3.72, 0.095, 0.195, 0.09, 1.8, 0, 0, 0, 0, 0, 0, 0], [3.8, 0.07, 0.165, 0.065, 1.75, 0, 0, 0, 0, 0, 0, 0],
          [3.88, 0.05, 0.13, 0.045, 1.75, 0, 0, 0, 0, 0, 0, 0], [3.95, 0.032, 0.092, 0.028, 1.8, 0, 0, 0, 0, 0, 0, 0],
          [4.00, 0.018, 0.055, 0.014, 2.0, 0, 0, 0, 0, 0, 0, 0]
        ],
        // the snout arched down to a hooked beak
        beak: [0.02, 0.0, -0.17, 0.3],
        // the beak's front horn-coloured, darker to its hooked point
        beakCol: { col: '#4d4640', tip: '#181514', from: 0.55, soft: 0.035 },
        eye: [0.42, 0.52, 0.125, 0.38, 0.06], eyeY: [0.46, 0.42, 0.09, 0.5, 0.05], lid: [0.3, -0.6], lidDrop: { sit: 0.25, curl: 0.4 }, nose: [0.58, 1.0, 0.016], mouth: [0.31, -0.03, 0.1, 0.5], mouthEnd: 0.86, mouthYd: [0.21, 0.0, 0.0],
        // (open, a row of small even teeth along each rim, stopping short of the hook; the lower jaw edged in pale horn)
        beakTeeth: [6, 0.04, 0.68, 0.042], jawRim: '#c4b393',
        // two strong bird's legs: a thick feathered-looking thigh, a slim shin and a long scaly shank down from a high
        // hock to three long forward toes and one turned back
        biped: { tilt: { stand: 0.58, alert: 0.62, crouch: 0.15, sit: -0.5, curl: 0, perch: 0.4, roar: 0.42 }, hipY: { stand: 0.36, alert: 0.4, crouch: 0.2, sit: -0.05, curl: -0.08, perch: 0.34, roar: 0.38, glide: 0.35 },
          neckBack: 0.55, riddenK: 0.4, tailUp: { stand: 1, alert: 1, crouch: 0.9, perch: 0.15, roar: 1, glide: 0.85 }, tailLine: [0.98, 1.05, 1.1, 1.12, 1.07],
          neckS: { stand: [0.35, 0.65], alert: [0.35, 0.7], roar: [0.35, 0.2], perch: [0.15, 0.5], crouch: [0.1, 0.3], sit: [0.15, 0.5] },
          feet: { stand: [0.3, 0.38], alert: [0.3, 0.36], crouch: [0.32, 0.45], sit: [0.24, -0.15], curl: [0.2, 0.05], perch: [0.28, 0.35], roar: [0.32, 0.32] } },
        hind: { st: 1.2, at: [0.72, -0.3], len: [0.5, 0.78], hock: [0.42, 0.16], hockP: { curl: [0.08, 0.36] }, poleP: { curl: [-0.8, -0.1, 0.7], sit: [-0.1, 1, 0.5] }, paw: [0.12, 0.07, 0.09], toe: [0.31, 0.062, 0.1], fil: 1.3, bird: { splay: 0.5, back: 0.5 }, scute: [2.1, 0.2],
          // (a knob at the hock behind, where the shank meets the shin)
          prof: [[0, 0.25, 0.34, 0, 0, 2.1], [0.5, 0.21, 0.28, 0.02, 0, 2.1], [1, 0.175, 0.22, 0.035, 0, 2.0], [1.3, 0.16, 0.2, 0.01, 0.045, 2.0], [1.7, 0.12, 0.13, 0, 0.012, 2.0], [1.88, 0.107, 0.107, 0, 0.01, 2.0], [2, 0.104, 0.104, 0, 0.09, 2.0], [2.13, 0.09, 0.092, 0, 0.012, 2.0], [2.3, 0.08, 0.085, 0, 0, 2.0], [2.6, 0.078, 0.08, 0, 0, 2.0], [3, 0.09, 0.062, 0, 0, 2.2], [4, 0.08, 0.052, 0, 0, 2.2]] },
        legSkin: [0.55, 0.45],
        fore: { st: 1.98, at: [0.78, -0.15], len: [0.6, 0.45], paw: [0.12, 0.06, 0.1], toe: [0.14, 0.04, 0.05], fil: 0.8, prof: [[0, 0.2, 0.25, 0, 0, 2.0], [4, 0.1, 0.05, 0, 0, 2.0]] },
        wing: { st: 1.84, a: 1.0, hip: 1.12, span: 0.95,
          elbow: [0.85, 0.3, 0.14], wrist: [1.78, 0.44, -0.18], fing: [[0.97, 0.6, -0.16], [0.76, 0.5, 0.62], [0.4, 0.3, 0.95], [0.0, 0.15, 1]],
          // (held up on the ground lower and further back than a bat's mantle, like a bird drying its wings: the hand
          // out to the side and back, the leading finger leaning back over the hips instead of standing up behind the head)
          mElbow: [0.62, 0.34, 0.3], mWrist: [1.22, 0.52, 0.75], mFing: [[0.3, 0.55, 0.78], [0.8, 0.28, 0.53], [0.95, -0.2, 0.25], [0.5, -0.55, 0.67]],
          flen: [2.35, 2.55, 2.3, 1.85], glideUp: [0.1, 0.02, 0.0], glideSweep: 0.55, mantle: { roar: 0.9, sit: 0.85, alert: 0.8, perch: 0.7, stand: 0.8, crouch: 0.35, other: 0.7 }, mSweep: 0.08,
          // (folded, laid along the flank like a bird's, its upper edge along the top of the back, never standing over it)
          fold: { elbow: [-0.3, 1.18, -0.01], wrist: [0.16, 1.4, 0.15], tips: [[-1.24, 1.2], [-1.22, 0.78], [-1.12, 0.36], [-0.96, -0.04]], off: 0.07, flare: 0.12, hipA: 0.15,
            knuckle: 0.6, knP: { crouch: 0.4, curl: 0.25 }, lift: 0.1, liftP: { curl: 0, sit: 0.4, crouch: 0.6 }, offP: { curl: 0.9 }, yFlat: 0.8, yDrop: 0.6 },
          // a dark band along the trailing edge, so the spread wing has a drawn edge like the spots
          edge: [0.84, 0.06, 0.4],
          // the arm and the fingers in the back's ochre, and the membrane lit through from behind (one warm sail)
          bone: '#5c4a38', boneFrom: 0.05, rootSkin: [0.12, 0.3], sheer: true },
        // dark spots over the back, the flanks, the neck and the head
        spots: { col: '#2e2219', size: 0.08, dens: 0.85, a: [-0.45, 1.58], aSt: [[2.1, -0.45], [2.5, -1.0], [2.9, -1.0], [3.05, -0.45]], st: [0.1, 3.45], stretch: 1.3, seed: 3, yk: 0.6 },
        spikes: [
          // the crown: a fan of long spines round the back of the skull, radiating out and back like a halo from the front
          // and sweeping back like a crest from the side, longest over the top
          { st: [3.05, 3.05], a: [0.75, 1.15, 1.5708], aK: [0.95, 1.0, 0.92], len: 0.62, w: 0.13, taper: 1.3, flare: 0.4, dir: [0.55, 0.85, 0, 0], curl: -0.14, col: 'horn', tip: 'hornTip', tipK: 0.28, yk: 0.38, yst: 0.12, yw: 0.8 },
          { st: [3.05, 3.05], a: [-0.15, 0.3], aK: [0.78, 0.9], len: 0.6, w: 0.13, taper: 1.3, flare: 0.4, dir: [0.75, 0.65, 0, 0], curl: -0.2, col: 'horn', tip: 'hornTip', tipK: 0.28, yk: 0.38, yst: 0.12, yw: 0.8 },
          { st: [3.07, 3.07], a: [-1.05, -0.6], aK: [0.62, 0.78], len: 0.55, w: 0.13, taper: 1.3, flare: 0.4, dir: [0.6, 0.8, 0, 0], curl: -0.12, col: 'horn', tip: 'hornTip', tipK: 0.28, yk: 0.38, yst: 0.12, yw: 0.8 },
          // the horn on the beak, up and curving back like a rhino's
          { st: [3.66, 3.66], a: [1.5708], len: 0.26, w: 0.11, taper: 1.15, flare: 0.15, dir: [0.3, 1, 0, 0], curl: -0.4, col: '#4d4640', tip: 'hornTip', tipK: 0.25, yk: 0.22, yst: 0.1, yw: 1.3 },
          // the tail's spikes: a row each side along its top and a lower one, growing longer toward the end, and a
          // mace of them radiating round its tip
          { st: [0.85, 0.12], every: 1.75, a: [0.75], len: [[0.12, 0.4], [0.35, 0.34], [0.6, 0.2], [0.85, 0.09]], w: 0.16, taper: 1.2, flare: 0.3, dir: [0.85, 0.55, 0, 0], curl: -0.12, col: 'horn', tip: 'hornTip', tipK: 0.3, yk: 0.3 },
          { st: [0.62, 0.15], every: 2.2, a: [-0.15], len: [[0.15, 0.32], [0.4, 0.2], [0.62, 0.09]], w: 0.15, taper: 1.2, flare: 0.3, dir: [0.8, 0.6, 0, 0], curl: -0.1, col: 'horn', tip: 'hornTip', tipK: 0.3, yk: 0.3 },
          // the tip's mace: two long dark blades each side fanned out flat from its end, one trailing straight back and
          // one swept out to the side
          { st: [0.03, 0.03], a: [0.12], len: 0.62, w: 0.16, flat: 0.45, taper: 1.1, flare: 0.3, dir: [1, 0.28, 0, 0], curl: -0.06, col: '#6a4a32', tip: 'hornTip', tipK: 0.18, yk: 0.3 },
          { st: [0.11, 0.11], a: [0.02], len: 0.5, w: 0.17, flat: 0.45, taper: 1.1, flare: 0.3, dir: [0.6, 0.8, 0, 0], curl: -0.16, col: '#6a4a32', tip: 'hornTip', tipK: 0.18, yk: 0.3 }
        ],
        saddle: [1.5, 1.8],
        neckUp: { alert: 0.08, sit: 0.1, roar: 0.06, perch: 0.25 }, riddenDown: 0.05,
        // the head carried proud, its hooked beak level (radians up from the pose's own way)
        lookK: 0.4, headUp: { stand: 0.28, alert: 0.24, sit: 0.28, perch: 0.45, crouch: 0.12, glide: 0.3, fly: 0.12 },
        feet: { glide: { fl: [0.36, -0.2, -0.5], fr: [-0.36, -0.18, -0.44], hl: [0.36, 0.17, -2.6], hr: [-0.36, 0.19, -2.66] } },
        // sitting, roosting like a bird: the tail laid out behind it along the ground, curving away to one side
        // standing, it runs straight back from the hips, swinging a little to one side toward its tip (never out sideways
        // like an arm from the front); perched, it runs back and down to lie along the ledge behind
        tail: { sit: [[-1.25, 0.08, -3.75], [-1.0, 0.09, -3.15], [-0.62, 0.1, -2.55], [-0.26, 0.16, -1.98], [-0.05, 0.34, -1.42]],
          stand: [[-0.6, 0.1, -4.8], [-0.4, 0.12, -4.17], [-0.2, 0.16, -3.54], [-0.06, 0.3, -2.92], [0, 0.58, -2.28]],
          alert: [[0.55, 0.1, -4.7], [0.38, 0.11, -4.07], [0.18, 0.15, -3.44], [0.05, 0.28, -2.82], [0, 0.55, -2.2]],
          roar: [[-0.8, 0.1, -4.55], [-0.6, 0.11, -3.95], [-0.32, 0.17, -3.35], [-0.1, 0.33, -2.78], [0, 0.62, -2.22]],
          perch: [[-0.35, 0.05, -4.45], [-0.32, 0.06, -3.85], [-0.22, 0.1, -3.25], [-0.08, 0.3, -2.7], [0, 0.6, -2.15]] },
        jaw: { roar: 0.45, alert: 0.0 }
      }
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

  // ================================================================== the loft dragon
  // The night dragon is one anatomical loft: a single skin from the tail's tip along the body and up the neck to the
  // snout, every ring with a profile round it instead of an oval (a soft ridge down the back, shoulder blades, a deep
  // chest, a tucked belly and haunches on the body; the skull's dome, brows, cheeks, eye sockets, nostrils and the mouth
  // on the head). Legs and wing arms are lofted out of the body, and where they leave it their skin is laid onto the
  // body's with a soft fillet, so a shoulder or a thigh flows into the flank. Fine scale is in the colour, never in the
  // geometry, so the paint and the pen see big clean forms. A kind gives the numbers (K.loft); other kinds can move onto
  // it by giving theirs.
  var TAU = Math.PI * 2, HALFPI = Math.PI / 2;
  function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function gs(x, w) { x /= w; return Math.exp(-x * x); }
  // a smooth max(d, 0): how a limb's skin leaves the body's
  function softplus(d, k) { return d > 20 * k ? d : k * Math.log(1 + Math.exp(d / k)); }
  // every column of a table of keys [[x, a, b, ...], ...] at x, on a smooth curve that never overshoots its keys
  function slopeAt(keys, k, c) {
    if (k <= 0 || k >= keys.length - 1) return 0;
    var d0 = (keys[k][c] - keys[k - 1][c]) / (keys[k][0] - keys[k - 1][0]), d1 = (keys[k + 1][c] - keys[k][c]) / (keys[k + 1][0] - keys[k][0]);
    return d0 * d1 <= 0 ? 0 : 2 / (1 / d0 + 1 / d1);
  }
  function trackAt(keys, x, out) {
    var n = keys.length, m = keys[0].length, k = 0, c;
    if (x <= keys[0][0]) { for (c = 1; c < m; c++) out[c - 1] = keys[0][c]; return out; }
    if (x >= keys[n - 1][0]) { for (c = 1; c < m; c++) out[c - 1] = keys[n - 1][c]; return out; }
    while (k < n - 2 && x > keys[k + 1][0]) k++;
    var h = keys[k + 1][0] - keys[k][0], t = (x - keys[k][0]) / h, t2 = t * t, t3 = t2 * t;
    var h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = 3 * t2 - 2 * t3, h11 = t3 - t2;
    for (c = 1; c < m; c++) out[c - 1] = h00 * keys[k][c] + h10 * h * slopeAt(keys, k, c) + h01 * keys[k + 1][c] + h11 * h * slopeAt(keys, k + 1, c);
    return out;
  }
  // an indexed skin of nR rings of nS points (ring after ring in pos), closed round each ring, with a pole after the rings
  // for each end that has one (the start's first). Rings run from start to end with the angle turning from S toward N
  // (S = N x T), so these windings face out. Smooth normals all round: no seams.
  function skinGeo(pos, col, nR, nS, pole0, pole1) {
    var idx = [], i, j, k = nR * nS;
    for (i = 0; i < nR - 1; i++) for (j = 0; j < nS; j++) {
      var a = i * nS + j, b = i * nS + (j + 1) % nS, c = a + nS, d = b + nS;
      idx.push(a, b, c, b, d, c);
    }
    if (pole0) { for (j = 0; j < nS; j++) idx.push(k, (j + 1) % nS, j); k++; }
    if (pole1) { var r = (nR - 1) * nS; for (j = 0; j < nS; j++) idx.push(k, r + j, r + (j + 1) % nS); }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // rotation-minimising frames along centres C with tangents Tn, starting from up n0
  function rmf(Tn, n0) {
    var N = [], S = [], n = n0.clone().addScaledVector(Tn[0], -n0.dot(Tn[0]));
    if (n.lengthSq() < 1e-6) n = Math.abs(Tn[0].y) < 0.9 ? V(0, 1, 0) : V(0, 0, 1);
    n.normalize();
    for (var i = 0; i < Tn.length; i++) {
      if (i) { n = N[i - 1].clone().addScaledVector(Tn[i], -N[i - 1].dot(Tn[i])); if (n.lengthSq() < 1e-8) n = N[i - 1].clone(); n.normalize(); }
      N.push(n); S.push(n.clone().cross(Tn[i]).normalize());
    }
    return { N: N, S: S };
  }
  // rings along a smooth curve through pts, about step apart: centres, tangents, stations (0 at pts[0], 1 at pts[1], ...),
  // and a cap factor that rounds the far end over its last capL in nc rings; tip is the far end's point
  function curveRings(pts, step, capL, nc) {
    var cv = new T.CatmullRomCurve3(pts, false, 'centripetal'), m = 12, nD = (pts.length - 1) * m, DP = [], DS = [0], q;
    for (q = 0; q <= nD; q++) { DP.push(cv.getPoint(q / nD)); if (q) DS.push(DS[q - 1] + DP[q].distanceTo(DP[q - 1])); }
    var L = DS[nD], out = { C: [], T: [], st: [], k: [], len: L, tip: DP[nD].clone() };
    capL = Math.min(capL, L * 0.4);
    function put(s, k) {
      var lo = 0, hi = nD; while (hi - lo > 1) { var mm = (lo + hi) >> 1; if (DS[mm] <= s) lo = mm; else hi = mm; }
      var f = U.clamp((s - DS[lo]) / Math.max(1e-9, DS[lo + 1] - DS[lo]), 0, 1);
      out.C.push(DP[lo].clone().lerp(DP[lo + 1], f)); out.T.push(DP[lo + 1].clone().sub(DP[lo]).normalize()); out.st.push((lo + f) / m); out.k.push(k);
    }
    var n = Math.max(2, Math.ceil((L - capL) / step)), i;
    for (i = 0; i < n; i++) put((L - capL) * i / n, 1);
    for (i = 0; i < nc; i++) { var ph = i / nc * HALFPI; put(L - capL + capL * Math.sin(ph), Math.cos(ph)); }
    return out;
  }
  // a tube along curve rings G (from curveRings) with frames F: ring(i, th) gives the radius at angle th, tint(i, th) a
  // colour; open at its start, closed with a pole at its tip
  function tubeGeo2(G, F, nS, ring, tint) {
    var pos = [], col = [], nR = G.C.length, i, j;
    for (i = 0; i < nR; i++) {
      var c = G.C[i], S = F.S[i], N = F.N[i];
      for (j = 0; j < nS; j++) {
        var th = j / nS * TAU, cs = Math.cos(th), sn = Math.sin(th), r = ring(i, th, cs, sn);
        pos.push(c.x + (S.x * cs + N.x * sn) * r, c.y + (S.y * cs + N.y * sn) * r, c.z + (S.z * cs + N.z * sn) * r);
        var cc = tint(i, th); col.push(cc.r, cc.g, cc.b);
      }
    }
    pos.push(G.tip.x, G.tip.y, G.tip.z); var ce = tint(nR - 1, HALFPI); col.push(ce.r, ce.g, ce.b);
    return skinGeo(pos, col, nR, nS, false, true);
  }
  // A soft leaf (an ear flap, a back plate, a fin): from its root at the origin along +x to the tip, half width w(u) across
  // y (u = 0..1 along it), thickest at the root and the middle and thin at the edges, its tip curling by curl toward -z
  // and its edges cupped by cup. Two skins, top and bottom, meeting at the edge. Open at the root, which sits in the body.
  function leafGeo(len, wFn, thick, curl, cup, nl, nv, tint) {
    var pos = [], col = [], idx = [], i, j, sgn;
    for (sgn = 1; sgn >= -1; sgn -= 2) {
      var base = pos.length / 3;
      for (i = 0; i <= nl; i++) {
        var u = i / nl, w = wFn(u), th = thick * Math.pow(1 - u, 0.6) * (0.35 + 0.65 * (1 - u * 0.5)), bend = -curl * u * u * len;
        for (j = 0; j <= nv; j++) {
          var v = j / nv * 2 - 1, y = v * w, z = bend + cup * v * v * w + sgn * th * Math.sqrt(Math.max(0, 1 - v * v));
          pos.push(u * len, y, z); var cc = tint(u, v); col.push(cc.r, cc.g, cc.b);
        }
      }
      for (i = 0; i < nl; i++) for (j = 0; j < nv; j++) {
        var a = base + i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1;
        if (sgn > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
      }
    }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // A flap (an ear, a tail fin): a leaf along +x from its root at the origin, len long, its half width wFn(u) across y, its
  // thickness th at the root thinning to the edges and the tip. Its edges cup toward +z (the face) by cup, it twists
  // about its midrib by twist (radians at the tip), its tip curls toward -z by curl and sweeps across by sweep (fractions
  // of len). Two skins meeting at the edge; open at the root, which sits in the body.
  function flapGeo(len, wFn, th, curl, sweep, cup, twist, nl, nv, tint) {
    var pos = [], col = [], idx = [], i, j, sgn;
    for (sgn = 1; sgn >= -1; sgn -= 2) {
      var base = pos.length / 3;
      for (i = 0; i <= nl; i++) {
        var u = i / nl, w = wFn(u), t = th * Math.pow(1 - u, 0.65) * (0.3 + 0.7 * (1 - u)) + 0.002, ca = Math.cos(twist * u), sa = Math.sin(twist * u);
        var cx = u * len, cy = sweep * u * u * len, cz = -curl * u * u * len;
        for (j = 0; j <= nv; j++) {
          var v = j / nv * 2 - 1, y = v * w, z = cup * (v * v - 0.35) * w + sgn * t * Math.sqrt(Math.max(0, 1 - v * v));
          pos.push(cx, cy + y * ca - z * sa, cz + y * sa + z * ca); var cc = tint(u, v, sgn); col.push(cc.r, cc.g, cc.b);
        }
      }
      for (i = 0; i < nl; i++) for (j = 0; j < nv; j++) {
        var a = base + i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1;
        if (sgn > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
      }
    }
    // the root closed with a fan, so where the root stands a little proud of a curved skin it never shows a hole
    var ctr = pos.length / 3, w0 = wFn(0), c0 = tint(0, 0, 1), bot = (nl + 1) * (nv + 1);
    pos.push(0, 0, cup * -0.35 * w0); col.push(c0.r, c0.g, c0.b);
    for (j = 0; j < nv; j++) idx.push(ctr, j, j + 1, ctr, bot + j + 1, bot + j);
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // a big ear flap's outline: a long leaf, half as broad at its root, broadest a third of the way out, then a long
  // taper to a soft point (a leaf, never a cat's triangle, even where a high camera sees the far one stand up)
  function earW(u) { return u < 0.34 ? 0.5 + 0.5 * Math.sin(HALFPI * u / 0.34) : Math.pow(Math.max(0, Math.cos((u - 0.34) / 0.66 * HALFPI)), 1.15) * (1 - 0.1 * sm((u - 0.6) / 0.4)); }
  // a leaf's outline: broadest a third of the way out from a slightly narrower root, drawn to a soft point
  function leafW(u) { return u < 0.34 ? 0.62 + 0.38 * Math.sin(HALFPI * u / 0.34) : Math.pow(Math.cos((u - 0.34) / 0.66 * HALFPI), 0.72); }
  // lay a geometry made along +x (normal +z) at origin, x toward dir, z toward face
  function lay(g, origin, dir, face) {
    var X = dir.clone().normalize(), Z = face.clone().addScaledVector(X, -face.dot(X)).normalize(), Y = Z.clone().cross(X);
    g.applyMatrix4(new T.Matrix4().makeBasis(X, Y, Z).setPosition(origin)); return g;
  }
  // the angles round a ring: closer together where the mouth runs (angle am up from the side, either side), so its
  // crease stays crisp; the rest evenly spread
  function ringAngles(n, am) {
    var M2 = 1440, cdf = [0], i, th0 = -HALFPI;
    function dens(th) { var a = Math.atan2(Math.sin(th), Math.abs(Math.cos(th))); return 1 + 2.4 * gs(a - am, 0.16); }
    for (i = 1; i <= M2; i++) cdf.push(cdf[i - 1] + dens(th0 + (i - 0.5) / M2 * TAU));
    var out = [], k = 0;
    for (i = 0; i < n; i++) { var want = i / n * cdf[M2]; while (k < M2 - 1 && cdf[k + 1] < want) k++; var f = (want - cdf[k]) / Math.max(1e-9, cdf[k + 1] - cdf[k]); out.push(th0 + (k + f) / M2 * TAU); }
    return out;
  }

  // the fingers of a wing held shut (before the open layout is blended in), for a wing of n fingers: side by side, the
  // first along the leading edge and the last lowest, as the four-fingered night dragon holds its own
  function fingersShut(n) {
    var out = [];
    for (var q = 0; q < n; q++) out.push([q === n - 1 ? 0.04 : 0.05, -0.04 - 0.48 * q / Math.max(1, n - 1), 1]);
    return out;
  }
  // a cheap, repeatable hash of a lattice cell to 0..1 (for the hide's spots)
  function hash3(i, j, k) { var h = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return h - Math.floor(h); }

  function loftDragon(self, o, K, P0, ag) {
    // hk: the head's size for the age (a fledgling's a little less than the generator's, so it is not all head)
    var HIDE = hideOf(K.loft);
    var LF = K.loft, young = ag.young, hk = (ag.headK - young * (1 - young) * 0.4) * (1 + ((LF.headS || 1) - 1) * (1 - young)), air = !!P0.air, rnd = ag.rnd;
    var det = U.clamp(o.detail === undefined ? 1 : +o.detail, 0.35, 2);
    var C = { cloth: lin('#f26a1b'), clothDk: lin('#a8420e') };
    ['skin', 'skin2', 'belly', 'mem', 'memEdge', 'memFold', 'foldEdge', 'plate', 'claw', 'dark', 'iris', 'irisRim', 'irisIn', 'pad', 'mouthIn', 'gum', 'tooth'].forEach(function (k) { C[k] = lin(LF[k] || '#202020'); });
    ['horn', 'hornTip', 'lip'].forEach(function (k) { if (LF[k]) C[k] = lin(LF[k]); });
    // (_nl: while set, the skin is read without its lumps)
    var tc = new T.Color(), up = V(0, 1, 0), _nl = false;
    // the kind's own features, each off unless its K.loft asks for it (see their sections below)
    var UB = LF.underbite, ER = LF.eyeRim, LP = LF.lipCrease, NRm = LF.noseRim, BAND = LF.band, SPOT = LF.spots, STONE = LF.stone, BKC = LF.beakCol, DORS = LF.dorsal, BLN = LF.backLine, PAT = !!(BAND || SPOT || STONE || BKC || DORS || (LF.lumps && LF.lumps.hi)), _bt = [];
    if (DORS) C.dorsal = lin(DORS.col);
    if (BLN) C.backLine = lin(BLN.col);
    if (LF.wing.bone) C.wbone = lin(LF.wing.bone);
    if (BAND) { C.band = lin(BAND.col); C.band2 = lin(BAND.col2 || BAND.col); }
    if (SPOT) C.spot = lin(SPOT.col);
    if (STONE) { C.stoneLo = lin(STONE.cols[0]); C.stoneHi = lin(STONE.cols[1]); }
    if (LF.lumps && LF.lumps.hi) C.lumpHi = lin(LF.lumps.hi);
    if (LF.lumps && LF.lumps.lo) C.lumpLo = lin(LF.lumps.lo);
    if (BKC) { C.beak = lin(BKC.col); C.beakTip = lin(BKC.tip || BKC.col); }

    // ---- the spine: the pose's keys, the tail and the neck stretched for the kind and the age
    // yb: how far the young's face is blended in (most of the way on a fledgling, all of it on a hatchling)
    var yb = Math.min(1, young * 1.5), ym2 = young * (1 - young) * 4, TLk = LF.tail && LF.tail[o.pose || 'stand'], TYk = young && LF.tailY && LF.tailY[o.pose || 'stand'];
    var NKk = LF.neckKeys && LF.neckKeys[o.pose || 'stand'];
    var i, j, keys = P0.spine.map(function (p, i) {
      if (TLk && i <= 4) p = TLk[i];
      if (NKk && i >= 9) p = neckKey(i);
      if (TYk && i <= 4) p = lerp3(p, TYk[i], Math.min(1, young * 2));
      // (the young's neck short, so a little one's big head sits close on its shoulders; LF.neckY: how much shorter, of
      // the grown one's, 0.52 unless set)
      var q = p.slice(), zK = i <= 4 ? K.len * (1 - young * (1 - young * 0.4)) : i >= 9 ? (LF.neck || 1) * (LF.neckP && LF.neckP[o.pose || 'stand'] || 1) * (1 - young * (LF.neckY !== undefined ? LF.neckY : 0.52)) : 1;
      if (i <= 4) { var hip = P0.spine[5]; q = [hip[0] + (p[0] - hip[0]) * zK, p[1], hip[2] + (p[2] - hip[2]) * zK]; }
      if (i >= 9) { var sh = P0.spine[8]; q = [sh[0] + (p[0] - sh[0]) * zK, sh[1] + (p[1] - sh[1]) * zK, sh[2] + (p[2] - sh[2]) * zK]; }
      if (young && !air) q[1] *= 1 - young * 0.24;
      return V(q[0], q[1], q[2]);
    });
    // the standing poses lift the body off the pose's spine (the legs reach down long and athletic, the tail still
    // trailing to the ground), and the poses that look about hold the neck up; a fledgling holds its head up on a
    // longer, slimmer neck so it stands clear of the shoulders (ym2: 1 on a fledgling, 0 grown or a hatchling), less
    // so in the poses that already hold the neck up
    var pn = o.pose || 'stand', lift = LF.lift && LF.lift[pn] || [0, 0], nU0 = LF.neckUp && LF.neckUp[pn] || 0, nUp = nU0 * (1 - young) + (air ? 0 : ym2 * Math.max(0, 0.16 - nU0 * 1.5));
    // [key, weight of the hips' lift, of the shoulders']
    [[2, 0.12, 0], [3, 0.4, 0], [4, 0.8, 0], [5, 1, 0], [6, 0.67, 0.33], [7, 0.33, 0.67], [8, 0, 1], [9, 0, 1], [10, 0, 1], [11, 0, 1]].forEach(function (e) { keys[e[0]].y += (lift[0] * e[1] + lift[1] * e[2]) * (1 - young * 0.5); });
    // ridden, it carries its head lower and reaching forward like a horse's, so its rider sees over it (and shows over it)
    // and the neck shows its length between them
    if (o.rider && !air) { nUp -= LF.riddenDown || 0; keys[10].z += 0.12; keys[11].z += 0.26; }
    // (LF.neckUpY: the young's head held that much higher on the ground, so a big head on a short neck sits up clear of
    // the chest instead of resting its chin on it)
    if (LF.neckUpY && !air) nUp += LF.neckUpY * yb;
    if (nUp) [[9, 0.35], [10, 0.75], [11, 1]].forEach(function (e) { keys[e[0]].y += nUp * e[1]; });
    // the trunk a little shorter than the pose's spine (a compact, deep-chested build), drawn in toward the hips; the
    // neck and the front feet follow the shoulders
    var tk = (LF.trunk || 1) * (1 - young * 0.75 + young * young * 0.3), dSh = V(0, 0, 0), feet = {};
    if (tk !== 1) {
      for (i = 6; i <= 8; i++) keys[i] = keys[5].clone().lerp(keys[i], tk);
      dSh = keys[8].clone().sub(A(P0.spine[8]));
      if (young && !air) dSh.y = 0;
      for (i = 9; i <= 11; i++) keys[i].add(dSh);
    }
    var FT = LF.feet && LF.feet[pn] || P0.feet;
    ['fl', 'fr', 'hl', 'hr'].forEach(function (k) { var f = A(FT[k]); if (k[0] === 'f') { f.x += dSh.x; f.z += dSh.z; } feet[k] = f; });
    // (a broad kind stands its feet wider apart than the pose's, LF.stance times as wide, so its legs stand clear of its sides)
    if (LF.stance) ['fl', 'fr', 'hl', 'hr'].forEach(function (k) { var c0 = keys[k[0] === 'f' ? 8 : 5].x; feet[k].x = c0 + (feet[k].x - c0) * LF.stance; });
    // (a heavy tail end held a little off the ground in the ground poses, LF.tailRaise at its tip, so a club rests on it
    // instead of sinking flat)
    if (LF.tailRaise && !air) [1, 0.7, 0.4, 0.15].forEach(function (w, k) { keys[k].y += LF.tailRaise * w * (1 - young * 0.5); });
    if (LF.biped) bipedBody();
    // ---- where the head looks: the pose's way, turned toward o.look; the neck takes part of a turn to the side
    var fwd = A(P0.head).normalize(), d0 = fwd.clone();
    if (LF.headUp && LF.headUp[pn]) headUp(LF.headUp[pn]);
    // (LF.lookK: how far a grown one's head turns toward it, 0.7 if not given: a bird-like kind turns it only part way,
    // eyeing you with one eye over its beak; the young always look straight at it)
    if (o.look) { var lw = A(o.look).sub(keys[11]); lw.y *= 0.5; if (lw.lengthSq() > 0.01) fwd = fwd.clone().lerp(lw.normalize(), LF.lookK === undefined ? 0.7 : 0.7 + (LF.lookK - 0.7) * (1 - young)).normalize(); }
    // (a little one on the ground holds its chin up, looking up at the world: its round face shows and its jaw never
    // hangs over its chest)
    if (young && !air) { fwd.y += 0.08 * Math.min(1, young * 1.5); fwd.normalize(); }
    var yaw = Math.atan2(fwd.x, fwd.z) - Math.atan2(d0.x, d0.z); yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    if (Math.abs(yaw) > 1e-3) [[9, 0.2], [10, 0.38], [11, 0.52]].forEach(function (e) { keys[e[0]] = keys[e[0]].clone().sub(keys[8]).applyAxisAngle(up, yaw * e[1]).add(keys[8]); });
    var HL = LF.head * hk * (1 - 0.18 * yb), Hb = keys[11];
    var CP = keys.concat([0.34, 0.67, 1].map(function (t) { return Hb.clone().addScaledVector(fwd, HL * t); }));
    if (LF.beak) beakBend();
    if (LF.headFloor !== undefined && !air) headOffFloor();
    // where the head is in the build's frame, for close-up pictures in the lab (view.html focus=head)
    KIT.dragonHeadAt = Hb.clone().applyMatrix4(self.top());

    // ---- the spine sampled finely, with its arc length, and the stations along it: 0 the tail's tip, 1 the hips,
    // 2 the shoulders, 3 the back of the skull, 4 the snout's tip
    var cv = new T.CatmullRomCurve3(CP, false, 'centripetal'), NSm = 16, nD = (CP.length - 1) * NSm, DP = [], DS = [0], q;
    for (q = 0; q <= nD; q++) { DP.push(cv.getPoint(q / nD)); if (q) DS.push(DS[q - 1] + DP[q].distanceTo(DP[q - 1])); }
    var SS = [0, DS[5 * NSm], DS[8 * NSm], DS[11 * NSm], DS[nD]], SE = SS[4];
    function stOf(s) { var k = s < SS[1] ? 0 : s < SS[2] ? 1 : s < SS[3] ? 2 : 3; return k + (s - SS[k]) / Math.max(1e-6, SS[k + 1] - SS[k]); }
    function sOf(st) { var k = Math.max(0, Math.min(3, Math.floor(st))); return SS[k] + (SS[k + 1] - SS[k]) * (st - k); }
    function dIdx(s) { var lo = 0, hi = nD; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (DS[m] <= s) lo = m; else hi = m; } return Math.min(lo, nD - 1); }
    function ptAt(s) { s = U.clamp(s, 0, SE); var k = dIdx(s); return DP[k].clone().lerp(DP[k + 1], (s - DS[k]) / Math.max(1e-9, DS[k + 1] - DS[k])); }
    function dirAt(s) { var k = dIdx(U.clamp(s, 0, SE)); return DP[k + 1].clone().sub(DP[k]).normalize(); }

    // ---- the rings: a little rounded tail tip, then evenly along (closer on the head), then the rounded snout
    // (the young's muzzle rounds over in a longer cap: a soft ball of a nose, never a flat face)
    var capL = LF.snoutCap * hk * (1 + yb * 0.7), tipL = LF.tipCap || 0.04, RS = [], RK = [];
    // (LF.ringK: the rings' spacing times that, wider for a kind whose long neck and tail would take too many)
    // (LF.skinStep [[station, spacing], ...]: the kind's own spacing (world units) along the body, closer where a
    // knobbly hide needs the rings to carry its stones)
    var _stp = [];
    function step(st) { return (LF.skinStep ? trackAt(LF.skinStep, st, _stp)[0] : st < 0.85 ? 0.1 : st < 2.25 ? 0.062 : st < 2.86 ? 0.046 : 0.021) / det * (LF.ringK || 1); }
    for (q = 1; q <= 3; q++) { RS.push(tipL * (1 - Math.cos(q / 4 * HALFPI))); RK.push(Math.sin(q / 4 * HALFPI)); }
    for (var s0 = tipL; s0 < SE - capL - 0.004; s0 += step(stOf(s0))) { RS.push(s0); RK.push(1); }
    var nc = Math.max(4, Math.round(8 * det));
    for (q = 0; q < nc; q++) { RS.push(SE - capL + capL * Math.sin(q / nc * HALFPI)); RK.push(Math.cos(q / nc * HALFPI)); }
    // the eye, the nostril and the mouth, placed along the head
    // (LF.faceY: the young's own placings, blended in by age: eye [along, angle], nose [along, angle, size], eyeOut, eyeR
    // (the eye's radius), lid (the upper lid's edge), so a grown one's small hooded eyes keep the young's big round ones;
    // LF.eyeY [along, angle, radius]: the young's eye, in the same terms, blended in as their face is; LF.eyeYk: how much
    // bigger a young one's eye is, 0.3 unless set)
    var FY = LF.faceY, EY = LF.eyeY && yb ? LF.eye.map(function (v, q) { return v + ((LF.eyeY[q] === undefined ? v : LF.eyeY[q]) - v) * yb; }) : LF.eye, eyU = FY && FY.eye ? EY[0] + (FY.eye[0] - EY[0]) * yb : EY[0];
    var sE = SS[3] + eyU * HL, eR = (FY && FY.eyeR !== undefined ? EY[2] + (FY.eyeR - EY[2]) * yb : EY[2]) * hk * (1 + young * (LF.eyeYk === undefined ? 0.3 : LF.eyeYk)), aE = FY && FY.eye ? EY[1] + (FY.eye[1] - EY[1]) * yb : EY[1];
    var eOut = LF.eyeOut ? LF.eyeOut + (FY && FY.eyeOut !== undefined ? (FY.eyeOut - LF.eyeOut) * yb : 0) : 0;
    // the mouth: where it starts (its corner, along the head), how high there and at the snout; on the young a shorter one,
    // set higher, so it smiles (LF.mouthYd [corner further forward, higher there, higher at the snout]: the young's own,
    // as a chick's beak's short straight gape that ends under the eye)
    var MY = LF.mouthYd || [0.17, -0.1, -0.03], MO = [LF.mouth[0] + yb * MY[0], LF.mouth[1] + yb * MY[1], LF.mouth[2] + yb * MY[2], LF.mouth[3] * (1 - yb * 0.2)];
    // (LF.mouthY: the young's own mouth, in the same terms, for a kind whose grown mouth is set grim)
    if (LF.mouthY) MO = LF.mouth.map(function (v, k) { return v + (LF.mouthY[k] - v) * yb; });
    var NO = FY && FY.nose ? LF.nose.map(function (v, k) { return v + (FY.nose[k] - v) * yb; }) : LF.nose, sN = SS[3] + NO[0] * HL, nR0 = NO[2] * hk;
    // the jaw: opened (radians) in the poses that open it, a roar, turning down about a hinge at the mouth's corner
    var JA = (LF.jaw && LF.jaw[pn] !== undefined ? LF.jaw[pn] : (P0.jaw || 0)) * (1 - young * 0.3);
    var nR = RS.length, R = [], pr = [], prY = [], shoT = [], q2;
    for (i = 0; i < nR; i++) {
      var si = RS[i], st = stOf(si); trackAt(LF.prof, st, pr);
      // the young: their own round-skulled head blended in, the head bigger on a slim neck that lets it stand clear of
      // the shoulders, the trunk a little rounder
      if (yb && LF.profY && st > 2.82) { trackAt(LF.profY, st, prY); var yw = yb * sm((st - 2.82) / 0.12); for (q2 = 0; q2 < pr.length; q2++) pr[q2] += (prY[q2] - pr[q2]) * yw; }
      // (the head's size comes in only behind the skull, so a grown neck stays slim under a big head: the head overhangs
      // it; the young's comes in further down the neck, a short thick one)
      var gk = 1 + (hk - 1) * sm((st - 2.86 + young * 0.26) / (0.18 + young * 0.3)), bk = 1 + young * 0.28 * sm((st - 0.7) / 0.4) * (1 - sm((st - 2.2) / 0.5)) - ym2 * 0.07 * gs(st - 2.6, 0.28), kk = gk * bk * RK[i];
      // (the cranium a dome: its upper half a rounder, narrower-topped curve on the grown one; on the young an even
      // round dome, never peaked like an onion)
      // (LF.dome: how much rounder the grown one's cranium is than its profile's squareness, 0.08 unless set)
      var r = { s: si, st: st, k: RK[i], exB: pr[3] - (LF.keel || 0) * gs(st - 1.85, 0.32) - (LF.chinY || 0) * yb * sm((st - 2.95) / 0.12) * (1 - sm((st - 3.8) / 0.2)), exT: pr[3] - ((LF.dome !== undefined ? LF.dome * (1 - yb * 0.8) : 0.08) - yb * 0.12) * sm((st - 3.0) / 0.12) * (1 - sm((st - 3.62) / 0.25)), sho: LF.sho && st > 1.7 && st < 2.45 ? trackAt(LF.sho, st, shoT)[0] * kk : 0, w: pr[0] * kk, ht: pr[1] * kk, hb: pr[2] * kk, ex: pr[3], ridge: pr[4] * kk, scap: pr[5] * kk, pec: pr[6] * kk, hip: pr[7] * kk, brow: pr[8] * kk, cheek: pr[9] * kk, jaw: pr[10] * kk,
        // (every field a ring may take later named here, so all the rings share one shape and their reads stay fast)
        eyeS: undefined, eyeA: 0, noseS: undefined, noseA: 0, mouthK: 0, ym: undefined, ymE: undefined, bA: undefined, lumps: null, bt: null, c: null, T: null, N: null, S: null, fe: null, feK: 0 };
      var hh = st - 3;
      if (hh > -0.1) {
        var es = (si - sE) / (eR * 1.15); if (Math.abs(es) < 2.6) { r.eyeS = es; r.eyeA = eR * 1.15 / (pr[0] * gk * 0.95); }
        var ns = (si - sN) / nR0; if (Math.abs(ns) < 2.6) { r.noseS = ns; r.noseA = nR0 / (pr[0] * gk * 0.6); }
        // the mouth: a height under the head's axis (a fraction of the jaw's depth), running back to its corner under the eye,
        // where it turns up a little; the lower jaw sits a touch inside the upper
        var mk = sm((hh - MO[0]) / 0.09);
        // (LF.mouthEnd: along the head where the mouth ends short of the snout's tip, so a hooked beak's point is the upper
        // jaw's alone, overhanging the lower, never split by the crease into two beads)
        if (LF.mouthEnd) mk *= 1 - sm((hh - LF.mouthEnd) / 0.06);
        if (mk > 0) { r.mouthK = mk; r.ym = -pr[2] * gk * (MO[2] - (MO[2] - MO[1]) * Math.pow(1 - sm((hh - MO[0]) / MO[3]), 1.6)); r.ymE = r.ym * (0.35 + 0.65 * RK[i]); }
      }
      R.push(r);
    }
    if (LF.noseCap) noseOnCap();
    // ring frames: the tangent smoothed over about the ring's own size, so tight bends do not pinch; up kept as near the
    // world's up as the spine allows, so the back stays a back
    for (i = 0; i < nR; i++) {
      var rr = R[i], hw = Math.max(rr.w, rr.ht, rr.hb) / Math.max(0.3, rr.k) * 0.75 + 0.03, t = V(0, 0, 0);
      rr.c = ptAt(rr.s);
      for (q = -3; q <= 3; q++) t.addScaledVector(dirAt(rr.s + hw * q / 3), Math.exp(-q * q / 4.5));
      t.normalize(); rr.T = t;
      var nu = up.clone().addScaledVector(t, -t.y), Lu = nu.length();
      var nt = i ? R[i - 1].N.clone().addScaledVector(t, -R[i - 1].N.dot(t)) : nu.clone();
      if (nt.lengthSq() < 1e-6) nt = nu.clone();
      nt.normalize(); if (Lu > 1e-4) nu.multiplyScalar(1 / Lu); else nu = nt;
      rr.N = nt.lerp(nu, sm((Lu - 0.25) / 0.3)).normalize();
      rr.S = rr.N.clone().cross(t).normalize();
    }
    if (LF.lumps) lumpRings();
    if (LF.browA) browRings();
    function ringAt(st) { var b = 0, bd = 1e9; for (var k = 0; k < nR; k++) { var d = Math.abs(R[k].st - st); if (d < bd) { bd = d; b = k; } } return b; }
    // a point on the skin at any station (between rings), angle th, out off from it
    function skinAt(st, th, off) {
      var lo = 0, hi = nR - 1; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (R[m].st <= st) lo = m; else hi = m; }
      return surf(lo, U.clamp((st - R[lo].st) / Math.max(1e-6, R[hi].st - R[lo].st), 0, 1), th, off);
    }

    // ---- the profile round a ring: a superellipse (flatter or fuller by ex, its top and bottom apart), then the masses
    // on it by angle a up from the side (the same both sides): the ridge on top, shoulder blades high, the chest low and
    // forward, haunches, brows over the eyes, cheeks; then the eye sockets with their lids, the nostrils and the mouth
    function rAt(r, th, shut) {
      var cs = Math.cos(th), sn = Math.sin(th), ac = Math.abs(cs), a = Math.atan2(sn, ac), n = sn < 0 ? r.exB : r.exT;
      var rad = Math.pow(Math.pow(ac / r.w, n) + Math.pow(Math.abs(sn) / (sn > 0 ? r.ht : r.hb), n), -1 / n);
      // (each mass only where the ring has it: most rings carry two or three)
      if (r.ridge) rad += r.ridge * gs(a - HALFPI, 0.12);
      if (r.scap) rad += r.scap * gs(a - 0.88, 0.3);
      if (r.pec) rad += r.pec * gs(a + 0.85, 0.42);
      if (r.hip) rad += r.hip * gs(a - 0.12, 0.55);
      if (r.sho) rad += r.sho * gs(a + 0.12, 0.42);
      if (r.brow) rad += r.brow * (r.bA === undefined ? gs(a - aE - 0.34, 0.2) : gs(a - r.bA, 0.2));
      if (r.cheek) rad += r.cheek * gs(a + 0.25, 0.42);
      if (r.jaw) rad -= r.jaw * gs(a + 0.9, 0.5);
      if (r.lumps && !_nl) rad += lumpAt(r, a);
      if (r.eyeS !== undefined) {
        var ea = (a - aE) / r.eyeA, d = Math.sqrt(r.eyeS * r.eyeS + ea * ea);
        // (the rim over a young one's big eye kept low, so it never props the brow up into a corner)
        rad += eR * (-0.32 * Math.exp(-2.2 * d * d) + (ea > 0 ? (ER ? ER[0] * (1 - yb * 0.6) : 0.24 - 0.14 * yb) : ER ? ER[1] : 0.12) * gs(d - 1.0, 0.32));
        // the face falls away in front of the eye (toward the snout), so the eye's forward side shows and it looks ahead
        // (LF.eyeFall: how much, of the eye's radius; 0.16 unless set)
        if (r.eyeS > 0) rad -= eR * (LF.eyeFall !== undefined ? LF.eyeFall : 0.16) * sm(r.eyeS / 0.9) * gs(r.eyeS - 1.1, 0.8) * gs(ea, 0.9);
      }
      // the nostrils: a little oval dent each side on top of the snout, with a soft rim round it that catches the light
      if (r.noseS !== undefined && sn > 0) { var na = (a - NO[1]) / r.noseA, nd = Math.sqrt(r.noseS * r.noseS * 0.3 + na * na * 2.2); rad += nR0 * (-0.6 * Math.exp(-2 * nd * nd) + (NRm ? NRm[0] * gs(nd - 1.15, 0.38) + NRm[1] * gs(nd, NRm[2]) : 0.16 * gs(nd - 1.15, 0.38))); }
      // (on the young a softer crease and the lower jaw barely set in: a small soft mouth, never a frog's lip)
      if (r.mouthK) { var y = rad * sn - r.ym, gw = 0.016 * hk; rad -= r.mouthK * hk * (1 - yb * 0.55) * ((LP ? LP[0] : 0.016) * Math.exp(-y * y / (gw * gw)) + (LP ? LP[1] : 0.011) * (1 - yb * 0.4) * sm(0.5 - y / (gw * 1.4))); }
      // an open mouth: the upper jaw's underside drawn up flat to the line of the mouth (the palate); the lower jaw is
      // its own loft (see jaw())
      if (JA && r.mouthK && sn < -0.02 && !shut) { var lim = r.ymE / sn; if (rad > lim) rad += (lim - rad) * r.mouthK; }
      return rad;
    }
    // a point on the skin at ring i (and f of the way to the next), angle th, out off from it
    function surf(i, f, th, off) {
      var a = R[i], b = R[Math.min(nR - 1, i + 1)], cs = Math.cos(th), sn = Math.sin(th);
      var rad = rAt(a, th) * (1 - f) + rAt(b, th) * f + (off || 0);
      var c = a.c.clone().lerp(b.c, f), S = a.S.clone().lerp(b.S, f), N = a.N.clone().lerp(b.N, f);
      if (UB && a.mouthK) c.addScaledVector(a.T, ubAt(a, rad * sn) * (1 - f) + (b.mouthK ? ubAt(b, rad * sn) : 0) * f);
      return c.addScaledVector(S, cs * rad).addScaledVector(N, sn * rad);
    }
    function surfN(i, th) {
      var e = 0.03, j2 = Math.min(nR - 1, i + 1), i2 = j2 - 1;
      var dt = surf(i, 0, th + e).sub(surf(i, 0, th - e)), ds = surf(j2, 0, th).sub(surf(i2, 0, th));
      return dt.cross(ds).normalize();
    }
    // where a point lies against the body: between which ring planes (searching i0..i1), at what angle, how far out, and
    // the skin's radius at that angle
    var _dots = new Float64Array(nR);
    function bodyAt(p, i0, i1) {
      i0 = Math.max(0, i0 | 0); i1 = Math.min(nR - 1, i1 | 0);
      var k, best = -1, bd = 1e9, bf = 0;
      for (k = i0; k <= i1; k++) { var r = R[k]; _dots[k] = (p.x - r.c.x) * r.T.x + (p.y - r.c.y) * r.T.y + (p.z - r.c.z) * r.T.z; }
      for (k = i0; k < i1; k++) {
        if (_dots[k] >= 0 && _dots[k + 1] < 0) {
          var f = _dots[k] / (_dots[k] - _dots[k + 1]), cc = R[k].c.clone().lerp(R[k + 1].c, f), dd = cc.distanceToSquared(p);
          if (dd < bd) { bd = dd; best = k; bf = f; }
        }
      }
      if (best < 0) return null;
      var a = R[best], b = R[best + 1], c = a.c.clone().lerp(b.c, bf), S = a.S.clone().lerp(b.S, bf).normalize(), N = a.N.clone().lerp(b.N, bf).normalize();
      var dv = p.clone().sub(c), x = dv.dot(S), y = dv.dot(N), th = Math.atan2(y, x), rho = Math.sqrt(x * x + y * y);
      return { i: best, f: bf, c: c, S: S, N: N, x: x, y: y, th: th, rho: rho, along: dv.addScaledVector(S, -x).addScaledVector(N, -y), r: rAt(a, th) * (1 - bf) + rAt(b, th) * bf };
    }
    // set a point's distance from the body's axis to rho, keeping its angle and where it lies along
    function atRho(b, rho) { var cs = Math.cos(b.th), sn = Math.sin(b.th); return b.c.clone().add(b.along).addScaledVector(b.S, cs * rho).addScaledVector(b.N, sn * rho); }
    // the fillet: a limb's skin within reach of the body's is lifted onto it with a smooth max, by weight w; returns the
    // body's normal there and how much the limb's skin lies on it (for the shading), or null
    function fillet(p, w, k, hint, span) {
      var b = bodyAt(p, hint - span, hint + span); if (!b) return null;
      var d = b.rho - b.r; if (d > 6 * k) return null;
      var d2 = softplus(d, k) + 0.004, rho = b.r + d + (d2 - d) * w;
      // a point that would be thrown far is on the wrong ring (where the spine bends hard, as in a sit): leave it
      if (Math.abs(rho - b.rho) > 0.4 * ag.sizeK) return null;
      p.copy(atRho(b, rho));
      // (the body's hit and the new distance kept too, for a limb's root that takes the body's pattern: legPat)
      return { n: skinN(b.i, b.f, b.th), on: w * (1 - sm((d2 - 0.004) / (2.2 * k))), b: b, rho: rho };
    }
    // fold a point onto the flank: its distance from the body set to the skin plus off, by weight w (near the body only)
    function wrapOn(p, off, w, hint) {
      if (w <= 0) return p;
      var b = bodyAt(p, hint - 45, hint + 30); if (!b) return p;
      var d = b.rho - b.r, fall = 1 - sm((d - 0.35) / 0.7); if (fall <= 0) return p;
      return atRho(b, b.rho + (b.r + off - b.rho) * w * fall);
    }

    // ---- how open the wings are (a resting curl keeps them folded), how folded (1: laid on the flank), and the folded
    // layout's points on the skin: V(station, angle up from the side, how far out). The layout shrinks with a smaller
    // wing and keeps low under a saddle, so the rider's legs lie over it.
    var kOpen = o.wing === undefined ? P0.wing : o.wing;
    if (pn === 'curl') kOpen = Math.min(kOpen, 0.15);
    // on the ground a wing is folded or held well open, never half way (a half-open wing is a narrow upright blade from
    // most sides): below about 0.4 it lies folded on the flank, from there it opens at once to a broad fan
    var wFold = air ? 1 - sm((kOpen - 0.2) / 0.16) : 1 - sm((kOpen - 0.38) / 0.04);
    if (!air && kOpen > 0.38) kOpen = Math.max(kOpen, 0.78);
    var sadW = o.saddle || o.rider ? 1 : 0, WG = LF.wing, fsW = 0.55 + 0.45 * WG.span * ag.wingK, aKW = 1 - sadW * 0.12;
    var FDy = WG.fold.y && young ? foldY(WG.fold, yb) : WG.fold;
    if (FDy !== WG.fold && FDy.y.edge !== undefined) C.foldEdge.lerp(C.memFold, (1 - FDy.y.edge) * yb);
    var FYk = WG.fold.yUp ? WG.fold.yUp * young : 0, FDW = FDy.wrist, FDE = FDy.elbow, FDT = FDy.tips;
    if (WG.fold.young && young) youngFold();
    // (WG.fold.yDrop: a young one's folded wing laid that much lower down its flank (radians, on a hatchling), so on its
    // round little back it lies along the side instead of standing up over it)
    var yDr = WG.fold.yDrop ? young * WG.fold.yDrop : 0;
    function foldPt(e, a, off) { var v = V(WG.st + e * fsW, WG.a + (a - WG.a) * aKW - sadW * 0.08 * Math.max(0, -e) / 0.7 - yDr, off === undefined ? FDy.off : off); return FYk ? foldUp(v) : v; }
    // the folded wing's lower edge (its last finger, from the wrist back to its tip) as an angle at a station, or null
    // off its length
    var feW = foldPt(FDW[0], FDW[1]), feT = FDT[FDT.length - 1], feT2 = foldPt(feT[0], feT[1]);
    function foldEdge(st) { if (st < feT2.x || st > feW.x) return null; var t = (feW.x - st) / (feW.x - feT2.x); return feW.y + (feT2.y - feW.y) * t + 0.05 * Math.sin(Math.PI * t); }

    // on the ground nothing sinks into it: what would reach below the feet (a curled-up flank or thigh, a tail lying
    // along the ground, a fin) is pressed flat on it instead, so a dragon curled up on a roof or a ledge never shows
    // through it
    function FLOOR(y) { return air || y > 0.004 ? y : 0.004; }
    function floorGeo(g) {
      if (air) return g;
      var pa = g.attributes.position, any = false;
      for (var k = 0; k < pa.count; k++) if (pa.getY(k) < 0.004) { pa.setY(k, 0.004); any = true; }
      if (any) pa.needsUpdate = true;
      return g;
    }
    // ---- the body's skin, and its colour: matte near-black with a cool sheen in the paint, a broad mottle and a fine
    // scale texture in the colour, the belly a touch lighter and smoother; the mouth line, nostrils and eye sockets dark
    // (LF.skinN: the points round each ring, 56 unless set: more for a hide with stones in it)
    var nS = Math.max(28, Math.round((LF.skinN || 56) * det)), TH = ringAngles(nS, Math.atan2(-0.3, 1));
    var pos = [], col = [];
    function skinCol(r, th, rad, x, y, z) {
      // the mottle is faint and broken over several sizes (felt as texture, never read as spots)
      var sn = Math.sin(th), n1 = U.noise3(x * 1.7 + 4.1, y * 1.7, z * 1.7), n4 = U.noise3(x * 6.3 + 2.2, y * 6.3, z * 6.3 + 5.1), n2 = U.noise3(x * 21, y * 21 + 7.3, z * 21);
      tc.copy(C.skin).lerp(C.skin2, U.clamp(0.5 + 0.35 * n1 + 0.25 * n4, 0, 1));
      // (the throat and the underside of the jaw shade into the belly's tone gradually: no pale bib, no dark collar;
      // LF.jawBelly: how much of the belly's tone the jaw keeps, 0.6 unless set, less for a stony jaw)
      // (LF.bellyEdge [where, how soft, [[station, further down], ...]]: where round the ring the belly's tone comes in, in
      // sin below the side, and along the body how much further down it starts (a narrower pale throat on a long neck))
      var BE = LF.bellyEdge, be0 = BE ? BE[0] + (BE[2] ? trackAt(BE[2], r.st, _bt)[0] : 0) : 0, bel = (BE ? sm((-sn - be0) / BE[1]) : sm((-sn - 0.3) / 0.5)) * (1 - (LF.jawBelly !== undefined ? 1 - LF.jawBelly : 0.4) * sm((r.st - 3.0) / 0.4)) * (1 - (0.3 - 0.3 * yb) * gs(r.st - 2.8, 0.32));
      tc.lerp(C.belly, bel * 0.85);
      tc.multiplyScalar(1 + n2 * 0.07 * (1 - bel * 0.7));
      if (PAT) patCol(r, th, sn, x, y, z);
      if (BLN) backLineCol(r, th, sn);
      if (r.mouthK) { var yy = rad * sn - r.ym, gw = 0.02 * hk; tc.lerp(C.dark, r.mouthK * 0.9 * Math.exp(-yy * yy / (gw * gw))); }
      // (NRm[3]: a crisp dark hole of that strength inside the rim, for a big nostril a soft shadow would blur away)
      if (r.noseS !== undefined && sn > 0) { var a = Math.atan2(sn, Math.abs(Math.cos(th))), na = (a - NO[1]) / r.noseA, nd2 = r.noseS * r.noseS * 0.3 + na * na * 2.2; tc.lerp(C.dark, NRm && NRm[3] ? NRm[3] * (1 - sm((Math.sqrt(nd2) - 0.5) / 0.22)) : 0.8 * Math.exp(-2.4 * nd2)); }
      if (r.eyeS !== undefined) { var a2 = Math.atan2(sn, Math.abs(Math.cos(th))), ea = (a2 - aE) / r.eyeA; tc.lerp(C.dark, 0.55 * Math.exp(-1.2 * (r.eyeS * r.eyeS + ea * ea))); }
      // the folded wing's soft shadow on the flank just under its edge
      if (wFold > 0.3 && r.fe !== null) { var a3 = Math.atan2(sn, Math.abs(Math.cos(th))), dE = r.fe - a3; if (dE > -0.02 && dE < 0.2) tc.lerp(C.dark, 0.55 * wFold * sm((dE + 0.02) / 0.04) * (1 - sm((dE - 0.04) / 0.16)) * r.feK); }
      return tc;
    }
    for (i = 0; i < nR; i++) {
      var R0 = R[i];
      R0.fe = foldEdge(R0.st); R0.feK = R0.fe === null ? 0 : sm((R0.st - feT2.x) / 0.08) * sm((feW.x - R0.st) / 0.3);
      for (j = 0; j < nS; j++) {
        var th = TH[j], rad = rAt(R0, th), cs = Math.cos(th), sn = Math.sin(th);
        var px = R0.c.x + (R0.S.x * cs + R0.N.x * sn) * rad, py = R0.c.y + (R0.S.y * cs + R0.N.y * sn) * rad, pz = R0.c.z + (R0.S.z * cs + R0.N.z * sn) * rad;
        if (UB && R0.mouthK) { var ubk = ubAt(R0, rad * sn); px += R0.T.x * ubk; py += R0.T.y * ubk; pz += R0.T.z * ubk; }
        var cc = skinCol(R0, th, rad, px, py, pz);
        // the palate of an open mouth: dark pink, darker into the throat
        // (LF.lip: a thin rim of its own colour along the lip first, so the mouth's colour never touches a pale hide)
        if (JA && R0.mouthK && sn < 0) { var dO = rAt(R0, th, true) - rad; if (dO > 1e-3) { if (C.lip) cc.lerp(C.lip, sm(dO / 0.003)); cc.lerp(C.mouthIn, sm((dO - (C.lip ? 0.006 : 0)) / 0.015)).lerp(C.dark, 0.45 * (1 - sm((R0.st - 3 - MO[0]) / 0.35))); } }
        pos.push(px, FLOOR(py), pz); col.push(cc.r, cc.g, cc.b);
      }
    }
    var tipT = ptAt(0), tipS = ptAt(SE);
    // (with an underbite the snout's last ring is pushed forward below the mouth: its pole goes to the ring's middle, so
    // the cap closes over the jutting lip instead of folding back to the spine's end)
    if (UB) { tipS = V(0, 0, 0); for (j = 0; j < nS; j++) tipS.x += pos[((nR - 1) * nS + j) * 3], tipS.y += pos[((nR - 1) * nS + j) * 3 + 1], tipS.z += pos[((nR - 1) * nS + j) * 3 + 2]; tipS.multiplyScalar(1 / nS).addScaledVector(R[nR - 1].T, 0.006); }
    pos.push(tipT.x, tipT.y, tipT.z, tipS.x, tipS.y, tipS.z); col.push(C.skin.r, C.skin.g, C.skin.b);
    // (a beak's point takes the colour of the ring round it, so its dark tip never ends in a pale dot)
    if (BKC) { var cP = V(0, 0, 0); for (j = (nR - 1) * nS * 3; j < nR * nS * 3; j += 3) cP.add(V(col[j], col[j + 1], col[j + 2])); cP.multiplyScalar(1 / nS); col.push(cP.x, cP.y, cP.z); }
    else col.push(C.skin.r, C.skin.g, C.skin.b);
    var bodyG = skinGeo(pos, col, nR, nS, true, true), bodyNr = bodyG.attributes.normal.array;
    if (LF.skinSoft) softNormals(bodyNr, LF.skinSoft[0], LF.skinSoft[1]);
    self.addGeo(bodyG, { c: '#ffffff', jit: 0, m: HIDE, ao: 0.3, vary: 0.02 });
    // the body skin's own smooth normal at ring i (and f of the way to the next), angle th: what a limb's skin laid on
    // it shades with
    function skinN(i, f, th) {
      while (th < TH[0]) th += TAU; while (th >= TH[0] + TAU) th -= TAU;
      var lo = 0, hi = nS; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (TH[m] <= th) lo = m; else hi = m; }
      var j1 = (lo + 1) % nS, ta = TH[lo], tb = lo + 1 < nS ? TH[lo + 1] : TH[0] + TAU, u = (th - ta) / Math.max(1e-6, tb - ta), i2 = Math.min(nR - 1, i + 1);
      var a = (i * nS + lo) * 3, b = (i * nS + j1) * 3, c = (i2 * nS + lo) * 3, d = (i2 * nS + j1) * 3, out = V(0, 0, 0);
      for (var q = 0; q < 3; q++) out.setComponent(q, (bodyNr[a + q] * (1 - u) + bodyNr[b + q] * u) * (1 - f) + (bodyNr[c + q] * (1 - u) + bodyNr[d + q] * u) * f);
      return out.normalize();
    }

    // a limb's skin colour: the hide, a touch lighter on the pads
    function hideCol(x, y, z, pad) {
      var n2 = U.noise3(x * 21, y * 21 + 7.3, z * 21), n1 = U.noise3(x * 1.7 + 4.1, y * 1.7, z * 1.7);
      tc.copy(C.skin).lerp(C.skin2, U.clamp(0.5 + 0.4 * n1, 0, 1)).multiplyScalar(1 + n2 * 0.05);
      if (pad) tc.lerp(C.pad, pad);
      return tc;
    }
    // finish a limb's skin: where it was laid on the body, take the body's normal so the two shade as one
    function blendNormals(g, ons) {
      var nr = g.attributes.normal;
      for (var k = 0; k < ons.length; k++) {
        var e = ons[k]; if (!e || e.on <= 0) continue;
        var nx = nr.getX(k) + (e.n.x - nr.getX(k)) * e.on, ny = nr.getY(k) + (e.n.y - nr.getY(k)) * e.on, nz = nr.getZ(k) + (e.n.z - nr.getZ(k)) * e.on, L = Math.hypot(nx, ny, nz) || 1;
        nr.setXYZ(k, nx / L, ny / L, nz / L);
      }
    }
    // the fillet over a tube's first rings (station below upto), by a weight that fades down the limb
    function filletTube(g, G, nS2, upto, k, hint, span) {
      var p = g.attributes.position, ons = [], v = V(0, 0, 0);
      for (var ii = 0; ii < G.C.length; ii++) {
        var w = 1 - sm(G.st[ii] / upto); if (w <= 0.001) break;
        // where this ring of the limb is along the body (from its centre), so its points look only a few rings about
        var bc = bodyAt(G.C[ii], hint - span, hint + span), h2 = bc ? bc.i : hint, sp2 = bc ? 7 : span;
        for (var jj = 0; jj < nS2; jj++) {
          var idx = ii * nS2 + jj; v.set(p.getX(idx), p.getY(idx), p.getZ(idx));
          var e = fillet(v, w, k, h2, sp2); if (e) { p.setXYZ(idx, v.x, v.y, v.z); ons[idx] = e; }
        }
      }
      g.computeVertexNormals(); blendNormals(g, ons); g.userData.fil = ons;
      return g;
    }

    // ---- legs: from inside the body at the shoulder or the hip, by two-bone IK to the wrist or the hock, down to a paw
    // with padded toes and curved claws. The upper limb's skin flows into the flank through the fillet.
    var FAIR = air;
    function leg(lg) {
      var front = lg[0] === 'f', sd = lg[1] === 'l' ? 1 : -1, G = front ? LF.fore : LF.hind;
      var ri = ringAt(G.st), r = R[ri];
      // (the forelegs' roots a touch in under the chest, more so under a young one's narrow chest)
      var root = r.c.clone().addScaledVector(r.S, sd * r.w * G.at[0] * (front ? 0.95 - young * 0.08 : 1)).addScaledVector(r.N, r.ht * G.at[1]);
      var foot = feet[lg].clone(); if (o.pose === 'curl' && !front) foot.y = 0;
      // in the air the hind legs hang a little below the body, tucked forward under the tail, so they read in profile
      // (gliding, they lie tucked back along the body instead: LF.feet)
      if (FAIR && !front && !(LF.feet && LF.feet[pn])) foot.add(V(0, -0.34, 0.5));
      var ground = !FAIR && foot.y < 0.2, sit = !!P0.sitting && !front && ground;
      // the young's legs short and stubby: shorter, but only a little slimmer
      var lk = 1 - young * 0.12, lkL = 1 - young * 0.32, len = [G.len[0] * lkL, G.len[1] * lkL];
      // (G.hockP { pose: [up, back] }: the hock where a pose holds it its own way, as a roosting bird folds its shank
      // flat along the ground under it)
      var HK = G.hockP && G.hockP[pn] || G.hock;
      var j2 = ground ? foot.clone().add(sit ? V(0, 0.09, -0.32 * lkL) : front ? V(0, 0.18 * lkL, -0.07 * lkL) : HK ? V(0, HK[0] * lkL, -HK[1] * lkL) : V(0, 0.33 * lkL, -0.2 * lkL)) : foot.clone().add(V(0, 0.08, front ? -0.06 : 0.12));
      var dist = root.distanceTo(j2), tot = Math.max(len[0] + len[1], dist * 1.04), a = tot * len[0] / (len[0] + len[1]);
      // (the elbows a little out from the chest and the front paws turned a little out, like a cat's, never parallel posts)
      // (only a little, so the upper arm stays against the chest with no daylight between; less still on the young)
      var pole = FAIR ? (front ? V(0, -0.3, -1) : V(0, -0.4, 1)) : front ? V(sd * 0.24 * (1 - 0.6 * young), -0.1, -1) : V(sd * 0.32, 0, 1);
      // (G.poleP { pose: [out, up, forward] }: the way the knee bends in a pose that folds the leg its own way, up into
      // the body for one roosting on the ground, so the folded leg lies hidden under it instead of jutting out)
      if (!FAIR && !front && G.poleP && G.poleP[pn]) pole = V(sd * G.poleP[pn][0], G.poleP[pn][1], G.poleP[pn][2]);
      var kk = ik(root, j2, a, tot - a, pole), j1 = kk.J; j2 = kk.H;
      var pf = V(sd * (front ? 0.2 : 0.1), 0, 1).normalize(), ph = G.paw[1] * lk, j3, j4, pd;
      if (ground) { j3 = V(foot.x, ph, foot.z + 0.03); pd = pf; }
      else { pd = (P0.glide ? V(0, -0.3, -1) : V(0, -0.8, front ? 0.5 : -0.7)).normalize(); j3 = j2.clone().addScaledVector(pd, 0.12 * lk); pd = pd.clone().lerp(pf, P0.glide ? 0 : 0.35).normalize(); }
      j4 = j3.clone().addScaledVector(pd, G.paw[2] * lk); if (ground) j4.y = ph * 0.85;
      // the tube starts a little way inside the body, narrower there, so its open end never shows (stations below 0)
      var deep = root.clone().addScaledVector(root.clone().sub(j1).normalize(), 0.16 * lk).lerp(r.c, 0.25);
      // (a knee turned in under the body by poleP would carry that start out through the far flank: start toward the
      // body's middle instead)
      if (!FAIR && !front && G.poleP && G.poleP[pn]) deep = root.clone().lerp(r.c, 0.55);
      var GR = curveRings([deep, root, j1, j2, j3, j4], 0.05 / det, G.paw[0] * lk * 0.7, Math.max(3, Math.round(4 * det)));
      GR.st = GR.st.map(function (x) { return x - 1; });
      var nT = GR.T.slice(), F = rmf(nT, V(0, 0, 1).addScaledVector(up, 0.0));
      var nS2 = Math.max(10, Math.round(14 * det)), pk = [];
      var pkI = -1, g = tubeGeo2(GR, F, nS2, function (ii, th2, cs, sn) {
        if (ii !== pkI) { trackAt(G.prof, GR.st[ii], pk); pkI = ii; }
        var rs = pk[0] * lk, rf = pk[1] * lk, n2 = pk[4];
        var re = Math.pow(Math.pow(Math.abs(cs) / rs, n2) + Math.pow(Math.abs(sn) / rf, n2), -1 / n2);
        // the knee or the elbow's point, the heel, muscle in front
        re += (pk[2] * gs(th2 - HALFPI, 0.55) + pk[3] * gs(th2 - 3 * HALFPI, 0.5)) * lk;
        return re * GR.k[ii] * (GR.st[ii] < 0 ? 0.6 + 0.4 * (1 + GR.st[ii]) : 1);
      }, function (ii, th2) {
        var cc = GR.C[ii]; hideCol(cc.x, cc.y, cc.z, GR.st[ii] > 2.8 && Math.sin(th2) < -0.4 ? 0.35 : 0); if (DORS) legTone(GR, F, ii, th2, sd);
        // (G.scute [from station, darkness]: a bird's scaly shank, every other ring a shade darker below the hock)
        if (G.scute && ii % 2 && GR.st[ii] > G.scute[0]) tc.multiplyScalar(1 - G.scute[1] * sm((GR.st[ii] - G.scute[0]) / 0.15));
        return tc;
      });
      filletTube(g, GR, nS2, G.fil, 0.075, ri, 22);
      if (LF.legPat && PAT) legPat(g, GR, nS2, G.fil);
      if (LF.legSkin) bodySkin(g, GR, nS2, ri, LF.legSkin);
      self.addGeo(floorGeo(g), { c: '#ffffff', jit: 0, m: HIDE, ao: 0.25, vary: 0.02 });
      // toes: four splayed a little, each with a pad under its tip and a curved claw
      var pT = GR.T[GR.T.length - 1].clone(), pN = F.N[F.N.length - 1].clone(), pS = F.S[F.S.length - 1].clone();
      if (ground) { pT = pd.clone(); pN = up.clone(); pS = pN.clone().cross(pT).normalize(); }
      var nt = 4, tw = G.paw[0] * lk;
      for (var t = 0; t < nt; t++) {
        var u = (t / (nt - 1)) * 2 - 1, outer = u * sd < -0.6 ? 0.82 : 1;
        var dir = pT.clone().applyAxisAngle(pN, u * 0.3).normalize();
        var b0 = j3.clone().addScaledVector(pS, u * tw * 0.62).addScaledVector(pT, G.paw[2] * lk * 0.55).addScaledVector(pN, 0.005);
        var tl = G.toe[0] * lk * outer, tr = G.toe[1] * lk;
        if (G.bird) { var bt = birdToe(G, t, sd, lk, tw, pT, pN, pS, j3); dir = bt.dir; b0 = bt.b0; tl = bt.tl; }
        var b1 = b0.clone().addScaledVector(dir, tl * 0.5).addScaledVector(pN, tr * 0.35), b2 = b0.clone().addScaledVector(dir, tl).addScaledVector(pN, ground ? -tr * 0.1 : -tr * 0.6);
        if (ground) { b2.y = Math.max(b2.y, tr * 0.9); b1.y = Math.max(b1.y, tr * 1.15); }
        var TG = curveRings([b0, b1, b2], 0.03 / det, tr * 0.9, 3), TF = rmf(TG.T, pN);
        self.addGeo(tubeGeo2(TG, TF, Math.max(5, Math.round(6 * det)), function (ii, th2, cs, sn) {
          var s2 = TG.st[ii], rr2 = tr * (1 + 0.12 * gs(s2 - 1, 0.35)) * (1 - 0.1 * s2);
          // the pad bulges under the tip
          if (sn < 0) rr2 *= 1 + 0.18 * gs(s2 - 1.6, 0.4) * -sn;
          return rr2 * TG.k[ii];
        }, function (ii, th2) { var cc = TG.C[ii]; hideCol(cc.x, cc.y, cc.z, Math.sin(th2) < -0.3 ? 0.4 : 0); return G.scute && ii % 2 && Math.sin(th2) > -0.3 ? tc.multiplyScalar(1 - G.scute[1]) : tc; }), { c: '#ffffff', jit: 0, m: HIDE, ao: 0.1, vary: 0.02 });
        claw(TG.tip, dir.clone().addScaledVector(pN, ground ? -0.25 : -0.6).normalize(), pN, tr * 0.62, G.toe[2] * lk);
      }
    }
    // a bird's foot (G.bird: { splay (radians between the three forward toes), back (the hind toe's length, of a
    // forward one's) }): three long toes fanned forward and one turned back from the heel, so it grips like a bird's
    function birdToe(G, t, sd, lk, tw, pT, pN, pS, j3) {
      var BD = G.bird;
      if (t === 3) return { dir: pT.clone().negate().applyAxisAngle(pN, -sd * 0.35).normalize(), b0: j3.clone().addScaledVector(pT, G.paw[2] * lk * 0.15).addScaledVector(pN, 0.005), tl: G.toe[0] * lk * (BD.back || 0.5) };
      var u = t - 1;
      return { dir: pT.clone().applyAxisAngle(pN, u * (BD.splay || 0.45)).normalize(), b0: j3.clone().addScaledVector(pS, u * tw * 0.35).addScaledVector(pT, G.paw[2] * lk * 0.5).addScaledVector(pN, 0.005), tl: G.toe[0] * lk * (u === 0 ? 1.1 : 0.92) };
    }
    // a curved claw from p along dir, hooking down (toward -nrm), thick at the root
    function claw(p, dir, nrm, r0, len) {
      var c0 = p.clone().addScaledVector(dir, -r0 * 0.6), c1 = p.clone().addScaledVector(dir, len * 0.55).addScaledVector(nrm, len * 0.06), c2 = p.clone().addScaledVector(dir, len).addScaledVector(nrm, -len * 0.35);
      var CG = curveRings([c0, c1, c2], len / 5, len * 0.15, 2), CF = rmf(CG.T, nrm);
      self.addGeo(tubeGeo2(CG, CF, 6, function (ii) { return r0 * Math.pow(1 - CG.st[ii] / 2, 0.8) * CG.k[ii] + 0.002; }, function () { return C.claw; }), { c: '#ffffff', jit: 0, m: M.paint, ao: 0, vary: 0.02 });
    }

    // ---- wings: a strong arm (humerus and forearm) from the shoulder with smooth knuckles, four long fingers curving a
    // little and fanned wide from the wrist, and a membrane that billows between them with a deeply scalloped trailing
    // edge, lighter toward its edges. Folded, the arm stands proud along the top of the flank and the fingers and the
    // membrane lie back over it to the hips like a cloak, a little off the skin, so its edge and its knuckle read.
    function wing(sd) {
      var W = LF.wing, FD = FDy, span = W.span * ag.wingK;
      var ri = ringAt(W.st), r = R[ri], thR = sd > 0 ? W.a : Math.PI - W.a;
      var out = r.S.clone().multiplyScalar(sd), upv = r.N.clone(), back = r.T.clone().negate();
      function Lw(v) { return out.clone().multiplyScalar(v[0]).addScaledVector(upv, v[1]).addScaledVector(back, v[2]); }
      var root = surf(ri, 0, thR, -0.1 * Math.sqrt(span));
      // (W.hipUp: the angle up the flank where the open membrane's trailing edge meets the body, 0.25 unless set:
      // higher for a short wing on a deep body, so its root never hangs down the flank as a dark sail)
      var hA0 = W.hipUp !== undefined ? W.hipUp : 0.25, hipI = ringAt(W.hip), hipP = surf(hipI, 0, sd > 0 ? hA0 : Math.PI - hA0, 0.01);
      var kk = sm(kOpen), wk = wFold;
      // spread: level in the air (with a little dihedral), held up on the ground by the pose's mantle
      // (W.mantle.other: the mantle in a pose the table doesn't name, such as a build's own; 0.85 if not given)
      var mant = air ? 0 : (W.mantle[pn] !== undefined ? W.mantle[pn] : W.mantle.other !== undefined ? W.mantle.other : 0.85), dih = P0.glide ? 0.3 : 0.32;
      // the mantle can be swept back about the upright (W.mSweep), turning its membrane out to the side; the night
      // dragon's faces straight forward (0), so the near wing and the far one show alike from either three-quarter
      var swc = Math.cos(W.mSweep || 0), sws = Math.sin(W.mSweep || 0);
      function swp(v) { return [Math.max(0.08, v[0] * swc - v[2] * sws), v[1], v[0] * sws + v[2] * swc]; }
      var elbowF = [0.3, 0.06, 0.48], wristF = [0.36, 0.2, -0.3], elbowS = lerp3(W.elbow, swp(W.mElbow), mant), wristS = lerp3(W.wrist, swp(W.mWrist), mant);
      // gliding, a modest V: the arm a little up and the hand held out nearly flat, so from the side the near wing shows
      // a sliver of its face and the far one a low line over the back, never a sail or a hanging curtain
      var gU = P0.glide && W.glideUp ? W.glideUp : [0, 0, 0];
      elbowS[1] += gU[0]; wristS[1] += gU[1];
      // (and the arm swept back a little with the hand, so the far wing seen from the side recedes as a swept blade)
      if (P0.glide && W.glideSweep) [elbowS, wristS].forEach(function (v, qq) { var a2 = W.glideSweep * (0.25 + 0.25 * qq), c2 = Math.cos(a2), s2 = Math.sin(a2), x0 = v[0]; v[0] = x0 * c2 - v[2] * s2; v[2] = v[2] * c2 + x0 * s2; });
      var nFg = W.fing.length, fingF = nFg === 4 ? [[0.05, -0.04, 1], [0.05, -0.2, 1], [0.05, -0.36, 1], [0.04, -0.52, 1]] : fingersShut(nFg), flen = W.flen;
      var fingS = W.fing.map(function (f, qq) { return lerp3([f[0], f[1] * dih + gU[2] * (1 - qq / (nFg - 1)), f[2]], swp(W.mFing[qq]), mant); });
      // gliding, the fingers swept back (the leading ones most), so the wing is a swept blade of a delta with its tips
      // trailing, and the far one seen from the side leans back over the body instead of standing up square
      if (P0.glide && W.glideSweep) fingS = fingS.map(function (f, qq) { var a2 = W.glideSweep * (1 - qq / (nFg - 1)), c2 = Math.cos(a2), s2 = Math.sin(a2); return [Math.max(0.03, f[0] * c2 - f[2] * s2), f[1], f[2] * c2 + f[0] * s2]; });
      // the open wing's bones, in the world
      var elbow = root.clone().add(Lw(lerp3(elbowF, elbowS, kk)).multiplyScalar(span));
      var wrist = elbow.clone().add(Lw(lerp3(sub3(wristF, elbowF), sub3(wristS, elbowS), kk)).multiplyScalar(span));
      // the fingers fan out ahead of the arm's reach, so a half-open wing still shows a broad membrane, never a spear
      var kf = sm(kOpen * 1.8);
      var tips = fingF.map(function (f, qq) { var d = Lw(lerp3(f, fingS[qq], kf)).normalize(); return wrist.clone().addScaledVector(d, flen[qq] * span * (0.6 + 0.4 * kk)); });
      if (air && !P0.glide) tips = tips.map(function (t2, qq) { return t2.add(upv.clone().multiplyScalar((W.flap === undefined ? 0.35 : W.flap) * span * (qq + 1) / tips.length)); });
      // the folded wing's, on the skin: V(station, angle up from the side, how far out); the layout shrinks with a
      // smaller wing, and keeps low under a saddle so the rider's legs lie over it
      var sad = sadW, sMid = (LF.saddle[0] + LF.saddle[1]) / 2;
      var FP = foldPt, rootF = V(W.st, W.a, -0.1 * Math.sqrt(span)), elbowFd = FP(FDE[0], FDE[1], FDE[2]), wristFd = FP(FDW[0], FDW[1], FDW[2]);
      var tipsF = FDT.map(function (t2) { return FP(t2[0], t2[1]); }), hipF = FYk ? foldUp(V(W.hip, FD.hipA, 0.01)) : V(W.hip, FD.hipA, 0.01);
      // how far the folded cloak stands off the skin at finger fi (0 the top one, 3 the lowest; fractions between) and a1
      // of the way from the wrist to the tips: further toward its lower edge (which so throws a line of shadow) and toward
      // its tips (flare); and behind the hips its upper corner lifts clear of the rump (lift, less in a pose lying
      // down), so the folded wing's tips break the back's line and the wing reads at a glance, never a wingless cat
      // (FD.yLift: how much of it a hatchling keeps, a half unless given)
      var fLift = (FD.lift || 0) * (FD.liftP && FD.liftP[pn] !== undefined ? FD.liftP[pn] : 1) * (FD.yLift === undefined ? 1 - young * 0.5 : 1 - young * (1 - FD.yLift));
      // (curled up, the cloak lies close and flat over the bent back: offK)
      var offK = (FD.offP && FD.offP[pn] !== undefined ? FD.offP[pn] : 1) * (FD.young ? 1 - young * (1 - FD.young.offK) : 1);
      // (the wrist's knuckle: a clear bump over the shoulder standing, a soft one lying down or on the young (knP; knY:
      // how much of it a hatchling keeps, half unless the kind says), so a crouched or curled wing never shows a pair of
      // round knobs)
      var knK = (FD.knuckle || 0.3) * (FD.knP && FD.knP[pn] !== undefined ? FD.knP[pn] : 1) * (1 - young * (1 - (FD.knY === undefined ? 0.5 : FD.knY)));
      // (FD.puff: the cloak domed that much further off the skin over its middle, a rounded bud of folded leather)
      function foldZ(fi, a1) { return (FD.off * (0.62 + 0.13 * fi) + (FD.flare || 0) * a1 * a1 + (FD.puff ? FD.puff * Math.sin(Math.PI * Math.min(1, a1 * 1.05)) * (0.55 + 0.45 * Math.sin(Math.PI * fi / (nFg - 1))) : 0)) * offK + fLift * Math.pow(a1, 2.5) * (1 - fi / (nFg - 1)); }
      // (FD.yFlat: how much closer a young one's folded wing lies on its round little body: its standing off, flare, lift
      // and knuckle less by young times that, so it lies along the flank as a soft cape, never a flap stood up off it)
      if (FD.yFlat) { var yF = 1 - young * FD.yFlat; fLift *= yF; offK *= yF; knK *= yF; }
      // a point of the folded layout put on the skin. Under a saddle (and its cloth) the folded wing goes in under the
      // leather: over the cloth's footprint, above its lower edge, it sinks into the skin, so the seat, the cloth and the
      // rider's legs lie clean over it and the wing comes out from under their edges
      var sts = R.map(function (q) { return q.st; }), SDk = LF.saddle, bl = !!o.blanket;
      var cs0 = bl ? SDk[0] - 0.26 : SDk[0] - 0.08, cs1 = bl ? SDk[1] + 0.14 : SDk[1] + 0.04, ca0 = (bl ? 0.2 : 0.24) * Math.PI - 0.14;
      function onSkin(v) {
        var lo = 0, hi = nR - 1; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (sts[m] <= v.x) lo = m; else hi = m; }
        var f = U.clamp((v.x - sts[lo]) / Math.max(1e-6, sts[hi] - sts[lo]), 0, 1), off = v.z;
        if (sad) { var cov = sm((v.x - cs0) / 0.1) * sm((cs1 - v.x) / 0.1) * sm((v.y - ca0) / 0.12); off = off * (1 - cov) - 0.07 * cov; }
        // (FD.smooth: laid over the skin as it would be without its lumps, so a folded wing rides over the rocks under
        // it as one smooth leathery bud instead of draping into every crevice)
        _nl = !!FD.smooth;
        var sp = surf(lo, f, sd > 0 ? v.y : Math.PI - v.y, off);
        _nl = false;
        return sp;
      }
      // a wing point: the open one and the folded one blended by how folded the wing is, kept out of the body
      function WP(p3, pf) {
        if (wk <= 0) return p3;
        var q3 = wk >= 1 ? onSkin(pf) : p3.clone().lerp(onSkin(pf), wk);
        if (wk < 1) { var b = bodyAt(q3, ri - 45, ri + 30); if (b && b.rho < b.r + 0.015) q3 = atRho(b, b.r + 0.015); }
        return q3;
      }
      // the membrane's billow: up into the wind in the air, and held low at rest (a crouch's spread wing) bellied up
      // between the fingers like a sail, so it shows its camber and never lies as a flat blade; held up in a mantle it cups back
      // like a cape held open, so even a wing seen nearly edge-on shows the curve of its face (mB: how much, and which
      // way is out of the cup)
      var bil = (air ? 0.1 : 0.07) * kk, mK = air ? 0 : sm((mant - 0.3) / 0.4), mB = 0.09 * kk;
      function cupN(n) { if (mK < 0.5) return n; var n2 = n.clone(); if (n2.dot(back) < 0) n2.negate(); return n2; }
      var br = 0.085 * Math.sqrt(span), brK = 1 - 0.3 * wk;
      function bez(f3, t2) { var a1 = (1 - t2) * (1 - t2), b1 = 2 * t2 * (1 - t2), c1 = t2 * t2; return f3[0].clone().multiplyScalar(a1).addScaledVector(f3[1], b1).addScaledVector(f3[2], c1); }
      // the arm: a tube from inside the shoulder, its root laid into the back; folded, thinner and half sunk in the skin
      var elbowW = WP(elbow, elbowFd), wristW = WP(wrist, wristFd);
      // a little past the wrist, so its knuckle rounds off (folded, only just: a soft knob at the shoulder)
      var ext = wristW.clone().addScaledVector(wristW.clone().sub(elbowW).normalize(), br * 0.9 * (1 - 0.75 * wk));
      var AG = curveRings([W.arm ? root.clone().addScaledVector(out, -W.arm.deep).addScaledVector(upv, -W.arm.deep * 0.5) : root, elbowW, wristW, ext], 0.05 / det, br * 0.8, 3), AF = rmf(AG.T, upv);
      var nA = Math.max(10, Math.round(14 * det));
      var ga = tubeGeo2(AG, AF, nA, function (ii) {
        var s2 = AG.st[ii], rr2 = br * (0.62 + 0.9 * (1 - sm(s2 / 0.55)) + 0.2 * gs(s2 - 1, 0.18) + (0.14 + knK * wk) * gs(s2 - 2, 0.22) - 0.1 * sm((s2 - 1) / 0.9));
        // folded under a saddle the forearm thins where it passes beneath the rider's legs
        var sq = sad ? 1 - 0.6 * wk * gs((s2 < 1 ? W.st + (elbowFd.x - W.st) * s2 : elbowFd.x + (wristFd.x - elbowFd.x) * U.clamp(s2 - 1, 0, 1)) - sMid, 0.2) * sm(s2 / 0.5) : 1;
        return rr2 * AG.k[ii] * (s2 < 0.5 ? 1 : brK) * sq * (W.arm ? armK(W.arm, s2, wk) : 1);
      }, function (ii) { var cc = AG.C[ii]; hideCol(cc.x, cc.y, cc.z, 0); if (C.wbone) tc.lerp(C.wbone, sm((AG.st[ii] - (W.boneFrom === undefined ? 0.25 : W.boneFrom)) / 0.4)); return FD.arm && wk > 0 ? tc.lerp(C.memFold, FD.arm * wk * sm((AG.st[ii] - 0.3) / 0.6)) : tc; });
      // (FD.arm: how much of the cloak's colour the folded arm takes past the shoulder, so on a pale kind the arm and
      // its knuckle read as the wing's own leading edge, never a white tube ending in a pearl; W.bone: the arm's own
      // colour from W.boneFrom along it (0.25 unless set), the wing's bone showing as a leading edge)
      // only the shoulder end is laid into the back: folded, the forearm stays proud of the flank
      filletTube(ga, AG, nA, W.arm ? W.arm.upto + wk * 0.35 : 0.55 + wk * 0.35, W.arm ? W.arm.fil : 0.06, ri, 30);
      if (W.rootSkin) bodySkin(ga, AG, nA, ri, W.rootSkin);
      self.addGeo(floorGeo(ga), { c: '#ffffff', jit: 0, m: HIDE, ao: 0.15, vary: 0.02 });
      // a small dark thumb claw at the wrist (tucked away when folded)
      if (W.thumb) thumbClaw(W.thumb, wristW, elbowW, Lw, out, upv, br, wk);
      else if (wk < 0.6) claw(wristW.clone().addScaledVector(upv, br * 0.5), Lw([0.25, 0.5, -0.85]).normalize(), out, br * 0.28, br * 1.3);
      // fingers: a little curve back toward the trailing edge; folded, they lie side by side under the membrane
      // (W.boneOpen: their own colour while the wing is open, for a pale kind whose bones must draw its white wing)
      var boneC = W.boneOpen ? lin(W.boneOpen) : null;
      function fingCol(edgeF) { tc.copy(C.skin).lerp(boneC, 1 - wk); if (FD.arm) tc.lerp(C.memFold, wk * FD.arm); return edgeF ? tc.lerp(C.foldEdge, wk * 0.7) : tc; }
      var fcur = tips.map(function (t2, qq) {
        var d = t2.clone().sub(wrist), Lf = d.length(), nx = qq < tips.length - 1 ? tips[qq + 1].clone().sub(t2) : back.clone();
        nx.addScaledVector(d, -nx.dot(d) / (Lf * Lf)); if (nx.lengthSq() > 1e-6) nx.normalize();
        return [wrist.clone(), wrist.clone().lerp(t2, 0.5).addScaledVector(nx, Lf * 0.045).addScaledVector(upv, Lf * 0.02 * kk), t2];
      });
      var fcurF = tipsF.map(function (t2, qq) { var m = wristFd.clone().lerp(t2, 0.5); m.y += 0.025 * (qq - 1); return [wristFd.clone(), m, t2]; });
      var fW = fcur.map(function (f3, qq) { return [wristW.clone(), WP(f3[1], fcurF[qq][1]), WP(f3[2], fcurF[qq][2])]; });
      fW.forEach(function (f3, qq) {
        var pts = []; for (var q3 = 0; q3 <= 6; q3++) pts.push(bez(f3, q3 / 6));
        // folded, each finger lies in the membrane, half proud of it: a soft ridge down the cloak
        // (the two between lie under the cloak, only a soft ridge in it; the top and the lowest ones are its edges, a step
        // lighter, so the folded wing shows its outline and never a bundle of hoses)
        // (W.fingR: the finger bones that much thicker, so a short wing's three show as raised ribs in its membrane)
        var edgeF = qq === 0 || qq === fW.length - 1, fr0 = br * 0.5 * (W.fingR || 1) * (1 - 0.45 * wk);
        if (wk > 0.5) for (q3 = 1; q3 <= 6; q3++) { var fb = bez(fcurF[qq], q3 / 6); fb.z = foldZ(qq, q3 / 6) - fr0 * (1 - 0.72 * q3 / 6) * (edgeF ? 0.15 : 1.1 + 0.8 * (1 - offK)); pts[q3] = pts[q3].clone().lerp(onSkin(fb), (wk - 0.5) * 2); }
        var FG = curveRings(pts, 0.1 / det, br * 0.25, 2), FF = rmf(FG.T, upv);
        self.addGeo(floorGeo(tubeGeo2(FG, FF, Math.max(5, Math.round(6 * det)), function (ii) { var u2 = FG.st[ii] / 6; return (fr0 * (1 - 0.72 * u2) + fr0 * 0.18 * gs(u2 - 0.3, 0.06)) * FG.k[ii]; }, function () { if (boneC) return fingCol(edgeF); var cb = C.wbone || C.skin; return edgeF && !(FD.seam && qq === 0) ? tc.copy(cb).lerp(C.foldEdge, wk * 0.7) : cb; })), { c: '#ffffff', jit: 0, m: HIDE, ao: 0.05, vary: 0.02 });
      });
      // the membrane, panel by panel, as a grid that sags or billows between its bones; each panel worked out open (in
      // the world) and folded (on the skin), then blended. Folded it is one smooth cloak, pleated a little between the
      // fingers, with the inner panel tucked under it.
      var mpos = [], mcol = [], midx = [], gR = [];
      // folded, a step lighter and bluer than the hide, so the cloak separates from the flank
      var memIn = C.mem.clone().lerp(C.skin, 0.5), memF = C.memFold, fdk = FD.dark === undefined ? 0.7 : FD.dark;
      // (efn: how much of the folded cloak's lighter edge a point carries)
      function grid(na, nb, fn, cfn, efn) {
        var base = mpos.length / 3, ia, ib, i0 = midx.length;
        for (ia = 0; ia <= na; ia++) for (ib = 0; ib <= nb; ib++) {
          var p = fn(ia / na, ib / nb); mpos.push(p.x, p.y, p.z); var cc = cfn(ia / na, ib / nb);
          if (wk > 0) { cc = cc.clone().lerp(memF, wk * fdk); if (efn) cc.lerp(C.foldEdge, wk * efn(ia / na, ib / nb)); }
          mcol.push(cc.r, cc.g, cc.b);
        }
        for (ia = 0; ia < na; ia++) for (ib = 0; ib < nb; ib++) { var a1 = base + ia * (nb + 1) + ib, b1 = a1 + 1, c1 = a1 + nb + 1, d1 = c1 + 1; midx.push(a1, c1, b1, b1, c1, d1); }
        gR.push([i0, midx.length]);
      }
      var pna = Math.max(6, Math.round(10 * det)), pnb = Math.max(5, Math.round(8 * det));
      function panelPt(fa, fb, a1, b1, wr, ctlK, bl, nrm) {
        var tA = fa[2], tB = fb[2], mid = tA.clone().add(tB).multiplyScalar(0.5), ctl = mid.clone().lerp(wr, ctlK);
        var A1 = bez(fa, a1), B1 = bez(fb, a1), wdt = A1.distanceTo(B1);
        var E = bez([tA, ctl, tB], b1), lin2 = tA.clone().lerp(tB, b1);
        var p = A1.clone().lerp(B1, b1).addScaledVector(E.sub(lin2), Math.pow(a1, 1.6));
        return p.addScaledVector(nrm, bl * wdt * Math.sin(Math.PI * b1) * Math.pow(Math.sin(Math.PI * Math.min(1, a1 * 1.1)), 0.7) * 1.4);
      }
      var zF = V(0, 0, 1);
      for (q = 0; q < tips.length - 1; q++) (function (qa) {
        var fa = fcur[qa], fb = fcur[qa + 1], nrm = fa[2].clone().sub(wrist).cross(fb[2].clone().sub(wrist)).normalize(); if (nrm.dot(upv) < 0) nrm.negate();
        grid(pna, pnb, function (a1, b1) {
          var p3 = wk >= 1 ? null : panelPt(fa, fb, a1, b1, wrist, (W.scallop !== undefined ? W.scallop : 0.4) + 0.1 * (1 - kk), mK < 0.5 ? bil : mB * mK, cupN(nrm));
          // folded: the panels side by side, a shallow pleat between each pair of fingers (FD.pleat deep), the edge
          // scalloped a little (FD.scallop; none tucks the scallops under, one smooth edge)
          var pf = wk <= 0 ? null : panelPt(fcurF[qa], fcurF[qa + 1], a1, b1, wristFd, FD.scallop === undefined ? 0.05 : FD.scallop, 0, zF);
          // the cloak stands further off toward its lower edge, so that edge steps clear of the flank
          if (pf) pf.z = foldZ(qa + b1, a1) - (FD.pleat === undefined ? 0.014 : FD.pleat) * offK * Math.sin(Math.PI * b1) * Math.sin(Math.PI * Math.min(1, a1 * 1.15));
          return WP(p3, pf);
        }, function (a1, b1) { var e = W.edge ? memBand(a1, b1) : Math.pow(a1, 2) * (0.6 + 0.4 * Math.sin(Math.PI * b1)); return tc.copy(memIn).lerp(C.mem, Math.min(1, a1 * 2.5)).lerp(C.memEdge, e); },
        // folded, the cloak's lower edge (along the last finger) and its trailing scallops a step lighter
        // (and its top edge too, along the first finger, where the high cameras of the builds look down on it: FD.edgeTop,
        // how much, and FD.edgeLow [how much, where across the last panel it starts] the lower edge's: less and narrower
        // for a pale kind whose cloak must stay darker than the white flank and back beside it; FD.seam: only a thin seam,
        // see foldSeam)
        function (a1, b1) { if (FD.seam) return foldSeam(qa === tips.length - 2, a1, b1); var eL = FD.edgeLow || [0.85, 0.62]; return Math.max(qa === tips.length - 2 ? eL[0] * sm((b1 - eL[1]) / (1 - eL[1])) * sm(a1 / 0.2) : 0, qa === 0 ? (FD.edgeTop === undefined ? 0.75 : FD.edgeTop) * (1 - sm(b1 / 0.4)) * sm(a1 / 0.25) : 0, 0.6 * sm((a1 - 0.82) / 0.18)); });
      })(q);
      // the inner panel: the arm, the last finger, the trailing edge to the hip, and the line along the flank
      var last = fcur[fcur.length - 1], t4 = last[2], lastF = fcurF[fcurF.length - 1], t4F = lastF[2];
      var armC = elbow.clone().multiplyScalar(2).addScaledVector(root, -0.5).addScaledVector(wrist, -0.5);
      var ctr = root.clone().add(wrist).add(t4).add(hipP).multiplyScalar(0.25), tctl = t4.clone().lerp(hipP, 0.5).lerp(ctr, 0.35);
      var tctlF = t4F.clone().lerp(hipF, 0.5);
      var stR = R[ri].st, stH = R[hipI].st;
      var nrm2 = wrist.clone().sub(root).cross(hipP.clone().sub(root)).normalize(); if (nrm2.dot(upv) < 0) nrm2.negate();
      function coons(bot, top, left, right, c00, c10, c01, c11, u1, v1) {
        return bot.multiplyScalar(1 - v1).addScaledVector(top, v1).addScaledVector(left, 1 - u1).addScaledVector(right, u1)
          .addScaledVector(c00, -(1 - u1) * (1 - v1)).addScaledVector(c10, -u1 * (1 - v1)).addScaledVector(c01, -(1 - u1) * v1).addScaledVector(c11, -u1 * v1);
      }
      grid(pna, pnb + 2, function (v1, u1) {
        var p3 = null, pf = null;
        if (wk < 1) {
          var bot = bez([root, armC, wrist], u1), top = bez([hipP, tctl, t4], u1), right = bez(last, v1);
          var bi = ringAt(stR + (stH - stR) * v1), left = surf(bi, 0, sd > 0 ? W.a + (hA0 - W.a) * v1 : Math.PI - (W.a + (hA0 - W.a) * v1), 0.012);
          if (v1 === 0) left = root.clone(); if (v1 === 1) left = hipP.clone();
          p3 = coons(bot, top, left, right, root, wrist, hipP, t4, u1, v1).addScaledVector(cupN(nrm2), (mK < 0.5 ? bil : mB * mK * 0.6) * 0.8 * span * Math.sin(Math.PI * u1) * Math.sin(Math.PI * v1));
        }
        if (wk > 0) {
          // folded: tucked away under the finger panels, from the arm back to the hip, lying on the flank (the body
          // paints a soft shadow under the cloak's lower edge)
          pf = coons(rootF.clone().lerp(wristFd, u1), hipF.clone().lerp(t4F, u1), rootF.clone().lerp(hipF, v1), bez(lastF, v1), rootF, wristFd, hipF, t4F, u1, v1);
          pf.z = 0.01 + 0.02 * u1 * v1;
        }
        return WP(p3, pf);
      }, function (v1, u1) { var e = W.edge ? memBand(v1, 0.5) * Math.pow(Math.sin(Math.PI * Math.min(1, u1 * 1.2)), 0.3) / 0.8 : Math.pow(v1, 2.2) * Math.sin(Math.PI * Math.min(1, u1 * 1.2)); return tc.copy(memIn).lerp(C.mem, Math.min(1, v1 * 2 + u1 * 0.5)).lerp(C.memEdge, e * 0.8); });
      // the leading edge: a strip of membrane in front of the arm from the shoulder to the wrist, broadest at the elbow,
      // so an open or mantled wing seen from the front is a broad sail from its root, never a flag on a bare arm (it
      // folds away with the wing)
      if (wk < 0.98) {
        var armCW = elbowW.clone().multiplyScalar(2).addScaledVector(root, -0.5).addScaledVector(wristW, -0.5), pw2 = 0.24 * span * (1 - wk);
        grid(pna, 3, function (u1, v1) {
          var ap = bez([root, armCW, wristW], u1), at2 = bez([root, armCW, wristW], Math.min(1, u1 + 0.02)).sub(bez([root, armCW, wristW], Math.max(0, u1 - 0.02))).normalize();
          var fd = r.T.clone().addScaledVector(upv, 0.35).addScaledVector(at2, -r.T.clone().addScaledVector(upv, 0.35).dot(at2)).normalize();
          return ap.addScaledVector(fd, pw2 * v1 * Math.pow(Math.sin(Math.PI * Math.min(1, u1 * 1.08)), 0.8) * (1 - 0.25 * v1 * v1)).addScaledVector(upv, -br * 0.3 * (1 - v1));
        }, function (u1, v1) { return tc.copy(memIn).lerp(C.mem, 0.5).lerp(C.memEdge, 0.5 * v1 * v1); });
      }
      var gm = new T.BufferGeometry(); gm.setAttribute('position', new T.Float32BufferAttribute(mpos, 3)); gm.setAttribute('color', new T.Float32BufferAttribute(mcol, 3)); gm.setIndex(midx); gm.computeVertexNormals();
      if (W.faceUp) faceUp(gm, upv.clone().addScaledVector(out, 0.3), W.faceUp === 'panel' ? gR : null);
      // (LF.wing.sheer: drawn on kit-core's membrane material, lit through from behind)
      self.addGeo(floorGeo(gm), { c: '#ffffff', jit: 0, m: W.sheer && M.memb !== undefined ? M.memb : HIDE, bucket: 'cloth', ao: 0.08, vary: 0.02 });
    }

    // ---- the open jaw: the lower jaw as its own loft under the line of the mouth (the skin below the line, and a floor
    // across its top dipping into a dark pink channel), turned down about the hinge at the mouth's corner; small pale
    // teeth along both jaws
    function jaw() {
      if (!JA) return;
      var m0 = MO[0], ih = ringAt(3 + m0), JP = jawPivot(), hinge = JP.hinge, rot = JP.rot;
      var nLp = Math.max(10, Math.round(18 * det)), nIn = Math.max(3, Math.round(5 * det)), nF = nIn + 3, nJ = nLp + nF;
      // (LF.fangs { n, len, from }: how many each side of each jaw, their length (of the head's size) and where along the
      // mouth from its corner they start (0..1), for a kind that shows a few bigger teeth at the front instead of a row)
      // (LF.teeth { n, len, w, blunt }: the kind's own row: how many each side on each jaw (5 unless set), their length
      // (of the usual), their width (of their length, 0.36 unless set) and a flat top (that share of the base's width),
      // for a full row of short crushing teeth instead of a few small fangs)
      // (LF.beakTeeth [how many each side on each jaw, how far in from the lip (a fraction of the way to the mouth's
      // middle), along the head to where the last one stands, the first one's length]: a beak's even rows set right on its
      // rims and stopping short of its hooked point; LF.jawRim: the colour of the lower jaw's rim, a pale beak edge in
      // place of the dark lip)
      var TE = LF.fangs, TT = LF.teeth, TB = LF.beakTeeth, JR = LF.jawRim ? lin(LF.jawRim) : null;
      var jp = [], jc = [], nRing = 0, lastC = null, lastT = null, teeth = [], tq = 0, nT = TE ? TE.n : TT && TT.n || (TB ? TB[0] : 5), k, fl = [];
      // where the skin crosses the line of the mouth on the right side (an angle), or null where it no longer does
      function crossAt(r) {
        var lo = -HALFPI, hi = 0;
        if (rAt(r, lo, true) * Math.sin(lo) - r.ymE >= 0) return null;
        for (var it = 0; it < 16; it++) { var mid = (lo + hi) / 2; if (rAt(r, mid, true) * Math.sin(mid) - r.ymE < 0) lo = mid; else hi = mid; }
        return (lo + hi) / 2;
      }
      for (var ii = ih; ii < nR; ii++) {
        var r = R[ii]; if (!r.mouthK || r.st < 3 + m0 + 0.004) continue;
        var thR = crossAt(r); if (thR === null) break;
        var ring = [], cols = [];
        // the lower jaw a touch narrower than the upper, so open it reads as its own form, set inside the upper one
        for (k = 0; k <= nLp; k++) {
          var th = thR - k / nLp * (Math.PI + 2 * thR), rad = rAt(r, th, true), cs = Math.cos(th), sn = Math.sin(th);
          var p = r.c.clone().addScaledVector(r.S, cs * rad * 0.95).addScaledVector(r.N, sn * rad);
          if (UB) p.addScaledVector(r.T, ubAt(r, sn * rad));
          ring.push(p); cols.push(Math.min(k, nLp - k) < (JR ? 2 : 1) ? (JR || C.lip || C.gum).clone() : skinCol(r, th, rad, p.x, p.y, p.z).clone());
        }
        // the floor, from the left lip back to the right: a dark rim of lip each side (where the lower teeth stand), then
        // the pink of the mouth dipping into a deep channel between them
        var xL = ring[nLp].clone().sub(r.c).dot(r.S), xR = ring[0].clone().sub(r.c).dot(r.S), dep = Math.max(0.008, (r.hb + r.ymE) * 0.6);
        var lipF = U.clamp(0.04 * hk / Math.max(0.02, xR - xL), 0.08, 0.26), inC = C.mouthIn.clone().lerp(C.dark, 0.35 * (1 - sm((r.st - 3 - m0) / 0.35))), rims = [];
        for (k = 1; k < nF; k++) {
          var rim = k === 1 || k === nF - 1, f = k === 1 ? lipF : k === nF - 1 ? 1 - lipF : lipF + (1 - 2 * lipF) * (k - 1) / (nIn + 1);
          var fp = r.c.clone().addScaledVector(r.S, xL + (xR - xL) * f).addScaledVector(r.N, r.ymE - (rim ? 0.006 * hk : dep * Math.pow(Math.sin(Math.PI * (f - lipF) / (1 - 2 * lipF)), 0.6)));
          if (UB) fp.addScaledVector(r.T, ubAt(r, r.ymE - 0.05 * hk));
          ring.push(fp); cols.push(rim ? (JR || C.gum).clone() : inC.clone());
          if (rim) rims.push(fp);
        }
        if (LF.tongue) fl.push({ p: r.c.clone().addScaledVector(r.S, (xL + xR) / 2).addScaledVector(r.N, r.ymE - dep).addScaledVector(r.T, UB ? ubAt(r, r.ymE - 0.05 * hk) : 0), n: r.N.clone(), w: xR - xL, d: dep });
        // the rings above run clockwise seen from the snout: turn them round so the skin faces out
        ring.reverse(); cols.reverse();
        ring.forEach(function (q) { jp.push(q.x, q.y, q.z); }); cols.forEach(function (c) { jc.push(c.r, c.g, c.b); });
        nRing++; lastC = r.c.clone().addScaledVector(r.N, r.ymE - (r.hb + r.ymE) * 0.4); lastT = r.T;
        // teeth: evenly from just in front of the corner to near the tip, one each side on each jaw
        // (fangs: from TE.from along the mouth to near the tip, the first a little shorter)
        var hh2 = r.st - 3, t0, want;
        if (TE) { t0 = m0 + (0.93 - m0) * TE.from; want = t0 + (0.93 - t0) * tq / Math.max(1, nT - 1); } else want = m0 + 0.12 + ((TB ? TB[2] : 0.93) - m0 - 0.12) * tq / (nT - 1);
        if (tq < nT && hh2 >= want) {
          var tl = (TE ? TE.len * (0.8 + 0.2 * tq / Math.max(1, nT - 1)) : TT ? (0.052 - tq * 0.02 / nT) * (TT.len || 1) : TB ? TB[3] * (1 - 0.35 * tq / (nT - 1)) : 0.052 - tq * 0.004) * hk * (1 - young * 0.35);
          // the upper ones just inside the upper lip, the lower ones standing on the lower jaw's dark rim
          [ring[0], ring[nLp]].forEach(function (lp, e) {
            var inn = lp.clone().lerp(r.c.clone().addScaledVector(r.N, r.ymE), TB ? TB[1] : 0.12);
            teeth.push({ p: inn.clone().addScaledVector(r.N, 0.004), d: r.N.clone().negate().addScaledVector(r.T, 0.18).normalize(), l: tl, low: false });
            teeth.push({ p: rims[e === 0 ? 1 : 0].clone().addScaledVector(r.N, -0.004), d: r.N.clone().addScaledVector(r.T, 0.12).addScaledVector(r.S, e === 0 ? -0.25 : 0.25).normalize(), l: tl * 0.85, low: true });
          });
          tq++;
        }
      }
      if (nRing < 2) return;
      // close the back (inside the head) and the tip
      var c0 = V(0, 0, 0); for (k = 0; k < nJ; k++) c0.add(V(jp[k * 3], jp[k * 3 + 1], jp[k * 3 + 2])); c0.multiplyScalar(1 / nJ);
      var tip = lastC.addScaledVector(lastT, 0.012 * hk);
      jp.push(c0.x, c0.y, c0.z, tip.x, tip.y, tip.z); jc.push(C.mouthIn.r, C.mouthIn.g, C.mouthIn.b, C.skin.r, C.skin.g, C.skin.b);
      var g = skinGeo(jp, jc, nRing, nJ, true, true), pa = g.attributes.position, v = V(0, 0, 0);
      for (k = 0; k < pa.count; k++) { v.set(pa.getX(k), pa.getY(k), pa.getZ(k)).sub(hinge).applyMatrix4(rot).add(hinge); pa.setXYZ(k, v.x, v.y, v.z); }
      g.computeVertexNormals();
      self.addGeo(g, { c: '#ffffff', jit: 0, m: HIDE, ao: 0.2, vary: 0.02 });
      if (LF.tongue) tongue(fl, hinge, rot);
      // the teeth: small pale cones, the lower ones turned down with the jaw
      if (JA < 0.12) return;
      var r3 = new T.Matrix3().setFromMatrix4(rot);
      teeth.forEach(function (t) {
        var p = t.p.clone(), d = t.d.clone();
        if (t.low) { p.sub(hinge).applyMatrix4(rot).add(hinge); d.applyMatrix3(r3).normalize(); }
        var tw = TT && TT.w || 0.36, gt = TT && TT.blunt ? new T.CylinderGeometry(t.l * tw * TT.blunt, t.l * tw, t.l, 7, 1) : new T.ConeGeometry(t.l * 0.36, t.l, 5, 1); gt.translate(0, t.l / 2, 0); gt.deleteAttribute('uv');
        gt.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(V(0, 1, 0), d)));
        gt.translate(p.x, p.y, p.z);
        self.addGeo(solidCol(gt, C.tooth), { c: '#ffffff', jit: 0, m: M.paint, ao: 0, vary: 0.03 });
      });
    }

    // (LF.tongue: { w (its width, of the jaw's floor), h (its thickness, of the floor's depth), from, to (where it lies
    // along the floor, 0 its back and 1 its tip), col }: a thick round tongue lying in the lower jaw's channel, its lower
    // half sunk in the floor, turned down with the jaw, so an open mouth shows a form in its dark, never a flat slot of
    // colour. fl: the floor's channel, ring by ring: { p (its bottom), n (up), w (the floor's width), d (its depth) })
    function tongue(fl, hinge, rot) {
      var TG = LF.tongue, n = fl.length; if (n < 3) return;
      var a = fl[Math.round((n - 1) * TG.from)], b = fl[Math.round((n - 1) * TG.to)], ax = b.p.clone().sub(a.p), L = ax.length() / 2;
      if (L < 1e-4) return;
      ax.normalize();
      var up2 = a.n.clone().add(b.n); up2.addScaledVector(ax, -up2.dot(ax)).normalize();
      var sv = ax.clone().cross(up2).normalize(), w = (a.w + b.w) / 4 * TG.w, h = (a.d + b.d) / 2 * TG.h;
      var g = new T.SphereGeometry(1, 12, 8); g.deleteAttribute('uv');
      g.applyMatrix4(new T.Matrix4().makeScale(w, h, L * 1.15));
      g.applyMatrix4(new T.Matrix4().makeBasis(sv, up2, ax));
      var m = a.p.clone().lerp(b.p, 0.5).addScaledVector(up2, h * 0.25);
      g.translate(m.x - hinge.x, m.y - hinge.y, m.z - hinge.z); g.applyMatrix4(rot); g.translate(hinge.x, hinge.y, hinge.z);
      g.computeVertexNormals();
      self.addGeo(solidCol(g, lin(TG.col)), { c: '#ffffff', jit: 0, m: HIDE, ao: 0.25, vary: 0.02 });
    }
    // ---- the head's pieces: a point on the head at u along it (0 the back of the skull, 1 the snout's tip), angle a up
    // from the side on side sd, and the skin's normal there
    function headPt(u, a, sd, off) { var ii = ringAt(3 + u); return { p: surf(ii, 0, sd > 0 ? a : Math.PI - a, off || 0), n: surfN(ii, sd > 0 ? a : Math.PI - a), i: ii }; }
    var hf = R[ringAt(3.5)], hfT = hf.T, hfN = hf.N, hfS = hf.S;
    // eyes: big and wide set under the brow, yellow-green, darker at the rim; a slit pupil (round and big on the young);
    // a white catchlight. On the glow material, so they read in shade.
    function eye(sd) {
      var hp = headPt(eyU, aE, sd), nrm = hp.n;
      // the socket's axis: the skin's normal turned well forward (EY[3]) and a little up (EY[4]), so the two eyes look
      // ahead together like a cat's and both read from the front and three-quarters, never one on each side
      var ax = nrm.clone().lerp(hfT, EY[3] * (1 - young * 0.2)).addScaledVector(hfN, EY[4] || 0).normalize();
      // the gaze: toward what it looks at, but never far off the socket's axis, so the pupil stays in the middle of the
      // eye that shows (the young look straight out of their round eyes; LF.gMax: how far it may turn, for a kind
      // whose eye shows less of itself)
      var gaze = ax.clone();
      if (o.look) { var lw2 = A(o.look).sub(hp.p).normalize(); gaze.lerp(lw2, 0.5).normalize(); }
      var gMax = Math.max(0, (LF.gMax === undefined ? 0.34 : LF.gMax) - young * 0.2), gA = gaze.angleTo(ax);
      if (gA > gMax) gaze = ax.clone().applyAxisAngle(ax.clone().cross(gaze).normalize(), gMax);
      // (LF.eyeOut: the eyeball set that much of its radius further out of its socket, so a small eye on a broad head
      // stands proud of the face and shows its front from ahead)
      var ctr = hp.p.clone().addScaledVector(nrm, -eR * (0.6 - eOut));
      var Z = gaze, Y = hfN.clone().addScaledVector(Z, -hfN.dot(Z)).normalize(), X = Y.clone().cross(Z);
      var mtx = new T.Matrix4().makeBasis(X, Y, Z).setPosition(ctr);
      // (its poles turned onto the gaze, so the iris's rings of colour run round it as circles)
      var eg = new T.SphereGeometry(eR, Math.round(24 * det), Math.round(14 * det)).rotateX(HALFPI), ep = eg.attributes.position, ec = [];
      for (var k = 0; k < ep.count; k++) {
        var z = ep.getZ(k) / eR, x = ep.getX(k) / eR, y = ep.getY(k) / eR, ang = Math.acos(U.clamp(z, -1, 1));
        // a yellow-green iris, brighter round the pupil, falling off to a darker green toward its edge and a dark ring
        // at the rim, so it reads wet and set in rather than a flat disc
        tc.copy(C.irisIn).lerp(C.iris, sm(ang / 0.3)).lerp(C.irisRim, sm((ang - 0.3) / 0.45)).lerp(C.dark, 0.7 * sm((ang - 0.74) / 0.22));
        tc.multiplyScalar(1 - 0.35 * sm((y - 0.35) / 0.5));   // the lid's shadow over the top
        ec.push(tc.r, tc.g, tc.b);
      }
      eg.setAttribute('color', new T.Float32BufferAttribute(ec, 3)); eg.applyMatrix4(mtx);
      self.addGeo(eg, { c: '#ffffff', jit: 0, m: M.glow !== undefined ? M.glow : M.paint, ao: 0, vary: 0 });
      // the lids: shells over the top and the bottom of the eye, a little proud of it, their margins rolled in and dark,
      // so the eye sits in the head under a heavy upper lid
      // the upper lid: heavy and calm on the grown dragon, lower still for a sly or unimpressed look in some poses (and
      // lower as it looks down); higher on the young, wide-eyed
      var lidU = LF.lid[0] + (FY && FY.lid !== undefined ? (FY.lid - LF.lid[0]) * yb : 0) - (LF.lidDrop && LF.lidDrop[pn] || 0) + young * 0.36 + U.clamp(gaze.dot(hfN) + 0.1, -0.3, 0.2) * 0.4;
      [[1, lidU], [-1, LF.lid[1]]].forEach(function (Ld) {
        var sg = Ld[0], te = Math.acos(U.clamp(sg * Ld[1], -1, 1)), lp = [], lc = [], nTh = 6, nPh = Math.round(18 * det), a2, b2;
        for (a2 = 1; a2 <= nTh + 1; a2++) {
          var thx = a2 <= nTh ? te * a2 / nTh : te + 0.07, rr = a2 <= nTh ? eR * 1.08 : eR * 1.0;
          for (b2 = 0; b2 < nPh; b2++) {
            var ph3 = b2 / nPh * TAU, lx = Math.sin(thx) * Math.cos(ph3), lz = Math.sin(thx) * Math.sin(ph3) * sg, ly = Math.cos(thx) * sg;
            lp.push(lx * rr, ly * rr, lz * rr); tc.copy(C.skin).lerp(C.dark, a2 > nTh - 1 ? 0.7 : 0); lc.push(tc.r, tc.g, tc.b);
          }
        }
        lp.push(0, sg * eR * 1.08, 0); lc.push(C.skin.r, C.skin.g, C.skin.b);
        // the pole goes first in skinGeo's order: move it to the end and use it as the start pole
        var lg2 = skinGeo(lp, lc, nTh + 1, nPh, true, false);
        // a slight slant to the lid line: the outer corner a touch lower, for a soft, hooded look (LF.lidTilt: a kind's
        // own slant, more for a scowl)
        lg2.applyMatrix4(new T.Matrix4().makeRotationZ(sg * (LF.lidTilt === undefined ? 0.12 : LF.lidTilt) * sd)); lg2.applyMatrix4(mtx);
        self.addGeo(lg2, { c: '#ffffff', jit: 0, m: HIDE, ao: 0, vary: 0.02 });
      });
      // the pupil: a patch of the eye's own surface, a hair proud of it, its rows spaced evenly round its edge so the
      // young's round one is a smooth circle, never a polygon
      var pw = young ? 0.42 : 0.1, phh = young ? 0.46 : 0.5, pp = [], pc = [], pi = [], nu = 6, nv = 18, a1, b1;
      // (LF.pupil [half width, half height]: a grown one's own pupil, as a rounder one for a small eye a slit would lose)
      if (LF.pupil && !young) { pw = LF.pupil[0]; phh = LF.pupil[1]; }
      for (a1 = 0; a1 <= nu; a1++) for (b1 = 0; b1 <= nv; b1++) {
        var ph2 = (a1 / nu * 2 - 1), pv2 = -Math.cos(b1 / nv * Math.PI), w2 = pw * Math.sin(b1 / nv * Math.PI);
        var ax = ph2 * w2, ay = pv2 * phh, d = V(Math.sin(ax), Math.sin(ay) * Math.cos(ax), Math.cos(ax) * Math.cos(ay)).normalize().multiplyScalar(eR * 1.006);
        pp.push(d.x, d.y, d.z); pc.push(0.004, 0.005, 0.006);
      }
      for (a1 = 0; a1 < nu; a1++) for (b1 = 0; b1 < nv; b1++) { var i0 = a1 * (nv + 1) + b1, i1 = i0 + 1, i2 = i0 + nv + 1, i3 = i2 + 1; pi.push(i0, i2, i1, i1, i2, i3); }
      var pg = new T.BufferGeometry(); pg.setAttribute('position', new T.Float32BufferAttribute(pp, 3)); pg.setAttribute('color', new T.Float32BufferAttribute(pc, 3)); pg.setIndex(pi); pg.computeVertexNormals(); pg.applyMatrix4(mtx);
      self.addGeo(pg, { c: '#ffffff', jit: 0, m: M.glow !== undefined ? M.glow : M.paint, ao: 0, vary: 0 });
      // a catchlight, up and toward the light
      var hl = V(-0.16 * sd, young ? 0.2 : 0.24, 0).add(V(0, 0, 1)).normalize().applyMatrix4(new T.Matrix4().extractRotation(mtx)), hg = new T.SphereGeometry(eR * 0.13, 8, 6);
      var hp2 = ctr.clone().addScaledVector(hl, eR * 0.97); hg.scale(1, 1, 0.4); lay(hg, hp2, X, hl.clone());
      self.addGeo(solidCol(hg, lin('#f7f6f1')), { c: '#ffffff', jit: 0, m: M.glow !== undefined ? M.glow : M.paint, ao: 0, vary: 0 });
    }
    // ear flaps: a big pair sweeping back along the skull from its top, a smaller pair under and in front of them and
    // little ones along the cheek and the jaw. Soft leaves, thick at the root, cupped and a little twisted so they show
    // some of their face from most sides, their tips curling back and down.
    function ears() {
      LF.ears.forEach(function (E) {
        [1, -1].forEach(function (sd) {
          // the young's a little shorter for their big heads but broader and softer (a round leaf, never a nub)
          var ek = Math.pow(hk, 0.55) * (1 + young * (E.yk || 0)), hp = headPt(E.at, E.a - yb * 0.15, sd, -0.025 * hk), L2 = E.len * ek, W2 = E.w * ek * (1 + young * (E.yw || 0));
          // ridden, the big pair shorter and swept up and out (LF.riddenEar), clear of the rider and his legs
          var rd2 = o.rider && !air && E.len > 0.4 ? 1 : 0;
          var RE = LF.riddenEar || [1, 0, 0];
          if (rd2) L2 *= RE[0];
          // (a young one carries the big pair perkier: less droop and less curl over at the tip, never a puppy's lop ears;
          // or, where an ear asks (yUp, yBack: how much more up and back the young's points), its own way)
          // (in the air every ear streams back in the wind, level with the skull, never hanging under the jaw)
          var yUp = E.len > 0.4 ? yb : 0, ak = air ? 1 : 0, curl = E.curl * (1 - 0.6 * yUp) * (1 - 0.7 * ak);
          var dir = hfT.clone().multiplyScalar(-E.dir[0] - 0.45 * ak - (E.yBack || 0) * yUp).addScaledVector(hfN, E.dir[1] * (1 - 0.8 * ak) + (E.yUp === undefined ? 0.2 : E.yUp) * yUp - rd2 * RE[1]).addScaledVector(hfS, sd * E.dir[2] * (1 + rd2 * RE[2]) * (1 - 0.35 * ak)).normalize();
          // (E.level: how much of the head's pitch the ear leaves out, so a long swept ear stays near level as the head
          // looks down or up, lying back over the neck instead of standing up like a rabbit's when it looks down; the
          // young's left to rise as yUp sets them)
          if (E.level && !air) { dir.y *= 1 - E.level * (1 - yUp); dir.normalize(); }
          var face = hfS.clone().multiplyScalar(sd * E.face[0]).addScaledVector(hfN, E.face[1]).addScaledVector(hfT, E.face[2]).normalize();
          // (with the head down on the ground, as curled up, an ear that would reach under it is levelled out over the
          // ground and its tip curls less, so it lies out flat on the ground instead of through it, never stood up)
          if (!air) for (var q4 = 0; q4 < 4; q4++) {
            var Zq = face.clone().addScaledVector(dir, -face.dot(dir)).normalize(), tipY = hp.p.y + dir.y * L2 - Zq.y * curl * L2 - W2 * 0.5 * Math.abs(Zq.clone().cross(dir).y);
            if (tipY > 0.03) break;
            dir.y = Math.max(dir.y, -hp.p.y / L2 * 0.8) + 0.04; dir.normalize(); curl *= 0.5;
          }
          // the across axis lay() will use, so the sweep and the twist go the same way on both sides (down, and the
          // leading edge turned up)
          var Zf = face.clone().addScaledVector(dir, -face.dot(dir)).normalize(), Yf = Zf.clone().cross(dir), dn = Yf.dot(hfN) > 0 ? -1 : 1, bk2 = Yf.dot(hfT) > 0 ? -1 : 1;
          // the big ones a leaf broad in the middle; the small ones slimmer points. Their thin edges a touch lighter
          // (more so behind), the small ones barely, so they never read as pale discs; the big ones' upper face and rim
          // a cool step lighter again toward the tip (rim), so an ear lying over the black neck still separates from it
          var big = E.len > 0.4, lk2 = big ? 1 : 0.3, rim = E.rim || 0;
          // (the tip swept down by sweep and back by bsw: the leaf leaves the skull out to the side and curves back)
          var g = flapGeo(L2, function (u) { return W2 * (big ? earW(u) : leafW(u)); }, E.t * ek, curl, E.sweep * dn + (E.bsw || 0) * bk2, E.cup, E.twist * dn,
            Math.max(7, Math.round((big ? 12 : 8) * det)), Math.max(4, Math.round(6 * det)),
            function (u, v, sg) {
              tc.copy(C.skin).lerp(C.dark, 0.35 * lk2 * sm(u / 0.3)).lerp(C.memEdge, (sg < 0 ? 0.4 : 0.22) * lk2 * Math.sqrt(u) * Math.pow(Math.abs(v), 1.5) + 0.25 * lk2 * sm((u - 0.15) / 0.5) * gs(v, 0.5));
              return rim ? tc.lerp(C.foldEdge, rim * sm((u - 0.12) / 0.5) * (sg > 0 ? 0.55 + 0.45 * Math.pow(Math.abs(v), 2) : 0.6 * Math.pow(Math.abs(v), 2))) : tc;
            });
          // its root a little way back inside the head, so the open end never shows where it lies close along the skull
          lay(g, hp.p.clone().addScaledVector(dir, -0.06 * ek), dir, face);
          self.addGeo(floorGeo(g), { c: '#ffffff', jit: 0, m: HIDE, ao: 0.1, vary: 0.02 });
        });
      });
    }
    // a row of small dorsal plates from the back of the head down the spine to the tail: small rounded leaves lying
    // back along the spine, thick at the root, spaced well apart (never a crocodile's saw), fading away toward the tail,
    // where the back's own ridge (in the skin's profile) runs on to the tip as a keel
    function plates() {
      var PL = LF.plates, sk0 = o.saddle || o.rider, s2 = sOf(PL.from - young * 0.08), sEnd = sOf(PL.to), sw = [];
      while (s2 > sEnd) {
        var st2 = stOf(s2), sz = trackAt(PL.size, st2, sw)[0] * (st2 > 2.5 ? (1 + (hk - 1) * 0.6) : 1) * (1 - young * 0.3);
        s2 -= Math.max(sz, 0.02) * PL.gap;
        if (sz < 0.012 || sk0 && st2 > 1.45 && st2 < 2.02) continue;
        sz *= PL.poseK && PL.poseK[pn] || 1;
        var ii = ringAt(st2), r2 = R[ii], base = skinAt(st2, HALFPI, -sz * 0.22);
        var dir = r2.N.clone().multiplyScalar(0.52).addScaledVector(r2.T, -0.85);
        // (a broad round leaf leaning back, the hide's own tone with a lighter rim, so from above it reads as a soft
        // scallop of the back's line and never as a dark rivet)
        var g = flapGeo(sz * 0.95, function (u) { return sz * 0.62 * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - 0.1 * u) + sz * 0.03; }, sz * 0.36, 0, -0.2, 0.08, 0, 5, 4, function (u, v) { return tc.copy(C.skin2).lerp(C.foldEdge, 0.08 + 0.14 * sm((u + v * v - 0.45) / 0.55)); });
        lay(g, base, dir, r2.S.clone());
        // (shaded mostly as the back under it, so the side away from the sun never goes dark: no row of black dots)
        var gn = g.attributes.normal;
        for (var k3 = 0; k3 < gn.count; k3++) { var nv3 = V(gn.getX(k3), gn.getY(k3), gn.getZ(k3)).multiplyScalar(0.35).addScaledVector(r2.N, 0.65).normalize(); gn.setXYZ(k3, nv3.x, nv3.y, nv3.z); }
        self.addGeo(g, { c: '#ffffff', jit: 0, m: HIDE, ao: 0.1, vary: 0.02 });
      }
    }
    // the tail fins: a big pair at the very tip and a smaller pair a little up. On the grown night dragon the left tip
    // fin is the rider-made one in the Hub's orange, on dark iron rods.
    function tailFins() {
      LF.fins.forEach(function (Fn, pi2) {
        [1, -1].forEach(function (sd) {
          var ii = ringAt(Fn[0]), r2 = R[ii], made = K.prosthetic && pi2 === 0 && sd > 0 && young < 0.5;
          // (LF.finYk: how much shorter a hatchling's are, 0.3 unless the kind says)
          var fk = 1 - young * (LF.finYk === undefined ? 0.3 : LF.finYk), L2 = Fn[1] * fk, W2 = Fn[2] * fk, root = surf(ii, 0, sd > 0 ? 0.04 : Math.PI - 0.04, -0.018);
          // a leaf out from the side of the tail and back, its face up and tilted up a little (a shallow V, so the pair
          // shows in profile too), thick at the root, its tip swept back to a point; the two of a pair alike, flat
          // leaves both (the made one the same shape, only its colour and its iron differ)
          // (LF.finAir { lift, out }: in the air the pair's tilt up, its dihedral (the night's 0.16), and how much further
          // out it spreads, so a kind's long fins fly as a level pair and never stand up in a V)
          var FA = air && LF.finAir;
          var dir = r2.S.clone().multiplyScalar(sd * Fn[3] * (FA ? FA.out : 1)).addScaledVector(r2.T, -0.55).addScaledVector(r2.N, FA ? FA.lift : 0.16).normalize();
          var Yf = r2.N.clone().cross(dir).normalize(), bk = Yf.dot(r2.T) < 0 ? 1 : -1, sw = Fn[4] * W2 / L2;
          var wFn = function (u) { return W2 * Math.pow(Math.sin(Math.PI * (0.2 + 0.8 * u)), 0.6) * (1 - 0.12 * u); };
          if (LF.finW) wFn = finWidth(LF.finW, W2);
          // (the made one's cloth a warm orange, deeper toward its hemmed edge and its root, so it shades like the
          // black one beside it instead of a flat cut-out; the hem fades out toward the tip, so its point stays orange
          // and its outline reads as long as the black one's)
          var g = flapGeo(L2, wFn, LF.finT || 0.02, 0.04, sw * bk, LF.finCup === undefined ? 0.05 : LF.finCup, 0, Math.max(6, Math.round(9 * det)), Math.max(4, Math.round(6 * det)),
            function (u, v) { return made ? tc.copy(C.cloth).lerp(C.clothDk, 0.6 * sm((Math.abs(v) - 0.72) / 0.28) * (1 - sm((u - 0.55) / 0.35)) + 0.35 * (1 - sm(u / 0.3))) : tc.copy(C.mem).lerp(C.memEdge, 0.5 * u * u + 0.25 * v * v * u); });
          lay(g, root, dir, r2.N.clone());
          if (LF.finDrape && !air) finDrape(g, root, L2);
          self.addGeo(floorGeo(g), { c: '#ffffff', jit: 0, m: made ? M.cloth : HIDE, ao: 0.05, vary: 0.02 });
          if (made) {
            // the rider-made fin's iron: slim rods out along it (down its middle and near its leading edge, following its
            // sweep), and a band round the tail that holds it
            var face = r2.N.clone().addScaledVector(dir, -r2.N.dot(dir)).normalize();
            [[0, 0.9, 0.0105], [-0.55, 0.62, 0.008]].forEach(function (rd) {
              var pts = [];
              for (var q3 = 0; q3 <= 4; q3++) {
                var u = rd[1] * q3 / 4;
                pts.push(root.clone().addScaledVector(dir, u * L2).addScaledVector(Yf, bk * sw * u * u * L2 + rd[0] * wFn(u) * -bk).addScaledVector(face, 0.016 - 0.05 * u * u * L2));
              }
              for (q3 = 0; q3 < 4; q3++) self.beam(pts[q3].toArray(), pts[q3 + 1].toArray(), rd[2], { c: '#2b2b2c', m: M.metal, round: true, seg: 6 });
            });
            var cg = curveRings([r2.c.clone().addScaledVector(r2.T, -0.035), r2.c.clone().addScaledVector(r2.T, 0.035)], 0.035, 0.001, 1);
            self.addGeo(tubeGeo2(cg, rmf(cg.T, r2.N), 12, function (k2, th2) { return rAt(r2, th2) + 0.014; }, function () { return lin('#2b2b2c'); }), { c: '#ffffff', jit: 0, m: M.metal, ao: 0, vary: 0 });
          }
        });
      });
    }

    // ---- saddle, straps and a rider, laid on the new back: one clear leather seat (its back rolled up into a cantle,
    // its edge darker), one girth behind the forelegs and a breast strap round the front of the chest, and a pair of
    // iron handles at the front for the rider's hands
    function saddle() {
      var SD = LF.saddle, i0 = ringAt(SD[0]), i1 = ringAt(SD[1]), ic = ringAt((SD[0] + SD[1]) / 2), cL = lin('#6b4a32'), cRim = lin('#3b2a1f'), cL2 = lin('#4a3627');
      var spos = [], scol = [], sidx = [];
      function patch(ia, ib, a0, a1, off, cc, rim) {
        var base = spos.length / 3, nb = 14, ii, jj;
        for (ii = ia; ii <= ib; ii++) for (jj = 0; jj <= nb; jj++) {
          var th2 = a0 + (a1 - a0) * jj / nb, e = rim ? Math.min(1, Math.min(jj, nb - jj) / 3, Math.min(ii - ia, ib - ii) / 2) : 1;
          // the seat's back rows roll up into a low cantle
          var cant = rim ? 0.05 * sm(1 - (ii - ia) / Math.max(1, (ib - ia) * 0.3)) * Math.pow(Math.sin(Math.PI * jj / nb), 0.5) : 0;
          var p = surf(ii, 0, th2, off * (0.4 + 0.6 * e) + cant), c3 = rim ? cRim.clone().lerp(cc, sm((e - 0.3) / 0.5)) : cc;
          spos.push(p.x, p.y, p.z); scol.push(c3.r, c3.g, c3.b);
        }
        for (ii = 0; ii < ib - ia; ii++) for (jj = 0; jj < nb; jj++) { var a = base + ii * (nb + 1) + jj, b = a + 1, c = a + nb + 1, d = c + 1; sidx.push(a, b, c, b, d, c); }
      }
      patch(i0, i1, 0.24 * Math.PI, 0.76 * Math.PI, 0.05, cL, true);
      patch(i1 - 2, i1 - 1, -0.5 * Math.PI, 1.5 * Math.PI, 0.016, cL2, false);
      var nSt = 28, base0 = spos.length / 3, sFront = SD[1] - 0.03, sChest = 2.1;
      for (var js = 0; js <= nSt; js++) {
        var ts = js / nSt, ths = 0.32 * Math.PI - 1.64 * Math.PI * ts, sts = sFront + (sChest - sFront) * Math.pow(Math.sin(Math.PI * ts), 0.75);
        [-0.014, 0.014].forEach(function (dw) { var p = skinAt(sts + dw, ths, 0.014); spos.push(p.x, p.y, p.z); scol.push(cL2.r, cL2.g, cL2.b); });
      }
      for (js = 0; js < nSt; js++) { var sa = base0 + js * 2; sidx.push(sa, sa + 1, sa + 2, sa + 1, sa + 3, sa + 2); }
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(spos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(scol, 3)); g.setIndex(sidx); g.computeVertexNormals();
      // (LF.floorStraps: the seat and the girth pressed onto the ground with the skin where a belly lies on it)
      self.addGeo(LF.floorStraps ? floorGeo(g) : g, { c: '#ffffff', jit: 0, m: M.wood, bucket: 'cloth', ao: 0.1, vary: 0.04 });
      // a saddle cloth under the seat where a build asks for one (o.blanket: its colour), laid on the skin a little
      // longer and wider than the seat, so it follows the back wherever the pose puts it; its side edges hemmed dark
      if (o.blanket) {
        var bpos = [], bcol = [], bidx = [], cB = lin(o.blanket), cH = lin('#1f1e1c'), ba = ringAt(SD[0] - 0.2), bb = ringAt(SD[1] + 0.1), nbb = 18, ib2, jb;
        for (ib2 = ba; ib2 <= bb; ib2++) for (jb = 0; jb <= nbb; jb++) {
          var pb = surf(ib2, 0, (0.2 + 0.6 * jb / nbb) * Math.PI, 0.02), cb = Math.min(jb, nbb - jb) < 1 ? cH : cB;
          bpos.push(pb.x, pb.y, pb.z); bcol.push(cb.r, cb.g, cb.b);
        }
        for (ib2 = 0; ib2 < bb - ba; ib2++) for (jb = 0; jb < nbb; jb++) { var q0 = ib2 * (nbb + 1) + jb; bidx.push(q0, q0 + 1, q0 + nbb + 1, q0 + 1, q0 + nbb + 2, q0 + nbb + 1); }
        var gb = new T.BufferGeometry(); gb.setAttribute('position', new T.Float32BufferAttribute(bpos, 3)); gb.setAttribute('color', new T.Float32BufferAttribute(bcol, 3)); gb.setIndex(bidx); gb.computeVertexNormals();
        self.addGeo(gb, { c: '#ffffff', jit: 0, m: M.cloth, bucket: 'cloth', ao: 0.15, vary: 0.03 });
      }
      var rf = R[i1], hand = surf(i1, 0, HALFPI, 0.06);
      [1, -1].forEach(function (e) { var hb = hand.clone().addScaledVector(rf.S, e * 0.1); self.beam(hb.toArray(), hb.clone().addScaledVector(rf.N, 0.13).addScaledVector(rf.T, 0.04).toArray(), 0.018, { round: true, c: '#8f8a80', m: M.metal }); });
      if (o.rider) {
        // the rider sits astride, the seat at the top of the back; his legs round the barrel of the chest
        var rc = R[ic], top = surf(ic, 0, HALFPI, 0.05), halfW = rAt(rc, 0) * ag.s, key = Math.round(halfW * 20);
        var pn = 'dragonride' + key;
        if (!KIT.people.poses[pn]) KIT.people.poses[pn] = rideFor(halfW);
        var yaw2 = Math.atan2(rc.T.x, rc.T.z), pitch2 = Math.asin(U.clamp(rc.T.y, -1, 1));
        self.push(top.x, top.y + (0.06 - 0.92) / ag.s, top.z, yaw2);
        if (Math.abs(pitch2) > 0.02) self.stack[self.stack.length - 1].multiply(new T.Matrix4().makeRotationX(-pitch2));
        self.figure(0, 0, Object.assign({ role: 'villager', pose: pn, c: '#3b3a38', cape: '#1f1e1c', s: 1 / ag.s }, o.rider));
        self.pop();
      }
    }

    // ================================================================ the kinds' own features
    // Each of these is off unless the kind's K.loft asks for it (the night dragon asks for none of them).

    // ---- a two-legged body (LF.biped): no forelegs, the wings its arms. The trunk is pitched up about the hips like a
    // bird's (tilt: radians by pose, less ridden (riddenK) and on the young (yk)), the hips raised or lowered with it
    // (hipY by pose), the neck giving back part of the pitch so the head rides level on an S of a neck (neckBack), the
    // tail held up toward the hips' height as the counterweight (tailUp by pose: 1 level with them, its tip a little
    // lower), and on the ground the feet set under the hips, the body's balance point (feet by pose: [half their spread,
    // how far ahead of the hips]); in the air the pose's own feet, tucked back. A pose missing from tilt, hipY or tailUp
    // takes 0 there; one missing from feet takes the stand's.
    function bipedBody() {
      var BP = LF.biped, k, rk = o.rider && !air ? (BP.riddenK === undefined ? 0.5 : BP.riddenK) : 1;
      var tl = (BP.tilt[pn] || 0) * rk * (1 - young * (BP.yk === undefined ? 0.2 : BP.yk)), hy = (BP.hipY && BP.hipY[pn] || 0) * (1 - young * 0.4), tu = BP.tailUp && BP.tailUp[pn] || 0;
      var fw = keys[6].clone().sub(keys[4]); fw.y = 0; if (fw.lengthSq() < 1e-6) fw.set(0, 0, 1); fw.normalize();
      // (turning about fw x up by a positive angle lifts the front)
      var ax = fw.clone().cross(up).normalize(), lf = up.clone().cross(fw).normalize();
      if (hy) for (k = 2; k <= 11; k++) keys[k].y += hy * (k >= 5 ? 1 : [0, 0, 0.3, 0.6, 0.85][k]);
      var hp = keys[5].clone();
      if (tl) for (k = 6; k <= 11; k++) keys[k] = keys[k].clone().sub(hp).applyAxisAngle(ax, tl).add(hp);
      var nb = (BP.neckBack || 0) * tl;
      if (nb) for (k = 9; k <= 11; k++) keys[k] = keys[k].clone().sub(keys[8]).applyAxisAngle(ax, -nb).add(keys[8]);
      // (BP.tailLine: the heights tailUp holds the tail's keys at, tip first, as fractions of the hips')
      var tln = BP.tailLine || [0.55, 0.7, 0.83, 0.93, 1];
      if (tu) for (k = 0; k <= 4; k++) keys[k].y += (hp.y * tln[k] - keys[k].y) * tu;
      // (BP.neckS { pose: [lean, lift] }: the neck drawn into an S like a bird's, its root leaning forward off the chest by
      // lean (radians) and its upper half turned back up by lift, so the head rides high over a curved throat instead
      // of at the end of a straight pole; the young's half as much)
      var NS = BP.neckS && BP.neckS[pn];
      if (NS) {
        var yk2 = 1 - young * 0.5;
        for (k = 9; k <= 11; k++) keys[k] = keys[k].clone().sub(keys[8]).applyAxisAngle(ax, -NS[0] * yk2).add(keys[8]);
        for (k = 10; k <= 11; k++) keys[k] = keys[k].clone().sub(keys[9]).applyAxisAngle(ax, NS[1] * yk2).add(keys[9]);
      }
      if (!air && BP.feet) {
        var FB = BP.feet[pn] || BP.feet.stand;
        [['hl', 1], ['hr', -1]].forEach(function (e) { var f = hp.clone().addScaledVector(lf, e[1] * FB[0] * (1 - young * 0.15)).addScaledVector(fw, FB[1] * (1 - young * 0.3)); f.y = 0; feet[e[0]] = f; });
      }
    }

    // ---- the neck held this kind's own way (LF.neckKeys { pose: [[x, y, z] x 3] }): the spine's three neck keys (9, 10
    // and 11, the last the back of the skull) in that pose, from the shoulders' key, before the neck's length (LF.neck,
    // neckP and the young's shortening) scales them, so a long neck can carry an S: forward out of the chest, up, and
    // over into the head; a pose missing from it keeps the pose's own neck
    function neckKey(i) { var s8 = P0.spine[8], d = NKk[i - 9]; return [s8[0] + d[0], s8[1] + d[1], s8[2] + d[2]]; }
    // ---- the head carried higher than the pose's own (LF.headUp { pose: radians }): its way turned up by that much (the
    // young's half as much), so a long-beaked head rides proud with its beak level instead of pointing at its chest
    function headUp(a) {
      var hz = Math.max(1e-6, Math.hypot(fwd.x, fwd.z)), e = Math.atan2(fwd.y, hz) + a * (1 - young * 0.5);
      fwd.set(fwd.x / hz * Math.cos(e), Math.sin(e), fwd.z / hz * Math.cos(e));
    }

    // ---- a curved head (LF.beak [a, b, c]): the head's last three keys (a third, two thirds and all the way along it)
    // moved up (> 0) or down (< 0) by those fractions of its length, so the snout arches down into a hooked, parrot-like
    // beak (or tips up); the young's much less (LF.beak[3]: how much less, 0.6 unless given)
    function beakBend() {
      var hu = up.clone().addScaledVector(fwd, -up.dot(fwd)).normalize();
      for (var q = 0; q < 3; q++) CP[12 + q].addScaledVector(hu, HL * LF.beak[q] * (1 - yb * (LF.beak[3] === undefined ? 0.6 : LF.beak[3])));
    }

    // ---- the head kept off the ground (LF.headFloor: the clearance left under its jaw, world units): on the ground,
    // where a pose lays the head lower than its own depth (a curl with a rider aboard reaching it forward and down), the
    // head and the top of the neck are lifted just enough, so the eyes and the snout never sink through; a head resting
    // on the ground keeps resting on it, its jaw a little pressed (only four fifths of its depth is kept clear)
    function headOffFloor() {
      var hp = [], d = 0;
      for (var q = 11; q <= 14; q++) { trackAt(LF.prof, 3 + (q - 11) / 3, hp); d = Math.max(d, hp[2] * hk * 0.8 + LF.headFloor - CP[q].y); }
      if (d > 0) [[9, 0.3], [10, 0.7], [11, 1], [12, 1], [13, 1], [14, 1]].forEach(function (e) { CP[e[0]].y += d * e[1]; });
    }

    // ---- lumps and knobs grown into the skin (LF.lumps): swellings of the skin's own profile, so they rise out of the
    // hide with no seam, and the limbs' fillets, the folded wings and everything laid on the skin follow them.
    // { seed, runs: [{ st: [from, to] (stations), a: [from, to] (angles up from the side, the same both sides), n (how
    // many tried), size: [min, max] (their radius in world units; on the head scaled with it), h: [min, max] (their
    // height, of the radius), p (the profile's power: 2 a round swelling, 3 to 4 a flat-topped rock with steep sides,
    // nearer 1 a peaked knob), sep: [stations, radians] (the least distance between two of a run; closer ones are
    // dropped) }], yk (how much of their height a hatchling keeps), hi / hiK / hiH (a lighter colour on their tops, how
    // much, and the height that takes all of it) }. The layout comes from the kind's seed, so it is the same in every
    // pose and at every age.
    function lumpRings() {
      var LU = LF.lumps, rg = U.rng(LU.seed || 5), list = [], yk = 1 - young * (1 - (LU.yk === undefined ? 0.5 : LU.yk));
      LU.runs.forEach(function (Ru) {
        var mine = [], sep = Ru.sep || [0.05, 0.3];
        for (var k = 0; k < Ru.n; k++) {
          var st = Ru.st[0] + (Ru.st[1] - Ru.st[0]) * rg(), a = Ru.a[0] + (Ru.a[1] - Ru.a[0]) * rg(), sz = Ru.size[0] + (Ru.size[1] - Ru.size[0]) * rg(), h = Ru.h[0] + (Ru.h[1] - Ru.h[0]) * rg(), ok = true;
          for (var m = 0; m < mine.length && ok; m++) { var d1 = (st - mine[m].st) / sep[0], d2 = (a - mine[m].a) / sep[1]; if (d1 * d1 + d2 * d2 < 1) ok = false; }
          if (ok && Ru.clear) ok = lumpClear(list, st, a, sz, Ru.clear);
          if (!ok) continue;
          // (Ru.yk: the run's own height on the young, for soft baby knobs along the spine and over the brow)
          var gk2 = 1 + (hk - 1) * sm((st - 2.86 + young * 0.26) / (0.18 + young * 0.3)), yk2 = Ru.yk === undefined ? yk : 1 - young * (1 - Ru.yk);
          mine.push({ st: st, a: a, sz: sz * gk2, h: h * sz * gk2 * yk2, p: Ru.p || 2, bare: Ru.bare });
          // (a run's twin [share, size]: that share of its lumps grows a smaller one fused onto its side (size: of its
          // own), the two sharing one foot, so some rocks come in pairs instead of one even scatter of beads)
          if (Ru.twin && rg() < Ru.twin[0]) {
            var tR = R[ringAt(st)], trr = Math.max(0.02, Math.sqrt(tR.w * Math.max(tR.ht, tR.hb))), ta = rg() * TAU, ts = sz * Ru.twin[1] * (0.8 + 0.4 * rg()), td = (sz + ts) * 0.6;
            var tst = stOf(U.clamp(sOf(st) + td * Math.cos(ta), 0, SE));
            mine.push({ st: tst, a: a + td * Math.sin(ta) / trr, sz: ts * gk2, h: h * ts * gk2 * yk2, p: Ru.p || 2, bare: Ru.bare });
          }
        }
        list = list.concat(mine);
      });
      // (dropped only now, so a saddle never moves the others)
      if (o.saddle || o.rider) list = list.filter(function (L) { return !L.bare || L.st < LF.saddle[0] - 0.12 || L.st > LF.saddle[1] + 0.12; });
      list.forEach(function (L) { L.s = sOf(L.st); });
      for (var i2 = 0; i2 < nR; i2++) {
        var r = R[i2], rr = Math.max(0.02, Math.sqrt(r.w * Math.max(r.ht, r.hb))), on = null;
        for (var q = 0; q < list.length; q++) {
          var L = list[q], ds = (r.s - L.s) / L.sz;
          if (ds * ds < 5) (on || (on = [])).push({ a: L.a, wa: L.sz / rr, ds2: ds * ds, h: L.h * r.k, p: L.p });
        }
        if (on) r.lumps = on;
      }
    }
    // (a run's clear: its lumps kept that many times their own and the other's size (world units, along the skin) clear
    // of the earlier runs' ones, so the small stones sit between the big rocks, never on them; and bare: its lumps
    // left out under a saddle, so the seat lies on the back instead of riding the rocks)
    function lumpClear(list, st, a, sz, k) {
      var s1 = sOf(st), r = R[ringAt(st)], rr = Math.max(0.02, Math.sqrt(r.w * Math.max(r.ht, r.hb)));
      for (var m = 0; m < list.length; m++) { var L = list[m], ds = s1 - sOf(L.st), da = (a - L.a) * rr, dd = (sz + L.sz) * k; if (ds * ds + da * da < dd * dd) return false; }
      return true;
    }
    // (LF.lumps.lo / loK: a darker colour in the crease round each lump's foot, and how much, by its height against
    // hiH, so a big rock stands out of the hide with a shadowed seam round it that survives the paint)
    function lumpFoot(r, a) {
      var v = 0, Ls = r.lumps, H = LF.lumps.hiH;
      for (var q = 0; q < Ls.length; q++) { var L = Ls[q], da = (a - L.a) / L.wa, d = Math.sqrt(L.ds2 + da * da); if (d < 1.8) v = Math.max(v, sm(L.h / H) * gs(d - 1.12, 0.22)); }
      return v * (1 - sm(lumpAt(r, a) / H));
    }
    // the lumps' height at angle a on a ring
    // (the last answer kept, since the skin's shape and its colour ask it of the same point in turn; and, for a hide of
    // hundreds of lumps (LF.lumps.lut), the falloff exp(-d2^(p/2)) tabled once per power over d2 0..5, since every point
    // of the hide asks it of each lump near it; a kind with a few lumps keeps the exact falloff)
    // (set lazily: the body's rings ask before this line is reached)
    var _lR, _lA, _lV, _lut;
    function lumpAt(r, a) {
      if (r === _lR && a === _lA) return _lV;
      var v = 0, Ls = r.lumps;
      for (var q = 0; q < Ls.length; q++) { var L = Ls[q], da = (a - L.a) / L.wa, d2 = L.ds2 + da * da; if (d2 < 5) v += L.h * (L.p === 2 ? Math.exp(-d2) : LF.lumps.lut ? lumpK(L.p, d2) : Math.exp(-Math.pow(d2, L.p / 2))); }
      _lR = r; _lA = a; _lV = v;
      return v;
    }
    function lumpK(p, d2) {
      var t = (_lut || (_lut = {}))[p], k;
      if (!t) { t = _lut[p] = new Float64Array(514); for (k = 0; k <= 513; k++) t[k] = Math.exp(-Math.pow(k / 512 * 5, p / 2)); }
      var x = d2 * 102.4, k0 = x | 0; return t[k0] + (t[k0 + 1] - t[k0]) * (x - k0);
    }

    // ---- nostrils on the snout's rounded tip (LF.noseCap): where the snout rounds over, its rings crowd together
    // along the spine as they shrink to its point, so a nostril measured along the spine would stretch down the tip
    // into a long groove to the middle of the mouth (two of them a frowning V). Measured instead along the skin, the
    // way the tip rounds over (each ring that much further on as it has shrunk from its own size), it stays a round
    // nostril. (LF.noseRim [rim, mound, mound's width, hole]: the rim round each nostril, and a broad swelling under it,
    // so it flares, both of the nostril's size; [0.16, 0, 1] unless set; hole: a crisp dark opening inside the rim
    // instead of a soft shadow, that strong.)
    function noseOnCap() {
      var se = [], k, q;
      for (k = 0; k < nR; k++) se.push(R[k].s + Math.max(R[k].ht, R[k].w) / Math.max(0.05, R[k].k) * (1 - R[k].k));
      for (k = 0; k < nR - 1 && R[k + 1].s < sN; k++);
      var sNe = k < nR - 1 ? se[k] + (se[k + 1] - se[k]) * U.clamp((sN - R[k].s) / Math.max(1e-6, R[k + 1].s - R[k].s), 0, 1) : se[nR - 1];
      for (q = 0; q < nR; q++) {
        if (R[q].st < 2.9) continue;
        var ns = (se[q] - sNe) / nR0;
        if (Math.abs(ns) < 2.6) { R[q].noseS = ns; R[q].noseA = nR0 / (R[q].w / Math.max(0.05, R[q].k) * 0.6); } else delete R[q].noseS;
      }
    }

    // ---- brows that run in a V (LF.browA [[station, angle], ...]): the brow's ridge set that far round the ring above
    // the eye (instead of 0.34 all along), so it can climb in toward the top of the skull as it runs forward over the
    // eye, and from the front the two ridges come down together over the muzzle in a scowl; the young's stay put
    function browRings() {
      var ba = [];
      for (var i2 = 0; i2 < nR; i2++) if (R[i2].brow) R[i2].bA = aE + 0.34 + (trackAt(LF.browA, R[i2].st, ba)[0] - 0.34) * (1 - yb);
    }

    // ---- an underbite (LF.underbite [jut, from]): the lower jaw longer than the upper, its front pushed forward by jut
    // (of the head's length) under the line of the mouth, coming in from 'from' along the head to the snout, so the
    // lower lip stands out in front of the upper one and what grows from it (tusks: a spike run with lip) shows with
    // the mouth shut; the young's half as much. How far a point y (up from the head's axis) on ring r moves forward:
    // ---- the eye's rim (LF.eyeRim [over it, under it], of the eye's radius): a heavy brow arched over a small eye (the
    // young's lighter); and the lips (LF.lipCrease [the crease's depth, how far the lower jaw is set in under it (less
    // than 0: it stands proud, as an underbite's heavy lower lip does)], world units on a grown head). Both are read in
    // rAt.
    function ubAt(r, y) { return UB[0] * HL * (1 - yb * 0.5) * r.mouthK * sm((r.st - 3 - UB[1]) / Math.max(0.05, 1 - UB[1])) * sm((r.ym - y) / (0.03 * hk)); }

    // ---- a soft-lit hide (LF.skinSoft [reach, k]): the body's shading normals blended k of the way to their average
    // over reach rings and reach points round each way, so a knobbly hide keeps its stones in its outline and in its
    // colour, while its light falls in broad planes that read from across a build instead of a camouflage of small
    // lights and darks (most of all in shade, where the sky lights every stone's top and darkens its side)
    function softNormals(nr, m, k) {
      var n = nR * nS, a = new Float32Array(n * 3), b = new Float32Array(n * 3), i, j, q, c, w = 1 / (2 * m + 1);
      for (i = 0; i < nR; i++) for (j = 0; j < nS; j++) for (c = 0; c < 3; c++) {
        var sA = 0; for (q = -m; q <= m; q++) sA += nr[(i * nS + (j + q + nS) % nS) * 3 + c]; a[(i * nS + j) * 3 + c] = sA * w;
      }
      for (i = 0; i < nR; i++) for (j = 0; j < nS; j++) for (c = 0; c < 3; c++) {
        var sB = 0; for (q = -m; q <= m; q++) sB += a[(U.clamp(i + q, 0, nR - 1) * nS + j) * 3 + c]; b[(i * nS + j) * 3 + c] = sB * w;
      }
      // (the body's only: the head keeps its crisp sockets, nostrils and mouth)
      for (i = 0; i < n * 3; i += 3) {
        var kk = k * (1 - sm((R[(i / 3 / nS) | 0].st - 2.8) / 0.12));
        var x = nr[i] + (b[i] - nr[i]) * kk, y = nr[i + 1] + (b[i + 1] - nr[i + 1]) * kk, z = nr[i + 2] + (b[i + 2] - nr[i + 2]) * kk, L = Math.hypot(x, y, z) || 1;
        nr[i] = x / L; nr[i + 1] = y / L; nr[i + 2] = z / L;
      }
    }

    // ---- the hide's patterns: a belly band in its own colour (LF.band), spots (LF.spots), stone mottling (LF.stone),
    // and the lumps' lighter tops (LF.lumps.hi), painted over the hide's own mottle and belly on the body's skin.
    //   band: { col, col2 (its edges' tone), edge (the band takes the skin below sin = -edge round the ring), soft (how
    //     soft its edge, in the same terms; softY: the young's, blended in by age), wave (how much its edge wanders),
    //     st: [[station, how much (, its edge moved by this: less than 0 up the flank, more down)], ...] along the
    //     body, scute: [spacing (world units), darkness]: the lines between the belly's plates, yk: how much of its
    //     bright core a hatchling has (1; less: a duskier young belly in the edge's tone) }
    //   spots: { col, size (their radius, world units), dens (how many: 0..1), a: [from, to] (the angles round the ring
    //     they cover), st: [from, to] (the stations), stretch (drawn out along the body by this), seed }; laid out from
    //     the hips forward, so they keep their places on the body from pose to pose, each side its own
    //   stone: { cols: [dark, light], scale (the patches' frequency, per world unit), k: [dark, light] (how much) }
    function patCol(r, th, sn, x, y, z) {
      var cs = Math.cos(th), a = Math.atan2(sn, Math.abs(cs));
      if (STONE) {
        var sc = STONE.scale, n1 = U.noise3(x * sc + 3.1, y * sc, z * sc), n2 = U.noise3(x * sc * 2.7, y * sc * 2.7 + 1.7, z * sc * 2.7);
        tc.lerp(C.stoneLo, STONE.k[0] * sm((n1 + n2 * 0.5 - 0.1) / 0.35)).lerp(C.stoneHi, STONE.k[1] * sm((n2 * 0.8 - n1 * 0.5 - 0.15) / 0.3));
      }
      if (r.lumps && C.lumpHi) tc.lerp(C.lumpHi, LF.lumps.hiK * sm(lumpAt(r, a) / LF.lumps.hiH));
      if (r.lumps && C.lumpLo) tc.lerp(C.lumpLo, LF.lumps.loK * lumpFoot(r, a));
      if (DORS) tc.lerp(C.dorsal, dorsalK(sn, r.st, x, y, z));
      if (BAND) {
        if (BAND.st && r.bt === null) r.bt = trackAt(BAND.st, r.st, []);
        var bt = BAND.st ? r.bt : null, bs = BAND.softY === undefined ? BAND.soft : BAND.soft + (BAND.softY - BAND.soft) * yb;
        var e = BAND.edge + (BAND.wave || 0) * U.noise3(x * 2.3, y * 2.3 + 4.4, z * 2.3) + (bt && BAND.st[0].length > 2 ? bt[1] : 0), bk = sm((-sn - e) / bs) * (bt ? bt[0] : 1);
        if (bk > 0) {
          tc.lerp(C.band2, bk).lerp(C.band, bk * sm((-sn - e - bs) / 0.3) * (1 - young * (1 - (BAND.yk === undefined ? 1 : BAND.yk))));
          if (BAND.scute) { var fr = r.s / BAND.scute[0]; fr -= Math.floor(fr); tc.multiplyScalar(1 - BAND.scute[1] * bk * gs(fr - 0.5, 0.09)); }
        }
      }
      if (BKC && r.st > 3 + BKC.from - BKC.soft) beakTone(r);
      if (SPOT && r.st > SPOT.st[0] && r.st < SPOT.st[1]) {
        // (SPOT.aSt [[station, from], ...]: the lowest angle they reach along the body, where it differs from a[0])
        var fa = sm((a - (SPOT.aSt ? trackAt(SPOT.aSt, r.st, _bt)[0] : SPOT.a[0])) / 0.2) * (1 - sm((a - SPOT.a[1]) / 0.2)) * sm((r.st - SPOT.st[0]) / 0.15) * sm((SPOT.st[1] - r.st) / 0.15);
        if (fa > 0) { var sk = spotAt((r.s - SS[1]) / (SPOT.stretch || 1.4), a * Math.sqrt(r.w * r.ht), cs < 0 ? 1 : 0); if (sk > 0) tc.lerp(C.spot, sk * fa); }
      }
    }
    // ---- a line down the back (LF.backLine { col, w (its half width, radians round the ring), k (how much), st: [from,
    // to] (the stations it runs between, fading in and out over a tenth or so) }): a pale hide's back a soft step darker
    // along its spine from the tail's tip to the nape, so a white dragon seen from a high camera still has a line of
    // value down its middle (it stops short of the head, which stays clear)
    function backLineCol(r, th, sn) {
      var a = Math.atan2(sn, Math.abs(Math.cos(th))), k = BLN.k * gs(a - HALFPI, BLN.w) * sm((r.st - BLN.st[0] + 0.1) / 0.12) * sm((BLN.st[1] - r.st) / 0.14);
      if (k > 0) tc.lerp(C.backLine, k);
    }
    // ---- countershading (LF.dorsal: { col, from (it takes the skin above sin = from round the ring), soft (how soft its
    // edge, in the same terms), wave (how much its edge wanders), st: [[station, how much], ...] along the body }): a
    // darker, warmer tone down the back, the top of the neck and the tail, fading round the flanks into the hide and the
    // pale belly, so a pale kind has a value design (dark over light) and keeps its form against a pale ground; the
    // outside of the thighs takes it too (legTone)
    function dorsalK(sn, st, x, y, z) {
      // (D.fromSt [[station, shift], ...]: how much further down the sides it reaches along the body, as down a neck;
      // D.softSt [[station, scale], ...]: how much sharper its lower edge is there, so a throat keeps a clean pale stripe)
      var D = DORS, e = D.from + (D.fromSt ? trackAt(D.fromSt, st, _bt)[0] : 0) + (D.wave || 0) * Math.sin(x * 4.1 + z * 2.3 + 1.3) * Math.sin(y * 3.7 - z * 1.9);
      var k = sm((sn - e) / (D.softSt ? D.soft * trackAt(D.softSt, st, _bt)[0] : D.soft));
      return k > 0 && D.st ? k * trackAt(D.st, st, _bt)[0] : k;
    }
    // a leg's skin at ring ii, angle th2 of side sd: the thigh's upper and outer face in the back's tone, fading down to
    // the knee (D.leg: how much)
    function legTone(GR, F, ii, th2, sd) {
      var cs = Math.cos(th2), sn = Math.sin(th2), S = F.S[ii], N = F.N[ii], ox = (S.x * cs + N.x * sn) * sd, oy = S.y * cs + N.y * sn;
      tc.lerp(C.dorsal, (DORS.leg || 0) * sm((ox * 0.75 + oy * 0.65 - 0.05) / 0.6) * (1 - sm((GR.st[ii] - 0.55) / 0.5)));
    }
    // ---- a limb grown out of the body's own hide (LF.legSkin, LF.wing.rootSkin [to, soft]: down to station 'to' of the
    // leg (0 its root, 1 the knee) or the wing's arm (0 the shoulder, 1 the elbow), fading out over 'soft'): where the
    // limb's skin lies on or close by the flank it takes the body's colour there (the back's tone, the belly's, the
    // spots), so a thigh or a shoulder flows out of the flank with the pattern running on over it, never a plain patch
    // pasted on
    function bodySkin(g, GR, nS2, ri, LS) {
      var p = g.attributes.position, cl = g.attributes.color, v = V(0, 0, 0);
      for (var ii = 0; ii < GR.C.length; ii++) {
        var w0 = 1 - sm((GR.st[ii] - LS[0]) / LS[1]); if (w0 <= 0.001) break;
        for (var jj = 0; jj < nS2; jj++) {
          var idx = ii * nS2 + jj; v.set(p.getX(idx), p.getY(idx), p.getZ(idx));
          var b = bodyAt(v, ri - 30, ri + 30); if (!b) continue;
          var w = w0 * (1 - sm((b.rho - b.r - 0.03) / 0.22)); if (w <= 0.001) continue;
          // (the ring's own fields, its place along the body taken between the two rings, so the spots run on smoothly)
          var rb = R[b.i], rn = R[Math.min(nR - 1, b.i + 1)], rr = Object.create(rb);
          rr.s = rb.s + (rn.s - rb.s) * b.f; rr.st = rb.st + (rn.st - rb.st) * b.f;
          var bc = skinCol(rr, b.th, b.r, v.x, v.y, v.z);
          cl.setXYZ(idx, cl.getX(idx) + (bc.r - cl.getX(idx)) * w, cl.getY(idx) + (bc.g - cl.getY(idx)) * w, cl.getZ(idx) + (bc.b - cl.getZ(idx)) * w);
        }
      }
    }
    // ---- a beak (LF.beakCol: { col, tip (its point's colour), from (along the head, 0 the back of the skull, 1 the snout's
    // tip, where it begins), soft (how soft that edge) }): the snout's front in horn, darkening to its hooked point, so a
    // beaked head reads as a beak from any side
    function beakTone(r) {
      // (on the young only its little hooked point, and paler: a chick's soft beak, never a bill over the whole muzzle)
      var u = r.st - 3, f0 = BKC.from + yb * 0.2, k = sm((u - f0 + BKC.soft) / (2 * BKC.soft)) * (1 - yb * 0.35);
      tc.lerp(C.beak, k * 0.85).lerp(C.beakTip, k * 0.8 * sm((u - 0.88) / 0.12));
    }
    // how much of a spot covers (u along the body, v round it) on one side: a jittered lattice of round spots of
    // varied size, some cells empty
    function spotAt(u, v, side) {
      // (SPOT.yk: how big a hatchling's are, of the grown one's, so they stay spots on a small body)
      var cl = SPOT.size * (1 - young * (1 - (SPOT.yk === undefined ? 1 : SPOT.yk))) * 2.6, iu = Math.floor(u / cl), iv = Math.floor(v / cl), best = 0, s0 = (SPOT.seed || 1) * 7 + side * 131;
      // (a spot's centre sits 0.2..0.8 across its cell and reaches at most 0.45 of one, so a neighbouring cell's can only
      // touch the point when it lies within a quarter cell of that side: the others are skipped)
      var fu = u / cl - iu, fv = v / cl - iv;
      for (var du = fu < 0.25 ? -1 : 0; du <= (fu > 0.75 ? 1 : 0); du++) for (var dv = fv < 0.25 ? -1 : 0; dv <= (fv > 0.75 ? 1 : 0); dv++) {
        var cu = iu + du, cv = iv + dv;
        if (hash3(cu, cv, s0) > SPOT.dens) continue;
        var px = (cu + 0.2 + 0.6 * hash3(cu, cv, s0 + 1)) * cl, py = (cv + 0.2 + 0.6 * hash3(cu, cv, s0 + 2)) * cl, rr = cl / 2.6 * (0.55 + 0.6 * hash3(cu, cv, s0 + 3));
        var d = Math.sqrt((u - px) * (u - px) + (v - py) * (v - py)) / rr;
        if (d < 1) best = Math.max(best, 1 - sm((d - 0.65) / 0.35));
      }
      return best;
    }

    // ---- the lower jaw's hinge and its turn when it opens (the jaw and what grows on it turn together)
    function jawPivot() {
      var hr = R[ringAt(3 + MO[0])], yh = hr.ymE !== undefined ? hr.ymE : -hr.hb * 0.05;
      return { hinge: hr.c.clone().addScaledVector(hr.N, yh).addScaledVector(hr.T, -0.03 * hk), rot: new T.Matrix4().makeRotationAxis(hr.S.clone(), JA) };
    }

    // ---- the wing's extras: a big claw on its leading edge at the wrist (LF.wing.thumb: { len, r (of the arm's
    // radius), dir (the way it points open, [out, up, back] in the wing's frame), fdir (folded) }), shown folded too, a
    // spur standing up at the shoulder; and a crisp coloured band along the membrane's trailing edge (LF.wing.edge:
    // [where it starts from the wrist (0) to the edge (1), how soft, how much it thins at the finger tips]) in memEdge
    // (TH.yk: how much of its size a hatchling keeps, all of it unless given)
    function thumbClaw(TH, wristW, elbowW, Lw, out, upv, br, wk) {
      var d = Lw(lerp3(TH.dir || [0.25, 0.5, -0.85], TH.fdir || [0.15, 0.75, -0.65], wk)).normalize(), yk = TH.yk === undefined ? 1 : 1 - young * (1 - TH.yk);
      claw(wristW.clone().addScaledVector(d, br * 0.3), d, upv, br * (TH.r || 0.42) * yk, br * (TH.len || 2.4) * yk);
    }
    // a fleshy arm (LF.wing.arm: { k: [at the shoulder, the elbow, the wrist] (times the night's arm's radius), fold (how
    // much of that a folded wing keeps), fil (the fillet's reach, world units), upto (how far down the arm, in its
    // stations, 0 the shoulder and 1 the elbow, the fillet runs), deep (how much deeper in the body the arm starts, world
    // units, so its thick root never shows as a disc on the back) }): a stubby wing's thick, muscled forearm, broad where
    // it leaves the shoulder and still stout at the wrist, laid into the back by a wide fillet so the wing grows out of
    // the body and its arm reads as a limb, never a peg plugged into the shoulder
    function armK(AR, s2, wk) {
      var k = s2 < 1 ? AR.k[0] + (AR.k[1] - AR.k[0]) * sm(s2) : AR.k[1] + (AR.k[2] - AR.k[1]) * sm(Math.min(1, s2 - 1));
      return 1 + (k - 1) * (1 - wk * (1 - (AR.fold === undefined ? 1 : AR.fold)));
    }
    // (LF.wing.faceUp: the membrane's triangles wound so its normals face the sky (dir) on both wings. The sun's shadow
    // is looked up a little way along the normal, so a membrane whose normals face from the sun shades itself: on a
    // light hide that turns one wing of the pair a flat dark panel)
    // ('panel': each panel of the membrane wound so on its own (the panels share no points), since the inner one, from
    // the arm back to the hip, is laid out the other way round from the ones between the fingers and would face the
    // ground: a dark sheet behind the arm)
    function faceUp(g, dir, panels) {
      if (panels) return faceUpPanels(g, dir, panels);
      var nr = g.attributes.normal, ix = g.index.array, k, d = 0;
      for (k = 0; k < nr.count; k++) d += nr.getX(k) * dir.x + nr.getY(k) * dir.y + nr.getZ(k) * dir.z;
      if (d >= 0) return;
      for (k = 0; k < ix.length; k += 3) { var t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; }
      g.index.needsUpdate = true; g.computeVertexNormals();
    }
    function faceUpPanels(g, dir, panels) {
      var ps = g.attributes.position, ix = g.index.array, a = V(0, 0, 0), b = V(0, 0, 0), c = V(0, 0, 0), any = false;
      panels.forEach(function (pr) {
        var d = 0, k;
        for (k = pr[0]; k < pr[1]; k += 3) {
          a.fromBufferAttribute(ps, ix[k]); b.fromBufferAttribute(ps, ix[k + 1]).sub(a); c.fromBufferAttribute(ps, ix[k + 2]).sub(a);
          d += b.cross(c).dot(dir);
        }
        if (d >= 0) return;
        for (k = pr[0]; k < pr[1]; k += 3) { var t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; }
        any = true;
      });
      if (any) { g.index.needsUpdate = true; g.computeVertexNormals(); }
    }
    // (LF.wing.fold.y: the young's own folded layout, { elbow, wrist, tips, off } in the fold's terms, blended in by age
    // (yb), so a little one's short wing folds into a small round nub low on the shoulder, never a pointed flap standing
    // up like an ear; edge: how much of the cloak's lighter edging the young keep, 0..1)
    function foldY(FD, k) {
      var Y = FD.y, o2 = {}, n;
      for (n in FD) o2[n] = FD[n];
      function mx(a, b) { return a.map(function (v, q) { return Array.isArray(v) ? mx(v, b[q]) : v + (b[q] - v) * k; }); }
      ['elbow', 'wrist', 'tips'].forEach(function (n2) { if (Y[n2]) o2[n2] = mx(FD[n2], Y[n2]); });
      if (Y.off !== undefined) o2.off = FD.off + (Y.off - FD.off) * k;
      return o2;
    }
    function memBand(a1, b1) { var E = LF.wing.edge; return sm((a1 - E[0]) / E[1]) * (1 - E[2] * (1 - Math.sin(Math.PI * b1))); }
    // and folded, the cloak dark like the hide (LF.wing.fold.dark: how much of memFold it takes, 0.7 unless given) with
    // foldEdge only as a thin seam (LF.wing.fold.seam [its width across the lowest panel, its reach in from the trailing
    // scallops], fractions): along the cloak's lower edge and its tips, its top edge (the first finger) left as dark as the
    // arm, so the folded wing shows its outline as a coloured trailing edge, never as a coloured panel
    function foldSeam(lowest, a1, b1) { var SM = LF.wing.fold.seam; return Math.max(lowest ? sm((b1 - 1 + SM[0]) / SM[0]) * sm(a1 / 0.2) : 0, 0.8 * sm((a1 - 1 + SM[1]) / SM[1])); }

    // ---- a limb's root in the body's pattern (LF.legPat): where the limb is laid on the body its skin takes the body's
    // colour there (a belly band carried onto the inside of the arm and the thigh), fading down the limb with the
    // fillet, so a limb's dark hide never cuts a hard wedge into a bright chest
    // (where on the body each point lies comes from the fillet that laid it there: filletTube keeps its hits)
    function legPat(g, G, nS2, upto) {
      var p = g.attributes.position, c = g.attributes.color, hits = g.userData.fil || [];
      for (var ii = 0; ii < G.C.length; ii++) {
        var w = 1 - sm(G.st[ii] / upto); if (w <= 0.001) break;
        for (var jj = 0; jj < nS2; jj++) {
          var idx = ii * nS2 + jj, e = hits[idx]; if (!e) continue;
          var b = e.b, k = w * (1 - sm((e.rho - b.r) / 0.1)); if (k <= 0.01) continue;
          var r0 = c.getX(idx), g0 = c.getY(idx), b0 = c.getZ(idx), bc = skinCol(R[b.i], b.th, b.r, p.getX(idx), p.getY(idx), p.getZ(idx));
          c.setXYZ(idx, r0 + (bc.r - r0) * k, g0 + (bc.g - g0) * k, b0 + (bc.b - b0) * k);
        }
      }
    }

    // ---- the young's folded wing laid up on the back (LF.wing.fold.yUp: radians, at a hatchling): the folded layout
    // turned that far up round the body (never past the top) and standing closer to the skin, so a little one's wing
    // bud lies over its back like a small cloak, never hanging down its shoulder like a ribbon
    function foldUp(v) { v.y = Math.min(HALFPI - 0.1, v.y + FYk); v.z *= 1 - 0.4 * young; return v; }
    // and the young's own folded layout (LF.wing.fold.young { elbow, wrist (as fold's), tipK (how far the fingers reach,
    // of the grown one's), offK (how far the cloak stands off the skin, of the grown one's) }, all of it on a hatchling,
    // half on a fledgling): the wrist low on the shoulder (never a knuckle raised over the back with daylight under the
    // arm), the fingers short and the cloak tight, so a little one's wing is a small bud tucked onto its shoulder
    function youngFold() { var FY = WG.fold.young; FDW = lerp3(FDW, FY.wrist, young); FDE = lerp3(FDE, FY.elbow, young); FDT = FDT.map(function (t) { return [t[0] * (1 + (FY.tipK - 1) * young), t[1]]; }); }

    // ---- a tail fin's own outline (LF.finW [root, at, tip]): its half width at the root (of its broadest), where along it
    // it is broadest (0..1) and the power of the taper beyond (over 1 a long fine point), for a kind whose tail fins are
    // long swept blades rather than the night dragon's broad leaves
    // (the young's softer: rounder at the root and the tip and a little broader, a soft round leaf on a hatchling,
    // never a thorn)
    function finWidth(FW, W2) {
      var r0 = FW[0] + (0.65 - FW[0]) * yb, at = FW[1] + (0.42 - FW[1]) * yb, tp = FW[2] + (0.6 - FW[2]) * yb, wy = W2 * (1 + 0.6 * yb);
      return function (u) { return wy * (u < at ? r0 + (1 - r0) * Math.sin(HALFPI * u / at) : Math.pow(Math.max(0, Math.cos(HALFPI * (u - at) / (1 - at))), tp)); };
    }
    // ---- tail fins laid on the ground (LF.finDrape: how much; LF.finT, LF.finCup: their thickness and the camber
    // across them; LF.finAir, LF.finYk: see the fins): in a ground pose, where the tail's tip lies low, its fins sag
    // from their roots onto the ground like soft leaves instead of standing stiffly off it (a tip held up, as round
    // the hip, keeps them as they are)
    function finDrape(g, root, L2) {
      var dk = LF.finDrape * (1 - sm((root.y - 0.08) / 0.2)); if (dk <= 0) return;
      var pa = g.attributes.position;
      for (var k = 0; k < pa.count; k++) {
        var dx = pa.getX(k) - root.x, dz = pa.getZ(k) - root.z, t = sm(Math.sqrt(dx * dx + dz * dz) / (L2 * 0.55)) * dk, y = pa.getY(k);
        pa.setY(k, y + (0.012 - y) * t * 0.92);
      }
      g.computeVertexNormals();
    }

    // ---- spikes and horns (LF.spikes): curved, tapering cones or flat blades grown out of the skin in runs along the
    // body or the head (a row down the back, a pair of horns, spines on the cheeks or the jaw, a crown fanned round the
    // back of the skull, thorns down the tail, a spiked tail tip, tusks). Each starts inside the skin and its root is laid
    // onto it with the limbs' fillet, so it grows out of the hide instead of sitting on it. A run:
    //   st [from, to]: the stations it runs between (the same twice: one ring of them); n: how many, evenly along it by
    //     length (or every: spaced that many of their own lengths apart, starting at 'from');
    //   a: their angles round the ring, up from the side (each on both sides; one on the midline at +-HALFPI); aK: a
    //     size for each angle;
    //   len: a length (world units; on the head scaled with it) or [[station, length], ...] along the run;
    //   w: the root's half width (of the length); flat: how flat across the spine (0 a round cone, 0.7 a blade);
    //   taper: the profile's power (1 a straight cone, 0.6 fuller and blunter, 1.5 a slim thorn); flare: how much the
    //     root swells (of its width);
    //   dir [back, out, up, side]: the way it points: back along the spine, out of the skin at its root, up the ring, out
    //     to its side; curl: radians its tip turns over its length (> 0 lifting away from the skin, < 0 hooking back
    //     toward it);
    //   sink: how far the root goes into the skin (of its width); fil: the fillet's reach (of its width; 0 none);
    //   rings: how many rings along it (5; more for a long curling horn);
    //   col / tip / tipK: its colour (one of the kind's, as 'claw', or a hex) over the hide at its root, its tip's, and
    //     how far along the tip's begins; m: 'paint' for a tooth's or a claw's material (else the hide's);
    //   yk: how much of its size a hatchling keeps (0.4); poseK: { pose: size }; y: { da (radians further up the ring),
    //     dir, curl, w, taper }: where and how it grows on the young instead, blended in by age (half of it on a fledgling,
    //     all of it on a hatchling): a horn bud set up on a round young skull, where the grown one's place would hide it
    //     behind the dome;
    //   lip: rooted on the lower jaw this far (of the head's size) under the mouth's line, and turning with it when it
    //     opens (tusks, jaw spines); keep: true keeps it under a saddle (else the back's ones there are left out);
    //     sadK: [k, reach]: saddled, the ones near the saddle that size, back to full that many stations off
    //   yst: how far along it moves on the young's face (stations), so a beak's horn or a crown sits on the young's head;
    //     yw: how much stouter a hatchling's is (its root's width, of the grown one's), a little nub rather than a wire
    function colOf(v) { return C[v] || lin(v); }
    function spikes() {
      var JP = JA ? jawPivot() : null, jm = null, sad = o.saddle || o.rider, SD = LF.saddle;
      if (JP) jm = new T.Matrix4().makeTranslation(JP.hinge.x, JP.hinge.y, JP.hinge.z).multiply(JP.rot).multiply(new T.Matrix4().makeTranslation(-JP.hinge.x, -JP.hinge.y, -JP.hinge.z));
      LF.spikes.forEach(function (SP) {
        // (yst: the run moved this far along on the young's face (stations, by how far it is blended in), so what grows
        // on the grown one's beak or the back of its skull sits on the young's own)
        var yS = (SP.yst || 0) * yb, s0 = sOf(SP.st[0] + yS), s1 = sOf(SP.st[1] + yS), list = [], k;
        if (SP.every) { var dS = s1 < s0 ? -1 : 1; for (var s2 = s0, gd = 0; (s2 - s1) * dS <= 1e-6 && gd < 99; gd++) { var stg = stOf(s2); list.push(stg); s2 += dS * Math.max(0.02, spikeLen(SP, stg)) * SP.every; } }
        else { var n = SP.n || 1; for (k = 0; k < n; k++) list.push(stOf(n > 1 ? s0 + (s1 - s0) * k / (n - 1) : s0)); }
        list.forEach(function (st) {
          var L = spikeLen(SP, st) * (1 - young * (1 - (SP.yk === undefined ? 0.4 : SP.yk))) * (SP.poseK && SP.poseK[pn] !== undefined ? SP.poseK[pn] : 1);
          if (sad && SP.sadK) L *= sadSpikeK(SP.sadK, st, SD);
          if (L < 0.012) return;
          SP.a.forEach(function (a, ka) {
            if (sad && !SP.keep && a > 0.7 && st > SD[0] - 0.14 && st < SD[1] + 0.1) return;
            (Math.abs(Math.abs(a) - HALFPI) < 0.02 ? [1] : [1, -1]).forEach(function (sd) { oneSpike(SP, st, a, sd, L * (SP.aK ? SP.aK[ka] : 1), jm); });
          });
        });
      });
    }
    // under a saddle, a run's spikes next to it kept low (SP.sadK [k, reach]: that size at the saddle's ends, back to full
    // that many stations off), so the back behind and before the rider stays clear instead of bristling round him
    function sadSpikeK(SK, st, SD) { var d = Math.max(SD[0] - 0.14 - st, st - SD[1] - 0.1, 0); return SK[0] + (1 - SK[0]) * sm(d / SK[1]); }
    // a run's length at a station (on the head grown with it, as its rings are)
    function spikeLen(SP, st) { var L = typeof SP.len === 'number' ? SP.len : trackAt(SP.len, st, [])[0]; return L * (1 + (hk - 1) * sm((st - 2.86 + young * 0.26) / (0.18 + young * 0.3))); }
    // where a lip spike's root goes round ring r: the angle where the skin (the mouth shut) passes 'drop' under the line
    // of the mouth on side sd
    function lipAngle(r, drop, sd) {
      var tgt = (r.ym !== undefined ? r.ym : -r.hb * 0.3) - drop, lo = -HALFPI, hi = 0;
      for (var it = 0; it < 14; it++) { var mid = (lo + hi) / 2; if (rAt(r, mid, true) * Math.sin(mid) < tgt) lo = mid; else hi = mid; }
      return sd > 0 ? (lo + hi) / 2 : Math.PI - (lo + hi) / 2;
    }
    function oneSpike(SP, st, a, sd, L, jm) {
      var SY = SP.y && young ? SP.y : null, yS = SY ? young : 0;
      if (SY) a += (SY.da || 0) * yS;
      var lo = 0, hi = nR - 1; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (R[m].st <= st) lo = m; else hi = m; }
      var f = U.clamp((st - R[lo].st) / Math.max(1e-6, R[hi].st - R[lo].st), 0, 1), ra = R[lo], rb = R[hi], lip = SP.lip !== undefined;
      var rw = L * ((SP.w || 0.2) + (SY && SY.w !== undefined ? (SY.w - (SP.w || 0.2)) * yS : 0)) * (1 + young * (SP.yw || 0)), th = lip ? lipAngle(f < 0.5 ? ra : rb, SP.lip * hk, sd) : sd > 0 ? a : Math.PI - a, sk = (SP.sink === undefined ? 0.5 : SP.sink) * rw;
      var Tt = ra.T.clone().lerp(rb.T, f).normalize(), Nn = ra.N.clone().lerp(rb.N, f).normalize(), Ss = ra.S.clone().lerp(rb.S, f).normalize(), cs = Math.cos(th), sn = Math.sin(th), root, on;
      if (lip) {
        // (on the lower jaw: placed on the shut mouth's skin, the open palate never in the way, and turned with the jaw)
        var rad = rAt(ra, th, true) * (1 - f) + rAt(rb, th, true) * f - sk;
        root = ra.c.clone().lerp(rb.c, f).addScaledVector(Ss, cs * rad).addScaledVector(Nn, sn * rad);
        if (UB && ra.mouthK) root.addScaledVector(Tt, ubAt(ra, sn * rad));
        on = Ss.clone().multiplyScalar(cs).addScaledVector(Nn, sn).normalize();
      } else { root = surf(lo, f, th, -sk); on = skinN(lo, f, th); }
      var dr = SP.dir || [0.7, 0.7, 0, 0];
      if (SY && SY.dir) dr = [0, 1, 2, 3].map(function (k) { return (dr[k] || 0) + ((SY.dir[k] || 0) - (dr[k] || 0)) * yS; });
      var D = Tt.clone().multiplyScalar(-dr[0]).addScaledVector(on, dr[1]).addScaledVector(Nn, dr[2] || 0).addScaledVector(Ss, sd * (dr[3] || 0)).normalize();
      var ax = D.clone().cross(on); if (ax.lengthSq() < 1e-4) ax = D.clone().cross(Tt); ax.normalize();
      var nq = 4, cu = (SP.curl || 0) + (SY && SY.curl !== undefined ? (SY.curl - (SP.curl || 0)) * yS : 0), pts = [root.clone().addScaledVector(on, -rw * 1.6), root.clone()], p = root.clone(), q;
      for (q = 1; q <= nq; q++) { p = p.clone().addScaledVector(D.clone().applyAxisAngle(ax, cu * (q - 0.5) / nq), L / nq); pts.push(p); }
      var G = curveRings(pts, Math.max(0.008, L / (SP.rings || 5) / det), 0.0005, 1);
      // (a blade is broad along the spine and thin across it; SP.sides: the sides round it, more for a round tusk the
      // six of a small spike would leave faceted)
      var bA = Tt.clone().addScaledVector(D, -Tt.dot(D)); if (bA.lengthSq() < 1e-4) bA = on.clone();
      var F = rmf(G.T, bA), nS2 = SP.sides || (L > 0.3 ? 8 : 6), flat = SP.flat || 0, tp = (SP.taper || 1) + (SY && SY.taper !== undefined ? (SY.taper - (SP.taper || 1)) * yS : 0), fl = SP.flare === undefined ? 0.25 : SP.flare;
      var rt = rw * (1 - flat), c0 = SP.col ? colOf(SP.col) : null, c1 = SP.tip ? colOf(SP.tip) : null, tk = SP.tipK === undefined ? 0.5 : SP.tipK;
      // (its profile and its colour change only from ring to ring, so each is worked out once a ring)
      var kP = -1, kT = -1, prK = 0, tcK = new T.Color();
      var g = tubeGeo2(G, F, nS2, function (k2, th2, c2, s2) {
        if (k2 !== kP) { var u = (G.st[k2] - 1) / nq; prK = u < 0 ? 1 + fl * 0.6 : Math.pow(Math.max(0, 1 - u), tp) * (1 + fl * Math.exp(-u / 0.12)); kP = k2; }
        return prK / Math.sqrt(c2 * c2 / (rt * rt) + s2 * s2 / (rw * rw)) + 0.001;
      }, function (k2) {
        if (k2 === kT) return tcK;
        var u = (G.st[k2] - 1) / nq, cc = G.C[k2]; hideCol(cc.x, cc.y, cc.z, 0);
        if (c0) tc.lerp(c0, sm((u + 0.05) / 0.3));
        if (c1) tc.lerp(c1, sm((u - tk) / Math.max(0.05, 1 - tk)));
        kT = k2; return tcK.copy(tc);
      });
      if (lip) { if (jm) { g.applyMatrix4(jm); g.computeVertexNormals(); } }
      else if (SP.fil === undefined || SP.fil > 0) filletTube(g, { C: G.C, st: G.st.map(function (x) { return x - 1; }) }, nS2, 0.35, (SP.fil || 0.5) * rw, lo, 10);
      self.addGeo(floorGeo(g), { c: '#ffffff', jit: 0, m: SP.m === 'paint' ? M.paint : HIDE, ao: 0.05, vary: 0.02 });
    }

    // ---- put it together
    (LF.biped ? ['hl', 'hr'] : ['fl', 'fr', 'hl', 'hr']).forEach(leg);
    [1, -1].forEach(wing);
    [1, -1].forEach(eye);
    if (LF.ears) ears();
    if (LF.plates) plates();
    if (LF.fins) tailFins();
    jaw();
    if (LF.spikes) spikes();
    if (o.saddle || o.rider) saddle();
  }
  // the rider's pose astride a back halfW wide (world units): knees out round the chest, feet low at its sides
  function rideFor(halfW) {
    var fx = Math.max(0.3, halfW + 0.06), fy = Math.max(0.3, 0.6 - halfW * 0.25);
    return function (rr) { return { feet: [V(-fx, fy, 0.14), V(fx, fy, 0.14)], hands: [V(-0.14, 1.06, 0.42), V(0.14, 1.06, 0.42)], lean: 0.3, twist: 0, side: 0, hip: 0, drop: 0, head: [rr(0.2), -0.12], pole: [V(-1, -0.2, 0.3), V(1, -0.2, 0.3)] }; };
  }

  // ------------------------------------------------------------------ the dragon
  // o: { kind, pose, ry, s, age ('adult' | 'young' | 'hatchling'), saddle, rider (figure opts), tilt, wing (0..1 override),
  //      look ([x,y,z] the point the head turns toward, in the dragon's own frame: from (x, y, z), before ry and s turn
  //      and scale it), fire, name, blanket (a saddle cloth's colour, with the saddle), detail (the loft dragon's mesh
  //      density, 1 by default, 0.35 to 2), seed }
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
      if (K.loft) loftDragon(self, o, K, P0, { young: young, headK: headK, tailK: tailK, wingK: wingK, s: s, rnd: rnd, sizeK: 1 }); else build();
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
      // where the head is in the build's frame, for close-up pictures in the lab (view.html focus=head)
      KIT.dragonHeadAt = base.clone().applyMatrix4(self.top());
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
