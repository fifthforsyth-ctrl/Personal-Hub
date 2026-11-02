import { useCallback, useEffect, useRef, useState } from "react";

// Load what a page or card shows, the same way everywhere.
//
// - `loading` is true only until the first answer for these inputs. A
//   reload() keeps showing what's there, so the page doesn't flash
//   "Loading…" and jump to the top after every change.
// - An answer that arrives after the inputs changed (‹ › tapped twice) is
//   dropped, so one day's data never shows under another day's heading.
// - A failure lands in `error` (and `data` keeps the last good answer)
//   instead of leaving the page stuck on "Loading…" or showing zeros.
//
//   const { data, error, loading, reload, mutate } = useLoad(() => fetchDay(date), [date]);
//
// `mutate` changes the data in place for optimistic updates; pass it a value
// or a function of the current value.
//
// A load already on its way when you change something was read before the
// change, so its answer would put the old row back over the one you just
// ticked (Today's plan: tick one, then another while the first tick's reload
// is still out, and the second box empties itself). So a change drops any
// answer on its way, and the hook loads again once the change has had time
// to save, so the page still gets what that load came for (a change made
// elsewhere, say). Loading again straight away could read the row before
// the save lands and undo the tick the same way. If the page reloads by
// itself before then (most do once a save lands), that reload stands in
// for it. With nothing on screen yet there's no tick to keep, so it loads
// again straight away.
const SETTLE_MS = 1500;

export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  // Every load, change and new set of inputs takes the next number; an
  // answer is kept only if nothing has taken one since its load began.
  const seq = useRef(0);
  const out = useRef(0); // the latest load's number while it's on its way, else 0
  const landed = useRef(false); // an answer for these inputs is on screen
  const again = useRef(null); // the load a change owes, waiting for its save
  const alive = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    clearTimeout(again.current);
    again.current = null;
    const mine = ++seq.current;
    out.current = mine;
    try {
      const data = await fnRef.current();
      if (mine === seq.current) {
        landed.current = true;
        setState({ data, error: null, loading: false });
      }
      return data;
    } catch (error) {
      console.warn(error);
      if (mine === seq.current) setState((s) => ({ ...s, error, loading: false }));
      return undefined;
    } finally {
      if (out.current === mine) out.current = 0;
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    landed.current = false;
    setState({ data: undefined, error: null, loading: true });
    reload();
    return () => {
      seq.current++;
      clearTimeout(again.current);
      again.current = null;
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const mutate = useCallback(
    (next) => {
      const owed = Boolean(out.current || again.current);
      seq.current++;
      setState((s) => ({ ...s, data: typeof next === "function" ? next(s.data) : next }));
      if (!owed || !alive.current) return;
      clearTimeout(again.current);
      again.current = null;
      if (!landed.current) reload();
      else again.current = setTimeout(reload, SETTLE_MS);
    },
    [reload]
  );

  return { ...state, reload, mutate };
}
