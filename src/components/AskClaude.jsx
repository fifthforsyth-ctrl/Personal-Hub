import { useMemo, useState } from "react";
import { LineChart, ColumnChart, RankedBars, Donut, Legend } from "./charts";
import { colorFor, fmtMinutes } from "../lib/categories";
import { fmtMoney, BUDGET_COLORS } from "../lib/money";
import "../styles/ask.css";

// A chart the assistant drew from a question in your own words, and its
// numbers: the Ask page shows one under each answer that needed a chart.

// Whole dollars on an axis, and "$1.3K" once they pass a thousand so a
// label still fits beside the plot on a phone.
const usdCompact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const moneyTick = (v) => (Math.abs(Number(v)) >= 1000 ? usdCompact.format(Number(v)) : fmtMoney(v, { round: true }));

// How a value reads: `exact` wherever you're reading one number (tooltips,
// the table, legends), `tick` on an axis.
function formattersFor(unit) {
  switch (unit) {
    case "dollars":
      return { exact: (v) => fmtMoney(v), tick: moneyTick };
    case "minutes":
      return { exact: fmtMinutes, tick: fmtMinutes };
    case "hours": {
      const f = (v) => `${Math.round(Number(v) * 10) / 10}h`;
      return { exact: f, tick: f };
    }
    case "percent": {
      const f = (v) => `${Math.round(Number(v))}%`;
      return { exact: f, tick: f };
    }
    default: {
      const f = (v) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return String(v ?? "");
        return Math.abs(n) >= 1000 ? n.toLocaleString() : String(Math.round(n * 100) / 100);
      };
      return { exact: f, tick: f };
    }
  }
}

// "2026-01-01" is a calendar day, read where you are; so is that day at UTC
// midnight, which is how a date_trunc'd timestamp comes back. Parsing either
// as an instant puts January 1st on December 31st in Denver.
function parseDay(value) {
  const s = String(value ?? "");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]00:00(?::00(?:\.0+)?)?(?:Z|[+-]00(?::?00)?)?)?$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

// Labels for a run of dates: months when every point is the 1st ("Jan",
// "January"), days otherwise ("Oct 2"), with the year only when it's needed.
function dateLabels(times, xKey) {
  const ds = times.map((t) => new Date(t));
  const monthly = ds.length > 0 && ds.every((d) => d.getDate() === 1);
  const years = new Set(ds.map((d) => d.getFullYear()));
  const withYear = years.size > 1 || !years.has(new Date().getFullYear());
  const weekly = !monthly && /week/i.test(xKey ?? "");
  const year = withYear ? { year: "numeric" } : {};
  const fmt = (t, opts) => new Date(t).toLocaleDateString(undefined, opts);
  return {
    long: (t) => (monthly ? fmt(t, { month: "long", ...year }) : `${weekly ? "Week of " : ""}${fmt(t, { month: "short", day: "numeric", ...year })}`),
    short: (t) => (monthly ? fmt(t, { month: "short", ...(withYear ? { year: "2-digit" } : {}) }) : fmt(t, { month: "short", day: "numeric", ...year })),
  };
}

