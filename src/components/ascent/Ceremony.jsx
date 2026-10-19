import { useEffect, useRef } from "react";

// Planting a flag: a camp reached, or a quest's summit. A quiet moment on a
// dark screen, the route drawing up to the peak and the flag going in, then
// one button on to whatever's next.
export default function Ceremony({ summit, campNumber, title, nextTitle, onDone }) {
  const button = useRef(null);

  useEffect(() => {
    button.current?.focus({ preventScroll: true });
    const onKey = (e) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  return (
    <div className="camp-up" role="dialog" aria-modal="true" aria-label={summit ? "Quest complete" : `Camp ${campNumber} reached`}>
      <svg viewBox="0 0 150 100" aria-hidden="true">
        <path className="cu-peak" d="M4 96 L46 54 L60 66 L92 22 L146 96" />
        <path className="cu-route" d="M20 96 C 52 92, 70 84, 64 72 C 58 60, 84 50, 92 30" />
        <path className="cu-pole" d="M92 22 V2" />
        <path className="cu-flag" d="M93 2 h17 l-4.4 5.6 4.4 5.6 h-17 z" />
      </svg>
      <span className="eyebrow camp-up__eyebrow">{summit ? "Quest complete" : `Camp ${campNumber} reached`}</span>
      <h2>{title}</h2>
      <blockquote>
        By small and simple things are great things brought to pass.
        <cite>Alma 37:6</cite>
      </blockquote>
      <p>{summit ? "It joins the patches behind you." : "One camp closer to the summit."}</p>
      <button type="button" className="camp-up__go" ref={button} onClick={onDone}>
        {summit ? "Done" : nextTitle ? `On to ${nextTitle}` : "On to the summit"}
      </button>
    </div>
  );
}

