import { ChevronRight } from "lucide-react";
import { LEVELS, inRange } from "../../lib/mark";
import { KIND_NAME, pillLine } from "../../lib/ladder";
import { arrowWords, faceOf } from "../../lib/arrows";
import TargetFace from "../mark/TargetFace";
import Gear from "../ascent/Gear";

// The pieces of the Targets overview's four tiers: the mission's card, a
// row of small targets (the lifetime goals, the week's focus), and the
// quests and lessons as compact rows. A tap on any of them opens its pop-up
// (place an arrow, add a note, edit it): `onOpen`.

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

// The one black card on the page (Clean slate, 2026-11-23): the summit's
// words large over the statement, which keeps to three lines here; the
// whole of it is a tap away on its page. With nothing written yet it's a
// plain white card asking for it.
export function MissionCard({ mission, onWrite, onOpen }) {
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
      <button type="button" className="card ov-mission" onClick={onOpen}>
        <div className="ov-mission__top">
          <h2 className="eyebrow" id="ov-mission-h">
            My mission
          </h2>
          <ChevronRight size={16} className="ov-go" aria-hidden="true" />
        </div>
        {mission.summit && <p className="ov-mission__summit">{mission.summit}</p>}
        <p className="ov-mission__creed">{mission.statement}</p>
      </button>
    </section>
  );
}

// --- A row of small targets ----------------------------------------------------

// Five across a phone, the rest a swipe away inside the row; on a desk they
// wrap. Each item: { key, onOpen, label (what a screen reader hears), name,
// gear?, face (the drawn target), answered? }.
export function FaceRow({ items, week = false, label }) {
  return (
    <ul className={"ov-faces" + (week ? " ov-faces--week" : "")} aria-label={label}>
      {items.map((it) => (
        <li key={it.key} className="ov-faces__cell">
          <button type="button" onClick={it.onOpen} className={"ov-face" + (it.answered ? " is-answered" : "")} aria-label={it.label} title={it.title}>
            {it.face}
            <span className="ov-face__name">
              {it.gear && <Gear name={it.gear} size={12} className="ov-face__gear" />}
              {it.name}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// --- The week's focus, a row each -----------------------------------------------

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_WORDS = { bull: "bullseye", ring: "on the target", miss: "missed", none: "no arrow", now: "today, no arrow yet", later: "to come" };

// The seven letters over the squares, today's in ink.
export function WeekLetters({ todayIndex = -1 }) {
  return (
    <span className="ov-week ov-week--letters" aria-hidden="true">
      {WEEKDAYS.map((d, i) => (
        <i key={i} className={i === todayIndex ? "is-today" : undefined}>
          {d}
        </i>
      ))}
    </span>
  );
}

// Each focus by its whole name, with the week as seven small squares:
// black for a bullseye, grey for an arrow on the target, an outline for a
// miss, orange for today while it waits, pale for days to come. Each row
// opens the focus's pop-up. Items: { key, onOpen, title, label, days: [state x7] }.
export function FocusRows({ items, label }) {
  return (
    <ul className="ov-rows" aria-label={label}>
      {items.map((it) => (
        <li key={it.key}>
          <button type="button" onClick={it.onOpen} className="ov-row" aria-label={it.label}>
            <span className="ov-row__name">{it.title}</span>
            <span className="ov-week" aria-hidden="true">
              {it.days.map((d, i) => (
                <i key={i} className={"ov-day ov-day--" + d} title={DAY_WORDS[d]} />
              ))}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// --- The quests and lessons ----------------------------------------------------

// One row each, a hairline between: its last 30 days of marks, its name on
// one line, and what's waiting there ("Quest · 2 camps · 3 today").
// `arrowsOf(c)` is the arrows on it; `onOpen(c)` opens its pop-up.
export function ClimbRows({ climbs, today, arrowsOf = () => [], onOpen = () => {} }) {
  return (
    <ul className="ov-climbs">
      {climbs.map((c) => {
        const kind = c.kind === "lesson" ? "Lesson" : "Quest";
        const line = pillLine(c);
        const heard = line.replace(/ · /g, ", ");
        return (
          <li key={c.key}>
            <button
              type="button"
              onClick={() => onOpen(c)}
              className="ov-climb"
              aria-label={`${c.title}. ${c.kind === "lesson" ? KIND_NAME.lesson : kind}${heard ? `, ${heard}` : ""}. ${sentence(arrowWords(arrowsOf(c), today))}.`}
            >
              <TargetFace target={faceOf(arrowsOf(c))} today={today} range="30" mini arrow />
              <span className="ov-climb__txt">
                <b className="truncate">{c.title}</b>
                <small className="truncate">{line ? `${kind} · ${line}` : kind}</small>
              </span>
              <ChevronRight size={16} className="ov-go" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
