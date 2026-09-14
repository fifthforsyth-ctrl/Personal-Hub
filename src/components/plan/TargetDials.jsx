import { useMemo, useState } from "react";
import { Minus, Plus, RotateCcw, Scale } from "lucide-react";
import { colorFor, fmtMinutes } from "../../lib/categories";

// What the draft actually contains, against what was asked for.
//
// A week is a zero-sum object — that is the entire fact the dials exist to
// make visible. "Not enough study" is never a statement about study alone;
// it is a statement that study should have some of what something else is
// currently holding. So raising one dial lowers the largest of the others by
// the same amount, and says so out loud. You are not setting numbers in
// isolation, you are moving time from one place to another.
//
// Nothing here reshuffles blocks. Moving a dial changes what you are ASKING
// for; the planner is then run again with those amounts as hard constraints,
// because rearranging seven days around a new split is exactly the work it
// is for.

const STEP = 30; // minutes per press — smaller than this and rebalancing is a chore

export default function TargetDials({ targets, days, onRebalance, busy }) {
  const planned = useMemo(() => plannedByTarget(targets, days), [targets, days]);
  const defaults = useMemo(
    () => Object.fromEntries(targets.map((t) => [t.id, Number(t.weekly_minutes) || 0])),
    [targets]
  );

  // Every change is computed from the previous value rather than from what
  // this render happened to close over. Pressing + twice quickly used to
  // move thirty minutes, not sixty: both presses read the same stale map and
  // the second simply overwrote the first.
  const [amounts, setAmounts] = useState(null);

  const current = amounts ?? defaults;
  const touched = amounts !== null;

  // What has moved in total, not what moved on the last press — after four
  // taps "moved 30m" is a true sentence about the wrong thing.
  const moves = useMemo(
    () =>
      targets
        .map((t) => ({ label: t.label, delta: (current[t.id] ?? 0) - (defaults[t.id] ?? 0) }))
        .filter((m) => m.delta !== 0)
        .sort((a, b) => b.delta - a.delta),
    [targets, current, defaults]
  );

  function adjust(targetId, delta) {
    setAmounts((prev) => {
      const base = { ...(prev ?? defaults) };
      const donor = targets
        .filter((t) => t.id !== targetId)
        .sort((a, b) => (base[b.id] ?? 0) - (base[a.id] ?? 0))[0];

      // Never take more than the donor has, and never drive a dial below zero.
      const room =
        delta > 0 ? Math.min(delta, donor ? base[donor.id] ?? 0 : delta) : Math.min(-delta, base[targetId] ?? 0);
      const moved = delta > 0 ? room : -room;
      if (moved === 0) return prev;

      base[targetId] = (base[targetId] ?? 0) + moved;
      if (donor) base[donor.id] = (base[donor.id] ?? 0) - moved;
      return base;
    });
  }

  function reset() {
    setAmounts(null);
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="section-label" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <Scale size={12} />
        What this draft holds
      </div>

      <div className="dial-row">
        {targets.map((t) => (
          <Dial
            key={t.id}
            label={t.label}
            color={t.categories?.[0] ? colorFor(t.categories[0]) : "var(--accent)"}
            planned={planned[t.id] ?? 0}
            target={Number(t.weekly_minutes) || 0}
            wanted={current[t.id] ?? 0}
            touched={touched}
            onAdjust={(delta) => adjust(t.id, delta)}
          />
        ))}
      </div>

      {moves.length > 0 && (
        <p style={{ fontSize: 11.5, margin: "10px 0 0", textAlign: "center", color: "var(--text-muted)" }}>
          {moves.map((m, i) => (
            <span key={m.label}>
              {i > 0 && <span className="faint"> · </span>}
              {m.label}{" "}
              <strong style={{ fontWeight: 650, color: m.delta > 0 ? "var(--accent)" : "var(--text-3)" }}>
                {m.delta > 0 ? "+" : "−"}
                {fmtMinutes(Math.abs(m.delta))}
              </strong>
            </span>
          ))}
        </p>
      )}

      {touched && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btn-secondary" onClick={reset} disabled={busy} style={{ flex: "0 0 auto", width: "auto" }}>
            <RotateCcw size={13} />
          </button>
          <button
            className="btn btn--accent"
            style={{ flex: 1 }}
            onClick={() => onRebalance(targets.map((t) => ({ label: t.label, weekly_minutes: current[t.id] ?? 0 })))}
            disabled={busy}
          >
            {busy ? "Rebalancing…" : "Rebalance the week to these"}
          </button>
        </div>
      )}

      {!touched && (
        <p className="faint" style={{ fontSize: 11.5, margin: "10px 0 0", textAlign: "center" }}>
          Press − or + to move time between them. Raising one takes it from whichever is largest.
        </p>
      )}
    </div>
  );
}

