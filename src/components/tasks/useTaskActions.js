import { useCallback, useMemo } from "react";
import { useToast } from "../ui/Feedback";
import { todayStr } from "../../lib/planDates";
import { haptic } from "../../lib/haptics";
import { BYPOS, deleteStep, editStep, moveSteps, putBack, takeOut, useTasksStore } from "../../lib/tasksStore";

// What a task row does, the same on a column and on the clipboard: tick,
// change its words (emptied, it goes, with Undo), and land where it's
// dropped (with Undo).
export function useTaskActions() {
  const toast = useToast();
  const { steps } = useTasksStore();

  const kidsOf = useMemo(() => {
    const by = new Map();
    for (const st of steps) if (st.parent_id) by.set(st.parent_id, [...(by.get(st.parent_id) ?? []), st]);
    for (const list of by.values()) list.sort(BYPOS);
    return (id) => by.get(id) ?? [];
  }, [steps]);

  const onTick = useCallback(
    async (step) => {
      const done = !step.done_on;
      haptic(done ? "success" : "tap");
      try {
        await editStep(step.id, { done_on: done ? todayStr() : null });
      } catch (err) {
        toast.error(err, "Couldn't save that tick.");
      }
    },
    [toast]
  );

  const onText = useCallback(
    async (step, text) => {
      if (!text) {
        const rows = takeOut(step.id);
        toast.undoable({
          message: "Task deleted",
          run: () => deleteStep(step.id),
          onUndo: () => putBack(rows),
        });
        return;
      }
      try {
        await editStep(step.id, { text });
      } catch (err) {
        toast.error(err, "Couldn't save that change.");
      }
    },
    [toast]
  );

  const onDrop = useCallback(
    async (step, to) => {
      try {
        const undo = await moveSteps([step.id], to);
        if (!undo) return;
        toast.show?.("Moved", {
          actionLabel: "Undo",
          onAction: () => undo().catch((err) => toast.error(err, "Couldn't put it back.")),
        });
      } catch (err) {
        toast.error(err, "Couldn't move that. It's back where it was.");
      }
    },
    [toast]
  );

  return { onTick, onText, onDrop, kidsOf };
}
