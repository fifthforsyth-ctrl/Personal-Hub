import { useEffect, useState } from "react";
import { DoorOpen, Zap, ArrowLeft } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLoad } from "../../lib/useLoad";
import { friendlyError } from "../../lib/errors";
import { fetchOpenFocus, startFocus, endFocus, logFocusBreak, backToWork, fetchRecentFocusReasons } from "../../lib/api";
import { focusState, stopwatch, fmtFocusMinutes, reasonsByUse, PULL_REASONS, LEAVE_REASONS } from "../../lib/focusMode";
import { announceChange } from "../today/announce";
import "../../styles/focusmode.css";

// Focus mode on a running timer.
//
// A checkbox: while it's ticked you're in focus, and a stopwatch runs. It
// ends when you untick it or the timer stops (the database closes it then,
// wherever the timer was stopped from). While it runs, two buttons write
// down what breaks it:
//
//   Pulled away     a reason chip and you're back; the stopwatch keeps going
//   Leaving office  why, then the away clock runs until Back to work
//
// The chips put what you pick most first. A line is optional, never needed.
export default function FocusModeBox({ entry, compact = false }) {
  const { user } = useAuth();
  const { data, reload, mutate } = useLoad(() => fetchOpenFocus(entry.id), [entry.id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [asking, setAsking] = useState(null); // 'pulled' | 'left'
  const now = useSecondTick(Boolean(data?.span));

  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && reload();
    window.addEventListener("hub:changed", reload);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.removeEventListener("hub:changed", reload);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [reload]);

  const state = focusState(data?.span, data?.breaks, now);

  async function run(fn, fallback) {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (err) {
      setError(friendlyError(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    if (state.on) {
      const id = data.span.id;
      if (await run(() => endFocus(id), "Couldn't turn focus off. Try again.")) {
        mutate(null);
        setAsking(null);
        announceChange();
      }
    } else if (
      await run(async () => {
        const span = await startFocus(user.id, entry.id);
        mutate(span ? { span, breaks: [] } : null);
      }, "Couldn't turn focus on. Try again.")
    ) {
      announceChange();
    }
  }

  async function logBreak(kind, reason, note) {
    const ok = await run(async () => {
      const row = await logFocusBreak(user.id, data.span.id, { kind, reason, note });
      mutate((d) => d && { ...d, breaks: [...d.breaks, row] });
    }, kind === "left" ? "Couldn't mark you out. Try again." : "Couldn't save that. Try again.");
    if (ok) {
      setAsking(null);
      announceChange();
    }
  }

  async function back() {
    const id = state.away?.id;
    if (!id) return;
    const at = new Date().toISOString();
    if (await run(() => backToWork(id), "Couldn't mark you back. Try again.")) {
      mutate((d) => d && { ...d, breaks: d.breaks.map((b) => (b.id === id ? { ...b, ended_at: at } : b)) });
      announceChange();
    }
  }

  if (data === undefined) return null;

  return (
    <div className={"fm" + (state.on ? " fm--on" : "") + (state.away ? " fm--away" : "") + (compact ? " fm--compact" : "")}>
      <label className="fm-check">
        <input type="checkbox" checked={state.on} onChange={toggle} disabled={busy} />
        <span className="fm-check__box" aria-hidden="true" />
        <span className="fm-check__label">Focus mode</span>
        {!state.on && <span className="fm-check__hint">Full attention on this task until it ends</span>}
      </label>

      {state.on && !state.away && (
        <>
          <div className="fm-watch" aria-live="off">
            <span className="fm-watch__time mono">{stopwatch(state.since, now)}</span>
            <span className="fm-watch__sub">
              {fmtFocusMinutes(state.focusedMinutes)} focused
              {state.pulls > 0 && ` · ${state.pulls} ${state.pulls === 1 ? "pull" : "pulls"}`}
              {state.trips > 0 && ` · out ${state.trips}×`}
            </span>
          </div>
          {asking ? (
            <ReasonPicker kind={asking} userId={user.id} busy={busy} onPick={(r, note) => logBreak(asking, r, note)} onCancel={() => setAsking(null)} />
          ) : (
            <div className="fm-actions">
              <button type="button" className="btn" onClick={() => setAsking("pulled")} disabled={busy}>
                <Zap size={14} />
                Pulled away
              </button>
              <button type="button" className="btn" onClick={() => setAsking("left")} disabled={busy}>
                <DoorOpen size={14} />
                Leaving office
              </button>
            </div>
          )}
        </>
      )}

      {state.away && (
        <div className="fm-away">
          <div className="fm-away__label">Out of the office{state.away.reason ? ` · ${state.away.reason}` : ""}</div>
          <div className="fm-watch__time mono">{stopwatch(state.away.started_at, now)}</div>
          <div className="fm-watch__sub">Focus is paused until you're back. {fmtFocusMinutes(state.focusedMinutes)} focused so far.</div>
          <button type="button" className="btn btn--lg fm-back" onClick={back} disabled={busy}>
            <ArrowLeft size={15} />
            Back to work
          </button>
        </div>
      )}

      {error && <div className="form-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}

function ReasonPicker({ kind, userId, busy, onPick, onCancel }) {
  const defaults = kind === "left" ? LEAVE_REASONS : PULL_REASONS;
  const { data: used } = useLoad(() => fetchRecentFocusReasons(userId), [userId]);
  const chips = reasonsByUse(defaults, used?.[kind] ?? []);
  const [note, setNote] = useState("");
  const [other, setOther] = useState("");

  return (
    <div className="fm-ask" role="group" aria-label={kind === "left" ? "Why are you leaving?" : "What pulled you?"}>
      <div className="fm-ask__head">
        <span className="eyebrow">{kind === "left" ? "Why are you leaving?" : "What pulled you?"}</span>
        <button type="button" className="btn-link" onClick={onCancel}>Cancel</button>
      </div>
      <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="A line first, if you want" aria-label="A line about it" maxLength={1000} />
      <div className="fm-chips">
        {chips.map((r) => (
          <button key={r} type="button" className="name-chip" disabled={busy} onClick={() => onPick(r, note)}>
            {r}
          </button>
        ))}
      </div>
      <form
        className="fm-other"
        onSubmit={(e) => {
          e.preventDefault();
          if (other.trim()) onPick(other.trim(), note);
        }}
      >
        <input className="input" value={other} onChange={(e) => setOther(e.target.value)} placeholder="Something else" aria-label="Another reason" maxLength={80} />
        <button type="submit" className="btn btn--accent" disabled={busy || !other.trim()}>Save</button>
      </form>
    </div>
  );
}

// Every second while focus runs, so it reads like a stopwatch.
function useSecondTick(on) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!on) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [on]);
  return now;
}

