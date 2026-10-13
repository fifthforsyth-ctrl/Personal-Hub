import { useEffect, useRef, useState } from "react";
import { Quote as QuoteIcon, Sparkles, RotateCw, ExternalLink, Pin } from "lucide-react";
import { fetchQuoteDay, pickQuote, rateQuote, saveQuote } from "../../lib/api";
import { useToast } from "../ui/Feedback";
import { useLoad } from "../../lib/useLoad";
import { friendlyError, isOffline } from "../../lib/errors";
import { todayStr } from "../../lib/planDates";
import { RATINGS, initials, ratedLine, sourceLine } from "../../lib/quotes";
import { useBackOnline } from "./useBackOnline";

// One quote for the day, from a Church leader or someone from history,
// chosen for what this week is about.
//
// The nightly run has it ready before you look. If it didn't (a new account,
// a failed night), the first open of the day finds one, which takes a minute
// because the wording is checked on the web first. That happens once per day
// on this device, like the curator's cards.
//
// A historical figure comes with their portrait when there's a public-domain
// one; anyone else gets a name card. Rating it is the whole loop: "applies"
// brings it back now and then and steers what comes next. "Save to board"
// pins it up on the Board's cork.
const asked = new Map();

function triedKey(date) {
  return `hub.quote-tried.${date}`;
}

function triedBefore(date) {
  try {
    return localStorage.getItem(triedKey(date)) === "1";
  } catch (err) {
    console.warn(err);
    return false;
  }
}

function ask(date) {
  if (!asked.has(date)) {
    asked.set(
      date,
      pickQuote(date).finally(() => {
        try {
          localStorage.setItem(triedKey(date), "1");
        } catch (err) {
          console.warn(err);
        }
      })
    );
  }
  return asked.get(date);
}

export default function QuoteOfDay({ userId, date = todayStr() }) {
  const { data, error, loading, reload, mutate } = useLoad(() => fetchQuoteDay(userId, date), [userId, date]);
  const [finding, setFinding] = useState(false);
  const [findError, setFindError] = useState(null);
  const waited = useRef(null);
  useBackOnline(reload, Boolean(error));

  useEffect(() => {
    setFinding(false);
    setFindError(null);
  }, [date]);

  // Nothing for today yet: find one, once.
  useEffect(() => {
    if (loading || error || data || date !== todayStr() || waited.current === date) return;
    if (!asked.has(date) && triedBefore(date)) return;
    waited.current = date;
    setFinding(true);
    ask(date)
      .then((day) => day && mutate(() => day))
      .catch((err) => setFindError(err))
      .finally(() => setFinding(false));
  }, [loading, error, data, date, mutate]);

  async function tryAgain() {
    asked.delete(date);
    setFindError(null);
    setFinding(true);
    try {
      const day = await ask(date);
      if (day) mutate(() => day);
    } catch (err) {
      setFindError(err);
    } finally {
      setFinding(false);
    }
  }

  if (!data) {
    if (finding) {
      return (
        <section className="card quote-card quote-card--waiting">
          <p className="empty">Finding a quote for this week…</p>
        </section>
      );
    }
    if (findError) {
      return (
        <div className="load-error" role="alert">
          <span>
            Couldn't find today's quote.
            <span className="load-error__why"> {friendlyError(findError, "")}</span>
          </span>
          <button type="button" className="btn btn--sm" onClick={tryAgain}>
            <RotateCw size={13} />
            Try again
          </button>
        </div>
      );
    }
    // Offline, the page already says so; a failed read is retried with the
    // connection. Either way the rest of Today doesn't wait on a quote.
    if (error && !isOffline(error)) console.warn(error);
    return null;
  }

  return <QuoteCard day={data} onRated={(quote) => mutate((d) => d && { ...d, quote })} />;
}

function QuoteCard({ day, onRated }) {
  const quote = day.quote ?? {};
  const [rating, setRating] = useState(quote.rating ?? null);
  const [saving, setSaving] = useState(false);
  const [rateError, setRateError] = useState(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [pinning, setPinning] = useState(false);
  const toast = useToast();
  const saved = Boolean(quote.saved_at);

  useEffect(() => setRating(quote.rating ?? null), [quote.id, quote.rating]);

  async function pin() {
    if (pinning) return;
    setPinning(true);
    try {
      const row = await saveQuote(quote.id, !saved);
      onRated(row);
      toast.show(row.saved_at ? "Pinned to your board" : "Taken off your board");
    } catch (err) {
      toast.error(err, saved ? "Couldn't take it off the board." : "Couldn't save it to the board.");
    } finally {
      setPinning(false);
    }
  }

  async function rate(key) {
    if (saving) return;
    const next = key === rating ? null : key; // tapping it again takes it back
    const before = rating;
    setRating(next);
    setSaving(true);
    setRateError(null);
    try {
      onRated(await rateQuote(quote.id, next));
    } catch (err) {
      setRating(before);
      setRateError(friendlyError(err, "Couldn't save that. Try again."));
    } finally {
      setSaving(false);
    }
  }

  const portrait = quote.image_url && !imageFailed;
  const where = sourceLine(quote);

  return (
    <section className="card quote-card" aria-label="Quote for today">
      <div className="quote-card__eyebrow eyebrow">
        <QuoteIcon size={12} aria-hidden="true" />
        For this week
      </div>

      <blockquote className="quote-card__text">{quote.text}</blockquote>

      <div className="quote-card__who">
        {portrait ? (
          <img className="quote-card__face" src={quote.image_url} alt={quote.author} onError={() => setImageFailed(true)} />
        ) : (
          <span className="quote-card__face quote-card__face--name" aria-hidden="true">
            {initials(quote.author)}
          </span>
        )}
        <div className="quote-card__byline">
          <span className="quote-card__author">{quote.author}</span>
          {where &&
            (quote.source_url ? (
              <a className="quote-card__source" href={quote.source_url} target="_blank" rel="noreferrer">
                {where}
                <ExternalLink size={11} aria-hidden="true" />
              </a>
            ) : (
              <span className="quote-card__source">{where}</span>
            ))}
        </div>
      </div>

      {day.reason && (
        <div className="quote-card__why">
          <Sparkles size={12} aria-hidden="true" />
          <span>{day.reason}</span>
        </div>
      )}

      <div className="quote-card__rate">
        <div className="seg" role="group" aria-label="How much does this apply?">
          {RATINGS.map((r) => (
            <button
              key={r.key}
              type="button"
              className={"seg-btn" + (rating === r.key ? " active" : "")}
              aria-pressed={rating === r.key}
              disabled={saving}
              onClick={() => rate(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
        {rating && <span className="quote-card__rated">{ratedLine(rating)}</span>}
        <button
          type="button"
          className={"btn btn--sm quote-card__save" + (saved ? " is-on" : "")}
          onClick={pin}
          disabled={pinning}
          aria-pressed={saved}
          title={saved ? "Take it off your board" : "Pin it to your Board"}
        >
          <Pin size={13} fill={saved ? "currentColor" : "none"} />
          {saved ? "On your board" : "Save to board"}
        </button>
      </div>
      {rateError && <div className="form-error">{rateError}</div>}

      {portrait && quote.image_credit && (
        <p className="quote-card__credit">
          Portrait:{" "}
          {quote.image_page ? (
            <a className="quote-card__credit-link" href={quote.image_page} target="_blank" rel="noreferrer">
              {quote.image_credit}
            </a>
          ) : (
            quote.image_credit
          )}
        </p>
      )}
    </section>
  );
}
