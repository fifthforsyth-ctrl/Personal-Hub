import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, RefreshCw, Check, MessageSquare, RotateCw } from "lucide-react";
import { fetchDailySelection, runCurator, scoreSelectionItem, signedImageUrl, markNoteSurfaced } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { friendlyError, isOffline } from "../../lib/errors";
import LoadError from "../ui/LoadError";
import { kindOf } from "../../lib/noteKinds";
import { todayStr } from "../../lib/planDates";
import { useBackOnline } from "../today/useBackOnline";

// What the curator chose for today, and what you thought of it.
//
// Each card shows the REASON it was picked, not just the card: that's the
// part you're actually rating. A pick you can't see the logic of is a pick you
// can't correct, and correcting it is the whole mechanism by which this gets
// better.

// The fallback run. The midnight job normally has the cards chosen before
// you look; if it didn't (a failed deploy, a paused project, a brand new
// account) the first open of the day asks for them, and every card on screen
// waits on that one run. Once a run has gone through, the day is remembered
// on this device: a day with nothing worth picking stays empty rather than
// asking again on every visit. A run that failed is tried again the next time
// the app opens, not every time Today does.
const runs = new Map();

function ranKey(date) {
  return `hub.curator-ran.${date}`;
}

function ranBefore(date) {
  try {
    return localStorage.getItem(ranKey(date)) === "1";
  } catch (err) {
    console.warn(err);
    return false;
  }
}

function startRun(date) {
  const run = runCurator(date).then((result) => {
    try {
      localStorage.setItem(ranKey(date), "1");
    } catch (err) {
      console.warn(err);
    }
    return result;
  });
  runs.set(date, run);
  return run;
}

