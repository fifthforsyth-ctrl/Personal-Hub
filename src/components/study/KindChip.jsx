import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { NOTE_KINDS, kindOf } from "../../lib/noteKinds";

// A note's kind, shown and changed in the same place. Tagging has to be one
// click from wherever you're looking at the note, or it won't happen.
export function KindChip({ value, onChange, size = "md" }) {
  const kind = kindOf(value);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function away(e) {
      if (!ref.current?.contains(e.target)) setOpen(false);
    }
    function esc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const small = size === "sm";
  const label = small ? kind.short : kind.label;

  if (!onChange) {
    return (
      <span
        className="chip"
        style={{ borderColor: `${kind.color}55`, background: `${kind.color}18`, color: "var(--text)", fontSize: small ? 10.5 : 11.5 }}
      >
        <span className="dot" style={{ background: kind.color, width: small ? 6 : 7, height: small ? 6 : 7 }} />
        {label}
      </span>
    );
  }

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        className="chip"
        onClick={() => setOpen((v) => !v)}
        title="Change what kind of note this is"
        style={{
          borderColor: `${kind.color}55`,
          background: `${kind.color}18`,
          color: "var(--text)",
          fontSize: small ? 10.5 : 11.5,
          cursor: "pointer",
        }}
      >
        <span className="dot" style={{ background: kind.color, width: small ? 6 : 7, height: small ? 6 : 7 }} />
        {label}
        <ChevronDown size={11} style={{ color: "var(--text-3)" }} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 40,
            width: 244,
            background: "var(--surface)",
            border: "1px solid var(--line-strong)",
            borderRadius: "var(--r)",
            padding: 5,
            boxShadow: "var(--shadow-lift)",
          }}
        >
          {NOTE_KINDS.map((k) => (
            <button
              key={k.key}
              onClick={() => {
                onChange(k.key);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: k.key === kind.key ? "var(--inset)" : "transparent",
                border: "none",
                borderRadius: "var(--r-sm)",
                padding: "7px 9px",
                color: "inherit",
              }}
            >
              <span className="row" style={{ gap: 7 }}>
                <span className="dot" style={{ background: k.color }} />
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 550 }}>{k.label}</span>
                {k.key === kind.key && <Check size={12} style={{ color: "var(--accent)" }} />}
              </span>
              <span className="faint" style={{ display: "block", fontSize: 11, marginLeft: 14, marginTop: 1 }}>{k.hint}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

// The filter row above the shelf. Counts come along so a kind with nothing in
// it reads as empty rather than broken.
export function KindFilter({ counts, active, onChange }) {
  return (
    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
      <button
        className={"chip" + (active === null ? " chip--accent" : "")}
        onClick={() => onChange(null)}
        style={{ cursor: "pointer" }}
      >
        Everything
      </button>
      {NOTE_KINDS.map((k) => {
        const n = counts.get(k.key) ?? 0;
        const on = active === k.key;
        return (
          <button
            key={k.key}
            className="chip"
            onClick={() => onChange(on ? null : k.key)}
            disabled={n === 0}
            style={{
              cursor: n === 0 ? "default" : "pointer",
              opacity: n === 0 ? 0.4 : 1,
              borderColor: on ? k.color : "var(--line)",
              background: on ? `${k.color}22` : "var(--inset)",
              color: on ? "var(--text)" : "var(--text-2)",
            }}
          >
            <span className="dot" style={{ background: k.color, width: 6, height: 6 }} />
            {k.short}
            <span className="mono faint" style={{ fontSize: 10 }}>{n}</span>
          </button>
        );
      })}
    </div>
  );
}
