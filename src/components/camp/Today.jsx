import { useCallback, useEffect, useRef, useState } from "react";
import { Sun } from "lucide-react";

// "Do today" (0090, Aaron 2026-10-27): picking any number of steps (or a
// quest's lines) for today. Nothing moves: what's picked shows again in a
// Today section as the same row, so a tick or a note in either place is the
// same tick or note.

// Picking: while it's on, `sel` holds the ids picked so far, starting from
// what's on today already; `of(id)` gives a row its { on, toggle }.
export function usePick(busy = false) {
  const [sel, setSel] = useState(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const toggle = useCallback(
    (id) =>
      setSel((s) => {
        if (!s) return s;
        const next = new Set(s);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    []
  );
  // Escape puts it down without saving, but not while it's saving, not from
  // a text box, and not when the Escape is closing something on top (a
  // sheet, a confirm, the menu, the sketch pad). It listens on the way down
  // so it sees that thing before the thing closes itself.
  useEffect(() => {
    if (!sel) return;
    const onKey = (e) => {
      if (e.key !== "Escape" || busyRef.current) return;
      if (document.querySelector(".sheet-backdrop, .modal-backdrop, .sk-pad")) return;
      if (e.target?.closest?.("input, textarea, select, [contenteditable]")) return;
      setSel(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [sel]);
  return {
    on: sel !== null,
    sel,
    start: (ids) => setSel(new Set(ids)),
    stop: () => setSel(null),
    of: (id) => (sel ? { on: sel.has(id), toggle: () => toggle(id) } : null),
  };
}

// The head of a Today section: the word in the accent, how many are done,
// and the button that starts picking.
export function TodayHead({ id, done, total, picking, onPick, label = "Pick for today" }) {
  return (
    <div className="today-head">
      <h2 id={id}>
        <Sun size={17} strokeWidth={2.4} aria-hidden="true" />
        Today
      </h2>
      {total > 0 && <small>{`${done} of ${total} done`}</small>}
      <span className="spacer" />
      {onPick && !picking && (
        <button type="button" className="btn btn--sm today-pick-btn" onClick={onPick}>
          {label}
        </button>
      )}
    </div>
  );
}

// The bar along the bottom while picking: how many are on today, and Done.
export function PickBar({ count, busy, onCancel, onDone }) {
  return (
    <div className="pick-bar" role="region" aria-label="Picking for today">
      <span className="pick-bar__count">
        <b>{count}</b> for today
      </span>
      <button type="button" className="btn btn--sm pick-bar__cancel" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
      <button type="button" className="btn btn--sm pick-bar__done" onClick={onDone} disabled={busy}>
        {busy ? "Saving…" : "Done"}
      </button>
    </div>
  );
}
