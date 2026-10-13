// Quotes that help you press on.
//
// Two jobs:
//
// The day's quote. Each day it either brings back a quote you said applied
// (now and then, when one fits again) or finds a new one, from a Church
// leader or a figure from history, matched to this week's focus goals and
// what you've written lately.
//
// Shelves for the Board. The Board opens on this week's top picks and on
// shelves you can browse: a person, a theme, a mood, or anything you ask
// for. A shelf is a quote_collections row. Asking for one marks it pending
// and fills it in the background, so the page never hangs on a web search;
// the page watches the row until it's ready.
//
// Every new quote is looked up on the web first, so the wording and the
// source are the real ones; misattributed quotes are everywhere, and one you
// can't trust is worse than none. Every quote also gets a picture from the
// web, and no two share one: the person's portrait the first time they
// appear, and after that a photograph that stands for the words (a symbol,
// a place, a scene), so a shelf of one person's quotes isn't the same face
// six times. These are for your own board, so any picture will do.
//
// Two ways in, like the curator: the nightly job with the shared secret, and
// the app with your own login. verify_jwt is off for the job's sake, and this
// function checks one or the other itself.

import Anthropic from "npm:@anthropic-ai/sdk@^0.122.0";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk@^0.122.0/helpers/zod";
import { z } from "npm:zod@^4.4.3";
import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

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

// How many quotes a shelf gets at a time ("Find more" adds as many again).
const SHELF_SIZE = 6;

// A shelf still pending after this long was abandoned; asking again restarts it.
const PENDING_GIVES_UP_MS = 5 * 60_000;

const WHO = `They are a member of The Church of Jesus Christ of Latter-day Saints, trying to press on in their discipleship, their family, their work and their goals.`;

const SOURCES = `Where quotes come from:
- Leaders of The Church of Jesus Christ of Latter-day Saints: prophets, apostles, other General Authorities and general officers, past and present. General conference talks and Church magazines are the best sources.
- Figures from history whose words have lasted: statesmen, writers, reformers, saints and thinkers. Lincoln, C.S. Lewis, Churchill, Washington, Frederick Douglass and the like.`;

const CONFIRM = `- Use web search to find the exact wording and where it was said or written, from a reliable source: churchofjesuschrist.org for Church leaders; the original book, letter or speech, or a careful collection such as Wikiquote, for historical figures. Many famous quotes are misattributed. If you cannot confirm a quote's wording and source, choose a different quote you can confirm.
- Prefer a quote of one to three sentences. Never stitch two passages together or change the wording; you may cut a sentence short only with an ellipsis.`;

const FIND_SYSTEM = `You choose one quote for a person to carry through today. ${WHO}

Read their week first: the few things they chose to focus on this week ("week_focus"), what they wrote in their recent reflections, the goals that have gone quiet, and how recent days went. The quote should speak to THAT, not to life in general.

${SOURCES}
Alternate between the two over the days; the history lists which kind came lately.

What they've told you:
- "history" lists past quotes with how they rated them: "applies", "somewhat" or "not_now", and whether they saved it to their board. Lean toward the kind of quote, voice and theme that applied or that they saved. Avoid what they marked not now. Never repeat a quote from the history as a new one.
- "comeback" lists quotes they said applied or saved that haven't been shown lately. If one of them fits this week clearly better than anything new would, bring it back instead of finding a new one. About one day in four is right; don't force it.

Finding a new quote:
${CONFIRM}

Write your answer in plain prose, either:
- BRING BACK <id>, and one sentence on why it fits this week; or
- the quote word for word, who said it, whether they are a Church leader or a historical figure, the talk, book or occasion with its year, the URL where you confirmed it, the exact title of the speaker's English Wikipedia article if they have one, two to five plain words for a photograph that stands for the quote the way a symbol would (an object, a place or a scene, never a person: "lighthouse in a storm", "worn leather boots", "seedling through concrete"), and one sentence, addressed to them, on why it fits this week (name the actual thing in their week).`;

