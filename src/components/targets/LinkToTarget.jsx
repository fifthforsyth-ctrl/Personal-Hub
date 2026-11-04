import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Check, ChevronRight, Link2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import Sheet from "../ascent/Sheet";
import { useLoad } from "../../lib/useLoad";
import { fetchLadderTargets, fetchLinksForQuote, fetchQuoteLinkRows, linkQuote, relinkQuotes, unlinkQuote } from "../../lib/api";
import { KIND_NAME, MISSION_KEY, ladderOf, pathOf, refOf } from "../../lib/ladder";
import { buildAscent } from "../../lib/ascent";
import { focusWeekOf, lineageIds } from "../../lib/focus";
import { subtreeIds } from "../../lib/wheel";
import { shortTarget } from "../../lib/mark";
import { fmtShortDate, todayStr } from "../../lib/planDates";
import { announceChange } from "../today/announce";
import "../../styles/targets.css";

// "Link" on a quote, wherever he reads it (the Board's prints, Today's
// quote): one tap opens the whole ladder, the mission down to this week's
// focus, and a tap on any of them links the quote to it, or takes it off.
// The target's own page shows the quote from then on.
//
// The button says "Linked · 2" once the quote is on two targets. Nothing
// about the targets is read until the sheet opens; the count comes from one
// light read of his links that every button on the page shares.

// --- What can be linked to (pure, tested in scripts/test.mjs) ------------------

// The groups of the sheet, biggest to smallest, then anything the quote is
// on that isn't on now (a finished quest, an earlier week's focus).
export const LINK_GROUPS = [
  { key: "mission", title: "My mission" },
  { key: "goals", title: "Lifetime goals" },
  { key: "climbs", title: "Quests and lessons" },
  { key: "focus", title: "This week's focus" },
  { key: "other", title: "Not on right now" },
];

// The targets a quote can be linked to now, in ladder order, from what
// fetchLadderTargets read:
//   [{ kind, id, key, title, short, group, line?, lineage? }]
// The mission (always, written or not), the lifetime goals in the Range's
// order, the quests he's on, the lessons he's learning, then this week's
// focus. A focus carries its earlier weeks (`lineage`), so a quote linked
// to it last week still shows as linked, and a lifetime goal the goals
// under it.
export function ladderTargets(rows, today) {
  const statement = String(rows?.mission?.statement ?? "").trim();
  const lessons = (rows?.lessons ?? []).map((l) => ({ ...l, started_on: l.started_on ?? today }));
  const view = buildAscent({ mission: rows?.mission ?? null, goals: rows?.goals ?? [], quests: rows?.quests ?? [], lessons }, today);
  const allFocus = rows?.focusGoals ?? [];
  const week = focusWeekOf(today);
  const tiers = ladderOf({ view, focusGoals: allFocus.filter((f) => f.week_start === week) });
  return [
    {
      kind: "mission",
      id: null,
      key: MISSION_KEY,
      title: statement || KIND_NAME.mission,
      short: KIND_NAME.mission,
      group: "mission",
      line: statement ? null : "Not written yet",
      serif: Boolean(statement),
    },
    // A lifetime goal takes in the goals under it on the wheel, as its page
    // does (one moved under it brings its links along).
    ...tiers.goals.map((g) => ({ kind: "goal", id: g.key, key: g.key, title: g.title, short: g.short, group: "goals", lineage: [...subtreeIds(rows?.edges ?? [], g.key)] })),
    ...tiers.climbs.map((c) => ({ kind: c.kind, id: c.key, key: c.key, title: c.title, short: c.short, group: "climbs", line: KIND_NAME[c.kind] })),
    ...tiers.focuses.map((f) => ({ kind: "focus", id: f.key, key: f.key, title: f.title, short: f.title, group: "focus", lineage: lineageIds(f.goal, allFocus) })),
  ];
}

// Whether a link row is on a target (a focus by any week of its line, a
// lifetime goal by any goal under it).
export function linkIsOn(link, target) {
  if (!link || !target) return false;
  if (target.kind === "mission") return Boolean(link.mission);
  if (target.kind === "goal") return Boolean(link.goal_id) && (target.lineage ?? [target.id]).includes(link.goal_id);
  if (target.kind === "quest") return Boolean(link.quest_id) && link.quest_id === target.id;
  if (target.kind === "lesson") return Boolean(link.lesson_id) && link.lesson_id === target.id;
  if (target.kind === "focus") return Boolean(link.focus_goal_id) && (target.lineage ?? [target.id]).includes(link.focus_goal_id);
  return false;
}

const STATE_WORD = { done: "done", set_aside: "set aside", learned: "learned" };

