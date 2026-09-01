import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { fetchRangePlan, fetchRangeTimeByDay, fetchPlanSummary } from "../../lib/api";
import { DayCard } from "../DayCard";
import { weekDays } from "../../lib/planDates";

// Seven day cards in a row. Same object as the one on the day page, at a
// smaller scale — the blocks and their completion are what survive the
// shrink, because "what shape was this week" is a question about blocks.
export default function WeekView({ anchorDate }) {
  const { user } = useAuth();
  const days = weekDays(anchorDate);
  const [chunks, setChunks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timeByDay, setTimeByDay] = useState(new Map());
  const [summaryByDay, setSummaryByDay] = useState(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);
    const start = days[0];
    const end = days[6];
    Promise.all([
      fetchRangePlan(user.id, start, end).catch(() => ({ chunks: [], tasks: [] })),
      fetchRangeTimeByDay(user.id, start, end).catch(() => new Map()),
      fetchPlanSummary(start, end).catch(() => []),
    ])
      .then(([plan, time, summary]) => {
        if (cancelled) return;
        setChunks(plan.chunks);
        setTasks(plan.tasks);
        setTimeByDay(time);
        setSummaryByDay(new Map(summary.map((r) => [r.day, r])));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, days[0]]);

  return (
    <div className="week-grid" style={{ opacity: loading ? 0.55 : 1, transition: "opacity 0.2s" }}>
      {days.map((date) => (
        <DayCard
          key={date}
          date={date}
          to={`/day/${date}`}
          chunks={chunks.filter((c) => c.date === date)}
          tasks={tasks.filter((t) => t.date === date)}
          timeRows={timeByDay.get(date) ?? []}
          banked={Boolean(summaryByDay.get(date)?.banked)}
        />
      ))}
    </div>
  );
}
