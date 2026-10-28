import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, Eye, EyeOff, Monitor, Pencil, Plus, Repeat, SlidersHorizontal } from "lucide-react";
import { useDragSort } from "../../lib/useDragSort";
import { moved } from "../../lib/dragOrder";
import { campColumns, computerColumns, filterOn, matchesFilter, MAX_COMPUTERS, moveKey, nextComputer, NO_FILTER, reorderShown } from "../../lib/todayBoard";
import { dayLabel } from "../../lib/questTasks";
import { DragHandle, StepList, URGENCY } from "../camp/Steps";
import { STEP_COLORS, tintOf } from "../camp/ColorPick";
import { CardBadge, ComputerPick } from "../camp/ComputerPick";
import { SketchProvider, SketchScope, useSketchScope } from "../sketch/Sketches";
import Sheet from "../ascent/Sheet";
import { INTO_LINES, LineTree } from "./Lines";

// A quest's Today as a board (Aaron, 2026-10-28). Everything on it is a card
// (todayCards in lib/todayBoard.js): a step picked on its own, a section
// picked whole, or a line. Three ways to see it:
//
//   My order     one list, in the order he drags it into
//   By camp      a column per camp, and one for the quest's own list
//   By computer  a column per computer working on the quest, and one for
//                what's no one's yet. The top card in a computer's column
//                is what it's working on, the next is on deck; a card
//                dragged into another column is handed to that computer.
//
// Every view keeps the same order (`onOrder` gets all the keys in their new
// order), and the filters (urgency, colour) narrow any of them. The view and
// the filter are held by the page, so they stay as they were when Today
// moves (in columns it spans a wide screen). The cards
// are the same rows as everywhere else: they tick, open and take notes the
// same, and today's own lines still go under another line or out to the
// ongoing list when carried there.

const VIEWS = [
  { key: "order", label: "My order" },
  { key: "camp", label: "By camp" },
  { key: "computer", label: "By computer" },
];
const VIEW_KEY = "hub:today-view";

// The view he left Today on, kept on this device.
export function useBoardView() {
  const [view, setView] = useState(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      return VIEWS.some((x) => x.key === v) ? v : "order";
    } catch {
      return "order";
    }
  });
  const pick = (v) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // a private window keeps it for this visit only
    }
  };
  return [view, pick];
}

const HIDE_KEY = "hub:today-hide-done";

// Whether what's done is hidden from Today (Aaron, 2026-10-28: "hide the
// completed tasks from my today list"), kept on this device. The count on
// Today still opens all that's done.
function useHideDone() {
  const [hide, setHide] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const flip = () => {
    setHide(!hide);
    try {
      localStorage.setItem(HIDE_KEY, hide ? "0" : "1");
    } catch {
      // a private window keeps it for this visit only
    }
  };
  return [hide, flip];
}

// A card carried over another computer's column lights it up, and room
// opens where it will land (`below`, the card it goes before; none: the end).
function markCol(hit) {
  document.querySelectorAll(".tb-col.tb-drop").forEach((e) => e !== hit?.el && e.classList.remove("tb-drop", "tb-drop-end"));
  document.querySelectorAll(".tb-card.tb-drop-before").forEach((e) => e !== hit?.below && e.classList.remove("tb-drop-before"));
  if (!hit) return;
  hit.el.classList.add("tb-drop");
  hit.el.classList.toggle("tb-drop-end", !hit.below);
  hit.below?.classList.add("tb-drop-before");
}

// After a card carried sideways is let go, the columns ease onto the one
// under the pointer (where it was let go), or else the nearest, rather than
// resting halfway across two.
function settleCols(box, x) {
  if (!box) return;
  const left = box.getBoundingClientRect().left;
  const rects = [...box.children].map((c) => c.getBoundingClientRect());
  const cols = rects.map((r) => box.scrollLeft + r.left - left - 4);
  const under = rects.findIndex((r) => x >= r.left && x <= r.right);
  const to = under >= 0 ? cols[under] : cols.reduce((a, b) => (Math.abs(b - box.scrollLeft) < Math.abs(a - box.scrollLeft) ? b : a), 0);
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  box.scrollTo({ left: Math.max(0, to), behavior: reduce ? "auto" : "smooth" });
}

