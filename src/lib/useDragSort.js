import { useCallback, useEffect, useRef, useState } from "react";
import { haptic } from "./haptics";
import { dropIndex, edgePush, moved, towardEdge } from "./dragOrder";

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
//
// With `into` ({ rows, label, drop }), it can also go under another item
// (Aaron, 2026-10-27): held over the middle of any row matching the `rows`
// selector, that row lights up (its li gets `drop-into`), the item tucks in
// under it wearing `label`, and letting go there hands `drop(id, li)` the
// row's li. Its own rows, the ones under it and the one it's already under
// don't count, nor do rows out of sight, nor any row while the page is
// scrolling along at an edge (rows sliding past under a still finger would
// otherwise light up one after another). While it's over a row nothing else
// moves, so the row stays right where it is under the finger; and once
// `into` is on, the room it makes among its neighbours follows the finger,
// not its middle (a step with sub-steps under it would otherwise slide its
// neighbours away before the finger got to them). `into` can also be a
// function of the dragged item's id, giving that item's { rows, label, drop }
// or nothing, when only some items in the list can go under a row.
//
// With `cross` ({ scroller }), the list is one column among others side by
// side (Today's board, 2026-10-28): the item is out of its list once the
// pointer leaves the column sideways too, it follows the pointer across, and
// `scroller()` (the box the columns scroll sideways in) scrolls along at its
// left and right edges.

const SPEED = 16; // px per frame at the very edge (faster past it)
const NEST_X = 28; // how far in it tucks under a row it's going into

// How far the item at `i` has slid to make room, while the one at `from` is
// carried to `to` and each takes `step` px.
function shiftOf(i, from, to, step) {
  if (from < to && i > from && i <= to) return -step;
  if (to < from && i >= to && i < from) return step;
  return 0;
}

// For `onOut`: lights up where a carried item would land, `hit.el` (a
// [data-drop] box) and `hit.below`, the item it would go just before (none:
// at the end). With no `hit` (let go, or back home) it all goes dark.
export function markDrop(hit) {
  document.querySelectorAll("[data-drop].drop-here").forEach((e) => e !== hit?.el && e.classList.remove("drop-here", "drop-end"));
  document.querySelectorAll(".drop-before").forEach((e) => e !== hit?.below && e.classList.remove("drop-before"));
  if (!hit) return;
  hit.el.classList.add("drop-here");
  hit.el.classList.toggle("drop-end", !hit.below);
  hit.below?.classList.add("drop-before");
}

