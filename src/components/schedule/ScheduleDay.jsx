import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, LayoutTemplate, Maximize2, Minimize2 } from "lucide-react";
import {
  fetchTimeChunks,
  createTimeChunk,
  updateTimeChunk,
  deleteTimeChunk,
  deleteTimeChunks,
  fetchTasks,
  createTask,
  toggleTask,
  deleteTask,
  deleteTasks,
  updateTask,
  fetchTemplates,
  applyTemplate,
  saveDayAsTemplate,
  createChunkTemplate,
  deleteTemplate,
  fetchCategories,
  fetchQuestTagOptions,
  addStandingBlock,
  removeStandingBlock,
  setStandingColor,
  fetchEnergyTags,
  putBackEnergyTags,
} from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { useToast, useConfirm } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import { useChoiceSheet } from "../plan/ChoiceSheet";
import DayGrid from "./DayGrid";
import BlockSheet from "./BlockSheet";
import PresetsSheet from "./PresetsSheet";
import { gridRange, plannedMinutes, openStretches, fmtHours, newBlockAt, nextOpenSlot, hourLabel, toTime, colorOf } from "../../lib/schedule";
import { fmtTimeRange, parseDateStr, todayStr } from "../../lib/planDates";
import { useMediaQuery } from "./useMediaQuery";

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const quote = (s, max = 40) => `“${s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s}”`;
const byStart = (a, b) => (a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0);

