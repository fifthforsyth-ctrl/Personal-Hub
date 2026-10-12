import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, Check, ChevronDown, CornerDownLeft, History, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLoad } from "../lib/useLoad";
import { useToast, useConfirm } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import { previewText, cutAtWord } from "../lib/markdown";
import { dayLabel } from "../components/study/dayLabel";
import {
  fetchOpenLoops,
  fetchExperiences,
  logExperience,
  updateExperience,
  deleteExperience,
  closeExperienceLoop,
  fetchPrayers,
  logPrayerWithRefs,
  updatePrayer,
  deletePrayer,
  fetchOnThisDay,
  fetchReferencedScriptures,
  fetchEntriesForScripture,
  fetchGoalPaths,
} from "../lib/api";
import "../styles/spirit.css";

// Promptings & prayer.
//
// Its center is the open loop: a prompting written down and brought back
// until you say what came of it. That round trip is what turns years of this
// into something you can see patterns in, rather than a diary you never
// reread. Only promptings loop. A tender mercy or a comfort is something to
// keep, not something to do, so it goes straight to the record.
//
// Everything is written down in one box at the top, and every row below it
// can be fixed or deleted (with Undo).

const KINDS = [
  { key: "prompting", label: "Prompting" },
  { key: "tender_mercy", label: "Tender mercy" },
  { key: "answer", label: "Answer" },
  { key: "impression", label: "Impression" },
  { key: "comfort", label: "Comfort" },
  { key: "warning", label: "Warning" },
  { key: "insight", label: "Insight" },
];
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.key, k.label]));
const kindLabel = (key) => KIND_LABEL[key] ?? "Experience";

const MODES = [
  {
    key: "prompting",
    label: "Prompting",
    placeholder: "What came to you? Something to do, someone to reach out to…",
    hint: "It waits under To act on until you say what you did.",
  },
  {
    key: "tender_mercy",
    label: "Tender mercy",
    placeholder: "What happened? Where did you see His hand?",
    hint: "Kept under Recorded. Nothing to follow up.",
  },
  {
    key: "prayer",
    label: "Prayer",
    placeholder: "What did you pray about?",
    hint: "Kept under Prayers.",
  },
];

const TABS = [
  { key: "act", label: "To act on" },
  { key: "recorded", label: "Recorded" },
  { key: "prayers", label: "Prayers" },
  { key: "scripture", label: "Scripture" },
];

const PAGE = 100;

// "Today", "Yesterday", "3 days ago", then the date. Counted in calendar days
// where you are, so something from 11pm last night is "Yesterday" at 7am.
function ageLabel(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return dayLabel(value);
}

const byOccurred = (a, b) => new Date(a.occurred_at) - new Date(b.occurred_at);

function useIdSet() {
  const [ids, setIds] = useState(() => new Set());
  const add = useCallback((id) => setIds((prev) => new Set(prev).add(id)), []);
  const remove = useCallback(
    (id) =>
      setIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }),
    []
  );
  return [ids, add, remove];
}

