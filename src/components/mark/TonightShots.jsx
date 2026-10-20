import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Target, Check, ArrowRight } from "lucide-react";
import { fetchRange, saveShot, readMarkLine } from "../../lib/api";
import { buildAscent } from "../../lib/ascent";
import { buildRange, ANSWERS, levelFrom, startingAnswers, focusMinutes, readLine, guessReason, shotFrom } from "../../lib/mark";
import { fmtMinutes } from "../../lib/categories";
import { useLoad } from "../../lib/useLoad";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import Gear from "../ascent/Gear";
import "../../styles/mark.css";

// Tonight's shots, in the evening reflection.
//
// One target at a time: what a bullseye takes, each answered Yes, Some or
// No (the time log answers the ones tied to a focus it saw today), and a
// line about the day if he wants one. He never aims. The answers set the
// ring; on a miss, the line is read for what got in the way, and that picks
// the section, with one tap to change it. No line, and it's a best guess
// from where recent misses gather.
//
// Each target saves the moment it's fully answered, so the evening can be
// started on the phone and finished at the desk, but nothing lands on the
// range until the day is banked: then every arrow flies at once.
//
// `flushRef` lets Bank the day save anything still waiting (a line typed a
// moment ago) before the arrows are loosed; `onReady` tells the page how
// many targets are answered.

const READ_AFTER_MS = 900;
// A line still being read when the day is banked gets this long to come
// back before the arrow flies on the app's own reading.
const FLUSH_WAIT_MS = 4000;
const ANSWER_ORDER = [2, 1, 0];

function draftKey(date) {
  return `hub.mark.tonight.${date}`;
}

function readLocal(date) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(date)) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

function writeLocal(date, drafts) {
  try {
    const out = {};
    for (const [k, d] of Object.entries(drafts)) out[k] = { values: d.values, line: d.line };
    localStorage.setItem(draftKey(date), JSON.stringify(out));
  } catch {
    /* private window: the saved shots still hold everything answered */
  }
}

