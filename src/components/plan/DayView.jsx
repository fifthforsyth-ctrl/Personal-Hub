import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X, RotateCcw, Trash2, LayoutTemplate, Bookmark, Archive } from "lucide-react";
import {
  fetchDayPlan,
  setDayEnergyTag,
  fetchTimeChunks,
  createTimeChunk,
  deleteTimeChunk,
  fetchTasks,
  createTask,
  toggleTask,
  updateTask,
  deleteTask,
  rolloverIncompleteTasks,
  fetchStalledTasks,
  reviveTask,
  fetchTimeEntriesForDate,
  fetchTemplates,
  applyTemplate,
  saveDayAsTemplate,
  createChunkTemplate,
} from "../../lib/api";
import { todayStr, fmtTime, minutesOf } from "../../lib/planDates";

const ENERGY_TAGS = ["Open day", "Heavy edit day", "Deep focus", "Recovery day"];

// A single planned day: energy tag, its time blocks (each holding tasks and
// one level of sub-tasks), an unscheduled bucket, presets, and the
// end-of-day plan-vs-actual comparison.
export default function DayView({ userId, date, goalOptions, onDataChanged }) {
  const [dayPlan, setDayPlanState] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [actualEntries, setActualEntries] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [stalled, setStalled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingChunk, setAddingChunk] = useState(false);
  const [rolledMsg, setRolledMsg] = useState(null);

  const isToday = date === todayStr();

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [plan, chunkList, taskList, actual, tmpl, stale] = await Promise.all([
      fetchDayPlan(userId, date),
      fetchTimeChunks(userId, date),
      fetchTasks(userId, date),
      fetchTimeEntriesForDate(userId, date),
      fetchTemplates(userId),
      fetchStalledTasks().catch(() => []),
    ]);
    setDayPlanState(plan);
    setChunks(chunkList);
    setTasks(taskList);
    setActualEntries(actual);
    setTemplates(tmpl);
    setStalled(stale);
    setLoading(false);
    onDataChanged?.();
  }, [userId, date, onDataChanged]);

  // Rollover fires only when landing on today — never when reviewing a past
  // day or drafting a future one.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      if (isToday) {
        const n = await rolloverIncompleteTasks().catch(() => 0);
        if (!cancelled && n > 0) setRolledMsg(`Moved ${n} unfinished ${n === 1 ? "task" : "tasks"} forward from earlier days.`);
      } else {
        setRolledMsg(null);
      }
      if (!cancelled) await reload();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, date]);

  const { byChunk, unscheduled } = useMemo(() => {
    const map = new Map();
    const loose = [];
    for (const t of tasks) {
      if (t.parent_task_id) continue;
      if (t.time_chunk_id) {
        if (!map.has(t.time_chunk_id)) map.set(t.time_chunk_id, []);
        map.get(t.time_chunk_id).push(t);
      } else {
        loose.push(t);
      }
    }
    return { byChunk: map, unscheduled: loose };
  }, [tasks]);

  const subtasksByParent = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      if (!t.parent_task_id) continue;
      if (!map.has(t.parent_task_id)) map.set(t.parent_task_id, []);
      map.get(t.parent_task_id).push(t);
    }
    return map;
  }, [tasks]);

  const plannedMinutes = chunks.reduce((s, c) => s + Math.max(0, minutesOf(c.end_time) - minutesOf(c.start_time)), 0);
  const actualMinutes = actualEntries.reduce((s, e) => s + (Number(e.duration_minutes) || 0), 0);
  const topLevel = tasks.filter((t) => !t.parent_task_id);
  const doneCount = topLevel.filter((t) => t.status).length;

  async function guard(fn) {
    try {
      await fn();
      await reload();
    } catch (err) {
      alert(err.message);
    }
  }

  const handleAddChunk = (fields) =>
    guard(async () => {
      await createTimeChunk(userId, {
        date,
        start_time: fields.start,
        end_time: fields.end,
        title: fields.title,
        goal_node_id: fields.goalNodeId || null,
      });
      setAddingChunk(false);
    });

  const handleSetEnergy = (tag) =>
    guard(() => setDayEnergyTag(userId, date, dayPlan?.energy_tag === tag ? null : tag));

  const handleAddTask = (chunkId, title) =>
    guard(() => createTask(userId, { date, time_chunk_id: chunkId ?? null, title: title.trim() }));

  const handleAddSubtask = (parentId, title) =>
    guard(() => {
      const parent = tasks.find((t) => t.id === parentId);
      return createTask(userId, {
        date,
        time_chunk_id: parent?.time_chunk_id ?? null,
        parent_task_id: parentId,
        title: title.trim(),
      });
    });

  const handleToggle = (task) => guard(() => toggleTask(task.id, !task.status));
  const handleDeleteTask = (id) => guard(() => deleteTask(id));
  const handleDeleteChunk = (id) => guard(() => deleteTimeChunk(id));
  const handleAssignChunk = (taskId, chunkId) => guard(() => updateTask(taskId, { time_chunk_id: chunkId || null }));
  const handleApplyTemplate = (templateId) => guard(() => applyTemplate(templateId, date));
  const handleRevive = (taskId) => guard(() => reviveTask(taskId, date));

  return (
    <>
      {rolledMsg && (
        <div className="card card--accent" style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--accent-soft)", marginBottom: 14, padding: 14 }}>
          <RotateCcw size={15} color="var(--accent)" />
          <span style={{ fontSize: 13 }}>{rolledMsg}</span>
        </div>
      )}

      <PresetBar
        userId={userId}
        templates={templates}
        hasContent={chunks.length > 0}
        date={date}
        goalOptions={goalOptions}
        onApply={handleApplyTemplate}
        onSaved={reload}
      />

      <div className="card">
        <div className="section-label">Energy / capacity</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ENERGY_TAGS.map((tag) => {
            const active = dayPlan?.energy_tag === tag;
            return (
              <button key={tag} onClick={() => handleSetEnergy(tag)} style={chipStyle(active)}>
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {!loading && chunks.length === 0 && unscheduled.length === 0 && (
        <p className="placeholder-note" style={{ marginTop: 16 }}>
          Nothing planned yet — add a block below, apply a preset, or drop a loose task on the day.
        </p>
      )}

      {chunks.map((chunk) => (
        <ChunkCard
          key={chunk.id}
          chunk={chunk}
          tasks={byChunk.get(chunk.id) ?? []}
          subtasksByParent={subtasksByParent}
          goalOptions={goalOptions}
          onAddTask={(title) => handleAddTask(chunk.id, title)}
          onAddSubtask={handleAddSubtask}
          onToggle={handleToggle}
          onDeleteTask={handleDeleteTask}
          onDeleteChunk={() => handleDeleteChunk(chunk.id)}
        />
      ))}

      {addingChunk ? (
        <AddChunkForm goalOptions={goalOptions} onSave={handleAddChunk} onCancel={() => setAddingChunk(false)} />
      ) : (
        <button onClick={() => setAddingChunk(true)} className="card" style={addCardStyle}>
          <Plus size={16} />
          Add a time block
        </button>
      )}

      <div className="card">
        <div className="section-label">Unscheduled</div>
        {unscheduled.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            subtasks={subtasksByParent.get(task.id) ?? []}
            chunks={chunks}
            onToggle={() => handleToggle(task)}
            onToggleSub={handleToggle}
            onDelete={() => handleDeleteTask(task.id)}
            onAddSubtask={(title) => handleAddSubtask(task.id, title)}
            onAssignChunk={(chunkId) => handleAssignChunk(task.id, chunkId)}
          />
        ))}
        <InlineAdd placeholder="Add an unscheduled task…" onAdd={(title) => handleAddTask(null, title)} />
      </div>

      {isToday && stalled.length > 0 && (
        <StalledCard stalled={stalled} onRevive={handleRevive} onDelete={handleDeleteTask} />
      )}

      {(chunks.length > 0 || topLevel.length > 0) && (
        <div className="card">
          <div className="section-label">Plan vs. actual</div>
          <StatRow label="Time planned" value={`${Math.round(plannedMinutes)}m`} />
          <StatRow label="Time logged" value={`${Math.round(actualMinutes)}m`} />
          <StatRow label="Tasks done" value={`${doneCount} / ${topLevel.length}`} />
        </div>
      )}
    </>
  );
}

