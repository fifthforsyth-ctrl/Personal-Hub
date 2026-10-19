import { isOn } from "./phoneFeel";

// Haptics: a small tap you feel when you press something.
//
// Android browsers have navigator.vibrate, which takes a pattern, so a win
// can feel different from a plain tap. iPhone Safari has no vibrate at all,
// but since iOS 18 it gives the system's own tick when a switch-style
// checkbox flips, so on iPhone each haptic flips a hidden one. That only
// works during a tap (iOS won't buzz on its own), there's one strength, and
// the phone's "System Haptics" setting turns it off like any other app.
//
//   haptic("tap")      every button, link and chip (installTapHaptics)
//   haptic("win")      the swords: timed to the clash and the parry
//   haptic("success")  something saved that you'll want to feel land
//   haptic("warning")  something didn't go through

const PATTERNS = {
  tap: [8],
  success: [12, 60, 18],
  win: [10, 170, 34, 280, 22],
  warning: [24, 50, 24, 50, 24],
};

// iOS buzzes once per flip, so the longer patterns flip again at these
// offsets while the tap still counts as a tap.
const IOS_REPEATS = { tap: [], success: [90], win: [190, 500], warning: [80, 160] };

const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
let lastAt = 0;
let iosSwitch = null;

function flipIosSwitch() {
  if (typeof document === "undefined") return;
  if (!iosSwitch) {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.dataset.hapticSkip = "";
    label.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

export function haptic(kind = "tap") {
  if (!isOn("haptics")) return;
  const now = Date.now();
  // One press is one feeling: when a button already played its own (the
  // swords, say), the plain tap that follows it is skipped.
  if (now - lastAt < 60) return;
  lastAt = now;
  if (canVibrate) {
    try {
      navigator.vibrate(PATTERNS[kind] ?? PATTERNS.tap);
    } catch {
      /* not allowed right now */
    }
    return;
  }
  flipIosSwitch();
  for (const ms of IOS_REPEATS[kind] ?? []) setTimeout(flipIosSwitch, ms);
}

const TAPPABLE = 'button, a[href], [role="button"], [role="tab"], [role="switch"], summary, label, select, input[type="checkbox"], input[type="radio"]';

// Every press in the app gets the light tap. This listens on the document
// after the page's own handlers have run, so a button that plays something
// stronger (the swords) wins, and the light tap is dropped as a repeat.
export function installTapHaptics() {
  if (typeof document === "undefined") return;
  document.addEventListener("click", (e) => {
    const el = e.target instanceof Element ? e.target.closest(TAPPABLE) : null;
    if (!el || el.closest("[data-haptic-skip]") || el.disabled || el.getAttribute("aria-disabled") === "true") return;
    haptic("tap");
  });
}
