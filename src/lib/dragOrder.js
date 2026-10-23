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
