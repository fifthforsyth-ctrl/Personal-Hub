import { useState } from "react";
import { X, CheckSquare, Hash, NotebookPen, ChevronDown, ChevronRight } from "lucide-react";

function emptyFields() {
  return {
    tracking_method: null,
    title: "",
    description: "",
    has_target_number: false,
    target_number: "",
    is_daily: false,
    has_deadline: false,
    deadline_date: "",
    is_repeatable: false,
  };
}

const METHOD_OPTIONS = [
  { value: "checkbox", label: "Checkbox", Icon: CheckSquare, blurb: "Tap to check off — once, or daily." },
  { value: "counter", label: "Counter", Icon: Hash, blurb: "Log a number toward a target." },
  { value: "note", label: "Note", Icon: NotebookPen, blurb: "Reflection, for goals that resist numbers — writing the note is the action." },
];

// Every goal picks a tracking method. A goal you never break down works like
// a leaf; break it down later and it just also shows what's under it.
export default function NodeForm({ node, presetParent, onSave, onDelete, onClose }) {
  const isEditing = Boolean(node);
  const [fields, setFields] = useState(() =>
    node
      ? {
          tracking_method: node.tracking_method,
          title: node.title,
          description: node.description ?? "",
          has_target_number: node.has_target_number,
          target_number: node.target_number ?? "",
          is_daily: node.is_daily,
          has_deadline: node.has_deadline,
          deadline_date: node.deadline_date ?? "",
          is_repeatable: node.is_repeatable,
        }
      : emptyFields()
  );
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function set(key, value) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function chooseMethod(method) {
    setFields((f) => ({
      ...f,
      tracking_method: method,
      has_target_number: method !== "note",
      target_number: method === "checkbox" ? "1" : f.target_number,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!fields.title.trim()) return;
    if (!fields.tracking_method) return;
    setSaving(true);
    try {
      const payload = {
        tracking_method: fields.tracking_method,
        title: fields.title.trim(),
        description: fields.description.trim() || null,
        has_target_number: fields.has_target_number,
        target_number: fields.has_target_number ? Number(fields.target_number) || 0 : null,
        is_daily: fields.is_daily,
        has_deadline: fields.has_deadline,
        deadline_date: fields.has_deadline ? fields.deadline_date || null : null,
        is_repeatable: fields.is_repeatable,
      };
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>
            {isEditing ? "Edit goal" : presetParent ? `New goal under "${presetParent.title}"` : "New goal"}
          </h3>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="field">
          <label>How is progress tracked?</label>
          <MethodPicker value={fields.tracking_method} onChange={chooseMethod} />
        </div>

        {fields.tracking_method === "checkbox" && (
          <div className="check-row">
            <input type="checkbox" checked={fields.is_daily} onChange={(e) => set("is_daily", e.target.checked)} />
            <span>Repeats daily (otherwise: one-time)</span>
          </div>
        )}

        {fields.tracking_method === "counter" && (
          <>
            <div className="field">
              <label>Target</label>
              <input
                type="number"
                min="0"
                step="any"
                value={fields.target_number}
                onChange={(e) => set("target_number", e.target.value)}
                placeholder="e.g. 100"
                required
              />
            </div>
            <div className="check-row">
              <input type="checkbox" checked={fields.is_daily} onChange={(e) => set("is_daily", e.target.checked)} />
              <span>Target resets daily</span>
            </div>
            <p className="placeholder-note" style={{ fontSize: 11.5, margin: "-6px 0 14px" }}>
              This target still counts even if you break this goal down into sub-goals later.
            </p>
          </>
        )}

        {fields.tracking_method === "note" && (
          <p className="placeholder-note" style={{ margin: "-4px 0 14px" }}>
            No target or number needed — jot a note on the goal whenever you've reflected on it. That's the whole action.
          </p>
        )}

        <div className="field">
          <label>Title</label>
          <input value={fields.title} onChange={(e) => set("title", e.target.value)} required autoFocus />
        </div>

        <div className="field">
          <label>Description</label>
          <textarea value={fields.description} onChange={(e) => set("description", e.target.value)} />
        </div>

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12.5,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            padding: "4px 0 14px",
          }}
        >
          {showMore ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          More options
        </button>

        {showMore && (
          <>
            <div className="check-row">
              <input type="checkbox" checked={fields.has_deadline} onChange={(e) => set("has_deadline", e.target.checked)} />
              <span>Has a target date</span>
              {fields.has_deadline && (
                <input
                  type="date"
                  value={fields.deadline_date}
                  onChange={(e) => set("deadline_date", e.target.value)}
                  style={{ marginLeft: "auto", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "4px 8px" }}
                />
              )}
            </div>

            <div className="check-row">
              <input type="checkbox" checked={fields.is_repeatable} onChange={(e) => set("is_repeatable", e.target.checked)} />
              <span>Repeatable — cycles back to 0 after completing (e.g. "read the Book of Mormon again")</span>
            </div>
          </>
        )}

        {confirmingDelete && (
          <p style={{ color: "#ffabaf", fontSize: 12.5, marginBottom: 10 }}>
            Delete "{node?.title}" and everything under it? This can't be undone.
          </p>
        )}

        <div className="modal-actions">
          {isEditing && !confirmingDelete && (
            <button type="button" className="btn-danger" onClick={() => setConfirmingDelete(true)}>
              Delete
            </button>
          )}
          {isEditing && confirmingDelete && (
            <button type="button" className="btn-danger" onClick={() => onDelete(node)}>
              Confirm delete
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => (confirmingDelete ? setConfirmingDelete(false) : onClose())}
          >
            Cancel
          </button>
          {!confirmingDelete && (
            <button type="submit" className="btn-primary" style={{ width: "auto", flex: 1 }} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function MethodPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {METHOD_OPTIONS.map(({ value: v, label, Icon, blurb }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            title={blurb}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: "12px 8px",
              borderRadius: 8,
              border: `1.5px solid ${active ? "var(--accent-strong)" : "var(--border)"}`,
              background: active ? "var(--accent-dim)" : "var(--bg-inset)",
              color: active ? "var(--text)" : "var(--text-muted)",
              boxShadow: active ? "var(--glow-accent)" : "none",
              transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s, color 0.15s",
            }}
          >
            <Icon size={18} />
            <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
