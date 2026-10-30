import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ClipboardList, MapPin, Maximize2, Minus, Plus, X } from "lucide-react";
import { centreOn, clampView, fitView, toBox, toPicture, zoomAt } from "../../lib/zoom";
import { drawStrokes } from "../../lib/sketch";
import "../../styles/photos.css";

// A photo or a sketch over the whole screen, to look at up close (Aaron,
// 2026-10-30: "allow me to zoom into and enlarge a sketch"). Pinch or
// spread two fingers, or a trackpad, or ctrl and the wheel, to zoom; drag
// or scroll to move about; tap twice to zoom in there (and again to see it
// all). A sketch is drawn afresh at every size, so it stays sharp however
// close.
//
// Pins (0096) sit on it where they were put, the same size at any zoom:
// tapping one hands its id to `onPin`. With `pinning` on, a tap on the
// picture hands where it was (0 to 1 across and down) to `onPlace`.
// `panel` shows beside it (below, on a phone): the open pin's note and
// tasks. `focus` ({ x, y }) opens it zoomed in on that point.
//
// With `side` (a name, "Clipboard"), a button shows or hides a box beside
// it too, under the pin's panel, that the page fills (`sideRef` hands over
// the box; Photos.jsx's PhotoSide puts the page's clipboard in it). Steps
// carried out of it onto the picture are pinned where they're let go: the
// picture's place on screen is kept in `.iv-page`, and `.iv-drop` shows
// where the pin would go (Photos.jsx reads and lights them).
//
//   <Viewer title src | sketch width height pins openPin pinning onPinning onPlace onPin tools panel focus side sideOn onSide sideRef onClose />

const DOUBLE_MS = 320;

