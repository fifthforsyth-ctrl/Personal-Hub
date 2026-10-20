import { useState } from "react";
import { DONE_KIND, fsUrl } from "../../lib/temple";
import { fmtShortDate } from "./format";

// One little figure for every person you've done work for, however many
// ordinances that was. Your direct line is orange. Dotted outlines are the
// people on your next trip, waiting to join.

export function Figure({ gender }) {
  return gender === "F" ? (
    <svg viewBox="0 0 26 40" aria-hidden="true">
      <circle cx="13" cy="8" r="5.2" />
      <path d="M13 15c-4.6 0-7 3-7.6 7L3.5 39h19l-1.9-17c-.6-4-3-7-7.6-7z" />
    </svg>
  ) : (
    <svg viewBox="0 0 26 40" aria-hidden="true">
      <circle cx="13" cy="8" r="5.4" />
      <path d="M5 39V24c0-5 3.4-8.6 8-8.6s8 3.6 8 8.6v15z" />
    </svg>
  );
}

export default function Crowd({ crowd, ghosts = [] }) {
  const [sel, setSel] = useState(null);
  const picked = crowd.people.find((p) => p.pid === sel);

  return (
    <section className="card">
      <div className="eyebrow">People you've done work for</div>
      <div className="crowd-count">
        <span className="crowd-count__n">{crowd.people.length}</span>
        <span className="crowd-count__sub">
          people · {crowd.ordinances} ordinances{crowd.since ? ` since ${fmtShortDate(crowd.since, true)}` : ""}
          {crowd.direct > 0 && (
            <>
              <br />
              {crowd.direct} in your direct line, in orange
            </>
          )}
        </span>
      </div>
      <div className="crowd" role="list" aria-label="People you've done work for">
        {crowd.people.map((p) => (
          <button
            key={p.pid}
            type="button"
            role="listitem"
            className={"fig" + (p.in_pedigree ? " fig--direct" : "") + (sel === p.pid ? " fig--sel" : "")}
            aria-label={p.name}
            aria-pressed={sel === p.pid}
            onClick={() => setSel(sel === p.pid ? null : p.pid)}
          >
            <Figure gender={p.gender} />
          </button>
        ))}
        {ghosts.map((g) => (
          <span key={g.key} className="fig fig--ghost" aria-hidden="true">
            <Figure gender={g.gender} />
          </span>
        ))}
      </div>
      <div className="crowd-detail">
        {picked ? (
          <>
            <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
              <b>{picked.name}</b>
              <a className="t-fs" href={fsUrl(picked.pid)} target="_blank" rel="noopener noreferrer">
                {picked.pid} ↗
              </a>
            </div>
            <div className="muted">
              {picked.lifespan}
              {picked.in_pedigree ? " · your direct line" : ""}
            </div>
            {picked.ordinances.map((o, i) => (
              <div key={i} className="muted">
                {DONE_KIND[o.type] ?? o.type} · {o.temple} · {fmtShortDate(o.date, true)}
              </div>
            ))}
          </>
        ) : (
          <span className="muted">
            {crowd.people.length
              ? `Tap anyone to see who they are and what you did.${ghosts.length ? ` Dotted outlines are the ${ghosts.length} people on your next trip.` : ""}`
              : "Each person you finish work for joins here."}
          </span>
        )}
      </div>
    </section>
  );
}
