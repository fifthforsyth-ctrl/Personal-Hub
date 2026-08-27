import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { computeWheel, ringRadii, roundedWedgePath, labelArcPath, radialLabelTransform, MIN_LABEL_ANGLE, CENTER_RADIUS, RING_THICKNESS } from "../../lib/wheel";
import { getWedgeVisual, FOCUS_COLOR } from "../../lib/nodeStyle";

const MAX_SCALE = 2.6;
const SWIPE_PX_THRESHOLD = 45; // drag distance to commit to the next/prev sibling
const TAP_MOVE_THRESHOLD = 6; // below this, a pointer-up counts as a tap, not a swipe
const DRAG_TO_RAD = 0.0055; // live rotation preview while dragging (radians per px)
const MAX_PREVIEW_RAD = (48 * Math.PI) / 180;

// Small, self-contained duplicates of PyramidWheel's label-fitting helpers —
// mobile wedges are fewer and bigger on screen than desktop's, but the same
// "does the curved text actually fit" question applies, so the math is kept
// identical on purpose. Not shared as an import so this component (and its
// gesture logic, which is the part that's actually new) stays decoupled
// from the desktop pan/zoom component while it's still being tuned.
const MIN_FONT = 11;
const MAX_FONT = 22;
const BASE_FONT = 16;
const REFERENCE_ARC = 200;
function fontSizeFor(arcLength) {
  const raw = BASE_FONT * Math.sqrt(arcLength / REFERENCE_ARC);
  return Math.min(MAX_FONT, Math.max(MIN_FONT, raw));
}
function wrapTitle(title, maxCharsPerLine, maxLines) {
  const width = Math.max(3, Math.floor(maxCharsPerLine));
  const words = title.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length > maxLines) lines.length = maxLines;
  const consumed = lines.join(" ").length;
  const truncated = consumed < title.replace(/\s+/g, " ").length;
  if (lines.length === 0) {
    lines.push(title.slice(0, width - 1) + (title.length > width ? "…" : ""));
  } else if (truncated) {
    const last = lines[lines.length - 1].replace(/\s+$/, "").slice(0, Math.max(1, width - 1));
    lines[lines.length - 1] = last + "…";
  }
  return lines;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// The mobile counterpart to PyramidWheel: instead of a pan/zoomable full
