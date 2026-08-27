import { X, CheckSquare, Hash, NotebookPen, Star, Pencil, Plus, RotateCcw, ZoomIn } from "lucide-react";
import { getNodeVisual, TRACKING_LABEL, FOCUS_COLOR } from "../../lib/nodeStyle";
import CompletionControl from "./CompletionControl";

const METHOD_ICON = { checkbox: CheckSquare, counter: Hash, note: NotebookPen };
const TIER_LABEL = { bright: "Active", medium: "Ticking along", dull: "Gone quiet" };

// The wheel is purely the map — this panel is where you actually act on a
// goal: check it off, log a count, add a note, focus it, break it down,
// edit it, or zoom the whole wheel in to make it the new center.
export default function WedgeDetailPanel({
  node,
  tier,
  ringIndex,
  hasChildren,
  childCount,
  onClose,
  onLogProgress,
  onAddNote,
  onToggleFocus,
  onEdit,
  onAddChild,
  onRepeat,
  onRecenter,
}) {
  const Icon = METHOD_ICON[node.tracking_method] ?? NotebookPen;
  const visual = getNodeVisual(ringIndex, tier);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: 340,
        maxWidth: "92vw",
        background: "var(--bg-card)",
        borderLeft: "1px solid var(--border-strong)",
        boxShadow: "-8px 0 30px rgba(0,0,0,0.4)",
        zIndex: 30,
        overflowY: "auto",
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: visual.background,
            border: node.is_focused ? `1.5px solid ${FOCUS_COLOR}` : `1.5px solid ${visual.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={16} color={visual.hue} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {TRACKING_LABEL[node.tracking_method] ?? "Goal"}
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2, lineHeight: 1.3, fontFamily: "var(--font-display)" }}>{node.title}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", flexShrink: 0 }}>
          <X size={18} />
        </button>
      </div>

      {node.description && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12, lineHeight: 1.5 }}>{node.description}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 12, fontFamily: "var(--font-mono)" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: visual.hue, opacity: tier === "dull" ? 0.3 : 1 }} />
        <span style={{ color: "var(--text-muted)" }}>{TIER_LABEL[tier]}</span>
      </div>

      {node.has_target_number && node.tracking_method === "counter" && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, marginTop: 6 }}>
          {node.current_number ?? 0} / {node.target_number}
          {node.is_daily ? " today" : ""}
        </div>
      )}

      {node.is_repeatable && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.6, marginTop: 4 }}>Cycle {(node.cycle_count || 0) + 1}</div>
      )}

      {node.has_deadline && node.deadline_date && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.6, marginTop: 4 }}>Target date {node.deadline_date}</div>
      )}

      {hasChildren && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
          {childCount} {childCount === 1 ? "sub-goal" : "sub-goals"}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <CompletionControl node={node} onLogProgress={onLogProgress} onAddNote={onAddNote} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        <button onClick={() => onToggleFocus(node)} style={actionBtnStyle}>
          <Star size={14} fill={node.is_focused ? FOCUS_COLOR : "none"} color={node.is_focused ? FOCUS_COLOR : "currentColor"} />
          {node.is_focused ? "Remove from Focus" : "Add to Focus"}
        </button>

        {node.is_repeatable && node.is_completed && !node.is_daily && (
          <button onClick={() => onRepeat(node)} style={actionBtnStyle}>
            <RotateCcw size={14} />
            Repeat this cycle
          </button>
        )}

        <button onClick={() => onAddChild(node)} style={actionBtnStyle}>
          <Plus size={14} />
          Break this down further
        </button>

        {hasChildren && (
          <button onClick={() => onRecenter(node)} style={actionBtnStyle}>
            <ZoomIn size={14} />
            Center the wheel here
          </button>
        )}

        <button onClick={() => onEdit(node)} style={actionBtnStyle}>
          <Pencil size={14} />
          Edit
        </button>
      </div>
    </div>
  );
}

const actionBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "9px 12px",
  color: "inherit",
  fontSize: 13,
  fontWeight: 600,
  textAlign: "left",
};
