// Ask: a conversation about your own life, answered from your own record.
//
// You ask in your own words. The assistant looks things up in your tables
// (as many times as the question needs), and answers in plain words, with
// charts where a chart says it better. It can also read your notes.
//
// Each question is kept in an ask_conversations row: the question goes in
// first, the answer is added when it lands. The work runs in the background
// (EdgeRuntime.waitUntil), so an answer still arrives if you put the phone
// away mid-question; while you're watching, the steps stream to the page as
// they happen, one JSON object per line.
//
// It runs as you (verify_jwt on, your JWT forwarded). Every query goes
// through ask_select, which executes as you with row-level security in
// force, refuses anything but one SELECT, and runs read-only. It can only
// ever read your own rows, and it can't change any of them.

import Anthropic from "npm:@anthropic-ai/sdk@^0.122.0";
import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const MODEL = "claude-opus-5-5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// The function has 150 seconds of wall clock. Past this, the assistant is
// asked to answer with what it has rather than look anything else up.
const WRAP_UP_AFTER_MS = 95_000;
const MAX_ROUNDS = 14;
// What the assistant reads back from one query; the chart keeps every row.
const ROWS_TO_MODEL = 150;
const CHARS_TO_MODEL = 14_000;
// Earlier turns sent back with a new question.
const HISTORY_MESSAGES = 16;

