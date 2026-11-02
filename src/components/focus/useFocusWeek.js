import { useCallback, useEffect, useMemo, useRef } from "react";
import { fetchFocusWeek, setFocusArrow, setFocusCheckin, saveFocusSettings, saveFocusChecks, fetchAscent } from "../../lib/api";
import { buildAscent } from "../../lib/ascent";
import { useLoad } from "../../lib/useLoad";
import { summarizeWeek, putArrow, withPending, answeredChecks } from "../../lib/focus";
import { todayStr } from "../../lib/planDates";
import { useToast } from "../ui/Feedback";
import { announceChange } from "../today/announce";
import { useBackOnline } from "../today/useBackOnline";

// One week's focus goals, the arrows landed on them, and their checks,
// shared by Week, Today and the evening. An arrow shows the moment it's
// placed and saves behind it; if the save fails the week is read again, so
// it shows what was really saved, and says so.
//
// Place an arrow, then move it a moment later, and the two saves race to
// the database. So the saves for one goal and day go one after another,
// each waiting for the one before, and the newest one is what's left. Until
// the last of them has landed, a fresh read of the week (another page saying
// it changed, the phone coming back online) still shows the newest arrow
// rather than whatever the database held when it was read.
export function useFocusWeek(userId, weekStart) {
  const toast = useToast();
  // The arrows still on their way, by goal and day: the newest one, and how
  // many saves for that day are still out.
  const pending = useRef(new Map());
  // Each goal and day's saves, as one chain.
  const chains = useRef(new Map());

  const { data, error, loading, reload, mutate } = useLoad(
    () =>
      userId
        ? fetchFocusWeek(userId, weekStart).then((d) => ({ ...d, checkins: withPending(d.checkins, [...pending.current.values()]) }))
        : null,
    [userId, weekStart]
  );
  useBackOnline(reload, Boolean(error));

  // Answered on another page (Today, then the evening) shows up here too.
  useEffect(() => {
    window.addEventListener("hub:changed", reload);
    return () => window.removeEventListener("hub:changed", reload);
  }, [reload]);

  // A day's arrow on a goal, as placedArrow or checksArrow make it, or null
  // to take it back. Resolves to whether it saved; a failure is reported
  // here, so callers needn't catch. `save` is only for checkin below.
  const arrow = useCallback(
    (goalId, date, next, save) => {
      const key = `${goalId}|${date}`;
      const was = pending.current.get(key);
      pending.current.set(key, { goalId, date, arrow: next, out: (was?.out ?? 0) + 1 });
      mutate((d) => (d ? { ...d, checkins: putArrow(d.checkins, goalId, date, next) } : d));

      const run = async () => {
        try {
          await (save ? save() : setFocusArrow(userId, goalId, date, next));
          return null;
        } catch (err) {
          return err ?? new Error("Couldn't save that arrow.");
        }
      };
      const done = (chains.current.get(key) ?? Promise.resolve()).then(run).then((err) => {
        const cur = pending.current.get(key);
        const last = !cur || cur.out <= 1;
        if (last) pending.current.delete(key);
        else pending.current.set(key, { ...cur, out: cur.out - 1 });
        if (chains.current.get(key) === done) chains.current.delete(key);
        if (err) {
          reload();
          toast.error(err, "Couldn't save that arrow.");
          return false;
        }
        // Only once the newest has landed: every page reads the week again,
        // and an earlier answer would only flicker past on the way.
        if (last) announceChange();
        return true;
      });
      chains.current.set(key, done);
      return done;
    },
    [userId, mutate, reload, toast]
  );

  // Every save still out, finished. The evening waits on this before the
  // day is banked.
  const settled = useCallback(() => Promise.all([...chains.current.values()]), []);

  // "Did today move it?" true, false, or null to clear it: the arrow from
  // before you placed them, in the inner ring or out in the miss band.
  const checkin = useCallback(
    (goalId, date, moved) =>
      arrow(
        goalId,
        date,
        moved === null ? null : { level: moved ? 1 : 5, spot_x: null, spot_y: null, note: null, answers: [], lands: "placed" },
        () => setFocusCheckin(userId, goalId, date, moved)
      ),
    [arrow, userId]
  );

  // How a focus's arrow lands and what it counts toward ({ landsBy, toward },
  // either left out to keep it), saved, then read back everywhere.
  const saveSettings = useCallback(
    async (goalId, settings) => {
      await saveFocusSettings(goalId, settings);
      await reload();
      announceChange();
    },
    [reload]
  );

  // A focus's checks as its settings sheet holds them, in order; `before` is
  // what they were. One you take off that this week's arrows answered is
  // retired today rather than deleted.
  const saveChecks = useCallback(
    async (goalId, rows, before) => {
      await saveFocusChecks(userId, goalId, rows, before, { answered: answeredChecks(data?.checkins, goalId), today: todayStr() });
      await reload();
      announceChange();
    },
    [userId, data, reload]
  );

  const week = data ? summarizeWeek(data.goals, data.checkins, weekStart) : null;
  return { data, week, checks: data?.checks ?? [], error, loading, reload, mutate, arrow, settled, checkin, saveSettings, saveChecks };
}

// The lifetime goals, quests and lessons, and the lifetime focuses the time
// log answers checks from, as the Ascent view has them, for what a focus
// counts toward and for checks answered by the log. Read only when `on`:
// most weeks' focuses need neither.
export function useAscentView(userId, date, on = true) {
  const { data, error, loading, reload } = useLoad(() => (userId && on ? fetchAscent(userId, date) : null), [userId, date, on]);
  const view = useMemo(() => (data ? buildAscent(data, date) : null), [data, date]);
  const focuses = useMemo(() => (view?.goals ?? []).flatMap((g) => g.focuses ?? []), [view]);
  const focusesById = useMemo(() => new Map(focuses.map((f) => [f.id, f])), [focuses]);
  return { data, view, focuses, focusesById, error, loading: on && loading, reload };
}
