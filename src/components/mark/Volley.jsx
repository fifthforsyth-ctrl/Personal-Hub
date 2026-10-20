import { useEffect, useMemo, useRef, useState } from "react";
import { LEVELS, bowLine, bowEarned } from "../../lib/mark";
import { fmtDayHeading } from "../../lib/planDates";
import { playThunk } from "../../lib/thunk";
import Gear from "../ascent/Gear";
import TargetFace, { ArrowIn } from "./TargetFace";
import BowUp from "./BowUp";
import "../../styles/mark.css";

// The day is banked and the arrows fly: every target with tonight's answers
// gets its arrow, one after another, each landing where the answers put it
// with a thud (and a ring for a bullseye). Targets left blank show "No shot
// tonight". Then the count and the bow's line, and one button out. When
// tonight's bullseyes earned a new bow, it comes in over all of this a
// moment after the last arrow lands.
//
// `flown` is the ids of the shots this banking loosed; a shot that was
// already on its target (a day reopened and banked again) is shown landed.

const FIRST_MS = 650;
const EACH_MS = 430;
const FLIGHT_MS = 300;
const BOW_MS = 900;

export default function Volley({ range, date, flown, onDone }) {
  const button = useRef(null);
  const still = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);

  const cells = useMemo(
    () =>
      range.all.map((t) => {
        const shot = t.today ?? null;
        // The face behind the arrow: the last 30 days without tonight's.
        const behind = shot ? { ...t, shots: t.shots.filter((s) => s.id !== shot.id) } : t;
        return { t, shot, behind, flies: Boolean(shot && flown.has(shot.id)) };
      }),
    [range, flown]
  );
  const flying = cells.filter((c) => c.flies);

  const [landed, setLanded] = useState(() => new Set(still ? flying.map((c) => c.t.key) : []));
  const done = landed.size >= flying.length;

  // The bow these arrows earned, if any: bullseyes before tonight's flew,
  // against the count with them.
  const earned = useMemo(() => {
    const fresh = flying.filter((c) => c.shot.level === 0).length;
    return bowEarned(range.bullseyes - fresh, range.bullseyes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);
  const [bow, setBow] = useState("none"); // none | open | seen
  const bowRef = useRef(bow);
  bowRef.current = bow;

  useEffect(() => {
    if (still) return undefined;
    const ids = flying.map((c, m) =>
      setTimeout(() => {
        setLanded((s) => new Set(s).add(c.t.key));
        playThunk(c.shot.level === 0);
      }, FIRST_MS + m * EACH_MS + FLIGHT_MS)
    );
    return () => ids.forEach(clearTimeout);
    // The volley runs once, when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!done) return undefined;
    if (earned < 0) {
      button.current?.focus({ preventScroll: true });
      return undefined;
    }
    const id = setTimeout(() => setBow((b) => (b === "none" ? "open" : b)), still ? 0 : BOW_MS);
    return () => clearTimeout(id);
  }, [done, earned, still]);

  function closeBow() {
    setBow("seen");
    button.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (bowRef.current === "open") closeBow();
      else onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  const arrows = cells.filter((c) => c.shot).length;
  const bulls = cells.filter((c) => c.shot && c.shot.level === 0).length;

  return (
    <div className="mark mk-volley" role="dialog" aria-modal="true" aria-label="Tonight's arrows">
      <div className="mk-volley__in">
        <div className="mk-volley__head">
          <span className="eyebrow">{fmtDayHeading(date)} · day banked</span>
          <h2>Your arrows</h2>
        </div>

        <div className="card mk-volley__grid">
          {cells.map((c, n) => {
            const isIn = !c.flies || landed.has(c.t.key);
            const order = flying.indexOf(c);
            return (
              <div key={c.t.key} className={"mk-volley__cell" + (c.shot ? "" : " mk-volley__cell--none")}>
                <TargetFace target={c.behind} today={date} range="30" mini>
                  {c.shot && (
                    <g
                      className={c.flies && !still ? "mk-fly" : undefined}
                      style={c.flies && !still ? { animationDelay: `${FIRST_MS + order * EACH_MS}ms` } : undefined}
                    >
                      <ArrowIn x={c.shot.x} y={c.shot.y} scale={2.2} />
                    </g>
                  )}
                </TargetFace>
                <b>
                  <Gear name={c.t.icon} size={14} />
                  {c.t.short}
                </b>
                <small className={c.shot && isIn && c.shot.level === 0 ? "bull" : undefined} data-n={n}>
                  {!c.shot ? "No shot tonight" : isIn ? landing(c.t, c.shot) : " "}
                </small>
              </div>
            );
          })}
        </div>

        <div className="mk-volley__sum" aria-live="polite">
          {done && (
            <>
              <b>
                {arrows} {arrows === 1 ? "arrow" : "arrows"} · {bulls} {bulls === 1 ? "bullseye" : "bullseyes"}
              </b>
              <span>{bowLine(range.bullseyes)}</span>
            </>
          )}
        </div>
        <button type="button" className="btn btn--accent btn--block mk-volley__done" ref={button} onClick={onDone}>
          Done
        </button>
      </div>
      {bow === "open" && <BowUp tier={earned} onClose={closeBow} />}
    </div>
  );
}

function landing(t, s) {
  const name = LEVELS[s.level]?.name ?? "";
  return s.level > 0 && s.reason != null ? `${name} · ${t.reasons[s.reason]}` : name;
}
