import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  CalendarPlus,
  Clock,
  Flame,
  HandHeart,
  BookOpen,
  Plus,
  CheckSquare,
  Link2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchDayArchive,
  fetchDayPlan,
  fetchTimeChunks,
  fetchTasks,
  fetchGoalOptions,
  fetchCategories,
  fetchDayRings,
  unbankDay,
} from "../lib/api";
import { useLoad } from "../lib/useLoad";
import LoadError from "../components/ui/LoadError";
import DayView from "../components/plan/DayView";
import GoalFruits from "../components/GoalFruits";
import GoalLinkSuggestions from "../components/GoalLinkSuggestions";
import ReflectionFlow from "../components/day/ReflectionFlow";
import Tomorrow from "../components/day/Tomorrow";
import CloseOut from "../components/day/CloseOut";
import CuratedCards from "../components/curator/CuratedCards";
import BankedDayCard from "../components/day/BankedDayCard";
import { MinutesView } from "../components/MinutesView";
import DayRing, { RingLegend } from "../components/DayRing";
import TapEditor from "../components/today/TapEditor";
import { useOutbox, withTaps, isUnnamed } from "../components/today/tapOutbox";
import { trackedMinutes, minutesByCategory, timeOf } from "../components/today/minutes";
import { colorFor, fmtMinutes, setCategoryColors } from "../lib/categories";
import { todayStr, addDays, fmtDayHeading, parseDateStr } from "../lib/planDates";
import { toPlainText } from "../lib/markdown";
import { useBackOnline } from "../components/today/useBackOnline";
import "../styles/daily.css";

const KIND_LABEL = {
  prompting: "Prompting",
  impression: "Impression",
  answer: "Answer",
  tender_mercy: "Tender mercy",
  comfort: "Comfort",
  warning: "Warning",
  insight: "Insight",
};

