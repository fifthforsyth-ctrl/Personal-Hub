import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { fetchFocusLineage, fetchFocusNotes, addFocusNote, deleteFocusNote, fetchTimeEntriesForDate, fetchDayPlan } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { arrowsLabel, cleanNote, newestFirst, noteDay, landsBy, checksFor, checkinOn, checkinLevel, countsToward, towardTitle } from "../../lib/focus";
import { LEVELS } from "../../lib/mark";
import { pathOf } from "../../lib/ladder";
import { parseDateStr } from "../../lib/planDates";
import { haptic } from "../../lib/haptics";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import Sheet from "../ascent/Sheet";
import { GoalArrow } from "./FocusArrows";
import FocusSettings from "./FocusSettings";
import { useAscentView } from "./useFocusWeek";
import "../../styles/focus.css";
import "../../styles/targets.css";

// One focus, opened from its small target on Today.
//
// It answers the two things you'd want with a focus in hand: where today's
// arrow landed, and what have you noticed about it. The week's seven days
// sit at the top so you can see how it's going, and what it counts toward
// under them, a tap from that target's page. Then today's arrow, landed the
// way this focus lands (FocusArrows.jsx): placed where the day landed, or
// by its checks. The evening shows the same arrow, so one placed at noon
// is already there by night. Under that, a box for a note, any time of day:
// what helped, what got in the way, a line from a talk. Notes stay with the
// focus as it's kept from week to week, so the list reaches back through
// the earlier weeks of the same focus (newest first), not just this one.
//
// A note you're halfway through is kept on this phone until you save it, so
// a stray tap outside the sheet doesn't lose it, and it goes with the focus
// when you keep it on Sunday. A note changes nothing else
// on Today, so saving one doesn't make the whole page load again.
//
//   goal       this week's goal, as summarizeWeek gives it (days, counts)
//   fw         useFocusWeek's answer for its week: the arrows, the checks,
//              and the saves for both

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

// A note you delete waits out the few seconds Undo is offered before it's
// really gone. Close the sheet and open it again inside that time and the
// list is read fresh from the database, where the note still is, so it would
// come back. These sets live outside any one sheet for that reason: the
// notes still waiting to go, which a reopened sheet leaves out; the notes
// deleted since the app opened, left out for good, because a list the
// database read a moment before the delete can still arrive after it; and
// the sheets on screen, so Undo puts the note back in the one you're looking
// at even if it isn't the one you deleted it from.
const deleting = new Set();
const gone = new Set();
const onScreen = new Set();

export async function loadNotes(userId, goalId) {
  const chain = await fetchFocusLineage(userId, goalId);
  const notes = await fetchFocusNotes(userId, chain.map((g) => g.id));
  return { chain, notes: newestFirst(notes.filter((n) => !deleting.has(n.id) && !gone.has(n.id))) };
}

// What toast.undoable needs to delete a note once Undo has gone. Only a
// delete that fails, or Undo, lets the note show again; one that went
// through moves it straight across to `gone`, so no load ever finds it
// missing from both.
export function deleteLater(note) {
  deleting.add(note.id);
  return {
    run: async () => {
      try {
        await deleteFocusNote(note.id);
      } catch (err) {
        deleting.delete(note.id);
        throw err;
      }
      gone.add(note.id);
      deleting.delete(note.id);
    },
    onUndo: () => {
      deleting.delete(note.id);
      for (const putBack of onScreen) putBack(note);
    },
  };
}

// A sheet hears about an Undo while it's open. Returns the way to stop.
export function onNoteBack(putBack) {
  onScreen.add(putBack);
  return () => onScreen.delete(putBack);
}

// The notes in a sheet's list with one more: one put back by Undo, or one
// that has just saved. It's left out if it belongs to another focus, and a
// list that already has it (read after it saved) doesn't get it twice.
export function withNote(d, note) {
  if (!d || !d.chain.some((g) => g.id === note.goal_id)) return d;
  return { ...d, notes: newestFirst([...d.notes.filter((n) => n.id !== note.id), note]) };
}

// The half-written note for each focus, kept in localStorage. These take
// `store` only so the tests can hand in a stand-in.
const draftKey = (goalId) => `hub.focus-note-draft.${goalId}`;

// Keeping a focus on Sunday gives it a new row, with a new id, for the new
// week. A note you left half-written on Saturday sits under last week's id,
// so the first time you open the focus in its new week the draft moves
// across instead of being stranded there. A note that's still saving isn't
// a draft any more, so it's left out (see saveNote below).
export function readDraft(goal, store) {
  try {
    const s = store ?? localStorage;
    const own = s.getItem(draftKey(goal.id));
    if (own != null) return isSending(goal.id, own) ? "" : own;
    if (!goal.carried_from) return "";
    const before = s.getItem(draftKey(goal.carried_from));
    if (before != null) {
      s.setItem(draftKey(goal.id), before);
      s.removeItem(draftKey(goal.carried_from));
    }
    return before ?? "";
  } catch {
    return "";
  }
}

