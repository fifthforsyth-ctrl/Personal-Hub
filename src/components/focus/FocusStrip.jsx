import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { focusWeekOf, weekShots, arrowsLabel, checkinOn, checkinLevel } from "../../lib/focus";
import { LEVELS } from "../../lib/mark";
import TargetFace from "../mark/TargetFace";
import LoadError from "../ui/LoadError";
import { useFocusWeek } from "./useFocusWeek";
import FocusSheet from "./FocusSheet";
import "../../styles/mark.css";
import "../../styles/focus.css";

// This week's focus, at the very top of Today, as a row of small targets.
//
// You said the week's focus should be the smallest targets of all, so each
// one is drawn the way the Range draws a goal, only for this week: each
// day's arrow is a mark where it landed, right where you put it when you
// placed it yourself, or in the ring its checks earned. A day from before
// arrows that said it moved sits in the inner ring, a "not today" out in
// the miss band, and a day with no arrow leaves the face clean. When today
// has an arrow, today's mark is the orange one; until then the newest mark
// stays ink, so orange always means today.
//
// It sits above everything else because it's what the week is for, and it
// stays small for the same reason: a glance, not a card to read. Five fit
// across a phone and the rest scroll; on a desk they wrap. Tap one to land
// today's arrow, change how it lands, or write a note about it any time.
//
// The focus goals themselves are set on Targets, and a focus kept on Sunday
// carries its notes, its checks and how it lands into the new week with it.
export default function FocusStrip({ userId, date }) {
  const weekStart = focusWeekOf(date);
  const fw = useFocusWeek(userId, weekStart);
  const { data, week, error, loading, reload } = fw;
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
        <Link to="/targets?focus=edit" className="btn-link btn-link--accent focus-strip__set">
          Set them on Targets
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
            const today = checkinOn(data.checkins, g.id, date);
            const todayWords = today ? LEVELS[checkinLevel(today)].name.toLowerCase() : "no arrow yet";
            return (
              <li key={g.id} className="focus-strip__cell">
                <button
                  type="button"
                  className={"focus-strip__item" + (today ? " is-answered" : "")}
                  aria-haspopup="dialog"
                  aria-label={`${g.title}. Today: ${todayWords}. ${arrowsLabel(g)}.`}
                  title={g.title}
                  onClick={() => setOpenId(g.id)}
                >
                  <TargetFace target={{ shots: shots[g.id] ?? [], reasons: [] }} today={date} range="7" mini />
                  <span className="focus-strip__title">{keepDashes(g.title)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {error && <LoadError what="this week's focus" error={error} onRetry={reload} stale />}
      </section>

      {open && <FocusSheet key={open.id} userId={userId} goal={open} date={date} fw={fw} onClose={() => setOpenId(null)} />}
    </>
  );
}

// "Daily form--win by win": a double dash is one mark, so it's drawn with
// hyphens that never break, and the name wraps at its spaces instead of
// leaving "--" alone at the start or end of a line.
function keepDashes(title) {
  return String(title ?? "").replace(/-/g, "\u2011");
}
