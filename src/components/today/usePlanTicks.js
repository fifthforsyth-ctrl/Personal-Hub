import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTasks, fetchTodayQuestWork, toggleTask, updateTask, updateQuestTask, updateStep } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { doneFields, applyOverrides } from "../../lib/todayPlan";
import { haptic } from "../../lib/haptics";
import { useToast } from "../ui/Feedback";
import { announceChange } from "./announce";

// Ticking off the day's things: the planned tasks and what you picked for
// the day on Quests. Today's plan (PlanBlocks) and the evening's "What got
// done" (EveningTasks) both tick through this, so a tick behaves the same in
// both places.
//
// It loads the day's tasks and quest work itself and reloads when something
// changes elsewhere (hub:changed) or the phone comes back to the app. A tick
// saves straight away and shows before it's saved, and it holds until a load
// that began after the save has read it back (applyOverrides in
// src/lib/todayPlan.js), so a reload already on its way can't clear the box
// under your thumb. A tick that doesn't save goes back to what showed before
// it, with a toast. Once the ticks settle, the rest of the page is told once
// (announceChange), so ticking off three things in a row reloads it once;
// leaving says it straight away.
//
//   const { data, error, reload, overrides, toggle, setReason, settle } = usePlanTicks(userId, date);
//
//   data       { tasks, work, startedAt } as loaded
//   overrides  the ticks still held; lay them over `data` with applyOverrides
//   toggle     (item) => tick it, or untick it. One save at a time for each
//              row, so a double tap can't race itself
//   setReason  (taskId, reason) => why a planned task was left undone
//   settle     () => a promise that's done once every save in flight is
//
// `clearReason` (the evening) clears a task's left_reason when it's ticked
// done: a task you did wasn't left undone, so its old reason can't follow
// it into the record or come back as a chip.
export function usePlanTicks(userId, date, { clearReason = false } = {}) {
  const toast = useToast();
  const { data, error, reload } = useLoad(() => (userId ? loadWork(userId, date) : null), [userId, date]);

  // Something changed elsewhere (the capture sheet, the day page, this card
  // a moment ago), or the phone came back to the app.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && reload();
    window.addEventListener("hub:changed", reload);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("hub:changed", reload);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  // Tell the rest of the page once the ticks settle. `owed` is a save that
  // landed and hasn't been told yet. Leaving says it straight away.
  const tellTimer = useRef(null);
  const owed = useRef(false);
  const tellSoon = useCallback(() => {
    clearTimeout(tellTimer.current);
    tellTimer.current = setTimeout(() => {
      tellTimer.current = null;
      owed.current = false;
      announceChange();
    }, 1200);
  }, []);
  useEffect(
    () => () => {
      if (!owed.current) return;
      clearTimeout(tellTimer.current);
      tellTimer.current = null;
      owed.current = false;
      announceChange();
    },
    []
  );

  // Your ticks, held over what's loaded until a load that began after the
  // save has read them back. Kept in a ref too, so a save that lands reads
  // the latest of them.
  const [overrides, setOverrides] = useState(() => new Map());
  const overridesNow = useRef(overrides);
  const changeOverrides = useCallback((change) => {
    const next = new Map(overridesNow.current);
    change(next);
    overridesNow.current = next;
    setOverrides(next);
  }, []);

  // Once a load has read a tick back, let it go.
  useEffect(() => {
    const { keep } = applyOverrides(data, overridesNow.current);
    if (keep.size === overridesNow.current.size) return;
    overridesNow.current = keep;
    setOverrides(keep);
  }, [data]);

  // Each row's saves in the order you made them: a reason picked while the
  // row's tick is still on its way goes out after it, never alongside it.
  // With nothing ahead of it a save goes out at once.
  const chains = useRef(new Map());
  const queue = useCallback((key, run) => {
    const ahead = chains.current.get(key);
    const next = ahead ? ahead.catch(() => {}).then(run) : run();
    chains.current.set(key, next);
    const done = () => {
      if (chains.current.get(key) === next) chains.current.delete(key);
    };
    next.then(done, done);
    return next;
  }, []);

  // One save, start to finish: shown at once, written, held until it's read
  // back, or put back the way it was with a toast if it didn't go through.
  const saving = useRef(new Set());
  const busy = useRef(0);
  const write = useCallback(
    async (key, tick, run, fallback) => {
      // An earlier save's "tell the page" waits for this one, so its reload
      // can't go out while this save is still on its way.
      clearTimeout(tellTimer.current);
      tellTimer.current = null;
      const before = overridesNow.current.get(key);
      changeOverrides((m) => m.set(key, tick));
      busy.current += 1;
      try {
        await queue(key, run);
        const savedAt = clock();
        changeOverrides((m) => {
          if (m.get(key) === tick) m.set(key, { ...tick, savedAt });
        });
        owed.current = true;
      } catch (err) {
        // Back to what showed before this save: the last one that saved, if
        // there was one, or what's loaded.
        changeOverrides((m) => {
          if (m.get(key) !== tick) return;
          if (before) m.set(key, before);
          else m.delete(key);
        });
        toast.error(err, fallback);
        reload();
      } finally {
        busy.current -= 1;
        if (owed.current && busy.current === 0 && saving.current.size === 0) tellSoon();
      }
    },
    [changeOverrides, queue, reload, tellSoon, toast]
  );

  const toggle = useCallback(
    async (item) => {
      if (item.heading) return; // a note's words, nothing to tick
      const key = `${item.kind}:${item.id}`;
      if (saving.current.has(key)) return;
      saving.current.add(key);
      const done = !item.done;
      const fields = doneFields(item.kind, done, date, new Date().toISOString());
      haptic(done ? "success" : "tap");
      try {
        if (clearReason && item.kind === "task") {
          // What goes out: the tick, and on a done one no reason. What shows
          // keeps whatever else is still held for the row.
          const sent = done ? { ...fields, left_reason: null } : fields;
          const held = overridesNow.current.get(key)?.fields ?? {};
          const tick = { kind: item.kind, id: item.id, fields: { ...held, ...sent }, savedAt: null };
          await write(key, tick, () => updateTask(item.id, sent), "Couldn't save that.");
        } else {
          const tick = { kind: item.kind, id: item.id, fields, savedAt: null };
          await write(
            key,
            tick,
            () => (item.kind === "task" ? toggleTask(item.id, done) : item.kind === "line" ? updateQuestTask(item.id, fields) : updateStep(item.id, fields)),
            "Couldn't save that."
          );
        }
      } finally {
        saving.current.delete(key);
        if (owed.current && busy.current === 0 && saving.current.size === 0) tellSoon();
      }
    },
    [clearReason, date, tellSoon, write]
  );

  // Why a planned task was left undone ("Ran out of time"), or null to take
  // the reason back. It shows at once and holds the same way a tick does.
  const setReason = useCallback(
    async (taskId, reason) => {
      const key = `task:${taskId}`;
      const left_reason = reason ? String(reason).trim().slice(0, 80) || null : null;
      const held = overridesNow.current.get(key)?.fields ?? {};
      const tick = { kind: "task", id: taskId, fields: { ...held, left_reason }, savedAt: null };
      await write(key, tick, () => updateTask(taskId, { left_reason }), "Couldn't save that reason.");
    },
    [write]
  );

  // Every save that's on its way, landed (or put back). Bank the day waits
  // on this, so the day's summary reads the ticks you just made.
  const settle = useCallback(async () => {
    for (let i = 0; i < 5 && chains.current.size; i++) {
      await Promise.allSettled([...chains.current.values()]);
    }
  }, []);

  return { data, error, reload, overrides, toggle, setReason, settle };
}

// The page's own clock, which never jumps when the phone sets its time.
const clock = () => performance.now();

// `startedAt` is read before anything goes out, so a load that began after a
// save landed is sure to have read it.
async function loadWork(userId, date) {
  const startedAt = clock();
  const [tasks, work] = await Promise.all([fetchTasks(userId, date), fetchTodayQuestWork(userId, date)]);
  return { tasks, work, startedAt };
}
