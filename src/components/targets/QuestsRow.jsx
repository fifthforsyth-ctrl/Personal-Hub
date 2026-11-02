import { useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchQuestPills } from "../../lib/api";
import { pathOf, pillLine } from "../../lib/ladder";
import { useLoad } from "../../lib/useLoad";
import "../../styles/targets.css";

// The quests he's on and the lessons he's learning, one pill each, a tap
// from their page: camps, today's list and the clipboard. On Today it's the
// shortcut Aaron asked for ("the camps in the quests are a bit hidden");
// on a quest's own page it's how he jumps to the next one, with the open
// one marked (`current`, its key).
//
// Nothing shows while it first loads, or when there's nothing on; a failed
// read stays quiet too (the Targets tab is a tap away and says why).
export default function QuestsRow({ userId, date, current = null, label = "Quests", className = "" }) {
  const { data, reload } = useLoad(() => (userId ? fetchQuestPills(userId, date) : null), [userId, date]);

  // A camp ticked, a line written or a quest added elsewhere shows here too.
  useEffect(() => {
    window.addEventListener("hub:changed", reload);
    return () => window.removeEventListener("hub:changed", reload);
  }, [reload]);

  const pills = data ?? [];
  if (!pills.length) return null;

  return (
    <nav className={`quests-row ${className}`.trim()} aria-label={label}>
      <span className="eyebrow quests-row__label" aria-hidden="true">
        {label}
      </span>
      <ul className="quests-row__list">
        {pills.map((p) => {
          const line = pillLine(p);
          const on = p.key === current;
          return (
            <li key={p.key}>
              <Link
                to={pathOf(p.kind, p.key)}
                className={"quests-row__pill" + (on ? " is-on" : "")}
                aria-current={on ? "page" : undefined}
                title={p.name}
                aria-label={`${p.name}${p.kind === "lesson" ? " (lesson)" : ""}${line ? `. ${line}` : ""}`}
              >
                <b>{p.short}</b>
                {line && <small>{line}</small>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
