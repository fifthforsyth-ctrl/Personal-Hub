import { useCallback, useEffect, useState } from "react";
import { FolderInput, NotebookPen, Plus, SquareCheck, X } from "lucide-react";
import Sheet from "../ascent/Sheet";

// Selecting many steps at once (Aaron, 2026-10-30): "select multiple tasks
// in a camp and drag them", and "create a new section then drag many of
// them into that section". While it's on, a step's box and its words select
// it; dragging any one that's selected carries them all, and the bar along
// the bottom moves them, makes them notes or tasks, or makes a new section
// from them.

export function useSelect() {
  const [sel, setSel] = useState(null);
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
  // Escape puts it down, but not from a text box or over something on top.
  useEffect(() => {
    if (!sel) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (document.querySelector(".sheet-backdrop, .modal-backdrop, .sk-pad, .iv")) return;
      if (e.target?.closest?.("input, textarea, select, [contenteditable]")) return;
      setSel(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [sel]);
  return {
    on: sel !== null,
    sel: sel ?? new Set(),
    start: (ids = []) => setSel(new Set(ids)),
    stop: () => setSel(null),
    // what's left once some have gone (removed, or out of sight)
    keep: (ids) => setSel((s) => (s ? new Set([...s].filter((id) => ids.has(id))) : s)),
    of: (id) => (sel ? { on: sel.has(id), toggle: () => toggle(id) } : null),
    // how many come along when `id` is carried
    carry: (id) => (sel?.has(id) ? sel.size : 1),
  };
}

// The button that starts selecting, or says how to stop.
export function SelectButton({ on, onStart, onStop }) {
  return on ? (
    <button type="button" className="btn btn--sm sel-btn on" onClick={onStop}>
      <X size={14} aria-hidden="true" />
      Done selecting
    </button>
  ) : (
    <button type="button" className="btn btn--sm sel-btn" onClick={onStart}>
      <SquareCheck size={14} aria-hidden="true" />
      Select
    </button>
  );
}

// The bar along the bottom while selecting. `places` are where they can go,
// each { key, label, group }; `camps` (with more than one) are where a new
// section can be made.
export function SelectBar({ count, places, camps, notes, onMove, onNewSection, onKind, onClear, onDone }) {
  const [sheet, setSheet] = useState(null); // "move" | "new"
  return (
    <>
      <div className="pick-bar sel-bar" role="region" aria-label="Selecting">
        <span className="pick-bar__count">
          <b>{count}</b> selected
        </span>
        <button type="button" className="btn btn--sm pick-bar__cancel" onClick={() => setSheet("move")} disabled={!count}>
          <FolderInput size={14} aria-hidden="true" />
          <span className="sel-bar__word">Move to</span>
        </button>
        <button type="button" className="btn btn--sm pick-bar__cancel" onClick={() => setSheet("new")} disabled={!count}>
          <Plus size={14} aria-hidden="true" />
          <span className="sel-bar__word">New section</span>
        </button>
        <button type="button" className="btn btn--sm pick-bar__cancel" onClick={onKind} disabled={!count} aria-label={notes ? "Make them tasks" : "Make them notes"}>
          <NotebookPen size={14} aria-hidden="true" />
          <span className="sel-bar__word">{notes ? "Tasks" : "Notes"}</span>
        </button>
        {count > 0 && (
          <button type="button" className="btn-link sel-bar__clear" onClick={onClear}>
            Clear
          </button>
        )}
        <button type="button" className="btn btn--sm pick-bar__done" onClick={onDone}>
          Done
        </button>
      </div>
      {sheet === "move" && (
        <MoveSheet
          count={count}
          places={places}
          onPick={(key) => {
            setSheet(null);
            onMove(key);
          }}
          onNew={() => setSheet("new")}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "new" && (
        <NewSectionSheet
          count={count}
          camps={camps}
          onSave={async (values) => {
            const ok = await onNewSection(values);
            if (ok) setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}

function MoveSheet({ count, places, onPick, onNew, onClose }) {
  const groups = [];
  for (const p of places) {
    const g = groups.at(-1);
    if (g && g.name === p.group) g.items.push(p);
    else groups.push({ name: p.group, items: [p] });
  }
  return (
    <Sheet title={count === 1 ? "Move it to" : `Move ${count} to`} onClose={onClose}>
      <div className="sel-places">
        {groups.map((g) => (
          <div key={g.name ?? "-"} className="sel-places__group">
            {g.name && <p className="eyebrow">{g.name}</p>}
            {g.items.map((p) => (
              <button key={p.key} type="button" className="sel-place" onClick={() => onPick(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        ))}
        <button type="button" className="sel-place sel-place--new" onClick={onNew}>
          <Plus size={14} aria-hidden="true" />
          A new section
        </button>
      </div>
    </Sheet>
  );
}

// A new section (or a clipboard column) with the selected steps in it.
export function NewSectionSheet({ count, camps, title: heading, clipboard = false, onSave, onClose }) {
  const [title, setTitle] = useState("");
  const [campId, setCampId] = useState(camps?.[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={heading ?? (count ? `A new section for ${count === 1 ? "it" : `these ${count}`}` : "A new section")} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim() || busy) return;
          setBusy(true);
          await onSave({ title: title.trim(), campId });
          setBusy(false);
        }}
      >
        <label className="field">
          <span>Name</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={clipboard ? "From the meeting" : "Audio rules"} autoFocus />
        </label>
        {camps?.length > 1 && (
          <label className="field">
            <span>Camp</span>
            <select className="input" value={campId ?? ""} onChange={(e) => setCampId(e.target.value)}>
              {camps.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="ascent-sheet__actions">
          <span className="spacer" />
          <button type="submit" className="btn btn--accent" disabled={busy || !title.trim()}>
            {busy ? "Making it…" : count ? "Make it and move them in" : "Make it"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
