import { useEffect, useRef, useState } from "react";
import { TIERS } from "../../lib/mark";
import { playClink } from "../../lib/clink";
import { playTwang } from "../../lib/thunk";
import { haptic } from "../../lib/haptics";
import { BowShape } from "./Bow";
import "../../styles/mark.css";

// A new bow, earned. It comes in over the volley once the arrows that crossed
// the line have landed: the bow, how many bullseyes it took, its verse, and
// what's next. "Draw it" pulls the string back to full draw and lets the
// arrow go, and then you're back with tonight's arrows.

const DRAW_MS = 560;
const HOLD_MS = 140;
const AWAY_MS = 520;

export default function BowUp({ tier, onClose }) {
  const t = TIERS[tier];
  const next = TIERS[tier + 1];
  const button = useRef(null);
  const [pull, setPull] = useState(0.5);
  const [stage, setStage] = useState("ready"); // ready | drawing | loosed
  const still = useRef(typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const timers = useRef([]);

  useEffect(() => {
    playClink();
    haptic("win");
    button.current?.focus({ preventScroll: true });
    const list = timers.current;
    return () => list.forEach((id) => (typeof id === "number" ? clearTimeout(id) : cancelAnimationFrame(id.raf)));
  }, []);

  function draw() {
    if (stage !== "ready") return;
    if (still.current) {
      playTwang();
      onClose();
      return;
    }
    setStage("drawing");
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / DRAW_MS);
      setPull(0.5 + 0.5 * (1 - (1 - k) ** 3));
      if (k < 1) {
        timers.current.push({ raf: requestAnimationFrame(step) });
        return;
      }
      timers.current.push(
        setTimeout(() => {
          setStage("loosed");
          setPull(0);
          playTwang();
          haptic("success");
          timers.current.push(setTimeout(onClose, AWAY_MS));
        }, HOLD_MS)
      );
    };
    timers.current.push({ raf: requestAnimationFrame(step) });
  }

  return (
    <div className="mark mk-bowup" role="dialog" aria-modal="true" aria-labelledby="mk-bowup-h">
      <svg className={"mk-bowup__bow" + (stage === "ready" ? " mk-bowup__bow--in" : "")} viewBox="-70 -78 160 156" aria-hidden="true">
        <BowShape tier={tier} pull={pull} arrow={stage !== "loosed"} />
        {stage === "loosed" && (
          <g className="mk-bowup__away">
            <path className="b-arrow" d="M-62,0H17" />
            <path className="b-head" d="M22,0l-7,-3.2v6.4z" />
            <path className="b-fl" d="M-59,-0.8l3,-4.2h7l-3,4.2z" />
            <path className="b-fl" d="M-59,0.8l3,4.2h7l-3,-4.2z" />
          </g>
        )}
      </svg>
      <span className="eyebrow mk-bowup__count">{t.at} bullseyes</span>
      <h2 id="mk-bowup-h">You've earned {t.name.toLowerCase()}</h2>
      {t.verse && (
        <blockquote>
          {t.verse.text}
          <cite>{t.verse.cite}</cite>
        </blockquote>
      )}
      <p>Bullseyes from every target count. {next ? `Next, ${next.name.toLowerCase()} at ${next.at}.` : "That's every bow."}</p>
      <button type="button" className="btn mk-bowup__draw" ref={button} onClick={draw} disabled={stage !== "ready"}>
        Draw it
      </button>
    </div>
  );
}
