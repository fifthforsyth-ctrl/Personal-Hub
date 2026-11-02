import { useEffect, useState, useSyncExternalStore } from "react";
import { Sunrise, Check } from "lucide-react";
import {
  fetchSleepEntries,
  fetchLastAlarm,
  fetchWatchedHabits,
  fetchLossReasons,
  fetchWinLosses,
  fetchHealthDays,
  stopTimeEntry,
  updateTimeEntry,
  logPastTimeEntry,
  saveMorning,
  replaceCheckinWinLosses,
} from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { friendlyError } from "../../lib/errors";
import { parseDateStr, addDays } from "../../lib/planDates";
import {
  isMorning,
  isSleep,
  lastNightSleep,
  rememberedAlarm,
  habitsToAsk,
  keptByWake,
  reasonChips,
  resolveTimeBefore,
  hhmm,
  fmtClock,
  fmtDuration,
} from "../../lib/honest";
import { morningWatchLine, watchSlept } from "../../lib/watch";
import { Scale } from "./StopFollowUp";
import { timeOf } from "./minutes";
import { announceChange } from "./announce";
import "../../styles/honest.css";

// The morning check-in: how last night went, in about fifteen seconds.
//
// It sits on Today from three until noon. Almost everything is filled in
// already: when you woke and when the lights went out come from the Sleep
// timer (or from your watch, once it has set the night's times), and the
// alarm is the one you used last. What's left is a few taps:
// how well you slept, your energy, whether you snoozed, whether the phone
// was off by lights-out. If Sleep is still running, the first tap is "I'm
// up", which ends it.
//
// The wake-up habit for today's alarm ("Up at 4:30") is asked here too,
// already answered from when you woke. A miss is saved as a loss with a
// reason, as plain information, and shows with tonight's losses.
//
// Once it's done it folds to one line, and after noon it's gone either way.
// When the watch has last night, that line's sleep is the watch's (the
// same "slept 6h 52m" the Minutes card shows), not lights-out to wake.

const ALARMS = ["04:30", "06:00"];
const PHONE_OFF = "Phone off by lights-out";
const skipKey = (date) => `hub.morning-skip.${date}`;

// Whether the check-in is on Today showing last night (its form, or its
// one line once done, when that line says when you were up or how long you
// slept), so the watch row under the minutes can leave out Slept and Up
// instead of saying them a second time a few lines down. Null while that
// isn't known (the check-in still loading) and once it's off the page.
// Today tells the Minutes card whether the check-in is on the page at all,
// and only then does the card go by this (or, while it's null, by the
// check-in's hours).
let nightShown = null;
const nightListeners = new Set();
function setNightShown(v) {
  if (nightShown === v) return;
  nightShown = v;
  for (const f of nightListeners) f();
}
function onNightShown(f) {
  nightListeners.add(f);
  return () => nightListeners.delete(f);
}
export function useCheckinShowsNight() {
  return useSyncExternalStore(onNightShown, () => nightShown, () => null);
}

function noonBefore(date) {
  const d = parseDateStr(addDays(date, -1));
  d.setHours(12, 0, 0, 0);
  return d;
}

async function loadMorning(userId, date) {
  const since = noonBefore(date).toISOString();
  const [sleeps, lastAlarm, watched, reasons, rows, watchDays] = await Promise.all([
    fetchSleepEntries(userId, since),
    fetchLastAlarm(userId, date),
    fetchWatchedHabits(userId).catch((err) => {
      console.warn(err);
      return [];
    }),
    fetchLossReasons(userId).catch((err) => {
      console.warn(err);
      return [];
    }),
    fetchWinLosses(userId, { sinceISO: since, limit: 200 }),
    // What the watch saw of the night. The check-in never waits on it.
    fetchHealthDays(userId, date, date).catch((err) => {
      console.warn(err);
      return [];
    }),
  ]);
  return {
    watchLine: morningWatchLine(watchDays[0]),
    watchSlept: watchSlept(watchDays[0]),
    sleep: lastNightSleep(sleeps, date),
    lastAlarm,
    watched,
    reasons,
    checkinRows: rows.filter((r) => r.source === "checkin"),
    handWins: rows.filter((r) => r.kind === "win" && r.source !== "checkin" && new Date(r.occurred_at) >= parseDateStr(date)),
  };
}