// Tasks that stopped rolling. Kept off today's plan on purpose — the point
// is that they need a decision, and leaving them mixed in with today makes
// them invisible again. Collapsed by default so a long backlog doesn't
// become the loudest thing on the page.
function StalledCard({ stalled, onRevive, onDelete }) {
  const [open, setOpen] = useState(false);
  const shown = open ? stalled : stalled.slice(0, 3);

  return (
    <div className="card" style={{ borderColor: "var(--border-strong)" }}>
      <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Archive size={12} />
        Stalled · {stalled.length}
      </div>
      <p style={{ fontSize: 11.5, color: "var(--text-faint)", margin: "-4px 0 10px" }}>
        These stopped moving forward on their own. Pull one back to today, or let it go.
      </p>

      {shown.map((t) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
          <span style={{ flex: 1, fontSize: 13, minWidth: 0 }}>{t.title}</span>
          <span className="entry-meta">{t.date}</span>
          <button onClick={() => onRevive(t.id)} style={{ ...iconBtnStyle, color: "var(--accent)" }} title="Bring to today">
            <RotateCcw size={13} />
          </button>
          <button onClick={() => onDelete(t.id)} style={iconBtnStyle} title="Let it go">
            <X size={13} />
          </button>
        </div>
      ))}

      {stalled.length > 3 && (
        <button onClick={() => setOpen((v) => !v)} style={textBtnStyle}>
          {open ? "Show fewer" : `Show all ${stalled.length}`}
        </button>
      )}
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)" }}>{value}</span>
    </div>
  );
}

