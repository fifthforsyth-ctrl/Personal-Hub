// The shelves of quotes you can browse from the Board, and their pure parts,
// kept here so they can be tested.
//
// A shelf is found the first time it's opened (the `quotes` function looks
// each quote up on the web and gives it a picture) and kept, so the second
// visit is instant. "Find more" adds to it.

import { startOfWeek } from "./planDates.js";
import { boardNotes } from "./board.js";

// People: who said it. `wiki` is their English Wikipedia article, for the
// tile's photo.
export const PEOPLE = [
  { name: "Russell M. Nelson", wiki: "Russell M. Nelson", kind: "church" },
  { name: "Jeffrey R. Holland", wiki: "Jeffrey R. Holland", kind: "church" },
  { name: "Dieter F. Uchtdorf", wiki: "Dieter F. Uchtdorf", kind: "church" },
  { name: "Dallin H. Oaks", wiki: "Dallin H. Oaks", kind: "church" },
  { name: "David A. Bednar", wiki: "David A. Bednar", kind: "church" },
  { name: "Neal A. Maxwell", wiki: "Neal A. Maxwell", kind: "church" },
  { name: "Gordon B. Hinckley", wiki: "Gordon B. Hinckley", kind: "church" },
  { name: "Joseph Smith", wiki: "Joseph Smith", kind: "church" },
  { name: "Abraham Lincoln", wiki: "Abraham Lincoln", kind: "historical" },
  { name: "C. S. Lewis", wiki: "C. S. Lewis", kind: "historical" },
  { name: "Theodore Roosevelt", wiki: "Theodore Roosevelt", kind: "historical" },
  { name: "Winston Churchill", wiki: "Winston Churchill", kind: "historical" },
  { name: "Marcus Aurelius", wiki: "Marcus Aurelius", kind: "historical" },
  { name: "Frederick Douglass", wiki: "Frederick Douglass", kind: "historical" },
  { name: "George Washington", wiki: "George Washington", kind: "historical" },
  { name: "Viktor Frankl", wiki: "Viktor Frankl", kind: "historical" },
];

// Themes: what it's about.
export const THEMES = [
  { name: "Faith", hint: "Faith in Jesus Christ, and acting on it." },
  { name: "Grace", hint: "The grace and enabling power of Jesus Christ's Atonement." },
  { name: "Repentance", hint: "Repentance as daily, hopeful change." },
  { name: "Discipline", hint: "Self-mastery, habits and doing the hard thing." },
  { name: "Work", hint: "Work, diligence and doing your work well." },
  { name: "Courage", hint: "Courage, standing firm, and acting despite fear." },
  { name: "Gratitude", hint: "Gratitude and noticing what you've been given." },
  { name: "Prayer", hint: "Prayer and hearing God." },
  { name: "Family", hint: "Family, marriage and home." },
  { name: "Service", hint: "Serving and loving others." },
  { name: "Adversity", hint: "Trials, suffering and growing through them." },
  { name: "Purpose", hint: "Purpose, eternal perspective and what matters most." },
];

// Moods: how you feel right now. The hint asks for what helps, not for
// words about the feeling.
export const MOODS = [
  { name: "Discouraged", hint: "For when you're discouraged: hope that's honest about the struggle." },
  { name: "Anxious", hint: "For when you're anxious: peace, trust in God, the next small step." },
  { name: "Tired", hint: "For when you're worn out: rest, endurance, and running no faster than you have strength." },
  { name: "Tempted", hint: "For when you're tempted: strength, agency, and who you are." },
  { name: "Restless", hint: "For when you're restless or stuck: direction and getting moving." },
  { name: "Overwhelmed", hint: "For when there's too much: what matters most, one thing at a time." },
  { name: "Lonely", hint: "For when you feel alone: being known and loved by God, and reaching out." },
  { name: "Grateful", hint: "For when you're grateful: seeing God's hand and giving thanks." },
  { name: "Joyful", hint: "For when things are good: joy, and keeping it rooted in Christ." },
  { name: "Ambitious", hint: "For when you're fired up: big goals, consecration and doing it well." },
];

export const FACETS = [
  { key: "person", label: "People" },
  { key: "theme", label: "Themes" },
  { key: "mood", label: "Moods" },
];

// "Russell M. Nelson" -> "russell-m-nelson". Keys are what the database
// accepts: lowercase letters, digits and dashes, at most 80 of them.
export function slug(text) {
  return (
    String(text ?? "")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/, "") || "x"
  );
}

