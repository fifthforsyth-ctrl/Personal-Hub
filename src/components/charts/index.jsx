import { useMemo, useRef, useState } from "react";

// Hand-rolled SVG charts. No library: the app needs three forms, all of them
// small, and a charting dependency would cost more bytes than the whole
// bundle it joins.
//
// Shared rules, applied by every form here:
//   · 2px of surface between adjacent fills, so slices and bars never bleed
//     into each other
//   · rounded data-ends, square baselines
//   · recessive grid — the data is the darkest thing on the plot
//   · a hover layer by default; values live in the tooltip, not stamped on
//     every mark
//   · text wears text tokens, never the series color

const TAU = Math.PI * 2;

export function useTooltip() {
  const wrapRef = useRef(null);
  const [tip, setTip] = useState(null);

  function show(event, content) {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ x: event.clientX - box.left, y: event.clientY - box.top, content });
  }

  const node = tip ? (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y - 10 }}>
      {tip.content}
    </div>
  ) : null;

  return { wrapRef, show, hide: () => setTip(null), node };
}

function Tip({ label, value, sub }) {
  return (
    <>
      <div className="chart-tip__k">{label}</div>
      <div className="chart-tip__v">{value}</div>
      {sub && <div className="chart-tip__v" style={{ opacity: 0.7 }}>{sub}</div>}
    </>
  );
}

// ---------------------------------------------------------------------------
// Donut — part-to-whole
//
// A ring rather than a filled pie so the total can live in the hole, which is
// the number you actually want when the question is "of my whole life, how
// much went where". Built from dashed strokes on one circle: the gaps come
// free and stay a constant 2px no matter how thin a slice gets.
// ---------------------------------------------------------------------------

