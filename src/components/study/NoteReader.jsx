import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Highlighter, StickyNote, X, ChevronRight, ChevronDown, Info, MousePointerClick } from "lucide-react";
import { resolveHighlights, findInSource, selectionInfo } from "../../lib/noteText";
import { MarkdownNote, annotateHighlights, niceTitle, cardFace } from "../../lib/markdown";
import { KindChip, KindMenu } from "./KindChip";

// Reading a note, with the passage-to-note gesture on top of it.
//
// The note renders as Obsidian markdown — callouts, wikilinks, ==highlights==,
// lists — because that is how it was written and reading it as raw asterisks
// is reading it wrong. A first heading that only repeats the title is left
// out, since the page already shows the title.
//
// Selecting words is the whole interaction, so it says so: a hint sits under
// the note until it has notes of its own. With a mouse the bar appears over
// the selection, kept inside the note's edges. On a phone it sits above the
// tab bar instead, where the phone's own copy menu can't cover it, and it
// waits for the selection to settle rather than chasing the handles.
//
// The handlers resolve true when they've done their part; anything else keeps
// the bar up so the same words can be tried again.
export default function NoteReader({
  note,
  title,
  highlights,
  childrenById,
  touch = false,
  onHighlight,
  onCreateSubNote,
  onForget,
  onUnmark,
  onOpenNote,
}) {
  const rootRef = useRef(null);
  const textRef = useRef(null);
  const barRef = useRef(null);
  const holdRef = useRef(false);
  const [selection, setSelection] = useState(null); // { text, start, end } in the source
  const [anchor, setAnchor] = useState(null); // where it sits, in the reader's own coordinates
  const [barLeft, setBarLeft] = useState(null);
  const [kindMenu, setKindMenu] = useState(false);
  const [missed, setMissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const body = note.body ?? "";
  const resolved = useMemo(() => resolveHighlights(body, highlights), [body, highlights]);
  const orphaned = resolved.filter((h) => h.orphaned);
  const anchored = useMemo(() => resolved.filter((h) => !h.orphaned), [resolved]);

  // Highlights are injected into the source as sentinels and marked by the
  // markdown renderer, so they survive being rendered rather than needing the
  // DOM to be walked for offsets.
  const annotated = useMemo(() => annotateHighlights(body, anchored), [body, anchored]);

  const subNotes = useMemo(
    () =>
      anchored
        .filter((h) => h.child_note_id && childrenById.get(h.child_note_id))
        .map((h) => ({ highlight: h, child: childrenById.get(h.child_note_id) })),
    [anchored, childrenById]
  );

  // A long run of notes starts folded, so the note's own words stay in reach.
  const [collapsed, setCollapsed] = useState(() => new Set(subNotes.length > 3 ? subNotes.map((s) => s.child.id) : []));

  const marks = useMemo(() => {
    const map = new Map();
    for (const h of anchored) {
      const child = h.child_note_id ? childrenById.get(h.child_note_id) : null;
      map.set(h.id, {
        linked: Boolean(child),
        title: child ? `Made into a note: ${niceTitle(child)}` : "Highlighted",
        onClick: child ? () => reveal(child.id) : undefined,
      });
    }
    return map;
  }, [anchored, childrenById]);

  useEffect(() => {
    holdRef.current = kindMenu || busy;
  }, [kindMenu, busy]);

  useEffect(() => {
    setSelection(null);
    setAnchor(null);
    setMissed(false);
  }, [body]);

  useEffect(() => {
    let timer = null;

    function capture() {
      const info = selectionInfo(textRef.current);
      if (!info) {
        // The bar stays while it's working or its menu is open: on a phone,
        // tapping it can clear the selection it's about to use.
        if (holdRef.current) return;
        setSelection(null);
        setAnchor(null);
        setKindMenu(false);
        return;
      }

      const found = findInSource(body, info.text);
      if (!found) {
        // Say so rather than doing nothing. A selection that isn't in the
        // source is usually a callout label or an embedded file.
        setSelection(null);
        setAnchor(null);
        setMissed(true);
        return;
      }

      setMissed(false);
      setKindMenu(false);
      setSelection({ text: info.text.trim(), start: found.start, end: found.end });
      const box = rootRef.current.getBoundingClientRect();
      const top = info.rect.top - box.top;
      setAnchor({
        center: info.rect.left - box.left + info.rect.width / 2,
        top,
        bottom: info.rect.bottom - box.top,
        // Never above the note: on the first line there's no room over the
        // selection, so the bar drops underneath it instead.
        below: top < 56,
      });
      setBarLeft(null);
    }

    function onMouseUp(e) {
      if (barRef.current?.contains(e.target)) return;
      capture();
    }
    function onKeyUp(e) {
      if (e.key === "Escape") clear();
      else if (e.shiftKey) capture();
    }
    function onSelectionChange() {
      clearTimeout(timer);
      timer = setTimeout(capture, 400);
    }

    if (touch) {
      document.addEventListener("selectionchange", onSelectionChange);
    } else {
      document.addEventListener("mouseup", onMouseUp);
      document.addEventListener("keyup", onKeyUp);
    }
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, [body, touch]);

  // Centred over the words, but measured and kept inside the note, so it
  // never hangs off the left edge on a narrow window.
  useLayoutEffect(() => {
    if (!anchor || touch || !barRef.current || !rootRef.current) return;
    const width = barRef.current.offsetWidth;
    const max = Math.max(0, rootRef.current.clientWidth - width);
    setBarLeft(Math.min(max, Math.max(0, anchor.center - width / 2)));
  }, [anchor, touch]);

  // Tapping away closes the kind menu, which lets the bar go with it.
  useEffect(() => {
    if (!kindMenu) return;
    function away(e) {
      if (!barRef.current?.contains(e.target)) setKindMenu(false);
    }
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [kindMenu]);

  function clear() {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    setAnchor(null);
    setKindMenu(false);
  }

  async function act(fn) {
    if (busy || !selection) return;
    setBusy(true);
    holdRef.current = true;
    try {
      if (await fn(selection)) clear();
    } finally {
      setBusy(false);
    }
  }

  function reveal(id) {
    setCollapsed((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    requestAnimationFrame(() => document.getElementById(`subnote-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }

  function toggle(id) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (!body.trim()) return null;

  const docked = touch;
  const barStyle = docked
    ? undefined
    : {
        left: barLeft ?? 0,
        top: anchor ? (anchor.below ? anchor.bottom + 8 : anchor.top - 52) : 0,
        visibility: barLeft == null ? "hidden" : undefined,
      };

  return (
    <div ref={rootRef} className="board-reader">
      <div ref={textRef}>
        <MarkdownNote text={annotated} marks={marks} hideTitle={title} />
      </div>

      {subNotes.length === 0 && !missed && (
        <div className="board-hint">
          <MousePointerClick size={14} aria-hidden="true" />
          <span>
            {touch
              ? "Press and hold a word, drag the handles over the passage, then choose Highlight or Make a note at the bottom."
              : "Select a passage (drag across it, or double-click a word) to highlight it or make it a note of its own."}
          </span>
        </div>
      )}

      {missed && (
        <div className="board-hint" role="status">
          <Info size={14} aria-hidden="true" />
          <span>Those words are a label or an embedded file, not the note's own text. Select the words of the note itself.</span>
        </div>
      )}

      {selection && anchor && (
        <div
          ref={barRef}
          className={"board-toolbar" + (docked ? " is-docked" : "")}
          style={barStyle}
          role="toolbar"
          aria-label="Selected words"
          // With a mouse, pressing a button here must not clear the selection.
          onMouseDown={(e) => !touch && e.preventDefault()}
        >
          <button type="button" className="btn btn--ghost" onClick={() => act(onHighlight)} disabled={busy}>
            <Highlighter size={14} />
            Highlight
          </button>

          <span className="board-split">
            <button type="button" className="btn btn--accent" onClick={() => act((sel) => onCreateSubNote(sel, "thought"))} disabled={busy}>
              <StickyNote size={14} />
              {busy ? "Saving…" : "Make a note"}
            </button>
            <button
              type="button"
              className="btn btn--accent"
              onClick={() => setKindMenu((v) => !v)}
              disabled={busy}
              aria-haspopup="menu"
              aria-expanded={kindMenu}
              aria-label="Make a note of a particular kind"
              title="Make a note of a particular kind"
            >
              <ChevronDown size={14} />
            </button>
            {kindMenu && (
              <KindMenu
                align="right"
                up={docked}
                label="Make a note of this kind"
                onPick={(key) => {
                  setKindMenu(false);
                  act((sel) => onCreateSubNote(sel, key));
                }}
              />
            )}
          </span>

          <button type="button" className="btn-icon" onClick={clear} aria-label="Cancel" title="Cancel">
            <X size={16} />
          </button>
        </div>
      )}

      {subNotes.length > 0 && (
        <div className="board-subnotes">
          <div className="board-subnotes__label">Notes made from this · {subNotes.length}</div>
          {subNotes.map(({ highlight, child }) => (
            <InlineSubNote
              key={highlight.id}
              highlight={highlight}
              child={child}
              collapsed={collapsed.has(child.id)}
              onToggle={() => toggle(child.id)}
              onOpen={() => onOpenNote(child.id)}
              onUnmark={() => onUnmark(highlight)}
            />
          ))}
        </div>
      )}

      {orphaned.length > 0 && (
        <div className="card card--quiet board-orphans">
          <div className="card-head">
            <span className="card-title">
              <Info size={14} />
              Highlights that lost their place
            </span>
          </div>
          <p className="card-note" style={{ marginBottom: 6 }}>
            The words these marked aren't in the note any more. The quotes, and any notes made from them, are kept here.
          </p>
          {orphaned.map((h) => {
            const child = h.child_note_id ? childrenById.get(h.child_note_id) : null;
            return (
              <div key={h.id} className="board-highlight">
                <blockquote className="board-quote">{h.quoted_text}</blockquote>
                <div className="board-highlight__actions">
                  {child && (
                    <button type="button" className="btn-link" onClick={() => onOpenNote(child.id)}>
                      Open the note made from it
                    </button>
                  )}
                  <button type="button" className="btn-link" onClick={() => onForget(h)}>
                    Forget the highlight
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

// A note made from a passage, shown under the note it came from with the
// passage at the top — a note that says "this is the whole point" means
// nothing without the sentence it's answering.
function InlineSubNote({ highlight, child, collapsed, onToggle, onOpen, onUnmark }) {
  const text = cardFace(child, 600).text;
  return (
    <div id={`subnote-${child.id}`} className="board-subnote">
      <button type="button" className="board-subnote__head" onClick={onToggle} aria-expanded={!collapsed}>
        {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        <span className="board-subnote__title">{niceTitle(child)}</span>
        <KindChip value={child.note_kind} size="sm" />
      </button>

      {!collapsed && (
        <>
          {highlight.quoted_text && <blockquote className="board-quote">{highlight.quoted_text}</blockquote>}
          {text && text !== highlight.quoted_text && <div className="board-subnote__text">{text}</div>}
          <div className="board-subnote__actions">
            <button type="button" className="btn-link" onClick={onOpen}>
              Open
            </button>
            <button type="button" className="btn-link" onClick={onUnmark} title="The note is kept; only the mark in the text goes">
              Unmark the passage
            </button>
          </div>
        </>
      )}
    </div>
  );
}
