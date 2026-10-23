import { useCallback, useEffect, useRef, useState } from "react";
import { haptic } from "./haptics";
import { dropIndex, moved } from "./dragOrder";

// Drag to reorder, by a handle only, so a stray touch never moves anything.
// Works the same with a finger or a mouse (pointer events): press the handle,
// the item lifts and follows, the others slide out of its way, and letting
// go hands the new order of ids to `onDrop`. Near the top or bottom of the
// screen the page scrolls along with it.
//
//   const sort = useDragSort(ids, (newIds) => save(newIds));
//   <li ref={sort.ref(id)} style={sort.style(id)} className={sort.dragging === id ? "lifted" : ""}>
//     <button {...sort.handle(id)} />

const EDGE = 72; // px from the top or bottom of the screen where it scrolls
const SPEED = 14; // px per frame at the very edge

export function useDragSort(ids, onDrop) {
  const els = useRef(new Map());
  const live = useRef(null);
  const [drag, setDrag] = useState(null); // { id, from, to, dy, step }
  const latest = useRef({ ids, onDrop });
  latest.current = { ids, onDrop };

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
    if (from < 0 || list.length < 2) return;
    e.preventDefault();
    e.stopPropagation();
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
      y: e.clientY,
      scroll0: window.scrollY,
      mids: rects.map((r) => r.top + r.height / 2 + window.scrollY),
      step: me.height + gap,
      frame: 0,
    };
    const update = () => {
      const dy = d.y - d.startY + (window.scrollY - d.scroll0);
      d.to = dropIndex(d.mids, d.from, d.mids[d.from] + dy);
      setDrag({ id: d.id, from: d.from, to: d.to, dy, step: d.step });
    };
    const tick = () => {
      if (live.current !== d) return;
      const h = window.innerHeight;
      const push = d.y < EDGE ? -(EDGE - d.y) / EDGE : d.y > h - EDGE ? (d.y - (h - EDGE)) / EDGE : 0;
      if (push) {
        window.scrollBy(0, Math.round(push * SPEED));
        update();
      }
      d.frame = requestAnimationFrame(tick);
    };
    d.onMove = (ev) => {
      ev.preventDefault();
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
