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

You are given two different things, and the difference matters.

The record: how time was actually spent by category over recent days, which goal-tree branches got fed, which have gone quiet, tasks left unfinished, promptings recorded but not yet acted on, and the block shapes they already use.

The intent: "ideal_day_for_tomorrow" is the shape they have decided this weekday should have — a standing decision, not an observation. Where it exists, it is the skeleton. Start from its blocks and its times, keep its fixed points exactly (anything named unavailable, reserved, or rest is not yours to move), and depart from it only where the record or their notes give you a reason you can name. If no ideal day claims tomorrow, build from the recent record instead.

Produce exactly three plans that differ in strategy, not just in wording. Good axes to differ along:
- continue what is already working, tightened
- deliberately feed a branch that has gone quiet
- a lighter or recovery-shaped day when the recent data shows sustained heavy load

Rules:
- Build from the ideal day for tomorrow where there is one, and otherwise from the block shapes and times they ALREADY use. You are proposing tomorrow, not redesigning their life.
- The three plans should differ in how they handle the gap between the ideal and the record — holding to the ideal, conceding to what the last week actually sustained, or protecting one thing that has been getting squeezed. Say in the rationale which you did.
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
// propose_week — the Sunday sitting
// ---------------------------------------------------------------------------

const WeekSchema = z.object({
  strategy: z
    .string()
    .describe("Two or three sentences on the shape of this week and what it protects, citing real figures from the data."),
  days: z
    .array(
      z.object({
        date: z.string().describe('The day, "YYYY-MM-DD", copied from the input.'),
        note: z.string().describe("One short clause on what this day is for. Can be empty."),
        blocks: z
          .array(
            z.object({
              title: z.string().describe("What the block is. Broad — the granular version gets planned on the day."),
              category: z
                .string()
                .describe('The category this block counts as, copied exactly from the supplied "categories" list.'),
              start: z.string().describe('24-hour "HH:MM".'),
              end: z.string().describe('24-hour "HH:MM".'),
            })
          )
          .describe("The day in time order, 4 to 8 broad blocks."),
      })
    )
    .describe("Exactly one entry per day given, in date order."),
});

const WEEK_SYSTEM = `You lay out a coming week inside a private life-tracking app belonging to a member of The Church of Jesus Christ of Latter-day Saints who is serving as a missionary. This is the Sunday sitting: one pass over seven days, done before the week starts.

You are given three different kinds of thing, and the order between them is the whole job.

1. What is already scheduled. Promises with times already attached.
2. The targets. What the week is FOR — an amount of something, with no time attached, which is exactly why it loses to everything that has one unless you place it deliberately.
3. The ideal day for each weekday, and the last fortnight of what actually happened.

Seat the scheduled blocks first because they cannot move. Then seat the targets, in the order given, before anything discretionary. Meals, free time, buffers and wind-downs are what give way to a target — never the reverse. Only once every target is met do you fill the remainder from the ideal day.

If a target genuinely cannot fit — the week does not contain enough waking hours for all of them alongside what is already promised — say so plainly in the strategy, name which target fell short and by how much, and get as close as the week allows. Do not silently drop one, and do not pretend a day holds more than it does.

Rules:
- Everything already scheduled is fixed, EXCEPT blocks whose source is "plan" — those came from an earlier run of this planner and you may replace them freely. Anything else was put on the calendar deliberately. Reproduce each one at exactly its given title, start and end. Never move, rename, shorten or drop one. Build the rest of the day around them.
- Where a day has an ideal day, that is the skeleton. Keep its fixed points exactly — anything named unavailable, reserved, rest or date is not yours to move — and depart from the rest only where something already scheduled collides with it or a note gives you a reason.
- Where a day has no ideal day, build from what the recent record shows those weekdays usually look like.
- A target with period "day" must appear on every one of the seven days, not once with the total lumped in. A target with period "week" is a total across the week and may be distributed however the days allow.
- Check your own arithmetic before you answer: add up the minutes you allotted to each target across the seven days and compare them to weekly_minutes. State both figures in the strategy for the largest target.
- Every block must carry a category copied exactly from the "categories" list. Where a block exists to serve a target, use the category that target names — that is the only way the week can be totalled against it.
- Keep the blocks BROAD. "Film / Edit", "Study", "Exercise", "Dinner". This is the week at altitude; the detail gets planned on the morning of each day, by someone who knows more than you do about that day. Never invent tasks, subtasks, or specific errands.
- Do not fill every waking minute. A week with no slack is a week that breaks on Tuesday.
- The week must be livable end to end. If what is already scheduled makes a day heavy, let the surrounding blocks give way rather than stacking on top of them.
- The notes are the only source for things that are not on the calendar yet. Where a note names something without a time, place it where the day has room and say so in the strategy.
- Cite real numbers in the strategy — a target's last_week_minutes against its weekly_minutes, "Creative Mastery has had nothing for 12 days". Never invent a figure.
- State things plainly. No praise, no exhortation, no scripture quoted back at them.`;

