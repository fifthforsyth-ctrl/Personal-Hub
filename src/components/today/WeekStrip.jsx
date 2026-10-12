import { Link } from "react-router-dom";
import { fetchPlanSummary } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { weekDays, parseDateStr } from "../../lib/planDates";
import { isEvening } from "./dayParts";
import { useBackOnline } from "./useBackOnline";

// This week as a row of seven circles: dark once a day is banked, orange for
// today, a dashed ring for a day that went by without being banked, and pale
// for the days still ahead. Tapping a past day opens it (or its reflection,
// if it was never banked), so catching up on a missed evening is one tap.
// Today's circle opens the evening once it's evening.
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export default function WeekStrip({ date }) {
  const days = weekDays(date);
  const { data, error, reload } = useLoad(() => fetchPlanSummary(days[0], days[6]), [date]);
  useBackOnline(reload, Boolean(error));
  // Until the week has loaded (or if it can't), past days stay neutral
  // rather than all looking unbanked.
  const banked = data ? new Set(data.filter((r) => r.banked).map((r) => String(r.day).slice(0, 10))) : null;
  const evening = isEvening();
  const anyPast = banked && days.some((d) => d < date);
  const anyOpen = banked && days.some((d) => d < date && !banked.has(d));

  return (
    <div className="week-strip-wrap">
      <div className="week-strip">
        {days.map((d, i) => {
          const state = d === date ? "today" : d > date ? "ahead" : !banked ? "past" : banked.has(d) ? "banked" : "open";
          const day = parseDateStr(d);
          const href =
            state === "today" ? (evening ? "/evening" : null) : state === "banked" ? `/day/${d}` : state === "open" || state === "past" ? `/evening/${d}` : null;
          const name = day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
          const label = {
            today: evening ? `${name}, today. Open the evening` : `${name}, today`,
            banked: `${name}, banked`,
            open: `${name}, not banked yet`,
            past: name,
            ahead: name,
          }[state];
          const dot = (
            <span className={`week-strip__dot week-strip__dot--${state}`} aria-hidden="true">
              {day.getDate()}
            </span>
          );
          return (
            <div key={d} className="week-strip__day">
              <span className="week-strip__dow" aria-hidden="true">{DOW[i]}</span>
              {href ? (
                <Link to={href} className="week-strip__link" aria-label={label} title={label}>
                  {dot}
                </Link>
              ) : (
                <span role="img" aria-label={label}>
                  {dot}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {anyPast && <p className="week-strip__key">{anyOpen ? "Dark = banked · dashed = still open" : "Dark = banked"}</p>}
    </div>
  );
}
