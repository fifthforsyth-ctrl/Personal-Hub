import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, Pencil, Pin, ChevronLeft, CornerLeftUp, Layers, RotateCcw, Library, Plus, Highlighter, BookOpen } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast, useConfirm } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import { useLoad } from "../lib/useLoad";
import {
  fetchNotes,
  fetchNote,
  fetchHighlights,
  searchNotes,
  createNote,
  updateNote,
  deleteNote,
  createHighlight,
  deleteHighlight,
  createSubNoteFromHighlight,
  promoteHighlight,
  fetchNotesToResurface,
  markNoteSurfaced,
} from "../lib/api";
import NoteTree from "../components/study/NoteTree";
import NoteReader from "../components/study/NoteReader";
import CaptureBar from "../components/study/CaptureBar";
import QuoteWall from "../components/study/QuoteWall";
import SourceMiner from "../components/study/SourceMiner";
import { KindChip, KindFilter } from "../components/study/KindChip";
import { dayLabel } from "../components/study/dayLabel";
import { buildTree, resolveHighlights } from "../lib/noteText";
import { NOTE_KINDS, STUDY_NOTE, boardKindOf, isStudyNote, kindOf } from "../lib/noteKinds";
import { cardFace, cutAtWord, niceTitle, previewText, toPlainText, titleRepeats } from "../lib/markdown";
import useIsMobile from "../lib/useIsMobile";
import "../styles/board.css";

