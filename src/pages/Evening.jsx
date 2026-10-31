import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Minus, Clock, ArrowRight, ChevronLeft, ChevronRight, Watch } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchDayArchive, fetchDayPlan, fetchCategories, fetchTimeChunks, fetchTasks, unbankDay, looseShots, fetchRange, fetchHealthDays, fetchHealthWorkouts } from "../lib/api";
import { eveningWatchParts } from "../lib/watch";
import { buildAscent } from "../lib/ascent";
import { buildRange } from "../lib/mark";
import { useLoad } from "../lib/useLoad";
import { colorFor, fmtMinutes, setCategoryColors } from "../lib/categories";
import { todayStr, addDays, fmtDayHeading, parseDateStr } from "../lib/planDates";
import LoadError from "../components/ui/LoadError";
import ReflectionFlow from "../components/day/ReflectionFlow";
import CloseOut from "../components/day/CloseOut";
import EveningCheckin from "../components/day/EveningCheckin";
import BankedDayCard from "../components/day/BankedDayCard";
import FocusDay from "../components/focus/FocusDay";
import TonightShots from "../components/mark/TonightShots";
import Volley from "../components/mark/Volley";
import CuratedCards from "../components/curator/CuratedCards";
import TapEditor from "../components/today/TapEditor";
import Swords from "../components/ui/Swords";
import { useOutbox, withTaps, isUnnamed } from "../components/today/tapOutbox";
import { trackedMinutes, OVERLAP_NOTE } from "../components/today/minutes";
import { eveningDate } from "../components/today/dayParts";
import { useBackOnline } from "../components/today/useBackOnline";
import "../styles/daily.css";

// The evening, on one page, in the order it actually goes: what went well
// and what didn't, where the hours went, an old thought from the board that
// fits the day, the four reflection cards, whether today moved this week's
// focus goals, tonight's shot at each target on The Range, a few taps on how
// it felt and when tomorrow starts, and then bank it, which is when the
// arrows fly. Nothing else on the page, so the only way forward is down.
//
// Before four in the morning it opens on yesterday: a reflection written at
// half past midnight is still about the day you just lived.

async function loadEvening(userId, date) {
  const quiet = (p) =>
    p.catch((err) => {
      console.warn(err);
      return null;
    });
  const [archive, dayPlan, chunks, tasks, cats, health, workouts] = await Promise.all([
    fetchDayArchive(date),
    fetchDayPlan(userId, date),
    fetchTimeChunks(userId, date),
    fetchTasks(userId, date),
    // Only colours: the evening still opens if these don't come.
    quiet(fetchCategories(userId)),
    // The watch's numbers sit beside the day; the evening opens without them.
    quiet(fetchHealthDays(userId, date, date)),
    quiet(fetchHealthWorkouts(userId, parseDateStr(date).toISOString(), parseDateStr(addDays(date, 1)).toISOString())),
  ]);
  if (cats) setCategoryColors(cats);
  return { archive: archive ?? {}, dayPlan, chunks, tasks, watch: eveningWatchParts(health?.[0], workouts ?? []) };
}

