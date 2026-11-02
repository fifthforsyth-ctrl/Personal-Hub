import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Minus, Clock, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchDayArchive, fetchDayPlan, fetchCategories, fetchTimeChunks, fetchTasks, unbankDay, looseShots, fetchRange } from "../lib/api";
import { buildAscent } from "../lib/ascent";
import { buildRange } from "../lib/mark";
import { useLoad } from "../lib/useLoad";
import { colorFor, fmtMinutes, setCategoryColors } from "../lib/categories";
import { todayStr, addDays, fmtDayHeading } from "../lib/planDates";
import LoadError from "../components/ui/LoadError";
import ReflectionFlow from "../components/day/ReflectionFlow";
import CloseOut from "../components/day/CloseOut";
import EveningCheckin from "../components/day/EveningCheckin";
import EveningTasks from "../components/day/EveningTasks";
import ShortEvening from "../components/day/ShortEvening";
import BankedDayCard from "../components/day/BankedDayCard";
import FocusArrows from "../components/focus/FocusArrows";
import TonightShots from "../components/mark/TonightShots";
import Volley from "../components/mark/Volley";
import CuratedCards from "../components/curator/CuratedCards";
import WatchLine from "../components/day/WatchLine";
import TapEditor from "../components/today/TapEditor";
import Swords from "../components/ui/Swords";
import { useOutbox, withTaps, isUnnamed } from "../components/today/tapOutbox";
import { trackedMinutes, OVERLAP_NOTE } from "../components/today/minutes";
import { eveningDate, isLateNight } from "../components/today/dayParts";
import { useBackOnline } from "../components/today/useBackOnline";
import "../styles/daily.css";

// The evening, on one page, in the order it actually goes: what went well
// and what didn't, where the hours went, an old thought from the board that
// fits the day, the four reflection cards, an arrow for each of this week's
// focuses (placed by you, or landed by its own checks), tonight's checks on
// each target on The Range, what got done (tick anything you did and didn't
// mark, and say why the rest was left), how it felt and any communication
// with God, when tomorrow starts, and then bank it, which is when the arrows
// fly. Nothing else on the page, so the only way forward is down.
//
// Banking saves what's still waiting first, in the order it's needed: the
// focus arrows (a focus can count toward a target, so its arrow has to be
// in before the target's shot is worked out), the ticks on their way, and
// the notes on how it felt. The targets' shots save last, as the arrows fly.
//
// Before four in the morning it opens on yesterday: a reflection written at
// half past midnight is still about the day you just lived.
//
// Past midnight, and on any earlier day you go back to, it opens short:
// wins and losses, a few taps (mood, any communication with God, God's hand
// in a line, tomorrow's alarm), a quick arrow for each focus, one tap per
// target for tonight's shots, and bank it. Same day, same records, same
// arrows; Full switches back at any point and keeps everything tapped: the
// card being left saves what it holds and the page reads the day again, so
// the other one opens on it. ?short=1 opens it short at any hour.

function shortKey(date) {
  return `hub.evening-short.${date}`;
}

function startShort(date, tonight, asked) {
  if (asked) return true;
  try {
    const kept = sessionStorage.getItem(shortKey(date));
    if (kept != null) return kept === "1";
  } catch {
    /* private window: fall through to the clock */
  }
  // A day gone by (one you missed) opens short too; tonight only after midnight.
  return date < tonight || (date === tonight && isLateNight());
}

async function loadEvening(userId, date) {
  const [archive, dayPlan, chunks, tasks, cats] = await Promise.all([
    fetchDayArchive(date),
    fetchDayPlan(userId, date),
    fetchTimeChunks(userId, date),
    fetchTasks(userId, date),
    // Only colours: the evening still opens if these don't come.
    fetchCategories(userId).catch((err) => {
      console.warn(err);
      return null;
    }),
  ]);
  if (cats) setCategoryColors(cats);
  return { archive: archive ?? {}, dayPlan, chunks, tasks };
}

