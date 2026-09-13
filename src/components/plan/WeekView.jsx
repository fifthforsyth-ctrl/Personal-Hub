import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { fetchRangePlan, fetchRangeTimeByDay, fetchPlanSummary, fetchDayRings } from "../../lib/api";
import { DayCard } from "../DayCard";
import WeekPlanner from "./WeekPlanner";
import { weekDays } from "../../lib/planDates";

// Seven day cards in a row, under the place where the week gets planned.
// Same object as the one on the day page, at a smaller scale — the ring and
// the blocks are what survive the shrink, because "what shape was this week"
// is a question about when things happened, not how long they took.
export default function WeekView({ anchorDate }) {
  const { user } = useAuth();
  const days = weekDays(anchorDate);
  const [chunks, setChunks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timeByDay, setTimeByDay] = useState(new Map());
  const [summaryByDay, setSummaryByDay] = useState(new Map());
  const [ringsByDay, setRingsByDay] = useState(new Map());
  const [loading, setLoading] = useState(true);

  const start = days[0];
  const end = days[6];

  const reload = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [plan, time, summary, rings] = await Promise.all([
        fetchRangePlan(user.id, start, end).catch(() => ({ chunks: [], tasks: [] })),
        fetchRangeTimeByDay(user.id, start, end).catch(() => new Map()),
        fetchPlanSummary(start, end).catch(() => []),
        fetchDayRings(start, end).catch(() => new Map()),
      ]);
      setChunks(plan.chunks);
      setTasks(plan.tasks);
      setTimeByDay(time);
      setSummaryByDay(new Map(summary.map((r) => [r.day, r])));
      setRingsByDay(rings);
    } finally {
      setLoading(false);
    }
  }, [user?.id, start, end]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <>
      <WeekPlanner anchorDate={anchorDate} onCommitted={reload} />

      <div className="week-grid" style={{ opacity: loading ? 0.55 : 1, transition: "opacity 0.2s" }}>
        {days.map((date) => (
          <DayCard
            key={date}
            date={date}
            to={`/day/${date}`}
            chunks={chunks.filter((c) => c.date === date)}
            tasks={tasks.filter((t) => t.date === date)}
            timeRows={timeByDay.get(date) ?? []}
            ringArcs={ringsByDay.get(date) ?? []}
            banked={Boolean(summaryByDay.get(date)?.banked)}
          />
        ))}
      </div>
    </>
  );
}
