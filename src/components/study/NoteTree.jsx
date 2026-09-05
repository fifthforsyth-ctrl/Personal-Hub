import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, FileText, StickyNote, Search, Plus, Pin, BookOpen } from "lucide-react";
import { buildTree } from "../../lib/noteText";

// The directory. Sub-notes appear here as real entries, nested under whatever
// they were made from — the whole point of promoting a highlight is that the
// thought becomes a thing in its own right, not an annotation buried in a
// paragraph.
export default function NoteTree({ notes, selectedId, onSelect, onCreateTop, query, onQueryChange }) {
  const byParent = useMemo(() => buildTree(notes), [notes]);
  const [expanded, setExpanded] = useState(() => new Set());

  // Searching flattens: when you're looking for a phrase you want every note
  // that contains it, not a tree you have to open one level at a time.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return notes.filter(
      (n) =>
        n.title?.toLowerCase().includes(q) ||
        n.body?.toLowerCase().includes(q) ||
        n.excerpt?.toLowerCase().includes(q) ||
        n.source_ref?.toLowerCase().includes(q)
    );
  }, [notes, query]);

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const roots = byParent.get("__root__") ?? [];

  return (
    <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 150px)" }}>
      <div style={{ padding: 12, borderBottom: "1px solid var(--line)" }}>
        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <Search size={15} style={{ color: "var(--text-3)", flexShrink: 0 }} />
          <input
            className="input"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search every note…"
            style={{ border: "none", background: "none", padding: 0, fontSize: 13.5 }}
          />
        </div>
        <button className="btn btn--block" onClick={onCreateTop}>
          <Plus size={14} />
          New note
        </button>
      </div>

      <div style={{ overflowY: "auto", padding: 8, flex: 1 }}>
        {matches ? (
          matches.length === 0 ? (
            <p className="empty" style={{ padding: "14px 8px", fontSize: 12.5 }}>Nothing matches “{query}”.</p>
          ) : (
            matches.map((n) => (
              <Row key={n.id} note={n} depth={0} selected={n.id === selectedId} onSelect={onSelect} hasChildren={false} />
            ))
          )
        ) : roots.length === 0 ? (
          <div style={{ padding: "20px 10px", textAlign: "center" }}>
            <BookOpen size={22} style={{ color: "var(--text-3)", marginBottom: 8 }} />
            <p className="empty" style={{ fontSize: 12.5 }}>
              Nothing on the shelf yet. Make a note for what you're reading, then highlight your way through it.
            </p>
          </div>
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
    </div>
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
        hasChildren={children.length > 0}
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

function Row({ note, depth, selected, onSelect, hasChildren, isOpen, onToggle, childCount }) {
  const isSub = Boolean(note.excerpt);

  return (
    <div
      className="row"
      style={{
        gap: 2,
        paddingLeft: depth * 13,
        background: selected ? "var(--inset)" : "transparent",
        borderRadius: "var(--r-sm)",
      }}
    >
      <button
        onClick={onToggle}
        disabled={!hasChildren}
        className="btn-icon"
        style={{ width: 20, height: 26, flexShrink: 0, opacity: hasChildren ? 1 : 0 }}
        title={isOpen ? "Collapse" : "Expand"}
      >
        {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>

      <button
        onClick={() => onSelect(note.id)}
        className="row"
        style={{
          gap: 7,
          flex: 1,
          minWidth: 0,
          background: "none",
          border: "none",
          padding: "6px 6px 6px 0",
          color: "inherit",
          textAlign: "left",
        }}
      >
        {isSub ? (
          <StickyNote size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />
        ) : (
          <FileText size={12} style={{ color: "var(--text-3)", flexShrink: 0 }} />
        )}
        <span
          className="truncate"
          style={{ flex: 1, fontSize: 12.5, fontWeight: selected ? 620 : 500, color: selected ? "var(--text)" : "var(--text-2)" }}
        >
          {note.title}
        </span>
        {note.pinned && <Pin size={10} style={{ color: "var(--accent)", flexShrink: 0 }} />}
        {childCount > 0 && <span className="mono faint" style={{ fontSize: 10, flexShrink: 0 }}>{childCount}</span>}
      </button>
    </div>
  );
}
