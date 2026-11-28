import { createContext, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, FolderPlus, Plus, Check, Shuffle, Pencil, Trash2, Layers } from "lucide-react";
import Sheet from "../ascent/Sheet";
import { initials } from "../../lib/quotes";
import { collectionsOf, suggestCollection } from "../../lib/collections";
import ShareQuote from "./ShareQuote";
import "../../styles/collections.css";

// The Board's collections (Aaron, 2026-11-27): collections he names and
// fills, a "To sort" tray where new saves wait, and one quote a day drawn
// from the collections he pins to Today.
//
// The Board page owns the data and the actions and hands them down through
// this context, so a print or a card anywhere on the Board can offer
// "Collections" without threading props through the cork.
const BoardCollections = createContext(null);
export const CollectionsProvider = BoardCollections.Provider;
export function useBoardCollections() {
  return useContext(BoardCollections);
}

// --- today's draw ------------------------------------------------------------

export function TodayDraw({ quote, feeding, onAnother, poolSize }) {
  if (!quote) {
    return (
      <section className="draw draw--empty" aria-label="Today's quote">
        <span className="draw__tape" aria-hidden="true" />
        <p className="draw__from">Today</p>
        <p className="draw__hint">
          {feeding.length === 0
            ? "Open a collection and turn on “Draw Today's quote from it”. You'll get one of its quotes here each day."
            : "The collections feeding Today have no quotes in them yet."}
        </p>
      </section>
    );
  }
  return (
    <section className="draw" aria-label="Today's quote">
      <span className="draw__tape" aria-hidden="true" />
      <p className="draw__from">
        Today, from <em>{listNames(feeding.map((c) => c.name))}</em>
      </p>
      <blockquote className="draw__q">{quote.text}</blockquote>
      <div className="draw__foot">
        <span className="draw__who">{quote.author}</span>
        <span className="draw__acts">
          <ShareQuote quote={quote} className="btn btn--sm btn--ghost" />
          {poolSize > 1 && (
            <button type="button" className="btn btn--sm btn--on-page" onClick={onAnother}>
              <Shuffle size={14} aria-hidden="true" />
              Another
            </button>
          )}
        </span>
      </div>
    </section>
  );
}

function listNames(names) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// --- the To sort tray ----------------------------------------------------------

export function SortTray({ tray, filled }) {
  const api = useBoardCollections();
  const [leaving, setLeaving] = useState(null);
  const [naming, setNaming] = useState(false);
  const quote = tray[0] ?? null;
  const guess = useMemo(() => (quote ? suggestCollection(quote, filled) : null), [quote, filled]);

  if (!quote) return null;

  // The card slides off before it's gone, so a tap feels like filing it.
  function after(run) {
    setLeaving(quote.id);
    setTimeout(() => {
      setLeaving(null);
      run();
    }, 260);
  }

  return (
    <section className="tray" aria-label="To sort">
      <div className="tray__head">
        <h2 className="tray__title">To sort</h2>
        <span className="tray__count">
          {tray.length} new {tray.length === 1 ? "save" : "saves"}
        </span>
      </div>
      <figure className={"tray__card" + (leaving === quote.id ? " is-leaving" : "")} key={quote.id}>
        <blockquote className="tray__q">{quote.text}</blockquote>
        <figcaption className="tray__who">{quote.author}</figcaption>
      </figure>
      <div className="tray__chips" role="group" aria-label="File it in">
        {filled.map((c) => (
          <button
            key={c.id}
            type="button"
            className={"chip-dark" + (c.id === guess ? " is-guess" : "")}
            onClick={() => after(() => api.file(c.id, { quote_id: quote.id }, { fromTray: true }))}
          >
            {c.name}
          </button>
        ))}
        <button type="button" className="chip-dark chip-dark--new" onClick={() => setNaming(true)}>
          <Plus size={13} aria-hidden="true" />
          New
        </button>
        <button type="button" className="chip-dark chip-dark--loose" onClick={() => after(() => api.keepLoose(quote.id))}>
          Keep loose
        </button>
      </div>
      <p className="tray__note">
        {guess ? "Orange is my guess. One tap files it." : filled.length ? "No clear fit. File it anywhere, start a new collection, or keep it loose." : "Start a collection to file it in, or keep it loose."}
      </p>
      {naming &&
        createPortal(
          <NameSheet
            title="New collection"
            onClose={() => setNaming(false)}
            onSave={async (name) => {
              const c = await api.create(name);
              if (c) after(() => api.file(c.id, { quote_id: quote.id }, { fromTray: true }));
              return Boolean(c);
            }}
          />,
          document.body
        )}
    </section>
  );
}

