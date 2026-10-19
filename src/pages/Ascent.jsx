import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, ChevronDown } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchAscent,
  fetchCategories,
  saveMission,
  updateNode,
  addFocus,
  updateFocus,
  deleteFocus,
  addQuest,
  updateQuest,
  deleteQuest,
  syncCamps,
  updateCamp,
  addLesson,
  updateLesson,
  deleteLesson,
  setLessonCheckin,
} from "../lib/api";
import { buildAscent, ZONES, WINDOW_DAYS } from "../lib/ascent";
import { todayStr } from "../lib/planDates";
import { useLoad } from "../lib/useLoad";
import { playClink } from "../lib/clink";
import { haptic } from "../lib/haptics";
import { useToast, useConfirm } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import SummitScene from "../components/ascent/SummitScene";
import Footprints from "../components/ascent/Footprints";
import QuestTrail from "../components/ascent/QuestTrail";
import Ceremony from "../components/ascent/Ceremony";
import Gear from "../components/ascent/Gear";
import { MissionSheet, GoalSheet, FocusSheet, QuestSheet, LessonSheet } from "../components/ascent/Sheets";
import "../styles/ascent.css";

// Ascent: your goals on one mountain, in place of the goal wheel.
//
// Top to bottom it's the order of what you're climbing toward: the mission
// at the summit, the five lifetime goals that serve it, each with the
// footprints its focuses left in the last 30 days, the quest God has you
// on, climbed camp by camp, and the lessons you're learning, kept or
// slipped with one honest tap a day. The mountain is decoration; nothing is
// counted in minutes and nothing turns red.

