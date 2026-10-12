import { useState } from "react";
import { Check } from "lucide-react";
import { getTodayAdjustedCurrent, isDailyDoneToday, checkedInToday } from "../../lib/dates";

// The goal panel's one main action, by tracking method: check in, log a
// number, or write the note. `onLogProgress`, `onAddNote` and `onUndo`
// resolve to whether the write went through (the page shows any error), so
// a typed amount or note is only cleared once it's saved.
export default function CompletionControl({ node, onLogProgress, onUndo, onAddNote, className = "" }) {
  if (node.tracking_method === "checkbox") return <CheckboxControl node={node} onLogProgress={onLogProgress} onUndo={onUndo} className={className} />;
  if (node.tracking_method === "counter") return <CounterControl node={node} onLogProgress={onLogProgress} onUndo={onUndo} className={className} />;
  if (node.tracking_method === "note") return <NoteControl node={node} onAddNote={onAddNote} className={className} />;
  return null;
}

function isDone(node) {
  return node.is_daily ? isDailyDoneToday(node) : Boolean(node.is_completed);
}

// "Done today · Undo". Undo is offered while the check-in is today's,
// which is what the server can take back.
function DoneRow({ node, onUndo, className }) {
  const [undoing, setUndoing] = useState(false);
  const label = node.is_daily ? "Done today" : "Completed";

  async function undo() {
    if (undoing) return;
    setUndoing(true);
    try {
      await onUndo?.(node);
    } finally {
      setUndoing(false);
    }
  }

  return (
    <div className={`goal-check goal-check--done ${className}`}>
      <span className="goal-check__done">
        <Check size={16} strokeWidth={2.5} />
        {label}
      </span>
      {onUndo && checkedInToday(node) && (
        <button type="button" className="btn btn--sm" onClick={undo} disabled={undoing}>
          {undoing ? "Undoing…" : "Undo"}
        </button>
      )}
    </div>
  );
}

function CheckboxControl({ node, onLogProgress, onUndo, className }) {
  const [saving, setSaving] = useState(false);
  const target = Number(node.target_number) || 1;
  const current = getTodayAdjustedCurrent(node);

  if (isDone(node)) return <DoneRow node={node} onUndo={onUndo} className={className} />;

  async function checkIn() {
    if (saving) return;
    setSaving(true);
    try {
      await onLogProgress(node, 1);
    } finally {
      setSaving(false);
    }
  }

  let label = node.is_daily ? "Check in for today" : "Mark complete";
  if (target > 1) label = `Check in (${current} of ${target})`;

  return (
    <div className={`goal-check ${className}`}>
      <button type="button" className="btn btn--accent goal-check__main" onClick={checkIn} disabled={saving}>
        <Check size={16} strokeWidth={2.5} />
        {saving ? "Checking in…" : label}
      </button>
    </div>
  );
}

function CounterControl({ node, onLogProgress, onUndo, className }) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const target = Number(node.target_number) || 0;
  const current = getTodayAdjustedCurrent(node);
  const value = Number(amount);
  const valid = amount !== "" && Number.isFinite(value) && value > 0;

  if (isDone(node)) {
    return (
      <>
        {target > 0 && <div className="goal-check__count">{formatCount(current, target, node.is_daily)}</div>}
        <DoneRow node={node} onUndo={onUndo} className={className} />
      </>
    );
  }

  // No <form>/onSubmit here on purpose — a native form submit on a
  // type="number" input can get silently blocked by the browser's own
  // constraint validation (invalid/empty value) with no visible error,
  // which is exactly the "sometimes Enter just does nothing" symptom.
  // Handling Enter directly on the input sidesteps that entirely.
  async function log() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      if (await onLogProgress(node, value)) setAmount("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`goal-check ${className}`}>
      {target > 0 && <div className="goal-check__count">{formatCount(current, target, node.is_daily)}</div>}
      <div className="goal-check__row">
        <input
          className="input goal-check__amount"
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              log();
            }
          }}
          placeholder="Amount"
          aria-label={`Amount to log on ${node.title}`}
          disabled={saving}
        />
        <button type="button" className="btn btn--accent" onClick={log} disabled={saving || !valid}>
          {saving ? "Logging…" : "Log"}
        </button>
      </div>
    </div>
  );
}

function formatCount(current, target, daily) {
  const n = (x) => Number(x).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${n(current)} of ${n(target)}${daily ? " today" : ""}`;
}

// Reflection counts the same as a checkbox tap here — writing the note
// *is* the action, no percentage attached.
function NoteControl({ node, onAddNote, className }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      if (await onAddNote(node, text)) setText("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`goal-check ${className}`}>
      <div className="goal-check__row">
        <input
          className="input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a note…"
          aria-label={`Note on ${node.title}`}
          disabled={saving}
        />
        <button type="button" className="btn btn--accent" onClick={add} disabled={saving || !text.trim()}>
          {saving ? "Adding…" : "Add"}
        </button>
      </div>
    </div>
  );
}