// The column under the pointer (not the card being carried), and the card
// in it the carried one would go before.
function colAt(x, y, key) {
  const el = document
    .elementsFromPoint(x, y)
    .find((e) => !e.closest(`[data-card="${key}"]`) && e.closest("[data-col]"))
    ?.closest("[data-col]");
  if (!el) return null;
  const below = [...el.querySelectorAll("[data-open] > [data-card]")].find((c) => {
    if (c.dataset.card === key) return false;
    const r = c.getBoundingClientRect();
    return y < r.top + r.height / 2;
  });
  return { el, below, col: el.dataset.col, beforeKey: below?.dataset.card ?? null };
}

export default function TodayBoard({
  view,
  onView,
  filter,
  onFilter,
  filtering,
  onFiltering,
  cards,
  computers,
  usedComputers,
  today,
  kind,
  openStep,
  openOwn,
  openPicked,
  stepRow,
  ownRow,
  pickedRow,
  onAddStepSubs,
  onAddLineSubs,
  ownDrag,
  onSectionOff,
  onLineOut,
  onNest,
  onOrder,
  onAssign,
  onMoveCamp,
  onComputers,
  onRemoveComputer,
  sketch,
}) {
  const [sheet, setSheet] = useState(null); // { card } or { pc }
  const [hideDone, flipHideDone] = useHideDone();
  const colsRef = useRef(null);
  const taskScope = useSketchScope();

  const order = cards.map((c) => c.key);
  const byKey = new Map(cards.map((c) => [c.key, c]));
  const pcName = new Map(computers.map((c) => [c.n, c.name]));
  const known = (n) => (n != null && pcName.has(n) ? n : null);
  const pcCols = useMemo(() => computerColumns(cards, computers), [cards, computers]);
  const role = new Map();
  for (const col of pcCols) {
    if (col.working) role.set(col.working, "working");
    if (col.deck) role.set(col.deck, "deck");
  }
  const filtered = filterOn(filter);
  // What the filter asks for, and anything put on today since it was set,
  // so what's just added doesn't vanish as it's made.
  // With done hidden, a finished card is out of sight whatever the filter.
  const matches = (c) => matchesFilter(c, filter) || Boolean(filter.since && !filter.since.has(c.key));
  const shows = (c) => !(hideDone && c.finished) && matches(c);
  const hidden = filtered ? cards.filter((c) => !(hideDone && c.finished) && !matches(c)).length : 0;
  const doneHidden = hideDone ? cards.filter((c) => c.finished).length : 0;
  const campIds = [...new Set(cards.filter((c) => c.camp).map((c) => c.camp.id))].sort();

  // What a card wears at its top: in a computer's column, "Working on" or
  // "On deck"; elsewhere the computer it's handed to, and which of those it is.
  function badgeOf(card) {
    const n = known(card.computer);
    if (n == null) return null;
    const r = role.get(card.key);
    if (view === "computer") return r === "working" ? { kind: "working", label: "Working on" } : r === "deck" ? { kind: "deck", label: "On deck" } : null;
    const name = pcName.get(n);
    return r === "working" ? { kind: "working", label: `Working on · ${name}` } : r === "deck" ? { kind: "deck", label: `On deck · ${name}` } : { kind: "pc", label: name };
  }

  const colKeys = (n) => pcCols.find((c) => c.n === n)?.open.map((c) => c.key) ?? [];

  // Handed to computer `n` from its open row or its sheet: by computer it
  // goes to the end of that computer's column; elsewhere it keeps its place.
  function hand(card, n) {
    const to = known(n);
    if (to === known(card.computer)) return;
    onAssign(card, to, view === "computer" ? moveKey(order, card.key, null, colKeys(to)) : null);
  }

  // Let go over a computer's column: handed to it, just before the card it
  // landed on; over its own column, just moved there.
  function dropIn(card, hit) {
    const keys = moveKey(order, card.key, hit.beforeKey, colKeys(hit.n));
    if (hit.n === known(card.computer)) {
      if (keys.some((k, i) => k !== order[i])) onOrder(keys);
      return;
    }
    onAssign(card, hit.n, keys);
  }

  // By camp: a step or a section let go over another camp's column moves
  // to that camp, just before the card it landed on; over its own, just
  // moved there. The quest's own list takes only its own lines.
  const campCols = useMemo(() => campColumns(cards), [cards]);
  const campKey = (card) => (card.camp ? `camp:${card.camp.id}` : "list");
  function dropCamp(card, hit) {
    const col = campCols.find((c) => c.key === hit.col);
    if (!col?.camp) return;
    const keys = moveKey(order, card.key, hit.beforeKey, col.cards.map((c) => c.key));
    if (hit.col === campKey(card)) {
      if (keys.some((k, i) => k !== order[i])) onOrder(keys);
      return;
    }
    onMoveCamp(card, col.camp.id, keys);
  }

  // The column a card carried out of its list is over, where it can go:
  // by computer, any; by camp, another camp's (steps and sections only).
  function hitAt(x, y, card) {
    if (view === "computer") {
      const hit = colAt(x, y, card.key);
      return hit && { ...hit, n: hit.col === "none" ? null : Number(hit.col.slice(3)) };
    }
    if (view === "camp" && card.kind !== "line") {
      const hit = colAt(x, y, card.key);
      return hit && hit.col !== "list" ? hit : null;
    }
    return null;
  }

  // Carried out of its list: by computer or by camp, into another column;
  // a line of today's own, out to the ongoing list.
  function carried(phase, x, y, key) {
    const card = byKey.get(key);
    if (!card) return;
    const hit = phase === "move" || phase === "drop" ? hitAt(x, y, card) : null;
    markCol(phase === "move" ? hit : null);
    const own = card.kind === "line" && card.own;
    if (hit) {
      if (own) onLineOut("cancel", x, y, card.item);
      if (phase === "drop") (view === "computer" ? dropIn : dropCamp)(card, hit);
      return;
    }
    if (own) onLineOut(phase, x, y, card.item);
  }

  // A line of today's own let go over another line goes under it.
  const into = (key) => {
    const c = byKey.get(key);
    return c?.kind === "line" && c.own ? { rows: INTO_LINES, label: "Make it a sub-task", drop: (_, li) => onNest(c.item, li.id.slice("line-".length)) } : null;
  };

  // Dragged into a new order among the cards shown in one list (`shown`):
  // they swap places between them, and the rest keep theirs.
  const reorder = (shown, next) => onOrder(reorderShown(order, shown, next));
  const nudge = (shown, key, by) => {
    const i = shown.indexOf(key);
    if (i < 0 || i + by < 0 || i + by >= shown.length) return;
    reorder(shown, moved(shown, i, i + by));
  };

  const stepFrom = (card) => (view === "camp" ? card.item.from : [card.camp.title, card.item.from].filter(Boolean).join(" · "));

  // One card: `sort` its drag (none for a done card sunk to the foot of a
  // computer's column) and `shown` the list it moves up and down in.
  function body(card, sort, shown) {
    const badge = badgeOf(card);
    const i = shown.indexOf(card.key);
    const move = sort ? { onMove: (by) => nudge(shown, card.key, by), first: i <= 0, last: i === shown.length - 1 } : { onMove: undefined };
    const computer = { value: known(card.computer), options: computers, onChange: (n) => hand(card, n) };
    if (card.kind === "section") {
      return (
        <BoardSection
          card={card}
          sort={sort}
          badge={badge}
          from={view === "camp" ? null : card.camp.title}
          computerName={pcName.get(known(card.computer)) ?? null}
          hideDone={hideDone}
          onComputer={() => setSheet({ card })}
          onOff={() => onSectionOff(card.block.section)}
          openStep={openStep}
          stepRow={stepRow}
          onAddSubs={onAddStepSubs}
        />
      );
    }
    if (card.kind === "step") {
      const it = { ...card.item, from: stepFrom(card) };
      return (
        <StepList
          list={[it]}
          openStep={openStep}
          hideDone={hideDone}
          step={(st) => (st.id === card.id ? { ...stepRow(st), ...move, badge, computer } : stepRow(st))}
          onAddSubs={onAddStepSubs}
          mirror
          idPrefix="qs-step"
          sortOf={() => sort}
        />
      );
    }
    const own = card.own;
    const row = (l, sibs) => {
      const p = own ? ownRow(l, sibs) : pickedRow(l);
      return l.id === card.id ? { ...p, ...move, badge, computer } : p;
    };
    return (
      <SketchScope value={taskScope}>
        <LineTree
          items={[card.item]}
          openId={own ? openOwn : openPicked}
          row={row}
          onAddSubs={onAddLineSubs}
          {...(own ? ownDrag : {})}
          mirror={!own}
          idPrefix={own ? undefined : "today-line"}
          fromOf={(l) => (l.from === "ongoing" ? "Ongoing" : dayLabel(l.from, today))}
          sortOf={() => sort}
        />
      </SketchScope>
    );
  }

  const list = (shownCards, cross) => <CardColumn cards={shownCards} body={body} onReorder={reorder} onOut={carried} into={into} cross={cross} />;
  const nothing = filtered && !cards.some(shows);
  const allDone = !nothing && doneHidden > 0 && !cards.some(shows);

  let content;
  if (allDone) {
    content = (
      <div className="tb-none">
        <p className="today-hint">Everything on today is done.</p>
        <button type="button" className="btn btn--sm" onClick={flipHideDone}>
          Show done
        </button>
      </div>
    );
  } else if (nothing) {
    content = (
      <div className="tb-none">
        <p className="today-hint">Nothing on today matches that filter.</p>
        <button type="button" className="btn btn--sm" onClick={() => onFilter(NO_FILTER)}>
          Clear the filter
        </button>
      </div>
    );
  } else if (view === "order") {
    content = list(cards.filter(shows), null);
  } else if (view === "camp") {
    const cross = { scroller: () => colsRef.current, settle: (x) => settleCols(colsRef.current, x) };
    // A camp's column stays while a filter or Hide done empties it, so a
    // step can still be carried into it.
    content = (
      <div className="tb-cols" ref={colsRef} data-drag-clip="">
        {campCols
          .map((col) => ({ ...col, shown: col.cards.filter(shows) }))
          .filter((col) => col.shown.length || col.camp)
          .map((col) => (
            <section key={col.key} className="tb-col" data-col={col.key} aria-label={col.camp ? col.camp.title : `This ${kind}'s list`}>
              <div className="tb-col__head">
                {col.camp ? (
                  <Link to={`/ascent/camp/${col.camp.id}`} state={{ from: "quests" }} className="today-group__label tb-col__name">
                    <span className="today-group__n" aria-hidden="true">
                      {col.number}
                    </span>
                    <span className="today-group__name">{col.camp.title}</span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="today-group__label today-group__label--list tb-col__name">
                    <Repeat size={13} aria-hidden="true" />
                    <span className="today-group__name">This {kind}'s list</span>
                  </span>
                )}
                {col.total > 0 && <small className="tb-col__count">{`${col.done} of ${col.total}`}</small>}
              </div>
              {list(col.shown, cross)}
              {!col.shown.length && <p className="tb-col__empty">{col.cards.some(matches) ? "All done here." : "Nothing here matches."}</p>}
            </section>
          ))}
      </div>
    );
  } else {
    const cross = { scroller: () => colsRef.current, settle: (x) => settleCols(colsRef.current, x) };
    content = (
      <div className="tb-cols" ref={colsRef} data-drag-clip="">
        {pcCols.map((col) => {
          const open = col.open.filter(shows);
          const sunk = col.finished.filter(shows);
          const done = col.cards.reduce((n, c) => n + c.done, 0);
          const total = col.cards.reduce((n, c) => n + c.total, 0);
          const pc = col.n == null ? null : computers.find((c) => c.n === col.n);
          return (
            <section key={col.key} className={"tb-col tb-col--pc" + (pc ? "" : " tb-col--none")} data-col={col.key} aria-label={col.name}>
              <div className="tb-col__head">
                {pc ? (
                  <button type="button" className="tb-col__name tb-pc-name" aria-haspopup="dialog" aria-label={`${pc.name}. Rename or remove it`} onClick={() => setSheet({ pc })}>
                    <Monitor size={14} aria-hidden="true" />
                    <span>{pc.name}</span>
                    <Pencil size={12} className="tb-pc-name__edit" aria-hidden="true" />
                  </button>
                ) : (
                  <span className="tb-col__name tb-pc-name tb-pc-name--none">Not assigned</span>
                )}
                {total > 0 && <small className="tb-col__count">{`${done} of ${total}`}</small>}
              </div>
              {list(open, cross)}
              {!col.cards.length && <p className="tb-col__empty">{pc ? `Drag a step, a section or a task here to hand it to ${pc.name}.` : "Everything on today is handed out."}</p>}
              {col.cards.length > 0 && !open.length && !sunk.length && <p className="tb-col__empty">{col.open.some(matches) || col.finished.some(matches) ? "All done here." : "Nothing here matches."}</p>}
              {sunk.length > 0 && (
                <>
                  <p className="tb-col__done">Done</p>
                  <div className="tb-list tb-list--done">
                    {sunk.map((c) => (
                      <div key={c.key} className="tb-card" data-card={c.key}>
                        {body(c, null, [])}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          );
        })}
        {computers.length < MAX_COMPUTERS && (
          <button type="button" className="tb-col tb-col--add" onClick={() => onComputers([...computers, nextComputer(computers, usedComputers)])}>
            <Plus size={15} aria-hidden="true" />
            Add a computer
          </button>
        )}
      </div>
    );
  }

  const count = filter.urgency.length + filter.color.length;
  const toggle = (dim, key) => onFilter({ ...filter, [dim]: filter[dim].includes(key) ? filter[dim].filter((k) => k !== key) : [...filter[dim], key] });

  return (
    <div className={`tb tb--${view}`}>
      <div className="tb-bar">
        <div className="seg tb-seg" role="group" aria-label="See today">
          {VIEWS.map((v) => (
            <button key={v.key} type="button" className={"seg-btn" + (view === v.key ? " active" : "")} aria-pressed={view === v.key} onClick={() => onView(v.key)}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="tb-bar__tools">
        <button type="button" className={"btn btn--sm tb-done-btn" + (hideDone ? " on" : "")} aria-pressed={hideDone} aria-label={hideDone ? "Done is hidden. Show done" : "Hide done"} onClick={flipHideDone}>
          {hideDone ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
          <span>{hideDone ? "Show done" : "Hide done"}</span>
        </button>
        <button type="button" className={"btn btn--sm tb-filter-btn" + (count ? " on" : "")} aria-expanded={filtering} aria-label={count ? `Filter, ${count} on` : "Filter"} onClick={() => onFiltering(!filtering)}>
          <SlidersHorizontal size={14} aria-hidden="true" />
          <span className="tb-filter-btn__word">Filter</span>
          {count > 0 && <b className="tb-filter-btn__n">{count}</b>}
        </button>
        </div>
      </div>
      {filtering && (
        <div className="tb-filters">
          <div className="tb-filters__row" role="group" aria-label="Urgency">
            <span className="tb-filters__label">Urgency</span>
            {URGENCY.map((u) => (
              <button key={u.key} type="button" className={"tb-chip" + (filter.urgency.includes(u.key) ? " on" : "")} aria-pressed={filter.urgency.includes(u.key)} onClick={() => toggle("urgency", u.key)}>
                <i className={`camp-urgency camp-urgency--${u.key}`} aria-hidden="true" />
                {u.label}
              </button>
            ))}
          </div>
          <div className="tb-filters__row" role="group" aria-label="Color">
            <span className="tb-filters__label">Color</span>
            {STEP_COLORS.map((c) => {
              const on = filter.color.includes(c.key);
              return (
                <button key={c.key} type="button" className={"camp-swatch tb-swatch" + (on ? " on" : "")} style={{ "--swatch": c.hex }} aria-pressed={on} aria-label={c.label} title={c.label} onClick={() => toggle("color", c.key)}>
                  {on && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          {count > 0 && (
            <button type="button" className="btn-link tb-filters__clear" onClick={() => onFilter(NO_FILTER)}>
              Clear
            </button>
          )}
        </div>
      )}

      <SketchProvider kind="step" userId={sketch.userId} scopeId={campIds} about={sketch.about} onAddToNote={sketch.onAddToNote}>
        {content}
      </SketchProvider>
      {doneHidden > 0 && !allDone && (
        <p className="tb-hidden">
          {doneHidden === 1 ? "1 done, hidden." : `${doneHidden} done, hidden.`}{" "}
          <button type="button" className="btn-link" onClick={flipHideDone}>
            Show done
          </button>
        </p>
      )}
      {hidden > 0 && !nothing && (
        <p className="tb-hidden">
          {hidden === 1 ? "1 more on today, hidden by the filter." : `${hidden} more on today, hidden by the filter.`}{" "}
          <button type="button" className="btn-link" onClick={() => onFilter(NO_FILTER)}>
            Show all
          </button>
        </p>
      )}

      {sheet?.card && (
        <Sheet title={sheet.card.block.section.title} onClose={() => setSheet(null)}>
          <ComputerPick
            value={known(sheet.card.computer)}
            options={computers}
            onChange={(n) => {
              hand(sheet.card, n);
              setSheet(null);
            }}
          />
        </Sheet>
      )}
      {sheet?.pc && (
        <ComputerSheet
          pc={sheet.pc}
          count={cards.filter((c) => known(c.computer) === sheet.pc.n).length}
          onRename={(name) => onComputers(computers.map((c) => (c.n === sheet.pc.n ? { ...c, name } : c)))}
          onRemove={() => onRemoveComputer(sheet.pc.n)}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

// One list of cards, each dragged by its handle into a new order (`onReorder(shown,
// next)`), carried out of it (`onOut`), or (a line) under another line (`into`).
// With `cross` it's one column among others side by side.
function CardColumn({ cards, body, onReorder, onOut, into, cross }) {
  const keys = cards.map((c) => c.key);
  const sort = useDragSort(keys, (next) => onReorder(keys, next), { onOut, into, cross });
  return (
    <div className="tb-list" data-open="">
      {cards.map((c) => {
        const lifted = sort.dragging === c.key;
        return (
          <div key={c.key} ref={sort.ref(c.key)} style={sort.style(c.key)} className={"tb-card" + (lifted ? " is-lifted" : "")} data-card={c.key}>
            {body(c, { handle: sort.handle(c.key), lifted, nesting: lifted ? sort.nesting : null }, keys)}
          </div>
        );
      })}
    </div>
  );
}

// A section picked whole, as a card: its number and name (and its camp,
// where the view doesn't say), how far along, the computer it's handed to,
// "Off today", and its steps, which tick and open where they are.
function BoardSection({ card, sort, badge, from, computerName, hideDone, onComputer, onOff, openStep, stepRow, onAddSubs }) {
  const b = card.block;
  const s = b.section;
  const tint = tintOf(s.color);
  return (
    <div
      id={`qs-step-sec-${s.id}`}
      className={"today-sec tb-sec" + tint.className + (sort?.lifted ? " lifted" : "") + (badge ? ` tb-row--${badge.kind}` : "")}
      style={tint.style}
    >
      <div className="today-sec__head tb-sec__head">
        <span className="today-sec__n" aria-hidden="true">
          {s.number}
        </span>
        <div className="tb-sec__name">
          <CardBadge badge={badge} />
          {from && <small className="camp-step__from">{from}</small>}
          <h3 className="today-sec__name">{s.title}</h3>
          <div className="tb-sec__meta">
            {b.total > 0 && <small>{`${b.done} of ${b.total}`}</small>}
            <button type="button" className="btn-link tb-sec__pc" aria-haspopup="dialog" aria-label={computerName ? `Handed to ${computerName}. Change it` : "Hand it to a computer"} onClick={onComputer}>
              <Monitor size={13} aria-hidden="true" />
              <span>{computerName ?? "Computer"}</span>
            </button>
            <button type="button" className="btn-link today-sec__off" onClick={onOff}>
              Off today
            </button>
          </div>
        </div>
        {sort && <DragHandle {...sort.handle} label={`Drag to move ${s.title}`} />}
      </div>
      {b.items.length > 0 ? (
        <StepList list={hideDone ? b.items.filter((st) => !st.done_on) : b.items} openStep={openStep} hideDone={hideDone} step={stepRow} onAddSubs={onAddSubs} mirror idPrefix="qs-step" />
      ) : (
        <p className="today-hint">{b.earlier ? "Every step here was done before today." : "No steps in this section yet."}</p>
      )}
      {b.items.length > 0 && b.earlier > 0 && <p className="ascent-mini today-sec__earlier">{b.earlier === 1 ? "1 done before today, not shown" : `${b.earlier} done before today, not shown`}</p>}
    </div>
  );
}

// A computer's name, or taking it off the board: what was handed to it goes
// back to no one.
function ComputerSheet({ pc, count, onRename, onRemove, onClose }) {
  const [name, setName] = useState(pc.name);
  const [sure, setSure] = useState(false);
  return (
    <Sheet title={pc.name} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = name.trim();
          if (t && t !== pc.name) onRename(t);
          onClose();
        }}
      >
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Mac Studio, laptop, a chat…" autoFocus />
        </label>
        <p className="ascent-mini">The computer or chat working on what's in its column. The top card is what it's working on; the next is on deck.</p>
        {sure ? (
          <div className="tb-sure">
            <p className="today-hint">{count ? `Remove ${pc.name}? What's handed to it goes back to Not assigned.` : `Remove ${pc.name}?`}</p>
            <div className="ascent-sheet__actions">
              <button type="button" className="btn btn--sm" onClick={() => setSure(false)}>
                Keep it
              </button>
              <button
                type="button"
                className="btn btn--sm tb-sure__go"
                onClick={() => {
                  onRemove();
                  onClose();
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="ascent-sheet__actions">
            <button type="button" className="btn-link btn-link--danger" onClick={() => setSure(true)}>
              Remove
            </button>
            <span className="spacer" />
            <button type="submit" className="btn btn--accent">
              Save
            </button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
