import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Moon, ArrowRight, Archive, CalendarRange } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchWinLosses, fetchTimeEntries, fetchOpenTimeEntry, fetchCategories, fetchDayPlan } from "../lib/api";
import { setCategoryColors } from "../lib/categories";
import { todayStr, fmtDayHeading } from "../lib/planDates";
import WinHero from "../components/today/WinHero";
import MinutesGlance from "../components/today/MinutesGlance";
import WalkWithGod from "../components/today/WalkWithGod";
import WeekStrip from "../components/today/WeekStrip";
import CuratedCards from "../components/curator/CuratedCards";
import PurchaseQuestion from "../components/money/PurchaseQuestion";

// Today: wins, minutes, and your walk with God.
//
// The page you open dozens of times a day, so it carries exactly the three
// things you said the Hub is for, in that order, and one action that matters
// most (Win) sits at the top where a thumb finds it. The curator's cards and
// the purchase question are still here, below the fold, for when you scroll.
//
// After seven in the evening the top of the page becomes the way into the
// evening reflection.

const EVENING_HOUR = 19;

function todayStartISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function Today() {
  const { user } = useAuth();
  const userId = user?.id;
  const date = todayStr();

  const [wins, setWins] = useState([]);
  const [entries, setEntries] = useState([]);
  const [running, setRunning] = useState(null);
  const [dayPlan, setDayPlan] = useState(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    const since = todayStartISO();
    const [wl, list, open, cats, plan] = await Promise.all([
      fetchWinLosses(userId, { sinceISO: since, limit: 200 }).catch(() => []),
      fetchTimeEntries(userId, { sinceISO: since, limit: 200 }).catch(() => []),
      fetchOpenTimeEntry(userId).catch(() => null),
      fetchCategories(userId).catch(() => []),
      fetchDayPlan(userId, date).catch(() => null),
    ]);
    setCategoryColors(cats);
    setWins(wl.filter((w) => w.kind === "win").reverse());
    setEntries(list.filter((e) => e.ended_at));
    setRunning(open);
    setDayPlan(plan);
  }, [userId, date]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Refresh when something is captured from the sheet, and when the phone
  // comes back to the app — a PWA left open overnight should show today.
  useEffect(() => {
    const onChange = () => reload();
    const onVisible = () => document.visibilityState === "visible" && reload();
    window.addEventListener("hub:changed", onChange);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("hub:changed", onChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  const banked = Boolean(dayPlan?.banked_at);
  const isEvening = new Date().getHours() >= EVENING_HOUR;

  return (
    <div className="page today">
      <div className="row row--between" style={{ marginBottom: 14, alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow">{fmtDayHeading(date)}</div>
          <h1 className="page-title" style={{ marginTop: 2 }}>Today</h1>
        </div>
        <Link to="/plan" className="btn-icon btn-icon--bordered" style={{ width: 38, height: 38 }} title="This week">
          <CalendarRange size={16} />
        </Link>
      </div>

      <WeekStrip date={date} />

      <div className="today-grid">
        <div className="stack">
          {(isEvening || banked) && <EveningBanner banked={banked} date={date} className="today-evening--phone" />}
          <WinHero userId={userId} wins={wins} onChanged={reload} />
          <MinutesGlance entries={entries} running={running} onChanged={reload} />
        </div>
        <div className="stack">
          <EveningBanner banked={banked} date={date} className="today-evening--desk" quiet={!isEvening} />
          <WalkWithGod userId={userId} date={date} />
        </div>
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        <CuratedCards slot="home" title="For today" compact />
        {/* Renders nothing when there's nothing to ask. */}
        <PurchaseQuestion compact />
      </div>
    </div>
  );
}

function EveningBanner({ banked, date, className, quiet = false }) {
  if (banked) {
    return (
      <Link to={`/day/${date}`} className={`evening-banner evening-banner--done ${className}`}>
        <Archive size={16} />
        <span style={{ flex: 1 }}>Today is banked</span>
        <ArrowRight size={15} />
      </Link>
    );
  }
  return (
    <Link to="/evening" className={`evening-banner${quiet ? " evening-banner--quiet" : ""} ${className}`}>
      <Moon size={16} />
      <span style={{ flex: 1 }}>{quiet ? "Evening reflection" : "Time to reflect on today"}</span>
      <ArrowRight size={15} />
    </Link>
  );
}
