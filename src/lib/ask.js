// The Ask page's pure parts, kept here so they can be tested.

// Questions to start from: real ones, across the whole record, so the
// first press shows what it can do.
export const STARTERS = [
  "How has my time split between work, family and study this month?",
  "Which habits do I keep most often, and which slip?",
  "Chart my study minutes by week since I started tracking",
  "Where have I seen God's hand most this month?",
  "What have I written about patience?",
  "How much did I spend eating out each month?",
];

// An answer as it reads: its words, with each chart where the assistant
// put its [[chart:N]] marker. A chart it didn't place goes at the end, and
// a marker with no chart behind it is dropped.
export function answerParts(text, charts) {
  const byN = new Map((charts ?? []).map((c) => [Number(c.n), c]));
  const placed = new Set();
  const parts = [];
  const pieces = String(text ?? "").split(/\[\[chart:(\d+)\]\]/);
  pieces.forEach((piece, i) => {
    if (i % 2 === 0) {
      if (piece.trim()) parts.push({ kind: "text", text: piece.trim() });
      return;
    }
    const chart = byN.get(Number(piece));
    if (chart && !placed.has(chart.n)) {
      placed.add(chart.n);
      parts.push({ kind: "chart", chart });
    }
  });
  for (const chart of charts ?? []) if (!placed.has(chart.n)) parts.push({ kind: "chart", chart });
  return parts;
}

// A question asked and not yet answered, still within the time the server
// gives it. Past that it isn't coming.
export const ANSWER_GIVES_UP_MS = 3 * 60_000;

export function stillWorking(convo, now = Date.now()) {
  if (!convo?.working_since) return false;
  const last = convo.messages?.[convo.messages.length - 1];
  if (last?.role !== "user") return false;
  return now - Date.parse(convo.working_since) < ANSWER_GIVES_UP_MS;
}

// A question that was asked and never answered (the answer gave up).
export function unanswered(convo, now = Date.now()) {
  const last = convo?.messages?.[convo.messages.length - 1];
  return last?.role === "user" && !stillWorking(convo, now);
}

// What the chart component draws from: the spec, and the rows.
export function chartResult(chart) {
  return {
    spec: {
      title: chart.title,
      answer: chart.caption ?? "",
      chart_type: chart.chart_type,
      x_key: chart.x_key,
      y_key: chart.y_key,
      series_key: chart.series_key ?? null,
      x_kind: chart.x_kind,
      y_unit: chart.y_unit,
    },
    rows: chart.rows ?? [],
  };
}
