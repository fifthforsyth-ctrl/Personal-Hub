import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { countLine } from "../../lib/questTasks";

// The build going up in the village, floating at the top of every quest's
// list: the same drawing as the village, turning slowly on its own plate,
// with how many tasks it has and how many it still needs. Every task he
// ticks, on any quest or lesson, lays its bricks on it here as he watches
// (today's in orange), until it stands; then it asks what to build next.
//
// `village` is villageOf() over what the page has, kept in step as he ticks.
// The drawing (three.js) loads the first time this shows, so the list never
// waits on it.

// Where it stands: the build going up, or the one that stood today, or null.
export function buildNow(village, today) {
  if (!village) return null;
  if (village.current >= 0) return village.projects[village.current];
  const last = village.projects[village.projects.length - 1];
  return last && last.complete && last.finishedOn === today ? last : null;
}

function counts(p, today) {
  const done = p?.done ?? 0;
  const laid = p ? p.items.filter((i) => i.laid === today).length : 0;
  return { done, laid, need: p?.need ?? 0, left: p ? Math.max(0, p.need - done) : 0 };
}

function Bar({ done, laid, need }) {
  const base = need ? ((done - laid) / need) * 100 : 0;
  const now = need ? (laid / need) * 100 : 0;
  return (
    <span className="qs-bar" aria-hidden="true">
      <i style={{ width: `${base}%` }} />
      <i className="qs-bar__today" style={{ width: `${now}%` }} />
    </span>
  );
}

export default function FloatingBuild({ village, today, onAway }) {
  const p = buildNow(village, today);
  const { done, laid, need, left } = counts(p, today);
  const card = useRef(null);
  const host = useRef(null);
  const engine = useRef(null);
  const latest = useRef(null);
  latest.current = { village, p, done, laid };
  const drawKey = p ? `${p.id}:${p.kind}:${p.seed}:${p.need}` : null;

  // The drawing, made again only when the build itself changes.
  useEffect(() => {
    if (!drawKey) return undefined;
    let dead = false;
    let v = null;
    import("../../village/engine")
      .then(({ mountVillage }) => {
        const now = latest.current;
        if (dead || !host.current || !now.p) return;
        v = mountVillage(
          host.current,
          { solo: true, today, day0: now.village.day0, days: now.village.days, projects: [now.p], current: 0, nextPlot: now.p.plot + 1, waiting: 0, arrows: [], bullseyes: [], villagers: [] },
          {}
        );
        engine.current = v;
        v.setDone(now.done, now.laid);
      })
      .catch((err) => console.warn("The floating build couldn't load", err));
    return () => {
      dead = true;
      engine.current = null;
      v?.destroy();
    };
  }, [drawKey, today]);

  // A tick lays its bricks without drawing it all again.
  useEffect(() => {
    engine.current?.setDone(done, laid);
  }, [done, laid]);

  // Out of sight, the page shows the slim bar instead.
  useEffect(() => {
    const el = card.current;
    if (!el || !window.IntersectionObserver || !onAway) return undefined;
    const io = new IntersectionObserver((es) => onAway(!es[es.length - 1].isIntersecting), { threshold: 0, rootMargin: "-40px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [onAway]);

  if (!p) {
    const waiting = village?.waiting ?? 0;
    return (
      <section ref={card} className="card qs-build qs-build--none" id="qs-build" aria-labelledby="qs-build-h">
        <span className="qs-plot" aria-hidden="true" />
        <div className="qs-build__text">
          <span className="eyebrow">{village?.projects.length ? "Nothing going up" : "Your village"}</span>
          <h2 className="qs-build__name" id="qs-build-h">
            Choose your next build
          </h2>
          <p className="qs-build__line">
            {waiting
              ? `${countLine(waiting, "finished task is", "finished tasks are")} waiting to lay the first bricks.`
              : "An armory, a chapel, a fortress… every task you finish lays its bricks on it."}
          </p>
          <Link to="/village?choose" className="btn btn--sm btn--accent qs-build__go">
            Choose a build
          </Link>
        </div>
      </section>
    );
  }

  const stands = p.complete;
  return (
    <section ref={card} className={"card qs-build" + (stands ? " qs-build--stands" : "")} id="qs-build" aria-labelledby="qs-build-h">
      <Link to={`/village?build=${p.id}`} className="qs-build__scene" aria-label={`See the ${p.name.toLowerCase()} in the village`}>
        <div ref={host} className="qs-build__host" />
      </Link>
      <div className="qs-build__text">
        <span className="eyebrow">{stands ? "Stands today" : "Building now"}</span>
        <h2 className="qs-build__name" id="qs-build-h">
          {p.name}
        </h2>
        <div className="qs-build__count">
          <b>{done}</b>
          <span>of {countLine(need, "task", "tasks")}</span>
        </div>
        <Bar done={done} laid={laid} need={need} />
        <p className="qs-build__line">
          {stands ? (
            "Every brick is laid."
          ) : (
            <>
              {left} more and it stands
              {laid > 0 && <span className="qs-build__today"> · {laid} today</span>}
            </>
          )}
        </p>
        {stands && (
          <Link to="/village?choose" className="btn btn--sm btn--accent qs-build__go">
            Choose the next build
          </Link>
        )}
      </div>
    </section>
  );
}

// The slim bar that stays at the top of the list while the card is scrolled
// away: the build, what's left, and the same bar. Tapping it goes back up.
export function BuildMini({ village, today, show }) {
  const p = buildNow(village, today);
  if (!p) return <div className="qs-mini" aria-hidden="true" />;
  const { done, laid, need, left } = counts(p, today);
  return (
    <div className={"qs-mini" + (show ? " on" : "")} aria-hidden={!show}>
      <button
        type="button"
        className="qs-mini__bar"
        tabIndex={show ? 0 : -1}
        onClick={() => document.getElementById("qs-build")?.scrollIntoView({ behavior: "smooth", block: "center" })}
      >
        <span className="qs-mini__name">{p.name}</span>
        <Bar done={done} laid={laid} need={need} />
        <span className="qs-mini__left">{p.complete ? "Stands" : `${left} left`}</span>
      </button>
    </div>
  );
}
