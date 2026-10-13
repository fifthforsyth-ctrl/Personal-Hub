import { useState } from "react";
import { Archive, Check, Circle, Sparkles } from "lucide-react";
import { bankDay, writeDaySynopsis } from "../../lib/api";
import { friendlyError } from "../../lib/errors";
import { useToast } from "../ui/Feedback";

// Closing the day out.
//
// Reflect, then bank it: that's the evening. Banking used to also wait on
// every minute being linked to a goal and tomorrow being planned, but you
// plan on Sundays and the goal links weren't telling you anything, so the
// reflection is the one thing asked for now.
//
// It stays possible to bank without it. A day you couldn't reflect on is
// still a day, and an app that refuses to close it is wrong about your life.
// The same goes for the summary: if the assistant can't write one tonight,
// the day is banked without it and the banked card offers to write it later.
export default function CloseOut({ userId, date, reflectionDone, onBanked }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(null);
  const [error, setError] = useState(null);

  async function bank() {
    if (busy) return;
    setBusy(true);
    setError(null);
    let synopsis = null;
    try {
      setStage("Writing the summary…");
      const written = await writeDaySynopsis(date);
      synopsis = written.headline ? `${written.headline}. ${written.synopsis}` : written.synopsis;
    } catch (err) {
      // Banked below without one; the card can write it later.
      console.warn(err);
    }
    try {
      setStage("Banking…");
      await bankDay(userId, date, synopsis);
      if (!synopsis) toast.show("Banked. The summary couldn't be written just now.");
      await onBanked?.();
    } catch (err) {
      setError(friendlyError(err, "Couldn't bank the day. Try again."));
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  return (
    <div className={"card" + (reflectionDone ? " card--accent" : "")}>
      <div className="card-head">
        <span className="card-title"><Archive size={14} />Close out the day</span>
      </div>

      <p className="card-note" style={{ marginBottom: 14 }}>
        Banking writes a summary of the day and files it as a finished card: the charts, the map of your hours, and
        everything you wrote, kept together.
      </p>

      <div className="row" style={{ gap: 9, alignItems: "flex-start", marginBottom: 16 }}>
        <span style={{ flexShrink: 0, marginTop: 1, color: reflectionDone ? "var(--accent)" : "var(--text-3)" }}>
          {reflectionDone ? <Check size={15} /> : <Circle size={15} />}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 550, color: reflectionDone ? "var(--text)" : "var(--text-2)" }}>Reflection written</span>
          {!reflectionDone && <span className="muted" style={{ display: "block", fontSize: 12, marginTop: 1 }}>Finish the four cards above.</span>}
        </span>
      </div>

      {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}

      <button className="btn btn--accent btn--block" onClick={bank} disabled={busy || !reflectionDone}>
        <Archive size={15} />
        {busy ? stage : "Bank the day"}
      </button>

      {!reflectionDone && !busy && (
        <button className="btn-link close-out__skip" onClick={bank}>
          Bank without reflecting
        </button>
      )}

      {busy && (
        <p className="muted row" style={{ fontSize: 12, marginTop: 10, gap: 5 }}>
          <Sparkles size={12} />
          The summary is written from everything on this day.
        </p>
      )}
    </div>
  );
}
