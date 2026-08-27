import { isDailyDoneToday } from "./dates";

// ---------------------------------------------------------------------------
// Heat model
//
// A lot of goals here never "complete" — there's no finish line for "become
// more patient." What actually matters is whether a goal is still a live,
// currently-tended part of the practice, or has gone dormant.
//
// Every node — whether it has children or not — can be contributed to
// directly (checkbox tap, counter log, note added), so every node resolves
// its OWN recency tier the same way:
//
//   bright  — a daily node done today, or anything touched in the last 7 days
//   medium  — touched sometime in the last 30 days, not tight enough for bright
//   dull    — 30+ days untouched, or never touched
//
// A node's final brightness blends that own-tier intensity with whatever's
// happening in its subtree: a leaf's contribution decays by half per hop up
// (direct child of a bright leaf ~50%, grandchild ~25%, ...), and multiple
// active descendants combine with diminishing returns (two 25%-contributors
// land their shared ancestor around 40%, not 50%) via 1 - Π(1 - contribution)
// — the same shape as "at least one of these is true" probability math. A
// node's OWN activity contributes at full strength (distance 0), then
// combines with its decayed children the same way.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const BRIGHT_DAYS = 7;
const MEDIUM_DAYS = 30;
const DECAY_PER_HOP = 0.5;

const TIER_INTENSITY = { dull: 0.08, medium: 0.5, bright: 1 };

function recencyTier(lastActivityAt) {
  if (!lastActivityAt) return "dull";
  const ageDays = (Date.now() - new Date(lastActivityAt).getTime()) / DAY_MS;
  if (ageDays <= BRIGHT_DAYS) return "bright";
  if (ageDays <= MEDIUM_DAYS) return "medium";
  return "dull";
}

// A node's own recency tier, independent of its children.
export function ownHeat(node) {
  // Daily cadence needs today specifically to count as bright; a lapsed
  // daily habit falls back to the generic recency window rather than going
  // instantly dull the moment it misses one day.
  if (node.is_daily && isDailyDoneToday(node)) return "bright";
  return recencyTier(node.last_activity_at);
}

// Continuous 0..1 "how lit up is this" for every node at once (post-order,
// children resolved before the parents that depend on them).
export function computeAllBrightness(nodes, edges) {
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const childEdgesByParent = new Map();
  for (const e of edges) {
    if (!nodesById.has(e.child_id) || !nodesById.has(e.parent_id)) continue;
    if (!childEdgesByParent.has(e.parent_id)) childEdgesByParent.set(e.parent_id, []);
    childEdgesByParent.get(e.parent_id).push(e);
  }

  const brightness = new Map();
  const inProgress = new Set();

  function resolve(nodeId) {
    if (brightness.has(nodeId)) return brightness.get(nodeId);
    if (inProgress.has(nodeId)) return 0; // cycle guard
    inProgress.add(nodeId);

    const node = nodesById.get(nodeId);
    const childEdges = childEdgesByParent.get(nodeId) ?? [];
    const ownIntensity = TIER_INTENSITY[ownHeat(node)] ?? 0;

    // own activity (distance 0, full strength) combines with each child's
    // decayed contribution via the same diminishing-returns combine.
    let missAll = 1 - ownIntensity;
    for (const e of childEdges) {
      missAll *= 1 - resolve(e.child_id) * DECAY_PER_HOP;
    }
    const value = 1 - missAll;

    inProgress.delete(nodeId);
    brightness.set(nodeId, value);
    return value;
  }

  for (const n of nodes) resolve(n.id);
  return brightness;
}

// Display-only bucketing for places that want a simple label/dot rather
// than the raw number (Reporting, Profile, the wedge detail panel).
export function brightnessTier(b) {
  if (b >= 0.7) return "bright";
  if (b >= 0.2) return "medium";
  return "dull";
}

export function buildChildrenByParent(edges) {
  const map = new Map();
  for (const e of edges) {
    if (!map.has(e.parent_id)) map.set(e.parent_id, []);
    map.get(e.parent_id).push(e.child_id);
  }
  return map;
}
