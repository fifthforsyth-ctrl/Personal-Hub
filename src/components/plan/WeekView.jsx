import { useAuth } from "../../context/AuthContext";
import { fetchRangePlan, fetchRangeTimeByDay, fetchPlanSummary, fetchDayRings } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import LoadError from "../ui/LoadError";
import { DayCard } from "../DayCard";
import WeekPlanner from "./WeekPlanner";
import { weekDays } from "../../lib/planDates";

// Seven day cards in a row, under the place where the week gets planned.
// Same object as the one on the day page, at a smaller scale — the ring and
// the blocks are what survive the shrink, because "what shape was this week"
// is a question about when things happened, not how long they took.
export default function WeekView({ anchorDate, onBusyChange }) {
  const { user } = useAuth();
  const days = weekDays(anchorDate);
  const start = days[0];
  const end = days[6];

  const { data, error, reload } = useLoad(async () => {
    if (!user?.id) return null;
    const [plan, time, summary, rings] = await Promise.all([
      fetchRangePlan(user.id, start, end),
      fetchRangeTimeByDay(user.id, start, end),
      fetchPlanSummary(start, end),
      fetchDayRings(start, end),
    ]);
    return { plan, time, summary: new Map(summary.map((r) => [r.day, r])), rings };
  }, [user?.id, start]);

  return (
    <>
      <WeekPlanner anchorDate={anchorDate} onCommitted={reload} onBusyChange={onBusyChange} />

      {error && !data && <LoadError what="this week" error={error} onRetry={reload} className="plan-gap" />}
      {error && data && <LoadError stale error={error} onRetry={reload} className="plan-gap" />}

      <div className="week-grid" style={{ opacity: data ? 1 : 0.55, transition: "opacity 0.2s" }}>
        {days.map((date) => (
          <DayCard
            key={date}
            date={date}
            to={`/day/${date}`}
            pending={!data}
            chunks={(data?.plan.chunks ?? []).filter((c) => c.date === date)}
            tasks={(data?.plan.tasks ?? []).filter((t) => t.date === date)}
            timeRows={data?.time.get(date) ?? []}
            ringArcs={data?.rings.get(date) ?? []}
            tracked={data?.summary.get(date)?.logged_minutes ?? 0}
            banked={Boolean(data?.summary.get(date)?.banked)}
          />
        ))}
      </div>
    </>
  );
}
