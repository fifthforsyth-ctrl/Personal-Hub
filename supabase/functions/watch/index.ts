// The Apple Watch's way into the Hub.
//
// Three callers, one key (made in the app under More > On your watch; only
// its SHA-256 is stored, in watch_keys):
//
// 1. The "Hub" Shortcut on the watch. It's a tiny loop that does whatever
//    this function says next, so every menu and list lives here and can
//    change without touching the Shortcut. Each call sends
//      { step, answer, go }
//    and gets back one of
//      { kind: "list", prompt, options, step }   show a list, send the pick
//      { kind: "text", prompt, step }            ask (dictation), send it
//      { kind: "done", say }                     show `say` and stop
//    `go` starts somewhere other than the menu ("win", "start", "stop",
//    "task", "note", "today", "woke"), so one copy of the Shortcut can be
//    a one-tap Win button on the watch face.
//
// 2. The iPhone's wake-up automation: { go: "woke" }. The moment you're up:
//    a running Sleep timer stops (what "I'm up" does, so the morning
//    check-in finds the night) and today's health_days.woke_at is set if
//    it's empty.
//
// 3. Health Auto Export: { data: { metrics, workouts, ... } }. Daily numbers
//    go to health_days; each night's sleep becomes a Sleep entry in the
//    minutes log unless one is already there; each workout becomes an
//    Exercise entry unless you logged one over it. Nothing here makes a win.
//
// 4. The Hub app on the watch (watch-app/ in this repo): { api, ... }.
//    Plain JSON both ways. "today" is everything its screens show (the
//    plan, Today's tasks, this week's focus goals, wins, minutes, the
//    running timer, habits and categories); "glance" is the little bit the
//    complication shows; "start", "stop", "win", "loss", "done" and "note"
//    do what the Shortcut does and answer { ok, say }. Times go out as
//    epoch milliseconds.
//
// The key comes in the x-watch-key header (or ?key= for apps that can only
// set a URL). verify_jwt is off because none of these can sign in.

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";
import { readHealthPayload, mergeDay, sleepAction, workoutAction, exerciseEntry, fmtMins, HEALTH_COLUMNS } from "./health.js";
import { ms, planOf, blockAt, focusWeek, targetsToday, sleptLast } from "./app.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-watch-key, content-type, authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// Every reply to the Shortcut carries every field, so a step that reads one
// that doesn't apply gets an empty value rather than nothing.
const done = (say: string) => json({ kind: "done", say, prompt: "", options: [], step: "" });
const list = (prompt: string, options: string[], step: string) => json({ kind: "list", prompt, options, step, say: "" });
const text = (prompt: string, step: string) => json({ kind: "text", prompt, options: [], step, say: "" });

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function validZone(tz: string | null | undefined) {
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

// The wall-clock date in a zone, the instant its midnight began, and the
// hour now.
function dayIn(tz: string, now = new Date()) {
  const p = (t: number) =>
    Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" })
        .formatToParts(new Date(t))
        .map((x) => [x.type, x.value])
    );
  const n = p(now.getTime());
  const date = `${n.year}-${String(n.month).padStart(2, "0")}-${String(n.day).padStart(2, "0")}`;
  const offsetAt = (t: number) => {
    const x = p(t);
    return Date.UTC(+x.year, +x.month - 1, +x.day, +x.hour, +x.minute, +x.second) - t;
  };
  const guess = Date.UTC(+n.year, +n.month - 1, +n.day);
  let start = guess - offsetAt(guess);
  start = guess - offsetAt(start);
  return { date, startISO: new Date(start).toISOString(), hour: +n.hour };
}

