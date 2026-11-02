import { useEffect, useMemo, useState } from "react";
import { ListChecks, NotebookPen } from "lucide-react";
import { fetchTaskReasons } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { colorFor } from "../../lib/categories";
import { fmtTimeRange } from "../../lib/planDates";
import { planForToday, applyOverrides } from "../../lib/todayPlan";
import { reasonChips, TASK_REASONS } from "../../lib/honest";
import { usePlanTicks } from "../today/usePlanTicks";
import LoadError from "../ui/LoadError";
import "../../styles/honest.css";
import "../../styles/daily.css";

// What got done: everything that was on the day, ready to tick (Aaron,
// 2026-11-02): "I need an option to mark any tasks as done. Sometimes i do
// them but forget to mark them."
//
// Every task you planned for the day and everything you picked for it on
// Quests, block by block the way the day ran (src/lib/todayPlan.js decides
// which block takes what), then what was in no block, then each quest's.
// Any of them can be ticked done here, or unticked, and a tick saves the
// same way it does on Today's plan (usePlanTicks): straight away, shown
// before it's saved, and held until it's read back. Ticking a task done
// also clears why it was left, since it wasn't.
//
// A planned task still open asks why, with the same chips the evening has
// always asked with ("Ran out of time", "Forgot", your own words). Once one
// is picked the row folds to it; a tap opens the chips again, and tapping
// the chosen one takes it back. The reason stays on the task's own day:
// nothing moves to tomorrow. Quest work has no reason to give; an open step
// is simply still open on its camp.
//
// Example rows from setup are left out. A day with nothing on it shows no
// card at all.
//
//   tasks     the day's tasks as the evening loaded them, shown while this
//             card reads its own (with the quest work) a moment later
//   chunks    the day's blocks
//   flushRef  set to an async () => void that waits for every tick still on
//             its way, so the summary banking writes reads them

// Every block is behind you by now, so each one shows whole.
const ALL_PAST = 2 * 24 * 60;

