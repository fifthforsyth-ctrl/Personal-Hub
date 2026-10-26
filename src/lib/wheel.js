// Sunburst geometry: concentric rings by depth, wedges by sibling position.
// Pure math, no DOM measurement needed — unlike the old card-based layout,
// a wedge's size is purely geometric (ring thickness x angular slice), never
// dependent on its content.

export const RING_THICKNESS = 130;
export const CENTER_RADIUS = 90; // radius of the ring-0 (root) hub
export const MIN_LABEL_ANGLE = (4 * Math.PI) / 180; // the least a hovered wedge grows to, so it can show a title

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
//
// `weights` (Map<id, number>), if given, gives those goals that many times
// their equal share of their parent's span — the phone dial narrows the
// section facing up so it can be drawn tall enough to read.
export function computeWheel(nodes, edges, centerNodeId, hover, weights) {
  const { hoveredId = null, growFactor = 1.08, minAngleFn = () => 0 } = hover ?? {};
  const shares = (ids, total) => {
    if (!weights) return ids.map(() => total / ids.length);
    const w = ids.map((id) => weights.get(id) ?? 1);
    const sum = w.reduce((a, b) => a + b, 0);
    return w.map((x) => (total * x) / sum);
  };
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

    let cursor = angleStart;
    shares(kids, totalSpan).forEach((width, i) => {
      place(kids[i], ring + 1, cursor, cursor + width, id);
      cursor += width;
    });
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
      let cursor = 0;
      shares(roots.map((r) => r.id), Math.PI * 2).forEach((width, i) => {
        place(roots[i].id, 1, cursor, cursor + width, null);
        cursor += width;
      });
    }
  }

  let maxRing = 0;
  for (const v of layout.values()) maxRing = Math.max(maxRing, v.ringIndex);

  return { layout, maxRing, hasVirtualHub };
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

// The outline of any placed wedge. A goal that fills its whole ring (an
// only child of the center) is an annulus — drawn even-odd so it doesn't
// paint over the disc inside it.
export function wedgeOutline(ringIndex, angleStart, angleEnd) {
  const { inner, outer } = ringRadii(ringIndex);
  if (angleEnd - angleStart >= Math.PI * 2 - 1e-3) {
    const circle = (r) => `M ${r} 0 A ${r} ${r} 0 1 1 ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0 Z`;
    return { d: inner > 0.01 ? `${circle(outer)} ${circle(inner)}` : circle(outer), fillRule: "evenodd" };
  }
  return { d: roundedWedgePath(inner, outer, angleStart, angleEnd), fillRule: undefined };
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

// ---------------------------------------------------------------------------
// Labels. Both wheels draw titles the same way, so the fitting rules live
// here once: how big, curved or straight, how many lines, in what order,
// and whether there's room to draw one at all.
// ---------------------------------------------------------------------------

// Smallest a title may be on screen. A wedge that can't hold one this big
// shows none; its title is in the wedge's tooltip and in the goal panel.
export const LABEL_MIN_PX = 10;

const CHAR_EM = 0.58; // average glyph width of the bold label face
const LINE_EM = 1.15;
const BASELINE_EM = 0.35; // from a line's baseline to the middle of its letters
const PAD = 10; // clear space kept at each end of a line

// Scales with how big the wedge reads (its arc length at mid-radius),
// square-rooted so a giant root wedge gets a bigger label than a sliver
// three rings out without the range turning extreme.
export function labelFontSize(arcLength) {
  return Math.min(22, Math.max(10, 15 * Math.sqrt(Math.max(0, arcLength) / 200)));
}

// Greedy word wrap into at most `maxLines` lines of `maxChars`. When the
// title doesn't fit, the last line ends in "…" and `complete` is false.
export function wrapWords(text, maxChars, maxLines) {
  const width = Math.floor(maxChars);
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [], complete: true };
  if (width < 2 || maxLines < 1) return { lines: [], complete: false };
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) {
      current = candidate;
    } else if (current && lines.length < maxLines - 1 && word.length <= width) {
      lines.push(current);
      current = word;
    } else {
      lines.push(candidate.slice(0, width - 1).trimEnd() + "…");
      return { lines, complete: false };
    }
  }
  lines.push(current);
  return { lines, complete: true };
}

