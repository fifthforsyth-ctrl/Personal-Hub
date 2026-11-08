// The Builder page's pure parts, kept here so they can be tested.

// The conversation as the builder reads it: his words, and its own replies
// with any question it asked and the whole quest it proposed (so "move the
// last camp first" works on the quest he's looking at), plus what he did
// with that quest.
export function asTurns(messages) {
  return (messages ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      if (m.role === "user") return { role: "user", text: m.text };
      const parts = [m.text || ""];
      if (m.question) parts.push(`[You asked: ${m.question.text} Options: ${m.question.options.join(" / ")}]`);
      if (m.proposal) {
        const what = m.undone
          ? "He applied it, then undid it."
          : m.applied
            ? "He applied it; it's in his Hub now."
            : m.dismissed
              ? "He chose not to make it."
              : "Not applied yet.";
        parts.push(`[Your proposal, shown to him. ${what}]\n${JSON.stringify(m.proposal)}`);
      }
      return { role: "assistant", text: parts.filter(Boolean).join("\n\n") };
    })
    .filter((t) => t.text.trim());
}

export function countsLine({ camps, sections, steps }) {
  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  return [n(camps, "camp", "camps"), n(sections, "section", "sections"), n(steps, "step", "steps")].join(" · ");
}

const KEY = (userId) => `builder-chat:${userId}`;

export function loadChat(userId) {
  try {
    const raw = sessionStorage.getItem(KEY(userId));
    const list = raw ? JSON.parse(raw) : [];
    // A card that was mid-Apply when the page went away isn't any more.
    return Array.isArray(list) ? list.map((m) => ({ ...m, applying: false })) : [];
  } catch {
    return [];
  }
}

export function saveChat(userId, messages) {
  try {
    sessionStorage.setItem(KEY(userId), JSON.stringify(messages.slice(-40)));
  } catch {
    /* storage full or blocked: the chat just won't survive a reload */
  }
}
