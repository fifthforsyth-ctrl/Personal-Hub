import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sprout, Link2 } from "lucide-react";
import { fetchGoalCredit } from "../lib/api";
import { intensityColor } from "../lib/nodeStyle";

function fmtHours(minutes) {
  const m = Number(minutes) || 0;
  if (m < 1) return "—";
  if (m < 60) return `${Math.round(m)}m`;
  const h = Math.floor(m / 60);
  const rem = Math.round(m % 60);
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

// "I can see how each task and each minute I spent benefited specific goals
// on my goal tree."
//
// Shown as the tree's own hierarchy rather than a flat ranking, because the
// answer people actually want is which PILLAR got fed — and a pillar is
// never logged against directly. Credit rolls up (see goal_credit), so a
// root shows the sum of everything beneath it while each row still reports
// what landed on it directly.
export default function GoalFruits({ startDate, endDate, title = "The fruits" }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchGoalCredit(startDate, endDate)
      .then((r) => !cancelled && setRows(r))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  const { roots, byDepth } = useMemo(() => {
    const sorted = [...rows].sort((a, b) => Number(b.total_minutes) - Number(a.total_minutes));
    return {
      roots: sorted.filter((r) => r.depth === 0),
      byDepth: sorted,
    };
  }, [rows]);

  const maxTotal = Math.max(...rows.map((r) => Number(r.total_minutes) || 0), 1);

  if (loading) return null;

  if (rows.length === 0) {
    return (
      <div className="card">
        <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Sprout size={12} />
          {title}
        </div>
        <p className="placeholder-note" style={{ fontSize: 13, margin: "0 0 10px" }}>
          Nothing here traces to a goal yet. Entries connect to your tree through what you track — set that up once and
          this fills in for every day you've already logged.
        </p>
        <Link to="/links" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700 }}>
          <Link2 size={13} />
          Set up what feeds what
        </Link>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Sprout size={12} />
        {title}
      </div>

      {roots.map((root) => {
        const isOpen = expanded.has(root.node_id);
        const children = byDepth.filter((r) => r.depth > 0 && r.total_minutes > 0);
        return (
          <div key={root.node_id} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 5 }}>
              <span style={{ fontWeight: 700, fontSize: 14, fontFamily: "var(--font-display)", minWidth: 0 }}>{root.title}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>
                {fmtHours(root.total_minutes)}
                {root.total_tasks > 0 ? ` · ${root.total_tasks} done` : ""}
                {root.total_wins > 0 ? ` · ${root.total_wins}W` : ""}
              </span>
            </div>
            <div style={{ height: 9, background: "var(--bg-inset)", borderRadius: 5, overflow: "hidden" }}>
              <div
                style={{
                  width: `${(Number(root.total_minutes) / maxTotal) * 100}%`,
                  height: "100%",
                  background: intensityColor(0.55 + (Number(root.total_minutes) / maxTotal) * 0.45),
                  borderRadius: 5,
                }}
              />
            </div>
          </div>
        );
      })}

      <Detail rows={byDepth.filter((r) => r.depth > 0)} maxTotal={maxTotal} />
    </div>
  );
}

// The branches and leaves under the pillars, ranked. Collapsed by default —
// the pillars answer "what did today serve", this answers "through what".
function Detail({ rows, maxTotal }) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;
  const shown = open ? rows : rows.slice(0, 5);

  return (
    <div style={{ marginTop: 4, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
      <div style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
        Through
      </div>
      {shown.map((r) => (
        <div key={r.node_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: intensityColor(0.4 + (Number(r.total_minutes) / maxTotal) * 0.6),
              flexShrink: 0,
              marginLeft: Math.min(r.depth - 1, 3) * 10,
            }}
          />
          <span style={{ flex: 1, fontSize: 12.5, minWidth: 0, color: "var(--text-muted)" }}>{r.title}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)", flexShrink: 0 }}>
            {fmtHours(r.total_minutes)}
            {r.total_wins > 0 ? ` · ${r.total_wins}W` : ""}
          </span>
        </div>
      ))}
      {rows.length > 5 && (
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ background: "none", border: "none", color: "var(--accent-strong)", fontSize: 11.5, fontWeight: 700, padding: "8px 0 0" }}
        >
          {open ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}
