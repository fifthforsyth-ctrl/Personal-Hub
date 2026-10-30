import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { BookOpen, Check, ChevronLeft, Flag, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchCamp, addSteps, updateStep, updateSteps, deleteStep, addSection, updateSection, updateSections, deleteSection, updateCamp, reorder, moveStepToSection, placeSteps } from "../lib/api";
import { buildCamp, kindFields, pickDiff, stepsUnder, todayPicks } from "../lib/camp";
import { applyRows, inPageOrder, planMove } from "../lib/stepMoves";
import { todayStr, fmtShortDate } from "../lib/planDates";
import { appendToNote } from "../lib/sketch";
import { savesInOrder, undoableSave } from "../lib/inOrder";
import { useLoad } from "../lib/useLoad";
import { haptic } from "../lib/haptics";
import { playClink } from "../lib/clink";
import { useToast, useConfirm } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import Sheet from "../components/ascent/Sheet";
import { SectionCard, StepList, AddStep } from "../components/camp/Steps";
import { markDrop, useDragSort } from "../lib/useDragSort";
import { PlanNotes, Rich } from "../components/camp/Rich";
import { ColorPick } from "../components/camp/ColorPick";
import { SketchProvider } from "../components/sketch/Sketches";
import { PickBar, TodayBlocks, TodayHead, usePick } from "../components/camp/Today";
import Clipboard, { ColumnSheet } from "../components/camp/Clipboard";
import { SelectBar, SelectButton, useSelect } from "../components/camp/Select";
import "../styles/ascent.css";
import "../styles/camp.css";

// One camp on a mountain: one tab of the plugin quest, say. Its steps in
// sections the way the plan has them, each with notes, the next step still
// to do, notes on the camp itself, and what the plan says beside the steps
// (who to check in with, what makes a good plugin). The other camps on the
// same mountain are a tap away along the top.
//
// Above the steps sits Today (0090, Aaron 2026-10-27): any steps he picks
// to do today, or whole sections (0091), shown again there without leaving
// where they sit. A tick, a note or a sub-step in either place is the same
// one. Each day's Today starts empty; nothing carries forward.
//
// The camp's clipboard (0095, Aaron 2026-10-30) sits above its steps, or
// pinned down the right side of the window, where a meeting's thoughts wait
// to be dragged into the sections on the left. Select picks out many steps
// at once, anywhere on the page, to drag or move together, or to make a new
// section from.

const HIDE_KEY = "hub.camp.hideDone";
const PIN_KEY = "hub:clip-pinned";
// Wide enough for the clipboard down the right beside the steps.
const PIN_ROOM = "(min-width: 1100px)";

function readPin() {
  try {
    return localStorage.getItem(PIN_KEY) === "1";
  } catch {
    return false;
  }
}

function useRoom(query) {
  const [room, setRoom] = useState(() => typeof window !== "undefined" && Boolean(window.matchMedia?.(query).matches));
  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return undefined;
    const on = (e) => setRoom(e.matches);
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, [query]);
  return room;
}


function readHide() {
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

const byPos = (a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));

// A step's or a section's words, cut short for a toast.
const short = (t) => {
  const s = String(t ?? "");
  return s.length > 40 ? `${s.slice(0, 40).trimEnd()}…` : s;
};

// A step's pick box while its whole section is picked: on, and fixed.
const LOCKED = { on: true, locked: true, toggle: () => {} };

