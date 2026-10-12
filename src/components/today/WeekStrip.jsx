import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPlanSummary } from "../../lib/api";
import { weekDays, parseDateStr } from "../../lib/planDates";

// This week as a row of seven circles: dark once a day is banked, orange for
// today, outlined for a day that went by without being banked, and pale for
// the days still ahead. Tapping a past day opens it (or its reflection, if it
// was never banked), so catching up on a missed evening is one tap.
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export default function WeekStrip({ date }) {
  const [banked, setBanked] = useState(() => new Set());
  const days = weekDays(date);

  useEffect(() => {
    let cancelled = false;
    fetchPlanSummary(days[0], days[6])
      .then((rows) => !cancelled && setBanked(new Set(rows.filter((r) => r.banked).map((r) => String(r.day).slice(0, 10)))))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // days is derived from date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <div className="week-strip">
      {days.map((d, i) => {
        const state = d === date ? "today" : banked.has(d) ? "banked" : d < date ? "missed" : "ahead";
        const num = parseDateStr(d).getDate();
        const href = state === "today" ? "/evening" : state === "banked" ? `/day/${d}` : state === "missed" ? `/evening/${d}` : null;
        const dot = <span className={`week-strip__dot week-strip__dot--${state}`}>{num}</span>;
        return (
          <div key={d} className="week-strip__day">
            <span className="week-strip__dow">{DOW[i]}</span>
            {href ? (
              <Link to={href} aria-label={d}>
                {dot}
              </Link>
            ) : (
              dot
            )}
          </div>
        );
      })}
    </div>
  );
}
