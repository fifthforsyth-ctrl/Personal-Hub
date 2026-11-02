import { useState } from "react";
import { Plus } from "lucide-react";
import { normCheck, passText, markOf, scores } from "../../lib/checks";
import "../../styles/checks.css";

// One check, answered the way its kind asks (checks.js): two or three
// buttons, ten for a 1-to-10, a number, minutes, a time, one of its
// choices, or a few words. Under the question, what passes and, when the
// day already answered it, where that came from (`hint`: "Time log · 42m",
// "From I'm up"). Every check can carry a line of its own.
//
//   check    the check row (an aim or a focus check)
//   value    the answer so far, or null
//   line     its own line, or ""
//   onValue  (value) => void, null to clear a typed answer
//   onLine   (line) => void; leave it out and there's no line
//   hint     where an answer the day filled in came from
//
// Tapping the chosen button again leaves it chosen: an answer is changed
// by picking another, never lost by a second tap.

const YN = [
  ["yes", "Yes"],
  ["no", "No"],
];
const YSN = [
  ["yes", "Yes"],
  ["some", "Some"],
  ["no", "No"],
];
const MARK_WORD = ["Not passed", "Partly", "Passed"];

export default function CheckRow({ check, value, line = "", onValue, onLine, hint, disabled = false }) {
  const c = normCheck(check);
  const [lineOpen, setLineOpen] = useState(Boolean(line));
  const mark = markOf(c, value);
  const counts = scores(c);
  const id = `ck-${c.id ?? c.text.replace(/\W+/g, "-").slice(0, 24)}`;

  return (
    <div className={"ck-row" + (c.kind === "note" ? " ck-row--note" : "") + (c.kind === "scale" ? " ck-row--scale" : "")}>
      <div className="ck-row__q">
        <span className="ck-row__text" id={`${id}-q`}>
          {c.text}
        </span>
        <small className="ck-row__pass">
          {counts && <i className={"ck-mark" + (mark != null ? ` ck-mark--${mark}` : "")} aria-label={mark != null ? MARK_WORD[mark] : "Not answered"} title={mark != null ? MARK_WORD[mark] : "Not answered"} />}
          {passText(c)}
          {hint && <span className="ck-row__hint"> · {hint}</span>}
        </small>
      </div>

      <div className="ck-row__a">
        <Answer c={c} value={value} onValue={onValue} disabled={disabled} labelledBy={`${id}-q`} />
      </div>

      {onLine && c.kind !== "note" && (
        lineOpen ? (
          <input
            className="input input--sm ck-row__line"
            value={line}
            onChange={(e) => onLine(e.target.value)}
            maxLength={500}
            placeholder="A line about it, if you want one"
            aria-label={`A line about ${c.text}`}
            disabled={disabled}
          />
        ) : (
          <button type="button" className="btn-link ck-row__add-line" onClick={() => setLineOpen(true)} disabled={disabled}>
            <Plus size={12} />
            Add a line
          </button>
        )
      )}
    </div>
  );
}

function Answer({ c, value, onValue, disabled, labelledBy }) {
  const pick = (v) => {
    if (disabled) return;
    onValue?.(v);
  };

  if (c.kind === "yn" || c.kind === "ysn") {
    const opts = c.kind === "yn" ? YN : YSN;
    return (
      <div className="seg ck-seg" role="group" aria-labelledby={labelledBy}>
        {opts.map(([v, label]) => (
          <button key={v} type="button" className={"seg-btn" + (value === v ? " active" : "")} aria-pressed={value === v} onClick={() => pick(v)} disabled={disabled}>
            {label}
          </button>
        ))}
      </div>
    );
  }

  if (c.kind === "scale") {
    return (
      <div className="ck-scale" role="group" aria-labelledby={labelledBy}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className={"ck-scale__n" + (Number(value) === n ? " active" : "") + (n >= c.pass.min ? " ck-scale__n--pass" : "")}
            aria-pressed={Number(value) === n}
            onClick={() => pick(n)}
            disabled={disabled}
          >
            {n}
          </button>
        ))}
      </div>
    );
  }

  if (c.kind === "number" || c.kind === "minutes") {
    return (
      <label className="ck-num">
        <input
          className="input input--sm"
          type="number"
          inputMode={c.kind === "minutes" ? "numeric" : "decimal"}
          min={0}
          step={c.kind === "minutes" ? 1 : "any"}
          value={value ?? ""}
          onChange={(e) => pick(e.target.value === "" ? null : Number(e.target.value))}
          aria-labelledby={labelledBy}
          disabled={disabled}
        />
        <span className="faint">{c.kind === "minutes" ? "min" : c.unit ?? ""}</span>
      </label>
    );
  }

  if (c.kind === "time") {
    return (
      <label className="ck-num">
        <input className="input input--sm" type="time" value={value ?? ""} onChange={(e) => pick(e.target.value || null)} aria-labelledby={labelledBy} disabled={disabled} />
      </label>
    );
  }

  if (c.kind === "choice") {
    return (
      <div className="ck-choices" role="group" aria-labelledby={labelledBy}>
        {c.options.map((o) => (
          <button key={o} type="button" className={"chip" + (value === o ? " active" : "")} aria-pressed={value === o} onClick={() => pick(o)} disabled={disabled}>
            {o}
          </button>
        ))}
      </div>
    );
  }

  // A few words.
  return (
    <textarea
      className="input ck-note"
      rows={2}
      maxLength={500}
      value={value ?? ""}
      onChange={(e) => pick(e.target.value)}
      placeholder="A few words"
      aria-labelledby={labelledBy}
      disabled={disabled}
    />
  );
}
