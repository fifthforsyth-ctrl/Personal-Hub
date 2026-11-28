import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, Target as TargetIcon } from "lucide-react";
import { addCamps, addQuest, COLUMNS_HOME, deleteQuest, fetchTaskLists, updateQuest } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useLoad } from "../lib/useLoad";
import { haptic } from "../lib/haptics";
import { todayStr } from "../lib/planDates";
import { homeCamp, setHomeCamp } from "../lib/tasksStore";
import LoadError from "../components/ui/LoadError";
import { useConfirm, useToast } from "../components/ui/Feedback";
import Columns from "../components/tasks/Columns";
import TasksHome from "../components/tasks/TasksHome";
import "../styles/tasks.css";

// Tasks: the task system on a tab of its own (Aaron, 2026-11-22), made
// simple (Aaron, 2026-11-23): "the only organize we need is to be able to
// create a new column and have it remain there until i delete it".
//
// /tasks is the home (Aaron, 2026-11-23, later): "just be the option to
// click a big + to form a new column, or to scrub to look at my most recent
// columns. Not every column has to be organized by task". A column made
// there belongs to no project (api.js columnsHome).
//
// One row of pills runs under the title on every Tasks page (Clean slate,
// 2026-11-23): "Recent" (the home), then the projects, then a new one. The
// pill you're on is black, so the row is also the way back.
//
// A project (what were the lists: each quest he's on, and each plain list)
// opens at /tasks/<id>: its name, its targets (the project's camps) as
// pills, and the open target's columns side by side. Projects, targets and
// columns can all be made from here, in any mix.
//
// A column is one of a camp's sections, so everything sorted into sections
// before is right there. Tasks are carried between columns by their
// handles, and onto them from the clipboard, which pulls down from the top
// of any page (components/tasks/ClipboardPull.jsx). Today's board, the
// ongoing list and the earlier days are no longer drawn here; their rows are
// all still in the database.

const byPos = (a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));

// The projects: the quests he's on, then his plain lists, each in its own
// order. A quest that's done or set aside drops off the row but still opens
// by its address. The free columns' own home is never one.
export function listsOf(board) {
  const quests = (board?.quests ?? []).filter((q) => !q.lesson_id && q.note !== COLUMNS_HOME);
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
  const open = param ? ((board.data?.quests ?? []).find((q) => q.id === param && !q.lesson_id) ?? null) : null;

  // The targets of the open project, as pills; the one open is in the
  // address (?camp=), else the one last open on this device, else the first.
  const camps = useMemo(() => (board.data?.camps ?? []).filter((c) => c.quest_id === open?.id).sort(byPos), [board.data, open]);
  const home = homeCamp();
  const campId = camps.find((c) => c.id === search.get("camp"))?.id ?? camps.find((c) => c.id === home)?.id ?? camps[0]?.id ?? null;
  const camp = camps.find((c) => c.id === campId) ?? null;
  useEffect(() => {
    if (campId) setHomeCamp(campId);
  }, [campId]);

  async function newProject(title) {
    try {
      const id = await addQuest(userId, { title, today, isList: true, position: lists.length, camps: [{ title: "Main" }] });
      haptic("success");
      await board.reload();
      navigate(`/tasks/${id}`);
      return true;
    } catch (err) {
      toast.error(err, "Couldn't make that project.");
      return false;
    }
  }

  async function renameProject(list, title) {
    board.mutate((b) => b && { ...b, quests: b.quests.map((q) => (q.id === list.id ? { ...q, title } : q)) });
    try {
      await updateQuest(list.id, { title });
    } catch (err) {
      toast.error(err, "Couldn't rename that project.");
      board.reload();
    }
  }

  async function removeProject(list) {
    const ok = await confirm({
      title: `Delete “${list.title}”?`,
      body: "Everything in it goes too: its targets, their columns and tasks, and its clipboard.",
      confirmLabel: "Delete project",
    });
    if (!ok) return;
    try {
      await deleteQuest(list.id);
      await board.reload();
      navigate("/tasks", { replace: true });
    } catch (err) {
      toast.error(err, "Couldn't delete that project.");
    }
  }

  async function newTarget(title) {
    try {
      const [row] = await addCamps(userId, open.id, [title], camps.length);
      haptic("success");
      board.mutate((b) => b && { ...b, camps: [...b.camps, row] });
      setSearch({ camp: row.id }, { replace: true });
      return true;
    } catch (err) {
      toast.error(err, "Couldn't make that target.");
      return false;
    }
  }

  return (
    <div className="page tasks-page">
      <header className="hub-head tasks-head">
        <h1 className="page-title">Tasks</h1>
      </header>
      {board.error && !board.data && <LoadError what="your projects" error={board.error} onRetry={board.reload} />}
      {!board.data ? (
        !board.error && <p className="empty">Loading…</p>
      ) : (
        <>
          <ProjectPills lists={lists} on={param ?? ""} onNew={newProject} />
          {!param ? (
            <TasksHome userId={userId} board={board.data} />
          ) : !open ? (
            <section className="card tg-gone">
              <p>That project isn't here any more.</p>
              <Link to="/tasks" className="btn btn--accent">
                Back to Tasks
              </Link>
            </section>
          ) : (
            <>
              <ProjectTitle open={open} onRename={renameProject} onRemove={removeProject} />
              <TargetPills camps={camps} on={campId} onPick={(id) => setSearch({ camp: id }, { replace: true })} onNew={newTarget} />
              {camp ? <Columns key={camp.id} userId={userId} camp={camp} /> : <p className="empty">Add a target to start making columns.</p>}
            </>
          )}
        </>
      )}
    </div>
  );
}

