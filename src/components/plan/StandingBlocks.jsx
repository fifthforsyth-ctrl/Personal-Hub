import { useCallback, useEffect, useState } from "react";
import { Repeat, Plus, Trash2, Check, X } from "lucide-react";
import { fetchStandingBlocks, addStandingBlock, removeStandingBlock } from "../../lib/api";
import { colorFor } from "../../lib/categories";
import { fmtTime } from "../../lib/planDates";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Blocks that happen at the same time every week — a temple shift every
// Saturday afternoon. Written once here, they're laid onto each matching day
// as a commitment, so the planner works around them like anything else
// already on the calendar. Moving or deleting one week's copy leaves the
// rest alone.
export default function StandingBlocks({ userId, categories, onChanged }) {
  const [blocks, setBlocks] = useState([]);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setBlocks(await fetchStandingBlocks().catch(() => []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    try {
      await addStandingBlock(userId, draft);
      setDraft(null);
      setError(null);
      await load();
      await onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    try {
      await removeStandingBlock(id);
      await load();
      await onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="section-label" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <Repeat size={12} />
        Every week
      </div>

      {blocks.map((b) => (
        <div key={b.id} className="row" style={{ gap: 7, alignItems: "center", padding: "3px 0" }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: b.category ? colorFor(b.category) : "var(--line)", flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, fontWeight: 570 }}>{b.title}</span>
          <span className="mono faint" style={{ fontSize: 10.5 }}>
            {DAYS[b.weekday]}s · {fmtTime(b.start_time)}–{fmtTime(b.end_time)}
          </span>
          <button
            className="btn-link"
            style={{ marginLeft: "auto", color: "var(--text-3)" }}
            onClick={() => remove(b.id)}
            title="Stop — removes the upcoming ones, keeps the past"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}

      {draft ? (
        <div style={{ border: "1px solid var(--accent-line)", borderRadius: "var(--r)", padding: 11, marginTop: 6 }}>
          <input
            className="input"
            value={draft.title}
            placeholder="What happens every week"
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            style={{ width: "100%", fontWeight: 570 }}
            autoFocus
          />
          <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select className="input" value={draft.weekday} onChange={(e) => setDraft({ ...draft, weekday: e.target.value })} style={{ width: "auto" }}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>{d}s</option>
              ))}
            </select>
            <input className="input" type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} style={{ width: "auto" }} />
            <span className="faint" style={{ fontSize: 12 }}>to</span>
            <input className="input" type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} style={{ width: "auto" }} />
            <select className="input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} style={{ width: "auto" }}>
              <option value="">No category</option>
              {(categories ?? []).map((c) => (
                <option key={c.id ?? c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 11 }}>
            <button className="btn btn--accent" onClick={save} disabled={!draft.title.trim() || !draft.start || !draft.end}>
              <Check size={14} />
              Save
            </button>
            <button className="btn-secondary" onClick={() => setDraft(null)} style={{ flex: "0 0 auto", width: "auto" }}>
              <X size={13} />
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn-link"
          style={{ marginTop: 6, fontSize: 11.5 }}
          onClick={() => setDraft({ title: "", weekday: 6, start: "09:00", end: "10:00", category: "" })}
        >
          <Plus size={11} />
          Standing block
        </button>
      )}

      {error && <div className="form-error" style={{ marginTop: 8 }}>{error}</div>}
    </>
  );
}
