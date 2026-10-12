// "Oct 2", with the year once it isn't this year's. Takes a plain date
// ("2026-10-02", read as that day where you are, not as UTC midnight) or a
// timestamp.
export function dayLabel(value) {
  if (!value) return null;
  const s = String(value);
  const plain = /^\d{4}-\d{2}-\d{2}$/.test(s);
  const d = plain ? new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) : new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
}
