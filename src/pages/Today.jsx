import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Moon, ArrowRight, Archive, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchWinLosses, fetchTimeEntries, fetchOpenTimeEntry, fetchCategories, fetchDayPlan, fetchTimeChunks } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { setCategoryColors } from "../lib/categories";
import { todayStr, addDays, fmtDayHeading, parseDateStr } from "../lib/planDates";
import LoadError from "../components/ui/LoadError";
import WinHero from "../components/today/WinHero";
import MinutesGlance from "../components/today/MinutesGlance";
import WalkWithGod from "../components/today/WalkWithGod";
import WeekStrip from "../components/today/WeekStrip";
import FocusStrip from "../components/focus/FocusStrip";
import CuratedCards from "../components/curator/CuratedCards";
import QuoteOfDay from "../components/today/QuoteOfDay";
import TempleTrip from "../components/today/TempleTrip";
import MorningCheckin from "../components/today/MorningCheckin";
import RunawayCard, { runawayFor } from "../components/today/RunawayCard";
import OldRunaways from "../components/today/OldRunaways";
import WindDown from "../components/today/WindDown";
import PlanBlocks from "../components/today/PlanBlocks";
import MirrorLink from "../components/MirrorLink";
import { PurchaseNudge } from "../components/money/PurchaseQuestion";
import { isEvening, isLateNight } from "../components/today/dayParts";
import { isSunday } from "../lib/honest";
import { lastWeekStart } from "../lib/mirror";
import { useBackOnline } from "../components/today/useBackOnline";
import "../styles/daily.css";

// Today: wins, minutes, your plan, and your walk with God.
//
// The page you open dozens of times a day. This week's focus sits at the
// very top as a row of small targets, the smallest ones you aim at, so the
// week is in view before the day is. Then the one action that matters most
// (Win) where a thumb finds it, the minutes, and right under them the day's
// plan: every block, with the ones still ahead opened up to show their
// tasks. Beside them (under them on a phone) the walk with God. Below the
// fold: a quote chosen for this week, the curator's cards, and a one-line
// note about purchases to sort.
//
// The evening reflection is reached from here and only here: a big black
// button. On a computer it heads the right-hand column all day. On a phone
// it waits under the plan during the day and moves to the top after seven.
//
// Two things are asked here at the right moment and only then: a timer
// that ran away (at the very top, once), and in the morning, how last night
// went (just under the wins, until noon). In the evening the same spot
// carries one line: when the lights go out for tomorrow's alarm. Old timers
// that ran through the night before any of that existed are offered once,
// under the minutes.
//
// After seven in the evening the top of the page becomes the way into the
// evening reflection. If yesterday never got banked, Today says so and takes
// you to it, which matters most just after midnight, when "today" has
// already turned over but the evening you're still in hasn't.

async function loadToday(userId, date) {
  const since = parseDateStr(date).toISOString();
  const [wl, list, open, plan, yesterdayPlan, tomorrowPlan, chunks, cats] = await Promise.all([
    fetchWinLosses(userId, { sinceISO: since, limit: 200 }),
    fetchTimeEntries(userId, { sinceISO: since, limit: 200 }),
    fetchOpenTimeEntry(userId),
    fetchDayPlan(userId, date),
    fetchDayPlan(userId, addDays(date, -1)),
    fetchDayPlan(userId, addDays(date, 1)),
    // The day's planned blocks: Today still opens if these don't come.
    fetchTimeChunks(userId, date).catch((err) => {
      console.warn(err);
      return null;
    }),
    // Only colours: Today still opens if these don't come.
    fetchCategories(userId).catch((err) => {
      console.warn(err);
      return null;
    }),
  ]);
  if (cats) setCategoryColors(cats);
  return {
    wins: wl.filter((w) => w.kind === "win"),
    entries: list.filter((e) => e.ended_at),
    running: open,
    dayPlan: plan,
    yesterdayBanked: Boolean(yesterdayPlan?.banked_at),
    tomorrowAlarm: tomorrowPlan?.alarm_at ?? null,
    chunks,
  };
}

