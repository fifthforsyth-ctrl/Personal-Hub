// The sketch reader. Aaron sketches what he's thinking on a quest line (a
// task or a note line) or a camp step, mostly with a pencil on his iPad, and
// taps Analyze. This looks at the sketch with what it's on (the line's words
// and notes, the lines around it, the quest or camp) and sums up what he
// jotted down. What it writes is kept on the sketch.
//
// The caller's own token is checked and every read goes through it, so it
// can only see his own things, and the Anthropic key here can only be spent
// by someone signed in to the Hub.

import Anthropic from "npm:@anthropic-ai/sdk@^0.122.0";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk@^0.122.0/helpers/zod";
import { z } from "npm:zod@^4.4.3";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@^2.45.0";

const MODEL = "claude-opus-5-5";

// A PNG of up to about 4.8 MB (the reader takes images up to 5 MB).
const MAX_IMAGE_BASE64 = 6_500_000;

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
  title: z.string().describe("A name for the sketch in a few words (at most 8), the way he'd name it."),
  summary: z
    .string()
    .describe(
      "What he jotted down, as Markdown: a one or two sentence gist, then a short bulleted list of the ideas, decisions, questions and next steps in the sketch, in his own words where the writing gives them."
    ),
});

const SYSTEM = `In a private app, a man keeps a running list for each of his quests (the big things he's working toward) and a checklist of steps for each camp on the way. He drew a sketch on one of the lines or steps, mostly with a pencil on his iPad, to think something through. Read it and sum up what he jotted down, so he can see his thinking laid out plainly next to the sketch.

How to read it:
- Read the handwriting, labels, arrows, boxes, lists and diagrams. Arrows usually mean flow or cause; boxes are things or screens; crossed-out words are dropped ideas; circled or underlined things matter most.
- Use what the sketch is on (the line's words and notes, the lines around it, the quest or camp) to understand what it's about and to read words that are hard to make out. Don't summarize that context itself; it's only there to help you read the sketch.
- Keep his words and terms. Don't add ideas, advice or steps that aren't in the sketch.
- If part of it can't be read, say so plainly (for example: one word by the arrow isn't legible) rather than guessing.
- If the page is nearly empty or just a doodle, say that in a sentence and keep the summary short.

How to write it:
- Start with a one or two sentence gist of what the sketch is working out.
- Then a short bulleted list ("- " at the start of each line), one point per idea, decision, question or next step, in the order the sketch lays them out. Bold a short lead-in (**like this**) only where it helps the eye.
- Plain, warm and direct. Address him as "you" if you need to address him at all. No headings, no preamble, no closing line.`;

type Context = { label: string; lines: string[] };

