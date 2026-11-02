import { useCallback, useEffect, useRef, useState } from "react";
import { Moon, Check } from "lucide-react";
import { patchDayPlan, fetchDayPlan, fetchLastAlarm, saveJournalEntry } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { addDays } from "../../lib/planDates";
import { toFive, tenOf } from "../../lib/checks";
import { lightsOutFor, fmtClock, rememberedAlarm, isSunday, SLEEP_HOURS } from "../../lib/honest";
import { timeOf } from "../today/minutes";
import { eveningDate } from "../today/dayParts";
import { useBackOnline } from "../today/useBackOnline";
import Slider from "../ui/Slider";
import "../../styles/honest.css";
import "../../styles/daily.css";

// Before you bank it: how the day felt, any communication with God, and
// when tomorrow starts (Aaron, 2026-11-02).
//
// Mood and stress are one to ten now, each a slider with a line under it
// for what's behind the number. The 1–5 every chart and older reader uses
// keeps being written beside it (half, rounded up: toFive in
// src/lib/checks.js), and a day saved before the change opens where its
// 1–5 sat on the new scale. One note, "Any communication with God today?",
// takes the place of the Prayed tap, the prompting question and the Sabbath
// line: it's his to fill in, a word or a page, and nothing scores it. On
// Sundays the same card has the Fast Sunday tap.
//
// What went: where the stress came from and why the day went off plan
// (nobody was reading them), and the tasks left undone, which moved to
// "What got done" (EveningTasks) beside the tick that says they weren't.
//
// Every answer saves as you go and any can stay blank; banking never waits
// on one you left. How the saves go (useSaves below):
//
// - One at a time, in the order you made them, so a tap made while another
//   is saving is never dropped; it goes out next. A key saved twice before
//   its turn sends only the newer answer.
// - One that fails stays waiting, shows "Not saved, retry", and goes again
//   with the next save, when the phone gets its connection back, on a tap
//   of the retry, or when you bank the day. What you picked stays on the
//   screen the whole time; it's never quietly put back.
// - Tapping what's already chosen leaves it chosen (it retries it if it
//   hadn't saved). An answer changes by picking another, never by a second
//   tap.
// - The notes save a moment after you stop typing, when you leave the box,
//   and once more just before the day is banked (`flushRef`), so a line
//   typed a second before Bank the day is in the summary.
//
// Tomorrow's alarm is written to tomorrow, where the morning check-in picks
// it up, and it's only asked tonight: going back to an earlier day, its
// tomorrow is already over.
//
// The card reads the day as the page loaded it. Switching from the short
// evening, the page reads the day again, and anything you haven't touched
// here takes what the short evening saved.
//
//   dayPlan   the day's day_plans row
//   journal   the day's journal entry (day_archive's journal), for the notes
//   flushRef  set to an async () => void that saves every note still
//             waiting and throws if anything didn't save

const ALARMS = ["04:30", "06:00"];

async function loadEvening(userId, date) {
  const tomorrow = addDays(date, 1);
  const [next, lastAlarm] = await Promise.all([fetchDayPlan(userId, tomorrow), fetchLastAlarm(userId, tomorrow)]);
  return { tomorrow, nextAlarm: next?.alarm_at?.slice(0, 5) ?? null, lastAlarm };
}

