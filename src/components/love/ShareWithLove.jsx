import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Heart } from "lucide-react";
import Sheet from "../ascent/Sheet";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../ui/Feedback";
import { loadPartner, shareWithPartner } from "../../lib/love";

// Who you're paired with, or null. Empty for anyone not paired, so the share
// buttons around the app simply don't show for them.
export function usePartner() {
  const { user } = useAuth();
  const [partner, setPartner] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!user?.id) return undefined;
    loadPartner(user.id)
      .then((p) => alive && setPartner(p))
      .catch((err) => console.warn(err));
    return () => {
      alive = false;
    };
  }, [user?.id]);
  return partner;
}

// "Share with Zimira" on a banked day or an achievement: a sheet with the
// title (yours to change) and a line of your own, then it shows on her Love
// tab and she's told.
export default function ShareWithLove({ kind, title, body = "", refDate = null, payload = {}, className = "btn btn--sm", label }) {
  const partner = usePartner();
  const [open, setOpen] = useState(false);
  if (!partner) return null;
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} title={`Share with ${partner.name}`}>
        <Heart size={13} aria-hidden="true" />
        {label ?? `Share with ${partner.name}`}
      </button>
      {open &&
        createPortal(
          <ShareSheet partner={partner} kind={kind} title={title} body={body} refDate={refDate} payload={payload} onClose={() => setOpen(false)} />,
          document.body
        )}
    </>
  );
}

function ShareSheet({ partner, kind, title: startTitle, body: startBody, refDate, payload, onClose }) {
  const toast = useToast();
  const [title, setTitle] = useState(startTitle);
  const [note, setNote] = useState(startBody);
  const [busy, setBusy] = useState(false);

  async function share(e) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await shareWithPartner(partner.pairId, { kind, title: title.trim().slice(0, 160), body: note.trim(), refDate, payload });
      toast.show(`Shared with ${partner.name}`);
      onClose();
    } catch (err) {
      toast.error(err, "Couldn't share that.");
      setBusy(false);
    }
  }

  return (
    <Sheet title={`Share with ${partner.name}`} onClose={onClose}>
      <form onSubmit={share} className="love-share-form">
        <label className="field">
          <span>{kind === "banked_day" ? "The day" : "What you did"}</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
        </label>
        <label className="field">
          <span>A line for {partner.name}</span>
          <textarea className="textarea input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} placeholder="Optional" />
        </label>
        <button type="submit" className="btn btn--accent btn--block" disabled={busy || !title.trim()}>
          <Heart size={14} />
          {busy ? "Sharing…" : "Share it"}
        </button>
      </form>
    </Sheet>
  );
}
