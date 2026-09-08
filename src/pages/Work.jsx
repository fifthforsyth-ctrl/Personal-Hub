import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Copy,
  Check,
  Clock,
  Send,
  Camera,
  FileText,
  AlertTriangle,
  HelpCircle,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchWorkDay,
  addWorkNote,
  deleteWorkNote,
  saveWorkReport,
  fetchWorkCategories,
  setCategoryWork,
} from "../lib/api";
import ReportCard from "../components/work/ReportCard";
import { reportToText, fmtHours } from "../lib/workReport";
import { todayStr, addDays, fmtDayHeading } from "../lib/planDates";

const KINDS = [
  { key: "did", label: "Did", hint: "Something that got done", Icon: Check, color: "var(--good)" },
  { key: "blocked", label: "Blocked", hint: "Something you're stuck on", Icon: AlertTriangle, color: "var(--accent)" },
  { key: "question", label: "Question", hint: "Something to ask", Icon: HelpCircle, color: "var(--accent)" },
  { key: "note", label: "Note", hint: "Worth mentioning", Icon: MessageSquare, color: "var(--text-2)" },
];

// The work day, and reporting it.
//
// Planning still happens on the day card — a work task is a day task with a
// flag, and planning your day twice would be absurd. This page is the other
// half: the running list you add to as things happen, and the report that
// assembles itself out of it at the end.
//
// Kept off the reflection page deliberately. The questions there are about
// where you stood with God; this is about what to tell your boss. Sharing a
// page would cheapen both.
export default function Work() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayStr());
  const [work, setWork] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("text");
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const w = await fetchWorkDay(date);
      setWork(w);
      // A report you already edited is the one you keep; only fall back to the
      // freshly assembled text when there isn't one.
      setDraft(w?.report ?? (w ? reportToText(w) : ""));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    reload();
  }, [reload]);

  const assembled = useMemo(() => (work ? reportToText(work) : ""), [work]);
  const edited = draft !== assembled;
  const isToday = date === todayStr();

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      await saveWorkReport(date, draft, true);
      await reload();
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      setError("Couldn't copy — select the text and copy it manually.");
    }
  }

  return (
    <div className="page page--narrow">
      <div className="page-head">
        <div className="row" style={{ gap: 12 }}>
          <button className="btn-icon btn-icon--bordered" onClick={() => setDate((d) => addDays(d, -1))} title="Previous day">
            <ChevronLeft size={16} />
          </button>
          <div>
            <div className="eyebrow">Work</div>
            <h1 className="page-title" style={{ marginTop: 2 }}>{fmtDayHeading(date)}</h1>
          </div>
          <button className="btn-icon btn-icon--bordered" onClick={() => setDate((d) => addDays(d, 1))} title="Next day">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {work?.sent_at && (
            <span className="chip chip--accent">
              <Send size={11} />
              Sent {new Date(work.sent_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
          {!isToday && (
            <button className="btn" onClick={() => setDate(todayStr())}>Today</button>
          )}
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="stack">
        <div className="grid grid--stats">
          <Stat label="Tracked today" value={fmtHours(work?.minutes)} foot={`${(work?.entries ?? []).length} entries`} />
          <Stat
            label="Work tasks"
            value={
              (work?.tasks ?? []).length > 0
                ? `${(work?.tasks ?? []).filter((t) => t.done).length}/${(work?.tasks ?? []).length}`
                : "—"
            }
            foot="marked on your day plan"
          />
          <Stat label="Noted" value={String((work?.notes ?? []).length || "—")} foot="things to mention" />
        </div>

        <RunningList
          userId={user?.id}
          date={date}
          notes={work?.notes ?? []}
          onChanged={reload}
          onError={setError}
        />

        {(work?.tasks ?? []).length === 0 && (work?.notes ?? []).length === 0 && !loading && (
          <div className="card card--quiet">
            <p className="card-note" style={{ margin: 0 }}>
              No work tasks on this day yet. Mark a task as work on the{" "}
              <a href={`/day/${date}`}>day plan</a> and it'll appear here — or just write what you did in the box
              above and the report will be built from that.
            </p>
          </div>
        )}

        {/* The report. Text to paste, card to screenshot, same data. */}
        <div className="card">
          <div className="card-head" style={{ flexWrap: "wrap", gap: 10 }}>
            <span className="card-title"><Briefcase size={14} />End-of-day report</span>
            <div className="row" style={{ gap: 8 }}>
              <div className="seg">
                <button className={"seg-btn" + (view === "text" ? " active" : "")} onClick={() => setView("text")}>
                  <FileText size={13} /> Text
                </button>
                <button className={"seg-btn" + (view === "card" ? " active" : "")} onClick={() => setView("card")}>
                  <Camera size={13} /> Card
                </button>
              </div>
            </div>
          </div>

          {view === "text" ? (
            <>
              <textarea
                className="textarea"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                style={{ minHeight: 300, fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.7 }}
              />
              <div className="row row--between" style={{ marginTop: 11, gap: 10, flexWrap: "wrap" }}>
                <span className="faint" style={{ fontSize: 11.5 }}>
                  {edited ? "Edited — what you copy is what gets kept." : "Assembled from today. Edit freely before sending."}
                </span>
                <div className="row" style={{ gap: 8 }}>
                  {edited && (
                    <button className="btn btn--ghost" onClick={() => setDraft(assembled)}>Reset</button>
                  )}
                  <button className="btn btn--accent" onClick={copy}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "Copied" : "Copy report"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="card-note" style={{ marginBottom: 14 }}>
                Screenshot this. It's a fixed width with its own background, so a crop of it drops cleanly into a message.
              </p>
              <div style={{ overflowX: "auto", paddingBottom: 4 }}>
                {work && <ReportCard work={work} />}
              </div>
              <p className="faint" style={{ fontSize: 11.5, marginTop: 12 }}>
                The card always shows what's actually logged — edits you make to the text version stay in the text
                version, so the two can't quietly disagree about what you did.
              </p>
            </>
          )}
        </div>

        <WorkCategories userId={user?.id} onChanged={reload} />
      </div>
    </div>
  );
}

function Stat({ label, value, foot }) {
  return (
    <div className="stat">
      <div className="stat-top"><span className="stat-label">{label}</span></div>
      <div className="stat-value">{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  );
}

// The thing you add to all day. One line, one press.
function RunningList({ userId, date, notes, onChanged, onError }) {
  const [kind, setKind] = useState("did");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await addWorkNote(userId, date, { kind, body });
      setBody("");
      await onChanged();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title"><MessageSquare size={14} />Tell Parker</span>
        <span className="faint" style={{ fontSize: 11.5 }}>Write it when it happens, not at five o'clock</span>
      </div>

      <form onSubmit={submit}>
        <input
          className="input input--lg"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={KINDS.find((k) => k.key === kind)?.hint}
        />
        <div className="row row--between" style={{ marginTop: 10, gap: 10, flexWrap: "wrap" }}>
          <div className="row" style={{ gap: 5, flexWrap: "wrap" }}>
            {KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                className="chip"
                onClick={() => setKind(k.key)}
                style={{
                  cursor: "pointer",
                  borderColor: kind === k.key ? k.color : "var(--line)",
                  background: kind === k.key ? "var(--inset)" : "transparent",
                  color: kind === k.key ? "var(--text)" : "var(--text-2)",
                  fontWeight: kind === k.key ? 620 : 500,
                }}
              >
                <k.Icon size={11} />
                {k.label}
              </button>
            ))}
          </div>
          <button type="submit" className="btn btn--accent" disabled={busy || !body.trim()}>
            <Plus size={14} />
            Add
          </button>
        </div>
      </form>

      {notes.length > 0 && (
        <div className="list" style={{ marginTop: 14 }}>
          {notes.map((n) => {
            const k = KINDS.find((x) => x.key === n.kind) ?? KINDS[0];
            return (
              <div key={n.id} className="list-row">
                <k.Icon size={13} style={{ color: k.color, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>{n.body}</span>
                <span className="list-row__meta">
                  {new Date(n.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
                <button
                  className="btn-icon"
                  style={{ width: 26, height: 26 }}
                  onClick={async () => {
                    await deleteWorkNote(n.id);
                    await onChanged();
                  }}
                  title="Remove"
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Which categories count toward the hours. Shown here rather than buried in
// settings, because when the number looks wrong this is the only place that
// explains why.
function WorkCategories({ userId, onChanged }) {
  const [cats, setCats] = useState([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setCats(await fetchWorkCategories(userId).catch(() => []));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const work = cats.filter((c) => c.is_work);

  return (
    <div className="card card--quiet">
      <div className="card-head" style={{ marginBottom: open ? 14 : 0 }}>
        <span className="card-title"><Clock size={14} />What counts as work time</span>
        <button className="btn-link" onClick={() => setOpen((v) => !v)}>
          {open ? "Done" : work.length > 0 ? work.map((c) => c.name).join(", ") : "Nothing marked yet"}
        </button>
      </div>

      {open && (
        <>
          <p className="card-note" style={{ marginBottom: 12 }}>
            Hours are summed from time you tracked under these. An entry with two work categories still only counts
            once.
          </p>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {cats.map((c) => (
              <button
                key={c.id}
                className="chip"
                onClick={async () => {
                  await setCategoryWork(c.id, !c.is_work);
                  await load();
                  await onChanged();
                }}
                style={{
                  cursor: "pointer",
                  borderColor: c.is_work ? c.color : "var(--line)",
                  background: c.is_work ? `${c.color}22` : "transparent",
                  color: c.is_work ? "var(--text)" : "var(--text-2)",
                  fontWeight: c.is_work ? 620 : 500,
                }}
              >
                <span className="dot" style={{ background: c.color, width: 6, height: 6 }} />
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
