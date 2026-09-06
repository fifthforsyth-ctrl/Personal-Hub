// Mining a long source for the handful of lines worth keeping.
//
// A morning's scripture study runs thousands of words and you are never going
// to reread it. But somewhere in it is one sentence you'd want handed back on
// a hard Tuesday. This finds those, verbatim, and they become cards the
// curator can then choose from — the same thing highlighting does by hand,
// done for you across a vault you'd never otherwise get through.
//
// Its own function rather than another action on `assistant`: it has one job,
// it's the only thing that needs this prompt, and keeping it separate means
// deploying a change here can't disturb the plan proposals or the day
// synopsis.
//
// Two ways in, same as the curator: the nightly cron with a shared secret, and
// the app with your ordinary JWT. Because the cron has no login, verify_jwt is
// off and this authenticates itself — no valid secret and no valid token means
// 401, never "carry on anyway".
//
// The unattended run has to KEEP what it finds, since nobody is awake to accept
// a snippet. Those cards are flagged auto_kept so the app can offer a short
// pass over them; they are usable by the curator immediately either way.

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

const MineSchema = z.object({
  snippets: z
    .array(
      z.object({
        quote: z
          .string()
          .describe("The passage, copied EXACTLY and character-for-character from the note. Never paraphrased, never re-punctuated, never trimmed differently."),
        essence: z
          .string()
          .describe("The one line this comes back as later. Usually a light tightening of the quote; occasionally your own words when the quote only makes sense in place."),
        kind: z
          .enum(["revelation", "insight", "motivation", "counsel", "question", "resolve", "thought"])
          .describe("What this is. revelation = something that came to them. insight = something they worked out. motivation = something to return to on a hard day. counsel = something another person told them. question = something unresolved. resolve = something they decided to do."),
        why: z.string().describe("One short clause on why this is worth keeping out of everything else in the note."),
      })
    )
    .describe("Between two and eight passages, scaled to the length of the note. Fewer is correct when it is mostly summary."),
});

const SYSTEM = `You read one of a person's own study notes and pull out the handful of passages worth keeping as standalone cards.

They are a member of The Church of Jesus Christ of Latter-day Saints serving as a missionary. These notes are written during morning scripture study and run long — often several thousand words. Most of any given note is working-out: restating the verse, thinking aloud, trailing off, picking the thread back up. That is not what you are looking for.

You are looking for the few places where a complete thought actually landed. A line that would still mean something read alone, months later, with none of the surrounding note. In a long note there are usually between four and eight of these; in a short one, one or two. Length of the note is not a quota — scan the whole thing and take what is genuinely there.

Take:
- a conclusion they reached, stated in their own words
- a resolve, however small and however casually put
- a sentence that reframes something
- something that reads like it cost them something to write
- a quoted line from scripture or a talk that they clearly stopped on

Leave:
- restating what the verse says without adding anything
- throat-clearing, or a sentence that only makes sense with the next one
- anything that needs the paragraph around it to be understood
- a passage whose only virtue is that it sounds nice

Hard rules:
- The quote MUST be copied exactly, character for character, from the note. Do not fix a typo, change punctuation, expand an abbreviation, or join two sentences that are apart in the original. It is anchored back into the note by exact match, and anything altered is thrown away.
- Prefer one to three sentences. A whole paragraph is almost never a single keepable thought.
- Return fewer rather than padding. Three good ones beat eight with five fillers. Returning an empty list is correct for a note that is entirely summary.
- Spread your attention across the whole note. A long note's best line is as often in the last third as the first, and taking everything from the opening paragraphs is a sign you stopped reading.
- The essence is what they will see on a busy day — it must stand completely alone.
- No praise, no commentary on their spiritual state, no encouragement.`;

// How many sources one unattended run works through. Deliberately small: 61
// notes at three a night is three weeks, which feeds the curator steadily
// instead of dumping two hundred unreviewed cards on the shelf at once.
const NIGHTLY_BATCH = 3;

