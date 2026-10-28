// The village's water: the sea round the coast, drawn every frame in the
// stage's moving layer over the still picture of the land.
//
// The sea reads the still picture and its depth (Glade.shared): how deep
// the water is over each point of the sea bed decides its colour, from the
// clear turquoise of the shallows, through which the sand shows, to the deep
// blue-green out past the cove. Small waves move over it, the sky shows in
// it at a glancing angle, the sun glints on it, and foam runs up the beach
// and round the rocks.
//
//   const sea = makeSea(stage)   ->  { mesh, uniforms, dispose() }   (the mesh is in the moving layer)

import * as THREE from "three";
import { noiseTexture } from "./glade.js";

const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
const v3 = (hex) => {
  const c = lin(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
};

export const SEA_LOOK = {
  shallow: "#7fd0c4",
  mid: "#2f8f9b",
  deep: "#1c5a78",
  foam: "#f6f7f2",
  skyLow: "#dfe9ee",
  skyHigh: "#8fb4dc",
};

const SEA_VS = [
  "varying vec3 vPW;",
  "void main() {",
  "  vec4 w = modelMatrix * vec4(position, 1.0);",
  "  vPW = w.xyz;",
  "  gl_Position = projectionMatrix * viewMatrix * w;",
  "}",
].join("\n");

const SEA_FS = [
  "uniform sampler2D tStill; uniform sampler2D tStillDepth; uniform sampler2D uNoise; uniform vec2 uCam; uniform vec2 uRes; uniform float uTime;",
  "uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uFogCol; uniform vec3 uFog;",
  "uniform vec3 uShallow; uniform vec3 uMid; uniform vec3 uDeep; uniform vec3 uFoam; uniform vec3 uSkyLow; uniform vec3 uSkyHigh;",
  "varying vec3 vPW;",
  "float lin(float d) { float z = d * 2.0 - 1.0; return 2.0 * uCam.x * uCam.y / (uCam.y + uCam.x - z * (uCam.y - uCam.x)); }",
  "void main() {",
  "  vec2 uv = gl_FragCoord.xy / uRes;",
  "  vec3 toCam = cameraPosition - vPW;",
  "  float camD = length(toCam);",
  "  vec3 V = toCam / camD;",
  "  vec3 fwd = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);",
  // the sea bed under this point: back along the ray to the still picture's depth
  "  float dS = lin(texture2D(tStillDepth, uv).r);",
  "  vec3 ray = -V;",
  "  vec3 bed = cameraPosition + ray * (dS / max(dot(ray, fwd), 1e-3));",
  "  float depth = max(0.0, vPW.y - bed.y);",
  "  if (depth < 0.02) discard;",
  // small waves: two layers of the noise drifting different ways, finer near, calmer far
  "  vec2 p = vPW.xz;",
  "  float near = 1.0 - smoothstep(300.0, 1600.0, camD);",
  "  vec4 w1 = texture2D(uNoise, p / 38.0 + vec2(uTime * 0.011, uTime * 0.006));",
  "  vec4 w2 = texture2D(uNoise, p / 11.0 + vec2(-uTime * 0.017, uTime * 0.021));",
  "  vec4 w3 = texture2D(uNoise, p / 3.7 + vec2(uTime * 0.04, -uTime * 0.03));",
  "  vec2 slope = (w1.rg - 0.5) * 0.24 + (w2.ba - 0.5) * 0.18 * near + (w3.gr - 0.5) * 0.12 * near * near;",
  "  vec3 N = normalize(vec3(slope.x, 1.0, slope.y));",
  // what shows through the water: the bed, bent a little by the waves, fading into the water's own colour as it deepens
  "  vec2 ruv = uv + slope * 0.012 * smoothstep(0.0, 1.5, depth) * near;",
  "  float rdS = lin(texture2D(tStillDepth, ruv).r);",
  "  if (rdS < camD) ruv = uv;",
  "  vec3 under = texture2D(tStill, ruv).rgb;",
  "  vec3 tint = mix(uShallow, uMid, smoothstep(0.5, 5.0, depth));",
  "  tint = mix(tint, uDeep, smoothstep(5.0, 22.0, depth));",
  "  float clear = exp(-depth * 0.32);",
  "  vec3 water = mix(tint * 0.92, under * mix(vec3(1.0), uShallow * 1.6, 0.55), clear);",
  // the sky in the water at a glancing angle, and the sun's glints
  "  float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);",
  "  vec3 R = reflect(-V, N);",
  "  vec3 sky = mix(uSkyLow, uSkyHigh, smoothstep(0.0, 0.5, R.y));",
  "  vec3 c = mix(water, sky, clamp(fres, 0.0, 0.85));",
  "  float sp = pow(max(dot(R, uSunDir), 0.0), 220.0);",
  "  c += uSunCol * (sp * 1.6 + pow(max(dot(R, uSunDir), 0.0), 18.0) * 0.06);",
  // foam: a ruffled edge where the water thins on the sand and round the rocks, and bands that run in to the shore
  "  float fn = texture2D(uNoise, p / 6.0 + vec2(uTime * 0.02, 0.0)).a;",
  "  float edge = 1.0 - smoothstep(0.0, 0.35 + fn * 0.5, depth);",
  "  float bands = smoothstep(0.62, 0.9, sin(depth * 5.5 - uTime * 1.3 + fn * 3.0) * 0.5 + 0.5) * (1.0 - smoothstep(0.3, 1.3, depth));",
  "  float foam = clamp(edge + bands * 0.6, 0.0, 1.0) * smoothstep(0.35, 0.6, fn + 0.25);",
  "  c = mix(c, uFoam * (uSunCol * 0.45 + 0.55), foam * 0.85);",
  // the haze, as the land takes it
  "  float f = smoothstep(uFog.x, uFog.y, camD) * 0.94;",
  "  c = mix(c, uFogCol, f);",
  // the very edge melts into the sand
  "  float a = smoothstep(0.02, 0.12, depth);",
  "  gl_FragColor = vec4(c, a);",
  "}",
].join("\n");

export function makeSea(stage) {
  const G = window.KIT.G;
  const S = stage.shared;
  const uniforms = {
    tStill: S.tStill,
    tStillDepth: S.tStillDepth,
    uCam: S.uCam,
    uRes: S.uRes,
    uTime: S.uTime,
    uNoise: { value: noiseTexture() },
    uSunDir: G.uSunDir,
    uSunCol: G.uSunCol,
    uFogCol: G.uFogCol,
    uFog: G.uFog,
    uShallow: { value: v3(SEA_LOOK.shallow) },
    uMid: { value: v3(SEA_LOOK.mid) },
    uDeep: { value: v3(SEA_LOOK.deep) },
    uFoam: { value: v3(SEA_LOOK.foam) },
    uSkyLow: { value: v3(SEA_LOOK.skyLow) },
    uSkyHigh: { value: v3(SEA_LOOK.skyHigh) },
  };
  const material = new THREE.ShaderMaterial({ vertexShader: SEA_VS, fragmentShader: SEA_FS, uniforms, transparent: true, depthWrite: true });
  // the sea: from just inland of the shore (the land hides it there) out to the horizon, south of the mountains
  const geo = new THREE.PlaneGeometry(14000, 7700, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 7700 / 2 - 700);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = "sea";
  mesh.frustumCulled = false;
  stage.moving(mesh);
  return {
    mesh,
    uniforms,
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}