const SHELF_SYSTEM = `You gather quotes for one shelf of a person's cork board. ${WHO}

The shelf is named in the request, with what it's for:
- "top": this week's top picks for them. Read their week (focus goals, recent reflections, goals gone quiet, how the days went) and choose quotes that speak to it. Mix Church leaders and figures from history.
- "person": quotes by that one person only, their best and most lasting, spread across the themes they're known for.
- "theme": quotes on that theme, from both Church leaders and figures from history.
- "mood": quotes for someone feeling that way: what would actually help in that moment, not a description of the feeling.
- "ask": the person typed this themselves; take it as the theme.

${SOURCES}

What they've told you:
- "taste" lists quotes they rated ("applies", "somewhat", "not_now") or saved to their board. Lean toward the voices and kinds of quote that applied or were saved; steer away from what they marked not now.
- "avoid" lists quotes they already have. Never repeat one, even in different words.

Finding the quotes:
${CONFIRM}
- Search before you answer, even for quotes you know well: every quote needs the URL of the page where you confirmed its wording. A search for a person's or a theme's quotes often confirms several at once.
- Always give the full number asked for. If your searches run out first, fill the rest with quotes you are certain of, word for word, and leave their URL empty.
- Choose different quotes from one another: different talks or books, different angles on the shelf, and a different picture for each.

Write your answer in plain prose, one quote after another. For each: the quote word for word, who said it, whether they are a Church leader or a historical figure, the talk, book or occasion with its year, the URL where you confirmed it, the exact title of the speaker's English Wikipedia article if they have one, and two to five plain words for a photograph that stands for the quote the way a symbol would (an object, a place or a scene, never a person: "lighthouse in a storm", "worn leather boots", "seedling through concrete"). For the "top" shelf only, add one sentence, addressed to them, on why it fits this week (name the actual thing in their week).`;

const QuoteFields = {
  text: z.string().describe("The quote word for word."),
  author: z.string().describe("Who said or wrote it."),
  author_kind: z.enum(["church", "historical"]).describe("church for Church leaders, historical for everyone else."),
  source: z.string().describe("The talk, book or occasion, with its year if given. Empty if none."),
  source_url: z.string().describe("The URL where it was confirmed. Empty if none."),
  year: z.number().describe("The year it was said or published, or 0 if unknown."),
  wikipedia_title: z.string().describe("The exact English Wikipedia article title for the speaker, or empty."),
  image_query: z.string().describe("The two to five words for a symbolic photograph to go with it, or empty."),
};

const PickSchema = z.object({
  bring_back_id: z.string().describe("The id after BRING BACK, copied exactly, or an empty string for a new quote."),
  reason: z.string().describe("The one sentence on why it fits this week, as written."),
  ...QuoteFields,
});

const ShelfSchema = z.object({
  quotes: z.array(
    z.object({
      ...QuoteFields,
      why: z.string().describe("The sentence on why it fits this week, for the top shelf; otherwise empty."),
    })
  ),
});

const PARSE_SYSTEM = `Copy the chosen quote out of the answer below into the fields exactly as written. Do not change, shorten or correct the quote's wording. If the answer says BRING BACK, put that id in bring_back_id and leave the quote fields empty.`;

const PARSE_SHELF_SYSTEM = `Copy every quote out of the answer below into the fields exactly as written, in the order given. Do not change, shorten or correct any quote's wording, and leave out nothing.`;

type Context = Record<string, unknown>;
type Found = z.infer<typeof ShelfSchema>["quotes"][number];

async function weekContext(db: any, userId: string, tz: string, date: string): Promise<Context> {
  const { data, error } = await db.rpc("curate_context", { p_user_id: userId, p_tz: tz, p_date: date });
  if (error) throw new Error(`curate_context: ${error.message}`);
  // The quote needs the week, not the whole shelf of cards.
  const { cards: _cards, past_feedback: _feedback, ...week } = data ?? {};
  return week;
}

async function quoteHistory(db: any, userId: string, date: string) {
  // Quotes pulled onto shelves you never touched say nothing about your
  // taste, so the day's quote reads only the daily ones and what you rated
  // or saved.
  const { data: quotes, error } = await db
    .from("quotes")
    .select("id, text, author, author_kind, rating, saved_at, created_at")
    .eq("user_id", userId)
    .or("origin.eq.daily,rating.not.is.null,saved_at.not.is.null")
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
    saved: Boolean(q.saved_at),
    last_shown: lastShown.get(q.id) ?? null,
  }));
  const comeback = (quotes ?? [])
    .filter((q: any) => (q.rating === "applies" || q.saved_at) && q.rating !== "not_now" && (lastShown.get(q.id) ?? "0000") < cutoffStr)
    .slice(0, 15)
    .map((q: any) => ({ id: q.id, author: q.author, quote: q.text, last_shown: lastShown.get(q.id) ?? null }));

  return { history, comeback };
}

