import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, Minus, Clock, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchDayArchive, fetchDayPlan, fetchCategories, fetchTimeChunks, fetchTasks, unbankDay } from "../lib/api";
import { colorFor, fmtMinutes, setCategoryColors } from "../lib/categories";
import { todayStr, addDays, fmtDayHeading } from "../lib/planDates";
import ReflectionFlow from "../components/day/ReflectionFlow";
import CloseOut from "../components/day/CloseOut";
import BankedDayCard from "../components/day/BankedDayCard";

// The evening, on one page, in the order it actually goes: what went well
// and what didn't, where the hours went, the four reflection cards, and then
// bank it. Nothing else on the page, so the only way forward is down.
//
// Before four in the morning it opens on yesterday: a reflection written at
// half past midnight is still about the day you just lived.
const LATE_NIGHT_HOUR = 4;

function eveningDate() {
  const today = todayStr();
  return new Date().getHours() < LATE_NIGHT_HOUR ? addDays(today, -1) : today;
}

export default function Evening() {
  const { user } = useAuth();
  const { date: dateParam } = useParams();
  const date = dateParam ?? eveningDate();

  const [archive, setArchive] = useState(null);
  const [dayPlan, setDayPlan] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    const [a, plan, cats, ch, tk] = await Promise.all([
      fetchDayArchive(date).catch(() => null),
      fetchDayPlan(user.id, date).catch(() => null),
      fetchCategories(user.id).catch(() => []),
      fetchTimeChunks(user.id, date).catch(() => []),
      fetchTasks(user.id, date).catch(() => []),
    ]);
    setCategoryColors(cats);
    setArchive(a);
    setDayPlan(plan);
    setChunks(ch);
    setTasks(tk);
    setLoaded(true);
  }, [user?.id, date]);

  useEffect(() => {
    reload();
  }, [reload]);

  const a = archive ?? {};
  const banked = Boolean(dayPlan?.banked_at);
  const wins = (a.wins_losses ?? []).filter((w) => w.kind === "win");
  const losses = (a.wins_losses ?? []).filter((w) => w.kind === "loss");
  const rows = a.time_by_category ?? [];
  const stripTotal = rows.reduce((s, r) => s + Number(r.minutes || 0), 0);
  const tracked = (a.time_entries ?? []).reduce((s, e) => s + (Number(e.duration_minutes) || 0), 0);
  const reflectionDone = Boolean(a.journal?.reflection_completed_at);

  return (
    <div className="page page--narrow evening">
      <div className="page-head">
        <div>
          <div className="eyebrow">{date === todayStr() ? "Tonight" : "Evening"} · {fmtDayHeading(date)}</div>
          <h1 className="page-title" style={{ marginTop: 3 }}>{date === todayStr() ? "How today really went" : "How the day really went"}</h1>
        </div>
        <Link to={`/day/${date}`} className="btn btn--ghost">
          Full day
          <ArrowRight size={14} />
        </Link>
      </div>

      {!loaded ? (
        <p className="empty">Reading the day…</p>
      ) : banked ? (
        <BankedDayCard
          date={date}
          archive={{ ...a, synopsis: dayPlan?.synopsis, banked_at: dayPlan?.banked_at }}
          chunks={chunks}
          tasks={tasks}
          onReopen={async () => {
            await unbankDay(user.id, date);
            await reload();
          }}
        />
      ) : (
        <div className="stack">
          {/* Wins and losses, side by side. The one place losses appear. */}
          <div className="card">
            <div className="evening-wl">
              <div>
                <div className="row row--between" style={{ marginBottom: 8 }}>
                  <span className="eyebrow" style={{ color: "var(--accent)" }}>Wins</span>
                  <span className="evening-wl__count" style={{ color: "var(--accent)" }}>{wins.length}</span>
                </div>
                {wins.length === 0 ? (
                  <p className="faint" style={{ fontSize: 13, margin: 0 }}>None logged.</p>
                ) : (
                  wins.map((w) => (
                    <div key={w.id} className="evening-wl__row">
                      <Plus size={13} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 3 }} />
                      <span>{w.habit_label}</span>
                    </div>
                  ))
                )}
              </div>
              <div>
                <div className="row row--between" style={{ marginBottom: 8 }}>
                  <span className="eyebrow">Losses</span>
                  <span className="evening-wl__count faint">{losses.length}</span>
                </div>
                {losses.length === 0 ? (
                  <p className="faint" style={{ fontSize: 13, margin: 0 }}>None logged.</p>
                ) : (
                  losses.map((w) => (
                    <div key={w.id} className="evening-wl__row muted">
                      <Minus size={13} style={{ flexShrink: 0, marginTop: 3 }} />
                      <span>{w.habit_label}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Where the hours went. Minutes only, with no goal tallies. */}
          <div className="card">
            <div className="card-head">
              <span className="card-title"><Clock size={14} />Minutes</span>
              <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{tracked > 0 ? fmtMinutes(tracked) : "—"}</span>
            </div>
            {rows.length === 0 ? (
              <p className="empty">Nothing tracked.</p>
            ) : (
              <>
                <div className="time-strip time-strip--tall">
                  {rows.map((r) => (
                    <i key={r.category} title={`${r.category} · ${fmtMinutes(r.minutes)}`} style={{ width: `${(Number(r.minutes) / stripTotal) * 100}%`, background: colorFor(r.category) }} />
                  ))}
                </div>
                <div className="minutes-legend minutes-legend--wide">
                  {rows.map((r) => (
                    <span key={r.category} className="row" style={{ gap: 6 }}>
                      <span className="dot" style={{ background: colorFor(r.category) }} />
                      <span className="truncate">{r.category}</span>
                      <span className="mono faint">{fmtMinutes(r.minutes)}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          <ReflectionFlow userId={user?.id} date={date} journal={a.journal} moments={a.experiences ?? []} onSaved={reload} />

          <CloseOut userId={user?.id} date={date} reflectionDone={reflectionDone} onBanked={reload} />
        </div>
      )}
    </div>
  );
}