export default function EveningTasks({ userId, date, chunks, tasks, flushRef }) {
  const { data, error, reload, overrides, toggle, setReason, settle } = usePlanTicks(userId, date, { clearReason: true });
  const { data: pastReasons } = useLoad(
    () =>
      fetchTaskReasons(userId).catch((err) => {
        console.warn(err);
        return [];
      }),
    [userId]
  );

  useEffect(() => {
    if (!flushRef) return undefined;
    flushRef.current = settle;
    return () => {
      flushRef.current = null;
    };
  }, [flushRef, settle]);

  // What the evening loaded stands in until this card's own load lands.
  const base = useMemo(() => data ?? (tasks ? { tasks, work: null, startedAt: null } : null), [data, tasks]);
  const shown = useMemo(() => applyOverrides(base, overrides).data, [base, overrides]);
  const rows = useMemo(() => (shown?.tasks ?? []).filter((t) => !t.is_example), [shown]);
  const plan = useMemo(
    () => planForToday({ chunks: (chunks ?? []).filter((c) => !c.is_example), tasks: rows, questWork: shown?.work ?? null, nowMin: ALL_PAST, date }),
    [chunks, rows, shown, date]
  );
  const taskById = useMemo(() => new Map(rows.map((t) => [t.id, t])), [rows]);
  const chips = reasonChips(pastReasons, 7, TASK_REASONS);

  if (!base) return error ? <LoadError what="the day's tasks" error={error} onRetry={reload} className="evening-tasks__error" /> : null;
  if (plan.total === 0) return null;

  const groups = [
    ...plan.blocks
      .filter((b) => b.items.length > 0)
      .map((b) => ({ key: b.id, title: b.title || "Untitled block", time: fmtTimeRange(b.start_time, b.end_time), color: b.category ? colorFor(b.category) : null, items: b.items, done: b.done, total: b.total })),
    ...(plan.loose.planned.length ? [{ key: "loose", title: "Not in a block", items: plan.loose.planned }] : []),
    ...plan.loose.quests.map((g) => ({ key: `quest:${g.questId ?? "none"}`, title: g.title, items: g.items, hideFrom: g.title })),
  ];

  return (
    <div className="card evening-tasks">
      <div className="card-head" style={{ marginBottom: 4 }}>
        <span className="card-title">
          <ListChecks size={14} />
          What got done
        </span>
        <span className="evening-tasks__count">
          {plan.done} of {plan.total} done
        </span>
      </div>
      <p className="card-note" style={{ marginBottom: 6 }}>
        Tick anything you did and didn't mark. Anything still open can say why.
      </p>

      {error && <LoadError what="the day's quest work" error={error} onRetry={reload} stale className="evening-tasks__error" />}

      {groups.map((g) => (
        <section key={g.key} className="evening-tasks__group">
          <div className="evening-tasks__head">
            {g.color && <span className="dot" style={{ background: g.color }} />}
            <span className="evening-tasks__title truncate">{g.title}</span>
            {g.time && <span className="evening-tasks__time mono">{g.time}</span>}
          </div>
          <ul className="plan-blocks__items">
            {g.items.map((item) => (
              <Row
                key={`${item.kind}:${item.id}`}
                item={item}
                hideFrom={g.hideFrom}
                task={item.kind === "task" ? taskById.get(item.id) : null}
                chips={chips}
                onToggle={toggle}
                onReason={setReason}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// One thing on the day: a box to tick, its words, where it's from on
// Quests, what's under it, and for a planned task still open, why. A note
// from Quests with tasks under it is a small label over them, no box.
function Row({ item, hideFrom, task, chips, onToggle, onReason, sub = false }) {
  const [asking, setAsking] = useState(false);
  const from = item.from && item.from !== hideFrom ? item.from : null;
  const subs = item.subs.length > 0 && (
    <ul className="plan-item__subs">
      {item.subs.map((s) => (
        <Row key={`${s.kind}:${s.id}`} item={s} hideFrom={hideFrom} task={null} chips={chips} onToggle={onToggle} onReason={onReason} sub />
      ))}
    </ul>
  );

  if (item.heading) {
    return (
      <li className="plan-item plan-item--heading">
        <div className="plan-item__row">
          <span className="plan-item__pen" aria-hidden="true">
            <NotebookPen size={13} />
          </span>
          <div className="plan-item__main">
            <span className="plan-item__label">{item.title}</span>
            {from && <span className="plan-item__from">{from}</span>}
          </div>
        </div>
        {subs}
      </li>
    );
  }

  // Only a planned task of its own (not one under another) gives a reason:
  // a sub-task goes with the task it's under.
  const reason = task?.left_reason ?? null;
  const asks = Boolean(task) && !sub && !item.done;
  const open = asks && (!reason || asking);

  return (
    <li className={"plan-item" + (item.done ? " is-done" : "")}>
      <div className="plan-item__row">
        {/* The tick plays its own feel, so the plain tap is skipped here. */}
        <label className="plan-item__check" data-haptic-skip="">
          <input
            type="checkbox"
            checked={item.done}
            onChange={() => onToggle(item)}
            aria-label={item.done ? `Mark “${item.title}” not done` : `Mark “${item.title}” done`}
          />
        </label>
        <div className="plan-item__main">
          <span className="plan-item__title">{item.title}</span>
          {from && <span className="plan-item__from">{from}</span>}
          {asks && reason && !asking && (
            <button type="button" className="evening-tasks__why" onClick={() => setAsking(true)} aria-label={`Why “${item.title}” was left: ${reason}. Change it`}>
              Left: {reason}
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="evening-tasks__reasons">
          <Chips
            options={chips}
            value={reason}
            onPick={(v) => {
              setAsking(false);
              onReason(item.id, reason && v && reason.toLowerCase() === v.toLowerCase() ? null : v);
            }}
            label={`Why “${item.title}” was left undone`}
            max={80}
          />
        </div>
      )}
      {subs}
    </li>
  );
}

// One of a few chips, or your own words. Tapping the chosen one takes it
// back.
function Chips({ options, value, onPick, label, max = 60 }) {
  const [adding, setAdding] = useState(false);
  const all = [...options, ...(value && !options.some((o) => o.toLowerCase() === value.toLowerCase()) ? [value] : [])];
  return (
    <div className="honest-chips" role="group" aria-label={label}>
      {all.map((o) => {
        const on = value?.toLowerCase() === o.toLowerCase();
        return (
          <button key={o} type="button" className={"name-chip" + (on ? " name-chip--on" : "")} aria-pressed={on} onClick={() => onPick(o)}>
            {o}
          </button>
        );
      })}
      {adding ? (
        <form
          className="honest-add"
          onSubmit={(e) => {
            e.preventDefault();
            const t = e.currentTarget.elements.own.value.trim();
            if (t) onPick(t.slice(0, max));
            setAdding(false);
          }}
        >
          <input name="own" className="input" placeholder="In a few words" aria-label={label} maxLength={max} autoFocus />
          <button type="submit" className="btn btn--sm">
            Add
          </button>
        </form>
      ) : (
        <button type="button" className="name-chip name-chip--add" onClick={() => setAdding(true)}>
          Other…
        </button>
      )}
    </div>
  );
}
