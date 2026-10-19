import { useMemo } from "react";
import { questLayout, climberAt } from "../../lib/ascent";
import { rng, rough, poly, rounded, roundedPoints, measure, r1 } from "./draw";

// A quest's trail: from the base up its little mountain, switching back at
// each camp, to the summit. Reached camps fly a flag and the walked part of
// the trail is orange. `planted` is the camp whose flag was just planted,
// so it springs up once.
export default function QuestTrail({ quest, state, planted = null }) {
  const n = state.camps.length;
  const geo = useMemo(() => {
    const L = questLayout(n);
    const trail = measure(roundedPoints(L.turns, 9));
    const turnAt = L.turns.map((t, i) => (i === 0 ? 0 : i === L.turns.length - 1 ? 1 : trail.nearest(t)));
    return {
      ...L,
      trail,
      turnAt,
      d: rounded(L.turns, 9),
      ridgeD: `${poly(rough(L.ridge, rng(4), 2, 0.04, 14))}Z`,
      spineD: poly(rough(L.spine, rng(9), 2, 0.05)),
    };
  }, [n]);

  const f = climberAt(state, geo.turnAt);
  const you = geo.trail.pointAt(f);
  const label = state.done
    ? `${quest.title}: the summit is reached.`
    : `${quest.title}: ${state.reached} of ${n} camp${n === 1 ? "" : "s"} reached.`;

  return (
    <svg className="qtrail" viewBox={`0 0 ${geo.W} ${geo.H}`} role="img" aria-label={label}>
      <path className="qt-ridge" d={geo.ridgeD} />
      <path className="qt-spine" d={geo.spineD} />
      <line className="qt-ground" x1="0" y1={geo.ground} x2={geo.W} y2={geo.ground} />
      <path className="tp-ahead" d={geo.d} />
      <path className="tp-walked" d={geo.d} style={{ strokeDasharray: `${r1(geo.trail.length * f)} ${r1(geo.trail.length + 20)}` }} />
      {geo.turns.map((t, i) => {
        const last = i === geo.turns.length - 1;
        const reached = i === 0 || (last ? state.done : Boolean(state.camps[i - 1]?.reached_on));
        const [x, y] = geo.trail.pointAt(geo.turnAt[i]).map(r1);
        const right = i % 2 === 1 || last;
        const name = i === 0 ? "Base" : last ? "Summit" : `Camp ${i}`;
        const title = i === 0 ? "Base camp" : last ? quest.title : state.camps[i - 1]?.title;
        return (
          <g key={i} className={"tp-camp" + (reached ? " reached" : "")}>
            <title>{title}</title>
            <circle cx={x} cy={y} r={i === 0 ? 4 : 5} />
            {reached && i > 0 && (
              <>
                <path className="pole" d={`M${x},${r1(y - 5)}v-13`} />
                <path className={"flag" + (planted === i ? " plant" : "")} d={`M${r1(x + 0.7)},${r1(y - 18)}h9.5l-2.5,3.4 2.5,3.4h-9.5z`} />
              </>
            )}
            <text x={r1(x + (right ? 10 : -10) + (last && reached ? 10 : 0))} y={r1(y + 3.6)} textAnchor={right ? "start" : "end"}>
              {name}
            </text>
          </g>
        );
      })}
      <g className="tp-you" style={{ transform: `translate(${r1(you[0])}px, ${r1(you[1])}px)` }}>
        <circle className="halo" r="11" />
        <circle className="core" r="5.5" />
      </g>
    </svg>
  );
}
