// The bow, drawn in units where it stands 100 tall with the grip at 0,0 and
// the arrow pointing right. `pull` is 0 at rest and 1 at full draw. Each
// tier is its own bow: wood with its grain showing, a longbow with a wrapped
// grip, a recurve with a riser, and steel with rivets and orange tips.

export function BowShape({ tier = 0, pull = 0, arrow = false }) {
  const tall = tier === 1 ? 56 : 50;
  const tipX = -12 - 12 * pull;
  const tipY = -(tall - 4 * pull);
  const nx = pull > 0 ? -14 - 48 * pull : tipX;
  const recurve = tier >= 2;
  const width = tier === 1 ? 4.6 : tier === 3 ? 5.4 : 5.6;
  const core = tier === 1 ? 2 : 2.6;

  const limb = (sign) => {
    const y = (v) => sign * v;
    if (!recurve) return `M0,${y(-8)}C4,${y(-26)} ${r1(tipX * 0.4)},${y(tipY + 8)} ${r1(tipX)},${y(tipY)}`;
    return (
      `M0,${y(-13)}C3,${y(-28)} ${r1(tipX * 0.5)},${y(tipY + 10)} ${r1(tipX)},${y(tipY)}` +
      `Q${r1(tipX + 1)},${y(tipY - 6)} ${r1(tipX + 7)},${y(tipY - 7)}`
    );
  };
  const tip = nx + 84;

  return (
    <g className={`mk-bow mk-bow--${tier}`}>
      <path className="b-string" d={`M${r1(tipX)},${r1(tipY)}L${r1(nx)},0L${r1(tipX)},${r1(-tipY)}`} />
      {[1, -1].map((sign) => (
        <g key={sign}>
          <path className="b-limb" d={limb(sign)} strokeWidth={width} />
          <path className="b-core" d={limb(sign)} strokeWidth={core} strokeDasharray={tier === 0 ? "7 2.4" : undefined} />
          {tier === 3 && <circle className="b-tip" cx={r1(tipX + 7)} cy={r1(sign * (tipY - 7))} r={1.9} />}
        </g>
      ))}
      {recurve ? (
        <>
          <path className="b-riser" d="M-3.4,-15L3,-15L4.4,-4.5L1.2,-2.4L1.2,2.4L4.4,4.5L3,15L-3.4,15Z" />
          {tier === 3 && [-10, 10].map((y) => <circle key={y} className="b-rivet" cx={0} cy={y} r={1} />)}
        </>
      ) : (
        <>
          <rect className="b-grip" x={-3} y={-9} width={6} height={18} rx={2} />
          {tier === 1 && [-5, -1, 3].map((y) => <path key={y} className="b-wrap" d={`M-3,${y}l6,3`} />)}
        </>
      )}
      {arrow && (
        <>
          <path className="b-arrow" d={`M${r1(nx)},0H${r1(tip - 5)}`} />
          <path className="b-head" d={`M${r1(tip)},0l-7,-3.2v6.4z`} />
          <path className="b-fl" d={`M${r1(nx + 3)},-0.8l3,-4.2h7l-3,4.2z`} />
          <path className="b-fl" d={`M${r1(nx + 3)},0.8l3,4.2h7l-3,-4.2z`} />
        </>
      )}
    </g>
  );
}

// A bow in its own little picture.
export default function Bow({ tier = 0, pull = 0.5, width = 54, height = 82, className = "" }) {
  const arrow = pull > 0;
  return (
    <svg className={`mk-bow-pic${className ? ` ${className}` : ""}`} viewBox="-54 -75 104 152" width={width} height={height} aria-hidden="true">
      <BowShape tier={tier} pull={pull} arrow={arrow} />
    </svg>
  );
}

function r1(v) {
  return Math.round(v * 10) / 10;
}