export default function MorningCheckin({ userId, date, dayPlan, running, onChanged }) {
  const { data, reload } = useLoad(() => loadMorning(userId, date), [userId, date]);
  const [editing, setEditing] = useState(false);
  const [waking, setWaking] = useState(false);
  const [wakeError, setWakeError] = useState(null);
  const [skipped, setSkipped] = useState(() => {
    try {
      return localStorage.getItem(skipKey(date)) === "1";
    } catch (err) {
      console.warn(err);
      return false;
    }
  });

  // Sleep stopped from the timer, or a runaway fixed: read the night again.
  // And when you come back to the app, since the watch sends the night in
  // the background, often after the check-in has loaded or been done; then
  // its sleep is the one the one line shows.
  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && reload();
    window.addEventListener("hub:changed", reload);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.removeEventListener("hub:changed", reload);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [reload]);

  const done = Boolean(dayPlan?.morning_at);
  const asleep = Boolean(running && isSleep(running));
  // What the returns below show, for the Minutes card: the night (the form,
  // or the one line when it has Up or the sleep in it), not the night
  // (nothing, the I'm up button, or a line with neither), or not known yet.
  const showsNight =
    !isMorning() && !editing ? false : !data ? null : done && !editing ? nightParts(dayPlan, data.watchSlept).length > 0 : skipped && !editing ? false : !asleep;
  useEffect(() => {
    setNightShown(showsNight);
  }, [showsNight]);
  useEffect(() => () => setNightShown(null), []);

  if (!isMorning() && !editing) return null;
  if (!data) return null;
  if (done && !editing) return <Summary plan={dayPlan} slept={data.watchSlept} onEdit={() => setEditing(true)} />;
  if (skipped && !editing) return null;

  // Still asleep, as far as the timer knows: one tap ends it.
  if (asleep) {
    async function imUp() {
      setWaking(true);
      setWakeError(null);
      try {
        // If the watch ended Sleep after this page loaded, this changes
        // nothing (its wake time stays) and the reload shows the night.
        await stopTimeEntry(running.id);
        announceChange();
        await Promise.all([reload(), onChanged?.()]);
      } catch (err) {
        setWakeError(friendlyError(err, "Couldn't stop Sleep. Try again."));
      } finally {
        setWaking(false);
      }
    }
    return (
      <div className="card morning">
        <div className="card-head" style={{ marginBottom: 6 }}>
          <span className="card-title"><Sunrise size={14} />Good morning</span>
        </div>
        <p className="card-note" style={{ marginBottom: 12 }}>
          Sleep has been running since {timeOf(running.started_at)}. Tap I&apos;m up, then a few taps about the night.
        </p>
        <button type="button" className="btn btn--accent btn--block" onClick={imUp} disabled={waking}>
          {waking ? "Stopping Sleep…" : "I'm up"}
        </button>
        {wakeError && <div className="form-error" style={{ marginTop: 8 }}>{wakeError}</div>}
      </div>
    );
  }

  return (
    <CheckinForm
      key={`${date}-${data.sleep?.id ?? "none"}-${data.sleep?.ended_at ?? "running"}-${editing}`}
      userId={userId}
      date={date}
      plan={dayPlan}
      data={data}
      onSkip={() => {
        try {
          localStorage.setItem(skipKey(date), "1");
        } catch (err) {
          console.warn(err);
        }
        setSkipped(true);
      }}
      onSaved={async () => {
        setEditing(false);
        announceChange();
        await Promise.all([reload(), onChanged?.()]);
      }}
      onCancel={editing ? () => setEditing(false) : null}
    />
  );
}

