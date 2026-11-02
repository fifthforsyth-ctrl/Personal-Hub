import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { NOTE_MAX, REFLECT_PROMPTS, promptFor, promptIndexFor } from "../../lib/ladder";
import Sheet from "../ascent/Sheet";
import { readDraft, keepDraft, onNoteLanded } from "../focus/FocusSheet";

// Writing on a target: a reflection (one question at a time, from the
// curated list in ladder.js, with "Another question" going round) or a
// plain note. Nothing here asks a machine anything; the words are his.
//
// Words are never lost. What he types is kept on this phone as he types it,
// per target and per kind of writing, and is there again when the sheet
// opens. Cancel keeps it. Only a save that went through clears it, and only
// if the box still holds what was sent. A save that fails leaves the sheet
// open with every word in it. A reflection keeps the question it answers
// with it, so it's saved under that question whichever day he finishes it.
//
// A focus's plain note is the same note Today's focus sheet writes
// (focus_notes, 2000 characters), so it keeps that sheet's draft
// (hub.focus-note-draft.<goal id>): a note started on Today carries on here.
//
//   mode         "reflect" or "note"
//   kind         the target's kind, for its questions
//   name         its short name, for the title
//   draftKey     where a target note's draft waits (noteDraftKey + ":reflect"/":note")
//   earlierKeys  on a focus, the same draft's keys in its earlier weeks,
//                newest first (see carryNoteDraft)
//   focusGoal    the focus_goals row, when this is a focus's plain note
//   onSave       ({ text, prompt }) => a promise of the saved row; it rejects
//                when the save didn't go through

// The longest note each place takes: a focus's notes 2000, every other
// target's notes and reflections 4000.
export const FOCUS_NOTE_MAX = 2000;
export function noteLimit(kind, mode) {
  return kind === "focus" && mode === "note" ? FOCUS_NOTE_MAX : NOTE_MAX;
}

// A note or reflection on its way to the database. Its kept copy only goes
// once it has saved, so close the sheet while it saves, open it again before
// it lands, and the box would fill with the words just sent, Save lit, and
// a second tap would save them twice. So the words on their way are kept
// here, by draft key, as Today's focus sheet keeps its own: a sheet opened
// meanwhile leaves them out of its box, and every sheet on screen hears
// when they land.
const inFlight = new Map(); // draft key -> the texts on their way
const landing = new Set();
const isInFlight = (key, text) => inFlight.get(key)?.includes(text) ?? false;

