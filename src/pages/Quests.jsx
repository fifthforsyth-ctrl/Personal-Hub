import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Castle, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { addCamps, addQuest, addQuestTasks, deleteQuestTask, fetchQuestBoard, fetchQuestTasks, reorder, updateQuest, updateQuestTask, updateQuestTasks } from "../lib/api";
import { boardOf, campTally, dayLabel, listDays, nextPosition, ongoingList, withFinished } from "../lib/questTasks";
import { villageOf } from "../lib/village";
import { appendToNote } from "../lib/sketch";
import { fmtDayHeading, todayStr } from "../lib/planDates";
import { useLoad } from "../lib/useLoad";
import { haptic } from "../lib/haptics";
import { playClink } from "../lib/clink";
import { useToast } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import Sheet from "../components/ascent/Sheet";
import FloatingBuild, { BuildMini, buildNow } from "../components/quests/FloatingBuild";
import { AddLine, DayList, OngoingList } from "../components/quests/Lines";
import QuestMap from "../components/quests/QuestMap";
import { SketchProvider } from "../components/sketch/Sketches";
import "../styles/ascent.css";
import "../styles/camp.css";
import "../styles/quests.css";

// Quests: a running to-do list and notepad for each quest and lesson. Every
// day he puts in what he'll do for it, ticks things off, writes notes on what
// he did, and does it again the next day. Lines can be tasks, sub-tasks under
// them, or note lines, and every one can carry notes, a colour and sketches.
// Nothing is carried forward (Aaron, 2026-10-14): an earlier day's list stays
// on its day, still there to tick. Beside the days, each quest keeps an
// ongoing list (Aaron, 2026-10-27) for what stays on it whatever the day; a
// line moves onto it or back onto today from its own tools.
//
// First come the quests and lessons as pills (Aaron, 2026-10-26): the one
// that's open unfolds to show the camps on its mountain, and tapping another
// opens its list and its camps. New camps are added there too.
//
// The build going up in the village floats at the top. Every task he ticks,
// on any list, lays its bricks on it until it stands; then he chooses the
// next build (/village?choose).

const EARLIER_SHOWN = 10;

