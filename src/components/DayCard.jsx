import { Link } from "react-router-dom";
import { Archive } from "lucide-react";
import { colorFor, fmtMinutes } from "../lib/categories";
import DayRing from "./DayRing";
import { parseDateStr, todayStr, fmtTimeRange, minutesOf } from "../lib/planDates";
import "../styles/plan.css";

// The repeated object. A day is a card everywhere in this app: full size on
// the day page, tiled across the week, shrunk to a square in the month grid.
// Same header, same colour strip, same completion language at every scale —
// so zooming out never means learning a new picture.

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Non-breaking spaces, so a short phrase wraps as one piece.
const nowrap = (text) => text.replace(/ /g, " ");

// "2 of 4 done" where there's room; "2/4" in the seven narrow columns of a
// desk-width week, where the card's tooltip spells it out.
function Count({ done, total }) {
  return (
    <>
      <span className="day-card__count-long">{nowrap(`${done} of ${total} done`)}</span>
      <span className="day-card__count-short">
        {done}/{total}
      </span>
    </>
  );
}

export function timeStrip(rows, { thin = false, tall = false } = {}) {
  const total = rows.reduce((s, r) => s + Number(r.minutes || 0), 0);
  if (total <= 0) return null;
  return (
    <div className={"time-strip" + (thin ? " time-strip--thin" : "") + (tall ? " time-strip--tall" : "")}>
      {rows.map((r) => (
        <i
          key={r.category}
          title={`${r.category} · ${fmtMinutes(r.minutes)}`}
          style={{ width: `${(Number(r.minutes) / total) * 100}%`, background: colorFor(r.category) }}
        />
      ))}
    </div>
  );
}

