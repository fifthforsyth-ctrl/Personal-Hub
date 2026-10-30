import { useRef, useState } from "react";
import { ClipboardList, Pencil, Pin, PinOff, Plus } from "lucide-react";
import { AddStep, StepList } from "./Steps";
import { NewSectionSheet } from "./Select";
import { PhotoButton, SectionPhotos } from "../photos/Bits";
import { tintOf } from "./ColorPick";
import Sheet from "../ascent/Sheet";
import "../../styles/clipboard.css";

// The clipboard (0095, Aaron 2026-10-30): where a meeting's hundred
// thoughts land as fast as he can jot them, in columns he makes in a
// moment, each in one of the quest's camps, to be sorted later into the
// sections he organizes. What's on it is the same as any step: it ticks,
// opens, takes notes and sketches, and can be made a note.
//
// On Quests the columns sit side by side (`layout` "row"), every camp's;
// on a camp's page, its own columns, in a card above its steps or pinned
// down the right side of the window ("stack") to drag from into the
// sections on the left. Each column is a camp section with `clipboard` on,
// so dragging works the way it does between sections: its box is a
// [data-drop] (with data-clip and the camp it's in).

export default function Clipboard({
  cols,
  layout = "row",
  camps,
  openStep,
  step,
  hideDone = false,
  onAdd,
  onAddSubs,
  onReorder,
  onDragOut,
  onInto,
  carry,
  onNewColumn,
  onEditColumn,
  tools,
  pinned = null,
  onPin,
  picking = false,
}) {
  const [making, setMaking] = useState(false);
  const colsRef = useRef(null);
  const count = cols.reduce((n, c) => n + countOf(c.section.steps), 0);
  // side by side, a step carried sideways leaves its column
  const cross = layout === "row" ? { scroller: () => colsRef.current } : {};
  return (
    <section className={`card clip clip--${layout}` + (pinned ? " clip--pinned" : "")} aria-labelledby="clip-h">
      <div className="clip-head">
        <h2 id="clip-h">
          <ClipboardList size={17} strokeWidth={2.3} aria-hidden="true" />
          Clipboard
        </h2>
        {count > 0 && <small>{count === 1 ? "1 thought" : `${count} thoughts`}</small>}
        <span className="spacer" />
        {tools}
        {onPin && (
          <button type="button" className="btn btn--sm clip-pin" aria-pressed={Boolean(pinned)} onClick={onPin} title={pinned ? "Put it back above the steps" : "Pin it down the right side"}>
            {pinned ? <PinOff size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />}
            <span>{pinned ? "Unpin" : "Pin to the right"}</span>
          </button>
        )}
      </div>
      {!cols.length && <p className="today-hint clip-empty">Jot down everything here as it comes, in columns you make, and sort it into sections later.</p>}
      <div className="clip-cols" ref={colsRef} data-drag-clip="">
        {cols.map((c) => (
          <ClipColumn
            key={c.section.id}
            col={c}
            showCamp={(camps?.length ?? 0) > 1}
            openStep={openStep}
            step={step}
            hideDone={hideDone}
            onAdd={onAdd}
            onAddSubs={onAddSubs}
            onReorder={onReorder}
            onDragOut={onDragOut}
            onInto={onInto}
            carry={carry}
            cross={cross}
            onEdit={onEditColumn}
            picking={picking}
          />
        ))}
        {onNewColumn && !picking && (
          <button type="button" className="clip-col clip-col--add" onClick={() => setMaking(true)}>
            <Plus size={15} aria-hidden="true" />
            New column
          </button>
        )}
      </div>
      {making && (
        <NewSectionSheet
          title="A new column"
          clipboard
          camps={camps}
          onSave={async (values) => {
            const ok = await onNewColumn(values);
            if (ok) setMaking(false);
          }}
          onClose={() => setMaking(false)}
        />
      )}
    </section>
  );
}

const countOf = (list) => (list ?? []).reduce((n, st) => n + 1 + countOf(st.subs), 0);

function ClipColumn({ col, showCamp, openStep, step, hideDone, onAdd, onAddSubs, onReorder, onDragOut, onInto, carry, cross, onEdit, picking }) {
  const s = col.section;
  const shown = hideDone ? s.steps.filter((st) => !st.done_on) : s.steps;
  const tint = tintOf(s.color);
  return (
    <section className={"clip-col" + tint.className} style={tint.style} data-drop={s.id} data-clip="" data-camp={s.camp_id} aria-label={`${col.camp?.title ? `${col.camp.title}: ` : ""}${s.title}`}>
      <div className="clip-col__head">
        <div className="clip-col__name">
          {showCamp && col.camp && <small className="clip-col__camp">{col.camp.title}</small>}
          <h3>{s.title}</h3>
        </div>
        {s.total > 0 && <small className="clip-col__count">{s.done ? `${s.done} of ${s.total}` : s.total}</small>}
        {onEdit && (
          <button type="button" className="btn-icon" onClick={() => onEdit(s)} aria-label={`Rename or remove ${s.title}`} title="Rename or remove">
            <Pencil size={13} />
          </button>
        )}
      </div>
      <SectionPhotos sectionId={s.id} />
      {shown.length > 0 && (
        <StepList list={shown} openStep={openStep} hideDone={hideDone} step={step} onAddSubs={onAddSubs} onReorder={onReorder} onDragOut={onDragOut} onInto={onInto} carry={carry} cross={cross} />
      )}
      {s.steps.length > shown.length && <p className="ascent-mini camp-hidden">{s.steps.length - shown.length} done, hidden</p>}
      <AddStep label="Jot it down" hidden={picking} onAdd={(texts) => onAdd(s, texts)} extra={<PhotoButton sectionId={s.id} title={s.title} />} />
    </section>
  );
}

// A column's name, or taking it off the clipboard (what's in it goes too,
// so the page asks first).
export function ColumnSheet({ section, onRename, onRemove, onClose }) {
  const [title, setTitle] = useState(section.title);
  return (
    <Sheet title="Clipboard column" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = title.trim();
          if (t && t !== section.title) onRename(t);
          onClose();
        }}
      >
        <label className="field">
          <span>Name</span>
          <input className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        <div className="ascent-sheet__actions">
          <button type="button" className="btn-link btn-link--danger" onClick={onRemove}>
            Remove column
          </button>
          <span className="spacer" />
          <button type="submit" className="btn btn--accent">
            Save
          </button>
        </div>
      </form>
    </Sheet>
  );
}
