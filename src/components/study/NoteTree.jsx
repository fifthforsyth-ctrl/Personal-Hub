import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ChevronDown, FileText, StickyNote, Plus, Pin } from "lucide-react";
import { buildTree } from "../../lib/noteText";
import { niceTitle } from "../../lib/markdown";

// Every note, as the directory it is. Sub-notes appear as real entries,
// nested under whatever they were made from — the whole point of promoting a
// highlight is that the thought becomes a thing in its own right, not an
// annotation buried in a paragraph.
//
// Searching lives in the one box at the top of the Board, which reads every
// word of every note; this is for browsing.
export default function NoteTree({ notes, selectedId, onSelect, onCreateTop, creating = false }) {
  const byParent = useMemo(() => buildTree(notes), [notes]);
  const [expanded, setExpanded] = useState(() => new Set());

  // The open note's branch unfolds by itself, so the tree always shows where
  // you are.
  useEffect(() => {
    if (!selectedId) return;
    const byId = new Map(notes.map((n) => [n.id, n]));
    const path = [];
    let at = byId.get(selectedId)?.parent_note_id;
    while (at && !path.includes(at)) {
      path.push(at);
      at = byId.get(at)?.parent_note_id;
    }
    if (path.length === 0) return;
    setExpanded((prev) => (path.every((id) => prev.has(id)) ? prev : new Set([...prev, ...path])));
  }, [selectedId, notes]);

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const roots = byParent.get("__root__") ?? [];

  return (
    <nav className="card board-tree" aria-label="All notes">
      <div className="board-tree__head">
        <div className="card-head" style={{ marginBottom: 10 }}>
          <span className="card-title">All notes</span>
          <span className="mono muted" style={{ fontSize: 11 }}>{notes.length}</span>
        </div>
        <button type="button" className="btn btn--sm btn--block" onClick={onCreateTop} disabled={creating}>
          <Plus size={14} />
          {creating ? "Starting…" : "New long note"}
        </button>
      </div>

      <div className="board-tree__body">
        {roots.length === 0 ? (
          <p className="empty" style={{ padding: "14px 8px", fontSize: 12.5 }}>
            Nothing here yet. Start a long note for what you're reading, then highlight your way through it.
          </p>
        ) : (
          roots.map((n) => (
            <Branch
              key={n.id}
              note={n}
              depth={0}
              byParent={byParent}
              expanded={expanded}
              onToggle={toggle}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </nav>
  );
}

function Branch({ note, depth, byParent, expanded, onToggle, selectedId, onSelect }) {
  const children = byParent.get(note.id) ?? [];
  const isOpen = expanded.has(note.id);

  return (
    <>
      <Row
        note={note}
        depth={depth}
        selected={note.id === selectedId}
        onSelect={onSelect}
        isOpen={isOpen}
        onToggle={() => onToggle(note.id)}
        childCount={children.length}
      />
      {isOpen &&
        children.map((c) => (
          <Branch
            key={c.id}
            note={c}
            depth={depth + 1}
            byParent={byParent}
            expanded={expanded}
            onToggle={onToggle}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}

function Row({ note, depth, selected, onSelect, isOpen, onToggle, childCount }) {
  const isSub = Boolean(note.parent_note_id);
  const title = niceTitle(note);

  return (
    <div className={"board-tree__row" + (selected ? " is-on" : "")} style={{ paddingLeft: depth * 14 }}>
      {childCount > 0 ? (
        <button
          type="button"
          className="btn-icon board-tree__toggle"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-label={`${isOpen ? "Hide" : "Show"} the ${childCount} ${childCount === 1 ? "note" : "notes"} under “${title}”`}
          title={isOpen ? "Hide what's under it" : "Show what's under it"}
        >
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      ) : (
        <span className="board-tree__toggle" style={{ width: 28, flexShrink: 0 }} aria-hidden="true" />
      )}

      <button
        type="button"
        className="board-tree__open"
        onClick={() => onSelect(note.id)}
        aria-current={selected ? "page" : undefined}
      >
        {isSub ? <StickyNote size={13} aria-hidden="true" /> : <FileText size={13} aria-hidden="true" />}
        <span className="truncate" style={{ flex: 1, minWidth: 0 }}>{title}</span>
        {note.pinned && <Pin size={11} aria-label="Pinned" fill="currentColor" />}
        {childCount > 0 && <span className="mono" style={{ fontSize: 10.5, color: "var(--text-2)", flexShrink: 0 }}>{childCount}</span>}
      </button>
    </div>
  );
}
