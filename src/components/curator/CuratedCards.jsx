import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, RefreshCw, Check, MessageSquare, RotateCw } from "lucide-react";
import { fetchDailySelection, runCurator, scoreSelectionItem, signedImageUrl, markNoteSurfaced } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { friendlyError, isOffline } from "../../lib/errors";
import LoadError from "../ui/LoadError";
import { todayStr } from "../../lib/planDates";
import { useBackOnline } from "../today/useBackOnline";
import { USEFUL, NOT_NOW, verdictOf } from "../../lib/board";

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

// Two answers, because that's all a glance can give: useful or not now. The
// why is optional and comes after, for when there's something to say; the
// curator reads both when it chooses tomorrow.
export function CuratedCard({ item, onScored, compact }) {
  const note = item.note ?? {};
  const [imageUrl, setImageUrl] = useState(null);
  const [feedback, setFeedback] = useState(item.feedback ?? "");
  const [saving, setSaving] = useState(null);
  const [scoreError, setScoreError] = useState(null);
  const verdict = verdictOf(saving ?? item.score);

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

  async function submitScore(score, why = feedback) {
    if (saving) return;
    setSaving(score);
    setScoreError(null);
    try {
      await scoreSelectionItem(item.id, score, why.trim() ? why.trim() : null);
      await onScored();
    } catch (err) {
      setScoreError(friendlyError(err, "Couldn't save that. Try again."));
    } finally {
      setSaving(null);
    }
  }

  const text = note.essence || note.body || note.excerpt || "";
  const whyChanged = item.score && feedback.trim() !== (item.feedback ?? "").trim();

  return (
    <div className="card curated-card">
      {/* A quote with a picture is the one place an image earns its keep:
          it's what makes the thing land before you've read a word.
          Capped in pixels rather than by aspect ratio: on a wide desktop card
          a 21:9 band becomes 500px of picture and shoves the words off the
          screen, which is the opposite of the point. */}
      {imageUrl && (
        <div className="curated-card__image" style={{ height: compact ? 150 : 190 }}>
          <img src={imageUrl} alt="" />
        </div>
      )}

      <div className="curated-card__body">
        {note.created_at && (
          <div className="curated-card__date mono">
            {new Date(note.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </div>
        )}

        <div className="prose" style={{ fontSize: compact ? 14.5 : 15.5, marginBottom: 10 }}>{text}</div>

        {note.excerpt && note.body?.trim() && <blockquote className="prose prose--sm curated-card__quote">{note.excerpt}</blockquote>}

        {/* Why this, today. */}
        <div className="curated-card__why">
          <Sparkles size={12} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
          <span className="muted">{item.reason}</span>
        </div>

        <div className="curated-card__foot">
          <div className="seg" role="group" aria-label="Was this useful today?">
            <button
              type="button"
              className={"seg-btn" + (verdict === "useful" ? " active" : "")}
              aria-pressed={verdict === "useful"}
              disabled={Boolean(saving)}
              onClick={() => submitScore(USEFUL)}
            >
              {verdict === "useful" && <Check size={12} />}
              Useful
            </button>
            <button
              type="button"
              className={"seg-btn" + (verdict === "not_now" ? " active" : "")}
              aria-pressed={verdict === "not_now"}
              disabled={Boolean(saving)}
              onClick={() => submitScore(NOT_NOW)}
            >
              Not now
            </button>
          </div>
          <Link to={`/study?note=${note.id}`} className="btn-link curated__link" onClick={() => markNoteSurfaced(note.id).catch((err) => console.warn(err))}>
            Open it
            <ArrowRight size={12} />
          </Link>
        </div>

        {item.score && (
          <form
            className="curated-card__say"
            onSubmit={(e) => {
              e.preventDefault();
              if (whyChanged) submitScore(item.score);
            }}
          >
            <MessageSquare size={13} style={{ color: "var(--text-3)", flexShrink: 0 }} />
            <input
              className="input"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Why? (optional, it teaches the board)"
              aria-label="Why"
            />
            {whyChanged && (
              <button type="submit" className="btn btn--sm" disabled={Boolean(saving)}>
                {saving ? "Saving…" : "Save"}
              </button>
            )}
          </form>
        )}

        {scoreError && <div className="form-error" style={{ marginTop: 10 }}>{scoreError}</div>}
      </div>
    </div>
  );
}
