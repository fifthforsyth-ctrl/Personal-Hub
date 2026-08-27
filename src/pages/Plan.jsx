import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, RotateCcw, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
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
  fetchTimeEntriesForDate,
  fetchGoalOptions,
} from "../lib/api";

const ENERGY_TAGS = ["Open day", "Heavy edit day", "Deep focus", "Recovery day"];

function todayStr() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function fmtDateHeading(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

// Minutes since midnight for a "HH:MM" or "HH:MM:SS" time string.
function minutesOf(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fmtTime(t) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// Phase 2 — the day view where the block is the unit of planning. Every
// task can optionally trace to a Goal Tree node; incomplete tasks roll
// forward onto today automatically (flagged, not buried) the moment you
// land on today; end-of-day, plan is compared against what actually got
// logged in the time log.
export default function Plan() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayStr());
  const [dayPlan, setDayPlanState] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [actualEntries, setActualEntries] = useState([]);
  const [goalOptions, setGoalOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingChunk, setAddingChunk] = useState(false);
  const [rolledMsg, setRolledMsg] = useState(null);

  const isToday = date === todayStr();

  useEffect(() => {
    if (user?.id) fetchGoalOptions(user.id).then(setGoalOptions).catch(() => {});
  }, [user?.id]);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const [plan, chunkList, taskList, actual] = await Promise.all([
      fetchDayPlan(user.id, date),
      fetchTimeChunks(user.id, date),
      fetchTasks(user.id, date),
      fetchTimeEntriesForDate(user.id, date),
    ]);
    setDayPlanState(plan);
    setChunks(chunkList);
    setTasks(taskList);
    setActualEntries(actual);
    setLoading(false);
  }, [user?.id, date]);

  // Rollover fires once, only when landing on today — never when browsing
  // past or future days, and never repeatedly for the same visit.
  useEffect(() => {
    if (!user?.id || !isToday) {
      reload();
      return;
    }
    (async () => {
      const n = await rolloverIncompleteTasks().catch(() => 0);
      if (n > 0) setRolledMsg(`Moved ${n} unfinished ${n === 1 ? "task" : "tasks"} forward from earlier days.`);
      await reload();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, date]);

  const tasksByChunk = useMemo(() => {
    const map = new Map();
    const unscheduled = [];
    for (const t of tasks) {
      if (t.parent_task_id) continue; // rendered under their parent
      if (t.time_chunk_id) {
        if (!map.has(t.time_chunk_id)) map.set(t.time_chunk_id, []);
        map.get(t.time_chunk_id).push(t);
      } else {
        unscheduled.push(t);
      }
    }
    return { map, unscheduled };
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

  const plannedMinutes = chunks.reduce((sum, c) => sum + Math.max(0, minutesOf(c.end_time) - minutesOf(c.start_time)), 0);
  const actualMinutes = actualEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
  const topLevelTasks = tasks.filter((t) => !t.parent_task_id);
  const doneCount = topLevelTasks.filter((t) => t.status).length;

  async function handleAddChunk({ start, end, title, goalNodeId }) {
    await createTimeChunk(user.id, { date, start_time: start, end_time: end, title, goal_node_id: goalNodeId || null });
    setAddingChunk(false);
    await reload();
  }

  async function handleSetEnergy(tag) {
    const next = dayPlan?.energy_tag === tag ? null : tag;
    await setDayEnergyTag(user.id, date, next);
    setDayPlanState((p) => ({ ...(p ?? { user_id: user.id, date }), energy_tag: next }));
  }

  async function handleAddTask(chunkId, title) {
    if (!title.trim()) return;
    await createTask(user.id, { date, time_chunk_id: chunkId ?? null, title: title.trim() });
    await reload();
  }

  async function handleAddSubtask(parentId, title) {
    if (!title.trim()) return;
    const parent = tasks.find((t) => t.id === parentId);
    await createTask(user.id, { date, time_chunk_id: parent?.time_chunk_id ?? null, parent_task_id: parentId, title: title.trim() });
    await reload();
  }

  async function handleToggle(task) {
    await toggleTask(task.id, !task.status);
    await reload();
  }

  async function handleDeleteTask(taskId) {
    await deleteTask(taskId);
    await reload();
  }

  async function handleDeleteChunk(chunkId) {
    await deleteTimeChunk(chunkId);
    await reload();
  }

  async function handleAssignChunk(taskId, chunkId) {
    await updateTask(taskId, { time_chunk_id: chunkId || null });
    await reload();
  }

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <button onClick={() => setDate((d) => addDays(d, -1))} style={navBtnStyle}>
          <ChevronLeft size={16} />
        </button>
        <div style={{ textAlign: "center" }}>
          <h1 className="page-title" style={{ fontSize: 18, marginBottom: 0 }}>
            {isToday ? "Today's Plan" : fmtDateHeading(date)}
          </h1>
          {!isToday && <button onClick={() => setDate(todayStr())} style={{ background: "none", border: "none", color: "var(--accent-strong)", fontSize: 12, padding: 0 }}>Jump to today</button>}
        </div>
        <button onClick={() => setDate((d) => addDays(d, 1))} style={navBtnStyle}>
          <ChevronRight size={16} />
        </button>
      </div>
      <p className="page-subtitle" style={{ textAlign: "center" }}>{fmtDateHeading(date)}</p>

      {rolledMsg && (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--accent-dim)", border: "1px solid var(--accent-strong)", marginBottom: 14 }}>
          <RotateCcw size={14} color="var(--accent-strong)" />
          <span style={{ fontSize: 13 }}>{rolledMsg}</span>
        </div>
      )}

      <div className="card">
        <div className="section-label">Energy / capacity</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ENERGY_TAGS.map((tag) => {
            const active = dayPlan?.energy_tag === tag;
            return (
              <button
                key={tag}
                onClick={() => handleSetEnergy(tag)}
                style={{
                  background: active ? "var(--accent-dim)" : "var(--bg-inset)",
                  border: `1px solid ${active ? "var(--accent-strong)" : "var(--border)"}`,
                  color: active ? "var(--text)" : "var(--text-muted)",
                  borderRadius: 999,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {!loading && chunks.length === 0 && tasksByChunk.unscheduled.length === 0 && (
        <p className="placeholder-note" style={{ marginTop: 16 }}>No time blocks yet — add one below, or drop an unscheduled task straight on the day.</p>
      )}

      {chunks.map((chunk) => (
        <ChunkCard
          key={chunk.id}
          chunk={chunk}
          tasks={tasksByChunk.map.get(chunk.id) ?? []}
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
        <button onClick={() => setAddingChunk(true)} className="card" style={{ ...addCardStyle }}>
          <Plus size={16} />
          Add a time block
        </button>
      )}

      {tasksByChunk.unscheduled.length > 0 && (
        <div className="card">
          <div className="section-label">Unscheduled</div>
          {tasksByChunk.unscheduled.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              subtasks={subtasksByParent.get(task.id) ?? []}
              chunks={chunks}
              onToggle={() => handleToggle(task)}
              onDelete={() => handleDeleteTask(task.id)}
              onAddSubtask={(title) => handleAddSubtask(task.id, title)}
              onAssignChunk={(chunkId) => handleAssignChunk(task.id, chunkId)}
            />
          ))}
          <InlineAdd placeholder="Add an unscheduled task…" onAdd={(title) => handleAddTask(null, title)} />
        </div>
      )}

      {(chunks.length > 0 || topLevelTasks.length > 0) && (
        <div className="card">
          <div className="section-label">Plan vs. actual</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: "var(--text-muted)" }}>Time planned</span>
            <span style={{ fontFamily: "var(--font-mono)" }}>{Math.round(plannedMinutes)}m</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: "var(--text-muted)" }}>Time logged</span>
            <span style={{ fontFamily: "var(--font-mono)" }}>{Math.round(actualMinutes)}m</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "var(--text-muted)" }}>Tasks done</span>
            <span style={{ fontFamily: "var(--font-mono)" }}>{doneCount} / {topLevelTasks.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ChunkCard({ chunk, tasks, subtasksByParent, goalOptions, onAddTask, onAddSubtask, onToggle, onDeleteTask, onDeleteChunk }) {
  const goal = goalOptions.find((g) => g.id === chunk.goal_node_id);
  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
            {fmtTime(chunk.start_time)} – {fmtTime(chunk.end_time)}
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>{chunk.title}</div>
          {goal && <div className="pill" style={{ marginTop: 6, fontSize: 11 }}>{goal.title}</div>}
        </div>
        <button onClick={onDeleteChunk} style={{ background: "none", border: "none", color: "var(--text-faint)" }} title="Delete block">
          <Trash2 size={14} />
        </button>
      </div>

      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          subtasks={subtasksByParent.get(task.id) ?? []}
          onToggle={() => onToggle(task)}
          onDelete={() => onDeleteTask(task.id)}
          onAddSubtask={(title) => onAddSubtask(task.id, title)}
        />
      ))}
      <InlineAdd placeholder="Add a task…" onAdd={onAddTask} />
    </div>
  );
}