export default function Quests() {
  const { key } = useParams();
  const { user } = useAuth();
  const userId = user?.id;
  const today = todayStr();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: board, error, loading, reload, mutate: mutateBoard } = useLoad(() => (userId ? fetchQuestBoard(userId) : null), [userId]);
  const items = useMemo(() => (board ? boardOf(board) : []), [board]);
  const sel = useMemo(() => {
    if (!board) return null;
    const hit = items.find((i) => i.key === key || (key?.startsWith("lesson-") && i.lessonId === key.slice(7)));
    if (hit || !key) return hit ?? items[0] ?? null;
    // A quest that's finished or set aside still opens from a link to it.
    const q = board.quests.find((x) => x.id === key);
    return q ? { key: q.id, questId: q.id, lessonId: q.lesson_id ?? null, name: q.title, type: q.lesson_id ? "Lesson" : "Quest", goalId: q.goal_id ?? null, note: q.note ?? null, off: true } : null;
  }, [board, items, key]);
  const questId = sel?.questId ?? null;

  const {
    data: lines,
    error: linesError,
    loading: linesLoading,
    reload: reloadLines,
    mutate: mutateLines,
  } = useLoad(() => (userId && questId ? fetchQuestTasks(userId, questId) : []), [userId, questId]);

  const village = useMemo(
    () =>
      board
        ? villageOf({ tasks: board.finished.tasks, steps: board.finished.steps, projects: board.projects, camps: board.camps, quests: board.quests, lessons: board.lessons }, today)
        : null,
    [board, today]
  );
  const days = useMemo(() => listDays(lines ?? [], today), [lines, today]);
  const ongoing = useMemo(() => ongoingList(lines ?? [], today), [lines, today]);

  const tally = useMemo(() => campTally(board?.campSteps), [board]);

  const [openId, setOpenId] = useState(null);
  const [openKey, setOpenKey] = useState(null);
  const [unfolded, setUnfolded] = useState({});
  const [allEarlier, setAllEarlier] = useState(false);
  const [away, setAway] = useState(false);
  const [newQuest, setNewQuest] = useState(false);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const onAway = useCallback((v) => setAway(v), []);

  useEffect(() => {
    setOpenId(null);
    setUnfolded({});
    setAllEarlier(false);
  }, [sel?.key]);
  useEffect(() => setNote(sel?.note ?? ""), [sel?.key, sel?.note]);
  // The quest that's open shows its camps; tapping its pill folds them away.
  useEffect(() => setOpenKey(sel?.key ?? null), [sel?.key]);

  function pick(item) {
    haptic("tap");
    if (item.key === sel?.key) setOpenKey((k) => (k === item.key ? null : item.key));
    else navigate(`/quests/${item.key}`, { replace: true });
  }

  const failed = (err, what) => {
    toast.error(err, what);
    reloadLines();
    reload();
  };

  // --- The list -------------------------------------------------------------

  const setLine = (id, fields) => mutateLines((list) => (list ?? []).map((x) => (x.id === id ? { ...x, ...fields } : x)));
  // The village counts finished tasks, so it hears about every tick.
  const tellVillage = (line) => mutateBoard((b) => b && { ...b, finished: { ...b.finished, tasks: withFinished(b.finished.tasks, line) } });

  function toggleDone(line) {
    const done_on = line.done_on ? null : today;
    const done_at = done_on ? new Date().toISOString() : null;
    const before = buildNow(village, today);
    setLine(line.id, { done_on, done_at });
    tellVillage({ ...line, done_on, done_at });
    if (done_on) {
      if (before && !before.complete && before.done + 1 >= before.need) {
        playClink();
        haptic("win");
        toast.show(`The ${before.name.toLowerCase()} stands`, { actionLabel: "Choose the next build", onAction: () => navigate("/village?choose") });
      } else haptic("tap");
    }
    updateQuestTask(line.id, { done_on, done_at }).catch((err) => failed(err, "Couldn't save that."));
  }

  function saveLine(line, fields) {
    setLine(line.id, fields);
    if (line.done_on) tellVillage({ ...line, ...fields });
    updateQuestTask(line.id, fields).catch((err) => failed(err, "Couldn't save that."));
  }

  // A task becomes a line of notes (it can't be ticked, so it lays no bricks), or back.
  function switchKind(line) {
    const fields = line.kind === "note" ? { kind: "task" } : { kind: "note", done_on: null, done_at: null };
    setLine(line.id, fields);
    tellVillage({ ...line, ...fields });
    updateQuestTask(line.id, fields).catch((err) => failed(err, "Couldn't change that."));
  }

  function removeLine(line) {
    const gone = new Set([line.id, ...(lines ?? []).filter((x) => x.parent_id === line.id).map((x) => x.id)]);
    const removed = (lines ?? []).filter((x) => gone.has(x.id));
    setOpenId(null);
    mutateLines((list) => (list ?? []).filter((x) => !gone.has(x.id)));
    mutateBoard((b) => b && { ...b, finished: { ...b.finished, tasks: b.finished.tasks.filter((t) => !gone.has(t.id)) } });
    toast.undoable({
      message: line.kind === "note" ? "Note line removed" : removed.length > 1 ? "Task and its sub-tasks removed" : "Task removed",
      run: () => deleteQuestTask(line.id).catch((err) => failed(err, "Couldn't remove that.")),
      onUndo: () => {
        mutateLines((list) => [...(list ?? []), ...removed]);
        removed.forEach((x) => x.done_on && tellVillage(x));
      },
    });
  }

  // Up or down past its neighbour, among the lines it sits with.
  function moveLine(line, siblings, by) {
    const i = siblings.findIndex((x) => x.id === line.id);
    const other = siblings[i + by];
    if (!other) return;
    const next = [...siblings];
    next.splice(i, 1);
    next.splice(i + by, 0, line);
    const at = new Map(next.map((x, k) => [x.id, k]));
    mutateLines((list) => (list ?? []).map((x) => (at.has(x.id) ? { ...x, position: at.get(x.id) } : x)));
    reorder("quest_tasks", next).catch((err) => failed(err, "Couldn't move that."));
  }

  // A lesson's list lives on its own mountain, made the first time he writes on it.
  async function ensureQuest() {
    if (questId) return { id: questId, made: false };
    const id = await addQuest(userId, { title: sel.name, lessonId: sel.lessonId, status: "on", today, goalId: sel.goalId });
    return { id, made: true };
  }

  // New lines at the end of today's list, or (`onList`) the ongoing list.
  async function addLines(parsed, kind, onList = false) {
    let made = false;
    try {
      const q = await ensureQuest();
      const qid = q.id;
      made = q.made;
      const all = lines ?? [];
      let pos = nextPosition(all, onList ? null : today);
      let parent = null;
      const rows = [];
      // Top lines first, so the sub-tasks can name them.
      const tops = await addQuestTasks(
        userId,
        parsed.filter((l) => !l.sub).map((l) => ({ quest_id: qid, kind, text: l.text, day: today, ongoing: onList, position: pos++ }))
      );
      rows.push(...tops);
      let t = 0;
      const subs = [];
      let subPos = 0;
      for (const l of parsed) {
        if (!l.sub) {
          parent = tops[t++];
          subPos = 0;
        } else if (parent) subs.push({ quest_id: qid, parent_id: parent.id, kind: "task", text: l.text, day: today, ongoing: onList, position: subPos++ });
      }
      if (subs.length) rows.push(...(await addQuestTasks(userId, subs)));
      haptic("tap");
      if (made) {
        // The new mountain's list loads with these lines already on it.
        await reload();
        navigate(`/quests/${qid}`, { replace: true });
      } else mutateLines((list) => [...(list ?? []), ...rows]);
      return true;
    } catch (err) {
      toast.error(err, parsed.length > 1 ? "Couldn't add those." : "Couldn't add that.");
      // A mountain made just now stays; load it so the next try writes there.
      if (made) reload();
      return false;
    }
  }

  async function addSubs(parent, parsed) {
    try {
      let pos = nextPosition(lines ?? [], parent.day, parent.id);
      const rows = await addQuestTasks(
        userId,
        parsed.map((l) => ({ quest_id: parent.quest_id, parent_id: parent.id, kind: "task", text: l.text, day: parent.day, ongoing: Boolean(parent.ongoing), position: pos++ }))
      );
      mutateLines((list) => [...(list ?? []), ...rows]);
      haptic("tap");
      return true;
    } catch (err) {
      toast.error(err, parsed.length > 1 ? "Couldn't add those." : "Couldn't add that.");
      return false;
    }
  }

  // A line (with its sub-tasks) onto the end of the ongoing list, or off it
  // onto the end of today's.
  function shiftLine(line) {
    const all = lines ?? [];
    const onList = !line.ongoing;
    const subs = all.filter((x) => x.parent_id === line.id).map((x) => x.id);
    const top = { ongoing: onList, ...(onList ? {} : { day: today }), position: nextPosition(all, onList ? null : today) };
    const rest = { ongoing: onList, ...(onList ? {} : { day: today }) };
    setOpenId(null);
    mutateLines((list) => (list ?? []).map((x) => (x.id === line.id ? { ...x, ...top } : subs.includes(x.id) ? { ...x, ...rest } : x)));
    haptic("tap");
    toast.show(onList ? "On the ongoing list" : "On today's list");
    Promise.all([updateQuestTask(line.id, top), updateQuestTasks(subs, rest)]).catch((err) => failed(err, "Couldn't move that."));
  }

  // A sketch's summary, added to the end of its line's notes ("cut" or
  // "full" when they're too long to take all of it).
  function addToNote(id, text) {
    const line = (lines ?? []).find((x) => x.id === id);
    if (!line) return "gone";
    const { note, status } = appendToNote(line.note, text, 20000);
    if (status !== "full") saveLine(line, { note });
    return status;
  }

  const row = (line, siblings) => ({
    onOpen: () => setOpenId((o) => (o === line.id ? null : line.id)),
    onDone: () => toggleDone(line),
    onSave: (fields) => saveLine(line, fields),
    onKind: () => switchKind(line),
    onMove: (by) => moveLine(line, siblings, by),
    onShift: line.parent_id ? undefined : () => shiftLine(line),
    onRemove: () => removeLine(line),
  });

  // --- The quest's notes and a new quest ----------------------------------------

  async function saveNote() {
    const value = note.trim() || null;
    if (!sel || value === (sel.note ?? null)) return;
    let made = false;
    try {
      const q = await ensureQuest();
      const id = q.id;
      made = q.made;
      await updateQuest(id, { note: value });
      mutateBoard((b) => b && { ...b, quests: b.quests.map((q) => (q.id === id ? { ...q, note: value } : q)) });
      if (made) {
        await reload();
        navigate(`/quests/${id}`, { replace: true });
      }
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 1800);
    } catch (err) {
      toast.error(err, "Couldn't save your notes.");
      if (made) reload();
    }
  }

  // New camps at the end of a quest's mountain, from its pill.
  async function newCamps(item, titles) {
    if (item.key !== sel?.key) return false;
    let made = false;
    try {
      const q = await ensureQuest();
      const qid = q.id;
      made = q.made;
      const startAt = (board?.camps ?? []).filter((c) => c.quest_id === qid).reduce((m, c) => Math.max(m, (c.position ?? 0) + 1), 0);
      const rows = await addCamps(userId, qid, titles, startAt);
      haptic("tap");
      if (made) {
        await reload();
        navigate(`/quests/${qid}`, { replace: true });
      } else mutateBoard((b) => b && { ...b, camps: [...b.camps, ...rows] });
      return true;
    } catch (err) {
      toast.error(err, titles.length > 1 ? "Couldn't add those camps." : "Couldn't add that camp.");
      if (made) reload();
      return false;
    }
  }

  async function startQuest(title) {
    try {
      const position = (board?.quests ?? []).reduce((m, q) => Math.max(m, (q.position ?? 0) + 1), 0);
      const id = await addQuest(userId, { title, status: "on", today, position });
      await reload();
      setNewQuest(false);
      navigate(`/quests/${id}`);
    } catch (err) {
      toast.error(err, "Couldn't start that quest.");
    }
  }

  // ---------------------------------------------------------------------------------

  if (!board) {
    return (
      <div className="page ascent qs">
        <header className="qs-head">
          <div>
            <div className="eyebrow">Quests</div>
            <h1 className="page-title">Your quests</h1>
          </div>
        </header>
        {error ? <LoadError what="your quests" error={error} onRetry={reload} /> : loading && <p className="empty">Loading…</p>}
      </div>
    );
  }

  const goal = sel?.goalId ? board.goals.find((g) => g.id === sel.goalId)?.title : null;
  const [todayList, ...earlierAll] = days;
  const earlier = earlierAll.filter((d) => d.items.length);
  const earlierShown = allEarlier ? earlier : earlier.slice(0, EARLIER_SHOWN);
  const building = buildNow(village, today);

  return (
    <div className="page ascent qs">
      <header className="qs-head">
        <div className="qs-head__name">
          <div className="eyebrow">{sel ? (sel.type === "Lesson" ? "Lesson" : "Quest") : "Quests"}</div>
          <h1 className="page-title qs-title">{sel ? sel.name : "Your quests"}</h1>
          {(goal || sel?.off) && (
            <span className="ascent-mini">
              {goal ? `Toward ${goal}` : ""}
              {goal && sel?.off ? " · " : ""}
              {sel?.off ? "Not on right now" : ""}
            </span>
          )}
        </div>
        <Link to="/village" className="btn btn--sm btn--on-page qs-head__village">
          <Castle size={14} />
          Village
        </Link>
      </header>

      <QuestMap items={items} sel={sel} camps={board.camps} tally={tally} openKey={openKey} onPick={pick} onNew={() => setNewQuest(true)} onAddCamps={newCamps} />

      {error && <LoadError what="your quests" error={error} onRetry={reload} stale />}

      <SketchProvider kind="task" userId={userId} scopeId={questId} about={(id) => (lines ?? []).find((x) => x.id === id)?.text} onAddToNote={addToNote}>
        <div className="qs-grid">
          <div className="qs-rail">
            <div className="qs-rail__build">
              <FloatingBuild village={village} today={today} onAway={onAway} />
            </div>

            {sel && (
              <aside className="qs-side">
                <section className="card qs-notes" aria-labelledby="qs-notes-h">
                  <div className="ascent-row">
                    <h2 className="eyebrow" id="qs-notes-h">
                      Notes on this {sel.type === "Lesson" ? "lesson" : "quest"}
                    </h2>
                    {noteSaved && <span className="ascent-mini camp-saved">Saved</span>}
                  </div>
                  <textarea
                    className="textarea"
                    rows={5}
                    value={note}
                    maxLength={20000}
                    placeholder="Where it's headed, decisions, ideas, links…"
                    onChange={(e) => setNote(e.target.value)}
                    onBlur={saveNote}
                  />
                </section>
              </aside>
            )}
          </div>

          <div className="qs-main">
            <BuildMini village={village} today={today} show={away} />

            {!sel ? (
              <section className="card qs-empty">
                <p>No quests on yet. Start one, and its list lives here: what you'll do for it each day, ticked off, with notes on what you did.</p>
                <button type="button" className="btn btn--sm btn--accent" onClick={() => setNewQuest(true)}>
                  <Plus size={14} />
                  Start a quest
                </button>
              </section>
            ) : (
              <>
                {linesError && <LoadError what="this list" error={linesError} onRetry={reloadLines} stale={Boolean(lines)} />}
                <DayList day={todayList} label="Today" sub={fmtDayHeading(today)} today={today} openId={openId} row={row} onAddSubs={addSubs}>
                  {!todayList.items.length && !linesLoading && (
                    <p className="qs-hint">
                      {earlier.length ? "A fresh list for today." : `What will you do for ${sel.type === "Lesson" ? "this lesson" : "this quest"} today?`}{" "}
                      {building && !building.complete ? `Each task you tick lays pieces on the ${building.name.toLowerCase()}.` : "Each task you tick lays pieces in the village."}
                    </p>
                  )}
                  <AddLine key={sel.key} onAdd={(parsed, kind) => addLines(parsed, kind)} />
                </DayList>

                <OngoingList key={sel.key} list={ongoing} kind={sel.type === "Lesson" ? "lesson" : "quest"} openId={openId} row={row} onAddSubs={addSubs}>
                  <AddLine key={sel.key} ongoing onAdd={(parsed, kind) => addLines(parsed, kind, true)} />
                </OngoingList>

                {earlier.length > 0 && <h2 className="eyebrow qs-earlier">Earlier</h2>}
                {earlierShown.map((d) => (
                  <DayList
                    key={d.day}
                    day={d}
                    label={dayLabel(d.day, today)}
                    today={today}
                    folded={!unfolded[d.day]}
                    onFold={() => setUnfolded((u) => ({ ...u, [d.day]: !u[d.day] }))}
                    openId={openId}
                    row={row}
                    onAddSubs={addSubs}
                  />
                ))}
                {earlier.length > earlierShown.length && (
                  <button type="button" className="btn btn--sm btn--on-page qs-older" onClick={() => setAllEarlier(true)}>
                    Show {earlier.length - earlierShown.length} older {earlier.length - earlierShown.length === 1 ? "day" : "days"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </SketchProvider>

      {newQuest && <NewQuest onSave={startQuest} onClose={() => setNewQuest(false)} />}
    </div>
  );
}

function NewQuest({ onSave, onClose }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title="New quest" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim() || busy) return;
          setBusy(true);
          await onSave(title.trim());
          setBusy(false);
        }}
      >
        <label className="field">
          <span>Name</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Build the best Premiere Pro plugin" autoFocus />
        </label>
        <p className="ascent-mini">Add its camps from its pill here. Its goal can be set on The Range.</p>
        <div className="ascent-sheet__actions">
          <span className="spacer" />
          <button type="submit" className="btn btn--accent" disabled={busy || !title.trim()}>
            {busy ? "Starting…" : "Start it"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
