import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, GitBranch, PieChart, Maximize2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchTree,
  fetchLifetimeByCategory,
  fetchDayArchive,
  fetchDayPlan,
  fetchDayRings,
  fetchTimeChunks,
  fetchTasks,
  fetchCategories,
} from "../lib/api";
import { useLoad } from "../lib/useLoad";
import LoadError from "../components/ui/LoadError";
import { computeAllBrightness } from "../lib/heat";
import { computeWheel } from "../lib/wheel";
import PyramidWheel from "../components/tree/PyramidWheel";
import { Donut, Legend } from "../components/charts";
import AskClaude from "../components/AskClaude";
import CuratedCards from "../components/curator/CuratedCards";
import PurchaseQuestion from "../components/money/PurchaseQuestion";
import { DayCard } from "../components/DayCard";
import { useOutbox, withTaps } from "../components/today/tapOutbox";
import { trackedMinutes, OVERLAP_NOTE } from "../components/today/minutes";
import { colorFor, fmtMinutes, setCategoryColors } from "../lib/categories";
import { todayStr, fmtDayHeading } from "../lib/planDates";
import { useBackOnline } from "../components/today/useBackOnline";
import "../styles/daily.css";

async function loadOverview(userId, date) {
  const [tree, lifetime, archive, dayPlan, chunks, tasks, cats, rings] = await Promise.all([
    fetchTree(userId),
    fetchLifetimeByCategory(),
    fetchDayArchive(date),
    fetchDayPlan(userId, date),
    fetchTimeChunks(userId, date),
    fetchTasks(userId, date),
    // Colours and the clock face: the page still opens without them.
    fetchCategories(userId).catch((err) => {
      console.warn(err);
      return null;
    }),
    fetchDayRings(date, date).catch((err) => {
      console.warn(err);
      return null;
    }),
  ]);
  if (cats) setCategoryColors(cats);
  return { nodes: tree.nodes, edges: tree.edges, lifetime, today: archive ?? {}, dayPlan, chunks, tasks, arcs: rings?.get(date) ?? [] };
}

// The big picture: the goal wheel and every minute you've ever logged, side
// by side, with a box you can ask questions into. This was the desktop home
// before Today took that place; it lives under More now, for the evenings
// you want the thousand-foot view.
export default function Overview() {
  const { user } = useAuth();
  return <DesktopHome userId={user?.id} />;
}

