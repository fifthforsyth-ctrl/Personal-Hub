import { useState } from "react";
import { Repeat, Plus } from "lucide-react";
import { fetchStandingBlocks, addStandingBlock, removeStandingBlock } from "../../lib/api";
import { colorFor } from "../../lib/categories";
import { fmtTimeRange } from "../../lib/planDates";
import { useLoad } from "../../lib/useLoad";
import { useToast, useConfirm } from "../ui/Feedback";
import LoadError from "../ui/LoadError";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Blocks that happen at the same time every week — a temple shift every
// Saturday afternoon. Written once here, they're laid onto each matching day
// as a commitment, so the planner works around them like anything else
// already on the calendar. Moving or deleting one week's copy leaves the
// rest alone.
export default function StandingBlocks({ userId, categories, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: blocks, error, reload } = useLoad(() => fetchStandingBlocks(), []);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [stopping, setStopping] = useState(null);

  async function save() {
    if (saving) return;
    if (draft.start === draft.end) return toast.show("It can't start and end at the same time.");
    setSaving(true);
    try {
      await addStandingBlock(userId, draft);
      setDraft(null);
      await reload();
      await onChanged?.();
    } catch (err) {
      toast.error(err, "Couldn't add the standing block.");
    } finally {
      setSaving(false);
    }
  }

  // Stopping takes every upcoming copy off the calendar at once, so it asks.
  async function stop(b) {
    if (stopping) return;
    const yes = await confirm({
      title: `Stop “${b.title}” on ${DAYS[b.weekday]}s?`,
      body: "Its upcoming copies come off the calendar. Past ones stay as they were.",
      confirmLabel: "Stop it",
    });
    if (!yes) return;
    setStopping(b.id);
    try {
      await removeStandingBlock(b.id);
      await reload();
      await onChanged?.();
      toast.show(`Stopped “${b.title}”`);
    } catch (err) {
      toast.error(err, "Couldn't stop that standing block.");
    } finally {
      setStopping(null);
    }
  }

  return (
    <>
      <div className="section-label" style={{ marginBottom: 8 }}>
        <Repeat size={12} />
        Every week
      </div>

      {error && !blocks && <LoadError what="your standing blocks" error={error} onRetry={reload} />}

      {(blocks ?? []).map((b) => (
        <div key={b.id} className="standing-row">
          <span style={{ width: 9, height: 9, borderRadius: 3, background: b.category ? colorFor(b.category) : "var(--line-strong)", flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 570 }}>{b.title}</span>{" "}
            <span className="mono faint" style={{ fontSize: 10.5, whiteSpace: "nowrap" }}>
              {DAYS[b.weekday]}s · {fmtTimeRange(b.start_time, b.end_time)}
            </span>
          </span>
          <button
            className="btn btn--sm btn--ghost"
            onClick={() => stop(b)}
            disabled={stopping === b.id}
            title="Stop — takes off the upcoming ones, keeps the past"
          >
            {stopping === b.id ? "Stopping…" : "Stop"}
          </button>
        </div>
      ))}

      {draft ? (
        <div className="plan-inline-form">
          <input
            className="input"
            value={draft.title}
            placeholder="What happens every week"
            aria-label="What happens every week"
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            style={{ width: "100%", fontWeight: 570 }}
            autoFocus
          />
          <div className="standing-form__row">
            <select className="input" value={draft.weekday} aria-label="Day" onChange={(e) => setDraft({ ...draft, weekday: e.target.value })}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>{d}s</option>
              ))}
            </select>
            <select className="input" value={draft.category} aria-label="Category" onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              <option value="">No category</option>
              {(categories ?? []).map((c) => (
                <option key={c.id ?? c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="standing-form__row">
            <label className="standing-form__time">
              <span className="faint">From</span>
              <input className="input time-input" type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
            </label>
            <label className="standing-form__time">
              <span className="faint">to</span>
              <input className="input time-input" type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
            </label>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn btn--accent" onClick={save} disabled={saving || !draft.title.trim() || !draft.start || !draft.end}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="btn" onClick={() => setDraft(null)} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn-link"
          style={{ marginTop: 6, minHeight: 36 }}
          onClick={() => setDraft({ title: "", weekday: 6, start: "09:00", end: "10:00", category: "" })}
        >
          <Plus size={12} />
          Add a standing block
        </button>
      )}
    </>
  );
}
