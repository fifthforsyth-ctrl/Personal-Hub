import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import FocusLine from "../components/schedule/FocusLine";
import ScheduleDay from "../components/schedule/ScheduleDay";
import WeekSchedule from "../components/schedule/WeekSchedule";
import MonthSchedule from "../components/schedule/MonthSchedule";
import { todayStr, addDays, addMonths, parseDateStr, fmtMonthYear, fmtWeekHeading, startOfWeek, startOfMonth } from "../lib/planDates";
import "../styles/plan.css";
import "../styles/schedule.css";

const VIEWS = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

// The Week tab: planning and seeing the schedule, and nothing else. Three
// zooms on the same half-hour clock (a day, a week, a month), the week's
// focus as one thin line of targets on top, and every day a tap from its
// own schedule. Quotes, reflection and the rest live on Today.
//
// The address says where you are (/plan/day/2026-11-06, /plan/week/…,
// /plan/month/…), so Back goes back to the week you came from.
export default function Plan() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const view = VIEWS.some((v) => v.key === params.view) ? params.view : "week";
  const date = validDate(params.date) ?? todayStr();
  const today = todayStr();

  const go = (v, d) => navigate(`/plan/${v}/${d}`);
  const step = (dir) => go(view, view === "day" ? addDays(date, dir) : view === "week" ? addDays(date, dir * 7) : addMonths(date, dir));
  const openDay = (d) => go("day", d);

  const dt = parseDateStr(date);
  const isCurrent = view === "day" ? date === today : view === "week" ? startOfWeek(date) === startOfWeek(today) : startOfMonth(date) === startOfMonth(today);
  const eyebrow =
    view === "day"
      ? `${dt.toLocaleDateString(undefined, { weekday: "long" })}${date === today ? " · Today" : ""}`
      : view === "week"
        ? relative(Math.round((parseDateStr(startOfWeek(date)) - parseDateStr(startOfWeek(today))) / (7 * 86400000)), "week")
        : relative((dt.getFullYear() - parseDateStr(today).getFullYear()) * 12 + dt.getMonth() - parseDateStr(today).getMonth(), "month");
  const heading = view === "day" ? dt.toLocaleDateString(undefined, { month: "long", day: "numeric" }) : view === "week" ? fmtWeekHeading(date) : fmtMonthYear(date);
  const unit = view === "day" ? "day" : view;

  return (
    <div className="page plan-page">
      <div className="page-head plan-head">
        <div className="plan-head__title">
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="page-title" style={{ marginTop: 3 }}>
            {heading}
          </h1>
        </div>

        <div className="plan-head__controls">
          <div className="seg plan-views" role="group" aria-label="View">
            {VIEWS.map((v) => (
              <button key={v.key} type="button" className={"seg-btn" + (view === v.key ? " active" : "")} aria-pressed={view === v.key} onClick={() => go(v.key, date)}>
                {v.label}
              </button>
            ))}
          </div>
          <div className="plan-head__nav">
            <button className="btn-icon btn-icon--bordered" onClick={() => step(-1)} aria-label={`Previous ${unit}`} title={`Previous ${unit}`}>
              <ChevronLeft size={16} />
            </button>
            <button className="btn btn--sm btn--on-page plan-head__today" onClick={() => go(view, today)} disabled={isCurrent} title={`Back to this ${unit}`}>
              Today
            </button>
            <button className="btn-icon btn-icon--bordered" onClick={() => step(1)} aria-label={`Next ${unit}`} title={`Next ${unit}`}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* The focus of the week on screen (a day shows its own week's). */}
      <FocusLine date={view === "month" ? today : date} />

      {view === "day" && <ScheduleDay key={date} userId={user?.id} date={date} />}
      {view === "week" && <WeekSchedule anchorDate={date} onOpenDay={openDay} />}
      {view === "month" && <MonthSchedule monthDate={date} onOpenDay={openDay} />}
    </div>
  );
}

function validDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDateStr(s).getTime()) ? s : null;
}

function relative(offset, unit) {
  if (offset === 0) return `This ${unit}`;
  if (offset === 1) return `Next ${unit}`;
  if (offset === -1) return `Last ${unit}`;
  return offset > 0 ? `In ${offset} ${unit}s` : `${-offset} ${unit}s ago`;
}