// The draft for a target's note or reflection, leaving out words that are
// still saving. These take `store` only so the tests can hand in a stand-in.
export function readNoteDraft(key, store) {
  try {
    const own = (store ?? localStorage).getItem(key);
    return own != null && isInFlight(key, own) ? "" : own ?? "";
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

// Where a reflection's question waits, beside its words.
export const promptKey = (draftKey) => `${draftKey}:q`;

// Keeping a focus on Sunday gives it a new row, with a new id, for the new
// week, so a reflection left half-written on Saturday sits under last week's
// key. The first time the new week's sheet opens with nothing of its own,
// the newest earlier week's draft moves across with its question, the way
// Today's focus sheet moves a note's (FocusSheet's readDraft). Returns the
// draft.
export function carryNoteDraft(key, earlierKeys, store) {
  try {
    const s = store ?? localStorage;
    if (s.getItem(key) != null) return readNoteDraft(key, s);
    for (const before of earlierKeys ?? []) {
      if (!before || before === key) continue;
      const text = s.getItem(before);
      if (text == null || isInFlight(before, text)) continue;
      const q = s.getItem(promptKey(before));
      s.setItem(key, text);
      if (q != null) s.setItem(promptKey(key), q);
      else s.removeItem(promptKey(key));
      s.removeItem(before);
      s.removeItem(promptKey(before));
      return text;
    }
    return "";
  } catch {
    return "";
  }
}

// The question a reflection's draft answers, as { turn, text }: `turn` is
// where "Another question" goes round from. The draft keeps the question's
// own words (an older draft kept only its place in the list), so a draft
// reopened on another day, or after the list changes, is saved under the
// question he answered. With nothing kept, the day's question.
export function keptQuestion(kind, kept, dayTurn) {
  const k = String(kept ?? "").trim();
  if (/^\d+$/.test(k)) return { turn: Number(k), text: promptFor(kind, Number(k)) };
  if (!k) return { turn: dayTurn, text: promptFor(kind, dayTurn) };
  const i = (REFLECT_PROMPTS[kind] ?? REFLECT_PROMPTS.quest).indexOf(k);
  return { turn: i >= 0 ? i : dayTurn, text: k };
}

// Words that didn't save are never thrown away: back in a box left empty,
// or above anything typed since, unless the box already holds them (the
// same rule as Today's focus sheet).
export function withUnsentNote(cur, sent) {
  const now = cur ?? "";
  if (!now.trim()) return sent;
  return now.includes(sent) ? now : `${sent}\n\n${now}`;
}

// Saves `sent` with `save()`. The draft is only cleared after the save went
// through (and a reflection's `question` with it, once no words are left
// to answer it). If it throws, the words are a draft again, even if a sheet
// opened meanwhile has emptied the box, and the error goes on to the sheet.
export async function sendNote({ key, sent, question = null, save, store }) {
  inFlight.set(key, [...(inFlight.get(key) ?? []), sent]);
  let row = null;
  let failed = null;
  try {
    row = await save();
  } catch (err) {
    failed = err ?? new Error("Couldn't save that.");
  }
  const left = [...(inFlight.get(key) ?? [])];
  left.splice(left.indexOf(sent), 1);
  if (left.length) inFlight.set(key, left);
  else inFlight.delete(key);
  if (failed) {
    const now = readNoteDraft(key, store);
    if (question && !now.trim()) keepNoteDraft(promptKey(key), question, store);
    keepNoteDraft(key, withUnsentNote(now, sent), store);
  } else {
    dropNoteDraft(key, sent, store);
    if (question && !readNoteDraft(key, store).trim()) keepNoteDraft(promptKey(key), "", store);
  }
  for (const heard of landing) heard({ key, sent, question, saved: !failed });
  if (failed) throw failed;
  return row;
}

// A sheet hears when words land (`saved`) or don't while it's open. Returns
// the way to stop.
export function onNoteSent(heard) {
  landing.add(heard);
  return () => landing.delete(heard);
}

export default function NoteSheet({ mode, kind, name, today, draftKey, earlierKeys = null, focusGoal = null, onSave, onClose }) {
  const reflect = mode === "reflect";
  const focusNote = Boolean(focusGoal) && !reflect;
  const focusId = focusNote ? focusGoal.id : null;
  const max = noteLimit(focusNote ? "focus" : kind, mode);
  // An earlier week's draft moves across first, so the question below is
  // read from where it has just gone.
  const [text, setText] = useState(() => (focusNote ? readDraft(focusGoal) : carryNoteDraft(draftKey, earlierKeys)));
  // The question he was answering stays with his draft; a fresh one starts
  // on the day's question.
  const [ask, setAsk] = useState(() => (reflect ? keptQuestion(kind, text.trim() ? readNoteDraft(promptKey(draftKey)) : "", promptIndexFor(kind, today)) : null));
  const prompt = ask?.text ?? null;
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState(null);
  const box = useRef(null);
  // A sheet closed while it saved has nothing to close when the save lands;
  // the sheet open by then may be a new one.
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  // Kept as he types, and a reflection's question with its words, for as
  // long as there are words.
  useEffect(() => {
    if (focusNote) keepDraft(focusGoal.id, text);
    else keepNoteDraft(draftKey, text);
    if (reflect) keepNoteDraft(promptKey(draftKey), text.trim() ? prompt : "");
  }, [focusNote, focusGoal, draftKey, text, reflect, prompt]);

  // Words that land, or don't, while this sheet is open, whichever sheet
  // sent them: this one, or one closed before they saved. Saved, a box
  // still holding just them empties; not saved, they come back into the
  // box (with their question, into a box left empty) and the sheet says so.
  const shown = useRef(text);
  shown.current = text;
  useEffect(() => {
    const heard = ({ sent, question, saved }) => {
      if (!saved) {
        if (question && !shown.current.trim()) setAsk((a) => keptQuestion(kind, question, a?.turn ?? 0));
        setProblem("Couldn't save that. Your words are still here.");
      }
      setText((cur) => (saved ? (cur === sent ? "" : cur) : withUnsentNote(cur, sent)));
    };
    if (focusId) return onNoteLanded(({ goalId, sent, row }) => goalId === focusId && heard({ sent, question: null, saved: Boolean(row) }));
    return onNoteSent((landed) => landed.key === draftKey && heard(landed));
  }, [focusId, draftKey, kind]);

  // The box grows with what's in it (CSS caps it, then it scrolls).
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [text]);

  function another() {
    setAsk((a) => {
      const next = (a?.turn ?? 0) + 1;
      return { turn: next, text: promptFor(kind, next) };
    });
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
      else await sendNote({ key: draftKey, sent, question: prompt, save: () => onSave({ text: sent, prompt }) });
      if (live.current) onClose();
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
