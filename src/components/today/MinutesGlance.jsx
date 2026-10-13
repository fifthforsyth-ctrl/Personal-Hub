import { useEffect, useState } from "react";
import { Clock, Square, Play } from "lucide-react";
import { stopTimeEntry } from "../../lib/api";
import { friendlyError } from "../../lib/errors";
import { colorFor, fmtMinutes } from "../../lib/categories";
import { useCapture } from "../CaptureSheet";
import { announceChange } from "./announce";
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
export default function MinutesGlance({ entries, running, loaded }) {
  const capture = useCapture();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Off the screen as soon as it's stopped, rather than offering Stop again
  // until the reload lands (a second press would move its end time).
  const [stoppedId, setStoppedId] = useState(null);
  const live = running && running.id !== stoppedId ? running : null;

  const rows = minutesByCategory(entries);
  const total = trackedMinutes(entries);
  const catTotal = rows.reduce((s, r) => s + r.minutes, 0);

  async function stop() {
    if (busy || !live) return;
    setBusy(true);
    setError(null);
    try {
      await stopTimeEntry(live.id);
      setStoppedId(live.id);
      // Today (and anything else open) reloads on this, once.
      announceChange();
    } catch (err) {
      setError(friendlyError(err, "Couldn't stop the timer. Try again."));
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

      {live ? (
        <RunningRow entry={live} onStop={stop} busy={busy} />
      ) : (
        <button className="btn btn--block" style={{ marginTop: 14 }} onClick={() => capture.open("minutes")}>
          <Play size={14} />
          Track time
        </button>
      )}
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
        <Square size={12} />
        {busy ? "Stopping…" : "Stop timer"}
      </button>
    </div>
  );
}
