// The painted village: every build as a still picture, the way the approved
// sketch (https://claude.ai/artifact/5Pw4e13GnTETFHkVthodS5) paints them, in
// oil-paint dabs under pen and ink on the Hub's paper, with today's pieces in
// the app's orange and what is still to come in pencil.
//
// The painting is the sketch's own kit, kept as plain scripts in public/kit/
// (kit-*.js and builds/<kind>.js; how it works is in the kit's README,
// hub-redesign/armory-sketch/kit/README.md). It loads the first time anything
// is painted, or ahead of time with preloadKit(), and draws with the three.js
// the app already has.
//
// There is one renderer for the whole app, off screen (an iPhone only allows a
// few WebGL contexts), and it paints one picture at a time, in a queue. The
// build it made last is kept, so painting the same build at a new stage (a
// task ticked on a quest) only moves its steps along and paints again. A
// painting asked for with `keep: false` (a build that stands) is made on its
// own and let go once painted, so it never costs the build going up its
// next tick.
//
//   paintBuild({ kind, done, need, laid, dragons, eggs, width, height, slot, signal, keep })
//     -> Promise of an object URL (image/jpeg) for an <img>. The URL is the
//        painter's: it is revoked when the same slot is painted again or on
//        release(slot). (Without a slot the URL is the caller's to revoke.)
//        A job whose signal aborts, or that a newer job for the same slot
//        replaces before it starts, rejects with an AbortError.
//   release(slot)   done with a slot: revoke its picture, drop its jobs
//   preloadKit()    load the kit's scripts (no build)
//   canPaint()      false when WebGL can't start: show thumbOf(kind) instead
//
// Checked under Mesa (chromium --use-gl=angle --use-angle=gl in Xvfb) with
// zero GL errors, as the notes at the top of ./world.js ask.

import * as THREE from "three";

// The static, finished painting of a build (public/village/builds/).
export const thumbOf = (kind) => `/village/builds/${kind}.jpg`;

const KIT_FILES = ["kit-core.js", "kit-build.js", "kit-world.js", "kit-people.js", "kit-stage.js", "kit-dragons.js"];
// vite.config.js stamps a hash of public/kit, so a new kit is never served from an old cache.
const KIT_V = typeof __KIT_VERSION__ !== "undefined" ? __KIT_VERSION__ : "dev";
const kitUrl = (file) => `${import.meta.env.BASE_URL}kit/${file}?v=${KIT_V}`;

// The sketch's stage (view.html): 26 degree lens, paint radius 4, its contour,
// the golden day, and the sway caught at the same moment.
const STAGE_OPTS = { radius: 4, paint: true, edge: 0.35, fov: 26, dbg: 0, pen: 1 };
const LOOK_TIME = 1.3;
const JPEG_Q = 0.88;

// ------------------------------------------------------------------ loading

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    // added in order and run in order, while they all download at once
    s.async = false;
    s.onload = () => resolve();
    s.onerror = () => {
      s.remove();
      reject(new Error(`Could not load ${src}`));
    };
    document.head.appendChild(s);
  });
}

let kitP = null;
export function preloadKit() {
  if (!kitP) {
    // the kit's scripts draw with window.THREE
    window.THREE = THREE;
    kitP = Promise.all(KIT_FILES.map((f) => loadScript(kitUrl(f)))).catch((e) => {
      kitP = null;
      throw e;
    });
  }
  return kitP;
}

const buildP = new Map();
export function loadBuild(kind) {
  if (window.KIT.builds[kind]) return Promise.resolve();
  if (!buildP.has(kind)) {
    const p = loadScript(kitUrl(`builds/${kind}.js`)).then(() => {
      if (!window.KIT.builds[kind]) throw new Error(`No painting for ${kind}`);
    });
    buildP.set(kind, p.catch((e) => {
      buildP.delete(kind);
      throw e;
    }));
  }
  return buildP.get(kind);
}

// ------------------------------------------------------------------ the renderer

let canvas = null;
let gl = null;
let noGL = false;
let stage = null;
// the last build made: { key, kind, mk }
let made = null;

// The one context, made the first time anyone asks. The renderer is made on it
// later, so asking costs no second context.
function context() {
  if (gl || noGL) return gl;
  try {
    const c = document.createElement("canvas");
    // three's own attributes, but opaque and kept after drawing so it can be read back
    const attrs = { alpha: false, depth: true, stencil: true, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: true, powerPreference: "default" };
    gl = c.getContext("webgl2", attrs) || c.getContext("webgl", attrs) || c.getContext("experimental-webgl", attrs);
    if (gl) {
      canvas = c;
      c.addEventListener("webglcontextlost", lost, false);
    }
  } catch {
    gl = null;
  }
  if (!gl) noGL = true;
  return gl;
}

