import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, Plus, Minus, HandHeart, Flame, X, Pencil, Clock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
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
} from "../lib/api";
import { fetchCategories, createCategory, archiveCategory } from "../lib/api";
import { colorFor, fmtMinutes, setCategoryColors, PALETTE } from "../lib/categories";

const VIEWS = ["Minutes", "Wins", "Spirit"];

function todayStartISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function timeOf(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// The capture surface. Everything here is built for one hand on a phone
// mid-day: big targets, no dropdowns in the fast path, and nothing required
// beyond the thing you're actually recording.
//
// Goal links are deliberately absent — they used to be a picker over 86
// nodes on every entry, which is why not one of a thousand entries had one.
// The category→goal mapping now does it automatically on insert.
export default function Today() {
  const { user } = useAuth();
  const [view, setView] = useState("Minutes");

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {VIEWS.map((v) => (
          <button key={v} onClick={() => setView(v)} style={segStyle(view === v)}>
            {v}
          </button>
        ))}
      </div>

      {view === "Minutes" && <MinutesView userId={user?.id} />}
      {view === "Wins" && <WinsView userId={user?.id} />}
      {view === "Spirit" && <SpiritView userId={user?.id} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Minutes
// ---------------------------------------------------------------------------

function MinutesView({ userId }) {
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
    // Publish the colors so tag chips elsewhere on the page match.
    setCategoryColors(cats);
  }, [userId]);

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

  const handleStop = () => guard(() => stopTimeEntry(open.id));

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
      byCategory: [...totals.entries()].map(([c, m]) => ({ category: c, minutes: m })).sort((a, b) => b.minutes - a.minutes),
      totalMinutes: total,
    };
  }, [entries]);

  return (
    <>
      {open ? (
        <RunningCard entry={open} onStop={handleStop} busy={busy} />
      ) : (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div className="section-label" style={{ margin: 0 }}>Track</div>
            <button onClick={() => setManualOpen((v) => !v)} style={linkBtnStyle}>
              {manualOpen ? "Cancel" : "+ Log past time"}
            </button>
          </div>

          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What are you up to?"
            style={{ ...inputStyle, fontSize: 16, padding: "13px 14px", marginBottom: 12 }}
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
            <button
              onClick={handleStart}
              disabled={busy || picked.length === 0}
              style={{ ...bigButtonStyle, background: picked.length ? "var(--accent)" : "var(--bg-inset)", color: picked.length ? "#180f00" : "var(--text-faint)" }}
            >
              <Play size={16} />
              Start timer
            </button>
          )}
        </div>
      )}

      {entries.length > 0 && (
        <div className="card">
          <div className="section-label">Today so far</div>
          <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
            <Stat label="Logged" value={fmtMinutes(totalMinutes)} />
            <Stat label="Entries" value={String(entries.length)} />
          </div>
          <Distribution rows={byCategory} total={totalMinutes} />
        </div>
      )}

      {entries.length > 0 && (
        <div className="card">
          <div className="section-label">Timeline</div>
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} onChanged={reload} />
          ))}
        </div>
      )}

      {entries.length === 0 && !open && (
        <p className="placeholder-note">Nothing logged yet today.</p>
      )}
    </>
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
    <div className="card" style={{ borderColor: "var(--accent-strong)" }}>
      <div className="section-label" style={{ color: "var(--accent-strong)" }}>Tracking since {timeOf(entry.started_at)}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 40, fontWeight: 700, lineHeight: 1.1, margin: "6px 0 4px" }}>{elapsed}</div>
      {entry.description && <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{entry.description}</div>}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
        {tags.map((t) => (
          <TagChip key={t} tag={t} />
        ))}
      </div>
      <button onClick={onStop} disabled={busy} style={{ ...bigButtonStyle, background: "var(--danger)", color: "#fff" }}>
        <Square size={15} />
        Stop &amp; log
      </button>
    </div>
  );
}

