import { useRef, useState } from "react";
import { Feather, CornerDownLeft } from "lucide-react";

// Recording something before it goes.
//
// This sits at the top of the page and nothing stands between typing and
// keeping: no title field, no dialog, no choosing where it goes first. A
// prompting you have to file before you can write down is a prompting you
// lose. There is no kind to pick either; the board files it quietly
// afterwards with a one-line gist and a few tags you never have to see.
//
// Speaking works the same way: the keyboard's microphone types into the box.
//
// `onCapture` resolves true once it's kept. Anything else leaves the words in
// the box, so a dropped connection never costs you what you wrote.
export default function CaptureBar({ onCapture }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  async function submit(e) {
    e?.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    let kept = false;
    try {
      kept = await onCapture({ text: value });
    } finally {
      setBusy(false);
    }
    if (kept) {
      setText("");
      ref.current?.focus();
    }
  }

  return (
    <form onSubmit={submit} className="card board-capture">
      <div className="card-head">
        <label className="card-title" htmlFor="board-capture-text">
          <Feather size={14} />
          Record it
        </label>
      </div>

      <textarea
        id="board-capture-text"
        ref={ref}
        className="textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
        }}
        placeholder="What came? Type it or speak it, before it goes."
      />

      <div className="board-capture__foot">
        <p className="board-capture__hint">Kept as you wrote it. The board files it for later.</p>
        <button type="submit" className="btn btn--accent" disabled={busy || !text.trim()}>
          <CornerDownLeft size={14} />
          {busy ? "Keeping…" : "Keep it"}
        </button>
      </div>
    </form>
  );
}
