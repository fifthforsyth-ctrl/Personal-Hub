import { useEffect, useState } from "react";
import { Clock, Square, Play } from "lucide-react";
import { stopTimeEntry, goToBed } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { friendlyError } from "../../lib/errors";
import { colorFor, fmtMinutes } from "../../lib/categories";
import { isSleep } from "../../lib/honest";
import { useCapture } from "../CaptureSheet";
import { announceChange } from "./announce";
import { isBedtime } from "./dayParts";
import StopFollowUp, { needsFollowUp } from "./StopFollowUp";
import BedButton from "./BedButton";
import { trackedMinutes, minutesByCategory, fmtElapsed, timeOf, OVERLAP_NOTE } from "./minutes";

// Where today has gone, at a glance, with the timer one tap away.
//
// The full tracker (categories, past time, the timeline) opens in the
// capture sheet. Here it's just the shape of the day and, when something is
// running, the running thing with its stop button, because that's the one
// action you can't put off.
//
// The number in the corner is the time tracked (the entries, end to end).
// The legend credits every category on an entry, so it can add up to more.
//
// Stopping work or time with people opens a short row of chips about it
// (deep or shallow, who it was with), which folds away on its own. In the
// evening, Going to bed stops whatever is running and starts Sleep; while
// Sleep runs, its button says "I'm up".
export default function MinutesGlance({ entries, running, loaded }) {
  const { user } = useAuth();
  const capture = useCapture();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Off the screen as soon as it's stopped, rather than offering Stop again
  // until the reload lands (a second press would move its end time).
  const [stoppedId, setStoppedId] = useState(null);
  const [followUp, setFollowUp] = useState(null);
  const live = running && running.id !== stoppedId ? running : null;
  const bedtime = isBedtime() && !(live && isSleep(live));

  const rows = minutesByCategory(entries);
  const total = trackedMinutes(entries);
  const catTotal = rows.reduce((s, r) => s + r.minutes, 0);

  async function stop() {
    if (busy || !live) return;
    setBusy(true);
    setError(null);
    try {
      const stopped = await stopTimeEntry(live.id);
      setStoppedId(live.id);
      if (needsFollowUp(stopped)) setFollowUp(stopped);
      // Today (and anything else open) reloads on this, once.
      announceChange();
    } catch (err) {
      setError(friendlyError(err, "Couldn't stop the timer. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function bed() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await goToBed(user.id, live?.id);
      if (live) setStoppedId(live.id);
      setFollowUp(null);
      announceChange();
    } catch (err) {
      setError(friendlyError(err, "Couldn't start Sleep. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-head" style={{ marginBottom: 10 }}>
        <span className="card-title"><Clock size={14} />Minutes</span>
        <span className="mono" style={{ fontSize: 13, fontWeight: 600 }} title="Tracked today">{total > 0 ? fmtMinutes(total) : "—"}</span>
      </div>

      {rows.length > 0 ? (
        <>
          <div className="time-strip time-strip--tall">
            {rows.map((r) => (
              <i key={r.category} title={`${r.category} · ${fmtMinutes(r.minutes)}`} style={{ width: `${(r.minutes / catTotal) * 100}%`, background: colorFor(r.category) }} />
            ))}
          </div>
          <div className="minutes-legend">
            {rows.map((r) => (
              <span key={r.category} className="row" style={{ gap: 6, minWidth: 0 }}>
                <span className="dot" style={{ background: colorFor(r.category) }} />
                <span className="truncate">{r.category}</span>
                <span className="mono muted">{fmtMinutes(r.minutes)}</span>
              </span>
            ))}
          </div>
          {catTotal > total + 0.5 && <p className="minutes-note">{OVERLAP_NOTE}</p>}
        </>
      ) : (
        loaded && !live && <p className="empty" style={{ marginBottom: 4 }}>Nothing logged yet today.</p>
      )}

      {followUp && !live && <StopFollowUp key={followUp.id} userId={user?.id} entry={followUp} onClose={() => setFollowUp(null)} />}

      {live ? (
        <RunningRow entry={live} onStop={stop} busy={busy} />
      ) : (
        <div className={bedtime ? "minutes-actions" : undefined}>
          <button className="btn btn--block" style={{ marginTop: 14 }} onClick={() => capture.open("minutes")}>
            <Play size={14} />
            Track time
          </button>
          {bedtime && <BedButton onClick={bed} busy={busy} />}
        </div>
      )}
      {live && bedtime && <BedButton onClick={bed} busy={busy} />}
      {error && <div className="form-error" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}

function RunningRow({ entry, onStop, busy }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const tags = entry.tags?.length ? entry.tags : [entry.category];

  return (
    <div className="running-row">
      <span className="running-dot" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="truncate" style={{ fontSize: 13.5, fontWeight: 600 }}>{entry.description || tags.join(" · ")}</div>
        <div className="running-row__time">
          <span className="mono">{fmtElapsed(entry.started_at)}</span>
          <span className="running-row__since">since {timeOf(entry.started_at)}</span>
        </div>
      </div>
      <button className="btn btn--accent" onClick={onStop} disabled={busy}>
        {!isSleep(entry) && <Square size={12} />}
        {busy ? "Stopping…" : isSleep(entry) ? "I'm up" : "Stop timer"}
      </button>
    </div>
  );
}

