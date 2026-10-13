import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchIdealDays, saveIdealDay, deleteTemplate, fetchCategories, WEEKDAY_NAMES } from "../../lib/api";
import DayRing from "../DayRing";
import { colorFor, setCategoryColors } from "../../lib/categories";
import { useLoad } from "../../lib/useLoad";
import { friendlyError } from "../../lib/errors";
import { useToast, useConfirm } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import { fmtTimeRange } from "../../lib/planDates";
import "../../styles/plan.css";

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
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null);

  // Categories come with the days: without them the rings have no colours
  // and the editor has nothing to colour a block with.
  const { data, error, loading, reload } = useLoad(async () => {
    if (!user?.id) return null;
    const [days, categories] = await Promise.all([fetchIdealDays(user.id), fetchCategories(user.id)]);
    setCategoryColors(categories);
    return { days, categories };
  }, [user?.id]);

  const days = data?.days ?? [];

  async function remove(day) {
    const yes = await confirm({
      title: `Delete “${day.name || "this ideal day"}”?`,
      body: "The planner stops using it. Days it covered fall back to your recent record.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!yes) return false;
    try {
      await deleteTemplate(day.id);
    } catch (err) {
      toast.error(err, "Couldn't delete it. Try again.");
      return false;
    }
    setEditing(null);
    toast.show(`Deleted “${day.name || "ideal day"}”`);
    reload();
    return true;
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
        categories={data?.categories ?? []}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
        onDelete={editing.id ? () => remove(editing) : null}
      />
    );
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <p className="card-note" style={{ margin: 0 }}>
        The shape each weekday is supposed to have. The planner lays out your week from these, and departs from them
        only where your last two weeks or your notes give it a reason.
      </p>

      {error && !data && <LoadError what="your ideal days" error={error} onRetry={reload} />}
      {error && data && <LoadError stale error={error} onRetry={reload} />}
      {loading && !data && !error && <p className="empty">Loading…</p>}

      {days.length > 0 && (
        <div className="ideal-day-grid">
          {days.map((day) => {
            const arcs = blocksToArcs(day.blocks);
            const weekdays = (day.weekdays ?? []).map((w) => WEEKDAY_NAMES[w]).join(" ");
            return (
              <button
                key={day.id}
                className="card ideal-day"
                onClick={() => setEditing(day)}
                aria-label={`Edit ${day.name || "ideal day"}`}
              >
                <span className="ideal-day__head">
                  <span className="ideal-day__name">{day.name}</span>
                  <span className="ideal-day__days">{weekdays || "No weekday"}</span>
                </span>

                {arcs.length > 0 && (
                  <span className="ideal-day__ring">
                    <DayRing arcs={arcs} size={150} showLabels />
                  </span>
                )}

                <span className="ideal-day__blocks">
                  {(day.blocks ?? []).map((b, i) => (
                    <span
                      key={i}
                      className="ideal-day__chip"
                      title={b.start && b.end ? fmtTimeRange(b.start, b.end) : undefined}
                    >
                      <span
                        className="ideal-day__dot"
                        style={{ background: b.category ? colorFor(b.category) : "var(--line-strong)" }}
                      />
                      {b.title || "Untitled block"}
                    </span>
                  ))}
                </span>

                {day.notes && <span className="ideal-day__notes">{day.notes}</span>}
              </button>
            );
          })}
        </div>
      )}

      {data && unclaimed.length > 0 && (
        <p className="faint" style={{ fontSize: 11.5, margin: "2px 0 0" }}>
          {days.length === 0
            ? "No ideal days yet — the planner has only your record to go on."
            : `No ideal day covers ${unclaimed.map((u) => u.n).join(", ")} — on those the planner has only your record to go on.`}
        </p>
      )}

      {data && (
        <button
          className="btn-secondary"
          style={{ width: "100%" }}
          onClick={() => setEditing({ name: "", notes: "", weekdays: [], blocks: [] })}
        >
          <Plus size={14} />
          New ideal day
        </button>
      )}
    </div>
  );
}