export default function Today() {
  const { user } = useAuth();
  const userId = user?.id;
  const date = todayStr();

  const { data, error, reload } = useLoad(() => loadToday(userId, date), [userId, date]);

  // Refresh when something is captured from the sheet, and when the phone
  // comes back to the app — a PWA left open overnight should show today.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && reload();
    window.addEventListener("hub:changed", reload);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("hub:changed", reload);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);
  useBackOnline(reload, Boolean(error));

  const banked = Boolean(data?.dayPlan?.banked_at);
  const evening = isEvening();
  const lateNight = isLateNight();
  const yesterday = addDays(date, -1);
  const yesterdayOpen = Boolean(data) && !data.yesterdayBanked;
  const runaway = data?.running && runawayFor(data.running) ? data.running : null;

  return (
    <div className="page today">
      <div style={{ marginBottom: 14 }}>
        <div className="eyebrow">{fmtDayHeading(date)}</div>
        <h1 className="page-title" style={{ marginTop: 2 }}>Today</h1>
      </div>

      <FocusStrip userId={userId} date={date} />

      <WeekStrip date={date} />

      {error && <LoadError what="today" error={error} onRetry={reload} stale={Boolean(data)} className="today__error" />}

      {runaway && <RunawayCard key={runaway.id} userId={userId} entry={runaway} onDone={reload} />}

      <div className="today-grid">
        <div className="stack">
          {yesterdayOpen && lateNight && <YesterdayBanner date={yesterday} urgent />}
          {(evening || banked) && !(yesterdayOpen && lateNight) && <EveningButton banked={banked} evening={evening} className="today-evening--phone" />}
          {yesterdayOpen && !lateNight && <YesterdayBanner date={yesterday} />}
          <WinHero userId={userId} date={date} rows={data?.wins} loaded={Boolean(data)} />
          {userId && data && !runaway && <MorningCheckin userId={userId} date={date} dayPlan={data.dayPlan} running={data.running} onChanged={reload} />}
          {data && (
            <WindDown date={date} tomorrow={addDays(date, 1)} todayAlarm={data.dayPlan?.alarm_at} tomorrowAlarm={data.tomorrowAlarm} running={data.running} />
          )}
          {/* Sunday: last week in the mirror, before the new one is planned. */}
          {isSunday(date) && <MirrorLink key={date} weekStart={lastWeekStart(date)} closable />}
          <MinutesGlance entries={data?.entries} running={data?.running} loaded={Boolean(data)} date={date} />
          {/* The day's plan, right under the minutes it turns into. */}
          {data?.chunks && <PlanBlocks userId={userId} date={date} chunks={data.chunks} />}
          {/* Old timers that ran through the night, offered once, under the
              minutes they'd otherwise keep inflating. */}
          {userId && data && !runaway && <OldRunaways userId={userId} />}
          {/* On a phone during the day, the way into the evening waits here,
              at the end of the day's own cards. */}
          {!evening && !banked && !(yesterdayOpen && lateNight) && <EveningButton className="today-evening--phone" />}
        </div>
        <div className="stack">
          {/* Just after midnight the yesterday banner is the way in; a second
              link to the same evening would only compete with it. */}
          {!(yesterdayOpen && lateNight) && <EveningButton banked={banked} evening={evening} className="today-evening--desk" />}
          <WalkWithGod userId={userId} date={date} />
          <TempleTrip userId={userId} date={date} />
        </div>
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        <QuoteOfDay userId={userId} date={date} />
        <CuratedCards slot="home" title="For today" compact />
        {/* One line, and only when there's something to sort. */}
        <PurchaseNudge />
      </div>
    </div>
  );
}

// The one way into the evening. Always the big black button until the day
// is banked; then a quiet card that still opens it, since the banked evening
// is where you'd go to look back at it or open it again.
function EveningButton({ banked = false, evening = false, className }) {
  if (banked) {
    return (
      <Link to="/evening" className={`evening-banner evening-banner--done ${className}`}>
        <Archive size={16} />
        <span style={{ flex: 1 }}>Today is banked</span>
        <ArrowRight size={15} />
      </Link>
    );
  }
  return (
    <Link to="/evening" className={`evening-banner ${className}`}>
      <Moon size={18} />
      <span className="evening-banner__words">
        <span className="evening-banner__title">Evening reflection</span>
        <span className="evening-banner__sub">{evening ? "Time to look back on today, then bank it" : "Reflect on the day and bank it"}</span>
      </span>
      <ArrowRight size={16} />
    </Link>
  );
}

// Yesterday was never banked. Just after midnight that's the evening you're
// still in, so it's the dark banner; later in the day it's a quiet nudge you
// can put away until tomorrow.
function YesterdayBanner({ date, urgent }) {
  const key = `hub.yesterday-dismissed.${date}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch (err) {
      console.warn(err);
      return false;
    }
  });
  if (dismissed && !urgent) return null;

  const weekday = parseDateStr(date).toLocaleDateString(undefined, { weekday: "long" });

  return (
    <div className={"yesterday-banner" + (urgent ? " yesterday-banner--urgent" : "")}>
      <Link to={`/evening/${date}`} className="yesterday-banner__link">
        <Moon size={16} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="yesterday-banner__title">Yesterday isn't banked yet</span>
          <span className="yesterday-banner__sub">A few taps on {weekday}, then bank it</span>
        </span>
        <ArrowRight size={15} />
      </Link>
      {!urgent && (
        <button
          type="button"
          className="btn-icon yesterday-banner__close"
          aria-label="Hide until tomorrow"
          title="Hide until tomorrow"
          onClick={() => {
            try {
              localStorage.setItem(key, "1");
            } catch (err) {
              console.warn(err);
            }
            setDismissed(true);
          }}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
