import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  LayoutTemplate,
  Bookmark,
  Briefcase,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  CalendarCheck,
  Repeat,
} from "lucide-react";
import {
  fetchDayPlan,
  setDayEnergyTag,
  fetchTimeChunks,
  createTimeChunk,
  updateTimeChunk,
  deleteTimeChunk,
  deleteTimeChunks,
  fetchTasks,
  createTask,
  toggleTask,
  updateTask,
  deleteTask,
  deleteTasks,
  fetchTemplates,
  applyTemplate,
  saveDayAsTemplate,
  createChunkTemplate,
  deleteTemplate,
  setTaskWork,
  fetchCategories,
} from "../../lib/api";
import { fmtTimeRange, minutesOf } from "../../lib/planDates";
import { colorFor } from "../../lib/categories";
import { useLoad } from "../../lib/useLoad";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import ChunkNotes from "../day/ChunkNotes";
import { useChoiceSheet } from "./ChoiceSheet";
import "../../styles/plan.css";

const ENERGY_TAGS = ["Open day", "Heavy edit day", "Deep focus", "Recovery day"];

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const quote = (s, max = 40) => `“${s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s}”`;
const byStart = (a, b) => (a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0);
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function namesOf(list, max = 3) {
  const names = list.map((x) => `“${x.title}”`);
  if (names.length <= max) return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

// A single planned day: energy tag, its time blocks (each holding tasks and
// one level of sub-tasks), an unscheduled bucket, presets, and on today the
// tasks that stopped rolling forward.
//
// It loads and refreshes its own data. The page around it is only told
// (onDataChanged) when something it also shows changed — task counts, the
// energy tag — never on load and never for a moved block, so one checkbox
// tap doesn't reload the whole day twice.
export default function DayView({ userId, date, goalOptions = [], onDataChanged }) {
  const toast = useToast();
  const [choose, choiceSheet] = useChoiceSheet();

  // An unfinished task stays on the day it was planned; nothing carries it
  // forward. Move it yourself if you still want it.
  const { data, error, reload, mutate } = useLoad(async () => {
    if (!userId) return null;
    const [plan, chunks, tasks] = await Promise.all([
      fetchDayPlan(userId, date),
      fetchTimeChunks(userId, date),
      fetchTasks(userId, date),
    ]);
    return { date, plan, chunks, tasks };
  }, [userId, date]);

  const presets = useLoad(() => (userId ? fetchTemplates(userId) : []), [userId]);

  // Tell the page, once things settle. Debounced so ticking off three tasks
  // in a row refreshes the page once.
  const changedRef = useRef(onDataChanged);
  changedRef.current = onDataChanged;
  const notifyTimer = useRef(null);
  const notifyPage = useCallback(() => {
    clearTimeout(notifyTimer.current);
    notifyTimer.current = setTimeout(() => changedRef.current?.(), 400);
  }, []);
  useEffect(() => () => clearTimeout(notifyTimer.current), []);

  // Deletes wait six seconds for Undo; until then the row is only hidden.
  const [hidden, setHidden] = useState(() => new Set());
  const hide = useCallback((ids) => setHidden((h) => new Set([...h, ...ids])), []);
  const unhide = useCallback(
    (ids) =>
      setHidden((h) => {
        const next = new Set(h);
        for (const id of ids) next.delete(id);
        return next;
      }),
    []
  );

  // One write at a time per thing, so a double tap can't send two.
  const inFlight = useRef(new Set());
  const once = useCallback(async (key, fn) => {
    if (inFlight.current.has(key)) return undefined;
    inFlight.current.add(key);
    try {
      return await fn();
    } finally {
      inFlight.current.delete(key);
    }
  }, []);

  const [editing, setEditing] = useState(null); // a block id, "new", or null
  const [openRow, setOpenRow] = useState(null);
  const [presetsOpen, setPresetsOpen] = useState(null); // null = decide from the day
  const [busyPreset, setBusyPreset] = useState(null);

  useEffect(() => {
    setEditing(null);
    setOpenRow(null);
    setPresetsOpen(null);
  }, [date]);

  const allChunks = useMemo(() => data?.chunks ?? [], [data]);
  const chunks = useMemo(() => allChunks.filter((c) => !hidden.has(c.id)), [allChunks, hidden]);
  const { byChunk, unscheduled, subsByParent } = useMemo(() => {
    const live = new Set(chunks.map((c) => c.id));
    const byChunk = new Map();
    const unscheduled = [];
    const subsByParent = new Map();
    for (const t of data?.tasks ?? []) {
      if (hidden.has(t.id) || (t.parent_task_id && hidden.has(t.parent_task_id))) continue;
      if (t.parent_task_id) {
        if (!subsByParent.has(t.parent_task_id)) subsByParent.set(t.parent_task_id, []);
        subsByParent.get(t.parent_task_id).push(t);
      } else if (t.time_chunk_id && live.has(t.time_chunk_id)) {
        if (!byChunk.has(t.time_chunk_id)) byChunk.set(t.time_chunk_id, []);
        byChunk.get(t.time_chunk_id).push(t);
      } else {
        // Includes tasks whose block is waiting to be deleted: that's where
        // they'll be once it is.
        unscheduled.push(t);
      }
    }
    return { byChunk, unscheduled, subsByParent };
  }, [data, chunks, hidden]);

  const patchTask = (id, fields) =>
    mutate((d) => d && { ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...fields } : t)) });

  // --- tasks ---------------------------------------------------------------

  const act = {
    toggle: (task) =>
      once(`task:${task.id}`, async () => {
        const done = !task.status;
        patchTask(task.id, { status: done, completed_at: done ? new Date().toISOString() : null });
        try {
          await toggleTask(task.id, done);
          notifyPage();
        } catch (err) {
          patchTask(task.id, { status: task.status, completed_at: task.completed_at });
          toast.error(err, "Couldn't save that. Try again.");
        }
      }),

    add: async ({ chunkId = null, parentId = null, title }) => {
      const position = Math.max(-1, ...(data?.tasks ?? []).map((t) => t.position ?? 0)) + 1;
      try {
        const row = await createTask(userId, { date, time_chunk_id: chunkId, parent_task_id: parentId, title, position });
        mutate((d) => (d && d.date === row.date ? { ...d, tasks: [...d.tasks, row] } : d));
        notifyPage();
        return true;
      } catch (err) {
        toast.error(err, "Couldn't add that task.");
        return false;
      }
    },

    toggleWork: (task) =>
      once(`task:${task.id}`, async () => {
        const isWork = !task.is_work;
        patchTask(task.id, { is_work: isWork });
        try {
          await setTaskWork(task.id, isWork);
          toast.show(isWork ? "Marked as work — it'll be on the work report" : "Off the work report");
        } catch (err) {
          patchTask(task.id, { is_work: task.is_work });
          toast.error(err, "Couldn't change that.");
        }
      }),

    move: (task, chunkId) =>
      once(`task:${task.id}`, async () => {
        const prev = task.time_chunk_id ?? null;
        patchTask(task.id, { time_chunk_id: chunkId });
        try {
          await updateTask(task.id, { time_chunk_id: chunkId });
          const target = chunkId ? allChunks.find((c) => c.id === chunkId) : null;
          toast.show(target ? `Moved to ${quote(target.title)}` : "Moved to Unscheduled");
        } catch (err) {
          patchTask(task.id, { time_chunk_id: prev });
          toast.error(err, "Couldn't move that task.");
        }
      }),

    rename: async (task, title) => {
      const prev = task.title;
      patchTask(task.id, { title });
      try {
        await updateTask(task.id, { title });
        return true;
      } catch (err) {
        patchTask(task.id, { title: prev });
        toast.error(err, "Couldn't rename that task.");
        return false;
      }
    },

    remove: (task) => {
      const subs = (data?.tasks ?? []).filter((t) => t.parent_task_id === task.id).length;
      setOpenRow(null);
      hide([task.id]);
      toast.undoable({
        message: subs > 0 ? `Deleted ${quote(task.title)} and ${plural(subs, "sub-task")}` : `Deleted ${quote(task.title)}`,
        run: async () => {
          await deleteTask(task.id);
          mutate((d) => d && { ...d, tasks: d.tasks.filter((t) => t.id !== task.id && t.parent_task_id !== task.id) });
          unhide([task.id]);
          notifyPage();
        },
        onUndo: () => unhide([task.id]),
      });
    },
  };

  // --- energy --------------------------------------------------------------

  const setEnergy = (tag) =>
    once("energy", async () => {
      const prev = data?.plan?.energy_tag ?? null;
      const next = prev === tag ? null : tag;
      const put = (value) => mutate((d) => d && { ...d, plan: { ...(d.plan ?? {}), energy_tag: value } });
      put(next);
      try {
        await setDayEnergyTag(userId, date, next);
        notifyPage();
      } catch (err) {
        put(prev);
        toast.error(err, "Couldn't save the day's energy.");
      }
    });

  // --- blocks --------------------------------------------------------------

  async function saveBlock(chunk, fields) {
    try {
      if (chunk) {
        const row = await updateTimeChunk(chunk.id, fields);
        mutate((d) => d && { ...d, chunks: d.chunks.map((c) => (c.id === row.id ? row : c)).sort(byStart) });
      } else {
        const row = await createTimeChunk(userId, { date, ...fields });
        mutate((d) => (d && d.date === row.date ? { ...d, chunks: [...d.chunks, row].sort(byStart) } : d));
      }
      setEditing(null);
      return true;
    } catch (err) {
      toast.error(err, chunk ? "Couldn't save the block." : "Couldn't add the block.");
      return false;
    }
  }

  // The block goes; its tasks stay on the day, unscheduled, and come back
  // into it on Undo along with its notes (nothing is deleted until then).
  function removeBlock(chunk) {
    const moving = (byChunk.get(chunk.id) ?? []).length;
    setEditing(null);
    hide([chunk.id]);
    toast.undoable({
      message: moving > 0 ? `Deleted ${quote(chunk.title)}. ${plural(moving, "task")} moved to Unscheduled.` : `Deleted ${quote(chunk.title)}`,
      run: async () => {
        await deleteTimeChunk(chunk.id);
        mutate(
          (d) =>
            d && {
              ...d,
              chunks: d.chunks.filter((c) => c.id !== chunk.id),
              tasks: d.tasks.map((t) => (t.time_chunk_id === chunk.id ? { ...t, time_chunk_id: null } : t)),
            }
        );
        unhide([chunk.id]);
      },
      onUndo: () => unhide([chunk.id]),
    });
  }

  // --- presets -------------------------------------------------------------

  // A whole-day preset on a day that already has blocks asks first: the
  // server only ever adds, so tapping "Workday" twice used to stack two.
  async function applyPreset(t) {
    if (busyPreset || !data) return;
    const before = data;
    let mode = "add";
    if (t.kind === "day") {
      // Standing blocks (church, a shift) belong to the week, not the preset.
      const replaceable = chunks.filter((c) => !c.standing_block_id);
      if (replaceable.length > 0) {
        const ids = new Set(replaceable.map((c) => c.id));
        const moving = before.tasks.filter((x) => !x.parent_task_id && ids.has(x.time_chunk_id) && !hidden.has(x.id)).length;
        const withNotes = replaceable.filter((c) => c.notes?.trim()).length;
        const standing = chunks.length - replaceable.length;
        const pick = await choose({
          title: `Apply ${quote(t.name)}?`,
          body: (
            <>
              <p style={{ margin: "0 0 8px" }}>This day already has {plural(chunks.length, "block")}.</p>
              <p style={{ margin: "0 0 8px" }}>
                Replacing removes {namesOf(replaceable)}
                {moving > 0 ? `; ${plural(moving, "task")} in them move to Unscheduled` : ""}
                {withNotes > 0 ? `, and notes on ${plural(withNotes, "block")} go with them` : ""}.
                {standing > 0 ? ` Standing blocks stay.` : ""}
              </p>
              <p style={{ margin: 0 }}>Adding on top keeps everything and adds the preset's blocks.</p>
            </>
          ),
          options: [
            { value: "replace", label: "Replace the day", danger: true },
            { value: "add", label: "Add on top" },
          ],
        });
        if (!pick) return;
        mode = pick;
      }
    }

    setBusyPreset(t.id);
    try {
      await applyTemplate(t.id, date);
    } catch (err) {
      setBusyPreset(null);
      toast.error(err, `Couldn't apply ${t.name}.`);
      return;
    }
    const fresh = await reload();
    setBusyPreset(null);
    notifyPage();

    const done = t.kind === "day" ? `Applied ${t.name}` : `Added ${t.name}`;
    if (!fresh || fresh.date !== date) {
      toast.show(done);
      return;
    }

    // What the preset added, so Undo can take exactly that back off.
    const oldChunks = new Set(before.chunks.map((c) => c.id));
    const oldTasks = new Set(before.tasks.map((x) => x.id));
    const addedChunks = fresh.chunks.filter((c) => !oldChunks.has(c.id)).map((c) => c.id);
    const addedTasks = fresh.tasks.filter((x) => !oldTasks.has(x.id)).map((x) => x.id);
    const oldEnergy = before.plan?.energy_tag ?? null;
    const energyChanged = (fresh.plan?.energy_tag ?? null) !== oldEnergy;
    const takeBack = async () => {
      try {
        await deleteTasks(addedTasks);
        await deleteTimeChunks(addedChunks);
        if (energyChanged) await setDayEnergyTag(userId, date, oldEnergy);
      } catch (err) {
        toast.error(err, "Couldn't take all of that back off. Check the day.");
      }
      reload();
      notifyPage();
    };

    if (mode === "replace") {
      const removeIds = chunks.filter((c) => !c.standing_block_id).map((c) => c.id);
      hide(removeIds);
      toast.undoable({
        message: `Replaced the day with ${t.name}`,
        run: async () => {
          await deleteTimeChunks(removeIds);
          mutate(
            (d) =>
              d && {
                ...d,
                chunks: d.chunks.filter((c) => !removeIds.includes(c.id)),
                tasks: d.tasks.map((x) => (removeIds.includes(x.time_chunk_id) ? { ...x, time_chunk_id: null } : x)),
              }
          );
          unhide(removeIds);
        },
        onUndo: () => {
          unhide(removeIds);
          takeBack();
        },
      });
    } else {
      toast.show(done, { actionLabel: "Undo", onAction: takeBack });
    }
  }

  async function saveDayPreset(name) {
    try {
      await saveDayAsTemplate(date, name);
      presets.reload();
      toast.show(`Saved this day as ${quote(name)}`);
      return true;
    } catch (err) {
      toast.error(err, "Couldn't save the preset.");
      return false;
    }
  }

  function removePreset(t) {
    hide([t.id]);
    toast.undoable({
      message: `Deleted the ${quote(t.name)} preset`,
      run: async () => {
        await deleteTemplate(t.id);
        presets.mutate((list) => list?.filter((x) => x.id !== t.id));
        unhide([t.id]);
      },
      onUndo: () => unhide([t.id]),
    });
  }

  // --- render ----------------------------------------------------------------

  if (!data) {
    if (error) return <LoadError what="this day's plan" error={error} onRetry={reload} />;
    return <p className="placeholder-note">Loading the plan…</p>;
  }

  const energy = data.plan?.energy_tag ?? null;
  const showPresets = presetsOpen ?? chunks.length === 0;
  const rowProps = { chunks, openRow, setOpenRow, act };

  return (
    <div className="plan-day">
      {error && <LoadError stale error={error} onRetry={reload} />}

      <PresetCard
        userId={userId}
        presets={presets}
        hiddenIds={hidden}
        open={showPresets}
        onToggle={() => setPresetsOpen(!showPresets)}
        busyId={busyPreset}
        canSaveDay={chunks.length > 0}
        goalOptions={goalOptions}
        onApply={applyPreset}
        onSaveDay={saveDayPreset}
        onCreated={presets.reload}
        onDelete={removePreset}
      />

      <div className="card">
        <div className="section-label">Energy for the day</div>
        <div className="plan-buttons" role="group" aria-label="Energy for the day">
          {ENERGY_TAGS.map((tag) => (
            <button key={tag} type="button" className="toggle-chip" aria-pressed={energy === tag} onClick={() => setEnergy(tag)}>
              {tag}
            </button>
          ))}
        </div>
      </div>

      {chunks.length === 0 && unscheduled.length === 0 && editing !== "new" && (
        <p className="placeholder-note" style={{ margin: 0 }}>
          Nothing planned yet. Add a time block, apply a preset, or add a task under Unscheduled.
        </p>
      )}

      {allChunks.map((chunk) => (
        <BlockCard
          key={chunk.id}
          hidden={hidden.has(chunk.id)}
          chunk={chunk}
          tasks={byChunk.get(chunk.id) ?? []}
          subsByParent={subsByParent}
          goalOptions={goalOptions}
          userId={userId}
          date={date}
          editing={editing === chunk.id}
          onEdit={() => {
            setOpenRow(null);
            setEditing(chunk.id);
          }}
          onCancelEdit={() => setEditing(null)}
          onSave={saveBlock}
          onDelete={removeBlock}
          rowProps={rowProps}
        />
      ))}

      {editing === "new" ? (
        <div className="card">
          <div className="section-label">New time block</div>
          <BlockForm
            userId={userId}
            defaults={nextSlot(chunks)}
            goalOptions={goalOptions}
            onSave={(fields) => saveBlock(null, fields)}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : (
        <button type="button" className="plan-add-block" onClick={() => setEditing("new")}>
          <Plus size={16} />
          Add a time block
        </button>
      )}

      <div className="card">
        <div className="section-label">Unscheduled</div>
        {unscheduled.map((task) => (
          <TaskRow key={task.id} task={task} subtasks={subsByParent.get(task.id) ?? []} {...rowProps} />
        ))}
        <InlineAdd placeholder="Add a task without a time…" onAdd={(title) => act.add({ title })} />
      </div>

      {choiceSheet}
    </div>
  );
}

