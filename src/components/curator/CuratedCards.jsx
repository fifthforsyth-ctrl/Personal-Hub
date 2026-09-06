import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, RefreshCw, Check, MessageSquare } from "lucide-react";
import { fetchDailySelection, runCurator, scoreSelectionItem, signedImageUrl, markNoteSurfaced } from "../../lib/api";
import { kindOf } from "../../lib/noteKinds";
import { todayStr } from "../../lib/planDates";

// What the curator chose for today, and what you thought of it.
//
// Each card shows the REASON it was picked, not just the card — that's the
// part you're actually rating. A pick you can't see the logic of is a pick you
// can't correct, and correcting it is the whole mechanism by which this gets
// better.
export default function CuratedCards({ slot, date = todayStr(), title, compact = false }) {
  const [selection, setSelection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSelection(await fetchDailySelection(date));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  // The fallback. The midnight job normally has this done before you look; if
  // it didn't run — a failed deploy, a paused project, a brand new account —
  // the first open of the day quietly does it instead of showing nothing.
  useEffect(() => {
    if (loading || running || selection || date !== todayStr()) return;
    let cancelled = false;
    (async () => {
      setRunning(true);
      try {
        await runCurator(date);
        if (!cancelled) await load();
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setRunning(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, running, selection, date, load]);

  const items = useMemo(
    () => (selection?.items ?? []).filter((i) => i.slot === slot).sort((a, b) => a.position - b.position),
    [selection, slot]
  );

  async function recurate() {
    setRunning(true);
    setError(null);
    try {
      await runCurator(date);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  if (running && items.length === 0) {
    return (
      <div className="card">
        <div className="card-head"><span className="card-title"><Sparkles size={14} />{title}</span></div>
        <p className="empty">Reading where you're at and choosing what fits…</p>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    if (error) return <div className="form-error">{error}</div>;
    return null;
  }

  return (
    <div className="stack stack--tight">
      <div className="row row--between" style={{ gap: 10 }}>
        <span className="card-title"><Sparkles size={14} style={{ color: "var(--accent)" }} />{title}</span>
        <button className="btn-link" onClick={recurate} disabled={running} title="Choose again">
          <RefreshCw size={12} />
          {running ? "Choosing…" : "Choose again"}
        </button>
      </div>

      {/* The curator's read of the situation — one line, so you can tell
          straight away whether it understood the week you actually had. */}
      {selection?.situation && !compact && (
        <p className="card-note" style={{ marginBottom: 2 }}>{selection.situation}</p>
      )}

      {error && <div className="form-error">{error}</div>}

      {items.map((item) => (
        <CuratedCard key={item.id} item={item} onScored={load} compact={compact} />
      ))}
    </div>
  );
}

export function CuratedCard({ item, onScored, compact }) {
  const note = item.note ?? {};
  const kind = kindOf(note.note_kind);
  const [imageUrl, setImageUrl] = useState(null);
  const [scoring, setScoring] = useState(false);
  const [feedback, setFeedback] = useState(item.feedback ?? "");
  const [pending, setPending] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (note.image_path) {
      signedImageUrl(note.image_path).then((u) => !cancelled && setImageUrl(u));
    }
    return () => {
      cancelled = true;
    };
  }, [note.image_path]);

  async function submitScore(score, withFeedback) {
    await scoreSelectionItem(item.id, score, withFeedback ? feedback : null);
    setScoring(false);
    await onScored();
  }

  const text = note.essence || note.body || note.excerpt || "";

  return (
    <div
      className="card"
      style={{
        borderColor: `${kind.color}44`,
        background: `linear-gradient(180deg, ${kind.color}12, transparent 55%), var(--card)`,
        padding: 0,
        overflow: "hidden",
      }}
    >
      {/* A quote with a picture is the one place an image earns its keep —
          it's what makes the thing land before you've read a word.
          Capped in pixels rather than by aspect ratio: on a wide desktop card
          a 21:9 band becomes 500px of gradient and shoves the words off the
          screen, which is the opposite of the point. */}
      {imageUrl && (
        <div style={{ position: "relative", width: "100%", height: compact ? 150 : 190, overflow: "hidden" }}>
          <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 35%, rgba(10,10,12,0.92))" }} />
        </div>
      )}

      <div style={{ padding: 16 }}>
        <div className="row row--between" style={{ marginBottom: 9, gap: 10 }}>
          <span className="chip" style={{ borderColor: `${kind.color}55`, background: `${kind.color}18`, color: "var(--text)" }}>
            <span className="dot" style={{ background: kind.color, width: 6, height: 6 }} />
            {kind.short}
          </span>
          {note.created_at && (
            <span className="mono faint" style={{ fontSize: 10.5 }}>
              {new Date(note.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
        </div>

        <div className="prose" style={{ fontSize: compact ? 14.5 : 15.5, marginBottom: 10 }}>{text}</div>

        {note.excerpt && note.body?.trim() && (
          <blockquote
            className="prose prose--sm"
            style={{ margin: "0 0 10px", paddingLeft: 11, borderLeft: `2px solid ${kind.color}66`, color: "var(--text-2)", fontStyle: "italic" }}
          >
            {note.excerpt}
          </blockquote>
        )}

        {/* Why this, today. */}
        <div
          className="row"
          style={{ gap: 8, alignItems: "flex-start", padding: "9px 11px", background: "var(--inset)", borderRadius: "var(--r)", marginBottom: 12 }}
        >
          <Sparkles size={12} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
          <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.55 }}>{item.reason}</span>
        </div>

        <div className="row row--between" style={{ gap: 10, flexWrap: "wrap" }}>
          {item.score ? (
            <span className="row" style={{ gap: 6, fontSize: 12, color: "var(--accent)" }}>
              <Check size={13} />
              You scored this {item.score}/10
              <button className="btn-link" style={{ marginLeft: 4 }} onClick={() => setScoring(true)}>change</button>
            </span>
          ) : (
            <button className="btn-link" onClick={() => setScoring((v) => !v)}>
              {scoring ? "Never mind" : "How well did this fit?"}
            </button>
          )}
          <Link
            to={`/study?note=${note.id}`}
            className="btn-link"
            onClick={() => markNoteSurfaced(note.id).catch(() => {})}
          >
            Open it
            <ArrowRight size={12} />
          </Link>
        </div>

        {scoring && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>How well did this apply to you today?</div>
            <div className="row" style={{ gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onMouseEnter={() => setPending(n)}
                  onMouseLeave={() => setPending(null)}
                  onClick={() => submitScore(n, Boolean(feedback.trim()))}
                  className="mono"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "var(--r-sm)",
                    border: `1px solid ${(pending ?? item.score ?? 0) >= n ? "var(--accent)" : "var(--line)"}`,
                    background: (pending ?? item.score ?? 0) >= n ? "var(--accent-soft)" : "var(--inset)",
                    color: (pending ?? item.score ?? 0) >= n ? "var(--accent)" : "var(--text-2)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <MessageSquare size={13} style={{ color: "var(--text-3)", flexShrink: 0 }} />
              <input
                className="input"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Why? (optional — this is what teaches it)"
                style={{ fontSize: 13 }}
              />
            </div>
            <p className="faint" style={{ fontSize: 11, marginTop: 8 }}>
              Press a number to save. Your notes here are read by the curator next time — a low score with a reason is
              the most useful thing you can give it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
