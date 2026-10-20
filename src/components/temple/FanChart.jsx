import { useMemo } from "react";
import { FAN_RADII, fanSlots } from "../../lib/temple";

// Nine generations as a half fan, you at the center, each wedge colored by
// FamilySearch's status for that person. Dotted wedges are ancestors nobody
// has found yet.

const KNOWN = new Set(["COMPLETED", "READY", "RESERVED", "RESERVED_SHARED_READY", "NEEDS_MORE_INFORMATION", "LIVING"]);
const CX = 180;
const CY = 184;

function wedge(r1, r2, a1, a2) {
  const pt = (r, a) => `${(CX + r * Math.cos(a)).toFixed(1)},${(CY - r * Math.sin(a)).toFixed(1)}`;
  return `M${pt(r1, a1)}L${pt(r2, a1)}A${r2},${r2} 0 0 1 ${pt(r2, a2)}L${pt(r1, a2)}A${r1},${r1} 0 0 0 ${pt(r1, a1)}Z`;
}

export default function FanChart({ people, selected, onSelect }) {
  const slots = useMemo(() => fanSlots(people), [people]);
  const root = people.find((p) => p.ahnentafel === 1);

  return (
    <svg className="t-fan" viewBox="0 0 360 196" role="img" aria-label="Your ancestors over nine generations, colored by temple status">
      {slots.map((s) => {
        const a1 = Math.PI - (s.i / s.n) * Math.PI;
        const a2 = Math.PI - ((s.i + 1) / s.n) * Math.PI;
        const d = wedge(FAN_RADII[s.g - 1], FAN_RADII[s.g], a1, a2);
        if (!s.person) return <path key={s.a} d={d} className="unknown" />;
        const st = KNOWN.has(s.person.rollup_status) ? s.person.rollup_status : "other";
        return (
          <path
            key={s.a}
            d={d}
            className={`fan--${st}${selected === s.person.pid ? " sel" : ""}`}
            onClick={() => onSelect(s.person.pid)}
          >
            <title>{s.person.name}</title>
          </path>
        );
      })}
      {root && (
        <path
          d={`M${CX - FAN_RADII[1]},${CY}A${FAN_RADII[1]},${FAN_RADII[1]} 0 0 1 ${CX + FAN_RADII[1]},${CY}Z`}
          className="fan--READY"
          onClick={() => onSelect(root.pid)}
        >
          <title>{root.name}</title>
        </path>
      )}
    </svg>
  );
}
