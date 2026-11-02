import { useEffect, useId, useState } from "react";
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
// come back. These two sets live outside any one sheet for that reason: the
// notes still waiting to go, which a reopened sheet leaves out, and the
// sheets on screen, so Undo puts the note back in the one you're looking at
// even if it isn't the one you deleted it from.
const deleting = new Set();
const onScreen = new Set();

export async function loadNotes(userId, goalId) {
  const chain = await fetchFocusLineage(userId, goalId);
  const notes = await fetchFocusNotes(userId, chain.map((g) => g.id));
  return { chain, notes: newestFirst(notes.filter((n) => !deleting.has(n.id))) };
}

// What toast.undoable needs to delete a note once Undo has gone.
export function deleteLater(note) {
  deleting.add(note.id);
  return {
    run: async () => {
      try {
        await deleteFocusNote(note.id);
      } finally {
        deleting.delete(note.id);
      }
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

// The half-written note for each focus, kept in localStorage. These take
// `store` only so the tests can hand in a stand-in.
const draftKey = (goalId) => `hub.focus-note-draft.${goalId}`;

// Keeping a focus on Sunday gives it a new row, with a new id, for the new
// week. A note you left half-written on Saturday sits under last week's id,
// so the first time you open the focus in its new week the draft moves
// across instead of being stranded there.
export function readDraft(goal, store) {
  try {
    const s = store ?? localStorage;
    const own = s.getItem(draftKey(goal.id));
    if (own != null || !goal.carried_from) return own ?? "";
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

export default function FocusSheet({ userId, goal, date, onCheckin, onClose }) {
  const toast = useToast();
  const boxId = useId();
  const notes = useLoad(() => (userId ? loadNotes(userId, goal.id) : null), [userId, goal.id]);
  const [draft, setDraft] = useState(() => readDraft(goal));
  const [saving, setSaving] = useState(false);

  useEffect(() => keepDraft(goal.id, draft), [goal.id, draft]);

  const { mutate } = notes;
  useEffect(
    () =>
      onNoteBack((note) =>
        mutate((d) =>
          d && d.chain.some((g) => g.id === note.goal_id) ? { ...d, notes: newestFirst([...d.notes.filter((n) => n.id !== note.id), note]) } : d
        )
      ),
    [mutate]
  );

  const today = goal.days.find((d) => d.date === date)?.moved ?? null;
  const titleOf = new Map((notes.data?.chain ?? []).map((g) => [g.id, g.title]));
  const canSave = Boolean(cleanNote(draft)) && !saving;

  async function save(e) {
    e?.preventDefault();
    const text = cleanNote(draft);
    if (!text || saving) return;
    const sent = draft;
    setSaving(true);
    try {
      const row = await addFocusNote(userId, { goalId: goal.id, date, text });
      dropSavedDraft(goal.id, sent);
      if (notes.data) notes.mutate((d) => (d ? { ...d, notes: newestFirst([row, ...d.notes]) } : d));
      else notes.reload();
      setDraft((cur) => (cur === sent ? "" : cur));
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
