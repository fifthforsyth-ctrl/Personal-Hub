import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { fetchFocusGoalRows, fetchGoalEdges, fetchQuestBoard } from "../lib/api";
import { KIND_NAME, MISSION_KEY, crumbsFor, pathOf, resolveRef } from "../lib/ladder";
import { countsToward, focusWeekOf, lineageIds, towardTitle } from "../lib/focus";
import { buildRange, shortTarget } from "../lib/mark";
import { subtreeIds } from "../lib/wheel";
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
  return { key, note: null, picking: false, settings: false, history: hash === "#history", day: null };
}

// `onCanonical(path)` hears the page's own move to the target's address
// just before it goes, so App.jsx keeps the same page (and all it has
// loaded) across it.
export default function Target({ onCanonical = null }) {
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
  // A quest's or lesson's lists (QuestBody's board), read alongside the
  // ladder rather than after it: they know every quest and lesson, so its
  // page shows them without waiting on the whole ladder, or when the
  // ladder can't load. Which kind an address is isn't known until it's
  // placed, so every page but the mission's reads them.
  const wantsBoard = ref !== MISSION_KEY;
  const board = useLoad(() => (userId && wantsBoard ? fetchQuestBoard(userId) : null), [userId, wantsBoard]);

  const resolved = useMemo(
    () => placeRef(ref, { data, board: board.data, edges, focusGoals, rowsIn: Boolean(rows.data), today }),
    [ref, data, board.data, edges, focusGoals, rows.data, today]
  );
  const key = resolved?.key ?? null;

  // The target's own address, keeping the part of the page and anything
  // the link carried. It's the same target, so the page stays (App.jsx).
  useEffect(() => {
    if (key && key !== ref) {
      onCanonical?.(`/targets/${key}`);
      navigate(`/targets/${key}${location.search}${location.hash}`, { replace: true, state: location.state });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ref]);

  useScrollTop(key);
  // A quest's or lesson's history, notes and quotes are drawn under its
  // header while its lists load, then move below them, so the page looks
  // for its part once the lists have answered (or failed), where it stays.
  const listsIn = !(resolved?.kind === "quest" || resolved?.kind === "lesson") || !board.loading;
  useScrollToPlace(key && key === ref && listsIn ? key : null, location.hash);

  // What's open on this target's page; a new target starts afresh.
  const [ui, setUi] = useState(() => freshUi(key, location.hash));
  if (ui.key !== key) setUi(freshUi(key, location.hash));
  const set = (patch) => setUi((u) => ({ ...u, ...patch }));

  // The Ascent view in the shape the focus's settings and arrow read.
  const ascent = useMemo(
    () => ({ data, view, focuses: ladder.focuses, focusesById: ladder.focusesById, error: ladder.error, loading: ladder.loading, reload: ladder.reload }),
    [data, view, ladder.focuses, ladder.focusesById, ladder.error, ladder.loading, ladder.reload]
  );

  const quest = resolved?.kind === "quest" || resolved?.kind === "lesson";
  // What the page is drawn from: the ladder, or for a quest or lesson its
  // lists alone until the ladder's in.
  const ready = Boolean(data && view) || (quest && Boolean(board.data));
  const info = resolved && ready ? describe(resolved, { data, view, board: board.data, ladder, focusGoals, edges, today }) : null;

  const root = "page ascent mark qs tg-page" + (quest ? " tg-page--climb" : "");

  // --- Before there's a page to show -------------------------------------------

  // The ladder failed and the lists can't place it either (or it isn't a
  // quest's or lesson's page): Try again reads both.
  if (!data && ladder.error && !quest && !(wantsBoard && board.loading)) {
    return (
      <div className={root}>
        <BackUp />
        <LoadError
          what="your targets"
          error={ladder.error}
          onRetry={() => {
            ladder.reload();
            if (board.error) board.reload();
          }}
        />
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
  if (resolved === null || (key === ref && ready && !info)) {
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

  function openHistory(patch = {}) {
    set({ history: true, ...patch });
    requestAnimationFrame(() => document.getElementById("history")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  // An evening's line in the notes opens its day on the target (a new
  // object each tap, so the same line tapped again shows it again).
  const openDay = t ? (shotId) => openHistory({ day: { id: shotId } }) : null;

  // A quest or lesson drawn from its lists alone (the ladder isn't in yet,
  // or couldn't load) has no pencil until it is: its sheet edits the
  // ladder's row, with its camps and the goal it serves.
  const edit = info.fromBoard
    ? null
    : () => {
        if (kind === "mission") ladder.open({ kind: "mission" });
        else if (kind === "goal") ladder.open({ kind: "goal", goal: info.goal });
        else if (kind === "quest") ladder.open({ kind: "quest", quest: info.quest, onGone: () => navigate("/targets") });
        else if (kind === "lesson") ladder.open({ kind: "lesson", lesson: info.lesson, onGone: () => navigate("/targets") });
        else if (kind === "focus") set({ settings: true });
      };

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
        markWaiting={quest && !t && ladder.loading}
        today={today}
        chip={info.chip}
        build={build}
        actions={actions}
        onHistory={t ? () => openHistory() : null}
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
      reasons={t?.reasons ?? null}
      onOpenDay={openDay}
      limit={quest ? 5 : 10}
      sheet={ui.note}
      onSheet={(mode) => set({ note: mode })}
    />
  );

  return (
    <div className={root}>
      {quest ? (
        <>
          {/* Only the head's arrows, the history and the climb wait on the
              ladder: the lists show whatever it does. */}
          {ladder.error && <LoadError what={`this ${kind}'s arrows and climb`} error={ladder.error} onRetry={ladder.reload} stale={Boolean(data)} />}
          <QuestBody
            kind={kind}
            id={id}
            ladder={ladder}
            board={board.data}
            boardError={board.error}
            boardLoading={board.loading}
            reloadBoard={board.reload}
            mutateBoard={board.mutate}
            head={head}
            quotes={quotes}
            notes={notes}
            history={t ? <TargetHistory key={`h:${key}`} target={t} today={today} ladder={ladder} open={ui.history} onOpen={(open) => set(open ? { history: true } : { history: false, day: null })} pick={ui.day} /> : null}
            reloadRef={questReload}
          />
        </>
      ) : (
        <>
          {head()}
          <div className="tg-body">
            {kind === "goal" && t && <TargetHistory key={`h:${key}`} target={t} today={today} ladder={ladder} folded={false} pick={ui.day} />}
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

// Which target the address means, from what's in so far: undefined while
// it can't be told yet, null when it's nothing of his. Until the ladder's
// in, a quest's or lesson's lists (the board) place one of theirs, so its
// page needn't wait on the whole ladder; anything else waits for it. A
// focus never moves on past this week (a row already carried into next
// week stays next week's).
//   data    the ladder's rows (useLadder's data), or undefined
//   board   fetchQuestBoard(), or undefined
//   rowsIn  whether the focus rows and the wheel's links are in
export function placeRef(ref, { data, board, edges, focusGoals, rowsIn, today }) {
  if (ref === MISSION_KEY) return resolveRef(ref, {});
  const upTo = focusWeekOf(today);
  if (!data) {
    const hit = board ? resolveRef(ref, { quests: board.quests, lessons: board.lessons, upTo }) : null;
    return hit && (hit.kind === "quest" || hit.kind === "lesson") ? hit : undefined;
  }
  const hit = resolveRef(ref, { goals: data.goals, edges: edges ?? [], quests: data.quests, lessons: data.lessons, focusGoals: focusGoals ?? [], upTo });
  if (hit) return hit;
  return rowsIn ? null : undefined;
}

// The lifetime goals among every goal the board names: the ones the wheel
// draws under nothing (as fetchAscent tells them). None until its links
// are in.
function lifetimeOf(nodes, edges) {
  if (!edges) return [];
  const under = new Set(edges.map((e) => e.child_id));
  return (nodes ?? []).filter((n) => !under.has(n.id));
}

// What the page shows about a target: its name and kind, why, where it sits
// on the ladder, its target on the range, and what's needed to edit it.
// A quest or lesson can be drawn from its lists (`board`) before the
// ladder's in: then it has no target on the range yet (`mark` null), and
// `fromBoard` says its sheet can't open until the ladder's row is in.
export function describe(resolved, { data, view, board = null, ladder, focusGoals, edges, today }) {
  const { kind, id } = resolved;
  const rows = data
    ? { goals: data.goals, quests: data.quests, lessons: data.lessons }
    : { goals: lifetimeOf(board?.goals, edges), quests: board?.quests ?? [], lessons: board?.lessons ?? [] };
  const ladderLine = (focusList = []) => crumbsFor(resolved, { ...rows, focusGoals: focusList, edges: edges ?? [] });
  // A quest that's done or set aside, or a lesson learned or set aside,
  // isn't on the range any more; its marks are still its own.
  const own = (one) => (data ? buildRange({ goals: [], quests: [], lessons: [], ...one }, data.marks, today).all[0] ?? null : null);

  if (kind === "quest") {
    const seen = ladder.questView(id);
    const quest = seen ?? (board?.quests ?? []).find((q) => q.id === id && !q.lesson_id) ?? null;
    if (!quest) return null;
    const mark = data ? ladder.targetOf(id) ?? own({ quests: [quest] }) : null;
    const chip = quest.status === "done" ? "Done" : quest.status === "set_aside" ? "Set aside" : null;
    return {
      crumbs: ladderLine(),
      title: quest.title,
      eyebrow: KIND_NAME.quest,
      why: quest.note ?? "",
      whyText: quest.note ?? "",
      name: mark?.short ?? shortTarget("quest", quest.title),
      quest,
      chip,
      editLabel: "Edit the quest and its camps",
      mark,
      fromBoard: !seen,
    };
  }
  if (kind === "lesson") {
    const seen = ladder.lessonView(id);
    const lesson = seen ?? (board?.lessons ?? []).find((l) => l.id === id) ?? null;
    if (!lesson) return null;
    const mark = data ? ladder.targetOf(id) ?? own({ lessons: [lesson] }) : null;
    const chip = lesson.status === "learned" ? "Learned" : lesson.status === "set_aside" ? "Set aside" : null;
    return {
      crumbs: ladderLine(),
      title: lesson.title,
      eyebrow: KIND_NAME.lesson,
      why: lesson.question ?? "",
      whyText: lesson.question ?? "",
      name: mark?.short ?? shortTarget("lesson", lesson.title),
      lesson,
      chip,
      editLabel: "Edit the lesson",
      mark,
      fromBoard: !seen,
    };
  }

  // The rest are drawn from the ladder alone.
  if (!data || !view) return null;
  if (kind === "mission") {
    const m = view.mission;
    return { crumbs: ladderLine(), title: KIND_NAME.mission, eyebrow: null, mission: m, why: null, whyText: m?.statement ?? "", name: "your mission", editLabel: "Edit your mission", mark: null };
  }
  if (kind === "goal") {
    const goal = view.goals.find((g) => g.id === id);
    if (!goal) return null;
    const mark = ladder.targetOf(id) ?? own({ goals: [goal] });
    // Its notes and quotes include the goals under it on the wheel: a
    // lifetime goal moved under this one keeps what was written on it.
    return {
      crumbs: ladderLine(),
      title: goal.title,
      eyebrow: KIND_NAME.goal,
      why: goal.description ?? "",
      whyText: goal.description ?? "",
      name: goal.short,
      goal,
      editLabel: "Edit the goal",
      mark,
      lineage: [...subtreeIds(edges ?? [], id)],
    };
  }
  // A week's focus: this week's row as the week has it now (its settings
  // may have just changed), or an earlier week's as it was. Its ladder
  // line comes from that row too, so a new "counts toward" shows at once.
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
      {!thisWeek && <span className="tg-why__week"> · <span className="tg-why__date">{weekOfLabel(row.week_start)}</span></span>}
    </>
  );
  return {
    crumbs: ladderLine([focusRow]),
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
