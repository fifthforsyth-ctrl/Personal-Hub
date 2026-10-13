import { useEffect, useState } from "react";

// A person's photo for a browse tile: the lead image of their Wikipedia
// article, asked for once and remembered on this device. Wikipedia's API
// answers browsers directly, so this doesn't go through the server.
const memory = new Map();
const STORE = "hub.wiki-photos";

function stored() {
  try {
    return JSON.parse(localStorage.getItem(STORE) || "{}");
  } catch {
    return {};
  }
}

function remember(title, url) {
  memory.set(title, url);
  try {
    localStorage.setItem(STORE, JSON.stringify({ ...stored(), [title]: url }));
  } catch {
    // A full or blocked store just means asking again next time.
  }
}

export function useWikiPhoto(title) {
  const [url, setUrl] = useState(() => memory.get(title) ?? stored()[title] ?? null);

  useEffect(() => {
    if (!title) return;
    const known = memory.get(title) ?? stored()[title];
    if (known !== undefined) {
      setUrl(known);
      return;
    }
    let cancelled = false;
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((page) => {
        const src = page?.thumbnail?.source?.split("?")[0] ?? null;
        remember(title, src);
        if (!cancelled) setUrl(src);
      })
      .catch((err) => console.warn(err));
    return () => {
      cancelled = true;
    };
  }, [title]);

  return url;
}
