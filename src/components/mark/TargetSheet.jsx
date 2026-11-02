import { useState } from "react";
import Sheet from "../ascent/Sheet";
import CheckEditor, { editRows, blankRow, cleanRows, rowsProblem } from "../checks/CheckEditor";
import { scores } from "../../lib/checks";

// What a bullseye takes on one target, as checks (checks.js: Yes or No,
// 1 to 10, minutes, a time and the rest), and the names of its four
// sections. Saving hands { reasons, aims } to `onSave`, `aims` being the
// checks in order, each with its id when it was already saved; it resolves
// to whether it worked, and the sheet stays open with what you typed if not.
//
//   focuses   lifetime focuses, for a check the time log answers
//   fedBy     this week's focuses that count toward this target. With one,
//             the target can stand on no checks of its own: its arrow lands
//             where the focus's does. Without one, a target needs a check
//             that counts, or no evening could ever give it a ring.

const MAX_AIMS = 6;
const CORNERS = ["Top right", "Bottom right", "Bottom left", "Top left"];

export default function TargetSheet({ target, focuses = [], fedBy = [], onSave, onClose }) {
  const [rows, setRows] = useState(() => (target.aims.length ? editRows(target.aims) : [blankRow(0)]));
  const [reasons, setReasons] = useState(() => [...target.reasons]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const fed = fedBy.map((g) => String(g.title ?? "").trim()).filter(Boolean);

  async function submit(e) {
    e.preventDefault();
    const aims = cleanRows(rows);
    const names = reasons.map((r) => r.trim());
    const wrong = rowsProblem(rows);
    if (wrong) return setProblem(wrong);
    if (!fed.length && !aims.length) return setProblem("Add at least one check.");
    if (!fed.length && !aims.some((a) => scores(a))) return setProblem("Make at least one check count, so the arrow has a ring to land in.");
    if (names.some((n) => !n)) return setProblem("Name all four sections.");
    setProblem(null);
    setBusy(true);
    await onSave({ aims, reasons: names });
    setBusy(false);
  }

  return (
    <Sheet title={target.title} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="card-note ascent-sheet__lede">Each evening asks these. The share you pass puts the arrow in its ring; all passed is a bullseye.</p>

        <div className="field">
          <span>What a bullseye takes</span>
          <CheckEditor rows={rows} onChange={setRows} focuses={focuses} max={MAX_AIMS} />
          <p className="card-note ascent-sheet__note">Two to four plain checks works best. Old shots keep what they were asked.</p>
          {fed.length > 0 && (
            <p className="card-note ascent-sheet__note">
              {fed.length === 1 ? (
                <>
                  <b>{fed[0]}</b>, this week's focus, counts toward it as one more check each evening.
                </>
              ) : (
                <>
                  <b>{fed.slice(0, -1).join(", ")}</b> and <b>{fed[fed.length - 1]}</b>, this week's focuses, each count toward it as one more check each evening.
                </>
              )}
              {cleanRows(rows).length ? "" : ` With no checks of its own, its arrow lands where ${fed.length === 1 ? "the focus's does" : "theirs do"}.`}
            </p>
          )}
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
