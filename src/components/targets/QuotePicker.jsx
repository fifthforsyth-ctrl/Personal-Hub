import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Search, Sparkles } from "lucide-react";
import { fetchOwnQuotes, fetchQuoteLibrary, fetchShelf } from "../../lib/api";
import { askShelfFor, filterOwnQuotes, filterQuotes, pickerSections } from "../../lib/ladder";
import { topShelf } from "../../lib/quoteShelves";
import { initials, sourceLine } from "../../lib/quotes";
import { useLoad } from "../../lib/useLoad";
import Sheet from "../ascent/Sheet";
import LoadError from "../ui/LoadError";
import { useShelf } from "../board/useShelf";

// Linking quotes to a target: a search over every quote he has (the
// library, filtered on the phone), or his own written-down ones ("From
// you"). With nothing typed, the library shows in short sections: what's
// linked here, what's on his board, what he said applies, this week's top
// picks, the newest. A tap links one or takes it off at once, with a check
// for what's linked. "Find new quotes for this" asks the Board's shelf for
// this target, which looks each quote up (about a minute), and what it
// finds comes in at the top.
//
//   linkedQuotes, linkedNotes  ids of what's linked here
//   linkedOrder                the linked quotes' ids, in the target's order
//   onToggle(item, isNote)     link it, or unlink it if it's linked

const SHOWN = 80;
const NONE = [];
const WIDE = "(min-width: 901px)";

