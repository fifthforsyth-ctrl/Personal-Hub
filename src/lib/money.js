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

// "Ahead of the month" read like good news. It means the money is going
// faster than the month is.
export const STATE_LABEL = {
  fine: "On track",
  ahead: "Spending fast",
  close: "Nearly spent",
  over: "Over",
  untracked: "No limit set",
};

// Days left in the month, counting today.
export function daysLeftInMonth(today = new Date()) {
  const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return days - today.getDate() + 1;
}

// The question asks only for the budget, so the kind of purchase comes from
// it when the budget is named like one ("Groceries", "Eating out"), and
// otherwise from what was said about this place last time, as long as the
// budget is the same as last time (or there was none then and none now).
// Nothing is guessed beyond that.
export function kindForBudget(budgetName, { suggestedKind = null, suggestedBudgetId = null, budgetId = null } = {}) {
  const name = String(budgetName ?? "").trim().toLowerCase();
  const match = PURCHASE_KINDS.find((k) => k.toLowerCase() === name);
  if (match) return match;
  if (suggestedKind && (suggestedBudgetId || null) === (budgetId || null)) return suggestedKind;
  return null;
}

// ---------------------------------------------------------------------------
// Budgets you spend out of by hand (Nov 2026).
//
// The bank only shows what's in the accounts now. Spending is what you add
// yourself: an amount, a title, the budget it comes out of. Everything below
// works on those purchases, as rows of { posted_at, amount (negative), budget_id }.

// The month a purchase falls in, "2026-11-01", by the local calendar.
export function monthOf(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// Total spent per month, newest first: [{ month, total, count }].
export function spentByMonth(purchases) {
  const by = new Map();
  for (const p of purchases ?? []) {
    const k = monthOf(p.posted_at);
    const row = by.get(k) ?? { month: k, total: 0, count: 0 };
    row.total = round2(row.total + spentOf(p.amount));
    row.count += 1;
    by.set(k, row);
  }
  return [...by.values()].sort((a, b) => (a.month < b.month ? 1 : -1));
}

// What came out of each budget in one month: { [budgetId | "none"]: total }.
export function spentByBudget(purchases, month) {
  const out = {};
  for (const p of purchases ?? []) {
    if (monthOf(p.posted_at) !== month) continue;
    const k = p.budget_id || "none";
    out[k] = round2((out[k] ?? 0) + spentOf(p.amount));
  }
  return out;
}

// A budget's average month, counted only over whole months: from the first
// month the budget existed AND purchases were being added (a start after the
// 3rd waits for the next month, so a few days don't pass for a month), up to
// the month before `current`. Null until there's at least one such month.
export function budgetAverage(budget, purchases, current) {
  const list = purchases ?? [];
  if (!budget || list.length === 0) return null;
  const first = list.reduce((min, p) => (p.posted_at < min ? p.posted_at : min), list[0].posted_at);
  const created = budget.created_at ?? first;
  const startAt = new Date(Math.max(new Date(created).getTime(), new Date(first).getTime()));
  let y = startAt.getFullYear();
  let m = startAt.getMonth();
  if (startAt.getDate() > 3) m += 1;
  const months = [];
  for (let d = new Date(y, m, 1); ; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    if (k >= current) break;
    months.push(k);
    if (months.length > 600) break;
  }
  if (months.length === 0) return null;
  const inThem = new Set(months);
  let total = 0;
  for (const p of list) {
    if (p.budget_id === budget.id && inThem.has(monthOf(p.posted_at))) total += spentOf(p.amount);
  }
  return { average: round2(total / months.length), months: months.length };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