export default function Spirit() {
  const { user } = useAuth();
  const userId = user?.id;
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "act";
  const setTab = useCallback((key) => setParams(key === "act" ? {} : { tab: key }, { replace: true }), [setParams]);

  // A prompting written down a minute ago belongs on the list too: this page
  // is where it was written, and the list is where you'd look for it.
  const loops = useLoad(() => (userId ? fetchOpenLoops(userId, { minAgeHours: 0 }) : Promise.resolve([])), [userId]);
  const expLimit = useRef(PAGE);
  const experiences = useLoad(() => (userId ? fetchExperiences(userId, { limit: expLimit.current }) : Promise.resolve([])), [userId]);
  const prayerLimit = useRef(PAGE);
  const prayers = useLoad(() => (userId ? fetchPrayers(userId, { limit: prayerLimit.current }) : Promise.resolve([])), [userId]);

  // Goals only load once something wants to show or pick one.
  const [goalsWanted, setGoalsWanted] = useState(false);
  const goals = useLoad(() => (goalsWanted && userId ? fetchGoalPaths(userId) : Promise.resolve(null)), [goalsWanted, userId]);
  const wantGoals = useCallback(() => setGoalsWanted(true), []);

  const [goneExp, hideExp, unhideExp] = useIdSet(); // deleted, waiting out the Undo
  const [gonePrayers, hidePrayer, unhidePrayer] = useIdSet();
  const [settled, settle, unsettle] = useIdSet(); // "nothing to do", waiting out the Undo

  // Keeps both lists in step with a row the server sent back.
  const putExperience = useCallback(
    (row) => {
      experiences.mutate((list) => (list ?? []).map((e) => (e.id === row.id ? row : e)));
      loops.mutate((list) => {
        const rest = (list ?? []).filter((e) => e.id !== row.id);
        return row.kind === "prompting" && !row.acted_on ? [...rest, row].sort(byOccurred) : rest;
      });
    },
    [experiences, loops]
  );

  // --- Writing something down -------------------------------------------------

  async function keep(mode, fields) {
    try {
      if (mode === "prayer") {
        const row = await logPrayerWithRefs(userId, fields);
        prayers.mutate((list) => [row, ...(list ?? [])]);
        toast.show("Prayer kept", tab === "prayers" ? {} : { actionLabel: "See it", onAction: () => setTab("prayers") });
      } else {
        const row = await logExperience(userId, { kind: mode, ...fields });
        experiences.mutate((list) => [row, ...(list ?? [])]);
        if (mode === "prompting") {
          loops.mutate((list) => [...(list ?? []), row].sort(byOccurred));
          toast.show("Prompting kept", tab === "act" ? {} : { actionLabel: "See it", onAction: () => setTab("act") });
        } else {
          toast.show(`${kindLabel(mode)} kept`, tab === "recorded" ? {} : { actionLabel: "See it", onAction: () => setTab("recorded") });
        }
      }
      return true;
    } catch (err) {
      toast.error(err, "Couldn't keep that. It's still in the box.");
      return false;
    }
  }

  // --- Following a prompting through ------------------------------------------

  async function markDone(loop, fields) {
    try {
      putExperience(await closeExperienceLoop(userId, loop.id, fields));
      toast.show("Marked done");
      return true;
    } catch (err) {
      toast.error(err, "Couldn't save that.");
      return false;
    }
  }

  // Off the list at once, closed for real once the Undo has had its time.
  // Only the loop is closed: whatever was written about it stays.
  function keepAsIs(loop) {
    settle(loop.id);
    toast.undoable({
      message: "Kept, with nothing to do",
      run: async () => {
        putExperience(await updateExperience(userId, loop.id, { acted_on: true, acted_on_at: new Date().toISOString() }));
        unsettle(loop.id);
      },
      onUndo: () => unsettle(loop.id),
    });
  }

  // --- Fixing and deleting ------------------------------------------------------

  async function saveExperience(entry, changes) {
    try {
      putExperience(await updateExperience(userId, entry.id, changes));
      toast.show("Saved");
      return true;
    } catch (err) {
      toast.error(err, "Couldn't save that.");
      return false;
    }
  }

  function removeExperience(entry) {
    hideExp(entry.id);
    toast.undoable({
      message: `${kindLabel(entry.kind)} deleted`,
      run: async () => {
        await deleteExperience(entry.id);
        experiences.mutate((list) => (list ?? []).filter((e) => e.id !== entry.id));
        loops.mutate((list) => (list ?? []).filter((e) => e.id !== entry.id));
      },
      onUndo: () => unhideExp(entry.id),
    });
  }

  async function savePrayer(prayer, changes) {
    try {
      const row = await updatePrayer(userId, prayer.id, changes);
      prayers.mutate((list) => (list ?? []).map((p) => (p.id === row.id ? row : p)));
      toast.show("Saved");
      return true;
    } catch (err) {
      toast.error(err, "Couldn't save that.");
      return false;
    }
  }

  function removePrayer(prayer) {
    hidePrayer(prayer.id);
    toast.undoable({
      message: "Prayer deleted",
      run: async () => {
        await deletePrayer(prayer.id);
        prayers.mutate((list) => (list ?? []).filter((p) => p.id !== prayer.id));
      },
      onUndo: () => unhidePrayer(prayer.id),
    });
  }

  async function showOlder(which) {
    if (which === "prayers") {
      prayerLimit.current += PAGE;
      await prayers.reload();
    } else {
      expLimit.current += PAGE;
      await experiences.reload();
    }
  }

  const openCount = (loops.data ?? []).filter((e) => !settled.has(e.id) && !goneExp.has(e.id)).length;
  const goalProps = { goals, onWantGoals: wantGoals };

  return (
    <div className="page page--narrow spirit">
      <header className="spirit-head">
        <h1 className="page-title">Promptings &amp; prayer</h1>
        <p className="page-sub">
          Write down what came, follow it through, and keep your prayers. Study notes are on the <Link to="/study">Board</Link>.
        </p>
      </header>

      <Composer onKeep={keep} {...goalProps} />

      <div className="seg seg--block spirit-tabs" role="group" aria-label="Show">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={"seg-btn" + (tab === t.key ? " active" : "")}
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === "act" && openCount > 0 && <span className="spirit-tabs__n">{openCount}</span>}
          </button>
        ))}
      </div>

      {tab === "act" && (
        <div className="stack">
          <ActOn
            loops={loops}
            hidden={(id) => settled.has(id) || goneExp.has(id)}
            onDone={markDone}
            onKeepAsIs={keepAsIs}
            onSave={saveExperience}
            onDelete={removeExperience}
            {...goalProps}
          />
          <OnThisDay userId={userId} />
        </div>
      )}

      {tab === "recorded" && (
        <Recorded
          experiences={experiences}
          hidden={goneExp}
          hasOlder={(experiences.data?.length ?? 0) >= expLimit.current}
          onOlder={() => showOlder("experiences")}
          onSave={saveExperience}
          onDelete={removeExperience}
          {...goalProps}
        />
      )}

      {tab === "prayers" && (
        <Prayers
          prayers={prayers}
          hidden={gonePrayers}
          hasOlder={(prayers.data?.length ?? 0) >= prayerLimit.current}
          onOlder={() => showOlder("prayers")}
          onSave={savePrayer}
          onDelete={removePrayer}
        />
      )}

      {tab === "scripture" && <Scripture userId={userId} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The box at the top
// ---------------------------------------------------------------------------

// One box for all three, so writing something down never starts with finding
// the right page. `onKeep` resolves true once it's kept; anything else leaves
// the words where they are.
function Composer({ onKeep, goals, onWantGoals }) {
  const [mode, setMode] = useState("prompting");
  const [whatCame, setWhatCame] = useState("");
  const [context, setContext] = useState("");
  const [goalId, setGoalId] = useState("");
  const [prayer, setPrayer] = useState("");
  const [felt, setFelt] = useState("");
  const [when, setWhen] = useState("");
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const textRef = useRef(null);

  const current = MODES.find((m) => m.key === mode);
  const isPrayer = mode === "prayer";
  const main = isPrayer ? prayer : whatCame;

  async function submit(e) {
    e?.preventDefault();
    if (!main.trim() || busy) return;
    setBusy(true);
    let kept = false;
    try {
      kept = await onKeep(
        mode,
        isPrayer
          ? { content: prayer.trim(), feltResponse: felt.trim(), context: when.trim() }
          : { whatCame: whatCame.trim(), triggerContext: context.trim(), linkedGoalId: goalId || null }
      );
    } finally {
      setBusy(false);
    }
    if (!kept) return;
    if (isPrayer) {
      setPrayer("");
      setFelt("");
      setWhen("");
    } else {
      setWhatCame("");
      setContext("");
      setGoalId("");
    }
    setMore(false);
    textRef.current?.focus();
  }

  return (
    <form className="card spirit-compose" onSubmit={submit}>
      <div className="seg seg--block spirit-compose__modes" role="radiogroup" aria-label="What you're writing down">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={mode === m.key}
            className={"seg-btn" + (mode === m.key ? " active" : "")}
            onClick={() => setMode(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <p className="spirit-compose__hint">{current.hint}</p>

      <textarea
        ref={textRef}
        className="textarea spirit-compose__text"
        aria-label={isPrayer ? "What you prayed about" : "What came"}
        placeholder={current.placeholder}
        value={main}
        onChange={(e) => (isPrayer ? setPrayer(e.target.value) : setWhatCame(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
        }}
      />

      {isPrayer && (
        <input
          className="input spirit-compose__felt"
          aria-label="What came in response"
          placeholder="Anything that came in response? (optional)"
          value={felt}
          onChange={(e) => setFelt(e.target.value)}
        />
      )}

      {more && (
        <div className="spirit-compose__more">
          {isPrayer ? (
            <label className="spirit-field">
              <span>When or where (optional)</span>
              <input className="input" value={when} onChange={(e) => setWhen(e.target.value)} placeholder="Morning, before the interview…" />
            </label>
          ) : (
            <>
              <label className="spirit-field">
                <span>What was happening (optional)</span>
                <input className="input" value={context} onChange={(e) => setContext(e.target.value)} placeholder="Reading, driving, in a meeting…" />
              </label>
              <GoalPicker goals={goals} onWantGoals={onWantGoals} value={goalId} onChange={setGoalId} />
            </>
          )}
        </div>
      )}

      <div className="spirit-compose__foot">
        <button type="button" className="btn-link spirit-compose__toggle" aria-expanded={more} onClick={() => setMore((v) => !v)}>
          <ChevronDown size={13} className={more ? "is-flipped" : ""} />
          {more ? "Less detail" : "More detail"}
        </button>
        <button type="submit" className="btn btn--accent" disabled={busy || !main.trim()}>
          <CornerDownLeft size={14} />
          {busy ? "Keeping…" : "Keep it"}
        </button>
      </div>
    </form>
  );
}

function GoalPicker({ goals, onWantGoals, value, onChange }) {
  useEffect(() => {
    onWantGoals();
  }, [onWantGoals]);

  const ready = Boolean(goals.data);
  return (
    <div className="spirit-field">
      <label>
        <span>Goal (optional)</span>
        <select className="input" value={ready ? value : ""} onChange={(e) => onChange(e.target.value)} disabled={!ready}>
          <option value="">{ready ? "No goal" : goals.error ? "Couldn't load your goals" : "Loading your goals…"}</option>
          {(goals.data ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.path}
            </option>
          ))}
        </select>
      </label>
      {goals.error && <LoadError what="your goals" error={goals.error} onRetry={goals.reload} className="spirit-field__error" />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// To act on
// ---------------------------------------------------------------------------

function ActOn({ loops, hidden, onDone, onKeepAsIs, onSave, onDelete, goals, onWantGoals }) {
  const [acting, setActing] = useState(null);
  const [editing, setEditing] = useState(null);
  const rows = (loops.data ?? []).filter((e) => !hidden(e.id));

  return (
    <section className="card spirit-card">
      <div className="card-head">
        <h2 className="card-title">Promptings to act on</h2>
      </div>
      <p className="card-note spirit-card__note">
        Each one stays here until you say what you did, or that there was nothing to do.
      </p>

      {loops.loading ? (
        <p className="spirit-empty">Loading…</p>
      ) : loops.error && !loops.data ? (
        <LoadError what="your promptings" error={loops.error} onRetry={loops.reload} />
      ) : (
        <>
          {loops.error && <LoadError stale error={loops.error} onRetry={loops.reload} />}
          {rows.length === 0 ? (
            <p className="spirit-empty">Nothing waiting. A prompting you write down above stays here until you've acted on it.</p>
          ) : (
            <ul className="spirit-list">
              {rows.map((loop) =>
                editing === loop.id ? (
                  <li key={loop.id} className="spirit-row">
                    <ExperienceForm
                      entry={loop}
                      goals={goals}
                      onWantGoals={onWantGoals}
                      onCancel={() => setEditing(null)}
                      onSave={async (changes) => {
                        const ok = await onSave(loop, changes);
                        if (ok) setEditing(null);
                        return ok;
                      }}
                      onDelete={() => {
                        setEditing(null);
                        onDelete(loop);
                      }}
                    />
                  </li>
                ) : (
                  <li key={loop.id} className="spirit-row">
                    <p className="spirit-row__text spirit-row__text--first">{loop.what_came}</p>
                    <div className="spirit-row__meta">
                      <span>{ageLabel(loop.occurred_at)}</span>
                      {loop.trigger_context && <span className="spirit-row__context">{loop.trigger_context}</span>}
                      <EditButton
                        onClick={() => {
                          setActing(null);
                          setEditing(loop.id);
                        }}
                      />
                    </div>

                    {acting === loop.id ? (
                      <ActOnForm
                        loop={loop}
                        onCancel={() => setActing(null)}
                        onSave={async (fields) => {
                          const ok = await onDone(loop, fields);
                          if (ok) setActing(null);
                          return ok;
                        }}
                      />
                    ) : (
                      <div className="spirit-row__actions">
                        <button
                          type="button"
                          className="btn btn--sm"
                          onClick={() => {
                            setEditing(null);
                            setActing(loop.id);
                          }}
                        >
                          <Check size={14} />
                          I acted on it
                        </button>
                        <button type="button" className="btn btn--sm" onClick={() => onKeepAsIs(loop)}>
                          Nothing to do, just keep it
                        </button>
                      </div>
                    )}
                  </li>
                )
              )}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function ActOnForm({ loop, onSave, onCancel }) {
  const [action, setAction] = useState(loop.action_taken ?? "");
  const [followUp, setFollowUp] = useState(loop.follow_up_notes ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const ok = await onSave({ actionTaken: action.trim(), followUpNotes: followUp.trim() });
    if (!ok) setBusy(false);
  }

  return (
    <form className="spirit-form" onSubmit={submit}>
      <label className="spirit-field">
        <span>What did you do?</span>
        <input className="input" value={action} onChange={(e) => setAction(e.target.value)} autoFocus />
      </label>
      <label className="spirit-field">
        <span>How did it go? (optional)</span>
        <textarea className="textarea spirit-form__small" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
      </label>
      <div className="spirit-form__actions">
        <span className="spacer" />
        <button type="button" className="btn btn--sm" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn--sm btn--accent" disabled={busy}>
          {busy ? "Saving…" : "Mark it done"}
        </button>
      </div>
    </form>
  );
}

// "On this day" in earlier years, across prayers, promptings and Board notes.
function OnThisDay({ userId }) {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useLoad(() => (userId ? fetchOnThisDay() : Promise.resolve([])), [userId]);

  if (loading || (!error && !data?.length)) return null;

  return (
    <section className="card spirit-card">
      <div className="card-head">
        <h2 className="card-title">
          <History size={14} />
          On this day
        </h2>
      </div>
      {error && !data ? (
        <LoadError what="this day in earlier years" error={error} onRetry={reload} />
      ) : (
        <ul className="spirit-list">
          {data.map((item) => (
            <li key={`${item.source}-${item.id}`} className="spirit-row">
              <div className="spirit-row__top">
                <span className="spirit-row__kind">{entryTitle(item)}</span>
                <span className="spirit-row__date">{dayLabel(item.occurred_at)}</span>
              </div>
              <p className="spirit-row__text">{previewText(item.body, 260)}</p>
              {item.source === "study_note" && (
                <div className="spirit-row__actions">
                  <button type="button" className="btn-link" onClick={() => navigate(`/study?note=${item.id}`)}>
                    <BookOpen size={13} />
                    Open on the Board
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// What a cross-referenced entry is called: a kind, a prayer's context, or a
// note's title.
function entryTitle(item) {
  if (item.source === "experience") return kindLabel(item.title);
  if (item.source === "prayer") return item.title || "Prayer";
  return cutAtWord(item.title || "Board note", 90);
}

// ---------------------------------------------------------------------------
// Recorded
// ---------------------------------------------------------------------------

function Recorded({ experiences, hidden, hasOlder, onOlder, onSave, onDelete, goals, onWantGoals }) {
  const [editing, setEditing] = useState(null);
  const rows = (experiences.data ?? []).filter((e) => !hidden.has(e.id));
  const anyGoal = rows.some((e) => e.linked_goal_id);

  useEffect(() => {
    if (anyGoal) onWantGoals();
  }, [anyGoal, onWantGoals]);

  const goalById = useMemo(() => new Map((goals.data ?? []).map((g) => [g.id, g])), [goals.data]);

  return (
    <section className="card spirit-card">
      <div className="card-head">
        <h2 className="card-title">Everything you've recorded</h2>
      </div>

      {experiences.loading ? (
        <p className="spirit-empty">Loading…</p>
      ) : experiences.error && !experiences.data ? (
        <LoadError what="what you've recorded" error={experiences.error} onRetry={experiences.reload} />
      ) : (
        <>
          {experiences.error && <LoadError stale error={experiences.error} onRetry={experiences.reload} />}
          {rows.length === 0 ? (
            <p className="spirit-empty">Nothing recorded yet. Write down a prompting or a tender mercy in the box above.</p>
          ) : (
            <ul className="spirit-list">
              {rows.map((entry) => (
                <li key={entry.id} className="spirit-row">
                  {editing === entry.id ? (
                    <ExperienceForm
                      entry={entry}
                      goals={goals}
                      onWantGoals={onWantGoals}
                      onCancel={() => setEditing(null)}
                      onSave={async (changes) => {
                        const ok = await onSave(entry, changes);
                        if (ok) setEditing(null);
                        return ok;
                      }}
                      onDelete={() => {
                        setEditing(null);
                        onDelete(entry);
                      }}
                    />
                  ) : (
                    <ExperienceView entry={entry} goal={goalById.get(entry.linked_goal_id)} onEdit={() => setEditing(entry.id)} />
                  )}
                </li>
              ))}
            </ul>
          )}
          {hasOlder && <Older onOlder={onOlder} />}
        </>
      )}
    </section>
  );
}

function ExperienceView({ entry, goal, onEdit }) {
  // Where a prompting stands. Other kinds have nothing to follow up.
  let status = null;
  if (entry.kind === "prompting") {
    if (!entry.acted_on) status = "Still to do";
    else if (!entry.action_taken && !entry.follow_up_notes) status = "Nothing to do";
  }

  return (
    <>
      <div className="spirit-row__top">
        <span className="spirit-row__kind">{kindLabel(entry.kind)}</span>
        {status && <span className={"spirit-row__status" + (entry.acted_on ? "" : " is-open")}>{status}</span>}
        <span className="spirit-row__date">{dayLabel(entry.occurred_at)}</span>
        <EditButton onClick={onEdit} />
      </div>
      <p className="spirit-row__text">{entry.what_came}</p>
      <Lines
        lines={[
          ["What was happening", entry.trigger_context],
          ["What you did", entry.action_taken],
          ["How it went", entry.follow_up_notes],
          ["Goal", goal?.title],
        ]}
      />
    </>
  );
}

function EditButton({ onClick }) {
  return (
    <button type="button" className="btn-link spirit-row__edit" onClick={onClick}>
      Edit
    </button>
  );
}

// "What you did: Said yes", a line each, only for what's there.
function Lines({ lines }) {
  const shown = lines.filter(([, value]) => value);
  if (shown.length === 0) return null;
  return (
    <div className="spirit-row__lines">
      {shown.map(([label, value]) => (
        <p key={label}>
          <span>{label}:</span> {value}
        </p>
      ))}
    </div>
  );
}

// Fixing a record. Only what changed is sent, so an untouched field can't be
// blanked by a form that didn't load it.
function ExperienceForm({ entry, goals, onWantGoals, onSave, onCancel, onDelete }) {
  const confirm = useConfirm();
  const [kind, setKind] = useState(entry.kind);
  const [whatCame, setWhatCame] = useState(entry.what_came ?? "");
  const [context, setContext] = useState(entry.trigger_context ?? "");
  const [done, setDone] = useState(Boolean(entry.acted_on));
  const [action, setAction] = useState(entry.action_taken ?? "");
  const [followUp, setFollowUp] = useState(entry.follow_up_notes ?? "");
  const [goalId, setGoalId] = useState(entry.linked_goal_id ?? "");
  const [busy, setBusy] = useState(false);

  const was = (v) => String(v ?? "").trim();
  const followable = kind === "prompting" || entry.acted_on || entry.action_taken || entry.follow_up_notes;

  const changes = {};
  if (kind !== entry.kind) changes.kind = kind;
  if (whatCame.trim() !== was(entry.what_came)) changes.what_came = whatCame.trim();
  if (context.trim() !== was(entry.trigger_context)) changes.trigger_context = context.trim() || null;
  if (followable) {
    if (done !== Boolean(entry.acted_on)) {
      changes.acted_on = done;
      changes.acted_on_at = done ? new Date().toISOString() : null;
    }
    if (action.trim() !== was(entry.action_taken)) changes.action_taken = action.trim() || null;
    if (followUp.trim() !== was(entry.follow_up_notes)) changes.follow_up_notes = followUp.trim() || null;
  }
  if ((goalId || null) !== (entry.linked_goal_id ?? null)) changes.linked_goal_id = goalId || null;
  const dirty = Object.keys(changes).length > 0;

  async function submit(e) {
    e.preventDefault();
    if (busy || !whatCame.trim()) return;
    if (!dirty) {
      onCancel();
      return;
    }
    setBusy(true);
    const ok = await onSave(changes);
    if (!ok) setBusy(false);
  }

  async function cancel() {
    if (dirty && !(await confirm({ title: "Throw away your changes?", confirmLabel: "Throw away", cancelLabel: "Keep editing" }))) return;
    onCancel();
  }

  return (
    <form className="spirit-form" onSubmit={submit}>
      <div className="spirit-field">
        <span id={`kind-${entry.id}`}>What it was</span>
        <div className="spirit-chips" role="radiogroup" aria-labelledby={`kind-${entry.id}`}>
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              role="radio"
              aria-checked={kind === k.key}
              className={"chip spirit-chip" + (kind === k.key ? " is-on" : "")}
              onClick={() => setKind(k.key)}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <label className="spirit-field">
        <span>What came</span>
        <textarea className="textarea spirit-form__text" value={whatCame} onChange={(e) => setWhatCame(e.target.value)} autoFocus />
      </label>

      <label className="spirit-field">
        <span>What was happening (optional)</span>
        <input className="input" value={context} onChange={(e) => setContext(e.target.value)} />
      </label>

      {followable && (
        <>
          <div className="spirit-field">
            <span id={`stands-${entry.id}`}>Where it stands</span>
            <div className="seg spirit-form__seg" role="radiogroup" aria-labelledby={`stands-${entry.id}`}>
              <button type="button" role="radio" aria-checked={!done} className={"seg-btn" + (!done ? " active" : "")} onClick={() => setDone(false)}>
                Still to do
              </button>
              <button type="button" role="radio" aria-checked={done} className={"seg-btn" + (done ? " active" : "")} onClick={() => setDone(true)}>
                Done
              </button>
            </div>
          </div>
          <label className="spirit-field">
            <span>What you did (optional)</span>
            <input className="input" value={action} onChange={(e) => setAction(e.target.value)} />
          </label>
          <label className="spirit-field">
            <span>How it went (optional)</span>
            <textarea className="textarea spirit-form__small" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
          </label>
        </>
      )}

      <GoalPicker goals={goals} onWantGoals={onWantGoals} value={goalId} onChange={setGoalId} />

      <div className="spirit-form__actions">
        <button type="button" className="btn-link btn-link--danger spirit-form__delete" onClick={onDelete} disabled={busy}>
          <Trash2 size={13} />
          Delete
        </button>
        <span className="spacer" />
        <button type="button" className="btn btn--sm" onClick={cancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn--sm btn--accent" disabled={busy || !whatCame.trim()}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function Older({ onOlder }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--sm spirit-older"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onOlder();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Loading…" : "Show older"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Prayers
// ---------------------------------------------------------------------------

function Prayers({ prayers, hidden, hasOlder, onOlder, onSave, onDelete }) {
  const [editing, setEditing] = useState(null);
  const rows = (prayers.data ?? []).filter((p) => !hidden.has(p.id));

  return (
    <section className="card spirit-card">
      <div className="card-head">
        <h2 className="card-title">Prayers</h2>
      </div>

      {prayers.loading ? (
        <p className="spirit-empty">Loading…</p>
      ) : prayers.error && !prayers.data ? (
        <LoadError what="your prayers" error={prayers.error} onRetry={prayers.reload} />
      ) : (
        <>
          {prayers.error && <LoadError stale error={prayers.error} onRetry={prayers.reload} />}
          {rows.length === 0 ? (
            <p className="spirit-empty">No prayers kept yet. Pick Prayer in the box above to write one down.</p>
          ) : (
            <ul className="spirit-list">
              {rows.map((p) => (
                <li key={p.id} className="spirit-row">
                  {editing === p.id ? (
                    <PrayerForm
                      prayer={p}
                      onCancel={() => setEditing(null)}
                      onSave={async (changes) => {
                        const ok = await onSave(p, changes);
                        if (ok) setEditing(null);
                        return ok;
                      }}
                      onDelete={() => {
                        setEditing(null);
                        onDelete(p);
                      }}
                    />
                  ) : (
                    <>
                      <div className="spirit-row__top">
                        <span className="spirit-row__kind">{p.context || "Prayer"}</span>
                        <span className="spirit-row__date">{dayLabel(p.prayed_at)}</span>
                        <EditButton onClick={() => setEditing(p.id)} />
                      </div>
                      <p className="spirit-row__text">{p.content}</p>
                      <Lines lines={[["What came", p.felt_response]]} />
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {hasOlder && <Older onOlder={onOlder} />}
        </>
      )}
    </section>
  );
}

function PrayerForm({ prayer, onSave, onCancel, onDelete }) {
  const confirm = useConfirm();
  const [context, setContext] = useState(prayer.context ?? "");
  const [content, setContent] = useState(prayer.content ?? "");
  const [felt, setFelt] = useState(prayer.felt_response ?? "");
  const [busy, setBusy] = useState(false);

  const was = (v) => String(v ?? "").trim();
  const changes = {};
  if (context.trim() !== was(prayer.context)) changes.context = context;
  if (content.trim() !== was(prayer.content)) changes.content = content;
  if (felt.trim() !== was(prayer.felt_response)) changes.feltResponse = felt;
  const dirty = Object.keys(changes).length > 0;

  async function submit(e) {
    e.preventDefault();
    if (busy || !content.trim()) return;
    if (!dirty) {
      onCancel();
      return;
    }
    setBusy(true);
    const ok = await onSave(changes);
    if (!ok) setBusy(false);
  }

  async function cancel() {
    if (dirty && !(await confirm({ title: "Throw away your changes?", confirmLabel: "Throw away", cancelLabel: "Keep editing" }))) return;
    onCancel();
  }

  return (
    <form className="spirit-form" onSubmit={submit}>
      <label className="spirit-field">
        <span>What you prayed about</span>
        <textarea className="textarea spirit-form__text" value={content} onChange={(e) => setContent(e.target.value)} autoFocus />
      </label>
      <label className="spirit-field">
        <span>What came in response (optional)</span>
        <input className="input" value={felt} onChange={(e) => setFelt(e.target.value)} />
      </label>
      <label className="spirit-field">
        <span>When or where (optional)</span>
        <input className="input" value={context} onChange={(e) => setContext(e.target.value)} />
      </label>
      <div className="spirit-form__actions">
        <button type="button" className="btn-link btn-link--danger spirit-form__delete" onClick={onDelete} disabled={busy}>
          <Trash2 size={13} />
          Delete
        </button>
        <span className="spacer" />
        <button type="button" className="btn btn--sm" onClick={cancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn--sm btn--accent" disabled={busy || !content.trim()}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Scripture
// ---------------------------------------------------------------------------

const FEW_BOOKS = 12;

// Pick a book you've written about and see everything that ever touched it:
// prayers, promptings and Board notes together, one row each however many
// verses of that book it mentions.
function Scripture({ userId }) {
  const navigate = useNavigate();
  const books = useLoad(() => (userId ? fetchReferencedScriptures(userId) : Promise.resolve([])), [userId]);
  const [book, setBook] = useState(null);
  const [chapter, setChapter] = useState("");
  const [allBooks, setAllBooks] = useState(false);

  const entries = useLoad(
    () => (book ? fetchEntriesForScripture(book, chapter ? Number(chapter) : null) : Promise.resolve(null)),
    [book, chapter]
  );

  const list = books.data ?? [];
  const current = list.find((b) => b.book === book) ?? null;
  // The chosen book stays in view even when it isn't one of the first few.
  const shown = allBooks ? list : list.slice(0, FEW_BOOKS).concat(current && list.indexOf(current) >= FEW_BOOKS ? [current] : []);
  const unit = book === "Doctrine and Covenants" ? "Section" : "Chapter";

  const grouped = useMemo(() => {
    const byEntry = new Map();
    for (const e of entries.data ?? []) {
      const key = `${e.source}-${e.id}`;
      const have = byEntry.get(key);
      if (have) {
        if (!have.refs.includes(e.raw_ref)) have.refs.push(e.raw_ref);
      } else byEntry.set(key, { ...e, key, refs: [e.raw_ref] });
    }
    return [...byEntry.values()];
  }, [entries.data]);

  function pick(name) {
    setBook(name === book ? null : name);
    setChapter("");
  }

  return (
    <div className="stack">
      <section className="card spirit-card">
        <div className="card-head">
          <h2 className="card-title">
            <BookOpen size={14} />
            Books you've written about
          </h2>
        </div>
        <p className="card-note spirit-card__note">Every prayer, prompting and Board note that mentions a verse, gathered by book.</p>

        {books.loading ? (
          <p className="spirit-empty">Loading…</p>
        ) : books.error && !books.data ? (
          <LoadError what="your verse references" error={books.error} onRetry={books.reload} />
        ) : list.length === 0 ? (
          <p className="spirit-empty">
            No verse references yet. Mention one in a prayer, a prompting or a Board note, like Alma 32:21, and it shows up here.
          </p>
        ) : (
          <>
            <div className="spirit-chips">
              {shown.map((b) => (
                <button
                  key={b.book}
                  type="button"
                  className={"chip spirit-chip" + (book === b.book ? " is-on" : "")}
                  aria-pressed={book === b.book}
                  onClick={() => pick(b.book)}
                >
                  {b.book}
                  <span className="spirit-chip__n">{b.count}</span>
                </button>
              ))}
            </div>
            {list.length > FEW_BOOKS && (
              <button type="button" className="btn-link spirit-books__all" onClick={() => setAllBooks((v) => !v)}>
                {allBooks ? "Fewer books" : `All ${list.length} books`}
              </button>
            )}
          </>
        )}
      </section>

      {book && (
        <section className="card spirit-card">
          <div className="card-head spirit-scripture__head">
            <h2 className="card-title">{book}</h2>
            <div className="spirit-scripture__tools">
              {current?.chapters?.length > 1 && (
                <select className="input spirit-scripture__chapter" value={chapter} onChange={(e) => setChapter(e.target.value)} aria-label={unit}>
                  <option value="">{unit === "Section" ? "All sections" : "All chapters"}</option>
                  {current.chapters.map((c) => (
                    <option key={c} value={c}>
                      {unit} {c}
                    </option>
                  ))}
                </select>
              )}
              <button type="button" className="btn-icon" onClick={() => pick(book)} aria-label={`Close ${book}`} title={`Close ${book}`}>
                <X size={16} />
              </button>
            </div>
          </div>

          {entries.loading ? (
            <p className="spirit-empty">Loading…</p>
          ) : entries.error && !entries.data ? (
            <LoadError what={`what mentions ${book}`} error={entries.error} onRetry={entries.reload} />
          ) : grouped.length === 0 ? (
            <p className="spirit-empty">Nothing found.</p>
          ) : (
            <ul className="spirit-list">
              {grouped.map((e) => (
                <li key={e.key} className="spirit-row">
                  <div className="spirit-row__top">
                    <span className="spirit-row__kind">{entryTitle(e)}</span>
                    <span className="spirit-row__date">{dayLabel(e.occurred_at)}</span>
                  </div>
                  <p className="spirit-row__refs">{e.refs.join(" · ")}</p>
                  <p className="spirit-row__text">{previewText(e.body, 240)}</p>
                  {e.source === "study_note" && (
                    <div className="spirit-row__actions">
                      <button type="button" className="btn-link" onClick={() => navigate(`/study?note=${e.id}`)}>
                        <BookOpen size={13} />
                        Open on the Board
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
