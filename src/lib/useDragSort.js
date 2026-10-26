import { useCallback, useEffect, useRef, useState } from "react";
import { haptic } from "./haptics";
import { dropIndex, edgePush, moved } from "./dragOrder";

// Drag to reorder, by a handle only, so a stray touch never moves anything.
// Works the same with a finger or a mouse (pointer events): press the handle,
// the item lifts and follows, the others slide out of its way, and letting
// go hands the new order of ids to `onDrop`. Near the top or bottom of the
// screen the page scrolls along with it: the app's page scrolls inside
// `.main`, not the window, so it scrolls whatever the list sits in, and the
// edges are that box's own (under the top bar, above the phone's tab bar).
//
//   const sort = useDragSort(ids, (newIds) => save(newIds));
//   <li ref={sort.ref(id)} style={sort.style(id)} className={sort.dragging === id ? "lifted" : ""}>
//     <button {...sort.handle(id)} />
//
// With `onOut`, an item can also be carried out of its list: once the pointer
// is clear of the list, the others close back up and `onOut(phase, x, y, id)`
// hears "move" as it goes ("back" if it comes home), then "drop" (or
// "cancel") where it was let go.

const SPEED = 16; // px per frame at the very edge (faster past it)

// The box that scrolls the list: its nearest scrolling ancestor, or the page.
export function scrollerOf(el) {
  for (let n = el?.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const y = getComputedStyle(n).overflowY;
    if ((y === "auto" || y === "scroll" || y === "overlay") && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

export function useDragSort(ids, onDrop, { onOut } = {}) {
  const els = useRef(new Map());
  const live = useRef(null);
  const [drag, setDrag] = useState(null); // { id, from, to, dy, step }
  const latest = useRef({ ids, onDrop, onOut });
  latest.current = { ids, onDrop, onOut };

  const ref = useCallback(
    (id) => (el) => {
      if (el) els.current.set(id, el);
      else els.current.delete(id);
    },
    []
  );

  const stop = useCallback((commit) => {
    const d = live.current;
    if (!d) return;
    live.current = null;
    cancelAnimationFrame(d.frame);
    window.removeEventListener("pointermove", d.onMove);
    window.removeEventListener("pointerup", d.onUp);
    window.removeEventListener("pointercancel", d.onCancel);
    document.documentElement.classList.remove("drag-sorting");
    setDrag(null);
    if (d.out) {
      latest.current.onOut?.(commit ? "drop" : "cancel", d.x, d.y, d.id);
      if (commit) haptic("tap");
      return;
    }
    if (commit && d.to !== d.from) {
      haptic("tap");
      latest.current.onDrop(moved(d.ids, d.from, d.to));
    }
  }, []);

  useEffect(() => () => stop(false), [stop]);

  function begin(id, e) {
    if (e.button !== undefined && e.button !== 0) return;
    const list = latest.current.ids;
    const from = list.indexOf(id);
    if (from < 0 || (list.length < 2 && !latest.current.onOut)) return;
    e.preventDefault();
    e.stopPropagation();
    const box = scrollerOf(e.currentTarget);
    const scrolled = () => (box ? box.scrollTop : window.scrollY);
    const rects = list.map((x) => els.current.get(x)?.getBoundingClientRect());
    if (rects.some((r) => !r)) return;
    const me = rects[from];
    // The room the item takes: its height plus the gap to its neighbour.
    const gap = rects.length > 1 ? Math.max(0, from + 1 < rects.length ? rects[from + 1].top - me.bottom : me.top - rects[from - 1].bottom) : 0;
    const d = {
      id,
      ids: list,
      from,
      to: from,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      out: false,
      scroll0: scrolled(),
      mids: rects.map((r) => r.top + r.height / 2 + scrolled()),
      // The list's own stretch of the page; past it (by half a step) is out.
      span: [rects[0].top + scrolled(), rects[rects.length - 1].bottom + scrolled()],
      step: me.height + gap,
      frame: 0,
    };
    const update = () => {
      const dy = d.y - d.startY + (scrolled() - d.scroll0);
      const at = d.y + scrolled();
      const slack = d.step / 2;
      d.out = Boolean(latest.current.onOut) && (at < d.span[0] - slack || at > d.span[1] + slack);
      d.to = d.out ? d.from : dropIndex(d.mids, d.from, d.mids[d.from] + dy);
      setDrag({ id: d.id, from: d.from, to: d.to, dy, step: d.step });
      if (d.out || d.wasOut) latest.current.onOut?.(d.out ? "move" : "back", d.x, d.y, d.id);
      d.wasOut = d.out;
    };
    const tick = () => {
      if (live.current !== d) return;
      const r = box?.getBoundingClientRect();
      const top = Math.max(0, r ? r.top : 0);
      const bottom = Math.min(window.innerHeight, r ? r.bottom : window.innerHeight);
      const push = edgePush(d.y, top, bottom);
      if (push) {
        const before = scrolled();
        const by = Math.round(push * SPEED);
        if (box) box.scrollTop = before + by;
        else window.scrollBy(0, by);
        if (scrolled() !== before) update();
      }
      d.frame = requestAnimationFrame(tick);
    };
    d.onMove = (ev) => {
      ev.preventDefault();
      d.x = ev.clientX;
      d.y = ev.clientY;
      update();
    };
    d.onUp = () => stop(true);
    d.onCancel = () => stop(false);
    window.addEventListener("pointermove", d.onMove, { passive: false });
    window.addEventListener("pointerup", d.onUp);
    window.addEventListener("pointercancel", d.onCancel);
    document.documentElement.classList.add("drag-sorting");
    live.current = d;
    d.frame = requestAnimationFrame(tick);
    haptic("tap");
    setDrag({ id, from, to: from, dy: 0, step: d.step });
  }

  // The lifted item follows the pointer; the ones it has passed make room.
  function style(id) {
    if (!drag) return undefined;
    const i = ids.indexOf(id);
    if (id === drag.id) return { transform: `translateY(${drag.dy}px)`, position: "relative", zIndex: 5 };
    let shift = 0;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) shift = -drag.step;
    if (drag.to < drag.from && i >= drag.to && i < drag.from) shift = drag.step;
    return { transform: shift ? `translateY(${shift}px)` : undefined, transition: "transform 0.18s ease" };
  }

  function handle(id) {
    return {
      onPointerDown: (e) => begin(id, e),
      // A press on the handle is never a click on what it sits in.
      onClick: (e) => e.stopPropagation(),
      "data-haptic-skip": "",
    };
  }

  return { ref, style, handle, dragging: drag?.id ?? null };
}
