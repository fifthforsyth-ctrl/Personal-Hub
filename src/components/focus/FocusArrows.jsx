import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Target, ArrowRight, SlidersHorizontal, CornerDownRight, Undo2, Plus } from "lucide-react";
import {
  focusWeekOf,
  orderGoals,
  landsBy,
  checkinOn,
  checkinShot,
  checkinLevel,
  weekShots,
  checksFor,
  placedArrow,
  countsToward,
  focusAnswers,
  landedArrow,
  arrowKey,
  sameArrow,
  towardTitle,
} from "../../lib/focus";
import { LEVELS, focusMinutes } from "../../lib/mark";
import { autoValue, scores, clockText, valueText } from "../../lib/checks";
import { haptic } from "../../lib/haptics";
import LoadError from "../ui/LoadError";
import CheckRow from "../checks/CheckRow";
import PlaceFace from "../checks/PlaceFace";
import TargetFace from "../mark/TargetFace";
import { useFocusWeek, useAscentView } from "./useFocusWeek";
import FocusSettings from "./FocusSettings";
import "../../styles/mark.css";
import "../../styles/checks.css";
import "../../styles/focus.css";

// This week's focus, in the evening: one arrow per focus for the day.
//
// Each focus lands its arrow the way you chose for it. One you judge
// yourself ("Win by win") is a small target you tap where the day landed,
// with this week's earlier arrows faint on it and a line for what put it
// there. One its own checks can answer ("Up by 4:35") asks them, the way a
// target on the Mark does, and the share passed puts the arrow in its ring;
// the ones the day already answered (when you got up, the time log) are
// filled in, so a morning that went to plan needs nothing from you.
//
// A focus that counts toward a lifetime goal, quest or lesson says so, and
// its arrow tonight counts as one more check in that target's shot.
//
//   userId, date   whose evening, and which day
//   entries        the day's time entries (day_archive's time_entries), for
//                  checks the time log answers
//   dayPlan        the day's plan row, for "Up by" (woke_at)
//   quick          the short evening's version: smaller faces, no notes
//   flushRef       set to an async () => void that saves anything still
//                  waiting (a note typed a moment ago) before the day is
//                  banked

export default function FocusArrows({ userId, date, entries, dayPlan, quick = false, flushRef }) {
  const weekStart = focusWeekOf(date);
  const fw = useFocusWeek(userId, weekStart);
  const { data, error, loading, reload, settled } = fw;
  const goals = useMemo(() => orderGoals(data?.goals), [data]);
  // The Ascent view only when something needs it: a name for what a focus
  // counts toward, or a check the time log answers.
  const needsAscent = Boolean(data) && (goals.some((g) => countsToward(g)) || fw.checks.some((c) => c.focus_id && !c.retired_on));
  const ascent = useAscentView(userId, date, needsAscent);
  const [settingsFor, setSettingsFor] = useState(null);

  // Each focus's waiting save, said before the day is banked.
  const flushers = useRef(new Set());
  useEffect(() => {
    if (!flushRef) return;
    flushRef.current = async () => {
      for (const flush of [...flushers.current]) flush();
      await settled();
    };
    return () => {
      flushRef.current = null;
    };
  }, [flushRef, settled]);

  // Nothing while the week first loads, so the evening doesn't jump.
  if (!data) {
    if (loading || !error) return null;
    return (
      <div className="card focus-arrows">
        <LoadError what="this week's focus" error={error} onRetry={reload} />
      </div>
    );
  }

  const settingsGoal = settingsFor ? goals.find((g) => g.id === settingsFor) ?? null : null;

  return (
    <div className={"card focus-arrows" + (quick ? " focus-arrows--quick" : "")}>
      <div className="card-head focus-arrows__head">
        <span className="card-title">
          <Target size={14} />
          This week's focus
        </span>
        {goals.length > 0 && !quick && (
          <Link to="/plan" className="btn-link focus-arrows__edit">
            Edit
          </Link>
        )}
      </div>

      {error && <LoadError what="this week's focus" error={error} onRetry={reload} stale />}

      {goals.length === 0 ? (
        <div className="focus-arrows__empty">
          <p className="card-note">No focus set for this week yet.</p>
          <Link to="/plan" className="btn-link btn-link--accent focus-arrows__set">
            Set them on Week
            <ArrowRight size={13} />
          </Link>
        </div>
      ) : (
        <>
          <p className="card-note focus-arrows__lede">Put the arrow where today landed, or let its checks land it.</p>
          <div className="focus-arrows__list">
            {goals.map((g) => (
              <GoalArrow
                key={`${g.id}:${landsBy(g)}:${date}`}
                goal={g}
                date={date}
                fw={fw}
                entries={entries}
                dayPlan={dayPlan}
                focusesById={ascent.focusesById}
                toward={towardLabel(g, ascent)}
                quick={quick}
                onSettings={quick ? null : () => setSettingsFor(g.id)}
                flushers={flushers.current}
              />
            ))}
          </div>
        </>
      )}

      {settingsGoal && <FocusSettings userId={userId} goal={settingsGoal} date={date} fw={fw} ascent={ascent} onClose={() => setSettingsFor(null)} />}
    </div>
  );
}

