import { useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { addComment, deleteComment } from "../../lib/love";
import { useToast } from "../ui/Feedback";

export function ago(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// The comments under anything shared: both of you can add one, and each can
// take back their own. The other person is told about each new one.
export default function Comments({ pairId, userId, names, kind, subjectId, comments, onChanged, open: startOpen = false }) {
  const toast = useToast();
  const mine = comments.filter((c) => c.subject_kind === kind && c.subject_id === subjectId);
  const [open, setOpen] = useState(startOpen || mine.length > 0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await addComment(pairId, kind, subjectId, body);
      setText("");
      onChanged?.();
    } catch (err) {
      toast.error(err, "Couldn't add that comment.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    try {
      await deleteComment(id);
      onChanged?.();
    } catch (err) {
      toast.error(err, "Couldn't remove it.");
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-link love-comments__open" onClick={() => setOpen(true)}>
        Comment
      </button>
    );
  }

  return (
    <div className="love-comments">
      {mine.map((c) => (
        <div key={c.id} className={"love-comment" + (c.author === userId ? " is-mine" : "")}>
          <span className="love-comment__who">{names[c.author] ?? "Someone"}</span>
          <span className="love-comment__body">{c.body}</span>
          <span className="love-comment__when">{ago(c.created_at)}</span>
          {c.author === userId && (
            <button type="button" className="btn-icon love-comment__del" onClick={() => remove(c.id)} aria-label="Remove comment" title="Remove">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}
      <form className="love-comment-form" onSubmit={send}>
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment…"
          maxLength={2000}
          aria-label="Comment"
        />
        <button type="submit" className="btn btn--accent btn--sm" disabled={busy || !text.trim()} aria-label="Send comment">
          <Send size={13} />
        </button>
      </form>
    </div>
  );
}