export default function CuratedCards({ slot, date = todayStr(), title, compact = false }) {
  const { data: selection, error: loadError, loading, reload } = useLoad(() => fetchDailySelection(date), [date]);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState(null);
  const waited = useRef(null);
  const shownDate = useRef(date);
  shownDate.current = date;
  useBackOnline(reload, Boolean(loadError));

  useEffect(() => {
    setRunning(false);
    setRunError(null);
  }, [date]);

  // Nothing chosen yet today: start the day's run, or wait on the one another
  // card already started, then look again. Once per card per day. Nothing
  // here cancels the wait (that's what once left this card saying "choosing"
  // for good); an answer for a day no longer on screen is just ignored.
  useEffect(() => {
    if (loading || loadError || selection || date !== todayStr() || waited.current === date) return;
    const run = runs.get(date) ?? (ranBefore(date) ? null : startRun(date));
    if (!run) return;
    waited.current = date;
    const still = () => shownDate.current === date;
    setRunning(true);
    run
      .then(
        () => still() && reload(),
        (err) => still() && setRunError(err)
      )
      .finally(() => still() && setRunning(false));
  }, [loading, loadError, selection, date, reload]);

  const items = useMemo(
    () => (selection?.items ?? []).filter((i) => i.slot === slot).sort((a, b) => a.position - b.position),
    [selection, slot]
  );

  async function recurate() {
    if (running) return;
    setRunning(true);
    setRunError(null);
    try {
      await startRun(date);
      await reload();
    } catch (err) {
      setRunError(err);
    } finally {
      setRunning(false);
    }
  }

  const head = (
    <span className="card-title"><Sparkles size={14} style={{ color: "var(--accent)" }} />{title}</span>
  );

  if (items.length === 0) {
    if (running) {
      return (
        <div className="card">
          <div className="card-head">{head}</div>
          <p className="empty">Reading where you're at and choosing what fits…</p>
        </div>
      );
    }
    if (runError) {
      return (
        <div className="load-error" role="alert">
          <span>
            Couldn't choose today's cards.
            <span className="load-error__why"> {friendlyError(runError, "")}</span>
          </span>
          <button type="button" className="btn btn--sm" onClick={recurate}>
            <RotateCw size={13} />
            Try again
          </button>
        </div>
      );
    }
    // Offline, the page above already says so; the cards come back with the
    // connection.
    if (loadError && !selection) return isOffline(loadError) ? null : <LoadError what="today's cards" error={loadError} onRetry={reload} />;
    // Nothing picked for this spot today: nothing to show.
    return null;
  }

  return (
    <div className="stack stack--tight">
      <div className="row row--between" style={{ gap: 10 }}>
        {head}
        <button className="btn-link curated__again" onClick={recurate} disabled={running} title="Ask the curator to choose again">
          <RefreshCw size={12} className={running ? "spin" : ""} />
          {running ? "Choosing…" : "Choose again"}
        </button>
      </div>

      {/* The curator's read of the situation: one line, so you can tell
          straight away whether it understood the week you actually had. */}
      {selection?.situation && !compact && <p className="card-note" style={{ marginBottom: 2 }}>{selection.situation}</p>}

      {runError && (
        <div className="form-error">Couldn't choose again. {friendlyError(runError, "")}</div>
      )}

      {items.map((item) => (
        <CuratedCard key={item.id} item={item} onScored={reload} compact={compact} />
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
  const [saving, setSaving] = useState(null);
  const [scoreError, setScoreError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (note.image_path) {
      signedImageUrl(note.image_path).then(
        (u) => !cancelled && setImageUrl(u),
        (err) => console.warn(err)
      );
    }
    return () => {
      cancelled = true;
    };
  }, [note.image_path]);

  async function submitScore(score) {
    if (saving) return;
    setSaving(score);
    setScoreError(null);
    try {
      await scoreSelectionItem(item.id, score, feedback.trim() ? feedback.trim() : null);
      setScoring(false);
      await onScored();
    } catch (err) {
      setScoreError(friendlyError(err, "Couldn't save your score. Try again."));
    } finally {
      setSaving(null);
    }
  }

  const text = note.essence || note.body || note.excerpt || "";
  const shown = saving ?? pending ?? item.score ?? 0;

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
      {/* A quote with a picture is the one place an image earns its keep:
          it's what makes the thing land before you've read a word.
          Capped in pixels rather than by aspect ratio: on a wide desktop card
          a 21:9 band becomes 500px of picture and shoves the words off the
          screen, which is the opposite of the point. */}
      {imageUrl && (
        <div style={{ width: "100%", height: compact ? 150 : 190, overflow: "hidden" }}>
          <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      )}

      <div style={{ padding: 16 }}>
        <div className="row row--between" style={{ marginBottom: 9, gap: 10 }}>
          <span className="chip" style={{ borderColor: `${kind.color}55`, background: `${kind.color}18`, color: "var(--text)" }}>
            <span className="dot" style={{ background: kind.color, width: 6, height: 6 }} />
            {kind.short}
          </span>
          {note.created_at && (
            <span className="mono muted" style={{ fontSize: 10.5 }}>
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
            <span className="row" style={{ gap: 6, fontSize: 12, color: "var(--accent-text)" }}>
              <Check size={13} />
              You scored this {item.score}/10
              <button className="btn-link curated__link" style={{ marginLeft: 4 }} onClick={() => setScoring((v) => !v)}>
                {scoring ? "Never mind" : "Change"}
              </button>
            </span>
          ) : (
            <button className="btn-link curated__link" onClick={() => setScoring((v) => !v)}>
              {scoring ? "Never mind" : "How well did this fit?"}
            </button>
          )}
          <Link to={`/study?note=${note.id}`} className="btn-link curated__link" onClick={() => markNoteSurfaced(note.id).catch((err) => console.warn(err))}>
            Open it
            <ArrowRight size={12} />
          </Link>
        </div>

        {scoring && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>How well did this apply to you today?</div>
            <div className="curated__scores" onMouseLeave={() => setPending(null)}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setPending(n)}
                  onClick={() => submitScore(n)}
                  disabled={Boolean(saving)}
                  aria-label={`Score ${n} out of 10`}
                  aria-pressed={item.score === n}
                  className={"curated__score mono" + (shown >= n ? " curated__score--on" : "")}
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
                placeholder="Why? (optional: this is what teaches it)"
                aria-label="Why you gave that score"
                style={{ fontSize: 13 }}
              />
            </div>
            {scoreError && <div className="form-error" style={{ marginTop: 10 }}>{scoreError}</div>}
            <p className="muted" style={{ fontSize: 11.5, margin: "8px 0 0", lineHeight: 1.5 }}>
              {saving ? "Saving…" : "Write why first if you want to, then press a number to save. A low score with a reason is the most useful thing you can give the curator."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
