import { useEffect, useState } from "react";
import { X, CheckSquare, Hash, NotebookPen, Star, Pencil, Plus, RotateCcw, Crosshair } from "lucide-react";
import { getNodeVisual, TRACKING_LABEL, FOCUS_COLOR } from "../../lib/nodeStyle";
import { timeAgo } from "../../lib/dates";
import CompletionControl from "./CompletionControl";
import GoalLedger from "./GoalLedger";

const METHOD_ICON = { checkbox: CheckSquare, counter: Hash, note: NotebookPen };
const TIER_LABEL = { bright: "Active", medium: "Ticking along", dull: "Gone quiet" };

// "Dec 31", or "Dec 31, 2027" when it isn't this year.
function fmtTargetDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const opts = { month: "short", day: "numeric", ...(y !== new Date().getFullYear() && { year: "numeric" }) };
  return date.toLocaleDateString(undefined, opts);
}

// The wheel is purely the map — this panel is where you actually act on a
// goal: check it off, log a count, add a note, focus it, break it down,
// edit it, or turn the whole wheel to make it the new center. The check-in
// comes first and is the one ink button; everything else is quieter.
export default function WedgeDetailPanel({
  node,
  tier,
  ringIndex,
  hasChildren,
  childCount,
  parentPath,
  onClose,
  onLogProgress,
  onUndo,
  onAddNote,
  onToggleFocus,
  onEdit,
  onAddChild,
  onRepeat,
  onRecenter,
  ledgerStart,
  ledgerEnd,
  windowLabel,
}) {
  const Icon = METHOD_ICON[node.tracking_method] ?? NotebookPen;
  const visual = getNodeVisual(ringIndex, tier);
  const [busy, setBusy] = useState(null);

  // Escape closes the panel, unless it's closing something on top of it.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape" || document.querySelector(".modal-backdrop, .sheet-backdrop")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(what, fn) {
    if (busy) return;
    setBusy(what);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  const facts = [];
  if (node.is_repeatable) facts.push(`Cycle ${(node.cycle_count || 0) + 1}`);
  if (node.has_deadline && node.deadline_date) facts.push(`Target date ${fmtTargetDate(node.deadline_date)}`);
  if (hasChildren) facts.push(`${childCount} ${childCount === 1 ? "sub-goal" : "sub-goals"}`);

  return (
    <aside className="goal-panel" aria-label={node.title}>
      <div className="goal-panel__head">
        <span className="goal-panel__icon" style={{ background: visual.background, borderColor: node.is_focused ? FOCUS_COLOR : visual.border }}>
          <Icon size={16} color={visual.text} />
        </span>
        <div className="goal-panel__names">
          <div className="goal-panel__eyebrow">
            {TRACKING_LABEL[node.tracking_method] ?? "Goal"}
            {node.is_daily ? " · daily" : ""}
            {node.is_focused ? " · in Focus" : ""}
          </div>
          <h2 className="goal-panel__title">{node.title}</h2>
          {parentPath && <div className="goal-panel__path">Under {parentPath}</div>}
        </div>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Close" title="Close">
          <X size={18} />
        </button>
      </div>

      {node.description && <p className="goal-panel__desc">{node.description}</p>}

      <div className="goal-panel__status">
        <span className="dot" style={{ background: tier === "dull" ? "var(--line-strong)" : visual.hue }} />
        {TIER_LABEL[tier] ?? "Gone quiet"} · {node.last_activity_at ? `last touched ${timeAgo(node.last_activity_at)}` : "not touched yet"}
      </div>
      {facts.length > 0 && <div className="goal-panel__facts">{facts.join(" · ")}</div>}

      <div className="goal-panel__check">
        <CompletionControl node={node} onLogProgress={onLogProgress} onUndo={onUndo} onAddNote={onAddNote} />
      </div>

      <div className="goal-panel__actions">
        <button type="button" className="btn btn--sm" disabled={busy === "focus"} onClick={() => run("focus", () => onToggleFocus(node))}>
          <Star size={14} fill={node.is_focused ? FOCUS_COLOR : "none"} color={node.is_focused ? FOCUS_COLOR : "currentColor"} />
          {node.is_focused ? "Remove from Focus" : "Add to Focus"}
        </button>
        {node.is_repeatable && node.is_completed && !node.is_daily && (
          <button type="button" className="btn btn--sm" disabled={busy === "repeat"} onClick={() => run("repeat", () => onRepeat(node))}>
            <RotateCcw size={14} />
            {busy === "repeat" ? "Starting…" : "Start the next cycle"}
          </button>
        )}
        <button type="button" className="btn btn--sm" onClick={() => onAddChild(node)}>
          <Plus size={14} />
          Add a sub-goal
        </button>
        {hasChildren && (
          <button type="button" className="btn btn--sm" onClick={() => onRecenter(node)}>
            <Crosshair size={14} />
            Center the wheel here
          </button>
        )}
        <button type="button" className="btn btn--sm" onClick={() => onEdit(node)}>
          <Pencil size={14} />
          Edit
        </button>
      </div>

      {ledgerStart && <GoalLedger key={node.id} nodeId={node.id} start={ledgerStart} end={ledgerEnd} windowLabel={windowLabel} />}
    </aside>
  );
}
