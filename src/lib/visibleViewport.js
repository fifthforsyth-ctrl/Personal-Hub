// The part of the screen you can actually see while the iPhone's keyboard
// is up, as two CSS values on <html>: --vv-h (its height) and --vv-top (how
// far iOS has slid it down). The keyboard covers the bottom of the screen
// without shrinking the page, so a pop-up pinned to the bottom would keep
// its last lines and its Save button under the keyboard, out of reach of
// any scroll. Pop-ups size themselves to --vv-h instead (index.css), so they
// end where the keyboard begins and still scroll all the way down (Aaron
// 2026-11-28: "when I add a purchase I can't scroll down to actually add
// it"). With no keyboard the values are cleared and pop-ups fill the app's
// own height (--app-h, lib/appHeight.js).

// Less than this much hidden is browser chrome, not a keyboard.
const KEYBOARD = 120;

export function keyboardViewport({ height, offsetTop, scale, layoutHeight }) {
  if (!(height > 0) || scale > 1.01) return null; // pinch zoom: leave it be
  if (layoutHeight - height < KEYBOARD) return null;
  return { h: Math.round(height), top: Math.max(0, Math.round(offsetTop || 0)) };
}

export function installVisibleViewport(win = typeof window === "undefined" ? null : window) {
  const vv = win?.visualViewport;
  if (!vv) return () => {};
  const doc = win.document;
  const root = doc.documentElement;
  let frame = 0;
  let open = false;
  const apply = () => {
    frame = 0;
    const kb = keyboardViewport({ height: vv.height, offsetTop: vv.offsetTop, scale: vv.scale, layoutHeight: win.innerHeight });
    if (!kb) {
      open = false;
      root.style.removeProperty("--vv-h");
      root.style.removeProperty("--vv-top");
      return;
    }
    root.style.setProperty("--vv-h", `${kb.h}px`);
    root.style.setProperty("--vv-top", `${kb.top}px`);
    // As the keyboard comes up, keep the box being typed in visible inside
    // its pop-up.
    const el = doc.activeElement;
    if (!open && el && el !== doc.body && el.closest?.(".sheet, .modal, .voice-full")) el.scrollIntoView?.({ block: "nearest" });
    open = true;
  };
  const later = () => {
    if (!frame) frame = win.requestAnimationFrame(apply);
  };
  apply();
  vv.addEventListener("resize", later);
  vv.addEventListener("scroll", later);
  return () => {
    vv.removeEventListener("resize", later);
    vv.removeEventListener("scroll", later);
    if (frame) win.cancelAnimationFrame(frame);
  };
}
