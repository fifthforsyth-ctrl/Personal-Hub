// The Board's pure parts, kept here so they can be tested without a browser.

// The board lists your own notes newest first. Notes made from a passage of
// a longer note (yours, or the ones the nightly reading cut in September)
// are folded under the note they came from instead.
export function boardNotes(notes) {
  return (notes ?? [])
    .filter((n) => !n.parent_note_id)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

// Two answers to a card the curator brought back: "useful", saved as 9, or
// "not now", saved as 3. Older picks were scored 1 to 10, so anything 6 and
// up reads as useful.
export const USEFUL = 9;
export const NOT_NOW = 3;

export function verdictOf(score) {
  if (!score) return null;
  return score >= 6 ? "useful" : "not_now";
}
