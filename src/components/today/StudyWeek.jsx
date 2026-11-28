import { useEffect, useMemo, useState } from "react";
import { BookOpen, Search, RotateCcw, Presentation, Play, Square, ChevronDown, Check } from "lucide-react";
import { switchTimer, stopTimeEntry, updateTimeEntry } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { friendlyError } from "../../lib/errors";
import { haptic } from "../../lib/haptics";
import { playClink } from "../../lib/clink";
import { parseDateStr, startOfWeek } from "../../lib/planDates";
import {
  STUDY_KINDS,
  STUDY_TAG,
  fetchStudyEntries,
  tallyWeek,
  pastWeeks,
  entryMinutes,
  seenTokens,
  markTokensSeen,
  tokenId,
  fmtStudy,
} from "../../lib/studyWeek";
import { announceChange } from "./announce";
import { useBackOnline } from "./useBackOnline";
import "../../styles/study-week.css";

// Scripture study this week, on Today (Aaron, 2026-11-28).
//
// Four kinds of study, each with its weekly minimum: sequential reading 4h,
// doctrinal investigation 2h, review and retrieval 30m, teaching practice
// 30m. More is welcome; the bar keeps going past the line.
//
// Each row is a token with a ring that fills as the week's minutes come in,
// the minutes so far against the minimum, and what today added. The round
// button starts a Study timer for that kind (whatever else is running
// stops), or stops it while it runs. When a kind's minimum is met its token
// turns orange, and the first time Today sees it happen the token strikes
// with the swords' clink.
//
// Study time timed somewhere else (the tracker, the watch) has no kind yet;
// one line says how much, and opens the list to sort it with a tap. Weeks
// that are over show their tokens in a row along the bottom.

const ICONS = { book: BookOpen, search: Search, review: RotateCcw, teach: Presentation };

const OTHER_STUDY = "Other study";

