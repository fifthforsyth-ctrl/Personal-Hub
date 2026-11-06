import { SLOT, layoutDay, spanOf, colorOf, blockStyle, shortTime } from "../../lib/schedule";
import { fmtTimeRange } from "../../lib/planDates";

// The same schedule, small: the week's columns and the month's squares are
// each a day on the same half-hour scale as the day page, so a block's size
// and place mean the same thing at every zoom.

// A day drawn top to bottom. `slotH` is the height of thirty minutes; names
// show where a block is tall enough to hold one.
export function MiniDay({ chunks, range, slotH = 10, names = true, lines = true }) {
  const rows = Math.max(1, (range.end - range.start) / SLOT);
  const px = (m) => ((m - range.start) / SLOT) * slotH;
  return (
    <div className={"mini" + (lines ? " mini--lines" : "")} style={{ height: rows * slotH, "--mini-slot": `${slotH}px`, "--mini-hour": `${slotH * 2}px` }}>
      {layoutDay(chunks).map(({ chunk, start, end, col, cols }) => {
        const top = Math.max(0, px(start));
        const h = Math.max(2, px(Math.min(end, range.end)) - top - 1);
        const showName = names && h >= 13;
        const showTime = names && h >= 26;
        return (
          <div
            key={chunk.id}
            className="mini__blk"
            style={{ ...blockStyle(chunk.color), top, height: h, left: `${(col / cols) * 100}%`, width: `calc(${100 / cols}% - 1px)` }}
            title={`${chunk.title} · ${fmtTimeRange(chunk.start_time, chunk.end_time)}`}
          >
            {showName && <span className="mini__name">{chunk.title}</span>}
            {showTime && <span className="mini__time">{shortTime(start)}</span>}
          </div>
        );
      })}
    </div>
  );
}

// A day drawn left to right, one thin bar: a phone's week rows and the
// preset list. Ticks mark every three hours.
export function MiniStrip({ chunks, range, ticks = true }) {
  const span = Math.max(1, range.end - range.start);
  const pct = (m) => ((m - range.start) / span) * 100;
  const marks = [];
  for (let m = Math.ceil(range.start / 180) * 180; m <= range.end; m += 180) marks.push(m);
  return (
    <div className="strip">
      <div className="strip__bar">
        {chunks.map((c) => {
          const s = spanOf(c);
          const left = pct(Math.max(range.start, s.start));
          const width = Math.max(0.6, pct(Math.min(range.end, s.end)) - left);
          return (
            <span
              key={c.id ?? `${c.start_time}-${c.title}`}
              className="strip__blk"
              style={{ left: `${left}%`, width: `${width}%`, background: colorOf(c.color).key === "plain" ? "#bdb9b2" : colorOf(c.color).hex }}
              title={`${c.title} · ${fmtTimeRange(c.start_time, c.end_time)}`}
            />
          );
        })}
      </div>
      {ticks && (
        <div className="strip__ticks" aria-hidden="true">
          {marks.map((m) => (
            <span key={m} style={{ left: `${pct(m)}%` }}>
              {shortTime(m)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
