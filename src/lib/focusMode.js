// Focus mode: a timer you've ticked as focused, and what broke the focus.
//
// The pure parts, so they can be tested without a database. A focus span
// runs from the tick to the untick or the timer's stop. Two things break it:
// a pull (a moment: phone, a text, a thought) and time out of the office (a
// stretch, from leaving to Back to work). Focused time is the span minus the
// time out; the longest unbroken stretch is the longest run with neither.
//
// "Focus" elsewhere in the Hub is the weekly focus goals (focus.js); this
// file is only about focus mode on a timer.

export const PULL_REASONS = ["Phone", "Text / message", "Email", "Non-work site", "A thought", "Someone came in", "Noise", "Tired"];
export const LEAVE_REASONS = ["Bathroom", "Water / food", "Lunch", "Called away", "Meeting", "Restless", "Personal errand"];

const MIN = 60000;
const t = (iso) => new Date(iso).getTime();

// The reasons to offer, the ones you've used most first, then the rest of
// the defaults, then any of yours that aren't defaults. `used` is a list of
// past reasons (any order, repeats count).
export function reasonsByUse(defaults, used = []) {
  const counts = new Map();
  for (const r of used) {
    const k = (r ?? "").trim();
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const all = [...new Set([...defaults, ...counts.keys()])];
  const firstSeen = new Map(all.map((r, i) => [r, i]));
  return all
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || firstSeen.get(a) - firstSeen.get(b))
    .slice(0, Math.max(defaults.length, 8));
}

// Where a focus stands right now: still focused, or out of the office and
// since when. `breaks` are the span's own breaks.
export function focusState(span, breaks = [], now = Date.now()) {
  if (!span || span.ended_at) return { on: false };
  const out = breaks.filter((b) => b.kind === "left" && !b.ended_at).sort((a, b) => t(b.started_at) - t(a.started_at))[0];
  const pulls = breaks.filter((b) => b.kind === "pulled").length;
  const s = summarizeSpan(span, breaks, now);
  return { on: true, away: out ?? null, pulls, trips: s.trips, focusedMinutes: s.focusedMinutes, since: span.started_at };
}

// One span, as numbers: focused minutes, time out, trips out, pulls, and
// the longest unbroken run.
export function summarizeSpan(span, breaks = [], now = Date.now()) {
  const start = t(span.started_at);
  const end = span.ended_at ? t(span.ended_at) : now;
  const mine = breaks.filter((b) => !b.span_id || b.span_id === span.id);

  // Time out of the office, clipped to the span and merged where it overlaps.
  const outs = mine
    .filter((b) => b.kind === "left")
    .map((b) => [Math.max(start, t(b.started_at)), Math.min(end, b.ended_at ? t(b.ended_at) : end)])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const merged = [];
  for (const o of outs) {
    const last = merged[merged.length - 1];
    if (last && o[0] <= last[1]) last[1] = Math.max(last[1], o[1]);
    else merged.push([...o]);
  }
  const awayMs = merged.reduce((s, [a, b]) => s + (b - a), 0);

  // The unbroken runs: the span cut at every pull and every time out.
  const cuts = [...merged];
  for (const b of mine) {
    if (b.kind !== "pulled") continue;
    const at = t(b.started_at);
    if (at >= start && at <= end) cuts.push([at, at]);
  }
  cuts.sort((x, y) => x[0] - y[0]);
  let longest = 0;
  let from = start;
  for (const [a, b] of cuts) {
    longest = Math.max(longest, a - from);
    from = Math.max(from, b);
  }
  longest = Math.max(longest, end - from);

  return {
    focusedMinutes: Math.max(0, end - start - awayMs) / MIN,
    awayMinutes: awayMs / MIN,
    trips: mine.filter((b) => b.kind === "left").length,
    pulls: mine.filter((b) => b.kind === "pulled").length,
    longestMinutes: Math.max(0, longest) / MIN,
    away: merged,
  };
}

// A day's focus: the totals, what broke it most (pulls by count, time out
// by count and minutes), and the pieces to draw it as a line from the first
// focus to the last.
export function summarizeDay(spans = [], breaks = [], now = Date.now()) {
  const sorted = [...spans].sort((a, b) => t(a.started_at) - t(b.started_at));
  let focused = 0;
  let away = 0;
  let longest = 0;
  let pulls = 0;
  let trips = 0;
  const segments = [];
  for (const s of sorted) {
    const own = breaks.filter((b) => b.span_id === s.id);
    const sum = summarizeSpan(s, own, now);
    focused += sum.focusedMinutes;
    away += sum.awayMinutes;
    longest = Math.max(longest, sum.longestMinutes);
    pulls += sum.pulls;
    trips += sum.trips;
    const start = t(s.started_at);
    const end = s.ended_at ? t(s.ended_at) : now;
    let from = start;
    for (const [a, b] of sum.away) {
      if (a > from) segments.push({ kind: "focus", from, to: a });
      segments.push({ kind: "away", from: a, to: b });
      from = b;
    }
    if (end > from) segments.push({ kind: "focus", from, to: end });
  }

  const tally = new Map();
  for (const b of breaks) {
    if (!sorted.some((s) => s.id === b.span_id)) continue;
    const reason = (b.reason ?? "").trim() || (b.kind === "left" ? "Left the office" : "Pulled away");
    const key = `${b.kind}|${reason}`;
    const row = tally.get(key) ?? { kind: b.kind, reason, count: 0, minutes: 0 };
    row.count += 1;
    if (b.kind === "left") row.minutes += Math.max(0, (b.ended_at ? t(b.ended_at) : now) - t(b.started_at)) / MIN;
    tally.set(key, row);
  }
  const reasons = [...tally.values()].sort((a, b) => b.count - a.count || b.minutes - a.minutes || a.reason.localeCompare(b.reason));

  const pullsAt = breaks
    .filter((b) => b.kind === "pulled" && sorted.some((s) => s.id === b.span_id))
    .map((b) => ({ at: t(b.started_at), reason: b.reason }));

  return {
    focusedMinutes: focused,
    awayMinutes: away,
    longestMinutes: longest,
    pulls,
    trips,
    reasons,
    segments,
    pullsAt,
    from: segments.length ? segments[0].from : null,
    to: segments.length ? segments[segments.length - 1].to : null,
  };
}

// A stopwatch: "0:42:07", or "12:05" under an hour.
export function stopwatch(sinceISO, now = Date.now()) {
  const secs = Math.max(0, Math.floor((now - t(sinceISO)) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Minutes for a sentence: "48m", "2h 5m".
export function fmtFocusMinutes(mins) {
  const m = Math.round(mins || 0);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}