const SCHEMA_DOC = `All tables are row-level-secured to the signed-in person; you do NOT need to filter by user_id. Several tables have is_example: rows marked true are sample data from setup, so always add "and not coalesce(is_example, false)" where the column exists. Tracking began in late August 2026.

Time and habits
time_log_entries(id, category text, subcategory text, description text, started_at timestamptz, ended_at timestamptz, duration_minutes numeric, tags text[], goal_node_id uuid, goal_link_source text 'mapping'|'ai'|'manual', depth text 'deep'|'shallow', focus smallint 1-5, people text[], people_feel text 'draining'|'neutral'|'life_giving', split_from uuid, ended_by text 'stop'|'bedtime'|'overnight_fix', is_example)
  — the minute tracking: one row per stretch of tracked time. tags holds every category on the entry; category holds the first. Prefer unnest(tags) when a row can belong to several. goal_link_source 'mapping' is a blunt per-category default, so treat those goal links as weak evidence.
  — From mid-October 2026, stopping a timer can record more: depth (deep or shallow work) and focus (1-5) on Work-family entries; people (who he was with, e.g. {AJ, Zimi, Family}) and people_feel on People-family entries. Null means not answered, not "shallow" or "alone".
  — Sleep is the category 'Sleep' (family Rest). Its started_at is lights out and ended_at is when he woke. ended_by 'bedtime' means the Going to bed button ended that entry and started Sleep. split_from points from a Sleep entry to the forgotten timer it was split off from (ended_by 'overnight_fix' on that timer).
  — Before mid-October 2026 some timers were left running overnight: eight "Prep for bed" entries of 7–9 hours were really sleep, and a few others ran 10–18 hours. Treat any non-Sleep entry over ~10 hours as a forgotten timer, not real time, and say so when it affects an answer.
user_categories(id, name text, color text, family text, is_work boolean, archived boolean) — the categories time is tracked under. family groups them: 'Rest', 'Body', 'Upkeep', 'Craft', 'People', 'Work', 'Spirit', 'Lost' (Waste), 'Other'. Work time for his 60-hour weekly target is the Work family (Forsyth Media LLC, Client work (Parker), Scripture central work, Meeting); is_work only marks categories picked for the Work report page, so don't use it to find work time.
win_losses(id, occurred_at timestamptz, kind text 'win'|'loss', habit_label text, note text, reason text, source text, goal_node_id uuid, is_example)
  — habits kept (win) or lost (loss), logged through the day. habit_label is the habit's name. reason text is why a loss happened, picked from chips ('Late night', 'Date ran late', 'Snoozed', 'Sick', 'Chose rest', or his own words). source 'checkin' marks rows written by the morning check-in: the wake-up habit ('Up at 4:30', 'Up at 6:00') timed at when he woke, and 'Phone off by lights-out' timed at the night's lights out. Older wake-up wins have looser labels ('Up on time', 'Up at 5:45').
watched_habits(id, label text, due_by time, on_alarm time, active boolean) — habits he's actively working on, with the time they're due; on_alarm ties a wake-up habit to its alarm. When empty, the morning asks "Up at <alarm>" due 15 minutes after the alarm.
weekly_targets(id, label text, categories text[], minutes int, period text 'week'|'day', active boolean)
  — standing quotas the week is planned around; categories names which tracked categories count toward it. A 'day' target is expected on each day that is not a rest day.

Days and plans
day_plans(date date, energy_tag text, notes text, banked_at timestamptz, synopsis text, work_report text, woke_at timestamptz, lights_out_at timestamptz, alarm_at time, sleep_quality smallint 1-5, energy text 'high'|'okay'|'low', snoozed boolean, phone_off_by_lights_out boolean, morning_at timestamptz, is_example)
  — one per day. banked_at set means the day was closed out in the evening; synopsis is the paragraph written about the day. energy_tag is the Day page's day type ('Open day', 'Heavy edit day', 'Deep focus', 'Recovery day'), not energy.
  — The morning check-in (from mid-October 2026; morning_at set means it was done) fills: woke_at, lights_out_at (when the sleep that ended this morning began, i.e. the night before), alarm_at (04:30 or 06:00 usually), sleep_quality, energy, snoozed, and phone_off_by_lights_out (about the night before). Hours slept = woke_at - lights_out_at. For "what predicts a 4:30 morning", compare days with alarm_at = '04:30' where the 'Up at 4:30' win exists against the loss rows and their reasons, alongside the night before's lights_out_at, phone_off_by_lights_out and the previous day's time entries.
time_chunks(id, date date, title text, category text, start_time time, end_time time, goal_node_id uuid, source text 'manual'|'commitment'|'plan', notes text, is_example)
  — planned blocks. A block whose end_time is earlier than its start_time crosses midnight.
tasks(id, title text, date date, status boolean, time_chunk_id uuid, parent_task_id uuid, completed_at timestamptz, rollover_count int, is_work boolean, goal_node_id uuid, is_example)
  — status true means done. parent_task_id not null means a subtask. rollover_count is how many times it was pushed to another day.
standing_blocks(id, weekday smallint 0=Sunday, title, category, start_time, end_time, active) — blocks that repeat every week.
work_notes(id, date date, kind text 'did'|'note', body text, minutes int)

Reflection and walk with God
journal_entries(date date, thoughts text, gratitude text, gods_hand text, q_savior_prompt text, q_savior text, q_learn_prompt text, q_learn text, reflection_completed_at timestamptz, is_example)
  — the evening reflection. gods_hand answers "Where did you see God's hand today?"; q_savior and q_learn answer that evening's questions (the *_prompt columns hold the questions); thoughts is "Anything else". Evenings before mid-October 2026 used q_christ, q_principles and q_success instead.
daily_walk(date date, verse_ref text, verse_text text, prompt text) — the verse and prompt on the morning's Walk with God card.
prayer_logs(id, prayed_at timestamptz, context text, content text, felt_response text, tags text[], is_example)
spiritual_experiences(id, occurred_at timestamptz, kind 'prompting'|'impression'|'answer'|'tender_mercy'|'comfort'|'warning'|'insight', what_came text, trigger_context text, acted_on boolean, action_taken text, follow_up_notes text, tags text[], is_example)
  — acted_on true means the entry is closed; count a prompting as followed only when action_taken is filled in.

Goals
nodes(id, title text, description text, tracking_method 'note'|'checkbox'|'counter', target_number numeric, current_number numeric, is_completed boolean, completed_at timestamptz, is_focused boolean, has_deadline boolean, deadline_date date, last_activity_at timestamptz)
node_edges(child_id, parent_id) — the goal tree (the goal wheel). progress_logs(node_id, amount numeric, created_at) — counter progress.
focus_goals(id, week_start date (a Sunday), title text, node_id uuid, review text, reviewed_at timestamptz) — the few things chosen to focus on each week, set on Sundays.
focus_checkins(goal_id, date date, moved boolean) — whether a focus goal moved forward that day.

Notes and study (the Board)
study_notes(id, title text, body text, excerpt text, note_kind text 'insight'|'thought'|'revelation'|'counsel'|'resolve'|'motivation'|'question', source_kind 'scripture'|'conference'|'other', source_ref text, studied_on date, created_at timestamptz, parent_note_id uuid, obsidian_uid text, gist text, ai_tags text[], shelf_keys text[], shelf_people text[], pinned boolean)
  — notes and thoughts. obsidian_uid set means it came from the Obsidian vault (long study notes); null means captured in the Hub. parent_note_id set means a card cut from a longer note. gist is a one-line summary; shelf_people names people whose words the note records; shelf_keys look like 'person:david-a-bednar', 'theme:discipline', 'mood:tired'. body can be long: select left(body, 600) unless you need it all.
note_highlights(note_id, quoted_text text, created_at) — passages highlighted in notes.
scripture_refs(entity_id uuid (a study_notes id), book text, chapter int, verse_start int, verse_end int, raw_ref text)
quotes(id, text, author, author_kind 'church'|'historical', source, year, rating 'applies'|'somewhat'|'not_now', saved_at timestamptz, origin 'daily'|'pick'|'shelf', created_at)
  — quotes found for them; saved_at set means pinned to the Board. quote_days(date, quote_id, reason) is the quote shown each day.
daily_selection_items(note_id, slot, reason text, score int, feedback text) joined to daily_selections(id, for_date date) — notes the curator brought back on a day; score 9 means "useful", 3 "not now".

Money (US dollars)
bank_transactions(id, account_id uuid, posted_at timestamptz, amount numeric, description text, payee text, budget_id uuid, purchase_kind text, is_business boolean, business_category text, is_transfer boolean, reviewed_at timestamptz, note text, source 'simplefin'|'manual')
  — amount is negative for money spent and positive for money coming in, so spending is -amount where amount < 0. Always leave out is_transfer = true. purchase_kind is a short label like 'Groceries' or 'Eating out'.
budgets(id, name text, monthly_limit numeric, kind 'personal'|'business', archived boolean) — join bank_transactions.budget_id.
bank_accounts(id, name text, nickname text, kind 'personal'|'business', balance numeric, available_balance numeric, hidden boolean)`;

