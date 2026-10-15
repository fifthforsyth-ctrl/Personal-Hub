import { useEffect, useState } from "react";
import { Play, Square, Plus, X, Pencil, Clock, Trash2 } from "lucide-react";
import {
  fetchOpenTimeEntry,
  startTimeEntry,
  stopTimeEntry,
  switchTimer,
  goToBed,
  logPastTimeEntry,
  fetchTimeEntriesForDate,
  updateTimeEntry,
  deleteTimeEntry,
  fetchCategories,
  createCategory,
  archiveCategory,
  restoreCategory,
} from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { friendlyError } from "../lib/errors";
import { colorFor, familyFor, fmtMinutes, setCategoryColors, PALETTE } from "../lib/categories";
import { todayStr, parseDateStr, toDateStr } from "../lib/planDates";
import { useToast } from "./ui/Feedback";
import LoadError from "./ui/LoadError";
import { announceChange } from "./today/announce";
import { trackedMinutes, fmtElapsed, timeOf } from "./today/minutes";
import { useBackOnline } from "./today/useBackOnline";
import { isBedtime } from "./today/dayParts";
import BedButton from "./today/BedButton";
import StopFollowUp, { needsFollowUp, ClientPicker } from "./today/StopFollowUp";
import { isSleep, isNap, tagsOf, WASTE, TEMPLE } from "../lib/honest";

// Minutes: start a timer, log time after the fact, and fix what's logged.
//
// Built for one hand mid-day: big targets, no dropdowns in the fast path,
// nothing required beyond the thing you're actually recording. It opens from
// the capture sheet (today) and sits on the day page for any day. A past day
// has no timer to start, so there the form logs time onto that day, at the
// hour you give it.

async function loadMinutes(userId, date, isToday) {
  const [open, entries, categories] = await Promise.all([
    isToday ? fetchOpenTimeEntry(userId) : null,
    fetchTimeEntriesForDate(userId, date),
    fetchCategories(userId, { includeArchived: true }),
  ]);
  setCategoryColors(categories);
  return { open, entries: [...entries].sort((a, b) => a.started_at.localeCompare(b.started_at)), categories };
}

