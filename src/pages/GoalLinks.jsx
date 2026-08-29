import { useCallback, useEffect, useMemo, useState } from "react";
import { Link2, Check, Sparkles, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  fetchGoalMappings,
  fetchMappableSources,
  fetchGoalPaths,
  upsertGoalMapping,
  confirmGoalMappings,
  applyGoalMappings,
} from "../lib/api";

const KIND_LABEL = { category: "Categories", subcategory: "Subcategories", habit: "Habits" };
const KIND_ORDER = ["category", "subcategory", "habit"];

// The setup screen that makes every other "how did today feed my goals"
// question answerable.
//
// Linking used to be a per-entry dropdown over 86 nodes, which meant it
// never happened — 1,001 logged entries with zero links. The decision moves
// up a level here: say once what "Study" means, and every entry in it links
// itself, backwards and forwards.
export default function GoalLinks() {
  const { user } = useAuth();
  const [mappings, setMappings] = useState([]);
  const [sources, setSources] = useState([]);
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(null);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const [m, s, p] = await Promise.all([
      fetchGoalMappings(user.id),
      fetchMappableSources(user.id),
      fetchGoalPaths(user.id),
    ]);
    setMappings(m);
    setSources(s);
    setPaths(p);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const byKey = useMemo(() => {
    const map = new Map();
    for (const m of mappings) map.set(`${m.source_kind}::${m.source_value}`, m);
    return map;
  }, [mappings]);

  const pathById = useMemo(() => new Map(paths.map((p) => [p.id, p.path])), [paths]);

  const grouped = useMemo(() => {
    const out = new Map(KIND_ORDER.map((k) => [k, []]));
    for (const s of sources) {
      if (!out.has(s.source_kind)) continue;
      out.get(s.source_kind).push({ ...s, mapping: byKey.get(`${s.source_kind}::${s.source_value}`) ?? null });
    }
    return out;
  }, [sources, byKey]);

  const unconfirmed = mappings.filter((m) => !m.confirmed && m.goal_node_id);
  const confirmedCount = mappings.filter((m) => m.confirmed && m.goal_node_id).length;

  async function guard(fn) {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  const handleSet = (source, goalNodeId) =>
    guard(() =>
      upsertGoalMapping(user.id, {
        sourceKind: source.source_kind,
        sourceValue: source.source_value,
        goalNodeId,
        confirmed: Boolean(goalNodeId),
      })
    );

  const handleAcceptAll = () =>
    guard(async () => {
      await confirmGoalMappings(user.id, unconfirmed.map((m) => m.id));
      const n = await applyGoalMappings();
      setApplied(n);
    });

  const handleApply = () =>
    guard(async () => {
      const n = await applyGoalMappings();
      setApplied(n);
    });

  return (
    <div className="page">
      <Link to="/tree" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
        <ArrowLeft size={13} />
        Goal Tree
      </Link>

      <h1 className="page-title">What feeds what</h1>
      <p className="page-subtitle">
        Say once what each thing you track belongs to, and every entry — past and future — connects itself to your tree.
      </p>

      {loading && <p className="placeholder-note">Loading…</p>}

      {!loading && (
        <>
          {unconfirmed.length > 0 && (
            <div className="card" style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-strong)" }}>
              <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={12} />
                {unconfirmed.length} suggested {unconfirmed.length === 1 ? "link" : "links"}
              </div>
              <p style={{ fontSize: 13, margin: "0 0 12px", lineHeight: 1.55 }}>
                These were proposed by matching what you track against your tree. The ones marked{" "}
                <strong>exact</strong> matched a node by name outright; the rest are inferences — read them before accepting.
              </p>
              <button onClick={handleAcceptAll} disabled={busy} className="btn-primary" style={{ width: "auto", margin: 0 }}>
                {busy ? "Applying…" : `Accept all ${unconfirmed.length} and link my entries`}
              </button>
            </div>
          )}

          {applied !== null && (
            <div className="card" style={{ borderColor: "var(--accent-strong)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                <Check size={15} color="var(--accent-strong)" />
                Linked {applied} {applied === 1 ? "entry" : "entries"} to your goal tree.
              </div>
            </div>
          )}

          {KIND_ORDER.map((kind) => {
            const rows = grouped.get(kind) ?? [];
            if (rows.length === 0) return null;
            return (
              <div key={kind} className="card">
                <div className="section-label">{KIND_LABEL[kind]}</div>
                {rows.map((row) => (
                  <MappingRow
                    key={row.source_value}
                    row={row}
                    paths={paths}
                    pathById={pathById}
                    disabled={busy}
                    onSet={(nodeId) => handleSet(row, nodeId)}
                  />
                ))}
              </div>
            );
          })}

          {confirmedCount > 0 && (
            <button onClick={handleApply} disabled={busy} className="btn-secondary" style={{ width: "100%" }}>
              {busy ? "Applying…" : "Re-apply links to all entries"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function MappingRow({ row, paths, pathById, disabled, onSet }) {
  const m = row.mapping;
  const linked = m?.goal_node_id ?? "";
  const isExact = m?.origin === "exact";
  const pending = m && !m.confirmed && m.goal_node_id;

  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 0 }}>{row.source_value}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {isExact && (
            <span className="pill" style={{ fontSize: 9.5, padding: "1px 7px", color: "var(--accent-strong)", borderColor: "var(--accent-strong)" }}>
              exact
            </span>
          )}
          {pending && (
            <span className="pill" style={{ fontSize: 9.5, padding: "1px 7px", color: "var(--text-faint)" }}>
              suggested
            </span>
          )}
          <span className="entry-meta">{row.count}</span>
        </span>
      </div>

      <select
        value={linked}
        disabled={disabled}
        onChange={(e) => onSet(e.target.value || null)}
        style={{
          width: "100%",
          background: "var(--bg-inset)",
          border: `1px solid ${linked ? (pending ? "var(--border-strong)" : "var(--accent-strong)") : "var(--border)"}`,
          borderRadius: 6,
          padding: "8px 10px",
          color: linked ? "var(--text)" : "var(--text-faint)",
          fontSize: 12.5,
          fontFamily: "inherit",
        }}
      >
        <option value="">Not linked — doesn't feed a goal</option>
        {paths.map((p) => (
          <option key={p.id} value={p.id}>
            {p.path}
          </option>
        ))}
      </select>

      {linked && pathById.get(linked) && (
        <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>{pathById.get(linked)}</div>
      )}
    </div>
  );
}
