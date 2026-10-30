import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Castle, Plus } from "lucide-react";
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
  fetchTodayOrder,
  reorder,
  saveTodayOrder,
  updateQuest,
  updateQuestTask,
  updateQuestTasks,
  updateSection,
  updateSections,
  updateStep,
  updateSteps,
  moveToCamp,
  lineToStep,
  stepToLine,
  addSection,
  fetchSectionExtras,
  resolveSection,
  deleteStep,
  placeSteps,
} from "../lib/api";
import { boardOf, byPos, campTally, dayLabel, listDays, nextPosition, ongoingList, pickedLines, withFinished, withFinishedStep } from "../lib/questTasks";
import { buildCamp, kindFields, pickDiff, questToday, resolvePlan, resolveWords, resolvedLine, stepsUnder } from "../lib/camp";
import { applyRows, inPageOrder, planMove } from "../lib/stepMoves";
import { computersOf, moveKey, NO_FILTER, orderCards, todayCards } from "../lib/todayBoard";
import { villageOf } from "../lib/village";
import { allDoneToday, earlierOnToday, questDoneToday } from "../lib/doneToday";
import { appendToNote } from "../lib/sketch";
import { savesInOrder, undoableSave } from "../lib/inOrder";
import { fmtDayHeading, todayStr } from "../lib/planDates";
import { useLoad } from "../lib/useLoad";
import { markDrop } from "../lib/useDragSort";
import { haptic } from "../lib/haptics";
import { playClink } from "../lib/clink";
import { useConfirm, useToast } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import Sheet from "../components/ascent/Sheet";
import FloatingBuild, { BuildMini, buildNow } from "../components/quests/FloatingBuild";
import { AddLine, DayList, LineTree, OngoingList } from "../components/quests/Lines";
import QuestMap from "../components/quests/QuestMap";
import DoneToday from "../components/quests/DoneToday";
import TodayBoard, { useBoardView } from "../components/quests/TodayBoard";
import { PickBar, usePick } from "../components/camp/Today";
import { SketchProvider } from "../components/sketch/Sketches";
import { PhotoProvider } from "../components/photos/Photos";
import Clipboard, { ColumnSheet } from "../components/camp/Clipboard";
import { SelectBar, SelectButton, useSelect } from "../components/camp/Select";
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
//
// The count on Today, and the build's "N today", open everything finished
// today (Aaron, 2026-10-27): on this quest, or on every quest.
//
// Today is a board (0092, Aaron 2026-10-28): everything on it in the order
// he drags it into, or in columns by camp or by the computer it's handed to
// (he has more than one computer and chat working on a quest), filtered by
// urgency or colour. See TodayBoard.jsx.
//
// Under Today sits the clipboard (0095, Aaron 2026-10-30): "this quest page
// is all about gathering and organizing tasks". Columns he makes in a
// moment, each in one of the quest's camps, where a meeting's hundred
// thoughts land as fast as he types; then he selects many, drags them
// between columns or into a camp's sections, or makes a section of them.

const EARLIER_SHOWN = 10;
// A quest task's own columns, for putting one back as it was.
const QUEST_TASK_COLS = ["id", "quest_id", "parent_id", "kind", "text", "note", "urgency", "color", "day", "ongoing", "today_on", "computer", "working_since", "pin_id", "done_on", "done_at", "position", "created_at", "updated_at"];

// Wide enough for the list beside the build: Today's board in columns then
// takes the whole width above them.
const WIDE = "(min-width: 901px)";
function useWide() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && Boolean(window.matchMedia?.(WIDE).matches));
  useEffect(() => {
    const mql = window.matchMedia?.(WIDE);
    if (!mql) return undefined;
    const on = (e) => setWide(e.matches);
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, []);
  return wide;
}

