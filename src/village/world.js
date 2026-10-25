// The village in 3D: every build on its plot round the plaza, in the kit's
// own painterly style (public/kit), live on screen. He turns it with a
// finger, pinches to come close, taps a build to fly to it; the page
// (src/pages/Village.jsx) puts the labels, the dock and the sheets over it.
//
//   createWorld(canvas, { onLabels, onTap, onState, onLost, onError })
//     -> the world, or null when WebGL can't start (the page shows its plain
//        fallback then). The canvas gets its own WebGL context.
//   world.setVillage(village)   villageOf()'s village: makes what is new, one
//                               build at a time, the one going up first
//   world.setDay(d)             the replay: the village at the end of day d (null: today)
//   world.setInsets(r)          the screen left free by the cards ({ top, bottom, left, right }, CSS px)
//   world.focus(id) / fitAll()  fly to a build / back to the whole village
//   world.preview(kind)         a build drawn in pencil on the plot it would take (null: put it back)
//   world.dispose()
//
// How it stays light (the measurements are in the kit3d notes): nothing is
// drawn at rest. A finger on the glass draws cheap frames (CSS pixels, a
// small paint radius, no pencil pass, the shadow map kept); 150 ms after it
// lifts, one full still (device pixels up to 2x, the full paint, the pencil
// pass, the shadow fitted to the view). Builds that stand have no pencil
// meshes, every box is the lighter chamfer (detail 1), and meshes off screen
// are culled. Builds are made one per task so the page keeps answering, and
// their arrays let go once they are on the GPU.
//
// Lessons kept from the old map's engine and from ./paint.js: checked under Mesa
// (chromium --use-gl=angle --use-angle=gl in Xvfb) with zero GL errors;
// half-float targets only when the GPU can draw into them; the phone takes
// the GPU back from a page left in the background (webglcontextlost), and
// then everything is let go and the page starts the world afresh. Nothing
// here is instanced, so the instanceColor rule doesn't arise. paint.js is
// never asked for a still while this is on screen; its loaders are shared.

import * as THREE from "three";
import { loadBuild, preloadKit } from "./paint.js";
import { seedFor } from "../lib/village.js";
import { MAX_SOLDIERS, TILE, formationOf, pathsOf, planOf, scaleFor, spanOf, spotsOf, stageOf, stateOn } from "./plots.js";

const KIT_V = typeof __KIT_VERSION__ !== "undefined" ? __KIT_VERSION__ : "dev";
const kitUrl = (file) => `${import.meta.env.BASE_URL}kit/${file}?v=${KIT_V}`;

// three's own context attributes, opaque, and not kept after drawing (nothing reads this canvas back)
const ATTRS = { alpha: false, depth: true, stencil: true, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: "default" };
// the sway caught at the moment the painted stills catch it
const LOOK_TIME = 1.3;
const FOV = 28;
// the first view: a little above (higher on a tall screen), from the side of
// the build going up, turned this far from it
const EL0 = 0.56;
const EL_TALL = 0.74;
const TURN = 0.45;
const STILL_AFTER = 150;
const FLY_MS = 650;
// the pen in CSS pixels, the same in a cheap frame and a still
const PEN = { line: 1.35, gap: 4.2, hatch: 0.85, grid: 18, tick: 10 };
// the levelled ground staked out for the next build, and the stake's own rectangle
const STAKED = { w: 26, d: 24 };
const STAKE = { w: 15, d: 12 };

const nextTask = () => new Promise((r) => setTimeout(r, 0));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

let villageKitP = null;
function loadVillageKit() {
  if (window.KIT?.village) return Promise.resolve();
  if (!villageKitP) {
    villageKitP = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = kitUrl("kit-village.js");
      s.async = false;
      s.onload = () => resolve();
      s.onerror = () => {
        s.remove();
        villageKitP = null;
        reject(new Error("Could not load the village"));
      };
      document.head.appendChild(s);
    });
  }
  return villageKitP;
}

// The paint keeps values far above 1, so it wants half-float targets; without them the kit falls back to bytes.
function halfFloats(g) {
  if (typeof WebGL2RenderingContext !== "undefined" && g instanceof WebGL2RenderingContext) {
    return !!(g.getExtension("EXT_color_buffer_float") || g.getExtension("EXT_color_buffer_half_float"));
  }
  return !!(g.getExtension("OES_texture_half_float") && g.getExtension("OES_texture_half_float_linear") && g.getExtension("EXT_color_buffer_half_float"));
}

// Once a mesh's geometry is on the GPU its arrays only take memory, so they go (as paint.js does).
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

export function createWorld(canvas, cb = {}) {
  let gl = null;
  try {
    gl = canvas.getContext("webgl2", ATTRS) || canvas.getContext("webgl", ATTRS);
  } catch {
    gl = null;
  }
  if (!gl) return null;
  return new World(canvas, gl, cb);
}

