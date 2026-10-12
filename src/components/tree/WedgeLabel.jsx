// Draws one wedge's title as lib/wheel's fitLabel laid it out, so both
// wheels print titles the same way. `id` has to be unique on the page: a
// curved line is text bound to an arc, found by id.
//
// The arcs never animate, even while their wedges do: Chrome lays text on
// an arc once and doesn't follow a CSS transition of its shape, so the
// titles stayed where the old layout had them after the wheel re-centered.
export default function WedgeLabel({ id, label, color }) {
  if (!label) return null;

  if (label.kind === "curved") {
    return label.lines.map((line, i) => {
      const arcId = `${id}-arc-${i}`;
      return (
        <g key={i}>
          <path id={arcId} d={line.d} fill="none" />
          <text className="wheel-label" fontSize={label.fontSize} fill={color}>
            <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
              {line.text}
            </textPath>
          </text>
        </g>
      );
    });
  }

  return label.lines.map((line, i) => (
    <text
      key={i}
      className="wheel-label"
      x={line.x}
      y={line.y}
      transform={line.rotate ? `rotate(${line.rotate}, ${line.x}, ${line.y})` : undefined}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={label.fontSize}
      fill={color}
    >
      {line.text}
    </text>
  ));
}
