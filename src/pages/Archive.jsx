import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Minus,
  HandHeart,
  Flame,
  BookOpen,
  CheckSquare,
  PenLine,
  CalendarDays,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchDayArchive, fetchArchiveDays, saveJournalEntry } from "../lib/api";
import { toPlainText } from "../lib/markdown";
import { todayStr, addDays, parseDateStr, fmtDayHeading, fmtTime, minutesOf } from "../lib/planDates";
import { intensityColor } from "../lib/nodeStyle";
import GoalFruits from "../components/GoalFruits";
import PlanProposals from "../components/PlanProposals";
import GoalLinkSuggestions from "../components/GoalLinkSuggestions";

const KIND_LABEL = {
  prompting: "Prompting",
  impression: "Impression",
  answer: "Answer",
  tender_mercy: "Tender mercy",
  comfort: "Comfort",
  warning: "Warning",
  insight: "Insight",
};

function fmtHours(minutes) {
  const m = Number(minutes) || 0;
  if (m < 60) return `${Math.round(m)}m`;
  const h = Math.floor(m / 60);
  const rem = Math.round(m % 60);
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

function timeOf(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Phase 4.7 — the day, whole. Everything every other module recorded on one
// date, assembled on one page, plus the three things only you can write.
//
// The split matters: the app generates the record, you write the reflection.
// The doc is explicit that the summary should be "pulled from that day's
// time log, tasks, health and finances — so you're reflecting on the day,
// not re-transcribing it."
export default function Archive() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayStr());
  const [archive, setArchive] = useState(null);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showJump, setShowJump] = useState(false);
  // Bumped when links are accepted so the fruits recompute immediately.
  const [fruitsVersion, setFruitsVersion] = useState(0);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await fetchDayArchive(date);
      setArchive(data);
      setFruitsVersion((v) => v + 1);
    } finally {
      setLoading(false);
    }
  }, [user?.id, date]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (user?.id) fetchArchiveDays(120).then(setDays).catch(() => {});
  }, [user?.id]);

  const isToday = date === todayStr();
  const a = archive ?? {};
  const timeByCategory = a.time_by_category ?? [];
  const totalMinutes = timeByCategory.reduce((s, c) => s + Number(c.minutes || 0), 0);
  const tasks = a.tasks ?? [];
  const topTasks = tasks.filter((t) => !t.parent_task_id);
  const tasksDone = topTasks.filter((t) => t.status).length;
  const wins = (a.wins_losses ?? []).filter((w) => w.kind === "win").length;
  const losses = (a.wins_losses ?? []).filter((w) => w.kind === "loss").length;

  const isEmpty =
    !loading &&
    timeByCategory.length === 0 &&
    tasks.length === 0 &&
    (a.prayers ?? []).length === 0 &&
    (a.experiences ?? []).length === 0 &&
    (a.study_notes ?? []).length === 0 &&
    !a.journal;

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <button onClick={() => setDate((d) => addDays(d, -1))} style={navBtnStyle} title="Previous day">
          <ChevronLeft size={16} />
        </button>
        <div style={{ textAlign: "center", minWidth: 0 }}>
          <h1 className="page-title" style={{ fontSize: 18, marginBottom: 2 }}>
            {isToday ? "Today" : fmtDayHeading(date)}
          </h1>
          <button onClick={() => setShowJump((v) => !v)} style={linkBtnStyle}>
            <CalendarDays size={11} />
            {isToday ? fmtDayHeading(date) : "Jump to a day"}
          </button>
        </div>
        <button onClick={() => setDate((d) => addDays(d, 1))} style={navBtnStyle} title="Next day">
          <ChevronRight size={16} />
        </button>
      </div>

      {showJump && (
        <DayJumper
          days={days}
          current={date}
          onPick={(d) => {
            setDate(d);
            setShowJump(false);
          }}
        />
      )}

      {loading && <p className="placeholder-note">Reading the day…</p>}

      {isEmpty && (
        <p className="placeholder-note">
          Nothing recorded on this day. Days with something on them are listed under "Jump to a day".
        </p>
      )}

      {!loading && !isEmpty && (
        <>
          {/* What the app already knows, before you write anything. */}
          <div className="card">
            <div className="section-label">The day at a glance</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 10 }}>
              <Stat label="Logged" value={fmtHours(totalMinutes)} />
              <Stat label="Tasks" value={topTasks.length ? `${tasksDone}/${topTasks.length}` : "—"} />
              <Stat label="Wins · losses" value={wins + losses > 0 ? `${wins} · ${losses}` : "—"} />
              <Stat label="Prayers" value={String((a.prayers ?? []).length || "—")} />
            </div>
            {a.energy_tag && (
              <div style={{ marginTop: 12 }}>
                <span className="pill" style={{ fontSize: 11 }}>{a.energy_tag}</span>
              </div>
            )}
            {timeByCategory.length > 0 && <CategoryStrip rows={timeByCategory} total={totalMinutes} />}
          </div>

          <GoalLinkSuggestions date={date} onApplied={reload} />

          <GoalFruits key={`fruits-${date}-${fruitsVersion}`} startDate={date} endDate={date} title="What today fed" />

          <JournalCard userId={user?.id} date={date} journal={a.journal} onSaved={reload} />

          {(a.chunks ?? []).length > 0 && <PlanSection chunks={a.chunks} tasks={tasks} />}
          {(a.experiences ?? []).length > 0 && <ExperienceSection entries={a.experiences} />}
          {(a.prayers ?? []).length > 0 && <PrayerSection entries={a.prayers} />}
          {(a.study_notes ?? []).length > 0 && <StudySection notes={a.study_notes} />}
          {(a.wins_losses ?? []).length > 0 && <WinLossSection entries={a.wins_losses} />}
          {(a.time_entries ?? []).length > 0 && <TimeSection entries={a.time_entries} />}

          <PlanProposals userId={user?.id} date={date} />
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2, fontFamily: "var(--font-display)" }}>{value}</div>
    </div>
  );
}

