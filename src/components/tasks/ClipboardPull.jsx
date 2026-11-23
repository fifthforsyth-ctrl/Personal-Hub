import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronUp, ClipboardList } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../ui/Feedback";
import { fetchTaskLists } from "../../lib/api";
import { haptic } from "../../lib/haptics";
import { isDragging } from "../../lib/taskDrag";
import { addToClipboard, BYPOS, homeCamp, loadClipboard, useTasksStore } from "../../lib/tasksStore";
import TaskRow, { AddTask } from "./TaskRow";
import { useTaskActions } from "./useTaskActions";
import "../../styles/tasks.css";

// The clipboard, pulled down from the top of any page (Aaron, 2026-11-23:
// "move the clipboard to be a dropdown I can drag down from the top of the
// screen at any time in the app").
//
// Pull down on the top bar (or the little tab hanging under it) and it
// follows the finger; let go past a short way and it stays open. It holds
// every open thought from every clipboard column, oldest first. New ones go
// to the camp last open on Tasks. Carry one by its handle onto a column on
// Tasks (the clipboard stays open over the top of the page, the columns
// below it), or tick it off right here. Push it back up, or tap the bar
// under it, to put it away.

const OPEN_AT = 56;

export default function ClipboardPull() {
  const { user } = useAuth();
  const userId = user?.id;
  const toast = useToast();
  const { sections, steps, clipReady } = useTasksStore();
  const { onTick, onText, onDrop, kidsOf } = useTaskActions();
  const [open, setOpen] = useState(false);
  const [pull, setPull] = useState(null); // px while a finger is pulling
  const sheet = useRef(null);
  const gesture = useRef(null);

  useEffect(() => {
    if (userId) loadClipboard(userId).catch((err) => console.warn(err));
  }, [userId]);
  // Read it fresh each time it opens (a thought spoken on the watch, say).
  useEffect(() => {
    if (open && userId) loadClipboard(userId).catch((err) => toast.error(err, "Couldn't load the clipboard."));
  }, [open, userId, toast]);

  const clipIds = useMemo(() => new Set(sections.filter((s) => s.clipboard).map((s) => s.id)), [sections]);
  const items = useMemo(() => {
    const secAt = new Map(sections.filter((s) => s.clipboard).sort(BYPOS).map((s, i) => [s.id, i]));
    return steps
      .filter((st) => clipIds.has(st.section_id) && !st.parent_id && !st.done_on)
      .sort((a, b) => (secAt.get(a.section_id) ?? 0) - (secAt.get(b.section_id) ?? 0) || BYPOS(a, b));
  }, [steps, sections, clipIds]);
  // Where new thoughts and dropped tasks land: the home camp's clipboard.
  const homeId = homeCamp();
  const homeSec = sections.filter((s) => s.clipboard && s.camp_id === homeId).sort(BYPOS)[0] ?? sections.filter((s) => s.clipboard).sort(BYPOS)[0] ?? null;

  // Pull down from the top bar or the tab, anywhere in the app.
  useEffect(() => {
    const down = (e) => {
      if (isDragging() || (e.button != null && e.button !== 0)) return;
      const t = e.target;
      const onBar = t.closest?.(".topbar") && !t.closest("a, button, input, textarea");
      const onTab = t.closest?.(".tk-pulltab");
      const onFoot = t.closest?.(".tk-clip__foot");
      if (!onBar && !onTab && !onFoot) return;
      gesture.current = { id: e.pointerId, y0: e.clientY, from: onFoot ? "open" : "shut", moved: false };
    };
    const move = (e) => {
      const g = gesture.current;
      if (!g || e.pointerId !== g.id) return;
      const dy = e.clientY - g.y0;
      if (Math.abs(dy) > 6) g.moved = true;
      if (!g.moved) return;
      e.preventDefault();
      const h = sheet.current?.offsetHeight || 400;
      setPull(g.from === "shut" ? Math.max(0, Math.min(h, dy)) : Math.max(0, Math.min(h, h + dy)));
    };
    const up = (e) => {
      const g = gesture.current;
      if (!g || e.pointerId !== g.id) return;
      gesture.current = null;
      const dy = e.clientY - g.y0;
      if (!g.moved) {
        // A tap on the tab or the foot opens or shuts it; a tap on the bar does nothing.
        if (e.target.closest?.(".tk-pulltab")) setOpen(true);
        else if (g.from === "open") setOpen(false);
      } else if (g.from === "shut") setOpen(dy > OPEN_AT);
      else setOpen(dy > -OPEN_AT);
      if (g.moved) haptic("tap");
      setPull(null);
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function add(texts) {
    try {
      let camp = homeCamp() || homeSec?.camp_id;
      if (!camp) {
        const { quests, camps } = await fetchTaskLists(userId);
        const on = new Set(quests.filter((q) => q.status === "on" && !q.lesson_id).map((q) => q.id));
        camp = camps.filter((c) => on.has(c.quest_id)).sort(BYPOS)[0]?.id;
      }
      if (!camp) {
        toast.show("Make a list on Tasks first, then its clipboard is here.");
        return false;
      }
      await addToClipboard(userId, camp, texts);
      haptic("tap");
      return true;
    } catch (err) {
      toast.error(err, "Couldn't add that.");
      return false;
    }
  }

  const shown = open || pull != null;
  const style =
    pull != null
      ? { transform: `translateY(calc(-100% + ${pull}px))`, transition: "none" }
      : undefined;

  return (
    <>
      <button type="button" className={"tk-pulltab" + (open ? " is-hidden" : "")} aria-label={`Pull down the clipboard${items.length ? ` (${items.length})` : ""}`} aria-expanded={open}>
        <ClipboardList size={13} aria-hidden="true" />
        {items.length > 0 && <span>{items.length}</span>}
      </button>
      <section
        ref={sheet}
        className={"tk-clip" + (open ? " is-open" : "") + (shown ? " is-shown" : "")}
        style={style}
        aria-label="Clipboard"
        aria-hidden={!shown}
      >
        <header className="tk-clip__head">
          <ClipboardList size={15} aria-hidden="true" />
          <strong>Clipboard</strong>
          {items.length > 0 && <small>{items.length}</small>}
          <span className="spacer" />
          <button type="button" className="btn-icon" onClick={() => setOpen(false)} aria-label="Put the clipboard away" title="Put away">
            <ChevronUp size={18} />
          </button>
        </header>
        <AddTask placeholder="Jot a thought" onAdd={add} />
        <ul className="tk-clip__list" data-vscroll {...(homeSec ? { "data-col": "", "data-camp": homeSec.camp_id, "data-section": homeSec.id } : {})}>
          {!clipReady ? (
            <li className="tk-empty">Loading…</li>
          ) : items.length === 0 ? (
            <li className="tk-empty">Nothing on the clipboard. Thoughts you jot or say land here.</li>
          ) : (
            items.map((st) => <TaskRow key={st.id} step={st} childrenOf={kidsOf} onTick={onTick} onText={onText} onDrop={onDrop} />)
          )}
        </ul>
        <div className="tk-clip__foot" role="button" aria-label="Push the clipboard back up" tabIndex={-1}>
          <span className="tk-clip__grab" aria-hidden="true" />
        </div>
      </section>
    </>
  );
}