// Everything the function needs to find a shelf, from what was tapped.
export function shelfFor(facet, item) {
  if (facet === "person") {
    return { key: `person:${slug(item.name)}`, facet, label: item.name, hint: `Quotes by ${item.name}.` };
  }
  if (facet === "ask") {
    const label = String(item.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
    return { key: `ask:${slug(label)}`, facet, label, hint: label };
  }
  return { key: `${facet}:${slug(item.name)}`, facet, label: item.name, hint: item.hint ?? "" };
}

// This week's top picks: one shelf per week, starting Sunday.
export function topShelf(date) {
  return { key: `top:${startOfWeek(date)}`, facet: "top", label: "Top picks for you" };
}

// The shelf's quotes in the shelf's order (the database hands rows back in
// its own), leaving out any that have gone.
export function inShelfOrder(ids, rows) {
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  return (ids ?? []).map((id) => byId.get(id)).filter(Boolean);
}

// A pending shelf more than five minutes old was abandoned (the function
// gives up on it then too), so it reads as failed and can be asked again.
export const PENDING_GIVES_UP_MS = 5 * 60_000;

export function shelfState(row, now = Date.now()) {
  if (!row) return "missing";
  if (row.status === "pending") return now - Date.parse(row.requested_at) > PENDING_GIVES_UP_MS ? "failed" : "pending";
  return row.status;
}

// A slight, steady tilt for each card on the board, from its id: enough to
// read as pinned by hand, not enough to look messy. It doesn't shuffle on
// every render.
export function tiltOf(id) {
  let h = 0;
  for (const ch of String(id ?? "")) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 5) - 2) * 0.3; // -0.6deg .. 0.6deg
}

// The pins are black and steel, with the odd orange one; the same card
// always gets the same one.
export const PIN_COLORS = ["#1c1c1e", "#5a5a60", "#1c1c1e", "#8a8a90", "#f26a1b"];

export function pinOf(id) {
  let h = 7;
  for (const ch of String(id ?? "")) h = (h * 17 + ch.charCodeAt(0)) | 0;
  return PIN_COLORS[Math.abs(h) % PIN_COLORS.length];
}

// The cork: saved quotes and kept thoughts together. Pinned thoughts go to
// the top; the rest newest first, by when it went up on the board.
export function corkItems(quotes, notes) {
  const items = [
    ...(quotes ?? []).map((q) => ({ kind: "quote", id: q.id, at: q.saved_at, top: false, quote: q })),
    ...boardNotes(notes ?? []).map((n) => ({ kind: "note", id: n.id, at: n.created_at, top: Boolean(n.pinned), note: n })),
  ];
  return items.sort((a, b) => Number(b.top) - Number(a.top) || String(b.at).localeCompare(String(a.at)));
}

// --- your own notes on the shelves ------------------------------------------
//
// The board function reads each note you keep and files it under the
// shelves it belongs on (its shelf_keys), so a shelf can show what you wrote
// beside the quotes found for you.

// Your notes on one shelf, newest first. Cards cut from a note go with it.
export function notesOnShelf(notes, key) {
  return boardNotes(notes ?? []).filter((n) => (n.shelf_keys ?? []).includes(key));
}

// How many of your notes are on each shelf.
export function shelfCounts(notes) {
  const counts = new Map();
  for (const n of boardNotes(notes ?? [])) {
    for (const key of new Set(n.shelf_keys ?? [])) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// The people your notes quote who aren't among the Board's own, so they get
// shelves too: most-quoted first.
export function notePeople(notes) {
  const listed = new Set(PEOPLE.map((p) => slug(p.name)));
  const found = new Map();
  for (const n of boardNotes(notes ?? [])) {
    for (const name of new Set(n.shelf_people ?? [])) {
      const key = slug(name);
      if (listed.has(key)) continue;
      const seen = found.get(key);
      found.set(key, { name: seen?.name ?? name, count: (seen?.count ?? 0) + 1 });
    }
  }
  return [...found.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// "All" on a shelf: the quotes found for you and your own notes, taking
// turns, so yours aren't buried at the bottom.
export function interleave(a, b) {
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

// The shelves that can hold your notes: a person, a theme or a mood.
export function holdsNotes(shelf) {
  return shelf?.facet === "person" || shelf?.facet === "theme" || shelf?.facet === "mood";
}
