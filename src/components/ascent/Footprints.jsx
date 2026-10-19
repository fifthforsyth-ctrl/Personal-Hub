import { r1 } from "./draw";

// One footprint for each of the last 30 days, walking right toward today:
// ink where a focus was walked that day, a ghost where it wasn't, and
// today's in orange.
export default function Footprints({ prints, label }) {
  const n = prints.length;
  const slot = 9;
  return (
    <svg className="prints" viewBox={`0 0 ${n * slot} 15`} role="img" aria-label={label}>
      {prints.map((on, i) => {
        const up = i % 2 === 0;
        const cx = i * slot + 4.8;
        const cy = up ? 4.4 : 10.4;
        const cls = on ? (i === n - 1 ? "pr pr--today" : "pr") : "pr pr--off";
        return (
          <g key={i} className={cls} transform={`rotate(${up ? -7 : 7} ${r1(cx)} ${r1(cy)})`}>
            <ellipse cx={r1(cx + 1.3)} cy={r1(cy)} rx="2.6" ry="1.7" />
            <ellipse cx={r1(cx - 2.5)} cy={r1(cy)} rx="1.3" ry="1.25" />
          </g>
        );
      })}
    </svg>
  );
}
