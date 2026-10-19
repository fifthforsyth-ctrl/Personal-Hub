// The line-drawn mountain on the Ascent page, and the small geometry it's
// made from.
//
// The summit carries the mission's flag, a trail switches back and forth up
// the lit face, and the climber stands on it as high as the lifetime goals
// are strong on average. Trees grow in groves up to the treeline, never on
// the trail. The drawing is seeded, so it's the same mountain every time,
// and it's redrawn at the width its box has, so lines and words stay crisp.
//
// It's drawn straight into an <svg> rather than through React because the
// trail and the labels have to be measured as they're placed
// (getPointAtLength, getComputedTextLength).

const NS = "http://www.w3.org/2000/svg";

export function r1(v) {
  return Math.round(v * 10) / 10;
}

export function xy(p) {
  return `${r1(p[0])},${r1(p[1])}`;
}

export function poly(pts) {
  return `M${pts.map(xy).join("L")}`;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
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

// Where a polyline crosses the height y.
function crossings(pts, y) {
  const xs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) xs.push(a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]));
  }
  return xs;
}

// The highest point of a polyline above x.
function surface(pts, x) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) best = Math.min(best, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
  }
  return best;
}

function nearLine(px, py, pts, d) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    if (Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy) < d) return true;
  }
  return false;
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