function namesOf(list, max = 3) {
  const names = list.map((x) => `“${x.title}”`);
  if (names.length <= max) return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

// One day's schedule, and nothing else: the half-hour grid with its blocks,
// a Presets button and an Add button. Everything about a block (its tasks,
// its colour, repeating it, its notes) opens from the block itself.
export default function ScheduleDay({ userId, date }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [choose, choiceSheet] = useChoiceSheet();
  const phone = useMediaQuery("(max-width: 900px)");
  const slotH = phone ? 26 : 28;

  // A delete still waiting on its Undo (made a moment ago on this day, or on
  // another) goes through before the day is first read, so it can't come
  // back as a block that's already gone.
  const flushed = useRef(false);
  const { data, error, reload, mutate } = useLoad(async () => {
    if (!userId) return null;
    if (!flushed.current) {
      flushed.current = true;
      await toast.flush();
    }
    const [chunks, tasks] = await Promise.all([fetchTimeChunks(userId, date), fetchTasks(userId, date)]);
    return { date, chunks, tasks };
  }, [userId, date]);
  const presets = useLoad(() => (userId ? fetchTemplates(userId) : []), [userId]);
  const cats = useLoad(() => (userId ? fetchCategories(userId).catch(() => []) : []), [userId]);
  const quests = useLoad(() => (userId ? fetchQuestTagOptions(userId).catch(() => []) : []), [userId]);

  const [sheet, setSheet] = useState(null); // { id } | { new: {start, end} } | null
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [busyPreset, setBusyPreset] = useState(null);
  const [full, setFull] = useState(false);
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

  useEffect(() => {
    setSheet(null);
    setPresetsOpen(false);
  }, [date]);

  // The red line for now, on today.
  const isToday = date === todayStr();
  const [nowMin, setNowMin] = useState(() => minutesNow());
  useEffect(() => {
    if (!isToday) return undefined;
    const t = setInterval(() => setNowMin(minutesNow()), 60000);
    return () => clearInterval(t);
  }, [isToday]);

  const chunks = useMemo(() => (data?.chunks ?? []).filter((c) => !hidden.has(c.id)), [data, hidden]);
  const { byChunk, subs, loose } = useMemo(() => {
    const live = new Set(chunks.map((c) => c.id));
    const byChunk = new Map();
    const subs = new Map();
    const loose = [];
    for (const t of data?.tasks ?? []) {
      if (hidden.has(t.id) || (t.parent_task_id && hidden.has(t.parent_task_id))) continue;
      if (t.parent_task_id) {
        if (!subs.has(t.parent_task_id)) subs.set(t.parent_task_id, []);
        subs.get(t.parent_task_id).push(t);
      } else if (t.time_chunk_id && live.has(t.time_chunk_id)) {
        if (!byChunk.has(t.time_chunk_id)) byChunk.set(t.time_chunk_id, []);
        byChunk.get(t.time_chunk_id).push(t);
      } else loose.push(t);
    }
    return { byChunk, subs, loose };
  }, [data, chunks, hidden]);

  const patchTask = (id, fields) => mutate((d) => d && { ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...fields } : t)) });
  const putChunk = (row) => mutate((d) => d && { ...d, chunks: d.chunks.some((c) => c.id === row.id) ? d.chunks.map((c) => (c.id === row.id ? row : c)).sort(byStart) : [...d.chunks, row].sort(byStart) });

  // --- blocks ----------------------------------------------------------------

  async function saveBlock(chunk, fields, { repeat }) {
    const recolored = Boolean(chunk?.standing_block_id) && (chunk.color ?? null) !== (fields.color ?? null);
    try {
      let row;
      if (chunk) {
        row = await updateTimeChunk(chunk.id, fields);
        if (recolored) await setStandingColor(chunk.standing_block_id, fields.color, date);
      } else {
        row = await createTimeChunk(userId, { date, ...fields });
      }
      putChunk(row);
    } catch (err) {
      toast.error(err, chunk ? "Couldn't save the block." : "Couldn't add the block.");
      return false;
    }
    // The block is saved now, so the sheet closes whatever happens next: a
    // second try can't add it twice.
    setSheet(null);
    if (repeat) {
      const day = parseDateStr(date).toLocaleDateString(undefined, { weekday: "long" });
      try {
        const { stamped } = await addStandingBlock(userId, {
          weekday: parseDateStr(date).getDay(),
          title: fields.title,
          category: fields.category,
          color: fields.color,
          start: fields.start_time,
          end: fields.end_time,
        });
        await reload();
        toast.show(stamped ? `${quote(fields.title)} now repeats every ${day}` : `${quote(fields.title)} now repeats every ${day}. The weeks ahead fill in overnight.`);
      } catch (err) {
        toast.error(err, `Saved the block, but couldn't make it repeat every ${day}.`);
      }
    } else if (recolored) {
      toast.show("Color saved for every week ahead");
    }
    return true;
  }

  // The notes' own Save writes them straight away; keep the day in step so
  // reopening the block shows them.
  function notesSaved(id, notes) {
    mutate((d) => d && { ...d, chunks: d.chunks.map((c) => (c.id === id ? { ...c, notes: notes || null } : c)) });
  }

  async function dragBlock(chunk, times) {
    const before = { start_time: chunk.start_time, end_time: chunk.end_time };
    putChunk({ ...chunk, ...times });
    try {
      const row = await updateTimeChunk(chunk.id, times);
      putChunk(row);
      toast.show(`${quote(chunk.title, 28)} · ${fmtTimeRange(row.start_time, row.end_time)}`, {
        actionLabel: "Undo",
        onAction: async () => {
          putChunk({ ...row, ...before });
          try {
            putChunk(await updateTimeChunk(chunk.id, before));
          } catch (err) {
            toast.error(err, "Couldn't put it back.");
            reload();
          }
        },
      });
    } catch (err) {
      putChunk({ ...chunk, ...before });
      toast.error(err, "Couldn't move the block.");
    }
  }

  // The block goes; its tasks stay on the day with no time, and come back on
  // Undo along with its notes (nothing is deleted until then).
  function removeBlock(chunk) {
    const moving = (byChunk.get(chunk.id) ?? []).length;
    setSheet(null);
    hide([chunk.id]);
    toast.undoable({
      message: moving > 0 ? `Deleted ${quote(chunk.title)}. ${plural(moving, "task")} kept with no time.` : `Deleted ${quote(chunk.title)}`,
      run: async () => {
        await deleteTimeChunk(chunk.id);
        mutate((d) => d && { ...d, chunks: d.chunks.filter((c) => c.id !== chunk.id), tasks: d.tasks.map((t) => (t.time_chunk_id === chunk.id ? { ...t, time_chunk_id: null } : t)) });
        unhide([chunk.id]);
      },
      onUndo: () => unhide([chunk.id]),
    });
  }

  async function stopRepeat(chunk) {
    const day = parseDateStr(date).toLocaleDateString(undefined, { weekday: "long" });
    const ok = await confirm({
      title: `Stop repeating ${quote(chunk.title)}?`,
      body: `It won't be added to future ${day}s. Copies from today on that have no tasks are removed; earlier ones stay.`,
      confirmLabel: "Stop repeating",
    });
    if (!ok) return;
    try {
      await removeStandingBlock(chunk.standing_block_id);
      setSheet(null);
      await reload();
      toast.show(`${quote(chunk.title)} no longer repeats`);
    } catch (err) {
      toast.error(err, "Couldn't stop it repeating.");
    }
  }

  // --- tasks -------------------------------------------------------------------

  async function onTask(kind, payload, chunk) {
    if (kind === "toggle") {
      const done = !payload.status;
      patchTask(payload.id, { status: done, completed_at: done ? new Date().toISOString() : null });
      try {
        await toggleTask(payload.id, done);
      } catch (err) {
        patchTask(payload.id, { status: payload.status, completed_at: payload.completed_at });
        toast.error(err, "Couldn't save that.");
      }
      return true;
    }
    if (kind === "add") {
      const position = Math.max(-1, ...(data?.tasks ?? []).map((t) => t.position ?? 0)) + 1;
      try {
        const row = await createTask(userId, { date, time_chunk_id: chunk?.id ?? null, parent_task_id: null, title: payload.title, position });
        mutate((d) => (d && d.date === row.date ? { ...d, tasks: [...d.tasks, row] } : d));
        return true;
      } catch (err) {
        toast.error(err, "Couldn't add that task.");
        return false;
      }
    }
    if (kind === "move") {
      const prev = payload.task.time_chunk_id ?? null;
      patchTask(payload.task.id, { time_chunk_id: payload.chunkId });
      try {
        await updateTask(payload.task.id, { time_chunk_id: payload.chunkId });
      } catch (err) {
        patchTask(payload.task.id, { time_chunk_id: prev });
        toast.error(err, "Couldn't move that task.");
      }
      return true;
    }
    if (kind === "remove") {
      const task = payload;
      hide([task.id]);
      toast.undoable({
        message: `Deleted ${quote(task.title)}`,
        run: async () => {
          await deleteTask(task.id);
          mutate((d) => d && { ...d, tasks: d.tasks.filter((t) => t.id !== task.id && t.parent_task_id !== task.id) });
          unhide([task.id]);
        },
        onUndo: () => unhide([task.id]),
      });
      return true;
    }
    return false;
  }

  // --- presets -------------------------------------------------------------------

  // A whole-day preset on a day that already has blocks asks first, since
  // the server only ever adds. Weekly blocks stay either way.
  async function applyPreset(t) {
    if (busyPreset || !data) return;
    const before = data;
    let mode = "add";
    if (t.kind === "day") {
      const replaceable = chunks.filter((c) => !c.standing_block_id);
      if (replaceable.length > 0) {
        const ids = new Set(replaceable.map((c) => c.id));
        const moving = before.tasks.filter((x) => !x.parent_task_id && ids.has(x.time_chunk_id) && !hidden.has(x.id)).length;
        const standing = chunks.length - replaceable.length;
        const pick = await choose({
          title: `Apply ${quote(t.name)}?`,
          body: (
            <>
              <p style={{ margin: "0 0 8px" }}>This day already has {plural(chunks.length, "block")}.</p>
              <p style={{ margin: "0 0 8px" }}>
                Replacing removes {namesOf(replaceable)}
                {moving > 0 ? `; ${plural(moving, "task")} in them are kept with no time` : ""}.{standing > 0 ? " Weekly blocks stay." : ""}
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
    // A preset can set the day's energy; remember what it was for Undo.
    const energyBefore = t.energy_tag ? await fetchEnergyTags(userId, date, date).catch(() => null) : null;
    try {
      await applyTemplate(t.id, date);
    } catch (err) {
      setBusyPreset(null);
      toast.error(err, `Couldn't apply ${t.name}.`);
      return;
    }
    const fresh = await reload();
    setBusyPreset(null);
    setPresetsOpen(false);
    const done = t.kind === "day" ? `Applied ${t.name}` : `Added ${t.name}`;

    // What the preset added: known now from the reload, or (if that failed)
    // worked out on Undo from what the day has then.
    const oldChunks = new Set(before.chunks.map((c) => c.id));
    const oldTasks = new Set(before.tasks.map((x) => x.id));
    const addedOf = (now) => ({
      chunks: now.chunks.filter((c) => !oldChunks.has(c.id)).map((c) => c.id),
      tasks: now.tasks.filter((x) => !oldTasks.has(x.id)).map((x) => x.id),
    });
    let added = fresh && fresh.date === date ? addedOf(fresh) : null;
    const takeBack = async () => {
      try {
        if (!added) {
          const [nowChunks, nowTasks] = await Promise.all([fetchTimeChunks(userId, date), fetchTasks(userId, date)]);
          added = addedOf({ chunks: nowChunks, tasks: nowTasks });
        }
        await deleteTasks(added.tasks);
        await deleteTimeChunks(added.chunks);
        await putBackEnergyTags(userId, [date], energyBefore, t.energy_tag).catch(() => {});
      } catch (err) {
        toast.error(err, "Couldn't take all of that back off. Check the day.");
      }
      reload();
    };

    if (mode === "replace") {
      const removeIds = chunks.filter((c) => !c.standing_block_id).map((c) => c.id);
      hide(removeIds);
      toast.undoable({
        message: `Replaced the day with ${t.name}`,
        run: async () => {
          await deleteTimeChunks(removeIds);
          mutate((d) => d && { ...d, chunks: d.chunks.filter((c) => !removeIds.includes(c.id)), tasks: d.tasks.map((x) => (removeIds.includes(x.time_chunk_id) ? { ...x, time_chunk_id: null } : x)) });
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
      // A delete still waiting on its Undo goes through first, so the
      // preset is the day as it looks.
      await toast.flush();
      await saveDayAsTemplate(date, name);
      presets.reload();
      toast.show(`Saved this day as ${quote(name)}`);
      return true;
    } catch (err) {
      toast.error(err, "Couldn't save the preset.");
      return false;
    }
  }

  async function saveBlockPreset(chunk, name, { title, start, end, color, category }) {
    try {
      await createChunkTemplate(userId, {
        name,
        title,
        startTime: start,
        endTime: end,
        color,
        category,
        goalNodeId: chunk.goal_node_id,
        taskTitles: (byChunk.get(chunk.id) ?? []).map((t) => t.title),
      });
      presets.reload();
      toast.show(`Saved ${quote(name)} as a block preset`);
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

  function clearDay() {
    const ids = chunks.filter((c) => !c.standing_block_id).map((c) => c.id);
    if (ids.length === 0) return;
    setPresetsOpen(false);
    hide(ids);
    toast.undoable({
      message: `Cleared ${plural(ids.length, "block")}${ids.length < chunks.length ? ". Weekly blocks stay." : ""}`,
      run: async () => {
        await deleteTimeChunks(ids);
        mutate((d) => d && { ...d, chunks: d.chunks.filter((c) => !ids.includes(c.id)), tasks: d.tasks.map((x) => (ids.includes(x.time_chunk_id) ? { ...x, time_chunk_id: null } : x)) });
        unhide(ids);
      },
      onUndo: () => unhide(ids),
    });
  }

  // --- render ----------------------------------------------------------------------

  if (!data) {
    if (error) return <LoadError what="this day's schedule" error={error} onRetry={reload} />;
    return <p className="placeholder-note">Loading the schedule…</p>;
  }

  const range = gridRange(chunks, { full });
  const planned = plannedMinutes(chunks);
  const open = openStretches(chunks, range).reduce((sum, o) => sum + o.end - o.start, 0);
  const editing = sheet?.id ? chunks.find((c) => c.id === sheet.id) ?? null : null;
  const stretches = openStretches(chunks, range);
  const blockPresets = (presets.data ?? []).filter((t) => t.kind === "chunk" && !hidden.has(t.id));

  return (
    <div className="sday">
      {error && <LoadError stale error={error} onRetry={reload} />}

      <div className="sday__bar">
        <div className="sday__sum">
          {chunks.length === 0 ? (
            <span>Nothing planned yet</span>
          ) : (
            <>
              <span>
                <b>{fmtHours(planned)}</b> planned
              </span>
              <span className="sday__dot" aria-hidden="true" />
              <span>
                <b>{fmtHours(open)}</b> open
              </span>
            </>
          )}
        </div>
        <div className="sday__actions">
          <button type="button" className="btn btn--sm btn--on-page" onClick={() => setPresetsOpen(true)}>
            <LayoutTemplate size={14} />
            Presets
          </button>
          <button type="button" className="btn btn--sm btn--accent" onClick={() => setSheet({ new: nextOpenSlot(chunks) })}>
            <Plus size={14} />
            Add block
          </button>
        </div>
      </div>

      {chunks.length === 0 && <p className="sday__empty">Tap any half hour to put a block there, or apply a preset.</p>}

      <div className="sday__main">
        <div className="card sday__card">
          <DayGrid
            chunks={chunks}
            tasksByChunk={byChunk}
            range={range}
            slotH={slotH}
            nowMin={isToday ? nowMin : null}
            onAdd={(m) => setSheet({ new: newBlockAt(m, chunks) })}
            onOpen={(c) => setSheet({ id: c.id })}
            onChange={dragBlock}
          />
          <button type="button" className="btn-link sday__full" onClick={() => setFull((v) => !v)}>
            {full ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            {full ? "Fit to the day's blocks" : "Show all 24 hours"}
          </button>
        </div>

        {/* A desk has room beside the day for what you'd reach for while
            laying it out: the open time, and blocks you've saved. */}
        <aside className="sday__side" aria-label="Open time and saved blocks">
          <div className="card sday__panel">
            <div className="sday__panel-head">Open time</div>
            {stretches.length === 0 ? (
              <p className="sday__panel-note">No open half hours between {hourLabel(range.start)} and {hourLabel(range.end)}.</p>
            ) : (
              <ul className="sday__open">
                {stretches.map((o) => (
                  <li key={o.start}>
                    <button type="button" className="sday__open-btn" onClick={() => setSheet({ new: { start: toTime(o.start), end: toTime(Math.min(o.end, o.start + 60)) } })}>
                      <span>{fmtTimeRange(toTime(o.start), toTime(Math.min(o.end, 24 * 60 - 1)))}</span>
                      <b>{fmtHours(o.end - o.start)}</b>
                      <Plus size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card sday__panel">
            <div className="sday__panel-head">Saved blocks</div>
            {blockPresets.length === 0 ? (
              <p className="sday__panel-note">Open a block, then More, then Save this block as a preset, and it shows here for one-tap adding.</p>
            ) : (
              <ul className="sday__open">
                {blockPresets.map((t) => {
                  const c = (t.template_chunks ?? [])[0];
                  return (
                    <li key={t.id}>
                      <button type="button" className="sday__open-btn" disabled={busyPreset != null} onClick={() => applyPreset(t)} title={`Add ${t.name} to this day`}>
                        <i className="sday__swatch" style={{ background: colorOf(c?.color).hex }} />
                        <span className="sday__open-name">{t.name}</span>
                        {c && <b>{fmtTimeRange(c.start_time, c.end_time)}</b>}
                        <Plus size={13} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <button type="button" className="btn-link sday__panel-link" onClick={() => setPresetsOpen(true)}>
              <LayoutTemplate size={12} />
              Whole-day presets
            </button>
          </div>
        </aside>
      </div>

      {loose.length > 0 && (
        <div className="card sday__loose">
          <div className="sday__loose-head">Tasks with no time</div>
          <ul className="bsheet__list">
            {loose.map((t) => (
              <li key={t.id} className={"bsheet__task" + (t.status ? " is-done" : "")}>
                <label className="bsheet__task-row">
                  <input type="checkbox" checked={Boolean(t.status)} onChange={() => onTask("toggle", t)} />
                  <span className="bsheet__task-title">{t.title}</span>
                </label>
                {chunks.length > 0 && (
                  <select
                    className="sday__move"
                    value=""
                    aria-label={`Put “${t.title}” in a block`}
                    onChange={(e) => e.target.value && onTask("move", { task: t, chunkId: e.target.value })}
                  >
                    <option value="">Put in a block…</option>
                    {chunks.map((c) => (
                      <option key={c.id} value={c.id}>
                        {fmtTimeRange(c.start_time, c.end_time)} · {c.title}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(sheet?.new || editing) && (
        <BlockSheet
          key={sheet.id ?? "new"}
          chunk={editing}
          defaults={sheet.new}
          date={date}
          tasks={editing ? byChunk.get(editing.id) ?? [] : []}
          subs={subs}
          categories={cats.data ?? []}
          questOptions={quests.data ?? []}
          onSave={(fields, opts) => saveBlock(editing, fields, opts)}
          onNotesSaved={(notes) => editing && notesSaved(editing.id, notes)}
          onDelete={() => removeBlock(editing)}
          onClose={() => setSheet(null)}
          onTask={(kind, payload) => onTask(kind, payload, editing)}
          onSavePreset={(name, fields) => saveBlockPreset(editing, name, fields)}
          onStopRepeat={() => stopRepeat(editing)}
        />
      )}

      {presetsOpen && (
        <PresetsSheet
          presets={presets}
          hiddenIds={hidden}
          busyId={busyPreset}
          canSaveDay={chunks.length > 0}
          canClear={chunks.some((c) => !c.standing_block_id)}
          onApply={applyPreset}
          onSaveDay={saveDayPreset}
          onDelete={removePreset}
          onClear={clearDay}
          onClose={() => setPresetsOpen(false)}
        />
      )}

      {choiceSheet}
    </div>
  );
}

function minutesNow() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