export default function EveningCheckin({ userId, date, dayPlan, journal, flushRef }) {
  const { data } = useLoad(() => loadEvening(userId, date), [userId, date]);
  const saves = useSaves();

  const [mood, setMood] = useFollow(tenOf(dayPlan, "mood"));
  const [stress, setStress] = useFollow(tenOf(dayPlan, "stress"));
  const [fast, setFast] = useFollow(dayPlan?.fast_sunday ?? null);
  const moodNote = useNote(saves.save, "moodNote", journal?.mood_note, (t) => saveJournalEntry(userId, date, { moodNote: t }));
  const stressNote = useNote(saves.save, "stressNote", journal?.stress_note, (t) => saveJournalEntry(userId, date, { stressNote: t }));
  const godNote = useNote(saves.save, "godNote", journal?.god_note, (t) => saveJournalEntry(userId, date, { godNote: t }));

  const [alarm, setAlarm] = useState(null);
  const [otherAlarm, setOtherAlarm] = useState(false);
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

  const notes = useRef([]);
  notes.current = [moodNote, stressNote, godNote];
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

  const tonight = date >= eveningDate();
  const sunday = isSunday(date);

  function pickMood(n) {
    if (n === mood && !saves.waiting("mood")) return;
    setMood(n);
    saves.save("mood", () => patchDayPlan(userId, date, { mood_10: n, mood: toFive(n) }));
  }

  function pickStress(n) {
    if (n === stress && !saves.waiting("stress")) return;
    setStress(n);
    saves.save("stress", () => patchDayPlan(userId, date, { stress_10: n, stress: toFive(n) }));
  }

  // A fast Sunday is one tap, and tapping again says it wasn't.
  function toggleFast() {
    const next = !fast;
    setFast(next);
    saves.save("fast", () => patchDayPlan(userId, date, { fast_sunday: next }));
  }

  function pickAlarm(a) {
    if (!data || !a) return;
    if (!otherAlarm && alarm === a && !saves.waiting("alarm")) return;
    setOtherAlarm(false);
    setAlarm(a);
    saves.save("alarm", () => patchDayPlan(userId, data.tomorrow, { alarm_at: a }));
  }

  function setOtherClock(v) {
    if (!data || !v) return;
    setAlarm(v);
    saves.save("alarm", () => patchDayPlan(userId, data.tomorrow, { alarm_at: v }));
  }

  const lightsOut = data && alarm ? lightsOutFor(data.tomorrow, alarm) : null;
  const usual = data ? rememberedAlarm(null, data.lastAlarm) : null;

  return (
    <div className="card evening-checkin">
      <div className="card-head" style={{ marginBottom: 4 }}>
        <span className="card-title">
          <Moon size={14} />
          Before you bank it
        </span>
        <SaveState saves={saves} />
      </div>
      <p className="card-note" style={{ marginBottom: 2 }}>
        A few taps. Each one saves as you go, and any can stay blank.
      </p>

      <div className="evening-feel">
        <Slider label="Mood" value={mood} onChange={pickMood} low="1 low" high="10 good" />
        <NoteInput note={moodNote} placeholder="What's behind it?" label="What's behind the mood?" max={500} />
      </div>

      <div className="evening-feel">
        <Slider label="Stress" value={stress} onChange={pickStress} low="1 calm" high="10 a lot" />
        <NoteInput note={stressNote} placeholder="What's behind it?" label="What's behind the stress?" max={500} />
      </div>

      <div className="evening-god">
        <label className="evening-god__q" htmlFor={`god-note-${date}`}>
          Any communication with God today?
        </label>
        <NoteInput
          id={`god-note-${date}`}
          note={godNote}
          placeholder="A prayer, a prompting, a quiet moment, in your words."
          max={2000}
          multiline
        />
        {sunday && (
          <div className="evening-god__sunday">
            <button type="button" className={"name-chip" + (fast ? " name-chip--on" : "")} aria-pressed={Boolean(fast)} onClick={toggleFast}>
              {fast && <Check size={12} />}
              Fast Sunday
            </button>
          </div>
        )}
      </div>

      {tonight && (
        <>
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
              <button type="button" className="name-chip name-chip--add" onClick={() => setOtherAlarm(true)} disabled={!data}>
                Other
              </button>
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
        </>
      )}
    </div>
  );
}

// "Saving…" while something's on its way; "Not saved, retry" when
// something didn't go through and is still waiting.
export function SaveState({ saves }) {
  if (saves.saving) return <span className="faint evening-checkin__saving">Saving…</span>;
  if (saves.failed) {
    return (
      <button type="button" className="btn-link evening-checkin__retry" onClick={saves.retry}>
        Not saved, retry
      </button>
    );
  }
  return null;
}

// A note's box: one line, or a few for the note to God.
export function NoteInput({ note, placeholder, label, max, multiline = false, id }) {
  const props = {
    id,
    className: "input " + (multiline ? "evening-god__note" : "evening-feel__note"),
    value: note.text,
    onChange: (e) => note.change(e.target.value),
    onBlur: note.saveNow,
    placeholder,
    "aria-label": label,
    maxLength: max,
  };
  return multiline ? <textarea rows={2} {...props} /> : <input {...props} />;
}

// --- How the evening saves --------------------------------------------------

