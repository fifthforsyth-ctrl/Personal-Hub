import { useEffect, useRef, useState } from "react";
import { Sparkles, Check, ArrowRight, Link2, Pencil } from "lucide-react";
import { suggestGoalLinks, applyGoalLinks, fetchLinkStats, fetchGoalPaths } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useLoad } from "../lib/useLoad";
import { friendlyError } from "../lib/errors";
import { useToast } from "./ui/Feedback";
import LoadError from "./ui/LoadError";
import GoalPicker from "./GoalPicker";
import { fmtMinutes } from "../lib/categories";
import { addDays, parseDateStr, todayStr } from "../lib/planDates";
import { fmtShortDate } from "../lib/dates";
import "../styles/goals.css";

// A page small enough that one request finishes well inside the Edge
// Function's 150-second wall clock. Measured: 25 entries take 23-34s, so 30
// leaves plenty of room.
const BATCH = 30;

// No page budget — "catch up" means catch up, and stopping at an arbitrary
// count just means pressing the button twelve times. This is only a runaway
// guard in case remaining_after ever stops shrinking.
const HARD_CAP_PAGES = 40;

// Past this many rows the list renders in chunks. All of them are still
// selected and still get written; it is the DOM that gives up, not the data.
const RENDER_CHUNK = 60;

const plural = (n, one, many) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

// How the card names its day. The Day page shows any date, and "Link
// today's 8 entries" under last Tuesday's heading read as if it would touch
// today. Within the past week it's the weekday; further back, the date.
function dayWords(date) {
  const today = todayStr();
  const near = { [today]: "today", [addDays(today, -1)]: "yesterday", [addDays(today, 1)]: "tomorrow" }[date];
  if (near) return { name: near, on: near, own: `${near}'s` };
  const recent = date < today && date >= addDays(today, -6);
  const name = recent ? parseDateStr(date).toLocaleDateString(undefined, { weekday: "long" }) : fmtShortDate(date);
  return { name, on: `on ${name}`, own: recent ? `${name}'s` : null };
}

// "Link yesterday's 8 entries", "Link the 8 entries from Oct 2".
function linkLabel(day, n) {
  const what = n == null ? "entries" : n === 1 ? "entry" : `${n.toLocaleString()} entries`;
  return day.own ? `Link ${day.own} ${what}` : `Link the ${what} from ${day.name}`;
}

// The goal first, then (fainter, and cut first when space runs out) where
// it sits on the wheel.
function GoalName({ path }) {
  const parts = path.split(" › ");
  const trail = parts.slice(0, -1).join(" › ");
  return (
    <span className="suggest-row__target">
      <span className="truncate suggest-row__leaf">{parts[parts.length - 1]}</span>
      {trail && <span className="truncate suggest-row__trail">{trail}</span>}
    </span>
  );
}

