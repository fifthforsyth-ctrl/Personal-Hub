// The quote card's pure parts, kept here so they can be tested.

export const RATINGS = [
  { key: "applies", label: "Applies" },
  { key: "somewhat", label: "Somewhat" },
  { key: "not_now", label: "Not now" },
];

// What the card says once you've rated it.
export function ratedLine(rating) {
  if (rating === "applies") return "It'll come back now and then.";
  if (rating === "somewhat") return "Noted.";
  if (rating === "not_now") return "Fewer like this.";
  return "";
}

// Two letters for the name card: the first and last names, skipping titles
// and suffixes ("Elder", "President", "Jr.").
const SKIP = new Set(["elder", "president", "sister", "brother", "bishop", "sr", "jr", "ii", "iii"]);

export function initials(author) {
  const words = String(author ?? "")
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !SKIP.has(w.toLowerCase()));
  if (words.length === 0) return "";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// "General conference, October 2018" or "Mere Christianity (1952)": the
// source, with the year added when the source doesn't already say it.
export function sourceLine(quote) {
  const source = String(quote?.source ?? "").trim();
  const year = quote?.year ? String(quote.year) : "";
  if (!source) return year;
  if (!year || source.includes(year)) return source;
  return `${source} (${year})`;
}
