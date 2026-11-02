import { useRef } from "react";
import { LEVELS, RINGS, FACE, MISS_BAND, levelAtSpot, clampSpot, ringSpot } from "../../lib/mark";
import { ArrowIn } from "../mark/TargetFace";
import "../../styles/mark.css";
import "../../styles/checks.css";

// A target you put the arrow in yourself: tap where the day landed. The
// ring comes from where you tapped (levelAtSpot), and anything past the
// face is a miss. The ring buttons underneath do the same for a keyboard or
// a screen reader, and for a quick tap without aiming.
//
//   spot      { x, y } of tonight's arrow, in target units, or null
//   onPlace   ({ x, y, level }) => void
//   marks     earlier arrows this week, drawn faint ({ id, x, y })
//   compact   the short evening's smaller face
//   label     what it's a target for, read aloud

export default function PlaceFace({ spot, onPlace, marks = [], compact = false, label = "this focus", disabled = false }) {
  const svg = useRef(null);
  const level = spot ? levelAtSpot(spot.x, spot.y) : null;

  function place(e) {
    if (disabled || !svg.current) return;
    const ctm = svg.current.getScreenCTM?.();
    if (!ctm) return;
    const pt = svg.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const at = pt.matrixTransform(ctm.inverse());
    const s = clampSpot(at.x, at.y);
    onPlace?.({ ...s, level: levelAtSpot(s.x, s.y) });
  }

  function ring(k) {
    if (disabled) return;
    // Keep where you'd put it when it's already in that ring.
    if (spot && level === k) return;
    const s = ringSpot(k);
    onPlace?.({ ...s, level: k });
  }

  return (
    <div className={"mark ck-place" + (compact ? " ck-place--compact" : "")}>
      <svg
        ref={svg}
        className="mk-face ck-place__face"
        viewBox="-100 -100 200 200"
        onClick={place}
        role="img"
        aria-label={spot ? `Arrow in ${LEVELS[level].name.toLowerCase()} for ${label}` : `Tap where the day landed for ${label}`}
      >
        <circle className="mk-miss" r={MISS_BAND} />
        <circle className="mk-board" r={FACE} />
        {RINGS.slice(1, 4)
          .reverse()
          .map((r) => (
            <circle key={r} className="mk-ring" r={r} />
          ))}
        <circle className="mk-bull" r={RINGS[0]} />
        {marks.map((m) => (
          <circle key={m.id} className="ck-place__was" cx={m.x} cy={m.y} r={compact ? 5 : 3.6} />
        ))}
        {spot && <ArrowIn x={spot.x} y={spot.y} scale={compact ? 1.9 : 1.3} />}
      </svg>
      <span className="ck-place__read" aria-live="polite">
        {spot ? LEVELS[level].name : "Tap where today landed"}
      </span>
      <div className="ck-place__rings" role="group" aria-label={`Or pick a ring for ${label}`}>
        {LEVELS.map((L, k) => (
          <button key={L.name} type="button" aria-pressed={level === k} onClick={() => ring(k)} disabled={disabled}>
            {L.name}
          </button>
        ))}
      </div>
    </div>
  );
}
