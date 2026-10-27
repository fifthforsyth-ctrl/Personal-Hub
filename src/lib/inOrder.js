// Saves that have to land in the order they were made: a drag, then another
// drag of the same list, then an Undo. Each waits for the ones started before
// it, whether those worked or not, so a quick Undo or a second drag can't be
// overtaken on the way to the database by the save it follows.
//
//   const inOrder = savesInOrder();
//   inOrder(() => reorder("quest_tasks", next)).catch(...);
//
// `inOrder.reload(load)` reloads in line, after every save before it, so the
// answer can't show one of them half done; and again if more were made while
// it was waiting or out, since its answer would wipe those off the screen.
export function savesInOrder() {
  let last = Promise.resolve();
  let made = 0;
  const inOrder = (save) => {
    made += 1;
    const p = last.then(save);
    last = p.catch(() => {});
    return p;
  };
  inOrder.reload = (load) => {
    const at = made + 1;
    inOrder(load)
      .catch(() => {})
      .then(() => made > at && inOrder.reload(load));
  };
  return inOrder;
}

// A move that can be undone. Its saves go in line (`inOrder`); `undo(saveBack)`
// puts Undo's saves in line after them. If the move's saves fail once Undo has
// been tapped, the failure (`failed`, which reloads the page) waits for Undo's
// saves too: a reload before them would show the move half done.
export function undoableSave(inOrder, save, failed) {
  let undone = false;
  const going = inOrder(save).then(
    () => null,
    (err) => {
      if (undone) return err;
      failed(err);
      return null;
    }
  );
  return (saveBack, failedBack) => {
    undone = true;
    inOrder(saveBack).then(
      () => going.then((err) => err && failed(err)),
      (err) => failedBack(err)
    );
  };
}
