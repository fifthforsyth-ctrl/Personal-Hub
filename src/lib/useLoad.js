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
export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const data = await fnRef.current();
      if (mine === seq.current) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      console.warn(error);
      if (mine === seq.current) setState((s) => ({ ...s, error, loading: false }));
      return undefined;
    }
  }, []);

  useEffect(() => {
    setState({ data: undefined, error: null, loading: true });
    reload();
    return () => {
      seq.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const mutate = useCallback((next) => {
    setState((s) => ({ ...s, data: typeof next === "function" ? next(s.data) : next }));
  }, []);

  return { ...state, reload, mutate };
}
