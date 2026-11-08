// The builder's pure parts: providers, the answer's shape, and tidying what
// a model sends back before anyone sees it. Plain JavaScript so the tests
// (scripts/test.mjs) and the edge function share one copy.

export const PROVIDERS = {
  anthropic: { label: "Anthropic (Claude)", model: "claude-sonnet-5-5", keyHint: "sk-ant-" },
  openai: { label: "OpenAI", model: "gpt-5", keyHint: "sk-" },
  gemini: { label: "Google Gemini", model: "gemini-2.5-flash", keyHint: "AIza" },
  openrouter: { label: "OpenRouter (any model)", model: "openrouter/auto", keyHint: "sk-or-" },
};

export function providerOk(p) {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, p);
}

export function modelFor(provider, model) {
  const m = String(model ?? "").trim();
  return m && m.length <= 120 && /^[\w.:/@-]+$/.test(m) ? m : PROVIDERS[provider]?.model ?? null;
}

export function lastFour(key) {
  return String(key ?? "").trim().slice(-4);
}

// A key is one line of printable characters, nothing that could smuggle a
// header or a second value along with it.
export function keyLooksOk(key) {
  const k = String(key ?? "").trim();
  return k.length >= 10 && k.length <= 400 && /^[\x21-\x7e]+$/.test(k);
}

// The JSON Schema every provider is asked to answer in.
export const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "What you say to him, short and plain." },
    question: {
      type: ["object", "null"],
      description: "One question for him when you need his choice before you can propose, else null.",
      properties: {
        text: { type: "string" },
        options: { type: "array", items: { type: "string" }, description: "2 to 4 short answers he can tap." },
      },
      required: ["text", "options"],
    },
    proposal: {
      type: ["object", "null"],
      description: "A new quest to show him for Apply, else null.",
      properties: {
        kind: { type: "string", enum: ["new_quest"] },
        title: { type: "string" },
        note: { type: "string" },
        goal_id: { type: ["string", "null"] },
        camps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              note: { type: "string" },
              sections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    note: { type: "string" },
                    steps: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          text: { type: "string" },
                          note: { type: "string" },
                          subs: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: { text: { type: "string" }, note: { type: "string" } },
                              required: ["text"],
                            },
                          },
                        },
                        required: ["text"],
                      },
                    },
                  },
                  required: ["title", "steps"],
                },
              },
            },
            required: ["title", "sections"],
          },
        },
        duplicates: { type: "array", items: { type: "string" }, description: "Tasks that appeared more than once and were kept once." },
      },
      required: ["kind", "title", "camps"],
    },
  },
  required: ["reply", "question", "proposal"],
};

const str = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const note = (v, max) => String(v ?? "").trim().slice(0, max);

// The first JSON object in a model's text: some providers wrap it in a code
// fence or a sentence even when asked not to.
export function parseAnswer(text) {
  const t = String(text ?? "").trim();
  try {
    return JSON.parse(t);
  } catch {
    /* fall through */
  }
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      /* fall through */
    }
  }
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(t.slice(a, b + 1));
    } catch {
      /* fall through */
    }
  }
  return null;
}

// What a model sent, made safe to show and to apply: trimmed to the
// database's limits, empty pieces dropped, a goal only if it's one of his.
export function tidyAnswer(raw, goalIds = []) {
  const out = { reply: "", question: null, proposal: null };
  if (!raw || typeof raw !== "object") {
    out.reply = "I couldn't read that answer. Try again?";
    return out;
  }
  out.reply = note(raw.reply, 4000);

  const q = raw.question;
  if (q && typeof q === "object" && str(q.text, 300)) {
    const options = [...new Set((Array.isArray(q.options) ? q.options : []).map((o) => str(o, 80)).filter(Boolean))].slice(0, 4);
    out.question = { text: str(q.text, 300), options };
  }

  const p = raw.proposal;
  if (p && typeof p === "object" && p.kind === "new_quest") {
    const goals = new Set(goalIds);
    const camps = (Array.isArray(p.camps) ? p.camps : [])
      .map((c) => ({
        title: str(c?.title, 200),
        note: note(c?.note, 4000),
        sections: (Array.isArray(c?.sections) ? c.sections : [])
          .map((s) => ({
            title: str(s?.title, 200) || "Steps",
            note: note(s?.note, 4000),
            steps: (Array.isArray(s?.steps) ? s.steps : [])
              .map((st) => ({
                text: str(st?.text, 1000),
                note: note(st?.note, 4000),
                subs: (Array.isArray(st?.subs) ? st.subs : [])
                  .map((x) => ({ text: str(x?.text, 1000), note: note(x?.note, 4000) }))
                  .filter((x) => x.text),
              }))
              .filter((st) => st.text),
          }))
          .filter((s) => s.steps.length),
      }))
      .filter((c) => c.title && c.sections.length)
      .slice(0, 40);
    const title = str(p.title, 200);
    if (title && camps.length) {
      out.proposal = {
        kind: "new_quest",
        title,
        note: note(p.note, 2000),
        goal_id: typeof p.goal_id === "string" && goals.has(p.goal_id) ? p.goal_id : null,
        camps,
        duplicates: (Array.isArray(p.duplicates) ? p.duplicates : []).map((d) => str(d, 200)).filter(Boolean).slice(0, 50),
      };
    }
  }
  if (!out.reply) out.reply = out.proposal ? "Here's the quest. Look it over, then Apply." : out.question ? "" : "Done.";
  return out;
}

// How big a proposal is, for its card.
export function proposalCounts(p) {
  let sections = 0;
  let steps = 0;
  for (const c of p?.camps ?? [])
    for (const s of c.sections ?? []) {
      sections += 1;
      for (const st of s.steps ?? []) steps += 1 + (st.subs?.length ?? 0);
    }
  return { camps: p?.camps?.length ?? 0, sections, steps };
}

// A conversation as sent to a model: his words and the builder's, newest
// last, the last 20 turns, each cut to a size a long paste still fits in.
export function trimHistory(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && String(m.text ?? "").trim())
    .slice(-20)
    .map((m) => ({ role: m.role, text: String(m.text).slice(0, 60_000) }));
}
