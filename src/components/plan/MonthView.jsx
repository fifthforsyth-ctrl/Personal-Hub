import { useEffect, useState } from "react";
import { fetchPlanSummary } from "../../lib/api";
import { monthGrid, startOfMonth, endOfMonth, parseDateStr, todayStr, dayIntensity } from "../../lib/planDates";
import { intensityColor, intensityTextColor } from "../../lib/nodeStyle";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

// The month birdseye: every day of the month at once, each cell lit by how
// much actually happened on it (see dayIntensity) — the "10,000 foot view"
// one level down from the year. Tap any day to drop into it.
export default function MonthView({ monthDate, onPickDay }) {
  const [summaryByDay, setSummaryByDay] = useState(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPlanSummary(startOfMonth(monthDate), endOfMonth(monthDate))
      .then((rows) => {
        if (cancelled) return;
        setSummaryByDay(new Map(rows.map((r) => [r.day, r])));
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [monthDate]);

  const cells = monthGrid(monthDate);
  const today = todayStr();

  return (
    <div className="card">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
        {WEEKDAYS.map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-faint)", textTransform: "uppercase" }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={`blank-${i}`} />;
          const s = summaryByDay.get(dateStr);
          const intensity = dayIntensity(s);
          const isToday = dateStr === today;
          const dayNum = parseDateStr(dateStr).getDate();
          const hasTasks = s && s.task_count > 0;

          return (
            <button
              key={dateStr}
              onClick={() => onPickDay(dateStr)}
              title={s ? `${s.chunk_count} blocks · ${s.done_count}/${s.task_count} tasks · ${Math.round(Number(s.logged_minutes))}m logged` : undefined}
              style={{
                aspectRatio: "1",
                borderRadius: 8,
                border: isToday ? "1.5px solid var(--accent-strong)" : "1px solid var(--border)",
                background: intensity > 0 ? intensityColor(intensity) : "var(--bg-inset)",
                color: intensity > 0 ? intensityTextColor(intensity) : "var(--text)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                padding: 2,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: isToday ? 700 : 500,
                opacity: loading ? 0.5 : 1,
                transition: "background 0.2s, opacity 0.2s",
              }}
            >
              {dayNum}
              {hasTasks && (
                <span style={{ fontSize: 8.5, opacity: 0.85, lineHeight: 1 }}>
                  {s.done_count}/{s.task_count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 10.5, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
        <span>QUIET</span>
        <div
          style={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            background: `linear-gradient(90deg, ${intensityColor(0)}, ${intensityColor(0.35)}, ${intensityColor(0.7)}, ${intensityColor(1)})`,
            border: "1px solid var(--border)",
          }}
        />
        <span>FULL</span>
      </div>
    </div>
  );
}
