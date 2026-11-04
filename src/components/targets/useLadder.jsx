import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
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
} from "../../lib/api";
import { buildAscent } from "../../lib/ascent";
import { campProgress } from "../../lib/camp";
import { buildRange } from "../../lib/mark";
import { focusWeekOf, countsToward, orderGoals } from "../../lib/focus";
import { todayStr } from "../../lib/planDates";
import { useLoad } from "../../lib/useLoad";
import { playClink } from "../../lib/clink";
import { haptic } from "../../lib/haptics";
import { announceChange } from "../today/announce";
import { useToast, useConfirm } from "../ui/Feedback";
import Ceremony from "../ascent/Ceremony";
import { MissionSheet, GoalSheet, FocusSheet, QuestSheet, LessonSheet } from "../ascent/Sheets";
import TargetSheet from "../mark/TargetSheet";
import { useFocusWeek } from "../focus/useFocusWeek";

// The ladder as the Targets tab and every target's page load it: the
// mission, the lifetime goals with their focuses, the quests and lessons
// with their camps, each one's target on the range, and this week's focus.
// Also every edit the Range used to make (the sheets), and reaching the
// next camp or the summit with its ceremony.
//
// `overlay` is the open sheet and the ceremony: render it once on the page.
// `open({ kind, ... })` opens a sheet: "mission", "goal" ({ goal }),
// "focus" ({ focus, goalId }), "quest" ({ quest }; null for a new one),
// "lesson" ({ lesson, mountain }), "target" ({ target }).
// `onSaved` runs after every edit that worked, after the ladder reloads (a
// page with more of its own to read, the quest's lists, reads them then).

const NO_ROWS = [];

// Where a patch just earned waits for Targets to open "Behind you" on it.
export const FRESH_PATCH_KEY = "hub:freshPatch";

