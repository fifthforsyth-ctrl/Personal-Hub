import { useCallback, useEffect, useMemo, useState } from "react";
import { Play, Square, Plus, Minus, HandHeart, Flame } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchOpenTimeEntry,
  startTimeEntry,
  stopTimeEntry,
  fetchTimeEntries,
  logWinLoss,
  fetchWinLosses,
  logPrayerWithRefs,
  fetchPrayers,
  fetchGoalOptions,
  logExperience,
  fetchExperiences,
} from "../lib/api";

function todayStartISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function useElapsed(startedAt) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return "0:00";
  const secs = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

// Phase 0 — the ground-level view: start/stop the day's time, log a win or
// a loss the moment it happens, and record a prayer with what you felt in
// response. Everything here is exact, timestamped, and (optionally) tied
// back to a node in the Goal Tree.
export default function Today() {
  const { user } = useAuth();
  const [goalOptions, setGoalOptions] = useState([]);

  useEffect(() => {
    if (user?.id) fetchGoalOptions(user.id).then(setGoalOptions).catch(() => {});
  }, [user?.id]);

  return (
    <div className="page">
      <h1 className="page-title">Today</h1>
      <p className="page-subtitle">Log it as it happens — exact beats convenient.</p>

      <PromptingCard userId={user?.id} />
      <TimeCard userId={user?.id} goalOptions={goalOptions} />
      <WinLossCard userId={user?.id} goalOptions={goalOptions} />
      <PrayerCard userId={user?.id} />
    </div>
  );
}

