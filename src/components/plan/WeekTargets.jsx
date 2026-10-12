import { useState } from "react";
import { Plus, Trash2, Target, X } from "lucide-react";
import { saveWeeklyTarget, deleteWeeklyTarget } from "../../lib/api";
import { colorFor, fmtMinutes } from "../../lib/categories";
import { useToast } from "../ui/Feedback";

// What the week is FOR.
//
// A commitment arrives with a time already attached to it. A target does
// not — sixty hours of filming is a quantity with no place to be — and that
// is precisely why it loses every argument with a calendar unless it is
// written down and placed first. The planner is told to seat these before
// anything discretionary; a long lunch and a wind-down give way to them,
// not the other way round.
//
// Each one shows what actually happened last week beside what was asked
// for, because a target nobody measures is a wish.
export default function WeekTargets({ userId, targets, categories, onChanged }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [hidden, setHidden] = useState(() => new Set());
  const active = new Set((categories ?? []).map((c) => c.name));

  async function save(draft) {
    if (saving) return;
    setSaving(true);
    try {
      await saveWeeklyTarget(userId, { ...draft, position: draft.position ?? targets.length });
      setEditing(null);
      await onChanged?.();
    } catch (err) {
      toast.error(err, "Couldn't save that budget.");
    } finally {
      setSaving(false);
    }
  }

  function remove(t) {
    setEditing(null);
    setHidden((h) => new Set(h).add(t.id));
    const unhide = () =>
      setHidden((h) => {
        const next = new Set(h);
        next.delete(t.id);
        return next;
      });
    toast.undoable({
      message: `Deleted the “${t.label}” budget`,
      run: async () => {
        await deleteWeeklyTarget(t.id);
        await onChanged?.();
        unhide();
      },
      onUndo: unhide,
    });
  }

  return (
    <>
      <div className="section-label" style={{ marginBottom: 8 }}>
        <Target size={12} />
        What the week is for
      </div>

      {targets
        .filter((t) => !hidden.has(t.id))
        .map((t) => {
          const want = Number(t.weekly_minutes) || 0;
          const had = Number(t.last_week_minutes) || 0;
          const pct = want > 0 ? Math.min(1, had / want) : 0;
          const hue = t.categories?.[0] ? colorFor(t.categories[0]) : "var(--text-3)";
          // A category archived or renamed after the target was set. The
          // planner is only offered current categories, so a target that
          // names only gone ones gets blocks that count toward nothing — the
          // hours silently vanish from the projection.
          const gone = (t.categories ?? []).filter((c) => !active.has(c));

          if (editing?.id === t.id) {
            return (
              <TargetForm
                key={t.id}
                draft={editing}
                categories={categories}
                saving={saving}
                onChange={setEditing}
                onSave={save}
                onCancel={() => setEditing(null)}
                onDelete={() => remove(t)}
              />
            );
          }

          return (
            <button
              key={t.id}
              onClick={() => setEditing({ ...t, categories: t.categories ?? [] })}
              className="week-target"
              title="Change this budget"
            >
              <span className="row" style={{ gap: 7, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: hue, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 570 }}>{t.label}</span>
                <span className="mono faint" style={{ fontSize: 10.5 }}>
                  {fmtMinutes(t.minutes)} a {t.period === "day" ? "day" : "week"}
                </span>
                <span className="mono faint" style={{ fontSize: 10.5, marginLeft: "auto", flexShrink: 0 }}>
                  {fmtMinutes(had)} last week
                </span>
              </span>
              <span className="week-target__bar">
                <i style={{ width: `${pct * 100}%`, background: hue }} />
              </span>
              {gone.length > 0 && (
                <span style={{ display: "block", fontSize: 11.5, marginTop: 5, color: "var(--accent-text)" }}>
                  Counts {gone.join(", ")}, which {gone.length === 1 ? "is" : "are"} archived — the planner can't
                  use {gone.length === 1 ? "it" : "them"}, so none of this budget's hours will be planned. Tap to pick a current category.
                </span>
              )}
            </button>
          );
        })}

      {editing && !editing.id && (
        <TargetForm
          draft={editing}
          categories={categories}
          saving={saving}
          onChange={setEditing}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}

      {!editing && (
        <button
          className="btn-link"
          style={{ marginTop: 6, minHeight: 32 }}
          onClick={() => setEditing({ label: "", categories: [], minutes: 60, period: "week" })}
        >
          <Plus size={12} />
          Add a budget
        </button>
      )}
    </>
  );
}

function TargetForm({ draft, categories, saving, onChange, onSave, onCancel, onDelete }) {
  const hours = Math.floor(draft.minutes / 60);
  const mins = draft.minutes % 60;

  function setHM(h, m) {
    onChange({ ...draft, minutes: Math.max(1, (Number(h) || 0) * 60 + (Number(m) || 0)) });
  }

  function toggleCategory(name) {
    const has = draft.categories.includes(name);
    onChange({ ...draft, categories: has ? draft.categories.filter((c) => c !== name) : [...draft.categories, name] });
  }

  return (
    <div className="plan-inline-form">
      <input
        className="input"
        value={draft.label}
        placeholder="What you're protecting time for"
        aria-label="Budget name"
        onChange={(e) => onChange({ ...draft, label: e.target.value })}
        style={{ width: "100%", fontWeight: 570 }}
      />

      <div className="row" style={{ gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input className="input" type="number" min="0" value={hours} aria-label="Hours" onChange={(e) => setHM(e.target.value, mins)} style={{ width: 72 }} />
        <span className="faint" style={{ fontSize: 12 }}>h</span>
        <input className="input" type="number" min="0" max="59" value={mins} aria-label="Minutes" onChange={(e) => setHM(hours, e.target.value)} style={{ width: 72 }} />
        <span className="faint" style={{ fontSize: 12 }}>m per</span>
        <select className="input" value={draft.period} aria-label="Per" onChange={(e) => onChange({ ...draft, period: e.target.value })} style={{ width: 96 }}>
          <option value="week">week</option>
          <option value="day">day</option>
        </select>
      </div>

      <div className="faint" style={{ fontSize: 11.5, margin: "10px 0 6px" }}>
        Which tracked categories count toward it
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {draft.categories
          .filter((name) => !(categories ?? []).some((c) => c.name === name))
          .map((name) => (
            <button
              key={name}
              type="button"
              className="toggle-chip"
              onClick={() => toggleCategory(name)}
              title="Archived — tap to take it off"
              style={{ borderStyle: "dashed", textDecoration: "line-through" }}
            >
              {name}
              <X size={11} />
            </button>
          ))}
        {(categories ?? []).map((c) => (
          <button
            key={c.id ?? c.name}
            type="button"
            className="toggle-chip"
            aria-pressed={draft.categories.includes(c.name)}
            onClick={() => toggleCategory(c.name)}
          >
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color, flexShrink: 0 }} />
            {c.name}
          </button>
        ))}
      </div>

      <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button
          className="btn btn--accent"
          onClick={() => onSave(draft)}
          disabled={saving || !draft.label.trim() || draft.categories.length === 0}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button className="btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        {onDelete && (
          <button className="btn-link btn-link--danger" onClick={onDelete} disabled={saving} style={{ marginLeft: "auto", minHeight: 36 }}>
            <Trash2 size={12} />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
