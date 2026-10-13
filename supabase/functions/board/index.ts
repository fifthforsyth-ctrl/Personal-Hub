// The Board's quiet filing: a one-line gist and a few tags for each thought.
//
// A thought is kept exactly as you wrote it, as one card. What this adds is
// for later: the gist says what the thought is ABOUT, in a line, and the tags
// are the words you'd search for months from now. The search box reads both,
// and so does the curator when it chooses what to bring back. Neither is
// shown on the card, which still reads in your own words.
//
// Its own function, like the miner: one small job, and deploying it can't
// disturb the assistant. It runs as you (verify_jwt on, your JWT forwarded),
// so it can only ever read and file your own notes.

import Anthropic from "npm:@anthropic-ai/sdk@^0.122.0";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk@^0.122.0/helpers/zod";
import { z } from "npm:zod@^4.4.3";
import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

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

const GistSchema = z.object({
  gist: z
    .string()
    .describe("One line, at most fifteen words, saying what the thought is about. Empty only when there is nothing to say."),
  tags: z
    .array(z.string())
    .describe("Two to five lowercase tags: the people, themes, places or scripture books it touches."),
});

const SYSTEM = `You file one of a person's own captured thoughts so it can be found again later. They are a member of The Church of Jesus Christ of Latter-day Saints, and the thought may be spiritual, practical, or anything in between.

Write two things.

The gist: one plain line, at most fifteen words, naming what the thought is ABOUT. Not a restatement of its wording and not a summary of its argument: the subject, the way they'd describe it if asked "what was that note?". "Choosing patience with the kids when tired" rather than "A reflection on the importance of patience".

The tags: two to five lowercase tags, each one or two words. Use the words they would actually search for later: a person's name, a theme ("patience", "prayer", "work"), a place, a scripture book ("alma", "d&c"). No generic tags like "thought", "note", "spiritual" or "life".

Rules:
- Use only what is in the text. Never invent a person, a reference or a theme it doesn't touch.
- No praise, no commentary, no advice.
- If the text is too short or empty to say anything, return an empty gist and no tags.`;

// Notes are filed a few at a time: each is a short call, and the function
// has 150 seconds of wall clock in all.
const BACKLOG_MAX = 8;
const AT_ONCE = 3;

async function fileNote(supabase: any, anthropic: Anthropic, note: any) {
  const text = [note.title, note.excerpt, note.body].filter((s) => s && String(s).trim()).join("\n\n").slice(0, 6000);

  let gist = "";
  let tags: string[] = [];
  if (text.trim().length > 15) {
    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: "user", content: `The thought:\n---\n${text}\n---` }],
      output_config: { format: zodOutputFormat(GistSchema), effort: "low" },
    });
    const out = response.parsed_output;
    if (!out) throw new Error("The model returned nothing parsable.");
    gist = out.gist.trim().slice(0, 200);
    tags = [...new Set(out.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 5);
  }

  // Stamped even when there was nothing to say, so it isn't asked again.
  const { error } = await supabase
    .from("study_notes")
    .update({ gist: gist || null, ai_tags: tags, gist_at: new Date().toISOString() })
    .eq("id", note.id);
  if (error) throw new Error(`study_notes: ${error.message}`);
  return { id: note.id, gist, tags };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY is not set on this project." }, 503);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    // The caller's own token: RLS applies to everything this client does.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Not signed in." }, 401);

    const anthropic = new Anthropic({ apiKey });
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "gist";
    const columns = "id, title, body, excerpt";

    if (action === "gist") {
      const noteId = String(body.note_id ?? "").trim();
      if (!noteId) return json({ error: "gist needs a note_id." }, 400);
      // RLS means a note that isn't theirs simply isn't found.
      const { data: note, error } = await supabase.from("study_notes").select(columns).eq("id", noteId).single();
      if (error) throw new Error(`study_notes: ${error.message}`);
      return json(await fileNote(supabase, anthropic, note));
    }

    if (action === "gist_backlog") {
      const limit = Math.min(Math.max(Number(body.limit) || BACKLOG_MAX, 1), BACKLOG_MAX);
      // Your own thoughts only: vault notes are long sources, and cards cut
      // from a note are already filed under it.
      const { data: notes, error } = await supabase
        .from("study_notes")
        .select(columns)
        .eq("user_id", userData.user.id)
        .is("gist_at", null)
        .is("parent_note_id", null)
        .is("obsidian_uid", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`study_notes: ${error.message}`);

      const filed = [];
      const failed = [];
      const queue = [...(notes ?? [])];
      // A note that fails is left unstamped and comes round again next time;
      // it doesn't stop the rest.
      await Promise.all(
        Array.from({ length: AT_ONCE }, async () => {
          while (queue.length) {
            const note = queue.shift();
            try {
              filed.push(await fileNote(supabase, anthropic, note));
            } catch (err) {
              failed.push({ id: note.id, error: err instanceof Error ? err.message : String(err) });
            }
          }
        })
      );
      return json({ filed: filed.length, failed, more: (notes?.length ?? 0) === limit });
    }

    return json({ error: `Unknown action "${action}".` }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