// Presets: stamp a saved block or whole day onto this date, or save what's
// already here for reuse. The doc's "preset chunks and even days" — the
// same rhythm laid down once, then reapplied instead of rebuilt daily.
function PresetBar({ userId, templates, hasContent, date, goalOptions, onApply, onSaved }) {
  const [mode, setMode] = useState(null); // null | 'saveDay' | 'newChunk'
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const dayTemplates = templates.filter((t) => t.kind === "day");
  const chunkTemplates = templates.filter((t) => t.kind === "chunk");

  async function handleSaveDay(e) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await saveDayAsTemplate(date, name.trim());
      setName("");
      setMode(null);
      await onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <LayoutTemplate size={12} />
        Presets
      </div>

      {templates.length === 0 && mode === null && (
        <p className="placeholder-note" style={{ fontSize: 12.5, margin: "0 0 10px" }}>
          No presets yet. Build a day you'd repeat, then save it here.
        </p>
      )}

      {dayTemplates.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 5 }}>Full days</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {dayTemplates.map((t) => (
              <button key={t.id} onClick={() => onApply(t.id)} style={chipStyle(false)} title="Apply to this day">
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {chunkTemplates.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 5 }}>Blocks</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {chunkTemplates.map((t) => (
              <button key={t.id} onClick={() => onApply(t.id)} style={chipStyle(false)} title="Add to this day">
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "saveDay" && (
        <form onSubmit={handleSaveDay} style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this day preset…" style={inputStyle} autoFocus />
          <button type="submit" className="btn-primary" style={{ width: "auto", margin: 0, padding: "8px 12px" }} disabled={busy}>
            Save
          </button>
          <button type="button" onClick={() => setMode(null)} style={iconBtnStyle}>
            <X size={14} />
          </button>
        </form>
      )}

      {mode === "newChunk" && (
        <NewChunkTemplateForm
          userId={userId}
          goalOptions={goalOptions}
          onCancel={() => setMode(null)}
          onSaved={async () => {
            setMode(null);
            await onSaved();
          }}
        />
      )}

      {mode === null && (
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {hasContent && (
            <button onClick={() => setMode("saveDay")} style={textBtnStyle}>
              <Bookmark size={12} />
              Save this day
            </button>
          )}
          <button onClick={() => setMode("newChunk")} style={textBtnStyle}>
            <Plus size={12} />
            New block preset
          </button>
        </div>
      )}
    </div>
  );
}

function NewChunkTemplateForm({ userId, goalOptions, onCancel, onSaved }) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [goalNodeId, setGoalNodeId] = useState("");
  const [taskLines, setTaskLines] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || !title.trim() || busy) return;
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
      await onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Preset name (e.g. Morning routine)" style={inputStyle} required autoFocus />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Block title" style={inputStyle} required />
      <div style={{ display: "flex", gap: 8 }}>
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle} required />
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={inputStyle} required />
      </div>
      {goalOptions.length > 0 && (
        <select value={goalNodeId} onChange={(e) => setGoalNodeId(e.target.value)} style={inputStyle}>
          <option value="">No linked goal</option>
          {goalOptions.map((g) => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>
      )}
      <textarea
        value={taskLines}
        onChange={(e) => setTaskLines(e.target.value)}
        placeholder={"Tasks, one per line (optional)\nScripture study\nPrayer"}
        style={{ ...inputStyle, minHeight: 64, resize: "vertical" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary" style={{ width: "auto", flex: 1 }} disabled={busy}>
          {busy ? "Saving…" : "Save preset"}
        </button>
      </div>
    </form>
  );
}

function ChunkCard({ chunk, tasks, subtasksByParent, goalOptions, onAddTask, onAddSubtask, onToggle, onDeleteTask, onDeleteChunk }) {
  const goal = goalOptions.find((g) => g.id === chunk.goal_node_id);
  const done = tasks.filter((t) => t.status).length;

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
            {fmtTime(chunk.start_time)} – {fmtTime(chunk.end_time)}
          </div>
          <div style={{ fontWeight: 620, fontSize: 15, marginTop: 3, letterSpacing: "-0.01em" }}>{chunk.title}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {goal && <span className="pill" style={{ fontSize: 11 }}>{goal.title}</span>}
            {tasks.length > 0 && (
              <span className="pill" style={{ fontSize: 11, color: done === tasks.length ? "var(--accent)" : "var(--text-2)" }}>
                {done}/{tasks.length}
              </span>
            )}
          </div>
        </div>
        <button onClick={onDeleteChunk} style={iconBtnStyle} title="Delete block">
          <Trash2 size={14} />
        </button>
      </div>

      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          subtasks={subtasksByParent.get(task.id) ?? []}
          onToggle={() => onToggle(task)}
          onToggleSub={onToggle}
          onDelete={() => onDeleteTask(task.id)}
          onAddSubtask={(title) => onAddSubtask(task.id, title)}
        />
      ))}
      <InlineAdd placeholder="Add a task…" onAdd={onAddTask} />
    </div>
  );
}

