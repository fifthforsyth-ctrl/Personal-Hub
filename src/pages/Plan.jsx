import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import WeekView from "../components/plan/WeekView";
import MonthView from "../components/plan/MonthView";
import YearView from "../components/plan/YearView";
import IdealDays from "../components/plan/IdealDays";
import CategoryKey from "../components/CategoryKey";
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

// "Ideal" is not an altitude like the other three — it is what the other
// three are being measured against, which is why it lives beside them
// rather than buried in settings.
const VIEWS = ["Week", "Month", "Year", "Ideal"];

// Planning at three altitudes. Every one of them is made of the same day
// card, and every one of them drops you into a real day when you press it —
// zooming out never loses the way back in.
export default function Plan() {
  const navigate = useNavigate();
  const [view, setView] = useState("Week");
  const [date, setDate] = useState(todayStr());

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

  const heading =
    view === "Ideal"
      ? "Ideal days"
      : view === "Week"
      ? fmtWeekHeading(date)
      : view === "Month"
      ? fmtMonthYear(date)
      : String(yearOf(date));

  const isNow =
    view === "Ideal"
      ? true
      : view === "Week"
      ? startOfWeek(date) === startOfWeek(todayStr())
      : view === "Month"
      ? date.slice(0, 7) === todayStr().slice(0, 7)
      : yearOf(date) === yearOf(todayStr());

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Plan</div>
          <h1 className="page-title" style={{ marginTop: 3 }}>{heading}</h1>
          {!isNow && (
            <button className="btn-link" style={{ marginTop: 4 }} onClick={() => setDate(todayStr())}>
              Jump to now
            </button>
          )}
        </div>

        <div className="row" style={{ gap: 10 }}>
          <div className="seg">
            {VIEWS.map((v) => (
              <button key={v} className={"seg-btn" + (view === v ? " active" : "")} onClick={() => setView(v)}>
                {v}
              </button>
            ))}
          </div>
          {view !== "Ideal" && (
            <div className="row" style={{ gap: 4 }}>
              <button className="btn-icon btn-icon--bordered" onClick={() => step(-1)} title="Previous">
                <ChevronLeft size={16} />
              </button>
              <button className="btn-icon btn-icon--bordered" onClick={() => step(1)} title="Next">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {view === "Week" && <WeekView anchorDate={date} />}
      {view === "Month" && <MonthView monthDate={date} onPickDay={(d) => navigate(`/day/${d}`)} />}
      {view === "Year" && <YearView year={yearOf(date)} onPickMonth={pickMonth} />}
      {view === "Ideal" && <IdealDays />}

      {/* Every view in this tab is coloured by category, so the key belongs
          to the tab rather than to any one of them. */}
      <CategoryKey />
    </div>
  );
}
