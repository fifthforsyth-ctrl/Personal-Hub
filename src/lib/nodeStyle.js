// Visual language for the goal-tree wheel — same mechanic as Symposium's
// (hue by ring depth, brightness by recency, gold focus rim, neutral hover
// rim) but its own palette: deep indigo at the center easing through plum
// to warm gold at the rim, rather than Symposium's purple-to-blue hiking
// ramp. "Let your light so shine" (Matt. 5:16) — the center (identity,
// formed inwardly) is dim and deep; the outer rings (today's actions) are
// where it breaks into light. Same gradient the app icon uses.

export const TRACKING_LABEL = {
  checkbox: "Checkbox",
  counter: "Counter",
  note: "Note",
};

export const FOCUS_COLOR = "#f0b23c";
export const FOCUS_RING = "0 0 0 3px #f0b23c, 0 0 16px rgba(240, 178, 60, 0.5)";
export const HOVER_COLOR = "#f3efe8";

// A dark, hue-independent divider — visible against any fill color.
export const WEDGE_SEPARATOR = "#050408";

const RING_STOPS = [
  { t: 0.0, rgb: [0x2a, 0x1f, 0x52] }, // indigo — identity/character
  { t: 0.35, rgb: [0x54, 0x2a, 0x54] }, // plum
  { t: 0.68, rgb: [0xa8, 0x55, 0x3a] }, // ember
  { t: 1.0, rgb: [0xf0, 0xb2, 0x3c] }, // gold — daily action
];
const HUE_RINGS = 6; // depth at which the ramp settles into its outermost color

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

// Hex color for a given ring depth (0 = center), walking the multi-stop
// gradient above rather than sweeping a raw hue wheel (which would cross
// straight through an off-brand green between indigo and gold).
export function ringHue(ringIndex) {
  const t = Math.min(1, Math.max(0, ringIndex) / HUE_RINGS);
  for (let i = 0; i < RING_STOPS.length - 1; i++) {
    const a = RING_STOPS[i];
    const b = RING_STOPS[i + 1];
    if (t >= a.t && t <= b.t) {
      const local = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
      const rgb = [0, 1, 2].map((j) => lerp(a.rgb[j], b.rgb[j], local));
      return rgbToHex(rgb);
    }
  }
  return rgbToHex(RING_STOPS[RING_STOPS.length - 1].rgb);
}

// Used by the wedge detail panel (a regular HTML card) — keyed by the
// discrete recency tier since that's just describing the one selected
// node's own state.
export function getNodeVisual(ringIndex, tier) {
  const hue = ringHue(ringIndex);
  const fillAlpha = { dull: 0.1, medium: 0.42, bright: 0.9 }[tier] ?? 0.1;
  const textIsDark = tier === "bright";
  const glowAlpha = { dull: 0, medium: 0.22, bright: 0.45 }[tier] ?? 0;

  return {
    hue,
    tier,
    background: withAlpha(hue, fillAlpha),
    border: withAlpha(hue, 0.5),
    text: textIsDark ? "#0d0906" : "#f3efe8",
    textShadow: textIsDark ? "none" : "0 1px 3px rgba(0,0,0,0.6)",
    glow: glowAlpha > 0 ? `0 0 0 1px ${withAlpha(hue, 0.6)}, 0 0 20px ${withAlpha(hue, glowAlpha)}` : "none",
  };
}

// Used by the sunburst wedges. `brightness` is the continuous 0..1 value
// from computeAllBrightness — fill scales smoothly with it instead of
// snapping between fixed buckets.
export function getWedgeVisual(ringIndex, brightness) {
  const hue = ringHue(ringIndex);
  const fillAlpha = 0.08 + brightness * 0.85;
  return {
    fill: withAlpha(hue, fillAlpha),
    stroke: WEDGE_SEPARATOR,
    strokeWidth: 2,
    labelColor: fillAlpha >= 0.55 ? "#0d0906" : "#f3efe8",
    glowFilter: brightness >= 0.7 ? "url(#wedge-glow)" : "none",
  };
}

// ---------------------------------------------------------------------------
// Planner day intensity — the month/year grids' fill color.
//
// Same idea as the wheel's ring ramp, and deliberately the same family of
// colors, so both halves of the app say "how lit up is this" the same way.
// It's a designed multi-stop ramp rather than one amber at varying alpha:
// alpha-blending gold over a near-black surface lands in muddy khaki
// through the whole middle of the range, which is exactly where most real
// days live. Cool and deep when quiet, warm and bright when full.
const INTENSITY_STOPS = [
  { t: 0.0, rgb: [0x18, 0x14, 0x22] }, // barely above the inset surface
  { t: 0.35, rgb: [0x4a, 0x2a, 0x55] }, // plum
  { t: 0.7, rgb: [0xa8, 0x55, 0x3a] }, // ember
  { t: 1.0, rgb: [0xf0, 0xb2, 0x3c] }, // gold
];

export function intensityColor(t) {
  const clamped = Math.min(1, Math.max(0, t));
  for (let i = 0; i < INTENSITY_STOPS.length - 1; i++) {
    const a = INTENSITY_STOPS[i];
    const b = INTENSITY_STOPS[i + 1];
    if (clamped >= a.t && clamped <= b.t) {
      const local = b.t === a.t ? 0 : (clamped - a.t) / (b.t - a.t);
      return rgbToHex([0, 1, 2].map((j) => lerp(a.rgb[j], b.rgb[j], local)));
    }
  }
  return rgbToHex(INTENSITY_STOPS[INTENSITY_STOPS.length - 1].rgb);
}

// Only the gold end of the ramp is light enough to need dark text; the
// threshold sits past the ember stop so neighboring days don't flip back
// and forth across it.
export function intensityTextColor(t) {
  return t >= 0.82 ? "#180f00" : "#f3efe8";
}

function rgbToHex([r, g, b]) {
  const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function withAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
