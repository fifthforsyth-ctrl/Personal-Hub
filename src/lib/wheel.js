// Sunburst geometry: concentric rings by depth, wedges by sibling position.
// Pure math, no DOM measurement needed — unlike the old card-based layout,
// a wedge's size is purely geometric (ring thickness x angular slice), never
// dependent on its content.

export const RING_THICKNESS = 130;
export const CENTER_RADIUS = 90; // radius of the ring-0 (root) hub
export const MIN_LABEL_ANGLE = (4 * Math.PI) / 180; // wedges thinner than this skip their label entirely

// Builds { byId: Map<id, {ringIndex, angleStart, angleEnd}>, maxRing }.
// `centerNodeId`, if set, re-roots the wheel on that node ("zoomed in") —
// only its own subtree is placed, nothing above or beside it.
// A child only ever appears under its *first* parent edge — a sunburst is a
// strict tree, so a node with multiple parents just needs a stable, single
// place to live visually (same convention the old tree layout used).
//
// `hover` ({ hoveredId, growFactor, minAngleFn }), if given, grows the
// hovered node's angular slice and shrinks its siblings to compensate —
// same total span, just redistributed — rather than overlaying an enlarged
// copy on top of everything. Because this happens right inside the
// recursive placement, the adjustment cascades naturally to every
// descendant of an affected sibling, not just the one ring it starts in.
// minAngleFn(nodeId) lets the caller (which knows about font/text sizing,
// not this module) enforce "grow at least enough to be legible" on top of
// the flat percentage growth.
export function computeWheel(nodes, edges, centerNodeId, hover) {
  const { hoveredId = null, growFactor = 1.08, minAngleFn = () => 0 } = hover ?? {};
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const firstParentOf = new Map();
  const childrenOf = new Map();
  for (const e of edges) {
    if (!nodeById.has(e.child_id) || !nodeById.has(e.parent_id)) continue;
    if (!firstParentOf.has(e.child_id)) {
      firstParentOf.set(e.child_id, e.parent_id);
      if (!childrenOf.has(e.parent_id)) childrenOf.set(e.parent_id, []);
      childrenOf.get(e.parent_id).push(e.child_id);
    }
  }

  let roots;
  if (centerNodeId && nodeById.has(centerNodeId)) {
    roots = [nodeById.get(centerNodeId)];
  } else {
    roots = nodes.filter((n) => !firstParentOf.has(n.id));
  }

  // parentId travels with each placement — null for a lone root or for
  // top-level roots in the multi-root case (they're all siblings of the
  // invisible hub). Used to group siblings for consistent text orientation.
  const layout = new Map();
  function place(id, ring, angleStart, angleEnd, parentId) {
    layout.set(id, { ringIndex: ring, angleStart, angleEnd, parentId });
    const kids = childrenOf.get(id) ?? [];
    if (kids.length === 0) return;

    const totalSpan = angleEnd - angleStart;
    const naturalSlice = totalSpan / kids.length;

    if (hoveredId && kids.length > 1 && kids.includes(hoveredId)) {
      // Grow to whatever minAngleFn says is actually needed to show a label
      // (that function is responsible for keeping "needed" tight, not this
      // one) — a flat percentage cap doesn't work here since a genuinely
      // tiny sliver needs more than a modest bump just to clear the "show
      // any label at all" threshold.
      const desired = Math.min(Math.max(naturalSlice * growFactor, minAngleFn(hoveredId)), totalSpan * 0.7);
      const extra = Math.max(0, desired - naturalSlice);
      const others = kids.filter((k) => k !== hoveredId);
      const shrinkEach = extra / others.length;
      let cursor = angleStart;
      for (const kid of kids) {
        const width = kid === hoveredId ? naturalSlice + extra : Math.max(naturalSlice - shrinkEach, naturalSlice * 0.4);
        place(kid, ring + 1, cursor, cursor + width, id);
        cursor += width;
      }
      return;
    }

    kids.forEach((kid, i) => place(kid, ring + 1, angleStart + i * naturalSlice, angleStart + (i + 1) * naturalSlice, id));
  }

  const hasVirtualHub = roots.length > 1;
  if (roots.length === 1) {
    place(roots[0].id, 0, 0, Math.PI * 2, null);
  } else if (roots.length > 1) {
    const slice = (Math.PI * 2) / roots.length;
    if (hoveredId && roots.some((r) => r.id === hoveredId)) {
      const desired = Math.min(Math.max(slice * growFactor, minAngleFn(hoveredId)), Math.PI * 2 * 0.7);
      const extra = Math.max(0, desired - slice);
      const others = roots.filter((r) => r.id !== hoveredId);
      const shrinkEach = others.length > 0 ? extra / others.length : 0;
      let cursor = 0;
      for (const r of roots) {
        const width = r.id === hoveredId ? slice + extra : Math.max(slice - shrinkEach, slice * 0.4);
        place(r.id, 1, cursor, cursor + width, null);
        cursor += width;
      }
    } else {
      roots.forEach((r, i) => place(r.id, 1, i * slice, (i + 1) * slice, null));
    }
  }

  let maxRing = 0;
  for (const v of layout.values()) maxRing = Math.max(maxRing, v.ringIndex);

  return { layout, maxRing, hasVirtualHub };
}