// The targets a quote is on that aren't offered now, named from what
// fetchLinksForQuote brought along, so they can be seen and taken off.
export function otherTargets(links, targets) {
  const out = new Map();
  for (const l of links ?? []) {
    if ((targets ?? []).some((t) => linkIsOn(l, t))) continue;
    const t = elsewhere(l);
    if (t && !out.has(t.key)) out.set(t.key, t);
  }
  return [...out.values()];
}

function elsewhere(l) {
  const other = (kind, id, title, line) => ({ kind, id, key: id, title, short: kind === "focus" ? title : shortTarget(kind, title), group: "other", line });
  if (l.goal_id) return other("goal", l.goal_id, l.goal?.title || "A goal", "Goal");
  if (l.quest_id) {
    const s = STATE_WORD[l.quest?.status];
    return other("quest", l.quest_id, l.quest?.title || "A quest", s ? `Quest · ${s}` : "Quest");
  }
  if (l.lesson_id) {
    const s = STATE_WORD[l.lesson?.status];
    return other("lesson", l.lesson_id, l.lesson?.title || "A lesson", s ? `${KIND_NAME.lesson} · ${s}` : KIND_NAME.lesson);
  }
  if (l.focus_goal_id) {
    const week = l.focus?.week_start;
    return { ...other("focus", l.focus_goal_id, l.focus?.title || "A focus", week ? `Focus · week of ${fmtShortDate(week)}` : "Focus"), lineage: [l.focus_goal_id] };
  }
  return null; // the mission is always offered
}

// Each target's link rows for this quote: Map key → [link id].
export function linkIdsByTarget(targets, links) {
  const out = new Map((targets ?? []).map((t) => [t.key, []]));
  for (const l of links ?? []) {
    const t = (targets ?? []).find((x) => linkIsOn(l, x));
    if (t) out.get(t.key).push(l.id);
  }
  return out;
}

// How many targets a quote's links are on.
export function targetCount(links) {
  const on = new Set();
  for (const l of links ?? []) {
    const k = l?.mission ? MISSION_KEY : l?.goal_id ?? l?.quest_id ?? l?.lesson_id ?? l?.focus_goal_id;
    if (k) on.add(k);
  }
  return on.size;
}

// What the button says to a screen reader, and on a long press: on a
// narrow print a linked quote's button shows only its link and the count.
export function linkName(count) {
  if (!(count > 0)) return "Link to a target";
  return `Linked to ${count} ${count === 1 ? "target" : "targets"}`;
}

// The sheet's groups in order, empty ones left out.
export function groupTargets(targets) {
  return LINK_GROUPS.map((g) => ({ ...g, items: (targets ?? []).filter((t) => t.group === g.key) })).filter((g) => g.items.length);
}

// --- His links, shared by every Link button on the page ------------------------
//
// One read of his links when a page with prints opens (and again when
// something changes elsewhere), so each print can say "Linked · 2" without
// a read of its own. The sheet reads its quote's links afresh when it opens
// and puts them back here, so every print of that quote (it can be in the
// picks and on the cork at once) changes together.

const links = {
  userId: null,
  rows: [],
  version: 0,
  listeners: new Set(),
  reading: false,
  again: false,
  touched: new Set(), // quotes changed here since the read went out: theirs stay
  busy: new Set(), // "<quote>" or "<quote>><target>" with a write out
  writes: 0,
  dirty: false, // a write landed since the last announcement
  sheets: 0,
  announcing: false,
};

function sourceKey(source) {
  return source?.quoteId ? `q:${source.quoteId}` : `n:${source?.noteId ?? ""}`;
}

function rowSource(row) {
  return row?.quote_id ? `q:${row.quote_id}` : `n:${row?.note_id ?? ""}`;
}

function emit() {
  links.version += 1;
  for (const fn of [...links.listeners]) fn();
}

function busySources() {
  return [...links.busy].map((b) => b.split(">")[0]);
}

async function readAll() {
  const userId = links.userId;
  if (!userId) return;
  if (links.reading) {
    links.again = true;
    return;
  }
  links.reading = true;
  links.touched = new Set(busySources());
  try {
    const rows = await fetchQuoteLinkRows(userId);
    if (links.userId === userId) {
      const keep = new Set([...links.touched, ...busySources()]);
      links.rows = [...rows.filter((r) => !keep.has(rowSource(r))), ...links.rows.filter((r) => keep.has(rowSource(r)))];
      emit();
    }
  } catch (err) {
    // Quiet: the button just says "Link", and the sheet says what's wrong.
    console.warn(err);
  } finally {
    links.reading = false;
    if (links.again) {
      links.again = false;
      readAll();
    }
  }
}

// A change made somewhere else; not the one this file just announced.
function onElsewhere() {
  if (!links.announcing) readAll();
}

