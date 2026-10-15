import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { fetchBodyMetrics, saveBodyMetric } from "../../lib/api";
import { friendlyError } from "../../lib/errors";
import { weightChange } from "../../lib/honest";
import { toDateStr } from "../../lib/planDates";
import { announceChange } from "./announce";
import "../../styles/honest.css";

// "Weigh myself" offers the number right where the win was logged. The last
// reading is filled in and selected, so the same weight is one tap on Save
// and a new one replaces it as you type. Once saved it says, plainly, how it
// compares with last time, then folds away. Skipping is fine: the win
// counts either way.

const SHOW_MS = 6000;

export function fmtWeight(n) {
  return String(Math.round(Number(n) * 10) / 10);
}

// "down 1.2 lb since Oct 8", "up 0.4 lb since earlier today", "the same as
// Oct 8", or nothing for a first reading.
export function changeText(change) {
  if (!change) return "";
  const since = toDateStr(new Date(change.since)) === toDateStr(new Date()) ? "earlier today" : shortDate(change.since);
  if (change.diff === 0) return `the same as ${since}`;
  return `${change.diff < 0 ? "down" : "up"} ${fmtWeight(Math.abs(change.diff))} lb since ${since}`;
}

function shortDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function WeighIn({ userId, onDone, large = false }) {
  const [last, setLast] = useState(null);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const typed = useRef(false);
  const doneTimer = useRef(null);

  useEffect(() => {
    let live = true;
    fetchBodyMetrics(userId, { limit: 1 }).then(
      (rows) => {
        if (!live) return;
        setLast(rows[0] ?? null);
        if (rows[0] && !typed.current) setValue(fmtWeight(rows[0].value));
      },
      (err) => console.warn(err)
    );
    return () => {
      live = false;
      clearTimeout(doneTimer.current);
    };
  }, [userId]);

  const n = parseFloat(value.replace(",", "."));

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    if (!(n > 0)) {
      onDone();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveBodyMetric(userId, { kind: "weight", value: n, unit: "lb" });
      announceChange();
      setSaved({ value: n, change: weightChange(last ? [last] : [], n) });
      doneTimer.current = setTimeout(onDone, SHOW_MS);
    } catch (err) {
      setError(friendlyError(err, "Couldn't save your weight. Try again."));
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    const said = changeText(saved.change);
    return (
      <p className="weigh-in__done" role="status">
        <Check size={14} className="weigh-in__mark" />
        <span>
          {fmtWeight(saved.value)} lb{said ? ` · ${said}` : ""}
        </span>
      </p>
    );
  }

  return (
    <form className={"win-name weigh-in" + (large ? " weigh-in--large" : "")} onSubmit={save}>
      <div className="row row--between" style={{ alignItems: "baseline" }}>
        <label className="win-name__label" htmlFor="weigh-in-input">Your weight today</label>
        <button type="button" className="btn-link weigh-in__skip" onClick={onDone}>Skip</button>
      </div>
      <div className="weigh-in__row">
        <input
          id="weigh-in-input"
          className={"input" + (large ? " input--lg" : "")}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            typed.current = true;
            setValue(e.target.value);
          }}
          onFocus={(e) => e.target.select()}
          placeholder="185.0"
          autoFocus
        />
        <span className="weigh-in__unit">lb</span>
        <button type="submit" className={"btn" + (large ? " btn--lg btn--accent" : "")} disabled={busy} style={{ flexShrink: 0 }}>
          {busy ? "Saving…" : n > 0 ? "Save" : "Skip"}
        </button>
      </div>
      {last && <p className="weigh-in__last">Last time {fmtWeight(last.value)} lb, {shortDate(last.measured_at)}.</p>}
      {error && <div className="form-error" style={{ marginTop: 8 }}>{error}</div>}
    </form>
  );
}
