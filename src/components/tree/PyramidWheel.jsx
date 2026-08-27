import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeWheel, ringRadii, roundedWedgePath, labelArcPath, radialLabelTransform, MIN_LABEL_ANGLE, CENTER_RADIUS, RING_THICKNESS } from "../../lib/wheel";
import { getWedgeVisual, HOVER_COLOR, FOCUS_COLOR } from "../../lib/nodeStyle";

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3;
const HOVER_TRANSITION = "d 130ms ease-out, transform 130ms ease-out";

// Label font size scales with how big the wedge actually reads on screen
// (its arc length at mid-radius), not a fixed size for every wedge — a
// giant root wedge gets a bigger label than a sliver three rings deep.
// Square-root keeps the range graduated instead of extreme.
const MIN_FONT = 10;
const MAX_FONT = 22;
const BASE_FONT = 15;
const REFERENCE_ARC = 200; // arc length (px) that maps to BASE_FONT
function fontSizeFor(arcLength) {
  const raw = BASE_FONT * Math.sqrt(arcLength / REFERENCE_ARC);
  return Math.min(MAX_FONT, Math.max(MIN_FONT, raw));
}

// Word-wraps into at most maxLines lines of at most maxCharsPerLine each,
// ellipsis-truncating the last line if the title still doesn't fit.
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

