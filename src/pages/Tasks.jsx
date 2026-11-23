import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, Target as TargetIcon } from "lucide-react";
import { addCamps, addQuest, deleteQuest, fetchTaskLists, updateQuest } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useLoad } from "../lib/useLoad";
import { haptic } from "../lib/haptics";
import { todayStr } from "../lib/planDates";
import { homeCamp, setHomeCamp } from "../lib/tasksStore";
import LoadError from "../components/ui/LoadError";
import { useConfirm, useToast } from "../components/ui/Feedback";
import Columns from "../components/tasks/Columns";
import "../styles/tasks.css";

// Tasks: the task system on a tab of its own (Aaron, 2026-11-22), made
// simple (Aaron, 2026-11-23: "the only organize we need is to be able to
// create a new column and have it remain there until i delete it").
//
// Along the top, the lists (each quest he's on, then his plain lists), then
// the open list's camps as pills. Under them, the open camp's columns side
// by side, swiped through on the phone: as many as he makes, each kept until
// he deletes it. A column is one of the camp's sections, so everything
// already sorted into sections is right there. Tasks are carried between
// columns by their handles, and onto them from the clipboard, which now
// pulls down from the top of any page (components/tasks/ClipboardPull.jsx).
//
// Today's board, the ongoing list and the earlier days are no longer drawn
// here; their rows are all still in the database.
//
// /tasks opens the list last open on this device (or the first one);
// /tasks/<id>?camp=<camp> opens that one, on that camp.

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
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const userId = user?.id;
  const today = todayStr();

  const board = useLoad(() => (userId ? fetchTaskLists(userId) : null), [userId]);
  const lists = useMemo(() => listsOf(board.data), [board.data]);
  const all = useMemo(() => (board.data?.quests ?? []).filter((q) => !q.lesson_id), [board.data]);
  const remembered = readLast();
  const current = param ?? (lists.find((l) => l.id === remembered)?.id || lists[0]?.id || null);
  const open = all.find((q) => q.id === current) ?? null;

  // The camps of the open list, as pills; the one open is in the address
  // (?camp=), else the one last open on this device, else the first.
  const camps = useMemo(() => (board.data?.camps ?? []).filter((c) => c.quest_id === open?.id).sort(byPos), [board.data, open]);
  const home = homeCamp();
  const campId = camps.find((c) => c.id === search.get("camp"))?.id ?? camps.find((c) => c.id === home)?.id ?? camps[0]?.id ?? null;
  const camp = camps.find((c) => c.id === campId) ?? null;

  // /tasks moves to the list it opens, so Back and a reload stay on it.
  useEffect(() => {
    if (!param && current) navigate(`/tasks/${current}`, { replace: true });
  }, [param, current, navigate]);
  useEffect(() => {
    if (open) keepLast(open.id);
  }, [open]);
  useEffect(() => {
    if (campId) setHomeCamp(campId);
  }, [campId]);

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
      body: "Everything on it goes too: its camps, their columns and tasks, and its clipboard.",
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

  async function newCamp(title) {
    try {
      const [row] = await addCamps(userId, open.id, [title], camps.length);
      haptic("success");
      board.mutate((b) => b && { ...b, camps: [...b.camps, row] });
      setSearch({ camp: row.id }, { replace: true });
      return true;
    } catch (err) {
      toast.error(err, "Couldn't make that camp.");
      return false;
    }
  }

  return (
    <div className="page tasks-page">
      {board.error && !board.data && <LoadError what="your lists" error={board.error} onRetry={board.reload} />}
      {!board.data ? (
        !board.error && <p className="empty">Loading…</p>
      ) : (
        <>
          <TasksHead lists={lists} open={open} onNew={newList} onRename={renameList} onRemove={removeList} />
          {!open ? (
            param ? (
              <section className="card tg-gone">
                <p>That list isn't here any more.</p>
                <Link to="/tasks" className="btn btn--accent">
                  Back to Tasks
                </Link>
              </section>
            ) : (
              <p className="empty">Make a list for anything: a project, errands, a meeting's thoughts.</p>
            )
          ) : (
            <>
              <CampPills camps={camps} on={campId} onPick={(id) => setSearch({ camp: id }, { replace: true })} onNew={newCamp} />
              {camp ? <Columns key={camp.id} userId={userId} camp={camp} /> : <p className="empty">Add a camp to start making columns.</p>}
            </>
          )}
        </>
      )}
    </div>
  );
}

// The camps of the open list, as pills (Aaron, 2026-11-23: "remove the
// mountain graphic at the top and just place the camps at the top as
// pills"), with a new one at the end.
function CampPills({ camps, on, onPick, onNew }) {
  const [adding, setAdding] = useState(false);
  return (
    <nav className="tasks-camps" aria-label="Camps">
      <ul>
        {camps.map((c) => (
          <li key={c.id}>
            <button type="button" className={"tasks-pill tasks-pill--camp" + (c.id === on ? " is-on" : "")} aria-pressed={c.id === on} onClick={() => onPick(c.id)}>
              <span className="tasks-pill__text">{c.title}</span>
            </button>
          </li>
        ))}
        <li>
          {adding ? (
            <NameForm label="New camp" placeholder="Name the camp" submit="Add" onDone={() => setAdding(false)} onSave={onNew} />
          ) : (
            <button type="button" className="tasks-pill tasks-pill--camp tasks-pill--new" onClick={() => setAdding(true)}>
              <Plus size={13} aria-hidden="true" />
              Camp
            </button>
          )}
        </li>
      </ul>
    </nav>
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
