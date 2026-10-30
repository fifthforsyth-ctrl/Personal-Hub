import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, GripVertical, NotebookPen, Pencil, Plus, StickyNote } from "lucide-react";
import { splitSteps } from "../../lib/camp";
import { fmtShortDate } from "../../lib/planDates";
import { Rich } from "./Rich";
import { useDragSort } from "../../lib/useDragSort";
import { ColorPick, tintOf } from "./ColorPick";
import { CardBadge, ComputerPick } from "./ComputerPick";
import { SketchButton, SketchStrip, usePastePicture, useSketchScope } from "../sketch/Sketches";
import { pastedImage } from "../../lib/photo";
import { PhotoButton, PinTag, SectionPhotos, ShowPin } from "../photos/Bits";

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

// Its mark beside the words, and the choice of it in an open row. A quest's
// lines wear the same ones (0092).
export function UrgencyMark({ value }) {
  return value ? <i className={`camp-urgency camp-urgency--${value}`} title={URGENCY_LABEL[value]} aria-label={URGENCY_LABEL[value]} /> : null;
}

export function UrgencyPick({ value, onChange }) {
  return (
    <div className="field camp-urgency-pick" role="radiogroup" aria-label="Urgency">
      <span>Urgency</span>
      <div className="camp-urgency-pick__opts">
        {URGENCY.map((u) => (
          <button
            key={u.key}
            type="button"
            role="radio"
            aria-checked={value === u.key}
            className={`camp-urgency-opt camp-urgency-opt--${u.key}` + (value === u.key ? " on" : "")}
            onClick={() => onChange(value === u.key ? null : u.key)}
          >
            <i className={`camp-urgency camp-urgency--${u.key}`} aria-hidden="true" />
            {u.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// "Working on it…": a badge with a live pulse and dots that keep going.
export function WorkingBadge() {
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

// The small button under a tick (Aaron, 2026-10-28): tap it when you start
// on something, and it says so (and Today's board lifts it into "Working
// on"); tap again to stop. Ticking it done stops it too.
export function WorkingButton({ on, onToggle }) {
  return (
    <button
      type="button"
      className={"camp-work-btn" + (on ? " on" : "")}
      aria-pressed={on}
      aria-label={on ? "Working on it. Tap to stop" : "I'm working on this"}
      title={on ? "Working on it. Tap to stop" : "I'm working on this"}
      onClick={onToggle}
    >
      <i className="camp-working__pulse" aria-hidden="true" />
    </button>
  );
}

// One step: its box, its urgency, its words and the first of its note. Tap
// the words to open it: change the words, set how urgent it is, write notes,
// pick it for today or take it off today (`onToday`), move it or take it
// off. Its sub-steps come in as `children`. With `sort` (from useDragSort)
// it has a handle to drag it into a new place, or onto another step to go
// under it (`sort.nesting` is what it says while it's over one).
//
// Picked for today (`isToday`, 0090), it wears a small Today tag where it
// sits. In a Today section (`mirror`) it's the same step shown again: it
// says where it sits (`from`) and can't be moved or removed from there.
// While picking (`pick`), its box picks it instead of ticking it; in a
// section picked whole (`pick.locked`, 0091) it's picked with the section.
// On a quest's Today board (0092) it can wear a `badge` ("Working on", "On
// deck", its computer) and, open, the choice of its `computer`.
//
// A step can be a line of notes instead (`kind` "note", 0095): no box to
// tick, and `onKind` turns it into one or back. While selecting (`select`,
// 0095) its box and its words select it, to move with others; carried with
// others (`sort.group`), it says how many more come along.
export function StepRow({ step, open, first, last, onOpen, onDone, onSave, onKind, onMove, onRemove, onMoveTo, onToday, isToday, mirror, from, pick, select, idPrefix = "step", sections, sort, badge, computer, children }) {
  const asNote = step.kind === "note";
  const done = !asNote && Boolean(step.done_on);
  const working = !asNote && !done && Boolean(step.working_since);
  const [text, setText] = useState(step.text);
  const [note, setNote] = useState(step.note ?? "");
  useEffect(() => {
    setText(step.text);
    setNote(step.note ?? "");
  }, [step.id, step.text, step.note]);
  const textRef = useGrow(open ? text : "");
  const noteRef = useGrow(open ? note : "");
  const tint = tintOf(step.color);
  const paste = usePastePicture(step.id);

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
      id={`${idPrefix}-${step.id}`}
      ref={sort?.ref}
      style={tint.style || sort?.style ? { ...tint.style, ...sort?.style } : undefined}
      className={
        "camp-step" +
        (done ? " done" : "") +
        (open ? " open" : "") +
        (step.parent_id ? " camp-step--sub" : "") +
        (working ? " working" : "") +
        (sort?.lifted ? " lifted" : "") +
        (sort?.nesting ? " nesting" : "") +
        (mirror ? " mirror" : "") +
        (pick?.on ? " picked" : "") +
        (pick?.locked ? " with-sec" : "") +
        (select?.on ? " selected" : "") +
        (asNote ? " qs-line--note camp-step--note" : "") +
        (badge ? ` tb-row--${badge.kind}` : "") +
        tint.className
      }
    >
      <div className="camp-step__row">
        <div className="camp-check-col">
        {select ? (
          <button type="button" className="camp-pick camp-select" role="checkbox" aria-checked={select.on} aria-label={select.on ? "Selected. Tap to leave it out" : "Select"} onClick={select.toggle}>
            <Check size={13} strokeWidth={3} aria-hidden="true" />
          </button>
        ) : pick ? (
          <button
            type="button"
            className="camp-pick"
            role="checkbox"
            aria-checked={pick.on}
            aria-label={pick.locked ? "On today with its section" : pick.on ? "Picked for today. Tap to take it off" : "Pick for today"}
            disabled={pick.locked}
            onClick={pick.toggle}
          >
            <Check size={13} strokeWidth={3} aria-hidden="true" />
          </button>
        ) : asNote ? (
          <span className="qs-pen" aria-hidden="true">
            <NotebookPen size={13} />
          </span>
        ) : (
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
        )}
        {!select && !pick && !asNote && !done && onSave && <WorkingButton on={working} onToggle={() => onSave({ working_since: working ? null : new Date().toISOString() })} />}
        </div>
        <button
          type="button"
          className="camp-step__text"
          aria-expanded={pick || select ? undefined : open}
          aria-pressed={select ? select.on : pick ? pick.on : undefined}
          disabled={!select && pick?.locked}
          onClick={select ? select.toggle : pick ? pick.toggle : onOpen}
        >
          <CardBadge badge={badge} />
          {mirror && from && <small className="camp-step__from">{from}</small>}
          <span className="camp-step__words">
            {!asNote && <UrgencyMark value={step.urgency} />}
            <Rich text={step.text} />
            {step.pin_id && <PinTag pinId={step.pin_id} />}
            {isToday && !mirror && <span className="today-tag">Today</span>}
          </span>
          {working && <WorkingBadge />}
          {step.note && !open && (
            <small className="camp-step__note">
              <StickyNote size={11} aria-hidden="true" />
              <span>{step.note}</span>
            </small>
          )}
        </button>
        {sort && !pick && <DragHandle {...sort.handle} label={asNote ? "Drag to move this note" : "Drag to move this step"} />}
      </div>
      {sort?.nesting && <span className="nest-tag">{sort.nesting}</span>}
      {sort?.lifted && sort.group > 1 && !sort.nesting && <span className="nest-tag group-tag">{`+${sort.group - 1} more`}</span>}
      <SketchStrip itemId={step.id} />
      {open && (
        <div className="camp-step__edit" onPaste={paste}>
          <label className="field">
            <span>{asNote ? "Note" : step.parent_id ? "Sub-step" : "Step"}</span>
            <textarea ref={textRef} className="textarea camp-grow" rows={1} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} onBlur={saveText} />
          </label>
          {!asNote && <UrgencyPick value={step.urgency ?? null} onChange={(urgency) => onSave({ urgency })} />}
          <ColorPick value={step.color ?? null} onChange={(color) => onSave({ color })} />
          {computer && <ComputerPick {...computer} />}
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
              placeholder="What you found, what's left, links, or paste a picture…"
              onChange={(e) => setNote(e.target.value)}
              onBlur={saveNote}
              autoFocus
            />
          </label>
          <div className="camp-step__tools">
            <SketchButton itemId={step.id} />
            {step.pin_id && <ShowPin pinId={step.pin_id} />}
            {done && <span className="ascent-mini">Done {fmtShortDate(step.done_on)}</span>}
            <span className="spacer" />
            {onMove && (
              <>
                <button type="button" className="btn-icon" onClick={() => onMove(-1)} disabled={first} aria-label="Move up" title="Move up">
                  <ArrowUp size={15} />
                </button>
                <button type="button" className="btn-icon" onClick={() => onMove(1)} disabled={last} aria-label="Move down" title="Move down">
                  <ArrowDown size={15} />
                </button>
              </>
            )}
            {onKind && (
              <button type="button" className="btn-link" onClick={onKind}>
                {asNote ? "Make it a task" : "Make it a note"}
              </button>
            )}
            {onToday && (
              <button type="button" className={"btn-link" + (isToday ? "" : " btn-link--accent")} onClick={onToday}>
                {isToday ? "Off today" : "Do today"}
              </button>
            )}
            {onRemove && (
              <button type="button" className="btn-link" onClick={onRemove}>
                Remove
              </button>
            )}
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

// The steps a step can be dropped onto: any on the page where it sits (ids
// "step-…"), not their copies in Today.
const INTO_ROWS = "li.camp-step:not(.mirror):not(.qs-line) > .camp-step__row";

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
// Let go over another step on the page, it goes to `onInto(step, id)` with
// that step's id, to go under it.
// A Today section's list (`mirror`) doesn't drag, and its rows' ids start
// with `idPrefix` so they don't clash with the same steps where they sit.
// On Today's board (0092) each step is a card of its own that the board
// drags: `sortOf(id)` gives the top row its `sort` from there.
// While several are selected (0095), `carry(id)` says how many go with the
// one carried, and `onReorder` hears which one it was.
// With `cross` (as useDragSort takes it) the list is one column among
// others side by side, as on the clipboard.
export function StepList({ list, openStep, hideDone, step, onAddSubs, onReorder, onDragOut, onInto, mirror = false, idPrefix, sub = false, sortOf, carry, cross, children }) {
  const sort = useDragSort(
    list.map((x) => x.id),
    (ids, id) => onReorder?.(list, ids, id),
    {
      onOut: onDragOut && ((phase, x, y, id) => onDragOut(phase, x, y, list.find((st) => st.id === id))),
      into: onInto && {
        rows: INTO_ROWS,
        label: "Make it a sub-step",
        drop: (id, li) => onInto(list.find((st) => st.id === id), li.id.slice("step-".length)),
      },
      cross,
    }
  );
  const sortable = !mirror && onReorder && (list.length > 1 || onDragOut || onInto);
  return (
    <ul className={"camp-steps" + (sub ? " camp-subs" : "")}>
      {list.map((st, i) => {
        const subs = hideDone ? st.subs.filter((x) => !x.done_on) : st.subs;
        const props = step(st, list);
        const open = !props.pick && openStep === st.id;
        return (
          <StepRow
            key={st.id}
            step={st}
            open={open}
            first={i === 0}
            last={i === list.length - 1}
            sort={
              sortOf && !sub
                ? sortOf(st.id)
                : sortable
                  ? {
                      ref: sort.ref(st.id),
                      style: sort.style(st.id),
                      handle: sort.handle(st.id),
                      lifted: sort.dragging === st.id,
                      nesting: sort.dragging === st.id ? sort.nesting : null,
                      group: sort.dragging === st.id ? (carry?.(st.id) ?? 1) : 0,
                    }
                  : null
            }
            mirror={mirror}
            from={mirror && !sub ? st.from : null}
            idPrefix={idPrefix}
            {...props}
          >
            {(subs.length > 0 || open) && (
              <StepList list={subs} openStep={openStep} hideDone={hideDone} step={step} onAddSubs={onAddSubs} onReorder={onReorder} onDragOut={onDragOut} onInto={onInto} mirror={mirror} idPrefix={idPrefix} carry={carry} sub>
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
// `extra` sits at its end (a section's "Add a photo", 0096).
export function AddStep({ onAdd, label = "Add a step", hidden = false, extra = null }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useGrow(value);
  const count = splitSteps(value).length;
  const sketches = useSketchScope();

  // A picture pasted here (0098) makes a step of what's typed (or "Pasted
  // picture") and goes on it, where the page hands back the steps it made.
  async function pastePicture(e) {
    const file = sketches ? pastedImage(e.clipboardData) : null;
    if (!file || busy) return;
    e.preventDefault();
    const text = splitSteps(value)[0] ?? "Pasted picture";
    setBusy(true);
    const made = await onAdd([text]);
    setBusy(false);
    if (!made) return;
    setValue("");
    const row = Array.isArray(made) ? made[0] : null;
    if (row?.id) sketches.addImage(row.id, file);
    ref.current?.focus();
  }

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
      hidden={hidden}
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
        onPaste={pastePicture}
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
      {extra}
    </form>
  );
}

// A section: its number, name and how far along, then (open) why it
// matters, its note, its steps and the box to add more. With `sort` it has
// a handle to drag the whole section into a new place. Its photos (0096)
// sit above its steps. In a colour (0089)
// the whole card wears it. While picking for today it has no box to add,
// and (`pick`, 0091) a box of its own to pick the whole section; on today
// (`isToday`) it wears the Today tag.
export function SectionCard({ section: s, open, hideDone, openStep, onToggle, onEdit, onResolve, onAdd, onAddSubs, onReorder, onDragOut, onInto, step, sort, picking = false, pick = null, isToday = false, carry, cross }) {
  const shown = hideDone ? s.steps.filter((st) => !st.done_on) : s.steps;
  const hidden = s.steps.length - shown.length;
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  const tint = tintOf(s.color);
  return (
    <section
      ref={sort?.ref}
      style={tint.style || sort?.style ? { ...tint.style, ...sort?.style } : undefined}
      className={
        "card camp-sec" +
        (s.complete ? " complete" : "") +
        (open ? " open" : "") +
        (sort?.lifted ? " lifted" : "") +
        (tint.style ? " camp-sec--tinted" : "") +
        (pick?.on ? " picked" : "")
      }
      aria-labelledby={`sec-${s.id}`}
      data-drop={s.id}
    >
      <div className="camp-sec__head">
        {pick && (
          <button
            type="button"
            className="camp-pick camp-sec__pick"
            role="checkbox"
            aria-checked={pick.on}
            aria-label={pick.on ? `All of ${s.title} is picked for today. Tap to take it off` : `Pick all of ${s.title} for today`}
            onClick={pick.toggle}
          >
            <Check size={13} strokeWidth={3} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="camp-sec__toggle" aria-expanded={pick ? undefined : open} aria-pressed={pick ? pick.on : undefined} onClick={pick ? pick.toggle : onToggle}>
          <span className="camp-sec__n" aria-hidden="true">
            {s.complete ? <Check size={14} strokeWidth={3} /> : s.number}
          </span>
          <span className="camp-sec__name">
            <h2 id={`sec-${s.id}`}>{s.title}</h2>
            <small>
              {s.total ? `${s.done} of ${s.total}` : "No steps yet"}
              {isToday && !pick && <span className="today-tag">Today</span>}
            </small>
          </span>
          {!pick && <ChevronDown size={16} className="camp-sec__chev" aria-hidden="true" />}
        </button>
        {s.complete && onResolve && !pick && (
          <button type="button" className="btn btn--sm camp-sec__resolve" onClick={onResolve} title="Clear it out of the camp. What you finished in it stays in your village.">
            Resolve
          </button>
        )}
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
          <SectionPhotos sectionId={s.id} />
          {shown.length > 0 && <StepList list={shown} openStep={openStep} hideDone={hideDone} step={step} onAddSubs={onAddSubs} onReorder={onReorder} onDragOut={onDragOut} onInto={onInto} carry={carry} cross={cross} />}
          {hidden > 0 && <p className="ascent-mini camp-hidden">{hidden === 1 ? "1 done step hidden" : `${hidden} done steps hidden`}</p>}
          <AddStep hidden={picking} onAdd={(texts) => onAdd(s.id, texts)} extra={<PhotoButton sectionId={s.id} title={s.title} />} />
        </div>
      )}
    </section>
  );
}
