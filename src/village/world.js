// The village in 3D: a town on a northern coast, every build on its plot
// round the plaza at the head of a cove, in the kit's painterly style, live
// on screen. The land climbs from the beach to hills and mountains, two
// rivers fall over the cliffs into the sea, gulls wheel, horses and sheep
// graze, boats bob at the pier. It is drawn as a model on a table (a
// tilt-shift lens: the town sharp, the sea in front and the hills behind
// soft); a tap on a build flies in close and the lens opens up. The page
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
// How it stays light: everything that stands still (the land, the builds,
// the trees) is drawn once into a picture and drawn again only when the
// view or the village changes (./glade.js); each frame after that draws
// only what moves (the sea, the rivers and falls, the birds, the animals,
// the boats) over that picture, then the lens. A finger on the glass draws
// at CSS pixels; 150 ms after it lifts, one full still at device pixels (up
// to 2x) with the sun's shadow fitted to the view. What moves runs at 30
// frames a second, and not at all when the page is hidden or motion is
// reduced. Builds are made one per task so the page keeps answering, and
// their arrays let go once they are on the GPU.
//
// Checked under Mesa (chromium --use-gl=angle --use-angle=gl in Xvfb) with
// zero GL errors; half-float targets only when the GPU can draw into them;
// the phone takes the GPU back from a page left in the background
// (webglcontextlost), and then everything is let go and the page starts the
// world afresh. paint.js is never asked for a still while this is on screen;
// its loaders are shared.

import * as THREE from "three";
import { loadBuild, preloadKit } from "./paint.js";
import { seedFor } from "../lib/village.js";
import { MAX_SOLDIERS, TILE, formationOf, pathsOf, planOf, scaleFor, spanOf, spotsOf, stageOf, stateOn } from "./plots.js";
import { PLAZA_LEVEL, groundOf, heightAt } from "./coast.js";
import { Glade, LENS } from "./glade.js";
import { makeTerrain } from "./terrain.js";
import { makeSea } from "./water.js";
import { makeRivers } from "./rivers.js";
import { makeDressing } from "./dressing.js";
import { makeLife } from "./life.js";
import { makeHarbour } from "./harbour.js";

const KIT_V = typeof __KIT_VERSION__ !== "undefined" ? __KIT_VERSION__ : "dev";
const kitUrl = (file) => `${import.meta.env.BASE_URL}kit/${file}?v=${KIT_V}`;

// three's own context attributes, opaque, and not kept after drawing (nothing reads this canvas back)
const ATTRS = { alpha: false, depth: true, stencil: false, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: "default" };
const FOV = 28;
// a tall, narrow screen (a phone held upright) sees at least this much across, in degrees, so the town isn't tiny
const MIN_ACROSS = 24;
// the first view: from the sea, a little east of south, looking down on the town as on a model
const AZ0 = 0.24;
const EL0 = 0.5;
const STILL_AFTER = 150;
const FLY_MS = 750;
// what moves is drawn this often (ms)
const TICK = 1000 / 30;
// the levelled ground staked out for the next build, and the stake's own rectangle
const STAKED = { w: 26, d: 24 };
const STAKE = { w: 15, d: 12 };
// how far the view's centre may wander from the plaza, and how far out it may pull
const ROAM = { x0: -620, x1: 620, z0: -900, z1: 260 };
const FAR = 1500;
// the lens over the whole town (a model on a table) and close to a build (open)
const LENS_WIDE = { ...LENS };
const LENS_NEAR = { ...LENS, range: 0.5, ramp: 1.4, blur: 4, screen: 0.12, band: 0.32 };

const nextTask = () => new Promise((r) => setTimeout(r, 0));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mixLens = (a, b, t) => Object.fromEntries(Object.keys(a).map((k) => [k, a[k] + (b[k] - a[k]) * t]));
const RAD = Math.PI / 180;
// The lens's angle top to bottom for a screen this wide for its height.
const fovFor = (aspect) => Math.min(46, Math.max(FOV, (2 * Math.atan(Math.tan((MIN_ACROSS / 2) * RAD) / aspect)) / RAD));

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

// The lens and the haze keep values above 1, so they want half-float targets; without them the stage uses bytes.
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

