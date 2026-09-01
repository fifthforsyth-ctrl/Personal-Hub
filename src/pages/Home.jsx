import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, GitBranch, PieChart, Maximize2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import useIsMobile from "../lib/useIsMobile";
import {
  fetchTree,
  fetchLifetimeByCategory,
  fetchDayArchive,
  fetchDayPlan,
  fetchTimeChunks,
  fetchTasks,
} from "../lib/api";
import { computeAllBrightness } from "../lib/heat";
import { computeWheel } from "../lib/wheel";
import PyramidWheel from "../components/tree/PyramidWheel";
import { Donut, Legend } from "../components/charts";
import AskClaude from "../components/AskClaude";
import Capture from "../components/Capture";
import { DayCard } from "../components/DayCard";
import { colorFor, fmtMinutes, setCategoryColors } from "../lib/categories";
import { fetchCategories } from "../lib/api";
import { todayStr, fmtDayHeading } from "../lib/planDates";

// One route, two front doors.
//
// On a desktop this is the thousand-foot view: the goal wheel and every
// minute you have ever logged, side by side, with a box you can ask questions
// into. On a phone it is the capture surface, because a phone gets picked up
// mid-day to record something, not to survey a life.
export default function Home() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  return isMobile ? <MobileHome userId={user?.id} /> : <DesktopHome userId={user?.id} />;
}

function MobileHome({ userId }) {
  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <div className="eyebrow">{fmtDayHeading(todayStr())}</div>
        <h1 className="page-title" style={{ fontSize: 21, marginTop: 2 }}>Capture</h1>
      </div>
      <Capture userId={userId} />
    </div>
  );
}

