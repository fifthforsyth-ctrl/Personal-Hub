// The planner's arithmetic: where a block sits on the half-hour grid, how
// blocks that share an hour sit side by side, and the few colours a block
// can wear. Pure, so it's tested (scripts/test.mjs) and shared by the day,
// the week and the month.

// --- Colours ---------------------------------------------------------------

// The colours you can give a block. Few, quiet and named, so a week reads at
// a glance: you pick what each colour means, nothing assigns it for you.
// "plain" is the default and what every block wears until you choose.
export const BLOCK_COLORS = [
  { key: "plain", name: "Plain", hex: "#9c978f" },
  { key: "ink", name: "Ink", hex: "#141414" },
  { key: "orange", name: "Orange", hex: "#f26a1b" },
  { key: "sand", name: "Sand", hex: "#c49a5a" },
  { key: "olive", name: "Olive", hex: "#7f8a4a" },
  { key: "sage", name: "Sage", hex: "#5e8a72" },
  { key: "slate", name: "Slate", hex: "#4d6a88" },
  { key: "steel", name: "Steel", hex: "#8794a2" },
  { key: "plum", name: "Plum", hex: "#7a5878" },
  { key: "brick", name: "Brick", hex: "#a2483a" },
];

const BY_KEY = new Map(BLOCK_COLORS.map((c) => [c.key, c]));

// Whatever is saved, a block always has a colour to draw with: an unknown or
// empty one is plain.
export function colorOf(key) {
  return BY_KEY.get(key) ?? BY_KEY.get("plain");
}

// What gets written: null for plain, so "no colour chosen" stays the default
// in the database too.
export function colorValue(key) {
  return key && key !== "plain" && BY_KEY.has(key) ? key : null;
}

// The inline style a block is drawn with. Ink is solid with white words, like
// the app's black pill; the rest are a soft wash of the colour with a solid
// edge, so the words stay dark and readable on every one.
export function blockStyle(key) {
  const c = colorOf(key);
  if (c.key === "ink") return { "--blk": c.hex, "--blk-bg": c.hex, "--blk-fg": "#ffffff", "--blk-fg2": "rgba(255,255,255,0.72)" };
  return { "--blk": c.hex, "--blk-bg": tint(c.hex, c.key === "plain" ? 0.2 : 0.18), "--blk-fg": "#121212", "--blk-fg2": "#5f5d59" };
}

