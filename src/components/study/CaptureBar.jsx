import { useRef, useState } from "react";
import { Feather, CornerDownLeft } from "lucide-react";
import { NOTE_KINDS, DEFAULT_KIND, kindOf } from "../../lib/noteKinds";

// Recording something before it goes.
//
// This sits at the top of the page and nothing stands between typing and
// keeping — no title field, no dialog, no choosing where it goes first. A
// prompting you have to file before you can write down is a prompting you
// lose. The kind is picked in the same gesture, and Thought is always there
// as the answer that claims nothing.
//
// `onCapture` resolves true once it's kept. Anything else leaves the words in
// the box, so a dropped connection never costs you what you wrote.
export default function CaptureBar({ onCapture }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState(DEFAULT_KIND);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  const active = kindOf(kind);

  async function submit(e) {
    e?.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    let kept = false;
    try {
      kept = await onCapture({ text: value, kind });
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
        placeholder="What came? Write it down before it goes."
      />

      <div className="board-capture__foot">
        <div className="board-capture__kinds">
          <div className="board-filters" role="radiogroup" aria-label="What kind of note">
            {NOTE_KINDS.map((k) => {
              const on = k.key === kind;
              return (
                <button
                  key={k.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={"chip board-filter" + (on ? " is-on" : "")}
                  onClick={() => setKind(k.key)}
                >
                  <span className="dot" style={{ background: k.color, width: 6, height: 6 }} />
                  {k.label}
                </button>
              );
            })}
          </div>
          <p className="board-capture__hint">{active.hint}</p>
        </div>

        <button type="submit" className="btn btn--accent" disabled={busy || !text.trim()}>
          <CornerDownLeft size={14} />
          {busy ? "Keeping…" : "Keep it"}
        </button>
      </div>
    </form>
  );
}
