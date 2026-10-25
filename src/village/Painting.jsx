import { useEffect, useRef, useState } from "react";
import { villagePic } from "./pictures.js";
import "../styles/village.css";

// A build as a painting, for the village page and the build floating over
// the quests. Its finished picture (public/village/builds/) shows at once;
// with `live`, the painter (./paint.js) paints it as it stands now, with
// today's pieces in orange and what's still to come in pencil, and that
// picture fades in over the first once it's ready.
//
//   <Painting slot="village:now" kind="windmill" done={20} need={45} laid={3} live />
//
// `slot` names the picture to the painter, which keeps one per slot. The
// last one painted for each slot is remembered here too, so coming back to
// a page shows it straight away instead of painting it again; a new stage
// (a task ticked) paints over it. Until the live picture is there, a small
// note says what the finished one is: "Painting…", or, for a build still
// going up (`stands` false) that can't be painted (no WebGL), "When it
// stands". `lazy` waits until it is scrolled near, `idle` until the page
// has settled, and both until he has left the page alone for a moment, so
// the painter (three.js, then a second or two of the main thread to make
// the build) never holds up the page or a tap. The last picture of each
// slot is kept on the phone too, so opening the app again shows it at once
// without making the build, while nothing in it has changed. `keep={false}`
// asks the painter not to keep this build made (a build that stands), so it
// never costs the build going up its next tick.
//
// The picture is sized to its box: `aspect` (4:3 by default, like the
// pictures) or "fit" for the box's own shape.

// paint.js's thumbOf, kept here so the picture shows before the painter (and three.js) has loaded
const thumbOf = (kind) => villagePic(`builds/${kind}.jpg`);
// the kit's fingerprint (vite.config.js), so a picture kept on the phone is painted again once the kit changes
const KIT_V = typeof __KIT_VERSION__ !== "undefined" ? __KIT_VERSION__ : "dev";

let painter = null;
const loadPainter = () => {
  if (!painter) {
    painter = import("./paint").catch((err) => {
      painter = null;
      throw err;
    });
  }
  return painter;
};
// false once WebGL is known not to start
let glOk = null;

const painted = new Map();
// pictures read back from the phone's store, ours to let go of once painted over
const restored = new Map();
// widths the painter is asked for, so the same build in two places of about the same size is one painting
const WIDTHS = [720, 960, 1200];

function widthFor(cssWidth) {
  const want = cssWidth * Math.min(window.devicePixelRatio || 1, 3) * 0.85;
  return WIDTHS.find((w) => w >= want) ?? WIDTHS[WIDTHS.length - 1];
}

// When he last touched the page, so a painting that waits for the page can
// wait until he has left it alone for a moment.
let touched = 0;
const QUIET_MS = 1500;
if (typeof window !== "undefined") {
  for (const type of ["pointerdown", "keydown", "wheel"]) window.addEventListener(type, () => (touched = performance.now()), { capture: true, passive: true });
}

// The last picture of each slot, kept on the phone (Cache Storage) with the
// key it was painted for. Never fetched: the address only names it.
const STORE = "village-painted";
const storeUrl = (slot) => `/__painted/${encodeURIComponent(slot)}`;

async function restore(slot, key) {
  try {
    const res = await (await window.caches.open(STORE)).match(storeUrl(slot));
    if (!res || res.headers.get("x-painting") !== encodeURIComponent(key)) return null;
    return URL.createObjectURL(await res.blob());
  } catch {
    // no store here (a private window, an old phone): it's painted instead
    return null;
  }
}

async function keepOnPhone(slot, key, url) {
  try {
    const blob = await (await fetch(url)).blob();
    const headers = { "content-type": "image/jpeg", "x-painting": encodeURIComponent(key) };
    await (await window.caches.open(STORE)).put(storeUrl(slot), new Response(blob, { headers }));
  } catch {
    // kept for this visit only
  }
}

