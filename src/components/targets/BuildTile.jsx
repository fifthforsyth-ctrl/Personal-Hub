import { Link } from "react-router-dom";
import { buildNow } from "../quests/FloatingBuild";
import Painting from "../../village/Painting";

// The build going up in the village, small, at the top right of a quest's
// or a lesson's page on a phone (Aaron: "at the top right I see the
// building that is being built from the village"). The same three states
// as the full card (FloatingBuild.jsx), which takes its place on a desk:
// going up ("N more"), standing today (choose the next), or nothing going
// up (choose one). Its "N today" opens everything finished today.
//
//   village    villageOf() over what the page has, kept in step as he ticks
//   todayDone  how many tasks were finished today, on any quest
//   onToday    opens the list of them
//   waiting    the lists are still loading: a quiet box holds the place
export default function BuildTile({ village, today, todayDone = 0, onToday, waiting = false }) {
  if (waiting) {
    return (
      <div className="tg-build tg-build--wait" aria-hidden="true">
        <span className="tg-build__pic" />
      </div>
    );
  }

  const p = buildNow(village, today);
  const todayBtn =
    todayDone > 0 ? (
      <button
        type="button"
        className="qs-done-btn tg-build__today"
        aria-haspopup="dialog"
        aria-label={`${todayDone} done today. See everything finished today`}
        onClick={onToday}
      >
        {todayDone} today
      </button>
    ) : null;

  if (!p) {
    return (
      <div className="tg-build tg-build--none">
        <Link to="/village?choose" className="tg-build__pic tg-build__plot" aria-label="Nothing is going up in the village. Choose your next build">
          <span className="qs-plot" aria-hidden="true" />
        </Link>
        <span className="tg-build__line">
          <Link to="/village?choose" className="tg-build__go">
            Choose a build
          </Link>
          {todayBtn}
        </span>
      </div>
    );
  }

  const stands = p.complete;
  const left = Math.max(0, (p.need ?? 0) - (p.done ?? 0));
  return (
    <div className={"tg-build" + (stands ? " tg-build--stands" : "")}>
      <Link
        to={`/village?build=${p.id}`}
        className="tg-build__pic"
        aria-label={`${stands ? "Stands today" : "Building now"}: the ${p.name.toLowerCase()}. See it in the village`}
        title={p.name}
      >
        {/* Its own slot: painted this small, it mustn't stand in for the full card's picture. */}
        <Painting slot="targets:build-tile" kind={p.kind} done={p.done} need={p.need} live idle stands={stands} aspect="fit" className="tg-build__host" />
      </Link>
      <span className="tg-build__line">
        {stands ? (
          <Link to="/village?choose" className="tg-build__go">
            Choose the next
          </Link>
        ) : (
          <span>{left} more</span>
        )}
        {todayBtn}
      </span>
    </div>
  );
}
