import { useRef, useState } from "react";
import { Library, Check, ChevronRight, ChevronDown, ChevronLeft, Sparkles, FileText, Moon } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import { useLoad } from "../../lib/useLoad";
import {
  fetchMiningStats,
  fetchUnminedSources,
  mineSource,
  acceptSnippet,
  markSourceMined,
  fetchUnreviewedCards,
  markCardsReviewed,
} from "../../lib/api";
import { KindChip } from "./KindChip";
import { cutAtWord } from "../../lib/markdown";
import { dayLabel } from "./dayLabel";

// From the vault: the long study notes, read for the lines worth keeping.
//
// One row on the Board until you open it, because this is the machinery and
// your own notes come first. Inside are two jobs:
//
// - What the nightly reading kept. Those cards stay off the Board until
//   you've looked at them; keep or drop each and they move on.
// - The long notes nobody has read through yet. One at a time: it proposes
//   the two-to-six lines worth keeping, you take the ones that are right, and
//   the rest are forgotten. What you take becomes a card, the same as one you
//   highlighted by hand.
//
// `waiting` is how many overnight cards are still unseen (the page counts
// them from the whole shelf; this only fetches a batch). `hidden` holds notes
// deleted and waiting out their Undo, so a dropped card doesn't reappear.
export default function SourceMiner({ waiting = null, hidden, onChanged, onDrop }) {
  const [open, setOpen] = useState(false);
  const { data, error, loading, reload } = useLoad(loadVault, []);

  const stats = data?.stats;
  const remaining = stats ? Math.max(0, Number(stats.sources) - Number(stats.mined)) : 0;
  const overnight = (data?.overnight ?? []).filter((c) => !hidden?.has(c.id));
  const unseen = Math.max(waiting ?? 0, overnight.length);

  if (data && Number(stats.sources) === 0 && unseen === 0) return null;

  const parts = [];
  if (unseen > 0) parts.push(`${unseen} ${unseen === 1 ? "line" : "lines"} kept overnight to look over`);
  if (remaining > 0) parts.push(`${remaining} long ${remaining === 1 ? "note" : "notes"} not read yet`);
  const sub = loading
    ? "Loading…"
    : error && !data
      ? "Couldn't load what's waiting."
      : parts.length > 0
        ? parts.join(" · ")
        : "Everything from your vault has been read and looked over.";

  return (
    <section className="card board-vault">
      <button type="button" className="board-vault__toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Library size={18} className="board-vault__icon" aria-hidden="true" />
        <span className="board-vault__text">
          <span className="board-vault__title">
            From the vault{unseen + remaining > 0 ? ` (${unseen + remaining})` : ""}
          </span>
          <span className="board-vault__sub">{sub}</span>
        </span>
        {open ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
      </button>

      {open && (
        <div className="board-vault__body">
          {error && !data ? (
            <LoadError what="the vault" error={error} onRetry={reload} />
          ) : !data ? (
            <p className="empty">Loading…</p>
          ) : (
            <>
              {error && <LoadError stale error={error} onRetry={reload} />}
              {overnight.length > 0 && (
                <div className="board-vault__section">
                  <Overnight
                    key={overnight.map((c) => c.id).join()}
                    cards={overnight}
                    more={Math.max(0, unseen - overnight.length)}
                    onDone={async () => {
                      await reload();
                      onChanged?.();
                    }}
                    onDrop={onDrop}
                  />
                </div>
              )}
              <div className="board-vault__section">
                <Reader
                  stats={stats}
                  remaining={remaining}
                  queue={data.queue}
                  onFinished={async () => {
                    await reload();
                    onChanged?.();
                  }}
                  onKept={onChanged}
                />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

async function loadVault() {
  const [stats, queue, overnight] = await Promise.all([fetchMiningStats(), fetchUnminedSources(25), fetchUnreviewedCards(30)]);
  return { stats, queue, overnight };
}

// The long notes not read through yet, and the one being read.
function Reader({ stats, remaining, queue, onFinished, onKept }) {
  const { user } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState(null);
  const [result, setResult] = useState(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState(null);
  const [taken, setTaken] = useState(() => new Set());
  const [taking, setTaking] = useState(() => new Set()); // in flight, per line
  const [finishing, setFinishing] = useState(false);
  const seq = useRef(0);

  async function read(source) {
    const mine = ++seq.current;
    setCurrent(source);
    setResult(null);
    setReadError(null);
    setTaken(new Set());
    setReading(true);
    try {
      const r = await mineSource(source.id);
      if (seq.current === mine) setResult(r);
    } catch (err) {
      if (seq.current === mine) setReadError(err);
    } finally {
      if (seq.current === mine) setReading(false);
    }
  }

  function back() {
    seq.current++; // a late answer for the note you left is dropped
    setCurrent(null);
    setResult(null);
    setReadError(null);
    setReading(false);
  }

  // One tap, one card: the line is busy until the answer is back, and the
  // database hands back the same card if the same line is kept twice anyway.
  async function take(snippet, index) {
    if (taking.has(index) || taken.has(index)) return;
    setTaking((prev) => new Set(prev).add(index));
    try {
      await acceptSnippet(user.id, current, snippet);
      setTaken((prev) => new Set(prev).add(index));
      onKept?.();
    } catch (err) {
      toast.error(err, "Couldn't keep that line. Try again.");
    } finally {
      setTaking((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  }

  async function finish() {
    if (finishing || taking.size > 0) return;
    setFinishing(true);
    try {
      await markSourceMined(current.id, taken.size);
      toast.show(taken.size > 0 ? `Kept ${taken.size} from “${cutAtWord(current.title, 40)}”` : "Marked as read");
      back();
      await onFinished();
    } catch (err) {
      toast.error(err, "Couldn't mark it read. Try again.");
    } finally {
      setFinishing(false);
    }
  }

  if (!current) {
    return (
      <>
        <div className="board-vault__label">
          <FileText size={14} />
          Not read yet
          {stats && (
            <span className="mono muted" style={{ fontSize: 11, fontWeight: 400, marginLeft: "auto" }}>
              {stats.mined} of {stats.sources} read
            </span>
          )}
        </div>
        <p className="card-note" style={{ marginBottom: 12 }}>
          {remaining > 0
            ? "Open one and it suggests the lines worth keeping. You decide which."
            : "Every long note has been read through. New ones show up here when they sync."}
        </p>
        {queue.slice(0, 6).map((s) => (
          <button key={s.id} type="button" className="board-source" onClick={() => read(s)}>
            <FileText size={14} style={{ color: "var(--text-3)", flexShrink: 0 }} aria-hidden="true" />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="truncate" style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{s.title}</span>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--text-2)" }}>
                {[s.source_ref, dayLabel(s.studied_on), `${Math.max(1, Math.round(s.body_length / 1000))}k characters`].filter(Boolean).join(" · ")}
              </span>
            </span>
            <ChevronRight size={15} style={{ color: "var(--text-3)", flexShrink: 0 }} aria-hidden="true" />
          </button>
        ))}
        {queue.length > 6 && (
          <p className="card-note" style={{ marginTop: 8 }}>
            {queue.length - 6} more after these, oldest first.
          </p>
        )}
      </>
    );
  }

  const snippets = result?.snippets ?? [];

  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 10, minWidth: 0 }}>
        <button type="button" className="btn btn--sm btn--ghost" onClick={back} disabled={finishing}>
          <ChevronLeft size={14} />
          Back
        </button>
        <span className="truncate" style={{ fontSize: 13.5, fontWeight: 620, flex: 1 }}>{current.title}</span>
      </div>

      {reading && <p className="empty">Reading it for what's worth keeping…</p>}

      {readError && (
        <LoadError what="suggestions for this note" error={readError} onRetry={() => read(current)} />
      )}

      {result && snippets.length === 0 && (
        <>
          <p className="card-note" style={{ marginBottom: 12 }}>
            Nothing in this one stands on its own. That's a real answer: most study notes are working-out, and a line
            that only makes sense in place would just move the clutter.
          </p>
          <button type="button" className="btn" onClick={finish} disabled={finishing}>
            <Check size={14} />
            {finishing ? "Saving…" : "Mark it read, keep nothing"}
          </button>
        </>
      )}

      {snippets.length > 0 && (
        <>
          <p className="card-note" style={{ marginBottom: 12 }}>
            {snippets.length} {snippets.length === 1 ? "line" : "lines"} worth keeping. Take the ones that are right; the
            rest are forgotten.
            {result.dropped > 0 && ` (${result.dropped} more didn't match the note word for word, so they were left out.)`}
          </p>

          {snippets.map((s, i) => {
            const isTaken = taken.has(i);
            const isTaking = taking.has(i);
            return (
              <div key={i} className={"board-snippet" + (isTaken ? " is-kept" : "")}>
                <div className="board-snippet__top">
                  <KindChip value={s.kind} size="sm" />
                  {isTaken && (
                    <span className="board-snippet__kept">
                      <Check size={13} />
                      Kept
                    </span>
                  )}
                </div>
                <blockquote className="board-quote">{s.quote}</blockquote>
                {s.essence && <div className="board-snippet__essence">{s.essence}</div>}
                <div className="board-snippet__foot">
                  {s.why && (
                    <span className="board-snippet__why">
                      <Sparkles size={12} aria-hidden="true" />
                      <span>{s.why}</span>
                    </span>
                  )}
                  {!isTaken && (
                    <button type="button" className="btn btn--accent btn--sm" onClick={() => take(s, i)} disabled={isTaking || finishing}>
                      <Check size={13} />
                      {isTaking ? "Keeping…" : "Keep it"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <button type="button" className="btn btn--block" onClick={finish} disabled={finishing || taking.size > 0} style={{ marginTop: 6 }}>
            {finishing ? "Saving…" : taken.size > 0 ? `Done, kept ${taken.size}` : "Done, kept nothing"}
          </button>
        </>
      )}
    </>
  );
}

// What the nightly reading kept while you were asleep: a short pass so
// nothing reaches the Board unseen. Drop goes through the page's Undo, since
// a card you've looked at and rejected should go, but not on one tap.
function Overnight({ cards, more, onDone, onDrop }) {
  const toast = useToast();
  const [dropped, setDropped] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  function toggle(id) {
    setDropped((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const keeping = cards.filter((c) => !dropped.has(c.id));

  async function done() {
    if (busy) return;
    setBusy(true);
    try {
      await markCardsReviewed(keeping.map((c) => c.id));
      if (dropped.size > 0) {
        onDrop([...dropped], keeping.length > 0 ? `${keeping.length} kept, ${dropped.size} dropped` : `${dropped.size} dropped`);
      } else {
        toast.show(`${keeping.length} kept`);
      }
      await onDone();
    } catch (err) {
      toast.error(err, "Couldn't save that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="board-vault__label">
        <Moon size={14} />
        Kept overnight
      </div>
      <p className="card-note" style={{ marginBottom: 12 }}>
        The nightly reading kept these from your study notes. They stay off the Board until you've looked them over.
        Drop any that shouldn't have been kept.
      </p>

      {cards.map((c) => {
        const isDropped = dropped.has(c.id);
        return (
          <div key={c.id} className={"board-overnight" + (isDropped ? " is-dropped" : "")}>
            <div className="board-overnight__top">
              <KindChip value={c.note_kind} size="sm" />
              <button
                type="button"
                className={"btn btn--sm" + (isDropped ? "" : " btn--ghost")}
                onClick={() => toggle(c.id)}
                aria-pressed={isDropped}
                disabled={busy}
              >
                {isDropped ? "Keep it" : "Drop"}
              </button>
            </div>
            <div className="board-overnight__text">{c.essence || c.excerpt || c.title}</div>
            {c.source_ref && <div className="board-overnight__ref">{c.source_ref}</div>}
          </div>
        );
      })}

      <button type="button" className="btn btn--accent btn--block" style={{ marginTop: 6 }} onClick={done} disabled={busy}>
        <Check size={14} />
        {busy ? "Saving…" : dropped.size > 0 ? `Keep ${keeping.length}, drop ${dropped.size}` : `Keep all ${cards.length}`}
      </button>
      {more > 0 && (
        <p className="card-note" style={{ marginTop: 8 }}>
          {more} more after these.
        </p>
      )}
    </>
  );
}