// One day, tiled — the week grid and the home page's "today" preview.
//
// `tracked` is the day's logged minutes with each entry counted once. The
// category rows can't give that: an entry tagged two ways is in both rows,
// so their sum runs long. Without it, the rows' sum is the best there is.
export function DayCard({ date, chunks = [], tasks = [], timeRows = [], ringArcs = null, banked = false, tracked, pending = false, to, children }) {
  const d = parseDateStr(date);
  const isToday = date === todayStr();
  const top = tasks.filter((t) => !t.parent_task_id);
  const done = top.filter((t) => t.status).length;
  const minutes = tracked != null ? Number(tracked) || 0 : timeRows.reduce((s, r) => s + Number(r.minutes || 0), 0);
  const isEmpty = chunks.length === 0 && top.length === 0 && minutes === 0;
  const sorted = [...chunks].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));

  const inner = (
    <>
      <div className="day-card__head">
        <span>
          <span className="day-card__dow">{DOW[d.getDay()]}</span>
          <span className="day-card__num" style={{ display: "block" }}>{d.getDate()}</span>
        </span>
        <span className="row" style={{ gap: 5 }}>
          {/* A banked day is closed; the mark is what tells you not to go
              looking for something still to do on it. */}
          {banked && <Archive size={11} style={{ color: "var(--text-2)" }} aria-label="Banked" />}
          {top.length > 0 && (
            <span className="mono faint day-card__count" style={{ fontSize: 10.5 }} title={`${done} of ${top.length} tasks done`}>
              <Count done={done} total={top.length} />
            </span>
          )}
        </span>
      </div>

      <div className="day-card__body">
        {ringArcs?.length > 0 ? (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <DayRing arcs={ringArcs} size={124} fluid />
          </div>
        ) : (
          timeRows.length > 0 && <div style={{ marginBottom: 8 }}>{timeStrip(timeRows, { thin: true })}</div>
        )}

        {sorted.slice(0, 4).map((c, i) => {
          const own = tasks.filter((t) => t.time_chunk_id === c.id && !t.parent_task_id);
          const allDone = own.length > 0 && own.every((t) => t.status);
          // Two blocks claiming the same hour is worth seeing from the week.
          const prev = sorted[i - 1];
          const overlaps = prev && minutesOf(c.start_time) < minutesOf(prev.end_time) && minutesOf(prev.end_time) > minutesOf(prev.start_time);
          const ownDone = own.filter((t) => t.status).length;
          return (
            <div
              key={c.id}
              className={"chunk" + (allDone ? " chunk--done" : "") + (overlaps ? " chunk--overlap" : "")}
              title={
                `${c.title} · ${fmtTimeRange(c.start_time, c.end_time)}` +
                (own.length > 0 ? ` · ${ownDone} of ${own.length} tasks done` : "") +
                (overlaps ? ` · overlaps “${prev.title}”` : "")
              }
            >
              <div className="chunk__title">{c.title}</div>
              {/* Each piece wraps whole — "9:00 AM" and "1 of 2 done" never
                  split across lines in a narrow card. */}
              <div className="chunk__time">
                {nowrap(fmtTimeRange(c.start_time, c.end_time))}
                {own.length > 0 && (
                  <>
                    {" · "}
                    <Count done={ownDone} total={own.length} />
                  </>
                )}
                {overlaps ? " · overlaps" : ""}
              </div>
            </div>
          );
        })}

        {chunks.length > 4 && (
          <div className="faint" style={{ fontSize: 10.5 }}>+{chunks.length - 4} more blocks</div>
        )}

        {chunks.length === 0 && top.length > 0 && (
          <div className="stack" style={{ gap: 3 }}>
            {top.slice(0, 4).map((t) => (
              <div key={t.id} className="truncate" style={{ fontSize: 11.5, color: t.status ? "var(--text-3)" : "var(--text-2)", textDecoration: t.status ? "line-through" : "none" }}>
                {t.status ? "✓" : "○"} {t.title}
              </div>
            ))}
          </div>
        )}

        {isEmpty && !pending && <div className="faint" style={{ fontSize: 11 }}>Nothing planned</div>}

        {minutes > 0 && (
          <div className="mono faint" style={{ fontSize: 10.5, marginTop: 8 }}>{fmtMinutes(minutes)} tracked</div>
        )}

        {children}
      </div>
    </>
  );

  const cls = "day-card" + (isToday ? " day-card--today" : "") + (isEmpty && !banked ? " day-card--empty" : "") + (banked ? " day-card--banked" : "");

  return to ? (
    <Link to={to} className={cls}>{inner}</Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

// The same day, shrunk to a month cell. Everything that survives the shrink is
// the part that reads at a glance: the number, how much was tracked, how much
// got done.
export function MonthCell({ date, summary, timeRows = [], ringArcs = null, onClick }) {
  if (!date) return <div className="month-cell month-cell--blank" />;

  const d = parseDateStr(date);
  const isToday = date === todayStr();
  const tasks = Number(summary?.task_count ?? 0);
  const done = Number(summary?.done_count ?? 0);
  const minutes = Number(summary?.logged_minutes ?? 0);

  return (
    <button
      className={"month-cell" + (isToday ? " month-cell--today" : "") + (summary?.banked ? " month-cell--banked" : "")}
      onClick={onClick}
      title={
        summary
          ? `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} — ${fmtMinutes(minutes)} tracked, ${done} of ${tasks} tasks done`
          : d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      }
    >
      <span className="row row--between" style={{ gap: 3 }}>
        <span className="month-cell__num">{d.getDate()}</span>
        {summary?.banked && <Archive size={9} style={{ color: "var(--text-2)", flexShrink: 0 }} aria-label="Banked" />}
      </span>
      {/* The ring takes the whole middle of the cell and fits itself to
          whichever dimension runs out first, so it is large on a desk and
          still inside its square on a phone. */}
      {ringArcs?.length > 0 ? (
        <span className="month-cell__ring">
          <DayRing arcs={ringArcs} size={128} fill />
        </span>
      ) : (
        <>
          {timeRows.length > 0 && timeStrip(timeRows, { thin: true })}
          <span className="spacer" />
        </>
      )}
      {tasks > 0 && (
        <span className="month-cell__foot mono" style={{ color: done === tasks ? "var(--good-text)" : "var(--text-3)" }}>
          {done}/{tasks}
        </span>
      )}
      {tasks === 0 && minutes > 0 && (
        <span className="month-cell__foot mono">
          <span className="month-cell__long">{fmtMinutes(minutes)}</span>
          {/* A phone's cell has room for "11.5h", not "11h 30m". */}
          <span className="month-cell__short">{Number((minutes / 60).toFixed(1))}h</span>
        </span>
      )}
    </button>
  );
}
