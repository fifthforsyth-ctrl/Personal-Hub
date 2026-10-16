import { useCallback, useEffect, useMemo, useState } from "react";
import { Moon, X } from "lucide-react";
import { fetchOvernightTimers, fixOvernightTimer, keepOvernightTimers } from "../../lib/api";
import { useToast } from "../ui/Feedback";
import { planOvernightFix, withSleepFrom, overnightProblem, usualLightsOut, resolveTimeAfter, hhmm, isSleep, tagsOf } from "../../lib/honest";
import { timeOf } from "./minutes";
import { announceChange } from "./announce";
import "../../styles/honest.css";

// Old timers that ran through the night, offered once.
//
// Before the runaway card, a timer left going at bedtime ran on until
// morning. This lists them with the likeliest fix for each, worked out from
// the rest of the record: one tap fixes them all, any one can be left as it
// is, and a row's sleep time can be moved. Each choice waits out the Undo
// before it's saved, and once the list is empty the card doesn't come back.

const nameOf = (entry) => (isSleep(entry) ? "Sleep" : entry.description || tagsOf(entry).join(" · "));
const dayOf = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const shortDay = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function OldRunaways({ userId }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(() => new Set()); // fixed or left, waiting out the Undo
  const [moved, setMoved] = useState({}); // id → "HH:MM" where a row's sleep time was changed

  const load = useCallback(() => {
    if (!userId) return;
    fetchOvernightTimers(userId)
      .then(setData)
      .catch((err) => console.warn(err)); // only an offer: Today is fine without it
  }, [userId]);
  useEffect(load, [load]);

  const plans = useMemo(() => {
    if (!data) return [];
    const usual = usualLightsOut(data.sleeps);
    return data.timers.map((timer) => {
      const plan = planOvernightFix(timer, data.others, usual);
      const clock = moved[timer.id];
      return clock && plan.kind === "asleep" ? withSleepFrom(plan, resolveTimeAfter(timer.started_at, clock)) : plan;
    });
  }, [data, moved]);

  const shown = plans.filter((p) => !hidden.has(p.entry.id));
  if (shown.length === 0) return null;
  const ready = shown.filter((p) => !overnightProblem(p));

  const hide = (ids) => setHidden((h) => new Set([...h, ...ids]));
  const unhide = (ids) =>
    setHidden((h) => {
      const next = new Set(h);
      ids.forEach((id) => next.delete(id));
      return next;
    });

  function fix(list) {
    const ids = list.map((p) => p.entry.id);
    hide(ids);
    toast.undoable({
      message: list.length === 1 ? "Timer fixed" : `Fixed ${list.length} timers`,
      run: async () => {
        try {
          for (const p of list) {
            await fixOvernightTimer({ id: p.entry.id, end: p.end, sleepFrom: p.sleepFrom, sleepUntil: p.sleepUntil });
          }
        } finally {
          // Whatever went through is gone from the list for good; anything
          // that didn't comes back with the Undo.
          announceChange();
          load();
        }
      },
      onUndo: () => unhide(ids),
    });
  }

  function leave(list) {
    const ids = list.map((p) => p.entry.id);
    hide(ids);
    toast.undoable({
      message: list.length === 1 ? "Left as it was" : `Left all ${list.length} as they were`,
      run: () => keepOvernightTimers(ids),
      onUndo: () => unhide(ids),
    });
  }

  const one = shown.length === 1;
  const first = shown[0].entry;
  const last = shown[shown.length - 1].entry;

  return (
    <div className="card runaway overnight">
      <div className="card-head" style={{ marginBottom: 8 }}>
        <span className="card-title">
          <Moon size={14} />
          {one ? "An old timer ran through the night" : "Old timers that ran through the night"}
        </span>
      </div>
      <p className="runaway__text">
        {one ? (
          <>
            <strong>{nameOf(first)}</strong> kept running while you slept, on {dayOf(first.started_at)}.
          </>
        ) : (
          <>
            <strong>{shown.length} old timers</strong> kept running while you slept, between {shortDay(first.started_at)} and {shortDay(last.started_at)}.
          </>
        )}{" "}
        Fixing ends {one ? "it" : "each one"} where it most likely stopped and adds the missing sleep.
      </p>

      {(open || one) && (
        <ul className="overnight__list">
          {shown.map((p) => (
            <Row
              key={p.entry.id}
              plan={p}
              onMove={(clock) =>
                setMoved((m) => {
                  const next = { ...m };
                  if (clock) next[p.entry.id] = clock;
                  else delete next[p.entry.id];
                  return next;
                })
              }
              onLeave={one ? null : () => leave([p])}
              named={!one}
            />
          ))}
        </ul>
      )}

      <div className="runaway__actions">
        <button type="button" className="btn btn--accent" onClick={() => fix(ready)} disabled={ready.length === 0}>
          {one ? "Fix it" : ready.length === shown.length ? `Fix all ${shown.length}` : `Fix ${ready.length}`}
        </button>
        {!one && (
          <button type="button" className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? "Hide the list" : "See each one"}
          </button>
        )}
        <button type="button" className="btn-link runaway__keep" onClick={() => leave(shown)}>
          {one ? "Leave it" : "Leave them"}
        </button>
      </div>
    </div>
  );
}

// `named` is off when the row is the only one: the card has just said whose it is.
function Row({ plan, onMove, onLeave, named }) {
  const { entry } = plan;
  const name = nameOf(entry);
  const problem = overnightProblem(plan);

  return (
    <li className="overnight__row">
      {named && (
        <div className="overnight__head">
          <span className="overnight__name">{name}</span>
          <span className="overnight__day">{dayOf(entry.started_at)}</span>
          {onLeave && (
            <button type="button" className="btn-icon overnight__leave" onClick={onLeave} aria-label={`Leave ${name} as it is`} title="Leave this one as it is">
              <X size={14} />
            </button>
          )}
        </div>
      )}
      <div className="overnight__ran">
        Ran {timeOf(entry.started_at)} to {timeOf(entry.ended_at)}
      </div>

      {plan.kind === "alongside" ? (
        <div className="overnight__fix">
          Ends at {timeOf(plan.end.toISOString())}, when {nameOf(plan.endedFor)} began
        </div>
      ) : (
        <>
          <label className="overnight__fix">
            <span>Asleep from</span>
            <input
              className="input"
              type="time"
              value={hhmm(plan.sleepFrom)}
              onChange={(e) => onMove(e.target.value || null)}
              aria-label={`When you fell asleep, ${dayOf(entry.started_at)}`}
            />
            <span>
              until {timeOf(plan.sleepUntil.toISOString())}
              {plan.wokeFor && <span className="overnight__why">, when {nameOf(plan.wokeFor)} began</span>}
            </span>
          </label>
          {plan.endedFor && (
            <div className="overnight__note">
              {name} ends at {timeOf(plan.end.toISOString())}, when {nameOf(plan.endedFor)} began.
            </div>
          )}
        </>
      )}
      {problem && <div className="form-error overnight__problem">{problem}</div>}
    </li>
  );
}
