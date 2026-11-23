import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { addSection, columnsHome, COLUMNS_HOME, fetchRecentColumnIds } from "../../lib/api";
import { haptic } from "../../lib/haptics";
import { todayStr } from "../../lib/planDates";
import { BYPOS, loadColumns, setSection, useTasksStore } from "../../lib/tasksStore";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import { Column, HEX, NewColumn, useColumnOps } from "./Columns";
import { useTaskActions } from "./useTaskActions";

// The Tasks home (Aaron, 2026-11-23): "just be the option to click a big +
// to form a new column, or to scrub to look at my most recent columns".
//
// First a big +, then the columns he's touched most lately, wherever they
// are (a project's, or free-standing ones made with the +), newest first,
// swiped through sideways. Each one he didn't make here says which project
// and target it's in, a tap from there. The order is set when the page
// opens, so ticking a task doesn't shuffle the row under his finger.

const SHOWN = 12;

export default function TasksHome({ userId, board }) {
  const toast = useToast();
  const { sections, steps } = useTasksStore();
  const actions = useTaskActions();
  const [ids, setIds] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const { removeColumn, addIn, rename } = useColumnOps(userId, {
    onRemoved: (sec) => setIds((list) => (list ?? []).filter((id) => id !== sec.id)),
  });

  async function load() {
    try {
      const recent = await fetchRecentColumnIds(userId, SHOWN);
      await loadColumns(userId, recent);
      setIds(recent);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }
  useEffect(() => {
    if (userId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const camps = useMemo(() => new Map((board?.camps ?? []).map((c) => [c.id, c])), [board]);
  const quests = useMemo(() => new Map((board?.quests ?? []).map((q) => [q.id, q])), [board]);
  const bySec = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);
  const tops = useMemo(() => {
    const wanted = new Set(ids ?? []);
    const by = new Map();
    for (const st of steps) {
      if (!wanted.has(st.section_id) || st.parent_id) continue;
      by.set(st.section_id, [...(by.get(st.section_id) ?? []), st]);
    }
    for (const list of by.values()) list.sort(BYPOS);
    return by;
  }, [steps, ids]);

  async function newColumn(title) {
    try {
      const camp = await columnsHome(userId, todayStr());
      const sec = await addSection(userId, camp.id, { title, position: Date.now() % 1e9 });
      setSection(sec);
      setIds((list) => [sec.id, ...(list ?? [])]);
      haptic("success");
      setTimeout(() => document.querySelector(`.tk-col[data-section="${sec.id}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }), 60);
      return true;
    } catch (err) {
      toast.error(err, "Couldn't make that column.");
      return false;
    }
  }

  // Which project and target a column is in (nothing for a free one).
  function whereOf(sec) {
    const camp = camps.get(sec.camp_id);
    const quest = camp && quests.get(camp.quest_id);
    if (!camp || !quest || quest.note === COLUMNS_HOME) return null;
    const label = camp.title && camp.title !== "Main" ? `${quest.title} · ${camp.title}` : quest.title;
    return (
      <Link to={`/tasks/${quest.id}?camp=${camp.id}`} className="tk-col__where">
        {label}
      </Link>
    );
  }

  const shown = (ids ?? []).map((id) => bySec.get(id)).filter(Boolean);

  return (
    <>
      {error && <LoadError what="your recent columns" error={error} onRetry={load} stale={Boolean(ids)} />}
      <div className="tk-cols tk-cols--home" data-hscroll>
        <div className="tk-col tk-col--new tk-col--big">
          {adding ? (
            <NewColumn onDone={() => setAdding(false)} onSave={newColumn} />
          ) : (
            <button type="button" className="tk-newcol tk-newcol--big" onClick={() => setAdding(true)} aria-label="New column">
              <Plus size={44} strokeWidth={1.6} aria-hidden="true" />
              <span>New column</span>
            </button>
          )}
        </div>
        {ids === null && !error && <p className="empty tk-home-wait">Loading your columns…</p>}
        {shown.map((sec) => (
          <Column
            key={sec.id}
            title={sec.title}
            color={HEX[sec.color]}
            campId={sec.camp_id}
            sectionId={sec.id}
            items={tops.get(sec.id) ?? []}
            actions={actions}
            where={whereOf(sec)}
            onAdd={(t) => addIn(sec.camp_id, sec.id, t)}
            onRename={(title) => rename(sec, title)}
            onRemove={() => removeColumn(sec)}
          />
        ))}
      </div>
    </>
  );
}