export function Donut({
  slices,
  size = 260,
  thickness = 30,
  format = (v) => String(v),
  centerLabel,
  centerValue,
  activeKey,
  onHover,
}) {
  const { wrapRef, show, hide, node } = useTooltip();
  const [hovered, setHovered] = useState(null);

  const total = slices.reduce((s, d) => s + d.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = TAU * radius;
  const active = activeKey ?? hovered;

  let offset = 0;
  const arcs = slices.map((d) => {
    const share = total > 0 ? d.value / total : 0;
    const raw = share * circumference;
    // Never let the 2px separator eat a slice whole — a sliver you can't see
    // is still a sliver you should be able to hover.
    const len = Math.max(raw - 2, Math.min(raw, 1.5));
    const arc = { ...d, share, len, offset, gapLen: raw };
    offset += raw;
    return arc;
  });

  function enter(event, arc) {
    setHovered(arc.key);
    onHover?.(arc.key);
    show(event, <Tip label={arc.key} value={format(arc.value)} sub={`${(arc.share * 100).toFixed(1)}% of total`} />);
  }

  function leave() {
    setHovered(null);
    onHover?.(null);
    hide();
  }

  const shown = active ? arcs.find((a) => a.key === active) : null;

  return (
    <div ref={wrapRef} style={{ position: "relative", width: size, maxWidth: "100%" }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" role="img" aria-label={centerLabel}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {arcs.map((arc) => {
            const dim = active != null && active !== arc.key;
            return (
              <circle
                key={arc.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={active === arc.key ? thickness + 6 : thickness}
                strokeDasharray={`${arc.len} ${circumference - arc.len}`}
                strokeDashoffset={-arc.offset}
                opacity={dim ? 0.32 : 1}
                style={{ transition: "stroke-width 0.12s, opacity 0.12s", cursor: "pointer" }}
                onMouseEnter={(e) => enter(e, arc)}
                onMouseMove={(e) => enter(e, arc)}
                onMouseLeave={leave}
              />
            );
          })}
        </g>
      </svg>

      {/* The hole carries the headline: the total, or whatever you're hovering. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeContent: "center",
          textAlign: "center",
          pointerEvents: "none",
          padding: thickness + 8,
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 3 }}>{shown ? shown.key : centerLabel}</div>
        <div style={{ fontSize: 25, fontWeight: 660, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
          {shown ? format(shown.value) : centerValue}
        </div>
        {shown && <div className="mono faint" style={{ fontSize: 11, marginTop: 2 }}>{(shown.share * 100).toFixed(1)}%</div>}
      </div>

      {node}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ranked horizontal bars — magnitude
//
// One measure, so one hue unless the caller passes entity colors. Names label
// each row directly, which is what makes this readable past the point where a
// donut stops being.
// ---------------------------------------------------------------------------

export function RankedBars({ rows, format = (v) => String(v), activeKey, onHover, max: maxProp }) {
  const max = maxProp ?? Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="stack stack--tight">
      {rows.map((r) => {
        const dim = activeKey != null && activeKey !== r.key;
        return (
          <button
            key={r.key}
            className="btn-link"
            style={{ display: "block", width: "100%", textAlign: "left", color: "inherit", opacity: dim ? 0.4 : 1, transition: "opacity 0.12s" }}
            onMouseEnter={() => onHover?.(r.key)}
            onMouseLeave={() => onHover?.(null)}
            onFocus={() => onHover?.(r.key)}
            onBlur={() => onHover?.(null)}
          >
            <span className="row row--between" style={{ marginBottom: 4 }}>
              <span className="row" style={{ gap: 7, minWidth: 0 }}>
                <span className="dot" style={{ background: r.color ?? "var(--accent)" }} />
                <span className="truncate" style={{ fontSize: 12.5, fontWeight: 550 }}>{r.key}</span>
              </span>
              <span className="mono faint" style={{ fontSize: 11.5, flexShrink: 0 }}>{format(r.value)}</span>
            </span>
            <span className="bar-track" style={{ display: "block", height: 6 }}>
              <span
                className="bar-fill"
                style={{ display: "block", width: `${(r.value / max) * 100}%`, background: r.color ?? "var(--accent)" }}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line — change over time
//
// Crosshair follows the pointer to the nearest x, because reading a value off
// a line by eye is guesswork and the whole point of asking "map my sleep over
// six months" is to see individual nights.
// ---------------------------------------------------------------------------

export function LineChart({
  series,
  height = 240,
  format = (v) => String(v),
  formatX = (v) => String(v),
  yLabel,
  area = true,
}) {
  const { wrapRef, show, hide, node } = useTooltip();
  const [hoverIndex, setHoverIndex] = useState(null);

  const W = 720;
  const H = height;
  const pad = { top: 14, right: 14, bottom: 26, left: 46 };

  const { xs, yMax, yMin, paths, ticks } = useMemo(() => {
    const allX = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);
    const allY = series.flatMap((s) => s.points.map((p) => p.y));
    let hi = Math.max(...allY, 0);
    let lo = Math.min(...allY, 0);
    if (hi === lo) hi = lo + 1;
    // Breathing room above the peak so the top mark isn't welded to the frame.
    hi = hi + (hi - lo) * 0.08;

    const xAt = (x) =>
      allX.length <= 1
        ? pad.left + (W - pad.left - pad.right) / 2
        : pad.left + ((x - allX[0]) / (allX[allX.length - 1] - allX[0])) * (W - pad.left - pad.right);
    const yAt = (y) => H - pad.bottom - ((y - lo) / (hi - lo)) * (H - pad.top - pad.bottom);

    const built = series.map((s) => {
      const pts = [...s.points].sort((a, b) => a.x - b.x);
      const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(p.x).toFixed(2)} ${yAt(p.y).toFixed(2)}`).join(" ");
      const fill = `${d} L${xAt(pts[pts.length - 1]?.x ?? 0).toFixed(2)} ${H - pad.bottom} L${xAt(pts[0]?.x ?? 0).toFixed(2)} ${H - pad.bottom} Z`;
      return { ...s, d, fill, pts, xAt, yAt };
    });

    const tickCount = 4;
    const t = Array.from({ length: tickCount + 1 }, (_, i) => {
      const v = lo + ((hi - lo) * i) / tickCount;
      return { v, y: yAt(v) };
    });

    return { xs: allX, yMax: hi, yMin: lo, paths: built, ticks: t, xAt, yAt };
  }, [series, H]);

  const xAt = paths[0]?.xAt;

  function move(event) {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box || xs.length === 0) return;
    const px = ((event.clientX - box.left) / box.width) * W;
    let best = 0;
    let bestD = Infinity;
    xs.forEach((x, i) => {
      const d = Math.abs(xAt(x) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHoverIndex(best);
    const x = xs[best];
    show(
      event,
      <>
        <div className="chart-tip__k">{formatX(x)}</div>
        {series.map((s) => {
          const p = s.points.find((q) => q.x === x);
          return p ? (
            <div key={s.key} className="row" style={{ gap: 6 }}>
              <span className="dot" style={{ background: s.color, width: 6, height: 6 }} />
              <span className="chart-tip__v">{series.length > 1 ? `${s.key} · ` : ""}{format(p.y)}</span>
            </div>
          ) : null;
        })}
      </>
    );
  }

  if (series.length === 0 || xs.length === 0) return null;

  const hoverX = hoverIndex != null ? xAt(xs[hoverIndex]) : null;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        onMouseMove={move}
        onMouseLeave={() => {
          setHoverIndex(null);
          hide();
        }}
        style={{ display: "block", overflow: "visible" }}
      >
        {ticks.map((t) => (
          <g key={t.v}>
            <line x1={pad.left} x2={W - pad.right} y1={t.y} y2={t.y} stroke="var(--line)" strokeWidth="1" />
            <text x={pad.left - 8} y={t.y + 3.5} textAnchor="end" fontSize="10" fill="var(--text-3)" fontFamily="var(--font-mono)">
              {format(t.v)}
            </text>
          </g>
        ))}

        {hoverX != null && (
          <line x1={hoverX} x2={hoverX} y1={pad.top} y2={H - pad.bottom} stroke="var(--line-strong)" strokeWidth="1" />
        )}

        {paths.map((s) => (
          <g key={s.key}>
            {area && series.length === 1 && (
              <path d={s.fill} fill={s.color} opacity="0.1" />
            )}
            <path d={s.d} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {hoverIndex != null &&
              (() => {
                const p = s.pts.find((q) => q.x === xs[hoverIndex]);
                return p ? (
                  <circle cx={s.xAt(p.x)} cy={s.yAt(p.y)} r="4.5" fill={s.color} stroke="var(--card)" strokeWidth="2" />
                ) : null;
              })()}
          </g>
        ))}

        {/* Ends only — a label on every point is noise. */}
        <text x={pad.left} y={H - 8} fontSize="10" fill="var(--text-3)" fontFamily="var(--font-mono)">
          {formatX(xs[0])}
        </text>
        <text x={W - pad.right} y={H - 8} textAnchor="end" fontSize="10" fill="var(--text-3)" fontFamily="var(--font-mono)">
          {formatX(xs[xs.length - 1])}
        </text>
      </svg>
      {yLabel && <div className="eyebrow" style={{ marginTop: 6 }}>{yLabel}</div>}
      {node}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Columns — magnitude across a modest number of ordered buckets
// ---------------------------------------------------------------------------

export function ColumnChart({ rows, height = 220, format = (v) => String(v), color = "var(--accent)" }) {
  const { wrapRef, show, hide, node } = useTooltip();
  const [hovered, setHovered] = useState(null);

  const max = Math.max(...rows.map((r) => r.value), 1);
  const showEvery = Math.ceil(rows.length / 12);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height, borderBottom: "1px solid var(--line)" }}>
        {rows.map((r, i) => (
          <div
            key={r.key}
            style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}
            onMouseEnter={(e) => {
              setHovered(r.key);
              show(e, <Tip label={r.key} value={format(r.value)} />);
            }}
            onMouseMove={(e) => show(e, <Tip label={r.key} value={format(r.value)} />)}
            onMouseLeave={() => {
              setHovered(null);
              hide();
            }}
          >
            <div
              style={{
                height: `${Math.max((r.value / max) * 100, r.value > 0 ? 1.5 : 0)}%`,
                background: r.color ?? color,
                borderRadius: "4px 4px 0 0",
                opacity: hovered && hovered !== r.key ? 0.45 : 1,
                transition: "opacity 0.12s",
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 2, marginTop: 5 }}>
        {rows.map((r, i) => (
          <div key={r.key} style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            <span className="mono faint" style={{ fontSize: 9.5 }}>{i % showEvery === 0 ? r.shortKey ?? r.key : ""}</span>
          </div>
        ))}
      </div>
      {node}
    </div>
  );
}

// A legend is mandatory once identity matters, so it lives here rather than
// being re-typed per chart. Hovering a row lights the matching mark.
export function Legend({ items, format, activeKey, onHover }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <button
          key={it.key}
          className={"legend-item" + (activeKey != null && activeKey !== it.key ? " dim" : "")}
          onMouseEnter={() => onHover?.(it.key)}
          onMouseLeave={() => onHover?.(null)}
        >
          <span className="dot" style={{ background: it.color }} />
          {it.key}
          {format && <span className="mono faint">{format(it.value)}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Radial meter — one ratio against its limit
//
// A single share of a whole, which is the one job a ring does better than a
// bar: the track IS the limit, so "9 of 12" reads without an axis. Same hue
// for track and fill, two steps apart, because there is only one measure here.
// ---------------------------------------------------------------------------

export function RadialMeter({ value, max, size = 116, thickness = 11, label, sublabel, color = "var(--accent)" }) {
  const share = max > 0 ? Math.min(1, value / max) : 0;
  const radius = (size - thickness) / 2;
  const circumference = TAU * radius;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`${label}: ${value} of ${max}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--inset)" strokeWidth={thickness} />
        {share > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${share * circumference} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 660, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
          {label}
        </div>
        {sublabel && <div className="mono faint" style={{ fontSize: 10, marginTop: 3 }}>{sublabel}</div>}
      </div>
    </div>
  );
}
