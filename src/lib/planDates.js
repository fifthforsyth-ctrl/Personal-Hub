// Date helpers for the planner. Everything here works in LOCAL calendar
// terms and passes "YYYY-MM-DD" strings around — the planner's date column
// is a plain `date`, so going through Date#toISOString (UTC) would land the
// wrong day for anyone west of Greenwich, which is exactly where this is
// being used from.

export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

// Parses "YYYY-MM-DD" as a LOCAL midnight Date (new Date("2026-08-27")
// would parse as UTC midnight and shift backward a day in the Americas).
export function parseDateStr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr, n) {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function addMonths(dateStr, n) {
  const d = parseDateStr(dateStr);
  d.setDate(1); // avoid Jan 31 + 1 month landing in March
  d.setMonth(d.getMonth() + n);
  return toDateStr(d);
}

export function startOfMonth(dateStr) {
  const d = parseDateStr(dateStr);
  return toDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonth(dateStr) {
  const d = parseDateStr(dateStr);
  return toDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function fmtDayHeading(dateStr) {
  return parseDateStr(dateStr).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function fmtMonthYear(dateStr) {
  return parseDateStr(dateStr).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function yearOf(dateStr) {
  return parseDateStr(dateStr).getFullYear();
}

// Calendar grid for a month: leading blanks so the 1st lands on its real
// weekday, then each day of the month. Sunday-first, matching how the
// weekday header row below it reads.
export function monthGrid(dateStr) {
  const d = parseDateStr(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(toDateStr(new Date(year, month, day)));
  return cells;
}

// Minutes since midnight for a "HH:MM" / "HH:MM:SS" time string.
export function minutesOf(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function fmtTime(t) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// How "lit up" a day reads in the month/year grids, 0..1 — blends planning
// (blocks laid out), follow-through (tasks completed), and time actually
// logged, so a day that was planned but not lived doesn't glow the same as
// one that was. Deliberately the same visual language as the goal tree's
// brightness: engagement, not judgment.
export function dayIntensity(summary) {
  if (!summary) return 0;
  const planned = summary.chunk_count > 0 ? 0.25 : 0;
  const followThrough = summary.task_count > 0 ? 0.45 * (summary.done_count / summary.task_count) : 0;
  const logged = Math.min(0.3, (Number(summary.logged_minutes) || 0) / 480 * 0.3);
  return Math.min(1, planned + followThrough + logged);
}

// Weeks start Sunday, matching the month grid's column order so the two views
// never disagree about which day sits where.
export function startOfWeek(dateStr) {
  const d = parseDateStr(dateStr);
  return toDateStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()));
}

export function weekDays(dateStr) {
  const start = startOfWeek(dateStr);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function fmtWeekHeading(dateStr) {
  const start = parseDateStr(startOfWeek(dateStr));
  const end = parseDateStr(addDays(startOfWeek(dateStr), 6));
  const sameMonth = start.getMonth() === end.getMonth();
  const left = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const right = end.toLocaleDateString(undefined, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
  return `${left} – ${right}, ${end.getFullYear()}`;
}