// A single proportional bar rather than one bar per category — at a day's
// scale the question is "what shape was this day", not "rank the twelve".
function CategoryStrip({ rows, total }) {
  if (total <= 0) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", gap: 2 }}>
        {rows.map((r, i) => (
          <div
            key={r.category}
            title={`${r.category} — ${fmtHours(r.minutes)}`}
            style={{
              width: `${(Number(r.minutes) / total) * 100}%`,
              background: intensityColor(1 - (i / Math.max(rows.length, 2)) * 0.75),
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {rows.slice(0, 6).map((r) => (
          <span key={r.category} className="pill" style={{ fontSize: 10.5, padding: "2px 8px" }}>
            {r.category} · {fmtHours(r.minutes)}
          </span>
        ))}
      </div>
    </div>
  );
}

// The three things the app cannot generate for you.
function JournalCard({ userId, date, journal, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [thoughts, setThoughts] = useState("");
  const [gratitude, setGratitude] = useState("");
  const [godsHand, setGodsHand] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setThoughts(journal?.thoughts ?? "");
    setGratitude(journal?.gratitude ?? "");
    setGodsHand(journal?.gods_hand ?? "");
    setEditing(false);
  }, [journal, date]);

  const hasAny = journal && (journal.thoughts || journal.gratitude || journal.gods_hand);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await saveJournalEntry(userId, date, { thoughts, gratitude, godsHand });
      setEditing(false);
      await onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="card">
        <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <PenLine size={12} />
          Journal
        </div>
        {hasAny ? (
          <>
            {journal.thoughts && <JournalBlock label="Thoughts" text={journal.thoughts} />}
            {journal.gratitude && <JournalBlock label="Gratitude" text={journal.gratitude} />}
            {journal.gods_hand && <JournalBlock label="Where I saw God's hand" text={journal.gods_hand} accent />}
            <button onClick={() => setEditing(true)} style={{ ...linkBtnStyle, marginTop: 8 }}>
              <PenLine size={11} />
              Edit
            </button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} style={{ ...linkBtnStyle, fontSize: 13 }}>
            <Plus size={12} />
            Write about this day
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
        <PenLine size={12} />
        Journal
      </div>
      <Field label="Thoughts" value={thoughts} onChange={setThoughts} placeholder="How did the day actually go?" rows={80} />
      <Field label="Gratitude" value={gratitude} onChange={setGratitude} placeholder="What are you grateful for?" rows={56} />
      <Field
        label="Where I saw God's hand"
        value={godsHand}
        onChange={setGodsHand}
        placeholder="Even a small thing. Especially a small thing."
        rows={56}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary" style={{ width: "auto", flex: 1, margin: 0 }} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, value, onChange, placeholder, rows }) {
  return (
    <div>
      <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, minHeight: rows, resize: "vertical", lineHeight: 1.6 }}
      />
    </div>
  );
}

function JournalBlock({ label, text, accent }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: accent ? "var(--accent-strong)" : "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap", fontFamily: "var(--font-display)" }}>{text}</div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="card">
      <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={12} />
        {title}
      </div>
      {children}
    </div>
  );
}

function PlanSection({ chunks, tasks }) {
  return (
    <Section icon={CheckSquare} title="The plan">
      {chunks.map((c) => {
        const own = tasks.filter((t) => t.time_chunk_id === c.id && !t.parent_task_id);
        const done = own.filter((t) => t.status).length;
        return (
          <div key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{c.title}</span>
              <span className="entry-meta">
                {fmtTime(c.start_time)}–{fmtTime(c.end_time)}
                {own.length > 0 ? ` · ${done}/${own.length}` : ""}
              </span>
            </div>
            {own.map((t) => (
              <div key={t.id} style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3, marginLeft: 2 }}>
                {t.status ? "✓" : "○"} <span style={{ textDecoration: t.status ? "line-through" : "none" }}>{t.title}</span>
              </div>
            ))}
          </div>
        );
      })}
    </Section>
  );
}

