// What a note is.
//
// Seven, and no more. A vocabulary you have to think about is a vocabulary you
// stop using — the point of tagging a thought is that it takes no longer than
// having it. "Thought" is the default and carries no judgment; nothing is
// required to be more than that.
//
// Colors are an aid, never the encoding: every chip prints its own name, so
// none of this depends on telling gold from amber. Each kind has one name, the
// same on a chip, a heading and a menu; the hint says what it's for.
export const NOTE_KINDS = [
  {
    key: "revelation",
    label: "Revelation",
    short: "Revelation",
    color: "#e8b13a",
    hint: "Something that came — a prompting, an answer, a witness.",
  },
  {
    key: "insight",
    label: "Insight",
    short: "Insight",
    color: "#56a8e0",
    hint: "Something you worked out or finally understood.",
  },
  {
    key: "motivation",
    label: "Motivation",
    short: "Motivation",
    color: "#e0603f",
    hint: "Something to come back to on a hard day.",
  },
  {
    key: "counsel",
    label: "Counsel",
    short: "Counsel",
    color: "#cf7fb0",
    hint: "Something someone further along the road told you.",
  },
  {
    key: "question",
    label: "Question",
    short: "Question",
    color: "#a980e8",
    hint: "Something you're still wrestling with.",
  },
  {
    key: "resolve",
    label: "Resolve",
    short: "Resolve",
    color: "#46c98b",
    hint: "Something you've decided to do.",
  },
  {
    key: "thought",
    label: "Thought",
    short: "Thought",
    color: "#8e949e",
    hint: "Worth keeping, nothing more claimed than that.",
  },
];

export const DEFAULT_KIND = "thought";

const BY_KEY = new Map(NOTE_KINDS.map((k) => [k.key, k]));

// Unknown keys resolve rather than crash — a kind retired from the list still
// has notes wearing it.
export function kindOf(key) {
  return BY_KEY.get(key) ?? { key: key ?? DEFAULT_KIND, label: key ?? "Thought", short: key ?? "Thought", color: "#8e949e", hint: "" };
}

// A long note synced in from the vault arrives untagged. Calling it a
// "Thought" undersells it, so the board names it for what it is.
export const STUDY_NOTE = { key: "study", label: "Study note", short: "Study note", color: "#85827c", hint: "A long note from your vault." };

export function isStudyNote(note) {
  return Boolean(note?.obsidian_uid) && !note?.parent_note_id && (note?.note_kind ?? DEFAULT_KIND) === DEFAULT_KIND;
}

// What the board calls a note: its kind, or "Study note" for a vault source.
export function boardKindOf(note) {
  return isStudyNote(note) ? STUDY_NOTE : kindOf(note?.note_kind);
}
