import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { focusWeekOf, weekShots } from "../../lib/focus";
import { pathOf } from "../../lib/ladder";
import { addDays, parseDateStr, todayStr } from "../../lib/planDates";
import TargetFace from "../mark/TargetFace";
import { useFocusWeek } from "../focus/useFocusWeek";
import "../../styles/mark.css";

// The week's focus on the Week tab: one thin line of little targets, never
// more than that, because this tab is for the schedule. Each opens its page
// on Targets, where its arrows, notes and settings live, and "Edit" opens
// that same week's focus there to add, change or review them (so next
// week's can be set ahead of time from next week).
export const FOCUS_EDIT = "/targets?focus=edit";
export const focusEditFor = (weekStart) => `${FOCUS_EDIT}&week=${weekStart}`;

// "This week's", "Next week's", ... for the week shown.
export function whoseWeek(weekStart, today = todayStr()) {
  const n = Math.round((parseDateStr(weekStart) - parseDateStr(focusWeekOf(today))) / (7 * 86400000));
  return n === 0 ? "This week's" : n === 1 ? "Next week's" : n === -1 ? "Last week's" : "That week's";
}

export default function FocusLine({ date }) {
  const { user } = useAuth();
  const weekStart = focusWeekOf(date);
  const { data, week } = useFocusWeek(user?.id, weekStart);

  // Nothing while it loads or if it can't: it's a glance, not the page.
  if (!data) return null;

  const today = todayStr();
  const whose = whoseWeek(weekStart, today);
  const edit = focusEditFor(weekStart);

  if (week.length === 0) {
    return (
      <nav className="focus-line" aria-label={`${whose} focus`}>
        <span className="focus-line__label">Focus</span>
        <Link to={edit} className="focus-line__edit">
          <Plus size={12} />
          Set {whose.toLowerCase()} focus
        </Link>
      </nav>
    );
  }

  // Arrows up to today, or to the week's last day for a week gone by.
  const lastDay = addDays(weekStart, 6);
  const upTo = today < lastDay ? today : lastDay;
  const shots = weekShots(data.goals, data.checkins, weekStart);
  return (
    <nav className="focus-line mark" aria-label={`${whose} focus`}>
      <span className="focus-line__label">Focus</span>
      <ul className="focus-line__row">
        {week.map((g) => (
          <li key={g.id}>
            <Link to={pathOf("focus", g.id)} className="focus-line__item" title={`${g.title}: open on Targets`}>
              <TargetFace target={{ shots: shots[g.id] ?? [], reasons: [] }} today={upTo} range="7" mini />
              <span className="focus-line__name">{g.title}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link to={edit} className="focus-line__edit" title={`Add, change or review ${whose.toLowerCase()} focus on Targets`}>
        Edit
      </Link>
    </nav>
  );
}
