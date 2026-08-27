import { useCallback, useEffect, useState } from "react";
import { CircleDot, CheckCircle2, BookOpen, History, Sparkles, X, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchOpenLoops,
  fetchExperiences,
  closeExperienceLoop,
  updateExperience,
  createStudyNote,
  fetchStudyNotes,
  fetchOnThisDay,
  fetchReferencedScriptures,
  fetchEntriesForScripture,
  fetchGoalOptions,
} from "../lib/api";

const KINDS = ["prompting", "impression", "answer", "tender_mercy", "comfort", "warning", "insight"];
const KIND_LABEL = {
  prompting: "Prompting",
  impression: "Impression",
  answer: "Answer",
  tender_mercy: "Tender mercy",
  comfort: "Comfort",
  warning: "Warning",
  insight: "Insight",
};

const TABS = ["Open loops", "Record", "Study", "Scripture"];

function daysAgo(iso) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

// Phase 4 — the module the vision doc says "makes the dashboard genuinely
// yours rather than a generic productivity tool." Its center is the open
// loop: a prompting recorded and then brought back until you say what came
// of it. That round trip is what makes years of this into a dataset you can
// actually see revelation patterns in, rather than a diary you never reread.
export default function Spirit() {
  const { user } = useAuth();
  const [tab, setTab] = useState("Open loops");
  const [goalOptions, setGoalOptions] = useState([]);

  useEffect(() => {
    if (user?.id) fetchGoalOptions(user.id).then(setGoalOptions).catch(() => {});
  }, [user?.id]);

  return (
    <div className="page">
      <h1 className="page-title">Spirit</h1>
      <p className="page-subtitle">Promptings, prayers, and study — kept with the same rigor as time.</p>

      <div style={{ display: "flex", gap: 5, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: "1 1 auto",
              background: tab === t ? "var(--accent-dim)" : "var(--bg-inset)",
              border: `1px solid ${tab === t ? "var(--accent-strong)" : "var(--border)"}`,
              color: tab === t ? "var(--text)" : "var(--text-muted)",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Open loops" && <OpenLoops userId={user?.id} />}
      {tab === "Record" && <RecordTab userId={user?.id} goalOptions={goalOptions} />}
      {tab === "Study" && <StudyTab userId={user?.id} goalOptions={goalOptions} />}
      {tab === "Scripture" && <ScriptureTab userId={user?.id} />}
    </div>
  );
}

function OpenLoops({ userId }) {
  const [loops, setLoops] = useState([]);
  const [onThisDay, setOnThisDay] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [l, otd] = await Promise.all([fetchOpenLoops(userId), fetchOnThisDay().catch(() => [])]);
    setLoops(l);
    setOnThisDay(otd);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loading) return <p className="placeholder-note">Loading…</p>;

  return (
    <>
      <div className="card">
        <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <CircleDot size={12} />
          Waiting on you
        </div>

        {loops.length === 0 ? (
          <p className="placeholder-note" style={{ fontSize: 13, margin: 0 }}>
            Nothing open. Anything you record on Today shows up here after a day, until you say what came of it.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 11.5, color: "var(--text-faint)", margin: "-4px 0 12px" }}>
              Recorded but not yet followed up. Not a backlog — just the ones still waiting.
            </p>
            {loops.map((loop) =>
              closing === loop.id ? (
                <CloseLoopForm
                  key={loop.id}
                  userId={userId}
                  loop={loop}
                  onCancel={() => setClosing(null)}
                  onDone={async () => {
                    setClosing(null);
                    await reload();
                  }}
                />
              ) : (
                <div key={loop.id} className="entry-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 10 }}>
                    <span style={{ fontWeight: 600 }}>{loop.what_came}</span>
                    <span className="entry-meta">{daysAgo(loop.occurred_at)}</span>
                  </div>
                  {loop.trigger_context && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{loop.trigger_context}</div>
                  )}
                  <button onClick={() => setClosing(loop.id)} style={linkBtnStyle}>
                    <CheckCircle2 size={12} />
                    What came of it?
                  </button>
                </div>
              )
            )}
          </>
        )}
      </div>

      {onThisDay.length > 0 && (
        <div className="card">
          <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <History size={12} />
            On this day
          </div>
          {onThisDay.map((item) => (
            <div key={`${item.source}-${item.id}`} className="entry-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 10 }}>
                <span className="pill" style={{ fontSize: 10.5 }}>{KIND_LABEL[item.title] ?? item.title}</span>
                <span className="entry-meta">
                  {new Date(item.occurred_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                </span>
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{item.body}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function CloseLoopForm({ userId, loop, onCancel, onDone }) {
  const [actionTaken, setActionTaken] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await closeExperienceLoop(userId, loop.id, { actionTaken, followUpNotes });
      await onDone();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>{loop.what_came}</div>
      <input value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} placeholder="What did you do?" style={{ ...inputStyle, marginBottom: 6 }} autoFocus />
      <textarea
        value={followUpNotes}
        onChange={(e) => setFollowUpNotes(e.target.value)}
        placeholder="How did it play out? (optional)"
        style={{ ...inputStyle, minHeight: 54, resize: "vertical", marginBottom: 8 }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary" style={{ width: "auto", flex: 1, margin: 0 }} disabled={busy}>
          {busy ? "Saving…" : "Close the loop"}
        </button>
      </div>
    </form>
  );
}

// The full record, where a quick capture gets its detail filled in.
function RecordTab({ userId, goalOptions }) {
  const [entries, setEntries] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setEntries(await fetchExperiences(userId));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function saveDetail(id, fields) {
    try {
      await updateExperience(userId, id, fields);
      setEditing(null);
      await reload();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) return <p className="placeholder-note">Loading…</p>;
  if (entries.length === 0)
    return <p className="placeholder-note">Nothing recorded yet. Capture promptings from the Today tab as they come.</p>;

  return (
    <div className="card">
      <div className="section-label">Everything recorded</div>
      {entries.map((e) => (
        <div key={e.id} className="entry-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 10 }}>
            <span className="pill" style={{ fontSize: 10.5, color: e.acted_on ? "var(--accent-strong)" : "var(--text-muted)" }}>
              {KIND_LABEL[e.kind]}
            </span>
            <span className="entry-meta">
              {new Date(e.occurred_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{e.what_came}</div>
          {e.trigger_context && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Context: {e.trigger_context}</div>}
          {e.action_taken && <div style={{ fontSize: 12.5, color: "var(--accent-strong)" }}>Acted: {e.action_taken}</div>}
          {e.follow_up_notes && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{e.follow_up_notes}</div>}

          {editing === e.id ? (
            <DetailForm entry={e} goalOptions={goalOptions} onCancel={() => setEditing(null)} onSave={(f) => saveDetail(e.id, f)} />
          ) : (
            <button onClick={() => setEditing(e.id)} style={linkBtnStyle}>
              <ChevronRight size={12} />
              Add detail
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function DetailForm({ entry, goalOptions, onCancel, onSave }) {
  const [kind, setKind] = useState(entry.kind);
  const [triggerContext, setTriggerContext] = useState(entry.trigger_context ?? "");
  const [linkedGoalId, setLinkedGoalId] = useState(entry.linked_goal_id ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ kind, trigger_context: triggerContext || null, linked_goal_id: linkedGoalId || null });
      }}
      style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}
    >
      <select value={kind} onChange={(e) => setKind(e.target.value)} style={inputStyle}>
        {KINDS.map((k) => (
          <option key={k} value={k}>{KIND_LABEL[k]}</option>
        ))}
      </select>
      <input value={triggerContext} onChange={(e) => setTriggerContext(e.target.value)} placeholder="What was happening?" style={inputStyle} />
      {goalOptions.length > 0 && (
        <select value={linkedGoalId} onChange={(e) => setLinkedGoalId(e.target.value)} style={inputStyle}>
          <option value="">No linked goal</option>
          {goalOptions.map((g) => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary" style={{ width: "auto", flex: 1, margin: 0 }}>Save</button>
      </div>
    </form>
  );
}

function StudyTab({ userId, goalOptions }) {
  const [notes, setNotes] = useState([]);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setNotes(await fetchStudyNotes(userId));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <>
      {adding ? (
        <StudyNoteForm
          userId={userId}
          goalOptions={goalOptions}
          onCancel={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await reload();
          }}
        />
      ) : (
        <button onClick={() => setAdding(true)} className="card" style={addCardStyle}>
          <BookOpen size={15} />
          Add a study note
        </button>
      )}

      {loading && <p className="placeholder-note">Loading…</p>}

      {!loading && notes.length === 0 && (
        <p className="placeholder-note">
          No study notes yet. Write one here, or sync them in from your Obsidian vault.
        </p>
      )}

      {notes.map((n) => (
        <div key={n.id} className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
            <span style={{ fontWeight: 700, fontSize: 15, fontFamily: "var(--font-display)" }}>{n.title}</span>
            <span className="entry-meta">{n.studied_on}</span>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {n.source_ref && <span className="pill" style={{ fontSize: 10.5 }}>{n.source_ref}</span>}
            {n.obsidian_uid && <span className="pill" style={{ fontSize: 10.5, color: "var(--text-faint)" }}>Obsidian</span>}
          </div>

          {/* The distilled read sits above the original and never replaces
              it — "along with the full note I made." */}
          {n.ai_theme && (
            <div style={{ marginTop: 12, padding: 12, background: "var(--bg-inset)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                <Sparkles size={11} />
                Theme
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)" }}>{n.ai_theme}</div>
              {n.ai_summary && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.55 }}>{n.ai_summary}</div>}
              {Array.isArray(n.ai_key_points) && n.ai_key_points.length > 0 && (
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  {n.ai_key_points.map((p, i) => (
                    <li key={i}>{typeof p === "string" ? p : p.point ?? JSON.stringify(p)}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button onClick={() => setExpanded(expanded === n.id ? null : n.id)} style={{ ...linkBtnStyle, marginTop: 10 }}>
            <ChevronRight size={12} />
            {expanded === n.id ? "Hide the full note" : "Read the full note"}
          </button>

          {expanded === n.id && (
            <div style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.65, whiteSpace: "pre-wrap", color: "var(--text)" }}>{n.body}</div>
          )}
        </div>
      ))}
    </>
  );
}

function StudyNoteForm({ userId, goalOptions, onCancel, onSaved }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sourceKind, setSourceKind] = useState("scripture");
  const [sourceRef, setSourceRef] = useState("");
  const [linkedGoalId, setLinkedGoalId] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || busy) return;
    setBusy(true);
    try {
      await createStudyNote(userId, {
        title: title.trim(),
        body: body.trim(),
        sourceKind,
        sourceRef: sourceRef.trim(),
        linkedGoalId,
      });
      await onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={inputStyle} required autoFocus />
      <div style={{ display: "flex", gap: 8 }}>
        <select value={sourceKind} onChange={(e) => setSourceKind(e.target.value)} style={inputStyle}>
          <option value="scripture">Scripture</option>
          <option value="come_follow_me">Come, Follow Me</option>
          <option value="conference">Conference</option>
          <option value="other">Other</option>
        </select>
        <input value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="e.g. Alma 32" style={inputStyle} />
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What did you study, and what came of it?" style={{ ...inputStyle, minHeight: 120, resize: "vertical" }} required />
      {goalOptions.length > 0 && (
        <select value={linkedGoalId} onChange={(e) => setLinkedGoalId(e.target.value)} style={inputStyle}>
          <option value="">No linked goal</option>
          {goalOptions.map((g) => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>
      )}
      <p style={{ fontSize: 11, color: "var(--text-faint)", margin: 0 }}>
        Any verse references in the title or body get indexed automatically.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary" style={{ width: "auto", flex: 1, margin: 0 }} disabled={busy}>
          {busy ? "Saving…" : "Save note"}
        </button>
      </div>
    </form>
  );
}

// The cross-reference: pick a book you've written about, see everything that
// ever touched it — prayers, promptings, and study notes together.
function ScriptureTab({ userId }) {
  const [books, setBooks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    fetchReferencedScriptures(userId)
      .then(setBooks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!selected) {
      setEntries([]);
      return;
    }
    fetchEntriesForScripture(selected.book, null).then(setEntries).catch(() => {});
  }, [selected]);

  if (loading) return <p className="placeholder-note">Loading…</p>;

  if (books.length === 0)
    return (
      <p className="placeholder-note">
        No verse references indexed yet. Mention one in a prayer, prompting, or study note — like "Alma 32:21" — and it shows up here.
      </p>
    );

  return (
    <>
      <div className="card">
        <div className="section-label">Books you've written about</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {books.map((b) => (
            <button
              key={b.book}
              onClick={() => setSelected(selected?.book === b.book ? null : b)}
              style={{
                background: selected?.book === b.book ? "var(--accent-dim)" : "var(--bg-inset)",
                border: `1px solid ${selected?.book === b.book ? "var(--accent-strong)" : "var(--border)"}`,
                color: selected?.book === b.book ? "var(--text)" : "var(--text-muted)",
                borderRadius: 999,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {b.book} · {b.count}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div className="section-label" style={{ margin: 0 }}>Everything touching {selected.book}</div>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-faint)" }}>
              <X size={14} />
            </button>
          </div>
          {entries.length === 0 && <p className="placeholder-note" style={{ fontSize: 13 }}>Nothing found.</p>}
          {entries.map((e) => (
            <div key={`${e.source}-${e.id}-${e.raw_ref}`} className="entry-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 10 }}>
                <span className="pill" style={{ fontSize: 10.5 }}>{e.raw_ref}</span>
                <span className="entry-meta">
                  {e.occurred_at ? new Date(e.occurred_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""}
                </span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{KIND_LABEL[e.title] ?? e.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{e.body}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const linkBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: 3,
  background: "none",
  border: "none",
  color: "var(--accent-strong)",
  fontSize: 11.5,
  fontWeight: 700,
  padding: 0,
};

const addCardStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  color: "var(--accent-strong)",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  border: "1px dashed var(--border-strong)",
  background: "transparent",
  width: "100%",
};

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
