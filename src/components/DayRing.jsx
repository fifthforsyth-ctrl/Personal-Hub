import { useMemo } from "react";
import { colorFor, familyFor, fmtMinutes, FAMILIES } from "../lib/categories";
import {
  resolveRing,
  arcPath,
  windowPath,
  pointAt,
  fmtClock,
  fmtHourShort,
  TICK_MINUTES,
} from "../lib/ring";

// A day as a clock face: the waking day, 5am at the top running clockwise
// round to 10pm, with a small gap at twelve o'clock so the start and the end
// never meet. One object per day, comparable against another day without
// reading anything.
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
  fluid = false,
  fill = false,
  className,
}) {
  const segments = useMemo(() => resolveRing(arcs), [arcs]);

  const stroke = thickness ?? Math.max(6, Math.round(size * 0.19));
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 1;
  const innerR = outerR - stroke;
  const midR = (outerR + innerR) / 2;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label="Day ring: 5am at the top, running clockwise to 10pm"
      style={
        // `fill` lets the viewBox letterbox itself inside a box constrained
        // in BOTH directions — a month cell is square and short, and a ring
        // sized only by width overflows it on a phone.
        fill
          ? { display: "block", width: "100%", height: "100%" }
          : fluid
          ? { display: "block", width: "100%", height: "auto", maxWidth: size }
          : { display: "block", width: size, height: size, flexShrink: 0 }
      }
    >
      {/* The unaccounted-for part of the day. Visible, because a ring that
          is mostly gap is telling you something true. */}
      <path d={windowPath(cx, cy, outerR, innerR)} fill="var(--inset)" />

      {segments.map((s) => {
        const d = arcPath(cx, cy, outerR, innerR, s.start_min, s.end_min);
        if (!d) return null;
        return (
          <path key={`${s.category}-${s.start_min}`} d={d} fill={colorFor(s.category)}>
            <title>
              {`${s.category} · ${fmtClock(s.start_min)}–${fmtClock(s.end_min)} · ${fmtMinutes(s.end_min - s.start_min)}`}
            </title>
          </path>
        );
      })}

      {/* Hour marks. Without them a ring is just a shape; with them you can
          see that the green sits at six in the morning. */}
      {showTicks &&
        TICK_MINUTES.map((m) => {
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
              strokeWidth={m === 720 ? 1.5 : 0.9}
              opacity={m === 720 ? 0.85 : 0.5}
            />
          );
        })}

      {/* Only the hour marks are labelled. The window's own ends sit 22
          degrees apart across the gap, so labelling those too puts "10p" and
          "5a" on top of each other; the gap already says where the day
          starts and stops. */}
      {showLabels && (
        <>
          {TICK_MINUTES.map((m) => {
            const [x, y] = pointAt(cx, cy, innerR - size * 0.055, m);
            return (
              <text key={m} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="ring-label">
                {fmtHourShort(m)}
              </text>
            );
          })}
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
    <div>
      {/* The ring is windowed, so its totals are not the day's totals. Say
          which window, or the two sets of numbers on this card look like a
          bug. */}
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-faint)",
          marginBottom: 9,
        }}
      >
        The ring · 5am to 10pm
      </div>

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
    </div>
  );
}
