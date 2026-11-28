import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchDayArchive, fetchDayPlan, fetchTimeChunks, fetchTasks, unbankDay, fetchRange, fetchFocusWeek, saveJournalEntry } from "../lib/api";
import { buildAscent } from "../lib/ascent";
import { ladderOf } from "../lib/ladder";
import { focusWeekOf } from "../lib/focus";
import { useLoad } from "../lib/useLoad";
import { todayStr, addDays, fmtDayHeading } from "../lib/planDates";
import LoadError from "../components/ui/LoadError";
import { answeredCards } from "../components/day/ReflectionFlow";
import EveningJournal from "../components/day/EveningJournal";
import CloseOut from "../components/day/CloseOut";
import BankedDayCard from "../components/day/BankedDayCard";
import { eveningDate } from "../components/today/dayParts";
import { useBackOnline } from "../components/today/useBackOnline";
import "../styles/daily.css";

// The evening, as simple as Aaron asked for it (2026-11-28): "choose from
// any of my targets to write about, I don't have to do any or all of them.
// I can choose between those, a 'choose for me' that generates questions,
// or an 'I pick' and I can just keep adding journal entries. I can do as
// much or as little as I want. Then I am done and I can bank the day.
// Anything else I really don't use at all. I still want the choice to talk
// through any of my journal entries."
//
// So the page is the entries (EveningJournal) and Bank the day. Gone from
// it, with their data left where it is: the four steps, wins and losses,
// minutes, the focus arrows, tonight's shots and their volley, mood, the
// note for God, and tomorrow's alarm. Wins are still logged on Today and
// arrows placed on Targets.
//
// Banking always works, written or not; it first saves every entry still
// waiting, and stamps the reflection done when anything was written.
//
// Before four in the morning it opens on yesterday: a reflection written at
// half past midnight is still about the day you just lived.

async function loadEvening(userId, date) {
  const [archive, dayPlan, chunks, tasks] = await Promise.all([
    fetchDayArchive(date),
    fetchDayPlan(userId, date),
    fetchTimeChunks(userId, date),
    fetchTasks(userId, date),
  ]);
  return { archive: archive ?? {}, dayPlan, chunks, tasks };
}

// His targets to choose from. The evening still opens if they don't come.
async function loadTargets(userId, date) {
  const [range, week] = await Promise.all([fetchRange(userId, date), fetchFocusWeek(userId, focusWeekOf(date)).catch(() => null)]);
  return ladderOf({ view: buildAscent(range, date), focusGoals: week?.goals ?? [] });
}

export default function Evening() {
  const { user } = useAuth();
  const userId = user?.id;
  const { date: dateParam } = useParams();
  const date = dateParam ?? eveningDate();
  const tonight = eveningDate();
  const next = addDays(date, 1);
  const navigate = useNavigate();
  const flushEntries = useRef(null);
  const [count, setCount] = useState(0);

  const { data, error, loading, reload } = useLoad(() => loadEvening(userId, date), [userId, date]);
  const targets = useLoad(() => (userId ? loadTargets(userId, date) : null), [userId, date]);

  useEffect(() => {
    window.addEventListener("hub:changed", reload);
    return () => window.removeEventListener("hub:changed", reload);
  }, [reload]);
  useBackOnline(reload, Boolean(error));

  // Every entry still waiting saves first; a written evening is marked
  // reflected so Today and the week show it.
  const beforeBank = useCallback(async () => {
    const written = (await flushEntries.current?.()) ?? 0;
    if (written > 0) await saveJournalEntry(userId, date, { completed: true });
  }, [userId, date]);

  const a = data?.archive ?? {};
  const banked = Boolean(data?.dayPlan?.banked_at);
  const isToday = date === todayStr();
  // Answers written under the old questions earlier tonight stay readable.
  const earlier = answeredCards(a.journal);

  return (
    <div className="page page--narrow evening">
      <header className="hub-head eve-head">
        <span className="eve-head__when">{fmtDayHeading(date)}</span>
      </header>

      <div className="eve-title">
        {!banked && <div className="eve-title__when">{date === tonight ? "Tonight" : "Evening"}</div>}
        <h1 className="eve-title__h">{banked ? (isToday ? "How today went" : "How the day went") : "Evening reflection"}</h1>
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
      </div>

      {error && <LoadError what="this evening" error={error} onRetry={reload} stale={Boolean(data)} className="evening__error" />}

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
        <div className="stack eve-simple">
          {earlier.length > 0 && (
            <section className="card ej-earlier" aria-label="Written earlier">
              <div className="eyebrow">Written earlier</div>
              {earlier.map((c, i) => (
                <div key={i} className="ej-earlier__one">
                  <div className="ej-earlier__q">{c.question}</div>
                  <div className="prose">{c.text}</div>
                </div>
              ))}
            </section>
          )}

          <EveningJournal key={date} userId={userId} date={date} ladder={targets.data} flushRef={flushEntries} onCount={setCount} />

          <CloseOut userId={userId} date={date} reflectionDone={count > 0} onBanked={reload} onBefore={beforeBank} short />

          <button type="button" className="btn-link ej-close" onClick={() => navigate("/")}>
            Close for now
          </button>
        </div>
      )}
    </div>
  );
}
