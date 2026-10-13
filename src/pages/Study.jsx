import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, Pencil, Pin, ChevronLeft, CornerLeftUp, Library, Plus, Highlighter } from "lucide-react";
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
  gistNote,
  gistBacklog,
  fetchSavedQuotes,
} from "../lib/api";
import NoteTree from "../components/study/NoteTree";
import NoteReader from "../components/study/NoteReader";
import CaptureBar from "../components/study/CaptureBar";
import CorkBoard from "../components/board/CorkBoard";
import { TopPicks, Browse, ShelfView } from "../components/board/Shelves";
import { MOODS, PEOPLE, THEMES, shelfFor } from "../lib/quoteShelves";
import CuratedCards from "../components/curator/CuratedCards";
import { dayLabel } from "../components/study/dayLabel";
import { changesFrom, clearNoteDraft, draftClashes, draftOver, draftTime, editableFields, readNoteDraft, writeNoteDraft } from "../components/study/noteDraft";
import { buildTree, resolveHighlights } from "../lib/noteText";
import { cardFace, cutAtWord, niceTitle, previewText, toPlainText, titleRepeats } from "../lib/markdown";
import useIsMobile from "../lib/useIsMobile";
import "../styles/board.css";

// The Board: a cork board for what came, what you make of it, and the words
// of others that help you press on.
//
// It opens on one box to record something, then this week's top picks: quotes
// chosen for what the week is about. Under them, shelves of quotes to browse
// by person, theme or mood (or anything you type), and then the cork itself:
// the quotes you saved and the thoughts you kept, pinned up together.
//
// Nothing is sorted into kinds: in the background each new thought gets a
// one-line gist and a few quiet tags, so search and the curator can find it
// again, and the curator brings old ones back where they fit. Notes made from
// a passage of a longer note are folded under that note rather than filling
// the board. Opening a note or a shelf takes over the page; on a wide screen
// the list of all notes can sit beside a note.
export default function Study() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const touch = useIsMobile();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("note");
  const openShelf = useMemo(() => shelfFromParams(params), [params]);

  const shelf = useLoad(() => loadShelf(user.id), [user.id]);
  const saved = useLoad(() => fetchSavedQuotes(user.id), [user.id]);
  const [gone, setGone] = useState(() => new Set()); // notes deleted, waiting out the Undo
  const [goneMarks, setGoneMarks] = useState(() => new Set()); // highlights, likewise

  const notes = useMemo(() => withoutGone(shelf.data?.notes ?? [], gone), [shelf.data, gone]);
  const highlights = useMemo(() => (shelf.data?.highlights ?? []).filter((h) => !goneMarks.has(h.id)), [shelf.data, goneMarks]);
  const byId = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  const byParent = useMemo(() => buildTree(notes), [notes]);

  const [treeOpen, setTreeOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);

  // Thoughts kept before the board filed things get their gist a few at a
  // time, quietly, the first time the board opens in a session.
  useEffect(() => {
    fileBacklog();
  }, []);

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

  // Opening a note or a shelf starts at its top; coming back puts the Board
  // where it was.
  const homeScroll = useRef(0);
  const away = Boolean(selectedId || openShelf);
  useLayoutEffect(() => {
    const main = document.querySelector(".main");
    if (main) main.scrollTop = away ? 0 : homeScroll.current;
  }, [away, selectedId, openShelf?.key]);

  // Opening another note while you're editing one asks first, if anything in
  // it changed. Leaving the Board altogether keeps the changes as a draft
  // (noteDraft.js), waiting on the note for next time.
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
      clearNoteDraft(user.id, editingId);
    }
    editorDirty.current = false;
    if (!selectedId && !openShelf && id) homeScroll.current = document.querySelector(".main")?.scrollTop ?? 0;
    setEditingId(edit ? id : null);
    setParams(id ? { note: id } : {});
  }

  function browse(next) {
    if (!openShelf) homeScroll.current = document.querySelector(".main")?.scrollTop ?? 0;
    setParams(next ? shelfParams(next) : {});
  }

  // A quote saved or unsaved anywhere on the page: the cork follows.
  function quoteChanged(quote) {
    saved.mutate((list) => {
      const rest = (list ?? []).filter((q) => q.id !== quote.id);
      return quote.saved_at ? [quote, ...rest] : rest;
    });
  }

  // --- writes ---------------------------------------------------------------

  async function capture({ text }) {
    const firstLine = text.split("\n").find((l) => l.trim())?.trim() ?? text;
    try {
      const created = await createNote(user.id, { title: cutAtWord(firstLine, 80), body: text, noteKind: "thought" });
      shelf.reload();
      toast.show("Kept");
      // Filed afterwards. If it fails, the next backlog pass picks it up.
      gistNote(created.id).catch((err) => console.warn(err));
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
    clearNoteDraft(user.id, n.id);
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

  async function makeSubNote(n, sel) {
    try {
      const { child, highlight } = await createSubNoteFromHighlight(user.id, {
        noteId: n.id,
        quotedText: sel.text,
        startOffset: sel.start,
        endOffset: sel.end,
        title: cutAtWord(sel.text.replace(/\s+/g, " "), 70),
        sourceRef: n.source_ref,
        noteKind: "thought",
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

  if (openShelf && !selectedId) {
    return (
      <div className="page">
        <ShelfView key={openShelf.key} userId={user.id} shelf={openShelf} onBack={() => browse(null)} onSaved={quoteChanged} />
      </div>
    );
  }

  if (selectedId) {
    return (
      <div className="page">
        <div className={"board-note-layout" + (treeOpen ? " has-shelf" : "")}>
          {treeOpen && tree}
          {note ? (
            <NoteView
              key={note.id}
              note={note}
              userId={user.id}
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
              onHighlight={(sel) => addHighlight(note, sel)}
              onCreateSubNote={(sel) => makeSubNote(note, sel)}
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

          <TopPicks userId={user.id} onSaved={quoteChanged} />

          <Browse userId={user.id} onOpen={browse} />

          {shelf.loading || saved.loading ? (
            <div className="card">
              <p className="empty">Loading your board…</p>
            </div>
          ) : shelf.error && !shelf.data ? (
            <LoadError what="your notes" error={shelf.error} onRetry={shelf.reload} />
          ) : (
            <>
              {(shelf.error || saved.error) && (
                <LoadError
                  stale
                  error={shelf.error ?? saved.error}
                  onRetry={() => {
                    shelf.reload();
                    saved.reload();
                  }}
                />
              )}
              <CorkBoard
                quotes={saved.data ?? []}
                notes={notes}
                onOpenNote={(id) => select(id)}
                onQuoteChange={quoteChanged}
                onNotesChanged={shelf.reload}
              />
            </>
          )}

          <CuratedCards slot="day" title="Back for today" />
        </div>
      )}
    </div>
  );
}

// A shelf open on the page lives in the address, so Back works and a shelf
// can be reopened: ?shelf=person:russell-m-nelson. A typed one carries its
// words too.
const LISTED = [
  ...PEOPLE.map((p) => shelfFor("person", p)),
  ...THEMES.map((t) => shelfFor("theme", t)),
  ...MOODS.map((m) => shelfFor("mood", m)),
];

function shelfFromParams(params) {
  const key = params.get("shelf");
  if (!key) return null;
  if (key.startsWith("ask:")) {
    const words = params.get("about");
    return words ? shelfFor("ask", { name: words }) : null;
  }
  return LISTED.find((s) => s.key === key) ?? null;
}

function shelfParams(shelf) {
  return shelf.facet === "ask" ? { shelf: shelf.key, about: shelf.label } : { shelf: shelf.key };
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

// Once per session, a few rounds of eight. Anything left waits for the next
// visit; none of it is needed for the board to work.
let backlogStarted = false;
async function fileBacklog() {
  if (backlogStarted) return;
  backlogStarted = true;
  try {
    for (let round = 0; round < 4; round++) {
      const result = await gistBacklog();
      if (!result?.more) break;
    }
  } catch (err) {
    console.warn(err);
  }
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
          // A note with a body shows its title and the words around the
          // match; a card shows its one text, with a title only if it adds
          // something.
          const face = h.snippet ? { title: niceTitle(h), text: around(h.snippet, words, listed?.body_preview) } : cardFace(h, 220);
          return (
            <button key={h.id} type="button" className="board-result" onClick={() => onOpen(h.id)}>
              <span className="board-result__top">
                {face.title ? (
                  <span className="board-result__title">{markWords(face.title, words)}</span>
                ) : (
                  <span className="board-result__snippet">{markWords(face.text, words)}</span>
                )}
              </span>
              {face.title && face.text && <span className="board-result__snippet">{markWords(face.text, words)}</span>}
              <span className="board-result__meta">{[h.source_ref, dayLabel(h.created_at)].filter(Boolean).join(" · ")}</span>
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
  userId,
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
  onHighlight,
  onCreateSubNote,
  onPromote,
  onForget,
  onUnmark,
}) {
  const confirm = useConfirm();
  const [pinBusy, setPinBusy] = useState(false);
  const [promoting, setPromoting] = useState(() => new Set());
  const [, setDraftsSeen] = useState(0);

  // Changes left unsaved when the page was last left, if they'd still change
  // anything about the note as it is now.
  const draft = fullLoaded && !editing ? readNoteDraft(userId, note.id) : null;
  const current = draft ? editableFields(note) : null;
  const waiting = draft && Object.keys(changesFrom(draftOver(draft, current), current)).length > 0 ? draft : null;

  async function throwAwayDraft() {
    const yes = await confirm({
      title: "Throw away your unsaved changes?",
      body: "The note stays as it was last saved.",
      confirmLabel: "Throw away",
      cancelLabel: "Keep them",
    });
    if (!yes) return;
    clearNoteDraft(userId, note.id);
    setDraftsSeen((n) => n + 1);
  }

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

        {waiting && (
          <div className="board-draft" role="status">
            <p className="board-draft__text">
              Unsaved changes from {draftTime(waiting.at)}.
              {draftClashes(waiting, current) && " The note has changed since, so look them over before saving."}
            </p>
            <div className="board-draft__actions">
              <button type="button" className="btn btn--sm btn--on-page" onClick={onEdit}>
                Keep editing
              </button>
              <button type="button" className="btn-link btn-link--danger" onClick={throwAwayDraft}>
                Throw away
              </button>
            </div>
          </div>
        )}

        {editing ? (
          <NoteEditor
            note={note}
            userId={userId}
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
              {note.source_ref && <span className="chip">{note.source_ref}</span>}
              <span className="board-note__date">{dayLabel(note.studied_on || note.created_at)}</span>
              {/* Filed by the board, for finding it again. Quiet on purpose. */}
              {note.ai_tags?.length > 0 && <span className="board-note__tags">{note.ai_tags.map((t) => `#${t}`).join(" ")}</span>}
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

// Seeded once from the whole note when it opens, and never reset under you
// while you type. Changes left unsaved last time come back with it. Every
// change is kept on the device as it's typed; Save sends only what changed,
// and Cancel asks before throwing changes away.
function NoteEditor({ note, userId, dirtyRef, onSave, onCancel, onDelete }) {
  const confirm = useConfirm();
  const [initial] = useState(() => editableFields(note));
  const [resumed] = useState(() => {
    const draft = readNoteDraft(userId, note.id);
    if (!draft) return null;
    const fields = draftOver(draft, initial);
    return Object.keys(changesFrom(fields, initial)).length > 0 ? { fields, at: draft.at } : null;
  });
  const start = resumed?.fields ?? initial;
  const [title, setTitle] = useState(start.title);
  const [sourceRef, setSourceRef] = useState(start.sourceRef);
  const [body, setBody] = useState(start.body);
  // The kind isn't shown any more, but a note keeps the one it has.
  const [kind] = useState(start.kind);
  const [saving, setSaving] = useState(false);

  const changes = changesFrom({ title, sourceRef, body, kind }, initial);
  const dirty = Object.keys(changes).length > 0;

  useEffect(() => {
    if (dirty) writeNoteDraft(userId, note.id, { title, sourceRef, body, kind }, initial);
    else clearNoteDraft(userId, note.id);
  }, [dirty, title, sourceRef, body, kind, userId, note.id, initial]);

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
    if (row) clearNoteDraft(userId, note.id); // and the editor closes
    else setSaving(false);
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
    clearNoteDraft(userId, note.id);
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
      {resumed && <p className="board-draft__text board-draft__text--resumed">Your unsaved changes from {draftTime(resumed.at)} are back.</p>}
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
