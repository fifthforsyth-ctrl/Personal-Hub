// What a camp holds (supabase/migrations/0079_camp_steps.sql): steps, grouped
// into sections the way a plan groups them, each with a note, and notes on
// the camp itself. A plan he uploads is read once into sections and steps
// and kept, so the same playbook can fill every tab of the plugin quest.
//
// The `plan` edge function does the reading. When it can't, the outline
// reader here does a plainer job from the plan's headings and lists, so an
// upload never dead-ends.
//
// Everything in this file is pure apart from outlineFromDocument, which
// walks a parsed page (a DOMParser Document) and so runs in the browser.

const BYPOS = (a, b) =>
  (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) || String(a.id).localeCompare(String(b.id));

// A camp's sections in order, each with its steps in order, the steps that
// sit in no section, and where it all stands: how many are done, and the
// first step still to do, reading top to bottom. Each step carries its
// sub-steps (0083) as `subs`, nested as deep as they go; they count like any
// step, and a sub-step whose step is gone stands on its own. With `today`,
// a step picked for today (0090), or in a section picked for today (0091),
// comes next before the rest.
export const isNote = (st) => st?.kind === "note";

// A step made a note (0095: it can't be ticked, be urgent or be worked on),
// or a task again.
export const kindFields = (st) => (isNote(st) ? { kind: "task" } : { kind: "note", done_on: null, urgency: null, working_since: null });

export function buildCamp(sections, steps, today = null) {
  const all = [...(steps ?? [])].sort(BYPOS);
  const ids = new Set(all.map((st) => st.id));
  const kids = new Map();
  for (const st of all) {
    if (!st.parent_id || !ids.has(st.parent_id)) continue;
    if (!kids.has(st.parent_id)) kids.set(st.parent_id, []);
    kids.get(st.parent_id).push(st);
  }
  // `seen` keeps a loop in the data (which the app never makes) from going round forever.
  const seen = new Set();
  const tree = (raw) => {
    seen.add(raw.id);
    return { ...raw, subs: (kids.get(raw.id) ?? []).filter((k) => !seen.has(k.id)).map(tree) };
  };
  const bySection = new Map();
  const loose = [];
  const known = new Set((sections ?? []).map((s) => s.id));
  for (const raw of all) {
    if (raw.parent_id && ids.has(raw.parent_id)) continue;
    const st = tree(raw);
    if (st.section_id && known.has(st.section_id)) {
      if (!bySection.has(st.section_id)) bySection.set(st.section_id, []);
      bySection.get(st.section_id).push(st);
    } else loose.push(st);
  }
  // A note (0095) is a line of notes: it can't be ticked, so it isn't counted.
  const flat = (list) => list.flatMap((st) => [...(isNote(st) ? [] : [st]), ...flat(st.subs)]);
  const shape = (s, i) => {
    const own = bySection.get(s.id) ?? [];
    const every = flat(own);
    const done = every.filter((st) => st.done_on).length;
    return { ...s, number: i + 1, steps: own, done, total: every.length, complete: every.length > 0 && done === every.length };
  };
  const sorted = [...(sections ?? [])].sort(BYPOS);
  const list = sorted.filter((s) => !s.clipboard).map(shape);
  // The clipboard's columns (0095) stand apart: thoughts not yet sorted
  // into the camp's sections don't count toward how far along it is.
  const clips = sorted.filter((s) => s.clipboard).map(shape);
  const ordered = flat([...loose, ...list.flatMap((s) => s.steps)]);
  const done = ordered.filter((st) => st.done_on).length;
  const onToday = (st) => Boolean(today) && (st.today_on === today || list.some((s) => s.id === st.section_id && s.today_on === today));
  return {
    sections: list,
    clips,
    loose,
    done,
    total: ordered.length,
    // What you're working on comes first; then the first step picked for
    // today that isn't done; then the first step not done.
    next:
      ordered.find((st) => !st.done_on && st.working_since) ??
      ordered.find((st) => !st.done_on && onToday(st)) ??
      ordered.find((st) => !st.done_on) ??
      null,
  };
}

