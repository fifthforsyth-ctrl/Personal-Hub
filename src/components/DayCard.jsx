import { Link } from "react-router-dom";
import { Archive } from "lucide-react";
import { colorFor, fmtMinutes } from "../lib/categories";
import { parseDateStr, todayStr, fmtTime } from "../lib/planDates";

// The repeated object. A day is a card everywhere in this app: full size on
// the day page, tiled across the week, shrunk to a square in the month grid.
// Same header, same colour strip, same completion language at every scale —
// so zooming out never means learning a new picture.

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
export function DayCard({ date, chunks = [], tasks = [], timeRows = [], banked = false, to, children }) {
  const d = parseDateStr(date);
  const isToday = date === todayStr();
  const top = tasks.filter((t) => !t.parent_task_id);
  const done = top.filter((t) => t.status).length;
  const minutes = timeRows.reduce((s, r) => s + Number(r.minutes || 0), 0);
  const isEmpty = chunks.length === 0 && top.length === 0 && minutes === 0;

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
          {banked && <Archive size={11} style={{ color: "var(--accent)" }} />}
          {top.length > 0 && (
            <span className="mono faint" style={{ fontSize: 10.5 }}>{done}/{top.length}</span>
          )}
        </span>
      </div>

      <div className="day-card__body">
        {timeRows.length > 0 && <div style={{ marginBottom: 8 }}>{timeStrip(timeRows, { thin: true })}</div>}

        {chunks.slice(0, 4).map((c) => {
          const own = tasks.filter((t) => t.time_chunk_id === c.id && !t.parent_task_id);
          const allDone = own.length > 0 && own.every((t) => t.status);
          return (
            <div key={c.id} className={"chunk" + (allDone ? " chunk--done" : "")}>
              <div className="chunk__title">{c.title}</div>
              <div className="chunk__time">
                {fmtTime(c.start_time)}
                {own.length > 0 ? ` · ${own.filter((t) => t.status).length}/${own.length}` : ""}
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

        {isEmpty && <div className="faint" style={{ fontSize: 11 }}>Nothing planned</div>}

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
export function MonthCell({ date, summary, timeRows = [], onClick }) {
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
          ? `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} — ${Math.round(minutes)}m tracked, ${done}/${tasks} tasks`
          : d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      }
    >
      <span className="row row--between" style={{ gap: 3 }}>
        <span className="month-cell__num">{d.getDate()}</span>
        {summary?.banked && <Archive size={9} style={{ color: "var(--accent)", flexShrink: 0 }} />}
      </span>
      {timeRows.length > 0 && timeStrip(timeRows, { thin: true })}
      <span className="spacer" />
      {tasks > 0 && (
        <span className="mono" style={{ fontSize: 9.5, color: done === tasks ? "var(--accent)" : "var(--text-3)" }}>
          {done}/{tasks}
        </span>
      )}
      {tasks === 0 && minutes > 0 && (
        <span className="mono" style={{ fontSize: 9.5, color: "var(--text-3)" }}>{fmtMinutes(minutes)}</span>
      )}
    </button>
  );
}
