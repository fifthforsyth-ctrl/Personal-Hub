import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
// On a phone its handle is the white chip in the page's top corner, beside
// the menu, showing how many thoughts wait on it: tap it, or pull down on
// it, and the clipboard follows the finger; let go past a short way and it
// stays open. Once the page has scrolled and the chip has gone with the
// title, a small tab hangs from the top of the screen instead, so the
// clipboard is still one pull away from anywhere. On a desk the tab hangs
// from the top of the page all the time. It holds
// every open thought from every clipboard column, oldest first. New ones go
// to the camp last open on Tasks. Carry one by its handle onto a column on
// Tasks (the clipboard stays open over the top of the page, the columns
// below it), or tick it off right here. Push it back up, or tap the bar
// under it, to put it away.

const OPEN_AT = 56;
const PHONE = "(max-width: 900px)";
// How far a phone page scrolls before the chip is out of reach.
const CHIP_GONE = 64;

// Where the handle lives: in the phone's top corner (`slot`), or hanging
// from the top of the screen (no slot: a desk, or a phone page scrolled
// past its title).
function useHandleSlot() {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia(PHONE).matches);
  const [slot, setSlot] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(PHONE);
    const onChange = (e) => setPhone(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!phone) {
      setSlot(null);
      return undefined;
    }
    setSlot(document.getElementById("hub-clip-slot"));
    const main = document.querySelector(".main");
    if (!main) return undefined;
    const onScroll = () => setScrolled(main.scrollTop > CHIP_GONE);
    onScroll();
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, [phone]);

  return phone && !scrolled ? slot : null;
}

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
  const slot = useHandleSlot();

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

  // Pull down from the handle, anywhere in the app.
  useEffect(() => {
    const down = (e) => {
      if (isDragging() || (e.button != null && e.button !== 0)) return;
      const t = e.target;
      const onTab = t.closest?.(".tk-pulltab");
      const onFoot = t.closest?.(".tk-clip__foot");
      if (!onTab && !onFoot) return;
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
        // A tap on the handle opens it; a tap on the foot shuts it.
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

  const handle = (
    <button
      type="button"
      className={"tk-pulltab" + (slot ? " tk-pulltab--chip" : "") + (open ? " is-hidden" : "")}
      aria-label={`Open the clipboard${items.length ? ` (${items.length})` : ""}`}
      title="Clipboard"
      aria-expanded={open}
    >
      <ClipboardList size={slot ? 17 : 13} aria-hidden="true" />
      {items.length > 0 && <span>{items.length}</span>}
    </button>
  );

  return (
    <>
      {slot ? createPortal(handle, slot) : handle}
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
