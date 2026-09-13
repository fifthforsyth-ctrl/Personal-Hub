import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Check, ArrowRight, X, Link2, Pencil } from "lucide-react";
import { suggestGoalLinks, applyGoalLinks, fetchLinkStats, fetchGoalPaths } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import GoalPicker from "./GoalPicker";
import { fmtMinutes } from "../lib/categories";
import { addDays } from "../lib/planDates";

// A page small enough that one request finishes well inside the Edge
// Function's 150-second wall clock. Measured: 25 entries take 23-34s, so 30
// leaves plenty of room.
const BATCH = 30;

// No page budget — "catch up" means catch up, and stopping at an arbitrary
// count just means pressing the button twelve times. This is only a runaway
// guard in case remaining_after ever stops shrinking.
const HARD_CAP_PAGES = 40;

// Past this many rows the list renders in chunks. All of them are still
// selected and still get written; it is the DOM that gives up, not the data.
const RENDER_CHUNK = 60;

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
  const [progress, setProgress] = useState(null);
  const [shown, setShown] = useState(RENDER_CHUNK);
  const stopRef = useRef(false);

  // The backlog window is generous on purpose, and the button says how many
  // entries it is about to read before anything is spent on them.
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

  // Walked a page at a time. A single 120-entry request needs more than the
  // 150 seconds Supabase gives an Edge Function and dies as a 504 having
  // decided nothing, so the loop lives here where it can show progress and
  // keep whatever it has already gathered if a later page fails.
  async function run({ start, end, onlyUnlinked = false }) {
    setLoading(true);
    setError(null);
    setApplied(0);
    setShown(RENDER_CHUNK);
    stopRef.current = false;
    setProgress({ done: 0, total: null, pages: 0 });

    const gathered = [];
    let offset = 0;
    let matching = null;
    let remaining = 0;

    try {
      for (let page = 0; page < HARD_CAP_PAGES; page++) {
        const data = await suggestGoalLinks({ start, end, onlyUnlinked, limit: BATCH, offset });
        gathered.push(...(data.links ?? []));
        matching = data.matching ?? matching;
        // An older server that doesn't report this would read as 0 and stop
        // the walk after one page, which is exactly the bug that made "catch
        // up" mean "catch up thirty". Unknown means keep going.
        remaining = data.remaining_after ?? null;
        offset += BATCH;
        setProgress({ done: gathered.length, total: matching, pages: page + 1 });
        if (remaining === 0 || (data.links ?? []).length === 0) break;
        if (stopRef.current) break;
      }
      setResult({ links: gathered, remaining: remaining ?? 0, matching, stopped: stopRef.current });
      // Pre-check what the model is confident about; leave the rest to you.
      setChosen(new Set(gathered.filter((l) => l.confidence !== "low").map((l) => l.entry_id)));
    } catch (err) {
      // A page failing shouldn't throw away the pages that worked.
      if (gathered.length > 0) {
        setResult({ links: gathered, remaining: remaining ?? 0, matching, partial: err.message });
        setChosen(new Set(gathered.filter((l) => l.confidence !== "low").map((l) => l.entry_id)));
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      setProgress(null);
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
                      {dayStats.unread > 0 ? `, ${dayStats.unread} not yet read` : ", all of them already read"}
                      {dayStats.serves_none > 0 && `, ${dayStats.serves_none} read and left serving nothing`}.
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

          {backlog?.unread > 0 && (
            <button
              onClick={() => run({ start: backlogStart, end: addDays(date, -1), onlyUnlinked: true })}
              className="btn-secondary"
              style={{ width: "100%", marginTop: 8 }}
            >
              Catch up {backlog.unread} unread from earlier days
            </button>
          )}

          {/* An entry the model read and left serving nothing has no goal,
              which looks exactly like an entry nobody has touched. Saying so
              is the difference between "caught up" and "still 106 to go". */}
          {backlog?.unread === 0 && backlog?.total > 0 && (
            <p className="faint" style={{ fontSize: 11.5, margin: "10px 0 0", textAlign: "center" }}>
              Earlier days are caught up — {backlog.linked} linked
              {backlog.serves_none > 0 && `, ${backlog.serves_none} read and serving nothing`}.
            </p>
          )}
        </>
      )}

      {loading && (
        <div style={{ padding: "14px 0" }}>
          <p className="empty" style={{ margin: 0 }}>
            {progress?.done > 0
              ? `Read ${progress.done}${progress.total ? ` of ${progress.total}` : ""}…`
              : "Reading…"}
          </p>
          {progress?.total > 0 && (
            <div style={{ height: 5, background: "var(--inset)", borderRadius: 3, overflow: "hidden", margin: "9px 0 10px" }}>
              <div
                style={{
                  width: `${Math.min(100, (progress.done / progress.total) * 100)}%`,
                  height: "100%",
                  background: "var(--accent)",
                  borderRadius: 3,
                  transition: "width 300ms ease",
                }}
              />
            </div>
          )}
          <p className="faint" style={{ fontSize: 11.5, margin: 0, textAlign: "center" }}>
            A few minutes for a long backlog. Leave this open.
          </p>
          <button
            className="btn-link"
            style={{ margin: "8px auto 0", display: "block" }}
            onClick={() => {
              stopRef.current = true;
            }}
          >
            Stop and review what's read
          </button>
        </div>
      )}

      {error && <div className="form-error" style={{ margin: "10px 0 0" }}>{error}</div>}

      {result && result.links.length === 0 && (
        <p className="empty">Nothing to link on this day.</p>
      )}

      {result && result.links.length > 0 && (
        <>
          {result.partial && (
            <div className="form-error" style={{ margin: "0 0 10px" }}>
              Stopped early — {result.partial} The {result.links.length} already read are below and still worth
              accepting.
            </div>
          )}

          <p className="faint" style={{ fontSize: 11.5, margin: "-4px 0 10px" }}>
            {result.links.filter((l) => l.changed).length} of {result.links.length} would change. Tap a row to include or
            exclude it, or press the goal underneath to change it. Low-confidence guesses start off, and "serves none" is
            a real answer — driving and meals usually do.
            {result.stopped && " Stopped early, at your ask."}
            {result.remaining > 0 && ` ${result.remaining} more are waiting — accept these, then press again.`}
          </p>

          {/* A backlog of three hundred is not read row by row. These are how
              you actually work through one: take the confident ones wholesale,
              then scan for the handful that look wrong. */}
          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <button className="btn-link" onClick={() => setChosen(new Set(result.links.map((l) => l.entry_id)))}>
              All
            </button>
            <button className="btn-link" onClick={() => setChosen(new Set())}>
              None
            </button>
            <button
              className="btn-link"
              onClick={() => setChosen(new Set(result.links.filter((l) => l.confidence === "high").map((l) => l.entry_id)))}
            >
              High confidence only
            </button>
            <span className="mono faint" style={{ fontSize: 10.5, marginLeft: "auto" }}>
              {chosen.size} selected
            </span>
          </div>

          {result.links.slice(0, shown).map((link) => {
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

                {link.changed && link.current_goal && (
                  <div className="faint" style={{ fontSize: 10.5, marginTop: 5, marginLeft: 25, lineHeight: 1.45 }}>
                    was {link.current_goal}
                    {link.current_source === "mapping" ? " (category default)" : ""}
                  </div>
                )}

                {link.why && !link.edited && (
                  <div className="faint" style={{ fontSize: 11, marginTop: 5, marginLeft: 25, lineHeight: 1.45 }}>{link.why}</div>
                )}
              </div>
            );
          })}

          {result.links.length > shown && (
            <button className="btn-secondary" style={{ width: "100%", marginBottom: 8 }} onClick={() => setShown((n) => n + RENDER_CHUNK)}>
              Show {Math.min(RENDER_CHUNK, result.links.length - shown)} more of {result.links.length - shown}
            </button>
          )}

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
