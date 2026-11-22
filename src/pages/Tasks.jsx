import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Plus, Pencil, Trash2, Target as TargetIcon } from "lucide-react";
import { addQuest, deleteQuest, fetchQuestBoard, updateQuest } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { haptic } from "../lib/haptics";
import LoadError from "../components/ui/LoadError";
import { useConfirm, useToast } from "../components/ui/Feedback";
import { useLadder } from "../components/targets/useLadder";
import QuestBody from "../components/targets/QuestBody";
import "../styles/ascent.css";
import "../styles/mark.css";
import "../styles/camp.css";
import "../styles/quests.css";
import "../styles/targets.css";
import "../styles/tasks.css";

// Tasks: the task system on a tab of its own (Aaron, 2026-11-22: "this is
// useful for lots of other things and should be a tab of its own").
//
// Every list is drawn the way a quest's lists always were (QuestBody.jsx):
// today's list as a board, the ongoing list, the camps with their sections,
// and the clipboard, with earlier days under them. A list is one of two
// things:
//
// - a quest on Targets: its lists live here now, and its target (arrows,
//   notes, quotes) stays on Targets, a tap away from the head;
// - a plain list (0111, quests.is_list): made here for anything at all,
//   never a target. It starts with one camp, "Main", so the clipboard and
//   sections work from the first minute. It can be renamed or deleted here.
//
// /tasks opens the list last open on this device (or the first one);
// /tasks/<id> opens that one.

const LAST_KEY = "hub:tasks-last";

function readLast() {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

function keepLast(id) {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* private window: it just won't be remembered */
  }
}

const byPos = (a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));

// The lists along the top: the quests he's on, then his plain lists, each
// in its own order. A quest that's done or set aside drops off the row but
// still opens by its address.
export function listsOf(board) {
  const quests = (board?.quests ?? []).filter((q) => !q.lesson_id);
  const on = quests.filter((q) => q.status === "on");
  return [...on.filter((q) => !q.is_list).sort(byPos), ...on.filter((q) => q.is_list).sort(byPos)];
}

export default function Tasks() {
  const { id: param } = useParams();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  // After an edit in a sheet (a camp renamed or taken off), the open list
  // reads its own rows again.
  const listReload = useRef(null);
  const ladder = useLadder({ onSaved: () => listReload.current?.() });
  const { userId, today } = ladder;
  const board = useLoad(() => (userId ? fetchQuestBoard(userId) : null), [userId]);

  const lists = useMemo(() => listsOf(board.data), [board.data]);
  const all = useMemo(() => (board.data?.quests ?? []).filter((q) => !q.lesson_id), [board.data]);
  const remembered = readLast();
  const current = param ?? (lists.find((l) => l.id === remembered)?.id || lists[0]?.id || null);
  const open = all.find((q) => q.id === current) ?? null;

  // /tasks moves to the list it opens, so Back and a reload stay on it.
  useEffect(() => {
    if (!param && current) navigate(`/tasks/${current}${hash}`, { replace: true });
  }, [param, current, hash, navigate]);
  useEffect(() => {
    if (open) keepLast(open.id);
  }, [open]);

  // /tasks/<id>#camps (from a camp's "Plant the flag") opens on the camps.
  useEffect(() => {
    if (hash !== "#camps" || !open || !board.data) return undefined;
    const t = setTimeout(() => document.getElementById("camps")?.scrollIntoView({ block: "start" }), 300);
    return () => clearTimeout(t);
  }, [hash, open, board.data]);

  async function newList(title) {
    try {
      const id = await addQuest(userId, { title, today, isList: true, position: lists.length, camps: [{ title: "Main" }] });
      haptic("success");
      await board.reload();
      navigate(`/tasks/${id}`);
      return true;
    } catch (err) {
      toast.error(err, "Couldn't make that list.");
      return false;
    }
  }

  async function renameList(list, title) {
    board.mutate((b) => b && { ...b, quests: b.quests.map((q) => (q.id === list.id ? { ...q, title } : q)) });
    try {
      await updateQuest(list.id, { title });
    } catch (err) {
      toast.error(err, "Couldn't rename that list.");
      board.reload();
    }
  }

  async function removeList(list) {
    const ok = await confirm({
      title: `Delete “${list.title}”?`,
      body: "Everything on it goes too: its days, its camps and their sections, and its clipboard.",
      confirmLabel: "Delete list",
    });
    if (!ok) return;
    try {
      await deleteQuest(list.id);
      const rest = lists.filter((l) => l.id !== list.id);
      await board.reload();
      navigate(rest[0] ? `/tasks/${rest[0].id}` : "/tasks", { replace: true });
    } catch (err) {
      toast.error(err, "Couldn't delete that list.");
    }
  }

  const head = () => <TasksHead lists={lists} open={open} onNew={newList} onRename={renameList} onRemove={removeList} />;

  return (
    <div className="page ascent mark qs tg-page tg-page--climb tasks-page">
      {board.error && !board.data && <LoadError what="your lists" error={board.error} onRetry={board.reload} />}
      {!board.data ? (
        !board.error && <p className="empty">Loading…</p>
      ) : !open ? (
        <>
          {head()}
          {param ? (
            <section className="card tg-gone">
              <p>That list isn't here any more.</p>
              <Link to="/tasks" className="btn btn--accent">
                Back to Tasks
              </Link>
            </section>
          ) : (
            <p className="empty">Make a list for anything: a project, errands, a meeting's thoughts.</p>
          )}
        </>
      ) : (
        <QuestBody
          key={open.id}
          kind="quest"
          id={open.id}
          noun={open.is_list ? "list" : "quest"}
          ladder={ladder}
          board={board.data}
          boardError={board.error}
          boardLoading={board.loading}
          reloadBoard={board.reload}
          mutateBoard={board.mutate}
          head={head}
          reloadRef={listReload}
        />
      )}
      {ladder.overlay}
    </div>
  );
}