function DayEditor({ day, userId, categories, onCancel, onSaved, onDelete }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState(day.name ?? "");
  const [notes, setNotes] = useState(day.notes ?? "");
  const [weekdays, setWeekdays] = useState(day.weekdays ?? []);
  const [blocks, setBlocks] = useState(() => (day.blocks ?? []).map((b) => ({ ...b, tasks: [...(b.tasks ?? [])] })));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const topRef = useRef(null);

  // Opened from a card further down the list, the editor would otherwise
  // start somewhere in its middle.
  useEffect(() => {
    const el = topRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  }, []);

  function touch(fn) {
    setDirty(true);
    fn();
  }

  function toggleWeekday(i) {
    touch(() => setWeekdays((prev) => (prev.includes(i) ? prev.filter((w) => w !== i) : [...prev, i].sort((a, b) => a - b))));
  }

  function patchBlock(index, fields) {
    touch(() => setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, ...fields } : b))));
  }

  function addBlock() {
    const last = [...blocks].sort((a, b) => String(a.start).localeCompare(String(b.start))).at(-1);
    const start = last?.end || "06:00";
    touch(() => setBlocks((prev) => [...prev, { title: "", category: "", start, end: plusHour(start), tasks: [] }]));
  }

  function removeBlock(index) {
    touch(() => setBlocks((prev) => prev.filter((_, k) => k !== index)));
  }

  async function back() {
    if (saving || deleting) return;
    if (
      dirty &&
      !(await confirm({
        title: "Leave without saving?",
        body: "Your changes to this ideal day haven't been saved.",
        confirmLabel: "Discard changes",
        danger: true,
      }))
    ) {
      return;
    }
    onCancel();
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveIdealDay(userId, { id: day.id, name: name.trim(), notes, weekdays, blocks });
    } catch (err) {
      setError(friendlyError(err, "Couldn't save the ideal day. Try again."));
      setSaving(false);
      return;
    }
    toast.show(day.id ? `Saved “${name.trim()}”` : `Added “${name.trim()}”`);
    onSaved();
  }

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    const gone = await onDelete();
    if (!gone) setDeleting(false);
  }

  const arcs = blocksToArcs(blocks);

  return (
    <div className="stack" style={{ gap: 10 }} ref={topRef}>
      <div>
        <button className="btn-link" onClick={back} style={{ minHeight: 36 }}>
          ← Back to ideal days
        </button>
      </div>

      <div className="card stack ideal-editor" style={{ gap: 12 }}>
        <label className="field">
          <span>Name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => touch(() => setName(e.target.value))}
            placeholder="Ideal weekday"
          />
        </label>

        <div className="field">
          <span id="ideal-weekdays-label">Which days this is the ideal for</span>
          <div className="ideal-weekdays" role="group" aria-labelledby="ideal-weekdays-label">
            {WEEKDAY_NAMES.map((label, i) => (
              <button
                key={i}
                type="button"
                className="toggle-chip"
                aria-pressed={weekdays.includes(i)}
                onClick={() => toggleWeekday(i)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Why it is shaped this way</span>
          <textarea
            className="textarea"
            value={notes}
            onChange={(e) => touch(() => setNotes(e.target.value))}
            placeholder="11 work hours. Study first thing. Thursday 7–8:30pm is not mine."
            style={{ minHeight: 62 }}
          />
        </label>

        {/* The live ring, so a change to a time is something you see rather
            than something you have to picture. */}
        {arcs.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
            <DayRing arcs={arcs} size={190} showLabels />
          </div>
        )}

        {blocks.map((block, i) => (
          <div key={i} className="ideal-block">
            <div className="ideal-block__top">
              <span
                className="ideal-day__dot ideal-block__dot"
                style={{ background: block.category ? colorFor(block.category) : "var(--line-strong)" }}
              />
              <input
                className="input"
                value={block.title}
                placeholder="Block name"
                aria-label="Block name"
                onChange={(e) => patchBlock(i, { title: e.target.value })}
              />
              <button
                type="button"
                className="btn-icon"
                onClick={() => removeBlock(i)}
                aria-label={`Remove ${block.title ? `“${block.title}”` : "this block"}`}
                title="Remove block"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="ideal-block__bottom">
              <span className="ideal-block__times">
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
              </span>
              <select
                className="input"
                value={block.category ?? ""}
                onChange={(e) => patchBlock(i, { category: e.target.value })}
                aria-label="Category"
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

        <button className="btn btn--accent btn--block" onClick={save} disabled={saving || deleting || !name.trim()}>
          <Check size={15} />
          {saving ? "Saving…" : "Save ideal day"}
        </button>
        {!name.trim() && <p className="faint" style={{ fontSize: 11.5, margin: "-4px 0 0" }}>Give it a name to save it.</p>}

        {onDelete && (
          <div>
            <button className="btn-link btn-link--danger" onClick={remove} disabled={saving || deleting} style={{ minHeight: 36 }}>
              <Trash2 size={12} />
              {deleting ? "Deleting…" : "Delete this ideal day"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function plusHour(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  const total = Math.min((h || 0) * 60 + (m || 0) + 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
