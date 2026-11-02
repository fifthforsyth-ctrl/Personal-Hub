// How the Hub's AI talks to you, and what it's told about where you're
// headed.
//
// You asked (November 2026) for the AI to push you hard to improve, as if the
// goal really is exaltation, and never to be a counselor telling you "it's
// okay". You also said you don't trust an AI to moralize about what God
// expects of you. So the push stands on evidence instead: your own record
// first, then the documented lives of real people, then research it can name.
// Reflection and being in tune with God stay at the centre; the push serves
// that walk and never stands in for it.
//
// Plain JavaScript beside index.ts, like body.js, so scripts/test.mjs can
// check the wording and the shape of what the prompts are given.

export const PUSH_TONE = `How to speak to them: as a demanding coach who expects more because they believe this person can become what they say they are becoming. Their mission and lifetime goals are in the record under "aim"; hold them to those, in their own words.
- Never soothe. No "it's okay", "be gentle with yourself", "progress, not perfection", "every small step counts", and no praise for effort alone. When the record shows a gap, name it plainly: the number, the day, the task, the focus that went untouched.
- Don't moralize and don't speak for God. Never say what God expects, what the Lord asks or wants, or judge their worthiness or standing. That is between them and God; your part is to show them the facts and ask the hard question.
- Ground every push in evidence, in this order: their own record (minutes, wins and losses, this week's focus, how their arrows landed, what they wrote); then the documented life of a real person who did the hard thing (who, what they actually did, roughly when); then well-established research, named with its source or researcher and year. Never invent a figure, a study, a quote or a story. If you aren't certain it's accurate, leave it out and use their record instead.
- Point forward. Where the format allows, end on one concrete next action: what, when, for how long, and something they can report back on.
- Keep reflection and their walk with God at the centre. Looking for God's hand stays a genuine question, never a test or a lecture.
- Second person. Short sentences. No lists, no emoji.`;

const cut = (s, n) => {
  const t = String(s ?? "").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

const day = (v) => String(v ?? "").slice(0, 10);

function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Words for an arrow's landing, the way The Range names them.
const LANDED = ["bullseye", "inner ring", "middle ring", "outer ring", "edge", "missed"];

// Does a time entry count toward a focus? A focus names its categories; an
// entry's category or any of its tags matching one of them (any case) does.
function counts(entry, categories) {
  const want = new Set((categories ?? []).map((c) => String(c).toLowerCase()));
  if (!want.size) return false;
  if (entry.category && want.has(String(entry.category).toLowerCase())) return true;
  return (entry.tags ?? []).some((t) => want.has(String(t).toLowerCase()));
}

// What the prompts are told about where you're headed, trimmed to what a
// push could use: the mission, each lifetime goal with its focuses and the
// last week's minutes on them, how the week's arrows landed on each target,
// this week's focus and what you've done with it, and the quests and lessons
// you're on. Everything is optional; a missing table is just a missing line.
//
// rows: { date, mission, goals:[{id,title}], focuses:[{id,goal_id,name,categories}],
//   entries:[{category,tags,duration_minutes,started_at}] (the last 7 days),
//   weekFocus:[{id,title,position}], checkins:[{goal_id,date,moved}],
//   targets:[{id,goal_id,quest_id,lesson_id}], shots:[{target_id,date,level,note}],
//   quests:[{id,title,status}], lessons:[{id,title,status}] }
export function aimForPrompt(rows = {}) {
  const date = rows.date;
  const since = date ? addDays(date, -6) : null;
  const inWeek = (d) => !since || (day(d) >= since && day(d) <= date);
  const out = {};

  if (rows.mission?.statement) {
    out.mission = cut(rows.mission.statement, 400);
    if (rows.mission.summit) out.summit = cut(rows.mission.summit, 80);
  }

  const targets = rows.targets ?? [];
  const shots = (rows.shots ?? []).filter((s) => inWeek(s.date));
  const arrowsFor = (targetId) =>
    shots
      .filter((s) => s.target_id === targetId)
      .sort((a, b) => day(a.date).localeCompare(day(b.date)))
      .map((s) => {
        const landed = LANDED[s.level] ?? "unknown";
        return s.note ? `${day(s.date)} ${landed}: ${cut(s.note, 160)}` : `${day(s.date)} ${landed}`;
      });
  const targetOf = (key, id) => targets.find((t) => t[key] === id);

  const entries = (rows.entries ?? []).filter((e) => inWeek(e.started_at));
  const focuses = rows.focuses ?? [];
  const goals = (rows.goals ?? []).map((g) => {
    const mine = focuses.filter((f) => f.goal_id === g.id);
    const entry = { goal: cut(g.title, 80) };
    if (mine.length) {
      entry.focuses = mine.map((f) => ({
        name: cut(f.name, 80),
        minutes_last_7_days: entries.filter((e) => counts(e, f.categories)).reduce((n, e) => n + (Number(e.duration_minutes) || 0), 0),
      }));
    } else {
      entry.focuses = "none set yet";
    }
    const t = targetOf("goal_id", g.id);
    const arrows = t ? arrowsFor(t.id) : [];
    if (arrows.length) entry.arrows_last_7_days = arrows;
    return entry;
  });
  if (goals.length) out.lifetime_goals = goals;

  const checkins = rows.checkins ?? [];
  const week = (rows.weekFocus ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((f) => {
      const mine = checkins.filter((c) => c.goal_id === f.id);
      return {
        focus: cut(f.title, 120),
        days_moved: mine.filter((c) => c.moved).length,
        days_not: mine.filter((c) => c.moved === false).length,
      };
    });
  if (week.length) out.this_weeks_focus = week;

  // A quest is on until it's done or set aside; a lesson is being learned.
  const active = (list, on) => (list ?? []).filter((x) => !x.status || x.status === on);
  const quests = active(rows.quests, "on").map((q) => {
    const t = targetOf("quest_id", q.id);
    const arrows = t ? arrowsFor(t.id) : [];
    return arrows.length ? { quest: cut(q.title, 120), arrows_last_7_days: arrows } : { quest: cut(q.title, 120) };
  });
  if (quests.length) out.quests = quests;

  const lessons = active(rows.lessons, "learning").map((l) => {
    const t = targetOf("lesson_id", l.id);
    const arrows = t ? arrowsFor(t.id) : [];
    return arrows.length ? { lesson: cut(l.title, 120), arrows_last_7_days: arrows } : { lesson: cut(l.title, 120) };
  });
  if (lessons.length) out.lessons = lessons;

  return Object.keys(out).length ? out : null;
}