// --- Today (0090) ----------------------------------------------------------------

// What's picked for today in a camp (from buildCamp), in the order it sits
// in the camp, as blocks: { blocks, items, done, total }.
//
// Steps picked one by one (0090) come in runs, { key, items }: each item is
// the step itself, with everything under it, and `from`, where it sits
// ("2. Search", "under “Tag clips”"). A step under one that's picked already
// shows under it, so it isn't shown twice.
//
// A section picked whole (0091) is a block of its own, { key, section,
// items, earlier }: its steps still to do, and the ones done today so a tick
// doesn't make them vanish; `earlier` counts the ones done before today,
// which aren't shown. A step picked on its own inside it shows there once.
//
// Each block has its own `done` and `total`, counting its items and
// everything under them; `items`, `done` and `total` are all of them.
export function todayPicks(view, today) {
  const blocks = [];
  let run = null;
  const walk = (list, section, parent) => {
    for (const st of list) {
      if (today && st.today_on === today) {
        if (!run) blocks.push((run = { key: `run-${st.id}`, items: [] }));
        run.items.push({ ...st, from: fromLabel(section, parent) });
      } else walk(st.subs, section, st);
    }
  };
  walk(view?.loose ?? [], null, null);
  for (const s of view?.clips ?? []) walk(s.steps, s, null);
  for (const s of view?.sections ?? []) {
    if (today && s.today_on === today) {
      const items = s.steps.filter((st) => stillOn(st, today));
      blocks.push({ key: `sec-${s.id}`, section: s, items, earlier: s.steps.length - items.length });
      run = null;
    } else walk(s.steps, s, null);
  }
  const flat = (list) => list.flatMap((st) => [...(isNote(st) ? [] : [st]), ...flat(st.subs)]);
  for (const b of blocks) {
    const every = flat(b.items);
    b.done = every.filter((st) => st.done_on).length;
    b.total = every.length;
  }
  return {
    blocks,
    items: blocks.flatMap((b) => b.items),
    done: blocks.reduce((n, b) => n + b.done, 0),
    total: blocks.reduce((n, b) => n + b.total, 0),
  };
}

// A step in a section picked for today shows there unless it was done
// before today (and everything under it with it).
function stillOn(st, today) {
  return !st.done_on || st.done_on >= today || st.subs.some((x) => stillOn(x, today));
}

// Where a step sits, for a step shown away from its place: "2. Search",
// "under “Tag clips”", or both.
export function fromLabel(section, parent) {
  const where = section ? (section.clipboard ? `Clipboard · ${section.title}` : `${section.number}. ${section.title}`) : null;
  const under = parent ? `under “${String(parent.text ?? "").slice(0, 60)}${String(parent.text ?? "").length > 60 ? "…" : ""}”` : null;
  return [where, under].filter(Boolean).join(" · ") || null;
}

// What picking changed: the ids now picked (`sel`, a Set) that weren't on
// today before (`before`), and the ones taken off.
export function pickDiff(before, sel) {
  const was = new Set(before);
  return { add: [...sel].filter((id) => !was.has(id)), remove: [...was].filter((id) => !sel.has(id)) };
}

// A quest's Today on Quests: for each of its camps, in order, what's
// picked for today there, as todayPicks gives it. Camps with nothing picked
// are left out. Each is { camp, number, blocks, items, done, total }.
export function questToday(camps, sections, steps, today) {
  return [...(camps ?? [])]
    .sort(BYPOS)
    .map((camp, i) => {
      const view = buildCamp(
        (sections ?? []).filter((s) => s.camp_id === camp.id),
        (steps ?? []).filter((st) => st.camp_id === camp.id)
      );
      return { camp, number: i + 1, ...todayPicks(view, today) };
    })
    .filter((g) => g.blocks.length);
}

