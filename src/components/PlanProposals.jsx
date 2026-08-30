import { useState } from "react";
import { Sparkles, Check, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { proposePlans, applyProposedPlan } from "../lib/api";
import { addDays, fmtDayHeading, fmtTime } from "../lib/planDates";

// "After I have seen the total of my day, the fruits of it when it comes to
// my goals, and have reflected ... I am given 3 different options for a plan
// for the next day."
//
// Deliberately not generated on page load: this is the last step of an
// evening review, it costs money per call, and a proposal you didn't ask for
// is just noise. You press the button when you're ready to plan.
export default function PlanProposals({ userId, date }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [applying, setApplying] = useState(null);
  const [applied, setApplied] = useState(null);
  const [openPlan, setOpenPlan] = useState(0);

  const tomorrow = addDays(date, 1);

  async function generate() {
    setLoading(true);
    setError(null);
    setApplied(null);
    try {
      setResult(await proposePlans());
      setOpenPlan(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function apply(plan, index) {
    setApplying(index);
    try {
      await applyProposedPlan(userId, result.for_date ?? tomorrow, plan);
      setApplied(index);
    } catch (err) {
      setError(err.message);
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="card">
      <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Sparkles size={12} />
        Tomorrow
      </div>

      {!result && !loading && (
        <>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px", lineHeight: 1.55 }}>
            Three ways to shape {fmtDayHeading(tomorrow)}, read from your last two weeks — what got done, which goals
            have gone quiet, and the block shapes you actually use.
          </p>
          <button onClick={generate} className="btn-primary" style={{ width: "auto", margin: 0 }}>
            Propose three plans
          </button>
        </>
      )}

      {loading && <p className="placeholder-note" style={{ margin: 0 }}>Reading the last two weeks…</p>}

      {error && (
        <div className="form-error" style={{ marginBottom: 10 }}>
          {error}
        </div>
      )}

      {result?.plans?.map((plan, i) => {
        const isOpen = openPlan === i;
        return (
          <div
            key={i}
            style={{
              border: `1px solid ${isOpen ? "var(--accent-strong)" : "var(--border)"}`,
              borderRadius: 8,
              padding: 12,
              marginBottom: 8,
              background: isOpen ? "var(--bg-inset)" : "transparent",
            }}
          >
            <button
              onClick={() => setOpenPlan(isOpen ? -1 : i)}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", color: "inherit", textAlign: "left", padding: 0 }}
            >
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 14, fontFamily: "var(--font-display)" }}>{plan.name}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{plan.strategy}</span>
              </span>
            </button>

            {isOpen && (
              <>
                <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6, margin: "10px 0 12px" }}>
                  {plan.rationale}
                </p>

                {(plan.blocks ?? []).map((b, n) => (
                  <div key={n} style={{ padding: "6px 0", borderTop: n === 0 ? "none" : "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{b.title}</span>
                      <span className="entry-meta">
                        {fmtTime(b.start)}–{fmtTime(b.end)}
                      </span>
                    </div>
                    {(b.tasks ?? []).map((t, k) => (
                      <div key={k} style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                        ○ {t}
                      </div>
                    ))}
                  </div>
                ))}

                {applied === i ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 13, color: "var(--accent-strong)" }}>
                    <Check size={14} />
                    Added to {fmtDayHeading(result.for_date ?? tomorrow)}.
                  </div>
                ) : (
                  <button
                    onClick={() => apply(plan, i)}
                    disabled={applying !== null || applied !== null}
                    className="btn-primary"
                    style={{ width: "auto", marginTop: 12 }}
                  >
                    {applying === i ? "Adding…" : "Use this plan"}
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}

      {result && (
        <button onClick={generate} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "var(--accent-strong)", fontSize: 11.5, fontWeight: 700, padding: "4px 0 0" }}>
          <RefreshCw size={12} />
          Propose again
        </button>
      )}
    </div>
  );
}