export default function Quests() {
  const { key } = useParams();
  const { user } = useAuth();
  const userId = user?.id;
  const today = todayStr();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

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

  // Today's board (0092): the order he put today in, his computers on this
  // quest, and everything on today as cards in that order.
  // The order comes stamped with the quest and day it's for, so another
  // quest's (or yesterday's) never stands in for this one's; until this
  // one's is in, Today shows the order it always had and nothing saves
  // over the one kept.
  const {
    data: todayOrder,
    error: todayOrderError,
    reload: reloadTodayKeys,
    mutate: mutateTodayOrder,
  } = useLoad(async () => ({ quest: questId, day: today, keys: userId && questId ? await fetchTodayOrder(userId, questId, today) : [] }), [userId, questId, today]);
  const orderReady = todayOrder?.quest === questId && todayOrder?.day === today;
  const todayKeys = orderReady ? todayOrder.keys : undefined;
  const mutateTodayKeys = (keys) => mutateTodayOrder({ quest: questId, day: today, keys });
  const computers = useMemo(() => computersOf(board?.quests.find((q) => q.id === questId)?.computers), [board, questId]);
  // Numbers still handed out on any of this quest's rows, which a new
  // computer mustn't take.
  const usedComputers = useMemo(
    () => [...new Set([...(lines ?? []).filter((x) => x.quest_id === questId), ...(campData?.steps ?? []), ...(campData?.sections ?? [])].map((x) => x.computer).filter((n) => n != null))],
    [lines, campData, questId]
  );
  const ownToday = days[0]?.items;
  const cards = useMemo(
    () => orderCards(todayCards({ camps: questCamps, sections: campData?.sections, steps: campData?.steps, own: ownToday ?? [], picked: picked.items }, today), todayKeys),
    [questCamps, campData, ownToday, picked, today, todayKeys]
  );
  // The order as it is now, for an Undo tapped after other changes, and
  // the quest and day open now (and whether its cards and order are in),
  // for one tapped after another was opened.
  const cardKeys = useRef([]);
  cardKeys.current = cards.map((c) => c.key);
  const questNow = useRef(questId);
  questNow.current = questId;
  const dayNow = useRef(today);
  dayNow.current = today;
  const readyNow = useRef(false);
  const [boardView, setBoardView] = useBoardView();
  // A filter, and the cards on Today when it was set (`since`, with `at`
  // the quest and day they were on): one added or picked since shows
  // whatever it is, so it doesn't vanish as it's made. On another quest or
  // day, or set before this one's cards were in, it's taken afresh once
  // they are, and until then the filter holds for every card.
  const [boardFilter, setBoardFilterOnly] = useState({ ...NO_FILTER, since: null, at: null });
  const boardAt = `${questId}|${today}`;
  const [filtering, setFiltering] = useState(false);
  const roomy = useWide();

  // Everything finished today, which the count on Today ("quest") and the
  // build's "N today" ("all") open.
  const [doneView, setDoneView] = useState(null);
  const doneHere = useMemo(
    () => questDoneToday({ camps: questCamps, sections: campData?.sections, steps: campData?.steps, lines: (lines ?? []).filter((l) => l.quest_id === questId) }, today),
    [questCamps, campData, lines, questId, today]
  );
  // Once the open quest's own lines and steps are in (and not the last
  // quest's, for the render before they reload), "All quests" and the
  // build's count take its day from them, as "This quest" does.
  const hereLoaded =
    Boolean(questId) &&
    lines !== undefined &&
    campData !== undefined &&
    lines.every((l) => l.quest_id === questId) &&
    (campData.steps ?? []).every((s) => questCamps.some((c) => c.id === s.camp_id));
  const cardsIn = hereLoaded && orderReady;
  readyNow.current = cardsIn;
  const setBoardFilter = (f) => setBoardFilterOnly({ ...f, since: cardsIn ? new Set(cardKeys.current) : null, at: cardsIn ? boardAt : null });
  useEffect(() => {
    if (cardsIn) setBoardFilterOnly((f) => (f.at === boardAt ? f : { ...f, since: new Set(cardKeys.current), at: boardAt }));
  }, [cardsIn, boardAt]);
  const shownFilter = boardFilter.at === boardAt ? boardFilter : { ...boardFilter, since: null };
  const doneAll = useMemo(
    () =>
      board
        ? allDoneToday(
            { items, quests: board.quests, lessons: board.lessons, camps: board.camps, tasks: board.finished.tasks, steps: board.finished.steps },
            today,
            hereLoaded ? { questId, groups: doneHere.groups, count: doneHere.count } : null
          )
        : [],
    [board, items, today, hereLoaded, questId, doneHere]
  );
  const doneAllCount = doneAll.reduce((n, q) => n + q.count, 0);

  // A line open where it sits is its id; open in today's list, "t:" and its id.
  const [openId, setOpenId] = useState(null);
  const [openStep, setOpenStep] = useState(null);
  const [openClip, setOpenClip] = useState(null); // a step open on the clipboard
  const [colSheet, setColSheet] = useState(null); // a clipboard column to rename
  const select = useSelect();
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
    setOpenClip(null);
    setUnfolded({});
    setAllEarlier(false);
    picker.stop();
    select.stop();
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

  // The reload waits for the moves already saving (see inOrder.js).
  const failed = (err, what) => {
    toast.error(err, what);
    inOrder.reload(() => Promise.all([reloadLines(), reload()]));
  };

  // --- The list -------------------------------------------------------------

  // (before they're in, there's nothing to change: what loads is the saved)
  const setLine = (id, fields) => mutateLines((list) => list && list.map((x) => (x.id === id ? { ...x, ...fields } : x)));
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
    // Finishing it means you're no longer working on it.
    const fields = done_on && line.working_since ? { done_on, done_at, working_since: null } : { done_on, done_at };
    setLine(line.id, fields);
    tellVillage({ ...line, done_on, done_at });
    if (done_on) cheer(before);
    updateQuestTask(line.id, fields).catch((err) => failed(err, "Couldn't save that."));
  }

  function saveLine(line, fields) {
    setLine(line.id, fields);
    if (line.done_on) tellVillage({ ...line, ...fields });
    updateQuestTask(line.id, fields).catch((err) => failed(err, "Couldn't save that."));
  }

  // A task becomes a line of notes (it can't be ticked, so it lays no bricks,
  // and isn't urgent), or back.
  function switchKind(line) {
    const fields = line.kind === "note" ? { kind: "task" } : { kind: "note", done_on: null, done_at: null, urgency: null };
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
  // Stamped now, as updateStep stamps it, so "Done today" lists it in turn.
  const tellBoard = (st) =>
    mutateBoard(
      (b) =>
        b && {
          ...b,
          finished: { ...b.finished, steps: withFinishedStep(b.finished.steps, { ...st, updated_at: new Date().toISOString() }) },
          campSteps: (b.campSteps ?? []).map((x) => (x.id === st.id ? { ...x, kind: st.kind ?? "task", done_on: st.done_on ?? null, working_since: st.working_since ?? null, today_on: st.today_on ?? null } : x)),
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
      return rows;
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
  function moveLineTo(line, where, beforeId = null, extra = {}) {
    const all = lines ?? [];
    const onList = where === "ongoing";
    const there = all.filter((x) => !x.parent_id && x.id !== line.id && (onList ? x.ongoing : !x.ongoing && x.day === today)).sort(byPos);
    const at = beforeId ? there.findIndex((x) => x.id === beforeId) : -1;
    const next = [...there];
    next.splice(at < 0 ? next.length : at, 0, line);
    const pos = new Map(next.map((x, k) => [x.id, k]));
    const same = !line.parent_id && Boolean(line.ongoing) === onList && (onList || line.day === today) && Object.keys(extra).every((k) => (line[k] ?? null) === extra[k]);
    if (same && next.every((x) => x.position === pos.get(x.id))) return;
    const rest = { ongoing: onList, ...(onList ? {} : { day: today }) };
    const top = { parent_id: null, ...rest, ...extra };
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
    const was = { parent_id: line.parent_id ?? null, day: line.day, ongoing: Boolean(line.ongoing), position: line.position ?? 0, ...Object.fromEntries(Object.keys(extra).map((k) => [k, line[k] ?? null])) };
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
  // the lines it landed on. `skip` is what's being carried. On Today's
  // board it lands between the cards, in the column under the finger
  // (`col`, with its cards' keys) when it's in columns.
  function lineDropTarget(x, y, line, skip = `#line-${line.id}`) {
    const under = document.elementsFromPoint(x, y).filter((e) => !e.closest(skip));
    const el = under.find((e) => e.closest("[data-drop]:not([data-clip])"))?.closest("[data-drop]:not([data-clip])");
    if (!el) return null;
    const tb = el.dataset.drop === "today" ? el.querySelector(".tb") : null;
    if (tb) {
      const inCols = Boolean(tb.querySelector(".tb-cols"));
      // only a computer's column takes it there (by camp it goes on today's list)
      const col = inCols ? (under.find((e) => e.closest(".tb-col[data-col]"))?.closest(".tb-col[data-col]") ?? null) : null;
      const cards = inCols ? (col ? [...col.querySelectorAll("[data-open] > [data-card]")] : []) : [...tb.querySelectorAll("[data-open] > [data-card]")];
      const others = cards.filter((c) => c.dataset.card !== `line:${line.id}`);
      const below = others.find((c) => {
        const r = c.getBoundingClientRect();
        return y < r.top + r.height / 2;
      });
      return { el, below, where: "today", board: true, beforeKey: below?.dataset.card ?? null, col: col?.dataset.col ?? null, colEl: col, colKeys: others.map((c) => c.dataset.card) };
    }
    const below = [...el.querySelectorAll(":scope > ul.qs-lines:not(.qs-lines--done) > li.qs-line")].find((li) => {
      if (li.id === `line-${line.id}`) return false;
      const r = li.getBoundingClientRect();
      return y < r.top + r.height / 2;
    });
    return { el, below, where: el.dataset.drop, beforeId: below ? below.id.slice(5) : null };
  }

  function dragLineOut(phase, x, y, line) {
    const hit = phase === "move" || phase === "drop" ? lineDropTarget(x, y, line) : null;
    // over a column, the column lights up and room opens in it (not under
    // the whole board)
    const col = phase === "move" ? (hit?.colEl ?? null) : null;
    markDrop(phase === "move" ? (col && !hit.below ? { ...hit, below: col } : hit) : null);
    document.querySelectorAll(".tb-col.tb-drop").forEach((e) => e !== col && e.classList.remove("tb-drop", "tb-drop-end"));
    col?.classList.add("tb-drop");
    col?.classList.toggle("tb-drop-end", !hit.below);
    if (phase !== "drop" || !hit) return;
    if (hit.board) dropOnBoard(line, hit);
    else moveLineTo(line, hit.where, hit.beforeId);
  }

  // A line let go on Today's board: on today's list among today's own
  // lines (just before the first of them from where it landed on), in the
  // board's order where it landed, and dropped in a computer's column,
  // handed to that computer.
  function dropOnBoard(line, hit) {
    const key = `line:${line.id}`;
    const order = cardKeys.current;
    const own = new Set((days[0]?.items ?? []).map((x) => x.id));
    const from = hit.beforeKey ? order.indexOf(hit.beforeKey) : -1;
    const beforeId = from < 0 ? null : (order.slice(from).find((k) => k.startsWith("line:") && own.has(k.slice(5)) && k !== key)?.slice(5) ?? null);
    const known = (v) => (computers.some((c) => c.n === v) ? v : null);
    const n = hit.col == null || hit.col === "none" ? null : Number(hit.col.slice(3));
    const extra = hit.col != null && known(n) === n && n !== known(line.computer) ? { computer: n } : {};
    moveLineTo(line, "today", beforeId, extra);
    if (!orderReady) return;
    const keys = moveKey(order, key, hit.beforeKey, hit.colKeys);
    if (keys.join() === order.join()) return;
    mutateTodayKeys(keys);
    inOrder(() => saveTodayOrder(userId, questId, today, keys)).catch((err) => boardFailed(err, "Couldn't save that order."));
  }

  // One of today's own lines carried off Today's board: only the ongoing
  // list takes it, since today's list is where it is already.
  function boardLineOut(phase, x, y, line) {
    const hit = phase === "move" || phase === "drop" ? lineDropTarget(x, y, line, `[data-card="line:${line.id}"]`) : null;
    const there = hit?.where === "ongoing" ? hit : null;
    markDrop(phase === "move" ? there : null);
    if (phase === "drop" && there) moveLineTo(line, "ongoing", there.beforeId);
  }

  // --- Today's board (0092) -------------------------------------------------------------

  // A save that didn't land: what's on screen is reloaded once the saves
  // before it are in.
  const boardFailed = (err, what) => {
    toast.error(err, what);
    inOrder.reload(() => Promise.all([reloadLines(), reloadCamps(), reloadTodayKeys()]));
  };

  // Today's own lines keep the board's order among themselves too, so the
  // day reads the same once it's an earlier day.
  function ownInOrder(keys) {
    const own = (linesNow.current ?? []).filter((x) => x.quest_id === questId && !x.parent_id && !x.ongoing && x.day === today).sort(byPos);
    const at = new Map(keys.map((k, i) => [k, i]));
    const next = [...own].sort((a, b) => (at.get(`line:${a.id}`) ?? 1e9) - (at.get(`line:${b.id}`) ?? 1e9));
    if (next.every((x, i) => x.id === own[i].id)) return;
    const pos = new Map(next.map((x, i) => [x.id, i]));
    mutateLines((list) => (list ?? []).map((x) => (pos.has(x.id) ? { ...x, position: pos.get(x.id) } : x)));
    inOrder(() => reorder("quest_tasks", next)).catch((err) => boardFailed(err, "Couldn't move that."));
  }

  // Until today's order is in, a drag can't be saved over it.
  const orderLoading = () => {
    if (orderReady) return false;
    toast.show(todayOrderError ? "Today's order didn't load. Try again above." : "One moment, today's order is still loading.");
    return true;
  };

  // Dragged into a new order (every card's key, in order).
  function saveOrder(keys) {
    if (orderLoading()) return;
    mutateTodayKeys(keys);
    ownInOrder(keys);
    inOrder(() => saveTodayOrder(userId, questId, today, keys)).catch((err) => boardFailed(err, "Couldn't save that order."));
  }

  // A card handed to one of his computers (`n`; null, to no one), and with
  // `keys` Today's new order. Undo puts both back: the card where it was
  // among the others as they are when Undo is tapped (they may have been
  // moved since), and on this quest's Today only if it's still the one open.
  function assignCard(card, n, keysIn) {
    const keys = orderReady ? keysIn : null;
    const qid = questId;
    const was = card.computer ?? null;
    const wasKeys = cardKeys.current;
    const put = (computer) => {
      if (card.kind === "line") setLine(card.id, { computer });
      else if (card.kind === "step") setCampSteps((list) => list.map((x) => (x.id === card.id ? { ...x, computer } : x)));
      else mutateCamps((d) => d && { ...d, sections: d.sections.map((x) => (x.id === card.id ? { ...x, computer } : x)) });
    };
    const write = (computer) => (card.kind === "line" ? updateQuestTask : card.kind === "step" ? updateStep : updateSection)(card.id, { computer });
    const save = (computer, order) => () => write(computer).then(() => order && saveTodayOrder(userId, qid, today, order));
    put(n);
    if (keys) {
      mutateTodayKeys(keys);
      ownInOrder(keys);
    }
    const undo = undoableSave(inOrder, save(n, keys), (err) => boardFailed(err, "Couldn't hand that over."));
    haptic("tap");
    const nameOf = (x) => computers.find((c) => c.n === x)?.name;
    toast.show(n != null ? `Handed to ${nameOf(n)}` : nameOf(was) ? `Taken off ${nameOf(was)}` : "Not assigned", {
      actionLabel: "Undo",
      onAction: () => {
        const here = questNow.current === qid;
        // its cards and order on screen now, for the same quest and day
        const live = here && dayNow.current === today && readyNow.current;
        // otherwise the order it was handed over from is saved back for that
        // quest and day, and nothing on screen is touched
        let back = keys && !live ? wasKeys : null;
        if (keys && live) {
          // just before the first card that followed it then and is still here
          const now = cardKeys.current.filter((k) => k !== card.key);
          const after = wasKeys.slice(wasKeys.indexOf(card.key) + 1).find((k) => now.includes(k));
          back = [...now];
          back.splice(after ? now.indexOf(after) : now.length, 0, card.key);
        }
        if (here) put(was);
        if (back && live) {
          mutateTodayKeys(back);
          ownInOrder(back);
        }
        undo(save(was, back), (err) => boardFailed(err, "Couldn't put that back."));
        // still loading here, what comes back is from before Undo
        if (here && !live) inOrder.reload(() => Promise.all([reloadLines(), reloadCamps(), reloadTodayKeys()]));
      },
    });
  }

  // A step or a section dragged into another camp's column (By camp): it
  // moves to that camp, at the end of its loose steps (a step) or its
  // sections, and what's under it comes along. `keys` is Today's new order.
  // Undo puts every row back as it was.
  function moveCardToCamp(card, campId, keysIn) {
    if (!campData) return;
    const keys = orderReady ? keysIn : null;
    const steps = campData.steps ?? [];
    const sections = campData.sections ?? [];
    const end = (list) => list.reduce((m, x) => Math.max(m, (x.position ?? 0) + 1), 0);
    let table;
    let to;
    let back;
    if (card.kind === "step") {
      const under = [];
      const walk = (id) => steps.filter((x) => x.parent_id === id).forEach((x) => (under.push(x), walk(x.id)));
      walk(card.id);
      const st = rawStep(card.id);
      if (!st) return;
      const position = end(steps.filter((x) => x.camp_id === campId && !x.section_id && !x.parent_id));
      table = "camp_steps";
      to = [{ id: st.id, camp_id: campId, section_id: null, parent_id: null, position }, ...under.map((x) => ({ id: x.id, camp_id: campId, section_id: null }))];
      back = [st, ...under].map((x) => ({ id: x.id, camp_id: x.camp_id, section_id: x.section_id ?? null, parent_id: x.parent_id ?? null, position: x.position }));
    } else {
      const sec = sections.find((x) => x.id === card.id);
      if (!sec) return;
      const position = end(sections.filter((x) => x.camp_id === campId));
      table = "camp_sections";
      to = [{ id: sec.id, camp_id: campId, position }];
      back = [{ id: sec.id, camp_id: sec.camp_id, position: sec.position }];
    }
    // a section's steps go with it, in their own table, each after the step
    // it's under (a sub-step can only be in the same camp as its step)
    const inSec = card.kind === "section" ? steps.filter((x) => x.section_id === card.id) : [];
    // (one under a step outside the section goes with the section, on its own)
    const inIds = new Set(inSec.map((x) => x.id));
    const roots = inSec.filter((x) => !x.parent_id || !inIds.has(x.parent_id));
    const loose = new Set(roots.filter((x) => x.parent_id).map((x) => x.id));
    const secSteps = [];
    const add = (x) => (secSteps.push(x), inSec.filter((y) => y.parent_id === x.id).forEach(add));
    roots.forEach(add);
    const put = (rows, stepRows) => {
      const by = new Map(rows.map((r) => [r.id, r]));
      const st = new Map(stepRows.map((r) => [r.id, r]));
      mutateCamps(
        (d) =>
          d &&
          (table === "camp_steps"
            ? { ...d, steps: d.steps.map((x) => (by.has(x.id) ? { ...x, ...by.get(x.id) } : x)) }
            : { ...d, sections: d.sections.map((x) => (by.has(x.id) ? { ...x, ...by.get(x.id) } : x)), steps: d.steps.map((x) => (st.has(x.id) ? { ...x, ...st.get(x.id) } : x)) })
      );
    };
    const stepsTo = secSteps.map((x) => ({ id: x.id, camp_id: campId, ...(loose.has(x.id) ? { parent_id: null } : {}) }));
    const stepsBack = secSteps.map((x) => ({ id: x.id, camp_id: x.camp_id, ...(loose.has(x.id) ? { parent_id: x.parent_id } : {}) }));
    const save = (rows, stepRows, order) => () =>
      moveToCamp(table, rows)
        .then(() => stepRows.length && moveToCamp("camp_steps", stepRows))
        .then(() => order && saveTodayOrder(userId, questId, today, order));
    const qid = questId;
    put(to, stepsTo);
    if (keys) mutateTodayKeys(keys);
    const undo = undoableSave(inOrder, save(to, stepsTo, keys), (err) => boardFailed(err, "Couldn't move that."));
    haptic("tap");
    const name = questCamps.find((c) => c.id === campId)?.title ?? "that camp";
    toast.show(`Moved to ${name}`, {
      actionLabel: "Undo",
      onAction: () => {
        const live = questNow.current === qid && dayNow.current === today && readyNow.current;
        // back in its own camp's column; its place in Today's order stays
        if (live) put(back, stepsBack);
        undo(save(back, stepsBack, null), (err) => boardFailed(err, "Couldn't put that back."));
        if (!live) inOrder.reload(() => Promise.all([reloadLines(), reloadCamps(), reloadTodayKeys()]));
      },
    });
  }

  // A task from the quest's list dragged into a camp's column (By camp): it
  // becomes a step there, loose at the end, still on today, its sub-tasks
  // sub-steps (a note under it goes into the step's note). Same text, note,
  // urgency, colour, computer and tick; its sketches come along. `keys` is
  // Today's new order, with the line's key. Undo makes it the task again.
  function lineToCamp(card, campId, keysIn) {
    if (!campData) return;
    const raw = (linesNow.current ?? []).filter((x) => x.quest_id === questId);
    const task = raw.find((x) => x.id === card.id);
    if (!task || (task.kind ?? "task") !== "task") return;
    const subs = raw.filter((x) => x.parent_id === task.id).sort(byPos);
    const subTasks = subs.filter((x) => (x.kind ?? "task") === "task");
    const notes = subs.filter((x) => x.kind === "note").map((x) => x.text);
    const note = [task.note, ...notes].filter(Boolean).join("\n\n") || null;
    if ([task, ...subTasks].some((x) => x.text.length > 1000) || (note?.length ?? 0) > 4000 || subTasks.some((x) => (x.note?.length ?? 0) > 4000)) {
      toast.show("That task is too long to be a step.");
      return;
    }
    const position = (campData.steps ?? []).filter((x) => x.camp_id === campId && !x.section_id && !x.parent_id).reduce((m, x) => Math.max(m, (x.position ?? 0) + 1), 0);
    const id = crypto.randomUUID();
    const base = (x) => ({ camp_id: campId, section_id: null, text: x.text, urgency: x.urgency ?? null, color: x.color ?? null, done_on: x.done_on ?? null, working_since: x.working_since ?? null, pin_id: x.pin_id ?? null, from: x.id });
    const steps = [
      { ...base(task), id, parent_id: null, note, today_on: today, computer: task.computer ?? null, position },
      ...subTasks.map((x, i) => ({ ...base(x), id: crypto.randomUUID(), parent_id: id, note: x.note ?? null, position: i })),
    ];
    const local = steps.map(({ from, ...r }) => ({ ...r, created_at: new Date().toISOString() }));
    const tasks = [task, ...subs].map((x) => Object.fromEntries(Object.entries(x).filter(([k]) => QUEST_TASK_COLS.includes(k))));
    const was = `line:${task.id}`;
    const now = `step:${id}`;
    const keys = orderReady && keysIn ? keysIn.map((k) => (k === was ? now : k)) : null;
    const gone = new Set([task.id, ...subs.map((x) => x.id)]);
    const qid = questId;
    mutateLines((list) => (list ?? []).filter((x) => !gone.has(x.id)));
    setCampSteps((list) => [...list, ...local]);
    if (keys) mutateTodayKeys(keys);
    const save = () => lineToStep(userId, steps, subs.filter((x) => x.kind === "note").map((x) => x.id)).then(() => keys && saveTodayOrder(userId, qid, today, keys));
    const undo = undoableSave(inOrder, save, (err) => boardFailed(err, "Couldn't move that."));
    haptic("tap");
    const name = questCamps.find((c) => c.id === campId)?.title ?? "that camp";
    toast.show(`Now a step in ${name}`, {
      actionLabel: "Undo",
      onAction: () => {
        const live = questNow.current === qid && dayNow.current === today && readyNow.current;
        const back = keys ? (live ? cardKeys.current : keys).map((k) => (k === now ? was : k)) : null;
        if (live) {
          mutateLines((list) => [...(list ?? []), ...tasks]);
          setCampSteps((list) => list.filter((x) => !steps.some((st) => st.id === x.id)));
          if (back) mutateTodayKeys(back);
        }
        undo(
          () => stepToLine(userId, tasks, steps).then(() => back && saveTodayOrder(userId, qid, today, back)),
          (err) => boardFailed(err, "Couldn't put that back.")
        );
        if (!live) inOrder.reload(() => Promise.all([reloadLines(), reloadCamps(), reloadTodayKeys()]));
      },
    });
  }

  // --- The clipboard (0095) ----------------------------------------------------------

  const sortedCamps = useMemo(() => [...questCamps].sort(byPos), [questCamps]);
  // Every camp's clipboard columns, in camp order, each camp's in its own.
  const clipCols = useMemo(
    () =>
      sortedCamps.flatMap((camp) =>
        buildCamp(
          (campData?.sections ?? []).filter((x) => x.camp_id === camp.id),
          (campData?.steps ?? []).filter((x) => x.camp_id === camp.id)
        ).clips.map((section) => ({ section, camp }))
      ),
    [sortedCamps, campData]
  );
  // The steps as they are now, for a move or an Undo made after others.
  const campStepsNow = useRef(null);
  campStepsNow.current = campData?.steps ?? null;
  const setTally = (fn) => mutateBoard((b) => b && { ...b, campSteps: fn(b.campSteps ?? []) });
  const tallyRow = (r) => ({ id: r.id, camp_id: r.camp_id, section_id: r.section_id ?? null, parent_id: r.parent_id ?? null, kind: r.kind ?? "task", done_on: r.done_on ?? null, working_since: null, today_on: r.today_on ?? null });
  const stepsFailed = (err, what) => {
    toast.error(err, what);
    inOrder.reload(() => Promise.all([reloadCamps(), reload()]));
  };
  const nSteps = (n) => (n === 1 ? "1 step" : `${n} steps`);
  const shortText = (t) => {
    const s = String(t ?? "");
    return s.length > 40 ? `${s.slice(0, 40).trimEnd()}…` : s;
  };
  const sectionName = (sectionId, campId) => {
    const s = (campData?.sections ?? []).find((x) => x.id === sectionId);
    if (s) return s.title;
    return `the top of ${questCamps.find((c) => c.id === campId)?.title ?? "that camp"}`;
  };

  // The ones selected, in the order they sit; carrying one of them carries all.
  const chosenSteps = () => inPageOrder(select.sel, campData?.steps ?? [], campData?.sections ?? [], sortedCamps);
  const clipGroup = (st) => (select.on && select.sel.has(st.id) && select.sel.size > 1 ? chosenSteps() : null);

  // Steps moved together (lib/stepMoves.js), into another column, another
  // camp's section or under another step: on screen at once, saved in one
  // go, all put back by Undo.
  function moveSteps(ids, to, label) {
    const plan = planMove(campStepsNow.current ?? [], ids, to);
    if (!plan || !plan.rows.length) return false;
    const show = (rows) => {
      setCampSteps((list) => applyRows(list, rows));
      setTally((list) => applyRows(list, rows));
    };
    show(plan.rows);
    haptic("tap");
    const undo = undoableSave(inOrder, () => placeSteps(plan.rows), (err) => stepsFailed(err, "Couldn't move those."));
    toast.show(label, {
      actionLabel: "Undo",
      onAction: () => {
        show(plan.was);
        undo(() => placeSteps(plan.was), (err) => stepsFailed(err, "Couldn't move those back."));
      },
    });
    return true;
  }

  // A step carried out of its column: the column under the finger lights
  // up, and letting go drops it (and any selected with it) in, between the
  // steps it landed on.
  function clipDropTarget(x, y, st, group) {
    const el = document
      .elementsFromPoint(x, y)
      .find((e) => !e.closest(`#step-${st.id}`) && e.closest("[data-clip]"))
      ?.closest("[data-clip]");
    if (!el) return null;
    const along = new Set((group ?? []).map((k) => `step-${k}`));
    const below = [...el.querySelectorAll("li.camp-step:not(.camp-step--sub)")].find((li) => {
      if (li.id === `step-${st.id}` || along.has(li.id)) return false;
      const r = li.getBoundingClientRect();
      return y < r.top + r.height / 2;
    });
    return { el, below, sectionId: el.dataset.drop, campId: el.dataset.camp, beforeId: below ? below.id.slice(5) : null };
  }

  function clipDragOut(phase, x, y, st) {
    const g = clipGroup(st);
    const hit = phase === "move" || phase === "drop" ? clipDropTarget(x, y, st, g) : null;
    markDrop(phase === "move" ? hit : null);
    if (phase !== "drop" || !hit) return;
    const ids = g ?? [st.id];
    moveSteps(ids, { campId: hit.campId, sectionId: hit.sectionId, beforeId: hit.beforeId }, `Moved ${g ? nSteps(ids.length) : "it"} to ${sectionName(hit.sectionId, hit.campId)}`);
  }

  function clipNest(st, parentId) {
    const parent = (campData?.steps ?? []).find((x) => x.id === parentId);
    if (!st || !parent) return;
    const ids = clipGroup(st) ?? [st.id];
    moveSteps(ids, { parentId }, `Moved ${ids.length > 1 ? nSteps(ids.length) : "it"} under “${shortText(parent.text)}”`);
  }

  // Dragged into a new order in its column (`shown` as it stood, `ids` the
  // new order, `draggedId` the one carried). Done ones hidden from it keep
  // their places; carrying several, they all land where it was let go.
  function clipReorder(shown, ids, draggedId) {
    const dragged = shown.find((x) => x.id === draggedId) ?? shown[0];
    if (!dragged) return;
    const g = clipGroup(dragged);
    if (g) {
      const along = new Set(g);
      const beforeId = ids.slice(ids.indexOf(dragged.id) + 1).find((k) => !along.has(k)) ?? null;
      moveSteps(g, { campId: dragged.camp_id, sectionId: dragged.section_id ?? null, parentId: dragged.parent_id ?? null, beforeId }, `Moved ${nSteps(g.length)} together`);
      return;
    }
    const full = (campData?.steps ?? [])
      .filter((x) => x.camp_id === dragged.camp_id && (x.section_id ?? null) === (dragged.section_id ?? null) && (x.parent_id ?? null) === (dragged.parent_id ?? null))
      .sort(byPos);
    const byId = new Map(full.map((x) => [x.id, x]));
    const onScreen = new Set(ids);
    const queue = [...ids];
    const next = full.map((x) => (onScreen.has(x.id) ? byId.get(queue.shift()) : x)).filter(Boolean);
    const at = new Map(next.map((x, k) => [x.id, k]));
    setCampSteps((list) => list.map((x) => (at.has(x.id) ? { ...x, position: at.get(x.id) } : x)));
    inOrder(() => reorder("camp_steps", next)).catch((err) => stepsFailed(err, "Couldn't move that."));
  }

  // New steps at the end of a column, or (`today`) a camp's own steps on today.
  async function addStepsTo(campId, sectionId, texts, extra = {}) {
    const there = (campData?.steps ?? []).filter((x) => x.camp_id === campId && (x.section_id ?? null) === (sectionId ?? null) && !x.parent_id);
    const start = there.reduce((m, x) => Math.max(m, (x.position ?? 0) + 1), 0);
    try {
      const rows = await addSteps(userId, campId, sectionId ?? null, texts, start, null, extra);
      setCampSteps((list) => [...list, ...rows]);
      setTally((list) => [...list, ...rows.map(tallyRow)]);
      haptic("tap");
      return rows;
    } catch (err) {
      toast.error(err, texts.length > 1 ? "Couldn't add those." : "Couldn't add that.");
      return false;
    }
  }

  // A new section in one of the quest's camps: a clipboard column, or one
  // of the camp's own (with what's selected moved in).
  async function newSectionIn({ title, campId }, clipboard) {
    const camp = questCamps.find((c) => c.id === campId) ?? sortedCamps[0];
    if (!camp) return null;
    try {
      const position = (campData?.sections ?? []).filter((x) => x.camp_id === camp.id).reduce((m, x) => Math.max(m, (x.position ?? 0) + 1), 0);
      const row = await addSection(userId, camp.id, { title, position, clipboard });
      mutateCamps((d) => d && { ...d, sections: [...d.sections, row] });
      mutateBoard((b) => b && { ...b, campSections: [...(b.campSections ?? []), { id: row.id, camp_id: row.camp_id, today_on: null, clipboard: Boolean(clipboard) }] });
      haptic("tap");
      return row;
    } catch (err) {
      toast.error(err, clipboard ? "Couldn't make that column." : "Couldn't make that section.");
      return null;
    }
  }

  async function newSectionForSelected(values) {
    const ids = chosenSteps();
    const row = await newSectionIn(values, false);
    if (!row) return false;
    if (ids.length) moveSteps(ids, { campId: row.camp_id, sectionId: row.id }, `Moved ${nSteps(ids.length)} to ${row.title}`);
    return true;
  }

  function moveSelectedTo(key) {
    const [campId, sectionId] = key.split("|");
    const ids = chosenSteps();
    if (!moveSteps(ids, { campId, sectionId: sectionId || null }, `Moved ${nSteps(ids.length)} to ${sectionName(sectionId, campId)}`)) toast.show(ids.length === 1 ? "It's there already." : "They're there already.");
  }

  // All of them notes, or (when they all are) tasks again.
  function kindOfSelected() {
    const ids = new Set(chosenSteps());
    const rows = (campData?.steps ?? []).filter((x) => ids.has(x.id));
    if (!rows.length) return;
    const toTasks = rows.every((x) => x.kind === "note");
    const fields = toTasks ? { kind: "task" } : { kind: "note", done_on: null, urgency: null, working_since: null };
    setCampSteps((list) => list.map((x) => (ids.has(x.id) ? { ...x, ...fields } : x)));
    setTally((list) => list.map((x) => (ids.has(x.id) ? { ...x, ...fields } : x)));
    haptic("tap");
    toast.show(toTasks ? `${rows.length === 1 ? "It's a task" : `${rows.length} are tasks`} again` : rows.length === 1 ? "Made a note" : `${rows.length} made notes`);
    updateSteps([...ids], fields).catch((err) => stepsFailed(err, "Couldn't change those."));
  }

  function startSelecting() {
    picker.stop();
    setOpenClip(null);
    select.start();
    haptic("tap");
  }

  function renameColumn(sec, title) {
    mutateCamps((d) => d && { ...d, sections: d.sections.map((x) => (x.id === sec.id ? { ...x, title } : x)) });
    updateSection(sec.id, { title }).catch((err) => stepsFailed(err, "Couldn't rename that column."));
  }

  // Its finished thoughts keep their bricks in the village (0097); the rest
  // goes with it, so it asks first when there's anything else in it.
  async function removeColumn(sec) {
    const steps = campData?.steps ?? [];
    const first = resolvePlan(sec, steps, { photos: 0, sketches: 0 });
    let extras = null;
    try {
      extras = await fetchSectionExtras(sec.id, first.all.map((x) => x.id));
    } catch {
      extras = null;
    }
    const plan = resolvePlan(sec, campStepsNow.current ?? steps, extras);
    if (plan.ask && !(await confirm(resolveWords(sec, plan, extras)))) return;
    try {
      await resolveSection(sec.id, today);
      // the build's finished steps stay as they are: they're kept, same ids
      mutateCamps((d) => d && { ...d, sections: d.sections.filter((x) => x.id !== sec.id), steps: d.steps.filter((x) => !plan.ids.has(x.id)) });
      setTally((list) => list.filter((x) => !plan.ids.has(x.id)));
      toast.show(resolvedLine(sec, plan.kept.length));
    } catch (err) {
      stepsFailed(err, "Couldn't remove that column.");
    }
  }

  // Taken off, with everything under it (Undo, for a few seconds, keeps it).
  function removeClipStep(st) {
    setOpenClip(null);
    const all = campData?.steps ?? [];
    const gone = [all.find((x) => x.id === st.id), ...stepsUnder(all, st.id)].filter(Boolean);
    const ids = new Set(gone.map((x) => x.id));
    setCampSteps((list) => list.filter((x) => !ids.has(x.id)));
    setTally((list) => list.filter((x) => !ids.has(x.id)));
    toast.undoable({
      message: gone.length > 1 ? "Step and its sub-steps removed" : "Removed",
      run: () => deleteStep(st.id).catch((err) => stepsFailed(err, "Couldn't remove that.")),
      onUndo: () => {
        setCampSteps((list) => [...list.filter((x) => !ids.has(x.id)), ...gone]);
        setTally((list) => [...list.filter((x) => !ids.has(x.id)), ...gone.map(tallyRow)]);
      },
    });
  }

  const clipRow = (st) => ({
    onOpen: () => {
      setOpenId(null);
      setOpenStep(null);
      setOpenClip((o) => (o === st.id ? null : st.id));
    },
    onDone: () => toggleStepDone(st),
    onSave: (fields) => saveStep(st, fields),
    onKind: () => saveStep(st, kindFields(st)),
    onRemove: () => removeClipStep(st),
    isToday: st.today_on === today,
    onToday: sectionOnToday(st) ? undefined : () => setStepToday(st, st.today_on !== today),
    select: select.of(st.id),
  });

  // His computers on this quest (quests.computers), renamed or added to.
  // Saved in line with the rest (a computer taken off just before saves its
  // shorter list first); if it doesn't save, what's saved is reloaded.
  function saveComputers(next) {
    const qid = questId;
    mutateBoard((b) => b && { ...b, quests: b.quests.map((q) => (q.id === qid ? { ...q, computers: next } : q)) });
    haptic("tap");
    inOrder(() => updateQuest(qid, { computers: next })).catch((err) => computersFailed(err, "Couldn't save your computers."));
  }

  // A computer list that didn't save: the board and Today come back as saved.
  const computersFailed = (err, what) => {
    toast.error(err, what);
    inOrder.reload(() => Promise.all([reload(), reloadLines(), reloadCamps(), reloadTodayKeys()]));
  };

  // One taken off: whatever was handed to it, any day, goes back to no one.
  // That's saved first and the shorter list after, so if it can't all be
  // let go of, the computer stays and nothing is left on a hidden number.
  function removeComputer(n) {
    const qid = questId;
    const off = (x) => (x.computer === n ? { ...x, computer: null } : x);
    const ids = (list) => (list ?? []).filter((x) => x.computer === n).map((x) => x.id);
    const lineIds = ids(lines);
    const stepIds = ids(campData?.steps);
    const secIds = ids(campData?.sections);
    const name = computers.find((c) => c.n === n)?.name ?? "That computer";
    const next = computers.filter((c) => c.n !== n);
    mutateLines((list) => (list ?? []).map(off));
    mutateCamps((d) => d && { ...d, steps: d.steps.map(off), sections: d.sections.map(off) });
    mutateBoard((b) => b && { ...b, quests: b.quests.map((q) => (q.id === qid ? { ...q, computers: next } : q)) });
    haptic("tap");
    toast.show(`${name} is off the board`);
    inOrder(async () => {
      await Promise.all([updateQuestTasks(lineIds, { computer: null }), updateSteps(stepIds, { computer: null }), updateSections(secIds, { computer: null })]);
      await updateQuest(qid, { computers: next });
    }).catch((err) => computersFailed(err, "Couldn't take everything off that computer."));
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
      // the rows made, so a picture pasted in (0098) can go on the first;
      // on a mountain made just now the page has moved on
      return made ? true : rows;
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
      return rows;
    } catch (err) {
      toast.error(err, parsed.length > 1 ? "Couldn't add those." : "Couldn't add that.");
      return false;
    }
  }

  // --- Photos and pins (0096) -------------------------------------------------------

  // Where a pin's tasks go: a photo's section; a sketch's step's section
  // (its camp's top, if in none); a sketch's line's list, beside it.
  // Null: not on this page.
  const pinHome = ({ photo, sketch }) => {
    if (photo) {
      const sec = (campData?.sections ?? []).find((x) => x.id === photo.section_id);
      return sec ? { campId: sec.camp_id, sectionId: sec.id } : null;
    }
    if (sketch?.camp_step_id) {
      const st = rawStep(sketch.camp_step_id);
      return st ? { campId: st.camp_id, sectionId: st.section_id ?? null } : null;
    }
    const line = sketch?.quest_task_id ? (lines ?? []).find((x) => x.id === sketch.quest_task_id) : null;
    return line ? { line } : null;
  };
  const pinProps = {
    sectionIds: (campData?.sections ?? []).map((x) => x.id),
    tasksOf: (pinId) => [...(campData?.steps ?? []).filter((x) => x.pin_id === pinId), ...(lines ?? []).filter((x) => x.pin_id === pinId)].sort(byPos),
    place: (target) => {
      const home = pinHome(target);
      if (!home) return null;
      if (home.line) return home.line.ongoing ? "the ongoing list" : home.line.day === today ? "today's list" : "its day's list";
      const sec = (campData?.sections ?? []).find((x) => x.id === home.sectionId);
      const camp = questCamps.find((c) => c.id === home.campId)?.title;
      if (sec?.clipboard) return `${camp ? `${camp}'s ` : "the "}${sec.title}`;
      return sectionName(home.sectionId, home.campId);
    },
    addTasks: async (target, texts) => {
      const home = pinHome(target);
      if (!home) return false;
      if (!home.line) return addStepsTo(home.campId, home.sectionId, texts, { pin_id: target.pin.id });
      const line = home.line;
      try {
        let pos = nextPosition(lines ?? [], line.ongoing ? null : line.day, line.parent_id ?? null);
        const rows = await addQuestTasks(
          userId,
          texts.map((text) => ({ quest_id: line.quest_id, parent_id: line.parent_id ?? null, kind: "task", text, day: line.day, ongoing: Boolean(line.ongoing), pin_id: target.pin.id, position: pos++ }))
        );
        mutateLines((list) => [...(list ?? []), ...rows]);
        haptic("tap");
        return true;
      } catch (err) {
        toast.error(err, texts.length > 1 ? "Couldn't add those." : "Couldn't add that.");
        return false;
      }
    },
    tick: (row) => (row.camp_id ? toggleStepDone(row) : toggleDone(row)),
  };

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
  // Lines drag by their handles, but not while picking for today.
  const drag = picker.on ? {} : { onReorder: reorderLines, onDragOut: dragLineOut, onInto: nestLine };
  const todayExtra = {
    done: picked.done + campToday.reduce((n, g) => n + g.done, 0),
    total: picked.total + campToday.reduce((n, g) => n + g.total, 0),
    count: picked.items.length + campToday.reduce((n, g) => n + g.items.length, 0),
  };
  // While picking, today's list shows what to do instead of its board, so
  // nothing there can change what's being picked.
  const todayLead = picker.on ? (
    <div className="today-from">
      <p className="today-hint">Pick lines from the lists below. A camp's steps are picked on the camp's own page.</p>
      {todayList.items.length > 0 && <span className="today-group__label today-group__label--own">Written for today</span>}
    </div>
  ) : cards.length ? (
    <TodayBoard
      view={boardView}
      onView={setBoardView}
      filter={shownFilter}
      onFilter={setBoardFilter}
      filtering={filtering}
      onFiltering={setFiltering}
      cards={cards}
      computers={computers}
      usedComputers={usedComputers}
      today={today}
      kind={kind}
      openStep={openStep}
      openOwn={homeOpen}
      openPicked={todayOpen}
      stepRow={stepRow}
      ownRow={row}
      pickedRow={mirrorRow}
      onAddStepSubs={addStepSubs}
      onAddLineSubs={addSubs}
      ownDrag={drag}
      onSectionOff={sectionOff}
      onLineOut={boardLineOut}
      onNest={nestLine}
      onOrder={saveOrder}
      onAssign={assignCard}
      onMoveCamp={(card, campId, keys) => (card.kind === "line" ? lineToCamp : moveCardToCamp)(card, campId, keys)}
      onComputers={saveComputers}
      onRemoveComputer={removeComputer}
      camps={sortedCamps}
      onAddToCamp={(campId, texts) => addStepsTo(campId, null, texts, { today_on: today })}
      sketch={{ userId, about: (sid) => rawStep(sid)?.text, onAddToNote: addToStepNote }}
    />
  ) : null;
  const earlier = earlierAll.filter((d) => d.items.length);
  const earlierShown = allEarlier ? earlier : earlier.slice(0, EARLIER_SHOWN);
  // In columns, on a screen wide enough, Today spans the page above the rest.
  const spread = Boolean(sel) && roomy && boardView !== "order" && !picker.on && cards.length > 0;
  const building = buildNow(village, today);
  const selected = select.on ? chosenSteps() : [];
  const clipPlaces = [
    ...clipCols.map((c) => ({ key: `${c.camp.id}|${c.section.id}`, label: c.section.title, group: `Clipboard · ${c.camp.title}` })),
    ...sortedCamps.flatMap((camp) => [
      { key: `${camp.id}|`, label: "The top of the camp (no section)", group: camp.title },
      ...buildCamp((campData?.sections ?? []).filter((x) => x.camp_id === camp.id), []).sections.map((x) => ({ key: `${camp.id}|${x.id}`, label: `${x.number}. ${x.title}`, group: camp.title })),
    ]),
  ];
  const clipCard =
    sel && sortedCamps.length > 0 ? (
      <SketchProvider kind="step" userId={userId} scopeId={sortedCamps.map((c) => c.id)} about={(sid) => rawStep(sid)?.text} onAddToNote={addToStepNote}>
        <Clipboard
          cols={clipCols}
          layout="row"
          camps={sortedCamps}
          openStep={openClip}
          step={clipRow}
          onAdd={(sec, texts) => addStepsTo(sec.camp_id, sec.id, texts)}
          onAddSubs={addStepSubs}
          onReorder={clipReorder}
          onDragOut={clipDragOut}
          onInto={clipNest}
          carry={select.on ? select.carry : undefined}
          onNewColumn={async (values) => Boolean(await newSectionIn(values, true))}
          onEditColumn={(sec) => setColSheet(sec)}
          tools={clipCols.length ? <SelectButton on={select.on} onStart={startSelecting} onStop={select.stop} /> : null}
          picking={picker.on}
        />
      </SketchProvider>
    ) : null;
  const todayCard = sel ? (
    <>
      {linesError && <LoadError what="this list" error={linesError} onRetry={reloadLines} stale={Boolean(lines)} />}
      {campsError && <LoadError what="what's picked for today in its camps" error={campsError} onRetry={reloadCamps} stale={Boolean(campData)} />}
      {todayOrderError && !orderReady && <LoadError what="the order you put today in" error={todayOrderError} onRetry={reloadTodayKeys} />}
      <DayList day={todayList} label="Today" sub={fmtDayHeading(today)} today={today} openId={homeOpen} row={row} onAddSubs={addSubs} {...drag} drop="today" lead={todayLead} ownInLead={!picker.on} extra={todayExtra} doneToday={doneHere.count} onDoneToday={() => setDoneView("quest")}>
        {!todayList.items.length && !linesLoading && (
          <p className="qs-hint">
            {earlier.length ? "A fresh list for today." : `What will you do for ${sel.type === "Lesson" ? "this lesson" : "this quest"} today?`}{" "}
            {building && !building.complete ? `Each task you tick lays pieces on the ${building.name.toLowerCase()}.` : "Each task you tick lays pieces in the village."}
          </p>
        )}
        <AddLine key={sel.key} hidden={picker.on} onAdd={(parsed, kind) => addLines(parsed, kind)} />
      </DayList>
    </>
  ) : null;

  return (
    <div className="page ascent qs">
      <PhotoProvider userId={userId} {...pinProps}>
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
        <div className={"qs-grid" + (spread ? " qs-grid--board" : "") + (clipCard ? " qs-grid--clip" : "")}>
          <div className="qs-rail">
            <div className="qs-rail__build">
              <FloatingBuild village={village} today={today} onAway={onAway} todayDone={doneAllCount} onToday={() => setDoneView("all")} />
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

          <div className={"qs-main" + (picker.on || select.on ? " picking" : "")}>
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
                {/* Today stays where it is in the page whatever the layout
                    (spread or not, it's CSS that moves it), so what's
                    open or focused in it stays so as it moves. */}
                <div className="qs-today">{todayCard}</div>
                {clipCard && <div className="qs-clip">{clipCard}</div>}

                <div className="qs-rest">
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
                </div>
              </>
            )}
          </div>
        </div>
      </SketchProvider>

      {select.on && (
        <SelectBar
          count={selected.length}
          places={clipPlaces}
          camps={sortedCamps}
          notes={selected.length > 0 && selected.every((k) => rawStep(k)?.kind === "note")}
          onMove={moveSelectedTo}
          onNewSection={newSectionForSelected}
          onKind={kindOfSelected}
          onClear={() => select.start()}
          onDone={select.stop}
        />
      )}
      {colSheet && (
        <ColumnSheet
          section={colSheet}
          onRename={(title) => renameColumn(colSheet, title)}
          onRemove={() => {
            const sec = colSheet;
            setColSheet(null);
            removeColumn(sec);
          }}
          onClose={() => setColSheet(null)}
        />
      )}
      {newQuest && <NewQuest onSave={startQuest} onClose={() => setNewQuest(false)} />}
      {doneView && (
        <DoneToday
          view={doneView}
          quest={sel ? { questId, name: sel.name, kind, ...doneHere, earlier: earlierOnToday([todayList.items, picked.items, ...campToday.map((g) => g.items)], today) } : null}
          all={doneAll}
          onView={setDoneView}
          onClose={() => setDoneView(null)}
        />
      )}
      </PhotoProvider>
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