// Every step under `id` in a camp's steps, however deep.
export function stepsUnder(steps, id) {
  const out = [];
  const seen = new Set([id]);
  for (let at = [id]; at.length; ) {
    const next = (steps ?? []).filter((x) => x.parent_id && at.includes(x.parent_id) && !seen.has(x.id));
    for (const x of next) seen.add(x.id);
    out.push(...next);
    at = next.map((x) => x.id);
  }
  return out;
}

// The colours steps wear (Aaron, 2026-10-30: "when I change the color of a
// section I want all the tasks to share the same color unless I change the
// color of a specific task"). Worked out as it shows, so nothing is written
// to the steps, and a section's new colour reaches every step at once.
// `shades(sections, steps)` keeps what it needs; `above(step)` is the colour
// a step takes on when it has none of its own, { color, from: "step" |
// "section" } or null: the nearest step it's under with one, else its
// section's. One set to "none" has none on purpose, and passes that on.
export function shades(sections, steps) {
  const section = new Map((sections ?? []).filter((s) => s.color).map((s) => [s.id, s.color]));
  const byId = new Map((steps ?? []).map((x) => [x.id, x]));
  const above = (st) => {
    const seen = new Set([st.id]);
    let top = st; // the step it all sits under, whose section it shows in
    for (let up = byId.get(st.parent_id); up && !seen.has(up.id); up = byId.get(up.parent_id)) {
      if (up.color) return { color: up.color, from: "step" };
      seen.add(up.id);
      top = up;
    }
    const c = section.get(top.section_id);
    return c ? { color: c, from: "section" } : null;
  };
  return { above, of: (st) => st.color ?? above(st)?.color ?? null, section };
}

// Resolving a section (0097, Aaron 2026-10-30): it goes, so it stops
// taking room in the camp, but the steps he finished in it are kept: their
// bricks stay in the village and the camp still counts them as done.
// `steps` are the camp's; `extras` the section's photos and the sketches
// and pasted pictures on its steps ({ photos, sketches, pictures }), or null
// when they couldn't be counted.
// Gives every step in it (`all`, with what's under them, and their `ids`),
// the finished ones kept (`kept`), what else goes with it in words
// (`lose`), and whether to ask before it goes (`ask`: only when something
// would be lost, or might be).
export function resolvePlan(section, steps, extras) {
  const all = (steps ?? []).filter((x) => x.section_id === section.id);
  const ids = new Set(all.map((x) => x.id));
  for (const x of [...all]) {
    for (const k of stepsUnder(steps, x.id)) {
      if (ids.has(k.id)) continue;
      ids.add(k.id);
      all.push(k);
    }
  }
  const kept = all.filter((x) => !isNote(x) && x.done_on);
  const open = all.filter((x) => !isNote(x) && !x.done_on).length;
  const notes = all.filter(isNote).length;
  const count = (n, one, many) => (n === 1 ? `1 ${one}` : `${n} ${many}`);
  const lose = [
    open && count(open, "step not done yet", "steps not done yet"),
    notes && count(notes, "note", "notes"),
    extras?.photos && count(extras.photos, "photo", "photos"),
    extras?.pictures && count(extras.pictures, "picture", "pictures"),
    extras?.sketches && count(extras.sketches, "sketch", "sketches"),
  ].filter(Boolean);
  return { all, ids, kept, lose, ask: lose.length > 0 || !extras };
}

// What the question before resolving says.
export function resolveWords(section, plan, extras) {
  const n = plan.kept.length;
  const list = plan.lose.length <= 1 ? plan.lose[0] ?? "" : `${plan.lose.slice(0, -1).join(", ")} and ${plan.lose[plan.lose.length - 1]}`;
  const parts = [];
  if (n) parts.push(`${n === 1 ? "Its finished step stays" : `Its ${n} finished steps stay`} in your village${section.clipboard ? "" : ", and the camp still counts them as done"}.`);
  if (list) parts.push(`Going with it: ${list}. Move anything you want to keep first.`);
  if (!extras) parts.push("Any photos in it, and sketches on its steps, go too.");
  return {
    title: `${section.clipboard ? "Remove" : n ? "Resolve" : "Remove"} “${section.title}”?`,
    body: parts.join(" ") || "It has nothing in it.",
    confirmLabel: section.clipboard ? "Remove column" : n ? "Resolve section" : "Remove section",
  };
}