// The box that scrolls the list: its nearest scrolling ancestor, or the page.
export function scrollerOf(el) {
  for (let n = el?.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const y = getComputedStyle(n).overflowY;
    if ((y === "auto" || y === "scroll" || y === "overlay") && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

export function useDragSort(ids, onDrop, { onOut, into, cross } = {}) {
  const els = useRef(new Map());
  const live = useRef(null);
  const [drag, setDrag] = useState(null); // { id, from, to, x, y, step, nest }
  const latest = useRef({ ids, onDrop, onOut, into, cross });
  latest.current = { ids, onDrop, onOut, into, cross };

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
    document.documentElement.classList.remove("drag-sorting", "drag-into");
    setDrag(null);
    if (d.into) {
      d.into.li.classList.remove("drop-into");
      // whatever was lit on the way here goes dark
      if (d.wasOut) latest.current.onOut?.("cancel", d.x, d.y, d.id);
      if (commit) {
        haptic("tap");
        d.nest?.drop(d.id, d.into.li);
      }
      return;
    }
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
    const into = typeof latest.current.into === "function" ? latest.current.into(id) : latest.current.into;
    if (from < 0 || (list.length < 2 && !latest.current.onOut && !into)) return;
    e.preventDefault();
    e.stopPropagation();
    const box = scrollerOf(e.currentTarget);
    const scrolled = () => (box ? box.scrollTop : window.scrollY);
    // The columns' box, and how far it has scrolled sideways since the drag began.
    const xbox = latest.current.cross?.scroller?.() ?? null;
    const scrollX0 = xbox ? xbox.scrollLeft : 0;
    const shiftX = () => (xbox ? xbox.scrollLeft - scrollX0 : 0);
    // The part of the page you can see: the scroller's box, or the window.
    const seen = () => {
      const r = box?.getBoundingClientRect();
      return { top: Math.max(0, r ? r.top : 0), bottom: Math.min(window.innerHeight, r ? r.bottom : window.innerHeight) };
    };
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
      startX: e.clientX,
      x: e.clientX,
      y: e.clientY,
      out: false,
      scroll0: scrolled(),
      mids: rects.map((r) => r.top + r.height / 2 + scrolled()),
      // The list's own stretch of the page; past it (by half a step) is out.
      span: [rects[0].top + scrolled(), rects[rects.length - 1].bottom + scrolled()],
      // and its stretch across, where it stood when the drag began
      spanX: [Math.min(...rects.map((r) => r.left)), Math.max(...rects.map((r) => r.right))],
      step: me.height + gap,
      // where on the item it was picked up, so it stays under the finger
      grab: e.clientY - me.top,
      targets: [],
      into: null,
      // what going under a row does, for this item
      nest: into ?? null,
      pushing: false,
      frame: 0,
    };
    const self = els.current.get(id);
    // Where the item sits in the page right now, without its own lift: room
    // opening above it in another list moves it down.
    const placed = () => {
      const t = getComputedStyle(self).transform;
      return self.getBoundingClientRect().top - (t && t !== "none" ? new DOMMatrixReadOnly(t).m42 : 0);
    };
    // The rows it could go under: not its own, nor ones under it, nor the
    // one it's already under.
    if (into) {
      const above = self.parentElement?.closest("li");
      for (const row of document.querySelectorAll(into.rows)) {
        const li = row.closest("li");
        if (li && !self.contains(li) && li !== above) d.targets.push({ li, row });
      }
    }
    // Over a row is from a quarter of the way down it to three quarters, so
    // the edges between rows still move it in among them. Rows are measured
    // where they are now, room made for it and all, and only count where
    // they can be seen, with the finger in sight too.
    const over = (t) => {
      const r = t.row.getBoundingClientRect();
      const q = r.height / 4;
      const v = seen();
      const mid = r.top + r.height / 2;
      if (d.y < v.top || d.y > v.bottom || mid < v.top || mid > v.bottom) return false;
      return r.height > 0 && d.y > r.top + q && d.y < r.bottom - q && d.x >= r.left - 16 && d.x <= r.right + 32;
    };
    const update = () => {
      const dy = d.y - d.startY + (scrolled() - d.scroll0);
      const at = d.y + scrolled();
      const slack = d.step / 2;
      if (d.into && (d.pushing || !over(d.into))) {
        d.into.li.classList.remove("drop-into");
        d.into = null;
      }
      if (!d.into && !d.pushing && d.targets.length) {
        d.into = d.targets.find(over) ?? null;
        if (d.into) {
          d.into.li.classList.add("drop-into");
          haptic("tap");
        }
      }
      document.documentElement.classList.toggle("drag-into", Boolean(d.into));
      // Over a row everything else keeps still, the room it was making
      // included, so the row stays where it is under the finger.
      if (!d.into) {
        const aside = Boolean(xbox || latest.current.cross) && (d.x < d.spanX[0] - shiftX() || d.x > d.spanX[1] - shiftX());
        d.out = Boolean(latest.current.onOut) && (at < d.span[0] - slack || at > d.span[1] + slack || aside);
        d.to = d.out ? d.from : dropIndex(d.mids, d.from, into ? at : d.mids[d.from] + dy);
        if (d.out || d.wasOut) latest.current.onOut?.(d.out ? "move" : "back", d.x, d.y, d.id);
        d.wasOut = d.out;
      }
      // It follows the finger, or tucks in just under the row it's over, a
      // little in from the edge.
      const top = placed();
      const y = d.into ? d.into.row.getBoundingClientRect().bottom - top : d.y - d.grab - top;
      // Across columns it follows the pointer sideways too (less the
      // columns' own scroll, which carries it along with them).
      const x = d.into ? NEST_X : latest.current.cross && d.out ? d.x - d.startX + shiftX() : 0;
      setDrag({ id: d.id, from: d.from, to: d.to, x, y, step: d.step, nest: d.into ? into.label : null });
    };
    const tick = () => {
      if (live.current !== d) return;
      const { top, bottom } = seen();
      const push = towardEdge(edgePush(d.y, top, bottom), d.startY, d.y);
      let moving = false;
      if (push) {
        const before = scrolled();
        const by = Math.round(push * SPEED);
        if (box) box.scrollTop = before + by;
        else window.scrollBy(0, by);
        moving = scrolled() !== before;
      }
      // Once the page stops, the row under the finger can light up again.
      // Sideways too, at the columns' own left and right edges.
      if (xbox) {
        const r = xbox.getBoundingClientRect();
        const side = towardEdge(edgePush(d.x, r.left, r.right, 48), d.startX, d.x);
        if (side) {
          const before = xbox.scrollLeft;
          xbox.scrollLeft = before + Math.round(side * SPEED);
          if (xbox.scrollLeft !== before) moving = true;
        }
      }
      const was = d.pushing;
      d.pushing = moving;
      if (moving || was) update();
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
    setDrag({ id, from, to: from, x: 0, y: 0, step: d.step, nest: null });
  }

  // The lifted item follows the pointer; the ones it has passed make room.
  // Over a row it can go under, it tucks in under that row instead.
  function style(id) {
    if (!drag) return undefined;
    const i = ids.indexOf(id);
    if (id === drag.id) return { transform: drag.x ? `translate(${drag.x}px, ${drag.y}px)` : `translateY(${drag.y}px)`, position: "relative", zIndex: 5 };
    const shift = shiftOf(i, drag.from, drag.to, drag.step);
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

  return { ref, style, handle, dragging: drag?.id ?? null, nesting: drag?.nest ?? null };
}
