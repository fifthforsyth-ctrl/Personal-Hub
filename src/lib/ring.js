// The day as a clock face.
//
// Midnight sits at the top, noon at the bottom, and the hours run clockwise
// — so the morning is the right-hand side of the ring and the evening the
// left, the way a wall clock reads if you let one revolution be a whole day
// instead of half of one.
//
// Two things make a real day awkward to draw this way, and both are handled
// here rather than in the component:
//
//   Entries overlap. Time is tracked with several tags at once and one
//   activity often sits inside another — a twenty-minute call during a
//   three-hour edit. A ring has one colour per moment, so a contested minute
//   goes to the SHORTEST entry covering it, on the grounds that the more
//   specific claim is the truer description of that minute.
//
//   Entries cross midnight. Sleep always does. The database splits them at
//   the day boundary, which leaves a night as an arc at the end of one ring
//   and another at the start of the next; both are drawn, and because they
//   meet exactly at the top of the circle they read as continuous.

export const SLOT_MINUTES = 5;
export const SLOTS = 1440 / SLOT_MINUTES;

// Raw arcs from day_rings -> a clean, non-overlapping sequence around the
// face. Categories, not entries: two consecutive entries of the same kind
// become one arc, which is what stops a ring being a barcode.
export function resolveRing(arcs, slotMinutes = SLOT_MINUTES) {
  const slots = 1440 / slotMinutes;
  const painted = new Array(slots).fill(null);

  // Longest first so the shortest is painted last and wins the overlap.
  // Ties are broken by name so the same day always draws the same way —
  // two entries can cover exactly the same span (a night logged as both
  // Sleep and Prep), and "whichever the database happened to return first"
  // is not an acceptable answer to what colour last night was.
  const byLength = [...(arcs ?? [])].sort((a, b) => {
    const byLen = b.end_min - b.start_min - (a.end_min - a.start_min);
    if (byLen !== 0) return byLen;
    const an = a.category ?? a.tags?.[0] ?? "";
    const bn = b.category ?? b.tags?.[0] ?? "";
    return an < bn ? -1 : an > bn ? 1 : 0;
  });

  for (const arc of byLength) {
    const category = arc.category ?? arc.tags?.[0];
    if (!category) continue;
    const from = Math.max(0, Math.floor(arc.start_min / slotMinutes));
    const to = Math.min(slots, Math.ceil(arc.end_min / slotMinutes));
    for (let i = from; i < to; i++) painted[i] = category;
  }

  const out = [];
  let i = 0;
  while (i < slots) {
    if (painted[i] === null) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < slots && painted[j] === painted[i]) j += 1;
    out.push({ category: painted[i], start_min: i * slotMinutes, end_min: j * slotMinutes });
    i = j;
  }
  return out;
}

// How much of the face is painted at all, 0..1 — the honest version of "how
// much of this day did you actually account for".
export function ringCoverage(segments) {
  const covered = (segments ?? []).reduce((sum, s) => sum + (s.end_min - s.start_min), 0);
  return Math.min(1, covered / 1440);
}

// Minutes past midnight -> a point on a circle, midnight at the top and the
// clock running forwards (which is clockwise, since SVG's y grows downward).
export function pointAt(cx, cy, radius, minutes) {
  const angle = (minutes / 1440) * 2 * Math.PI - Math.PI / 2;
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

// One donut segment as an SVG path. A segment covering the whole day has no
// endpoints to draw between, so the caller is told to use a plain ring
// instead of a path that would collapse to nothing.
export function arcPath(cx, cy, outerR, innerR, startMin, endMin) {
  const span = endMin - startMin;
  if (span <= 0) return null;
  if (span >= 1440) return null; // full circle — draw two circles, not an arc

  const [ox1, oy1] = pointAt(cx, cy, outerR, startMin);
  const [ox2, oy2] = pointAt(cx, cy, outerR, endMin);
  const [ix2, iy2] = pointAt(cx, cy, innerR, endMin);
  const [ix1, iy1] = pointAt(cx, cy, innerR, startMin);
  const large = span > 720 ? 1 : 0;

  return [
    `M ${ox1.toFixed(2)} ${oy1.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${ox2.toFixed(2)} ${oy2.toFixed(2)}`,
    `L ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export function fmtClock(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const suffix = h24 >= 12 ? "pm" : "am";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm}${suffix}`;
}
