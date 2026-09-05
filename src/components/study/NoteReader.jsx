import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Highlighter, StickyNote, X, ChevronRight, ChevronDown, AlertCircle, Trash2 } from "lucide-react";
import { resolveHighlights, splitParagraphs, segmentsFor, selectionRange } from "../../lib/noteText";
import { NOTE_KINDS, kindOf } from "../../lib/noteKinds";
import { KindChip } from "./KindChip";

// Reading a note, with the passage-to-sub-note gesture on top of it.
//
// Select a phrase and a small bar appears where the selection is. Highlight
// keeps the mark; "New note from this" also creates a child note anchored to
// that passage — which then renders in full right under the paragraph it came
// from, so the parent reads as one continuous thought rather than a page of
// footnote numbers.
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
  const [collapsed, setCollapsed] = useState(() => new Set());

  const resolved = useMemo(() => resolveHighlights(note.body, highlights), [note.body, highlights]);
  const paragraphs = useMemo(() => splitParagraphs(note.body), [note.body]);
  const orphaned = resolved.filter((h) => h.orphaned);

  // Selection is read on mouse/touch release rather than on selectionchange:
  // mid-drag the range is still growing, and a toolbar that jumps around while
  // you're dragging is unusable.
  useEffect(() => {
    function capture() {
      const range = selectionRange(bodyRef.current);
      setSelection(range);
      if (range && bodyRef.current) {
        const box = bodyRef.current.getBoundingClientRect();
        setBarPos({ left: range.rect.left - box.left + range.rect.width / 2, top: range.rect.top - box.top });
      } else {
        setBarPos(null);
      }
    }
    document.addEventListener("mouseup", capture);
    document.addEventListener("touchend", capture);
    return () => {
      document.removeEventListener("mouseup", capture);
      document.removeEventListener("touchend", capture);
    };
  }, []);

  // A new note means a new body; anything selected in the old one is gone.
  useLayoutEffect(() => {
    setSelection(null);
    setBarPos(null);
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
  }

  if (!note.body?.trim()) {
    return <p className="empty">This note is empty. Press Edit and start writing — you can highlight it once there's something here.</p>;
  }

  return (
    <div style={{ position: "relative" }}>
      <div ref={bodyRef}>
        {paragraphs.map((para) => {
          const segments = segmentsFor(para, resolved);
          // Sub-notes belonging to highlights that live in this paragraph get
          // rendered directly beneath it.
          const inline = resolved
            .filter((h) => !h.orphaned && h.start >= para.start && h.start < para.end && h.child_note_id)
            .map((h) => ({ highlight: h, child: childrenByHighlight.get(h.child_note_id) }))
            .filter((x) => x.child);

          return (
            <div key={para.start}>
              <p data-start={para.start} className="prose" style={{ margin: "0 0 15px", whiteSpace: "pre-wrap" }}>
                {segments.map((seg, i) =>
                  seg.highlight ? (
                    <mark
                      key={i}
                      onClick={() => seg.highlight.child_note_id && toggle(seg.highlight.child_note_id)}
                      title={seg.highlight.child_note_id ? "Jump to the note from this passage" : "Highlight"}
                      style={{
                        background: seg.highlight.child_note_id ? "var(--accent-soft)" : "rgba(239, 91, 63, 0.09)",
                        color: "inherit",
                        borderBottom: `2px solid ${seg.highlight.child_note_id ? "var(--accent)" : "var(--accent-line)"}`,
                        borderRadius: 2,
                        padding: "1px 0",
                        cursor: seg.highlight.child_note_id ? "pointer" : "text",
                      }}
                    >
                      {seg.text}
                    </mark>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  )
                )}
              </p>

              {inline.map(({ highlight, child }) => (
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
          );
        })}
      </div>

      {/* The selection bar. Positioned over the passage rather than docked to
          the top of the page, so your eye doesn't have to leave the sentence. */}
      {selection && barPos && (
        <div
          style={{
            position: "absolute",
            left: Math.max(90, barPos.left),
            top: barPos.top - 46,
            transform: "translateX(-50%)",
            display: "flex",
            gap: 4,
            background: "var(--surface)",
            border: "1px solid var(--line-strong)",
            borderRadius: "var(--r)",
            padding: 4,
            boxShadow: "var(--shadow-lift)",
            zIndex: 20,
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
          {/* One press makes a note; the caret says what kind. Defaulting to
              Thought keeps the fast path fast — you can always retag later,
              but you can't recover a prompting you didn't write down. */}
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
              New note from this
            </button>
            <button
              className="btn btn--accent"
              style={{ padding: "6px 6px", borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: "1px solid rgba(0,0,0,0.22)" }}
              onClick={() => setKindMenu((v) => !v)}
              title="Record it as a particular kind of note"
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
                  {child && (
                    <button className="btn-link" onClick={() => onOpenNote(child.id)}>
                      Open “{child.title}”
                    </button>
                  )}
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

// The child note, shown in full inside its parent. The quote it grew from sits
// at the top, because a note that says "this is the whole point" is meaningless
// without the sentence it's answering.
function InlineSubNote({ highlight, child, collapsed, onToggle, onOpen, onUnlink }) {
  return (
    <div
      id={`subnote-${child.id}`}
      style={{
        margin: "0 0 18px 0",
        borderLeft: `2px solid ${kindOf(child.note_kind).color}`,
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
        <StickyNote size={13} style={{ color: kindOf(child.note_kind).color, flexShrink: 0 }} />
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
