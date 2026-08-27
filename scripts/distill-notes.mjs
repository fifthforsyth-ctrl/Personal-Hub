#!/usr/bin/env node
//
// Reads study notes that haven't been distilled yet and writes back a theme,
// a short summary, and the core points — alongside the original, never over
// it. Long study notes are hard to re-enter months later; this gives each
// one a way in without the full text being lost or paraphrased away.
//
// Runs HERE, on your Mac, not in the browser and not in the database: the
// Anthropic API key stays in scripts/.env.local and never ships anywhere.
// Notes only arrive via the vault sync (which also runs here), so distilling
// them here keeps the whole pipeline on one machine.
//
// Usage:
//   node scripts/distill-notes.mjs              # distill anything unprocessed
//   node scripts/distill-notes.mjs --limit 5    # cap the batch
//   node scripts/distill-notes.mjs --redo       # re-distill everything
//
// Cost: roughly $0.02 per note at Opus 5 rates. A month of daily study is
// well under a dollar. This is the one part of Personal Hub that isn't free.

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const SUPABASE_URL = "https://bfednxteqhjljqdfdvsq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZWRueHRlcWhqbGpxZGZkdnNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTM1NTgsImV4cCI6MjEwMzQyOTU1OH0.Tft8vrFtjWnM-gVWD40IZVnrRqS99ivPq8W7H4qi50M";

const MODEL = "claude-opus-5";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const LIMIT = Number(arg("limit", "25"));
const REDO = process.argv.includes("--redo");

const DistillationSchema = z.object({
  theme: z.string().describe("The single overall theme of this note, as a short phrase (under 10 words)."),
  summary: z.string().describe("Two or three sentences capturing what this note is actually about."),
  key_points: z
    .array(z.string())
    .describe("The core aspects of the note, one per item, in the note's own terms. Between 1 and 6 of them."),
  connections: z
    .array(z.string())
    .describe("Doctrinal or thematic threads this note could connect to later, as short phrases. May be empty."),
});

// The note is a record of someone's own study and revelation. The job is to
// make it findable again, not to grade it, improve it, or preach back at it.
const SYSTEM = `You distill personal scripture-study and gospel-study notes for a private archive belonging to a member of The Church of Jesus Christ of Latter-day Saints.

Your job is to make a long note re-enterable months later. For each note, identify:
- the single overall theme
- a short summary of what it is actually about
- the core points, in the writer's own terms and vocabulary
- thematic threads that might connect to other notes over time

Rules:
- Use the writer's own language and framing. Do not substitute your own doctrinal phrasing for theirs.
- Do not evaluate, correct, encourage, or add commentary of your own. You are indexing, not responding.
- If a note is fragmentary or unfinished, say what is there. Do not invent structure that isn't in it.
- Keep every field terse. This sits above the full note, which is always kept and always readable.`;

async function main() {
  const email = process.env.HUB_EMAIL;
  const password = process.env.HUB_PASSWORD;
  if (!email || !password) {
    console.error("Set HUB_EMAIL and HUB_PASSWORD (see scripts/README.md).");
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY (see scripts/README.md).");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    console.error("Sign-in failed:", authError.message);
    process.exit(1);
  }

  let query = supabase
    .from("study_notes")
    .select("id, title, body, source_kind, source_ref, studied_on")
    .eq("user_id", auth.user.id)
    .order("studied_on", { ascending: false })
    .limit(LIMIT);
  if (!REDO) query = query.is("ai_processed_at", null);

  const { data: notes, error } = await query;
  if (error) throw error;

  if (!notes || notes.length === 0) {
    console.log("Nothing to distill.");
    await supabase.auth.signOut();
    return;
  }

  console.log(`Distilling ${notes.length} note${notes.length === 1 ? "" : "s"} with ${MODEL}…\n`);
  const client = new Anthropic();
  let done = 0;

  for (const note of notes) {
    process.stdout.write(`  ${note.title.slice(0, 52)}… `);
    try {
      const response = await client.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        system: SYSTEM,
        thinking: { type: "adaptive" },
        messages: [
          {
            role: "user",
            content: [
              `Title: ${note.title}`,
              note.source_ref ? `Reference: ${note.source_ref}` : null,
              `Studied: ${note.studied_on}`,
              "",
              note.body,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        output_config: { format: zodOutputFormat(DistillationSchema) },
      });

      const parsed = response.parsed_output;
      if (!parsed) {
        console.log("✗ (no parsable output)");
        continue;
      }

      const { error: saveError } = await supabase
        .from("study_notes")
        .update({
          ai_theme: parsed.theme,
          ai_summary: parsed.summary,
          ai_key_points: parsed.key_points,
          ai_model: MODEL,
          ai_processed_at: new Date().toISOString(),
          tags: undefined, // leave the vault's own tags alone
          updated_at: new Date().toISOString(),
        })
        .eq("id", note.id);

      if (saveError) {
        console.log(`✗ ${saveError.message}`);
        continue;
      }

      done += 1;
      console.log(`✓ ${parsed.theme}`);
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) console.log("✗ rate limited — rerun shortly");
      else if (err instanceof Anthropic.AuthenticationError) console.log("✗ bad ANTHROPIC_API_KEY");
      else if (err instanceof Anthropic.APIError) console.log(`✗ API ${err.status}: ${err.message}`);
      else console.log(`✗ ${err.message}`);
    }
  }

  console.log(`\nDistilled ${done} of ${notes.length}.`);
  await supabase.auth.signOut();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