function DesktopHome({ userId }) {
  const date = todayStr();
  const { data, error, loading, reload } = useLoad(() => loadOverview(userId, date), [userId, date]);
  const [askOpen, setAskOpen] = useState(false);
  // Once asked, the answer stays put: closing the card hides it rather than
  // throwing the question and the chart away.
  const [askUsed, setAskUsed] = useState(false);
  const [active, setActive] = useState(null);

  // Something captured from the sheet over this page shows up here too.
  useEffect(() => {
    window.addEventListener("hub:changed", reload);
    return () => window.removeEventListener("hub:changed", reload);
  }, [reload]);
  useBackOnline(reload, Boolean(error));

  const nodes = data?.nodes ?? [];
  const edges = data?.edges ?? [];
  const brightnessById = useMemo(() => computeAllBrightness(nodes, edges), [nodes, edges]);
  const wheel = useMemo(() => computeWheel(nodes, edges, null), [nodes, edges]);

  // time_by_category returns one row per category/subcategory pair; the pie is
  // about categories, so fold the subcategories back in first.
  const slices = useMemo(() => {
    const totals = new Map();
    for (const r of data?.lifetime ?? []) {
      totals.set(r.category, (totals.get(r.category) ?? 0) + (Number(r.total_minutes) || 0));
    }
    return [...totals.entries()]
      .map(([key, value]) => ({ key, value, color: colorFor(key) }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [data?.lifetime]);

  const lifetimeTotal = slices.reduce((s, d) => s + d.value, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          {/* The nav calls this page Big picture; the heading is its motto. */}
          <div className="eyebrow">Big picture · {fmtDayHeading(date)}</div>
          <h1 className="page-title" style={{ marginTop: 3 }}>One day at a time</h1>
          <p className="page-sub">
            {!data
              ? "The goal wheel and every minute you've logged."
              : slices.length > 0
                ? `Everything you've logged, across ${slices.length} categories.`
                : "Nothing tracked yet. The wheel and the pie fill in from what you log."}
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {!askOpen && (
            <AskClaude
              open={false}
              onOpenChange={(open) => {
                setAskOpen(open);
                if (open) setAskUsed(true);
              }}
            />
          )}
          <Link to={`/day/${date}`} className="btn btn--on-page">
            Full day
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="stack">
        {askUsed && (
          <div hidden={!askOpen}>
            <AskClaude open onOpenChange={setAskOpen} />
          </div>
        )}

        {error && <LoadError what="the big picture" error={error} onRetry={reload} stale={Boolean(data)} />}

        {!data ? (
          loading && <p className="empty">Reading the big picture…</p>
        ) : (
          <div className="dash">
            {/* The wheel. Read-only here on purpose: this is the survey, and
                editing a goal is a decision you make on the goals page. */}
            <div className="card card--flush" style={{ minHeight: 460, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0 }}>
                {nodes.length > 0 ? (
                  <PyramidWheel nodes={nodes} edges={edges} wheel={wheel} brightnessById={brightnessById} centerNodeId={null} onSelectNode={() => {}} />
                ) : (
                  <div style={{ display: "grid", placeItems: "center", height: "100%", padding: 30 }}>
                    <p className="empty" style={{ textAlign: "center" }}>
                      No goals yet. Start with who you're trying to become, then break it down toward what that looks like today.
                    </p>
                  </div>
                )}
              </div>
              <div className="row" style={{ position: "absolute", top: 14, left: 14, gap: 8, pointerEvents: "none" }}>
                <span className="chip" style={{ background: "var(--surface)" }}>
                  <GitBranch size={12} />
                  Goal wheel
                </span>
              </div>
              <Link
                to="/tree"
                className="btn-icon btn-icon--bordered"
                style={{ position: "absolute", top: 12, right: 12 }}
                aria-label="Open the goal wheel"
                title="Open the goal wheel"
              >
                <Maximize2 size={14} />
              </Link>
            </div>

            {/* Every minute ever logged. Fourteen categories is past the point a
                ring alone can be read, so the ranked list beside it carries the
                exact comparison and the ring carries the shape. */}
            <div className="card">
              <div className="card-head">
                <span className="card-title"><PieChart size={14} />A lifetime of minutes</span>
                <span className="mono muted" style={{ fontSize: 11.5 }}>{slices.length} categories</span>
              </div>

              {slices.length === 0 ? (
                <p className="empty">Nothing logged yet.</p>
              ) : (
                <>
                  <div className="row" style={{ gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <Donut
                      slices={slices}
                      size={236}
                      thickness={30}
                      format={fmtMinutes}
                      centerLabel="All time"
                      centerValue={fmtMinutes(lifetimeTotal)}
                      activeKey={active}
                      onHover={setActive}
                    />
                    <div style={{ flex: "1 1 190px", minWidth: 0 }}>
                      <LifetimeList slices={slices} total={lifetimeTotal} active={active} onHover={setActive} />
                    </div>
                  </div>
                  <p className="minutes-note">Categories overlap, so these add up to more than the time tracked.</p>
                </>
              )}
            </div>
          </div>
        )}

        <CuratedCards slot="home" title="For today" />

        <PurchaseQuestion />

        {/* Today, as the same card object it is everywhere else. "Tracked"
            is the entries end to end, so it agrees with the stats beside it. */}
        {data && (
          <div className="grid overview-today">
            <DayCard
              date={date}
              chunks={data.chunks}
              tasks={data.tasks}
              timeRows={data.today.time_by_category ?? []}
              tracked={trackedMinutes((data.today.time_entries ?? []).filter((e) => e.ended_at))}
              ringArcs={data.arcs}
              to={`/day/${date}`}
              banked={Boolean(data.dayPlan?.banked_at)}
            />
            <TodayGlance userId={userId} archive={data.today} tasks={data.tasks} date={date} synopsis={data.dayPlan?.synopsis} />
          </div>
        )}
      </div>
    </div>
  );
}

function LifetimeList({ slices, total, active, onHover }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? slices : slices.slice(0, 8);

  return (
    <div>
      <div className="stack" style={{ gap: 6 }}>
        {shown.map((s) => (
          <button
            key={s.key}
            className="row row--between"
            style={{
              width: "100%",
              background: "none",
              border: "none",
              padding: "3px 0",
              color: "inherit",
              opacity: active && active !== s.key ? 0.38 : 1,
              transition: "opacity 0.12s",
            }}
            onMouseEnter={() => onHover(s.key)}
            onMouseLeave={() => onHover(null)}
          >
            <span className="row" style={{ gap: 8, minWidth: 0 }}>
              <span className="dot" style={{ background: s.color }} />
              <span className="truncate" style={{ fontSize: 12.5, fontWeight: 500 }}>{s.key}</span>
            </span>
            <span className="row" style={{ gap: 8, flexShrink: 0 }}>
              <span className="mono" style={{ fontSize: 11.5 }}>{fmtMinutes(s.value)}</span>
              <span className="mono muted" style={{ fontSize: 10.5, width: 34, textAlign: "right" }}>
                {((s.value / total) * 100).toFixed(1)}%
              </span>
            </span>
          </button>
        ))}
      </div>
      {slices.length > 8 && (
        <button className="btn-link" style={{ marginTop: 8, minHeight: 32 }} onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show top 8" : `Show all ${slices.length}`}
        </button>
      )}
    </div>
  );
}

// Today in four numbers and a strip. Wins only: losses belong to the evening.
function TodayGlance({ userId, archive: a, tasks, date, synopsis }) {
  const outbox = useOutbox();
  const rows = a.time_by_category ?? [];
  const entries = (a.time_entries ?? []).filter((e) => e.ended_at);
  const tracked = trackedMinutes(entries);
  const catTotal = rows.reduce((s, r) => s + Number(r.minutes || 0), 0);
  const top = tasks.filter((t) => !t.parent_task_id);
  const done = top.filter((t) => t.status).length;
  const wins = withTaps(a.wins_losses, outbox, { userId, date, kind: "win" }).length;
  const reflected = Boolean(a.journal?.reflection_completed_at);

  return (
    <div className="stack">
      <div className="grid grid--stats">
        <Stat label="Tracked today" value={tracked > 0 ? fmtMinutes(tracked) : "—"} foot={entries.length === 1 ? "1 entry" : `${entries.length} entries`} />
        <Stat
          label="Tasks"
          value={top.length > 0 ? `${done}/${top.length}` : "—"}
          foot={top.length > 0 ? `${Math.round((done / top.length) * 100)}% complete` : "nothing planned"}
          accent={top.length > 0 && done === top.length}
        />
        <Stat label="Wins" value={wins > 0 ? String(wins) : "—"} foot="today" />
        <Stat label="Reflection" value={reflected ? "Done" : "Not yet"} foot="this evening" />
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">{synopsis ? "Today, closed out" : "Where today went"}</span>
          <Link to={`/day/${date}`} className="btn-link" style={{ minHeight: 32 }}>
            Full day <ArrowRight size={12} />
          </Link>
        </div>
        {synopsis && <p className="prose prose--sm" style={{ marginBottom: rows.length ? 14 : 0 }}>{synopsis}</p>}
        {rows.length === 0 ? (
          !synopsis && <p className="empty">Nothing tracked yet today.</p>
        ) : (
          <>
            <div className="time-strip time-strip--tall">
              {rows.map((r) => (
                <i key={r.category} title={`${r.category} · ${fmtMinutes(r.minutes)}`} style={{ width: `${(Number(r.minutes) / catTotal) * 100}%`, background: colorFor(r.category) }} />
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <Legend items={rows.map((r) => ({ key: r.category, value: Number(r.minutes), color: colorFor(r.category) }))} format={fmtMinutes} />
            </div>
            {catTotal > tracked + 0.5 && <p className="minutes-note">{OVERLAP_NOTE}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, foot, accent }) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
      </div>
      <div className={"stat-value" + (accent ? " stat-value--accent" : "")}>{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  );
}