export default function Evening() {
  const { user } = useAuth();
  const userId = user?.id;
  const { date: dateParam } = useParams();
  const date = dateParam ?? eveningDate();
  const tonight = eveningDate();
  const next = addDays(date, 1);

  const { data, error, loading, reload } = useLoad(() => loadEvening(userId, date), [userId, date]);

  // A win captured from the sheet over this page shows up here too.
  useEffect(() => {
    window.addEventListener("hub:changed", reload);
    return () => window.removeEventListener("hub:changed", reload);
  }, [reload]);
  useBackOnline(reload, Boolean(error));

  // Tonight's arrows: how many targets are answered, a way to save what's
  // still waiting before they fly, and the volley once they have.
  const [arrows, setArrows] = useState(null);
  const flushShots = useRef(null);
  const [volley, setVolley] = useState(null);

  const loose = useCallback(async () => {
    await flushShots.current?.();
    const flown = await looseShots(userId, date);
    if (!flown.length) return;
    const fresh = await fetchRange(userId, date);
    const range = buildRange(buildAscent(fresh, date), fresh.marks, date);
    setVolley({ range, date, flown: new Set(flown.map((s) => s.id)) });
  }, [userId, date]);

  const a = data?.archive ?? {};
  const banked = Boolean(data?.dayPlan?.banked_at);
  const reflectionDone = Boolean(a.journal?.reflection_completed_at);
  const isToday = date === todayStr();

  return (
    <div className="page page--narrow evening">
      <div className="page-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Just after midnight, the evening you're still in is "tonight". */}
          <div className="eyebrow">{date === tonight ? "Tonight" : "Evening"} · {fmtDayHeading(date)}</div>
          <h1 className="page-title" style={{ marginTop: 3 }}>{isToday ? "How today really went" : "How the day really went"}</h1>
          <nav className="evening-nav" aria-label="Other evenings">
            <Link to={`/evening/${addDays(date, -1)}`} className="btn-link">
              <ChevronLeft size={13} />
              Previous evening
            </Link>
            {date < tonight && (
              <Link to={next === tonight ? "/evening" : `/evening/${next}`} className="btn-link">
                Next evening
                <ChevronRight size={13} />
              </Link>
            )}
            <Link to={`/day/${date}`} className="btn-link evening-nav__day">
              Full day
              <ArrowRight size={13} />
            </Link>
          </nav>
        </div>
      </div>

      {error && <LoadError what="this evening" error={error} onRetry={reload} stale={Boolean(data)} className="evening__error" />}

      {/* Nothing to reflect on or bank until the day is actually here: a
          reflection started over a failed load would save blanks. */}
      {!data ? (
        loading && <p className="empty">Reading the day…</p>
      ) : banked ? (
        <BankedDayCard
          userId={userId}
          date={date}
          archive={{ ...a, synopsis: data.dayPlan?.synopsis, banked_at: data.dayPlan?.banked_at }}
          plan={data.dayPlan}
          chunks={data.chunks}
          tasks={data.tasks}
          onReopen={async () => {
            await unbankDay(userId, date);
            await reload();
          }}
          onChanged={reload}
        />
      ) : (
        <div className="stack">
          <WinsAndLosses userId={userId} date={date} rows={a.wins_losses ?? []} />
          <MinutesCard archive={a} />
          <WatchLine parts={data.watch} />
          <CuratedCards slot="day" date={date} title="From your board" compact />
          <ReflectionFlow key={date} userId={userId} date={date} journal={a.journal} moments={a.experiences ?? []} onSaved={reload} />
          <FocusDay userId={userId} date={date} variant="evening" />
          <TonightShots key={`shots-${date}`} userId={userId} date={date} entries={a.time_entries ?? []} flushRef={flushShots} onReady={setArrows} />
          <EveningCheckin
            key={`checkin-${date}`}
            userId={userId}
            date={date}
            dayPlan={data.dayPlan}
            chunks={data.chunks}
            entries={a.time_entries ?? []}
            tasks={data.tasks}
            prayers={a.prayers ?? []}
            experiences={a.experiences ?? []}
          />
          <CloseOut userId={userId} date={date} reflectionDone={reflectionDone} onBanked={reload} arrows={arrows} onLoose={loose} />
        </div>
      )}

      {volley && <Volley range={volley.range} date={volley.date} flown={volley.flown} onDone={() => setVolley(null)} />}
    </div>
  );
}

