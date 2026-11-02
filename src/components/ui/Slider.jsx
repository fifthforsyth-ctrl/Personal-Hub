import { useId, useRef, useState } from "react";
import { haptic } from "../../lib/haptics";
import "../../styles/daily.css";

// One to ten, set with a thumb (Aaron, 2026-11-02: mood and stress go from
// 1–5 to 1–10, each with a note under it).
//
// Ten buttons in a row stopped fitting on a phone at ten, and a slider is
// how a feeling is usually scored anyway: put your thumb down where the day
// sits and slide it until it's right. The track is ten steps, so wherever
// you lift your thumb it lands on a whole number, and the number shows big
// beside the label while you slide. Before the first touch nothing is set
// and it says so ("Tap to set"); a slider that starts in the middle would
// quietly answer for you.
//
// It saves only once you've settled: when your thumb comes up, or on a key.
// A drag across from 3 to 8 is one answer, not five. Starting a scroll on
// the track scrolls the page (the browser keeps vertical pans), and a value
// shown under a thumb that turned into a scroll goes back to what it was.
//
// Keys, the way a slider takes them: the arrows step by one (the first one
// lands on 5 when nothing is set yet), Home and End go to 1 and 10.
//
//   value     1..10, or null before it's set
//   onChange  (n) => void, once it's settled. It's called again for the
//             value it already has (a second tap on the same spot), so the
//             card can retry a save that didn't go through; it never clears
//   label     what it measures ("Mood"), shown and read out with the value
//   low       the words under the left end ("1 low")
//   high      the words under the right end ("10 good")

export const SLIDER_MIN = 1;
export const SLIDER_MAX = 10;
const STEPS = Array.from({ length: SLIDER_MAX }, (_, i) => i + 1);

export default function Slider({ value, onChange, label, low, high, disabled = false }) {
  const id = useId();
  const track = useRef(null);
  const down = useRef(null);
  // The step under your thumb while it's down; what's saved shows otherwise.
  const [live, setLive] = useState(null);
  const set = value == null ? null : clamp(Number(value));
  const shown = live ?? set;

  function stepAt(clientX) {
    const r = track.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return shown ?? 5;
    return clamp(Math.floor(((clientX - r.left) / r.width) * SLIDER_MAX) + 1);
  }

  function settle(n) {
    haptic("tap");
    onChange?.(n);
  }

  function onPointerDown(e) {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    down.current = e.pointerId;
    try {
      track.current?.setPointerCapture(e.pointerId);
    } catch {
      /* already captured, or the pointer is gone */
    }
    setLive(stepAt(e.clientX));
  }

  function onPointerMove(e) {
    if (down.current !== e.pointerId) return;
    setLive(stepAt(e.clientX));
  }

  function onPointerUp(e) {
    if (down.current !== e.pointerId) return;
    down.current = null;
    const n = stepAt(e.clientX);
    setLive(null);
    settle(n);
  }

  // The browser took the touch for a scroll: nothing was chosen.
  function onPointerCancel(e) {
    if (down.current !== e.pointerId) return;
    down.current = null;
    setLive(null);
  }

  function onKeyDown(e) {
    if (disabled) return;
    let n;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") n = set == null ? 5 : set + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") n = set == null ? 5 : set - 1;
    else if (e.key === "Home") n = SLIDER_MIN;
    else if (e.key === "End") n = SLIDER_MAX;
    else return;
    e.preventDefault();
    n = clamp(n);
    if (n !== set) onChange?.(n);
  }

  return (
    <div className={"slider" + (shown == null ? " slider--unset" : "") + (disabled ? " slider--off" : "")}>
      <div className="slider__head">
        <span className="slider__label" id={`${id}-label`}>
          {label}
        </span>
        <span className="slider__value" aria-hidden="true">
          {shown == null ? "Tap to set" : shown}
        </span>
      </div>
      <div
        ref={track}
        className={"slider__track" + (live != null ? " is-down" : "")}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={`${id}-label`}
        aria-valuemin={SLIDER_MIN}
        aria-valuemax={SLIDER_MAX}
        aria-valuenow={set ?? undefined}
        aria-valuetext={set == null ? "Not set" : `${set} of ${SLIDER_MAX}`}
        aria-disabled={disabled || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onPointerCancel}
        onKeyDown={onKeyDown}
      >
        {STEPS.map((n) => (
          <i key={n} className={"slider__step" + (shown != null && n <= shown ? " is-on" : "")} />
        ))}
        {shown != null && <b className="slider__thumb" style={{ left: `${((shown - 0.5) / SLIDER_MAX) * 100}%` }} />}
      </div>
      {(low || high) && (
        <div className="slider__ends" aria-hidden="true">
          <span>{low}</span>
          <span>{high}</span>
        </div>
      )}
    </div>
  );
}

function clamp(n) {
  if (!Number.isFinite(n)) return null;
  return Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, Math.round(n)));
}
