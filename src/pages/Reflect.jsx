import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchTimeByCategory,
  fetchHabitStrength,
  fetchProductivityHeatmap,
  fetchReflectionTotals,
  fetchCategories,
  fetchPractice,
} from "../lib/api";
import { intensityColor } from "../lib/nodeStyle";
import { RankedBars, IntensityLegend, LineChart } from "../components/charts";
import { practiceSummary } from "../lib/honest";
import { fmtWeight } from "../components/today/WeighIn";
import { colorFor, familyFor, fmtMinutes, setCategoryColors } from "../lib/categories";
import {
  todayStr,
  addDays,
  addMonths,
  parseDateStr,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  fmtMonthYear,
  fmtShortDate,
  yearOf,
} from "../lib/planDates";
import { useLoad } from "../lib/useLoad";
import LoadError from "../components/ui/LoadError";
import "../styles/plan.css";

// Calendar ranges, not rolling ones: "this week" is Sunday to today, the
// same week the Week page shows, and a month is a month you can name.
const MODES = [
  { key: "this-week", label: "This week" },
  { key: "last-week", label: "Last week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// One measure (win rate), so one quiet hue — orange is kept for today and
// focus, and green would read as a verdict.
const HABIT_BAR = "var(--text-2)";

const num = (n) => Number(n || 0).toLocaleString();
const plural = (n, one, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;

// The dates a mode covers, cut off at today: the rest of this month hasn't
// happened, and counting it would make every current range look empty.
function rangeFor(mode, anchor, today) {
  if (mode === "this-week") {
    const start = startOfWeek(today);
    return { start, end: today, fullEnd: addDays(start, 6), title: "This week" };
  }
  if (mode === "last-week") {
    const start = addDays(startOfWeek(today), -7);
    const end = addDays(start, 6);
    return { start, end, fullEnd: end, title: "Last week" };
  }
  if (mode === "month") {
    const start = startOfMonth(anchor);
    const fullEnd = endOfMonth(anchor);
    return { start, end: fullEnd < today ? fullEnd : today, fullEnd, title: fmtMonthYear(anchor) };
  }
  const year = yearOf(anchor);
  const fullEnd = `${year}-12-31`;
  return { start: `${year}-01-01`, end: fullEnd < today ? fullEnd : today, fullEnd, title: String(year) };
}

function daysIn(start, end) {
  return Math.round((parseDateStr(end) - parseDateStr(start)) / 86400000) + 1;
}

// The long view over everything the app has collected: how the habits are
// holding, what got done, where the time went, and when the hours happen —
// with a written summary in place of a wall of numbers.
export default function Reflect() {
  const { user } = useAuth();
  const today = todayStr();
  const [mode, setMode] = useState("month");
  const [anchor, setAnchor] = useState(today);

  const range = rangeFor(mode, anchor, today);
  const dayCount = daysIn(range.start, range.end);
  const stepUnit = mode === "month" ? "month" : mode === "year" ? "year" : null;
  const offset =
    mode === "month"
      ? (yearOf(anchor) - yearOf(today)) * 12 + (parseDateStr(anchor).getMonth() - parseDateStr(today).getMonth())
      : mode === "year"
        ? yearOf(anchor) - yearOf(today)
        : 0;

  function step(direction) {
    setAnchor((d) => addMonths(d, direction * (mode === "year" ? 12 : 1)));
  }

  // Categories only once — they colour the bars and say which time was
  // sleep — and the four rollups for whatever range is showing.
  const categoriesRef = useRef(null);
  const { data, error, reload } = useLoad(async () => {
    const [totals, byCategory, habits, heatmap, categories, practice] = await Promise.all([
      fetchReflectionTotals(range.start, range.end),
      fetchTimeByCategory(range.start, range.end),
      fetchHabitStrength(range.start, range.end),
      fetchProductivityHeatmap(range.start, range.end),
      categoriesRef.current ?? (user?.id ? fetchCategories(user.id) : []),
      // Only one card: the rest of the page still shows if this fails.
      user?.id
        ? fetchPractice(user.id, range.start, range.end).catch((err) => {
            console.warn(err);
            return null;
          })
        : null,
    ]);
    if (!categoriesRef.current) {
      categoriesRef.current = categories;
      setCategoryColors(categories);
    }
    return { totals, byCategory, habits, heatmap, practice, dayCount, current: range.end === today };
  }, [range.start, range.end, user?.id]);

  // While a new range loads, the last one stays on screen, dimmed, rather
  // than the page collapsing to "Loading…" and jumping back to the top.
  const lastRef = useRef(null);
  if (data) lastRef.current = data;
  const shown = data ?? lastRef.current;
  const pending = !data;

  const totals = shown?.totals;
  const hasAnything =
    totals &&
    (Number(totals.logged_minutes) > 0 || totals.wins > 0 || totals.losses > 0 || totals.tasks_planned > 0 || totals.prayers > 0);

  const clipped = range.end !== range.fullEnd;
  const sub =
    (range.start === range.end ? fmtShortDate(range.start) : `${fmtShortDate(range.start)} – ${fmtShortDate(range.end)}`) +
    (clipped ? " · so far" : "");

  return (
    <div className="page">
      <div className="page-head">
        <div className="charts-head">
          <div className="eyebrow">Charts</div>
          <div className="charts-head__title">
            <h1 className="page-title" style={{ marginTop: 3 }}>{range.title}</h1>
            {stepUnit && (
              <div className="row" style={{ gap: 4 }}>
                <button
                  className="btn-icon btn-icon--bordered"
                  onClick={() => step(-1)}
                  aria-label={`Previous ${stepUnit}`}
                  title={`Previous ${stepUnit}`}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="btn-icon btn-icon--bordered"
                  onClick={() => step(1)}
                  disabled={offset >= 0}
                  aria-label={`Next ${stepUnit}`}
                  title={offset >= 0 ? `This is the current ${stepUnit}` : `Next ${stepUnit}`}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
          <p className="page-sub">{sub}</p>
          {stepUnit && offset < 0 && (
            <button className="btn-link" style={{ minHeight: 36 }} onClick={() => setAnchor(today)}>
              Back to this {stepUnit}
            </button>
          )}
        </div>

        {/* One filter row above the charts, never repeated per chart. */}
        <div className="seg plan-views" role="group" aria-label="Range">
          {MODES.map((m) => (
            <button
              key={m.key}
              className={"seg-btn" + (mode === m.key ? " active" : "")}
              aria-pressed={mode === m.key}
              onClick={() => setMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {error && !shown && <LoadError what="these charts" error={error} onRetry={reload} />}
      {error && shown && <LoadError stale error={error} onRetry={reload} className="plan-gap" />}
      {!shown && !error && <p className="empty">Reading the record…</p>}

      {shown && (
        <div style={{ opacity: pending ? 0.55 : 1, transition: "opacity 0.2s" }} aria-busy={pending}>
          {!hasAnything ? (
            <p className="empty">
              Nothing recorded in this range yet. Log a win, record a prayer, plan a day or track some time — this
              page fills itself in from what you record.
            </p>
          ) : (
            <>
              <StatTiles totals={totals} dayCount={shown.dayCount} />
              <Summary
                totals={totals}
                byCategory={shown.byCategory}
                habits={shown.habits}
                dayCount={shown.dayCount}
                current={shown.current}
              />
              <HabitChart rows={shown.habits} />
              <PracticeCard practice={shown.practice} />
              <CategoryChart rows={shown.byCategory} />
              <Heatmap rows={shown.heatmap} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Tag rows folded into one total per category, largest first.
function groupByCategory(rows) {
  const map = new Map();
  for (const r of rows ?? []) {
    const prev = map.get(r.category) ?? { category: r.category, minutes: 0, subs: [] };
    prev.minutes += Number(r.total_minutes) || 0;
    if (r.subcategory) prev.subs.push({ name: r.subcategory, minutes: Number(r.total_minutes) || 0 });
    map.set(r.category, prev);
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes);
}

// Written from the numbers, stated plainly — no praise, no scolding. It
// opens with what he cares about most (wins, prayer, what got done) and
// gets to time last; sleep is left out of "where it went", because "most
// of it went to Sleep" is true of every week and says nothing.
export function summarize({ totals, byCategory, habits, dayCount, current = true }) {
  const parts = [];

  if (totals.wins + totals.losses > 0) {
    parts.push(`You recorded ${plural(totals.wins, "win")} and ${plural(totals.losses, "loss", "losses")}.`);
    const weakest = [...habits].reverse().find((h) => h.losses > 0);
    const strongest = habits.find((h) => h.wins > 0);
    if (weakest && Number(weakest.win_rate) < 0.5) {
      parts.push(
        current
          ? `${weakest.habit_label} is the one giving the most trouble right now.`
          : `${weakest.habit_label} was the one giving the most trouble.`
      );
    } else if (strongest && habits.length > 1) {
      parts.push(current ? `${strongest.habit_label} is holding best.` : `${strongest.habit_label} held best.`);
    }
  }

  if (totals.prayers > 0) {
    parts.push(`${num(totals.prayers)} ${totals.prayers === 1 ? "prayer was" : "prayers were"} recorded.`);
  }

  if (totals.tasks_planned > 0) {
    const pct = Math.round((totals.tasks_done / totals.tasks_planned) * 100);
    parts.push(`Of ${plural(totals.tasks_planned, "planned task")}, you finished ${num(totals.tasks_done)} (${pct}%).`);
  }

  const awake = groupByCategory(byCategory).filter((g) => g.minutes > 0 && familyFor(g.category) !== "Rest");
  if (awake.length > 0) {
    const [first, second] = awake;
    parts.push(
      `Outside sleep, most of the tracked time went to ${first.category} (${fmtMinutes(first.minutes)})` +
        (second ? `, then ${second.category} (${fmtMinutes(second.minutes)}).` : ".")
    );
  }

  if (totals.days_logged > 0 && dayCount > 1) {
    parts.push(
      totals.days_logged >= dayCount
        ? "Time was tracked every day."
        : `Time was tracked on ${num(totals.days_logged)} of ${num(dayCount)} days.`
    );
  }

  return parts.join(" ");
}

function Summary(props) {
  const text = summarize(props);
  if (!text) return null;

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="card-head"><span className="card-title">The short version</span></div>
      <p className="prose" style={{ margin: 0, whiteSpace: "normal" }}>{text}</p>
    </div>
  );
}

// Headline numbers are not a chart — four plain tiles read faster than any
// plot of four values would. Wins and prayer first; time last.
function StatTiles({ totals, dayCount }) {
  const tiles = [
    { label: "Wins · losses", value: `${num(totals.wins)} · ${num(totals.losses)}` },
    { label: "Prayers", value: num(totals.prayers) },
    {
      label: "Tasks done",
      value: totals.tasks_planned > 0 ? `${num(totals.tasks_done)} of ${num(totals.tasks_planned)}` : "—",
    },
    {
      label: "Time tracked",
      value: fmtMinutes(totals.logged_minutes),
      foot: dayCount > 1 ? `on ${num(totals.days_logged)} of ${num(dayCount)} days` : null,
    },
  ];

  return (
    <div className="grid grid--stats charts-stats">
      {tiles.map((t) => (
        <div key={t.label} className="stat">
          <div className="stat-top"><span className="stat-label">{t.label}</span></div>
          <div className="stat-value">{t.value}</div>
          {t.foot && <div className="stat-foot">{t.foot}</div>}
        </div>
      ))}
    </div>
  );
}

// Ranked horizontal bars: one measure (minutes), so no legend — the
// category name labels each row directly, and the value sits at the end of
// its own bar rather than on a hover-only tooltip.
function CategoryChart({ rows }) {
  const grouped = useMemo(() => groupByCategory(rows), [rows]);
  const max = Math.max(...grouped.map((g) => g.minutes), 1);

  if (grouped.length === 0) return null;

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Where the time went</span>
        <span className="mono faint" style={{ fontSize: 11.5 }}>{plural(grouped.length, "category", "categories")}</span>
      </div>
      <RankedBars
        rows={grouped.map((g) => ({ key: g.category, value: g.minutes, color: colorFor(g.category) }))}
        format={fmtMinutes}
        max={max}
      />
      {grouped.some((g) => g.subs.length > 0) && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <div className="eyebrow" style={{ marginBottom: 7 }}>Broken down</div>
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            {grouped.flatMap((g) =>
              [...g.subs]
                .sort((a, b) => b.minutes - a.minutes)
                .map((sub) => (
                  <span key={`${g.category}-${sub.name}`} className="chip" style={{ fontSize: 10.5 }}>
                    <span className="dot" style={{ background: colorFor(g.category), width: 6, height: 6 }} />
                    {sub.name} · {fmtMinutes(sub.minutes)}
                  </span>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Ranked by consistency, not volume — strongest and weakest habits by how
// often they were won, not by raw hours. The win/loss split rides along as
// text rather than a second colour.
function HabitChart({ rows }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="card">
      <div className="card-head"><span className="card-title">Habit strength</span></div>
      <p className="card-note" style={{ marginTop: -6, marginBottom: 14 }}>
        Share of logged attempts that were wins. Information, not a verdict.
      </p>
      <RankedBars
        rows={rows.map((h) => ({ key: h.habit_label, value: Math.round((Number(h.win_rate) || 0) * 100), color: HABIT_BAR }))}
        format={(v) => `${v}%`}
        max={100}
      />
      <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 12 }}>
        {rows.slice(0, 8).map((h) => (
          <span key={h.habit_label} className="chip" style={{ fontSize: 10.5 }}>
            {h.habit_label} · {plural(h.wins, "win")}, {plural(h.losses, "loss", "losses")}
          </span>
        ))}
      </div>
    </div>
  );
}

const shortDay = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// The body and the practice in one card: temple visits (days with a Temple
// entry), workouts by kind and time of day, naps, how awake study was, and
// the weight trend. Counts, not targets.
function PracticeCard({ practice }) {
  const sum = useMemo(() => practiceSummary(practice?.entries), [practice]);
  const weights = practice?.weights ?? [];
  if (!practice) return null;
  const { exercise, naps, study } = sum;
  if (!sum.templeVisits && !exercise.total && !naps.count && !study.sessions && weights.length === 0) return null;

  const kinds = [
    exercise.run && `${num(exercise.run)} ${exercise.run === 1 ? "run" : "runs"}`,
    exercise.gym && `${num(exercise.gym)} gym`,
    exercise.other && `${num(exercise.other)} other`,
  ].filter(Boolean);
  const tiles = [
    { label: "Temple visits", value: num(sum.templeVisits) },
    {
      label: "Workouts",
      value: num(exercise.total),
      foot: exercise.total ? [kinds.join(", "), `${num(exercise.morning)} before noon`].filter(Boolean).join(" · ") : null,
    },
    { label: "Naps", value: num(naps.count), foot: naps.count ? `${fmtMinutes(naps.minutes)} in all` : null },
    {
      label: "Study",
      value: num(study.sessions),
      foot: study.alert + study.drowsy > 0 ? `${num(study.alert)} alert · ${num(study.drowsy)} drowsy` : null,
    },
  ];

  return (
    <div className="card">
      <div className="card-head"><span className="card-title">Body and practice</span></div>
      <div className="practice-tiles">
        {tiles.map((t) => (
          <div key={t.label} className="practice-tile">
            <div className="stat-label">{t.label}</div>
            <div className="practice-tile__value">{t.value}</div>
            {t.foot && <div className="stat-foot">{t.foot}</div>}
          </div>
        ))}
      </div>
      {weights.length > 0 && <WeightTrend weights={weights} />}
    </div>
  );
}

function WeightTrend({ weights }) {
  const points = weights.map((w) => ({ x: new Date(w.measured_at).getTime(), y: Number(w.value) }));
  const first = weights[0];
  const last = weights[weights.length - 1];
  const diff = Math.round((Number(last.value) - Number(first.value)) * 10) / 10;
  const note =
    weights.length === 1
      ? `One weigh-in, ${shortDay(last.measured_at)}.`
      : `${diff === 0 ? "The same as" : `${diff < 0 ? "Down" : "Up"} ${fmtWeight(Math.abs(diff))} lb since`} ${shortDay(first.measured_at)} · ${plural(weights.length, "weigh-in")}`;

  return (
    <div className="practice-weight">
      <div className="row row--between" style={{ marginBottom: 6 }}>
        <span className="stat-label">Weight</span>
        <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{fmtWeight(last.value)} lb</span>
      </div>
      {weights.length > 1 && (
        <LineChart
          series={[{ key: "Weight", color: "var(--text)", points }]}
          height={150}
          format={(v) => fmtWeight(v)}
          formatX={(x) => shortDay(x)}
          area={false}
          zero={false}
          dots
          fit
        />
      )}
      <p className="card-note" style={{ margin: "8px 0 0" }}>{note}</p>
    </div>
  );
}

const HOUR_MARKS = [
  { hour: 0, label: "12a" },
  { hour: 6, label: "6a" },
  { hour: 12, label: "12p" },
  { hour: 18, label: "6p" },
];

function hourName(h) {
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12} ${period}`;
}

// Hour-of-day × day-of-week — "when do the hours happen". All 24 columns fit
// a phone at about ten pixels a square, so nothing scrolls sideways. The
// database spreads each entry across the hours it covers and leaves sleep
// out, so one night doesn't wash out the waking day.
function Heatmap({ rows }) {
  const { grid, max } = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array(24).fill(0));
    let m = 0;
    for (const r of rows ?? []) {
      const mins = Number(r.total_minutes) || 0;
      g[r.day_of_week][r.hour_of_day] += mins;
      m = Math.max(m, g[r.day_of_week][r.hour_of_day]);
    }
    return { grid: g, max: m };
  }, [rows]);

  if (max === 0) return null;

  return (
    <div className="card">
      <div className="card-head"><span className="card-title">When the hours happen</span></div>
      <div className="heatmap" role="img" aria-label="Tracked time by weekday and hour of day">
        <div className="heatmap__row heatmap__row--hours" aria-hidden="true">
          <span />
          {HOUR_MARKS.map((m) => (
            <span key={m.hour} className="heatmap__hour" style={{ gridColumn: `${m.hour + 2} / span 6` }}>
              {m.label}
            </span>
          ))}
        </div>
        {grid.map((row, dow) => (
          <div key={dow} className="heatmap__row">
            <span className="heatmap__day">{WEEKDAYS[dow]}</span>
            {row.map((mins, hour) => (
              <span
                key={hour}
                className="heatmap__cell"
                title={`${WEEKDAYS[dow]} ${hourName(hour)} — ${mins > 0 ? fmtMinutes(mins) : "nothing tracked"}`}
                style={{ background: mins > 0 ? intensityColor(mins / max) : "var(--inset)" }}
              />
            ))}
          </div>
        ))}
      </div>
      <IntensityLegend note={`Minutes land in the hours they were spent; sleep is left out. Darkest square: ${fmtMinutes(max)}.`} />
    </div>
  );
}
