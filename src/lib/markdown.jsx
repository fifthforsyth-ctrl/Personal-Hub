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
//   ![[embed]]                          rare — shown as a muted placeholder

// The vault's own annotation vocabulary, written as <span class="...">.
// These are not decoration — "law" and "blessing" are the working pair the
// whole vault is organized around, and "insight" marks the writer's own
// thought inside quoted scripture. Styled so the distinction survives the
// trip out of Obsidian, using the app's existing ramp rather than new hues.
const SPAN_STYLES = {
  insight: { color: "#d8933b", fontStyle: "italic" },
  law: { color: "#c0743b", fontWeight: 600 },
  blessing: { color: "var(--accent-strong)", fontWeight: 600 },
  context: { color: "var(--text-muted)" },
  doctrine: { color: "#a8553a", fontWeight: 600 },
  translation: { fontFamily: "var(--font-mono)", fontSize: "0.9em", color: "var(--text-muted)" },
  "original-language": { fontFamily: "var(--font-mono)", fontSize: "0.9em", color: "var(--text-muted)" },
};

const CALLOUT_ACCENT = {
  tip: "var(--accent-strong)",
  christ: "var(--accent-strong)",
  quote: "var(--text-muted)",
  abstract: "var(--text-muted)",
  info: "var(--text-muted)",
  note: "var(--text-muted)",
  faq: "var(--text-muted)",
  application: "var(--accent-strong)",
  success: "var(--accent-strong)",
  warning: "var(--danger)",
  danger: "var(--danger)",
  failure: "var(--danger)",
  bug: "var(--danger)",
};

// ---------------------------------------------------------------------------
// Inline
// ---------------------------------------------------------------------------

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
  ].join("|"),
  "g"
);

function renderInline(text, keyPrefix = "i") {
  if (!text) return null;
  const out = [];
  let last = 0;
  let n = 0;

  for (const m of text.matchAll(INLINE_RE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${n++}`;
    const [, code, embed, wiki, linkText, , htmlMark, spanClass, spanBody, highlight, bold1, bold2, ital1, ital2, strike] = m;

    if (code !== undefined) {
      out.push(<code key={key} style={codeStyle}>{code}</code>);
    } else if (embed !== undefined) {
      out.push(
        <span key={key} style={{ color: "var(--text-faint)", fontStyle: "italic" }}>
          [embedded: {embed.split("|")[0]}]
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
          {renderInline(htmlMark ?? highlight, key)}
        </mark>
      );
    } else if (spanBody !== undefined) {
      // Known annotation class gets its styling; anything else is simply
      // unwrapped. Either way the tag's own attributes are discarded — a
      // style= or onclick= written into a note never reaches the DOM.
      const style = SPAN_STYLES[(spanClass ?? "").trim().toLowerCase()];
      out.push(
        <span key={key} style={style} title={style ? spanClass : undefined}>
          {renderInline(spanBody, key)}
        </span>
      );
    } else if (bold1 !== undefined || bold2 !== undefined) {
      out.push(<strong key={key}>{renderInline(bold1 ?? bold2, key)}</strong>);
    } else if (ital1 !== undefined || ital2 !== undefined) {
      out.push(<em key={key}>{renderInline(ital1 ?? ital2, key)}</em>);
    } else if (strike !== undefined) {
      out.push(<s key={key}>{renderInline(strike, key)}</s>);
    }
    last = m.index + m[0].length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out.length === 1 ? out[0] : out;
}

// ---------------------------------------------------------------------------
// Block
// ---------------------------------------------------------------------------

export function MarkdownNote({ text }) {
  if (!text) return null;
  const lines = stripFrontmatter(text).split("\n");
  const blocks = [];
  let i = 0;
  let key = 0;

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
          {renderInline(heading[2], `h${key}`)}
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
      blocks.push(<Callout key={key++} lines={quoted} />);
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
              {renderInline(item.text, `l${key}-${n}`)}
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
        {renderInline(para.join(" "), `p${key}`)}
      </p>
    );
  }

  return <div style={{ fontSize: 14, lineHeight: 1.7 }}>{blocks}</div>;
}

function Callout({ lines }) {
  const header = lines[0]?.match(/^\s*\[!([^\]]+)\]\s*(.*)$/);
  const type = header ? header[1].trim().toLowerCase() : null;
  const accent = type ? CALLOUT_ACCENT[type] ?? "var(--text-muted)" : "var(--border-strong)";
  const bodyLines = header ? lines.slice(1) : lines;
  const label = header ? (header[2].trim() || header[1].trim()) : null;

  return (
    <div
      style={{
        borderLeft: `3px solid ${accent}`,
        background: "var(--bg-inset)",
        borderRadius: "0 6px 6px 0",
        padding: "10px 14px",
        margin: "10px 0",
      }}
    >
      {label && (
        <div style={{ fontSize: 11, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: bodyLines.some((l) => l.trim()) ? 6 : 0 }}>
          {label}
        </div>
      )}
      {bodyLines
        .join("\n")
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((p, n) => (
          <p key={n} style={{ margin: n === 0 ? 0 : "8px 0 0", color: "var(--text-muted)" }}>
            {renderInline(p.replace(/\n/g, " "), `c${n}`)}
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
  if (!text) return "";
  let out = stripFrontmatter(text);

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

// ---------------------------------------------------------------------------

const paraStyle = { margin: "0 0 10px" };
const listStyle = { margin: "0 0 10px", paddingLeft: 20 };
const hrStyle = { border: "none", borderTop: "1px solid var(--border)", margin: "16px 0" };
const wikiStyle = { color: "var(--accent-strong)", borderBottom: "1px dotted var(--accent-dim)", cursor: "help" };
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
