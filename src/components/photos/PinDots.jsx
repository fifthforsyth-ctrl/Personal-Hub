import { useLayoutEffect, useRef, useState } from "react";
import { pinSpots } from "../../lib/zoom";

// A picture's pins where it's shown small, in its section (Aaron,
// 2026-10-30: "show my pins in the image when I'm viewing it from the
// section"). It fills the box the picture is in and puts each pin on it
// where it was put up close; `fit` says how the picture sits in that box
// (pinSpots, lib/zoom.js). With `onOpen`, tapping one opens the picture up
// close on that pin.
//
//   <PinDots pins={[{ id, x, y, n, count }]} fit={{ w, h, frame, pad, cover }} small onOpen={(id) => …} />

export default function PinDots({ pins, fit, small = false, onOpen }) {
  const ref = useRef(null);
  const [box, setBox] = useState(null);
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
            onClick={() => onOpen(p.id)}
            aria-label={`Open pin ${p.n}${p.count ? `, ${p.count} task${p.count === 1 ? "" : "s"}` : ""}`}
          >
            <span className="pin-dot__head">{p.n}</span>
          </button>
        ) : (
          <span key={p.id} className={"pin-dot" + (p.count ? " has" : "")} style={{ transform: `translate3d(${p.left}px, ${p.top}px, 0)` }}>
            <span className="pin-dot__head">{small ? "" : p.n}</span>
          </span>
        )
      )}
    </span>
  );
}