// "Pick multiple if overlapping" — the whole point. A grid of toggles, each
// big enough to hit without aiming.
//
// The list is yours to change: add a category the moment a new recurring
// thing appears, remove one that stopped mattering. Removal archives rather
// than deletes, so months of history keep meaning what they meant.
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
        <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Categories · pick any that overlap
        </span>
        <button onClick={() => setManaging((v) => !v)} style={linkBtnStyle}>
          {managing ? "Done" : "Edit"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 6 }}>
        {categories.map((cat) => {
          const on = picked.includes(cat.name);
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
                  borderRadius: 10,
                  border: `1px solid ${on && !managing ? cat.color : "var(--border)"}`,
                  background: on && !managing ? `${cat.color}22` : "var(--bg-inset)",
                  color: on && !managing ? "var(--text)" : "var(--text-muted)",
                  fontSize: 12.5,
                  fontWeight: on && !managing ? 700 : 500,
                  textAlign: "left",
                  opacity: managing ? 0.75 : 1,
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: cat.color, flexShrink: 0, opacity: on || managing ? 1 : 0.45 }} />
                {cat.name}
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
                    background: "var(--bg-card)",
                    border: "1px solid var(--danger)",
                    color: "var(--danger)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
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
        <form onSubmit={submitNew} style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setNewColor(PALETTE[(PALETTE.indexOf(newColor) + 1) % PALETTE.length])}
            title="Change color"
            style={{ width: 34, height: 38, borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-inset)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <span style={{ width: 14, height: 14, borderRadius: "50%", background: newColor }} />
          </button>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New category" style={{ ...inputStyle, flex: 1 }} />
          <button type="submit" disabled={!newName.trim()} style={{ ...iconBtnStyle, border: "1px solid var(--border)", borderRadius: 9, width: 38, height: 38, justifyContent: "center", color: "var(--accent-strong)" }}>
            <Plus size={16} />
          </button>
        </form>
      )}

      {managing && (
        <p style={{ fontSize: 11, color: "var(--text-faint)", margin: "8px 0 0", lineHeight: 1.45 }}>
          Removing a category hides it from this picker. Past entries keep it, so your history stays accurate.
        </p>
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
    <form onSubmit={submit} style={{ display: "flex", gap: 8 }}>
      <input
        type="number"
        inputMode="numeric"
        min="1"
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
        style={{ ...inputStyle, width: 100, fontSize: 16, textAlign: "center" }}
      />
      <button
        type="submit"
        disabled={busy || picked.length === 0}
        style={{ ...bigButtonStyle, flex: 1, marginTop: 0, background: picked.length ? "var(--accent)" : "var(--bg-inset)", color: picked.length ? "#180f00" : "var(--text-faint)" }}
      >
        <Clock size={15} />
        Log {minutes || 0}m
      </button>
    </form>
  );
}

function Distribution({ rows, total }) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.minutes), 1);
  return (
    <>
      {/* One proportional strip rather than a pie: at fourteen possible
          categories a pie is unreadable, and the question here is the shape
          of the day, not precise slice comparison. */}
      <div style={{ display: "flex", height: 9, borderRadius: 5, overflow: "hidden", gap: 2, marginBottom: 12 }}>
        {rows.map((r) => (
          <div key={r.category} title={`${r.category} · ${fmtMinutes(r.minutes)}`} style={{ width: `${(r.minutes / total) * 100}%`, background: colorFor(r.category) }} />
        ))}
      </div>
      {rows.map((r) => (
        <div key={r.category} style={{ marginBottom: 9 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: colorFor(r.category) }} />
              {r.category}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{fmtMinutes(r.minutes)}</span>
          </div>
          <div style={{ height: 6, background: "var(--bg-inset)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${(r.minutes / max) * 100}%`, height: "100%", background: colorFor(r.category), borderRadius: 3 }} />
          </div>
        </div>
      ))}
    </>
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

  async function remove() {
    await deleteTimeEntry(entry.id);
    await onChanged();
  }

  if (editing) {
    return (
      <form onSubmit={save} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" style={{ ...inputStyle, marginBottom: 8 }} autoFocus />
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" inputMode="numeric" min="1" value={mins} onChange={(e) => setMins(e.target.value)} style={{ ...inputStyle, width: 90, textAlign: "center" }} />
          <button type="button" onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary" style={{ width: "auto", flex: 1, margin: 0 }}>Save</button>
        </div>
      </form>
    );
  }

  return (
    <div style={{ padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 0 }}>{entry.description || "Untitled"}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-strong)", fontWeight: 700 }}>
            {fmtMinutes(entry.duration_minutes)}
          </span>
          <button onClick={() => setEditing(true)} style={iconBtnStyle} title="Edit"><Pencil size={12} /></button>
          <button onClick={remove} style={iconBtnStyle} title="Delete"><X size={13} /></button>
        </span>
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5, alignItems: "center" }}>
        <span className="entry-meta">{timeOf(entry.started_at)}</span>
        {tags.map((t) => (
          <TagChip key={t} tag={t} />
        ))}
      </div>
    </div>
  );
}

function TagChip({ tag }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: 5,
        border: `1px solid ${colorFor(tag)}55`,
        background: `${colorFor(tag)}1a`,
        color: "var(--text)",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: colorFor(tag) }} />
      {tag}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Wins
// ---------------------------------------------------------------------------

