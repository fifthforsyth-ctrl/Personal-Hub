import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Pencil } from "lucide-react";
import { LEVELS } from "../../lib/mark";
import TargetFace from "../mark/TargetFace";

// The top of a target's page: the way up the ladder, what it is and why,
// how its target stands today, and what can be done with it.
//
// - The ladder line: "Targets › My mission › Skilled", each a step up.
// - The name, under what kind of target it is; then why, in a quieter
//   grey, two lines and "More" when it runs longer. The mission shows its
//   summit words and the whole statement instead.
// - For a goal, quest or lesson, its small target (the last 30 days) with
//   today's arrow in words, and a way to its history further down.
// - The build in the village, top right, on a quest's or lesson's page.
// - Reflect, Note, Quote and the pencil, on one line on a phone.
//
//   crumbs    crumbsFor(): [{ label, to }] above this one
//   why       a line (string) or a node (a focus's "Counts toward")
//   mission   { summit, statement } on the mission's page
//   mark      the target on the range (goal, quest, lesson), or null
//   chip      "Done", "Set aside", "Learned", or null
//   build     the build tile, or null
//   actions   { onReflect, onNote, onQuote, onEdit, editLabel }; onEdit
//             null hides the pencil (an earlier week's focus)
//   onHistory opens the history and goes to it

export default function TargetHead({ crumbs = [], eyebrow, title, why = null, mission = null, mark = null, today, chip = null, build = null, actions, onHistory }) {
  return (
    <header className="tg-head">
      <nav className="tg-crumbs" aria-label="Up the ladder">
        <ol>
          <li>
            <Link to="/targets">Targets</Link>
          </li>
          {crumbs.map((c) => (
            <li key={c.to}>
              <ChevronRight size={12} aria-hidden="true" />
              <Link to={c.to}>{c.label}</Link>
            </li>
          ))}
        </ol>
      </nav>

      <div className={"tg-head__top" + (build ? " has-build" : "")}>
        <div className="tg-head__name">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1 className="page-title tg-title">{title}</h1>
          {chip && <span className="chip tg-chip">{chip}</span>}
        </div>
        {build && <div className="tg-head__build">{build}</div>}
      </div>

      {mission ? (
        <div className="tg-mission">
          {mission.summit && <p className="tg-mission__summit">{mission.summit}</p>}
          {mission.statement && <p className="tg-mission__statement">{mission.statement}</p>}
        </div>
      ) : typeof why === "string" ? (
        why.trim() && <Clamp text={why} />
      ) : (
        why && <div className="tg-why">{why}</div>
      )}

      {mark && <MarkRow target={mark} today={today} onHistory={onHistory} />}

      {actions && (
        <div className="tg-actions" role="group" aria-label="Write on it">
          <button type="button" className="btn btn--sm btn--on-page tg-act" onClick={actions.onReflect}>
            Reflect
          </button>
          <button type="button" className="btn btn--sm btn--on-page tg-act" onClick={actions.onNote}>
            Note
          </button>
          <button type="button" className="btn btn--sm btn--on-page tg-act" onClick={actions.onQuote} title="Link a quote">
            Quote
          </button>
          {actions.onEdit && (
            <button type="button" className="btn-icon tg-act__edit" onClick={actions.onEdit} aria-label={actions.editLabel ?? "Edit"} title={actions.editLabel ?? "Edit"}>
              <Pencil size={16} />
            </button>
          )}
        </div>
      )}
    </header>
  );
}

// Today's arrow on a target, in words.
export function todayWords(t) {
  const s = t?.today;
  if (!s) return "No arrow yet today";
  if (s.level === 0) return "Bullseye tonight";
  if (s.level === LEVELS.length - 1) return "Missed tonight";
  return `${LEVELS[s.level].name} ring tonight`;
}

function MarkRow({ target: t, today, onHistory }) {
  return (
    <div className="tg-mark">
      <TargetFace target={t} today={today} range="30" mini arrow className="tg-mark__face" />
      <span className={"tg-mark__state" + (t.today ? " is-in" : "")}>{todayWords(t)}</span>
      {onHistory && (
        <button type="button" className="btn-link tg-mark__history" onClick={onHistory}>
          History
        </button>
      )}
    </div>
  );
}

// Two lines, and "More" when there's more of it.
function Clamp({ text }) {
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  const el = useRef(null);
  useLayoutEffect(() => {
    const p = el.current;
    if (!p || open) return undefined;
    const measure = () => setLong(p.scrollHeight > p.clientHeight + 1);
    measure();
    if (!window.ResizeObserver) return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(p);
    return () => ro.disconnect();
  }, [text, open]);
  return (
    <div className="tg-why">
      <p ref={el} className={"tg-why__text" + (open ? "" : " is-clamped")}>
        {text}
      </p>
      {(long || open) && (
        <button type="button" className="btn-link tg-why__more" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Less" : "More"}
        </button>
      )}
    </div>
  );
}