export default function TonightShots({ userId, date, entries, flushRef, onReady }) {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(() => (userId ? fetchRange(userId, date) : null), [userId, date]);
  const view = useMemo(() => (data ? buildAscent(data, date) : null), [data, date]);
  const range = useMemo(() => (view ? buildRange(view, data.marks, date) : null), [view, data, date]);
  const focusesById = useMemo(() => new Map((view?.goals ?? []).flatMap((g) => g.focuses).map((f) => [f.id, f])), [view]);
  const targets = useMemo(() => range?.all ?? [], [range]);
  const askable = useMemo(() => targets.filter((t) => t.aims.length > 0), [targets]);

  const [drafts, setDrafts] = useState(null);
  const [at, setAt] = useState(null);
  const [changing, setChanging] = useState(false);
  const draftsRef = useRef(null);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const timers = useRef(new Map());
  const reads = useRef(new Map());
  const chains = useRef(new Map());

  // Tonight as it stands: what's saved, then anything half-answered on this
  // device, then what the time log knows.
  useEffect(() => {
    if (!range || drafts) return;
    const local = readLocal(date);
    const next = {};
    for (const t of range.all) {
      const saved = t.tonight;
      let values = startingAnswers(t, { focusesById, entries });
      let line = saved?.note ?? "";
      const mine = local[t.key];
      if (!saved && mine && Array.isArray(mine.values) && mine.values.length === values.length) {
        values = values.map((v, i) => mine.values[i] ?? v);
        line = String(mine.line ?? "");
      }
      next[t.key] = {
        values,
        line,
        pick: saved && saved.level > 0 && saved.reason != null ? { k: saved.reason, how: saved.reason_how ?? "guess" } : null,
        readFor: saved?.reason_how === "read" ? line : null,
        reading: false,
      };
    }
    draftsRef.current = next;
    setDrafts(next);
    setAt((range.all.find((t) => t.aims.length && levelFrom(next[t.key].values) == null) ?? range.all.find((t) => t.aims.length) ?? range.all[0])?.key ?? null);
  }, [range, drafts, date, focusesById, entries]);

  useEffect(() => {
    if (drafts) writeLocal(date, drafts);
  }, [drafts, date]);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((id) => clearTimeout(id));
  }, []);

  const readyCount = drafts ? askable.filter((t) => levelFrom(drafts[t.key]?.values) != null).length : 0;
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

  // Saves one target as it stands right now. Saves for a target run one
  // after another, each with the latest answers, so a slow one can't land
  // after a newer one and undo it.
  const persist = useCallback(
    (key) => {
      const run = async () => {
        const t = targetsRef.current.find((x) => x.key === key);
        const d = draftsRef.current?.[key];
        if (!t || !d) return;
        const pick = levelFrom(d.values) > 0 ? d.pick ?? { k: guessReason(t, date), how: "guess" } : null;
        const shot = shotFrom(t, d.values, { line: d.line, reason: pick?.k ?? null, how: pick?.how ?? null });
        if (!shot) return;
        const ref = t.kind === "goal" ? { goal_id: t.key } : t.kind === "quest" ? { quest_id: t.key } : { lesson_id: t.key };
        try {
          await saveShot(userId, ref, t.targetId, date, shot, []);
        } catch (err) {
          console.warn(err);
          toast.show("Couldn't save that shot. It's kept here; try again in a moment.");
        }
      };
      const next = (chains.current.get(key) ?? Promise.resolve()).then(run);
      chains.current.set(key, next);
      return next;
    },
    [userId, date, toast]
  );

  // The section, once a miss is fully answered: yours if you picked one, the
  // reader's if your line says, else a guess. Returns the pick to show while
  // a reading is on its way.
  const settle = useCallback(
    (key, { now = false } = {}) => {
      const t = targetsRef.current.find((x) => x.key === key);
      const d = draftsRef.current?.[key];
      if (!t || !d) return;
      clearTimeout(timers.current.get(key));
      timers.current.delete(key);
      const level = levelFrom(d.values);
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
      const answers = t.aims.map((a, i) => ({ text: a.text, v: d.values[i] }));
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
    [date, persist, update]
  );

  // Before the arrows fly: a line typed a moment ago is read now, a reading
  // in flight gets a few seconds, and every save finishes.
  useEffect(() => {
    if (!flushRef) return;
    flushRef.current = async () => {
      for (const key of [...timers.current.keys()]) settle(key);
      const pending = [...reads.current.values()].map((r) => r.job);
      if (pending.length) await Promise.race([Promise.all(pending), new Promise((r) => setTimeout(r, FLUSH_WAIT_MS))]);
      for (const key of [...reads.current.keys()]) settle(key, { now: true });
      await Promise.all([...chains.current.values()]);
    };
    return () => {
      flushRef.current = null;
    };
  }, [flushRef, settle]);

  function answer(t, j, v) {
    update(t.key, (x) => ({ ...x, values: x.values.map((old, i) => (i === j ? v : old)) }));
    if (levelFrom(draftsRef.current[t.key].values) != null) settle(t.key);
  }

  // The line is read once you stop typing for a moment, or leave the box.
  function type(t, line) {
    update(t.key, (x) => ({ ...x, line }));
    clearTimeout(timers.current.get(t.key));
    timers.current.set(
      t.key,
      setTimeout(() => settle(t.key), READ_AFTER_MS)
    );
  }

  function choose(t, k) {
    update(t.key, (x) => ({ ...x, pick: { k, how: "yours" }, reading: false }));
    setChanging(false);
    persist(t.key);
  }

  function go(key) {
    setAt(key);
    setChanging(false);
  }

  if (!data && loading) return null;
  if (!targets.length && !error) return null;

  const t = targets.find((x) => x.key === at) ?? null;
  const d = t && drafts ? drafts[t.key] : null;
  const level = d ? levelFrom(d.values) : null;
  const nextUp = drafts ? nextOpen(askable, drafts, at) : null;

  return (
    <div className="card mark mk-tonight">
      <div className="card-head" style={{ marginBottom: 8 }}>
        <span className="card-title">
          <Target size={14} />
          Tonight's shots
        </span>
        <Link to="/ascent" className="btn-link mk-tonight__range">
          The Range
          <ArrowRight size={13} />
        </Link>
      </div>

      {error && <LoadError what="tonight's targets" error={error} onRetry={reload} stale={Boolean(data)} />}

      {drafts && t && (
        <>
          <div className="mk-tabs mk-tonight__tabs" role="tablist" aria-label="Tonight's targets">
            {targets.map((x) => {
              const done = x.aims.length > 0 && levelFrom(drafts[x.key]?.values) != null;
              return (
                <button
                  key={x.key}
                  type="button"
                  role="tab"
                  className={"mk-tab" + (x.aims.length ? "" : " mk-tab--quiet")}
                  aria-selected={x.key === at}
                  onClick={() => go(x.key)}
                  ref={x.key === at ? scrollIntoRow : undefined}
                >
                  <Gear name={x.icon} size={14} />
                  {x.short}
                  {done && <Check size={13} strokeWidth={3} className="mk-tab__tick" aria-label="answered" />}
                </button>
              );
            })}
          </div>

          <div className="mk-shot" role="tabpanel" aria-label={t.title}>
            <div className="mk-shot__head">
              <span className="eyebrow">{t.kindLabel}</span>
              <b>{t.title}</b>
            </div>

            {t.aims.length === 0 ? (
              <div className="mk-shot__empty">
                <p className="card-note">Nothing is set yet for what a bullseye takes on this one.</p>
                <Link to={`/ascent/${t.key}`} className="btn-link btn-link--accent">
                  Set it up on The Range
                  <ArrowRight size={13} />
                </Link>
              </div>
            ) : (
              <>
                <div className="mk-shot__cols" aria-hidden="true">
                  <span>What a bullseye takes</span>
                  <span>Did you?</span>
                </div>
                <div className="mk-shot__aims">
                  {t.aims.map((a, j) => {
                    const focus = a.focus_id ? focusesById.get(a.focus_id) : null;
                    const mins = focus ? focusMinutes(focus, entries) : 0;
                    return (
                      <div key={a.id} className="mk-shot__aim">
                        <span className="mk-shot__text">
                          {a.text}
                          {focus && <small className={mins ? "on" : undefined}>{mins ? `Time log · ${fmtMinutes(mins)}` : "Not in your time log today"}</small>}
                        </span>
                        <div className="seg mk-shot__yn" role="group" aria-label={a.text}>
                          {ANSWER_ORDER.map((v) => (
                            <button
                              key={v}
                              type="button"
                              className={"seg-btn" + (d.values[j] === v ? " active" : "")}
                              aria-pressed={d.values[j] === v}
                              onClick={() => answer(t, j, v)}
                            >
                              {ANSWERS[v]}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

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

                {level === 0 && <p className="mk-shot__bull">All Yes: a bullseye.</p>}
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
            {askable.length === 0 ? (
              "Set what a bullseye takes on The Range, and each target gets an arrow here."
            ) : readyCount === askable.length ? (
              <>
                <b>All {askable.length} ready.</b> They fly when you bank the day.
              </>
            ) : (
              <>
                <b>
                  {readyCount} of {askable.length} ready.
                </b>{" "}
                Any you leave blank get no arrow tonight.
              </>
            )}
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

// The next target after this one that still needs answers, going round.
function nextOpen(list, drafts, at) {
  if (!list.length) return null;
  const from = list.findIndex((t) => t.key === at);
  for (let j = 1; j <= list.length; j++) {
    const t = list[(from + j + list.length) % list.length];
    if (t.key !== at && levelFrom(drafts[t.key]?.values) == null) return t;
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