function WinsView({ userId }) {
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
      // The description IS the win here — his real log is 182 one-off
      // moments ("Say hi at car wash"), not a fixed habit checklist, so the
      // text goes in habit_label rather than being an optional note on it.
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
    <>
      <div className="card">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Score label="Wins" value={wins} color="var(--accent-strong)" />
          <Score label="Losses" value={losses} color="var(--danger)" />
        </div>
      </div>

      <div className="card">
        <input
          ref={inputRef}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="What happened?"
          style={{ ...inputStyle, fontSize: 16, padding: "13px 14px", marginBottom: 10 }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => log("win")} disabled={busy} style={{ ...bigButtonStyle, flex: 1, marginTop: 0, background: "var(--accent)", color: "#180f00" }}>
            <Plus size={16} />
            Win
          </button>
          <button onClick={() => log("loss")} disabled={busy} style={{ ...bigButtonStyle, flex: 1, marginTop: 0, background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)" }}>
            <Minus size={16} />
            Loss
          </button>
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="card">
          <div className="section-label">Today</div>
          {entries.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: e.kind === "win" ? "var(--accent-strong)" : "var(--danger)", display: "flex", flexShrink: 0 }}>
                {e.kind === "win" ? <Plus size={14} /> : <Minus size={14} />}
              </span>
              <span style={{ flex: 1, fontSize: 13.5, minWidth: 0 }}>{e.habit_label}</span>
              <span className="entry-meta">{timeOf(e.occurred_at)}</span>
              <button
                onClick={async () => {
                  await deleteWinLoss(e.id);
                  await reload();
                }}
                style={iconBtnStyle}
                title="Delete"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="placeholder-note">Nothing logged yet today.</p>
      )}
    </>
  );
}

function Score({ label, value, color }) {
  return (
    <div style={{ background: "var(--bg-inset)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 12px", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </div>
      <div style={{ fontSize: 44, fontWeight: 800, color, lineHeight: 1.1, marginTop: 2, fontFamily: "var(--font-display)" }}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spirit — quick capture + prayer
// ---------------------------------------------------------------------------

function SpiritView({ userId }) {
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
    <>
      <div className="card">
        <div className="section-label">Something came</div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!whatCame.trim()) return;
            guard(async () => {
              await logExperience(userId, { whatCame: whatCame.trim() });
              setWhatCame("");
            });
          }}
          style={{ display: "flex", gap: 8 }}
        >
          <input
            value={whatCame}
            onChange={(e) => setWhatCame(e.target.value)}
            placeholder="A prompting, impression, answer…"
            style={{ ...inputStyle, fontSize: 16, padding: "13px 14px" }}
          />
          <button type="submit" disabled={busy || !whatCame.trim()} style={{ ...bigButtonStyle, marginTop: 0, width: 56, flexShrink: 0, background: "var(--accent)", color: "#180f00" }}>
            <Flame size={16} />
          </button>
        </form>

        {experiences.map((e) => (
          <div key={e.id} className="entry-row">
            <span>{e.what_came}</span>
            <span className="entry-meta">{timeOf(e.occurred_at)}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="section-label">Prayer</div>
        <form
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
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <input value={context} onChange={(e) => setContext(e.target.value)} placeholder="Context (optional)" style={inputStyle} />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="What did you pray about?" style={{ ...inputStyle, minHeight: 64, resize: "vertical" }} />
          <input value={felt} onChange={(e) => setFelt(e.target.value)} placeholder="What came in response? (optional)" style={inputStyle} />
          <button type="submit" disabled={busy || !content.trim()} style={{ ...bigButtonStyle, marginTop: 0, background: "var(--accent)", color: "#180f00" }}>
            <HandHeart size={15} />
            Log prayer
          </button>
        </form>

        {prayers.map((p) => (
          <div key={p.id} className="entry-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
              <span style={{ fontWeight: 600 }}>{p.context || "Prayer"}</span>
              <span className="entry-meta">{timeOf(p.prayed_at)}</span>
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{p.content}</div>
            {p.felt_response && <div style={{ color: "var(--accent-strong)", fontSize: 12.5 }}>Felt: {p.felt_response}</div>}
          </div>
        ))}
      </div>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-display)", marginTop: 1 }}>{value}</div>
    </div>
  );
}

function segStyle(active) {
  return {
    flex: 1,
    background: active ? "var(--accent-dim)" : "var(--bg-inset)",
    border: `1px solid ${active ? "var(--accent-strong)" : "var(--border)"}`,
    color: active ? "var(--text)" : "var(--text-muted)",
    borderRadius: 9,
    padding: "10px 0",
    fontSize: 13,
    fontWeight: 700,
    minHeight: 42,
  };
}

const bigButtonStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  width: "100%",
  minHeight: 50,
  border: "none",
  borderRadius: 11,
  fontSize: 15,
  fontWeight: 800,
  letterSpacing: "0.01em",
};

const iconBtnStyle = {
  background: "none",
  border: "none",
  color: "var(--text-faint)",
  display: "flex",
  alignItems: "center",
  padding: 5,
  flexShrink: 0,
};

const linkBtnStyle = {
  background: "none",
  border: "none",
  color: "var(--accent-strong)",
  fontSize: 12,
  fontWeight: 700,
  padding: 0,
};

const inputStyle = {
  width: "100%",
  background: "var(--bg-inset)",
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "11px 12px",
  color: "var(--text)",
  fontSize: 14,
  fontFamily: "inherit",
};
