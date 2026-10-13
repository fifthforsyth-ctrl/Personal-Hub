// The Board's quiet filing: a one-line gist, a few tags, and the shelves
// each thought belongs on.
//
// A thought is kept exactly as you wrote it, as one card. What this adds is
// for later: the gist says what the thought is ABOUT, in a line, and the tags
// are the words you'd search for months from now. The search box reads both,
// and so does the curator when it chooses what to bring back. Neither is
// shown on the card, which still reads in your own words.
//
// The shelves are the Board's people, themes and moods. A line of Elder
// Bednar's you wrote down goes on his shelf; a thought about getting up
// early goes under Discipline. Your Obsidian notes are filed this way too
// (they're yours), though they get no gist.
//
// And each thought gets a picture, the way quotes do: a photograph from
// Wikimedia Commons that stands for it (a symbol, a place, a scene), never
// one already on the Board. A picture you added yourself comes first, and
// one you take off isn't put back.
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

// The Board's shelves, by name. These match src/lib/quoteShelves.js (the
// tests check), and the keys are made the same way.
const PEOPLE = [
  "Russell M. Nelson", "Jeffrey R. Holland", "Dieter F. Uchtdorf", "Dallin H. Oaks",
  "David A. Bednar", "Neal A. Maxwell", "Gordon B. Hinckley", "Joseph Smith",
  "Abraham Lincoln", "C. S. Lewis", "Theodore Roosevelt", "Winston Churchill",
  "Marcus Aurelius", "Frederick Douglass", "George Washington", "Viktor Frankl",
];
const THEMES = [
  "Faith", "Grace", "Repentance", "Discipline", "Work", "Courage",
  "Gratitude", "Prayer", "Family", "Service", "Adversity", "Purpose",
] as const;
const MOODS = [
  "Discouraged", "Anxious", "Tired", "Tempted", "Restless",
  "Overwhelmed", "Lonely", "Grateful", "Joyful", "Ambitious",
] as const;

const GistSchema = z.object({
  gist: z
    .string()
    .describe("One line, at most fifteen words, saying what the thought is about. Empty only when there is nothing to say."),
  tags: z
    .array(z.string())
    .describe("Two to five lowercase tags: the people, themes, places or scripture books it touches."),
  people: z
    .array(z.string())
    .describe("The people whose own words or teaching the note records, by full name; empty if none."),
  themes: z.array(z.enum(THEMES)).describe("The shelf themes the note is truly about, from the list; often one or two, empty if none fit."),
  moods: z.array(z.enum(MOODS)).describe("The moods the note would speak to, from the list; often none."),
  image_query: z
    .string()
    .describe("Two to five plain words a photo search would find: an object, place or scene that stands for the thought. Empty only when nothing fits."),
});

const SYSTEM = `You file one of a person's own captured thoughts so it can be found again later. They are a member of The Church of Jesus Christ of Latter-day Saints, and the thought may be spiritual, practical, or anything in between.

Write two things.

The gist: one plain line, at most fifteen words, naming what the thought is ABOUT. Not a restatement of its wording and not a summary of its argument: the subject, the way they'd describe it if asked "what was that note?". "Choosing patience with the kids when tired" rather than "A reflection on the importance of patience".

The tags: two to five lowercase tags, each one or two words. Use the words they would actually search for later: a person's name, a theme ("patience", "prayer", "work"), a place, a scripture book ("alma", "d&c"). No generic tags like "thought", "note", "spiritual" or "life".

Then file it on the Board's shelves:

People: whose words or teaching does the note record? A quote they wrote down, a line from a talk, a paraphrase of what someone taught ("Elder Bednar said...", "Bednar: ..."). Give each person's full name without titles. For these people use the name exactly as listed: ${PEOPLE.join("; ")}. A person merely mentioned (a family member, a friend they helped) is not one. Their own thoughts are not anyone's words: leave it empty.

Themes, from this list only: ${THEMES.join(", ")}. Choose a theme only when the note is really about it, not because a word appears. Often one or two; none if nothing fits.

Moods, from this list only: ${MOODS.join(", ")}. A mood fits when the note would help someone feeling that way (or was written from it): a note on pressing on when worn out fits Tired. Most notes fit none.

The picture: two to five plain words for a photograph that stands for the thought, the way a symbol would. An object, a place or a scene, never a person: "lighthouse in a storm", "worn leather boots", "seedling through concrete", "empty road at dawn", "open scriptures by a window". Choose something concrete a photo search will find, and fitting to this thought rather than a generic one. Leave it empty only when the note is too slight to suggest anything.

Rules:
- Use only what is in the text. Never invent a person, a reference or a theme it doesn't touch.
- No praise, no commentary, no advice.
- If the text is too short or empty to say anything, return an empty gist and no tags.`;

// "Russell M. Nelson" -> "russell-m-nelson", the same as the Board does it.
function slug(text: string) {
  return (
    String(text ?? "")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/, "") || "x"
  );
}

const TITLES = /^(elder|president|pres\.?|sister|brother|bishop|prophet|apostle|dr\.?|mr\.?|mrs\.?|saint|st\.?)\s+/i;

// A name as the model gave it, made the Board's: titles off, and one of the
// Board's own people by their listed name ("Elder Bednar" is David A.
// Bednar), so it lands on the shelf that's already there.
export function personName(raw: string) {
  let name = String(raw ?? "").trim();
  while (TITLES.test(name)) name = name.replace(TITLES, "").trim();
  if (!name) return "";
  const words = (n: string) => n.toLowerCase().replace(/[^a-z ]/g, " ").trim().split(/\s+/);
  const same = (p: string) => {
    const [a, b] = [words(p), words(name)];
    if (a.at(-1) !== b.at(-1)) return false;
    // "Bednar" or "David Bednar" is David A. Bednar; "Hyrum Smith" isn't Joseph.
    return b.length === 1 || a[0] === b[0];
  };
  const known = PEOPLE.find((p) => p.toLowerCase() === name.toLowerCase()) ?? PEOPLE.find(same);
  return (known ?? name).slice(0, 80);
}

