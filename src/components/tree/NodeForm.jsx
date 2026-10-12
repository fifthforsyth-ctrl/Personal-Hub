import { useEffect, useState } from "react";
import { X, CheckSquare, Hash, NotebookPen, ChevronDown, ChevronRight } from "lucide-react";
import GoalPicker from "../GoalPicker";

function emptyFields() {
  return {
    tracking_method: "checkbox",
    title: "",
    description: "",
    has_target_number: true,
    target_number: "1",
    is_daily: false,
    has_deadline: false,
    deadline_date: "",
    is_repeatable: false,
  };
}

const METHOD_OPTIONS = [
  { value: "checkbox", label: "Checkbox", Icon: CheckSquare, blurb: "Tap to check it off, once or every day." },
  { value: "counter", label: "Counter", Icon: Hash, blurb: "Log a number toward a target, like pages read or runs this week." },
  { value: "note", label: "Note", Icon: NotebookPen, blurb: "For goals that resist numbers: writing a note on it is the check-in." },
];

// Every goal picks a tracking method (Checkbox unless you choose another) and
// a place on the wheel. A goal you never break down works like a leaf;
// break it down later and it just also shows what's under it.
//
// `parentId` is where it goes now (null = top level); `goals` are the paths
// it may go under (the page leaves out the goal itself and everything under
// it); `pathById` names the current one.
export default function NodeForm({ node, parentId: startParentId = null, goals = [], pathById, onSave, onDelete, onClose }) {
  const isEditing = Boolean(node);
  const [fields, setFields] = useState(() =>
    node
      ? {
          tracking_method: node.tracking_method ?? "checkbox",
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
  const [parentId, setParentId] = useState(startParentId);
  const [picking, setPicking] = useState(false);
  const [showMore, setShowMore] = useState(() => Boolean(node?.has_deadline || node?.is_repeatable));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false); // "asking" while the confirm is up, then "deleting"
  const [problem, setProblem] = useState(null);

  // Escape closes the form, unless a picker or confirm on top of it is open.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape" || picking || document.querySelector(".sheet-backdrop")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picking, onClose]);

  function set(key, value) {
    setProblem(null);
    setFields((f) => ({ ...f, [key]: value }));
  }

  function chooseMethod(method) {
    setProblem(null);
    setFields((f) => ({
      ...f,
      tracking_method: method,
      has_target_number: method !== "note",
      target_number: method === "checkbox" ? "1" : method === "counter" && Number(f.target_number) > 1 ? f.target_number : "",
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving || deleting) return;
    const title = fields.title.trim();
    if (!title) {
      document.getElementById("goal-title")?.focus();
      return setProblem("Give the goal a title.");
    }
    const isCounter = fields.tracking_method === "counter";
    if (isCounter && !(Number(fields.target_number) > 0)) return setProblem("Set a target above zero.");
    if (fields.has_deadline && !fields.deadline_date) return setProblem("Pick the target date, or untick it.");

    const isNote = fields.tracking_method === "note";
    const payload = {
      tracking_method: fields.tracking_method,
      title,
      description: fields.description.trim() || null,
      has_target_number: !isNote,
      target_number: isNote ? null : Number(fields.target_number) || 1,
      is_daily: isNote ? false : fields.is_daily,
      has_deadline: fields.has_deadline,
      deadline_date: fields.has_deadline ? fields.deadline_date || null : null,
      is_repeatable: fields.is_repeatable,
    };
    setSaving(true);
    try {
      await onSave(payload, parentId);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (saving || deleting) return;
    setDeleting("asking");
    try {
      await onDelete(node, () => setDeleting("deleting"));
    } finally {
      setDeleting(false);
    }
  }

  const method = METHOD_OPTIONS.find((m) => m.value === fields.tracking_method) ?? METHOD_OPTIONS[0];
  const parentPath = parentId ? pathById?.get(parentId) ?? "A goal" : null;
  const heading = isEditing ? "Edit goal" : startParentId ? "New sub-goal" : "New goal";

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <form className="modal-card goal-form" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} noValidate aria-label={heading}>
          <div className="goal-form__head">
            <h3>{heading}</h3>
            <button type="button" className="btn-icon" onClick={onClose} aria-label="Close" title="Close">
              <X size={18} />
            </button>
          </div>

          <div className="field">
            <label htmlFor="goal-title">Title</label>
            <input id="goal-title" value={fields.title} onChange={(e) => set("title", e.target.value)} autoFocus autoComplete="off" />
          </div>

          <div className="field">
            <label id="goal-parent-label">Goes under</label>
            <button type="button" className="goal-form__parent" onClick={() => setPicking(true)} aria-labelledby="goal-parent-label goal-parent-value">
              <span id="goal-parent-value" className="truncate">
                {parentPath ?? "Top level"}
              </span>
              <span className="goal-form__change">Change</span>
            </button>
          </div>

          <div className="field">
            <label id="goal-method-label">How is progress tracked?</label>
            <div className="goal-form__methods" role="radiogroup" aria-labelledby="goal-method-label">
              {METHOD_OPTIONS.map(({ value, label, Icon }) => {
                const active = fields.tracking_method === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`goal-form__method ${active ? "is-active" : ""}`}
                    onClick={() => chooseMethod(value)}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
            <p className="goal-form__blurb">{method.blurb}</p>
          </div>

          {fields.tracking_method === "checkbox" && (
            <label className="check-row">
              <input type="checkbox" checked={fields.is_daily} onChange={(e) => set("is_daily", e.target.checked)} />
              <span>Every day (otherwise it's done once)</span>
            </label>
          )}

          {fields.tracking_method === "counter" && (
            <>
              <div className="field">
                <label htmlFor="goal-target">Target</label>
                <input
                  id="goal-target"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={fields.target_number}
                  onChange={(e) => set("target_number", e.target.value)}
                  placeholder="e.g. 100"
                />
              </div>
              <label className="check-row">
                <input type="checkbox" checked={fields.is_daily} onChange={(e) => set("is_daily", e.target.checked)} />
                <span>Target resets every day</span>
              </label>
              <p className="goal-form__blurb">This target still counts if you break the goal down into sub-goals later.</p>
            </>
          )}

          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="goal-description">Description</label>
            <textarea id="goal-description" value={fields.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          <button type="button" className="btn-link goal-form__more" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}>
            {showMore ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            More options
          </button>

          {showMore && (
            <>
              <div className="check-row goal-form__date-row">
                <label className="goal-form__inline">
                  <input type="checkbox" checked={fields.has_deadline} onChange={(e) => set("has_deadline", e.target.checked)} />
                  <span>Has a target date</span>
                </label>
                {fields.has_deadline && (
                  <input
                    type="date"
                    className="input goal-form__date"
                    value={fields.deadline_date}
                    onChange={(e) => set("deadline_date", e.target.value)}
                    aria-label="Target date"
                  />
                )}
              </div>
              <label className="check-row">
                <input type="checkbox" checked={fields.is_repeatable} onChange={(e) => set("is_repeatable", e.target.checked)} />
                <span>Repeatable — starts again from zero after it's completed (like reading the Book of Mormon again)</span>
              </label>
            </>
          )}

          {problem && (
            <p className="goal-form__problem" role="alert">
              {problem}
            </p>
          )}

          <div className="modal-actions goal-form__actions">
            {isEditing && (
              <button type="button" className="btn btn--danger" onClick={handleDelete} disabled={saving || deleting}>
                {deleting === "deleting" ? "Deleting…" : "Delete"}
              </button>
            )}
            <span className="spacer" />
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--accent" disabled={saving || deleting}>
              {saving ? "Saving…" : isEditing ? "Save" : "Add goal"}
            </button>
          </div>
        </form>
      </div>

      {/* Outside the form on purpose: the picker's rows are buttons, and
          inside a <form> a tap on one would submit it. */}
      {picking && (
        <GoalPicker
          goals={goals}
          value={parentId}
          allowNone
          noneLabel="Top level"
          noneHint="Not under another goal"
          placeholder="Find the goal it goes under…"
          onPick={(id) => {
            setParentId(id);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}