// The rectangle round a pad and its banks, for the ground and the woods to remake there.
function rectOfPad(p, m = 14) {
  const r = Math.hypot(p.hw ?? TILE / 2, p.hd ?? TILE / 2) + m;
  return { x0: p.x - r, z0: p.z - r, x1: p.x + r, z1: p.z + r };
}
function rectOfLine(pts, m = 6) {
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return { x0: Math.min(...xs) - m, z0: Math.min(...zs) - m, x1: Math.max(...xs) + m, z1: Math.max(...zs) + m };
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
    this.stats = { kit: 0, coast: {}, builds: [], people: [], first: 0, full: 0, frames: [] };
    this.view = { tx: 0, ty: PLAZA_LEVEL + 2, tz: -40, dist: 450, az: AZ0, el: EL0 };
    this.lens = 0;
    this.insets = { top: 0, bottom: 0, left: 0, right: 0 };
    this.made = new Map();
    this.coast = null;
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
    this.R = 80;
    this.clock = 0;
    this.lastTick = 0;

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
        this.lastTick = 0;
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
    const g = this.gl;
    const max = Math.min(g.getParameter(g.MAX_TEXTURE_SIZE), g.getParameter(g.MAX_RENDERBUFFER_SIZE));
    this.maxTex = max;
    const { cw, ch } = this.css();
    this.stage = new Glade(this.canvas, g, { width: cw, height: ch, float: halfFloats(g), shadowSize: Math.min(2048, max), fov: FOV });
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
    // the whole village, or the build flown to, framed again in what is left free
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

  // The lanes: from each build's own door (its def's path), across its pad, then the town's lane to the plaza.
  lanesOf() {
    const plan = this.plan;
    const toWorld = (p, lx, lz) => [p.x + lx * Math.cos(p.ry) + lz * Math.sin(p.ry), p.z - lx * Math.sin(p.ry) + lz * Math.cos(p.ry)];
    const depth = new Map(plan.plots.map((p) => [p.plot, this.flatOf(p.kind).d / 2]));
    depth.set(plan.stake.plot, STAKE.d / 2);
    return pathsOf(plan, (p) => depth.get(p.plot) + 0.6).map((path) => {
      const p = [...plan.plots, plan.stake].find((q) => q.plot === path.plot);
      const def = p.kind ? this.flatOf(p.kind) : null;
      if (def?.path?.length) {
        const room = TILE / 2 - 2.5;
        const own = [...def.path].reverse().map(([lx, lz]) => toWorld(p, clamp(lx, -room, room), clamp(lz, -room, room)));
        return { plot: path.plot, points: [...own, ...path.points.slice(1)] };
      }
      return path;
    });
  }

  // The pads the ground is levelled for: every plot in use and the one staked out.
  padsOf() {
    const plan = this.plan;
    return [...plan.plots, plan.stake].map((p) => p.site);
  }

  key(o) {
    return JSON.stringify(o, (k, v) => (typeof v === "function" ? String(v).length : typeof v === "number" ? Math.round(v * 100) / 100 : v));
  }

  // The next thing to make, nearest first: the coast (the land and the sea,
  // then the rivers, the plaza and pier, the woods, the life), the stake, the
  // build going up, the others by their distance from where the camera looks,
  // then the soldiers and the villagers. Null when everything is made.
  nextJob() {
    const v = this.village;
    if (!v || !this.stage) return null;
    const KIT = window.KIT;
    const kinds = [...new Set([...this.plan.plots.map((p) => p.kind), ...(this.previewKind ? [this.previewKind] : [])])];
    const missing = kinds.filter((k) => !KIT.builds[k]);
    if (missing.length) return { what: "scripts", kinds: missing };
    const pads = this.padsOf();
    const padKey = this.key(pads.map((p) => p.plot).sort((a, b) => a - b));
    const c = this.coast;
    if (!c) return { what: "land", pads, padKey };
    for (const part of ["rivers", "harbour", "dressing", "life"]) if (!c[part]) return { what: part };
    const lanes = this.lanesOf();
    const laneKey = this.key(lanes.map((l) => l.points));
    if (c.padKey !== padKey || c.laneKey !== laneKey) return { what: "reshape", pads, padKey, lanes, laneKey };
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
      // the one going up, then the one being flown to, then the nearest
      const rank = (x) => (x.p.id === going ? 0 : x.p.id === this.focusId ? 1 : 2);
      todo.sort((a, b) => rank(a) - rank(b) || Math.hypot(a.at.x - t.x, a.at.z - t.z) - Math.hypot(b.at.x - t.x, b.at.z - t.z));
      return { what: "build", p: todo[0].p, at: todo[0].at };
    }
    const s = stateOn(v, spanOf(v));
    const tier = stateOn(v, this.today()).tier;
    const solK = this.key([Math.min(s.soldiers, MAX_SOLDIERS), tier]);
    if ((this.soldiers?.key ?? this.key([0, 0])) !== solK) return { what: "soldiers", key: solK, n: s.soldiers, tier };
    const folkK = this.key([v.villagers.slice(0, 40).map((x) => x.pid), laneKey]);
    if ((this.folk?.key ?? this.key([[], laneKey])) !== folkK) return { what: "folk", key: folkK };
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

  // The highest thing to stand on at (x, z): the plaza's paving and the pier's deck, else the ground.
  standAt(x, z) {
    return this.coast?.harbour?.height?.(x, z) ?? this.ground.height(x, z);
  }

  async run(job) {
    const KIT = window.KIT;
    const st = this.stage;
    const t0 = performance.now();
    const took = (what) => {
      this.stats.coast[what] = Math.round(performance.now() - t0);
    };
    if (job.what === "scripts") {
      await Promise.all(job.kinds.map((k) => loadBuild(k)));
      return;
    }
    if (job.what === "land") {
      const ground = groundOf(job.pads);
      const terrain = makeTerrain(ground);
      st.scene.add(terrain.group);
      letGoOnUpload(terrain.group);
      const sea = makeSea(st);
      st.scene.add(sea.mesh);
      this.ground = ground;
      // (the lanes come with the first reshape, once the builds' own paths are known)
      this.coast = { terrain, sea, padKey: job.padKey, laneKey: null, lanes: [], pads: job.pads };
      took("land");
      if (!this.userMoved) this.view = this.wholeView();
      this.cb.onState?.({ phase: "ground" });
      return;
    }
    const c = this.coast;
    if (job.what === "rivers") {
      c.rivers = makeRivers(st);
      st.scene.add(c.rivers.group);
      took("rivers");
      return;
    }
    if (job.what === "harbour") {
      c.harbour = makeHarbour(st);
      st.scene.add(c.harbour.group);
      took("harbour");
      return;
    }
    if (job.what === "dressing") {
      c.dressing = makeDressing(st, this.ground, { lanes: c.lanes });
      st.scene.add(c.dressing.group);
      took("dressing");
      return;
    }
    if (job.what === "life") {
      c.life = makeLife(st, this.ground, { pads: this.ground.pads });
      st.scene.add(c.life.group);
      took("life");
      return;
    }
    if (job.what === "reshape") {
      // a plot taken or let go: the ground levelled again round it, the woods cleared, the lanes worn in
      const rects = [];
      const was = new Map(c.pads.map((p) => [p.plot, p]));
      const now = new Map(job.pads.map((p) => [p.plot, p]));
      for (const [k, p] of now) if (!was.has(k)) rects.push(rectOfPad(p));
      for (const [k, p] of was) if (!now.has(k)) rects.push(rectOfPad(p));
      const oldLanes = new Map(c.lanes.map((l) => [l.plot, l.points]));
      const lanes = job.lanes;
      for (const l of lanes) if (this.key(oldLanes.get(l.plot)) !== this.key(l.points)) rects.push(rectOfLine(l.points));
      for (const [k, pts] of oldLanes) if (!lanes.some((l) => l.plot === k)) rects.push(rectOfLine(pts));
      if (c.padKey !== job.padKey) {
        this.ground = groundOf(job.pads);
        c.terrain.rebuild(this.ground, rects);
        letGoOnUpload(c.terrain.group);
        c.life.setGround(this.ground, { pads: this.ground.pads });
      }
      c.terrain.setPaths(lanes.map((l) => l.points));
      c.dressing.update(this.ground, { lanes: lanes.map((l) => l.points) }, rects);
      c.padKey = job.padKey;
      c.laneKey = job.laneKey;
      c.lanes = lanes;
      c.pads = job.pads;
      this.paths = lanes;
      st.shadowDirty = true;
      took("reshape");
      return;
    }
    if (job.what === "stake") {
      const p = this.plan.stake;
      const s = KIT.village.stake({ x: p.x, z: p.z, w: STAKE.w, d: STAKE.d, ry: p.ry, height: this.ground.height, detail: 1, cull: true });
      s.key = job.key;
      s.box = new THREE.Box3(new THREE.Vector3(p.x - STAKED.w / 2, p.y - 0.5, p.z - STAKED.d / 2), new THREE.Vector3(p.x + STAKED.w / 2, p.y + 3, p.z + STAKED.d / 2));
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
      // a build just chosen was already drawn in pencil on its plot: it becomes the build, with its progress
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
      // drawn up in the plaza in front of the flag, on its paving, facing the sea and whoever looks from it
      const list = formationOf(job.n, job.tier).map((s) => ({ ...s, y: this.standAt(s.x, s.z) }));
      const ppl = KIT.village.people(list, { detail: 1, cull: true, seed: 17 });
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
      const list = spotsOf(this.paths || [], v.villagers).map((s) => {
        const r = (s.seed % 1000) / 1000;
        return { x: s.x, z: s.z, y: this.standAt(s.x, s.z) - 0.02, ry: s.ry, role: s.role, pose: s.pose, beard: s.gender !== "F" && r < 0.35, hat: r > 0.7 ? "straw" : null };
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
    // the ground under the build, in the build's own frame (its pad's level is its 0)
    const ground = H
      ? { height: (lx, lz) => H(at.x + lx * Math.cos(at.ry) + lz * Math.sin(at.ry), at.z - lx * Math.sin(at.ry) + lz * Math.cos(at.ry)) - at.y }
      : undefined;
    return KIT.make(kind, { island: false, ghost, seed, detail: 1, cull: true, ground });
  }

  // On its plot, facing the plaza, a little smaller only if it would reach past its pad.
  place(mk, at, info) {
    const g = mk.group;
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    g.scale.setScalar(1);
    g.updateMatrixWorld(true);
    const local = new THREE.Box3().setFromObject(g);
    const reach = Math.max(Math.abs(local.min.x), Math.abs(local.max.x), Math.abs(local.min.z), Math.abs(local.max.z));
    const s = scaleFor(reach);
    // on its pad's level (scaled about its feet, so they stay on the ground)
    g.position.set(at.x, at.y, at.z);
    g.rotation.y = at.ry;
    g.scale.setScalar(s);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    letGoOnUpload(g);
    this.stage.scene.add(g);
    this.stage.shadowDirty = true;
    return { ...info, mk, group: g, box, ry: at.ry, x: at.x, z: at.z, y: at.y, s };
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
    this.stage.shadowDirty = true;
    this.stage.still = true;
  }

  preview(kind) {
    if (this.dead) return;
    this.previewKind = kind || null;
    if (!kind) {
      // kept a moment: if it is chosen, the saved build takes it over
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

  // The build drawn in pencil was chosen and saved: it stays on its plot, standing in for what it replaces, until
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
    this.stage.still = true;
  }

  dropSpare() {
    if (!this.spare) return;
    const kept = this.spare.kept;
    this.stage?.scene.remove(this.spare.group);
    window.KIT.village.dispose(this.spare.mk);
    this.spare = null;
    if (this.stage) this.stage.still = true;
    // nothing took it over: what it stood in for comes back
    if (kept) {
      this.apply();
      this.drawSoon();
    }
  }

  // ------------------------------------------------------------------ the camera

  // The whole village in the free part of the screen, seen from the sea as a
  // model on a table: the plaza and the pier's end (so the cove lies in
  // front), every build (a plot not made yet by its levelled ground and a
  // likely height, so the view hardly moves as the builds come in) and the
  // plot staked for the next one. The coast runs on past the edges; a pinch
  // out shows the hills and the mountains behind.
  wholeView() {
    // (no plan yet: nothing to frame, so the view waits for the ground)
    if (!this.stage || !this.plan) return { ...this.view };
    const pts = [];
    const corners = (b) => {
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new THREE.Vector3(x, y, z));
    };
    const flat = (x, y, z, w, d, ry, h) => {
      const c = Math.abs(Math.cos(ry));
      const s = Math.abs(Math.sin(ry));
      const hw = (w * c + d * s) / 2;
      const hd = (w * s + d * c) / 2;
      corners(new THREE.Box3(new THREE.Vector3(x - hw, y, z - hd), new THREE.Vector3(x + hw, y + h, z + hd)));
    };
    const { plaza, stake } = this.plan;
    flat(plaza.x, plaza.y, plaza.z, plaza.w, plaza.d, 0, 3);
    // the beach in front of the plaza, so the town is seen over the cove
    flat(plaza.x, 0, plaza.z + 34, 30, 6, 0, 1);
    flat(stake.x, stake.y, stake.z, STAKED.w, STAKED.d, stake.ry, 3);
    for (const p of this.plan.plots) {
      const B = this.made.get(p.id);
      // a build the replay hides that day still counts, so the frame is the same on every day
      if (B) corners(B.box);
      else if (window.KIT?.builds?.[p.kind]) {
        const f = this.flatOf(p.kind);
        flat(p.x, p.y, p.z, f.w, f.d, p.ry, Math.min(24, Math.max(f.w, f.d) * 0.8));
      } else flat(p.x, p.y, p.z, 20, 20, p.ry, 14);
    }
    const view = this.centred(pts, EL0, 0.86);
    // a pinch out goes until the hills and the mountains show
    this.maxDist = Math.max(view.dist * 2.4, FAR);
    this.wideDist = view.dist;
    return view;
  }

  // The nearest view from the sea at which the points fit the free part of the screen, sitting in the middle of it
  // top to bottom: the near ground looks bigger than the far, so the point looked at slides along the ground, toward
  // or away from the eye, until the points' span is centred.
  centred(pts, el, fill) {
    const box = new THREE.Box3().setFromPoints(pts);
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    const span = Math.max(40, box.max.x - box.min.x, box.max.z - box.min.z);
    const view = { tx: cx, ty: PLAZA_LEVEL + 2, tz: cz, az: AZ0, el, dist: 100 };
    const fx = -Math.sin(view.az);
    const fz = -Math.cos(view.az);
    let best = null;
    for (let i = -6; i <= 6; i++) {
      const k = (i / 6) * span * 0.3;
      const v = { ...view, tx: cx + fx * k, tz: cz + fz * k };
      v.ty = this.groundAt(v.tx, v.tz) + 2;
      v.dist = this.fitDist(pts, v, fill);
      const { y0, y1 } = this.spanOn(pts, v);
      const off = Math.abs((y0 + y1) / 2);
      if (!best || off < best.off) best = { off, v };
    }
    // and across: slid sideways (along the view's right) until the points sit in the middle, then fitted again
    const v = best.v;
    const { cw, ch } = this.css();
    const across = Math.tan((fovFor(cw / ch) / 2) * RAD) * (cw / ch);
    for (let i = 0; i < 3; i++) {
      const { x0, x1 } = this.spanOn(pts, v);
      const mid = (x0 + x1) / 2;
      if (Math.abs(mid) < 0.01) break;
      const k = mid * v.dist * across * (1 - (this.insets.left + this.insets.right) / cw);
      v.tx += Math.cos(v.az) * k;
      v.tz -= Math.sin(v.az) * k;
      v.ty = this.groundAt(v.tx, v.tz) + 2;
      v.dist = this.fitDist(pts, v, fill);
    }
    return v;
  }

  groundAt(x, z) {
    return this.ground ? Math.max(0, this.ground.height(x, z)) : Math.max(0, heightAt(x, z));
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
    return this.aboveGround(view);
  }

  // The garrison close, from in front of it (it faces the sea) where nothing stands between: of the ways round the
  // plaza, the one nearest its front from which no build (nor the pencil preview) hides the soldiers, a little higher
  // if every way is blocked.
  soldiersView() {
    const b = this.soldiers?.box;
    if (!b || b.isEmpty()) return null;
    const c = new THREE.Vector3();
    b.getCenter(c);
    // the ranks with a stride of room round them, never framed closer than a few soldiers wide
    const hx = Math.max(7, (b.max.x - b.min.x) / 2 + 2);
    const hz = Math.max(7, (b.max.z - b.min.z) / 2 + 2);
    const pts = [];
    for (const x of [c.x - hx, c.x + hx]) for (const z of [c.z - hz, c.z + hz]) pts.push(new THREE.Vector3(x, b.min.y, z), new THREE.Vector3(x, b.max.y + 0.5, z));
    const blocks = [...this.made.values()].filter((B) => B.group.visible).map((B) => B.box);
    if (this.shown) blocks.push(this.shown.box);
    // what must be seen: the middle of the ranks and their two ends, at chest height
    const y = b.min.y + 1.1;
    const dx = (b.max.x - b.min.x) / 2;
    const dz = (b.max.z - b.min.z) / 2;
    const marks = [new THREE.Vector3(c.x, y, c.z), new THREE.Vector3(c.x - dx, y, c.z - dz), new THREE.Vector3(c.x + dx, y, c.z + dz), new THREE.Vector3(c.x - dx, y, c.z + dz), new THREE.Vector3(c.x + dx, y, c.z - dz)];
    const ray = new THREE.Ray();
    const hit = new THREE.Vector3();
    let best = null;
    for (const el of [0.5, 0.78]) {
      for (let k = -6; k <= 6; k++) {
        const view = { tx: c.x, ty: b.min.y + 1, tz: c.z, az: (k * Math.PI) / 8, el, dist: 50 };
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
    return this.aboveGround(best.view);
  }

  // The eye of a view, in the world.
  eyeOf(v) {
    const c = Math.cos(v.el);
    return new THREE.Vector3(v.tx + v.dist * c * Math.sin(v.az), v.ty + v.dist * Math.sin(v.el), v.tz + v.dist * c * Math.cos(v.az));
  }

  // A view raised, if need be, until its eye clears the ground in front of it (a hill between it and the build).
  aboveGround(view) {
    const v = { ...view };
    for (let i = 0; i < 24; i++) {
      const e = this.eyeOf(v);
      let clear = true;
      for (const t of [1, 0.75, 0.5]) {
        const x = v.tx + (e.x - v.tx) * t;
        const z = v.tz + (e.z - v.tz) * t;
        const y = v.ty + (e.y - v.ty) * t;
        if (y < this.groundAt(x, z) + 4) clear = false;
      }
      if (clear) break;
      v.el = Math.min(1.35, v.el + 0.04);
    }
    return v;
  }

  // How far up and down (and across) the free part of the screen the points reach from a view: -1 its bottom (left), 1 its top (right).
  spanOn(pts, view) {
    const { cw, ch } = this.css();
    const ins = this.insets;
    const yb = -1 + (2 * ins.bottom) / ch;
    const yt = 1 - (2 * ins.top) / ch;
    const xl = -1 + (2 * ins.left) / cw;
    const xr = 1 - (2 * ins.right) / cw;
    const saved = this.view;
    this.view = view;
    this.camera(cw, ch, 1);
    this.view = saved;
    const v3 = new THREE.Vector3();
    let y0 = Infinity;
    let y1 = -Infinity;
    let x0 = Infinity;
    let x1 = -Infinity;
    for (const p of pts) {
      v3.copy(p).project(this.stage.camera);
      y0 = Math.min(y0, v3.y);
      y1 = Math.max(y1, v3.y);
      x0 = Math.min(x0, v3.x);
      x1 = Math.max(x1, v3.x);
    }
    const m = (yt + yb) / 2;
    const h = (yt - yb) / 2;
    const mx = (xr + xl) / 2;
    const w = (xr - xl) / 2;
    return { y0: (y0 - m) / h, y1: (y1 - m) / h, x0: (x0 - mx) / w, x1: (x1 - mx) / w };
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
    cam.position.copy(this.eyeOf(v));
    cam.up.set(0, 1, 0);
    cam.lookAt(v.tx, v.ty, v.tz);
    cam.near = clamp(v.dist * 0.04, 0.5, 30);
    cam.far = v.dist * 3 + 9000;
    const W = Math.round(cw * k);
    const H = Math.round(ch * k);
    cam.aspect = W / H;
    cam.fov = fovFor(cw / ch);
    const ins = this.insets;
    cam.setViewOffset(W, H, ((ins.right - ins.left) / 2) * k, ((ins.bottom - ins.top) / 2) * k, W, H);
    cam.updateMatrixWorld();
  }

  clampView() {
    const v = this.view;
    v.el = clamp(v.el, 0.14, 1.35);
    v.dist = clamp(v.dist, 9, this.maxDist || FAR);
    v.tx = clamp(v.tx, ROAM.x0, ROAM.x1);
    v.tz = clamp(v.tz, ROAM.z0, ROAM.z1);
    v.ty = this.groundAt(v.tx, v.tz) + 2;
    // never under the ground: the eye kept above the hills
    const e = this.eyeOf(v);
    const floor = this.groundAt(e.x, e.z) + 5;
    if (e.y < floor) v.el = Math.min(1.35, Math.asin(clamp((floor - v.ty) / v.dist, -1, 1)));
  }

  fly(to, ms = FLY_MS) {
    if (this.dead) return;
    const from = { ...this.view };
    let daz = (to.az - from.az) % (Math.PI * 2);
    if (daz > Math.PI) daz -= Math.PI * 2;
    if (daz < -Math.PI) daz += Math.PI * 2;
    const target = { ...to, az: from.az + daz };
    const lensTo = this.focusId ? 1 : 0;
    if (this.reduced || !ms) {
      this.view = target;
      this.lens = lensTo;
      this.anim = null;
      this.later(0);
      return;
    }
    this.anim = { from, to: target, lens0: this.lens, lens1: lensTo, t0: performance.now(), ms };
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

  // Back to the whole village unless the view was moved by hand; a build flown to stays in view.
  resized() {
    if (!this.stage) return;
    if (!this.userMoved && !this.anim) this.view = this.wholeView();
    this.later(60);
  }

  // ------------------------------------------------------------------ drawing

  request() {
    if (this.raf || this.dead) return;
    this.raf = requestAnimationFrame((now) => {
      this.raf = 0;
      if (this.anim) {
        const a = this.anim;
        const t = Math.min(1, (performance.now() - a.t0) / a.ms);
        const e = ease(t);
        const v = {};
        for (const k of Object.keys(a.to)) v[k] = a.from[k] + (a.to[k] - a.from[k]) * e;
        this.view = v;
        this.lens = a.lens0 + (a.lens1 - a.lens0) * e;
        if (t >= 1) {
          this.anim = null;
          this.later(40);
        } else this.request();
      } else if (!this.ptrs.size) {
        // a cheap frame for a change (a day of the replay, a wheel): the still follows it
        this.later();
      }
      this.draw("drag", now);
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

  // after a build is made: a still, unless the view is moving (then the moving frames show it)
  drawSoon() {
    if (this.ptrs.size || this.anim) this.request();
    else this.draw("still");
  }

  cancelFrames() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    cancelAnimationFrame(this.tickRaf);
    this.tickRaf = 0;
    clearTimeout(this.stillT);
  }

  // What moves, between the stills: the sea, the falls, the birds, the boats, about 30 times a second, over the still
  // picture as it was last drawn (nothing else is drawn again). Not while the page is hidden, nor when motion is reduced.
  ticking() {
    if (this.tickRaf || this.dead || this.lost || this.reduced || document.hidden || !this.coast) return;
    this.tickRaf = requestAnimationFrame((now) => {
      this.tickRaf = 0;
      if (this.dead || this.lost || document.hidden) return;
      if (!this.raf && !this.ptrs.size && !this.anim && now - this.lastTick >= TICK - 2) this.frame(now);
      this.ticking();
    });
  }

  // The clock the moving things run on, in seconds; it stands still while the page is hidden.
  timeAt(now) {
    if (now === undefined) return this.clock;
    if (this.lastTick) this.clock += Math.min(0.1, (now - this.lastTick) / 1000);
    this.lastTick = now;
    return this.clock;
  }

  // One frame of what moves, the still picture kept.
  frame(now) {
    const st = this.stage;
    if (!st) return;
    const t = this.timeAt(now);
    this.coast?.life?.update(t, TICK / 1000);
    this.coast?.rivers?.update?.(t);
    st.render(t);
  }

  stillScale(cw, ch) {
    const dpr = window.devicePixelRatio || 1;
    let k = Math.min(dpr, 2);
    const lim = Math.floor(this.maxTex) - 2;
    k = Math.min(k, lim / cw, lim / ch);
    return k;
  }

  draw(q, now) {
    if (!this.stage || this.dead || this.lost || document.hidden) return;
    const t0 = performance.now();
    const st = this.stage;
    const { cw, ch } = this.css();
    const still = q === "still";
    // a cheap frame still waiting would only cover this one
    if (still && this.raf && !this.anim && !this.ptrs.size) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    const k = still ? this.stillScale(cw, ch) : 1;
    st.setSize(Math.max(1, Math.round(cw * k)), Math.max(1, Math.round(ch * k)));
    this.camera(cw, ch, k);
    const v = this.view;
    // the sun's shadow: over what is seen, fitted again in a still (while moving, the last one is kept)
    const seen = v.dist * Math.tan(((fovFor(cw / ch) / 2) * Math.PI) / 180) * 2.2;
    const sr = clamp(seen, 30, 700);
    const sk = `${Math.round(v.tx / 8)}:${Math.round(v.tz / 8)}:${Math.round(sr / 8)}`;
    if (still && sk !== this.shadowKey) {
      st.fitShadow(new THREE.Vector3(v.tx, v.ty, v.tz), sr);
      this.shadowKey = sk;
    }
    // the haze: by how far the eye is, so the town is clear and the far hills soft
    window.KIT.G.uFog.value.set(v.dist * 1.2, v.dist * 5 + 2500, 0);
    // the lens: the whole town a model on a table; close to a build, open
    const L = mixLens(LENS_WIDE, LENS_NEAR, this.lens);
    Object.assign(st.lens, L, { focus: v.dist });
    st.still = true;
    const t = this.timeAt(now ?? performance.now());
    this.coast?.life?.update(t, TICK / 1000);
    this.coast?.rivers?.update?.(t);
    st.render(t);
    const ms = performance.now() - t0;
    this.stats.frames.push({ q, ms: Math.round(ms) });
    if (this.stats.frames.length > 60) this.stats.frames.shift();
    if (still && !this.stats.first && this.made.size && this.village) {
      const going = this.village.current >= 0 ? this.village.projects[this.village.current].id : null;
      if (!going || this.made.has(going)) this.stats.first = performance.now() - this.t0;
    }
    this.labels(cw, ch);
    if (still) this.ticking();
  }

  // Where each label goes, in CSS pixels: over each build, the next plot, the pencil preview.
  labels(cw, ch) {
    const cam = this.stage.camera;
    // (the labels are placed on the CSS-pixel camera)
    this.camera(cw, ch, 1);
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
      this.moved();
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
      this.anim = null;
      this.moved();
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
      this.anim = null;
      this.moved();
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

  // The view was moved by hand: it stays where it was put, and the lens goes back to the whole town's on pulling out.
  moved() {
    this.userMoved = true;
    this.focusId = null;
    this.clampView();
    const wide = this.wideDist || this.wholeView().dist;
    if (this.lens > 0) this.lens = Math.min(this.lens, clamp((wide * 0.6 - this.view.dist) / (wide * 0.4), 0, 1));
  }

  // Two fingers move the village under them, along the ground.
  pan(dx, dy) {
    const v = this.view;
    const { cw, ch } = this.css();
    const per = (2 * v.dist * Math.tan(((fovFor(cw / ch) / 2) * Math.PI) / 180)) / ch;
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
      for (const x of [...all, this.shown?.mk, this.spare?.mk, this.stake, this.soldiers, this.folk]) if (x) KIT.village.dispose(x);
      const c = this.coast;
      if (c) for (const part of [c.terrain, c.sea, c.rivers, c.harbour, c.dressing, c.life]) part?.dispose();
      this.made.clear();
      this.coast = this.ground = this.stake = this.soldiers = this.folk = this.shown = this.spare = null;
      if (this.stage) {
        this.stage.dispose();
        this.stage.renderer.dispose();
      }
      // the kit's painted textures are shared with the painter's renderer and hold on to this one
      for (const t of [KIT?.strokeTex, KIT?.grassTex, ...Object.values(KIT?.leafTex ?? {})]) t?.dispose();
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
      lens: () => ({ k: this.lens, ...this.stage?.lens }),
      made: [...this.made.values()].map((B) => ({ id: B.id, kind: B.kind, s: B.s, ghost: B.ghost, box: [B.box.min.toArray(), B.box.max.toArray()] })),
      glError: () => gl.getError(),
      info: () => ({ ...this.stage.renderer.info.render, programs: this.stage.renderer.info.programs?.length, geometries: this.stage.renderer.info.memory.geometries }),
      // n frames of one kind, each ended by reading a pixel back so the GPU's work is counted ("tick": what moves only)
      time: (q, n = 3) => {
        const out = [];
        const info = this.stage.renderer.info;
        for (let i = 0; i < n; i++) {
          info.autoReset = false;
          info.reset();
          const t0 = performance.now();
          if (q === "tick") this.frame(performance.now());
          else this.draw(q);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          out.push(Math.round(performance.now() - t0));
          info.autoReset = true;
        }
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