function systemPrompt(tz: string, today: string, snapshot: unknown) {
  return `You are the assistant inside Aaron's Personal Hub, the app where he keeps his whole life in one place: the minutes he tracks through the day, the habits he keeps or loses, his plans and tasks, his evening reflections and walk with God, his goals, his notes and study, and his money. He uses it to see how life is really going, to stay in tune with his life and with God. He is a member of The Church of Jesus Christ of Latter-day Saints.

He asks you questions about his own record. Answer them from the record: look things up, then say what you found.

Today is ${today}, and he lives in ${tz}.

His data:
${SCHEMA_DOC}

A snapshot of the names in his record, so you can match his words to them:
${JSON.stringify(snapshot)}

How to look things up:
- run_sql runs one read-only PostgreSQL SELECT and shows you the rows. Use it as many times as the question needs: to look around first, to check a guess, to get the numbers. Aggregate in SQL rather than reading raw rows.
- make_chart runs a query and draws its result for him. Use a chart when the answer is a pattern, a trend, a comparison or a breakdown; not for a single number. One question can need two or three charts; most need one or none.
- search_notes finds his notes containing all the given words (study notes, thoughts, the vault). Use it for what he has written about something; then read the notes you need with run_sql (select title, left(body, 1500) from study_notes where id in (...)).
- Every tool takes a "purpose": a few plain words he sees while you work, like "Adding up your sleep by week" or "Reading what you wrote about patience". Address him as "you".

Rules for SQL:
- Exactly one SELECT or WITH statement, no semicolon. Never write anything.
- Convert timestamps to his local day with the timezone as a literal: (started_at AT TIME ZONE '${tz}')::date. There are no bind parameters; inline every value.
- Avoid the bare words insert, update, delete, create, drop, alter, set, execute and call anywhere in the statement, even inside string literals: a safety filter refuses the query if it sees them. (current_setting and similar names are fine.)
- Match categories and habits case-insensitively, and categories against tags too: exists (select 1 from unnest(tags) t where lower(t) = 'sleep') or lower(category) = 'sleep'.
- Days with nothing logged are absent, not zero; don't invent them unless the question is about gaps.
- For charts: give every output column a short lower_snake_case alias (it labels the axis); order time series by date ascending; return money as positive dollar amounts rounded to cents; keep it to a few hundred rows at most.

Choosing a chart:
- line: a measure over time. For two to five things over time (study vs work minutes by week), return one row per (date, thing) and name the thing's column as series_key.
- column: a measure across a modest number of ordered buckets (hours of the day, weekdays, months).
- bars: ranked magnitude across named things (categories, habits, budgets).
- donut: part-to-whole with at most about eight parts that add up to something meaningful.

How to answer:
- Lead with the answer itself, in a sentence or two, with the actual numbers. Then whatever else helps him see it: what stands out, what changed, how it compares. Keep it short: a few short paragraphs or a short list, never an essay.
- Put each chart where it belongs in your answer by writing its marker on its own line, exactly as make_chart gives it: [[chart:1]]. A chart you don't place goes at the end.
- Write plain markdown: **bold** for the key number, short lists where they help. No tables (the charts carry the numbers), no headings for a short answer.
- Use his words for his categories and habits. Minutes over an hour read as hours and minutes ("6h 40m").
- Say plainly when the record can't answer something, or only partly, and why (not tracked, too few days). Never invent a number.
- If he asks about his walk with God, his reflections or his notes, quote his own words briefly where they help; don't preach or moralize. Give your own view or a suggestion only when he asks for one, and then be direct and practical.`;
}

