import { useState } from "react";
import { friendlyError } from "../../lib/errors";
import { useToast } from "../ui/Feedback";
import { renameTap, removeTap, hideTap, unhideTap, isUnnamed } from "./tapOutbox";

// Renaming or removing one win or loss, inline where you tapped it (a pill on
// Today, a row on the evening). Works the same whether the tap is still on
// the phone or already in the Hub.
export default function TapEditor({ row, onClose }) {
  const removeWithUndo = useRemoveTap();
  const [text, setText] = useState(isUnnamed(row) ? "" : row.habit_label);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const isWin = row.kind === "win";

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    const label = text.trim() || (isWin ? "Win" : "Loss");
    if (label === row.habit_label) return onClose();
    setBusy(true);
    setError(null);
    try {
      await renameTap(row.id, label);
      onClose();
    } catch (err) {
      setError(friendlyError(err, "Couldn't rename it. Try again."));
      setBusy(false);
    }
  }

  return (
    <form className="tap-editor" onSubmit={save}>
      <input
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={isWin ? "What was the win?" : "What happened?"}
        aria-label={isWin ? "Name this win" : "Name this loss"}
        autoFocus
      />
      {error && <div className="form-error">{error}</div>}
      <div className="tap-editor__actions">
        <button
          type="button"
          className="btn-link btn-link--danger"
          onClick={() => {
            onClose();
            removeWithUndo(row);
          }}
        >
          Remove
        </button>
        <span className="spacer" />
        <button type="button" className="btn btn--sm" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn--sm btn--accent" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

// Gone from the screen now, gone for real in six seconds unless Undo.
export function useRemoveTap() {
  const toast = useToast();
  return (row) => {
    hideTap(row.id);
    toast.undoable({
      message: row.kind === "win" ? "Win removed" : "Loss removed",
      run: () => removeTap(row.id),
      onUndo: () => unhideTap(row.id),
    });
  };
}