// The Board: what came, what you make of it, and what you're reading, kept
// somewhere it can be found again.
//
// Your own notes come first: the box to record something, then what you've
// kept, grouped by what it is. The machinery (notes worth seeing again, the
// vault's long notes and what the nightly reading kept) sits below that.
// Opening a note takes over the page; on a wide screen the list of all notes
// can sit beside it.
export default function Study() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const touch = useIsMobile();
  const narrow = useNarrow();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("note");

  const shelf = useLoad(() => loadShelf(user.id), [user.id]);
  const [gone, setGone] = useState(() => new Set()); // notes deleted, waiting out the Undo
  const [goneMarks, setGoneMarks] = useState(() => new Set()); // highlights, likewise

  const notes = useMemo(() => withoutGone(shelf.data?.notes ?? [], gone), [shelf.data, gone]);
  const highlights = useMemo(() => (shelf.data?.highlights ?? []).filter((h) => !goneMarks.has(h.id)), [shelf.data, goneMarks]);
  const byId = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  const byParent = useMemo(() => buildTree(notes), [notes]);

  const [treeOpen, setTreeOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [kindFilter, setKindFilter] = useState(null);
  const [view, setView] = useState("stream");
  const [showOvernight, setShowOvernight] = useState(false);

  // One search box, answered on the server from every word of every note.
  const [query, setQuery] = useState("");
  const [asked, setAsked] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setAsked(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);
  const searching = asked.length >= 2;
  const search = useLoad(() => (searching ? searchNotes(asked, 40) : Promise.resolve(null)), [asked, searching]);
  // While the next answer is on its way, the last one stays up under its
  // own words, rather than the list blinking out on every letter.
  const lastSearch = useRef(null);
  if (searching && search.data) lastSearch.current = { query: asked, hits: search.data };
  const shownSearch = searching ? (search.data ? { query: asked, hits: search.data } : lastSearch.current) : null;

  // The shelf carries a preview of each note, not its body. Opening a note
  // fetches the whole thing, and nothing can be edited until it has: an editor
  // seeded from a preview would save the preview over the note.
  const full = useLoad(() => (selectedId ? fetchNote(selectedId) : Promise.resolve(null)), [selectedId]);
  const listed = selectedId ? byId.get(selectedId) ?? null : null;
  const fullNote = full.data && full.data.id === selectedId ? full.data : null;
  const note = selectedId && !gone.has(selectedId) && (listed || fullNote) ? { ...listed, ...fullNote } : null;

  // Opening a note starts at its top; coming back puts the Board where it was.
  const homeScroll = useRef(0);
  useLayoutEffect(() => {
    const main = document.querySelector(".main");
    if (main) main.scrollTop = selectedId ? 0 : homeScroll.current;
  }, [selectedId]);

  // Leaving a note you're editing asks first, if anything in it changed.
  const editorDirty = useRef(false);

  async function select(id, { edit = false } = {}) {
    if (editingId && editorDirty.current && id !== selectedId) {
      const leave = await confirm({
        title: "Throw away your changes?",
        body: "You're editing a note and haven't saved it.",
        confirmLabel: "Throw away",
        cancelLabel: "Keep editing",
      });
      if (!leave) return;
    }
    editorDirty.current = false;
    if (!selectedId && id) homeScroll.current = document.querySelector(".main")?.scrollTop ?? 0;
    setEditingId(edit ? id : null);
    setParams(id ? { note: id } : {});
  }

  // --- writes ---------------------------------------------------------------

  async function capture({ text, kind }) {
    const firstLine = text.split("\n").find((l) => l.trim())?.trim() ?? text;
    try {
      await createNote(user.id, { title: cutAtWord(firstLine, 80), body: text, noteKind: kind });
      shelf.reload();
      toast.show(`Kept under ${kindOf(kind).label}`);
      return true;
    } catch (err) {
      toast.error(err, "Couldn't keep that. It's still in the box.");
      return false;
    }
  }

  async function createTop() {
    if (creating) return;
    setCreating(true);
    try {
      const created = await createNote(user.id, { title: "Untitled note", body: "" });
      shelf.reload();
      select(created.id, { edit: true });
    } catch (err) {
      toast.error(err, "Couldn't start a new note.");
    } finally {
      setCreating(false);
    }
  }

  // Only the fields that changed are sent, and the note on screen becomes
  // the row the database sent back.
  async function saveNote(id, fields, fallback = "Couldn't save the note.") {
    try {
      const row = await updateNote(user.id, id, fields);
      full.mutate((current) => (current?.id === id ? row : current));
      shelf.reload();
      return row;
    } catch (err) {
      toast.error(err, fallback);
      return null;
    }
  }

  // Gone from the screen at once, and for real once the Undo has had its
  // six seconds. A note's children move up to its parent, as they will in
  // the database.
  function removeNotes(ids, message) {
    setGone((prev) => new Set([...prev, ...ids]));
    toast.undoable({
      message,
      run: async () => {
        try {
          for (const id of ids) await deleteNote(id);
        } finally {
          shelf.reload();
        }
      },
      onUndo: () =>
        setGone((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        }),
    });
  }

  function removeNote(n) {
    const parent = n.parent_note_id && !gone.has(n.parent_note_id) ? n.parent_note_id : null;
    editorDirty.current = false; // the edits go with the note
    select(parent);
    removeNotes([n.id], "Note deleted");
  }

  function forgetHighlight(h, message) {
    setGoneMarks((prev) => new Set(prev).add(h.id));
    toast.undoable({
      message,
      run: async () => {
        await deleteHighlight(h.id);
        shelf.reload();
      },
      onUndo: () =>
        setGoneMarks((prev) => {
          const next = new Set(prev);
          next.delete(h.id);
          return next;
        }),
    });
  }

  async function addHighlight(n, sel) {
    try {
      const row = await createHighlight(user.id, { noteId: n.id, quotedText: sel.text, startOffset: sel.start, endOffset: sel.end });
      shelf.mutate((d) => d && { ...d, highlights: [...d.highlights, row] });
      return true;
    } catch (err) {
      toast.error(err, "Couldn't save the highlight.");
      return false;
    }
  }

  async function makeSubNote(n, sel, kind) {
    try {
      const { child, highlight } = await createSubNoteFromHighlight(user.id, {
        noteId: n.id,
        quotedText: sel.text,
        startOffset: sel.start,
        endOffset: sel.end,
        title: cutAtWord(sel.text.replace(/\s+/g, " "), 70),
        sourceRef: n.source_ref,
        noteKind: kind,
        position: (byParent.get(n.id) ?? []).length,
      });
      shelf.mutate((d) => d && { ...d, notes: [...d.notes, child], highlights: [...d.highlights, highlight] });
      shelf.reload();
      toast.show("Made a note from it", { actionLabel: "Open", onAction: () => select(child.id) });
      return true;
    } catch (err) {
      shelf.reload();
      toast.error(err, "Couldn't make the note.");
      return false;
    }
  }

  async function promote(n, h) {
    try {
      const child = await promoteHighlight(user.id, h, {
        title: cutAtWord(h.quoted_text.replace(/\s+/g, " "), 70),
        sourceRef: n.source_ref,
        noteKind: "thought",
        position: (byParent.get(n.id) ?? []).length,
      });
      shelf.reload();
      toast.show("Made a note from it", { actionLabel: "Open", onAction: () => select(child.id) });
    } catch (err) {
      shelf.reload();
      toast.error(err, "Couldn't make the note.");
    }
  }

  // --- the page --------------------------------------------------------------

  const tree = (
    <NoteTree
      notes={notes}
      selectedId={selectedId}
      onSelect={(id) => select(id)}
      onCreateTop={selectedId ? createTop : undefined}
      creating={creating}
    />
  );

  if (selectedId) {
    return (
      <div className="page">
        <div className={"board-note-layout" + (treeOpen ? " has-shelf" : "")}>
          {treeOpen && tree}
          {note ? (
            <NoteView
              key={note.id}
              note={note}
              fullLoaded={Boolean(fullNote)}
              fullError={full.error}
              onRetry={full.reload}
              parent={note.parent_note_id ? byId.get(note.parent_note_id) ?? null : null}
              highlights={highlights.filter((h) => h.note_id === note.id)}
              childrenById={byId}
              touch={touch}
              editing={editingId === note.id && Boolean(fullNote)}
              treeOpen={treeOpen}
              onToggleTree={() => setTreeOpen((v) => !v)}
              onBack={() => select(null)}
              onOpenNote={(id) => select(id)}
              onEdit={() => setEditingId(note.id)}
              onCloseEditor={() => setEditingId(null)}
              editorDirty={editorDirty}
              onSave={async (fields) => {
                const row = await saveNote(note.id, fields, "Couldn't save the note. Your changes are still here.");
                if (row) toast.show("Saved");
                return row;
              }}
              onDelete={() => removeNote(note)}
              onPin={async () => {
                const row = await saveNote(note.id, { pinned: !note.pinned });
                if (row) toast.show(row.pinned ? "Pinned. It comes back around more often." : "Unpinned");
              }}
              onSetKind={(key) => saveNote(note.id, { noteKind: key }, "Couldn't change its kind.")}
              onHighlight={(sel) => addHighlight(note, sel)}
              onCreateSubNote={(sel, kind) => makeSubNote(note, sel, kind)}
              onPromote={(h) => promote(note, h)}
              onForget={(h) => forgetHighlight(h, "Highlight removed")}
              onUnmark={(h) => forgetHighlight(h, "Passage unmarked. The note is kept.")}
            />
          ) : full.error && !shelf.loading ? (
            <div className="card board-note">
              <BackBar onBack={() => select(null)} />
              <LoadError what="this note" error={full.error} onRetry={full.reload} />
            </div>
          ) : full.loading || shelf.loading ? (
            <div className="card board-note">
              <BackBar onBack={() => select(null)} />
              <p className="empty">Loading the note…</p>
            </div>
          ) : (
            <div className="card board-note">
              <BackBar onBack={() => select(null)} />
              <p className="empty">That note isn't here any more.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const overnightCount = notes.filter((n) => n.auto_kept).length;

  return (
    <div className="page">
      <div className="page-head board-head">
        <div>
          <h1 className="page-title">Board</h1>
          <p className="page-sub">What came, what you make of it, and what you're reading.</p>
        </div>
        <div className="board-head__actions">
          <button type="button" className={"btn btn--sm" + (treeOpen ? " btn--accent" : "")} onClick={() => setTreeOpen((v) => !v)} aria-pressed={treeOpen}>
            <Library size={14} />
            All notes
          </button>
          <button type="button" className="btn btn--sm" onClick={createTop} disabled={creating}>
            <Plus size={14} />
            {creating ? "Starting…" : "New long note"}
          </button>
        </div>
      </div>

      <div className="board-search" role="search">
        <Search size={16} aria-hidden="true" />
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQuery("")}
          placeholder="Search every note"
          aria-label="Search every note"
          enterKeyHint="search"
          autoComplete="off"
        />
        {query && (
          <button type="button" className="btn-icon board-search__clear" onClick={() => setQuery("")} aria-label="Clear the search" title="Clear the search">
            <X size={16} />
          </button>
        )}
      </div>

      {searching ? (
        <SearchResults
          query={shownSearch?.query ?? asked}
          hits={shownSearch?.hits ?? null}
          error={search.error}
          onRetry={search.reload}
          byId={byId}
          onOpen={(id) => select(id)}
        />
      ) : (
        <div className="stack">
          {treeOpen && tree}

          <CaptureBar onCapture={capture} />

          {shelf.loading ? (
            <div className="card">
              <p className="empty">Loading your notes…</p>
            </div>
          ) : shelf.error && !shelf.data ? (
            <LoadError what="your notes" error={shelf.error} onRetry={shelf.reload} />
          ) : notes.length === 0 ? (
            <div className="card board-empty">
              <BookOpen size={24} aria-hidden="true" />
              <p className="empty">
                Nothing kept yet. Write the first thing in the box above, or start a long note for what you're reading
                and highlight your way through it.
              </p>
            </div>
          ) : (
            <Kept
              notes={notes}
              stale={shelf.error}
              onRetry={shelf.reload}
              overnightCount={overnightCount}
              showOvernight={showOvernight}
              onToggleOvernight={() => setShowOvernight((v) => !v)}
              kindFilter={kindFilter}
              onKindFilter={setKindFilter}
              view={view}
              onView={setView}
              perGroup={narrow ? 2 : 4}
              onOpen={(id) => select(id)}
              onChanged={shelf.reload}
            />
          )}

          <Resurfaced onOpen={(id) => select(id)} />

          <SourceMiner waiting={overnightCount} hidden={gone} onChanged={shelf.reload} onDrop={removeNotes} />
        </div>
      )}
    </div>
  );
}

async function loadShelf(userId) {
  const [notes, highlights] = await Promise.all([fetchNotes(userId), fetchHighlights(userId)]);
  return { notes, highlights };
}

// Notes deleted and waiting out their Undo are left out, and their children
// shown where the database will put them: under the deleted note's parent.
function withoutGone(notes, gone) {
  if (gone.size === 0) return notes;
  const byId = new Map(notes.map((n) => [n.id, n]));
  const lift = (id) => {
    let at = id;
    const seen = new Set();
    while (at && gone.has(at) && !seen.has(at)) {
      seen.add(at);
      at = byId.get(at)?.parent_note_id ?? null;
    }
    return at;
  };
  return notes
    .filter((n) => !gone.has(n.id))
    .map((n) => (n.parent_note_id && gone.has(n.parent_note_id) ? { ...n, parent_note_id: lift(n.parent_note_id) } : n));
}

// A phone shows fewer cards per kind, so every kind fits in a screen or two.
function useNarrow(query = "(max-width: 600px)") {
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setNarrow(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return narrow;
}

function BackBar({ onBack }) {
  return (
    <div className="board-note__bar">
      <div className="board-note__nav">
        <button type="button" className="btn btn--sm btn--ghost" onClick={onBack}>
          <ChevronLeft size={15} />
          Board
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// What you've kept
// ---------------------------------------------------------------------------

// Notes grouped by what they are, newest first, a handful at a time — so a
// revelation from March sits under Revelation, not at position 340 of
// everything you've ever written. Cards the nightly reading kept stay out
// until you've looked them over in From the vault (or ask to see them).
function Kept({
  notes,
  stale,
  onRetry,
  overnightCount,
  showOvernight,
  onToggleOvernight,
  kindFilter,
  onKindFilter,
  view,
  onView,
  perGroup,
  onOpen,
  onChanged,
}) {
  const visible = useMemo(() => (showOvernight ? notes : notes.filter((n) => !n.auto_kept)), [notes, showOvernight]);
  const counts = useMemo(() => {
    const m = new Map();
    for (const n of visible) {
      const key = boardKindOf(n).key;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [visible]);

  // A filter whose kind has nothing left in it lets go rather than showing
  // an empty board.
  const active = kindFilter && counts.get(kindFilter) ? kindFilter : null;
  const filtered = active ? visible.filter((n) => boardKindOf(n).key === active) : visible;

  return (
    <section className="card board-kept">
      <div className="card-head">
        <h2 className="card-title">
          <Layers size={14} />
          What you've kept
        </h2>
        <div className="seg" role="group" aria-label="Show as">
          <button type="button" className={"seg-btn" + (view === "stream" ? " active" : "")} aria-pressed={view === "stream"} onClick={() => onView("stream")}>
            By kind
          </button>
          <button type="button" className={"seg-btn" + (view === "wall" ? " active" : "")} aria-pressed={view === "wall"} onClick={() => onView("wall")}>
            Wall
          </button>
        </div>
      </div>

      {stale && <LoadError stale error={stale} onRetry={onRetry} className="board-kept__filters" />}

      {view === "wall" ? (
        <QuoteWall notes={visible} onOpen={onOpen} onChanged={onChanged} />
      ) : (
        <>
          <KindFilter counts={counts} active={active} onChange={onKindFilter} className="board-kept__filters" />
          <Streams notes={filtered} kindFilter={active} perGroup={perGroup} onOpen={onOpen} />
        </>
      )}

      {overnightCount > 0 && (
        <div className="board-more-row">
          <span style={{ flex: 1, minWidth: 0 }}>
            {showOvernight
              ? `Showing the ${overnightCount} kept overnight that you haven't looked over yet.`
              : `${overnightCount} kept overnight from your vault aren't shown until you've looked them over (in From the vault, below).`}
          </span>
          <button type="button" className="btn btn--sm" onClick={onToggleOvernight}>
            {showOvernight ? "Hide them" : "Show them"}
          </button>
        </div>
      )}
    </section>
  );
}

function Streams({ notes, kindFilter, perGroup, onOpen }) {
  const groups = useMemo(() => {
    const order = [...NOTE_KINDS, STUDY_NOTE];
    const by = new Map(order.map((k) => [k.key, []]));
    for (const n of notes) {
      const key = boardKindOf(n).key;
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(n);
    }
    return [...by.entries()]
      .filter(([, items]) => items.length > 0)
      .map(([key, items]) => ({
        kind: key === STUDY_NOTE.key ? STUDY_NOTE : kindOf(key),
        items: items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
      }));
  }, [notes]);

  if (groups.length === 0) return <p className="empty">Nothing here yet.</p>;

  return groups.map((g) => (
    <Stream key={g.kind.key} kind={g.kind} items={g.items} perGroup={perGroup} expanded={Boolean(kindFilter)} onOpen={onOpen} />
  ));
}

function Stream({ kind, items, perGroup, expanded, onOpen }) {
  const [showAll, setShowAll] = useState(expanded);
  const shown = showAll ? items : items.slice(0, perGroup);

  return (
    <section className="board-stream">
      <div className="board-stream__head">
        <span className="dot" style={{ background: kind.color, width: 8, height: 8 }} />
        <h3 className="board-stream__label">{kind.label}</h3>
        <span className="board-stream__count">{items.length}</span>
        <span className="spacer" />
        {items.length > perGroup && (
          <button type="button" className="btn-link" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
            {showAll ? "Fewer" : `All ${items.length}`}
          </button>
        )}
      </div>
      <div className="board-cards">
        {shown.map((n) => (
          <NoteCard key={n.id} note={n} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

// One text per card, cut at a word; the title only when it says something
// the text doesn't.
function NoteCard({ note, onOpen, meta }) {
  const face = cardFace(note);
  return (
    <button type="button" className="board-card" onClick={() => onOpen(note.id)}>
      {face.title && <span className="board-card__title">{face.title}</span>}
      <span className="board-card__text">{face.text}</span>
      <span className="board-card__meta">
        {note.pinned && <Pin size={11} fill="currentColor" aria-label="Pinned" />}
        <span>{meta ?? [dayLabel(note.created_at), note.source_ref].filter(Boolean).join(" · ")}</span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Worth seeing again
// ---------------------------------------------------------------------------

// A note you wrote weeks ago and haven't thought about since, offered once —
// not a feed, not a streak. Marking it seen is what puts it back into the
// cooling-off period.
function Resurfaced({ onOpen }) {
  const toast = useToast();
  const { data, error, reload } = useLoad(() => fetchNotesToResurface(2), []);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (error && !data) return <LoadError what="notes worth seeing again" error={error} onRetry={reload} />;
  if (dismissed || !data?.length) return null;

  async function markSeen() {
    if (busy) return;
    setBusy(true);
    try {
      await Promise.all(data.map((n) => markNoteSurfaced(n.id)));
      setDismissed(true);
    } catch (err) {
      toast.error(err, "Couldn't mark them as seen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">
          <RotateCcw size={14} />
          Worth seeing again
        </h2>
        <button type="button" className="btn btn--sm" onClick={markSeen} disabled={busy}>
          {busy ? "Saving…" : "Mark as seen"}
        </button>
      </div>
      <div className="board-cards">
        {data.map((n) => (
          <NoteCard
            key={n.id}
            note={n}
            meta={[n.last_surfaced_at ? `Last seen ${dayLabel(n.last_surfaced_at)}` : `Kept ${dayLabel(n.created_at)}`, n.source_ref].filter(Boolean).join(" · ")}
            onOpen={(id) => {
              // Opening it counts as seeing it. If that doesn't save, it
              // only means the note may be offered again.
              markNoteSurfaced(id).catch((err) => console.warn(err));
              onOpen(id);
            }}
          />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function SearchResults({ query, hits, error, onRetry, byId, onOpen }) {
  const words = useMemo(() => query.toLowerCase().split(/\s+/).filter((w) => w.length > 0).slice(0, 8), [query]);

  if (error && !hits) return <LoadError what="the search" error={error} onRetry={onRetry} />;
  if (!hits) return <p className="empty">Searching…</p>;

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">
          <Search size={14} />
          {hits.length === 0
            ? `Nothing has “${query}”`
            : `${hits.length >= 40 ? "40 or more" : hits.length} ${hits.length === 1 ? "note has" : "notes have"} “${query}”`}
        </h2>
      </div>
      {error && <LoadError stale error={error} onRetry={onRetry} />}
      {hits.length === 0 ? (
        <p className="card-note">Every word of every note was searched. Notes have to contain all the words, so try fewer.</p>
      ) : (
        hits.map((h) => {
          const listed = byId.get(h.id);
          const kind = boardKindOf(listed ?? h);
          // A note with a body shows its title and the words around the
          // match; a card shows its one text, with a title only if it adds
          // something.
          const face = h.snippet ? { title: niceTitle(h), text: around(h.snippet, words, listed?.body_preview) } : cardFace(h, 220);
          return (
            <button key={h.id} type="button" className="board-result" onClick={() => onOpen(h.id)}>
              <span className="board-result__top">
                <span className="dot" style={{ background: kind.color }} />
                {face.title ? (
                  <span className="board-result__title">{markWords(face.title, words)}</span>
                ) : (
                  <span className="board-result__snippet">{markWords(face.text, words)}</span>
                )}
              </span>
              {face.title && face.text && <span className="board-result__snippet">{markWords(face.text, words)}</span>}
              <span className="board-result__meta">{[kind.label, h.source_ref, dayLabel(h.created_at)].filter(Boolean).join(" · ")}</span>
            </button>
          );
        })
      )}
    </section>
  );
}

// The server sends a fixed-width window of the note around the first match,
// so its ends usually fall mid-word. Those ends are trimmed to whole words,
// unless that would cut away the word you searched for, or the window starts
// at the top of the note (which the shelf's preview shows). Headings and
// callout labels are left out, as on a card.
function around(snippet, words, preview) {
  const atTop = Boolean(preview) && preview.startsWith(snippet.slice(0, 40));
  let s = previewText(snippet) || toPlainText(snippet);
  const has = (part) => words.some((w) => part.toLowerCase().includes(w));
  const first = s.indexOf(" ");
  if (!atTop && first > 0 && first < 24 && !has(s.slice(0, first))) s = "…" + s.slice(first + 1);
  const last = s.lastIndexOf(" ");
  if (last > 0 && last > s.length - 24 && !has(s.slice(last + 1))) s = s.slice(0, last) + "…";
  return s;
}

function markWords(text, words) {
  if (!text || words.length === 0) return text;
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return String(text)
    .split(pattern)
    .map((part, i) => (i % 2 === 1 ? <mark key={i} className="board-hit">{part}</mark> : part));
}

// ---------------------------------------------------------------------------
// A note, open
// ---------------------------------------------------------------------------

function NoteView({
  note,
  fullLoaded,
  fullError,
  onRetry,
  parent,
  highlights,
  childrenById,
  touch,
  editing,
  editorDirty,
  treeOpen,
  onToggleTree,
  onBack,
  onOpenNote,
  onEdit,
  onCloseEditor,
  onSave,
  onDelete,
  onPin,
  onSetKind,
  onHighlight,
  onCreateSubNote,
  onPromote,
  onForget,
  onUnmark,
}) {
  const [pinBusy, setPinBusy] = useState(false);
  const [kindBusy, setKindBusy] = useState(false);
  const [promoting, setPromoting] = useState(() => new Set());

  const source = fullLoaded ? note.body ?? "" : note.body_preview ?? "";
  const hasBody = fullLoaded ? source.trim().length > 0 : (note.body_length ?? 0) > 0;
  const title = niceTitle(note);
  const lead = !hasBody && note.essence ? note.essence : null;
  // The title is left out when it's only the first words of what's right
  // under it — a kept line's essence, the passage itself, or the first line
  // of a thought — so nothing reads twice. A first heading that repeats it
  // is dropped from the note instead.
  const showTitle = !titleRepeats(title, lead || note.excerpt || (hasBody ? openingLine(source) : ""));

  // Marked but not made into notes, and still in the text (the ones that
  // lost their place are listed with the note itself).
  const plain = useMemo(() => {
    const list = highlights.filter((h) => !h.child_note_id);
    return fullLoaded ? resolveHighlights(note.body ?? "", list).filter((h) => !h.orphaned) : list;
  }, [highlights, fullLoaded, note.body]);

  async function pin() {
    if (pinBusy) return;
    setPinBusy(true);
    await onPin();
    setPinBusy(false);
  }

  async function setKind(key) {
    setKindBusy(true);
    await onSetKind(key);
    setKindBusy(false);
  }

  async function promote(h) {
    if (promoting.has(h.id)) return;
    setPromoting((prev) => new Set(prev).add(h.id));
    await onPromote(h);
    setPromoting((prev) => {
      const next = new Set(prev);
      next.delete(h.id);
      return next;
    });
  }

  return (
    <div className="stack board-note">
      <article className="card">
        <div className="board-note__bar">
          <div className="board-note__nav">
            <button type="button" className="btn btn--sm btn--ghost" onClick={onBack}>
              <ChevronLeft size={15} />
              Board
            </button>
          </div>
          <div className="board-note__tools">
            <button
              type="button"
              className={"btn-icon board-shelf-toggle" + (treeOpen ? " is-on" : "")}
              onClick={onToggleTree}
              aria-pressed={treeOpen}
              aria-label="All notes beside this one"
              title={treeOpen ? "Hide all notes" : "Show all notes beside this one"}
            >
              <Library size={16} />
            </button>
            <button
              type="button"
              className={"btn-icon board-pin" + (note.pinned ? " is-on" : "")}
              onClick={pin}
              disabled={pinBusy}
              aria-pressed={Boolean(note.pinned)}
              aria-label={note.pinned ? "Unpin" : "Pin"}
              title={note.pinned ? "Unpin" : "Pin: it comes back around more often"}
            >
              <Pin size={16} fill={note.pinned ? "currentColor" : "none"} />
            </button>
            {!editing && (
              <button type="button" className="btn btn--sm" onClick={onEdit} disabled={!fullLoaded} title={fullLoaded ? undefined : "Waiting for the whole note"}>
                <Pencil size={13} />
                Edit
              </button>
            )}
          </div>
        </div>

        {parent && (
          <div className="board-note__from">
            <button
              type="button"
              className="btn-link board-parent"
              onClick={() => onOpenNote(parent.id)}
              title={`Open “${niceTitle(parent)}”, the note this came from`}
            >
              <CornerLeftUp size={14} aria-hidden="true" />
              <span>From {niceTitle(parent)}</span>
            </button>
          </div>
        )}

        {editing ? (
          <NoteEditor
            note={note}
            studyNote={isStudyNote(note)}
            dirtyRef={editorDirty}
            onSave={async (fields) => {
              const row = await onSave(fields);
              if (row) onCloseEditor();
              return row;
            }}
            onCancel={onCloseEditor}
            onDelete={onDelete}
          />
        ) : (
          <>
            <h1 className={showTitle ? "board-note__title" : "board-sr"}>{title}</h1>
            <div className="board-note__meta">
              <KindChip value={note.note_kind} onChange={setKind} studyNote={isStudyNote(note)} disabled={kindBusy} />
              {note.source_ref && <span className="chip">{note.source_ref}</span>}
              <span className="board-note__date">{dayLabel(note.studied_on || note.created_at)}</span>
            </div>

            {/* A note made from a passage keeps the passage at the top, so it
                reads on its own without hunting for where it came from. */}
            {note.excerpt && <blockquote className="board-quote">{note.excerpt}</blockquote>}
            {lead && <p className="board-essence">{lead}</p>}

            {!fullLoaded ? (
              fullError ? (
                <LoadError what="the whole note" error={fullError} onRetry={onRetry} />
              ) : (
                hasBody && <p className="empty">Loading the note…</p>
              )
            ) : hasBody ? (
              <NoteReader
                note={note}
                title={note.title}
                highlights={highlights}
                childrenById={childrenById}
                touch={touch}
                onHighlight={onHighlight}
                onCreateSubNote={onCreateSubNote}
                onForget={onForget}
                onUnmark={onUnmark}
                onOpenNote={onOpenNote}
              />
            ) : (
              !lead && <p className="empty">{note.excerpt ? "Nothing written about it yet." : "Nothing written here yet."}</p>
            )}
          </>
        )}
      </article>

      {!editing && plain.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">
              <Highlighter size={14} />
              Highlights
            </h2>
            <span className="mono muted" style={{ fontSize: 11.5 }}>{plain.length}</span>
          </div>
          <p className="card-note" style={{ marginBottom: 4 }}>
            Marked but not written about yet. Any of them can still become a note of its own.
          </p>
          {plain.map((h) => (
            <div key={h.id} className="board-highlight">
              <blockquote className="board-quote">{h.quoted_text}</blockquote>
              <div className="board-highlight__actions">
                <button type="button" className="btn-link" onClick={() => promote(h)} disabled={promoting.has(h.id)}>
                  {promoting.has(h.id) ? "Making it…" : "Make a note"}
                </button>
                <button type="button" className="btn-link" onClick={() => onForget(h)}>
                  Forget
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

// The first line of a note's text, as words. A heading doesn't count: if it
// repeats the title the reader drops it, and if it doesn't it's a heading of
// its own.
function openingLine(text) {
  const line = (String(text ?? "").split("\n").find((l) => l.trim()) ?? "").trim();
  return /^#{1,6}\s/.test(line) ? "" : toPlainText(line);
}

const PLACEHOLDER_TITLES = new Set(["untitled", "untitled note"]);

// Seeded once from the whole note when it opens, and never reset under you
// while you type. Save sends only what changed; Cancel asks before throwing
// changes away.
function NoteEditor({ note, studyNote, dirtyRef, onSave, onCancel, onDelete }) {
  const confirm = useConfirm();
  const [initial] = useState(() => ({
    title: PLACEHOLDER_TITLES.has(String(note.title ?? "").trim().toLowerCase()) ? "" : note.title ?? "",
    sourceRef: note.source_ref ?? "",
    body: note.body ?? "",
    kind: note.note_kind ?? "thought",
  }));
  const [title, setTitle] = useState(initial.title);
  const [sourceRef, setSourceRef] = useState(initial.sourceRef);
  const [body, setBody] = useState(initial.body);
  const [kind, setKind] = useState(initial.kind);
  const [saving, setSaving] = useState(false);

  const changes = {};
  if (title.trim() !== initial.title.trim()) changes.title = title;
  if (sourceRef.trim() !== initial.sourceRef.trim()) changes.sourceRef = sourceRef.trim();
  if (body !== initial.body) changes.body = body;
  if (kind !== initial.kind) changes.noteKind = kind;
  const dirty = Object.keys(changes).length > 0;

  useEffect(() => {
    dirtyRef.current = dirty;
    if (!dirty) return;
    // Closing the tab or reloading with unsaved changes asks too.
    const stay = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", stay);
    return () => window.removeEventListener("beforeunload", stay);
  }, [dirty, dirtyRef]);
  useEffect(() => () => (dirtyRef.current = false), [dirtyRef]);

  async function save(e) {
    e?.preventDefault();
    if (saving) return;
    if (!dirty) return onCancel();
    setSaving(true);
    const row = await onSave(changes);
    if (!row) setSaving(false); // on success the editor closes
  }

  async function cancel() {
    if (saving) return;
    if (
      dirty &&
      !(await confirm({
        title: "Throw away your changes?",
        body: `What you changed in “${cutAtWord(title.trim() || niceTitle(note), 60)}” won't be saved.`,
        confirmLabel: "Throw away",
        cancelLabel: "Keep editing",
      }))
    ) {
      return;
    }
    onCancel();
  }

  return (
    <form
      className="board-editor"
      onSubmit={save}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(e);
      }}
    >
      <div className="board-note__meta">
        <KindChip value={kind} onChange={setKind} studyNote={studyNote} />
      </div>
      <label className="board-field">
        <span>Title</span>
        <input className="input input--lg" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" />
      </label>
      <label className="board-field">
        <span>Where it's from (optional)</span>
        <input className="input" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="Book, chapter, talk, page" />
      </label>
      <label className="board-field">
        <span>The note</span>
        <textarea
          className="textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What you're reading, and what you make of it. A blank line between paragraphs."
        />
      </label>
      <p className="board-editor__note">
        Highlights follow their own words, so editing around them is safe. If you delete a highlighted passage, the
        note made from it is kept and listed at the bottom.
      </p>

      <div className="board-editor__actions">
        <button type="button" className="btn-link btn-link--danger" onClick={onDelete} disabled={saving}>
          Delete note
        </button>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn" onClick={cancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn--accent" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
