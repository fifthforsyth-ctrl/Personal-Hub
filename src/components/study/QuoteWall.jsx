import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, ImageOff, Quote as QuoteIcon, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../ui/Feedback";
import { uploadNoteImage, signedImageUrl, removeNoteImage } from "../../lib/api";
import { cardFace } from "../../lib/markdown";

// The wall: the cork board itself.
//
// The same cards as the list, laid out as a grid you browse rather than read,
// pinned ones first. Any card can carry a picture, and the picture does most
// of the work: it's what makes a line land before you've finished reading it.
export default function QuoteWall({ notes, onOpen, onChanged }) {
  const quotes = useMemo(
    () => [...notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.created_at).localeCompare(String(a.created_at))),
    [notes]
  );

  if (quotes.length === 0) {
    return <p className="empty">Nothing on the wall yet. Anything you keep lands here, and any card can carry a picture.</p>;
  }

  return (
    <div className="board-wall">
      {quotes.map((n) => (
        <QuoteTile key={n.id} note={n} onOpen={onOpen} onChanged={onChanged} />
      ))}
    </div>
  );
}

function QuoteTile({ note, onOpen, onChanged }) {
  const { user } = useAuth();
  const toast = useToast();
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState(false); // waiting out the Undo
  const fileRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setRemoved(false);
    if (note.image_path) {
      signedImageUrl(note.image_path).then((u) => !cancelled && setUrl(u));
    } else {
      setUrl(null);
    }
    return () => {
      cancelled = true;
    };
  }, [note.image_path]);

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

  // Off the tile at once, and for real once the Undo has had its time.
  function removePicture() {
    const path = note.image_path;
    setRemoved(true);
    toast.undoable({
      message: "Picture removed",
      run: async () => {
        await removeNoteImage(user.id, note.id, path);
        await onChanged();
      },
      onUndo: () => setRemoved(false),
    });
  }

  const photo = !removed && url;
  const hasPicture = Boolean(note.image_path) && !removed;
  const text = cardFace(note, 320).text;

  return (
    <div className={"board-tile" + (photo ? " has-photo" : "")}>
      {photo && (
        <>
          <img className="board-tile__photo" src={url} alt="" />
          <div className="board-tile__shade" />
        </>
      )}

      <button type="button" className="board-tile__open" onClick={() => onOpen(note.id)}>
        {(note.note_kind === "motivation" || note.note_kind === "revelation") && <QuoteIcon size={14} className="board-tile__mark" aria-hidden="true" />}
        <div className="board-tile__text">{text}</div>
        {note.source_ref && <div className="board-tile__ref">— {note.source_ref}</div>}
      </button>

      <div className="board-tile__tools">
        <button
          type="button"
          className="board-tile__tool"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-label={hasPicture ? "Change the picture" : "Add a picture"}
          title={hasPicture ? "Change the picture" : "Add a picture"}
        >
          {busy ? <Loader2 size={15} className="spin" /> : <ImagePlus size={15} />}
        </button>
        {hasPicture && (
          <button
            type="button"
            className="board-tile__tool"
            onClick={removePicture}
            disabled={busy}
            aria-label="Remove the picture"
            title="Remove the picture"
          >
            <ImageOff size={15} />
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={pick} hidden />
    </div>
  );
}
