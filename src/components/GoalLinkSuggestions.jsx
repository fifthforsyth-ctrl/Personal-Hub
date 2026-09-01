import { useCallback, useEffect, useState } from "react";
import { Sparkles, Check, ArrowRight, X, Link2, Pencil } from "lucide-react";
import { suggestGoalLinks, applyGoalLinks, fetchLinkStats, fetchGoalPaths } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import GoalPicker from "./GoalPicker";
import { fmtMinutes } from "../lib/categories";
import { addDays } from "../lib/planDates";

const CONFIDENCE_COLOR = {
  high: "var(--accent)",
  medium: "var(--text-2)",
  low: "var(--text-3)",
};

// "Be as fluid as I can throughout the day, then have AI put the brass tacks
// on everything."
//
// Category mapping is coarse by nature — every Serve entry lands in the same
// place. The descriptions are where the meaning is: "Serve zone making app"
// and "Help sister Shumway" are both Serve and feed different branches. This
// reads what was actually written and proposes a link per entry.
//
// Nothing is written until accepted, and low-confidence rows are left
// unchecked by default — a wrong link is worse than none, because it makes
// the fruits view quietly lie.
//
// Every proposal is editable. The model is reading a four-word description
// and guessing; when it guesses wrong the fix has to be one click away, or
// you end up accepting links you don't believe to avoid the friction.
export default function GoalLinkSuggestions({ date, onApplied }) {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [editing, setEditing] = useState(null); // entry_id whose goal is being changed
  const [result, setResult] = useState(null);
  const [chosen, setChosen] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(0);
  const [error, setError] = useState(null);
  const [dayStats, setDayStats] = useState(null);
  const [backlog, setBacklog] = useState(null);

  // The backlog window is generous on purpose: catching up a month of loose
  // entries is one call, and the button should say how many that is before
  // spending anything.
  const backlogStart = addDays(date, -30);

  const loadStats = useCallback(async () => {
    try {
      const [d, b] = await Promise.all([fetchLinkStats(date, date), fetchLinkStats(backlogStart, addDays(date, -1))]);
      setDayStats(d);
      setBacklog(b);
    } catch {
      /* counts are a nicety; the buttons still work without them */
    }
  }, [date, backlogStart]);

  useEffect(() => {
    setResult(null);
    setApplied(0);
    loadStats();
  }, [loadStats]);

  // Loaded once and held: the picker has to open instantly, and the tree
  // doesn't change while you're reviewing a day.
  useEffect(() => {
    if (user?.id) fetchGoalPaths(user.id).then(setGoals).catch(() => {});
  }, [user?.id]);

  async function run(opts) {
    setLoading(true);
    setError(null);
    setApplied(0);
    try {
      const data = await suggestGoalLinks(opts);
      setResult(data);
      // Pre-check what the model is confident about; leave the rest to you.
      setChosen(new Set(data.links.filter((l) => l.confidence !== "low").map((l) => l.entry_id)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggle(id) {
    setChosen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Overriding a suggestion also includes the row — you went to the trouble
  // of picking, so the intent is obviously to link it. `edited` marks the row
  // so the confidence label can step aside for "yours".
  function setGoal(entryId, goalId, goalPath) {
    setResult((r) => ({
      ...r,
      links: r.links.map((l) =>
        l.entry_id === entryId ? { ...l, goal_id: goalId, goal_path: goalPath, edited: true } : l
      ),
    }));
    setChosen((prev) => new Set(prev).add(entryId));
    setEditing(null);
  }

  async function apply() {
    const links = result.links.filter((l) => chosen.has(l.entry_id));
    if (links.length === 0) return;
    setApplying(true);
    try {
      await applyGoalLinks(links);
      setApplied(links.length);
      setResult(null);
      await loadStats();
      await onApplied?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title"><Link2 size={14} />Link minutes to goals</span>
      </div>

      {!result && !loading && (
        <>
          <p className="card-note" style={{ margin: "0 0 12px" }}>
            {applied > 0 ? (
              <>Linked {applied} {applied === 1 ? "entry" : "entries"}.</>
            ) : (
              <>
                Read every description from this day and work out which goal each stretch of time actually fed.
                {dayStats?.total > 0 && (
                  <>
                    {" "}
                    <span className="faint">
                      {dayStats.total} {dayStats.total === 1 ? "entry" : "entries"} today
                      {dayStats.unlinked > 0 ? `, ${dayStats.unlinked} with no goal yet` : ", all currently linked by category"}.
                    </span>
                  </>
                )}
              </>
            )}
          </p>

          <button
            onClick={() => run({ start: date, end: date })}
            disabled={dayStats?.total === 0}
            className="btn-primary"
            style={{ width: "100%", margin: 0, minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <Sparkles size={15} />
            {dayStats?.total > 0 ? `Link today's ${dayStats.total} entries` : "Nothing logged today"}
          </button>

          {backlog?.unlinked > 0 && (
            <button
              onClick={() => run({ start: backlogStart, end: addDays(date, -1), onlyUnlinked: true })}
              className="btn-secondary"
              style={{ width: "100%", marginTop: 8 }}
            >
              Catch up {backlog.unlinked} unlinked from earlier days
            </button>
          )}
        </>
      )}

      {loading && <p className="empty">Reading the day…</p>}

      {error && <div className="form-error" style={{ margin: "10px 0 0" }}>{error}</div>}

      {result && result.links.length === 0 && (
        <p className="empty">Nothing to link on this day.</p>
      )}

      {result && result.links.length > 0 && (
        <>
          <p className="faint" style={{ fontSize: 11.5, margin: "-4px 0 10px" }}>
            Tap a row to include or exclude it, or press the goal underneath to change it. Low-confidence guesses start
            off, and "serves none" is a real answer — driving and meals usually do.
          </p>

          {result.links.map((link) => {
            const on = chosen.has(link.entry_id);
            const entry = result.entries?.find?.((e) => e.id === link.entry_id);
            return (
              <div
                key={link.entry_id}
                style={{
                  background: on ? "var(--inset)" : "transparent",
                  border: `1px solid ${on ? "var(--accent-line)" : "var(--line)"}`,
                  borderRadius: "var(--r)",
                  padding: "10px 12px",
                  marginBottom: 6,
                }}
              >
                <button
                  onClick={() => toggle(link.entry_id)}
                  className="row"
                  style={{ gap: 9, width: "100%", background: "none", border: "none", padding: 0, color: "inherit", textAlign: "left" }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 5,
                      border: `1px solid ${on ? "var(--accent)" : "var(--line-strong)"}`,
                      background: on ? "var(--accent)" : "transparent",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {on && <Check size={11} color="var(--on-accent)" />}
                  </span>
                  <span className="truncate" style={{ flex: 1, fontSize: 13, fontWeight: 570 }}>
                    {link.what ?? entry?.what ?? "Entry"}
                  </span>
                  {link.minutes > 0 && <span className="mono faint" style={{ fontSize: 10.5, flexShrink: 0 }}>{fmtMinutes(link.minutes)}</span>}
                  <span
                    className="mono"
                    style={{
                      fontSize: 9.5,
                      color: link.edited ? "var(--accent)" : CONFIDENCE_COLOR[link.confidence],
                      textTransform: "uppercase",
                      flexShrink: 0,
                    }}
                  >
                    {link.edited ? "yours" : link.confidence}
                  </span>
                </button>

                {/* The proposed goal is its own control, not a label. */}
                <button
                  onClick={() => setEditing(link.entry_id)}
                  className="row"
                  title="Change which goal this fed"
                  style={{
                    gap: 6,
                    marginTop: 7,
                    marginLeft: 25,
                    width: "calc(100% - 25px)",
                    background: "transparent",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--r-sm)",
                    padding: "6px 9px",
                    color: "inherit",
                    textAlign: "left",
                  }}
                >
                  <ArrowRight size={11} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                  <span className="truncate" style={{ flex: 1, fontSize: 11.5, color: link.goal_path ? "var(--accent)" : "var(--text-3)" }}>
                    {link.goal_path ?? "No goal — serves none"}
                  </span>
                  <Pencil size={11} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                </button>

                {link.why && !link.edited && (
                  <div className="faint" style={{ fontSize: 11, marginTop: 5, marginLeft: 25, lineHeight: 1.45 }}>{link.why}</div>
                )}
              </div>
            );
          })}

          {editing && (
            <GoalPicker
              goals={goals}
              value={result.links.find((l) => l.entry_id === editing)?.goal_id ?? null}
              onPick={(goalId, goalPath) => setGoal(editing, goalId, goalPath)}
              onClose={() => setEditing(null)}
            />
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => setResult(null)} className="btn-secondary">
              <X size={13} />
            </button>
            <button onClick={apply} disabled={applying || chosen.size === 0} className="btn-primary" style={{ width: "auto", flex: 1, margin: 0 }}>
              {applying ? "Linking…" : `Link ${chosen.size} ${chosen.size === 1 ? "entry" : "entries"}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
