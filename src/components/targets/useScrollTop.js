import { useEffect } from "react";

// The app scrolls inside .main, which stays mounted from page to page, so a
// new page would open where the last one was scrolled to. This puts it back
// at the top whenever `key` changes (a new target, a new page).
export function useScrollTop(key) {
  useEffect(() => {
    const main = document.querySelector(".main");
    if (main && typeof main.scrollTo === "function") main.scrollTo(0, 0);
    else if (main) main.scrollTop = 0;
  }, [key]);
}