function TaskRow({ task, subtasks, chunks, onToggle, onToggleSub, onDelete, onAddSubtask, onAssignChunk }) {
  const [showSubAdd, setShowSubAdd] = useState(false);
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
        <input type="checkbox" checked={task.status} onChange={onToggle} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13.5, minWidth: 0, textDecoration: task.status ? "line-through" : "none", opacity: task.status ? 0.55 : 1 }}>
          {task.title}
        </span>
        {task.rollover_count > 0 && (
          <span className="pill" style={{ fontSize: 10, color: "var(--danger-text)", borderColor: "rgba(217,69,59,0.5)", flexShrink: 0 }} title={`Moved forward ${task.rollover_count} day(s) in a row`}>
            moved {task.rollover_count}×
          </span>
        )}
        {chunks && chunks.length > 0 && (
          <select value="" onChange={(e) => e.target.value && onAssignChunk(e.target.value)} style={miniSelectStyle}>
            <option value="">Slot in…</option>
            {chunks.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        )}
        <button onClick={() => setShowSubAdd((v) => !v)} style={iconBtnStyle} title="Add sub-task">
          <Plus size={13} />
        </button>
        <button onClick={onDelete} style={iconBtnStyle} title="Delete">
          <X size={13} />
        </button>
      </div>

      {subtasks.length > 0 && (
        <div style={{ marginLeft: 26, borderLeft: "1px solid var(--border)", paddingLeft: 10 }}>
          {subtasks.map((st) => (
            <div key={st.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
              <input type="checkbox" checked={st.status} onChange={() => onToggleSub(st)} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12.5, textDecoration: st.status ? "line-through" : "none", opacity: st.status ? 0.55 : 1 }}>
                {st.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {showSubAdd && (
        <div style={{ marginLeft: 26 }}>
          <InlineAdd placeholder="Sub-task…" onAdd={(t) => { onAddSubtask(t); setShowSubAdd(false); }} small />
        </div>
      )}
    </div>
  );
}

function InlineAdd({ placeholder, onAdd, small }) {
  const [value, setValue] = useState("");
  function submit(e) {
    e.preventDefault();
    if (!value.trim()) return;
    onAdd(value);
    setValue("");
  }
  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 6, marginTop: 6 }}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, fontSize: small ? 12.5 : 13.5, padding: small ? "6px 10px" : "8px 10px" }}
      />
      <button type="submit" style={{ ...iconBtnStyle, border: "1px solid var(--border)", borderRadius: 6 }}>
        <Plus size={14} />
      </button>
    </form>
  );
}