// What the toast says once it's gone (with Undo).
export function resolvedLine(section, kept) {
  const name = String(section.title ?? "");
  const cut = name.length > 32 ? `${name.slice(0, 32).trimEnd()}…` : name;
  if (!kept) return `“${cut}” removed`;
  return `“${cut}” resolved · ${kept === 1 ? "1 done step kept" : `${kept} done steps kept`}`;
}

// The sections resolved in a camp, newest first, each { id, title, on,
// steps } with its finished steps in the order they sat, each sub-step
// after its step with its `depth`.
export function resolvedGroups(rows) {
  const by = new Map();
  for (const r of rows ?? []) {
    const g = by.get(r.section_id) ?? { id: r.section_id, title: r.section_title, on: r.resolved_on, at: r.resolved_at ?? "", clipboard: r.counted === false, rows: [] };
    g.rows.push(r);
    if (r.resolved_on > g.on) g.on = r.resolved_on;
    by.set(r.section_id, g);
  }
  const order = (a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.done_on).localeCompare(String(b.done_on)) || String(a.id).localeCompare(String(b.id));
  const list = [...by.values()].map(({ rows: mine, ...g }) => {
    const here = new Set(mine.map((r) => r.id));
    const kids = new Map();
    for (const r of mine) {
      const up = r.parent_id && here.has(r.parent_id) ? r.parent_id : null;
      if (!kids.has(up)) kids.set(up, []);
      kids.get(up).push(r);
    }
    const steps = [];
    const seen = new Set();
    const walk = (up, depth) => {
      for (const r of (kids.get(up) ?? []).sort(order)) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        steps.push({ ...r, depth });
        walk(r.id, depth + 1);
      }
    };
    walk(null, 0);
    return { ...g, steps };
  });
  return list.sort((a, b) => String(b.on).localeCompare(String(a.on)) || String(b.at).localeCompare(String(a.at)));
}

// Steps done and in all, by camp, for the camp list on the Range. The
// clipboard's thoughts (in `sections` marked clipboard, 0095) don't count,
// as on the camp's own page.
export function campProgress(steps, sections = null) {
  const clip = new Set((sections ?? []).filter((x) => x.clipboard).map((x) => x.id));
  const by = new Map();
  for (const st of steps ?? []) {
    if (isNote(st) || (st.section_id && clip.has(st.section_id))) continue;
    const p = by.get(st.camp_id) ?? { done: 0, total: 0 };
    p.total += 1;
    if (st.done_on) p.done += 1;
    by.set(st.camp_id, p);
  }
  return by;
}

// "12 of 49 steps"
export function stepsLine({ done, total }) {
  if (!total) return "No steps yet";
  if (done === total) return total === 1 ? "Its one step is done" : `All ${total} steps done`;
  return `${done} of ${total} step${total === 1 ? "" : "s"}`;
}

// Typing or pasting into "Add a step": one step per line, with any bullet,
// number or checkbox the lines came with taken off.
export function splitSteps(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map(stripMarker)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.slice(0, 1000));
}

const MARKER = /^\s*(?:[-*•▪◦·]|\d{1,3}[.)]|[a-z][.)]|\[[ xX✓]?\]|☐|☑|✓)\s+/;

function stripMarker(line) {
  let t = String(line ?? "");
  // "- [ ] Write it" has two.
  for (let i = 0; i < 2 && MARKER.test(t); i++) t = t.replace(MARKER, "");
  return t;
}