// --- pictures ----------------------------------------------------------------

const WEB_HEADERS = { "User-Agent": "PersonalHub/1.0 (personal board; https://github.com/fifthforsyth-ctrl/Personal-Hub)" };

type Picture = { image_url: string; image_credit: string; image_page: string | null };

// Photographs that suit the words, from Wikimedia Commons: wide ones, at a
// width a card can use, best match first.
async function scenePictures(query: string): Promise<Picture[]> {
  if (!query.trim()) return [];
  const response = await fetch(
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2" +
      `&generator=search&gsrnamespace=6&gsrlimit=10&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}` +
      "&prop=imageinfo&iiprop=url%7Csize&iiurlwidth=500",
    { headers: WEB_HEADERS, signal: AbortSignal.timeout(8000) }
  );
  if (!response.ok) return [];
  const body = await response.json();
  return (body?.query?.pages ?? [])
    .sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0))
    .map((p: any) => p.imageinfo?.[0])
    .filter((i: any) => i?.thumburl && i.width >= 600 && i.width >= i.height)
    .map((i: any) => ({ image_url: String(i.thumburl), image_credit: "Wikimedia Commons", image_page: i.descriptionurl ?? null }));
}

// Every picture already on the Board, so no two cards share one.
async function picturesInUse(supabase: any): Promise<Set<string>> {
  const [notes, quotes] = await Promise.all([
    supabase.from("study_notes").select("image_url").not("image_url", "is", null),
    supabase.from("quotes").select("image_url").not("image_url", "is", null),
  ]);
  return new Set([...(notes.data ?? []), ...(quotes.data ?? [])].map((r: any) => r.image_url));
}

// The first match nobody else has, claimed at once so a note being filed
// alongside can't take it too.
async function pictureFor(query: string, used: Set<string>): Promise<Picture | null> {
  try {
    const found = (await scenePictures(query)).find((p) => !used.has(p.image_url)) ?? null;
    if (found) used.add(found.image_url);
    return found;
  } catch (err) {
    console.warn("picture", err);
    return null;
  }
}

// Notes are filed a few at a time: each is a short call, and the function
// has 150 seconds of wall clock in all.
const BACKLOG_MAX = 8;
const AT_ONCE = 3;

async function fileNote(supabase: any, anthropic: Anthropic, note: any, used: Set<string>) {
  const text = [note.title, note.excerpt, note.body].filter((s) => s && String(s).trim()).join("\n\n").slice(0, 6000);

  let gist = "";
  let tags: string[] = [];
  let people: string[] = [];
  let keys: string[] = [];
  let imageQuery = "";
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
    people = [...new Set(out.people.map(personName).filter(Boolean))].slice(0, 4);
    keys = [
      ...people.map((p) => `person:${slug(p)}`),
      ...out.themes.map((t) => `theme:${slug(t)}`),
      ...out.moods.map((m) => `mood:${slug(m)}`),
    ];
    keys = [...new Set(keys)];
    imageQuery = out.image_query.trim().slice(0, 80);
  }

  // A picture only once: not over one you added, and not again after you
  // took it off.
  const wantsPicture = !note.pictured_at && !note.image_path && !note.image_url;
  const picture = wantsPicture && imageQuery ? await pictureFor(imageQuery, used) : null;

  // Stamped even when there was nothing to say, so it isn't asked again.
  // Vault notes are long sources: they're shelved but get no gist.
  const now = new Date().toISOString();
  const filing = {
    ...(note.obsidian_uid ? {} : { gist: gist || null, ai_tags: tags, gist_at: now }),
    shelf_keys: keys,
    shelf_people: people,
    shelved_at: now,
    ...(wantsPicture ? { ...(picture ?? {}), pictured_at: now } : {}),
  };
  const { error } = await supabase.from("study_notes").update(filing).eq("id", note.id);
  if (error) throw new Error(`study_notes: ${error.message}`);
  return { id: note.id, gist, tags, shelves: keys, picture: picture?.image_url ?? null };
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
    const columns = "id, title, body, excerpt, obsidian_uid, image_path, image_url, pictured_at";

    if (action === "gist") {
      const noteId = String(body.note_id ?? "").trim();
      if (!noteId) return json({ error: "gist needs a note_id." }, 400);
      // RLS means a note that isn't theirs simply isn't found.
      const { data: note, error } = await supabase.from("study_notes").select(columns).eq("id", noteId).single();
      if (error) throw new Error(`study_notes: ${error.message}`);
      return json(await fileNote(supabase, anthropic, note, await picturesInUse(supabase)));
    }

    if (action === "gist_backlog") {
      const limit = Math.min(Math.max(Number(body.limit) || BACKLOG_MAX, 1), BACKLOG_MAX);
      // Your own notes and your vault notes; cards cut from a note are
      // already filed under it.
      const { data: notes, error } = await supabase
        .from("study_notes")
        .select(columns)
        .eq("user_id", userData.user.id)
        .is("shelved_at", null)
        .is("parent_note_id", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`study_notes: ${error.message}`);

      const used = await picturesInUse(supabase);
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
              filed.push(await fileNote(supabase, anthropic, note, used));
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
