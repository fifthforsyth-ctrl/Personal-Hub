// The assistant. Runs on Supabase Edge Functions so the phone can reach it —
// the Anthropic key lives here as a project secret and never ships to the
// browser or into the database.
//
// Auth: the caller's own JWT is forwarded into the Supabase client, so every
// query runs under that user's RLS. The function never uses the service
// role and therefore cannot read anyone's data but the caller's, even if
// something below has a bug.

import Anthropic from "npm:@anthropic-ai/sdk@^0.122.0";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk@^0.122.0/helpers/zod";
import { z } from "npm:zod@^4.4.3";
import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const MODEL = "claude-opus-5";

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

// ---------------------------------------------------------------------------
// propose_plan
// ---------------------------------------------------------------------------

const PlanSchema = z.object({
  plans: z
    .array(
      z.object({
        name: z.string().describe("Two or three words naming this plan's approach."),
        strategy: z.string().describe("One line: what this plan optimizes for, and what it trades away."),
        rationale: z
          .string()
          .describe(
            "Two or three sentences on why this fits, citing specific numbers from the data — hours, days quiet, completion rates."
          ),
        blocks: z
          .array(
            z.object({
              title: z.string(),
              start: z.string().describe('24-hour "HH:MM".'),
              end: z.string().describe('24-hour "HH:MM".'),
              tasks: z.array(z.string()).describe("Concrete tasks inside this block. Can be empty."),
            })
          )
          .describe("The day laid out in time order, 4 to 8 blocks."),
      })
    )
    .describe("Exactly three genuinely different plans."),
});

const PLAN_SYSTEM = `You propose plans for the coming day inside a private life-tracking app belonging to a member of The Church of Jesus Christ of Latter-day Saints who is serving as a missionary.

You are given a compact summary of their recent days: how time was actually spent by category, which goal-tree branches got fed, which have gone quiet, tasks left unfinished, promptings recorded but not yet acted on, and the block shapes and presets they already use.

Produce exactly three plans that differ in strategy, not just in wording. Good axes to differ along:
- continue what is already working, tightened
- deliberately feed a branch that has gone quiet
- a lighter or recovery-shaped day when the recent data shows sustained heavy load

Rules:
- Build from the block shapes and times they ALREADY use. You are proposing tomorrow, not redesigning their life.
- Respect the obvious fixed points visible in the data (sleep, study hours, meal times, standing meetings).
- Cite real numbers in each rationale — "Creative Mastery has had nothing for 12 days", "you finished 9 of 9 yesterday". Never invent a figure.
- Every plan must be livable. Do not stack a day past what their recent days show they actually do.
- State things plainly. No praise, no exhortation, no scripture quoting back at them. They are choosing between options, not being coached.
- If the data is thin, say so in the rationale rather than inventing detail.`;

async function proposePlan(supabase: any, anthropic: Anthropic, tz: string, notes?: string | null) {
  const { data: context, error } = await supabase.rpc("plan_context", { p_tz: tz, p_days: 14 });
  if (error) throw new Error(`plan_context: ${error.message}`);

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: PLAN_SYSTEM,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content:
          `Here is the recent record. Propose three plans for ${context.tomorrow} (${String(
            context.tomorrow_weekday ?? ""
          ).trim()}).\n\n${JSON.stringify(context, null, 1)}` +
          // Notes written just before pressing generate outrank anything
          // inferred from the logs — they are the only source for things
          // that haven't happened yet.
          (notes?.trim()
            ? `\n\nNotes they left about tomorrow. These are FIXED FACTS about the day and take priority over any pattern in the data above — build every one of the three plans around them:\n${notes.trim()}`
            : ""),
      },
    ],
    output_config: { format: zodOutputFormat(PlanSchema) },
  });

  if (!response.parsed_output) throw new Error("The model returned nothing parsable.");
  return { ...response.parsed_output, for_date: context.tomorrow, usage: response.usage };
}

// ---------------------------------------------------------------------------
// suggest_goal_links
// ---------------------------------------------------------------------------