const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const SAY_IT = "Say it…";
const ago = (iso: string) => fmtMins((Date.now() - new Date(iso).getTime()) / 60000);
const isSleep = (e: { tags?: string[] | null; category?: string | null }) => (e.tags ?? []).includes("Sleep") || e.category === "Sleep";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);

  let body: Record<string, unknown> = {};
  if (req.method === "POST") {
    try {
      body = (await req.json()) ?? {};
    } catch {
      body = {};
    }
  }
  const isApp = typeof body.api === "string" && body.api !== "";
  // The watch app reads { ok, say }; the Shortcut reads its own shape.
  const fail = (say: string) => (isApp ? json({ ok: false, say }) : done(say));

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const key = (req.headers.get("x-watch-key") ?? url.searchParams.get("key") ?? (bearer && /^[0-9a-f]{48}$/i.test(bearer) ? bearer : ""))?.trim();
  if (!key || key.length < 32) return fail("No watch key. Make one in the Hub under More, On your watch.");

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const { data: found, error: keyError } = await db.from("watch_keys").select("user_id").eq("key_hash", await sha256Hex(key)).maybeSingle();
  if (keyError) return fail("The Hub didn't answer. Try again in a minute.");
  if (!found) return fail("This watch key was turned off. Make a new one in the Hub under More, On your watch.");
  const userId = found.user_id as string;

  const { data: profile } = await db.from("profiles").select("timezone").eq("id", userId).maybeSingle();
  const tz = validZone(url.searchParams.get("tz")) ?? validZone(profile?.timezone) ?? "America/Denver";

  const health = (body as { data?: unknown }).data;
  const by = health && typeof health === "object" ? "health" : clean(body.go) === "woke" ? "wake" : isApp ? "app" : "shortcut";
  await db.from("watch_keys").update({ last_used_at: new Date().toISOString(), last_used_by: by }).eq("user_id", userId);

  try {
    if (by === "health") return await importHealth(db, userId, tz, body);
    if (by === "app") return await app(db, userId, tz, body);
    return await wrist(db, userId, tz, body);
  } catch (err) {
    console.error(err);
    if (by === "health") return json({ error: String((err as Error)?.message ?? err) }, 500);
    return fail("Something went wrong in the Hub. Try again.");
  }
});

// --- The wrist ---------------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
type DB = any;

async function running(db: DB, userId: string) {
  const { data } = await db
    .from("time_log_entries")
    .select("id, category, tags, started_at")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { id: string; category: string; tags: string[] | null; started_at: string } | null;
}

async function wrist(db: DB, userId: string, tz: string, body: Record<string, unknown>) {
  const { date, startISO, hour } = dayIn(tz);
  const step = clean(body.step, 40) || clean(body.go, 40) || "menu";
  const answer = clean(body.answer, 500) || null;

  switch (step) {
    case "menu": {
      const run = await running(db, userId);
      const options = [
        "Win",
        "Loss",
        ...(run ? [`Stop ${run.category} (${ago(run.started_at)})`] : []),
        run ? "Switch timer" : "Start timer",
        "Task done",
        "Note",
        "Today",
      ];
      if (!answer) return list("Hub", options, "menu");
      const pick = answer.toLowerCase();
      if (pick.startsWith("stop")) return wrist(db, userId, tz, { step: "stop" });
      const to = { win: "win", loss: "loss", "start timer": "start", "switch timer": "start", "task done": "task", note: "note", today: "today" }[pick];
      return wrist(db, userId, tz, { step: to ?? "menu" });
    }

    case "win": {
      if (!answer) return list("Win", [SAY_IT, ...(await winLabels(db, userId))], "win");
      if (answer === SAY_IT) return text("What's the win?", "win_say");
      return logWinLoss(db, userId, "win", answer);
    }
    case "win_say":
      return answer ? logWinLoss(db, userId, "win", answer) : done("Nothing logged.");

    case "loss":
      if (!answer) return text("What was the loss?", "loss");
      return logWinLoss(db, userId, "loss", answer);

    case "start": {
      const run = await running(db, userId);
      const cats = await categories(db, userId);
      if (!answer) return cats.length ? list(run ? `Switch from ${run.category}` : "Start", cats, "start") : text("Which category?", "start");
      return done(await startTimer(db, userId, answer, cats, run));
    }

    case "stop":
      return done(await stopTimer(db, userId));

    case "task": {
      const tasks = await todayTasks(db, userId, date);
      if (!tasks.length) return done("Nothing open on Today. Pick some on Quests.");
      if (!answer) return list("Done", tasks.map((t) => t.label), "task");
      const t = tasks.find((x) => x.label === answer);
      if (!t) return done("That one's not on Today any more.");
      return done(await markDone(db, userId, date, t, tasks.length - 1));
    }

    case "note": {
      if (!answer) return text("Say the note", "note");
      return done(await keepNote(db, userId, date, answer));
    }

    case "today":
      return done(await todayLine(db, userId, date, startISO));

    case "woke":
      return done(await woke(db, userId, tz, date, hour));
  }
  return wrist(db, userId, tz, { step: "menu" });
}

