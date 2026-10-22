import { useState } from "react";
import { Pin, PinOff, ExternalLink, Sparkles } from "lucide-react";
import { saveQuote } from "../../lib/api";
import { useToast } from "../ui/Feedback";
import { initials, sourceLine } from "../../lib/quotes";
import { pinOf, tiltOf } from "../../lib/quoteShelves";
import ShareQuote from "./ShareQuote";
import "../../styles/cork.css";

// A quote as a photo print: the picture on top, the words under it, and who
// said them. On the cork it hangs from a pin; on a shelf or in the picks it's
// taped down, with "Save to board" to pin it up. "Share" sends it to a friend.
//
// The picture is whatever the web had: the person, or a scene that suits the
// words. When it won't load, the card falls back to a warm block with the
// person's initials, so it never shows a broken image.
export default function QuoteCard({ quote, onChange, variant = "shelf", reason }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const saved = Boolean(quote.saved_at);
  const where = sourceLine(quote);
  const pinned = variant === "cork";

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const row = await saveQuote(quote.id, !saved);
      onChange?.(row);
      if (row.saved_at) toast.show("Pinned to your board");
      else
        toast.show("Taken off your board", {
          actionLabel: "Undo",
          onAction: () => saveQuote(quote.id, true).then((r) => onChange?.(r)),
        });
    } catch (err) {
      toast.error(err, saved ? "Couldn't take it off the board." : "Couldn't save it to the board.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <figure
      className={`qprint qprint--${variant}` + (saved && !pinned ? " is-saved" : "")}
      style={{ "--tilt": `${tiltOf(quote.id)}deg`, "--pin": pinOf(quote.id) }}
    >
      {pinned ? <span className="qprint__pin" aria-hidden="true" /> : <span className="qprint__tape" aria-hidden="true" />}

      <div className="qprint__photo">
        {quote.image_url && !imageFailed ? (
          <img src={quote.image_url} alt={quote.author} loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
        ) : (
          <span className="qprint__initials" aria-hidden="true">
            {initials(quote.author)}
          </span>
        )}
      </div>

      <blockquote className="qprint__text">{quote.text}</blockquote>

      <figcaption className="qprint__by">
        <span className="qprint__author">{quote.author}</span>
        {where &&
          (quote.source_url ? (
            <a className="qprint__source" href={quote.source_url} target="_blank" rel="noreferrer">
              {where}
              <ExternalLink size={10} aria-hidden="true" />
            </a>
          ) : (
            <span className="qprint__source">{where}</span>
          ))}
      </figcaption>

      {reason && (
        <p className="qprint__why">
          <Sparkles size={11} aria-hidden="true" />
          <span>{reason}</span>
        </p>
      )}

      <div className="qprint__foot">
        <button
          type="button"
          className={"qprint__save" + (saved ? " is-on" : "")}
          onClick={toggle}
          disabled={busy}
          aria-pressed={saved}
          title={saved ? "Take it off your board" : "Pin it to your board"}
        >
          {saved ? (pinned ? <PinOff size={13} /> : <Pin size={13} fill="currentColor" />) : <Pin size={13} />}
          {pinned ? "Unpin" : saved ? "On your board" : "Save to board"}
        </button>
        <ShareQuote quote={quote} className="qprint__save qprint__share" />
      </div>
    </figure>
  );
}