export function useLadder({ onSaved } = {}) {
  const { user } = useAuth();
  const userId = user?.id;
  const today = todayStr();
  const toast = useToast();
  const confirm = useConfirm();

  const { data, error, loading, reload, mutate } = useLoad(() => (userId ? fetchRange(userId, today) : null), [userId, today]);
  const view = useMemo(() => (data ? buildAscent(data, today) : null), [data, today]);
  const range = useMemo(() => (view ? buildRange(view, data.marks, today) : null), [view, data, today]);
  const categories = useLoad(() => (userId ? fetchCategories(userId) : NO_ROWS), [userId]);
  const tally = useLoad(() => (userId ? Promise.all([fetchStepTally(userId), fetchSectionTally(userId)]) : NO_ROWS), [userId]);
  const progress = useMemo(() => campProgress(tally.data?.[0], tally.data?.[1]), [tally.data]);
  // This week's focus: one that counts toward a target is one more check in
  // its shot each evening, so a target it feeds can stand on no checks.
  const focusWeek = useFocusWeek(userId, focusWeekOf(today));
  const fedByOf = useCallback(
    (t) =>
      t
        ? orderGoals(focusWeek.data?.goals).filter((g) => {
            const to = countsToward(g);
            return to && to.kind === t.kind && to.id === t.key;
          })
        : NO_ROWS,
    [focusWeek.data]
  );

  const [sheet, setSheet] = useState(null);
  const [ceremony, setCeremony] = useState(null);
  const [planted, setPlanted] = useState(null); // { questId, turn } whose flag just went in
  const [freshPatch, setFreshPatch] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const close = useCallback(() => setSheet(null), []);
  const savedRef = useRef(onSaved);
  savedRef.current = onSaved;

  const reloadAll = useCallback(async () => {
    await Promise.all([reload(), tally.reload()]);
    await savedRef.current?.();
  }, [reload, tally]);

  // Every edit goes through here: one toast if it fails, the sheet closed
  // and a quiet reload if it works. Resolves to whether it worked. With
  // `leaving`, the write has taken him off this page (a delete), so nothing
  // here is read again for a page that's going, and the word to the rest
  // of the app waits until it's gone.
  async function write(fn, failure, done, { leaving = false } = {}) {
    try {
      await fn();
    } catch (err) {
      toast.error(err, failure);
      return false;
    }
    setSheet(null);
    if (done) toast.show(done);
    if (leaving) {
      setTimeout(announceChange, 0);
      return true;
    }
    announceChange();
    await reloadAll();
    return true;
  }

  // --- The climb: a camp, then the summit -----------------------------------------

  // `q` is a quest's view (or a lesson's mountain's), with its state.
  function reachNext(q) {
    const s = q?.state;
    if (!s || s.done) return;
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
      updateCamp(camp.id, { reached_on: today })
        .then(() => announceChange())
        .catch((err) => {
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
            // The summit is reached on the quest's own page, and the patch
            // is drawn on Targets: it waits there for the overview to open
            // it (Targets reads it once and clears it).
            try {
              sessionStorage.setItem(FRESH_PATCH_KEY, q.id);
            } catch {
              // no storage: the patch is there, just without the welcome
            }
            toast.show(`Patch earned: ${q.title}`, { actionLabel: "Undo", onAction: () => undoSummit(q) });
          },
        }),
      reduce ? 0 : 700
    );
    updateQuest(q.id, { status: "done", finished_on: today })
      .then(() => announceChange())
      .catch((err) => {
        toast.error(err, "Couldn't mark the summit reached.");
        reload();
      });
  }

  async function undoCamp(camp) {
    mutate((d) => d && { ...d, camps: d.camps.map((c) => (c.id === camp.id ? { ...c, reached_on: null } : c)) });
    setPlanted(null);
    try {
      await updateCamp(camp.id, { reached_on: null });
      announceChange();
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
      sessionStorage.removeItem(FRESH_PATCH_KEY);
    } catch {
      // no storage, nothing waiting
    }
    try {
      await updateQuest(q.id, { status: "on", finished_on: null });
      announceChange();
    } catch (err) {
      toast.error(err, "Couldn't take that back.");
      reload();
    }
  }

  // --- Saving from the sheets -------------------------------------------------------

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

  // `onAdded(id)` runs with a new quest's id once it's saved.
  const saveQuestFrom = (quest, onAdded) => (v) =>
    write(
      async () => {
        if (!quest) {
          const id = await addQuest(userId, { title: v.title, note: v.note, goalId: v.goal_id, status: v.status, today, camps: v.camps, position: data?.quests.length ?? 0 });
          onAdded?.(id);
          return;
        }
        const finished = v.status === "done" ? quest.finished_on ?? today : null;
        await updateQuest(quest.id, { title: v.title, note: v.note, goal_id: v.goal_id, status: v.status, finished_on: finished });
        await syncCamps(userId, quest.id, v.camps, quest.state?.camps ?? NO_ROWS);
      },
      "Couldn't save that quest.",
      quest ? "Quest saved" : v.status === "done" ? `Added ${v.title} behind you` : `Added ${v.title}`
    );

  // `onGone` runs once it's deleted (a page about it has nowhere to be).
  async function removeQuest(quest, onGone) {
    if (
      !(await confirm({
        title: `Delete “${quest.title}”?`,
        body: "Its camps, steps, clipboard, daily list, arrows, notes and linked quotes go with it. This can't be undone.",
        confirmLabel: "Delete quest",
      }))
    )
      return;
    // It leaves the page as soon as the delete lands, with nothing read
    // again for the page it leaves: otherwise that page would say it isn't
    // one of his for a moment.
    await write(
      async () => {
        await deleteQuest(quest.id);
        onGone?.();
      },
      "Couldn't delete that quest.",
      `Deleted ${quest.title}`,
      { leaving: Boolean(onGone) }
    );
  }

  // A lesson and its own mountain: made with its first camp, and kept in
  // step with the lesson's name and goal. Taking off its last camp keeps
  // the mountain, since its daily list and clipboard live there too.
  // `onAdded(id)` runs with a new lesson's id once it and its camps are
  // both saved, never when the camps failed (the sheet stays open then).
  const saveLessonFrom = (lesson, onAdded) => (v) =>
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
        } else if (m) {
          if (m.title !== v.title || m.goal_id !== v.goal_id) await updateQuest(m.id, { title: v.title, goal_id: v.goal_id });
          await syncCamps(userId, m.id, v.camps, m.state?.camps ?? NO_ROWS);
        }
        if (!lesson) onAdded?.(lessonId);
      },
      "Couldn't save that lesson.",
      lesson ? "Lesson saved" : `Added ${v.title}`
    );

  async function removeLesson(lesson, onGone) {
    if (
      !(await confirm({
        title: `Delete “${lesson.title}”?`,
        body: "Its days kept and slipped, its camps and daily list, arrows, notes and linked quotes go with it. This can't be undone.",
        confirmLabel: "Delete lesson",
      }))
    )
      return;
    // Its mountain goes with it (quests.lesson_id cascades, 0079). Off its
    // page as soon as the delete lands, as with a quest.
    await write(
      async () => {
        await deleteLesson(lesson.id);
        onGone?.();
      },
      "Couldn't delete that lesson.",
      `Deleted ${lesson.title}`,
      { leaving: Boolean(onGone) }
    );
  }

  // What a bullseye takes, and the four sections. An aim a shot already
  // answered is retired rather than deleted, so that day still reads true.
  // Every shot counts, loosed or still in hand: tonight's arrow, answered
  // but not yet flown, keeps its checks' answers just the same (t.shots holds
  // only the loosed ones, so the raw rows are read here).
  const saveTargetFrom = (t) => (v) => {
    const shots = t.targetId ? (data?.marks?.shots ?? []).filter((s) => s.target_id === t.targetId) : NO_ROWS;
    const answered = new Set(shots.flatMap((s) => (Array.isArray(s.answers) ? s.answers.map((a) => a?.aim) : [])).filter(Boolean));
    const refCol = t.kind === "goal" ? { goal_id: t.key } : t.kind === "quest" ? { quest_id: t.key } : { lesson_id: t.key };
    return write(() => saveTargetSetup(userId, refCol, v, t.aims, { answered, today }), "Couldn't save that target.", "Saved");
  };

  // ------------------------------------------------------------------------------------

  const goals = view?.goals ?? NO_ROWS;
  const stepsIn = useCallback((campId) => progress.get(campId)?.total ?? 0, [progress]);
  const focuses = useMemo(() => goals.flatMap((g) => g.focuses), [goals]);
  const focusesById = useMemo(() => new Map(focuses.map((f) => [f.id, f])), [focuses]);

  // A quest's or lesson's view whatever its status (the page of one that's
  // done or set aside still opens).
  const questView = useCallback(
    (id) => (view ? [...view.quests, ...view.setAside, ...view.patches].find((q) => q.id === id && !q.lesson_id) ?? null : null),
    [view]
  );
  const lessonView = useCallback(
    (id) => (view ? [...view.lessons, ...view.learned, ...(view.lessonsAside ?? NO_ROWS)].find((l) => l.id === id) ?? null : null),
    [view]
  );
  const targetOf = useCallback((key) => (range ? range.all.find((t) => t.key === key) ?? null : null), [range]);

  const overlay = (
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
          camps={sheet.quest?.state?.camps}
          stepsIn={stepsIn}
          goals={goals}
          today={today}
          onSave={saveQuestFrom(sheet.quest, sheet.onAdded)}
          onDelete={() => removeQuest(sheet.quest, sheet.onGone)}
          onClose={close}
        />
      )}
      {sheet?.kind === "lesson" && (
        <LessonSheet
          lesson={sheet.lesson}
          camps={sheet.lesson?.mountain?.state?.camps}
          stepsIn={stepsIn}
          goals={goals}
          today={today}
          mountainFirst={sheet.mountain}
          onSave={saveLessonFrom(sheet.lesson, sheet.onAdded)}
          onDelete={() => removeLesson(sheet.lesson, sheet.onGone)}
          onClose={close}
        />
      )}
      {sheet?.kind === "target" && (
        <TargetSheet target={sheet.target} focuses={focuses} fedBy={fedByOf(sheet.target)} onSave={saveTargetFrom(sheet.target)} onClose={close} />
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
    </>
  );

  return {
    userId,
    today,
    data,
    view,
    range,
    error,
    loading,
    reload: reloadAll,
    mutate,
    focusWeek,
    progress,
    stepsIn,
    focuses,
    focusesById,
    fedByOf,
    questView,
    lessonView,
    targetOf,
    open: setSheet,
    reachNext,
    planted,
    freshPatch,
    overlay,
  };
}
