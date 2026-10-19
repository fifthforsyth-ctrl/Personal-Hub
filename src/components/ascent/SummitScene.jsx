import { useEffect, useRef } from "react";
import { drawMountain } from "./draw";

// The mountain at the top of the page, with the mission's flag on the
// summit and you on the trail. Wide screens get the taller drawing with the
// flag's words beside it; on a phone the mission is written right under it.
function optionsFor(name) {
  return (W, H) =>
    W >= 600
      ? {
          seed: 7, sx: 0.66, top: Math.round(Math.max(48, H * 0.2)), bottom: 26, wl: 0.43, wr: 0.4, legs: 8, eTop: 0.84, r: 16,
          fig: 30, dot: 6, trees: 0.09, groves: 9, treeH: 11, treeline: 0.6,
          name, nameSub: "MY MISSION", pillSide: "left", animate: true, pill: "You",
          far: [{ x: 0.05, e: 0.34, w: 0.42 }, { x: 0.2, e: 0.46, w: 0.36 }, { x: 0.94, e: 0.5, w: 0.3 }],
          clouds: [{ x: 0.86, y: 0.28, s: 0.8 }],
        }
      : {
          seed: 11, sx: 0.71, top: 34, bottom: 10, wl: 0.6, wr: 0.42, legs: 6, eTop: 0.78, r: 9,
          fig: 20, dot: 5, trees: 0.14, groves: 5, treeH: 8, treeline: 0.6,
          name: null, pillSide: "right", animate: true, pill: "You",
          far: [{ x: 0.06, e: 0.36, w: 0.5 }], clouds: [],
        };
}

export default function SummitScene({ climb, name }) {
  const host = useRef(null);

  useEffect(() => {
    if (!host.current) return undefined;
    return drawMountain(host.current, Math.max(0, Math.min(1, climb)), optionsFor(name));
  }, [climb, name]);

  const pct = Math.round(climb * 100);
  return (
    <div
      ref={host}
      className="ascent-scene"
      role="img"
      aria-label={`A mountain with your mission's flag on the summit. You're ${pct}% of the way up the trail, as high as your lifetime goals are strong on average.`}
    />
  );
}
