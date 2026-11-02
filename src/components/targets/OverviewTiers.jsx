import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { LEVELS, inRange } from "../../lib/mark";
import { KIND_NAME, pathOf, pillLine } from "../../lib/ladder";
import TargetFace from "../mark/TargetFace";
import Gear from "../ascent/Gear";

// The pieces of the Targets overview's four tiers: the mission's card, a
// row of small targets (the lifetime goals, the week's focus), and the
// quests and lessons as compact rows. Each is a link to its own page.

// A face with nothing on it yet, for a target the range hasn't drawn.
export const NO_MARKS = { shots: [], reasons: [] };

// What a small target says to a screen reader, as the Range said it:
// "4 bullseyes in 30 days, no arrow yet today".
export function markWords(t, today, days = 30) {
  if (!t?.shots?.length) return "no marks yet";
  const bulls = inRange(t.shots, today, String(days)).filter((s) => s.level === 0).length;
  const n = `${bulls} ${bulls === 1 ? "bullseye" : "bullseyes"} in ${days} days`;
  return `${n}, ${landedWords(t.today?.level)}`;
}

const sentence = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function landedWords(level) {
  if (level == null || !LEVELS[level]) return "no arrow yet today";
  if (level === 0) return "a bullseye today";
  if (level === LEVELS.length - 1) return "today's arrow missed";
  return `today's arrow in the ${LEVELS[level].name.toLowerCase()} ring`;
}

// "Daily form--win by win": a double dash is one mark, so it's drawn with
// hyphens that never break, and the name wraps at its spaces instead of
// leaving "--" alone at the start or end of a line (as Today's strip does).
export function keepDashes(title) {
  return String(title ?? "").replace(/-/g, "‑");
}

// --- The mission ---------------------------------------------------------------

// White, like every card: the words carry it. The summit's words in small
// capitals over the statement, which keeps to three lines here; the whole
// of it is a tap away on its page.
export function MissionCard({ mission, onWrite }) {
  if (!mission?.statement) {
    return (
      <section className="card ov-tier ov-mission ov-mission--empty" aria-labelledby="ov-mission-h">
        <h2 className="eyebrow" id="ov-mission-h">
          My mission
        </h2>
        <p className="ov-mission__none">The one thing every goal below serves, in your own words.</p>
        <button type="button" className="btn btn--sm btn--accent" onClick={onWrite}>
          Write your mission
        </button>
      </section>
    );
  }
  return (
    <section className="ov-tier ov-tier--mission" aria-labelledby="ov-mission-h">
      <Link to={pathOf("mission")} className="card ov-mission">
        <div className="ov-mission__top">
          <h2 className="eyebrow" id="ov-mission-h">
            My mission
          </h2>
          <ChevronRight size={16} className="ov-go" aria-hidden="true" />
        </div>
        {mission.summit && <p className="ov-mission__summit">{mission.summit}</p>}
        <p className="ov-mission__creed">{mission.statement}</p>
      </Link>
    </section>
  );
}

// --- A row of small targets ----------------------------------------------------

// Five across a phone, the rest a swipe away inside the row; on a desk they
// wrap. Each item: { key, to, label (what a screen reader hears), name,
// gear?, face (the drawn target), answered? }.
export function FaceRow({ items, week = false, label }) {
  return (
    <ul className={"ov-faces" + (week ? " ov-faces--week" : "")} aria-label={label}>
      {items.map((it) => (
        <li key={it.key} className="ov-faces__cell">
          <Link to={it.to} className={"ov-face" + (it.answered ? " is-answered" : "")} aria-label={it.label} title={it.title}>
            {it.face}
            <span className="ov-face__name">
              {it.gear && <Gear name={it.gear} size={12} className="ov-face__gear" />}
              {it.name}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// --- The quests and lessons ----------------------------------------------------

// One row each: its last 30 days of marks, its name on one line, and what's
// waiting there ("Quest · 2 camps · 3 today"). One column on a phone, two
// from 520 wide.
export function ClimbRows({ climbs, today }) {
  return (
    <ul className="ov-climbs">
      {climbs.map((c) => {
        const kind = c.kind === "lesson" ? "Lesson" : "Quest";
        const line = pillLine(c);
        const heard = line.replace(/ · /g, ", ");
        return (
          <li key={c.key}>
            <Link
              to={pathOf(c.kind, c.key)}
              className="ov-climb"
              aria-label={`${c.title}. ${c.kind === "lesson" ? KIND_NAME.lesson : kind}${heard ? `, ${heard}` : ""}. ${sentence(markWords(c.target, today))}.`}
            >
              <TargetFace target={c.target ?? NO_MARKS} today={today} range="30" mini arrow />
              <span className="ov-climb__txt">
                <b className="truncate">{c.title}</b>
                <small className="truncate">{line ? `${kind} · ${line}` : kind}</small>
              </span>
              <ChevronRight size={16} className="ov-go" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