export function keepDraft(goalId, text, store) {
  try {
    const s = store ?? localStorage;
    if (text.trim()) s.setItem(draftKey(goalId), text);
    else s.removeItem(draftKey(goalId));
  } catch {
    // Private mode or storage off: the draft just isn't kept.
  }
}

// Once a note has saved, its kept copy goes, but only if it's still the text
// that was sent. This clears the phone's copy directly rather than by
// emptying the box, because you may have closed the sheet while it saved,
// and anything you typed after tapping Save is yours to keep.
export function dropSavedDraft(goalId, sent, store) {
  try {
    const s = store ?? localStorage;
    if (s.getItem(draftKey(goalId)) === sent) s.removeItem(draftKey(goalId));
  } catch {
    // Nothing was kept, so there's nothing to clear.
  }
}

// A note on its way to the database. The phone's copy of the box only goes
// once it has saved, so close the sheet while it saves, open it again before
// it lands, and the box would fill with the note you just sent, Save lit, and
// a second tap would save it twice. So the notes on their way are kept here,
// by focus: a sheet opened meanwhile leaves that text out of its box, and
// every sheet on screen hears when it lands, to empty a box still holding it
// and add the note to its list.
const sending = new Map(); // goal id -> the texts on their way
const onLanding = new Set();

function isSending(goalId, text) {
  return sending.get(goalId)?.includes(text) ?? false;
}

// Saves `sent`, the box as it was when you tapped Save. If it doesn't save,
// it's a draft again, even if a sheet opened meanwhile has emptied the box;
// anything typed there since is kept instead.
export async function saveNote(userId, { goalId, date, sent }, store) {
  sending.set(goalId, [...(sending.get(goalId) ?? []), sent]);
  let row = null;
  let failed = null;
  try {
    row = await addFocusNote(userId, { goalId, date, text: cleanNote(sent) });
  } catch (err) {
    failed = err ?? new Error("Couldn't save that note.");
  }
  const left = [...sending.get(goalId)];
  left.splice(left.indexOf(sent), 1);
  if (left.length) sending.set(goalId, left);
  else sending.delete(goalId);
  if (failed) {
    keepDraft(goalId, withUnsent(readDraft({ id: goalId }, store), sent), store);
  } else {
    dropSavedDraft(goalId, sent, store);
  }
  for (const heard of onLanding) heard({ goalId, sent, row });
  if (failed) throw failed;
  return row;
}

// A sheet hears when a note lands (`row`) or doesn't (`row` null) while it's
// open. Returns the way to stop.
export function onNoteLanded(heard) {
  onLanding.add(heard);
  return () => onLanding.delete(heard);
}

// What's in the box once a note has landed: empty if it still holds just
// what was sent, so anything typed since stays; and if it didn't save, the
// note comes back into a box that's been left empty.
export function draftAfterSave(cur, sent, saved) {
  if (saved) return cur === sent ? "" : cur;
  return withUnsent(cur, sent);
}

// A note that didn't save is never thrown away: it goes back in the box,
// above anything typed since, unless the box already holds it.
export function withUnsent(cur, sent) {
  const now = cur ?? "";
  if (!now.trim()) return sent;
  return now.includes(sent) ? now : `${sent}\n\n${now}`;
}

// What the day holds for checks it can answer: the time log, and when you
// got up.
async function loadDay(userId, date) {
  const [entries, dayPlan] = await Promise.all([fetchTimeEntriesForDate(userId, date), fetchDayPlan(userId, date)]);
  return { entries, dayPlan };
}

