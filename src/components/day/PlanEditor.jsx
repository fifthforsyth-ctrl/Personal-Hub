import { useMemo, useState } from "react";
import { Plus, Trash2, ChevronLeft, Check } from "lucide-react";
import { fmtDayHeading } from "../../lib/planDates";

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
      <button className="btn-link" onClick={onBack} style={{ marginBottom: 10 }}>
        <ChevronLeft size={13} />
        Back to the three
      </button>

      <div style={{ fontWeight: 650, fontSize: 15 }}>{plan.name}</div>
      <p className="card-note" style={{ margin: "4px 0 14px" }}>
        Change anything before it becomes {fmtDayHeading(date)}. Nothing is saved until you commit.
      </p>

      {blocks.map((block, i) => (
        <div
          key={i}
          style={{
            border: "1px solid var(--line)",
            borderRadius: "var(--r)",
            padding: 11,
            marginBottom: 8,
          }}
        >
          <div className="row" style={{ gap: 6, alignItems: "center" }}>
            <input
              className="input"
              value={block.title}
              placeholder="What this block is"
              onChange={(e) => patchBlock(i, { title: e.target.value })}
              style={{ flex: 1, minWidth: 0, fontWeight: 570 }}
            />
            <button
              className="btn-icon"
              onClick={() => removeBlock(i)}
              title="Remove this block"
              style={{ flexShrink: 0, color: "var(--text-3)" }}
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div className="row" style={{ gap: 6, marginTop: 7, alignItems: "center" }}>
            <input
              className="input"
              type="time"
              value={block.start}
              onChange={(e) => patchBlock(i, { start: e.target.value })}
              style={{ width: 118 }}
            />
            <span className="faint" style={{ fontSize: 12 }}>to</span>
            <input
              className="input"
              type="time"
              value={block.end}
              onChange={(e) => patchBlock(i, { end: e.target.value })}
              style={{ width: 118 }}
            />
            <span className="mono faint" style={{ fontSize: 10.5, marginLeft: "auto" }}>
              {spanLabel(block.start, block.end)}
            </span>
          </div>

          {block.tasks.map((task, k) => (
            <div key={k} className="row" style={{ gap: 6, marginTop: 6, alignItems: "center" }}>
              <span className="faint" style={{ fontSize: 12, flexShrink: 0 }}>○</span>
              <input
                className="input"
                value={task}
                placeholder="Task"
                onChange={(e) => patchTask(i, k, e.target.value)}
                style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}
              />
              <button className="btn-icon" onClick={() => removeTask(i, k)} title="Remove task" style={{ flexShrink: 0, color: "var(--text-3)" }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          <button className="btn-link" onClick={() => addTask(i)} style={{ marginTop: 7, fontSize: 11.5 }}>
            <Plus size={11} />
            Task
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
            <span style={{ color: "var(--warn, var(--accent))" }}>
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
  const mins = toMinutes(end) - toMinutes(start);
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}
