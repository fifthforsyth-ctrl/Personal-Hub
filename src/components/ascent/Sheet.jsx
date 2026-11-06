import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

// The Ascent page's edit sheets: a bottom sheet on a phone, a panel on a
// desk. Escape closes the top one only, so a confirm opened over a sheet
// closes first. Opening one takes the focus into it (unless a box in it took
// it already), so a keyboard starts in the sheet rather than on the page
// behind; closing gives it back to whatever had it. Only a press that starts
// and ends on the backdrop closes it, so selecting text and letting go past
// the panel's edge doesn't.
export default function Sheet({ title, onClose, children }) {
  const id = useId();
  const backdrop = useRef(null);
  const dialog = useRef(null);
  const downOnBackdrop = useRef(false);
  // What had the focus as it opened, read before a box in it can take it.
  const opener = useRef(undefined);
  if (opener.current === undefined) opener.current = typeof document === "undefined" ? null : document.activeElement;

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
    const back = opener.current;
    return () => {
      const now = document.activeElement;
      if (back && back !== document.body && back.isConnected && (!now || now === document.body)) back.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      const open = document.querySelectorAll(".sheet-backdrop");
      if (open[open.length - 1] !== backdrop.current) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="sheet-backdrop"
      ref={backdrop}
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) onClose();
        downOnBackdrop.current = false;
      }}
    >
      <div ref={dialog} tabIndex={-1} className="sheet ascent-sheet" role="dialog" aria-modal="true" aria-labelledby={id} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="card-title" id={id}>
            {title}
          </h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close" title="Close">
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