// --- Reading a plan without the reader -----------------------------------------

// A plan as outline text (see outlineFromDocument, or a Markdown file as is)
// to { title, summary, sections, notes }. A heading with list items under it
// is a section, its list items are steps, a line before them is its why and
// lines after them are its note. Anything else (a heading with no list,
// tables) is kept in the notes.
export function planFromOutline(text, fallbackTitle = "") {
  const lines = String(text ?? "").split(/\r?\n/);
  let title = "";
  const intro = [];
  const blocks = []; // { level, title, why, steps, after }
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const name = cleanHeading(h[2]);
      if (!title && level === 1) {
        title = name;
        continue;
      }
      cur = { level, title: name, why: "", steps: [], after: [] };
      blocks.push(cur);
      continue;
    }
    const isStep = MARKER.test(line) && !/^\|/.test(line);
    if (!cur) {
      if (isStep) {
        cur = { level: 2, title: title || fallbackTitle || "Steps", why: "", steps: [], after: [] };
        blocks.push(cur);
      } else {
        intro.push(line);
        continue;
      }
    }
    if (isStep) {
      const t = stripMarker(line).trim();
      if (t) cur.steps.push({ text: t.slice(0, 1000), note: "" });
    } else if (!cur.steps.length && !cur.why && !/^\|/.test(line) && !/^\d{1,3}$/.test(line)) {
      cur.why = line;
    } else if (!/^\d{1,3}$/.test(line)) {
      cur.after.push(line);
    }
  }

  const sections = [];
  const notes = [];
  blocks.forEach((b, i) => {
    if (b.steps.length) {
      sections.push({
        title: b.title.slice(0, 200),
        why: b.why.slice(0, 1000),
        note: b.after.join("\n").slice(0, 4000),
        steps: b.steps,
      });
    } else {
      // A bare heading is kept only over the notes that sit under it, not
      // over sections ("The workflow" above its phases).
      const below = blocks[i + 1];
      if (!b.why && !b.after.length && !(below && below.level > b.level && !below.steps.length)) return;
      notes.push(`${"#".repeat(Math.min(6, Math.max(2, b.level)))} ${b.title}`);
      if (b.why) notes.push(b.why);
      notes.push(...b.after);
    }
  });
  return {
    title: (title || fallbackTitle || "A plan").slice(0, 200),
    summary: intro.filter((l) => !/^\|/.test(l)).slice(0, 3).join(" ").slice(0, 2000),
    sections,
    notes: tidyNotes(notes).slice(0, 20000),
  };
}

// "3. Mock it up" reads "Mock it up": the app numbers sections itself.
function cleanHeading(t) {
  return String(t ?? "")
    .replace(/^(?:step|phase|stage|part)?\s*\d{1,3}\s*[.):\-–—]\s*/i, "")
    .replace(/\*\*/g, "")
    .trim();
}

