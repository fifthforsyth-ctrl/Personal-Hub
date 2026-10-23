// Quest work on the day's blocks (0085): a block tagged with a quest, or one
// camp of it ("today I'm on the Multicam tab"), makes what got finished there
// that day part of the day's work, so the end-of-day report lists it.
//
// Pure, so it can be tested; the loading is in api.js.

// The choices for a block's quest: each quest, then each of its camps under
// it. Lessons' own mountains aren't work, so they're left out.
//   [{ value: "q:<id>" | "c:<id>", label, questId, campId }]
export function questTagOptions(quests = [], camps = []) {
  const pos = (a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.title).localeCompare(String(b.title));
  const out = [];
  for (const q of [...quests].filter((q) => !q.lesson_id).sort(pos)) {
    out.push({ value: `q:${q.id}`, label: q.title, questId: q.id, campId: null });
    for (const c of camps.filter((c) => c.quest_id === q.id).sort(pos)) {
      out.push({ value: `c:${c.id}`, label: `${q.title} · ${c.title}`, short: c.title, questId: q.id, campId: c.id });
    }
  }
  return out;
}

// The option a block is tagged with, or null.
export function tagOf(chunk, options) {
  if (chunk?.camp_id) return options.find((o) => o.campId === chunk.camp_id) ?? null;
  if (chunk?.quest_id) return options.find((o) => o.value === `q:${chunk.quest_id}`) ?? null;
  return null;
}

// What got finished on the tagged quests and camps on `date`, once each:
//   [{ id, title, where }]
// A camp tag takes that camp's steps (sub-steps too); a quest tag takes its
// own tasks and the steps of all its camps. Note lines aren't work done.
export function questWorkDone({ date, chunks = [], quests = [], camps = [], tasks = [], steps = [] }) {
  const questIds = new Set();
  const campIds = new Set();
  for (const c of chunks) {
    if (c.camp_id) campIds.add(c.camp_id);
    else if (c.quest_id) questIds.add(c.quest_id);
  }
  if (!questIds.size && !campIds.size) return [];
  const questName = new Map(quests.map((q) => [q.id, q.title]));
  const camp = new Map(camps.map((c) => [c.id, c]));
  const out = [];
  for (const t of tasks) {
    if (t.done_on !== date || (t.kind && t.kind !== "task") || !questIds.has(t.quest_id)) continue;
    out.push({ id: t.id, title: t.text, where: questName.get(t.quest_id) ?? "Quest", at: t.done_at ?? t.updated_at ?? "" });
  }
  for (const s of steps) {
    const c = camp.get(s.camp_id);
    if (s.done_on !== date || !c || !(campIds.has(c.id) || questIds.has(c.quest_id))) continue;
    out.push({ id: s.id, title: s.text, where: c.title, at: s.updated_at ?? "" });
  }
  return out.sort((a, b) => String(a.at).localeCompare(String(b.at))).map(({ at, ...x }) => x);
}
