import { useEffect, useRef, useState } from "react";
import { Sparkles, Check, RefreshCw, ChevronDown, ChevronRight, Lock, CalendarCheck, Pencil } from "lucide-react";
import {
  proposePlans,
  applyProposedPlan,
  setDayNotes,
  fetchDayPlan,
  fetchIdealDays,
  idealDayFor,
  fetchTimeChunks,
} from "../../lib/api";
import { addDays, fmtDayHeading, fmtTimeRange, todayStr } from "../../lib/planDates";
import { useLoad } from "../../lib/useLoad";
import { friendlyError } from "../../lib/errors";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import PlanEditor from "./PlanEditor";
import "../../styles/plan.css";

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// The last step of the evening, kept small on purpose. The week gets planned
// on Sunday; most evenings tomorrow simply follows it, so this card says
// what tomorrow holds and stays closed until you want to change it.
//
// Opened, it runs in order: write down what the app can't know about
// tomorrow, then ask for three plans, then pick one. The notes box comes
// BEFORE the button on purpose — everything else the assistant reads is
// history; this is the only place a fixed appointment or "I'm exhausted"
// can enter the picture.
export default function Tomorrow({ userId, date, reflectionDone }) {
  const tomorrow = addDays(date, 1);
  const toast = useToast();

  const { data, error, reload } = useLoad(async () => {
    if (!userId || tomorrow < todayStr()) return null;
    const [plan, idealDays, chunks] = await Promise.all([
      fetchDayPlan(userId, tomorrow),
      fetchIdealDays(userId),
      fetchTimeChunks(userId, tomorrow),
    ]);
    // Which ideal day governs tomorrow, and what the week planner already
    // put on it. When there are blocks, the day plan follows them rather
    // than re-deciding the day.
    return { notes: plan?.notes ?? "", ideal: idealDayFor(idealDays, tomorrow), committed: chunks ?? [] };
  }, [userId, tomorrow]);

  const [open, setOpen] = useState(false);
  // What you've typed, and what was last written — both for one date only,
  // so moving to another day never carries a note across.
  const [edit, setEdit] = useState(null);
  const [saved, setSaved] = useState(null);
  const [result, setResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [problem, setProblem] = useState(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(null);
  const [openPlan, setOpenPlan] = useState(0);
  const [drafting, setDrafting] = useState(null); // index of the plan being edited
  const runRef = useRef(0);

  useEffect(() => {
    runRef.current += 1;
    setOpen(false);
    setResult(null);
    setGenerating(false);
    setProblem(null);
    setApplied(null);
    setDrafting(null);
  }, [tomorrow]);

  const loadedNotes = data?.notes ?? "";
  const notes = edit?.date === tomorrow ? edit.text : loadedNotes;
  const savedNotes = saved?.date === tomorrow ? saved.text : loadedNotes;
  const unsaved = notes !== savedNotes;
  const committed = data?.committed ?? [];
  const ideal = data?.ideal ?? null;

  // Only when something changed, and only once the saved note has loaded —
  // otherwise leaving an empty box would wipe a note that was already there.
  async function saveNotes() {
    if (!data || !unsaved) return true;
    const forDate = tomorrow;
    const text = notes;
    try {
      await setDayNotes(userId, forDate, text);
    } catch (err) {
      toast.error(err, "Couldn't save your note for tomorrow.");
      return false;
    }
    setSaved({ date: forDate, text });
    return true;
  }

  async function generate() {
    if (generating) return;
    const run = ++runRef.current;
    setGenerating(true);
    setProblem(null);
    setApplied(null);
    setDrafting(null);
    // Persist first: the plan you get should always be the plan your notes
    // asked for, even if you never left the text box.
    if (!(await saveNotes())) {
      if (run === runRef.current) setGenerating(false);
      return;
    }
    try {
      const answer = await proposePlans({ notes, forDate: tomorrow });
      if (run !== runRef.current) return;
      setResult(answer);
      setOpenPlan(0);
    } catch (err) {
      if (run !== runRef.current) return;
      setProblem(friendlyError(err, "Couldn't get plans for tomorrow. Try again."));
    } finally {
      if (run === runRef.current) setGenerating(false);
    }
  }

  async function commit(plan) {
    if (applying) return;
    const forDate = result.for_date ?? tomorrow;
    const which = drafting;
    setApplying(true);
    setProblem(null);
    try {
      await applyProposedPlan(userId, forDate, plan);
    } catch (err) {
      setProblem(friendlyError(err, "Couldn't put that plan on tomorrow. Try again."));
      setApplying(false);
      return;
    }
    setApplying(false);
    setApplied(which);
    setDrafting(null);
    reload();
  }

  // A day long past has no tomorrow left to plan.
  if (tomorrow < todayStr()) return null;

  const status =
    committed.length > 0
      ? `Following this week's plan — ${plural(committed.length, "block")}.`
      : ideal
        ? `Nothing planned yet. It would start from your ideal ${ideal.name} — change that under Week → Ideal.`
        : "Nothing planned yet.";

  return (
    <div className="card tomorrow-card">
      <div className="card-head">
        <span className="card-title"><CalendarCheck size={14} />Tomorrow · {fmtDayHeading(tomorrow)}</span>
        {!reflectionDone && (
          <span className="chip"><Lock size={11} />Reflect first</span>
        )}
      </div>

      {error && !data && <LoadError what="tomorrow's plan" error={error} onRetry={reload} />}
      {error && data && <LoadError stale error={error} onRetry={reload} />}

      {data && drafting === null && <p className="tomorrow__status">{status}</p>}

      {!reflectionDone && (
        <p className="card-note" style={{ margin: "0 0 12px" }}>
          Reflect on today first, then you can adjust tomorrow.
        </p>
      )}

      {!open && (
        <button className="btn btn--sm" onClick={() => setOpen(true)} disabled={!reflectionDone || !data}>
          <Pencil size={13} />
          {committed.length > 0 ? "Adjust tomorrow" : "Plan tomorrow"}
        </button>
      )}

      {open && drafting === null && (
        <>
          <label className="field">
            <span>Anything the assistant should know about tomorrow?</span>
            <textarea
              className="textarea"
              value={notes}
              disabled={!reflectionDone || !data}
              onChange={(e) => setEdit({ date: tomorrow, text: e.target.value })}
              onBlur={saveNotes}
              placeholder="Zone conference at 10 — move the morning block. Low energy, keep it light. Otherwise leave the week's shape alone."
              style={{ minHeight: 76 }}
            />
          </label>

          <div className="row row--between" style={{ flexWrap: "wrap", gap: 8, marginTop: -6 }}>
            <span className="faint" style={{ fontSize: 11.5 }}>
              {notes.trim()
                ? unsaved
                  ? "Not saved yet — it's saved when you leave the box or ask for plans."
                  : "Saved to tomorrow."
                : committed.length > 0
                  ? "This is the only thing that can move the week's plan for tomorrow."
                  : "Read alongside your last two weeks."}
            </span>
            {!result && (
              <button className="btn btn--accent" onClick={generate} disabled={generating || !reflectionDone || !data}>
                <Sparkles size={15} />
                {generating ? "Reading the last two weeks…" : "Suggest plans"}
              </button>
            )}
          </div>
        </>
      )}

      {problem && <div className="form-error" style={{ marginTop: 12 }}>{problem}</div>}

      {result && drafting !== null && (
        <PlanEditor
          plan={result.plans[drafting]}
          date={result.for_date ?? tomorrow}
          onCommit={commit}
          onBack={() => setDrafting(null)}
          busy={applying}
        />
      )}

      {open && result && drafting === null && result.plans?.map((plan, i) => {
        const isOpen = openPlan === i;
        return (
          <div key={i} className={"tomorrow-plan" + (isOpen ? " tomorrow-plan--open" : "")}>
            <button
              onClick={() => setOpenPlan(isOpen ? -1 : i)}
              className="tomorrow-plan__head"
              aria-expanded={isOpen}
            >
              {isOpen ? <ChevronDown size={15} style={{ marginTop: 2, flexShrink: 0 }} /> : <ChevronRight size={15} style={{ marginTop: 2, flexShrink: 0 }} />}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 620, fontSize: 14.5 }}>{plan.name}</span>
                <span className="muted" style={{ display: "block", fontSize: 12.5, marginTop: 2 }}>{plan.strategy}</span>
              </span>
            </button>

            {isOpen && (
              <>
                <p className="card-note" style={{ margin: "11px 0 12px" }}>{plan.rationale}</p>

                <div className="list">
                  {(plan.blocks ?? []).map((b, n) => (
                    <div key={n} style={{ padding: "8px 0" }}>
                      <div className="row row--between" style={{ alignItems: "baseline", gap: 10 }}>
                        <span style={{ fontWeight: 570, fontSize: 13.5, minWidth: 0, overflowWrap: "anywhere" }}>{b.title}</span>
                        <span className="list-row__meta">{b.start && b.end ? fmtTimeRange(b.start, b.end) : ""}</span>
                      </div>
                      {(b.tasks ?? []).map((t, k) => (
                        <div key={k} className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>○ {t}</div>
                      ))}
                    </div>
                  ))}
                </div>

                {applied === i ? (
                  <div className="row" style={{ gap: 6, marginTop: 12, fontSize: 13, color: "var(--good-text)" }}>
                    <Check size={15} />
                    {fmtDayHeading(result.for_date ?? tomorrow)} is planned.
                  </div>
                ) : (
                  <button
                    className="btn btn--accent"
                    style={{ marginTop: 12 }}
                    onClick={() => setDrafting(i)}
                    disabled={applied !== null}
                  >
                    <Pencil size={14} />
                    Take this one and edit it
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}

      {open && result && drafting === null && (
        <button className="btn-link" style={{ marginTop: 12, minHeight: 36 }} onClick={generate} disabled={generating}>
          <RefreshCw size={12} />
          {generating ? "Reading the last two weeks…" : "Suggest again"}
        </button>
      )}
    </div>
  );
}
