// Full control for the mic in the Hub (Aaron, 2026-11-28): "the assistant
// that pops up with the mic needs to have complete control with all the
// tools, and be able to have context of what each tab is for, so that way i
// can ask it to do anything i would do."
//
// Rather than one hand-made tool per button (which would fall behind every
// time a tab changes), the assistant gets what the app itself uses: his
// tables and the database functions the pages call. Everything runs with
// HIS session token, so row-level security keeps it to his own rows exactly
// as the pages are kept to them; the service role is never used here.
//
//   look_up          one read-only SELECT (ask_select, the Ask tab's reader)
//   describe_tables  what tables, columns and functions exist right now,
//                    with the comments the migrations wrote on them
//   add_rows         insert
//   change_rows      update the rows matching column = value pairs
//   delete_rows      delete them
//   call_function    a database function the app calls (log_spend,
//                    money_set_aside, apply_plan_template, ...)
//   open_tab         take him to a page
//
// Guards: writes need a match (never a whole table), touch at most 25 rows,
// and never reach the key tables. Rows changed or deleted are written to
// the function's log first, so a mistake can be put back by hand.
//
// Only the Hub in a browser (a signed-in session) gets these. A watch key
// keeps the small fixed tool set in voice.ts.

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

// deno-lint-ignore no-explicit-any
type Any = any;

const NAME = /^[a-z_][a-z0-9_]{0,62}$/;
const MAX_ROWS = 25;
// Keys and plumbing: reading is fine, writing is not the assistant's job.
const WRITE_BLOCKED = new Set([
  "watch_keys",
  "widget_keys",
  "temple_sync_keys",
  "push_subscriptions",
  "health_imports",
  "love_members",
  "ask_conversations",
]);
const CALL_BLOCKED = new Set(["ask_select", "run_readonly_select", "new_watch_key", "new_widget_key", "new_temple_sync_key"]);

export const TAB_GUIDE = `The Hub's tabs (the layout is being reworked, so if a page or table isn't where this says, use describe_tables and look):
- Today (/): the page he opens all day. This week's focus targets on top, the Win button, minutes tracked today and the running timer, today's plan (blocks with their tasks), his walk with God (daily_walk, prayer_logs), the week's quote, and the button to the evening. Tables: time_log_entries (timers), win_losses (wins and losses), day_plans, time_chunks (today's planned blocks), focus_goals.
- Evening (/evening): the nightly reflection, then "bank the day". Wins and losses, where the hours went, the reflection questions (journal_entries: gods_hand, q_savior, q_learn, thoughts), an arrow per weekly focus (focus_checks), tonight's shots per target (mark_shots), mood 1-10 (day_plans.mood_10), communication with God, when tomorrow starts.
- Week (/plan, /plan/day/<date>, /plan/week/<date>): the schedule planner. Blocks are time_chunks (date, start_time, end_time, title, category, color); repeating ones are standing_blocks; saved day layouts are plan_templates with template_chunks. The week's focus goals are focus_goals (week_start = that Sunday).
- Tasks (/tasks): projects (quests rows; is_list true = a plain list, false = a quest that's also a target), each with targets/camps (quest_camps), columns/sections (camp_sections; clipboard true = a clipboard column), and steps/tasks in them (camp_steps: text, kind 'task'|'note', today_on = picked for that day, done_on = finished). quest_tasks are a quest's own lines (today/ongoing). Columns made on the Tasks home belong to no project.
- Targets (/targets): the ladder. His mission (missions), lifetime goals (nodes, the goal wheel's top goals), quests and lessons (quests, lessons) with their camps, and weekly focus (focus_goals, focuses). The Range: mark_targets, mark_aims (what each target checks), mark_shots (each evening's arrows). Notes on a target: target_notes.
- Board (/study): the cork board. Thoughts and notes he keeps (study_notes: title, body, note_kind 'thought' etc.), quotes (quotes, quote_links), highlights, scripture refs.
- Money (/money): the two bank accounts (bank_accounts), purchases (bank_transactions; answering one sorts it into a budget), budgets, set-asides. Spending he reports by hand goes through log_spend.
- Spirit (/spirit): promptings, tender mercies and prayer (spiritual_experiences, prayer_logs). A prompting stays open until he says what came of it.
- Work (/work): the work day's running list and report (work_notes, save_work_report).
- Love (/love): what he shares with Zimira (love_shares, love_dates, love_comments). Shared things notify her, so confirm before adding there.
- Temple (/temple): temple work from his FamilySearch snapshot (temple_people, temple_ordinances, temple_trips, temple_helpers). The Hub never reserves names or edits FamilySearch.
- Ask (/ask): questions about his record, answered with charts.
- Body: weigh-ins and measurements (body_metrics); watch numbers (health_days, health_workouts).
- Settings live in user_categories (his minute categories), watched_habits (habits on the Win button), weekly_targets (minute targets).`;

