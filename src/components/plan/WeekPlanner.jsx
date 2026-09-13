import { useCallback, useEffect, useState } from "react";
import { CalendarRange, Sparkles, Plus, Trash2, Check, Lock, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchRangePlan,
  addCommitment,
  deleteTimeChunk,
  proposeWeek,
  applyWeekPlan,
  fetchIdealDays,
  idealDayFor,
} from "../../lib/api";
import { weekDays, parseDateStr, fmtTime } from "../../lib/planDates";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// The Sunday sitting.
//
// Two things are true of a week and not of a day. The commitments come
// first — they are promises to other people and everything else has to fit
// around them, so they are entered before anything is generated rather than
// corrected afterwards. And the blocks stay broad: this is the week at
// altitude, and the person planning Thursday morning on Thursday morning
// knows more than anyone does on Sunday night.
export default function WeekPlanner({ anchorDate, onCommitted }) {
  const { user } = useAuth();
  const days = weekDays(anchorDate);
  const weekStart = days[0];

  const [open, setOpen] = useState(false);
  const [commitments, setCommitments] = useState([]);
  const [ideals, setIdeals] = useState([]);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    try {
      const plan = await fetchRangePlan(user.id, days[0], days[6]);
      setCommitments((plan.chunks ?? []).filter((c) => c.source === "commitment"));
    } catch (err) {
      setError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, days[0]]);

  useEffect(() => {
    setResult(null);
    setCommitted(false);
    reload();
    if (user?.id) fetchIdealDays(user.id).then(setIdeals).catch(() => {});
  }, [reload, user?.id]);

  async function generate() {
    setLoading(true);
    setError(null);
    setCommitted(false);
    try {
      setResult(await proposeWeek({ weekStart, notes }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    setCommitting(true);
    setError(null);
    try {
      await applyWeekPlan(user.id, result.days);
      setCommitted(true);
      await reload();
      await onCommitted?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setCommitting(false);
    }
  }

  function patchBlock(dayIndex, blockIndex, fields) {
    setResult((r) => ({
      ...r,
      days: r.days.map((d, i) =>
        i === dayIndex ? { ...d, blocks: d.blocks.map((b, k) => (k === blockIndex ? { ...b, ...fields } : b)) } : d
      ),
    }));
  }

  function removeBlock(dayIndex, blockIndex) {
    setResult((r) => ({
      ...r,
      days: r.days.map((d, i) => (i === dayIndex ? { ...d, blocks: d.blocks.filter((_, k) => k !== blockIndex) } : d)),
    }));
  }

  function addBlock(dayIndex) {
    setResult((r) => ({
      ...r,
      days: r.days.map((d, i) => {
        if (i !== dayIndex) return d;
        const last = [...d.blocks].sort((a, b) => a.start.localeCompare(b.start)).at(-1);
        const start = last?.end || "08:00";
        return { ...d, blocks: [...d.blocks, { title: "", start, end: plusHour(start), source: "plan" }] };
      }),
    }));
  }

  if (!open) {
    return (
      <button className="card week-planner__open" onClick={() => setOpen(true)}>
        <span className="card-title"><CalendarRange size={14} />Plan this week</span>
        <span className="faint" style={{ fontSize: 12 }}>
          Put in what's already promised, then let the rest fall on your ideal days.
        </span>
      </button>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <span className="card-title"><CalendarRange size={14} />Plan this week</span>
        <button className="btn-link" onClick={() => setOpen(false)}>Close</button>
      </div>

      {!result && (
        <>
          <Commitments
            days={days}
            ideals={ideals}
            commitments={commitments}
            onAdd={async (fields) => {
              try {
                await addCommitment(user.id, fields);
                await reload();
              } catch (err) {
                setError(err.message);
              }
            }}
            onRemove={async (id) => {
              try {
                await deleteTimeChunk(id);
                await reload();
              } catch (err) {
                setError(err.message);
              }
            }}
          />

          <label className="field" style={{ marginTop: 14 }}>
            <span>Anything else about this week?</span>
            <textarea
              className="textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Parker needs the Hansen cut by Thursday. Fasting Sunday. Keep Wednesday light — long shoot Tuesday."
              style={{ minHeight: 66 }}
            />
          </label>

          {error && <div className="form-error" style={{ marginBottom: 10 }}>{error}</div>}

          <button className="btn btn--accent btn--block" onClick={generate} disabled={loading}>
            <Sparkles size={15} />
            {loading ? "Laying out the week…" : "Lay out the week"}
          </button>
        </>
      )}

      {result && (
        <>
          <p className="card-note" style={{ margin: "0 0 12px" }}>{result.strategy}</p>

          {committed ? (
            <div className="row" style={{ gap: 6, fontSize: 13, color: "var(--accent)", marginBottom: 10 }}>
              <Check size={15} />
              The week is planned. Open any day to break it down further.
            </div>
          ) : (
            <p className="faint" style={{ fontSize: 11.5, margin: "0 0 12px" }}>
              Change anything before you commit. Committing replaces generated blocks on these days; your commitments and
              any day you've already started working on are left alone.
            </p>
          )}

          {result.days.map((day, i) => (
            <PlannedDay
              key={day.date}
              day={day}
              onPatch={(k, fields) => patchBlock(i, k, fields)}
              onRemove={(k) => removeBlock(i, k)}
              onAdd={() => addBlock(i)}
            />
          ))}

          {error && <div className="form-error" style={{ margin: "10px 0" }}>{error}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn-secondary" onClick={generate} disabled={loading || committing}>
              <RefreshCw size={13} />
              Again
            </button>
            <button
              className="btn btn--accent"
              style={{ flex: 1 }}
              onClick={commit}
              disabled={committing || committed}
            >
              <Check size={15} />
              {committing ? "Committing…" : committed ? "Committed" : "Commit the week"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Promises first. Entered before anything is generated, because a week built
// around a commitment is a different week from one with a commitment dropped
// into it afterwards.
function Commitments({ days, ideals, commitments, onAdd, onRemove }) {
  const [date, setDate] = useState(days[0]);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");

  function submit() {
    if (!title.trim()) return;
    onAdd({ date, title, start, end });
    setTitle("");
  }

  return (
    <>
      <div className="section-label" style={{ marginBottom: 8 }}>What's already promised</div>

      {days.map((d) => {
        const mine = commitments.filter((c) => c.date === d).sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
        const ideal = idealDayFor(ideals, d);
        return (
          <div key={d} className="row" style={{ gap: 10, alignItems: "flex-start", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
            <span className="mono" style={{ fontSize: 11, width: 52, flexShrink: 0, color: "var(--text-muted)" }}>
              {DOW[parseDateStr(d).getDay()]} {parseDateStr(d).getDate()}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              {mine.length === 0 ? (
                <span className="faint" style={{ fontSize: 11.5 }}>
                  {ideal ? ideal.name : "nothing standing — the planner will use your recent weeks"}
                </span>
              ) : (
                mine.map((c) => (
                  <span key={c.id} className="row" style={{ gap: 6, alignItems: "center", padding: "1px 0" }}>
                    <span style={{ fontSize: 12.5, minWidth: 0 }}>{c.title}</span>
                    <span className="mono faint" style={{ fontSize: 10.5 }}>
                      {fmtTime(c.start_time)}–{fmtTime(c.end_time)}
                    </span>
                    <button className="btn-icon" onClick={() => onRemove(c.id)} title="Remove" style={{ color: "var(--text-3)" }}>
                      <Trash2 size={11} />
                    </button>
                  </span>
                ))
              )}
            </span>
          </div>
        );
      })}

      {/* Two rows rather than one: five controls on a line wrap into an
          unreadable staircase on anything narrower than a laptop. */}
      <div style={{ marginTop: 12 }}>
        <div className="row" style={{ gap: 6, alignItems: "center" }}>
          <select className="input" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 96, flexShrink: 0 }}>
            {days.map((d) => (
              <option key={d} value={d}>
                {DOW[parseDateStr(d).getDay()]} {parseDateStr(d).getDate()}
              </option>
            ))}
          </select>
          <input
            className="input"
            value={title}
            placeholder="What you've promised"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            style={{ flex: 1, minWidth: 0 }}
          />
        </div>
        <div className="row" style={{ gap: 6, alignItems: "center", marginTop: 6 }}>
          <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} style={{ width: 118, flexShrink: 0 }} />
          <span className="faint" style={{ fontSize: 12 }}>to</span>
          <input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={{ width: 118, flexShrink: 0 }} />
          <button className="btn-secondary" onClick={submit} disabled={!title.trim()} style={{ marginLeft: "auto", flexShrink: 0 }}>
            <Plus size={13} />
            Add
          </button>
        </div>
      </div>
    </>
  );
}

function PlannedDay({ day, onPatch, onRemove, onAdd }) {
  const [open, setOpen] = useState(false);
  const d = parseDateStr(day.date);

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r)", marginBottom: 6 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="row"
        style={{ gap: 8, width: "100%", background: "none", border: "none", color: "inherit", textAlign: "left", padding: "9px 11px", alignItems: "baseline" }}
      >
        {open ? <ChevronDown size={14} style={{ flexShrink: 0 }} /> : <ChevronRight size={14} style={{ flexShrink: 0 }} />}
        <span style={{ fontWeight: 620, fontSize: 13.5, flexShrink: 0 }}>
          {DOW[d.getDay()]} {d.getDate()}
        </span>
        <span className="muted truncate" style={{ fontSize: 12, flex: 1, minWidth: 0 }}>{day.note}</span>
        <span className="mono faint" style={{ fontSize: 10.5, flexShrink: 0 }}>{day.blocks.length}</span>
      </button>

      {open && (
        <div style={{ padding: "0 11px 11px" }}>
          {day.blocks.map((b, k) => {
            const locked = b.source === "commitment";
            return (
              <div key={k} className="row" style={{ gap: 6, alignItems: "center", marginBottom: 6 }}>
                {locked && <Lock size={11} style={{ flexShrink: 0, color: "var(--accent)" }} title="Promised — not moved" />}
                <input
                  className="input"
                  value={b.title}
                  onChange={(e) => onPatch(k, { title: e.target.value })}
                  disabled={locked}
                  style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}
                />
                <input
                  className="input"
                  type="time"
                  value={b.start}
                  onChange={(e) => onPatch(k, { start: e.target.value })}
                  disabled={locked}
                  style={{ width: 104 }}
                />
                <input
                  className="input"
                  type="time"
                  value={b.end}
                  onChange={(e) => onPatch(k, { end: e.target.value })}
                  disabled={locked}
                  style={{ width: 104 }}
                />
                {!locked && (
                  <button className="btn-icon" onClick={() => onRemove(k)} title="Remove" style={{ flexShrink: 0, color: "var(--text-3)" }}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}
          <button className="btn-link" onClick={onAdd} style={{ fontSize: 11.5 }}>
            <Plus size={11} />
            Block
          </button>
        </div>
      )}
    </div>
  );
}

function plusHour(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  const total = Math.min((h || 0) * 60 + (m || 0) + 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
