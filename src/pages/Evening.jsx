import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Minus, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
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
import BankedDayCard from "../components/day/BankedDayCard";
import FocusArrows from "../components/focus/FocusArrows";
import TonightShots from "../components/mark/TonightShots";
import Volley from "../components/mark/Volley";
import TapEditor from "../components/today/TapEditor";
import Swords from "../components/ui/Swords";
import { useOutbox, withTaps, isUnnamed } from "../components/today/tapOutbox";
import { trackedMinutes, OVERLAP_NOTE } from "../components/today/minutes";
import { eveningDate } from "../components/today/dayParts";
import { useBackOnline } from "../components/today/useBackOnline";
import "../styles/daily.css";

// The evening, on one page, cut down to what helps (Aaron, 2026-11-22: "the
// best part about the evening reflection is the reflection questions"):
// wins and losses, where the hours went, the reflection questions (God's
// hand, the two written fresh each night, anything else), an arrow for each
// of this week's focuses and one tap per target for tonight's shots, mood
// and any communication with God, when tomorrow starts, and then bank it,
// which is when the arrows fly.
//
// Gone from it (their rows stay): the Short/Full switch and the short
// evening, stress and the notes on mood and stress, the watch's row, the
// card from the board, and "What got done" (tasks are ticked on Tasks).
//
// Banking saves what's still waiting first, in the order it's needed: the
// reflection's words, the focus arrows (a focus can count toward a target,
// so its arrow has to be in before the target's shot is worked out), and
// the mood and notes. The targets' shots save last, as the arrows fly.
//
// It's taken in four steps, one screen each (Clean slate, 2026-11-23): how
// the day went (wins, losses, minutes), the reflection, this week's aim (the
// focus arrows and tonight's shots), and what's left before banking it (mood,
// the note for God, tomorrow's start, and Bank the day). The bars at the top
// say where you are and a tap on one goes there. Every step stays on the
// page while another shows, so nothing typed is lost by moving between
// them and banking still saves what each one holds.
//
// Before four in the morning it opens on yesterday: a reflection written at
// half past midnight is still about the day you just lived.

