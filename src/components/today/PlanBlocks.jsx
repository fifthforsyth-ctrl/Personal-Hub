import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ArrowRight, ChevronDown, NotebookPen } from "lucide-react";
import { colorFor } from "../../lib/categories";
import { fmtTimeRange } from "../../lib/planDates";
import { fetchTasks, fetchTodayQuestWork, toggleTask, updateQuestTask, updateStep } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { planForToday, doneFields, applyOverrides } from "../../lib/todayPlan";
import { haptic } from "../../lib/haptics";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import { announceChange } from "./announce";

// Your plan for today, right under your minutes (Aaron, 2026-11-02): "all
// daily blocks visible, with just the blocks ahead of me expanded to see all
// the tasks."
//
// Every block you laid out for today is listed, in the order you'll live
// it. The one you're in now is marked and open, and so is each one ahead,
// with what you'll do in it: the tasks you planned into it on the day page,
// and what you picked for today on Quests when the block is tied to that
// quest or camp (src/lib/todayPlan.js decides which block takes what). A
// note you picked on Quests with tasks under it is a small heading over
// them. Blocks behind you shrink to one line with how much of them got
// done; a tap opens one to tick something you finished late.
//
// A tick saves straight away and shows before it's saved, and it holds until
// the card has read it back, so a reload already on its way (another card's
// change, the phone coming back) can't clear the box. Done things stay
// where they were, struck through, so nothing jumps out from under your
// thumb. What fits no block waits at the foot under "Not in a block", so
// nothing on today is hidden: planned tasks with no time, then each quest's,
// with a way into that quest.
//
// The card loads its own tasks, so Today opens as fast as it did; while
// they come, or if they don't, the blocks still show from the day's plan.
// Changing a block still happens on the day page, one tap away.
export default function PlanBlocks({ userId, date, chunks }) {
  const toast = useToast();
  const now = useNowMinutes();
  const [openPast, setOpenPast] = useState(() => new Set());

  const { data, error, reload } = useLoad(() => (userId ? loadWork(userId, date) : null), [userId, date]);

  // Something changed elsewhere (the capture sheet, the day page, this card
  // a moment ago), or the phone came back to the app.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && reload();
    window.addEventListener("hub:changed", reload);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("hub:changed", reload);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  // Tell the rest of Today once the ticks settle, so ticking off three
  // things in a row reloads the page once. `owed` is a save that landed and
  // hasn't been told yet. Leaving Today says it straight away.
  const tellTimer = useRef(null);
  const owed = useRef(false);
  const tellSoon = useCallback(() => {
    clearTimeout(tellTimer.current);
    tellTimer.current = setTimeout(() => {
      tellTimer.current = null;
      owed.current = false;
      announceChange();
    }, 1200);
  }, []);
  useEffect(
    () => () => {
      if (!owed.current) return;
      clearTimeout(tellTimer.current);
      tellTimer.current = null;
      owed.current = false;
      announceChange();
    },
    []
  );

  // Your ticks, held over what's loaded until a load that began after the
  // save has read them back (applyOverrides in src/lib/todayPlan.js). Kept
  // in a ref too, so a save that lands reads the latest of them.
  const [overrides, setOverrides] = useState(() => new Map());
  const overridesNow = useRef(overrides);
  const changeOverrides = useCallback((change) => {
    const next = new Map(overridesNow.current);
    change(next);
    overridesNow.current = next;
    setOverrides(next);
  }, []);

  const shown = useMemo(() => applyOverrides(data, overrides), [data, overrides]);
  const plan = useMemo(
    () => planForToday({ chunks: chunks ?? [], tasks: shown.data?.tasks ?? [], questWork: shown.data?.work ?? null, nowMin: now, date }),
    [chunks, shown, now, date]
  );

  // Once a load has read a tick back, let it go.
  useEffect(() => {
    const { keep } = applyOverrides(data, overridesNow.current);
    if (keep.size === overridesNow.current.size) return;
    overridesNow.current = keep;
    setOverrides(keep);
  }, [data]);

  // One save at a time for each row, so a double tap can't race itself.
  const saving = useRef(new Set());
  const toggle = useCallback(
    async (item) => {
      if (item.heading) return; // a note's words, nothing to tick
      const key = `${item.kind}:${item.id}`;
      if (saving.current.has(key)) return;
      saving.current.add(key);
      // An earlier tick's "tell the page" waits for this one, so its reload
      // can't go out while this save is still on its way.
      clearTimeout(tellTimer.current);
      tellTimer.current = null;
      const done = !item.done;
      const fields = doneFields(item.kind, done, date, new Date().toISOString());
      const before = overridesNow.current.get(key);
      const tick = { kind: item.kind, id: item.id, fields, savedAt: null };
      changeOverrides((m) => m.set(key, tick));
      haptic(done ? "success" : "tap");
      try {
        if (item.kind === "task") await toggleTask(item.id, done);
        else if (item.kind === "line") await updateQuestTask(item.id, fields);
        else await updateStep(item.id, fields);
        const savedAt = clock();
        changeOverrides((m) => {
          if (m.get(key) === tick) m.set(key, { ...tick, savedAt });
        });
        owed.current = true;
      } catch (err) {
        // Back to what showed before this tick: the last one that saved, if
        // there was one, or what's loaded.
        changeOverrides((m) => {
          if (m.get(key) !== tick) return;
          if (before) m.set(key, before);
          else m.delete(key);
        });
        toast.error(err, "Couldn't save that.");
        reload();
      } finally {
        saving.current.delete(key);
        if (owed.current && saving.current.size === 0) tellSoon();
      }
    },
    [changeOverrides, date, reload, tellSoon, toast]
  );

  const flipPast = (id) =>
    setOpenPast((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Today hasn't answered yet: nothing to show, rather than "nothing planned".
  if (chunks === undefined) return null;

  const { blocks, loose } = plan;
  const looseCount = loose.planned.length + loose.quests.length;
  const blocksMissing = chunks === null;

  return (
    <div className="card plan-blocks">
      <div className="card-head plan-blocks__head">
        <span className="card-title">
          <CalendarClock size={14} />
          Today's plan
        </span>
        <Link to={`/day/${date}`} className="btn-link plan-blocks__open">
          {blocks.length > 0 ? "Open day" : "Plan it"}
          <ArrowRight size={13} />
        </Link>
      </div>

      {error && <LoadError what="today's tasks" error={error} onRetry={reload} stale={Boolean(data)} className="plan-blocks__error" />}

      {blocksMissing ? (
        <p className="card-note">Couldn't load today's blocks. They'll be back when Today reloads.</p>
      ) : (
        blocks.length === 0 && looseCount === 0 && <p className="card-note">Nothing planned for today yet.</p>
      )}

      {!blocksMissing && blocks.length > 0 && (
        <ol className="plan-blocks__list">
          {blocks.map((b) => (
            <Block key={b.id} block={b} open={b.state !== "past" || openPast.has(b.id)} onFlip={() => flipPast(b.id)} onToggle={toggle} />
          ))}
        </ol>
      )}

      {!blocksMissing && looseCount > 0 && <Loose loose={loose} date={date} onToggle={toggle} />}
    </div>
  );
}

// The page's own clock, which never jumps when the phone sets its time.
const clock = () => performance.now();

// `startedAt` is read before anything goes out, so a load that began after a
// save landed is sure to have read it.
async function loadWork(userId, date) {
  const startedAt = clock();
  const [tasks, work] = await Promise.all([fetchTasks(userId, date), fetchTodayQuestWork(userId, date)]);
  return { tasks, work, startedAt };
}

// One block: its time and name, and what's in it when it's open. A block
// behind you opens and closes with a tap on its line.
function Block({ block: b, open, onFlip, onToggle }) {
  const past = b.state === "past";
  const isNow = b.state === "now";
  const canFlip = past && b.items.length > 0;
  const head = (
    <>
      <span className="plan-blocks__time mono">{fmtTimeRange(b.start_time, b.end_time)}</span>
      <span className="plan-blocks__title">
        {b.category && <span className="dot" style={{ background: colorFor(b.category) }} />}
        <span className="truncate">{b.title || "Untitled block"}</span>
      </span>
      <span className="plan-blocks__aside">
        {isNow && <span className="plan-blocks__now">Now</span>}
        {past && b.total > 0 && <span className="plan-blocks__count">{b.done} of {b.total} done</span>}
        {canFlip && <ChevronDown size={14} className={"plan-blocks__chev" + (open ? " is-open" : "")} />}
      </span>
    </>
  );
  const rowClass = "plan-blocks__row" + (isNow ? " is-now" : "") + (past ? " is-past" : "");
  const showItems = open && b.items.length > 0;

  return (
    <li className={"plan-block" + (isNow ? " plan-block--now" : "") + (showItems ? " has-items" : "")}>
      {canFlip ? (
        <button type="button" className={rowClass + " plan-blocks__row--tap"} aria-expanded={open} onClick={onFlip}>
          {head}
        </button>
      ) : (
        <div className={rowClass}>{head}</div>
      )}
      {showItems && <Items items={b.items} onToggle={onToggle} />}
    </li>
  );
}

// What's not tied to any block: tasks planned with no time, then each
// quest's, under its name (a way into that quest).
function Loose({ loose, date, onToggle }) {
  const many = loose.quests.length > 1;
  return (
    <div className="plan-blocks__loose">
      <div className="eyebrow plan-blocks__loose-head">Not in a block</div>
      {loose.planned.length > 0 && <Items items={loose.planned} onToggle={onToggle} />}
      {loose.quests.map((g) => (
        <div key={g.questId ?? "none"} className="plan-blocks__group">
          {g.questId ? (
            <Link to={`/quests/${g.questId}`} className="plan-blocks__group-title">
              <span className="truncate">{g.title}</span>
              <ArrowRight size={13} />
            </Link>
          ) : (
            <span className="plan-blocks__group-title">{g.title}</span>
          )}
          <Items items={g.items} hideFrom={g.title} onToggle={onToggle} />
        </div>
      ))}
      {loose.quests.length > 0 && (
        <p className="plan-blocks__hint">
          {many ? "Tie a block to one of these quests on the " : "Tie a block to this quest on the "}
          <Link to={`/day/${date}`}>day page</Link>
          {many ? " and its tasks show inside it." : " and these show inside it."}
        </p>
      )}
    </div>
  );
}

function Items({ items, onToggle, hideFrom = null, sub = false }) {
  return (
    <ul className={sub ? "plan-item__subs" : "plan-blocks__items"}>
      {items.map((item) => (
        <Item key={`${item.kind}:${item.id}`} item={item} hideFrom={hideFrom} onToggle={onToggle} />
      ))}
    </ul>
  );
}

// A thing to do: a box to tick, its words, where it's from on Quests, and
// what's under it. A note from Quests with tasks under it is a small label
// over them instead, with no box: the note isn't something to do, they are.
function Item({ item, onToggle, hideFrom }) {
  const from = item.from && item.from !== hideFrom ? item.from : null;
  if (item.heading) {
    return (
      <li className="plan-item plan-item--heading">
        <div className="plan-item__row">
          {/* The pen sits where a box would, as on Quests. */}
          <span className="plan-item__pen" aria-hidden="true">
            <NotebookPen size={13} />
          </span>
          <div className="plan-item__main">
            <span className="plan-item__label">{item.title}</span>
            {from && <span className="plan-item__from">{from}</span>}
          </div>
        </div>
        {item.subs.length > 0 && <Items items={item.subs} onToggle={onToggle} sub />}
      </li>
    );
  }
  return (
    <li className={"plan-item" + (item.done ? " is-done" : "")}>
      <div className="plan-item__row">
        {/* The tick plays its own feel (a firmer one for done), so the
            plain tap every label gets is skipped here. */}
        <label className="plan-item__check" data-haptic-skip="">
          <input
            type="checkbox"
            checked={item.done}
            onChange={() => onToggle(item)}
            aria-label={item.done ? `Mark “${item.title}” not done` : `Mark “${item.title}” done`}
          />
        </label>
        <div className="plan-item__main">
          <span className="plan-item__title">{item.title}</span>
          {from && <span className="plan-item__from">{from}</span>}
        </div>
      </div>
      {item.subs.length > 0 && <Items items={item.subs} onToggle={onToggle} sub />}
    </li>
  );
}

// Minutes since midnight, kept current so "Now" moves with the clock.
function useNowMinutes() {
  const read = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const [now, setNow] = useState(read);
  useEffect(() => {
    const id = setInterval(() => setNow(read()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}
