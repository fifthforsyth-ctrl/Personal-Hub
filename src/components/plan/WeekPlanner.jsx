import { useCallback, useEffect, useState } from "react";
import { CalendarRange, Sparkles, Plus, Trash2, Check, Lock, RefreshCw, ChevronDown, ChevronRight, Eraser } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchRangePlan,
  proposeWeek,
  applyWeekPlan,
  fetchIdealDays,
  idealDayFor,
  fetchWeeklyTargets,
  fetchCategories,
  clearWeekPlan,
} from "../../lib/api";
import { setCategoryColors, colorFor } from "../../lib/categories";
import WeekTargets from "./WeekTargets";
import TargetDials from "./TargetDials";
import { weekDays, parseDateStr, fmtTime } from "../../lib/planDates";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Two days a request, and one day if that fails.
//
// The time a pass takes is not stable. Twelve identically-sized three-day
// passes came back in 14, 18, 27, 28, 29, 42, 47, 67, 69, 70, 99 and 150
// seconds — a tenfold spread on the same work, against a 150-second wall.
// Tuning the average is the wrong answer to that; what matters is surviving
// a bad draw. So the slices are small enough that the usual pass is quick,
// and a slice that fails is retried a day at a time rather than costing the
// rest of the week.
const DAYS_PER_PASS = 2;

