import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen,
  Pencil,
  Check,
  Trash2,
  Pin,
  PinOff,
  RotateCcw,
  ChevronLeft,
  Quote,
  Highlighter,
  StickyNote,
  Library,
  Layers,
  Plus,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchNotes,
  fetchNote,
  fetchHighlights,
  createNote,
  updateNote,
  deleteNote,
  createHighlight,
  deleteHighlight,
  createSubNoteFromHighlight,
  fetchNotesToResurface,
  markNoteSurfaced,
} from "../lib/api";
import NoteTree from "../components/study/NoteTree";
import NoteReader from "../components/study/NoteReader";
import CaptureBar from "../components/study/CaptureBar";
import QuoteWall from "../components/study/QuoteWall";
import SourceMiner from "../components/study/SourceMiner";
import { KindChip, KindFilter } from "../components/study/KindChip";
import { buildTree } from "../lib/noteText";
import { NOTE_KINDS, kindOf } from "../lib/noteKinds";
import useIsMobile from "../lib/useIsMobile";

// The student section — everyday reading, kept somewhere it can be found again.
//
// Two panes on a desktop: the shelf on the left, whatever you're reading on the
// right. On a phone it's one at a time, because a 375px column split two ways
// is two unusable columns.
export default function Study() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("note");

  const [notes, setNotes] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState(null);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [view, setView] = useState("stream");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const list = await fetchNotes(user.id);
      setNotes(list);
      if (list.length > 0) {
        setHighlights(await fetchHighlights(user.id, list.map((n) => n.id)));
      } else {
        setHighlights([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  // The shelf listing carries previews, not bodies. Opening a note fetches the
  // whole thing — which is the point of the split, since a body averages
  // eleven thousand characters and sixty-one of them is not a page load.
  const [openNote, setOpenNote] = useState(null);
  const listed = useMemo(() => notes.find((n) => n.id === selectedId) ?? null, [notes, selectedId]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedId) {
      setOpenNote(null);
      return;
    }
    fetchNote(selectedId)
      .then((n) => !cancelled && setOpenNote(n))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedId, notes]);

  // Show the listing immediately and swap in the full row when it lands, so
  // opening a note never blanks the page while the body is in flight.
  const note = openNote?.id === selectedId ? openNote : listed;
  const byParent = useMemo(() => buildTree(notes), [notes]);
  const noteHighlights = useMemo(() => highlights.filter((h) => h.note_id === selectedId), [highlights, selectedId]);
  const childrenByHighlight = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);

  function select(id) {
    setEditing(false);
    setParams(id ? { note: id } : {}, { replace: false });
  }

  async function guard(fn) {
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  const createTop = () =>
    guard(async () => {
      const created = await createNote(user.id, { title: "Untitled note", body: "" });
      select(created.id);
      setEditing(true);
    });

  // Straight from the capture bar. The first line becomes the title so the
  // shelf reads as sentences rather than a column of "Untitled".
  const capture = ({ text, kind }) =>
    guard(async () => {
      const firstLine = text.split("\n")[0].trim();
      await createNote(user.id, {
        title: firstLine.length <= 80 ? firstLine : firstLine.slice(0, 77).trimEnd() + "…",
        body: text,
        noteKind: kind,
      });
    });

  const handleHighlight = (sel) =>
    guard(() =>
      createHighlight(user.id, {
        noteId: note.id,
        quotedText: sel.text,
        startOffset: sel.start,
        endOffset: sel.end,
      })
    );

  const handleCreateSubNote = (sel, kind = "thought") =>
    guard(async () => {
      const siblings = byParent.get(note.id) ?? [];
      await createSubNoteFromHighlight(user.id, {
        noteId: note.id,
        quotedText: sel.text,
        startOffset: sel.start,
        endOffset: sel.end,
        // A first line that reads like a title is a title; anything longer
        // gets trimmed, and you can rename it the moment it exists.
        title: sel.text.length <= 70 ? sel.text : sel.text.slice(0, 67).trimEnd() + "…",
        sourceRef: note.source_ref,
        noteKind: kind,
        position: siblings.length,
      });
    });

  // Counts drive the filter row, and they count the whole shelf rather than
  // the current filter — a chip that says 0 because of another chip is a lie.
  const kindCounts = useMemo(() => {
    const m = new Map();
    for (const n of notes) m.set(n.note_kind ?? "thought", (m.get(n.note_kind ?? "thought") ?? 0) + 1);
    return m;
  }, [notes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (kindFilter && (n.note_kind ?? "thought") !== kindFilter) return false;
      if (!q) return true;
      return (
        n.title?.toLowerCase().includes(q) ||
        n.body_preview?.toLowerCase().includes(q) ||
        n.excerpt?.toLowerCase().includes(q)
      );
    });
  }, [notes, kindFilter, query]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Student</div>
          <h1 className="page-title" style={{ marginTop: 3 }}>Receive and record</h1>
          <p className="page-sub">
            What comes, what you make of it, and what you're reading. Highlight any passage to turn it into a note of its own.
          </p>
        </div>
        <button className="btn" onClick={() => setShelfOpen((v) => !v)}>
          <Library size={14} />
          {shelfOpen ? "Hide the shelf" : "The shelf"}
        </button>
      </div>

      {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}

      {/* Reading a note takes over the page — the capture bar and the streams
          are what you see when you arrive, not what you scroll past. */}
      {note ? (
        <div className="grid" style={{ gridTemplateColumns: isMobile || !shelfOpen ? "1fr" : "minmax(220px, 290px) minmax(0, 1fr)", alignItems: "start" }}>
          {!isMobile && shelfOpen && (
            <NoteTree notes={notes} selectedId={selectedId} onSelect={select} onCreateTop={createTop} query={query} onQueryChange={setQuery} />
          )}
          <NoteDetail
            key={note.id}
            note={note}
            highlights={noteHighlights}
            childrenByHighlight={childrenByHighlight}
            parent={notes.find((n) => n.id === note.parent_note_id) ?? null}
            childCount={(byParent.get(note.id) ?? []).length}
            editing={editing}
            onEditingChange={setEditing}
            isMobile={isMobile}
            onBack={() => select(null)}
            onOpenNote={select}
            onHighlight={handleHighlight}
            onCreateSubNote={handleCreateSubNote}
            onDeleteHighlight={(id) => guard(() => deleteHighlight(id))}
            onSave={(fields) => guard(() => updateNote(user.id, note.id, fields))}
            onSetKind={(k) => guard(() => updateNote(user.id, note.id, { noteKind: k }))}
            onDelete={() =>
              guard(async () => {
                await deleteNote(note.id);
                select(note.parent_note_id ?? null);
              })
            }
            onTogglePin={() => guard(() => updateNote(user.id, note.id, { pinned: !note.pinned }))}
          />
        </div>
      ) : (
        <div className="stack">
          <CaptureBar onCapture={capture} />

          <Resurfaced onOpen={select} />

          <SourceMiner onChanged={reload} />

          {shelfOpen && (
            <NoteTree notes={notes} selectedId={selectedId} onSelect={select} onCreateTop={createTop} query={query} onQueryChange={setQuery} />
          )}

          {notes.length > 0 && (
            <div className="card">
              <div className="card-head" style={{ flexWrap: "wrap", gap: 10 }}>
                <span className="card-title"><Layers size={14} />What you've kept</span>
                <div className="row" style={{ gap: 8 }}>
                  <input
                    className="input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    style={{ width: 170, padding: "7px 11px", fontSize: 13 }}
                  />
                  <button className="btn" onClick={createTop}>
                    <Plus size={14} />
                    Long note
                  </button>
                </div>
              </div>

              <div className="row row--between" style={{ marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
                <KindFilter counts={kindCounts} active={kindFilter} onChange={setKindFilter} />
                <div className="seg">
                  <button className={"seg-btn" + (view === "stream" ? " active" : "")} onClick={() => setView("stream")}>Stream</button>
                  <button className={"seg-btn" + (view === "wall" ? " active" : "")} onClick={() => setView("wall")}>Wall</button>
                </div>
              </div>

              {view === "wall" ? (
                <QuoteWall notes={filtered} onOpen={select} onChanged={reload} />
              ) : (
                <Streams notes={filtered} kindFilter={kindFilter} onOpen={select} />
              )}
            </div>
          )}

          {!loading && notes.length === 0 && (
            <div className="card" style={{ display: "grid", placeItems: "center", minHeight: 220, textAlign: "center" }}>
              <div style={{ maxWidth: 360 }}>
                <BookOpen size={26} style={{ color: "var(--text-3)", marginBottom: 10 }} />
                <p className="empty">
                  Nothing kept yet. Write the first thing in the box above — or start a long note for the book you're
                  reading and highlight your way through it.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Notes grouped by what they are, newest first, a handful at a time.
//
// This is the answer to "these can't just be buried in a long list": a
// spiritual experience from March sits under Spiritual experience, not at
// position 340 of everything you've ever written.
function Streams({ notes, kindFilter, onOpen }) {
  const groups = kindFilter
    ? [{ kind: kindOf(kindFilter), items: notes }]
    : NOTE_KINDS.map((k) => ({ kind: k, items: notes.filter((n) => (n.note_kind ?? "thought") === k.key) })).filter(
        (g) => g.items.length > 0
      );

  if (groups.length === 0) return <p className="empty">Nothing matches.</p>;

  return (
    <div className="stack">
      {groups.map((g) => (
        <Stream key={g.kind.key} kind={g.kind} items={g.items} onOpen={onOpen} expanded={Boolean(kindFilter)} />
      ))}
    </div>
  );
}

function Stream({ kind, items, onOpen, expanded }) {
  const [showAll, setShowAll] = useState(expanded);
  const sorted = [...items].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const shown = showAll ? sorted : sorted.slice(0, 4);

  return (
    <div>
      <div className="row" style={{ gap: 8, marginBottom: 9 }}>
        <span className="dot" style={{ background: kind.color, width: 8, height: 8 }} />
        <span style={{ fontSize: 12.5, fontWeight: 620 }}>{kind.label}</span>
        <span className="mono faint" style={{ fontSize: 10.5 }}>{items.length}</span>
        <span className="spacer" />
        {items.length > 4 && (
          <button className="btn-link" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Fewer" : `All ${items.length}`}
          </button>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
        {shown.map((n) => (
          <button
            key={n.id}
            onClick={() => onOpen(n.id)}
            className="day-card"
            style={{ padding: "12px 14px", cursor: "pointer", borderLeft: `2px solid ${kind.color}` }}
          >
            <div className="row" style={{ gap: 6, marginBottom: 5 }}>
              <span className="truncate" style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{n.title}</span>
              {n.pinned && <Pin size={10} style={{ color: "var(--accent)", flexShrink: 0 }} />}
            </div>
            <div
              className="prose prose--sm"
              style={{
                whiteSpace: "normal",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                color: "var(--text-2)",
                fontSize: 12.5,
              }}
            >
              {n.essence || n.excerpt || n.body_preview}
            </div>
            <div className="mono faint" style={{ fontSize: 10, marginTop: 8 }}>
              {new Date(n.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              {n.source_ref ? ` · ${n.source_ref}` : ""}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function NoteDetail({
  note,
  highlights,
  childrenByHighlight,
  parent,
  childCount,
  editing,
  onEditingChange,
  isMobile,
  onBack,
  onOpenNote,
  onHighlight,
  onCreateSubNote,
  onDeleteHighlight,
  onSave,
  onSetKind,
  onDelete,
  onTogglePin,
}) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body ?? "");
  const [sourceRef, setSourceRef] = useState(note.source_ref ?? "");

  useEffect(() => {
    setTitle(note.title);
    setBody(note.body ?? "");
    setSourceRef(note.source_ref ?? "");
  }, [note.id, note.title, note.body, note.source_ref]);

  const plainHighlights = highlights.filter((h) => !h.child_note_id);

  return (
    <div className="stack">
      <div className="card">
        <div className="row row--between" style={{ gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <div className="row" style={{ gap: 8, minWidth: 0 }}>
            {isMobile && (
              <button className="btn-icon btn-icon--bordered" onClick={onBack} title="Back to the shelf">
                <ChevronLeft size={15} />
              </button>
            )}
            {parent && (
              <button className="btn-link" onClick={() => onOpenNote(parent.id)}>
                <ChevronLeft size={11} />
                {parent.title}
              </button>
            )}
          </div>

          <div className="row" style={{ gap: 6 }}>
            <button className="btn-icon" onClick={onTogglePin} title={note.pinned ? "Unpin" : "Pin so it resurfaces often"}>
              {note.pinned ? <PinOff size={15} /> : <Pin size={15} />}
            </button>
            <button className="btn" onClick={() => (editing ? onSave({ title, body, sourceRef }) : onEditingChange(true))}>
              {editing ? <Check size={14} /> : <Pencil size={14} />}
              {editing ? "Done" : "Edit"}
            </button>
            <button className="btn-icon" onClick={onDelete} title="Delete this note">
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {editing ? (
          <div className="stack stack--tight">
            <KindChip value={note.note_kind} onChange={onSetKind} />
            <input className="input input--lg" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
            <input className="input" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="Where it's from — book, chapter, page (optional)" />
            <textarea
              className="textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What you're reading, and what you make of it. Blank line between paragraphs."
              style={{ minHeight: 380, fontFamily: "var(--font-serif)", fontSize: 15, lineHeight: 1.7 }}
            />
            <p className="faint" style={{ fontSize: 11.5 }}>
              Highlights follow their own words, so editing around them is safe. If you delete a highlighted passage
              outright, its note is kept and listed at the bottom.
            </p>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>{note.title}</h2>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <KindChip value={note.note_kind} onChange={onSetKind} />
              {note.source_ref && <span className="chip"><Quote size={11} />{note.source_ref}</span>}
              {childCount > 0 && <span className="chip"><StickyNote size={11} />{childCount} {childCount === 1 ? "sub-note" : "sub-notes"}</span>}
              {highlights.length > 0 && <span className="chip"><Highlighter size={11} />{highlights.length}</span>}
              {note.ai_theme && <span className="chip chip--accent">{note.ai_theme}</span>}
              <span className="mono faint" style={{ fontSize: 11 }}>{note.studied_on}</span>
            </div>

            {/* A sub-note keeps the passage it came from at the top, so it can
                be read on its own without hunting for the parent. */}
            {note.excerpt && (
              <blockquote
                className="prose prose--sm"
                style={{
                  margin: "0 0 18px",
                  padding: "10px 14px",
                  borderLeft: "2px solid var(--accent)",
                  background: "var(--surface)",
                  borderRadius: "0 var(--r) var(--r) 0",
                  color: "var(--text-2)",
                  fontStyle: "italic",
                }}
              >
                {note.excerpt}
              </blockquote>
            )}

            <NoteReader
              note={note}
              highlights={highlights}
              childrenByHighlight={childrenByHighlight}
              onHighlight={onHighlight}
              onCreateSubNote={onCreateSubNote}
              onDeleteHighlight={onDeleteHighlight}
              onOpenNote={onOpenNote}
            />
          </>
        )}
      </div>

      {!editing && plainHighlights.length > 0 && (
        <div className="card">
          <div className="card-head">
            <span className="card-title"><Highlighter size={14} />Highlights</span>
            <span className="mono faint" style={{ fontSize: 11.5 }}>{plainHighlights.length}</span>
          </div>
          <p className="card-note" style={{ marginBottom: 12 }}>
            Marked but not written about yet. Any of these can still become a note of its own.
          </p>
          {plainHighlights.map((h) => (
            <blockquote
              key={h.id}
              className="prose prose--sm"
              style={{ margin: "0 0 10px", paddingLeft: 12, borderLeft: "2px solid var(--accent-line)", color: "var(--text-2)" }}
            >
              {h.quoted_text}
            </blockquote>
          ))}
        </div>
      )}
    </div>
  );
}

// "Occasionally resurfaced." A note you wrote six weeks ago and haven't
// thought about since, offered once — not a feed, not a streak. Marking it
// seen is what puts it back into the cooling-off period.
function Resurfaced({ onOpen }) {
  const [notes, setNotes] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(() => {
    fetchNotesToResurface(2).then(setNotes).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (dismissed || notes.length === 0) return null;

  return (
    <div className="card card--accent" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <span className="card-title"><RotateCcw size={14} />Worth seeing again</span>
        <button
          className="btn-link"
          onClick={async () => {
            await Promise.all(notes.map((n) => markNoteSurfaced(n.id).catch(() => {})));
            setDismissed(true);
          }}
        >
          Mark as seen
        </button>
      </div>

      <div className="grid grid--halves">
        {notes.map((n) => (
          <button
            key={n.id}
            className="day-card"
            style={{ padding: "13px 15px", cursor: "pointer" }}
            onClick={async () => {
              await markNoteSurfaced(n.id).catch(() => {});
              onOpen(n.id);
            }}
          >
            <div className="row" style={{ gap: 7, marginBottom: 6 }}>
              {n.excerpt ? <StickyNote size={12} style={{ color: "var(--accent)" }} /> : <BookOpen size={12} style={{ color: "var(--text-3)" }} />}
              <span className="truncate" style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</span>
            </div>
            <div className="prose prose--sm" style={{ whiteSpace: "normal", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", color: "var(--text-2)" }}>
              {n.essence || n.excerpt || n.body_preview}
            </div>
            {n.last_surfaced_at && (
              <div className="mono faint" style={{ fontSize: 10, marginTop: 7 }}>
                last seen {new Date(n.last_surfaced_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