async function logWinLoss(db: DB, userId: string, kind: "win" | "loss", label: string) {
  return done(await saveWinLoss(db, userId, kind, label));
}

// --- What the Shortcut and the app both do -----------------------------------------------------
// Each answers with the line to show.

async function saveWinLoss(db: DB, userId: string, kind: "win" | "loss", label: string) {
  const { error } = await db.from("win_losses").insert({ user_id: userId, kind, habit_label: label.slice(0, 120) });
  if (error) throw error;
  return kind === "win" ? `⚔ Win: ${label}` : `Loss logged: ${label}`;
}

type Run = Awaited<ReturnType<typeof running>>;

async function startTimer(db: DB, userId: string, answer: string, cats: string[], run: Run) {
  const cat = cats.find((c) => c.toLowerCase() === answer.toLowerCase()) ?? answer.slice(0, 60);
  if (run && run.category === cat) return `${cat} is already running (${ago(run.started_at)}).`;
  if (run) {
    await db
      .from("time_log_entries")
      .update({ ended_at: new Date().toISOString(), ended_by: cat === "Sleep" ? "bedtime" : "stop" })
      .eq("id", run.id);
  }
  const { error } = await db
    .from("time_log_entries")
    .insert({ user_id: userId, category: cat, tags: [cat], started_at: new Date().toISOString(), source: "watch" });
  if (error) throw error;
  return run ? `${run.category} stopped at ${ago(run.started_at)}. ${cat} started.` : `${cat} started.`;
}

async function stopTimer(db: DB, userId: string) {
  const run = await running(db, userId);
  if (!run) return "Nothing is running.";
  const { error } = await db.from("time_log_entries").update({ ended_at: new Date().toISOString(), ended_by: "stop" }).eq("id", run.id);
  if (error) throw error;
  return isSleep(run) ? `Up. Slept ${ago(run.started_at)}.` : `${run.category} stopped. ${ago(run.started_at)}.`;
}

async function markDone(db: DB, userId: string, date: string, t: { id: string; table: string; text: string }, left: number) {
  const now = new Date().toISOString();
  const { error } =
    t.table === "quest_tasks"
      ? await db.from("quest_tasks").update({ done_on: date, done_at: now, working_since: null, updated_at: now }).eq("id", t.id).eq("user_id", userId)
      : await db.from("camp_steps").update({ done_on: date, working_since: null, updated_at: now }).eq("id", t.id).eq("user_id", userId);
  if (error) throw error;
  return `Done: ${t.text}. ${left ? `${left} left today.` : "Today is clear."}`;
}

async function keepNote(db: DB, userId: string, date: string, answer: string) {
  const first = answer.length > 80 ? `${answer.slice(0, 77).replace(/\s+\S*$/, "")}…` : answer;
  const { error } = await db.from("study_notes").insert({
    user_id: userId,
    title: first,
    body: answer,
    note_kind: "thought",
    source_kind: "other",
    source_ref: "Apple Watch",
    studied_on: date,
    tags: [],
    position: 0,
  });
  if (error) throw error;
  return "Kept on your board.";
}

// --- The watch app -----------------------------------------------------------------------------

async function app(db: DB, userId: string, tz: string, body: Record<string, unknown>) {
  const { date, startISO } = dayIn(tz);
  const api = clean(body.api, 20);
  const reply = (say: string, ok = true) => json({ ok, say });
  const label = clean(body.label, 120) || clean(body.text, 500);

  switch (api) {
    case "today":
      return json(await appToday(db, userId, tz, date, startISO));
    case "glance":
      return json(await appGlance(db, userId, tz, date, startISO));
    case "start": {
      const cat = clean(body.category, 60);
      if (!cat) return reply("Pick a category.", false);
      return reply(await startTimer(db, userId, cat, await categories(db, userId), await running(db, userId)));
    }
    case "stop":
      return reply(await stopTimer(db, userId));
    case "win":
    case "loss":
      if (!label) return reply("Nothing logged.", false);
      return reply(await saveWinLoss(db, userId, api, label));
    case "done": {
      const id = clean(body.id, 60);
      const tasks = await todayTasks(db, userId, date);
      const t = tasks.find((x) => x.id === id);
      if (!t) return reply("That one's not on Today any more.", false);
      return reply(await markDone(db, userId, date, t, tasks.length - 1));
    }
    case "note": {
      const said = clean(body.text, 2000);
      if (!said) return reply("Nothing kept.", false);
      return reply(await keepNote(db, userId, date, said));
    }
  }
  return reply("The Hub doesn't know that yet. Update the watch app.", false);
}

