import { useEffect, useRef, useState } from "react";
import { Moon, Check } from "lucide-react";
import {
  patchDayPlan,
  fetchDayPlan,
  fetchLastAlarm,
  fetchEveningHistory,
  logPrayer,
  updatePrayer,
  deletePrayer,
  logExperience,
  updateExperience,
  deleteExperience,
} from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { friendlyError } from "../../lib/errors";
import { addDays } from "../../lib/planDates";
import { fmtMinutes } from "../../lib/categories";
import {
  reasonChips,
  offPlan,
  lightsOutFor,
  eveningStamp,
  fmtClock,
  rememberedAlarm,
  STRESS_SOURCES,
  OFF_PLAN_REASONS,
  SLEEP_HOURS,
} from "../../lib/honest";
import { Scale } from "../today/StopFollowUp";
import { timeOf } from "../today/minutes";
import "../../styles/honest.css";

// The evening check-in: the day in a few taps, just before banking it.
//
// Mood and stress (with where the stress came from), why the day went off
// plan when planned blocks didn't happen, a line of prayer, whether there
// was a prompting, and when tomorrow starts. Every answer saves the moment
// it's tapped and every one can be left blank; banking never waits on it.
//
// The prayer goes into your prayer log (context "Evening") and a prompting
// into your promptings, so both show up where they always have. One you
// didn't act on stays open there for the weekly review.
//
// Tomorrow's alarm is written to tomorrow, where the morning check-in picks
// it up. The lights-out time it implies shows on Today as the evening comes.

const ALARMS = ["04:30", "06:00"];
const PRAYER_CONTEXT = "Evening";
const PROMPTING_CONTEXT = "Evening check-in";

async function loadEvening(userId, date) {
  const tomorrow = addDays(date, 1);
  const [next, lastAlarm, history] = await Promise.all([
    fetchDayPlan(userId, tomorrow),
    fetchLastAlarm(userId, tomorrow),
    fetchEveningHistory(userId).catch((err) => {
      console.warn(err);
      return { stressSources: [], offPlanReasons: [] };
    }),
  ]);
  return { tomorrow, nextAlarm: next?.alarm_at?.slice(0, 5) ?? null, lastAlarm, history };
}

