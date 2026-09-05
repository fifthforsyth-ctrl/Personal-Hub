// Anchoring highlights into a body of text.
//
// A highlight is stored as a character range plus the text it covered. The
// range is the fast path and the text is the truth: edit a paragraph above a
// highlight and every offset below it shifts, but the words it marked are
// still the words it marked. So resolution goes offsets first, then a search
// for the quote, and only then gives up.
//
// Nothing is ever silently dropped. A highlight whose passage no longer
// exists in the body — you deleted or rewrote the sentence — comes back
// marked orphaned so the reader can show it rather than pretend it was never
// made. The sub-note hanging off it is still a real note either way.

export function resolveHighlights(body = "", highlights = []) {
  const text = body ?? "";

  return highlights
    .map((h) => {
      const quote = h.quoted_text ?? "";
      const start = h.start_offset ?? 0;
      const end = h.end_offset ?? 0;

      // Fast path: the stored range still covers exactly the stored quote.
      if (quote && text.slice(start, end) === quote) {
        return { ...h, start, end, orphaned: false };
      }

      if (quote) {
        // The passage moved. Prefer the occurrence nearest where it used to
        // be — a repeated phrase should re-anchor to its own instance, not to
        // the first one in the document.
        let best = -1;
        let bestDistance = Infinity;
        let from = 0;
        for (;;) {
          const at = text.indexOf(quote, from);
          if (at === -1) break;
          const distance = Math.abs(at - start);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = at;
          }
          from = at + 1;
        }
        if (best !== -1) return { ...h, start: best, end: best + quote.length, orphaned: false };
      }

      return { ...h, start, end, orphaned: true };
    })
    .sort((a, b) => a.start - b.start);
}

// Paragraphs, each carrying where it begins in the whole body — which is what
// lets a selection inside one be converted into a document-wide offset.
export function splitParagraphs(body = "") {
  const paragraphs = [];
  const parts = (body ?? "").split(/\n\n+/);
  let cursor = 0;

  for (const part of parts) {
    const start = (body ?? "").indexOf(part, cursor);
    const at = start === -1 ? cursor : start;
    paragraphs.push({ text: part, start: at, end: at + part.length });
    cursor = at + part.length;
  }

  return paragraphs.filter((p) => p.text.length > 0 || paragraphs.length === 1);
}

// One paragraph cut into runs of plain and highlighted text.
//
// Overlapping highlights are resolved by letting the earlier one win the
// contested characters rather than nesting them — two marks stacked on the
// same words render as mud, and the later highlight still keeps its own
// record and its own sub-note.
export function segmentsFor(paragraph, resolved) {
  const inRange = resolved.filter((h) => !h.orphaned && h.end > paragraph.start && h.start < paragraph.end);
  const segments = [];
  let cursor = paragraph.start;

  for (const h of inRange) {
    const from = Math.max(h.start, cursor);
    const to = Math.min(h.end, paragraph.end);
    if (to <= from) continue;

    if (from > cursor) {
      segments.push({ text: paragraph.text.slice(cursor - paragraph.start, from - paragraph.start), highlight: null });
    }
    segments.push({ text: paragraph.text.slice(from - paragraph.start, to - paragraph.start), highlight: h });
    cursor = to;
  }

  if (cursor < paragraph.end) {
    segments.push({ text: paragraph.text.slice(cursor - paragraph.start), highlight: null });
  }

  return segments.length > 0 ? segments : [{ text: paragraph.text, highlight: null }];
}

// How many characters into `root` a DOM position falls.
//
// Walking the text nodes is the only reliable way to do this: the paragraph is
// rendered as a run of spans (one per highlight segment), so the browser's own
// node offset is relative to whichever span the selection happens to land in,
// not to the paragraph.
export function offsetWithin(root, node, nodeOffset) {
  if (!root || !node) return 0;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  let current = walker.nextNode();

  while (current) {
    if (current === node) return total + nodeOffset;
    total += current.textContent.length;
    current = walker.nextNode();
  }

  // The selection ended on an element rather than inside a text node, which
  // happens when you drag past the end of a paragraph.
  return node.contains?.(root) ? 0 : total;
}

// Reads the live selection and returns where it sits in the whole body, or
// null when there's nothing usable selected.
export function selectionRange(containerEl) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!containerEl?.contains(range.commonAncestorContainer)) return null;

  const paraEl = findParagraph(range.startContainer, containerEl);
  const endParaEl = findParagraph(range.endContainer, containerEl);
  if (!paraEl || paraEl !== endParaEl) return null; // one paragraph at a time

  const base = Number(paraEl.dataset.start ?? 0);
  const start = base + offsetWithin(paraEl, range.startContainer, range.startOffset);
  const end = base + offsetWithin(paraEl, range.endContainer, range.endOffset);
  const text = selection.toString();

  if (end <= start || !text.trim()) return null;

  return { start, end, text, rect: range.getBoundingClientRect() };
}

function findParagraph(node, containerEl) {
  let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (el && el !== containerEl) {
    if (el.dataset?.start !== undefined) return el;
    el = el.parentElement;
  }
  return null;
}

// A tree from the flat list, sorted the way the directory shows it.
export function buildTree(notes) {
  const byParent = new Map();
  for (const n of notes) {
    const key = n.parent_note_id ?? "__root__";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(n);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at).localeCompare(String(b.created_at)));
  }
  return byParent;
}

export function descendantsOf(byParent, id, seen = new Set()) {
  if (seen.has(id)) return [];
  seen.add(id);
  const children = byParent.get(id) ?? [];
  return children.flatMap((c) => [c, ...descendantsOf(byParent, c.id, seen)]);
}
