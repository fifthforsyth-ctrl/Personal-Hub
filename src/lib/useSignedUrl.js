import { useEffect, useState } from "react";
import { signedImageUrl } from "./api";

// Pictures in the private bucket show through short-lived links. Each file
// is signed once for a few hours and the link is shared by everything that
// shows it; one just uploaded shows from the device straight away (`prime`).
const HOURS = 6;
const cache = new Map(); // path → { url, until } or a promise of the url

export function urlNow(path) {
  const c = path ? cache.get(path) : null;
  return c && !(c instanceof Promise) && c.until > Date.now() ? c.url : null;
}

export function signPicture(path) {
  if (!path) return Promise.resolve(null);
  const now = urlNow(path);
  if (now) return Promise.resolve(now);
  const c = cache.get(path);
  if (c instanceof Promise) return c;
  const p = signedImageUrl(path, HOURS * 3600).then(
    (url) => {
      if (url) cache.set(path, { url, until: Date.now() + (HOURS * 3600 - 600) * 1000 });
      else cache.delete(path);
      return url;
    },
    () => {
      cache.delete(path);
      return null;
    }
  );
  cache.set(path, p);
  return p;
}

// A file's picture from the device, for as long as the page is open.
export function prime(path, url) {
  if (path && url) cache.set(path, { url, until: Date.now() + HOURS * 3600 * 1000 });
}

export function useSignedUrl(path) {
  const [url, setUrl] = useState(() => urlNow(path));
  useEffect(() => {
    let live = true;
    setUrl(urlNow(path));
    signPicture(path).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [path]);
  return url;
}
