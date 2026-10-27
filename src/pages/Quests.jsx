import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Castle, ChevronRight, Plus, Repeat } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  addCamps,
  addQuest,
  addQuestTasks,
  addSteps,
  deleteQuestTask,
  fetchCampsSteps,
  fetchQuestBoard,
  fetchQuestTasks,
  reorder,
  updateQuest,
  updateQuestTask,
  updateQuestTasks,
  updateSection,
  updateStep,
} from "../lib/api";
import { boardOf, byPos, campTally, dayLabel, listDays, nextPosition, ongoingList, pickedLines, withFinished, withFinishedStep } from "../lib/questTasks";
import { pickDiff, questToday } from "../lib/camp";
import { villageOf } from "../lib/village";
import { appendToNote } from "../lib/sketch";
import { savesInOrder, undoableSave } from "../lib/inOrder";
import { fmtDayHeading, todayStr } from "../lib/planDates";
import { useLoad } from "../lib/useLoad";
import { markDrop } from "../lib/useDragSort";
import { haptic } from "../lib/haptics";
import { playClink } from "../lib/clink";
import { useToast } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import Sheet from "../components/ascent/Sheet";
import FloatingBuild, { BuildMini, buildNow } from "../components/quests/FloatingBuild";
import { AddLine, DayList, LineTree, OngoingList } from "../components/quests/Lines";
import QuestMap from "../components/quests/QuestMap";
import { PickBar, TodayBlocks, usePick } from "../components/camp/Today";
import { SketchProvider } from "../components/sketch/Sketches";
import "../styles/ascent.css";
import "../styles/camp.css";
import "../styles/quests.css";

// Quests: a running to-do list and notepad for each quest and lesson. Every
// day he puts in what he'll do for it, ticks things off, writes notes on what
// he did, and does it again the next day. Lines can be tasks, sub-tasks under
// them, or note lines, and every one can carry notes, a colour and sketches.
// Nothing is carried forward (Aaron, 2026-10-14): an earlier day's list stays
// on its day, still there to tick. Beside the days, each quest keeps an
// ongoing list (Aaron, 2026-10-27) for what stays on it whatever the day; a
// line moves onto it or back onto today from its own tools.
//
// First come the quests and lessons as pills (Aaron, 2026-10-26): the one
// that's open unfolds to show the camps on its mountain, and tapping another
// opens its list and its camps. New camps are added there too.
//
// Today's list also shows what's picked for today elsewhere (0090, Aaron
// 2026-10-27): steps and whole sections (0091) picked in any of the quest's
// camps, under each camp's name, and lines picked from the ongoing list or
// an earlier day. They're
// the same steps and lines, not copies, so a tick or a note here is a tick
// or a note there too.
//
// The build going up in the village floats at the top. Every task he ticks,
// on any list, lays its bricks on it until it stands; then he chooses the
// next build (/village?choose).

const EARLIER_SHOWN = 10;

