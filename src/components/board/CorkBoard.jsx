import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, ImageOff, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../ui/Feedback";
import { uploadNoteImage, signedImageUrl, removeNoteImage, removeNoteWebImage } from "../../lib/api";
import { cardFace } from "../../lib/markdown";
import { corkItems, pinOf, tiltOf } from "../../lib/quoteShelves";
import { dayLabel } from "../study/dayLabel";
import QuoteCard from "./QuoteCard";

// The board itself: the quotes you've saved and the thoughts you've
// kept, pinned up together, newest first. Pinned thoughts go to the top.
//
// Quotes hang as black-and-white prints; your own thoughts are index cards
// titled in your hand, and any of them can carry a picture of its own.
const PAGE = 18;

const SHOW = [
  { key: "all", label: "Everything" },
  { key: "quotes", label: "Quotes" },
  { key: "thoughts", label: "Thoughts" },
];

export default function CorkBoard({ quotes, notes, onOpenNote, onQuoteChange, onNotesChanged }) {
  const [show, setShow] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const items = useMemo(() => {
    const all = corkItems(quotes, notes);
    if (show === "quotes") return all.filter((i) => i.kind === "quote");
    if (show === "thoughts") return all.filter((i) => i.kind === "note");
    return all;
  }, [quotes, notes, show]);

  return (
    <section className="cork-wrap" aria-label="Your board">
      <div className="cork-wrap__head">
        <h2 className="cork-wrap__title">Your board</h2>
        <div className="seg" role="group" aria-label="Show">
          {SHOW.map((s) => (
            <button
              key={s.key}
              type="button"
              className={"seg-btn" + (show === s.key ? " active" : "")}
              aria-pressed={show === s.key}
              onClick={() => {
                setShow(s.key);
                setShown(PAGE);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cork">
        {items.length === 0 ? (
          <p className="cork__empty">
            {show === "quotes"
              ? "No quotes pinned yet. Tap “Save to board” on any quote you love."
              : "Nothing pinned yet. Keep a thought above, or save a quote you love."}
          </p>
        ) : (
          <div className="cork__items">
            {items.slice(0, shown).map((item) => (
              <div key={item.id} className="print-slot">
                {item.kind === "quote" ? (
                  <QuoteCard quote={item.quote} variant="cork" onChange={onQuoteChange} />
                ) : (
                  <PaperNote note={item.note} onOpen={onOpenNote} onChanged={onNotesChanged} />
                )}
              </div>
            ))}
          </div>
        )}
        {items.length > shown && (
          <div className="cork__more">
            <button type="button" className="btn btn--sm" onClick={() => setShown((n) => n + PAGE * 2)}>
              Show more ({items.length - shown})
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// A thought on an index card, or a print if it has a picture: one you added,
// or else the one the board found for it.

export function PaperNote({ note, onOpen, onChanged }) {
  const { user } = useAuth();
  const toast = useToast();
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState(false); // waiting out the Undo
  const fileRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setRemoved(false);
    if (note.image_path) signedImageUrl(note.image_path).then((u) => !cancelled && setUrl(u));
    else setUrl(note.image_url ?? null);
    return () => {
      cancelled = true;
    };
  }, [note.image_path, note.image_url]);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy) return;
    setBusy(true);
    try {
      await uploadNoteImage(user.id, note.id, file);
      await onChanged();
    } catch (err) {
      toast.error(err, "Couldn't add that picture.");
    } finally {
      setBusy(false);
    }
  }

  function removePicture() {
    const path = note.image_path;
    setRemoved(true);
    toast.undoable({
      message: "Picture removed",
      run: async () => {
        if (path) await removeNoteImage(user.id, note.id, path);
        else await removeNoteWebImage(note.id);
        await onChanged();
      },
      onUndo: () => setRemoved(false),
    });
  }

  const photo = !removed && url;
  const hasPicture = Boolean(note.image_path || note.image_url) && !removed;
  const face = cardFace(note, 240);

  return (
    <div
      className={"paper" + (photo ? " has-photo" : "")}
      style={{ "--tilt": `${tiltOf(note.id) * -1}deg`, "--pin": pinOf(note.id) }}
    >
      <span className="paper__pin" aria-hidden="true" />
      <button type="button" className="paper__open" onClick={() => onOpen(note.id)}>
        {photo && <img className="paper__photo" src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setUrl(null)} />}
        {face.title && <span className="paper__title">{face.title}</span>}
        <span className="paper__text">{face.text}</span>
        <span className="paper__meta">{[dayLabel(note.created_at), note.source_ref].filter(Boolean).join(" · ")}</span>
      </button>

      <div className="paper__tools">
        <button
          type="button"
          className="paper__tool"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-label={hasPicture ? "Change the picture" : "Add a picture"}
          title={hasPicture ? "Change the picture" : "Add a picture"}
        >
          {busy ? <Loader2 size={14} className="spin" /> : <ImagePlus size={14} />}
        </button>
        {hasPicture && (
          <button type="button" className="paper__tool" onClick={removePicture} disabled={busy} aria-label="Remove the picture" title="Remove the picture">
            <ImageOff size={14} />
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={pick} hidden />
    </div>
  );
}