// Restricts a tree to its top `maxDepth` hops from each root (0 = roots
// only, 1 = roots + their direct children, ...) — used by the Reporting
// section-wheel, which only ever shows sections and their immediate
// sub-goals, never the full depth. Same first-parent convention as
// computeWheel, kept separate so callers that just want a smaller {nodes,
// edges} pair (to feed into computeWheel themselves) don't need to know
// anything about angles/rings.
export function pruneToDepth(nodes, edges, maxDepth) {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const firstParentOf = new Map();
  const childrenOf = new Map();
  for (const e of edges) {
    if (!nodeById.has(e.child_id) || !nodeById.has(e.parent_id)) continue;
    if (!firstParentOf.has(e.child_id)) {
      firstParentOf.set(e.child_id, e.parent_id);
      if (!childrenOf.has(e.parent_id)) childrenOf.set(e.parent_id, []);
      childrenOf.get(e.parent_id).push(e.child_id);
    }
  }

  const roots = nodes.filter((n) => !firstParentOf.has(n.id));
  const keep = new Set();
  function walk(id, depth) {
    keep.add(id);
    if (depth >= maxDepth) return;
    for (const kid of childrenOf.get(id) ?? []) walk(kid, depth + 1);
  }
  for (const r of roots) walk(r.id, 0);

  return {
    nodes: nodes.filter((n) => keep.has(n.id)),
    edges: edges.filter((e) => keep.has(e.child_id) && keep.has(e.parent_id) && firstParentOf.get(e.child_id) === e.parent_id),
  };
}

export function ringRadii(ringIndex) {
  if (ringIndex <= 0) return { inner: 0, outer: CENTER_RADIUS };
  return {
    inner: CENTER_RADIUS + (ringIndex - 1) * RING_THICKNESS,
    outer: CENTER_RADIUS + ringIndex * RING_THICKNESS,
  };
}

// SVG path for an annular wedge (donut segment), or a plain pie slice when
// innerR is ~0 (ring 0). Angles are radians, measured from the +x axis;
// internally rotated -90° so 0 points straight up, which just reads better.
export function wedgePath(innerR, outerR, angleStart, angleEnd) {
  const a0 = angleStart - Math.PI / 2;
  const a1 = angleEnd - Math.PI / 2;
  const x0o = outerR * Math.cos(a0), y0o = outerR * Math.sin(a0);
  const x1o = outerR * Math.cos(a1), y1o = outerR * Math.sin(a1);
  const largeArc = angleEnd - angleStart > Math.PI ? 1 : 0;

  if (innerR <= 0.01) {
    return `M 0 0 L ${x0o} ${y0o} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x1o} ${y1o} Z`;
  }
  const x1i = innerR * Math.cos(a1), y1i = innerR * Math.sin(a1);
  const x0i = innerR * Math.cos(a0), y0i = innerR * Math.sin(a0);
  return [
    `M ${x0i} ${y0i}`,
    `L ${x0o} ${y0o}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x1o} ${y1o}`,
    `L ${x1i} ${y1i}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x0i} ${y0i}`,
    "Z",
  ].join(" ");
}