// "Be as fluid as I can throughout the day, then have AI put the brass tacks
// on everything."
//
// Category links are coarse by nature — every Serve entry lands in the same
// place. The descriptions are where the meaning is: "Serve zone making app"
// and "Help sister Shumway" are both Serve and feed different branches. This
// reads what was actually written and proposes a link per entry.
//
// Nothing is written until accepted, and low-confidence rows are left
// unticked by default — a wrong link is worse than none, because it makes
// "what today fed" quietly lie.
//
// Every proposal is editable. The model is reading a four-word description
// and guessing; when it guesses wrong the fix has to be one tap away, or you
// end up accepting links you don't believe to avoid the friction.
export default function GoalLinkSuggestions({ date, onApplied }) {
  const { user } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(null); // entry_id whose goal is being changed
  const [result, setResult] = useState(null);
  const [chosen, setChosen] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);
  const [shown, setShown] = useState(RENDER_CHUNK);
  const stopRef = useRef(false);
  // Bumped by every run and every change of day. A run that finds another
  // number has been overtaken — the Day page moved on while it was reading
  // — and drops what it read rather than show one day's suggestions under
  // another day's heading.
  const runRef = useRef(0);
  // The run a read or a link is in flight for, so a second tap is ignored.
  const busyRef = useRef(null);

  // The backlog window is generous on purpose, and the button says how many
  // entries it is about to read before anything is spent on them.
  const backlogStart = addDays(date, -30);
  const day = dayWords(date);

  const stats = useLoad(
    () => Promise.all([fetchLinkStats(date, date), fetchLinkStats(backlogStart, addDays(date, -1))]),
    [date]
  );
  const [dayStats, backlog] = stats.data ?? [];

  // Loaded once and held: the picker has to open instantly, and the goals
  // don't change while you're reviewing a day.
  const goals = useLoad(() => (user?.id ? fetchGoalPaths(user.id) : []), [user?.id]);

  useEffect(() => {
    setResult(null);
    setEditing(null);
    setError(null);
    setLoading(false);
    setStopping(false);
    setApplying(false);
    setProgress(null);
    const runs = runRef;
    return () => {
      runs.current++;
    };
  }, [date]);

  // Walked a page at a time. A single 120-entry request needs more than the
  // 150 seconds Supabase gives an Edge Function and dies as a 504 having
  // decided nothing, so the loop lives here where it can show progress and
  // keep whatever it has already gathered if a later page fails.
  async function run({ start, end, onlyUnlinked = false }) {
    if (busyRef.current === runRef.current) return;
    const mine = ++runRef.current;
    const current = () => runRef.current === mine;
    busyRef.current = mine;
    setLoading(true);
    setStopping(false);
    setError(null);
    setShown(RENDER_CHUNK);
    stopRef.current = false;
    setProgress({ done: 0, total: null });

    const gathered = [];
    let offset = 0;
    let matching = null;
    let remaining = 0;
    let failure = null;

    try {
      for (let page = 0; page < HARD_CAP_PAGES; page++) {
        const data = await suggestGoalLinks({ start, end, onlyUnlinked, limit: BATCH, offset });
        if (!current()) return;
        gathered.push(...(data.links ?? []));
        matching = data.matching ?? matching;
        // An older server that doesn't report this would read as 0 and stop
        // the walk after one page, which is exactly the bug that made "catch
        // up" mean "catch up thirty". Unknown means keep going.
        remaining = data.remaining_after ?? null;
        offset += BATCH;
        setProgress({ done: gathered.length, total: matching });
        if (remaining === 0 || (data.links ?? []).length === 0) break;
        if (stopRef.current) break;
      }
    } catch (err) {
      if (!current()) return;
      failure = err;
    }

    busyRef.current = null;
    setLoading(false);
    setProgress(null);
    // A page failing shouldn't throw away the pages that worked.
    if (failure && gathered.length === 0) {
      setError(friendlyError(failure, "Couldn't read the entries. Try again."));
      return;
    }
    setResult({
      links: gathered,
      remaining: remaining ?? 0,
      stopped: stopRef.current && !failure,
      partial: failure ? friendlyError(failure, "The rest didn't come back.") : null,
    });
    // Pre-tick what the model is confident about; leave the rest to you.
    setChosen(new Set(gathered.filter((l) => l.confidence !== "low").map((l) => l.entry_id)));
  }

  function stop() {
    stopRef.current = true;
    setStopping(true);
  }

  function toggle(id) {
    setChosen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Overriding a suggestion also includes the row — you went to the trouble
  // of picking, so the intent is obviously to link it. `edited` marks the row
  // so the confidence label can step aside for "yours".
  function setGoal(entryId, goalId, goalPath) {
    setResult((r) => ({
      ...r,
      links: r.links.map((l) => (l.entry_id === entryId ? { ...l, goal_id: goalId, goal_path: goalPath, edited: true } : l)),
    }));
    setChosen((prev) => new Set(prev).add(entryId));
    setEditing(null);
  }

  // A long read is minutes of work, so throwing it away can be taken back.
  function discard() {
    const mine = runRef.current;
    const kept = { result, chosen, shown };
    setResult(null);
    setEditing(null);
    toast.show("Suggestions discarded", {
      actionLabel: "Undo",
      onAction: () => {
        if (runRef.current !== mine) return;
        setResult(kept.result);
        setChosen(kept.chosen);
        setShown(kept.shown);
      },
    });
  }

  async function apply() {
    const links = result.links.filter((l) => chosen.has(l.entry_id));
    if (links.length === 0 || busyRef.current === runRef.current) return;
    const mine = runRef.current;
    busyRef.current = mine;
    setApplying(true);
    try {
      await applyGoalLinks(links);
    } catch (err) {
      toast.error(err, "Couldn't link those entries. Try again.");
      if (runRef.current === mine) {
        busyRef.current = null;
        setApplying(false);
      }
      return;
    }
    toast.show(`Linked ${plural(links.length, "entry", "entries")}`);
    if (runRef.current === mine) {
      busyRef.current = null;
      setApplying(false);
      setResult(null);
      stats.reload();
    }
    await onApplied?.();
  }

  const nothingLogged = dayStats?.total === 0;
  const changed = result ? result.links.filter((l) => l.changed).length : 0;

  return (
    <div className="card goal-suggest">
      <div className="card-head">
        <span className="card-title">
          <Link2 size={14} />
          Goal links
        </span>
      </div>

      {!result && !loading && (
        <>
          <p className="card-note goal-suggest__intro">
            Reads every description from this day and works out which goal each stretch of time fed. Nothing changes until you
            link it.
            {dayStats?.total > 0 && (
              <span className="faint">
                {" "}
                {plural(dayStats.total, "entry", "entries")}
                {dayStats.unread > 0 ? `, ${dayStats.unread} not read yet` : ", all read already"}
                {dayStats.serves_none > 0 && `, ${dayStats.serves_none} ${dayStats.serves_none === 1 ? "doesn't" : "don't"} feed a goal`}.
              </span>
            )}
          </p>

          {stats.error && <LoadError what="this day's counts" error={stats.error} onRetry={stats.reload} stale={Boolean(stats.data)} className="goal-suggest__error" />}
          {error && (
            <div className="form-error goal-suggest__error" role="alert">
              {error}
            </div>
          )}

          <button type="button" onClick={() => run({ start: date, end: date })} disabled={nothingLogged} className="btn btn--accent btn--block goal-suggest__go">
            <Sparkles size={15} />
            {nothingLogged ? `Nothing logged ${day.on}` : linkLabel(day, dayStats?.total)}
          </button>

          {backlog?.unread > 0 && (
            <button
              type="button"
              onClick={() => run({ start: backlogStart, end: addDays(date, -1), onlyUnlinked: true })}
              className="btn btn--block goal-suggest__catch-up"
            >
              Catch up {plural(backlog.unread, "unread entry", "unread entries")} from earlier days
            </button>
          )}

          {/* An entry the model read and found feeds no goal has no link,
              which looks exactly like an entry nobody has touched. Saying so
              is the difference between "caught up" and "still 106 to go". */}
          {backlog?.unread === 0 && backlog?.total > 0 && (
            <p className="goal-suggest__caught-up">
              Earlier days are caught up: {backlog.linked} linked
              {backlog.serves_none > 0 && `, ${backlog.serves_none} ${backlog.serves_none === 1 ? "doesn't" : "don't"} feed a goal`}.
            </p>
          )}
        </>
      )}

      {loading && (
        <div className="goal-suggest__reading" aria-live="polite">
          <p className="empty">{progress?.done > 0 ? `Read ${progress.done}${progress.total ? ` of ${progress.total}` : ""}…` : "Reading…"}</p>
          {progress?.total > 0 && (
            <div className="goal-suggest__bar">
              <div style={{ width: `${Math.min(100, (progress.done / progress.total) * 100)}%` }} />
            </div>
          )}
          <p className="goal-suggest__hint">A few minutes for a long backlog. Leave this open.</p>
          <button type="button" className="btn-link goal-suggest__stop" onClick={stop} disabled={stopping}>
            {stopping ? "Stopping after this batch…" : "Stop and review what's read"}
          </button>
        </div>
      )}

      {result && result.links.length === 0 && (
        <div className="goal-suggest__empty">
          <p className="empty">Nothing to link.</p>
          <button type="button" className="btn btn--sm" onClick={() => setResult(null)}>
            Done
          </button>
        </div>
      )}

      {result && result.links.length > 0 && (
        <>
          {result.partial && (
            <div className="form-error goal-suggest__error" role="alert">
              Stopped early. {result.partial} The {result.links.length} already read are below and still worth linking.
            </div>
          )}
          {goals.error && <LoadError what="your goals" error={goals.error} onRetry={goals.reload} stale={Boolean(goals.data)} className="goal-suggest__error" />}

          <p className="goal-suggest__how">
            {changed} of {result.links.length} would change. Tap a row to include it or leave it out, or tap the goal under it to
            pick another. Low-confidence guesses start unticked, and “No goal” is a real answer — driving and meals usually feed
            none.
            {result.stopped && " Stopped early, as you asked."}
            {result.remaining > 0 && ` ${result.remaining} more are waiting — link these, then catch up again.`}
          </p>

          {/* A backlog of three hundred is not read row by row. These are how
              you actually work through one: take the confident ones wholesale,
              then scan for the handful that look wrong. */}
          <div className="goal-suggest__bulk">
            <button type="button" className="btn-link" onClick={() => setChosen(new Set(result.links.map((l) => l.entry_id)))}>
              Select all
            </button>
            <button type="button" className="btn-link" onClick={() => setChosen(new Set())}>
              Select none
            </button>
            <button
              type="button"
              className="btn-link"
              onClick={() => setChosen(new Set(result.links.filter((l) => l.confidence === "high").map((l) => l.entry_id)))}
            >
              Only high confidence
            </button>
            <span className="goal-suggest__count">{chosen.size} selected</span>
          </div>

          {result.links.slice(0, shown).map((link) => {
            const on = chosen.has(link.entry_id);
            const what = link.what ?? "Entry";
            return (
              <div key={link.entry_id} className={`suggest-row ${on ? "is-on" : ""}`}>
                <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(link.entry_id)} className="suggest-row__toggle">
                  <span className="suggest-row__box" aria-hidden="true">
                    {on && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="truncate suggest-row__what">{what}</span>
                  {link.minutes > 0 && <span className="suggest-row__mins">{fmtMinutes(link.minutes)}</span>}
                  <span className={`suggest-row__sure suggest-row__sure--${link.edited ? "yours" : link.confidence}`}>
                    {link.edited ? "yours" : link.confidence}
                  </span>
                </button>

                {/* The proposed goal is its own control, not a label. */}
                <button
                  type="button"
                  onClick={() => setEditing(link.entry_id)}
                  className="suggest-row__goal"
                  title="Change which goal this fed"
                  aria-label={`Change which goal “${what}” fed: now ${link.goal_path ?? "no goal"}`}
                >
                  <ArrowRight size={11} aria-hidden="true" />
                  {link.goal_path ? <GoalName path={link.goal_path} /> : <span className="suggest-row__target suggest-row__none">No goal</span>}
                  <Pencil size={11} aria-hidden="true" />
                </button>

                {link.changed && link.current_goal && (
                  <div className="suggest-row__note">
                    was {link.current_goal}
                    {link.current_source === "mapping" ? " (set by its category)" : ""}
                  </div>
                )}

                {link.why && !link.edited && <div className="suggest-row__note">{link.why}</div>}
              </div>
            );
          })}

          {result.links.length > shown && (
            <button type="button" className="btn btn--block goal-suggest__more" onClick={() => setShown((n) => n + RENDER_CHUNK)}>
              Show {Math.min(RENDER_CHUNK, result.links.length - shown)} more of {result.links.length - shown}
            </button>
          )}

          {editing && (
            <GoalPicker
              goals={goals.data ?? []}
              value={result.links.find((l) => l.entry_id === editing)?.goal_id ?? null}
              onPick={(goalId, goalPath) => setGoal(editing, goalId, goalPath)}
              onClose={() => setEditing(null)}
            />
          )}

          <div className="goal-suggest__actions">
            <button type="button" onClick={discard} disabled={applying} className="btn">
              Discard
            </button>
            <button type="button" onClick={apply} disabled={applying || chosen.size === 0} className="btn btn--accent goal-suggest__link">
              {applying ? "Linking…" : `Link ${plural(chosen.size, "entry", "entries")}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
