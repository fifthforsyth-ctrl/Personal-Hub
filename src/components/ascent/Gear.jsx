// Line icons for the Ascent page: the gear a climber carries stands for each
// lifetime goal (an ice axe for skill, a compass for being in tune with God,
// a map for learning, a coil of rope for selflessness, a boot for
// discipline), plus the tent, the trail sign and the summit.

const PATHS = {
  compass: (
    <>
      <circle cx="10" cy="10" r="7.6" />
      <path d="M13 7 11 11 7 13 9 9Z" />
    </>
  ),
  boot: (
    <>
      <path d="M5 2.8h5.6l.4 6.4 4.4 1.6c1.5.6 2.4 1.9 2.4 3.4v1.9H5Z" />
      <path d="M5 13.4h12.8" />
      <path d="M7.6 5.6h3M7.6 8.2h3.2" />
      <path d="M5 16.1v.9h12.8v-.9" />
    </>
  ),
  rope: (
    <>
      <ellipse cx="10" cy="6" rx="6.5" ry="2.6" />
      <ellipse cx="10" cy="9.6" rx="6.5" ry="2.6" />
      <ellipse cx="10" cy="13.2" rx="6.5" ry="2.6" />
      <path d="M16.5 13.2c0 2.3.6 3.7 1.6 4.6" />
    </>
  ),
  axe: (
    <g transform="rotate(30 10 10)">
      <path d="M10 5v13.5" />
      <path d="M5 4.2h6.6c2.4 0 4.6 1.2 5.6 3.4" />
      <path d="M5 2.8v2.8h2" />
    </g>
  ),
  map: (
    <>
      <path d="M2.8 5.2 7.4 3.4l5.2 1.8 4.6-1.8v11.4l-4.6 1.8-5.2-1.8-4.6 1.8Z" />
      <path d="M7.4 3.4v11.4M12.6 5.2v11.4" />
    </>
  ),
  tent: (
    <>
      <path d="M2 17 10 3.5 18 17Z" />
      <path d="M10 3.5V17" />
      <path d="M8 17l2-4.4 2 4.4" />
    </>
  ),
  sign: (
    <>
      <path d="M10 18.5V1.8" />
      <path d="M10 3.8h5.6l2 2-2 2H10" />
      <path d="M10 10H4.4l-2 2 2 2H10" />
    </>
  ),
  summit: (
    <>
      <path d="M1.5 17.5 8.7 6.2l2.4 3.6 1.6-2.2 5.8 9.9Z" />
      <path d="M8.7 6.2V1.6" />
      <path d="M8.7 1.9h4l-1.1 1.5 1.1 1.5h-4" />
    </>
  ),
};

export default function Gear({ name, size = 17, className = "" }) {
  return (
    <svg
      className={`gear${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name] ?? PATHS.tent}
    </svg>
  );
}