const LinkSchema = z.object({
  links: z
    .array(
      z.object({
        entry_id: z.string().describe("The id of the entry, copied exactly from the input."),
        goal_id: z
          .string()
          .nullable()
          .describe("The id of the goal this time fed, copied exactly from the goals list. null if it genuinely serves none."),
        confidence: z.enum(["high", "medium", "low"]),
        why: z.string().describe("One short clause naming what in the entry decided it."),
      })
    )
    .describe("One entry per input entry, in the same order."),
});

const LINK_SYSTEM = `You read a day of logged time and decide which goal on a personal goal tree each stretch of time actually fed.

The descriptions are the point. Two entries can carry the same category tag and serve completely different goals — "Serve zone making app" is building something, "Help sister Shumway" is ministering to a person. Read what was actually written.

Rules:
- goal_id must be copied exactly from the supplied goals list. Never invent an id or a goal name.
- Prefer the most specific goal that genuinely fits. Credit flows upward on its own, so choosing a leaf is better than choosing a pillar when the leaf is right.
- Return null when the time honestly serves no goal on the tree — commuting, meals, and idle time usually do. A forced link is worse than none.
- Mark confidence honestly. "low" is the correct answer for a vague description like "Untitled Activity"; do not guess confidently to look useful.
- The tags are a hint, not the answer. Where the description contradicts the tag, follow the description.
- Return exactly one object per input entry, including ones that already have a current_goal — if the existing link is right, return it again.`;

async function suggestGoalLinks(
  supabase: any,
  anthropic: Anthropic,
  tz: string,
  opts: { start: string; end: string; onlyUnlinked?: boolean }
) {
  const { data: context, error } = await supabase.rpc("link_context", {
    p_start: opts.start,
    p_end: opts.end,
    p_tz: tz,
    p_only_unlinked: opts.onlyUnlinked ?? false,
  });
  if (error) throw new Error(`link_context: ${error.message}`);
  if (!context?.entries?.length) return { links: [], start: opts.start, end: opts.end };

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: LINK_SYSTEM,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: `Decide what each of these ${context.entries.length} entries fed.\n\n${JSON.stringify(context, null, 1)}`,
      },
    ],
    output_config: { format: zodOutputFormat(LinkSchema) },
  });

  if (!response.parsed_output) throw new Error("The model returned nothing parsable.");

  // Only hand back links that name a real entry and a real goal — the model
  // is instructed to copy ids, but nothing downstream should trust that.
  // The entry's own text rides along so the review screen can show what is
  // being linked without refetching the day.
  const entryById = new Map(context.entries.map((e: any) => [e.id, e]));
  const goalById = new Map(context.goals.map((g: any) => [g.id, g.path]));
  const links = response.parsed_output.links
    .filter((l) => entryById.has(l.entry_id) && (l.goal_id === null || goalById.has(l.goal_id)))
    .map((l) => {
      const entry = entryById.get(l.entry_id) as any;
      return {
        ...l,
        goal_path: l.goal_id ? goalById.get(l.goal_id) : null,
        what: entry?.what,
        minutes: entry?.minutes,
        current_goal: entry?.current_goal ?? null,
      };
    });

  return { links, start: opts.start, end: opts.end, usage: response.usage };
}

// ---------------------------------------------------------------------------
// ask_chart — "map out my sleep over the past 6 months"
//
// The shape of these questions is open, so no fixed set of rollups can serve
// them. The model writes the query instead. Two things keep that safe: the
// statement runs through run_readonly_select, which refuses anything that
// isn't a single read-only SELECT, and it executes under the caller's own
// JWT, so RLS confines it to rows they already own. The worst a bad query
// can do is fail.
// ---------------------------------------------------------------------------