const STEPS = ["How the day really went", "Reflection", "This week's aim", "Before you bank it"];

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
  // What each card still holds, saved before the day is banked.
  const flushCheckin = useRef(null);
  const flushFocus = useRef(null);
  const flushReflection = useRef(null);
  const flushShots = useRef(null);

  const { data, error, loading, reload } = useLoad(() => loadEvening(userId, date), [userId, date]);

  // Which of the four steps is showing. Another evening starts at the first.
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [date]);
  const go = (i) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, i)));
    document.querySelector(".main")?.scrollTo?.({ top: 0 });
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
  const [volley, setVolley] = useState(null);

  const loose = useCallback(async () => {
    const keep = await flushShots.current?.();
    const flown = await looseShots(userId, date, Array.isArray(keep) ? keep : []);
    if (!flown.length) return;
    const fresh = await fetchRange(userId, date);
    const range = buildRange(buildAscent(fresh, date), fresh.marks, date);
    setVolley({ range, date, flown: new Set(flown.map((s) => s.id)) });
  }, [userId, date]);

  // Before the summary is written from the day: the reflection's words, the
  // focus arrows (tonight's shots read them when they fly, in `loose`), then
  // how it felt. A note that didn't save stops the bank, so
  // nothing typed is lost; CloseOut says so and the tap can go again.
  const beforeBank = useCallback(async () => {
    await flushReflection.current?.();
    await flushFocus.current?.();
    await flushCheckin.current?.();
  }, []);

  const a = data?.archive ?? {};
  const banked = Boolean(data?.dayPlan?.banked_at);
  const reflectionDone = Boolean(a.journal?.reflection_completed_at);
  const isToday = date === todayStr();
  // The steps are for a day still open; a banked day is one card.
  const stepping = Boolean(data) && !banked;
  const titleOf = (i) => (i === 0 && isToday ? "How today really went" : STEPS[i]);

  return (
    <div className="page page--narrow evening">
      <header className="hub-head eve-head">
        {stepping ? (
          <div className="eve-progress" role="group" aria-label="The evening's four steps">
            {STEPS.map((name, i) => (
              <button
                key={name}
                type="button"
                className={"eve-progress__step" + (i <= step ? " is-on" : "")}
                aria-label={`Step ${i + 1} of ${STEPS.length}: ${titleOf(i)}`}
                aria-current={i === step ? "step" : undefined}
                onClick={() => go(i)}
              />
            ))}
            <span className="eve-progress__count" aria-hidden="true">
              {step + 1} / {STEPS.length}
            </span>
          </div>
        ) : (
          <span className="eve-head__when">{fmtDayHeading(date)}</span>
        )}
      </header>

      <div className="eve-title">
        {/* Just after midnight, the evening you're still in is "tonight". */}
        {stepping && (
          <div className="eve-title__when">
            {date === tonight ? "Tonight" : "Evening"} · {fmtDayHeading(date)}
          </div>
        )}
        <h1 className="eve-title__h">{stepping ? titleOf(step) : titleOf(0)}</h1>
        {(!stepping || step === 0) && (
          <nav className="evening-nav" aria-label="Other evenings">
            <Link to={`/evening/${addDays(date, -1)}`} className="btn-link">
              <ChevronLeft size={14} />
              Previous evening
            </Link>
            {date < tonight && (
              <Link to={next === tonight ? "/evening" : `/evening/${next}`} className="btn-link">
                Next evening
                <ChevronRight size={14} />
              </Link>
            )}
            <Link to={`/day/${date}`} className="btn-link evening-nav__day">
              Full day
              <ArrowRight size={14} />
            </Link>
          </nav>
        )}
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
        <div className="eve-steps">
          <section className="stack eve-step" hidden={step !== 0} aria-label={titleOf(0)}>
            <WinsAndLosses userId={userId} date={date} rows={a.wins_losses ?? []} />
            <MinutesCard archive={a} />
          </section>

          <section className="stack eve-step" hidden={step !== 1} aria-label={STEPS[1]}>
            <ReflectionFlow key={date} userId={userId} date={date} journal={a.journal} moments={a.experiences ?? []} onSaved={reload} flushRef={flushReflection} />
          </section>

          <section className="stack eve-step" hidden={step !== 2} aria-label={STEPS[2]}>
            <FocusArrows key={`focus-${date}`} userId={userId} date={date} entries={a.time_entries ?? []} dayPlan={data.dayPlan} flushRef={flushFocus} quick />
            <TonightShots
              key={`shots-${date}`}
              userId={userId}
              date={date}
              entries={a.time_entries ?? []}
              dayPlan={data.dayPlan}
              flushRef={flushShots}
              onReady={setArrows}
              quick
            />
          </section>

          <section className="stack eve-step" hidden={step !== 3} aria-label={STEPS[3]}>
            <EveningCheckin key={`checkin-${date}`} userId={userId} date={date} dayPlan={data.dayPlan} journal={a.journal} flushRef={flushCheckin} slim />
            <CloseOut userId={userId} date={date} reflectionDone={reflectionDone} onBanked={reload} arrows={arrows} onLoose={loose} onBefore={beforeBank} />
          </section>

          <div className="eve-foot">
            <button type="button" className="eve-foot__back" onClick={() => (step > 0 ? go(step - 1) : navigate("/"))}>
              {step > 0 ? "Back" : "Close"}
            </button>
            {step < STEPS.length - 1 && (
              <button type="button" className="eve-foot__next" onClick={() => go(step + 1)}>
                Next
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            )}
          </div>
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
    <div className={"evening-wl__col evening-wl__col--" + kind}>
      <div className="evening-wl__head">
        <h2 className="evening-wl__h">{kind === "win" ? "Wins" : "Losses"}</h2>
        <span className={"evening-wl__count" + (kind === "win" ? " evening-wl__count--win" : "")}>{list.length}</span>
      </div>
      {list.length === 0 ? (
        <p className="evening-wl__none">None logged.</p>
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
    <div className="card evening-wl-card">
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
    <div className="card evening-minutes">
      <div className="card-head">
        <h2 className="card-title">Minutes</h2>
        <span className="evening-minutes__total" title="Tracked">
          {tracked > 0 ? fmtMinutes(tracked) : "—"}
        </span>
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