export default function Evening() {
  const { user } = useAuth();
  const userId = user?.id;
  const { date: dateParam } = useParams();
  const date = dateParam ?? eveningDate();
  const tonight = eveningDate();
  const next = addDays(date, 1);
  const [search] = useSearchParams();
  const [short, setShortState] = useState(() => startShort(date, tonight, search.get("short") === "1"));
  const [shortDate, setShortDate] = useState(date);
  if (shortDate !== date) {
    setShortDate(date);
    setShortState(startShort(date, tonight, search.get("short") === "1"));
  }
  // What each card still holds, saved before the day is banked (and before
  // switching between short and full): the short evening's taps and lines,
  // the full one's notes, the focus arrows, and ticks on their way.
  const flushShort = useRef(null);
  const flushCheckin = useRef(null);
  const flushFocus = useRef(null);
  const flushTasks = useRef(null);
  const [shortLine, setShortLine] = useState(false);

  const { data, error, loading, reload } = useLoad(() => loadEvening(userId, date), [userId, date]);

  // The card being left saves what it holds, and then the page reads the day
  // again, so the one switched to opens on what was just tapped.
  const setShort = (v) => {
    if (v === short) return;
    const leaving = [flushFocus.current, short ? flushShort.current : flushCheckin.current];
    setShortState(v);
    try {
      sessionStorage.setItem(shortKey(date), v ? "1" : "0");
    } catch {
      /* the switch still works for this visit */
    }
    Promise.allSettled(leaving.map((flush) => flush?.())).then(() => reload());
  };

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

  // Before the summary is written from the day: the focus arrows first
  // (tonight's shots read them when they fly, in `loose`), then the ticks on
  // their way, then how it felt. A note that didn't save stops the bank, so
  // nothing typed is lost; CloseOut says so and the tap can go again.
  const beforeBank = useCallback(async () => {
    await flushFocus.current?.();
    await flushTasks.current?.();
    await flushCheckin.current?.();
  }, []);
  const beforeShortBank = useCallback(async () => {
    await flushFocus.current?.();
    await flushShort.current?.();
  }, []);

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
          {!banked && data && (
            <div className="seg evening-length" role="group" aria-label="How long tonight">
              <button type="button" className={"seg-btn" + (short ? " active" : "")} aria-pressed={short} onClick={() => setShort(true)}>
                Short
              </button>
              <button type="button" className={"seg-btn" + (!short ? " active" : "")} aria-pressed={!short} onClick={() => setShort(false)}>
                Full
              </button>
            </div>
          )}
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
      ) : short ? (
        <div className="stack">
          <WinsAndLosses userId={userId} date={date} rows={a.wins_losses ?? []} />
          <ShortEvening
            key={`short-${date}`}
            userId={userId}
            date={date}
            dayPlan={data.dayPlan}
            journal={a.journal}
            flushRef={flushShort}
            onLine={setShortLine}
          />
          <FocusArrows
            key={`focus-quick-${date}`}
            userId={userId}
            date={date}
            entries={a.time_entries ?? []}
            dayPlan={data.dayPlan}
            flushRef={flushFocus}
            quick
          />
          <TonightShots
            key={`quick-${date}`}
            userId={userId}
            date={date}
            entries={a.time_entries ?? []}
            dayPlan={data.dayPlan}
            flushRef={flushShots}
            onReady={setArrows}
            quick
          />
          <CloseOut
            userId={userId}
            date={date}
            reflectionDone={reflectionDone || shortLine}
            onBanked={reload}
            arrows={arrows}
            onLoose={loose}
            short
            onBefore={beforeShortBank}
          />
        </div>
      ) : (
        <div className="stack">
          <WinsAndLosses userId={userId} date={date} rows={a.wins_losses ?? []} />
          <MinutesCard archive={a} />
          <WatchLine userId={userId} date={date} />
          <CuratedCards slot="day" date={date} title="From your board" compact />
          <ReflectionFlow key={date} userId={userId} date={date} journal={a.journal} moments={a.experiences ?? []} onSaved={reload} />
          <FocusArrows key={`focus-${date}`} userId={userId} date={date} entries={a.time_entries ?? []} dayPlan={data.dayPlan} flushRef={flushFocus} />
          <TonightShots
            key={`shots-${date}`}
            userId={userId}
            date={date}
            entries={a.time_entries ?? []}
            dayPlan={data.dayPlan}
            flushRef={flushShots}
            onReady={setArrows}
          />
          <EveningTasks key={`tasks-${date}`} userId={userId} date={date} chunks={data.chunks} tasks={data.tasks} flushRef={flushTasks} />
          <EveningCheckin key={`checkin-${date}`} userId={userId} date={date} dayPlan={data.dayPlan} journal={a.journal} flushRef={flushCheckin} />
          <CloseOut userId={userId} date={date} reflectionDone={reflectionDone} onBanked={reload} arrows={arrows} onLoose={loose} onBefore={beforeBank} />
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
