import { useEffect, useMemo, useState } from "react";
import { Sprout } from "lucide-react";
import { fetchGoalCredit } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import LoadError from "./ui/LoadError";
import { intensityColor } from "../lib/nodeStyle";
import { fmtMinutes } from "../lib/categories";
import "../styles/goals.css";

// A goal that got no time reads as a dash, not "0m".
function fmtHours(minutes) {
  return (Number(minutes) || 0) < 1 ? "—" : fmtMinutes(minutes);
}

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// A goal's share of the busiest one, on the same light ramp as the Year view.
const shade = (share) => intensityColor(share);
const LEGEND_STEPS = [0.1, 0.4, 0.7, 1].map(shade);

// The Day page remounts this card after every change on it, so the last
// answer for each range is kept and shown while the next one loads, rather
// than the card blinking out and back.
const lastAnswer = new Map();

// "I can see how each task and each minute I spent benefited specific goals
// on my goal tree."
//
// Shown as the tree's own hierarchy rather than a flat ranking, because the
// answer people actually want is which PILLAR got fed — and a pillar is
// never logged against directly. Credit rolls up (see goal_credit), so a
// root shows the sum of everything beneath it while each row still reports
// what landed on it directly.
export default function GoalFruits({ startDate, endDate, title = "The fruits" }) {
  const range = `${startDate}|${endDate}`;
  const { data, error, reload } = useLoad(() => fetchGoalCredit(startDate, endDate), [startDate, endDate]);
  useEffect(() => {
    if (data) lastAnswer.set(range, data);
  }, [range, data]);
  const rows = data ?? lastAnswer.get(range);

  const { roots, branches, maxTotal } = useMemo(() => {
    const sorted = [...(rows ?? [])].sort((a, b) => Number(b.total_minutes) - Number(a.total_minutes));
    return {
      roots: sorted.filter((r) => r.depth === 0),
      branches: sorted.filter((r) => r.depth > 0),
      maxTotal: Math.max(1, ...sorted.map((r) => Number(r.total_minutes) || 0)),
    };
  }, [rows]);

  // Nothing to show yet: the first load stays quiet, a failed one says so.
  if (!rows && !error) return null;

  return (
    <div className="card goal-fruits">
      <div className="card-head">
        <span className="card-title">
          <Sprout size={14} />
          {title}
        </span>
        {roots.length > 0 && (
          <span className="ramp-legend" aria-hidden="true">
            Less
            {LEGEND_STEPS.map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
            More
          </span>
        )}
      </div>

      {error && <LoadError what="what fed your goals" error={error} onRetry={reload} stale={Boolean(rows)} className="goal-fruits__error" />}

      {rows?.length === 0 && (
        <p className="card-note">Nothing here traces to a goal yet.</p>
      )}

      {roots.map((root) => {
        const minutes = Number(root.total_minutes) || 0;
        return (
          <div key={root.node_id} className="goal-fruits__root">
            <div className="goal-fruits__line">
              <span className="goal-fruits__name">{root.title}</span>
              <span className="goal-fruits__meta">
                {fmtHours(minutes)}
                {root.total_tasks > 0 && ` · ${count(root.total_tasks, "task done", "tasks done")}`}
                {root.total_wins > 0 && ` · ${count(root.total_wins, "win", "wins")}`}
              </span>
            </div>
            <div className="goal-fruits__track">
              <div style={{ width: `${(minutes / maxTotal) * 100}%`, background: shade(minutes / maxTotal) }} />
            </div>
          </div>
        );
      })}

      <Detail rows={branches} maxTotal={maxTotal} />
    </div>
  );
}

// The branches and leaves under the pillars, ranked. Collapsed by default —
// the pillars answer "what did today serve", this answers "through what".
// Flush left on purpose: indenting by depth in a list sorted by minutes made
// a goal look like it sat under whichever row happened to rank above it.
function Detail({ rows, maxTotal }) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;
  const shown = open ? rows : rows.slice(0, 5);

  return (
    <div className="goal-fruits__detail">
      <div className="goal-fruits__through">Through these goals</div>
      {shown.map((r) => (
        <div key={r.node_id} className="goal-fruits__row">
          <span className="goal-fruits__dot" style={{ background: shade((Number(r.total_minutes) || 0) / maxTotal) }} />
          <span className="goal-fruits__row-name">{r.title}</span>
          <span className="goal-fruits__row-meta">
            {fmtHours(r.total_minutes)}
            {r.total_wins > 0 && ` · ${count(r.total_wins, "win", "wins")}`}
          </span>
        </div>
      ))}
      {rows.length > 5 && (
        <button type="button" className="btn-link goal-fruits__more" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}
