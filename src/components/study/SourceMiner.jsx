import { useCallback, useEffect, useState } from "react";
import { Pickaxe, Check, X, ChevronRight, Sparkles, FileText, ArrowRight, Moon, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchMiningStats,
  fetchUnminedSources,
  mineSource,
  acceptSnippet,
  markSourceMined,
  fetchUnreviewedCards,
  markCardsReviewed,
  deleteNote,
} from "../../lib/api";
import { KindChip } from "./KindChip";
import { kindOf } from "../../lib/noteKinds";

// Working through the vault.
//
// Sixty-eight morning study notes are sixty-eight things you'll never reread.
// This reads one at a time and proposes the two-to-six lines actually worth
// keeping; you take the ones that are right and the rest are forgotten. What
// you accept becomes a card — indistinguishable afterwards from one you
// highlighted by hand — and the curator can start choosing from it.
//
// One note per press, never a bulk run over all of them. Sixty-eight
// unreviewed cards would be a worse pile than the one you started with.
export default function SourceMiner({ onChanged }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [result, setResult] = useState(null);
  const [taken, setTaken] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [overnight, setOvernight] = useState([]);

  const load = useCallback(async () => {
    try {
      const [s, q, o] = await Promise.all([
        fetchMiningStats(),
        fetchUnminedSources(25),
        fetchUnreviewedCards(30).catch(() => []),
      ]);
      setStats(s);
      setQueue(q);
      setOvernight(o);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function mine(source) {
    setLoading(true);
    setError(null);
    setResult(null);
    setTaken(new Set());
    setCurrent(source);
    try {
      setResult(await mineSource(source.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function take(snippet, index) {
    try {
      await acceptSnippet(user.id, current, snippet);
      setTaken((prev) => new Set(prev).add(index));
      await onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  }

  async function finish() {
    await markSourceMined(current.id, taken.size);
    setCurrent(null);
    setResult(null);
    setTaken(new Set());
    await load();
    await onChanged?.();
  }

  const remaining = stats ? Number(stats.sources) - Number(stats.mined) : 0;

  if (stats && Number(stats.sources) === 0 && overnight.length === 0) return null;

  return (
    <>
      {overnight.length > 0 && (
        <Overnight
          cards={overnight}
          onDone={async (keepIds, dropIds) => {
            for (const id of dropIds) await deleteNote(id).catch(() => {});
            await markCardsReviewed(keepIds);
            await load();
            await onChanged?.();
          }}
        />
      )}

    <div className="card">
      <div className="card-head">
        <span className="card-title"><Pickaxe size={14} />What's in the vault</span>
        {stats && (
          <span className="mono faint" style={{ fontSize: 11.5 }}>
            {stats.mined}/{stats.sources} read · {stats.cards_from_sources} kept
          </span>
        )}
      </div>

      {!current && (
        <>
          <p className="card-note" style={{ marginBottom: 14 }}>
            {remaining > 0 ? (
              <>
                {remaining} long {remaining === 1 ? "note" : "notes"} from your morning study haven't been read for
                keepable lines yet. One at a time — it proposes what's worth keeping, you decide.
              </>
            ) : (
              <>Every long note has been read through. New ones will appear here as they sync.</>
            )}
          </p>

          {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}

          {queue.slice(0, 6).map((s) => (
            <button
              key={s.id}
              onClick={() => mine(s)}
              disabled={loading}
              className="row"
              style={{
                gap: 10,
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "1px solid var(--line)",
                borderRadius: "var(--r)",
                padding: "10px 12px",
                marginBottom: 6,
                color: "inherit",
              }}
            >
              <FileText size={13} style={{ color: "var(--text-3)", flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="truncate" style={{ display: "block", fontSize: 13, fontWeight: 550 }}>{s.title}</span>
                <span className="mono faint" style={{ fontSize: 10.5 }}>
                  {s.studied_on ?? "undated"}
                  {s.source_ref ? ` · ${s.source_ref}` : ""} · {Math.round(s.body_length / 100) / 10}k chars
                </span>
              </span>
              <ChevronRight size={14} style={{ color: "var(--text-3)", flexShrink: 0 }} />
            </button>
          ))}

          {queue.length > 6 && (
            <p className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>
              {queue.length - 6} more behind these, oldest first.
            </p>
          )}
        </>
      )}

      {current && (
        <>
          <div className="row row--between" style={{ marginBottom: 12, gap: 10 }}>
            <span className="truncate" style={{ fontSize: 13.5, fontWeight: 600 }}>{current.title}</span>
            <button className="btn-link" onClick={() => { setCurrent(null); setResult(null); }}>
              <X size={12} />
              Back
            </button>
          </div>

          {loading && <p className="empty">Reading it for what's worth keeping…</p>}
          {error && <div className="form-error">{error}</div>}

          {result && result.snippets.length === 0 && (
            <>
              <p className="empty" style={{ marginBottom: 12 }}>
                Nothing in this one stands on its own. That's a real answer — most study notes are working-out, and
                keeping a line that only makes sense in place would just move the clutter.
              </p>
              <button className="btn" onClick={finish}>
                <Check size={14} />
                Mark it read, keep nothing
              </button>
            </>
          )}

          {result && result.snippets.length > 0 && (
            <>
              <p className="card-note" style={{ marginBottom: 12 }}>
                {result.snippets.length} {result.snippets.length === 1 ? "passage" : "passages"} worth keeping.
                Take the ones that are right; the rest are forgotten.
                {result.dropped > 0 && (
                  <span className="faint"> ({result.dropped} dropped for not matching the note exactly.)</span>
                )}
              </p>

              {result.snippets.map((s, i) => {
                const kind = kindOf(s.kind);
                const isTaken = taken.has(i);
                return (
                  <div
                    key={i}
                    style={{
                      border: `1px solid ${isTaken ? kind.color : "var(--line)"}`,
                      borderRadius: "var(--r)",
                      padding: 13,
                      marginBottom: 8,
                      background: isTaken ? `${kind.color}12` : "transparent",
                    }}
                  >
                    <div className="row row--between" style={{ marginBottom: 8, gap: 8 }}>
                      <KindChip value={s.kind} size="sm" />
                      {isTaken && (
                        <span className="row" style={{ gap: 5, fontSize: 11.5, color: kind.color }}>
                          <Check size={12} />
                          Kept
                        </span>
                      )}
                    </div>

                    <blockquote
                      className="prose prose--sm"
                      style={{ margin: "0 0 9px", paddingLeft: 11, borderLeft: `2px solid ${kind.color}66`, color: "var(--text-2)" }}
                    >
                      {s.quote}
                    </blockquote>

                    <div className="prose" style={{ fontSize: 14, marginBottom: 8 }}>{s.essence}</div>

                    <div className="row row--between" style={{ gap: 10, flexWrap: "wrap" }}>
                      <span className="faint row" style={{ fontSize: 11.5, gap: 5, minWidth: 0 }}>
                        <Sparkles size={11} style={{ flexShrink: 0 }} />
                        <span className="truncate">{s.why}</span>
                      </span>
                      {!isTaken && (
                        <button className="btn btn--accent" style={{ padding: "6px 12px", fontSize: 12.5 }} onClick={() => take(s, i)}>
                          <Check size={13} />
                          Keep it
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              <button className="btn btn--block" onClick={finish} style={{ marginTop: 4 }}>
                {taken.size > 0 ? `Done — kept ${taken.size}` : "Done — kept nothing"}
                <ArrowRight size={14} />
              </button>
            </>
          )}
        </>
      )}
    </div>
    </>
  );
}

// What the nightly run kept while you were asleep.
//
// These are already on the shelf and already usable by the curator — this is
// only the short pass so nothing arrives unseen. Drop is a real delete,
// because a card you have looked at and rejected should not linger.
function Overnight({ cards, onDone }) {
  const [dropped, setDropped] = useState(() => new Set());

  function toggle(id) {
    setDropped((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const keeping = cards.filter((c) => !dropped.has(c.id));

  return (
    <div className="card card--accent" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <span className="card-title"><Moon size={14} />Kept from your vault overnight</span>
        <span className="mono faint" style={{ fontSize: 11.5 }}>{cards.length}</span>
      </div>
      <p className="card-note" style={{ marginBottom: 14 }}>
        Mined from your study notes while you slept. They're already in play — mark the ones that shouldn't have been
        kept and they'll go.
      </p>

      {cards.map((c) => {
        const kind = kindOf(c.note_kind);
        const isDropped = dropped.has(c.id);
        return (
          <div
            key={c.id}
            style={{
              border: `1px solid ${isDropped ? "var(--line)" : `${kind.color}55`}`,
              borderRadius: "var(--r)",
              padding: 12,
              marginBottom: 7,
              opacity: isDropped ? 0.45 : 1,
              background: isDropped ? "transparent" : `${kind.color}0f`,
            }}
          >
            <div className="row row--between" style={{ gap: 10, marginBottom: 7 }}>
              <KindChip value={c.note_kind} size="sm" />
              <button
                className="btn-icon"
                onClick={() => toggle(c.id)}
                title={isDropped ? "Keep it after all" : "Drop this one"}
                style={{ width: 26, height: 26, color: isDropped ? "var(--accent)" : "var(--text-3)" }}
              >
                {isDropped ? <ArrowRight size={13} /> : <Trash2 size={13} />}
              </button>
            </div>
            <div className="prose prose--sm" style={{ textDecoration: isDropped ? "line-through" : "none" }}>
              {c.essence || c.excerpt}
            </div>
            {c.source_ref && <div className="mono faint" style={{ fontSize: 10.5, marginTop: 6 }}>{c.source_ref}</div>}
          </div>
        );
      })}

      <button
        className="btn btn--accent btn--block"
        style={{ marginTop: 4 }}
        onClick={() => onDone(keeping.map((c) => c.id), [...dropped])}
      >
        <Check size={14} />
        {dropped.size > 0 ? `Keep ${keeping.length}, drop ${dropped.size}` : `Keep all ${cards.length}`}
      </button>
    </div>
  );
}