// Blank lines between headings and what's under them, and none piled up.
function tidyNotes(lines) {
  const out = [];
  for (const l of lines) {
    if (/^#{1,6}\s/.test(l) && out.length) out.push("");
    out.push(l);
  }
  return out.join("\n").trim();
}

// File names are often the plan's name: "new-feature_playbook.html" reads
// "New feature playbook".
export function titleFromFilename(name) {
  const base = String(name ?? "").replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[-_]+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "";
}

// What kind of file it is, by its name and type: html, md (Markdown or
// plain text), pdf, or null for one the reader can't take.
export function planFileKind(name, type) {
  const n = String(name ?? "").toLowerCase();
  const t = String(type ?? "").toLowerCase();
  if (/\.pdf$/.test(n) || t === "application/pdf") return "pdf";
  if (/\.html?$/.test(n) || t === "text/html") return "html";
  if (/\.(md|markdown|txt|text)$/.test(n) || t.startsWith("text/")) return "md";
  return null;
}

// --- A plan into camps ---------------------------------------------------------

// The rows that put a plan's sections and steps into one camp, after what
// it already holds: sections from `startAt` on, each step tagged with its
// section's index in `sections` so the caller can link them once the
// sections have ids.
export function planRows(plan, campId, startAt = 0) {
  const sections = [];
  const steps = [];
  (plan?.sections ?? []).forEach((s, i) => {
    sections.push({
      camp_id: campId,
      title: String(s.title ?? "").trim().slice(0, 200) || `Part ${i + 1}`,
      why: nonEmpty(s.why, 1000),
      note: nonEmpty(s.note, 4000),
      position: startAt + i,
    });
    (s.steps ?? []).forEach((st, j) => {
      const text = String(st?.text ?? "").trim().slice(0, 1000);
      if (text) steps.push({ camp_id: campId, section: sections.length - 1, text, note: nonEmpty(st?.note, 4000), position: j });
    });
  });
  return { sections, steps };
}

function nonEmpty(v, max) {
  const t = String(v ?? "").trim().slice(0, max);
  return t || null;
}

// How many steps a plan has in all.
export function planStepCount(plan) {
  return (plan?.sections ?? []).reduce((n, s) => n + (s.steps?.length ?? 0), 0);
}

// --- Pages into outline text ---------------------------------------------------

const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "HEAD", "TITLE", "META", "LINK", "IFRAME", "CANVAS"]);
const BLOCK = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "BODY", "DD", "DETAILS", "DIV", "DL", "DT", "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER",
  "FORM", "HEADER", "HR", "MAIN", "NAV", "OL", "P", "PRE", "SECTION", "SUMMARY", "TABLE", "TBODY", "THEAD", "TFOOT", "UL", "HTML",
]);

// A page (a Document from DOMParser) as outline text for the reader:
// headings as #, list items as -, table rows as | a | b |, a bold lead-in
// as **it**, and every other block on its own line. Scripts, styles,
// buttons and form fields are left out. The page's <title> is the first
// line when it has no <h1>.
export function outlineFromDocument(doc) {
  const out = [];
  let line = "";
  const flush = () => {
    const t = line.replace(/\s+/g, " ").trim();
    if (t) out.push(t);
    line = "";
  };
  const textOf = (el) => {
    let s = "";
    const walk = (n) => {
      if (n.nodeType === 3) s += n.nodeValue;
      else if (n.nodeType === 1 && !SKIP.has(n.tagName.toUpperCase())) {
        const tag = n.tagName.toUpperCase();
        if (tag === "UL" || tag === "OL") return;
        if (tag === "BR") s += " ";
        n.childNodes.forEach(walk);
        if (BLOCK.has(tag) || tag === "LI") s += " ";
      }
    };
    el.childNodes.forEach(walk);
    return s.replace(/\s+/g, " ").trim();
  };
  const visit = (node) => {
    if (node.nodeType === 3) {
      line += node.nodeValue;
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toUpperCase();
    if (SKIP.has(tag)) return;
    const h = /^H([1-6])$/.exec(tag);
    if (h) {
      flush();
      const t = textOf(node);
      if (t) out.push(`${"#".repeat(Number(h[1]))} ${t}`);
      return;
    }
    if (tag === "LI") {
      flush();
      const t = textOf(node);
      if (t) out.push(`- ${t}`);
      node.querySelectorAll(":scope > ul > li, :scope > ol > li").forEach((li) => {
        const sub = textOf(li);
        if (sub) out.push(`  - ${sub}`);
      });
      return;
    }
    if (tag === "TR") {
      flush();
      const cells = [...node.children].filter((c) => /^T[DH]$/i.test(c.tagName)).map(textOf);
      if (cells.some(Boolean)) out.push(`| ${cells.join(" | ")} |`);
      return;
    }
    if (tag === "BR") {
      flush();
      return;
    }
    if ((tag === "B" || tag === "STRONG") && !line.trim()) {
      const t = textOf(node);
      if (t) line += `**${t}** `;
      return;
    }
    const block = BLOCK.has(tag);
    if (block) flush();
    node.childNodes.forEach(visit);
    if (block) flush();
  };
  if (!doc.querySelector("h1")) {
    const title = doc.querySelector("title")?.textContent?.trim();
    if (title) out.push(`# ${title}`);
  }
  visit(doc.body ?? doc.documentElement);
  flush();
  return out.join("\n");
}

// --- A plan's notes, for reading -------------------------------------------------

// The notes kept with a plan (plain Markdown) as blocks to draw: headings,
// paragraphs, lists and tables. Nothing here becomes live HTML.
export function noteBlocks(md) {
  const blocks = [];
  let para = [];
  let list = null;
  let table = null;
  const endPara = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  const endList = () => {
    if (list) blocks.push({ kind: "ul", items: list });
    list = null;
  };
  const endTable = () => {
    if (table) blocks.push({ kind: "table", head: table[0] ?? [], rows: table.slice(1) });
    table = null;
  };
  const endAll = () => {
    endPara();
    endList();
    endTable();
  };
  for (const raw of String(md ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      endAll();
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      endAll();
      blocks.push({ kind: "h", level: h[1].length, text: h[2].trim() });
      continue;
    }
    if (/^\|.*\|$/.test(line)) {
      endPara();
      endList();
      const cells = line.slice(1, -1).split("|").map((c) => c.trim());
      // The |---|---| line under a table's head.
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      table = table ?? [];
      table.push(cells);
      continue;
    }
    const li = /^(?:[-*•]|\d{1,3}[.)])\s+(.*)$/.exec(line);
    if (li) {
      endPara();
      endTable();
      list = list ?? [];
      list.push(li[1]);
      continue;
    }
    endList();
    endTable();
    para.push(line);
  }
  endAll();
  return blocks;
}

