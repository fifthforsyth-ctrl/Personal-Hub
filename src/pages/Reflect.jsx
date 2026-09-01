import { useEffect, useMemo, useState } from "react";
import {
  fetchTimeByCategory,
  fetchHabitStrength,
  fetchProductivityHeatmap,
  fetchReflectionTotals,
} from "../lib/api";
import { intensityColor } from "../lib/nodeStyle";
import { RankedBars } from "../components/charts";
import { colorFor } from "../lib/categories";
import { todayStr, addDays, parseDateStr } from "../lib/planDates";

const RANGES = [
  { key: "7", label: "Week", days: 7 },
  { key: "30", label: "Month", days: 30 },
  { key: "90", label: "Quarter", days: 90 },
  { key: "365", label: "Year", days: 365 },
];

// Single-series bars carry no identity, only magnitude, so they take one
// hue rather than a categorical palette — the category name is already on
// the row. Sits at the bright end of the same ramp the grids use.
const BAR_COLOR = "#c0743b";
const BAR_COLOR_STRONG = "#d8933b";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtHours(minutes) {
  const m = Number(minutes) || 0;
  if (m < 60) return `${Math.round(m)}m`;
  const h = Math.floor(m / 60);
  const rem = Math.round(m % 60);
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

// Phase 1 — Reflection. The 10,000-foot view over everything the Data layer
// has collected: where the time actually went, which habits are holding,
// when the good hours happen, and a written summary in place of a wall of
// numbers.
export default function Reflect() {
  const [rangeKey, setRangeKey] = useState("30");
  const [totals, setTotals] = useState(null);
  const [categories, setCategories] = useState([]);
  const [habits, setHabits] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[1];
  const endDate = todayStr();
  const startDate = addDays(endDate, -(range.days - 1));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchReflectionTotals(startDate, endDate),
      fetchTimeByCategory(startDate, endDate),
      fetchHabitStrength(startDate, endDate),
      fetchProductivityHeatmap(startDate, endDate),
    ])
      .then(([t, c, h, hm]) => {
        if (cancelled) return;
        setTotals(t);
        setCategories(c);
        setHabits(h);
        setHeatmap(hm);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  const hasAnything =
    totals && (Number(totals.logged_minutes) > 0 || totals.wins > 0 || totals.losses > 0 || totals.tasks_planned > 0 || totals.prayers > 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Reflect</div>
          <h1 className="page-title" style={{ marginTop: 3 }}>The long view</h1>
          <p className="page-sub">
            {parseDateStr(startDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })} –{" "}
            {parseDateStr(endDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>

        {/* One filter row above the charts, never repeated per chart. */}
        <div className="seg">
          {RANGES.map((r) => (
            <button key={r.key} className={"seg-btn" + (rangeKey === r.key ? " active" : "")} onClick={() => setRangeKey(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading && <p className="empty">Reading the record…</p>}

      {!loading && !hasAnything && (
        <p className="empty">
          Nothing logged in this range yet. Track some time, log a win, or plan a day — this page fills itself in from what you record.
        </p>
      )}

      {!loading && hasAnything && (
        <>
          <StatTiles totals={totals} />
          <Summary totals={totals} categories={categories} habits={habits} rangeLabel={range.label.toLowerCase()} days={range.days} />
          <CategoryChart rows={categories} />
          <HabitChart rows={habits} />
          <Heatmap rows={heatmap} />
        </>
      )}
    </div>
  );
}

// The doc asks for summaries "composed in the same voice as your current
// text-box export, so the archive reads like a journal, not a spreadsheet."
// Written from the numbers, stated plainly — no praise, no scolding.
function Summary({ totals, categories, habits, rangeLabel, days }) {
  const text = useMemo(() => {
    const parts = [];
    const mins = Number(totals.logged_minutes) || 0;

    if (mins > 0) {
      const perDay = totals.days_logged > 0 ? mins / totals.days_logged : 0;
      parts.push(
        `You logged ${fmtHours(mins)} across ${totals.days_logged} ${totals.days_logged === 1 ? "day" : "days"} this past ${rangeLabel}` +
          (perDay > 0 ? `, averaging ${fmtHours(perDay)} on the days you tracked.` : ".")
      );
      // Categories can run concurrently — driving logged inside a block of
      // service, say — so the daily average can exceed the clock. Saying so
      // is better than printing "averaging 25h 46m" as if it were a day.
      if (perDay > 24 * 60) {
        parts.push("That's more than a day per day, so some categories are running concurrently — the totals below double-count wherever two were logged at once.");
      }
    }

    if (categories.length > 0) {
      const top = categories[0];
      const share = mins > 0 ? Math.round((Number(top.total_minutes) / mins) * 100) : 0;
      parts.push(`Most of it went to ${top.category} — ${fmtHours(top.total_minutes)}, about ${share}% of everything tracked.`);
    }

    if (totals.tasks_planned > 0) {
      const pct = Math.round((totals.tasks_done / totals.tasks_planned) * 100);
      parts.push(`Of ${totals.tasks_planned} planned ${totals.tasks_planned === 1 ? "task" : "tasks"}, you finished ${totals.tasks_done} (${pct}%).`);
    }

    if (totals.wins + totals.losses > 0) {
      parts.push(`You recorded ${totals.wins} ${totals.wins === 1 ? "win" : "wins"} and ${totals.losses} ${totals.losses === 1 ? "loss" : "losses"}.`);
      const weakest = [...habits].reverse().find((h) => h.losses > 0);
      if (weakest && Number(weakest.win_rate) < 0.5) {
        parts.push(`${weakest.habit_label} is the one giving the most trouble right now.`);
      }
    }

    if (totals.prayers > 0) {
      parts.push(`${totals.prayers} ${totals.prayers === 1 ? "prayer was" : "prayers were"} recorded, with what you felt in response.`);
    }

    const untracked = days - totals.days_logged;
    if (untracked > 0 && totals.days_logged > 0) {
      parts.push(`${untracked} ${untracked === 1 ? "day" : "days"} in this window have no time logged at all.`);
    }

    return parts.join(" ");
  }, [totals, categories, habits, rangeLabel, days]);

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="card-head"><span className="card-title">The short version</span></div>
      <p className="prose" style={{ margin: 0, whiteSpace: "normal" }}>{text}</p>
    </div>
  );
}

// Headline numbers are not a chart — four plain tiles read faster than any
// plot of four values would.
function StatTiles({ totals }) {
  const tiles = [
    { label: "Time logged", value: fmtHours(totals.logged_minutes) },
    { label: "Days tracked", value: String(totals.days_logged) },
    {
      label: "Tasks done",
      value: totals.tasks_planned > 0 ? `${totals.tasks_done}/${totals.tasks_planned}` : "—",
    },
    { label: "Wins · losses", value: `${totals.wins} · ${totals.losses}` },
  ];

  return (
    <div className="grid grid--stats">
      {tiles.map((t) => (
        <div key={t.label} className="stat">
          <div className="stat-top"><span className="stat-label">{t.label}</span></div>
          <div className="stat-value">{t.value}</div>
        </div>
      ))}
    </div>
  );
}

// Ranked horizontal bars: one measure (minutes), so one hue and no legend —
// the category name labels each row directly, and the value sits at the end
// of its own bar rather than on a hover-only tooltip.
function CategoryChart({ rows }) {
  // useMemo before any early return — bailing out first would make the hook
  // order depend on the data.
  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const prev = map.get(r.category) ?? { category: r.category, minutes: 0, subs: [] };
      prev.minutes += Number(r.total_minutes) || 0;
      if (r.subcategory) prev.subs.push({ name: r.subcategory, minutes: Number(r.total_minutes) || 0 });
      map.set(r.category, prev);
    }
    return [...map.values()].sort((a, b) => b.minutes - a.minutes);
  }, [rows]);

  const max = Math.max(...grouped.map((g) => g.minutes), 1);

  if (grouped.length === 0) return null;

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Where the time went</span>
        <span className="mono faint" style={{ fontSize: 11.5 }}>{grouped.length} categories</span>
      </div>
      <RankedBars
        rows={grouped.map((g) => ({ key: g.category, value: g.minutes, color: colorFor(g.category) }))}
        format={fmtHours}
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
                    {sub.name} · {fmtHours(sub.minutes)}
                  </span>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Ranked by consistency, not volume — the doc's "strongest and weakest
// habits by consistency score, not just raw hours." One measure (win rate),
// so one hue; the win/loss split rides along as text rather than a second
// color, which keeps it readable for any kind of color vision.
function HabitChart({ rows }) {
  if (rows.length === 0) return null;

  return (
    <div className="card">
      <div className="card-head"><span className="card-title">Habit strength</span></div>
      <p className="card-note" style={{ marginTop: -6, marginBottom: 14 }}>
        Share of logged attempts that were wins. Presented as information, not a verdict.
      </p>
      <RankedBars
        rows={rows.map((h) => ({ key: h.habit_label, value: Math.round((Number(h.win_rate) || 0) * 100) }))}
        format={(v) => `${v}%`}
        max={100}
      />
      <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 12 }}>
        {rows.slice(0, 8).map((h) => (
          <span key={h.habit_label} className="chip" style={{ fontSize: 10.5 }}>
            {h.habit_label} · {h.wins}W {h.losses}L
          </span>
        ))}
      </div>
    </div>
  );
}

// Hour-of-day x day-of-week matrix — "when am I most productive." Sequential
// single ramp (dark -> warm, monotonically lightening), so magnitude reads
// as magnitude. Entries are attributed to the hour they started in.
function Heatmap({ rows }) {
  const { grid, max } = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array(24).fill(0));
    let m = 0;
    for (const r of rows) {
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
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 460 }}>
          <div style={{ display: "grid", gridTemplateColumns: "34px repeat(24, 1fr)", gap: 2, marginBottom: 3 }}>
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} style={{ fontSize: 8, textAlign: "center", color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
                {h % 6 === 0 ? h : ""}
              </span>
            ))}
          </div>
          {grid.map((row, dow) => (
            <div key={dow} style={{ display: "grid", gridTemplateColumns: "34px repeat(24, 1fr)", gap: 2, marginBottom: 2 }}>
              <span style={{ fontSize: 9.5, color: "var(--text-2)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center" }}>
                {WEEKDAYS[dow]}
              </span>
              {row.map((mins, hour) => (
                <div
                  key={hour}
                  title={mins > 0 ? `${WEEKDAYS[dow]} ${hour}:00 — ${fmtHours(mins)}` : `${WEEKDAYS[dow]} ${hour}:00 — nothing logged`}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 2,
                    background: mins > 0 ? intensityColor(mins / max) : "var(--inset)",
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
        <span>NONE</span>
        <div
          style={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            background: `linear-gradient(90deg, ${intensityColor(0)}, ${intensityColor(0.35)}, ${intensityColor(0.7)}, ${intensityColor(1)})`,
            border: "1px solid var(--line)",
          }}
        />
        <span>{fmtHours(max).toUpperCase()}</span>
      </div>
    </div>
  );
}