async function mineAndKeep(supabase: any, anthropic: Anthropic, userId: string | null, limit: number) {
  const { data: sources, error } = await supabase.rpc("unmined_sources_for", {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) throw new Error(`unmined_sources_for: ${error.message}`);

  const done = [];
  for (const source of sources ?? []) {
    try {
      const mined = await anthropicMine(anthropic, source);
      for (const snippet of mined.snippets) {
        const { error: keepError } = await supabase.rpc("keep_snippet", {
          p_user_id: userId,
          p_source_id: source.id,
          p_quote: snippet.quote,
          p_essence: snippet.essence,
          p_kind: snippet.kind,
          p_start: snippet.start_offset,
          p_end: snippet.end_offset,
          p_auto: true,
        });
        if (keepError) throw new Error(`keep_snippet: ${keepError.message}`);
      }

      await supabase
        .from("study_notes")
        .update({ mined_at: new Date().toISOString(), mined_count: mined.snippets.length })
        .eq("id", source.id);

      done.push({ source: source.title, kept: mined.snippets.length, dropped: mined.dropped });
    } catch (err) {
      // One bad note must not abandon the rest of the batch, and it must not
      // be marked mined either — it comes round again tomorrow.
      done.push({ source: source.title, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return done;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY is not set on this project." }, 503);

    const anthropic = new Anthropic({ apiKey });
    const cronSecret = Deno.env.get("CRON_SECRET");
    const presentedSecret = req.headers.get("x-cron-secret");

    // --- the nightly run ----------------------------------------------------
    if (cronSecret && presentedSecret && presentedSecret === cronSecret) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: profiles, error: profileError } = await admin.from("profiles").select("id");
      if (profileError) throw new Error(`profiles: ${profileError.message}`);

      const results = [];
      for (const profile of profiles ?? []) {
        try {
          results.push({ user: profile.id, mined: await mineAndKeep(admin, anthropic, profile.id, NIGHTLY_BATCH) });
        } catch (err) {
          results.push({ user: profile.id, error: err instanceof Error ? err.message : String(err) });
        }
      }
      return json({ ran: "cron", results });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Not signed in." }, 401);

    const body = await req.json().catch(() => ({}));
    const noteId = String(body.note_id ?? "").trim();
    if (!noteId) return json({ error: "This needs a note_id." }, 400);

    // RLS means a note that isn't theirs simply isn't found.
    const { data: note, error } = await supabase
      .from("study_notes")
      .select("id, title, body, source_ref, studied_on")
      .eq("id", noteId)
      .single();
    if (error) throw new Error(`study_notes: ${error.message}`);
    if (!note?.body?.trim()) return json({ note_id: noteId, title: note?.title, snippets: [], dropped: 0 });

    const response = await anthropicMine(anthropic, note);
    return json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});

// Exact match first. Failing that, match ignoring how whitespace fell —
// these notes wrap mid-sentence and a model that re-flows a line onto one
// row has still identified the right passage. Anything looser than that is
// guessing, so it stops here.
function findQuote(body: string, quote: string): { start: number; end: number } | null {
  const exact = body.indexOf(quote);
  if (exact !== -1) return { start: exact, end: exact + quote.length };

  const words = quote.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  const match = new RegExp(pattern).exec(body);
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}

async function anthropicMine(anthropic: Anthropic, note: any) {
  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 10000,
    system: SYSTEM,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: `Note title: ${note.title}\nStudied: ${note.studied_on ?? "unknown"}${
          note.source_ref ? `\nReference: ${note.source_ref}` : ""
        }\n\n---\n${note.body}\n---`,
      },
    ],
    output_config: { format: zodOutputFormat(MineSchema) },
  });

  if (!response.parsed_output) throw new Error("The model returned nothing parsable.");

  // Anchor every quote and drop the ones that don't land. A paraphrase would
  // store a highlight pointing at text that isn't there, and a silently-wrong
  // anchor is worse than a missing snippet.
  const snippets = response.parsed_output.snippets
    .map((s) => {
      const at = findQuote(note.body, s.quote);
      return at ? { ...s, quote: note.body.slice(at.start, at.end), start_offset: at.start, end_offset: at.end } : null;
    })
    .filter(Boolean);

  return {
    note_id: note.id,
    title: note.title,
    snippets,
    dropped: response.parsed_output.snippets.length - snippets.length,
    usage: response.usage,
  };
}
