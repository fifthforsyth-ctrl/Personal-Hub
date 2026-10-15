import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Copy,
  Check,
  Clock,
  Camera,
  FileText,
  AlertTriangle,
  HelpCircle,
  MessageSquare,
  CalendarDays,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchWorkDay,
  fetchDayPlan,
  patchDayPlan,
  addWorkNote,
  deleteWorkNote,
  saveWorkReport,
  fetchWorkCategories,
  setCategoryWork,
} from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { useToast } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import ReportCard from "../components/work/ReportCard";
import { reportToText, fmtHours } from "../lib/workReport";
import { todayStr, addDays, fmtDayHeading } from "../lib/planDates";
import "../styles/plan.css";

// Blocked is the one that needs Parker, so it's the one in red. A question
// is ordinary ink; done is green.
const KINDS = [
  { key: "did", label: "Did", hint: "Something that got done", Icon: Check, color: "var(--good-text)" },
  { key: "blocked", label: "Blocked", hint: "Something you're stuck on", Icon: AlertTriangle, color: "var(--danger)" },
  { key: "question", label: "Question", hint: "Something to ask", Icon: HelpCircle, color: "var(--text)" },
  { key: "note", label: "Note", hint: "Worth mentioning", Icon: MessageSquare, color: "var(--text-2)" },
];

