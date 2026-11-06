import { useMemo, useState } from "react";
import { Check, Trash2, Bookmark, Repeat, ChevronDown, ChevronRight, X } from "lucide-react";
import Sheet from "../ascent/Sheet";
import ChunkNotes from "../day/ChunkNotes";
import { BLOCK_COLORS, colorOf, colorValue, toMin, toTime, fmtHours } from "../../lib/schedule";
import { parseDateStr } from "../../lib/planDates";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LENGTHS = [15, 30, 60, 90, 120];

// One block: add it, or change it. Name, when, and a colour up top, since
// that's what the schedule shows; then what you'll do in it; then the rest
// (repeating weekly, category, quest, notes) folded away under "More".
//
//   chunk     the block being changed, or null for a new one
//   defaults  { start, end } for a new block
//   tasks     the block's tasks, top level; subs maps a task to its sub-tasks
//   onSave(fields, { repeat })  resolves true when saved
export default function BlockSheet({
  chunk,
  defaults,
  date,
  tasks = [],
  subs = new Map(),
  categories = [],
  questOptions = [],
  onSave,
  onDelete,
  onClose,
  onTask,
  onSavePreset,
  onStopRepeat,
}) {
  const isNew = !chunk;
  const [title, setTitle] = useState(chunk?.title ?? "");
  const [start, setStart] = useState(chunk ? chunk.start_time.slice(0, 5) : defaults.start);
  const [end, setEnd] = useState(chunk ? chunk.end_time.slice(0, 5) : defaults.end);
  const [color, setColor] = useState(chunk?.color ?? "plain");
  const [category, setCategory] = useState(chunk?.category ?? "");
  const [questTag, setQuestTag] = useState(chunk?.camp_id ? `c:${chunk.camp_id}` : chunk?.quest_id ? `q:${chunk.quest_id}` : "");
  const [repeat, setRepeat] = useState(false);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [presetName, setPresetName] = useState(null); // null = not saving one

  const weekday = WEEKDAY[parseDateStr(date).getDay()];
  const standing = Boolean(chunk?.standing_block_id);
  const length = start && end ? (toMin(end) - toMin(start) + 24 * 60) % (24 * 60) : 0;

  const names = useMemo(() => {
    const list = categories.map((c) => c.name);
    if (chunk?.category && !list.includes(chunk.category)) list.unshift(chunk.category);
    return list;
  }, [categories, chunk?.category]);

  function setLength(min) {
    if (!start) return;
    setEnd(toTime(Math.min(toMin(start) + min, 24 * 60 - 1)));
  }

  async function submit(e) {
    e?.preventDefault();
    if (busy) return;
    if (!title.trim()) return setProblem("Give the block a name.");
    if (!start || !end) return setProblem("Pick when it starts and ends.");
    if (start === end) return setProblem("It can't start and end at the same time.");
    setProblem(null);
    setBusy(true);
    const o = questOptions.find((x) => x.value === questTag);
    const ok = await onSave(
      {
        title: title.trim(),
        start_time: start,
        end_time: end,
        color: colorValue(color),
        category: category || null,
        quest_id: o?.questId ?? (questTag && !o ? chunk?.quest_id ?? null : null),
        camp_id: o?.campId ?? (questTag && !o ? chunk?.camp_id ?? null : null),
      },
      { repeat }
    );
    if (!ok) setBusy(false);
  }

  async function savePreset(e) {
    e.preventDefault();
    const name = presetName?.trim();
    if (!name || busy) return;
    setBusy(true);
    const ok = await onSavePreset(name, { title: title.trim() || chunk.title, start, end, color: colorValue(color), category: category || null });
    setBusy(false);
    if (ok) setPresetName(null);
  }

  return (
    <Sheet title={isNew ? "New block" : "Block"} onClose={onClose}>
      {/* Not a <form>: the notes inside have buttons of their own. */}
      <div className="bsheet">
        <label className="field bsheet__field">
          <span>What</span>
          <input
            className="input input--lg"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit(e)}
            placeholder="e.g. Deep work"
            autoFocus={isNew}
          />
        </label>

        <div className="bsheet__times">
          <label className="field bsheet__field">
            <span>Starts</span>
            <input type="time" className="input" value={start} step={300} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label className="field bsheet__field">
            <span>Ends</span>
            <input type="time" className="input" value={end} step={300} onChange={(e) => setEnd(e.target.value)} required />
          </label>
        </div>
        <div className="bsheet__lengths" role="group" aria-label="Length">
          {LENGTHS.map((m) => (
            <button key={m} type="button" className="toggle-chip" aria-pressed={length === m} onClick={() => setLength(m)}>
              {fmtHours(m)}
            </button>
          ))}
          {length > 0 && !LENGTHS.includes(length) && <span className="bsheet__len">{fmtHours(length)}</span>}
        </div>
        {start && end && end < start && <p className="bsheet__hint">Ends after midnight.</p>}

        <div className="bsheet__label">Color</div>
        <div className="swatches" role="radiogroup" aria-label="Color">
          {BLOCK_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={colorOf(color).key === c.key}
              aria-label={c.name}
              title={c.name}
              className={"swatch" + (c.key === "plain" ? " swatch--plain" : "")}
              style={{ "--sw": c.hex }}
              onClick={() => setColor(c.key)}
            >
              {colorOf(color).key === c.key && <Check size={13} strokeWidth={3} />}
            </button>
          ))}
        </div>
        {standing && <p className="bsheet__hint">A new color here goes on this block every week from now on.</p>}

        {!isNew && (
          <div className="bsheet__tasks">
            <div className="bsheet__label">Tasks in this block</div>
            {tasks.length === 0 && <p className="bsheet__hint">Nothing in it yet. Add what you'll do here.</p>}
            <ul className="bsheet__list">
              {tasks.map((t) => (
                <TaskLine key={t.id} task={t} subs={subs.get(t.id) ?? []} onTask={onTask} />
              ))}
            </ul>
            <AddTask onAdd={(text) => onTask("add", { title: text })} />
          </div>
        )}

        <button type="button" className="bsheet__more" aria-expanded={more} onClick={() => setMore((v) => !v)}>
          {more ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          More
          <span className="bsheet__more-hint">{isNew ? "repeat weekly, category, quest" : "repeat, category, quest, notes, preset"}</span>
        </button>

        {more && (
          <div className="bsheet__extra">
            {standing ? (
              <div className="bsheet__repeat">
                <Repeat size={14} />
                <span>Repeats every {weekday}</span>
                <button type="button" className="btn-link btn-link--danger" onClick={onStopRepeat} disabled={busy}>
                  Stop repeating
                </button>
              </div>
            ) : (
              <label className="bsheet__check">
                <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
                <span>Repeat every {weekday}</span>
              </label>
            )}

            <div className="bsheet__times">
              <label className="field bsheet__field">
                <span>Category (for minutes)</span>
                <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">None</option>
                  {names.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              {(questOptions.length > 0 || questTag) && (
                <label className="field bsheet__field">
                  <span>Quest</span>
                  <select className="input" value={questTag} onChange={(e) => setQuestTag(e.target.value)}>
                    <option value="">None</option>
                    {questTag && !questOptions.some((o) => o.value === questTag) && <option value={questTag}>The quest it was on</option>}
                    {questOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.campId ? `  · ${o.short}` : o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {!isNew && <ChunkNotes chunk={chunk} date={date} />}

            {!isNew &&
              (presetName === null ? (
                <button type="button" className="btn-link bsheet__preset" onClick={() => setPresetName(chunk.title)}>
                  <Bookmark size={13} />
                  Save this block as a preset
                </button>
              ) : (
                <div className="bsheet__preset-form">
                  <input
                    className="input"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    aria-label="Preset name"
                    placeholder="Preset name"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") savePreset(e);
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        setPresetName(null);
                      }
                    }}
                  />
                  <button type="button" className="btn btn--sm btn--accent" onClick={savePreset} disabled={busy || !presetName.trim()}>
                    Save preset
                  </button>
                  <button type="button" className="btn btn--sm btn--ghost" onClick={() => setPresetName(null)}>
                    Cancel
                  </button>
                </div>
              ))}
          </div>
        )}

        {problem && (
          <p className="bsheet__problem" role="alert">
            {problem}
          </p>
        )}

        <div className="bsheet__actions">
          {!isNew && (
            <button type="button" className="btn-link btn-link--danger" onClick={onDelete} disabled={busy} style={{ minHeight: 40 }}>
              <Trash2 size={13} />
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn--accent" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : isNew ? "Add block" : "Save"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function TaskLine({ task, subs, onTask, isSub = false }) {
  return (
    <li className={"bsheet__task" + (task.status ? " is-done" : "") + (isSub ? " is-sub" : "")}>
      <label className="bsheet__task-row">
        <input type="checkbox" checked={Boolean(task.status)} onChange={() => onTask("toggle", task)} />
        <span className="bsheet__task-title">{task.title}</span>
      </label>
      <button type="button" className="btn-icon bsheet__task-x" aria-label={`Delete “${task.title}”`} title="Delete" onClick={() => onTask("remove", task)}>
        <X size={14} />
      </button>
      {subs.length > 0 && (
        <ul className="bsheet__list bsheet__subs">
          {subs.map((s) => (
            <TaskLine key={s.id} task={s} subs={[]} onTask={onTask} isSub />
          ))}
        </ul>
      )}
    </li>
  );
}

// The words stay until the task is saved, so a failed add keeps them.
function AddTask({ onAdd }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  async function add(e) {
    e?.preventDefault();
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true);
    const ok = await onAdd(v);
    setBusy(false);
    if (ok) setValue("");
  }
  return (
    <div className="bsheet__add">
      <input
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a task…"
        aria-label="Add a task"
        onKeyDown={(e) => {
          if (e.key === "Enter") add(e);
        }}
      />
      <button type="button" className="btn btn--sm" onClick={add} disabled={busy || !value.trim()}>
        Add
      </button>
    </div>
  );
}
