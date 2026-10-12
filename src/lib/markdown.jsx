import { Fragment } from "react";

// Renderer for the Obsidian-flavored markdown in the vault.
//
// Hand-rolled rather than pulled from a library for two reasons: the syntax
// that matters most here isn't standard markdown ([[wikilinks]], ==highlights==,
// > [!callouts] — the three most common things in this vault), and the notes
// contain raw <mark style="..."> HTML that Obsidian wrote. Everything below
// produces React ELEMENTS, never an HTML string, so there is no
// dangerouslySetInnerHTML anywhere and no way for markup in a note to become
// live HTML in the app.
//
// Supported, in rough order of how often it appears in the vault:
//   [[wikilink]] / [[target|alias]]     ~771
//   > blockquotes and > [!callout]      ~1253 / 296
//   - and 1. lists                      ~750
//   ==highlight==                       ~624
//   **bold**, *italic*, `code`          ~583
//   # headings                          ~246
//   --- horizontal rules                ~188
//   <mark ...>text</mark>               ~112
//   ![[embed]]                          rare — shown as a quiet "picture" tag

// The vault's own annotation vocabulary, written as <span class="...">.
// These are not decoration — "law" and "blessing" are the working pair the
// whole vault is organized around, and "insight" marks the writer's own
// thought inside quoted scripture. The distinction survives in weight and
// slant rather than in five shades of orange, which made a note read as a
// paint chart and failed as small text.
const SPAN_STYLES = {
  insight: { color: "var(--text-2)", fontStyle: "italic" },
  law: { fontWeight: 650 },
  blessing: { color: "var(--good-text)", fontWeight: 650 },
  context: { color: "var(--text-2)" },
  doctrine: { fontWeight: 650 },
  translation: { fontFamily: "var(--font-mono)", fontSize: "0.9em", color: "var(--text-2)" },
  "original-language": { fontFamily: "var(--font-mono)", fontSize: "0.9em", color: "var(--text-2)" },
};

// Callouts are quiet grey boxes with their label; only the warning kinds keep
// a colour, because there the colour is the message.
const CALLOUT_ACCENT = {
  warning: "var(--danger)",
  danger: "var(--danger)",
  failure: "var(--danger)",
  bug: "var(--danger)",
};

const IMAGE_FILE = /\.(png|jpe?g|gif|webp|svg|heic|avif)$/i;

// ---------------------------------------------------------------------------
// Inline
// ---------------------------------------------------------------------------

// Private-use characters, so a note can never contain them by accident. A
// stored highlight is injected into the source as
// <START><id><SEP><text><END> before rendering, which lets the existing inline
// pass mark it without the renderer having to track source offsets through
// every block rule.
//
// The pattern is built FROM these constants rather than written out a second
// time — spelling the escape twice is exactly how the two ended up disagreeing,
// with the sentinel rendering as visible boxes because nothing matched it.
export const HL_START = String.fromCharCode(0xe000);
export const HL_SEP = String.fromCharCode(0xe001);
export const HL_END = String.fromCharCode(0xe002);

const HL_PATTERN = `${HL_START}([^${HL_SEP}]*)${HL_SEP}([\\s\\S]*?)${HL_END}`;

// Order matters: code first so its contents are never re-parsed, then the
// paired-delimiter forms, then links. Each alternative captures its own
// payload group, and the branch is chosen by whichever group matched.
const INLINE_RE = new RegExp(
  [
    "`([^`]+)`", // 1 code
    "!\\[\\[([^\\]]+)\\]\\]", // 2 embed
    "\\[\\[([^\\]]+)\\]\\]", // 3 wikilink
    "\\[([^\\]]+)\\]\\(([^)]+)\\)", // 4 text, 5 href
    "<mark[^>]*>([\\s\\S]*?)</mark>", // 6 html highlight
    "<span[^>]*?class=[\"']([^\"']*)[\"'][^>]*>([\\s\\S]*?)</span>", // 7 class, 8 body
    "==([\\s\\S]+?)==", // 9 highlight
    "\\*\\*([\\s\\S]+?)\\*\\*", // 10 bold
    "__([\\s\\S]+?)__", // 11 bold
    "\\*([^*\\n]+?)\\*", // 12 italic
    "_([^_\\n]+?)_", // 13 italic
    "~~([\\s\\S]+?)~~", // 14 strikethrough
    "</?[a-zA-Z][^>]*>", // 15 any other tag — unwrapped, never rendered as HTML
    HL_PATTERN, // 16 id, 17 body — a stored highlight
  ].join("|"),
  "g"
);

