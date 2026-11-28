import { useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

// Recording something before it goes.
//
// This sits at the top of the page, one white pill with a black button at
// its end (Clean slate, 2026-11-23), and nothing stands between typing and
// keeping: no title field, no dialog, no choosing where it goes first. The
// box grows with what's typed, and the line under it (what happens to it,
// and the sweet something circle) shows once there's something in it. A
// prompting you have to file before you can write down is a prompting you
// lose. There is no kind to pick either; the board files it quietly
// afterwards with a one-line gist and a few tags you never have to see.
//
// Speaking works the same way: the keyboard's microphone types into the box.
//
// The circle by the button marks it as a sweet something: a small thing that
// made you happy. It clears with the box once the thought is kept.
//
// `onCapture` resolves true once it's kept. Anything else leaves the words in
// the box, so a dropped connection never costs you what you wrote.
export default function CaptureBar({ onCapture }) {
  const [text, setText] = useState("");
  const [sweet, setSweet] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  async function submit(e) {
    e?.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    let kept = false;
    try {
      kept = await onCapture({ text: value, sweet });
    } finally {
      setBusy(false);
    }
    if (kept) {
      setText("");
      setSweet(false);
      if (ref.current) ref.current.style.height = "auto";
      ref.current?.focus();
    }
  }

  // The box is one line until the words need more.
  function grow(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }
  const open = Boolean(text.trim()) || sweet;

  return (
    <form onSubmit={submit} className={"board-capture" + (open ? " is-open" : "")}>
      <div className="board-capture__row">
        <textarea
          id="board-capture-text"
          ref={ref}
          className="board-capture__box"
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            grow(e.target);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
          }}
          placeholder="What came to you?"
          aria-label="Keep a thought"
        />
        <button type="submit" className="board-capture__keep" disabled={busy || !text.trim()} aria-label={busy ? "Keeping" : "Keep it"} title="Keep it">
          <ArrowUp size={20} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div className="board-capture__foot">
          <label className={"sweet-check" + (sweet ? " is-on" : "")}>
            <input type="checkbox" checked={sweet} onChange={(e) => setSweet(e.target.checked)} />
            <span className="sweet-check__dot" aria-hidden="true" />
            Sweet something
          </label>
          <p className="board-capture__hint">Kept as you wrote it.</p>
        </div>
      )}
    </form>
  );
}
