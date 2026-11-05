import { useEffect, useState } from "react";
import { Crosshair } from "lucide-react";
import { useLoad } from "../../lib/useLoad";
import { fetchFocusForDate } from "../../lib/api";
import { summarizeDay, fmtFocusMinutes } from "../../lib/focusMode";
import "../../styles/focusmode.css";

// The day's focus, under the minutes: one line from the first focus to the
// last (black focused, orange out of the office, ticks where something
// pulled you), the four numbers, and what broke it, most often first.
// Nothing shows on a day without focus mode.
export default function FocusDay({ userId, date }) {
  const { data, reload } = useLoad(() => fetchFocusForDate(userId, date), [userId, date]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const onChange = () => {
      setNow(Date.now());
      reload();
    };
    window.addEventListener("hub:changed", onChange);
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => {
      window.removeEventListener("hub:changed", onChange);
      clearInterval(id);
    };
  }, [reload]);

  if (!data?.spans?.length) return null;
  const day = summarizeDay(data.spans, data.breaks, now);
  const span = Math.max(1, day.to - day.from);
  const pct = (t) => `${((t - day.from) / span) * 100}%`;
  const clock = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="card fm-day">
      <div className="card-head">
        <span className="card-title"><Crosshair size={14} />Focus</span>
        <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{fmtFocusMinutes(day.focusedMinutes)}</span>
      </div>

      <div className="fm-day__line" role="img" aria-label={`Focus from ${clock(day.from)} to ${clock(day.to)}`}>
        {day.segments.map((s, i) => (
          <span key={i} className={s.kind === "away" ? "a" : "f"} style={{ left: pct(s.from), width: `max(2px, ${((s.to - s.from) / span) * 100}%)` }} />
        ))}
        {day.pullsAt.map((p, i) => (
          <i key={i} className="fm-day__pull" style={{ left: pct(p.at) }} title={p.reason ?? "Pulled away"} />
        ))}
      </div>
      <div className="fm-day__ends"><span>{clock(day.from)}</span><span>{clock(day.to)}</span></div>
      <div className="fm-day__key">
        <span><i style={{ background: "var(--ink)" }} />Focused</span>
        <span><i style={{ background: "var(--accent)" }} />Out of office</span>
        <span><i style={{ background: "var(--inset)" }} />Not in focus</span>
      </div>

      <div className="fm-day__stats">
        <Stat n={fmtFocusMinutes(day.focusedMinutes)} t="focused" />
        <Stat n={fmtFocusMinutes(day.longestMinutes)} t="longest unbroken" />
        <Stat n={day.trips ? fmtFocusMinutes(day.awayMinutes) : "0m"} t={`out of office${day.trips ? `, ${day.trips} ${day.trips === 1 ? "trip" : "trips"}` : ""}`} />
        <Stat n={day.pulls} t={day.pulls === 1 ? "pull" : "pulls"} />
      </div>

      {day.reasons.length > 0 && (
        <div className="fm-day__reasons">
          <span className="eyebrow" style={{ marginBottom: 2 }}>What broke it</span>
          {day.reasons.map((r) => (
            <div key={`${r.kind}|${r.reason}`} className="fm-day__reason">
              <span className="truncate">{r.reason}{r.kind === "left" ? ` · out ${fmtFocusMinutes(r.minutes)}` : ""}</span>
              <span className="muted">{r.count}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ n, t }) {
  return (
    <div>
      <div className="fm-day__n">{n}</div>
      <div className="fm-day__t">{t}</div>
    </div>
  );
}
