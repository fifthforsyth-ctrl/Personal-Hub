#!/usr/bin/env node
//
// Generates weeks of realistic example data so the analytics, month/year
// grids, and open-loop queue can be judged with real volume behind them
// instead of three rows.
//
// EVERY row it writes carries is_example = true. Remove all of it with:
//   node scripts/seed-example-data.mjs --purge
//
// The category mix and weekly totals come from a real week of tracking, so
// the shapes (heaviest on Sleep and Serve, a thin tail of Waste) match how
// the days actually go rather than being invented.
//
// Usage:
//   node scripts/seed-example-data.mjs --weeks 8
//   node scripts/seed-example-data.mjs --purge

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = "https://bfednxteqhjljqdfdvsq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZWRueHRlcWhqbGpxZGZkdnNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTM1NTgsImV4cCI6MjEwMzQyOTU1OH0.Tft8vrFtjWnM-gVWD40IZVnrRqS99ivPq8W7H4qi50M";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const WEEKS = Number(arg("weeks", "8"));
const PURGE = process.argv.includes("--purge");
// --sql prints INSERT statements instead of writing, so the seed can be
// applied through any SQL console without the script holding credentials.
const SQL_ONLY = process.argv.includes("--sql");
const SQL_USER_ID = arg("user-id", null);

// Deterministic PRNG so a re-seed produces the same week shapes — makes it
// possible to compare screenshots across runs.
let seed = 20260827;
function rand() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
const jitter = (base, pct) => Math.max(1, Math.round(base * (1 + (rand() * 2 - 1) * pct)));
const pick = (arr) => arr[Math.floor(rand() * arr.length) % arr.length];

// Weekly minutes from the real tracked week, with the typical start hour and
// how the block usually gets split across a day. `spread` is how many
// separate entries the category tends to produce.
const CATEGORIES = [
  { category: "Sleep", weekly: 3146, startHours: [22, 23], spread: 1, subs: [] },
  { category: "Serve", weekly: 3005, startHours: [10, 13, 15, 18], spread: 4, subs: ["Finding", "Teaching", "Service project", "Follow-up"] },
  { category: "Minister", weekly: 1310, startHours: [11, 16, 19], spread: 3, subs: ["Visits", "Calls", "Referrals"] },
  { category: "Study", weekly: 854, startHours: [7, 8, 20], spread: 2, subs: ["Personal", "Companionship", "Language"] },
  { category: "Drive", weekly: 757, startHours: [9, 14, 17, 20], spread: 4, subs: [] },
  { category: "Prep", weekly: 601, startHours: [6, 9], spread: 2, subs: ["Morning routine", "Lesson prep"] },
  { category: "Meals", weekly: 429, startHours: [8, 12, 18], spread: 3, subs: [] },
  { category: "Plan", weekly: 354, startHours: [6, 21], spread: 2, subs: ["Daily", "Weekly"] },
  { category: "Draw", weekly: 328, startHours: [21], spread: 1, subs: ["Sketchbook"] },
  { category: "Exercise", weekly: 235, startHours: [6], spread: 1, subs: ["Lifting", "Cardio"] },
  { category: "Meeting", weekly: 254, startHours: [10, 14], spread: 1, subs: ["District", "Zone", "Coordination"] },
  { category: "Other", weekly: 16, startHours: [15], spread: 1, subs: [] },
  { category: "Waste", weekly: 15, startHours: [21], spread: 1, subs: [] },
];

const DESCRIPTIONS = {
  Serve: ["door approaches on Center St", "lesson with the Alvarez family", "service at the food bank", "follow-up visits", "street contacting downtown"],
  Minister: ["checked in with Brother Hansen", "ministering calls", "visited the Reyes family", "referral follow-up"],
  Study: ["Come Follow Me — Alma", "Preach My Gospel ch. 3", "companion study", "language study"],
  Prep: ["morning routine", "prepped tomorrow's lessons", "packed for the day"],
  Plan: ["weekly planning session", "planned tomorrow"],
  Draw: ["sketchbook pages", "portrait practice"],
  Exercise: ["lifting", "run", "circuit"],
  Meeting: ["district council", "zone conference", "coordination meeting"],
  Waste: ["got distracted on my phone"],
  Other: ["misc"],
};

