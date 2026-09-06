// The curator. Chooses what comes back to you today, and why.
//
// This is deliberately NOT "you haven't seen this in a while". That produces a
// museum. The job here is to read where you actually are — the last ten days,
// what you wrote in your reflections, which goals have gone quiet, what's
// still unfinished — and then find the cards that speak to THAT. A quote you
// saw last week is the right answer if it's the right quote today.
//
// Two ways in, one body of logic:
//   · the midnight cron, authenticated by a shared secret, running for every
//     user with no login of its own
//   · the app itself, authenticated by your ordinary JWT, when it opens on a
//     day the cron didn't cover
//
// Because the cron has no login, verify_jwt is off and this function does its
// own authentication. Neither path is allowed to fall through: no valid secret
// and no valid token means 401, never "carry on anyway".

import Anthropic from "npm:@anthropic-ai/sdk@^0.122.0";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk@^0.122.0/helpers/zod";
import { z } from "npm:zod@^4.4.3";
import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const MODEL = "claude-opus-5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const SelectionSchema = z.object({
  situation: z
    .string()
    .describe("One or two sentences on where this person actually is right now, read from their last ten days. Plain, specific, no encouragement."),
  home: z
    .array(
      z.object({
        note_id: z.string().describe("The id of the card, copied exactly from the candidates list."),
        reason: z.string().describe("One sentence: why THIS, TODAY. Name the thing in their current situation it answers."),
      })
    )
    .describe("One to three cards for the front page. Strongly prefer quotes and motivational thoughts, especially ones with an image."),
  day: z
    .array(
      z.object({
        note_id: z.string(),
        reason: z.string(),
      })
    )
    .describe("Two to four cards for the day page. Any kind. This is where counsel, experiences and old ideas belong."),
});

const SYSTEM = `You choose which of a person's own saved cards should come back to them today.

They are a member of The Church of Jesus Christ of Latter-day Saints serving as a missionary. The cards are things they wrote down and wanted to keep: spiritual experiences, quotes from people they admire, counsel from mentors, insights, resolves, and passing ideas.

WHAT THIS IS NOT: a rotation. Do not choose a card because it hasn't been shown lately. "last_shown" is given to you only so you can break a genuine tie and avoid repeating yesterday — it is never a reason on its own. A card shown three days ago is the right choice if it is the right card today.

WHAT THIS IS: matching. Read their situation first — the last ten days, what they wrote in their reflections, which goals have gone quiet, what tasks keep rolling over, what is on tomorrow. Then find the cards that speak to that specific situation.

Good matches look like:
- counsel from a mentor about a thing they are visibly struggling with this week
- a spiritual experience from months ago about the exact discouragement they just wrote about
- a quote about persistence on the fourth day of a task rolling over
- an old idea that has suddenly become relevant to something now on their plan

Bad matches, which you must avoid:
- a card chosen because it is old or unseen
- a generically uplifting quote with no connection to this week
- a card whose reason could be written for any day of the year
- anything that reads as praise or as a scolding

Rules:
- note_id must be copied exactly from the candidates. Never invent one.
- Never choose the same card for both slots.
- The reason is for them to read. One sentence, plain, naming the actual connection: "you have written about feeling behind three days running, and this is what Elder Bednar told you about that." Not "this is an inspiring thought."
- If nothing genuinely fits a slot, return fewer. An honest three is better than a padded six. Returning an empty home slot is allowed when there is truly nothing apt.
- If they have scored past picks, those scores are the most important instruction you have. Low scores with a note tell you exactly what kind of match they do not want; do not repeat that pattern. High scores tell you what landed.
- Never comment on their spiritual standing. You are choosing what to hand them, not assessing them.`;

async function curateFor(supabase: any, anthropic: Anthropic, userId: string | null, tz: string, date: string | null) {
  const { data: context, error } = await supabase.rpc("curate_context", {
    p_user_id: userId,
    p_tz: tz,
    p_date: date,
  });
  if (error) throw new Error(`curate_context: ${error.message}`);
  if (!context?.cards?.length) return { skipped: "no cards to choose from", for_date: context?.today };

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 12000,
    system: SYSTEM,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: `Choose what should come back to this person on ${context.today} (${context.weekday}).\n\n${JSON.stringify(context, null, 1)}`,
      },
    ],
    output_config: { format: zodOutputFormat(SelectionSchema) },
  });

  const out = response.parsed_output;
  if (!out) throw new Error("The model returned nothing parsable.");

  // Guard against the same card landing in both slots — the model is told not
  // to, and the front page winning is the right tiebreak.
  const seen = new Set<string>();
  const items = [
    ...out.home.map((i) => ({ ...i, slot: "home" })),
    ...out.day.map((i) => ({ ...i, slot: "day" })),
  ].filter((i) => {
    if (seen.has(i.note_id)) return false;
    seen.add(i.note_id);
    return true;
  });

  const { error: saveError } = await supabase.rpc("save_daily_selection", {
    p_user_id: userId,
    p_date: context.today,
    p_situation: out.situation,
    p_items: items,
  });
  if (saveError) throw new Error(`save_daily_selection: ${saveError.message}`);

  return { for_date: context.today, situation: out.situation, count: items.length, usage: response.usage };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY is not set on this project." }, 503);

    const anthropic = new Anthropic({ apiKey });
    const body = await req.json().catch(() => ({}));

    const cronSecret = Deno.env.get("CRON_SECRET");
    const presentedSecret = req.headers.get("x-cron-secret");
    const isCron = Boolean(cronSecret && presentedSecret && presentedSecret === cronSecret);

    // --- the midnight run ---------------------------------------------------
    if (isCron) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: profiles, error: profileError } = await admin
        .from("profiles")
        .select("id, timezone");
      if (profileError) throw new Error(`profiles: ${profileError.message}`);

      const results = [];
      for (const profile of profiles ?? []) {
        const tz = profile.timezone || "America/Denver";
        // The local date for this user right now. The job runs at two UTC
        // hours so it lands on local midnight on both sides of daylight
        // saving; whichever fires second finds the row already there.
        const localDate = new Date().toLocaleDateString("en-CA", { timeZone: tz });

        const { data: existing } = await admin
          .from("daily_selections")
          .select("id")
          .eq("user_id", profile.id)
          .eq("for_date", localDate)
          .maybeSingle();

        if (existing) {
          results.push({ user: profile.id, skipped: "already curated", for_date: localDate });
          continue;
        }

        try {
          results.push({ user: profile.id, ...(await curateFor(admin, anthropic, profile.id, tz, localDate)) });
        } catch (err) {
          // One user's failure must not abandon the rest of the run.
          results.push({ user: profile.id, error: err instanceof Error ? err.message : String(err) });
        }
      }

      return json({ ran: "cron", results });
    }

    // --- the app asking for today, with your own login ----------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Not signed in." }, 401);

    const tz = body.tz ?? "America/Denver";
    // Null user id: curate_context falls back to auth.uid(), and RLS does the
    // rest. This path can only ever reach the caller's own rows.
    return json(await curateFor(supabase, anthropic, null, tz, body.date ?? null));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