export const FULL_RULES = `You can do anything he can do in the Hub:
- Prefer the quick tools above for timers, wins, losses, notes, clipboard items, money and ticking tasks. For everything else use describe_tables, look_up, add_rows, change_rows, delete_rows and call_function.
- Before writing to a table you haven't seen in this conversation, describe_tables it so you use real column names and allowed values. look_up first to find the exact rows (their ids) you will change.
- New rows: set user_id to his id (given below) when the table has that column. Use his local date for date columns.
- Ask first, in one short question, before you delete anything, change more than three rows, or send something to Zimira; do it only once he says yes. Small, clear adds and edits he asked for: just do them.
- "Open", "show me", "go to" a page: open_tab with its path.
- If the record shows something different from what he said (no such column, task or category), say so plainly instead of guessing.
- After a write, say what changed in a few words. Never read ids or SQL aloud.`;

const str = (description: string) => ({ type: "string", description });
const obj = (description: string) => ({ type: "object", description, additionalProperties: true });

export const FULL_TOOLS = [
  {
    name: "look_up",
    description: "Run one read-only PostgreSQL SELECT on his data (row-level secured to him; no need to filter by user_id). Avoid the bare words insert, update, delete, create, drop, alter, set, execute, call anywhere in it, even in strings. Use his time zone for dates: (started_at at time zone 'TZ')::date.",
    input_schema: { type: "object", properties: { sql: str("One SELECT or WITH statement, no semicolon") }, required: ["sql"] },
  },
  {
    name: "describe_tables",
    description: "With no tables: every table (with its comment) and every database function he can call. With table names: their columns, types, defaults and comments.",
    input_schema: { type: "object", properties: { tables: { type: "array", items: { type: "string" }, description: "Table names; leave out for the list" } } },
  },
  {
    name: "add_rows",
    description: "Insert rows into one of his tables. Returns the rows as saved.",
    input_schema: {
      type: "object",
      properties: { table: str("Table name"), rows: { type: "array", items: obj("Column: value"), description: "1 to 25 rows" } },
      required: ["table", "rows"],
    },
  },
  {
    name: "change_rows",
    description: "Update the rows of one table where every match column equals its value (use id when you can). Changes at most 25 rows.",
    input_schema: {
      type: "object",
      properties: { table: str("Table name"), match: obj("Column: value pairs that pick the rows, e.g. {\"id\": \"...\"}"), changes: obj("Column: new value") },
      required: ["table", "match", "changes"],
    },
  },
  {
    name: "delete_rows",
    description: "Delete the rows of one table where every match column equals its value. At most 25 rows. Ask him first.",
    input_schema: { type: "object", properties: { table: str("Table name"), match: obj("Column: value pairs that pick the rows") }, required: ["table", "match"] },
  },
  {
    name: "call_function",
    description: "Call one of the database functions the app uses (see describe_tables), with named arguments.",
    input_schema: { type: "object", properties: { name: str("Function name"), args: obj("Argument: value, using the parameter names") }, required: ["name"] },
  },
  {
    name: "open_tab",
    description: "Take him to a page of the Hub when he asks to see or open one, e.g. /money, /tasks, /plan/week, /evening, /targets.",
    input_schema: { type: "object", properties: { path: str("The page's path, starting with /") }, required: ["path"] },
  },
];

const shown = (rows: unknown[], chars = 6000) => {
  let t = JSON.stringify(rows.slice(0, 80));
  if (t.length > chars) t = `${t.slice(0, chars)} …(cut short)`;
  return `${rows.length} row${rows.length === 1 ? "" : "s"}: ${t}`;
};

function tableName(t: unknown, writing: boolean) {
  const name = String(t ?? "").trim().toLowerCase();
  if (!NAME.test(name)) throw new Error(`"${t}" isn't a table name.`);
  if (writing && WRITE_BLOCKED.has(name)) throw new Error(`${name} holds keys or plumbing; change it on its page instead.`);
  return name;
}

function matchOf(match: unknown) {
  if (!match || typeof match !== "object" || Array.isArray(match)) throw new Error("Say which rows: match needs at least one column.");
  const pairs = Object.entries(match as Record<string, unknown>);
  if (!pairs.length) throw new Error("Say which rows: match needs at least one column.");
  for (const [k, v] of pairs) {
    if (!NAME.test(k)) throw new Error(`"${k}" isn't a column name.`);
    if (v !== null && typeof v === "object") throw new Error(`Match ${k} on a single value.`);
  }
  return pairs;
}

const filtered = (q: Any, pairs: [string, unknown][]) => pairs.reduce((acc, [k, v]) => (v === null ? acc.is(k, null) : acc.eq(k, v)), q);

