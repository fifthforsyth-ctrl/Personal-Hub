import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { NOTE_MAX, promptFor, promptIndexFor } from "../../lib/ladder";
import Sheet from "../ascent/Sheet";
import { readDraft, keepDraft } from "../focus/FocusSheet";

// Writing on a target: a reflection (one question at a time, from the
// curated list in ladder.js, with "Another question" going round) or a
// plain note. Nothing here asks a machine anything; the words are his.
//
// Words are never lost. What he types is kept on this phone as he types it,
// per target and per kind of writing, and is there again when the sheet
// opens. Cancel keeps it. Only a save that went through clears it, and only
// if the box still holds what was sent. A save that fails leaves the sheet
// open with every word in it.
//
// A focus's plain note is the same note Today's focus sheet writes
// (focus_notes, 2000 characters), so it keeps that sheet's draft
// (hub.focus-note-draft.<goal id>): a note started on Today carries on here.
//
//   mode       "reflect" or "note"
//   kind       the target's kind, for its questions
//   name       its short name, for the title
//   draftKey   where a target note's draft waits (noteDraftKey + ":reflect"/":note")
//   focusGoal  the focus_goals row, when this is a focus's plain note
//   onSave     ({ text, prompt }) => a promise of the saved row; it rejects
//              when the save didn't go through

// The longest note each place takes: a focus's notes 2000, every other
// target's notes and reflections 4000.
export const FOCUS_NOTE_MAX = 2000;
export function noteLimit(kind, mode) {
  return kind === "focus" && mode === "note" ? FOCUS_NOTE_MAX : NOTE_MAX;
}

// The draft for a target's note or reflection. These take `store` only so
// the tests can hand in a stand-in.
export function readNoteDraft(key, store) {
  try {
    return (store ?? localStorage).getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function keepNoteDraft(key, text, store) {
  try {
    const s = store ?? localStorage;
    if (String(text ?? "").trim()) s.setItem(key, text);
    else s.removeItem(key);
  } catch {
    // Private mode or storage off: the draft just isn't kept.
  }
}

// Once it has saved, the kept copy goes, but only if it's still the text
// that was sent: anything typed after Save is his to keep.
export function dropNoteDraft(key, sent, store) {
  try {
    const s = store ?? localStorage;
    if (s.getItem(key) === sent) s.removeItem(key);
  } catch {
    // Nothing was kept, so there's nothing to clear.
  }
}

// Saves `sent` with `save()`. The draft is only cleared after the save went
// through; if it throws, the draft stays exactly as it was and the error
// goes on to the sheet.
export async function sendNote({ key, sent, save, store }) {
  const row = await save();
  dropNoteDraft(key, sent, store);
  return row;
}

const promptKey = (draftKey) => `${draftKey}:q`;

export default function NoteSheet({ mode, kind, name, today, draftKey, focusGoal = null, onSave, onClose }) {
  const reflect = mode === "reflect";
  const focusNote = Boolean(focusGoal) && !reflect;
  const max = noteLimit(focusNote ? "focus" : kind, mode);
  const [text, setText] = useState(() => (focusNote ? readDraft(focusGoal) : readNoteDraft(draftKey)));
  // The question he was answering stays with his draft; a fresh one starts
  // on the day's question.
  const [turn, setTurn] = useState(() => {
    if (!reflect) return 0;
    const kept = readNoteDraft(promptKey(draftKey));
    return readNoteDraft(draftKey) && /^\d+$/.test(kept) ? Number(kept) : promptIndexFor(kind, today);
  });
  const prompt = reflect ? promptFor(kind, turn) : null;
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState(null);
  const box = useRef(null);

  // Kept as he types.
  useEffect(() => {
    if (focusNote) keepDraft(focusGoal.id, text);
    else keepNoteDraft(draftKey, text);
  }, [focusNote, focusGoal, draftKey, text]);

  // The box grows with what's in it (CSS caps it, then it scrolls).
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [text]);

  function another() {
    const next = turn + 1;
    setTurn(next);
    keepNoteDraft(promptKey(draftKey), String(next));
  }

  async function save(e) {
    e?.preventDefault();
    if (saving || !text.trim()) return;
    const sent = text;
    setSaving(true);
    setProblem(null);
    try {
      // A focus's note goes through Today's sheet's own save, which keeps
      // or clears its draft the same way.
      if (focusNote) await onSave({ text: sent, prompt: null });
      else await sendNote({ key: draftKey, sent, save: () => onSave({ text: sent, prompt }) });
      if (reflect) dropNoteDraft(promptKey(draftKey), String(turn));
      onClose();
    } catch {
      setSaving(false);
      setProblem("Couldn't save that. Your words are still here.");
    }
  }

  const near = text.length > max * 0.9;

  return (
    <Sheet title={reflect ? `Reflect on ${name}` : `A note on ${name}`} onClose={onClose}>
      <form className="tg-sheet" onSubmit={save}>
        {reflect && (
          <div className="tg-sheet__q">
            <p className="tg-sheet__prompt">{prompt}</p>
            <button type="button" className="btn-link tg-sheet__another" onClick={another} disabled={saving}>
              <RefreshCw size={13} aria-hidden="true" />
              Another question
            </button>
          </div>
        )}
        <textarea
          ref={box}
          className="textarea tg-sheet__box"
          rows={4}
          value={text}
          maxLength={max}
          readOnly={saving}
          autoFocus
          aria-label={reflect ? prompt : "Your note"}
          placeholder={reflect ? "Write what comes" : "What you noticed, a decision, a link"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(e);
          }}
        />
        {near && (
          <p className="tg-sheet__count" aria-live="polite">
            {text.length} of {max}
          </p>
        )}
        {problem && (
          <p className="form-error" role="alert">
            {problem}
          </p>
        )}
        <div className="tg-sheet__actions">
          <button type="button" className="btn btn--on-page" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--accent" disabled={saving || !text.trim()}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
