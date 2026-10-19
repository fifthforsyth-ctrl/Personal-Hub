import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

// The Ascent page's edit sheets: a bottom sheet on a phone, a panel on a
// desk. Escape closes the top one only, so a confirm opened over a sheet
// closes first.
export default function Sheet({ title, onClose, children }) {
  const id = useId();
  const backdrop = useRef(null);

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
    <div className="sheet-backdrop" ref={backdrop} onClick={onClose}>
      <div className="sheet ascent-sheet" role="dialog" aria-modal="true" aria-labelledby={id} onClick={(e) => e.stopPropagation()}>
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
