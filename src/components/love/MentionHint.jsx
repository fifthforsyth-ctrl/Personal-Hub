import { Heart } from "lucide-react";
import { usePartner } from "./ShareWithLove";
import { mentions } from "../../lib/love";

// Under a journal answer: once it @mentions the one you love, say plainly
// that this answer (and only this one) is shared with them when it saves.
export default function MentionHint({ text }) {
  const partner = usePartner();
  if (!partner || !mentions(text, partner.handles)) return null;
  return (
    <span className="love-mention-hint">
      <Heart size={12} fill="currentColor" aria-hidden="true" />
      This answer is shared with {partner.name}
    </span>
  );
}
