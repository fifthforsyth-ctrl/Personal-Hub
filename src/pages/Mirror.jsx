import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowRight, Moon, Briefcase, Users, Flag, Smile, Target, Wallet, HeartPulse } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchMirrorWeek } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { todayStr, addDays, parseDateStr, startOfWeek, fmtWeekHeading } from "../lib/planDates";
import { buildMirror, lastWeekStart, pieces, markMirrorSeen } from "../lib/mirror";
import { fmtClock } from "../lib/honest";
import { fmtMoney } from "../lib/money";
import LoadError from "../components/ui/LoadError";
import "../styles/mirror.css";

// The weekly mirror: last week, Sunday to Saturday, seen whole on one page.
//
// Sunday opens it from a line on Today and at the top of Week, just before
// the focus review; More opens it any day. Plain sentences and a few small
// charts, nothing scored: the point is to see the week clearly, not to
// judge it. ‹ › page back through earlier weeks, and forward as far as the
// week under way, which reads "so far".
//
// Everything here is worked out on the page from what's already recorded
// (src/lib/mirror.js); the mirror stores nothing of its own.

const ICONS = { mornings: Moon, work: Briefcase, people: Users, misses: Flag, mood: Smile, focus: Target, money: Wallet, practice: HeartPulse };
const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export default function Mirror() {
  const { user } = useAuth();
  const userId = user?.id;
  const today = todayStr();
  const thisWeek = startOfWeek(today);
  const [params, setParams] = useSearchParams();
  const weekStart = weekFrom(params.get("week"), today);

  const { data, error, loading, reload } = useLoad(() => (userId ? fetchMirrorWeek(userId, weekStart) : null), [userId, weekStart]);
  const mirror = useMemo(() => (data ? buildMirror({ ...data, weekStart, today }) : null), [data, weekStart, today]);

  // Once a week has been looked at, Sunday's line on Today has done its job.
  useEffect(() => {
    if (mirror) markMirrorSeen(mirror.weekStart);
  }, [mirror]);

  const current = weekStart === thisWeek;
  const go = (start) => setParams(start === lastWeekStart(today) ? {} : { week: start }, { replace: true });
  // Sunday, looking at the week just ended: the next thing is planning.
  const planNext = parseDateStr(today).getDay() === 0 && weekStart === lastWeekStart(today);

  return (
    <div className="page mirror">
      <div className="mirror-head">
        <button
          type="button"
          className="btn-icon btn-icon--bordered"
          onClick={() => go(addDays(weekStart, -7))}
          aria-label="The week before"
          title="Previous week"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="mirror-head__text">
          <div className="eyebrow">{current ? "Weekly mirror · so far" : "Weekly mirror"}</div>
          <h1 className="page-title">{fmtWeekHeading(weekStart)}</h1>
        </div>
        <button
          type="button"
          className="btn-icon btn-icon--bordered"
          onClick={() => go(addDays(weekStart, 7))}
          disabled={current}
          aria-label="The week after"
          title="Next week"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {error && <LoadError what="the week" error={error} onRetry={reload} stale={Boolean(data)} />}

      {!mirror && !error && (loading || !data) && <p className="mirror-loading">Loading…</p>}

      {mirror &&
        (mirror.sections.length ? (
          <div className="mirror-grid">
            {mirror.sections.map((s) => (
              <Section key={s.key} section={s} weekStart={weekStart} />
            ))}
          </div>
        ) : (
          <div className="card">
            <p className="mirror-empty">{current ? "Nothing recorded yet this week." : "Nothing was recorded this week."}</p>
          </div>
        ))}

      {mirror && planNext && (
        <Link to="/plan" className="mirror-next">
          On to the week ahead
          <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}

// A week from the address (?week=2026-10-04), or the last whole week. Any
// day finds its week; a week still to come isn't one to look back on.
function weekFrom(param, today) {
  const fallback = lastWeekStart(today);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(param ?? "") || Number.isNaN(parseDateStr(param).getTime())) return fallback;
  const start = startOfWeek(param);
  return start > startOfWeek(today) ? fallback : start;
}

function Section({ section, weekStart }) {
  const Icon = ICONS[section.key] ?? Moon;
  const id = `mirror-${section.key}`;
  return (
    <section className="card mirror-card" aria-labelledby={id}>
      <div className="card-head">
        <h2 className="card-title" id={id}>
          <Icon size={14} />
          {section.title}
        </h2>
      </div>
      {section.key === "mornings" && <NightChart chart={section.chart} />}
      {section.key === "work" && <WorkChart chart={section.chart} />}
      {section.key === "mood" && <MoodChart chart={section.chart} />}
      <ul className="mirror-lines">
        {section.lines.map((line, n) => (
          <li key={n} className="mirror-line">
            {pieces(line).map((p, i) => (p.bold ? <b key={i}>{p.text}</b> : <span key={i}>{p.text}</span>))}
          </li>
        ))}
      </ul>
      {section.key === "focus" && <FocusGoals goals={section.goals} />}
      {section.key === "money" && section.budgets.length > 0 && <Budgets section={section} />}
      {section.key === "practice" && section.chart && <WeightChart points={section.chart.weights} weekStart={weekStart} />}
    </section>
  );
}

// --- The small charts -------------------------------------------------------------
//
// Drawn at the width the card gives them, so their words stay the page's
// size on a phone and on a desk. Ink for what happened, greys for the rest.

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function Chart({ height, label, children }) {
  const [ref, width] = useWidth();
  return (
    <div className="mirror-chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          {children(width)}
        </svg>
      )}
    </div>
  );
}