const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

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
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [date, setDate] = useState(todayStr());
  const [view, setView] = useState("text");
  // The day's own line, "What I shipped", lives on the day plan and rides
  // along with the work day so the report can put it first.
  const { data: work, error, reload, mutate } = useLoad(async () => {
    const [day, plan] = await Promise.all([fetchWorkDay(date), user?.id ? fetchDayPlan(user.id, date) : null]);
    return day ? { ...day, shipped: plan?.shipped ?? null } : day;
  }, [date, user?.id]);

  // The report text. It follows the list (notes and work tasks) until you
  // type in it; from then on your words stay, through new notes and
  // refreshes, and are saved for this day as you go. Text that matches the
  // built report isn't stored at all, so an untouched report keeps
  // following the list instead of freezing at whatever it said when copied.
  const assembled = useMemo(() => (work ? reportToText(work) : ""), [work]);
  const [draft, setDraft] = useState(null); // { date, text } once typed in
  const mine = draft?.date === date ? draft.text : null;
  const shown = mine ?? work?.report ?? assembled;
  const edited = Boolean(work) && shown !== assembled;

  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [copying, setCopying] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const pending = useRef(null); // { date, text, assembled, timer }

  const patchWork = (d, fn) => mutate((w) => (w && w.date === d ? fn(w) : w));

  async function flush() {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    clearTimeout(p.timer);
    const value = p.text === p.assembled ? null : p.text;
    setSaveState("saving");
    try {
      await saveWorkReport(p.date, value, false);
      patchWork(p.date, (w) => ({ ...w, report: value }));
      setSaveState("saved");
    } catch (err) {
      // Kept, so the next edit or Copy tries again.
      if (!pending.current) pending.current = { ...p, timer: null };
      setSaveState("error");
      toastRef.current.error(err, "Couldn't save your edits to the report.");
    }
  }
  const flushRef = useRef(flush);
  flushRef.current = flush;

  function edit(text) {
    setDraft({ date, text });
    clearTimeout(pending.current?.timer);
    const entry = { date, text, assembled };
    entry.timer = setTimeout(() => flushRef.current(), 900);
    pending.current = entry;
    setSaveState("idle");
  }

  // Edits are saved before the day changes, the page closes, or the app
  // goes to the background.
  useEffect(() => {
    setSaveState("idle");
    return () => {
      flushRef.current();
    };
  }, [date]);
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flushRef.current();
    const onPageHide = () => flushRef.current();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  async function reset() {
    const d = date;
    const had = work?.report ?? null;
    clearTimeout(pending.current?.timer);
    pending.current = null;
    setDraft(null);
    patchWork(d, (w) => ({ ...w, report: null }));
    try {
      await saveWorkReport(d, null, false);
      setSaveState("idle");
    } catch (err) {
      patchWork(d, (w) => ({ ...w, report: had }));
      toast.error(err, "Couldn't reset the report.");
    }
  }

  // Copying is the moment it goes to Parker, so that's when it's stamped.
  // Unedited text is stamped without being stored (see above).
  async function copy() {
    if (copying || !work) return;
    const d = date;
    const text = shown;
    const value = edited ? text : null;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      setCopying(false);
      toast.error(err, "Couldn't copy. Select the text and copy it yourself.");
      return;
    }
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2200);
    clearTimeout(pending.current?.timer);
    pending.current = null;
    try {
      await saveWorkReport(d, value, true);
      const now = new Date().toISOString();
      patchWork(d, (w) => ({ ...w, report: value, sent_at: now }));
      setSaveState("idle");
    } catch (err) {
      if (value != null) pending.current = { date: d, text, assembled, timer: null };
      toast.error(err, "Copied, but couldn't save the report for this day.");
    } finally {
      setCopying(false);
    }
  }

  const isToday = date === todayStr();
  const tasks = work?.tasks ?? [];
  const notes = work?.notes ?? [];

  return (
    <div className="page page--narrow">
      <div className="page-head">
        <div className="row" style={{ gap: 12 }}>
          <button
            className="btn-icon btn-icon--bordered"
            onClick={() => setDate((d) => addDays(d, -1))}
            aria-label="Previous day"
            title="Previous day"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <div className="eyebrow">Work</div>
            <h1 className="page-title" style={{ marginTop: 2 }}>{fmtDayHeading(date)}</h1>
          </div>
          <button
            className="btn-icon btn-icon--bordered"
            onClick={() => setDate((d) => addDays(d, 1))}
            aria-label="Next day"
            title="Next day"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {work?.sent_at && (
            <span className="chip" title="When the report was last copied">
              <Copy size={11} />
              Copied {clock(work.sent_at)}
            </span>
          )}
          {!isToday && (
            <button className="btn btn--on-page" onClick={() => setDate(todayStr())}>
              <CalendarDays size={14} />
              Today
            </button>
          )}
        </div>
      </div>

      <div className="stack">
        {error && !work && <LoadError what="this work day" error={error} onRetry={reload} />}
        {error && work && <LoadError stale error={error} onRetry={reload} />}

        <div className="work-stats">
          <Stat label="Tracked" value={work ? fmtHours(work.minutes) : "—"} foot={work ? `${(work.entries ?? []).length} entries` : " "} />
          <Stat
            label="Work tasks"
            value={tasks.length > 0 ? `${tasks.filter((t) => t.done).length}/${tasks.length}` : "—"}
            foot="on the day plan"
          />
          <Stat label="Noted" value={String(notes.length || "—")} foot="to mention" />
        </div>

        <Shipped
          key={date}
          userId={user?.id}
          date={date}
          value={work?.shipped ?? ""}
          ready={Boolean(work)}
          onSaved={(text) => patchWork(date, (w) => ({ ...w, shipped: text }))}
        />

        <RunningList
          userId={user?.id}
          date={date}
          notes={notes}
          onAdded={reload}
          onRemoved={(id) => patchWork(date, (w) => ({ ...w, notes: (w.notes ?? []).filter((n) => n.id !== id) }))}
        />

        {work && tasks.length === 0 && notes.length === 0 && (
          <div className="card card--quiet">
            <p className="card-note" style={{ margin: 0 }}>
              No work tasks on this day yet. Mark a task as work on the <Link to={`/day/${date}`}>day plan</Link> (its ⋯
              button) and it'll show up here — or write what you did in the box above, and the report is built from that.
            </p>
          </div>
        )}

        {/* The report. Text to paste, card to screenshot, same data. */}
        <div className="card">
          <div className="card-head" style={{ flexWrap: "wrap", gap: 10 }}>
            <span className="card-title"><Briefcase size={14} />End-of-day report</span>
            <div className="seg" role="group" aria-label="Report view">
              <button className={"seg-btn" + (view === "text" ? " active" : "")} aria-pressed={view === "text"} onClick={() => setView("text")}>
                <FileText size={13} /> Text
              </button>
              <button className={"seg-btn" + (view === "card" ? " active" : "")} aria-pressed={view === "card"} onClick={() => setView("card")}>
                <Camera size={13} /> Card
              </button>
            </div>
          </div>

          {view === "text" ? (
            <>
              <textarea
                className="textarea"
                value={shown}
                onChange={(e) => edit(e.target.value)}
                disabled={!work}
                placeholder={work ? "" : "Loading…"}
                aria-label="Report text"
                style={{ minHeight: 300, fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.7 }}
              />
              <div className="row row--between" style={{ marginTop: 11, gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                <span className="faint" style={{ fontSize: 12, flex: "1 1 220px", lineHeight: 1.5 }}>
                  {saveState === "error"
                    ? "Your edits aren't saved yet."
                    : saveState === "saving"
                      ? "Saving your edits…"
                      : edited
                        ? "Edited — saved for this day. Reset rebuilds it from the list above."
                        : "Built from this day's notes and work tasks. Edit it before you copy if you like."}
                  {saveState === "error" && (
                    <>
                      {" "}
                      <button className="btn-link btn-link--accent" onClick={() => flushRef.current()}>Try again</button>
                    </>
                  )}
                </span>
                <div className="row" style={{ gap: 8 }}>
                  {edited && (
                    <button className="btn btn--ghost" onClick={reset} disabled={copying}>Reset</button>
                  )}
                  <button className="btn btn--accent" onClick={copy} disabled={!work || copying}>
                    {justCopied ? <Check size={14} /> : <Copy size={14} />}
                    {justCopied ? "Copied" : "Copy report"}
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
              <p className="faint" style={{ fontSize: 12, marginTop: 12, lineHeight: 1.5 }}>
                The card shows what's logged for this day. Edits to the text version stay in the text version.
              </p>
            </>
          )}
        </div>

        <WorkCategories userId={user?.id} onChanged={reload} />
      </div>
    </div>
  );
}

// One line for the day's real output, written once, near the end of the
// day. It saves when you leave the field (or press Enter) and heads the
// report.
function Shipped({ userId, date, value, ready, onSaved }) {
  const toast = useToast();
  const [text, setText] = useState(value);
  const saved = useRef(value);
  const typed = useRef(false);

  // The saved line arrives after the page opens; it fills the field unless
  // you've already started typing.
  useEffect(() => {
    saved.current = value;
    if (!typed.current) setText(value);
  }, [value]);

  async function save() {
    const t = text.trim();
    if (!userId || t === (saved.current ?? "").trim()) return;
    const was = saved.current;
    saved.current = t;
    onSaved(t || null);
    try {
      await patchDayPlan(userId, date, { shipped: t || null });
    } catch (err) {
      saved.current = was;
      onSaved(was || null);
      toast.error(err, "Couldn't save what you shipped. Try again.");
    }
  }

  return (
    <form
      className="card work-shipped"
      onSubmit={(e) => {
        e.preventDefault();
        save();
        e.currentTarget.querySelector("input")?.blur();
      }}
    >
      <label className="work-shipped__label" htmlFor="work-shipped">What I shipped</label>
      <input
        id="work-shipped"
        className="input"
        value={text}
        onChange={(e) => {
          typed.current = true;
          setText(e.target.value);
        }}
        onBlur={save}
        disabled={!ready}
        placeholder="The one thing that went out today (optional)"
        maxLength={300}
      />
    </form>
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
function RunningList({ userId, date, notes, onAdded, onRemoved }) {
  const toast = useToast();
  const [kind, setKind] = useState("did");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(() => new Set());

  async function submit(e) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await addWorkNote(userId, date, { kind, body });
      setBody("");
      onAdded();
    } catch (err) {
      toast.error(err, "Couldn't add that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function remove(n) {
    setHidden((h) => new Set(h).add(n.id));
    const unhide = () =>
      setHidden((h) => {
        const next = new Set(h);
        next.delete(n.id);
        return next;
      });
    toast.undoable({
      message: "Note deleted",
      run: async () => {
        await deleteWorkNote(n.id);
        onRemoved(n.id);
        unhide();
      },
      onUndo: unhide,
    });
  }

  const shown = notes.filter((n) => !hidden.has(n.id));

  return (
    <div className="card">
      <div className="card-head" style={{ flexWrap: "wrap" }}>
        <span className="card-title"><MessageSquare size={14} />Tell Parker</span>
        <span className="faint" style={{ fontSize: 11.5 }}>Write it when it happens, not at five o'clock</span>
      </div>

      <form onSubmit={submit}>
        <input
          className="input input--lg"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={KINDS.find((k) => k.key === kind)?.hint}
          aria-label="What happened"
        />
        <div className="row row--between" style={{ marginTop: 10, gap: 10, flexWrap: "wrap" }}>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }} role="group" aria-label="Kind of note">
            {KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                className="toggle-chip"
                aria-pressed={kind === k.key}
                onClick={() => setKind(k.key)}
              >
                <k.Icon size={12} style={{ color: kind === k.key ? "inherit" : k.color }} />
                {k.label}
              </button>
            ))}
          </div>
          <button type="submit" className="btn btn--accent" disabled={busy || !body.trim()}>
            <Plus size={14} />
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
      </form>

      {shown.length > 0 && (
        <div className="list" style={{ marginTop: 14 }}>
          {shown.map((n) => {
            const k = KINDS.find((x) => x.key === n.kind) ?? KINDS[0];
            return (
              <div key={n.id} className="list-row" style={{ alignItems: "flex-start" }}>
                <k.Icon size={13} style={{ color: k.color, flexShrink: 0, marginTop: 3 }} aria-hidden="true" />
                <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                  <span className="plan-sr">{k.label}: </span>
                  {n.body}
                </span>
                {n.at && <span className="list-row__meta" style={{ marginTop: 2 }}>{clock(n.at)}</span>}
                <button
                  className="btn-icon"
                  style={{ marginTop: -8, marginBottom: -8 }}
                  onClick={() => remove(n)}
                  aria-label={`Delete note: ${n.body}`}
                  title="Delete note"
                >
                  <X size={14} />
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
  const toast = useToast();
  const { data: cats, error, reload, mutate } = useLoad(() => (userId ? fetchWorkCategories(userId) : []), [userId]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);

  const work = (cats ?? []).filter((c) => c.is_work);

  async function toggle(c) {
    if (busy) return;
    setBusy(c.id);
    mutate((list) => list?.map((x) => (x.id === c.id ? { ...x, is_work: !c.is_work } : x)));
    try {
      await setCategoryWork(c.id, !c.is_work);
      onChanged();
    } catch (err) {
      mutate((list) => list?.map((x) => (x.id === c.id ? { ...x, is_work: c.is_work } : x)));
      toast.error(err, "Couldn't change that category.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card card--quiet">
      <div className="card-head" style={{ marginBottom: 8 }}>
        <span className="card-title"><Clock size={14} />What counts as work time</span>
        <button className="btn btn--sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Done" : "Change"}
        </button>
      </div>

      {error && !cats && <LoadError what="your categories" error={error} onRetry={reload} />}

      {!open && cats && (
        <p className="card-note" style={{ margin: 0 }}>
          {work.length > 0 ? work.map((c) => c.name).join(", ") : "Nothing marked yet, so no hours are counted."}
        </p>
      )}

      {open && cats && (
        <>
          <p className="card-note" style={{ marginBottom: 12 }}>
            Hours are summed from time you tracked under these. An entry with two work categories still only counts
            once.
          </p>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {cats.map((c) => (
              <button
                key={c.id}
                type="button"
                className="toggle-chip"
                aria-pressed={c.is_work}
                disabled={busy === c.id}
                onClick={() => toggle(c)}
              >
                <span className="dot" style={{ background: c.color, width: 7, height: 7 }} />
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
