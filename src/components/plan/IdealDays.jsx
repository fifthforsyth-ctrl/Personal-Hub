import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchIdealDays, saveIdealDay, deleteTemplate, fetchCategories, WEEKDAY_NAMES } from "../../lib/api";
import DayRing from "../DayRing";
import { colorFor, setCategoryColors } from "../../lib/categories";

// An ideal day drawn the same way a real one is: same ring, same colours,
// same window. That is the whole point of giving its blocks categories —
// the intent and the record become the same kind of picture, so holding one
// against the other needs no translation.
function blocksToArcs(blocks) {
  return (blocks ?? [])
    .filter((b) => b.category && b.start && b.end)
    .map((b) => ({
      start_min: toMinutes(b.start),
      end_min: toMinutes(b.end),
      category: b.category,
    }));
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm ?? "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
}

// The standing intent, kept next to the record.
//
// Everything else in the app answers "what happened". This answers "what was
// supposed to happen" — the shape a Tuesday is meant to have, decided once,
// calmly, rather than re-argued at 10pm when you are tired and the day has
// already gone. The planner reads it alongside your last fortnight, which is
// the only way it can tell a deliberate 5:30am start from a habit you have
// been failing at.
//
// Stored as ordinary day templates, so anything that can stamp a template
// onto a date works on these unchanged.
export default function IdealDays() {
  const { user } = useAuth();
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    try {
      setDays(await fetchIdealDays(user.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!user?.id) return;
    fetchCategories(user.id)
      .then((cats) => {
        setCategoryColors(cats);
        setCategories(cats);
      })
      .catch(() => {});
  }, [user?.id]);

  async function remove(day) {
    if (!window.confirm(`Delete "${day.name}"? Days it governs will fall back to your recent record.`)) return;
    try {
      await deleteTemplate(day.id);
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  // Which weekdays nothing claims — worth naming, since those are exactly
  // the days the planner has only the record to go on.
  const claimed = new Set(days.flatMap((d) => d.weekdays ?? []));
  const unclaimed = WEEKDAY_NAMES.map((n, i) => ({ n, i })).filter(({ i }) => !claimed.has(i));

  if (editing) {
    return (
      <DayEditor
        day={editing}
        userId={user.id}
        categories={categories}
        onCancel={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await reload();
        }}
        onDelete={editing.id ? () => remove(editing) : null}
      />
    );
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <p className="card-note" style={{ margin: 0 }}>
        The shape each weekday is supposed to have. The assistant starts from these when it proposes tomorrow, and
        departs from them only where your last two weeks or your notes give it a reason.
      </p>

      {error && <div className="form-error">{error}</div>}
      {loading && <p className="empty">Loading…</p>}

      <div className="ideal-day-grid">
        {days.map((day) => {
          const arcs = blocksToArcs(day.blocks);
          return (
            <button key={day.id} className="card ideal-day" onClick={() => setEditing(day)}>
              <div className="row row--between" style={{ alignItems: "baseline", gap: 10 }}>
                <span style={{ fontWeight: 650, fontSize: 14.5 }}>{day.name}</span>
                <span className="mono faint" style={{ fontSize: 10.5, flexShrink: 0 }}>
                  {(day.weekdays ?? []).length > 0 ? day.weekdays.map((w) => WEEKDAY_NAMES[w]).join(" ") : "no weekday"}
                </span>
              </div>

              {arcs.length > 0 && (
                <div style={{ display: "flex", justifyContent: "center", margin: "10px 0 8px" }}>
                  <DayRing arcs={arcs} size={150} showLabels />
                </div>
              )}

              <div className="ideal-day__blocks">
                {day.blocks.map((b, i) => (
                  <span key={i} className="ideal-day__chip" title={`${b.start}–${b.end}`}>
                    <span className="ideal-day__dot" style={{ background: b.category ? colorFor(b.category) : "var(--line-strong)" }} />
                    {b.title}
                  </span>
                ))}
              </div>

              {day.notes && <div className="muted" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>{day.notes}</div>}
            </button>
          );
        })}
      </div>

      {!loading && unclaimed.length > 0 && (
        <p className="faint" style={{ fontSize: 11.5, margin: "2px 0 0" }}>
          No ideal day claims {unclaimed.map((u) => u.n).join(", ")} — on those the planner has only your record to go
          on.
        </p>
      )}

      <button
        className="btn-secondary"
        style={{ width: "100%" }}
        onClick={() => setEditing({ name: "", notes: "", weekdays: [], blocks: [] })}
      >
        <Plus size={14} />
        New ideal day
      </button>
    </div>
  );
}

function DayEditor({ day, userId, categories, onCancel, onSaved, onDelete }) {
  const [name, setName] = useState(day.name ?? "");
  const [notes, setNotes] = useState(day.notes ?? "");
  const [weekdays, setWeekdays] = useState(day.weekdays ?? []);
  const [blocks, setBlocks] = useState(() => (day.blocks ?? []).map((b) => ({ ...b, tasks: [...(b.tasks ?? [])] })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function toggleWeekday(i) {
    setWeekdays((prev) => (prev.includes(i) ? prev.filter((w) => w !== i) : [...prev, i].sort((a, b) => a - b)));
  }

  function patchBlock(index, fields) {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, ...fields } : b)));
  }

  function addBlock() {
    const last = [...blocks].sort((a, b) => a.start.localeCompare(b.start)).at(-1);
    const start = last?.end || "06:00";
    setBlocks((prev) => [...prev, { title: "", category: "", start, end: plusHour(start), tasks: [] }]);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveIdealDay(userId, { id: day.id, name, notes, weekdays, blocks });
      await onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <button className="btn-link" onClick={onCancel}>
        ← Back to ideal days
      </button>

      <label className="field">
        <span>Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ideal weekday" />
      </label>

      <div className="field">
        <span>Which days this is the ideal for</span>
        <div className="row" style={{ gap: 4, flexWrap: "wrap", marginTop: 4 }}>
          {WEEKDAY_NAMES.map((label, i) => {
            const on = weekdays.includes(i);
            return (
              <button
                key={i}
                onClick={() => toggleWeekday(i)}
                style={{
                  border: `1px solid ${on ? "var(--accent)" : "var(--line)"}`,
                  background: on ? "var(--accent)" : "transparent",
                  color: on ? "var(--on-accent)" : "var(--text-2)",
                  borderRadius: "var(--r-sm)",
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 650,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="field">
        <span>Why it is shaped this way</span>
        <textarea
          className="textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="11 work hours. Study first thing. Thursday 7–8:30pm is not mine."
          style={{ minHeight: 62 }}
        />
      </label>

      {/* The live ring, so a change to a time is something you see rather
          than something you have to picture. */}
      {blocksToArcs(blocks).length > 0 && (
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
          <DayRing arcs={blocksToArcs(blocks)} size={190} showLabels />
        </div>
      )}

      {blocks.map((block, i) => (
        <div key={i} style={{ border: "1px solid var(--line)", borderRadius: "var(--r)", padding: 11 }}>
          <div className="row" style={{ gap: 6, alignItems: "center" }}>
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: 3,
                flexShrink: 0,
                background: block.category ? colorFor(block.category) : "var(--line-strong)",
              }}
            />
            <input
              className="input"
              value={block.title}
              placeholder="Block name"
              onChange={(e) => patchBlock(i, { title: e.target.value })}
              style={{ flex: 1, minWidth: 0, fontWeight: 570 }}
            />
            <button
              className="btn-icon"
              onClick={() => setBlocks((prev) => prev.filter((_, k) => k !== i))}
              title="Remove block"
              style={{ flexShrink: 0, color: "var(--text-3)" }}
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="row" style={{ gap: 6, marginTop: 7, alignItems: "center", flexWrap: "wrap" }}>
            <input className="input" type="time" value={block.start} onChange={(e) => patchBlock(i, { start: e.target.value })} style={{ width: 118 }} />
            <span className="faint" style={{ fontSize: 12 }}>to</span>
            <input className="input" type="time" value={block.end} onChange={(e) => patchBlock(i, { end: e.target.value })} style={{ width: 118 }} />
            <select
              className="input"
              value={block.category ?? ""}
              onChange={(e) => patchBlock(i, { category: e.target.value })}
              style={{ flex: 1, minWidth: 120 }}
              title="Which category this block counts as — this is what colours it"
            >
              <option value="">No colour</option>
              {(categories ?? []).map((c) => (
                <option key={c.id ?? c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}

      <button className="btn-secondary" style={{ width: "100%" }} onClick={addBlock}>
        <Plus size={13} />
        Add a block
      </button>

      {error && <div className="form-error">{error}</div>}

      <button className="btn btn--accent btn--block" onClick={save} disabled={saving || !name.trim()}>
        <Check size={15} />
        {saving ? "Saving…" : "Save ideal day"}
      </button>

      {onDelete && (
        <button className="btn-link" onClick={onDelete} style={{ color: "var(--text-3)" }}>
          <Trash2 size={12} />
          Delete this ideal day
        </button>
      )}
    </div>
  );
}

function plusHour(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  const total = Math.min((h || 0) * 60 + (m || 0) + 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
