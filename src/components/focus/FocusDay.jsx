import { Link } from "react-router-dom";
import { Target, Check, ArrowRight } from "lucide-react";
import { focusWeekOf, answerOn } from "../../lib/focus";
import LoadError from "../ui/LoadError";
import { useFocusWeek } from "./useFocusWeek";
import "../../styles/focus.css";

// This week's focus goals, seen from one day.
//
// On Today it's a quiet list with one tap per goal, for the moment you
// notice something moved it. In the evening it asks of each one, "did today
// move it?", with yes and not today side by side, just before Bank it.
// Either way the answer is the same check-in, so a tap at noon is already
// answered by evening.
export default function FocusDay({ userId, date, variant = "today" }) {
  const weekStart = focusWeekOf(date);
  const { data, week, error, loading, reload, checkin } = useFocusWeek(userId, weekStart);
  const evening = variant === "evening";

  if (!data && loading) return null;

  return (
    <div className={"card focus-day" + (evening ? " focus-day--evening" : "")}>
      <div className="card-head" style={{ marginBottom: evening ? 6 : 10 }}>
        <span className="card-title"><Target size={14} />This week's focus</span>
        {week?.length > 0 && (
          <Link to="/plan" className="btn-link focus-day__edit">
            Edit
          </Link>
        )}
      </div>

      {error && <LoadError what="this week's focus" error={error} onRetry={reload} stale={Boolean(data)} />}

      {week && week.length === 0 && (
        <div className="focus-day__empty">
          <p className="card-note">No focus goals this week yet.</p>
          <Link to="/plan" className="btn-link btn-link--accent focus-day__set">
            Set them on Week
            <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {week && week.length > 0 && evening && <p className="card-note" style={{ marginBottom: 10 }}>Did today move it?</p>}

      {week?.map((g) => {
        const moved = answerOn(data.checkins, g.id, date);
        return evening ? (
          <div key={g.id} className="focus-day__row focus-day__row--ask">
            <span className="focus-day__title">{g.title}</span>
            <div className="seg focus-day__answer" role="group" aria-label={`Did today move “${g.title}”?`}>
              <button
                type="button"
                className={"seg-btn" + (moved === true ? " active" : "")}
                aria-pressed={moved === true}
                onClick={() => checkin(g.id, date, moved === true ? null : true)}
              >
                Moved it
              </button>
              <button
                type="button"
                className={"seg-btn" + (moved === false ? " active" : "")}
                aria-pressed={moved === false}
                onClick={() => checkin(g.id, date, moved === false ? null : false)}
              >
                Not today
              </button>
            </div>
          </div>
        ) : (
          <button
            key={g.id}
            type="button"
            className={"focus-day__row focus-day__row--tap" + (moved === true ? " is-moved" : "")}
            aria-pressed={moved === true}
            title={moved === true ? "Moved today. Tap to take it back." : "Tap when today moved this"}
            onClick={() => checkin(g.id, date, moved === true ? null : true)}
          >
            <span className="focus-day__check" aria-hidden="true">
              {moved === true && <Check size={13} strokeWidth={3} />}
            </span>
            <span className="focus-day__title">{g.title}</span>
            {moved === true && <span className="focus-day__moved">Moved today</span>}
          </button>
        );
      })}
    </div>
  );
}
