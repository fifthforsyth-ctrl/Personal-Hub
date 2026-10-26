// The small geometry the quest trail is drawn from (QuestTrail.jsx): seeded
// randomness, a rocky line, switchbacks with rounded corners and how far
// along them a point lies.

export function r1(v) {
  return Math.round(v * 10) / 10;
}

export function xy(p) {
  return `${r1(p[0])},${r1(p[1])}`;
}

export function poly(pts) {
  return `M${pts.map(xy).join("L")}`;
}

// A small seeded random number generator (mulberry32).
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Midpoint displacement between anchor points, for a natural rocky line.
// No point rises above minY.
export function rough(anchors, rnd, depth, amp, minY) {
  function split(a, b, d, s) {
    if (d === 0) return [a, b];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const off = (rnd() - 0.5) * 2 * s * len;
    const m = [(a[0] + b[0]) / 2 - (dy / len) * off, (a[1] + b[1]) / 2 + (dx / len) * off];
    return split(a, m, d - 1, s * 0.62).concat(split(m, b, d - 1, s * 0.62).slice(1));
  }
  let out = [anchors[0]];
  for (let i = 0; i < anchors.length - 1; i++) out = out.concat(split(anchors[i], anchors[i + 1], depth, amp).slice(1));
  if (minY !== undefined) for (let j = 1; j < out.length; j++) out[j] = [out[j][0], Math.max(out[j][1], minY + 1.5)];
  return out;
}

// A polyline with its corners rounded off, like switchbacks.
export function rounded(pts, r) {
  let d = `M${xy(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
    const l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
    const a = Math.min(r, l1 / 2) / l1;
    const b = Math.min(r, l2 / 2) / l2;
    d += `L${xy([p1[0] + (p0[0] - p1[0]) * a, p1[1] + (p0[1] - p1[1]) * a])}Q${xy(p1)} ${xy([p1[0] + (p2[0] - p1[0]) * b, p1[1] + (p2[1] - p1[1]) * b])}`;
  }
  return `${d}L${xy(pts[pts.length - 1])}`;
}

// The same switchbacks as `rounded`, as points close enough together to
// measure: a camp sits where the trail passes its corner, and the climber
// stands a fraction of the way along it.
export function roundedPoints(pts, r, steps = 12) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
    const l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
    const a = Math.min(r, l1 / 2) / l1;
    const b = Math.min(r, l2 / 2) / l2;
    const s = [p1[0] + (p0[0] - p1[0]) * a, p1[1] + (p0[1] - p1[1]) * a];
    const e = [p1[0] + (p2[0] - p1[0]) * b, p1[1] + (p2[1] - p1[1]) * b];
    out.push(s);
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const u = 1 - t;
      out.push([u * u * s[0] + 2 * u * t * p1[0] + t * t * e[0], u * u * s[1] + 2 * u * t * p1[1] + t * t * e[1]]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// A measured polyline: its length, the point a fraction along it, and the
// fraction along it nearest a point.
export function measure(points) {
  const at = [0];
  for (let i = 1; i < points.length; i++) at.push(at[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const length = at[at.length - 1] || 1;
  return {
    length,
    pointAt(f) {
      const d = Math.max(0, Math.min(1, f)) * length;
      let i = 1;
      while (i < points.length - 1 && at[i] < d) i++;
      const seg = at[i] - at[i - 1] || 1;
      const t = (d - at[i - 1]) / seg;
      return [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t];
    },
    nearest(p) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
        const d = Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
        if (d < bestD) {
          bestD = d;
          best = (at[i - 1] + t * (at[i] - at[i - 1])) / length;
        }
      }
      return best;
    },
  };
}