const NO_ROWS = [];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Ascent() {
  const { user } = useAuth();
  const userId = user?.id;
  const today = todayStr();
  const toast = useToast();
  const confirm = useConfirm();

  const { data, error, loading, reload, mutate } = useLoad(() => (userId ? fetchAscent(userId, today) : null), [userId, today]);
  const view = useMemo(() => (data ? buildAscent(data, today) : null), [data, today]);
  const categories = useLoad(() => (userId ? fetchCategories(userId) : NO_ROWS), [userId]);

  const [open, setOpen] = useState(null); // the lifetime goal showing what feeds it
  const [sheet, setSheet] = useState(null); // { kind, ...what it edits }
  const [ceremony, setCeremony] = useState(null);
  const [planted, setPlanted] = useState(null); // { questId, turn } whose flag just went in
  const [freshPatch, setFreshPatch] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const close = useCallback(() => setSheet(null), []);

  // Every edit goes through here: one toast if it fails, the sheet closed
  // and a quiet reload if it works. Resolves to whether it worked.
  async function write(fn, failure, done) {
    try {
      await fn();
    } catch (err) {
      toast.error(err, failure);
      return false;
    }
    setSheet(null);
    if (done) toast.show(done);
    await reload();
    return true;
  }

  // --- The climb: a camp, then the summit ---------------------------------

  function reachNext(q) {
    const s = q.state;
    if (s.done) return;
    haptic("win");
    playClink();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (s.next) {
      const camp = s.next;
      const turn = s.reached + 1;
      const after = s.camps[turn] ?? null;
      mutate((d) => d && { ...d, camps: d.camps.map((c) => (c.id === camp.id ? { ...c, reached_on: today } : c)) });
      setPlanted({ questId: q.id, turn });
      clearTimeout(timer.current);
      timer.current = setTimeout(
        () =>
          setCeremony({
            summit: false,
            campNumber: turn,
            title: camp.title,
            nextTitle: after ? after.title : null,
            then: () =>
              toast.show(`Flag planted at ${camp.title}`, {
                actionLabel: "Undo",
                onAction: () => undoCamp(camp),
              }),
          }),
        reduce ? 0 : 700
      );
      updateCamp(camp.id, { reached_on: today }).catch((err) => {
        toast.error(err, "Couldn't mark that camp reached.");
        reload();
      });
      return;
    }

    mutate((d) => d && { ...d, quests: d.quests.map((x) => (x.id === q.id ? { ...x, status: "done", finished_on: today } : x)) });
    setPlanted({ questId: q.id, turn: s.camps.length + 1 });
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () =>
        setCeremony({
          summit: true,
          title: q.title,
          then: () => {
            setFreshPatch(q.id);
            toast.show(`Patch earned: ${q.title}`, { actionLabel: "Undo", onAction: () => undoSummit(q) });
          },
        }),
      reduce ? 0 : 700
    );
    updateQuest(q.id, { status: "done", finished_on: today }).catch((err) => {
      toast.error(err, "Couldn't mark the summit reached.");
      reload();
    });
  }

  async function undoCamp(camp) {
    mutate((d) => d && { ...d, camps: d.camps.map((c) => (c.id === camp.id ? { ...c, reached_on: null } : c)) });
    setPlanted(null);
    try {
      await updateCamp(camp.id, { reached_on: null });
    } catch (err) {
      toast.error(err, "Couldn't take that back.");
      reload();
    }
  }

  async function undoSummit(q) {
    mutate((d) => d && { ...d, quests: d.quests.map((x) => (x.id === q.id ? { ...x, status: "on", finished_on: null } : x)) });
    setPlanted(null);
    setFreshPatch(null);
    try {
      await updateQuest(q.id, { status: "on", finished_on: null });
    } catch (err) {
      toast.error(err, "Couldn't take that back.");
      reload();
    }
  }

  // --- A lesson's honest tap ------------------------------------------------

  async function answer(lesson, kept) {
    if (kept === true) {
      haptic("win");
      playClink();
    }
    mutate(
      (d) =>
        d && {
          ...d,
          checkins: [
            ...d.checkins.filter((c) => !(c.lesson_id === lesson.id && c.date === today)),
            ...(kept === null ? [] : [{ lesson_id: lesson.id, date: today, kept }]),
          ],
        }
    );
    if (kept === true) toast.show(`Kept: ${lesson.title}`);
    else if (kept === false) toast.show("Noted. Tomorrow is a new step.");
    try {
      await setLessonCheckin(userId, lesson.id, today, kept);
    } catch (err) {
      toast.error(err, "Couldn't save that.");
      reload();
    }
  }

  // --- Saving from the sheets -------------------------------------------------

  const saveMissionFrom = (v) => write(() => saveMission(userId, v), "Couldn't save your mission.", "Mission saved");

  const saveGoalFrom = (goal) => (v) => write(() => updateNode(goal.id, v), "Couldn't save that goal.", "Goal saved");

  const saveFocusFrom = (focus) => (v) =>
    write(
      () =>
        focus
          ? updateFocus(focus.id, v)
          : addFocus(userId, { goalId: v.goal_id, name: v.name, why: v.why, categories: v.categories, position: data?.focuses.length ?? 0 }),
      "Couldn't save that focus.",
      focus ? "Focus saved" : `Added ${v.name}`
    );

  async function removeFocus(focus) {
    if (!(await confirm({ title: `Remove “${focus.name}”?`, body: "Its footprints stop showing. Your time log stays as it is.", confirmLabel: "Remove focus" }))) return;
    await write(() => deleteFocus(focus.id), "Couldn't remove that focus.", `Removed ${focus.name}`);
  }

  const saveQuestFrom = (quest) => (v) =>
    write(
      async () => {
        if (!quest) {
          await addQuest(userId, { title: v.title, note: v.note, goalId: v.goal_id, status: v.status, today, camps: v.camps, position: data?.quests.length ?? 0 });
          return;
        }
        const finished = v.status === "done" ? quest.finished_on ?? today : null;
        await updateQuest(quest.id, { title: v.title, note: v.note, goal_id: v.goal_id, status: v.status, finished_on: finished });
        await syncCamps(userId, quest.id, v.camps, quest.state.camps);
      },
      "Couldn't save that quest.",
      quest ? "Quest saved" : v.status === "done" ? `Added ${v.title} behind you` : `Added ${v.title}`
    );

  async function removeQuest(quest) {
    if (!(await confirm({ title: `Delete “${quest.title}”?`, body: "Its camps go with it. This can't be undone.", confirmLabel: "Delete quest" }))) return;
    await write(() => deleteQuest(quest.id), "Couldn't delete that quest.", `Deleted ${quest.title}`);
  }

  const saveLessonFrom = (lesson) => (v) =>
    write(
      () =>
        lesson
          ? updateLesson(lesson.id, {
              title: v.title,
              question: v.question,
              goal_id: v.goal_id,
              status: v.status,
              ended_on: v.status === "learning" ? null : lesson.ended_on ?? today,
            })
          : addLesson(userId, { title: v.title, question: v.question, goalId: v.goal_id, today, position: data?.lessons.length ?? 0 }),
      "Couldn't save that lesson.",
      lesson ? "Lesson saved" : `Added ${v.title}`
    );

  async function removeLesson(lesson) {
    if (!(await confirm({ title: `Delete “${lesson.title}”?`, body: "Its days kept and slipped go with it. This can't be undone.", confirmLabel: "Delete lesson" }))) return;
    await write(() => deleteLesson(lesson.id), "Couldn't delete that lesson.", `Deleted ${lesson.title}`);
  }

  // ---------------------------------------------------------------------------

  const goals = view?.goals ?? NO_ROWS;
  const quests = view?.quests ?? NO_ROWS;
  const patches = view?.patches ?? NO_ROWS;

  return (
    <div className="page ascent">
      <header className="ascent-head">
        <div className="eyebrow">My goals</div>
        <h1 className="page-title">Ascent</h1>
      </header>

      {error && <LoadError what="your goals" error={error} onRetry={reload} stale={Boolean(data)} />}
      {!view && !error && loading && <p className="empty">Loading…</p>}

      {view && (
        <div className="ascent-grid">
          <section className="card card--flush ascent-summit" aria-labelledby="ascent-mission-h">
            <SummitScene climb={view.climb} name={view.mission?.summit || "My mission"} />
            <div className="ascent-mission">
              <div className="ascent-row">
                <h2 className="eyebrow" id="ascent-mission-h">
                  The summit · my mission
                </h2>
                <button type="button" className="btn-icon ascent-edit" onClick={() => setSheet({ kind: "mission" })} aria-label="Edit your mission" title="Edit your mission">
                  <Pencil size={14} />
                </button>
              </div>
              {view.mission ? (
                <p className="ascent-creed">{view.mission.statement}</p>
              ) : (
                <button type="button" className="btn btn--sm btn--accent ascent-first" onClick={() => setSheet({ kind: "mission" })}>
                  Write your mission
                </button>
              )}
            </div>
          </section>

          <section className="card ascent-goals" aria-labelledby="ascent-goals-h">
            <div className="ascent-row ascent-card-head">
              <h2 className="eyebrow" id="ascent-goals-h">
                Lifetime goals
              </h2>
              <span className="ascent-mini">last {WINDOW_DAYS} days</span>
            </div>
            {goals.map((g) => (
              <GoalRow
                key={g.id}
                goal={g}
                open={open === g.id}
                onToggle={() => setOpen((cur) => (cur === g.id ? null : g.id))}
                onEdit={() => setSheet({ kind: "goal", goal: g })}
                onFocus={(f) => setSheet({ kind: "focus", focus: f })}
                onAddFocus={() => setSheet({ kind: "focus", focus: null, goalId: g.id })}
              />
            ))}
            {!goals.length && <p className="empty">Your lifetime goals are the top goals of your goal wheel. There aren't any yet.</p>}
          </section>

          <div className="ascent-side">
            {quests.map((q, i) => (
              <QuestCard
                key={q.id}
                quest={q}
                planted={planted?.questId === q.id ? planted.turn : null}
                onReach={() => reachNext(q)}
                onEdit={() => setSheet({ kind: "quest", quest: q })}
              >
                {i === quests.length - 1 && patches.length > 0 && (
                  <Patches patches={patches} fresh={freshPatch} onOpen={(p) => setSheet({ kind: "quest", quest: p })} />
                )}
              </QuestCard>
            ))}

            {!quests.length && (
              <section className="card ascent-quest" aria-labelledby="ascent-quests-h">
                <h2 className="eyebrow" id="ascent-quests-h">
                  Quests
                </h2>
                <p className="empty">Missions you feel God calling you to. Add one and climb it camp by camp.</p>
                {patches.length > 0 && <Patches patches={patches} fresh={freshPatch} onOpen={(p) => setSheet({ kind: "quest", quest: p })} />}
              </section>
            )}

            <div className="ascent-adds">
              <button type="button" className="btn btn--sm btn--on-page" onClick={() => setSheet({ kind: "quest", quest: null })}>
                <Plus size={14} />
                Add a quest
              </button>
              {view.setAside.map((q) => (
                <button key={q.id} type="button" className="chip chip--tap ascent-aside" onClick={() => setSheet({ kind: "quest", quest: q })} title="Set aside">
                  {q.title}
                </button>
              ))}
            </div>

            <section className="card ascent-lessons" aria-labelledby="ascent-lessons-h">
              <div className="ascent-row ascent-card-head">
                <h2 className="eyebrow" id="ascent-lessons-h">
                  Lessons from God
                </h2>
                <span className="ascent-mini">this week</span>
              </div>
              {view.lessons.map((l) => (
                <LessonRow key={l.id} lesson={l} onAnswer={answer} onEdit={() => setSheet({ kind: "lesson", lesson: l })} />
              ))}
              {!view.lessons.length && <p className="empty">Changes to your character you feel God teaching you, kept one honest day at a time.</p>}
              <div className="ascent-card-foot">
                <button type="button" className="btn btn--sm" onClick={() => setSheet({ kind: "lesson", lesson: null })}>
                  <Plus size={14} />
                  Add a lesson
                </button>
              </div>
              {view.learned.length > 0 && (
                <div className="ascent-learned">
                  <span className="ascent-mini">Learned</span>
                  {view.learned.map((l) => (
                    <button key={l.id} type="button" className="chip chip--tap" onClick={() => setSheet({ kind: "lesson", lesson: l })}>
                      {l.title}
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {sheet?.kind === "mission" && <MissionSheet mission={view?.mission} onSave={saveMissionFrom} onClose={close} />}
      {sheet?.kind === "goal" && <GoalSheet goal={sheet.goal} onSave={saveGoalFrom(sheet.goal)} onClose={close} />}
      {sheet?.kind === "focus" && (
        <FocusSheet
          focus={sheet.focus}
          goalId={sheet.goalId}
          goals={goals}
          categories={categories.data ?? NO_ROWS}
          onSave={saveFocusFrom(sheet.focus)}
          onDelete={() => removeFocus(sheet.focus)}
          onClose={close}
        />
      )}
      {sheet?.kind === "quest" && (
        <QuestSheet
          quest={sheet.quest}
          camps={sheet.quest?.state.camps}
          goals={goals}
          today={today}
          onSave={saveQuestFrom(sheet.quest)}
          onDelete={() => removeQuest(sheet.quest)}
          onClose={close}
        />
      )}
      {sheet?.kind === "lesson" && (
        <LessonSheet lesson={sheet.lesson} goals={goals} onSave={saveLessonFrom(sheet.lesson)} onDelete={() => removeLesson(sheet.lesson)} onClose={close} />
      )}

      {ceremony && (
        <Ceremony
          summit={ceremony.summit}
          campNumber={ceremony.campNumber}
          title={ceremony.title}
          nextTitle={ceremony.nextTitle}
          onDone={() => {
            const then = ceremony.then;
            setCeremony(null);
            then?.();
          }}
        />
      )}
    </div>
  );
}

// --- A lifetime goal ----------------------------------------------------------

function GoalRow({ goal: g, open, onToggle, onEdit, onFocus, onAddFocus }) {
  return (
    <div className={"ascent-goal" + (open ? " open" : "")}>
      <button type="button" className="ascent-goal__head" aria-expanded={open} onClick={onToggle}>
        <span className="ascent-goal__top">
          <span className="ascent-goal__name">
            <Gear name={g.gear} />
            <b>{g.title}</b>
          </span>
          <span className={`zone zone--${g.zone}`}>{ZONES[g.zone]}</span>
        </span>
        <span className="ascent-goal__fed">
          {g.fed}
          <ChevronDown size={13} className="ascent-goal__chev" aria-hidden="true" />
        </span>
        {g.focuses.length > 0 && <Footprints prints={g.prints} label={`Footprints: ${g.count} of the last ${WINDOW_DAYS} days`} />}
      </button>
      {open && (
        <div className="ascent-goal__more">
          <ul className="feeds">
            {g.focuses.map((f) => (
              <li key={f.id}>
                <button type="button" className="feeds__row" onClick={() => onFocus(f)}>
                  <span>
                    Focus: {f.name}
                    {f.why && <small> · {f.why}</small>}
                  </span>
                  <span className="feeds__n">
                    {f.count} of {WINDOW_DAYS} days
                  </span>
                </button>
              </li>
            ))}
            {g.quests.map((q) => (
              <li key={q.id}>
                <span>Quest: {q.title}</span>
                <span className="feeds__n">also serves it</span>
              </li>
            ))}
            {g.lessons.map((l) => (
              <li key={l.id}>
                <span>Lesson: {l.title}</span>
                <span className="feeds__n">also serves it</span>
              </li>
            ))}
            <li>
              <span>Serves</span>
              <span className="feeds__n">your mission</span>
            </li>
          </ul>
          <div className="ascent-goal__actions">
            <button type="button" className="btn-link" onClick={onAddFocus}>
              <Plus size={13} />
              {g.focuses.length ? "Add a focus" : "Choose a focus"}
            </button>
            <button type="button" className="btn-link" onClick={onEdit}>
              <Pencil size={13} />
              Edit goal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- A quest --------------------------------------------------------------------

function Serves({ serves }) {
  return (
    <span className={"serves" + (serves.kind === "mission" ? " serves--mission" : "")}>
      <Gear name={serves.gear} size={13} />
      {serves.label}
    </span>
  );
}

function QuestCard({ quest: q, planted, onReach, onEdit, children }) {
  const s = q.state;
  const n = s.camps.length;
  return (
    <section className="card ascent-quest" aria-label={`Quest: ${q.title}`}>
      <div className="ascent-row">
        <span className="eyebrow">Quest</span>
        <Serves serves={q.serves} />
      </div>
      <button type="button" className="ascent-quest__title" onClick={onEdit} title="Edit the quest">
        {q.title}
      </button>
      {q.note && <p className="ascent-quest__note">{q.note}</p>}
      <QuestTrail quest={q} state={s} planted={planted} />
      {n > 0 && (
        <div className="next-camp">
          <div>
            <span className="ascent-mini">{s.next ? "Next camp" : "The summit"}</span>
            <b>{s.next ? s.next.title : q.title}</b>
          </div>
          <span className="next-camp__n">{s.next ? `Camp ${s.reached + 1} of ${n}` : "Last climb"}</span>
        </div>
      )}
      <button type="button" className="btn btn--accent btn--block ascent-reach" onClick={onReach}>
        {s.next ? "Mark camp reached" : "Mark the summit reached"}
      </button>
      {n === 0 && (
        <button type="button" className="btn-link ascent-quest__camps" onClick={onEdit}>
          <Plus size={13} />
          Add camps along the way
        </button>
      )}
      {children}
    </section>
  );
}

function PatchMark() {
  return (
    <svg viewBox="0 0 34 34" aria-hidden="true">
      <circle cx="17" cy="17" r="15.6" fill="#fff" stroke="#141414" strokeWidth="1.5" />
      <circle cx="17" cy="17" r="12.4" fill="none" stroke="#141414" strokeOpacity="0.45" strokeWidth="0.9" strokeDasharray="1.6 1.6" />
      <path d="M8.6 23 14.8 13.2l2.4 3.4 1.6-2.2 6.6 8.6Z" fill="#141414" />
      <path d="M14.8 13.2V8" stroke="#141414" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M15.2 8.2h4.4l-1.2 1.6 1.2 1.6h-4.4z" fill="#f26a1b" />
    </svg>
  );
}

// Finished quests, kept as patches.
function Patches({ patches, fresh, onOpen }) {
  return (
    <div className="patches">
      <span className="ascent-mini">Behind you</span>
      <div className="patch-row">
        {patches.map((p) => (
          <button key={p.id} type="button" className={"patch" + (p.id === fresh ? " new" : "")} onClick={() => onOpen(p)}>
            <PatchMark />
            <span>{p.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// --- A lesson -------------------------------------------------------------------

function dayClass(d) {
  if (d.before) return "day before";
  if (d.isToday) return "day today" + (d.kept === true ? " kept" : d.kept === false ? " slip" : "");
  if (d.ahead) return "day ahead";
  return "day" + (d.kept === true ? " kept" : d.kept === false ? " slip" : "");
}

function daySays(d, i) {
  const name = WEEKDAYS[i];
  if (d.before) return `${name}: before it began`;
  if (d.ahead) return `${name}: still ahead`;
  if (d.kept === true) return `${name}: kept`;
  if (d.kept === false) return `${name}: slipped`;
  return `${name}: ${d.isToday ? "not answered yet" : "no answer"}`;
}

function LessonRow({ lesson: l, onAnswer, onEdit }) {
  return (
    <div className="lesson">
      <div className="ascent-row">
        <button type="button" className="lesson__title" onClick={onEdit} title="Edit the lesson">
          {l.title}
        </button>
        <Serves serves={l.serves} />
      </div>
      {l.question && <p className="lesson__q">{l.question}</p>}
      <div className="week" role="img" aria-label={`This week. ${l.week.map(daySays).join(". ")}.`}>
        {l.week.map((d) => (
          <span key={d.date} className={dayClass(d)} aria-hidden="true">
            <i />
            {d.letter}
          </span>
        ))}
      </div>
      <div className="lesson__foot">
        <span className="ascent-mini">{l.note}</span>
        <div className="lesson__seg" role="group" aria-label={`Today, ${l.title}`}>
          <button type="button" className="kept" aria-pressed={l.today === true} onClick={() => onAnswer(l, l.today === true ? null : true)}>
            Kept it
          </button>
          <button type="button" className="slip" aria-pressed={l.today === false} onClick={() => onAnswer(l, l.today === false ? null : false)}>
            Slipped
          </button>
        </div>
      </div>
    </div>
  );
}
