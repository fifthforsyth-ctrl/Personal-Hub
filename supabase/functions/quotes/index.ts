// Quotes that help you press on: one a day, chosen for the week you're in.
//
// Each day it either brings back a quote you said applied (now and then, when
// one fits again) or finds a new one, from a Church leader or a figure from
// history, matched to this week's focus goals and what you've written lately.
// A new quote is looked up on the web first, so the wording and the source
// are the real ones; misattributed quotes are everywhere, and one you can't
// trust is worse than none.
//
// Pictures: only a public-domain portrait from Wikimedia Commons, which in
// practice means historical figures. Everyone else gets a name card.
//
// Two ways in, like the curator: the nightly job with the shared secret, and
// the app with your own login on a day the job didn't cover. verify_jwt is off
// for the job's sake, and this function checks one or the other itself.

import Anthropic from "npm:@anthropic-ai/sdk@^0.122.0";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk@^0.122.0/helpers/zod";
import { z } from "npm:zod@^4.4.3";
import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const MODEL = "claude-opus-5-5";

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

// A quote that applied can come back once this many days have passed.
const COMEBACK_AFTER_DAYS = 10;

const FIND_SYSTEM = `You choose one quote for a person to carry through today. They are a member of The Church of Jesus Christ of Latter-day Saints, trying to press on in their discipleship, their family, their work and their goals.

Read their week first: the few things they chose to focus on this week ("week_focus"), what they wrote in their recent reflections, the goals that have gone quiet, and how recent days went. The quote should speak to THAT, not to life in general.

Where quotes come from:
- Leaders of The Church of Jesus Christ of Latter-day Saints: prophets, apostles, other General Authorities and general officers, past and present. General conference talks and Church magazines are the best sources.
- Figures from history whose words have lasted: statesmen, writers, reformers, saints and thinkers. Lincoln, C.S. Lewis, Churchill, Washington, Frederick Douglass and the like.
Alternate between the two over the days; the history lists which kind came lately.

What they've told you:
- "history" lists past quotes with how they rated them: "applies", "somewhat" or "not_now". Lean toward the kind of quote, voice and theme that applied. Avoid what they marked not now. Never repeat a quote from the history as a new one.
- "comeback" lists quotes they said applied that haven't been shown lately. If one of them fits this week clearly better than anything new would, bring it back instead of finding a new one. About one day in four is right; don't force it.

Finding a new quote:
- Use web search to find the exact wording and where it was said or written, from a reliable source: churchofjesuschrist.org for Church leaders; the original book, letter or speech, or a careful collection such as Wikiquote, for historical figures. Many famous quotes are misattributed. If you cannot confirm a quote's wording and source, choose a different quote you can confirm.
- Prefer a quote of one to three sentences. Never stitch two passages together or change the wording; you may cut a sentence short only with an ellipsis.

Write your answer in plain prose, either:
- BRING BACK <id>, and one sentence on why it fits this week; or
- the quote word for word, who said it, whether they are a Church leader or a historical figure, the talk, book or occasion with its year, the URL where you confirmed it, the exact title of the speaker's English Wikipedia article if they have one, and one sentence, addressed to them, on why it fits this week (name the actual thing in their week).`;

const PickSchema = z.object({
  bring_back_id: z.string().describe("The id after BRING BACK, copied exactly, or an empty string for a new quote."),
  reason: z.string().describe("The one sentence on why it fits this week, as written."),
  text: z.string().describe("The quote word for word. Empty when bringing one back."),
  author: z.string().describe("Who said or wrote it. Empty when bringing one back."),
  author_kind: z.enum(["church", "historical"]).describe("church for Church leaders, historical for everyone else."),
  source: z.string().describe("The talk, book or occasion, with its year if given. Empty if none."),
  source_url: z.string().describe("The URL where it was confirmed. Empty if none."),
  year: z.number().describe("The year it was said or published, or 0 if unknown."),
  wikipedia_title: z.string().describe("The exact English Wikipedia article title for the speaker, or empty."),
});

const PARSE_SYSTEM = `Copy the chosen quote out of the answer below into the fields exactly as written. Do not change, shorten or correct the quote's wording. If the answer says BRING BACK, put that id in bring_back_id and leave the quote fields empty.`;

type Context = Record<string, unknown>;

