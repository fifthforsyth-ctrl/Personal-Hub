import { useEffect, useRef, useState } from "react";
import { Check, GripVertical } from "lucide-react";
import { beginDrag } from "../../lib/taskDrag";

// One task (or note) on a column or the clipboard: a circle to tick it, its
// words, tapped to change (emptied, it goes), and at the row's end a handle
// to carry it.
// Sub-steps sit under it and travel with it.
export default function TaskRow({ step, subs = [], depth = 0, onTick, onText, onDrop, childrenOf }) {
  const [editing, setEditing] = useState(false);
  const note = step.kind === "note";
  const done = Boolean(step.done_on);
  const kids = childrenOf ? childrenOf(step.id) : subs;

  return (
    <li className={"tk-row" + (done ? " is-done" : "") + (note ? " is-note" : "") + (depth ? " is-sub" : "")} {...(depth ? {} : { "data-row": step.id })}>
      <div className="tk-row__line">
        {note ? (
          <span className="tk-dot" aria-hidden="true" />
        ) : (
          <button type="button" className={"tk-tick" + (done ? " is-on" : "")} aria-label={done ? `Not done: ${step.text}` : `Done: ${step.text}`} aria-pressed={done} onClick={() => onTick(step)}>
            {done && <Check size={14} strokeWidth={3} aria-hidden="true" />}
          </button>
        )}
        {editing ? (
          <EditText text={step.text} onDone={(t) => { setEditing(false); if (t !== step.text) onText(step, t); }} />
        ) : (
          <button type="button" className="tk-text" onClick={() => setEditing(true)}>
            {step.text}
          </button>
        )}
        <button
          type="button"
          className="tk-grip"
          aria-label={`Move “${step.text}”`}
          onPointerDown={(e) => beginDrag(e, { ids: [step.id], label: step.text, onDrop: (to) => onDrop(step, to) })}
        >
          <GripVertical size={16} aria-hidden="true" />
        </button>
      </div>
      {kids.length > 0 && (
        <ul className="tk-subs">
          {kids.map((k) => (
            <TaskRow key={k.id} step={k} depth={depth + 1} onTick={onTick} onText={onText} onDrop={onDrop} childrenOf={childrenOf} />
          ))}
        </ul>
      )}
    </li>
  );
}

function EditText({ text, onDone }) {
  const [value, setValue] = useState(text);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  return (
    <textarea
      ref={ref}
      className="tk-edit"
      value={value}
      rows={1}
      aria-label="Task"
      onChange={(e) => {
        setValue(e.target.value);
        e.target.style.height = "auto";
        e.target.style.height = `${e.target.scrollHeight}px`;
      }}
      onBlur={() => onDone(value.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          setValue(text);
          onDone(text);
        }
      }}
    />
  );
}

// A line to type new tasks into: Enter adds it; several lines pasted at
// once become several tasks.
export function AddTask({ placeholder = "Add a task", onAdd }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    const texts = value
      .split(/\r?\n/)
      .map((t) => t.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
      .filter(Boolean)
      .map((t) => t.slice(0, 2000));
    if (!texts.length || busy) return;
    setBusy(true);
    const ok = await onAdd(texts);
    setBusy(false);
    if (ok !== false) setValue("");
  }
  return (
    <form
      className="tk-add"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        className="tk-add__input"
        value={value}
        rows={1}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
    </form>
  );
}