export default function Viewer({ title, src, sketch, width, height, pins = [], openPin = null, pinning = false, onPinning, onPlace, onPin, tools, panel, focus = null, side = null, sideOn = false, onSide, sideRef, onClose }) {
  const stage = useRef(null);
  const canvas = useRef(null);
  const [box, setBox] = useState(null); // { w, h }
  const [natural, setNatural] = useState(() => (width && height ? { w: width, h: height } : sketch ? { w: sketch.width, h: sketch.height } : null));
  const [view, setView] = useState(null);
  const viewRef = useRef(null);
  viewRef.current = view;
  const latest = useRef({});
  latest.current = { onClose, onPin, onPlace, openPin, pinning };

  const W = natural?.w ?? 1;
  const H = natural?.h ?? 1;
  const fitIn = (b) => fitView(W, H, b.w, b.h, b.w < 600 ? 10 : 24);
  const fit = box && natural ? fitIn(box) : null;
  // A sketch is drawn afresh at any size; a photo only so far past its own
  // pixels before it blurs.
  const lo = fit ? fit.k * 0.75 : 1;
  const hi = fit ? (sketch ? fit.k * 10 : Math.max(fit.k * 2, 2)) : 1;
  const limits = useRef({});
  limits.current = { W, H, box, fit, lo, hi };

  const clamp = (v) => {
    const l = limits.current;
    return l.box ? clampView(v, l.W, l.H, l.box.w, l.box.h, l.lo, l.hi) : v;
  };
  const show = (v) => setView(clamp(v));

  // The box it's shown in, as it changes (a phone turned, the pin's panel opening).
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox((b) => (b && Math.abs(b.w - r.width) < 0.5 && Math.abs(b.h - r.height) < 0.5 ? b : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // First sight: all of it, or close in on `focus`. After that a change of
  // box keeps what's in the middle in the middle.
  const lastBox = useRef(null);
  useLayoutEffect(() => {
    if (!box || !natural || !fit) return;
    const was = lastBox.current;
    lastBox.current = box;
    if (!viewRef.current) {
      setView(focus ? clamp(centreOn(W, H, box.w, box.h, focus.x, focus.y, Math.min(hi, fit.k * 2.5))) : fit);
      return;
    }
    if (was && (was.w !== box.w || was.h !== box.h)) {
      const v = viewRef.current;
      const mid = { x: (was.w / 2 - v.x) / (W * v.k), y: (was.h / 2 - v.y) / (H * v.k) };
      const was1 = fitIn(was);
      setView(clamp(Math.abs(v.k - was1.k) <= was1.k * 0.01 ? fit : centreOn(W, H, box.w, box.h, mid.x, mid.y, v.k)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box, natural]);

  // A sketch, drawn for the view.
  useLayoutEffect(() => {
    const c = canvas.current;
    if (!sketch || !c || !box || !view) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const cw = Math.round(box.w * dpr);
    const ch = Math.round(box.h * dpr);
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
    }
    const ctx = c.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.x, dpr * view.y);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sketch.width, sketch.height);
    drawStrokes(ctx, sketch.strokes ?? [], 1.1 / view.k);
  }, [sketch, box, view]);

  // Fingers, a mouse or a pen on the picture.
  const ptrs = useRef(new Map());
  const gesture = useRef(null);
  const lastTap = useRef(null);
  const at = (e) => {
    const r = stage.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function down(e) {
    if (e.button !== undefined && e.button !== 0) return;
    stage.current.setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, at(e));
    const all = [...ptrs.current.values()];
    if (all.length === 1) gesture.current = { start: all[0], moved: false };
    else if (all.length === 2 && gesture.current) {
      gesture.current.moved = true;
      gesture.current.pinch = pinchOf(all);
    }
  }

  function move(e) {
    if (!ptrs.current.has(e.pointerId) || !viewRef.current) return;
    const prev = ptrs.current.get(e.pointerId);
    const now = at(e);
    ptrs.current.set(e.pointerId, now);
    const g = gesture.current;
    if (!g) return;
    const all = [...ptrs.current.values()];
    if (all.length >= 2 && g.pinch) {
      // spread about where the fingers were, then along with them
      const p = pinchOf(all);
      const was = g.pinch;
      const v = viewRef.current;
      const z = zoomAt(v, v.k * (p.d / Math.max(1, was.d)), was.x, was.y);
      g.pinch = p;
      show({ k: z.k, x: z.x + p.x - was.x, y: z.y + p.y - was.y });
      return;
    }
    if (!g.moved && Math.hypot(now.x - g.start.x, now.y - g.start.y) > 6) g.moved = true;
    if (g.moved) {
      const v = viewRef.current;
      show({ ...v, x: v.x + now.x - prev.x, y: v.y + now.y - prev.y });
    }
  }

  function up(e) {
    if (!ptrs.current.has(e.pointerId)) return;
    const where = at(e);
    ptrs.current.delete(e.pointerId);
    const g = gesture.current;
    if (ptrs.current.size === 1 && g) {
      // one finger left after a pinch: it goes on moving from where it is
      g.pinch = null;
      return;
    }
    if (ptrs.current.size > 0) return;
    gesture.current = null;
    if (!g || g.moved || e.type !== "pointerup") return;
    tap(where);
  }

  function tap(p) {
    const v = viewRef.current;
    if (!v) return;
    if (latest.current.pinning) {
      const spot = toPicture(v, W, H, p.x, p.y);
      if (spot) latest.current.onPlace?.(spot.x, spot.y);
      return;
    }
    const t = Date.now();
    const last = lastTap.current;
    if (last && t - last.t < DOUBLE_MS && Math.hypot(p.x - last.x, p.y - last.y) < 30) {
      lastTap.current = null;
      show(v.k > fit.k * 1.3 ? fit : zoomAt(v, fit.k * 2.5, p.x, p.y));
      return;
    }
    lastTap.current = { t, ...p };
  }

  // The wheel moves about; with ctrl (and a trackpad's pinch) it zooms.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const v = viewRef.current;
      if (!v) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        show(zoomAt(v, v.k * Math.exp(-e.deltaY * unit * 0.01), e.clientX - r.left, e.clientY - r.top));
      } else show({ ...v, x: v.x - e.deltaX * unit, y: v.y - e.deltaY * unit });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape puts the open pin down, then the viewer (and not the sheet under it).
  useEffect(() => {
    const onKey = (e) => {
      // (a sheet opened from the box beside it closes first)
      if (document.querySelector(".modal-backdrop, .confirm-sheet") || root.current?.querySelector(".sheet-backdrop")) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        if (latest.current.openPin) latest.current.onPin?.(null);
        else latest.current.onClose();
        return;
      }
      if (e.target?.closest?.("input, textarea, select, [contenteditable]")) return;
      const v = viewRef.current;
      if (!v || !limits.current.box) return;
      const mid = [limits.current.box.w / 2, limits.current.box.h / 2];
      if (e.key === "+" || e.key === "=") show(zoomAt(v, v.k * 1.4, ...mid));
      else if (e.key === "-") show(zoomAt(v, v.k / 1.4, ...mid));
      else if (e.key === "0") show(limits.current.fit);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const root = useRef(null);
  useEffect(() => {
    const back = document.activeElement;
    root.current?.focus({ preventScroll: true });
    return () => back?.isConnected && back.focus?.({ preventScroll: true });
  }, []);

  const zoomBy = (r) => {
    const v = viewRef.current;
    if (v && box) show(zoomAt(v, v.k * r, box.w / 2, box.h / 2));
  };
  const pct = view && fit ? Math.round((view.k / fit.k) * 100) : 100;

  return (
    <div className={"iv" + (panel ? " iv--panel" : "") + (side && sideOn ? " iv--side" : "")} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={root}>
      <div className="iv-bar">
        <button type="button" className="iv-btn" onClick={onClose} aria-label="Close" title="Close">
          <X size={18} />
        </button>
        <h2 className="iv-title">{title}</h2>
        <span className="spacer" />
        {tools}
        {side && (
          <button type="button" className={"iv-btn iv-btn--word iv-side-btn" + (sideOn ? " on" : "")} aria-pressed={sideOn} onClick={() => onSide?.(!sideOn)} title={sideOn ? `Hide the ${side.toLowerCase()}` : `Show the ${side.toLowerCase()} beside it`}>
            <ClipboardList size={16} aria-hidden="true" />
            <span>{side}</span>
          </button>
        )}
        {onPinning && (
          <button type="button" className={"iv-btn iv-btn--word" + (pinning ? " on" : "")} aria-pressed={pinning} onClick={() => onPinning(!pinning)}>
            <MapPin size={16} aria-hidden="true" />
            <span>{pinning ? "Done pinning" : "Add pin"}</span>
          </button>
        )}
        <div className="iv-zoom" role="group" aria-label="Zoom">
          <button type="button" className="iv-btn" onClick={() => zoomBy(1 / 1.5)} aria-label="Zoom out" title="Zoom out">
            <Minus size={16} />
          </button>
          <button type="button" className="iv-pct" onClick={() => fit && show(fit)} title="See it all">
            {pct}%
          </button>
          <button type="button" className="iv-btn" onClick={() => zoomBy(1.5)} aria-label="Zoom in" title="Zoom in">
            <Plus size={16} />
          </button>
          <button type="button" className="iv-btn iv-fit" onClick={() => fit && show(fit)} aria-label="See it all" title="See it all">
            <Maximize2 size={15} />
          </button>
        </div>
      </div>
      <div className="iv-body">
        <div
          className={"iv-stage" + (pinning ? " pinning" : "")}
          ref={stage}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onLostPointerCapture={up}
        >
          {sketch ? (
            <canvas ref={canvas} className="iv-canvas" role="img" aria-label={title} />
          ) : (
            src && (
              <img
                className="iv-img"
                src={src}
                alt={title}
                draggable={false}
                onLoad={(e) => !natural && setNatural({ w: e.currentTarget.naturalWidth || 1, h: e.currentTarget.naturalHeight || 1 })}
                style={view ? { width: W * view.k, height: H * view.k, transform: `translate3d(${view.x}px, ${view.y}px, 0)` } : { visibility: "hidden" }}
              />
            )
          )}
          {view && <span className="iv-page" aria-hidden="true" style={{ width: W * view.k, height: H * view.k, transform: `translate3d(${view.x}px, ${view.y}px, 0)` }} />}
          {view &&
            pins.map((p) => {
              const b = toBox(view, W, H, p.x, p.y);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={"iv-pin" + (p.id === openPin ? " open" : "") + (p.count ? " has" : "")}
                  data-pin={p.id}
                  style={{ transform: `translate3d(${b.x}px, ${b.y}px, 0)` }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onPin?.(p.id === openPin ? null : p.id)}
                  aria-label={`Pin ${p.n}${p.count ? `, ${p.count} task${p.count === 1 ? "" : "s"}` : ""}`}
                >
                  <span className="iv-pin__head">{p.n}</span>
                </button>
              );
            })}
          <span className="iv-drop drop-mark" aria-hidden="true">
            <span className="iv-pin__head">+</span>
          </span>
          {pinning && <p className="iv-hint">Tap where the pin goes</p>}
        </div>
        {(panel || (side && sideOn)) && (
          <aside className={"iv-panel" + (side && sideOn ? " iv-panel--side" : "")}>
            {panel}
            {side && sideOn && <div className="iv-side" ref={sideRef} />}
          </aside>
        )}
      </div>
    </div>
  );
}

function pinchOf([a, b]) {
  return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
