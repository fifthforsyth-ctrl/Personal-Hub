import { addDays, fmtShortDate } from "./planDates.js";
import { shortGoal, gearFor } from "./ascent.js";
import { LEVELS, shortTarget, answersOf } from "./mark.js";
import { countsToward, LINEAGE_WEEKS } from "./focus.js";

// The Targets tab: the whole ladder in one place, biggest to smallest. The
// mission, the lifetime goals (the top of the goal wheel), the quests and
// lessons, and the week's focus. Each has its own page at /targets/<key>,
// with notes, reflections and quotes linked to it.
//
// "Target" already names the Mark's rows (mark_targets) and the week's
// minutes (weekly_targets), so the code here says "ladder".
//
// Pure, so it can be tested; the loading is in api.js.

export const MISSION_KEY = "mission";
const KINDS = ["mission", "goal", "quest", "lesson", "focus"];

export const KIND_NAME = {
  mission: "My mission",
  goal: "Lifetime goal",
  quest: "Quest",
  lesson: "Lesson from God",
  focus: "This week's focus",
};

// The page a target lives on.
export function pathOf(kind, id) {
  if (kind === "mission") return "/targets/mission";
  return id ? `/targets/${id}` : "/targets";
}

// --- Which target a link means -------------------------------------------------

// What `/targets/<ref>` points at, as { kind, id, key }, or null when it's
// nothing of his. `key` is the target's own address, which the page moves
// to when the link used another one:
//   "mission"                      the mission
//   a lifetime goal's id           that goal
//   a goal further down the wheel  the lifetime goal it sits under
//   a quest's id                   that quest (on, done or set aside)
//   a lesson's mountain's id       the lesson
//   a lesson's id, or lesson-<id>  the lesson (learning, learned or set aside)
//   a week's focus id              the newest week of that focus, up to
//                                  this one
// `data` holds the rows: { goals (the lifetime goals), edges ({ parent_id,
// child_id }, optional), quests, lessons, focusGoals }, and `upTo`, this
// week's focus week_start ("YYYY-MM-DD", optional): a focus he has already
// kept into next week still opens on this week's row, where today's arrow
// lands.
export function resolveRef(ref, data) {
  const raw = String(ref ?? "").trim();
  if (!raw) return null;
  if (raw === MISSION_KEY) return { kind: "mission", id: null, key: MISSION_KEY };
  const id = raw.startsWith("lesson-") ? raw.slice(7) : raw;
  const lessons = data?.lessons ?? [];
  const lesson = (lid) => {
    const l = lessons.find((x) => x?.id === lid);
    return l ? { kind: "lesson", id: l.id, key: l.id } : null;
  };
  if (raw.startsWith("lesson-")) return lesson(id);

  if ((data?.goals ?? []).some((g) => g?.id === id)) return { kind: "goal", id, key: id };
  const q = (data?.quests ?? []).find((x) => x?.id === id);
  if (q) return q.lesson_id ? lesson(q.lesson_id) : { kind: "quest", id, key: id };
  const l = lesson(id);
  if (l) return l;
  const f = newestInLine(id, data?.focusGoals, data?.upTo);
  if (f) return { kind: "focus", id: f, key: f };
  const root = rootGoalOf(id, data?.goals, data?.edges);
  if (root) return { kind: "goal", id: root, key: root };
  return null;
}

// The newest week of a focus: follow the rows carried from it forward, week
// by week, to the one nothing was carried from yet. Null when the id isn't a
// focus. If two rows were carried from one (there shouldn't be), the later
// week wins. Stops at a loop and after a year. With `upTo` (a week_start),
// it never steps into a week after that one: planning next week early
// carries this week's rows forward, but this week is still the one he's
// living. A link straight to a later week's row still opens that row.
export function newestInLine(id, focusGoals, upTo = null) {
  const rows = focusGoals ?? [];
  if (!rows.some((g) => g?.id === id)) return null;
  const later = (a, b) =>
    String(a.week_start ?? "").localeCompare(String(b.week_start ?? "")) ||
    String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) ||
    String(a.id).localeCompare(String(b.id));
  const next = new Map();
  for (const g of rows) {
    if (!g?.carried_from) continue;
    if (upTo && String(g.week_start ?? "") > upTo) continue;
    const had = next.get(g.carried_from);
    if (!had || later(g, had) > 0) next.set(g.carried_from, g);
  }
  let cur = id;
  const seen = new Set([cur]);
  for (let i = 0; i < LINEAGE_WEEKS; i++) {
    const n = next.get(cur);
    if (!n || seen.has(n.id)) break;
    cur = n.id;
    seen.add(cur);
  }
  return cur;
}