const SCHEMA_DOC = `All tables are row-level-secured to the signed-in user; you do NOT need to filter by user_id, and auth.uid() is available if you want it.

time_log_entries(id, category text, subcategory text, description text, started_at timestamptz, ended_at timestamptz, duration_minutes numeric, tags text[], goal_node_id uuid)
  — the minute tracking. One row per stretch of tracked time. tags holds every category on the entry; category holds the first. Prefer unnest(tags) when a row can belong to several.
win_losses(id, occurred_at timestamptz, kind text 'win'|'loss', habit_label text, note text, goal_node_id uuid)
tasks(id, title text, date date, status boolean, time_chunk_id uuid, parent_task_id uuid, completed_at timestamptz, rollover_count int)
  — status true means done. parent_task_id not null means it is a subtask.
time_chunks(id, date date, title text, start_time time, end_time time, goal_node_id uuid)
day_plans(date date, energy_tag text, notes text, banked_at timestamptz, synopsis text)
journal_entries(date date, thoughts text, gratitude text, gods_hand text, q_christ text, q_principles text, q_success text, reflection_completed_at timestamptz)
prayer_logs(id, prayed_at timestamptz, context text, content text, felt_response text, tags text[])
spiritual_experiences(id, occurred_at timestamptz, kind text, what_came text, acted_on boolean, action_taken text)
study_notes(id, title text, body text, studied_on date, source_ref text, ai_theme text, ai_summary text)
nodes(id, title text, description text, is_completed boolean, is_focused boolean, last_activity_at timestamptz) and node_edges(child_id, parent_id) — the goal tree.
user_categories(id, name text, color text, archived boolean)`;

const CHART_SYSTEM = `You answer questions about a person's own life-tracking data by writing one PostgreSQL query and choosing how to plot the result.

${SCHEMA_DOC}

Hard rules for the SQL:
- Exactly ONE statement. No semicolon. SELECT or WITH only. Never write, never DDL.
- Always convert timestamps to the user's local day, writing the timezone you are given as a literal: (started_at AT TIME ZONE 'America/Denver')::date. There are no bind parameters — inline every value.
- Give every output column a short, plain lower_snake_case alias. The alias is what gets shown on the axis.
- Return a modest number of rows: aggregate rather than dumping raw entries. A daily series over six months (about 180 rows) is fine; 5,000 rows is not.
- Order by the x column ascending for anything time-based.
- If a category is named in the question, match it case-insensitively and against tags as well as category — e.g. exists (select 1 from unnest(tags) t where lower(t) = 'sleep') or lower(category) = 'sleep'.
- Days with nothing logged are genuinely absent, not zero. Do not invent them with generate_series unless the question is specifically about gaps.
- Avoid the bare words insert, update, delete, create, drop, alter, set, execute and call anywhere in the statement, including inside string literals — a safety filter rejects the query if it sees them.

Choosing the form:
- line — a measure over time. The default for "over the past N months/weeks".
- column — a measure across a modest number of ordered buckets (hours of the day, days of the week, months).
- bars — ranked magnitude across named things (categories, habits, goals).
- donut — part-to-whole, only when the parts sum to a meaningful whole and there are at most about eight of them.
- none — the honest answer is a sentence or a single number, not a plot.

Also write \`answer\`: one or two plain sentences saying what the query will show. Do not predict the numbers — you have not seen them yet. No praise, no coaching.`;

const ChartSchema = z.object({
  title: z.string().describe("A short title for the chart, in the person's own words where possible."),
  answer: z.string().describe("One or two sentences describing what is being plotted and over what window."),
  chart_type: z.enum(["line", "column", "bars", "donut", "none"]),
  sql: z.string().describe("One PostgreSQL SELECT statement, no semicolon."),
  x_key: z.string().describe("The output column alias for the x axis / category label."),
  y_key: z.string().describe("The output column alias for the measured value."),
  x_kind: z.enum(["date", "category", "number"]),
  y_unit: z.enum(["minutes", "hours", "count", "percent", "raw"]),
});

async function askChart(supabase: any, anthropic: Anthropic, tz: string, question: string) {
  const today = new Date().toISOString().slice(0, 10);

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: CHART_SYSTEM,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: `Timezone: ${tz}. Today is ${today}.\n\nQuestion: ${question}`,
      },
    ],
    output_config: { format: zodOutputFormat(ChartSchema) },
  });

  const spec = response.parsed_output;
  if (!spec) throw new Error("The model returned nothing parsable.");
  if (spec.chart_type === "none") return { spec, rows: [], usage: response.usage };

  const { data: rows, error } = await supabase.rpc("run_readonly_select", { p_sql: spec.sql });
  if (error) throw new Error(`That query didn't run: ${error.message}`);

  return { spec, rows: rows ?? [], usage: response.usage };
}

