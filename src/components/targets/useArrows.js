import { useCallback, useEffect } from "react";
import { addTargetArrow, deleteTargetArrow, fetchTargetArrows, updateTargetArrow } from "../../lib/api";
import { arrowRef } from "../../lib/arrows";
import { useLoad } from "../../lib/useLoad";
import { haptic } from "../../lib/haptics";
import { playClink } from "../../lib/clink";
import { announceChange } from "../today/announce";
import { useToast } from "../ui/Feedback";

const NONE = [];

// Every arrow he's placed, and placing, changing and taking one off. Each
// shows at once; a save that fails says so (and place/change reject, so
// the pop-up keeps his words).
export function useArrows(userId, today) {
  const toast = useToast();
  const { data, error, reload, mutate } = useLoad(() => (userId ? fetchTargetArrows(userId) : null), [userId]);

  useEffect(() => {
    window.addEventListener("hub:changed", reload);
    return () => window.removeEventListener("hub:changed", reload);
  }, [reload]);

  const place = useCallback(
    async (target, words) => {
      let row;
      try {
        row = await addTargetArrow(userId, arrowRef(target.kind, target.key), { date: today, ...words });
      } catch (err) {
        toast.error(err, "Couldn't place that arrow.");
        throw err;
      }
      mutate((list) => [...(list ?? []), row]);
      haptic("success");
      playClink();
      toast.show("Arrow placed", {
        actionLabel: "Undo",
        onAction: async () => {
          mutate((list) => (list ?? []).filter((a) => a.id !== row.id));
          try {
            await deleteTargetArrow(row.id);
          } catch (err) {
            toast.error(err, "Couldn't take that arrow off.");
            reload();
          }
        },
      });
      return row;
    },
    [userId, today, mutate, toast, reload]
  );

  const change = useCallback(
    async (arrow, words) => {
      let row;
      try {
        row = await updateTargetArrow(arrow.id, words);
      } catch (err) {
        toast.error(err, "Couldn't save that arrow.");
        throw err;
      }
      mutate((list) => (list ?? []).map((a) => (a.id === row.id ? row : a)));
      return row;
    },
    [mutate, toast]
  );

  const remove = useCallback(
    (arrow) => {
      mutate((list) => (list ?? []).filter((a) => a.id !== arrow.id));
      toast.undoable({
        message: "Arrow taken off",
        run: async () => {
          try {
            await deleteTargetArrow(arrow.id);
            announceChange();
          } catch (err) {
            toast.error(err, "Couldn't take that arrow off.");
            reload();
          }
        },
        onUndo: () => mutate((list) => [...(list ?? []), arrow].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))),
      });
    },
    [mutate, toast, reload]
  );

  return { list: data ?? NONE, error, reload, place, change, remove };
}