// The colour laid over white at `alpha`, as a solid colour, so grid lines
// never show through a block.
export function tint(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(255 - (255 - c) * alpha);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

// --- Time ------------------------------------------------------------------

export const SLOT = 30; // minutes in one grid row
export const SNAP = 15; // minutes a drag moves in
export const DAY_END = 24 * 60;

export function toMin(t) {
  if (t == null) return 0;
  const [h, m] = String(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// 24:00 is written 23:59, the last minute a time column can hold.
export function toTime(min) {
  const m = Math.max(0, Math.min(DAY_END - 1, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// "4:30", "12 PM" style labels for the grid's edge.
export function hourLabel(min) {
  const h = Math.floor(min / 60) % 24;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${suffix}`;
}

// A short label for a time: "4:30a", "12p".
export function shortTime(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h >= 12 ? "p" : "a"}`;
}

export function snap(min, step = SNAP) {
  return Math.round(min / step) * step;
}

// Where a block sits in the day, in minutes. A block that runs past midnight
// (ends before it starts) is drawn to the end of its own day. A block whose
// end is 23:59 counts as running to midnight.
export function spanOf(chunk) {
  const start = toMin(chunk.start_time);
  let end = toMin(chunk.end_time);
  if (end === DAY_END - 1) end = DAY_END;
  const overnight = end <= start;
  return { start, end: overnight ? DAY_END : end, overnight };
}

// The part of the day the grid shows: from the earliest block (or 6 AM) to
// the latest (or 10 PM), whole hours, so the empty time around a day is on
// screen and its open blocks can be seen and tapped. `full` shows all 24.
export function gridRange(chunks, { full = false, from = 6 * 60, to = 22 * 60 } = {}) {
  if (full) return { start: 0, end: DAY_END };
  let start = from;
  let end = to;
  for (const c of chunks) {
    const s = spanOf(c);
    start = Math.min(start, s.start);
    end = Math.max(end, s.end);
  }
  start = Math.max(0, Math.floor(start / 60) * 60);
  end = Math.min(DAY_END, Math.ceil(end / 60) * 60);
  return { start, end };
}

// Blocks that share time sit side by side: each gets a column and the count
// of columns in its cluster (a run of blocks that overlap one another).
// Sorted by start, then the longer one first.
export function layoutDay(chunks) {
  const items = chunks
    .map((c) => ({ chunk: c, ...spanOf(c) }))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  let cluster = [];
  let clusterEnd = -1;
  const close = () => {
    const cols = Math.max(1, ...cluster.map((x) => x.col + 1));
    for (const x of cluster) out.push({ ...x, cols });
    cluster = [];
  };
  for (const it of items) {
    if (cluster.length && it.start >= clusterEnd) close();
    const taken = new Set(cluster.filter((x) => x.end > it.start).map((x) => x.col));
    let col = 0;
    while (taken.has(col)) col++;
    cluster.push({ ...it, col });
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  if (cluster.length) close();
  return out;
}

// The open stretches between blocks inside a range, for "what's free".
export function openStretches(chunks, range, min = SLOT) {
  const spans = chunks.map(spanOf).sort((a, b) => a.start - b.start);
  const out = [];
  let at = range.start;
  for (const s of spans) {
    if (s.start > at && s.start - at >= min) out.push({ start: at, end: Math.min(s.start, range.end) });
    at = Math.max(at, s.end);
  }
  if (range.end - at >= min) out.push({ start: at, end: range.end });
  return out.filter((o) => o.end > o.start);
}

// Minutes planned in a day, overlap counted once.
export function plannedMinutes(chunks) {
  const spans = chunks.map(spanOf).sort((a, b) => a.start - b.start);
  let total = 0;
  let at = -1;
  for (const s of spans) {
    const from = Math.max(at, s.start);
    if (s.end > from) total += s.end - from;
    at = Math.max(at, s.end);
  }
  return total;
}

// A block's length in minutes from its "HH:MM" times, as the sheet shows
// it: an end before the start runs past midnight, and 23:59 is midnight.
export function blockLength(start, end) {
  if (!start || !end || start === end) return 0;
  const e = toMin(end) === DAY_END - 1 ? DAY_END : toMin(end);
  const raw = e - toMin(start);
  return raw > 0 ? raw : raw + DAY_END;
}

export function fmtHours(min) {
  if (min <= 0) return "0m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

// A block moved by a drag: same length, snapped, kept inside the day.
export function moved(span, deltaMin, { step = SNAP } = {}) {
  const len = span.end - span.start;
  let start = snap(span.start + deltaMin, step);
  start = Math.max(0, Math.min(DAY_END - len, start));
  return { start, end: start + len };
}

// A block stretched or shortened from its bottom edge: at least one step
// long, never past midnight.
export function resized(span, deltaMin, { step = SNAP } = {}) {
  const end = Math.max(span.start + step, Math.min(DAY_END, snap(span.end + deltaMin, step)));
  return { start: span.start, end };
}

// The times a new block gets when you tap an empty half hour: that half
// hour, an hour long, cut short by the next block if one starts sooner.
export function newBlockAt(min, chunks) {
  const start = Math.max(0, Math.min(DAY_END - SLOT, Math.floor(min / SLOT) * SLOT));
  let end = Math.min(DAY_END, start + 60);
  for (const c of chunks) {
    const s = spanOf(c);
    if (s.start > start && s.start < end) end = s.start;
  }
  if (end - start < SNAP) end = start + SLOT;
  return { start: toTime(start), end: toTime(end) };
}

// Where a new block goes from the + button: in the first open time after
// the day's last block, up to an hour long. When there's no room after it
// (the day runs to midnight), the first open time from 9 AM, then from the
// start of the day, so it never lands on a block that's already there.
export function nextOpenSlot(chunks) {
  const ends = chunks.map(spanOf).filter((s) => !s.overnight).map((s) => s.end);
  const lastEnd = ends.length ? Math.max(...ends) : null;
  const fits = (from) => openStretches(chunks, { start: from, end: DAY_END })[0] ?? null;
  const free = (lastEnd != null && lastEnd <= 23 * 60 ? fits(lastEnd) : null) ?? fits(9 * 60) ?? fits(0);
  if (!free) return { start: toTime(9 * 60), end: toTime(10 * 60) }; // not a free half hour all day
  return { start: toTime(free.start), end: toTime(Math.min(free.end, free.start + 60)) };
}

// --- Presets ---------------------------------------------------------------

// What a preset can have added to a day, found after the fact: new blocks
// that match one of the preset's own (name and times), and new tasks in
// those blocks or, on a weekly block the preset's tasks went onto, new tasks
// whose names are the preset's.
export function presetAdded(t, before, nowChunks, nowTasks) {
  const oldChunks = new Set(before.chunks.map((c) => c.id));
  const oldTasks = new Set(before.tasks.map((x) => x.id));
  const own = t.template_chunks ?? [];
  const same = (a, b) => a.start_time === b.start_time && a.end_time === b.end_time && a.title.trim().toLowerCase() === b.title.trim().toLowerCase();
  const chunks = nowChunks.filter((c) => !oldChunks.has(c.id) && !c.standing_block_id && own.some((tc) => same(tc, c))).map((c) => c.id);
  const ids = new Set(chunks);
  const weekly = new Set(nowChunks.filter((c) => c.standing_block_id && own.some((tc) => same(tc, c))).map((c) => c.id));
  const names = new Set(own.flatMap((tc) => (tc.template_tasks ?? []).map((x) => x.title.trim().toLowerCase())));
  const newTask = (x) => !oldTasks.has(x.id);
  const top = nowTasks.filter((x) => newTask(x) && (ids.has(x.time_chunk_id) || (weekly.has(x.time_chunk_id) && names.has(x.title.trim().toLowerCase()))));
  const topIds = new Set(top.map((x) => x.id));
  const tasks = [...top, ...nowTasks.filter((x) => newTask(x) && !topIds.has(x.id) && topIds.has(x.parent_task_id))].map((x) => x.id);
  return { chunks, tasks };
}