// --- the stacks ----------------------------------------------------------------

export function CollectionStacks({ filled, onOpen }) {
  const api = useBoardCollections();
  const [naming, setNaming] = useState(false);
  return (
    <section className="cstacks-wrap" aria-label="Collections">
      <div className="cstacks-wrap__head">
        <h2 className="card-title">Collections</h2>
        <span className="cstacks-wrap__key">
          <span className="feeds-dot" aria-hidden="true" />
          feeds Today
        </span>
      </div>
      <div className="cstacks">
        {filled.map((c) => (
          <button key={c.id} type="button" className="cstack" onClick={() => onOpen(c.id)}>
            <Pile collection={c} />
            <span className="cstack__name">{c.name}</span>
            <span className="cstack__count">
              {c.feeds_today && <span className="feeds-dot" aria-label="Feeds Today" />}
              {c.entries.length} pinned
            </span>
          </button>
        ))}
        <div className="cstack">
          <button type="button" className="cstack__new" onClick={() => setNaming(true)}>
            <FolderPlus size={18} aria-hidden="true" />
            New collection
          </button>
          <span className="cstack__count">Name it, then add from anywhere</span>
        </div>
      </div>
      {naming && createPortal(<NameSheet title="New collection" onClose={() => setNaming(false)} onSave={async (name) => Boolean(await api.create(name))} />, document.body)}
    </section>
  );
}

function Pile({ collection }) {
  const top = collection.entries[0] ?? null;
  const [failed, setFailed] = useState(false);
  const image = top?.kind === "quote" ? top.quote.image_url : top?.note?.image_url;
  const label = top?.kind === "quote" ? initials(top.quote.author) : "";
  return (
    <span className="pile" aria-hidden="true">
      <span className="pile__sheet" />
      <span className="pile__sheet" />
      <span className="pile__sheet pile__sheet--top">
        <span className={"pile__pin" + (collection.feeds_today ? " is-feeding" : "")} />
        <span className="pile__photo">
          {image && !failed ? <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <span>{label}</span>}
        </span>
        <span className="pile__line" />
        <span className="pile__line pile__line--short" />
      </span>
    </span>
  );
}

// --- one collection open ---------------------------------------------------------

