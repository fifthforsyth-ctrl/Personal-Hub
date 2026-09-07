import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Highlighter, StickyNote, X, ChevronRight, ChevronDown, AlertCircle, Trash2, MousePointerClick } from "lucide-react";
import { resolveHighlights, findInSource, selectionInfo } from "../../lib/noteText";
import { MarkdownNote, annotateHighlights } from "../../lib/markdown";
import { NOTE_KINDS, kindOf } from "../../lib/noteKinds";
import { KindChip } from "./KindChip";

// Reading a note, with the passage-to-card gesture on top of it.
//
// The note renders as Obsidian markdown — callouts, wikilinks, ==highlights==,
// lists — because that is how it was written and reading it as raw asterisks
// is reading it wrong.
//
// Selecting text is the whole interaction, so it says so: a standing hint sits
// under the note until you have made your first card from it, and the bar
// appears over whatever you select. The bar can no longer silently refuse a
// selection that crosses a paragraph, which is what made this feel broken.
export default function NoteReader({
  note,
  highlights,
  childrenByHighlight,
  onHighlight,
  onCreateSubNote,
  onDeleteHighlight,
  onOpenNote,
}) {
  const bodyRef = useRef(null);
  const [selection, setSelection] = useState(null);
  const [barPos, setBarPos] = useState(null);
  const [kindMenu, setKindMenu] = useState(false);
  const [missed, setMissed] = useState(false);
  const [collapsed, setCollapsed] = useState(() => new Set());

  const resolved = useMemo(() => resolveHighlights(note.body, highlights), [note.body, highlights]);
  const orphaned = resolved.filter((h) => h.orphaned);
  const anchored = resolved.filter((h) => !h.orphaned);

  // Highlights are injected into the source as sentinels and marked by the
  // markdown renderer, so they survive being rendered rather than needing the
  // DOM to be walked for offsets.
  const annotated = useMemo(() => annotateHighlights(note.body, anchored), [note.body, anchored]);

  const marks = useMemo(() => {
    const map = new Map();
    for (const h of anchored) {
      const child = h.child_note_id ? childrenByHighlight.get(h.child_note_id) : null;
      const kind = child ? kindOf(child.note_kind) : { color: "var(--accent)" };
      map.set(h.id, {
        color: kind.color,
        title: child ? `Kept as: ${child.title}` : "Highlighted",
        onClick: child ? () => toggle(child.id) : undefined,
      });
    }
    return map;
  }, [anchored, childrenByHighlight]);

  const subNotes = useMemo(
    () =>
      anchored
        .filter((h) => h.child_note_id && childrenByHighlight.get(h.child_note_id))
        .map((h) => ({ highlight: h, child: childrenByHighlight.get(h.child_note_id) })),
    [anchored, childrenByHighlight]
  );

  // Read on release rather than on every selectionchange: mid-drag the range is
  // still growing, and a bar that jumps around while you drag is unusable.
  useEffect(() => {
    function capture() {
      const info = selectionInfo(bodyRef.current);
      if (!info) {
        setSelection(null);
        setBarPos(null);
        setKindMenu(false);
        return;
      }

      const found = findInSource(note.body, info.text);
      if (!found) {
        // Say so rather than doing nothing. A selection that isn't in the
        // source is usually a callout label or an embed placeholder.
        setSelection(null);
        setBarPos(null);
        setMissed(true);
        return;
      }

      setMissed(false);
      setSelection({ text: info.text.trim(), start: found.start, end: found.end });

      const box = bodyRef.current.getBoundingClientRect();
      setBarPos({
        left: info.rect.left - box.left + info.rect.width / 2,
        // Never above the note: on the first line there is no room over the
        // selection, so the bar drops underneath it instead.
        top: info.rect.top - box.top,
        below: info.rect.top - box.top < 52,
      });
    }

    document.addEventListener("mouseup", capture);
    document.addEventListener("touchend", capture);
    return () => {
      document.removeEventListener("mouseup", capture);
      document.removeEventListener("touchend", capture);
    };
  }, [note.body]);

  useLayoutEffect(() => {
    setSelection(null);
    setBarPos(null);
    setMissed(false);
  }, [note.id]);

  function clearSelection() {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    setBarPos(null);
    setKindMenu(false);
  }

  function toggle(id) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    document.getElementById(`subnote-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  if (!note.body?.trim()) {
    return <p className="empty">This note is empty. Press Edit and start writing — you can highlight it once there's something here.</p>;
  }

  return (
    <div style={{ position: "relative" }}>
      <div ref={bodyRef} style={{ userSelect: "text" }}>
        <MarkdownNote text={annotated} marks={marks} />
      </div>

      {/* The standing invitation. It goes away once the note has cards of its
          own, because by then you know. */}
      {subNotes.length === 0 && (
        <div
          className="row"
          style={{ gap: 8, marginTop: 14, padding: "9px 12px", background: "var(--inset)", borderRadius: "var(--r)", border: "1px dashed var(--line-strong)" }}
        >
          <MousePointerClick size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <span className="muted" style={{ fontSize: 12.5 }}>
            Select any line above — drag across it, or double-click a word — and you'll get the option to highlight it
            or turn it into a note of its own.
          </span>
        </div>
      )}

      {missed && (
        <div className="row" style={{ gap: 8, marginTop: 12, padding: "9px 12px", background: "var(--danger-soft)", borderRadius: "var(--r)" }}>
          <AlertCircle size={14} style={{ color: "var(--danger-text)", flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: "var(--danger-text)" }}>
            That selection isn't part of the note's own text — a callout label or an embed, most likely. Try selecting
            the words themselves.
          </span>
        </div>
      )}

      {selection && barPos && (
        <div
          style={{
            position: "absolute",
            left: Math.max(100, barPos.left),
            top: barPos.below ? barPos.top + 30 : barPos.top - 46,
            transform: "translateX(-50%)",
            display: "flex",
            gap: 4,
            background: "var(--surface)",
            border: "1px solid var(--line-strong)",
            borderRadius: "var(--r)",
            padding: 4,
            boxShadow: "var(--shadow-lift)",
            zIndex: 30,
            whiteSpace: "nowrap",
          }}
        >
          <button
            className="btn btn--ghost"
            style={{ padding: "6px 10px", fontSize: 12.5 }}
            onClick={() => {
              onHighlight(selection);
              clearSelection();
            }}
          >
            <Highlighter size={13} />
            Highlight
          </button>

          <span style={{ display: "flex" }}>
            <button
              className="btn btn--accent"
              style={{ padding: "6px 9px", fontSize: 12.5, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
              onClick={() => {
                onCreateSubNote(selection, "thought");
                clearSelection();
              }}
            >
              <StickyNote size={13} />
              Make a note
            </button>
            <button
              className="btn btn--accent"
              style={{ padding: "6px 6px", borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: "1px solid rgba(0,0,0,0.22)" }}
              onClick={() => setKindMenu((v) => !v)}
              title="Keep it as a particular kind of note"
            >
              <ChevronDown size={13} />
            </button>
          </span>

          <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={clearSelection} title="Cancel">
            <X size={14} />
          </button>

          {kindMenu && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 5px)",
                right: 0,
                width: 236,
                background: "var(--surface)",
                border: "1px solid var(--line-strong)",
                borderRadius: "var(--r)",
                padding: 5,
                boxShadow: "var(--shadow-lift)",
              }}
            >
              {NOTE_KINDS.map((k) => (
                <button
                  key={k.key}
                  onClick={() => {
                    onCreateSubNote(selection, k.key);
                    clearSelection();
                  }}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: "var(--r-sm)", padding: "7px 9px", color: "inherit" }}
                >
                  <span className="row" style={{ gap: 7 }}>
                    <span className="dot" style={{ background: k.color }} />
                    <span style={{ fontSize: 12.5, fontWeight: 550 }}>{k.label}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {subNotes.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            What you kept from this — {subNotes.length}
          </div>
          {subNotes.map(({ highlight, child }) => (
            <InlineSubNote
              key={highlight.id}
              highlight={highlight}
              child={child}
              collapsed={collapsed.has(child.id)}
              onToggle={() => toggle(child.id)}
              onOpen={() => onOpenNote(child.id)}
              onUnlink={() => onDeleteHighlight(highlight.id)}
            />
          ))}
        </div>
      )}

      {orphaned.length > 0 && (
        <div className="card card--quiet" style={{ marginTop: 18 }}>
          <div className="card-head">
            <span className="card-title"><AlertCircle size={14} />Highlights that lost their place</span>
          </div>
          <p className="card-note" style={{ marginBottom: 12 }}>
            The text these marked isn't in this note any more — it was edited or deleted. The quotes and any notes made
            from them are kept here.
          </p>
          {orphaned.map((h) => {
            const child = h.child_note_id ? childrenByHighlight.get(h.child_note_id) : null;
            return (
              <div key={h.id} style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                <blockquote className="prose prose--sm" style={{ margin: 0, paddingLeft: 12, borderLeft: "2px solid var(--line-strong)", color: "var(--text-2)" }}>
                  {h.quoted_text}
                </blockquote>
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  {child && <button className="btn-link" onClick={() => onOpenNote(child.id)}>Open “{child.title}”</button>}
                  <span className="spacer" />
                  <button className="btn-icon" onClick={() => onDeleteHighlight(h.id)} title="Forget this highlight">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// The child note, in full, with the passage it grew from at the top — a note
// that says "this is the whole point" is meaningless without the sentence it
// is answering.
function InlineSubNote({ highlight, child, collapsed, onToggle, onOpen, onUnlink }) {
  const kind = kindOf(child.note_kind);
  return (
    <div
      id={`subnote-${child.id}`}
      style={{
        margin: "0 0 10px 0",
        borderLeft: `2px solid ${kind.color}`,
        background: "var(--surface)",
        borderRadius: "0 var(--r) var(--r) 0",
        padding: "12px 14px",
      }}
    >
      <button
        onClick={onToggle}
        className="row"
        style={{ gap: 8, width: "100%", background: "none", border: "none", padding: 0, color: "inherit", textAlign: "left" }}
      >
        {collapsed ? <ChevronRight size={14} style={{ flexShrink: 0 }} /> : <ChevronDown size={14} style={{ flexShrink: 0 }} />}
        <StickyNote size={13} style={{ color: kind.color, flexShrink: 0 }} />
        <span className="truncate" style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{child.title}</span>
        <KindChip value={child.note_kind} size="sm" />
      </button>

      {!collapsed && (
        <>
          {highlight.quoted_text && (
            <blockquote
              className="prose prose--sm"
              style={{ margin: "10px 0 0", paddingLeft: 11, borderLeft: "2px solid var(--line-strong)", color: "var(--text-2)", fontStyle: "italic" }}
            >
              {highlight.quoted_text}
            </blockquote>
          )}

          {child.body?.trim() ? (
            <div className="prose prose--sm" style={{ marginTop: 11 }}>{child.body}</div>
          ) : (
            <p className="empty" style={{ marginTop: 11, fontSize: 12.5 }}>Nothing written here yet.</p>
          )}

          <div className="row" style={{ gap: 10, marginTop: 11 }}>
            <button className="btn-link" onClick={onOpen}>Open this note</button>
            <span className="spacer" />
            <button className="btn-icon" onClick={onUnlink} title="Detach from this passage (keeps the note)">
              <X size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
