import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { focusWeekOf, weekShots } from "../../lib/focus";
import { pathOf } from "../../lib/ladder";
import TargetFace from "../mark/TargetFace";
import { useFocusWeek } from "../focus/useFocusWeek";
import "../../styles/mark.css";

// The week's focus on the Week tab: one thin line of little targets, never
// more than that, because this tab is for the schedule. Each opens its page
// on Targets, where its arrows, notes and settings live, and "Edit" opens the
// week's focus there to add, change or review them.
export const FOCUS_EDIT = "/targets?focus=edit";

export default function FocusLine({ date }) {
  const { user } = useAuth();
  const weekStart = focusWeekOf(date);
  const { data, week } = useFocusWeek(user?.id, weekStart);

  // Nothing while it loads or if it can't: it's a glance, not the page.
  if (!data) return null;

  if (week.length === 0) {
    return (
      <nav className="focus-line" aria-label="This week's focus">
        <span className="focus-line__label">Focus</span>
        <Link to={FOCUS_EDIT} className="focus-line__edit">
          <Plus size={12} />
          Set this week's focus
        </Link>
      </nav>
    );
  }

  const shots = weekShots(data.goals, data.checkins, weekStart);
  return (
    <nav className="focus-line mark" aria-label="This week's focus">
      <span className="focus-line__label">Focus</span>
      <ul className="focus-line__row">
        {week.map((g) => (
          <li key={g.id}>
            <Link to={pathOf("focus", g.id)} className="focus-line__item" title={`${g.title}: open on Targets`}>
              <TargetFace target={{ shots: shots[g.id] ?? [], reasons: [] }} today={date} range="7" mini />
              <span className="focus-line__name">{g.title}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link to={FOCUS_EDIT} className="focus-line__edit" title="Add, change or review this week's focus on Targets">
        Edit
      </Link>
    </nav>
  );
}
