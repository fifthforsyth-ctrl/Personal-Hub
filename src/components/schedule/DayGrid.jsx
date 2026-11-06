import { useEffect, useRef, useState } from "react";
import { Repeat } from "lucide-react";
import { SLOT, layoutDay, spanOf, moved, resized, hourLabel, toTime, blockStyle } from "../../lib/schedule";
import { fmtTime, fmtTimeRange } from "../../lib/planDates";
import { haptic } from "../../lib/haptics";

// One day on the half-hour grid. Each row is thirty minutes and each block
// is exactly as tall as the time it takes, so the open time between blocks
// is plain to see, and a block's place on the page is its place in the day.
//
//   tap an empty row      add a block that starts there
//   tap a block           open it
//   drag a block          move it (on a phone: press and hold, then drag)
//   drag its bottom edge  make it longer or shorter
//
// Moves snap to fifteen minutes. A block that runs past midnight is drawn to
// the end of the day and can only be changed from its sheet.
export default function DayGrid({ chunks, tasksByChunk, range, slotH = 26, nowMin = null, onAdd, onOpen, onChange }) {
  const rows = [];
  for (let m = range.start; m < range.end; m += SLOT) rows.push(m);
  const height = rows.length * slotH;
  const px = (min) => ((min - range.start) / SLOT) * slotH;

  // The block being dragged, and where it is right now.
  const drag = useRef(null);
  const [live, setLive] = useState(null); // { id, start, end }

  // While a block is held on a phone, the page mustn't scroll under it.
  useEffect(() => {
    const stop = (e) => {
      if (drag.current?.active) e.preventDefault();
    };
    window.addEventListener("touchmove", stop, { passive: false });
    return () => window.removeEventListener("touchmove", stop);
  }, []);

  function begin(e, chunk, mode) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const span = spanOf(chunk);
    const canDrag = !span.overnight;
    const d = { id: chunk.id, chunk, mode, y0: e.clientY, x0: e.clientX, span, cur: span, active: false, canDrag, touch: e.pointerType !== "mouse", timer: null };
    if (mode === "resize" && canDrag) d.active = true;
    if (d.touch && mode === "move" && canDrag) {
      // Press and hold to pick it up, so an ordinary swipe still scrolls.
      d.timer = setTimeout(() => {
        if (drag.current !== d) return;
        d.active = true;
        haptic("tap");
        setLive({ id: d.id, start: d.span.start, end: d.span.end });
      }, 280);
    }
    drag.current = d;
    if (mode === "resize") e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* already gone */
    }
  }

  function move(e) {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y0;
    const dx = e.clientX - d.x0;
    if (!d.active) {
      if (d.touch) {
        // Moved before the hold finished: it's a scroll, not a pick-up.
        if (Math.hypot(dx, dy) > 8) {
          clearTimeout(d.timer);
          drag.current = null;
        }
        return;
      }
      if (!d.canDrag || Math.abs(dy) < 4) return;
      d.active = true;
    }
    const delta = (dy / slotH) * SLOT;
    const next = d.mode === "move" ? moved(d.span, delta) : resized(d.span, delta);
    if (next.start !== d.cur.start || next.end !== d.cur.end) {
      d.cur = next;
      setLive({ id: d.id, ...next });
    }
  }

  function end(e, cancelled = false) {
    const d = drag.current;
    if (!d) return;
    clearTimeout(d.timer);
    drag.current = null;
    setLive(null);
    if (cancelled) return;
    if (!d.active) {
      if (d.mode === "move") onOpen(d.chunk);
      return;
    }
    if (d.cur.start !== d.span.start || d.cur.end !== d.span.end) {
      haptic("tap");
      onChange(d.chunk, { start_time: toTime(d.cur.start), end_time: toTime(d.cur.end) });
    }
  }

  const laid = layoutDay(chunks);

  return (
    <div className="sched" style={{ height }}>
      <div className="sched__gutter" aria-hidden="true">
        {rows
          .filter((m) => m % 60 === 0)
          .map((m) => (
            <span key={m} className="sched__hour" style={{ top: px(m) }}>
              {hourLabel(m)}
            </span>
          ))}
      </div>

      <div className="sched__body">
        {rows.map((m) => (
          <button
            key={m}
            type="button"
            className={"sched__slot" + (m % 60 === 0 ? " is-hour" : "")}
            style={{ top: px(m), height: slotH }}
            onClick={() => onAdd(m)}
            aria-label={`Add a block at ${fmtTime(toTime(m))}`}
          >
            <span className="sched__slot-hint">+ {hourLabel(m).replace(" ", m % 60 ? `:${m % 60} ` : " ")}</span>
          </button>
        ))}

        {nowMin != null && nowMin >= range.start && nowMin <= range.end && (
          <div className="sched__now" style={{ top: px(nowMin) }} aria-hidden="true">
            <span />
          </div>
        )}

        {laid.map(({ chunk, start, end: stop, col, cols }) => {
          const isLive = live?.id === chunk.id;
          const s = isLive ? live.start : start;
          const e = isLive ? live.end : stop;
          const h = Math.max(((e - s) / SLOT) * slotH - 2, Math.min(12, slotH / 2));
          const tasks = tasksByChunk.get(chunk.id) ?? [];
          const done = tasks.filter((t) => t.status).length;
          const time = fmtTimeRange(toTime(s), toTime(Math.min(e, 24 * 60 - 1)));
          const tight = h < 34;
          const room = Math.max(0, Math.floor((h - 44) / 17));
          return (
            <div
              key={chunk.id}
              role="button"
              tabIndex={0}
              className={"blk" + (tight ? " blk--tight" : "") + (isLive ? " is-dragging" : "")}
              style={{
                ...blockStyle(chunk.color),
                top: px(s) + 1,
                height: h,
                left: `calc(${(col / cols) * 100}% + 2px)`,
                width: `calc(${100 / cols}% - 4px)`,
              }}
              title={`${chunk.title} · ${time}${tasks.length ? ` · ${done} of ${tasks.length} done` : ""}`}
              aria-label={`${chunk.title}, ${time}. Open it.`}
              onPointerDown={(ev) => begin(ev, chunk, "move")}
              onPointerMove={move}
              onPointerUp={(ev) => end(ev)}
              onPointerCancel={(ev) => end(ev, true)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  onOpen(chunk);
                }
              }}
            >
              <div className="blk__head">
                <span className="blk__title">{chunk.title}</span>
                {chunk.standing_block_id && <Repeat size={10} className="blk__icon" aria-label="Repeats weekly" />}
                {tasks.length > 0 && (
                  <span className="blk__count">
                    {done}/{tasks.length}
                  </span>
                )}
              </div>
              {!tight && <div className="blk__time">{time}</div>}
              {tight && <span className="blk__time blk__time--inline">{time}</span>}
              {room > 0 && tasks.length > 0 && (
                <ul className="blk__tasks">
                  {tasks.slice(0, room).map((t) => (
                    <li key={t.id} className={t.status ? "is-done" : ""}>
                      <span className="blk__tick" aria-hidden="true" />
                      {t.title}
                    </li>
                  ))}
                  {tasks.length > room && <li className="blk__more">+{tasks.length - room} more</li>}
                </ul>
              )}
              {!spanOf(chunk).overnight && (
                <span
                  className="blk__grip"
                  aria-hidden="true"
                  onPointerDown={(ev) => begin(ev, chunk, "resize")}
                />
              )}
              {isLive && <span className="blk__live">{time}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