const WIN_HABITS = ["Wake up on time", "Cold shower", "Daily study", "Track time", "Plan and Report", "Daily exercise", "No unintentional caffiene"];
const PRAYER_CONTEXTS = ["Morning", "Before the day's appointments", "Evening", "After a hard lesson", "Companionship prayer"];
const PRAYER_CONTENT = [
  "Asked for help knowing who to visit today. Felt a name come to mind almost immediately.",
  "Prayed about a family who isn't progressing, and whether to keep visiting.",
  "Gratitude — for a good day and for a companion who works hard.",
  "Asked for patience with myself. Alma 32:21 came to mind about faith not being a perfect knowledge.",
  "Prayed for direction on how to spend the week. Felt to focus on the less-active list.",
];
const PROMPTINGS = [
  "Felt I should stop and talk to the man at the bus stop",
  "Impression to call Brother Hansen — hadn't thought of him in weeks",
  "Kept coming back to the idea of visiting the Reyes family again",
  "Felt to slow down and actually listen instead of teaching over them",
  "Impression that I should write my grandmother",
  "Felt prompted to apologize to my companion before the day started",
  "Strong feeling to take the long way and knock the street we skipped",
];
const ACTIONS = [
  "Stopped and talked with him for ten minutes.",
  "Called him that evening.",
  "Went back Thursday.",
  "Let them talk for most of the lesson.",
  "Wrote the letter that night.",
];
const FOLLOWUPS = [
  "He wasn't interested but thanked us for stopping. Glad I did it anyway.",
  "He'd had a hard week and said the timing was uncanny.",
  "They let us in this time. Completely different conversation.",
  "Learned more in that hour than in the last three lessons I gave.",
  "She wrote back. Said it came on a day she needed it.",
];

const CHUNK_TITLES = [
  { title: "Morning routine", start: "06:30", end: "08:00", tasks: ["Cold shower", "Exercise", "Get ready"] },
  { title: "Personal study", start: "08:00", end: "09:00", tasks: ["Come Follow Me", "Journal the impression"] },
  { title: "Companionship study", start: "09:00", end: "10:00", tasks: ["Review the teaching pool", "Practice a lesson"] },
  { title: "Finding", start: "10:00", end: "12:00", tasks: ["Center St doors", "Follow up on referrals"] },
  { title: "Appointments", start: "13:00", end: "17:00", tasks: ["Alvarez family", "Reyes family", "Brother Hansen"] },
  { title: "Ministering", start: "17:00", end: "19:00", tasks: ["Less-active list", "Calls"] },
  { title: "Planning", start: "20:30", end: "21:00", tasks: ["Plan tomorrow", "Update records"] },
];
const ENERGY = ["Open day", "Heavy edit day", "Deep focus", "Recovery day"];