// "**Who to check in with** Tanner if…" as runs of plain and bold text.
export function boldRuns(text) {
  const parts = String(text ?? "").split(/\*\*/);
  // An unmatched ** is just two asterisks.
  if (parts.length % 2 === 0) return [{ bold: false, text: String(text ?? "") }];
  return parts.map((t, i) => ({ bold: i % 2 === 1, text: t })).filter((r) => r.text);
}

// --- Where a plan can go ---------------------------------------------------------

// The mountains a plan can fill, from fetchMountains: each quest you're on
// and each lesson you're learning, with its camps in order. A lesson with
// no mountain yet is listed too (no questId), since a plan can make one.
export function mountainsOf({ quests = [], camps = [], lessons = [] } = {}) {
  const lessonById = new Map(lessons.map((l) => [l.id, l]));
  const campsBy = new Map();
  for (const c of [...camps].sort(BYPOS)) {
    if (!campsBy.has(c.quest_id)) campsBy.set(c.quest_id, []);
    campsBy.get(c.quest_id).push(c);
  }
  const climbing = new Set(quests.filter((q) => q.lesson_id).map((q) => q.lesson_id));
  const out = [...quests]
    .sort(BYPOS)
    .filter((q) => q.status === "on" && (!q.lesson_id || lessonById.get(q.lesson_id)?.status === "learning"))
    .map((q) => ({
      key: q.id,
      questId: q.id,
      lessonId: q.lesson_id ?? null,
      kind: q.lesson_id ? "Lesson" : "Quest",
      title: q.lesson_id ? lessonById.get(q.lesson_id).title : q.title,
      camps: campsBy.get(q.id) ?? [],
    }));
  // Quests first, then lessons.
  out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "Quest" ? -1 : 1));
  for (const l of [...lessons].sort(BYPOS)) {
    if (l.status !== "learning" || climbing.has(l.id)) continue;
    out.push({ key: `lesson-${l.id}`, questId: null, lessonId: l.id, lesson: l, kind: "Lesson", title: l.title, camps: [] });
  }
  return out;
}