function Dial({ label, color, planned, target, wanted, touched, onAdjust }) {
  const goal = touched ? wanted : target;
  const fraction = goal > 0 ? Math.min(1.15, planned / goal) : 0;
  const short = planned < goal;

  // A three-quarter gauge: the gap at the bottom is where the numbers go,
  // and an open arc reads as a measurement where a closed circle reads as a
  // proportion of itself.
  const size = 92;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 7;
  const stroke = 8;
  const SWEEP = 270;
  const START = 135;

  const arc = (from, to) => {
    const a1 = ((START + from * SWEEP) * Math.PI) / 180;
    const a2 = ((START + to * SWEEP) * Math.PI) / 180;
    const large = (to - from) * SWEEP > 180 ? 1 : 0;
    return `M ${(cx + r * Math.cos(a1)).toFixed(2)} ${(cy + r * Math.sin(a1)).toFixed(2)} A ${r} ${r} 0 ${large} 1 ${(
      cx +
      r * Math.cos(a2)
    ).toFixed(2)} ${(cy + r * Math.sin(a2)).toFixed(2)}`;
  };

  return (
    <div className="dial">
      <div style={{ position: "relative", width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: "block" }}>
          <path d={arc(0, 1)} fill="none" stroke="var(--inset)" strokeWidth={stroke} strokeLinecap="round" />
          {fraction > 0 && (
            <path
              d={arc(0, Math.min(1, fraction))}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
            />
          )}
          {/* Past the goal, a second thinner arc rides over the top rather
              than the fill silently clipping at full. */}
          {fraction > 1 && (
            <path
              d={arc(0, Math.min(1, fraction - 1))}
              fill="none"
              stroke="var(--bg)"
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.7}
            />
          )}
        </svg>
        <div className="dial__centre">
          <span className="dial__planned">{fmtMinutes(planned)}</span>
          <span className="dial__goal" style={{ color: short ? "var(--text-faint)" : color }}>
            of {fmtMinutes(goal)}
          </span>
        </div>
      </div>

      <div className="dial__name">{label}</div>

      <div className="dial__controls">
        <button onClick={() => onAdjust(-STEP)} title={`30 minutes less`}>
          <Minus size={12} />
        </button>
        <button onClick={() => onAdjust(STEP)} title={`30 minutes more`}>
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

// Every block in the draft, totalled against the categories each target
// names. Blocks already on the calendar count too — a study commitment is
// study, whoever put it there.
export function plannedByTarget(targets, days) {
  const totals = Object.fromEntries(targets.map((t) => [t.id, 0]));
  for (const day of days ?? []) {
    for (const block of day.blocks ?? []) {
      if (!block.category) continue;
      const minutes = spanMinutes(block.start, block.end);
      if (minutes <= 0) continue;
      for (const t of targets) {
        if ((t.categories ?? []).includes(block.category)) totals[t.id] += minutes;
      }
    }
  }
  return totals;
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm ?? "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
}

// A block that ends before it starts has crossed midnight, which is how
// sleep is written — 22:00 to 06:00 is eight hours, not minus sixteen.
function spanMinutes(start, end) {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (!start || !end) return 0;
  return e > s ? e - s : 1440 - s + e;
}