async function proposeWeek(
  supabase: any,
  anthropic: Anthropic,
  tz: string,
  weekStart: string,
  notes?: string | null,
  overrides?: Array<{ label: string; weekly_minutes: number }> | null
) {
  const { data: context, error } = await supabase.rpc("week_context", { p_start: weekStart, p_tz: tz });
  if (error) throw new Error(`week_context: ${error.message}`);

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: WEEK_SYSTEM,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content:
          `Lay out the week of ${context.week_start} to ${context.week_end}.\n\n${JSON.stringify(context, null, 1)}` +
          (notes?.trim()
            ? `\n\nNotes they left about this week. These are FIXED FACTS and take priority over any pattern in the data above:\n${notes.trim()}`
            : "") +
          // A rebalance. They have looked at a draft, decided the split was
          // wrong, and moved the dials themselves — so these amounts replace
          // the targets rather than sitting alongside them, and the whole
          // point of the pass is that they come out exactly.
          (overrides?.length
            ? `\n\nThey have adjusted the amounts by hand after seeing a first draft. For THIS pass these replace the weekly_minutes on the matching targets and are not negotiable — hit each one to within fifteen minutes across the week, and take the time from whatever else the day holds:\n${overrides
                .map((o) => `- ${o.label}: ${(o.weekly_minutes / 60).toFixed(2)} hours across the week`)
                .join("\n")}`
            : ""),
      },
    ],
    output_config: { format: zodOutputFormat(WeekSchema) },
  });

  if (!response.parsed_output) throw new Error("The model returned nothing parsable.");

  // Only days that were actually asked about, and everything already on the
  // calendar re-attached from the record rather than trusted from the reply
  // — a silently dropped or shifted commitment is the one failure that would
  // cost a real promise. Blocks the planner itself wrote last time are not
  // re-attached; they are exactly what this run is allowed to replace.
  const asked = new Map((context.days ?? []).map((d: any) => [d.date, d]));
  const days = (response.parsed_output.days ?? [])
    .filter((d) => asked.has(d.date))
    .map((d) => {
      const source = asked.get(d.date) as any;
      const fixed = (source.scheduled ?? []).filter((c: any) => c.source !== "plan");
      const keys = new Set(fixed.map((c: any) => `${c.start}-${c.end}-${c.title}`));
      // A category the model invented is worse than none: it would be
      // counted toward nothing and coloured grey while looking deliberate.
      const known = new Set((context.categories ?? []).map((c: any) => c.name));
      const generated = (d.blocks ?? [])
        .filter((b) => !keys.has(`${b.start}-${b.end}-${b.title}`))
        .map((b) => ({
          title: b.title,
          category: known.has(b.category) ? b.category : null,
          start: b.start,
          end: b.end,
          source: "plan",
        }));
      return {
        date: d.date,
        weekday: source.weekday,
        note: d.note,
        ideal_day: source.ideal_day?.[0]?.name ?? null,
        blocks: [...fixed, ...generated].sort((a, b) => String(a.start).localeCompare(String(b.start))),
      };
    });

  return { strategy: response.parsed_output.strategy, week_start: context.week_start, days, usage: response.usage };
}

