// The builder: an AI you talk to inside the Hub that changes your own Hub.
//
// It runs on each person's own AI key, from the provider they chose
// (Anthropic, OpenAI, Google Gemini or OpenRouter). The key is sent here
// once, checked with the provider, encrypted (AES-GCM, with a key derived
// from a secret only this function has) and stored in ai_keys, which no
// signed-in person can read. It is never sent back to a browser, never
// logged, and never shown to the model.
//
// The model can't change anything itself. It can only answer with words,
// a question (shown as tappable bubbles) or a proposal from a fixed menu
// (for now: a new quest). The app shows the proposal; nothing is saved until
// the person taps Apply, which runs builder_apply_quest as them (0110), and
// every Apply can be undone.
//
// Actions: status, save {provider, key, model}, remove, chat {messages}.

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";
import { ANSWER_SCHEMA, PROVIDERS, keyLooksOk, lastFour, modelFor, parseAnswer, providerOk, tidyAnswer, trimHistory } from "./shape.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

class Plain extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// The stored key: AES-GCM with a key derived (HKDF) from AI_KEYS_SECRET if
// it's set, else from the project's service role key. "v1:" marks the first,
// "s1:" the second, so setting AI_KEYS_SECRET later doesn't lose track.
// ---------------------------------------------------------------------------

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function cryptoKey(tag: "v1" | "s1") {
  const secret = tag === "v1" ? Deno.env.get("AI_KEYS_SECRET") : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new Plain("The server can't store keys right now.", 503);
  const base = await crypto.subtle.importKey("raw", enc.encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("hub-ai-keys"), info: enc.encode("builder-v1") },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function seal(plain: string, userId: string) {
  const tag = Deno.env.get("AI_KEYS_SECRET") ? "v1" : "s1";
  const iv = crypto.getRandomValues(new Uint8Array(12));
  // The user id is bound in, so a sealed key copied to another row won't open.
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(userId) }, await cryptoKey(tag), enc.encode(plain)),
  );
  const all = new Uint8Array(iv.length + ct.length);
  all.set(iv);
  all.set(ct, iv.length);
  return `${tag}:${b64(all)}`;
}

async function unseal(sealed: string, userId: string) {
  const [tag, body] = sealed.split(":");
  if ((tag !== "v1" && tag !== "s1") || !body) throw new Plain("Your saved key can't be read. Paste it again in AI settings.", 409);
  const all = unb64(body);
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: all.slice(0, 12), additionalData: enc.encode(userId) },
      await cryptoKey(tag),
      all.slice(12),
    );
    return dec.decode(pt);
  } catch {
    throw new Plain("Your saved key can't be read. Paste it again in AI settings.", 409);
  }
}

// ---------------------------------------------------------------------------
// Providers. Each returns the model's answer as an object in ANSWER_SCHEMA's
// shape (or null), or throws a Plain error that says what went wrong in
// words, never echoing the key.
// ---------------------------------------------------------------------------

type Turn = { role: "user" | "assistant"; text: string };

async function providerError(res: Response, label: string) {
  const body = await res.text().catch(() => "");
  let msg = "";
  try {
    const j = JSON.parse(body);
    msg = j?.error?.message ?? j?.error ?? j?.message ?? "";
  } catch {
    /* not JSON */
  }
  if (res.status === 401 || res.status === 403) return new Plain(`${label} turned the key down. Check it in AI settings.`, 400);
  if (res.status === 404) return new Plain(`${label} doesn't know that model. Pick another in AI settings.`, 400);
  if (res.status === 429) return new Plain(`${label} says you're over your limit or out of credit right now.`, 429);
  // 422, not 502: the app reads 502 as "busy", which hid what really went wrong.
  return new Plain(`${label} had a problem (${res.status})${msg ? `: ${String(msg).slice(0, 200)}` : ""}.`, res.status >= 500 ? 503 : 422);
}

async function callModel(provider: string, key: string, model: string, system: string, turns: Turn[], maxTokens: number, schema = true) {
  const label = PROVIDERS[provider as keyof typeof PROVIDERS].label;
  const signal = AbortSignal.timeout(140_000);

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: turns.map((t) => ({ role: t.role, content: t.text })),
        ...(schema
          ? {
              // Newer Claude models (Opus 5.5, Sonnet 5.5, Fable 5.1+) reject a
              // forced tool_choice with a 400, so the tool is offered on "auto"
              // and the prompt says to use it; a plain-JSON text answer is read too.
              tools: [{ name: "answer", description: "Your answer to him. Always answer by calling this tool.", input_schema: ANSWER_SCHEMA }],
              tool_choice: { type: "auto" },
            }
          : {}),
      }),
    });
    if (!res.ok) throw await providerError(res, label);
    const body = await res.json();
    const tool = (body.content ?? []).find((b: { type: string }) => b.type === "tool_use");
    if (tool) return tool.input;
    const text = (body.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    return parseAnswer(text);
  }

  if (provider === "gemini") {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      signal,
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.text }] })),
        generationConfig: { maxOutputTokens: maxTokens, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) throw await providerError(res, label);
    const body = await res.json();
    const text = (body.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    return parseAnswer(text);
  }

  // OpenAI and OpenRouter speak the same chat API.
  const url = provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(provider === "openrouter" ? { "X-Title": "Hub builder" } : {}),
    },
    body: JSON.stringify({
      model,
      ...(provider === "openai" ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, ...turns.map((t) => ({ role: t.role, content: t.text }))],
    }),
  });
  if (!res.ok) throw await providerError(res, label);
  const body = await res.json();
  return parseAnswer(body.choices?.[0]?.message?.content ?? "");
}

// ---------------------------------------------------------------------------
// What the builder is told.
// ---------------------------------------------------------------------------

