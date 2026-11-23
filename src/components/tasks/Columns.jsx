import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addSection, resolveSection } from "../../lib/api";
import { haptic } from "../../lib/haptics";
import { todayStr } from "../../lib/planDates";
import { STEP_COLORS } from "../camp/ColorPick";
import { useConfirm, useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import { addTo, BYPOS, clipSectionOf, dropSection, getSteps, loadCamp, moveSteps, renameSection, setSection, useTasksStore } from "../../lib/tasksStore";
import TaskRow, { AddTask } from "./TaskRow";
import { useTaskActions } from "./useTaskActions";

const HEX = Object.fromEntries(STEP_COLORS.map((c) => [c.key, c.hex]));

// One camp's columns, side by side (Aaron, 2026-11-23): "create as many new
// columns as i want (they line up horizontally and I can scrub through
// them". Each is one of the camp's sections (not its clipboard ones). Steps
// that sit in no section show first, as "No column", only while there are
// any. On a phone the row swipes sideways a column at a time, the next one
// peeking in; on a desk they sit side by side.
export default function Columns({ userId, camp }) {
  const toast = useToast();
  const { sections, steps, loadedCamps } = useTasksStore();
  const actions = useTaskActions();
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = () =>
    loadCamp(userId, camp.id)
      .then(() => setError(null))
      .catch((err) => setError(err));
  useEffect(() => {
    if (userId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, camp.id]);

  const cols = useMemo(() => sections.filter((s) => s.camp_id === camp.id && !s.clipboard).sort(BYPOS), [sections, camp.id]);
  const tops = useMemo(() => {
    const by = new Map();
    for (const st of steps) {
      if (st.camp_id !== camp.id || st.parent_id) continue;
      const k = st.section_id ?? "";
      by.set(k, [...(by.get(k) ?? []), st]);
    }
    for (const list of by.values()) list.sort(BYPOS);
    return by;
  }, [steps, camp.id]);
  const loose = (tops.get("") ?? []).filter((st) => !st.done_on);

  if (!loadedCamps.has(camp.id)) return error ? <LoadError what="this camp's columns" error={error} onRetry={load} /> : <p className="empty">Loading…</p>;

  async function newColumn(title) {
    try {
      const at = cols.reduce((m, c) => Math.max(m, (c.position ?? 0) + 1), 0);
      const sec = await addSection(userId, camp.id, { title, position: at });
      setSection(sec);
      haptic("success");
      setTimeout(() => document.querySelector(`.tk-col[data-section="${sec.id}"]`)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" }), 60);
      return true;
    } catch (err) {
      toast.error(err, "Couldn't make that column.");
      return false;
    }
  }

  const { removeColumn, addIn, rename } = useColumnOps(userId);

  return (
    <>
      {error && <LoadError what="this camp's columns" error={error} onRetry={load} stale />}
      <div className="tk-cols" data-hscroll>
        {loose.length > 0 && <Column title="No column" campId={camp.id} sectionId={null} items={tops.get("") ?? []} actions={actions} onAdd={(t) => addIn(camp.id, null, t)} />}
        {cols.map((sec) => (
          <Column
            key={sec.id}
            title={sec.title}
            color={HEX[sec.color]}
            campId={camp.id}
            sectionId={sec.id}
            items={tops.get(sec.id) ?? []}
            actions={actions}
            onAdd={(t) => addIn(camp.id, sec.id, t)}
            onRename={(title) => rename(sec, title)}
            onRemove={() => removeColumn(sec)}
          />
        ))}
        <div className="tk-col tk-col--new">
          {adding ? (
            <NewColumn onDone={() => setAdding(false)} onSave={newColumn} />
          ) : (
            <button type="button" className="tk-newcol" onClick={() => setAdding(true)}>
              <Plus size={16} aria-hidden="true" />
              New column
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// What a column's own buttons do, on a camp's row and on the Tasks home.
export { HEX };

export function useColumnOps(userId, { onRemoved } = {}) {
  const toast = useToast();
  const confirm = useConfirm();

  async function removeColumn(sec) {
    const open = getSteps().filter((st) => st.section_id === sec.id && !st.parent_id && !st.done_on);
    const ok = await confirm({
      title: `Delete the column “${sec.title}”?`,
      body: open.length
        ? `Its ${open.length} open ${open.length === 1 ? "task goes" : "tasks go"} back on the clipboard. Finished ones still count.`
        : "Finished tasks in it still count.",
      confirmLabel: "Delete column",
    });
    if (!ok) return;
    try {
      if (open.length) {
        const clip = await clipSectionOf(userId, sec.camp_id);
        await moveSteps(
          open.map((st) => st.id),
          { campId: sec.camp_id, sectionId: clip.id }
        );
      }
      await resolveSection(sec.id, todayStr());
      dropSection(sec.id);
      onRemoved?.(sec);
      haptic("tap");
    } catch (err) {
      toast.error(err, "Couldn't delete that column.");
    }
  }

  async function addIn(campId, sectionId, texts) {
    try {
      await addTo(userId, campId, sectionId, texts);
      haptic("tap");
      return true;
    } catch (err) {
      toast.error(err, "Couldn't add that.");
      return false;
    }
  }

  const rename = (sec, title) => renameSection(sec.id, title).catch((err) => toast.error(err, "Couldn't rename that column."));

  return { removeColumn, addIn, rename };
}

export function Column({ title, color, campId, sectionId, items, actions, onAdd, onRename, onRemove, where = null }) {
  const [showDone, setShowDone] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const open = items.filter((st) => !st.done_on);
  const done = items.filter((st) => st.done_on);
  const { onTick, onText, onDrop, kidsOf } = actions;
  const row = (st) => <TaskRow key={st.id} step={st} childrenOf={kidsOf} onTick={onTick} onText={onText} onDrop={onDrop} />;

  return (
    <section className="tk-col" style={color ? { "--col": color } : undefined} aria-label={title} data-col data-camp={campId} data-section={sectionId ?? ""}>
      {where}
      <header className="tk-col__head">
        {renaming ? (
          <input
            className="input tk-col__rename"
            defaultValue={title}
            autoFocus
            maxLength={200}
            aria-label="Column name"
            onBlur={(e) => {
              const t = e.target.value.trim();
              setRenaming(false);
              if (t && t !== title) onRename(t);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <button type="button" className="tk-col__title" onClick={() => onRename && setRenaming(true)} disabled={!onRename}>
            {title}
          </button>
        )}
        <small className="tk-col__count">{open.length}</small>
        {onRemove && !renaming && (
          <button type="button" className="btn-icon tk-col__del" onClick={onRemove} aria-label={`Delete the column “${title}”`} title="Delete column">
            <Trash2 size={14} />
          </button>
        )}
      </header>
      <ul className="tk-col__list">
        {open.map(row)}
        {open.length === 0 && <li className="tk-empty tk-empty--drop">Drop tasks here</li>}
      </ul>
      <AddTask onAdd={onAdd} />
      {done.length > 0 && (
        <>
          <button type="button" className="tk-col__done" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
            {showDone ? "Hide" : "Show"} {done.length} done
          </button>
          {showDone && <ul className="tk-col__list tk-col__list--done">{done.map(row)}</ul>}
        </>
      )}
    </section>
  );
}

export function NewColumn({ onSave, onDone }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const title = text.trim().slice(0, 200);
  return (
    <form
      className="tk-newcol-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title || busy) return;
        setBusy(true);
        const ok = await onSave(title);
        setBusy(false);
        if (ok) onDone();
      }}
    >
      <input className="input" value={text} placeholder="Name the column" aria-label="New column" autoFocus maxLength={200} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Escape" && onDone()} />
      <div className="tk-newcol-form__btns">
        <button type="submit" className="btn btn--sm btn--accent" disabled={!title || busy}>
          Add column
        </button>
        <button type="button" className="btn btn--sm" onClick={onDone} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
