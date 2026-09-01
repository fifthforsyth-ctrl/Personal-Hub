import { useEffect, useState } from "react";
import { Sparkles, Check, RefreshCw, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { proposePlans, applyProposedPlan, setDayNotes, fetchDayPlan } from "../../lib/api";
import { addDays, fmtDayHeading, fmtTime } from "../../lib/planDates";

// The last step of the evening, in order: write down what the app can't know
// about tomorrow, then ask for three plans, then pick one.
//
// The notes box comes BEFORE the button on purpose. Everything else the
// assistant reads is history; this is the only place a fixed appointment, a
// change of plan, or "I'm exhausted" can enter the picture — and once the
// proposals are on screen you stop thinking about what it was missing.
export default function Tomorrow({ userId, date, reflectionDone }) {
  const tomorrow = addDays(date, 1);

  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(true);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [applying, setApplying] = useState(null);
  const [applied, setApplied] = useState(null);
  const [openPlan, setOpenPlan] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setApplied(null);
    if (!userId) return;
    fetchDayPlan(userId, tomorrow)
      .then((p) => !cancelled && setNotes(p?.notes ?? ""))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, tomorrow]);

  async function saveNotes() {
    try {
      await setDayNotes(userId, tomorrow, notes);
      setNotesSaved(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setApplied(null);
    try {
      // Persist first: the plan you get should always be the plan your notes
      // asked for, even if you never blurred the textarea.
      await setDayNotes(userId, tomorrow, notes);
      setNotesSaved(true);
      setResult(await proposePlans({ notes, forDate: tomorrow }));
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
      <div className="card-head">
        <span className="card-title"><Sparkles size={14} />Plan {fmtDayHeading(tomorrow)}</span>
        {!reflectionDone && (
          <span className="chip"><Lock size={11} />Reflect first</span>
        )}
      </div>

      {!reflectionDone && (
        <p className="card-note" style={{ marginBottom: 14 }}>
          Tomorrow gets planned after today gets read. Finish the reflection above and this opens up.
        </p>
      )}

      <label className="field" style={{ opacity: reflectionDone ? 1 : 0.5 }}>
        <span>Anything the assistant should know about tomorrow?</span>
        <textarea
          className="textarea"
          value={notes}
          disabled={!reflectionDone}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesSaved(false);
          }}
          onBlur={saveNotes}
          placeholder="Zone conference at 10. Sister missionary transfer in the afternoon. Low energy — keep the morning light."
          style={{ minHeight: 76 }}
        />
      </label>

      <div className="row row--between" style={{ flexWrap: "wrap", gap: 8, marginTop: -6 }}>
        <span className="faint" style={{ fontSize: 11.5 }}>
          {notes.trim()
            ? notesSaved
              ? "Saved to tomorrow."
              : "Unsaved — it'll be saved when you generate."
            : "Read alongside your last two weeks."}
        </span>
        {!result && (
          <button className="btn btn--accent" onClick={generate} disabled={loading || !reflectionDone}>
            <Sparkles size={15} />
            {loading ? "Reading the last two weeks…" : "Generate plan"}
          </button>
        )}
      </div>

      {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}

      {result?.plans?.map((plan, i) => {
        const isOpen = openPlan === i;
        return (
          <div
            key={i}
            style={{
              border: `1px solid ${isOpen ? "var(--accent-line)" : "var(--line)"}`,
              borderRadius: "var(--r)",
              padding: 13,
              marginTop: 10,
              background: isOpen ? "var(--inset)" : "transparent",
            }}
          >
            <button
              onClick={() => setOpenPlan(isOpen ? -1 : i)}
              className="row"
              style={{ gap: 9, width: "100%", background: "none", border: "none", color: "inherit", textAlign: "left", padding: 0, alignItems: "flex-start" }}
            >
              {isOpen ? <ChevronDown size={15} style={{ marginTop: 2, flexShrink: 0 }} /> : <ChevronRight size={15} style={{ marginTop: 2, flexShrink: 0 }} />}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 620, fontSize: 14.5 }}>{plan.name}</span>
                <span className="muted" style={{ display: "block", fontSize: 12.5, marginTop: 2 }}>{plan.strategy}</span>
              </span>
            </button>

            {isOpen && (
              <>
                <p className="card-note" style={{ margin: "11px 0 12px" }}>{plan.rationale}</p>

                <div className="list">
                  {(plan.blocks ?? []).map((b, n) => (
                    <div key={n} style={{ padding: "8px 0" }}>
                      <div className="row row--between" style={{ alignItems: "baseline" }}>
                        <span style={{ fontWeight: 570, fontSize: 13.5 }}>{b.title}</span>
                        <span className="list-row__meta">{fmtTime(b.start)}–{fmtTime(b.end)}</span>
                      </div>
                      {(b.tasks ?? []).map((t, k) => (
                        <div key={k} className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>○ {t}</div>
                      ))}
                    </div>
                  ))}
                </div>

                {applied === i ? (
                  <div className="row" style={{ gap: 6, marginTop: 12, fontSize: 13, color: "var(--accent)" }}>
                    <Check size={15} />
                    {fmtDayHeading(result.for_date ?? tomorrow)} is planned.
                  </div>
                ) : (
                  <button
                    className="btn btn--accent"
                    style={{ marginTop: 12 }}
                    onClick={() => apply(plan, i)}
                    disabled={applying !== null || applied !== null}
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
        <button className="btn-link" style={{ marginTop: 12 }} onClick={generate} disabled={loading}>
          <RefreshCw size={12} />
          Propose again
        </button>
      )}
    </div>
  );
}
