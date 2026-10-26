import { Link } from "react-router-dom";
import { ChevronDown, Flag, Plus } from "lucide-react";
import { shortName } from "../../lib/village";

// The top of Quests: every quest and lesson as a pill. Tapping one opens its
// list below and unfolds the pill to show the camps on its mountain, each
// with how far along it is; a camp goes to its checklist. Tapping the open
// pill again folds it. `tally` is camp id → { done, total, working }.

const byPos = (a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));

export default function QuestMap({ items, camps, tally, selKey, openKey, onPick, onNew }) {
  const quests = items.filter((i) => i.type === "Quest");
  const lessons = items.filter((i) => i.type === "Lesson");

  const pill = (i) => {
    const list = i.questId ? camps.filter((c) => c.quest_id === i.questId).sort(byPos) : [];
    const open = openKey === i.key;
    const on = selKey === i.key;
    const kind = i.type === "Lesson" ? "lesson" : "quest";
    return (
      <div key={i.key} className={"qs-pill" + (open ? " open" : "") + (on ? " on" : "")}>
        <button type="button" className="qs-pill__head" aria-expanded={open} aria-current={on ? "page" : undefined} title={i.name} onClick={() => onPick(i)}>
          <span className="qs-pill__name">{open ? i.name : shortName(i.name)}</span>
          {list.length > 0 && (
            <span className="qs-pill__count" aria-label={list.length === 1 ? "1 camp" : `${list.length} camps`}>
              {list.length}
            </span>
          )}
          <ChevronDown size={15} className="qs-pill__chev" aria-hidden="true" />
        </button>
        {open && (
          <div className="qs-pill__body">
            {list.length ? (
              <ol className="qs-camps" aria-label={`Camps on this ${kind}`}>
                {list.map((c, n) => {
                  const t = tally.get(c.id) ?? { done: 0, total: 0, working: false };
                  const pct = t.total ? Math.round((t.done / t.total) * 100) : 0;
                  return (
                    <li key={c.id}>
                      <Link to={`/ascent/camp/${c.id}`} state={{ from: "quests" }} className={"qs-camp" + (c.reached_on ? " reached" : "")}>
                        <span className="qs-camp__n" aria-hidden="true">
                          {c.reached_on ? <Flag size={12} /> : n + 1}
                        </span>
                        <span className="qs-camp__name">
                          <b>{c.title}</b>
                          <small>
                            {c.reached_on ? "Reached" : t.total ? `${t.done} of ${t.total} steps` : "No steps yet"}
                            {t.working && !c.reached_on && (
                              <span className="qs-camp__working">
                                <i aria-hidden="true" />
                                working on it
                              </span>
                            )}
                          </small>
                        </span>
                        <span className="qs-camp__bar" aria-hidden="true">
                          <i style={{ width: `${c.reached_on ? 100 : pct}%` }} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="qs-pill__none">
                No camps on this {kind} yet.{" "}
                <Link to="/ascent" className="btn-link btn-link--accent">
                  Add them on the Range
                </Link>
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className="qs-map" aria-label="Quests and their camps">
      {quests.map(pill)}
      {lessons.length > 0 && <span className="qs-map__label">Lessons</span>}
      {lessons.map(pill)}
      <button type="button" className="qs-pill qs-pill--new" onClick={onNew}>
        <Plus size={13} aria-hidden="true" />
        New quest
      </button>
    </nav>
  );
}
