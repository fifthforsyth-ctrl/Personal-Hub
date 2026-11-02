import { ChevronDown } from "lucide-react";
import { TIERS, bowLine, bowProgress, tierOf } from "../../lib/mark";
import Bow, { BowRack } from "../mark/Bow";

// Your bow, as the Range showed it: the bow you shoot with now, how many
// bullseyes it's taken, and how far to the next. All four bows fold away
// under it.
export function BowCard({ bullseyes = 0 }) {
  const tier = tierOf(bullseyes);
  return (
    <section className="card ov-bow" aria-labelledby="ov-bow-h">
      <div className="mk-bow-card__top">
        <Bow tier={tier} pull={0.5} width={58} height={88} />
        <div className="mk-bow-card__txt">
          <h2 className="eyebrow" id="ov-bow-h">
            Your bow
          </h2>
          <b>{TIERS[tier].name}</b>
          <span className="ascent-mini">{bowLine(bullseyes)}</span>
          <div className="mk-bar" aria-hidden="true">
            <i style={{ width: `${Math.round(bowProgress(bullseyes) * 100)}%` }} />
          </div>
        </div>
      </div>
      <details className="ov-fold ov-fold--rack">
        <summary>
          <span>See all four</span>
          <ChevronDown size={15} className="ov-fold__chev" aria-hidden="true" />
        </summary>
        <BowRack bullseyes={bullseyes} />
      </details>
    </section>
  );
}
