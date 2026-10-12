import { useEffect, useState } from "react";
import { PenLine, Check, ChevronLeft, ChevronRight, Sparkles, HandHeart } from "lucide-react";
import { saveJournalEntry, generateReflectionQuestions } from "../../lib/api";

// The evening's four cards.
//
// 1. Where did you see God's hand today? Always asked, worded the same every
//    night, with a one-line nudge under it pointing at something in the day.
// 2. A question toward the Savior, and
// 3. a question about what today can teach you. Both are written fresh each
//    night from what you actually logged and what you wrote in recent
//    evenings, and kept on the journal row with your answer.
// 4. Anything else.
//
// They're asked one at a time rather than as a wall of boxes: a page of
// empty textareas gets skimmed, a single question gets answered.

const GODS_HAND = "Where did you see God's hand today?";
const ANYTHING_ELSE = "Anything else about today?";

// Used only when tonight's questions couldn't be written (no signal, the
// assistant down). Better a good general question than no reflection.
const FALLBACK = {
  savior: "Where did you feel closest to the Savior today, and where do you want to be closer tomorrow?",
  learn: "What did today teach you that you want to carry into tomorrow?",
};

function cardsFor(journal) {
  return [
    {
      key: "godsHand",
      label: "God's hand",
      question: GODS_HAND,
      nudge: journal?.gods_hand_nudge,
      placeholder: "The small moments count. Especially the small ones.",
    },
    {
      key: "qSavior",
      label: "Toward the Savior",
      question: journal?.q_savior_prompt || FALLBACK.savior,
      placeholder: "Be specific about a moment, not a general grade.",
    },
    {
      key: "qLearn",
      label: "Learning from today",
      question: journal?.q_learn_prompt || FALLBACK.learn,
      placeholder: "What would you tell yourself tomorrow morning?",
    },
    {
      key: "thoughts",
      label: "Anything else",
      question: ANYTHING_ELSE,
      placeholder: "How the day actually went, in your own words.",
    },
  ];
}

// Every answer a journal row holds, in reading order, with the question it
// answered. Days reflected under the earlier five questions keep their
// labels and wording, so nothing written before this changes meaning.
export function answeredCards(journal) {
  if (!journal) return [];
  const rows = [
    { label: "God's hand", question: GODS_HAND, text: journal.gods_hand },
    { label: "Toward the Savior", question: journal.q_savior_prompt || FALLBACK.savior, text: journal.q_savior },
    { label: "Learning from today", question: journal.q_learn_prompt || FALLBACK.learn, text: journal.q_learn },
    {
      label: "Centered",
      question: "Where was I centered on God and Jesus Christ today — and where did I act as though I were on my own?",
      text: journal.q_christ,
    },
    { label: "Principles", question: "Did today's choices match the principles I say I hold?", text: journal.q_principles },
    {
      label: "Direction",
      question: "Was what I did today actually moving me toward what I'm trying to become, or only toward being busy?",
      text: journal.q_success,
    },
    { label: "Gratitude", question: "What am I grateful for, and where did I see God's hand today?", text: journal.gratitude },
    { label: "Anything else", question: ANYTHING_ELSE, text: journal.thoughts },
  ];
  return rows.filter((r) => (r.text ?? "").trim());
}

function toState(journal) {
  return {
    godsHand: journal?.gods_hand ?? "",
    qSavior: journal?.q_savior ?? "",
    qLearn: journal?.q_learn ?? "",
    thoughts: journal?.thoughts ?? "",
  };
}

// `moments` are the times you noted God's hand during the day (from the
// Walk with God card), shown under the first question so tonight's answer
// can start from them.
export default function ReflectionFlow({ userId, date, journal, moments = [], onSaved }) {
  const [answers, setAnswers] = useState(() => toState(journal));
  const [questions, setQuestions] = useState(null);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setAnswers(toState(journal));
  }, [journal, date]);

  useEffect(() => {
    setRunning(false);
    setStep(0);
    setQuestions(null);
  }, [date]);

  const completed = Boolean(journal?.reflection_completed_at);
  const written = answeredCards(journal);
  const cards = cardsFor({ ...(journal ?? {}), ...(questions ?? {}) });

  async function start() {
    setStep(0);
    setError(null);
    // Tonight's questions are written the first time you start. If they
    // already exist on the row, they're kept: the question you were asked is
    // part of the record.
    if (!journal?.q_savior_prompt && !questions) {
      setPreparing(true);
      try {
        const q = await generateReflectionQuestions(date);
        setQuestions({ gods_hand_nudge: q.gods_hand_nudge, q_savior_prompt: q.savior_question, q_learn_prompt: q.learn_question });
      } catch (err) {
        setError(`Couldn't write tonight's questions (${err.message}). Using general ones instead.`);
      } finally {
        setPreparing(false);
      }
    }
    setRunning(true);
  }

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

        {written.length > 0 ? (
          <>
            {written.map((c) => (
              <div key={c.label} style={{ marginBottom: 16 }}>
                <div className="eyebrow" style={{ marginBottom: 5 }}>{c.label}</div>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6, fontFamily: "var(--font-serif)" }}>{c.question}</div>
                <div className="prose">{c.text}</div>
              </div>
            ))}
            <button className="btn" onClick={start} disabled={preparing}>
              <PenLine size={14} />
              {preparing ? "Writing tonight's questions…" : completed ? "Revisit the reflection" : "Continue reflecting"}
            </button>
          </>
        ) : (
          <>
            <p className="card-note" style={{ marginBottom: 14 }}>
              Four cards: where you saw God's hand, two questions written from your day tonight, and anything else.
            </p>
            <button className="btn btn--accent" onClick={start} disabled={preparing}>
              <Sparkles size={15} />
              {preparing ? "Writing tonight's questions…" : "Start reflection"}
            </button>
          </>
        )}
        {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
      </div>
    );
  }

  // --- in progress ---------------------------------------------------------
  const card = cards[step];
  const isLast = step === cards.length - 1;

  return (
    <div className="card card--accent reflection-card">
      <div className="card-head">
        <span className="card-title"><PenLine size={14} />Reflection</span>
        <span className="mono faint" style={{ fontSize: 11.5 }}>{step + 1} / {cards.length}</span>
      </div>

      {/* Steps rather than a bar: you can see how many are left and jump
          back to one you want to change. */}
      <div className="row" style={{ gap: 4, marginBottom: 18 }}>
        {cards.map((c, i) => (
          <button
            key={c.key}
            onClick={() => setStep(i)}
            title={c.label}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 999,
              border: "none",
              padding: 0,
              background: i === step ? "var(--accent)" : (answers[c.key] ?? "").trim() ? "var(--accent-line)" : "var(--inset)",
            }}
          />
        ))}
      </div>

      <div className="eyebrow" style={{ marginBottom: 6 }}>{card.label}</div>
      <p className="question">{card.question}</p>
      {card.nudge && <p className="reflection-nudge">{card.nudge}</p>}

      {card.key === "godsHand" && moments.length > 0 && (
        <div className="moments">
          <div className="eyebrow" style={{ marginBottom: 6 }}><HandHeart size={11} style={{ verticalAlign: -1 }} /> You noted today</div>
          {moments.map((m) => (
            <div key={m.id} className="moment">{m.what_came}</div>
          ))}
        </div>
      )}

      <textarea
        key={card.key}
        className="textarea"
        value={answers[card.key]}
        onChange={(e) => setAnswers((a) => ({ ...a, [card.key]: e.target.value }))}
        placeholder={card.placeholder}
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
