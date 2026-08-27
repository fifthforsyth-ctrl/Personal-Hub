import { useEffect, useMemo, useState } from "react";
import { Clock, Plus, Minus, HandHeart } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchTimeEntries, fetchWinLosses, fetchPrayers } from "../lib/api";

const RANGE_DAYS = { "7": "Past week", "30": "Past month", "90": "Past 3 months", all: "All time" };

function sinceISOForRange(range) {
  if (range === "all") return null;
  const d = new Date();
  d.setDate(d.getDate() - Number(range));
  return d.toISOString();
}

function dateKey(iso) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// The archival view — every logged minute, win, loss, and prayer, merged
// into one chronological record. Nothing here is summarized or interpreted
// yet (that's the analytics work of a later phase); this is the raw layer
// underneath it, kept faithfully.
export default function History() {
  const { user } = useAuth();
  const [range, setRange] = useState("7");
  const [timeEntries, setTimeEntries] = useState([]);
  const [winLosses, setWinLosses] = useState([]);
  const [prayers, setPrayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    const sinceISO = sinceISOForRange(range);
    Promise.all([
      fetchTimeEntries(user.id, { sinceISO, limit: 500 }),
      fetchWinLosses(user.id, { sinceISO, limit: 500 }),
      fetchPrayers(user.id, { sinceISO, limit: 500 }),
    ])
      .then(([t, w, p]) => {
        setTimeEntries(t);
        setWinLosses(w);
        setPrayers(p);
      })
      .finally(() => setLoading(false));
  }, [user?.id, range]);

  const grouped = useMemo(() => {
    const items = [
      ...timeEntries.map((e) => ({ type: "time", at: e.started_at, data: e })),
      ...winLosses.map((e) => ({ type: "winloss", at: e.occurred_at, data: e })),
      ...prayers.map((e) => ({ type: "prayer", at: e.prayed_at, data: e })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at));

    const byDay = new Map();
    for (const item of items) {
      const key = dateKey(item.at);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(item);
    }
    return [...byDay.entries()];
  }, [timeEntries, winLosses, prayers]);

  return (
    <div className="page">
      <h1 className="page-title">History</h1>
      <p className="page-subtitle">Your archive — every logged minute, win, loss, and prayer, in order.</p>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {Object.entries(RANGE_DAYS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setRange(key)}
            style={{
              background: range === key ? "var(--accent-dim)" : "var(--bg-inset)",
              border: `1px solid ${range === key ? "var(--accent-strong)" : "var(--border)"}`,
              color: range === key ? "var(--text)" : "var(--text-muted)",
              borderRadius: 999,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {!loading && grouped.length === 0 && <p className="placeholder-note">Nothing logged in this range yet.</p>}

      {grouped.map(([day, items]) => (
        <div key={day} className="card">
          <div className="section-label">{day}</div>
          {items.map((item, i) => (
            <HistoryRow key={`${item.type}-${item.data.id}-${i}`} item={item} />
          ))}
        </div>
      ))}
    </div>
  );
}

function HistoryRow({ item }) {
  const time = new Date(item.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (item.type === "time") {
    const e = item.data;
    return (
      <div className="entry-row">
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Clock size={13} color="var(--accent-strong)" />
          {e.category}
          {e.subcategory ? ` · ${e.subcategory}` : ""}
          {e.description ? ` — ${e.description}` : ""}
        </span>
        <span className="entry-meta">{e.duration_minutes != null ? `${e.duration_minutes}m` : "running"} · {time}</span>
      </div>
    );
  }

  if (item.type === "winloss") {
    const e = item.data;
    return (
      <div className="entry-row">
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: e.kind === "win" ? "var(--accent-strong)" : "var(--danger)" }}>
          {e.kind === "win" ? <Plus size={13} /> : <Minus size={13} />}
          {e.habit_label}
          {e.note ? ` — ${e.note}` : ""}
        </span>
        <span className="entry-meta">{time}</span>
      </div>
    );
  }

  const e = item.data;
  return (
    <div className="entry-row" style={{ flexDirection: "column", alignItems: "flex-start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between", width: "100%" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <HandHeart size={13} color="var(--accent-strong)" />
          {e.context || "Prayer"}
        </span>
        <span className="entry-meta">{time}</span>
      </div>
      <div style={{ color: "var(--text-muted)", marginTop: 2 }}>{e.content}</div>
      {e.felt_response && <div style={{ color: "var(--accent-strong)", marginTop: 2, fontSize: 12.5 }}>Felt: {e.felt_response}</div>}
    </div>
  );
}
