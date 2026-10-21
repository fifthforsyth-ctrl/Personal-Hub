// Wake watch, the pure parts: phone numbers, the message as it will read,
// and what each morning's report says. The judging itself happens in the
// database (0078_wake_watch.sql); this mirrors it for the page.

// A US number typed any usual way becomes +1XXXXXXXXXX. Anything already
// starting with + keeps its country code. Null when it can't be a number.
export function normalizePhone(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  let out;
  if (s.startsWith("+")) out = `+${digits}`;
  else if (digits.length === 10) out = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith("1")) out = `+${digits}`;
  else return null;
  return /^\+[1-9]\d{7,14}$/.test(out) ? out : null;
}

// +18015551234 → (801) 555-1234; other countries as stored.
export function prettyPhone(phone) {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(phone ?? "");
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : phone ?? "";
}

// 5:23 am, the way the text writes it.
export function wakeClock(iso, tz = "America/Denver") {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(new Date(iso));
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("hour")}:${get("minute")} ${get("dayPeriod").toLowerCase()}`;
}

export function fillMessage(template, iso, tz) {
  return String(template ?? "").replace("{time}", iso ? wakeClock(iso, tz) : "{time}");
}

// "04:35:00" → "4:35"
export function shortTime(t) {
  const [h, m] = String(t ?? "").split(":");
  return h ? `${Number(h)}:${m}` : "";
}

export const OUTCOME = {
  up: { label: "Up", tone: "good" },
  late: { label: "Dragons", tone: "miss" },
  unlogged: { label: "Dragons", tone: "miss" },
  waiting: { label: "Still asleep", tone: "wait" },
};

// One line for what happened to the text.
export function deliveryLine(report) {
  if (!report) return "";
  switch (report.status) {
    case "waiting":
      return "Nothing sent yet. It goes the minute you're up.";
    case "practice":
      return "Practice: written here, not texted.";
    case "none":
      return "No peers were on, so nothing went.";
    case "queued":
      return "Sending…";
    case "sent":
      return report.sent_to === 1 ? "Texted to 1 peer." : `Texted to ${report.sent_to} peers.`;
    case "failed":
      return `Didn't go: ${report.error || "the text service refused it."}`;
    default:
      return "";
  }
}

// Mornings up in a row, newest first, counting only judged mornings.
export function upStreak(reports) {
  let n = 0;
  for (const r of reports ?? []) {
    if (r.outcome === "waiting") continue;
    if (r.outcome !== "up") break;
    n += 1;
  }
  return n;
}
