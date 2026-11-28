// Arrows on a target (Aaron, 2026-11-28): every arrow is a good one. He
// places it himself, any time and as often as he likes, for something he
// did toward that target, with a title, a note, both or neither. Nothing
// asks where it landed: each arrow sits near the middle of the face at a
// spot drawn from its own id, so it stays put between visits.

export const ARROW_TITLE_MAX = 120;
export const ARROW_NOTE_MAX = 4000;

const clip = (text, max) => {
  const trimmed = String(text ?? "").replace(/\r\n?/g, "\n").trim();
  return Array.from(trimmed).slice(0, max).join("").trim();
};

// The words an arrow keeps: a title on one line, a note of any shape. Empty
// is null (the table refuses blank words).
export function cleanArrowWords({ title = "", note = "" } = {}) {
  const t = clip(String(title ?? "").replace(/\s+/g, " "), ARROW_TITLE_MAX);
  const n = clip(note, ARROW_NOTE_MAX);
  return { title: t || null, note: n || null };
}

// The column an arrow on this target is saved under.
export function arrowRef(kind, key) {
  if (kind === "mission") return { mission: true };
  if (kind === "goal") return { goal_id: key };
  if (kind === "quest") return { quest_id: key };
  if (kind === "lesson") return { lesson_id: key };
  if (kind === "focus") return { focus_goal_id: key };
  return null;
}

// The arrows on one target, oldest first.
export function arrowsOn(arrows, kind, key) {
  const list = arrows ?? [];
  if (kind === "mission") return list.filter((a) => a.mission);
  const col = Object.keys(arrowRef(kind, key) ?? {})[0];
  return col ? list.filter((a) => a[col] === key) : [];
}

// A small, steady hash of an id, 0..1, one per salt.
function unit(id, salt) {
  let h = 2166136261 ^ salt;
  for (const ch of String(id)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10007) / 10007;
}

// Where an arrow sits on the face (TargetFace's units: the bullseye's edge
// is 16, the inner ring's 32). Every arrow is good, so they gather in the
// middle: inside the inner ring, spread round evenly.
export function arrowSpot(id) {
  const angle = unit(id, 1) * Math.PI * 2;
  const r = 4 + Math.sqrt(unit(id, 2)) * 24;
  return { x: Math.round(Math.cos(angle) * r * 10) / 10, y: Math.round(Math.sin(angle) * r * 10) / 10 };
}

// The face TargetFace draws for a target's arrows: each a mark at its spot,
// the newest last (today's as an arrow stuck in the straw).
export function faceOf(arrows) {
  return {
    reasons: [],
    shots: (arrows ?? []).map((a) => ({ id: a.id, date: a.date, level: 0, note: a.note || a.title || null, ...arrowSpot(a.id) })),
  };
}

// Days back from today, counting today as 0.
function daysBack(date, today) {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000);
}

// What a small target says to a screen reader: "5 arrows in 30 days, 2 today".
export function arrowWords(arrows, today, days = 30) {
  const recent = (arrows ?? []).filter((a) => daysBack(a.date, today) < days);
  if (!recent.length) return "no arrows yet";
  const n = recent.length;
  const t = recent.filter((a) => a.date === today).length;
  return `${n} ${n === 1 ? "arrow" : "arrows"} in ${days} days${t ? `, ${t} today` : ""}`;
}

// The line an arrow shows in a list: its title, else the start of its note.
export function arrowLine(a) {
  if (a?.title) return a.title;
  if (a?.note) return a.note.split("\n")[0];
  return "An arrow";
}
