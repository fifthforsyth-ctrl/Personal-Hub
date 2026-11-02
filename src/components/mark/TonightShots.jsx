import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Target, Check, ArrowRight } from "lucide-react";
import { fetchRange, fetchFocusWeek, saveShot, readMarkLine } from "../../lib/api";
import { buildAscent } from "../../lib/ascent";
import {
  buildRange,
  ANSWERS,
  LEVELS,
  WHOLE,
  readLine,
  guessReason,
  tonightLevel,
  tonightDraft,
  checkHint,
  readAnswers,
  sameShot,
  landsText,
  tonightRing,
  tonightShot,
} from "../../lib/mark";
import { scores } from "../../lib/checks";
import { focusWeekOf, linkedArrows, countsToward, orderGoals } from "../../lib/focus";
import { useLoad } from "../../lib/useLoad";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import Gear from "../ascent/Gear";
import CheckRow from "../checks/CheckRow";
import { useFocusWeek } from "../focus/useFocusWeek";
import "../../styles/mark.css";

// Tonight's checks, in the evening reflection.
//
// One target at a time: its checks, each answered the way it asks (Yes or
// No, 1 to 10, minutes, a time and the rest; checks.js), with the ones the
// day already knows filled in: the time log's minutes for a check with a
// focus, when you got up for an "Up by". Each can carry a line of its own,
// and there's a line about the day if he wants one. He never aims: the share
// of checks passed sets the ring. A reflection-only check is asked and kept
// but never scored. On a miss, the line is read for what got in the way, and
// that picks the section, with one tap to change it. No line, and it's a
// best guess from where recent misses gather.
//
// A weekly focus can count toward a target (this week's focus, linked to a
// lifetime goal, the quest or a lesson). The arrow it lands tonight shows
// here, read only, and counts as one more check in this target's shot; a
// target with no checks of its own lands where its focus did. Placing that
// arrow elsewhere on the page (hub:changed) re-saves the shot here, only
// when the shot would actually change.
//
// Each target saves the moment it has a ring, so the evening can be started
// on the phone and finished at the desk, but nothing lands on the range
// until the day is banked: then every arrow flies at once.
//
//   dayPlan   the day's day_plans row, for "Up by" (woke_at)
//   flushRef  lets Bank the day save anything still waiting (a line typed a
//             moment ago, an arrow placed on a focus a second ago) before
//             the arrows are loosed
//   onReady   told how many targets have a ring, of how many could
//   quick     the short evening's version: one row per target and one tap
//             each, Yes, Some or No for the day as a whole. The arrow, the
//             section it's filed under and the volley are the full evening's.

const READ_AFTER_MS = 900;
// A line still being read when the day is banked gets this long to come
// back before the arrow flies on the app's own reading.
const FLUSH_WAIT_MS = 4000;
const ANSWER_ORDER = [2, 1, 0];
// Answers typed rather than tapped settle once you stop for a moment, like
// the line, so a number isn't saved a digit at a time.
const TYPED = new Set(["number", "minutes", "time", "note"]);

// The draft on this device: { [target]: { answers: { [check id]: { value,
// line } }, line } }. Its own key, since before checks had kinds a draft was
// a list of Yes/Some/No by position; that one is cleared, never read.
function draftKey(date) {
  return `hub.mark.checks.${date}`;
}