const TOOLS = [
  {
    name: "run_sql",
    description: "Run one read-only PostgreSQL SELECT against his own data and see the rows (at most 150 shown).",
    input_schema: {
      type: "object",
      properties: {
        purpose: { type: "string", description: "A few plain words he sees while you work, e.g. 'Looking at your sleep by night'." },
        sql: { type: "string", description: "One SELECT or WITH statement, no semicolon." },
      },
      required: ["purpose", "sql"],
    },
  },
  {
    name: "make_chart",
    description:
      "Run one read-only SELECT and draw its result as a chart in your answer. Returns the chart's marker to place in your answer and the rows it drew.",
    input_schema: {
      type: "object",
      properties: {
        purpose: { type: "string", description: "A few plain words he sees while you work, e.g. 'Charting your study minutes by week'." },
        title: { type: "string", description: "A short title, in his words where possible." },
        caption: { type: "string", description: "One short sentence under the title saying what is plotted and over what window. Optional." },
        chart_type: { type: "string", enum: ["line", "column", "bars", "donut"] },
        sql: { type: "string", description: "One SELECT or WITH statement, no semicolon." },
        x_key: { type: "string", description: "The output column for the x axis or the category label." },
        y_key: { type: "string", description: "The output column for the measured value." },
        series_key: { type: "string", description: "For a line chart of several things over time: the output column naming each row's series. Leave empty otherwise." },
        x_kind: { type: "string", enum: ["date", "category", "number"] },
        y_unit: { type: "string", enum: ["minutes", "hours", "count", "percent", "dollars", "raw"] },
      },
      required: ["purpose", "title", "chart_type", "sql", "x_key", "y_key", "x_kind", "y_unit"],
    },
  },
  {
    name: "search_notes",
    description: "Find his notes that contain all of the given words (in the title, body or source). Returns up to 25 notes with a snippet around the first match.",
    input_schema: {
      type: "object",
      properties: {
        purpose: { type: "string", description: "A few plain words he sees while you work, e.g. 'Reading what you wrote about patience'." },
        words: { type: "string", description: "One to four words to look for. Fewer words find more." },
      },
      required: ["purpose", "words"],
    },
  },
];