// The trail climbs steadily, so its height falls as its length grows.
function lengthAtY(path, total, y) {
  let lo = 0;
  let hi = total;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (path.getPointAtLength(mid).y > y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function mk(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  if (attrs) for (const k of Object.keys(attrs)) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

function cloud(parent, x, y, s) {
  const g = mk("g", { transform: `translate(${r1(x)} ${r1(y)}) scale(${s})` }, parent);
  mk("path", { class: "sc-cloud", d: "M-34 8 H34 A9 9 0 0 0 26 -6 A13 13 0 0 0 4 -12 A16 16 0 0 0 -24 -6 A8 8 0 0 0 -34 8 Z" }, g);
}

// The mission: a flag planted on the summit.
function summitFlag(parent, x, y, size) {
  const g = mk("g", { transform: `translate(${r1(x)} ${r1(y)}) scale(${(size / 28).toFixed(3)})` }, parent);
  mk("path", { class: "sc-pole", d: "M0 0 V-27" }, g);
  mk("path", { class: "sc-flag", d: "M0.9 -27 H15 L11.4 -22.2 L15 -17.4 H0.9 Z" }, g);
}

function tween(from, to, ms, step, done, reduce) {
  if (reduce || ms <= 0 || from === to) {
    step(to);
    done?.();
    return () => {};
  }
  let t0 = null;
  let raf = 0;
  const frame = (now) => {
    if (t0 === null) t0 = now;
    const t = Math.min(1, (now - t0) / ms);
    step(from + (to - from) * (1 - Math.pow(1 - t, 3)));
    if (t < 1) raf = requestAnimationFrame(frame);
    else done?.();
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

let uid = 0;

// Draws the mountain into `host` (a box with a size) and keeps it drawn as
// the box changes width. `at` (0..1) is how high the climber stands;
// `optsFor(width, height)` gives the drawing's options for a box. Returns a
// function that stops it.
export function drawMountain(host, at, optsFor) {
  const svg = mk("svg", { "aria-hidden": "true", focusable: "false" }, host);
  const id = `mt${++uid}`;
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const state = { shown: 0, drawn: false };
  let cur = null;
  let stopTween = () => {};

  function render() {
    const W = host.clientWidth;
    const H = host.clientHeight;
    if (!W || !H) return;
    const o = optsFor(W, H);
    const rnd = rng(o.seed);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const sx = W * o.sx;
    const sy = o.top;
    const by = H - o.bottom;
    const h = by - sy;
    const yAt = (e) => by - e * h;
    const wL = W * o.wl;
    const wR = W * o.wr;

    const defs = mk("defs", null, svg);
    const pat = mk("pattern", { id: `${id}-hatch`, width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(36)" }, defs);
    mk("line", { class: "sc-hatch", x1: 0, y1: -1, x2: 0, y2: 6 }, pat);
    const gr = mk("radialGradient", { id: `${id}-glow` }, defs);
    mk("stop", { offset: "0", "stop-color": "#f26a1b", "stop-opacity": "0.16" }, gr);
    mk("stop", { offset: "0.5", "stop-color": "#f26a1b", "stop-opacity": "0.05" }, gr);
    mk("stop", { offset: "1", "stop-color": "#f26a1b", "stop-opacity": "0" }, gr);
    const gBack = mk("g", null, svg);
    const gBody = mk("g", null, svg);
    const gTrees = mk("g", null, svg);
    const gTrail = mk("g", null, svg);
    const gTop = mk("g", null, svg);

    // The glow behind the summit, far peaks and clouds.
    mk("circle", { cx: r1(sx), cy: r1(sy + h * 0.06), r: r1(h * 0.5), fill: `url(#${id}-glow)` }, gBack);
    (o.far ?? []).forEach((p, i) => {
      const px = W * p.x;
      const pw = h * p.w;
      const pts = rough(
        [[px - pw, by], [px - pw * 0.42, yAt(p.e * 0.58)], [px, yAt(p.e)], [px + pw * 0.4, yAt(p.e * 0.62)], [px + pw, by]],
        rng(o.seed * 7 + i),
        3,
        0.05,
        yAt(p.e)
      );
      mk("path", { class: "sc-far", d: poly(pts) }, gBack);
    });
    (o.clouds ?? []).forEach((c) => cloud(gBack, W * c.x, sy + h * c.y, c.s));

    // The mountain: a summit pyramid, a shoulder on the left, a lit face and
    // a hatched face.
    const LA = [[0, 1], [0.09, 0.87], [0.18, 0.76], [0.27, 0.67], [0.34, 0.652], [0.39, 0.672], [0.47, 0.59], [0.62, 0.41], [0.8, 0.2], [1, 0]];
    const RA = [[0, 1], [0.08, 0.88], [0.2, 0.7], [0.31, 0.6], [0.4, 0.585], [0.6, 0.36], [0.8, 0.15], [1, 0]];
    const SA = [[0, 1], [0.04, 0.86], [0.1, 0.7], [0.15, 0.52], [0.25, 0.32], [0.33, 0.14], [0.4, 0]];
    const left = rough(LA.map((a) => [sx - a[0] * wL, yAt(a[1])]), rnd, 3, 0.05, sy);
    const right = rough(RA.map((a) => [sx + a[0] * wR, yAt(a[1])]), rnd, 3, 0.05, sy);
    const spine = rough(SA.map((a) => [sx + a[0] * wR, yAt(a[1])]), rnd, 3, 0.04, sy);
    const ridge = left.slice().reverse().concat(right.slice(1));
    const lf = left[left.length - 1];
    const rf = right[right.length - 1];
    const bodyD = `${poly(ridge)}L${xy([rf[0], by + 3])}L${xy([lf[0], by + 3])}Z`;
    const clip = mk("clipPath", { id: `${id}-clip` }, defs);
    mk("path", { d: bodyD }, clip);

    mk("path", { class: "sc-body", d: bodyD }, gBody);
    const sb = spine[spine.length - 1];
    mk(
      "path",
      { fill: `url(#${id}-hatch)`, d: `${poly(spine)}L${xy([sb[0], by + 3])}L${xy([rf[0], by + 3])}L${poly(right.slice().reverse()).slice(1)}Z` },
      gBody
    );
    const rocks = mk("g", { "clip-path": `url(#${id}-clip)` }, gBody);
    [0.84, 0.7, 0.55, 0.4].forEach((e) => {
      const xs = crossings(spine, yAt(e));
      if (!xs.length) return;
      const s = [Math.min(...xs), yAt(e)];
      mk("path", { class: "sc-rock", d: poly(rough([s, [s[0] + wR * (0.13 + rnd() * 0.06), s[1] + h * (0.09 + rnd() * 0.04)]], rnd, 2, 0.08)) }, rocks);
    });
    [0.9, 0.78].forEach((e) => {
      const xs = crossings(left, yAt(e));
      if (!xs.length) return;
      const s = [Math.max(...xs) + 2, yAt(e)];
      mk("path", { class: "sc-rock", d: poly(rough([s, [s[0] + wL * 0.06, s[1] + h * 0.06]], rnd, 2, 0.08)) }, rocks);
    });
    mk("path", { class: "sc-spine", d: poly(spine) }, gBody);
    mk("path", { class: "sc-ridge", d: poly(ridge) }, gBody);

    // The trail: switchbacks across the lit face, then up the summit pyramid.
    const leftX = (e) => {
      const xs = crossings(left, yAt(e));
      return xs.length ? Math.max(...xs) : sx - wL * (1 - e);
    };
    const spineX = (e) => {
      const xs = crossings(spine, yAt(e));
      return xs.length ? Math.min(...xs) : sx;
    };
    const corners = [];
    for (let k = 0; k < o.legs; k++) {
      const e = k === 0 ? 0 : (o.eTop * k) / (o.legs - 1) + (rnd() - 0.5) * 0.02;
      const xl = k === 0 ? lf[0] : leftX(e);
      const xr = spineX(e);
      const m = Math.max(7, (xr - xl) * 0.1);
      const t = k === 0 ? 0.34 : (k % 2 ? 0.86 : 0.14) + (rnd() - 0.5) * 0.06;
      corners.push([lerp(xl + m, xr - m, t), yAt(e)]);
    }
    corners.push([sx, sy]);
    const trailD = rounded(corners, o.r);
    mk("line", { class: "sc-ground", x1: 0, y1: r1(by), x2: W, y2: r1(by) }, gTrail);
    const ahead = mk("path", { class: "sc-ahead", d: trailD }, gTrail);
    const walked = mk("path", { class: "sc-walked", d: trailD }, gTrail);
    const L = ahead.getTotalLength();

    // The climber's label, measured now so the trees can keep clear of it.
    const home = ahead.getPointAtLength(lengthAtY(ahead, L, yAt(at)));
    let pill = null;
    let pillRect = null;
    let pillText = null;
    let pillBox = null;
    if (o.pill) {
      pill = mk("g", { class: "sc-pill" }, gTop);
      pillRect = mk("rect", { rx: 11, height: 22 }, pill);
      pillText = mk("text", null, pill);
      pillText.textContent = o.pill;
      const hw = pillText.getComputedTextLength() + 22;
      const onLeft = o.pillSide === "left" ? home.x - 16 - hw > 6 : home.x + 16 + hw > W - 6;
      pillBox = [onLeft ? home.x - 20 - hw : home.x + 12, home.y - 16, hw + 8, 32];
    }
    let nameBox = null;
    if (o.name) {
      const flip = sx + o.fig * 0.7 + 150 > W - 10;
      nameBox = flip ? [sx - o.fig * 0.4 - 160, sy - o.fig - 6, 160, 44] : [sx + o.fig * 0.4, sy - o.fig - 6, 160, 44];
    }

    // Trees grow in groves up to the treeline, thinner on the shaded face,
    // never on the trail.
    const groves = [];
    for (let gi = 0; gi < o.groves; gi++) {
      const ge = Math.pow(rnd(), 1.3) * o.treeline * 0.92;
      const ext = crossings(ridge, yAt(ge));
      if (ext.length < 2) continue;
      groves.push([lerp(Math.min(...ext), Math.max(...ext), 0.06 + rnd() * 0.88), yAt(ge), W * (0.03 + rnd() * 0.045)]);
    }
    const trees = [];
    const want = Math.round(W * o.trees);
    for (let tries = 0; trees.length < want && tries < want * 80; tries++) {
      const tx = lerp(lf[0] + 6, rf[0] - 6, rnd());
      const top = surface(ridge, tx);
      if (!Number.isFinite(top)) continue;
      const ty = lerp(top, by - 1, Math.pow(rnd(), 0.8));
      const te = (by - ty) / h;
      let near = 0;
      for (const g of groves) {
        const d = Math.hypot(tx - g[0], (ty - g[1]) * 1.7);
        near = Math.max(near, Math.exp(-(d * d) / (2 * g[2] * g[2])));
      }
      let chance = (0.06 + 0.94 * near) * Math.pow(Math.max(0, 1 - te / o.treeline), 0.5);
      if (tx > spineX(te)) chance *= 0.55;
      if (rnd() > chance) continue;
      const th = o.treeH * (0.75 + rnd() * 0.55) * (1 - te * 0.45);
      if (ty - th < top + 3 || tx < 4 || tx > W - 4) continue;
      if (nearLine(tx, ty - th / 2, corners, th * 0.5 + 6)) continue;
      if (Math.hypot(tx - home.x, ty - th / 2 - home.y) < 22) continue;
      if ([pillBox, nameBox].some((b) => b && tx > b[0] && tx < b[0] + b[2] && ty > b[1] && ty - th < b[1] + b[3])) continue;
      if (trees.some((q) => Math.abs(q.x - tx) < th * 0.6 && Math.abs(q.y - ty) < th * 0.7)) continue;
      trees.push({ x: tx, y: ty, h: th });
    }
    trees
      .sort((a, b) => a.y - b.y)
      .forEach((q) => {
        const w = q.h * 0.34;
        mk("path", { class: "sc-tree", d: `M${r1(q.x)},${r1(q.y - q.h)}L${r1(q.x + w)},${r1(q.y)}L${r1(q.x - w)},${r1(q.y)}Z` }, gTrees);
      });

    // The mission, planted on the summit.
    summitFlag(gTop, sx, sy + 0.5, o.fig);
    if (o.name) {
      const nx = sx + o.fig * 0.7;
      const ny = sy - o.fig * 0.62;
      const nm = mk("text", { class: "sc-name", x: r1(nx), y: r1(ny) }, gTop);
      nm.textContent = o.name;
      const ft = mk("text", { class: "sc-mono", x: r1(nx), y: r1(ny + 15) }, gTop);
      ft.textContent = o.nameSub ?? "";
      const nw = Math.max(nm.getComputedTextLength(), ft.getComputedTextLength());
      if (nx + nw > W - 10) {
        for (const el of [nm, ft]) {
          el.setAttribute("x", r1(sx - o.fig * 0.25));
          el.setAttribute("text-anchor", "end");
        }
      }
    }

    const you = mk("g", { class: "sc-you" }, gTop);
    mk("circle", { class: "halo", r: o.dot * 2.1 }, you);
    mk("circle", { class: "core", r: o.dot }, you);
    if (pill) gTop.appendChild(pill);

    cur = { W, ahead, walked, L, yAt, you, pill, pillRect, pillText, o };
    place(state.shown);
    if (pill) pill.style.opacity = state.drawn || !o.animate ? "1" : "0";
  }

  function place(f) {
    if (!cur) return;
    const len = f <= 0 ? 0 : lengthAtY(cur.ahead, cur.L, cur.yAt(f));
    const p = cur.ahead.getPointAtLength(len);
    cur.you.setAttribute("transform", `translate(${r1(p.x)} ${r1(p.y)})`);
    cur.walked.setAttribute("stroke-dasharray", `${r1(len)} ${r1(cur.L + 40)}`);
    if (!cur.pill) return;
    const pw = cur.pillText.getComputedTextLength() + 22;
    const onLeft = cur.o.pillSide === "left" ? p.x - 16 - pw > 6 : p.x + 16 + pw > cur.W - 6;
    const px = onLeft ? p.x - 16 - pw : p.x + 16;
    cur.pillRect.setAttribute("x", r1(px));
    cur.pillRect.setAttribute("y", r1(p.y - 11));
    cur.pillRect.setAttribute("width", r1(pw));
    cur.pillText.setAttribute("x", r1(px + 11));
    cur.pillText.setAttribute("y", r1(p.y + 4));
  }

  let io = null;
  const o0 = optsFor(host.clientWidth || 360, host.clientHeight || 168);
  if (o0.animate && !reduce && "IntersectionObserver" in window) {
    io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((en) => en.isIntersecting)) return;
        io.disconnect();
        io = null;
        stopTween = tween(
          0,
          at,
          1700,
          (f) => {
            state.shown = f;
            place(f);
          },
          () => {
            state.drawn = true;
            if (cur?.pill) cur.pill.style.opacity = "1";
          },
          reduce
        );
      },
      { threshold: 0.3 }
    );
    io.observe(host);
  } else {
    state.shown = at;
    state.drawn = true;
  }
  render();

  let lastW = host.clientWidth;
  let ro = null;
  if ("ResizeObserver" in window) {
    ro = new ResizeObserver(() => {
      if (Math.abs(host.clientWidth - lastW) < 1) return;
      lastW = host.clientWidth;
      render();
    });
    ro.observe(host);
  }
  // The labels are measured, so draw again once the page's fonts are in.
  let live = true;
  document.fonts?.ready?.then(() => live && render());

  return () => {
    live = false;
    stopTween();
    io?.disconnect();
    ro?.disconnect();
    svg.remove();
  };
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
