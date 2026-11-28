import { createPortal } from "react-dom";

// Every pop-up, sheet and full-screen moment renders through this
// (Aaron 2026-11-28: "on any pop up I need to make sure that I can scroll
// all the way down"): `return overlay(<div className="sheet-backdrop">…)`.
// It puts the pop-up at the end of <body>, outside the shell, so it never
// sits inside the page's own scroller (.main) or beside the tab bar. On the
// iPhone a fixed layer inside a scrolling page can be clipped to that page,
// or hand its swipe to the page behind, and then its last lines can't be
// reached. Pop-ups opened later land later in <body>, so a confirm opened
// over a sheet stays on top of it.
export function overlay(node) {
  if (typeof document === "undefined" || !node) return node;
  return createPortal(node, document.body);
}

export default function Overlay({ children }) {
  return overlay(children);
}