// Where a new block starts: right after the day's last one, an hour long.
function nextSlot(chunks) {
  const last = [...chunks].sort(byStart).at(-1);
  const start = last ? minutesOf(last.end_time) : 9 * 60;
  if (!last || start >= 23 * 60 || minutesOf(last.end_time) <= minutesOf(last.start_time)) {
    return { start: "09:00", end: "10:00" };
  }
  return { start: hhmm(start), end: hhmm(Math.min(start + 60, 23 * 60 + 59)) };
}

function BlockCard({ hidden, chunk, tasks, subsByParent, goalOptions, userId, date, editing, onEdit, onCancelEdit, onSave, onDelete, rowProps }) {
  const goal = goalOptions.find((g) => g.id === chunk.goal_node_id);
  const done = tasks.filter((t) => t.status).length;

  // A block waiting on its Undo stays mounted, only hidden, so its notes
  // editor keeps what was typed if it comes back.
  return (
    <div className="card" hidden={hidden}>
      {editing ? (
        <BlockForm
          userId={userId}
          chunk={chunk}
          goalOptions={goalOptions}
          onSave={(fields) => onSave(chunk, fields)}
          onCancel={onCancelEdit}
          onDelete={() => onDelete(chunk)}
        />
      ) : (
        <>
          <button type="button" className="plan-block__head" onClick={onEdit} title="Change the time, title or category">
            <span className="plan-block__what">
              <span className="plan-block__time">{fmtTimeRange(chunk.start_time, chunk.end_time)}</span>
              <span className="plan-block__title">{chunk.title}</span>
            </span>
            <span className="plan-block__edit">
              <Pencil size={12} />
              Edit
            </span>
          </button>
          {(chunk.category || goal || chunk.standing_block_id || tasks.length > 0) && (
            <div className="plan-block__meta">
              {chunk.category && (
                <span className="pill">
                  <span className="dot" style={{ background: colorFor(chunk.category) }} />
                  {chunk.category}
                </span>
              )}
              {goal && <span className="pill">{goal.title}</span>}
              {chunk.standing_block_id && (
                <span className="pill" title="Comes from a standing block on the Week page">
                  <Repeat size={11} />
                  Standing
                </span>
              )}
              {tasks.length > 0 && (
                <span className="pill">
                  {done} of {tasks.length} done
                </span>
              )}
            </div>
          )}
        </>
      )}

      <div className="plan-block__tasks">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} subtasks={subsByParent.get(task.id) ?? []} {...rowProps} />
        ))}
        <InlineAdd placeholder="Add a task…" onAdd={(title) => rowProps.act.add({ chunkId: chunk.id, title })} />
      </div>

      {/* Where meeting notes live: on the hour they happened in. */}
      <ChunkNotes chunk={chunk} date={date} />
    </div>
  );
}