// The fewest lines (up to maxLines) the title wraps into completely, where
// `charsFor(n)` is how many characters fit on a line when there are n of
// them. Falls back to the most lines, cut short.
function wrapInto(title, maxLines, charsFor) {
  let best = null;
  for (let n = 1; n <= maxLines; n++) {
    const chars = charsFor(n);
    if (chars < Math.min(4, title.length)) break;
    best = wrapWords(title, chars, n);
    if (best.complete) break;
  }
  return best?.lines.length ? best : null;
}

// How to draw a wedge's title at `fontSize`, or null when it doesn't fit.
//   curved: lines along the ring, { text, d } — d is the arc a <textPath> follows
//   radial: straight lines along the radius, { text, x, y, rotate }
//   flat:   level lines across the center disc, { text, x, y, rotate }
// Line one always reads first: on the upper half of a curved label that's
// the outermost arc, on the lower half (where the text is turned to stay
// upright) the innermost; a radial label stacks along its own "down".
// `flipOffset` is how far the whole wheel is turned on screen (radians), so
// "upright" means upright where the wedge actually is.
export function fitLabel(title, { inner, outer, angleStart, angleEnd }, fontSize, curved, flipOffset = 0) {
  const text = String(title ?? "").trim();
  if (!text) return null;
  const lineHeight = fontSize * LINE_EM;
  const charWidth = fontSize * CHAR_EM;
  const span = angleEnd - angleStart;

  if (inner < 1) {
    // The center disc: level lines, as many as the circle has room for.
    const fit = wrapInto(text, 3, (n) => {
      const halfHeight = ((n - 1) / 2) * lineHeight + fontSize / 2;
      if (halfHeight >= outer) return 0;
      return (2 * Math.sqrt(outer * outer - halfHeight * halfHeight) - 2 * PAD) / charWidth;
    });
    if (!fit) return null;
    const n = fit.lines.length;
    const turn = -flipOffset; // stays level however the wheel is turned
    const lines = fit.lines.map((line, i) => {
      const offset = (i - (n - 1) / 2) * lineHeight;
      return { text: line, x: offset * Math.sin(flipOffset), y: offset * Math.cos(flipOffset), rotate: (turn * 180) / Math.PI };
    });
    return { kind: "flat", fontSize, complete: fit.complete, lines };
  }

  // No angle cut-off: a thin wedge far out (or on the zoomed phone dial) can
  // still have room for a line, and the room checks below decide.
  if (!(span > 0)) return null;
  const mid = (inner + outer) / 2;

  if (curved) {
    // A whole ring has no ends to center between, so its title runs across the top.
    const full = span >= Math.PI * 2 - 1e-3;
    const a0 = full ? -Math.PI * 0.8 : angleStart;
    const a1 = full ? Math.PI * 0.8 : angleEnd;
    const maxLines = Math.min(3, Math.floor((outer - inner - 8 - fontSize) / lineHeight) + 1);
    const fit = wrapInto(text, maxLines, (n) => ((a1 - a0) * (mid - ((n - 1) / 2) * lineHeight) - 2 * PAD) / charWidth);
    if (!fit) return null;
    const flip = isLowerHalf((a0 + a1) / 2 + flipOffset);
    const n = fit.lines.length;
    const lines = fit.lines.map((line, i) => {
      const slot = flip ? i : n - 1 - i;
      const r = mid + (slot - (n - 1) / 2) * lineHeight + (flip ? 1 : -1) * BASELINE_EM * fontSize;
      return { text: line, d: labelArcPath(r, a0, a1, flipOffset) };
    });
    return { kind: "curved", fontSize, complete: fit.complete, lines };
  }

  // Radial: the text runs out along the radius, so its length is the ring's
  // thickness and its line count is however many fit side by side where the
  // wedge is narrowest.
  const room = span * (inner + PAD);
  const maxLines = Math.min(2, Math.floor((room - fontSize) / lineHeight) + 1);
  if (maxLines < 1) return null;
  const chars = (outer - inner - 2 * PAD) / charWidth;
  const fit = wrapInto(text, maxLines, () => chars);
  if (!fit) return null;
  const { x, y, rotateDeg } = radialLabelTransform(inner, outer, angleStart, angleEnd, flipOffset);
  const rot = (rotateDeg * Math.PI) / 180;
  const n = fit.lines.length;
  const lines = fit.lines.map((line, i) => {
    const offset = (i - (n - 1) / 2) * lineHeight;
    return { text: line, x: x - Math.sin(rot) * offset, y: y + Math.cos(rot) * offset, rotate: rotateDeg };
  });
  return { kind: "radial", fontSize, complete: fit.complete, lines };
}

