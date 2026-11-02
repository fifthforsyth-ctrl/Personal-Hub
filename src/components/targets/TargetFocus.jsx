import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { fetchDayPlan, fetchTimeEntriesForDate } from "../../lib/api";
import { arrowsLabel, checkinLevel, checkinOn, checksFor, focusWeekOf, landsBy } from "../../lib/focus";
import { LEVELS } from "../../lib/mark";
import { fmtShortDate, parseDateStr } from "../../lib/planDates";
import { useLoad } from "../../lib/useLoad";
import LoadError from "../ui/LoadError";
import { GoalArrow } from "../focus/FocusArrows";
import { useFocusWeek } from "../focus/useFocusWeek";
import "../../styles/focus.css";

// A week's focus: its seven days, as Today's focus sheet shows them, and
// for this week's focus, today's arrow (FocusArrows.jsx), landed the way it
// lands, with its settings a tap away. An earlier week's focus is history:
// its days show, read only, under the week they were.
//
//   row      the focus_goals row this page is about
//   ladder   useLadder(): this week's focus (its arrows and saves) and the
//            Ascent view for what it counts toward
//   ascent   that view in the shape FocusSettings and GoalArrow read
//   onSettings  opens its settings

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

// What the day holds for checks it can answer (FocusSheet reads the same).
async function loadDay(userId, date) {
  const [entries, dayPlan] = await Promise.all([fetchTimeEntriesForDate(userId, date), fetchDayPlan(userId, date)]);
  return { entries, dayPlan };
}

// "Week of Oct 25".
export function weekOfLabel(weekStart) {
  return `Week of ${fmtShortDate(weekStart)}`;
}

export default function TargetFocus({ userId, today, row, ladder, ascent, onSettings }) {
  const thisWeek = row.week_start === focusWeekOf(today);
  // An earlier week reads its own week once; this week's is the ladder's.
  const before = useFocusWeek(thisWeek ? null : userId, row.week_start);
  const fw = thisWeek ? ladder.focusWeek : before;
  const goal = (fw.week ?? []).find((g) => g.id === row.id) ?? null;

  const byChecks = goal ? landsBy(goal) === "checks" : false;
  const checks = goal ? checksFor(goal.id, fw.checks) : [];
  const needsDay = thisWeek && byChecks && checks.some((c) => c.auto === "wake" || c.focus_id);
  const day = useLoad(() => (userId && needsDay ? loadDay(userId, today) : null), [userId, today, needsDay]);

  return (
    <section className="card tg-focus" aria-labelledby="tg-focus-h">
      <div className="tg-sec__head">
        <h2 className="eyebrow" id="tg-focus-h">
          {thisWeek ? "This week" : weekOfLabel(row.week_start)}
        </h2>
      </div>

      {fw.error && <LoadError what="the week's arrows" error={fw.error} onRetry={fw.reload} stale={Boolean(fw.data)} />}

      {!goal ? (
        fw.data ? <p className="tg-quiet">This focus isn't in its week any more.</p> : <p className="tg-quiet">Loading…</p>
      ) : (
        <>
          <div className="focus-sheet__week tg-focus__week">
            <span className="focus-dots" role="img" aria-label={thisWeek ? arrowsLabel(goal) : thenLabel(goal)}>
              {goal.days.map((d, i) => {
                // On the face or out in the miss band; the title names the ring.
                const c = checkinOn(fw.data?.checkins, goal.id, d.date);
                const ring = c ? LEVELS[checkinLevel(c)].name : "no arrow";
                return (
                  <span
                    key={d.date}
                    className={"focus-dots__day" + (d.moved === true ? " is-yes" : d.moved === false ? " is-no" : "") + (d.date === today ? " is-today" : "")}
                    title={`${parseDateStr(d.date).toLocaleDateString(undefined, { weekday: "long" })}: ${ring}`}
                  >
                    {DOW[i]}
                  </span>
                );
              })}
            </span>
            <span className="focus-sheet__count">{thisWeek ? arrowsLabel(goal) : thenLabel(goal)}</span>
          </div>

          {thisWeek && (
            <div className="focus-sheet__arrow tg-focus__arrow">
              <span className="eyebrow">Today's arrow</span>
              <GoalArrow
                key={`${goal.id}:${landsBy(goal)}:${today}`}
                goal={goal}
                date={today}
                fw={fw}
                entries={day.data?.entries}
                dayPlan={day.data?.dayPlan}
                focusesById={ascent.focusesById}
                // Said once, above, as the link to its page.
                toward={null}
                onSettings={onSettings}
                showTitle={false}
              />
            </div>
          )}

          {thisWeek && (
            <Link to="/plan" className="btn-link tg-focus__plan">
              Edit this week's focus
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          )}
        </>
      )}
    </section>
  );
}

// An earlier week's count: "3 arrows that week".
function thenLabel(goal) {
  const n = goal?.answeredDays ?? 0;
  if (!n) return "No arrows that week";
  return `${n} ${n === 1 ? "arrow" : "arrows"} that week`;
}
