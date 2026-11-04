import { ChevronDown } from "lucide-react";
import TargetFace from "../mark/TargetFace";
import TargetView from "../mark/TargetView";

// A target's marks, at the foot of its page (id="history"): the board with
// every day it was shot at (a week, 30 days or all of it), how close they
// come, where the misses gather, the day tapped, and what a bullseye takes
// (its pencil opens the sheet). On a quest's or lesson's page it's folded
// away under its small target, so the lists stay near the top; the page's
// "History" opens it (and so does #history in the address). A goal has no
// lists, so there it's open and comes first.
//
//   folded    drawn as a fold (quest, lesson); `open`, onOpen(open)
//   ladder    useLadder(): its focuses and sheets
//   goalId    a goal's id, for adding a focus to it
//   pick      { id } of a shot to show its day (an evening's line tapped in
//             the notes); a new object each tap

export default function TargetHistory({ target: t, today, ladder, folded = true, open = false, onOpen, pick = null }) {
  const view = (
    <TargetView
      embedded
      pick={pick}
      range={ladder.range}
      target={t}
      today={today}
      focusesById={ladder.focusesById}
      fedBy={ladder.fedByOf(t)}
      onSetup={() => ladder.open({ kind: "target", target: t })}
      onFocus={(f) => ladder.open({ kind: "focus", focus: f, goalId: t.key })}
      onAddFocus={() => ladder.open({ kind: "focus", focus: null, goalId: t.key })}
    />
  );

  if (!folded) {
    return (
      <section className="tg-history tg-history--open" id="history" aria-label="Its target">
        {view}
      </section>
    );
  }

  return (
    <details className="card tg-history" id="history" open={open} onToggle={(e) => onOpen?.(e.currentTarget.open)}>
      <summary className="tg-history__sum">
        <TargetFace target={t} today={today} range="30" mini arrow className="tg-history__face" />
        <span className="tg-history__label">
          <b>History</b>
          <span> · last 30 days</span>
        </span>
        <ChevronDown size={16} className="tg-history__chev" aria-hidden="true" />
      </summary>
      {open && <div className="tg-history__body">{view}</div>}
    </details>
  );
}
