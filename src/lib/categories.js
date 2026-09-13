// The tracking vocabulary and its colours.
//
// On the palette: twenty-five categories cannot each have a memorable
// colour, so they are grouped into families and each takes a shade inside
// its family's hue. That is what makes the day ring readable — you are not
// asked to recall twenty-five swatches, only "green means body, blue means
// work, violet means spirit", and the shade tells you which kind within it.
//
// Families are also arranged so the ones that sit next to each other on a
// real day sit apart on the colour wheel. Sleep is the deepest and least
// saturated of all of them: it is the longest arc on almost every ring and
// has no business being the loudest.
//
// Colour is still never the only carrier of meaning — every chip prints its
// name, every bar is labelled, and the ring has a legend.

export const FAMILIES = [
  { key: "Rest", label: "Rest", hue: "#332e52" },
  { key: "Body", label: "Body", hue: "#15803d" },
  { key: "Spirit", label: "Spirit", hue: "#8b5cf6" },
  { key: "Work", label: "Work", hue: "#1d4ed8" },
  { key: "People", label: "People", hue: "#e11d48" },
  { key: "Craft", label: "Craft", hue: "#eab308" },
  { key: "Upkeep", label: "Upkeep", hue: "#0e7490" },
  { key: "Lost", label: "Lost", hue: "#7f1d1d" },
  { key: "Other", label: "Other", hue: "#71717a" },
];

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

// Defaults only — the live values come from the database per user.
export const CATEGORY_FAMILY = {
  Sleep: "Rest",
  Exercise: "Body",
  Meals: "Body",
  Study: "Spirit",
  Church: "Spirit",
  Temple: "Spirit",
  "Spiritual meetings": "Spirit",
  Meeting: "Work",
  "Working for Parker": "Work",
  Serve: "People",
  Minister: "People",
  Meet: "People",
  "Social activity": "People",
  "Symposium (group goal meeting)": "People",
  Draw: "Craft",
  writing: "Craft",
  Prep: "Upkeep",
  Plan: "Upkeep",
  Reflect: "Upkeep",
  Drive: "Upkeep",
  Waste: "Lost",
  Other: "Other",
};

export const CATEGORY_COLOR = {
  Sleep: "#332e52",
  Prep: "#0e7490",
  Plan: "#06b6d4",
  Reflect: "#5eead4",
  Drive: "#475569",
  Exercise: "#15803d",
  Meals: "#84cc16",
  Draw: "#eab308",
  writing: "#fde047",
  Serve: "#e11d48",
  Minister: "#f97316",
  Meet: "#fb923c",
  "Social activity": "#fdba74",
  "Symposium (group goal meeting)": "#9f1239",
  "Working for Parker": "#1d4ed8",
  Meeting: "#60a5fa",
  Study: "#8b5cf6",
  Church: "#c084fc",
  Temple: "#6b21a8",
  "Spiritual meetings": "#d8b4fe",
  Waste: "#7f1d1d",
  Other: "#71717a",
};

// Colors live per-user in the database; this module keeps the defaults and a
// live lookup the app fills in once categories load, so any component can
// colour a tag by name without threading the list through it.
let runtimeColors = {};
let runtimeFamilies = {};

export function setCategoryColors(categories) {
  runtimeColors = Object.fromEntries((categories ?? []).map((c) => [c.name, c.color]));
  runtimeFamilies = Object.fromEntries((categories ?? []).filter((c) => c.family).map((c) => [c.name, c.family]));
}

export function colorFor(category) {
  return runtimeColors[category] ?? CATEGORY_COLOR[category] ?? "#71717a";
}

export function familyFor(category) {
  return runtimeFamilies[category] ?? CATEGORY_FAMILY[category] ?? "Other";
}

// Offered when adding a category, grouped so a new one lands in a family
// rather than wherever the colour picker happened to stop.
export const PALETTE_BY_FAMILY = {
  Rest: ["#332e52", "#4c3f8a", "#5b4fa6"],
  Body: ["#15803d", "#16a34a", "#84cc16", "#a3e635"],
  Spirit: ["#6b21a8", "#8b5cf6", "#c084fc", "#d8b4fe"],
  Work: ["#1d4ed8", "#2563eb", "#60a5fa", "#93c5fd"],
  People: ["#9f1239", "#e11d48", "#f97316", "#fb923c", "#fdba74"],
  Craft: ["#eab308", "#facc15", "#fde047"],
  Upkeep: ["#0e7490", "#06b6d4", "#22d3ee", "#5eead4", "#475569"],
  Lost: ["#7f1d1d", "#991b1b"],
  Other: ["#71717a", "#a1a1aa"],
};

export const PALETTE = Object.values(PALETTE_BY_FAMILY).flat();

export function fmtMinutes(minutes) {
  const m = Math.round(Number(minutes) || 0);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}
