import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import "../../styles/money.css";

// Money's cards keep each other current. Anything that changes a transaction
// or a budget bumps one counter on the page, and every card reloads when it
// moves, keeping what it shows until the new answer lands. Before this, the
// question, the list and the budgets each loaded once and disagreed after the
// first answer.
export function useReloadOn(version, reload) {
  const seen = useRef(version);
  useEffect(() => {
    if (seen.current === version) return;
    seen.current = version;
    reload();
  }, [version, reload]);
}

// Months on this page are always the 1st, as text ("2026-10-01"), built from
// local parts, so nothing goes through a UTC midnight that is the 30th in
// Denver.
export function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function shiftMonth(key, n) {
  const [y, m] = String(key).split("-").map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
}

// "2026-10-01" → "October" (or "Oct" with { short: true }).
export function monthName(key, { short = false } = {}) {
  const [y, m] = String(key).split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString(undefined, { month: short ? "short" : "long" });
}

// The local calendar day of a timestamp, "2026-10-02".
export function localDay(iso) {
  return new Date(iso).toLocaleDateString("en-CA");
}

export function shortDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// A sheet that rises from the bottom on a phone and sits in the middle on a
// desk. White, so the inset fields inside it show as fields. A purchase can
// open over a budget's sheet, so Escape closes only the sheet on top.
export function MoneySheet({ title, onClose, children, busy = false, wide = false }) {
  const titleId = useId();
  const closeRef = useRef(null);
  const backdropRef = useRef(null);
  const latest = useRef({ onClose, busy });
  latest.current = { onClose, busy };

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key !== "Escape" || latest.current.busy) return;
      const open = document.querySelectorAll(".sheet-backdrop");
      if (open[open.length - 1] !== backdropRef.current) return;
      latest.current.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={backdropRef} className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <div
        className={"sheet money-sheet" + (wide ? " money-sheet--wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 id={titleId} className="money-sheet__title">{title}</h2>
          <button ref={closeRef} type="button" className="btn-icon" onClick={onClose} disabled={busy} aria-label="Close" title="Close">
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Selected is ink with white text, like every other selected thing in the
// app; a budget keeps its colour as the dot.
export function Chip({ active, color, onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      className={"chip money-chip" + (active ? " is-on" : "")}
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
    >
      {color && <span className="dot" style={{ background: color, width: 7, height: 7 }} />}
      {children}
    </button>
  );
}

// A real switch: it says what it is to a screen reader, and on is ink, not
// orange.
export function Switch({ on, onChange, icon: Icon, children, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={"money-switch" + (on ? " is-on" : "")}
      onClick={() => onChange(!on)}
      disabled={disabled}
    >
      {Icon && <Icon size={15} className="money-switch__icon" />}
      <span className="money-switch__label">{children}</span>
      <span className="money-switch__track" aria-hidden="true">
        <span className="money-switch__knob" />
      </span>
    </button>
  );
}
