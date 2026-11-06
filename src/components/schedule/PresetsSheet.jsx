import { useState } from "react";
import { Trash2, Bookmark, Eraser } from "lucide-react";
import Sheet from "../ascent/Sheet";
import LoadError from "../ui/LoadError";
import { MiniStrip } from "./Mini";
import { colorOf, spanOf, fmtHours } from "../../lib/schedule";
import { fmtTimeRange } from "../../lib/planDates";

const DAY_RANGE = { start: 4 * 60, end: 23 * 60 };

// Presets for one day: put a saved day or a saved block on it, save the day
// as it stands for next time, or clear it and start over.
export default function PresetsSheet({ presets, hiddenIds, busyId, canSaveDay, onApply, onSaveDay, onDelete, onClear, onClose }) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const list = (presets.data ?? []).filter((t) => !hiddenIds.has(t.id));
  const days = list.filter((t) => t.kind === "day");
  const blocks = list.filter((t) => t.kind === "chunk");

  async function save(e) {
    e?.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    const ok = await onSaveDay(name.trim());
    setSaving(false);
    if (ok) {
      setNaming(false);
      setName("");
    }
  }

  return (
    <Sheet title="Presets" onClose={onClose}>
      <div className="psheet">
        {presets.error && !presets.data && <LoadError what="presets" error={presets.error} onRetry={presets.reload} />}
        {presets.data && list.length === 0 && <p className="psheet__empty">No presets yet. Lay out a day you'd repeat, then save it here.</p>}

        {days.length > 0 && (
          <section>
            <h3 className="psheet__label">Whole days</h3>
            <ul className="psheet__list">
              {days.map((t) => {
                const chunks = t.template_chunks ?? [];
                return (
                  <li key={t.id} className="psheet__row">
                    <div className="psheet__main">
                      <div className="psheet__name">{t.name}</div>
                      <MiniStrip chunks={chunks} range={DAY_RANGE} ticks={false} />
                      <div className="psheet__meta">{chunks.length === 1 ? "1 block" : `${chunks.length} blocks`}</div>
                    </div>
                    <button type="button" className="btn btn--sm btn--accent" disabled={busyId != null} onClick={() => onApply(t)}>
                      {busyId === t.id ? "Applying…" : "Apply"}
                    </button>
                    <button type="button" className="btn-icon psheet__del" aria-label={`Delete the ${t.name} preset`} title="Delete preset" onClick={() => onDelete(t)}>
                      <Trash2 size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {blocks.length > 0 && (
          <section>
            <h3 className="psheet__label">Single blocks</h3>
            <ul className="psheet__list">
              {blocks.map((t) => {
                const c = (t.template_chunks ?? [])[0];
                const s = c ? spanOf(c) : null;
                return (
                  <li key={t.id} className="psheet__row">
                    <span className="psheet__dot" style={{ background: colorOf(c?.color).hex }} aria-hidden="true" />
                    <div className="psheet__main">
                      <div className="psheet__name">{t.name}</div>
                      {c && (
                        <div className="psheet__meta">
                          {fmtTimeRange(c.start_time, c.end_time)} · {fmtHours(s.end - s.start)}
                        </div>
                      )}
                    </div>
                    <button type="button" className="btn btn--sm" disabled={busyId != null} onClick={() => onApply(t)}>
                      {busyId === t.id ? "Adding…" : "Add"}
                    </button>
                    <button type="button" className="btn-icon psheet__del" aria-label={`Delete the ${t.name} preset`} title="Delete preset" onClick={() => onDelete(t)}>
                      <Trash2 size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="psheet__foot">
          {naming ? (
            <form className="bsheet__preset-form" onSubmit={save}>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name it (e.g. Workday)"
                aria-label="Preset name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setNaming(false);
                  }
                }}
              />
              <button type="submit" className="btn btn--sm btn--accent" disabled={saving || !name.trim()}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setNaming(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <>
              <button type="button" className="btn btn--sm btn--on-page" disabled={!canSaveDay} onClick={() => setNaming(true)} title={canSaveDay ? undefined : "Add a block first"}>
                <Bookmark size={13} />
                Save this day as a preset
              </button>
              {canSaveDay && (
                <button type="button" className="btn-link btn-link--danger psheet__clear" onClick={onClear}>
                  <Eraser size={13} />
                  Clear this day
                </button>
              )}
            </>
          )}
          <p className="psheet__hint">To save a single block, open it and choose More, then Save this block as a preset.</p>
        </div>
      </div>
    </Sheet>
  );
}
