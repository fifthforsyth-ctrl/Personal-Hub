import { useEffect, useRef, useState } from "react";
import { Moon, Check } from "lucide-react";
import { patchDayPlan, fetchDayPlan, fetchLastAlarm, saveJournalEntry, logPrayer, deletePrayer } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { friendlyError } from "../../lib/errors";
import { addDays } from "../../lib/planDates";
import { eveningStamp, fmtClock, lightsOutFor, rememberedAlarm } from "../../lib/honest";
import { Scale } from "../today/StopFollowUp";
import { timeOf } from "../today/minutes";
import "../../styles/honest.css";

// The short evening: for nights that end past midnight.
//
// The same day, the same records, just fewer of them: mood, whether you
// prayed, God's hand in one line, and when tomorrow starts. Each tap saves
// to the same place the full evening would put it (mood on the day, the
// prayer in your prayer log as "Evening", the line as the God's hand answer
// on the journal, the alarm on tomorrow), so switching to the full evening
// afterwards picks up right where this left off.
//
// The line saves when you leave the box, and once more just before the day
// is banked (`flushRef`). A line written counts as the reflection; with no
// line the day still banks, as an unreflected day.

const ALARMS = ["04:30", "06:00"];
const PRAYER_CONTEXT = "Evening";

async function loadShort(userId, date) {
  const tomorrow = addDays(date, 1);
  const [next, lastAlarm] = await Promise.all([fetchDayPlan(userId, tomorrow), fetchLastAlarm(userId, tomorrow)]);
  return { tomorrow, nextAlarm: next?.alarm_at?.slice(0, 5) ?? null, lastAlarm };
}

export default function ShortEvening({ userId, date, dayPlan, journal, prayers, flushRef, onLine }) {
  const { data } = useLoad(() => loadShort(userId, date), [userId, date]);

  const [mood, setMood] = useState(dayPlan?.mood ?? null);
  const [prayer, setPrayer] = useState(() => (prayers ?? []).find((p) => p.context === PRAYER_CONTEXT && !p.is_example) ?? null);
  const [line, setLine] = useState(journal?.gods_hand ?? "");
  const savedLine = useRef(journal?.gods_hand ?? "");
  const lineRef = useRef(line);
  lineRef.current = line;
  const [alarm, setAlarm] = useState(null);
  const alarmSeeded = useRef(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!data || alarmSeeded.current) return;
    alarmSeeded.current = true;
    if (data.nextAlarm) setAlarm(data.nextAlarm);
  }, [data]);

  useEffect(() => {
    onLine?.(Boolean(line.trim()) || Boolean(journal?.reflection_completed_at));
  }, [line, journal, onLine]);

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

  function pickMood(n) {
    const next = mood === n ? null : n;
    setMood(next);
    run("day", () => patchDayPlan(userId, date, { mood: next }), "Couldn't save that. Tap it again.");
  }

  function togglePrayed() {
    if (busy === "prayer") return;
    if (prayer) {
      const was = prayer;
      setPrayer(null);
      run("prayer", () => deletePrayer(was.id), "Couldn't remove that prayer. Try again.").then((ok) => ok || setPrayer(was));
      return;
    }
    run(
      "prayer",
      async () => setPrayer(await logPrayer(userId, { context: PRAYER_CONTEXT, content: "Prayed", prayedAt: eveningStamp(date).toISOString() })),
      "Couldn't log the prayer. Try again."
    );
  }

  // Only a line that's there and changed is sent: an empty box never blanks
  // an answer written earlier in the full evening. Writing one finishes the
  // reflection, the way the full evening's Finish does.
  async function saveLine() {
    const text = lineRef.current.trim();
    if (!text || text === savedLine.current.trim()) return true;
    const ok = await run("line", () => saveJournalEntry(userId, date, { godsHand: text, completed: true }), "Couldn't save that line. Try again.");
    if (ok) savedLine.current = text;
    return ok;
  }

  useEffect(() => {
    if (!flushRef) return;
    flushRef.current = async () => {
      if (!(await saveLine())) throw new Error("The line didn't save.");
    };
    return () => {
      flushRef.current = null;
    };
  });

  function pickAlarm(a) {
    if (!data) return;
    const next = alarm === a ? null : a;
    setAlarm(next);
    run("alarm", () => patchDayPlan(userId, data.tomorrow, { alarm_at: next }), "Couldn't save tomorrow's alarm. Try again.");
  }

  const lightsOut = data && alarm ? lightsOutFor(data.tomorrow, alarm) : null;
  const usual = data ? rememberedAlarm(null, data.lastAlarm) : null;
  const choices = alarm && !ALARMS.includes(alarm) ? [...ALARMS, alarm] : ALARMS;

  return (
    <div className="card card--accent evening-checkin short-evening">
      <div className="card-head" style={{ marginBottom: 4 }}>
        <span className="card-title"><Moon size={14} />The short evening</span>
        {busy ? <span className="faint evening-checkin__saving">Saving…</span> : null}
      </div>
      <p className="card-note" style={{ marginBottom: 2 }}>A few taps, then bank it and get to bed. Any can stay blank.</p>

      <div className="honest-label">Mood <span className="faint">1 low · 5 good</span></div>
      <Scale value={mood} onPick={pickMood} label="Mood" />

      <div className="honest-label">Prayer</div>
      <div className="honest-chips">
        <button type="button" className={"name-chip" + (prayer ? " name-chip--on" : "")} aria-pressed={Boolean(prayer)} onClick={togglePrayed} disabled={busy === "prayer"}>
          {prayer && <Check size={12} />}
          Prayed
        </button>
      </div>

      <div className="honest-label">Where did you see God's hand today?</div>
      <input
        className="input"
        value={line}
        onChange={(e) => setLine(e.target.value)}
        onBlur={saveLine}
        placeholder="One line is enough"
        aria-label="Where did you see God's hand today?"
        maxLength={2000}
      />

      <div className="honest-label">Tomorrow starts at</div>
      <div className="honest-chips">
        {choices.map((a) => (
          <button key={a} type="button" className={"name-chip" + (alarm === a ? " name-chip--on" : "")} aria-pressed={alarm === a} onClick={() => pickAlarm(a)} disabled={!data}>
            {fmtClock(a)}
          </button>
        ))}
      </div>
      <p className="evening-checkin__lights">
        {lightsOut ? (
          <>Lights out by {timeOf(lightsOut.toISOString())} for a full night. Sleep well.</>
        ) : (
          usual && <>Usually {fmtClock(usual)}.</>
        )}
      </p>

      {error && <div className="form-error" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}