function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function at(day, hour, minute = 0) {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  let supabase = null;
  let userId = SQL_USER_ID;

  if (!SQL_ONLY) {
    const email = process.env.HUB_EMAIL;
    const password = process.env.HUB_PASSWORD;
    if (!email || !password) {
      console.error("Set HUB_EMAIL and HUB_PASSWORD (see scripts/README.md), or use --sql --user-id <uuid>.");
      process.exit(1);
    }

    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      console.error("Sign-in failed:", authError.message);
      process.exit(1);
    }
    userId = auth.user.id;
  } else if (!userId) {
    console.error("--sql requires --user-id <uuid>.");
    process.exit(1);
  }

  if (PURGE) {
    const { data, error } = await supabase.rpc("purge_example_data");
    if (error) throw error;
    console.log(`Removed ${data} example rows. Your real entries are untouched.`);
    await supabase.auth.signOut();
    return;
  }

  const timeEntries = [];
  const winLosses = [];
  const prayers = [];
  const experiences = [];
  const dayPlans = [];
  const chunkSpecs = []; // chunks need ids back before their tasks can be written

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let dayOffset = WEEKS * 7; dayOffset >= 1; dayOffset--) {
    const day = new Date(today);
    day.setDate(day.getDate() - dayOffset);
    const dow = day.getDay();
    const isSunday = dow === 0;
    const isPday = dow === 1; // preparation day — different shape entirely

    // A couple of deliberately sparse days, because a real record has gaps
    // and the month grid should show them.
    if (rand() < 0.06) continue;

    for (const cat of CATEGORIES) {
      let dailyBase = cat.weekly / 7;
      if (isSunday && ["Serve", "Minister", "Drive"].includes(cat.category)) dailyBase *= 0.45;
      if (isSunday && cat.category === "Meeting") dailyBase *= 2.6;
      if (isPday && ["Serve", "Minister"].includes(cat.category)) dailyBase *= 0.35;
      if (isPday && ["Draw", "Other", "Prep"].includes(cat.category)) dailyBase *= 2.2;
      if (dailyBase < 3) continue;

      const pieces = Math.max(1, Math.min(cat.spread, Math.round(dailyBase / 45) || 1));
      for (let p = 0; p < pieces; p++) {
        const minutes = jitter(dailyBase / pieces, 0.3);
        if (minutes < 3) continue;
        const hour = cat.startHours[p % cat.startHours.length];
        const started = at(day, hour, Math.floor(rand() * 50));
        const ended = new Date(started.getTime() + minutes * 60000);
        timeEntries.push({
          user_id: userId,
          category: cat.category,
          subcategory: cat.subs.length ? pick(cat.subs) : null,
          description: DESCRIPTIONS[cat.category] ? pick(DESCRIPTIONS[cat.category]) : null,
          started_at: started.toISOString(),
          ended_at: ended.toISOString(),
          tags: [],
          is_example: true,
        });
      }
    }

    // Wins and losses — mostly wins, with the occasional honest miss.
    for (const habit of WIN_HABITS) {
      if (rand() < 0.72) {
        const isWin = rand() < (habit === "No unintentional caffiene" ? 0.62 : 0.84);
        winLosses.push({
          user_id: userId,
          occurred_at: at(day, 21, Math.floor(rand() * 50)).toISOString(),
          kind: isWin ? "win" : "loss",
          habit_label: habit,
          note: null,
          is_example: true,
        });
      }
    }

    if (rand() < 0.85) {
      prayers.push({
        user_id: userId,
        prayed_at: at(day, rand() < 0.5 ? 7 : 21, Math.floor(rand() * 50)).toISOString(),
        context: pick(PRAYER_CONTEXTS),
        content: pick(PRAYER_CONTENT),
        felt_response: rand() < 0.55 ? "A clear sense of who to go see first." : null,
        tags: [],
        is_example: true,
      });
    }

    // Promptings — most get closed out, a few deliberately left open so the
    // open-loop queue has something in it.
    if (rand() < 0.34) {
      const closed = rand() < 0.7;
      experiences.push({
        user_id: userId,
        occurred_at: at(day, 9 + Math.floor(rand() * 11), Math.floor(rand() * 50)).toISOString(),
        kind: pick(["prompting", "impression", "answer", "tender_mercy", "comfort", "insight"]),
        what_came: pick(PROMPTINGS),
        trigger_context: rand() < 0.5 ? "Mid-morning, walking between appointments" : null,
        acted_on: closed,
        acted_on_at: closed ? at(day, 21).toISOString() : null,
        action_taken: closed ? pick(ACTIONS) : null,
        follow_up_notes: closed ? pick(FOLLOWUPS) : null,
        tags: [],
        is_example: true,
      });
    }

    // Planned days for roughly the last three weeks, so Plan has depth
    // without every month in the year view being uniformly full.
    if (dayOffset <= 21 && !isSunday) {
      dayPlans.push({ user_id: userId, date: dateStr(day), energy_tag: pick(ENERGY), is_example: true });
      for (const spec of CHUNK_TITLES) {
        if (rand() < 0.25) continue;
        // id generated here rather than read back after insert, so the SQL
        // path and the API path build identical rows.
        const chunkId = randomUUID();
        chunkSpecs.push({
          row: {
            id: chunkId,
            user_id: userId,
            date: dateStr(day),
            start_time: spec.start,
            end_time: spec.end,
            title: spec.title,
            is_example: true,
          },
          tasks: spec.tasks.filter(() => rand() < 0.8),
          date: dateStr(day),
          chunkId,
        });
      }
    }
  }

  const chunkRows = chunkSpecs.map((c) => c.row);
  const taskRows = [];
  for (const spec of chunkSpecs) {
    spec.tasks.forEach((title, position) => {
      taskRows.push({
        user_id: userId,
        date: spec.date,
        time_chunk_id: spec.chunkId,
        title,
        status: rand() < 0.76,
        position,
        is_example: true,
      });
    });
  }

  const tables = [
    ["time_log_entries", timeEntries, "time entries"],
    ["win_losses", winLosses, "wins / losses"],
    ["prayer_logs", prayers, "prayers"],
    ["spiritual_experiences", experiences, "promptings"],
    ["day_plans", dayPlans, "day plans"],
    ["time_chunks", chunkRows, "time blocks"],
    ["tasks", taskRows, "tasks"],
  ];

  if (SQL_ONLY) {
    for (const [table, rows] of tables) {
      if (rows.length === 0) continue;
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      for (let i = 0; i < rows.length; i += 200) {
        const batch = rows.slice(i, i + 200);
        const values = batch
          .map((r) => "(" + cols.map((c) => sqlLiteral(r[c])).join(", ") + ")")
          .join(",\n  ");
        console.log(`insert into public.${table} (${cols.join(", ")}) values\n  ${values};\n`);
      }
    }
    return;
  }

  console.log(`Seeding ${WEEKS} weeks of example data…\n`);
  for (const [table, rows, label] of tables) {
    if (rows.length === 0) continue;
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from(table).insert(rows.slice(i, i + 500));
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    console.log(`  ${String(rows.length).padStart(5)} ${label}`);
  }

  console.log(`\nDone. Remove all of it any time with:\n  node scripts/seed-example-data.mjs --purge`);
  await supabase.auth.signOut();
}

function sqlLiteral(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.length === 0 ? "'{}'" : `'{${v.map((x) => `"${String(x).replace(/"/g, '\\"')}"`).join(",")}}'`;
  return "'" + String(v).replace(/'/g, "''") + "'";
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
