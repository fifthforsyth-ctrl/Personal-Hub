import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BookOpen, Castle, ChevronRight, Flag, ListChecks, Pencil, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchRange,
  fetchCategories,
  fetchStepTally,
  fetchSectionTally,
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
  saveTargetSetup,
} from "../lib/api";
import { buildAscent } from "../lib/ascent";
import { campProgress, stepsLine } from "../lib/camp";
import { buildRange, bowLine, bowProgress, tierOf, TIERS, LEVELS } from "../lib/mark";
import { todayStr } from "../lib/planDates";
import { useLoad } from "../lib/useLoad";
import { playClink } from "../lib/clink";
import { haptic } from "../lib/haptics";
import { useToast, useConfirm } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import QuestTrail from "../components/ascent/QuestTrail";
import Ceremony from "../components/ascent/Ceremony";
import Gear from "../components/ascent/Gear";
import { MissionSheet, GoalSheet, FocusSheet, QuestSheet, LessonSheet } from "../components/ascent/Sheets";
import TargetFace from "../components/mark/TargetFace";
import TargetSheet from "../components/mark/TargetSheet";
import TargetView from "../components/mark/TargetView";
import Bow, { BowRack } from "../components/mark/Bow";
import "../styles/ascent.css";
import "../styles/mark.css";
import "../styles/camp.css";

// The Range: your goals as targets, in place of the goal wheel.
//
// Sin means missing the mark, so every lifetime goal, the quest God has you
// on and each lesson you're learning is a target, and every evening's
// answers put an arrow in each. The page opens on your bow, which upgrades
// as bullseyes add up, with your mission as what every shot is aimed at,
// then a small target for each with its last 30 days of marks. Tap one for
// the whole target (at /ascent/<its id>): every mark, what you answered and
// wrote that day, and what a bullseye takes. The quest's camps stay here
// too, each a tap from its own page of steps (/ascent/camp/<id>), and a
// lesson can have a mountain of its own beside it. Nothing turns red; a
// miss is a mark, not a mark against you.

const NO_ROWS = [];