async function weekContext(db: any, userId: string, tz: string, date: string): Promise<Context> {
  const { data, error } = await db.rpc("curate_context", { p_user_id: userId, p_tz: tz, p_date: date });
  if (error) throw new Error(`curate_context: ${error.message}`);
  // The quote needs the week, not the whole shelf of cards.
  const { cards: _cards, past_feedback: _feedback, ...week } = data ?? {};
  return week;
}

async function quoteHistory(db: any, userId: string, date: string) {
  const { data: quotes, error } = await db
    .from("quotes")
    .select("id, text, author, author_kind, rating, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw new Error(`quotes: ${error.message}`);

  const { data: days, error: daysError } = await db
    .from("quote_days")
    .select("quote_id, date")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(200);
  if (daysError) throw new Error(`quote_days: ${daysError.message}`);

  const lastShown = new Map<string, string>();
  for (const d of days ?? []) if (!lastShown.has(d.quote_id)) lastShown.set(d.quote_id, d.date);

  const cutoff = new Date(`${date}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - COMEBACK_AFTER_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const history = (quotes ?? []).map((q: any) => ({
    author: q.author,
    kind: q.author_kind,
    quote: q.text.slice(0, 220),
    rating: q.rating ?? "not rated",
    last_shown: lastShown.get(q.id) ?? null,
  }));
  const comeback = (quotes ?? [])
    .filter((q: any) => q.rating === "applies" && (lastShown.get(q.id) ?? "0000") < cutoffStr)
    .slice(0, 15)
    .map((q: any) => ({ id: q.id, author: q.author, quote: q.text, last_shown: lastShown.get(q.id) ?? null }));

  return { history, comeback };
}

// The search runs on Anthropic's side; a long one pauses and is resumed by
// sending the turn back as it is.
async function findQuote(anthropic: Anthropic, prompt: string, withSearch: boolean) {
  const messages: any[] = [{ role: "user", content: prompt }];
  for (let round = 0; round < 4; round++) {
    const response: any = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: withSearch
        ? FIND_SYSTEM
        : FIND_SYSTEM +
          "\n\nWeb search is not available today. Choose only a quote whose exact wording and source you are certain of, and leave the URL empty.",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      ...(withSearch ? { tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }] } : {}),
      messages,
    });
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    const text = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("")
      .trim();
    if (!text) throw new Error(`The model gave no answer (${response.stop_reason}).`);
    return text;
  }
  throw new Error("The search ran too long.");
}

async function parsePick(anthropic: Anthropic, answer: string) {
  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    system: PARSE_SYSTEM,
    messages: [{ role: "user", content: answer }],
    output_config: { format: zodOutputFormat(PickSchema), effort: "low" },
  });
  const out = response.parsed_output;
  if (!out) throw new Error("The model returned nothing parsable.");
  return out;
}

// --- portraits ---------------------------------------------------------------

const WIKI_HEADERS = { "User-Agent": "PersonalHub/1.0 (personal quotes; https://github.com/fifthforsyth-ctrl/Personal-Hub)" };

function plain(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

// The Wikipedia article's lead image, kept only if Commons says it's public
// domain. Any failure means a name card, never an error.
async function portraitFor(title: string) {
  if (!title.trim()) return null;
  try {
    const summary = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.trim().replace(/ /g, "_"))}`,
      { headers: WIKI_HEADERS }
    );
    if (!summary.ok) return null;
    const page = await summary.json();
    const original: string | undefined = page?.originalimage?.source;
    // Only files that live on Commons: a file on English Wikipedia itself is
    // usually there because it isn't free.
    if (!original || !original.includes("/wikipedia/commons/")) return null;
    const file = decodeURIComponent(original.split("?")[0].split("/").pop() ?? "");
    if (!file) return null;

    const info = await fetch(
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo" +
        "&iiprop=url%7Cextmetadata&iiurlwidth=640&iiextmetadatafilter=License%7CLicenseShortName%7CArtist%7CCopyrighted" +
        `&titles=${encodeURIComponent(`File:${file}`)}`,
      { headers: WIKI_HEADERS }
    );
    if (!info.ok) return null;
    const body = await info.json();
    const image = body?.query?.pages?.[0]?.imageinfo?.[0];
    const meta = image?.extmetadata ?? {};
    const license = String(meta.License?.value ?? "").toLowerCase();
    const publicDomain =
      license.startsWith("pd") || license === "cc0" || String(meta.Copyrighted?.value ?? "") === "False";
    if (!publicDomain || !image?.thumburl) return null;

    return {
      image_url: String(image.thumburl).split("?")[0],
      image_credit: [plain(String(meta.Artist?.value ?? "")), "public domain, via Wikimedia Commons"].filter(Boolean).join(", "),
      image_page: image.descriptionurl ?? null,
    };
  } catch (err) {
    console.warn("portrait", err);
    return null;
  }
}

