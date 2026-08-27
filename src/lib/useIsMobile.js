import { useEffect, useState } from "react";

// Whether to use touch-oriented layouts (the bottom-pivoted swipeable wheel,
// see SectionWheel) — keyed off actual input capability, not viewport width.
// A width breakpoint would misfire on a merely-narrow desktop window (a
// resized browser, a smaller laptop) and silently swap out PyramidWheel —
// including its hover-grow/glow, which has no touch equivalent — even
// though a mouse is right there. `pointer: coarse` + `hover: none` is true
// for real touchscreens and false for anything with a mouse or trackpad
// (Chrome's device-emulation "mobile" preset flips these along with the
// viewport, so it still tests the same as on a real phone).
const QUERY = "(hover: none) and (pointer: coarse)";

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.matchMedia(QUERY).matches : false));

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
