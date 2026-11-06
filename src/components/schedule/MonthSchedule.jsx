import { useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { fetchRangeChunks } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import { MiniDay } from "./Mini";
import { gridRange, plannedMinutes, fmtHours } from "../../lib/schedule";
import { monthGrid, startOfMonth, endOfMonth, parseDateStr, todayStr } from "../../lib/planDates";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// The month, each day its own tiny schedule on the same clock as the rest,
// so busy days, open days and where in the day things fall show at a glance.
// Tap a day to plan it.
export default function MonthSchedule({ monthDate, onOpenDay }) {
  const { user } = useAuth();
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  const today = todayStr();
  const toast = useToast();

  // A delete still waiting on its Undo goes through first (see WeekSchedule).
  const { data, error, reload } = useLoad(async () => {
    if (!user?.id) return null;
    await toast.flush();
    return fetchRangeChunks(user.id, start, end);
  }, [user?.id, start]);
  const byDay = useMemo(() => {
    const m = new Map();
    for (const c of data ?? []) {
      if (!m.has(c.date)) m.set(c.date, []);
      m.get(c.date).push(c);
    }
    return m;
  }, [data]);
  const range = gridRange(data ?? []);
  const rows = (range.end - range.start) / 30;
  const cells = monthGrid(monthDate);

  return (
    <>
      {error && !data && <LoadError what="this month" error={error} onRetry={reload} />}
      {error && data && <LoadError stale error={error} onRetry={reload} />}

      <div className="card mo" style={{ opacity: data ? 1 : 0.55, "--mo-rows": rows }}>
        <div className="mo__grid mo__grid--head">
          {WEEKDAYS.map((d) => (
            <div key={d} className="mo__wd">
              {d}
            </div>
          ))}
        </div>
        <div className="mo__grid">
          {cells.map((d, i) => {
            if (!d) return <div key={`b${i}`} className="mo__cell mo__cell--blank" />;
            const chunks = byDay.get(d) ?? [];
            const label = parseDateStr(d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
            return (
              <button
                key={d}
                type="button"
                className={"mo__cell" + (d === today ? " is-today" : "") + (d < today ? " is-past" : "")}
                onClick={() => onOpenDay(d)}
                aria-label={`Plan ${label}${chunks.length ? `, ${fmtHours(plannedMinutes(chunks))} planned` : ""}`}
                title={chunks.length ? `${fmtHours(plannedMinutes(chunks))} planned` : "Nothing planned"}
              >
                <span className="mo__num">{parseDateStr(d).getDate()}</span>
                <span className="mo__day">
                  <MiniDay chunks={chunks} range={range} slotH={2.2} names={false} lines={false} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
