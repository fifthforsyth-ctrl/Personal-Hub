import { useMemo } from "react";
import { colorFor, familyFor, fmtMinutes, FAMILIES } from "../lib/categories";
import { resolveRing, arcPath, pointAt, fmtClock } from "../lib/ring";

// A day as a clock face: midnight at the top, noon at the bottom, morning
// down the right-hand side. One revolution is twenty-four hours, so the
// whole shape of a day is a single object you can compare against another
// day without reading anything.
//
// Deliberately not a bar. A bar tells you how much; this tells you WHEN,
// which is the question you are actually asking when you look back at a
// Tuesday and wonder where it went.
export default function DayRing({
  arcs = [],
  size = 76,
  thickness,
  showTicks = true,
  showLabels = false,
  className,
}) {
  const segments = useMemo(() => resolveRing(arcs), [arcs]);

  const stroke = thickness ?? Math.max(6, Math.round(size * 0.17));
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 1;
  const innerR = outerR - stroke;

  const wholeDay = segments.length === 1 && segments[0].end_min - segments[0].start_min >= 1440;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Day ring: midnight at the top, noon at the bottom"
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* The unaccounted-for part of the day. Visible, because a ring that
          is mostly gap is telling you something true. */}
      <circle cx={cx} cy={cy} r={(outerR + innerR) / 2} fill="none" stroke="var(--inset)" strokeWidth={stroke} />

      {wholeDay ? (
        <circle
          cx={cx}
          cy={cy}
          r={(outerR + innerR) / 2}
          fill="none"
          stroke={colorFor(segments[0].category)}
          strokeWidth={stroke}
        />
      ) : (
        segments.map((s) => {
          const d = arcPath(cx, cy, outerR, innerR, s.start_min, s.end_min);
          if (!d) return null;
          return (
            <path key={`${s.category}-${s.start_min}`} d={d} fill={colorFor(s.category)}>
              <title>
                {`${s.category} · ${fmtClock(s.start_min)}–${fmtClock(s.end_min)} · ${fmtMinutes(s.end_min - s.start_min)}`}
              </title>
            </path>
          );
        })
      )}

      {/* Quarter marks. Without them a ring is just a shape; with them you
          can see that the green sits at six in the morning. */}
      {showTicks &&
        [0, 360, 720, 1080].map((m) => {
          const [x1, y1] = pointAt(cx, cy, innerR, m);
          const [x2, y2] = pointAt(cx, cy, outerR, m);
          return (
            <line
              key={m}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--bg)"
              strokeWidth={m === 0 ? 1.6 : 0.9}
              opacity={m === 0 ? 0.9 : 0.55}
            />
          );
        })}

      {showLabels && (
        <>
          <text x={cx} y={innerR > 18 ? cy - innerR + 12 : cy - 4} textAnchor="middle" className="ring-label">
            12a
          </text>
          <text x={cx} y={cy + innerR - 5} textAnchor="middle" className="ring-label">
            12p
          </text>
        </>
      )}
    </svg>
  );
}

// What the colours mean, grouped the way the palette is built. Shown once
// beside a large ring rather than on every tile.
export function RingLegend({ arcs = [] }) {
  const byFamily = useMemo(() => {
    const totals = new Map();
    for (const s of resolveRing(arcs)) {
      const minutes = s.end_min - s.start_min;
      const family = familyFor(s.category);
      if (!totals.has(family)) totals.set(family, new Map());
      const inner = totals.get(family);
      inner.set(s.category, (inner.get(s.category) ?? 0) + minutes);
    }
    return FAMILIES.map((f) => ({
      ...f,
      items: [...(totals.get(f.key) ?? new Map()).entries()]
        .map(([category, minutes]) => ({ category, minutes }))
        .sort((a, b) => b.minutes - a.minutes),
    })).filter((f) => f.items.length > 0);
  }, [arcs]);

  if (byFamily.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 16px" }}>
      {byFamily.map((f) => (
        <div key={f.key} style={{ minWidth: 96 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-faint)",
              marginBottom: 3,
            }}
          >
            {f.label}
          </div>
          {f.items.map((it) => (
            <div key={it.category} style={{ display: "flex", alignItems: "center", gap: 5, padding: "1.5px 0" }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: colorFor(it.category),
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.category}
              </span>
              <span className="mono faint" style={{ fontSize: 10, marginLeft: "auto", flexShrink: 0 }}>
                {fmtMinutes(it.minutes)}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