function systemPrompt(goals: { id: string; title: string }[], quests: string[]) {
  return `You are the builder inside a person's private life app, the Hub. He talks to you to change how his own Hub works.

What you can do right now: turn a list of tasks he pastes (or describes) into a new quest. A quest is a goal-sized project, climbed camp by camp: camps are its phases or big areas, each camp holds sections, each section holds steps, and a step can have sub-steps.

How to build a quest from his list:
- Keep his own words for every task. Fix obvious typos only. Don't invent tasks he didn't give, and don't drop any.
- Group tasks into 2 to 8 camps by phase (what has to happen first) or by area when there is no order. Inside a camp, group into sections. Order everything the way it would be done.
- A task with indented or clearly dependent items under it gets them as sub-steps.
- Information that isn't something to do (a link, a detail, a reminder) goes in the step's note or the section's note.
- A task listed twice is kept once and named in "duplicates".
- Give the quest a short, plain title in his words.
- If one of his goals clearly fits, set goal_id to its id. Otherwise null.

How you talk:
- Short, plain and warm. No hype.
- When you need his choice before you can build well (two very different ways to group it, or which goal it serves when two fit), ask ONE question in "question" with 2 to 4 short answers he can tap, and leave proposal null. Don't ask when a sensible default exists; build it and mention the choice you made in "reply".
- When he asks to change a quest you proposed, send the whole updated proposal again.

Safety, always:
- Never change or remove anything that already exists in his Hub. You only propose new things, and nothing is saved until he taps Apply; every Apply can be undone.
- If something he asks for would change something that already works, don't do it silently: offer, as tappable answers, a way for both to work (for example "Keep both", "Make it a separate quest") before anything that replaces it.
- If he asks for something you can't do yet (changing screens, new tabs or tools, editing existing quests), say so plainly in one sentence, say it's coming, and offer what you can do now.

Always answer by calling the "answer" tool. If you can't call it, answer only with one JSON object with the keys "reply", "question" and "proposal" exactly as described (question and proposal are null when not used; a proposal has kind "new_quest", title, note, goal_id, camps[{title, note, sections[{title, note, steps[{text, note, subs[{text, note}]}]}]}], duplicates[]).

His goals (id: title):
${goals.length ? goals.map((g) => `- ${g.id}: ${g.title}`).join("\n") : "- (none yet)"}

Quests he already has (don't make a duplicate of one; if his list belongs in one of these, say so and offer to make a new quest anyway):
${quests.length ? quests.map((q) => `- ${q}`).join("\n") : "- (none yet)"}`;
}

// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only." }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await asUser.auth.getUser();
    if (userError || !userData?.user) return json({ error: "You need to be signed in." }, 401);
    const userId = userData.user.id;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "status") {
      const { data, error } = await admin.from("ai_keys").select("provider, model, last4, updated_at").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return json({ key: data ?? null, providers: PROVIDERS });
    }

    if (action === "remove") {
      const { error } = await admin.from("ai_keys").delete().eq("user_id", userId);
      if (error) throw error;
      return json({ removed: true });
    }

    if (action === "save") {
      const provider = String(body.provider ?? "");
      if (!providerOk(provider)) throw new Plain("Pick a provider.");
      const key = String(body.key ?? "").trim();
      if (!keyLooksOk(key)) throw new Plain("That doesn't look like a key. Paste it again, all of it.");
      const model = modelFor(provider, body.model)!;
      // A tiny call first, so a wrong key or model is caught now and not mid-chat.
      await callModel(provider, key, model, "Reply with exactly {\"ok\":true}.", [{ role: "user", text: "Test." }], 200, false);
      const { error } = await admin.from("ai_keys").upsert({
        user_id: userId,
        provider,
        model,
        secret: await seal(key, userId),
        last4: lastFour(key),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return json({ key: { provider, model, last4: lastFour(key) } });
    }

    if (action === "chat") {
      const turns = trimHistory(body.messages) as Turn[];
      if (!turns.length || turns[turns.length - 1].role !== "user") throw new Plain("Say something first.");
      while (turns.length && turns[0].role !== "user") turns.shift();

      const { data: row, error } = await admin.from("ai_keys").select("provider, model, secret").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      if (!row) return json({ error: "Add your own AI key in AI settings first.", needs_key: true }, 400);
      const key = await unseal(row.secret, userId);

      // What it's told about him: his lifetime goals and his quests' names,
      // read as him (his own rows only).
      const [nodes, edges, quests] = await Promise.all([
        asUser.from("nodes").select("id, title").eq("user_id", userId).limit(500),
        asUser.from("node_edges").select("child_id").limit(2000),
        asUser.from("quests").select("title, status, lesson_id").eq("user_id", userId).limit(300),
      ]);
      const children = new Set((edges.data ?? []).map((e: { child_id: string }) => e.child_id));
      const goals = (nodes.data ?? []).filter((n: { id: string }) => !children.has(n.id));
      const questTitles = (quests.data ?? [])
        .filter((q: { lesson_id: string | null; status: string }) => !q.lesson_id && q.status !== "done")
        .map((q: { title: string }) => q.title);

      const raw = await callModel(row.provider, key, modelFor(row.provider, row.model)!, systemPrompt(goals, questTitles), turns, 16000);
      return json(tidyAnswer(raw, goals.map((g: { id: string }) => g.id)));
    }

    return json({ error: "Unknown action." }, 400);
  } catch (err) {
    if (err instanceof Plain) return json({ error: err.message }, err.status);
    if (err instanceof DOMException && err.name === "TimeoutError") return json({ error: "The AI took too long. Try a shorter list." }, 504);
    console.error("builder", err instanceof Error ? err.message : "error");
    return json({ error: "Something went wrong in the builder." }, 500);
  }
});
