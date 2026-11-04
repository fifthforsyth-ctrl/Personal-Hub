import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { addTargetNote, deleteTargetNote, fetchTargetNotes, restoreTargetNote, updateFocusNote, updateTargetNote } from "../../lib/api";
import { cleanTargetNote, eveningLines, noteDraftKey, notesTimeline, refOf } from "../../lib/ladder";
import { cleanNote } from "../../lib/focus";
import { useLoad } from "../../lib/useLoad";
import { haptic } from "../../lib/haptics";
import { announceChange } from "../today/announce";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import { deleteLater, loadNotes, onNoteBack, saveNote, withNote } from "../focus/FocusSheet";
import NoteSheet, { noteLimit } from "./NoteSheet";

// "Notes and reflections" on a target: everything written about it, newest
// first, a day at a time. His own notes and reflections (a reflection with
// the question it answered over it), a focus's notes from Today, and what
// the evening said about it (with the ring it landed in, and on a miss what
// got in the way), which is read only and says so.
//
// His own can be changed where they stand (a tap opens the words to edit)
// or deleted, with Undo. The sheet for writing a new one (NoteSheet) opens
// from here, or from the page's Reflect and Note buttons (`sheet`).
//
//   target    { kind, id, key } as resolveRef gives it
//   name      its short name, for the sheet's title
//   focusGoal the focus_goals row, on a focus's page
//   lineage   ids whose notes are this target's too: a focus's earlier
//             weeks, or the goals under a lifetime goal (new ones are
//             still written on the target itself)
//   shots     the target's loosed shots, for the evening's lines
//   reasons   the target's miss reasons, which the evening's lines name
//   onOpenDay(shotId) opens that evening's day in the target's history
//             (an evening's line is a tap away from its day, as on the Range)
//   limit     how many show before "Show N older"
//   sheet     "reflect", "note" or null; onSheet opens or closes it

