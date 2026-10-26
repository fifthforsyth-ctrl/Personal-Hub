import { useCallback, useMemo, useState } from "react";
import { Plus, ChevronLeft, Search, Maximize2, Layers } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchTree,
  createNode,
  updateNode,
  deleteNode,
  createEdge,
  moveNode,
  recordProgress,
  undoCheckin,
  recordNote,
  setFocused,
  repeatNode,
  fetchGoalCredit,
} from "../lib/api";
import { computeAllBrightness, computeMinuteBrightness, brightnessTier } from "../lib/heat";
import { todayStr, addDays } from "../lib/planDates";
import { computeWheel, firstParents, goalPaths, subtreeIds } from "../lib/wheel";
import { useLoad } from "../lib/useLoad";
import useIsMobile from "../lib/useIsMobile";
import { useToast, useConfirm } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import PyramidWheel from "../components/tree/PyramidWheel";
import SectionWheel from "../components/tree/SectionWheel";
import WedgeDetailPanel from "../components/tree/WedgeDetailPanel";
import NodeForm from "../components/tree/NodeForm";
import GoalPicker from "../components/GoalPicker";
import "../styles/goals.css";

// What "bright" means on the wheel. Last touched answers "is this still
// being tended", and it's where the wheel starts. The others light goals by
// the minutes linked to them, which is a different question — where the
// time went — and only a glance at it, never a target.
const BRIGHTNESS = [
  { key: "recency", label: "Last touched", days: 30, hint: "Deeper colour = checked in, logged or noted more recently" },
  { key: "today", label: "Today", days: 1, hint: "Deeper colour = more time linked to it today" },
  { key: "7", label: "7 days", days: 7, hint: "Deeper colour = more time linked to it in the last 7 days" },
  { key: "30", label: "30 days", days: 30, hint: "Deeper colour = more time linked to it in the last 30 days" },
];

// The goal panel's width plus its margins, which the wheel keeps clear of on
// wider screens.
const PANEL_ROOM = 384;

const NO_ROWS = [];
const NO_TREE = { nodes: NO_ROWS, edges: NO_ROWS };

