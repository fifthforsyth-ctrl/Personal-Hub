import { useMemo } from "react";
import { fetchPlanSummary } from "../../lib/api";
import { toDateStr, todayStr, dayIntensity } from "../../lib/planDates";
import { intensityColor } from "../../lib/nodeStyle";
import { useLoad } from "../../lib/useLoad";
import LoadError from "../ui/LoadError";
import { IntensityLegend } from "../charts";
import "../../styles/plan.css";

// The full year at a glance: twelve mini-months, every day a dot lit by the
// same intensity scale the month grid uses. One query for the whole year.
// Tap a month to open it; tap nothing smaller — at this altitude the point
// is the shape of the year, not any single day.
export default function YearView({ year, onPickMonth }) {
  const { data: summaryByDay, error, reload } = useLoad(
    () => fetchPlanSummary(`${year}-01-01`, `${year}-12-31`).then((rows) => new Map(rows.map((r) => [r.day, r]))),
    [year]
  );

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const first = new Date(year, m, 1);
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      return {
        index: m,
        label: first.toLocaleDateString(undefined, { month: "short" }),
        name: first.toLocaleDateString(undefined, { month: "long" }),
        leading: first.getDay(),
        days: Array.from({ length: daysInMonth }, (_, i) => toDateStr(new Date(year, m, i + 1))),
      };
    });
  }, [year]);

  const today = todayStr();
  const summary = summaryByDay ?? new Map();

  return (
    <>
      {error && !summaryByDay && <LoadError what={`${year}`} error={error} onRetry={reload} className="plan-gap" />}
      {error && summaryByDay && <LoadError stale error={error} onRetry={reload} className="plan-gap" />}

      <div className="year-grid" style={{ opacity: summaryByDay ? 1 : 0.55, transition: "opacity 0.2s" }}>
        {months.map((month) => {
          const monthTotal = month.days.reduce((sum, d) => sum + dayIntensity(summary.get(d)), 0);
          const monthAvg = monthTotal / month.days.length;

          return (
            <button
              key={month.index}
              onClick={() => onPickMonth(month.index)}
              className={"card year-month" + (monthAvg > 0.15 ? " year-month--lived" : "")}
              aria-label={`Open ${month.name} ${year}`}
            >
              <span className="year-month__head">
                <span className="year-month__label">{month.label}</span>
                {monthAvg > 0 && (
                  <span className="year-month__pct" title="How full the month's days were, on average">
                    {Math.round(monthAvg * 100)}%
                  </span>
                )}
              </span>

              <span className="year-month__days">
                {Array.from({ length: month.leading }, (_, i) => (
                  <span key={`b-${i}`} />
                ))}
                {month.days.map((dateStr) => {
                  const intensity = dayIntensity(summary.get(dateStr));
                  return (
                    <span
                      key={dateStr}
                      className={"year-month__day" + (dateStr === today ? " year-month__day--today" : "")}
                      style={{ background: intensity > 0 ? intensityColor(intensity) : "var(--inset)" }}
                    />
                  );
                })}
              </span>
            </button>
          );
        })}
      </div>

      <IntensityLegend note="Planned, done and tracked — the fuller the day, the stronger the colour." />
    </>
  );
}
