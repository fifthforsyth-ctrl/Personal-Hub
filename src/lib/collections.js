// Board collections: what's in each, the To sort tray, a guess at where a new
// save belongs, and the day's quote drawn from the collections that feed
// Today. Pure functions, so the tests can hold them.

// Each collection with its quotes and thoughts, newest filed first. Items
// whose quote or thought is gone (unsaved, deleted) are left out.
export function fillCollections(collections, items, quotes, notes) {
  const quoteById = new Map(quotes.map((q) => [q.id, q]));
  const noteById = new Map(notes.map((n) => [n.id, n]));
  return collections.map((c) => {
    const entries = [];
    for (const it of items) {
      if (it.collection_id !== c.id) continue;
      if (it.quote_id && quoteById.has(it.quote_id)) entries.push({ kind: "quote", id: it.quote_id, quote: quoteById.get(it.quote_id) });
      else if (it.note_id && noteById.has(it.note_id)) entries.push({ kind: "note", id: it.note_id, note: noteById.get(it.note_id) });
    }
    return { ...c, entries };
  });
}

// Which collections a quote or thought is in, by id.
export function collectionsOf(items, { quote_id = null, note_id = null }) {
  return new Set(items.filter((it) => (quote_id ? it.quote_id === quote_id : it.note_id === note_id)).map((it) => it.collection_id));
}

// The tray: saved quotes not yet filed or kept loose, and in no collection,
// oldest first so they come in the order they were saved.
export function trayQuotes(quotes, items) {
  const filed = new Set(items.filter((it) => it.quote_id).map((it) => it.quote_id));
  return quotes
    .filter((q) => q.saved_at && !q.filed_at && !filed.has(q.id))
    .sort((a, b) => String(a.saved_at).localeCompare(String(b.saved_at)));
}

const STOP = new Set(
  ("a an and are as at be but by can do for from has have he her his i if in is it its me my no not of on or our " +
    "so that the their them then there they this to us was we were what when which who will with you your all one " +
    "more than us out up into only very just him she shall thou thee thy ye unto").split(" ")
);

export function wordsOf(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => w.replace(/(ing|ed|es|s)$/, ""))
    .filter((w) => w.length > 2);
}

// A guess at the collection a quote belongs in: the one whose quotes share
// the most words with it (and its author, which counts double), weighed
// against the collection's size so a big one doesn't win everything. Its
// name counts too, so a new, empty collection can still be guessed. Null
// when nothing fits well enough.
export function suggestCollection(quote, filled) {
  const mine = new Set(wordsOf(quote.text));
  const author = String(quote.author ?? "").toLowerCase();
  let best = null;
  for (const c of filled) {
    let score = 0;
    for (const w of wordsOf(c.name)) if (mine.has(w)) score += 3;
    const pool = new Map();
    for (const e of c.entries) {
      const text = e.kind === "quote" ? e.quote.text : `${e.note.title ?? ""} ${e.note.essence ?? e.note.body ?? ""}`;
      for (const w of new Set(wordsOf(text))) pool.set(w, (pool.get(w) ?? 0) + 1);
      if (author && e.kind === "quote" && String(e.quote.author ?? "").toLowerCase() === author) score += 2;
    }
    let shared = 0;
    for (const w of mine) if (pool.has(w)) shared += 1;
    score += shared / Math.sqrt(Math.max(1, c.entries.length) / 5 + 1);
    if (!best || score > best.score) best = { id: c.id, score };
  }
  return best && best.score >= 1 ? best.id : null;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// The quotes Today can draw from: every quote in a collection that feeds
// Today, once each, in a steady order.
export function drawPool(filled) {
  const seen = new Set();
  const pool = [];
  for (const c of filled) {
    if (!c.feeds_today) continue;
    for (const e of c.entries) {
      if (e.kind !== "quote" || seen.has(e.id)) continue;
      seen.add(e.id);
      pool.push(e.quote);
    }
  }
  return pool.sort((a, b) => a.id.localeCompare(b.id));
}

// The day's quote: the same one all day, a different one tomorrow, walking
// the pool in a shuffled order so the whole pool comes round before any
// repeats. `skip` is how many times he's tapped Another today.
export function drawFor(pool, dateStr, skip = 0) {
  if (pool.length === 0) return null;
  const day = Math.floor(Date.parse(`${dateStr}T12:00:00Z`) / 86400000);
  const order = [...pool].sort((a, b) => hash(a.id + ":" + Math.floor(day / pool.length)) - hash(b.id + ":" + Math.floor(day / pool.length)));
  return order[(day + skip) % order.length];
}
