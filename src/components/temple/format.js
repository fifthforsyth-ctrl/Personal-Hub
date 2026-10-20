import { parseDateStr } from "../../lib/planDates";

// "2026-10-24" -> "Sat, Oct 24"; with a year -> "Oct 24, 2026".
export function fmtShortDate(dateStr, withYear = false) {
  if (!dateStr) return "";
  const d = parseDateStr(dateStr.slice(0, 10));
  if (Number.isNaN(d.getTime())) return dateStr;
  return withYear
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