// Adds a block, or changes one. Moving a block here keeps its tasks and
// notes, which deleting and re-adding it never did.
function BlockForm({ userId, chunk, defaults, goalOptions, onSave, onCancel, onDelete }) {
  const [title, setTitle] = useState(chunk?.title ?? "");
  const [start, setStart] = useState(chunk ? chunk.start_time.slice(0, 5) : defaults.start);
  const [end, setEnd] = useState(chunk ? chunk.end_time.slice(0, 5) : defaults.end);
  const [category, setCategory] = useState(chunk?.category ?? "");
  const [goalNodeId, setGoalNodeId] = useState(chunk?.goal_node_id ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const cats = useLoad(() => (userId ? fetchCategories(userId) : []), [userId]);

  // An archived or renamed category still shows as what the block has.
  const names = useMemo(() => {
    const list = (cats.data ?? []).map((c) => c.name);
    if (chunk?.category && !list.includes(chunk.category)) list.unshift(chunk.category);
    return list;
  }, [cats.data, chunk?.category]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (!title.trim()) return setProblem("Give the block a name.");
    if (!start || !end) return setProblem("Pick when it starts and ends.");
    if (start === end) return setProblem("It can't start and end at the same time.");
    setProblem(null);
    setBusy(true);
    const ok = await onSave({
      title: title.trim(),
      start_time: start,
      end_time: end,
      category: category || null,
      goal_node_id: goalNodeId || null,
    });
    if (!ok) setBusy(false);
  }

  return (
    <form className="block-form" onSubmit={submit}>
      <label className="field">
        <span>What</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Deep work" autoFocus={!chunk} />
      </label>
      <div className="block-form__times">
        <label className="field">
          <span>Starts</span>
          <input type="time" className="input time-input" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <label className="field">
          <span>Ends</span>
          <input type="time" className="input time-input" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </label>
      </div>
      {start && end && end < start && <p className="block-form__hint">Ends after midnight.</p>}
      <div className="block-form__pair">
        <label className="field">
          <span>Category</span>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">No category</option>
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {goalOptions.length > 0 && (
          <label className="field">
            <span>Goal</span>
            <select className="input" value={goalNodeId} onChange={(e) => setGoalNodeId(e.target.value)}>
              <option value="">No goal</option>
              {goalOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {chunk?.standing_block_id && (
        <p className="block-form__hint">This is this day's copy of a standing block. Changes here stay on this day.</p>
      )}
      {problem && (
        <p className="block-form__problem" role="alert">
          {problem}
        </p>
      )}
      <div className="block-form__actions">
        {chunk && (
          <button type="button" className="btn-link btn-link--danger" onClick={onDelete} disabled={busy} style={{ minHeight: 36 }}>
            <Trash2 size={13} />
            Delete block
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn--accent" disabled={busy}>
          {busy ? "Saving…" : chunk ? "Save block" : "Add block"}
        </button>
      </div>
    </form>
  );
}

// A task row. Everything you'd do to a task besides ticking it sits behind
// its ⋯, so a phone row is just the box, the words and one button.
function TaskRow({ task, subtasks = [], chunks, isSub = false, openRow, setOpenRow, act }) {
  const open = openRow === task.id;
  const [renaming, setRenaming] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const meta = !isSub && task.is_work;
  const moveTargets = chunks.filter((c) => c.id !== task.time_chunk_id);

  return (
    <div className={`plan-task ${task.status ? "plan-task--done" : ""}`}>
      <div className="plan-task__row">
        <label className="plan-task__check">
          <input
            type="checkbox"
            checked={task.status}
            onChange={() => act.toggle(task)}
            aria-label={task.status ? `Mark “${task.title}” not done` : `Mark “${task.title}” done`}
          />
        </label>
        <div className="plan-task__main">
          {renaming ? (
            <RenameForm
              initial={task.title}
              onSave={async (title) => {
                const ok = await act.rename(task, title);
                if (ok) setRenaming(false);
                return ok;
              }}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <span className="plan-task__title">{task.title}</span>
          )}
          {meta && (
            <div className="plan-task__meta">
              {task.is_work && (
                <span className="plan-tag" title="On the work report">
                  <Briefcase size={11} />
                  Work
                </span>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          className="btn-icon plan-task__more"
          aria-label={`More for “${task.title}”`}
          title="More"
          aria-expanded={open}
          onClick={() => setOpenRow(open ? null : task.id)}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {open && (
        <div className="plan-task__actions">
          {!isSub && (
            <button type="button" className="btn btn--sm" onClick={() => act.toggleWork(task)}>
              <Briefcase size={13} />
              {task.is_work ? "Not work" : "Mark as work"}
            </button>
          )}
          {!isSub && (
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => {
                setAddingSub(true);
                setOpenRow(null);
              }}
            >
              <Plus size={13} />
              Add sub-task
            </button>
          )}
          {!isSub && (moveTargets.length > 0 || task.time_chunk_id) && (
            <select
              className="plan-move"
              value=""
              aria-label="Move to another block"
              onChange={(e) => {
                const v = e.target.value;
                setOpenRow(null);
                act.move(task, v === "none" ? null : v);
              }}
            >
              <option value="" disabled>
                Move to…
              </option>
              {moveTargets.map((c) => (
                <option key={c.id} value={c.id}>
                  {fmtTimeRange(c.start_time, c.end_time)} · {c.title}
                </option>
              ))}
              {task.time_chunk_id && <option value="none">Unscheduled</option>}
            </select>
          )}
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              setRenaming(true);
              setOpenRow(null);
            }}
          >
            <Pencil size={13} />
            Rename
          </button>
          <button type="button" className="btn btn--sm btn--danger" onClick={() => act.remove(task)}>
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      )}

      {(subtasks.length > 0 || addingSub) && (
        <div className="plan-task__subs">
          {subtasks.map((st) => (
            <TaskRow key={st.id} task={st} isSub chunks={chunks} openRow={openRow} setOpenRow={setOpenRow} act={act} />
          ))}
          {addingSub && (
            <InlineAdd
              small
              autoFocus
              placeholder="Add a sub-task…"
              onAdd={(title) => act.add({ chunkId: task.time_chunk_id ?? null, parentId: task.id, title })}
              onCancel={() => setAddingSub(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function RenameForm({ initial, onSave, onCancel }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const v = value.trim();
    if (!v || busy) return;
    if (v === initial) return onCancel();
    setBusy(true);
    const ok = await onSave(v);
    if (!ok) setBusy(false);
  }

  return (
    <form className="plan-task__rename" onSubmit={submit}>
      <input
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Task name"
        autoFocus
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
      />
      <button type="submit" className="btn btn--sm btn--accent" disabled={busy || !value.trim()}>
        {busy ? "Saving…" : "Save"}
      </button>
      <button type="button" className="btn btn--sm btn--ghost" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}

// The text stays put until the task is saved, so a failed add doesn't eat
// what was typed.
function InlineAdd({ placeholder, onAdd, small, autoFocus, onCancel }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true);
    const ok = await onAdd(v);
    setBusy(false);
    if (ok) setValue("");
  }

  return (
    <form className={`plan-add ${small ? "plan-add--small" : ""}`} onSubmit={submit}>
      <input
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder.replace(/…$/, "")}
        autoFocus={autoFocus}
        onKeyDown={(e) => e.key === "Escape" && onCancel?.()}
      />
      <button type="submit" className="btn btn--sm" disabled={busy || !value.trim()}>
        {busy ? "Adding…" : "Add"}
      </button>
      {onCancel && (
        <button type="button" className="btn btn--sm btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
}

// Presets: stamp a saved block or whole day onto this date, or save what's
// already here for reuse. Closed unless the day is empty — most days are
// laid out by the week planner on Sunday, and this is the exception.
function PresetCard({ userId, presets, hiddenIds, open, onToggle, busyId, canSaveDay, goalOptions, onApply, onSaveDay, onCreated, onDelete }) {
  const [mode, setMode] = useState(null); // null | 'saveDay' | 'newBlock' | 'manage'
  const list = (presets.data ?? []).filter((t) => !hiddenIds.has(t.id));
  const days = list.filter((t) => t.kind === "day");
  const blocks = list.filter((t) => t.kind === "chunk");

  return (
    <div className="card">
      <button type="button" className="plan-card-toggle" aria-expanded={open} onClick={onToggle}>
        <span className="section-label">
          <LayoutTemplate size={12} />
          Presets{list.length > 0 ? ` · ${list.length}` : ""}
        </span>
        <span className="plan-card-toggle__hint">
          {open ? "Hide" : "Show"}
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 6 }}>
          {presets.error && !presets.data && <LoadError what="presets" error={presets.error} onRetry={presets.reload} />}

          {presets.data && list.length === 0 && mode === null && (
            <p className="card-note">No presets yet. Build a day you'd repeat, then save it here.</p>
          )}

          {mode !== "manage" && days.length > 0 && (
            <>
              <div className="plan-sub">Whole days</div>
              <div className="plan-buttons">
                {days.map((t) => (
                  <button key={t.id} type="button" className="btn btn--sm" disabled={busyId != null} onClick={() => onApply(t)}>
                    <CalendarCheck size={13} />
                    {busyId === t.id ? "Applying…" : `Apply ${t.name}`}
                  </button>
                ))}
              </div>
            </>
          )}

          {mode !== "manage" && blocks.length > 0 && (
            <>
              <div className="plan-sub">Single blocks</div>
              <div className="plan-buttons">
                {blocks.map((t) => (
                  <button key={t.id} type="button" className="btn btn--sm" disabled={busyId != null} onClick={() => onApply(t)}>
                    <Plus size={13} />
                    {busyId === t.id ? "Adding…" : `Add ${t.name}`}
                  </button>
                ))}
              </div>
            </>
          )}

          {mode === "saveDay" && (
            <SaveDayForm
              onSave={async (name) => {
                const ok = await onSaveDay(name);
                if (ok) setMode(null);
                return ok;
              }}
              onCancel={() => setMode(null)}
            />
          )}

          {mode === "newBlock" && (
            <NewBlockPresetForm
              userId={userId}
              goalOptions={goalOptions}
              onCancel={() => setMode(null)}
              onSaved={() => {
                setMode(null);
                onCreated();
              }}
            />
          )}

          {mode === "manage" && (
            <div className="preset-manage">
              {list.map((t) => (
                <div key={t.id} className="preset-manage__row">
                  <span style={{ minWidth: 0 }}>
                    {t.name}
                    <span className="faint" style={{ fontSize: 11.5 }}>
                      {" "}
                      · {t.kind === "day" ? ((t.applies_to_weekdays ?? []).length > 0 ? "ideal day" : "whole day") : "block"}
                    </span>
                  </span>
                  {t.kind === "day" && (t.applies_to_weekdays ?? []).length > 0 ? (
                    <span className="faint" style={{ fontSize: 11.5, textAlign: "right" }}>Edit under Week → Ideal</span>
                  ) : (
                    <button type="button" className="btn-link btn-link--danger" onClick={() => onDelete(t)}>
                      <Trash2 size={12} />
                      Delete
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn--sm" style={{ marginTop: 10 }} onClick={() => setMode(null)}>
                Done
              </button>
            </div>
          )}

          {mode === null && (
            <div className="plan-links">
              {canSaveDay && (
                <button type="button" className="btn-link" onClick={() => setMode("saveDay")}>
                  <Bookmark size={12} />
                  Save this day as a preset
                </button>
              )}
              <button type="button" className="btn-link" onClick={() => setMode("newBlock")}>
                <Plus size={12} />
                New block preset
              </button>
              {list.length > 0 && (
                <button type="button" className="btn-link" onClick={() => setMode("manage")}>
                  Manage presets
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SaveDayForm({ onSave, onCancel }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const ok = await onSave(name.trim());
    if (!ok) setBusy(false);
  }

  return (
    <form className="plan-add" onSubmit={submit} style={{ marginTop: 12 }}>
      <input
        className="input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name it (e.g. Workday)"
        aria-label="Preset name"
        autoFocus
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
      />
      <button type="submit" className="btn btn--sm btn--accent" disabled={busy || !name.trim()}>
        {busy ? "Saving…" : "Save"}
      </button>
      <button type="button" className="btn btn--sm btn--ghost" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}

function NewBlockPresetForm({ userId, goalOptions, onCancel, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [goalNodeId, setGoalNodeId] = useState("");
  const [taskLines, setTaskLines] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim() || !title.trim()) return setProblem("Give the preset a name and the block a title.");
    if (start === end) return setProblem("It can't start and end at the same time.");
    setProblem(null);
    setBusy(true);
    try {
      await createChunkTemplate(userId, {
        name: name.trim(),
        title: title.trim(),
        startTime: start,
        endTime: end,
        goalNodeId,
        taskTitles: taskLines.split("\n"),
      });
      toast.show(`Saved the ${quote(name.trim())} preset`);
      onSaved();
    } catch (err) {
      toast.error(err, "Couldn't save the preset.");
      setBusy(false);
    }
  }

  return (
    <form className="block-form" onSubmit={submit} style={{ marginTop: 12 }}>
      <label className="field">
        <span>Preset name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morning routine" autoFocus />
      </label>
      <label className="field">
        <span>Block title</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Scripture and prayer" />
      </label>
      <div className="block-form__times">
        <label className="field">
          <span>Starts</span>
          <input type="time" className="input time-input" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <label className="field">
          <span>Ends</span>
          <input type="time" className="input time-input" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </label>
      </div>
      {goalOptions.length > 0 && (
        <label className="field">
          <span>Goal</span>
          <select className="input" value={goalNodeId} onChange={(e) => setGoalNodeId(e.target.value)}>
            <option value="">No goal</option>
            {goalOptions.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        <span>Tasks, one per line (optional)</span>
        <textarea className="textarea" value={taskLines} onChange={(e) => setTaskLines(e.target.value)} placeholder={"Scripture study\nPrayer"} style={{ minHeight: 70 }} />
      </label>
      {problem && (
        <p className="block-form__problem" role="alert">
          {problem}
        </p>
      )}
      <div className="block-form__actions">
        <span className="spacer" />
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn--accent" disabled={busy}>
          {busy ? "Saving…" : "Save preset"}
        </button>
      </div>
    </form>
  );
}