// "9 pm", "12 am", "6 am" on the running night clock.
function hourLabel(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  return `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;
}

// Each night as a bar from lights out down to waking, under the morning it
// ended, with a dashed mark at the alarm on early days.
function NightChart({ chart }) {
  const points = chart?.points ?? [];
  const values = points.flatMap((p) => [p.out, p.wake, p.alarm]).filter((v) => v != null);
  if (!values.length) return null;
  const lo = Math.floor((Math.min(...values) - 20) / 60) * 60;
  const hi = Math.ceil((Math.max(...values) + 20) / 60) * 60;
  const span = (hi - lo) / 60;
  const step = (span <= 4 ? 1 : span <= 8 ? 2 : 3) * 60;
  const ticks = [];
  for (let m = Math.ceil(lo / step) * step; m <= hi; m += step) ticks.push(m);
  const H = 160;
  const top = 6;
  const bottom = 22;
  const left = 40;
  const right = 6;
  const early = points.some((p) => p.alarm != null);

  return (
    <>
      <Chart height={H} label="Each night, by the morning it ended: lights out to awake">
        {(W) => {
          const y = (m) => top + ((m - lo) / (hi - lo)) * (H - top - bottom);
          const col = (W - left - right) / 7;
          const x = (i) => left + col * (i + 0.5);
          const bar = Math.min(10, col * 0.34);
          return (
            <>
              {ticks.map((m) => (
                <g key={m}>
                  <line className="mirror-chart__grid" x1={left} x2={W - right} y1={y(m)} y2={y(m)} />
                  <text className="mirror-chart__label" x={left - 8} y={y(m) + 3.5} textAnchor="end">
                    {hourLabel(m)}
                  </text>
                </g>
              ))}
              {points.map((p, i) => (
                <g key={p.date}>
                  {p.alarm != null && <line className="mirror-chart__ref" x1={x(i) - col * 0.36} x2={x(i) + col * 0.36} y1={y(p.alarm)} y2={y(p.alarm)} />}
                  {p.out != null && p.wake != null && p.wake > p.out ? (
                    <rect className="mirror-chart__bar--all" x={x(i) - bar / 2} y={y(p.out)} width={bar} height={Math.max(bar, y(p.wake) - y(p.out))} rx={bar / 2} />
                  ) : (
                    [p.out, p.wake].filter((v) => v != null).map((v, k) => <circle key={k} className="mirror-chart__dot" cx={x(i)} cy={y(v)} r={3} />)
                  )}
                  <text className="mirror-chart__day" x={x(i)} y={H - 6} textAnchor="middle">
                    {LETTERS[i]}
                  </text>
                </g>
              ))}
            </>
          );
        }}
      </Chart>
      <div className="mirror-legend">
        <span className="mirror-legend__item">
          <span className="mirror-legend__swatch" style={{ background: "var(--ink)" }} />
          Lights out to awake
        </span>
        {early && (
          <span className="mirror-legend__item">
            <span className="mirror-legend__dash" />
            {chart.alarm ? `${fmtClock(chart.alarm)} alarm` : "Early alarm"}
          </span>
        )}
      </div>
    </>
  );
}

// "8.5h": a bar's hours, short enough to sit over it.
function shortHours(minutes) {
  return `${Math.round(minutes / 6) / 10}h`;
}

const WORK_KINDS = [
  ["deep", "Deep"],
  ["shallow", "Shallow"],
  ["other", "Not marked"],
];

// Work each day, deep at the bottom of the bar, then shallow, then what
// wasn't marked. With nothing marked at all, one plain bar a day.
function WorkChart({ chart }) {
  const days = chart?.days ?? [];
  const totals = days.map((d) => d.deep + d.shallow + d.other);
  const max = Math.max(0, ...totals);
  if (!max) return null;
  const marked = days.some((d) => d.deep + d.shallow > 0);
  const kinds = marked ? WORK_KINDS.filter(([k]) => days.some((d) => d[k] > 0)) : [["other", "Work"]];
  const H = 132;
  const top = 18;
  const bottom = 22;
  const scale = Math.max(max, 60);

  return (
    <>
      <Chart height={H} label="Hours of work each day">
        {(W) => {
          const col = W / 7;
          const bar = Math.min(18, col * 0.46);
          const base = H - bottom;
          const h = (m) => (m / scale) * (H - top - bottom);
          return (
            <>
              <line className="mirror-chart__grid" x1={0} x2={W} y1={base + 0.5} y2={base + 0.5} />
              {days.map((d, i) => {
                const cx = col * (i + 0.5);
                let at = base;
                const parts = kinds
                  .filter(([k]) => d[k] > 0)
                  .map(([k]) => {
                    const height = h(d[k]);
                    at -= height;
                    return <rect key={k} className={`mirror-chart__bar--${marked ? k : "all"}`} x={cx - bar / 2} y={at} width={bar} height={height} />;
                  });
                return (
                  <g key={d.date}>
                    {parts}
                    {totals[i] > 0 && (
                      <text className="mirror-chart__value" x={cx} y={at - 5} textAnchor="middle">
                        {shortHours(totals[i])}
                      </text>
                    )}
                    <text className="mirror-chart__day" x={cx} y={H - 6} textAnchor="middle">
                      {LETTERS[i]}
                    </text>
                  </g>
                );
              })}
            </>
          );
        }}
      </Chart>
      {marked && (
        <div className="mirror-legend">
          {kinds.map(([k, label]) => (
            <span key={k} className="mirror-legend__item">
              <svg width="9" height="9" aria-hidden="true">
                <rect className={`mirror-chart__bar--${k}`} width="9" height="9" rx="2" />
              </svg>
              {label}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

const ENERGY_LEVEL = { low: 1, okay: 2, high: 3 };

// Three short bars, filled from the bottom: low, okay, high.
function EnergyMark({ x, y, level }) {
  return [0, 1, 2].map((i) => (
    <rect key={i} className={"mirror-chart__seg" + (i < level ? " is-on" : "")} x={x - 5} y={y + (2 - i) * 4.5} width={10} height={3} rx={1} />
  ));
}

// Mood from 1 to 5 as a line across the days you rated it, and each day's
// energy under it.
function MoodChart({ chart }) {
  const points = chart?.points ?? [];
  const hasMood = points.some((p) => p.mood != null);
  const hasEnergy = points.some((p) => ENERGY_LEVEL[p.energy]);
  if (!hasMood && !hasEnergy) return null;
  const moodH = hasMood ? 86 : 0;
  const energyH = hasEnergy ? 22 : 0;
  const top = 6;
  const H = top + moodH + energyH + 22;
  const left = 22;

  return (
    <>
      <Chart height={H} label="Mood and energy each day">
        {(W) => {
          const col = (W - left) / 7;
          const x = (i) => left + col * (i + 0.5);
          const y = (v) => top + 4 + ((5 - v) / 4) * (moodH - 14);
          // Lines only between days next to each other; a day not rated
          // leaves a gap rather than a guess.
          const segments = [];
          points.forEach((p, i) => {
            const next = points[i + 1];
            if (p.mood != null && next?.mood != null) segments.push([i, p.mood, next.mood]);
          });
          return (
            <>
              {hasMood &&
                [5, 3, 1].map((v) => (
                  <g key={v}>
                    <line className="mirror-chart__grid" x1={left} x2={W} y1={y(v)} y2={y(v)} />
                    <text className="mirror-chart__label" x={left - 8} y={y(v) + 3.5} textAnchor="end">
                      {v}
                    </text>
                  </g>
                ))}
              {segments.map(([i, a, b2]) => (
                <line key={i} className="mirror-chart__line" x1={x(i)} x2={x(i + 1)} y1={y(a)} y2={y(b2)} />
              ))}
              {points.map((p, i) => (
                <g key={p.date}>
                  {p.mood != null && <circle className="mirror-chart__dot" cx={x(i)} cy={y(p.mood)} r={3.2} />}
                  {ENERGY_LEVEL[p.energy] && <EnergyMark x={x(i)} y={top + moodH + 4} level={ENERGY_LEVEL[p.energy]} />}
                  <text className="mirror-chart__day" x={x(i)} y={H - 6} textAnchor="middle">
                    {LETTERS[i]}
                  </text>
                </g>
              ))}
            </>
          );
        }}
      </Chart>
      <div className="mirror-legend">
        {hasMood && (
          <span className="mirror-legend__item">
            <span className="mirror-legend__line" />
            Mood, 1 to 5
          </span>
        )}
        {hasEnergy && (
          <span className="mirror-legend__item">
            <svg width="10" height="13" aria-hidden="true">
              <EnergyMark x={5} y={0} level={2} />
            </svg>
            Energy, low to high
          </span>
        )}
      </div>
    </>
  );
}

// Weight over the last eight weeks, with the week itself shaded.
function WeightChart({ points, weekStart }) {
  const values = points.map((p) => p.value);
  const lo = Math.floor(Math.min(...values) - 1);
  const hi = Math.ceil(Math.max(...values) + 1);
  const t = (date) => parseDateStr(date).getTime();
  const first = t(points[0].date);
  const last = Math.max(t(points[points.length - 1].date), first + 86400000);
  const H = 104;
  const top = 8;
  const bottom = 22;
  const left = 34;
  const right = 8;
  const short = (date, opts) => parseDateStr(date).toLocaleDateString("en-US", opts);
  const startLabel = short(points[0].date, { month: "short", day: "numeric" });
  // "Oct 11–17", or "Sep 27–Oct 3" across a month's end.
  const weekEnd = addDays(weekStart, 6);
  const sameMonth = weekStart.slice(0, 7) === weekEnd.slice(0, 7);
  const weekLabel = `${short(weekStart, { month: "short", day: "numeric" })}\u2013${short(weekEnd, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" })}`;

  return (
    <div className="mirror-weight">
      <Chart height={H} label="Weight over the last eight weeks">
        {(W) => {
          const x = (date) => left + ((t(date) - first) / (last - first)) * (W - left - right);
          const y = (v) => top + ((hi - v) / (hi - lo)) * (H - top - bottom);
          const band = Math.max(left, x(weekStart));
          const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
          return (
            <>
              <rect className="mirror-chart__band" x={band} y={top} width={Math.max(6, W - right - band)} height={H - top - bottom} rx={4} />
              {[hi, lo].map((v) => (
                <g key={v}>
                  <line className="mirror-chart__grid" x1={left} x2={W - right} y1={y(v)} y2={y(v)} />
                  <text className="mirror-chart__label" x={left - 8} y={y(v) + 3.5} textAnchor="end">
                    {v}
                  </text>
                </g>
              ))}
              <path className="mirror-chart__line" d={path} />
              {points.map((p) => (
                <circle key={p.date} className="mirror-chart__dot" cx={x(p.date)} cy={y(p.value)} r={2.6} />
              ))}
              <text className="mirror-chart__day" x={left} y={H - 6}>
                {startLabel}
              </text>
              <text className="mirror-chart__day" x={W - right} y={H - 6} textAnchor="end">
                {weekLabel}
              </text>
            </>
          );
        }}
      </Chart>
    </div>
  );
}

// --- Focus goals and budgets --------------------------------------------------------

// Each goal's seven days: filled where it moved, open where it didn't, grey
// where nobody asked.
function FocusGoals({ goals }) {
  const all = goals.flatMap((g) => g.days);
  const shown = [
    all.some((d) => d.moved === true) && ["is-moved", "Moved"],
    all.some((d) => d.moved === false) && ["is-not", "Didn't move"],
    all.some((d) => d.moved == null) && ["", "Not asked"],
  ].filter(Boolean);
  return (
    <>
      <div className="mirror-goals">
        {goals.map((g) => (
          <div key={g.id} className="mirror-goal">
            <span className="mirror-goal__title" title={g.title}>
              {g.title}
            </span>
            <span className="mirror-goal__days" role="img" aria-label={`Moved on ${g.movedDays} of ${g.answeredDays} days asked`}>
              {g.days.map((d) => (
                <i key={d.date} className={"mirror-goal__day" + (d.moved === true ? " is-moved" : d.moved === false ? " is-not" : "")} />
              ))}
            </span>
          </div>
        ))}
      </div>
      <div className="mirror-legend" style={{ marginTop: 12, marginBottom: 0 }}>
        {shown.map(([cls, label]) => (
          <span key={label} className="mirror-legend__item">
            <i className={"mirror-goal__day " + cls} />
            {label}
          </span>
        ))}
      </div>
    </>
  );
}

// Each budget the week touched: the month's spending against its limit as
// the week ended, and a mark at how far through the month that was.
function Budgets({ section }) {
  const money = (v) => fmtMoney(v, { round: true });
  const asOf = parseDateStr(section.asOf);
  const span = `${asOf.toLocaleDateString("en-US", { month: "short" })} 1 to ${asOf.getDate()}`;
  return (
    <div className="mirror-budgets">
      <div className="eyebrow">Budgets, {span}</div>
      {section.budgets.map((g) => (
        <div key={g.id}>
          <div className="mirror-budget__top">
            <span className="mirror-budget__name">{g.name}</span>
            <span className="mirror-budget__figure">
              {money(g.spent)} of {money(g.limit)}
            </span>
          </div>
          <span className="mirror-bar" role="img" aria-label={`${g.name}: ${money(g.spent)} of ${money(g.limit)}`}>
            <span className="mirror-bar__fill" style={{ width: `${Math.min(100, (g.spent / g.limit) * 100)}%` }} />
            <span className="mirror-bar__mark" style={{ left: `calc(${Math.min(100, section.progress * 100)}% - 1px)` }} />
          </span>
        </div>
      ))}
      <p className="mirror-foot" style={{ marginTop: 0 }}>
        The mark is how far through {section.month} the week ended.
      </p>
    </div>
  );
}