// A placed wedge's label size in wheel units: what its arc calls for, but
// never under LABEL_MIN_PX on screen at `scale` (screen px per wheel unit).
export function labelFontFor(pos, scale) {
  const { inner, outer } = ringRadii(pos.ringIndex);
  const natural = labelFontSize((pos.angleEnd - pos.angleStart) * ((inner + outer) / 2));
  return Math.max(natural, LABEL_MIN_PX / Math.max(scale, 0.01));
}

function wedgeGeometry(pos) {
  return { ...ringRadii(pos.ringIndex), angleStart: pos.angleStart, angleEnd: pos.angleEnd };
}

const groupKey = (pos) => pos.parentId ?? "__root__";

// Siblings share one orientation — curved when every one of them fits on
// two lines or fewer along its arc, otherwise radial — so a fan of children
// never reads as a jumble of directions. Keyed by parent id.
export function labelOrientations(layout, titleById, scale, flipOffset = 0) {
  const curved = new Map();
  for (const [id, pos] of layout.entries()) {
    const key = groupKey(pos);
    if (curved.get(key) === false) continue;
    const fit = fitLabel(titleById.get(id) ?? "", wedgeGeometry(pos), labelFontFor(pos, scale), true, flipOffset);
    curved.set(key, Boolean(fit && fit.complete && fit.lines.length <= 2));
  }
  return curved;
}

export function isCurvedLabel(orientations, pos) {
  return orientations.get(groupKey(pos)) ?? true;
}

// Every wedge's label for one frame of a wheel, as a Map of id -> fitLabel
// result (wedges with no room are left out). Pass `orientations` from a
// steadier layout when this one is in motion, as under a hover, so labels
// don't flip direction mid-gesture.
export function layoutLabels(layout, titleById, scale, { flipOffset = 0, orientations } = {}) {
  const orient = orientations ?? labelOrientations(layout, titleById, scale, flipOffset);
  const labels = new Map();
  for (const [id, pos] of layout.entries()) {
    const label = fitLabel(titleById.get(id) ?? "", wedgeGeometry(pos), labelFontFor(pos, scale), isCurvedLabel(orient, pos), flipOffset);
    if (label) labels.set(id, label);
  }
  return labels;
}

// The narrowest a wedge can be and still show a few letters of its title —
// how far a hovered sliver grows.
export function minLabelSpan(title, ringIndex, fontSize, curved) {
  const { inner, outer } = ringRadii(ringIndex);
  if (curved) return (Math.min(String(title ?? "").length, 8) * fontSize * CHAR_EM + 2 * PAD) / ((inner + outer) / 2);
  return Math.max(MIN_LABEL_ANGLE, (fontSize * 1.1) / (inner + PAD));
}

// ---------------------------------------------------------------------------
// Tree helpers for pickers and forms.
// ---------------------------------------------------------------------------

// The parent each goal is drawn under (its first edge), as a Map.
export function firstParents(edges) {
  const parentOf = new Map();
  for (const e of edges) if (!parentOf.has(e.child_id)) parentOf.set(e.child_id, e.parent_id);
  return parentOf;
}

// Every goal with its path ("In tune with God › Prayer › Morning prayer"),
// the shape GoalPicker takes. Titles repeat across the tree; paths don't.
export function goalPaths(nodes, edges) {
  const parentOf = firstParents(edges);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return nodes
    .map((n) => {
      const parts = [n.title];
      const seen = new Set([n.id]);
      let cur = n.id;
      while (parentOf.has(cur)) {
        cur = parentOf.get(cur);
        if (seen.has(cur) || !byId.has(cur)) break;
        seen.add(cur);
        parts.unshift(byId.get(cur).title);
      }
      return { id: n.id, title: n.title, path: parts.join(" › "), depth: parts.length - 1, is_focused: Boolean(n.is_focused) };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

// A goal and everything under it, by any edge — what it can't be moved under.
export function subtreeIds(edges, rootId) {
  const kids = new Map();
  for (const e of edges) {
    if (!kids.has(e.parent_id)) kids.set(e.parent_id, []);
    kids.get(e.parent_id).push(e.child_id);
  }
  const out = new Set([rootId]);
  const stack = [rootId];
  while (stack.length) {
    for (const k of kids.get(stack.pop()) ?? []) {
      if (!out.has(k)) {
        out.add(k);
        stack.push(k);
      }
    }
  }
  return out;
}