// Corner radius for the rounded wedge paths below — ~8% of a ring's
// thickness, clamped per-wedge so fillets never eat more than half of any
// edge they sit on (a sliver-thin wedge just falls back to sharp corners).
export const CORNER_RADIUS = RING_THICKNESS * 0.08;

function polar(r, angle) {
  const a = angle - Math.PI / 2;
  return [r * Math.cos(a), r * Math.sin(a)];
}

// Same shape as wedgePath, but with each of the 4 corners rounded off using
// a quadratic bezier anchored at the original sharp corner as its control
// point — that guarantees the curve bows toward the corner (i.e. rounds it
// off correctly) regardless of which direction the path is winding, with no
// arc-sweep-direction bookkeeping needed.
export function roundedWedgePath(innerR, outerR, angleStart, angleEnd, cornerRadius = CORNER_RADIUS) {
  const angularSpan = angleEnd - angleStart;
  if (innerR <= 0.01) return roundedPieSlicePath(outerR, angleStart, angleEnd, cornerRadius);

  const cr = Math.min(cornerRadius, (angularSpan * outerR) / 2, (angularSpan * innerR) / 2, (outerR - innerR) / 2) - 0.5;
  if (cr < 1) return wedgePath(innerR, outerR, angleStart, angleEnd);

  const ao = cr / outerR;
  const ai = cr / innerR;
  const largeArcOuter = angleEnd - ao - (angleStart + ao) > Math.PI ? 1 : 0;
  const largeArcInner = angleEnd - ai - (angleStart + ai) > Math.PI ? 1 : 0;

  const cornerOuterStart = polar(outerR, angleStart);
  const cornerOuterEnd = polar(outerR, angleEnd);
  const cornerInnerStart = polar(innerR, angleStart);
  const cornerInnerEnd = polar(innerR, angleEnd);
  const outerArcStart = polar(outerR, angleStart + ao);
  const outerArcEnd = polar(outerR, angleEnd - ao);
  const innerArcStart = polar(innerR, angleStart + ai);
  const innerArcEnd = polar(innerR, angleEnd - ai);
  const radialStartOuter = polar(outerR - cr, angleStart);
  const radialStartInner = polar(innerR + cr, angleStart);
  const radialEndOuter = polar(outerR - cr, angleEnd);
  const radialEndInner = polar(innerR + cr, angleEnd);

  return [
    `M ${radialStartInner[0]} ${radialStartInner[1]}`,
    `L ${radialStartOuter[0]} ${radialStartOuter[1]}`,
    `Q ${cornerOuterStart[0]} ${cornerOuterStart[1]} ${outerArcStart[0]} ${outerArcStart[1]}`,
    `A ${outerR} ${outerR} 0 ${largeArcOuter} 1 ${outerArcEnd[0]} ${outerArcEnd[1]}`,
    `Q ${cornerOuterEnd[0]} ${cornerOuterEnd[1]} ${radialEndOuter[0]} ${radialEndOuter[1]}`,
    `L ${radialEndInner[0]} ${radialEndInner[1]}`,
    `Q ${cornerInnerEnd[0]} ${cornerInnerEnd[1]} ${innerArcEnd[0]} ${innerArcEnd[1]}`,
    `A ${innerR} ${innerR} 0 ${largeArcInner} 0 ${innerArcStart[0]} ${innerArcStart[1]}`,
    `Q ${cornerInnerStart[0]} ${cornerInnerStart[1]} ${radialStartInner[0]} ${radialStartInner[1]}`,
    "Z",
  ].join(" ");
}

