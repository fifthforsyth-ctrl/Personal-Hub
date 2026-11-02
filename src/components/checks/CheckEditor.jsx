import { useState } from "react";
import { ArrowUp, ArrowDown, X, Plus, BookOpen } from "lucide-react";
import { KINDS, TEMPLATES, normCheck, passText } from "../../lib/checks";
import "../../styles/checks.css";

// The checks on a target or a weekly focus, as a list you edit in a sheet.
// Controlled: `rows` in, `onChange(rows)` out, each row a check plus a `key`
// for the list. editRows makes rows from saved checks; cleanRows turns rows
// back into the checks to save (blank ones dropped); rowsProblem says what
// would stop a save.
//
//   focuses   lifetime focuses a check can be answered from (the time log)
//   max       how many checks at most

export function editRows(checks) {
  return (checks ?? []).map((c, i) => ({ ...normCheck(c), key: c.id ?? `new-${i}` }));
}

export function blankRow(n = 0, patch = {}) {
  return { ...normCheck({ text: "", kind: "yn", ...patch }), key: `new-${n}-${Math.random().toString(36).slice(2, 7)}` };
}

export function cleanRows(rows) {
  return (rows ?? [])
    .map((r) => ({ ...normCheck(r), id: r.id ?? null }))
    .filter((r) => r.text);
}

export function rowsProblem(rows) {
  for (const r of cleanRows(rows)) {
    if (r.kind === "choice" && r.options.length < 2) return `Give "${r.text}" at least two choices.`;
    if (r.kind === "choice" && r.counts && !r.pass.on.length) return `Pick which choices pass for "${r.text}", or make it reflection only.`;
    if (r.kind === "time" && r.counts && !r.pass.by) return `Set the time "${r.text}" has to be by, or make it reflection only.`;
  }
  // An "at most" left empty would save as "at least 1" (normCheck's
  // default), the opposite of what the box says, so it's asked for instead.
  for (const r of rows ?? []) {
    const text = String(r.text ?? "").trim();
    if (text && r.kind === "number" && r.counts !== false && atMost(r) && !isNumber(r.pass.max)) return `Say how many "${text}" can be at most, or make it reflection only.`;
  }
  return null;
}

const ANSWERED_BY_LOG = new Set(["yn", "ysn", "minutes"]);

// A row switched to another kind keeps only what the new kind can show:
// left behind, a setting would still be saved and read with no way to see
// it or take it off here (a 1 to 10 still "answered" by the time log, a
// Yes / No still reflection only from its time as a few words). A few words
// starts as reflection only; coming back from one, it counts again. A
// check's own Reflection only stays as you set it, since every other kind
// shows it.
export function rekind(r, kind) {
  return normCheck({
    ...r,
    kind,
    pass: {},
    counts: kind === "note" ? false : r.kind === "note" ? true : r.counts,
    focus_id: ANSWERED_BY_LOG.has(kind) ? r.focus_id : null,
    auto: kind === "time" ? r.auto : null,
    unit: kind === "number" ? r.unit : null,
    options: kind === "choice" ? r.options : [],
  });
}

// The number boxes hold what you type, and null while one's empty, so a box
// can be cleared and typed into again (backspace, then 8, is 8, not 78
// clamped to 10). normCheck's defaults and limits apply when it's saved
// (cleanRows); the line beside the box already says what that will be.
const typed = (e) => (e.target.value === "" ? null : Number(e.target.value));
const isNumber = (v) => v != null && v !== "" && Number.isFinite(Number(v));
const atMost = (r) => Boolean(r.pass) && Object.prototype.hasOwnProperty.call(r.pass, "max");