// The phone took the GPU back (it does this to a page left in the background).
// Everything made on it is gone with it; the next painting starts afresh on a
// new context. The old renderer is let go of properly: the kit's textures are
// shared by every renderer that drew them and hold on to each one, so they
// are disposed too (three uploads them again when they're next drawn), and
// the old context, which three would bring back to life if the browser
// restored it, is left with nothing listening.
function lost() {
  canvas?.removeEventListener("webglcontextlost", lost, false);
  try {
    if (made) dispose(made.mk);
    stage?.renderer.dispose();
    const KIT = window.KIT;
    for (const t of [KIT?.strokeTex, KIT?.grassTex, ...Object.values(KIT?.leafTex ?? {})]) t?.dispose();
  } catch {
    // nothing more to let go of
  }
  canvas = null;
  gl = null;
  stage = null;
  made = null;
}

export function canPaint() {
  return !!context();
}

// The paint keeps values far above 1 (and flags in alpha), so it wants
// half-float targets; without them the kit falls back to bytes.
function halfFloats(g) {
  if (typeof WebGL2RenderingContext !== "undefined" && g instanceof WebGL2RenderingContext) {
    return !!(g.getExtension("EXT_color_buffer_float") || g.getExtension("EXT_color_buffer_half_float"));
  }
  return !!(g.getExtension("OES_texture_half_float") && g.getExtension("OES_texture_half_float_linear") && g.getExtension("EXT_color_buffer_half_float"));
}

// A phone paints at 1.5x supersampling with a 2048 shadow map; a desktop
// screen at 1x gets the sketch's own 2x and 4096.
function budget() {
  const desk = window.matchMedia?.("(pointer: fine)").matches && (window.devicePixelRatio || 1) <= 1;
  return desk ? { ss: 2, shadow: 4096 } : { ss: 1.5, shadow: 2048 };
}

// The stage, at this picture's size (no bigger than the supersampled targets allow).
function stageFor(w, h) {
  const g = context();
  if (!g) throw new Error("WebGL is not available");
  const { ss, shadow } = budget();
  const max = Math.min(g.getParameter(g.MAX_TEXTURE_SIZE), g.getParameter(g.MAX_RENDERBUFFER_SIZE));
  const k = Math.min(1, Math.floor(max / ss) / Math.max(w, h));
  w = Math.round(w * k);
  h = Math.round(h * k);
  if (!stage) stage = new window.KIT.Stage(canvas, w, h, { ...STAGE_OPTS, context: g, ss, shadowSize: Math.min(shadow, max), float: halfFloats(g) });
  else stage.setSize(w, h);
  return stage;
}

// ------------------------------------------------------------------ builds

function sceneKey(kind, dragons, eggs) {
  const ds = dragons.map((d) => `${d.id}:${d.kind}:${d.stage}`).join(",");
  const es = eggs.map((e) => `${e.id}:${e.kind}`).join(",");
  return `${kind}|${ds}|${es}`;
}

// Once a build's geometry is on the GPU its arrays only take memory (a big
// build's run to tens of MB), so they are let go. Nothing reads them again:
// a new stage only changes uniforms, and a lost context starts afresh.
function letGoOnUpload(group) {
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    for (const a of Object.values(g.attributes)) a.onUpload(letGo);
    if (g.index) g.index.onUpload(letGo);
  });
}
function letGo() {
  this.array = null;
}

// A build that is no longer kept: its geometry and materials off the GPU. (The
// kit's painted textures are shared by every build and stay.)
function dispose(mk) {
  const seen = new Set();
  mk.group.traverse((o) => {
    if (o.isMesh && !seen.has(o.geometry)) {
      seen.add(o.geometry);
      o.geometry.dispose();
    }
  });
  for (const m of Object.values(mk.mats)) m.dispose();
}

// The kit's step count for `done` of `need` tasks: everything once it stands
// (its people and dragons too), and the steps laid today counted back from there.
function stageOf(units, done, need, laid) {
  const shown = done >= need ? units + 1 : Math.floor((units * done) / need);
  const today = laid > 0 ? shown - Math.floor((units * Math.max(0, done - laid)) / need) : 0;
  return { shown, today };
}

// ------------------------------------------------------------------ the queue

const queue = [];
let running = false;
const urls = new Map();
// bumped on release(slot), so a painting finishing after it is not kept
const gens = new Map();

const abortError = () => new DOMException("The painting was cancelled", "AbortError");
const nextTask = () => new Promise((r) => setTimeout(r, 0));

function measure(name, start) {
  try {
    performance.clearMeasures(name);
    performance.measure(name, { start, end: performance.now() });
  } catch {
    // older Safari: no timing, nothing lost
  }
}

export function paintBuild({ kind, done, need, laid = 0, dragons = [], eggs = [], width = 960, height = 720, slot, signal, keep = true } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    if (!/^[a-z]+$/.test(kind || "")) return reject(new Error(`No painting for ${kind}`));
    const job = {
      kind,
      done: Math.max(0, Number(done) || 0),
      need: Math.max(1, Number(need) || 1),
      laid: Math.max(0, Number(laid) || 0),
      dragons: dragons || [],
      eggs: eggs || [],
      w: Math.max(16, Math.round(width)),
      h: Math.max(16, Math.round(height)),
      slot,
      gen: gens.get(slot) || 0,
      signal,
      keep: keep !== false,
      resolve,
      reject,
    };
    // a newer picture for the same slot replaces one still waiting its turn
    if (slot !== undefined) dropWaiting(slot);
    if (signal) {
      job.onAbort = () => drop(job);
      signal.addEventListener("abort", job.onAbort, { once: true });
    }
    queue.push(job);
    pump();
  });
}

