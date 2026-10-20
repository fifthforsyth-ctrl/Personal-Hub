import { LEVELS, RINGS, FACE, MISS_BAND, inRange, missCounts, fullest } from "../../lib/mark";
import { fmtShortDate } from "../../lib/planDates";

// A target with a mark for each day it was shot at. The face is 80 across
// from the center, the miss band runs to 96, and the four dashed lines split
// it into the sections for what got in the way. Older marks fade; the
// latest is orange, or an arrow stuck in the straw when it's today's.
//
//   mini      a small one for the range: no labels, bigger dots
//   labels    the four sections' names in the corners
//   hot       shades the fullest section, the next thing to work on
//   onPick    makes each mark tappable; `selected` rings the chosen one

const SPOTS = [
  [108, -103, "end"],
  [108, 110, "end"],
  [-108, 110, "start"],
  [-108, -103, "start"],
];

export default function TargetFace({ target, today, range = "30", mini = false, labels = false, hot = false, arrow = false, selected = null, onPick, className = "", label }) {
  const list = inRange(target.shots, today, range);
  const counts = missCounts(list);
  const hotK = hot ? fullest(counts) : -1;
  const span = range === "all" ? Math.max(30, list.length ? daysFrom(list[0].date, today) + 1 : 30) : Number(range);
  const last = target.shots[target.shots.length - 1] ?? null;
  const box = labels ? "-112 -112 224 224" : "-100 -100 200 200";

  return (
    <svg className={`mk-face${mini ? " mk-face--mini" : ""}${className ? ` ${className}` : ""}`} viewBox={box} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : "true"}>
      <circle className="mk-miss" r={MISS_BAND} />
      <circle className="mk-board" r={FACE} />
      {hotK >= 0 && <path className="mk-hot" d={sectionPath(hotK)} />}
      {RINGS.slice(1, 4)
        .reverse()
        .map((r) => (
          <circle key={r} className="mk-ring" r={r} />
        ))}
      <circle className="mk-bull" r={RINGS[0]} />
      {[
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ].map(([x, y]) => (
        <line key={`${x}${y}`} className="mk-div" x1={x * RINGS[0]} y1={y * RINGS[0]} x2={x * MISS_BAND} y2={y * MISS_BAND} />
      ))}
      {labels &&
        SPOTS.map(([x, y, anchor], k) => (
          <text key={k} className={"mk-lab" + (k === hotK ? " mk-lab--hot" : "")} x={x} y={y} textAnchor={anchor}>
            {target.reasons[k]}
          </text>
        ))}
      {list.map((s) => {
        const isLast = s === last;
        if (isLast && arrow && s.date === today) return <ArrowIn key={s.id} x={s.x} y={s.y} scale={mini ? 2.2 : 1.15} />;
        const age = daysFrom(s.date, today);
        const op = isLast ? 1 : Math.max(0.3, 1 - (0.7 * age) / span);
        return (
          <g key={s.id}>
            <circle
              className={"mk-dot" + (s.note && !mini ? " mk-dot--noted" : "") + (isLast ? " mk-dot--last" : "")}
              cx={s.x}
              cy={s.y}
              r={mini ? 5.2 : 3.6}
              opacity={op.toFixed(2)}
            />
            {onPick && (
              <circle className="mk-hit" cx={s.x} cy={s.y} r={8} onClick={() => onPick(s)}>
                <title>{`${fmtShortDate(s.date)} · ${LEVELS[s.level].name}`}</title>
              </circle>
            )}
            {selected === s.id && <circle className="mk-sel" cx={s.x} cy={s.y} r={7.5} />}
          </g>
        );
      })}
    </svg>
  );
}

// An arrow stuck in the target, its shaft back toward the archer.
export function ArrowIn({ x, y, scale = 1, className = "" }) {
  return (
    <g className={`mk-arrow${className ? ` ${className}` : ""}`} transform={`translate(${x} ${y}) scale(${scale})`}>
      <path className="shaft" d="M0,0L-24,10" />
      <path className="fl" d="M-17,7.1l-6.6,-5.4l-4.2,1.7l5.6,5.9z" />
      <path className="fl" d="M-17,7.1l-0.9,7.4l-4.2,1.7l-0.3,-7.3z" />
      <circle className="tip" r={2.6} />
    </g>
  );
}

// One quarter of the face, outside the bullseye.
function sectionPath(k) {
  const a0 = ((-90 + 90 * k) * Math.PI) / 180;
  const a1 = ((90 * k) * Math.PI) / 180;
  const p = (r, a) => `${r1(r * Math.cos(a))},${r1(r * Math.sin(a))}`;
  const inner = RINGS[0];
  return `M${p(inner, a0)}L${p(FACE, a0)}A${FACE},${FACE} 0 0 1 ${p(FACE, a1)}L${p(inner, a1)}A${inner},${inner} 0 0 0 ${p(inner, a0)}Z`;
}

function r1(v) {
  return Math.round(v * 10) / 10;
}

function daysFrom(date, today) {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000);
}