// The lifetime goal a goal further down the wheel sits under: up through
// the parent each goal is drawn under (its first edge, as the wheel and
// delete_goal read it; pass edges oldest first) to one that is a lifetime
// goal. Null when none is, or it isn't a goal at all.
export function rootGoalOf(id, goals, edges) {
  const roots = new Set((goals ?? []).map((g) => g?.id).filter(Boolean));
  if (roots.has(id)) return id;
  const parent = new Map();
  for (const e of edges ?? []) {
    if (e?.child_id && e?.parent_id && !parent.has(e.child_id)) parent.set(e.child_id, e.parent_id);
  }
  const seen = new Set([id]);
  for (let p = parent.get(id); p && !seen.has(p); p = parent.get(p)) {
    if (roots.has(p)) return p;
    seen.add(p);
  }
  return null;
}

// What api.js filters and writes by: { mission: true } or { goal_id },
// { quest_id }, { lesson_id }, { focus_goal_id }.
export function refOf(target) {
  const kind = target?.kind;
  const id = target?.id ?? null;
  if (kind === "mission") return { mission: true };
  if (!id || !KINDS.includes(kind)) return null;
  return { [kind === "focus" ? "focus_goal_id" : `${kind}_id`]: id };
}

// --- The ladder line over a page --------------------------------------------------

// Up the ladder from a target, biggest first, as [{ label, to }]: the
// mission, then the lifetime goal, then the quest or lesson a focus counts
// toward. The target itself isn't in it. `rows` holds { goals, quests,
// lessons, focusGoals } by id lookups (arrays).
export function crumbsFor(target, rows) {
  if (!target || target.kind === "mission") return [];
  const out = [{ label: "My mission", to: pathOf("mission") }];
  const goals = rows?.goals ?? [];
  const goalCrumb = (goalId) => {
    const g = goalId ? goals.find((x) => x?.id === goalId) : null;
    if (g) out.push({ label: shortGoal(g.title), to: pathOf("goal", g.id) });
  };
  if (target.kind === "goal") return out;
  if (target.kind === "quest" || target.kind === "lesson") {
    const list = target.kind === "quest" ? rows?.quests : rows?.lessons;
    goalCrumb(list?.find((x) => x?.id === target.id)?.goal_id);
    return out;
  }
  // A focus: what it counts toward, and what that serves.
  const f = (rows?.focusGoals ?? []).find((x) => x?.id === target.id);
  const to = countsToward(f);
  if (!to) return out;
  if (to.kind === "goal") {
    goalCrumb(rootGoalOf(to.id, goals, rows?.edges) ?? to.id);
    return out;
  }
  const list = to.kind === "quest" ? rows?.quests : rows?.lessons;
  const hit = list?.find((x) => x?.id === to.id);
  if (!hit) return out;
  goalCrumb(hit.goal_id);
  out.push({ label: shortTarget(to.kind, hit.title), to: pathOf(to.kind, hit.id) });
  return out;
}

// --- The quests on Today -----------------------------------------------------------