export default function EveningCheckin({ userId, date, dayPlan, chunks, entries, prayers, experiences }) {
  const { data } = useLoad(() => loadEvening(userId, date), [userId, date]);

  const [mood, setMood] = useState(dayPlan?.mood ?? null);
  const [stress, setStress] = useState(dayPlan?.stress ?? null);
  const [source, setSource] = useState(dayPlan?.stress_source ?? null);
  const [offReason, setOffReason] = useState(dayPlan?.off_plan_reason ?? null);
  const [prayer, setPrayer] = useState(() => (prayers ?? []).find((p) => p.context === PRAYER_CONTEXT && !p.is_example) ?? null);
  const [prayerText, setPrayerText] = useState(() => {
    const p = (prayers ?? []).find((x) => x.context === PRAYER_CONTEXT && !x.is_example);
    return p && p.content !== "Prayed" ? p.content : "";
  });
  const [prompting, setPrompting] = useState(() => (experiences ?? []).find((e) => e.trigger_context === PROMPTING_CONTEXT && !e.is_example) ?? null);
  const [hadPrompting, setHadPrompting] = useState(dayPlan?.had_prompting ?? null);
  const [promptText, setPromptText] = useState(() => {
    const e = (experiences ?? []).find((x) => x.trigger_context === PROMPTING_CONTEXT && !x.is_example);
    return e && e.what_came !== "A prompting" ? e.what_came : "";
  });
  const [alarm, setAlarm] = useState(null);
  const [otherAlarm, setOtherAlarm] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const alarmSeeded = useRef(false);

  // Tomorrow's alarm, once it's read: the one set already, if any.
  useEffect(() => {
    if (!data || alarmSeeded.current) return;
    alarmSeeded.current = true;
    if (data.nextAlarm) {
      setAlarm(data.nextAlarm);
      setOtherAlarm(!ALARMS.includes(data.nextAlarm));
    }
  }, [data]);

  const missed = offPlan(chunks, entries, { date });
  const earlierPromptings = (experiences ?? []).filter((e) => e.kind === "prompting" && !e.is_example && e.trigger_context !== PROMPTING_CONTEXT);
  const sources = reasonChips(data?.history.stressSources, 8, STRESS_SOURCES);
  const offReasons = reasonChips(data?.history.offPlanReasons, 8, OFF_PLAN_REASONS);

  async function run(what, fn, fallback) {
    setBusy(what);
    setError(null);
    try {
      await fn();
      return true;
    } catch (err) {
      setError(friendlyError(err, fallback));
      return false;
    } finally {
      setBusy(null);
    }
  }

  function saveDay(fields) {
    return run("day", () => patchDayPlan(userId, date, fields), "Couldn't save that. Tap it again.");
  }

  function pickMood(n) {
    const next = mood === n ? null : n;
    setMood(next);
    saveDay({ mood: next });
  }

  function pickStress(n) {
    const next = stress === n ? null : n;
    setStress(next);
    saveDay({ stress: next });
  }

  function pickSource(v) {
    const next = v && source?.toLowerCase() === v.toLowerCase() ? null : v;
    setSource(next);
    saveDay({ stress_source: next });
  }

  function pickOffReason(v) {
    const next = v && offReason?.toLowerCase() === v.toLowerCase() ? null : v;
    setOffReason(next);
    saveDay({ off_plan_reason: next });
  }

  // Prayed: one tap logs it; the line beside it is optional and saves when
  // you leave it. Tapping again takes it back out of the log.
  function togglePrayed() {
    if (busy) return;
    if (prayer) {
      const was = prayer;
      setPrayer(null);
      run("prayer", () => deletePrayer(was.id), "Couldn't remove that prayer. Try again.").then((ok) => ok || setPrayer(was));
      return;
    }
    run(
      "prayer",
      async () => {
        const row = await logPrayer(userId, {
          context: PRAYER_CONTEXT,
          content: prayerText.trim() || "Prayed",
          prayedAt: eveningStamp(date).toISOString(),
        });
        setPrayer(row);
      },
      "Couldn't log the prayer. Try again."
    );
  }

  function savePrayerText() {
    if (!prayer) return;
    const content = prayerText.trim() || "Prayed";
    if (content === prayer.content) return;
    run(
      "prayer",
      async () => setPrayer(await updatePrayer(userId, prayer.id, { content })),
      "Couldn't save that line. Try again."
    );
  }

  // "No" is the whole answer most nights. A yes is kept as a prompting:
  // closed if you acted on it, open (for the weekly review) if not.
  function pickPrompting(v) {
    if (busy) return;
    const next = promptingState() === v ? null : v;
    run(
      "prompting",
      async () => {
        if (next === null || next === "no") {
          if (prompting) await deleteExperience(prompting.id);
          setPrompting(null);
          setHadPrompting(next === "no" ? false : null);
          await patchDayPlan(userId, date, { had_prompting: next === "no" ? false : null });
          return;
        }
        const acted = next === "acted";
        const closing = acted
          ? { acted_on: true, acted_on_at: new Date().toISOString(), action_taken: "Acted on it" }
          : { acted_on: false, acted_on_at: null, action_taken: null };
        let row = prompting;
        if (!row) {
          row = await logExperience(userId, {
            kind: "prompting",
            whatCame: promptText.trim() || "A prompting",
            triggerContext: PROMPTING_CONTEXT,
            occurredAt: eveningStamp(date).toISOString(),
          });
        }
        row = await updateExperience(userId, row.id, closing);
        setPrompting(row);
        setHadPrompting(true);
        await patchDayPlan(userId, date, { had_prompting: true });
      },
      "Couldn't save that. Tap it again."
    );
  }

  function promptingState() {
    if (hadPrompting === false) return "no";
    if (prompting) return prompting.acted_on ? "acted" : "not_acted";
    return null;
  }

  function savePromptText() {
    if (!prompting) return;
    const whatCame = promptText.trim() || "A prompting";
    if (whatCame === prompting.what_came) return;
    run(
      "prompting",
      async () => setPrompting(await updateExperience(userId, prompting.id, { what_came: whatCame })),
      "Couldn't save that line. Try again."
    );
  }

  function pickAlarm(a) {
    const next = !otherAlarm && alarm === a ? null : a;
    setOtherAlarm(false);
    setAlarm(next);
    run("alarm", () => patchDayPlan(userId, data.tomorrow, { alarm_at: next }), "Couldn't save tomorrow's alarm. Try again.");
  }

  function setOtherClock(v) {
    if (!v) return;
    setAlarm(v);
    run("alarm", () => patchDayPlan(userId, data.tomorrow, { alarm_at: v }), "Couldn't save tomorrow's alarm. Try again.");
  }

  const state = promptingState();
  const lightsOut = data && alarm ? lightsOutFor(data.tomorrow, alarm) : null;
  const usual = data ? rememberedAlarm(null, data.lastAlarm) : null;

  return (
    <div className="card evening-checkin">
      <div className="card-head" style={{ marginBottom: 4 }}>
        <span className="card-title"><Moon size={14} />Before you bank it</span>
        {busy ? <span className="faint evening-checkin__saving">Saving…</span> : null}
      </div>
      <p className="card-note" style={{ marginBottom: 2 }}>A few taps. Each one saves as you go, and any can stay blank.</p>

      <div className="honest-label">Mood <span className="faint">1 low · 5 good</span></div>
      <Scale value={mood} onPick={pickMood} label="Mood" />

      <div className="honest-label">Stress <span className="faint">1 calm · 5 a lot</span></div>
      <Scale value={stress} onPick={pickStress} label="Stress" />

      {stress != null && stress >= 2 && (
        <>
          <div className="honest-label">Mostly from</div>
          <Chips options={sources} value={source} onPick={pickSource} label="Where the stress came from" />
        </>
      )}

      {missed.length > 0 && (
        <>
          <div className="honest-label">Why did today go off plan?</div>
          <p className="evening-checkin__missed">
            {missed.map((m, i) => (
              <span key={m.category}>
                {i > 0 && " · "}
                {m.category}: {fmtMinutes(m.tracked)} of {fmtMinutes(m.planned)}
              </span>
            ))}
          </p>
          <Chips options={offReasons} value={offReason} onPick={pickOffReason} label="Why the day went off plan" max={300} />
        </>
      )}

      <div className="honest-label">Prayer</div>
      <div className="evening-checkin__line">
        <button type="button" className={"name-chip" + (prayer ? " name-chip--on" : "")} aria-pressed={Boolean(prayer)} onClick={togglePrayed} disabled={busy === "prayer"}>
          {prayer && <Check size={12} />}
          Prayed
        </button>
        <input
          className="input"
          value={prayerText}
          onChange={(e) => setPrayerText(e.target.value)}
          onBlur={savePrayerText}
          placeholder="One line about it (optional)"
          aria-label="A line about tonight's prayer"
          maxLength={300}
        />
      </div>

      <div className="honest-label">Any prompting today?</div>
      {earlierPromptings.length > 0 && (
        <p className="evening-checkin__earlier">
          Already noted: {earlierPromptings.map((e) => `“${e.what_came}” (${timeOf(e.occurred_at)})`).join(", ")}
        </p>
      )}
      <div className="seg seg--block" role="group" aria-label="Any prompting today?">
        {[
          ["no", "No"],
          ["acted", "Yes, acted"],
          ["not_acted", "Yes, didn't"],
        ].map(([v, text]) => (
          <button key={v} type="button" className={"seg-btn" + (state === v ? " active" : "")} aria-pressed={state === v} onClick={() => pickPrompting(v)} disabled={busy === "prompting"}>
            {text}
          </button>
        ))}
      </div>
      {prompting && (
        <input
          className="input evening-checkin__what"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          onBlur={savePromptText}
          placeholder="What came? (optional)"
          aria-label="What the prompting was"
          maxLength={300}
        />
      )}

      <div className="honest-label">Tomorrow starts at</div>
      <div className="honest-chips">
        {ALARMS.map((a) => (
          <button
            key={a}
            type="button"
            className={"name-chip" + (!otherAlarm && alarm === a ? " name-chip--on" : "")}
            aria-pressed={!otherAlarm && alarm === a}
            onClick={() => pickAlarm(a)}
            disabled={!data}
          >
            {fmtClock(a)}
          </button>
        ))}
        {otherAlarm ? (
          <input className="input morning__other-alarm" type="time" value={alarm ?? ""} onChange={(e) => setOtherClock(e.target.value)} aria-label="Tomorrow's alarm" />
        ) : (
          <button type="button" className="name-chip name-chip--add" onClick={() => setOtherAlarm(true)} disabled={!data}>Other</button>
        )}
      </div>
      <p className="evening-checkin__lights">
        {lightsOut ? (
          <>
            Lights out by {timeOf(lightsOut.toISOString())} for {fmtHours(SLEEP_HOURS)} hours of sleep.
          </>
        ) : (
          usual && <>Usually {fmtClock(usual)}. Pick one to see tonight's lights-out time.</>
        )}
      </p>

      {error && <div className="form-error" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}

// One of a few chips, or your own words. Tapping the chosen one clears it.
function Chips({ options, value, onPick, label, max = 60 }) {
  const [adding, setAdding] = useState(false);
  const all = [...options, ...(value && !options.some((o) => o.toLowerCase() === value.toLowerCase()) ? [value] : [])];
  return (
    <div className="honest-chips" role="group" aria-label={label}>
      {all.map((o) => {
        const on = value?.toLowerCase() === o.toLowerCase();
        return (
          <button key={o} type="button" className={"name-chip" + (on ? " name-chip--on" : "")} aria-pressed={on} onClick={() => onPick(o)}>
            {o}
          </button>
        );
      })}
      {adding ? (
        <form
          className="honest-add"
          onSubmit={(e) => {
            e.preventDefault();
            const t = e.currentTarget.elements.own.value.trim();
            if (t) onPick(t.slice(0, max));
            setAdding(false);
          }}
        >
          <input name="own" className="input" placeholder="In a few words" aria-label={label} maxLength={max} autoFocus />
          <button type="submit" className="btn btn--sm">Add</button>
        </form>
      ) : (
        <button type="button" className="name-chip name-chip--add" onClick={() => setAdding(true)}>Other…</button>
      )}
    </div>
  );
}

// 8.5 → "8½", 8 → "8".
function fmtHours(h) {
  const whole = Math.floor(h);
  return h - whole === 0.5 ? `${whole}½` : String(h);
}
