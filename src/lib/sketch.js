// Sketches (0088): what he draws on a quest line or a camp step, mostly with
// a pencil on his iPad. A sketch is kept as its strokes, so it stays sharp at
// any size and can be drawn on again:
//
//   { width, height, strokes: [{ c: "#141414", w: 4, p: [x, y, pressure, x, y, pressure, ...] }] }
//
// in the page's own units (the size of the page it was first drawn on, in
// CSS pixels), with pressure from 0 to 100. The arithmetic here is pure, so
// it can be tested; drawing takes any 2D canvas context.

export const INKS = [
  { key: "#141414", label: "Black" },
  { key: "#f26a1b", label: "Orange" },
  { key: "#3b6fd8", label: "Blue" },
  { key: "#d64541", label: "Red" },
  { key: "#3d9a5b", label: "Green" },
];

export const WIDTHS = [
  { key: 2, label: "Fine" },
  { key: 4, label: "Medium" },
  { key: 9, label: "Bold" },
];

// The page's own units are CSS pixels at the size it was started at, kept
// within what the database takes.
export function pageSize(boxW, boxH, pad = 12) {
  const fit = (v) => Math.max(50, Math.min(10000, Math.round(v - pad * 2)));
  return { width: fit(boxW), height: fit(boxH) };
}

// A page of w × h fitted into a box, centred: the scale, and where the
// page's top left corner sits in the box.
export function fitPage(w, h, boxW, boxH, pad = 0) {
  const scale = Math.max(0.01, Math.min((boxW - pad * 2) / w, (boxH - pad * 2) / h));
  return { scale, x: (boxW - w * scale) / 2, y: (boxH - h * scale) / 2 };
}

// Adds a point to a stroke's points (to a tenth of a unit), unless it's
// within `min` of the last one. `force` keeps it anyway (the pen lifting).
// True when it was added.
export function pushPoint(p, x, y, pressure, min = 0.75, force = false) {
  const rx = Math.round(x * 10) / 10;
  const ry = Math.round(y * 10) / 10;
  const pr = Math.max(0, Math.min(100, Math.round(pressure * 100)));
  const n = p.length;
  if (n >= 3 && !force && Math.hypot(rx - p[n - 3], ry - p[n - 2]) < min) return false;
  if (n >= 3 && force && rx === p[n - 3] && ry === p[n - 2]) return false;
  p.push(rx, ry, pr);
  return true;
}

// A stroke's width at a point: a pencil pressed lightly draws thinner, and
// pressed hard, thicker. A finger or a mouse reads as 50.
export function widthAt(w, pressure) {
  return w * (0.35 + 1.1 * (pressure / 100));
}

// Is (x, y) within `r` of the stroke's line (its own width counted)?
export function nearStroke(stroke, x, y, r) {
  const p = stroke.p;
  const reach = r + stroke.w;
  if (p.length < 3) return false;
  if (p.length === 3) return Math.hypot(x - p[0], y - p[1]) <= reach;
  for (let i = 3; i < p.length; i += 3) {
    if (segDist(x, y, p[i - 3], p[i - 2], p[i], p[i + 1]) <= reach) return true;
  }
  return false;
}

function segDist(x, y, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

// The strokes a stroke eraser drawn from (x0, y0) to (x1, y1) touches.
export function erasedBy(strokes, x0, y0, x1, y1, r) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(1, r / 2)));
  const hit = new Set();
  for (let k = 0; k <= steps; k++) {
    const x = x0 + ((x1 - x0) * k) / steps;
    const y = y0 + ((y1 - y0) * k) / steps;
    for (const s of strokes) if (!hit.has(s) && nearStroke(s, x, y, r)) hit.add(s);
  }
  return hit;
}

// How many pieces a stroke of `n` points is drawn in: one for each point
// after the first (a lone point is a dot).
export function pieceCount(n) {
  return Math.max(0, n - 1);
}

// Draws pieces `from` to `to` (1-based, inclusive) of a stroke: a smooth line
// through the midpoints of its points, each piece as wide as the pressure at
// its point. Piece i ends where piece i + 1 starts, so a stroke can be drawn
// a piece at a time as its points come in; the last piece runs to the last
// point, so it's drawn only once the stroke is finished (`done`).
export function drawPieces(ctx, stroke, from, to, done = true) {
  const p = stroke.p;
  const n = p.length / 3;
  ctx.strokeStyle = stroke.c;
  ctx.fillStyle = stroke.c;
  if (n === 1) {
    if (done && from <= 1) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], widthAt(stroke.w, p[2]) / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  const last = done ? n - 1 : n - 2;
  for (let i = Math.max(1, from); i <= Math.min(to, last); i++) {
    const sx = i === 1 ? p[0] : (p[(i - 1) * 3] + p[i * 3]) / 2;
    const sy = i === 1 ? p[1] : (p[(i - 1) * 3 + 1] + p[i * 3 + 1]) / 2;
    ctx.lineWidth = widthAt(stroke.w, p[i * 3 + 2]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    if (i < n - 1) ctx.quadraticCurveTo(p[i * 3], p[i * 3 + 1], (p[i * 3] + p[(i + 1) * 3]) / 2, (p[i * 3 + 1] + p[(i + 1) * 3 + 1]) / 2);
    else ctx.lineTo(p[i * 3], p[i * 3 + 1]);
    ctx.stroke();
  }
}

// Every stroke, whole, on a context already set to the page's units.
export function drawStrokes(ctx, strokes) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) drawPieces(ctx, s, 1, s.p.length / 3);
}

// A sketch as a PNG on white (base64, no data: prefix), its longer side
// `maxSide` pixels, for the sketch reader. Small pages are drawn larger,
// so handwriting stays readable.
export function sketchPng(sketch, maxSide = 1568) {
  const k = maxSide / Math.max(sketch.width, sketch.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sketch.width * k));
  canvas.height = Math.max(1, Math.round(sketch.height * k));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  drawStrokes(ctx, sketch.strokes ?? []);
  return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
}

// Has it been drawn on since it was last read?
export function staleSummary(sketch) {
  if (!sketch.summary || !sketch.analyzed_at || !sketch.updated_at) return false;
  return Date.parse(sketch.updated_at) > Date.parse(sketch.analyzed_at);
}
