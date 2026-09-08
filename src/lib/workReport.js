// Building the end-of-day report.
//
// Assembled from the day's own record, not written by a model. This one goes
// to another person who will act on it, and a summary that quietly rounds a
// task up to "finished" or invents a plausible-sounding detail is worse than
// no report at all. Everything below is either something you logged or
// something you typed.
//
// Two shapes from the same data: text to paste into a message, and a card to
// screenshot. They must never disagree, so they read the same fields.

export function fmtHours(minutes) {
  const m = Math.round(Number(minutes) || 0);
  if (m <= 0) return "0h";
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

export function fmtReportDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// The parts, derived once and shared by both renderings.
export function buildReport(work) {
  const tasks = work?.tasks ?? [];
  const notes = work?.notes ?? [];

  const done = tasks.filter((t) => t.done);
  const open = tasks.filter((t) => !t.done);

  // A "did" note is something that happened but was never a planned task —
  // the interruption, the favour, the thing that came up. Those are usually
  // the most interesting half of a day and they'd be invisible otherwise.
  const extras = notes.filter((n) => n.kind === "did");
  const blocked = notes.filter((n) => n.kind === "blocked");
  const questions = notes.filter((n) => n.kind === "question");
  const asides = notes.filter((n) => n.kind === "note");

  return {
    date: work?.date,
    minutes: Number(work?.minutes) || 0,
    done,
    open,
    extras,
    blocked,
    questions,
    asides,
    tomorrow: work?.tomorrow ?? [],
    hasAnything:
      done.length + open.length + extras.length + blocked.length + questions.length + (work?.tomorrow?.length ?? 0) > 0 ||
      Number(work?.minutes) > 0,
  };
}

export function reportToText(work, { name } = {}) {
  const r = buildReport(work);
  const lines = [];

  lines.push(`${fmtReportDate(r.date)} — ${fmtHours(r.minutes)}`);

  if (r.done.length || r.extras.length) {
    lines.push("", "DONE");
    for (const t of r.done) lines.push(`· ${t.title}`);
    for (const n of r.extras) lines.push(`· ${n.body}${n.minutes ? ` (${fmtHours(n.minutes)})` : ""}`);
  }

  if (r.open.length) {
    lines.push("", "STILL IN PROGRESS");
    for (const t of r.open) {
      // Say plainly how long something has been carrying rather than letting
      // it reappear silently every day.
      const carried = t.rolled > 0 ? ` (carried ${t.rolled} ${t.rolled === 1 ? "day" : "days"})` : "";
      lines.push(`· ${t.title}${carried}`);
    }
  }

  if (r.blocked.length || r.questions.length) {
    lines.push("", "NEED FROM YOU");
    for (const n of r.blocked) lines.push(`· ${n.body}`);
    for (const n of r.questions) lines.push(`· Q: ${n.body}`);
  }

  if (r.asides.length) {
    lines.push("", "NOTES");
    for (const n of r.asides) lines.push(`· ${n.body}`);
  }

  if (r.tomorrow.length) {
    lines.push("", "TOMORROW");
    for (const t of r.tomorrow) lines.push(`· ${t.title}`);
  } else {
    lines.push("", "TOMORROW", "· (not planned yet)");
  }

  if (name) lines.push("", `— ${name}`);

  return lines.join("\n");
}
