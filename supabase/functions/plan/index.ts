// The plan reader. Aaron uploads a plan (a page, a document, a PDF) and this
// reads it once into what a camp holds: sections in order, each with its
// steps in the plan's own words, and everything that isn't a step kept as
// notes to read beside the work. Nothing is saved here; the app shows what
// came back so it can be checked and changed before anything is kept.
//
// The caller's own token is checked, so the Anthropic key here can only be
// spent by someone signed in to the Hub.

import Anthropic from "npm:@anthropic-ai/sdk@^0.122.0";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk@^0.122.0/helpers/zod";
import { z } from "npm:zod@^4.4.3";
import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const MODEL = "claude-opus-5-5";

// About 15,000 words of text, or a PDF of a few megabytes.
const MAX_TEXT = 100_000;
const MAX_PDF_BASE64 = 11_000_000;

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

const StepSchema = z.object({
  text: z.string().describe("One thing to do or check, in the plan's own words."),
  note: z.string().describe("Detail that belongs to this step but isn't the step itself, or an empty string."),
});

const PlanSchema = z.object({
  title: z.string().describe("The plan's own title."),
  summary: z.string().describe("One or two sentences from the plan's introduction, in its words, or an empty string."),
  sections: z.array(
    z.object({
      title: z.string().describe("The section's heading, without its number."),
      why: z.string().describe("The short paragraph under the heading, or an empty string."),
      note: z.string().describe("Information in this section that isn't something to do, or an empty string."),
      steps: z.array(StepSchema),
    })
  ),
  notes: z.string().describe("Everything else in the plan that isn't a step, as Markdown in its own words, or an empty string."),
});

const SYSTEM = `In a private app, a man climbs each of his goals camp by camp, and each camp holds a checklist: steps grouped into sections. He has uploaded a plan he wants to work through. Turn it into that shape.

Rules:
- A section is a phase, stage or heading with things to do under it. Keep the plan's order. Leave numbers off the titles; the app numbers them.
- A step is one thing to do or check. Keep the plan's own words for every step: don't shorten, merge, split, reword, or add steps. Leave out checkbox marks and bullets.
- An example or aside that's part of a step's sentence stays in its text. A separate one goes in the step's note.
- A callout or warning that tells him to do something or wait for something becomes a step in its section, where it appears: its bold lead-in (or first sentence) is the step's text, and the rest of the callout is the step's note.
- Information inside a section that isn't something to do (who to check in with, a rule of thumb) goes in the section's note, in its words.
- A section's why is the short paragraph right under its heading (why it matters, or where it comes from), kept whole, when there is one.
- Material outside the sections that's worth reading while working (reference tables, principles, lists of things to avoid, background) goes in notes as Markdown with its headings, keeping its words. Write tables as Markdown tables.
- Leave out page furniture: buttons, progress counters, a legend explaining the page's own colors or labels, and footers about the page itself.
- If the plan has no sections, make one section named for the plan and put its steps there.`;

type Source = { text: string; filename: string } | { pdf: string; filename: string };

async function readPlan(anthropic: Anthropic, source: Source) {
  const name = source.filename ? `The file is called "${source.filename}".\n\n` : "";
  const content: Anthropic.ContentBlockParam[] =
    "pdf" in source
      ? [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: source.pdf } },
          { type: "text", text: `${name}Turn this plan into sections and steps.` },
        ]
      : [{ type: "text", text: `${name}<plan>\n${source.text}\n</plan>\n\nTurn this plan into sections and steps.` }];

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(PlanSchema), effort: "low" },
  });
  if (response.stop_reason === "refusal") throw new Error("The plan couldn't be read.");
  if (response.stop_reason === "max_tokens") throw new Error("That plan is too long to read in one go. Try it in parts.");
  if (!response.parsed_output) throw new Error("The plan came back unreadable.");
  return response.parsed_output;
}

// Trimmed, empty sections and steps left out.
function tidy(plan: z.infer<typeof PlanSchema>) {
  const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  return {
    title: s(plan.title, 200) || "A plan",
    summary: s(plan.summary, 2000),
    notes: s(plan.notes, 20000),
    sections: plan.sections
      .map((sec) => ({
        title: s(sec.title, 200),
        why: s(sec.why, 1000),
        note: s(sec.note, 4000),
        steps: sec.steps.map((st) => ({ text: s(st.text, 1000), note: s(st.note, 4000) })).filter((st) => st.text),
      }))
      .filter((sec) => sec.title && sec.steps.length),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only." }, 405);

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY is not set on this project." }, 503);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Not signed in." }, 401);

    const body = await req.json().catch(() => ({}));
    if (body.action !== "read") return json({ error: `Unknown action "${body.action}".` }, 400);

    const filename = String(body.filename ?? "").slice(0, 200);
    let source: Source;
    if (typeof body.pdf === "string" && body.pdf) {
      if (body.pdf.length > MAX_PDF_BASE64) return json({ error: "That PDF is too big. Try one under 8 MB." }, 400);
      source = { pdf: body.pdf, filename };
    } else {
      const text = String(body.text ?? "").trim();
      if (!text) return json({ error: "There's nothing in that plan to read." }, 400);
      if (text.length > MAX_TEXT) return json({ error: "That plan is too long to read in one go. Try it in parts." }, 400);
      source = { text, filename };
    }

    const plan = tidy(await readPlan(new Anthropic({ apiKey }), source));
    if (!plan.sections.length) return json({ error: "No steps were found in that plan." }, 422);
    return json({ plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
