import { useState } from "react";
import { Archive, Check, Circle, Sparkles, AlertCircle } from "lucide-react";
import { bankDay, writeDaySynopsis } from "../../lib/api";

// Closing the day out.
//
// Reflect, then bank it: that's the evening. Banking used to also wait on
// every minute being linked to a goal and tomorrow being planned, but you
// plan on Sundays and the goal links weren't telling you anything, so the
// reflection is the one thing asked for now.
//
// It stays possible to bank without it. A day you couldn't reflect on is
// still a day, and an app that refuses to close it is wrong about your life.
export default function CloseOut({ userId, date, reflectionDone, onBanked }) {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(null);
  const [error, setError] = useState(null);

  const steps = [{ key: "reflect", label: "Reflection written", done: reflectionDone, missing: "Finish the four cards above." }];
  const allDone = steps.every((s) => s.done);

  async function bank() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // The synopsis is written first and only saved as part of banking, so a
      // failed generation never leaves a day marked closed with nothing on it.
      setStage("Reading the day…");
      const { synopsis, headline } = await writeDaySynopsis(date);
      setStage("Filing it…");
      await bankDay(userId, date, headline ? `${headline}. ${synopsis}` : synopsis);
      await onBanked?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  return (
    <div className={"card" + (allDone ? " card--accent" : "")}>
      <div className="card-head">
        <span className="card-title"><Archive size={14} />Close out the day</span>
      </div>

      <p className="card-note" style={{ marginBottom: 14 }}>
        Banking writes a synopsis of the day and files it as a finished card — the charts, the map of your hours, and
        everything you wrote, kept together.
      </p>

      <div className="stack" style={{ gap: 9, marginBottom: 16 }}>
        {steps.map((s) => (
          <div key={s.key} className="row" style={{ gap: 9, alignItems: "flex-start" }}>
            <span style={{ flexShrink: 0, marginTop: 1, color: s.done ? "var(--accent)" : "var(--text-3)" }}>
              {s.done ? <Check size={15} /> : <Circle size={15} />}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 550, color: s.done ? "var(--text)" : "var(--text-2)" }}>{s.label}</span>
              {!s.done && <span className="faint" style={{ display: "block", fontSize: 11.5, marginTop: 1 }}>{s.missing}</span>}
            </span>
          </div>
        ))}
      </div>

      {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}

      <button className="btn btn--accent btn--block" onClick={bank} disabled={busy || !allDone}>
        <Archive size={15} />
        {busy ? stage : "Add day to bank"}
      </button>

      {!allDone && !busy && (
        <button className="btn-link" style={{ marginTop: 10 }} onClick={bank} disabled={busy}>
          <AlertCircle size={12} />
          Bank it anyway, unfinished
        </button>
      )}

      {busy && (
        <p className="faint row" style={{ fontSize: 11.5, marginTop: 10, gap: 5 }}>
          <Sparkles size={12} />
          Writing the synopsis from everything on this day.
        </p>
      )}
    </div>
  );
}
