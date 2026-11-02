import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { fetchFocusGoalRows, fetchGoalEdges } from "../lib/api";
import { KIND_NAME, MISSION_KEY, crumbsFor, pathOf, resolveRef } from "../lib/ladder";
import { countsToward, focusWeekOf, lineageIds, towardTitle } from "../lib/focus";
import { buildRange, shortTarget } from "../lib/mark";
import { useLoad } from "../lib/useLoad";
import LoadError from "../components/ui/LoadError";
import { useLadder } from "../components/targets/useLadder";
import { useScrollTop } from "../components/targets/useScrollTop";
import QuestsRow from "../components/targets/QuestsRow";
import QuestBody from "../components/targets/QuestBody";
import TargetHead from "../components/targets/TargetHead";
import TargetHistory from "../components/targets/TargetHistory";
import TargetFocus, { weekOfLabel } from "../components/targets/TargetFocus";
import TargetMission from "../components/targets/TargetMission";
import NotesSection from "../components/targets/NotesSection";
import LinkedQuotes from "../components/targets/LinkedQuotes";
import FocusSettings from "../components/focus/FocusSettings";
import "../styles/ascent.css";
import "../styles/mark.css";
import "../styles/camp.css";
import "../styles/quests.css";
import "../styles/focus.css";
import "../styles/targets.css";

// One page for every target on the ladder, /targets/<key> (and
// /targets/mission): the mission, a lifetime goal, a quest, a lesson, or a
// week's focus. At the top, the way up the ladder, the target itself and
// why, and Reflect, Note, Quote and its pencil. Then what's its own: a
// quest's or lesson's camps, today's list, clipboard and the rest (what
// was the Quests page, QuestBody.jsx); a goal's target and what feeds it;
// a focus's week and today's arrow; the mission's bow and what climbs
// toward it. Then the quotes linked to it and everything written on it.
//
// Any link to a target lands here, by whichever id it has (a lesson's
// mountain, an older week of a focus, a goal further down the wheel); the
// address then moves to the target's own, keeping the rest of it. A link to
// something that's gone says so, with the way back.

// The parts of a page an address can go straight to.
const PLACES = ["#camps", "#history", "#notes", "#quotes"];

function freshUi(key, hash) {
  return { key, note: null, picking: false, settings: false, history: hash === "#history" };
}

