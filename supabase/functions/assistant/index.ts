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

async function proposePlan(supabase: any, anthropic: Anthropic, tz: string) {
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
        content: `Here is the recent record. Propose three plans for ${context.tomorrow} (${String(
          context.tomorrow_weekday ?? ""
        ).trim()}).\n\n${JSON.stringify(context, null, 1)}`,
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
        return json(await proposePlan(supabase, anthropic, tz));
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
