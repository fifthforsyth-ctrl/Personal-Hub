import { useState } from "react";
import { ArrowUp, ArrowDown, X, Plus } from "lucide-react";
import Sheet from "../ascent/Sheet";

// What a bullseye takes on one target, and the names of its four sections.
// Saving hands { reasons, aims } to `onSave`, which resolves to whether it
// worked; the sheet stays open with what you typed if not.

const MAX_AIMS = 6;
const CORNERS = ["Top right", "Bottom right", "Bottom left", "Top left"];

export default function TargetSheet({ target, focuses, onSave, onClose }) {
  const [rows, setRows] = useState(() =>
    target.aims.length
      ? target.aims.map((a) => ({ key: a.id, id: a.id, text: a.text, focus_id: a.focus_id ?? "" }))
      : [{ key: "new-0", id: null, text: "", focus_id: "" }]
  );
  const [reasons, setReasons] = useState(() => [...target.reasons]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (i, by) =>
    setRows((rs) => {
      const next = [...rs];
      const [r] = next.splice(i, 1);
      next.splice(i + by, 0, r);
      return next;
    });

  async function submit(e) {
    e.preventDefault();
    const aims = rows.map((r) => ({ id: r.id, text: r.text.trim(), focus_id: r.focus_id || null })).filter((r) => r.text);
    const names = reasons.map((r) => r.trim());
    if (!aims.length) return setProblem("Name at least one thing a bullseye takes.");
    if (names.some((n) => !n)) return setProblem("Name all four sections.");
    setProblem(null);
    setBusy(true);
    await onSave({ aims, reasons: names });
    setBusy(false);
  }

  return (
    <Sheet title={target.title} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="card-note ascent-sheet__lede">Each evening you answer these Yes, Some or No. All Yes is a bullseye.</p>

        <div className="field">
          <span>What a bullseye takes</span>
          <ol className="mk-aims-edit">
            {rows.map((r, i) => (
              <li key={r.key}>
                <div className="mk-aims-edit__row">
                  <input
                    className="input"
                    value={r.text}
                    onChange={(e) => setRow(r.key, { text: e.target.value })}
                    maxLength={120}
                    placeholder={i === 0 ? "Exercised" : "Another thing it takes"}
                    aria-label={`Thing ${i + 1}`}
                  />
                  <button type="button" className="btn-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" title="Move up">
                    <ArrowUp size={15} />
                  </button>
                  <button type="button" className="btn-icon" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down" title="Move down">
                    <ArrowDown size={15} />
                  </button>
                  <button type="button" className="btn-icon" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Remove" title="Remove">
                    <X size={15} />
                  </button>
                </div>
                {focuses.length > 0 && (
                  <label className="mk-aims-edit__log">
                    <span>Your time log answers it</span>
                    <select className="input input--sm" value={r.focus_id} onChange={(e) => setRow(r.key, { focus_id: e.target.value })}>
                      <option value="">No, you do</option>
                      {focuses.map((f) => (
                        <option key={f.id} value={f.id}>
                          When {f.name} is logged
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </li>
            ))}
          </ol>
          {rows.length < MAX_AIMS && (
            <button type="button" className="btn btn--sm btn--on-page" onClick={() => setRows((rs) => [...rs, { key: `new-${Date.now()}-${rs.length}`, id: null, text: "", focus_id: "" }])}>
              <Plus size={14} />
              Add one
            </button>
          )}
          <p className="card-note ascent-sheet__note">Two to four plain things works best. Old shots keep what they were asked.</p>
        </div>

        <div className="field">
          <span>Why you miss: the four sections</span>
          <div className="mk-reasons-edit">
            {reasons.map((r, k) => (
              <label key={k}>
                <small>{CORNERS[k]}</small>
                <input className="input" value={r} onChange={(e) => setReasons((rs) => rs.map((x, j) => (j === k ? e.target.value : x)))} maxLength={40} />
              </label>
            ))}
          </div>
          <p className="card-note ascent-sheet__note">A miss lands in the section your line points to. Renaming one keeps the misses already in it.</p>
        </div>

        {problem && <p className="form-error">{problem}</p>}
        <div className="ascent-sheet__actions">
          <span className="spacer" />
          <button type="submit" className="btn btn--accent" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