// --- one user's day ----------------------------------------------------------

async function quoteDay(db: any, userId: string, date: string) {
  const { data, error } = await db
    .from("quote_days")
    .select("date, reason, quote:quotes(*)")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (error) throw new Error(`quote_days: ${error.message}`);
  return data;
}

async function pickFor(db: any, anthropic: Anthropic, userId: string, tz: string, date: string) {
  const existing = await quoteDay(db, userId, date);
  if (existing) return { already: true, day: existing };

  const [week, { history, comeback }] = await Promise.all([weekContext(db, userId, tz, date), quoteHistory(db, userId, date)]);
  const prompt = `Choose the quote for ${date}.\n\n${JSON.stringify({ week, history, comeback }, null, 1)}`;

  let answer: string;
  let verified = true;
  try {
    answer = await findQuote(anthropic, prompt, true);
  } catch (err) {
    // Web search can be switched off for the account; a quote from memory,
    // marked unverified, is better than an empty card.
    console.warn("search failed, choosing without it", err);
    answer = await findQuote(anthropic, prompt, false);
    verified = false;
  }
  const pick = await parsePick(anthropic, answer);

  let quoteId: string | null = null;
  if (pick.bring_back_id && comeback.some((q: any) => q.id === pick.bring_back_id)) {
    quoteId = pick.bring_back_id;
  } else {
    if (!pick.text.trim() || !pick.author.trim()) throw new Error("No quote came back.");
    const portrait = await portraitFor(pick.wikipedia_title);
    const { data: row, error } = await db
      .from("quotes")
      .insert({
        user_id: userId,
        text: pick.text.trim().slice(0, 1200),
        author: pick.author.trim().slice(0, 200),
        author_kind: pick.author_kind,
        source: pick.source.trim() || null,
        source_url: /^https?:\/\//.test(pick.source_url.trim()) ? pick.source_url.trim() : null,
        year: pick.year > 0 ? Math.round(pick.year) : null,
        verified: verified && /^https?:\/\//.test(pick.source_url.trim()),
        ...(portrait ?? {}),
      })
      .select("id")
      .single();
    if (error) throw new Error(`quotes: ${error.message}`);
    quoteId = row.id;
  }

  // Two runs racing for the same day: the first one wins and both return it.
  const { error: dayError } = await db
    .from("quote_days")
    .upsert({ user_id: userId, date, quote_id: quoteId, reason: pick.reason.trim() || null }, { onConflict: "user_id,date", ignoreDuplicates: true });
  if (dayError) throw new Error(`quote_days: ${dayError.message}`);

  return { already: false, day: await quoteDay(db, userId, date) };
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

    // --- the nightly run ----------------------------------------------------
    if (isCron) {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: profiles, error: profileError } = await admin.from("profiles").select("id, timezone");
      if (profileError) throw new Error(`profiles: ${profileError.message}`);

      const results = [];
      for (const profile of profiles ?? []) {
        const tz = profile.timezone || "America/Denver";
        // Runs at two UTC hours so it lands after local midnight on both
        // sides of daylight saving; the second finds the day already done.
        const localDate = new Date().toLocaleDateString("en-CA", { timeZone: tz });
        try {
          const out = await pickFor(admin, anthropic, profile.id, tz, localDate);
          results.push({ user: profile.id, for_date: localDate, already: out.already });
        } catch (err) {
          // One user's failure must not abandon the rest of the run.
          results.push({ user: profile.id, error: err instanceof Error ? err.message : String(err) });
        }
      }
      return json({ ran: "cron", results });
    }

    // --- the app, with your own login ---------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Not signed in." }, 401);

    const tz = body.tz ?? "America/Denver";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date ?? ""))
      ? String(body.date)
      : new Date().toLocaleDateString("en-CA", { timeZone: tz });
    const out = await pickFor(supabase, anthropic, userData.user.id, tz, date);
    return json(out.day);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
