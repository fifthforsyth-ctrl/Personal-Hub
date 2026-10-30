import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { pinSpots, tipAt } from "../../lib/zoom";

// A picture's pins where it's shown small, in its section (Aaron,
// 2026-10-30: "show my pins in the image when I'm viewing it from the
// section"). It fills the box the picture is in and puts each pin on it
// where it was put up close; `fit` says how the picture sits in that box
// (pinSpots, lib/zoom.js).
//
// With `onOpen` the pins answer (Aaron, 2026-10-30: "when I hover over a pin
// when I'm looking at the section I need to be able to read the task, and
// if I click on it the task it is assigned to gets highlighted"): over one,
// a card says what's on it; tapping one lights up its tasks where they are
// on the page, and tapping it again (or one whose tasks aren't on show)
// opens the picture up close on it.
//
//   <PinDots pins={[{ id, x, y, n, count, tasks, note }]} fit={{ w, h, frame, pad, cover }} small onOpen={(id) => …} />

const LIT_MS = 2600;
const MORE = 6; // tasks a card lists before "and N more"

// The rows on the page that are these tasks (StepRow and LineRow mark
// theirs with data-row), as shown: all copies of each, a mirror on Today
// as well as the step in its section.
function rowsOf(ids) {
  return ids.flatMap((id) => [...document.querySelectorAll(`[data-row="${CSS.escape(id)}"]`)]).filter((el) => el.getClientRects().length > 0);
}

// Lights `els` up for a moment, and brings the nearest to `from` (the pin)
// into view when none is.
const unlit = new WeakMap();
function light(els, from) {
  for (const el of els) {
    delete el.dataset.lit;
    void el.offsetWidth; // start the glow over
    el.dataset.lit = "1";
    clearTimeout(unlit.get(el));
    unlit.set(el, setTimeout(() => delete el.dataset.lit, LIT_MS));
  }
  const vh = window.innerHeight;
  const seen = els.some((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < vh;
  });
  if (seen) return;
  const y = from.getBoundingClientRect().top;
  const near = [...els].sort((a, b) => Math.abs(a.getBoundingClientRect().top - y) - Math.abs(b.getBoundingClientRect().top - y))[0];
  near.scrollIntoView({ behavior: "smooth", block: "center" });
}