// The search runs on Anthropic's side; a long one pauses and is resumed by
// sending the turn back as it is.
async function findText(
  anthropic: Anthropic,
  system: string,
  prompt: string,
  { withSearch, effort, maxUses }: { withSearch: boolean; effort: "low" | "medium"; maxUses: number }
) {
  const messages: any[] = [{ role: "user", content: prompt }];
  const started = Date.now();
  let searches = 0;
  for (let round = 0; round < 4; round++) {
    const response: any = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 12000,
      system: withSearch
        ? system
        : system +
          "\n\nWeb search is not available today. Choose only quotes whose exact wording and source you are certain of, and leave the URLs empty.",
      thinking: { type: "adaptive" },
      output_config: { effort },
      ...(withSearch ? { tools: [{ type: "web_search_20260209", name: "web_search", max_uses: maxUses }] } : {}),
      messages,
    });
    searches += response.usage?.server_tool_use?.web_search_requests ?? 0;
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
    console.log(JSON.stringify({ find: withSearch ? "search" : "memory", searches, rounds: round + 1, ms: Date.now() - started }));
    return text;
  }
  throw new Error("The search ran too long.");
}

// Web search can be switched off for the account; quotes from memory, marked
// unverified, are better than an empty shelf.
async function findWithFallback(anthropic: Anthropic, system: string, prompt: string, opts: { effort: "low" | "medium"; maxUses: number }) {
  try {
    return { answer: await findText(anthropic, system, prompt, { ...opts, withSearch: true }), searched: true };
  } catch (err) {
    console.warn("search failed, choosing without it", err);
    return { answer: await findText(anthropic, system, prompt, { ...opts, withSearch: false }), searched: false };
  }
}

async function parseWith<T>(anthropic: Anthropic, system: string, schema: z.ZodType<T>, answer: string, maxTokens: number): Promise<T> {
  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: answer }],
    output_config: { format: zodOutputFormat(schema), effort: "low" },
  });
  const out = response.parsed_output;
  if (!out) throw new Error("The model returned nothing parsable.");
  return out as T;
}

// --- pictures ----------------------------------------------------------------

const WEB_HEADERS = { "User-Agent": "PersonalHub/1.0 (personal quotes; https://github.com/fifthforsyth-ctrl/Personal-Hub)" };

type Picture = { image_url: string; image_credit: string; image_page: string | null };