export default function QuotePicker({ userId, today, target, name, title, why, linkedQuotes, linkedNotes, linkedOrder, onToggle, onClose }) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("library");
  // A desk has a keyboard to type with at once; on a phone the keyboard
  // would cover the list before he's chosen to search.
  const [wide] = useState(() => typeof window !== "undefined" && Boolean(window.matchMedia?.(WIDE).matches));

  const library = useLoad(() => (userId ? fetchQuoteLibrary(userId) : null), [userId]);
  const ownOn = tab === "own";
  const [ownAsked, setOwnAsked] = useState(false);
  const own = useLoad(() => (userId && (ownOn || ownAsked) ? fetchOwnQuotes(userId) : null), [userId, ownOn || ownAsked]);
  // This week's top picks, for their section; quiet if they can't be read.
  const picks = useLoad(
    () => (userId ? fetchShelf(userId, topShelf(today).key).then((r) => r?.row?.quote_ids ?? []).catch(() => []) : []),
    [userId, today]
  );
  const shelfDef = useMemo(() => askShelfFor(target, title, why), [target, title, why]);
  const shelf = useShelf(userId, shelfDef, { auto: false });

  const q = query.trim();
  const lib = library.data ?? NONE;
  const found = shelf.quotes;
  const foundIds = useMemo(() => new Set(found.map((x) => x.id)), [found]);
  const sections = useMemo(
    () => (q ? [] : pickerSections(lib.filter((x) => !foundIds.has(x.id)), { linkedIds: linkedOrder, pickIds: picks.data ?? [] })),
    [q, lib, foundIds, linkedOrder, picks.data]
  );
  const hits = useMemo(() => (q ? filterQuotes(lib, q) : []), [q, lib]);
  const mine = useMemo(() => (q ? filterOwnQuotes(own.data ?? NONE, q) : own.data ?? NONE), [q, own.data]);

  const waiting = shelf.state === "pending";
  const failed = shelf.state === "failed" || Boolean(shelf.error);

  function findNew() {
    if (waiting) return;
    if (shelf.quotes.length) shelf.more();
    else shelf.retry();
  }

  const quoteRow = (x) => <PickRow key={x.id} item={quoteFace(x)} on={linkedQuotes.has(x.id)} onTap={() => onToggle(x, false)} />;

  return (
    <Sheet title={`Quotes for ${name}`} onClose={onClose}>
      <div className="tg-picker">
        <label className="tg-picker__search">
          <Search size={15} aria-hidden="true" />
          <input
            className="input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "own" ? "Search your own quotes" : "Search words, a name, a talk"}
            aria-label="Search quotes"
            autoFocus={wide}
            enterKeyHint="search"
          />
        </label>

        <div className="seg seg--block tg-picker__tabs" role="tablist" aria-label="Which quotes">
          {[
            ["library", "Library"],
            ["own", "From you"],
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={"seg-btn" + (tab === k ? " active" : "")}
              onClick={() => {
                setTab(k);
                if (k === "own") setOwnAsked(true);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "library" ? (
          <>
            {library.error && <LoadError what="your quotes" error={library.error} onRetry={library.reload} stale={Boolean(library.data)} />}
            {(found.length > 0 || waiting) && !q && (
              <section className="tg-picker__sec" aria-label="Found for this">
                <h3 className="tg-picker__h">Found for this</h3>
                {waiting && <p className="tg-quiet tg-picker__wait">Looking up each quote. About a minute.</p>}
                {found.length > 0 && <ul className="tg-picker__list">{found.map(quoteRow)}</ul>}
              </section>
            )}
            {!library.data && library.loading ? (
              <p className="tg-quiet">Loading your quotes…</p>
            ) : q ? (
              hits.length ? (
                <section className="tg-picker__sec" aria-label="Found">
                  <ul className="tg-picker__list">{hits.slice(0, SHOWN).map(quoteRow)}</ul>
                  {hits.length > SHOWN && <p className="tg-quiet">{hits.length - SHOWN} more. Add a word to narrow it.</p>}
                </section>
              ) : (
                <p className="tg-quiet">No quote in your library has those words.</p>
              )
            ) : sections.length ? (
              sections.map((s) => (
                <section key={s.key} className="tg-picker__sec" aria-label={s.title}>
                  <h3 className="tg-picker__h">{s.title}</h3>
                  <ul className="tg-picker__list">{s.quotes.map(quoteRow)}</ul>
                </section>
              ))
            ) : (
              library.data && <p className="tg-quiet">No quotes in your library yet. The Board finds them for you.</p>
            )}
          </>
        ) : (
          <>
            {own.error && <LoadError what="your own quotes" error={own.error} onRetry={own.reload} stale={Boolean(own.data)} />}
            {!own.data && own.loading ? (
              <p className="tg-quiet">Loading your own quotes…</p>
            ) : mine.length ? (
              <section className="tg-picker__sec" aria-label="Your own quotes">
                <ul className="tg-picker__list">
                  {mine.slice(0, SHOWN).map((n) => (
                    <PickRow key={n.id} item={noteFace(n)} on={linkedNotes.has(n.id)} onTap={() => onToggle(n, true)} />
                  ))}
                </ul>
                {mine.length > SHOWN && <p className="tg-quiet">{mine.length - SHOWN} more. Search to find the rest.</p>}
              </section>
            ) : (
              own.data && <p className="tg-quiet">{q ? "None of your own quotes has those words." : "Quotes you write down in Study show here."}</p>
            )}
          </>
        )}

        <div className="tg-picker__foot">
          {tab === "library" && (
            <button type="button" className="btn btn--sm btn--on-page" onClick={findNew} disabled={waiting}>
              <Sparkles size={14} aria-hidden="true" />
              {waiting ? "Finding quotes…" : "Find new quotes for this"}
            </button>
          )}
          {tab === "library" && failed && !waiting && <p className="form-error">Finding quotes stopped partway. Try again.</p>}
          {shelf.loadError && <p className="form-error">Couldn't read the quotes found for this.</p>}
          <Link to="/study" className="btn-link tg-picker__board">
            Browse the Board
          </Link>
        </div>
      </div>
    </Sheet>
  );
}

// A quote as a row: the picture (or initials), the words, who said them.
function quoteFace(x) {
  return { image: x.image_url ?? null, mark: initials(x.author), text: x.text, by: x.author, where: sourceLine(x) };
}

// One of his own: the words he wrote down, filed under whoever said them.
function noteFace(n) {
  const people = n.shelf_people ?? [];
  return {
    image: n.image_url ?? null,
    mark: initials(people[0] ?? n.title ?? ""),
    text: String(n.excerpt || n.essence || n.title || n.body || "").trim(),
    by: people[0] ?? "Your note",
    where: n.source_ref ?? "",
  };
}

function PickRow({ item, on, onTap }) {
  const [broken, setBroken] = useState(false);
  return (
    <li>
      <button type="button" className={"tg-qrow" + (on ? " is-on" : "")} aria-pressed={on} onClick={onTap}>
        <span className="tg-qrow__thumb" aria-hidden="true">
          {item.image && !broken ? <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} /> : <span>{item.mark}</span>}
        </span>
        <span className="tg-qrow__body">
          <span className="tg-qrow__text">{item.text}</span>
          <span className="tg-qrow__by">
            {item.by}
            {item.where ? <span className="tg-qrow__where"> · {item.where}</span> : null}
          </span>
        </span>
        <span className="tg-qrow__check" aria-hidden="true">
          {on && <Check size={16} />}
        </span>
      </button>
    </li>
  );
}