// A hand-rolled pan/zoom SVG sunburst — deliberately not React Flow, since
// wedges are geometric arcs (sized purely by ring + angle), not measured
// rectangular cards, and clicking one just selects it rather than dragging it.
// `wheel` ({layout, maxRing, hasVirtualHub}) is the BASE (non-hover) layout
// from lib/wheel's computeWheel, computed once in Pyramid.jsx and shared
// with the detail panel. This component derives its own hover-adjusted
// layout from `edges` on top of that whenever something's hovered.
export default function PyramidWheel({ nodes, edges, wheel, brightnessById, centerNodeId, onSelectNode }) {
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // Static per-wedge facts from the BASE layout: ring geometry and which
  // text orientation this wedge's whole sibling group uses. Orientation is
  // decided once, per sibling group, so a fan of children never reads as a
  // jumble of different directions — and it doesn't change just because one
  // of them is being hovered.
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
      const fitsCurved = angleSpan >= MIN_LABEL_ANGLE * 2.5 && arcLength >= estCurvedWidth;
      info.set(id, { ringIndex: pos.ringIndex, inner, outer, midRadius, parentId: pos.parentId, fitsCurved });
    }
    const siblingGroups = new Map();
    for (const [id, v] of info.entries()) {
      const key = v.parentId ?? "__root__";
      if (!siblingGroups.has(key)) siblingGroups.set(key, []);
      siblingGroups.get(key).push(id);
    }
    const groupCurved = new Map();
    for (const [key, ids] of siblingGroups.entries()) {
      groupCurved.set(key, ids.every((id) => info.get(id).fitsCurved));
    }
    for (const [id, v] of info.entries()) v.useCurved = groupCurved.get(v.parentId ?? "__root__");
    return info;
  }, [wheel.layout, nodeById]);

  const totalRadius = CENTER_RADIUS + wheel.maxRing * RING_THICKNESS + 60;

  const wrapRef = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);

  // Minimum angle a hovered wedge needs to show a short, legible label in
  // its own orientation — not its full title, just enough to read something.
  // Curved wedges need arc length for a handful of characters; radial ones
  // barely need any extra angle at all, since their text runs along the
  // ring's thickness, not around it — "just enough to show vertical text."
  const minAngleFn = useCallback(
    (id) => {
      const v = wedgeInfo.get(id);
      const node = nodeById.get(id);
      if (!v || !node) return 0;
      if (v.useCurved) {
        const fontSize = MIN_FONT + 2;
        const avgCharWidth = fontSize * 0.58;
        const shortLabelWidth = Math.min(node.title.length, 8) * avgCharWidth + 16;
        return shortLabelWidth / v.midRadius;
      }
      // Radial text length is bounded by ring thickness, not angle — so
      // growing the angle doesn't actually buy more room for the text
      // itself, it only needs to clear the "show any label at all"
      // threshold. A small margin over that threshold, not a big multiple.
      return MIN_LABEL_ANGLE * 1.5;
    },
    [wedgeInfo, nodeById]
  );

  // Hover-adjusted layout: the hovered wedge grows, its siblings shrink to
  // compensate (same total span), cascading to their descendants too since
  // it's computed via the same recursive placement. Falls back to the base
  // layout untouched when nothing's hovered.
  const displayLayout = useMemo(() => {
    if (!hoveredId) return wheel.layout;
    return computeWheel(nodes, edges, centerNodeId, { hoveredId, growFactor: 1.025, minAngleFn }).layout;
  }, [hoveredId, nodes, edges, centerNodeId, wheel.layout, minAngleFn]);

  // Frame the whole wheel in view whenever the root we're centered on changes
  // (initial load, or "center on this" from the detail panel).
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const fitScale = Math.min(1, (Math.min(wrap.clientWidth, wrap.clientHeight) * 0.42) / totalRadius);
    setView({ x: wrap.clientWidth / 2, y: wrap.clientHeight / 2, scale: fitScale });
  }, [centerNodeId, totalRadius]);

  const dragRef = useRef({ dragging: false, moved: false, startX: 0, startY: 0, startViewX: 0, startViewY: 0 });

  const onMouseDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      dragRef.current = { dragging: true, moved: false, startX: e.clientX, startY: e.clientY, startViewX: view.x, startViewY: view.y };
      setIsDragging(true);
    },
    [view]
  );

  useEffect(() => {
    function onMouseMove(e) {
      const d = dragRef.current;
      if (!d.dragging) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
      setView((v) => ({ ...v, x: d.startViewX + dx, y: d.startViewY + dy }));
    }
    function onMouseUp() {
      dragRef.current.dragging = false;
      setIsDragging(false);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // React's JSX onWheel is always registered passive for this event type, so
  // e.preventDefault() inside it is silently ignored (and logs a warning) —
  // the page would scroll natively underneath our own zoom. A manually
  // attached, non-passive listener is the only way to actually claim it.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function onWheel(e) {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setView((v) => {
        const factor = Math.exp(-e.deltaY * 0.0015);
        const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.scale * factor));
        const worldX = (mouseX - v.x) / v.scale;
        const worldY = (mouseY - v.y) / v.scale;
        return { scale: nextScale, x: mouseX - worldX * nextScale, y: mouseY - worldY * nextScale };
      });
    }
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, []);

  function handleWedgeClick(id) {
    if (dragRef.current.moved) return; // that was a pan, not a tap
    onSelectNode(id);
  }

  return (
    <div
      ref={wrapRef}
      onMouseDown={onMouseDown}
      style={{ width: "100%", height: "100%", overflow: "hidden", cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
    >
      <svg
        width={totalRadius * 2}
        height={totalRadius * 2}
        viewBox={`${-totalRadius} ${-totalRadius} ${totalRadius * 2} ${totalRadius * 2}`}
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale}) translate(${-totalRadius}px, ${-totalRadius}px)`,
          transformOrigin: "0 0",
        }}
      >
        <defs>
          <filter id="wedge-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {wheel.hasVirtualHub && (
          <circle r={CENTER_RADIUS} fill="var(--bg-elevated)" stroke="#050609" strokeWidth={2.5} strokeLinejoin="round" />
        )}

        {[...displayLayout.entries()].map(([id, pos]) => {
          const node = nodeById.get(id);
          const v = wedgeInfo.get(id);
          if (!node || !v) return null;
          const brightness = brightnessById.get(id) ?? 0;
          const visual = getWedgeVisual(v.ringIndex, brightness);
          const angleSpan = pos.angleEnd - pos.angleStart;
          const isFullCircle = angleSpan >= Math.PI * 2 - 0.001;
          const shapeD = isFullCircle ? null : roundedWedgePath(v.inner, v.outer, pos.angleStart, pos.angleEnd);
          const showLabel = angleSpan >= MIN_LABEL_ANGLE;

          const midRadius = v.midRadius;
          const arcLength = angleSpan * midRadius;
          const fontSize = fontSizeFor(arcLength);
          const lineHeight = fontSize * 1.15;

          return (
            <g
              key={id}
              onClick={() => handleWedgeClick(id)}
              onMouseEnter={() => setHoveredId(id)}
              onMouseLeave={() => setHoveredId((cur) => (cur === id ? null : cur))}
              style={{ cursor: "pointer" }}
            >
              {isFullCircle ? (
                <circle
                  r={v.outer}
                  fill={visual.fill}
                  stroke={visual.stroke}
                  strokeWidth={visual.strokeWidth}
                  strokeLinejoin="round"
                  filter={visual.glowFilter !== "none" ? visual.glowFilter : undefined}
                  style={{ transition: HOVER_TRANSITION }}
                />
              ) : (
                <path
                  d={shapeD}
                  fill={visual.fill}
                  stroke={visual.stroke}
                  strokeWidth={visual.strokeWidth}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  filter={visual.glowFilter !== "none" ? visual.glowFilter : undefined}
                  style={{ transition: HOVER_TRANSITION }}
                />
              )}

              {showLabel &&
                (v.useCurved ? (
                  <CurvedLabel id={id} node={node} inner={v.inner} outer={v.outer} pos={pos} fontSize={fontSize} lineHeight={lineHeight} color={visual.labelColor} />
                ) : (
                  <RadialLabel node={node} inner={v.inner} outer={v.outer} pos={pos} fontSize={fontSize} lineHeight={lineHeight} color={visual.labelColor} />
                ))}
            </g>
          );
        })}

        {/* Focus rims — rendered in their own pass, after every wedge, so a
            later-drawn neighbor sharing an edge with a focused wedge never
            paints over part of its rim (that was "sitting under the goal"). */}
        {[...displayLayout.entries()]
          .filter(([id]) => nodeById.get(id)?.is_focused)
          .map(([id, pos]) => {
            const v = wedgeInfo.get(id);
            if (!v) return null;
            const angleSpan = pos.angleEnd - pos.angleStart;
            const isFullCircle = angleSpan >= Math.PI * 2 - 0.001;
            return (
              <g key={id} style={{ pointerEvents: "none" }}>
                {isFullCircle ? (
                  <circle r={v.outer} fill="none" stroke={FOCUS_COLOR} strokeWidth={3} strokeLinejoin="round" style={{ transition: HOVER_TRANSITION }} />
                ) : (
                  <path
                    d={roundedWedgePath(v.inner, v.outer, pos.angleStart, pos.angleEnd)}
                    fill="none"
                    stroke={FOCUS_COLOR}
                    strokeWidth={3}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    style={{ transition: HOVER_TRANSITION }}
                  />
                )}
              </g>
            );
          })}

        {/* Hover rim — topmost of all, its own pass for the same reason, and
            drawn after focus rims so it's never covered by them either. */}
        {hoveredId &&
          !isDragging &&
          (() => {
            const pos = displayLayout.get(hoveredId);
            const v = wedgeInfo.get(hoveredId);
            if (!pos || !v) return null;
            const angleSpan = pos.angleEnd - pos.angleStart;
            const isFullCircle = angleSpan >= Math.PI * 2 - 0.001;
            return (
              <g style={{ pointerEvents: "none" }}>
                {isFullCircle ? (
                  <circle r={v.outer} fill="none" stroke={HOVER_COLOR} strokeWidth={2.5} strokeOpacity={0.9} strokeLinejoin="round" style={{ transition: HOVER_TRANSITION }} />
                ) : (
                  <path
                    d={roundedWedgePath(v.inner, v.outer, pos.angleStart, pos.angleEnd)}
                    fill="none"
                    stroke={HOVER_COLOR}
                    strokeWidth={2.5}
                    strokeOpacity={0.9}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    style={{ transition: HOVER_TRANSITION }}
                  />
                )}
              </g>
            );
          })()}
      </svg>
    </div>
  );
}

function CurvedLabel({ id, node, inner, outer, pos, fontSize, lineHeight, color }) {
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
        const pathId = `wedge-arc-${id}-${i}`;
        return (
          <g key={i}>
            <path id={pathId} d={labelArcPath(radius, pos.angleStart, pos.angleEnd)} fill="none" style={{ transition: "d 130ms ease-out" }} />
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

function RadialLabel({ node, inner, outer, pos, fontSize, lineHeight, color }) {
  const avgCharWidth = fontSize * 0.58;
  const available = outer - inner - 16;
  const maxCharsPerLine = Math.max(3, Math.floor(available / avgCharWidth));
  const lines = wrapTitle(node.title, maxCharsPerLine, 2);
  const label = radialLabelTransform(inner, outer, pos.angleStart, pos.angleEnd);
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
          <text
            key={i}
            x={x}
            y={y}
            transform={`rotate(${label.rotateDeg}, ${x}, ${y})`}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize}
            fontWeight={700}
            fill={color}
            style={{ pointerEvents: "none", transition: "x 130ms ease-out, y 130ms ease-out" }}
          >
            {line}
          </text>
        );
      })}
    </>
  );
}
