import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, RotateCcw, Scale } from "lucide-react";
import { colorFor, fmtMinutes } from "../../lib/categories";

// What the draft actually contains, against what was asked for.
//
// A week is a zero-sum object, which is the whole reason these exist. But
// WHICH thing gives way is a judgement, not a calculation — an earlier
// version picked the largest dial automatically and quietly took an hour off
// study to pay for work. So the choice is yours: pick where the time comes
// from, then move the dial you care about and watch the other one fall.
//
// Nothing here reshuffles blocks. Moving a dial changes what you are ASKING
// for; the planner is then run again with those amounts as the budget,
// because rearranging seven days around a new split is exactly the work it
// is for.

const STEP = 30; // minutes per press — smaller than this and rebalancing is a chore

// 5am to 10pm, seven days. The ring's window, and the only hours any of
// these targets can actually be spent in.
const WAKING_MINUTES = 17 * 60 * 7;

export default function TargetDials({ targets, days, goals, onRebalance, busy }) {
  const planned = useMemo(() => plannedByTarget(targets, days), [targets, days]);
  // Every change is computed from the previous value rather than from what
  // this render happened to close over. Pressing + twice quickly used to
  // move thirty minutes, not sixty: both presses read the same stale map and
  // the second simply overwrote the first.
  const [amounts, setAmounts] = useState(null);
  useEffect(() => setAmounts(null), [days]);

  // Where a raise takes its time from. Nothing by default: adding without
  // subtracting is a legitimate thing to ask for, and the budget will say if
  // it does not fit.
  const [donorId, setDonorId] = useState("");
  const donor = targets.find((t) => t.id === donorId) ?? null;

  // Untouched, the dials show what the DRAFT holds. Once you start moving
  // them they show what you are asking for — because that is the number the
  // + is changing, and watching the goal move while the amount stays put
  // tells you nothing about what the week will become.
  const draft = useMemo(() => ({ ...planned }), [planned]);
  const current = amounts ?? draft;
  const touched = amounts !== null;

  // What has moved in total, not what moved on the last press — after four
  // taps "moved 30m" is a true sentence about the wrong thing.
  // Sleep sits outside the 5am-10pm window, so it is not competing for these
  // hours and does not belong in the total.
  const asked = targets.reduce((sum, t) => (t.nightly ? sum : sum + (current[t.id] ?? 0)), 0);
  const overbooked = asked > WAKING_MINUTES * 0.86;

  const moves = useMemo(
    () =>
      targets
        .map((t) => ({ label: t.label, delta: (current[t.id] ?? 0) - (draft[t.id] ?? 0) }))
        .filter((m) => m.delta !== 0)
        .sort((a, b) => b.delta - a.delta),
    [targets, current, draft]
  );

  // Raising a dial takes from whichever one you nominated, and lowering it
  // gives back to the same place, so a press and its opposite cancel. With
  // no donor chosen the dial simply moves and the budget reports whatever no
  // longer fits.
  function adjust(targetId, delta) {
    setAmounts((prev) => {
      const base = { ...(prev ?? draft) };
      const paired = donor && donor.id !== targetId ? donor.id : null;

      // Never take more than the donor has, and never drive a dial below
      // zero — a press that cannot happen in full does not happen at all,
      // which keeps the two sides equal.
      const room = paired
        ? delta > 0
          ? Math.min(delta, base[paired] ?? 0)
          : Math.min(-delta, base[targetId] ?? 0)
        : Math.abs(delta);
      const moved = delta > 0 ? room : -room;
      if (moved === 0) return prev;

      base[targetId] = Math.max(0, (base[targetId] ?? 0) + moved);
      if (paired) base[paired] = Math.max(0, (base[paired] ?? 0) - moved);
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
            amount={current[t.id] ?? 0}
            target={goals?.[t.label] ?? (Number(t.weekly_minutes) || 0)}
            changed={(current[t.id] ?? 0) !== (draft[t.id] ?? 0)}
            onAdjust={(delta) => adjust(t.id, delta)}
          />
        ))}
      </div>

      {/* Which dial pays for a raise. A judgement, so it is asked rather
          than guessed — the version that guessed took the hour off study. */}
      <div className="row" style={{ gap: 7, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
        <span className="faint" style={{ fontSize: 11.5 }}>Take the time from</span>
        <select
          className="input"
          value={donorId}
          onChange={(e) => setDonorId(e.target.value)}
          style={{ width: "auto", minWidth: 120, fontSize: 12 }}
        >
          <option value="">nothing — just add it</option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label} ({fmtMinutes(current[t.id] ?? 0)})
            </option>
          ))}
        </select>
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

      <p
        className="faint"
        style={{ fontSize: 11.5, margin: "10px 0 0", textAlign: "center", color: overbooked ? "var(--accent)" : undefined }}
      >
        {fmtMinutes(asked)} of the week's {fmtMinutes(WAKING_MINUTES)} waking hours asked for
        {overbooked ? " — more than the days hold once meals and travel come out." : ", the rest is meals, travel and slack."}
      </p>

      {!touched && (
        <p className="faint" style={{ fontSize: 11.5, margin: "4px 0 0", textAlign: "center" }}>
          Press − or + to change what the week should hold, then rebalance. Pick where the time comes from and
          the other dial moves with it.
        </p>
      )}
    </div>
  );
}

function Dial({ label, color, amount, target, changed, onAdjust }) {
  const fraction = target > 0 ? Math.min(1.15, amount / target) : 0;
  const short = amount < target;

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
          <span className="dial__planned" style={{ color: changed ? "var(--accent)" : "var(--text)" }}>
            {fmtMinutes(amount)}
          </span>
          {/* Not the category colour: Sleep's is nearly black by design, and
              a label nobody can read is worse than an unstyled one. The arc
              carries the colour; this line only has to say met or not. */}
          <span className="dial__goal" style={{ color: short ? "var(--text-faint)" : "var(--text-2)" }}>
            of {fmtMinutes(target)}
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