// The head of the tab: its name, the lists to switch between, a new list,
// and what the open one is (a quest with a way to its target, or a plain
// list with its rename and delete).
function TasksHead({ lists, open, onNew, onRename, onRemove }) {
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);

  return (
    <header className="tasks-head">
      <div className="eyebrow">Tasks</div>
      <nav className="tasks-lists" aria-label="Your lists">
        <ul>
          {lists.map((l) => (
            <li key={l.id}>
              <Link to={`/tasks/${l.id}`} className={"tasks-pill" + (open?.id === l.id ? " is-on" : "")} aria-current={open?.id === l.id ? "page" : undefined}>
                {!l.is_list && <TargetIcon size={12} aria-label="Quest" />}
                <span className="tasks-pill__text">{l.title}</span>
              </Link>
            </li>
          ))}
          <li>
            {adding ? (
              <NameForm label="New list" placeholder="Name the list" submit="Make it" onDone={() => setAdding(false)} onSave={onNew} />
            ) : (
              <button type="button" className="tasks-pill tasks-pill--new" onClick={() => setAdding(true)}>
                <Plus size={13} aria-hidden="true" />
                New list
              </button>
            )}
          </li>
        </ul>
      </nav>

      {open &&
        (renaming ? (
          <NameForm
            label="Rename the list"
            initial={open.title}
            submit="Save"
            onDone={() => setRenaming(false)}
            onSave={async (title) => {
              await onRename(open, title);
              return true;
            }}
          />
        ) : (
          <div className="tasks-title">
            <h1 className="page-title">{open.title}</h1>
            {open.is_list ? (
              <div className="tasks-title__tools">
                <button type="button" className="btn-icon" onClick={() => setRenaming(true)} aria-label="Rename the list" title="Rename">
                  <Pencil size={15} />
                </button>
                <button type="button" className="btn-icon" onClick={() => onRemove(open)} aria-label="Delete the list" title="Delete">
                  <Trash2 size={15} />
                </button>
              </div>
            ) : (
              <Link to={`/targets/${open.id}`} className="btn-link tasks-title__target">
                <TargetIcon size={13} aria-hidden="true" />
                Its target
              </Link>
            )}
          </div>
        ))}
    </header>
  );
}

// One line for a name, saved with Enter or the button; Escape or Cancel
// leaves it.
function NameForm({ label, placeholder = "", initial = "", submit, onSave, onDone }) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const title = text.trim().slice(0, 200);
  return (
    <form
      className="tasks-name"
      aria-label={label}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title || busy) return;
        if (title === initial.trim()) return onDone();
        setBusy(true);
        const ok = await onSave(title);
        setBusy(false);
        if (ok) onDone();
      }}
    >
      <input
        className="input"
        value={text}
        placeholder={placeholder}
        aria-label={label}
        autoFocus
        maxLength={200}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onDone()}
      />
      <button type="submit" className="btn btn--sm btn--accent" disabled={!title || busy}>
        {submit}
      </button>
      <button type="button" className="btn btn--sm" onClick={onDone} disabled={busy}>
        Cancel
      </button>
    </form>
  );
}