function ExperienceSection({ entries }) {
  return (
    <Section icon={Flame} title="What came">
      {entries.map((e) => (
        <div key={e.id} className="entry-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 10 }}>
            <span className="pill" style={{ fontSize: 10.5 }}>{KIND_LABEL[e.kind] ?? e.kind}</span>
            <span className="entry-meta">{timeOf(e.occurred_at)}</span>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{e.what_came}</div>
          {e.action_taken && <div style={{ fontSize: 12.5, color: "var(--accent-strong)" }}>Acted: {e.action_taken}</div>}
          {e.follow_up_notes && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{e.follow_up_notes}</div>}
          {!e.acted_on && <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Still open</span>}
        </div>
      ))}
    </Section>
  );
}

function PrayerSection({ entries }) {
  return (
    <Section icon={HandHeart} title="Prayers">
      {entries.map((p) => (
        <div key={p.id} className="entry-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{p.context || "Prayer"}</span>
            <span className="entry-meta">{timeOf(p.prayed_at)}</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{p.content}</div>
          {p.felt_response && <div style={{ fontSize: 12.5, color: "var(--accent-strong)" }}>Felt: {p.felt_response}</div>}
        </div>
      ))}
    </Section>
  );
}

function StudySection({ notes }) {
  return (
    <Section icon={BookOpen} title="Studied">
      {notes.map((n) => (
        <div key={n.id} className="entry-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</span>
            {/* A note with no verse reference falls back to its own title,
                which would otherwise print twice on the same row. */}
            {n.source_ref && n.source_ref !== n.title && <span className="entry-meta">{n.source_ref}</span>}
          </div>
          {(n.ai_theme || n.ai_summary) && (
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{n.ai_theme || toPlainText(n.ai_summary, 200)}</div>
          )}
        </div>
      ))}
    </Section>
  );
}

function WinLossSection({ entries }) {
  return (
    <Section icon={Plus} title="Wins & losses">
      {entries.map((w) => (
        <div key={w.id} className="entry-row">
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: w.kind === "win" ? "var(--accent-strong)" : "var(--danger)" }}>
            {w.kind === "win" ? <Plus size={12} /> : <Minus size={12} />}
            {w.habit_label}
            {w.note ? ` — ${w.note}` : ""}
          </span>
          <span className="entry-meta">{timeOf(w.occurred_at)}</span>
        </div>
      ))}
    </Section>
  );
}

function TimeSection({ entries }) {
  const [open, setOpen] = useState(false);
  const shown = open ? entries : entries.slice(0, 6);
  return (
    <Section icon={Clock} title={`Every entry · ${entries.length}`}>
      {shown.map((e) => (
        <div key={e.id} className="entry-row">
          <span style={{ minWidth: 0 }}>
            {e.category}
            {e.subcategory ? ` · ${e.subcategory}` : ""}
            {e.description ? ` — ${e.description}` : ""}
          </span>
          <span className="entry-meta">
            {e.duration_minutes != null ? fmtHours(e.duration_minutes) : "running"} · {timeOf(e.started_at)}
          </span>
        </div>
      ))}
      {entries.length > 6 && (
        <button onClick={() => setOpen((v) => !v)} style={{ ...linkBtnStyle, marginTop: 8 }}>
          {open ? "Show fewer" : `Show all ${entries.length}`}
        </button>
      )}
    </Section>
  );
}

// Days that actually have something on them, so paging back through months
// of record doesn't mean stepping over empty dates one arrow-press at a time.
function DayJumper({ days, current, onPick }) {
  const grouped = useMemo(() => {
    const map = new Map();
    for (const d of days) {
      const month = d.day.slice(0, 7);
      if (!map.has(month)) map.set(month, []);
      map.get(month).push(d);
    }
    return [...map.entries()];
  }, [days]);

  if (days.length === 0) return null;

  return (
    <div className="card" style={{ maxHeight: 260, overflowY: "auto" }}>
      {grouped.map(([month, list]) => (
        <div key={month} style={{ marginBottom: 10 }}>
          <div className="section-label" style={{ marginBottom: 6 }}>
            {parseDateStr(`${month}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {list.map((d) => (
              <button
                key={d.day}
                onClick={() => onPick(d.day)}
                title={d.has_journal ? "Has a journal entry" : undefined}
                style={{
                  background: d.day === current ? "var(--accent-dim)" : "var(--bg-inset)",
                  border: `1px solid ${d.day === current ? "var(--accent-strong)" : "var(--border)"}`,
                  color: d.has_journal ? "var(--accent-strong)" : "var(--text-muted)",
                  borderRadius: 6,
                  padding: "5px 9px",
                  fontSize: 11.5,
                  fontFamily: "var(--font-mono)",
                  fontWeight: d.has_journal ? 700 : 500,
                }}
              >
                {Number(d.day.slice(8))}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const navBtnStyle = {
  background: "var(--bg-inset)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--text)",
  flexShrink: 0,
};

const linkBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  background: "none",
  border: "none",
  color: "var(--accent-strong)",
  fontSize: 11.5,
  fontWeight: 700,
  padding: 0,
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
