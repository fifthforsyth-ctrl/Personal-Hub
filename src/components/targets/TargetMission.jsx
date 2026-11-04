import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TIERS, bowLine, bowProgress, inRange, tierOf } from "../../lib/mark";
import Bow, { BowRack } from "../mark/Bow";
import Gear from "../ascent/Gear";
import TargetFace from "../mark/TargetFace";

// The mission's page, under its statement: the bow earned by every
// bullseye so far (all four in a fold), the lifetime goals that climb
// toward it, and the quests and lessons that serve it straight, with no
// goal between. Each one a tap from its own page.
//
//   ladder   useLadder(): the range (bullseyes, goals) and the view
//   onWrite  opens the mission's sheet, when there's no mission yet

export default function TargetMission({ ladder, today, onWrite }) {
  const { view, range } = ladder;
  const bulls = range?.bullseyes ?? 0;
  const tier = tierOf(bulls);
  const direct = [
    ...(view?.quests ?? []).filter((q) => q.serves?.kind === "mission").map((q) => ({ key: q.id, kind: "Quest", title: q.title })),
    ...(view?.lessons ?? []).filter((l) => l.serves?.kind === "mission").map((l) => ({ key: l.id, kind: "Lesson", title: l.title })),
  ];

  return (
    <>
      {!view?.mission && (
        <section className="card tg-empty tg-empty--first">
          <p>Your mission is the summit: what every goal, quest and lesson below serves.</p>
          <div className="tg-empty__btns">
            <button type="button" className="btn btn--accent" onClick={onWrite}>
              Write your mission
            </button>
          </div>
        </section>
      )}

      <section className="card tg-bow" aria-labelledby="tg-bow-h">
        <div className="mk-bow-card__top">
          <Bow tier={tier} pull={0.5} width={58} height={88} />
          <div className="mk-bow-card__txt">
            <h2 className="eyebrow" id="tg-bow-h">
              Your bow
            </h2>
            <b>{TIERS[tier].name}</b>
            <span className="ascent-mini">{bowLine(bulls)}</span>
            <div className="mk-bar" aria-hidden="true">
              <i style={{ width: `${Math.round(bowProgress(bulls) * 100)}%` }} />
            </div>
          </div>
        </div>
        <details className="tg-fold">
          <summary className="tg-fold__sum">
            See all four
            <ChevronDown size={15} className="tg-fold__chev" aria-hidden="true" />
          </summary>
          <BowRack bullseyes={bulls} />
        </details>
      </section>

      <section className="card tg-list-card" aria-labelledby="tg-goals-h">
        <div className="tg-sec__head">
          <h2 className="eyebrow" id="tg-goals-h">
            Lifetime goals
          </h2>
          <span className="ascent-mini">last 30 days</span>
        </div>
        {range?.goals.length ? (
          <ul className="tg-links">
            {range.goals.map((t) => {
              const n = inRange(t.shots, today, "30").length;
              return (
                <li key={t.key}>
                  <Link to={`/targets/${t.key}`} className="tg-link">
                    <TargetFace target={t} today={today} range="30" mini arrow className="tg-link__face" />
                    <span className="tg-link__name">
                      <Gear name={t.icon} size={14} />
                      {t.short}
                    </span>
                    <span className="tg-link__n">{n} of 30 days</span>
                    <ChevronRight size={15} className="tg-link__go" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="tg-quiet">Your lifetime goals are the top goals of your goal wheel. There aren't any yet.</p>
        )}
      </section>

      {direct.length > 0 && (
        <section className="card tg-list-card" aria-labelledby="tg-direct-h">
          <div className="tg-sec__head">
            <h2 className="eyebrow" id="tg-direct-h">
              Serving it straight
            </h2>
            <span className="ascent-mini">no goal between</span>
          </div>
          <ul className="tg-links">
            {direct.map((c) => (
              <li key={c.key}>
                <Link to={`/targets/${c.key}`} className="tg-link tg-link--plain">
                  <span className="tg-link__kind">{c.kind}</span>
                  <span className="tg-link__name">{c.title}</span>
                  <ChevronRight size={15} className="tg-link__go" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
