// The mark for a win: two longswords crossed, like a knight after the fight.
//
// Drawn on the same 24-unit grid as the other icons, so it sits in a button
// or a heading the way they do. Each sword is its own group, which is what
// lets the Win button swing them together when you tap it (the `clash` key
// restarts the swing, and the orange spark at the crossing flashes once).

// One sword, hilt at the bottom left, point at the top right. The other is
// the same sword mirrored.
function Sword() {
  return (
    <>
      <path d="M6.6 16.1 L18.1 4.9 L20.8 3.2 L19.1 5.9 L7.9 17.4 Z" fill="currentColor" />
      <path d="M4.6 14.6 L9.4 19.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 17 L4.4 19.6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="3.7" cy="20.3" r="1.25" fill="currentColor" />
    </>
  );
}

export default function Swords({ size = 20, clash = 0, className = "", title, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={"swords" + (clash ? " swords--clash" : "") + (className ? ` ${className}` : "")}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      {...rest}
    >
      <g key={`a${clash}`} className="swords__a">
        <Sword />
      </g>
      <g key={`b${clash}`} className="swords__b">
        <g transform="matrix(-1 0 0 1 24 0)">
          <Sword />
        </g>
      </g>
      {clash > 0 && (
        <g key={`s${clash}`} className="swords__spark" stroke="var(--accent, #f26a1b)" strokeWidth="1.6" strokeLinecap="round">
          <path d="M12 6.2 V4.6" />
          <path d="M15.4 7.4 L16.6 6.2" />
          <path d="M8.6 7.4 L7.4 6.2" />
        </g>
      )}
    </svg>
  );
}