export function CollectionView({ collection, onBack, renderEntry }) {
  const api = useBoardCollections();
  const [naming, setNaming] = useState(false);
  return (
    <div className="stack collection-page">
      <div className="board-note__nav">
        <button type="button" className="btn btn--sm btn--ghost" onClick={onBack}>
          <ChevronLeft size={15} />
          Board
        </button>
      </div>
      <div className="collection-head">
        <h1 className="collection-head__name">{collection.name}</h1>
        <div className="collection-head__acts">
          <button type="button" className="btn btn--sm btn--on-page" onClick={() => setNaming(true)}>
            <Pencil size={14} aria-hidden="true" />
            Rename
          </button>
          <button type="button" className="btn-icon" onClick={() => api.remove(collection)} aria-label="Delete this collection" title="Delete this collection">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <label className="feeds-toggle">
        <button
          type="button"
          role="switch"
          className="switch"
          aria-checked={collection.feeds_today}
          onClick={() => api.update(collection.id, { feeds_today: !collection.feeds_today })}
        />
        <span>Draw Today's quote from this collection</span>
      </label>
      {collection.entries.length === 0 ? (
        <p className="cork__empty collection-empty">
          Nothing here yet. Tap “Collections” on any quote or thought on the Board to put it here.
        </p>
      ) : (
        <div className="cork collection-cork">
          <div className="cork__items">
            {collection.entries.map((e) => (
              <div key={e.kind + e.id} className="print-slot">
                {renderEntry(e)}
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="collection-foot">
        {collection.entries.length} pinned · a quote or thought can sit in more than one collection
      </p>
      {naming &&
        createPortal(
          <NameSheet
            title="Rename collection"
            initial={collection.name}
            onClose={() => setNaming(false)}
            onSave={async (name) => Boolean(await api.update(collection.id, { name }))}
          />,
          document.body
        )}
    </div>
  );
}

// --- "Collections" on a print or a card ------------------------------------------

// `target` is { quote_id } or { note_id }. Shows nothing until collections
// have loaded (or off the Board, where there's no provider).
export function CollectionsButton({ target, className = "qprint__save" }) {
  const api = useBoardCollections();
  const [open, setOpen] = useState(false);
  if (!api) return null;
  const count = collectionsOf(api.items, target).size;
  return (
    <>
      <button
        type="button"
        className={className + (count ? " is-filed" : "")}
        onClick={() => setOpen(true)}
        title="Put it in a collection"
        aria-label={count ? `In ${count} ${count === 1 ? "collection" : "collections"}` : "Put it in a collection"}
      >
        <Layers size={13} aria-hidden="true" />
        {className === "qprint__save" ? (count ? `In ${count}` : "Collections") : null}
      </button>
      {open && createPortal(<PickSheet target={target} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function PickSheet({ target, onClose }) {
  const api = useBoardCollections();
  const [naming, setNaming] = useState(false);
  const inSet = collectionsOf(api.items, target);
  const what = target.quote_id ? "quote" : "thought";
  return (
    <Sheet title={`Put this ${what} in`} onClose={onClose}>
      <div className="pick-list">
        {api.collections.length === 0 && <p className="empty">No collections yet. Start one below.</p>}
        {api.collections.map((c) => {
          const on = inSet.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              className="pick-row"
              role="checkbox"
              aria-checked={on}
              onClick={() => (on ? api.unfile(c.id, target) : api.file(c.id, target))}
            >
              <span className={"pick-box" + (on ? " is-on" : "")} aria-hidden="true">
                {on && <Check size={14} />}
              </span>
              {c.name}
            </button>
          );
        })}
        {naming ? (
          <NameForm
            onCancel={() => setNaming(false)}
            onSave={async (name) => {
              const c = await api.create(name);
              if (c) await api.file(c.id, target);
              setNaming(false);
              return Boolean(c);
            }}
          />
        ) : (
          <button type="button" className="pick-row pick-row--new" onClick={() => setNaming(true)}>
            <span className="pick-box" aria-hidden="true">
              <Plus size={14} />
            </span>
            New collection…
          </button>
        )}
      </div>
      <div className="pick-done">
        <button type="button" className="btn btn--accent" onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  );
}

function NameSheet({ title, initial = "", onClose, onSave }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <NameForm
        initial={initial}
        onCancel={onClose}
        onSave={async (name) => {
          const ok = await onSave(name);
          if (ok) onClose();
          return ok;
        }}
      />
    </Sheet>
  );
}

function NameForm({ initial = "", onSave, onCancel }) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const clean = name.trim();
  return (
    <form
      className="name-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!clean || busy) return;
        setBusy(true);
        try {
          await onSave(clean);
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        className="input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Closer to Christ"
        aria-label="Collection name"
        maxLength={60}
        autoFocus
        enterKeyHint="done"
      />
      <div className="name-form__acts">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--accent" disabled={!clean || busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
