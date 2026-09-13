// The day as a clock face.
//
// The face covers the waking day — 5am at the top-right of a small gap,
// running clockwise round to 10pm at the top-left — rather than a full
// twenty-four hours. A 24-hour dial spends a third of its circumference on
// sleep, which is one flat arc carrying no information, and squeezes
// everything you actually did into the remaining two thirds. Cutting the
// night out gives those seventeen hours the whole circle.
//
// The gap at the top is doing real work: it keeps the start and the end of
// the day from meeting, so a ring is never ambiguous about which way round
// it reads.
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
//   Entries fall outside the window. Anything before 5am or after 10pm is
//   clipped, and an entry straddling either edge keeps only the part inside.
//   Sleep that runs past 5am still shows, and so it should: waking at seven
//   is a fact about the day, not about the night.

export const DAY_START_MIN = 5 * 60; // 05:00
export const DAY_END_MIN = 22 * 60; // 22:00
export const WINDOW_MINUTES = DAY_END_MIN - DAY_START_MIN;

export const SLOT_MINUTES = 5;

// Degrees of blank left at twelve o'clock, between the end of the day and
// the start of the next one.
const GAP_DEGREES = 22;
const SWEEP_DEGREES = 360 - GAP_DEGREES;

// Raw arcs from day_rings -> a clean, non-overlapping sequence around the
// face, clipped to the waking window. Categories, not entries: two
// consecutive entries of the same kind become one arc, which is what stops a
// ring being a barcode.
export function resolveRing(arcs, slotMinutes = SLOT_MINUTES) {
  const slots = Math.round(WINDOW_MINUTES / slotMinutes);
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
    const clippedStart = Math.max(arc.start_min, DAY_START_MIN);
    const clippedEnd = Math.min(arc.end_min, DAY_END_MIN);
    if (clippedEnd <= clippedStart) continue;
    const from = Math.max(0, Math.floor((clippedStart - DAY_START_MIN) / slotMinutes));
    const to = Math.min(slots, Math.ceil((clippedEnd - DAY_START_MIN) / slotMinutes));
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
    out.push({
      category: painted[i],
      start_min: DAY_START_MIN + i * slotMinutes,
      end_min: DAY_START_MIN + j * slotMinutes,
    });
    i = j;
  }
  return out;
}

// How much of the waking day is painted at all, 0..1 — the honest version of
// "how much of this day did you actually account for".
export function ringCoverage(segments) {
  const covered = (segments ?? []).reduce((sum, s) => sum + (s.end_min - s.start_min), 0);
  return Math.min(1, covered / WINDOW_MINUTES);
}

function angleFor(minutes) {
  const t = (minutes - DAY_START_MIN) / WINDOW_MINUTES;
  const degrees = -90 + GAP_DEGREES / 2 + t * SWEEP_DEGREES;
  return (degrees * Math.PI) / 180;
}

// Minutes past midnight -> a point on the face. The day starts just
// clockwise of twelve o'clock and ends just anticlockwise of it.
export function pointAt(cx, cy, radius, minutes) {
  const angle = angleFor(minutes);
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

// One donut segment as an SVG path.
export function arcPath(cx, cy, outerR, innerR, startMin, endMin) {
  const span = Math.min(endMin, DAY_END_MIN) - Math.max(startMin, DAY_START_MIN);
  if (span <= 0) return null;

  const from = Math.max(startMin, DAY_START_MIN);
  const to = Math.min(endMin, DAY_END_MIN);

  const [ox1, oy1] = pointAt(cx, cy, outerR, from);
  const [ox2, oy2] = pointAt(cx, cy, outerR, to);
  const [ix2, iy2] = pointAt(cx, cy, innerR, to);
  const [ix1, iy1] = pointAt(cx, cy, innerR, from);
  const large = (span / WINDOW_MINUTES) * SWEEP_DEGREES > 180 ? 1 : 0;

  return [
    `M ${ox1.toFixed(2)} ${oy1.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${ox2.toFixed(2)} ${oy2.toFixed(2)}`,
    `L ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
    "Z",
  ].join(" ");
}

// The whole waking day as one background arc, for the unaccounted ground
// underneath the segments.
export function windowPath(cx, cy, outerR, innerR) {
  return arcPath(cx, cy, outerR, innerR, DAY_START_MIN, DAY_END_MIN);
}

// Where the hour marks go. Every three hours from 6am, which lands on the
// round numbers without crowding a small ring.
export const TICK_MINUTES = [6, 9, 12, 15, 18, 21].map((h) => h * 60);

export function fmtClock(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const suffix = h24 >= 12 ? "pm" : "am";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm}${suffix}`;
}

export function fmtHourShort(minutes) {
  const h24 = Math.floor(minutes / 60);
  const suffix = h24 >= 12 ? "p" : "a";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${suffix}`;
}
