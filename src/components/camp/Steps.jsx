import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, GripVertical, Pencil, Plus, StickyNote } from "lucide-react";
import { splitSteps } from "../../lib/camp";
import { fmtShortDate } from "../../lib/planDates";
import { Rich } from "./Rich";
import { useDragSort } from "../../lib/useDragSort";

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

// How urgent a step is (0084): a coloured mark beside its words.
export const URGENCY = [
  { key: "red", label: "Urgent" },
  { key: "yellow", label: "Soon" },
  { key: "green", label: "Can wait" },
];
const URGENCY_LABEL = Object.fromEntries(URGENCY.map((u) => [u.key, u.label]));

// One step: its box, its urgency, its words and the first of its note. Tap
// the words to open it: change the words, set how urgent it is, write notes,
// move it or take it off. Its sub-steps come in as `children`. With `sort`
// (from useDragSort) it has a handle to drag it into a new place.
// "Working on it…": a badge with a live pulse and dots that keep going.
function WorkingBadge() {
  return (
    <span className="camp-working" title="Working on it">
      <i className="camp-working__pulse" aria-hidden="true" />
      Working on it
      <span className="camp-working__dots" aria-hidden="true">
        <i>.</i>
        <i>.</i>
        <i>.</i>
      </span>
    </span>
  );
}

export function StepRow({ step, open, first, last, onOpen, onDone, onSave, onMove, onRemove, onMoveTo, sections, sort, children }) {
  const done = Boolean(step.done_on);
  const working = !done && Boolean(step.working_since);
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
    <li
      id={`step-${step.id}`}
      ref={sort?.ref}
      style={sort?.style}
      className={"camp-step" + (done ? " done" : "") + (open ? " open" : "") + (step.parent_id ? " camp-step--sub" : "") + (working ? " working" : "") + (sort?.lifted ? " lifted" : "")}
    >
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
            {step.urgency && <i className={`camp-urgency camp-urgency--${step.urgency}`} title={URGENCY_LABEL[step.urgency]} aria-label={URGENCY_LABEL[step.urgency]} />}
            <Rich text={step.text} />
          </span>
          {working && <WorkingBadge />}
          {step.note && !open && (
            <small className="camp-step__note">
              <StickyNote size={11} aria-hidden="true" />
              <span>{step.note}</span>
            </small>
          )}
        </button>
        {sort && <DragHandle {...sort.handle} label="Drag to move this step" />}
      </div>
      {open && (
        <div className="camp-step__edit">
          <label className="field">
            <span>{step.parent_id ? "Sub-step" : "Step"}</span>
            <textarea ref={textRef} className="textarea camp-grow" rows={1} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} onBlur={saveText} />
          </label>
          {!done && (
            <button
              type="button"
              className={"camp-working-toggle" + (working ? " on" : "")}
              aria-pressed={working}
              onClick={() => onSave({ working_since: working ? null : new Date().toISOString() })}
            >
              <i className="camp-working__pulse" aria-hidden="true" />
              {working ? "Working on it. Tap to stop" : "I'm working on this"}
            </button>
          )}
          <div className="field camp-urgency-pick" role="radiogroup" aria-label="Urgency">
            <span>Urgency</span>
            <div className="camp-urgency-pick__opts">
              {URGENCY.map((u) => (
                <button
                  key={u.key}
                  type="button"
                  role="radio"
                  aria-checked={step.urgency === u.key}
                  className={`camp-urgency-opt camp-urgency-opt--${u.key}` + (step.urgency === u.key ? " on" : "")}
                  onClick={() => onSave({ urgency: step.urgency === u.key ? null : u.key })}
                >
                  <i className={`camp-urgency camp-urgency--${u.key}`} aria-hidden="true" />
                  {u.label}
                </button>
              ))}
            </div>
          </div>
          {sections && (
            <label className="field">
              <span>Section</span>
              <select
                className="input"
                value={step.parent_id ? "under" : step.section_id ?? ""}
                onChange={(e) => e.target.value !== "under" && onMoveTo(e.target.value || null)}
              >
                {step.parent_id && <option value="under">Under its step</option>}
                {sections.map((s) => (
                  <option key={s.id ?? ""} value={s.id ?? ""}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
          )}
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

// The grip a step or section is dragged by. Only it starts a drag.
export function DragHandle({ label, ...props }) {
  return (
    <button type="button" className="drag-handle" aria-label={label} title={label} {...props}>
      <GripVertical size={16} aria-hidden="true" />
    </button>
  );
}

// A list of steps, each with its sub-steps under it, and theirs under them,
// as deep as they go. An open step also gets the box to add sub-steps;
// finishing a sub-step lays its bricks the same as a step. Each one drags
// by its handle into a new place among its neighbours; `onReorder` gets the
// list and its ids in the new order. Carried out of its list, a step goes
// to `onDragOut(phase, x, y, step)`, which can drop it in another section.
export function StepList({ list, openStep, hideDone, step, onAddSubs, onReorder, onDragOut, sub = false, children }) {
  const sort = useDragSort(
    list.map((x) => x.id),
    (ids) => onReorder(list, ids),
    { onOut: onDragOut && ((phase, x, y, id) => onDragOut(phase, x, y, list.find((st) => st.id === id))) }
  );
  return (
    <ul className={"camp-steps" + (sub ? " camp-subs" : "")}>
      {list.map((st, i) => {
        const subs = hideDone ? st.subs.filter((x) => !x.done_on) : st.subs;
        const open = openStep === st.id;
        return (
          <StepRow
            key={st.id}
            step={st}
            open={open}
            first={i === 0}
            last={i === list.length - 1}
            sort={list.length > 1 || onDragOut ? { ref: sort.ref(st.id), style: sort.style(st.id), handle: sort.handle(st.id), lifted: sort.dragging === st.id } : null}
            {...step(st, list)}
          >
            {(subs.length > 0 || open) && (
              <StepList list={subs} openStep={openStep} hideDone={hideDone} step={step} onAddSubs={onAddSubs} onReorder={onReorder} onDragOut={onDragOut} sub>
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
// matters, its note, its steps and the box to add more. With `sort` it has
// a handle to drag the whole section into a new place.
export function SectionCard({ section: s, open, hideDone, openStep, onToggle, onEdit, onAdd, onAddSubs, onReorder, onDragOut, step, sort }) {
  const shown = hideDone ? s.steps.filter((st) => !st.done_on) : s.steps;
  const hidden = s.steps.length - shown.length;
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  return (
    <section
      ref={sort?.ref}
      style={sort?.style}
      className={"card camp-sec" + (s.complete ? " complete" : "") + (open ? " open" : "") + (sort?.lifted ? " lifted" : "")}
      aria-labelledby={`sec-${s.id}`}
      data-drop={s.id}
    >
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
        {sort && <DragHandle {...sort.handle} label={`Drag to move ${s.title}`} />}
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
          {shown.length > 0 && <StepList list={shown} openStep={openStep} hideDone={hideDone} step={step} onAddSubs={onAddSubs} onReorder={onReorder} onDragOut={onDragOut} />}
          {hidden > 0 && <p className="ascent-mini camp-hidden">{hidden === 1 ? "1 done step hidden" : `${hidden} done steps hidden`}</p>}
          <AddStep onAdd={(texts) => onAdd(s.id, texts)} />
        </div>
      )}
    </section>
  );
}
