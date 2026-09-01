import { useMemo, useState } from "react";
import { Sparkles, CornerDownLeft, X, RotateCcw } from "lucide-react";
import { askChart } from "../lib/api";
import { LineChart, ColumnChart, RankedBars, Donut, Legend } from "./charts";
import { colorFor } from "../lib/categories";

// "Ask Claude to map my data on a chart" — the open-ended question the fixed
// rollups on /reflect can't answer. You type it in your own words; the
// assistant writes a read-only query against your own tables, picks a form,
// and this renders whatever comes back.
//
// The examples are real questions rather than a features list: the fastest
// way to learn what a box like this can do is to press one and watch.
const EXAMPLES = [
  "Map out my sleep over the past 6 months, night by night",
  "How much time went to Serve each week this year?",
  "Which habits do I lose most often?",
  "What hours of the day do I actually study?",
];

function fmtHours(minutes) {
  const m = Number(minutes) || 0;
  if (m < 60) return `${Math.round(m)}m`;
  const h = Math.floor(m / 60);
  const rem = Math.round(m % 60);
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

function formatterFor(unit) {
  switch (unit) {
    case "minutes":
      return fmtHours;
    case "hours":
      return (v) => `${Math.round(Number(v) * 10) / 10}h`;
    case "percent":
      return (v) => `${Math.round(Number(v))}%`;
    default:
      return (v) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return String(v ?? "");
        return Math.abs(n) >= 1000 ? n.toLocaleString() : String(Math.round(n * 100) / 100);
      };
  }
}

function parseDateish(v) {
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

export default function AskClaude({ open, onOpenChange }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function ask(q) {
    const text = (q ?? question).trim();
    if (!text || loading) return;
    setQuestion(text);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await askChart(text));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <button className="btn btn--accent" onClick={() => setOpen(true)}>
        <Sparkles size={15} />
        Ask Claude
      </button>
    );
  }

  return (
    <div className="card card--accent" style={{ gridColumn: "1 / -1" }}>
      <div className="card-head">
        <span className="card-title"><Sparkles size={14} style={{ color: "var(--accent)" }} />Ask Claude</span>
        <button className="btn-icon" onClick={() => setOpen(false)} title="Close"><X size={16} /></button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <textarea
          className="textarea"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about your own record — “map out my sleep over the past 6 months based on how much sleep I got each night”"
          style={{ minHeight: 72 }}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              ask();
            }
          }}
        />
        <div className="row row--between" style={{ marginTop: 10, flexWrap: "wrap", gap: 8 }}>
          <span className="faint" style={{ fontSize: 11.5 }}>Reads only your own data. ⌘↵ to send.</span>
          <button type="submit" className="btn btn--accent" disabled={loading || !question.trim()}>
            <CornerDownLeft size={14} />
            {loading ? "Working…" : "Chart it"}
          </button>
        </div>
      </form>

      {!result && !loading && !error && (
        <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 14 }}>
          {EXAMPLES.map((ex) => (
            <button key={ex} className="chip" onClick={() => ask(ex)} style={{ cursor: "pointer" }}>
              {ex}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="empty" style={{ marginTop: 14 }}>Writing the query and reading your record…</p>}
      {error && <div className="form-error" style={{ marginTop: 14 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 18 }}>
          <ChartResult result={result} />
          <button className="btn-link" style={{ marginTop: 12 }} onClick={() => setResult(null)}>
            <RotateCcw size={12} />
            Ask something else
          </button>
        </div>
      )}
    </div>
  );
}

function ChartResult({ result }) {
  const { spec, rows } = result;
  const format = formatterFor(spec.y_unit);

  const points = useMemo(() => {
    return (rows ?? [])
      .map((r) => ({ raw: r, label: String(r[spec.x_key] ?? ""), value: Number(r[spec.y_key]) }))
      .filter((p) => Number.isFinite(p.value));
  }, [rows, spec.x_key, spec.y_key]);

  const [active, setActive] = useState(null);

  if (spec.chart_type === "none" || points.length === 0) {
    return (
      <>
        <h3 style={{ fontSize: 16, marginBottom: 6 }}>{spec.title}</h3>
        <p className="card-note">{spec.answer}</p>
        {points.length === 0 && spec.chart_type !== "none" && (
          <p className="empty" style={{ marginTop: 8 }}>Nothing in your record matched that question.</p>
        )}
      </>
    );
  }

  const isDate = spec.x_kind === "date";
  const formatX = isDate
    ? (t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : (v) => String(v);

  return (
    <>
      <h3 style={{ fontSize: 16, marginBottom: 6 }}>{spec.title}</h3>
      <p className="card-note" style={{ marginBottom: 16 }}>{spec.answer}</p>

      {spec.chart_type === "line" && (
        <LineChart
          series={[
            {
              key: spec.y_key,
              color: "var(--accent)",
              points: points
                .map((p) => ({ x: isDate ? parseDateish(p.label) : Number(p.label), y: p.value }))
                .filter((p) => Number.isFinite(p.x)),
            },
          ]}
          format={format}
          formatX={formatX}
        />
      )}

      {spec.chart_type === "column" && (
        <ColumnChart rows={points.map((p) => ({ key: p.label, value: p.value }))} format={format} />
      )}

      {spec.chart_type === "bars" && (
        <RankedBars
          rows={[...points]
            .sort((a, b) => b.value - a.value)
            .map((p) => ({ key: p.label, value: p.value, color: colorFor(p.label) }))}
          format={format}
        />
      )}

      {spec.chart_type === "donut" && (
        <div className="row" style={{ gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <Donut
            slices={points.map((p) => ({ key: p.label, value: p.value, color: colorFor(p.label) }))}
            size={220}
            thickness={26}
            format={format}
            centerLabel="Total"
            centerValue={format(points.reduce((s, p) => s + p.value, 0))}
            activeKey={active}
            onHover={setActive}
          />
          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
            <Legend
              items={points.map((p) => ({ key: p.label, value: p.value, color: colorFor(p.label) }))}
              format={format}
              activeKey={active}
              onHover={setActive}
            />
          </div>
        </div>
      )}

      {/* The table is not a fallback — it's the accessible reading of the same
          numbers, and for long series it's the only way to read an exact value
          without hunting with the pointer. */}
      <details style={{ marginTop: 14 }}>
        <summary className="btn-link" style={{ cursor: "pointer" }}>Show the numbers ({points.length} rows)</summary>
        <div style={{ maxHeight: 260, overflowY: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={thStyle}>{spec.x_key}</th>
                <th style={{ ...thStyle, textAlign: "right" }}>{spec.y_key}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={i}>
                  <td style={tdStyle}>{isDate ? formatX(parseDateish(p.label) ?? p.label) : p.label}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }} className="mono">{format(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "6px 8px",
  borderBottom: "1px solid var(--line)",
  color: "var(--text-3)",
  fontWeight: 500,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const tdStyle = { padding: "6px 8px", borderBottom: "1px solid var(--line)" };