export default function Painting({ slot, kind, done = 0, need = 1, laid = 0, live = false, keep = true, stands = false, lazy = false, idle = false, aspect = 4 / 3, alt = "", className = "" }) {
  const box = useRef(null);
  const [size, setSize] = useState(null);
  const [near, setNear] = useState(!lazy);
  const [gl, setGl] = useState(glOk);
  // Painted pictures of this build, newest last, each shown once it has loaded.
  const [pics, setPics] = useState(() => {
    const m = painted.get(slot);
    return m && m.kind === kind ? [{ url: m.url, on: true }] : [];
  });
  const [busy, setBusy] = useState(false);
  // a build from before the painted catalog has no picture
  const [missing, setMissing] = useState(false);
  const [forKind, setForKind] = useState(kind);
  if (forKind !== kind) {
    setForKind(kind);
    setPics([]);
    setMissing(false);
  }

  const paints = live && gl !== false;
  const w = size ? widthFor(size.w) : 0;
  const ratio = aspect === "fit" ? (size ? size.ratio : 0) : aspect;
  const h = ratio ? Math.round(w / ratio) : 0;
  const key = JSON.stringify([KIT_V, kind, done, need, laid, w, h]);

  // How big it shows, to the nearest 40px, and its shape from the box as it
  // is (rounding both sides would make a tall box square).
  useEffect(() => {
    const el = box.current;
    if (!el || !paints) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      const next = { w: Math.round(r.width / 40) * 40 || 40, h: Math.round(r.height / 40) * 40 || 40, ratio: Math.round((r.width / r.height) * 20) / 20 };
      setSize((s) => (s && s.w === next.w && s.h === next.h && s.ratio === next.ratio ? s : next));
    };
    measure();
    if (!window.ResizeObserver) return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [paints]);

  // Scrolled near enough to be worth painting.
  useEffect(() => {
    const el = box.current;
    if (near || !el || !paints) return undefined;
    if (!window.IntersectionObserver) {
      setNear(true);
      return undefined;
    }
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "240px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near, paints]);

  useEffect(() => {
    if (!paints || !near || !w || !h) return undefined;
    const m = painted.get(slot);
    if (m && m.key === key) {
      setPics((p) => (p.length && p[p.length - 1].url === m.url ? p : [...p.slice(-1), { url: m.url, on: true }]));
      setBusy(false);
      return undefined;
    }
    let dead = false;
    let idleId = null;
    let t = null;
    const ac = new AbortController();
    // "Painting…" from now, while it waits its turn too.
    setBusy(true);
    const go = async () => {
      try {
        const { canPaint, paintBuild } = await loadPainter();
        if (dead) return;
        glOk = canPaint();
        if (!glOk) {
          setGl(false);
          return;
        }
        const url = await paintBuild({ kind, done, need, laid, width: w, height: h, slot, signal: ac.signal, keep });
        painted.set(slot, { key, kind, url });
        const was = restored.get(slot);
        if (was) {
          restored.delete(slot);
          setTimeout(() => URL.revokeObjectURL(was), 2000);
        }
        keepOnPhone(slot, key, url);
        if (!dead) setPics((p) => [...p.slice(-1), { url, on: false }]);
      } catch (err) {
        if (err?.name !== "AbortError") console.warn(`The ${kind} couldn't be painted`, err);
      } finally {
        if (!dead) setBusy(false);
      }
    };
    // Once he has left the page alone for a moment, and it's idle.
    const start = () => {
      const wait = idle || lazy ? touched + QUIET_MS - performance.now() : 0;
      if (wait > 0) t = setTimeout(start, wait);
      else if (idle && window.requestIdleCallback) idleId = window.requestIdleCallback(go, { timeout: 1500 });
      else go();
    };
    // A tick paints a new stage over the last one; a few in a row paint once.
    const later = () => (t = setTimeout(start, m ? 250 : idle ? 300 : 0));
    if (m) later();
    else {
      // The first time this visit: the picture kept on the phone, if nothing in it has changed.
      restore(slot, key).then((url) => {
        if (dead) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (!url) return later();
        painted.set(slot, { key, kind, url });
        restored.set(slot, url);
        setPics((p) => [...p.slice(-1), { url, on: false }]);
        setBusy(false);
      });
    }
    return () => {
      dead = true;
      clearTimeout(t);
      if (idleId !== null) window.cancelIdleCallback?.(idleId);
      ac.abort();
    };
    // `key` stands for the kit, kind, done, need, laid and the size
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paints, near, key, slot, idle, lazy, keep]);

  // Once the newest has faded in, the ones under it go.
  const top = pics[pics.length - 1];
  useEffect(() => {
    if (!top?.on || pics.length < 2) return undefined;
    const t = setTimeout(() => setPics((p) => p.slice(-1)), 400);
    return () => clearTimeout(t);
  }, [top, pics.length]);

  const shown = pics.some((p) => p.on);
  const note = shown ? null : paints && (busy || !near || !size) ? "Painting…" : stands ? null : "When it stands";
  return (
    <div
      ref={box}
      className={`painting${shown ? " painting--live" : ""}${!shown && !stands ? " painting--veiled" : ""} ${className}`}
      style={aspect === "fit" ? undefined : { aspectRatio: String(aspect) }}
    >
      {!missing && (
        <img
          className="painting__thumb"
          src={thumbOf(kind)}
          alt={shown ? "" : alt}
          width="720"
          height="540"
          loading={lazy ? "lazy" : "eager"}
          decoding="async"
          onError={() => setMissing(true)}
        />
      )}
      {pics.map((p) => (
        <img
          key={p.url}
          className={`painting__live${p.on ? " on" : ""}`}
          src={p.url}
          alt={p === top ? alt : ""}
          decoding="async"
          onLoad={() => setPics((list) => list.map((x) => (x.url === p.url ? { ...x, on: true } : x)))}
        />
      ))}
      {note && <span className="painting__note">{note}</span>}
    </div>
  );
}
