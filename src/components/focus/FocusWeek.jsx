import { useMemo, useState } from "react";
import { Target, Plus, GitBranch, X, Check, Pencil } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { addFocusGoal, updateFocusGoal, deleteFocusGoal, reviewFocusGoal, fetchFocusWeek, fetchGoalPaths } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { todayStr, parseDateStr } from "../../lib/planDates";
import { previousWeek, awaitingReview, showsReview, movedLabel, nextPosition, cleanTitle, summarizeWeek, focusWeekOf } from "../../lib/focus";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import GoalPicker from "../GoalPicker";
import { announceChange } from "../today/announce";
import { useFocusWeek } from "./useFocusWeek";
import "../../styles/focus.css";

// What the week is for, at the top of the Week tab.
//
// On Sunday it opens with last week: each goal you set, how many days moved
// it, and Keep, Adjust or Let go. Keeping one carries it into this week as
// a new goal, so last week still shows exactly what it was aiming at. Then
// add whatever else this week needs, typed fresh or taken from the goal
// wheel. There's no limit and no required shape.

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export default function FocusWeek({ anchorDate }) {
  const { user } = useAuth();
  const userId = user?.id;
  const toast = useToast();
  const today = todayStr();
  const weekStart = focusWeekOf(anchorDate);
  const reviewOn = showsReview(weekStart, today);
  const lastStart = previousWeek(weekStart);

  const { data, week, error, loading, reload, mutate } = useFocusWeek(userId, weekStart);
  const last = useLoad(() => (userId && reviewOn ? fetchFocusWeek(userId, lastStart) : null), [userId, lastStart, reviewOn]);
  const paths = useLoad(() => (userId ? fetchGoalPaths(userId) : null), [userId]);
  const pathById = useMemo(() => new Map((paths.data ?? []).map((p) => [p.id, p.path])), [paths.data]);

  const [draft, setDraft] = useState("");
  const [picking, setPicking] = useState(false);
  const [linking, setLinking] = useState(null); // goal id being linked to the wheel
  const [editing, setEditing] = useState(null); // { id, title }
  const [busy, setBusy] = useState(false);

  const waiting = last.data ? awaitingReview(last.data.goals) : [];
  const lastWeek = last.data ? summarizeWeek(last.data.goals, last.data.checkins, lastStart) : [];
  const isSunday = parseDateStr(today).getDay() === 0 && weekStart === focusWeekOf(today);

  async function add(title, nodeId = null, carriedFrom = null) {
    const clean = cleanTitle(title);
    if (!clean || busy) return null;
    setBusy(true);
    try {
      const row = await addFocusGoal(userId, { weekStart, title: clean, nodeId, carriedFrom, position: nextPosition(data?.goals) });
      mutate((d) => (d ? { ...d, goals: [...d.goals, row] } : d));
      announceChange();
      return row;
    } catch (err) {
      toast.error(err, "Couldn't add that goal.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function submitDraft(e) {
    e.preventDefault();
    if (await add(draft)) setDraft("");
  }

  async function saveTitle() {
    const clean = cleanTitle(editing?.title);
    const id = editing?.id;
    if (!id) return;
    if (!clean) {
      setEditing(null);
      return;
    }
    mutate((d) => (d ? { ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, title: clean } : g)) } : d));
    setEditing(null);
    try {
      await updateFocusGoal(id, { title: clean });
      announceChange();
    } catch (err) {
      reload();
      toast.error(err, "Couldn't rename that goal.");
    }
  }

  async function setLink(id, nodeId) {
    mutate((d) => (d ? { ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, node_id: nodeId } : g)) } : d));
    try {
      await updateFocusGoal(id, { node_id: nodeId });
    } catch (err) {
      reload();
      toast.error(err, "Couldn't change the link.");
    }
  }

  function remove(goal) {
    mutate((d) => (d ? { ...d, goals: d.goals.filter((g) => g.id !== goal.id) } : d));
    toast.undoable({
      message: `Removed “${goal.title}”`,
      run: async () => {
        await deleteFocusGoal(goal.id);
        announceChange();
      },
      onUndo: () => mutate((d) => (d ? { ...d, goals: [...d.goals, goal] } : d)),
    });
  }

  // Sunday's three answers. Keep and Adjust write this week's goal first, so
  // a failure leaves last week's goal still waiting rather than lost.
  async function carry(goal, title, review) {
    const row = await add(title, goal.node_id, goal.id);
    if (!row) return;
    last.mutate((d) => (d ? { ...d, goals: d.goals.map((g) => (g.id === goal.id ? { ...g, review } : g)) } : d));
    try {
      await reviewFocusGoal(goal.id, review);
    } catch (err) {
      last.reload();
      toast.error(err, "Couldn't mark last week's goal as looked at.");
    }
  }

  function letGo(goal) {
    last.mutate((d) => (d ? { ...d, goals: d.goals.map((g) => (g.id === goal.id ? { ...g, review: "let_go" } : g)) } : d));
    toast.undoable({
      message: `Let go of “${goal.title}”`,
      run: () => reviewFocusGoal(goal.id, "let_go"),
      onUndo: () => last.mutate((d) => (d ? { ...d, goals: d.goals.map((g) => (g.id === goal.id ? { ...g, review: null } : g)) } : d)),
    });
  }

  async function keepAll() {
    for (const g of waiting) await carry(g, g.title, "kept");
  }

  return (
    <div className="card focus-week">
      <div className="card-head" style={{ marginBottom: 6 }}>
        <span className="card-title"><Target size={14} />Focus</span>
      </div>
      <p className="card-note" style={{ marginBottom: 14 }}>What this week is for. As many as you need, typed fresh or taken from the goal wheel.</p>

      {error && <LoadError what="this week's focus" error={error} onRetry={reload} stale={Boolean(data)} />}
      {last.error && reviewOn && <LoadError what="last week's focus" error={last.error} onRetry={last.reload} />}

      {waiting.length > 0 && (
        <section className="focus-review" aria-label="Last week's focus">
          <div className="row row--between" style={{ marginBottom: 8 }}>
            <span className="eyebrow">{isSunday ? "Sunday review · last week" : "Last week's focus"}</span>
            {waiting.length > 1 && (
              <button type="button" className="btn-link focus-review__all" onClick={keepAll} disabled={busy}>
                Keep all
              </button>
            )}
          </div>
          {lastWeek
            .filter((g) => !g.review)
            .map((g) => (
              <ReviewRow key={g.id} goal={g} busy={busy} onKeep={() => carry(g, g.title, "kept")} onAdjust={(t) => carry(g, t, "adjusted")} onLetGo={() => letGo(g)} />
            ))}
        </section>
      )}

      {week && week.length === 0 && waiting.length === 0 && !loading && (
        <p className="focus-week__empty">Nothing set for this week yet.</p>
      )}

      {week && week.length > 0 && (
        <ul className="focus-week__list">
          {week.map((g) => (
            <li key={g.id} className="focus-week__goal">
              {editing?.id === g.id ? (
                <form
                  className="focus-week__edit"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveTitle();
                  }}
                >
                  <input
                    className="input"
                    autoFocus
                    value={editing.title}
                    maxLength={200}
                    aria-label="Goal"
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                  />
                  <button type="submit" className="btn btn--accent btn--sm">Save</button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(null)}>Cancel</button>
                </form>
              ) : (
                <div className="focus-week__head">
                  <button type="button" className="focus-week__title" onClick={() => setEditing({ id: g.id, title: g.title })} title="Rename">
                    {g.title}
                    <Pencil size={11} className="focus-week__pencil" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn-icon focus-week__remove" aria-label={`Remove “${g.title}”`} title="Remove" onClick={() => remove(g)}>
                    <X size={15} />
                  </button>
                </div>
              )}

              <div className="focus-week__meta">
                <span className="focus-dots" role="img" aria-label={movedLabel(g)}>
                  {g.days.map((d, i) => (
                    <span
                      key={d.date}
                      className={"focus-dots__day" + (d.moved === true ? " is-yes" : d.moved === false ? " is-no" : "") + (d.date === today ? " is-today" : "")}
                      title={`${parseDateStr(d.date).toLocaleDateString(undefined, { weekday: "long" })}: ${d.moved === true ? "moved it" : d.moved === false ? "not that day" : "no answer"}`}
                    >
                      {DOW[i]}
                    </span>
                  ))}
                </span>
                <span className="focus-week__count">{movedLabel(g)}</span>
              </div>

              <div className="focus-week__link">
                {g.node_id ? (
                  <>
                    <GitBranch size={12} aria-hidden="true" />
                    <span className="truncate">{pathById.get(g.node_id) ?? "A goal on the wheel"}</span>
                    <button type="button" className="btn-link" onClick={() => setLink(g.id, null)}>Unlink</button>
                  </>
                ) : (
                  <button type="button" className="btn-link" onClick={() => setLinking(g.id)} disabled={!paths.data}>
                    <GitBranch size={12} />
                    Link to a goal on the wheel
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="focus-week__add" onSubmit={submitDraft}>
        <input
          className="input"
          value={draft}
          maxLength={200}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a focus, e.g. patience with the kids"
          aria-label="Add a focus for this week"
          enterKeyHint="done"
        />
        <button type="submit" className="btn btn--accent" disabled={!cleanTitle(draft) || busy}>
          <Plus size={15} />
          Add
        </button>
      </form>
      <button type="button" className="btn-link focus-week__from-wheel" onClick={() => setPicking(true)} disabled={!paths.data}>
        <GitBranch size={13} />
        Add one from the goal wheel
      </button>

      {(picking || linking) && paths.data && (
        <GoalPicker
          goals={paths.data}
          allowNone={false}
          placeholder="Find a goal…"
          value={linking ? data?.goals.find((g) => g.id === linking)?.node_id : undefined}
          onPick={(id, path) => {
            if (linking) {
              setLink(linking, id);
            } else {
              const title = path ? path.split(" › ").pop() : "";
              add(title, id);
            }
            setPicking(false);
            setLinking(null);
          }}
          onClose={() => {
            setPicking(false);
            setLinking(null);
          }}
        />
      )}
    </div>
  );
}

function ReviewRow({ goal, busy, onKeep, onAdjust, onLetGo }) {
  const [adjusting, setAdjusting] = useState(false);
  const [title, setTitle] = useState(goal.title);

  return (
    <div className="focus-review__row">
      {adjusting ? (
        <form
          className="focus-week__edit"
          onSubmit={(e) => {
            e.preventDefault();
            if (cleanTitle(title)) onAdjust(title);
          }}
        >
          <input
            className="input"
            autoFocus
            value={title}
            maxLength={200}
            aria-label={`This week's version of “${goal.title}”`}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setAdjusting(false)}
          />
          <button type="submit" className="btn btn--accent btn--sm" disabled={!cleanTitle(title) || busy}>Keep this</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAdjusting(false)}>Cancel</button>
        </form>
      ) : (
        <>
          <div className="focus-review__what">
            <span className="focus-review__title">{goal.title}</span>
            <span className="focus-review__how">{movedLabel(goal)}</span>
          </div>
          <div className="focus-review__actions">
            <button type="button" className="btn btn--accent btn--sm" onClick={onKeep} disabled={busy}>
              <Check size={13} />
              Keep
            </button>
            <button type="button" className="btn btn--sm" onClick={() => setAdjusting(true)} disabled={busy}>
              <Pencil size={12} />
              Adjust
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onLetGo} disabled={busy}>
              Let go
            </button>
          </div>
        </>
      )}
    </div>
  );
}
