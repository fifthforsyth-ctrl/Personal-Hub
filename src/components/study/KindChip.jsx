import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { NOTE_KINDS, STUDY_NOTE, kindOf } from "../../lib/noteKinds";

// A note's kind, shown and changed in the same place. Tagging has to be one
// click from wherever you're looking at the note, or it won't happen.
//
// The chip itself is neutral; the kind's colour is only the dot, so a page of
// notes doesn't read as a paint chart. `studyNote` names an untagged vault
// note for what it is rather than calling it a Thought.
export function KindChip({ value, onChange, size = "md", studyNote = false, align = "left", up = false, disabled = false }) {
  const kind = studyNote && (value ?? "thought") === "thought" ? STUDY_NOTE : kindOf(value);
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
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const small = size === "sm";
  const chipClass = "chip board-kind__chip" + (small ? " board-kind__chip--sm" : "");
  const dot = <span className="dot" style={{ background: kind.color, width: small ? 6 : 7, height: small ? 6 : 7 }} />;

  if (!onChange) {
    return (
      <span className={chipClass}>
        {dot}
        {kind.label}
      </span>
    );
  }

  return (
    <span ref={ref} className="board-kind">
      <button
        type="button"
        className={chipClass}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Change what kind of note this is"
      >
        {dot}
        {kind.label}
        <ChevronDown size={12} aria-hidden="true" />
      </button>

      {open && (
        <KindMenu
          current={kind.key}
          align={align}
          up={up}
          onPick={(key) => {
            setOpen(false);
            if (key !== (value ?? "thought")) onChange(key);
          }}
        />
      )}
    </span>
  );
}

// The seven kinds with what each is for. Shared by the chip above and the
// "Make a note" button in the reader.
export function KindMenu({ current = null, onPick, align = "left", up = false, label = "Kind of note" }) {
  return (
    <div
      className={"board-kind-menu" + (align === "right" ? " board-kind-menu--right" : "") + (up ? " board-kind-menu--up" : "")}
      role="menu"
      aria-label={label}
    >
      {NOTE_KINDS.map((k) => (
        <button
          key={k.key}
          type="button"
          role="menuitemradio"
          aria-checked={k.key === current}
          className={"board-kind-menu__item" + (k.key === current ? " is-on" : "")}
          onClick={() => onPick(k.key)}
        >
          <span className="board-kind-menu__label">
            <span className="dot" style={{ background: k.color }} />
            <span style={{ flex: 1 }}>{k.label}</span>
            {k.key === current && <Check size={13} aria-hidden="true" />}
          </span>
          <span className="board-kind-menu__hint">{k.hint}</span>
        </button>
      ))}
    </div>
  );
}

// The filter row over what you've kept. Only kinds you actually have get a
// chip (a row of zeros is noise), each with its count, and the selected one is
// ink so it reads as chosen at a glance.
export function KindFilter({ counts, active, onChange, className = "" }) {
  const kinds = [...NOTE_KINDS, STUDY_NOTE].filter((k) => (counts.get(k.key) ?? 0) > 0);
  if (kinds.length < 2) return null;

  return (
    <div className={"board-filters " + className} role="group" aria-label="Show one kind">
      <button
        type="button"
        className={"chip board-filter" + (active === null ? " is-on" : "")}
        aria-pressed={active === null}
        onClick={() => onChange(null)}
      >
        Everything
      </button>
      {kinds.map((k) => {
        const on = active === k.key;
        return (
          <button
            key={k.key}
            type="button"
            className={"chip board-filter" + (on ? " is-on" : "")}
            aria-pressed={on}
            onClick={() => onChange(on ? null : k.key)}
            title={k.hint}
          >
            <span className="dot" style={{ background: k.color, width: 6, height: 6 }} />
            {k.label}
            <span className="board-filter__n">{counts.get(k.key)}</span>
          </button>
        );
      })}
    </div>
  );
}
