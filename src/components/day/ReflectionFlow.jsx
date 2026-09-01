import { useEffect, useState } from "react";
import { PenLine, Check, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { saveJournalEntry } from "../../lib/api";

// The three centering questions, plus gratitude, plus the open journal.
//
// They are asked one at a time rather than as a wall of five boxes: a page of
// empty textareas gets skimmed, a single question gets answered. The wording
// is fixed on purpose — a prompt you can edit is a prompt you will soften on
// the night you most need it asked straight.
export const PROMPTS = [
  {
    key: "qChrist",
    label: "Centered",
    question: "Where was I centered on God and Jesus Christ today — and where did I act as though I were on my own?",
    placeholder: "Be specific about a moment, not a general grade.",
  },
  {
    key: "qPrinciples",
    label: "Principles",
    question: "Did today's choices match the principles I say I hold? Name the one that held and the one that slipped.",
    placeholder: "The one that slipped matters more than the one that held.",
  },
  {
    key: "qSuccess",
    label: "Direction",
    question: "Was what I did today actually moving me toward what I'm trying to become, or only toward being busy?",
    placeholder: "What would tomorrow look like if the answer is no?",
  },
  {
    key: "gratitude",
    label: "Gratitude",
    question: "What am I grateful for, and where did I see God's hand today?",
    placeholder: "List them. Even the small ones — especially the small ones.",
  },
  {
    key: "thoughts",
    label: "Journal",
    question: "Anything else about today.",
    placeholder: "How the day actually went, in your own words.",
  },
];

function toState(journal) {
  return {
    qChrist: journal?.q_christ ?? "",
    qPrinciples: journal?.q_principles ?? "",
    qSuccess: journal?.q_success ?? "",
    gratitude: journal?.gratitude ?? "",
    thoughts: journal?.thoughts ?? "",
    godsHand: journal?.gods_hand ?? "",
  };
}

export default function ReflectionFlow({ userId, date, journal, onSaved }) {
  const [answers, setAnswers] = useState(() => toState(journal));
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setAnswers(toState(journal));
    setRunning(false);
    setStep(0);
  }, [journal, date]);

  const completed = Boolean(journal?.reflection_completed_at);
  const hasAny = PROMPTS.some((p) => (answers[p.key] ?? "").trim()) || Boolean(answers.godsHand.trim());

  async function save({ finish = false } = {}) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveJournalEntry(userId, date, { ...answers, completed: finish });
      if (finish) setRunning(false);
      await onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // --- not started ---------------------------------------------------------
  if (!running) {
    return (
      <div className={"card" + (completed ? "" : " card--accent")}>
        <div className="card-head">
          <span className="card-title"><PenLine size={14} />Reflection</span>
          {completed && <span className="chip chip--accent"><Check size={12} />Done</span>}
        </div>

        {hasAny ? (
          <>
            {PROMPTS.map((p) =>
              (answers[p.key] ?? "").trim() ? (
                <div key={p.key} style={{ marginBottom: 16 }}>
                  <div className="eyebrow" style={{ marginBottom: 5 }}>{p.label}</div>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6, fontFamily: "var(--font-serif)" }}>{p.question}</div>
                  <div className="prose">{answers[p.key]}</div>
                </div>
              ) : null
            )}
            {/* Older entries wrote gratitude and God's hand into two separate
                fields; the question now asks for both at once, so an existing
                gods_hand still has to be shown. */}
            {answers.godsHand.trim() && (
              <div style={{ marginBottom: 16 }}>
                <div className="eyebrow" style={{ marginBottom: 5 }}>Where I saw God's hand</div>
                <div className="prose">{answers.godsHand}</div>
              </div>
            )}
            <button className="btn" onClick={() => { setStep(0); setRunning(true); }}>
              <PenLine size={14} />
              {completed ? "Revisit the reflection" : "Continue reflecting"}
            </button>
          </>
        ) : (
          <>
            <p className="card-note" style={{ marginBottom: 14 }}>
              Five questions: three to check where you actually stood today, one for gratitude and God's hand,
              and one open page. Answer them when the day is done, not while it's still moving.
            </p>
            <button className="btn btn--accent" onClick={() => { setStep(0); setRunning(true); }}>
              <Sparkles size={15} />
              Start reflection
            </button>
          </>
        )}
      </div>
    );
  }

  // --- in progress ---------------------------------------------------------
  const prompt = PROMPTS[step];
  const isLast = step === PROMPTS.length - 1;

  return (
    <div className="card card--accent">
      <div className="card-head">
        <span className="card-title"><PenLine size={14} />Reflection</span>
        <span className="mono faint" style={{ fontSize: 11.5 }}>{step + 1} / {PROMPTS.length}</span>
      </div>

      {/* Progress reads as five steps rather than a bar — you can see how many
          are left, and jump back to one you want to change. */}
      <div className="row" style={{ gap: 4, marginBottom: 18 }}>
        {PROMPTS.map((p, i) => (
          <button
            key={p.key}
            onClick={() => setStep(i)}
            title={p.label}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 999,
              border: "none",
              padding: 0,
              background: i === step ? "var(--accent)" : (answers[p.key] ?? "").trim() ? "var(--accent-line)" : "var(--inset)",
            }}
          />
        ))}
      </div>

      <div className="eyebrow" style={{ marginBottom: 6 }}>{prompt.label}</div>
      <p className="question">{prompt.question}</p>

      <textarea
        key={prompt.key}
        className="textarea"
        value={answers[prompt.key]}
        onChange={(e) => setAnswers((a) => ({ ...a, [prompt.key]: e.target.value }))}
        placeholder={prompt.placeholder}
        style={{ minHeight: 148, fontFamily: "var(--font-serif)", fontSize: 15 }}
        autoFocus
      />

      {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}

      <div className="row row--between" style={{ marginTop: 14, gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn--ghost" onClick={() => { save(); setRunning(false); }} disabled={busy}>
          Save &amp; close
        </button>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ChevronLeft size={14} />
            Back
          </button>
          {isLast ? (
            <button className="btn btn--accent" onClick={() => save({ finish: true })} disabled={busy}>
              <Check size={15} />
              {busy ? "Saving…" : "Finish reflection"}
            </button>
          ) : (
            <button
              className="btn btn--accent"
              onClick={() => {
                save();
                setStep((s) => s + 1);
              }}
              disabled={busy}
            >
              Next
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
