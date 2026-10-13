import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import WeekView from "../components/plan/WeekView";
import MonthView from "../components/plan/MonthView";
import YearView from "../components/plan/YearView";
import IdealDays from "../components/plan/IdealDays";
import CategoryKey from "../components/CategoryKey";
import FocusWeek from "../components/focus/FocusWeek";
import CuratedCards from "../components/curator/CuratedCards";
import {
  todayStr,
  addDays,
  addMonths,
  toDateStr,
  parseDateStr,
  fmtMonthYear,
  fmtWeekHeading,
  startOfWeek,
  yearOf,
} from "../lib/planDates";
import "../styles/plan.css";

// "Ideal" is not an altitude like the other three — it is what the other
// three are being measured against, which is why it lives beside them
// rather than buried in settings.
const VIEWS = ["Week", "Month", "Year", "Ideal"];
const UNIT = { Week: "week", Month: "month", Year: "year" };

// Planning at three altitudes. Every one of them is made of the same day
// card, and every one of them drops you into a real day when you press it —
// zooming out never loses the way back in.
export default function Plan() {
  const navigate = useNavigate();
  const [view, setView] = useState("Week");
  const [date, setDate] = useState(todayStr());
  // While the planner is laying a week out, the page holds still: its
  // answer belongs to the week on screen.
  const [busy, setBusy] = useState(false);
  const holdTitle = busy ? "Wait for the planner to finish" : undefined;

  function step(direction) {
    if (view === "Week") setDate((d) => addDays(d, direction * 7));
    else if (view === "Month") setDate((d) => addMonths(d, direction));
    else setDate((d) => addMonths(d, direction * 12));
  }

  function pickMonth(monthIndex) {
    const d = parseDateStr(date);
    setDate(toDateStr(new Date(d.getFullYear(), monthIndex, 1)));
    setView("Month");
  }

  const today = todayStr();
  const heading =
    view === "Ideal"
      ? "Ideal days"
      : view === "Week"
        ? fmtWeekHeading(date)
        : view === "Month"
          ? fmtMonthYear(date)
          : String(yearOf(date));

  // How far the shown week/month/year is from now, in its own units.
  const offset =
    view === "Week"
      ? Math.round((parseDateStr(startOfWeek(date)) - parseDateStr(startOfWeek(today))) / (7 * 86400000))
      : view === "Month"
        ? (yearOf(date) - yearOf(today)) * 12 + (parseDateStr(date).getMonth() - parseDateStr(today).getMonth())
        : view === "Year"
          ? yearOf(date) - yearOf(today)
          : 0;
  const unit = UNIT[view];
  const eyebrow =
    view === "Ideal"
      ? "Week"
      : offset === 0
        ? `This ${unit}`
        : offset === 1
          ? `Next ${unit}`
          : offset === -1
            ? `Last ${unit}`
            : view;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="page-title" style={{ marginTop: 3 }}>{heading}</h1>
          {view !== "Ideal" && offset !== 0 && (
            <button className="btn-link" style={{ minHeight: 36 }} onClick={() => setDate(today)} disabled={busy} title={holdTitle}>
              Back to this {unit}
            </button>
          )}
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <div className="seg plan-hold plan-views" role="group" aria-label="View">
            {VIEWS.map((v) => (
              <button
                key={v}
                className={"seg-btn" + (view === v ? " active" : "")}
                aria-pressed={view === v}
                onClick={() => setView(v)}
                disabled={busy && view !== v}
                title={busy && view !== v ? holdTitle : undefined}
              >
                {v}
              </button>
            ))}
          </div>
          {/* Kept in place (just hidden) on Ideal, so the switcher beside it
              doesn't jump sideways when you change views. */}
          <div className="row plan-hold" style={{ gap: 4, visibility: view === "Ideal" ? "hidden" : "visible" }} aria-hidden={view === "Ideal"}>
            <button
              className="btn-icon btn-icon--bordered"
              onClick={() => step(-1)}
              disabled={busy || view === "Ideal"}
              aria-label={`Previous ${unit ?? "week"}`}
              title={holdTitle ?? `Previous ${unit ?? "week"}`}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="btn-icon btn-icon--bordered"
              onClick={() => step(1)}
              disabled={busy || view === "Ideal"}
              aria-label={`Next ${unit ?? "week"}`}
              title={holdTitle ?? `Next ${unit ?? "week"}`}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* What the week is for comes before how its hours are laid out. */}
      {view === "Week" && <FocusWeek anchorDate={date} />}
      {/* Sunday is when the week gets planned, so it's when the board brings
          back what fits the week ahead. */}
      {view === "Week" && isSundayReview(date) && (
        <div style={{ marginBottom: 16 }}>
          <CuratedCards slot="day" title="From your board, for the week ahead" />
        </div>
      )}
      {view === "Week" && <WeekView anchorDate={date} onBusyChange={setBusy} />}
      {view === "Month" && <MonthView monthDate={date} onPickDay={(d) => navigate(`/day/${d}`)} />}
      {view === "Year" && <YearView year={yearOf(date)} onPickMonth={pickMonth} />}
      {view === "Ideal" && <IdealDays />}

      {/* Every view in this tab is coloured by category, so the key belongs
          to the tab rather than to any one of them. */}
      <CategoryKey />
    </div>
  );
}

function isSundayReview(anchorDate) {
  const today = todayStr();
  return parseDateStr(today).getDay() === 0 && startOfWeek(anchorDate) === startOfWeek(today);
}
