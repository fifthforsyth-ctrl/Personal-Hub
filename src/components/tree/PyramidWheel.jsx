import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus, Minus } from "lucide-react";
import {
  computeWheel,
  wedgeOutline,
  labelOrientations,
  layoutLabels,
  isCurvedLabel,
  minLabelSpan,
  LABEL_MIN_PX,
  CENTER_RADIUS,
  RING_THICKNESS,
} from "../../lib/wheel";
import { getWedgeVisual, HOVER_COLOR, FOCUS_COLOR } from "../../lib/nodeStyle";
import WedgeLabel from "./WedgeLabel";
import "../../styles/goals.css";

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;
const FIT_SHARE = 0.47; // the framed wheel's radius, as a share of the shorter side
const TAP_SLOP = 4; // px a press can wander and still be a tap rather than a pan
const HOVER_TRANSITION = "d 130ms ease-out";

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// A hand-rolled pan/zoom SVG sunburst — deliberately not React Flow, since
// wedges are geometric arcs (sized purely by ring + angle), not measured
// rectangular cards, and clicking one just selects it rather than dragging it.
// `wheel` ({layout, maxRing, hasVirtualHub}) is the BASE (non-hover) layout
// from lib/wheel's computeWheel, computed once by the page and shared with
// the detail panel. This component derives its own hover-adjusted layout
// from `edges` on top of that whenever something's hovered.
//
// One finger or the mouse pans, two fingers pinch, the mouse wheel zooms.
// `controls` adds + / − / Fit buttons; `selectedId` rims the goal whose
// panel is open; `reserveRight` is how much of the right edge that panel
// covers, so the wheel slides over to stay in sight beside it.
export default function PyramidWheel({
  nodes,
  edges,
  wheel,
  brightnessById,
  centerNodeId,
  onSelectNode,
  selectedId = null,
  controls = false,
  reserveRight = 0,
}) {
  const uid = useId().replace(/:/g, "");
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const titleById = useMemo(() => new Map(nodes.map((n) => [n.id, n.title])), [nodes]);
  const totalRadius = CENTER_RADIUS + wheel.maxRing * RING_THICKNESS + 60;

  const wrapRef = useRef(null);
  // `glide` animates the moves the app makes (fit, the zoom buttons); the
  // ones your fingers or mouse make follow them directly.
  const [view, setView] = useState({ x: 0, y: 0, scale: 1, glide: false });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [dragging, setDragging] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const userMoved = useRef(false); // once you've panned or zoomed, a resize leaves the view alone
  const fitted = useRef(false);
  const reserveRef = useRef(reserveRight);
  reserveRef.current = reserveRight;

  // Which way each sibling group's titles run, decided on the resting
  // layout so a hover never flips them.
  const orientations = useMemo(() => labelOrientations(wheel.layout, titleById, view.scale), [wheel.layout, titleById, view.scale]);

  // How wide a hovered wedge needs to be to show a few letters of its title
  // at the smallest size allowed on screen. Radial titles run along the
  // ring's thickness, so they only need the angle for one line's height.
  const minAngleFn = useCallback(
    (id) => {
      const pos = wheel.layout.get(id);
      if (!pos) return 0;
      const font = Math.max(10, LABEL_MIN_PX / view.scale);
      return minLabelSpan(titleById.get(id), pos.ringIndex, font, isCurvedLabel(orientations, pos));
    },
    [wheel.layout, titleById, view.scale, orientations]
  );

  // Hover-adjusted layout: the hovered wedge grows, its siblings shrink to
  // compensate (same total span), cascading to their descendants too since
  // it's computed via the same recursive placement. Falls back to the base
  // layout untouched when nothing's hovered.
  const displayLayout = useMemo(() => {
    if (!hoveredId) return wheel.layout;
    return computeWheel(nodes, edges, centerNodeId, { hoveredId, growFactor: 1.025, minAngleFn }).layout;
  }, [hoveredId, nodes, edges, centerNodeId, wheel.layout, minAngleFn]);

  const labels = useMemo(
    () => layoutLabels(displayLayout, titleById, view.scale, { orientations }),
    [displayLayout, titleById, view.scale, orientations]
  );

  // Frame the whole wheel in view, beside the open panel when it sits next
  // to the wheel rather than over it (wider screens; see goals.css).
  const fit = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap || !wrap.clientWidth || !wrap.clientHeight) return;
    userMoved.current = false;
    const reserve = reserveRef.current && window.matchMedia?.("(min-width: 901px)").matches ? reserveRef.current : 0;
    const width = wrap.clientWidth - reserve;
    const scale = Math.min(1, (Math.min(width, wrap.clientHeight) * FIT_SHARE) / totalRadius);
    setView({ x: width / 2, y: wrap.clientHeight / 2, scale, glide: fitted.current });
    fitted.current = true;
  }, [totalRadius]);

  // On load and whenever the wheel is re-centered.
  useEffect(() => {
    fit();
  }, [fit, centerNodeId]);

  // When a panel opens or closes, unless you've moved the wheel yourself.
  useEffect(() => {
    if (!userMoved.current) fit();
  }, [fit, reserveRight]);

  // And when the space changes size (a phone turned sideways, the header
  // wrapping), unless you've already moved the wheel yourself.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => {
      if (!userMoved.current) fit();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [fit]);

  // Pointer gestures. Every pointer down on the wheel is tracked until it
  // lifts; one is a pan, two are a pinch around their midpoint. Moves are
  // read on the window so a drag that leaves the wheel still ends cleanly.
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const moved = useRef(false);

  const localPoint = useCallback((clientX, clientY) => {
    const rect = wrapRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const beginGesture = useCallback(() => {
    const pts = [...pointers.current.values()];
    const v = viewRef.current;
    if (pts.length === 1) {
      gesture.current = { kind: "pan", x: pts[0].x, y: pts[0].y, view: v };
    } else if (pts.length >= 2) {
      const [a, b] = pts;
      gesture.current = { kind: "pinch", dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: localPoint((a.x + b.x) / 2, (a.y + b.y) / 2), view: v };
    } else {
      gesture.current = null;
    }
  }, [localPoint]);

  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest?.(".wheel-controls")) return;
    if (pointers.current.size === 0) moved.current = false;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    beginGesture();
  }

  useEffect(() => {
    function onMove(e) {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gesture.current;
      if (!g) return;
      if (g.kind === "pan") {
        const dx = e.clientX - g.x;
        const dy = e.clientY - g.y;
        if (!moved.current && Math.hypot(dx, dy) < TAP_SLOP) return;
        if (!moved.current) {
          moved.current = true;
          setDragging(true);
        }
        userMoved.current = true;
        setView({ ...g.view, x: g.view.x + dx, y: g.view.y + dy, glide: false });
        return;
      }
      const [a, b] = [...pointers.current.values()];
      if (!b) return;
      moved.current = true;
      userMoved.current = true;
      setDragging(true);
      const mid = localPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
      const scale = clamp(g.view.scale * ((Math.hypot(a.x - b.x, a.y - b.y) || 1) / g.dist), MIN_ZOOM, MAX_ZOOM);
      // The point under the fingers when the pinch began stays under them.
      const wx = (g.mid.x - g.view.x) / g.view.scale;
      const wy = (g.mid.y - g.view.y) / g.view.scale;
      setView({ scale, x: mid.x - wx * scale, y: mid.y - wy * scale, glide: false });
    }
    function onUp(e) {
      if (!pointers.current.delete(e.pointerId)) return;
      // A pinch that loses a finger carries on as a pan from where it is.
      beginGesture();
      if (pointers.current.size === 0) setDragging(false);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [beginGesture, localPoint]);

  // React's JSX onWheel is always registered passive for this event type, so
  // e.preventDefault() inside it is silently ignored (and logs a warning) —
  // the page would scroll natively underneath our own zoom. A manually
  // attached, non-passive listener is the only way to actually claim it.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    function onWheel(e) {
      e.preventDefault();
      userMoved.current = true;
      const { x: mouseX, y: mouseY } = localPoint(e.clientX, e.clientY);
      setView((v) => {
        const nextScale = clamp(v.scale * Math.exp(-e.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM);
        const worldX = (mouseX - v.x) / v.scale;
        const worldY = (mouseY - v.y) / v.scale;
        return { scale: nextScale, x: mouseX - worldX * nextScale, y: mouseY - worldY * nextScale, glide: false };
      });
    }
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, [localPoint]);

  function zoomBy(factor) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const cx = wrap.clientWidth / 2;
    const cy = wrap.clientHeight / 2;
    userMoved.current = true;
    setView((v) => {
      const scale = clamp(v.scale * factor, MIN_ZOOM, MAX_ZOOM);
      const wx = (cx - v.x) / v.scale;
      const wy = (cy - v.y) / v.scale;
      return { scale, x: cx - wx * scale, y: cy - wy * scale, glide: true };
    });
  }

  function handleWedgeClick(id) {
    if (moved.current) return; // that was a pan, not a tap
    onSelectNode(id);
  }

  // Hover only means something with a mouse; a finger's "hover" would stick
  // after the tap and reshape the wheel under it.
  const hoverIn = (id) => (e) => e.pointerType === "mouse" && setHoveredId(id);
  const hoverOut = (id) => (e) => e.pointerType === "mouse" && setHoveredId((cur) => (cur === id ? null : cur));

  const rim = (id, stroke, width, opacity = 1) => {
    const pos = displayLayout.get(id);
    if (!pos) return null;
    const shape = wedgeOutline(pos.ringIndex, pos.angleStart, pos.angleEnd);
    return (
      <path
        key={`${id}-${stroke}`}
        d={shape.d}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeOpacity={opacity}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ transition: HOVER_TRANSITION, pointerEvents: "none" }}
      />
    );
  };

  return (
    <div
      ref={wrapRef}
      className="wheel-pan"
      onPointerDown={onPointerDown}
      style={{ cursor: dragging ? "grabbing" : "grab" }}
    >
      <svg
        width={totalRadius * 2}
        height={totalRadius * 2}
        viewBox={`${-totalRadius} ${-totalRadius} ${totalRadius * 2} ${totalRadius * 2}`}
        style={{
          display: "block",
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale}) translate(${-totalRadius}px, ${-totalRadius}px)`,
          transformOrigin: "0 0",
          transition: view.glide ? "transform 280ms cubic-bezier(0.2, 0.7, 0.2, 1)" : "none",
        }}
      >
        {wheel.hasVirtualHub && <circle r={CENTER_RADIUS} fill="var(--surface)" stroke="#ffffff" strokeWidth={2.5} />}

        {[...displayLayout.entries()].map(([id, pos]) => {
          const node = nodeById.get(id);
          if (!node) return null;
          const visual = getWedgeVisual(pos.ringIndex, brightnessById.get(id) ?? 0);
          const shape = wedgeOutline(pos.ringIndex, pos.angleStart, pos.angleEnd);
          return (
            <g key={id} className="wheel-wedge" onClick={() => handleWedgeClick(id)} onPointerEnter={hoverIn(id)} onPointerLeave={hoverOut(id)}>
              <title>{node.title}</title>
              <path
                d={shape.d}
                fillRule={shape.fillRule}
                fill={visual.fill}
                stroke={visual.stroke}
                strokeWidth={visual.strokeWidth}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ transition: HOVER_TRANSITION }}
              />
              <WedgeLabel id={`${uid}-${id}`} label={labels.get(id)} color={visual.labelColor} />
            </g>
          );
        })}

        {/* Rims go in their own passes, after every wedge, so a later-drawn
            neighbor sharing an edge never paints over part of one: focus
            (orange), then the open goal (ink), then the hovered one. */}
        {[...displayLayout.keys()].filter((id) => nodeById.get(id)?.is_focused).map((id) => rim(id, FOCUS_COLOR, 3))}
        {selectedId && displayLayout.has(selectedId) && rim(selectedId, HOVER_COLOR, 3.5)}
        {hoveredId && !dragging && hoveredId !== selectedId && rim(hoveredId, HOVER_COLOR, 2.5, 0.9)}
      </svg>

      {controls && (
        <div className="wheel-controls" role="group" aria-label="Zoom">
          <button type="button" className="btn-icon btn-icon--bordered" onClick={() => zoomBy(1.3)} aria-label="Zoom in" title="Zoom in">
            <Plus size={16} />
          </button>
          <button type="button" className="btn-icon btn-icon--bordered" onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out" title="Zoom out">
            <Minus size={16} />
          </button>
          <button type="button" className="btn btn--sm wheel-controls__fit" onClick={fit} title="Fit the whole wheel on screen">
            Fit
          </button>
        </div>
      )}
    </div>
  );
}
