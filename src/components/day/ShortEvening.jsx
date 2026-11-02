import { useEffect, useRef, useState } from "react";
import { Moon } from "lucide-react";
import { patchDayPlan, fetchDayPlan, fetchLastAlarm, saveJournalEntry } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { addDays } from "../../lib/planDates";
import { toFive, tenOf } from "../../lib/checks";
import { fmtClock, lightsOutFor, rememberedAlarm } from "../../lib/honest";
import { timeOf } from "../today/minutes";
import { eveningDate } from "../today/dayParts";
import Slider from "../ui/Slider";
import { useSaves, useFollow, useNote, NoteInput, SaveState } from "./EveningCheckin";
import "../../styles/honest.css";
import "../../styles/daily.css";

// The short evening: for nights that end past midnight.
//
// The same day, the same records, just fewer of them: mood on its one to
// ten, any communication with God, God's hand in one line, and when
// tomorrow starts. Each saves to the same place the full evening puts it
// (the mood on the day, with its 1–5 beside it; the note and the line on
// the journal; the alarm on tomorrow), so switching to the full evening
// afterwards picks up right where this left off. The saves go one at a time
// and a failed one waits and retries, the same way the full evening's do
// (useSaves in EveningCheckin.jsx).
//
// The note and the line save a moment after you stop typing, when you leave
// the box, and once more just before the day is banked (`flushRef`). A line
// written counts as the reflection; with no line the day still banks, as an
// unreflected day. An empty line never blanks one written earlier in the
// full evening.
//
// Tomorrow's alarm is only asked tonight: going back to a missed day, its
// tomorrow is already over.

const ALARMS = ["04:30", "06:00"];

async function loadShort(userId, date) {
  const tomorrow = addDays(date, 1);
  const [next, lastAlarm] = await Promise.all([fetchDayPlan(userId, tomorrow), fetchLastAlarm(userId, tomorrow)]);
  return { tomorrow, nextAlarm: next?.alarm_at?.slice(0, 5) ?? null, lastAlarm };
}

export default function ShortEvening({ userId, date, dayPlan, journal, flushRef, onLine }) {
  const { data } = useLoad(() => loadShort(userId, date), [userId, date]);
  const saves = useSaves();

  const [mood, setMood] = useFollow(tenOf(dayPlan, "mood"));
  const godNote = useNote(saves.save, "godNote", journal?.god_note, (t) => saveJournalEntry(userId, date, { godNote: t }));
  // Writing the line finishes the reflection, the way the full evening's
  // Finish does.
  const line = useNote(saves.save, "godsHand", journal?.gods_hand, (t) => saveJournalEntry(userId, date, { godsHand: t, completed: true }), { keepBlank: true });

  const [alarm, setAlarm] = useState(null);
  const alarmSeeded = useRef(false);

  useEffect(() => {
    if (!data || alarmSeeded.current) return;
    alarmSeeded.current = true;
    if (data.nextAlarm) setAlarm(data.nextAlarm);
  }, [data]);

  const hasLine = Boolean(line.text.trim()) || Boolean(journal?.reflection_completed_at);
  useEffect(() => {
    onLine?.(hasLine);
  }, [hasLine, onLine]);

  const notes = useRef([]);
  notes.current = [godNote, line];
  const { flush } = saves;
  useEffect(() => {
    if (!flushRef) return undefined;
    flushRef.current = async () => {
      for (const n of notes.current) n.saveNow();
      await flush();
    };
    return () => {
      flushRef.current = null;
    };
  }, [flushRef, flush]);

  function pickMood(n) {
    if (n === mood && !saves.waiting("mood")) return;
    setMood(n);
    saves.save("mood", () => patchDayPlan(userId, date, { mood_10: n, mood: toFive(n) }));
  }

  // Tapping the alarm already chosen leaves it chosen.
  function pickAlarm(a) {
    if (!data) return;
    if (alarm === a && !saves.waiting("alarm")) return;
    setAlarm(a);
    saves.save("alarm", () => patchDayPlan(userId, data.tomorrow, { alarm_at: a }));
  }

  const lightsOut = data && alarm ? lightsOutFor(data.tomorrow, alarm) : null;
  const usual = data ? rememberedAlarm(null, data.lastAlarm) : null;
  const choices = alarm && !ALARMS.includes(alarm) ? [...ALARMS, alarm] : ALARMS;

  return (
    <div className="card card--accent evening-checkin short-evening">
      <div className="card-head" style={{ marginBottom: 4 }}>
        <span className="card-title">
          <Moon size={14} />
          The short evening
        </span>
        <SaveState saves={saves} />
      </div>
      <p className="card-note" style={{ marginBottom: 2 }}>
        A few taps, then bank it. Any can stay blank.
      </p>

      <div className="evening-feel">
        <Slider label="Mood" value={mood} onChange={pickMood} low="1 low" high="10 good" />
      </div>

      <div className="evening-god">
        <label className="evening-god__q" htmlFor={`short-god-${date}`}>
          Any communication with God today?
        </label>
        <NoteInput id={`short-god-${date}`} note={godNote} placeholder="A prayer, a prompting, a quiet moment, in your words." max={2000} multiline />
      </div>

      <div className="honest-label">Where did you see God's hand?</div>
      <NoteInput note={line} placeholder="One line is enough" label="Where did you see God's hand?" max={2000} />

      {date >= eveningDate() && (
        <>
          <div className="honest-label">Tomorrow starts at</div>
          <div className="honest-chips">
            {choices.map((a) => (
              <button
                key={a}
                type="button"
                className={"name-chip" + (alarm === a ? " name-chip--on" : "")}
                aria-pressed={alarm === a}
                onClick={() => pickAlarm(a)}
                disabled={!data}
              >
                {fmtClock(a)}
              </button>
            ))}
          </div>
          <p className="evening-checkin__lights">
            {lightsOut ? <>Lights out by {timeOf(lightsOut.toISOString())} for a full night. Sleep well.</> : usual && <>Usually {fmtClock(usual)}.</>}
          </p>
        </>
      )}
    </div>
  );
}
