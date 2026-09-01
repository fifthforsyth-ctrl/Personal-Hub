import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  Flame,
  HandHeart,
  BookOpen,
  Plus,
  Minus,
  CheckSquare,
  Archive as ArchiveIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchDayArchive,
  fetchDayPlan,
  fetchTimeChunks,
  fetchTasks,
  fetchGoalOptions,
  fetchCategories,
  unbankDay,
} from "../lib/api";
import DayView from "../components/plan/DayView";
import GoalFruits from "../components/GoalFruits";
import GoalLinkSuggestions from "../components/GoalLinkSuggestions";
import ReflectionFlow from "../components/day/ReflectionFlow";
import Tomorrow from "../components/day/Tomorrow";
import CloseOut from "../components/day/CloseOut";
import BankedDayCard from "../components/day/BankedDayCard";
import { MinutesView } from "../components/Capture";
import { Legend } from "../components/charts";
import { colorFor, fmtMinutes, setCategoryColors } from "../lib/categories";
import { todayStr, addDays, fmtDayHeading, parseDateStr } from "../lib/planDates";
import { toPlainText } from "../lib/markdown";

const KIND_LABEL = {
  prompting: "Prompting",
  impression: "Impression",
  answer: "Answer",
  tender_mercy: "Tender mercy",
  comfort: "Comfort",
  warning: "Warning",
  insight: "Insight",
};