function AddChunkForm({ goalOptions, onSave, onCancel }) {
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [title, setTitle] = useState("");
  const [goalNodeId, setGoalNodeId] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ start, end, title: title.trim(), goalNodeId });
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle} required />
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={inputStyle} required />
      </div>
      <input placeholder="Block title (e.g. Deep work)" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} required autoFocus />
      {goalOptions.length > 0 && (
        <select value={goalNodeId} onChange={(e) => setGoalNodeId(e.target.value)} style={inputStyle}>
          <option value="">No linked goal</option>
          {goalOptions.map((g) => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary" style={{ width: "auto", flex: 1 }}>Add block</button>
      </div>
    </form>
  );
}

function chipStyle(active) {
  return {
    background: active ? "var(--accent)" : "var(--inset)",
    border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
    color: active ? "var(--on-accent)" : "var(--text-2)",
    borderRadius: "var(--r-pill)",
    padding: "6px 13px",
    fontSize: 12,
    fontWeight: active ? 650 : 550,
  };
}

const addCardStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  color: "var(--accent)",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  border: "1px dashed var(--line-strong)",
  borderRadius: "var(--r-lg)",
  padding: 16,
  background: "transparent",
  width: "100%",
};

const iconBtnStyle = {
  background: "none",
  border: "none",
  color: "var(--text-faint)",
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  padding: 4,
};

const textBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  background: "none",
  border: "none",
  color: "var(--accent)",
  fontSize: 12.5,
  fontWeight: 600,
  padding: 0,
};

const miniSelectStyle = {
  background: "var(--inset)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-sm)",
  color: "var(--text-muted)",
  fontSize: 10.5,
  padding: "3px 4px",
  maxWidth: 90,
  flexShrink: 0,
};

const inputStyle = {
  width: "100%",
  background: "var(--inset)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r)",
  padding: "10px 12px",
  color: "var(--text)",
  fontSize: 13.5,
  fontFamily: "inherit",
};