// The time of day in a zone, "HH:MM".
const clockIn = (tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());

async function dayCounts(db: DB, userId: string, startISO: string) {
  const [wl, entries] = await Promise.all([
    db.from("win_losses").select("kind").eq("user_id", userId).gte("occurred_at", startISO).limit(500),
    db
      .from("time_log_entries")
      .select("category, tags, started_at, ended_at, duration_minutes")
      .eq("user_id", userId)
      .or(`started_at.gte."${startISO}",ended_at.gte."${startISO}"`)
      .limit(500),
  ]);
  if (wl.error) throw wl.error;
  if (entries.error) throw entries.error;
  const wins = (wl.data ?? []).filter((r: { kind: string }) => r.kind === "win").length;
  const losses = (wl.data ?? []).length - wins;
  type E = { category: string; tags: string[] | null; started_at: string; ended_at: string | null; duration_minutes: number | null };
  const all = (entries.data ?? []) as E[];
  const startedToday = all.filter((e) => Date.parse(e.started_at) >= Date.parse(startISO));
  const minutes = Math.round(startedToday.filter((e) => e.ended_at).reduce((s, e) => s + (Number(e.duration_minutes) || 0), 0));
  return { wins, losses, minutes, startedToday, all };
}

async function appGlance(db: DB, userId: string, tz: string, date: string, startISO: string) {
  const [counts, run, chunks] = await Promise.all([
    dayCounts(db, userId, startISO),
    running(db, userId),
    db.from("time_chunks").select("title, category, start_time, end_time").eq("user_id", userId).eq("date", date).limit(100),
  ]);
  const block = blockAt(planOf(chunks.data ?? []), clockIn(tz));
  return {
    wins: counts.wins,
    losses: counts.losses,
    minutes: counts.minutes,
    running: run ? { category: run.category, startedAt: ms(run.started_at) } : null,
    block,
  };
}

async function appToday(db: DB, userId: string, tz: string, date: string, startISO: string) {
  const [counts, run, chunks, tasks, focus, targets, lesson, workingLine, workingStep, habits, cats] = await Promise.all([
    dayCounts(db, userId, startISO),
    running(db, userId),
    db.from("time_chunks").select("title, category, start_time, end_time").eq("user_id", userId).eq("date", date).limit(100),
    todayTasks(db, userId, date),
    db.from("focus_goals").select("week_start, title, position").eq("user_id", userId).lte("week_start", date).order("week_start", { ascending: false }).limit(30),
    db.from("weekly_targets").select("label, categories, minutes, period, position, active").eq("user_id", userId).eq("active", true),
    db.from("lessons").select("title").eq("user_id", userId).eq("status", "learning").order("position").limit(1).maybeSingle(),
    db.from("quest_tasks").select("text, working_since").eq("user_id", userId).not("working_since", "is", null).order("working_since", { ascending: false }).limit(1).maybeSingle(),
    db.from("camp_steps").select("text, working_since").eq("user_id", userId).not("working_since", "is", null).order("working_since", { ascending: false }).limit(1).maybeSingle(),
    winLabels(db, userId),
    categories(db, userId),
  ]);
  const plan = planOf(chunks.data ?? []);
  const working = [workingLine.data, workingStep.data]
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.working_since) - Date.parse(a.working_since))[0];
  return {
    date,
    wins: counts.wins,
    losses: counts.losses,
    minutes: counts.minutes,
    running: run ? { category: run.category, startedAt: ms(run.started_at) } : null,
    plan,
    block: blockAt(plan, clockIn(tz)),
    tasks: tasks.map((t) => ({ id: t.id, text: t.text, quest: t.quest })),
    working: working ? { text: String(working.text ?? "").replace(/\s+/g, " ").trim(), since: ms(working.working_since) } : null,
    focus: focusWeek(focus.data ?? [], date),
    lesson: lesson.data?.title ?? null,
    targets: targetsToday(targets.data ?? [], counts.startedToday),
    slept: sleptLast(counts.all, startISO),
    habits,
    categories: cats,
  };
}

