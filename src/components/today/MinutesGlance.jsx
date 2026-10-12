import { useEffect, useMemo, useState } from "react";
import { Clock, Square, Play } from "lucide-react";
import { stopTimeEntry } from "../../lib/api";
import { colorFor, fmtMinutes } from "../../lib/categories";
import { useCapture, announceChange } from "../CaptureSheet";

// Where today has gone, at a glance, with the timer one tap away.
//
// The full tracker (categories, past time, the timeline) opens in the
// capture sheet. Here it's just the shape of the day and, when something is
// running, the running thing with its stop button, because that's the one
// action you can't put off.
export default function MinutesGlance({ entries, running, onChanged }) {
  const capture = useCapture();
  const [busy, setBusy] = useState(false);

  // Totals credit every tag on an entry, matching how categories are used
  // everywhere else: an hour that was both Serve and Minister counts toward
  // each.
  const { rows, total } = useMemo(() => {
    const totals = new Map();
    let sum = 0;
    for (const e of entries) {
      const mins = Number(e.duration_minutes) || 0;
      sum += mins;
      for (const t of e.tags?.length ? e.tags : [e.category]) totals.set(t, (totals.get(t) ?? 0) + mins);
    }
    return {
      rows: [...totals.entries()].map(([category, minutes]) => ({ category, minutes })).sort((a, b) => b.minutes - a.minutes),
      total: sum,
    };
  }, [entries]);
  const stripTotal = rows.reduce((s, r) => s + r.minutes, 0);

  async function stop() {
    if (busy || !running) return;
    setBusy(true);
    try {
      await stopTimeEntry(running.id);
      await onChanged?.();
      announceChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-head" style={{ marginBottom: 10 }}>
        <span className="card-title"><Clock size={14} />Minutes</span>
        <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{total > 0 ? fmtMinutes(total) : "—"}</span>
      </div>

      {rows.length > 0 ? (
        <>
          <div className="time-strip time-strip--tall">
            {rows.map((r) => (
              <i key={r.category} title={`${r.category} · ${fmtMinutes(r.minutes)}`} style={{ width: `${(r.minutes / stripTotal) * 100}%`, background: colorFor(r.category) }} />
            ))}
          </div>
          <div className="minutes-legend">
            {rows.slice(0, 5).map((r) => (
              <span key={r.category} className="row" style={{ gap: 6 }}>
                <span className="dot" style={{ background: colorFor(r.category) }} />
                <span className="truncate">{r.category}</span>
                <span className="mono faint">{fmtMinutes(r.minutes)}</span>
              </span>
            ))}
          </div>
        </>
      ) : (
        !running && <p className="empty" style={{ marginBottom: 4 }}>Nothing logged yet today.</p>
      )}

      {running ? (
        <RunningRow entry={running} onStop={stop} busy={busy} />
      ) : (
        <button className="btn btn--block" style={{ marginTop: 14 }} onClick={() => capture.open("minutes")}>
          <Play size={14} />
          Track time
        </button>
      )}
    </div>
  );
}

function RunningRow({ entry, onStop, busy }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const secs = Math.max(0, Math.floor((Date.now() - new Date(entry.started_at).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const elapsed = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  const tags = entry.tags?.length ? entry.tags : [entry.category];

  return (
    <div className="running-row">
      <span className="running-dot" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="truncate" style={{ fontSize: 13.5, fontWeight: 600 }}>{entry.description || tags.join(" · ")}</div>
        <div className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>{elapsed}</div>
      </div>
      <button className="btn" onClick={onStop} disabled={busy}>
        <Square size={13} />
        Stop
      </button>
    </div>
  );
}
