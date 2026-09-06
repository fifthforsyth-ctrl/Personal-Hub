import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Quote as QuoteIcon, Trash2, Loader2, Pin } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { uploadNoteImage, signedImageUrl, removeNoteImage, updateNote } from "../../lib/api";
import { kindOf } from "../../lib/noteKinds";

// The wall.
//
// Quotes are the one thing here that works better as a grid than as a stream:
// you come to this looking to be reminded that other people walked the same
// road, and that's a browsing motion, not a reading one. The picture does most
// of the work — it's what makes a line land before you've finished reading it.
export default function QuoteWall({ notes, onOpen, onChanged }) {
  const quotes = useMemo(
    () =>
      notes
        .filter((n) => (n.note_kind ?? "thought") === "motivation" || (n.note_kind ?? "") === "revelation")
        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.created_at).localeCompare(String(a.created_at))),
    [notes]
  );

  if (quotes.length === 0) {
    return (
      <p className="empty">
        Nothing on the wall yet. Record a quote or a motivational thought and it lands here — add a picture and it'll
        carry that too.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
      {quotes.map((n) => (
        <QuoteTile key={n.id} note={n} onOpen={onOpen} onChanged={onChanged} />
      ))}
    </div>
  );
}

function QuoteTile({ note, onOpen, onChanged }) {
  const { user } = useAuth();
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const kind = kindOf(note.note_kind);

  useEffect(() => {
    let cancelled = false;
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
    if (!file) return;
    setBusy(true);
    try {
      await uploadNoteImage(user.id, note.id, file);
      await onChanged();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  const text = note.essence || note.excerpt || note.body || note.title;

  return (
    <div
      className="day-card"
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: 190,
        borderColor: `${kind.color}44`,
        justifyContent: "flex-end",
      }}
    >
      {url && (
        <>
          <img src={url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,10,12,0.28) 0%, rgba(10,10,12,0.92) 72%)" }} />
        </>
      )}

      <button
        onClick={() => onOpen(note.id)}
        style={{ position: "relative", background: "none", border: "none", textAlign: "left", padding: 14, color: "inherit", width: "100%" }}
      >
        <QuoteIcon size={13} style={{ color: kind.color, marginBottom: 7 }} />
        <div
          className="prose prose--sm"
          style={{
            whiteSpace: "normal",
            display: "-webkit-box",
            WebkitLineClamp: url ? 5 : 7,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            fontSize: 13.5,
            textShadow: url ? "0 1px 8px rgba(0,0,0,0.7)" : "none",
          }}
        >
          {text}
        </div>
        {note.source_ref && (
          <div className="mono" style={{ fontSize: 10.5, marginTop: 8, color: url ? "rgba(244,244,245,0.75)" : "var(--text-3)" }}>
            — {note.source_ref}
          </div>
        )}
      </button>

      <div className="row" style={{ position: "absolute", top: 8, right: 8, gap: 4 }}>
        {note.pinned && (
          <span className="btn-icon" style={{ width: 26, height: 26, color: "var(--accent)" }} title="Pinned">
            <Pin size={12} />
          </span>
        )}
        <button
          className="btn-icon"
          style={{ width: 26, height: 26, background: "rgba(10,10,12,0.6)" }}
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          title={note.image_path ? "Replace the picture" : "Add a picture"}
        >
          {busy ? <Loader2 size={12} className="spin" /> : <ImagePlus size={12} />}
        </button>
        {note.image_path && (
          <button
            className="btn-icon"
            style={{ width: 26, height: 26, background: "rgba(10,10,12,0.6)" }}
            onClick={async () => {
              setBusy(true);
              try {
                await removeNoteImage(user.id, note.id, note.image_path);
                await onChanged();
              } finally {
                setBusy(false);
              }
            }}
            title="Remove the picture"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />
    </div>
  );
}