export default function Camp() {
  const { id } = useParams();
  const location = useLocation();
  // Opened from a quest's camps on Quests, it goes back there.
  const fromQuests = location.state?.from === "quests";
  const { user } = useAuth();
  const userId = user?.id;
  const today = todayStr();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const { data, error, loading, reload, mutate } = useLoad(() => (userId ? fetchCamp(userId, id) : null), [userId, id]);
  const view = useMemo(() => (data ? buildCamp(data.sections, data.steps, today) : null), [data, today]);
  // The steps as they are now, for an Undo that runs after more has changed.
  const stepsNow = useRef(null);
  stepsNow.current = data?.steps ?? null;
  // Moves (drags, Undo) save one after another, in the order they were made.
  const inOrder = useMemo(savesInOrder, []);
  const picks = useMemo(() => todayPicks(view, today), [view, today]);

  const [hideDone, setHideDone] = useState(readHide);
  const [opened, setOpened] = useState({}); // section id -> open, where tapped
  const [openStep, setOpenStep] = useState(null);
  const [openToday, setOpenToday] = useState(null); // a step open in Today
  const [saving, setSaving] = useState(false);
  const pick = usePick(saving);
  const [sheet, setSheet] = useState(null); // a section to edit, or { new: true }
  const [colSheet, setColSheet] = useState(null); // a clipboard column to rename
  const select = useSelect();
  const [pinned, setPinned] = useState(readPin);
  const room = useRoom(PIN_ROOM);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    setOpened({});
    setOpenStep(null);
    setOpenToday(null);
    pick.stop();
    select.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => setNote(data?.camp?.note ?? ""), [data?.camp?.id, data?.camp?.note]);

  function toggleHide() {
    setHideDone((h) => {
      try {
        localStorage.setItem(HIDE_KEY, h ? "0" : "1");
      } catch {
        /* remembering is a nicety */
      }
      return !h;
    });
  }

  const setSteps = (fn) => mutate((d) => d && { ...d, steps: fn(d.steps) });
  // The reload waits for the moves already saving (see inOrder.js).
  const failed = (err, what) => {
    toast.error(err, what);
    inOrder.reload(reload);
  };

  // --- Steps ------------------------------------------------------------------

  function toggleDone(st) {
    const done_on = st.done_on ? null : today;
    // Finishing it means you're no longer working on it.
    const fields = done_on && st.working_since ? { done_on, working_since: null } : { done_on };
    setSteps((list) => list.map((x) => (x.id === st.id ? { ...x, ...fields } : x)));
    if (done_on) {
      // The last step of a section, or of the whole camp, gets a little more.
      const rest = data.steps.filter((x) => x.id !== st.id && !x.done_on);
      if (!rest.length) {
        playClink();
        haptic("win");
        toast.show(`Every step at ${data.camp.title} is done`, { actionLabel: "Plant the flag", onAction: () => navigate("/ascent") });
      } else if (st.section_id && !rest.some((x) => x.section_id === st.section_id)) {
        haptic("success");
      } else haptic("tap");
    }
    updateStep(st.id, fields).catch((err) => failed(err, "Couldn't save that step."));
  }

  function saveStep(st, fields) {
    setSteps((list) => list.map((x) => (x.id === st.id ? { ...x, ...fields } : x)));
    updateStep(st.id, fields).catch((err) => failed(err, "Couldn't save that step."));
  }

  // A sketch's summary, added to the end of its step's notes.
  function addToNote(stepId, text) {
    const st = data?.steps.find((x) => x.id === stepId);
    if (!st) return "gone";
    const { note, status } = appendToNote(st.note, text, 4000);
    if (status !== "full") saveStep(st, { note });
    return status;
  }

  // --- Today ---------------------------------------------------------------------

  // A step or a section (0091) picked for today.
  const onToday = (x) => x.today_on === today;
  // A step in a section picked whole is on today with it: while picking,
  // as picked so far.
  const withSection = (st) =>
    Boolean(st.section_id) && (pick.on ? pick.sel.has(st.section_id) : data.sections.some((s) => s.id === st.section_id && onToday(s)));

  // One step onto today, or off it.
  function setToday(st, on) {
    const fields = { today_on: on ? today : null };
    setSteps((list) => list.map((x) => (x.id === st.id ? { ...x, ...fields } : x)));
    if (!on && openToday === st.id) setOpenToday(null);
    haptic("tap");
    toast.show(on ? "On today" : "Off today");
    updateStep(st.id, fields).catch((err) => failed(err, "Couldn't change that."));
  }

  // Picking starts from what's on today: the sections, and the steps not
  // already on with their section (those come off as steps of their own if
  // it's saved).
  function startPicking() {
    select.stop();
    setOpenStep(null);
    setOpenToday(null);
    const whole = new Set(data.sections.filter(onToday).map((s) => s.id));
    pick.start([...whole, ...data.steps.filter((x) => onToday(x) && !whole.has(x.section_id)).map((x) => x.id)]);
    haptic("tap");
  }

  async function savePicks() {
    const isSection = new Set(data.sections.map((s) => s.id));
    const picked = [...pick.sel];
    const steps = pickDiff(data.steps.filter(onToday).map((x) => x.id), new Set(picked.filter((x) => !isSection.has(x))));
    const secs = pickDiff(data.sections.filter(onToday).map((s) => s.id), new Set(picked.filter((x) => isSection.has(x))));
    if (!steps.add.length && !steps.remove.length && !secs.add.length && !secs.remove.length) {
      pick.stop();
      return;
    }
    setSaving(true);
    try {
      await Promise.all([
        updateSteps(steps.add, { today_on: today }),
        updateSteps(steps.remove, { today_on: null }),
        updateSections(secs.add, { today_on: today }),
        updateSections(secs.remove, { today_on: null }),
      ]);
      const on = new Set([...steps.add, ...secs.add]);
      const off = new Set([...steps.remove, ...secs.remove]);
      const put = (x) => (on.has(x.id) ? { ...x, today_on: today } : off.has(x.id) ? { ...x, today_on: null } : x);
      mutate((d) => d && { ...d, steps: d.steps.map(put), sections: d.sections.map(put) });
      pick.stop();
      haptic("success");
      const k = picked.filter((x) => isSection.has(x)).length;
      const n = picked.length - k;
      toast.show(
        picked.length ? `${[k ? `${k} section${k === 1 ? "" : "s"}` : "", n ? `${n} step${n === 1 ? "" : "s"}` : ""].filter(Boolean).join(" and ")} on today` : "Today is clear"
      );
    } catch (err) {
      toast.error(err, "Couldn't save today's picks.");
      reload();
    } finally {
      setSaving(false);
    }
  }

  // A whole section onto today, or off it, from Today's "Off today".
  function setSectionToday(s, on) {
    const fields = { today_on: on ? today : null };
    mutate((d) => d && { ...d, sections: d.sections.map((x) => (x.id === s.id ? { ...x, ...fields } : x)) });
    updateSection(s.id, fields).catch((err) => failed(err, "Couldn't change that."));
  }

  function sectionOff(s) {
    if (openToday && data.steps.some((x) => x.id === openToday && x.section_id === s.id)) setOpenToday(null);
    haptic("tap");
    setSectionToday(s, false);
    toast.show(`“${short(s.title)}” is off today`, { actionLabel: "Undo", onAction: () => setSectionToday(s, true) });
  }

  // Everything under it goes with it.
  function removeStep(st) {
    setOpenStep(null);
    setOpenToday(null);
    const gone = [...data.steps.filter((x) => x.id === st.id), ...stepsUnder(data.steps, st.id)];
    const ids = new Set(gone.map((x) => x.id));
    setSteps((list) => list.filter((x) => !ids.has(x.id)));
    toast.undoable({
      message: gone.length > 1 ? "Step and its sub-steps removed" : st.parent_id ? "Sub-step removed" : "Step removed",
      run: () => deleteStep(st.id),
      onUndo: () => setSteps((list) => [...list.filter((x) => !ids.has(x.id)), ...gone]),
    });
  }

  // The steps beside this one: its section's top steps, or its step's sub-steps.
  const siblings = (st) =>
    data.steps.filter((x) => (x.section_id ?? null) === (st.section_id ?? null) && (x.parent_id ?? null) === (st.parent_id ?? null));

  // Up or down past the next step you can see, within its section (or its step).
  function moveStep(st, shown, by) {
    const i = shown.findIndex((x) => x.id === st.id);
    const other = shown[i + by];
    if (!other) return;
    const full = siblings(st).sort(byPos);
    const from = full.findIndex((x) => x.id === st.id);
    const to = full.findIndex((x) => x.id === other.id);
    const next = [...full];
    next.splice(from, 1);
    next.splice(to, 0, st);
    const at = new Map(next.map((x, k) => [x.id, k]));
    setSteps((list) => list.map((x) => (at.has(x.id) ? { ...x, position: at.get(x.id) } : x)));
    inOrder(() => reorder("camp_steps", next)).catch((err) => failed(err, "Couldn't move that step."));
  }

  // Into a section (null: the camp's top) as one of its own steps, just
  // before `beforeId` or at the end. Its sub-steps go with it; a sub-step
  // comes out from under its step.
  function moveToSection(st, sectionId, beforeId = null) {
    sectionId = sectionId ?? null;
    const under = stepsUnder(data.steps, st.id).map((x) => x.id);
    const moving = new Set(under);
    const there = siblings({ section_id: sectionId, parent_id: null })
      .filter((x) => x.id !== st.id)
      .sort(byPos);
    const at = beforeId ? there.findIndex((x) => x.id === beforeId) : -1;
    const next = [...there];
    next.splice(at < 0 ? next.length : at, 0, st);
    const pos = new Map(next.map((x, k) => [x.id, k]));
    const same = sectionId === (st.section_id ?? null) && !st.parent_id;
    if (same && next.every((x) => x.position === pos.get(x.id))) return;
    setSteps((list) =>
      list.map((x) =>
        x.id === st.id
          ? { ...x, section_id: sectionId, parent_id: null, position: pos.get(x.id) }
          : moving.has(x.id)
            ? { ...x, section_id: sectionId }
            : pos.has(x.id)
              ? { ...x, position: pos.get(x.id) }
              : x
      )
    );
    const to = sectionId ? data.sections.find((s) => s.id === sectionId) : null;
    if (to) setOpened((o) => ({ ...o, [to.id]: true }));
    haptic("tap");
    if (!same) toast.show(to ? `Moved to ${to.title}` : "Moved to the top");
    requestAnimationFrame(() => document.getElementById(`step-${st.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    inOrder(() => (same ? Promise.resolve() : moveStepToSection(st.id, under, sectionId, pos.get(st.id))).then(() => reorder("camp_steps", next))).catch((err) =>
      failed(err, "Couldn't move that step.")
    );
  }

  // A step carried out of its own list: the section under the finger lights
  // up, and letting go there drops it in, between the steps it landed on.
  // Carrying several (`group`), it lands before the first one not among them.
  function dropTarget(x, y, st, group = null) {
    const el = document
      .elementsFromPoint(x, y)
      .find((e) => !e.closest(`#step-${st.id}`) && e.closest("[data-drop]"))
      ?.closest("[data-drop]");
    if (!el) return null;
    const along = new Set((group ?? []).map((k) => `step-${k}`));
    const below = [...el.querySelectorAll("li.camp-step:not(.camp-step--sub)")].find((li) => {
      if (li.id === `step-${st.id}` || along.has(li.id)) return false;
      const r = li.getBoundingClientRect();
      return y < r.top + r.height / 2;
    });
    return { el, below, sectionId: el.dataset.drop || null, beforeId: below ? below.id.slice(5) : null };
  }

  function dragOut(phase, x, y, st) {
    const g = group(st);
    const hit = phase === "move" || phase === "drop" ? dropTarget(x, y, st, g) : null;
    markDrop(phase === "move" ? hit : null);
    if (phase !== "drop" || !hit) return;
    if (g) moveMany(g, { sectionId: hit.sectionId, beforeId: hit.beforeId }, `Moved ${many(g.length)} to ${where(hit.sectionId)}`);
    else moveToSection(st, hit.sectionId, hit.beforeId);
  }

  // Dropped onto another step (Aaron, 2026-10-27): it goes under that one,
  // after its sub-steps, in that step's section, and its own sub-steps come
  // along. Undo puts it back where it was.
  function nestUnder(st, parentId) {
    const parent = data.steps.find((x) => x.id === parentId);
    const g = st && group(st);
    if (g && parent) {
      moveMany(g, { parentId }, `Moved ${many(g.length)} under “${short(parent.text)}”`);
      return;
    }
    if (!st || !parent || parent.id === st.id || st.parent_id === parent.id) return;
    const under = stepsUnder(data.steps, st.id);
    if (under.some((x) => x.id === parent.id)) return;
    const sectionId = parent.section_id ?? null;
    const was = { parent_id: st.parent_id ?? null, section_id: st.section_id ?? null, position: st.position ?? 0 };
    const now = {
      parent_id: parent.id,
      section_id: sectionId,
      position: data.steps.filter((x) => x.parent_id === parent.id).reduce((m, x) => Math.max(m, (x.position ?? 0) + 1), 0),
    };
    // The steps under it follow it into the new section (and back), the ones
    // under it then: a sub-step added before Undo goes back with it too, and
    // the ones under it when it moved go back even if this page has since
    // turned to another camp. The screen changes at once; the saves go in
    // line, so Undo's land after the move's.
    const put = (fields) => {
      const shown = new Map((stepsNow.current ?? []).map((x) => [x.id, x]));
      const along = [...new Set([...under, ...stepsUnder(stepsNow.current, st.id)].map((x) => x.id))].filter(
        (k) => !shown.has(k) || (shown.get(k).section_id ?? null) !== fields.section_id
      );
      const ids = new Set(along);
      setSteps((list) => list.map((x) => (x.id === st.id ? { ...x, ...fields } : ids.has(x.id) ? { ...x, section_id: fields.section_id } : x)));
      if (fields.section_id) setOpened((o) => ({ ...o, [fields.section_id]: true }));
      requestAnimationFrame(() => document.getElementById(`step-${st.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
      return () => Promise.all([updateStep(st.id, fields), along.length ? updateSteps(along, { section_id: fields.section_id }) : null]);
    };
    const undo = undoableSave(inOrder, put(now), (err) => failed(err, "Couldn't move that step."));
    toast.show(`Moved under “${short(parent.text)}”`, { actionLabel: "Undo", onAction: () => undo(put(was), (err) => failed(err, "Couldn't move that step back.")) });
  }

  // --- Many at once (0095) ------------------------------------------------------

  // The ones selected, in the order they sit on the page.
  const chosen = () => (data ? inPageOrder(select.sel, data.steps, data.sections, [data.camp]) : []);
  // Carrying one that's selected carries every one selected.
  const group = (st) => (select.on && select.sel.has(st.id) && select.sel.size > 1 ? chosen() : null);
  const many = (n) => `${n} step${n === 1 ? "" : "s"}`;
  const where = (sectionId) => {
    const s = sectionId ? data.sections.find((x) => x.id === sectionId) : null;
    return s ? (s.clipboard ? `the clipboard's ${s.title}` : s.title) : "the top";
  };

  // Steps moved together (lib/stepMoves.js): on screen at once, saved in
  // one go, and all put back by Undo.
  function moveMany(ids, to, label) {
    const plan = planMove(stepsNow.current ?? [], ids, { campId: id, ...to });
    if (!plan || !plan.rows.length) return false;
    setSteps((list) => applyRows(list, plan.rows));
    if (plan.sectionId) setOpened((o) => ({ ...o, [plan.sectionId]: true }));
    haptic("tap");
    const undo = undoableSave(inOrder, () => placeSteps(plan.rows), (err) => failed(err, "Couldn't move those."));
    toast.show(label, {
      actionLabel: "Undo",
      onAction: () => {
        setSteps((list) => applyRows(list, plan.was));
        undo(() => placeSteps(plan.was), (err) => failed(err, "Couldn't move those back."));
      },
    });
    return true;
  }

  function startSelecting() {
    pick.stop();
    setOpenStep(null);
    setOpenToday(null);
    select.start();
    haptic("tap");
  }

  function moveSelected(key) {
    const ids = chosen();
    if (!moveMany(ids, { sectionId: key || null }, `Moved ${many(ids.length)} to ${where(key || null)}`)) toast.show(ids.length === 1 ? "It's there already." : "They're there already.");
  }

  // A new section, with the ones selected moved into it.
  async function newSectionFor({ title }) {
    const ids = chosen();
    try {
      const position = data.sections.reduce((m, s) => Math.max(m, s.position + 1), 0);
      const row = await addSection(userId, id, { title, position });
      mutate((d) => d && { ...d, sections: [...d.sections, row] });
      setOpened((o) => ({ ...o, [row.id]: true }));
      if (ids.length) moveMany(ids, { sectionId: row.id }, `Moved ${many(ids.length)} to ${title}`);
      requestAnimationFrame(() => document.getElementById(`sec-${row.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return true;
    } catch (err) {
      toast.error(err, "Couldn't make that section.");
      return false;
    }
  }

  // All of them notes, or (when they're all notes already) tasks again.
  function kindSelected() {
    const ids = new Set(chosen());
    const rows = data.steps.filter((x) => ids.has(x.id));
    if (!rows.length) return;
    const toTasks = rows.every((x) => x.kind === "note");
    const fields = toTasks ? { kind: "task" } : { kind: "note", done_on: null, urgency: null, working_since: null };
    setSteps((list) => list.map((x) => (ids.has(x.id) ? { ...x, ...fields } : x)));
    haptic("tap");
    toast.show(toTasks ? `${rows.length === 1 ? "It's a task" : `${rows.length} are tasks`} again` : rows.length === 1 ? "Made a note" : `${rows.length} made notes`);
    updateSteps([...ids], fields).catch((err) => failed(err, "Couldn't change those."));
  }

  // --- The clipboard (0095) ----------------------------------------------------

  async function newColumn({ title }) {
    try {
      const position = data.sections.reduce((m, s) => Math.max(m, s.position + 1), 0);
      const row = await addSection(userId, id, { title, position, clipboard: true });
      mutate((d) => d && { ...d, sections: [...d.sections, row] });
      haptic("tap");
      return true;
    } catch (err) {
      toast.error(err, "Couldn't make that column.");
      return false;
    }
  }

  function renameColumn(s, title) {
    mutate((d) => d && { ...d, sections: d.sections.map((x) => (x.id === s.id ? { ...x, title } : x)) });
    updateSection(s.id, { title }).catch((err) => failed(err, "Couldn't rename that column."));
  }

  function togglePin() {
    setPinned((p) => {
      try {
        localStorage.setItem(PIN_KEY, p ? "0" : "1");
      } catch {
        /* remembering is a nicety */
      }
      return !p;
    });
    haptic("tap");
  }

  // New steps at the end of a section, or (with `parent`) sub-steps under a step.
  // Dragged into a new order: `shown` is the list as it stood on screen and
  // `ids` its new order. Done steps hidden from it keep their places.
  function reorderSteps(shown, ids, draggedId) {
    if (!shown.length) return;
    // carrying several: they all land where the one carried was let go
    const dragged = shown.find((x) => x.id === draggedId);
    const g = dragged && group(dragged);
    if (g) {
      const along = new Set(g);
      const beforeId = ids.slice(ids.indexOf(draggedId) + 1).find((k) => !along.has(k)) ?? null;
      moveMany(g, { sectionId: dragged.section_id ?? null, parentId: dragged.parent_id ?? null, beforeId }, `Moved ${many(g.length)} together`);
      return;
    }
    const full = siblings(shown[0]).sort(byPos);
    const byId = new Map(full.map((x) => [x.id, x]));
    const onScreen = new Set(ids);
    const queue = [...ids];
    const next = full.map((x) => (onScreen.has(x.id) ? byId.get(queue.shift()) : x)).filter(Boolean);
    const at = new Map(next.map((x, k) => [x.id, k]));
    setSteps((list) => list.map((x) => (at.has(x.id) ? { ...x, position: at.get(x.id) } : x)));
    inOrder(() => reorder("camp_steps", next)).catch((err) => failed(err, "Couldn't move that step."));
  }

  async function addTo(sectionId, texts, parent = null) {
    const same = siblings({ section_id: sectionId, parent_id: parent?.id ?? null });
    const start = same.reduce((m, x) => Math.max(m, (x.position ?? 0) + 1), 0);
    try {
      const rows = await addSteps(userId, id, sectionId, texts, start, parent?.id ?? null);
      setSteps((list) => [...list, ...rows]);
      haptic("tap");
      return true;
    } catch (err) {
      toast.error(err, texts.length > 1 ? `Couldn't add those ${parent ? "sub-steps" : "steps"}.` : `Couldn't add that ${parent ? "sub-step" : "step"}.`);
      return false;
    }
  }

  const addSubs = (st, texts) => addTo(st.section_id ?? null, texts, st);

  // Where a step can go: any section, or the camp's top above them.
  const sectionChoices = data?.sections?.length
    ? [
        { id: null, title: "No section (top of the camp)" },
        ...[...data.sections].sort((a, b) => Number(a.clipboard) - Number(b.clipboard) || byPos(a, b)).map((s) => ({ id: s.id, title: s.clipboard ? `Clipboard · ${s.title}` : s.title })),
      ]
    : null;

  const stepProps = (st, shown) => ({
    onOpen: () => {
      setOpenToday(null);
      setOpenStep((o) => (o === st.id ? null : st.id));
    },
    onDone: () => toggleDone(st),
    onSave: (fields) => saveStep(st, fields),
    onMove: (by) => moveStep(st, shown, by),
    onRemove: () => removeStep(st),
    isToday: onToday(st) && !withSection(st),
    onToday: withSection(st) ? undefined : () => setToday(st, !onToday(st)),
    pick: pick.on && withSection(st) ? LOCKED : pick.of(st.id),
    select: select.of(st.id),
    onKind: () => saveStep(st, kindFields(st)),
    sections: sectionChoices,
    onMoveTo: (sectionId) => moveToSection(st, sectionId),
  });

  // The same steps again in Today: they tick, take notes and sub-steps and
  // come off today there (one in a section on today comes off with it), but
  // move and go only where they sit.
  const todayProps = (st) => ({
    onOpen: () => {
      setOpenStep(null);
      setOpenToday((o) => (o === st.id ? null : st.id));
    },
    onDone: () => toggleDone(st),
    onSave: (fields) => saveStep(st, fields),
    isToday: onToday(st),
    onToday: withSection(st) ? undefined : () => setToday(st, !onToday(st)),
  });

  // --- Sections and the camp's notes ---------------------------------------------

  async function saveSection(values) {
    try {
      if (sheet?.new) {
        const position = data.sections.reduce((m, s) => Math.max(m, s.position + 1), 0);
        const row = await addSection(userId, id, { title: values.title, why: values.why, color: values.color, position });
        if (values.note) await updateSection(row.id, { note: values.note });
        mutate((d) => d && { ...d, sections: [...d.sections, { ...row, note: values.note }] });
        setOpened((o) => ({ ...o, [row.id]: true }));
      } else {
        await updateSection(sheet.id, values);
        mutate((d) => d && { ...d, sections: d.sections.map((s) => (s.id === sheet.id ? { ...s, ...values } : s)) });
      }
      setSheet(null);
    } catch (err) {
      toast.error(err, "Couldn't save that section.");
    }
  }

  // Sections dragged into a new order.
  function reorderSections(ids) {
    const byId = new Map(data.sections.map((x) => [x.id, x]));
    const next = ids.map((x) => byId.get(x)).filter(Boolean);
    const at = new Map(next.map((x, k) => [x.id, k]));
    mutate((d) => d && { ...d, sections: d.sections.map((x) => (at.has(x.id) ? { ...x, position: at.get(x.id) } : x)) });
    reorder("camp_sections", next).catch((err) => failed(err, "Couldn't move that section."));
  }
  const sectionSort = useDragSort(
    (view?.sections ?? []).map((x) => x.id),
    (ids) => reorderSections(ids)
  );

  async function removeSection(s) {
    const n = data.steps.filter((x) => x.section_id === s.id).length;
    const ok = await confirm({
      title: `Remove “${s.title}”?`,
      body: n ? `Its ${n === 1 ? "step goes" : `${n} steps go`} with it. This can't be undone.` : "It has no steps yet.",
      confirmLabel: "Remove section",
    });
    if (!ok) return;
    setSheet(null);
    try {
      await deleteSection(s.id);
      mutate((d) => d && { ...d, sections: d.sections.filter((x) => x.id !== s.id), steps: d.steps.filter((x) => x.section_id !== s.id) });
    } catch (err) {
      failed(err, "Couldn't remove that section.");
    }
  }

  async function saveNote() {
    const value = note.trim() || null;
    if (value === (data.camp.note ?? null)) return;
    try {
      await updateCamp(id, { note: value });
      mutate((d) => d && { ...d, camp: { ...d.camp, note: value } });
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 1800);
    } catch (err) {
      toast.error(err, "Couldn't save your notes.");
    }
  }

  // ---------------------------------------------------------------------------------

  if (!data) {
    return (
      <div className="page ascent camp">
        <header className="ascent-head">
          <Link to="/ascent" className="btn-link camp-back">
            <ChevronLeft size={14} />
            The Range
          </Link>
        </header>
        {error && <LoadError what="this camp" error={error} onRetry={reload} />}
        {!error && loading && <p className="empty">Loading…</p>}
        {!error && !loading && <p className="empty">This camp isn't on any of your mountains anymore.</p>}
      </div>
    );
  }

  const camps = [...data.camps].sort(byPos);
  const index = camps.findIndex((c) => c.id === id);
  const mountain = data.lesson ? `Lesson · ${data.lesson.title}` : data.quest ? `Quest · ${data.quest.title}` : "Camp";
  const next = view.next;
  const nextSection = next?.section_id ? view.sections.find((s) => s.id === next.section_id) : null;
  const pct = view.total ? Math.round((view.done / view.total) * 100) : 0;
  const isOpen = (s) => opened[s.id] ?? !s.complete;
  const looseShown = hideDone ? view.loose.filter((st) => !st.done_on) : view.loose;
  const empty = view.total === 0 && view.sections.length === 0;
  // The clipboard down the right, on a screen with room for it.
  const pinNow = pinned && room;
  const picked = select.on ? chosen() : [];
  const carry = select.on ? select.carry : undefined;
  const places = [
    { key: "", label: "The top of the camp (no section)", group: null },
    ...view.sections.map((s) => ({ key: s.id, label: `${s.number}. ${s.title}`, group: "Sections" })),
    ...view.clips.map((s) => ({ key: s.id, label: s.title, group: "Clipboard" })),
  ];
  const selectBtn = !empty || view.clips.length ? <SelectButton on={select.on} onStart={startSelecting} onStop={select.stop} /> : null;
  const clipboard = (stack) => (
    <Clipboard
      cols={view.clips.map((section) => ({ section, camp: data.camp }))}
      layout={stack ? "stack" : "row"}
      camps={[data.camp]}
      openStep={openStep}
      step={stepProps}
      hideDone={hideDone}
      onAdd={(sec, texts) => addTo(sec.id, texts)}
      onAddSubs={addSubs}
      onReorder={reorderSteps}
      onDragOut={dragOut}
      onInto={nestUnder}
      carry={carry}
      onNewColumn={newColumn}
      onEditColumn={(sec) => setColSheet(sec)}
      tools={stack ? selectBtn : null}
      pinned={stack}
      onPin={room ? togglePin : undefined}
      picking={pick.on}
    />
  );
  // Pinned beside them, a step carried sideways out of a section leaves it.
  const cross = pinNow ? {} : undefined;

  function goToNext() {
    if (!next) return;
    if (nextSection) setOpened((o) => ({ ...o, [nextSection.id]: true }));
    setOpenToday(null);
    setOpenStep(next.id);
    requestAnimationFrame(() => document.getElementById(`step-${next.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  return (
    <div className={"page ascent camp" + (pinNow ? " camp--pinned" : "")}>
      <SketchProvider kind="step" userId={userId} scopeId={id} about={(sid) => data.steps.find((x) => x.id === sid)?.text} onAddToNote={addToNote}>
      <div className="camp-left">
      <header className="ascent-head camp-head">
        <Link to={fromQuests ? `/quests/${data.camp.quest_id}` : "/ascent"} className="btn-link camp-back">
          <ChevronLeft size={14} />
          {fromQuests ? "Quests" : "The Range"}
        </Link>
        <div className="eyebrow">{mountain}</div>
        <h1 className="page-title">{data.camp.title}</h1>
        <span className="ascent-mini">
          Camp {index + 1} of {camps.length}
          {data.camp.reached_on ? ` · reached ${fmtShortDate(data.camp.reached_on)}` : ""}
        </span>
      </header>

      {camps.length > 1 && (
        <nav className="camp-tabs" aria-label="Camps on this mountain">
          {camps.map((c, i) => (
            <Link key={c.id} to={`/ascent/camp/${c.id}`} state={location.state} className="camp-tab" aria-current={c.id === id ? "page" : undefined} replace>
              {c.reached_on ? <Flag size={12} aria-hidden="true" /> : <span className="camp-tab__n">{i + 1}</span>}
              {c.title}
            </Link>
          ))}
        </nav>
      )}

      {error && <LoadError what="this camp" error={error} onRetry={reload} stale />}

      <div className="camp-grid">
        <section className="card camp-now" aria-labelledby="camp-now-h">
          <h2 className="eyebrow" id="camp-now-h">
            Where it stands
          </h2>
          <div className="camp-now__count">
            <b>{view.total ? `${view.done} of ${view.total}` : "0"}</b>
            <span>{view.total ? "steps done" : "steps yet"}</span>
          </div>
          <div className="camp-bar camp-bar--big" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </div>
          {next ? (
            <div className="camp-next">
              <span className="ascent-mini">
                {next?.working_since ? "Working on it" : "Next step"}{nextSection ? ` · ${nextSection.number}. ${nextSection.title}` : ""}
              </span>
              <button type="button" className="camp-next__text" onClick={goToNext}>
                <Rich text={next.text} />
              </button>
              <div className="camp-next__acts">
                <button type="button" className="btn btn--sm btn--accent" onClick={() => toggleDone(next)}>
                  <Check size={14} />
                  Done
                </button>
                <button type="button" className="btn btn--sm" onClick={goToNext}>
                  Open it
                </button>
              </div>
            </div>
          ) : view.total ? (
            <p className="camp-now__all">
              Every step here is done.{" "}
              {!data.camp.reached_on && (
                <Link to="/ascent" className="btn-link btn-link--accent">
                  Plant the flag on the Range
                </Link>
              )}
            </p>
          ) : null}
        </section>

          <div className={"camp-main" + (pick.on || select.on ? " picking" : "")}>
            {!empty && (
              <section className="card today-card camp-today" aria-labelledby="camp-today-h">
                <TodayHead id="camp-today-h" done={picks.done} total={picks.total} picking={pick.on} onPick={startPicking} />
                {pick.on ? (
                  <p className="today-hint">Tap the steps below to pick them for today, or a section's box for all of it. Tap one again to take it off.</p>
                ) : picks.blocks.length ? (
                  <TodayBlocks blocks={picks.blocks} openStep={openToday} step={todayProps} onAddSubs={addSubs} idPrefix="today-step" onSectionOff={sectionOff} />
                ) : (
                  <p className="today-hint">
                    Pick the steps you'll do today, or whole sections. They stay where they are and show up here too, so a tick or a note in either place is the same.
                  </p>
                )}
              </section>
            )}

            {!pinNow && clipboard(false)}

            <div className="ascent-row camp-main__head">
              <h2 className="eyebrow">Steps</h2>
              <span className="spacer" />
              {view.done > 0 && (
                <button type="button" className="btn-link" aria-pressed={hideDone} onClick={toggleHide}>
                  {hideDone ? "Show done steps" : "Hide done steps"}
                </button>
              )}
              {!pick.on && selectBtn}
            </div>

            {empty && (
              <section className="card camp-empty">
                <p>No steps here yet. Type them in one at a time, paste a whole list, or bring in a plan and it fills in the sections and steps for you.</p>
                <Link to={`/ascent/plans?camp=${id}`} className="btn btn--sm btn--accent">
                  <BookOpen size={14} />
                  Bring in a plan
                </Link>
              </section>
            )}

            {(view.loose.length > 0 || empty) && (
              <section className="card camp-sec open camp-loose" aria-label="Steps" data-drop="">
                {looseShown.length > 0 && (
                  <StepList list={looseShown} openStep={openStep} hideDone={hideDone} step={stepProps} onAddSubs={addSubs} onReorder={reorderSteps} onDragOut={dragOut} onInto={nestUnder} carry={carry} cross={cross} />
                )}
                {view.loose.length > looseShown.length && <p className="ascent-mini camp-hidden">{view.loose.length - looseShown.length} done, hidden</p>}
                <AddStep hidden={pick.on} onAdd={(texts) => addTo(null, texts)} />
              </section>
            )}

            {view.sections.map((s) => (
              <SectionCard
                key={s.id}
                section={s}
                open={pick.on || isOpen(s)}
                picking={pick.on}
                pick={pick.on ? pick.of(s.id, data.steps.filter((x) => x.section_id === s.id).map((x) => x.id)) : null}
                isToday={onToday(s)}
                hideDone={hideDone}
                openStep={openStep}
                onToggle={pick.on ? undefined : () => setOpened((o) => ({ ...o, [s.id]: !isOpen(s) }))}
                onEdit={() => setSheet(s)}
                onAdd={addTo}
                onAddSubs={addSubs}
                onReorder={reorderSteps}
                onDragOut={dragOut}
                onInto={nestUnder}
                carry={carry}
                cross={cross}
                step={stepProps}
                sort={
                  view.sections.length > 1 && !pick.on
                    ? { ref: sectionSort.ref(s.id), style: sectionSort.style(s.id), handle: sectionSort.handle(s.id), lifted: sectionSort.dragging === s.id }
                    : null
                }
              />
            ))}

            {pick.on && <PickBar count={pick.sel.size} busy={saving} onCancel={pick.stop} onDone={savePicks} />}
            {select.on && (
              <SelectBar
                count={picked.length}
                places={places}
                notes={picked.length > 0 && picked.every((k) => data.steps.find((x) => x.id === k)?.kind === "note")}
                onMove={moveSelected}
                onNewSection={newSectionFor}
                onKind={kindSelected}
                onClear={() => select.start()}
                onDone={select.stop}
              />
            )}

            <div className="camp-more">
              <button type="button" className="btn btn--sm btn--on-page" onClick={() => setSheet({ new: true })}>
                <Plus size={14} />
                Add a section
              </button>
              {!empty && (
                <Link to={`/ascent/plans?camp=${id}`} className="btn btn--sm btn--on-page">
                  <BookOpen size={14} />
                  Bring in a plan
                </Link>
              )}
            </div>
          </div>

        <aside className="camp-side">
          <section className="card camp-notes" aria-labelledby="camp-notes-h">
            <div className="ascent-row">
              <h2 className="eyebrow" id="camp-notes-h">
                Notes on {data.camp.title}
              </h2>
              {noteSaved && <span className="ascent-mini camp-saved">Saved</span>}
            </div>
            <textarea
              className="textarea"
              rows={5}
              value={note}
              maxLength={4000}
              placeholder="Decisions, open questions, links, what's next…"
              onChange={(e) => setNote(e.target.value)}
              onBlur={saveNote}
            />
          </section>

          {data.plans.map((p) => (
            <details key={p.id} className="card camp-ref">
              <summary>
                <span>
                  <span className="eyebrow">From the plan</span>
                  <b>{p.title}</b>
                </span>
                <span className="ascent-mini">{p.notes ? "Its notes" : ""}</span>
              </summary>
              {p.notes ? <PlanNotes text={p.notes} /> : <p className="ascent-mini">This plan has no notes beyond its steps.</p>}
              <Link to={`/ascent/plans/${p.id}`} className="btn-link">
                Open the plan
              </Link>
            </details>
          ))}
        </aside>
      </div>
      </div>

      {pinNow && (
        <aside className="camp-clipside" aria-label="Clipboard">
          {clipboard(true)}
        </aside>
      )}
      </SketchProvider>

      {sheet && <SectionSheet section={sheet.new ? null : sheet} onSave={saveSection} onDelete={() => removeSection(sheet)} onClose={() => setSheet(null)} />}
      {colSheet && (
        <ColumnSheet
          section={colSheet}
          onRename={(title) => renameColumn(colSheet, title)}
          onRemove={() => {
            const s = colSheet;
            setColSheet(null);
            removeSection(s);
          }}
          onClose={() => setColSheet(null)}
        />
      )}
    </div>
  );
}

function SectionSheet({ section, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(section?.title ?? "");
  const [why, setWhy] = useState(section?.why ?? "");
  const [note, setNote] = useState(section?.note ?? "");
  const [color, setColor] = useState(section?.color ?? null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  return (
    <Sheet title={section ? "Section" : "New section"} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) {
            setProblem("Give it a name.");
            return;
          }
          setBusy(true);
          await onSave({ title: title.trim(), why: why.trim() || null, note: note.trim() || null, color });
          setBusy(false);
        }}
      >
        <label className="field">
          <span>Name</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Market research" autoFocus={!section} />
        </label>
        <label className="field">
          <span>Why it matters</span>
          <textarea className="textarea" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} maxLength={1000} />
        </label>
        <label className="field">
          <span>Note</span>
          <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} placeholder="Who to check in with, a rule to keep…" />
        </label>
        <ColorPick value={color} onChange={setColor} />
        {problem && <p className="form-error">{problem}</p>}
        <div className="ascent-sheet__actions">
          {section && (
            <button type="button" className="btn-link btn-link--danger" onClick={onDelete} disabled={busy}>
              Remove section
            </button>
          )}
          <span className="spacer" />
          <button type="submit" className="btn btn--accent" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