export default function StudyWeek({ userId, date, running }) {
  const { data: entries, error, reload, mutate } = useLoad(() => (userId ? fetchStudyEntries(userId, date) : []), [userId, date]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [sorting, setSorting] = useState(false);
  const [struck, setStruck] = useState(() => new Set());
  const [now, setNow] = useState(() => Date.now());
  useBackOnline(reload, Boolean(error));

  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && reload();
    window.addEventListener("hub:changed", reload);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("hub:changed", reload);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  const week = startOfWeek(date);
  const studyRunning = (entries ?? []).find((e) => !e.ended_at) ?? null;

  // While study runs, the minutes move: once every half minute is plenty.
  useEffect(() => {
    if (!studyRunning) return undefined;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [studyRunning]);

  const tally = useMemo(() => tallyWeek(entries, week, date, now), [entries, week, date, now]);
  const past = useMemo(() => pastWeeks(entries, date, now), [entries, date, now]);
  const showPast = past.some((w) => w.kinds.some((k) => k.minutes > 0));

  // A token met for the first time (on this device) strikes once.
  useEffect(() => {
    if (!entries) return undefined;
    const seen = seenTokens();
    const fresh = tally.kinds.filter((k) => k.met && !seen.has(tokenId(week, k.key))).map((k) => k.key);
    if (!fresh.length) return undefined;
    markTokensSeen(fresh.map((k) => tokenId(week, k)));
    setStruck(new Set(fresh));
    playClink();
    haptic("success");
    return undefined;
  }, [entries, tally, week]);
  useEffect(() => {
    if (!struck.size) return undefined;
    const t = setTimeout(() => setStruck(new Set()), 2600);
    return () => clearTimeout(t);
  }, [struck]);

  async function act(fn, fallback) {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await reload();
      announceChange();
    } catch (err) {
      setActionError(friendlyError(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  function startKind(kind) {
    const otherId = running?.id ?? studyRunning?.id ?? null;
    act(() => switchTimer(userId, otherId, { categories: [STUDY_TAG], subcategory: kind.key }), `Couldn't start ${kind.short.toLowerCase()}. Try again.`);
  }

  function stopKind() {
    if (!studyRunning) return;
    act(() => stopTimeEntry(studyRunning.id), "Couldn't stop the timer. Try again.");
  }

  function sortEntry(entry, value) {
    mutate((rows) => rows?.map((r) => (r.id === entry.id ? { ...r, subcategory: value } : r)));
    act(() => updateTimeEntry(entry.id, { subcategory: value }), "Couldn't sort that one. Try again.");
  }

  const daysLeft = 6 - parseDateStr(date).getDay();
  const unsortedShown = tally.unsorted.filter((e) => e.subcategory !== OTHER_STUDY);
  const unsortedMinutes = unsortedShown.reduce((s, e) => s + entryMinutes(e, now), 0);

  return (
    <div className="card study-week">
      <div className="card-head study-week__head">
        <div>
          <div className="eyebrow study-week__eyebrow">This week · {daysLeft === 0 ? "last day" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}</div>
          <span className="card-title">Scripture study</span>
        </div>
        <div className={"study-week__count" + (tally.earned === STUDY_KINDS.length ? " is-full" : "")} title="Tokens earned this week">
          <span className="mono">{tally.earned}</span>
          <span className="study-week__of">of {STUDY_KINDS.length}</span>
        </div>
      </div>

      {error && !entries ? (
        <p className="form-error">Couldn't load this week's study. <button className="btn-link" onClick={reload}>Try again</button></p>
      ) : (
        <ul className="study-rows">
          {tally.kinds.map((k) => {
            const isRunning = studyRunning?.subcategory === k.key;
            return (
              <li key={k.key} className={"study-row" + (k.met ? " is-met" : "") + (isRunning ? " is-running" : "")}>
                <Token kind={k} struck={struck.has(k.key)} />
                <div className="study-row__body">
                  <div className="study-row__line">
                    <span className="study-row__name">{k.key}</span>
                    {k.met ? (
                      <span className="study-row__done">{k.minutes - k.min >= 1 ? `+${fmtStudy(k.minutes - k.min)} over` : "Met"}</span>
                    ) : (
                      <span className="study-row__left">{fmtStudy(k.min - k.minutes)} to go</span>
                    )}
                  </div>
                  <div className="study-row__bar" aria-hidden="true">
                    <i style={{ width: `${Math.min(100, (k.minutes / k.min) * 100)}%` }} />
                  </div>
                  <div className="study-row__sub">
                    <span className="study-row__mins mono">
                      <strong>{fmtStudy(k.minutes)}</strong>
                      <span className="study-row__min"> of {fmtStudy(k.min)}</span>
                    </span>
                    {isRunning ? (
                      <span className="study-row__live">
                        <span className="running-dot" /> Running now
                      </span>
                    ) : k.today >= 1 ? (
                      <span>+{fmtStudy(k.today)} today</span>
                    ) : (
                      <span className="faint">None yet today</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className={"study-row__go" + (isRunning ? " is-stop" : "")}
                  onClick={() => (isRunning ? stopKind() : startKind(k))}
                  disabled={busy || !userId}
                  aria-label={isRunning ? `Stop ${k.short.toLowerCase()}` : `Start ${k.short.toLowerCase()}`}
                  title={isRunning ? "Stop" : `Start a Study timer for ${k.short.toLowerCase()}`}
                >
                  {isRunning ? <Square size={12} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {unsortedShown.length > 0 && (
        <div className="study-unsorted">
          <button type="button" className="study-unsorted__head" onClick={() => setSorting((s) => !s)} aria-expanded={sorting}>
            <span>
              <strong className="mono">{fmtStudy(unsortedMinutes)}</strong> of Study this week isn't sorted yet
            </span>
            <ChevronDown size={15} className={sorting ? "is-open" : ""} />
          </button>
          {sorting && (
            <ul className="study-unsorted__list">
              {unsortedShown.map((e) => (
                <li key={e.id} className="study-unsorted__item">
                  <div className="study-unsorted__when">
                    <span>{whenOf(e.started_at)}</span>
                    <span className="mono">{e.ended_at ? fmtStudy(entryMinutes(e, now)) : "running"}</span>
                    {e.description && <span className="study-unsorted__desc">{e.description}</span>}
                  </div>
                  <div className="study-unsorted__chips">
                    {STUDY_KINDS.map((k) => (
                      <button key={k.key} type="button" className="chip study-chip" onClick={() => sortEntry(e, k.key)} disabled={busy}>
                        {k.short}
                      </button>
                    ))}
                    <button type="button" className="chip study-chip study-chip--other" onClick={() => sortEntry(e, OTHER_STUDY)} disabled={busy} title="Study that isn't scripture study: it stays in your minutes, off this card">
                      Not scripture
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showPast && (
        <div className="study-past" aria-label="Tokens from past weeks">
          <div className="section-label">Past weeks</div>
          <div className="study-past__row">
            {past
              .slice()
              .reverse()
              .map((w) => (
                <div key={w.weekStart} className="study-past__week" title={`${fmtWeekShort(w.weekStart)}: ${w.earned} of ${STUDY_KINDS.length}`}>
                  <div className="study-past__dots">
                    {w.kinds.map((k) => (
                      <i key={k.key} className={k.met ? "is-met" : ""} />
                    ))}
                  </div>
                  <span className="mono">{fmtWeekShort(w.weekStart)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {actionError && <div className="form-error" style={{ marginTop: 10 }}>{actionError}</div>}
    </div>
  );
}

// The token: the kind's mark inside a ring that fills toward the minimum.
// Met, it's a solid orange coin with a check tucked on its edge.
function Token({ kind, struck }) {
  const Icon = ICONS[kind.icon] ?? BookOpen;
  const r = 19;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, kind.minutes / kind.min);
  return (
    <span className={"study-token" + (kind.met ? " is-met" : "") + (struck ? " is-struck" : "")} aria-label={kind.met ? `${kind.short} token earned` : `${Math.round(frac * 100)}% of ${kind.short.toLowerCase()}`}>
      <svg viewBox="0 0 44 44" aria-hidden="true" className="study-token__ring">
        <circle cx="22" cy="22" r={r} className="study-token__track" />
        {!kind.met && frac > 0 && <circle cx="22" cy="22" r={r} className="study-token__fill" strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 22 22)" />}
      </svg>
      <Icon size={17} strokeWidth={2.1} className="study-token__icon" />
      {kind.met && (
        <span className="study-token__check">
          <Check size={9} strokeWidth={3.5} />
        </span>
      )}
    </span>
  );
}

function whenOf(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short" }) + " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fmtWeekShort(weekStart) {
  return parseDateStr(weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
