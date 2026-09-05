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
    try {
      await onCapture({ text: value, kind });
      setText("");
      ref.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="card"
      style={{ borderColor: `${active.color}44`, background: `linear-gradient(180deg, ${active.color}0f, transparent 60%), var(--card)` }}
    >
      <div className="card-head" style={{ marginBottom: 10 }}>
        <span className="card-title">
          <Feather size={14} style={{ color: active.color }} />
          Record it
        </span>
        <span className="faint" style={{ fontSize: 11.5 }}>{active.hint}</span>
      </div>

      <textarea
        ref={ref}
        className="textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
        }}
        placeholder="What came? Write it down before it goes."
        style={{ minHeight: 88, fontFamily: "var(--font-serif)", fontSize: 15.5, lineHeight: 1.65 }}
      />

      <div className="row row--between" style={{ marginTop: 11, gap: 10, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 5, flexWrap: "wrap" }}>
          {NOTE_KINDS.map((k) => {
            const on = k.key === kind;
            return (
              <button
                key={k.key}
                type="button"
                className="chip"
                onClick={() => setKind(k.key)}
                title={k.hint}
                style={{
                  cursor: "pointer",
                  borderColor: on ? k.color : "var(--line)",
                  background: on ? `${k.color}22` : "transparent",
                  color: on ? "var(--text)" : "var(--text-2)",
                  fontWeight: on ? 620 : 500,
                }}
              >
                <span className="dot" style={{ background: k.color, width: 6, height: 6 }} />
                {k.short}
              </button>
            );
          })}
        </div>

        <button type="submit" className="btn btn--accent" disabled={busy || !text.trim()}>
          <CornerDownLeft size={14} />
          {busy ? "Keeping…" : "Keep it"}
        </button>
      </div>
    </form>
  );
}