export default function CheckEditor({ rows, onChange, focuses = [], max = 6, firstPlaceholder = "Exercised" }) {
  const [tools, setTools] = useState(false);
  const set = (key, patch) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (i, by) => {
    const next = [...rows];
    const [r] = next.splice(i, 1);
    next.splice(i + by, 0, r);
    onChange(next);
  };
  const add = (patch) => {
    onChange([...rows, blankRow(rows.length, patch)]);
    setTools(false);
  };

  return (
    <div>
      <ol className="ck-edit">
        {rows.map((r, i) => (
          <li key={r.key} className="ck-edit__item">
            <div className="ck-edit__top">
              <input
                className="input"
                value={r.text}
                onChange={(e) => set(r.key, { text: e.target.value })}
                maxLength={120}
                placeholder={i === 0 ? firstPlaceholder : "Another check"}
                aria-label={`Check ${i + 1}`}
              />
              <button type="button" className="btn-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" title="Move up">
                <ArrowUp size={15} />
              </button>
              <button type="button" className="btn-icon" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down" title="Move down">
                <ArrowDown size={15} />
              </button>
              <button type="button" className="btn-icon" onClick={() => onChange(rows.filter((x) => x.key !== r.key))} aria-label="Remove" title="Remove">
                <X size={15} />
              </button>
            </div>
            <div className="ck-edit__grid">
              <label>
                Answered
                <select
                  className="input"
                  value={r.kind}
                  onChange={(e) => set(r.key, { ...rekind(r, e.target.value), key: r.key, id: r.id })}
                >
                  {KINDS.map((k) => (
                    <option key={k.key} value={k.key}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              <PassFields r={r} set={(patch) => set(r.key, patch)} />
            </div>
            {r.kind === "choice" && <ChoiceFields r={r} set={(patch) => set(r.key, patch)} />}
            <div className="ck-edit__grid">
              {ANSWERED_BY_LOG.has(r.kind) && focuses.length > 0 && (
                <label>
                  Time log answers it
                  <select className="input" value={r.focus_id ?? ""} onChange={(e) => set(r.key, { focus_id: e.target.value || null })}>
                    <option value="">No, you do</option>
                    {focuses.map((f) => (
                      <option key={f.id} value={f.id}>
                        When {f.name} is logged
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {r.kind === "note" ? (
                <label className="ck-edit__toggle">
                  <input type="checkbox" checked={r.counts} onChange={(e) => set(r.key, { counts: e.target.checked, pass: e.target.checked ? { words: true } : {} })} />
                  Counts: writing it passes
                </label>
              ) : (
                <label className="ck-edit__toggle">
                  <input type="checkbox" checked={!r.counts} onChange={(e) => set(r.key, { counts: !e.target.checked })} />
                  Reflection only
                </label>
              )}
              <span className="faint">{passText(r)}</span>
            </div>
          </li>
        ))}
      </ol>

      {rows.length < max && (
        <div className="ck-edit__add" style={{ marginTop: 10 }}>
          <button type="button" className="btn btn--sm btn--on-page" onClick={() => add({})}>
            <Plus size={14} />
            Add a check
          </button>
          <button type="button" className="btn btn--sm btn--on-page" onClick={() => setTools((v) => !v)} aria-expanded={tools}>
            <BookOpen size={14} />
            From a reflection tool
          </button>
        </div>
      )}
      {tools && rows.length < max && (
        <div className="ck-tools">
          {TEMPLATES.map((t) => (
            <button key={t.key} type="button" className="ck-tool" onClick={() => add(t.check)}>
              <b>{t.name}</b>
              <small>
                {t.source}. {t.about}
              </small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PassFields({ r, set }) {
  if (!r.counts && r.kind !== "time" && r.kind !== "note") return null;
  switch (r.kind) {
    case "yn":
    case "ysn":
      return (
        <label>
          Passes on
          <select className="input" value={r.pass.on} onChange={(e) => set({ pass: { on: e.target.value } })}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
      );
    case "scale":
      return (
        <label>
          Passes at
          <input className="input" type="number" min={1} max={10} value={r.pass.min ?? ""} placeholder="7" onChange={(e) => set({ pass: { min: typed(e) } })} />
          or more
        </label>
      );
    case "number": {
      // Which way it passes is the box's key, so an emptied "at most" stays
      // "at most" while you type.
      const most = atMost(r);
      const n = most ? r.pass.max : r.pass.min;
      return (
        <>
          <label>
            Passes at
            <select className="input" value={most ? "max" : "min"} onChange={(e) => set({ pass: { [e.target.value]: n ?? null } })}>
              <option value="min">at least</option>
              <option value="max">at most</option>
            </select>
            <input className="input" type="number" min={0} step="any" value={n ?? ""} onChange={(e) => set({ pass: { [most ? "max" : "min"]: typed(e) } })} />
          </label>
          <label>
            Counting
            <input className="input" type="text" value={r.unit ?? ""} maxLength={20} placeholder="pages" onChange={(e) => set({ unit: e.target.value })} />
          </label>
        </>
      );
    }
    case "minutes":
      return (
        <label>
          Passes at
          <input className="input" type="number" min={0} step={5} value={r.pass.min ?? ""} placeholder="any" onChange={(e) => set({ pass: { min: typed(e) } })} />
          min or more
        </label>
      );
    case "time":
      return (
        <>
          <label>
            By
            <input className="input" type="time" value={r.pass.by ?? ""} onChange={(e) => set({ pass: e.target.value ? { by: e.target.value } : {} })} />
          </label>
          <label className="ck-edit__toggle">
            <input type="checkbox" checked={r.auto === "wake"} onChange={(e) => set({ auto: e.target.checked ? "wake" : null })} />
            Fill from when I got up
          </label>
        </>
      );
    default:
      return null;
  }
}

function ChoiceFields({ r, set }) {
  const [draft, setDraft] = useState("");
  const addOption = () => {
    const o = draft.trim();
    if (!o || r.options.includes(o) || r.options.length >= 8) return;
    set({ options: [...r.options, o] });
    setDraft("");
  };
  const togglePass = (o) => {
    const on = r.pass.on.includes(o) ? r.pass.on.filter((x) => x !== o) : [...r.pass.on, o];
    set({ pass: { on } });
  };
  return (
    <div className="ck-edit__opts">
      {r.options.map((o) => (
        <span key={o} className="row" style={{ gap: 2 }}>
          <button type="button" className={"chip" + (r.pass.on.includes(o) ? " active" : "")} aria-pressed={r.pass.on.includes(o)} onClick={() => togglePass(o)} title={r.counts ? "Tap to make it pass" : undefined}>
            {o}
          </button>
          <button
            type="button"
            className="btn-icon"
            aria-label={`Remove ${o}`}
            onClick={() => set({ options: r.options.filter((x) => x !== o), pass: { on: r.pass.on.filter((x) => x !== o) } })}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      {r.options.length < 8 && (
        <input
          className="input"
          style={{ width: 130, padding: "6px 8px", fontSize: 13 }}
          value={draft}
          maxLength={40}
          placeholder="Add a choice"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOption();
            }
          }}
          onBlur={addOption}
        />
      )}
      {r.counts && r.options.length > 0 && <small className="faint">Dark ones pass.</small>}
    </div>
  );
}