export function release(slot) {
  gens.set(slot, (gens.get(slot) || 0) + 1);
  const url = urls.get(slot);
  if (url) URL.revokeObjectURL(url);
  urls.delete(slot);
  dropWaiting(slot);
}

// a job taken out of the queue before its turn
function drop(job) {
  const i = queue.indexOf(job);
  if (i < 0) return;
  queue.splice(i, 1);
  if (job.onAbort) job.signal.removeEventListener("abort", job.onAbort);
  job.reject(abortError());
}
function dropWaiting(slot) {
  for (const job of queue.filter((j) => j.slot === slot)) drop(job);
}

async function pump() {
  if (running) return;
  running = true;
  while (queue.length) {
    const job = queue.shift();
    try {
      const blob = await paint(job);
      if (job.signal?.aborted || (job.slot !== undefined && (gens.get(job.slot) || 0) !== job.gen)) throw abortError();
      const url = URL.createObjectURL(blob);
      if (job.slot !== undefined) {
        const old = urls.get(job.slot);
        urls.set(job.slot, url);
        if (old) URL.revokeObjectURL(old);
      }
      job.resolve(url);
    } catch (e) {
      job.reject(e);
    } finally {
      if (job.onAbort) job.signal.removeEventListener("abort", job.onAbort);
    }
  }
  running = false;
}

// One painting: load what it needs, make the build (or use the one kept),
// set its stage, frame it the way the sketch does, render, and read it back.
async function paint(job) {
  const stop = () => {
    if (job.signal?.aborted) throw abortError();
  };
  await preloadKit();
  stop();
  await loadBuild(job.kind);
  stop();
  const KIT = window.KIT;
  if (!context()) throw new Error("WebGL is not available");

  const key = sceneKey(job.kind, job.dragons, job.eggs);
  // a build with no dragon or egg in it looks the same whatever he has
  let use = made && made.kind === job.kind && (made.mk.hubSlots === 0 || made.key === key) ? made : null;
  let fresh = null;
  if (!use) {
    // let the page draw before the build takes the main thread
    await nextTask();
    stop();
    const t0 = performance.now();
    let mk;
    KIT.hub = { dragons: job.dragons, eggs: job.eggs };
    try {
      mk = KIT.make(job.kind, { seed: 1 });
    } finally {
      KIT.hub = null;
    }
    letGoOnUpload(mk.group);
    measure(`paint build ${job.kind}`, t0);
    // Making it and painting it are two tasks, so a tap in between is
    // answered; a job given up meanwhile goes no further and leaves the kept
    // build as it was.
    try {
      stop();
      await nextTask();
      stop();
      if (!context()) throw new Error("WebGL is not available");
    } catch (e) {
      dispose(mk);
      throw e;
    }
    fresh = use = { key, kind: job.kind, mk };
  }

  const st = stageFor(job.w, job.h);
  // Kept: it takes the place of the build kept before. Not kept: it's painted
  // on its own, and the kept one goes back on the stage the next time it's
  // painted.
  const old = made && made !== use ? made : null;
  if (old) st.scene.remove(old.mk.group);
  if (!use.mk.group.parent) st.scene.add(use.mk.group);
  if (job.keep || use === made) made = use;

  const t1 = performance.now();
  const mk = use.mk;
  const def = mk.def;
  const R = def.r || 12;
  const { shown, today } = stageOf(mk.units, job.done, job.need, job.laid);
  try {
    // show() counts floor(units * frac) steps; half a step over lands on `shown` exactly
    mk.show(shown > mk.units ? 1 : (shown + 0.5) / mk.units, today);
    KIT.setTorches(mk.litTorches());
    KIT.G.uTime.value = LOOK_TIME;
    st.fitShadow(new THREE.Vector3(0, 2, 0), R * 1.25);
    st.frame(new THREE.Vector3(0, def.frameY || R * 0.12, 0), def.frameR || R * 0.98, -0.62, def.frameEl || 0.5, { pad: 1.0 });
    // the sky's light behind the build's high point, or where a new stage puts it
    if (def.glowAt) st.glowAt(new THREE.Vector3(def.glowAt[0], def.glowAt[1], def.glowAt[2]));
    else st.skyU.uGlowC.value.set(0.66, 0.86);
    st.render();
  } finally {
    // the old build goes once the new one has its shaders, so they are kept and not compiled again
    if (old && made !== old) dispose(old.mk);
    // a build painted on its own goes once it's painted (the picture is already drawn)
    if (fresh && made !== fresh) {
      st.scene.remove(fresh.mk.group);
      dispose(fresh.mk);
    }
  }
  const g = gl;
  const blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("The painting could not be read"))), "image/jpeg", JPEG_Q));
  if (!g || g.isContextLost()) throw new Error("The painting was lost with the GPU");
  measure(`paint render ${job.kind}`, t1);
  return blob;
}
