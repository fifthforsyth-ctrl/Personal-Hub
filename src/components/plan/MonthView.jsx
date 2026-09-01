import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { fetchPlanSummary, fetchRangeTimeByDay } from "../../lib/api";
import { MonthCell } from "../DayCard";
import { monthGrid, startOfMonth, endOfMonth } from "../../lib/planDates";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// The month, as the same day cards shrunk to squares. Each one still carries
// its colour strip and its completion count, so the grid reads as a month of
// days rather than a heat map of an abstract "intensity" — you can see which
// days were full of what, not just which were busy.
export default function MonthView({ monthDate, onPickDay }) {
  const { user } = useAuth();
  const [summaryByDay, setSummaryByDay] = useState(new Map());
  const [timeByDay, setTimeByDay] = useState(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    Promise.all([
      fetchPlanSummary(start, end).catch(() => []),
      user?.id ? fetchRangeTimeByDay(user.id, start, end).catch(() => new Map()) : Promise.resolve(new Map()),
    ])
      .then(([rows, time]) => {
        if (cancelled) return;
        setSummaryByDay(new Map(rows.map((r) => [r.day, r])));
        setTimeByDay(time);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [monthDate, user?.id]);

  const cells = monthGrid(monthDate);

  return (
    <div className="card" style={{ opacity: loading ? 0.55 : 1, transition: "opacity 0.2s" }}>
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
              summary={summaryByDay.get(dateStr)}
              timeRows={timeByDay.get(dateStr) ?? []}
              onClick={() => onPickDay(dateStr)}
            />
          ) : (
            <MonthCell key={`blank-${i}`} date={null} />
          )
        )}
      </div>
    </div>
  );
}
