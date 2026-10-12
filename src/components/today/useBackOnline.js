import { useEffect } from "react";

// A load that failed tries again by itself when the phone gets its connection
// back, so a page opened on a dead signal fills itself in instead of waiting
// for someone to find the Try again button. `when` is usually "there's an
// error showing", so nothing reloads for no reason.
export function useBackOnline(reload, when = true) {
  useEffect(() => {
    if (!when) return undefined;
    const onOnline = () => reload();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [reload, when]);
}