function readLocal(date) {
  try {
    localStorage.removeItem(`hub.mark.tonight.${date}`);
    const raw = JSON.parse(localStorage.getItem(draftKey(date)) ?? "null");
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

function writeLocal(date, targets, drafts) {
  try {
    const out = {};
    for (const t of targets) {
      const d = drafts[t.key];
      if (!d) continue;
      const answers = {};
      t.aims.forEach((a, i) => {
        const x = d.answers[i];
        if (x && (x.value != null || x.line)) answers[a.id] = { value: x.value ?? null, line: x.line ?? "" };
      });
      out[t.key] = { answers, line: d.line };
    }
    localStorage.setItem(draftKey(date), JSON.stringify(out));
  } catch {
    /* private window: the saved shots still hold everything with a ring */
  }
}

// This week's focuses that count toward a target, whether or not they've
// landed an arrow tonight.
function feedsOf(t, goals) {
  return orderGoals(goals).filter((g) => {
    const to = countsToward(g);
    return to && to.kind === t.kind && to.id === t.ref?.id;
  });
}

const refOf = (t) => (t.kind === "goal" ? { goal_id: t.key } : t.kind === "quest" ? { quest_id: t.key } : { lesson_id: t.key });

export default function TonightShots({ userId, date, entries, dayPlan, flushRef, onReady, quick = false }) {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(() => (userId ? fetchRange(userId, date) : null), [userId, date]);
  const view = useMemo(() => (data ? buildAscent(data, date) : null), [data, date]);
  const range = useMemo(() => (view ? buildRange(view, data.marks, date) : null), [view, data, date]);
  const focusesById = useMemo(() => new Map((view?.goals ?? []).flatMap((g) => g.focuses).map((f) => [f.id, f])), [view]);
  const targets = useMemo(() => range?.all ?? [], [range]);

  // The week's focus, read again whenever an arrow is placed on it.
  const { data: weekData, mutate: setWeek } = useFocusWeek(userId, focusWeekOf(date));
  const feeds = useMemo(() => new Map(targets.map((t) => [t.key, feedsOf(t, weekData?.goals)])), [targets, weekData]);
  const linked = useMemo(
    () => new Map(targets.map((t) => [t.key, weekData ? linkedArrows(t, weekData.goals, weekData.checkins, date) : []])),
    [targets, weekData, date]
  );
  // Asked tonight: a target with a check that scores, or a focus that counts
  // toward it. One whose checks are all reflection only is still shown, but
  // it has no ring to land in, so it isn't counted.
  const askable = useMemo(() => targets.filter((t) => t.aims.some((a) => scores(a)) || (feeds.get(t.key)?.length ?? 0) > 0), [targets, feeds]);

  const [drafts, setDrafts] = useState(null);
  const [at, setAt] = useState(null);
  const [changing, setChanging] = useState(false);
  const draftsRef = useRef(null);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const timers = useRef(new Map());
  const reads = useRef(new Map());
  const chains = useRef(new Map());
  // Each target's shot as it was last saved, to save again only on a change.
  const saved = useRef(new Map());

  // The week as saves read it. Bank the day puts a fresh read here before
  // the last saves; a render only replaces it once the hook has newer data,
  // so a render in between can't put the old week back.
  const weekRef = useRef(null);
  const weekSeen = useRef(undefined);
  if (weekData !== weekSeen.current) {
    weekSeen.current = weekData;
    weekRef.current = weekData ?? null;
  }
  const linkOf = useCallback((t) => {
    const w = weekRef.current;
    return w ? linkedArrows(t, w.goals, w.checkins, date) : [];
  }, [date]);

  // Tonight as it stands: what's saved, then anything half-answered on this
  // device, then what the day knows.
  useEffect(() => {
    if (!range || drafts) return;
    const local = readLocal(date);
    const next = {};
    for (const t of range.all) {
      next[t.key] = tonightDraft(t, { focusesById, entries, dayPlan, mine: local[t.key] });
      if (t.tonight) saved.current.set(t.key, t.tonight);
    }
    draftsRef.current = next;
    setDrafts(next);
    const asked = range.all.filter((t) => t.aims.length > 0);
    const open = asked.find((t) => tonightRing(t, next[t.key], []).level == null);
    setAt((open ?? asked[0] ?? range.all[0])?.key ?? null);
  }, [range, drafts, date, focusesById, entries, dayPlan]);

  useEffect(() => {
    if (drafts) writeLocal(date, targetsRef.current, drafts);
  }, [drafts, date]);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((id) => clearTimeout(id));
  }, []);

  const ringOf = (t) => (drafts?.[t.key] ? tonightRing(t, drafts[t.key], linked.get(t.key) ?? []) : { level: null, tap: null, label: null });
  const readyCount = drafts ? askable.filter((t) => ringOf(t).level != null).length : 0;
  useEffect(() => {
    if (drafts) onReady?.({ ready: readyCount, total: askable.length });
  }, [readyCount, askable.length, drafts, onReady]);

  // Every change goes through here, so the ref is always the latest and a
  // save or reading started in the same tap sees it.
  const update = useCallback((key, fn) => {
    const all = draftsRef.current ?? {};
    const next = { ...all, [key]: fn(all[key]) };
    draftsRef.current = next;
    setDrafts(next);
  }, []);

  // Saves one target as it stands right now, if that's different from what
  // was last saved. Saves for a target run one after another, each with the
  // latest answers, so a slow one can't land after a newer one and undo it.
  const persist = useCallback(
    (key) => {
      const run = async () => {
        const t = targetsRef.current.find((x) => x.key === key);
        const d = draftsRef.current?.[key];
        if (!t || !d) return;
        const shot = tonightShot(t, d, { linked: linkOf(t), today: date });
        if (!shot) return;
        const was = saved.current.get(key);
        if (was && sameShot(was, shot)) return;
        try {
          const row = await saveShot(userId, refOf(t), t.targetId ?? was?.target_id ?? null, date, shot, []);
          saved.current.set(key, row ?? shot);
        } catch (err) {
          toast.error(err, "Couldn't save that shot. It's kept here; try again in a moment.");
        }
      };
      const next = (chains.current.get(key) ?? Promise.resolve()).then(run);
      chains.current.set(key, next);
      return next;
    },
    [userId, date, toast, linkOf]
  );

  // The section, once a miss has its ring: yours if you picked one, the
  // reader's if your line says, else a guess. Sets "reading" while a reading
  // is on its way.
  const settle = useCallback(
    (key, { now = false } = {}) => {
      const t = targetsRef.current.find((x) => x.key === key);
      const d = draftsRef.current?.[key];
      if (!t || !d) return;
      clearTimeout(timers.current.get(key));
      timers.current.delete(key);
      const level = tonightRing(t, d, linkOf(t)).level;
      if (level == null) return;
      if (level === 0 || d.pick?.how === "yours") {
        persist(key);
        return;
      }
      const line = d.line.trim();
      if (!line) {
        update(key, (x) => ({ ...x, pick: { k: guessReason(t, date), how: "guess" }, readFor: null }));
        persist(key);
        return;
      }
      if (d.readFor === line && d.pick) {
        persist(key);
        return;
      }
      const local = readLine(t.reasons, line);
      const fallback = local >= 0 ? { k: local, how: "read" } : { k: guessReason(t, date), how: "guess" };
      if (now) {
        update(key, (x) => ({ ...x, pick: x.pick?.how === "yours" ? x.pick : fallback, readFor: line, reading: false }));
        persist(key);
        return;
      }
      if (reads.current.get(key)?.line === line) return;
      update(key, (x) => ({ ...x, reading: true }));
      const answers = d.quick != null ? [{ text: WHOLE, v: d.quick }] : readAnswers(t, d.answers, linkOf(t));
      const job = readMarkLine({ target: t.title, reasons: t.reasons, line, answers })
        .catch((err) => {
          console.warn(err);
          return -1;
        })
        .then((k) => {
          const cur = draftsRef.current?.[key];
          if (!cur || cur.line.trim() !== line) return;
          const pick = cur.pick?.how === "yours" ? cur.pick : k >= 0 ? { k, how: "read" } : fallback;
          update(key, (x) => ({ ...x, pick, readFor: line, reading: false }));
          return persist(key);
        })
        .finally(() => {
          if (reads.current.get(key)?.job === job) reads.current.delete(key);
        });
      reads.current.set(key, { job, line });
    },
    [date, persist, update, linkOf]
  );

  // An arrow placed on a focus that counts toward a target changes that
  // target's shot: settle it again. Only a change counts (the first read of
  // the week just notes where things are, unless a saved shot may now be
  // out of date), and persist saves only when the shot really differs, so
  // nothing here can loop.
  const seen = useRef(new Map());
  const hasDrafts = drafts != null;
  useEffect(() => {
    if (!hasDrafts || !weekData) return;
    for (const t of targetsRef.current) {
      const sig = (linked.get(t.key) ?? []).map((l) => `${l.goal.id}:${l.level}`).join("|");
      const was = seen.current.get(t.key);
      seen.current.set(t.key, sig);
      if (was === sig) continue;
      if (was === undefined && !saved.current.has(t.key)) continue;
      settle(t.key);
    }
  }, [hasDrafts, weekData, linked, settle]);

  // Before the arrows fly: a line typed a moment ago is read now, a reading
  // in flight gets a few seconds, the week's focus is read fresh so an arrow
  // placed a second ago counts, and every save finishes.
  useEffect(() => {
    if (!flushRef) return;
    flushRef.current = async () => {
      for (const key of [...timers.current.keys()]) settle(key);
      const pending = [...reads.current.values()].map((r) => r.job);
      if (pending.length) await Promise.race([Promise.all(pending), new Promise((r) => setTimeout(r, FLUSH_WAIT_MS))]);
      for (const key of [...reads.current.keys()]) settle(key, { now: true });
      if (userId) {
        // As long as a reading gets, at most: a slow network mustn't hold the
        // day up. The week as last read still counts; the arrows fly either way.
        const slow = new Promise((r) => setTimeout(() => r(null), FLUSH_WAIT_MS));
        const fresh = await Promise.race([fetchFocusWeek(userId, focusWeekOf(date)), slow]).catch((err) => {
          console.warn(err);
          return null;
        });
        if (fresh) {
          weekRef.current = fresh;
          setWeek(fresh);
        }
      }
      for (const t of targetsRef.current) settle(t.key, { now: true });
      await Promise.all([...chains.current.values()]);
    };
    return () => {
      flushRef.current = null;
    };
  }, [flushRef, settle, userId, date, setWeek]);

  // Waits for a pause before settling: the line, a check's own line, and an
  // answer typed rather than tapped.
  function later(key) {
    clearTimeout(timers.current.get(key));
    timers.current.set(
      key,
      setTimeout(() => settle(key), READ_AFTER_MS)
    );
  }

  // An answer. Once every check has one, the checks set the ring, taking
  // over from a short evening's tap.
  function answer(t, j, value) {
    update(t.key, (x) => {
      const answers = x.answers.map((a, i) => (i === j ? { ...a, value } : a));
      const byChecks = x.quick != null && tonightLevel(t, answers, linkOf(t)) != null;
      return { ...x, answers, quick: byChecks ? null : x.quick };
    });
    if (TYPED.has(t.aims[j]?.kind)) later(t.key);
    else settle(t.key);
  }

  function answerLine(t, j, line) {
    update(t.key, (x) => ({ ...x, answers: x.answers.map((a, i) => (i === j ? { ...a, line } : a)) }));
    later(t.key);
  }

  // The line is read once you stop typing for a moment, or leave the box.
  function type(t, line) {
    update(t.key, (x) => ({ ...x, line }));
    later(t.key);
  }

  function choose(t, k) {
    update(t.key, (x) => ({ ...x, pick: { k, how: "yours" }, reading: false }));
    setChanging(false);
    persist(t.key);
  }

  // Quick: one tap for the day as a whole. It sets the ring over whatever the
  // checks say; the checks the day answered are kept with it, never counted.
  function tap(t, v) {
    update(t.key, (x) => ({ ...x, quick: v }));
    settle(t.key);
  }

  // Full: let the checks set the ring after a short evening's tap.
  function byChecks(t) {
    update(t.key, (x) => ({ ...x, quick: null }));
    settle(t.key);
  }

  function go(key) {
    setAt(key);
    setChanging(false);
  }

  if (!data && loading) return null;
  if (!targets.length && !error) return null;

  const countLine = (tail) =>
    readyCount === askable.length ? (
      <>
        <b>All {askable.length} ready.</b>
        {tail ? " They fly when you bank the day." : ""}
      </>
    ) : (
      <>
        <b>
          {readyCount} of {askable.length} ready.
        </b>{" "}
        Any you leave blank get no arrow tonight.
      </>
    );

  if (quick) {
    if (!askable.length && !error) return null;
    return (
      <div className="card mark mk-tonight mk-quick">
        <div className="card-head" style={{ marginBottom: 8 }}>
          <span className="card-title">
            <Target size={14} />
            Tonight's checks
          </span>
          <span className="faint mk-quick__hint">One tap each</span>
        </div>
        {error && <LoadError what="tonight's targets" error={error} onRetry={reload} stale={Boolean(data)} />}
        {drafts && (
          <>
            <div className="mk-quick__rows">
              {askable.map((x) => {
                const ring = ringOf(x);
                return (
                  <div key={x.key} className="mk-quick__row">
                    <span className="mk-quick__name">
                      <Gear name={x.icon} size={14} />
                      <span className="mk-quick__txt">
                        <span className="truncate">{x.short}</span>
                        {ring.label && <small>{ring.label}</small>}
                      </span>
                    </span>
                    <div className="seg mk-shot__yn" role="group" aria-label={`${x.title}: ${WHOLE.toLowerCase()}`}>
                      {ANSWER_ORDER.map((v) => (
                        <button key={v} type="button" className={"seg-btn" + (ring.tap === v ? " active" : "")} aria-pressed={ring.tap === v} onClick={() => tap(x, v)}>
                          {ANSWERS[v]}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mk-tonight__count" aria-live="polite">
              {countLine(true)}
            </p>
          </>
        )}
      </div>
    );
  }

  const t = targets.find((x) => x.key === at) ?? null;
  const d = t && drafts ? drafts[t.key] : null;
  const ring = t && d ? ringOf(t) : { level: null };
  const level = ring.level;
  const tLinked = t ? linked.get(t.key) ?? [] : [];
  const tFeeds = t ? feeds.get(t.key) ?? [] : [];
  const scored = t ? t.aims.some((a) => scores(a)) : false;
  const asked = t ? t.aims.length > 0 || tFeeds.length > 0 : false;
  const checksRing = t && d ? tonightLevel(t, d.answers, tLinked) : null;
  const nextUp = drafts ? nextOpen(askable, at, (x) => ringOf(x).level != null) : null;

  return (
    <div className="card mark mk-tonight">
      <div className="card-head" style={{ marginBottom: 4 }}>
        <span className="card-title">
          <Target size={14} />
          Tonight's checks
        </span>
        <Link to="/ascent" className="btn-link mk-tonight__range">
          The Range
          <ArrowRight size={13} />
        </Link>
      </div>
      <p className="card-note mk-tonight__lede">Each one asks what a bullseye takes. The share you pass puts the arrow in its ring. They fly when you bank the day.</p>

      {error && <LoadError what="tonight's targets" error={error} onRetry={reload} stale={Boolean(data)} />}

      {drafts && t && d && (
        <>
          <div className="mk-tabs mk-tonight__tabs" role="tablist" aria-label="Tonight's targets">
            {targets.map((x) => {
              const quiet = !x.aims.length && !(feeds.get(x.key)?.length > 0);
              const done = askable.includes(x) && ringOf(x).level != null;
              return (
                <button
                  key={x.key}
                  type="button"
                  role="tab"
                  className={"mk-tab" + (quiet ? " mk-tab--quiet" : "")}
                  aria-selected={x.key === at}
                  onClick={() => go(x.key)}
                  ref={x.key === at ? scrollIntoRow : undefined}
                >
                  <Gear name={x.icon} size={14} />
                  {x.short}
                  {done && <Check size={13} strokeWidth={3} className="mk-tab__tick" aria-label="ready" />}
                </button>
              );
            })}
          </div>

          <div className="mk-shot" role="tabpanel" aria-label={t.title}>
            <div className="mk-shot__head">
              <span className="eyebrow">{t.kindLabel}</span>
              <b>{t.title}</b>
            </div>

            {!asked ? (
              <div className="mk-shot__empty">
                <p className="card-note">Nothing is set yet for what a bullseye takes on this one.</p>
                <Link to={`/ascent/${t.key}`} className="btn-link btn-link--accent">
                  Set it up on The Range
                  <ArrowRight size={13} />
                </Link>
              </div>
            ) : (
              <>
                {t.aims.length > 0 && (
                  <div className="ck-list mk-shot__checks">
                    {t.aims.map((a, j) => (
                      <CheckRow
                        key={a.id}
                        check={a}
                        value={d.answers[j]?.value ?? null}
                        line={d.answers[j]?.line ?? ""}
                        onValue={(v) => answer(t, j, v)}
                        onLine={(l) => answerLine(t, j, l)}
                        hint={checkHint(a, { focusesById, entries, dayPlan })}
                      />
                    ))}
                  </div>
                )}

                {tFeeds.length > 0 && (
                  <ul className="mk-fed" aria-label="This week's focus">
                    {tFeeds.map((g) => {
                      const l = tLinked.find((x) => x.goal.id === g.id);
                      return (
                        <li key={g.id} className={l ? "on" : undefined}>
                          <i aria-hidden="true" />
                          <span>
                            <b>{g.title}</b>
                            {l ? ` · ${LEVELS[l.level].name} · counts toward this` : " · counts toward this once its arrow lands tonight"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {!t.aims.length && tFeeds.length > 0 && <p className="card-note">No checks of its own: its arrow lands where this week's focus does.</p>}
                {t.aims.length > 0 && !scored && !tFeeds.length && (
                  <p className="card-note">These are all reflection only, so there's no ring to land in tonight. Make one count on The Range to give it an arrow.</p>
                )}

                <textarea
                  className="input mk-shot__line"
                  rows={2}
                  maxLength={2000}
                  value={d.line}
                  placeholder={level != null && level > 0 ? "What got in the way?" : "A line about today, if you want"}
                  aria-label={`A line about today for ${t.short}`}
                  onChange={(e) => type(t, e.target.value)}
                  onBlur={() => timers.current.has(t.key) && settle(t.key)}
                />

                {d.quick != null ? (
                  <div className="mk-shot__quick">
                    <p>
                      The short evening said <b>{ANSWERS[d.quick]}</b> for {WHOLE.toLowerCase()}.
                      {checksRing == null && " Answer every check to land it by them instead."}
                    </p>
                    {checksRing != null && (
                      <button type="button" className="btn-link btn-link--accent mk-shot__by" onClick={() => byChecks(t)}>
                        Land it by these checks instead
                      </button>
                    )}
                  </div>
                ) : (
                  level != null && <p className={"mk-shot__lands" + (level === 0 ? " mk-shot__bull" : "")}>{landsText(level)}</p>
                )}
                {level != null && level > 0 && (
                  <Reading target={t} draft={d} changing={changing} onToggle={() => setChanging((c) => !c)} onChoose={(k) => choose(t, k)} />
                )}
              </>
            )}

            {nextUp && (
              <button type="button" className="btn btn--block mk-shot__next" onClick={() => go(nextUp.key)}>
                Next · {nextUp.short}
              </button>
            )}
          </div>

          <p className="mk-tonight__count" aria-live="polite">
            {askable.length === 0 ? "Set what a bullseye takes on The Range, and each target gets an arrow here." : countLine(false)}
          </p>
        </>
      )}
    </div>
  );
}

// What got in the way, as read or guessed, with one tap to change it.
function Reading({ target: t, draft: d, changing, onToggle, onChoose }) {
  const pick = d.pick;
  const label = d.reading
    ? null
    : pick?.how === "yours"
      ? "Filed under"
      : pick?.how === "read"
        ? "Reads as"
        : d.line.trim()
          ? "Nothing in your line to go on · best guess"
          : "No line yet · best guess";
  return (
    <div className="mk-read">
      <p className="mk-read__line" aria-live="polite">
        <span className="mk-read__what">
          {d.reading ? (
            <span className="mk-read__label">Reading your line…</span>
          ) : (
            <>
              <span className="mk-read__label">{label}</span> <b>{t.reasons[pick?.k ?? 0]}</b>
            </>
          )}
        </span>
        {!d.reading && (
          <button type="button" className="btn-link mk-read__change" aria-expanded={changing} onClick={onToggle}>
            {changing ? "Close" : "Change"}
          </button>
        )}
      </p>
      {changing && !d.reading && (
        <div className="mk-read__chips" role="group" aria-label="What got in the way">
          {t.reasons.map((r, k) => (
            <button key={k} type="button" className={"chip chip--tap" + (pick?.k === k ? " chip--on" : "")} aria-pressed={pick?.k === k} onClick={() => onChoose(k)}>
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// The next target after this one that still has no ring, going round.
function nextOpen(list, at, ready) {
  if (!list.length) return null;
  const from = list.findIndex((t) => t.key === at);
  for (let j = 1; j <= list.length; j++) {
    const t = list[(from + j + list.length) % list.length];
    if (t.key !== at && !ready(t)) return t;
  }
  return null;
}

// Keeps the chosen tab in view without scrolling the page.
function scrollIntoRow(el) {
  if (!el) return;
  const row = el.parentElement;
  if (!row) return;
  const left = el.offsetLeft - row.offsetLeft - 24;
  if (left < row.scrollLeft || el.offsetLeft + el.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollLeft = Math.max(0, left);
}
