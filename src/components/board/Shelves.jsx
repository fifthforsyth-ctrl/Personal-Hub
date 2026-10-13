import { useMemo, useState } from "react";
import { Sparkles, RefreshCw, ChevronLeft, Search, Plus, RotateCw, Users, Tag, Heart } from "lucide-react";
import { useLoad } from "../../lib/useLoad";
import { fetchShelfCovers } from "../../lib/api";
import { friendlyError } from "../../lib/errors";
import { todayStr } from "../../lib/planDates";
import {
  FACETS,
  MOODS,
  PEOPLE,
  THEMES,
  holdsNotes,
  interleave,
  notePeople,
  notesOnShelf,
  shelfCounts,
  shelfFor,
  topShelf,
} from "../../lib/quoteShelves";
import { initials } from "../../lib/quotes";
import { PaperNote } from "./CorkBoard";
import QuoteCard from "./QuoteCard";
import { useShelf } from "./useShelf";
import { useWikiPhoto } from "./useWikiPhoto";

// ---------------------------------------------------------------------------
// Top picks: this week's quotes, chosen for what the week is about.
// ---------------------------------------------------------------------------

export function TopPicks({ userId, onSaved }) {
  const shelf = useMemo(() => topShelf(todayStr()), []);
  const s = useShelf(userId, shelf);

  function changed(quote) {
    s.replace(quote);
    onSaved?.(quote);
  }

  return (
    <section className="picks" aria-label="Top picks for you">
      <div className="picks__head">
        <div>
          <h2 className="picks__title">
            <Sparkles size={15} aria-hidden="true" />
            Top picks for you
          </h2>
          <p className="picks__sub">Chosen for this week: your focus, your journal, the goals gone quiet.</p>
        </div>
        {s.state === "ready" && (
          <button type="button" className="btn btn--sm btn--ghost" onClick={s.fresh} title="Find a new set of picks for this week">
            <RefreshCw size={13} />
            New picks
          </button>
        )}
      </div>

      {s.quotes.length > 0 ? (
        <div className="picks__strip">
          {s.quotes.map((q) => (
            <QuoteCard key={q.id} quote={q} variant="pick" reason={q.pick_reason} onChange={changed} />
          ))}
          {s.state === "pending" && <WaitingPrint />}
        </div>
      ) : s.state === "failed" || s.loadError ? (
        <ShelfTrouble error={s.error ?? s.loadError} onRetry={s.loadError ? s.reload : s.retry} />
      ) : (
        <div className="picks__strip">
          <WaitingPrint label="Reading your week and looking up quotes…" />
          <WaitingPrint />
          <WaitingPrint />
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Browse: shelves by person, theme or mood, or anything you ask for.
// ---------------------------------------------------------------------------

export function Browse({ userId, notes, onOpen }) {
  const [facet, setFacet] = useState("person");
  const [ask, setAsk] = useState("");
  const covers = useLoad(() => fetchShelfCovers(userId), [userId]);
  const cover = (shelf) => covers.data?.[shelf.key] ?? null;
  // Your own notes are filed onto the shelves too: how many on each, and the
  // people you've quoted who aren't among the Board's own.
  const counts = useMemo(() => shelfCounts(notes), [notes]);
  const yours = (shelf) => counts.get(shelf.key) ?? 0;
  const others = useMemo(() => notePeople(notes), [notes]);

  function submitAsk(e) {
    e.preventDefault();
    const words = ask.trim();
    if (words.length < 2) return;
    onOpen(shelfFor("ask", { name: words }));
    setAsk("");
  }

  return (
    <section className="browse" aria-label="Browse quotes">
      <div className="browse__head">
        <h2 className="browse__title">Browse quotes</h2>
        <div className="seg" role="tablist" aria-label="Browse by">
          {FACETS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={facet === f.key}
              className={"seg-btn" + (facet === f.key ? " active" : "")}
              onClick={() => setFacet(f.key)}
            >
              {f.key === "person" ? <Users size={12} /> : f.key === "theme" ? <Tag size={12} /> : <Heart size={12} />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {facet === "person" && (
        <div className="browse__people">
          {PEOPLE.map((p) => {
            const shelf = shelfFor("person", p);
            return <PersonTile key={p.name} person={p} yours={yours(shelf)} onOpen={() => onOpen(shelf)} />;
          })}
          {others.map((p) => (
            <PersonTile key={p.name} person={p} yours={p.count} onOpen={() => onOpen(shelfFor("person", p))} />
          ))}
        </div>
      )}

      {facet === "theme" && (
        <div className="browse__themes">
          {THEMES.map((t, i) => {
            const shelf = shelfFor("theme", t);
            return <ThemeTile key={t.name} item={t} index={i} cover={cover(shelf)} yours={yours(shelf)} onOpen={() => onOpen(shelf)} />;
          })}
        </div>
      )}

      {facet === "mood" && (
        <div className="browse__moods">
          {MOODS.map((m, i) => {
            const shelf = shelfFor("mood", m);
            return (
              <button key={m.name} type="button" className={`mood-tile mood-tile--${i % 5}`} onClick={() => onOpen(shelf)}>
                <span className="mood-tile__feel">Feeling</span>
                <span className="mood-tile__name">{m.name.toLowerCase()}</span>
                <Yours count={yours(shelf)} />
              </button>
            );
          })}
        </div>
      )}

      <form className="browse__ask" onSubmit={submitAsk}>
        <Search size={15} aria-hidden="true" />
        <input
          className="input"
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          placeholder="Or find quotes about anything: patience with kids, starting a business…"
          aria-label="Find quotes about"
          maxLength={80}
          enterKeyHint="search"
        />
        <button type="submit" className="btn btn--sm btn--accent" disabled={ask.trim().length < 2}>
          Find
        </button>
      </form>
    </section>
  );
}

// "3 of yours": how many of your own notes are on a shelf.
function Yours({ count }) {
  if (!count) return null;
  return <span className="yours-count">{count} of yours</span>;
}

// One of the Board's people, or someone your notes quote (no `wiki`, so
// their initials stand in for a photo).
function PersonTile({ person, yours, onOpen }) {
  const photo = useWikiPhoto(person.wiki ?? null);
  const [failed, setFailed] = useState(false);
  return (
    <button type="button" className="person-tile" onClick={onOpen}>
      <span className="person-tile__photo">
        {photo && !failed ? (
          <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
        ) : (
          <span className="person-tile__initials">{initials(person.name)}</span>
        )}
      </span>
      <span className="person-tile__name">{person.name}</span>
      <span className="person-tile__kind">
        {person.kind === "church" ? "Church leader" : person.kind === "historical" ? "History" : "From your notes"}
      </span>
      <Yours count={yours} />
    </button>
  );
}

function ThemeTile({ item, index, cover, yours, onOpen }) {
  const [failed, setFailed] = useState(false);
  return (
    <button type="button" className={`theme-tile theme-tile--${index % 6}` + (cover && !failed ? " has-cover" : "")} onClick={onOpen}>
      {cover && !failed && <img className="theme-tile__cover" src={cover} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
      <span className="theme-tile__name">{item.name}</span>
      <Yours count={yours} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// One shelf, open.
// ---------------------------------------------------------------------------

// A shelf shows the quotes found for you, your own notes filed on it, or
// both, the way you choose: All, For you, From you.
const VIEWS = [
  { key: "all", label: "All" },
  { key: "found", label: "For you" },
  { key: "mine", label: "From you" },
];

export function ShelfView({ userId, shelf, notes, sorting, onBack, onSaved, onOpenNote, onNotesChanged }) {
  const person = shelf.facet === "person" ? PEOPLE.find((p) => shelfFor("person", p).key === shelf.key) : null;
  const photo = useWikiPhoto(person?.wiki ?? null);
  const withNotes = holdsNotes(shelf);
  const mine = useMemo(() => (withNotes ? notesOnShelf(notes, shelf.key) : []), [withNotes, notes, shelf.key]);
  // Someone only your notes quote opens on your notes; the web is asked for
  // their quotes only if you look.
  const [view, setView] = useState(() => (shelf.facet === "person" && !person ? "mine" : "all"));
  const s = useShelf(userId, shelf, { auto: view !== "mine" });

  function changed(quote) {
    s.replace(quote);
    onSaved?.(quote);
  }

  const eyebrow = { person: "Quotes by", theme: "On", mood: "For when you're feeling", ask: "Quotes about", top: "This week" }[shelf.facet];
  const showQuotes = view !== "mine";
  const showNotes = withNotes && view !== "found";
  const items = interleave(
    showQuotes ? s.quotes.map((q) => ({ kind: "quote", id: q.id, quote: q })) : [],
    showNotes ? mine.map((n) => ({ kind: "note", id: n.id, note: n })) : []
  );

  return (
    <div className="shelf">
      <div className="shelf__bar">
        <button type="button" className="btn btn--sm btn--ghost" onClick={onBack}>
          <ChevronLeft size={15} />
          Board
        </button>
      </div>

      <header className={"shelf__head" + (photo ? " has-photo" : "")}>
        {photo && <img className="shelf__face" src={photo} alt="" referrerPolicy="no-referrer" />}
        <div>
          <p className="shelf__eyebrow">{eyebrow}</p>
          <h1 className="shelf__title">{shelf.facet === "mood" ? shelf.label.toLowerCase() : shelf.label}</h1>
          {shelf.facet !== "person" && shelf.facet !== "ask" && shelf.hint && <p className="shelf__hint">{shelf.hint}</p>}
        </div>
      </header>

      {withNotes && (
        <div className="seg shelf__views" role="tablist" aria-label="Show">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={view === v.key}
              className={"seg-btn" + (view === v.key ? " active" : "")}
              onClick={() => setView(v.key)}
            >
              {v.label}
              {v.key === "mine" && mine.length > 0 && <span className="seg-count">{mine.length}</span>}
            </button>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="shelf__grid">
          {items.map((item) => (
            <div key={item.id} className="print-slot">
              {item.kind === "quote" ? (
                <QuoteCard quote={item.quote} variant="shelf" onChange={changed} />
              ) : (
                <PaperNote note={item.note} onOpen={onOpenNote} onChanged={onNotesChanged} />
              )}
            </div>
          ))}
          {showQuotes && s.quotes.length > 0 && s.state === "pending" && (
            <div className="print-slot">
              <WaitingPrint label="Finding more…" />
            </div>
          )}
        </div>
      )}

      {view === "mine" && mine.length === 0 && <MineEmpty shelf={shelf} sorting={sorting} />}

      {showQuotes && s.quotes.length === 0 && (s.state === "failed" || s.loadError) && (
        <ShelfTrouble error={s.error ?? s.loadError} onRetry={s.loadError ? s.reload : s.retry} />
      )}

      {showQuotes && s.quotes.length === 0 && s.state !== "failed" && !s.loadError && (
        <div className="shelf__waiting">
          <p className="shelf__waiting-note">
            Looking up each quote in its talk or book, so the words are the real ones. The first time takes about a
            minute; after that this shelf opens at once.
          </p>
          <div className="shelf__grid">
            {[0, 1, 2].map((i) => (
              <div key={i} className="print-slot">
                <WaitingPrint />
              </div>
            ))}
          </div>
        </div>
      )}

      {showQuotes && s.quotes.length > 0 && (
        <div className="shelf__more">
          {s.state === "failed" && <span className="form-error">{friendlyError(s.error, "Couldn't find more.")}</span>}
          <button type="button" className="btn" onClick={s.state === "failed" ? s.retry : s.more} disabled={s.state === "pending"}>
            {s.state === "pending" ? <RotateCw size={14} className="spin" /> : <Plus size={14} />}
            {s.state === "pending" ? "Finding more…" : "Find more"}
          </button>
        </div>
      )}
    </div>
  );
}

// Nothing of yours on this shelf yet: what will put something here.
function MineEmpty({ shelf, sorting }) {
  const what = {
    person: `Quotes you write down from ${shelf.label}`,
    theme: `Thoughts you write about ${shelf.label.toLowerCase()}`,
    mood: `Notes that help when you're ${shelf.label.toLowerCase()}`,
  }[shelf.facet];
  return (
    <div className="shelf__mine-empty">
      <p className="empty">
        {sorting
          ? "Still sorting your notes onto the shelves. Yours will show up here as they're filed."
          : `Nothing of yours here yet. ${what} will show up here.`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function WaitingPrint({ label }) {
  return (
    <div className="qprint qprint--waiting" aria-hidden={!label}>
      <div className="qprint__photo" />
      <div className="qprint__line" />
      <div className="qprint__line qprint__line--short" />
      {label && <p className="qprint__wait-label">{label}</p>}
    </div>
  );
}

function ShelfTrouble({ error, onRetry }) {
  return (
    <div className="load-error" role="alert">
      <span>
        Couldn't find the quotes.
        <span className="load-error__why"> {friendlyError(error, "")}</span>
      </span>
      <button type="button" className="btn btn--sm" onClick={onRetry}>
        <RotateCw size={13} />
        Try again
      </button>
    </div>
  );
}