// Your habits first, then the wins you log most (twice or more in the last
// 30 days), the way the app's one-tap chips pick them.
async function winLabels(db: DB, userId: string) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [habits, wins] = await Promise.all([
    db.from("watched_habits").select("label").eq("user_id", userId).eq("active", true).order("position"),
    db.from("win_losses").select("habit_label").eq("user_id", userId).eq("kind", "win").gte("occurred_at", since).order("occurred_at", { ascending: false }).limit(1000),
  ]);
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (l: string) => {
    const k = l.toLowerCase().replace(/\s+/g, " ").trim();
    if (!k || k === "win" || seen.has(k)) return;
    seen.add(k);
    out.push(l.trim());
  };
  for (const h of habits.data ?? []) add(h.label ?? "");
  const counts = new Map<string, { label: string; n: number }>();
  for (const w of wins.data ?? []) {
    const l = (w.habit_label ?? "").trim();
    const k = l.toLowerCase().replace(/\s+/g, " ");
    if (!k || k === "win") continue;
    const c = counts.get(k) ?? { label: l, n: 0 };
    c.n += 1;
    counts.set(k, c);
  }
  for (const c of [...counts.values()].filter((c) => c.n >= 2).sort((a, b) => b.n - a.n)) add(c.label);
  return out.slice(0, 12);
}

// Your categories, the ones you've used most in the last month first.
async function categories(db: DB, userId: string) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [cats, used] = await Promise.all([
    db.from("user_categories").select("name, position").eq("user_id", userId).eq("archived", false).order("position"),
    db.from("time_log_entries").select("category").eq("user_id", userId).gte("started_at", since).limit(2000),
  ]);
  const n = new Map<string, number>();
  for (const e of used.data ?? []) n.set(e.category, (n.get(e.category) ?? 0) + 1);
  const names = [...new Set((cats.data ?? []).map((c: { name: string }) => c.name))] as string[];
  return names.sort((a, b) => (n.get(b) ?? 0) - (n.get(a) ?? 0));
}

type TodayTask = { id: string; table: "quest_tasks" | "camp_steps"; text: string; label: string; quest: string | null };

// What's open on Today: steps picked for today (or in a section picked for
// today) and quest lines picked for today or written today.
async function todayTasks(db: DB, userId: string, date: string): Promise<TodayTask[]> {
  const { data: sectionRows, error: secError } = await db.from("camp_sections").select("id").eq("user_id", userId).eq("today_on", date);
  if (secError) throw secError;
  const pickedSections = new Set((sectionRows ?? []).map((s: { id: string }) => s.id));
  const stepFilter = pickedSections.size ? `today_on.eq.${date},section_id.in.(${[...pickedSections].join(",")})` : `today_on.eq.${date}`;
  const [quests, lines, steps, camps] = await Promise.all([
    db.from("quests").select("id, title, position").eq("user_id", userId),
    db
      .from("quest_tasks")
      .select("id, quest_id, text, position, day, ongoing, today_on")
      .eq("user_id", userId)
      .eq("kind", "task")
      .is("done_on", null)
      .or(`today_on.eq.${date},and(day.eq.${date},ongoing.is.false)`)
      .limit(200),
    db.from("camp_steps").select("id, camp_id, section_id, text, position, today_on, kind").eq("user_id", userId).is("done_on", null).or(stepFilter).limit(500),
    db.from("quest_camps").select("id, quest_id").eq("user_id", userId),
  ]);
  for (const r of [quests, lines, steps, camps]) if (r.error) throw r.error;
  const questOf = new Map((camps.data ?? []).map((c: { id: string; quest_id: string }) => [c.id, c.quest_id]));
  const qpos = new Map((quests.data ?? []).map((q: { id: string; position: number }) => [q.id, q.position ?? 0]));
  const qname = new Map((quests.data ?? []).map((q: { id: string; title: string }) => [q.id, q.title]));

  const rows: { id: string; table: TodayTask["table"]; text: string; quest: string | null; pos: number }[] = [];
  for (const s of steps.data ?? []) {
    if (s.kind === "note") continue;
    if (s.today_on !== date && !(s.section_id && pickedSections.has(s.section_id))) continue;
    rows.push({ id: s.id, table: "camp_steps", text: s.text, quest: questOf.get(s.camp_id) ?? null, pos: s.position ?? 0 });
  }
  for (const l of lines.data ?? []) rows.push({ id: l.id, table: "quest_tasks", text: l.text, quest: l.quest_id, pos: l.position ?? 0 });
  rows.sort((a, b) => (qpos.get(a.quest ?? "") ?? 99) - (qpos.get(b.quest ?? "") ?? 99) || a.pos - b.pos);

  const seen = new Map<string, number>();
  return rows.slice(0, 30).map((r) => {
    const short = r.text.replace(/\s+/g, " ").trim();
    let label = short.length > 60 ? `${short.slice(0, 57)}…` : short;
    const quest = r.quest ? qname.get(r.quest) : null;
    if (quest) label = `${label} · ${quest.length > 18 ? `${quest.slice(0, 17)}…` : quest}`;
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    if (n > 1) label = `${label} (${n})`;
    return { id: r.id, table: r.table, text: short, label, quest: quest ? String(quest) : null };
  });
}

