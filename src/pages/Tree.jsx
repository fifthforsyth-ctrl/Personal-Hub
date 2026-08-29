import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, GitBranch, ChevronLeft, Maximize2, Layers, Link2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  fetchTree,
  createNode,
  updateNode,
  deleteNode,
  createEdge,
  recordProgress,
  recordNote,
  setFocused,
  repeatNode,
} from "../lib/api";
import { computeAllBrightness, brightnessTier } from "../lib/heat";
import { computeWheel } from "../lib/wheel";
import useIsMobile from "../lib/useIsMobile";
import PyramidWheel from "../components/tree/PyramidWheel";
import SectionWheel from "../components/tree/SectionWheel";
import WedgeDetailPanel from "../components/tree/WedgeDetailPanel";
import NodeForm from "../components/tree/NodeForm";

// The meaning layer — Identity/Character down through Life Themes, Goals,
// Sub-goals, to daily actions at the leaves. Same ring-wheel visualization
// as Symposium's goal tree; this one is private to you alone, and every
// entry the rest of the app logs (time, wins/losses, prayers) can trace
// back to a node here.
export default function Tree() {
  const { user, refreshProfile } = useAuth();

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [presetParent, setPresetParent] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [centerNodeId, setCenterNodeId] = useState(null); // null = full wheel from the real root(s)
  const isMobile = useIsMobile();
  const [mobileFullView, setMobileFullView] = useState(false);
  const [mobileCenterOverrideId, setMobileCenterOverrideId] = useState(null);
  const usingSectionWheel = isMobile && !mobileFullView;

  const reload = useCallback(async () => {
    if (!user?.id) return;
    const { nodes: n, edges: e } = await fetchTree(user.id);
    setNodes(n);
    setEdges(e);
    setLoading(false);
    refreshProfile?.();
  }, [user?.id, refreshProfile]);

  useEffect(() => {
    reload();
  }, [reload]);

  const brightnessById = useMemo(() => computeAllBrightness(nodes, edges), [nodes, edges]);
  const wheel = useMemo(() => computeWheel(nodes, edges, centerNodeId), [nodes, edges, centerNodeId]);

  const childrenByParent = useMemo(() => {
    const map = new Map();
    for (const e of edges) {
      if (!map.has(e.parent_id)) map.set(e.parent_id, []);
      map.get(e.parent_id).push(e.child_id);
    }
    return map;
  }, [edges]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  async function withReload(fn) {
    try {
      await fn();
      await reload();
    } catch (err) {
      alert(err.message);
    }
  }

  const handleLogProgress = (node, amount) => withReload(() => recordProgress(node.id, amount));
  const handleAddNote = (node, text) => withReload(() => recordNote(user.id, node.id, text));
  const handleRepeat = (node) => withReload(() => repeatNode(node.id, null));
  const handleToggleFocus = (node) => withReload(() => setFocused(node.id, !node.is_focused));

  function handleEdit(node) {
    setPresetParent(null);
    setEditingNode(node);
    setFormOpen(true);
  }

  function handleAddChild(node) {
    setEditingNode(null);
    setPresetParent(node);
    setFormOpen(true);
  }

  function handleRecenter(node) {
    setSelectedNodeId(null);
    if (usingSectionWheel) {
      setMobileCenterOverrideId(node.id);
    } else {
      setCenterNodeId(node.id);
    }
  }

  async function handleFormSave(payload) {
    try {
      if (editingNode) {
        await updateNode(editingNode.id, payload);
      } else {
        const newNode = await createNode(user.id, payload);
        if (presetParent) {
          await createEdge(newNode.id, presetParent.id, null);
        }
      }
      setFormOpen(false);
      setEditingNode(null);
      setPresetParent(null);
      await reload();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(node) {
    try {
      await deleteNode(node.id);
    } catch (err) {
      alert(err.message);
      return;
    }
    if (centerNodeId === node.id) setCenterNodeId(null);
    if (mobileCenterOverrideId === node.id) setMobileCenterOverrideId(null);
    setSelectedNodeId(null);
    setFormOpen(false);
    setEditingNode(null);
    await reload();
  }

  const centerNode = centerNodeId ? nodes.find((n) => n.id === centerNodeId) : null;

  return (
    <div className="tree-canvas-wrap">
      <div className="tree-header-chip">
        <GitBranch size={16} />
        <span style={{ fontWeight: 700, fontSize: 14 }}>{centerNode ? centerNode.title : "Goal Tree"}</span>
        <Link to="/links" title="What feeds what" style={{ display: "flex", alignItems: "center", color: "var(--text-muted)", marginLeft: 2 }}>
          <Link2 size={13} />
        </Link>
        {centerNode && (
          <button
            onClick={() => setCenterNodeId(null)}
            title="Back to full wheel"
            style={{ background: "none", border: "none", color: "var(--accent-strong)", display: "flex", alignItems: "center", gap: 2, marginLeft: 4 }}
          >
            <ChevronLeft size={14} />
            All goals
          </button>
        )}
      </div>

      {isMobile && nodes.length > 0 && (
        <button
          onClick={() => {
            setMobileFullView((v) => !v);
            setMobileCenterOverrideId(null);
          }}
          title={mobileFullView ? "Back to sections" : "Reveal the entire wheel"}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "7px 10px",
            fontSize: 11.5,
            fontWeight: 700,
            color: "var(--text)",
          }}
        >
          {mobileFullView ? <Layers size={14} /> : <Maximize2 size={14} />}
          {mobileFullView ? "Sections" : "Full wheel"}
        </button>
      )}

      {!loading && nodes.length === 0 && (
        <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", zIndex: 10, padding: "0 24px" }}>
          <p className="placeholder-note">
            No goals yet. Start with who you're trying to become, then break it down toward what that looks like today.
          </p>
        </div>
      )}

      {nodes.length > 0 && usingSectionWheel && (
        <SectionWheel
          nodes={nodes}
          edges={edges}
          brightnessById={brightnessById}
          onSelectNode={setSelectedNodeId}
          centerOverrideId={mobileCenterOverrideId}
          onExitOverride={() => setMobileCenterOverrideId(null)}
        />
      )}

      {nodes.length > 0 && !usingSectionWheel && (
        <PyramidWheel nodes={nodes} edges={edges} wheel={wheel} brightnessById={brightnessById} centerNodeId={centerNodeId} onSelectNode={setSelectedNodeId} />
      )}

      {selectedNode && (
        <WedgeDetailPanel
          node={selectedNode}
          tier={brightnessTier(brightnessById.get(selectedNode.id) ?? 0)}
          ringIndex={wheel.layout.get(selectedNode.id)?.ringIndex ?? 0}
          hasChildren={(childrenByParent.get(selectedNode.id) ?? []).length > 0}
          childCount={(childrenByParent.get(selectedNode.id) ?? []).length}
          onClose={() => setSelectedNodeId(null)}
          onLogProgress={handleLogProgress}
          onAddNote={handleAddNote}
          onToggleFocus={handleToggleFocus}
          onEdit={handleEdit}
          onAddChild={handleAddChild}
          onRepeat={handleRepeat}
          onRecenter={handleRecenter}
        />
      )}

      <button
        className="fab"
        onClick={() => {
          setEditingNode(null);
          setPresetParent(null);
          setFormOpen(true);
        }}
        title="Add a goal"
      >
        <Plus size={22} />
      </button>

      {formOpen && (
        <NodeForm
          node={editingNode}
          presetParent={presetParent}
          onSave={handleFormSave}
          onDelete={handleDelete}
          onClose={() => {
            setFormOpen(false);
            setEditingNode(null);
            setPresetParent(null);
          }}
        />
      )}
    </div>
  );
}
