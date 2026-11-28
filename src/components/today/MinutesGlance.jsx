import { useEffect, useState } from "react";
import { Square, Play, Watch } from "lucide-react";
import { stopTimeEntry, goToBed, fetchHealthDays } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useLoad } from "../../lib/useLoad";
import { addDays, fmtTime } from "../../lib/planDates";
import { blocksOf } from "../../lib/todayPlan";
import { minutesWatch } from "../../lib/watch";
import { friendlyError } from "../../lib/errors";
import { colorFor, fmtMinutes } from "../../lib/categories";
import { isSleep, isMorning } from "../../lib/honest";
import { useCapture } from "../CaptureSheet";
import { announceChange } from "./announce";
import { isBedtime } from "./dayParts";
import StopFollowUp, { needsFollowUp } from "./StopFollowUp";
import BedButton from "./BedButton";
import { useCheckinShowsNight } from "./MorningCheckin";
import { trackedMinutes, minutesByCategory, fmtElapsed, timeOf, OVERLAP_NOTE } from "./minutes";
import FocusModeBox from "../focusmode/FocusModeBox";
import "../../styles/watch.css";

// The timer, first on Today, and where today has gone at a glance.
//
// While something is running the card is black and says three things: what
// is running and for how long, since when, and what the plan has in this
// hour and until when (from the day's blocks, when Today passes them in as
// `chunks`). Stop is the white pill beside it, because that's the one
// action you can't put off. With nothing running it's a white card with the
// day's tracked time and a Start pill; the full tracker (categories, past
// time, the timeline) opens in the capture sheet from there.
//
// Under either, one thin bar shows the shape of the day by category, with
// each category's time in a line under it. The total is the time tracked
// (the entries, end to end). The line credits every category on an entry,
// so it can add up to more.
//
// Stopping work or time with people opens a short row of chips about it
// (deep or shallow, who it was with), which folds away on its own. In the
// evening, Going to bed stops whatever is running and starts Sleep; while
// Sleep runs, its button says "I'm up".
//
// Given the day (`date`), it also shows what the watch saw of last night
// and this morning, in one quiet row under the minutes: how long you slept,
// when you were up, and your resting heart rate beside your own normal.
// That's your baseline to read it against, not a target, so it's never
// red and never a score. Nothing shows when the watch sent nothing, so a
// day you logged by hand looks exactly as it did, and the card never waits
// on the watch or breaks when it can't be read. While the morning check-in
// shows last night (its form, or its one line when that says when you were
// up or how long you slept), the row leaves those two out until it doesn't
// (noon, or Not today), rather than show the night twice a few lines apart.
// `checkinOnPage` is whether Today has the check-in up at all: with a
// runaway timer asked about in its place, the row says them itself.
export default function MinutesGlance({ entries, running, loaded, date, chunks = null, checkinOnPage = false }) {
  const { user } = useAuth();
  const checkinShowsNight = useNightInCheckin(loaded, checkinOnPage);
  const watch = useWatchRow(user?.id, date, !checkinShowsNight);
  const capture = useCapture();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Off the screen as soon as it's stopped, rather than offering Stop again
  // until the reload lands (a second press would move its end time).
  const [stoppedId, setStoppedId] = useState(null);
  const [followUp, setFollowUp] = useState(null);
  const live = running && running.id !== stoppedId ? running : null;
  const bedtime = isBedtime() && !(live && isSleep(live));

  const rows = minutesByCategory(entries);
  const total = trackedMinutes(entries);
  const catTotal = rows.reduce((s, r) => s + r.minutes, 0);

  async function stop() {
    if (busy || !live) return;
    setBusy(true);
    setError(null);
    try {
      // Null when it had already stopped (the watch ended last night's
      // Sleep while this page sat open): its end stays where it is, there's
      // nothing to ask about, and the reload below shows it.
      const stopped = await stopTimeEntry(live.id);
      setStoppedId(live.id);
      if (stopped && needsFollowUp(stopped)) setFollowUp(stopped);
      // Today (and anything else open) reloads on this, once.
      announceChange();
    } catch (err) {
      setError(friendlyError(err, "Couldn't stop the timer. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function bed() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await goToBed(user.id, live?.id);
      if (live) setStoppedId(live.id);
      setFollowUp(null);
      announceChange();
    } catch (err) {
      setError(friendlyError(err, "Couldn't start Sleep. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={"card timer" + (live ? " timer--live" : "")}>
      {live ? (
        <RunningHead entry={live} chunks={chunks} onStop={stop} busy={busy} />
      ) : (
        <div className="timer__head">
          <div className="timer__words">
            <div className="timer__since">No timer running</div>
            <div className="timer__what">
              {total > 0 ? (
                <>
                  {fmtMinutes(total)} <span className="timer__what-sub">tracked today</span>
                </>
              ) : loaded ? (
                "Nothing tracked yet"
              ) : (
                "\u00a0"
              )}
            </div>
          </div>
          <button type="button" className="btn btn--accent timer__go" onClick={() => capture.open("minutes")}>
            <Play size={14} fill="currentColor" />
            Start
          </button>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="time-strip timer__bar">
            {rows.map((r) => (
              <i key={r.category} title={`${r.category} · ${fmtMinutes(r.minutes)}`} style={{ width: `${(r.minutes / catTotal) * 100}%`, background: colorFor(r.category) }} />
            ))}
          </div>
          <div className="timer__legend">
            <span className="timer__cats">
              {rows.map((r) => (
                <span key={r.category} className="timer__cat">
                  <span className="dot" style={{ background: colorFor(r.category) }} />
                  {r.category} <span className="mono">{fmtMinutes(r.minutes)}</span>
                </span>
              ))}
            </span>
            {live && <strong className="timer__total" title="Tracked today">{fmtMinutes(total)}</strong>}
          </div>
          {catTotal > total + 0.5 && <p className="minutes-note">{OVERLAP_NOTE}</p>}
        </>
      )}

      {watch.length > 0 && <WatchRow parts={watch} />}

      {followUp && !live && <StopFollowUp key={followUp.id} userId={user?.id} entry={followUp} onClose={() => setFollowUp(null)} />}

      {live && !isSleep(live) && <FocusModeBox entry={live} compact />}
      {bedtime && <BedButton onClick={bed} busy={busy} />}
      {error && <div className="form-error" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}

// Whether the check-in is showing last night, so the watch row leaves Slept
// and Up to it. Only when Today has it on the page: with none there, the
// row says them. Before Today has loaded (the check-in may be about to
// appear) and while the check-in reads the night, it goes by the
// check-in's hours, so the row doesn't show them and then take them away.
function useNightInCheckin(loaded, checkinOnPage) {
  const shown = useCheckinShowsNight();
  if (!loaded) return isMorning();
  return checkinOnPage ? shown ?? isMorning() : false;
}

// Last night and this morning from the watch: the 29 days up to today,
// so today's resting heart rate has its normal to sit beside. Reads again
// when anything changes and when you come back to the app, since the watch
// sends its numbers in the background. A failure is only logged (useLoad
// warns and keeps the last good answer), so the row stays as it was or off.
// `night` false leaves out Slept and Up (the check-in has them).
function useWatchRow(userId, date, night) {
  const { data, reload } = useLoad(() => (userId && date ? fetchHealthDays(userId, addDays(date, -29), date) : []), [userId, date]);
  useEffect(() => {
    if (!date) return undefined;
    const onShow = () => document.visibilityState === "visible" && reload();
    window.addEventListener("hub:changed", reload);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.removeEventListener("hub:changed", reload);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [reload, date]);
  return date && data?.length ? minutesWatch(data, date, { night }) : [];
}

function WatchRow({ parts }) {
  return (
    <div className="minutes-watch" aria-label="From your watch">
      <Watch size={13} className="minutes-watch__icon" aria-hidden="true" />
      <div className="watch-line__parts">
        {parts.map((p) => (
          <span key={p.label} className="watch-line__part">
            <span className="faint">{p.label}</span> <strong className="mono">{p.value}</strong>
            {p.sub && <span className="faint watch-line__sub">{p.sub}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

// What's running: since when, what and how long, and what the plan has in
// this hour. The white pill stops it ("I'm up" when it's Sleep).
function RunningHead({ entry, chunks, onStop, busy }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const tags = entry.tags?.length ? entry.tags : [entry.category];
  const sleeping = isSleep(entry);
  const block = sleeping ? null : blockNow(chunks);

  return (
    <div className="timer__head">
      <div className="timer__words">
        <div className="timer__since">
          <span className="running-dot" />
          {sleeping ? "Asleep" : "Running"} since {timeOf(entry.started_at)}
        </div>
        <div className="timer__what">
          {entry.description || tags.join(" · ")} <span className="timer__sep">·</span> <span className="timer__elapsed">{fmtElapsed(entry.started_at)}</span>
        </div>
        {block && (
          <div className="timer__plan mono">
            {block.title ? `${block.title} until` : "Planned until"} {fmtTime(block.end_time).replace(/ [AP]M$/, "")}
          </div>
        )}
      </div>
      <button type="button" className="btn btn--accent timer__go" onClick={onStop} disabled={busy}>
        {!sleeping && <Square size={12} fill="currentColor" />}
        {busy ? "Stopping…" : sleeping ? "I'm up" : "Stop"}
      </button>
    </div>
  );
}

// The block of today's plan the clock is in, if the day has one.
function blockNow(chunks) {
  if (!chunks?.length) return null;
  const d = new Date();
  return blocksOf(chunks, d.getHours() * 60 + d.getMinutes()).find((b) => b.state === "now") ?? null;
}