async function getJson(url: string) {
  const response = await fetch(url, { headers: WEB_HEADERS, signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  return await response.json();
}

// Wikimedia serves thumbnails at a few standard widths; 500 is wide enough
// for a card without pulling a 6 MB original onto a phone. The tracking
// query the API adds is dropped.
function sized(thumb: string, originalWidth: number | undefined) {
  const bare = thumb.split("?")[0];
  if (!bare.includes("/thumb/")) return bare;
  if (originalWidth && originalWidth <= 500) return bare;
  return bare.replace(/\/\d+px-([^/]+)$/, "/500px-$1");
}

// The person's picture: the lead image of their Wikipedia article.
async function wikipediaPicture(title: string): Promise<Picture | null> {
  const page = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.trim().replace(/ /g, "_"))}`);
  if (!page || page.type === "disambiguation") return null;
  const thumb: string | undefined = page?.thumbnail?.source;
  if (!thumb) return null;
  return {
    image_url: sized(thumb, page?.originalimage?.width),
    image_credit: "Wikipedia",
    image_page: page?.content_urls?.desktop?.page ?? null,
  };
}

// When the model's title misses, the article Wikipedia's own search finds
// for the name.
async function wikipediaByName(name: string): Promise<Picture | null> {
  const found = await getJson(
    `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=1&namespace=0&search=${encodeURIComponent(name)}`
  );
  const title = Array.isArray(found) ? found[1]?.[0] : null;
  return title ? await wikipediaPicture(title) : null;
}

// The picture the page the quote came from shares itself with: a talk's page
// on churchofjesuschrist.org shows the speaker.
async function pagePicture(url: string): Promise<Picture | null> {
  if (!/^https?:\/\//.test(url)) return null;
  const response = await fetch(url, { headers: WEB_HEADERS, signal: AbortSignal.timeout(8000), redirect: "follow" });
  if (!response.ok || !response.body) return null;
  // The head is enough; stop reading after it.
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  while (html.length < 300_000) {
    const { value, done } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
    if (html.includes("</head>")) break;
  }
  reader.cancel().catch(() => {});
  const tag = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*>/i)?.[0];
  const content = tag?.match(/content=["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g, "&");
  if (!content) return null;
  const image = new URL(content, url).toString();
  // A site's logo or blank share card isn't a picture of anything.
  if (/logo|default|placeholder|share-image|social-card/i.test(image)) return null;
  return { image_url: image, image_credit: new URL(url).hostname.replace(/^www\./, ""), image_page: url };
}

// A photograph that suits the words, from Wikimedia Commons: the best wide
// match that isn't on the Board already.
async function scenePicture(query: string, used: Set<string>): Promise<Picture | null> {
  if (!query.trim()) return null;
  const body = await getJson(
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2" +
      `&generator=search&gsrnamespace=6&gsrlimit=10&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}` +
      "&prop=imageinfo&iiprop=url%7Csize&iiurlwidth=500"
  );
  const pages = (body?.query?.pages ?? []).sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0));
  const image = pages
    .map((p: any) => p.imageinfo?.[0])
    .find((i: any) => i?.thumburl && i.width >= 600 && i.width >= i.height && !used.has(String(i.thumburl)));
  if (!image) return null;
  return { image_url: String(image.thumburl), image_credit: "Wikimedia Commons", image_page: image.descriptionurl ?? null };
}

// Every picture already on the Board, quotes and notes alike.
async function picturesInUse(db: any, userId: string): Promise<Set<string>> {
  const [quotes, notes] = await Promise.all([
    db.from("quotes").select("image_url").eq("user_id", userId).not("image_url", "is", null),
    db.from("study_notes").select("image_url").eq("user_id", userId).not("image_url", "is", null),
  ]);
  return new Set([...(quotes.data ?? []), ...(notes.data ?? [])].map((r: any) => r.image_url));
}

// Quiet scenes for when the words gave nothing a search could find.
const FALLBACK_SCENES = ["mountain sunrise landscape", "calm lake at dawn", "forest path morning light", "stone steps upward", "ocean horizon clouds"];

async function attempt(step: () => Promise<Picture | null>) {
  try {
    return await step();
  } catch (err) {
    console.warn("picture", err);
    return null;
  }
}

// The person's portrait the first time they appear; after that the symbol
// the words suggest, then the page it came from, then a quiet landscape;
// and only if all of those are taken, the portrait again. Any failure moves
// on to the next. The picture chosen is claimed in `used`, so call this one
// quote at a time.
async function pictureFor(
  q: { author: string; wikipedia_title: string; source_url: string; image_query: string },
  used: Set<string>
): Promise<Picture | null> {
  const fresh = (p: Picture | null) => (p && !used.has(p.image_url) ? p : null);
  const portrait =
    (q.wikipedia_title.trim() && (await attempt(() => wikipediaPicture(q.wikipedia_title)))) ||
    (q.author.trim() && (await attempt(() => wikipediaByName(q.author)))) ||
    null;
  let picture =
    fresh(portrait) ||
    (await attempt(() => scenePicture(q.image_query, used))) ||
    (q.source_url.trim() && fresh(await attempt(() => pagePicture(q.source_url.trim())))) ||
    null;
  for (const scene of FALLBACK_SCENES) {
    if (picture) break;
    picture = await attempt(() => scenePicture(scene, used));
  }
  picture = picture || portrait;
  if (picture) used.add(picture.image_url);
  return picture;
}

// Quotes that came in before pictures were kept apart share one person's
// portrait. Each after the first gets a symbol of its own instead.
const RepictureSchema = z.object({
  pictures: z.array(
    z.object({
      id: z.string().describe("The quote's id, copied exactly."),
      image_query: z.string().describe("Two to five plain words for a photograph that stands for the quote."),
    })
  ),
});

const REPICTURE_SYSTEM = `For each quote below, give two to five plain words for a photograph that stands for it the way a symbol would: an object, a place or a scene, never a person. "lighthouse in a storm", "worn leather boots", "seedling through concrete", "empty road at dawn". Choose something concrete a photo search will find, fitting to that quote, and different for each quote.`;

const REPICTURE_MAX = 12;

async function repicture(db: any, anthropic: Anthropic, userId: string) {
  const { data: quotes, error } = await db
    .from("quotes")
    .select("id, text, author, image_url")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(`quotes: ${error.message}`);

  const used = await picturesInUse(db, userId);
  const first = new Set<string>();
  const shared = (quotes ?? []).filter((q: any) => {
    if (!q.image_url) return false;
    if (!first.has(q.image_url)) {
      first.add(q.image_url);
      return false;
    }
    return true;
  });
  const batch = shared.slice(0, REPICTURE_MAX);
  if (batch.length === 0) return { repictured: 0, more: false };

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 3000,
    system: REPICTURE_SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(batch.map((q: any) => ({ id: q.id, author: q.author, quote: q.text.slice(0, 400) })), null, 1) }],
    output_config: { format: zodOutputFormat(RepictureSchema), effort: "low" },
  });
  const queries = new Map((response.parsed_output?.pictures ?? []).map((p) => [p.id, p.image_query]));

  let repictured = 0;
  for (const q of batch) {
    let picture = await attempt(() => scenePicture(queries.get(q.id) ?? "", used));
    for (const scene of FALLBACK_SCENES) {
      if (picture) break;
      picture = await attempt(() => scenePicture(scene, used));
    }
    if (!picture) continue;
    used.add(picture.image_url);
    const { error: updateError } = await db.from("quotes").update(picture).eq("id", q.id).eq("user_id", userId);
    if (updateError) throw new Error(`quotes: ${updateError.message}`);
    repictured++;
  }
  return { repictured, more: shared.length > batch.length };
}

function quoteRow(userId: string, q: Omit<Found, "why">, verified: boolean, picture: Picture | null) {
  const url = q.source_url.trim();
  return {
    user_id: userId,
    text: q.text.trim().slice(0, 1200),
    author: q.author.trim().slice(0, 200),
    author_kind: q.author_kind,
    source: q.source.trim() || null,
    source_url: /^https?:\/\//.test(url) ? url : null,
    year: q.year > 0 ? Math.round(q.year) : null,
    verified: verified && /^https?:\/\//.test(url),
    ...(picture ?? {}),
  };
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

  const { answer, searched } = await findWithFallback(anthropic, FIND_SYSTEM, prompt, { effort: "medium", maxUses: 4 });
  const pick = await parseWith(anthropic, PARSE_SYSTEM, PickSchema, answer, 2000);

  let quoteId: string | null = null;
  if (pick.bring_back_id && comeback.some((q: any) => q.id === pick.bring_back_id)) {
    quoteId = pick.bring_back_id;
  } else {
    if (!pick.text.trim() || !pick.author.trim()) throw new Error("No quote came back.");
    const picture = await pictureFor(pick, await picturesInUse(db, userId));
    const { data: row, error } = await db
      .from("quotes")
      .insert({ ...quoteRow(userId, pick, searched, picture), origin: "daily" })
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

// --- shelves -----------------------------------------------------------------

const FACETS = new Set(["top", "person", "theme", "mood", "ask"]);

// Weeks start on Sunday, the day you plan, as everywhere else in the app.
function sundayOf(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

function normal(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);
}

// Marks the shelf pending and starts filling it, unless it's ready (and you
// didn't ask for more or for a fresh set) or already being filled.
async function requestShelf(db: any, anthropic: Anthropic, userId: string, tz: string, date: string, body: any) {
  const key = String(body.key ?? "");
  const facet = String(body.facet ?? "");
  const label = String(body.label ?? "").trim().slice(0, 80);
  const hint = String(body.hint ?? "").trim().slice(0, 300);
  if (!/^[a-z]+:[a-z0-9-]{1,80}$/.test(key) || !FACETS.has(facet) || !label) {
    return { error: "That shelf isn't one I know.", status: 400 };
  }
  const more = Boolean(body.more);
  const fresh = Boolean(body.fresh);

  const { data: row, error } = await db.from("quote_collections").select("*").eq("user_id", userId).eq("key", key).maybeSingle();
  if (error) throw new Error(`quote_collections: ${error.message}`);
  if (row?.status === "pending" && Date.now() - Date.parse(row.requested_at) < PENDING_GIVES_UP_MS) return { shelf: row };
  if (row?.status === "ready" && !more && !fresh) return { shelf: row };

  const now = new Date().toISOString();
  const { data: pending, error: upsertError } = await db
    .from("quote_collections")
    .upsert(
      { user_id: userId, key, facet, label, hint: hint || null, status: "pending", error: null, quote_ids: row?.quote_ids ?? [], requested_at: now, updated_at: now },
      { onConflict: "user_id,key" }
    )
    .select("*")
    .single();
  if (upsertError) throw new Error(`quote_collections: ${upsertError.message}`);

  const job = fillShelf(db, anthropic, userId, tz, date, pending, { keep: more }).catch(async (err) => {
    console.error("shelf", key, err);
    await db
      .from("quote_collections")
      .update({ status: "failed", error: (err instanceof Error ? err.message : String(err)).slice(0, 300), updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("key", key);
  });
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(job);
  else await job;

  return { shelf: pending };
}

async function fillShelf(db: any, anthropic: Anthropic, userId: string, tz: string, date: string, shelf: any, { keep }: { keep: boolean }) {
  const { data: mine, error } = await db
    .from("quotes")
    .select("id, text, author, rating, saved_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(`quotes: ${error.message}`);

  const taste = (mine ?? [])
    .filter((q: any) => q.rating || q.saved_at)
    .slice(0, 60)
    .map((q: any) => ({ author: q.author, quote: q.text.slice(0, 200), rating: q.rating ?? "not rated", saved: Boolean(q.saved_at) }));
  const avoid = (mine ?? []).slice(0, 150).map((q: any) => `${q.author}: ${q.text.slice(0, 90)}`);
  const week = shelf.facet === "top" ? await weekContext(db, userId, tz, date) : undefined;

  const prompt =
    `Shelf: ${shelf.label}\nKind: ${shelf.facet}\n` +
    (shelf.hint ? `What it's for: ${shelf.hint}\n` : "") +
    `Find ${SHELF_SIZE} quotes.\n\n` +
    JSON.stringify({ ...(week ? { week } : {}), taste, avoid }, null, 1);

  const { answer, searched } = await findWithFallback(anthropic, SHELF_SYSTEM, prompt, { effort: "medium", maxUses: 8 });
  const { quotes } = await parseWith(anthropic, PARSE_SHELF_SYSTEM, ShelfSchema, answer, 6000);

  const seen = new Set((mine ?? []).map((q: any) => normal(q.text)));
  const found = quotes.filter((q) => {
    const n = normal(q.text);
    if (!n || !q.author.trim() || seen.has(n)) return false;
    seen.add(n);
    return true;
  });
  if (found.length === 0) throw new Error("No quotes came back.");

  // One at a time, so no two of them take the same picture.
  const used = await picturesInUse(db, userId);
  const pictures = [];
  for (const q of found) pictures.push(await pictureFor(q, used));
  const { data: rows, error: insertError } = await db
    .from("quotes")
    .insert(
      found.map((q, i) => ({
        ...quoteRow(userId, q, searched, pictures[i]),
        origin: shelf.facet === "top" ? "pick" : "shelf",
        pick_reason: shelf.facet === "top" ? q.why.trim() || null : null,
      }))
    )
    .select("id");
  if (insertError) throw new Error(`quotes: ${insertError.message}`);

  const ids = [...(keep ? shelf.quote_ids ?? [] : []), ...(rows ?? []).map((r: any) => r.id)];
  const { error: doneError } = await db
    .from("quote_collections")
    .update({ status: "ready", error: null, quote_ids: ids, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("key", shelf.key);
  if (doneError) throw new Error(`quote_collections: ${doneError.message}`);
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
          // A shelf asked for by hand, for every user.
          if (body.action === "shelf") {
            const out = await requestShelf(admin, anthropic, profile.id, tz, localDate, body);
            results.push({ user: profile.id, shelf: "error" in out ? out.error : out.shelf.status });
            continue;
          }
          const out = await pickFor(admin, anthropic, profile.id, tz, localDate);
          // And this week's top picks, so the Board opens on them. They fill
          // in the background; a week that has them already is left alone.
          await requestShelf(admin, anthropic, profile.id, tz, localDate, {
            key: `top:${sundayOf(localDate)}`,
            facet: "top",
            label: "Top picks for you",
          });
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

    if (body.action === "repicture") {
      return json(await repicture(supabase, anthropic, userData.user.id));
    }

    if (body.action === "shelf") {
      const out = await requestShelf(supabase, anthropic, userData.user.id, tz, date, body);
      if ("error" in out) return json({ error: out.error }, out.status);
      return json(out.shelf);
    }

    const out = await pickFor(supabase, anthropic, userData.user.id, tz, date);
    return json(out.day);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
