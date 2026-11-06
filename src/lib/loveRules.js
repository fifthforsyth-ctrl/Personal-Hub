// The Love tab's pure rules, kept apart from the database calls so they
// can be tested (scripts/test.mjs).

export const RATINGS = [
  { key: "fun", label: "Fun" },
  { key: "romance", label: "Romance" },
  { key: "zest", label: "Zest for life" },
  { key: "connection", label: "Connection" },
  { key: "unnamed", label: "'shall not be named'" },
];

// A handle is what follows the @: lowercase letters, digits, underscores.
export function cleanHandle(text) {
  return String(text ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

export function handlesFrom(text) {
  return [...new Set(String(text ?? "").split(/[\s,]+/).map(cleanHandle).filter((h) => h.length >= 2 && h.length <= 24))];
}

// Does this text @mention any of these handles? The same rule as the
// database trigger: not inside an email or a longer word.
export function mentions(text, handles) {
  if (!text || !handles?.length) return false;
  const re = new RegExp(`(^|[^A-Za-z0-9_.])@(${handles.map(escape).join("|")})(?![A-Za-z0-9_])`, "i");
  return re.test(text);
}

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The leaderboard: each done date with both people's scores, averaged per
// measure and overall. A date counts once either of you has rated it.
export function leaderboard(dates, ratings, by = "overall") {
  const rows = dates
    .filter((d) => d.status === "done")
    .map((d) => {
      const rs = ratings.filter((r) => r.date_id === d.id);
      const avg = {};
      for (const { key } of RATINGS) {
        const vals = rs.map((r) => r[key]).filter((v) => v != null);
        avg[key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      }
      const all = RATINGS.map(({ key }) => avg[key]).filter((v) => v != null);
      avg.overall = all.length ? all.reduce((a, b) => a + b, 0) / all.length : null;
      return { date: d, ratings: rs, avg };
    })
    .filter((r) => r.avg[by] != null);
  rows.sort((a, b) => b.avg[by] - a.avg[by] || (b.date.on_date ?? "").localeCompare(a.date.on_date ?? ""));
  return rows;
}