export default function FocusSheet({ userId, goal, date, fw, onClose }) {
  const toast = useToast();
  const boxId = useId();
  const notes = useLoad(() => (userId ? loadNotes(userId, goal.id) : null), [userId, goal.id]);
  const [draft, setDraft] = useState(() => readDraft(goal));
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(false);

  // Today, as far as this focus's checks can read it, and the Ascent view
  // for what it counts toward and the checks the time log answers. Each is
  // read only when this focus needs it.
  const byChecks = landsBy(goal) === "checks";
  const checks = checksFor(goal.id, fw.checks);
  const needsDay = byChecks && checks.some((c) => c.auto === "wake" || c.focus_id);
  const day = useLoad(() => (userId && needsDay ? loadDay(userId, date) : null), [userId, date, needsDay]);
  const ascent = useAscentView(userId, date, Boolean(countsToward(goal)) || (byChecks && checks.some((c) => c.focus_id)));
  // What it counts toward, by name once the names are in: a link to that
  // target's page. (A goal further down the wheel opens the lifetime goal
  // it sits under.)
  const toward = countsToward(goal);
  const towardName = toward ? towardTitle(goal, ascent.view, ascent.data) : null;

  useEffect(() => keepDraft(goal.id, draft), [goal.id, draft]);

  // A note put back by Undo, or one that lands while this sheet is open,
  // whichever sheet sent it: this one, or the one you closed before it saved.
  // With no list on screen yet, it's read again instead, now that the note is in.
  const { mutate, reload } = notes;
  const shown = useRef(notes.data);
  shown.current = notes.data;
  useEffect(() => {
    const putBack = (note) => mutate((d) => withNote(d, note));
    const stopBack = onNoteBack(putBack);
    const stopLanded = onNoteLanded(({ goalId, sent, row }) => {
      if (goalId !== goal.id) return;
      setDraft((cur) => draftAfterSave(cur, sent, Boolean(row)));
      if (!row) return;
      if (shown.current) putBack(row);
      else reload();
    });
    return () => {
      stopBack();
      stopLanded();
    };
  }, [mutate, reload, goal.id]);

  const titleOf = new Map((notes.data?.chain ?? []).map((g) => [g.id, g.title]));
  const canSave = Boolean(cleanNote(draft)) && !saving;

  async function save(e) {
    e?.preventDefault();
    if (!cleanNote(draft) || saving) return;
    setSaving(true);
    try {
      await saveNote(userId, { goalId: goal.id, date, sent: draft });
      haptic("success");
    } catch (err) {
      toast.error(err, "Couldn't save that note.");
    } finally {
      setSaving(false);
    }
  }

  function remove(note) {
    notes.mutate((d) => (d ? { ...d, notes: d.notes.filter((n) => n.id !== note.id) } : d));
    toast.undoable({ message: "Note deleted", ...deleteLater(note) });
  }

  return (
    <>
      <Sheet title={goal.title} onClose={onClose}>
        <div className="focus-sheet">
          <section className="focus-sheet__block" aria-label="This week">
            <div className="focus-sheet__week">
              <span className="focus-dots" role="img" aria-label={arrowsLabel(goal)}>
                {goal.days.map((d, i) => {
                  // On the face or out in the miss band; the title names the ring.
                  const c = checkinOn(fw.data?.checkins, goal.id, d.date);
                  const ring = c ? LEVELS[checkinLevel(c)].name : "no arrow";
                  return (
                    <span
                      key={d.date}
                      className={"focus-dots__day" + (d.moved === true ? " is-yes" : d.moved === false ? " is-no" : "") + (d.date === date ? " is-today" : "")}
                      title={`${parseDateStr(d.date).toLocaleDateString(undefined, { weekday: "long" })}: ${ring}`}
                    >
                      {DOW[i]}
                    </span>
                  );
                })}
              </span>
              <span className="focus-sheet__count">{arrowsLabel(goal)}</span>
            </div>

            {towardName && (
              <Link to={pathOf(toward.kind, toward.id)} className="ladder-toward" onClick={onClose}>
                <span className="truncate">Counts toward {towardName}</span>
                <ArrowRight size={13} aria-hidden="true" />
              </Link>
            )}

            <div className="focus-sheet__arrow ladder-arrow">
              <span className="eyebrow">Today's arrow</span>
              <GoalArrow
                key={`${goal.id}:${landsBy(goal)}:${date}`}
                goal={goal}
                date={date}
                fw={fw}
                entries={day.data?.entries}
                dayPlan={day.data?.dayPlan}
                focusesById={ascent.focusesById}
                // Said once, above, as the link to its page.
                toward={null}
                onSettings={() => setSettings(true)}
                showTitle={false}
              />
            </div>
          </section>

          <section className="focus-sheet__block" aria-label="Notes">
            <form onSubmit={save}>
              <div className="focus-sheet__add">
                <label className="eyebrow" htmlFor={boxId}>
                  Notes
                </label>
                <textarea
                  id={boxId}
                  className="textarea"
                  rows={3}
                  maxLength={2000}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(e);
                  }}
                  placeholder="What helped, what got in the way, anything you noticed"
                />
                <div className="focus-sheet__save">
                  <button type="submit" className="btn btn--accent btn--sm" disabled={!canSave}>
                    {saving ? "Saving…" : "Save note"}
                  </button>
                </div>
              </div>
            </form>

            {notes.error && <LoadError what="the notes" error={notes.error} onRetry={notes.reload} stale={Boolean(notes.data)} />}

            {notes.data && notes.data.notes.length === 0 && <p className="focus-sheet__none">No notes yet.</p>}

            {notes.data && notes.data.notes.length > 0 && (
              <ul className="focus-sheet__notes">
                {notes.data.notes.map((n) => {
                  const day = noteDay(n.date, date);
                  const then = n.goal_id !== goal.id ? titleOf.get(n.goal_id) : null;
                  return (
                    <li key={n.id} className="focus-sheet__note">
                      <div className="focus-sheet__note-head">
                        <span className="focus-sheet__when">
                          {day}
                          {then && then !== goal.title && <span className="focus-sheet__then"> · as “{then}”</span>}
                        </span>
                        <button type="button" className="btn-icon focus-sheet__del" aria-label={`Delete the note from ${day}`} title="Delete" onClick={() => remove(n)}>
                          <X size={15} />
                        </button>
                      </div>
                      <p className="focus-sheet__text">{n.text}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <Link to="/targets?focus=edit" className="btn-link focus-sheet__edit">
            Edit this week's focus
            <ArrowRight size={13} />
          </Link>
        </div>
      </Sheet>
      {settings && <FocusSettings userId={userId} goal={goal} date={date} fw={fw} ascent={ascent} onClose={() => setSettings(false)} />}
    </>
  );
}
