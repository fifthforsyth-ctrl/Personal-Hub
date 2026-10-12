import { todayStr, toDateStr } from "./planDates.js";

// For a daily node, current_number/last_daily_check_date reset lazily on the
// server (on next interaction), so the client has to discount stale values
// from a previous day until that happens. "Today" is the phone's own day:
// the server stamps check-ins with the date the app sends, not UTC's.
export function getTodayAdjustedCurrent(node) {
  if (!node.is_daily) return Number(node.current_number) || 0;
  if (node.last_daily_check_date !== todayStr()) return 0;
  return Number(node.current_number) || 0;
}

export function isDailyDoneToday(node) {
  if (!node.is_daily) return false;
  if (node.last_daily_check_date !== todayStr()) return false;
  return Boolean(node.is_completed);
}

// Whether the goal's latest check-in landed today, which is what undo_checkin
// can take back. A daily goal's count belongs to the day it's stamped with; a
// one-time goal counts when it was completed today.
export function checkedInToday(node) {
  if (node.is_daily) return node.last_daily_check_date === todayStr() && (Number(node.current_number) > 0 || node.is_completed);
  return Boolean(node.is_completed && node.completed_at && toDateStr(new Date(node.completed_at)) === todayStr());
}

export function timeAgo(iso) {
  if (!iso) return "never";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? "yesterday" : `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

// "Oct 2" for a plain "YYYY-MM-DD" date, read as a local calendar day.
export function fmtShortDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
