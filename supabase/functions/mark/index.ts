// The Mark's reader. In the evening reflection, when an arrow misses and
// Aaron writes a line about the day, this reads the line and says which of
// the target's four sections it points to: what got in the way. It is only
// ever a first reading; one tap in the app changes it.
//
// It reads nothing from the database and writes nothing: the line, the four
// section names and the answers come in the request, and one number goes
// back. The caller's own token is still checked, so the Anthropic key here
// can only be spent by someone signed in to the Hub.

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

const ReadSchema = z.object({
  section: z
    .number()
    .int()
    .describe("The index (0 to 3) of the section the line points to, or -1 if the line says nothing about what got in the way."),
});

const READ_SYSTEM = `In a private app for tracking his life, a man answers each evening whether he hit what he aims at for one of his goals. When he falls short, the miss is filed under one of four reasons he named himself. He may write a line about the day. Read the line and pick the reason it points to.

Rules:
- Choose the reason the line describes, even when it uses other words: "I stayed up too late" is "Late night", "I wish I had taken more time to study" is "Didn't make time".
- Use only what the line says. A line that is only about what went well, or that gives no cause, gets -1.
- When it could be two, pick the one that is the cause rather than the effect.`;

async function readLine(
  anthropic: Anthropic,
  input: { target: string; reasons: string[]; line: string; answers: { text: string; v: number }[] }
) {
  const answered = input.answers
    .map((a) => `- ${a.text}: ${a.v === 2 ? "Yes" : a.v === 1 ? "Some" : "No"}`)
    .join("\n");
  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: READ_SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Goal: ${input.target}\n\nWhat a bullseye takes, and how he answered tonight:\n${answered}\n\n` +
          `The four reasons:\n${input.reasons.map((r, k) => `${k}. ${r}`).join("\n")}\n\n` +
          `His line:\n<line>${input.line}</line>`,
      },
    ],
    output_config: { format: zodOutputFormat(ReadSchema), effort: "low" },
  });
  // A declined or empty reading is no reading: the app falls back to its
  // own, then to a guess.
  if (response.stop_reason === "refusal" || !response.parsed_output) return -1;
  return response.parsed_output.section;
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

    const line = String(body.line ?? "").trim();
    const reasons = Array.isArray(body.reasons) ? body.reasons.map((r: unknown) => String(r ?? "").trim()) : [];
    if (!line) return json({ section: -1 });
    if (line.length > 2000) return json({ error: "That line is too long." }, 400);
    if (reasons.length !== 4 || reasons.some((r: string) => !r || r.length > 60)) {
      return json({ error: "read needs the four section names." }, 400);
    }
    const answers = (Array.isArray(body.answers) ? body.answers : [])
      .slice(0, 8)
      .map((a: any) => ({ text: String(a?.text ?? "").slice(0, 120), v: Number(a?.v) }))
      .filter((a: { text: string; v: number }) => a.text && [0, 1, 2].includes(a.v));

    const section = await readLine(new Anthropic({ apiKey }), {
      target: String(body.target ?? "").slice(0, 200),
      reasons,
      line,
      answers,
    });
    return json({ section: section >= 0 && section <= 3 ? section : -1 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
