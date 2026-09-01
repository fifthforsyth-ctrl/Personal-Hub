import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, Plus, Minus, HandHeart, Flame, X, Pencil, Clock, Check } from "lucide-react";
import {
  fetchOpenTimeEntry,
  startTimeEntry,
  stopTimeEntry,
  logPastTimeEntry,
  fetchTimeEntries,
  updateTimeEntry,
  deleteTimeEntry,
  logWinLoss,
  fetchWinLosses,
  deleteWinLoss,
  logPrayerWithRefs,
  fetchPrayers,
  logExperience,
  fetchExperiences,
  fetchCategories,
  createCategory,
  archiveCategory,
} from "../lib/api";
import { colorFor, fmtMinutes, setCategoryColors, PALETTE } from "../lib/categories";

export const CAPTURE_VIEWS = ["Minutes", "Wins", "Spirit"];

function todayStartISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function timeOf(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// The capture surface — the thing a phone opens to. Everything here is built
// for one hand mid-day: big targets, no dropdowns in the fast path, nothing
// required beyond the thing you're actually recording.
//
// It lives in components/ rather than pages/ because it appears twice: as the
// whole of the phone home screen, and as a panel inside the desktop day card.
export default function Capture({ userId, view, onViewChange, compact = false }) {
  const [internal, setInternal] = useState("Minutes");
  const active = view ?? internal;
  const setActive = onViewChange ?? setInternal;

  return (
    <div className="stack">
      <div className="seg seg--block">
        {CAPTURE_VIEWS.map((v) => (
          <button key={v} className={"seg-btn" + (active === v ? " active" : "")} onClick={() => setActive(v)}>
            {v}
          </button>
        ))}
      </div>

      {active === "Minutes" && <MinutesView userId={userId} compact={compact} />}
      {active === "Wins" && <WinsView userId={userId} />}
      {active === "Spirit" && <SpiritView userId={userId} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Minutes
// ---------------------------------------------------------------------------

export function MinutesView({ userId, compact = false, onChanged }) {
  const [open, setOpen] = useState(null);
  const [entries, setEntries] = useState([]);
  const [description, setDescription] = useState("");
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [categories, setCategories] = useState([]);

  const reload = useCallback(async () => {
    if (!userId) return;
    const [o, list, cats] = await Promise.all([
      fetchOpenTimeEntry(userId),
      fetchTimeEntries(userId, { sinceISO: todayStartISO(), limit: 200 }),
      fetchCategories(userId),
    ]);
    setOpen(o);
    setEntries(list.filter((e) => e.ended_at));
    setCategories(cats);
    setCategoryColors(cats);
    onChanged?.();
  }, [userId, onChanged]);

  useEffect(() => {
    reload();
  }, [reload]);

  function toggleCategory(cat) {
    setPicked((p) => (p.includes(cat) ? p.filter((c) => c !== cat) : [...p, cat]));
  }

  async function guard(fn) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  const handleStart = () =>
    guard(async () => {
      await startTimeEntry(userId, { categories: picked, description: description.trim() });
      setDescription("");
      setPicked([]);
    });

  // Totals credit every tag on an entry, matching how the categories are
  // actually used — an activity that is both Serve and Minister counts fully
  // toward each, so these deliberately sum past the wall clock.
  const { byCategory, totalMinutes } = useMemo(() => {
    const totals = new Map();
    let total = 0;
    for (const e of entries) {
      const mins = Number(e.duration_minutes) || 0;
      total += mins;
      const tags = e.tags?.length ? e.tags : [e.category];
      for (const t of tags) totals.set(t, (totals.get(t) ?? 0) + mins);
    }
    return {
      byCategory: [...totals.entries()]
        .map(([c, m]) => ({ category: c, minutes: m }))
        .sort((a, b) => b.minutes - a.minutes),
      totalMinutes: total,
    };
  }, [entries]);

  return (
    <div className="stack">
      {/* The headline the phone opens to: how much of today is accounted for. */}
      {!compact && (
        <div className="card">
          <div className="eyebrow">Tracked today</div>
          <div style={{ fontSize: 40, fontWeight: 660, letterSpacing: "-0.035em", lineHeight: 1.05, margin: "4px 0 2px", fontVariantNumeric: "tabular-nums" }}>
            {fmtMinutes(totalMinutes)}
          </div>
          <div className="faint" style={{ fontSize: 12 }}>
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
            {byCategory.length > 0 ? ` · mostly ${byCategory[0].category}` : ""}
          </div>
          {byCategory.length > 0 && (
            <div className="time-strip time-strip--tall" style={{ marginTop: 14 }}>
              {byCategory.map((r) => (
                <i
                  key={r.category}
                  title={`${r.category} · ${fmtMinutes(r.minutes)}`}
                  style={{ width: `${(r.minutes / Math.max(totalMinutes, 1)) * 100}%`, background: colorFor(r.category) }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {open ? (
        <RunningCard entry={open} onStop={() => guard(() => stopTimeEntry(open.id))} busy={busy} />
      ) : (
        <div className="card">
          <div className="card-head">
            <span className="card-title">Track</span>
            <button className="btn-link" onClick={() => setManualOpen((v) => !v)}>
              {manualOpen ? "Cancel" : "+ Log past time"}
            </button>
          </div>

          <input
            className="input input--lg"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What are you up to?"
            style={{ marginBottom: 12 }}
          />

          <CategoryGrid
            categories={categories}
            picked={picked}
            onToggle={toggleCategory}
            onAdd={(name, color) => guard(() => createCategory(userId, { name, color }))}
            onArchive={(id) =>
              guard(async () => {
                await archiveCategory(id);
                setPicked((p) => p.filter((c) => c !== categories.find((x) => x.id === id)?.name));
              })
            }
          />

          {manualOpen ? (
            <ManualEntry
              userId={userId}
              description={description}
              picked={picked}
              onDone={async () => {
                setManualOpen(false);
                setDescription("");
                setPicked([]);
                await reload();
              }}
            />
          ) : (
            <button className="btn btn--accent btn--lg" onClick={handleStart} disabled={busy || picked.length === 0}>
              <Play size={16} />
              Start timer
            </button>
          )}
        </div>
      )}

      {entries.length > 0 && (
        <div className="card">
          <div className="card-head">
            <span className="card-title">Today's timeline</span>
            <span className="mono faint" style={{ fontSize: 11.5 }}>{fmtMinutes(totalMinutes)}</span>
          </div>
          <div className="list">
            {entries.map((e) => (
              <EntryRow key={e.id} entry={e} onChanged={reload} />
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 && !open && <p className="empty">Nothing logged yet today.</p>}
    </div>
  );
}

function RunningCard({ entry, onStop, busy }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const secs = Math.max(0, Math.floor((Date.now() - new Date(entry.started_at).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const elapsed = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  const tags = entry.tags?.length ? entry.tags : [entry.category];

  return (
    <div className="card card--accent">
      <div className="eyebrow" style={{ color: "var(--accent)" }}>Running since {timeOf(entry.started_at)}</div>
      <div className="mono" style={{ fontSize: 44, fontWeight: 600, lineHeight: 1.1, margin: "6px 0 4px", letterSpacing: "-0.03em" }}>
        {elapsed}
      </div>
      {entry.description && <div style={{ fontSize: 15, fontWeight: 570, marginBottom: 10 }}>{entry.description}</div>}
      <div className="row" style={{ flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
        {tags.map((t) => (
          <TagChip key={t} tag={t} />
        ))}
      </div>
      <button className="btn btn--lg" onClick={onStop} disabled={busy} style={{ background: "var(--danger)", borderColor: "var(--danger)", color: "#fff" }}>
        <Square size={15} />
        Stop &amp; log
      </button>
    </div>
  );
}

// A grid of toggles, each big enough to hit without aiming. The list is yours
// to change; removal archives rather than deletes, so months of history keep
// meaning what they meant.
function CategoryGrid({ categories, picked, onToggle, onAdd, onArchive }) {
  const [managing, setManaging] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);

  function submitNew(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    onAdd(newName.trim(), newColor);
    setNewName("");
    setNewColor(PALETTE[(PALETTE.indexOf(newColor) + 1) % PALETTE.length]);
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="row row--between" style={{ marginBottom: 8 }}>
        <span className="eyebrow">Categories · pick any that overlap</span>
        <button className="btn-link" onClick={() => setManaging((v) => !v)}>{managing ? "Done" : "Edit"}</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))", gap: 6 }}>
        {categories.map((cat) => {
          const on = picked.includes(cat.name) && !managing;
          return (
            <div key={cat.id} style={{ position: "relative" }}>
              <button
                onClick={() => !managing && onToggle(cat.name)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  width: "100%",
                  padding: "11px 10px",
                  minHeight: 44,
                  borderRadius: "var(--r)",
                  border: `1px solid ${on ? cat.color : "var(--line)"}`,
                  background: on ? `${cat.color}22` : "var(--inset)",
                  color: on ? "var(--text)" : "var(--text-2)",
                  fontSize: 12.5,
                  fontWeight: on ? 650 : 500,
                  textAlign: "left",
                  opacity: managing ? 0.75 : 1,
                }}
              >
                <span className="dot" style={{ background: cat.color, opacity: on || managing ? 1 : 0.5 }} />
                <span className="truncate">{cat.name}</span>
              </button>
              {managing && (
                <button
                  onClick={() => onArchive(cat.id)}
                  title={`Remove ${cat.name}`}
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "var(--card)",
                    border: "1px solid var(--danger)",
                    color: "#ff8078",
                    display: "grid",
                    placeItems: "center",
                    padding: 0,
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {managing && (
        <>
          <form onSubmit={submitNew} className="row" style={{ gap: 6, marginTop: 8 }}>
            <button
              type="button"
              className="btn-icon btn-icon--bordered"
              onClick={() => setNewColor(PALETTE[(PALETTE.indexOf(newColor) + 1) % PALETTE.length])}
              title="Change color"
              style={{ width: 38, height: 38 }}
            >
              <span className="dot" style={{ background: newColor, width: 14, height: 14 }} />
            </button>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New category" />
            <button type="submit" className="btn-icon btn-icon--bordered" disabled={!newName.trim()} style={{ width: 38, height: 38, color: "var(--accent)" }}>
              <Plus size={16} />
            </button>
          </form>
          <p className="faint" style={{ fontSize: 11.5, margin: "8px 0 0", lineHeight: 1.5 }}>
            Removing a category hides it from this picker. Past entries keep it, so your history stays accurate.
          </p>
        </>
      )}
    </div>
  );
}

function ManualEntry({ userId, description, picked, onDone }) {
  const [minutes, setMinutes] = useState("30");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const n = Number(minutes);
    if (!n || n <= 0 || picked.length === 0 || busy) return;
    setBusy(true);
    try {
      await logPastTimeEntry(userId, { categories: picked, description: description.trim(), minutes: n });
      await onDone();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="row" style={{ gap: 8 }}>
      <input
        className="input input--lg"
        type="number"
        inputMode="numeric"
        min="1"
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
        style={{ width: 104, textAlign: "center" }}
      />
      <button type="submit" className="btn btn--accent btn--lg" disabled={busy || picked.length === 0}>
        <Clock size={15} />
        Log {minutes || 0}m
      </button>
    </form>
  );
}

function EntryRow({ entry, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(entry.description ?? "");
  const [mins, setMins] = useState(String(Math.round(Number(entry.duration_minutes) || 0)));
  const tags = entry.tags?.length ? entry.tags : [entry.category];

  async function save(e) {
    e.preventDefault();
    const n = Number(mins);
    if (!n || n <= 0) return;
    const started = new Date(entry.started_at);
    await updateTimeEntry(entry.id, {
      description: desc.trim() || null,
      ended_at: new Date(started.getTime() + n * 60000).toISOString(),
    });
    setEditing(false);
    await onChanged();
  }

  if (editing) {
    return (
      <form onSubmit={save} style={{ padding: "10px 0" }}>
        <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" autoFocus style={{ marginBottom: 8 }} />
        <div className="row" style={{ gap: 8 }}>
          <input className="input" type="number" inputMode="numeric" min="1" value={mins} onChange={(e) => setMins(e.target.value)} style={{ width: 90, textAlign: "center" }} />
          <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
          <button type="submit" className="btn btn--accent" style={{ flex: 1 }}>Save</button>
        </div>
      </form>
    );
  }

  return (
    <div style={{ padding: "10px 0" }}>
      <div className="row row--between" style={{ alignItems: "baseline" }}>
        <span className="truncate" style={{ fontSize: 13.5, fontWeight: 570 }}>{entry.description || "Untitled"}</span>
        <span className="row" style={{ gap: 2, flexShrink: 0 }}>
          <span className="mono" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>{fmtMinutes(entry.duration_minutes)}</span>
          <button className="btn-icon" onClick={() => setEditing(true)} title="Edit" style={{ width: 26, height: 26 }}><Pencil size={12} /></button>
          <button
            className="btn-icon"
            onClick={async () => {
              await deleteTimeEntry(entry.id);
              await onChanged();
            }}
            title="Delete"
            style={{ width: 26, height: 26 }}
          >
            <X size={13} />
          </button>
        </span>
      </div>
      <div className="row" style={{ gap: 5, flexWrap: "wrap", marginTop: 5 }}>
        <span className="list-row__meta">{timeOf(entry.started_at)}</span>
        {tags.map((t) => (
          <TagChip key={t} tag={t} />
        ))}
      </div>
    </div>
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

// ---------------------------------------------------------------------------
// Wins
// ---------------------------------------------------------------------------

export function WinsView({ userId }) {
  const [entries, setEntries] = useState([]);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    setEntries(await fetchWinLosses(userId, { sinceISO: todayStartISO(), limit: 200 }));
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const wins = entries.filter((e) => e.kind === "win").length;
  const losses = entries.filter((e) => e.kind === "loss").length;

  async function log(kind) {
    if (busy) return;
    setBusy(true);
    try {
      // The description IS the win — the real log is one-off moments ("Say hi
      // at car wash"), not a fixed habit checklist, so the text goes in
      // habit_label rather than being an optional note on it.
      await logWinLoss(userId, { kind, habitLabel: desc.trim() || (kind === "win" ? "Win" : "Loss") });
      setDesc("");
      inputRef.current?.focus();
      await reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* The wins tile is the filled one — the reference's single saturated
            card. Losses stay outlined: recorded, not celebrated, not scolded. */}
        <div className="card" style={{ background: "var(--accent)", borderColor: "var(--accent)", color: "var(--on-accent)" }}>
          <div style={{ fontSize: 11.5, fontWeight: 650, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.7 }}>Wins</div>
          <div style={{ fontSize: 46, fontWeight: 680, lineHeight: 1.05, letterSpacing: "-0.04em" }}>{wins}</div>
        </div>
        <div className="card">
          <div className="eyebrow">Losses</div>
          <div style={{ fontSize: 46, fontWeight: 680, lineHeight: 1.05, letterSpacing: "-0.04em", color: "var(--text-2)" }}>{losses}</div>
        </div>
      </div>

      <div className="card">
        <input
          ref={inputRef}
          className="input input--lg"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="What happened?"
          style={{ marginBottom: 10 }}
        />
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn--accent btn--lg" onClick={() => log("win")} disabled={busy}>
            <Plus size={16} />
            Win
          </button>
          <button className="btn btn--danger btn--lg" onClick={() => log("loss")} disabled={busy}>
            <Minus size={16} />
            Loss
          </button>
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="card">
          <div className="card-head"><span className="card-title">Today</span></div>
          <div className="list">
            {entries.map((e) => (
              <div key={e.id} className="list-row">
                <span style={{ color: e.kind === "win" ? "var(--accent)" : "var(--text-3)", display: "flex", flexShrink: 0 }}>
                  {e.kind === "win" ? <Plus size={14} /> : <Minus size={14} />}
                </span>
                <span className="truncate" style={{ flex: 1 }}>{e.habit_label}</span>
                <span className="list-row__meta">{timeOf(e.occurred_at)}</span>
                <button
                  className="btn-icon"
                  style={{ width: 26, height: 26 }}
                  onClick={async () => {
                    await deleteWinLoss(e.id);
                    await reload();
                  }}
                  title="Delete"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="empty">Nothing logged yet today.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spirit — quick capture + prayer
// ---------------------------------------------------------------------------

export function SpiritView({ userId }) {
  const [whatCame, setWhatCame] = useState("");
  const [experiences, setExperiences] = useState([]);
  const [prayers, setPrayers] = useState([]);
  const [context, setContext] = useState("");
  const [content, setContent] = useState("");
  const [felt, setFelt] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    const [e, p] = await Promise.all([
      fetchExperiences(userId, { sinceISO: todayStartISO(), limit: 50 }),
      fetchPrayers(userId, { sinceISO: todayStartISO(), limit: 50 }),
    ]);
    setExperiences(e);
    setPrayers(p);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function guard(fn) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head"><span className="card-title"><Flame size={14} />Something came</span></div>
        <form
          className="row"
          style={{ gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!whatCame.trim()) return;
            guard(async () => {
              await logExperience(userId, { whatCame: whatCame.trim() });
              setWhatCame("");
            });
          }}
        >
          <input
            className="input input--lg"
            value={whatCame}
            onChange={(e) => setWhatCame(e.target.value)}
            placeholder="A prompting, impression, answer…"
          />
          <button type="submit" className="btn btn--accent" disabled={busy || !whatCame.trim()} style={{ height: 50, width: 54 }}>
            <Check size={17} />
          </button>
        </form>

        {experiences.length > 0 && (
          <div className="list" style={{ marginTop: 6 }}>
            {experiences.map((e) => (
              <div key={e.id} className="list-row">
                <span className="truncate" style={{ flex: 1 }}>{e.what_came}</span>
                <span className="list-row__meta">{timeOf(e.occurred_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head"><span className="card-title"><HandHeart size={14} />Prayer</span></div>
        <form
          className="stack stack--tight"
          onSubmit={(e) => {
            e.preventDefault();
            if (!content.trim()) return;
            guard(async () => {
              await logPrayerWithRefs(userId, { context: context.trim(), content: content.trim(), feltResponse: felt.trim() });
              setContext("");
              setContent("");
              setFelt("");
            });
          }}
        >
          <input className="input" value={context} onChange={(e) => setContext(e.target.value)} placeholder="Context (optional)" />
          <textarea className="textarea" value={content} onChange={(e) => setContent(e.target.value)} placeholder="What did you pray about?" style={{ minHeight: 70 }} />
          <input className="input" value={felt} onChange={(e) => setFelt(e.target.value)} placeholder="What came in response? (optional)" />
          <button type="submit" className="btn btn--accent btn--lg" disabled={busy || !content.trim()}>
            <HandHeart size={15} />
            Log prayer
          </button>
        </form>

        {prayers.length > 0 && (
          <div className="list" style={{ marginTop: 6 }}>
            {prayers.map((p) => (
              <div key={p.id} style={{ padding: "10px 0" }}>
                <div className="row row--between">
                  <span style={{ fontWeight: 570, fontSize: 13 }}>{p.context || "Prayer"}</span>
                  <span className="list-row__meta">{timeOf(p.prayed_at)}</span>
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{p.content}</div>
                {p.felt_response && <div style={{ fontSize: 12.5, color: "var(--accent)", marginTop: 2 }}>Felt: {p.felt_response}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