// Wins and losses, side by side. The one place in the day losses appear.
// A row opens to rename or remove it; taps still waiting on the phone are
// here too.
function WinsAndLosses({ userId, date, rows }) {
  const outbox = useOutbox();
  const [editing, setEditing] = useState(null);
  const wins = withTaps(rows, outbox, { userId, date, kind: "win" });
  const losses = withTaps(rows, outbox, { userId, date, kind: "loss" });

  const column = (kind, list) => (
    <div style={{ minWidth: 0 }}>
      <div className="row row--between" style={{ marginBottom: 8 }}>
        <span className="eyebrow" style={kind === "win" ? { color: "var(--accent-text)" } : undefined}>{kind === "win" ? "Wins" : "Losses"}</span>
        <span className={"evening-wl__count" + (kind === "win" ? " evening-wl__count--win" : " faint")}>{list.length}</span>
      </div>
      {list.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>None logged.</p>
      ) : (
        list.map((w) =>
          editing === w.id ? (
            <TapEditor key={w.id} row={w} onClose={() => setEditing(null)} />
          ) : (
            <button key={w.id} type="button" className={"evening-wl__row" + (kind === "loss" ? " muted" : "")} onClick={() => setEditing(w.id)}>
              {kind === "win" ? <Swords size={14} className="evening-wl__mark" /> : <Minus size={13} className="evening-wl__mark" />}
              {isUnnamed(w) ? (
                <span className="evening-wl__unnamed">{kind === "win" ? "Win" : "Loss"} (tap to name)</span>
              ) : (
                <span>
                  {w.habit_label}
                  {w.reason && <span className="faint"> · {w.reason}</span>}
                </span>
              )}
            </button>
          )
        )
      )}
    </div>
  );

  return (
    <div className="card">
      <div className="evening-wl">
        {column("win", wins)}
        {column("loss", losses)}
      </div>
      {wins.length + losses.length > 0 && <p className="evening-wl__hint">Tap one to rename or remove it.</p>}
    </div>
  );
}

// Where the hours went. Minutes only, with no goal tallies.
function MinutesCard({ archive }) {
  const rows = archive.time_by_category ?? [];
  const catTotal = rows.reduce((s, r) => s + Number(r.minutes || 0), 0);
  const tracked = trackedMinutes(archive.time_entries);

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title"><Clock size={14} />Minutes</span>
        <span className="mono" style={{ fontSize: 13, fontWeight: 600 }} title="Tracked">{tracked > 0 ? fmtMinutes(tracked) : "—"}</span>
      </div>
      {rows.length === 0 ? (
        <p className="empty">Nothing tracked.</p>
      ) : (
        <>
          <div className="time-strip time-strip--tall">
            {rows.map((r) => (
              <i key={r.category} title={`${r.category} · ${fmtMinutes(r.minutes)}`} style={{ width: `${(Number(r.minutes) / catTotal) * 100}%`, background: colorFor(r.category) }} />
            ))}
          </div>
          <div className="minutes-legend minutes-legend--wide">
            {rows.map((r) => (
              <span key={r.category} className="row" style={{ gap: 6, minWidth: 0 }}>
                <span className="dot" style={{ background: colorFor(r.category) }} />
                <span className="truncate">{r.category}</span>
                <span className="mono muted">{fmtMinutes(r.minutes)}</span>
              </span>
            ))}
          </div>
          {catTotal > tracked + 0.5 && <p className="minutes-note">{OVERLAP_NOTE}</p>}
        </>
      )}
    </div>
  );
}

// What the watch measured, as one quiet row under the minutes: last night's
// sleep, the day's workouts, steps, resting heart rate. Only what came.
function WatchLine({ parts }) {
  if (!parts?.length) return null;
  return (
    <div className="card watch-line" aria-label="From your watch">
      <span className="eyebrow watch-line__head">
        <Watch size={12} />
        From your watch
      </span>
      <div className="watch-line__parts">
        {parts.map((p, i) => (
          <span key={i} className="watch-line__part">
            <span className="faint">{p.label}</span> <strong className="mono">{p.value}</strong>
            {p.sub && <span className="faint watch-line__sub">{p.sub}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
