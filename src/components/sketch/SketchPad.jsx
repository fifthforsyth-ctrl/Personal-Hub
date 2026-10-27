import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eraser, Redo2, Sparkles, Trash2, Undo2, X } from "lucide-react";
import { INKS, WIDTHS, drawPieces, drawStrokes, erasedBy, fitPage, pageSize, pushPoint } from "../../lib/sketch";
import { useConfirm } from "../ui/Feedback";

// The sketch pad: the whole screen to draw on, with a pencil (pressure makes
// the line thinner or thicker) or a finger. Once a pencil has touched it,
// fingers and a resting palm don't draw. Inks, three widths, an eraser that
// takes off whole strokes, undo and redo. Done keeps it; Analyze keeps it
// and has it read.
//
// `sketch` is the one being drawn on again, or null for a new one; `about`
// is what it's on, shown at the top. `onSave({ width, height, strokes },
// analyze)` resolves once it's kept.

const MAX_UNDO = 100;
const ERASER = 12; // px on screen

// Once a pencil has drawn, a finger is a palm for as long as the app is open,
// on every sketch.
let penSeen = false;

export default function SketchPad({ sketch, about, onSave, onClose }) {
  const confirm = useConfirm();
  const area = useRef(null);
  const canvas = useRef(null);
  const [page, setPage] = useState(sketch ? { width: sketch.width, height: sketch.height } : null);
  const [hist, setHist] = useState({ list: [sketch?.strokes ?? []], at: 0 });
  const [ink, setInk] = useState(INKS[0].key);
  const [width, setWidth] = useState(WIDTHS[1].key);
  const [erasing, setErasing] = useState(false);
  const [busy, setBusy] = useState(false);
  const strokes = hist.list[hist.at];
  const view = useRef({ fit: null, dpr: 1, w: 0, h: 0 });
  const live = useRef(null);
  const shown = useRef(strokes); // what's on the canvas while erasing
  const confirming = useRef(false);
  const changed = hist.at > 0;
  // A new page that's still blank follows the screen as it turns.
  const blank = useRef(true);
  blank.current = !sketch && hist.list.length === 1;

  // Nothing behind it scrolls while it's open.
  useEffect(() => {
    document.documentElement.classList.add("sk-open");
    return () => document.documentElement.classList.remove("sk-open");
  }, []);

  // iPadOS takes a pencil held still, or pressed twice, as the start of a
  // text selection: a blue highlight comes up over the pad and the pencil
  // stops drawing (Aaron, 2026-10-27). Pointer events can't stop that; touch
  // events can, when they aren't passive. Only the drawing area eats its
  // touches, so the buttons still tap, and nothing anywhere starts a
  // selection while the pad is open.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const stop = (e) => e.cancelable && e.preventDefault();
    const touch = { passive: false };
    const kinds = ["touchstart", "touchmove", "touchend", "gesturestart"];
    for (const k of kinds) el.addEventListener(k, stop, touch);
    document.addEventListener("selectstart", stop);
    window.getSelection?.()?.removeAllRanges();
    return () => {
      for (const k of kinds) el.removeEventListener(k, stop, touch);
      document.removeEventListener("selectstart", stop);
    };
  }, []);

  const paint = useCallback(
    (list) => {
      const c = canvas.current;
      const v = view.current;
      if (!c || !v.fit || !page) return;
      const ctx = c.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      const { scale, x, y } = v.fit;
      ctx.setTransform(v.dpr * scale, 0, 0, v.dpr * scale, v.dpr * x, v.dpr * y);
      // The paper, with a faint grid of dots to draw against.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, page.width, page.height);
      ctx.fillStyle = "rgba(20, 20, 20, 0.13)";
      const gap = 24;
      const dot = 1.1 / scale;
      for (let gy = gap; gy < page.height; gy += gap) for (let gx = gap; gx < page.width; gx += gap) ctx.fillRect(gx - dot / 2, gy - dot / 2, dot, dot);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, page.width, page.height);
      ctx.clip();
      drawStrokes(ctx, list);
      ctx.restore();
      shown.current = list;
    },
    [page]
  );

  // The canvas fills the room it has, sharp on a retina screen; the page sits
  // in it as large as it fits. A new sketch's page is the room it first had.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const size = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      const fresh = pageSize(r.width, r.height);
      if (!page || (blank.current && !live.current && (fresh.width !== page.width || fresh.height !== page.height))) {
        setPage(fresh);
        if (page) return; // sized again with the new page
      }
      const pg = page ?? fresh;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const c = canvas.current;
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      c.style.width = `${r.width}px`;
      c.style.height = `${r.height}px`;
      view.current = { fit: fitPage(pg.width, pg.height, r.width, r.height, 12), dpr, w: r.width, h: r.height };
      if (page) paint(shown.current);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);
    return () => ro.disconnect();
  }, [page, paint]);

  useEffect(() => {
    if (!live.current) paint(strokes);
  }, [strokes, paint]);

  const commit = (next) => setHist((h) => ({ list: [...h.list.slice(Math.max(0, h.at + 1 - MAX_UNDO), h.at + 1), next], at: Math.min(h.at + 1, MAX_UNDO) }));
  const undo = () => setHist((h) => (h.at > 0 ? { ...h, at: h.at - 1 } : h));
  const redo = () => setHist((h) => (h.at < h.list.length - 1 ? { ...h, at: h.at + 1 } : h));

  // Where a pointer is on the page, in the page's units (kept on the page).
  function toPage(e) {
    const r = canvas.current.getBoundingClientRect();
    const { scale, x, y } = view.current.fit;
    return {
      x: Math.max(0, Math.min(page.width, (e.clientX - r.left - x) / scale)),
      y: Math.max(0, Math.min(page.height, (e.clientY - r.top - y) / scale)),
    };
  }
  const pressureOf = (e) => (e.pointerType === "pen" ? (e.pressure > 0 ? e.pressure : 0.5) : 0.5);

  function ctxOnPage() {
    const ctx = canvas.current.getContext("2d");
    const v = view.current;
    ctx.setTransform(v.dpr * v.fit.scale, 0, 0, v.dpr * v.fit.scale, v.dpr * v.fit.x, v.dpr * v.fit.y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  }

  function down(e) {
    if (!page || !view.current.fit) return;
    if (e.pointerType === "pen") {
      penSeen = true;
      // A palm that touched down first was drawing; the pencil takes over.
      if (live.current && live.current.type !== "pen") {
        live.current = null;
        paint(strokes);
      }
    } else if (e.pointerType === "touch" && penSeen) return; // a palm on the glass
    if (live.current || e.button > 0) return;
    e.preventDefault();
    canvas.current.setPointerCapture?.(e.pointerId);
    const at = toPage(e);
    if (erasing) {
      const gone = erasedBy(strokes, at.x, at.y, at.x, at.y, ERASER / view.current.fit.scale);
      live.current = { id: e.pointerId, type: e.pointerType, erase: true, x: at.x, y: at.y, gone };
      if (gone.size) paint(strokes.filter((s) => !gone.has(s)));
      return;
    }
    const stroke = { c: ink, w: width, p: [] };
    pushPoint(stroke.p, at.x, at.y, pressureOf(e));
    live.current = { id: e.pointerId, type: e.pointerType, stroke, drawn: 0 };
  }

  function move(e) {
    const d = live.current;
    if (!d || e.pointerId !== d.id) return;
    e.preventDefault();
    // A pencil reports far more often than the screen draws; take them all.
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    const all = events.length ? events : [e];
    if (d.erase) {
      const r = ERASER / view.current.fit.scale;
      let more = false;
      for (const ev of all) {
        const at = toPage(ev);
        for (const s of erasedBy(strokes, d.x, d.y, at.x, at.y, r)) {
          if (!d.gone.has(s)) {
            d.gone.add(s);
            more = true;
          }
        }
        d.x = at.x;
        d.y = at.y;
      }
      if (more) paint(strokes.filter((s) => !d.gone.has(s)));
      return;
    }
    for (const ev of all) {
      const at = toPage(ev);
      pushPoint(d.stroke.p, at.x, at.y, pressureOf(ev), 0.75 / view.current.fit.scale);
    }
    const n = d.stroke.p.length / 3;
    if (n - 2 > d.drawn) {
      drawPieces(ctxOnPage(), d.stroke, d.drawn + 1, n - 2, false);
      d.drawn = n - 2;
    }
  }

  function up(e, keep = true) {
    const d = live.current;
    if (!d || e.pointerId !== d.id) return;
    live.current = null;
    if (d.erase) {
      if (keep && d.gone.size) commit(strokes.filter((s) => !d.gone.has(s)));
      else paint(strokes);
      return;
    }
    if (!keep) {
      paint(strokes);
      return;
    }
    // A lifting pencil reads no pressure; its line ends as it was going.
    const at = toPage(e);
    const p = d.stroke.p;
    pushPoint(p, at.x, at.y, d.type === "pen" ? p[p.length - 1] / 100 : pressureOf(e), 0, true);
    drawPieces(ctxOnPage(), d.stroke, d.drawn + 1, d.stroke.p.length / 3, true);
    commit([...strokes, d.stroke]);
  }

  async function close() {
    if (busy) return;
    if (confirming.current) return;
    if (changed) {
      confirming.current = true;
      const ok = await confirm({ title: sketch ? "Leave without keeping these changes?" : "Throw this sketch away?", confirmLabel: sketch ? "Leave" : "Throw away" });
      confirming.current = false;
      if (!ok) return;
    }
    onClose();
  }

  async function save(analyze) {
    if (busy || !strokes.length || !page) return;
    setBusy(true);
    // Opened to draw on and left as it was: nothing new to keep.
    const ok = await onSave(sketch && !changed ? null : { width: page.width, height: page.height, strokes }, analyze);
    if (!ok) setBusy(false);
  }

  // Escape closes; ⌘Z / ⌘⇧Z undo and redo.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (!confirming.current) close();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return createPortal(
    <div className="sk-pad" role="dialog" aria-modal="true" aria-label="Sketch">
      <div className="sk-bar">
        <button type="button" className="sk-icon" onClick={close} aria-label="Close" title="Close">
          <X size={19} />
        </button>
        <div className="sk-bar__about">
          <span className="eyebrow">{sketch ? "Sketch" : "New sketch"}</span>
          {about && <b>{about}</b>}
        </div>
        <button type="button" className="btn btn--sm" onClick={() => save(false)} disabled={busy || !strokes.length}>
          Done
        </button>
        <button type="button" className="btn btn--sm btn--accent" onClick={() => save(true)} disabled={busy || !strokes.length}>
          <Sparkles size={14} />
          Analyze
        </button>
      </div>
      <div className="sk-tools" role="toolbar" aria-label="Pen">
        <div className="sk-group" role="radiogroup" aria-label="Ink">
          {INKS.map((k) => (
            <button
              key={k.key}
              type="button"
              role="radio"
              aria-checked={!erasing && ink === k.key}
              className={"sk-ink" + (!erasing && ink === k.key ? " on" : "")}
              style={{ "--pen": k.key }}
              title={k.label}
              aria-label={k.label}
              onClick={() => {
                setInk(k.key);
                setErasing(false);
              }}
            />
          ))}
        </div>
        <div className="sk-group" role="radiogroup" aria-label="Width">
          {WIDTHS.map((w) => (
            <button
              key={w.key}
              type="button"
              role="radio"
              aria-checked={!erasing && width === w.key}
              className={"sk-width" + (!erasing && width === w.key ? " on" : "")}
              title={w.label}
              aria-label={w.label}
              onClick={() => {
                setWidth(w.key);
                setErasing(false);
              }}
            >
              <i style={{ width: `${Math.max(3, w.key * 1.4)}px`, height: `${Math.max(3, w.key * 1.4)}px`, background: ink }} />
            </button>
          ))}
        </div>
        <button type="button" className={"sk-icon" + (erasing ? " on" : "")} aria-pressed={erasing} onClick={() => setErasing((v) => !v)} aria-label="Eraser" title="Eraser: takes off whole strokes">
          <Eraser size={18} />
        </button>
        <span className="sk-sep" aria-hidden="true" />
        <button type="button" className="sk-icon" onClick={undo} disabled={hist.at === 0} aria-label="Undo" title="Undo">
          <Undo2 size={18} />
        </button>
        <button type="button" className="sk-icon" onClick={redo} disabled={hist.at >= hist.list.length - 1} aria-label="Redo" title="Redo">
          <Redo2 size={18} />
        </button>
        <button type="button" className="sk-icon" onClick={() => strokes.length && commit([])} disabled={!strokes.length} aria-label="Clear the page" title="Clear the page">
          <Trash2 size={17} />
        </button>
      </div>
      <div className="sk-area" ref={area}>
        <canvas
          ref={canvas}
          className={"sk-canvas" + (erasing ? " erasing" : "")}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={(e) => up(e, true)}
          onPointerCancel={(e) => up(e, false)}
          onContextMenu={(e) => e.preventDefault()}
        />
        {busy && <div className="sk-saving">Keeping it…</div>}
      </div>
    </div>,
    document.body
  );
}
