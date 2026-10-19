// Today at a glance, for the home screen widget.
//
// A widget can't sign in, so it sends the key made in the app (More > On
// your phone) in the x-widget-key header. Only the key's SHA-256 is stored
// (widget_keys); this looks it up with the service role and answers with
// today's numbers for that one person. Read-only: nothing here writes
// except the "last asked" time beside the key.
//
// "Today" is the phone's day: the widget sends its time zone, so midnight
// is midnight where you are, the same as on the Today page. Wins and losses
// count from that midnight; minutes are the timers that started today and
// have stopped, counted the way Today counts them (each category on an
// entry gets the whole entry), plus whatever is running now.
//
// verify_jwt is off because the widget has no login; the key is the check.

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-widget-key, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function validZone(tz: string | null) {
  if (!tz) return "America/Denver";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "America/Denver";
  }
}

// The wall-clock date in a zone, and the instant its midnight began.
function dayIn(tz: string, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const offsetAt = (t: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      })
        .formatToParts(new Date(t))
        .map((x) => [x.type, x.value])
    );
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return asUtc - t;
  };
  const guess = Date.UTC(+parts.year, +parts.month - 1, +parts.day);
  // Twice, so a day that starts across a daylight-saving change still lands.
  let start = guess - offsetAt(guess);
  start = guess - offsetAt(start);
  return { date, startISO: new Date(start).toISOString() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const key = req.headers.get("x-widget-key")?.trim();
  if (!key || key.length < 32) return json({ error: "No widget key. Make one in the Hub under More > On your phone." }, 401);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: found, error: keyError } = await db
    .from("widget_keys")
    .select("user_id")
    .eq("key_hash", await sha256Hex(key))
    .maybeSingle();
  if (keyError) return json({ error: "The Hub didn't answer. Try again in a minute." }, 500);
  if (!found) return json({ error: "This widget key was turned off. Make a new one in the Hub under More > On your phone." }, 401);
  const userId = found.user_id as string;

  const tz = validZone(new URL(req.url).searchParams.get("tz"));
  const { date, startISO } = dayIn(tz);

  const [wl, entries, open, cats, plan] = await Promise.all([
    db.from("win_losses").select("kind, habit_label, occurred_at").eq("user_id", userId).gte("occurred_at", startISO).order("occurred_at", { ascending: false }).limit(500),
    db.from("time_log_entries").select("category, tags, duration_minutes").eq("user_id", userId).gte("started_at", startISO).not("ended_at", "is", null).limit(500),
    db.from("time_log_entries").select("category, started_at").eq("user_id", userId).is("ended_at", null).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("user_categories").select("name, color").eq("user_id", userId),
    db.from("day_plans").select("banked_at").eq("user_id", userId).eq("date", date).maybeSingle(),
  ]);
  const failed = [wl, entries, open, cats, plan].find((r) => r.error);
  if (failed) return json({ error: "The Hub didn't answer. Try again in a minute." }, 500);

  const rows = wl.data ?? [];
  const wins = rows.filter((r) => r.kind === "win");
  const losses = rows.filter((r) => r.kind === "loss");

  const colors = new Map((cats.data ?? []).map((c) => [c.name, c.color]));
  const totals = new Map<string, number>();
  let tracked = 0;
  for (const e of entries.data ?? []) {
    const mins = Number(e.duration_minutes) || 0;
    tracked += mins;
    for (const t of e.tags?.length ? e.tags : [e.category]) totals.set(t, (totals.get(t) ?? 0) + mins);
  }
  const categories = [...totals.entries()]
    .map(([name, minutes]) => ({ name, minutes: Math.round(minutes), color: colors.get(name) ?? null }))
    .sort((a, b) => b.minutes - a.minutes);

  // A missed "last asked" costs nothing, so its error is ignored.
  await db.from("widget_keys").update({ last_used_at: new Date().toISOString() }).eq("user_id", userId);

  return json({
    date,
    wins: wins.length,
    losses: losses.length,
    winLabels: wins.map((w) => w.habit_label).filter((l) => l && l.trim() && l.trim().toLowerCase() !== "win").slice(0, 4),
    trackedMinutes: Math.round(tracked),
    categories,
    running: open.data ? { category: open.data.category, startedAt: open.data.started_at, color: colors.get(open.data.category) ?? null } : null,
    banked: Boolean(plan.data?.banked_at),
    asOf: new Date().toISOString(),
  });
});
