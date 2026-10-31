import { Watch } from "lucide-react";
import { fetchHealthDays, fetchHealthWorkouts } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { addDays, parseDateStr } from "../../lib/planDates";
import { eveningWatchParts } from "../../lib/watch";
import "../../styles/watch.css";

// What the Apple Watch measured that day, as one quiet row under the
// evening's minutes: when you were up, last night's sleep, the day's
// workouts, steps, resting heart rate. Only what came; nothing at all when
// the watch sent nothing, or when it can't be read (the evening never waits
// on it).
async function loadWatchDay(userId, date) {
  const [days, workouts] = await Promise.all([
    fetchHealthDays(userId, date, date).catch(() => []),
    fetchHealthWorkouts(userId, parseDateStr(date).toISOString(), parseDateStr(addDays(date, 1)).toISOString()).catch(() => []),
  ]);
  return eveningWatchParts(days[0], workouts);
}

export default function WatchLine({ userId, date }) {
  const { data: parts } = useLoad(() => (userId ? loadWatchDay(userId, date) : null), [userId, date]);
  if (!parts?.length) return null;
  return (
    <div className="card watch-line" aria-label="From your watch">
      <span className="eyebrow watch-line__head">
        <Watch size={12} />
        From your watch
      </span>
      <div className="watch-line__parts">
        {parts.map((p, i) => (
          <span key={i} className="watch-line__part">
            <span className="faint">{p.label}</span> <strong className="mono">{p.value}</strong>
            {p.sub && <span className="faint watch-line__sub">{p.sub}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
