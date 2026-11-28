// The Hub fills the whole phone screen (Aaron, 2026-11-28).
//
// Opened from the home screen, iOS can hand the page a window shorter than
// the screen by the status bar's height, so the shell (fixed, inset 0)
// stopped short and a grey band showed under the bottom tabs. The screen
// itself is the truth there: when the app runs on its own, upright, and the
// window is shorter than the screen, the shell takes the screen's height
// (--app-h). Anywhere else, or when the window is already the full screen,
// nothing changes.

export function appHeight({ standalone, innerWidth, innerHeight, screenWidth, screenHeight }) {
  if (!standalone) return null;
  const upright = innerHeight >= innerWidth;
  const tall = upright ? Math.max(screenWidth, screenHeight) : Math.min(screenWidth, screenHeight);
  if (!tall || tall <= innerHeight || tall - innerHeight > 120) return null;
  return tall;
}

export function installAppHeight() {
  if (typeof window === "undefined") return;
  const set = () => {
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
    const h = appHeight({
      standalone,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      screenWidth: window.screen?.width ?? 0,
      screenHeight: window.screen?.height ?? 0,
    });
    const root = document.documentElement.style;
    if (h) root.setProperty("--app-h", `${h}px`);
    else root.removeProperty("--app-h");
  };
  set();
  window.addEventListener("resize", set);
  window.addEventListener("orientationchange", () => setTimeout(set, 300));
}
