import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { computeWheel, wedgeOutline, layoutLabels, ringRadii, CENTER_RADIUS } from "../../lib/wheel";
import { getWedgeVisual, FOCUS_COLOR, HOVER_COLOR } from "../../lib/nodeStyle";
import WedgeLabel from "./WedgeLabel";
import "../../styles/goals.css";

const MAX_SCALE = 2.6;
const MIN_FACING_SPAN = (34 * Math.PI) / 180; // narrowest the section facing up is ever drawn
const HUB_HIDDEN = 0.75; // share of the center disc kept below the bottom edge
const TOP_ROOM = 26; // wheel units above the outermost ring, for its titles
const SIDE_PAD = 8; // px kept clear at each side
const SWIPE_PX = 45; // a swipe this long turns one section even if it doesn't drag halfway
const TAP_SLOP = 6; // below this, a press is a tap, not a swipe
const TURN_MS = 320;

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// The phone's wheel: instead of a pan/zoomable full circle, the wheel's
// center sits at the bottom of the screen, so only its upper half shows —
// like a dial. A swipe (or ‹ ›) turns the dial to bring the next section
// up. The whole tree from the current center out is always drawn, so the
// neighbors are really there at the sides, turning around the same center.
//
// The section facing up is drawn narrower than its share of the circle so
// it can be drawn tall: a quarter of a wheel is much wider than it is high,
// and drawn to fit a phone's width it would use half the screen's height.
// Narrowed to what the screen's shape allows, it fills the height, and its
// rings and titles come out about twice the size. Turning hands that room
// on to the next section as it comes up.
//
// "The current center" is the hub over the top-level goals (or a lone
// top-level goal). `centerOverrideId` (the panel's "Center the wheel here")
// moves it to one goal, and the same dial turns through that goal's own
// sub-goals instead.
export default function SectionWheel({ nodes, edges, brightnessById, onSelectNode, onActiveSectionChange, centerOverrideId = null, selectedId = null }) {
  const uid = useId().replace(/:/g, "");
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const titleById = useMemo(() => new Map(nodes.map((n) => [n.id, n.title])), [nodes]);

  const overridden = Boolean(centerOverrideId && nodeById.has(centerOverrideId));
  const centerId = overridden ? centerOverrideId : null;
  const base = useMemo(() => computeWheel(nodes, edges, centerId), [nodes, edges, centerId]);

  // What turns: the goals placed straight around the center — the top-level
  // goals under the hub, or the sub-goals of whichever goal sits in the
  // middle (a chosen one, or a lone top-level goal).
  const pivotId = useMemo(() => {
    if (centerId) return centerId;
    if (base.hasVirtualHub) return null;
    for (const [id, pos] of base.layout) if (pos.ringIndex === 0) return id;
    return null;
  }, [base, centerId]);

  const sections = useMemo(() => {
    const entries = [...base.layout.entries()].filter(([id, pos]) => (pos.parentId ?? null) === pivotId && id !== pivotId);
    entries.sort((a, b) => a[1].angleStart - b[1].angleStart);
    return entries.map(([id, pos]) => ({ id, span: pos.angleEnd - pos.angleStart }));
  }, [base.layout, pivotId]);

  // How far out each section's goals reach, so a shallow one can be drawn bigger.
  const deepestRing = useMemo(() => {
    const deepest = new Map();
    for (const [id, pos] of base.layout) {
      let cur = id;
      let at = pos;
      while (at && (at.parentId ?? null) !== pivotId) {
        cur = at.parentId;
        at = cur ? base.layout.get(cur) : null;
      }
      if (at && cur !== pivotId) deepest.set(cur, Math.max(deepest.get(cur) ?? 0, pos.ringIndex));
    }
    return deepest;
  }, [base.layout, pivotId]);

  const count = sections.length;
  const [activeIndex, setActiveIndex] = useState(0);
  // The position drawn: activeIndex at rest, fractional while turning or dragging.
  const [turn, setTurn] = useState(0);
  const turnRef = useRef(0);
  turnRef.current = turn;
  const [dragging, setDragging] = useState(false);
  const animRef = useRef(0);

  const animateTo = useCallback((target) => {
    cancelAnimationFrame(animRef.current);
    const from = turnRef.current;
    if (from === target) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setTurn(target);
      return;
    }
    const startedAt = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - startedAt) / TURN_MS);
      setTurn(from + (target - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  const goTo = useCallback(
    (index) => {
      const next = clamp(index, 0, Math.max(0, count - 1));
      setActiveIndex(next);
      animateTo(next);
    },
    [count, animateTo]
  );

  // A different center means a different set of sections entirely.
  useEffect(() => {
    cancelAnimationFrame(animRef.current);
    setActiveIndex(0);
    setTurn(0);
  }, [centerId]);

  // If a goal is added or removed and the index no longer points at
  // anything, settle on the last section.
  useEffect(() => {
    if (count > 0 && activeIndex > count - 1) goTo(count - 1);
  }, [count, activeIndex, goTo]);

  useEffect(() => {
    onActiveSectionChange?.(sections[activeIndex]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, activeIndex]);

  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 360, h: 420 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // One frame of the dial: how big, how narrow the facing section is, the
  // layout with that narrowing, and how far to turn it.
  const frame = useMemo(() => {
    const at = clamp(turn, 0, Math.max(0, count - 1));
    const lo = Math.floor(at);
    const hi = Math.min(count - 1, lo + 1);
    const frac = at - lo;
    const ringOf = (i) => deepestRing.get(sections[i]?.id) ?? base.maxRing;
    const outer = count > 0 ? lerp(ringRadii(ringOf(lo)).outer, ringRadii(Math.max(0, ringOf(hi))).outer, frac) : ringRadii(base.maxRing).outer;

    const usableW = Math.max(40, size.w - SIDE_PAD * 2);
    let scale = Math.min(MAX_SCALE, size.h / (outer + TOP_ROOM - HUB_HIDDEN * CENTER_RADIUS));
    const natural = sections[lo]?.span ?? Math.PI * 2;
    let span = natural;
    if (count <= 1) {
      // Nothing to turn to, so the whole upper half has to fit across.
      scale = Math.min(scale, usableW / (2 * outer));
    } else {
      // The widest the facing section can be at that size and still fit across.
      const fits = 2 * Math.asin(Math.min(1, usableW / (2 * outer * scale)));
      if (fits < natural) {
        span = Math.max(fits, MIN_FACING_SPAN);
        if (span > fits) scale = usableW / (2 * outer * Math.sin(span / 2));
      }
    }

    // Weight that gives the facing section `span`, shared out between the
    // two sections while the dial is between them.
    let layout = base.layout;
    if (count > 1 && span < natural - 1e-6) {
      const total = sections.reduce((sum, s) => sum + s.span, 0);
      const full = (span * (count - 1)) / (total - span);
      const weights = new Map([[sections[lo].id, lerp(full, 1, frac)]]);
      if (hi !== lo) weights.set(sections[hi].id, lerp(1, full, frac));
      layout = computeWheel(nodes, edges, centerId, null, weights).layout;
    }

    const midOf = (i) => {
      const pos = layout.get(sections[i]?.id);
      return pos ? (pos.angleStart + pos.angleEnd) / 2 : 0;
    };
    const facing = count > 0 ? lerp(midOf(lo), midOf(hi), frac) : 0;
    return { layout, scale, rotation: -facing };
  }, [turn, count, sections, deepestRing, base, size, nodes, edges, centerId]);

  const labels = useMemo(
    () => layoutLabels(frame.layout, titleById, frame.scale, { flipOffset: frame.rotation }),
    [frame, titleById]
  );

  // Swipes. The dial follows the finger, about half the screen's width per
  // section, and settles on the nearest one when it lets go.
  const drag = useRef(null);
  const suppressTap = useRef(false);

  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    suppressTap.current = false;
    if (count <= 1) return;
    cancelAnimationFrame(animRef.current);
    drag.current = { pointerId: e.pointerId, x0: e.clientX, from: turnRef.current, moved: false };
  }

  function onPointerMove(e) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.abs(dx) < TAP_SLOP) return;
    if (!d.moved) {
      d.moved = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setDragging(true);
    }
    let next = d.from - dx / Math.max(120, size.w * 0.55);
    // Past either end it gives a little, and resists.
    if (next < 0) next *= 0.3;
    if (next > count - 1) next = count - 1 + (next - (count - 1)) * 0.3;
    setTurn(next);
  }

  function endDrag(e, cancelled = false) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    if (!d.moved) {
      // A tap: if the dial was still turning, finish the turn.
      if (turnRef.current !== activeIndex) animateTo(activeIndex);
      return;
    }
    suppressTap.current = true;
    setDragging(false);
    const start = Math.round(d.from);
    let target = Math.round(clamp(turnRef.current, 0, count - 1));
    const dx = e.clientX - d.x0;
    if (!cancelled && target === start && Math.abs(dx) > SWIPE_PX) target = start + (dx < 0 ? 1 : -1);
    goTo(target);
  }

  function handleWedgeTap(id) {
    if (suppressTap.current) return;
    onSelectNode?.(id);
  }

  const active = sections[activeIndex];
  const activeTitle = active ? titleById.get(active.id) ?? "" : titleById.get(centerId) ?? "";
  const pivotTop = size.h + HUB_HIDDEN * CENTER_RADIUS * frame.scale;
  const rotationDeg = (frame.rotation * 180) / Math.PI;

  const rim = (id, stroke, width) => {
    const pos = frame.layout.get(id);
    if (!pos) return null;
    return (
      <path
        key={`${id}-${stroke}`}
        d={wedgeOutline(pos.ringIndex, pos.angleStart, pos.angleEnd).d}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ pointerEvents: "none" }}
      />
    );
  };

  const reach = ringRadii(base.maxRing).outer + TOP_ROOM;

  return (
    <div className="section-wheel">
      <div className="section-wheel__switcher">
        {count > 1 && (
          <button
            type="button"
            className="btn-icon btn-icon--bordered section-wheel__step"
            onClick={() => goTo(activeIndex - 1)}
            disabled={activeIndex === 0}
            aria-label="Previous section"
            title="Previous section"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <div className="section-wheel__now">
          <span className="section-wheel__title">{activeTitle}</span>
          {count > 1 && (
            <span className="section-wheel__dots" aria-hidden="true">
              {sections.map((s, i) => (
                <span key={s.id} className={i === activeIndex ? "on" : ""} />
              ))}
            </span>
          )}
        </div>
        {count > 1 && (
          <button
            type="button"
            className="btn-icon btn-icon--bordered section-wheel__step"
            onClick={() => goTo(activeIndex + 1)}
            disabled={activeIndex === count - 1}
            aria-label="Next section"
            title="Next section"
          >
            <ChevronRight size={18} />
          </button>
        )}
      </div>

      <div
        ref={wrapRef}
        className="section-wheel__dial"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e)}
        onPointerCancel={(e) => endDrag(e, true)}
        style={{ cursor: count > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: pivotTop,
            width: reach * 2,
            height: reach * 2,
            transform: `translate(-50%, -50%) rotate(${rotationDeg}deg) scale(${frame.scale})`,
            transformOrigin: "50% 50%",
          }}
        >
          <svg width={reach * 2} height={reach * 2} viewBox={`${-reach} ${-reach} ${reach * 2} ${reach * 2}`} style={{ display: "block", overflow: "visible" }}>
            {base.hasVirtualHub && !centerId && <circle r={CENTER_RADIUS} fill="var(--surface)" stroke="#ffffff" strokeWidth={2.5} />}

            {[...frame.layout.entries()].map(([id, pos]) => {
              const node = nodeById.get(id);
              if (!node) return null;
              const visual = getWedgeVisual(pos.ringIndex, brightnessById?.get(id) ?? 0);
              const shape = wedgeOutline(pos.ringIndex, pos.angleStart, pos.angleEnd);
              return (
                <g key={id} className="wheel-wedge" onClick={() => handleWedgeTap(id)}>
                  <title>{node.title}</title>
                  <path d={shape.d} fillRule={shape.fillRule} fill={visual.fill} stroke={visual.stroke} strokeWidth={visual.strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
                  {/* The center disc sits mostly below the edge; its title is in the header. */}
                  {pos.ringIndex > 0 && <WedgeLabel id={`${uid}-${id}`} label={labels.get(id)} color={visual.labelColor} />}
                </g>
              );
            })}

            {[...frame.layout.keys()].filter((id) => nodeById.get(id)?.is_focused).map((id) => rim(id, FOCUS_COLOR, 3))}
            {selectedId && rim(selectedId, HOVER_COLOR, 3.5)}
          </svg>
        </div>
      </div>
    </div>
  );
}