class World {
  constructor(canvas, gl, cb) {
    this.canvas = canvas;
    this.gl = gl;
    this.cb = cb;
    this.t0 = performance.now();
    this.stats = { kit: 0, ground: 0, builds: [], people: [], first: 0, full: 0, frames: [] };
    this.view = { tx: 0, ty: 2, tz: 0, dist: 300, az: 0, el: EL0 };
    this.insets = { top: 0, bottom: 0, left: 0, right: 0 };
    this.made = new Map();
    this.ground = null;
    this.stake = null;
    this.soldiers = null;
    this.folk = null;
    this.shown = null;
    this.spare = null;
    this.previewKind = null;
    this.village = null;
    this.plan = null;
    this.day = null;
    this.ptrs = new Map();
    this.focusId = null;
    this.userMoved = false;
    this.reduced = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    this.dead = false;
    this.lost = false;
    this.R = 60;

    this.onLost = (e) => {
      if (this.dead) return;
      e.preventDefault?.();
      this.lost = true;
      this.teardown();
      this.cb.onLost?.();
    };
    canvas.addEventListener("webglcontextlost", this.onLost, false);
    this.onVisible = () => {
      if (document.hidden) {
        this.cancelFrames();
      } else if (!this.dead) {
        this.draw("still");
        this.pump();
      }
    };
    document.addEventListener("visibilitychange", this.onVisible);
    this.listen();
    this.ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => this.resized()) : null;
    this.ro?.observe(canvas);
    this.ready = this.start().catch((e) => {
      if (!this.dead) this.cb.onError?.(e);
    });
  }

  // ------------------------------------------------------------------ starting

  async start() {
    await preloadKit();
    await loadVillageKit();
    if (this.dead) return;
    const KIT = window.KIT;
    const g = this.gl;
    const max = Math.min(g.getParameter(g.MAX_TEXTURE_SIZE), g.getParameter(g.MAX_RENDERBUFFER_SIZE));
    this.maxTex = max;
    const { cw, ch } = this.css();
    this.stage = new KIT.Stage(this.canvas, cw, ch, {
      radius: 4,
      paint: true,
      edge: 0.35,
      fov: FOV,
      dbg: 0,
      pen: 1,
      ss: 1,
      context: g,
      preserve: false,
      shadowSize: Math.min(2048, max),
      float: halfFloats(g),
      keepTargets: true,
    });
    const r = this.stage.renderer;
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = true;
    this.stage.skyU.uGlowC.value.set(0.66, 0.86);
    // a build in pencil veils the ink of what stands behind it (the island's far rim, say), as it veils the hatching
    this.stage.mFinal.uniforms.uGhostVeil.value = 0.9;
    this.stats.kit = performance.now() - this.t0;
    this.cb.onState?.({ phase: "kit" });
    this.pump();
  }

  css() {
    return { cw: Math.max(1, this.canvas.clientWidth || 1), ch: Math.max(1, this.canvas.clientHeight || 1) };
  }

  // ------------------------------------------------------------------ what is wanted

  setVillage(village) {
    if (this.dead) return;
    this.village = village;
    this.plan = planOf(village);
    this.paths = null;
    this.R = this.plan.radius;
    this.pump();
    this.apply();
    this.request();
  }

  setDay(d) {
    this.day = d;
    this.apply();
    this.request();
    this.later();
  }

  setInsets(r) {
    const was = this.insets;
    this.insets = { top: r.top || 0, bottom: r.bottom || 0, left: r.left || 0, right: r.right || 0 };
    if (was.top === this.insets.top && was.bottom === this.insets.bottom && was.left === this.insets.left && was.right === this.insets.right) return;
    // the whole village, or the build he flew to, framed again in what is left free
    if (this.focusId) this.focus(this.focusId);
    else if (!this.userMoved) {
      if (this.anim) this.fly(this.wholeView());
      else this.view = this.wholeView();
    }
    this.later(60);
  }

  today() {
    return this.village ? (this.day === null ? spanOf(this.village) : this.day) : 0;
  }

  // The plot a preview stands on: the build going up (it would take its place) or the next plot.
  previewPlot() {
    const v = this.village;
    const going = v && v.current >= 0 ? v.projects[v.current] : null;
    if (going) {
      const p = this.plan.plots.find((q) => q.id === going.id);
      return { ...p, replaces: going.id };
    }
    return { ...this.plan.stake, replaces: "stake" };
  }

  // Each plot's levelled ground, its forecourt and where its own path leaves the door, from the build's def.
  flatOf(kind) {
    const def = window.KIT.builds[kind] || {};
    const f = def.flat || def.footprint || [8, 8];
    const room = TILE - 2 * 2.4;
    const k = Math.min(1, room / Math.max(f[0], f[1]));
    return { w: f[0] * k, d: f[1] * k, ground: def.ground || "grass", skip: def.islandOpts?.cobbleSkip, path: def.path };
  }

  groundOpts() {
    const plan = this.plan;
    const toWorld = (p, lx, lz) => [p.x + lx * Math.cos(p.ry) + lz * Math.sin(p.ry), p.z - lx * Math.sin(p.ry) + lz * Math.cos(p.ry)];
    const flats = plan.plots.map((p) => {
      const f = this.flatOf(p.kind);
      return { x: p.x, z: p.z, w: f.w, d: f.d, ry: p.ry, ground: f.ground, skip: f.skip, s: 1 };
    });
    flats.push({ x: plan.stake.x, z: plan.stake.z, w: STAKED.w, d: STAKED.d, ry: plan.stake.ry, ground: "grass" });
    const depth = new Map(plan.plots.map((p) => [p.plot, this.flatOf(p.kind).d / 2]));
    depth.set(plan.stake.plot, STAKE.d / 2);
    const paths = pathsOf(plan, (p) => depth.get(p.plot) + 0.6).map((path) => {
      const p = [...plan.plots, plan.stake].find((q) => q.plot === path.plot);
      const def = p.kind ? this.flatOf(p.kind) : null;
      // the build's own path from its door, out to where the village's lane takes over
      if (def?.path?.length) {
        const room = TILE / 2 - 2.5;
        const own = [...def.path].reverse().map(([lx, lz]) => toWorld(p, clamp(lx, -room, room), clamp(lz, -room, room)));
        return { plot: path.plot, points: [...own, ...path.points.slice(1)] };
      }
      return path;
    });
    this.paths = paths;
    return {
      r: plan.radius,
      seed: 7,
      detail: 1,
      cull: true,
      flats,
      plaza: plan.plaza,
      paths: paths.map((p) => p.points),
      nature: plan.nature.map((n) => ({ x: n.x, z: n.z, s: TILE, kind: n.kind })),
    };
  }

  key(o) {
    return JSON.stringify(o, (k, v) => (typeof v === "function" ? String(v).length : typeof v === "number" ? Math.round(v * 100) / 100 : v));
  }

  // The next thing to make, nearest first: the ground, the stake, the build
  // going up, the others by their distance from where he is looking, then
  // the soldiers and the villagers. Null when everything is made.
  nextJob() {
    const v = this.village;
    if (!v || !this.stage) return null;
    const KIT = window.KIT;
    const kinds = [...new Set([...this.plan.plots.map((p) => p.kind), ...(this.previewKind ? [this.previewKind] : [])])];
    const missing = kinds.filter((k) => !KIT.builds[k]);
    if (missing.length) return { what: "scripts", kinds: missing };
    const go = this.groundOpts();
    const gk = this.key(go);
    if (!this.ground || this.ground.key !== gk) return { what: "ground", opts: go, key: gk };
    const sk = this.key([this.plan.stake.x, this.plan.stake.z, this.plan.stake.ry]);
    if (!this.stake || this.stake.key !== sk) return { what: "stake", key: sk };
    if (this.previewKind && (!this.shown || this.shown.kind !== this.previewKind)) {
      // (not over the very build it would draw: that one is already there, in its own progress)
      const there = this.made.get(this.previewPlot().replaces);
      if (!there || there.kind !== this.previewKind) return { what: "preview" };
    }
    const want = v.projects.map((p) => ({ p, at: this.plan.plots.find((q) => q.id === p.id) }));
    const todo = want.filter(({ p, at }) => {
      const B = this.made.get(p.id);
      return !B || B.key !== this.key([p.kind, p.seed, at.plot]);
    });
    if (todo.length) {
      const going = v.current >= 0 ? v.projects[v.current].id : null;
      const t = new THREE.Vector3(this.view.tx, 0, this.view.tz);
      // the one going up, then the one he is flying to, then the nearest
      const rank = (x) => (x.p.id === going ? 0 : x.p.id === this.focusId ? 1 : 2);
      todo.sort((a, b) => rank(a) - rank(b) || Math.hypot(a.at.x - t.x, a.at.z - t.z) - Math.hypot(b.at.x - t.x, b.at.z - t.z));
      return { what: "build", p: todo[0].p, at: todo[0].at };
    }
    const s = stateOn(v, spanOf(v));
    const tier = stateOn(v, this.today()).tier;
    const solK = this.key([Math.min(s.soldiers, MAX_SOLDIERS), tier, this.formationTurn()]);
    if ((this.soldiers?.key ?? this.key([0, 0, this.formationTurn()])) !== solK) return { what: "soldiers", key: solK, n: s.soldiers, tier };
    const folkK = this.key([v.villagers.slice(0, 40).map((x) => x.pid), this.paths?.length]);
    if ((this.folk?.key ?? this.key([[], this.paths?.length])) !== folkK) return { what: "folk", key: folkK };
    return null;
  }

  async pump() {
    if (this.pumping || this.dead) return;
    this.pumping = true;
    try {
      for (;;) {
        await this.gap();
        if (this.dead || this.lost) return;
        const job = this.nextJob();
        if (!job) break;
        await this.run(job);
        if (this.dead || this.lost) return;
        this.apply();
        if (job.what !== "scripts") this.drawSoon();
      }
      // a pencil build left over is let go, unless it is the chosen one waiting for the saved village
      if (!this.spare?.kept) this.dropSpare();
      if (this.village && !this.stats.full && this.made.size === this.village.projects.length) {
        this.draw("still");
        this.stats.full = performance.now() - this.t0;
        this.cb.onState?.({ phase: "ready", made: this.made.size, total: this.village.projects.length });
      }
    } catch (e) {
      if (!this.dead) this.cb.onError?.(e);
    } finally {
      this.pumping = false;
    }
  }

  // Between two makes: let the page answer, and wait while a finger is down or the page is hidden.
  async gap() {
    await nextTask();
    while (!this.dead && !this.lost && (document.hidden || this.ptrs.size || this.anim)) await new Promise((r) => setTimeout(r, 120));
  }

  async run(job) {
    const KIT = window.KIT;
    const st = this.stage;
    const t0 = performance.now();
    if (job.what === "scripts") {
      await Promise.all(job.kinds.map((k) => loadBuild(k)));
      return;
    }
    if (job.what === "ground") {
      const old = this.ground;
      const g = KIT.village.ground(job.opts);
      g.key = job.key;
      letGoOnUpload(g.group);
      st.scene.add(g.group);
      if (old) {
        st.scene.remove(old.group);
        KIT.village.dispose(old);
      }
      this.ground = g;
      this.stats.ground = performance.now() - t0;
      if (!old && !this.userMoved) this.view = this.wholeView();
      this.cb.onState?.({ phase: "ground" });
      return;
    }
    if (job.what === "stake") {
      const p = this.plan.stake;
      const s = KIT.village.stake({ x: p.x, z: p.z, w: STAKE.w, d: STAKE.d, ry: p.ry, height: this.ground.height, detail: 1, cull: true });
      s.key = job.key;
      s.box = new THREE.Box3(new THREE.Vector3(p.x - STAKED.w / 2, -0.5, p.z - STAKED.d / 2), new THREE.Vector3(p.x + STAKED.w / 2, 3, p.z + STAKED.d / 2));
      letGoOnUpload(s.group);
      if (this.stake) {
        st.scene.remove(this.stake.group);
        KIT.village.dispose(this.stake);
      }
      st.scene.add(s.group);
      this.stake = s;
      return;
    }
    if (job.what === "build") {
      const { p, at } = job;
      const old = this.made.get(p.id);
      let mk = null;
      let ghost = !p.complete;
      // a build he just chose was already drawn in pencil on its plot: it becomes the build, with its progress
      const same = (x) => x && x.kind === p.kind && x.seed === (p.seed || 1) && x.plot === at.plot;
      if (same(this.spare) || same(this.shown)) {
        const was = same(this.spare) ? this.spare : this.shown;
        mk = was.mk;
        ghost = true;
        if (was === this.spare) this.spare = null;
        else this.shown = null;
      } else {
        mk = this.makeBuild(p.kind, p.seed || 1, ghost, at);
      }
      const B = this.place(mk, at, { id: p.id, kind: p.kind, seed: p.seed || 1, plot: at.plot, key: this.key([p.kind, p.seed, at.plot]), ghost });
      if (old) {
        st.scene.remove(old.group);
        KIT.village.dispose(old.mk);
      }
      this.made.set(p.id, B);
      this.stats.builds.push({ kind: p.kind, ms: Math.round(performance.now() - t0) });
      this.cb.onState?.({ phase: "build", made: this.made.size, total: this.village.projects.length });
      if (this.focusId === p.id) this.focus(p.id);
      return;
    }
    if (job.what === "preview") {
      const kind = this.previewKind;
      const at = this.previewPlot();
      const seed = seedFor(kind);
      const mk = this.makeBuild(kind, seed, true, at);
      if (this.previewKind !== kind) {
        KIT.village.dispose(mk);
        return;
      }
      this.clearShown();
      const B = this.place(mk, at, { id: "preview", kind, seed, plot: at.plot, replaces: at.replaces, ghost: true });
      mk.show(0, 0);
      this.shown = B;
      this.focus("preview");
      return;
    }
    if (job.what === "soldiers") {
      const list = formationOf(job.n, job.tier);
      const ppl = KIT.village.people(list, { detail: 1, cull: true, seed: 17 });
      ppl.group.rotation.y = this.formationTurn();
      ppl.group.updateMatrixWorld(true);
      ppl.key = job.key;
      ppl.box = new THREE.Box3().setFromObject(ppl.group);
      if (!list.length) ppl.box.makeEmpty();
      letGoOnUpload(ppl.group);
      if (this.soldiers) {
        st.scene.remove(this.soldiers.group);
        KIT.village.dispose(this.soldiers);
      }
      st.scene.add(ppl.group);
      this.soldiers = ppl;
      this.stats.people.push({ what: "soldiers", n: list.length, ms: Math.round(performance.now() - t0) });
      if (this.focusId === "soldiers") this.focus("soldiers");
      return;
    }
    if (job.what === "folk") {
      const v = this.village;
      const H = this.ground.height;
      const list = spotsOf(this.paths || [], v.villagers).map((s) => {
        const r = (s.seed % 1000) / 1000;
        return { x: s.x, z: s.z, y: H(s.x, s.z) - 0.02, ry: s.ry, role: s.role, pose: s.pose, beard: s.gender !== "F" && r < 0.35, hat: r > 0.7 ? "straw" : null };
      });
      const ppl = KIT.village.people(list, { detail: 1, cull: true, seed: 23 });
      ppl.key = job.key;
      letGoOnUpload(ppl.group);
      if (this.folk) {
        st.scene.remove(this.folk.group);
        KIT.village.dispose(this.folk);
      }
      st.scene.add(ppl.group);
      this.folk = ppl;
      this.stats.people.push({ what: "villagers", n: list.length, ms: Math.round(performance.now() - t0) });
    }
  }

  makeBuild(kind, seed, ghost, at) {
    const KIT = window.KIT;
    const H = this.ground?.height;
    // the ground under the build, in the build's own frame
    const ground = H
      ? { height: (lx, lz) => H(at.x + lx * Math.cos(at.ry) + lz * Math.sin(at.ry), at.z - lx * Math.sin(at.ry) + lz * Math.cos(at.ry)) }
      : undefined;
    return KIT.make(kind, { island: false, ghost, seed, detail: 1, cull: true, ground });
  }

  // On its plot, facing the plaza, a little smaller only if it would reach past its tile.
  place(mk, at, info) {
    const g = mk.group;
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    g.scale.setScalar(1);
    g.updateMatrixWorld(true);
    const local = new THREE.Box3().setFromObject(g);
    const reach = Math.max(Math.abs(local.min.x), Math.abs(local.max.x), Math.abs(local.min.z), Math.abs(local.max.z));
    const s = scaleFor(reach);
    g.position.set(at.x, 0, at.z);
    g.rotation.y = at.ry;
    g.scale.setScalar(s);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    letGoOnUpload(g);
    this.stage.scene.add(g);
    return { ...info, mk, group: g, box, ry: at.ry, x: at.x, z: at.z, s };
  }

  formationTurn() {
    return Math.round(this.sideOf() / (Math.PI / 2)) * (Math.PI / 2);
  }

  // ------------------------------------------------------------------ the replay, progress, previews

  // Every build as it stood at the end of the day shown, its people too.
  apply() {
    const v = this.village;
    if (!v || !this.stage) return;
    const KIT = window.KIT;
    const s = stateOn(v, this.today());
    const by = new Map(s.builds.map((b) => [b.id, b]));
    // what the pencil preview (or a chosen one waiting to become the build) stands in for
    const instead = new Set([this.shown?.replaces, this.spare?.kept ? this.spare.replaces : null].filter(Boolean));
    for (const B of this.made.values()) {
      const b = by.get(B.id);
      if (!b) continue;
      B.group.visible = b.exists && !instead.has(B.id);
      const { frac, today } = stageOf(B.mk.units, b.done, b.need, b.laid);
      B.mk.show(frac, today);
      const ghost = b.exists && !b.complete;
      if (ghost !== B.ghost) {
        KIT.village.ghosts(B.mk, ghost);
        B.ghost = ghost;
      }
    }
    // the next plot is today's: not staked yet on a day of the replay
    if (this.stake) this.stake.group.visible = !instead.has("stake") && this.today() >= spanOf(v);
    if (this.soldiers) this.soldiers.show(Math.min(s.soldiers, this.soldiers.units));
    if (this.folk) this.folk.show(Math.min(s.villagers, this.folk.units));
    this.state = s;
    this.shadowDirty = true;
  }

  preview(kind) {
    if (this.dead) return;
    this.previewKind = kind || null;
    if (!kind) {
      // kept a moment: if he chose it, the saved build takes it over
      if (this.shown) {
        this.dropSpare();
        this.spare = this.shown;
        this.stage.scene.remove(this.shown.group);
        this.shown = null;
      }
      this.apply();
      this.request();
      this.later();
      setTimeout(() => this.pump(), 0);
      return;
    }
    if (this.shown && this.shown.kind === kind) {
      this.focus("preview");
      return;
    }
    this.pump();
  }

  // He chose the build drawn in pencil and it is saved: it stays on its plot, standing in for what it replaces, until
  // the saved build takes it over (made() adopts it), so the plot never shows the old build or nothing meanwhile.
  keepPreview() {
    if (this.dead || !this.shown) return;
    this.dropSpare();
    this.spare = { ...this.shown, kept: true };
    this.shown = null;
    this.previewKind = null;
    // (if the saved village never comes, what it stands in for comes back after a while)
    clearTimeout(this.keptT);
    this.keptT = setTimeout(() => {
      if (!this.dead && this.spare?.kept) this.dropSpare();
    }, 10000);
  }

  clearShown() {
    if (!this.shown) return;
    this.stage.scene.remove(this.shown.group);
    window.KIT.village.dispose(this.shown.mk);
    this.shown = null;
  }

  dropSpare() {
    if (!this.spare) return;
    const kept = this.spare.kept;
    this.stage?.scene.remove(this.spare.group);
    window.KIT.village.dispose(this.spare.mk);
    this.spare = null;
    // nothing took it over: what it stood in for comes back
    if (kept) {
      this.apply();
      this.drawSoon();
    }
  }

  // ------------------------------------------------------------------ the camera

  // Which way the build going up (or the newest, or the next plot) lies from the plaza.
  sideOf() {
    const v = this.village;
    const plan = this.plan;
    if (!v || !plan) return 0;
    const id = v.current >= 0 ? v.projects[v.current].id : v.projects[v.projects.length - 1]?.id;
    const p = plan.plots.find((q) => q.id === id) ?? plan.stake;
    return Math.atan2(p.x, p.z);
  }

  // The whole village in the free part of the screen: the island to its rim
  // and the skirt below it, every build on it (a plot not made yet by its
  // levelled ground and a likely height, so the view hardly moves as the
  // builds come in), seen a little turned from the side of the build going
  // up, so that build stands near and the lanes run across the picture.
  wholeView() {
    if (!this.stage) return { ...this.view };
    const R = this.R;
    const depth = Math.max(14, R * 0.3);
    const pts = [];
    for (let i = 0; i < 32; i++) {
      const c = Math.cos((i / 32) * Math.PI * 2);
      const s = Math.sin((i / 32) * Math.PI * 2);
      // the rim wavers a few percent either side of R; the skirt narrows as it hangs
      pts.push(new THREE.Vector3(c * R * 1.05, 0.4, s * R * 1.05), new THREE.Vector3(c * R * 0.64, -depth * 0.55, s * R * 0.64));
    }
    const corners = (b) => {
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new THREE.Vector3(x, y, z));
    };
    const flat = (x, z, w, d, ry, h) => {
      const c = Math.abs(Math.cos(ry));
      const s = Math.abs(Math.sin(ry));
      const hw = (w * c + d * s) / 2;
      const hd = (w * s + d * c) / 2;
      corners(new THREE.Box3(new THREE.Vector3(x - hw, 0, z - hd), new THREE.Vector3(x + hw, h, z + hd)));
    };
    if (this.plan) {
      for (const p of this.plan.plots) {
        const B = this.made.get(p.id);
        if (B) {
          if (B.group.visible) corners(B.box);
        } else if (window.KIT?.builds?.[p.kind]) {
          const f = this.flatOf(p.kind);
          flat(p.x, p.z, f.w, f.d, p.ry, Math.min(24, Math.max(f.w, f.d) * 0.8));
        } else flat(p.x, p.z, 20, 20, p.ry, 14);
      }
    }
    const { cw, ch } = this.css();
    const ins = this.insets;
    const tall = ch - ins.top - ins.bottom > (cw - ins.left - ins.right) * 1.1;
    const view = { tx: 0, ty: 2, tz: 0, az: this.sideOf() + TURN, el: tall ? EL_TALL : EL0, dist: 100 };
    // the near rim looks bigger than the far one: the point looked at slides along the ground, toward or away from
    // the eye, to where the island sits in the middle of the free part, top to bottom
    const fx = -Math.sin(view.az);
    const fz = -Math.cos(view.az);
    let best = null;
    for (let i = -6; i <= 6; i++) {
      const k = (i / 6) * R * 0.35;
      const v = { ...view, tx: fx * k, tz: fz * k };
      v.dist = this.fitDist(pts, v, 0.97);
      const { y0, y1 } = this.spanOn(pts, v);
      const off = Math.abs((y0 + y1) / 2);
      if (!best || off < best.off) best = { off, v };
    }
    Object.assign(view, best.v);
    this.maxDist = view.dist * 1.5;
    return view;
  }

  // A build three-quarters from its front, as the painted stills show it, filling the free part of the screen.
  viewOf(B) {
    const b = B.box;
    const c = new THREE.Vector3();
    b.getCenter(c);
    const pts = [];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new THREE.Vector3(x, y, z));
    const view = { tx: c.x, ty: b.min.y + (b.max.y - b.min.y) * 0.32, tz: c.z, az: B.ry - 0.62, el: 0.4, dist: 50 };
    view.dist = this.fitDist(pts, view, 0.9);
    return view;
  }

  // The garrison close, from in front of it where nothing stands between: of
  // the ways round the plaza, the one nearest its front from which no build
  // (nor the pencil preview) hides the soldiers, a little higher if every
  // way is blocked.
  soldiersView() {
    const b = this.soldiers?.box;
    if (!b || b.isEmpty()) return null;
    const c = new THREE.Vector3();
    b.getCenter(c);
    // the ranks with a stride of room round them, never framed closer than a few soldiers wide
    const hx = Math.max(7, (b.max.x - b.min.x) / 2 + 2);
    const hz = Math.max(7, (b.max.z - b.min.z) / 2 + 2);
    const pts = [];
    for (const x of [c.x - hx, c.x + hx]) for (const z of [c.z - hz, c.z + hz]) pts.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, b.max.y + 0.5, z));
    const blocks = [...this.made.values()].filter((B) => B.group.visible).map((B) => B.box);
    if (this.shown) blocks.push(this.shown.box);
    // what must be seen: the middle of the ranks and their two ends, at chest height
    const dx = (b.max.x - b.min.x) / 2;
    const dz = (b.max.z - b.min.z) / 2;
    const marks = [new THREE.Vector3(c.x, 1.1, c.z), new THREE.Vector3(c.x - dx, 1.1, c.z - dz), new THREE.Vector3(c.x + dx, 1.1, c.z + dz), new THREE.Vector3(c.x - dx, 1.1, c.z + dz), new THREE.Vector3(c.x + dx, 1.1, c.z - dz)];
    const ray = new THREE.Ray();
    const hit = new THREE.Vector3();
    const front = this.formationTurn();
    let best = null;
    for (const el of [0.5, 0.78]) {
      for (let k = -6; k <= 6; k++) {
        const view = { tx: c.x, ty: 1, tz: c.z, az: front + (k * Math.PI) / 8, el, dist: 50 };
        view.dist = this.fitDist(pts, view, 0.9);
        const ce = Math.cos(el);
        const eye = new THREE.Vector3(view.tx + view.dist * ce * Math.sin(view.az), view.ty + view.dist * Math.sin(el), view.tz + view.dist * ce * Math.cos(view.az));
        let hidden = 0;
        for (const m of marks) {
          const far = eye.distanceTo(m);
          ray.set(eye, m.clone().sub(eye).normalize());
          if (blocks.some((box) => ray.intersectBox(box, hit) && hit.distanceTo(eye) < far - 0.5)) hidden++;
        }
        const score = hidden * 10 + Math.abs(k) * 0.4 + (el > 0.6 ? 1.5 : 0);
        if (!best || score < best.score) best = { score, view };
      }
    }
    return best.view;
  }

  // How far up and down the free part of the screen the points reach from a view: -1 its bottom, 1 its top.
  spanOn(pts, view) {
    const { cw, ch } = this.css();
    const ins = this.insets;
    const yb = -1 + (2 * ins.bottom) / ch;
    const yt = 1 - (2 * ins.top) / ch;
    const saved = this.view;
    this.view = view;
    this.camera(cw, ch, 1);
    this.view = saved;
    const v3 = new THREE.Vector3();
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      v3.copy(p).project(this.stage.camera);
      y0 = Math.min(y0, v3.y);
      y1 = Math.max(y1, v3.y);
    }
    const m = (yt + yb) / 2;
    const h = (yt - yb) / 2;
    return { y0: (y0 - m) / h, y1: (y1 - m) / h };
  }

  // The nearest distance at which every point is inside the free part of the screen.
  fitDist(pts, view, fill = 1) {
    if (!this.stage) return view.dist;
    const cam = this.stage.camera;
    const { cw, ch } = this.css();
    const ins = this.insets;
    const x0 = -1 + (2 * ins.left) / cw;
    const x1 = 1 - (2 * ins.right) / cw;
    const y0 = -1 + (2 * ins.bottom) / ch;
    const y1 = 1 - (2 * ins.top) / ch;
    const mx = ((x1 - x0) / 2) * (1 - fill);
    const my = ((y1 - y0) / 2) * (1 - fill);
    const saved = { ...this.view };
    let lo = 4;
    let hi = 6000;
    const v3 = new THREE.Vector3();
    for (let i = 0; i < 26; i++) {
      const mid = Math.sqrt(lo * hi);
      this.view = { ...view, dist: mid };
      this.camera(cw, ch, 1);
      const fits = pts.every((p) => {
        v3.copy(p).project(cam);
        return v3.z < 1 && v3.x >= x0 + mx && v3.x <= x1 - mx && v3.y >= y0 + my && v3.y <= y1 - my;
      });
      if (fits) hi = mid;
      else lo = mid;
    }
    this.view = saved;
    return hi;
  }

  // The orbit's camera, with the picture's centre moved into the free part of the screen.
  camera(cw, ch, k) {
    const st = this.stage;
    const cam = st.camera;
    const v = this.view;
    const c = Math.cos(v.el);
    cam.position.set(v.tx + v.dist * c * Math.sin(v.az), v.ty + v.dist * Math.sin(v.el), v.tz + v.dist * c * Math.cos(v.az));
    cam.up.set(0, 1, 0);
    cam.lookAt(v.tx, v.ty, v.tz);
    const R = this.R;
    cam.near = Math.max(0.5, v.dist - R * 1.6);
    cam.far = v.dist + R * 2.5 + 900;
    const W = Math.round(cw * k);
    const H = Math.round(ch * k);
    cam.aspect = W / H;
    const ins = this.insets;
    cam.setViewOffset(W, H, ((ins.right - ins.left) / 2) * k, ((ins.bottom - ins.top) / 2) * k, W, H);
    cam.updateMatrixWorld();
  }

  clampView() {
    const v = this.view;
    const R = this.R;
    v.el = clamp(v.el, 0.12, 1.3);
    v.dist = clamp(v.dist, 9, this.maxDist || R * 8);
    const r = Math.hypot(v.tx, v.tz);
    const lim = R * 0.92;
    if (r > lim) {
      v.tx *= lim / r;
      v.tz *= lim / r;
    }
  }

  fly(to, ms = FLY_MS) {
    if (this.dead) return;
    const from = { ...this.view };
    let daz = (to.az - from.az) % (Math.PI * 2);
    if (daz > Math.PI) daz -= Math.PI * 2;
    if (daz < -Math.PI) daz += Math.PI * 2;
    const target = { ...to, az: from.az + daz };
    if (this.reduced || !ms) {
      this.view = target;
      this.anim = null;
      this.later(0);
      return;
    }
    this.anim = { from, to: target, t0: performance.now(), ms };
    this.request();
  }

  focus(id) {
    this.focusId = id;
    if (!this.stage) return;
    if (id === "soldiers") {
      const view = this.soldiersView();
      if (!view) return;
      this.userMoved = true;
      this.fly(view);
      return;
    }
    const B = id === "preview" ? this.shown : this.made.get(id);
    if (!B) return;
    this.userMoved = true;
    this.fly(this.viewOf(B));
  }

  fitAll() {
    this.focusId = null;
    this.userMoved = false;
    if (!this.stage) return;
    this.fly(this.wholeView());
  }

  // Back to the whole village if he hasn't moved it himself; a build he flew to stays in view.
  resized() {
    if (!this.stage) return;
    if (!this.userMoved && !this.anim) this.view = this.wholeView();
    this.later(60);
  }

  // ------------------------------------------------------------------ drawing

  request() {
    if (this.raf || this.dead) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      if (this.anim) {
        const a = this.anim;
        const t = Math.min(1, (performance.now() - a.t0) / a.ms);
        const e = ease(t);
        const v = {};
        for (const k of Object.keys(a.to)) v[k] = a.from[k] + (a.to[k] - a.from[k]) * e;
        this.view = v;
        if (t >= 1) {
          this.anim = null;
          this.later(40);
        } else this.request();
      } else if (!this.ptrs.size) {
        // a cheap frame for a change (a day of the replay, a wheel): the still follows it
        this.later();
      }
      this.draw("drag");
    });
  }

  // a full still once nothing has moved for a moment
  later(ms = STILL_AFTER) {
    clearTimeout(this.stillT);
    this.stillT = setTimeout(() => {
      if (this.ptrs.size || this.anim) return;
      this.draw("still");
    }, ms);
  }

  // after a build is made: a still, unless he is moving it (then the moving frames show it)
  drawSoon() {
    if (this.ptrs.size || this.anim) this.request();
    else this.draw("still");
  }

  cancelFrames() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    clearTimeout(this.stillT);
  }

  stillScale(cw, ch) {
    const dpr = window.devicePixelRatio || 1;
    let k = Math.min(dpr, 2);
    const ss = k < 1.5 ? 1.5 : 1;
    const lim = Math.floor(this.maxTex / ss) - 2;
    k = Math.min(k, lim / cw, lim / ch);
    return { k, ss };
  }

  draw(q) {
    if (!this.stage || this.dead || this.lost || document.hidden) return;
    const KIT = window.KIT;
    const t0 = performance.now();
    const st = this.stage;
    const r = st.renderer;
    const { cw, ch } = this.css();
    const still = q === "still";
    // a cheap frame still waiting would only cover this one
    if (still && this.raf && !this.anim && !this.ptrs.size) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    const { k, ss } = still ? this.stillScale(cw, ch) : { k: 1, ss: 1 };
    const w = Math.max(1, Math.round(cw * k));
    const h = Math.max(1, Math.round(ch * k));
    st.setSize(w, h, ss);
    st.setRadius(still ? 4 : 2);
    st.pencil = still;
    // the pen the same width on the glass, whatever the pixels
    const f = st.mFinal.uniforms;
    f.uLineW.value = PEN.line * k;
    f.uHatchGap.value = PEN.gap * k;
    f.uHatchW.value = PEN.hatch * k;
    f.uGrid.value = Math.round(PEN.grid * k);
    f.uTick.value = Math.round(PEN.tick * k);
    this.camera(cw, ch, k);
    const cam = st.camera;
    const v = this.view;
    // the shadow map: over the whole village while moving, fitted to the view in a close still
    const seen = v.dist * Math.tan(((FOV / 2) * Math.PI) / 180) * 1.6;
    const near = still && seen < this.R * 0.55;
    const sc = near ? new THREE.Vector3(v.tx, 0, v.tz) : new THREE.Vector3(0, 0, 0);
    const sr = near ? Math.max(18, seen * 1.2) : this.R * 1.02;
    const sk = `${Math.round(sc.x)}:${Math.round(sc.z)}:${Math.round(sr)}`;
    if (sk !== this.shadowKey) {
      st.fitShadow(sc, sr);
      this.shadowKey = sk;
      this.shadowDirty = true;
    }
    if (this.shadowDirty) {
      r.shadowMap.needsUpdate = true;
      this.shadowDirty = false;
    }
    KIT.village.air({ fog: [v.dist * 0.9, v.dist * 3.5 + this.R], cloud: 0 });
    KIT.G.uTime.value = LOOK_TIME;
    if (still) {
      const list = [...this.made.values()].filter((B) => B.group.visible).map((B) => ({ mk: B.mk, matrix: B.group.matrixWorld }));
      KIT.setTorches(KIT.village.torches(list, new THREE.Vector3(v.tx, v.ty, v.tz)));
    }
    st.sky.position.copy(cam.position);
    st.render();
    const ms = performance.now() - t0;
    this.stats.frames.push({ q, ms: Math.round(ms) });
    if (this.stats.frames.length > 60) this.stats.frames.shift();
    if (still && !this.stats.first && this.made.size && this.village) {
      const going = this.village.current >= 0 ? this.village.projects[this.village.current].id : null;
      if (!going || this.made.has(going)) this.stats.first = performance.now() - this.t0;
    }
    this.labels(cw, ch);
  }

  // Where each label goes, in CSS pixels: over each build, the next plot, the pencil preview.
  labels(cw, ch) {
    const cam = this.stage.camera;
    const out = [];
    const v3 = new THREE.Vector3();
    const put = (id, kind, box, lift = 0.8) => {
      v3.set((box.min.x + box.max.x) / 2, box.max.y + lift, (box.min.z + box.max.z) / 2);
      const d = v3.distanceTo(cam.position);
      v3.project(cam);
      out.push({ id, kind, x: ((v3.x + 1) / 2) * cw, y: ((1 - v3.y) / 2) * ch, on: v3.z > -1 && v3.z < 1, d });
    };
    for (const B of this.made.values()) if (B.group.visible) put(B.id, "build", B.box);
    if (this.shown) put("preview", "preview", this.shown.box);
    if (this.stake?.group.visible) put("stake", "plot", this.stake.box, -0.5);
    // where the garrison is on the screen, so a label can keep off it while the soldiers are shown
    const b = this.soldiers?.box;
    if (b && !b.isEmpty() && this.state?.soldiers) {
      let l = Infinity;
      let r = -Infinity;
      let t = Infinity;
      let btm = -Infinity;
      let on = true;
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
        v3.set(x, y, z).project(cam);
        if (v3.z <= -1 || v3.z >= 1) on = false;
        const sx = ((v3.x + 1) / 2) * cw;
        const sy = ((1 - v3.y) / 2) * ch;
        l = Math.min(l, sx);
        r = Math.max(r, sx);
        t = Math.min(t, sy);
        btm = Math.max(btm, sy);
      }
      if (on) out.push({ id: "soldiers", kind: "soldiers", rect: { l, r, t, b: btm } });
    }
    this.cb.onLabels?.(out);
  }

  // ------------------------------------------------------------------ fingers, a mouse, keys

  listen() {
    const c = this.canvas;
    const pos = (e) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    this.onDown = (e) => {
      if (this.dead) return;
      c.setPointerCapture?.(e.pointerId);
      const p = pos(e);
      this.ptrs.set(e.pointerId, { ...p, x0: p.x, y0: p.y, t0: performance.now(), moved: 0 });
      this.anim = null;
      if (this.ptrs.size === 2) {
        const [a, b] = [...this.ptrs.values()];
        this.pinch = { span: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        this.multi = true;
      }
    };
    this.onMove = (e) => {
      const p = this.ptrs.get(e.pointerId);
      if (!p) return;
      const q = pos(e);
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      p.x = q.x;
      p.y = q.y;
      p.moved = Math.max(p.moved, Math.hypot(q.x - p.x0, q.y - p.y0));
      const v = this.view;
      if (this.ptrs.size === 1 && !this.multi) {
        if (p.moved < 6 && !p.drag) return;
        p.drag = true;
        v.az -= dx * 0.0075;
        v.el += dy * 0.005;
      } else if (this.ptrs.size === 2 && this.pinch) {
        const [a, b] = [...this.ptrs.values()];
        const span = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        if (span > 10 && this.pinch.span > 10) v.dist *= this.pinch.span / span;
        this.pan(mx - this.pinch.mx, my - this.pinch.my);
        this.pinch = { span, mx, my };
      } else return;
      this.userMoved = true;
      this.focusId = null;
      this.clampView();
      this.request();
    };
    this.onUp = (e) => {
      const p = this.ptrs.get(e.pointerId);
      if (!p) return;
      this.ptrs.delete(e.pointerId);
      if (!this.ptrs.size) {
        const tap = !this.multi && !p.drag && p.moved < 8 && performance.now() - p.t0 < 500;
        this.multi = false;
        this.pinch = null;
        if (tap && e.type === "pointerup") this.tap(p.x, p.y);
        this.later();
        this.pump();
      } else this.pinch = null;
    };
    this.onWheel = (e) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      this.view.dist *= Math.exp(e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0015));
      this.userMoved = true;
      this.focusId = null;
      this.anim = null;
      this.clampView();
      this.request();
      this.later();
    };
    this.onKey = (e) => {
      const v = this.view;
      const k = e.key;
      if (k === "ArrowLeft") v.az += 0.14;
      else if (k === "ArrowRight") v.az -= 0.14;
      else if (k === "ArrowUp") v.el += 0.08;
      else if (k === "ArrowDown") v.el -= 0.08;
      else if (k === "+" || k === "=") v.dist *= 0.85;
      else if (k === "-" || k === "_") v.dist /= 0.85;
      else if (k === "0") return this.fitAll();
      else return;
      e.preventDefault();
      this.userMoved = true;
      this.anim = null;
      this.clampView();
      this.request();
      this.later();
    };
    c.addEventListener("pointerdown", this.onDown);
    c.addEventListener("pointermove", this.onMove);
    c.addEventListener("pointerup", this.onUp);
    c.addEventListener("pointercancel", this.onUp);
    c.addEventListener("wheel", this.onWheel, { passive: false });
    c.addEventListener("keydown", this.onKey);
  }

  // Two fingers move the village under them, along the ground.
  pan(dx, dy) {
    const v = this.view;
    const { ch } = this.css();
    const per = (2 * v.dist * Math.tan(((FOV / 2) * Math.PI) / 180)) / ch;
    const rx = Math.cos(v.az);
    const rz = -Math.sin(v.az);
    const fx = -Math.sin(v.az);
    const fz = -Math.cos(v.az);
    const up = Math.max(0.35, Math.sin(v.el));
    v.tx += -dx * per * rx + ((dy * per) / up) * fx;
    v.tz += -dx * per * rz + ((dy * per) / up) * fz;
  }

  // A tap: a build (or the preview), the next plot, the soldiers, or nothing; two taps on nothing bring the whole village back.
  tap(x, y) {
    if (!this.stage) return;
    const { cw, ch } = this.css();
    this.camera(cw, ch, 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((x / cw) * 2 - 1, -(y / ch) * 2 + 1), this.stage.camera);
    const hit = new THREE.Vector3();
    let best = null;
    let bd = Infinity;
    const test = (box, what) => {
      if (!box || box.isEmpty() || !ray.ray.intersectBox(box, hit)) return;
      const d = hit.distanceTo(ray.ray.origin);
      if (d < bd) {
        bd = d;
        best = what;
      }
    };
    for (const B of this.made.values()) if (B.group.visible) test(B.box, { kind: "build", id: B.id });
    if (this.shown) test(this.shown.box, { kind: "preview" });
    if (this.stake?.group.visible) test(this.stake.box, { kind: "plot" });
    if (this.soldiers?.box && this.state?.soldiers) test(this.soldiers.box, { kind: "soldiers" });
    const now = performance.now();
    if (!best) {
      const prev = this.lastTap;
      if (prev && now - prev.t < 320 && Math.hypot(prev.x - x, prev.y - y) < 40) {
        clearTimeout(this.tapT);
        this.lastTap = null;
        this.fitAll();
        this.cb.onTap?.({ kind: "whole" });
        return;
      }
      this.lastTap = { t: now, x, y };
      clearTimeout(this.tapT);
      this.tapT = setTimeout(() => this.cb.onTap?.({ kind: "empty" }), 320);
      return;
    }
    this.lastTap = null;
    this.cb.onTap?.(best);
  }

  // ------------------------------------------------------------------ letting go

  teardown() {
    this.cancelFrames();
    if (this.tornDown) return;
    this.tornDown = true;
    clearTimeout(this.tapT);
    clearTimeout(this.keptT);
    const KIT = window.KIT;
    try {
      const all = [...this.made.values()].map((B) => B.mk);
      for (const x of [...all, this.shown?.mk, this.spare?.mk, this.ground, this.stake, this.soldiers, this.folk]) if (x) KIT.village.dispose(x);
      this.made.clear();
      this.ground = this.stake = this.soldiers = this.folk = this.shown = this.spare = null;
      if (this.stage) {
        this.stage.dispose();
        this.stage.renderer.dispose();
      }
      // the kit's painted textures are shared with the painter's renderer and hold on to this one
      for (const t of [KIT?.strokeTex, KIT?.grassTex, ...Object.values(KIT?.leafTex ?? {})]) t?.dispose();
      KIT?.village?.air(null);
    } catch {
      // nothing more to let go of
    }
  }

  dispose() {
    if (this.dead) return;
    this.dead = true;
    const c = this.canvas;
    c.removeEventListener("pointerdown", this.onDown);
    c.removeEventListener("pointermove", this.onMove);
    c.removeEventListener("pointerup", this.onUp);
    c.removeEventListener("pointercancel", this.onUp);
    c.removeEventListener("wheel", this.onWheel);
    c.removeEventListener("keydown", this.onKey);
    document.removeEventListener("visibilitychange", this.onVisible);
    this.ro?.disconnect();
    const r = this.stage?.renderer;
    this.teardown();
    c.removeEventListener("webglcontextlost", this.onLost, false);
    // the GPU's memory back at once, unless the phone already took it
    try {
      if (r && !this.gl.isContextLost()) r.forceContextLoss();
    } catch {
      // already gone
    }
    this.stage = null;
  }

  // ------------------------------------------------------------------ for checks (the dev server's tests)

  debug() {
    const gl = this.gl;
    const px = new Uint8Array(4);
    return {
      stats: this.stats,
      view: this.view,
      made: [...this.made.values()].map((B) => ({ id: B.id, kind: B.kind, s: B.s, ghost: B.ghost, box: [B.box.min.toArray(), B.box.max.toArray()] })),
      glError: () => gl.getError(),
      info: () => ({ ...this.stage.renderer.info.render, programs: this.stage.renderer.info.programs?.length, geometries: this.stage.renderer.info.memory.geometries }),
      // n frames of one kind, each ended by reading a pixel back so the GPU's work is counted
      time: (q, n = 3) => {
        const out = [];
        const info = this.stage.renderer.info;
        for (let i = 0; i < n; i++) {
          info.autoReset = false;
          info.reset();
          const t0 = performance.now();
          this.draw(q);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          out.push(Math.round(performance.now() - t0));
          info.autoReset = true;
        }
        out.calls = info.render.calls;
        out.triangles = info.render.triangles;
        return { ms: out, calls: info.render.calls, triangles: info.render.triangles };
      },
      set: (view) => {
        Object.assign(this.view, view);
        this.userMoved = true;
        this.draw("still");
      },
      busy: () => this.pumping || !!this.nextJob(),
      // where a build (or "preview", "stake") is on the screen, in CSS pixels
      screenOf: (id) => {
        const B = id === "preview" ? this.shown : id === "stake" ? this.stake : this.made.get(id);
        if (!B?.box) return null;
        const { cw, ch } = this.css();
        this.camera(cw, ch, 1);
        const v3 = new THREE.Vector3();
        B.box.getCenter(v3).project(this.stage.camera);
        return { x: ((v3.x + 1) / 2) * cw, y: ((1 - v3.y) / 2) * ch };
      },
    };
  }
}