function subscribeAs(userId) {
  return (fn) => {
    if (links.userId !== userId) {
      links.userId = userId;
      links.rows = [];
    }
    links.listeners.add(fn);
    if (links.listeners.size === 1) {
      window.addEventListener("hub:changed", onElsewhere);
      readAll();
    }
    return () => {
      links.listeners.delete(fn);
      if (!links.listeners.size) window.removeEventListener("hub:changed", onElsewhere);
    };
  };
}

const versionOf = () => links.version;

// One quote's links, kept current.
function useQuoteLinks(userId, source) {
  const subscribe = useMemo(() => subscribeAs(userId), [userId]);
  const version = useSyncExternalStore(subscribe, versionOf, versionOf);
  const key = sourceKey(source);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => links.rows.filter((r) => rowSource(r) === key), [key, version]);
}

function setRowsFor(key, next) {
  const had = links.rows.filter((r) => rowSource(r) === key);
  const now = typeof next === "function" ? next(had) : next;
  links.rows = [...links.rows.filter((r) => rowSource(r) !== key), ...(now ?? [])];
  links.touched.add(key);
  emit();
}

function setBusy(marks, on) {
  for (const m of marks) {
    if (on) links.busy.add(m);
    else links.busy.delete(m);
  }
  emit();
}

// Every page that shows targets hears about a change once, when the sheet
// has closed and its writes have landed: Today reloads all it shows on
// hub:changed, so a few taps here make it reload once, not once a tap.
function track(promise) {
  links.writes += 1;
  return promise
    .then((value) => {
      links.dirty = true;
      return value;
    })
    .finally(() => {
      links.writes -= 1;
      settle();
    });
}

function settle() {
  if (links.sheets || links.writes || !links.dirty) return;
  links.dirty = false;
  links.announcing = true;
  try {
    announceChange();
  } finally {
    links.announcing = false;
  }
}

// A link row as it will be, before the database has answered.
function linkRowFor(target, source, id) {
  const base = { id, quote_id: source.quoteId ?? null, note_id: source.quoteId ? null : source.noteId ?? null, mission: false, goal_id: null, quest_id: null, lesson_id: null, focus_goal_id: null };
  return { ...base, ...refOf(target) };
}

const isTemp = (id) => String(id).startsWith("new:");

// Unlink's Undo: the rows back as they were. It can run after the sheet has
// closed, so it works on the shared links, not the sheet.
async function putBack(userId, source, gone, toast) {
  const key = sourceKey(source);
  const ids = new Set(gone.map((r) => r.id));
  setBusy([key], true);
  setRowsFor(key, (rows) => [...rows.filter((r) => !ids.has(r.id)), ...gone]);
  try {
    await track(relinkQuotes(gone));
  } catch (err) {
    setRowsFor(key, (rows) => rows.filter((r) => !ids.has(r.id)));
    toast.error(err, "Couldn't put the link back.");
    setBusy([key], false);
    return;
  }
  try {
    setRowsFor(key, await fetchLinksForQuote(userId, source));
  } catch (err) {
    console.warn(err); // it's back; the next read will have its ids
  } finally {
    setBusy([key], false);
  }
}

// --- The button --------------------------------------------------------------------

