// Visual language for the goal-tree wheel — hue by ring depth, brightness by
// recency, accent focus rim, neutral hover rim.
//
// One sequential ramp, deep and cool at the center easing to the app's coral
// accent at the rim. "Let your light so shine" (Matt. 5:16): the center
// (identity, formed inwardly) is dim and deep; the outer rings (today's
// actions) are where it breaks into light. Because it is a single ramp rather
// than a set of hues, depth reads as depth — nothing here is trying to tell
// two goals apart by colour.

export const TRACKING_LABEL = {
  checkbox: "Tracked by checkbox",
  counter: "Tracked by counter",
  note: "Tracked by note",
};

export const FOCUS_COLOR = "#f26a1b";
export const FOCUS_RING = "0 0 0 3px #f26a1b, 0 0 16px rgba(242, 106, 27, 0.35)";
export const HOVER_COLOR = "#141414";

// A page-coloured, hue-independent divider — visible against any fill color.
export const WEDGE_SEPARATOR = "#ffffff";

const INK = [0x14, 0x14, 0x14];
const WHITE = [0xff, 0xff, 0xff];

const RING_STOPS = [
  { t: 0.0, rgb: [0x2b, 0x24, 0x38] }, // deep violet-grey — identity/character
  { t: 0.35, rgb: [0x5a, 0x27, 0x38] }, // maroon
  { t: 0.68, rgb: [0xa8, 0x3c, 0x2f] }, // ember
  { t: 1.0, rgb: [0xff, 0x7a, 0x5c] }, // coral — daily action
];
const HUE_RINGS = 6; // depth at which the ramp settles into its outermost color

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function rampAt(stops, t) {
  const clamped = Math.min(1, Math.max(0, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (clamped >= a.t && clamped <= b.t) {
      const local = b.t === a.t ? 0 : (clamped - a.t) / (b.t - a.t);
      return [0, 1, 2].map((j) => lerp(a.rgb[j], b.rgb[j], local));
    }
  }
  return stops[stops.length - 1].rgb;
}

// Hex color for a given ring depth (0 = center), walking the multi-stop
// gradient above rather than sweeping a raw hue wheel (which would cross
// straight through an off-brand green between indigo and gold).
export function ringHue(ringIndex) {
  return rgbToHex(rampAt(RING_STOPS, Math.max(0, ringIndex) / HUE_RINGS));
}

// The colour a translucent fill actually shows on the white page — what
// the label has to be read against.
function overWhite(rgb, alpha) {
  return rgb.map((c) => Math.round(c * alpha + 255 * (1 - alpha)));
}

// WCAG relative luminance and contrast ratio.
function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Ink or white, whichever reads better on this background. Every fill the
// wheel and the ramps use clears 4.5:1 with one of them; the mid-tones that
// come closest still pick the stronger of the two.
export function labelColorOn(rgb) {
  return contrast(rgb, INK) >= contrast(rgb, WHITE) ? "#141414" : "#ffffff";
}

// Used by the wedge detail panel (a regular HTML card) — keyed by the
// discrete recency tier since that's just describing the one selected
// node's own state.
export function getNodeVisual(ringIndex, tier) {
  const hueRgb = rampAt(RING_STOPS, Math.max(0, ringIndex) / HUE_RINGS);
  const fillAlpha = { dull: 0.1, medium: 0.42, bright: 0.9 }[tier] ?? 0.1;
  const background = overWhite(hueRgb, fillAlpha);
  return {
    hue: rgbToHex(hueRgb),
    tier,
    background: rgbToHex(background),
    border: rgbToHex(overWhite(hueRgb, 0.5)),
    text: labelColorOn(background),
  };
}

// Used by the sunburst wedges. `brightness` is the continuous 0..1 value
// from computeAllBrightness — fill scales smoothly with it instead of
// snapping between fixed buckets. The fill is solid (already blended over
// white) so the label colour is chosen against exactly what's on screen.
export function getWedgeVisual(ringIndex, brightness) {
  const hueRgb = rampAt(RING_STOPS, Math.max(0, ringIndex) / HUE_RINGS);
  const fill = overWhite(hueRgb, 0.08 + Math.min(1, Math.max(0, brightness)) * 0.85);
  return {
    fill: rgbToHex(fill),
    stroke: WEDGE_SEPARATOR,
    strokeWidth: 2,
    labelColor: labelColorOn(fill),
  };
}

// ---------------------------------------------------------------------------
// Day intensity — the Year view.
//
// Light on a light page: a quiet day is barely off the card, a full one is
// the app's orange. (The old ramp ran from near-black to coral, which on
// white made the quietest days the darkest thing on screen.)
export const INTENSITY_STOPS_HEX = ["#f1f0ed", "#fbd9c3", "#f59a5c", "#f26a1b"];
const INTENSITY_STOPS = INTENSITY_STOPS_HEX.map((hex, i, all) => ({ t: i / (all.length - 1), rgb: hexToRgb(hex) }));

// Nothing at all is the grey of an empty cell; anything above nothing starts
// a quarter of the way up, at a visible peach. Otherwise a lightly used day
// came out the same grey as an empty one.
function intensityPoint(t) {
  const v = Math.min(1, Math.max(0, Number(t) || 0));
  return v > 0 ? 0.25 + 0.75 * v : 0;
}

export function intensityColor(t) {
  return rgbToHex(rampAt(INTENSITY_STOPS, intensityPoint(t)));
}

// Every step of the light ramp takes ink text (even the full orange clears
// 5:1 with it); kept as a function so callers don't have to know that.
export function intensityTextColor(t) {
  return labelColorOn(rampAt(INTENSITY_STOPS, intensityPoint(t)));
}

function rgbToHex([r, g, b]) {
  const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