function DesktopHome({ userId }) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [lifetime, setLifetime] = useState([]);
  const [today, setToday] = useState(null);
  const [dayPlan, setDayPlan] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [askOpen, setAskOpen] = useState(false);
  const [active, setActive] = useState(null);
  const date = todayStr();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [tree, life, cats, archive, plan, ch, tk] = await Promise.all([
        fetchTree(userId).catch(() => ({ nodes: [], edges: [] })),
        fetchLifetimeByCategory().catch(() => []),
        fetchCategories(userId).catch(() => []),
        fetchDayArchive(date).catch(() => null),
        fetchDayPlan(userId, date).catch(() => null),
        fetchTimeChunks(userId, date).catch(() => []),
        fetchTasks(userId, date).catch(() => []),
      ]);
      if (cancelled) return;
      setCategoryColors(cats);
      setNodes(tree.nodes);
      setEdges(tree.edges);
      setLifetime(life);
      setToday(archive);
      setDayPlan(plan);
      setChunks(ch);
      setTasks(tk);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, date]);

  const brightnessById = useMemo(() => computeAllBrightness(nodes, edges), [nodes, edges]);
  const wheel = useMemo(() => computeWheel(nodes, edges, null), [nodes, edges]);

  // time_by_category returns one row per category/subcategory pair; the pie is
  // about categories, so fold the subcategories back in first.
  const slices = useMemo(() => {
    const totals = new Map();
    for (const r of lifetime) {
      totals.set(r.category, (totals.get(r.category) ?? 0) + (Number(r.total_minutes) || 0));
    }
    return [...totals.entries()]
      .map(([key, value]) => ({ key, value, color: colorFor(key) }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [lifetime]);

  const lifetimeTotal = slices.reduce((s, d) => s + d.value, 0);
  const todayRows = today?.time_by_category ?? [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{fmtDayHeading(date)}</div>
          <h1 className="page-title" style={{ marginTop: 3 }}>One day at a time</h1>
          <p className="page-sub">
            {lifetimeTotal > 0
              ? `${fmtMinutes(lifetimeTotal)} of your life accounted for, across ${slices.length} categories.`
              : "Nothing tracked yet — the wheel and the pie fill in from what you log."}
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {!askOpen && <AskClaude open={false} onOpenChange={setAskOpen} />}
          <Link to={`/day/${date}`} className="btn">
            Open today
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="stack">
        {askOpen && <AskClaude open onOpenChange={setAskOpen} />}

        <div className="dash">
          {/* The wheel. Read-only here on purpose — this is the survey, and
              editing a goal is a decision you make on the goals page. */}
          <div className="card card--flush" style={{ minHeight: 460, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0 }}>
              {nodes.length > 0 ? (
                <PyramidWheel
                  nodes={nodes}
                  edges={edges}
                  wheel={wheel}
                  brightnessById={brightnessById}
                  centerNodeId={null}
                  onSelectNode={() => {}}
                />
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
            <Link to="/tree" className="btn-icon btn-icon--bordered" style={{ position: "absolute", top: 12, right: 12 }} title="Open the goal tree">
              <Maximize2 size={14} />
            </Link>
          </div>

          {/* Every minute ever logged. Fourteen categories is past the point a
              ring alone can be read, so the ranked list beside it carries the
              exact comparison and the ring carries the shape. */}
          <div className="card">
            <div className="card-head">
              <span className="card-title"><PieChart size={14} />A lifetime of minutes</span>
              <span className="mono faint" style={{ fontSize: 11.5 }}>{slices.length} categories</span>
            </div>

            {slices.length === 0 ? (
              <p className="empty">Nothing logged yet.</p>
            ) : (
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
            )}
          </div>
        </div>

        {/* Today, as the same card object it is everywhere else. */}
        <div className="grid" style={{ gridTemplateColumns: "minmax(200px, 240px) 1fr", alignItems: "start" }}>
          <DayCard date={date} chunks={chunks} tasks={tasks} timeRows={todayRows} to={`/day/${date}`} banked={Boolean(dayPlan?.banked_at)} />
          <TodayGlance archive={today} chunks={chunks} tasks={tasks} date={date} synopsis={dayPlan?.synopsis} />
        </div>
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
              <span className="mono faint" style={{ fontSize: 10.5, width: 34, textAlign: "right" }}>
                {((s.value / total) * 100).toFixed(1)}%
              </span>
            </span>
          </button>
        ))}
      </div>
      {slices.length > 8 && (
        <button className="btn-link" style={{ marginTop: 8 }} onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show top 8" : `Show all ${slices.length}`}
        </button>
      )}
    </div>
  );
}

function TodayGlance({ archive, chunks, tasks, date, synopsis }) {
  const a = archive ?? {};
  const rows = a.time_by_category ?? [];
  const minutes = rows.reduce((s, r) => s + Number(r.minutes || 0), 0);
  const top = tasks.filter((t) => !t.parent_task_id);
  const done = top.filter((t) => t.status).length;
  const wins = (a.wins_losses ?? []).filter((w) => w.kind === "win").length;
  const losses = (a.wins_losses ?? []).filter((w) => w.kind === "loss").length;
  const reflected = Boolean(a.journal?.reflection_completed_at);

  return (
    <div className="stack">
      <div className="grid grid--stats">
        <Stat label="Tracked today" value={minutes > 0 ? fmtMinutes(minutes) : "—"} foot={`${(a.time_entries ?? []).length} entries`} />
        <Stat
          label="Tasks"
          value={top.length > 0 ? `${done}/${top.length}` : "—"}
          foot={top.length > 0 ? `${Math.round((done / top.length) * 100)}% complete` : "nothing planned"}
          accent={top.length > 0 && done === top.length}
        />
        <Stat label="Wins · losses" value={wins + losses > 0 ? `${wins} · ${losses}` : "—"} foot="today" />
        <Stat label="Blocks" value={String(chunks.length || "—")} foot={reflected ? "reflection done" : "not yet reflected"} />
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">{synopsis ? "Today, closed out" : "Where today went"}</span>
          <Link to={`/day/${date}`} className="btn-link">Open the day <ArrowRight size={12} /></Link>
        </div>
        {synopsis && <p className="prose prose--sm" style={{ marginBottom: rows.length ? 14 : 0 }}>{synopsis}</p>}
        {rows.length === 0 ? (
          !synopsis && <p className="empty">Nothing tracked yet today.</p>
        ) : (
          <>
            <div className="time-strip time-strip--tall">
              {rows.map((r) => (
                <i key={r.category} title={`${r.category} · ${fmtMinutes(r.minutes)}`} style={{ width: `${(Number(r.minutes) / minutes) * 100}%`, background: colorFor(r.category) }} />
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <Legend
                items={rows.slice(0, 8).map((r) => ({ key: r.category, value: Number(r.minutes), color: colorFor(r.category) }))}
                format={fmtMinutes}
              />
            </div>
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