export default function Quests() {
  const { key } = useParams();
  const { user } = useAuth();
  const userId = user?.id;
  const today = todayStr();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: board, error, loading, reload, mutate: mutateBoard } = useLoad(() => (userId ? fetchQuestBoard(userId) : null), [userId]);
  const items = useMemo(() => (board ? boardOf(board) : []), [board]);
  const sel = useMemo(() => {
    if (!board) return null;
    const hit = items.find((i) => i.key === key || (key?.startsWith("lesson-") && i.lessonId === key.slice(7)));
    if (hit || !key) return hit ?? items[0] ?? null;
    // A quest that's finished or set aside still opens from a link to it.
    const q = board.quests.find((x) => x.id === key);
    return q ? { key: q.id, questId: q.id, lessonId: q.lesson_id ?? null, name: q.title, type: q.lesson_id ? "Lesson" : "Quest", goalId: q.goal_id ?? null, note: q.note ?? null, off: true } : null;
  }, [board, items, key]);
  const questId = sel?.questId ?? null;

  const {
    data: lines,
    error: linesError,
    loading: linesLoading,
    reload: reloadLines,
    mutate: mutateLines,
  } = useLoad(() => (userId && questId ? fetchQuestTasks(userId, questId) : []), [userId, questId]);
  // The lines as they are now, for an Undo tapped after other changes.
  const linesNow = useRef(null);
  linesNow.current = lines;
  // Moves (drags, Undo) save one after another, in the order they were made.
  const inOrder = useMemo(savesInOrder, []);

  const village = useMemo(
    () =>
      board
        ? villageOf({ tasks: board.finished.tasks, steps: board.finished.steps, projects: board.projects, camps: board.camps, quests: board.quests, lessons: board.lessons }, today)
        : null,
    [board, today]
  );
  const days = useMemo(() => listDays(lines ?? [], today), [lines, today]);
  const ongoing = useMemo(() => ongoingList(lines ?? [], today), [lines, today]);

  const tally = useMemo(() => campTally(board?.campSteps, today, board?.campSections), [board, today]);

  // What's picked for today: lines from the ongoing list and earlier days,
  // and steps in the quest's camps.
  const picked = useMemo(() => pickedLines(lines ?? [], today), [lines, today]);
  const questCamps = useMemo(() => (board && questId ? board.camps.filter((c) => c.quest_id === questId) : []), [board, questId]);
  const campKey = questCamps
    .map((c) => c.id)
    .sort()
    .join(",");
  const {
    data: campData,
    error: campsError,
    reload: reloadCamps,
    mutate: mutateCamps,
  } = useLoad(() => (userId && campKey ? fetchCampsSteps(userId, campKey.split(",")) : { sections: [], steps: [] }), [userId, campKey]);
  const campToday = useMemo(() => questToday(questCamps, campData?.sections, campData?.steps, today), [questCamps, campData, today]);

  // A line open where it sits is its id; open in today's list, "t:" and its id.
  const [openId, setOpenId] = useState(null);
  const [openStep, setOpenStep] = useState(null);
  const [saving, setSaving] = useState(false);
  const picker = usePick(saving);
  const [openKey, setOpenKey] = useState(null);
  const [unfolded, setUnfolded] = useState({});
  const [allEarlier, setAllEarlier] = useState(false);
  const [away, setAway] = useState(false);
  const [newQuest, setNewQuest] = useState(false);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const onAway = useCallback((v) => setAway(v), []);

  useEffect(() => {
    setOpenId(null);
    setOpenStep(null);
    setUnfolded({});
    setAllEarlier(false);
    picker.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.key]);
  useEffect(() => setNote(sel?.note ?? ""), [sel?.key, sel?.note]);
  // The quest that's open shows its camps; tapping its pill folds them away.
  useEffect(() => setOpenKey(sel?.key ?? null), [sel?.key]);

  function pick(item) {
    haptic("tap");
    if (item.key === sel?.key) setOpenKey((k) => (k === item.key ? null : item.key));
    else navigate(`/quests/${item.key}`, { replace: true });
  }

  const failed = (err, what) => {
    toast.error(err, what);
    reloadLines();
    reload();
  };

  // --- The list -------------------------------------------------------------

  const setLine = (id, fields) => mutateLines((list) => (list ?? []).map((x) => (x.id === id ? { ...x, ...fields } : x)));
  // The village counts finished tasks, so it hears about every tick.
  const tellVillage = (line) => mutateBoard((b) => b && { ...b, finished: { ...b.finished, tasks: withFinished(b.finished.tasks, line) } });

  // A tick lays bricks; the one that finishes the build gets a little more.
  function cheer(before) {
    if (before && !before.complete && before.done + 1 >= before.need) {
      playClink();
      haptic("win");
      toast.show(`The ${before.name.toLowerCase()} stands`, { actionLabel: "Choose the next build", onAction: () => navigate("/village?choose") });
    } else haptic("tap");
  }

  function toggleDone(line) {
    const done_on = line.done_on ? null : today;
    const done_at = done_on ? new Date().toISOString() : null;
    const before = buildNow(village, today);
    setLine(line.id, { done_on, done_at });
    tellVillage({ ...line, done_on, done_at });
    if (done_on) cheer(before);
    updateQuestTask(line.id, { done_on, done_at }).catch((err) => failed(err, "Couldn't save that."));
  }

  function saveLine(line, fields) {
    setLine(line.id, fields);
    if (line.done_on) tellVillage({ ...line, ...fields });
    updateQuestTask(line.id, fields).catch((err) => failed(err, "Couldn't save that."));
  }

  // A task becomes a line of notes (it can't be ticked, so it lays no bricks), or back.
  function switchKind(line) {
    const fields = line.kind === "note" ? { kind: "task" } : { kind: "note", done_on: null, done_at: null };
    setLine(line.id, fields);
    tellVillage({ ...line, ...fields });
    updateQuestTask(line.id, fields).catch((err) => failed(err, "Couldn't change that."));
  }

  // --- Today: lines picked from the ongoing list and earlier days -------------------

  // Only a top line off today's own list can be picked; its sub-tasks come with it.
  const pickable = (line) => !line.parent_id && (line.ongoing || line.day !== today);
  const isPicked = (line) => pickable(line) && line.today_on === today;

  function setLineToday(line, on) {
    const fields = { today_on: on ? today : null };
    setLine(line.id, fields);
    if (!on && openId === `t:${line.id}`) setOpenId(null);
    haptic("tap");
    toast.show(on ? "On today" : "Off today");
    updateQuestTask(line.id, fields).catch((err) => failed(err, "Couldn't change that."));
  }

  function startPicking() {
    setOpenId(null);
    setOpenStep(null);
    picker.start((lines ?? []).filter(isPicked).map((x) => x.id));
    haptic("tap");
  }

  async function savePicks() {
    const { add, remove } = pickDiff((lines ?? []).filter(isPicked).map((x) => x.id), picker.sel);
    if (!add.length && !remove.length) {
      picker.stop();
      return;
    }
    setSaving(true);
    try {
      await Promise.all([updateQuestTasks(add, { today_on: today }), updateQuestTasks(remove, { today_on: null })]);
      const on = new Set(add);
      const off = new Set(remove);
      mutateLines((list) => (list ?? []).map((x) => (on.has(x.id) ? { ...x, today_on: today } : off.has(x.id) ? { ...x, today_on: null } : x)));
      picker.stop();
      haptic("success");
      toast.show(picker.sel.size ? `${picker.sel.size} on today` : "Nothing picked for today");
    } catch (err) {
      toast.error(err, "Couldn't save today's picks.");
      reloadLines();
    } finally {
      setSaving(false);
    }
  }

  // --- Today: steps picked in the quest's camps ----------------------------------------

  const setCampSteps = (fn) => mutateCamps((d) => d && { ...d, steps: fn(d.steps) });
  const rawStep = (id) => campData?.steps.find((x) => x.id === id);
  // The village counts finished steps, and the camps along the top count every step.
  const tellBoard = (st) =>
    mutateBoard(
      (b) =>
        b && {
          ...b,
          finished: { ...b.finished, steps: withFinishedStep(b.finished.steps, st) },
          campSteps: (b.campSteps ?? []).map((x) => (x.id === st.id ? { ...x, done_on: st.done_on ?? null, working_since: st.working_since ?? null, today_on: st.today_on ?? null } : x)),
        }
    );
  const stepFailed = (err, what) => {
    toast.error(err, what);
    reloadCamps();
    reload();
  };

  function toggleStepDone(st) {
    const done_on = st.done_on ? null : today;
    // Finishing it means you're no longer working on it.
    const fields = done_on && st.working_since ? { done_on, working_since: null } : { done_on };
    const before = buildNow(village, today);
    setCampSteps((list) => list.map((x) => (x.id === st.id ? { ...x, ...fields } : x)));
    tellBoard({ ...(rawStep(st.id) ?? st), ...fields });
    if (done_on) cheer(before);
    updateStep(st.id, fields).catch((err) => stepFailed(err, "Couldn't save that step."));
  }

  function saveStep(st, fields) {
    setCampSteps((list) => list.map((x) => (x.id === st.id ? { ...x, ...fields } : x)));
    tellBoard({ ...(rawStep(st.id) ?? st), ...fields });
    updateStep(st.id, fields).catch((err) => stepFailed(err, "Couldn't save that step."));
  }

  function setStepToday(st, on) {
    if (!on && openStep === st.id) setOpenStep(null);
    haptic("tap");
    toast.show(on ? "On today" : "Off today");
    saveStep(st, { today_on: on ? today : null });
  }

  // A whole section picked in a camp (0091): its steps come off today with it.
  const sectionOnToday = (st) => Boolean(st.section_id) && (campData?.sections ?? []).some((x) => x.id === st.section_id && x.today_on === today);

  function setSectionToday(sec, on) {
    const fields = { today_on: on ? today : null };
    const put = (x) => (x.id === sec.id ? { ...x, ...fields } : x);
    mutateCamps((d) => d && { ...d, sections: d.sections.map(put) });
    mutateBoard((b) => b && { ...b, campSections: (b.campSections ?? []).map(put) });
    updateSection(sec.id, fields).catch((err) => stepFailed(err, "Couldn't change that."));
  }

  function sectionOff(sec) {
    if (openStep && (campData?.steps ?? []).some((x) => x.id === openStep && x.section_id === sec.id)) setOpenStep(null);
    haptic("tap");
    setSectionToday(sec, false);
    const name = String(sec.title ?? "");
    toast.show(`“${name.length > 40 ? `${name.slice(0, 40).trimEnd()}…` : name}” is off today`, { actionLabel: "Undo", onAction: () => setSectionToday(sec, true) });
  }

  async function addStepSubs(st, texts) {
    const under = (campData?.steps ?? []).filter((x) => x.parent_id === st.id);
    const start = under.reduce((m, x) => Math.max(m, (x.position ?? 0) + 1), 0);
    try {
      const rows = await addSteps(userId, st.camp_id, st.section_id ?? null, texts, start, st.id);
      setCampSteps((list) => [...list, ...rows]);
      mutateBoard(
        (b) =>
          b && {
            ...b,
            campSteps: [
              ...(b.campSteps ?? []),
              ...rows.map((r) => ({ id: r.id, camp_id: r.camp_id, section_id: r.section_id ?? null, parent_id: r.parent_id ?? null, done_on: null, working_since: null, today_on: null })),
            ],
          }
      );
      haptic("tap");
      return true;
    } catch (err) {
      toast.error(err, texts.length > 1 ? "Couldn't add those sub-steps." : "Couldn't add that sub-step.");
      return false;
    }
  }

  // A sketch's summary, added to the end of its step's notes.
  function addToStepNote(stepId, text) {
    const st = rawStep(stepId);
    if (!st) return "gone";
    const { note, status } = appendToNote(st.note, text, 4000);
    if (status !== "full") saveStep(st, { note });
    return status;
  }

  const stepRow = (st) => ({
    onOpen: () => {
      setOpenId(null);
      setOpenStep((o) => (o === st.id ? null : st.id));
    },
    onDone: () => toggleStepDone(st),
    onSave: (fields) => saveStep(st, fields),
    isToday: st.today_on === today,
    onToday: sectionOnToday(st) ? undefined : () => setStepToday(st, st.today_on !== today),
  });

  function removeLine(line) {
    const gone = new Set([line.id, ...(lines ?? []).filter((x) => x.parent_id === line.id).map((x) => x.id)]);
    const removed = (lines ?? []).filter((x) => gone.has(x.id));
    setOpenId(null);
    mutateLines((list) => (list ?? []).filter((x) => !gone.has(x.id)));
    mutateBoard((b) => b && { ...b, finished: { ...b.finished, tasks: b.finished.tasks.filter((t) => !gone.has(t.id)) } });
    toast.undoable({
      message: line.kind === "note" ? "Note line removed" : removed.length > 1 ? "Task and its sub-tasks removed" : "Task removed",
      run: () => deleteQuestTask(line.id).catch((err) => failed(err, "Couldn't remove that.")),
      onUndo: () => {
        mutateLines((list) => [...(list ?? []), ...removed]);
        removed.forEach((x) => x.done_on && tellVillage(x));
      },
    });
  }

  // Up or down past its neighbour, among the lines it sits with.
  function moveLine(line, siblings, by) {
    const i = siblings.findIndex((x) => x.id === line.id);
    const other = siblings[i + by];
    if (!other) return;
    const next = [...siblings];
    next.splice(i, 1);
    next.splice(i + by, 0, line);
    const at = new Map(next.map((x, k) => [x.id, k]));
    mutateLines((list) => (list ?? []).map((x) => (at.has(x.id) ? { ...x, position: at.get(x.id) } : x)));
    inOrder(() => reorder("quest_tasks", next)).catch((err) => failed(err, "Couldn't move that."));
  }

  // --- Dragging lines ------------------------------------------------------------------

  // The lines beside this one: its task's sub-tasks, or the top lines of its
  // day or of the ongoing list.
  const lineSiblings = (line) =>
    (lines ?? []).filter((x) =>
      line.parent_id ? x.parent_id === line.parent_id : !x.parent_id && Boolean(x.ongoing) === Boolean(line.ongoing) && (line.ongoing || x.day === line.day)
    );

  // Dragged into a new order: `shown` is the list as it stood on screen and
  // `ids` its new order. Lines hidden from it (the ongoing list's done ones)
  // keep their places.
  function reorderLines(shown, ids) {
    if (!shown.length) return;
    const full = lineSiblings(shown[0]).sort(byPos);
    const byId = new Map(full.map((x) => [x.id, x]));
    const onScreen = new Set(ids);
    const queue = [...ids];
    const next = full.map((x) => (onScreen.has(x.id) ? byId.get(queue.shift()) : x)).filter(Boolean);
    const at = new Map(next.map((x, k) => [x.id, k]));
    mutateLines((list) => (list ?? []).map((x) => (at.has(x.id) ? { ...x, position: at.get(x.id) } : x)));
    inOrder(() => reorder("quest_tasks", next)).catch((err) => failed(err, "Couldn't move that."));
  }

  // Dropped onto another line (Aaron, 2026-10-27): it goes under that one as
  // a sub-task, after its others, on that line's day or list. Lines go one
  // deep, so its own sub-tasks come along as that line's sub-tasks too, and
  // it's no longer picked for today on its own. Undo puts them all back.
  function nestLine(line, targetId) {
    const all = lines ?? [];
    const target = all.find((x) => x.id === targetId);
    if (!line || !target || target.id === line.id || target.parent_id || line.parent_id === target.id) return;
    const moving = [line, ...all.filter((x) => x.parent_id === line.id).sort(byPos)];
    const place = { parent_id: target.id, day: target.day, ongoing: Boolean(target.ongoing) };
    let pos = nextPosition(all, target.day, target.id);
    const now = moving.map((x) => ({ id: x.id, ...place, position: pos++ }));
    const was = moving.map((x) => ({ id: x.id, parent_id: x.parent_id ?? null, day: x.day, ongoing: Boolean(x.ongoing), position: x.position ?? 0 }));
    if (line.today_on) {
      now[0].today_on = null;
      was[0].today_on = line.today_on;
    }
    const show = (rows) => {
      const by = new Map(rows.map(({ id, ...fields }) => [id, fields]));
      mutateLines((list) => (list ?? []).map((x) => (by.has(x.id) ? { ...x, ...by.get(x.id) } : x)));
      requestAnimationFrame(() => document.getElementById(`line-${line.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    };
    // One row at a time, in an order where every step on the way can be
    // shown: going under, its sub-tasks move first, then it; coming back,
    // it moves first, then they do. So a write that fails part way never
    // leaves a sub-task under a sub-task, where no list would show it.
    const save = (order) => () => order.reduce((p, { id, ...fields }) => p.then(() => updateQuestTask(id, fields)), Promise.resolve());
    show(now);
    const undo = undoableSave(inOrder, save([...now.slice(1), now[0]]), (err) => failed(err, "Couldn't move that."));
    const name = String(target.text ?? "");
    toast.show(`Moved under “${name.length > 40 ? `${name.slice(0, 40).trimEnd()}…` : name}”`, {
      actionLabel: "Undo",
      onAction: () => {
        show(was);
        undo(save(was), (err) => failed(err, "Couldn't move that back."));
      },
    });
  }

  // Carried out of its list onto today's list or the ongoing list (`where`):
  // it's a line of its own there, just before `beforeId` or at the end, and
  // its sub-tasks come along. A sub-task comes out from under its task.
  // Undo puts it back where it was, on its own day (an earlier day's line
  // otherwise has no way back there).
  function moveLineTo(line, where, beforeId = null) {
    const all = lines ?? [];
    const onList = where === "ongoing";
    const there = all.filter((x) => !x.parent_id && x.id !== line.id && (onList ? x.ongoing : !x.ongoing && x.day === today)).sort(byPos);
    const at = beforeId ? there.findIndex((x) => x.id === beforeId) : -1;
    const next = [...there];
    next.splice(at < 0 ? next.length : at, 0, line);
    const pos = new Map(next.map((x, k) => [x.id, k]));
    const same = !line.parent_id && Boolean(line.ongoing) === onList && (onList || line.day === today);
    if (same && next.every((x) => x.position === pos.get(x.id))) return;
    const rest = { ongoing: onList, ...(onList ? {} : { day: today }) };
    const top = { parent_id: null, ...rest };
    const subs = all.filter((x) => x.parent_id === line.id).map((x) => x.id);
    mutateLines((list) =>
      (list ?? []).map((x) =>
        x.id === line.id ? { ...x, ...top, position: pos.get(x.id) } : subs.includes(x.id) ? { ...x, ...rest } : pos.has(x.id) ? { ...x, position: pos.get(x.id) } : x
      )
    );
    const scroll = () => requestAnimationFrame(() => document.getElementById(`line-${line.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    scroll();
    if (same) {
      inOrder(() => reorder("quest_tasks", next)).catch((err) => failed(err, "Couldn't move that."));
      return;
    }
    const undoMove = undoableSave(
      inOrder,
      () => Promise.all([updateQuestTask(line.id, top), subs.length ? updateQuestTasks(subs, rest) : null]).then(() => reorder("quest_tasks", next)),
      (err) => failed(err, "Couldn't move that.")
    );
    // What Undo puts back: the line where it was, its sub-tasks with it, and
    // the lines it landed among closed up again, in their order as it is
    // when Undo is tapped (they may have been moved since; those saves are
    // in line before Undo's, so the positions here are the saved ones).
    const was = { parent_id: line.parent_id ?? null, day: line.day, ongoing: Boolean(line.ongoing), position: line.position ?? 0 };
    const subsWas = all.filter((x) => x.parent_id === line.id).map((x) => ({ id: x.id, day: x.day, ongoing: Boolean(x.ongoing) }));
    const undo = () => {
      const left = (linesNow.current ?? [])
        .filter((x) => x.quest_id === line.quest_id && !x.parent_id && x.id !== line.id && (onList ? x.ongoing : !x.ongoing && x.day === today))
        .sort(byPos);
      const back = new Map([[line.id, was], ...subsWas.map(({ id, ...f }) => [id, f]), ...left.map((x, k) => [x.id, { position: k }])]);
      mutateLines((list) => (list ?? []).map((x) => (back.has(x.id) ? { ...x, ...back.get(x.id) } : x)));
      scroll();
      undoMove(
        () =>
          updateQuestTask(line.id, was)
            .then(() => subsWas.reduce((p, { id, ...f }) => p.then(() => updateQuestTask(id, f)), Promise.resolve()))
            .then(() => reorder("quest_tasks", left)),
        (err) => failed(err, "Couldn't move that back.")
      );
    };
    toast.show(onList ? "On the ongoing list" : "On today's list", { actionLabel: "Undo", onAction: undo });
  }

  // A line carried out of its own list: today's list or the ongoing list
  // lights up under the finger, and letting go there drops it in, between
  // the lines it landed on.
  function lineDropTarget(x, y, line) {
    const el = document
      .elementsFromPoint(x, y)
      .find((e) => !e.closest(`#line-${line.id}`) && e.closest("[data-drop]"))
      ?.closest("[data-drop]");
    if (!el) return null;
    const below = [...el.querySelectorAll(":scope > ul.qs-lines:not(.qs-lines--done) > li.qs-line")].find((li) => {
      if (li.id === `line-${line.id}`) return false;
      const r = li.getBoundingClientRect();
      return y < r.top + r.height / 2;
    });
    return { el, below, where: el.dataset.drop, beforeId: below ? below.id.slice(5) : null };
  }

  function dragLineOut(phase, x, y, line) {
    const hit = phase === "move" || phase === "drop" ? lineDropTarget(x, y, line) : null;
    markDrop(phase === "move" ? hit : null);
    if (phase === "drop" && hit) moveLineTo(line, hit.where, hit.beforeId);
  }

  // A lesson's list lives on its own mountain, made the first time he writes on it.
  async function ensureQuest() {
    if (questId) return { id: questId, made: false };
    const id = await addQuest(userId, { title: sel.name, lessonId: sel.lessonId, status: "on", today, goalId: sel.goalId });
    return { id, made: true };
  }

  // New lines at the end of today's list, or (`onList`) the ongoing list.
  async function addLines(parsed, kind, onList = false) {
    let made = false;
    try {
      const q = await ensureQuest();
      const qid = q.id;
      made = q.made;
      const all = lines ?? [];
      let pos = nextPosition(all, onList ? null : today);
      let parent = null;
      const rows = [];
      // Top lines first, so the sub-tasks can name them.
      const tops = await addQuestTasks(
        userId,
        parsed.filter((l) => !l.sub).map((l) => ({ quest_id: qid, kind, text: l.text, day: today, ongoing: onList, position: pos++ }))
      );
      rows.push(...tops);
      let t = 0;
      const subs = [];
      let subPos = 0;
      for (const l of parsed) {
        if (!l.sub) {
          parent = tops[t++];
          subPos = 0;
        } else if (parent) subs.push({ quest_id: qid, parent_id: parent.id, kind: "task", text: l.text, day: today, ongoing: onList, position: subPos++ });
      }
      if (subs.length) rows.push(...(await addQuestTasks(userId, subs)));
      haptic("tap");
      if (made) {
        // The new mountain's list loads with these lines already on it.
        await reload();
        navigate(`/quests/${qid}`, { replace: true });
      } else mutateLines((list) => [...(list ?? []), ...rows]);
      return true;
    } catch (err) {
      toast.error(err, parsed.length > 1 ? "Couldn't add those." : "Couldn't add that.");
      // A mountain made just now stays; load it so the next try writes there.
      if (made) reload();
      return false;
    }
  }

  async function addSubs(parent, parsed) {
    try {
      let pos = nextPosition(lines ?? [], parent.day, parent.id);
      const rows = await addQuestTasks(
        userId,
        parsed.map((l) => ({ quest_id: parent.quest_id, parent_id: parent.id, kind: "task", text: l.text, day: parent.day, ongoing: Boolean(parent.ongoing), position: pos++ }))
      );
      mutateLines((list) => [...(list ?? []), ...rows]);
      haptic("tap");
      return true;
    } catch (err) {
      toast.error(err, parsed.length > 1 ? "Couldn't add those." : "Couldn't add that.");
      return false;
    }
  }

  // A line (with its sub-tasks) onto the end of the ongoing list, or off it
  // onto the end of today's.
  function shiftLine(line) {
    const all = lines ?? [];
    const onList = !line.ongoing;
    const subs = all.filter((x) => x.parent_id === line.id).map((x) => x.id);
    const top = { ongoing: onList, ...(onList ? {} : { day: today }), position: nextPosition(all, onList ? null : today) };
    const rest = { ongoing: onList, ...(onList ? {} : { day: today }) };
    setOpenId(null);
    mutateLines((list) => (list ?? []).map((x) => (x.id === line.id ? { ...x, ...top } : subs.includes(x.id) ? { ...x, ...rest } : x)));
    haptic("tap");
    toast.show(onList ? "On the ongoing list" : "On today's list");
    inOrder(() => Promise.all([updateQuestTask(line.id, top), updateQuestTasks(subs, rest)])).catch((err) => failed(err, "Couldn't move that."));
  }

  // A sketch's summary, added to the end of its line's notes ("cut" or
  // "full" when they're too long to take all of it).
  function addToNote(id, text) {
    const line = (lines ?? []).find((x) => x.id === id);
    if (!line) return "gone";
    const { note, status } = appendToNote(line.note, text, 20000);
    if (status !== "full") saveLine(line, { note });
    return status;
  }

  const row = (line, siblings) => ({
    onOpen: () => {
      setOpenStep(null);
      setOpenId((o) => (o === line.id ? null : line.id));
    },
    onDone: () => toggleDone(line),
    onSave: (fields) => saveLine(line, fields),
    onKind: () => switchKind(line),
    onMove: (by) => moveLine(line, siblings, by),
    onShift: line.parent_id ? undefined : () => shiftLine(line),
    isToday: isPicked(line),
    onToday: pickable(line) ? () => setLineToday(line, !isPicked(line)) : undefined,
    pick: pickable(line) ? picker.of(line.id) : null,
    locked: picker.on && !pickable(line),
    onRemove: () => removeLine(line),
  });

  // The same lines again in today's list: they tick, take notes and
  // sub-tasks and come off today there, but move and go only where they sit.
  const mirrorRow = (line) => ({
    onOpen: () => {
      setOpenStep(null);
      setOpenId((o) => (o === `t:${line.id}` ? null : `t:${line.id}`));
    },
    onDone: () => toggleDone(line),
    onSave: (fields) => saveLine(line, fields),
    onKind: () => switchKind(line),
    isToday: isPicked(line),
    onToday: pickable(line) ? () => setLineToday(line, !isPicked(line)) : undefined,
  });

  // --- The quest's notes and a new quest ----------------------------------------

  async function saveNote() {
    const value = note.trim() || null;
    if (!sel || value === (sel.note ?? null)) return;
    let made = false;
    try {
      const q = await ensureQuest();
      const id = q.id;
      made = q.made;
      await updateQuest(id, { note: value });
      mutateBoard((b) => b && { ...b, quests: b.quests.map((q) => (q.id === id ? { ...q, note: value } : q)) });
      if (made) {
        await reload();
        navigate(`/quests/${id}`, { replace: true });
      }
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 1800);
    } catch (err) {
      toast.error(err, "Couldn't save your notes.");
      if (made) reload();
    }
  }

  // New camps at the end of a quest's mountain, from its pill.
  async function newCamps(item, titles) {
    if (item.key !== sel?.key) return false;
    let made = false;
    try {
      const q = await ensureQuest();
      const qid = q.id;
      made = q.made;
      const startAt = (board?.camps ?? []).filter((c) => c.quest_id === qid).reduce((m, c) => Math.max(m, (c.position ?? 0) + 1), 0);
      const rows = await addCamps(userId, qid, titles, startAt);
      haptic("tap");
      if (made) {
        await reload();
        navigate(`/quests/${qid}`, { replace: true });
      } else mutateBoard((b) => b && { ...b, camps: [...b.camps, ...rows] });
      return true;
    } catch (err) {
      toast.error(err, titles.length > 1 ? "Couldn't add those camps." : "Couldn't add that camp.");
      if (made) reload();
      return false;
    }
  }

  async function startQuest(title) {
    try {
      const position = (board?.quests ?? []).reduce((m, q) => Math.max(m, (q.position ?? 0) + 1), 0);
      const id = await addQuest(userId, { title, status: "on", today, position });
      await reload();
      setNewQuest(false);
      navigate(`/quests/${id}`);
    } catch (err) {
      toast.error(err, "Couldn't start that quest.");
    }
  }

  // ---------------------------------------------------------------------------------

  if (!board) {
    return (
      <div className="page ascent qs">
        <header className="qs-head">
          <div>
            <div className="eyebrow">Quests</div>
            <h1 className="page-title">Your quests</h1>
          </div>
        </header>
        {error ? <LoadError what="your quests" error={error} onRetry={reload} /> : loading && <p className="empty">Loading…</p>}
      </div>
    );
  }

  const goal = sel?.goalId ? board.goals.find((g) => g.id === sel.goalId)?.title : null;
  const [todayList, ...earlierAll] = days;
  const kind = sel?.type === "Lesson" ? "lesson" : "quest";
  const homeOpen = openId && !String(openId).startsWith("t:") ? openId : null;
  const todayOpen = openId && String(openId).startsWith("t:") ? String(openId).slice(2) : null;
  const pickedAll = campToday.length > 0 || picked.items.length > 0;
  const todayExtra = {
    done: picked.done + campToday.reduce((n, g) => n + g.done, 0),
    total: picked.total + campToday.reduce((n, g) => n + g.total, 0),
    count: picked.items.length + campToday.reduce((n, g) => n + g.items.length, 0),
  };
  // While picking, today's list shows what to do instead of its copies, so
  // nothing there can change what's being picked.
  const todayLead = picker.on ? (
    <div className="today-from">
      <p className="today-hint">Pick lines from the lists below. A camp's steps are picked on the camp's own page.</p>
      {todayList.items.length > 0 && <span className="today-group__label today-group__label--own">Written for today</span>}
    </div>
  ) : pickedAll ? (
    <div className="today-from">
      {campToday.map((g) => (
        <div key={g.camp.id} className="today-group">
          <Link to={`/ascent/camp/${g.camp.id}`} state={{ from: "quests" }} className="today-group__label">
            <span className="today-group__n" aria-hidden="true">
              {g.number}
            </span>
            <span className="today-group__name">{g.camp.title}</span>
            <small>{`${g.done} of ${g.total}`}</small>
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
          <SketchProvider kind="step" userId={userId} scopeId={g.camp.id} about={(sid) => rawStep(sid)?.text} onAddToNote={addToStepNote}>
            <TodayBlocks blocks={g.blocks} openStep={openStep} step={stepRow} onAddSubs={addStepSubs} idPrefix="qs-step" onSectionOff={sectionOff} />
          </SketchProvider>
        </div>
      ))}
      {picked.items.length > 0 && (
        <div className="today-group">
          <span className="today-group__label today-group__label--list">
            <Repeat size={13} aria-hidden="true" />
            <span className="today-group__name">From this {kind}'s list</span>
          </span>
          <LineTree
            items={picked.items}
            openId={todayOpen}
            row={mirrorRow}
            onAddSubs={addSubs}
            mirror
            idPrefix="today-line"
            fromOf={(l) => (l.from === "ongoing" ? "Ongoing" : dayLabel(l.from, today))}
          />
        </div>
      )}
      {todayList.items.length > 0 && <span className="today-group__label today-group__label--own">Written for today</span>}
    </div>
  ) : null;
  const earlier = earlierAll.filter((d) => d.items.length);
  // Lines drag by their handles, but not while picking for today.
  const drag = picker.on ? {} : { onReorder: reorderLines, onDragOut: dragLineOut, onInto: nestLine };
  const earlierShown = allEarlier ? earlier : earlier.slice(0, EARLIER_SHOWN);
  const building = buildNow(village, today);

  return (
    <div className="page ascent qs">
      <header className="qs-head">
        <div className="qs-head__name">
          <div className="eyebrow">{sel ? (sel.type === "Lesson" ? "Lesson" : "Quest") : "Quests"}</div>
          <h1 className="page-title qs-title">{sel ? sel.name : "Your quests"}</h1>
          {(goal || sel?.off) && (
            <span className="ascent-mini">
              {goal ? `Toward ${goal}` : ""}
              {goal && sel?.off ? " · " : ""}
              {sel?.off ? "Not on right now" : ""}
            </span>
          )}
        </div>
        <Link to="/village" className="btn btn--sm btn--on-page qs-head__village">
          <Castle size={14} />
          Village
        </Link>
      </header>

      <QuestMap items={items} sel={sel} camps={board.camps} tally={tally} openKey={openKey} onPick={pick} onNew={() => setNewQuest(true)} onAddCamps={newCamps} />

      {error && <LoadError what="your quests" error={error} onRetry={reload} stale />}

      <SketchProvider kind="task" userId={userId} scopeId={questId} about={(id) => (lines ?? []).find((x) => x.id === id)?.text} onAddToNote={addToNote}>
        <div className="qs-grid">
          <div className="qs-rail">
            <div className="qs-rail__build">
              <FloatingBuild village={village} today={today} onAway={onAway} />
            </div>

            {sel && (
              <aside className="qs-side">
                <section className="card qs-notes" aria-labelledby="qs-notes-h">
                  <div className="ascent-row">
                    <h2 className="eyebrow" id="qs-notes-h">
                      Notes on this {sel.type === "Lesson" ? "lesson" : "quest"}
                    </h2>
                    {noteSaved && <span className="ascent-mini camp-saved">Saved</span>}
                  </div>
                  <textarea
                    className="textarea"
                    rows={5}
                    value={note}
                    maxLength={20000}
                    placeholder="Where it's headed, decisions, ideas, links…"
                    onChange={(e) => setNote(e.target.value)}
                    onBlur={saveNote}
                  />
                </section>
              </aside>
            )}
          </div>

          <div className={"qs-main" + (picker.on ? " picking" : "")}>
            <BuildMini village={village} today={today} show={away} />

            {!sel ? (
              <section className="card qs-empty">
                <p>No quests on yet. Start one, and its list lives here: what you'll do for it each day, ticked off, with notes on what you did.</p>
                <button type="button" className="btn btn--sm btn--accent" onClick={() => setNewQuest(true)}>
                  <Plus size={14} />
                  Start a quest
                </button>
              </section>
            ) : (
              <>
                {linesError && <LoadError what="this list" error={linesError} onRetry={reloadLines} stale={Boolean(lines)} />}
                {campsError && <LoadError what="what's picked for today in its camps" error={campsError} onRetry={reloadCamps} stale={Boolean(campData)} />}
                <DayList day={todayList} label="Today" sub={fmtDayHeading(today)} today={today} openId={homeOpen} row={row} onAddSubs={addSubs} {...drag} drop="today" lead={todayLead} extra={todayExtra}>
                  {!todayList.items.length && !linesLoading && (
                    <p className="qs-hint">
                      {earlier.length ? "A fresh list for today." : `What will you do for ${sel.type === "Lesson" ? "this lesson" : "this quest"} today?`}{" "}
                      {building && !building.complete ? `Each task you tick lays pieces on the ${building.name.toLowerCase()}.` : "Each task you tick lays pieces in the village."}
                    </p>
                  )}
                  <AddLine key={sel.key} hidden={picker.on} onAdd={(parsed, kind) => addLines(parsed, kind)} />
                </DayList>

                <OngoingList
                  key={sel.key}
                  list={ongoing}
                  kind={kind}
                  openId={homeOpen}
                  row={row}
                  onAddSubs={addSubs}
                  {...drag}
                  drop="ongoing"
                  action={
                    !picker.on && ongoing.items.length + ongoing.earlier.length + earlier.length > 0 ? (
                      <button type="button" className="btn btn--sm today-pick-btn" onClick={startPicking}>
                        Pick for today
                      </button>
                    ) : null
                  }
                >
                  {picker.on && <p className="today-hint">Tap the lines to pick them for today. Lines on earlier days can be picked too.</p>}
                  <AddLine key={sel.key} ongoing hidden={picker.on} onAdd={(parsed, kind) => addLines(parsed, kind, true)} />
                </OngoingList>

                {earlier.length > 0 && <h2 className="eyebrow qs-earlier">Earlier</h2>}
                {earlierShown.map((d) => (
                  <DayList
                    key={d.day}
                    day={d}
                    label={dayLabel(d.day, today)}
                    today={today}
                    folded={!unfolded[d.day]}
                    onFold={() => setUnfolded((u) => ({ ...u, [d.day]: !u[d.day] }))}
                    openId={homeOpen}
                    row={row}
                    onAddSubs={addSubs}
                    {...drag}
                  />
                ))}
                {earlier.length > earlierShown.length && (
                  <button type="button" className="btn btn--sm btn--on-page qs-older" onClick={() => setAllEarlier(true)}>
                    Show {earlier.length - earlierShown.length} older {earlier.length - earlierShown.length === 1 ? "day" : "days"}
                  </button>
                )}
                {picker.on && <PickBar count={picker.sel.size} busy={saving} onCancel={picker.stop} onDone={savePicks} />}
              </>
            )}
          </div>
        </div>
      </SketchProvider>

      {newQuest && <NewQuest onSave={startQuest} onClose={() => setNewQuest(false)} />}
    </div>
  );
}

function NewQuest({ onSave, onClose }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title="New quest" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim() || busy) return;
          setBusy(true);
          await onSave(title.trim());
          setBusy(false);
        }}
      >
        <label className="field">
          <span>Name</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Build the best Premiere Pro plugin" autoFocus />
        </label>
        <p className="ascent-mini">Add its camps from its pill here. Its goal can be set on The Range.</p>
        <div className="ascent-sheet__actions">
          <span className="spacer" />
          <button type="submit" className="btn btn--accent" disabled={busy || !title.trim()}>
            {busy ? "Starting…" : "Start it"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