// Recent and the projects, as pills under the title, and a new one. The one
// open is black, and is brought into view when it's off the edge.
function ProjectPills({ lists, on, onNew }) {
  const [adding, setAdding] = useState(false);
  const row = useRef(null);
  useEffect(() => {
    const ul = row.current;
    const pill = ul?.querySelector(".is-on");
    if (!ul || !pill) return;
    const left = pill.offsetLeft - ul.offsetLeft;
    if (left < ul.scrollLeft || left + pill.offsetWidth > ul.scrollLeft + ul.clientWidth) ul.scrollLeft = Math.max(0, left - 16);
  }, [on, lists.length]);
  return (
    <nav className="tasks-lists" aria-label="Projects">
      <ul ref={row}>
        <li>
          <Link to="/tasks" className={"tasks-pill" + (on ? "" : " is-on")} aria-current={on ? undefined : "page"}>
            Recent
          </Link>
        </li>
        {lists.map((l) => (
          <li key={l.id}>
            <Link to={`/tasks/${l.id}`} className={"tasks-pill" + (l.id === on ? " is-on" : "")} aria-current={l.id === on ? "page" : undefined}>
              <span className="tasks-pill__text">{l.title}</span>
            </Link>
          </li>
        ))}
        <li>
          {adding ? (
            <NameForm label="New project" placeholder="Name the project" submit="Make it" onDone={() => setAdding(false)} onSave={onNew} />
          ) : (
            <button type="button" className="tasks-pill tasks-pill--new" onClick={() => setAdding(true)}>
              <Plus size={15} aria-hidden="true" />
              Project
            </button>
          )}
        </li>
      </ul>
    </nav>
  );
}

// The open project's name, with its rename and delete (a plain one) or the
// way to its target on Targets (a quest).
function ProjectTitle({ open, onRename, onRemove }) {
  const [renaming, setRenaming] = useState(false);
  if (renaming)
    return (
      <NameForm
        label="Rename the project"
        initial={open.title}
        submit="Save"
        onDone={() => setRenaming(false)}
        onSave={async (title) => {
          await onRename(open, title);
          return true;
        }}
      />
    );
  return (
    <div className="tasks-title">
      <h2 className="tasks-title__name">{open.title}</h2>
      {open.is_list ? (
        <div className="tasks-title__tools">
          <button type="button" className="btn-icon" onClick={() => setRenaming(true)} aria-label="Rename the project" title="Rename">
            <Pencil size={17} />
          </button>
          <button type="button" className="btn-icon" onClick={() => onRemove(open)} aria-label="Delete the project" title="Delete">
            <Trash2 size={17} />
          </button>
        </div>
      ) : (
        <Link to={`/targets/${open.id}`} className="btn-link tasks-title__target">
          <TargetIcon size={15} aria-hidden="true" />
          On Targets
        </Link>
      )}
    </div>
  );
}

// The project's targets (its camps) as pills, with a new one at the end.
function TargetPills({ camps, on, onPick, onNew }) {
  const [adding, setAdding] = useState(false);
  return (
    <nav className="tasks-camps" aria-label="Targets">
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
            <NameForm label="New target" placeholder="Name the target" submit="Add" onDone={() => setAdding(false)} onSave={onNew} />
          ) : (
            <button type="button" className="tasks-pill tasks-pill--camp tasks-pill--new" onClick={() => setAdding(true)}>
              <Plus size={15} aria-hidden="true" />
              Target
            </button>
          )}
        </li>
      </ul>
    </nav>
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