// Deliberately the first thing on the page and deliberately one field. A
// prompting comes mid-task, on a phone, and anything that asks you to
// categorize it in the moment is something you won't open. Kind, context,
// and follow-up all get filled in later from the Spirit tab.
function PromptingCard({ userId }) {
  const [whatCame, setWhatCame] = useState("");
  const [entries, setEntries] = useState([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    setEntries(await fetchExperiences(userId, { sinceISO: todayStartISO(), limit: 20 }));
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!whatCame.trim() || busy) return;
    setBusy(true);
    try {
      await logExperience(userId, { whatCame: whatCame.trim() });
      setWhatCame("");
      await reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="section-label">Something came</div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 6 }}>
        <input
          value={whatCame}
          onChange={(e) => setWhatCame(e.target.value)}
          placeholder="A prompting, impression, answer…"
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={busy || !whatCame.trim()}
          className="btn-primary"
          style={{ width: "auto", margin: 0, padding: "10px 14px", flexShrink: 0 }}
        >
          <Flame size={14} />
        </button>
      </form>

      {entries.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {entries.map((e) => (
            <div key={e.id} className="entry-row">
              <span>{e.what_came}</span>
              <span className="entry-meta">
                {new Date(e.occurred_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TimeCard({ userId, goalOptions }) {
  const [open, setOpen] = useState(null);
  const [entries, setEntries] = useState([]);
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [description, setDescription] = useState("");
  const [goalNodeId, setGoalNodeId] = useState("");
  const [busy, setBusy] = useState(false);
  const elapsed = useElapsed(open?.started_at);

  const reload = useCallback(async () => {
    if (!userId) return;
    const [o, list] = await Promise.all([fetchOpenTimeEntry(userId), fetchTimeEntries(userId, { sinceISO: todayStartISO() })]);
    setOpen(o);
    setEntries(list);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleStart(e) {
    e.preventDefault();
    if (!category.trim() || busy) return;
    setBusy(true);
    try {
      await startTimeEntry(userId, { category: category.trim(), subcategory: subcategory.trim(), description: description.trim(), goalNodeId: goalNodeId || null });
      setCategory("");
      setSubcategory("");
      setDescription("");
      setGoalNodeId("");
      await reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    if (!open || busy) return;
    setBusy(true);
    try {
      await stopTimeEntry(open.id);
      await reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="section-label">Minute tracking</div>

      {open ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{open.category}{open.subcategory ? ` · ${open.subcategory}` : ""}</div>
            {open.description && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{open.description}</div>}
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--accent-strong)", marginTop: 6 }}>{elapsed}</div>
          </div>
          <button onClick={handleStop} disabled={busy} className="btn-danger" style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <Square size={14} />
            Stop
          </button>
        </div>
      ) : (
        <form onSubmit={handleStart} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Category (e.g. Editing)" value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle} required />
            <input placeholder="Subcategory (optional)" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} style={inputStyle} />
          </div>
          <input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
          {goalOptions.length > 0 && (
            <select value={goalNodeId} onChange={(e) => setGoalNodeId(e.target.value)} style={inputStyle}>
              <option value="">No linked goal</option>
              {goalOptions.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          )}
          <button type="submit" disabled={busy || !category.trim()} className="btn-primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "auto" }}>
            <Play size={14} />
            Start
          </button>
        </form>
      )}

      {entries.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {entries.map((e) => (
            <div key={e.id} className="entry-row">
              <span>
                {e.category}
                {e.subcategory ? ` · ${e.subcategory}` : ""}
                {e.description ? ` — ${e.description}` : ""}
              </span>
              <span className="entry-meta">{e.duration_minutes != null ? `${e.duration_minutes}m` : "running"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WinLossCard({ userId, goalOptions }) {
  const [entries, setEntries] = useState([]);
  const [habitLabel, setHabitLabel] = useState("");
  const [goalNodeId, setGoalNodeId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    setEntries(await fetchWinLosses(userId, { sinceISO: todayStartISO() }));
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleLog(kind) {
    if (!habitLabel.trim() || busy) return;
    setBusy(true);
    try {
      await logWinLoss(userId, { kind, habitLabel: habitLabel.trim(), goalNodeId: goalNodeId || null, note: note.trim() });
      setHabitLabel("");
      setNote("");
      setGoalNodeId("");
      await reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="section-label">Wins &amp; losses</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input placeholder="Habit (e.g. Scripture study)" value={habitLabel} onChange={(e) => setHabitLabel(e.target.value)} style={inputStyle} />
        <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
        {goalOptions.length > 0 && (
          <select value={goalNodeId} onChange={(e) => setGoalNodeId(e.target.value)} style={inputStyle}>
            <option value="">No linked goal</option>
            {goalOptions.map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => handleLog("win")} disabled={busy || !habitLabel.trim()} className="btn-primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Plus size={14} />
            Win
          </button>
          <button onClick={() => handleLog("loss")} disabled={busy || !habitLabel.trim()} className="btn-secondary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Minus size={14} />
            Loss
          </button>
        </div>
      </div>

      {entries.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {entries.map((e) => (
            <div key={e.id} className="entry-row">
              <span className="pill" style={{ color: e.kind === "win" ? "var(--accent-strong)" : "var(--danger)" }}>
                {e.kind === "win" ? <Plus size={12} /> : <Minus size={12} />}
                {e.habit_label}
              </span>
              <span className="entry-meta">{new Date(e.occurred_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PrayerCard({ userId }) {
  const [entries, setEntries] = useState([]);
  const [context, setContext] = useState("");
  const [content, setContent] = useState("");
  const [feltResponse, setFeltResponse] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    setEntries(await fetchPrayers(userId, { sinceISO: todayStartISO() }));
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true);
    try {
      await logPrayerWithRefs(userId, { context: context.trim(), content: content.trim(), feltResponse: feltResponse.trim() });
      setContext("");
      setContent("");
      setFeltResponse("");
      await reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="section-label">Prayer &amp; revelation</div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input placeholder="Context (optional)" value={context} onChange={(e) => setContext(e.target.value)} style={inputStyle} />
        <textarea placeholder="What did you pray about?" value={content} onChange={(e) => setContent(e.target.value)} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} />
        <input placeholder="Impression or response felt (optional)" value={feltResponse} onChange={(e) => setFeltResponse(e.target.value)} style={inputStyle} />
        <button type="submit" disabled={busy || !content.trim()} className="btn-primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "auto" }}>
          <HandHeart size={14} />
          Log prayer
        </button>
      </form>

      {entries.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {entries.map((e) => (
            <div key={e.id} className="entry-row" style={{ flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                <span style={{ fontWeight: 600 }}>{e.context || "Prayer"}</span>
                <span className="entry-meta">{new Date(e.prayed_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              </div>
              <div style={{ color: "var(--text-muted)", marginTop: 2 }}>{e.content}</div>
              {e.felt_response && <div style={{ color: "var(--accent-strong)", marginTop: 2, fontSize: 12.5 }}>Felt: {e.felt_response}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: "var(--bg-inset)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "10px 12px",
  color: "var(--text)",
  fontSize: 13.5,
  fontFamily: "inherit",
};
