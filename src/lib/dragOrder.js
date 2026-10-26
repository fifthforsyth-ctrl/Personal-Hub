// The arithmetic of drag to reorder (useDragSort), kept pure so it can be tested.

// Where the dragged item would land: its original slot, moved past every
// other item whose middle its own middle has crossed.
export function dropIndex(mids, from, middle) {
  let to = 0;
  for (let i = 0; i < mids.length; i++) if (i !== from && mids[i] < middle) to += 1;
  return to;
}

// `ids` in their new order once the one at `from` moves to `to`.
export function moved(ids, from, to) {
  const next = [...ids];
  const [id] = next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

// How hard to scroll while dragging near an edge, for a pointer at `y` in a
// scrolling box from `top` to `bottom`: 0 away from the edges, rising to -1
// at the top edge or 1 at the bottom one, and on past it up to `max` when
// the pointer goes beyond (over the top bar or the tab bar). The edge zone
// is `edge` px, less in a short box.
export function edgePush(y, top, bottom, edge = 80, max = 1.75) {
  const zone = Math.min(edge, Math.max(24, (bottom - top) / 4));
  const push = y < top + zone ? -(top + zone - y) / zone : y > bottom - zone ? (y - (bottom - zone)) / zone : 0;
  return Math.max(-max, Math.min(max, push));
}
