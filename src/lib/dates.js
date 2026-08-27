export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// For a daily node, current_number/last_daily_check_date reset lazily on the
// server (on next interaction), so the client has to discount stale values
// from a previous day until that happens.
export function getTodayAdjustedCurrent(node) {
  if (!node.is_daily) return Number(node.current_number) || 0;
  if (node.last_daily_check_date !== todayISO()) return 0;
  return Number(node.current_number) || 0;
}

export function isDailyDoneToday(node) {
  if (!node.is_daily) return false;
  if (node.last_daily_check_date !== todayISO()) return false;
  return Boolean(node.is_completed);
}

export function timeAgo(iso) {
  if (!iso) return "—";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