async function todayLine(db: DB, userId: string, date: string, startISO: string) {
  const [wl, entries, run, tasks, day] = await Promise.all([
    db.from("win_losses").select("kind").eq("user_id", userId).gte("occurred_at", startISO).limit(500),
    db.from("time_log_entries").select("duration_minutes").eq("user_id", userId).gte("started_at", startISO).not("ended_at", "is", null).limit(500),
    running(db, userId),
    todayTasks(db, userId, date),
    db.from("health_days").select("asleep_min, steps").eq("user_id", userId).eq("date", date).maybeSingle(),
  ]);
  const wins = (wl.data ?? []).filter((r: { kind: string }) => r.kind === "win").length;
  const losses = (wl.data ?? []).length - wins;
  const mins = (entries.data ?? []).reduce((s: number, e: { duration_minutes: number }) => s + (Number(e.duration_minutes) || 0), 0);
  const parts = [`⚔ ${wins} ${wins === 1 ? "win" : "wins"}${losses ? `, ${losses} ${losses === 1 ? "loss" : "losses"}` : ""}`, `${fmtMins(mins)} tracked`];
  if (run) parts.push(`${run.category} running ${ago(run.started_at)}`);
  parts.push(tasks.length ? `${tasks.length} open on Today` : "Today is clear");
  if (day.data?.asleep_min) parts.push(`slept ${fmtMins(day.data.asleep_min)}`);
  return parts.join(" · ");
}

// Up for the day. Before 2 a.m. or after noon it's not a wake-up.
async function woke(db: DB, userId: string, tz: string, date: string, hour: number) {
  if (hour < 2 || hour >= 12) return "Not counted as waking up (only between 2 a.m. and noon).";
  const now = new Date().toISOString();
  const run = await running(db, userId);
  let slept = "";
  if (run && isSleep(run)) {
    await db.from("time_log_entries").update({ ended_at: now, ended_by: "stop" }).eq("id", run.id);
    slept = ` Slept ${ago(run.started_at)}.`;
  }
  const { data: day } = await db.from("health_days").select("woke_at").eq("user_id", userId).eq("date", date).maybeSingle();
  if (!day) await db.from("health_days").insert({ user_id: userId, date, woke_at: now });
  else if (!day.woke_at) await db.from("health_days").update({ woke_at: now, updated_at: now }).eq("user_id", userId).eq("date", date);
  const clock = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date());
  return `Up at ${clock}.${slept}`;
}

// --- Health Auto Export ------------------------------------------------------------------------

