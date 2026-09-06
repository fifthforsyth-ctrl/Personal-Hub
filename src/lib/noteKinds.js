// What a note is.
//
// Seven, and no more. A vocabulary you have to think about is a vocabulary you
// stop using — the point of tagging a thought is that it takes no longer than
// having it. "Thought" is the default and carries no judgment; nothing is
// required to be more than that.
//
// Colors are an aid, never the encoding: every chip prints its own name, so
// none of this depends on telling gold from amber.
export const NOTE_KINDS = [
  {
    key: "revelation",
    label: "Spiritual experience",
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
    label: "Motivational thought",
    short: "Motivation",
    color: "#e0603f",
    hint: "Something to come back to on a hard day.",
  },
  {
    key: "counsel",
    label: "Counsel from a mentor",
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
    label: "Just a thought",
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