// The meaning layer — Identity/Character down through Life Themes, Goals,
// Sub-goals, to daily actions at the leaves. Same ring-wheel visualization
// as Symposium's goal tree; this one is private to you alone, and every
// entry the rest of the app logs (time, wins/losses, prayers) can trace
// back to a goal here.
export default function Tree() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const isMobile = useIsMobile();

  const tree = useLoad(() => (user?.id ? fetchTree(user.id) : Promise.resolve(NO_TREE)), [user?.id]);
  const nodes = tree.data?.nodes ?? NO_ROWS;
  const edges = tree.data?.edges ?? NO_ROWS;

  const [form, setForm] = useState(null); // { node } to edit, { parentId } to add
  const [findOpen, setFindOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [centerNodeId, setCenterNodeId] = useState(null); // null = full wheel from the real root(s)
  const [mobileFullView, setMobileFullView] = useState(false);
  const [mobileCenterOverrideId, setMobileCenterOverrideId] = useState(null);
  const usingSectionWheel = isMobile && !mobileFullView;
  const [litKey, setLitKey] = useState("recency");

  const lit = BRIGHTNESS.find((m) => m.key === litKey) ?? BRIGHTNESS[0];
  const rangeEnd = todayStr();
  const rangeStart = addDays(rangeEnd, -(lit.days - 1));
  const byMinutes = lit.key !== "recency";

  // Rolled-up minutes for the window, only fetched while the wheel is lit by them.
  const credit = useLoad(() => (byMinutes ? fetchGoalCredit(rangeStart, rangeEnd) : Promise.resolve(NO_ROWS)), [byMinutes, rangeStart, rangeEnd]);
  const minutesById = useMemo(() => new Map((credit.data ?? NO_ROWS).map((r) => [r.node_id, Number(r.total_minutes) || 0])), [credit.data]);

  // The panel's "Active / Ticking along / Gone quiet" line is about tending,
  // not volume, so it keeps reading recency however the wheel is lit.
  const recencyById = useMemo(() => computeAllBrightness(nodes, edges), [nodes, edges]);
  const brightnessById = useMemo(
    () => (byMinutes ? computeMinuteBrightness(nodes, edges, minutesById) : recencyById),
    [byMinutes, recencyById, nodes, edges, minutesById]
  );
  const wheel = useMemo(() => computeWheel(nodes, edges, centerNodeId), [nodes, edges, centerNodeId]);
  const parentOf = useMemo(() => firstParents(edges), [edges]);
  const paths = useMemo(() => goalPaths(nodes, edges), [nodes, edges]);
  const pathById = useMemo(() => new Map(paths.map((p) => [p.id, p.path])), [paths]);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const childCountOf = useCallback((id) => edges.filter((e) => e.parent_id === id).length, [edges]);

  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) ?? null : null;

  // Every write goes through here: one toast if it fails, a quiet refresh if
  // it works. Resolves to whether it worked, so a control knows whether to
  // clear what was typed.
  async function write(fn, failure) {
    try {
      await fn();
    } catch (err) {
      toast.error(err, failure);
      return false;
    }
    await tree.reload();
    return true;
  }

  async function handleUndo(node) {
    if (await write(() => undoCheckin(node.id), "Couldn't undo that check-in.")) toast.show("Check-in undone");
  }

  async function handleLogProgress(node, amount) {
    const ok = await write(() => recordProgress(node.id, amount), node.tracking_method === "counter" ? "Couldn't log that." : "Couldn't check in.");
    if (ok) {
      toast.show(node.tracking_method === "counter" ? `Logged ${amount} on “${node.title}”` : `Checked in on “${node.title}”`, {
        actionLabel: "Undo",
        onAction: () => handleUndo(node),
      });
    }
    return ok;
  }

  async function handleAddNote(node, text) {
    const ok = await write(() => recordNote(user.id, node.id, text), "Couldn't add that note.");
    if (ok) toast.show("Note added");
    return ok;
  }

  async function handleRepeat(node) {
    if (await write(() => repeatNode(node.id, null), "Couldn't start the next cycle.")) toast.show(`Cycle ${(node.cycle_count || 0) + 2} started`);
  }

  async function handleToggleFocus(node) {
    const next = !node.is_focused;
    tree.mutate((d) => d && { ...d, nodes: d.nodes.map((n) => (n.id === node.id ? { ...n, is_focused: next } : n)) });
    if (!(await write(() => setFocused(node.id, next), "Couldn't change Focus."))) tree.reload();
  }

  function handleRecenter(node) {
    setSelectedNodeId(null);
    if (usingSectionWheel) setMobileCenterOverrideId(node.id);
    else setCenterNodeId(node.id);
  }

  // Find a goal: open its panel, and make sure the wheel is showing the part
  // of the tree it's in.
  function handleFound(id) {
    setFindOpen(false);
    if (!id) return;
    const center = usingSectionWheel ? mobileCenterOverrideId : centerNodeId;
    if (center && !subtreeIds(edges, center).has(id)) {
      setCenterNodeId(null);
      setMobileCenterOverrideId(null);
    }
    setSelectedNodeId(id);
  }

  async function handleFormSave(payload, parentId) {
    const editing = form?.node ?? null;
    try {
      if (editing) {
        await updateNode(editing.id, payload);
        await moveNode(editing.id, parentOf.get(editing.id) ?? null, parentId);
      } else {
        const created = await createNode(user.id, payload);
        setSelectedNodeId(created.id);
        if (parentId) {
          try {
            await createEdge(created.id, parentId, null);
          } catch (err) {
            // The goal exists now, so saving again from this form would
            // make a second one. Close it and say how to finish the move.
            setForm(null);
            toast.error(err, `Added “${payload.title}” at the top level. Edit it to move it under its goal.`);
            await tree.reload();
            return;
          }
        }
      }
    } catch (err) {
      toast.error(err, "Couldn't save that goal.");
      return;
    }
    setForm(null);
    toast.show(editing ? "Goal saved" : `Added “${payload.title}”`);
    await tree.reload();
  }

  // Deleting can't be undone, so it asks first and says exactly what
  // happens to what's under the goal and what's linked to it. `onConfirmed`
  // lets the form say "Deleting…" only once you've said yes.
  async function handleDelete(node, onConfirmed) {
    const kids = childCountOf(node.id);
    const parentTitle = nodeById.get(parentOf.get(node.id))?.title ?? null;
    const subGoals = `${kids} sub-goal${kids === 1 ? "" : "s"}`;
    let body;
    if (parentTitle) {
      body = kids > 0 ? `Its ${subGoals} and anything linked to it move up to “${parentTitle}”.` : `Anything linked to it moves up to “${parentTitle}”.`;
    } else {
      body = kids > 0 ? `Its ${subGoals} become top-level goals, and time linked to it is unlinked.` : "Time linked to it is unlinked.";
    }
    body += " Its own check-ins and notes are deleted.";
    if (!(await confirm({ title: `Delete “${node.title}”?`, body, confirmLabel: "Delete goal" }))) return;

    onConfirmed?.();
    try {
      await deleteNode(node.id);
    } catch (err) {
      toast.error(err, "Couldn't delete that goal.");
      return;
    }
    if (centerNodeId === node.id) setCenterNodeId(null);
    if (mobileCenterOverrideId === node.id) setMobileCenterOverrideId(null);
    setSelectedNodeId(null);
    setForm(null);
    toast.show(`Deleted “${node.title}”`);
    await tree.reload();
    if (byMinutes) credit.reload();
  }

  const centeredId = usingSectionWheel ? mobileCenterOverrideId : centerNodeId;
  const centeredNode = centeredId ? nodeById.get(centeredId) ?? null : null;
  const hasGoals = nodes.length > 0;

  const formNode = form?.node ?? null;
  const formParentId = formNode ? parentOf.get(formNode.id) ?? null : form?.parentId ?? null;
  const parentChoices = useMemo(() => {
    if (!formNode) return paths;
    const blocked = subtreeIds(edges, formNode.id);
    return paths.filter((p) => !blocked.has(p.id));
  }, [paths, edges, formNode]);

  return (
    <div className="goals-page">
      {/* The bar sits on the page, so its buttons take the white face, like the
          Brightness pill beside them. */}
      <header className="goals-bar">
        <div className="goals-bar__title">
          {centeredNode ? (
            <>
              <button
                type="button"
                className="btn btn--sm btn--on-page"
                onClick={() => (usingSectionWheel ? setMobileCenterOverrideId(null) : setCenterNodeId(null))}
                title="Back to the whole wheel"
              >
                <ChevronLeft size={15} />
                All goals
              </button>
              <h1 className="goals-bar__h truncate">{centeredNode.title}</h1>
            </>
          ) : (
            <h1 className="goals-bar__h">Goal wheel</h1>
          )}
        </div>

        <div className="goals-bar__actions">
          {hasGoals && (
            <button type="button" className="btn btn--sm btn--on-page" onClick={() => setFindOpen(true)} aria-label="Find a goal" title="Find a goal">
              <Search size={15} />
              <span className="goals-wide-only">Find a goal</span>
            </button>
          )}
          <button type="button" className="btn btn--sm btn--accent" onClick={() => setForm({ parentId: null })}>
            <Plus size={15} />
            New goal
          </button>
        </div>

        {hasGoals && (
          <div className="goals-bar__view">
            <label className="goals-bright">
              <span>Brightness</span>
              <select className="input" value={litKey} onChange={(e) => setLitKey(e.target.value)}>
                {BRIGHTNESS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            {isMobile && (
              <button
                type="button"
                className="btn btn--sm btn--on-page"
                onClick={() => {
                  setMobileFullView((v) => !v);
                  setMobileCenterOverrideId(null);
                  setCenterNodeId(null);
                }}
              >
                {mobileFullView ? <Layers size={15} /> : <Maximize2 size={15} />}
                {mobileFullView ? "Sections" : "Full wheel"}
              </button>
            )}
          </div>
        )}
      </header>

      {tree.error && <LoadError what="your goals" error={tree.error} onRetry={tree.reload} stale={hasGoals} className="goals-error" />}
      {byMinutes && credit.error && <LoadError what="the minutes" error={credit.error} onRetry={credit.reload} className="goals-error" />}

      <div className="goals-canvas">
        {tree.loading && <p className="empty goals-canvas__note">Loading your goals…</p>}

        {!tree.loading && !tree.error && !hasGoals && (
          <div className="goals-canvas__empty">
            <p className="empty">No goals yet. Start with who you're trying to become, then break it down toward what that looks like today.</p>
            <button type="button" className="btn btn--accent" onClick={() => setForm({ parentId: null })}>
              <Plus size={15} />
              Add your first goal
            </button>
          </div>
        )}

        {hasGoals && usingSectionWheel && (
          <SectionWheel
            nodes={nodes}
            edges={edges}
            brightnessById={brightnessById}
            onSelectNode={setSelectedNodeId}
            centerOverrideId={mobileCenterOverrideId}
            selectedId={selectedNodeId}
          />
        )}

        {hasGoals && !usingSectionWheel && (
          <PyramidWheel
            nodes={nodes}
            edges={edges}
            wheel={wheel}
            brightnessById={brightnessById}
            centerNodeId={centerNodeId}
            onSelectNode={setSelectedNodeId}
            selectedId={selectedNodeId}
            reserveRight={selectedNode ? PANEL_ROOM : 0}
            controls
          />
        )}

        {selectedNode && (
          <WedgeDetailPanel
            node={selectedNode}
            tier={brightnessTier(recencyById.get(selectedNode.id) ?? 0)}
            ringIndex={wheel.layout.get(selectedNode.id)?.ringIndex ?? 1}
            hasChildren={childCountOf(selectedNode.id) > 0}
            childCount={childCountOf(selectedNode.id)}
            parentPath={parentOf.has(selectedNode.id) ? pathById.get(parentOf.get(selectedNode.id)) ?? null : null}
            onClose={() => setSelectedNodeId(null)}
            onLogProgress={handleLogProgress}
            onUndo={handleUndo}
            onAddNote={handleAddNote}
            onToggleFocus={handleToggleFocus}
            onEdit={(node) => setForm({ node })}
            onAddChild={(node) => setForm({ parentId: node.id })}
            onRepeat={handleRepeat}
            onRecenter={handleRecenter}
            ledgerStart={rangeStart}
            ledgerEnd={rangeEnd}
            windowLabel={lit.key === "today" ? "today" : `last ${lit.days} days`}
          />
        )}
      </div>

      {hasGoals && (
        <footer className="goals-legend">
          <span className="goals-legend__item">
            <span className="goals-legend__focus" aria-hidden="true" />
            Orange outline = focus goal
          </span>
          <span className="goals-legend__item">{lit.hint}</span>
        </footer>
      )}

      {findOpen && (
        <GoalPicker goals={paths} value={selectedNodeId} allowNone={false} placeholder="Find a goal…" onPick={handleFound} onClose={() => setFindOpen(false)} />
      )}

      {form && (
        <NodeForm
          node={formNode}
          parentId={formParentId}
          goals={parentChoices}
          pathById={pathById}
          onSave={handleFormSave}
          onDelete={handleDelete}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}