// The handlers, bound to his session. `nav.go` is set when he asks to open
// a page; the app goes there after the answer.
export function fullHandlers(session: string, nav: { go?: string }) {
  const udb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session}` } },
  });
  return handlersFor(udb, nav);
}

// Split out so the guards can be checked against a stand-in client.
export function handlersFor(udb: Any, nav: { go?: string }) {

  const select = async (sql: string) => {
    const { data, error } = await udb.rpc("ask_select", { p_sql: String(sql ?? "").trim() });
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? data : [];
  };

  // How many rows a match picks, refusing a match that's too broad.
  const count = async (table: string, pairs: [string, unknown][]) => {
    const { count: n, error } = await filtered(udb.from(table).select("*", { count: "exact", head: true }), pairs);
    if (error) throw new Error(error.message);
    if (!n) throw new Error("Nothing matched; look_up the rows first.");
    if (n > MAX_ROWS) throw new Error(`That matches ${n} rows, more than ${MAX_ROWS}. Narrow it (match on id).`);
    return n;
  };

  return {
    look_up: async (a: { sql: string }) => shown(await select(a.sql)),

    describe_tables: async (a: { tables?: string[] }) => {
      const names = (Array.isArray(a.tables) ? a.tables : []).map((t) => tableName(t, false)).slice(0, 8);
      if (!names.length) {
        const [tables, fns] = await Promise.all([
          select(
            `select table_name as t, left(obj_description(format('public.%I', table_name)::regclass, 'pg_class'), 160) as about from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`
          ),
          select(
            `select p.proname as f, pg_get_function_arguments(p.oid) as args, left(obj_description(p.oid, 'pg_proc'), 140) as about from pg_proc p join information_schema.routines r on r.specific_name = p.proname || '_' || p.oid where r.routine_schema = 'public' and r.data_type <> 'trigger' order by 1`
          ),
        ]);
        return `Tables: ${shown(tables, 9000)}\nFunctions: ${shown(fns, 9000)}`;
      }
      const list = names.map((n) => `'${n}'`).join(",");
      const cols = await select(
        `select c.table_name as t, c.column_name as c, c.data_type as type, c.is_nullable as nullable, left(c.column_default, 60) as dflt, left(col_description(format('public.%I', c.table_name)::regclass, c.ordinal_position), 200) as about from information_schema.columns c where c.table_schema = 'public' and c.table_name in (${list}) order by c.table_name, c.ordinal_position`
      );
      const checks = await select(
        `select conrelid::regclass::text as t, pg_get_constraintdef(oid) as rule from pg_constraint where contype = 'c' and connamespace = 'public'::regnamespace and conrelid::regclass::text in (${list})`
      ).catch(() => []);
      if (!cols.length) return `No table called ${names.join(", ")} (or he can't see it). describe_tables with no names lists them.`;
      return `${shown(cols, 12000)}${checks.length ? `\nAllowed values: ${shown(checks, 4000)}` : ""}`;
    },

    add_rows: async (a: { table: string; rows: Record<string, unknown>[] }) => {
      const table = tableName(a.table, true);
      const rows = (Array.isArray(a.rows) ? a.rows : [a.rows]).filter((r) => r && typeof r === "object").slice(0, MAX_ROWS);
      if (!rows.length) throw new Error("No rows to add.");
      const { data, error } = await udb.from(table).insert(rows).select();
      if (error) throw new Error(error.message);
      console.log("voice add", table, JSON.stringify(data));
      return `Added to ${table}. ${shown(data ?? [], 3000)}`;
    },

    change_rows: async (a: { table: string; match: Record<string, unknown>; changes: Record<string, unknown> }) => {
      const table = tableName(a.table, true);
      const pairs = matchOf(a.match);
      if (!a.changes || typeof a.changes !== "object" || !Object.keys(a.changes).length) throw new Error("Nothing to change.");
      await count(table, pairs);
      const { data: before } = await filtered(udb.from(table).select("*"), pairs);
      console.log("voice change before", table, JSON.stringify(before));
      const { data, error } = await filtered(udb.from(table).update(a.changes), pairs).select();
      if (error) throw new Error(error.message);
      return `Changed ${data?.length ?? 0} in ${table}. ${shown(data ?? [], 3000)}`;
    },

    delete_rows: async (a: { table: string; match: Record<string, unknown> }) => {
      const table = tableName(a.table, true);
      const pairs = matchOf(a.match);
      await count(table, pairs);
      const { data, error } = await filtered(udb.from(table).delete(), pairs).select();
      if (error) throw new Error(error.message);
      console.log("voice delete", table, JSON.stringify(data));
      return `Deleted ${data?.length ?? 0} from ${table}.`;
    },

    call_function: async (a: { name: string; args?: Record<string, unknown> }) => {
      const name = String(a.name ?? "").trim();
      if (!NAME.test(name)) throw new Error(`"${a.name}" isn't a function name.`);
      if (CALL_BLOCKED.has(name)) throw new Error(name === "ask_select" ? "Use look_up to read." : `${name} is done on its own page.`);
      const { data, error } = await udb.rpc(name, a.args && typeof a.args === "object" ? a.args : {});
      if (error) throw new Error(error.message);
      console.log("voice call", name, JSON.stringify(a.args ?? {}));
      return `Done. ${shown(Array.isArray(data) ? data : data == null ? [] : [data], 3000)}`;
    },

    open_tab: (a: { path: string }) => {
      const path = String(a.path ?? "").trim();
      if (!/^\/[A-Za-z0-9/_-]*$/.test(path)) return Promise.resolve("That isn't a page path.");
      nav.go = path;
      return Promise.resolve(`Opening ${path}.`);
    },
  };
}