type Chart = {
  n: number;
  title: string;
  caption: string;
  chart_type: string;
  x_key: string;
  y_key: string;
  series_key: string | null;
  x_kind: string;
  y_unit: string;
  rows: unknown[];
};

// Rows as the assistant reads them back: enough to work with, never so
// many that one query fills the conversation.
function forModel(rows: unknown[]) {
  const shown = rows.slice(0, ROWS_TO_MODEL);
  let text = JSON.stringify(shown);
  if (text.length > CHARS_TO_MODEL) text = text.slice(0, CHARS_TO_MODEL) + " …(cut short)";
  const more = rows.length > shown.length ? ` Showing the first ${shown.length}.` : "";
  return `${rows.length} row${rows.length === 1 ? "" : "s"}.${more}\n${text}`;
}

async function select(supabase: any, sql: string): Promise<unknown[]> {
  const { data, error } = await supabase.rpc("ask_select", { p_sql: sql });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

// The names in the record, so "my study minutes" or "cold showers" can be
// matched to what's actually there without a round of looking around.
async function snapshotOf(supabase: any, tz: string, today: string) {
  const sunday = (() => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return d.toISOString().slice(0, 10);
  })();
  const q = async (sql: string) => {
    try {
      return await select(supabase, sql);
    } catch (err) {
      console.warn("snapshot", err);
      return [];
    }
  };
  const [categories, habits, targets, focus, goals, budgets, span] = await Promise.all([
    q(`select name, family, is_work from user_categories where not archived order by position`),
    q(`select habit_label, count(*) filter (where kind = 'win') as wins, count(*) filter (where kind = 'loss') as losses from win_losses where not coalesce(is_example, false) group by habit_label order by count(*) desc limit 40`),
    q(`select label, categories, minutes, period from weekly_targets where active order by position`),
    q(`select title from focus_goals where week_start = '${sunday}' order by position`),
    q(`select title from nodes where is_focused and not is_completed order by title limit 20`),
    q(`select name, kind, monthly_limit from budgets where not archived order by position`),
    q(`select min((started_at at time zone '${tz}')::date) as first_day, max((started_at at time zone '${tz}')::date) as last_day, count(*) as entries from time_log_entries where not coalesce(is_example, false)`),
  ]);
  return { categories, habits, weekly_targets: targets, this_weeks_focus: focus, focused_goals: goals, budgets, time_tracking: span[0] ?? null };
}

// Earlier turns, as the assistant needs them: the words, and a line for each
// chart it drew.
function history(messages: any[]) {
  const out: any[] = [];
  for (const m of messages.slice(-HISTORY_MESSAGES)) {
    if (m.role === "user") out.push({ role: "user", content: String(m.text ?? "") });
    else if (m.role === "assistant" && m.text) {
      const charts = (m.charts ?? []) as Chart[];
      const text = String(m.text).replace(/\[\[chart:(\d+)\]\]/g, (_s, n) => {
        const c = charts.find((x) => x.n === Number(n));
        return c ? `(chart: ${c.title})` : "";
      });
      out.push({ role: "assistant", content: text });
    }
  }
  // The API wants turns to alternate, starting with the person.
  const merged: any[] = [];
  for (const m of out) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += `\n\n${m.content}`;
    else merged.push({ ...m });
  }
  while (merged.length && merged[0].role !== "user") merged.shift();
  return merged;
}