const NONE = [];
const tmpId = () => `tmp:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;

export default function NotesSection({ userId, today, target, name, focusGoal = null, lineage = null, shots = null, reasons = null, onOpenDay = null, limit = 10, sheet = null, onSheet }) {
  const toast = useToast();
  const isFocus = target.kind === "focus";
  const ref = useMemo(() => refOf(target), [target]);
  const refKey = JSON.stringify(ref);
  const lineageKey = (lineage ?? []).join(",");

  const notes = useLoad(
    () => (userId && ref ? fetchTargetNotes(userId, ref, { lineage: isFocus || target.kind === "goal" ? lineage ?? [] : undefined }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, refKey, lineageKey]
  );
  // A focus's own notes, the ones Today's focus sheet keeps, through the
  // weeks it was carried from (and leaving out one waiting out its Undo).
  const focusNotes = useLoad(() => (userId && isFocus ? loadNotes(userId, target.id) : null), [userId, isFocus, target.id]);

  // Saving now: shown at once, in their place, until the saved row is in.
  const [pending, setPending] = useState([]);
  const [all, setAll] = useState(false);
  const [editing, setEditing] = useState(null); // { id, text, orig, busy }
  const editBox = useRef(null);
  const sheetOpen = useRef(sheet);
  sheetOpen.current = sheet;

  // A focus note put back by Undo (here or on Today's sheet) comes back here.
  const { mutate: mutateFocus } = focusNotes;
  useEffect(() => onNoteBack((note) => mutateFocus((d) => withNote(d, note))), [mutateFocus]);

  const own = notes.data ?? NONE;
  const groups = useMemo(
    () =>
      notesTimeline(
        {
          notes: [...pending.filter((p) => !p.goal_id), ...own],
          focusNotes: [...pending.filter((p) => p.goal_id), ...(focusNotes.data?.notes ?? [])],
          evening: eveningLines(shots ?? [], reasons ?? []),
        },
        today
      ),
    [pending, own, focusNotes.data, shots, reasons, today]
  );
  const count = groups.reduce((n, g) => n + g.items.length, 0);

  // The first `limit` items, whole days at a time where they fit.
  let left = all ? Infinity : limit;
  const shown = [];
  for (const g of groups) {
    if (left <= 0) break;
    const items = g.items.slice(0, left);
    left -= items.length;
    shown.push({ ...g, items });
  }
  const hidden = count - shown.reduce((n, g) => n + g.items.length, 0);

  const rowOf = (item) => (item.source === "focus" ? (focusNotes.data?.notes ?? []).find((n) => n.id === item.id) : own.find((n) => n.id === item.id));

  // --- Writing a new one ----------------------------------------------------

  async function saveNew(mode, { text, prompt }) {
    const now = new Date().toISOString();
    if (isFocus && mode === "note") {
      const temp = { id: tmpId(), goal_id: target.id, date: today, text: cleanNote(text), created_at: now };
      setPending((p) => [temp, ...p]);
      try {
        const row = await saveNote(userId, { goalId: target.id, date: today, sent: text });
        if (focusNotes.data) mutateFocus((d) => withNote(d, row));
        else focusNotes.reload();
        haptic("success");
        announceChange();
        return row;
      } catch (err) {
        lost(err);
        throw err;
      } finally {
        setPending((p) => p.filter((x) => x.id !== temp.id));
      }
    }
    const kind = mode === "reflect" ? "reflection" : "note";
    const temp = { id: tmpId(), kind, prompt: kind === "reflection" ? prompt : null, date: today, text: cleanTargetNote(text), created_at: now };
    setPending((p) => [temp, ...p]);
    try {
      const row = await addTargetNote(userId, ref, { kind, prompt, date: today, text });
      notes.mutate((list) => [row, ...(list ?? []).filter((n) => n.id !== row.id)]);
      haptic("success");
      announceChange();
      return row;
    } catch (err) {
      lost(err);
      throw err;
    } finally {
      setPending((p) => p.filter((x) => x.id !== temp.id));
    }
  }

  // The sheet says so itself when it's still open; closed while it saved,
  // the words wait in its draft, and a toast says what happened.
  function lost(err) {
    if (!sheetOpen.current) toast.error(err, "Couldn't save that. Your words are kept for when you open it again.");
  }

  // --- Changing and deleting his own ---------------------------------------

  // A tap on another note while he's changed the one he's in, or while it
  // saves, would throw his change away; the tap takes him back to his box.
  // A new note can push that box out of the first `limit`: then the tap
  // shows them all again, and the box focuses itself as it comes back. (A
  // note gone from the timeline, deleted on another device, has no box to
  // go back to, so it doesn't hold the rest.)
  function startEdit(item) {
    if (editing && (editing.busy || editing.text !== editing.orig)) {
      if (editBox.current) {
        editBox.current.focus();
        return;
      }
      if (groups.some((g) => g.items.some((i) => i.id === editing.id))) {
        setAll(true);
        return;
      }
    }
    setEditing({ id: item.id, text: item.text, orig: item.text, busy: false });
  }

  async function saveEdit(item) {
    const e = editing;
    if (!e || e.busy) return;
    const text = e.text;
    if (!text.trim()) return;
    setEditing({ ...e, busy: true });
    try {
      if (item.source === "focus") {
        const row = await updateFocusNote(item.id, text);
        mutateFocus((d) => (d ? { ...d, notes: d.notes.map((n) => (n.id === row.id ? { ...n, ...row } : n)) } : d));
      } else {
        const row = await updateTargetNote(item.id, text);
        notes.mutate((list) => (list ?? []).map((n) => (n.id === row.id ? row : n)));
      }
      setEditing(null);
      announceChange();
    } catch (err) {
      setEditing({ ...e, busy: false });
      toast.error(err, "Couldn't save that change. Your words are still in the box.");
    }
  }

  async function remove(item) {
    const row = rowOf(item);
    if (!row) return;
    if (editing?.id === item.id) setEditing(null);
    if (item.source === "focus") {
      // As Today's sheet deletes one: gone once the Undo has passed.
      mutateFocus((d) => (d ? { ...d, notes: d.notes.filter((n) => n.id !== row.id) } : d));
      toast.undoable({ message: "Note deleted", ...deleteLater(row) });
      return;
    }
    notes.mutate((list) => (list ?? []).filter((n) => n.id !== row.id));
    try {
      await deleteTargetNote(row.id);
      announceChange();
      toast.show(row.kind === "reflection" ? "Reflection deleted" : "Note deleted", {
        actionLabel: "Undo",
        onAction: async () => {
          try {
            const back = await restoreTargetNote(userId, row);
            notes.mutate((list) => [back, ...(list ?? []).filter((n) => n.id !== back.id)]);
            announceChange();
          } catch (err) {
            toast.error(err, "Couldn't put that back.");
          }
        },
      });
    } catch (err) {
      notes.mutate((list) => [row, ...(list ?? []).filter((n) => n.id !== row.id)]);
      toast.error(err, "Couldn't delete that.");
    }
  }

  const loading = (!notes.data && notes.loading) || (isFocus && !focusNotes.data && focusNotes.loading);
  const draftBase = noteDraftKey(target);
  // A focus kept on Sunday is a new row each week, so a reflection left
  // half-written in an earlier week is found under that week's key and
  // moves across when the sheet opens (NoteSheet's carryNoteDraft).
  const earlierKeys = isFocus && sheet === "reflect" ? (lineage ?? []).filter((id) => id && id !== target.id).map((id) => `${noteDraftKey({ kind: "focus", key: id })}:${sheet}`) : NONE;

  return (
    <section className="card tg-notes" id="notes" aria-labelledby="tg-notes-h">
      <div className="tg-sec__head">
        <h2 className="eyebrow" id="tg-notes-h">
          Notes and reflections
        </h2>
        {count > 0 && (
          <span className="tg-sec__tools">
            <button type="button" className="btn-link" onClick={() => onSheet("reflect")}>
              Reflect
            </button>
            <button type="button" className="btn-link" onClick={() => onSheet("note")}>
              Note
            </button>
          </span>
        )}
      </div>

      {notes.error && <LoadError what="the notes" error={notes.error} onRetry={notes.reload} stale={Boolean(notes.data)} />}
      {focusNotes.error && <LoadError what="this focus's notes" error={focusNotes.error} onRetry={focusNotes.reload} stale={Boolean(focusNotes.data)} />}

      {loading && !count ? (
        <p className="tg-quiet">Loading…</p>
      ) : !count ? (
        <div className="tg-empty">
          <p>Nothing written on this yet.</p>
          <div className="tg-empty__btns">
            <button type="button" className="btn btn--sm btn--on-page" onClick={() => onSheet("reflect")}>
              Reflect
            </button>
            <button type="button" className="btn btn--sm btn--on-page" onClick={() => onSheet("note")}>
              Note
            </button>
          </div>
        </div>
      ) : (
        <div className="tg-days">
          {shown.map((g) => (
            <div key={g.date} className="tg-day">
              <h3 className="tg-day__label">{g.label}</h3>
              <ul className="tg-day__list">
                {g.items.map((item) => {
                  const mine = item.source !== "evening";
                  const saving = String(item.id).startsWith("tmp:");
                  const open = editing?.id === item.id;
                  const max = item.source === "focus" ? noteLimit("focus", "note") : noteLimit(target.kind, "reflect");
                  return (
                    <li key={item.id} className={"tg-note" + (item.kind === "reflection" ? " tg-note--q" : "") + (mine ? "" : " tg-note--evening") + (saving ? " is-saving" : "")}>
                      {item.source === "evening" && (
                        <p className="tg-note__tag">
                          From the evening
                          {item.ring ? <span> · {item.ring}</span> : null}
                          {item.prompt ? <span> · {item.prompt}</span> : null}
                        </p>
                      )}
                      {item.kind === "reflection" && item.prompt && <p className="tg-note__q">{item.prompt}</p>}
                      {open ? (
                        <form
                          className="tg-note__edit"
                          onSubmit={(e) => {
                            e.preventDefault();
                            saveEdit(item);
                          }}
                        >
                          <textarea
                            ref={editBox}
                            className="textarea"
                            rows={3}
                            value={editing.text}
                            maxLength={max}
                            readOnly={editing.busy}
                            autoFocus
                            aria-label="Change the words"
                            onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit(item);
                              else if (e.key === "Escape") setEditing(null);
                            }}
                          />
                          <div className="tg-note__btns">
                            <button type="button" className="btn btn--sm btn--on-page" onClick={() => setEditing(null)} disabled={editing.busy}>
                              Cancel
                            </button>
                            <button type="submit" className="btn btn--sm btn--accent" disabled={editing.busy || !editing.text.trim()}>
                              {editing.busy ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </form>
                      ) : mine && !saving ? (
                        <div className="tg-note__row">
                          <button type="button" className="tg-note__text" onClick={() => startEdit(item)} aria-label={`Change this ${item.kind === "reflection" ? "reflection" : "note"}`}>
                            {item.text}
                          </button>
                          <button type="button" className="btn-icon tg-note__del" onClick={() => remove(item)} aria-label={`Delete this ${item.kind === "reflection" ? "reflection" : "note"}`} title="Delete">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ) : item.source === "evening" && item.shot && onOpenDay ? (
                        <button type="button" className="tg-note__text" onClick={() => onOpenDay(item.shot)} aria-label={`${item.text}: see that day on its target`}>
                          {item.text}
                        </button>
                      ) : (
                        <p className="tg-note__text tg-note__text--still">{item.text}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {hidden > 0 && (
            <button type="button" className="btn btn--sm btn--on-page tg-more" onClick={() => setAll(true)}>
              Show {hidden} older
            </button>
          )}
        </div>
      )}

      {sheet && (
        <NoteSheet
          key={sheet}
          mode={sheet}
          kind={target.kind}
          name={name}
          today={today}
          draftKey={`${draftBase}:${sheet}`}
          earlierKeys={earlierKeys}
          focusGoal={isFocus && sheet === "note" ? focusGoal ?? { id: target.id } : null}
          onSave={(v) => saveNew(sheet, v)}
          onClose={() => onSheet(null)}
        />
      )}
    </section>
  );
}
