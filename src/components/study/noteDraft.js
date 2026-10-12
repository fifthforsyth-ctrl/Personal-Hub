// What you type in a Board note is kept on the device as you type it, until
// it's saved or thrown away. Leaving the page, the app closing or a dead
// battery doesn't cost a word: open the note again and the changes are
// waiting.
//
// A draft remembers the note as it was when the editing started (its base),
// so a note changed somewhere else in the meantime keeps those changes in
// every field the draft didn't touch.

const FIELDS = ["title", "sourceRef", "body", "kind"];
const PLACEHOLDER_TITLES = new Set(["untitled", "untitled note"]);

function key(userId, noteId) {
  return `hub.note-draft.${userId}.${noteId}`;
}

// A note's editable fields, as the editor holds them. A placeholder title
// starts empty, so typing doesn't begin by deleting "Untitled note".
export function editableFields(note) {
  return {
    title: PLACEHOLDER_TITLES.has(String(note?.title ?? "").trim().toLowerCase()) ? "" : note?.title ?? "",
    sourceRef: note?.source_ref ?? "",
    body: note?.body ?? "",
    kind: note?.note_kind ?? "thought",
  };
}

// What a save would send: only the fields that differ from the note.
export function changesFrom(fields, base) {
  const changes = {};
  if (fields.title.trim() !== base.title.trim()) changes.title = fields.title;
  if (fields.sourceRef.trim() !== base.sourceRef.trim()) changes.sourceRef = fields.sourceRef.trim();
  if (fields.body !== base.body) changes.body = fields.body;
  if (fields.kind !== base.kind) changes.noteKind = fields.kind;
  return changes;
}

// The draft's own changes laid over the note as it is now.
export function draftOver(draft, current) {
  const out = { ...current };
  for (const k of FIELDS) if (draft.fields[k] !== draft.base[k]) out[k] = draft.fields[k];
  return out;
}

// True when the note also changed, since the draft began, in a field the
// draft changes too: saving the draft replaces that change.
export function draftClashes(draft, current) {
  return FIELDS.some((k) => draft.fields[k] !== draft.base[k] && current[k] !== draft.base[k]);
}

export function readNoteDraft(userId, noteId) {
  if (!userId || !noteId) return null;
  try {
    const draft = JSON.parse(localStorage.getItem(key(userId, noteId)) ?? "null");
    return draft?.fields && draft?.base ? draft : null;
  } catch (err) {
    console.warn(err);
    return null;
  }
}

export function writeNoteDraft(userId, noteId, fields, base) {
  if (!userId || !noteId) return;
  try {
    localStorage.setItem(key(userId, noteId), JSON.stringify({ fields, base, at: Date.now() }));
  } catch (err) {
    console.warn(err);
  }
}

export function clearNoteDraft(userId, noteId) {
  if (!userId || !noteId) return;
  try {
    localStorage.removeItem(key(userId, noteId));
  } catch (err) {
    console.warn(err);
  }
}

// "3:42 PM" today, "Oct 11, 3:42 PM" before that.
export function draftTime(at, now = new Date()) {
  const d = new Date(at);
  const sameDay = d.toDateString() === now.toDateString();
  return d.toLocaleString(undefined, sameDay ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
