// Money, the parts that are pure arithmetic and vocabulary.
//
// Kept apart from the components so they can be tested: a budget bar that is
// wrong by a rounding error, or a pace marker that drifts a day, looks right
// and misleads you for a month.

// What kind of purchase it was. Short on purpose — this is asked after every
// purchase, and a list you have to read is a list you stop answering.
export const PURCHASE_KINDS = [
  "Groceries",
  "Eating out",
  "Gas",
  "Shopping",
  "Bills",
  "Subscriptions",
  "Health",
  "Gifts",
  "Fun",
  "Travel",
  "Church & giving",
  "Other",
];

// Business expense categories, named the way a tax preparer will ask about
// them, so that come April this is a sort rather than a translation.
export const BUSINESS_CATEGORIES = [
  "Software & subscriptions",
  "Equipment",
  "Office supplies",
  "Phone & internet",
  "Meals (business)",
  "Travel",
  "Car & mileage",
  "Advertising",
  "Contract labor",
  "Professional services",
  "Education",
  "Insurance",
  "Bank fees",
  "Other business",
];

export const BUDGET_COLORS = ["#ef5b3f", "#56a8e0", "#46c98b", "#e8b13a", "#a980e8", "#cf7fb0", "#8e949e"];

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdRound = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function fmtMoney(value, { round = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return (round ? usdRound : usd).format(n);
}

// Spending is stored negative (SimpleFIN's convention). Everywhere it is SHOWN
// as a positive "you spent", so this is the one place the sign flips.
export function spentOf(amount) {
  const n = Number(amount) || 0;
  return n < 0 ? -n : 0;
}

// The merchant, readable. The description Chase sends is the full string;
// this is only for the headline of the question, and the original is always
// shown underneath it.
export function merchantTitle(description) {
  const cleaned = String(description ?? "")
    .replace(/^(recurring\s+)?(card purchase(\s+with pin)?|pos\s+(debit|purchase)|debit card purchase|purchase authorized on)\s*/i, "")
    .replace(/^\d{1,2}\/\d{1,2}\s+/, "")
    .replace(/^(sq|tst|pp|sp|paypal|py|dd|ic|bt|sqc)\s*\*\s*/i, "")
    .replace(/[*#].*$/, "")
    // Chase puts a store or phone number before the city, so everything from
    // the first long run of digits on is location, not merchant.
    .replace(/\s+\d{3,}.*$/, "")
    .replace(/\s+[A-Z]{2}\s*$/, "")
    .trim();
  if (!cleaned) return String(description ?? "").trim() || "Purchase";
  return cleaned
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\.Com\b/g, ".com");
}

// How far through the month a date is, 0..1. Day-based rather than
// time-based, so the marker sits still all day instead of creeping.
export function monthProgress(today = new Date()) {
  const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return Math.min(1, Math.max(0, today.getDate() / days));
}

// Where a budget stands, judged against how much of the month is gone rather
// than against the limit alone — $300 of $400 is fine on the 28th and a
// problem on the 9th.
export function budgetStatus({ spent, limit }, progress) {
  const s = Number(spent) || 0;
  const l = Number(limit) || 0;
  if (l <= 0) return { share: 0, remaining: null, state: "untracked" };

  const share = s / l;
  const remaining = l - s;
  let state = "fine";
  if (share > 1) state = "over";
  else if (share >= 0.9) state = "close";
  // In the first week, pace means nothing — the big grocery run and the
  // monthly bills land early, so a quarter gone by the 2nd is normal. Only
  // call it ahead that early once half the budget is already spent.
  else if (progress < 0.2 ? share >= 0.5 : share > progress + 0.15) state = "ahead";

  return { share, remaining, state };
}

export const STATE_LABEL = {
  fine: "On track",
  ahead: "Ahead of the month",
  close: "Nearly spent",
  over: "Over",
  untracked: "No limit set",
};
