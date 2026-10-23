// Painterly village kit, part 4: the stage. Renders the scene into a float target, then paints it:
// a Kuwahara pass turns the render into flat dabs of paint, a soft bloom lets fire and lit windows glow,
// and a grade adds the look's split toning, a vignette and the tooth of the canvas.
(function () {
  var T = THREE, KIT = window.KIT, U = KIT.util;

  var QUAD_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  function pass(fs, uniforms) {
    return new T.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: fs, uniforms: uniforms, depthTest: false, depthWrite: false });
  }

  // downsample the supersampled render, with a faint painted contour where the depth jumps
  var RESOLVE_FS = [
    'uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uTexel; uniform vec2 uSceneRes; uniform float uSS; uniform float uEdge; uniform vec2 uCam; uniform vec3 uEdgeCol; varying vec2 vUv;',
    'float lin(float d) { float z = d * 2.0 - 1.0; return 2.0 * uCam.x * uCam.y / (uCam.y + uCam.x - z * (uCam.y - uCam.x)); }',
    'void main() {',
    '  vec3 c = vec3(0.0); float k = 0.0;',
    '  for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) { vec2 o = (vec2(float(x), float(y)) - 0.5) * uTexel * 0.5 * uSS; c += texture2D(tColor, vUv + o).rgb; k += 1.0; }',
    '  c /= k;',
    '  float d0 = lin(texture2D(tDepth, vUv).r);',
    '  float e = 0.0;',
    '  for (int i = 0; i < 4; i++) { vec2 o = vec2(i == 0 ? 1.0 : i == 1 ? -1.0 : 0.0, i == 2 ? 1.0 : i == 3 ? -1.0 : 0.0) * uTexel * 1.4 * uSS; float d1 = lin(texture2D(tDepth, vUv + o).r); e += max(0.0, d1 - d0) / d0; }',
    '  e = smoothstep(0.05, 0.25, e) * uEdge;',
    '  c = mix(c, c * uEdgeCol, e);',
    // the flags in alpha are read from the middle of one texel, never blended (at 2x this is the texel it always was)
    '  vec2 fp = (floor((vUv - 0.25 * uTexel * (uSS - 1.0)) * uSceneRes) + 0.5) / uSceneRes;',
    '  gl_FragColor = vec4(c, texture2D(tColor, fp).a);',
    '}'
  ].join('\n');

  // Generalised Kuwahara with polynomial sector weights (Kyprianidis et al.), 8 sectors.
  function kuwaharaFS(R) {
    return [
      'uniform sampler2D tColor; uniform vec2 uTexel; uniform float uQ; uniform float uRad; varying vec2 vUv;',
      'void main() {',
      '  vec4 m[8]; vec3 s[8];',
      '  for (int k = 0; k < 8; k++) { m[k] = vec4(0.0); s[k] = vec3(0.0); }',
      '  float zeta = 2.0 / uRad; float sinZ = 0.38268343; float eta = (zeta + 0.92387953) / (sinZ * sinZ);',
      '  for (int j = -' + R + '; j <= ' + R + '; j++) for (int i = -' + R + '; i <= ' + R + '; i++) {',
      '    vec2 v = vec2(float(i), float(j)) / uRad;',
      '    float r2 = dot(v, v); if (r2 > 1.0) continue;',
      '    vec3 c = texture2D(tColor, vUv + vec2(float(i), float(j)) * uTexel).rgb;',
      '    c = c / (1.0 + c);', // compress highlights so a torch doesn't take over a sector
      '    float w[8]; float z; float sum = 0.0; float vxx = zeta - eta * v.x * v.x; float vyy = zeta - eta * v.y * v.y;',
      '    z = max(0.0, v.y + vxx); w[0] = z * z; sum += w[0];',
      '    z = max(0.0, -v.x + vyy); w[2] = z * z; sum += w[2];',
      '    z = max(0.0, -v.y + vxx); w[4] = z * z; sum += w[4];',
      '    z = max(0.0, v.x + vyy); w[6] = z * z; sum += w[6];',
      '    vec2 u = 0.70710678 * vec2(v.x - v.y, v.x + v.y);',
      '    vxx = zeta - eta * u.x * u.x; vyy = zeta - eta * u.y * u.y;',
      '    z = max(0.0, u.y + vxx); w[1] = z * z; sum += w[1];',
      '    z = max(0.0, -u.x + vyy); w[3] = z * z; sum += w[3];',
      '    z = max(0.0, -u.y + vxx); w[5] = z * z; sum += w[5];',
      '    z = max(0.0, u.x + vyy); w[7] = z * z; sum += w[7];',
      '    float g = exp(-3.125 * r2) / max(sum, 1e-5);',
      '    for (int k = 0; k < 8; k++) { float wk = w[k] * g; m[k] += vec4(c * wk, wk); s[k] += c * c * wk; }',
      '  }',
      '  vec4 o = vec4(0.0);',
      '  for (int k = 0; k < 8; k++) { if (m[k].w <= 0.0) continue; vec3 mu = m[k].rgb / m[k].w; vec3 sg = abs(s[k] / m[k].w - mu * mu); float sig = sg.r + sg.g + sg.b; float wk = 1.0 / (1.0 + pow(255.0 * sig, 0.5 * uQ)); o += vec4(mu * wk, wk); }',
      '  vec3 c = o.rgb / max(o.w, 1e-5);',
      '  c = c / max(vec3(1e-4), 1.0 - c);',
      '  gl_FragColor = vec4(c, texture2D(tColor, vUv).a);',
      '}'
    ].join('\n');
  }

  var BRIGHT_FS = 'uniform sampler2D tColor; varying vec2 vUv; void main() { vec3 c = texture2D(tColor, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(0.95, 2.2, l), 1.0); }';
  var BLUR_FS = 'uniform sampler2D tColor; uniform vec2 uDir; varying vec2 vUv; void main() { vec3 c = texture2D(tColor, vUv).rgb * 0.2270270270; c += texture2D(tColor, vUv + uDir * 1.3846153846).rgb * 0.3162162162; c += texture2D(tColor, vUv - uDir * 1.3846153846).rgb * 0.3162162162; c += texture2D(tColor, vUv + uDir * 3.2307692308).rgb * 0.0702702703; c += texture2D(tColor, vUv - uDir * 3.2307692308).rgb * 0.0702702703; gl_FragColor = vec4(c, 1.0); }';

  // The grade, then the pen. The paint is graded (ACES, split toning, contrast); the paper behind it was painted in its
  // final colours and is left alone. Then pen work goes on top, the way the Hub's village and Ascent mountain are drawn:
  // a wavering ink line where the depth jumps (silhouettes) or folds (creases), diagonal hatching over the shade, a
  // second crossing set in the deepest shadow, granulation in the paper's tooth, and the sheet's edge left bare.
  var FINAL_FS = [
    'uniform sampler2D tColor; uniform sampler2D tBloom; uniform sampler2D tPaper; uniform sampler2D tDepth; uniform vec2 uRes; uniform vec2 uTexel; uniform vec2 uCam;',
    'uniform float uExposure; uniform float uSat; uniform float uContrast;',
    'uniform vec3 uShadowTint; uniform vec3 uHighTint; uniform float uSplit; uniform float uVignette; uniform float uBloom; uniform float uGrain;',
    'uniform vec3 uInk; uniform vec3 uPaperS; uniform vec3 uSplat; uniform vec3 uToday; uniform float uInkA; uniform float uLineW; uniform float uSilK; uniform float uCreaseK; uniform float uHatchA; uniform float uHatchGap; uniform float uHatchW; uniform float uCross;',
    'uniform float uWob; uniform float uSheet; uniform float uGrid; uniform float uPen; uniform float uDbg; uniform float uLift; uniform sampler2D tGhost; uniform float uGhostOn; uniform vec3 uGraphite; uniform float uTick;',
    'varying vec2 vUv;',
    'vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }',
    'vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }',
    'float ld(vec2 uv) { float z = texture2D(tDepth, uv).r * 2.0 - 1.0; return 2.0 * uCam.x * uCam.y / (uCam.y + uCam.x - z * (uCam.y - uCam.x)); }',
    'float gd(vec2 uv) { float z = texture2D(tGhost, uv).r * 2.0 - 1.0; return 2.0 * uCam.x * uCam.y / (uCam.y + uCam.x - z * (uCam.y - uCam.x)); }',
    'float hsh(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }',
    'float pen(float t, float gap, float w) { float f = fract(t / (gap * 1.41421356)); f = min(f, 1.0 - f) * gap; return 1.0 - smoothstep(w * 0.5 - 0.55, w * 0.5 + 0.55, f); }',
    'float segD(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }',
    // alpha flags written by the paint: 0..1 paper value, 2 the bare sheet, 4+ foliage, 6+ today's pieces, 8+ the lawn
    'float isBg(float a) { return step(1.5, a) * (1.0 - step(2.5, a)); }',
    'void main() {',
    '  vec4 t0 = texture2D(tColor, vUv);',
    '  float a = t0.a, bg = isBg(a), leaf = step(3.5, a) * (1.0 - step(5.5, a)), today = step(5.5, a) * (1.0 - step(7.5, a)), lawn = step(7.5, a);',
    '  float pv = bg > 0.5 ? 1.0 : clamp(a - leaf * 4.0 - today * 6.0 - lawn * 8.0, 0.0, 1.0);',
    '  vec2 asp = vec2(uRes.x / uRes.y, 1.0);',
    '  vec4 nA = texture2D(tPaper, vUv * asp * 2.3), nA2 = texture2D(tPaper, vUv * asp * 2.3 + 0.5), nB = texture2D(tPaper, vUv * asp * 6.1 + 0.37);',
    '  vec3 bl = texture2D(tBloom, vUv).rgb * uBloom;',
    '  vec3 s;',
    '  if (bg > 0.5) { s = toSRGB(clamp(t0.rgb + bl * 0.7, 0.0, 1.0)); }',
    '  else {',
    '    vec3 c = aces((t0.rgb + bl) * uExposure * 0.92);',
    '    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));',
    '    c = mix(vec3(l), c, uSat);',
    '    c = mix(c, c * uShadowTint * 1.6, (1.0 - smoothstep(0.0, 0.45, l)) * uSplit);',
    '    c = mix(c, c * uHighTint * 1.08, smoothstep(0.4, 1.0, l) * uSplit);',
    '    c = 0.18 * pow(max(c, vec3(1e-5)) / 0.18, vec3(uContrast));',
    '    vec2 q = vUv - 0.5; q.x *= asp.x; c *= 1.0 - uVignette * smoothstep(0.35, 1.05, length(q));',
    '    s = toSRGB(clamp(c, 0.0, 1.0));',
    '    float sl = dot(s, vec3(0.2126, 0.7152, 0.0722));',
    '    s = mix(s, uPaperS, smoothstep(0.55, 0.95, sl) * smoothstep(0.7, 1.0, pv) * uLift);',
    // today's pieces: the app's own orange, shaded only in value, the way the Hub's village shows them
    '    if (today > 0.5) s = uToday * mix(0.74, 1.0, smoothstep(0.15, 0.75, pv)) * (0.95 + 0.05 * nB.g);',
    '  }',
    // the pen line: sample depth around a point nudged by slow noise, so the line wavers like a hand-held pen
    '  vec2 uv = vUv + (vec2(nA.g, nA2.g) - 0.5) * 2.0 * uWob * uTexel;',
    '  float d0 = ld(uv), sil = 0.0, outer = 0.0;',
    '  for (int i = 0; i < 8; i++) { float an = float(i) * 0.78539816; vec2 dv = vec2(cos(an), sin(an)); float d1 = ld(uv + dv * uLineW * uTexel); sil = max(sil, (d1 - d0) / d0);',
    '    outer = max(outer, isBg(texture2D(tColor, uv + dv * uLineW * 1.7 * uTexel).a)); }',
    '  outer *= 1.0 - bg;',
    '  float i0 = 1.0 / d0; vec2 e2 = 1.5 * uTexel;',
    '  float lx = 1.0 / ld(uv + vec2(e2.x, 0.0)) + 1.0 / ld(uv - vec2(e2.x, 0.0)) - 2.0 * i0;',
    '  float ly = 1.0 / ld(uv + vec2(0.0, e2.y)) + 1.0 / ld(uv - vec2(0.0, e2.y)) - 2.0 * i0;',
    '  float cr = (abs(lx) + abs(ly)) / i0;',
    '  float nl = 0.0;',
    '  for (int i = 0; i < 4; i++) { vec2 o = vec2(i == 0 ? 1.0 : i == 1 ? -1.0 : 0.0, i == 2 ? 1.0 : i == 3 ? -1.0 : 0.0) * e2; float an2 = texture2D(tColor, uv + o).a; nl = max(nl, step(3.5, an2) * (1.0 - step(5.5, an2))); }',
    // folds are drawn the way an illustrator indicates stonework: firmly in places, left out in others
    '  float indic = mix(0.3, 1.0, smoothstep(0.4, 0.6, texture2D(tPaper, vUv * asp * 1.9 + 0.83).g));',
    '  float eS = smoothstep(uSilK, uSilK * 4.0, sil * mix(1.0, 0.12, leaf));',
    '  float eC = smoothstep(uCreaseK, uCreaseK * 3.0, cr) * (1.0 - leaf) * (1.0 - bg) * (1.0 - nl) * indic * 0.85;',
    '  float press = 0.62 + 0.38 * smoothstep(0.3, 0.7, nB.g);',
    '  float gaps = smoothstep(0.2, 0.34, texture2D(tPaper, vUv * asp * 9.0 + 0.71).g);',
    '  float inkL = max(max(eS, eC) * press * mix(1.0, gaps, 0.6), outer * mix(0.85, 1.0, press)) * uPen;',
    // what is still to come, in pencil, where it stands in front of what is built
    '  float gFront = 0.0, pl = 0.0;',
    '  if (uGhostOn > 0.5) {',
    '    vec2 gv = vUv + (vec2(nA2.g, nB.g) - 0.5) * 3.0 * uTexel;',
    '    float g0 = gd(gv), gs = 0.0;',
    '    for (int i = 0; i < 8; i++) { float an = float(i) * 0.78539816 + 0.3; gs = max(gs, (gd(gv + vec2(cos(an), sin(an)) * 1.25 * uTexel) - g0) / g0); }',
    '    float gi = 1.0 / g0, glx = 1.0 / gd(gv + vec2(e2.x, 0.0)) + 1.0 / gd(gv - vec2(e2.x, 0.0)) - 2.0 * gi, gly = 1.0 / gd(gv + vec2(0.0, e2.y)) + 1.0 / gd(gv - vec2(0.0, e2.y)) - 2.0 * gi;',
    '    float gc = smoothstep(uCreaseK * 1.5, uCreaseK * 4.5, (abs(glx) + abs(gly)) / gi) * 0.55;',
    '    gFront = 1.0 - smoothstep(0.0, 0.05, g0 - d0 * 1.001);',
    '    pl = max(smoothstep(0.006, 0.024, gs), gc) * gFront * (0.55 + 0.45 * smoothstep(0.25, 0.65, nB.g)) * uPen;',
    '  }',
    // hatching: one direction, in the shade only, a little wavy and laid in patches; a crossing set only in the deepest dark
    '  vec2 fp = gl_FragCoord.xy + (nB.rg - 0.5) * 2.2;',
    '  float dark = 1.0 - pv, mot = nA.g - 0.5, lum = dot(s, vec3(0.2126, 0.7152, 0.0722));',
    '  float hk = smoothstep(0.5, 0.8, dark + mot * 0.15) * (1.0 - bg) * mix(1.0, 0.35, leaf) * mix(1.0, 0.6, today) * (1.0 - gFront * 0.9);',
    '  float h1 = pen(fp.x + fp.y, uHatchGap, mix(0.85, 1.15, dark) * uHatchW);',
    '  float h2 = pen(fp.x - fp.y + 1.7, uHatchGap * 1.15, 0.85 * uHatchW) * smoothstep(0.88, 1.0, dark) * (1.0 - smoothstep(0.1, 0.22, lum)) * uCross * (1.0 - today);',
    '  float patchy = mix(1.0, smoothstep(0.18, 0.4, texture2D(tPaper, vUv * asp * 3.7 + 0.13).g), 0.5);',
    '  float hat = max(h1, h2 * 0.8) * hk * patchy * uPen;',
    // pen ticks on the lawn, a few to a patch, like the Hub's land
    '  float tick = 0.0;',
    '  vec2 tc = floor(gl_FragCoord.xy / uTick);',
    '  for (int j = 0; j < 4; j++) {',
    '    vec2 cc = tc + vec2(j == 1 || j == 3 ? -1.0 : 0.0, j >= 2 ? -1.0 : 0.0);',
    '    if (hsh(cc + 11.3) < 0.2) {',
    '      vec2 o = (cc + 0.5 + (vec2(hsh(cc + 2.1), hsh(cc + 5.7)) - 0.5) * 0.7) * uTick;',
    '      if (step(7.5, texture2D(tColor, o / uRes).a) > 0.5) {',
    '        float sc = uTick * (0.3 + 0.18 * hsh(cc + 8.8)), lean = (hsh(cc + 4.4) - 0.5) * 0.5; vec2 pp2 = gl_FragCoord.xy - o;',
    '        float dd = min(segD(pp2, vec2(0.0), vec2(-0.5 + lean, 1.0) * sc), segD(pp2, vec2(0.0), vec2(0.45 + lean, 1.1) * sc));',
    '        if (hsh(cc + 6.6) < 0.4) dd = min(dd, segD(pp2, vec2(0.9, 0.0) * sc, vec2(1.2 + lean, 0.8) * sc));',
    '        tick = max(tick, 1.0 - smoothstep(0.35 * uHatchW, 0.35 * uHatchW + 0.9, dd));',
    '      }',
    '    }',
    '  }',
    '  tick *= lawn * uPen;',
    '  s = mix(s, uInk, hat * uHatchA);',
    '  s = mix(s, uInk, tick * 0.42);',
    '  s = mix(s, uGraphite, pl * 0.75);',
    '  s = mix(s, uInk, inkL * uInkA);',
    // paper: its tooth everywhere, granulation in the shade, a faint survey grid on the bare sheet, its margin a touch greyer
    '  vec4 pp = texture2D(tPaper, gl_FragCoord.xy / 512.0);',
    '  s *= 1.0 + ((pp.a - 0.5) * 0.08 + (pp.b - 0.5) * 0.05) * uGrain * mix(0.35, 1.0, bg);',
    '  s *= 1.0 - (1.0 - bg) * dark * pp.r * 0.07 * uGrain;',
    '  if (uGrid > 0.0) { vec2 g = abs(fract(gl_FragCoord.xy / uGrid + 0.5) - 0.5) * uGrid; float gl = 1.0 - smoothstep(0.35, 1.1, min(g.x, g.y)); s *= 1.0 - gl * bg * 0.04; }',
    '  vec2 qq = (vUv - vec2(0.5, 0.55)) * asp; float rq = length(qq * vec2(0.8, 1.0));',
    '  s *= 1.0 - bg * smoothstep(0.55, 0.95, length((vUv - 0.5) * asp * vec2(0.85, 1.0))) * 0.045;',
    // a few flicks of ink off the pen, out on the bare paper
    '  vec2 cell = floor(gl_FragCoord.xy / 26.0); float hh = hsh(cell + 3.7);',
    '  if (hh < 0.025 && bg > 0.5) { vec2 ctr = (cell + 0.5 + (vec2(hsh(cell + 7.1), hsh(cell + 3.3)) - 0.5) * 0.7) * 26.0; float rad = 0.8 + hsh(cell + 1.7) * hsh(cell + 9.1) * 3.0; float dt = 1.0 - smoothstep(rad - 0.7, rad + 0.7, length(gl_FragCoord.xy - ctr)); s = mix(s, uSplat, dt * smoothstep(0.46, 0.6, rq) * (1.0 - smoothstep(0.72, 0.86, rq)) * 0.3); }',
    // the edge of the sheet: the painting stops short of it, with a ragged line where the wash dried
    '  float rs = length((vUv - 0.5) * asp * vec2(0.84, 1.0)) + (nA.g - 0.5) * 0.12 + (nB.g - 0.5) * 0.05;',
    '  float sheet = smoothstep(uSheet, uSheet + 0.035, rs) * (1.0 - bg);',
    '  s *= 1.0 - smoothstep(uSheet - 0.03, uSheet, rs) * (1.0 - sheet) * (1.0 - bg) * 0.12;',
    '  s = mix(s, uPaperS * (0.985 + pp.a * 0.03), sheet);',
    '  if (uDbg > 0.5) s = vec3(1.0 - eS, 1.0 - eC, 1.0 - hat);',
    '  if (uDbg > 1.5) s = vec3(leaf + today, bg + lawn, pv);',
    '  if (uDbg > 2.5) s = vec3(outer, inkL, tick);',
  '  if (uDbg > 3.5) s = vec3(1.0 - pl, 1.0 - gFront, 1.0 - hat);',
    '  gl_FragColor = vec4(clamp(s, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  // The background is the Hub's paper with one loose watercolour wash of sky laid behind the build: darker and stormier
  // overhead and away from the sun, warm where the sun breaks through, rays lifted out of it, pigment gathered where
  // its ragged edge dried, and bare paper beyond. Alpha 2 marks it so the grade and the pen leave it alone.
  var SKY_VS = 'varying vec3 vDir; void main() { vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }';
  var SKY_FS = [
    'uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot; uniform vec3 uGlow; uniform vec3 uPaperC; uniform vec2 uSunScr; uniform vec2 uGlowC; uniform sampler2D uStroke; uniform vec2 uRes; uniform vec4 uWashP; uniform float uGlowLow; varying vec3 vDir;',
    'void main() {',
    '  vec2 uv = gl_FragCoord.xy / uRes; vec2 asp = vec2(uRes.x / uRes.y, 1.0);',
    '  vec2 q = (uv - vec2(0.5, uWashP.y)) * asp;',
    '  float n1 = texture2D(uStroke, uv * asp * 0.9 + 0.11).g, n2 = texture2D(uStroke, uv * asp * 2.7 + 0.23).g, n3 = texture2D(uStroke, uv * asp * 1.5 + 0.61).g;',
    '  float sr = texture2D(uStroke, uv * asp * 1.2 + 0.4).r;',
    '  float r = length(q * vec2(0.8, 1.0));',
    '  float edge = uWashP.x + (n1 - 0.5) * 0.28 + (n2 - 0.5) * 0.09;',
    '  float m = 1.0 - smoothstep(edge - 0.06, edge, r);',
    '  float h = uv.y;',
    '  vec3 w = mix(uMid, uTop, smoothstep(0.35, 0.98, h));',
    '  w = mix(uBot, w, smoothstep(0.08, 0.5, h));',
    // the light: the wash lifted warm behind the focal point (the turret top), clear of storm
    '  float gr = length((uv - uGlowC) * asp) + (n2 - 0.5) * 0.12;',
    '  float glow = (1.0 - smoothstep(0.04, 0.5, gr)) * mix(1.0, 1.0 - smoothstep(0.3, 0.75, h), uGlowLow);',
    // the storm: two glazes of pigment with hard dried edges, heavier away from the light
    '  float away = smoothstep(0.18, 0.75, gr);',
    '  float cn = n3 * 0.65 + sr * 0.35, cn2 = n1 * 0.6 + n3 * 0.4;',
    '  float g1 = smoothstep(0.5, 0.53, cn), g2 = smoothstep(0.56, 0.585, cn2);',
    '  float bandE = (smoothstep(0.5, 0.515, cn) - smoothstep(0.515, 0.56, cn)) + (smoothstep(0.56, 0.57, cn2) - smoothstep(0.57, 0.61, cn2));',
    '  float hk = smoothstep(0.25, 0.7, h);',
    '  w = mix(w, w * 0.78, g1 * away * hk);',
    '  w = mix(w, w * 0.82, g2 * away * hk);',
    '  w *= 1.0 - bandE * away * hk * 0.1;',
    '  w = mix(w, uGlow, glow * 0.85);',
    '  vec3 tint = clamp(w / max(uPaperC, vec3(1e-3)), 0.0, 1.0);',
    '  vec3 c = uPaperC * mix(vec3(1.0), tint, m * uWashP.w);',
    '  float rim = smoothstep(edge - 0.05, edge - 0.004, r) * m;',
    '  c *= 1.0 - rim * 0.2 * uWashP.w;',
    '  c *= 1.0 - ((n2 - 0.5) * 0.1 + (sr - 0.5) * 0.06) * m * uWashP.w;',
    '  gl_FragColor = vec4(c, 2.0);',
    '}'
  ].join('\n');

  function v3(hex, k) { var c = U.tone(hex); return new T.Vector3(c.r * (k || 1), c.g * (k || 1), c.b * (k || 1)); }
  function srgb(hex) { var c = new T.Color(hex); return new T.Vector3(c.r, c.g, c.b); }

  function Stage(canvas, w, h, opts) {
    opts = opts || {};
    this.w = w; this.h = h; this.ss = opts.ss || 2; this.radius = opts.radius || 4; this.paint = opts.paint !== false;
    var r = this.renderer = new T.WebGLRenderer({ canvas: canvas, context: opts.context, antialias: false, preserveDrawingBuffer: true, alpha: false });
    r.setPixelRatio(1); r.setSize(w, h, false);
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap; r.outputEncoding = T.LinearEncoding; r.toneMapping = T.NoToneMapping;
    r.autoClear = true;
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(opts.fov || 26, w / h, 0.5, 2000);
    this.sun = new T.DirectionalLight(0xffffff, 1);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(opts.shadowSize || 4096, opts.shadowSize || 4096); this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04; this.sun.shadow.radius = 2.5;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    // sky
    this.skyU = { uTop: { value: new T.Vector3() }, uMid: { value: new T.Vector3() }, uBot: { value: new T.Vector3() }, uGlow: { value: new T.Vector3() }, uPaperC: { value: v3('#f2f1ee') }, uSunScr: { value: new T.Vector2(1, 0.5) }, uWashP: { value: new T.Vector4(0.62, 0.56, 1, 1) }, uGlowLow: { value: 0 }, uGlowC: { value: new T.Vector2(0.66, 0.86) }, uStroke: KIT.G.uStroke, uRes: { value: new T.Vector2(Math.round(w * this.ss), Math.round(h * this.ss)) } };
    var sky = new T.Mesh(new T.SphereGeometry(900, 32, 16), new T.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: this.skyU, side: T.BackSide, depthWrite: false }));
    sky.frustumCulled = false; sky.renderOrder = -10; this.sky = sky; this.scene.add(sky);
    // targets
    var ft = opts.float === false ? T.UnsignedByteType : T.HalfFloatType;
    var W = Math.round(w * this.ss), H = Math.round(h * this.ss);
    this.rtScene = new T.WebGLRenderTarget(W, H, { type: ft, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true });
    this.rtScene.depthTexture = new T.DepthTexture(W, H); this.rtScene.depthTexture.type = T.UnsignedIntType;
    this.rtA = new T.WebGLRenderTarget(w, h, { type: ft, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false });
    this.rtB = new T.WebGLRenderTarget(w, h, { type: ft, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false });
    this.rtGhost = new T.WebGLRenderTarget(w, h, { type: T.UnsignedByteType, minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: true });
    this.rtGhost.depthTexture = new T.DepthTexture(w, h); this.rtGhost.depthTexture.type = T.UnsignedIntType;
    // the pen reads flags from the paint's alpha, so these two are never blended between texels
    [this.rtA, this.rtB].forEach(function (rt) { rt.texture.minFilter = rt.texture.magFilter = T.NearestFilter; });
    var bw = Math.max(1, Math.round(w / 4)), bh = Math.max(1, Math.round(h / 4));
    this.rtBl1 = new T.WebGLRenderTarget(bw, bh, { type: ft, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false });
    this.rtBl2 = this.rtBl1.clone();
    this.quadScene = new T.Scene(); this.quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new T.Mesh(new T.PlaneGeometry(2, 2)); this.quad.frustumCulled = false; this.quadScene.add(this.quad);
    var texel = new T.Vector2(1 / w, 1 / h);
    this.mResolve = pass(RESOLVE_FS, { tColor: { value: this.rtScene.texture }, tDepth: { value: this.rtScene.depthTexture }, uTexel: { value: texel }, uSceneRes: { value: new T.Vector2(W, H) }, uSS: { value: this.ss }, uEdge: { value: opts.edge === undefined ? 0.35 : opts.edge }, uCam: { value: new T.Vector2(0.5, 2000) }, uEdgeCol: { value: new T.Vector3(0.55, 0.45, 0.42) } });
    this.mKuwa = pass(kuwaharaFS(this.radius), { tColor: { value: this.rtA.texture }, uTexel: { value: texel }, uQ: { value: 8 }, uRad: { value: this.radius } });
    this.mBright = pass(BRIGHT_FS, { tColor: { value: this.rtB.texture } });
    this.mBlur = pass(BLUR_FS, { tColor: { value: null }, uDir: { value: new T.Vector2() } });
    this.mFinal = pass(FINAL_FS, {
      tColor: { value: this.rtB.texture }, tBloom: { value: this.rtBl1.texture }, tPaper: { value: KIT.strokeTex }, uRes: { value: new T.Vector2(w, h) },
      uExposure: { value: 1 }, uSat: { value: 1 }, uContrast: { value: 1 }, uShadowTint: { value: new T.Vector3(1, 1, 1) }, uHighTint: { value: new T.Vector3(1, 1, 1) },
      uSplit: { value: 0.1 }, uVignette: { value: 0.3 }, uBloom: { value: 0.4 }, uGrain: { value: 1 },
      tDepth: { value: this.rtScene.depthTexture }, uTexel: { value: texel }, uCam: { value: new T.Vector2(0.5, 2000) },
      uInk: { value: srgb('#1f1e1c') }, uPaperS: { value: srgb('#f2f1ee') }, uSplat: { value: new T.Vector3(0.8, 0.84, 0.9) },
      uInkA: { value: 0.9 }, uLineW: { value: 1.7 * Math.max(1, w / 1400) }, uSilK: { value: 0.006 }, uCreaseK: { value: 0.0012 }, uHatchA: { value: 0.42 },
      uHatchGap: { value: Math.max(5.0, 7.0 * w / 1600) }, uHatchW: { value: Math.max(1.0, 1.35 * w / 1600) }, uCross: { value: 1 }, uWob: { value: 1.3 }, uSheet: { value: 0.72 }, uGrid: { value: Math.round(48 * w / 1600) }, uPen: { value: opts.pen === undefined ? 1 : opts.pen }, uDbg: { value: opts.dbg || 0 }, uLift: { value: 0.18 }, tGhost: { value: this.rtGhost.depthTexture }, uGhostOn: { value: 0 }, uGraphite: { value: srgb('#5f5d59') }, uToday: { value: srgb('#f26a1b') }, uTick: { value: Math.round(20 * Math.max(0.6, w / 1600)) }
    });
    this.look('day');
  }
  KIT.Stage = Stage;
  var S = Stage.prototype;

  S.look = function (name) {
    var L = KIT.applyLook(name);
    this.L = L;
    this.skyU.uTop.value.copy(v3(L.bgTop)); this.skyU.uMid.value.copy(v3(L.bgMid)); this.skyU.uBot.value.copy(v3(L.bgBot)); this.skyU.uGlow.value.copy(v3(L.sunGlow));
    var f = this.mFinal.uniforms;
    f.uExposure.value = L.exposure; f.uSat.value = L.sat; f.uContrast.value = L.contrast; f.uShadowTint.value.copy(v3(L.shadowTint).normalize().multiplyScalar(1.0));
    var st = U.tone(L.shadowTint), lum = 0.2126 * st.r + 0.7152 * st.g + 0.0722 * st.b; f.uShadowTint.value.set(st.r / lum * 0.6, st.g / lum * 0.6, st.b / lum * 0.6);
    var ht = U.tone(L.highTint), hl = 0.2126 * ht.r + 0.7152 * ht.g + 0.0722 * ht.b; f.uHighTint.value.set(ht.r / hl, ht.g / hl, ht.b / hl);
    f.uSplit.value = L.split; f.uVignette.value = L.vignette; f.uBloom.value = L.bloom;
    var wp = L.wash || [0.62, 0.56, 1, 1]; this.skyU.uWashP.value.set(wp[0], wp[1], wp[2], wp[3]); this.skyU.uGlowLow.value = L.glowLow || 0;
    this.skyU.uPaperC.value.copy(v3(L.paper || '#f2f1ee')); f.uPaperS.value.copy(srgb(L.paper || '#f2f1ee'));
    var sp = new T.Color(L.splat || L.bgTop); f.uSplat.value.set(sp.r, sp.g, sp.b);
    if (L.hatch !== undefined) f.uHatchA.value = L.hatch;
    if (L.ink !== undefined) f.uInkA.value = L.ink;
    if (L.sheet !== undefined) f.uSheet.value = L.sheet;
    if (L.lift !== undefined) f.uLift.value = L.lift;
    f.uCross.value = L.cross === undefined ? 0 : L.cross;
    return L;
  };
  // A new size (and supersampling) for the same renderer: the targets follow, and so do the pen's widths, which scale
  // with the picture's width just as they do when a stage is made.
  S.setSize = function (w, h, ss) {
    ss = ss || this.ss;
    if (w === this.w && h === this.h && ss === this.ss) return;
    this.w = w; this.h = h; this.ss = ss;
    var W = Math.round(w * ss), H = Math.round(h * ss), bw = Math.max(1, Math.round(w / 4)), bh = Math.max(1, Math.round(h / 4));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.rtScene.setSize(W, H); this.rtA.setSize(w, h); this.rtB.setSize(w, h); this.rtGhost.setSize(w, h);
    this.rtBl1.setSize(bw, bh); this.rtBl2.setSize(bw, bh);
    this.skyU.uRes.value.set(W, H);
    [this.mResolve, this.mKuwa, this.mFinal].forEach(function (m) { m.uniforms.uTexel.value.set(1 / w, 1 / h); });
    this.mResolve.uniforms.uSceneRes.value.set(W, H); this.mResolve.uniforms.uSS.value = ss;
    var f = this.mFinal.uniforms;
    f.uRes.value.set(w, h); f.uLineW.value = 1.7 * Math.max(1, w / 1400); f.uHatchGap.value = Math.max(5.0, 7.0 * w / 1600);
    f.uHatchW.value = Math.max(1.0, 1.35 * w / 1600); f.uGrid.value = Math.round(48 * w / 1600); f.uTick.value = Math.round(20 * Math.max(0.6, w / 1600));
  };
  // point the sun's shadow camera at a sphere (centre, radius) so the shadow map is spent where it matters
  S.fitShadow = function (center, radius) {
    var d = KIT.G.uSunDir.value;
    this.sun.position.copy(center).addScaledVector(d, radius * 3);
    this.sun.target.position.copy(center);
    var c = this.sun.shadow.camera; c.left = -radius; c.right = radius; c.top = radius; c.bottom = -radius; c.near = radius * 0.5; c.far = radius * 6; c.updateProjectionMatrix();
  };
  // frame a sphere from an azimuth / elevation (radians), az 0 = from +z (the front)
  S.frame = function (center, radius, az, el, o) {
    o = o || {};
    var cam = this.camera, fov = cam.fov * Math.PI / 180, aspect = this.w / this.h;
    var fit = radius / Math.sin(Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * aspect)) / 2) * (o.pad || 1.05);
    var dir = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    cam.position.copy(center).addScaledVector(dir, fit);
    cam.lookAt(center.x + (o.dx || 0), center.y + (o.dy || 0), center.z);
    cam.near = Math.max(0.3, fit - radius * 3); cam.far = fit + radius * 8 + 900; cam.updateProjectionMatrix();
    this.mResolve.uniforms.uCam.value.set(cam.near, cam.far);
  };
  // put the sky's light behind a point of the build (the turret top), wherever the camera frames it
  S.glowAt = function (p) {
    this.camera.updateMatrixWorld(); var v = p.clone().project(this.camera);
    this.skyU.uGlowC.value.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
  };
  S.draw = function (q) {
    this.quad.material = q; this.renderer.render(this.quadScene, this.quadCam);
  };
  S.render = function () {
    var r = this.renderer;
    this.sun.color.setRGB(1, 1, 1); this.sun.intensity = 1;
    this.mResolve.uniforms.uCam.value.set(this.camera.near, this.camera.far); this.mFinal.uniforms.uCam.value.set(this.camera.near, this.camera.far);
    this.camera.updateMatrixWorld(); var me = this.camera.matrixWorld.elements, sd = KIT.G.uSunDir.value;
    this.skyU.uSunScr.value.set(sd.x * me[0] + sd.y * me[1] + sd.z * me[2], sd.x * me[4] + sd.y * me[5] + sd.z * me[6]);
    r.setRenderTarget(this.rtScene); r.render(this.scene, this.camera);
    // the pencil pass: only what is still to come, as depth
    var ghosts = [], seen = [];
    this.scene.traverse(function (o) { if (o.isMesh) { seen.push([o, o.visible, o.material]); if (o.userData.ghost) ghosts.push(o); } });
    this.mFinal.uniforms.uGhostOn.value = ghosts.length ? 1 : 0;
    if (ghosts.length) {
      var au = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = false;
      seen.forEach(function (e) { e[0].visible = !!e[0].userData.ghost; if (e[0].userData.ghost) e[0].material = e[0].userData.ghost; });
      r.setRenderTarget(this.rtGhost); r.render(this.scene, this.camera);
      seen.forEach(function (e) { e[0].visible = e[1]; e[0].material = e[2]; });
      r.shadowMap.autoUpdate = au;
    }
    r.setRenderTarget(this.rtA); this.draw(this.mResolve);
    if (this.paint && this.radius > 0) { r.setRenderTarget(this.rtB); this.draw(this.mKuwa); this.mBright.uniforms.tColor.value = this.rtB.texture; this.mFinal.uniforms.tColor.value = this.rtB.texture; }
    else { this.mBright.uniforms.tColor.value = this.rtA.texture; this.mFinal.uniforms.tColor.value = this.rtA.texture; }
    r.setRenderTarget(this.rtBl1); this.draw(this.mBright);
    var tx = 1 / this.rtBl1.width, ty = 1 / this.rtBl1.height;
    for (var i = 0; i < 2; i++) {
      this.mBlur.uniforms.tColor.value = this.rtBl1.texture; this.mBlur.uniforms.uDir.value.set(tx * (1 + i), 0); r.setRenderTarget(this.rtBl2); this.draw(this.mBlur);
      this.mBlur.uniforms.tColor.value = this.rtBl2.texture; this.mBlur.uniforms.uDir.value.set(0, ty * (1 + i)); r.setRenderTarget(this.rtBl1); this.draw(this.mBlur);
    }
    r.setRenderTarget(null); this.draw(this.mFinal);
  };

  // ------------------------------------------------------------------ making a build
  // Build a catalogue entry. Returns { group, units, parts, torches, bounds, uniforms, def, show(fraction, todayFrom) }.
  KIT.make = function (kind, opts) {
    opts = opts || {};
    var def = KIT.builds[kind]; if (!def) throw new Error('No build ' + kind);
    var b = new KIT.Builder(opts.seed || U.hashStr(kind), {});
    var Uu = KIT.buildUniforms(), mats = KIT.makeMaterials(Uu);
    var ground = null;
    if (opts.island !== false && def.island !== false) {
      var io = Object.assign({ r: def.r || 12, flat: def.flat || def.footprint || [8, 8], ground: def.ground || 'grass', path: def.path, trees: def.trees, bushes: def.bushes, seed: (opts.seed || 1) }, def.islandOpts || {});
      ground = KIT.island(b, io);
    }
    b.ground = ground;
    def.build.call(b, b, opts);
    var out = b.finish(mats, opts);
    KIT.dropGeoCache();
    out.uniforms = Uu; out.def = def; out.mats = mats;
    Uu.uTotal.value = out.units;
    out.show = function (frac, todayN) {
      var n = frac >= 1 ? out.units + 1 : Math.floor(out.units * frac);
      Uu.uShown.value = n; Uu.uNewFrom.value = todayN ? Math.max(0, n - todayN) : 1e6; Uu.uTotal.value = out.units;
      return n;
    };
    out.litTorches = function () { var n = Uu.uShown.value; return out.torches.filter(function (t) { return t.unit < n; }); };
    return out;
  };
})();