export default function Target() {
  const params = useParams();
  const ref = params.ref ?? MISSION_KEY;
  const location = useLocation();
  const navigate = useNavigate();

  // After an edit in a sheet, a quest's own lists are read again too (a
  // camp renamed or taken off in its sheet).
  const questReload = useRef(null);
  const ladder = useLadder({ onSaved: () => questReload.current?.() });
  const { userId, today, data, view } = ladder;
  // Every week's focus rows and the wheel's links: small, and only needed
  // to place a link that isn't a goal, quest or lesson's own id.
  const rows = useLoad(() => (userId ? Promise.all([fetchFocusGoalRows(userId), fetchGoalEdges()]) : null), [userId]);
  const focusGoals = rows.data?.[0] ?? null;
  const edges = rows.data?.[1] ?? null;

  // undefined while it can't be told yet, null when it's nothing of his.
  const resolved = useMemo(() => {
    if (ref === MISSION_KEY) return resolveRef(ref, {});
    if (!data) return undefined;
    const hit = resolveRef(ref, { goals: data.goals, edges: edges ?? [], quests: data.quests, lessons: data.lessons, focusGoals: focusGoals ?? [] });
    if (hit) return hit;
    return rows.data ? null : undefined;
  }, [ref, data, edges, focusGoals, rows.data]);
  const key = resolved?.key ?? null;

  // The target's own address, keeping the part of the page and anything
  // the link carried.
  useEffect(() => {
    if (key && key !== ref) navigate(`/targets/${key}${location.search}${location.hash}`, { replace: true, state: location.state });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ref]);

  useScrollTop(key);
  useScrollToPlace(key && key === ref ? key : null, location.hash);

  // What's open on this target's page; a new target starts afresh.
  const [ui, setUi] = useState(() => freshUi(key, location.hash));
  if (ui.key !== key) setUi(freshUi(key, location.hash));
  const set = (patch) => setUi((u) => ({ ...u, ...patch }));

  // The Ascent view in the shape the focus's settings and arrow read.
  const ascent = useMemo(
    () => ({ data, view, focuses: ladder.focuses, focusesById: ladder.focusesById, error: ladder.error, loading: ladder.loading, reload: ladder.reload }),
    [data, view, ladder.focuses, ladder.focusesById, ladder.error, ladder.loading, ladder.reload]
  );

  const info = resolved && data && view ? describe(resolved, { data, view, ladder, focusGoals, edges, today }) : null;

  const quest = resolved?.kind === "quest" || resolved?.kind === "lesson";
  const root = "page ascent mark qs tg-page" + (quest ? " tg-page--climb" : "");

  // --- Before there's a page to show -------------------------------------------

  if (!data && ladder.error) {
    return (
      <div className={root}>
        <BackUp />
        <LoadError what="your targets" error={ladder.error} onRetry={ladder.reload} />
      </div>
    );
  }
  if (resolved === undefined) {
    return (
      <div className={root}>
        <BackUp />
        {rows.error && data ? <LoadError what="this target" error={rows.error} onRetry={rows.reload} /> : <p className="empty">Loading…</p>}
      </div>
    );
  }
  // Nothing of his by that address, or gone from the lists under it.
  if (resolved === null || (key === ref && data && view && !info)) {
    return (
      <div className={root}>
        <section className="card tg-gone tg-gone--page">
          <p>That isn't one of your targets any more.</p>
          <Link to="/targets" className="btn btn--accent">
            Back to Targets
          </Link>
        </section>
      </div>
    );
  }
  if (key !== ref || !info) {
    return (
      <div className={root}>
        <BackUp />
        <p className="empty">Loading…</p>
      </div>
    );
  }

  // --- The page ---------------------------------------------------------------------

  const { kind, id } = resolved;
  const t = info.mark;

  function openHistory() {
    set({ history: true });
    requestAnimationFrame(() => document.getElementById("history")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function edit() {
    if (kind === "mission") ladder.open({ kind: "mission" });
    else if (kind === "goal") ladder.open({ kind: "goal", goal: info.goal });
    else if (kind === "quest") ladder.open({ kind: "quest", quest: info.quest, onGone: () => navigate("/targets") });
    else if (kind === "lesson") ladder.open({ kind: "lesson", lesson: info.lesson, onGone: () => navigate("/targets") });
    else if (kind === "focus") set({ settings: true });
  }

  const actions = {
    onReflect: () => set({ note: "reflect" }),
    onNote: () => set({ note: "note" }),
    onQuote: () => set({ picking: true }),
    // An earlier week's focus is history: nothing on it to set (and this
    // week's has its settings once its week is in).
    onEdit: kind === "focus" && !info.weekGoal ? null : edit,
    editLabel: info.editLabel,
  };

  const head = (build = null) => (
    <>
      <TargetHead
        crumbs={info.crumbs}
        eyebrow={info.eyebrow}
        title={info.title}
        why={info.why}
        mission={kind === "mission" ? info.mission ?? { summit: "", statement: "" } : null}
        mark={t}
        today={today}
        chip={info.chip}
        build={build}
        actions={actions}
        onHistory={t ? openHistory : null}
      />
      {/* The next quest a tap away (Aaron, 2026-11-02). */}
      {quest && <QuestsRow userId={userId} date={today} current={key} />}
    </>
  );

  const quotes = (
    <LinkedQuotes
      key={`q:${key}`}
      userId={userId}
      today={today}
      target={resolved}
      name={info.name}
      title={info.title}
      why={info.whyText}
      lineage={info.lineage}
      picking={ui.picking}
      onPicking={(on) => set({ picking: on })}
    />
  );
  const notes = (
    <NotesSection
      key={`n:${key}`}
      userId={userId}
      today={today}
      target={resolved}
      name={info.name}
      focusGoal={info.focusRow}
      lineage={info.lineage}
      shots={t?.shots ?? null}
      limit={quest ? 5 : 10}
      sheet={ui.note}
      onSheet={(mode) => set({ note: mode })}
    />
  );

  return (
    <div className={root}>
      {quest ? (
        <QuestBody
          kind={kind}
          id={id}
          ladder={ladder}
          head={head}
          quotes={quotes}
          notes={notes}
          history={t ? <TargetHistory key={`h:${key}`} target={t} today={today} ladder={ladder} open={ui.history} onOpen={(open) => set({ history: open })} /> : null}
          reloadRef={questReload}
        />
      ) : (
        <>
          {head()}
          <div className="tg-body">
            {kind === "goal" && t && <TargetHistory key={`h:${key}`} target={t} today={today} ladder={ladder} folded={false} />}
            {kind === "focus" && (
              <TargetFocus key={`f:${key}`} userId={userId} today={today} row={info.focusRow} ladder={ladder} ascent={ascent} onSettings={() => set({ settings: true })} />
            )}
            {kind === "mission" && <TargetMission ladder={ladder} today={today} onWrite={edit} />}
            {quotes}
            {notes}
          </div>
        </>
      )}

      {ui.settings && info.weekGoal && (
        <FocusSettings userId={userId} goal={info.weekGoal} date={today} fw={ladder.focusWeek} ascent={ascent} onClose={() => set({ settings: false })} />
      )}
      {ladder.overlay}
    </div>
  );
}

// A way back up while the page loads or can't.
function BackUp() {
  return (
    <nav className="tg-crumbs" aria-label="Up the ladder">
      <ol>
        <li>
          <Link to="/targets">Targets</Link>
        </li>
      </ol>
    </nav>
  );
}

// What the page shows about a target: its name and kind, why, where it sits
// on the ladder, its target on the range, and what's needed to edit it.
function describe(resolved, { data, view, ladder, focusGoals, edges, today }) {
  const { kind, id } = resolved;
  const crumbs = crumbsFor(resolved, { goals: data.goals, quests: data.quests, lessons: data.lessons, focusGoals: focusGoals ?? [], edges: edges ?? [] });
  // A quest that's done or set aside, or a lesson learned or set aside,
  // isn't on the range any more; its marks are still its own.
  const own = (one) => buildRange({ goals: [], quests: [], lessons: [], ...one }, data.marks, today).all[0] ?? null;

  if (kind === "mission") {
    const m = view.mission;
    return { crumbs, title: KIND_NAME.mission, eyebrow: null, mission: m, why: null, whyText: m?.statement ?? "", name: "your mission", editLabel: "Edit your mission", mark: null };
  }
  if (kind === "goal") {
    const goal = view.goals.find((g) => g.id === id);
    if (!goal) return null;
    const mark = ladder.targetOf(id) ?? own({ goals: [goal] });
    return { crumbs, title: goal.title, eyebrow: KIND_NAME.goal, why: goal.description ?? "", whyText: goal.description ?? "", name: goal.short, goal, editLabel: "Edit the goal", mark };
  }
  if (kind === "quest") {
    const quest = ladder.questView(id);
    if (!quest) return null;
    const mark = ladder.targetOf(id) ?? own({ quests: [quest] });
    const chip = quest.status === "done" ? "Done" : quest.status === "set_aside" ? "Set aside" : null;
    return { crumbs, title: quest.title, eyebrow: KIND_NAME.quest, why: quest.note ?? "", whyText: quest.note ?? "", name: mark?.short ?? shortTarget("quest", quest.title), quest, chip, editLabel: "Edit the quest and its camps", mark };
  }
  if (kind === "lesson") {
    const lesson = ladder.lessonView(id);
    if (!lesson) return null;
    const mark = ladder.targetOf(id) ?? own({ lessons: [lesson] });
    const chip = lesson.status === "learned" ? "Learned" : lesson.status === "set_aside" ? "Set aside" : null;
    return { crumbs, title: lesson.title, eyebrow: KIND_NAME.lesson, why: lesson.question ?? "", whyText: lesson.question ?? "", name: mark?.short ?? shortTarget("lesson", lesson.title), lesson, chip, editLabel: "Edit the lesson", mark };
  }
  // A week's focus: this week's row as the week has it now (its settings
  // may have just changed), or an earlier week's as it was.
  const row = (focusGoals ?? []).find((g) => g.id === id);
  if (!row) return null;
  const thisWeek = row.week_start === focusWeekOf(today);
  const weekGoal = thisWeek ? (ladder.focusWeek.week ?? []).find((g) => g.id === id) ?? null : null;
  const focusRow = { ...row, ...(weekGoal ?? {}) };
  const to = countsToward(focusRow);
  const toName = to ? towardTitle(focusRow, view, data) : null;
  const toPath = to ? pathOf(to.kind, to.id) : null;
  const why = (
    <>
      {to ? (
        <>
          Counts toward <Link to={toPath}>{toName ?? (to.kind === "goal" ? "a goal on your wheel" : to.kind === "quest" ? "a quest" : "a lesson")}</Link>
        </>
      ) : (
        "Stands alone"
      )}
      {!thisWeek && <span className="tg-why__week"> · {weekOfLabel(row.week_start)}</span>}
    </>
  );
  return {
    crumbs,
    title: focusRow.title,
    eyebrow: thisWeek ? KIND_NAME.focus : "Weekly focus",
    why,
    whyText: toName ? `Counts toward ${toName}` : "",
    name: focusRow.title,
    focusRow,
    weekGoal,
    thisWeek,
    lineage: lineageIds(row, focusGoals),
    editLabel: "Its settings",
    mark: null,
  };
}

// With #camps, #history, #notes or #quotes in the address, the page opens
// on that part once it's there (it may wait on its lists), and stays on it
// while what's above it finishes loading, unless he scrolls first.
function useScrollToPlace(key, hash) {
  useEffect(() => {
    if (!key || !PLACES.includes(hash)) return undefined;
    const id = hash.slice(1);
    const timers = [];
    let found = false;
    let moved = false;
    const stopFollowing = () => {
      moved = true;
    };
    const go = (smooth = false) => {
      const el = document.getElementById(id);
      if (!el) return false;
      el.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
      return true;
    };
    const follow = () => {
      for (const ms of [350, 900, 1800]) timers.push(setTimeout(() => !moved && go(), ms));
    };
    const tryNow = () => {
      if (found || !document.getElementById(id)) return false;
      found = true;
      requestAnimationFrame(() => go());
      follow();
      return true;
    };
    window.addEventListener("touchstart", stopFollowing, { passive: true });
    window.addEventListener("wheel", stopFollowing, { passive: true });
    window.addEventListener("keydown", stopFollowing);
    let mo = null;
    if (!tryNow() && typeof MutationObserver !== "undefined") {
      mo = new MutationObserver(() => {
        if (tryNow()) mo.disconnect();
      });
      mo.observe(document.body, { childList: true, subtree: true });
      timers.push(setTimeout(() => mo.disconnect(), 12000));
    }
    return () => {
      mo?.disconnect();
      timers.forEach(clearTimeout);
      window.removeEventListener("touchstart", stopFollowing);
      window.removeEventListener("wheel", stopFollowing);
      window.removeEventListener("keydown", stopFollowing);
    };
  }, [key, hash]);
}