// "HH:MM" on the given day, as an ISO timestamp.
function atTime(date, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = parseDateStr(date);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function hhmm(d) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function shortDay(date) {
  return parseDateStr(date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// One tap, no category to pick: idle time logged as it happens, and a
// temple visit counted the moment you walk in.
const QUICK = [
  { key: "waste", label: "Waste", category: WASTE, description: null },
  { key: "temple", label: "Temple visit", category: TEMPLE, description: "Temple visit" },
];

export function MinutesView({ userId, date = todayStr() }) {
  const toast = useToast();
  const isToday = date === todayStr();
  const { data, error, loading, reload } = useLoad(() => loadMinutes(userId, date, isToday), [userId, date]);

  const [description, setDescription] = useState("");
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [deleted, setDeleted] = useState(() => new Set());
  const [stoppedId, setStoppedId] = useState(null);
  const [followUp, setFollowUp] = useState(null);

  // Anything logged elsewhere (Today's stop button, another sheet) shows here.
  useEffect(() => {
    window.addEventListener("hub:changed", reload);
    return () => window.removeEventListener("hub:changed", reload);
  }, [reload]);
  useBackOnline(reload, Boolean(error));

  const allCategories = data?.categories ?? [];
  const categories = allCategories.filter((c) => !c.archived);
  const hiddenCategories = allCategories.filter((c) => c.archived);
  const entries = (data?.entries ?? []).filter((e) => e.ended_at && !deleted.has(e.id));
  const open = data?.open && data.open.id !== stoppedId ? data.open : null;
  const quick = QUICK.filter((q) => categories.some((c) => c.name === q.category));
  const total = trackedMinutes(entries);
  const lastEnd = entries.length ? new Date(entries[entries.length - 1].ended_at) : null;

  // Every write goes through here: one at a time, a plain message if it
  // fails, and the pages that show minutes told once it lands.
  async function write(fn, fallback) {
    if (busy) return false;
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      announceChange();
      return true;
    } catch (err) {
      setActionError(friendlyError(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function toggleCategory(name) {
    setPicked((p) => (p.includes(name) ? p.filter((c) => c !== name) : [...p, name]));
  }

  async function start() {
    const ok = await write(() => startTimeEntry(userId, { categories: picked, description: description.trim() }), "Couldn't start the timer. Try again.");
    if (ok) {
      setDescription("");
      setPicked([]);
      setFollowUp(null);
    }
  }

  // Waste or a temple visit, in one tap. Whatever was running stops, and
  // can still be asked about.
  async function startQuick(q) {
    const id = open?.id;
    let stopped = null;
    const ok = await write(async () => {
      ({ stopped } = await switchTimer(userId, id, { categories: [q.category], description: q.description }));
    }, `Couldn't start ${q.label}. Try again.`);
    if (!ok) return;
    if (id) setStoppedId(id);
    setFollowUp(stopped && needsFollowUp(stopped) ? stopped : null);
    setDescription("");
    setPicked([]);
  }

  async function stop() {
    if (!open) return;
    const id = open.id;
    let stopped = null;
    if (await write(async () => (stopped = await stopTimeEntry(id)), "Couldn't stop the timer. Try again.")) {
      setStoppedId(id);
      if (needsFollowUp(stopped)) setFollowUp(stopped);
    }
  }

  // Stop whatever is running and start Sleep.
  async function bed() {
    const id = open?.id;
    if (await write(() => goToBed(userId, id), "Couldn't start Sleep. Try again.")) {
      if (id) setStoppedId(id);
      setFollowUp(null);
      await reload();
    }
  }

  function removeEntry(entry) {
    setDeleted((d) => new Set(d).add(entry.id));
    toast.undoable({
      message: "Entry deleted",
      run: async () => {
        await deleteTimeEntry(entry.id);
        announceChange();
      },
      onUndo: () =>
        setDeleted((d) => {
          const next = new Set(d);
          next.delete(entry.id);
          return next;
        }),
    });
  }

  if (!data) {
    return error ? <LoadError what="your minutes" error={error} onRetry={reload} /> : loading ? <p className="empty">Reading the minutes…</p> : null;
  }

  return (
    <div className="stack">
      {error && <LoadError what="your minutes" error={error} onRetry={reload} stale />}

      {followUp && followUp.id !== open?.id && <StopFollowUp key={followUp.id} userId={userId} entry={followUp} onClose={() => setFollowUp(null)} />}

      {open ? (
        <RunningCard
          entry={open}
          onStop={stop}
          onBed={isToday && isBedtime() && !isSleep(open) ? bed : null}
          switches={isSleep(open) ? [] : quick.filter((q) => !tagsOf(open).includes(q.category))}
          onSwitch={startQuick}
          busy={busy}
        />
      ) : (
        <div className="card">
          <div className="card-head">
            <span className="card-title">{isToday ? "Track" : `Log time on ${shortDay(date)}`}</span>
            {isToday && (
              <button className="btn-link minutes-link" onClick={() => setManualOpen((v) => !v)}>
                {manualOpen ? "Use the timer instead" : "Log past time"}
              </button>
            )}
          </div>

          {isToday && !manualOpen && quick.length > 0 && <QuickRow items={quick} onPick={startQuick} busy={busy} />}

          <input
            className="input input--lg"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isToday ? "What are you up to?" : "What was it?"}
            aria-label="Description"
            style={{ marginBottom: 12 }}
          />

          <CategoryGrid
            categories={categories}
            hidden={hiddenCategories}
            picked={picked}
            onToggle={toggleCategory}
            onAdd={(name, color) => write(() => createCategory(userId, { name, color }), "Couldn't add that category. Try again.")}
            onHide={async (cat) => {
              const ok = await write(() => archiveCategory(cat.id), `Couldn't hide ${cat.name}. Try again.`);
              if (ok) setPicked((p) => p.filter((c) => c !== cat.name));
              return ok;
            }}
            onRestore={(cat) => write(() => restoreCategory(cat.id), `Couldn't bring back ${cat.name}. Try again.`)}
          />

          {manualOpen || !isToday ? (
            <ManualEntry
              date={date}
              isToday={isToday}
              defaultStart={isToday ? null : lastEnd && toDateStr(lastEnd) === date ? hhmm(lastEnd) : "09:00"}
              picked={picked}
              busy={busy}
              onLog={async ({ minutes, startedAt }) => {
                const ok = await write(
                  () => logPastTimeEntry(userId, { categories: picked, description: description.trim(), minutes, startedAt }),
                  "Couldn't log that time. Try again."
                );
                if (ok) {
                  setManualOpen(false);
                  setDescription("");
                  setPicked([]);
                }
                return ok;
              }}
            />
          ) : (
            <button className="btn btn--accent btn--lg" onClick={start} disabled={busy || picked.length === 0}>
              <Play size={16} />
              {busy ? "Starting…" : "Start timer"}
            </button>
          )}
          {picked.length === 0 && <p className="minutes-hint">Pick at least one category.</p>}
          {isToday && isBedtime() && <BedButton onClick={bed} busy={busy} />}
        </div>
      )}

      {actionError && <div className="form-error">{actionError}</div>}

      {entries.length > 0 ? (
        <div className="card">
          <div className="card-head">
            <span className="card-title">{isToday ? "Today's timeline" : `Timeline · ${shortDay(date)}`}</span>
            <span className="mono muted" style={{ fontSize: 12 }} title="Tracked">{fmtMinutes(total)}</span>
          </div>
          <div className="list">
            {entries.map((e) => (
              <EntryRow key={e.id} userId={userId} entry={e} categories={categories} onDelete={() => removeEntry(e)} />
            ))}
          </div>
        </div>
      ) : (
        !open && <p className="empty">{isToday ? "Nothing logged yet today." : "Nothing logged that day."}</p>
      )}
    </div>
  );
}

// The one-tap starts, as a row of chips that each start their timer now.
function QuickRow({ items, onPick, busy, label }) {
  return (
    <div className="quick-track" role="group" aria-label={label ?? "Start in one tap"}>
      {label && <span className="quick-track__label">{label}</span>}
      {items.map((q) => (
        <button key={q.key} type="button" className="name-chip quick-track__chip" onClick={() => onPick(q)} disabled={busy} title={`Start ${q.label} now`}>
          <Play size={11} />
          {q.label}
        </button>
      ))}
    </div>
  );
}

function RunningCard({ entry, onStop, onBed, switches = [], onSwitch, busy }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, []);
  const tags = entry.tags?.length ? entry.tags : [entry.category];

  return (
    <div className="card card--accent">
      <div className="eyebrow" style={{ color: "var(--accent-text)" }}>Running since {timeOf(entry.started_at)}</div>
      <div className="running-card__elapsed">{fmtElapsed(entry.started_at)}</div>
      {entry.description && <div style={{ fontSize: 15, fontWeight: 570, marginBottom: 10 }}>{entry.description}</div>}
      <div className="row" style={{ flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
        {tags.map((t) => (
          <TagChip key={t} tag={t} />
        ))}
      </div>
      <button className="btn btn--accent btn--lg" onClick={onStop} disabled={busy}>
        {!isSleep(entry) && <Square size={14} />}
        {busy ? "Stopping…" : isSleep(entry) ? "I'm up" : "Stop timer"}
      </button>
      {onBed && <BedButton onClick={onBed} busy={busy} />}
      {switches.length > 0 && <QuickRow items={switches} onPick={onSwitch} busy={busy} label="Switch to" />}
    </div>
  );
}

// A grid of toggles, each big enough to hit without aiming. The list is yours
// to change; hiding a category keeps it on every entry that already has it,
// so months of history keep meaning what they meant, and it can come back.
function CategoryGrid({ categories, hidden, picked, onToggle, onAdd, onHide, onRestore }) {
  const [managing, setManaging] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);

  async function submitNew(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (await onAdd(name, newColor)) {
      setNewName("");
      setNewColor(PALETTE[(PALETTE.indexOf(newColor) + 1) % PALETTE.length]);
    }
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="row row--between" style={{ marginBottom: 8 }}>
        <span className="eyebrow">Categories · pick any that overlap</span>
        <button
          className="btn-link minutes-link"
          onClick={() => {
            setManaging((v) => !v);
            setConfirming(null);
          }}
        >
          {managing ? "Done" : "Edit"}
        </button>
      </div>

      <div className="cat-grid">
        {categories.map((cat) => {
          const on = picked.includes(cat.name) && !managing;
          return (
            <div key={cat.id} className="cat-cell">
              <button
                type="button"
                className={"cat-toggle" + (on ? " cat-toggle--on" : "") + (managing ? " cat-toggle--managing" : "")}
                onClick={() => !managing && onToggle(cat.name)}
                aria-pressed={managing ? undefined : on}
                style={on ? { borderColor: cat.color, background: `${cat.color}22` } : undefined}
              >
                <span className="dot" style={{ background: cat.color, opacity: on || managing ? 1 : 0.5 }} />
                <span className="truncate">{cat.name}</span>
              </button>
              {managing && (
                <button
                  type="button"
                  className="cat-hide"
                  onClick={() => setConfirming(cat)}
                  aria-label={`Hide ${cat.name}`}
                  title={`Hide ${cat.name}`}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {confirming && (
        <div className="cat-confirm" role="alertdialog" aria-label={`Hide ${confirming.name}?`}>
          <span>
            Hide <strong>{confirming.name}</strong> from the picker? Past entries keep it.
          </span>
          <span className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn--sm" onClick={() => setConfirming(null)}>Cancel</button>
            <button
              type="button"
              className="btn btn--sm btn--danger-solid"
              onClick={async () => {
                if (await onHide(confirming)) setConfirming(null);
              }}
            >
              Hide
            </button>
          </span>
        </div>
      )}

      {managing && (
        <>
          <form onSubmit={submitNew} className="row" style={{ gap: 6, marginTop: 10 }}>
            <button
              type="button"
              className="btn-icon btn-icon--bordered"
              onClick={() => setNewColor(PALETTE[(PALETTE.indexOf(newColor) + 1) % PALETTE.length])}
              aria-label="Change the new category's colour"
              title="Change colour"
              style={{ width: 40, height: 40 }}
            >
              <span className="dot" style={{ background: newColor, width: 14, height: 14 }} />
            </button>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New category" aria-label="New category name" />
            <button type="submit" className="btn" disabled={!newName.trim()} style={{ flexShrink: 0 }}>
              <Plus size={14} />
              Add category
            </button>
          </form>

          {hidden.length > 0 && (
            <div className="cat-hidden">
              <div className="eyebrow" style={{ marginBottom: 6 }}>Hidden categories</div>
              {hidden.map((cat) => (
                <div key={cat.id} className="cat-hidden__row">
                  <span className="dot" style={{ background: cat.color }} />
                  <span className="truncate" style={{ flex: 1 }}>{cat.name}</span>
                  <button type="button" className="btn btn--sm" onClick={() => onRestore(cat)}>Bring back</button>
                </div>
              ))}
            </div>
          )}
          <p className="muted" style={{ fontSize: 12, margin: "10px 0 0", lineHeight: 1.5 }}>
            Hiding a category takes it out of this picker. Past entries keep it, so your history stays accurate.
          </p>
        </>
      )}
    </div>
  );
}

// Time logged after the fact. Today it ends now unless you say when it
// started; on a past day it starts at the hour given (after the last entry,
// to begin with, so filling in a day goes in order).
function ManualEntry({ date, isToday, defaultStart, picked, busy, onLog }) {
  const [minutes, setMinutes] = useState("30");
  const [start, setStart] = useState(defaultStart);
  const [error, setError] = useState(null);
  const n = Number(minutes);
  const shownStart = start ?? hhmm(new Date(Date.now() - (n > 0 ? n : 0) * 60000));

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!n || n <= 0 || picked.length === 0 || busy) return;
    const startedAt = start ? atTime(date, start) : null;
    if (isToday && startedAt && new Date(startedAt).getTime() + n * 60000 > Date.now() + 60000) {
      setError("That would end after now. Start it earlier or make it shorter.");
      return;
    }
    if (await onLog({ minutes: n, startedAt })) setMinutes("30");
  }

  return (
    <form onSubmit={submit}>
      <div className="manual-entry">
        <label className="manual-entry__field">
          <span>Minutes</span>
          <input className="input input--lg" type="number" inputMode="numeric" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
        <label className="manual-entry__field">
          <span>Started at</span>
          <input className="input input--lg" type="time" value={shownStart} onChange={(e) => setStart(e.target.value || null)} required={!isToday} />
        </label>
      </div>
      {error && <div className="form-error" style={{ marginBottom: 10 }}>{error}</div>}
      <button type="submit" className="btn btn--accent btn--lg" disabled={busy || picked.length === 0 || !(n > 0)}>
        <Clock size={15} />
        {busy ? "Logging…" : `Log ${n > 0 ? fmtMinutes(n) : "time"}`}
      </button>
    </form>
  );
}

function EntryRow({ userId, entry, categories, onDelete }) {
  const [editing, setEditing] = useState(false);
  const tags = entry.tags?.length ? entry.tags : [entry.category];
  const name = entry.description || (isNap(entry) ? "Nap" : "Untitled");

  if (editing) return <EntryEditor userId={userId} entry={entry} tags={tags} categories={categories} onDone={() => setEditing(false)} />;

  return (
    <div className="entry-row-x">
      <div className="row row--between" style={{ alignItems: "center", gap: 6 }}>
        <span className="truncate" style={{ fontSize: 13.5, fontWeight: 570, flex: 1 }}>{name}</span>
        <span className="mono" style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600, flexShrink: 0 }}>{fmtMinutes(entry.duration_minutes)}</span>
        <button className="btn-icon entry-row-x__action" onClick={() => setEditing(true)} aria-label={`Edit ${entry.description || "this entry"}`} title="Edit">
          <Pencil size={14} />
        </button>
        <button className="btn-icon entry-row-x__action" onClick={onDelete} aria-label={`Delete ${entry.description || "this entry"}`} title="Delete">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="row" style={{ gap: 5, flexWrap: "wrap", marginTop: 2 }}>
        <span className="list-row__meta">
          {timeOf(entry.started_at)}–{timeOf(entry.ended_at)}
        </span>
        {tags.map((t) => (
          <TagChip key={t} tag={t} />
        ))}
        {entry.client && <span className="list-row__meta">· {entry.client}</span>}
      </div>
    </div>
  );
}

// Everything about an entry can be fixed: what it was, when it started, how
// long it ran, which categories it counts toward, and for work, who it was
// for.
function EntryEditor({ userId, entry, tags, categories, onDone }) {
  const started = new Date(entry.started_at);
  const day = toDateStr(started);
  const [desc, setDesc] = useState(entry.description ?? "");
  const [mins, setMins] = useState(String(Math.round(Number(entry.duration_minutes) || 0)));
  const [start, setStart] = useState(hhmm(started));
  const [chosen, setChosen] = useState(tags);
  const [client, setClient] = useState(entry.client ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Categories that have since been hidden still show here while the entry has them.
  const options = [...categories.map((c) => c.name), ...tags.filter((t) => !categories.some((c) => c.name === t))];
  const isWork = chosen.some((c) => familyFor(c) === "Work");

  async function save(e) {
    e.preventDefault();
    const n = Number(mins);
    if (!n || n <= 0 || chosen.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    const startedAt = atTime(day, start);
    try {
      await updateTimeEntry(entry.id, {
        description: desc.trim() || null,
        started_at: startedAt,
        ended_at: new Date(new Date(startedAt).getTime() + n * 60000).toISOString(),
        tags: chosen,
        category: chosen[0],
        client: isWork ? client : null,
      });
      announceChange();
      onDone();
    } catch (err) {
      setError(friendlyError(err, "Couldn't save that. Try again."));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="entry-editor">
      <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" aria-label="Description" autoFocus />
      <div className="manual-entry">
        <label className="manual-entry__field">
          <span>Started at</span>
          <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <label className="manual-entry__field">
          <span>Minutes</span>
          <input className="input" type="number" inputMode="numeric" min="1" value={mins} onChange={(e) => setMins(e.target.value)} />
        </label>
      </div>
      <div className="entry-editor__cats">
        {options.map((name) => {
          const on = chosen.includes(name);
          return (
            <button
              key={name}
              type="button"
              className={"name-chip" + (on ? " name-chip--on" : "")}
              aria-pressed={on}
              onClick={() => setChosen((c) => (on ? c.filter((x) => x !== name) : [...c, name]))}
            >
              <span className="dot" style={{ background: colorFor(name), width: 6, height: 6 }} />
              {name}
            </button>
          );
        })}
      </div>
      {chosen.length === 0 && <p className="minutes-hint">Pick at least one category.</p>}
      {isWork && (
        <div>
          <div className="honest-label" style={{ marginTop: 0 }}>For <span className="faint">(optional)</span></div>
          <ClientPicker
            userId={userId}
            entry={entry}
            value={client}
            onPick={(name) => setClient((c) => (c?.toLowerCase() === name.toLowerCase() ? null : name))}
          />
        </div>
      )}
      {error && <div className="form-error">{error}</div>}
      <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button type="submit" className="btn btn--accent" disabled={busy || chosen.length === 0}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

export function TagChip({ tag }) {
  return (
    <span
      className="chip"
      style={{ borderColor: `${colorFor(tag)}55`, background: `${colorFor(tag)}1a`, color: "var(--text)", fontSize: 10.5, padding: "3px 8px" }}
    >
      <span className="dot" style={{ background: colorFor(tag), width: 6, height: 6 }} />
      {tag}
    </span>
  );
}