async function loadDay(userId, date) {
  const [archive, dayPlan, chunks, tasks, cats, rings] = await Promise.all([
    fetchDayArchive(date),
    fetchDayPlan(userId, date),
    fetchTimeChunks(userId, date),
    fetchTasks(userId, date),
    // Colours and the clock face: the day still opens without them.
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
  return { archive: archive ?? {}, dayPlan, chunks, tasks, ringArcs: rings?.get(date) ?? [] };
}

// The day card, expanded.
//
// This is the one page that used to be three: the plan lived under Plan, the
// capture under Today, the record under Archive, and reflecting on a day meant
// holding all three in your head at once. Here it runs top to bottom in the
// order the evening actually goes: what you planned, what you did, what you
// make of it, and only then what tomorrow looks like.
//
// Any day can be opened, and everything on it is that day's: its minutes,
// its wins, its reflection.
export default function Day() {
  const { user } = useAuth();
  const userId = user?.id;
  const { date: dateParam } = useParams();
  const navigate = useNavigate();
  const date = dateParam ?? todayStr();
  const isToday = date === todayStr();

  const { data, error, loading, reload } = useLoad(() => loadDay(userId, date), [userId, date]);
  const { data: goalOptions } = useLoad(() => fetchGoalOptions(userId), [userId]);

  // A win or minutes captured from the sheet over this page show up here too.
  useEffect(() => {
    window.addEventListener("hub:changed", reload);
    return () => window.removeEventListener("hub:changed", reload);
  }, [reload]);
  useBackOnline(reload, Boolean(error));

  // day_archive doesn't carry the day_plan row, and the banked card needs its
  // synopsis and timestamp, so they're merged in here rather than widening
  // the RPC for two columns.
  const a = { ...(data?.archive ?? {}), synopsis: data?.dayPlan?.synopsis, banked_at: data?.dayPlan?.banked_at };
  const banked = Boolean(data?.dayPlan?.banked_at);
  const reflectionDone = Boolean(a.journal?.reflection_completed_at);
  // The weekday rides in the eyebrow so the title fits between the arrows on
  // a phone, even on a Wednesday in September.
  const day = parseDateStr(date);
  const weekday = day.toLocaleDateString(undefined, { weekday: "long" });
  const year = day.toLocaleDateString(undefined, { year: "numeric" });
  const monthDay = day.toLocaleDateString(undefined, { month: "long", day: "numeric" });

  return (
    <div className="page day-page">
      <div className="page-head">
        <div className="row" style={{ gap: 12 }}>
          <button
            className="btn-icon btn-icon--bordered"
            onClick={() => navigate(`/day/${addDays(date, -1)}`)}
            aria-label="Previous day"
            title="Previous day"
          >
            <ChevronLeft size={16} />
          </button>
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">{weekday} · {isToday ? "Today" : year}</div>
            <h1 className="page-title" style={{ marginTop: 2 }} aria-label={fmtDayHeading(date)}>{monthDay}</h1>
          </div>
          <button
            className="btn-icon btn-icon--bordered"
            onClick={() => navigate(`/day/${addDays(date, 1)}`)}
            aria-label="Next day"
            title="Next day"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {a.energy_tag && <span className="chip">{a.energy_tag}</span>}
          {/* A banked day's card carries its own "Banked". */}
          {!banked && reflectionDone && <span className="chip chip--accent">Reflected</span>}
          {!isToday && (
            <button className="btn btn--on-page" onClick={() => navigate(`/day/${todayStr()}`)}>
              <CalendarDays size={14} />
              Today
            </button>
          )}
        </div>
      </div>

      {error && data && <LoadError what="this day" error={error} onRetry={reload} stale className="day-page__error" />}

      {/* Only the heading until the day is here: the working layout drawn
          with dashes, then swapped for the banked card, is worse than a
          moment of nothing. */}
      {!data ? (
        error ? <LoadError what="this day" error={error} onRetry={reload} /> : loading && <p className="empty">Reading the day…</p>
      ) : banked ? (
        // A banked day is finished, so it opens as the finished thing. The
        // working surfaces are one press away if something needs fixing.
        <BankedDayCard
          userId={userId}
          date={date}
          archive={a}
          chunks={data.chunks}
          tasks={data.tasks}
          onReopen={async () => {
            await unbankDay(userId, date);
            await reload();
          }}
          onChanged={reload}
        />
      ) : (
        <WorkingDay
          userId={userId}
          date={date}
          isToday={isToday}
          archive={a}
          tasks={data.tasks}
          ringArcs={data.ringArcs}
          goalOptions={goalOptions ?? []}
          reflectionDone={reflectionDone}
          reload={reload}
        />
      )}
    </div>
  );
}

function WorkingDay({ userId, date, isToday, archive: a, tasks, ringArcs, goalOptions, reflectionDone, reload }) {
  const outbox = useOutbox();
  const entries = (a.time_entries ?? []).filter((e) => e.ended_at);
  const tracked = trackedMinutes(entries);
  const byCategory = minutesByCategory(entries);
  const catTotal = byCategory.reduce((s, r) => s + r.minutes, 0);
  const topTasks = tasks.filter((t) => !t.parent_task_id);
  const tasksDone = topTasks.filter((t) => t.status).length;
  const pct = topTasks.length > 0 ? Math.round((tasksDone / topTasks.length) * 100) : null;
  // Wins only: losses belong to the evening.
  const wins = withTaps(a.wins_losses, outbox, { userId, date, kind: "win" });

  const notes = a.study_notes ?? [];
  const prayers = a.prayers ?? [];
  const experiences = a.experiences ?? [];
  const written = prayers.length + experiences.length + notes.length;
  // Tomorrow can still be planned the evening of and the night after.
  const canPlanTomorrow = addDays(date, 1) >= todayStr();

  return (
    <>
      {/* What kind of day was this: the four numbers, before any detail. */}
      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <Stat label="Time tracked" value={tracked > 0 ? fmtMinutes(tracked) : "—"} foot={entries.length === 1 ? "1 entry" : `${entries.length} entries`} />
        <Stat
          label="Tasks completed"
          value={pct != null ? `${pct}%` : "—"}
          foot={topTasks.length > 0 ? `${tasksDone} of ${topTasks.length}` : "nothing planned"}
          accent={pct === 100}
        />
        <Stat label="Wins" value={wins.length > 0 ? String(wins.length) : "—"} foot={isToday ? "today" : "that day"} />
        <Stat label="Written" value={written > 0 ? String(written) : "—"} foot="prayers, promptings, notes" />
      </div>

      {catTotal > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <span className="card-title"><Clock size={14} />Where the day went</span>
            <span className="mono" style={{ fontSize: 12, fontWeight: 600 }} title="Tracked">{fmtMinutes(tracked)}</span>
          </div>

          {/* The ring answers WHEN, the strip beneath it answers how much.
              Both, because they are different questions and the second one
              is the one you compare across weeks. */}
          <div className="day-ring-row">
            <DayRing arcs={ringArcs} size={216} showLabels />
            <div style={{ flex: 1, minWidth: 200 }}>
              <RingLegend arcs={ringArcs} />
            </div>
          </div>

          <div className="time-strip time-strip--tall" style={{ marginTop: 14 }}>
            {byCategory.map((r) => (
              <i key={r.category} title={`${r.category} · ${fmtMinutes(r.minutes)}`} style={{ width: `${(r.minutes / catTotal) * 100}%`, background: colorFor(r.category) }} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid--halves" style={{ alignItems: "start" }}>
        {/* Left: where the hours were meant to go, and where they went. */}
        <div className="stack">
          <div>
            <div className="card-head" style={{ marginBottom: 10 }}>
              <span className="card-title"><CheckSquare size={14} />The plan</span>
              {pct != null && <span className="mono muted" style={{ fontSize: 11.5 }}>{tasksDone}/{topTasks.length} done</span>}
            </div>
            <DayView userId={userId} date={date} goalOptions={goalOptions} onDataChanged={reload} />
          </div>

          <MinutesView userId={userId} date={date} />
        </div>

        {/* Right: what the day held, then what you make of it. */}
        <div className="stack">
          {wins.length > 0 && <DayWins wins={wins} isToday={isToday} />}

          {written > 0 && <WrittenToday experiences={experiences} prayers={prayers} notes={notes} isToday={isToday} />}

          {/* Placed above the reflection on purpose: what an old note or a
              mentor's counsel says about today is worth reading BEFORE you
              answer the questions, not after you've closed them. */}
          {isToday && <CuratedCards slot="day" date={date} title="Worth holding today" />}

          <GoalLinks key={`links-${date}`} date={date} isToday={isToday} onApplied={reload} />

          <ReflectionFlow key={date} userId={userId} date={date} journal={a.journal} moments={experiences} onSaved={reload} />

          {canPlanTomorrow && <PlanTomorrow key={`tomorrow-${date}`} userId={userId} date={date} reflectionDone={reflectionDone} />}

          <CloseOut userId={userId} date={date} reflectionDone={reflectionDone} onBanked={reload} />
        </div>
      </div>
    </>
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

// The day's wins, each one tappable to rename or remove, as on the evening.
function DayWins({ wins, isToday }) {
  const [editing, setEditing] = useState(null);
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title"><Plus size={14} />Wins</span>
        <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-text)" }}>{wins.length}</span>
      </div>
      <div className="list">
        {wins.map((w) =>
          editing === w.id ? (
            <TapEditor key={w.id} row={w} onClose={() => setEditing(null)} />
          ) : (
            <button key={w.id} type="button" className="list-row day-win" onClick={() => setEditing(w.id)}>
              <Plus size={13} className="evening-wl__mark" />
              {isUnnamed(w) ? (
                <span className="truncate evening-wl__unnamed" style={{ flex: 1 }}>Win (tap to name)</span>
              ) : (
                <span className="truncate" style={{ flex: 1 }}>{w.habit_label}</span>
              )}
              <span className="list-row__meta">{timeOf(w.occurred_at)}</span>
            </button>
          )
        )}
      </div>
      <p className="evening-wl__hint">{isToday ? "Tap one to rename or remove it." : "Tap one to rename or remove it. Losses are on the evening page."}</p>
    </div>
  );
}

// Which goals the day's time fed, for when you want it: closed until asked,
// because tallying minutes against goals isn't part of the evening.
function GoalLinks({ date, isToday, onApplied }) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);

  return (
    <section className="day-fold">
      <button type="button" className="day-fold__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Link2 size={14} />
        <span style={{ flex: 1 }}>Goal links for this day</span>
        <ChevronDown size={16} className={"day-fold__chev" + (open ? " day-fold__chev--open" : "")} />
      </button>
      {open && (
        <div className="stack" style={{ marginTop: 10 }}>
          <GoalLinkSuggestions
            date={date}
            onApplied={() => {
              setVersion((v) => v + 1);
              onApplied?.();
            }}
          />
          <GoalFruits key={version} startDate={date} endDate={date} title={isToday ? "What today fed" : "What the day fed"} />
        </div>
      )}
    </section>
  );
}

// Planning happens on Sundays, so the planner is open at the weekend and a
// button away the rest of the week.
function PlanTomorrow({ userId, date, reflectionDone }) {
  const dow = parseDateStr(date).getDay();
  const [open, setOpen] = useState(dow === 0 || dow === 6);
  if (open) return <Tomorrow userId={userId} date={date} reflectionDone={reflectionDone} />;
  return (
    <button type="button" className="btn btn--block" onClick={() => setOpen(true)}>
      <CalendarPlus size={15} />
      Plan tomorrow
    </button>
  );
}

// Everything you wrote down that day, in one card rather than three:
// promptings, prayers, and whatever came over from Obsidian.
function WrittenToday({ experiences, prayers, notes, isToday }) {
  return (
    <div className="card">
      <div className="card-head"><span className="card-title">{isToday ? "What you wrote today" : "What you wrote that day"}</span></div>

      {experiences.length > 0 && (
        <Group icon={Flame} title="What came">
          {experiences.map((e) => (
            <div key={e.id} style={{ padding: "9px 0" }}>
              <div className="row row--between">
                <span className="chip" style={{ fontSize: 10.5 }}>{KIND_LABEL[e.kind] ?? e.kind}</span>
                <span className="list-row__meta">{timeOf(e.occurred_at)}</span>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 550, marginTop: 5 }}>{e.what_came}</div>
              {e.action_taken && <div style={{ fontSize: 12.5, color: "var(--accent-text)", marginTop: 3 }}>Acted: {e.action_taken}</div>}
              {!e.acted_on && <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>Still open</div>}
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
              {p.felt_response && <div style={{ fontSize: 12.5, color: "var(--accent-text)", marginTop: 2 }}>Felt: {p.felt_response}</div>}
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