async function importHealth(db: DB, userId: string, tz: string, body: Record<string, unknown>) {
  const read = readHealthPayload(body, tz);
  const dates = Object.keys(read.days);
  const result = { ...read.counts, unknown: read.unknown, sleepAdded: 0, sleepEnded: 0, workoutsAdded: 0, workoutsLinked: 0 };

  // Days: merged over what's there.
  if (dates.length) {
    const { data: old, error } = await db.from("health_days").select("*").eq("user_id", userId).in("date", dates);
    if (error) throw error;
    const byDate = new Map((old ?? []).map((r: { date: string }) => [String(r.date).slice(0, 10), r]));
    const rows = dates.map((date) => {
      const merged = mergeDay(byDate.get(date), read.days[date]);
      const row: Record<string, unknown> = { user_id: userId, date, extra: merged.extra ?? {}, updated_at: new Date().toISOString() };
      for (const col of [...HEALTH_COLUMNS, "sleep_start", "sleep_end", "asleep_min", "deep_min", "rem_min", "core_min", "awake_min", "in_bed_min"]) {
        if (merged[col] != null) row[col] = merged[col];
      }
      return row;
    });
    const { error: upError } = await db.from("health_days").upsert(rows, { onConflict: "user_id,date" });
    if (upError) throw upError;

    // A weigh-in from the scale goes where the app's weigh-ins go, once a day.
    const weighed = rows.filter((r) => r.weight_lb);
    if (weighed.length) {
      const { data: had } = await db.from("body_metrics").select("date").eq("user_id", userId).eq("kind", "weight").in("date", weighed.map((r) => r.date));
      const have = new Set((had ?? []).map((r: { date: string }) => String(r.date).slice(0, 10)));
      const add = weighed
        .filter((r) => !have.has(r.date as string))
        .map((r) => ({ user_id: userId, kind: "weight", value: Math.round(Number(r.weight_lb) * 10) / 10, unit: "lb", date: r.date, measured_at: `${r.date}T12:00:00Z` }));
      if (add.length) await db.from("body_metrics").insert(add);
    }
  }

  // Nights into the minutes log.
  for (const night of read.nights) {
    const from = new Date(night.start.getTime() - 24 * 3600000).toISOString();
    const { data: around } = await db
      .from("time_log_entries")
      .select("id, category, tags, started_at, ended_at")
      .eq("user_id", userId)
      .gte("started_at", from)
      .lte("started_at", night.end.toISOString())
      .limit(200);
    const act = sleepAction(night, around ?? []);
    if (act.kind === "end") {
      await db.from("time_log_entries").update({ ended_at: act.at, ended_by: "stop" }).eq("id", act.id).is("ended_at", null);
      result.sleepEnded++;
    } else if (act.kind === "add") {
      const { error } = await db
        .from("time_log_entries")
        .insert({ user_id: userId, category: "Sleep", tags: ["Sleep"], started_at: act.start, ended_at: act.end, source: "watch" });
      if (error) throw error;
      result.sleepAdded++;
    }
  }

  // Workouts: one row each, and an Exercise entry unless one is logged.
  if (read.workouts.length) {
    const { data: known } = await db.from("health_workouts").select("external_id, time_entry_id").eq("user_id", userId).in("external_id", read.workouts.map((w) => w.external_id));
    const have = new Map((known ?? []).map((k: { external_id: string; time_entry_id: string | null }) => [k.external_id, k.time_entry_id]));
    for (const w of read.workouts) {
      if (have.has(w.external_id) && have.get(w.external_id)) continue;
      const { data: around } = await db
        .from("time_log_entries")
        .select("id, category, tags, started_at, ended_at")
        .eq("user_id", userId)
        .gte("started_at", new Date(new Date(w.started_at).getTime() - 12 * 3600000).toISOString())
        .lte("started_at", w.ended_at)
        .limit(200);
      const act = workoutAction(w, around ?? []);
      let entryId: string | null = null;
      if (act.kind === "link") {
        entryId = act.id;
        result.workoutsLinked++;
      } else {
        const { data: made, error } = await db.from("time_log_entries").insert(exerciseEntry(userId, w)).select("id").single();
        if (error) throw error;
        entryId = made.id;
        result.workoutsAdded++;
      }
      const { kind: _kind, ...row } = w;
      const { error } = await db.from("health_workouts").upsert({ ...row, user_id: userId, time_entry_id: entryId }, { onConflict: "user_id,external_id" });
      if (error) throw error;
    }
  }

  // The payload as it came (unless it's huge), and only the last 20.
  const raw = JSON.stringify(body);
  await db.from("health_imports").insert({ user_id: userId, summary: result, payload: raw.length < 900_000 ? body : null });
  const { data: old } = await db.from("health_imports").select("id").eq("user_id", userId).order("received_at", { ascending: false }).range(20, 200);
  if (old?.length) await db.from("health_imports").delete().in("id", old.map((r: { id: number }) => r.id));

  return json({ ok: true, ...result });
}