// Private-use characters, so a note can never contain them by accident. A
// stored highlight is injected into the source as
// \uE000<id>\uE001<text>\uE002 before rendering, which lets the existing
// inline pass mark it without the renderer having to track source offsets
// through every block rule.

// Wraps each resolved highlight in the sentinel form. Applied back-to-front so
// each insertion leaves the offsets of the ones before it untouched, and
// overlaps are dropped rather than nested — two marks over the same words
// render as mud.
export function annotateHighlights(body, resolved) {
  if (!body || !resolved?.length) return body ?? "";

  const usable = [...resolved]
    .filter((h) => !h.orphaned && h.end > h.start && h.end <= body.length)
    .sort((a, b) => a.start - b.start)
    .filter((h, i, all) => i === 0 || h.start >= all[i - 1].end);

  let out = body;
  for (let i = usable.length - 1; i >= 0; i--) {
    const h = usable[i];
    out =
      out.slice(0, h.start) +
      HL_START + h.id + HL_SEP + out.slice(h.start, h.end) + HL_END +
      out.slice(h.end);
  }
  return out;
}

function renderInline(text, keyPrefix = "i", marks = null) {
  if (!text) return null;
  const out = [];
  let last = 0;
  let n = 0;

  for (const m of text.matchAll(INLINE_RE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${n++}`;
    const [, code, embed, wiki, linkText, , htmlMark, spanClass, spanBody, highlight, bold1, bold2, ital1, ital2, strike] = m;
    // 15 and 16, not 16 and 17: alternative 15 (any other tag) captures
    // nothing, so it does not advance the group numbering.
    const hlId = m[15];
    const hlBody = m[16];

    if (hlId !== undefined) {
      const mark = marks?.get(hlId);
      out.push(
        <mark
          key={key}
          data-hl={hlId}
          onClick={mark?.onClick}
          title={mark?.title}
          style={{
            background: mark ? `${mark.color}26` : "var(--accent-soft)",
            color: "inherit",
            borderBottom: `2px solid ${mark ? mark.color : "var(--accent)"}`,
            borderRadius: 2,
            padding: "1px 0",
            cursor: mark?.onClick ? "pointer" : "text",
          }}
        >
          {renderInline(hlBody, key, marks)}
        </mark>
      );
    } else if (code !== undefined) {
      out.push(<code key={key} style={codeStyle}>{code}</code>);
    } else if (embed !== undefined) {
      // The file lives in the vault, not here, so say what was there rather
      // than printing the raw link syntax in the middle of the prose.
      const file = embed.split("|")[0].split("/").pop();
      out.push(
        <span key={key} className="md-embed" title={`In your vault: ${embed.split("|")[0]}`}>
          {IMAGE_FILE.test(file) ? "Picture" : "Embedded note"} · {file}
        </span>
      );
    } else if (wiki !== undefined) {
      // [[Target|alias]] — show the alias when there is one. Not a link:
      // the target is a note in the vault, which may not exist in the hub.
      const label = wiki.includes("|") ? wiki.split("|").slice(1).join("|") : wiki;
      out.push(
        <span key={key} style={wikiStyle} title={`Vault note: ${wiki.split("|")[0]}`}>
          {label}
        </span>
      );
    } else if (linkText !== undefined) {
      out.push(
        <a key={key} href={m[5]} target="_blank" rel="noopener noreferrer">
          {linkText}
        </a>
      );
    } else if (htmlMark !== undefined || highlight !== undefined) {
      out.push(
        <mark key={key} style={markStyle}>
          {renderInline(htmlMark ?? highlight, key, marks)}
        </mark>
      );
    } else if (spanBody !== undefined) {
      // Known annotation class gets its styling; anything else is simply
      // unwrapped. Either way the tag's own attributes are discarded — a
      // style= or onclick= written into a note never reaches the DOM.
      const style = SPAN_STYLES[(spanClass ?? "").trim().toLowerCase()];
      out.push(
        <span key={key} style={style} title={style ? spanClass : undefined}>
          {renderInline(spanBody, key, marks)}
        </span>
      );
    } else if (bold1 !== undefined || bold2 !== undefined) {
      out.push(<strong key={key}>{renderInline(bold1 ?? bold2, key, marks)}</strong>);
    } else if (ital1 !== undefined || ital2 !== undefined) {
      out.push(<em key={key}>{renderInline(ital1 ?? ital2, key, marks)}</em>);
    } else if (strike !== undefined) {
      out.push(<s key={key}>{renderInline(strike, key, marks)}</s>);
    }
    last = m.index + m[0].length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out.length === 1 ? out[0] : out;
}

// ---------------------------------------------------------------------------
// Block
// ---------------------------------------------------------------------------

// `hideTitle`: a vault note usually opens with "# <its own title>", which the
// page already shows as its heading, so that first heading is skipped when it
// says the same thing. Only the very first block, and only an exact repeat.
export function MarkdownNote({ text, marks = null, hideTitle = null }) {
  if (!text) return null;
  const lines = stripFrontmatter(text).split("\n");
  const blocks = [];
  let i = 0;
  let key = 0;

  if (hideTitle) {
    while (i < lines.length && !lines[i].trim()) i += 1;
    const first = lines[i]?.match(/^#{1,6}\s+(.*)$/);
    if (first && sameWords(first[1], hideTitle)) i += 1;
  }

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // --- horizontal rule
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<hr key={key++} style={hrStyle} />);
      i += 1;
      continue;
    }

    // ``` fenced code
    if (/^\s*```/.test(line)) {
      const body = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i += 1;
      blocks.push(
        <pre key={key++} style={preStyle}>
          {body.join("\n")}
        </pre>
      );
      continue;
    }

    // # heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(
        <div key={key++} style={headingStyle(level)}>
          {renderInline(heading[2], `h${key}`, marks)}
        </div>
      );
      i += 1;
      continue;
    }

    // > blockquote, possibly a [!callout]
    if (/^\s*>/.test(line)) {
      const quoted = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quoted.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push(<Callout key={key++} lines={quoted} marks={marks} />);
      continue;
    }

    // - / * / 1. list
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const items = [];
      const ordered = /^\s*\d+\.\s+/.test(line);
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        const indent = (lines[i].match(/^\s*/)?.[0].length ?? 0) > 1;
        items.push({ text: lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ""), indent });
        i += 1;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag key={key++} style={listStyle}>
          {items.map((item, n) => (
            <li key={n} style={{ marginLeft: item.indent ? 18 : 0, marginBottom: 3 }}>
              {renderInline(item.text, `l${key}-${n}`, marks)}
            </li>
          ))}
        </ListTag>
      );
      continue;
    }

    // paragraph — consume until a blank line or the start of another block
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*>/.test(lines[i]) &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
      !/^\s*```/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={key++} style={paraStyle}>
        {renderInline(para.join(" "), `p${key}`, marks)}
      </p>
    );
  }

  return <div style={{ fontSize: 14, lineHeight: 1.7 }}>{blocks}</div>;
}

function Callout({ lines, marks = null }) {
  const header = lines[0]?.match(/^\s*\[!([^\]]+)\]\s*(.*)$/);
  const type = header ? header[1].trim().toLowerCase() : null;
  const accent = (type && CALLOUT_ACCENT[type]) ?? null;
  const bodyLines = header ? lines.slice(1) : lines;
  const label = header ? (header[2].trim() || header[1].trim()) : null;

  return (
    <div
      style={{
        borderLeft: `3px solid ${accent ?? "var(--line-strong)"}`,
        background: "var(--inset)",
        borderRadius: "0 6px 6px 0",
        padding: "10px 14px",
        margin: "10px 0",
      }}
    >
      {label && (
        <div style={{ fontSize: 11, fontWeight: 700, color: accent ?? "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: bodyLines.some((l) => l.trim()) ? 6 : 0 }}>
          {label}
        </div>
      )}
      {bodyLines
        .join("\n")
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((p, n) => (
          <p key={n} style={{ margin: n === 0 ? 0 : "8px 0 0", color: "var(--text-muted)" }}>
            {renderInline(p.replace(/\n/g, " "), `c${n}`, marks)}
          </p>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plain text, for previews and excerpts
// ---------------------------------------------------------------------------

// Strips every bit of markup down to readable prose — used wherever a note
// appears as a one-or-two-line preview and the markup would be pure noise.
export function toPlainText(text, maxLength = null) {
  return plain(text, maxLength, false);
}

// For a card or a list row: the same, minus the lines that only label
// something — headings, and a callout's "[!quote] Alma 32:21" header — which
// otherwise run straight into the sentence after them ("Alma 32 — faith as a
// seed Alma 32:21 And now as I said…").
export function previewText(text, maxLength = null) {
  return plain(text, maxLength, true);
}

function plain(text, maxLength, dropLabels) {
  if (!text) return "";
  let out = stripFrontmatter(text);

  if (dropLabels) {
    out = out.replace(/^#{1,6}\s+.*$/gm, " ").replace(/^\s*>\s?\[![^\]]+\].*$/gm, " ");
  }

  out = out
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[\[([^\]]+)\]\]/g, " ")
    .replace(/\[\[([^\]]+)\]\]/g, (_, inner) => (inner.includes("|") ? inner.split("|").slice(1).join("|") : inner))
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/^\s*>\s?\[![^\]]+\]\s*/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/gm, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*([-*+]|\d+\.)\s+/gm, "")
    .replace(/==([\s\S]+?)==/g, "$1")
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/\*([^*\n]+?)\*/g, "$1")
    .replace(/~~([\s\S]+?)~~/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (maxLength && out.length > maxLength) {
    // Trim on a word boundary so a preview never ends mid-word.
    const cut = out.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(" ");
    out = (lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
  }
  return out;
}

function stripFrontmatter(text) {
  if (!text.startsWith("---")) return text;
  const end = text.indexOf("\n---", 3);
  return end === -1 ? text : text.slice(end + 4).replace(/^\n/, "");
}

// Cut at the last whole word that fits, with an ellipsis, never mid-word.
export function cutAtWord(text, max) {
  const s = String(text ?? "").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
  return base.replace(/[\s,;:.–—-]+$/, "") + "…";
}

const squash = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[*_=~`#>[\]|]/g, "")
    .replace(/…$/, "")
    .replace(/\s+/g, " ")
    .trim();

function sameWords(a, b) {
  const x = squash(a);
  return x.length > 0 && x === squash(b);
}

// Kept lines used to get a title cut at exactly 90 characters, mid-word and
// with no ellipsis ("…the experiment itself, and"). When the full sentence is
// right there in the note, the title is shown cut at a word instead.
export function niceTitle(note) {
  const title = String(note?.title ?? "").trim();
  const full = String(note?.essence || note?.excerpt || "").trim();
  if (title.length >= 80 && !title.endsWith("…") && full.length > title.length && full.startsWith(title)) {
    return cutAtWord(full, 90);
  }
  return title || "Untitled";
}

// A card's face: one text, cut at a word, and a title only when it says
// something the text doesn't. A captured thought takes its title from its
// first line and a kept line from its essence, so for most cards the title is
// the start of the text, and printing both showed every sentence twice.
export function cardFace(note, max = 180) {
  const title = niceTitle(note);
  const source = note?.essence || note?.excerpt || note?.body_preview || note?.body || "";
  const text = previewText(source, max);
  const t = squash(title);
  const x = squash(text);
  const repeats = !x || t.startsWith("untitled") || x.startsWith(t) || t.startsWith(x);
  if (!x) return { title: null, text: title };
  return { title: repeats ? null : title, text };
}

// ---------------------------------------------------------------------------

const paraStyle = { margin: "0 0 10px" };
const listStyle = { margin: "0 0 10px", paddingLeft: 20 };
const hrStyle = { border: "none", borderTop: "1px solid var(--border)", margin: "16px 0" };
// A vault reference, not a link (the note it names may not be in the hub), so
// it reads as text with a dotted underline rather than as an orange link.
const wikiStyle = { borderBottom: "1px dotted var(--text-3)", cursor: "help", overflowWrap: "anywhere" };
const markStyle = { background: "rgba(224, 165, 69, 0.22)", color: "var(--text)", padding: "0 2px", borderRadius: 2 };
const codeStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.88em",
  background: "var(--bg-inset)",
  padding: "1px 5px",
  borderRadius: 4,
};
const preStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  background: "var(--bg-inset)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 12,
  overflowX: "auto",
  margin: "0 0 10px",
};

function headingStyle(level) {
  const sizes = { 1: 19, 2: 17, 3: 15.5, 4: 14.5, 5: 14, 6: 13.5 };
  return {
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    fontSize: sizes[level] ?? 14,
    margin: level <= 2 ? "18px 0 8px" : "14px 0 6px",
    color: "var(--text)",
    paddingBottom: level === 1 ? 6 : 0,
    borderBottom: level === 1 ? "1px solid var(--border)" : "none",
  };
}