// ---------------------------------------------------------------------------
// day_synopsis — the paragraph at the top of a banked day
//
// Written from the day's own record: what was tracked, what got done, what it
// fed, and what was written in the reflection. It goes at the top of the
// banked card, so it has to be the thing you'd want to read a year from now
// when the charts underneath have stopped meaning anything specific.
// ---------------------------------------------------------------------------

const SYNOPSIS_SYSTEM = `You write the one-paragraph synopsis that sits at the top of a finished day in a private life-tracking journal. The person is a member of The Church of Jesus Christ of Latter-day Saints serving as a missionary.

You are given everything recorded on that date: tracked time by category, the planned blocks and which tasks were finished, wins and losses, prayers, promptings, study notes, which goals the day fed, and the reflection they wrote in their own words.

Write three to five sentences.

Rules:
- Say what the day WAS, not what its numbers were. "A long service day that ran into the evening" beats "6h 12m in Serve". Numbers are allowed when one carries the shape of the day; a list of them is not.
- The reflection they wrote outranks everything else. If they said the day was hard, it was hard, however good the completion rate looks.
- Name specifics — the actual task, the actual person, the actual chapter. Never "various activities" or "several tasks".
- Past tense, plain language, second person ("you").
- No praise, no encouragement, no coaching, no scripture quoted back at them, no advice about tomorrow. You are writing a record, not a report card.
- If almost nothing was recorded, say so in a sentence and stop. Do not pad.`;

const SynopsisSchema = z.object({
  synopsis: z.string().describe("Three to five sentences, past tense, second person."),
  headline: z.string().describe("Four to seven words naming what kind of day it was. No punctuation at the end."),
});

async function daySynopsis(supabase: any, anthropic: Anthropic, tz: string, date: string) {
  const [{ data: archive, error: e1 }, { data: credit, error: e2 }] = await Promise.all([
    supabase.rpc("day_archive", { p_date: date, p_tz: tz }),
    supabase.rpc("goal_credit", { p_start: date, p_end: date, p_tz: tz }),
  ]);
  if (e1) throw new Error(`day_archive: ${e1.message}`);
  if (e2) throw new Error(`goal_credit: ${e2.message}`);

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 6000,
    system: SYNOPSIS_SYSTEM,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: `Write the synopsis for ${date}.\n\nThe day's record:\n${JSON.stringify(archive, null, 1)}\n\nWhat it fed on the goal tree:\n${JSON.stringify(credit ?? [], null, 1)}`,
      },
    ],
    output_config: { format: zodOutputFormat(SynopsisSchema) },
  });

  if (!response.parsed_output) throw new Error("The model returned nothing parsable.");
  return { ...response.parsed_output, date, usage: response.usage };
}

// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json(
        { error: "ANTHROPIC_API_KEY is not set on this project. Add it under Edge Functions → Secrets." },
        503
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    // The caller's own token — RLS applies to everything this client does.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Not signed in." }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "propose_plan";
    const tz = body.tz ?? "UTC";

    const anthropic = new Anthropic({ apiKey });

    switch (action) {
      case "propose_plan":
        return json(await proposePlan(supabase, anthropic, tz, body.notes));
      case "day_synopsis": {
        const date = String(body.date ?? "").trim();
        if (!date) return json({ error: "day_synopsis needs a date." }, 400);
        return json(await daySynopsis(supabase, anthropic, tz, date));
      }
      case "ask_chart": {
        const question = String(body.question ?? "").trim();
        if (!question) return json({ error: "ask_chart needs a question." }, 400);
        if (question.length > 1000) return json({ error: "That question is too long." }, 400);
        return json(await askChart(supabase, anthropic, tz, question));
      }
      case "suggest_goal_links": {
        const start = body.start ?? body.date;
        const end = body.end ?? body.date;
        if (!start || !end) return json({ error: "suggest_goal_links needs a date or a start/end range." }, 400);
        return json(await suggestGoalLinks(supabase, anthropic, tz, { start, end, onlyUnlinked: body.onlyUnlinked }));
      }
      default:
        return json({ error: `Unknown action "${action}".` }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Surface the model's own errors (rate limit, bad key) rather than a
    // generic 500 — they're actionable and this is a single-user app.
    return json({ error: message }, 500);
  }
});
