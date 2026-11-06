import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Share, Image as ImageIcon, MessageSquareText, Copy, Download, Heart } from "lucide-react";
import Sheet from "../ascent/Sheet";
import { useToast } from "../ui/Feedback";
import { renderQuoteCard, shareFileName, shareSupport, shareText } from "../../lib/quoteShare";
import { usePartner } from "../love/ShareWithLove";
import { sendQuote, notifyLoveChanged } from "../../lib/love";
import "../../styles/share.css";

// "Share" on a quote: a sheet with the quote drawn as a picture, then the
// phone's own share sheet, so you pick the friend in Messages (or anywhere).
// Nothing is sent from the Hub.
//
// The picture is drawn when the sheet opens, not on the tap that shares it:
// iPhone only opens its share sheet straight from a tap, and a picture that
// takes a second to draw would make it refuse.
export default function ShareQuote({ quote, className = "btn btn--sm", label = "Share" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} title="Send this quote to a friend">
        <Share size={13} aria-hidden="true" />
        {label}
      </button>
      {/* On the body, so a tilted print doesn't carry the sheet with it. */}
      {open && createPortal(<ShareSheet quote={quote} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function ShareSheet({ quote, onClose }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let url = null;
    renderQuoteCard(quote)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setFile(new File([blob], shareFileName(quote), { type: "image/png" }));
        setPreview(url);
      })
      .catch((err) => {
        console.warn(err);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [quote]);

  const can = shareSupport(file);
  const words = shareText(quote);

  async function share(data) {
    try {
      await navigator.share(data);
      onClose();
    } catch (err) {
      if (err?.name === "AbortError") return; // closed the share sheet
      toast.error(err, "Couldn't open sharing.");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(words);
      toast.show("Copied. Paste it to a friend.");
    } catch (err) {
      toast.error(err, "Couldn't copy it.");
    }
  }

  return (
    <Sheet title="Share this quote" onClose={onClose}>
      <div className="share-quote">
        <SendToLove quote={quote} onSent={onClose} />
        <div className="share-quote__preview">
          {preview ? (
            <img src={preview} alt={`${quote.author}: ${quote.text}`} />
          ) : failed ? (
            <p className="share-quote__note">Couldn't draw the picture. The words can still go.</p>
          ) : (
            <p className="share-quote__note">Making the card…</p>
          )}
        </div>

        <div className="share-quote__actions">
          {can.files ? (
            <button type="button" className="btn btn--accent" disabled={!file} onClick={() => share({ files: [file] })}>
              <ImageIcon size={15} aria-hidden="true" />
              Send the picture
            </button>
          ) : (
            preview && (
              <a className="btn btn--accent" href={preview} download={shareFileName(quote)}>
                <Download size={15} aria-hidden="true" />
                Save the picture
              </a>
            )
          )}
          {can.text ? (
            <button type="button" className="btn" onClick={() => share({ text: words })}>
              <MessageSquareText size={15} aria-hidden="true" />
              Send just the words
            </button>
          ) : (
            <button type="button" className="btn" onClick={copy}>
              <Copy size={15} aria-hidden="true" />
              Copy the words
            </button>
          )}
        </div>
        <p className="share-quote__hint">These open your phone's share sheet: you pick who gets it there.</p>
      </div>
    </Sheet>
  );
}

// Straight to the one you love, inside the Hub: it lands on their Board
// and their Love tab, with your line, and they're told.
function SendToLove({ quote, onSent }) {
  const partner = usePartner();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!partner || !quote?.id) return null;

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await sendQuote(quote.id, note.trim());
      notifyLoveChanged();
      toast.show(`Sent to ${partner.name}. It's on their Board.`);
      onSent();
    } catch (err) {
      toast.error(err, "Couldn't send it.");
      setBusy(false);
    }
  }

  return (
    <form className="share-quote__love" onSubmit={send}>
      <input
        className="input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        placeholder={`A line for ${partner.name} (optional)`}
        aria-label={`A line for ${partner.name}`}
      />
      <button type="submit" className="btn btn--accent" disabled={busy}>
        <Heart size={15} aria-hidden="true" />
        {busy ? "Sending…" : `Send to ${partner.name}`}
      </button>
    </form>
  );
}
