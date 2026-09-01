import { useMemo, useState } from "react";
import { colorFor, fmtMinutes } from "../../lib/categories";
import { minutesOf, fmtTime } from "../../lib/planDates";

// The map of the day: what you meant to do on top, what you actually did
// underneath, on one shared clock.
//
// Plan-vs-actual is usually shown as two numbers ("planned 480m, logged
// 512m"), which tells you nothing about WHERE the day bent. Laid out on the
// same axis, the answer is immediate — the block that started an hour late,
// the afternoon with nothing under it at all.

const PAD = 30; // minutes of breathing room at each end

export default function DayTimeline({ chunks, entries, height = 26 }) {
  const [hover, setHover] = useState(null);

  const { start, end, planned, actual } = useMemo(() => {
    const plannedBars = chunks
      .map((c) => ({
        id: c.id,
        from: minutesOf(c.start_time),
        to: minutesOf(c.end_time),
        title: c.title,
        label: `${fmtTime(c.start_time)}–${fmtTime(c.end_time)}`,
      }))
      .filter((b) => b.to > b.from);

    const actualBars = entries
      .filter((e) => e.ended_at)
      .map((e) => {
        const s = new Date(e.started_at);
        const f = new Date(e.ended_at);
        const tags = e.tags?.length ? e.tags : [e.category];
        return {
          id: e.id,
          from: s.getHours() * 60 + s.getMinutes(),
          to: f.getHours() * 60 + f.getMinutes(),
          title: e.description || tags[0] || "Untitled",
          category: tags[0],
          minutes: Number(e.duration_minutes) || 0,
          label: s.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        };
      })
      // An entry that crosses midnight would render as a negative-width bar;
      // clip it at the end of the day it started in rather than drop it.
      .map((b) => (b.to <= b.from ? { ...b, to: 24 * 60 } : b));

    const all = [...plannedBars, ...actualBars];
    if (all.length === 0) return { start: 6 * 60, end: 22 * 60, planned: [], actual: [] };

    const lo = Math.max(0, Math.min(...all.map((b) => b.from)) - PAD);
    const hi = Math.min(24 * 60, Math.max(...all.map((b) => b.to)) + PAD);
    return { start: lo, end: Math.max(hi, lo + 120), planned: plannedBars, actual: actualBars };
  }, [chunks, entries]);

  const span = end - start;
  const pct = (m) => ((m - start) / span) * 100;

  // An hour label every two or three hours, never every hour — the ticks are
  // orientation, not a scale you read values off.
  const step = span > 12 * 60 ? 180 : 120;
  const ticks = [];
  for (let m = Math.ceil(start / step) * step; m < end; m += step) ticks.push(m);

  if (planned.length === 0 && actual.length === 0) return null;

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "relative", height: 12 }}>
        {ticks.map((m) => (
          <span key={m} className="mono faint" style={{ position: "absolute", left: `${pct(m)}%`, fontSize: 9.5, transform: "translateX(-50%)" }}>
            {String(Math.floor(m / 60) % 12 || 12)}
            {m / 60 >= 12 ? "p" : "a"}
          </span>
        ))}
      </div>

      <Lane label="Planned" bars={planned} pct={pct} height={height} onHover={setHover}
        color={() => "var(--line-strong)"} ticks={ticks} />
      <Lane label="Actual" bars={actual} pct={pct} height={height} onHover={setHover}
        color={(b) => colorFor(b.category)} ticks={ticks} />

      {hover && (
        <div className="chart-tip" style={{ left: `${Math.min(92, Math.max(8, pct((hover.from + hover.to) / 2)))}%`, top: -4 }}>
          <div className="chart-tip__k">{hover.title}</div>
          <div className="chart-tip__v">
            {hover.label}
            {hover.minutes ? ` · ${fmtMinutes(hover.minutes)}` : ""}
          </div>
        </div>
      )}
    </div>
  );
}

function Lane({ label, bars, pct, height, color, onHover, ticks }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div className="eyebrow" style={{ fontSize: 9.5, marginBottom: 4 }}>{label}</div>
      <div style={{ position: "relative", height, background: "var(--inset)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
        {ticks.map((m) => (
          <span key={m} style={{ position: "absolute", left: `${pct(m)}%`, top: 0, bottom: 0, width: 1, background: "var(--line)" }} />
        ))}
        {bars.map((b) => (
          <span
            key={b.id}
            title={`${b.title} · ${b.label}`}
            onMouseEnter={() => onHover(b)}
            onMouseLeave={() => onHover(null)}
            style={{
              position: "absolute",
              left: `${pct(b.from)}%`,
              // The 2px inset is the surface gap every other chart here uses,
              // and it also keeps a five-minute entry from vanishing.
              width: `calc(${Math.max(pct(b.to) - pct(b.from), 0.6)}% - 2px)`,
              top: 3,
              bottom: 3,
              background: color(b),
              borderRadius: 4,
              cursor: "default",
            }}
          />
        ))}
        {bars.length === 0 && (
          <span className="faint" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10.5 }}>
            nothing {label.toLowerCase()}
          </span>
        )}
      </div>
    </div>
  );
}
