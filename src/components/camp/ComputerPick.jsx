import { Monitor } from "lucide-react";

// On a quest's Today (0092, Aaron 2026-10-28), a step, section or line can
// be handed to one of his computers. These are the pieces a row wears there.

// Which computer it's handed to, in its open row: one pill per computer and
// one for no one.
export function ComputerPick({ value, options, onChange }) {
  const all = [{ n: null, name: "Not assigned" }, ...options];
  return (
    <div className="field tb-pc-pick" role="radiogroup" aria-label="Computer">
      <span>Computer</span>
      <div className="tb-pc-pick__opts">
        {all.map((c) => (
          <button
            key={c.n ?? "none"}
            type="button"
            role="radio"
            aria-checked={(value ?? null) === c.n}
            className={"tb-pc-opt" + ((value ?? null) === c.n ? " on" : "")}
            onClick={() => (value ?? null) !== c.n && onChange(c.n)}
          >
            {c.n != null && <Monitor size={13} aria-hidden="true" />}
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// "Working on" (the top card in a computer's column, with a live pulse) or
// "On deck" (the next), worn at the top of the card; or the computer it's
// handed to ("pc"), where the columns don't say.
export function CardBadge({ badge }) {
  if (!badge) return null;
  return (
    <span className={`tb-badge tb-badge--${badge.kind}`}>
      {badge.kind === "working" && <i className="camp-working__pulse" aria-hidden="true" />}
      {badge.kind === "pc" && <Monitor size={11} aria-hidden="true" />}
      {badge.label}
    </span>
  );
}