// The Sunday sitting.
//
// It does not ask what you have on this week — it reads the calendar. Every
// block already sitting on a day IS a commitment, whatever put it there, and
// asking you to re-enter them would be asking you to maintain the same list
// twice. What you actually have to supply is the part no record holds: the
// things that have not happened yet and are not on anything.
//
// The blocks it produces stay broad. This is the week at altitude, and the
// person planning Thursday morning on Thursday morning knows more about
// Thursday than anyone does on Sunday night.
export default function WeekPlanner({ anchorDate, onCommitted }) {
  const { user } = useAuth();
  const days = weekDays(anchorDate);
  const weekStart = days[0];

  const [open, setOpen] = useState(false);
  const [scheduled, setScheduled] = useState([]);
  const [ideals, setIdeals] = useState([]);
  const [targets, setTargets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cleared, setCleared] = useState(null);
  const [progress, setProgress] = useState(null);
  const [askedFor, setAskedFor] = useState(null);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [plan, tg] = await Promise.all([
        fetchRangePlan(user.id, days[0], days[6]),
        fetchWeeklyTargets(days[0]).catch(() => []),
      ]);
      setScheduled(plan.chunks ?? []);
      setTargets(tg);
    } catch (err) {
      setError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, days[0]]);

  useEffect(() => {
    setResult(null);
    setCommitted(false);
    setCleared(null);
    reload();
    if (user?.id) {
      fetchIdealDays(user.id).then(setIdeals).catch(() => {});
      fetchCategories(user.id)
        .then((cats) => {
          setCategoryColors(cats);
          setCategories(cats);
        })
        .catch(() => {});
    }
  }, [reload, user?.id]);

  // Laid out a few days at a time. Seven days in one request runs past the
  // 150 seconds Supabase allows an Edge Function and dies as a 504 having
  // decided nothing; the budget is settled before any call, so slicing the
  // days costs the weekly totals nothing.
  // A slice that fails is split and retried day by day. A pass is slow at
  // random rather than because of anything about the days inside it, so the
  // second attempt on half the work usually lands — and a day that fails
  // even alone is the only day lost.
  async function layOut(slice, overrides) {
    try {
      return await proposeWeek({ weekStart, notes, overrides, only: slice });
    } catch (err) {
      if (slice.length === 1) throw err;
      setProgress((p) => (p ? { ...p, retrying: true } : p));
      const out = { days: [], strategy: "" };
      for (const day of slice) {
        const one = await layOut([day], overrides);
        out.days.push(...(one.days ?? []));
        if (!out.strategy && one.strategy) out.strategy = one.strategy;
      }
      return out;
    }
  }

  async function generate(overrides) {
    setAskedFor(overrides?.length ? Object.fromEntries(overrides.map((o) => [o.label, o.weekly_minutes])) : null);
    setLoading(true);
    setError(null);
    setCommitted(false);
    setProgress({ done: 0, total: days.length, retrying: false });

    const gathered = [];
    let strategy = "";

    try {
      for (let i = 0; i < days.length; i += DAYS_PER_PASS) {
        const slice = days.slice(i, i + DAYS_PER_PASS);
        const data = await layOut(slice, overrides);
        gathered.push(...(data.days ?? []));
        if (!strategy && data.strategy) strategy = data.strategy;
        setProgress((p) => ({ done: gathered.length, total: days.length, retrying: p?.retrying ?? false }));
      }
      gathered.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      setResult({ strategy, week_start: weekStart, days: gathered });
    } catch (err) {
      // Days already laid out are worth keeping; the rest can be filled by
      // pressing again rather than starting the whole week over.
      if (gathered.length > 0) {
        gathered.sort((a, b) => String(a.date).localeCompare(String(b.date)));
        setResult({ strategy, week_start: weekStart, days: gathered, partial: err.message });
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  // Throwing the proposal away and asking again is a different act from
  // asking again with the old one still on the calendar — without this, a
  // retry plans around its own previous answer.
  async function clearPlan() {
    setError(null);
    try {
      const removed = await clearWeekPlan(weekStart);
      setCleared(removed);
      setResult(null);
      setCommitted(false);
      await reload();
      await onCommitted?.();
    } catch (err) {
      setError(err.message);
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
          Reads what's already on each day, then fills the rest from your ideal days.
        </span>
      </button>
    );
  }

  // Anything already on a day is fixed by definition, and worth showing
  // before you press generate so you can see what it is planning around.
  const fixed = scheduled.filter((c) => c.source !== "plan");
  const planned = scheduled.length - fixed.length;

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <span className="card-title"><CalendarRange size={14} />Plan this week</span>
        <button className="btn-link" onClick={() => setOpen(false)}>Close</button>
      </div>

      {!result && (
        <>
          <div className="section-label" style={{ marginBottom: 8 }}>What it will work around</div>

          {days.map((d) => {
            const mine = fixed
              .filter((c) => c.date === d)
              .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
            const ideal = idealDayFor(ideals, d);
            return (
              <div
                key={d}
                className="row"
                style={{ gap: 10, alignItems: "flex-start", padding: "5px 0", borderBottom: "1px solid var(--border)" }}
              >
                <span className="mono" style={{ fontSize: 11, width: 52, flexShrink: 0, color: "var(--text-muted)" }}>
                  {DOW[parseDateStr(d).getDay()]} {parseDateStr(d).getDate()}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {mine.length === 0 ? (
                    <span className="faint" style={{ fontSize: 11.5 }}>
                      {ideal ? ideal.name : "nothing standing — it'll use your recent weeks"}
                    </span>
                  ) : (
                    mine.map((c) => (
                      <span key={c.id} className="row" style={{ gap: 6, alignItems: "center", padding: "1px 0" }}>
                        <Lock size={10} style={{ flexShrink: 0, color: "var(--accent)" }} />
                        <span style={{ fontSize: 12.5, minWidth: 0 }}>{c.title}</span>
                        <span className="mono faint" style={{ fontSize: 10.5 }}>
                          {fmtTime(c.start_time)}–{fmtTime(c.end_time)}
                        </span>
                      </span>
                    ))
                  )}
                </span>
              </div>
            );
          })}

          <p className="faint" style={{ fontSize: 11.5, margin: "9px 0 0" }}>
            Anything you've already put on a day stays exactly where it is. Add more from the day itself.
          </p>

          <div style={{ marginTop: 16 }}>
            <WeekTargets userId={user?.id} targets={targets} categories={categories} onChanged={reload} />
          </div>

          <label className="field" style={{ marginTop: 14 }}>
            <span>Anything about this week it can't see?</span>
            <textarea
              className="textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Parker needs the Hansen cut by Thursday. Fasting Sunday. Keep Wednesday light — long shoot Tuesday. Zone conference some time midweek, day not fixed yet."
              style={{ minHeight: 76 }}
            />
          </label>

          {error && <div className="form-error" style={{ marginBottom: 10 }}>{error}</div>}

          {cleared !== null && (
            <p className="faint" style={{ fontSize: 11.5, margin: "0 0 10px" }}>
              {cleared === 0
                ? "Nothing of the planner's was on this week."
                : `Cleared ${cleared} planned ${cleared === 1 ? "block" : "blocks"}. Everything you scheduled yourself is still there.`}
            </p>
          )}

          <button className="btn btn--accent btn--block" onClick={() => generate()} disabled={loading}>
            <Sparkles size={15} />
            {loading
              ? progress?.done > 0
                ? `Laid out ${progress.done} of ${progress.total} days${progress.retrying ? " — retrying a slow one" : ""}…`
                : "Laying out the week…"
              : "Lay out the week"}
          </button>

          {planned > 0 && (
            <button className="btn-link" style={{ marginTop: 10 }} onClick={clearPlan}>
              <Eraser size={12} />
              Clear the {planned} block{planned === 1 ? "" : "s"} this planner put on the week
            </button>
          )}
        </>
      )}

      {result && (
        <>
          <p className="card-note" style={{ margin: "0 0 14px" }}>{result.strategy}</p>

          {result.partial && (
            <div className="form-error" style={{ margin: "0 0 12px" }}>
              Stopped after {result.days.length} of {days.length} days — {result.partial} What's below is still worth
              committing; press Again for the rest.
            </div>
          )}

          {targets.length > 0 && !committed && (
            <TargetDials
              targets={targets}
              days={result.days}
              goals={askedFor}
              onRebalance={generate}
              busy={loading}
            />
          )}

          {committed ? (
            <div className="row" style={{ gap: 6, fontSize: 13, color: "var(--accent)", marginBottom: 10 }}>
              <Check size={15} />
              The week is planned. Open any day to break it down further.
            </div>
          ) : (
            <p className="faint" style={{ fontSize: 11.5, margin: "0 0 12px" }}>
              Change anything before you commit. Committing replaces only this planner's own earlier blocks — what you
              scheduled yourself, and any day already being worked on, is left alone.
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
            <button className="btn-secondary" onClick={() => generate()} disabled={loading || committing}>
              <RefreshCw size={13} />
              Again
            </button>
            <button className="btn btn--accent" style={{ flex: 1 }} onClick={commit} disabled={committing || committed}>
              <Check size={15} />
              {committing ? "Committing…" : committed ? "Committed" : "Commit the week"}
            </button>
          </div>
        </>
      )}
    </div>
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
            const locked = b.source !== "plan";
            return (
              <div key={k} className="row" style={{ gap: 6, alignItems: "center", marginBottom: 6 }}>
                {locked && <Lock size={11} style={{ flexShrink: 0, color: "var(--accent)" }} />}
                <span
                  title={b.category ?? "no category"}
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 3,
                    flexShrink: 0,
                    background: b.category ? colorFor(b.category) : "var(--line-strong)",
                  }}
                />
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
