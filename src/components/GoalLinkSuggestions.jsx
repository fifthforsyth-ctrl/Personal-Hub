import { useState } from "react";
import { Sparkles, Check, ArrowRight, X } from "lucide-react";
import { suggestGoalLinks, applyGoalLinks } from "../lib/api";
import { fmtMinutes } from "../lib/categories";

const CONFIDENCE_COLOR = {
  high: "var(--accent-strong)",
  medium: "var(--text-muted)",
  low: "var(--text-faint)",
};

// "Be as fluid as I can throughout the day, then have AI put the brass tacks
// on everything."
//
// Category mapping is coarse by nature — every Serve entry lands in the same
// place. The descriptions are where the meaning is: "Serve zone making app"
// and "Help sister Shumway" are both Serve and feed different branches. This
// reads what was actually written and proposes a link per entry.
//
// Nothing is written until accepted, and low-confidence rows are left
// unchecked by default — a wrong link is worse than none, because it makes
// the fruits view quietly lie.
export default function GoalLinkSuggestions({ date, onApplied }) {
  const [result, setResult] = useState(null);
  const [chosen, setChosen] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(0);
  const [error, setError] = useState(null);

  async function run() {
    setLoading(true);
    setError(null);
    setApplied(0);
    try {
      const data = await suggestGoalLinks(date);
      setResult(data);
      // Pre-check what the model is confident about; leave the rest to you.
      setChosen(new Set(data.links.filter((l) => l.confidence !== "low").map((l) => l.entry_id)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggle(id) {
    setChosen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function apply() {
    const links = result.links.filter((l) => chosen.has(l.entry_id));
    if (links.length === 0) return;
    setApplying(true);
    try {
      await applyGoalLinks(links);
      setApplied(links.length);
      setResult(null);
      await onApplied?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="card">
      <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Sparkles size={12} />
        What did this time serve?
      </div>

      {!result && !loading && (
        <>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px", lineHeight: 1.55 }}>
            {applied > 0
              ? `Linked ${applied} ${applied === 1 ? "entry" : "entries"}.`
              : "Read this day's descriptions and propose which goal each stretch of time actually fed."}
          </p>
          <button onClick={run} className="btn-primary" style={{ width: "auto", margin: 0 }}>
            {applied > 0 ? "Review again" : "Read the day"}
          </button>
        </>
      )}

      {loading && <p className="placeholder-note" style={{ margin: 0 }}>Reading the day…</p>}

      {error && <div className="form-error" style={{ margin: "10px 0 0" }}>{error}</div>}

      {result && result.links.length === 0 && (
        <p className="placeholder-note" style={{ margin: 0 }}>Nothing to link on this day.</p>
      )}

      {result && result.links.length > 0 && (
        <>
          <p style={{ fontSize: 11.5, color: "var(--text-faint)", margin: "-4px 0 10px" }}>
            Tap a row to include or exclude it. Low-confidence guesses start off.
          </p>

          {result.links.map((link) => {
            const on = chosen.has(link.entry_id);
            const entry = result.entries?.find?.((e) => e.id === link.entry_id);
            return (
              <button
                key={link.entry_id}
                onClick={() => toggle(link.entry_id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: on ? "var(--bg-inset)" : "transparent",
                  border: `1px solid ${on ? "var(--accent-strong)" : "var(--border)"}`,
                  borderRadius: 9,
                  padding: "9px 11px",
                  marginBottom: 6,
                  color: "inherit",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 15,
                      height: 15,
                      borderRadius: 4,
                      border: `1px solid ${on ? "var(--accent-strong)" : "var(--border-strong)"}`,
                      background: on ? "var(--accent)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {on && <Check size={11} color="#180f00" />}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, minWidth: 0 }}>{link.what ?? entry?.what ?? "Entry"}</span>
                  <span style={{ fontSize: 9.5, fontFamily: "var(--font-mono)", color: CONFIDENCE_COLOR[link.confidence], textTransform: "uppercase", flexShrink: 0 }}>
                    {link.confidence}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, marginLeft: 23, fontSize: 11.5 }}>
                  <ArrowRight size={11} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
                  <span style={{ color: link.goal_path ? "var(--accent-strong)" : "var(--text-faint)", minWidth: 0 }}>
                    {link.goal_path ?? "No goal — serves none"}
                  </span>
                </div>

                {link.why && (
                  <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 3, marginLeft: 23, lineHeight: 1.45 }}>{link.why}</div>
                )}
              </button>
            );
          })}

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => setResult(null)} className="btn-secondary">
              <X size={13} />
            </button>
            <button onClick={apply} disabled={applying || chosen.size === 0} className="btn-primary" style={{ width: "auto", flex: 1, margin: 0 }}>
              {applying ? "Linking…" : `Link ${chosen.size} ${chosen.size === 1 ? "entry" : "entries"}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