const clip = (v: unknown, max: number) => {
  const s = String(v ?? "").trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

// What the sketch is on, with the things around it, read as him.
async function contextOf(db: SupabaseClient, sketch: { quest_task_id: string | null; camp_step_id: string | null }): Promise<Context> {
  const lines: string[] = [];
  if (sketch.quest_task_id) {
    const { data: t, error } = await db.from("quest_tasks").select("id, quest_id, parent_id, kind, text, note, day").eq("id", sketch.quest_task_id).maybeSingle();
    if (error) throw error;
    if (!t) throw new Error("The line this sketch was on is gone.");
    const [quest, parent, subs, day] = await Promise.all([
      db.from("quests").select("title, note").eq("id", t.quest_id).maybeSingle(),
      t.parent_id ? db.from("quest_tasks").select("text").eq("id", t.parent_id).maybeSingle() : Promise.resolve({ data: null }),
      db.from("quest_tasks").select("text, kind").eq("parent_id", t.id).order("position").limit(30),
      db.from("quest_tasks").select("id, text, kind").eq("quest_id", t.quest_id).eq("day", t.day).is("parent_id", null).order("position").limit(40),
    ]);
    const kind = t.kind === "note" ? "a note line" : t.parent_id ? "a sub-task" : "a task";
    if (quest.data?.title) lines.push(`Quest: ${clip(quest.data.title, 300)}`);
    if (quest.data?.note) lines.push(`The quest's notes:\n${clip(quest.data.note, 3000)}`);
    if (parent.data?.text) lines.push(`It sits under the task: ${clip(parent.data.text, 500)}`);
    lines.push(`The sketch is on ${kind} on his list for ${t.day}: ${clip(t.text, 2000)}`);
    if (t.note) lines.push(`Its notes:\n${clip(t.note, 6000)}`);
    const under = (subs.data ?? []).map((s: { text: string }) => `- ${clip(s.text, 300)}`);
    if (under.length) lines.push(`Under it:\n${under.join("\n")}`);
    const rest = (day.data ?? []).filter((x: { id: string }) => x.id !== t.id && x.id !== t.parent_id).map((x: { text: string }) => `- ${clip(x.text, 200)}`);
    if (rest.length) lines.push(`The rest of that day's list:\n${rest.join("\n")}`);
    return { label: kind, lines };
  }
  const { data: st, error } = await db.from("camp_steps").select("id, camp_id, section_id, parent_id, text, note").eq("id", sketch.camp_step_id).maybeSingle();
  if (error) throw error;
  if (!st) throw new Error("The step this sketch was on is gone.");
  const [camp, section, parent, subs] = await Promise.all([
    db.from("quest_camps").select("title, note, quest_id").eq("id", st.camp_id).maybeSingle(),
    st.section_id ? db.from("camp_sections").select("title, why").eq("id", st.section_id).maybeSingle() : Promise.resolve({ data: null }),
    st.parent_id ? db.from("camp_steps").select("text").eq("id", st.parent_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("camp_steps").select("text").eq("parent_id", st.id).order("position").limit(30),
  ]);
  const quest = camp.data?.quest_id ? await db.from("quests").select("title").eq("id", camp.data.quest_id).maybeSingle() : { data: null };
  const kind = st.parent_id ? "a sub-step" : "a step";
  if (quest.data?.title) lines.push(`Quest: ${clip(quest.data.title, 300)}`);
  if (camp.data?.title) lines.push(`Camp: ${clip(camp.data.title, 300)}`);
  if (camp.data?.note) lines.push(`The camp's notes:\n${clip(camp.data.note, 3000)}`);
  if (section.data?.title) lines.push(`Section: ${clip(section.data.title, 300)}${section.data.why ? ` (${clip(section.data.why, 600)})` : ""}`);
  if (parent.data?.text) lines.push(`It sits under the step: ${clip(parent.data.text, 500)}`);
  lines.push(`The sketch is on ${kind}: ${clip(st.text, 2000)}`);
  if (st.note) lines.push(`Its notes:\n${clip(st.note, 4000)}`);
  const under = (subs.data ?? []).map((s: { text: string }) => `- ${clip(s.text, 300)}`);
  if (under.length) lines.push(`Under it:\n${under.join("\n")}`);
  return { label: kind, lines };
}

async function readSketch(anthropic: Anthropic, image: string, context: Context) {
  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `<context>\n${context.lines.join("\n\n")}\n</context>` },
          { type: "image", source: { type: "base64", media_type: "image/png", data: image } },
          { type: "text", text: `That's the sketch he drew on ${context.label}. Sum up what he jotted down.` },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(ReadSchema), effort: "medium" },
  });
  if (response.stop_reason === "refusal") throw new Error("The sketch couldn't be read.");
  if (response.stop_reason === "max_tokens") throw new Error("The summary ran too long. Try again.");
  if (!response.parsed_output) throw new Error("The sketch came back unread.");
  return response.parsed_output;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only." }, 405);

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY is not set on this project." }, 503);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await db.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Not signed in." }, 401);

    const body = await req.json().catch(() => ({}));
    if (body.action !== "analyze") return json({ error: `Unknown action "${body.action}".` }, 400);
    const sketchId = String(body.sketchId ?? "");
    const image = typeof body.image === "string" ? body.image.replace(/^data:image\/png;base64,/, "") : "";
    if (!sketchId || !image) return json({ error: "Send the sketch and its picture." }, 400);
    if (image.length > MAX_IMAGE_BASE64) return json({ error: "That sketch is too big to read." }, 400);

    const { data: sketch, error } = await db.from("sketches").select("id, quest_task_id, camp_step_id").eq("id", sketchId).maybeSingle();
    if (error) throw error;
    if (!sketch) return json({ error: "That sketch is gone." }, 404);

    const context = await contextOf(db, sketch);
    const read = await readSketch(new Anthropic({ apiKey }), image, context);
    const title = clip(read.title, 120).replace(/[.…]+$/, "") || "Sketch";
    const summary = String(read.summary ?? "")
      .trim()
      .slice(0, 20000);
    if (!summary) return json({ error: "The sketch came back unread." }, 422);
    const analyzed_at = new Date().toISOString();
    const saved = await db.from("sketches").update({ title, summary, analyzed_at }).eq("id", sketch.id);
    if (saved.error) throw saved.error;
    return json({ title, summary, analyzed_at });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