export default function Ascent() {
  const { user } = useAuth();
  const userId = user?.id;
  const today = todayStr();
  const toast = useToast();
  const confirm = useConfirm();
  const { ref } = useParams();

  const { data, error, loading, reload, mutate } = useLoad(() => (userId ? fetchRange(userId, today) : null), [userId, today]);
  const view = useMemo(() => (data ? buildAscent(data, today) : null), [data, today]);
  const range = useMemo(() => (view ? buildRange(view, data.marks, today) : null), [view, data, today]);
  const categories = useLoad(() => (userId ? fetchCategories(userId) : NO_ROWS), [userId]);
  const tally = useLoad(() => (userId ? Promise.all([fetchStepTally(userId), fetchSectionTally(userId)]) : NO_ROWS), [userId]);
  const progress = useMemo(() => campProgress(tally.data?.[0], tally.data?.[1]), [tally.data]);

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

  // A lesson and its own mountain: made with its first camp, kept in step
  // with the lesson's name and goal, and gone once its last camp is.
  const saveLessonFrom = (lesson) => (v) =>
    write(
      async () => {
        let lessonId = lesson?.id;
        if (lesson) {
          await updateLesson(lesson.id, {
            title: v.title,
            question: v.question,
            goal_id: v.goal_id,
            status: v.status,
            ended_on: v.status === "learning" ? null : lesson.ended_on ?? today,
          });
        } else {
          lessonId = await addLesson(userId, { title: v.title, question: v.question, goalId: v.goal_id, today, position: data?.lessons.length ?? 0 });
        }
        const m = lesson?.mountain ?? null;
        if (!m && v.camps.length) {
          await addQuest(userId, { title: v.title, goalId: v.goal_id, lessonId, status: "on", today, camps: v.camps, position: data?.quests.length ?? 0 });
        } else if (m && !v.camps.length) {
          await deleteQuest(m.id);
        } else if (m) {
          if (m.title !== v.title || m.goal_id !== v.goal_id) await updateQuest(m.id, { title: v.title, goal_id: v.goal_id });
          await syncCamps(userId, m.id, v.camps, m.state.camps);
        }
      },
      "Couldn't save that lesson.",
      lesson ? "Lesson saved" : `Added ${v.title}`
    );

  async function removeLesson(lesson) {
    if (!(await confirm({ title: `Delete “${lesson.title}”?`, body: "Its days kept and slipped go with it. This can't be undone.", confirmLabel: "Delete lesson" }))) return;
    await write(() => deleteLesson(lesson.id), "Couldn't delete that lesson.", `Deleted ${lesson.title}`);
  }

  // What a bullseye takes, and the four sections. An aim a shot already
  // answered is retired rather than deleted, so that day still reads true.
  const saveTargetFrom = (t) => (v) => {
    const answered = new Set(t.shots.flatMap((s) => (Array.isArray(s.answers) ? s.answers.map((a) => a?.aim) : [])).filter(Boolean));
    const refCol = t.kind === "goal" ? { goal_id: t.key } : t.kind === "quest" ? { quest_id: t.key } : { lesson_id: t.key };
    return write(() => saveTargetSetup(userId, refCol, v, t.aims, { answered, today }), "Couldn't save that target.", "Saved");
  };

  // ---------------------------------------------------------------------------

  const goals = view?.goals ?? NO_ROWS;
  const quests = view?.quests ?? NO_ROWS;
  const climbs = view?.climbs ?? NO_ROWS;
  const patches = view?.patches ?? NO_ROWS;
  const bare = (view?.lessons ?? NO_ROWS).filter((l) => !l.mountain);
  const stepsIn = (campId) => progress.get(campId)?.total ?? 0;
  // A finished mountain opens what it was: its quest, or its lesson.
  const openPatch = (p) =>
    p.lesson_id ? setSheet({ kind: "lesson", lesson: [...(view?.lessons ?? []), ...(view?.learned ?? [])].find((l) => l.id === p.lesson_id) ?? p.lesson }) : setSheet({ kind: "quest", quest: p });
  const focuses = useMemo(() => goals.flatMap((g) => g.focuses), [goals]);
  const focusesById = useMemo(() => new Map(focuses.map((f) => [f.id, f])), [focuses]);
  const target = ref && range ? range.all.find((t) => t.key === ref) ?? null : null;

  const sheets = (
    <>
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
          stepsIn={stepsIn}
          goals={goals}
          today={today}
          onSave={saveQuestFrom(sheet.quest)}
          onDelete={() => removeQuest(sheet.quest)}
          onClose={close}
        />
      )}
      {sheet?.kind === "lesson" && (
        <LessonSheet
          lesson={sheet.lesson}
          camps={sheet.lesson?.mountain?.state.camps}
          stepsIn={stepsIn}
          goals={goals}
          today={today}
          mountainFirst={sheet.mountain}
          onSave={saveLessonFrom(sheet.lesson)}
          onDelete={() => removeLesson(sheet.lesson)}
          onClose={close}
        />
      )}
      {sheet?.kind === "target" && <TargetSheet target={sheet.target} focuses={focuses} onSave={saveTargetFrom(sheet.target)} onClose={close} />}
    </>
  );

  // --- One target -------------------------------------------------------------

  if (ref) {
    return (
      <div className="page ascent mark">
        {error && <LoadError what="your goals" error={error} onRetry={reload} stale={Boolean(data)} />}
        {!view && !error && loading && <p className="empty">Loading…</p>}
        {range && !target && (
          <div className="ascent-head">
            <p className="empty">That target isn't on your range anymore.</p>
            <Link to="/ascent" className="btn btn--sm">
              Back to the range
            </Link>
          </div>
        )}
        {target && (
          <TargetView
            range={range}
            target={target}
            today={today}
            focusesById={focusesById}
            onSetup={() => setSheet({ kind: "target", target })}
            onEditGoal={() => setSheet({ kind: "goal", goal: target.goal })}
            onFocus={(f) => setSheet({ kind: "focus", focus: f })}
            onAddFocus={() => setSheet({ kind: "focus", focus: null, goalId: target.key })}
            onEditQuest={() => setSheet({ kind: "quest", quest: view.quests.find((q) => q.id === target.key) ?? target.quest })}
            onEditLesson={() => setSheet({ kind: "lesson", lesson: target.lesson })}
          />
        )}
        {sheets}
      </div>
    );
  }

  // --- The range ----------------------------------------------------------------

  const tier = range ? tierOf(range.bullseyes) : 0;

  return (
    <div className="page ascent mark">
      <header className="ascent-head ascent-head--range">
        <div>
          <div className="eyebrow">My goals</div>
          <h1 className="page-title">The Range</h1>
        </div>
        <div className="ascent-head__links">
          <Link to="/quests" className="btn btn--sm btn--on-page">
            <ListChecks size={14} />
            Quests
          </Link>
          <Link to="/village" className="btn btn--sm btn--on-page">
            <Castle size={14} />
            Village
          </Link>
          <Link to="/ascent/plans" className="btn btn--sm btn--on-page">
            <BookOpen size={14} />
            Plans
          </Link>
        </div>
      </header>

      {error && <LoadError what="your goals" error={error} onRetry={reload} stale={Boolean(data)} />}
      {!view && !error && loading && <p className="empty">Loading…</p>}

      {view && range && (
        <div className="ascent-grid">
          <section className="card mk-bow-card" aria-labelledby="mk-bow-h">
            <div className="mk-bow-card__top">
              <Bow tier={tier} pull={0.5} width={58} height={88} />
              <div className="mk-bow-card__txt">
                <h2 className="eyebrow" id="mk-bow-h">
                  Your bow
                </h2>
                <b>{TIERS[tier].name}</b>
                <span className="ascent-mini">{bowLine(range.bullseyes)}</span>
                <div className="mk-bar" aria-hidden="true">
                  <i style={{ width: `${Math.round(bowProgress(range.bullseyes) * 100)}%` }} />
                </div>
              </div>
            </div>
            <div className="mk-aim">
              <div className="ascent-row">
                <span className="eyebrow">Aiming at · my mission</span>
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
            <BowRack bullseyes={range.bullseyes} />
          </section>

          <section className="card mk-minis-card mk-goals-card" aria-labelledby="mk-goals-h">
            <div className="ascent-row ascent-card-head">
              <h2 className="eyebrow" id="mk-goals-h">
                Lifetime goals
              </h2>
              <span className="ascent-mini">last 30 days</span>
            </div>
            <div className="mk-minis">
              {range.goals.map((t) => (
                <MiniTarget key={t.key} target={t} today={today} />
              ))}
            </div>
            {!range.goals.length && <p className="empty">Your lifetime goals are the top goals of your goal wheel. There aren't any yet.</p>}
          </section>

          <section className={`card mk-minis-card${quests.length || patches.length ? "" : " mk-wide"}`} aria-labelledby="mk-more-h">
            <div className="ascent-row ascent-card-head">
              <h2 className="eyebrow" id="mk-more-h">
                Quest and lessons
              </h2>
              <span className="ascent-mini">last 30 days</span>
            </div>
            {range.quests.length + range.lessons.length > 0 ? (
              <div className="mk-minis">
                {[...range.quests, ...range.lessons].map((t) => (
                  <MiniTarget key={t.key} target={t} today={today} />
                ))}
              </div>
            ) : (
              <p className="empty">The quest God has you on and the lessons you're learning each get a target too.</p>
            )}
            <div className="ascent-card-foot mk-adds">
              <button type="button" className="btn btn--sm" onClick={() => setSheet({ kind: "quest", quest: null })}>
                <Plus size={14} />
                Add a quest
              </button>
              <button type="button" className="btn btn--sm" onClick={() => setSheet({ kind: "lesson", lesson: null })}>
                <Plus size={14} />
                Add a lesson
              </button>
            </div>
            {(view.learned.length > 0 || view.setAside.length > 0) && (
              <div className="ascent-learned">
                {view.learned.length > 0 && <span className="ascent-mini">Learned</span>}
                {view.learned.map((l) => (
                  <button key={l.id} type="button" className="chip chip--tap" onClick={() => setSheet({ kind: "lesson", lesson: l })}>
                    {l.title}
                  </button>
                ))}
                {view.setAside.length > 0 && <span className="ascent-mini">Set aside</span>}
                {view.setAside.map((q) => (
                  <button key={q.id} type="button" className="chip chip--tap ascent-aside" onClick={() => setSheet({ kind: "quest", quest: q })}>
                    {q.title}
                  </button>
                ))}
              </div>
            )}
          </section>

          {(quests.length > 0 || patches.length > 0 || climbs.length > 0 || bare.length > 0) && (
            <div className="ascent-side">
              {quests.map((q, i) => (
                <QuestCard
                  key={q.id}
                  quest={q}
                  progress={progress}
                  planted={planted?.questId === q.id ? planted.turn : null}
                  onReach={() => reachNext(q)}
                  onEdit={() => setSheet({ kind: "quest", quest: q })}
                >
                  {i === quests.length - 1 && patches.length > 0 && <Patches patches={patches} fresh={freshPatch} onOpen={openPatch} />}
                </QuestCard>
              ))}
              {!quests.length && patches.length > 0 && (
                <section className="card ascent-quest" aria-label="Quests behind you">
                  <Patches patches={patches} fresh={freshPatch} onOpen={openPatch} />
                </section>
              )}
              {climbs.map((q) => (
                <QuestCard
                  key={q.id}
                  quest={q}
                  kind="Lesson"
                  progress={progress}
                  planted={planted?.questId === q.id ? planted.turn : null}
                  onReach={() => reachNext(q)}
                  onEdit={() => setSheet({ kind: "lesson", lesson: view.lessons.find((l) => l.id === q.lesson_id) })}
                />
              ))}
              {bare.length > 0 && (
                <section className="card ascent-bare" aria-labelledby="ascent-bare-h">
                  <h2 className="eyebrow" id="ascent-bare-h">
                    A mountain for a lesson
                  </h2>
                  <p className="ascent-mini">A lesson can be climbed camp by camp too, with steps at each camp.</p>
                  <div className="ascent-bare__list">
                    {bare.map((l) => (
                      <button key={l.id} type="button" className="btn btn--sm btn--on-page" onClick={() => setSheet({ kind: "lesson", lesson: l, mountain: true })}>
                        <Plus size={14} />
                        {l.title}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {sheets}

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

// --- A small target -------------------------------------------------------------

// Its last 30 days of marks, its name, and tonight's landing or not yet.
function MiniTarget({ target: t, today }) {
  const state = t.today ? LEVELS[t.today.level].name : t.shots.length ? "Not yet tonight" : "No marks yet";
  return (
    <Link to={`/ascent/${t.key}`} className="mk-mini" aria-label={`${t.title}: ${state}`}>
      <TargetFace target={t} today={today} range="30" mini arrow />
      <b>
        <Gear name={t.icon} size={14} />
        {t.short}
      </b>
      <small className={t.today ? "done" : undefined}>{state}</small>
    </Link>
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

function QuestCard({ quest: q, kind = "Quest", progress, planted, onReach, onEdit, children }) {
  const s = q.state;
  const n = s.camps.length;
  return (
    <section className="card ascent-quest" aria-label={`${kind}: ${q.title}`}>
      <div className="ascent-row">
        <span className="eyebrow">{kind === "Lesson" ? "Lesson · its mountain" : kind}</span>
        <Serves serves={q.serves} />
      </div>
      <button type="button" className="ascent-quest__title" onClick={onEdit} title={kind === "Lesson" ? "Edit the lesson and its camps" : "Edit the quest"}>
        {q.title}
      </button>
      {q.note && <p className="ascent-quest__note">{q.note}</p>}
      <QuestTrail quest={q} state={s} planted={planted} />
      {n > 0 && <CampList state={s} progress={progress} />}
      <button type="button" className="btn btn--accent btn--block ascent-reach" onClick={onReach}>
        {s.next ? `Mark ${s.next.title} reached` : "Mark the summit reached"}
      </button>
      {n === 0 ? (
        <button type="button" className="btn-link ascent-quest__camps" onClick={onEdit}>
          <Plus size={13} />
          Add camps along the way
        </button>
      ) : (
        <Link to="/ascent/plans" className="btn-link ascent-quest__camps">
          <BookOpen size={13} />
          Bring in a plan for its camps
        </Link>
      )}
      <Link to={`/quests/${q.id}`} className="btn-link ascent-quest__camps">
        <ListChecks size={13} />
        Its daily list and notes
      </Link>
      {children}
    </section>
  );
}

// The camps, first to last: each one's steps done, and a tap to its page.
function CampList({ state: s, progress }) {
  return (
    <ol className="camp-list">
      {s.camps.map((c, i) => {
        const p = progress?.get(c.id) ?? { done: 0, total: 0 };
        const next = s.next?.id === c.id;
        return (
          <li key={c.id}>
            <Link to={`/ascent/camp/${c.id}`} className={"camp-link" + (c.reached_on ? " reached" : "") + (next ? " next" : "")}>
              <span className="camp-link__n" aria-hidden="true">
                {c.reached_on ? <Flag size={12} /> : i + 1}
              </span>
              <span className="camp-link__t">
                <b>{c.title}</b>
                <small>
                  {next ? "Next camp · " : ""}
                  {stepsLine(p)}
                </small>
              </span>
              {p.total > 0 && (
                <span className="camp-link__bar" aria-hidden="true">
                  <i style={{ width: `${Math.round((p.done / p.total) * 100)}%` }} />
                </span>
              )}
              <ChevronRight size={15} className="camp-link__go" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ol>
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
