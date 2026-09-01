import { useCallback, useEffect, useState } from "react";
import { Archive, Check, Circle, Sparkles, AlertCircle } from "lucide-react";
import { bankDay, writeDaySynopsis, fetchLinkStats, fetchTimeChunks } from "../../lib/api";
import { addDays, fmtDayHeading } from "../../lib/planDates";

// Closing the day out.
//
// Three things have to be true first, and the checklist says which are and
// which aren't rather than just greying the button out — a disabled control
// with no explanation is the most frustrating thing an app can do at the end
// of a long day.
//
// It stays possible to bank anyway. Some days genuinely have no tasks to
// finish and nothing worth linking, and an app that refuses to let you close
// such a day is wrong about your life, not the other way round.
export default function CloseOut({ userId, date, reflectionDone, onBanked }) {
  const [linkStats, setLinkStats] = useState(null);
  const [tomorrowChunks, setTomorrowChunks] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(null);
  const [error, setError] = useState(null);

  const tomorrow = addDays(date, 1);

  const load = useCallback(async () => {
    if (!userId) return;
    const [stats, chunks] = await Promise.all([
      fetchLinkStats(date, date).catch(() => null),
      fetchTimeChunks(userId, tomorrow).catch(() => []),
    ]);
    setLinkStats(stats);
    setTomorrowChunks(chunks);
  }, [userId, date, tomorrow]);

  useEffect(() => {
    load();
  }, [load]);

  const linksDone = linkStats ? Number(linkStats.unlinked ?? 0) === 0 : false;
  const planDone = (tomorrowChunks ?? []).length > 0;
  const steps = [
    { key: "reflect", label: "Reflection written", done: reflectionDone, missing: "Finish the five questions above." },
    {
      key: "link",
      label: "Minutes linked to goals",
      done: linksDone,
      missing: linkStats ? `${linkStats.unlinked} ${Number(linkStats.unlinked) === 1 ? "entry has" : "entries have"} no goal yet.` : "Checking…",
    },
    {
      key: "plan",
      label: `${fmtDayHeading(tomorrow)} planned`,
      done: planDone,
      missing: "Generate and accept a plan for tomorrow.",
    },
  ];

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