// One pill per quest he's on and lesson he's learning, in their order:
//   [{ key, kind, name, short, camps, today, done }]
// `key` is the page's address (a lesson's own id, never its mountain's).
// `short` is the one word a pill shows, unless two pills would show the
// same word: then both show their full names, so he can tell them apart.
// `camps` counts the camps still ahead and reached; `today` the things on
// today's list there not yet done, `done` the ones finished today.
// `items` are today's quest items (todayPlan's questItemsForToday), each
// with its questId; a lesson's are on its mountain.
export function questPills({ quests = [], lessons = [], camps = [], items = [] } = {}) {
  const byPos = (a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  const mountain = new Map(quests.filter((q) => q?.lesson_id).map((q) => [q.lesson_id, q]));
  const campCount = new Map();
  for (const c of camps) campCount.set(c.quest_id, (campCount.get(c.quest_id) ?? 0) + 1);
  const tally = new Map();
  for (const it of items) {
    if (!it?.questId) continue;
    const t = tally.get(it.questId) ?? { open: 0, done: 0 };
    for (const one of it.heading ? it.subs ?? [] : [it]) {
      if (one.done) t.done += 1;
      else t.open += 1;
    }
    tally.set(it.questId, t);
  }
  const pill = (kind, key, title, questId) => {
    const t = (questId && tally.get(questId)) || { open: 0, done: 0 };
    return { key, kind, name: title, short: shortTarget(kind, title), camps: questId ? campCount.get(questId) ?? 0 : 0, today: t.open, done: t.done };
  };
  const out = quests
    .filter((q) => !q.lesson_id && q.status === "on")
    .sort(byPos)
    .map((q) => pill("quest", q.id, q.title, q.id));
  for (const l of lessons.filter((x) => x.status === "learning").sort(byPos)) out.push(pill("lesson", l.id, l.title, mountain.get(l.id)?.id ?? null));
  const word = (p) => p.short.toLowerCase();
  const uses = new Map();
  for (const p of out) uses.set(word(p), (uses.get(word(p)) ?? 0) + 1);
  return out.map((p) => (uses.get(word(p)) > 1 ? { ...p, short: p.name } : p));
}

// "3 camps · 2 today", "1 camp", "4 today", or "".
export function pillLine(p) {
  const parts = [];
  if (p?.camps) parts.push(`${p.camps} ${p.camps === 1 ? "camp" : "camps"}`);
  if (p?.today) parts.push(`${p.today} today`);
  return parts.join(" · ");
}

// --- Reflecting on a target ----------------------------------------------------------

// A question at a time, drawn from reflection that works: the after-action
// review (what was meant to happen, what did, why, what next), looking back
// over the day for what helped, Franklin's evening question, and asking
// what the next small step is. About what happened and what he'll do; never
// a sermon.
export const REFLECT_PROMPTS = {
  mission: [
    "What did this week add to the person you're becoming?",
    "Which lifetime goal got the least of you lately, and why?",
    "If the next ten years went like the last ten days, where would you end up?",
    "Where did you see God's hand in your life this week?",
    "What's one thing to start, stop or keep doing, starting tomorrow?",
  ],
  goal: [
    "What moved this forward lately, and what held it back?",
    "What does the man who's already there do every day?",
    "Which focus feeds this best right now, and which one isn't pulling its weight?",
    "What would make this week count for it?",
    "Whose life or work shows you how this is done? What did they do?",
  ],
  quest: [
    "What was supposed to happen, and what actually happened?",
    "Where did it go differently from what you planned, and why?",
    "What will you keep doing, and what will you do differently next time?",
    "What one thing would move it most this week?",
    "What are you putting off on it, and what's the smallest first step?",
    "Where did help come from that you didn't plan for?",
  ],
  lesson: [
    "When did it come up today, and what did you do?",
    "What made it harder, and what made it easier?",
    "What sets it off, and what will you do instead next time?",
    "What is this teaching you about yourself?",
    "Where did help come from that you didn't see coming?",
  ],
  focus: [
    "Did today move it? What did?",
    "What got in the way, and how will you get around it tomorrow?",
    "What's working well enough to keep doing?",
    "What would a great day for this look like tomorrow?",
  ],
};

// The nth question for a kind, going round.
export function promptFor(kind, n = 0) {
  const list = REFLECT_PROMPTS[kind] ?? REFLECT_PROMPTS.quest;
  const i = ((Math.trunc(Number(n) || 0) % list.length) + list.length) % list.length;
  return list[i];
}

// Which question to open on: a different one each day, so the same one
// doesn't greet him every time.
export function promptIndexFor(kind, date) {
  const list = REFLECT_PROMPTS[kind] ?? REFLECT_PROMPTS.quest;
  const d = String(date ?? "");
  let h = 0;
  for (const ch of `${kind}:${d}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % list.length;
}

// A note as it's kept: no blank space round it, its own line breaks kept,
// and no longer than the 4000 characters the table allows.
export const NOTE_MAX = 4000;
export function cleanTargetNote(text) {
  const trimmed = String(text ?? "").replace(/\r\n?/g, "\n").trim();
  return Array.from(trimmed).slice(0, NOTE_MAX).join("").trim();
}

// Where a target's unsaved words wait, per target.
export function noteDraftKey(target) {
  return `hub.target-note-draft.${target?.kind ?? "x"}:${target?.key ?? target?.id ?? "x"}`;
}

// --- The notes on a page -----------------------------------------------------------

// What the evening said about a target, read only: each loosed shot's line,
// and each check's own line, as timeline rows. Each row also says where
// that arrow landed and, on a miss, what got in the way, as the target's
// own list of lines used to: `ring` is "Outer · Distracted", "Bullseye",
// or null. `reasons` are the target's own (mark_targets.reasons).
export function eveningLines(shots, reasons = []) {
  const out = [];
  for (const s of shots ?? []) {
    if (!s?.date) continue;
    const at = s.loosed_at ?? s.created_at ?? `${s.date}T23:59:00`;
    const ring = ringOf(s, reasons);
    const note = String(s.note ?? "").trim();
    if (note) out.push({ id: `shot:${s.id}`, source: "evening", kind: "evening", date: s.date, created_at: at, text: note, prompt: null, ring });
    answersOf(s).forEach((a, i) => {
      const line = a.line.trim();
      if (line) out.push({ id: `shot:${s.id}:${i}`, source: "evening", kind: "evening", date: s.date, created_at: at, text: line, prompt: a.text || null, ring });
    });
  }
  return out;
}

// "Outer · Distracted": the ring's name, and on a miss its reason.
function ringOf(shot, reasons) {
  const level = Number.isInteger(shot?.level) ? LEVELS[shot.level] : null;
  if (!level) return null;
  const why = shot.level > 0 && shot.reason != null ? String((reasons ?? [])[shot.reason] ?? "").trim() : "";
  return why ? `${level.name} · ${why}` : level.name;
}

// Everything written about a target, newest first, grouped by day:
//   [{ date, label, items: [{ id, source, kind, date, created_at, text, prompt }] }]
// `notes` are target_notes rows, `focusNotes` focus_notes rows (a focus's
// notes from Today), `evening` what eveningLines gives (its rows keep
// their `ring`).
export function notesTimeline({ notes = [], focusNotes = [], evening = [] } = {}, today) {
  const rows = [
    ...notes.map((n) => ({ id: n.id, source: "target", kind: n.kind === "reflection" ? "reflection" : "note", date: n.date, created_at: n.created_at, text: n.text, prompt: n.prompt ?? null })),
    ...focusNotes.map((n) => ({ id: n.id, source: "focus", kind: "note", date: n.date, created_at: n.created_at, text: n.text, prompt: null })),
    ...evening,
  ].filter((r) => r.date && String(r.text ?? "").trim());
  rows.sort(
    (a, b) =>
      String(b.date).localeCompare(String(a.date)) ||
      String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")) ||
      String(b.id).localeCompare(String(a.id))
  );
  const groups = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last && last.date === r.date) last.items.push(r);
    else groups.push({ date: r.date, label: dayLabelOf(r.date, today), items: [r] });
  }
  return groups;
}

// "Today", "Yesterday", or "Mon, Oct 27".
export function dayLabelOf(date, today) {
  const d = String(date ?? "").slice(0, 10);
  if (!d) return "";
  if (today && d === today) return "Today";
  if (today && d === addDays(today, -1)) return "Yesterday";
  return fmtShortDate(d);
}

// --- Linking quotes ------------------------------------------------------------------

// Lowercase, accents off, so "Uchtdorf" finds "Uchtdorf" and "naïve" "naive".
function fold(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// The words of a search, up to eight.
export function searchWords(query) {
  return fold(query)
    .split(/[^a-z0-9']+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter(Boolean)
    .slice(0, 8);
}

// The quotes whose words, author or source hold every word of the search,
// in the library's order. An empty search finds nothing (the sections show
// then instead).
export function filterQuotes(library, query) {
  const words = searchWords(query);
  if (!words.length) return [];
  return (library ?? []).filter((q) => {
    const hay = fold([q.text, q.author, q.source, q.year].filter((x) => x != null).join(" "));
    return words.every((w) => hay.includes(w));
  });
}

// The same for his own written-down quotes (study notes).
export function filterOwnQuotes(notes, query) {
  const words = searchWords(query);
  if (!words.length) return [];
  return (notes ?? []).filter((n) => {
    const hay = fold([n.title, n.excerpt, n.essence, n.body_preview, n.body, ...(n.shelf_people ?? [])].filter(Boolean).join(" "));
    return words.every((w) => hay.includes(w));
  });
}

// With nothing typed, the picker's sections, each a short list and no quote
// in two: what's linked here, what he pinned to the Board, what he said
// applies, this week's top picks, and the newest.
//   [{ key, title, quotes }]  (empty sections left out)
export function pickerSections(library, { linkedIds = [], pickIds = [], limit = 8 } = {}) {
  const lib = library ?? [];
  const byId = new Map(lib.map((q) => [q.id, q]));
  const seen = new Set();
  const take = (list, max) => {
    const out = [];
    for (const q of list) {
      if (!q || seen.has(q.id)) continue;
      seen.add(q.id);
      out.push(q);
      if (out.length >= max) break;
    }
    return out;
  };
  const sections = [
    { key: "linked", title: "Linked here", quotes: take(linkedIds.map((id) => byId.get(id)), Infinity) },
    {
      key: "board",
      title: "On your board",
      quotes: take(
        lib.filter((q) => q.saved_at).sort((a, b) => String(b.saved_at).localeCompare(String(a.saved_at))),
        limit
      ),
    },
    {
      key: "applies",
      title: "Applies to you",
      quotes: take(
        lib.filter((q) => q.rating === "applies").sort((a, b) => String(b.rated_at ?? "").localeCompare(String(a.rated_at ?? ""))),
        limit
      ),
    },
    { key: "picks", title: "This week's picks", quotes: take(pickIds.map((id) => byId.get(id)), limit) },
    { key: "recent", title: "Recent", quotes: take([...lib].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))), limit) },
  ];
  return sections.filter((s) => s.quotes.length);
}

// The shelf that finds new quotes for a target, through the Board's "ask"
// shelves: one per target, so asking twice adds to the same shelf.
export function askShelfFor(target, title, why) {
  const words = fold(title).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "target";
  const id = String(target?.key ?? target?.id ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
  const slug = `${words}${id ? `-${id}` : ""}`.slice(0, 80).replace(/-+$/g, "");
  const label = String(title ?? "").trim().slice(0, 80) || "This target";
  const hint = [String(title ?? "").trim(), String(why ?? "").trim()].filter(Boolean).join(": ").slice(0, 300) || label;
  return { key: `ask:${slug}`, facet: "ask", label, hint };
}

// --- The overview ---------------------------------------------------------------------

// The four tiers of the Targets page, biggest to smallest, from what the
// Range loads (`view` from buildAscent, `range` from buildRange) and the
// week's focus (useFocusWeek's goals):
//   { mission, goals: [...], climbs: [...], focuses: [...] }
// Goals, quests and lessons carry their range target (for the small face).
export function ladderOf({ view, range, focusGoals = [], pills = [] } = {}) {
  const targetOf = (key) => (range?.all ?? []).find((t) => t.key === key) ?? null;
  const pillOf = new Map(pills.map((p) => [p.key, p]));
  const goals = (view?.goals ?? []).map((g) => ({
    key: g.id,
    kind: "goal",
    title: g.title,
    short: shortGoal(g.title),
    gear: g.gear ?? gearFor(g.title),
    target: targetOf(g.id),
  }));
  const climbs = [
    ...(view?.quests ?? []).map((q) => ({ key: q.id, kind: "quest", title: q.title, serves: q.serves, mountainId: q.id })),
    ...(view?.lessons ?? []).map((l) => ({ key: l.id, kind: "lesson", title: l.title, serves: l.serves, mountainId: l.mountain?.id ?? null })),
  ].map((c) => {
    const p = pillOf.get(c.key);
    return { ...c, short: shortTarget(c.kind, c.title), target: targetOf(c.key), camps: p?.camps ?? 0, today: p?.today ?? 0 };
  });
  const focuses = [...(focusGoals ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))
    .map((f) => ({ key: f.id, kind: "focus", title: f.title, goal: f }));
  return { mission: view?.mission ?? null, goals, climbs, focuses };
}