// "total_spent" → "Total spent": the column alias as a heading.
function heading(key, fallback) {
  const words = String(key ?? "").replace(/[_-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : fallback;
}

// Category names have their own colours; anything else (a budget, a
// merchant) takes the next one from a fixed set so slices stay apart.
function colorOf(label, i) {
  const c = colorFor(label);
  return c === colorFor("\u0000") ? BUDGET_COLORS[i % BUDGET_COLORS.length] : c;
}

// One chart and its numbers. Also drawn by the Ask page, where a line chart
// can carry several series (spec.series_key names the column that says which
// series a row belongs to).
export function ChartResult({ result }) {
  const { spec, rows } = result;
  const [active, setActive] = useState(null);
  const isDate = spec.x_kind === "date";
  const seriesKey = spec.chart_type === "line" && spec.series_key ? spec.series_key : null;

  const points = useMemo(() => {
    return (rows ?? [])
      .map((r) => {
        const raw = r[spec.x_key];
        const series = seriesKey ? String(r[seriesKey] ?? "") : null;
        return { label: String(raw ?? ""), t: isDate ? parseDay(raw) : null, value: Number(r[spec.y_key]), series };
      })
      .filter((p) => Number.isFinite(p.value));
  }, [rows, spec.x_key, spec.y_key, isDate, seriesKey]);

  // Each series in the order it first appears, with its colour.
  const lines = useMemo(() => {
    if (!seriesKey) return null;
    const names = [...new Set(points.map((p) => p.series))];
    return names.map((name, i) => ({
      key: name || "Other",
      color: colorOf(name, i),
      points: points
        .filter((p) => p.series === name)
        .map((p) => ({ x: isDate ? p.t : Number(p.label), y: p.value }))
        .filter((p) => Number.isFinite(p.x)),
    }));
  }, [seriesKey, points, isDate]);

  const { exact, tick } = useMemo(() => formattersFor(spec.y_unit), [spec.y_unit]);

  const labels = useMemo(
    () => (isDate ? dateLabels(points.map((p) => p.t).filter((t) => t != null), spec.x_key) : null),
    [isDate, points, spec.x_key]
  );
  const longLabel = (p) => (labels && p.t != null ? labels.long(p.t) : p.label);

  // The line chart has one formatter for its axis and its tooltip. A value
  // that is one of the answers gets the exact reading; the gridline values in
  // between get the axis one.
  const lineFormat = useMemo(() => {
    if (exact === tick) return exact;
    const answers = new Set(points.map((p) => p.value));
    return (v) => (answers.has(v) ? exact(v) : tick(v));
  }, [points, exact, tick]);

  if (spec.chart_type === "none" || points.length === 0) {
    return (
      <>
        <h3 className="ask__title">{spec.title}</h3>
        <p className="card-note">{spec.answer}</p>
        {points.length === 0 && spec.chart_type !== "none" && <p className="empty ask__status">Nothing in your record matched that question.</p>}
      </>
    );
  }

  // Column keys must be unique; two points that read the same keep apart.
  const seen = new Set();
  const columns = points.map((p, i) => {
    let key = longLabel(p);
    if (seen.has(key)) key = `${key} (${i + 1})`;
    seen.add(key);
    return { key, shortKey: labels && p.t != null ? labels.short(p.t) : undefined, value: p.value };
  });

  return (
    <>
      <h3 className="ask__title">{spec.title}</h3>
      {spec.answer ? <p className="card-note" style={{ marginBottom: 16 }}>{spec.answer}</p> : <div style={{ height: 10 }} />}

      <div className="ask-chart">
        {spec.chart_type === "line" && lines && (
          <>
            <LineChart series={lines} area={false} format={lineFormat} formatX={isDate ? (t) => labels.long(t) : (v) => String(v)} />
            <div style={{ marginTop: 10 }}>
              <Legend
                items={lines.map((l) => ({ key: l.key, value: l.points.reduce((s, p) => s + p.y, 0), color: l.color }))}
                format={exact}
              />
            </div>
          </>
        )}

        {spec.chart_type === "line" && !lines && (
          <LineChart
            series={[
              {
                key: spec.y_key,
                color: "var(--accent)",
                points: points.map((p) => ({ x: isDate ? p.t : Number(p.label), y: p.value })).filter((p) => Number.isFinite(p.x)),
              },
            ]}
            format={lineFormat}
            formatX={isDate ? (t) => labels.long(t) : (v) => String(v)}
          />
        )}

        {spec.chart_type === "column" && <ColumnChart rows={columns} format={exact} />}

        {spec.chart_type === "bars" && (
          <RankedBars
            rows={[...points]
              .sort((a, b) => b.value - a.value)
              .map((p) => ({ key: longLabel(p), value: p.value, color: colorFor(p.label) }))}
            format={exact}
          />
        )}

        {spec.chart_type === "donut" && (
          <div className="row" style={{ gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <Donut
              slices={points.map((p, i) => ({ key: longLabel(p), value: p.value, color: colorOf(p.label, i) }))}
              size={220}
              thickness={26}
              format={exact}
              centerLabel="Total"
              centerValue={exact(points.reduce((s, p) => s + p.value, 0))}
              activeKey={active}
              onHover={setActive}
            />
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <Legend
                items={points.map((p, i) => ({ key: longLabel(p), value: p.value, color: colorOf(p.label, i) }))}
                format={exact}
                activeKey={active}
                onHover={setActive}
              />
            </div>
          </div>
        )}
      </div>

      {/* The table is not a fallback — it's the accessible reading of the same
          numbers, and for long series it's the only way to read an exact value
          without hunting with the pointer. */}
      <details className="ask-numbers">
        <summary className="btn-link">Show the numbers ({points.length} rows)</summary>
        <div className="ask-numbers__scroll">
          <table className="ask-numbers__table">
            <thead>
              <tr>
                <th>{heading(spec.x_key, isDate ? "Date" : "Item")}</th>
                {seriesKey && <th>{heading(seriesKey, "Series")}</th>}
                <th className="is-num">{heading(spec.y_key, "Value")}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={i}>
                  <td>{longLabel(p)}</td>
                  {seriesKey && <td>{p.series}</td>}
                  <td className="is-num mono">{exact(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
