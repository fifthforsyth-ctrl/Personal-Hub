import { useEffect, useState } from "react";
import { Moon } from "lucide-react";
import { fetchSleepEntries, splitIntoSleep, stopTimeEntry } from "../../lib/api";
import { friendlyError } from "../../lib/errors";
import { familyFor } from "../../lib/categories";
import { runawayOf, usualLightsOut, suggestedSleepStart, resolveTimeAfter, hhmm, fmtDuration, tagsOf } from "../../lib/honest";
import { timeOf } from "./minutes";
import { announceChange } from "./announce";
import "../../styles/honest.css";

// A timer left running, caught the next time you open the app.
//
// Anything but Sleep that crosses midnight, or runs past three hours (five
// for work), is asked about once, at the top of Today. Overnight, the
// likely story is that you fell asleep: one tap ends it where sleep began
// and starts Sleep from there. Otherwise it just ends at the time you give.
// "Still going" leaves it alone and doesn't ask about that timer again.

const OK_KEY = (id) => `hub.runaway-ok.${id}`;

function isWorkEntry(entry) {
  return tagsOf(entry).some((t) => familyFor(t) === "Work");
}

export function runawayFor(entry, now = new Date()) {
  if (!entry) return null;
  try {
    if (localStorage.getItem(OK_KEY(entry.id)) === "1") return null;
  } catch (err) {
    console.warn(err);
  }
  return runawayOf(entry, { now, isWork: isWorkEntry(entry) });
}

export default function RunawayCard({ userId, entry, onDone }) {
  const now = new Date();
  const runaway = runawayOf(entry, { now, isWork: isWorkEntry(entry) });
  const [clock, setClock] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Overnight, offer your usual lights-out; in the day, now.
  useEffect(() => {
    let live = true;
    if (!runaway?.overnight) {
      setClock(hhmm(new Date()));
      return undefined;
    }
    fetchSleepEntries(userId, new Date(Date.now() - 30 * 86400000).toISOString())
      .then((rows) => usualLightsOut(rows))
      .catch((err) => {
        console.warn(err);
        return null;
      })
      .then((usual) => live && setClock((c) => c ?? hhmm(suggestedSleepStart(entry, usual))));
    return () => {
      live = false;
    };
  }, [userId, entry, runaway?.overnight]);

  if (!runaway) return null;

  const title = entry.description || tagsOf(entry).join(" · ");
  const at = clock ? resolveTimeAfter(entry.started_at, clock) : null;
  const valid = at && at <= new Date();

  async function act(kind) {
    if (busy || !valid) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "sleep") await splitIntoSleep(userId, entry, at);
      else await stopTimeEntry(entry.id, { endedBy: "overnight_fix", at });
      announceChange();
      onDone?.();
    } catch (err) {
      setError(friendlyError(err, "Couldn't fix that timer. Try again."));
      setBusy(false);
    }
  }

  function stillGoing() {
    try {
      localStorage.setItem(OK_KEY(entry.id), "1");
    } catch (err) {
      console.warn(err);
    }
    onDone?.();
  }

  return (
    <div className="card runaway">
      <div className="card-head" style={{ marginBottom: 8 }}>
        <span className="card-title">
          <Moon size={14} />
          {runaway.overnight ? "Looks like this ran overnight" : "Still going?"}
        </span>
      </div>
      <p className="runaway__text">
        <strong>{title}</strong> has been running since {timeOf(entry.started_at)} ({fmtDuration(runaway.minutes)}).{" "}
        {runaway.overnight ? "Were you asleep? When did it really stop?" : "When did it really stop?"}
      </p>

      <label className="runaway__time">
        <span>{runaway.overnight ? "It stopped at" : "Stopped at"}</span>
        <input className="input" type="time" value={clock ?? ""} onChange={(e) => setClock(e.target.value || null)} aria-label="When it stopped" />
      </label>
      {clock && !valid && <div className="form-error" style={{ marginTop: 8 }}>That's later than now. Pick an earlier time.</div>}

      <div className="runaway__actions">
        {runaway.overnight && (
          <button type="button" className="btn btn--accent" onClick={() => act("sleep")} disabled={busy || !valid}>
            Asleep from {clock ? timeOf(at.toISOString()) : "…"}
          </button>
        )}
        <button type="button" className={"btn" + (runaway.overnight ? "" : " btn--accent")} onClick={() => act("stop")} disabled={busy || !valid}>
          {runaway.overnight ? "Just stopped then" : `Stopped at ${clock ? timeOf(at.toISOString()) : "…"}`}
        </button>
        <button type="button" className="btn-link runaway__keep" onClick={stillGoing} disabled={busy}>
          Still going
        </button>
      </div>
      {runaway.overnight && valid && (
        <p className="runaway__note">
          Asleep makes it {title} until {timeOf(at.toISOString())}, then Sleep from {timeOf(at.toISOString())}, still running until you're up.
        </p>
      )}
      {error && <div className="form-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
