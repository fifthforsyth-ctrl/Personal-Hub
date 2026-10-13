import { useEffect, useRef, useState } from "react";
import { CalendarRange, Sparkles, Plus, Trash2, Check, Lock, RefreshCw, ChevronDown, ChevronRight, Eraser, Scale } from "lucide-react";
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
import { useLoad } from "../../lib/useLoad";
import { friendlyError } from "../../lib/errors";
import { useToast, useConfirm } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import WeekTargets from "./WeekTargets";
import StandingBlocks from "./StandingBlocks";
import TargetDials from "./TargetDials";
import { weekDays, parseDateStr, fmtTimeRange, fmtShortDate, todayStr, startOfWeek, addDays } from "../../lib/planDates";
import "../../styles/plan.css";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

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
//
// A run takes minutes, so it is tied to the week it was started for: moving
// to another week drops it (and the page keeps ‹ › still while one runs),
// and a finished week has nothing left to plan, so it shows nothing.
export default function WeekPlanner({ anchorDate, onCommitted, onBusyChange }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const days = weekDays(anchorDate);
  const weekStart = days[0];
  const weekEnd = days[6];
  const today = todayStr();
  const thisWeek = startOfWeek(today);

  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState(null); // { week, strategy, days, partial }
  const [dirty, setDirty] = useState(false);
  const [running, setRunning] = useState(null); // { week, done, total, retrying }
  const [runError, setRunError] = useState(null);
  const [askedFor, setAskedFor] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [clearing, setClearing] = useState(false);

  // What the planner reads, loaded once it's opened.
  const ctx = useLoad(async () => {
    if (!open || !user?.id) return null;
    const [plan, targets, ideals, cats] = await Promise.all([
      fetchRangePlan(user.id, weekStart, weekEnd),
      fetchWeeklyTargets(weekStart),
      fetchIdealDays(),
      fetchCategories(user.id),
    ]);
    setCategoryColors(cats);
    return { plan, targets, ideals, cats };
  }, [open, user?.id, weekStart]);

  // Each run is numbered; an answer from any run but the latest — or one
  // that lands after the week changed or the page closed — is dropped.
  const runRef = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      runRef.current++;
    };
  }, []);

  useEffect(() => {
    runRef.current++;
    setRunning(null);
    setResult(null);
    setDirty(false);
    setRunError(null);
    setAskedFor(null);
    setCommitted(false);
  }, [weekStart]);

  const busy = Boolean(running) || committing;
  const busyRef = useRef(onBusyChange);
  busyRef.current = onBusyChange;
  useEffect(() => {
    busyRef.current?.(busy);
  }, [busy]);
  useEffect(() => () => busyRef.current?.(false), []);

  async function generate(overrides) {
    if (running) return;
    const run = ++runRef.current;
    const week = weekStart;
    const dates = days;
    const asked = notes;
    const stale = () => runRef.current !== run || !alive.current;

    setAskedFor(overrides?.length ? Object.fromEntries(overrides.map((o) => [o.label, o.weekly_minutes])) : null);
    setRunError(null);
    setCommitted(false);
    setRunning({ week, done: 0, total: dates.length, retrying: false });

    // Laid out a few days at a time. Seven days in one request runs past the
    // 150 seconds Supabase allows an Edge Function and dies as a 504 having
    // decided nothing; the budget is settled before any call, so slicing the
    // days costs the weekly totals nothing.
    // A slice that fails is split and retried day by day. A pass is slow at
    // random rather than because of anything about the days inside it, so the
    // second attempt on half the work usually lands — and a day that fails
    // even alone is the only day lost.
    async function layOut(slice) {
      try {
        return await proposeWeek({ weekStart: week, notes: asked, overrides, only: slice });
      } catch (err) {
        if (slice.length === 1 || stale()) throw err;
        setRunning((r) => (r && r.week === week ? { ...r, retrying: true } : r));
        const out = { days: [], strategy: "" };
        for (const day of slice) {
          const one = await layOut([day]);
          if (stale()) return out;
          out.days.push(...(one.days ?? []));
          if (!out.strategy && one.strategy) out.strategy = one.strategy;
        }
        return out;
      }
    }

    const gathered = [];
    let strategy = "";
    const sorted = () => [...gathered].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    try {
      for (let i = 0; i < dates.length; i += DAYS_PER_PASS) {
        const data = await layOut(dates.slice(i, i + DAYS_PER_PASS));
        if (stale()) return;
        // Only the days this run asked for, in case an answer strays.
        gathered.push(...(data.days ?? []).filter((d) => dates.includes(d.date)));
        if (!strategy && data.strategy) strategy = data.strategy;
        setRunning((r) => (r && r.week === week ? { ...r, done: gathered.length } : r));
      }
      setResult({ week, strategy, days: sorted() });
      setDirty(false);
    } catch (err) {
      if (stale()) return;
      // Days already laid out are worth keeping; the rest can be filled by
      // laying out again rather than starting the whole week over.
      if (gathered.length > 0) {
        setResult({ week, strategy, days: sorted(), partial: friendlyError(err, "The rest didn't come back in time.") });
        setDirty(false);
      } else {
        setRunError(friendlyError(err, "The planner didn't finish. Try again."));
      }
    } finally {
      if (!stale()) setRunning(null);
    }
  }

  // Asking again throws the draft away, so edits to it are asked about first.
  async function again(overrides) {
    if (
      dirty &&
      !(await confirm({
        title: "Lay out the week again?",
        body: "The changes you made to this draft will be lost.",
        confirmLabel: "Lay out again",
      }))
    ) {
      return;
    }
    generate(overrides);
  }

  // Throwing the proposal away and asking again is a different act from
  // asking again with the old one still on the calendar — without this, a
  // retry plans around its own previous answer.
  async function clearPlan(count) {
    if (clearing) return;
    const yes = await confirm({
      title: `Remove the ${plural(count, "planned block")}?`,
      body: `Only blocks the planner put on ${fmtShortDate(weekStart)}–${fmtShortDate(weekEnd)} with no tasks on them. Blocks you added yourself stay.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!yes) return;
    setClearing(true);
    try {
      const removed = await clearWeekPlan(weekStart);
      toast.show(removed === 0 ? "Nothing of the planner's was on this week" : `Removed ${plural(removed, "planned block")}`);
      setResult(null);
      setDirty(false);
      setCommitted(false);
      ctx.reload();
      onCommitted?.();
    } catch (err) {
      toast.error(err, "Couldn't remove the planned blocks.");
    } finally {
      setClearing(false);
    }
  }

  const shown = result?.week === weekStart ? result : null;

  async function commit() {
    if (committing || !shown) return;
    setCommitting(true);
    try {
      await applyWeekPlan(user.id, shown.days);
      if (!alive.current) return;
      setCommitted(true);
      setDirty(false);
      ctx.reload();
      onCommitted?.();
    } catch (err) {
      toast.error(err, "Couldn't save the whole week. Look over the days and commit again.");
    } finally {
      setCommitting(false);
    }
  }

  function edit(fn) {
    setDirty(true);
    setResult((r) => (r ? { ...r, days: fn(r.days) } : r));
  }
  const patchBlock = (dayIndex, blockIndex, fields) =>
    edit((ds) => ds.map((d, i) => (i === dayIndex ? { ...d, blocks: d.blocks.map((b, k) => (k === blockIndex ? { ...b, ...fields } : b)) } : d)));
  const removeBlock = (dayIndex, blockIndex) =>
    edit((ds) => ds.map((d, i) => (i === dayIndex ? { ...d, blocks: d.blocks.filter((_, k) => k !== blockIndex) } : d)));
  const addBlock = (dayIndex) =>
    edit((ds) =>
      ds.map((d, i) => {
        if (i !== dayIndex) return d;
        const last = [...d.blocks].sort((a, b) => a.start.localeCompare(b.start)).at(-1);
        const start = last?.end || "08:00";
        return { ...d, blocks: [...d.blocks, { title: "", start, end: plusHour(start), source: "plan" }] };
      })
    );

  // Nothing left to plan on a week that's over.
  if (weekEnd < today) return null;

  const title =
    weekStart === thisWeek
      ? "Plan this week"
      : weekStart === addDays(thisWeek, 7)
        ? "Plan next week"
        : `Plan the week of ${fmtShortDate(weekStart)}`;
  const progressText = running
    ? running.done > 0
      ? `Laid out ${running.done} of ${running.total} days${running.retrying ? " — retrying a slow one" : ""}…`
      : "Laying out the week…"
    : null;

  if (!open) {
    return (
      <button className="card week-planner__open" onClick={() => setOpen(true)}>
        <span className="card-title"><CalendarRange size={14} />{title}</span>
        <span className="faint" style={{ fontSize: 12 }}>
          {progressText ??
            (shown && !committed
              ? "A draft is waiting. Open it to look it over and commit it."
              : "Reads what's already on each day, then fills the rest from your ideal days.")}
        </span>
      </button>
    );
  }

  const scheduled = ctx.data?.plan.chunks ?? [];
  const targets = ctx.data?.targets ?? [];
  const ideals = ctx.data?.ideals ?? [];
  const categories = ctx.data?.cats ?? [];
  // Anything already on a day is fixed by definition, and worth showing
  // before you press generate so you can see what it is planning around.
  const fixed = scheduled.filter((c) => c.source !== "plan");
  const withTasks = new Set((ctx.data?.plan.tasks ?? []).map((t) => t.time_chunk_id).filter(Boolean));
  const removable = scheduled.filter((c) => c.source === "plan" && !withTasks.has(c.id)).length;

  return (
    <div className="card week-planner" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <span className="card-title"><CalendarRange size={14} />{title}</span>
        <button className="btn-link" style={{ minHeight: 36, padding: "0 6px", marginRight: -6 }} onClick={() => setOpen(false)}>Close</button>
      </div>

      {ctx.error && !ctx.data && <LoadError what="the week" error={ctx.error} onRetry={ctx.reload} />}
      {ctx.error && ctx.data && <LoadError stale error={ctx.error} onRetry={ctx.reload} />}
      {!ctx.data && !ctx.error && <p className="placeholder-note" style={{ margin: 0 }}>Reading the week…</p>}

      {ctx.data && !shown && (
        <>
          <div className="section-label" style={{ marginBottom: 8 }}>What it will work around</div>

          {days.map((d) => {
            const mine = fixed
              .filter((c) => c.date === d)
              .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
            const ideal = idealDayFor(ideals, d);
            return (
              <div key={d} className="planner-fixed">
                <span className="planner-fixed__day">
                  {DOW[parseDateStr(d).getDay()]} {parseDateStr(d).getDate()}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {mine.length === 0 ? (
                    <span className="faint" style={{ fontSize: 12 }}>
                      {ideal ? ideal.name : "nothing standing — it'll use your recent weeks"}
                    </span>
                  ) : (
                    mine.map((c) => (
                      <span key={c.id} className="planner-fixed__block">
                        <Lock size={10} style={{ flexShrink: 0, color: "var(--text-3)" }} aria-hidden="true" />
                        <span style={{ fontSize: 12.5, minWidth: 0 }}>{c.title}</span>
                        <span className="mono faint" style={{ fontSize: 10.5 }}>{fmtTimeRange(c.start_time, c.end_time)}</span>
                      </span>
                    ))
                  )}
                </span>
              </div>
            );
          })}

          <p className="faint" style={{ fontSize: 12, margin: "9px 0 0" }}>
            Anything you've already put on a day stays exactly where it is. Add more from the day itself.
          </p>

          <div style={{ marginTop: 16 }}>
            <StandingBlocks userId={user?.id} categories={categories} onChanged={ctx.reload} />
          </div>

          <TimeBudgets>
            <WeekTargets userId={user?.id} targets={targets} categories={categories} onChanged={ctx.reload} />
          </TimeBudgets>

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

          {runError && <div className="form-error" role="alert" style={{ marginBottom: 10 }}>{runError}</div>}

          <button className="btn btn--accent btn--block" onClick={() => generate()} disabled={busy}>
            <Sparkles size={15} />
            {progressText ?? "Lay out the week"}
          </button>

          {removable > 0 && (
            <button
              className="btn-link btn-link--danger"
              style={{ marginTop: 12, minHeight: 36 }}
              onClick={() => clearPlan(removable)}
              disabled={busy || clearing}
            >
              <Eraser size={12} />
              {clearing ? "Removing…" : `Remove the ${plural(removable, "planned block")}`}
            </button>
          )}
        </>
      )}

      {ctx.data && shown && (
        <>
          {shown.strategy && <p className="card-note" style={{ margin: "0 0 14px" }}>{shown.strategy}</p>}

          {shown.partial && (
            <div className="form-error" style={{ margin: "0 0 12px" }}>
              Stopped after {shown.days.length} of {days.length} days. {shown.partial} What's below is still worth
              committing; lay out again for the rest.
            </div>
          )}

          {targets.length > 0 && !committed && (
            <TimeBudgets>
              <TargetDials targets={targets} days={shown.days} goals={askedFor} onRebalance={again} busy={busy} />
            </TimeBudgets>
          )}

          {committed ? (
            <div className="row" style={{ gap: 6, fontSize: 13, color: "var(--good-text)", margin: "4px 0 12px" }}>
              <Check size={15} />
              The week is planned. Open any day to break it down further.
            </div>
          ) : (
            <p className="faint" style={{ fontSize: 12, margin: "4px 0 12px" }}>
              Change anything before you commit. Committing replaces only this planner's own earlier blocks — what you
              scheduled yourself, and any block that already has tasks, is left alone.
            </p>
          )}

          {shown.days.map((day, i) => (
            <PlannedDay
              key={day.date}
              day={day}
              onPatch={(k, fields) => patchBlock(i, k, fields)}
              onRemove={(k) => removeBlock(i, k)}
              onAdd={() => addBlock(i)}
            />
          ))}

          <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => again()} disabled={busy}>
              <RefreshCw size={13} />
              {progressText ?? "Lay out again"}
            </button>
            <button className="btn btn--accent" style={{ flex: "1 1 180px" }} onClick={commit} disabled={busy || committed}>
              <Check size={15} />
              {committing ? "Committing…" : committed ? "Committed" : "Commit the week"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Targets in minutes are for the planner to budget with — useful to it,
// not something to look at every Sunday — so they stay folded away.
function TimeBudgets({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="time-budgets">
      <button type="button" className="plan-card-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="section-label">
          <Scale size={12} />
          Time budgets (for the planner)
        </span>
        <span className="plan-card-toggle__hint">
          {open ? "Hide" : "Show"}
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {open && <div className="time-budgets__body">{children}</div>}
    </div>
  );
}

function PlannedDay({ day, onPatch, onRemove, onAdd }) {
  const [open, setOpen] = useState(false);
  const d = parseDateStr(day.date);

  return (
    <div className="planned-day">
      <button className="planned-day__head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? <ChevronDown size={14} style={{ flexShrink: 0 }} /> : <ChevronRight size={14} style={{ flexShrink: 0 }} />}
        <span style={{ fontWeight: 620, fontSize: 13.5, flexShrink: 0 }}>
          {DOW[d.getDay()]} {d.getDate()}
        </span>
        <span className="muted truncate" style={{ fontSize: 12, flex: 1, minWidth: 0 }}>{day.note}</span>
        <span className="mono faint" style={{ fontSize: 10.5, flexShrink: 0 }}>{plural(day.blocks.length, "block")}</span>
      </button>

      {open && (
        <div className="planned-day__body">
          {day.blocks.map((b, k) => {
            const locked = b.source !== "plan";
            return (
              <div key={k} className="planned-block">
                <span className="planned-block__name">
                  {locked && <Lock size={11} style={{ flexShrink: 0, color: "var(--text-3)" }} aria-label="Already on the day" />}
                  <span
                    title={b.category ?? "no category"}
                    className="planned-block__dot"
                    style={{ background: b.category ? colorFor(b.category) : "var(--line-strong)" }}
                  />
                  <input
                    className="input"
                    value={b.title}
                    onChange={(e) => onPatch(k, { title: e.target.value })}
                    disabled={locked}
                    aria-label="Block title"
                    placeholder="What"
                  />
                </span>
                <span className="planned-block__times">
                  <input
                    className="input time-input"
                    type="time"
                    value={b.start}
                    onChange={(e) => onPatch(k, { start: e.target.value })}
                    disabled={locked}
                    aria-label="Starts"
                  />
                  <input
                    className="input time-input"
                    type="time"
                    value={b.end}
                    onChange={(e) => onPatch(k, { end: e.target.value })}
                    disabled={locked}
                    aria-label="Ends"
                  />
                  {locked ? (
                    <span className="planned-block__spacer" />
                  ) : (
                    <button className="btn-icon" onClick={() => onRemove(k)} aria-label={`Remove ${b.title || "this block"} from the draft`} title="Remove from the draft">
                      <Trash2 size={14} />
                    </button>
                  )}
                </span>
              </div>
            );
          })}
          <button className="btn-link" onClick={onAdd} style={{ minHeight: 36 }}>
            <Plus size={12} />
            Add a block
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
