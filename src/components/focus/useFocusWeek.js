import { useCallback, useEffect } from "react";
import { fetchFocusWeek, setFocusCheckin } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { summarizeWeek } from "../../lib/focus";
import { useToast } from "../ui/Feedback";
import { announceChange } from "../today/announce";
import { useBackOnline } from "../today/useBackOnline";

// One week's focus goals and check-ins, shared by Week, Today and the
// evening. A check-in shows at once and saves behind it; if the save fails the
// week is read again, so it shows what was really saved, and says so.
export function useFocusWeek(userId, weekStart) {
  const toast = useToast();
  const { data, error, loading, reload, mutate } = useLoad(
    () => (userId ? fetchFocusWeek(userId, weekStart) : null),
    [userId, weekStart]
  );
  useBackOnline(reload, Boolean(error));

  // Answered on another page (Today, then the evening) shows up here too.
  useEffect(() => {
    window.addEventListener("hub:changed", reload);
    return () => window.removeEventListener("hub:changed", reload);
  }, [reload]);

  const checkin = useCallback(
    async (goalId, date, moved) => {
      mutate((d) => {
        if (!d) return d;
        const rest = d.checkins.filter((c) => !(c.goal_id === goalId && String(c.date).slice(0, 10) === date));
        return { ...d, checkins: moved === null ? rest : [...rest, { goal_id: goalId, date, moved }] };
      });
      try {
        await setFocusCheckin(userId, goalId, date, moved);
        announceChange();
      } catch (err) {
        reload();
        toast.error(err, "Couldn't save that check-in.");
      }
    },
    [userId, mutate, reload, toast]
  );

  const week = data ? summarizeWeek(data.goals, data.checkins, weekStart) : null;
  return { data, week, error, loading, reload, mutate, checkin };
}
