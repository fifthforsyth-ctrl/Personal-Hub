import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { focusWeekOf, weekShots, movedLabel } from "../../lib/focus";
import TargetFace from "../mark/TargetFace";
import LoadError from "../ui/LoadError";
import { useFocusWeek } from "./useFocusWeek";
import FocusSheet from "./FocusSheet";
import "../../styles/mark.css";
import "../../styles/focus.css";

// This week's focus, at the very top of Today, as a row of small targets.
//
// You said the week's focus should be the smallest targets of all, so each
// one is drawn the way the Range draws a goal, only for this week: every
// day you said it moved lands a mark in the inner ring, every "not today"
// lands out in the miss band, and a day you didn't answer leaves the face
// clean. When today has an answer, today's mark is the orange one; until
// then the newest mark stays ink, so orange always means today.
//
// It sits above everything else because it's what the week is for, and it
// stays small for the same reason: a glance, not a card to read. Five fit
// across a phone and the rest scroll; on a desk they wrap. Tap one to say
// whether today moved it, or to write a note about it any time.
//
// The focus goals themselves are set on Week, and a focus kept on Sunday
// carries its notes into the new week with it.
export default function FocusStrip({ userId, date }) {
  const weekStart = focusWeekOf(date);
  const { data, week, error, loading, reload, checkin } = useFocusWeek(userId, weekStart);
  const [openId, setOpenId] = useState(null);

  // Nothing while the week first loads, so the top of Today doesn't flash.
  if (!data) {
    if (loading || !error) return null;
    return <LoadError what="this week's focus" error={error} onRetry={reload} className="focus-strip__error" />;
  }

  if (week.length === 0) {
    return (
      <p className="focus-strip__empty">
        <span>No focus set for this week.</span>
        <Link to="/plan" className="btn-link btn-link--accent focus-strip__set">
          Set them on Week
          <ArrowRight size={13} />
        </Link>
      </p>
    );
  }

  const shots = weekShots(data.goals, data.checkins, weekStart);
  const open = openId ? week.find((g) => g.id === openId) ?? null : null;

  return (
    <>
      <section className="mark focus-strip" aria-label="This week's focus">
        <div className="eyebrow focus-strip__label" aria-hidden="true">
          This week's focus
        </div>
        <ul className="focus-strip__row">
          {week.map((g) => {
            const answer = g.days.find((d) => d.date === date)?.moved ?? null;
            const todayWords = answer === true ? "moved it" : answer === false ? "not today" : "no answer yet";
            return (
              <li key={g.id} className="focus-strip__cell">
                <button
                  type="button"
                  className={"focus-strip__item" + (answer !== null ? " is-answered" : "")}
                  aria-haspopup="dialog"
                  aria-label={`${g.title}. Today: ${todayWords}. This week: ${movedLabel(g)}.`}
                  title={g.title}
                  onClick={() => setOpenId(g.id)}
                >
                  <TargetFace target={{ shots: shots[g.id] ?? [], reasons: [] }} today={date} range="7" mini />
                  <span className="focus-strip__title">{g.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {error && <LoadError what="this week's focus" error={error} onRetry={reload} stale />}
      </section>

      {open && <FocusSheet key={open.id} userId={userId} goal={open} date={date} onCheckin={checkin} onClose={() => setOpenId(null)} />}
    </>
  );
}
