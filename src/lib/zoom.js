// Looking closely at a photo or a sketch (0096): the view of a picture
// `w` × `h` (its own pixels, or a sketch's page units) in a box `bw` × `bh`
// on screen is { k, x, y }: k screen pixels to one of its own, its top left
// corner at (x, y) in the box. Pure, so it can be tested.

// All of it in sight, centred, `pad` clear around it.
export function fitView(w, h, bw, bh, pad = 16) {
  const k = Math.max(1e-6, Math.min((bw - pad * 2) / w, (bh - pad * 2) / h));
  return { k, x: (bw - w * k) / 2, y: (bh - h * k) / 2 };
}

// To `k`, about the point (px, py) in the box: what's under it stays there.
export function zoomAt(v, k, px, py) {
  const r = k / v.k;
  return { k, x: px - (px - v.x) * r, y: py - (py - v.y) * r };
}

// Kept within bounds: k between `lo` and `hi` (about the middle of the
// box), and a side narrower than the box centred, a wider one not pulled
// more than `slack` past its edge.
export function clampView(v, w, h, bw, bh, lo, hi, slack = 48) {
  const k = Math.min(hi, Math.max(lo, v.k));
  const at = k === v.k ? v : zoomAt(v, k, bw / 2, bh / 2);
  const cw = w * k;
  const ch = h * k;
  const x = cw <= bw ? (bw - cw) / 2 : Math.min(slack, Math.max(bw - cw - slack, at.x));
  const y = ch <= bh ? (bh - ch) / 2 : Math.min(slack, Math.max(bh - ch - slack, at.y));
  return { k, x, y };
}

// A point in the box as where it is on the picture, 0 to 1 across and
// down; null off the picture.
export function toPicture(v, w, h, px, py) {
  const x = (px - v.x) / (w * v.k);
  const y = (py - v.y) / (h * v.k);
  return x < 0 || x > 1 || y < 0 || y > 1 ? null : { x, y };
}

// And back: 0 to 1 on the picture as a point in the box.
export function toBox(v, w, h, x, y) {
  return { x: v.x + x * w * v.k, y: v.y + y * h * v.k };
}

// At `k`, with the point (x, y) of the picture (0 to 1) in the middle.
export function centreOn(w, h, bw, bh, x, y, k) {
  return { k, x: bw / 2 - x * w * k, y: bh / 2 - y * h * k };
}

// A picture's size once its longer side is at most `max`.
export function shrinkTo(w, h, max) {
  const r = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * r)), height: Math.max(1, Math.round(h * r)) };
}

// Pins on one picture numbered in the order they were put there.
export function pinNumbers(pins) {
  const m = new Map();
  [...(pins ?? [])]
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) || String(a.id).localeCompare(String(b.id)))
    .forEach((p, i) => m.set(p.id, i + 1));
  return m;
}

// Where a picture's pins sit in a box `bw` × `bh` it's shown small in (px
// from its top left, as `left` and `top`): a picture `w` × `h`, or only
// `frame` of it (a sketch's inked part), fitted in with `pad` around it, or
// (`cover`) filling the box and cut to fit. Pins the box cuts off are left
// out.
export function pinSpots(pins, { w, h, frame = null, pad = 0, cover = false }, bw, bh) {
  if (!(bw > 0 && bh > 0 && w > 0 && h > 0)) return [];
  const f = frame ?? { x: 0, y: 0, width: w, height: h };
  const k = cover ? Math.max(bw / f.width, bh / f.height) : Math.max(0.01, Math.min((bw - pad * 2) / f.width, (bh - pad * 2) / f.height));
  const ox = (bw - f.width * k) / 2;
  const oy = (bh - f.height * k) / 2;
  return (pins ?? [])
    .map((p) => ({ ...p, left: ox + (p.x * w - f.x) * k, top: oy + (p.y * h - f.y) * k }))
    .filter((p) => p.left >= -0.5 && p.left <= bw + 0.5 && p.top >= -0.5 && p.top <= bh + 0.5);
}