export default function PinDots({ pins, fit, small = false, onOpen }) {
  const ref = useRef(null);
  const [box, setBox] = useState(null);
  const [tip, setTip] = useState(null); // { id, el }
  const lit = useRef({ id: null, at: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox((b) => (b && Math.abs(b.w - r.width) < 0.5 && Math.abs(b.h - r.height) < 0.5 ? b : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const spots = box ? pinSpots(pins, fit, box.w, box.h) : [];
  const shown = tip && spots.find((p) => p.id === tip.id);

  function pick(p, el) {
    const again = lit.current.id === p.id && Date.now() - lit.current.at < LIT_MS + 1500;
    const els = again ? [] : rowsOf((p.tasks ?? []).map((t) => t.id));
    if (!els.length) {
      lit.current = { id: null, at: 0 };
      setTip(null);
      onOpen(p.id);
      return;
    }
    lit.current = { id: p.id, at: Date.now() };
    light(els, el);
    setTip({ id: p.id, el, lit: true });
  }

  return (
    <span className={"pin-dots" + (small ? " pin-dots--small" : "")} ref={ref} aria-hidden={onOpen ? undefined : "true"}>
      {spots.map((p) =>
        onOpen ? (
          <button
            key={p.id}
            type="button"
            className={"pin-dot" + (p.count ? " has" : "")}
            data-pin={p.id}
            style={{ transform: `translate3d(${p.left}px, ${p.top}px, 0)` }}
            onClick={(e) => pick(p, e.currentTarget)}
            onPointerEnter={(e) => e.pointerType === "mouse" && setTip({ id: p.id, el: e.currentTarget })}
            onPointerLeave={(e) => e.pointerType === "mouse" && setTip((t) => (t?.id === p.id ? null : t))}
            onFocus={(e) => e.currentTarget.matches(":focus-visible") && setTip({ id: p.id, el: e.currentTarget })}
            onBlur={() => setTip((t) => (t?.id === p.id ? null : t))}
            aria-label={pinLabel(p)}
          >
            <span className="pin-dot__head">{small ? "" : p.n}</span>
          </button>
        ) : (
          <span key={p.id} className={"pin-dot" + (p.count ? " has" : "")} style={{ transform: `translate3d(${p.left}px, ${p.top}px, 0)` }}>
            <span className="pin-dot__head">{small ? "" : p.n}</span>
          </span>
        )
      )}
      {shown && <PinTip pin={shown} anchor={tip.el} lit={Boolean(tip.lit)} onGone={() => setTip(null)} />}
    </span>
  );
}

function pinLabel(p) {
  const tasks = p.tasks ?? [];
  const what = tasks.length ? `: ${tasks.map((t) => t.text).join("; ")}` : p.note ? `: ${p.note}` : "";
  return `Pin ${p.n}${what}. ${tasks.length ? "Tap to find it in the list" : "Tap to open it up close"}`;
}

// The card over a pin: its tasks (the done ones struck through), its note,
// and what tapping it does. On the page's top layer so the picture's edge
// doesn't cut it; it follows the pin as the page scrolls (to the task a tap
// lit up, say), and goes once the pin's off screen.
function PinTip({ pin, anchor, lit, onGone }) {
  const ref = useRef(null);
  const [at, setAt] = useState(null);
  const goneRef = useRef(onGone);
  goneRef.current = onGone;
  const place = () => {
    const el = ref.current;
    if (!el || !anchor?.isConnected) return goneRef.current();
    const r = anchor.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight || !r.width) return goneRef.current();
    setAt(tipAt(r, el.offsetWidth, el.offsetHeight, window.innerWidth, window.innerHeight));
  };
  useLayoutEffect(() => {
    place();
  }, [anchor, pin.id, pin.count, lit]);
  useEffect(() => {
    // a tap's card stays a moment; a hover's while the pointer's there
    const t = lit ? setTimeout(() => goneRef.current(), LIT_MS + 1500) : null;
    let frame = 0;
    const follow = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    window.addEventListener("scroll", follow, { capture: true, passive: true });
    window.addEventListener("resize", follow);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", follow, { capture: true });
      window.removeEventListener("resize", follow);
    };
  }, [lit, anchor]);
  const tasks = pin.tasks ?? [];
  return createPortal(
    <div
      ref={ref}
      className={"pin-tip" + (at?.below ? " below" : "")}
      role="tooltip"
      style={at ? { left: at.left, top: at.top } : { left: 0, top: 0, visibility: "hidden" }}
    >
      <div className="pin-tip__head">
        <span className="pin-tip__n">{pin.n}</span>
        Pin {pin.n}
        {tasks.length > 1 && <span className="pin-tip__count"> · {tasks.length} tasks</span>}
      </div>
      {tasks.length > 0 && (
        <ul className="pin-tip__tasks">
          {tasks.slice(0, MORE).map((t) => (
            <li key={t.id} className={t.kind === "note" ? "note" : t.done_on ? "done" : ""}>
              <span className="pin-tip__box" aria-hidden="true" />
              <span className="pin-tip__text">{t.text}</span>
            </li>
          ))}
          {tasks.length > MORE && <li className="more">and {tasks.length - MORE} more</li>}
        </ul>
      )}
      {pin.note && <p className="pin-tip__note">{pin.note}</p>}
      {!tasks.length && !pin.note && <p className="pin-tip__note">Nothing on it yet.</p>}
      <p className="pin-tip__hint">{tasks.length ? (lit ? "Tap again to see it up close" : "Tap to find it in the list") : "Tap to see it up close"}</p>
    </div>,
    document.body
  );
}
