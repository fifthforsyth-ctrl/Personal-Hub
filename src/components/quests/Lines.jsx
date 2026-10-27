import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, NotebookPen, Plus, Repeat, StickyNote, Sun } from "lucide-react";
import { parseLines } from "../../lib/questTasks";
import { fmtShortDate } from "../../lib/planDates";
import { Rich } from "../camp/Rich";
import { ColorPick, tintOf } from "../camp/ColorPick";
import { SketchButton, SketchStrip } from "../sketch/Sketches";

// The pieces of a quest's running list: one line (a task he can tick or a
// line of notes) with its sub-tasks under it, the box he types into, and a
// day's list. They wear the camp checklist's look (camp.css), so a step and
// a task feel like the same thing.

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

// One line. Tap the words to open it: change them, write notes on what he
// did, add sub-tasks (on a top line), turn it into a note line or back,
// move it, put it on the ongoing list or off it (`onShift`, a top line
// only), pick it for today or take it off today (`onToday`), or take it off.
//
// Picked for today (`isToday`, 0090), it wears a small Today tag where it
// sits. In today's list (`mirror`) it's the same line shown again: it says
// where it's from (`from`) and is moved or removed only where it sits.
// While picking (`pick`), its box picks it instead of ticking it; a line
// that can't be picked (`locked`) waits, greyed, until picking is done.
export function LineRow({ line, open, first, last, onOpen, onDone, onSave, onKind, onMove, onShift, onToday, isToday, mirror, from, pick, locked = false, idPrefix = "line", onRemove, children }) {
  const note = line.kind === "note";
  const done = Boolean(line.done_on);
  const [text, setText] = useState(line.text);
  const [notes, setNotes] = useState(line.note ?? "");
  useEffect(() => {
    setText(line.text);
    setNotes(line.note ?? "");
  }, [line.id, line.text, line.note]);
  const textRef = useGrow(open ? text : "");
  const noteRef = useGrow(open ? notes : "");
  const tint = tintOf(line.color);

  function saveText() {
    const t = text.trim();
    if (!t) setText(line.text);
    else if (t !== line.text) onSave({ text: t });
  }
  function saveNotes() {
    const n = notes.trim() || null;
    if (n !== (line.note ?? null)) onSave({ note: n });
  }

  return (
    <li
      id={`${idPrefix}-${line.id}`}
      style={tint.style}
      className={
        "camp-step qs-line" +
        (done ? " done" : "") +
        (open ? " open" : "") +
        (note ? " qs-line--note" : "") +
        (line.parent_id ? " qs-line--sub" : "") +
        (mirror ? " mirror" : "") +
        (pick?.on ? " picked" : "") +
        (locked ? " locked" : "") +
        tint.className
      }
    >
      <div className="camp-step__row">
        {pick ? (
          <button type="button" className="camp-pick" role="checkbox" aria-checked={pick.on} aria-label={pick.on ? "Picked for today. Tap to take it off" : "Pick for today"} onClick={pick.toggle}>
            <Check size={13} strokeWidth={3} aria-hidden="true" />
          </button>
        ) : note ? (
          <span className="qs-pen" aria-hidden="true">
            <NotebookPen size={13} />
          </span>
        ) : (
          <button type="button" className="camp-check" role="checkbox" aria-checked={done} aria-label={done ? "Done. Tap to open it again" : "Mark done"} disabled={locked} onClick={onDone}>
            <Check size={13} strokeWidth={3} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="camp-step__text" aria-expanded={pick || locked ? undefined : open} aria-pressed={pick ? pick.on : undefined} disabled={locked} onClick={pick ? pick.toggle : onOpen}>
          {mirror && from && <small className="camp-step__from">{from}</small>}
          <span className="camp-step__words">
            <Rich text={line.text} />
            {isToday && !mirror && <span className="today-tag">Today</span>}
          </span>
          {line.note && !open && (
            <small className="camp-step__note">
              <StickyNote size={11} aria-hidden="true" />
              <span>{line.note}</span>
            </small>
          )}
        </button>
      </div>
      <SketchStrip itemId={line.id} />
      {open && (
        <div className="camp-step__edit">
          <label className="field">
            <span>{note ? "Note line" : line.parent_id ? "Sub-task" : "Task"}</span>
            <textarea ref={textRef} className="textarea camp-grow" rows={1} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} onBlur={saveText} />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea
              ref={noteRef}
              className="textarea camp-grow"
              rows={2}
              value={notes}
              maxLength={20000}
              placeholder={note ? "More on it…" : "What you did, what you found, what's left…"}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              autoFocus
            />
          </label>
          <ColorPick value={line.color ?? null} onChange={(color) => onSave({ color })} />
          <div className="camp-step__tools">
            <SketchButton itemId={line.id} />
            {done && <span className="ascent-mini">Done {fmtShortDate(line.done_on)}</span>}
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
            {onToday && (
              <button type="button" className={"btn-link" + (isToday ? "" : " btn-link--accent")} onClick={onToday}>
                {isToday ? "Off today" : "Do today"}
              </button>
            )}
            {onShift && !line.parent_id && (
              <button type="button" className="btn-link" onClick={onShift}>
                {line.ongoing ? "Put it on today" : "Make it ongoing"}
              </button>
            )}
            <button type="button" className="btn-link" onClick={onKind}>
              {note ? "Make it a task" : "Make it a note"}
            </button>
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

// The box at the foot of a list. Enter adds the line; a pasted list adds
// one line each, with indented lines going under the line above as
// sub-tasks. On a top list its button turns the next line into a note line
// instead of a task.
export function AddLine({ onAdd, sub = false, ongoing = false, autoFocus = false, hidden = false }) {
  const [value, setValue] = useState("");
  const [kind, setKind] = useState("task");
  const [busy, setBusy] = useState(false);
  const ref = useGrow(value);
  const lines = parseLines(value);
  const label = sub ? "Add a sub-task" : kind === "note" ? (ongoing ? "Write an ongoing note line" : "Write a note line") : ongoing ? "Add an ongoing task" : "Add a task";

  async function submit() {
    if (!lines.length || busy) return;
    setBusy(true);
    const ok = await onAdd(lines, kind);
    setBusy(false);
    if (ok) {
      setValue("");
      // most lines are tasks, so a note line is a one-off
      setKind("task");
    }
    ref.current?.focus();
  }

  return (
    <form
      className={"camp-add qs-add" + (sub ? " qs-add--sub" : "")}
      hidden={hidden}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {sub ? (
        <Plus size={14} aria-hidden="true" />
      ) : (
        <button
          type="button"
          className="qs-kind"
          aria-label={kind === "note" ? "Adding a note line. Tap to add a task" : "Adding a task. Tap to add a note line"}
          title={kind === "note" ? "Note line" : "Task"}
          onClick={() => setKind((k) => (k === "note" ? "task" : "note"))}
        >
          {kind === "note" ? <NotebookPen size={14} /> : <Plus size={15} />}
        </button>
      )}
      <textarea
        ref={ref}
        rows={1}
        className="camp-add__input"
        value={value}
        placeholder={label}
        aria-label={label}
        autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
      />
      {lines.length > 0 && (
        <button type="submit" className="btn btn--sm btn--accent" disabled={busy}>
          {busy ? "Adding…" : lines.length > 1 ? `Add ${lines.length}` : "Add"}
        </button>
      )}
    </form>
  );
}

// Lines with their sub-tasks under them, and (open) the box to add a
// sub-task under the line that's open. In today's list (`mirror`) the rows'
// ids start with `idPrefix`, so they don't clash with the same lines where
// they sit, and each top line says where it's from (`fromOf`).
export function LineTree({ items, openId, row, onAddSubs, mirror = false, idPrefix, fromOf, className = "" }) {
  return (
    <ul className={"camp-steps qs-lines" + className}>
      {items.map((it, i) => {
        const props = row(it, items);
        const open = !props.pick && openId === it.id;
        return (
        <LineRow key={it.id} line={it} open={open} first={i === 0} last={i === items.length - 1} mirror={mirror} from={mirror ? fromOf?.(it) : null} idPrefix={idPrefix} {...props}>
          {(it.subs.length > 0 || open) && (
            <ul className="camp-steps qs-subs">
              {it.subs.map((s, k) => (
                <LineRow key={s.id} line={s} open={openId === s.id} first={k === 0} last={k === it.subs.length - 1} mirror={mirror} idPrefix={idPrefix} {...row(s, it.subs)} />
              ))}
              {open && (
                <li className="qs-subs__add">
                  <AddLine sub onAdd={(lines) => onAddSubs(it, lines)} />
                </li>
              )}
            </ul>
          )}
        </LineRow>
        );
      })}
    </ul>
  );
}

// A day's list: its lines with their sub-tasks. Today's list ends with the
// box to add lines; an earlier day folds away to its name and how it went.
// Today's also takes what's picked for today from elsewhere (`lead`, 0090),
// counted in with `extra` ({ done, total, count }), and an `action` beside
// its name.
export function DayList({ day, label, sub, today, folded, onFold, openId, row, onAddSubs, lead, extra, action, children }) {
  const isToday = day.day === today;
  const open = !folded;
  const done = day.done + (extra?.done ?? 0);
  const total = day.total + (extra?.total ?? 0);
  const count = day.items.length + (extra?.count ?? 0);
  const tally = [sub, total ? `${done} of ${total} done` : count ? "Notes" : isToday ? null : "Nothing yet"].filter(Boolean).join(" · ");
  return (
    <section className={"card qs-day" + (isToday ? " qs-day--today today-card" : "") + (open ? " open" : "")} aria-label={label}>
      <div className="qs-day__head">
        {isToday ? (
          <div className="qs-day__title">
            <h2>
              <Sun size={17} strokeWidth={2.4} aria-hidden="true" />
              {label}
            </h2>
            <small>{tally}</small>
          </div>
        ) : (
          <button type="button" className="qs-day__title qs-day__toggle" aria-expanded={open} onClick={onFold}>
            <h2>{label}</h2>
            <small>{tally}</small>
            <ChevronDown size={16} className="qs-day__chev" aria-hidden="true" />
          </button>
        )}
        {action}
      </div>
      {open && lead}
      {open && day.items.length > 0 && <LineTree items={day.items} openId={openId} row={row} onAddSubs={onAddSubs} />}
      {open && children}
    </section>
  );
}

// The quest's ongoing list (Aaron, 2026-10-27): what stays on the quest
// whatever the day, from `ongoingList`. Lines done before today wait under
// a fold at the foot; the box to add lines comes in as `children`, and
// `action` sits beside its name.
export function OngoingList({ list, kind, openId, row, onAddSubs, action, children }) {
  const [showDone, setShowDone] = useState(false);
  const tally = list.total ? `${list.done} of ${list.total} done` : list.items.length ? "Notes" : null;
  return (
    <section className="card qs-day qs-day--ongoing open" aria-labelledby="qs-ongoing-h">
      <div className="qs-day__head">
        <div className="qs-day__title">
          <h2 id="qs-ongoing-h">
            <Repeat size={15} aria-hidden="true" />
            Ongoing
          </h2>
          {tally && <small>{tally}</small>}
        </div>
        {action}
      </div>
      {list.items.length > 0 ? (
        <LineTree items={list.items} openId={openId} row={row} onAddSubs={onAddSubs} />
      ) : (
        <p className="qs-hint">What stays on this {kind} whatever the day. It sits here until it's done.</p>
      )}
      {children}
      {list.earlier.length > 0 && (
        <>
          <button type="button" className="btn-link qs-ongoing__done" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
            {showDone ? "Hide" : "Show"} {list.earlier.length} done
            <ChevronDown size={14} className={showDone ? "flip" : ""} aria-hidden="true" />
          </button>
          {showDone && <LineTree items={list.earlier} openId={openId} row={row} onAddSubs={onAddSubs} className=" qs-lines--done" />}
        </>
      )}
    </section>
  );
}
