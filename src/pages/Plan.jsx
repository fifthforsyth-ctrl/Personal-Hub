import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchGoalOptions } from "../lib/api";
import DayView from "../components/plan/DayView";
import MonthView from "../components/plan/MonthView";
import YearView from "../components/plan/YearView";
import {
  todayStr,
  addDays,
  addMonths,
  toDateStr,
  parseDateStr,
  fmtDayHeading,
  fmtMonthYear,
  yearOf,
} from "../lib/planDates";

const VIEWS = ["Day", "Month", "Year"];

// Phase 2 — Daily Planning & Time-Chunking, at three altitudes. Day is
// where the work actually gets planned and checked off; Month and Year are
// the birdseye passes over it, using the same "how lit up was this"
// language the goal tree uses for engagement. Zooming out never loses the
// way back in: tap a month, tap a day, you're in it.
export default function Plan() {
  const { user } = useAuth();
  const [view, setView] = useState("Day");
  const [date, setDate] = useState(todayStr());
  const [goalOptions, setGoalOptions] = useState([]);
  // Bumped whenever the day view writes, so the overview grids refetch
  // their rollups the next time they're opened instead of showing stale
  // counts from before the edit.
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    if (user?.id) fetchGoalOptions(user.id).then(setGoalOptions).catch(() => {});
  }, [user?.id]);

  const bumpData = useCallback(() => setDataVersion((v) => v + 1), []);

  function step(direction) {
    if (view === "Day") setDate((d) => addDays(d, direction));
    else if (view === "Month") setDate((d) => addMonths(d, direction));
    else setDate((d) => addMonths(d, direction * 12));
  }

  function pickDay(dateStr) {
    setDate(dateStr);
    setView("Day");
  }

  function pickMonth(monthIndex) {
    const d = parseDateStr(date);
    setDate(toDateStr(new Date(d.getFullYear(), monthIndex, 1)));
    setView("Month");
  }

  const heading = view === "Day" ? fmtDayHeading(date) : view === "Month" ? fmtMonthYear(date) : String(yearOf(date));
  const isNow = view === "Day" ? date === todayStr() : view === "Month" ? date.slice(0, 7) === todayStr().slice(0, 7) : yearOf(date) === yearOf(todayStr());

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              flex: 1,
              background: view === v ? "var(--accent-dim)" : "var(--bg-inset)",
              border: `1px solid ${view === v ? "var(--accent-strong)" : "var(--border)"}`,
              color: view === v ? "var(--text)" : "var(--text-muted)",
              borderRadius: 8,
              padding: "8px 0",
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            {v}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button onClick={() => step(-1)} style={navBtnStyle} title="Previous">
          <ChevronLeft size={16} />
        </button>
        <div style={{ textAlign: "center", minWidth: 0 }}>
          <h1 className="page-title" style={{ fontSize: 18, marginBottom: 2 }}>{heading}</h1>
          {!isNow && (
            <button onClick={() => setDate(todayStr())} style={{ background: "none", border: "none", color: "var(--accent-strong)", fontSize: 11.5, padding: 0, fontWeight: 600 }}>
              Jump to today
            </button>
          )}
        </div>
        <button onClick={() => step(1)} style={navBtnStyle} title="Next">
          <ChevronRight size={16} />
        </button>
      </div>

      {view === "Day" && (
        <DayView userId={user?.id} date={date} goalOptions={goalOptions} onDataChanged={bumpData} />
      )}
      {view === "Month" && <MonthView key={`m-${dataVersion}`} monthDate={date} onPickDay={pickDay} />}
      {view === "Year" && <YearView key={`y-${dataVersion}`} year={yearOf(date)} onPickMonth={pickMonth} />}
    </div>
  );
}

const navBtnStyle = {
  background: "var(--bg-inset)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--text)",
  flexShrink: 0,
};
