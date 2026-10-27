import { useCallback, useEffect, useRef, useState } from "react";
import { Sun } from "lucide-react";
import { StepList } from "./Steps";
import { tintOf } from "./ColorPick";

// "Do today" (0090, Aaron 2026-10-27): picking any number of steps (or a
// quest's lines) for today. Nothing moves: what's picked shows again in a
// Today section as the same row, so a tick or a note in either place is the
// same tick or note.

// Picking: while it's on, `sel` holds the ids picked so far, starting from
// what's on today already; `of(id)` gives a row its { on, toggle }. A whole
// section (0091) is `of(id, members)`: picking it takes in its steps, so
// they come off `sel` as steps of their own, and taking it off again gives
// back the ones that were picked on their own before.
export function usePick(busy = false) {
  const [sel, setSel] = useState(null);
  const taken = useRef(new Map()); // section id -> its steps it took in
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const toggle = useCallback(
    (id, members) =>
      setSel((s) => {
        if (!s) return s;
        const next = new Set(s);
        if (next.has(id)) {
          next.delete(id);
          for (const m of taken.current.get(id) ?? []) next.add(m);
        } else {
          taken.current.set(id, (members ?? []).filter((m) => s.has(m)));
          next.add(id);
          for (const m of members ?? []) next.delete(m);
        }
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
    start: (ids) => {
      taken.current = new Map();
      setSel(new Set(ids));
    },
    stop: () => {
      taken.current = new Map();
      setSel(null);
    },
    of: (id, members) => (sel ? { on: sel.has(id), toggle: () => toggle(id, members) } : null),
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

// What's on today in a camp, block by block (todayPicks in lib/camp.js):
// steps picked one by one, each saying where it sits, and whole sections
// (0091) under their number and name, with "Off today" (`onSectionOff`)
// beside them. They're the same rows as where they sit (`step` gives each
// its props), with ids that start with `idPrefix`.
export function TodayBlocks({ blocks, openStep, step, onAddSubs, idPrefix, onSectionOff }) {
  return blocks.map((b) => {
    if (!b.section) return <StepList key={b.key} list={b.items} openStep={openStep} hideDone={false} step={step} onAddSubs={onAddSubs} mirror idPrefix={idPrefix} />;
    const s = b.section;
    const tint = tintOf(s.color);
    return (
      <div key={b.key} id={`${idPrefix}-sec-${s.id}`} className={"today-sec" + tint.className} style={tint.style}>
        <div className="today-sec__head">
          <span className="today-sec__n" aria-hidden="true">
            {s.number}
          </span>
          <h3 className="today-sec__name">{s.title}</h3>
          {b.total > 0 && <small>{`${b.done} of ${b.total}`}</small>}
          {onSectionOff && (
            <button type="button" className="btn-link today-sec__off" onClick={() => onSectionOff(s)}>
              Off today
            </button>
          )}
        </div>
        {b.items.length > 0 ? (
          <StepList list={b.items} openStep={openStep} hideDone={false} step={step} onAddSubs={onAddSubs} mirror idPrefix={idPrefix} />
        ) : (
          <p className="today-hint">{b.earlier ? "Every step here was done before today." : "No steps in this section yet."}</p>
        )}
        {b.items.length > 0 && b.earlier > 0 && <p className="ascent-mini today-sec__earlier">{b.earlier === 1 ? "1 done before today, not shown" : `${b.earlier} done before today, not shown`}</p>}
      </div>
    );
  });
}
