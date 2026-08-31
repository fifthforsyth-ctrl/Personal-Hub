// The tracking vocabulary, carried over from the HTML tracker so nothing has
// to be relearned — same names, same order, same colors.
//
// On the colors: fourteen hues cannot be made colorblind-safe, so these are
// never the only thing carrying meaning. Every chip prints its own name, and
// every bar is labeled — the color is a familiarity aid, not the encoding.
export const CATEGORIES = [
  "Sleep",
  "Prep",
  "Exercise",
  "Serve",
  "Minister",
  "Plan",
  "Study",
  "Draw",
  "Meals",
  "Meet",
  "Drive",
  "Waste",
  "Meeting",
  "Other",
];

export const CATEGORY_COLOR = {
  Sleep: "#a855f7",
  Prep: "#3b82f6",
  Exercise: "#10b981",
  Serve: "#f43f5e",
  Minister: "#14b8a6",
  Plan: "#06b6d4",
  Study: "#6366f1",
  Draw: "#f59e0b",
  Meals: "#f97316",
  Meet: "#d946ef",
  Drive: "#64748b",
  Waste: "#ef4444",
  Meeting: "#8b5cf6",
  Other: "#71717a",
};

export function colorFor(category) {
  return CATEGORY_COLOR[category] ?? "#71717a";
}

export function fmtMinutes(minutes) {
  const m = Math.round(Number(minutes) || 0);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}
