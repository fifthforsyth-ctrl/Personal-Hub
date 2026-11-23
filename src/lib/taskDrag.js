import { haptic } from "./haptics";

// Dragging tasks on the Tasks tab and from the pull-down clipboard
// (Aaron, 2026-11-23): press a task's handle, carry it anywhere on the
// screen, let go over a column (or the clipboard) and it lands there, just
// above the task under the finger (or at the end).
//
// Anything drawn with data-col is a place to land:
//   <ul data-col data-camp={campId} data-section={sectionId ?? ""}>
//     <li data-row={stepId}>…
// Only rows that are direct tops (data-row) count for where it lands.
//
// Near the left or right edge of the screen the box marked data-hscroll
// (the columns) scrolls along; near the top or bottom, the list under the
// finger (data-vscroll) or the page scrolls.
//
//   onPointerDown={(e) => beginDrag(e, { ids: [id], label: text, onDrop: (to) => … })}
//
// `to` is { campId, sectionId, beforeId }. One drag at a time.

let active = null;
const EDGE = 44;
const SPEED = 14;

function landing(x, y, skip) {
  const el = document.elementFromPoint(x, y);
  let col = el?.closest?.("[data-col]");
  // Below a short column (or in the gap under it), it's still that column:
  // the one straight above the finger. Never through the clipboard.
  if (!col && !el?.closest?.(".tk-clip, .bottom-tabs")) {
    col = [...document.querySelectorAll(".tk-cols [data-col]")].find((c) => {
      const b = c.getBoundingClientRect();
      return x >= b.left && x <= b.right && y >= b.top;
    });
  }
  if (!col) return null;
  const rows = [...col.querySelectorAll("[data-row]")].filter((r) => r.closest("[data-col]") === col && !r.closest(".tk-col__list--done") && !skip.has(r.dataset.row));
  let before = null;
  for (const r of rows) {
    const b = r.getBoundingClientRect();
    if (y < b.top + b.height / 2) {
      before = r;
      break;
    }
  }
  return { col, before, last: rows[rows.length - 1] ?? null };
}

function scrollParent(el, axis) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (axis === "x" && n.hasAttribute?.("data-hscroll")) return n;
    if (axis === "y" && (n.hasAttribute?.("data-vscroll") || n.classList?.contains("main"))) return n;
  }
  return axis === "y" ? document.querySelector(".main") : null;
}

export function isDragging() {
  return Boolean(active);
}

export function beginDrag(e, { ids, label, onDrop }) {
  if (active || (e.button != null && e.button !== 0)) return;
  e.preventDefault();
  e.stopPropagation();
  const pointerId = e.pointerId;
  const skip = new Set(ids);
  const ghost = document.createElement("div");
  ghost.className = "tk-ghost";
  ghost.textContent = label || "Task";
  document.body.appendChild(ghost);
  const line = document.createElement("div");
  line.className = "tk-dropline";
  document.body.appendChild(line);
  document.documentElement.classList.add("tk-dragging");
  const source = e.currentTarget.closest("[data-row]") ?? e.currentTarget;
  source.classList.add("tk-lifted");
  haptic("tap");

  let x = e.clientX;
  let y = e.clientY;
  let hit = null;
  let raf = 0;

  const show = () => {
    ghost.style.transform = `translate(${x - 24}px, ${y - 22}px)`;
    hit = landing(x, y, skip);
    document.querySelectorAll(".tk-col-hot").forEach((n) => n !== hit?.col && n.classList.remove("tk-col-hot"));
    if (!hit) {
      line.style.display = "none";
      return;
    }
    hit.col.classList.add("tk-col-hot");
    const cb = hit.col.getBoundingClientRect();
    let top;
    if (hit.before) top = hit.before.getBoundingClientRect().top - 3;
    else if (hit.last) top = hit.last.getBoundingClientRect().bottom + 1;
    else top = cb.top + 8;
    line.style.display = "block";
    line.style.left = `${cb.left + 6}px`;
    line.style.width = `${Math.max(0, cb.width - 12)}px`;
    line.style.top = `${top}px`;
  };

  const tick = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const under = document.elementFromPoint(x, y);
    let moved = false;
    if (x < EDGE || x > w - EDGE) {
      const hs = (under && scrollParent(under, "x")) || document.querySelector("[data-hscroll]");
      if (hs) {
        const before = hs.scrollLeft;
        // Slow near the inside of the edge, quicker right at it.
        const depth = x < EDGE ? (EDGE - x) / EDGE : (x - (w - EDGE)) / EDGE;
        hs.scrollLeft += (x < EDGE ? -1 : 1) * Math.round(3 + depth * (SPEED - 3));
        moved ||= hs.scrollLeft !== before;
      }
    }
    if (y < EDGE * 2.2 || y > h - EDGE * 2.2) {
      const vs = under && scrollParent(under, "y");
      if (vs) {
        const before = vs.scrollTop;
        vs.scrollTop += y < EDGE * 2.2 ? -SPEED : SPEED;
        moved ||= vs.scrollTop !== before;
      }
    }
    if (moved) show();
    raf = requestAnimationFrame(tick);
  };

  const move = (ev) => {
    if (ev.pointerId !== pointerId) return;
    ev.preventDefault();
    x = ev.clientX;
    y = ev.clientY;
    show();
  };
  const end = (ev) => {
    if (ev.pointerId !== pointerId) return;
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
    window.removeEventListener("touchmove", block);
    ghost.remove();
    line.remove();
    source.classList.remove("tk-lifted");
    document.documentElement.classList.remove("tk-dragging");
    document.querySelectorAll(".tk-col-hot").forEach((n) => n.classList.remove("tk-col-hot"));
    active = null;
    if (ev.type === "pointerup" && hit) {
      const to = {
        campId: hit.col.dataset.camp,
        sectionId: hit.col.dataset.section || null,
        beforeId: hit.before?.dataset.row ?? null,
      };
      haptic("success");
      onDrop?.(to);
    }
  };
  // iOS Safari: stop the page scrolling under the finger while carrying.
  const block = (ev) => ev.preventDefault();

  active = { pointerId };
  window.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
  window.addEventListener("touchmove", block, { passive: false });
  show();
  raf = requestAnimationFrame(tick);
}