function timeOf(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// The day card, expanded.
//
// This is the one page that used to be three — the plan lived under Plan, the
// capture under Today, the record under Archive, and reflecting on a day meant
// holding all three in your head at once. Here it runs top to bottom in the
// order the evening actually goes: what you planned, what you did, what it
// fed, what you make of it, and only then what tomorrow looks like.
export default function Day() {
  const { user } = useAuth();
  const { date: dateParam } = useParams();
  const navigate = useNavigate();
  const date = dateParam ?? todayStr();

  const [archive, setArchive] = useState(null);
  const [dayPlan, setDayPlan] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [goalOptions, setGoalOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [a, plan, ch, tk, cats] = await Promise.all([
        fetchDayArchive(date).catch(() => null),
        fetchDayPlan(user.id, date).catch(() => null),
        fetchTimeChunks(user.id, date).catch(() => []),
        fetchTasks(user.id, date).catch(() => []),
        fetchCategories(user.id).catch(() => []),
      ]);
      setCategoryColors(cats);
      setDayPlan(plan);
      setArchive(a);
      setChunks(ch);
      setTasks(tk);
      setVersion((v) => v + 1);
    } finally {
      setLoading(false);
    }
  }, [user?.id, date]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (user?.id) fetchGoalOptions(user.id).then(setGoalOptions).catch(() => {});
  }, [user?.id]);

  // day_archive doesn't carry the day_plan row, and the banked card needs its
  // synopsis and timestamp — so they're merged in here rather than widening
  // the RPC for two columns.
  const a = { ...(archive ?? {}), synopsis: dayPlan?.synopsis, banked_at: dayPlan?.banked_at };
  const banked = Boolean(dayPlan?.banked_at);
  const isToday = date === todayStr();
  const timeRows = a.time_by_category ?? [];
  const totalMinutes = timeRows.reduce((s, r) => s + Number(r.minutes || 0), 0);
  const topTasks = tasks.filter((t) => !t.parent_task_id);
  const tasksDone = topTasks.filter((t) => t.status).length;
  const pct = topTasks.length > 0 ? Math.round((tasksDone / topTasks.length) * 100) : null;
  const wins = (a.wins_losses ?? []).filter((w) => w.kind === "win");
  const losses = (a.wins_losses ?? []).filter((w) => w.kind === "loss");
  const reflectionDone = Boolean(a.journal?.reflection_completed_at);

  const notes = a.study_notes ?? [];
  const prayers = a.prayers ?? [];
  const experiences = a.experiences ?? [];

  return (
    <div className="page">
      <div className="page-head">
        <div className="row" style={{ gap: 12 }}>
          <button className="btn-icon btn-icon--bordered" onClick={() => navigate(`/day/${addDays(date, -1)}`)} title="Previous day">
            <ChevronLeft size={16} />
          </button>
          <div>
            <div className="eyebrow">{isToday ? "Today" : parseDateStr(date).toLocaleDateString(undefined, { year: "numeric" })}</div>
            <h1 className="page-title" style={{ marginTop: 2 }}>{fmtDayHeading(date)}</h1>
          </div>
          <button className="btn-icon btn-icon--bordered" onClick={() => navigate(`/day/${addDays(date, 1)}`)} title="Next day">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="row" style={{ gap: 8 }}>
          {a.energy_tag && <span className="chip">{a.energy_tag}</span>}
          {banked ? (
            <span className="chip chip--accent"><ArchiveIcon size={12} />Banked</span>
          ) : (
            reflectionDone && <span className="chip chip--accent">Reflected</span>
          )}
          {!isToday && (
            <button className="btn" onClick={() => navigate(`/day/${todayStr()}`)}>
              <CalendarDays size={14} />
              Today
            </button>
          )}
        </div>
      </div>

      {/* A banked day is finished, so it opens as the finished thing. The
          working surfaces are still one press away if something needs fixing. */}
      {banked && (
        <BankedDayCard
          date={date}
          archive={a}
          chunks={chunks}
          tasks={tasks}
          onReopen={async () => {
            await unbankDay(user.id, date);
            await reload();
          }}
        />
      )}

      {/* What kind of day was this — the four numbers, before any detail. */}
      {!banked && (
      <>
      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <Stat label="Time tracked" value={totalMinutes > 0 ? fmtMinutes(totalMinutes) : "—"} foot={`${(a.time_entries ?? []).length} entries`} />
        <Stat
          label="Tasks completed"
          value={pct != null ? `${pct}%` : "—"}
          foot={topTasks.length > 0 ? `${tasksDone} of ${topTasks.length}` : "nothing planned"}
          accent={pct === 100}
        />
        <Stat label="Wins · losses" value={wins.length + losses.length > 0 ? `${wins.length} · ${losses.length}` : "—"} foot="recorded today" />
        <Stat label="Written" value={String(prayers.length + experiences.length + notes.length || "—")} foot="prayers, promptings, notes" />
      </div>

      {timeRows.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <span className="card-title"><Clock size={14} />Where the day went</span>
            <span className="mono faint" style={{ fontSize: 11.5 }}>{fmtMinutes(totalMinutes)}</span>
          </div>
          <div className="time-strip time-strip--tall">
            {timeRows.map((r) => (
              <i key={r.category} title={`${r.category} · ${fmtMinutes(r.minutes)}`} style={{ width: `${(Number(r.minutes) / totalMinutes) * 100}%`, background: colorFor(r.category) }} />
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Legend
              items={timeRows.map((r) => ({ key: r.category, value: Number(r.minutes), color: colorFor(r.category) }))}
              format={fmtMinutes}
            />
          </div>
        </div>
      )}

      <div className="grid grid--halves" style={{ alignItems: "start" }}>
        {/* Left: the plan, and everything you'd change about it. */}
        <div className="stack">
          <div className="card card--quiet" style={{ padding: 0, border: "none", background: "transparent" }}>
            <div className="card-head" style={{ marginBottom: 10 }}>
              <span className="card-title"><CheckSquare size={14} />The plan</span>
              {pct != null && <span className="mono faint" style={{ fontSize: 11.5 }}>{tasksDone}/{topTasks.length} done</span>}
            </div>
            <DayView userId={user?.id} date={date} goalOptions={goalOptions} onDataChanged={reload} />
          </div>
        </div>

        {/* Right: what actually happened, then what you make of it. */}
        <div className="stack">
          <MinutesView userId={user?.id} compact onChanged={reload} />

          <GoalLinkSuggestions date={date} onApplied={reload} />

          <GoalFruits key={`fruits-${date}-${version}`} startDate={date} endDate={date} title="What today fed" />

          {(experiences.length > 0 || prayers.length > 0 || notes.length > 0) && (
            <WrittenToday experiences={experiences} prayers={prayers} notes={notes} />
          )}

          {(wins.length > 0 || losses.length > 0) && (
            <div className="card">
              <div className="card-head"><span className="card-title">Wins &amp; losses</span></div>
              <div className="list">
                {[...wins, ...losses].map((w) => (
                  <div key={w.id} className="list-row">
                    <span style={{ color: w.kind === "win" ? "var(--accent)" : "var(--text-3)", display: "flex", flexShrink: 0 }}>
                      {w.kind === "win" ? <Plus size={14} /> : <Minus size={14} />}
                    </span>
                    <span className="truncate" style={{ flex: 1 }}>{w.habit_label}</span>
                    <span className="list-row__meta">{timeOf(w.occurred_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ReflectionFlow userId={user?.id} date={date} journal={a.journal} onSaved={reload} />

          <Tomorrow userId={user?.id} date={date} reflectionDone={reflectionDone} />

          <CloseOut userId={user?.id} date={date} reflectionDone={reflectionDone} onBanked={reload} />
        </div>
      </div>
      </>
      )}

      {loading && !archive && <p className="empty" style={{ marginTop: 16 }}>Reading the day…</p>}
    </div>
  );
}

function Stat({ label, value, foot, accent }) {
  return (
    <div className="stat">
      <div className="stat-top"><span className="stat-label">{label}</span></div>
      <div className={"stat-value" + (accent ? " stat-value--accent" : "")}>{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  );
}

// Everything you wrote down today, in one card rather than three — promptings,
// prayers, and whatever came over from Obsidian.
function WrittenToday({ experiences, prayers, notes }) {
  return (
    <div className="card">
      <div className="card-head"><span className="card-title">What you wrote today</span></div>

      {experiences.length > 0 && (
        <Group icon={Flame} title="What came">
          {experiences.map((e) => (
            <div key={e.id} style={{ padding: "9px 0" }}>
              <div className="row row--between">
                <span className="chip" style={{ fontSize: 10.5 }}>{KIND_LABEL[e.kind] ?? e.kind}</span>
                <span className="list-row__meta">{timeOf(e.occurred_at)}</span>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 550, marginTop: 5 }}>{e.what_came}</div>
              {e.action_taken && <div style={{ fontSize: 12.5, color: "var(--accent)", marginTop: 3 }}>Acted: {e.action_taken}</div>}
              {!e.acted_on && <div className="faint" style={{ fontSize: 11.5, marginTop: 3 }}>Still open</div>}
            </div>
          ))}
        </Group>
      )}

      {prayers.length > 0 && (
        <Group icon={HandHeart} title="Prayers">
          {prayers.map((p) => (
            <div key={p.id} style={{ padding: "9px 0" }}>
              <div className="row row--between">
                <span style={{ fontWeight: 570, fontSize: 13 }}>{p.context || "Prayer"}</span>
                <span className="list-row__meta">{timeOf(p.prayed_at)}</span>
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{p.content}</div>
              {p.felt_response && <div style={{ fontSize: 12.5, color: "var(--accent)", marginTop: 2 }}>Felt: {p.felt_response}</div>}
            </div>
          ))}
        </Group>
      )}

      {notes.length > 0 && (
        <Group icon={BookOpen} title="Notes">
          {notes.map((n) => (
            <div key={n.id} style={{ padding: "9px 0" }}>
              <div className="row row--between">
                <span className="truncate" style={{ fontWeight: 570, fontSize: 13 }}>{n.title}</span>
                {n.source_ref && <span className="list-row__meta">{n.source_ref}</span>}
              </div>
              {n.ai_theme && <div className="chip" style={{ marginTop: 5, fontSize: 10.5 }}>{n.ai_theme}</div>}
              {n.ai_summary && <div className="muted" style={{ fontSize: 12.5, marginTop: 5, lineHeight: 1.55 }}>{toPlainText(n.ai_summary)}</div>}
            </div>
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({ icon: Icon, title, children }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <Icon size={11} />
        {title}
      </div>
      <div className="list">{children}</div>
    </div>
  );
}
