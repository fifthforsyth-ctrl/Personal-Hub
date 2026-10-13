import { useCallback, useEffect, useRef, useState } from "react";
import { fetchShelf, requestShelf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { inShelfOrder, shelfState } from "../../lib/quoteShelves";

// One shelf of quotes, kept up to date while it's being filled.
//
// The first open of a shelf asks the `quotes` function to fill it, which
// looks every quote up on the web, so it takes a minute or so. The function
// answers at once and works in the background; this watches the shelf's row
// every few seconds until it's ready. Asked once per shelf per session, so
// opening and closing a shelf doesn't start it over.
const asked = new Set();
const POLL_MS = 4000;

export function useShelf(userId, shelf, { auto = true } = {}) {
  const key = shelf?.key ?? null;
  const { data, error, loading, reload, mutate } = useLoad(
    () => (key ? fetchShelf(userId, key) : Promise.resolve(null)),
    [userId, key]
  );
  const [askError, setAskError] = useState(null);
  const [asking, setAsking] = useState(false);
  const shelfRef = useRef(shelf);
  shelfRef.current = shelf;

  const state = loading ? "loading" : shelfState(data?.row);

  const ask = useCallback(
    async (opts = {}) => {
      const current = shelfRef.current;
      if (!current) return;
      asked.add(current.key);
      setAskError(null);
      setAsking(true);
      try {
        const row = await requestShelf(current, opts);
        mutate((d) => ({ row, quotes: d?.quotes ?? [] }));
      } catch (err) {
        setAskError(err);
      } finally {
        setAsking(false);
      }
    },
    [mutate]
  );

  // A shelf never opened before is filled on first sight.
  useEffect(() => {
    if (!auto || !key || loading || error) return;
    if (state === "missing" && !asked.has(key)) ask();
  }, [auto, key, loading, error, state, ask]);

  // While it fills, look again every few seconds.
  useEffect(() => {
    if (state !== "pending") return;
    const t = setTimeout(reload, POLL_MS);
    return () => clearTimeout(t);
  }, [state, data, reload]);

  const quotes = inShelfOrder(data?.row?.quote_ids, data?.quotes);

  return {
    row: data?.row ?? null,
    quotes,
    state: asking ? "pending" : state,
    error: askError ?? (state === "failed" ? new Error(data?.row?.error || "Finding quotes stopped partway.") : null),
    loadError: error,
    reload,
    // Swap one quote in place, after saving it to the board.
    replace: (quote) => mutate((d) => d && { ...d, quotes: d.quotes.map((q) => (q.id === quote.id ? quote : q)) }),
    more: () => ask({ more: true }),
    fresh: () => ask({ fresh: true }),
    retry: () => ask({ more: (data?.row?.quote_ids?.length ?? 0) > 0 }),
  };
}