// ---------------------------------------------------------------------------
// suggest_goal_links
// ---------------------------------------------------------------------------

const LinkSchema = z.object({
  links: z
    .array(
      z.object({
        n: z.number().int().describe("The entry's own n, copied from the input."),
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

const LINK_SYSTEM = `You read logged time and decide which goal on a personal goal tree each stretch of time actually fed.

The descriptions are the point. Two entries can carry the same category tag and serve completely different goals — "Serve zone making app" is building something, "Help sister Shumway" is ministering to a person. Read what was actually written.

Rules:
- Answer with the entry's own "n". goal_id must be copied exactly from the supplied goals list; never invent an id or a goal name.
- Go as deep as the description supports. Credit rolls upward on its own: linking to a leaf also credits every goal above it, while linking to a pillar credits the pillar and nothing below. So a pillar link throws away everything the description told you. Reach for a goal with "leaf": true, and only settle higher when the description genuinely does not distinguish between that node's children.
- A goal near the top of the tree ("depth" 0 or 1) is the wrong answer unless nothing beneath it fits at all. If you are about to return one, read the goal list again for a descendant that fits.
- An entry's current_goal with "source": "mapping" was assigned by a blunt rule — every entry carrying one tag was given the same goal, without anyone reading the description. Do not treat it as a prior. Decide from the description as though the slot were empty, and expect to disagree with it often; that rule is exactly what this pass exists to correct. A current_goal with source "ai" or "manual" was a real decision, so keep it unless the description clearly says otherwise.
- Return null when the time honestly serves no goal on the tree — commuting, meals, and idle time usually do. A forced link is worse than none.
- Mark confidence honestly. "low" is the correct answer for a vague description like "Untitled Activity"; do not guess confidently to look useful.
- The tags are a hint, not the answer. Where the description contradicts the tag, follow the description.
- Return exactly one object per input entry, including ones that already carry a current_goal.`;

// One page at a time. An Edge Function is killed at 150 seconds of wall
// clock, and a 120-entry pass needs well past that once thinking is counted
// — it returned 504 having decided nothing and charged for the tokens
// anyway. The caller walks the backlog in short requests instead.
async function suggestGoalLinks(
  supabase: any,
  anthropic: Anthropic,
  tz: string,
  opts: { start: string; end: string; onlyUnlinked?: boolean; limit?: number; offset?: number }
) {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 40);
  const offset = Math.max(opts.offset ?? 0, 0);

  const { data: context, error } = await supabase.rpc("link_context", {
    p_start: opts.start,
    p_end: opts.end,
    p_tz: tz,
    p_only_unlinked: opts.onlyUnlinked ?? false,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(`link_context: ${error.message}`);
  if (!context?.entries?.length) {
    return { links: [], start: opts.start, end: opts.end, offset, matching: context?.matching ?? 0, remaining_after: 0 };
  }

  // The model never sees the ids, so it cannot mistype one.
  const idsByN: Record<string, string> = context.ids ?? {};

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: LINK_SYSTEM,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: `Decide what each of these ${context.entries.length} entries fed.\n\n${JSON.stringify(
          { ...context, ids: undefined },
          null,
          1
        )}`,
      },
    ],
    output_config: { format: zodOutputFormat(LinkSchema) },
  });

  if (!response.parsed_output) throw new Error("The model returned nothing parsable.");

  // Only hand back answers that name a real entry and a real goal. The
  // entry's own text rides along so the review screen can show what is
  // being linked without refetching the day.
  const entryByN = new Map(context.entries.map((e: any) => [Number(e.n), e]));
  const goalById = new Map(context.goals.map((g: any) => [g.id, g.path]));
  const links = response.parsed_output.links
    .filter((l) => entryByN.has(Number(l.n)) && idsByN[String(l.n)] && (l.goal_id === null || goalById.has(l.goal_id)))
    .map((l) => {
      const entry = entryByN.get(Number(l.n)) as any;
      return {
        entry_id: idsByN[String(l.n)],
        goal_id: l.goal_id,
        confidence: l.confidence,
        why: l.why,
        goal_path: l.goal_id ? goalById.get(l.goal_id) : null,
        what: entry?.what,
        minutes: entry?.minutes,
        day: entry?.day,
        // What the review screen shows as "was", so a change is legible as a
        // change. The source rides along because replacing a blunt category
        // default is a different act from overruling a considered link.
        current_goal: entry?.current_goal?.path ?? null,
        current_source: entry?.current_goal?.source ?? null,
        changed: (entry?.current_goal?.id ?? null) !== (l.goal_id ?? null),
      };
    });

  return {
    links,
    start: opts.start,
    end: opts.end,
    offset,
    matching: context.matching ?? links.length,
    remaining_after: context.remaining_after ?? 0,
    usage: response.usage,
  };
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

time_log_entries(id, category text, subcategory text, description text, started_at timestamptz, ended_at timestamptz, duration_minutes numeric, tags text[], goal_node_id uuid, goal_link_source text 'mapping'|'ai'|'manual')
  — the minute tracking. One row per stretch of tracked time. tags holds every category on the entry; category holds the first. Prefer unnest(tags) when a row can belong to several. goal_link_source says how goal_node_id was decided: 'mapping' is a blunt per-category default, so treat those links as weak evidence.
win_losses(id, occurred_at timestamptz, kind text 'win'|'loss', habit_label text, note text, goal_node_id uuid)
tasks(id, title text, date date, status boolean, time_chunk_id uuid, parent_task_id uuid, completed_at timestamptz, rollover_count int)
  — status true means done. parent_task_id not null means it is a subtask.
time_chunks(id, date date, title text, category text, start_time time, end_time time, goal_node_id uuid, source text 'manual'|'commitment'|'plan')
  — planned blocks. source 'plan' means generated by the week planner; anything else was put there deliberately.
weekly_targets(id, label text, categories text[], minutes int, period text 'week'|'day', active boolean)
  — standing quotas the week is planned around. minutes is per period; categories names which tracked categories count toward it.
day_plans(date date, energy_tag text, notes text, banked_at timestamptz, synopsis text)
journal_entries(date date, thoughts text, gratitude text, gods_hand text, q_christ text, q_principles text, q_success text, reflection_completed_at timestamptz)
prayer_logs(id, prayed_at timestamptz, context text, content text, felt_response text, tags text[])
spiritual_experiences(id, occurred_at timestamptz, kind text, what_came text, acted_on boolean, action_taken text)
study_notes(id, title text, body text, studied_on date, source_ref text, ai_theme text, ai_summary text)
nodes(id, title text, description text, is_completed boolean, is_focused boolean, last_activity_at timestamptz) and node_edges(child_id, parent_id) — the goal tree.
user_categories(id, name text, color text, family text, archived boolean)`;

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
      case "propose_week": {
        const weekStart = String(body.week_start ?? "").trim();
        if (!weekStart) return json({ error: "propose_week needs a week_start." }, 400);
        return json(await proposeWeek(supabase, anthropic, tz, weekStart, body.notes, body.overrides));
      }
      case "suggest_goal_links": {
        const start = body.start ?? body.date;
        const end = body.end ?? body.date;
        if (!start || !end) return json({ error: "suggest_goal_links needs a date or a start/end range." }, 400);
        return json(
          await suggestGoalLinks(supabase, anthropic, tz, {
            start,
            end,
            onlyUnlinked: body.onlyUnlinked,
            limit: body.limit,
            offset: body.offset,
          })
        );
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