// The evening's saves, one at a time, each answer under a key ("mood",
// "alarm", "godNote"). save(key, run) wants that key saved by `run`; a newer
// save of the same key before its turn replaces it. One that fails stays
// wanted and goes again on the next save, retry(), flush() or when the
// phone comes back online.
//
//   saving   something is on its way
//   failed   how many are waiting after a failure
//   waiting  (key) => whether that key is still to save
//   flush    () => saves everything waiting; throws if anything didn't
//
// save, retry, flush and waiting stay the same function from render to
// render, so they can sit in an effect's dependencies.
export function useSaves() {
  const wanted = useRef(new Map());
  const loop = useRef(null);
  const [status, setStatus] = useState({ saving: false, failed: 0 });

  // Works through what's wanted until nothing is left but what failed this
  // time round. The loop is marked as running before it starts and cleared
  // the moment it finds nothing more to do, so a save that comes in while
  // it runs is always picked up, by this loop or the next.
  const pump = useCallback(() => {
    if (loop.current) return loop.current;
    loop.current = (async () => {
      await null;
      setStatus((s) => (s.saving ? s : { ...s, saving: true }));
      const failed = new Set();
      for (;;) {
        const next = [...wanted.current].find(([key]) => !failed.has(key));
        if (!next) break;
        const [key, job] = next;
        try {
          await job.run();
          if (wanted.current.get(key) === job) wanted.current.delete(key);
        } catch (err) {
          console.warn(err);
          // A newer answer for it came in meanwhile: that one goes next.
          if (wanted.current.get(key) === job) failed.add(key);
        }
      }
      loop.current = null;
      setStatus({ saving: false, failed: failed.size });
      return failed.size === 0;
    })();
    return loop.current;
  }, []);

  const save = useCallback(
    (key, run) => {
      wanted.current.set(key, { run });
      return pump();
    },
    [pump]
  );

  const retry = useCallback(() => pump(), [pump]);

  const flush = useCallback(async () => {
    if (loop.current) await loop.current;
    if (!(await pump())) throw new Error("Something didn't save.");
  }, [pump]);

  const waiting = useCallback((key) => wanted.current.has(key), []);

  useBackOnline(retry, status.failed > 0);

  return { saving: status.saving, failed: status.failed, save, retry, flush, waiting };
}

// A value the card shows, starting from what the page loaded and following
// it when the page reads the day again, until you change it here.
export function useFollow(source) {
  const [value, setValue] = useState(source);
  const touched = useRef(false);
  useEffect(() => {
    if (!touched.current) setValue(source);
  }, [source]);
  const set = useCallback((v) => {
    touched.current = true;
    setValue(v);
  }, []);
  return [value, set];
}

// A note: what's in the box, saved with `save` (useSaves) under `key` a
// moment after you stop typing, when you leave the box (saveNow) and before
// the day is banked. Only a change from what was last sent goes out, and a
// cleared box clears the note, unless `keepBlank`. `write(text)` saves it.
export function useNote(save, key, initial, write, { keepBlank = false } = {}) {
  const [text, setText] = useState(initial ?? "");
  const textRef = useRef(text);
  textRef.current = text;
  // What was last sent, or loaded: a box put back to it needs no save,
  // unless a different one is still waiting.
  const sent = useRef(String(initial ?? "").trim());
  const touched = useRef(false);
  const timer = useRef(null);
  const writeRef = useRef(write);
  writeRef.current = write;

  useEffect(() => {
    if (touched.current) return;
    const v = initial ?? "";
    setText(v);
    sent.current = String(v).trim();
  }, [initial]);

  const saveNow = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = null;
    const t = textRef.current.trim();
    if (t === sent.current) return;
    // The short evening's line never blanks one written earlier.
    if (!t && keepBlank) return;
    sent.current = t;
    const run = writeRef.current;
    save(key, () => run(t));
  }, [save, key, keepBlank]);

  const change = useCallback(
    (v) => {
      touched.current = true;
      setText(v);
      clearTimeout(timer.current);
      timer.current = setTimeout(saveNow, 1500);
    },
    [saveNow]
  );

  // Leaving the evening with a note still typed: it goes now.
  const saveRef = useRef(saveNow);
  saveRef.current = saveNow;
  useEffect(
    () => () => {
      if (timer.current) saveRef.current();
    },
    []
  );

  return { text, change, saveNow };
}

// 8.5 → "8½", 8 → "8".
function fmtHours(h) {
  const whole = Math.floor(h);
  return h - whole === 0.5 ? `${whole}½` : String(h);
}
