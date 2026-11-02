import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { fetchFocusLineage, fetchFocusNotes, addFocusNote, deleteFocusNote } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { movedLabel, cleanNote, newestFirst, noteDay } from "../../lib/focus";
import { parseDateStr } from "../../lib/planDates";
import { haptic } from "../../lib/haptics";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import Sheet from "../ascent/Sheet";
import "../../styles/focus.css";

// One focus, opened from its small target on Today.
//
// It answers the two things you'd want with a focus in hand: did today move
// it, and what have you noticed about it. The week's seven days sit at the
// top so you can see how it's going before you answer. Under that, a box for
// a note, any time of day: what helped, what got in the way, a line from a
// talk. Notes stay with the focus as it's kept from week to week, so the
// list reaches back through the earlier weeks of the same focus (newest
// first), not just this one.
//
// A note you're halfway through is kept on this phone until you save it, so
// a stray tap outside the sheet doesn't lose it, and it goes with the focus
// when you keep it on Sunday. A note changes nothing else
// on Today, so saving one doesn't make the whole page load again.
//
//   goal       this week's goal, as summarizeWeek gives it (days, counts)
//   onCheckin  useFocusWeek's checkin(goalId, date, true | false | null)

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
    if (!readDraft({ id: goalId }, store)) keepDraft(goalId, sent, store);
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
  return cur.trim() ? cur : sent;
}

export default function FocusSheet({ userId, goal, date, onCheckin, onClose }) {
  const toast = useToast();
  const boxId = useId();
  const notes = useLoad(() => (userId ? loadNotes(userId, goal.id) : null), [userId, goal.id]);
  const [draft, setDraft] = useState(() => readDraft(goal));
  const [saving, setSaving] = useState(false);

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

  const today = goal.days.find((d) => d.date === date)?.moved ?? null;
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
    <Sheet title={goal.title} onClose={onClose}>
      <div className="focus-sheet">
        <section className="focus-sheet__block" aria-label="This week">
          <div className="focus-sheet__week">
            <span className="focus-dots" role="img" aria-label={movedLabel(goal)}>
              {goal.days.map((d, i) => (
                <span
                  key={d.date}
                  className={"focus-dots__day" + (d.moved === true ? " is-yes" : d.moved === false ? " is-no" : "") + (d.date === date ? " is-today" : "")}
                  title={`${parseDateStr(d.date).toLocaleDateString(undefined, { weekday: "long" })}: ${d.moved === true ? "moved it" : d.moved === false ? "not that day" : "no answer"}`}
                >
                  {DOW[i]}
                </span>
              ))}
            </span>
            <span className="focus-sheet__count">{movedLabel(goal)}</span>
          </div>

          <div className="seg seg--block focus-sheet__answer" role="group" aria-label="Did today move it?">
            <button
              type="button"
              className={"seg-btn" + (today === true ? " active" : "")}
              aria-pressed={today === true}
              onClick={() => onCheckin(goal.id, date, today === true ? null : true)}
            >
              Moved it today
            </button>
            <button
              type="button"
              className={"seg-btn" + (today === false ? " active" : "")}
              aria-pressed={today === false}
              onClick={() => onCheckin(goal.id, date, today === false ? null : false)}
            >
              Not today
            </button>
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

        <Link to="/plan" className="btn-link focus-sheet__edit">
          Edit this week's focus
          <ArrowRight size={13} />
        </Link>
      </div>
    </Sheet>
  );
}
