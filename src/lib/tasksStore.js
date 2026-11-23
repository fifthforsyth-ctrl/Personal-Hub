import { useSyncExternalStore } from "react";
import { addSection, addSteps, deleteStep, fetchCampColumns, fetchClipboardAll, fetchColumns, placeSteps, updateSection, updateStep } from "./api";
import { applyRows, planMove } from "./stepMoves";

// What the Tasks tab and the pull-down clipboard share (Aaron, 2026-11-23):
// the sections and steps of the camp open on Tasks, and every clipboard
// column with what's in it. One store, so a thought dragged from the
// clipboard onto a column leaves the one and lands on the other at once,
// wherever each is drawn.
//
// Rows are kept by id; a reload of a camp or of the clipboard replaces
// just what it covers.

let sections = new Map();
let steps = new Map();
let clipReady = false;
let loadedCamps = new Set();
let snapshot = { sections: [], steps: [], clipReady: false, loadedCamps };
const listeners = new Set();

function emit() {
  snapshot = { sections: [...sections.values()], steps: [...steps.values()], clipReady, loadedCamps };
  for (const l of listeners) l();
}

export function useTasksStore() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot
  );
}

export function getSteps() {
  return snapshot.steps;
}

export const BYPOS = (a, b) =>
  (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) || String(a.id).localeCompare(String(b.id));

// The camp a new thought on the clipboard goes into: the one last open on
// Tasks (remembered on this device).
const HOME_KEY = "hub:tasks-camp";
export function homeCamp() {
  try {
    return localStorage.getItem(HOME_KEY);
  } catch {
    return null;
  }
}
export function setHomeCamp(id) {
  try {
    if (id) localStorage.setItem(HOME_KEY, id);
  } catch {
    /* private window */
  }
}

export async function loadClipboard(userId) {
  const data = await fetchClipboardAll(userId);
  const clipIds = new Set([...sections.values()].filter((s) => s.clipboard).map((s) => s.id));
  for (const id of clipIds) sections.delete(id);
  for (const st of [...steps.values()]) if (clipIds.has(st.section_id)) steps.delete(st.id);
  for (const s of data.sections) sections.set(s.id, s);
  for (const st of data.steps) steps.set(st.id, st);
  clipReady = true;
  emit();
}

export async function loadCamp(userId, campId) {
  const data = await fetchCampColumns(userId, campId);
  for (const s of [...sections.values()]) if (s.camp_id === campId) sections.delete(s.id);
  for (const st of [...steps.values()]) if (st.camp_id === campId) steps.delete(st.id);
  for (const s of data.sections) sections.set(s.id, s);
  for (const st of data.steps) steps.set(st.id, st);
  loadedCamps = new Set(loadedCamps).add(campId);
  emit();
}

// Some columns (the Tasks home's recent ones), wherever they are.
export async function loadColumns(userId, sectionIds) {
  const data = await fetchColumns(userId, sectionIds);
  const ids = new Set(sectionIds);
  for (const id of ids) sections.delete(id);
  for (const st of [...steps.values()]) if (ids.has(st.section_id)) steps.delete(st.id);
  for (const s of data.sections) sections.set(s.id, s);
  for (const st of data.steps) steps.set(st.id, st);
  emit();
}

function put(rows) {
  for (const r of rows) steps.set(r.id, r);
  emit();
}

// Save moved rows. Across camps a sub-step can only follow its parent once
// the parent is there (the camp_steps policy checks it), so then they go
// level by level, top steps first.
async function saveRows(rows) {
  if (!rows.length) return;
  const ids = new Set(rows.map((r) => r.id));
  const crosses = rows.some((r) => "camp_id" in r);
  if (!crosses) return placeSteps(rows);
  const depth = (id) => {
    let d = 0;
    let st = steps.get(id);
    const seen = new Set();
    while (st?.parent_id && ids.has(st.parent_id) && !seen.has(st.parent_id)) {
      seen.add(st.parent_id);
      d++;
      st = steps.get(st.parent_id);
    }
    return d;
  };
  const levels = new Map();
  for (const r of rows) {
    const d = depth(r.id);
    levels.set(d, [...(levels.get(d) ?? []), r]);
  }
  for (const d of [...levels.keys()].sort((a, b) => a - b)) await placeSteps(levels.get(d));
}

// Move steps (with whatever is under them) to { campId, sectionId,
// beforeId }. Shown at once; resolves to an undo function, or null when
// nothing moved. Throws (after putting it back) when the save fails.
export async function moveSteps(ids, to) {
  const plan = planMove(snapshot.steps, ids, to);
  if (!plan || !plan.rows.length) return null;
  const before = snapshot.steps;
  put(applyRows(before, plan.rows).filter((x) => plan.rows.some((r) => r.id === x.id)));
  try {
    await saveRows(plan.rows);
  } catch (err) {
    put(applyRows(snapshot.steps, plan.was).filter((x) => plan.was.some((r) => r.id === x.id)));
    throw err;
  }
  return async () => {
    put(applyRows(snapshot.steps, plan.was).filter((x) => plan.was.some((r) => r.id === x.id)));
    await saveRows(plan.was);
  };
}

export async function addTo(userId, campId, sectionId, texts) {
  const there = snapshot.steps.filter((s) => s.camp_id === campId && (s.section_id ?? null) === (sectionId ?? null) && !s.parent_id);
  const start = there.reduce((m, s) => Math.max(m, (s.position ?? 0) + 1), 0);
  const rows = await addSteps(userId, campId, sectionId, texts, start);
  put(rows);
  return rows;
}

// Onto the clipboard: the first clipboard column of `campId` (made when it
// has none).
export async function clipSectionOf(userId, campId) {
  let sec = snapshot.sections.filter((s) => s.clipboard && s.camp_id === campId).sort(BYPOS)[0];
  if (!sec) {
    sec = await addSection(userId, campId, { title: "Clipboard", position: 9999, clipboard: true });
    sections.set(sec.id, sec);
    emit();
  }
  return sec;
}

export async function addToClipboard(userId, campId, texts) {
  const sec = await clipSectionOf(userId, campId);
  return addTo(userId, campId, sec.id, texts);
}

export async function editStep(id, fields) {
  const was = steps.get(id);
  if (!was) return;
  put([{ ...was, ...fields }]);
  try {
    await updateStep(id, fields);
  } catch (err) {
    put([was]);
    throw err;
  }
}

// A step and what's under it, gone; resolves to the rows, to put back.
export function takeOut(id) {
  const out = [];
  const walk = (pid) => {
    for (const st of snapshot.steps) if (st.parent_id === pid) {
      out.push(st);
      walk(st.id);
    }
  };
  const top = steps.get(id);
  if (!top) return [];
  out.push(top);
  walk(id);
  for (const st of out) steps.delete(st.id);
  emit();
  return out;
}
export function putBack(rows) {
  put(rows);
}
export { deleteStep };

export function setSection(sec) {
  sections.set(sec.id, sec);
  emit();
}
export function dropSection(id) {
  sections.delete(id);
  for (const st of [...steps.values()]) if (st.section_id === id) steps.delete(st.id);
  emit();
}
export async function renameSection(id, title) {
  const was = sections.get(id);
  if (!was) return;
  setSection({ ...was, title });
  try {
    await updateSection(id, { title });
  } catch (err) {
    setSection(was);
    throw err;
  }
}
