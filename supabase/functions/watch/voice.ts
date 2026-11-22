// Say anything to the Hub: "record a $25 personal purchase for groceries",
// "add milk, eggs and call Dad to my clipboard", "start Plugin", "win: up at
// 4:30". Claude reads what you said against a snapshot of today, does it with
// the tools below, and answers in a sentence or two that's spoken back.
//
// The tools only ever touch the speaker's own rows: index.ts hands in
// handlers already bound to that user.

import Anthropic from "npm:@anthropic-ai/sdk@^0.122.0";

const MODEL = "claude-opus-5-5";
const MAX_ROUNDS = 4;

export type Handlers = {
  log_win: (a: { label: string }) => Promise<string>;
  log_loss: (a: { label: string }) => Promise<string>;
  start_timer: (a: { category: string }) => Promise<string>;
  stop_timer: () => Promise<string>;
  add_to_clipboard: (a: { items: string[]; column_id?: string }) => Promise<string>;
  log_spend: (a: { amount: number; budget?: string; note?: string; date?: string; business?: boolean }) => Promise<string>;
  keep_note: (a: { text: string }) => Promise<string>;
  mark_done: (a: { task_id: string }) => Promise<string>;
};

const str = (description: string) => ({ type: "string", description });

export const TOOLS = [
  {
    name: "log_win",
    description: "Log a win (something he did right, a habit kept). Use his own words, short, as the label, e.g. 'Up at 4:30'.",
    input_schema: { type: "object", properties: { label: str("The win, a few words") }, required: ["label"] },
  },
  {
    name: "log_loss",
    description: "Log a loss (a slip, a habit missed).",
    input_schema: { type: "object", properties: { label: str("The loss, a few words") }, required: ["label"] },
  },
  {
    name: "start_timer",
    description:
      "Start tracking minutes in a category (stops whatever is running first). Use the closest name from the category list when one fits; otherwise his word.",
    input_schema: { type: "object", properties: { category: str("Category name") }, required: ["category"] },
  },
  {
    name: "stop_timer",
    description: "Stop the running timer.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "add_to_clipboard",
    description:
      "Put one or more items on his clipboard (quick-capture tasks he sorts later). Split a spoken list into separate items, each a short task in his words. Leave column_id out unless he named a column or camp.",
    input_schema: {
      type: "object",
      properties: {
        items: { type: "array", items: { type: "string" }, description: "One entry per item" },
        column_id: str("Id of a clipboard column from the list, only if he named one"),
      },
      required: ["items"],
    },
  },
  {
    name: "log_spend",
    description:
      "Record money he spent by hand (cash, or before the bank shows it). amount is positive dollars. budget is the spoken label like 'groceries' or 'gas'. business true only when he says it's for work/business; 'personal' means false.",
    input_schema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Dollars spent, positive" },
        budget: str("Budget or category he named"),
        note: str("Anything else he said about it (where, what)"),
        date: str("YYYY-MM-DD, only if he said a day other than today"),
        business: { type: "boolean", description: "True for a business expense" },
      },
      required: ["amount"],
    },
  },
  {
    name: "keep_note",
    description: "Keep a thought or note on his board (not a task).",
    input_schema: { type: "object", properties: { text: str("The note, in his words") }, required: ["text"] },
  },
  {
    name: "mark_done",
    description: "Tick off one of Today's tasks. task_id must come from the Today list.",
    input_schema: { type: "object", properties: { task_id: str("Id from the Today list") }, required: ["task_id"] },
  },
];

const SYSTEM = `You are the voice of Aaron's Hub, the app he uses to track minutes, wins, tasks, money and reflection. He speaks to it from his Apple Watch or phone; your reply is read aloud.

How to work:
- Do what he asked with the tools, then reply. Several asks in one breath: do them all.
- Only do what he clearly asked. If something essential is missing or it's truly ambiguous (e.g. an amount you can't make out), ask one short question instead of guessing, and do nothing.
- If he asks a question about today, answer from the snapshot.
- If a tool reports a problem, say so plainly.

Your reply is spoken: one or two short sentences, plain words, no lists, no emoji, no markdown. Confirm what was done with the key detail ("Logged 25 dollars to Groceries." / "Added three things to your clipboard."). Calm and direct; no cheerleading.`;

export type VoiceResult = { say: string; did: string[] };

export async function runCommand(heard: string, snapshot: string, handlers: Handlers): Promise<VoiceResult> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return { say: "The Hub's AI key is missing, so I can't act on that yet.", did: [] };
  const anthropic = new Anthropic({ apiKey });

  const messages: any[] = [{ role: "user", content: `${snapshot}\n\nHe said: "${heard}"` }];
  const did: string[] = [];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const last = round === MAX_ROUNDS - 1;
    const response: any = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      tools: TOOLS as any,
      tool_choice: last ? { type: "none" } : { type: "auto" },
      messages,
    });
    messages.push({ role: "assistant", content: response.content });

    const uses = response.content.filter((b: any) => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || uses.length === 0) {
      if (response.stop_reason === "refusal") return { say: "I can't help with that one.", did };
      const say = response.content
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join(" ")
        .replace(/[*_#`]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      return { say: say || (did.length ? did.join(" ") : "Done."), did };
    }

    const results = await Promise.all(
      uses.map(async (u: any) => {
        const fn = (handlers as Record<string, (a: any) => Promise<string>>)[u.name];
        try {
          if (!fn) throw new Error(`No tool called ${u.name}.`);
          const out = await fn(u.input ?? {});
          did.push(out);
          return { type: "tool_result", tool_use_id: u.id, content: out };
        } catch (err) {
          const msg = String((err as Error)?.message ?? err);
          console.error("voice tool", u.name, msg);
          return { type: "tool_result", tool_use_id: u.id, content: msg, is_error: true };
        }
      })
    );
    messages.push({ role: "user", content: results });
  }
  return { say: did.join(" ") || "Done.", did };
}
