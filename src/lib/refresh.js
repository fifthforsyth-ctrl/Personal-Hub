// Refresh (Aaron, 2026-10-27): on the home-screen app there's no browser
// reload, so a change made on the computer only showed once the app was
// closed and opened again. The Refresh button loads the page again, with
// everything on it fresh from the server, and lands back where he was.

const KEY = "hub:refresh";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const here = () => location.pathname + location.search;

export async function refreshApp() {
  // Leaving a box saves what's in it; give that save a moment to land
  // before the page goes.
  document.activeElement?.blur?.();
  const main = document.querySelector(".main");
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path: here(), main: main?.scrollTop || 0, win: window.scrollY || 0 }));
  } catch {
    // no storage: it still refreshes, just from the top
  }
  // A new version of the app, if there is one, comes along too.
  const check = (async () => {
    try {
      const reg = await navigator.serviceWorker?.getRegistration?.();
      await reg?.update();
    } catch {
      // offline, or no service worker: the reload still gets fresh data
    }
  })();
  await Promise.all([Promise.race([check, wait(1500)]), wait(700)]);
  window.location.reload();
}

// After a refresh, scroll back to where he was. The lists load in after the
// page does, so it keeps putting the scroll back for a few seconds while
// they fill in, and stops as soon as he touches or scrolls himself.
export function restoreAfterRefresh() {
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(KEY));
    sessionStorage.removeItem(KEY);
  } catch {
    return;
  }
  if (!saved || saved.path !== here() || !(saved.main || saved.win)) return;
  let stop = false;
  const quit = () => (stop = true);
  const events = ["touchstart", "wheel", "keydown", "mousedown"];
  for (const e of events) window.addEventListener(e, quit, { once: true, passive: true });
  const until = Date.now() + 5000;
  (function step() {
    if (stop || Date.now() > until) {
      for (const e of events) window.removeEventListener(e, quit);
      return;
    }
    const main = document.querySelector(".main");
    if (main && saved.main && main.scrollTop !== saved.main) main.scrollTop = saved.main;
    if (saved.win && window.scrollY !== saved.win) window.scrollTo(0, saved.win);
    requestAnimationFrame(step);
  })();
}
