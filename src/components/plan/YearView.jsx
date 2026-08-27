import { useEffect, useMemo, useState } from "react";
import { fetchPlanSummary } from "../../lib/api";
import { toDateStr, todayStr, dayIntensity } from "../../lib/planDates";
import { intensityColor } from "../../lib/nodeStyle";

// The full year at a glance: twelve mini-months, every day a dot lit by the
// same intensity scale the month grid uses. One query for the whole year.
// Tap a month to open it; tap nothing smaller — at this altitude the point
// is the shape of the year, not any single day.
export default function YearView({ year, onPickMonth }) {
  const [summaryByDay, setSummaryByDay] = useState(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPlanSummary(`${year}-01-01`, `${year}-12-31`)
      .then((rows) => {
        if (cancelled) return;
        setSummaryByDay(new Map(rows.map((r) => [r.day, r])));
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [year]);

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const first = new Date(year, m, 1);
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      return {
        index: m,
        label: first.toLocaleDateString(undefined, { month: "short" }),
        leading: first.getDay(),
        days: Array.from({ length: daysInMonth }, (_, i) => toDateStr(new Date(year, m, i + 1))),
      };
    });
  }, [year]);

  const today = todayStr();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, opacity: loading ? 0.55 : 1, transition: "opacity 0.2s" }}>
      {months.map((month) => {
        const monthTotal = month.days.reduce((sum, d) => sum + dayIntensity(summaryByDay.get(d)), 0);
        const monthAvg = monthTotal / month.days.length;

        return (
          <button
            key={month.index}
            onClick={() => onPickMonth(month.index)}
            className="card"
            style={{
              padding: 12,
              cursor: "pointer",
              textAlign: "left",
              border: `1px solid ${monthAvg > 0.15 ? "var(--border-strong)" : "var(--border)"}`,
              background: "var(--bg-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14 }}>{month.label}</span>
              {monthAvg > 0 && (
                <span style={{ fontSize: 9.5, fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>
                  {Math.round(monthAvg * 100)}%
                </span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
              {Array.from({ length: month.leading }, (_, i) => (
                <span key={`b-${i}`} />
              ))}
              {month.days.map((dateStr) => {
                const intensity = dayIntensity(summaryByDay.get(dateStr));
                const isToday = dateStr === today;
                return (
                  <span
                    key={dateStr}
                    style={{
                      aspectRatio: "1",
                      borderRadius: 2,
                      background: intensity > 0 ? intensityColor(intensity) : "var(--bg-inset)",
                      boxShadow: isToday ? "0 0 0 1.5px var(--accent-strong)" : "none",
                    }}
                  />
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