// Ring-0 case: a pie slice from the very center. Only the 2 outer corners
// get rounded — the center point is shared by however many top-level
// wedges there are, so rounding it would just tear a gap open there.
function roundedPieSlicePath(outerR, angleStart, angleEnd, cornerRadius) {
  const angularSpan = angleEnd - angleStart;
  const cr = Math.min(cornerRadius, (angularSpan * outerR) / 2, outerR / 2) - 0.5;
  if (cr < 1) return wedgePath(0, outerR, angleStart, angleEnd);

  const ao = cr / outerR;
  const largeArc = angleEnd - ao - (angleStart + ao) > Math.PI ? 1 : 0;
  const cornerStart = polar(outerR, angleStart);
  const cornerEnd = polar(outerR, angleEnd);
  const arcStart = polar(outerR, angleStart + ao);
  const arcEnd = polar(outerR, angleEnd - ao);
  const radialStart = polar(outerR - cr, angleStart);
  const radialEnd = polar(outerR - cr, angleEnd);

  return [
    `M 0 0`,
    `L ${radialStart[0]} ${radialStart[1]}`,
    `Q ${cornerStart[0]} ${cornerStart[1]} ${arcStart[0]} ${arcStart[1]}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${arcEnd[0]} ${arcEnd[1]}`,
    `Q ${cornerEnd[0]} ${cornerEnd[1]} ${radialEnd[0]} ${radialEnd[1]}`,
    `L 0 0`,
    "Z",
  ].join(" ");
}

// true when a wedge centered at this angle sits on the lower half of the
// circle, where text would render upside down without correction.
export function isLowerHalf(midAngleRad) {
  const deg = ((midAngleRad * 180) / Math.PI) % 360;
  const normalized = (deg + 360) % 360;
  return normalized > 90 && normalized < 270;
}

// A bare curve (no fill) at a given radius, for binding curved text to via
// <textPath>. Traversed start->end normally, or reversed on the lower half
// of the circle so the bound text still reads left-to-right instead of
// upside down. `flipAngleOffset` (radians) shifts only the flip *decision*,
// not the geometry itself — for a wheel that's rotated as a whole via a CSS
// transform (SectionWheel's swipe-to-rotate), the wedge's own angle no
// longer matches where it actually lands on screen, so the caller passes
// its current rotation here to base the readability check on the real,
// on-screen angle. Desktop's PyramidWheel never rotates the wheel, so it
// just omits this and gets the exact old behavior.
export function labelArcPath(radius, angleStart, angleEnd, flipAngleOffset = 0) {
  const mid = (angleStart + angleEnd) / 2;
  const flip = isLowerHalf(mid + flipAngleOffset);
  const from = flip ? angleEnd : angleStart;
  const to = flip ? angleStart : angleEnd;
  const a0 = from - Math.PI / 2;
  const a1 = to - Math.PI / 2;
  const x0 = radius * Math.cos(a0), y0 = radius * Math.sin(a0);
  const x1 = radius * Math.cos(a1), y1 = radius * Math.sin(a1);
  const largeArc = Math.abs(angleEnd - angleStart) > Math.PI ? 1 : 0;
  const sweep = flip ? 0 : 1;
  return `M ${x0} ${y0} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${x1} ${y1}`;
}

// Placement for straight (non-curved) labels on narrow wedges: positioned
// mid-radius, rotated to run along the radius (outward from center) rather
// than around the ring. The upside-down check here is its own — it's keyed
// off this rotation's actual value, not the curved-arc case's, since the two
// point in different base directions (radial vs. tangential). Same
// `flipAngleOffset` escape hatch as labelArcPath, for the same reason.
export function radialLabelTransform(innerR, outerR, angleStart, angleEnd, flipAngleOffset = 0) {
  const screenAngle = (angleStart + angleEnd) / 2 - Math.PI / 2;
  const r = (innerR + outerR) / 2;
  const x = r * Math.cos(screenAngle);
  const y = r * Math.sin(screenAngle);
  let deg = (screenAngle * 180) / Math.PI;
  const effectiveDeg = deg + (flipAngleOffset * 180) / Math.PI;
  const normalized = ((effectiveDeg % 360) + 360) % 360;
  if (normalized > 90 && normalized < 270) deg += 180;
  return { x, y, rotateDeg: deg };
}
