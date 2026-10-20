import { useMemo } from "react";
import { familyFacts, STORIES } from "../../lib/temple";

// Your family in numbers: how many people, how many years they lived
// between them, where they were born, and a few stories from the tree.

const fmt = (n) => n.toLocaleString("en-US");

export default function Facts({ people, onPerson }) {
  const f = useMemo(() => familyFacts(people), [people]);
  const pids = useMemo(() => new Set(people.map((p) => p.pid)), [people]);
  const stories = STORIES.filter((s) => s.pids.every((p) => pids.has(p)));
  if (!f.people) return null;

  const maxDecade = Math.max(1, ...f.byDecade.map((d) => d.n));
  const first = f.byDecade[0]?.decade ?? 1700;
  const last = f.byDecade[f.byDecade.length - 1]?.decade ?? 2020;
  const ticks = [0, 1, 2, 3, 4].map((i) => Math.round((first + ((last - first) * i) / 4) / 5) * 5);
  const topCountries = f.countries.slice(0, 10);
  const maxCountry = Math.max(1, ...topCountries.map(([, n]) => n));

  const person = (p) =>
    p ? (
      <button type="button" className="btn-link" style={{ fontWeight: 650, color: "var(--text)" }} onClick={() => onPerson(p.pid)}>
        {p.name}
      </button>
    ) : null;

  return (
    <>
      <div className="eyebrow" style={{ margin: "2px 2px -4px" }}>
        Your family in numbers
      </div>
      <div className="t-facts">
        <div className="card t-fact">
          <div className="t-fact__n">
            {fmt(f.people)}
            <small>people</small>
          </div>
          <p>
            {f.people >= 380 && f.people <= 440 ? "About a full jumbo jet. A 747 seats around 400. " : ""}
            <b>{fmt(f.completed)}</b> of them have all their work done.
          </p>
        </div>
        <div className="card t-fact">
          <div className="t-fact__n">
            {fmt(f.yearsLived)}
            <small>years lived</small>
          </div>
          <p>
            The combined lives of the {fmt(f.withBothDates)} people with both dates.
            {f.yearsLived > 15000 ? " End to end, they reach back to the last Ice Age." : ""}
          </p>
        </div>
        {f.earliest && (
          <div className="card t-fact t-fact--wide">
            <div className="t-fact__n">
              {f.span}
              <small>years back</small>
            </div>
            <p>
              Your tree reaches back to {person(f.earliest.person)}, born {f.earliest.year}
              {f.earliest.person.birth_place ? ` in ${f.earliest.person.birth_place}` : ""}.
            </p>
            <div className="t-hist" aria-label="Births by decade">
              {f.byDecade.map((d) => (
                <i key={d.decade} style={{ height: d.n ? `${Math.max(3, (d.n / maxDecade) * 100)}%` : 0 }} title={`${d.decade}s: ${d.n}`} />
              ))}
            </div>
            <div className="t-axis">
              {ticks.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <p className="t-note">Births by decade. The further back you go, the more ancestors there are at once.</p>
          </div>
        )}
        <div className="card t-fact">
          <div className="t-fact__n">
            {fmt(f.aliveIn1776)}
            <small>alive in 1776</small>
          </div>
          <p>That many of your ancestors were living on July 4, 1776.</p>
        </div>
        {f.averageLife && (
          <div className="card t-fact">
            <div className="t-fact__n">
              {f.averageLife}
              <small>years, on average</small>
            </div>
            <p>
              Longest life: {person(f.longest.p)}, {f.longest.span[1] - f.longest.span[0]} ({f.longest.span[0]} to {f.longest.span[1]}). Shortest:{" "}
              {person(f.shortest.p)}, {f.shortest.span[1] - f.shortest.span[0]}
              {f.shortest.span[1] === 1918 ? ", who died in 1918, the year of the great flu" : ""}.
            </p>
          </div>
        )}
        {f.pioneers.length > 0 && (
          <div className="card t-fact">
            <h4>{f.pioneers.length} pioneers</h4>
            <p>Born somewhere else, died in Utah. They crossed oceans and plains to gather with the Saints.</p>
          </div>
        )}
        {stories.map((s) => (
          <div key={s.title} className="card t-fact">
            <h4>{s.title}</h4>
            <p>{s.text}</p>
            {s.route && (
              <div className="t-route">
                {s.route.map((r, i) => (
                  <span key={r} style={{ display: "contents" }}>
                    {i > 0 && <i>→</i>}
                    <span>{r}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="card t-fact t-fact--wide">
          <div className="eyebrow">Where they were born</div>
          <div className="t-bars">
            {topCountries.map(([c, n]) => (
              <div key={c} className="t-bar">
                <span>{c}</span>
                <span className="t-bar__track">
                  <b style={{ width: `${(n / maxCountry) * 100}%` }} />
                </span>
                <span className="t-bar__v">{n}</span>
              </div>
            ))}
          </div>
          {f.towns.length > 0 && (
            <p className="t-note">
              Busiest towns:{" "}
              {f.towns.slice(0, 3).map((t, i) => (
                <span key={t.town}>
                  {i > 0 ? ", " : ""}
                  <b style={{ color: "var(--text)" }}>{t.town}</b>, {t.region} ({t.n})
                </span>
              ))}
              .
            </p>
          )}
        </div>
      </div>
    </>
  );
}
