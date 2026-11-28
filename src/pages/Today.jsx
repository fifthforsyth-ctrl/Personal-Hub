import { useEffect, useRef, useState } from "react";
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
import FocusStrip from "../components/focus/FocusStrip";
import TempleTrip from "../components/today/TempleTrip";
import MorningCheckin from "../components/today/MorningCheckin";
import RunawayCard, { runawayFor } from "../components/today/RunawayCard";
import OldRunaways from "../components/today/OldRunaways";
import WindDown from "../components/today/WindDown";
import PlanBlocks from "../components/today/PlanBlocks";
import StudyWeek from "../components/today/StudyWeek";
import { isEvening, isLateNight } from "../components/today/dayParts";
import { useBackOnline } from "../components/today/useBackOnline";
import "../styles/daily.css";

// Today: the timer, wins, your plan, and your walk with God.
//
// The page you open dozens of times a day, cut to what the day is made of
// (Clean slate, 2026-11-23). Under the title, this week's focus as a row of
// small chips, so the week is in view before the day is. Then the timer:
// what's running and its Stop, black while it runs. Then wins, with the one
// button that matters most where a thumb finds it. Then the day's plan from
// the block you're in now onward, with its tasks to tick. Then the walk
// with God: a verse, a prompt, and a line to write where you saw His hand.
// Under the wins, the week's scripture study: four kinds, each with its
// weekly minimum and a token when it's met.
// Last, a one-line note about purchases to sort and the way into the
// evening.
//
// What used to sit here and doesn't: the quote for the week now opens the
// Board, the week's days are the Week tab, and projects are the Tasks tab.
//
// The evening reflection is reached from here and only here: a big black
// button. On a computer it heads the right-hand column all day. On a phone
// it closes the page during the day and moves to the top after seven.
//
// Two things are asked here at the right moment and only then: a timer
// that ran away (at the very top, once), and in the morning, how last night
// went (just under the wins, until noon). In the evening the same spot
// carries one line: when the lights go out for tomorrow's alarm. Old timers
// that ran through the night before any of that existed are offered once,
// under the plan.
//
// After seven in the evening the top of the page becomes the way into the
// evening reflection. If yesterday never got banked, Today says so and takes
// you to it, which matters most just after midnight, when "today" has
// already turned over but the evening you're still in hasn't.

async function loadToday(userId, date) {
  const since = parseDateStr(date).toISOString();
  const [wl, list, open, plan, yesterdayPlan, tomorrowPlan, chunks, tomorrowChunks, cats] = await Promise.all([
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
    // Tomorrow's, one swipe to the right of today's plan.
    fetchTimeChunks(userId, addDays(date, 1)).catch((err) => {
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
    tomorrowChunks,
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
  // Before four in the morning the evening still belongs to yesterday (that's
  // the day /evening opens), so the button reads yesterday's state then.
  const eveningBanked = lateNight ? Boolean(data?.yesterdayBanked) : banked;
  const runaway = data?.running && runawayFor(data.running) ? data.running : null;

  const showEvening = !(yesterdayOpen && lateNight);
  const eveningOnTop = evening || eveningBanked;

  return (
    <div className="page today">
      <header className="hub-head">
        <div className="eyebrow">{fmtDayHeading(date)}</div>
        <h1 className="page-title">Today</h1>
      </header>

      <FocusStrip userId={userId} date={date} />

      {error && <LoadError what="today" error={error} onRetry={reload} stale={Boolean(data)} className="today__error" />}

      {runaway && <RunawayCard key={runaway.id} userId={userId} entry={runaway} onDone={reload} />}

      <div className="today-grid">
        <div className="stack">
          {yesterdayOpen && lateNight && <YesterdayBanner date={yesterday} urgent />}
          {eveningOnTop && showEvening && <EveningButton banked={eveningBanked} lastNight={lateNight} evening={evening} className="today-evening--phone" />}
          {yesterdayOpen && !lateNight && <YesterdayBanner date={yesterday} />}
          <MinutesGlance entries={data?.entries} running={data?.running} loaded={Boolean(data)} date={date} chunks={data?.chunks} checkinOnPage={Boolean(userId && data && !runaway)} />
          <WinHero userId={userId} date={date} rows={data?.wins} loaded={Boolean(data)} />
          {/* The week's scripture study: four minimums, a token for each. */}
          {userId && <StudyWeek userId={userId} date={date} running={data?.running} />}
          {userId && data && !runaway && <MorningCheckin userId={userId} date={date} dayPlan={data.dayPlan} running={data.running} onChanged={reload} />}
          {data && (
            <WindDown date={date} tomorrow={addDays(date, 1)} todayAlarm={data.dayPlan?.alarm_at} tomorrowAlarm={data.tomorrowAlarm} running={data.running} />
          )}
          {/* The day's plan, from the block you're in now; swipe for tomorrow's. */}
          {data && <PlanSwipe userId={userId} date={date} chunks={data.chunks} tomorrowChunks={data.tomorrowChunks} />}
          {/* Old timers that ran through the night, offered once. */}
          {userId && data && !runaway && <OldRunaways userId={userId} />}
        </div>
        <div className="stack">
          {/* Just after midnight the yesterday banner is the way in; a second
              link to the same evening would only compete with it. */}
          {showEvening && <EveningButton banked={eveningBanked} lastNight={lateNight} evening={evening} className="today-evening--desk" />}
          <WalkWithGod userId={userId} date={date} />
          <TempleTrip userId={userId} date={date} />
        </div>
      </div>

      <div className="stack today__foot">
        {/* On a phone during the day, the way into the evening closes the page. */}
        {!eveningOnTop && showEvening && <EveningButton className="today-evening--phone" />}
      </div>
    </div>
  );
}

// Today's plan, and tomorrow's one swipe to the right (Aaron, 2026-11-28).
// Two dots under the cards say which one you're on; a tap on a dot goes
// there.
function PlanSwipe({ userId, date, chunks, tomorrowChunks }) {
  const row = useRef(null);
  const [at, setAt] = useState(0);
  const onScroll = () => {
    const el = row.current;
    if (el) setAt(el.scrollLeft > el.clientWidth / 2 ? 1 : 0);
  };
  const go = (i) => {
    const el = row.current;
    el?.children[i]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  };
  return (
    <div className="plan-swipe">
      <div className="plan-swipe__row" ref={row} onScroll={onScroll}>
        <PlanBlocks userId={userId} date={date} chunks={chunks} />
        <PlanBlocks userId={userId} date={addDays(date, 1)} chunks={tomorrowChunks} tomorrow />
      </div>
      <div className="plan-swipe__dots">
        {["Today's plan", "Tomorrow's plan"].map((label, i) => (
          <button key={label} type="button" className={"plan-swipe__dot" + (at === i ? " is-on" : "")} aria-label={label} aria-current={at === i} onClick={() => go(i)} />
        ))}
      </div>
    </div>
  );
}

// The one way into the evening. Always the big black button until the day
// is banked; then a quiet card that still opens it, since the banked evening
// is where you'd go to look back at it or open it again.
function EveningButton({ banked = false, lastNight = false, evening = false, className }) {
  if (banked) {
    return (
      <Link to="/evening" className={`evening-banner evening-banner--done ${className}`}>
        <Archive size={16} />
        <span style={{ flex: 1 }}>{lastNight ? "Last night is banked" : "Today is banked"}</span>
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