function TaskRow({ task, subtasks, chunks, onToggle, onDelete, onAddSubtask, onAssignChunk }) {
  const [showSubAdd, setShowSubAdd] = useState(false);
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
        <input type="checkbox" checked={task.status} onChange={onToggle} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13.5, textDecoration: task.status ? "line-through" : "none", opacity: task.status ? 0.55 : 1 }}>
          {task.title}
        </span>
        {task.rollover_count > 0 && (
          <span className="pill" style={{ fontSize: 10, color: "var(--danger)", borderColor: "var(--danger)" }} title={`Moved forward ${task.rollover_count} day(s) in a row`}>
            moved {task.rollover_count}x
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
        <div style={{ marginLeft: 26 }}>
          {subtasks.map((st) => (
            <div key={st.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
              <input type="checkbox" checked={st.status} onChange={() => onToggle(st)} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12.5, textDecoration: st.status ? "line-through" : "none", opacity: st.status ? 0.55 : 1 }}>{st.title}</span>
            </div>
          ))}
        </div>
      )}
      {showSubAdd && (
        <div style={{ marginLeft: 26 }}>
          <InlineAdd placeholder="Sub-task…" onAdd={(title) => { onAddSubtask(title); setShowSubAdd(false); }} small />
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
      <button type="submit" style={{ ...iconBtnStyle, border: "1px solid var(--border)" }}>
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
    if (!title.trim() || !start || !end) return;
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

const navBtnStyle = {
  background: "var(--bg-inset)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--text)",
};

const addCardStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  color: "var(--accent-strong)",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  border: "1px dashed var(--border-strong)",
  background: "transparent",
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

const miniSelectStyle = {
  background: "var(--bg-inset)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-muted)",
  fontSize: 10.5,
  padding: "3px 4px",
  maxWidth: 90,
};

const inputStyle = {
  width: "100%",
  background: "var(--bg-inset)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "10px 12px",
  color: "var(--text)",
  fontSize: 13.5,
  fontFamily: "inherit",
};