// What the one line says of the night: when you were up, and how long you
// slept. `slept` is the watch's sleep for the night ("6h 52m"), or null
// without one; then it's lights-out to wake, as you gave them. Empty when
// it has neither, and then the Minutes card says them instead.
export function nightParts(plan, slept) {
  const parts = [];
  if (plan.woke_at) parts.push(`Up ${timeOf(plan.woke_at)}`);
  if (slept) parts.push(`slept ${slept}`);
  else if (plan.woke_at && plan.lights_out_at) parts.push(`${fmtDuration((new Date(plan.woke_at) - new Date(plan.lights_out_at)) / 60000)} of sleep`);
  return parts;
}

function Summary({ plan, slept, onEdit }) {
  const parts = nightParts(plan, slept);
  if (plan.sleep_quality) parts.push(`quality ${plan.sleep_quality}`);
  if (plan.energy) parts.push(`energy ${plan.energy}`);
  return (
    <div className="morning-summary">
      <Check size={14} className="morning-summary__mark" />
      <span className="morning-summary__text">{parts.length ? parts.join(" · ") : "Morning check-in done"}</span>
      <button type="button" className="btn-link morning-summary__edit" onClick={onEdit}>Edit</button>
    </div>
  );
}

function atClock(date, clock) {
  const d = parseDateStr(date);
  const [h, m] = clock.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

function CheckinForm({ userId, date, plan, data, onSaved, onSkip, onCancel }) {
  const { sleep } = data;
  const fromSleep = { woke: Boolean(!plan?.woke_at && sleep?.ended_at), lights: Boolean(!plan?.lights_out_at && sleep) };

  const [woke, setWoke] = useState(() => (plan?.woke_at ? hhmm(new Date(plan.woke_at)) : sleep?.ended_at ? hhmm(new Date(sleep.ended_at)) : ""));
  const [lights, setLights] = useState(() =>
    plan?.lights_out_at ? hhmm(new Date(plan.lights_out_at)) : sleep ? hhmm(new Date(sleep.started_at)) : ""
  );
  // The two times as the form opened, so saving an answer about something
  // else doesn't put older times back over the ones your watch set.
  const [opened] = useState(() => ({ woke, lights }));
  const fromWatch = Boolean(sleep && (sleep.watch_fixed_at || sleep.source === "watch"));
  const [alarm, setAlarm] = useState(() => rememberedAlarm(plan?.alarm_at, data.lastAlarm));
  const [otherAlarm, setOtherAlarm] = useState(() => !ALARMS.includes(rememberedAlarm(plan?.alarm_at, data.lastAlarm)));
  const [quality, setQuality] = useState(plan?.sleep_quality ?? null);
  const [energy, setEnergy] = useState(plan?.energy ?? null);
  const [snoozed, setSnoozed] = useState(plan?.snoozed ?? false);
  const [phoneOff, setPhoneOff] = useState(plan?.phone_off_by_lights_out ?? null);
  // Answers to the habits, by label. What the check-in saved before wins;
  // otherwise kept or missed is read from when you woke.
  const [answers, setAnswers] = useState(() => {
    const out = {};
    for (const r of data.checkinRows) if (r.habit_label !== PHONE_OFF) out[r.habit_label] = { kept: r.kind === "win", reason: r.reason ?? null };
    return out;
  });
  const [otherReason, setOtherReason] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const wokeDate = woke ? atClock(date, woke) : null;
  const lightsDate = lights ? resolveTimeBefore((wokeDate ?? atClock(date, "12:00")).toISOString(), lights) : null;
  const slept = wokeDate && lightsDate ? (wokeDate - lightsDate) / 60000 : null;

  const habits = habitsToAsk(data.watched, { alarm, handWins: data.handWins });
  const answerOf = (h) => answers[h.label] ?? { kept: h.wake ? keptByWake(h, wokeDate) : null, reason: null };
  const reasons = reasonChips(data.reasons);

  function setAnswer(h, patch) {
    setAnswers((a) => ({ ...a, [h.label]: { ...answerOf(h), ...patch } }));
  }

  async function save() {
    if (busy) return;
    setError(null);
    if (wokeDate && wokeDate > new Date(Date.now() + 5 * 60000)) return setError("Woke at is later than now. Fix the time and try again.");
    if (slept != null && slept > 16 * 60) return setError("That's more than 16 hours of sleep. Check the two times.");
    setBusy(true);
    try {
      // The Sleep timer follows what you say: it ends when you woke and
      // starts when the lights went out. With no Sleep timer at all, these
      // two answers become one. Once the watch has set the night, a time
      // goes over it only when you change that time here; then yours wins,
      // and the watch won't move it again.
      if (sleep) {
        const set = Boolean(sleep.watch_fixed_at);
        const wokeSaid = !set || woke !== opened.woke;
        const lightsSaid = !set || lights !== opened.lights;
        const fields = {};
        if (wokeSaid && wokeDate && (!sleep.ended_at || Math.abs(new Date(sleep.ended_at) - wokeDate) >= 60000)) fields.ended_at = wokeDate.toISOString();
        if (wokeDate && !sleep.ended_at) fields.ended_by = "stop";
        if (lightsSaid && lightsDate && Math.abs(new Date(sleep.started_at) - lightsDate) >= 60000) fields.started_at = lightsDate.toISOString();
        if (Object.keys(fields).length) await updateTimeEntry(sleep.id, fields);
      } else if (wokeDate && lightsDate && slept > 0) {
        await logPastTimeEntry(userId, { categories: ["Sleep"], minutes: Math.round(slept), startedAt: lightsDate.toISOString() });
      }

      await saveMorning(userId, date, {
        woke_at: wokeDate?.toISOString() ?? null,
        lights_out_at: lightsDate?.toISOString() ?? null,
        alarm_at: alarm,
        sleep_quality: quality,
        energy,
        snoozed,
        phone_off_by_lights_out: phoneOff,
        morning_at: new Date().toISOString(),
      });

      const rows = [];
      for (const h of habits) {
        const a = answerOf(h);
        if (a.kept == null) continue;
        rows.push({
          kind: a.kept ? "win" : "loss",
          habit_label: h.label,
          reason: a.kept ? null : a.reason?.trim() || null,
          occurred_at: (wokeDate ?? new Date()).toISOString(),
        });
      }
      if (phoneOff != null) {
        rows.push({ kind: phoneOff ? "win" : "loss", habit_label: PHONE_OFF, occurred_at: (lightsDate ?? noonBefore(date)).toISOString() });
      }
      await replaceCheckinWinLosses(userId, noonBefore(date).toISOString(), rows);
      await onSaved();
    } catch (err) {
      setError(friendlyError(err, "Couldn't save the check-in. Try again."));
      setBusy(false);
    }
  }

  return (
    <div className="card morning">
      <div className="card-head" style={{ marginBottom: 6 }}>
        <span className="card-title"><Sunrise size={14} />Good morning</span>
        <span className="mono faint morning__alarm-tag">{fmtClock(alarm)} day</span>
      </div>

      <div className="morning__fields">
        <label className="morning__field">
          <span>Woke at</span>
          <input className="input" type="time" value={woke} onChange={(e) => setWoke(e.target.value)} aria-label="Woke at" />
        </label>
        <label className="morning__field">
          <span>Lights out</span>
          <input className="input" type="time" value={lights} onChange={(e) => setLights(e.target.value)} aria-label="Lights out last night" />
        </label>
      </div>
      {slept != null && slept > 0 && (
        <p className="morning__slept">
          {fmtDuration(slept)} of sleep{(fromSleep.woke || fromSleep.lights) && (fromWatch ? ", from your watch" : ", from your Sleep timer")}
        </p>
      )}
      {data.watchLine && <p className="morning__slept morning__watch">{data.watchLine}</p>}

      <div className="honest-label">Alarm was set for</div>
      <div className="honest-chips">
        {ALARMS.map((a) => (
          <button
            key={a}
            type="button"
            className={"name-chip" + (!otherAlarm && alarm === a ? " name-chip--on" : "")}
            aria-pressed={!otherAlarm && alarm === a}
            onClick={() => {
              setOtherAlarm(false);
              setAlarm(a);
            }}
          >
            {fmtClock(a)}
          </button>
        ))}
        {otherAlarm ? (
          <input className="input morning__other-alarm" type="time" value={alarm} onChange={(e) => e.target.value && setAlarm(e.target.value)} aria-label="Alarm time" />
        ) : (
          <button type="button" className="name-chip name-chip--add" onClick={() => setOtherAlarm(true)}>Other</button>
        )}
      </div>

      <div className="honest-label">Sleep quality</div>
      <Scale value={quality} onPick={(n) => setQuality((q) => (q === n ? null : n))} label="Sleep quality" />

      <div className="honest-label">Energy</div>
      <Seg
        label="Energy"
        value={energy}
        onPick={setEnergy}
        options={[
          ["high", "High"],
          ["okay", "Okay"],
          ["low", "Low"],
        ]}
      />

      <div className="morning__pair">
        <div>
          <div className="honest-label">Snoozed?</div>
          <Seg label="Snoozed" value={snoozed} onPick={(v) => setSnoozed(v ?? false)} options={[[false, "No"], [true, "Yes"]]} />
        </div>
        <div>
          <div className="honest-label">Phone off by lights-out?</div>
          <Seg label="Phone off by lights-out" value={phoneOff} onPick={setPhoneOff} options={[[true, "Yes"], [false, "No"]]} />
        </div>
      </div>

      {habits.map((h) => {
        const a = answerOf(h);
        return (
          <div key={h.label} className="morning__habit">
            <div className="honest-label">{h.label}?</div>
            <Seg label={h.label} value={a.kept} onPick={(v) => setAnswer(h, { kept: v })} options={[[true, "Yes"], [false, "Missed"]]} />
            {a.kept === false && (
              <>
                <div className="honest-label">What got in the way? <span className="faint">(optional)</span></div>
                <div className="honest-chips">
                  {[...reasons, ...(a.reason && !reasons.some((r) => r.toLowerCase() === a.reason.toLowerCase()) ? [a.reason] : [])].map((r) => {
                    const on = a.reason?.toLowerCase() === r.toLowerCase();
                    return (
                      <button key={r} type="button" className={"name-chip" + (on ? " name-chip--on" : "")} aria-pressed={on} onClick={() => setAnswer(h, { reason: on ? null : r })}>
                        {r}
                      </button>
                    );
                  })}
                  {otherReason === h.label ? (
                    <form
                      className="honest-add"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const t = e.currentTarget.elements.reason.value.trim();
                        if (t) setAnswer(h, { reason: t.slice(0, 60) });
                        setOtherReason(null);
                      }}
                    >
                      <input name="reason" className="input" placeholder="In a few words" aria-label="Another reason" maxLength={60} autoFocus />
                      <button type="submit" className="btn btn--sm">Add</button>
                    </form>
                  ) : (
                    <button type="button" className="name-chip name-chip--add" onClick={() => setOtherReason(h.label)}>Other…</button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}

      {error && <div className="form-error" style={{ marginTop: 10 }}>{error}</div>}

      <div className="morning__actions">
        {onCancel ? (
          <button type="button" className="btn-link" onClick={onCancel}>Cancel</button>
        ) : (
          <button type="button" className="btn-link" onClick={onSkip}>Not today</button>
        )}
        <button type="button" className="btn btn--accent" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Done"}
        </button>
      </div>
    </div>
  );
}

// A segmented choice where tapping the chosen option again clears it.
function Seg({ label, value, onPick, options }) {
  return (
    <div className="seg seg--block" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={String(v)} type="button" className={"seg-btn" + (value === v ? " active" : "")} aria-pressed={value === v} onClick={() => onPick(value === v ? null : v)}>
          {text}
        </button>
      ))}
    </div>
  );
}