async function answer(
  supabase: any,
  anthropic: Anthropic,
  { tz, today, prior, question, step }: { tz: string; today: string; prior: any[]; question: string; step: (text: string) => void }
) {
  const started = Date.now();
  const snapshot = await snapshotOf(supabase, tz, today);
  const system = systemPrompt(tz, today, snapshot);
  const messages: any[] = [...history(prior), { role: "user", content: question }];
  if (messages.length > 1 && messages[messages.length - 2].role === "user") {
    // An earlier question that never got its answer.
    messages.splice(messages.length - 2, 1);
  }

  const charts: Chart[] = [];
  const steps: string[] = [];
  const note = (text: string) => {
    const t = String(text ?? "").trim().slice(0, 120);
    if (!t) return;
    steps.push(t);
    step(t);
  };

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const wrapUp = Date.now() - started > WRAP_UP_AFTER_MS || round === MAX_ROUNDS - 1;
    const response: any = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      tools: TOOLS as any,
      tool_choice: wrapUp ? { type: "none" } : { type: "auto" },
      messages,
    });
    messages.push({ role: "assistant", content: response.content });

    const uses = response.content.filter((b: any) => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || uses.length === 0) {
      const text = response.content
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("")
        .trim();
      if (!text) throw new Error(`No answer came back (${response.stop_reason}).`);
      return { text, charts, steps, usage: response.usage };
    }

    const results = [];
    for (const use of uses) {
      const input = use.input ?? {};
      note(input.purpose);
      try {
        if (use.name === "run_sql") {
          const rows = await select(supabase, String(input.sql ?? ""));
          results.push({ type: "tool_result", tool_use_id: use.id, content: forModel(rows) });
        } else if (use.name === "make_chart") {
          const rows = await select(supabase, String(input.sql ?? ""));
          const chart: Chart = {
            n: charts.length + 1,
            title: String(input.title ?? "").slice(0, 120),
            caption: String(input.caption ?? "").slice(0, 300),
            chart_type: ["line", "column", "bars", "donut"].includes(input.chart_type) ? input.chart_type : "bars",
            x_key: String(input.x_key ?? ""),
            y_key: String(input.y_key ?? ""),
            series_key: input.series_key ? String(input.series_key) : null,
            x_kind: ["date", "category", "number"].includes(input.x_kind) ? input.x_kind : "category",
            y_unit: ["minutes", "hours", "count", "percent", "dollars", "raw"].includes(input.y_unit) ? input.y_unit : "raw",
            rows,
          };
          const missing = rows.length > 0 && [chart.x_key, chart.y_key, chart.series_key].filter(Boolean).find((k) => !(k! in (rows[0] as any)));
          if (missing) {
            results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: `The query has no column named "${missing}". Its columns are: ${Object.keys(rows[0] as any).join(", ")}.` });
            continue;
          }
          if (rows.length === 0) {
            results.push({ type: "tool_result", tool_use_id: use.id, content: "The query returned no rows, so there's nothing to draw. No chart was made." });
            continue;
          }
          charts.push(chart);
          results.push({
            type: "tool_result",
            tool_use_id: use.id,
            content: `Drawn. Place it in your answer with [[chart:${chart.n}]] on its own line.\n${forModel(rows)}`,
          });
        } else if (use.name === "search_notes") {
          const { data, error } = await supabase.rpc("search_notes", { p_query: String(input.words ?? ""), p_limit: 25 });
          if (error) throw new Error(error.message);
          const notes = (data ?? []).map((n: any) => ({
            id: n.id,
            title: n.title,
            kind: n.note_kind,
            source: n.source_ref,
            written: String(n.created_at ?? "").slice(0, 10),
            snippet: n.snippet ?? n.excerpt ?? n.essence ?? null,
          }));
          results.push({ type: "tool_result", tool_use_id: use.id, content: forModel(notes) });
        } else {
          results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: `There's no tool called ${use.name}.` });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: `That didn't run: ${message}` });
      }
    }
    messages.push({ role: "user", content: results });
  }
  throw new Error("It ran out of time before it could answer.");
}