// What a focus's chip says it counts toward: the target's name once the
// Ascent view is in, a plain word for the kind until then, nothing when it
// stands alone. A focus linked on Week to a goal further down the wheel has
// no target on the Mark to count toward, so once the names are in and it
// isn't among them, there's no chip.
export function towardLabel(goal, ascent) {
  const to = countsToward(goal);
  if (!to) return null;
  const name = towardTitle(goal, ascent?.view, ascent?.data);
  if (name) return name;
  if (ascent?.data) return null;
  return to.kind === "quest" ? "a quest" : to.kind === "lesson" ? "a lesson" : "a lifetime goal";
}

// A note waits this long after you stop typing before it saves; an answer
// to a check, a moment less. Bank the day, or close the sheet, and it saves
// at once.
const NOTE_MS = 700;
const CHECKS_MS = 450;

// One focus's arrow for the day, placed or landed by its checks. The
// evening card has one per focus, and a focus's sheet on Today has its own.
//
//   goal         this week's goal row
//   fw           useFocusWeek's answer for the goal's week (data, checks, arrow)
//   entries, dayPlan, focusesById
//                what the day holds, for the checks it can answer
//   toward       the name of what it counts toward, or null
//   quick        the short evening's: a smaller face, no lines or note
//   onSettings   opens its settings; leave it out and there's no button
//   flushers     a Set this adds its "save what's waiting" to
//   showTitle    false where the title is already above it (the sheet)
export function GoalArrow({ goal, date, fw, entries, dayPlan, focusesById, toward, quick = false, onSettings, flushers, showTitle = true }) {
  const mode = landsBy(goal);
  const checkins = fw.data?.checkins;
  const row = checkinOn(checkins, goal.id, date);
  const checks = useMemo(() => checksFor(goal.id, fw.checks), [goal.id, fw.checks]);
  const earlier = useMemo(
    () => (weekShots([goal], checkins, focusWeekOf(date))[goal.id] ?? []).filter((s) => s.date !== date),
    [goal, checkins, date]
  );

  const [note, setNote] = useState(() => row?.note ?? "");
  // Answers you gave yourself tonight, by check id: { value, line }.
  const [mine, setMine] = useState({});

  const auto = useMemo(() => checks.map((c) => autoValue(c, { focusesById, entries, dayPlan, focusMinutes })), [checks, focusesById, entries, dayPlan]);
  const answers = mode === "checks" ? focusAnswers(checks, row, { auto, mine }) : [];
  const ready = mode === "checks" ? landedArrow(checks, answers, note) : null;
  const readyKey = arrowKey(ready);

  // What a save run later reads: always the latest, never what it was when
  // the save was put off.
  const rowRef = useRef(row);
  rowRef.current = row;
  const noteRef = useRef(note);
  noteRef.current = note;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const arrowRef = useRef(fw.arrow);
  arrowRef.current = fw.arrow;
  const waiting = useRef(null); // { timer, run }

  const cancel = useCallback(() => {
    if (waiting.current) clearTimeout(waiting.current.timer);
    waiting.current = null;
  }, []);

  const later = useCallback(
    (run, ms) => {
      cancel();
      const job = { run, timer: null };
      job.timer = setTimeout(() => {
        if (waiting.current === job) waiting.current = null;
        run();
      }, ms);
      waiting.current = job;
    },
    [cancel]
  );

  const flush = useCallback(() => {
    const job = waiting.current;
    if (!job) return;
    clearTimeout(job.timer);
    waiting.current = null;
    job.run();
  }, []);

  // Bank the day, or close the sheet, and what's waiting saves now.
  useEffect(() => {
    if (!flushers) return;
    flushers.add(flush);
    return () => flushers.delete(flush);
  }, [flushers, flush]);
  useEffect(() => () => flush(), [flush]);

  // --- Placed ---------------------------------------------------------------

  const shot = row ? checkinShot(goal.id, date, row) : null;
  const spot = shot ? { x: shot.x, y: shot.y } : null;

  function place({ x, y }) {
    cancel();
    haptic("tap");
    fw.arrow(goal.id, date, placedArrow({ x, y }, noteRef.current));
  }

  // The note goes with the arrow, so it waits for one: typed before you've
  // placed it, it's saved with the placing.
  function saveNote() {
    const r = rowRef.current;
    if (!r) return;
    const at = checkinShot(goal.id, date, r);
    const next = placedArrow({ x: at.x, y: at.y }, noteRef.current);
    if (!sameArrow(r, next)) arrowRef.current(goal.id, date, next);
  }

  function takeBack() {
    cancel();
    fw.arrow(goal.id, date, null);
  }

  // --- Landed by its checks ---------------------------------------------------

  function saveChecks() {
    const next = readyRef.current;
    if (next && !sameArrow(rowRef.current, next)) arrowRef.current(goal.id, date, next);
  }

  // Saved whenever it's ready and differs from what's saved: an answer, the
  // time log catching up, a note. When an answer is cleared it isn't ready,
  // and the last arrow it landed stays put until it is again.
  useEffect(() => {
    if (mode !== "checks" || !readyKey) return;
    if (sameArrow(rowRef.current, readyRef.current)) return;
    later(saveChecks, CHECKS_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, readyKey, later]);

  // A line added to an answer the day filled in leaves the answer the day's,
  // so it keeps up with the time log.
  function answer(c, patch) {
    setMine((m) => ({ ...m, [c.id]: { ...m[c.id], ...patch } }));
  }

  function typeNote(text) {
    setNote(text);
    noteRef.current = text;
    if (mode === "placed" && rowRef.current) later(saveNote, NOTE_MS);
  }

  const noteBox = !quick && (
    <input
      className="input focus-arrow__note"
      value={note}
      onChange={(e) => typeNote(e.target.value)}
      onBlur={flush}
      maxLength={1000}
      placeholder="What landed it there?"
      aria-label={`What landed “${goal.title}” there?`}
    />
  );

  return (
    <section className={"focus-arrow" + (quick ? " focus-arrow--quick" : "")} aria-label={goal.title}>
      {(showTitle || toward || onSettings) && (
        <div className="focus-arrow__head">
          <div className="focus-arrow__name">
            {showTitle && <span className="focus-arrow__title">{goal.title}</span>}
            {toward && (
              <span className="chip focus-arrow__toward" title={`Its arrow counts toward ${toward}`}>
                <CornerDownRight size={11} aria-hidden="true" />
                <span className="truncate">Counts toward {toward}</span>
              </span>
            )}
          </div>
          {onSettings && (
            <button type="button" className="btn-icon focus-arrow__gear" onClick={onSettings} aria-label={`How “${goal.title}” lands, and what it counts toward`} title="How it lands">
              <SlidersHorizontal size={15} />
            </button>
          )}
        </div>
      )}

      {mode === "placed" ? (
        <div className="focus-arrow__place">
          <PlaceFace spot={spot} onPlace={place} marks={earlier} compact={quick} label={goal.title} />
          {noteBox}
          {spot && (
            <button type="button" className="btn-link focus-arrow__back" onClick={takeBack}>
              <Undo2 size={12} />
              Take tonight's arrow back
            </button>
          )}
        </div>
      ) : checks.length === 0 ? (
        <div className="focus-arrow__none">
          <p className="card-note">{onSettings ? "Its checks land it, but it doesn't have any yet." : "Its checks land it, but it doesn't have any yet. Add them from this focus on Today."}</p>
          {onSettings && (
            <button type="button" className="btn btn--sm btn--on-page" onClick={onSettings}>
              <Plus size={14} />
              Add its checks
            </button>
          )}
        </div>
      ) : (
        <div className="focus-arrow__checks">
          <div className="ck-list">
            {checks.map((c, i) => (
              <CheckRow
                key={c.id}
                check={c}
                value={answers[i].value}
                line={answers[i].line}
                onValue={(v) => answer(c, { value: v })}
                onLine={quick ? undefined : (l) => answer(c, { line: l })}
                hint={hintFor(c, auto[i])}
              />
            ))}
          </div>
          <Lands goal={goal} date={date} earlier={earlier} ready={ready} row={row} scored={checks.some(scores)} quick={quick} />
          {noteBox}
        </div>
      )}
    </section>
  );
}

// The ring a focus's checks put its arrow in, on its small target with the
// week's other arrows. Tonight's shows as it's answered, before it saves.
function Lands({ goal, date, earlier, ready, row, scored, quick }) {
  const tonight = ready ?? row;
  const shots = tonight ? [...earlier, checkinShot(goal.id, date, tonight)] : earlier;
  const level = tonight ? checkinLevel(tonight) : null;
  let words;
  if (!scored) words = "None of its checks is scored, so there's nothing for the arrow to land by.";
  else if (ready) words = ringWords(ready.level);
  else if (row) words = "Not every check is answered yet, so its arrow stays where it last landed.";
  else words = "Answer its checks and the arrow lands itself.";
  return (
    <div className={"mark focus-arrow__lands" + (!ready && row ? " is-incomplete" : "")} aria-live="polite">
      <span className="focus-arrow__face">
        <TargetFace
          target={{ shots, reasons: [] }}
          today={date}
          range="7"
          mini
          arrow
          label={level != null ? `Tonight's arrow: ${LEVELS[level].name}` : "No arrow yet tonight"}
        />
      </span>
      <span className={"focus-arrow__ring" + (quick ? " focus-arrow__ring--quick" : "")}>{words}</span>
    </div>
  );
}

function ringWords(level) {
  if (level === 0) return "A bullseye. Every check passed.";
  if (level === 5) return "A miss. None of its checks passed today.";
  return `In the ${LEVELS[level].name.toLowerCase()} ring.`;
}

// Where an answer the day filled in came from, under the question.
function hintFor(check, value) {
  if (value == null) return null;
  if (check.auto === "wake") return `Up at ${clockText(value)}`;
  if (check.focus_id) return check.kind === "minutes" ? `Time log · ${valueText(check, value)}` : "The time log saw it";
  return null;
}
