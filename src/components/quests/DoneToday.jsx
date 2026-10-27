import { Link } from "react-router-dom";
import { Check, ChevronRight, History, ListTodo, StickyNote } from "lucide-react";
import Sheet from "../ascent/Sheet";
import { Rich } from "../camp/Rich";

// Everything finished today, opened from the count on a quest's Today or
// the build's "N today" (Aaron, 2026-10-27). "This quest" shows the open
// quest's day as its Today does: each camp's steps under the camp's name,
// then the lines from its own list, with what's under each. "All quests"
// shows every quest's, one after another. The groups come from
// src/lib/doneToday.js; nothing here changes anything.
//
// `view` is "quest" or "all"; `quest` is { questId, name, kind, groups,
// count, earlier } for the open quest (or null when none is open), `all` is
// allDoneToday's list. `earlier` is what Today counts as done that was
// finished before today (earlierOnToday): it comes last, apart, so every
// tick Today's count counts is here, and only today's are counted.
export default function DoneToday({ view, quest, all, onView, onClose }) {
  const allCount = all.reduce((n, q) => n + q.count, 0);
  // "All quests" only says something when another quest has had work done today.
  const others = all.some((q) => q.questId !== quest?.questId);
  const showAll = !quest || (view === "all" && others);
  const count = showAll ? allCount : quest.count;
  const earlier = showAll || !quest.earlier?.length ? null : { key: "earlier", earlier: true, items: quest.earlier, count: quest.earlier.length };
  return (
    <Sheet title="Done today" onClose={onClose}>
      <div className="done-sum">
        <b>{count}</b>
        <span>{showAll ? "finished across your quests" : `finished on ${quest.name}`}</span>
      </div>
      {quest && others && (
        <div className="seg seg--block done-seg" role="group" aria-label="Show">
          <button type="button" className={"seg-btn" + (showAll ? "" : " active")} aria-pressed={!showAll} onClick={() => onView("quest")}>
            This {quest.kind} · {quest.count}
          </button>
          <button type="button" className={"seg-btn" + (showAll ? " active" : "")} aria-pressed={showAll} onClick={() => onView("all")}>
            All quests · {allCount}
          </button>
        </div>
      )}
      {!count && <p className="qs-hint done-none">Nothing finished yet today{showAll ? "" : ` on this ${quest.kind}`}. Tick a task or a step and it shows up here.</p>}
      {showAll ? (
        all.map((q) => (
          <section key={q.key} className="done-quest" aria-label={q.name}>
            <Link to={`/quests/${q.key}`} className="done-quest__name" onClick={onClose}>
              <span>{q.name}</span>
              <small>{q.count}</small>
              <ChevronRight size={15} aria-hidden="true" />
            </Link>
            <Groups groups={q.groups} kind={null} />
          </section>
        ))
      ) : (
        <Groups groups={earlier ? [...quest.groups, earlier] : quest.groups} kind={quest.kind} />
      )}
    </Sheet>
  );
}

function Groups({ groups, kind }) {
  if (!groups.length) return null;
  return (
    <div className="today-from done-groups">
      {groups.map((g) => (
        <div key={g.key} className="today-group">
          {g.earlier ? (
            <span className="today-group__label today-group__label--list done-earlier">
              <History size={13} aria-hidden="true" />
              <span className="today-group__name">On Today, finished before today</span>
              <small>{g.count}</small>
            </span>
          ) : g.camp ? (
            <Link to={`/ascent/camp/${g.camp.id}`} state={{ from: "quests" }} className="today-group__label">
              <span className="today-group__n" aria-hidden="true">
                {g.number}
              </span>
              <span className="today-group__name">{g.camp.title}</span>
              <small>{g.count}</small>
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
          ) : (
            <span className="today-group__label today-group__label--list">
              <ListTodo size={13} aria-hidden="true" />
              <span className="today-group__name">{kind ? `From this ${kind}'s list` : "From its list"}</span>
              <small>{g.count}</small>
            </span>
          )}
          <Items items={g.items} earlier={g.earlier} />
        </div>
      ))}
    </div>
  );
}

function Items({ items, sub = false, earlier = false }) {
  return (
    <ul className={"done-list" + (sub ? " done-list--subs" : "") + (earlier ? " done-list--earlier" : "")}>
      {items.map((it) => (
        <li key={it.id} className="done-item">
          <span className="done-item__check" aria-hidden="true">
            <Check size={sub ? 11 : 13} strokeWidth={3} />
          </span>
          <div className="done-item__body">
            {it.from && <small className="camp-step__from">{it.from}</small>}
            <span className="done-item__text">
              <Rich text={it.text} />
            </span>
            {it.note && (
              <small className="camp-step__note">
                <StickyNote size={11} aria-hidden="true" />
                <span>{it.note}</span>
              </small>
            )}
          </div>
          {it.subs.length > 0 && <Items items={it.subs} sub />}
        </li>
      ))}
    </ul>
  );
}