// The timezone goes into queries as a literal, so only a real one is used.
function knownZone(tz: string) {
  if (!/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(tz)) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

// "How has my sleep been since I started getting up at 5?" → a title for
// the list of conversations.
function titleOf(question: string) {
  const t = question.replace(/\s+/g, " ").trim();
  return t.length > 80 ? `${t.slice(0, 77).replace(/\s+\S*$/, "")}…` : t;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY is not set on this project." }, 503);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    // The caller's own token: RLS applies to everything this client does.
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Not signed in." }, 401);

    const body = await req.json().catch(() => ({}));
    const question = String(body.question ?? "").trim().slice(0, 4000);
    if (!question) return json({ error: "Ask a question first." }, 400);
    const tz = knownZone(String(body.tz ?? "")) ?? "America/Denver";
    const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });

    // The conversation, or a new one; the question goes in before any work,
    // so it's there even if the answer never comes.
    let convo: any = null;
    if (body.conversation_id) {
      const { data, error } = await supabase.from("ask_conversations").select("*").eq("id", String(body.conversation_id)).maybeSingle();
      if (error) throw new Error(`ask_conversations: ${error.message}`);
      convo = data;
    }
    const prior = convo?.messages ?? [];
    const asked = { role: "user", text: question, at: new Date().toISOString() };
    if (convo) {
      const { data, error } = await supabase
        .from("ask_conversations")
        .update({ messages: [...prior, asked], working_since: asked.at, updated_at: asked.at })
        .eq("id", convo.id)
        .select("*")
        .single();
      if (error) throw new Error(`ask_conversations: ${error.message}`);
      convo = data;
    } else {
      const { data, error } = await supabase
        .from("ask_conversations")
        .insert({ user_id: userData.user.id, title: titleOf(question), messages: [asked], working_since: asked.at })
        .select("*")
        .single();
      if (error) throw new Error(`ask_conversations: ${error.message}`);
      convo = data;
    }

    // Steps go to the page while it's listening; a page that has gone away
    // just stops hearing them.
    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
    const send = (event: unknown) => {
      try {
        controller?.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      } catch {
        controller = null;
      }
    };
    const close = () => {
      try {
        controller?.close();
      } catch {
        // already gone
      }
      controller = null;
    };
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
      cancel() {
        controller = null;
      },
    });

    const anthropic = new Anthropic({ apiKey });
    const job = (async () => {
      send({ type: "conversation", id: convo.id, title: convo.title });
      let reply: any;
      try {
        const out = await answer(supabase, anthropic, {
          tz,
          today,
          prior,
          question,
          step: (text) => send({ type: "step", text }),
        });
        console.log(JSON.stringify({ ask: "answered", charts: out.charts.length, steps: out.steps.length, usage: out.usage }));
        reply = { role: "assistant", text: out.text, charts: out.charts, steps: out.steps, at: new Date().toISOString() };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("ask", message);
        reply = { role: "assistant", error: message.slice(0, 400), at: new Date().toISOString() };
      }
      const { error } = await supabase
        .from("ask_conversations")
        .update({ messages: [...convo.messages, reply], working_since: null, updated_at: reply.at })
        .eq("id", convo.id);
      if (error) console.error("ask save", error.message);
      send({ type: "answer", message: reply });
      close();
    })();
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(job);

    return new Response(stream, {
      headers: { ...CORS, "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
