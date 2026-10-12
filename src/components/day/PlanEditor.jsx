import { useMemo, useState } from "react";
import { Plus, Trash2, ChevronLeft, Check } from "lucide-react";
import { fmtDayHeading } from "../../lib/planDates";
import "../../styles/plan.css";

// A proposed plan is a draft, not a decree.
//
// Committing wrote the assistant's blocks straight onto tomorrow, so the
// only way to move a block half an hour was to let it land wrong and then
// fix it on the day itself — by which point the plan you agreed to and the
// plan you are living have quietly diverged. Everything is editable here,
// and nothing is written until you press commit.
export default function PlanEditor({ plan, date, onCommit, onBack, busy }) {
  const [blocks, setBlocks] = useState(() =>
    (plan.blocks ?? []).map((b) => ({
      title: b.title ?? "",
      start: (b.start ?? "").slice(0, 5),
      end: (b.end ?? "").slice(0, 5),
      tasks: [...(b.tasks ?? [])],
    }))
  );

  function patchBlock(index, fields) {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, ...fields } : b)));
  }

  function removeBlock(index) {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  }

  function addBlock() {
    // Start where the day currently ends, so a new block lands after what's
    // already there rather than on top of it.
    const last = [...blocks].sort((a, b) => a.start.localeCompare(b.start)).at(-1);
    const start = last?.end || "08:00";
    setBlocks((prev) => [...prev, { title: "", start, end: addHour(start), tasks: [] }]);
  }

  function patchTask(blockIndex, taskIndex, value) {
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIndex ? { ...b, tasks: b.tasks.map((t, k) => (k === taskIndex ? value : t)) } : b
      )
    );
  }

  function removeTask(blockIndex, taskIndex) {
    setBlocks((prev) =>
      prev.map((b, i) => (i === blockIndex ? { ...b, tasks: b.tasks.filter((_, k) => k !== taskIndex) } : b))
    );
  }

  function addTask(blockIndex) {
    setBlocks((prev) => prev.map((b, i) => (i === blockIndex ? { ...b, tasks: [...b.tasks, ""] } : b)));
  }

  const ordered = useMemo(() => [...blocks].sort((a, b) => a.start.localeCompare(b.start)), [blocks]);

  const { hours, overlaps } = useMemo(() => {
    let minutes = 0;
    let clashes = 0;
    for (let i = 0; i < ordered.length; i++) {
      const s = toMinutes(ordered[i].start);
      const e = toMinutes(ordered[i].end);
      if (e > s) minutes += e - s;
      if (i > 0 && s < toMinutes(ordered[i - 1].end)) clashes += 1;
    }
    return { hours: minutes / 60, overlaps: clashes };
  }, [ordered]);

  const usable = ordered.filter((b) => b.title.trim() && b.start && b.end);

  return (
    <div>
      <button className="btn-link" onClick={onBack} style={{ marginBottom: 10, minHeight: 36 }} disabled={busy}>
        <ChevronLeft size={13} />
        Back to the three plans
      </button>

      <div style={{ fontWeight: 650, fontSize: 15 }}>{plan.name}</div>
      <p className="card-note" style={{ margin: "4px 0 14px" }}>
        Change anything before it becomes {fmtDayHeading(date)}. Nothing is saved until you commit, and committing
        replaces whatever the week planner roughed in for that day — your own blocks, and anything you have already
        started working on, stay put.
      </p>

      {blocks.map((block, i) => (
        <div key={i} className="plan-draft-block">
          <div className="plan-draft-block__top">
            <input
              className="input"
              value={block.title}
              placeholder="What this block is"
              aria-label="Block name"
              onChange={(e) => patchBlock(i, { title: e.target.value })}
            />
            <button
              className="btn-icon"
              onClick={() => removeBlock(i)}
              aria-label={`Remove ${block.title ? `“${block.title}”` : "this block"}`}
              title="Remove this block"
            >
              <Trash2 size={15} />
            </button>
          </div>

          <div className="plan-draft-block__times">
            <input
              className="input time-input"
              type="time"
              value={block.start}
              aria-label="Starts"
              onChange={(e) => patchBlock(i, { start: e.target.value })}
            />
            <span className="faint" style={{ fontSize: 12 }}>to</span>
            <input
              className="input time-input"
              type="time"
              value={block.end}
              aria-label="Ends"
              onChange={(e) => patchBlock(i, { end: e.target.value })}
            />
            <span className="plan-draft-block__span">{spanLabel(block.start, block.end)}</span>
          </div>

          {block.tasks.map((task, k) => (
            <div key={k} className="plan-draft-task">
              <span className="faint" style={{ fontSize: 12, flexShrink: 0 }} aria-hidden="true">○</span>
              <input
                className="input"
                value={task}
                placeholder="Task"
                aria-label="Task"
                onChange={(e) => patchTask(i, k, e.target.value)}
              />
              <button
                className="btn-icon"
                onClick={() => removeTask(i, k)}
                aria-label={`Remove ${task ? `“${task}”` : "this task"}`}
                title="Remove task"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          <button className="btn-link" onClick={() => addTask(i)} style={{ marginTop: 4, minHeight: 36 }}>
            <Plus size={12} />
            Add a task
          </button>
        </div>
      ))}

      <button className="btn-secondary" onClick={addBlock} style={{ width: "100%" }}>
        <Plus size={13} />
        Add a block
      </button>

      <div className="row row--between" style={{ marginTop: 12, flexWrap: "wrap", gap: 6 }}>
        <span className="faint" style={{ fontSize: 11.5 }}>
          {usable.length} {usable.length === 1 ? "block" : "blocks"} · {hours.toFixed(1)}h planned
          {overlaps > 0 && (
            <span style={{ color: "var(--accent-text)" }}>
              {" "}
              · {overlaps} {overlaps === 1 ? "overlap" : "overlaps"}
            </span>
          )}
        </span>
      </div>

      <button
        className="btn btn--accent btn--block"
        style={{ marginTop: 10 }}
        onClick={() =>
          onCommit({
            ...plan,
            blocks: usable.map((b) => ({ ...b, tasks: b.tasks.filter((t) => t.trim()) })),
          })
        }
        disabled={busy || usable.length === 0}
      >
        <Check size={15} />
        {busy ? "Committing…" : `Commit to ${fmtDayHeading(date)}`}
      </button>
    </div>
  );
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm ?? "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
}

function addHour(hhmm) {
  const total = Math.min(toMinutes(hhmm) + 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function spanLabel(start, end) {
  // Crossing midnight is a real span, not a negative one.
  const s = toMinutes(start);
  const e = toMinutes(end);
  const mins = e > s ? e - s : s === e ? 0 : 1440 - s + e;
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}
