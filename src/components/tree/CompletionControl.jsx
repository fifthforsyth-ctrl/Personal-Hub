import { useState } from "react";
import { Plus } from "lucide-react";
import { getTodayAdjustedCurrent, isDailyDoneToday } from "../../lib/dates";

export const pillBtnStyle = {
  background: "rgba(255,255,255,0.16)",
  border: "none",
  borderRadius: 6,
  padding: "10px 14px",
  fontSize: 10.5,
  fontWeight: 800,
  letterSpacing: "0.03em",
  color: "inherit",
  minHeight: 38,
};

const smallInputStyle = {
  width: 56,
  background: "rgba(255,255,255,0.1)",
  border: "none",
  borderRadius: 6,
  color: "inherit",
  padding: "8px 6px",
  fontSize: 12,
  fontFamily: "var(--font-mono)",
};

// Shared between the wedge detail panel and the Reporting tab, so logging
// progress behaves identically everywhere it appears. `className` is an
// optional passthrough for callers that need to style/target it.
export default function CompletionControl({ node, onLogProgress, onAddNote, className }) {
  if (node.tracking_method === "checkbox") {
    return <CheckboxControl node={node} onLogProgress={onLogProgress} className={className} />;
  }

  if (node.tracking_method === "counter") {
    return <CounterInput node={node} onLogProgress={onLogProgress} className={className} />;
  }

  if (node.tracking_method === "note") {
    return <NoteInput node={node} onAddNote={onAddNote} className={className} />;
  }

  return null;
}

function CheckboxControl({ node, onLogProgress, className }) {
  const [submitting, setSubmitting] = useState(false);
  const target = Number(node.target_number) || 1;
  const current = getTodayAdjustedCurrent(node);
  const done = node.is_daily ? isDailyDoneToday(node) : node.is_completed;

  async function fire() {
    if (done || submitting) return;
    setSubmitting(true);
    await onLogProgress(node, 1); // onLogProgress always resolves — errors are alert()'d upstream
    setSubmitting(false);
  }

  return (
    <button
      onClick={fire}
      disabled={done || submitting}
      className={className}
      style={{ ...pillBtnStyle, opacity: done || submitting ? 0.6 : 1 }}
    >
      {done ? (
        node.is_daily ? "DONE TODAY" : "COMPLETE"
      ) : (
        <>
          <Plus size={12} style={{ verticalAlign: -1, marginRight: 3 }} />
          {target > 1 ? `CHECK IN (${current}/${target})` : node.is_daily ? "CHECK IN" : "MARK COMPLETE"}
        </>
      )}
    </button>
  );
}

function CounterInput({ node, onLogProgress, className }) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const done = node.is_daily ? isDailyDoneToday(node) : node.is_completed;

  // No <form>/onSubmit here on purpose — a native form submit on a
  // type="number" input can get silently blocked by the browser's own
  // constraint validation (invalid/empty value) with no visible error,
  // which is exactly the "sometimes Enter just does nothing" symptom.
  // Handling Enter directly on the input sidesteps that entirely.
  async function fire() {
    const n = Number(amount);
    if (!n || n <= 0 || submitting) return;
    setSubmitting(true);
    await onLogProgress(node, n);
    setAmount("");
    setSubmitting(false);
  }

  if (done) {
    return (
      <span className={className} style={{ ...pillBtnStyle, opacity: 0.6, display: "inline-flex", alignItems: "center" }}>
        {node.is_daily ? "DONE TODAY" : "COMPLETE"}
      </span>
    );
  }

  return (
    <div className={className} style={{ display: "flex", gap: 6 }}>
      <input
        type="number"
        min="0"
        step="any"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            fire();
          }
        }}
        placeholder="+amount"
        disabled={submitting}
        style={smallInputStyle}
      />
      <button type="button" onClick={fire} disabled={submitting} style={{ ...pillBtnStyle, padding: "8px 10px", opacity: submitting ? 0.6 : 1 }}>
        LOG
      </button>
    </div>
  );
}

// Reflection/intentional thought counts the same as a checkbox tap here —
// writing the note *is* the action, no percentage attached.
function NoteInput({ node, onAddNote, className }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function fire() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    await onAddNote(node, text);
    setText("");
    setSubmitting(false);
  }

  return (
    <div className={className} style={{ display: "flex", gap: 6, width: "100%" }}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            fire();
          }
        }}
        placeholder="Add a note…"
        disabled={submitting}
        style={{ ...smallInputStyle, flex: 1, width: "auto" }}
      />
      <button type="button" onClick={fire} disabled={submitting} style={{ ...pillBtnStyle, padding: "8px 10px", opacity: submitting ? 0.6 : 1 }}>
        ADD
      </button>
    </div>
  );
}
