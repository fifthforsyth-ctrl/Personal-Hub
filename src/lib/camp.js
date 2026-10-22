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
// first step still to do, reading top to bottom.
export function buildCamp(sections, steps) {
  const bySection = new Map();
  const loose = [];
  const known = new Set((sections ?? []).map((s) => s.id));
  for (const st of [...(steps ?? [])].sort(BYPOS)) {
    if (st.section_id && known.has(st.section_id)) {
      if (!bySection.has(st.section_id)) bySection.set(st.section_id, []);
      bySection.get(st.section_id).push(st);
    } else loose.push(st);
  }
  const list = [...(sections ?? [])].sort(BYPOS).map((s, i) => {
    const own = bySection.get(s.id) ?? [];
    const done = own.filter((st) => st.done_on).length;
    return { ...s, number: i + 1, steps: own, done, total: own.length, complete: own.length > 0 && done === own.length };
  });
  const ordered = [...loose, ...list.flatMap((s) => s.steps)];
  const done = ordered.filter((st) => st.done_on).length;
  return {
    sections: list,
    loose,
    done,
    total: ordered.length,
    next: ordered.find((st) => !st.done_on) ?? null,
  };
}

// Steps done and in all, by camp, for the camp list on the Range.
export function campProgress(steps) {
  const by = new Map();
  for (const st of steps ?? []) {
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
