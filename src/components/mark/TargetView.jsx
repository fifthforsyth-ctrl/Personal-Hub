import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Pencil, Plus } from "lucide-react";
import Gear from "../ascent/Gear";
import TargetFace from "./TargetFace";
import { LEVELS, ANSWERS, RANGES, DEFAULT_RANGE, inRange, average, missCounts, fullest, answersOf } from "../../lib/mark";
import { fmtShortDate, parseDateStr } from "../../lib/planDates";

// One target: every day it was shot at as a mark, how close they come on
// average, where the misses gather, and what you answered and wrote on any
// day you tap. Below that, what a bullseye takes and the four sections,
// which are yours to reword.

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dayLong(date) {
  return `${WEEKDAYS[parseDateStr(date).getDay()]}, ${fmtShortDate(date)}`;
}

function rangeKey(id) {
  return `hub.mark.range.${id}`;
}

function readRange(id) {
  try {
    const v = localStorage.getItem(rangeKey(id));
    return RANGES.some(([k]) => k === v) ? v : DEFAULT_RANGE;
  } catch {
    return DEFAULT_RANGE;
  }
}

export default function TargetView({ range: all, target: t, today, focusesById, onSetup, onEditGoal, onFocus, onAddFocus, onEditQuest, onEditLesson }) {
  const [range, setRange] = useState(() => readRange(t.key));
  const [picked, setPicked] = useState(null);
  const tabs = useRef(null);

  // Each target remembers its own range; a new target starts on its own.
  useEffect(() => {
    setRange(readRange(t.key));
    setPicked(null);
  }, [t.key]);

  useEffect(() => {
    const on = tabs.current?.querySelector('[aria-current="page"]');
    if (on && tabs.current) tabs.current.scrollLeft = Math.max(0, on.offsetLeft - tabs.current.offsetLeft - 24);
  }, [t.key]);

  function pickRange(r) {
    setRange(r);
    try {
      localStorage.setItem(rangeKey(t.key), r);
    } catch {
      /* remembering is a nicety */
    }
  }

  const list = useMemo(() => inRange(t.shots, today, range), [t.shots, today, range]);
  const noted = list.filter((s) => s.note).reverse();
  // The day shown: the one tapped, or else the latest with a line, or the latest.
  const sel = (picked && list.find((s) => s.id === picked)) || noted[0] || list[list.length - 1] || null;
  const counts = missCounts(list);
  const hot = fullest(counts);
  const bulls = list.filter((s) => s.level === 0).length;

  return (
    <div className="mk-target">
      <header className="ascent-head mk-target__head">
        <Link to="/ascent" className="btn-link mk-back">
          <ChevronLeft size={14} />
          The Range
        </Link>
        <div className="eyebrow">{t.kindLabel}</div>
        <h1 className="page-title">{t.title}</h1>
      </header>

      <nav className="mk-tabs" ref={tabs} aria-label="Targets">
        {all.all.map((x) => (
          <Link key={x.key} to={`/ascent/${x.key}`} className="mk-tab" aria-current={x.key === t.key ? "page" : undefined}>
            <Gear name={x.icon} size={14} />
            {x.short}
          </Link>
        ))}
      </nav>

      <div className="mk-target__grid">
        <section className="card mk-board-card" aria-label="The target">
          <div className="seg seg--block mk-range" role="group" aria-label="Which marks to show">
            {RANGES.map(([k, label]) => (
              <button key={k} type="button" className={"seg-btn" + (range === k ? " active" : "")} aria-pressed={range === k} onClick={() => pickRange(k)}>
                {label}
              </button>
            ))}
          </div>
          <TargetFace
            target={t}
            today={today}
            range={range}
            labels
            hot
            arrow
            selected={sel?.id ?? null}
            onPick={(s) => setPicked(s.id)}
            className="mk-face--big"
            label={`${t.title}: ${list.length} ${list.length === 1 ? "shot" : "shots"} in view`}
          />
          {list.length ? (
            <div className="mk-stats">
              <div>
                <b>{list.length}</b>
                <span>{list.length === 1 ? "shot" : "shots"}</span>
              </div>
              <div>
                <b>{bulls}</b>
                <span>{bulls === 1 ? "bullseye" : "bullseyes"}</span>
              </div>
              <div>
                <b>{average(list).toFixed(1)}</b>
                <span>average of 10</span>
              </div>
              {hot >= 0 && (
                <p className="mk-most">
                  Most misses: <b>{t.reasons[hot]}</b> · {counts[hot]} of {list.length - bulls}
                </p>
              )}
            </div>
          ) : (
            <p className="mk-empty">{t.shots.length ? "No shots in this range." : "No shots yet. Each evening's arrow lands here."}</p>
          )}
        </section>

        <div className="mk-target__side">
          {sel && <DayCard target={t} shot={sel} />}

          {noted.length > 0 && (
            <section className="card mk-notes" aria-labelledby="mk-notes-h">
              <div className="ascent-row ascent-card-head">
                <h2 className="eyebrow" id="mk-notes-h">
                  Your lines
                </h2>
                <span className="ascent-mini">
                  {noted.length} {noted.length === 1 ? "line" : "lines"}
                </span>
              </div>
              {noted.map((s) => (
                <button key={s.id} type="button" className="mk-nrow" aria-current={s.id === sel?.id ? "true" : undefined} onClick={() => setPicked(s.id)}>
                  <span className="d">{fmtShortDate(s.date)}</span>
                  <span className="t">
                    {s.note}
                    <small>
                      {LEVELS[s.level].name}
                      {s.level > 0 && s.reason != null ? ` · ${t.reasons[s.reason]}` : ""}
                    </small>
                  </span>
                </button>
              ))}
            </section>
          )}

          <section className="card mk-setup" aria-labelledby="mk-setup-h">
            <div className="ascent-row ascent-card-head">
              <h2 className="eyebrow" id="mk-setup-h">
                What a bullseye takes
              </h2>
              <button type="button" className="btn-icon ascent-edit" onClick={onSetup} aria-label="Edit what a bullseye takes" title="Edit">
                <Pencil size={14} />
              </button>
            </div>
            {t.aims.length ? (
              <ul className="mk-aims">
                {t.aims.map((a) => (
                  <li key={a.id}>
                    <span>{a.text}</span>
                    {a.focus_id && focusesById.get(a.focus_id) && <small>Time log: {focusesById.get(a.focus_id).name}</small>}
                  </li>
                ))}
              </ul>
            ) : (
              <button type="button" className="btn btn--sm btn--accent" onClick={onSetup}>
                Say what a bullseye takes
              </button>
            )}
            <div className="mk-reasons">
              <span className="ascent-mini">Why you miss, clockwise from the top right</span>
              <div className="mk-reasons__list">
                {t.reasons.map((r, k) => (
                  <span key={k} className={"chip" + (k === hot ? " mk-chip--hot" : "")}>
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {t.kind === "goal" && (
            <section className="card mk-feeds" aria-labelledby="mk-feeds-h">
              <h2 className="eyebrow" id="mk-feeds-h">
                What feeds it
              </h2>
              <ul className="feeds">
                {t.goal.focuses.map((f) => (
                  <li key={f.id}>
                    <button type="button" className="feeds__row" onClick={() => onFocus(f)}>
                      <span>
                        Focus: {f.name}
                        {f.why && <small> · {f.why}</small>}
                      </span>
                      <span className="feeds__n">{f.count} of 30 days</span>
                    </button>
                  </li>
                ))}
                {t.goal.quests.map((q) => (
                  <li key={q.id}>
                    <span>Quest: {q.title}</span>
                    <span className="feeds__n">also serves it</span>
                  </li>
                ))}
                {t.goal.lessons.map((l) => (
                  <li key={l.id}>
                    <span>Lesson: {l.title}</span>
                    <span className="feeds__n">also serves it</span>
                  </li>
                ))}
              </ul>
              <div className="ascent-goal__actions">
                <button type="button" className="btn-link" onClick={onAddFocus}>
                  <Plus size={13} />
                  {t.goal.focuses.length ? "Add a focus" : "Choose a focus"}
                </button>
                <button type="button" className="btn-link" onClick={onEditGoal}>
                  <Pencil size={13} />
                  Edit goal
                </button>
              </div>
            </section>
          )}
          {t.kind === "quest" && (
            <button type="button" className="btn-link mk-edit-ref" onClick={onEditQuest}>
              <Pencil size={13} />
              Edit the quest and its camps
            </button>
          )}
          {t.kind === "lesson" && (
            <button type="button" className="btn-link mk-edit-ref" onClick={onEditLesson}>
              <Pencil size={13} />
              Edit the lesson
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// One day's shot: where it landed, what you answered, what got in the way,
// and your line.
function DayCard({ target: t, shot: s }) {
  const answers = answersOf(s);
  return (
    <section className="card mk-day" aria-live="polite" aria-label={`${dayLong(s.date)}, ${LEVELS[s.level].name}`}>
      <div className="mk-day__when">
        <b>{dayLong(s.date)}</b>
        <span className={"mk-land" + (s.level === 0 ? " mk-land--bull" : s.level === 5 ? " mk-land--miss" : "")}>
          {LEVELS[s.level].name} · {LEVELS[s.level].pts}
        </span>
      </div>
      {answers.length > 0 && (
        <ul className="mk-did">
          {answers.map((a, i) => (
            <li key={a.aim ?? i} className={`mk-did--${a.v == null ? "skip" : ANSWERS[a.v].toLowerCase()}`}>
              <i aria-hidden="true" />
              <span>{a.text}</span>
              <small>{a.v == null ? "Skipped" : ANSWERS[a.v]}</small>
            </li>
          ))}
        </ul>
      )}
      {s.level > 0 && s.reason != null && (
        <span className="ascent-mini">
          What got in the way: <b className="mk-why">{t.reasons[s.reason]}</b>
          {s.reason_how === "guess" ? " · a guess, no line" : ""}
        </span>
      )}
      {s.note ? <blockquote className="mk-line">{s.note}</blockquote> : <p className="ascent-mini">No line that day.</p>}
    </section>
  );
}
