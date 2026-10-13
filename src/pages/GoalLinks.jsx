import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchGoalMappings,
  fetchMappableSources,
  fetchGoalPaths,
  upsertGoalMapping,
  confirmGoalMappings,
  applyGoalMappings,
} from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { friendlyError } from "../lib/errors";
import { useToast } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import GoalPicker from "../components/GoalPicker";
import "../styles/goals.css";

const KIND_LABEL = { category: "Categories", subcategory: "Subcategories", habit: "Habits" };
const KIND_ORDER = ["category", "subcategory", "habit"];
const NO_DATA = { mappings: [], sources: [], paths: [] };

const rowKey = (row) => `${row.source_kind}::${row.source_value}`;

function countLabel(kind, n) {
  if (kind === "habit") return `${n.toLocaleString()} ${n === 1 ? "time" : "times"}`;
  return `${n.toLocaleString()} ${n === 1 ? "entry" : "entries"}`;
}

// The setup screen that makes every other "how did today feed my goals"
// question answerable.
//
// Linking used to be a per-entry dropdown over 86 goals, which meant it
// never happened — 1,001 logged entries with zero links. The decision moves
// up a level here: say once what "Study" means, and every entry in it links
// itself, backwards and forwards. Each change relinks the past entries at
// once, and says how many moved.
export default function GoalLinks() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(async () => {
    if (!user?.id) return NO_DATA;
    const [mappings, sources, paths] = await Promise.all([fetchGoalMappings(user.id), fetchMappableSources(), fetchGoalPaths(user.id)]);
    return { mappings, sources, paths };
  }, [user?.id]);
  const { mappings, sources, paths } = data ?? NO_DATA;

  const [busy, setBusy] = useState(null); // the row key being saved, or "all"
  const [picking, setPicking] = useState(null); // the row whose goal is being chosen

  const byKey = useMemo(() => new Map(mappings.map((m) => [`${m.source_kind}::${m.source_value}`, m])), [mappings]);
  const pathById = useMemo(() => new Map(paths.map((p) => [p.id, p.path])), [paths]);

  const grouped = useMemo(() => {
    const out = new Map(KIND_ORDER.map((k) => [k, []]));
    for (const s of sources) {
      if (!out.has(s.source_kind)) continue;
      out.get(s.source_kind).push({ ...s, mapping: byKey.get(rowKey(s)) ?? null });
    }
    return out;
  }, [sources, byKey]);

  const suggested = mappings.filter((m) => !m.confirmed && m.goal_node_id);

  // Brings past entries in line with the links, and says what moved. If
  // that part fails the link itself is already saved, so the toast offers
  // just the relink again.
  async function relink(saved) {
    try {
      const n = Number(await applyGoalMappings()) || 0;
      const moved = n > 0 ? `relinked ${n.toLocaleString()} ${n === 1 ? "entry" : "entries"}` : "no past entries needed relinking";
      toast.show(saved ? `${saved} — ${moved}` : moved.charAt(0).toUpperCase() + moved.slice(1));
    } catch (err) {
      toast.show(friendlyError(err, "Saved, but couldn't relink past entries."), {
        tone: "error",
        actionLabel: "Try again",
        onAction: () => relink(null),
      });
    }
  }

  async function guarded(key, fn) {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } finally {
      await reload();
      setBusy(null);
    }
  }

  const handleSet = (row, goalId) =>
    guarded(rowKey(row), async () => {
      try {
        await upsertGoalMapping(user.id, {
          sourceKind: row.source_kind,
          sourceValue: row.source_value,
          goalNodeId: goalId,
          confirmed: Boolean(goalId),
        });
      } catch (err) {
        toast.error(err, "Couldn't save that link.");
        return;
      }
      await relink(goalId ? `Linked ${row.source_value}` : `Unlinked ${row.source_value}`);
    });

  const handleKeep = (row) =>
    guarded(rowKey(row), async () => {
      try {
        await confirmGoalMappings(user.id, [row.mapping.id]);
      } catch (err) {
        toast.error(err, "Couldn't keep that link.");
        return;
      }
      await relink(`Kept ${row.source_value}`);
    });

  // A suggestion that's wrong is dropped, not left waiting. It was never
  // applied, so no entries move.
  const handleReject = (row) =>
    guarded(rowKey(row), async () => {
      try {
        await upsertGoalMapping(user.id, { sourceKind: row.source_kind, sourceValue: row.source_value, goalNodeId: null, confirmed: false });
        toast.show(`${row.source_value} left unlinked`);
      } catch (err) {
        toast.error(err, "Couldn't drop that suggestion.");
      }
    });

  const handleKeepAll = () =>
    guarded("all", async () => {
      try {
        await confirmGoalMappings(user.id, suggested.map((m) => m.id));
      } catch (err) {
        toast.error(err, "Couldn't keep those links.");
        return;
      }
      await relink(`Kept ${suggested.length} ${suggested.length === 1 ? "link" : "links"}`);
    });

  const nothingTracked = !loading && !error && sources.length === 0;

  return (
    <div className="page page--narrow goal-links">
      <Link to="/tree" className="btn-link goal-links__back">
        <ArrowLeft size={14} />
        Goal wheel
      </Link>

      <div className="page-head">
        <div>
          <h1 className="page-title">Goal links</h1>
          <p className="page-sub">Say once which goal each thing you track feeds, and every entry — past and future — links itself to your goals.</p>
        </div>
      </div>

      {error && <LoadError what="your goal links" error={error} onRetry={reload} stale={Boolean(data)} />}
      {loading && <p className="empty">Loading…</p>}
      {nothingTracked && <p className="empty">Nothing tracked yet. Your categories and habits show up here once you've logged them.</p>}

      {!loading && (
        <div className="stack">
          {suggested.length > 0 && (
            <div className="card card--accent">
              <div className="card-title goal-links__banner-title">
                <Sparkles size={14} />
                {suggested.length} suggested {suggested.length === 1 ? "link" : "links"}
              </div>
              <p className="goal-links__banner-text">I matched some of your categories to goals. “Exact” means the names match — check the others before you keep them.</p>
              <button type="button" onClick={handleKeepAll} disabled={Boolean(busy)} className="btn btn--accent">
                {busy === "all" ? "Keeping…" : `Keep all ${suggested.length}`}
              </button>
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
                    key={rowKey(row)}
                    row={row}
                    path={row.mapping?.goal_node_id ? pathById.get(row.mapping.goal_node_id) ?? "A goal that's gone" : null}
                    saving={busy === rowKey(row)}
                    disabled={Boolean(busy)}
                    onChange={() => setPicking(row)}
                    onKeep={() => handleKeep(row)}
                    onReject={() => handleReject(row)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {picking && (
        <GoalPicker
          goals={paths}
          value={picking.mapping?.goal_node_id ?? null}
          noneLabel="Not linked"
          noneHint={picking.source_kind === "habit" ? "Wins and losses here won't count toward a goal" : "Entries here won't count toward a goal"}
          placeholder={`Find the goal ${picking.source_value} feeds…`}
          onPick={(goalId) => {
            const row = picking;
            setPicking(null);
            if ((row.mapping?.goal_node_id ?? null) === goalId && (row.mapping?.confirmed || !goalId)) return;
            handleSet(row, goalId);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}

function MappingRow({ row, path, saving, disabled, onChange, onKeep, onReject }) {
  const m = row.mapping;
  const isExact = m?.origin === "exact";
  const pending = Boolean(m && !m.confirmed && m.goal_node_id);
  // The goal itself first and in full; where it sits on the wheel under it,
  // so a long path never cuts off the part that matters.
  const parts = path ? path.split(" › ") : [];
  const leaf = parts[parts.length - 1];
  const trail = parts.slice(0, -1).join(" › ");

  return (
    <div className="link-row">
      <div className="link-row__top">
        <span className="link-row__name">{row.source_value}</span>
        {isExact && <span className="pill link-row__tag">Exact</span>}
        {pending && <span className="pill link-row__tag">Suggested</span>}
        <span className="link-row__count">{countLabel(row.source_kind, row.count)}</span>
      </div>

      <button type="button" className="link-row__goal" onClick={onChange} disabled={disabled} title={`Change which goal ${row.source_value} feeds`}>
        {path ? (
          <span className="link-row__target">
            <span className="truncate link-row__leaf">{leaf}</span>
            {trail && <span className="truncate link-row__trail">{trail}</span>}
          </span>
        ) : (
          <span className="link-row__target link-row__none">Not linked</span>
        )}
        <span className="link-row__change">{saving ? "Saving…" : "Change"}</span>
      </button>

      {pending && (
        <div className="link-row__ask">
          <span>Keep this link?</span>
          <button type="button" className="btn btn--sm btn--accent" onClick={onKeep} disabled={disabled}>
            Keep
          </button>
          <button type="button" className="btn btn--sm" onClick={onReject} disabled={disabled}>
            No
          </button>
        </div>
      )}
    </div>
  );
}
