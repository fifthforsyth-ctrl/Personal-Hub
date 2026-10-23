import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Pencil, Plus, StickyNote } from "lucide-react";
import { splitSteps } from "../../lib/camp";
import { fmtShortDate } from "../../lib/planDates";
import { Rich } from "./Rich";

// The pieces of a camp's checklist: a step with its sub-steps, the box to
// add steps, and a section with its steps.

// A textarea that grows with what's in it.
function useGrow(value) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return ref;
}

// One step: its box, its words and the first of its note. Tap the words to
// open it: change the words, write notes, move it or take it off. Its
// sub-steps come in as `children`.
export function StepRow({ step, open, first, last, onOpen, onDone, onSave, onMove, onRemove, children }) {
  const done = Boolean(step.done_on);
  const [text, setText] = useState(step.text);
  const [note, setNote] = useState(step.note ?? "");
  useEffect(() => {
    setText(step.text);
    setNote(step.note ?? "");
  }, [step.id, step.text, step.note]);
  const textRef = useGrow(open ? text : "");
  const noteRef = useGrow(open ? note : "");

  function saveText() {
    const t = text.trim();
    if (!t) setText(step.text);
    else if (t !== step.text) onSave({ text: t });
  }
  function saveNote() {
    const n = note.trim() || null;
    if (n !== (step.note ?? null)) onSave({ note: n });
  }

  return (
    <li id={`step-${step.id}`} className={"camp-step" + (done ? " done" : "") + (open ? " open" : "") + (step.parent_id ? " camp-step--sub" : "")}>
      <div className="camp-step__row">
        <button
          type="button"
          className="camp-check"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? "Done. Tap to open it again" : "Mark done"}
          onClick={onDone}
        >
          <Check size={13} strokeWidth={3} aria-hidden="true" />
        </button>
        <button type="button" className="camp-step__text" aria-expanded={open} onClick={onOpen}>
          <span className="camp-step__words">
            <Rich text={step.text} />
          </span>
          {step.note && !open && (
            <small className="camp-step__note">
              <StickyNote size={11} aria-hidden="true" />
              <span>{step.note}</span>
            </small>
          )}
        </button>
      </div>
      {open && (
        <div className="camp-step__edit">
          <label className="field">
            <span>{step.parent_id ? "Sub-step" : "Step"}</span>
            <textarea ref={textRef} className="textarea camp-grow" rows={1} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} onBlur={saveText} />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea
              ref={noteRef}
              className="textarea camp-grow"
              rows={2}
              value={note}
              maxLength={4000}
              placeholder="What you found, what's left, links…"
              onChange={(e) => setNote(e.target.value)}
              onBlur={saveNote}
              autoFocus
            />
          </label>
          <div className="camp-step__tools">
            {done && <span className="ascent-mini">Done {fmtShortDate(step.done_on)}</span>}
            <span className="spacer" />
            <button type="button" className="btn-icon" onClick={() => onMove(-1)} disabled={first} aria-label="Move up" title="Move up">
              <ArrowUp size={15} />
            </button>
            <button type="button" className="btn-icon" onClick={() => onMove(1)} disabled={last} aria-label="Move down" title="Move down">
              <ArrowDown size={15} />
            </button>
            <button type="button" className="btn-link" onClick={onRemove}>
              Remove
            </button>
            <button type="button" className="btn btn--sm" onClick={onOpen}>
              Close
            </button>
          </div>
        </div>
      )}
      {children}
    </li>
  );
}

// A list of steps, each with its sub-steps under it, and theirs under them,
// as deep as they go. An open step also gets the box to add sub-steps;
// finishing a sub-step lays its bricks the same as a step.
export function StepList({ list, openStep, hideDone, step, onAddSubs, sub = false, children }) {
  return (
    <ul className={"camp-steps" + (sub ? " camp-subs" : "")}>
      {list.map((st, i) => {
        const subs = hideDone ? st.subs.filter((x) => !x.done_on) : st.subs;
        const open = openStep === st.id;
        return (
          <StepRow key={st.id} step={st} open={open} first={i === 0} last={i === list.length - 1} {...step(st, list)}>
            {(subs.length > 0 || open) && (
              <StepList list={subs} openStep={openStep} hideDone={hideDone} step={step} onAddSubs={onAddSubs} sub>
                {open && (
                  <li className="camp-subs__add">
                    <AddStep label="Add a sub-step" onAdd={(texts) => onAddSubs(st, texts)} />
                  </li>
                )}
              </StepList>
            )}
          </StepRow>
        );
      })}
      {children}
    </ul>
  );
}

// "Add a step": Enter adds it. A pasted list adds one step per line.
export function AddStep({ onAdd, label = "Add a step" }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useGrow(value);
  const count = splitSteps(value).length;

  async function submit() {
    const list = splitSteps(value);
    if (!list.length || busy) return;
    setBusy(true);
    const ok = await onAdd(list);
    setBusy(false);
    if (ok) setValue("");
    ref.current?.focus();
  }

  return (
    <form
      className="camp-add"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Plus size={15} aria-hidden="true" />
      <textarea
        ref={ref}
        rows={1}
        className="camp-add__input"
        value={value}
        placeholder={label}
        aria-label={label}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
      />
      {count > 0 && (
        <button type="submit" className="btn btn--sm btn--accent" disabled={busy}>
          {busy ? "Adding…" : count > 1 ? `Add ${count}` : "Add"}
        </button>
      )}
    </form>
  );
}

// A section: its number, name and how far along, then (open) why it
// matters, its note, its steps and the box to add more.
export function SectionCard({ section: s, open, hideDone, openStep, onToggle, onEdit, onAdd, onAddSubs, step }) {
  const shown = hideDone ? s.steps.filter((st) => !st.done_on) : s.steps;
  const hidden = s.steps.length - shown.length;
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  return (
    <section className={"card camp-sec" + (s.complete ? " complete" : "") + (open ? " open" : "")} aria-labelledby={`sec-${s.id}`}>
      <div className="camp-sec__head">
        <button type="button" className="camp-sec__toggle" aria-expanded={open} onClick={onToggle}>
          <span className="camp-sec__n" aria-hidden="true">
            {s.complete ? <Check size={14} strokeWidth={3} /> : s.number}
          </span>
          <span className="camp-sec__name">
            <h2 id={`sec-${s.id}`}>{s.title}</h2>
            <small>{s.total ? `${s.done} of ${s.total}` : "No steps yet"}</small>
          </span>
          <ChevronDown size={16} className="camp-sec__chev" aria-hidden="true" />
        </button>
        <button type="button" className="btn-icon" onClick={onEdit} aria-label={`Edit ${s.title}`} title="Edit section">
          <Pencil size={14} />
        </button>
      </div>
      {s.total > 0 && (
        <div className="camp-bar" aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </div>
      )}
      {open && (
        <div className="camp-sec__body">
          {s.why && (
            <p className="camp-sec__why">
              <Rich text={s.why} />
            </p>
          )}
          {s.note && (
            <p className="camp-sec__note">
              <Rich text={s.note} />
            </p>
          )}
          {shown.length > 0 && <StepList list={shown} openStep={openStep} hideDone={hideDone} step={step} onAddSubs={onAddSubs} />}
          {hidden > 0 && <p className="ascent-mini camp-hidden">{hidden === 1 ? "1 done step hidden" : `${hidden} done steps hidden`}</p>}
          <AddStep onAdd={(texts) => onAdd(s.id, texts)} />
        </div>
      )}
    </section>
  );
}