// circle, the wheel's center (pivot) sits pinned to the bottom-center of its
// container, so only the upper half (or so) is visible — like a dial. A
// horizontal swipe rotates that dial, bringing a different sibling to face
// straight up — the whole tree from the current center down is drawn every
// time (not just the active sibling), so neighbors are genuinely visible
// mid-rotation, the same "goals rotating around a shared center" visual
// everywhere this component is used.
//
// "The current center" defaults to the true top (the root, or the invisible
// hub over several root goals) — whatever rotates around it is the set of
// top-level sections. `centerOverrideId`, if given (see Pyramid.jsx's
// "center the wheel here"), moves the center to that specific node instead
// — the exact same rotation mechanic then plays out one level deeper,
// swiping through THAT node's own children, with `onExitOverride` wired to
// a back control to return to the top. This is the escape valve for a
// section with too many/too-wide children to read comfortably as part of
// the full multi-section wheel: narrow the center down to it, and its own
// children get the same full-width treatment top-level sections normally
// get.
export default function SectionWheel({ nodes, edges, brightnessById, onSelectNode, onActiveSectionChange, centerOverrideId = null, onExitOverride, height = "100%" }) {
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const overridden = Boolean(centerOverrideId && nodeById.has(centerOverrideId));
  const centerId = overridden ? centerOverrideId : null;

  const wheel = useMemo(() => computeWheel(nodes, edges, centerId), [nodes, edges, centerId]);

  // Whatever rotates around the current center: the multiple roots
  // themselves when centered on the true top, or the center's own direct
  // children once narrowed down to a specific node.
  const sections = useMemo(() => {
    const entries = [...wheel.layout.entries()].filter(([, pos]) => (centerId === null ? pos.parentId === null : pos.parentId === centerId));
    entries.sort((a, b) => a[1].angleStart - b[1].angleStart);
    return entries.map(([id, pos]) => ({ id, mid: (pos.angleStart + pos.angleEnd) / 2, span: pos.angleEnd - pos.angleStart }));
  }, [wheel.layout, centerId]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [dragRad, setDragRad] = useState(0);
  const [dragging, setDragging] = useState(false);

  // A different center means a different set of siblings entirely — an old
  // index from the previous set wouldn't mean anything here.
  useEffect(() => {
    setActiveIndex(0);
  }, [centerId]);

  // If the tree changes shape (goal added/removed) and the current index no
  // longer lines up, clamp back onto something valid rather than pointing
  // at nothing.
  useEffect(() => {
    if (activeIndex > sections.length - 1) setActiveIndex(Math.max(0, sections.length - 1));
  }, [sections.length, activeIndex]);

  useEffect(() => {
    const active = sections[activeIndex];
    onActiveSectionChange?.(active?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, activeIndex]);

  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 320, h: 320 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height: h } = entry.contentRect;
      setSize({ w: width, h: h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const totalRadius = CENTER_RADIUS + wheel.maxRing * RING_THICKNESS + 40;

  // Bounded by the widest of the currently-rotating siblings — a center
  // with many children (each a narrow slice) can zoom in a lot; one with
  // just 1-2 children (each a wide slice, up to a full 180°) can't zoom as
  // far without its own label running off the side, since a wide slice's
  // label sits at its slice's midpoint, which is out toward the horizontal
  // edge for anything approaching half the circle. That's exactly the
  // signal for when narrowing down to a deeper center is worth it — its
  // own (typically narrower) children get to use the width its parent's
  // wide slice couldn't.
  const maxSectionSpan = sections.length > 0 ? Math.max(...sections.map((s) => s.span)) : Math.PI * 2;
  const halfSpan = Math.min(maxSectionSpan, Math.PI) / 2;
  const horizontalReach = totalRadius * Math.sin(halfSpan);
  const scale = Math.min(MAX_SCALE, size.w / (2 * horizontalReach) || 0.001, size.h / totalRadius || 0.001);

  const wedgeInfo = useMemo(() => {
    const info = new Map();
    for (const [id, pos] of wheel.layout.entries()) {
      const node = nodeById.get(id);
      if (!node) continue;
      const { inner, outer } = ringRadii(pos.ringIndex);
      const angleSpan = pos.angleEnd - pos.angleStart;
      const midRadius = (inner + outer) / 2;
      const arcLength = angleSpan * midRadius;
      const fontSize = fontSizeFor(arcLength);
      const avgCharWidth = fontSize * 0.58;
      const estCurvedWidth = node.title.length * avgCharWidth;
      const useCurved = angleSpan >= MIN_LABEL_ANGLE * 2.5 && arcLength >= estCurvedWidth;
      info.set(id, { ringIndex: pos.ringIndex, inner, outer, midRadius, useCurved });
    }
    return info;
  }, [wheel.layout, nodeById]);

  const dragStateRef = useRef({ startX: 0, moved: false });

  function handlePointerDown(e) {
    if (sections.length <= 1) return;
    dragStateRef.current = { startX: e.clientX, moved: false };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - dragStateRef.current.startX;
    if (Math.abs(dx) > TAP_MOVE_THRESHOLD) dragStateRef.current.moved = true;
    setDragRad(clamp(-dx * DRAG_TO_RAD, -MAX_PREVIEW_RAD, MAX_PREVIEW_RAD));
  }

  function endDrag(e) {
    if (!dragging) return;
    const dx = e.clientX - dragStateRef.current.startX;
    setDragging(false);
    setDragRad(0);
    if (Math.abs(dx) > SWIPE_PX_THRESHOLD) {
      setActiveIndex((i) => clamp(i + (dx < 0 ? 1 : -1), 0, sections.length - 1));
    }
  }

  function step(delta) {
    setActiveIndex((i) => clamp(i + delta, 0, sections.length - 1));
  }

  function handleWedgeTap(id) {
    if (dragStateRef.current.moved) return;
    onSelectNode?.(id);
  }

  const baseRotationRad = -(sections[activeIndex]?.mid ?? 0);
  const rotationDeg = ((baseRotationRad + dragRad) * 180) / Math.PI;
  const activeTitle = sections.length > 0 ? nodeById.get(sections[activeIndex]?.id)?.title ?? "" : nodeById.get(centerId)?.title ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "2px 4px 10px", flexShrink: 0 }}>
        {overridden && (
          <button onClick={() => onExitOverride?.()} title="Back to sections" style={{ ...sectionNavBtnStyle, width: "auto", borderRadius: 14, padding: "0 10px" }}>
            <ChevronLeft size={14} />
          </button>
        )}
        {sections.length > 1 ? (
          <>
            <button onClick={() => step(-1)} disabled={activeIndex === 0} style={sectionNavBtnStyle}>
              <ChevronLeft size={16} />
            </button>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 800, textAlign: "center", padding: "0 4px" }}>{activeTitle}</span>
              <div style={{ display: "flex", gap: 4 }}>
                {sections.map((s, i) => (
                  <span
                    key={s.id}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: i === activeIndex ? "var(--accent-strong)" : "var(--border-strong)",
                      transition: "background 0.15s",
                    }}
                  />
                ))}
              </div>
            </div>
            <button onClick={() => step(1)} disabled={activeIndex === sections.length - 1} style={sectionNavBtnStyle}>
              <ChevronRight size={16} />
            </button>
          </>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 800, textAlign: "center", padding: "0 4px" }}>{activeTitle}</span>
        )}
      </div>

      <div
        ref={wrapRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden", touchAction: "none", cursor: sections.length > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "100%",
            width: totalRadius * 2,
            height: totalRadius * 2,
            transform: `translate(-50%, -50%) rotate(${rotationDeg}deg) scale(${scale})`,
            transformOrigin: "50% 50%",
            transition: dragging ? "none" : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <svg width={totalRadius * 2} height={totalRadius * 2} viewBox={`${-totalRadius} ${-totalRadius} ${totalRadius * 2} ${totalRadius * 2}`}>
            {wheel.hasVirtualHub && <circle r={CENTER_RADIUS} fill="var(--bg-elevated)" stroke="#050609" strokeWidth={2.5} strokeLinejoin="round" />}

            {[...wheel.layout.entries()].map(([id, pos]) => {
              const node = nodeById.get(id);
              const v = wedgeInfo.get(id);
              if (!node || !v) return null;
              const brightness = brightnessById?.get(id) ?? 0;
              const visual = getWedgeVisual(v.ringIndex, brightness);
              const angleSpan = pos.angleEnd - pos.angleStart;
              const isFullCircle = angleSpan >= Math.PI * 2 - 0.001;
              const showLabel = angleSpan >= MIN_LABEL_ANGLE;
              const fontSize = fontSizeFor(angleSpan * v.midRadius);
              const lineHeight = fontSize * 1.15;

              return (
                <g key={id} onClick={() => handleWedgeTap(id)} style={{ cursor: "pointer" }}>
                  {isFullCircle ? (
                    <circle r={v.outer} fill={visual.fill} stroke={visual.stroke} strokeWidth={visual.strokeWidth} strokeLinejoin="round" filter={visual.glowFilter !== "none" ? visual.glowFilter : undefined} />
                  ) : (
                    <path d={roundedWedgePath(v.inner, v.outer, pos.angleStart, pos.angleEnd)} fill={visual.fill} stroke={visual.stroke} strokeWidth={visual.strokeWidth} strokeLinejoin="round" strokeLinecap="round" filter={visual.glowFilter !== "none" ? visual.glowFilter : undefined} />
                  )}
                  {node.is_focused && (
                    isFullCircle ? (
                      <circle r={v.outer} fill="none" stroke={FOCUS_COLOR} strokeWidth={3} strokeLinejoin="round" />
                    ) : (
                      <path d={roundedWedgePath(v.inner, v.outer, pos.angleStart, pos.angleEnd)} fill="none" stroke={FOCUS_COLOR} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
                    )
                  )}
                  {showLabel &&
                    (v.useCurved ? (
                      <MobileCurvedLabel id={id} node={node} inner={v.inner} outer={v.outer} pos={pos} fontSize={fontSize} lineHeight={lineHeight} color={visual.labelColor} rotationRad={baseRotationRad + dragRad} />
                    ) : (
                      <MobileRadialLabel node={node} inner={v.inner} outer={v.outer} pos={pos} fontSize={fontSize} lineHeight={lineHeight} color={visual.labelColor} rotationRad={baseRotationRad + dragRad} />
                    ))}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

const sectionNavBtnStyle = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid var(--border)",
  borderRadius: "50%",
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "inherit",
  flexShrink: 0,
};

function MobileCurvedLabel({ id, node, inner, outer, pos, fontSize, lineHeight, color, rotationRad }) {
  const avgCharWidth = fontSize * 0.58;
  const arcLength = (pos.angleEnd - pos.angleStart) * ((inner + outer) / 2);
  const maxCharsPerLine = Math.max(4, Math.floor((arcLength - 20) / avgCharWidth));
  const maxLines = Math.max(1, Math.min(3, Math.floor((outer - inner) / lineHeight)));
  const lines = wrapTitle(node.title, maxCharsPerLine, maxLines);
  const midRadius = (inner + outer) / 2;

  return (
    <>
      {lines.map((line, i) => {
        const offset = (i - (lines.length - 1) / 2) * lineHeight;
        const radius = midRadius + offset;
        const pathId = `mobile-wedge-arc-${id}-${i}`;
        return (
          <g key={i}>
            <path id={pathId} d={labelArcPath(radius, pos.angleStart, pos.angleEnd, rotationRad)} fill="none" />
            <text fontSize={fontSize} fontWeight={700} fill={color} style={{ pointerEvents: "none" }}>
              <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
                {line}
              </textPath>
            </text>
          </g>
        );
      })}
    </>
  );
}

function MobileRadialLabel({ node, inner, outer, pos, fontSize, lineHeight, color, rotationRad }) {
  const avgCharWidth = fontSize * 0.58;
  const available = outer - inner - 16;
  const maxCharsPerLine = Math.max(3, Math.floor(available / avgCharWidth));
  const lines = wrapTitle(node.title, maxCharsPerLine, 2);
  const label = radialLabelTransform(inner, outer, pos.angleStart, pos.angleEnd, rotationRad);
  const screenAngle = (pos.angleStart + pos.angleEnd) / 2 - Math.PI / 2;
  const tangentX = -Math.sin(screenAngle);
  const tangentY = Math.cos(screenAngle);

  return (
    <>
      {lines.map((line, i) => {
        const offset = (i - (lines.length - 1) / 2) * lineHeight;
        const x = label.x + tangentX * offset;
        const y = label.y + tangentY * offset;
        return (
          <text key={i} x={x} y={y} transform={`rotate(${label.rotateDeg}, ${x}, ${y})`} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fontWeight={700} fill={color} style={{ pointerEvents: "none" }}>
            {line}
          </text>
        );
      })}
    </>
  );
}
