import { useState } from "react";
import { Plus, Trash2, Target, Check, X } from "lucide-react";
import { saveWeeklyTarget, deleteWeeklyTarget } from "../../lib/api";
import { colorFor, fmtMinutes } from "../../lib/categories";

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
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  async function save(draft) {
    try {
      await saveWeeklyTarget(userId, { ...draft, position: draft.position ?? targets.length });
      setEditing(null);
      await onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    try {
      await deleteWeeklyTarget(id);
      setEditing(null);
      await onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="section-label" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <Target size={12} />
        What the week is for
      </div>

      {targets.map((t) => {
        const want = Number(t.weekly_minutes) || 0;
        const had = Number(t.last_week_minutes) || 0;
        const pct = want > 0 ? Math.min(1, had / want) : 0;
        const hue = t.categories?.[0] ? colorFor(t.categories[0]) : "var(--accent)";

        if (editing?.id === t.id) {
          return <TargetForm key={t.id} draft={editing} categories={categories} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} onDelete={() => remove(t.id)} />;
        }

        return (
          <button
            key={t.id}
            onClick={() => setEditing({ ...t, categories: t.categories ?? [] })}
            className="week-target"
          >
            <span className="row" style={{ gap: 7, alignItems: "baseline" }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: hue, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 570 }}>{t.label}</span>
              <span className="mono faint" style={{ fontSize: 10.5 }}>
                {fmtMinutes(t.minutes)} / {t.period === "day" ? "day" : "week"}
              </span>
              <span className="mono faint" style={{ fontSize: 10.5, marginLeft: "auto", flexShrink: 0 }}>
                {fmtMinutes(had)} last week
              </span>
            </span>
            <span className="week-target__bar">
              <i style={{ width: `${pct * 100}%`, background: hue }} />
            </span>
          </button>
        );
      })}

      {editing && !editing.id && (
        <TargetForm draft={editing} categories={categories} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} />
      )}

      {error && <div className="form-error" style={{ marginTop: 8 }}>{error}</div>}

      {!editing && (
        <button
          className="btn-link"
          style={{ marginTop: 6, fontSize: 11.5 }}
          onClick={() => setEditing({ label: "", categories: [], minutes: 60, period: "week" })}
        >
          <Plus size={11} />
          Target
        </button>
      )}
    </>
  );
}

function TargetForm({ draft, categories, onChange, onSave, onCancel, onDelete }) {
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
    <div style={{ border: "1px solid var(--accent-line)", borderRadius: "var(--r)", padding: 11, marginBottom: 8 }}>
      <input
        className="input"
        value={draft.label}
        placeholder="What you're protecting time for"
        onChange={(e) => onChange({ ...draft, label: e.target.value })}
        style={{ width: "100%", fontWeight: 570 }}
      />

      <div className="row" style={{ gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input className="input" type="number" min="0" value={hours} onChange={(e) => setHM(e.target.value, mins)} style={{ width: 68 }} />
        <span className="faint" style={{ fontSize: 12 }}>h</span>
        <input className="input" type="number" min="0" max="59" value={mins} onChange={(e) => setHM(hours, e.target.value)} style={{ width: 68 }} />
        <span className="faint" style={{ fontSize: 12 }}>m per</span>
        <select className="input" value={draft.period} onChange={(e) => onChange({ ...draft, period: e.target.value })} style={{ width: 92 }}>
          <option value="week">week</option>
          <option value="day">day</option>
        </select>
      </div>

      <div className="faint" style={{ fontSize: 11, margin: "10px 0 5px" }}>
        Which tracked categories count toward it
      </div>
      <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
        {(categories ?? []).map((c) => {
          const on = draft.categories.includes(c.name);
          return (
            <button
              key={c.id ?? c.name}
              onClick={() => toggleCategory(c.name)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                border: `1px solid ${on ? c.color : "var(--line)"}`,
                background: on ? `${c.color}22` : "transparent",
                color: on ? "var(--text)" : "var(--text-3)",
                borderRadius: "var(--r-sm)",
                padding: "4px 8px",
                fontSize: 11.5,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color, flexShrink: 0 }} />
              {c.name}
            </button>
          );
        })}
      </div>

      <div className="row" style={{ gap: 8, marginTop: 11 }}>
        <button className="btn btn--accent" onClick={() => onSave(draft)} disabled={!draft.label.trim() || draft.categories.length === 0}>
          <Check size={14} />
          Save
        </button>
        <button className="btn-secondary" onClick={onCancel} style={{ flex: "0 0 auto", width: "auto" }}>
          <X size={13} />
        </button>
        {onDelete && (
          <button className="btn-link" onClick={onDelete} style={{ marginLeft: "auto", color: "var(--text-3)" }}>
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
