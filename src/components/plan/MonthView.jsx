import { useAuth } from "../../context/AuthContext";
import { fetchPlanSummary, fetchRangeTimeByDay, fetchDayRings } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import LoadError from "../ui/LoadError";
import { MonthCell } from "../DayCard";
import { monthGrid, startOfMonth, endOfMonth } from "../../lib/planDates";
import "../../styles/plan.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// The month, as the same day cards shrunk to squares. Each one still carries
// its colour strip and its completion count, so the grid reads as a month of
// days rather than a heat map of an abstract "intensity" — you can see which
// days were full of what, not just which were busy.
export default function MonthView({ monthDate, onPickDay }) {
  const { user } = useAuth();
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);

  const { data, error, reload } = useLoad(async () => {
    if (!user?.id) return null;
    const [rows, time, rings] = await Promise.all([
      fetchPlanSummary(start, end),
      fetchRangeTimeByDay(user.id, start, end),
      fetchDayRings(start, end),
    ]);
    return { summary: new Map(rows.map((r) => [r.day, r])), time, rings };
  }, [user?.id, start]);

  const cells = monthGrid(monthDate);

  return (
    <>
      {error && !data && <LoadError what="this month" error={error} onRetry={reload} className="plan-gap" />}
      {error && data && <LoadError stale error={error} onRetry={reload} className="plan-gap" />}

      <div className="card month-card" style={{ opacity: data ? 1 : 0.55, transition: "opacity 0.2s" }}>
        <div className="month-grid" style={{ marginBottom: 8 }}>
          {WEEKDAYS.map((d) => (
            <div key={d} className="eyebrow" style={{ textAlign: "center", fontSize: 9.5 }}>{d.slice(0, 2)}</div>
          ))}
        </div>

        <div className="month-grid">
          {cells.map((dateStr, i) =>
            dateStr ? (
              <MonthCell
                key={dateStr}
                date={dateStr}
                summary={data?.summary.get(dateStr)}
                timeRows={data?.time.get(dateStr) ?? []}
                ringArcs={data?.rings.get(dateStr) ?? []}
                onClick={() => onPickDay(dateStr)}
              />
            ) : (
              <MonthCell key={`blank-${i}`} date={null} />
            )
          )}
        </div>
      </div>
    </>
  );
}