// `className` matches the buttons beside it: the print's foot by default,
// Today's card passes its own.
export default function LinkToTarget({ quote, className = "qprint__save qprint__link" }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [open, setOpen] = useState(false);
  const source = useMemo(() => ({ quoteId: quote?.id ?? null }), [quote?.id]);
  const rows = useQuoteLinks(userId, source);
  const count = targetCount(rows);

  if (!quote?.id || !userId) return null;

  return (
    <>
      <button
        type="button"
        className={`${className}${count ? " is-linked" : ""}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={linkName(count)}
        title={linkName(count)}
      >
        <Link2 size={13} aria-hidden="true" />
        {count ? (
          <>
            <span className="link-to__word">Linked · </span>
            {count}
          </>
        ) : (
          "Link"
        )}
      </button>
      {/* On the body, so a tilted print doesn't carry the sheet with it. */}
      {open && createPortal(<LinkSheet userId={userId} quote={quote} source={source} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

// --- The sheet ---------------------------------------------------------------------

function LinkSheet({ userId, quote, source, onClose }) {
  const toast = useToast();
  const key = sourceKey(source);
  const today = todayStr();
  const load = useLoad(async () => {
    const [ladder, mine] = await Promise.all([fetchLadderTargets(userId), fetchLinksForQuote(userId, source)]);
    return { ladder, mine };
  }, [userId, key]);
  const rows = useQuoteLinks(userId, source);

  // The sheet's own read is the freshest: every print of this quote takes it.
  useEffect(() => {
    if (load.data) setRowsFor(key, load.data.mine);
  }, [load.data, key]);

  // Announce once the sheet is closed (see track).
  useEffect(() => {
    links.sheets += 1;
    return () => {
      links.sheets -= 1;
      settle();
    };
  }, []);

  const targets = useMemo(() => (load.data ? ladderTargets(load.data.ladder, today) : []), [load.data, today]);
  // What it's on that isn't on now stays listed while the sheet is open,
  // so taking one off doesn't make the row vanish under his thumb.
  const others = useMemo(() => (load.data ? otherTargets(load.data.mine, targets) : []), [load.data, targets]);
  const all = useMemo(() => [...targets, ...others], [targets, others]);
  const byTarget = useMemo(() => linkIdsByTarget(all, rows), [all, rows]);
  const groups = useMemo(() => groupTargets(all), [all]);

  const busy = (t) => links.busy.has(key) || links.busy.has(`${key}>${t.key}`);

  async function idsFor(t) {
    const ids = byTarget.get(t.key) ?? [];
    if (!ids.some(isTemp)) return ids;
    // Linked a moment ago from its own page: read the ids Unlink needs.
    const fresh = await fetchLinksForQuote(userId, source);
    setRowsFor(key, fresh);
    return fresh.filter((l) => linkIsOn(l, t)).map((l) => l.id);
  }

  async function toggle(t) {
    if (busy(t)) return;
    const mark = `${key}>${t.key}`;
    const on = (byTarget.get(t.key) ?? []).length > 0;
    setBusy([mark], true);
    try {
      if (on) await unlink(t);
      else await link(t);
    } finally {
      setBusy([mark], false);
    }
  }

  async function link(t) {
    const temp = linkRowFor(t, source, `new:${t.key}`);
    setRowsFor(key, (rs) => [...rs, temp]);
    let row;
    try {
      row = await track(linkQuote(userId, refOf(t), source));
    } catch (err) {
      setRowsFor(key, (rs) => rs.filter((r) => r.id !== temp.id));
      toast.error(err, "Couldn't link it.");
      return;
    }
    if (row) {
      setRowsFor(key, (rs) => rs.map((r) => (r.id === temp.id ? row : r)));
      return;
    }
    // It was linked already (from its page, a moment ago). It stays
    // checked; read its ids so Unlink can find them.
    try {
      setRowsFor(key, await fetchLinksForQuote(userId, source));
    } catch (err) {
      console.warn(err);
    }
  }

  async function unlink(t) {
    let ids;
    try {
      ids = await idsFor(t);
    } catch (err) {
      toast.error(err, "Couldn't unlink it.");
      return;
    }
    if (!ids.length) return;
    const before = links.rows.filter((r) => rowSource(r) === key && ids.includes(r.id));
    setRowsFor(key, (rs) => rs.filter((r) => !ids.includes(r.id)));
    let gone;
    try {
      gone = await track(unlinkQuote(ids));
    } catch (err) {
      setRowsFor(key, (rs) => [...rs.filter((r) => !ids.includes(r.id)), ...before]);
      toast.error(err, "Couldn't unlink it.");
      return;
    }
    if (!gone.length) return;
    toast.show(`Unlinked from ${t.short}.`, { actionLabel: "Undo", onAction: () => putBack(userId, source, gone, toast) });
  }

  return (
    <Sheet title="Link to a target" onClose={onClose}>
      <figure className="link-to__quote">
        <blockquote className="link-to__words">{quote.text}</blockquote>
        {quote.author && <figcaption className="link-to__by">{quote.author}</figcaption>}
      </figure>

      {load.loading ? (
        <p className="empty">Loading your targets…</p>
      ) : !load.data ? (
        <LoadError what="your targets" error={load.error} onRetry={load.reload} />
      ) : (
        groups.map((g) => (
          <section key={g.key} className="link-to__group" aria-labelledby={`link-to-${g.key}`}>
            <h3 className="eyebrow link-to__eyebrow" id={`link-to-${g.key}`}>
              {g.title}
            </h3>
            <ul className="link-to__list">
              {g.items.map((t) => {
                const on = (byTarget.get(t.key) ?? []).length > 0;
                return (
                  <li key={t.key} className={"link-to__row" + (on ? " is-on" : "")}>
                    <button type="button" className="link-to__toggle" aria-pressed={on} disabled={busy(t)} onClick={() => toggle(t)}>
                      <span className="link-to__check" aria-hidden="true">
                        {on && <Check size={14} strokeWidth={3} />}
                      </span>
                      <span className="link-to__name">
                        <span className={"link-to__title" + (t.serif ? " is-serif" : "")}>{t.title}</span>
                        {t.line && <span className="link-to__line">{t.line}</span>}
                      </span>
                    </button>
                    <Link className="link-to__open" to={pathOf(t.kind, t.key)} aria-label={`Open ${t.short}`} title={`Open ${t.short}`}>
                      <ChevronRight size={17} aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <div className="link-to__foot">
        <button type="button" className="btn btn--accent" onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  );
}
